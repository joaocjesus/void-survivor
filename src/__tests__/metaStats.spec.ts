import { describe, it, expect } from 'vitest';
import { buildMetaStats } from '../ui/metaStats';
import { MetaSave } from '../types';

describe('meta stats builder', () => {
  it('builds lines with derived shard and average metrics', () => {
    const meta: MetaSave = {
      shards: 120,
      purchased: { meta_hp: 2, meta_damage: 1 },
      stats: { totalKills: 300, totalTime: 900, runs: 3, bestTime: 400 }
    };
    const lines = buildMetaStats(meta);
    // Basic presence checks
    expect(lines.find(l => l.startsWith('Runs:'))).toBeDefined();
    expect(lines.find(l => l.startsWith('Total Play Time:'))).toContain('15m'); // 900s -> 15m 0s
    expect(lines.find(l => l.startsWith('Best Survival Time:'))).toContain('6m'); // 400s -> 6m 40s
    expect(lines.find(l => l.startsWith('Total Kills:'))).toContain('300');
    expect(lines.find(l => l.startsWith('Average Time / Run:'))).toBeDefined();
    expect(lines.find(l => l.startsWith('Average Kills / Run:'))).toContain('100.0'); // 300 / 3
    expect(lines.find(l => l.startsWith('Current Shards:'))).toContain('120');
    // Spent shards: hp(2) -> 20 + 30 = 50, damage(1) -> 15, total 65
    expect(lines.find(l => l.startsWith('Spent Shards'))).toContain('65');
    expect(lines.find(l => l.startsWith('Total Shards Acquired'))).toContain(String(120 + 65));
  });
  it('handles zero runs gracefully', () => {
    const meta: MetaSave = { shards: 0, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
    const lines = buildMetaStats(meta);
    expect(lines.find(l => l.startsWith('Average Time / Run:'))).toContain('-');
    expect(lines.find(l => l.startsWith('Average Kills / Run:'))).toContain('-');
  });
});
