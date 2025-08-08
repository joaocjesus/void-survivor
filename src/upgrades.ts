import { UpgradeDef, GameState } from './types';
import { UPGRADE_VALUES, POWERS_VALUES, POWERS_UPGRADE_VALUES } from './constants/balance';

// In-run upgrade definitions extracted from game.ts to keep Game class lean.
// Keep pure data + apply lambdas only; no DOM or PIXI references.
export const UPGRADES: UpgradeDef[] = [
    { id: 'dmg', name: 'Sharpened Projectiles', description: `+${UPGRADE_VALUES.DAMAGE_PLUS} damage`, apply: gs => { const p = gs.entities.get(gs.playerId)!; p.damage = (p.damage || 1) + UPGRADE_VALUES.DAMAGE_PLUS; } },
    { id: 'aspd', name: 'Attack Speed', description: `Fire ${(UPGRADE_VALUES.ATTACK_SPEED_MULT - 1) * 100}% faster`, apply: gs => { const p = gs.entities.get(gs.playerId)!; p.attackSpeed = (p.attackSpeed || 1) * UPGRADE_VALUES.ATTACK_SPEED_MULT; } },
    { id: 'speed', name: 'Boots', description: `+${(UPGRADE_VALUES.MOVE_SPEED_MULT - 1) * 100}% move speed`, apply: gs => { const p = gs.entities.get(gs.playerId)!; p.speed = (p.speed || 120) * UPGRADE_VALUES.MOVE_SPEED_MULT; } },
    { id: 'projspd', name: 'Projectile Speed', description: `+${(UPGRADE_VALUES.PROJECTILE_SPEED_MULT - 1) * 100}% projectile speed`, apply: gs => { const p = gs.entities.get(gs.playerId)!; p.projectileSpeed = (p.projectileSpeed || 280) * UPGRADE_VALUES.PROJECTILE_SPEED_MULT; } },
    { id: 'hp', name: 'Max Health', description: `+${UPGRADE_VALUES.MAX_HP_PLUS} max HP & heal ${UPGRADE_VALUES.MAX_HP_HEAL}`, apply: gs => { const p = gs.entities.get(gs.playerId)!; p.maxHp = (p.maxHp || 100) + UPGRADE_VALUES.MAX_HP_PLUS; p.hp = Math.min((p.hp || 0) + UPGRADE_VALUES.MAX_HP_HEAL, p.maxHp); } },
    { id: 'pickup', name: 'Magnet', description: `+${(UPGRADE_VALUES.PICKUP_RANGE_MULT - 1) * 100}% pickup range`, apply: gs => { const p = gs.entities.get(gs.playerId)!; p.pickupRange = (p.pickupRange || 60) * UPGRADE_VALUES.PICKUP_RANGE_MULT; } },
    { id: 'regen', name: 'Regeneration', description: `+${UPGRADE_VALUES.REGEN_PLUS} HP/s regen`, apply: gs => { const p = gs.entities.get(gs.playerId)!; p.regen = (p.regen || 0) + UPGRADE_VALUES.REGEN_PLUS; } },
    { id: 'aura', name: 'Magic Aura', description: `Unlock / +${POWERS_UPGRADE_VALUES.AURA_RADIUS_INCREMENT}% aura size`, apply: gs => { const p = gs.entities.get(gs.playerId)!; (p as any).auraLevel = ((p as any).auraLevel || 0) + 1; } },
    {
        id: 'magicOrb', name: 'Magic Orbs', description: 'Unlock / +1 Magic Orb', apply: gs => {
            const p = gs.entities.get(gs.playerId)!;
            (p as any).magicOrbCount = ((p as any).magicOrbCount ?? 0) + 1;
        }
    },
    {
        id: 'magicOrbDmg', name: 'Magic Orb Damage', description: `Magic Orb damage +${POWERS_UPGRADE_VALUES.MAGIC_ORB_DAMAGE_INCREMENT}`, apply: gs => {
            const p = gs.entities.get(gs.playerId)!;
            const base = (p as any).magicOrbDamage ?? POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE;
            (p as any).magicOrbDamage = base + POWERS_UPGRADE_VALUES.MAGIC_ORB_DAMAGE_INCREMENT;
        }
    },
];

// Utility to expand upgrade pool when certain unlock thresholds are reached.
export function maybeAddDependentUpgrades(gs: GameState, appliedId: string) {
    if (appliedId === 'magicOrb') {
        const hadDamage = gs.upgradePool.some(u => u.id === 'magicOrbDmg');
        if (!hadDamage) {
            const od = UPGRADES.find(x => x.id === 'magicOrbDmg');
            if (od) gs.upgradePool.push(od);
        }
    }
}

// Pick N random distinct upgrades from current pool (non-mutating except RNG advance)
export function pickRandomUpgrades(gs: GameState, count: number): UpgradeDef[] {
    const pool = [...gs.upgradePool];
    const res: UpgradeDef[] = [];
    while (pool.length && res.length < count) {
        const idx = Math.floor(gs.rng() * pool.length);
        res.push(pool.splice(idx, 1)[0]);
    }
    return res;
}
