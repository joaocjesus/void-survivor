import { describe, it, expect } from 'vitest';
import { didMove, MOVE_EPSILON } from '../movement';

describe('didMove', () => {
  it('detects movement beyond epsilon', () => {
    expect(didMove(0,0,MOVE_EPSILON * 2,0)).toBe(true);
  });
  it('ignores sub-epsilon jitter', () => {
    expect(didMove(0,0,MOVE_EPSILON * 0.2,0)).toBe(false);
  });
  it('stays false when positions unchanged (opposing inputs cancelled)', () => {
    expect(didMove(10,10,10,10)).toBe(false);
  });
});
