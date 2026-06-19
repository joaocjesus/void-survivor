// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createInputState, readGamepadDirections, setupKeyboard } from '../game/input';
import type { GameState } from '../types';

function pad(
    axes: number[],
    pressedButtons: number[] = [],
    mapping: GamepadMappingType = 'standard',
    id = 'test-pad',
): Gamepad {
    const buttons = Array.from({ length: 16 }, (_, index) => ({
        pressed: pressedButtons.includes(index),
        touched: pressedButtons.includes(index),
        value: pressedButtons.includes(index) ? 1 : 0,
    }));
    return { axes, buttons, connected: true, id, index: 0, mapping } as unknown as Gamepad;
}

describe('readGamepadDirections', () => {
    it('reads the standard left stick axes', () => {
        const input = readGamepadDirections(pad([0.7, -0.8]));

        expect(input.right).toBe(true);
        expect(input.up).toBe(true);
        expect(input.left).toBe(false);
        expect(input.down).toBe(false);
    });

    it('ignores extra axes that may rest at nonzero values', () => {
        const input = readGamepadDirections(pad([0, 0, 0, 0, 0, 0, -1, 1]));

        expect(input.left).toBe(false);
        expect(input.down).toBe(false);
        expect(input.right).toBe(false);
        expect(input.up).toBe(false);
        expect(input.anyDir).toBe(false);
    });

    it('reads standard d-pad buttons', () => {
        const input = readGamepadDirections(pad([0, 0], [12, 15]));

        expect(input.up).toBe(true);
        expect(input.right).toBe(true);
        expect(input.anyButton).toBe(true);
    });

    it('does not trust rotated d-pad button indices on non-standard pads', () => {
        const input = readGamepadDirections(pad([0, 0], [13], ''));

        expect(input.down).toBe(false);
        expect(input.anyDir).toBe(false);
        expect(input.anyButton).toBe(true);
    });

    it('reads non-standard d-pad hat axes', () => {
        readGamepadDirections(pad([3.286, 0, 0], [], '', 'hat-pad'));
        const input = readGamepadDirections(pad([-0.43, 0, 0], [], '', 'hat-pad'));

        expect(input.right).toBe(true);
        expect(input.left).toBe(false);
        expect(input.up).toBe(false);
        expect(input.down).toBe(false);
    });

    it('supports GameSir-style shifted left stick axes and axis-0 d-pad hat', () => {
        readGamepadDirections(pad([3.286, 0, 0], [], 'standard', 'gamesir'));

        expect(readGamepadDirections(pad([3.286, -1, 0], [], 'standard', 'gamesir')).left).toBe(true);
        expect(readGamepadDirections(pad([3.286, 1, 0], [], 'standard', 'gamesir')).right).toBe(true);
        expect(readGamepadDirections(pad([3.286, 0, -1], [], 'standard', 'gamesir')).up).toBe(true);
        expect(readGamepadDirections(pad([3.286, 0, 1], [], 'standard', 'gamesir')).down).toBe(true);

        expect(readGamepadDirections(pad([-1, 0, 0], [], 'standard', 'gamesir')).up).toBe(true);
        expect(readGamepadDirections(pad([0.143, 0, 0], [], 'standard', 'gamesir')).down).toBe(true);
        expect(readGamepadDirections(pad([0.714, 0, 0], [], 'standard', 'gamesir')).left).toBe(true);
        expect(readGamepadDirections(pad([-0.429, 0, 0], [], 'standard', 'gamesir')).right).toBe(true);
    });

    it('filters stick drift inside the dead zone', () => {
        const input = readGamepadDirections(pad([0.1, -0.2]));

        expect(input.anyDir).toBe(false);
        expect(input.axH).toBe(0);
        expect(input.axV).toBe(0);
    });
});

describe('setupKeyboard', () => {
    it('handles WASD movement when Caps Lock produces uppercase keys', () => {
        const input = createInputState();
        const gs = {
            paused: false,
            offeredUpgrades: [],
        } as unknown as GameState;
        const cleanup = setupKeyboard(input, gs, {
            onPause: () => { },
            onResume: () => { },
            toggleStats: () => { },
            onUpgradeNav: () => { },
            onUpgradeConfirm: () => { },
            lastInputDeviceRef: { v: 'keyboard' },
        });

        try {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'W' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'S' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D' }));

            expect(input.up).toBe(true);
            expect(input.left).toBe(true);
            expect(input.down).toBe(true);
            expect(input.right).toBe(true);

            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'W' }));
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'A' }));
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'S' }));
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'D' }));

            expect(input.up).toBe(false);
            expect(input.left).toBe(false);
            expect(input.down).toBe(false);
            expect(input.right).toBe(false);
        } finally {
            cleanup();
        }
    });
});
