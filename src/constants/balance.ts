// Centralized balance & tuning constants.
// Adjust these values to rebalance the game without hunting through logic files.

// Player starting stats
export const START_STATS = {
    HP: 50,
    MAX_HP: 50,
    DAMAGE: 10,
    SPEED: 80,
    ATTACK_SPEED: 1,
    PROJECTILE_SPEED: 100,
    PICKUP_RANGE: 50,
    REGEN: 0,
    XP_GAIN: 1,
};

// Meta upgrade per-level increments / multipliers
export const META_VALUES = {
    HP_PER_LEVEL: 10,
    DAMAGE_PER_LEVEL: 5,
    SPEED_PCT_PER_LEVEL: 0.05,
    REGEN_PER_LEVEL: 0.25,      // HP per second
    PICKUP_RANGE_PER_LEVEL: 10,
    XP_GAIN_PCT_PER_LEVEL: 0.10,
};

// In-run upgrade values
export const UPGRADE_VALUES = {
    DAMAGE_PLUS: 5,
    ATTACK_SPEED_MULT: 1.20,
    MOVE_SPEED_MULT: 1.10,
    PROJECTILE_SPEED_MULT: 1.20,
    MAX_HP_PLUS: 25,
    MAX_HP_HEAL: 25,
    PICKUP_RANGE_MULT: 1.25,
    REGEN_PLUS: 0.5, // HP/s
};

// XP / level curve
export const XP_CURVE_MULT = 1.20;
export const XP_CURVE_FLAT = 5;

// Spawning & combat pacing
export const SPAWN_INTERVAL_START = 1.4; // seconds at t=0
export const SPAWN_INTERVAL_MIN = 0.25;  // lower bound
export const SPAWN_INTERVAL_DECAY = 0.006; // per second reduction before clamp
export const FIRE_INTERVAL_BASE = 1.65;   // base projectile fire interval (reduced by attack speed multiplier)

// Base power values (static baselines used at level 1)
export const POWERS_VALUES = {
    AURA_BASE_RADIUS: 60,
    AURA_DPS_PER_LEVEL: 2,
    MAGIC_ORB_BASE_DAMAGE: 5,
    MAGIC_ORB_RADIUS: 50,
};

// Power upgrade increment values (applied when selecting related upgrades)
export const POWERS_UPGRADE_VALUES = {
    AURA_RADIUS_INCREMENT: 20,
    MAGIC_ORB_DAMAGE_INCREMENT: 5,
};
