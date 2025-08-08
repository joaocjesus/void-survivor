import { MetaSave } from '../types';
import { computeSpentShards } from '../meta';

// Build an array of human-readable statistics lines for the meta progression.
export function buildMetaStats(meta: MetaSave): string[] {
    const lines: string[] = [];
    const spent = computeSpentShards(meta);
    const totalShardsAcquired = meta.shards + spent;
    const runs = meta.stats.runs;
    const totalTime = meta.stats.totalTime; // seconds
    const avgTime = runs > 0 ? totalTime / runs : 0;
    const avgKills = runs > 0 ? meta.stats.totalKills / runs : 0;
    const best = meta.stats.bestTime;
    const fmtTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}h ${m}m ${sec}s`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
    };
    lines.push(`Runs: ${runs}`);
    lines.push(`Total Play Time: ${fmtTime(totalTime)}`);
    lines.push(`Best Survival Time: ${fmtTime(best)}`);
    lines.push(`Total Kills: ${meta.stats.totalKills}`);
    lines.push(`Average Time / Run: ${runs ? fmtTime(avgTime) : '-'}`);
    lines.push(`Average Kills / Run: ${runs ? avgKills.toFixed(1) : '-'}`);
    lines.push(`Current Shards: ${meta.shards}`);
    lines.push(`Spent Shards (Upgrades): ${spent}`);
    lines.push(`Total Shards Acquired: ${totalShardsAcquired}`);
    return lines;
}
