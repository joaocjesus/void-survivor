import { describe, it, expect } from 'vitest';
import { UPGRADES, applyUpgradeChoice, pickUpgradeOffers } from '../upgrades';
import { UPGRADE_RARITY_VALUES, effRarityWeight } from '../constants/rarity';
import type { GameState, Entity } from '../types';

function makeState(rng: () => number): GameState {
    const entities = new Map<number, Entity>();
    entities.set(0, { id: 0, x: 0, y: 0, vx: 0, vy: 0, radius: 10, kind: 'player', hp: 10, maxHp: 10, damage: 5, speed: 80 });
    return {
        time: 0, playerId: 0, entities, nextEntityId: 1, spawnTimer: 0, projectileTimer: 0,
        xp: 0, level: 1, xpNeeded: 5, kills: 0, rng, paused: false,
        upgradePool: [...UPGRADES], upgradeCounts: {}, offeredUpgrades: [], runActive: true,
        startStats: { speed: 80, attackSpeed: 1, projectileSpeed: 100, pickupRange: 50, hp: 10, maxHp: 10, damage: 5, regen: 0, xpGain: 1 } as any,
        meta: { shards: 0, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } },
    };
}

describe('pickUpgradeOffers', () => {
    it('returns requested count of distinct cards', () => {
        const gs = makeState(() => 0.1);
        const picks = pickUpgradeOffers(gs, 3);
        expect(picks.length).toBe(3);
        expect(new Set(picks.map(p => p.def.id)).size).toBe(3);
    });

    it('tags each offer with a rarity', () => {
        const gs = makeState(() => 0.1);
        for (const o of pickUpgradeOffers(gs, 3)) {
            expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(o.rarity);
        }
    });

    it('is deterministic with seeded rng', () => {
        const seq = [0.11, 0.22, 0.33, 0.44, 0.55];
        const mk = () => { let i = 0; return () => seq[i++ % seq.length]; };
        const a = pickUpgradeOffers(makeState(mk()), 4).map(o => `${o.def.id}:${o.rarity}`);
        const b = pickUpgradeOffers(makeState(mk()), 4).map(o => `${o.def.id}:${o.rarity}`);
        expect(a).toEqual(b);
    });

    it('gates orb-dependent cards until orbs are owned', () => {
        const gs = makeState(() => 0.1);
        const ids = new Set(pickUpgradeOffers(gs, UPGRADES.length).map(o => o.def.id));
        expect(ids.has('magicOrbDamage')).toBe(false);
        expect(ids.has('magicOrbSpeed')).toBe(false);
        applyUpgradeChoice(gs, UPGRADES.find(u => u.id === 'magicOrbs')!, 'uncommon');
        const ids2 = new Set(pickUpgradeOffers(gs, UPGRADES.length).map(o => o.def.id));
        expect(ids2.has('magicOrbDamage')).toBe(true);
        expect(ids2.has('magicOrbSpeed')).toBe(true);
    });
});

describe('rarity gating (effRarityWeight)', () => {
    it('disables tiers below a card minRarity', () => {
        expect(effRarityWeight('multiShot', 'common')).toBe(0);
        expect(effRarityWeight('multiShot', 'uncommon')).toBe(0);
        expect(effRarityWeight('multiShot', 'rare')).toBeGreaterThan(0);
        expect(effRarityWeight('magicOrbs', 'common')).toBe(0);
        expect(effRarityWeight('magicOrbs', 'uncommon')).toBeGreaterThan(0);
    });

    it('respects card minRarity in actual offers', () => {
        // multiShot is rare+; magicOrbs/auraRadius are uncommon+ — none should ever appear as common
        for (const o of [...Array(40)].map((_, i) => pickUpgradeOffers(makeState(() => (i + 1) / 41), 3)).flat()) {
            if (o.def.id === 'multiShot') expect(['rare', 'epic', 'legendary']).toContain(o.rarity);
            if (o.def.id === 'magicOrbs' || o.def.id === 'auraRadius') expect(o.rarity).not.toBe('common');
        }
    });
});

describe('applyUpgradeChoice', () => {
    it('applies rarity-scaled value and tracks pick count', () => {
        const gs = makeState(() => 0.1);
        const p = gs.entities.get(0)!;
        const before = p.damage!;
        const legendaryDmg = UPGRADE_RARITY_VALUES.damage.values.legendary!;
        applyUpgradeChoice(gs, UPGRADES.find(u => u.id === 'damage')!, 'legendary');
        expect(p.damage).toBe(before + legendaryDmg);
        expect(gs.upgradeCounts['damage']).toBe(1);
    });

    it('higher rarity grants a bigger bump', () => {
        const common = makeState(() => 0.1);
        const legendary = makeState(() => 0.1);
        const dmg = UPGRADES.find(u => u.id === 'damage')!;
        applyUpgradeChoice(common, dmg, 'common');
        applyUpgradeChoice(legendary, dmg, 'legendary');
        expect(legendary.entities.get(0)!.damage!).toBeGreaterThan(common.entities.get(0)!.damage!);
    });

    it('percent stats stack additively (linear), not multiplicatively', () => {
        const gs = makeState(() => 0.1);
        const p = gs.entities.get(0)!; // base speed 80
        const moveSpeed = UPGRADES.find(u => u.id === 'moveSpeed')!;
        applyUpgradeChoice(gs, moveSpeed, 'common'); // +10% of 80 = +8
        applyUpgradeChoice(gs, moveSpeed, 'common'); // +8 again (not 80*1.1*1.1)
        expect(p.speed).toBeCloseTo(96, 6);
    });

    it('projLifeSpan stacks additively on the multiplier', () => {
        const gs = makeState(() => 0.1);
        const p = gs.entities.get(0)!;
        const life = UPGRADES.find(u => u.id === 'projLifeSpan')!;
        applyUpgradeChoice(gs, life, 'common'); // +10% -> 1.1
        applyUpgradeChoice(gs, life, 'common'); // +10% -> 1.2
        expect(p.projLifeSpanMult).toBeCloseTo(1.2, 6);
    });
});
