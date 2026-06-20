import { describe, it, expect } from 'vitest';
import { buildStartStats, computeSpentShards, isRunUpgradeUnlockedByMeta, purchaseMeta, refundAllMeta, resetMeta, refundState, visibleMetaUpgrades } from '../meta';
import { START_STATS, META_VALUES } from '../constants/balance';
import type { MetaSave } from '../types';

// Provide a minimal localStorage shim for functions that persist
if (!(globalThis as any).localStorage) {
    (globalThis as any).localStorage = {
        _data: {} as Record<string, string>,
        getItem(k: string) { return (this._data as any)[k] ?? null; },
        setItem(k: string, v: string) { (this._data as any)[k] = v; },
        removeItem(k: string) { delete (this._data as any)[k]; },
        clear() { this._data = {}; }
    };
}

describe('meta upgrades application', () => {
    it('applies no upgrades when purchased empty', () => {
        const meta: MetaSave = { shards: 0, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        const stats = buildStartStats(meta);
        expect(stats.maxHp).toBe(START_STATS.MAX_HP);
        expect(stats.damage).toBe(START_STATS.DAMAGE);
        expect(stats.rerolls).toBe(START_STATS.REROLLS);
        expect(stats.bans).toBe(START_STATS.BANS);
    });
    it('applies multiple levels of upgrades', () => {
        const meta: MetaSave = { shards: 0, purchased: { meta_root_damage: 1, meta_bolt_damage: 3, meta_move_speed: 1, meta_pickup_range: 2 }, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        const stats = buildStartStats(meta);
        expect(stats.damage).toBe(START_STATS.DAMAGE + META_VALUES.DAMAGE_PER_LEVEL * 4);
        expect(stats.pickupRange).toBe(START_STATS.PICKUP_RANGE + META_VALUES.PICKUP_RANGE_PER_LEVEL * 2);
        // Speed multiplied (approx). Floating point safe check.
        const expectedSpeed = START_STATS.SPEED * (1 + META_VALUES.SPEED_PCT_PER_LEVEL * 1);
        expect(Math.abs(stats.speed - expectedSpeed)).toBeLessThan(1e-8);
    });

    it('requires the root damage node before branches can be purchased', () => {
        const meta: MetaSave = { shards: 100, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        expect(purchaseMeta(meta, 'meta_bolt_damage')).toBe(false);
        expect(purchaseMeta(meta, 'meta_root_damage')).toBe(true);
        expect(purchaseMeta(meta, 'meta_bolt_damage')).toBe(true);
    });

    it('reveals tree branches incrementally', () => {
        const meta: MetaSave = { shards: 0, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        expect(visibleMetaUpgrades(meta).map(def => def.id)).toEqual(['meta_root_damage']);

        meta.purchased.meta_root_damage = 1;
        expect(visibleMetaUpgrades(meta).map(def => def.id)).toEqual([
            'meta_root_damage',
            'meta_bolt_damage',
            'meta_bolt_speed',
            'meta_move_speed',
            'meta_pickup_range',
            'meta_magic_aura_unlock',
            'meta_magic_orbs_unlock',
        ]);

        meta.purchased.meta_magic_orbs_unlock = 1;
        expect(visibleMetaUpgrades(meta).map(def => def.id)).toContain('meta_magic_orbs_damage');
        expect(visibleMetaUpgrades(meta).map(def => def.id)).toContain('meta_magic_orbs_speed');
    });

    it('gates run power cards behind meta power unlocks', () => {
        const meta: MetaSave = { shards: 0, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        expect(isRunUpgradeUnlockedByMeta(meta, 'damage')).toBe(true);
        expect(isRunUpgradeUnlockedByMeta(meta, 'auraRadius')).toBe(false);
        expect(isRunUpgradeUnlockedByMeta(meta, 'magicOrbs')).toBe(false);
        meta.purchased.meta_magic_orbs_unlock = 1;
        expect(isRunUpgradeUnlockedByMeta(meta, 'magicOrbs')).toBe(true);
        expect(isRunUpgradeUnlockedByMeta(meta, 'magicOrbDamage')).toBe(true);
    });
});

describe('meta refund & reset utilities', () => {
    it('computes spent shards across multiple upgrades', () => {
        const meta: MetaSave = { shards: 0, purchased: { meta_root_damage: 1, meta_bolt_damage: 2 }, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        // root damage costs 1; bolt damage costs: (15)+(25)=40
        const spent = computeSpentShards(meta);
        expect(spent).toBe(41);
    });
    it('refundAllMeta returns shards and clears purchases', () => {
        const meta: MetaSave = { shards: 5, purchased: { meta_root_damage: 1, meta_bolt_speed: 1 }, stats: { totalKills: 1, totalTime: 10, runs: 1, bestTime: 10 } };
        // root: 1, bolt speed: 15
        const { refunded } = refundAllMeta(meta);
        expect(refunded).toBe(16);
        expect(meta.shards).toBe(5 + 16);
        expect(Object.keys(meta.purchased).length).toBe(0);
    });
    it('resetMeta wipes shards, purchases, and stats', () => {
        const meta: MetaSave = { shards: 123, purchased: { meta_root_damage: 1 }, stats: { totalKills: 10, totalTime: 500, runs: 3, bestTime: 200 } };
        resetMeta(meta);
        expect(meta.shards).toBe(0);
        expect(meta.purchased).toEqual({});
        expect(meta.stats).toEqual({ totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 });
    });
    it('refundState reports disabled when nothing purchased', () => {
        const meta: MetaSave = { shards: 10, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        const state = refundState(meta);
        expect(state.disabled).toBe(true);
        expect(state.spent).toBe(0);
    });
    it('refundState reports spent and enabled when purchases exist', () => {
        const meta: MetaSave = { shards: 10, purchased: { meta_root_damage: 1 }, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        const state = refundState(meta);
        expect(state.disabled).toBe(false);
        expect(state.spent).toBeGreaterThan(0);
    });
});
