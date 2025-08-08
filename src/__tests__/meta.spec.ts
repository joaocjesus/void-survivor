import { describe, it, expect } from 'vitest';
import { META_UPGRADES, buildStartStats } from '../meta';
import { START_STATS, META_VALUES } from '../constants/balance';
import type { MetaSave } from '../types';

describe('meta upgrades application', () => {
  it('applies no upgrades when purchased empty', () => {
    const meta: MetaSave = { shards:0, purchased:{}, stats:{ totalKills:0,totalTime:0,runs:0,bestTime:0 } };
    const stats = buildStartStats(meta);
    expect(stats.maxHp).toBe(START_STATS.MAX_HP);
    expect(stats.damage).toBe(START_STATS.DAMAGE);
  });
  it('applies multiple levels of upgrades', () => {
    const meta: MetaSave = { shards:0, purchased:{ meta_hp:2, meta_damage:3, meta_speed:1 }, stats:{ totalKills:0,totalTime:0,runs:0,bestTime:0 } };
    const stats = buildStartStats(meta);
    expect(stats.maxHp).toBe(START_STATS.MAX_HP + META_VALUES.HP_PER_LEVEL * 2);
    expect(stats.damage).toBe(START_STATS.DAMAGE + META_VALUES.DAMAGE_PER_LEVEL * 3);
    // Speed multiplied (approx). Floating point safe check.
    const expectedSpeed = START_STATS.SPEED * (1 + META_VALUES.SPEED_PCT_PER_LEVEL * 1);
    expect(Math.abs(stats.speed - expectedSpeed)).toBeLessThan(1e-8);
  });
});
