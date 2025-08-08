// Preset parameter collections for the procedural dark background texture.
// You can reference these when calling makeDarkTexture. Override via URL query ?bg=<key>
// or modify at runtime (see integration code in game.ts).
//
// Tuning tips:
// - cells: higher => finer detail (base lattice resolution). Lower => broad blobs.
// - variance: amplitude of light/dark modulation (higher = stronger contrast swings before contrast multiplier).
// - contrast: expands values around mid (1 = none). Subtle 1.05–1.3 is typical.
// - octaves: more = richer multi-scale structure (cost slightly higher CPU generation once on load).
// - persistence: how quickly higher octave amplitudes fall off (0.45–0.65 normal, higher -> more high‑freq retention).
// - lowFreqWeight: boosts octave 0 broad shapes (1.0 = none). 1.1–1.4 recommended.
// - brightness: post color multiplier (<1 darker, >1 lighter).
// - vignette: radial darkening; keep true for focus, false for evenly tiled look.

export interface DarkTextureOptions {
    size?: number;
    cells?: number;
    baseColor?: number;
    variance?: number;
    contrast?: number;
    vignette?: boolean;
    octaves?: number;
    persistence?: number;
    lowFreqWeight?: number;
    brightness?: number;
}

export interface DarkTexturePreset {
    name: string;
    options: DarkTextureOptions;
    note?: string;
}

export const DARK_TEXTURE_PRESETS: Record<string, DarkTexturePreset> = {
    // Current in-game default (balanced subtle noise)
    default: {
        name: 'Default Subtle',
        options: { cells: 25, variance: 20, contrast: 1.3, octaves: 4, persistence: 0.9, lowFreqWeight: 1.1, vignette: true, brightness: 0.9 },
        note: 'Balanced subtle texture with mild mottling and vignette.'
    },

    // Slightly darker, broader blobs for more cinematic feel
    darkBrood: {
        name: 'Dark Brood',
        options: { cells: 18, variance: 18, contrast: 1.22, octaves: 5, persistence: 0.62, lowFreqWeight: 1.25, vignette: true, brightness: 0.82 },
        note: 'Broader organic shapes, darker midtones.'
    },

    // Alien film style: veiny / tendril suggestion via higher contrast + more octaves + boosted low freq
    alienVein: {
        name: 'Alien Vein',
        options: { cells: 34, variance: 26, contrast: 1.38, octaves: 5, persistence: 0.58, lowFreqWeight: 1.35, vignette: true, brightness: 0.88 },
        note: 'Higher fine detail with accentuated broad gradients for a sinewy look.'
    },

    // Biofilm: softer, flatter contrast, gently pulsing feel if later animated
    bioFilm: {
        name: 'Bio Film',
        options: { cells: 22, variance: 14, contrast: 1.18, octaves: 3, persistence: 0.65, lowFreqWeight: 1.18, vignette: true, brightness: 0.92 },
        note: 'Soft, diffuse, low-variance – minimal distraction.'
    },

    // Nebula-like: more variance but lower contrast to avoid harsh speckles
    nebula: {
        name: 'Deep Nebula',
        options: { cells: 30, variance: 30, contrast: 1.22, octaves: 6, persistence: 0.6, lowFreqWeight: 1.3, vignette: true, brightness: 0.95 },
        note: 'Richer multi-scale detail, still restrained by moderate contrast.'
    },

    // High clarity minimal texture (almost flat) for testing readability
    flatTest: {
        name: 'Flat Test',
        options: { cells: 16, variance: 6, contrast: 1.05, octaves: 2, persistence: 0.5, lowFreqWeight: 1.05, vignette: true, brightness: 0.92 },
        note: 'Nearly flat background to test on-screen readability.'
    }
};

export function listDarkTexturePresetKeys(): string[] { return Object.keys(DARK_TEXTURE_PRESETS); }

export function getDarkTexturePreset(key: string): DarkTexturePreset | undefined { return DARK_TEXTURE_PRESETS[key]; }
