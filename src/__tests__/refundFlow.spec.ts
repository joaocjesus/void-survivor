import { describe, it, expect } from 'vitest';
import { loadMeta, purchaseMeta, refundAllMeta, META_UPGRADES } from '../meta';
import type { MetaSave } from '../types';

// LocalStorage shim (shared with other tests normally, but re-define defensively)
if (!(globalThis as any).localStorage) {
    (globalThis as any).localStorage = {
        _data: {} as Record<string, string>,
        getItem(k: string) { return (this._data as any)[k] ?? null; },
        setItem(k: string, v: string) { (this._data as any)[k] = v; },
        removeItem(k: string) { delete (this._data as any)[k]; },
        clear() { this._data = {}; }
    };
}

function makeMeta(shards: number): MetaSave {
    return { shards, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
}

describe('refund purchase flow', () => {
    it('restores shard total after refunding all purchased upgrades', () => {
        const meta = makeMeta(500);
        // Buy first two upgrades a few levels each until shards drop
        const buyOrder = ['meta_hp', 'meta_damage', 'meta_speed'];
        let initial = meta.shards;
        let purchases = 0;
        for (let i = 0; i < 9; i++) {
            const id = buyOrder[i % buyOrder.length];
            const ok = purchaseMeta(meta, id);
            if (!ok) break; else purchases++;
        }
        expect(purchases).toBeGreaterThan(0);
        expect(meta.shards).toBeLessThan(initial);
        const afterPurchases = meta.shards;
        const { refunded } = refundAllMeta(meta);
        expect(refunded).toBeGreaterThan(0);
        // After refund shards should return to initial (no runs adding shards during test)
        expect(meta.shards).toBe(initial);
        // Purchased should be cleared
        expect(Object.keys(meta.purchased).length).toBe(0);
        // Sanity: shards increased by exactly what was spent
        expect(initial - afterPurchases).toBe(refunded);
    });
});
