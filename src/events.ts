export type GameEventMap = {
    gameover: { time: number; kills: number; shards: number };
    levelup: { choices: string[] };
    shardsChange: { total: number; run: number };
};

type Handler<T> = (payload: T) => void;

export class EventBus {
    private handlers: { [K in keyof GameEventMap]: Handler<GameEventMap[K]>[] } = {
        gameover: [],
        levelup: [],
        shardsChange: [],
    };
    on<K extends keyof GameEventMap>(type: K, fn: Handler<GameEventMap[K]>) { this.handlers[type].push(fn); }
    off<K extends keyof GameEventMap>(type: K, fn: Handler<GameEventMap[K]>) {
        const arr = this.handlers[type]; const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1);
    }
    emit<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]) { this.handlers[type].forEach(h => h(payload)); }
}
