import { buildStartStats } from '../meta';
import { UPGRADES } from '../upgrades';
import { renderUpgradeCard } from './upgradeCard';
import { RARITIES, RARITY_ORDER, cardMinRarity, type CardId, type Rarity } from '../constants/cards';
import { getActivePad, readGamepadDirections } from '../game/input';
import type { Entity, MetaSave } from '../types';

const MAX_DEBUG_LEVEL = 50;
const DEFAULT_DEBUG_MAX_LEVEL = 3;

let filtersReady = false;
let tabsReady = false;
let activeTab: 'cards' | 'controller' = 'cards';
let controllerRaf = 0;

function escapeHtml(value: unknown): string {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function kv(rows: Array<[string, unknown]>): string {
    return rows
        .map(([key, value]) => `<div class="key">${escapeHtml(key)}</div><div class="value">${escapeHtml(value)}</div>`)
        .join('');
}

function renderAxis(index: number, value: number): string {
    const clamped = Math.max(-1, Math.min(1, value));
    const width = Math.abs(clamped) * 50;
    const left = clamped < 0 ? 50 - width : 50;
    return `<div class="debug-axis"><span>${index}</span><span class="debug-axis-bar"><span class="debug-axis-fill" style="left:${left}%;width:${width}%;"></span></span><span>${value.toFixed(3)}</span></div>`;
}

function renderButton(index: number, button: GamepadButton): string {
    const pressed = button.pressed || button.value > 0.5;
    return `<div class="debug-button${pressed ? ' pressed' : ''}">${index}: ${button.value.toFixed(2)}</div>`;
}

function renderControllerDebug() {
    if (activeTab !== 'controller' || document.getElementById('debugTestMenu')?.style.display === 'none') return;
    const status = document.getElementById('debugControllerStatus');
    const info = document.getElementById('debugControllerInfo');
    const normalized = document.getElementById('debugControllerNormalized');
    const axes = document.getElementById('debugControllerAxes');
    const buttons = document.getElementById('debugControllerButtons');
    if (!status || !info || !normalized || !axes || !buttons) return;

    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const active = getActivePad();
    const activeIndex = active ? pads.findIndex(p => p === active) : -1;
    const connected = pads
        .map((pad, index) => pad ? `${index}: ${pad.id || '(unnamed)'} [${pad.mapping || 'non-standard'}]` : '')
        .filter(Boolean);

    if (!active) {
        status.textContent = 'No controller detected. Press a button or move a stick to let the browser expose it.';
        info.innerHTML = kv([['connected pads', connected.length ? connected.join(' | ') : 'none']]);
        normalized.innerHTML = kv([['left', false], ['right', false], ['up', false], ['down', false]]);
        axes.innerHTML = '';
        buttons.innerHTML = '';
        return;
    }

    const pad = readGamepadDirections(active, 0.30);
    const pressed = pad.buttons.map((isPressed, index) => isPressed ? index : -1).filter(index => index >= 0);
    status.textContent = `Active controller index ${activeIndex}`;
    info.innerHTML = kv([
        ['id', active.id || '(empty)'],
        ['mapping', active.mapping || '(non-standard)'],
        ['index', activeIndex],
        ['connected', active.connected],
        ['timestamp', Math.round(active.timestamp)],
        ['axes count', active.axes.length],
        ['buttons count', active.buttons.length],
        ['all pads', connected.join(' | ')],
    ]);
    normalized.innerHTML = kv([
        ['left', pad.left],
        ['right', pad.right],
        ['up', pad.up],
        ['down', pad.down],
        ['axH', pad.axH.toFixed(3)],
        ['axV', pad.axV.toFixed(3)],
        ['pressed', pressed.length ? pressed.join(', ') : 'none'],
    ]);
    axes.innerHTML = active.axes.map((value, index) => renderAxis(index, value)).join('');
    buttons.innerHTML = Array.from(active.buttons).map((button, index) => renderButton(index, button)).join('');
}

function startControllerLoop() {
    if (controllerRaf) return;
    const tick = () => {
        controllerRaf = 0;
        renderControllerDebug();
        if (activeTab === 'controller' && document.getElementById('debugTestMenu')?.style.display !== 'none') {
            controllerRaf = requestAnimationFrame(tick);
        }
    };
    controllerRaf = requestAnimationFrame(tick);
}

function setTab(tab: 'cards' | 'controller', meta: MetaSave) {
    activeTab = tab;
    const cardsTab = document.getElementById('debugTabPowerCards') as HTMLButtonElement | null;
    const controllerTab = document.getElementById('debugTabController') as HTMLButtonElement | null;
    const cardsPane = document.getElementById('debugPowerCardsPane') as HTMLDivElement | null;
    const controllerPane = document.getElementById('debugControllerPane') as HTMLDivElement | null;

    cardsTab?.classList.toggle('active', tab === 'cards');
    controllerTab?.classList.toggle('active', tab === 'controller');
    cardsTab?.setAttribute('aria-selected', tab === 'cards' ? 'true' : 'false');
    controllerTab?.setAttribute('aria-selected', tab === 'controller' ? 'true' : 'false');
    if (cardsPane) cardsPane.style.display = tab === 'cards' ? '' : 'none';
    if (controllerPane) controllerPane.style.display = tab === 'controller' ? '' : 'none';

    if (tab === 'cards') renderDebugTestPanel(meta);
    else startControllerLoop();
}

export function setupDebugTabs(meta: MetaSave) {
    if (tabsReady) return;
    tabsReady = true;
    document.getElementById('debugTabPowerCards')?.addEventListener('click', () => setTab('cards', meta));
    document.getElementById('debugTabController')?.addEventListener('click', () => setTab('controller', meta));
}

export function openDebugTestPanel(meta: MetaSave) {
    setupDebugTabs(meta);
    setTab(activeTab, meta);
}

function setupFilters(meta: MetaSave) {
    const cardSel = document.getElementById('debugFilterCard') as HTMLSelectElement | null;
    const raritySel = document.getElementById('debugFilterRarity') as HTMLSelectElement | null;
    const minSel = document.getElementById('debugFilterMinLevel') as HTMLSelectElement | null;
    const maxSel = document.getElementById('debugFilterMaxLevel') as HTMLSelectElement | null;
    if (!cardSel || !raritySel || !minSel || !maxSel || filtersReady) return;
    filtersReady = true;
    const opt = (v: string, l: string) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; };
    cardSel.appendChild(opt('all', 'All cards'));
    for (const u of UPGRADES) cardSel.appendChild(opt(u.id, u.name));
    raritySel.appendChild(opt('all', 'All rarities'));
    for (const r of RARITIES) raritySel.appendChild(opt(r, r));
    for (let i = 0; i <= MAX_DEBUG_LEVEL; i++) {
        minSel.appendChild(opt(String(i), i === 0 ? '0 (fresh)' : String(i)));
        maxSel.appendChild(opt(String(i), i === 0 ? '0 (fresh)' : String(i)));
    }
    maxSel.value = String(DEFAULT_DEBUG_MAX_LEVEL);
    for (const s of [cardSel, raritySel, minSel, maxSel]) s.addEventListener('change', () => renderDebugTestPanel(meta));
}

function makePlayer(base: ReturnType<typeof buildStartStats>): Entity {
    return {
        id: 0, x: 0, y: 0, vx: 0, vy: 0, radius: 14, kind: 'player',
        hp: base.hp, maxHp: base.maxHp, damage: base.damage, speed: base.speed,
        attackSpeed: base.attackSpeed, boltSpeed: base.boltSpeed,
        pickupRange: base.pickupRange, regen: base.regen, xpGain: base.xpGain,
    };
}

export function renderDebugTestPanel(meta: MetaSave) {
    setupFilters(meta);
    if (activeTab !== 'cards') return;
    const root = document.getElementById('debugPowerCards');
    if (!root) return;
    root.innerHTML = '';
    const base = buildStartStats(meta);
    const cardFilter = (document.getElementById('debugFilterCard') as HTMLSelectElement | null)?.value ?? 'all';
    const rarityFilter = (document.getElementById('debugFilterRarity') as HTMLSelectElement | null)?.value ?? 'all';
    const minLevel = parseInt((document.getElementById('debugFilterMinLevel') as HTMLSelectElement | null)?.value ?? '0', 10) || 0;
    const maxLevel = Math.max(minLevel, parseInt((document.getElementById('debugFilterMaxLevel') as HTMLSelectElement | null)?.value ?? '0', 10) || 0);

    for (const upgrade of UPGRADES) {
        if (cardFilter !== 'all' && upgrade.id !== cardFilter) continue;
        const minOrder = RARITY_ORDER[cardMinRarity(upgrade.id as CardId)];
        for (const rarity of RARITIES) {
            if (RARITY_ORDER[rarity] < minOrder) continue;
            if (rarityFilter !== 'all' && rarity !== rarityFilter) continue;
            for (let level = minLevel; level <= maxLevel; level++) {
                addCard(root, upgrade, base, rarity, level);
            }
        }
    }
}

function addCard(root: HTMLElement, upgrade: (typeof UPGRADES)[number], base: ReturnType<typeof buildStartStats>, rarity: Rarity, level: number) {
    const player = makePlayer(base);
    const tmpGs = { entities: new Map([[0, player]]), playerId: 0, startStats: base } as any;
    for (let i = 0; i < level; i++) upgrade.apply(tmpGs, rarity);

    const wrap = document.createElement('div');
    wrap.className = 'debug-card-preview';
    const title = document.createElement('div');
    title.className = 'debug-card-label';
    title.textContent = `${upgrade.name} · ${rarity} · L${level}`;
    const card = renderUpgradeCard(upgrade, { player, base, rarity, increments: level });
    card.classList.add('debugPreviewCard');
    wrap.appendChild(title);
    wrap.appendChild(card);
    root.appendChild(wrap);
}
