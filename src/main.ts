import { Game } from './game';
import { META_UPGRADES, buildStartStats, loadMeta, purchaseMeta, saveMeta, resetMeta } from './meta';
import { updateRefundButton, handleRefundClick } from './ui/metaRefund';
import { buildMetaStats } from './ui/metaStats';
import { confirmAction } from './ui/confirm';
import { getAudioSettings, setMasterVolume, setMuted } from './audio';
import { openDebugTestPanel } from './ui/debugTest';
import { wireDevOptions } from './ui/debugOptions';
import { getActivePad, markControllerInput, readGamepadDirections, setupPointerInputRestore } from './game/input';
import { PLAYER_SHIPS, getPlayerShip, loadPlayerShipId, savePlayerShipId, type PlayerShipId } from './playerShips';
import { getGameplaySettings, setMouseMovementEnabled } from './settings';

let currentGame: Game | null = null;
const meta = loadMeta();
const DEBUG_PANEL_KEY = 'voidsurvivor_debug_panel_enabled';
let debugPanelEnabled = loadDebugPanelEnabled();
let selectedPlayerShipId = loadPlayerShipId();

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
    updateDebugRunPanel();
}

function loadDebugPanelEnabled(): boolean {
    try { return localStorage.getItem(DEBUG_PANEL_KEY) === 'true'; } catch { return false; }
}

function saveDebugPanelEnabled(enabled: boolean) {
    debugPanelEnabled = enabled;
    try { localStorage.setItem(DEBUG_PANEL_KEY, enabled ? 'true' : 'false'); } catch { }
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
    currentGame = new Game(root, startStats, meta, onRunEnd, getPlayerShip(selectedPlayerShipId));
    updateDebugRunPanel();
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
        hide('mainMenu');
        show('debugTestMenu');
        openDebugTestPanel(meta);
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
    wireGameplaySettings();
    wireShipSettings();
    wireDebugRunPanel();
    window.addEventListener('voidsurvivor-open-settings', () => {
        settingsReturnTarget = 'pause';
        hide('mainMenu'); hide('metaMenu'); hide('instructionsMenu'); hide('statsMenu'); hide('debugTestMenu');
        show('settingsMenu');
    });
    window.addEventListener('voidsurvivor-debug-state', updateDebugRunPanel);
}

function wireGameplaySettings() {
    const mouseToggle = document.getElementById('mouseMovementEnabled') as HTMLInputElement | null;
    if (!mouseToggle) return;
    const render = () => {
        mouseToggle.checked = getGameplaySettings().mouseMovementEnabled;
    };
    mouseToggle.addEventListener('change', () => {
        setMouseMovementEnabled(!!mouseToggle.checked);
        currentGame?.setMouseMovementEnabled(!!mouseToggle.checked);
        render();
    });
    render();
}

function wireShipSettings() {
    const select = document.getElementById('playerShipSelect') as HTMLSelectElement | null;
    const preview = document.getElementById('playerShipPreview') as HTMLElement | null;
    if (!select) return;
    select.innerHTML = '';
    for (const ship of PLAYER_SHIPS) {
        const opt = document.createElement('option');
        opt.value = ship.id;
        opt.textContent = ship.name;
        select.appendChild(opt);
    }
    const render = () => {
        const ship = getPlayerShip(selectedPlayerShipId);
        select.value = ship.id;
        if (preview) preview.style.setProperty('--ship-preview', `url("${ship.previewUrl}")`);
    };
    select.addEventListener('change', () => {
        selectedPlayerShipId = getPlayerShip(select.value).id as PlayerShipId;
        savePlayerShipId(selectedPlayerShipId);
        render();
        void currentGame?.setPlayerShip(getPlayerShip(selectedPlayerShipId));
    });
    render();
}

function updateDebugRunPanel() {
    const panel = document.getElementById('debugRunPanel') as HTMLElement | null;
    const inv = document.getElementById('debugInvulnerable') as HTMLInputElement | null;
    const fps = document.getElementById('debugFps');
    const toggle = document.getElementById('debugPanelEnabled') as HTMLInputElement | null;
    if (toggle) toggle.checked = debugPanelEnabled;
    if (!panel) return;
    const visible = debugPanelEnabled && !!currentGame && currentGame.isRunActive();
    panel.style.display = visible ? 'block' : 'none';
    if (inv) inv.checked = currentGame?.isDebugInvulnerable() ?? false;
    if (fps) fps.textContent = String(currentGame?.getFps() ?? 0);
}

function wireDebugRunPanel() {
    const toggle = document.getElementById('debugPanelEnabled') as HTMLInputElement | null;
    const inv = document.getElementById('debugInvulnerable') as HTMLInputElement | null;
    toggle?.addEventListener('change', () => {
        saveDebugPanelEnabled(!!toggle.checked);
        updateDebugRunPanel();
    });
    inv?.addEventListener('change', () => currentGame?.setDebugInvulnerable(!!inv.checked));
    document.getElementById('debugAddEnemy')?.addEventListener('click', () => currentGame?.debugAddEnemy());
    document.getElementById('debugAddBoss')?.addEventListener('click', () => currentGame?.debugAddBoss());
    document.getElementById('debugDamageDown')?.addEventListener('click', () => currentGame?.debugAdjustDamage(-5));
    document.getElementById('debugDamageUp')?.addEventListener('click', () => currentGame?.debugAdjustDamage(5));
    document.getElementById('debugAddRerolls')?.addEventListener('click', () => currentGame?.debugAddRerolls(5));
    document.getElementById('debugAddBans')?.addEventListener('click', () => currentGame?.debugAddBans(5));
    document.getElementById('debugLevelUp')?.addEventListener('click', () => currentGame?.debugLevelUp());
    updateDebugRunPanel();
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

function isAnyMenuVisible() {
    return ['mainMenu', 'metaMenu', 'instructionsMenu', 'settingsMenu', 'statsMenu', 'debugTestMenu']
        .some(id => document.getElementById(id)?.style.display !== 'none');
}

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
    const schedule = (active: boolean) => {
        if (active) requestAnimationFrame(poll);
        else window.setTimeout(poll, 250);
    };
    const poll = () => {
        if (!isAnyMenuVisible()) {
            schedule(false);
            return;
        }
        collectVisibleMenuButtons();
        const gp = getActivePad();
        if (gp) {
            const pad = readGamepadDirections(gp, 0.35);
            const buttons = pad.buttons;
            const vDir = pad.axV > 0 ? 1 : (pad.axV < 0 ? -1 : 0);
            const hDir = pad.axH > 0 ? 1 : (pad.axH < 0 ? -1 : 0);
            const axisUsed = vDir !== 0;
            const btnUsed = pad.anyButton || hDir !== 0;
            if (axisUsed || btnUsed) {
                lastMenuInput = 'gamepad';
                markControllerInput();
            }
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
            schedule(true);
        } else {
            lastButtons = [];
            lastAxisV = 0;
            lastAxisH = 0;
            schedule(false);
        }
    };
    schedule(false);
}

function bootstrap() {
    setupPointerInputRestore();
    wireMenu();
    show('mainMenu');
    // Hide HUD until a run starts
    const hud = document.querySelector('.hud') as HTMLElement | null; if (hud) hud.style.display = 'none';
    collectVisibleMenuButtons();
    setupMenuInput();
    // Attempt to load debug module early (non-fatal if missing)
    wireDevOptions({ getCurrentGame: () => currentGame, meta, saveMeta, renderMeta });
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
        currentGame = new Game(root, startStats, meta, onRunEnd, getPlayerShip(selectedPlayerShipId));
        updateDebugRunPanel();
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
        updateDebugRunPanel();
    });
}

function updateStatsPanel() {
    const el = document.getElementById('metaStatsContent');
    if (!el) return;
    el.textContent = buildMetaStats(meta).join('\n');
}

bootstrap();
