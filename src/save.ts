// Utility to export / import a lightweight snapshot of the current run for debugging.
// This intentionally does NOT try to serialize every entity (mobs/projectiles/particles)
// because recreating transient combat state perfectly isn't required for skipping early game.
// Instead we persist player stats + progression (level/xp/kills/shards + meta shards) so a run can resume mid-progression.

import { MetaSave } from './types';
import type { Game } from './game';

// Meta-only snapshot (no live run state). Keeps version for forward compatibility.
export interface MetaSnapshot { version: 1; timestamp: number; meta: MetaSave; }

export function buildSnapshot(game: Game): MetaSnapshot | null {
    const gs = (game as any).gs; if (!gs) return null;
    return { version: 1, timestamp: Date.now(), meta: gs.meta };
}

export function downloadSnapshot(snap: MetaSnapshot) {
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date(snap.timestamp).toISOString().replace(/[:.]/g, '-');
    a.download = `void-survivor-meta-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
export function applySnapshot(game: Game, snap: MetaSnapshot) {
    if (snap.version !== 1) { console.warn('Unknown meta snapshot version', snap.version); }
    const gs: any = (game as any).gs; if (!gs) return;
    if (!snap.meta) { console.warn('Snapshot missing meta'); return; }
    // Merge meta: prefer higher shards, union purchased, sum stats
    const current = gs.meta;
    current.shards = Math.max(current.shards, snap.meta.shards);
    current.purchased = { ...current.purchased, ...snap.meta.purchased };
    current.stats = {
        totalKills: Math.max(current.stats.totalKills, snap.meta.stats.totalKills),
        totalTime: Math.max(current.stats.totalTime, snap.meta.stats.totalTime),
        runs: Math.max(current.stats.runs, snap.meta.stats.runs),
        bestTime: Math.max(current.stats.bestTime, snap.meta.stats.bestTime)
    };
    console.info('[save] Meta snapshot applied');
}

export function promptLoadSnapshot(cb: (snap: MetaSnapshot) => void) {
    let input = document.getElementById('vs-load-file') as HTMLInputElement | null;
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.style.display = 'none';
        input.id = 'vs-load-file';
        document.body.appendChild(input);
    }
    input.onchange = () => {
        const file = input!.files && input!.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try { const parsed = JSON.parse(String(reader.result)); cb(parsed); }
            catch (e) { console.error('Failed to parse snapshot', e); }
            finally { input!.value = ''; }
        };
        reader.readAsText(file);
    };
    input.click();
}
