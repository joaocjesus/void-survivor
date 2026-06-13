// Movement / animation tuning constants.
// Adjust here instead of sprinkling literals around the codebase.
export const MOVE_EPSILON = 0.05; // Minimum distance to count as movement (filters micro jitter)
export const MOVE_ANIM_SPEED = 0.7; // Animation speed while moving

export interface ContactCircle {
    x: number;
    y: number;
    radius: number;
}

// Returns true if entity position changed more than the epsilon threshold.
// Prevents animation when opposing inputs cancel (net displacement ~ 0).
export function didMove(prevX: number, prevY: number, x: number, y: number, epsilon: number = MOVE_EPSILON): boolean {
    return Math.hypot(x - prevX, y - prevY) > epsilon;
}

export function advanceChaserUntilContact(
    chaser: ContactCircle,
    target: ContactCircle,
    speed: number,
    dt: number,
): { x: number; y: number; vx: number; vy: number; touching: boolean } {
    const contactDistance = chaser.radius + target.radius;
    const dx = target.x - chaser.x;
    const dy = target.y - chaser.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= contactDistance) {
        const awayX = dist > 0 ? -dx / dist : 1;
        const awayY = dist > 0 ? -dy / dist : 0;
        return {
            x: target.x + awayX * contactDistance,
            y: target.y + awayY * contactDistance,
            vx: 0,
            vy: 0,
            touching: true,
        };
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const gap = dist - contactDistance;
    const travel = Math.min(speed * dt, gap);
    const touching = travel >= gap;

    return {
        x: chaser.x + nx * travel,
        y: chaser.y + ny * travel,
        vx: touching ? 0 : nx * speed,
        vy: touching ? 0 : ny * speed,
        touching,
    };
}
