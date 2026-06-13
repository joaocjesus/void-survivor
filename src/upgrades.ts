import { UpgradeDef, OfferedUpgrade, GameState, Entity, PlayerStartStats } from './types';
import { POWERS_VALUES } from './constants/balance';
import { CARDS, cardInfo, effRarityWeight, RARITIES, rarityValue, type CardId, type Rarity } from './constants/cards';

// Mutator receives the player, this pick's rarity magnitude `v` (from the card's
// values in constants/cards.ts), and the run's base stats. The builder pulls the
// card's identity (name/description/isPower) from CARDS, so each entry below only
// declares its id, its effect, and an optional `requires` gate.
type Mut = (p: Entity, v: number, base: PlayerStartStats) => void;
const card = (id: CardId, mut: Mut, requires?: UpgradeDef['requires']): UpgradeDef => {
    const info = cardInfo(id);
    return {
        id, name: info.name, description: info.description, isPower: info.isPower, requires,
        apply: (gs, r) => mut(gs.entities.get(gs.playerId)!, rarityValue(id, r), gs.startStats),
    };
};

const ownsOrbs = (gs: GameState) => (gs.entities.get(gs.playerId)?.magicOrbCount ?? 0) > 0;

// In-run upgrade behavior. Identity + drop config + per-rarity values live in
// constants/cards.ts; this just maps each card id to what a pick does.
export const UPGRADES: UpgradeDef[] = [
    card('damage', (p, v) => { p.damage = (p.damage || 0) + v; }),
    card('attackSpeed', (p, v, b) => { p.attackSpeed = (p.attackSpeed || 1) + b.attackSpeed * v / 100; }),
    card('moveSpeed', (p, v, b) => { p.speed = (p.speed || b.speed) + b.speed * v / 100; }),
    card('boltSpeed', (p, v, b) => { p.boltSpeed = (p.boltSpeed || b.boltSpeed) + b.boltSpeed * v / 100; }),
    card('boltLifespan', (p, v) => { p.boltLifespanMult = (p.boltLifespanMult ?? 1) + v / 100; }),
    card('hp', (p, v) => { p.maxHp = (p.maxHp || 100) + v; p.hp = (p.hp || 0) + v; }),
    card('pickupRange', (p, v, b) => { p.pickupRange = (p.pickupRange || b.pickupRange) + b.pickupRange * v / 100; }),
    card('regen', (p, v) => { p.regen = (p.regen || 0) + v; }),
    card('multiShot', (p, v) => { p.multishot = (p.multishot || 0) + v; }),
    card('auraRadius', (p, v) => { p.auraLevel = (p.auraLevel || 0) + 1; p.auraRadiusPct = (p.auraRadiusPct ?? 100) + v; }),
    card('magicOrbs', (p, v) => { p.magicOrbCount = (p.magicOrbCount ?? 0) + v; }),
    card('magicOrbDamage', (p, v) => { p.magicOrbDamage = (p.magicOrbDamage ?? POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE) + v; }, ownsOrbs),
    card('magicOrbSpeed', (p, v) => { p.orbSpeedMult = (p.orbSpeedMult ?? 1) + v / 100; }, ownsOrbs),
];

// Compile-time guard: every card defined in CARDS has a behavior entry above.
const _definedIds = new Set(UPGRADES.map(u => u.id));
for (const id of Object.keys(CARDS) as CardId[]) {
    if (!_definedIds.has(id)) throw new Error(`CARDS.${id} has no behavior in UPGRADES`);
}

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
            const w = effRarityWeight(def.id as CardId, r);
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
