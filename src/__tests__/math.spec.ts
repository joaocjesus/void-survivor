import { describe, it, expect } from 'vitest';
import { clamp, distSq, pickAngle } from '../math';
import type { GameState, Entity } from '../types';

function makeGs(player: Partial<Entity>, mobs: Partial<Entity>[]): GameState {
  const entities = new Map<number, Entity>();
  const p: Entity = { id: 0, x: 0, y: 0, vx:0, vy:0, radius:10, kind:'player', ...player } as Entity;
  entities.set(0, p);
  mobs.forEach((m,i)=>entities.set(i+1, { id: i+1, x:0, y:0, vx:0, vy:0, radius:8, kind:'mob', ...m } as Entity));
  return { time:0, playerId:0, entities, nextEntityId: mobs.length+1, spawnTimer:0, projectileTimer:0, xp:0, level:1, xpNeeded:5, kills:0, rng:()=>Math.random(), paused:false, upgradePool:[], offeredUpgrades:[], runActive:true, startStats: {} as any, meta: { shards:0, purchased:{}, stats:{ totalKills:0,totalTime:0,runs:0,bestTime:0 } } };
}

describe('math utils', () => {
  it('clamp clamps low/high', () => {
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(25, 10, 20)).toBe(20);
    expect(clamp(15, 10, 20)).toBe(15);
  });
  it('distSq computes squared distance', () => {
    expect(distSq(0,0,3,4)).toBe(25);
  });
  it('pickAngle returns undefined when no mobs', () => {
    const gs = makeGs({}, []);
    expect(pickAngle(gs)).toBeUndefined();
  });
  it('pickAngle aims at nearest mob', () => {
    const gs = makeGs({}, [ { x: 100, y:0 }, { x: 50, y:0 } ]);
    const angle = pickAngle(gs)!;
    // nearest mob at (50,0) -> angle 0
    expect(Math.abs(angle - 0)).toBeLessThan(1e-6);
  });
});
