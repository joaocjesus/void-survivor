import * as PIXI from 'pixi.js';
import { GameState, Entity } from './types';
import { chooseShotAngles, distSq, isEntityInViewport } from './math';
import { playSound } from './audio';
import { BOLT_BASE_LIFE } from './constants/balance';
import { ENEMY_VALUES } from './constants/enemies';

export interface RenderCtx {
    app: PIXI.Application;
    sprites: Map<number, PIXI.Container>;
}

const Z_PICKUP = 10;
const Z_SHARD = 20;
const Z_SPECIAL_PICKUP = 38;
const Z_MOB = 30;
const Z_BOLT = 35;
const Z_PARTICLE = 45;

interface SpawnPoint { x: number; y: number; }
interface DropAnimation { from?: SpawnPoint; delay?: number; duration?: number; arc?: number; }
let particleTexture: PIXI.Texture | null = null;

function randomDropOrigin(gs: GameState, x: number, y: number, radius = 5): SpawnPoint {
    const angle = gs.rng() * Math.PI * 2;
    const dist = Math.sqrt(gs.rng()) * radius;
    return { x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist };
}

function applyDropAnimation(e: Entity, targetX: number, targetY: number, anim?: DropAnimation) {
    if (!anim?.from) return;
    e.dropStartX = anim.from.x;
    e.dropStartY = anim.from.y;
    e.dropTargetX = targetX;
    e.dropTargetY = targetY;
    e.dropElapsed = 0;
    e.dropDelay = anim.delay ?? 0;
    e.dropDuration = anim.duration ?? 0.28;
    e.dropArc = anim.arc ?? 12;
    e.visualOffsetY = 0;
    e.x = anim.from.x;
    e.y = anim.from.y;
}

function getParticleTexture(app: PIXI.Application) {
    if (particleTexture) return particleTexture;
    const g = new PIXI.Graphics();
    g.circle(0, 0, 2).fill({ color: 0xffffff });
    particleTexture = app.renderer.generateTexture(g);
    g.destroy();
    return particleTexture;
}

export function spawnMob(gs: GameState, ctx: RenderCtx, point?: SpawnPoint) {
    const id = gs.nextEntityId++;
    const player = gs.entities.get(gs.playerId)!;
    const angle = gs.rng() * Math.PI * 2;
    const base = Math.max(ctx.app.renderer.width, ctx.app.renderer.height) * 0.6;
    const spawnDist = base + gs.rng() * 120;
    const sx = point?.x ?? player.x + Math.cos(angle) * spawnDist;
    const sy = point?.y ?? player.y + Math.sin(angle) * spawnDist;
    const hp = ENEMY_VALUES.NORMAL.BASE_HP + Math.floor(gs.time * ENEMY_VALUES.NORMAL.HP_PER_SECOND);
    const e: Entity = { id, x: sx, y: sy, vx: 0, vy: 0, radius: 12, kind: 'mob', hp, maxHp: hp, damage: ENEMY_VALUES.NORMAL.DAMAGE, speed: 36 + gs.rng() * 22 };
    gs.entities.set(id, e);
    const g = new PIXI.Container();
    const body = new PIXI.Graphics(); body.circle(0, 0, e.radius).fill({ color: 0x8b1a1a }).stroke({ color: 0xff4d4d, width: 2 });
    const hpRing = new PIXI.Graphics(); g.addChild(body); g.addChild(hpRing); e.hpRing = hpRing;
    g.zIndex = Z_MOB; g.x = sx; g.y = sy; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnElite(gs: GameState, ctx: RenderCtx, point?: SpawnPoint) {
    const id = gs.nextEntityId++;
    const player = gs.entities.get(gs.playerId)!;
    const angle = gs.rng() * Math.PI * 2;
    const base = Math.max(ctx.app.renderer.width, ctx.app.renderer.height) * 0.6;
    const spawnDist = base + gs.rng() * 140;
    const sx = point?.x ?? player.x + Math.cos(angle) * spawnDist;
    const sy = point?.y ?? player.y + Math.sin(angle) * spawnDist;
    const hp = ENEMY_VALUES.ELITE.BASE_HP + Math.floor(gs.time * ENEMY_VALUES.ELITE.HP_PER_SECOND);
    const e: Entity = { id, x: sx, y: sy, vx: 0, vy: 0, radius: 16, kind: 'mob', hp, maxHp: hp, damage: ENEMY_VALUES.ELITE.DAMAGE, speed: 30 + gs.rng() * 15, isElite: true };
    gs.entities.set(id, e);
    const g = new PIXI.Container();
    const body = new PIXI.Graphics();
    body.rect(-e.radius, -e.radius, e.radius * 2, e.radius * 2).fill({ color: 0x6a1b9a }).stroke({ color: 0xba68c8, width: 3 });
    const hpRing = new PIXI.Graphics();
    const glow = new PIXI.Graphics(); glow.rect(-e.radius - 6, -e.radius - 6, (e.radius + 6) * 2, (e.radius + 6) * 2).fill({ color: 0x9c27b0, alpha: 0.05 });
    g.addChild(glow); g.addChild(body); g.addChild(hpRing); e.hpRing = hpRing;
    g.zIndex = Z_MOB; g.x = sx; g.y = sy; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnXp(gs: GameState, ctx: RenderCtx, x: number, y: number, value: number, elite = false, drop?: DropAnimation) {
    const id = gs.nextEntityId++;
    const w = ctx.app.renderer.width; const h = ctx.app.renderer.height;
    if (x < 8) x = 8; else if (x > w - 8) x = w - 8;
    if (y < 8) y = 8; else if (y > h - 8) y = h - 8;
    const baseRadius = elite ? 5 : 3.5;
    const e: Entity = { id, x, y, vx: 0, vy: 0, radius: baseRadius, kind: 'xp', value, isElite: elite, pulse: true };
    applyDropAnimation(e, x, y, drop);
    gs.entities.set(id, e);
    const g = new PIXI.Container();
    const glow = new PIXI.Graphics();
    const baseColor = elite ? 0x9c27b0 : 0x2196f3;
    const strokeColor = elite ? 0xe1bee7 : 0x64b5f6;
    const glowRadius = e.radius + (elite ? 9 : 7);
    glow.circle(0, 0, glowRadius).fill({ color: baseColor, alpha: elite ? 0.12 : 0.08 });
    const gem = new PIXI.Graphics();
    if (elite) {
        gem.circle(0, 0, e.radius + 2).fill({ color: baseColor }).stroke({ color: strokeColor, width: 2 });
        const ring = new PIXI.Graphics();
        ring.circle(0, 0, e.radius + 5).stroke({ color: 0xffe082, width: 1.5, alpha: 0.75 });
        const shine = new PIXI.Graphics();
        shine.circle(-2, -2, 1.8).fill({ color: 0xf3e5f5, alpha: 0.9 });
        g.addChild(glow); g.addChild(ring); g.addChild(gem); g.addChild(shine);
    } else {
        gem.circle(0, 0, e.radius).fill({ color: baseColor }).stroke({ color: strokeColor, width: 1 });
        g.addChild(glow); g.addChild(gem);
    }
    g.zIndex = Z_PICKUP;
    g.x = e.x; g.y = e.y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnXpMagnet(gs: GameState, ctx: RenderCtx, x: number, y: number, drop?: DropAnimation) {
    const id = gs.nextEntityId++;
    const w = ctx.app.renderer.width; const h = ctx.app.renderer.height;
    if (x < 10) x = 10; else if (x > w - 10) x = w - 10;
    if (y < 10) y = 10; else if (y > h - 10) y = h - 10;
    const e: Entity = { id, x, y, vx: 0, vy: 0, radius: 5, kind: 'xpMagnet', pulse: true };
    applyDropAnimation(e, x, y, drop);
    gs.entities.set(id, e);
    const g = new PIXI.Container();
    const glow = new PIXI.Graphics();
    glow.circle(0, 0, e.radius + 10).fill({ color: 0xffffff, alpha: 0.16 });
    const gem = new PIXI.Graphics();
    gem.circle(0, 0, e.radius).fill({ color: 0xf7fbff }).stroke({ color: 0xbfd7ee, width: 2 });
    const shine = new PIXI.Graphics();
    shine.circle(-2.5, -2.5, 2).fill({ color: 0xffffff, alpha: 0.95 });
    g.addChild(glow); g.addChild(gem); g.addChild(shine);
    g.zIndex = Z_SPECIAL_PICKUP;
    g.x = e.x; g.y = e.y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

export function spawnShard(gs: GameState, ctx: RenderCtx, x: number, y: number, value: number, drop?: DropAnimation) {
    const id = gs.nextEntityId++;
    const w = ctx.app.renderer.width; const h = ctx.app.renderer.height;
    if (x < 10) x = 10; else if (x > w - 10) x = w - 10;
    if (y < 10) y = 10; else if (y > h - 10) y = h - 10;
    const e: Entity = { id, x, y, vx: 0, vy: 0, radius: 6, kind: 'shard', shardValue: value };
    applyDropAnimation(e, x, y, drop);
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
    g.zIndex = Z_SHARD; g.addChild(glow); g.addChild(core); g.addChild(facet); g.addChild(shade); g.x = e.x; g.y = e.y; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
}

// Spread applied to duplicate shots when there are fewer in-range enemies than shots.
const MULTISHOT_DUP_SPREAD = 0.18; // radians (~10°)
const SINGLE_TARGET_LANE_SPACING = 12;

function multishotLaneOffsets(shots: number, spacing: number): number[] {
    const offsets: number[] = [];
    if (shots % 2 === 1) offsets.push(0);
    let pair = 0;
    while (offsets.length < shots) {
        const offset = (pair + 0.5) * spacing;
        offsets.push(-offset);
        if (offsets.length < shots) offsets.push(offset);
        pair++;
    }
    return offsets;
}

export function fireBolt(gs: GameState, ctx: RenderCtx) {
    const player = gs.entities.get(gs.playerId)!;
    const speed = player.boltSpeed || 280;
    const life = BOLT_BASE_LIFE * (player.boltLifespanMult ?? 1);
    const radius = 3;
    const shots = 1 + (player.multishot || 0);

    // Each shot aims at a distinct in-range enemy (reach = speed × lifetime); extras reuse.
    const reach = speed * life;
    const visibleMobs = [...gs.entities.values()]
        .filter(e => e.kind === 'mob' && isEntityInViewport(e, ctx.app.renderer.width, ctx.app.renderer.height));
    if (visibleMobs.length === 0) return;
    const nearestVisible = visibleMobs
        .map(e => ({ e, d: distSq(player.x, player.y, e.x, e.y) }))
        .sort((a, b) => a.d - b.d)[0].e;
    const fallback = Math.atan2(nearestVisible.y - player.y, nearestVisible.x - player.x);
    const angles = chooseShotAngles(player.x, player.y, visibleMobs, shots, reach, fallback, MULTISHOT_DUP_SPREAD);

    const spawnBolt = (angle: number, x: number, y: number) => {
        const id = gs.nextEntityId++;
        const e: Entity = { id, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius, kind: 'bolt', damage: player.damage, life };
        gs.entities.set(id, e);
        const g = new PIXI.Graphics();
        g.roundRect(-6, -2, 12, 4, 2).fill({ color: 0xffec8d }).stroke({ color: 0xffd54f, width: 1 });
        g.zIndex = Z_BOLT; g.x = x; g.y = y; g.rotation = angle; ctx.app.stage.addChild(g); ctx.sprites.set(id, g);
    };

    const reachSq = reach * reach;
    const inRangeMobs = visibleMobs
        .map(e => ({ e, d: distSq(player.x, player.y, e.x, e.y) }))
        .filter(t => t.d <= reachSq)
        .sort((a, b) => a.d - b.d)
        .map(t => t.e);
    if (shots > 1 && inRangeMobs.length === 1) {
        const target = inRangeMobs[0];
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const baseAngle = Math.atan2(dy, dx);
        const perpX = -Math.sin(baseAngle);
        const perpY = Math.cos(baseAngle);
        for (const offset of multishotLaneOffsets(shots, SINGLE_TARGET_LANE_SPACING)) {
            const x = player.x + perpX * offset;
            const y = player.y + perpY * offset;
            spawnBolt(Math.atan2(target.y - y, target.x - x), x, y);
        }
    } else {
        for (const angle of angles) spawnBolt(angle, player.x, player.y);
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
    const sprite = new PIXI.Sprite(getParticleTexture(ctx.app));
    sprite.anchor.set(0.5);
    sprite.tint = color;
    sprite.zIndex = Z_PARTICLE;
    sprite.x = x;
    sprite.y = y;
    ctx.app.stage.addChild(sprite);
    ctx.sprites.set(id, sprite);
}

export function spawnHitBurst(gs: GameState, ctx: RenderCtx, x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) spawnParticle(gs, ctx, x, y, color);
}

export function rollShardDrop(gs: GameState, ctx: RenderCtx, x: number, y: number, elite: boolean, point?: SpawnPoint): boolean {
    const drop = elite || (gs.rng() < 0.05);
    if (!drop) return false;
    const baseVal = 1 + Math.floor(gs.time / 60 * 0.6) + Math.floor(gs.kills / 200);
    const value = elite ? baseVal * 10 : baseVal;
    if (point) {
        spawnShard(gs, ctx, point.x, point.y, value, { from: randomDropOrigin(gs, x, y), duration: 0.28, arc: 14 });
        return true;
    }
    const angle = gs.rng() * Math.PI * 2;
    const offset = elite ? 18 : 14;
    spawnShard(gs, ctx, x + Math.cos(angle) * offset, y + Math.sin(angle) * offset, value, { from: randomDropOrigin(gs, x, y), duration: 0.28, arc: 14 });
    return true;
}
