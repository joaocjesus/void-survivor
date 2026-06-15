// ============================================================================
// CARDS — single source of truth for every upgrade card: identity (name,
// description), how often it drops (rarity tiers + weights), and how strong it
// is per tier. Behavior (what a pick actually does) lives in upgrades.ts.
// ============================================================================

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Tier ranking, used to compare against a card's `minRarity`.
export const RARITY_ORDER: Record<Rarity, number> = {
    common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4,
};

// ----------------------------------------------------------------------------
// DROP RATES
// ----------------------------------------------------------------------------
// Global default relative weights per tier (higher = more frequent).
export const RARITY_WEIGHTS: Record<Rarity, number> = {
    common: 65,
    uncommon: 25,
    rare: 7.5,
    epic: 2.3,
    legendary: 0.2,
};

// ----------------------------------------------------------------------------
// CARD CONFIG (identity + minRarity + per-rarity values)
// ----------------------------------------------------------------------------
// `minRarity` defaults to common. `isPower` flags active abilities (extra card
// styling). `values` is the per-pick magnitude by tier; semantics per card:
//   additive stats (damage/hp/regen/magicOrbDamage) -> flat amount added
//   percent stats (attackSpeed/moveSpeed/boltSpeed/boltLifespan/
//     auraRadius/magicOrbSpeed) -> percentage points of base (linear, +10 -> 100->110->120)
//   pickupRange -> rarity-scaled curve in balanceUtils (larger early gains, tapered later)
//   magicOrbs -> orbs added; multiShot -> extra bolts added
export interface CardInfo {
    name: string;
    description: string;
    minRarity?: Rarity;                       // lowest droppable tier (default 'common')
    isPower?: boolean;                        // active ability (extra "power" styling)
    values: Partial<Record<Rarity, number>>;  // per-pick magnitude by tier
}

export const CARDS = {
    damage: {
        name: 'Damage', description: 'Increase bolt damage', // +flat
        values: { common: 5, uncommon: 10, rare: 15, epic: 20, legendary: 25 },
    },
    hp: {
        name: 'Max Health', description: 'Increase max HP', // +flat (also heals)
        values: { common: 20, uncommon: 30, rare: 40, epic: 50, legendary: 60 },
    },
    regen: {
        name: 'Regeneration', description: 'Regenerate HP over time', // +flat HP/s
        values: { common: 0.1, uncommon: 0.2, rare: 0.3, epic: 0.4, legendary: 0.5 },
    },
    attackSpeed: {
        name: 'Attack Speed', description: 'Fire faster', // +% of base (percentage points)
        values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 },
    },
    moveSpeed: {
        name: 'Move Speed', description: 'Move faster', // +% of base
        values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 },
    },
    boltSpeed: {
        name: 'Bolt Speed', description: 'Bolts travel faster', // +% of base
        values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 },
    },
    boltLifespan: {
        name: 'Bolt Lifespan', description: 'Bolts last longer (reach farther)', // +% of base
        values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 },
    },
    pickupRange: {
        name: 'Magnet', description: 'Increase pickup range', // curve from rarity value
        values: { common: 20, uncommon: 40, rare: 60, epic: 90, legendary: 120 },
    },
    auraRadius: {
        name: 'Magic Aura', description: 'Unlock / grow a damaging aura', isPower: true, minRarity: 'uncommon', // +% radius
        values: { uncommon: 20, rare: 40, epic: 50, legendary: 60 },
    },
    magicOrbs: {
        name: 'Magic Orbs', description: 'Unlock / add orbiting orbs', isPower: true, minRarity: 'uncommon', // +orbs
        values: { uncommon: 1, rare: 2, epic: 3, legendary: 4 },
    },
    magicOrbDamage: {
        name: 'Magic Orb Damage', description: 'Increase orb damage', isPower: true, // +flat per orb
        values: { common: 4, uncommon: 8, rare: 12, epic: 18, legendary: 25 },
    },
    magicOrbSpeed: {
        name: 'Orb Speed', description: 'Orbs rotate faster', isPower: true, // +% rotation speed
        values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 60 },
    },
    multiShot: {
        name: 'Multishot', description: 'Fire additional bolts', minRarity: 'rare', // +extra bolts
        values: { rare: 1, epic: 2, legendary: 3 },
    },
} satisfies Record<string, CardInfo>;

export type CardId = keyof typeof CARDS;

// Per-card drop-weight overrides for specific (card, rarity) cells. Partial: any
// tier you omit inherits RARITY_WEIGHTS. Set 0 to disable a tier for that card.
// Example: make legendary/epic Magic Orbs much rarer than the global default.
//   magicOrbs: { epic: 1, legendary: 0.1 },
export const CARD_RARITY_WEIGHTS: Partial<Record<CardId, Partial<Record<Rarity, number>>>> = {
    // magicOrbs: { common: 60, uncommon: 25, rare: 13.9, epic: 1, legendary: 0.1 },
};

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
// Widened accessor (the `satisfies` above narrows away optional props per entry).
export function cardInfo(id: CardId): CardInfo {
    return CARDS[id];
}

// Lowest tier a card can drop at (default 'common').
export function cardMinRarity(id: CardId): Rarity {
    return cardInfo(id).minRarity ?? 'common';
}

// Effective drop weight for a (card, rarity), honoring minRarity + overrides.
export function effRarityWeight(id: CardId, r: Rarity): number {
    if (RARITY_ORDER[r] < RARITY_ORDER[cardMinRarity(id)]) return 0;
    return CARD_RARITY_WEIGHTS[id]?.[r] ?? RARITY_WEIGHTS[r];
}

// Magnitude for a (card, rarity); 0 if undefined.
export function rarityValue(id: CardId, r: Rarity): number {
    return cardInfo(id).values[r] ?? 0;
}
