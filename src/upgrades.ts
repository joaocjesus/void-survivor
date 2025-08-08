import { UpgradeDef, GameState } from './types';

// In-run upgrade definitions extracted from game.ts to keep Game class lean.
// Keep pure data + apply lambdas only; no DOM or PIXI references.
export const UPGRADES: UpgradeDef[] = [
    { id: 'dmg', name: 'Sharpened Projectiles', description: '+5 damage', apply: gs => { const p = gs.entities.get(gs.playerId)!; p.damage = (p.damage || 1) + 5; } },
    { id: 'aspd', name: 'Attack Speed', description: 'Fire 25% faster', apply: gs => { const p = gs.entities.get(gs.playerId)!; p.attackSpeed = (p.attackSpeed || 1) * 1.25; } },
    { id: 'speed', name: 'Boots', description: '+10% move speed', apply: gs => { const p = gs.entities.get(gs.playerId)!; p.speed = (p.speed || 120) * 1.1; } },
    { id: 'projspd', name: 'Projectile Speed', description: '+20% projectile speed', apply: gs => { const p = gs.entities.get(gs.playerId)!; p.projectileSpeed = (p.projectileSpeed || 280) * 1.2; } },
    { id: 'hp', name: 'Max Health', description: '+25 max HP & heal 25', apply: gs => { const p = gs.entities.get(gs.playerId)!; p.maxHp = (p.maxHp || 100) + 25; p.hp = Math.min((p.hp || 0) + 25, p.maxHp); } },
    { id: 'pickup', name: 'Magnet', description: '+50% pickup range', apply: gs => { const p = gs.entities.get(gs.playerId)!; p.pickupRange = (p.pickupRange || 60) * 1.5; } },
    { id: 'regen', name: 'Regeneration', description: '+0.5 HP/s regen', apply: gs => { const p = gs.entities.get(gs.playerId)!; p.regen = (p.regen || 0) + 0.5; } },
    { id: 'aura', name: 'Magic Aura', description: 'Unlock / +20% aura (damage field)', apply: gs => { const p = gs.entities.get(gs.playerId)!; (p as any).auraLevel = ((p as any).auraLevel || 0) + 1; } },
    {
        id: 'magicOrb', name: 'Magic Orbs', description: 'Unlock / +1 Magic Orb', apply: gs => {
            const p = gs.entities.get(gs.playerId)!;
            (p as any).magicOrbCount = ((p as any).magicOrbCount ?? (p as any).orbitCount ?? 0) + 1;
            (p as any).orbitCount = (p as any).magicOrbCount; // mirror legacy key
        }
    },
    {
        id: 'magicOrbDmg', name: 'Magic Orb Damage', description: 'Magic Orb damage +5', apply: gs => {
            const p = gs.entities.get(gs.playerId)!;
            (p as any).magicOrbDamage = ((p as any).magicOrbDamage ?? (p as any).orbitDamage ?? 5) + 5;
            (p as any).orbitDamage = (p as any).magicOrbDamage;
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
