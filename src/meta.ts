import { MetaSave, PersistPayload, PlayerStartStats, MetaUpgradeDef } from './types';
import { START_STATS, META_VALUES } from './constants/balance';

const STORAGE_KEY = 'survivors_meta_v1';

export const defaultStartStats: PlayerStartStats = {
    hp: START_STATS.HP,
    maxHp: START_STATS.MAX_HP,
    damage: START_STATS.DAMAGE,
    speed: START_STATS.SPEED,
    attackSpeed: START_STATS.ATTACK_SPEED,
    projectileSpeed: START_STATS.PROJECTILE_SPEED,
    pickupRange: START_STATS.PICKUP_RANGE,
    regen: START_STATS.REGEN,
    xpGain: START_STATS.XP_GAIN,
};

export const META_UPGRADES: MetaUpgradeDef[] = [
    { id: 'meta_hp', name: 'Vitality', description: `+${META_VALUES.HP_PER_LEVEL} Max HP per level`, maxLevel: 50, cost: l => 20 + l * 10, apply: (lvl, s) => { s.maxHp += META_VALUES.HP_PER_LEVEL * lvl; s.hp = s.maxHp; } },
    { id: 'meta_damage', name: 'Might', description: `+${META_VALUES.DAMAGE_PER_LEVEL} Damage per level`, maxLevel: 50, cost: l => 15 + l * 8, apply: (lvl, s) => { s.damage += META_VALUES.DAMAGE_PER_LEVEL * lvl; } },
    { id: 'meta_speed', name: 'Swiftness', description: `+${(META_VALUES.SPEED_PCT_PER_LEVEL * 100).toFixed(0)}% Move Speed / level`, maxLevel: 50, cost: l => 15 + l * 12, apply: (lvl, s) => { s.speed *= (1 + META_VALUES.SPEED_PCT_PER_LEVEL * lvl); } },
    { id: 'meta_regen', name: 'Regen', description: `+${META_VALUES.REGEN_PER_LEVEL} HP/s per level`, maxLevel: 50, cost: l => 30 + l * 15, apply: (lvl, s) => { s.regen += META_VALUES.REGEN_PER_LEVEL * lvl; } },
    { id: 'meta_pickup', name: 'Magnet', description: `+${META_VALUES.PICKUP_RANGE_PER_LEVEL} Pickup Range / level`, maxLevel: 20, cost: l => 20 + l * 14, apply: (lvl, s) => { s.pickupRange += META_VALUES.PICKUP_RANGE_PER_LEVEL * lvl; } },
    { id: 'meta_xp', name: 'Wisdom', description: `+${(META_VALUES.XP_GAIN_PCT_PER_LEVEL * 100).toFixed(0)}% XP Gain / level`, maxLevel: 40, cost: l => 25 + l * 20, apply: (lvl, s) => { s.xpGain *= (1 + META_VALUES.XP_GAIN_PCT_PER_LEVEL * lvl); } },
];

export function loadMeta(): MetaSave {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed: PersistPayload = JSON.parse(raw); return parsed.meta; } } catch { }
    return { shards: 0, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } };
}

export function saveMeta(meta: MetaSave) {
    const payload: PersistPayload = { meta };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { }
}

export function buildStartStats(meta: MetaSave): PlayerStartStats {
    const stats: PlayerStartStats = { ...defaultStartStats };
    for (const def of META_UPGRADES) { const lvl = meta.purchased[def.id] || 0; if (lvl > 0) def.apply(lvl, stats); }
    return stats;
}

export function purchaseMeta(meta: MetaSave, id: string): boolean {
    const def = META_UPGRADES.find(u => u.id === id); if (!def) return false;
    const current = meta.purchased[id] || 0; if (current >= def.maxLevel) return false;
    const cost = def.cost(current); if (meta.shards < cost) return false;
    meta.shards -= cost; meta.purchased[id] = current + 1; saveMeta(meta); return true;
}

export function totalMetaLevel(meta: MetaSave, id: string) { return meta.purchased[id] || 0; }

// Compute total shards spent on all purchased meta upgrades (summing actual incremental costs)
export function computeSpentShards(meta: MetaSave): number {
    let spent = 0;
    for (const def of META_UPGRADES) {
        const lvl = meta.purchased[def.id] || 0;
        for (let i = 0; i < lvl; i++) spent += def.cost(i);
    }
    return spent;
}

// Refund all meta upgrades: return spent shards and reset purchased map
export function refundAllMeta(meta: MetaSave): { refunded: number } {
    const refunded = computeSpentShards(meta);
    meta.shards += refunded;
    meta.purchased = {};
    saveMeta(meta);
    return { refunded };
}

// Derive state for a potential refund button without touching the DOM
export function refundState(meta: MetaSave): { disabled: boolean; spent: number } {
    const spent = computeSpentShards(meta);
    return { spent, disabled: spent === 0 };
}

// Hard reset: clear meta progress and stats (does not reload page)
export function resetMeta(meta: MetaSave) {
    meta.shards = 0;
    meta.purchased = {};
    meta.stats = { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 };
    saveMeta(meta);
}
