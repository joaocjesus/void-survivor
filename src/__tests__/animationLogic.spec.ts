import { describe, it, expect } from 'vitest';
import { computeMovingState, smoothAnimSpeed } from '../animationLogic';

describe('computeMovingState', () => {
    it('stays moving while input active', () => {
        const r1 = computeMovingState(true, false, 0.016, 0.1, 0);
        expect(r1.moving).toBe(true);
        expect(r1.remainingGrace).toBeCloseTo(0.1);
    });
    it('uses displacement if no input', () => {
        const r = computeMovingState(false, true, 0.016, 0.1, 0);
        expect(r.moving).toBe(true);
    });
    it('consumes grace after input stops', () => {
        // Start moving
        let state = computeMovingState(true, false, 0.016, 0.1, 0);
        // Input stops
        state = computeMovingState(false, false, 0.05, 0.1, state.remainingGrace);
        expect(state.moving).toBe(true);
        expect(state.remainingGrace).toBeLessThan(0.1);
        // After enough time grace expires
        state = computeMovingState(false, false, 0.2, 0.1, state.remainingGrace);
        expect(state.moving).toBe(false);
    });
});

describe('smoothAnimSpeed', () => {
    it('approaches target', () => {
        const s1 = smoothAnimSpeed(0, 1, 0.016, 10);
        expect(s1).toBeGreaterThan(0);
        const s2 = smoothAnimSpeed(s1, 1, 0.016, 10);
        expect(s2).toBeGreaterThan(s1);
    });
    it('handles non-finite values gracefully', () => {
        const s = smoothAnimSpeed(Number.NaN as any, Number.POSITIVE_INFINITY as any, 0.016, 10);
        expect(isFinite(s)).toBe(true);
    });
});
