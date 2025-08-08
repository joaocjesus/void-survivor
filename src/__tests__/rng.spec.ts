import { describe, it, expect } from 'vitest';
import { randomRng } from '../rng';

describe('randomRng', () => {
    it('produces deterministic sequence for same seed', () => {
        const a = randomRng(123);
        const b = randomRng(123);
        const seqA = Array.from({ length: 5 }, () => a());
        const seqB = Array.from({ length: 5 }, () => b());
        expect(seqA).toEqual(seqB);
    });
    it('different seeds differ', () => {
        const a = randomRng(123)();
        const b = randomRng(124)();
        expect(a).not.toBe(b);
    });
    it('values in [0,1)', () => {
        const r = randomRng(999);
        for (let i = 0; i < 10; i++) {
            const v = r();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});
