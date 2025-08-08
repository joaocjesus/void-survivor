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

## Getting Started

Install dependencies and run dev server:

```bash
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

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
