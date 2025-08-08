/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { MetaSave } from '../types';
import { purchaseMeta, META_UPGRADES } from '../meta';
import { updateRefundButton, handleRefundClick } from '../ui/metaRefund';

if (!(globalThis as any).localStorage) {
    (globalThis as any).localStorage = { _data: {}, getItem(k: string) { return (this._data as any)[k] ?? null; }, setItem(k: string, v: string) { (this._data as any)[k] = v; }, removeItem(k: string) { delete (this._data as any)[k]; }, clear() { this._data = {}; } };
}

function makeMeta(shards: number): MetaSave { return { shards, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } }; }

function setupDom() {
    document.body.innerHTML = `\n  <div id="metaShards"></div>\n  <button id="btnRefundMeta"></button>`;
    return {
        shardsEl: document.getElementById('metaShards')!,
        btn: document.getElementById('btnRefundMeta') as HTMLButtonElement
    };
}

describe('meta refund button DOM logic', () => {
    it('disables button when no purchases and enables after purchase then disables after refund', () => {
        const meta = makeMeta(300);
        const { shardsEl, btn } = setupDom();
        // Initial state
        updateRefundButton(meta, btn);
        expect(btn.disabled).toBe(true);
        // Purchase some upgrades
        const first = META_UPGRADES[0];
        purchaseMeta(meta, first.id); // spend shards
        updateRefundButton(meta, btn);
        expect(btn.disabled).toBe(false);
        // Perform refund
        let confirmCalled = 0; let alertMsg: string | undefined;
        const refunded = handleRefundClick(meta, shardsEl, btn, () => { confirmCalled++; return true; }, m => { alertMsg = m; });
        expect(confirmCalled).toBe(1);
        expect(refunded).toBeGreaterThan(0);
        expect(btn.disabled).toBe(true); // after refund
        expect(alertMsg).toMatch(/Refunded/);
    });
});
