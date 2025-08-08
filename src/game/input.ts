import { GameState } from '../types';
import { InputState } from './types';

export interface InputHandlers {
  pollGamepad: () => void;
}

export function createInputState(): InputState { return { up: false, down: false, left: false, right: false }; }

export function setupKeyboard(input: InputState, gs: GameState, helpers: { onPause: () => void; onResume: () => void; toggleStats: () => void; onUpgradeNav: (dir: -1 | 1) => void; onUpgradeConfirm: () => void; lastInputDeviceRef: { v: 'keyboard' | 'gamepad'; } }) {
  window.addEventListener('keydown', e => {
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
  });
  window.addEventListener('keyup', e => {
    helpers.lastInputDeviceRef.v = 'keyboard';
    if (e.key === 'w' || e.key === 'ArrowUp') input.up = false;
    if (e.key === 's' || e.key === 'ArrowDown') input.down = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') input.left = false;
    if (e.key === 'd' || e.key === 'ArrowRight') input.right = false;
  });
}

export function setupGamepad(input: InputState, gs: GameState, helpers: { onPause: () => void; toggleStats: () => void; onUpgradeNav: (dir: -1 | 1) => void; onUpgradeConfirm: () => void; lastInputDeviceRef: { v: 'keyboard' | 'gamepad'; } }) {
  let lastButtons: boolean[] = [];
  let lastHAxisDir = 0;
  const poll = () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && pads[0];
    if (gp) {
      const axH = gp.axes[0] || 0;
      const axV = gp.axes[1] || 0;
      const dead = 0.22;
      const h = Math.abs(axH) > dead ? axH : 0;
      const v = Math.abs(axV) > dead ? axV : 0;
      const buttons = gp.buttons.map(b => b.pressed);
      if (h !== 0 || v !== 0 || buttons.some(b => b)) helpers.lastInputDeviceRef.v = 'gamepad';
      if (helpers.lastInputDeviceRef.v === 'gamepad') {
        input.left = h < -dead; input.right = h > dead; input.up = v < -dead; input.down = v > dead;
      }
      if (buttons[9] && !lastButtons[9]) { // Start
        if (!gs.paused) helpers.onPause(); else helpers.onPause();
      }
      const toggleStats = (buttons[3] && !lastButtons[3]) || (buttons[8] && !lastButtons[8]);
      if (toggleStats) helpers.toggleStats();
      if (gs.paused && gs.offeredUpgrades.length) {
        const dpadLeft = buttons[14] && !lastButtons[14];
        const dpadRight = buttons[15] && !lastButtons[15];
        const stickLeft = h < -0.55 && lastHAxisDir !== -1;
        const stickRight = h > 0.55 && lastHAxisDir !== 1;
        if (dpadLeft || stickLeft) helpers.onUpgradeNav(-1);
        if (dpadRight || stickRight) helpers.onUpgradeNav(1);
        lastHAxisDir = h > 0.55 ? 1 : (h < -0.55 ? -1 : 0);
        if (buttons[0] && !lastButtons[0]) helpers.onUpgradeConfirm();
      }
      lastButtons = buttons;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
