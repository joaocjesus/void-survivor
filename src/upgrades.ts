import { UpgradeDef, OfferedUpgrade, GameState } from './types';
import { POWERS_VALUES } from './constants/balance';
import { effRarityWeight, RARITIES, rarityValue, type Rarity } from './constants/rarity';

// In-run upgrade definitions. Pure data + apply lambdas only; no DOM or PIXI.
// Per-pick magnitudes come from UPGRADE_RARITY_VALUES (see constants/rarity.ts);
// each apply reads its value via rarityValue(id, rarity).
export const UPGRADES: UpgradeDef[] = [
    {
        id: 'damage', name: 'Damage', description: 'Increase projectile damage',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.damage = (p.damage || 0) + rarityValue('damage', r); },
    },
    {
        id: 'attackSpeed', name: 'Attack Speed', description: 'Fire faster',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.attackSpeed = (p.attackSpeed || 1) + gs.startStats.attackSpeed * rarityValue('attackSpeed', r) / 100; },
    },
    {
        id: 'moveSpeed', name: 'Move Speed', description: 'Move faster',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.speed = (p.speed || gs.startStats.speed) + gs.startStats.speed * rarityValue('moveSpeed', r) / 100; },
    },
    {
        id: 'projSpeed', name: 'Projectile Speed', description: 'Projectiles travel faster',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.projectileSpeed = (p.projectileSpeed || gs.startStats.projectileSpeed) + gs.startStats.projectileSpeed * rarityValue('projSpeed', r) / 100; },
    },
    {
        id: 'projLifeSpan', name: 'Projectile Lifespan', description: 'Projectiles last longer (reach farther)',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.projLifeSpanMult = (p.projLifeSpanMult ?? 1) + rarityValue('projLifeSpan', r) / 100; },
    },
    {
        id: 'hp', name: 'Max Health', description: 'Increase max HP',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; const add = rarityValue('hp', r); p.maxHp = (p.maxHp || 100) + add; p.hp = (p.hp || 0) + add; },
    },
    {
        id: 'pickupRange', name: 'Magnet', description: 'Increase pickup range',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.pickupRange = (p.pickupRange || gs.startStats.pickupRange) + gs.startStats.pickupRange * rarityValue('pickupRange', r) / 100; },
    },
    {
        id: 'regen', name: 'Regeneration', description: 'Regenerate HP over time',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.regen = (p.regen || 0) + rarityValue('regen', r); },
    },
    {
        id: 'multiShot', name: 'Multishot', description: 'Fire additional projectiles', minRarity: 'rare',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.multishot = (p.multishot || 0) + rarityValue('multiShot', r); },
    },
    {
        id: 'auraRadius', name: 'Magic Aura', description: 'Unlock / grow a damaging aura', isPower: true, minRarity: 'uncommon',
        apply: (gs, r) => {
            const p = gs.entities.get(gs.playerId)!;
            p.auraLevel = (p.auraLevel || 0) + 1;
            p.auraRadiusPct = (p.auraRadiusPct ?? 100) + rarityValue('auraRadius', r);
        },
    },
    {
        id: 'magicOrbs', name: 'Magic Orbs', description: 'Unlock / add orbiting orbs', isPower: true, minRarity: 'uncommon',
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.magicOrbCount = (p.magicOrbCount ?? 0) + rarityValue('magicOrbs', r); },
    },
    {
        id: 'magicOrbDamage', name: 'Magic Orb Damage', description: 'Increase orb damage', isPower: true,
        requires: gs => (gs.entities.get(gs.playerId)?.magicOrbCount ?? 0) > 0,
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.magicOrbDamage = (p.magicOrbDamage ?? POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE) + rarityValue('magicOrbDamage', r); },
    },
    {
        id: 'magicOrbSpeed', name: 'Orb Speed', description: 'Orbs rotate faster', isPower: true,
        requires: gs => (gs.entities.get(gs.playerId)?.magicOrbCount ?? 0) > 0,
        apply: (gs, r) => { const p = gs.entities.get(gs.playerId)!; p.orbSpeedMult = (p.orbSpeedMult ?? 1) + rarityValue('magicOrbSpeed', r) / 100; },
    },
];

export function applyUpgradeChoice(gs: GameState, upgrade: UpgradeDef, rarity: Rarity) {
    upgrade.apply(gs, rarity);
    gs.upgradeCounts[upgrade.id] = (gs.upgradeCounts[upgrade.id] || 0) + 1;
}

// Offer N distinct upgrades, each tagged with an independently-rolled rarity.
// Builds a flat weighted list of (card, rarity) combos honoring requires/minRarity
// /per-card overrides, then samples distinct cards without replacement.
export function pickUpgradeOffers(gs: GameState, count: number): OfferedUpgrade[] {
    const pool = gs.upgradePool.filter(u => !u.requires || u.requires(gs));
    type Combo = { def: UpgradeDef; rarity: Rarity; w: number };
    const combos: Combo[] = [];
    for (const def of pool) {
        const minR = def.minRarity ?? 'common';
        for (const r of RARITIES) {
            const w = effRarityWeight(def.id, minR, r);
            if (w > 0) combos.push({ def, rarity: r, w });
        }
    }
    const res: OfferedUpgrade[] = [];
    const chosen = new Set<string>();
    while (res.length < count) {
        const avail = combos.filter(c => !chosen.has(c.def.id));
        const total = avail.reduce((s, c) => s + c.w, 0);
        if (total <= 0) break;
        let roll = gs.rng() * total;
        let pick = avail[avail.length - 1];
        for (const c of avail) { roll -= c.w; if (roll < 0) { pick = c; break; } }
        res.push({ def: pick.def, rarity: pick.rarity });
        chosen.add(pick.def.id);
    }
    return res;
}
