import * as PIXI from 'pixi.js';
import { GameState, Entity } from './types';
import { pickAngle } from './math';
import { playSound } from './audio';

export interface RenderCtx {
  app: PIXI.Application;
  sprites: Map<number, PIXI.Container | PIXI.Graphics>;
}

export function spawnMob(gs: GameState, ctx: RenderCtx) {
  const id = gs.nextEntityId++;
  const player = gs.entities.get(gs.playerId)!;
  const angle = gs.rng() * Math.PI * 2;
  const base = Math.max(ctx.app.renderer.width, ctx.app.renderer.height) * 0.6;
  const spawnDist = base + gs.rng() * 120;
  const sx = player.x + Math.cos(angle) * spawnDist;
  const sy = player.y + Math.sin(angle) * spawnDist;
  const hp = 8 + Math.floor(gs.time * 0.25);
  const e: Entity = { id, x: sx, y: sy, vx: 0, vy: 0, radius: 12, kind: 'mob', hp, maxHp: hp, damage: 4, speed: 36 + gs.rng() * 22 };
  gs.entities.set(id, e);
  const g = new PIXI.Container();
  const body = new PIXI.Graphics(); body.circle(0, 0, e.radius).fill({ color: 0x8b1a1a }).stroke({ color: 0xff4d4d, width: 2 });
  const hpRing = new PIXI.Graphics(); g.addChild(body); g.addChild(hpRing); (e as any).hpRing = hpRing;
  g.x = sx; g.y = sy; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnElite(gs: GameState, ctx: RenderCtx) {
  const id = gs.nextEntityId++;
  const player = gs.entities.get(gs.playerId)!;
  const angle = gs.rng() * Math.PI * 2;
  const base = Math.max(ctx.app.renderer.width, ctx.app.renderer.height) * 0.6;
  const spawnDist = base + gs.rng() * 140;
  const sx = player.x + Math.cos(angle) * spawnDist;
  const sy = player.y + Math.sin(angle) * spawnDist;
  const hp = 120 + Math.floor(gs.time * 1.2);
  const e: Entity = { id, x: sx, y: sy, vx: 0, vy: 0, radius: 16, kind: 'mob', hp, maxHp: hp, damage: 10, speed: 30 + gs.rng() * 15 };
  (e as any).elite = true;
  gs.entities.set(id, e);
  const g = new PIXI.Container();
  const body = new PIXI.Graphics();
  body.rect(-e.radius, -e.radius, e.radius * 2, e.radius * 2).fill({ color: 0x6a1b9a }).stroke({ color: 0xba68c8, width: 3 });
  const hpRing = new PIXI.Graphics();
  const glow = new PIXI.Graphics(); glow.rect(-e.radius - 6, -e.radius - 6, (e.radius + 6) * 2, (e.radius + 6) * 2).fill({ color: 0x9c27b0, alpha: 0.05 });
  g.addChild(glow); g.addChild(body); g.addChild(hpRing); (e as any).hpRing = hpRing;
  g.x = sx; g.y = sy; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnXp(gs: GameState, ctx: RenderCtx, x: number, y: number, value: number, elite = false) {
  const id = gs.nextEntityId++;
  const w = ctx.app.renderer.width; const h = ctx.app.renderer.height;
  if (x < 8) x = 8; else if (x > w - 8) x = w - 8;
  if (y < 8) y = 8; else if (y > h - 8) y = h - 8;
  const baseRadius = elite ? 5 : 4;
  const e: Entity = { id, x, y, vx: 0, vy: 0, radius: baseRadius, kind: 'xp', value };
  gs.entities.set(id, e);
  const g = new PIXI.Container();
  const glow = new PIXI.Graphics();
  const baseColor = elite ? 0x9c27b0 : 0x2196f3;
  const strokeColor = elite ? 0xe1bee7 : 0x64b5f6;
  const glowRadius = e.radius + (elite ? 9 : 7);
  glow.circle(0, 0, glowRadius).fill({ color: baseColor, alpha: elite ? 0.12 : 0.08 });
  const gem = new PIXI.Graphics();
  gem.circle(0, 0, e.radius + (elite ? 1 : 0)).fill({ color: baseColor }).stroke({ color: strokeColor, width: elite ? 2 : 1 });
  g.addChild(glow); g.addChild(gem); (g as any).pulse = true; (g as any).elite = elite;
  g.x = x; g.y = y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnShard(gs: GameState, ctx: RenderCtx, x: number, y: number, value: number) {
  const id = gs.nextEntityId++;
  const w = ctx.app.renderer.width; const h = ctx.app.renderer.height;
  if (x < 8) x = 8; else if (x > w - 8) x = w - 8;
  if (y < 8) y = 8; else if (y > h - 8) y = h - 8;
  const e: Entity = { id, x, y, vx: 0, vy: 0, radius: 5, kind: 'shard', value };
  gs.entities.set(id, e);
  const g = new PIXI.Container();
  const glow = new PIXI.Graphics(); glow.circle(0, 0, e.radius + 6).fill({ color: 0xffd180, alpha: 0.08 });
  const core = new PIXI.Graphics(); core.moveTo(0, -4).lineTo(4, 0).lineTo(0, 4).lineTo(-4, 0).lineTo(0, -4).fill({ color: 0xffb74d }).stroke({ color: 0xffe0b2, width: 1 });
  g.addChild(glow); g.addChild(core); (g as any).spin = true; g.x = x; g.y = y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function fireProjectile(gs: GameState, ctx: RenderCtx) {
  const player = gs.entities.get(gs.playerId)!;
  const id = gs.nextEntityId++;
  const angle = pickAngle(gs) ?? gs.rng() * Math.PI * 2;
  const speed = player.projectileSpeed || 280;
  const life = 1.2;
  const radius = 3;
  const e: Entity = { id, x: player.x, y: player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius, kind: 'projectile', damage: player.damage, life };
  gs.entities.set(id, e);
  const g = new PIXI.Graphics(); g.circle(0, 0, radius).fill({ color: 0xffec8d }).stroke({ color: 0xffd54f, width: 1 });
  g.x = player.x; g.y = player.y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
  playSound('shoot');
}

export function spawnParticle(gs: GameState, ctx: RenderCtx, x: number, y: number, color: number) {
  const id = gs.nextEntityId++;
  const life = 0.5 + Math.random() * 0.3; // cosmetic randomness
  const speed = 40 + Math.random() * 80;
  const ang = Math.random() * Math.PI * 2;
  const e: Entity = { id, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, radius: 2, kind: 'particle', life, alpha: 1 };
  gs.entities.set(id, e);
  const g = new PIXI.Graphics(); g.circle(0, 0, e.radius).fill({ color, alpha: 1 }); g.x = x; g.y = y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnHitBurst(gs: GameState, ctx: RenderCtx, x: number, y: number, color: number, count: number) {
  for (let i = 0; i < count; i++) spawnParticle(gs, ctx, x, y, color);
}

export function rollShardDrop(gs: GameState, ctx: RenderCtx, x: number, y: number, elite: boolean) {
  const baseChance = Math.min(0.05 + gs.time * 0.0005, 0.25);
  const drop = elite || (gs.rng() < baseChance);
  if (!drop) return;
  const baseVal = 1 + Math.floor(gs.time / 60 * 0.6) + Math.floor(gs.kills / 200);
  const value = elite ? baseVal * 10 : baseVal;
  spawnShard(gs, ctx, x, y, value);
}
