import * as PIXI from 'pixi.js';
import normalEnemyUrl from '../assets/enemy-normal.png';
import bossEnemyUrl from '../assets/enemy-boss.png';

export type EnemySpriteKind = 'normal' | 'boss';

const ENEMY_SPRITE_CONFIG: Record<EnemySpriteKind, {
    url: string;
    visualDiameter: number;
    glowColor: number;
    glowRadius: number;
    glowAlpha: number;
}> = {
    normal: {
        url: normalEnemyUrl,
        visualDiameter: 2.9,
        glowColor: 0xff2a2a,
        glowRadius: 1.7,
        glowAlpha: 0.08,
    },
    boss: {
        url: bossEnemyUrl,
        visualDiameter: 3.8,
        glowColor: 0xb44dff,
        glowRadius: 2.15,
        glowAlpha: 0,
    },
};

const enemyTextures: Partial<Record<EnemySpriteKind, PIXI.Texture>> = {};

export async function preloadEnemySprites() {
    await Promise.all((Object.keys(ENEMY_SPRITE_CONFIG) as EnemySpriteKind[]).map(async (kind) => {
        const texture = await PIXI.Assets.load(ENEMY_SPRITE_CONFIG[kind].url).catch(() => null);
        if (texture) enemyTextures[kind] = texture as PIXI.Texture;
    }));
}

export function createEnemySprite(kind: EnemySpriteKind, radius: number): PIXI.Container {
    const config = ENEMY_SPRITE_CONFIG[kind];
    const body = new PIXI.Container();
    if (config.glowAlpha > 0) {
        const glow = new PIXI.Graphics();
        glow.circle(0, 0, radius * config.glowRadius).fill({ color: config.glowColor, alpha: config.glowAlpha });
        body.addChild(glow);
    }

    const texture = enemyTextures[kind];
    if (texture) {
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        const size = radius * config.visualDiameter;
        sprite.width = size;
        sprite.height = size;
        body.addChild(sprite);
    } else {
        body.addChild(createFallbackEnemySprite(kind, radius));
    }

    return body;
}

function createFallbackEnemySprite(kind: EnemySpriteKind, radius: number): PIXI.Graphics {
    const g = new PIXI.Graphics();
    if (kind === 'boss') {
        g.rect(-radius, -radius, radius * 2, radius * 2)
            .fill({ color: 0x6a1b9a })
            .stroke({ color: 0xba68c8, width: 3 });
    } else {
        g.circle(0, 0, radius)
            .fill({ color: 0x8b1a1a })
            .stroke({ color: 0xff4d4d, width: 2 });
    }
    return g;
}
