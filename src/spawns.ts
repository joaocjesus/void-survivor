import * as PIXI from 'pixi.js';
import { GameState, Entity } from './types';
import { chooseShotAngles, pickAngle } from './math';
import { playSound } from './audio';
import { BOLT_BASE_LIFE } from './constants/balance';

export interface RenderCtx {
    app: PIXI.Application;
    sprites: Map<number, PIXI.Container>;
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
    const hpRing = new PIXI.Graphics(); g.addChild(body); g.addChild(hpRing); e.hpRing = hpRing;
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
    const e: Entity = { id, x: sx, y: sy, vx: 0, vy: 0, radius: 16, kind: 'mob', hp, maxHp: hp, damage: 10, speed: 30 + gs.rng() * 15, isElite: true };
    gs.entities.set(id, e);
    const g = new PIXI.Container();
    const body = new PIXI.Graphics();
    body.rect(-e.radius, -e.radius, e.radius * 2, e.radius * 2).fill({ color: 0x6a1b9a }).stroke({ color: 0xba68c8, width: 3 });
    const hpRing = new PIXI.Graphics();
    const glow = new PIXI.Graphics(); glow.rect(-e.radius - 6, -e.radius - 6, (e.radius + 6) * 2, (e.radius + 6) * 2).fill({ color: 0x9c27b0, alpha: 0.05 });
    g.addChild(glow); g.addChild(body); g.addChild(hpRing); e.hpRing = hpRing;
    g.x = sx; g.y = sy; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnXp(gs: GameState, ctx: RenderCtx, x: number, y: number, value: number, elite = false) {
    const id = gs.nextEntityId++;
    const w = ctx.app.renderer.width; const h = ctx.app.renderer.height;
    if (x < 8) x = 8; else if (x > w - 8) x = w - 8;
    if (y < 8) y = 8; else if (y > h - 8) y = h - 8;
    const baseRadius = elite ? 5 : 4;
    const e: Entity = { id, x, y, vx: 0, vy: 0, radius: baseRadius, kind: 'xp', value, isElite: elite, pulse: true };
    gs.entities.set(id, e);
    const g = new PIXI.Container();
    const glow = new PIXI.Graphics();
    const baseColor = elite ? 0x9c27b0 : 0x2196f3;
    const strokeColor = elite ? 0xe1bee7 : 0x64b5f6;
    const glowRadius = e.radius + (elite ? 9 : 7);
    glow.circle(0, 0, glowRadius).fill({ color: baseColor, alpha: elite ? 0.12 : 0.08 });
    const gem = new PIXI.Graphics();
    gem.circle(0, 0, e.radius + (elite ? 1 : 0)).fill({ color: baseColor }).stroke({ color: strokeColor, width: elite ? 2 : 1 });
    g.addChild(glow); g.addChild(gem);
    g.x = x; g.y = y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnShard(gs: GameState, ctx: RenderCtx, x: number, y: number, value: number) {
    const id = gs.nextEntityId++;
    const w = ctx.app.renderer.width; const h = ctx.app.renderer.height;
    if (x < 10) x = 10; else if (x > w - 10) x = w - 10;
    if (y < 10) y = 10; else if (y > h - 10) y = h - 10;
    const e: Entity = { id, x, y, vx: 0, vy: 0, radius: 6, kind: 'shard', shardValue: value };
    gs.entities.set(id, e);
    const g = new PIXI.Container();
    const glow = new PIXI.Graphics();
    glow.circle(0, 0, e.radius + 4).fill({ color: 0xffb74d, alpha: 0.1 });
    const core = new PIXI.Graphics();
    core
        .moveTo(0, -6)
        .lineTo(5, -2)
        .lineTo(0, 6)
        .lineTo(-5, -2)
        .lineTo(0, -6)
        .fill({ color: 0xffb74d })
        .stroke({ color: 0xffe0b2, width: 1 });
    const facet = new PIXI.Graphics();
    facet
        .moveTo(0, -5)
        .lineTo(3.5, -2)
        .lineTo(0, 4.5)
        .lineTo(0, -5)
        .fill({ color: 0xffe0b2, alpha: 0.65 });
    const shade = new PIXI.Graphics();
    shade
        .moveTo(0, -5)
        .lineTo(0, 4.5)
        .lineTo(-3.5, -2)
        .lineTo(0, -5)
        .fill({ color: 0xf57c00, alpha: 0.45 });
    g.addChild(glow); g.addChild(core); g.addChild(facet); g.addChild(shade); g.x = x; g.y = y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

// Spread applied to duplicate shots when there are fewer in-range enemies than shots.
const MULTISHOT_DUP_SPREAD = 0.18; // radians (~10°)

export function fireBolt(gs: GameState, ctx: RenderCtx) {
    const player = gs.entities.get(gs.playerId)!;
    const speed = player.boltSpeed || 280;
    const life = BOLT_BASE_LIFE * (player.boltLifespanMult ?? 1);
    const radius = 3;
    const shots = 1 + (player.multishot || 0);

    // Each shot aims at a distinct in-range enemy (reach = speed × lifetime); extras reuse.
    const reach = speed * life;
    const mobs = [...gs.entities.values()].filter(e => e.kind === 'mob');
    const fallback = pickAngle(gs) ?? gs.rng() * Math.PI * 2;
    const angles = chooseShotAngles(player.x, player.y, mobs, shots, reach, fallback, MULTISHOT_DUP_SPREAD);

    for (const angle of angles) {
        const id = gs.nextEntityId++;
        const e: Entity = { id, x: player.x, y: player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius, kind: 'bolt', damage: player.damage, life };
        gs.entities.set(id, e);
        const g = new PIXI.Graphics();
        g.roundRect(-6, -2, 12, 4, 2).fill({ color: 0xffec8d }).stroke({ color: 0xffd54f, width: 1 });
        g.x = player.x; g.y = player.y; g.rotation = angle; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
    }
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

export function rollShardDrop(gs: GameState, ctx: RenderCtx, x: number, y: number, elite: boolean): boolean {
    const drop = elite || (gs.rng() < 0.05);
    if (!drop) return false;
    const baseVal = 1 + Math.floor(gs.time / 60 * 0.6) + Math.floor(gs.kills / 200);
    const value = elite ? baseVal * 10 : baseVal;
    const angle = gs.rng() * Math.PI * 2;
    const offset = elite ? 18 : 14;
    spawnShard(gs, ctx, x + Math.cos(angle) * offset, y + Math.sin(angle) * offset, value);
    return true;
}
