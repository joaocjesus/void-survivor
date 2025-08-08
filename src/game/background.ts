import * as PIXI from 'pixi.js';
import { DARK_TEXTURE_PRESETS } from '../backgroundPresets';

// Base tile size for background procedural texture (increase for smoother appearance)
const gridSquareSize = 512;

export interface DarkTextureOptions {
    size?: number; cells?: number; baseColor?: number; variance?: number; contrast?: number; vignette?: boolean; octaves?: number; persistence?: number; lowFreqWeight?: number; brightness?: number;
}

// Procedurally generate a seamless dark noise texture for the background.
// Approach: multi-octave value noise on a coarse lattice bilinearly interpolated to a tile, with edge wrapping.
export function makeDarkTexture(app: PIXI.Application, opts?: DarkTextureOptions): PIXI.Texture {
    const size = opts?.size ?? gridSquareSize;
    const baseCells = opts?.cells ?? 24;
    const baseColor = opts?.baseColor ?? 0x101418;
    const variance = opts?.variance ?? 18;
    const contrast = opts?.contrast ?? 1.06;
    const useVignette = opts?.vignette ?? true;
    const octaves = Math.max(1, opts?.octaves ?? 3);
    const persistence = opts?.persistence ?? 0.55;
    const lowFreqWeight = opts?.lowFreqWeight ?? 1.1;
    const brightness = opts?.brightness ?? 1;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);

    // Pre-build lattices for each octave (wrapping)
    const lattices: number[][][] = [];
    for (let o = 0; o < octaves; o++) {
        const cells = baseCells * (1 << o);
        const lat: number[][] = [];
        for (let y = 0; y <= cells; y++) {
            const row: number[] = [];
            for (let x = 0; x <= cells; x++) {
                if (y === cells) row.push(lat[0][x]);
                else if (x === cells) row.push(row[0]);
                else row.push(Math.random());
            }
            lat.push(row);
        }
        lattices.push(lat);
    }

    const br = (baseColor >> 16) & 0xff;
    const bgc = (baseColor >> 8) & 0xff;
    const bb = baseColor & 0xff;
    const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

    const sampleOctave = (o: number, px: number, py: number): number => {
        const lat = lattices[o];
        const cells = lat.length - 1;
        const gx = (px / size) * cells; const gy = (py / size) * cells;
        const x0 = Math.floor(gx); const y0 = Math.floor(gy);
        const tx = smooth(gx - x0); const ty = smooth(gy - y0);
        const x1 = x0 + 1; const y1 = y0 + 1;
        const v00 = lat[y0][x0]; const v10 = lat[y0][x1];
        const v01 = lat[y1][x0]; const v11 = lat[y1][x1];
        const v0 = v00 + (v10 - v00) * tx;
        const v1 = v01 + (v11 - v01) * tx;
        return v0 + (v1 - v0) * ty;
    };

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let amp = 1, total = 0, norm = 0;
            for (let o = 0; o < octaves; o++) {
                let v = sampleOctave(o, px, py);
                if (o === 0) v *= lowFreqWeight;
                total += v * amp; norm += amp; amp *= persistence;
            }
            let v = total / norm;
            v = ((v - 0.5) * contrast) + 0.5;
            if (useVignette) {
                const nx = (px / size) * 2 - 1;
                const ny = (py / size) * 2 - 1;
                const d = Math.min(1, Math.sqrt(nx * nx + ny * ny));
                const vig = 1 - d * 0.32;
                v *= vig;
            }
            const delta = (v - 0.5) * 2 * variance;
            let r = br + delta; let g = bgc + delta; let b = bb + delta;
            r = Math.max(0, Math.min(255, r * brightness));
            g = Math.max(0, Math.min(255, g * brightness));
            b = Math.max(0, Math.min(255, b * brightness));
            const idx = (py * size + px) * 4;
            img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = PIXI.Texture.from(canvas);
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; // smooth scaling
    return tex;
}

export function createBackground(app: PIXI.Application) {
    const darkTex = makeDarkTexture(app, { size: 512, ...DARK_TEXTURE_PRESETS.default.options });
    const darkBg = new PIXI.TilingSprite({ texture: darkTex, width: app.renderer.width, height: app.renderer.height });
    app.stage.addChildAt(darkBg, 0);
    app.renderer.on('resize', () => {
        darkBg.width = app.renderer.width;
        darkBg.height = app.renderer.height;
    });
}
