import { UpgradeDef, OfferedUpgrade, GameState, Entity, PlayerStartStats } from './types';
import { POWERS_VALUES } from './constants/balance';
import { effRarityWeight, RARITIES, rarityValue, type Rarity } from './constants/rarity';

// Mutator receives the player, this pick's rarity magnitude `v` (from UPGRADE_RARITY_VALUES),
// and the run's base stats. Builder wires up the player lookup + value lookup so each card
// only declares its actual effect.
type Mut = (p: Entity, v: number, base: PlayerStartStats) => void;
const card = (id: string, name: string, description: string, mut: Mut, extra: Partial<UpgradeDef> = {}): UpgradeDef => ({
    id, name, description, ...extra,
    apply: (gs, r) => mut(gs.entities.get(gs.playerId)!, rarityValue(id, r), gs.startStats),
});

const ownsOrbs = (gs: GameState) => (gs.entities.get(gs.playerId)?.magicOrbCount ?? 0) > 0;

// In-run upgrade definitions. Per-pick magnitudes come from UPGRADE_RARITY_VALUES
// (constants/rarity.ts). Percent stats add `v`% of the base value (linear stacking).
export const UPGRADES: UpgradeDef[] = [
    card('damage', 'Damage', 'Increase projectile damage',
        (p, v) => { p.damage = (p.damage || 0) + v; }),
    card('attackSpeed', 'Attack Speed', 'Fire faster',
        (p, v, b) => { p.attackSpeed = (p.attackSpeed || 1) + b.attackSpeed * v / 100; }),
    card('moveSpeed', 'Move Speed', 'Move faster',
        (p, v, b) => { p.speed = (p.speed || b.speed) + b.speed * v / 100; }),
    card('projSpeed', 'Projectile Speed', 'Projectiles travel faster',
        (p, v, b) => { p.projectileSpeed = (p.projectileSpeed || b.projectileSpeed) + b.projectileSpeed * v / 100; }),
    card('projLifeSpan', 'Projectile Lifespan', 'Projectiles last longer (reach farther)',
        (p, v) => { p.projLifeSpanMult = (p.projLifeSpanMult ?? 1) + v / 100; }),
    card('hp', 'Max Health', 'Increase max HP',
        (p, v) => { p.maxHp = (p.maxHp || 100) + v; p.hp = (p.hp || 0) + v; }),
    card('pickupRange', 'Magnet', 'Increase pickup range',
        (p, v, b) => { p.pickupRange = (p.pickupRange || b.pickupRange) + b.pickupRange * v / 100; }),
    card('regen', 'Regeneration', 'Regenerate HP over time',
        (p, v) => { p.regen = (p.regen || 0) + v; }),
    card('multiShot', 'Multishot', 'Fire additional projectiles',
        (p, v) => { p.multishot = (p.multishot || 0) + v; }),
    card('auraRadius', 'Magic Aura', 'Unlock / grow a damaging aura',
        (p, v) => { p.auraLevel = (p.auraLevel || 0) + 1; p.auraRadiusPct = (p.auraRadiusPct ?? 100) + v; },
        { isPower: true }),
    card('magicOrbs', 'Magic Orbs', 'Unlock / add orbiting orbs',
        (p, v) => { p.magicOrbCount = (p.magicOrbCount ?? 0) + v; },
        { isPower: true }),
    card('magicOrbDamage', 'Magic Orb Damage', 'Increase orb damage',
        (p, v) => { p.magicOrbDamage = (p.magicOrbDamage ?? POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE) + v; },
        { isPower: true, requires: ownsOrbs }),
    card('magicOrbSpeed', 'Orb Speed', 'Orbs rotate faster',
        (p, v) => { p.orbSpeedMult = (p.orbSpeedMult ?? 1) + v / 100; },
        { isPower: true, requires: ownsOrbs }),
];

export function applyUpgradeChoice(gs: GameState, upgrade: UpgradeDef, rarity: Rarity) {
    upgrade.apply(gs, rarity);
    gs.upgradeCounts[upgrade.id] = (gs.upgradeCounts[upgrade.id] || 0) + 1;
}

// Offer N distinct upgrades, each tagged with an independently-rolled rarity.
// Builds a flat weighted list of (card, rarity) combos honoring requires, minRarity
// (from the rarity config), and per-card overrides, then samples distinct cards.
export function pickUpgradeOffers(gs: GameState, count: number): OfferedUpgrade[] {
    const pool = gs.upgradePool.filter(u => !u.requires || u.requires(gs));
    type Combo = { def: UpgradeDef; rarity: Rarity; w: number };
    const combos: Combo[] = [];
    for (const def of pool) {
        for (const r of RARITIES) {
            const w = effRarityWeight(def.id, r);
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
