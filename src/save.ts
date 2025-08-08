// Utility to export / import a lightweight snapshot of the current run for debugging.
// This intentionally does NOT try to serialize every entity (mobs/projectiles/particles)
// because recreating transient combat state perfectly isn't required for skipping early game.
// Instead we persist player stats + progression (level/xp/kills/shards + meta shards) so a run can resume mid-progression.

import { MetaSave } from './types';
import type { Game } from './game';

export interface SavedRun {
  version: 1;
  timestamp: number;
  time: number;
  level: number;
  xp: number;
  xpNeeded: number;
  kills: number;
  runShards: number;
  meta: MetaSave; // include meta so shard accumulation is preserved between builds
  player: {
    hp: number; maxHp: number; damage: number; speed: number; attackSpeed: number; projectileSpeed: number; pickupRange: number; regen: number; xpGain: number;
    auraLevel?: number;
    magicOrbCount?: number;
    magicOrbDamage?: number;
  };
  // In the future we can add: acquiredUpgrades: string[]; seed/state: ...
}

export function buildSnapshot(game: Game): SavedRun | null {
  const gs = (game as any).gs; if (!gs) return null;
  const player = gs.entities.get(gs.playerId); if (!player) return null;
  return {
    version: 1,
    timestamp: Date.now(),
    time: gs.time,
    level: gs.level,
    xp: gs.xp,
    xpNeeded: gs.xpNeeded,
    kills: gs.kills,
    runShards: gs.runShards || 0,
    meta: gs.meta,
    player: {
      hp: player.hp || 0,
      maxHp: player.maxHp || 0,
      damage: player.damage || 0,
      speed: player.speed || 0,
      attackSpeed: player.attackSpeed || 1,
      projectileSpeed: player.projectileSpeed || 0,
      pickupRange: player.pickupRange || 0,
      regen: player.regen || 0,
      xpGain: player.xpGain || 1,
      auraLevel: (player as any).auraLevel,
      magicOrbCount: (player as any).magicOrbCount ?? (player as any).orbitCount,
      magicOrbDamage: (player as any).magicOrbDamage ?? (player as any).orbitDamage,
    }
  };
}

export function downloadSnapshot(run: SavedRun) {
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date(run.timestamp).toISOString().replace(/[:.]/g, '-');
  a.download = `void-survivor-run-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function applySnapshot(game: Game, snap: SavedRun) {
  if (snap.version !== 1) { console.warn('Unknown snapshot version', snap.version); }
  const gs: any = (game as any).gs; if (!gs) return;
  const player = gs.entities.get(gs.playerId);
  if (!player) return;
  gs.time = snap.time;
  gs.level = snap.level;
  gs.xp = snap.xp;
  gs.xpNeeded = snap.xpNeeded;
  gs.kills = snap.kills;
  gs.runShards = snap.runShards;
  // meta shards may have grown during the run; keep the larger of existing vs snapshot to avoid accidental loss
  if (snap.meta) {
    if (snap.meta.shards > gs.meta.shards) gs.meta.shards = snap.meta.shards;
    // Keep purchased & stats (prefer existing if present to not regress lifetime counters)
    gs.meta.purchased = { ...snap.meta.purchased, ...gs.meta.purchased };
    gs.meta.stats = { ...snap.meta.stats, ...gs.meta.stats };
  }
  Object.assign(player, {
    hp: snap.player.hp,
    maxHp: snap.player.maxHp,
    damage: snap.player.damage,
    speed: snap.player.speed,
    attackSpeed: snap.player.attackSpeed,
    projectileSpeed: snap.player.projectileSpeed,
    pickupRange: snap.player.pickupRange,
    regen: snap.player.regen,
    xpGain: snap.player.xpGain,
  });
  (player as any).auraLevel = snap.player.auraLevel || (player as any).auraLevel;
  if (snap.player.magicOrbCount != null) (player as any).magicOrbCount = snap.player.magicOrbCount;
  if (snap.player.magicOrbDamage != null) (player as any).magicOrbDamage = snap.player.magicOrbDamage;
  // force HUD refresh
  game.updateHud();
  game.updateStatsOverlay();
  console.info('[save] Snapshot applied');
}

export function promptLoadSnapshot(cb: (snap: SavedRun) => void) {
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
