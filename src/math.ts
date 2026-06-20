import { GameState, Entity } from './types';

export function clamp(v: number, min: number, max: number): number {
    return v < min ? min : (v > max ? max : v);
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

export function isEntityInViewport(e: Entity, width: number, height: number): boolean {
    const radius = e.radius || 0;
    return e.x + radius >= 0 && e.x - radius <= width && e.y + radius >= 0 && e.y - radius <= height;
}

// Choose firing angles for `shots` bolts. Each shot aims at a distinct mob
// within `reach` (nearest first); once distinct enemies run out, extra shots reuse
// targets round-robin. Duplicate shots only fan when there are multiple targets;
// with one target, every shot converges so upgrades don't make accuracy worse.
// With no enemies in range, every shot uses `fallbackAngle`.
export function chooseShotAngles(
    px: number, py: number, mobs: Entity[], shots: number,
    reach: number, fallbackAngle: number, dupSpread = 0.18
): number[] {
    const reachSq = reach * reach;
    const targets = mobs
        .map(e => ({ e, d: distSq(px, py, e.x, e.y) }))
        .filter(t => t.d <= reachSq)
        .sort((a, b) => a.d - b.d)
        .map(t => t.e);
    const angles: number[] = [];
    for (let i = 0; i < shots; i++) {
        if (targets.length === 0) { angles.push(fallbackAngle); continue; }
        const t = targets[i % targets.length];
        let angle = Math.atan2(t.y - py, t.x - px);
        if (i >= targets.length && targets.length > 1) {
            const dup = Math.floor(i / targets.length);
            angle += (dup % 2 === 1 ? 1 : -1) * Math.ceil(dup / 2) * dupSpread;
        }
        angles.push(angle);
    }
    return angles;
}

// Returns an angle (radians) toward the nearest mob (if any); otherwise undefined.
export function pickAngle(gs: GameState): number | undefined {
    const player = gs.entities.get(gs.playerId);
    if (!player) return;
    let best: { e: Entity; d: number } | null = null;
    for (const e of gs.entities.values()) {
        if (e.kind !== 'mob') continue;
        const d = distSq(player.x, player.y, e.x, e.y);
        if (!best || d < best.d) best = { e, d };
    }
    if (!best) return;
    return Math.atan2(best.e.y - player.y, best.e.x - player.x);
}
