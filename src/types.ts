export interface Vector2 { x: number; y: number; }
export type EntityKind = 'player' | 'mob' | 'projectile' | 'xp' | 'shard' | 'particle';
export interface Entity { id: number; x: number; y: number; vx: number; vy: number; radius: number; kind: EntityKind; hp?: number; maxHp?: number; damage?: number; speed?: number; life?: number; value?: number; attackSpeed?: number; projectileSpeed?: number; pickupRange?: number; invuln?: number; regen?: number; alpha?: number; xpGain?: number; }

export interface UpgradeDef { id: string; name: string; description: string; maxLevel?: number; apply: (gs: GameState) => void; }

export interface MetaUpgradeDef { id: string; name: string; description: string; maxLevel: number; cost: (level: number) => number; apply: (level: number, base: PlayerStartStats) => void; }

export interface PlayerStartStats { hp: number; maxHp: number; damage: number; speed: number; attackSpeed: number; projectileSpeed: number; pickupRange: number; regen: number; xpGain: number; auraDamage?: number; auraRadius?: number; }

export interface MetaSave {
    shards: number;
    purchased: Record<string, number>; // upgrade id -> level
    stats: { totalKills: number; totalTime: number; runs: number; bestTime: number; };
}

export interface GameState {
    time: number;
    playerId: number;
    entities: Map<number, Entity>;
    nextEntityId: number;
    spawnTimer: number;
    projectileTimer: number;
    xp: number;
    level: number;
    xpNeeded: number;
    kills: number;
    rng: () => number;
    paused: boolean;
    upgradePool: UpgradeDef[];
    offeredUpgrades: UpgradeDef[];
    runActive: boolean;
    startStats: PlayerStartStats;
    meta: MetaSave;
    runShards?: number; // shards collected this run
}

export interface PersistPayload {
    meta: MetaSave;
}
