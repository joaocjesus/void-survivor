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
// PER-RARITY VALUES
// ----------------------------------------------------------------------------
// Magnitude applied per pick, by card + tier. Semantics depend on the card:
//   additive stats (dmg/hp/regen/magicOrbDmg) -> flat amount added
//   percent stats (attspd/speed/projspd/pickup/orbSpeed/aura) -> percentage points
//     of the base value added per pick (linear, e.g. +10 -> 100%->110%->120%)
//   magicOrb -> orbs added
//   multishot -> extra projectiles added
export const UPGRADE_RARITY_VALUES: Record<string, Partial<Record<Rarity, number>>> = {
    // +flat projectile damage
    damage: { common: 5, uncommon: 10, rare: 15, epic: 20, legendary: 25 },
    // +flat max HP (also heals that much)
    hp: { common: 20, uncommon: 30, rare: 40, epic: 50, legendary: 60 },
    // +flat HP per second
    regen: { common: 0.1, uncommon: 0.2, rare: 0.3, epic: 0.4, legendary: 0.5 },
    // +% of base fire rate (percentage points)
    attackSpeed: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 },
    // +% of base move speed (percentage points)
    moveSpeed: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 },
    // +% of base projectile speed (percentage points)
    projSpeed: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 },
    // +% of base projectile lifespan (percentage points; longer life = farther reach)
    projLifeSpan: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 50 },
    // +% of base pickup range (percentage points)
    pickupRange: { common: 20, uncommon: 40, rare: 60, epic: 90, legendary: 120 },
    // +% aura radius (percentage points; 100% = base radius)
    auraRadius: { common: 20, uncommon: 30, rare: 40, epic: 50, legendary: 60 },
    // +orbs added (min: uncommon; common unused)
    magicOrbs: { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 },
    // +flat damage per orb
    magicOrbDamage: { common: 4, uncommon: 8, rare: 12, epic: 18, legendary: 25 },
    // +% orb rotation speed (percentage points)
    magicOrbSpeed: { common: 10, uncommon: 20, rare: 30, epic: 40, legendary: 60 },
    // +extra projectiles (minRarity rare; common/uncommon unused)
    multiShot: { common: 0, uncommon: 0, rare: 1, epic: 2, legendary: 3 },
};

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
// Effective drop weight for a (card, rarity), honoring minRarity + overrides.
export function effRarityWeight(id: string, minRarity: Rarity, r: Rarity): number {
    if (RARITY_ORDER[r] < RARITY_ORDER[minRarity]) return 0;
    return CARD_RARITY_WEIGHTS[id]?.[r] ?? RARITY_WEIGHTS[r];
}

// Magnitude for a (card, rarity); 0 if undefined.
export function rarityValue(id: string, r: Rarity): number {
    return UPGRADE_RARITY_VALUES[id]?.[r] ?? 0;
}
