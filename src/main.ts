import { Game } from './game';
import { META_UPGRADES, buildStartStats, loadMeta, purchaseMeta, saveMeta, resetMeta } from './meta';
import { updateRefundButton, handleRefundClick } from './ui/metaRefund';
import { buildMetaStats } from './ui/metaStats';
import { confirmAction } from './ui/confirm';
import { getAudioSettings, setMasterVolume, setMuted } from './audio';
import { UPGRADES } from './upgrades';
import { renderUpgradeCard } from './ui/upgradeCard';
import { RARITIES, RARITY_ORDER, cardMinRarity, type Rarity } from './constants/rarity';
import { getActivePad } from './game/input';
import type { Entity } from './types';

let currentGame: Game | null = null;
const meta = loadMeta();
// Dev options wiring guard must be declared before wireDevOptions definition / use
let devOptionsWired = false;

function renderMeta() {
    const list = document.getElementById('metaList');
    const shardsEl = document.getElementById('metaShards');
    if (shardsEl) shardsEl.textContent = `Shards: ${meta.shards}`;
    if (!list) return;
    list.innerHTML = '';
    for (const def of META_UPGRADES) {
        const lvl = meta.purchased[def.id] || 0;
        const maxed = lvl >= def.maxLevel;
        const cost = def.cost(lvl);
        const div = document.createElement('div');
        div.className = 'meta-upgrade' + (maxed ? ' locked' : '');
        const affordable = meta.shards >= cost;
        const costClasses = ['cost'];
        if (!maxed && !affordable) costClasses.push('insufficient');
        div.innerHTML = `<h3>${def.name} <span class='lvl'>${lvl}/${def.maxLevel}</span></h3><p>${def.description}</p><p style='margin:6px 0 26px;'>Cost: <span class='${costClasses.join(' ')}'>${maxed ? '-' : cost}</span></p>`;
        if (!maxed) {
            const btn = document.createElement('button');
            btn.textContent = 'Buy';
            const affordable = meta.shards >= cost;
            btn.disabled = !affordable;
            if (btn.disabled) btn.classList.add('disabled');
            btn.onclick = () => {
                if (!affordable) { div.classList.add('deny'); setTimeout(() => div.classList.remove('deny'), 400); return; }
                if (purchaseMeta(meta, def.id)) { renderMeta(); }
            };
            div.appendChild(btn);
            // Allow clicking anywhere on card
            div.onclick = (e) => {
                if ((e.target as HTMLElement).tagName === 'BUTTON') return; // button handles own click
                if (btn.disabled) { div.classList.add('deny'); setTimeout(() => div.classList.remove('deny'), 400); return; }
                btn.click();
            };
        }
        div.onmouseenter = () => {
            // sync focus index to hovered card for smooth mouse->controller handoff
            const cards = getMetaCards();
            const idx = cards.indexOf(div);
            if (idx >= 0) { metaFocusIndex = idx; applyMetaFocus(); }
        };
        list.appendChild(div);
    }
    // Reapply focus after rerender (e.g., purchase)
    applyMetaFocus();
    // Update refund button state
    updateRefundButton(meta, document.getElementById('btnRefundMeta') as HTMLButtonElement | null);
}

function show(id: string) {
    const el = document.getElementById(id); if (el) el.style.display = 'flex';
    if (id === 'metaMenu') { metaFocusIndex = 0; applyMetaFocus(); }
}
function hide(id: string) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
    if (id === 'metaMenu') { getMetaCards().forEach(c => c.classList.remove('focused')); }
}
function setHudVisible(visible: boolean) {
    for (const id of ['topHud', 'shardsHud', 'hpHud']) {
        const el = document.getElementById(id);
        if (el) el.style.display = visible ? '' : 'none';
    }
}

function startRun() {
    hide('mainMenu'); hide('metaMenu');
    setHudVisible(true);
    const root = document.getElementById('app');
    if (!root) throw new Error('Missing #app element');
    if (currentGame) {
        currentGame.destroy();
        root.innerHTML = '';
        currentGame = null;
    }
    const startStats = buildStartStats(meta);
    currentGame = new Game(root, startStats, meta, onRunEnd);
}

function onRunEnd(result: { time: number; kills: number; shards: number; }) {
    meta.shards += result.shards;
    meta.stats.totalKills += result.kills;
    meta.stats.totalTime += result.time;
    meta.stats.runs += 1;
    meta.stats.bestTime = Math.max(meta.stats.bestTime, result.time);
    saveMeta(meta);
    // Do NOT auto-open main menu; Game Over screen handles offering Main Menu button.
}

function wireMenu() {
    const goMain = () => { show('mainMenu'); hide('metaMenu'); hide('instructionsMenu'); hide('settingsMenu'); hide('statsMenu'); hide('debugTestMenu'); };
    const closeSettings = () => {
        hide('settingsMenu');
        if (settingsReturnTarget === 'pause') {
            const pauseMenu = document.getElementById('pauseMenu');
            if (pauseMenu) pauseMenu.style.display = 'flex';
            settingsReturnTarget = 'main';
            return;
        }
        goMain();
    };
    document.getElementById('btnStart')?.addEventListener('click', startRun);
    document.getElementById('btnMeta')?.addEventListener('click', () => { renderMeta(); hide('mainMenu'); show('metaMenu'); });
    document.getElementById('btnStats')?.addEventListener('click', () => {
        updateStatsPanel();
        hide('mainMenu');
        show('statsMenu');
    });
    document.getElementById('btnDebugTest')?.addEventListener('click', () => {
        renderDebugTestPanel();
        hide('mainMenu');
        show('debugTestMenu');
    });
    document.getElementById('btnBackMeta')?.addEventListener('click', () => { hide('metaMenu'); show('mainMenu'); });
    document.getElementById('btnBackStats')?.addEventListener('click', goMain);
    document.getElementById('btnBackDebugTest')?.addEventListener('click', goMain);
    document.getElementById('btnInstructions')?.addEventListener('click', () => { hide('mainMenu'); show('instructionsMenu'); });
    document.getElementById('btnBackInstructions')?.addEventListener('click', goMain);
    document.getElementById('btnSettings')?.addEventListener('click', () => { settingsReturnTarget = 'main'; hide('mainMenu'); show('settingsMenu'); });
    document.getElementById('btnBackSettings')?.addEventListener('click', closeSettings);
    document.getElementById('btnResetMeta')?.addEventListener('click', async () => {
        const ok = await confirmAction('Reset ALL progress (meta + stats)?\nThis cannot be undone.', { acceptText: 'Reset', cancelText: 'Cancel' });
        if (ok) {
            resetMeta(meta);
            renderMeta();
            try { alert('Progress reset.'); } catch { }
        }
    });
    document.getElementById('btnRefundMeta')?.addEventListener('click', async () => {
        const shardsEl = document.getElementById('metaShards');
        const refundBtn = document.getElementById('btnRefundMeta') as HTMLButtonElement | null;
        const spentBefore = (refundBtn && refundBtn.disabled) ? 0 : undefined;
        const ok = await confirmAction('Refund ALL purchased meta upgrades?\nYou will get every spent shard back.', { acceptText: 'Refund', cancelText: 'Cancel' });
        if (!ok) return;
        const refunded = handleRefundClick(meta, shardsEl, refundBtn, () => true, msg => console.info('[meta] alertMock', msg));
        if (refunded) { renderMeta(); }
    });
    // Debug helper: window.__refundAllMeta()
    (window as any).__refundAllMeta = () => {
        const shardsEl = document.getElementById('metaShards');
        const refundBtn = document.getElementById('btnRefundMeta') as HTMLButtonElement | null;
        return handleRefundClick(meta, shardsEl, refundBtn, () => true, msg => console.info('[meta] alertMock', msg));
    };
    try { console.info('[meta] Refund wiring complete', { btn: !!document.getElementById('btnRefundMeta') }); } catch { }
    wireAudioSettings();
    window.addEventListener('voidsurvivor-open-settings', () => {
        settingsReturnTarget = 'pause';
        hide('mainMenu'); hide('metaMenu'); hide('instructionsMenu'); hide('statsMenu'); hide('debugTestMenu');
        show('settingsMenu');
    });
}

const MAX_DEBUG_LEVEL = 15;
let debugFiltersReady = false;

function setupDebugFilters() {
    const cardSel = document.getElementById('debugFilterCard') as HTMLSelectElement | null;
    const raritySel = document.getElementById('debugFilterRarity') as HTMLSelectElement | null;
    const minSel = document.getElementById('debugFilterMinLevel') as HTMLSelectElement | null;
    const maxSel = document.getElementById('debugFilterMaxLevel') as HTMLSelectElement | null;
    if (!cardSel || !raritySel || !minSel || !maxSel || debugFiltersReady) return;
    debugFiltersReady = true;
    const opt = (v: string, l: string) => { const o = document.createElement('option'); o.value = v; o.textContent = l; return o; };
    cardSel.appendChild(opt('all', 'All cards'));
    for (const u of UPGRADES) cardSel.appendChild(opt(u.id, u.name));
    raritySel.appendChild(opt('all', 'All rarities'));
    for (const r of RARITIES) raritySel.appendChild(opt(r, r));
    for (let i = 0; i <= MAX_DEBUG_LEVEL; i++) {
        minSel.appendChild(opt(String(i), i === 0 ? '0 (fresh)' : String(i)));
        maxSel.appendChild(opt(String(i), i === 0 ? '0 (fresh)' : String(i)));
    }
    for (const s of [cardSel, raritySel, minSel, maxSel]) s.addEventListener('change', renderDebugTestPanel);
}

function makeDebugPlayer(base: ReturnType<typeof buildStartStats>): Entity {
    return {
        id: 0, x: 0, y: 0, vx: 0, vy: 0, radius: 14, kind: 'player',
        hp: base.hp, maxHp: base.maxHp, damage: base.damage, speed: base.speed,
        attackSpeed: base.attackSpeed, projectileSpeed: base.projectileSpeed,
        pickupRange: base.pickupRange, regen: base.regen, xpGain: base.xpGain,
    };
}

function renderDebugTestPanel() {
    setupDebugFilters();
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
        const minOrder = RARITY_ORDER[cardMinRarity(upgrade.id)];
        for (const rarity of RARITIES) {
            if (RARITY_ORDER[rarity] < minOrder) continue;
            if (rarityFilter !== 'all' && rarity !== rarityFilter) continue;
            for (let level = minLevel; level <= maxLevel; level++) {
                addDebugCard(root, upgrade, base, rarity, level);
            }
        }
    }
}

function addDebugCard(root: HTMLElement, upgrade: (typeof UPGRADES)[number], base: ReturnType<typeof buildStartStats>, rarity: Rarity, level: number) {
    // Simulate `level` prior picks at this rarity so the preview's "from" value is realistic.
    const player = makeDebugPlayer(base);
    const tmpGs = { entities: new Map([[0, player]]), playerId: 0 } as any;
    for (let i = 0; i < level; i++) upgrade.apply(tmpGs, rarity);

    const wrap = document.createElement('div');
    wrap.className = 'debug-card-preview';
    const title = document.createElement('div');
    title.className = 'debug-card-label';
    title.textContent = `${upgrade.name} · ${rarity}${level ? ` · L${level}` : ''}`;
    const card = renderUpgradeCard(upgrade, { player, base, rarity, increments: level });
    card.classList.add('debugPreviewCard');
    wrap.appendChild(title);
    wrap.appendChild(card);
    root.appendChild(wrap);
}

function wireAudioSettings() {
    const muteBtn = document.getElementById('btnMuteAudio') as HTMLButtonElement | null;
    const volumeRange = document.getElementById('audioVolume') as HTMLInputElement | null;
    const volumeValue = document.getElementById('audioVolumeValue');
    if (!muteBtn || !volumeRange || !volumeValue) return;
    const render = () => {
        const audio = getAudioSettings();
        muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute';
        muteBtn.setAttribute('aria-pressed', audio.muted ? 'true' : 'false');
        volumeRange.value = String(Math.round(audio.volume * 100));
        volumeValue.textContent = `${Math.round(audio.volume * 100)}%`;
    };
    muteBtn.addEventListener('click', () => {
        setMuted(!getAudioSettings().muted);
        render();
    });
    volumeRange.addEventListener('input', () => {
        setMasterVolume(Number(volumeRange.value) / 100);
        if (getAudioSettings().volume > 0 && getAudioSettings().muted) setMuted(false);
        render();
    });
    render();
}

// Menu navigation (keyboard + controller)
let menuButtons: HTMLButtonElement[] = [];
let menuIndex = 0;
let lastMenuInput: 'keyboard' | 'gamepad' = 'keyboard';
let settingsReturnTarget: 'main' | 'pause' = 'main';
// Meta upgrade grid navigation state
let metaFocusIndex = 0;
function getMetaCards(): HTMLElement[] {
    const list = document.getElementById('metaList');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.meta-upgrade')) as HTMLElement[];
}
function applyMetaFocus() {
    const cards = getMetaCards();
    cards.forEach((c, i) => { if (i === metaFocusIndex) c.classList.add('focused'); else c.classList.remove('focused'); });
}
function moveMetaFocus(dx: number, dy: number) {
    const cards = getMetaCards(); if (!cards.length) return;
    const cols = Math.max(1, Math.floor((document.getElementById('metaList')!.clientWidth) / 280));
    const rows = Math.ceil(cards.length / cols);
    let row = Math.floor(metaFocusIndex / cols); let col = metaFocusIndex % cols;
    col = Math.min(cols - 1, Math.max(0, col + dx));
    row = Math.min(rows - 1, Math.max(0, row + dy));
    let newIndex = row * cols + col;
    if (newIndex >= cards.length) newIndex = cards.length - 1;
    metaFocusIndex = newIndex; applyMetaFocus(); ensureMetaVisible();
}
function ensureMetaVisible() {
    const cards = getMetaCards(); const card = cards[metaFocusIndex]; if (!card) return;
    card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function collectVisibleMenuButtons() {
    menuButtons = [];
    const menus = ['mainMenu', 'metaMenu', 'instructionsMenu', 'settingsMenu', 'statsMenu', 'debugTestMenu'];
    for (const id of menus) {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none') {
            const btns = (Array.from(el.querySelectorAll('button')) as HTMLButtonElement[])
                .filter(btn => !btn.classList.contains('debugPreviewCard'));
            menuButtons.push(...btns);
        }
    }
    menuButtons.forEach(b => b.classList.remove('focused'));
    if (menuButtons.length) {
        menuIndex = Math.max(0, Math.min(menuIndex, menuButtons.length - 1));
        menuButtons[menuIndex].classList.add('focused');
    }
}

function moveMenuFocus(delta: number) {
    if (!menuButtons.length) return;
    menuButtons[menuIndex].classList.remove('focused');
    menuIndex = (menuIndex + delta + menuButtons.length) % menuButtons.length;
    menuButtons[menuIndex].classList.add('focused');
}

function activateFocused() { if (menuButtons[menuIndex]) menuButtons[menuIndex].click(); }

function setupMenuInput() {
    const keyHandler = (e: KeyboardEvent) => {
        lastMenuInput = 'keyboard';
        // Meta grid navigation overrides while meta menu visible
        const metaVisible = document.getElementById('metaMenu')?.style.display !== 'none';
        if (metaVisible) {
            if (['ArrowLeft', 'KeyA'].includes(e.code)) { moveMetaFocus(-1, 0); e.preventDefault(); return; }
            if (['ArrowRight', 'KeyD'].includes(e.code)) { moveMetaFocus(1, 0); e.preventDefault(); return; }
            if (['ArrowUp', 'KeyW'].includes(e.code)) { moveMetaFocus(0, -1); e.preventDefault(); return; }
            if (['ArrowDown', 'KeyS'].includes(e.code)) { moveMetaFocus(0, 1); e.preventDefault(); return; }
            if (['Enter', 'Space'].includes(e.code)) {
                const card = getMetaCards()[metaFocusIndex];
                const buy = card?.querySelector('button:not(.back-btn)') as HTMLButtonElement | null;
                buy?.click(); e.preventDefault(); return;
            }
            if (e.code === 'Escape') { document.getElementById('btnBackMeta')?.click(); return; }
        }
        const vertical = ['ArrowUp', 'KeyW', 'KeyS', 'ArrowDown'];
        if (vertical.includes(e.code)) { e.preventDefault(); }
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': moveMenuFocus(-1); break;
            case 'ArrowDown': case 'KeyS': moveMenuFocus(1); break;
            case 'Enter': case 'Space': activateFocused(); break;
            case 'ArrowLeft': case 'KeyA': // treat left/right same as up/down for vertical lists
                moveMenuFocus(-1); break;
            case 'ArrowRight': case 'KeyD':
                moveMenuFocus(1); break;
        }
    };
    window.addEventListener('keydown', keyHandler);

    // Basic gamepad polling for menus (separate from in-run handled in Game)
    let lastButtons: boolean[] = [];
    let lastAxisV = 0;
    let lastAxisH = 0;
    const poll = () => {
        collectVisibleMenuButtons();
        const gp = getActivePad();
        if (gp) {
            const buttons = gp.buttons.map(b => b.pressed);
            const axV = gp.axes[1] || 0;
            const axH = gp.axes[0] || 0;
            const dead = 0.35;
            const vDir = Math.abs(axV) > dead ? (axV > 0 ? 1 : -1) : 0;
            const hDir = Math.abs(axH) > dead ? (axH > 0 ? 1 : -1) : 0;
            const axisUsed = vDir !== 0;
            const btnUsed = buttons.some((b, i) => b && [0, 12, 13, 14, 15].includes(i)) || hDir !== 0;
            if (axisUsed || btnUsed) lastMenuInput = 'gamepad';
            const metaVisible = document.getElementById('metaMenu')?.style.display !== 'none';
            if (lastMenuInput === 'gamepad') {
                if (metaVisible) {
                    const up = (buttons[12] && !lastButtons[12]) || (vDir === -1 && lastAxisV !== -1);
                    const down = (buttons[13] && !lastButtons[13]) || (vDir === 1 && lastAxisV !== 1);
                    const left = (buttons[14] && !lastButtons[14]) || (hDir === -1 && lastAxisH !== -1);
                    const right = (buttons[15] && !lastButtons[15]) || (hDir === 1 && lastAxisH !== 1);
                    if (left) moveMetaFocus(-1, 0);
                    if (right) moveMetaFocus(1, 0);
                    if (up) moveMetaFocus(0, -1);
                    if (down) moveMetaFocus(0, 1);
                    if (buttons[0] && !lastButtons[0]) {
                        const card = getMetaCards()[metaFocusIndex];
                        const buy = card?.querySelector('button:not(.back-btn)') as HTMLButtonElement | null;
                        buy?.click();
                    }
                    if (buttons[1] && !lastButtons[1]) { document.getElementById('btnBackMeta')?.click(); }
                } else {
                    // D-pad up/down 12/13 for vertical menus
                    const up = (buttons[12] && !lastButtons[12]) || (vDir === -1 && lastAxisV !== -1);
                    const down = (buttons[13] && !lastButtons[13]) || (vDir === 1 && lastAxisV !== 1);
                    if (up) moveMenuFocus(-1);
                    if (down) moveMenuFocus(1);
                    if (buttons[0] && !lastButtons[0]) activateFocused(); // A
                }
            }
            lastAxisV = vDir;
            lastAxisH = hDir;
            lastButtons = buttons;
        }
        requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
}

function bootstrap() {
    wireMenu();
    show('mainMenu');
    // Hide HUD until a run starts
    const hud = document.querySelector('.hud') as HTMLElement | null; if (hud) hud.style.display = 'none';
    collectVisibleMenuButtons();
    setupMenuInput();
    // Attempt to load debug module early (non-fatal if missing)
    wireDevOptions();
    // Listen for in-game restart requests (Game Over restart button)
    window.addEventListener('voidsurvivor-restart', () => {
        const root = document.getElementById('app');
        if (!root) return;
        if (currentGame) {
            currentGame.destroy();
            currentGame = null;
        }
        root.innerHTML = '';
        setHudVisible(true);
        const startStats = buildStartStats(meta);
        currentGame = new Game(root, startStats, meta, onRunEnd);
    });
    // Handle quitting mid-run from pause menu
    window.addEventListener('voidsurvivor-quit', () => {
        if (currentGame) {
            currentGame.destroy();
            currentGame = null;
        }
        const root = document.getElementById('app');
        if (root) root.innerHTML = '';
        // Show main menu (ensure others hidden)
        hide('metaMenu'); hide('instructionsMenu'); hide('settingsMenu');
        show('mainMenu');
        setHudVisible(false);
    });
}

function updateStatsPanel() {
    const el = document.getElementById('metaStatsContent');
    if (!el) return;
    el.textContent = buildMetaStats(meta).join('\n');
}

bootstrap();

// ---------------- Dev Options (env-controlled) ----------------
function wireDevOptions() {
    if (devOptionsWired) return; // idempotent guard
    const btnExport = document.getElementById('btnDebugExport') as HTMLButtonElement | null;
    const btnImport = document.getElementById('btnDebugImport') as HTMLButtonElement | null;
    const debugContainer = btnExport?.parentElement as HTMLElement | undefined;
    if (!btnExport || !btnImport || !debugContainer) return;
    const env = (import.meta as any).env || {};
    // Only allow official Vite-exposed variable
    devOptionsWired = env.VITE_DEV_OPTIONS === 'true';
    if (!devOptionsWired) return; // remain hidden (display:none inline)
    debugContainer.style.display = 'block';
    console.info('[dev] Developer options enabled');
    // Attach snapshot handlers lazily
    // Toast helper (scoped here for dev tools use)
    const pushToast = (msg: string, kind: 'info' | 'success' = 'info') => {
        const root = document.getElementById('toastRoot');
        if (!root) return;
        const el = document.createElement('div');
        el.className = `toast ${kind}`;
        el.textContent = msg;
        root.appendChild(el);
        setTimeout(() => el.remove(), 6600);
    };
    btnExport.addEventListener('click', async () => {
        try {
            const { buildSnapshot, downloadSnapshot } = await import('./save');
            let snap = currentGame ? buildSnapshot(currentGame) : { version: 1, timestamp: Date.now(), meta };
            if (snap) {
                downloadSnapshot(snap as any);
                pushToast('Snapshot exported', 'success');
            }
        } catch (e) {
            console.warn('Export failed', e);
            pushToast('Export failed', 'info');
        }
    });
    btnImport.addEventListener('click', async () => {
        try {
            const { promptLoadSnapshot, applySnapshot } = await import('./save');
            promptLoadSnapshot(snap => {
                if (currentGame) {
                    applySnapshot(currentGame!, snap as any);
                } else {
                    // Merge into global meta when no active run
                    meta.shards = Math.max(meta.shards, snap.meta.shards);
                    meta.purchased = { ...meta.purchased, ...snap.meta.purchased };
                    meta.stats.totalKills = Math.max(meta.stats.totalKills, snap.meta.stats.totalKills);
                    meta.stats.totalTime = Math.max(meta.stats.totalTime, snap.meta.stats.totalTime);
                    meta.stats.runs = Math.max(meta.stats.runs, snap.meta.stats.runs);
                    meta.stats.bestTime = Math.max(meta.stats.bestTime, snap.meta.stats.bestTime);
                    saveMeta(meta);
                    const shardsEl = document.getElementById('metaShards');
                    if (shardsEl) shardsEl.textContent = `Shards: ${meta.shards}`;
                    // If meta menu open, rerender to reflect new levels
                    const metaVisible = document.getElementById('metaMenu')?.style.display !== 'none';
                    if (metaVisible) renderMeta();
                    console.info('[dev] Meta snapshot imported without active run');
                }
                pushToast('Snapshot imported', 'success');
            });
        } catch (e) {
            console.warn('Import failed', e);
            pushToast('Import failed', 'info');
        }
    });
}
