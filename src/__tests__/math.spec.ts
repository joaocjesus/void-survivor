import { describe, it, expect } from 'vitest';
import { clamp, distSq, isEntityInViewport, pickAngle, chooseShotAngles } from '../math';
import type { GameState, Entity } from '../types';

const mob = (x: number, y: number): Entity => ({ id: 0, x, y, vx: 0, vy: 0, radius: 8, kind: 'mob' } as Entity);

function makeGs(player: Partial<Entity>, mobs: Partial<Entity>[]): GameState {
    const entities = new Map<number, Entity>();
    const p: Entity = { id: 0, x: 0, y: 0, vx: 0, vy: 0, radius: 10, kind: 'player', ...player } as Entity;
    entities.set(0, p);
    mobs.forEach((m, i) => entities.set(i + 1, { id: i + 1, x: 0, y: 0, vx: 0, vy: 0, radius: 8, kind: 'mob', ...m } as Entity));
    return { time: 0, playerId: 0, entities, nextEntityId: mobs.length + 1, spawnTimer: 0, boltTimer: 0, xp: 0, level: 1, xpNeeded: 5, kills: 0, rng: () => Math.random(), paused: false, upgradePool: [], upgradeCounts: {}, offeredUpgrades: [], runActive: true, startStats: {} as any, meta: { shards: 0, purchased: {}, stats: { totalKills: 0, totalTime: 0, runs: 0, bestTime: 0 } } };
}

describe('math utils', () => {
    it('clamp clamps low/high', () => {
        expect(clamp(5, 10, 20)).toBe(10);
        expect(clamp(25, 10, 20)).toBe(20);
        expect(clamp(15, 10, 20)).toBe(15);
    });
    it('distSq computes squared distance', () => {
        expect(distSq(0, 0, 3, 4)).toBe(25);
    });
    it('isEntityInViewport accounts for entity radius', () => {
        expect(isEntityInViewport(mob(-7, 50), 100, 100)).toBe(true);
        expect(isEntityInViewport(mob(-9, 50), 100, 100)).toBe(false);
        expect(isEntityInViewport(mob(50, 107), 100, 100)).toBe(true);
        expect(isEntityInViewport(mob(50, 109), 100, 100)).toBe(false);
    });
    it('pickAngle returns undefined when no mobs', () => {
        const gs = makeGs({}, []);
        expect(pickAngle(gs)).toBeUndefined();
    });
    it('pickAngle aims at nearest mob', () => {
        const gs = makeGs({}, [{ x: 100, y: 0 }, { x: 50, y: 0 }]);
        const angle = pickAngle(gs)!;
        // nearest mob at (50,0) -> angle 0
        expect(Math.abs(angle - 0)).toBeLessThan(1e-6);
    });
});

describe('chooseShotAngles (multishot targeting)', () => {
    it('aims each shot at a distinct nearest enemy', () => {
        // east at d=10, south at d=20
        const angles = chooseShotAngles(0, 0, [mob(10, 0), mob(0, 20)], 2, 100, 9);
        expect(angles).toHaveLength(2);
        expect(Math.abs(angles[0] - 0)).toBeLessThan(1e-6);          // nearest (east)
        expect(Math.abs(angles[1] - Math.PI / 2)).toBeLessThan(1e-6); // next (south)
    });

    it('ignores enemies beyond bolt reach', () => {
        const fallback = 1.234;
        // only mob is at d=20, reach=5 -> out of range -> fallback for every shot
        const angles = chooseShotAngles(0, 0, [mob(20, 0)], 2, 5, fallback);
        expect(angles).toEqual([fallback, fallback]);
    });

    it('reuses a single target without fan spread', () => {
        // one enemy due east, 3 shots: every shot should aim at the target
        const angles = chooseShotAngles(0, 0, [mob(10, 0)], 3, 100, 0, 0.2);
        expect(angles).toEqual([0, 0, 0]);
    });

    it('fans duplicate shots when cycling across multiple targets', () => {
        const angles = chooseShotAngles(0, 0, [mob(10, 0), mob(0, 10)], 4, 100, 0, 0.2);
        expect(angles[0]).toBeCloseTo(0, 6);
        expect(angles[1]).toBeCloseTo(Math.PI / 2, 6);
        expect(angles[2]).toBeCloseTo(0.2, 6);
        expect(angles[3]).toBeCloseTo(Math.PI / 2 + 0.2, 6);
    });

    it('uses the fallback angle when no enemies are present', () => {
        expect(chooseShotAngles(0, 0, [], 2, 100, 0.5)).toEqual([0.5, 0.5]);
    });
});
