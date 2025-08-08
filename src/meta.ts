import { MetaSave, PersistPayload, PlayerStartStats, MetaUpgradeDef } from './types';

const STORAGE_KEY = 'survivors_meta_v1';

export const defaultStartStats: PlayerStartStats = {
    hp: 50, maxHp: 50, damage: 10, speed: 100, attackSpeed: 1, projectileSpeed: 100, pickupRange: 50, regen: 0, orbitCount: 0, orbitDamage: 4, orbitRadius: 50, ringLevel: 0, lightningLevel: 0, xpGain: 1,
};

export const META_UPGRADES: MetaUpgradeDef[] = [
    { id: 'meta_hp', name: 'Vitality', description: '+10 Max HP per level', maxLevel: 50, cost: l => 20 + l * 10, apply: (lvl, s) => { s.maxHp += 10 * lvl; s.hp = s.maxHp; } },
    { id: 'meta_damage', name: 'Might', description: '+5 Damage per level', maxLevel: 50, cost: l => 15 + l * 8, apply: (lvl, s) => { s.damage += 5 * lvl; } },
    { id: 'meta_speed', name: 'Swiftness', description: '+4% Move Speed / level', maxLevel: 50, cost: l => 15 + l * 12, apply: (lvl, s) => { s.speed *= (1 + 0.04 * lvl); } },
    { id: 'meta_regen', name: 'Regen', description: '+0.2 HP/s per level', maxLevel: 50, cost: l => 30 + l * 15, apply: (lvl, s) => { s.regen += 0.2 * lvl; } },
    { id: 'meta_pickup', name: 'Magnet', description: '+8 Pickup Range / level', maxLevel: 20, cost: l => 20 + l * 14, apply: (lvl, s) => { s.pickupRange += 8 * lvl; } },
    { id: 'meta_xp', name: 'Wisdom', description: '+10% XP Gain / level', maxLevel: 40, cost: l => 25 + l * 20, apply: (lvl, s) => { s.xpGain *= (1 + 0.1 * lvl); } },
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
