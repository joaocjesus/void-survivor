import { describe, it, expect } from 'vitest';
import { advanceChaserUntilContact, didMove, MOVE_EPSILON } from '../movement';

describe('didMove', () => {
    it('detects movement beyond epsilon', () => {
        expect(didMove(0, 0, MOVE_EPSILON * 2, 0)).toBe(true);
    });
    it('ignores sub-epsilon jitter', () => {
        expect(didMove(0, 0, MOVE_EPSILON * 0.2, 0)).toBe(false);
    });
    it('stays false when positions unchanged (opposing inputs cancelled)', () => {
        expect(didMove(10, 10, 10, 10)).toBe(false);
    });
});

describe('advanceChaserUntilContact', () => {
    it('moves a chaser toward the target when not touching', () => {
        const result = advanceChaserUntilContact(
            { x: 0, y: 0, radius: 5 },
            { x: 100, y: 0, radius: 10 },
            20,
            1,
        );

        expect(result.x).toBeCloseTo(20);
        expect(result.y).toBeCloseTo(0);
        expect(result.vx).toBeCloseTo(20);
        expect(result.vy).toBeCloseTo(0);
        expect(result.touching).toBe(false);
    });

    it('stops at the target edge instead of moving into overlap', () => {
        const result = advanceChaserUntilContact(
            { x: 0, y: 0, radius: 5 },
            { x: 20, y: 0, radius: 10 },
            20,
            1,
        );

        expect(result.x).toBeCloseTo(5);
        expect(result.y).toBeCloseTo(0);
        expect(result.vx).toBeCloseTo(0);
        expect(result.vy).toBeCloseTo(0);
        expect(result.touching).toBe(true);
    });

    it('resolves overlap by pushing the chaser away from the target', () => {
        const result = advanceChaserUntilContact(
            { x: 8, y: 0, radius: 5 },
            { x: 0, y: 0, radius: 10 },
            20,
            1,
        );

        expect(result.x).toBeCloseTo(15);
        expect(result.y).toBeCloseTo(0);
        expect(result.vx).toBeCloseTo(0);
        expect(result.vy).toBeCloseTo(0);
        expect(result.touching).toBe(true);
    });
});
