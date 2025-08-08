// Pure helper functions for balance calculations to aid testing.
import { XP_CURVE_MULT, XP_CURVE_FLAT, SPAWN_INTERVAL_START, SPAWN_INTERVAL_DECAY, SPAWN_INTERVAL_MIN, POWERS_VALUES, POWERS_UPGRADE_VALUES } from './constants/balance';
import { clamp } from './math';

export function nextXpNeeded(current: number): number {
  return Math.round(current * XP_CURVE_MULT + XP_CURVE_FLAT);
}

export function spawnIntervalAt(time: number): number {
  return clamp(SPAWN_INTERVAL_START - time * SPAWN_INTERVAL_DECAY, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_START);
}

export function auraRadiusAt(level: number): number {
  if (level <= 0) return 0;
  // Level 1 = base radius; each additional level adds +AURA_RADIUS_INCREMENT% of base
  const inc = POWERS_UPGRADE_VALUES.AURA_RADIUS_INCREMENT / 100;
  return POWERS_VALUES.AURA_BASE_RADIUS * (1 + inc * (level - 1));
}

export function auraDpsAt(level: number): number {
  if (level <= 0) return 0;
  return POWERS_VALUES.AURA_DPS_PER_LEVEL * level;
}

export function magicOrbBaseDamage(): number { return POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE; }
export function magicOrbRadius(): number { return POWERS_VALUES.MAGIC_ORB_RADIUS; }
