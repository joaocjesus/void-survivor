import type { Game } from '../game';
import type { MetaSave } from '../types';

interface DebugOptions {
    getCurrentGame: () => Game | null;
    meta: MetaSave;
    renderMeta: () => void;
    saveMeta: (meta: MetaSave) => void;
}

let wired = false;

function pushToast(msg: string, kind: 'info' | 'success' = 'info') {
    const root = document.getElementById('toastRoot');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 6600);
}

export function wireDevOptions(options: DebugOptions) {
    if (wired) return;
    const btnExport = document.getElementById('btnDebugExport') as HTMLButtonElement | null;
    const btnImport = document.getElementById('btnDebugImport') as HTMLButtonElement | null;
    const debugContainer = btnExport?.parentElement as HTMLElement | undefined;
    if (!btnExport || !btnImport || !debugContainer) return;

    const env = (import.meta as any).env || {};
    wired = env.VITE_DEV_OPTIONS === 'true';
    if (!wired) return;

    debugContainer.style.display = 'block';
    console.info('[dev] Developer options enabled');

    btnExport.addEventListener('click', async () => {
        try {
            const { buildSnapshot, downloadSnapshot } = await import('../save');
            const currentGame = options.getCurrentGame();
            const snap = currentGame ? buildSnapshot(currentGame) : { version: 1, timestamp: Date.now(), meta: options.meta };
            if (snap) {
                downloadSnapshot(snap as any);
                pushToast('Snapshot exported', 'success');
            }
        } catch (e) {
            console.warn('Export failed', e);
            pushToast('Export failed', 'info');
        }
    });

    btnImport.addEventListener('click', async () => {
        try {
            const { promptLoadSnapshot, applySnapshot } = await import('../save');
            promptLoadSnapshot(snap => {
                const currentGame = options.getCurrentGame();
                if (currentGame) {
                    applySnapshot(currentGame, snap as any);
                } else {
                    options.meta.shards = Math.max(options.meta.shards, snap.meta.shards);
                    options.meta.purchased = { ...options.meta.purchased, ...snap.meta.purchased };
                    options.meta.stats.totalKills = Math.max(options.meta.stats.totalKills, snap.meta.stats.totalKills);
                    options.meta.stats.totalTime = Math.max(options.meta.stats.totalTime, snap.meta.stats.totalTime);
                    options.meta.stats.runs = Math.max(options.meta.stats.runs, snap.meta.stats.runs);
                    options.meta.stats.bestTime = Math.max(options.meta.stats.bestTime, snap.meta.stats.bestTime);
                    options.saveMeta(options.meta);
                    const shardsEl = document.getElementById('metaShards');
                    if (shardsEl) shardsEl.textContent = `Shards: ${options.meta.shards}`;
                    const metaVisible = document.getElementById('metaMenu')?.style.display !== 'none';
                    if (metaVisible) options.renderMeta();
                    console.info('[dev] Meta snapshot imported without active run');
                }
                pushToast('Snapshot imported', 'success');
            });
        } catch (e) {
            console.warn('Import failed', e);
            pushToast('Import failed', 'info');
        }
    });
}
