import { Game } from './game';
import { META_TREE_LABELS, buildStartStats, canPurchaseMeta, isMetaUpgradeUnlocked, loadMeta, purchaseMeta, saveMeta, resetMeta, visibleMetaUpgrades } from './meta';
import { updateRefundButton, handleRefundClick } from './ui/metaRefund';
import { buildMetaStats } from './ui/metaStats';
import { confirmAction } from './ui/confirm';
import { getAudioSettings, setMasterVolume, setMuted } from './audio';
import { openDebugTestPanel } from './ui/debugTest';
import { wireDevOptions } from './ui/debugOptions';
import { getActivePad, markControllerInput, readGamepadDirections, setupPointerInputRestore } from './game/input';
import { PLAYER_SHIPS, getPlayerShip, loadPlayerShipId, savePlayerShipId, type PlayerShipId } from './playerShips';
import { getGameplaySettings, setMouseMovementEnabled } from './settings';
import type { MetaUpgradeDef } from './types';

let currentGame: Game | null = null;
const meta = loadMeta();
const DEBUG_PANEL_KEY = 'voidsurvivor_debug_panel_enabled';
let debugPanelEnabled = loadDebugPanelEnabled();
let selectedPlayerShipId = loadPlayerShipId();
const META_MAP_WIDTH = 1320;
const META_MAP_HEIGHT = 760;
const META_NODE_LAYOUT: Record<string, { x: number; y: number }> = {
    meta_root_damage: { x: 620, y: 350 },
    meta_bolt_damage: { x: 330, y: 245 },
    meta_bolt_speed: { x: 330, y: 455 },
    meta_attack_speed: { x: 115, y: 245 },
    meta_move_speed: { x: 910, y: 245 },
    meta_pickup_range: { x: 910, y: 455 },
    meta_max_health: { x: 1125, y: 245 },
    meta_magic_aura_unlock: { x: 515, y: 115 },
    meta_magic_aura_radius: { x: 360, y: 55 },
    meta_magic_orbs_unlock: { x: 725, y: 115 },
    meta_magic_orbs_damage: { x: 890, y: 55 },
    meta_magic_orbs_speed: { x: 1045, y: 115 },
};
const META_NODE_ICONS: Record<string, string> = {
    meta_root_damage: '<path d="M12 3 5 14h6l-2 7 8-12h-6l1-6Z"/>',
    meta_bolt_damage: '<path d="m7 4 10 8-10 8v-5l5-3-5-3V4Z"/>',
    meta_bolt_speed: '<path d="M4 7h8l-3-3m3 13H4l3 3m4-8h9m-4-4 4 4-4 4"/>',
    meta_attack_speed: '<path d="M12 4a8 8 0 1 0 8 8"/><path d="M17 4h3v3"/><path d="m20 4-6 6"/><circle cx="12" cy="12" r="2"/>',
    meta_move_speed: '<path d="M4 12h13"/><path d="m13 6 6 6-6 6"/><path d="M4 7h5M4 17h5"/>',
    meta_pickup_range: '<path d="M7 5v7a5 5 0 0 0 10 0V5"/><path d="M7 5h4M13 5h4"/><path d="M7 12H4M20 12h-3"/>',
    meta_max_health: '<path d="M12 5v14M5 12h14"/><path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z"/>',
    meta_magic_aura_unlock: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
    meta_magic_aura_radius: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m12 3 2 2-2 2-2-2 2-2ZM12 17l2 2-2 2-2-2 2-2Z"/>',
    meta_magic_orbs_unlock: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="2"/><circle cx="19" cy="16" r="2"/><circle cx="5" cy="16" r="2"/><path d="M12 6v3M10 13l-3 2M14 13l3 2"/>',
    meta_magic_orbs_damage: '<circle cx="12" cy="12" r="3"/><circle cx="18" cy="8" r="2"/><circle cx="6" cy="16" r="2"/><path d="m14 10 5-5M16 5h3v3"/>',
    meta_magic_orbs_speed: '<circle cx="12" cy="12" r="3"/><path d="M4 12a8 8 0 0 1 13-6"/><path d="M17 3v3h-3"/><path d="M20 12a8 8 0 0 1-13 6"/><path d="M7 21v-3h3"/>',
};
let metaMapZoom = 1;
let metaMapPanX = 0;
let metaMapPanY = 0;

function renderMeta() {
    const list = document.getElementById('metaList');
    const shardsEl = document.getElementById('metaShards');
    if (shardsEl) shardsEl.textContent = `Shards: ${meta.shards}`;
    if (!list) return;
    list.innerHTML = '';
    const visibleDefs = visibleMetaUpgrades(meta);
    const toolbar = document.createElement('div');
    toolbar.className = 'meta-map-toolbar';
    toolbar.innerHTML = `<button type="button" data-zoom="out" title="Zoom out" aria-label="Zoom out">-</button><button type="button" data-zoom="reset" title="Reset view" aria-label="Reset view">Reset</button><button type="button" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button>`;
    list.appendChild(toolbar);

    const viewport = document.createElement('div');
    viewport.className = 'meta-map-viewport';
    const world = document.createElement('div');
    world.className = 'meta-map-world';
    world.style.width = `${META_MAP_WIDTH}px`;
    world.style.height = `${META_MAP_HEIGHT}px`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'meta-map-links');
    svg.setAttribute('viewBox', `0 0 ${META_MAP_WIDTH} ${META_MAP_HEIGHT}`);
    svg.setAttribute('aria-hidden', 'true');
    world.appendChild(svg);
    viewport.appendChild(world);
    list.appendChild(viewport);

    renderMetaConnections(svg, visibleDefs);
    for (const def of visibleDefs) world.appendChild(createMetaNode(def));
    wireMetaMapControls(list, viewport);
    applyMetaMapTransform();
    // Reapply focus after rerender (e.g., purchase)
    applyMetaFocus();
    // Update refund button state
    updateRefundButton(meta, document.getElementById('btnRefundMeta') as HTMLButtonElement | null);
}

function createMetaNode(def: MetaUpgradeDef): HTMLDivElement {
    const lvl = meta.purchased[def.id] || 0;
    const maxed = lvl >= def.maxLevel;
    const unlocked = isMetaUpgradeUnlocked(meta, def);
    const cost = def.cost(lvl);
    const purchasable = canPurchaseMeta(meta, def);
    const div = document.createElement('div');
    const pos = META_NODE_LAYOUT[def.id] ?? { x: META_MAP_WIDTH / 2, y: META_MAP_HEIGHT / 2 };
    div.dataset.metaId = def.id;
    div.className = `meta-upgrade meta-upgrade-${def.tree}` + (maxed ? ' maxed' : '') + (!unlocked ? ' locked' : '');
    div.style.left = `${pos.x}px`;
    div.style.top = `${pos.y}px`;
    const costClasses = ['cost'];
    if (!maxed && unlocked && meta.shards < cost) costClasses.push('insufficient');
    const costText = maxed ? 'Complete' : (unlocked ? String(cost) : 'Locked');
    const treeLabel = META_TREE_LABELS[def.tree];
    div.setAttribute('aria-label', `${def.name}. ${def.description} Level ${lvl} of ${def.maxLevel}. Cost ${costText}.`);
    div.innerHTML = `
        <span class="meta-node-core" aria-hidden="true">
            <svg class="meta-node-icon" viewBox="0 0 24 24">${META_NODE_ICONS[def.id] ?? META_NODE_ICONS.meta_root_damage}</svg>
            <span class="meta-node-level">${lvl}/${def.maxLevel}</span>
        </span>
        <span class="meta-node-details">
            <span class="meta-node-tree">${treeLabel}</span>
            <span class="meta-node-name">${def.name}</span>
            <span class="meta-node-description">${def.description}</span>
            <span class='meta-cost-line'><span>Cost</span><span class='${costClasses.join(' ')}'>${costText}</span></span>
        </span>`;
    if (!maxed) {
        div.setAttribute('role', 'button');
        div.tabIndex = 0;
        div.setAttribute('aria-disabled', purchasable ? 'false' : 'true');
        const attemptPurchase = () => {
            if (!purchasable) { div.classList.add('deny'); setTimeout(() => div.classList.remove('deny'), 400); return; }
            if (purchaseMeta(meta, def.id)) { renderMeta(); }
        };
        div.onclick = attemptPurchase;
        div.onkeydown = (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            attemptPurchase();
        };
    }
    div.onmouseenter = () => {
        // sync focus index to hovered node for smooth mouse->controller handoff
        const cards = getMetaCards();
        const idx = cards.indexOf(div);
        if (idx >= 0) { metaFocusIndex = idx; applyMetaFocus(); }
    };
    return div;
}

function renderMetaConnections(svg: SVGSVGElement, visibleDefs: ReturnType<typeof visibleMetaUpgrades>) {
    const visibleIds = new Set(visibleDefs.map(def => def.id));
    for (const def of visibleDefs) {
        for (const requiredId of def.requires ?? []) {
            if (!visibleIds.has(requiredId)) continue;
            const from = META_NODE_LAYOUT[requiredId];
            const to = META_NODE_LAYOUT[def.id];
            if (!from || !to) continue;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const midX = (from.x + to.x) / 2;
            path.setAttribute('d', `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`);
            path.setAttribute('class', (meta.purchased[requiredId] ?? 0) > 0 ? 'meta-link meta-link-active' : 'meta-link');
            svg.appendChild(path);
        }
    }
}

function wireMetaMapControls(root: HTMLElement, viewport: HTMLElement) {
    root.querySelector('[data-zoom="out"]')?.addEventListener('click', () => setMetaMapZoom(metaMapZoom - 0.15));
    root.querySelector('[data-zoom="in"]')?.addEventListener('click', () => setMetaMapZoom(metaMapZoom + 0.15));
    root.querySelector('[data-zoom="reset"]')?.addEventListener('click', () => {
        metaMapZoom = 1;
        metaMapPanX = 0;
        metaMapPanY = 0;
        applyMetaMapTransform();
    });
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const focalX = e.clientX - rect.left - rect.width / 2;
        const focalY = e.clientY - rect.top - rect.height / 2;
        setMetaMapZoom(metaMapZoom + (e.deltaY > 0 ? -0.08 : 0.08), focalX, focalY);
    }, { passive: false });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    viewport.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('.meta-upgrade')) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add('panning');
    });
    viewport.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        metaMapPanX += e.clientX - lastX;
        metaMapPanY += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        applyMetaMapTransform();
    });
    const stopDrag = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        viewport.releasePointerCapture(e.pointerId);
        viewport.classList.remove('panning');
    };
    viewport.addEventListener('pointerup', stopDrag);
    viewport.addEventListener('pointercancel', stopDrag);
}

function setMetaMapZoom(nextZoom: number, focalX = 0, focalY = 0) {
    const clamped = Math.max(0.55, Math.min(1.65, nextZoom));
    // Keep the world point under the focal point fixed while scaling.
    const ratio = clamped / metaMapZoom;
    metaMapPanX = focalX - (focalX - metaMapPanX) * ratio;
    metaMapPanY = focalY - (focalY - metaMapPanY) * ratio;
    metaMapZoom = clamped;
    applyMetaMapTransform();
}

function applyMetaMapTransform() {
    const world = document.querySelector('.meta-map-world') as HTMLElement | null;
    if (!world) return;
    world.style.transform = `translate(${metaMapPanX}px, ${metaMapPanY}px) scale(${metaMapZoom})`;
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
    const current = cards[metaFocusIndex] ?? cards[0];
    const currentPos = META_NODE_LAYOUT[current.dataset.metaId ?? ''];
    if (!currentPos) return;
    let bestIndex = metaFocusIndex;
    let bestScore = Infinity;
    cards.forEach((card, index) => {
        if (index === metaFocusIndex) return;
        const pos = META_NODE_LAYOUT[card.dataset.metaId ?? ''];
        if (!pos) return;
        const deltaX = pos.x - currentPos.x;
        const deltaY = pos.y - currentPos.y;
        const primaryDelta = dx !== 0 ? deltaX * dx : deltaY * dy;
        if (primaryDelta <= 8) return;
        const crossDelta = dx !== 0 ? Math.abs(deltaY) : Math.abs(deltaX);
        const score = primaryDelta + crossDelta * 1.7;
        if (score < bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    });
    metaFocusIndex = bestIndex;
    applyMetaFocus();
    ensureMetaVisible();
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
                card?.click(); e.preventDefault(); return;
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
                        card?.click();
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
