// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { formatRunTime, updateStatsOverlay } from '../game/hud';
import type { Entity, GameState, PlayerStartStats } from '../types';

describe('formatRunTime', () => {
    it('shows minutes and zero-padded seconds below one minute', () => {
        expect(formatRunTime(0)).toBe('0:00');
        expect(formatRunTime(7.9)).toBe('0:07');
    });

    it('shows minutes and seconds up to 59:59', () => {
        expect(formatRunTime(65)).toBe('1:05');
        expect(formatRunTime(3599)).toBe('59:59');
    });

    it('shows hours after 59:59', () => {
        expect(formatRunTime(3600)).toBe('1:00:00');
        expect(formatRunTime(3661)).toBe('1:01:01');
    });
});

describe('updateStatsOverlay', () => {
    it('formats scaled stats with explicit units', () => {
        document.body.innerHTML = `<div id="statsOverlay"><div id="statsContent"></div></div>`;
        const startStats: PlayerStartStats = {
            hp: 50, maxHp: 50, damage: 10, speed: 80, attackSpeed: 1,
            boltSpeed: 100, pickupRange: 50, regen: 0, xpGain: 1,
        };
        const player: Entity = {
            id: 0, kind: 'player', x: 0, y: 0, vx: 0, vy: 0, radius: 10,
            hp: 50, maxHp: 50, damage: 10, speed: 80, attackSpeed: 1,
            boltSpeed: 100, pickupRange: 50, regen: 0.25, xpGain: 1,
        };
        const gs = {
            statsVisible: true,
            entities: new Map([[0, player]]),
            playerId: 0,
            level: 1,
            xp: 0,
            xpNeeded: 5,
            kills: 0,
            startStats,
        } as unknown as GameState;

        updateStatsOverlay(gs);

        const content = document.getElementById('statsContent')?.textContent ?? '';
        expect(content).toContain('Bolt Speed100%');
        expect(content).not.toContain('FPS');
        expect(content).toContain('Move Speed100%');
        expect(content).toContain('Pickup Range50 px');
        expect(content).toContain('Regeneration0.25 HP/s');
        expect(content).toContain('XP Gain100%');
    });
});
