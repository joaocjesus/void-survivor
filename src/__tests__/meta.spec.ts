import { describe, it, expect } from 'vitest';
import { META_UPGRADES, buildStartStats, computeSpentShards, refundAllMeta, resetMeta, refundState } from '../meta';
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
    });
    it('applies multiple levels of upgrades', () => {
        const meta: MetaSave = { shards: 0, purchased: { meta_hp: 2, meta_damage: 3, meta_speed: 1 }, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        const stats = buildStartStats(meta);
        expect(stats.maxHp).toBe(START_STATS.MAX_HP + META_VALUES.HP_PER_LEVEL * 2);
        expect(stats.damage).toBe(START_STATS.DAMAGE + META_VALUES.DAMAGE_PER_LEVEL * 3);
        // Speed multiplied (approx). Floating point safe check.
        const expectedSpeed = START_STATS.SPEED * (1 + META_VALUES.SPEED_PCT_PER_LEVEL * 1);
        expect(Math.abs(stats.speed - expectedSpeed)).toBeLessThan(1e-8);
    });
});

describe('meta refund & reset utilities', () => {
    it('computes spent shards across multiple upgrades', () => {
        const meta: MetaSave = { shards: 0, purchased: { meta_hp: 3, meta_damage: 2 }, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        // meta_hp costs: (20 +0*10)+(20+1*10)+(20+2*10)=20+30+40=90
        // meta_damage costs: (15+0*8)+(15+1*8)=15+23=38
        const spent = computeSpentShards(meta);
        expect(spent).toBe(90 + 38);
    });
    it('refundAllMeta returns shards and clears purchases', () => {
        const meta: MetaSave = { shards: 5, purchased: { meta_hp: 2, meta_damage: 1 }, stats: { totalKills: 1, totalTime: 10, runs: 1, bestTime: 10 } };
        // hp: (20)+(30)=50, damage:(15)=15 total 65
        const { refunded } = refundAllMeta(meta);
        expect(refunded).toBe(65);
        expect(meta.shards).toBe(5 + 65);
        expect(Object.keys(meta.purchased).length).toBe(0);
    });
    it('resetMeta wipes shards, purchases, and stats', () => {
        const meta: MetaSave = { shards: 123, purchased: { meta_hp: 4 }, stats: { totalKills: 10, totalTime: 500, runs: 3, bestTime: 200 } };
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
        const meta: MetaSave = { shards: 10, purchased: { meta_hp: 1 }, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
        const state = refundState(meta);
        expect(state.disabled).toBe(false);
        expect(state.spent).toBeGreaterThan(0);
    });
});
