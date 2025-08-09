// Movement / animation tuning constants.
// Adjust here instead of sprinkling literals around the codebase.
export const MOVE_EPSILON = 0.05; // Minimum distance to count as movement (filters micro jitter)
export const MOVE_ANIM_SPEED = 0.7; // Animation speed while moving

// Returns true if entity position changed more than the epsilon threshold.
// Prevents animation when opposing inputs cancel (net displacement ~ 0).
export function didMove(prevX: number, prevY: number, x: number, y: number, epsilon: number = MOVE_EPSILON): boolean {
  return Math.hypot(x - prevX, y - prevY) > epsilon;
}
