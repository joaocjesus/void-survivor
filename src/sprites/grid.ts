import * as PIXI from 'pixi.js';

export type Dir = 'left' | 'right' | 'up' | 'down';

export interface GridSheetOptions {
    cols: number;
    rows: number;
    // zero-based row index containing the walk cycle seen from the side
    sideRow?: number; // defaults to 0
    // optional per-direction row mapping if available in the sheet
    rowFor?: Partial<Record<Dir, number>>;
    // If provided, the animation cycle will concatenate frames from these row indices (in order).
    // Useful for sheets where one animation spans multiple rows.
    cycleRows?: number[];
    // Limit total frames used from the cycle (useful when the last row is partial).
    frameCount?: number;
}

// Slice a grid spritesheet into textures (uniform cells)
export function sliceGrid(texture: PIXI.Texture, cols: number, rows: number): PIXI.Texture[] {
    const w = texture.width; const h = texture.height;
    const fw = Math.floor(w / cols); const fh = Math.floor(h / rows);
    const list: PIXI.Texture[] = [];
    for (let ry = 0; ry < rows; ry++) {
        for (let cx = 0; cx < cols; cx++) {
            const rect = new PIXI.Rectangle(cx * fw, ry * fh, fw, fh);
            list.push(new PIXI.Texture({ source: texture.source, frame: rect }));
        }
    }
    return list;
}

export interface PlayerSprite {
    view: PIXI.Container;
    setMoving(m: boolean): void;
    setDir(d: Dir): void;
    setAnimSpeed(speed: number): void;
}

// Create a simple player AnimatedSprite from a grid.
export function createPlayerSpriteFromGrid(texture: PIXI.Texture, options: GridSheetOptions): PlayerSprite {
    const cols = options.cols; const rows = options.rows;
    const frames = sliceGrid(texture, cols, rows);
    const sideRow = options.sideRow ?? 0;
    const rowFor = options.rowFor || {};

    const getRow = (dir: Dir): number => (rowFor[dir] ?? sideRow);
    const rowSlice = (rowIdx: number) => frames.slice(rowIdx * cols, rowIdx * cols + cols);
    const makeCycleFor = (dir: Dir) => {
        if (options.cycleRows && options.cycleRows.length) {
            const list: PIXI.Texture[] = [];
            for (const r of options.cycleRows) list.push(...rowSlice(r));
            return (typeof options.frameCount === 'number') ? list.slice(0, options.frameCount) : list;
        }
        const list = rowSlice(getRow(dir));
        return (typeof options.frameCount === 'number') ? list.slice(0, options.frameCount) : list;
    };

    const anim = new PIXI.AnimatedSprite(makeCycleFor('right'));
    anim.animationSpeed = 0.2;
    anim.anchor.set(0.5);
    anim.play();

    const container = new PIXI.Container();
    container.addChild(anim);

    let currentDir: Dir = 'right';
    let moving = true;

    const mirroredHorizontal = !options.rowFor || (options.rowFor.left == null && options.rowFor.right == null);
    const setDir = (d: Dir) => {
        if (d === currentDir) return;
        // Optimize: if switching between left/right and we are mirroring the same frame set, don't reset textures (prevents frame index reset flicker)
        if ((d === 'left' || d === 'right') && (currentDir === 'left' || currentDir === 'right') && mirroredHorizontal) {
            currentDir = d;
            anim.scale.x = (d === 'left') ? -1 : 1;
            return;
        }
        currentDir = d;
        anim.textures = makeCycleFor(d);
        // Mirror if needed
        if (d === 'left') anim.scale.x = -1; else anim.scale.x = 1;
    };

    const setMoving = (m: boolean) => {
        if (moving === m) return;
        moving = m;
        if (moving) anim.play(); else anim.stop();
    };

    const setAnimSpeed = (speed: number) => { anim.animationSpeed = speed; };

    return { view: container, setMoving, setDir, setAnimSpeed };
}
