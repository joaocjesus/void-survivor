import { GameState } from '../types';
import { InputState } from './types';

export interface InputHandlers {
    pollGamepad: () => void;
}

export function createInputState(): InputState { return { up: false, down: false, left: false, right: false }; }

// First connected gamepad at any index (handles controllers plugged in mid-session
// and pads that report at index 1+). Returns null until the browser exposes one
// (which happens after the first button press for security reasons).
export function getActivePad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p) return p;
    return null;
}

export function setupKeyboard(input: InputState, gs: GameState, helpers: { onPause: () => void; onResume: () => void; toggleStats: () => void; onUpgradeNav: (dir: -1 | 1) => void; onUpgradeConfirm: () => void; lastInputDeviceRef: { v: 'keyboard' | 'gamepad'; } }): () => void {
    const keydown = (e: KeyboardEvent) => {
        helpers.lastInputDeviceRef.v = 'keyboard';
        if (e.key === 'w' || e.key === 'ArrowUp') input.up = true;
        if (e.key === 's' || e.key === 'ArrowDown') input.down = true;
        if (e.key === 'a' || e.key === 'ArrowLeft') input.left = true;
        if (e.key === 'd' || e.key === 'ArrowRight') input.right = true;
        if (gs.paused && gs.offeredUpgrades.length) {
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) { helpers.onUpgradeNav(-1); e.preventDefault(); }
            else if (['ArrowRight', 'd', 'D'].includes(e.key)) { helpers.onUpgradeNav(1); e.preventDefault(); }
            else if (e.key === 'Enter') { helpers.onUpgradeConfirm(); e.preventDefault(); }
        }
        if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && !gs.paused) {
            helpers.onPause();
        } else if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && gs.paused) {
            helpers.onResume();
        }
        if (e.key === 'Tab') { if (!e.repeat) { helpers.toggleStats(); } e.preventDefault(); }
    };
    const keyup = (e: KeyboardEvent) => {
        helpers.lastInputDeviceRef.v = 'keyboard';
        if (e.key === 'w' || e.key === 'ArrowUp') input.up = false;
        if (e.key === 's' || e.key === 'ArrowDown') input.down = false;
        if (e.key === 'a' || e.key === 'ArrowLeft') input.left = false;
        if (e.key === 'd' || e.key === 'ArrowRight') input.right = false;
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
        window.removeEventListener('keydown', keydown);
        window.removeEventListener('keyup', keyup);
    };
}

export function setupGamepad(input: InputState, gs: GameState, helpers: { onPause: () => void; toggleStats: () => void; onUpgradeNav: (dir: -1 | 1) => void; onUpgradeConfirm: () => void; lastInputDeviceRef: { v: 'keyboard' | 'gamepad'; } }): () => void {
    let lastButtons: boolean[] = [];
    let lastHAxisDir = 0;
    let disposed = false;
    let rafId = 0;
    const DEAD = 0.30; // ignore analog-stick drift (was causing phantom movement)
    const poll = () => {
        if (disposed) return;
        const gp = getActivePad();
        if (gp) {
            const axH = gp.axes[0] || 0;
            const axV = gp.axes[1] || 0;
            const buttons = gp.buttons.map(b => !!b && b.pressed);
            // Direction from stick OR d-pad (12=up,13=down,14=left,15=right) so a
            // mis-mapped/drifting stick still works via the d-pad.
            const left = axH < -DEAD || !!buttons[14];
            const right = axH > DEAD || !!buttons[15];
            const up = axV < -DEAD || !!buttons[12];
            const down = axV > DEAD || !!buttons[13];
            const anyDir = left || right || up || down;
            if (anyDir || buttons.some(b => b)) helpers.lastInputDeviceRef.v = 'gamepad';
            if (helpers.lastInputDeviceRef.v === 'gamepad') {
                input.left = left; input.right = right; input.up = up; input.down = down;
            }
            if (buttons[9] && !lastButtons[9]) helpers.onPause(); // Start
            const toggleStats = (buttons[3] && !lastButtons[3]) || (buttons[8] && !lastButtons[8]);
            if (toggleStats) helpers.toggleStats();
            if (gs.paused && gs.offeredUpgrades.length) {
                const dpadLeft = buttons[14] && !lastButtons[14];
                const dpadRight = buttons[15] && !lastButtons[15];
                const stickLeft = axH < -0.55 && lastHAxisDir !== -1;
                const stickRight = axH > 0.55 && lastHAxisDir !== 1;
                if (dpadLeft || stickLeft) helpers.onUpgradeNav(-1);
                if (dpadRight || stickRight) helpers.onUpgradeNav(1);
                lastHAxisDir = axH > 0.55 ? 1 : (axH < -0.55 ? -1 : 0);
                if (buttons[0] && !lastButtons[0]) helpers.onUpgradeConfirm();
            }
            lastButtons = buttons;
        }
        rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => {
        disposed = true;
        if (rafId) cancelAnimationFrame(rafId);
    };
}
