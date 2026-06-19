// Enemy combat tuning.
// HP scales linearly with run time: baseHp + floor(time * hpPerSecond).

export const ENEMY_VALUES = {
    NORMAL: {
        BASE_HP: 5,
        HP_PER_SECOND: 0.25,
        DAMAGE: 5,
    },
    ELITE: {
        BASE_HP: 50,
        HP_PER_SECOND: 1.2,
        DAMAGE: 20,
    },
};
