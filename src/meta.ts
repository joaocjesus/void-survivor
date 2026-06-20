import { MetaSave, PersistPayload, PlayerStartStats, MetaUpgradeDef } from './types';
import { START_STATS, META_VALUES } from './constants/balance';

const STORAGE_KEY = 'survivors_meta_v1';

export const defaultStartStats: PlayerStartStats = {
    hp: START_STATS.MAX_HP,
    maxHp: START_STATS.MAX_HP,
    damage: START_STATS.DAMAGE,
    speed: START_STATS.SPEED,
    attackSpeed: START_STATS.ATTACK_SPEED,
    boltSpeed: START_STATS.BOLT_SPEED,
    pickupRange: START_STATS.PICKUP_RANGE,
    regen: START_STATS.REGEN,
    xpGain: START_STATS.XP_GAIN,
    rerolls: START_STATS.REROLLS,
    bans: START_STATS.BANS,
};

export const META_UPGRADES: MetaUpgradeDef[] = [
    {
        id: 'meta_root_damage',
        name: 'Damage',
        description: '+2 Damage. Unlocks permanent upgrade branches.',
        tree: 'root',
        maxLevel: 1,
        cost: () => 1,
        apply: (lvl, s) => { s.damage += META_VALUES.DAMAGE_PER_LEVEL * lvl; },
    },
    {
        id: 'meta_bolt_damage',
        name: 'Bolt Damage',
        description: `+${META_VALUES.DAMAGE_PER_LEVEL} Damage per level`,
        tree: 'bolt',
        requires: ['meta_root_damage'],
        maxLevel: 20,
        cost: l => 15 + l * 10,
        apply: (lvl, s) => { s.damage += META_VALUES.DAMAGE_PER_LEVEL * lvl; },
    },
    {
        id: 'meta_bolt_speed',
        name: 'Bolt Speed',
        description: `+${(META_VALUES.SPEED_PCT_PER_LEVEL * 100).toFixed(0)}% Bolt Speed per level`,
        tree: 'bolt',
        requires: ['meta_root_damage'],
        maxLevel: 20,
        cost: l => 15 + l * 12,
        apply: (lvl, s) => { s.boltSpeed *= (1 + META_VALUES.SPEED_PCT_PER_LEVEL * lvl); },
    },
    {
        id: 'meta_attack_speed',
        name: 'Attack Speed',
        description: `+${(META_VALUES.SPEED_PCT_PER_LEVEL * 100).toFixed(0)}% Attack Speed per level`,
        tree: 'bolt',
        requires: ['meta_bolt_damage'],
        maxLevel: 20,
        cost: l => 20 + l * 14,
        apply: (lvl, s) => { s.attackSpeed *= (1 + META_VALUES.SPEED_PCT_PER_LEVEL * lvl); },
    },
    {
        id: 'meta_move_speed',
        name: 'Move Speed',
        description: `+${(META_VALUES.SPEED_PCT_PER_LEVEL * 100).toFixed(0)}% Move Speed per level`,
        tree: 'character',
        requires: ['meta_root_damage'],
        maxLevel: 20,
        cost: l => 15 + l * 12,
        apply: (lvl, s) => { s.speed *= (1 + META_VALUES.SPEED_PCT_PER_LEVEL * lvl); },
    },
    {
        id: 'meta_pickup_range',
        name: 'Pickup Range',
        description: `+${META_VALUES.PICKUP_RANGE_PER_LEVEL} Pickup Range per level`,
        tree: 'character',
        requires: ['meta_root_damage'],
        maxLevel: 20,
        cost: l => 15 + l * 12,
        apply: (lvl, s) => { s.pickupRange += META_VALUES.PICKUP_RANGE_PER_LEVEL * lvl; },
    },
    {
        id: 'meta_max_health',
        name: 'Max Health',
        description: `+${META_VALUES.HP_PER_LEVEL} Max HP per level`,
        tree: 'character',
        requires: ['meta_move_speed'],
        maxLevel: 20,
        cost: l => 20 + l * 14,
        apply: (lvl, s) => { s.maxHp += META_VALUES.HP_PER_LEVEL * lvl; s.hp = s.maxHp; },
    },
    {
        id: 'meta_magic_aura_unlock',
        name: 'Magic Aura',
        description: 'Unlocks Magic Aura cards during runs.',
        tree: 'magicAura',
        requires: ['meta_root_damage'],
        unlocksPowerCards: ['auraRadius'],
        maxLevel: 1,
        cost: () => 35,
        apply: () => { },
    },
    {
        id: 'meta_magic_aura_radius',
        name: 'Magic Aura Size',
        description: 'Opens future Magic Aura radius upgrades.',
        tree: 'magicAura',
        requires: ['meta_magic_aura_unlock'],
        maxLevel: 1,
        cost: () => 45,
        apply: () => { },
    },
    {
        id: 'meta_magic_orbs_unlock',
        name: 'Magic Orbs',
        description: 'Unlocks Magic Orbs cards during runs.',
        tree: 'magicOrbs',
        requires: ['meta_root_damage'],
        unlocksPowerCards: ['magicOrbs', 'magicOrbDamage', 'magicOrbSpeed'],
        maxLevel: 1,
        cost: () => 35,
        apply: () => { },
    },
    {
        id: 'meta_magic_orbs_damage',
        name: 'Magic Orbs Damage',
        description: 'Opens future Magic Orbs damage upgrades.',
        tree: 'magicOrbs',
        requires: ['meta_magic_orbs_unlock'],
        maxLevel: 1,
        cost: () => 45,
        apply: () => { },
    },
    {
        id: 'meta_magic_orbs_speed',
        name: 'Magic Orbs Speed',
        description: 'Opens future Magic Orbs speed upgrades.',
        tree: 'magicOrbs',
        requires: ['meta_magic_orbs_unlock'],
        maxLevel: 1,
        cost: () => 45,
        apply: () => { },
    },
];

const META_BY_ID = new Map(META_UPGRADES.map(def => [def.id, def]));

export const META_TREE_LABELS: Record<MetaUpgradeDef['tree'], string> = {
    root: 'Core',
    bolt: 'Bolt Branch',
    character: 'Character Branch',
    magicAura: 'Magic Aura Tree',
    magicOrbs: 'Magic Orbs Tree',
};

export function isMetaUpgradeUnlocked(meta: MetaSave, def: MetaUpgradeDef): boolean {
    return (def.requires ?? []).every(id => (meta.purchased[id] ?? 0) > 0);
}

export function canPurchaseMeta(meta: MetaSave, def: MetaUpgradeDef): boolean {
    const current = meta.purchased[def.id] || 0;
    return isMetaUpgradeUnlocked(meta, def) && current < def.maxLevel && meta.shards >= def.cost(current);
}

export function shouldShowMetaUpgrade(meta: MetaSave, def: MetaUpgradeDef): boolean {
    if (!def.requires?.length) return true;
    if ((meta.purchased[def.id] ?? 0) > 0) return true;
    return def.requires.some(requiredId => (meta.purchased[requiredId] ?? 0) > 0);
}

export function visibleMetaUpgrades(meta: MetaSave): MetaUpgradeDef[] {
    return META_UPGRADES.filter(def => shouldShowMetaUpgrade(meta, def));
}

export function isRunUpgradeUnlockedByMeta(meta: MetaSave, upgradeId: string): boolean {
    const powerUnlock = META_UPGRADES.find(def => def.unlocksPowerCards?.includes(upgradeId));
    return !powerUnlock || (meta.purchased[powerUnlock.id] ?? 0) > 0;
}

export function loadMeta(): MetaSave {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed: PersistPayload = JSON.parse(raw);
            return parsed.meta;
        }
    } catch { }
    return createDefaultMeta();
}

export function saveMeta(meta: MetaSave) {
    const payload: PersistPayload = { meta };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { }
}

function createDefaultMeta(): MetaSave {
    return {
        shards: 0,
        purchased: {},
        stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 },
    };
}

export function buildStartStats(meta: MetaSave): PlayerStartStats {
    const stats: PlayerStartStats = { ...defaultStartStats };
    for (const def of META_UPGRADES) { const lvl = meta.purchased[def.id] || 0; if (lvl > 0) def.apply(lvl, stats); }
    return stats;
}

export function purchaseMeta(meta: MetaSave, id: string): boolean {
    const def = META_BY_ID.get(id); if (!def) return false;
    if (!isMetaUpgradeUnlocked(meta, def)) return false;
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
