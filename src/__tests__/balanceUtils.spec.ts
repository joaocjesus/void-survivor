import { describe, it, expect } from 'vitest';
import { nextXpNeeded, spawnIntervalAt, auraRadiusAt, auraDpsAt } from '../balanceUtils';
import { XP_CURVE_MULT, XP_CURVE_FLAT, SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, POWERS_VALUES, POWERS_UPGRADE_VALUES } from '../constants/balance';

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
  it('aura radius: level1=base; subsequent levels add increment', () => {
    const inc = POWERS_UPGRADE_VALUES.AURA_RADIUS_INCREMENT / 100;
    const lvl1 = auraRadiusAt(1);
    const lvl2 = auraRadiusAt(2);
    const lvl3 = auraRadiusAt(3);
    expect(lvl1).toBeCloseTo(POWERS_VALUES.AURA_BASE_RADIUS);
    expect(lvl2).toBeCloseTo(POWERS_VALUES.AURA_BASE_RADIUS * (1 + inc));
    expect(lvl3).toBeCloseTo(POWERS_VALUES.AURA_BASE_RADIUS * (1 + inc * 2));
  });
  it('aura dps linear', () => {
    const d1 = auraDpsAt(1);
    const d3 = auraDpsAt(3);
    expect(d3).toBeCloseTo(d1 * 3);
  });
});
