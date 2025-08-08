/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { confirmAction } from '../ui/confirm';
import { MetaSave } from '../types';
import { purchaseMeta, refundAllMeta } from '../meta';
import { handleRefundClick, updateRefundButton } from '../ui/metaRefund';

// Minimal localStorage shim (if not already present from other tests)
if (!(globalThis as any).localStorage) {
    (globalThis as any).localStorage = { _data: {}, getItem(k: string) { return (this._data as any)[k] ?? null; }, setItem(k: string, v: string) { (this._data as any)[k] = v; }, removeItem(k: string) { delete (this._data as any)[k]; }, clear() { this._data = {}; } };
}

function nextTick() { return new Promise(r => setTimeout(r, 0)); }

function makeMeta(shards: number): MetaSave { return { shards, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } }; }

describe('confirmAction modal', () => {
    it('resolves true when accept clicked', async () => {
        const p = confirmAction('Are you sure?', { acceptText: 'Do', cancelText: 'No' });
        await nextTick();
        const accept = document.querySelector('.vs-accept') as HTMLButtonElement;
        expect(accept).toBeTruthy();
        accept.click();
        const result = await p;
        expect(result).toBe(true);
    });

    it('resolves false when cancel clicked', async () => {
        const p = confirmAction('Cancel me');
        await nextTick();
        const cancel = document.querySelector('.vs-cancel') as HTMLButtonElement;
        cancel.click();
        const result = await p;
        expect(result).toBe(false);
    });

    it('resolves false on Escape key', async () => {
        const p = confirmAction('Esc test');
        await nextTick();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
        const result = await p;
        expect(result).toBe(false);
    });

    it('reuses root element on multiple calls', async () => {
        const first = confirmAction('First');
        await nextTick();
        const root1 = document.getElementById('vsConfirmRoot');
        (document.querySelector('.vs-accept') as HTMLButtonElement).click();
        await first;
        const second = confirmAction('Second');
        await nextTick();
        const root2 = document.getElementById('vsConfirmRoot');
        expect(root1).toBe(root2);
        (document.querySelector('.vs-cancel') as HTMLButtonElement).click();
        await second;
    });

    it('focuses accept button initially', async () => {
        const p = confirmAction('Focus test');
        await nextTick();
        const accept = document.querySelector('.vs-accept') as HTMLButtonElement;
        // Allow microtask for focus
        await nextTick();
        expect(document.activeElement).toBe(accept);
        accept.click();
        await p;
    });
});

describe('refund integration guarded by confirmation', () => {
    it('does not refund when confirmAction canceled', async () => {
        const meta = makeMeta(300);
        purchaseMeta(meta, 'meta_hp'); // spend some shards
        const spentBefore = 300 - meta.shards;
        // Simulate user cancel: open modal then cancel
        const shardsEl = document.createElement('div'); shardsEl.id = 'metaShards'; document.body.appendChild(shardsEl);
        const btn = document.createElement('button'); btn.id = 'btnRefundMeta'; document.body.appendChild(btn);
        updateRefundButton(meta, btn);
        // Start confirm and cancel
        const confirmP = confirmAction('Refund?');
        await nextTick();
        (document.querySelector('.vs-cancel') as HTMLButtonElement).click();
        const ok = await confirmP; // false
        expect(ok).toBe(false);
        // We intentionally DO NOT call handleRefundClick when ok false
        expect(meta.shards).toBe(300 - spentBefore);
        expect(Object.keys(meta.purchased).length).toBe(1);
    });

    it('refunds when confirmation accepted', async () => {
        const meta = makeMeta(300);
        purchaseMeta(meta, 'meta_hp');
        const spentBefore = 300 - meta.shards;
        const shardsEl = document.createElement('div'); shardsEl.id = 'metaShards'; document.body.appendChild(shardsEl);
        const btn = document.createElement('button'); btn.id = 'btnRefundMeta'; document.body.appendChild(btn);
        updateRefundButton(meta, btn);
        const confirmP = confirmAction('Refund?');
        await nextTick();
        (document.querySelector('.vs-accept') as HTMLButtonElement).click();
        const ok = await confirmP;
        if (ok) {
            const refunded = handleRefundClick(meta, shardsEl, btn, () => true, () => { });
            expect(refunded).toBe(spentBefore);
            expect(meta.shards).toBe(300);
            expect(Object.keys(meta.purchased).length).toBe(0);
        } else {
            throw new Error('Expected confirmation accept path');
        }
    });
});
