import { describe, expect, it } from 'vitest';
import { formatRunTime } from '../game/hud';

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
