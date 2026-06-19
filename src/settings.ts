const GAMEPLAY_SETTINGS_KEY = 'voidsurvivor_gameplay_settings_v1';

export interface GameplaySettings {
    mouseMovementEnabled: boolean;
}

const DEFAULT_GAMEPLAY_SETTINGS: GameplaySettings = {
    mouseMovementEnabled: true,
};

function loadGameplaySettings(): GameplaySettings {
    try {
        const raw = localStorage.getItem(GAMEPLAY_SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_GAMEPLAY_SETTINGS };
        return { ...DEFAULT_GAMEPLAY_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_GAMEPLAY_SETTINGS };
    }
}

let settings = loadGameplaySettings();

function saveGameplaySettings() {
    try { localStorage.setItem(GAMEPLAY_SETTINGS_KEY, JSON.stringify(settings)); } catch { }
}

export function getGameplaySettings(): GameplaySettings {
    return { ...settings };
}

export function getMouseMovementEnabled(): boolean {
    return settings.mouseMovementEnabled;
}

export function setMouseMovementEnabled(enabled: boolean) {
    settings = { ...settings, mouseMovementEnabled: enabled };
    saveGameplaySettings();
}
