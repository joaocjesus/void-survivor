# Void Survivor

Arena survival roguelite prototype built with TypeScript, Vite and PixiJS.

## Current Features
- Smooth player movement (WASD / Arrows / Left Stick)
- Controller & keyboard navigation for menus, upgrades, pause screen
- Auto-targeting projectiles with damage, attack speed & projectile speed scaling
- Magic Aura (AOE damage field) and Magic Orbs (orbiting projectiles) powers
- Elite enemies with boosted XP gem drops (purple gems = 10× XP)
- XP, Leveling & upgrade draft (3 random choices) with power comparisons
- Shards (meta currency) + guaranteed elite shard drops
- Meta upgrade menu with persistent progression (localStorage)
- Stats overlay (toggle Tab / Y / Select) showing run stats & power levels
- Pause menu (Esc / P / Start) with Resume & Quit to Menu
- Gamepad: movement, upgrade selection, menu navigation, pause toggle
- Particle effects, hit flashes and simple procedural audio
- Deterministic seeded RNG for consistent balancing tests
 - Sprite sheet player character with frame mirroring (right-facing frames reused for left via scale.x flip)

## Getting Started

Install dependencies and run dev server:

```bash
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

### Developer / Debug Options

Enable snapshot export/import (meta progression only) in the Settings menu by starting the dev server with:

```
VITE_DEV_OPTIONS=true npm run dev
```

This reveals a hidden Debug section with buttons to Export (download a `void-survivor-meta-<timestamp>.json`) and Import a snapshot. Importing without an active run merges meta progression (shards, purchased upgrades, aggregate stats). Snapshot JSON files matching `*-snapshot.json` are ignored by git.

### Sprite / Animation Notes

The player uses a grid-based sprite sheet. Only right-facing walk cycle frames are stored; left direction is rendered by mirroring (`scale.x = -1`) without resetting the current frame to avoid flicker. Animation only plays when actual displacement occurs (see `didMove` in `src/movement.ts`), using `MOVE_EPSILON` to suppress micro jitter. Adjust movement animation speed via `MOVE_ANIM_SPEED`.

## Next Ideas
- More enemy variety & behaviors
- Additional weapon archetypes / secondary weapons
- Rarity tiers & weighted upgrade pool
- Boss waves or timed objectives
- Screen shake & richer VFX polish
- Sound mixing & mute options
- Accessibility & colorblind mode
- Cloud save / export-import save

## License
MIT
