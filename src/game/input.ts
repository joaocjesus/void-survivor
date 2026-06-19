import { GameState } from '../types';
import { InputState } from './types';

export interface InputHandlers {
    pollGamepad: () => void;
}

export interface GamepadDirections {
    axH: number;
    axV: number;
    buttons: boolean[];
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    anyDir: boolean;
    anyButton: boolean;
}

export function createInputState(): InputState { return { up: false, down: false, left: false, right: false }; }

export function hasDirectionalInput(input: InputState): boolean {
    return input.up || input.down || input.left || input.right;
}

const axis0HatPadKeys = new Set<string>();
let pointerRestoreWired = false;

export function markControllerInput() {
    document.body?.classList.add('controller-input');
}

export function setupPointerInputRestore() {
    if (pointerRestoreWired) return;
    pointerRestoreWired = true;
    window.addEventListener('pointermove', () => {
        document.body?.classList.remove('controller-input');
    }, { passive: true });
    window.addEventListener('mousemove', () => {
        document.body?.classList.remove('controller-input');
    }, { passive: true });
}

// First connected gamepad at any index (handles controllers plugged in mid-session
// and pads that report at index 1+). Returns null until the browser exposes one
// (which happens after the first button press for security reasons).
export function getActivePad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let first: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (!pad || pad.connected === false) continue;
        if (pad.mapping === 'standard') return pad;
        if (!first) first = pad;
    }
    return first;
}

function axis(axes: readonly number[], index: number): number {
    return axes[index] ?? 0;
}

function gamepadKey(gp: Gamepad): string {
    return `${gp.index}:${gp.id}`;
}

function noHatDirection() {
    return { left: false, right: false, up: false, down: false };
}

function povHatDirections(value: number) {
    // POV/hat axis reported by some GameSir modes:
    // idle≈3.286, up=-1, right≈-0.429, down≈0.143, left≈0.714.
    if (value > 1.2) return noHatDirection();
    if (value <= -0.85) return { left: false, right: false, up: true, down: false };
    if (value <= -0.25) return { left: false, right: true, up: false, down: false };
    if (value <= 0.45) return { left: false, right: false, up: false, down: true };
    if (value <= 0.85) return { left: true, right: false, up: false, down: false };
    return noHatDirection();
}

export function readGamepadDirections(gp: Gamepad, dead = 0.30): GamepadDirections {
    const buttons = gp.buttons.map(b => !!b && b.pressed);
    const key = gamepadKey(gp);
    const axis0 = axis(gp.axes, 0);
    if (Math.abs(axis0) > 1.2) axis0HatPadKeys.add(key);

    const axis0IsHat = axis0HatPadKeys.has(key);
    const rawH = axis(gp.axes, axis0IsHat ? 1 : 0);
    const rawV = axis(gp.axes, axis0IsHat ? 2 : 1);
    const axH = Math.abs(rawH) > dead ? rawH : 0;
    const axV = Math.abs(rawV) > dead ? rawV : 0;
    const standard = gp.mapping === 'standard';
    const hat = axis0IsHat ? povHatDirections(axis0) : noHatDirection();
    const left = axH < -dead || hat.left || (standard && !!buttons[14]);
    const right = axH > dead || hat.right || (standard && !!buttons[15]);
    const up = axV < -dead || hat.up || (standard && !!buttons[12]);
    const down = axV > dead || hat.down || (standard && !!buttons[13]);
    const anyDir = left || right || up || down;
    const anyButton = buttons.some(Boolean);
    return { axH, axV, buttons, left, right, up, down, anyDir, anyButton };
}

function clearDirectionalInput(input: InputState) {
    input.left = false;
    input.right = false;
    input.up = false;
    input.down = false;
}

export function setupKeyboard(input: InputState, gs: GameState, helpers: { onPause: () => void; onResume: () => void; toggleStats: () => void; onUpgradeNav: (dir: -1 | 1) => void; onUpgradeConfirm: () => void; lastInputDeviceRef: { v: 'keyboard' | 'gamepad'; } }): () => void {
    const normalizeKey = (key: string) => key.length === 1 ? key.toLowerCase() : key;
    const keydown = (e: KeyboardEvent) => {
        helpers.lastInputDeviceRef.v = 'keyboard';
        const key = normalizeKey(e.key);
        let pressedDirection = false;
        if (key === 'w' || key === 'ArrowUp') { input.up = true; pressedDirection = true; }
        if (key === 's' || key === 'ArrowDown') { input.down = true; pressedDirection = true; }
        if (key === 'a' || key === 'ArrowLeft') { input.left = true; pressedDirection = true; }
        if (key === 'd' || key === 'ArrowRight') { input.right = true; pressedDirection = true; }
        if (pressedDirection) input.moveTarget = undefined;
        if (gs.paused && gs.offeredUpgrades.length) {
            if (key === 'ArrowLeft' || key === 'a') { helpers.onUpgradeNav(-1); e.preventDefault(); }
            else if (key === 'ArrowRight' || key === 'd') { helpers.onUpgradeNav(1); e.preventDefault(); }
            else if (key === 'Enter') { helpers.onUpgradeConfirm(); e.preventDefault(); }
        }
        if ((key === 'Escape' || key === 'p') && !gs.paused) {
            helpers.onPause();
        } else if ((key === 'Escape' || key === 'p') && gs.paused) {
            helpers.onResume();
        }
        if (key === 'Tab') { if (!e.repeat) { helpers.toggleStats(); } e.preventDefault(); }
    };
    const keyup = (e: KeyboardEvent) => {
        helpers.lastInputDeviceRef.v = 'keyboard';
        const key = normalizeKey(e.key);
        if (key === 'w' || key === 'ArrowUp') input.up = false;
        if (key === 's' || key === 'ArrowDown') input.down = false;
        if (key === 'a' || key === 'ArrowLeft') input.left = false;
        if (key === 'd' || key === 'ArrowRight') input.right = false;
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
    let idleTimer = 0;
    const schedule = (active: boolean) => {
        if (disposed) return;
        if (active) rafId = requestAnimationFrame(poll);
        else idleTimer = window.setTimeout(poll, 250);
    };
    const poll = () => {
        if (disposed) return;
        rafId = 0;
        idleTimer = 0;
        const gp = getActivePad();
        if (gp) {
            const pad = readGamepadDirections(gp);
            const { axH, buttons, left, right, up, down } = pad;
            // Direction from stick OR d-pad (12=up,13=down,14=left,15=right) so a
            // mis-mapped/drifting stick still works via the d-pad.
            if (pad.anyDir || pad.anyButton) {
                helpers.lastInputDeviceRef.v = 'gamepad';
                markControllerInput();
            }
            if (helpers.lastInputDeviceRef.v === 'gamepad') {
                input.left = left; input.right = right; input.up = up; input.down = down;
                if (pad.anyDir) input.moveTarget = undefined;
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
            schedule(true);
        } else if (helpers.lastInputDeviceRef.v === 'gamepad') {
            clearDirectionalInput(input);
            lastButtons = [];
            lastHAxisDir = 0;
            schedule(false);
        } else {
            schedule(false);
        }
    };
    schedule(false);
    return () => {
        disposed = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (idleTimer) clearTimeout(idleTimer);
    };
}
