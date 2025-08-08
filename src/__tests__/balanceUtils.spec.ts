import { describe, it, expect } from 'vitest';
import { nextXpNeeded, spawnIntervalAt, auraRadiusAt, auraDpsAt } from '../balanceUtils';
import { XP_CURVE_MULT, XP_CURVE_FLAT, SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN } from '../constants/balance';

describe('balance utils', () => {
  it('nextXpNeeded follows curve', () => {
    const start = 10;
    const next = nextXpNeeded(start);
    expect(next).toBe(Math.round(start * XP_CURVE_MULT + XP_CURVE_FLAT));
  });
  it('spawnIntervalAt clamps and decays', () => {
    const at0 = spawnIntervalAt(0);
    expect(at0).toBeCloseTo(SPAWN_INTERVAL_START);
    const late = spawnIntervalAt(10000);
    expect(late).toBe(SPAWN_INTERVAL_MIN);
  });
  it('aura radius scaling', () => {
    const base = auraRadiusAt(1);
    const lvl2 = auraRadiusAt(2);
    expect(lvl2).toBeCloseTo(base * 1.2);
  });
  it('aura dps linear', () => {
    const d1 = auraDpsAt(1);
    const d3 = auraDpsAt(3);
    expect(d3).toBeCloseTo(d1 * 3);
  });
});
