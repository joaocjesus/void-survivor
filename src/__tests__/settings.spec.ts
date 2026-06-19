import { describe, expect, it, vi } from 'vitest';

describe('gameplay settings', () => {
    it('persists mouse movement preference', async () => {
        const data: Record<string, string> = {};
        (globalThis as any).localStorage = {
            getItem: (key: string) => data[key] ?? null,
            setItem: (key: string, value: string) => { data[key] = value; },
        };
        vi.resetModules();
        const mod = await import('../settings');

        expect(mod.getMouseMovementEnabled()).toBe(true);
        mod.setMouseMovementEnabled(false);

        expect(mod.getGameplaySettings().mouseMovementEnabled).toBe(false);
        expect(JSON.parse(Object.values(data)[0]).mouseMovementEnabled).toBe(false);
    });
});
