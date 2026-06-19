import starterPreviewUrl from '../assets/player-ship-starter-cutout.png';
import starterSheetUrl from '../assets/player-ship-starter-sprites.png';
import voidwingPreviewUrl from '../assets/player-ship-voidwing-cutout.png';
import voidwingSheetUrl from '../assets/player-ship-voidwing-sprites.png';
import type { GridSheetOptions } from './sprites/grid';

export type PlayerShipId = 'starter' | 'voidwing';

export interface PlayerShipDefinition {
    id: PlayerShipId;
    name: string;
    sheetUrl: string;
    previewUrl: string;
    scale: number;
    grid: GridSheetOptions;
}

export const PLAYER_SHIP_STORAGE_KEY = 'voidsurvivor_player_ship';

const DEFAULT_GRID: GridSheetOptions = {
    cols: 4,
    rows: 3,
    cycleRows: [0, 1, 2],
    frameCount: 12,
};

export const PLAYER_SHIPS: PlayerShipDefinition[] = [
    {
        id: 'starter',
        name: 'Scout Dart',
        sheetUrl: starterSheetUrl,
        previewUrl: starterPreviewUrl,
        scale: 0.18,
        grid: DEFAULT_GRID,
    },
    {
        id: 'voidwing',
        name: 'Voidwing',
        sheetUrl: voidwingSheetUrl,
        previewUrl: voidwingPreviewUrl,
        scale: 0.18,
        grid: DEFAULT_GRID,
    },
];

export function getPlayerShip(id: string | null | undefined): PlayerShipDefinition {
    return PLAYER_SHIPS.find(ship => ship.id === id) ?? PLAYER_SHIPS[0];
}

export function loadPlayerShipId(): PlayerShipId {
    try {
        return getPlayerShip(localStorage.getItem(PLAYER_SHIP_STORAGE_KEY)).id;
    } catch {
        return PLAYER_SHIPS[0].id;
    }
}

export function savePlayerShipId(id: PlayerShipId) {
    try { localStorage.setItem(PLAYER_SHIP_STORAGE_KEY, id); } catch { }
}
