import { GameState, Entity } from './types';

export function clamp(v: number, min: number, max: number): number {
    return v < min ? min : (v > max ? max : v);
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
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
