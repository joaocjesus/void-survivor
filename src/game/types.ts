export interface InputState {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    moveTarget?: { x: number; y: number };
    cursorTarget?: { x: number; y: number };
}
