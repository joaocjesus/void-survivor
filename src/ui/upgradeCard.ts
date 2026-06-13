import { FIRE_INTERVAL_BASE, POWERS_VALUES, PROJECTILE_BASE_LIFE } from '../constants/balance';
import { DARK_TEXTURE_PRESETS } from '../backgroundPresets';
import { darkTextureDataURL } from '../game/background';
import { Entity, PlayerStartStats, UpgradeDef } from '../types';
import { rarityValue, type Rarity } from '../constants/rarity';

// Powers that start locked: their first pick is the "New Unlock" card.
const UNLOCKABLE_IDS = new Set(['auraRadius', 'magicOrbs']);

const RARITY_LABEL: Record<Rarity, string> = {
    common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
};

// Generate the same procedural dark texture used for the game background once,
// and expose it to CSS via a custom property so cards share that look.
let cardNoiseReady = false;
function ensureCardNoise(): void {
    if (cardNoiseReady || typeof document === 'undefined') return;
    cardNoiseReady = true;
    try {
        // Reuse the game texture's structure (cells/octaves/etc) but render it as a lit
        // relief/bump map: flats sit at mid grey (soft-light neutral) while slopes get
        // light/dark, giving a rough, raised 3D surface. No vignette (would tile into rings).
        const url = darkTextureDataURL({
            ...DARK_TEXTURE_PRESETS.default.options,
            size: 256,
            relief: true,
            reliefStrength: 16, // higher -> deeper, steeper bumps
            cells: 9,           // higher -> finer, denser bumps (lower -> broader, more spaced)
            octaves: 3,         // higher -> more fine high-freq detail
            persistence: 0.62,  // higher -> retains more high-freq detail (busier)
            vignette: false,
            brightness: 1,
        });
        document.documentElement.style.setProperty('--card-noise', `url("${url}")`);
    } catch {
        /* canvas unavailable (e.g. tests) — CSS falls back to no texture */
    }
}

export interface UpgradeCardOptions {
    player: Entity;
    base: PlayerStartStats;
    rarity?: Rarity;
    increments?: number;
    onChoose?: (upgrade: UpgradeDef) => void;
}

export function renderUpgradeCard(upgrade: UpgradeDef, options: UpgradeCardOptions): HTMLButtonElement {
    ensureCardNoise();
    const rarity = options.rarity ?? 'common';
    const player = options.player;
    const base = options.base;
    const increments = options.increments ?? 0;
    const unlockable = UNLOCKABLE_IDS.has(upgrade.id);
    const isUnlock = unlockable && increments === 0;
    const currentLevel = unlockable ? increments : increments + 1;
    const nextLevel = currentLevel + 1;

    const card = document.createElement('button');
    card.className = `upgrade rarity-${rarity}`;
    card.type = 'button';
    if (upgrade.isPower) card.classList.add('power');
    if (options.onChoose) card.onclick = () => options.onChoose?.(upgrade);

    const badge = (side: string) =>
        `<span class="levelBadge levelBadge--${side}"><span class="levelBadgeLabel">LVL</span><span class="levelBadgeNum">${nextLevel}</span></span>`;
    const levelBadges = `${badge('left')}${badge('right')}`;
    const subtitle =
        `<div class="rarityLabel">${RARITY_LABEL[rarity]}</div>` +
        (isUnlock ? `<div class="unlockLine">New Unlock</div>` : '');
    const cardHeader =
        `<div class="upgradeHeader">${levelBadges}<div class="upgradeTitle"><h3>${upgrade.name}</h3>${subtitle}</div></div>`;

    const transitionRow = (label: string, current: string, next: string, inc?: string) =>
        `<div class="transitionRow"><span class="transitionLabel">${label}</span><span class="transitionValue"><span class="prevValue">${current}</span> <span class="arrowText">→</span> <strong>${next}</strong></span><span class="incPct">${inc ? `(${inc})` : ''}</span></div>`;

    const powerSection = `<div class="cardSection powerSection"><div class="transitionList">${statTransition(upgrade.id, player, base, rarity, transitionRow)}</div></div>`;
    const footer = `<div class="cardFooter">${statFooter(upgrade.id, player, base, rarity)}</div>`;
    card.innerHTML = `${cardHeader}<div class="cardBody"><div class="body">${powerSection}</div>${footer}</div>`;
    return card;
}

function formatHpPerSecond(value: number): string {
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} HP/s`;
}

const pct = (cur: number, baseVal: number) => (cur / baseVal) * 100;

// Builds the "current → next" row for a card at a given rarity, reading the
// player's live stat as the starting point and the rarity magnitude as the step.
function statTransition(
    id: string,
    player: Entity,
    base: PlayerStartStats,
    rarity: Rarity,
    row: (label: string, current: string, next: string, inc?: string) => string
): string {
    const v = rarityValue(id, rarity);
    const pctInc = `+${v}%`;
    switch (id) {
        case 'damage': {
            const cur = player.damage ?? base.damage;
            return row('Damage', String(cur), String(cur + v), `+${v}`);
        }
        case 'attackSpeed': {
            const cur = player.attackSpeed ?? base.attackSpeed;
            return row('Attack Speed', cur.toFixed(2), (cur + base.attackSpeed * v / 100).toFixed(2), pctInc);
        }
        case 'moveSpeed': {
            const curPct = pct(player.speed ?? base.speed, base.speed);
            return row('Move Speed', `${curPct.toFixed(0)}%`, `${(curPct + v).toFixed(0)}%`, pctInc);
        }
        case 'projSpeed': {
            const curPct = pct(player.projectileSpeed ?? base.projectileSpeed, base.projectileSpeed);
            return row('Projectile Speed', `${curPct.toFixed(0)}%`, `${(curPct + v).toFixed(0)}%`, pctInc);
        }
        case 'projLifeSpan': {
            const curPct = (player.projLifeSpanMult ?? 1) * 100;
            return row('Projectile Lifespan', `${curPct.toFixed(0)}%`, `${(curPct + v).toFixed(0)}%`, pctInc);
        }
        case 'hp': {
            const cur = player.maxHp ?? base.maxHp;
            return row('Max HP', String(cur), String(cur + v), `+${v}`);
        }
        case 'pickupRange': {
            const curPct = pct(player.pickupRange ?? base.pickupRange, base.pickupRange);
            return row('Pickup Range', `${curPct.toFixed(0)}%`, `${(curPct + v).toFixed(0)}%`, pctInc);
        }
        case 'regen': {
            const cur = player.regen ?? 0;
            return row('Regeneration', formatHpPerSecond(cur), formatHpPerSecond(cur + v), `+${formatHpPerSecond(v)}`);
        }
        case 'multiShot': {
            const cur = player.multishot ?? 0;
            return row('Extra Projectiles', String(cur), String(cur + v), `+${v}`);
        }
        case 'auraRadius': {
            const curPct = player.auraRadiusPct ?? 100;
            return row('Aura Size', `${curPct.toFixed(0)}%`, `${(curPct + v).toFixed(0)}%`, pctInc);
        }
        case 'magicOrbs': {
            const cur = player.magicOrbCount ?? 0;
            return row('Orbs', String(cur), String(cur + v), `+${v}`);
        }
        case 'magicOrbDamage': {
            const cur = player.magicOrbDamage ?? POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE;
            return row('Orb Damage', String(cur), String(cur + v), `+${v}`);
        }
        case 'magicOrbSpeed': {
            const curPct = (player.orbSpeedMult ?? 1) * 100;
            return row('Orb Speed', `${curPct.toFixed(0)}%`, `${(curPct + v).toFixed(0)}%`, pctInc);
        }
        default:
            return '';
    }
}

// Footer note for percentage stats: shows the unit conversion of the transition,
// "<curPct>% (<curUnit>) → <nextPct>% (<nextUnit>)". Empty for stats with no unit.
function statFooter(id: string, player: Entity, base: PlayerStartStats, rarity: Rarity): string {
    const v = rarityValue(id, rarity);
    const arrow = '<span class="arrowText">→</span>';
    const note = (curPct: number, curVal: number, nextPct: number, nextVal: number, unit: string, decimals = 0) =>
        `${curPct.toFixed(0)}% (${curVal.toFixed(decimals)} ${unit}) ${arrow} ${nextPct.toFixed(0)}% (${nextVal.toFixed(decimals)} ${unit})`;
    switch (id) {
        case 'attackSpeed': {
            const cur = player.attackSpeed ?? base.attackSpeed;
            const next = cur + base.attackSpeed * v / 100;
            return note(pct(cur, base.attackSpeed), cur / FIRE_INTERVAL_BASE, pct(next, base.attackSpeed), next / FIRE_INTERVAL_BASE, 'shots/s', 2);
        }
        case 'moveSpeed': {
            const cur = player.speed ?? base.speed;
            const next = cur + base.speed * v / 100;
            return note(pct(cur, base.speed), cur, pct(next, base.speed), next, 'px/s');
        }
        case 'projSpeed': {
            const cur = player.projectileSpeed ?? base.projectileSpeed;
            const next = cur + base.projectileSpeed * v / 100;
            return note(pct(cur, base.projectileSpeed), cur, pct(next, base.projectileSpeed), next, 'px/s');
        }
        case 'projLifeSpan': {
            const curMult = player.projLifeSpanMult ?? 1;
            return note(curMult * 100, PROJECTILE_BASE_LIFE * curMult, (curMult * 100) + v, PROJECTILE_BASE_LIFE * (curMult + v / 100), 's', 2);
        }
        case 'pickupRange': {
            const cur = player.pickupRange ?? base.pickupRange;
            const next = cur + base.pickupRange * v / 100;
            return note(pct(cur, base.pickupRange), cur, pct(next, base.pickupRange), next, 'px');
        }
        case 'auraRadius': {
            const curPct = player.auraRadiusPct ?? 100;
            const r = POWERS_VALUES.AURA_BASE_RADIUS;
            return note(curPct, r * curPct / 100, curPct + v, r * (curPct + v) / 100, 'px');
        }
        default:
            return '';
    }
}
