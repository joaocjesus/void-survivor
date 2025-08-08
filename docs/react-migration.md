# React Migration Planning

This document captures the recommended approach for migrating the current PixiJS + vanilla TS project to a React-based UI while keeping the game engine cleanly separated.

## Goals
- Preserve existing game loop / deterministic logic (entities, upgrades, RNG) with minimal rewrites.
- Move all DOM-driven UI (menus, meta upgrades, pause/game over, upgrade choices) into React components.
- Enable future feature velocity: theming, stateful UI, modular components.
- Avoid perf regressions: keep Pixi canvas rendering outside React’s reconciliation where possible.

## High-Level Architecture
```
/engine          (pure TS: no React, no direct DOM except canvas injection)
  game.ts        (Game class: init(rootEl), update loop, exposes events)
  types.ts
  meta.ts
  audio.ts
/react-ui
  components/
    GameCanvas.tsx         (mounts Pixi engine)
    MainMenu.tsx
    MetaUpgrades.tsx
    UpgradeModal.tsx
    PauseMenu.tsx
    GameOverModal.tsx
    HUD.tsx
  hooks/
    useGameEngine.ts       (instantiate & expose engine API)
    useInput.ts            (keyboard/gamepad abstraction)
    useAnimationFrame.ts   (for any UI-side ticking if needed)
  state/
    MetaContext.tsx        (meta progression + persistence)
    UIStateContext.tsx     (menu/pause/modal state machine)
```

## Separation of Concerns
| Concern | Current | Future | Notes |
|---------|---------|--------|-------|
| Game loop & entities | `Game` class | engine module | Must not import React. |
| Rendering (canvas) | Pixi directly in `game.ts` | Same | Provide container element via ref. |
| UI overlays | Raw HTML + query | React components | Controlled via state/context. |
| Input | Global listeners in game & main | `useInput` + engine API | Engine receives high-level input state. |
| Persistence | localStorage calls in meta.ts | Service + context | Keep pure functions for calculations. |
| Events (restart, game over) | CustomEvent + window listeners | Engine -> subscriber callbacks | Provide typed subscription API. |

## Engine API Sketch
```ts
interface GameCallbacks {
  onGameOver?: (summary: RunSummary) => void;
  onLevelUp?: (choices: UpgradeDef[]) => void;
  onShardsChange?: (total: number, run: number) => void;
}

class GameEngine {
  constructor(root: HTMLElement, meta: MetaSave, cb?: GameCallbacks);
  startRun(): void;
  destroy(): void;
  applyUpgrade(id: string): void;
  setInput(input: { up:boolean; down:boolean; left:boolean; right:boolean });
  togglePause(flag?: boolean): void; // maintains internal state
  getSnapshot(): EngineSnapshot; // for HUD without tight coupling
}
```

## Component Responsibilities
- `GameCanvas`: creates a div ref, instantiates engine on mount; passes callbacks; on unmount calls `destroy`.
- `HUD`: derives display stats either via periodic snapshot (requestAnimationFrame in a hook) or event-driven updates.
- `UpgradeModal`: shown when engine triggers level-up; passes chosen upgrade back.
- `MetaUpgrades`: reads MetaContext; dispatches purchases; re-renders costs automatically.
- `PauseMenu`: toggles engine pause; updates UIStateContext.
- `GameOverModal`: displays summary from callback and offers restart or return to menu.
- `MainMenu`: sets up new run / navigates to meta / instructions.

## State Strategy
| State | Location | Justification |
|-------|----------|---------------|
| Meta progression | MetaContext + localStorage effect | Needed across sessions & menus. |
| UI modal/menu state | UIStateContext (finite state: 'main','meta','run','pause','gameover','upgrades') | Centralized transitions. |
| Run summary (on death) | UIStateContext or local component state (GameOverModal) | Only needed post-run. |
| Input modality (keyboard/gamepad) | UIStateContext (modality flag) | Influence focus management. |

## Focus & Navigation
- Consolidate current manual focus logic into a hook: `useSpatialNav(items, layout)` used by menus & meta grid.
- Gamepad & keyboard share the same navigation decisions; pointer hover updates focus index but does not lock out keyboard/gamepad.

## Input Handling Plan
1. Hook `useInput` attaches listeners (keydown/up, gamepad poll via rAF).
2. Maintains stable `inputState` for movement + `uiNav` events (e.g., navLeft/navRight/confirm/back).
3. Movement state forwarded each frame to engine via `engine.setInput()`.
4. UI events dispatched to focused component (menu, upgrade modal, meta grid) via context or prop callbacks.

## Incremental Migration Path
1. Extract current `Game` logic into an `engine/` folder (rename minimal to avoid DOM coupling). Keep existing vanilla UI for now.
2. Add React + Vite plugin; render a root `<App/>` alongside existing HTML to verify coexistence.
3. Move HUD to React first (read only). Use snapshots to ensure no perf hit.
4. Move Main Menu + Meta Upgrades screen to React; keep upgrade modal & pause in vanilla.
5. Replace upgrade modal with React component driven by `onLevelUp` callback.
6. Migrate pause & game over overlays.
7. Remove old HTML markup & inline scripts; rely purely on React.
8. Refactor input listeners: detach from old code, implement `useInput`.
9. Add types for callback events; remove CustomEvent usage.
10. Optimize & tidy: convert repeated color values to CSS variables & collocate component-specific styles (CSS Modules or SCSS). Optional theming.

## Styling Strategy Options (Phase 2+)
- Phase 1: Reuse existing global CSS (import once in `App.tsx`).
- Phase 2: Introduce `vars.css` for colors / radii / shadows.
- Phase 3 (optional): Convert each component to CSS Module for scoped styles OR adopt Tailwind if utility approach desired.

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Engine tightly coupled to DOM ids | Harder extraction | Abstract element acquisition; pass root container. |
| Performance regressions from frequent React re-renders | Jank | Throttle HUD updates (rAF + shallow compare) or event-driven updates. |
| Gamepad navigation complexity in React | Inconsistent UX | Central spatial nav hook shared by all menus. |
| Upgrade flow timing issues (pausing) | Desync | Engine emits single level-up event; React controls modal visibility & pauses engine via `togglePause(true)`. |
| Memory leaks on hot reload / component unmount | Crashes / perf | Provide `engine.destroy()` (remove ticker, listeners, clear Pixi stage). |

## Future Enhancements Post-Migration
- Theming (dark/light or rarity color schemes) via CSS variables.
- Persistent settings (audio volume, accessibility) with React context + localStorage.
- Internationalization (wrap text content early; avoid hard-coded strings in engine).
- Analytics hooks (time-to-level, upgrade pick rates) instrumented in event callbacks.

## Quick Task Backlog
- [ ] Extract engine folder (no React dependencies).
- [ ] Provide typed callback registration inside engine.
- [ ] Introduce React + root bootstrap.
- [ ] Implement MetaContext + persistence effect.
- [ ] Create UIStateContext with finite-state transitions.
- [ ] Port HUD to React.
- [ ] Port Main Menu + Meta Upgrades (reuse existing logic, map to components).
- [ ] Add onLevelUp callback + React UpgradeModal.
- [ ] Port Pause & Game Over modals.
- [ ] Implement useInput & spatial navigation hook.
- [ ] Remove legacy DOM menus from index.html.
- [ ] Introduce vars.css (design tokens).
- [ ] (Optional) Switch to CSS Modules / SCSS.

## Minimal Example: GameCanvas Component (Future)
```tsx
const GameCanvas: React.FC = () => {
  const divRef = React.useRef<HTMLDivElement>(null);
  const engineRef = React.useRef<GameEngine | null>(null);
  const { meta } = useMeta();
  const { setUIState } = useUIState();

  React.useEffect(() => {
    if (divRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(divRef.current, meta, {
        onGameOver: summary => setUIState({ mode: 'gameover', summary }),
        onLevelUp: choices => setUIState({ mode: 'upgrade', choices })
      });
      engineRef.current.startRun();
    }
    return () => { engineRef.current?.destroy(); engineRef.current = null; };
  }, [meta]);

  useInput(input => engineRef.current?.setInput(input));
  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
};
```

## Summary
Keep the Pixi engine framework-agnostic and let React own *presentation & user interaction*. Migrate incrementally (HUD → menus → modals → input) to minimize breakage. Introduce a clean callback surface so React and the engine communicate via typed events rather than DOM coupling.

---
(Prepared for future migration – safe to evolve as architecture decisions sharpen.)
