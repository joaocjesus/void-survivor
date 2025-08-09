// Animation state helper to provide a grace period that keeps the walk cycle
// playing briefly after input stops (prevents flicker when rolling between
// single-axis and diagonal movement or during rapid key transitions).
// Returns the new moving flag plus the updated remaining grace time.
export function computeMovingState(
    inputActive: boolean,
    displacementMoving: boolean,
    dt: number,
    graceDuration: number,
    remainingGrace: number
): { moving: boolean; remainingGrace: number } {
    if (inputActive || displacementMoving) {
        return { moving: true, remainingGrace: graceDuration };
    }
    if (remainingGrace > 0) {
        const newRemain = Math.max(0, remainingGrace - dt);
        return { moving: true, remainingGrace: newRemain };
    }
    return { moving: false, remainingGrace: 0 };
}

// Exponential smoothing (lerp) for animation speed to avoid abrupt stalls
// when target speed changes sharply (e.g., direction change).
export function smoothAnimSpeed(current: number, target: number, dt: number, stiffness: number = 10): number {
    if (!isFinite(current)) current = 0;
    if (!isFinite(target)) target = 0;
    const alpha = Math.min(1, dt * stiffness);
    return current + (target - current) * alpha;
}
