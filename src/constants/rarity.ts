// ============================================================================
// RARITY SYSTEM — single source of truth for drop rates and per-rarity power.
// Edit the tables below to rebalance; nothing else needs to change.
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
    common: 70,
    uncommon: 20,
    rare: 7.5,
    epic: 2.3,
    legendary: 0.2,
};

// Per-card overrides for specific (card, rarity) cells. Partial: any tier you
// omit inherits RARITY_WEIGHTS. Set 0 to disable a tier for that card.
// Example: make legendary/epic Magic Orbs much rarer than the global default.
//   magicOrb: { epic: 1, legendary: 0.1 },
export const CARD_RARITY_WEIGHTS: Record<string, Partial<Record<Rarity, number>>> = {
    // magicOrbs: { common: 60, uncommon: 25, rare: 13.9, epic: 1, legendary: 0.1 },
};

// ----------------------------------------------------------------------------
// PER-CARD CONFIG (minRarity + per-rarity values)
// ----------------------------------------------------------------------------
// One entry per card — its lowest droppable tier and its per-pick magnitudes,
// together so a card is tuned in a single place. `minRarity` defaults to common.
// `values` semantics depend on the card:
//   additive stats (damage/hp/regen/magicOrbDamage) -> flat amount added
//   percent stats (attackSpeed/moveSpeed/projSpeed/projLifeSpan/pickupRange/
//     auraRadius/magicOrbSpeed) -> percentage points of base (linear, +10 -> 100->110->120)
//   magicOrbs -> orbs added; multiShot -> extra projectiles added
export interface RarityCard {
    minRarity?: Rarity;                       // lowest droppable tier (default 'common')
    values: Partial<Record<Rarity, number>>;  // per-pick magnitude by tier
}

export const UPGRADE_RARITY_VALUES: Record<string, RarityCard> = {
    // +flat projectile damage
    damage: { values: { common: 5, uncommon: 10, rare: 15, epic: 20, legendary: 25 } },
    // +flat max HP (also heals that much)
    hp: { values: { common: 20, uncommon: 30, rare: 40, epic: 50, legendary: 60 } },
    // +flat HP per second
    regen: { values: { common: 0.1, uncommon: 0.2, rare: 0.3, epic: 0.4, legendary: 0.5 } },
    // +% of base fire rate (percentage points)
    attackSpeed: { values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 } },
    // +% of base move speed (percentage points)
    moveSpeed: { values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 } },
    // +% of base projectile speed (percentage points)
    projSpeed: { values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 } },
    // +% of base projectile lifespan (percentage points; longer life = farther reach)
    projLifeSpan: { values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 } },
    // +% of base pickup range (percentage points)
    pickupRange: { values: { common: 20, uncommon: 40, rare: 60, epic: 90, legendary: 120 } },
    // +% aura radius (percentage points; 100% = base radius)
    auraRadius: { minRarity: 'uncommon', values: { uncommon: 20, rare: 40, epic: 50, legendary: 60 } },
    // +orbs added
    magicOrbs: { minRarity: 'uncommon', values: { uncommon: 1, rare: 2, epic: 3, legendary: 4 } },
    // +flat damage per orb
    magicOrbDamage: { values: { common: 4, uncommon: 8, rare: 12, epic: 18, legendary: 25 } },
    // +% orb rotation speed (percentage points)
    magicOrbSpeed: { values: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 60 } },
    // +extra projectiles
    multiShot: { minRarity: 'rare', values: { rare: 1, epic: 2, legendary: 3 } },
};

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
// Lowest tier a card can drop at (default 'common').
export function cardMinRarity(id: string): Rarity {
    return UPGRADE_RARITY_VALUES[id]?.minRarity ?? 'common';
}

// Effective drop weight for a (card, rarity), honoring minRarity + overrides.
export function effRarityWeight(id: string, r: Rarity): number {
    if (RARITY_ORDER[r] < RARITY_ORDER[cardMinRarity(id)]) return 0;
    return CARD_RARITY_WEIGHTS[id]?.[r] ?? RARITY_WEIGHTS[r];
}

// Magnitude for a (card, rarity); 0 if undefined.
export function rarityValue(id: string, r: Rarity): number {
    return UPGRADE_RARITY_VALUES[id]?.values?.[r] ?? 0;
}
