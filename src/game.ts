import * as PIXI from 'pixi.js';
import { Entity, GameState, OfferedUpgrade, PlayerStartStats, MetaSave } from './types';
import { playSound } from './audio';
import { UPGRADES, pickUpgradeOffers, applyUpgradeChoice } from './upgrades';
import { spawnMob, spawnElite, spawnXp, fireBolt, spawnParticle, spawnHitBurst, rollShardDrop, spawnShard } from './spawns';
import { randomRng } from './rng';
import { distSq } from './math';
import { createBackground } from './game/background';
import { formatRunTime, updateHud, updateStatsOverlay } from './game/hud';
import { createInputState, getActivePad, hasDirectionalInput, readGamepadDirections, setupKeyboard, setupGamepad } from './game/input';
import { FIRE_INTERVAL_BASE, POWERS_VALUES } from './constants/balance';
import { nextXpNeeded, spawnIntervalAt, auraDpsAt } from './balanceUtils';
import { createPlayerSpriteFromGrid, PlayerSprite } from './sprites/grid';
import { advanceChaserUntilContact, didMove, MOVE_ANIM_SPEED } from './movement';
import { renderUpgradeCard } from './ui/upgradeCard';
import type { PlayerShipDefinition } from './playerShips';
import { getMouseMovementEnabled } from './settings';

const Z_PLAYER = 40;
const RENDER_RESOLUTION = 1;
const HUD_UPDATE_INTERVAL = 1 / 12;
const STATS_UPDATE_INTERVAL = 0.25;

export class Game {
    app!: PIXI.Application;
    gs!: GameState;
    sprites: Map<number, PIXI.Container> = new Map();
    input = createInputState();
    upgradeModal = document.getElementById('upgradeModal') as HTMLDivElement | null;
    upgradeChoicesEl = document.getElementById('upgradeChoices') as HTMLDivElement | null;
    upgradeControlsEl: HTMLDivElement | null = null;
    healthBar = document.getElementById('hpBar') as HTMLDivElement | null;
    hpText = document.getElementById('hp') as HTMLSpanElement | null;
    hpMaxText = document.getElementById('hpMax') as HTMLSpanElement | null;
    // Controller selection index for upgrade cards
    private upgradeSelIndex: number = 0;
    private lastInputDevice: 'keyboard' | 'gamepad' = 'keyboard';
    private playerSprite?: PlayerSprite;
    // Top-down facing: radians, 0 = ship nose pointing +X (right). Sprite rotates to face movement.
    private playerFacing: number = 0;
    private targetFacing: number = 0;
    // Simplified animation state
    private wasMoving: boolean = false;
    private cleanupFns: Array<() => void> = [];
    private destroyed = false;
    private gameOverKeyCleanup?: () => void;
    private pauseKeyCleanup?: () => void;
    private debugInvulnerable = false;
    private playerShip: PlayerShipDefinition;
    private playerSpriteLoadToken = 0;
    private playerContainer?: PIXI.Container;
    private fallbackPlayerVisual?: PIXI.Container;
    private moveTargetMarker?: PIXI.Graphics;
    private lastDebugMetricAt = 0;
    private lastHudUpdateAt = -Infinity;
    private lastStatsOverlayAt = -Infinity;

    private endCb: (result: { time: number; kills: number; shards: number; }) => void;
    constructor(parent: HTMLElement, startStats: PlayerStartStats, meta: MetaSave, endCb: (result: { time: number; kills: number; shards: number; }) => void, playerShip: PlayerShipDefinition) {
        this.endCb = endCb;
        this.playerShip = playerShip;
        void this.init(parent, startStats, meta);
    }

    private async init(parent: HTMLElement, startStats: PlayerStartStats, meta: MetaSave) {
        this.app = new PIXI.Application();
        await this.app.init({
            resizeTo: parent,
            background: '#121416',
            antialias: false,
            autoDensity: true,
            resolution: RENDER_RESOLUTION,
            powerPreference: 'high-performance',
        });
        if (this.destroyed) {
            try { this.app.destroy(true); } catch { }
            return;
        }
        parent.appendChild(this.app.canvas);
        this.app.stage.sortableChildren = true;
        // Attach static background
        createBackground(this.app);

        this.gs = {
            time: 0,
            playerId: 0,
            entities: new Map(),
            nextEntityId: 1,
            spawnTimer: 0,
            boltTimer: 0,
            xp: 0,
            level: 1,
            xpNeeded: 5,
            kills: 0,
            rng: randomRng(12345),
            paused: false,
            // Full pool; per-card `requires` gates (e.g. orb upgrades need orbs first).
            upgradePool: [...UPGRADES],
            upgradeCounts: {},
            offeredUpgrades: [],
            rerolls: startStats.rerolls,
            bans: startStats.bans,
            rerollControlsEverAvailable: startStats.rerolls > 0,
            banControlsEverAvailable: startStats.bans > 0,
            banModeActive: false,
            runActive: true,
            startStats: startStats,
            meta: meta,
            runShards: 0,
            fps: 0
        };

        const player: Entity = {
            id: this.gs.playerId, x: 0, y: 0, vx: 0, vy: 0, radius: 14, kind: 'player',
            hp: startStats.hp, maxHp: startStats.maxHp, damage: startStats.damage, speed: startStats.speed,
            attackSpeed: startStats.attackSpeed, boltSpeed: startStats.boltSpeed, pickupRange: startStats.pickupRange, regen: startStats.regen, xpGain: startStats.xpGain
        };
        player.x = this.app.renderer.width / 2;
        player.y = this.app.renderer.height / 2;
        this.gs.entities.set(player.id, player);
        // Player base graphics container
        const playerG = new PIXI.Container();
        // Fallback vector visuals (used if sprite fails to load)
        const fallback = new PIXI.Container();
        const glow = new PIXI.Graphics(); glow.circle(0, 0, player.radius + 6).fill({ color: 0x46c96d, alpha: 0.08 });
        const core = new PIXI.Graphics(); core.circle(0, 0, player.radius - 2).fill({ color: 0x4caf50 });
        const ring = new PIXI.Graphics(); ring.circle(0, 0, player.radius).stroke({ color: 0x9dffc4, width: 2 });
        fallback.addChild(glow); fallback.addChild(core); fallback.addChild(ring);
        fallback.visible = false;
        playerG.addChild(fallback);
        this.playerContainer = playerG;
        this.fallbackPlayerVisual = fallback;
        // aura visual (updated in update loop based on level)
        const aura = new PIXI.Graphics();
        aura.alpha = 0.18;
        playerG.addChild(aura);
        player.auraG = aura;
        player.orbitG = new PIXI.Container();
        playerG.addChild(player.orbitG);
        playerG.zIndex = Z_PLAYER;
        playerG.x = player.x; playerG.y = player.y;
        this.app.stage.addChild(playerG);
        this.sprites.set(player.id, playerG);

        await this.setPlayerShip(this.playerShip);
        if (this.destroyed) return;

        this.setupInput();
        this.setupPointerMovement();
        this.setupUpgradeShortcuts();
        this.app.ticker.add(this.update);
    }

    async setPlayerShip(playerShip: PlayerShipDefinition) {
        this.playerShip = playerShip;
        if (!this.app || !this.playerContainer) return;
        const token = ++this.playerSpriteLoadToken;
        const tex: PIXI.Texture | null = await PIXI.Assets.load(playerShip.sheetUrl).catch(() => null);
        if (this.destroyed || token !== this.playerSpriteLoadToken) return;
        if (this.playerSprite) {
            this.playerSprite.view.parent?.removeChild(this.playerSprite.view);
            this.playerSprite = undefined;
        }
        if (!tex) {
            if (this.fallbackPlayerVisual) this.fallbackPlayerVisual.visible = true;
            return;
        }

        const sprite = createPlayerSpriteFromGrid(tex, playerShip.grid);
        sprite.view.scale.set(playerShip.scale);
        sprite.view.rotation = this.playerFacing;
        this.playerContainer.addChildAt(sprite.view, Math.min(1, this.playerContainer.children.length));
        this.playerSprite = sprite;
        if (this.fallbackPlayerVisual) this.fallbackPlayerVisual.visible = false;
    }

    setupUpgradeShortcuts() {
        const keydown = (e: KeyboardEvent) => {
            if (!this.gs?.paused || !this.gs.offeredUpgrades.length) return;
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < this.gs.offeredUpgrades.length) {
                this.selectUpgradeOffer(this.gs.offeredUpgrades[idx]);
            }
        };
        window.addEventListener('keydown', keydown);
        this.cleanupFns.push(() => window.removeEventListener('keydown', keydown));
    }

    private ensureUpgradeModalShell(): boolean {
        this.upgradeModal = document.getElementById('upgradeModal') as HTMLDivElement | null;
        if (!this.upgradeModal) return false;
        let choices = this.upgradeModal.querySelector('#upgradeChoices') as HTMLDivElement | null;
        let controls = this.upgradeModal.querySelector('#upgradeControls') as HTMLDivElement | null;
        if (!choices) {
            this.upgradeModal.innerHTML = `<div class="panel">
                <h2>Choose an Upgrade</h2>
                <div class="upgrades" id="upgradeChoices"></div>
                <div class="upgradeControls" id="upgradeControls"></div>
                <div class="footerHint">Press 1-3, Enter, A, or click</div>
            </div>`;
            choices = this.upgradeModal.querySelector('#upgradeChoices') as HTMLDivElement | null;
            controls = this.upgradeModal.querySelector('#upgradeControls') as HTMLDivElement | null;
        } else if (!controls) {
            controls = document.createElement('div');
            controls.className = 'upgradeControls';
            controls.id = 'upgradeControls';
            choices.insertAdjacentElement('afterend', controls);
        }
        this.upgradeChoicesEl = choices;
        this.upgradeControlsEl = controls;
        return !!this.upgradeChoicesEl;
    }

    showUpgradeChoices() {
        if (!this.ensureUpgradeModalShell() || !this.upgradeModal || !this.upgradeChoicesEl) return;
        this.gs.paused = true;
        this.gs.offeredUpgrades = this.pickUpgradeOffers(3);
        this.upgradeSelIndex = 0; // reset selection
        this.gs.banModeActive = false;
        this.renderUpgradeChoices();
        // Inject style for increment percentage if not present
        if (!document.getElementById('upgradeIncStyle')) {
            const st = document.createElement('style');
            st.id = 'upgradeIncStyle';
            st.textContent = `.incPct{color:#4caf50;font-weight:600;}`;
            document.head.appendChild(st);
        }
        this.upgradeModal.style.display = 'flex';
    }

    private renderUpgradeChoices() {
        if (!this.upgradeChoicesEl) return;
        this.upgradeChoicesEl.innerHTML = '';
        const player = this.gs.entities.get(this.gs.playerId)!;
        for (const offer of this.gs.offeredUpgrades) {
            const div = renderUpgradeCard(offer.def, {
                player,
                base: this.gs.startStats,
                rarity: offer.rarity,
                increments: this.gs.upgradeCounts[offer.def.id] || 0,
                onChoose: () => this.selectUpgradeOffer(offer),
            });
            this.upgradeChoicesEl.appendChild(div);
        }
        this.renderUpgradeControls();
        // Apply initial highlight for controller users
        this.upgradeSelIndex = Math.max(0, Math.min(this.gs.offeredUpgrades.length - 1, this.upgradeSelIndex));
        this.applyUpgradeSelectionHighlight();
    }

    private renderUpgradeControls() {
        if (!this.upgradeControlsEl) return;
        this.upgradeControlsEl.innerHTML = '';
        const showReroll = this.shouldShowRerollControl();
        const showBan = this.shouldShowBanControl();
        const rerolls = this.gs.rerolls ?? 0;
        const bans = this.gs.bans ?? 0;
        const isBanMode = !!this.gs.banModeActive;
        this.upgradeControlsEl.hidden = !showReroll && !showBan;
        this.upgradeChoicesEl?.classList.toggle('ban-mode', isBanMode);
        if (this.upgradeModal) this.upgradeModal.classList.toggle('ban-mode', isBanMode);

        if (showReroll) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'upgradeControlButton';
            btn.textContent = `Reroll (${rerolls})`;
            btn.disabled = rerolls <= 0;
            btn.title = rerolls > 0 ? 'Reroll all offered upgrades' : 'No rerolls left';
            btn.addEventListener('click', () => this.rerollUpgradeChoices());
            this.upgradeControlsEl.appendChild(btn);
        }

        if (showBan) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'upgradeControlButton banControlButton';
            if (isBanMode) btn.classList.add('active');
            btn.textContent = isBanMode ? `Choose Card to Ban (${bans})` : `Ban (${bans})`;
            btn.disabled = bans <= 0;
            btn.title = bans > 0 ? 'Activate ban mode, then click a card to ban it' : 'No bans left';
            btn.addEventListener('click', () => this.toggleBanMode());
            this.upgradeControlsEl.appendChild(btn);
        }
    }

    hideUpgradeChoices() {
        if (!this.upgradeModal) return;
        this.upgradeModal.style.display = 'none';
        this.gs.paused = false;
    }

    pickUpgradeOffers(count: number): OfferedUpgrade[] { return pickUpgradeOffers(this.gs, count); }

    private shouldShowRerollControl(): boolean {
        if ((this.gs.rerolls ?? 0) > 0) this.gs.rerollControlsEverAvailable = true;
        return !!this.gs.rerollControlsEverAvailable;
    }

    private shouldShowBanControl(): boolean {
        if ((this.gs.bans ?? 0) > 0) this.gs.banControlsEverAvailable = true;
        return !!this.gs.banControlsEverAvailable;
    }

    private rerollUpgradeChoices() {
        if ((this.gs.rerolls ?? 0) <= 0) return;
        this.gs.rerolls = Math.max(0, (this.gs.rerolls ?? 0) - 1);
        this.gs.rerollControlsEverAvailable = true;
        this.gs.banModeActive = false;
        this.gs.offeredUpgrades = this.pickUpgradeOffers(3);
        this.upgradeSelIndex = 0;
        this.renderUpgradeChoices();
    }

    private toggleBanMode() {
        if ((this.gs.bans ?? 0) <= 0) return;
        this.gs.banControlsEverAvailable = true;
        this.gs.banModeActive = !this.gs.banModeActive;
        this.renderUpgradeControls();
    }

    private selectUpgradeOffer(offer: OfferedUpgrade) {
        if (this.gs.banModeActive) {
            this.banUpgradeChoice(offer);
            return;
        }
        this.chooseUpgrade(offer);
    }

    private banUpgradeChoice(offer: OfferedUpgrade) {
        if ((this.gs.bans ?? 0) <= 0) return;
        const index = this.gs.offeredUpgrades.findIndex(item => item.def.id === offer.def.id);
        if (index < 0) return;
        this.gs.bans = Math.max(0, (this.gs.bans ?? 0) - 1);
        this.gs.banControlsEverAvailable = true;
        this.gs.banModeActive = false;
        this.gs.upgradePool = this.gs.upgradePool.filter(upgrade => upgrade.id !== offer.def.id);
        const replacement = this.pickReplacementOffer(offer.def.id);
        if (replacement) {
            this.gs.offeredUpgrades.splice(index, 1, replacement);
        } else {
            this.gs.offeredUpgrades.splice(index, 1);
        }
        this.upgradeSelIndex = Math.min(index, Math.max(0, this.gs.offeredUpgrades.length - 1));
        this.renderUpgradeChoices();
    }

    private pickReplacementOffer(bannedId: string): OfferedUpgrade | undefined {
        const excluded = new Set(this.gs.offeredUpgrades.map(offer => offer.def.id));
        excluded.delete(bannedId);
        const originalPool = this.gs.upgradePool;
        try {
            this.gs.upgradePool = originalPool.filter(upgrade => !excluded.has(upgrade.id));
            return this.pickUpgradeOffers(1)[0];
        } finally {
            this.gs.upgradePool = originalPool;
        }
    }

    chooseUpgrade(offer: OfferedUpgrade) {
        applyUpgradeChoice(this.gs, offer.def, offer.rarity);
        this.hideUpgradeChoices();
        if (this.gs.xp >= this.gs.xpNeeded) {
            this.levelUp();
        }
    }

    setupInput() {
        const lastInputRef = { v: this.lastInputDevice };
        this.cleanupFns.push(setupKeyboard(this.input, this.gs, {
            onPause: () => { if (this.upgradeModal && this.upgradeModal.style.display === 'flex') return; this.openPauseMenu(); },
            onResume: () => { const pm = document.getElementById('pauseMenu'); if (pm && pm.style.display === 'flex') this.closePauseMenu(); },
            toggleStats: () => { this.gs.statsVisible = !this.gs.statsVisible; updateStatsOverlay(this.gs); },
            onUpgradeNav: (dir) => { this.upgradeSelIndex = Math.max(0, Math.min(this.gs.offeredUpgrades.length - 1, this.upgradeSelIndex + dir)); this.applyUpgradeSelectionHighlight(); },
            onUpgradeConfirm: () => { const sel = this.gs.offeredUpgrades[this.upgradeSelIndex]; if (sel) this.selectUpgradeOffer(sel); },
            lastInputDeviceRef: lastInputRef
        }));
        this.cleanupFns.push(setupGamepad(this.input, this.gs, {
            onPause: () => { const pm = document.getElementById('pauseMenu'); if (pm && pm.style.display === 'flex') this.closePauseMenu(); else if (!this.gs.paused) this.openPauseMenu(); },
            toggleStats: () => { this.gs.statsVisible = !this.gs.statsVisible; updateStatsOverlay(this.gs); },
            onUpgradeNav: (dir) => { this.upgradeSelIndex = Math.max(0, Math.min(this.gs.offeredUpgrades.length - 1, this.upgradeSelIndex + dir)); this.applyUpgradeSelectionHighlight(); },
            onUpgradeConfirm: () => { const sel = this.gs.offeredUpgrades[this.upgradeSelIndex]; if (sel) this.selectUpgradeOffer(sel); },
            lastInputDeviceRef: lastInputRef
        }));
    }

    private setupPointerMovement() {
        const canvas = this.app.canvas;
        const pointFromEvent = (e: PointerEvent) => {
            if (!this.gs?.runActive || this.gs.paused) return;
            if (e.pointerType === 'mouse' && !getMouseMovementEnabled()) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const x = (e.clientX - rect.left) * (this.app.renderer.width / rect.width);
            const y = (e.clientY - rect.top) * (this.app.renderer.height / rect.height);
            return this.clampMovePoint(x, y);
        };
        const onPointerMove = (e: PointerEvent) => {
            const point = pointFromEvent(e);
            if (!point) return;
            this.input.cursorTarget = point;
        };
        const onPointerDown = (e: PointerEvent) => {
            const point = pointFromEvent(e);
            if (!point) return;
            this.input.cursorTarget = point;
            if (e.pointerType === 'mouse' && e.button === 2) {
                e.preventDefault();
                this.clearMoveTarget();
                return;
            }
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            this.setMoveTarget(point.x, point.y);
        };
        const onContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            this.clearMoveTarget();
        };
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('contextmenu', onContextMenu);
        this.cleanupFns.push(() => {
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('contextmenu', onContextMenu);
        });
    }

    private clampMovePoint(x: number, y: number) {
        const player = this.gs.entities.get(this.gs.playerId);
        if (!player) return { x, y };
        return {
            x: Math.max(player.radius, Math.min(this.app.renderer.width - player.radius, x)),
            y: Math.max(player.radius, Math.min(this.app.renderer.height - player.radius, y)),
        };
    }

    private setMoveTarget(x: number, y: number) {
        this.input.moveTarget = this.clampMovePoint(x, y);
        this.showMoveTargetMarker();
    }

    private clearMoveTarget() {
        this.input.moveTarget = undefined;
        if (this.moveTargetMarker) this.moveTargetMarker.visible = false;
    }

    setMouseMovementEnabled(enabled: boolean) {
        if (enabled) return;
        this.input.cursorTarget = undefined;
        this.clearMoveTarget();
    }

    private showMoveTargetMarker() {
        const target = this.input.moveTarget;
        if (!target) return;
        if (!this.moveTargetMarker) {
            const marker = new PIXI.Graphics();
            marker.zIndex = Z_PLAYER - 1;
            marker.circle(0, 0, 6).stroke({ color: 0x9dffc4, width: 1.5, alpha: 0.7 });
            marker.moveTo(-9, 0).lineTo(-4, 0).moveTo(4, 0).lineTo(9, 0)
                .moveTo(0, -9).lineTo(0, -4).moveTo(0, 4).lineTo(0, 9)
                .stroke({ color: 0x9dffc4, width: 1.5, alpha: 0.7 });
            this.moveTargetMarker = marker;
            this.app.stage.addChild(marker);
        }
        this.moveTargetMarker.visible = true;
        this.moveTargetMarker.x = target.x;
        this.moveTargetMarker.y = target.y;
    }


    openPauseMenu() {
        const pm = document.getElementById('pauseMenu');
        if (!pm) return;
        this.gs.paused = true;
        pm.style.display = 'flex';
        const resume = document.getElementById('btnResume');
        const settings = document.getElementById('btnPauseSettings');
        const quit = document.getElementById('btnQuit');
        // Remove old handlers if any by cloning (ensures multiple opens stay clean)
        if (resume) {
            const clone = resume.cloneNode(true) as HTMLButtonElement; resume.parentNode?.replaceChild(clone, resume);
            clone.addEventListener('click', () => this.closePauseMenu(), { once: true });
        }
        if (settings) {
            const cloneS = settings.cloneNode(true) as HTMLButtonElement; settings.parentNode?.replaceChild(cloneS, settings);
            cloneS.addEventListener('click', () => {
                pm.style.display = 'none';
                window.dispatchEvent(new CustomEvent('voidsurvivor-open-settings'));
            }, { once: true });
        }
        if (quit) {
            const cloneQ = quit.cloneNode(true) as HTMLButtonElement; quit.parentNode?.replaceChild(cloneQ, quit);
            cloneQ.addEventListener('click', () => {
                pm.style.display = 'none';
                const evt = new CustomEvent('voidsurvivor-quit');
                window.dispatchEvent(evt);
            }, { once: true });
        }
        const buttons = Array.from(pm.querySelectorAll('.pmBtn')) as HTMLButtonElement[];
        let pIndex = 0;
        const apply = () => buttons.forEach((b, i) => { if (i === pIndex) b.classList.add('focused'); else b.classList.remove('focused'); });
        apply();
        const keyHandler = (e: KeyboardEvent) => {
            if (pm.style.display !== 'flex') return;
            if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'Tab'].includes(e.code)) e.preventDefault();
            switch (e.code) {
                case 'ArrowUp': case 'KeyW': pIndex = (pIndex + buttons.length - 1) % buttons.length; apply(); break;
                case 'ArrowDown': case 'KeyS': pIndex = (pIndex + 1) % buttons.length; apply(); break;
                case 'Enter': case 'Space': buttons[pIndex].click(); break;
                case 'Escape': case 'KeyP': this.closePauseMenu(); break;
            }
        };
        this.pauseKeyCleanup?.();
        window.addEventListener('keydown', keyHandler);
        this.pauseKeyCleanup = () => {
            window.removeEventListener('keydown', keyHandler);
            this.pauseKeyCleanup = undefined;
        };
        // Lightweight gamepad nav for pause menu
        let lastButtons: boolean[] = [];
        let lastV = 0;
        const pollPause = () => {
            if (pm.style.display !== 'flex') return; // stop when closed
            const gp = getActivePad();
            if (gp) {
                const pad = readGamepadDirections(gp, 0.4);
                const buttonsGp = pad.buttons;
                const v = pad.axV > 0 ? 1 : (pad.axV < 0 ? -1 : 0);
                const up = (buttonsGp[12] && !lastButtons[12]) || (v === -1 && lastV !== -1);
                const down = (buttonsGp[13] && !lastButtons[13]) || (v === 1 && lastV !== 1);
                if (up) { pIndex = (pIndex + buttons.length - 1) % buttons.length; apply(); }
                if (down) { pIndex = (pIndex + 1) % buttons.length; apply(); }
                if (buttonsGp[0] && !lastButtons[0]) { buttons[pIndex].click(); }
                if (buttonsGp[1] && !lastButtons[1]) { this.closePauseMenu(); }
                lastButtons = buttonsGp; lastV = v;
            }
            requestAnimationFrame(pollPause);
        };
        requestAnimationFrame(pollPause);
    }

    closePauseMenu() {
        const pm = document.getElementById('pauseMenu');
        if (!pm) return;
        pm.style.display = 'none';
        this.pauseKeyCleanup?.();
        // only unpause if no other modal (upgrade or game over) is visible
        if (!(this.upgradeModal && this.upgradeModal.style.display === 'flex')) {
            this.gs.paused = false;
        }
    }

    private applyUpgradeSelectionHighlight() {
        if (!this.upgradeChoicesEl) return;
        const children = Array.from(this.upgradeChoicesEl.children) as HTMLElement[];
        children.forEach((c, i) => {
            if (i === this.upgradeSelIndex) c.classList.add('selected'); else c.classList.remove('selected');
        });
    }

    // spawning & bolt helpers now in spawns.ts
    spawnMob() { spawnMob(this.gs, { app: this.app, sprites: this.sprites }); }
    spawnXp(x: number, y: number, value: number, elite: boolean = false) { spawnXp(this.gs, { app: this.app, sprites: this.sprites }, x, y, value, elite); }
    fireBolt() { fireBolt(this.gs, { app: this.app, sprites: this.sprites }); }

    levelUp() {
        const previousNeeded = this.gs.xpNeeded;
        this.gs.level++;
        this.gs.xp = Math.max(0, this.gs.xp - previousNeeded);
        this.gs.xpNeeded = nextXpNeeded(this.gs.xpNeeded); // centralized XP curve
        this.showUpgradeChoices();
        playSound('level');
    }

    grantXp(amount: number) {
        const p = this.gs.entities.get(this.gs.playerId)!;
        const mult = p.xpGain || 1;
        this.gs.xp += amount * mult;
        if (!this.gs.paused && this.gs.xp >= this.gs.xpNeeded) {
            this.levelUp();
        }
    }

    private killMob(mob: Entity) {
        this.gs.kills++;
        const elite = mob.isElite || false;
        if (elite) {
            const angle = this.gs.rng() * Math.PI * 2;
            const offset = mob.radius + 12;
            this.spawnXp(mob.x + Math.cos(angle) * offset, mob.y + Math.sin(angle) * offset, 10, true);
            rollShardDrop(this.gs, { app: this.app, sprites: this.sprites }, mob.x, mob.y, true, {
                x: mob.x - Math.cos(angle) * offset,
                y: mob.y - Math.sin(angle) * offset,
            });
            return;
        }
        const droppedShard = rollShardDrop(this.gs, { app: this.app, sprites: this.sprites }, mob.x, mob.y, elite);
        if (!droppedShard) {
            this.spawnXp(mob.x, mob.y, 2, false);
        }
    }

    damagePlayer(amount: number) {
        if (!this.gs.runActive) return;
        if (this.debugInvulnerable) return;
        const p = this.gs.entities.get(this.gs.playerId)!;
        if (p.invuln && p.invuln > 0) return;
        p.hp = Math.max(0, (p.hp || 0) - amount);
        p.invuln = 0.6; // brief invulnerability
        if (p.hp <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        if (!this.gs.runActive) return;
        this.gs.paused = true;
        this.gs.runActive = false;
        window.dispatchEvent(new CustomEvent('voidsurvivor-debug-state'));
        if (this.upgradeModal) {
            // hide main menu if still visible to avoid overlap
            const mainMenu = document.getElementById('mainMenu');
            if (mainMenu && mainMenu.style.display !== 'none') mainMenu.style.display = 'none';
            this.upgradeModal.style.display = 'flex';
            const shardsGained = this.gs.runShards || 0;
            const totalAfterRun = this.gs.meta.shards + shardsGained;
            const bestTime = Math.max(this.gs.meta.stats.bestTime, this.gs.time);
            this.upgradeModal.innerHTML = `<div class="panel gameover-panel" style="text-align:center"><h2>Game Over</h2>
                <div class="gameover-summary">
                    <div><span>Time</span><strong>${formatRunTime(this.gs.time)}</strong></div>
                    <div><span>Level</span><strong>${this.gs.level}</strong></div>
                    <div><span>Kills</span><strong>${this.gs.kills}</strong></div>
                    <div><span>Shards</span><strong>+${shardsGained}</strong></div>
                    <div><span>Total</span><strong>${totalAfterRun}</strong></div>
                    <div><span>Best</span><strong>${formatRunTime(bestTime)}</strong></div>
                </div>
                <div class='goButtons'><button id='restartBtn'>Restart</button><button id='mainMenuBtn'>Main Menu</button></div><div class='gameover-note'>Press A / Enter to activate focused button</div></div>`;
            const restart = document.getElementById('restartBtn') as HTMLButtonElement | null;
            const menuBtn = document.getElementById('mainMenuBtn') as HTMLButtonElement | null;
            restart?.addEventListener('click', () => {
                this.gameOverKeyCleanup?.();
                // Close the game over modal before restarting
                if (this.upgradeModal) this.upgradeModal.style.display = 'none';
                const evt = new CustomEvent('voidsurvivor-restart');
                window.dispatchEvent(evt);
            });
            menuBtn?.addEventListener('click', () => {
                this.gameOverKeyCleanup?.();
                if (this.upgradeModal) this.upgradeModal.style.display = 'none';
                const evt = new CustomEvent('voidsurvivor-quit');
                window.dispatchEvent(evt);
            });
            // Simple keyboard/controller focus handling for the two buttons
            let goIndex = 0;
            const goButtons = [restart, menuBtn].filter(Boolean) as HTMLButtonElement[];
            const applyGoSel = () => goButtons.forEach((b, i) => { if (i === goIndex) b.classList.add('selected'); else b.classList.remove('selected'); });
            applyGoSel();
            const goKeyHandler = (e: KeyboardEvent) => {
                if (!goButtons.length) return;
                if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'Tab'].includes(e.code)) { e.preventDefault(); }
                switch (e.code) {
                    case 'ArrowLeft': case 'KeyA': case 'ArrowUp': case 'KeyW': goIndex = (goIndex + goButtons.length - 1) % goButtons.length; applyGoSel(); break;
                    case 'ArrowRight': case 'KeyD': case 'ArrowDown': case 'KeyS': goIndex = (goIndex + 1) % goButtons.length; applyGoSel(); break;
                    case 'Enter': case 'Space': goButtons[goIndex].click(); break;
                }
            };
            this.gameOverKeyCleanup?.();
            window.addEventListener('keydown', goKeyHandler);
            this.gameOverKeyCleanup = () => {
                window.removeEventListener('keydown', goKeyHandler);
                this.gameOverKeyCleanup = undefined;
            };
            // Lightweight gamepad polling for game over buttons
            let lastButtons: boolean[] = [];
            let lastH = 0;
            const pollGO = () => {
                if (this.upgradeModal?.style.display !== 'flex') return; // stop if closed
                const gp = getActivePad();
                if (gp) {
                    const pad = readGamepadDirections(gp, 0.4);
                    const buttons = pad.buttons;
                    const h = pad.axH > 0 ? 1 : (pad.axH < 0 ? -1 : 0);
                    if ((buttons[14] && !lastButtons[14]) || (h === -1 && lastH !== -1)) { goIndex = (goIndex + goButtons.length - 1) % goButtons.length; applyGoSel(); }
                    if ((buttons[15] && !lastButtons[15]) || (h === 1 && lastH !== 1)) { goIndex = (goIndex + 1) % goButtons.length; applyGoSel(); }
                    if (buttons[0] && !lastButtons[0]) { goButtons[goIndex].click(); }
                    lastButtons = buttons; lastH = h;
                }
                requestAnimationFrame(pollGO);
            };
            requestAnimationFrame(pollGO);
        }
        const shardsGained = this.gs.runShards || 0;
        this.endCb({ time: this.gs.time, kills: this.gs.kills, shards: shardsGained });
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.gameOverKeyCleanup?.();
        this.pauseKeyCleanup?.();
        for (const cleanup of this.cleanupFns.splice(0)) {
            try { cleanup(); } catch { }
        }
        const pm = document.getElementById('pauseMenu');
        if (this.upgradeModal) this.upgradeModal.style.display = 'none';
        if (pm) pm.style.display = 'none';
        try { this.app?.ticker.remove(this.update); } catch { }
        try { this.app?.ticker.stop(); } catch { }
        try { this.app?.destroy(true); } catch { }
        this.sprites.clear();
    }

    // HUD & stats now handled via separate module
    updateHud() { updateHud(this.gs); }

    private pushTouchingMobs(player: Entity) {
        for (const mob of this.gs.entities.values()) {
            if (mob.kind !== 'mob') continue;
            const minDist = player.radius + mob.radius;
            const dx = mob.x - player.x;
            const dy = mob.y - player.y;
            const d = Math.hypot(dx, dy);
            if (d >= minDist) continue;

            if (d > 0) {
                mob.x = player.x + (dx / d) * minDist;
                mob.y = player.y + (dy / d) * minDist;
            } else {
                const angle = mob.id * 2.399963229728653;
                mob.x = player.x + Math.cos(angle) * minDist;
                mob.y = player.y + Math.sin(angle) * minDist;
            }
            mob.vx = 0;
            mob.vy = 0;
        }
    }

    update = (ticker: PIXI.Ticker) => {
        if (!this.gs || this.gs.paused) return; // paused or not ready
        // Convert ticker delta to seconds (deltaTime ~1 at 60fps)
        const dt = ticker.deltaTime / 60;
        const rawFps = dt > 0 ? 1 / dt : 0;
        if (Number.isFinite(rawFps) && rawFps > 0) {
            this.gs.fps = this.gs.fps ? this.gs.fps * 0.9 + rawFps * 0.1 : rawFps;
        }
        this.gs.time += dt;

        // Timed elite spawn each full minute (t>=60) once per minute
        const minute = Math.floor(this.gs.time / 60);
        if (minute >= 1 && this.gs.lastEliteMinute !== minute) {
            this.gs.lastEliteMinute = minute;
            this.spawnElite();
        }

        const player = this.gs.entities.get(this.gs.playerId)!;
        if (player.invuln && player.invuln > 0) player.invuln -= dt;
        if (player.regen && player.regen > 0) {
            player.hp = Math.min(player.maxHp || player.hp || 0, (player.hp || 0) + player.regen * dt);
        }

        // spawn mobs
        this.gs.spawnTimer -= dt;
        const spawnInterval = spawnIntervalAt(this.gs.time); // centralized spawn pacing
        if (this.gs.spawnTimer <= 0) {
            this.spawnMob();
            this.gs.spawnTimer = spawnInterval;
        }

        // fire bolts (attack speed factor)
        this.gs.boltTimer -= dt * (player.attackSpeed || 1);
        const fireInterval = FIRE_INTERVAL_BASE;
        if (this.gs.boltTimer <= 0) {
            this.fireBolt();
            this.gs.boltTimer = fireInterval;
        }

        // movement (instant directional, with click/tap destination as an alternate input)
        const prevX = player.x;
        const prevY = player.y;
        let mx = 0, my = 0;
        const manualInput = hasDirectionalInput(this.input);
        if (manualInput) this.clearMoveTarget();
        if (this.input.up && this.input.down) {
            my = 0;
        }
        else {
            if (this.input.up) my -= 1;
            if (this.input.down) my += 1;
        }
        if (this.input.left && this.input.right) {
            mx = 0;
        } else {
            if (this.input.left) mx -= 1;
            if (this.input.right) mx += 1;
        }
        if (mx !== 0 || my !== 0) {
            const len = Math.hypot(mx, my) || 1;
            mx /= len;
            my /= len;
        }
        const moveSpeed = (player.speed || 120);
        const pointerTarget = getMouseMovementEnabled() ? (this.input.moveTarget ?? this.input.cursorTarget) : undefined;
        if (!manualInput && mx === 0 && my === 0 && pointerTarget) {
            const dx = pointerTarget.x - player.x;
            const dy = pointerTarget.y - player.y;
            const dist = Math.hypot(dx, dy);
            const step = moveSpeed * dt;
            this.targetFacing = Math.atan2(dy, dx);
            if (dist <= Math.max(4, step)) {
                if (this.input.moveTarget) {
                    player.x = this.input.moveTarget.x;
                    player.y = this.input.moveTarget.y;
                    this.clearMoveTarget();
                }
            } else {
                mx = dx / dist;
                my = dy / dist;
            }
        }
        player.x += mx * moveSpeed * dt;
        player.y += my * moveSpeed * dt;
        // Boundaries (viewport clamp)
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;
        player.x = Math.max(player.radius, Math.min(w - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(h - player.radius, player.y));
        this.pushTouchingMobs(player);

        // Top-down orientation: aim the ship nose at the movement direction.
        if (mx !== 0 || my !== 0) {
            this.targetFacing = Math.atan2(my, mx);
        }

        // Aura damage application
        const auraLevel = player.auraLevel || 0;
        if (auraLevel > 0) {
            // radius scales with the accumulated rarity bonus (%); DPS stays level-based
            const radius = POWERS_VALUES.AURA_BASE_RADIUS * (player.auraRadiusPct ?? 100) / 100;
            const dps = auraDpsAt(auraLevel); // centralized aura DPS calc
            const auraG = player.auraG;
            if (auraG && player.auraRenderRadius !== radius) {
                auraG.clear();
                auraG.circle(0, 0, radius).fill({ color: 0x66ffcc, alpha: 0.15 }).stroke({ color: 0x66ffcc, width: 2, alpha: 0.5 });
                player.auraRenderRadius = radius;
            }
            for (const m of this.gs.entities.values()) {
                if (m.kind !== 'mob') continue;
                const r = radius + m.radius;
                if (distSq(player.x, player.y, m.x, m.y) < r * r) {
                    m.hp = (m.hp || 0) - dps * dt; // continuous damage
                    if (Math.random() < 0.02) spawnParticle(this.gs, { app: this.app, sprites: this.sprites }, m.x, m.y, 0x66ffcc);
                }
            }
        } else {
            const auraG = player.auraG;
            if (auraG && player.auraRenderRadius !== 0) {
                auraG.clear();
                player.auraRenderRadius = 0;
            }
        }

        // Orbiting scriptures
        const orbitCount = player.magicOrbCount || 0;
        if (orbitCount > 0) {
            const orbitG = player.orbitG;
            if (!orbitG) return;
            while (orbitG.children.length < orbitCount) {
                const g = new PIXI.Graphics();
                g.circle(0, 0, 6).fill({ color: 0xffe0b2 }).stroke({ color: 0xffb74d, width: 2 });
                orbitG.addChild(g);
            }
            while (orbitG.children.length > orbitCount) { orbitG.removeChildAt(orbitG.children.length - 1); }
            const radius = POWERS_VALUES.MAGIC_ORB_RADIUS;
            const dmg = player.magicOrbDamage || POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE;
            const orbSpin = 2 * (player.orbSpeedMult ?? 1);
            for (let i = 0; i < orbitG.children.length; i++) {
                const angle = this.gs.time * orbSpin + (i / orbitG.children.length) * Math.PI * 2;
                const child = orbitG.children[i];
                child.x = Math.cos(angle) * radius;
                child.y = Math.sin(angle) * radius;
            }
            // collision with mobs (discrete hits with 1s per-enemy cooldown)
            for (const m of this.gs.entities.values()) {
                if (m.kind !== 'mob') continue;
                for (const child of orbitG.children) {
                    const cx = player.x + child.x; const cy = player.y + child.y;
                    const rr = (m.radius + 6);
                    if (distSq(m.x, m.y, cx, cy) < rr * rr) {
                        const last = m.lastOrbitHitAt || 0;
                        if (this.gs.time - last >= 1) {
                            m.hp = (m.hp || 0) - dmg; // single chunk
                            m.lastOrbitHitAt = this.gs.time;
                            spawnHitBurst(this.gs, { app: this.app, sprites: this.sprites }, m.x, m.y, 0xffb74d, 4);
                        }
                    }
                }
            }
        }

        // Handle passive (aura/orbit) kills BEFORE main entity update loop
        const passiveDeaths: number[] = [];
        for (const m of this.gs.entities.values()) {
            if (m.kind === 'mob' && (m.hp || 0) <= 0) {
                this.killMob(m);
                passiveDeaths.push(m.id);
            }
        }

        const toRemove: number[] = [];
        const toRemoveSet = new Set<number>();
        const markRemove = (id: number) => {
            if (toRemoveSet.has(id)) return;
            toRemoveSet.add(id);
            toRemove.push(id);
        };
        for (const id of passiveDeaths) markRemove(id);
        for (const e of this.gs.entities.values()) {
            if (e.kind === 'player') continue;
            if (toRemoveSet.has(e.id)) continue;
            if (e.kind === 'mob') {
                const contact = advanceChaserUntilContact(e, player, e.speed || 60, dt);
                e.x = contact.x;
                e.y = contact.y;
                e.vx = contact.vx;
                e.vy = contact.vy;
                if (contact.touching) {
                    this.damagePlayer(e.damage || 5);
                }
                // Update mob health bar (only show if damaged)
                const hpBar = e.hpRing;
                if (hpBar) {
                    if (e.hp! < e.maxHp! && e.hp! > 0) {
                        const pct = Math.max(0, e.hp! / (e.maxHp! || 1));
                        if (e.hpBarPct === undefined || Math.abs(e.hpBarPct - pct) >= 0.005) {
                            const wBar = e.radius * 2 + 4;
                            const hBar = 5;
                            const x0 = -wBar / 2;
                            const y0 = -e.radius - 9;
                            hpBar.clear();
                            hpBar.rect(x0, y0, wBar, hBar).fill({ color: 0x262d32, alpha: 0.9 });
                            hpBar.rect(x0 + 1, y0 + 1, (wBar - 2) * pct, hBar - 2).fill({ color: 0x4caf50 });
                            e.hpBarPct = pct;
                        }
                    } else if (e.hpBarPct !== undefined) {
                        hpBar.clear();
                        e.hpBarPct = undefined;
                    }
                }
            } else if (e.kind === 'bolt') {
                e.x += e.vx * dt; e.y += e.vy * dt;
                e.life! -= dt;
                if (e.life! <= 0) { markRemove(e.id); continue; }
                for (const m of this.gs.entities.values()) {
                    if (m.kind !== 'mob') continue;
                    if ((m.hp || 0) <= 0 || toRemoveSet.has(m.id)) continue;
                    const r = m.radius + e.radius;
                    if (distSq(m.x, m.y, e.x, e.y) < r * r) {
                        m.hp! -= e.damage || 1;
                        spawnHitBurst(this.gs, { app: this.app, sprites: this.sprites }, e.x, e.y, 0xffd54f, 4);
                        playSound('hit');
                        markRemove(e.id);
                        if (m.hp! <= 0) {
                            this.killMob(m);
                            spawnHitBurst(this.gs, { app: this.app, sprites: this.sprites }, m.x, m.y, 0xff4d4d, 10);
                            markRemove(m.id);
                        }
                        break;
                    }
                }
            } else if (e.kind === 'xp') {
                const range = (player.pickupRange || 60);
                const r = player.radius + e.radius + range * 0.2;
                if (distSq(player.x, player.y, e.x, e.y) < r * r) {
                    // magnet pull if within range
                    const dx = player.x - e.x; const dy = player.y - e.y; const len = Math.hypot(dx, dy) || 1;
                    if (len < range) {
                        e.x += dx / len * dt * 200;
                        e.y += dy / len * dt * 200;
                    }
                    if (distSq(player.x, player.y, e.x, e.y) < (player.radius + e.radius + 4) ** 2) {
                        this.grantXp(e.value || 1);
                        playSound('pickup');
                        markRemove(e.id);
                    }
                }
            } else if (e.kind === 'shard') {
                // pickup similar to xp but adds to runShards directly
                const range = (player.pickupRange || 60) * 0.8;
                const r = player.radius + e.radius + range * 0.15;
                if (distSq(player.x, player.y, e.x, e.y) < r * r) {
                    const dx = player.x - e.x; const dy = player.y - e.y; const len = Math.hypot(dx, dy) || 1;
                    if (len < range) {
                        e.x += dx / len * dt * 160;
                        e.y += dy / len * dt * 160;
                    }
                    if (distSq(player.x, player.y, e.x, e.y) < (player.radius + e.radius + 4) ** 2) {
                        const val = e.shardValue || 1;
                        this.gs.runShards = (this.gs.runShards || 0) + val;
                        playSound('pickup');
                        markRemove(e.id);
                    }
                }
            } else if (e.kind === 'particle') {
                e.x += e.vx * dt; e.y += e.vy * dt;
                e.vx *= 0.9; e.vy *= 0.9;
                e.life! -= dt;
                if (e.life! <= 0) { markRemove(e.id); continue; }
                e.alpha = (e.life! < 0.3) ? e.life! / 0.3 : 1;
            }
        }

        for (const id of toRemove) {
            const ent = this.gs.entities.get(id);
            if (!ent) continue;
            this.gs.entities.delete(id);
            const sprite = this.sprites.get(id);
            if (sprite) { sprite.parent?.removeChild(sprite); this.sprites.delete(id); }
        }

        for (const [id, sprite] of this.sprites) {
            const e = this.gs.entities.get(id);
            if (!e) continue;
            sprite.x = e.x;
            sprite.y = e.y;
            if (e.kind === 'particle') { sprite.alpha = e.alpha ?? 1; }
            if (e.kind === 'xp' && e.pulse) {
                const elite = e.isElite;
                const amp = elite ? 0.1 : 0.06;
                const speed = elite ? 5 : 4;
                const s = 1 + Math.sin(this.gs.time * speed + e.id) * amp;
                sprite.scale.set(s);
            } else if (e.kind === 'shard' && e.spin) {
                const t = this.gs.time * 6 + e.id;
                sprite.rotation = t;
            }
        }

        // Animation strictly based on actual displacement (ignores cancelling inputs like left+right)
        if (this.playerSprite) {
            const moved = didMove(prevX, prevY, player.x, player.y);
            if (moved !== this.wasMoving) {
                this.playerSprite.setMoving(moved);
                this.wasMoving = moved;
            }
            this.playerSprite.setAnimSpeed(moved ? MOVE_ANIM_SPEED : 0);

            // Smoothly rotate the ship toward the movement direction (shortest path).
            let diff = this.targetFacing - this.playerFacing;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.playerFacing += diff * Math.min(1, dt * 14);
            this.playerSprite.view.rotation = this.playerFacing;
        }

        if (this.gs.statsVisible && this.gs.time - this.lastStatsOverlayAt >= STATS_UPDATE_INTERVAL) {
            this.lastStatsOverlayAt = this.gs.time;
            this.updateStatsOverlay();
        }
        if (this.gs.time - this.lastHudUpdateAt >= HUD_UPDATE_INTERVAL) {
            this.lastHudUpdateAt = this.gs.time;
            this.updateHud();
        }
        if (this.gs.time - this.lastDebugMetricAt >= 0.25) {
            this.lastDebugMetricAt = this.gs.time;
            window.dispatchEvent(new CustomEvent('voidsurvivor-debug-state'));
        }
    };

    spawnShard(x: number, y: number, value: number) { spawnShard(this.gs, { app: this.app, sprites: this.sprites }, x, y, value); }
    rollShardDrop(x: number, y: number, elite: boolean) { return rollShardDrop(this.gs, { app: this.app, sprites: this.sprites }, x, y, elite); }
    spawnElite() { spawnElite(this.gs, { app: this.app, sprites: this.sprites }); }

    setDebugInvulnerable(enabled: boolean) { this.debugInvulnerable = enabled; }
    isDebugInvulnerable() { return this.debugInvulnerable; }
    getFps() { return Math.round(this.gs?.fps || 0); }
    isRunActive() { return !this.gs || this.gs.runActive; }
    debugAddEnemy() { spawnMob(this.gs, { app: this.app, sprites: this.sprites }, this.debugSpawnPoint(120, 12)); }
    debugAddBoss() { spawnElite(this.gs, { app: this.app, sprites: this.sprites }, this.debugSpawnPoint(150, 16)); }
    debugRemoveEnemy() { this.removeDebugMob(false); }
    debugRemoveBoss() { this.removeDebugMob(true); }
    debugAdjustDamage(delta: number) {
        const player = this.gs.entities.get(this.gs.playerId);
        if (!player) return;
        player.damage = Math.max(1, Math.round((player.damage || 1) + delta));
        this.updateStatsOverlay();
    }
    debugLevelUp() {
        if (this.gs.paused || !this.gs.runActive) return;
        this.gs.xp = this.gs.xpNeeded;
        this.levelUp();
        this.updateHud();
        this.updateStatsOverlay();
    }

    private removeDebugMob(elite: boolean) {
        const player = this.gs.entities.get(this.gs.playerId);
        let best: Entity | undefined;
        let bestDist = Infinity;
        for (const e of this.gs.entities.values()) {
            if (e.kind !== 'mob' || !!e.isElite !== elite) continue;
            const d = player ? distSq(player.x, player.y, e.x, e.y) : e.id;
            if (d < bestDist) { bestDist = d; best = e; }
        }
        if (!best) return;
        this.gs.entities.delete(best.id);
        const sprite = this.sprites.get(best.id);
        if (sprite) { sprite.parent?.removeChild(sprite); this.sprites.delete(best.id); }
    }

    private debugSpawnPoint(distance: number, radius: number) {
        const player = this.gs.entities.get(this.gs.playerId);
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;
        const margin = radius + 12;
        const baseX = player?.x ?? w / 2;
        const baseY = player?.y ?? h / 2;
        const angle = this.gs.rng() * Math.PI * 2;
        const x = Math.max(margin, Math.min(w - margin, baseX + Math.cos(angle) * distance));
        const y = Math.max(margin, Math.min(h - margin, baseY + Math.sin(angle) * distance));
        return { x, y };
    }

    updateStatsOverlay() { updateStatsOverlay(this.gs); }
}
