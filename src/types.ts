import type * as PIXI from 'pixi.js';
import type { Rarity } from './constants/cards';

export interface Vector2 { x: number; y: number; }
export type EntityKind = 'player' | 'mob' | 'bolt' | 'xp' | 'xpMagnet' | 'shard' | 'particle';
export interface Entity {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    kind: EntityKind;
    hp?: number;
    maxHp?: number;
    damage?: number;
    speed?: number;
    life?: number;
    value?: number;
    shardValue?: number;
    attackSpeed?: number;
    boltSpeed?: number;
    pickupRange?: number;
    invuln?: number;
    regen?: number;
    alpha?: number;
    xpGain?: number;
    isElite?: boolean;
    auraLevel?: number;
    auraRadiusPct?: number;
    magicOrbCount?: number;
    magicOrbDamage?: number;
    orbSpeedMult?: number;
    multishot?: number;
    boltLifespanMult?: number;
    lastOrbitHitAt?: number;
    pulse?: boolean;
    spin?: boolean;
    magnetized?: boolean;
    dropStartX?: number;
    dropStartY?: number;
    dropTargetX?: number;
    dropTargetY?: number;
    dropElapsed?: number;
    dropDelay?: number;
    dropDuration?: number;
    dropArc?: number;
    visualOffsetY?: number;
    auraRenderRadius?: number;
    hpBarPct?: number;
    hpRing?: PIXI.Graphics;
    auraG?: PIXI.Graphics;
    orbitG?: PIXI.Container;
}

export interface UpgradeDef {
    id: string;
    name: string;
    description: string;
    maxLevel?: number;
    isPower?: boolean;                  // active ability (extra "power" styling on the card)
    requires?: (gs: GameState) => boolean; // gate: only offered when this returns true
    apply: (gs: GameState, rarity: Rarity) => void;
}

export interface OfferedUpgrade { def: UpgradeDef; rarity: Rarity; }

export interface MetaUpgradeDef { id: string; name: string; description: string; maxLevel: number; cost: (level: number) => number; apply: (level: number, base: PlayerStartStats) => void; }

export interface PlayerStartStats { hp: number; maxHp: number; damage: number; speed: number; attackSpeed: number; boltSpeed: number; pickupRange: number; regen: number; xpGain: number; rerolls: number; bans: number; auraDamage?: number; auraRadius?: number; }

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
    boltTimer: number;
    xp: number;
    level: number;
    xpNeeded: number;
    kills: number;
    rng: () => number;
    paused: boolean;
    upgradePool: UpgradeDef[];
    upgradeCounts: Record<string, number>; // times each upgrade has been taken
    offeredUpgrades: OfferedUpgrade[];
    rerolls?: number;
    bans?: number;
    rerollControlsEverAvailable?: boolean;
    banControlsEverAvailable?: boolean;
    banModeActive?: boolean;
    runActive: boolean;
    startStats: PlayerStartStats;
    meta: MetaSave;
    runShards?: number; // shards collected this run
    statsVisible?: boolean;
    fps?: number;
    lastEliteMinute?: number;
}

export interface PersistPayload {
    meta: MetaSave;
}
