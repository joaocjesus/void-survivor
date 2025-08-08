import { describe, it, expect } from 'vitest';
import { UPGRADES, pickRandomUpgrades } from '../upgrades';
import type { GameState, Entity, UpgradeDef } from '../types';

function makeState(rng: () => number): GameState {
    const entities = new Map<number, Entity>();
    entities.set(0, { id: 0, x: 0, y: 0, vx: 0, vy: 0, radius: 10, kind: 'player', hp: 10, maxHp: 10, damage: 5, speed: 100 });
    return { time: 0, playerId: 0, entities, nextEntityId: 1, spawnTimer: 0, projectileTimer: 0, xp: 0, level: 1, xpNeeded: 5, kills: 0, rng, paused: false, upgradePool: [...UPGRADES], offeredUpgrades: [], runActive: true, startStats: {} as any, meta: { shards: 0, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } } };
}

describe('pickRandomUpgrades', () => {
    it('returns requested count or less if pool smaller', () => {
        const gs = makeState(() => 0.1);
        const picks = pickRandomUpgrades(gs, 3);
        expect(picks.length).toBe(3);
    });
    it('no duplicates within one pick', () => {
        const seq = [0.1, 0.2, 0.3, 0.4, 0.5];
        let i = 0; const rng = () => seq[i++ % seq.length];
        const gs = makeState(rng);
        const picks = pickRandomUpgrades(gs, 5);
        const ids = new Set(picks.map(p => p.id));
        expect(ids.size).toBe(picks.length);
    });
    it('is deterministic with seeded rng', () => {
        const seq = [0.11, 0.22, 0.33, 0.44, 0.55];
        const rng1 = (() => { let i = 0; return () => seq[i++ % seq.length]; })();
        const rng2 = (() => { let i = 0; return () => seq[i++ % seq.length]; })();
        const g1 = makeState(rng1);
        const g2 = makeState(rng2);
        const a = pickRandomUpgrades(g1, 4).map(u => u.id);
        const b = pickRandomUpgrades(g2, 4).map(u => u.id);
        expect(a).toEqual(b);
    });
});
