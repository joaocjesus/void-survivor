import * as PIXI from 'pixi.js';
import { Entity, GameState, UpgradeDef, PlayerStartStats, MetaSave } from './types';
import { playSound } from './audio';
import { UPGRADES, pickRandomUpgrades, maybeAddDependentUpgrades } from './upgrades';
import { spawnMob, spawnElite, spawnXp, fireProjectile, spawnParticle, spawnHitBurst, rollShardDrop, spawnShard } from './spawns';
import { randomRng } from './rng';
import { clamp, distSq } from './math';
import { createBackground } from './game/background';
import { updateHud, updateStatsOverlay } from './game/hud';
import { createInputState, setupKeyboard, setupGamepad } from './game/input';
import { FIRE_INTERVAL_BASE, POWERS_VALUES, UPGRADE_VALUES, POWERS_UPGRADE_VALUES } from './constants/balance';
import { nextXpNeeded, spawnIntervalAt, auraRadiusAt, auraDpsAt } from './balanceUtils';
import { createPlayerSpriteFromGrid, PlayerSprite } from './sprites/grid';
import { didMove, MOVE_ANIM_SPEED } from './movement';


export class Game {
    app!: PIXI.Application;
    gs!: GameState;
    sprites: Map<number, PIXI.Container | PIXI.Graphics> = new Map();
    input = createInputState();
    upgradeModal = document.getElementById('upgradeModal') as HTMLDivElement | null;
    upgradeChoicesEl = document.getElementById('upgradeChoices') as HTMLDivElement | null;
    healthBar = document.getElementById('hpBar') as HTMLDivElement | null;
    hpText = document.getElementById('hp') as HTMLSpanElement | null;
    hpMaxText = document.getElementById('hpMax') as HTMLSpanElement | null;
    // Controller selection index for upgrade cards
    private upgradeSelIndex: number = 0;
    private lastInputDevice: 'keyboard' | 'gamepad' = 'keyboard';
    private playerSprite?: PlayerSprite;
    private lastDir: 'left' | 'right' | 'up' | 'down' = 'right';
    // Simplified animation state
    private wasMoving: boolean = false;

    private endCb: (result: { time: number; kills: number; shards: number; }) => void;
    constructor(parent: HTMLElement, startStats: PlayerStartStats, meta: MetaSave, endCb: (result: { time: number; kills: number; shards: number; }) => void) {
        this.endCb = endCb;
        void this.init(parent, startStats, meta);
    }

    private async init(parent: HTMLElement, startStats: PlayerStartStats, meta: MetaSave) {
        this.app = new PIXI.Application();
        await this.app.init({ resizeTo: parent, background: '#121416', antialias: true });
        parent.appendChild(this.app.canvas);
        // Attach static background
        createBackground(this.app);

        this.gs = {
            time: 0,
            playerId: 0,
            entities: new Map(),
            nextEntityId: 1,
            spawnTimer: 0,
            projectileTimer: 0,
            xp: 0,
            level: 1,
            xpNeeded: 5,
            kills: 0,
            rng: randomRng(12345),
            paused: false,
            // Start without magicOrbDmg; it unlocks after first magic orb is obtained
            upgradePool: [...UPGRADES.filter(u => u.id !== 'magicOrbDmg')],
            offeredUpgrades: [],
            runActive: true,
            startStats: startStats,
            meta: meta,
            runShards: 0
        };

        const player: Entity = {
            id: this.gs.playerId, x: 0, y: 0, vx: 0, vy: 0, radius: 14, kind: 'player',
            hp: startStats.hp, maxHp: startStats.maxHp, damage: startStats.damage, speed: startStats.speed,
            attackSpeed: startStats.attackSpeed, projectileSpeed: startStats.projectileSpeed, pickupRange: startStats.pickupRange, regen: startStats.regen, xpGain: startStats.xpGain
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
        playerG.addChild(fallback);
        // aura visual (updated in update loop based on level)
        const aura = new PIXI.Graphics();
        aura.alpha = 0.18;
        playerG.addChild(aura);
        (player as any).auraG = aura;
        (player as any).orbitG = new PIXI.Container();
        playerG.addChild((player as any).orbitG);
        playerG.x = player.x; playerG.y = player.y;
        this.app.stage.addChild(playerG);
        this.sprites.set(player.id, playerG);

        // Try to load an optional sprite sheet for the player.
        // Place an image at /assets/player-sprites.png (grid). Adjust cols/rows below to match your sheet.
        try {
            const tex = await PIXI.Assets.load('/assets/player-sprites.png');
            // New sheet: 4 columns x 6 rows, only right-facing; 21 frames total (last row partial)
            const sprite = createPlayerSpriteFromGrid(tex, { cols: 4, rows: 6, cycleRows: [0, 1, 2, 3, 4, 5], frameCount: 21 });
            // Use sprite's native pixel size (no downscale to hit circle)
            // If you want to tweak: sprite.view.scale.set(0.75) etc.
            sprite.view.scale.set(0.15);
            // Insert under aura/orbit but above glow
            playerG.addChildAt(sprite.view, 1);
            // Hide fallback core if sprite loads
            fallback.visible = false;
            this.playerSprite = sprite;
        } catch (err) {
            // Missing asset is fine; keep fallback visuals
            // console.warn('Player sprite not found, using vector fallback.', err);
        }

        this.setupInput();
        this.setupUpgradeShortcuts();
        this.app.ticker.add(this.update);
    }

    setupUpgradeShortcuts() {
        window.addEventListener('keydown', e => {
            if (!this.gs?.paused || !this.gs.offeredUpgrades.length) return;
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < this.gs.offeredUpgrades.length) {
                this.chooseUpgrade(this.gs.offeredUpgrades[idx]);
            }
        });
    }

    showUpgradeChoices() {
        if (!this.upgradeModal || !this.upgradeChoicesEl) return;
        this.gs.paused = true;
        this.upgradeChoicesEl.innerHTML = '';
        const choices = this.pickRandomUpgrades(3);
        this.gs.offeredUpgrades = choices;
        this.upgradeSelIndex = 0; // reset selection
        const p = this.gs.entities.get(this.gs.playerId)!;
        const base = this.gs.startStats;
        const powerIds = new Set(['aura', 'magicOrb']);
        const calcLevel = (id: string): number => {
            switch (id) {
                case 'dmg': return Math.max(0, Math.floor(((p.damage || base.damage) - base.damage) / 5));
                case 'aspd': return Math.max(0, Math.round(Math.log((p.attackSpeed || base.attackSpeed) / base.attackSpeed) / Math.log(1.25)));
                case 'speed': return Math.max(0, Math.round(Math.log((p.speed || base.speed) / base.speed) / Math.log(1.1)));
                case 'projspd': return Math.max(0, Math.round(Math.log((p.projectileSpeed || base.projectileSpeed) / base.projectileSpeed) / Math.log(1.2)));
                case 'hp': return Math.max(0, Math.floor(((p.maxHp || base.maxHp) - base.maxHp) / 25));
                case 'pickup': return Math.max(0, Math.round(Math.log((p.pickupRange || base.pickupRange) / base.pickupRange) / Math.log(1.5)));
                case 'regen': return Math.max(0, Math.round(((p.regen || 0) - (base.regen || 0)) / 0.5));
                case 'aura': return ((p as any).auraLevel || 0); // levels directly tracked
                case 'magicOrb': return ((p as any).magicOrbCount ?? (p as any).orbitCount) || 0;
                case 'magicOrbDmg': {
                    const current = ((p as any).magicOrbDamage ?? (p as any).orbitDamage ?? 8); // base 8
                    return Math.max(0, Math.floor((current - 8) / 5));
                }
                default: return 0;
            }
        };
        for (const u of choices) {
            const div = document.createElement('button');
            div.className = 'upgrade';
            const increments = calcLevel(u.id); // number of times upgrade already taken (0 = none)
            const lvl = powerIds.has(u.id) ? increments : increments + 1; // for non-power: base is Level 1
            const nextLevel = lvl + 1;
            // Power handling (aura / magicOrb)
            if (powerIds.has(u.id)) {
                div.classList.add('power');
                if (increments === 0) {
                    div.innerHTML = `<h3>${u.name}</h3><div class='body'><div class='bodyText'>Unlock ${u.name}</div></div>`;
                } else {
                    // Build comparison grid
                    // Re-use description but strip unlock prefix
                    const nextDesc = u.description.replace(/^Unlock \/\s*/i, '');
                    let statLabelCurrent = '';
                    let statLabelNext = '';
                    if (u.id === 'aura') {
                        const incPct = POWERS_UPGRADE_VALUES.AURA_RADIUS_INCREMENT;
                        const curBonus = (increments * incPct).toFixed(0);
                        const nextBonus = ((increments + 1) * incPct).toFixed(0);
                        statLabelCurrent = `Aura Size: +${curBonus}%`;
                        statLabelNext = `Aura Size: +${nextBonus}% (+${incPct.toFixed(0)}%)`;
                    } else if (u.id === 'magicOrb') {
                        statLabelCurrent = `Orbs: ${lvl}`;
                        statLabelNext = `Orbs: ${nextLevel} (+1)`;
                    }
                    // Highlight increment part in next label
                    statLabelNext = statLabelNext.replace(/\(\+[0-9.]+%?\)/g, m => `<span class='incPct'>${m}</span>`);
                    div.innerHTML = `<h3>${u.name}</h3>
                        <div class='body'><div class='power-compare'>
                            <div class='col current'>
                                <div class='lvl'>Level ${lvl}</div>
                                <div class='stat'>${statLabelCurrent}</div>
                            </div>
                            <div class='arrowDown'><div class='arrowIcon'>&darr;</div></div>
                            <div class='col next'>
                                <div class='lvl'>Level ${nextLevel}</div>
                                <div class='stat'>${statLabelNext}</div>
                            </div>
                        </div></div>`;
                }
            } else {
                // Non-power upgrades: comparison view (current vs next), base stats are Level 1 values
                const currentValueLine = (id: string, inc: number): string => {
                    switch (id) {
                        case 'dmg': return `Damage: ${(base.damage + inc * UPGRADE_VALUES.DAMAGE_PLUS).toFixed(0)}`;
                        case 'aspd': return `Attack Speed: ${(base.attackSpeed * Math.pow(UPGRADE_VALUES.ATTACK_SPEED_MULT, inc)).toFixed(2)}`;
                        case 'speed': return `Move Speed: ${(base.speed * Math.pow(UPGRADE_VALUES.MOVE_SPEED_MULT, inc)).toFixed(0)}`;
                        case 'projspd': return `Projectile Speed: ${(base.projectileSpeed * Math.pow(UPGRADE_VALUES.PROJECTILE_SPEED_MULT, inc)).toFixed(0)}`;
                        case 'hp': return `Max HP: ${(base.maxHp + inc * UPGRADE_VALUES.MAX_HP_PLUS).toFixed(0)}`;
                        case 'pickup': return `Pickup Range: ${(base.pickupRange * Math.pow(UPGRADE_VALUES.PICKUP_RANGE_MULT, inc)).toFixed(0)}`;
                        case 'regen': return `Regeneration: ${(base.regen + inc * UPGRADE_VALUES.REGEN_PLUS).toFixed(1)}`;
                        case 'magicOrbDmg': return `Orb Damage: ${(POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE + inc * POWERS_UPGRADE_VALUES.MAGIC_ORB_DAMAGE_INCREMENT).toFixed(0)}`;
                        default: return '';
                    }
                };
                const nextValueLine = (id: string, inc: number): string => {
                    switch (id) {
                        case 'dmg': {
                            const cur = base.damage + inc * UPGRADE_VALUES.DAMAGE_PLUS;
                            const nxt = cur + UPGRADE_VALUES.DAMAGE_PLUS;
                            return `Damage: ${nxt} (+${UPGRADE_VALUES.DAMAGE_PLUS})`;
                        }
                        case 'aspd': {
                            const cur = base.attackSpeed * Math.pow(UPGRADE_VALUES.ATTACK_SPEED_MULT, inc);
                            const nxt = cur * UPGRADE_VALUES.ATTACK_SPEED_MULT;
                            return `Attack Speed: ${nxt.toFixed(2)} (+${((nxt / base.attackSpeed - 1) * 100).toFixed(0)}%)`;
                        }
                        case 'speed': {
                            const curMult = Math.pow(UPGRADE_VALUES.MOVE_SPEED_MULT, inc);
                            const nxtMult = curMult * UPGRADE_VALUES.MOVE_SPEED_MULT;
                            const nxtVal = base.speed * nxtMult;
                            return `Move Speed: ${nxtVal.toFixed(0)} (+${((UPGRADE_VALUES.MOVE_SPEED_MULT - 1) * 100).toFixed(0)}%)`;
                        }
                        case 'projspd': {
                            const curMult = Math.pow(UPGRADE_VALUES.PROJECTILE_SPEED_MULT, inc);
                            const nxtMult = curMult * UPGRADE_VALUES.PROJECTILE_SPEED_MULT;
                            const nxtVal = base.projectileSpeed * nxtMult;
                            return `Projectile Speed: ${nxtVal.toFixed(0)} (+${((nxtMult - 1) * 100).toFixed(0)}%)`;
                        }
                        case 'hp': {
                            const nxt = base.maxHp + (inc + 1) * UPGRADE_VALUES.MAX_HP_PLUS;
                            return `Max HP: ${nxt} (+${UPGRADE_VALUES.MAX_HP_PLUS})`;
                        }
                        case 'pickup': {
                            const curMult = Math.pow(UPGRADE_VALUES.PICKUP_RANGE_MULT, inc);
                            const nxtMult = curMult * UPGRADE_VALUES.PICKUP_RANGE_MULT;
                            const nxtVal = base.pickupRange * nxtMult;
                            return `Pickup Range: ${nxtVal.toFixed(0)} (+${((UPGRADE_VALUES.PICKUP_RANGE_MULT - 1) * 100).toFixed(0)}%)`;
                        }
                        case 'regen': {
                            const nxt = base.regen + (inc + 1) * UPGRADE_VALUES.REGEN_PLUS;
                            return `Regeneration: ${nxt.toFixed(1)} (+${UPGRADE_VALUES.REGEN_PLUS})`;
                        }
                        case 'magicOrbDmg': {
                            const nxt = POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE + (inc + 1) * POWERS_UPGRADE_VALUES.MAGIC_ORB_DAMAGE_INCREMENT;
                            return `Orb Damage: ${nxt} (+${POWERS_UPGRADE_VALUES.MAGIC_ORB_DAMAGE_INCREMENT})`;
                        }
                        default: return '';
                    }
                };
                const currentStat = currentValueLine(u.id, increments);
                let nextStat = nextValueLine(u.id, increments);
                // Highlight increases (numeric or percentage) in green including parentheses
                nextStat = nextStat.replace(/\(\+[0-9.]+%?\)/g, m => `<span class='incPct'>${m}</span>`);
                const extraNote = u.id === 'hp' ? `<div class='note' style='opacity:.6;font-size:11px;margin-top:6px;'>On upgrade: Heal ${UPGRADE_VALUES.MAX_HP_HEAL}</div>` : '';
                div.innerHTML = `<h3>${u.name}</h3>
                    <div class='body'><div class='power-compare'>
                        <div class='col current'>
                            <div class='lvl'>Level ${lvl}</div>
                            <div class='stat'>${currentStat}</div>
                        </div>
                        <div class='arrowDown'><div class='arrowIcon'>&darr;</div></div>
                        <div class='col next'>
                            <div class='lvl'>Level ${nextLevel}</div>
                            <div class='stat'>${nextStat}</div>
                        </div>
                    </div>${extraNote}</div>`;
            }
            div.onclick = () => this.chooseUpgrade(u);
            this.upgradeChoicesEl.appendChild(div);
        }
        // Inject style for increment percentage if not present
        if (!document.getElementById('upgradeIncStyle')) {
            const st = document.createElement('style');
            st.id = 'upgradeIncStyle';
            st.textContent = `.incPct{color:#4caf50;font-weight:600;}`;
            document.head.appendChild(st);
        }
        // Apply initial highlight for controller users
        this.applyUpgradeSelectionHighlight();
        this.upgradeModal.style.display = 'flex';
    }

    hideUpgradeChoices() {
        if (!this.upgradeModal) return;
        this.upgradeModal.style.display = 'none';
        this.gs.paused = false;
    }

    pickRandomUpgrades(count: number): UpgradeDef[] { return pickRandomUpgrades(this.gs, count); }

    chooseUpgrade(u: UpgradeDef) {
        const player = this.gs.entities.get(this.gs.playerId)!;
        const beforeOrbit = ((player as any).magicOrbCount) || 0;
        u.apply(this.gs);
        // allow duplicates for now by pushing back
        this.gs.upgradePool.push(u);
        maybeAddDependentUpgrades(this.gs, u.id);
        this.hideUpgradeChoices();
    }

    setupInput() {
        const lastInputRef = { v: this.lastInputDevice };
        setupKeyboard(this.input, this.gs, {
            onPause: () => { if (this.upgradeModal && this.upgradeModal.style.display === 'flex') return; this.openPauseMenu(); },
            onResume: () => { const pm = document.getElementById('pauseMenu'); if (pm && pm.style.display === 'flex') this.closePauseMenu(); },
            toggleStats: () => { (this.gs as any)._statsVisible = !(this.gs as any)._statsVisible; updateStatsOverlay(this.gs); },
            onUpgradeNav: (dir) => { this.upgradeSelIndex = Math.max(0, Math.min(this.gs.offeredUpgrades.length - 1, this.upgradeSelIndex + dir)); this.applyUpgradeSelectionHighlight(); },
            onUpgradeConfirm: () => { const sel = this.gs.offeredUpgrades[this.upgradeSelIndex]; if (sel) this.chooseUpgrade(sel); },
            lastInputDeviceRef: lastInputRef
        });
        setupGamepad(this.input, this.gs, {
            onPause: () => { const pm = document.getElementById('pauseMenu'); if (pm && pm.style.display === 'flex') this.closePauseMenu(); else if (!this.gs.paused) this.openPauseMenu(); },
            toggleStats: () => { (this.gs as any)._statsVisible = !(this.gs as any)._statsVisible; updateStatsOverlay(this.gs); },
            onUpgradeNav: (dir) => { this.upgradeSelIndex = Math.max(0, Math.min(this.gs.offeredUpgrades.length - 1, this.upgradeSelIndex + dir)); this.applyUpgradeSelectionHighlight(); },
            onUpgradeConfirm: () => { const sel = this.gs.offeredUpgrades[this.upgradeSelIndex]; if (sel) this.chooseUpgrade(sel); },
            lastInputDeviceRef: lastInputRef
        });
    }


    openPauseMenu() {
        const pm = document.getElementById('pauseMenu');
        if (!pm) return;
        this.gs.paused = true;
        pm.style.display = 'flex';
        const resume = document.getElementById('btnResume');
        const quit = document.getElementById('btnQuit');
        // Remove old handlers if any by cloning (ensures multiple opens stay clean)
        if (resume) {
            const clone = resume.cloneNode(true) as HTMLButtonElement; resume.parentNode?.replaceChild(clone, resume);
            clone.addEventListener('click', () => this.closePauseMenu(), { once: true });
        }
        if (quit) {
            const cloneQ = quit.cloneNode(true) as HTMLButtonElement; quit.parentNode?.replaceChild(cloneQ, quit);
            cloneQ.addEventListener('click', () => {
                // Close pause menu and terminate the current run
                pm.style.display = 'none';
                try { this.app.ticker.stop(); } catch { }
                try {
                    // Manually remove children then destroy
                    this.app.stage.removeChildren();
                    this.app.destroy();
                } catch { }
                const root = document.getElementById('app');
                if (root) root.innerHTML = '';
                // Notify host to clear currentGame reference & show main menu
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
        const existing = (pm as any)._keyHandler as ((e: KeyboardEvent) => void) | undefined;
        if (existing) window.removeEventListener('keydown', existing);
        (pm as any)._keyHandler = keyHandler;
        window.addEventListener('keydown', keyHandler);
        // Lightweight gamepad nav for pause menu
        let lastButtons: boolean[] = [];
        let lastV = 0;
        const pollPause = () => {
            if (pm.style.display !== 'flex') return; // stop when closed
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            const gp = pads && pads[0];
            if (gp) {
                const buttonsGp = gp.buttons.map(b => b.pressed);
                const axV = gp.axes[1] || 0; const dead = 0.4; const v = Math.abs(axV) > dead ? (axV > 0 ? 1 : -1) : 0;
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

    // spawning & projectile helpers now in spawns.ts
    spawnMob() { spawnMob(this.gs, { app: this.app, sprites: this.sprites }); }
    spawnXp(x: number, y: number, value: number, elite: boolean = false) { spawnXp(this.gs, { app: this.app, sprites: this.sprites }, x, y, value, elite); }
    fireProjectile() { fireProjectile(this.gs, { app: this.app, sprites: this.sprites }); }

    levelUp() {
        this.gs.level++;
        this.gs.xp = 0;
        this.gs.xpNeeded = nextXpNeeded(this.gs.xpNeeded); // centralized XP curve
        this.showUpgradeChoices();
        playSound('level');
    }

    grantXp(amount: number) {
        const p = this.gs.entities.get(this.gs.playerId)!;
        const mult = p.xpGain || 1;
        this.gs.xp += amount * mult;
        if (this.gs.xp >= this.gs.xpNeeded) {
            this.levelUp();
        }
    }

    damagePlayer(amount: number) {
        const p = this.gs.entities.get(this.gs.playerId)!;
        if (p.invuln && p.invuln > 0) return;
        p.hp = Math.max(0, (p.hp || 0) - amount);
        p.invuln = 0.6; // brief invulnerability
        if (p.hp <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        this.gs.paused = true;
        this.gs.runActive = false;
        if (this.upgradeModal) {
            // hide main menu if still visible to avoid overlap
            const mainMenu = document.getElementById('mainMenu');
            if (mainMenu && mainMenu.style.display !== 'none') mainMenu.style.display = 'none';
            this.upgradeModal.style.display = 'flex';
            this.upgradeModal.innerHTML = `<div class="panel gameover-panel" style="text-align:center"><h2 style='margin:0 0 28px; font-size:42px; letter-spacing:1px;'>Game Over</h2><p style='margin:0; font-size:26px; line-height:1.4; color:#e4ecf4;'>You survived ${Math.floor(this.gs.time)}s<br/>Level ${this.gs.level} – Kills ${this.gs.kills}</p><div class='goButtons'><button id='restartBtn'>Restart</button><button id='mainMenuBtn'>Main Menu</button></div><div class='gameover-note'>Press A / Enter to activate focused button</div></div>`;
            const restart = document.getElementById('restartBtn') as HTMLButtonElement | null;
            const menuBtn = document.getElementById('mainMenuBtn') as HTMLButtonElement | null;
            restart?.addEventListener('click', () => {
                // Close the game over modal before restarting
                if (this.upgradeModal) this.upgradeModal.style.display = 'none';
                const evt = new CustomEvent('voidsurvivor-restart');
                window.dispatchEvent(evt);
            });
            menuBtn?.addEventListener('click', () => { (document.getElementById('mainMenu')!).style.display = 'flex'; this.upgradeModal!.style.display = 'none'; const hud = document.querySelector('.hud') as HTMLElement | null; if (hud) hud.style.display = 'none'; });
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
            window.addEventListener('keydown', goKeyHandler, { once: false });
            // Lightweight gamepad polling for game over buttons
            let lastButtons: boolean[] = [];
            let lastH = 0;
            const pollGO = () => {
                if (this.upgradeModal?.style.display !== 'flex') return; // stop if closed
                const pads = navigator.getGamepads ? navigator.getGamepads() : [];
                const gp = pads && pads[0];
                if (gp) {
                    const buttons = gp.buttons.map(b => b.pressed);
                    const axH = gp.axes[0] || 0; const dead = 0.4; const h = Math.abs(axH) > dead ? (axH > 0 ? 1 : -1) : 0;
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
        // Persist shards to meta
        this.gs.meta.shards += shardsGained;
        this.endCb({ time: this.gs.time, kills: this.gs.kills, shards: shardsGained });
    }

    // HUD & stats now handled via separate module
    updateHud() { updateHud(this.gs); }

    update = (ticker: PIXI.Ticker) => {
        if (!this.gs || this.gs.paused) return; // paused or not ready
        // Convert ticker delta to seconds (deltaTime ~1 at 60fps)
        const dt = ticker.deltaTime / 60;
        this.gs.time += dt;

        // Timed elite spawn each full minute (t>=60) once per minute
        if (!('lastEliteMinute' in (this as any))) (this as any).lastEliteMinute = -1;
        const minute = Math.floor(this.gs.time / 60);
        if (minute >= 1 && (this as any).lastEliteMinute !== minute) {
            (this as any).lastEliteMinute = minute;
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

        // fire projectiles (attack speed factor)
        this.gs.projectileTimer -= dt * (player.attackSpeed || 1);
        const fireInterval = FIRE_INTERVAL_BASE;
        if (this.gs.projectileTimer <= 0) {
            this.fireProjectile();
            this.gs.projectileTimer = fireInterval;
        }

        // movement (instant directional, for snappy feel & clear speed)
        const prevX = player.x;
        const prevY = player.y;
        let mx = 0, my = 0;
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
        player.x += mx * moveSpeed * dt;
        player.y += my * moveSpeed * dt;
        // Boundaries (viewport clamp)
        const w = this.app.renderer.width;
        const h = this.app.renderer.height;
        player.x = Math.max(player.radius, Math.min(w - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(h - player.radius, player.y));

        // Update facing direction immediately from input (responsive orientation)
        if (this.playerSprite) {
            if (mx !== 0 || my !== 0) {
                // Prefer horizontal when present, else vertical
                if (mx !== 0) this.lastDir = mx < 0 ? 'left' : 'right';
                else if (my !== 0) this.lastDir = my < 0 ? 'up' : 'down';
                this.playerSprite.setDir(this.lastDir);
            }
        }

        // Aura damage application
        const auraLevel = (player as any).auraLevel || 0;
        if (auraLevel > 0) {
            const radius = auraRadiusAt(auraLevel);
            const dps = auraDpsAt(auraLevel); // centralized aura DPS calc
            const auraG: PIXI.Graphics = (player as any).auraG;
            if (auraG) {
                auraG.clear();
                auraG.circle(0, 0, radius).fill({ color: 0x66ffcc, alpha: 0.15 }).stroke({ color: 0x66ffcc, width: 2, alpha: 0.5 });
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
            const auraG: PIXI.Graphics = (player as any).auraG; if (auraG) auraG.clear();
        }

        // Orbiting scriptures
        const orbitCount = ((player as any).magicOrbCount) || 0;
        if (orbitCount > 0) {
            const orbitG: PIXI.Container = (player as any).orbitG;
            while (orbitG.children.length < orbitCount) {
                const g = new PIXI.Graphics();
                g.circle(0, 0, 6).fill({ color: 0xffe0b2 }).stroke({ color: 0xffb74d, width: 2 });
                orbitG.addChild(g);
            }
            while (orbitG.children.length > orbitCount) { orbitG.removeChildAt(orbitG.children.length - 1); }
            const radius = POWERS_VALUES.MAGIC_ORB_RADIUS;
            const dmg = ((player as any).magicOrbDamage) || POWERS_VALUES.MAGIC_ORB_BASE_DAMAGE;
            for (let i = 0; i < orbitG.children.length; i++) {
                const angle = this.gs.time * 2 + (i / orbitG.children.length) * Math.PI * 2;
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
                        const last = (m as any)._lastOrbitHit || 0;
                        if (this.gs.time - last >= 1) {
                            m.hp = (m.hp || 0) - dmg; // single chunk
                            (m as any)._lastOrbitHit = this.gs.time;
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
                this.gs.kills++;
                const elite = (m as any).elite;
                if (elite) this.spawnXp(m.x, m.y, 20, true); else this.spawnXp(m.x, m.y, 2);
                rollShardDrop(this.gs, { app: this.app, sprites: this.sprites }, m.x, m.y, elite);
                passiveDeaths.push(m.id);
            }
        }

        const toRemove: number[] = [...passiveDeaths];
        for (const e of this.gs.entities.values()) {
            if (e.kind === 'player') continue;
            if (e.kind === 'mob') {
                const dx = player.x - e.x; const dy = player.y - e.y; const len = Math.hypot(dx, dy) || 1;
                e.vx = (dx / len) * (e.speed || 60);
                e.vy = (dy / len) * (e.speed || 60);
                e.x += e.vx * dt; e.y += e.vy * dt;
                const r = player.radius + e.radius;
                if (distSq(player.x, player.y, e.x, e.y) < r * r) {
                    this.damagePlayer(e.damage || 5);
                    // slight pushback after collision to reduce repeated hits
                    const push = 10;
                    const dxn = (player.x - e.x); const dyn = (player.y - e.y); const lenp = Math.hypot(dxn, dyn) || 1;
                    player.x += (dxn / lenp) * push; player.y += (dyn / lenp) * push;
                }
                // Update mob health bar (only show if damaged)
                const hpBar: PIXI.Graphics | undefined = (e as any).hpRing;
                if (hpBar) {
                    if (e.hp! < e.maxHp! && e.hp! > 0) {
                        const pct = Math.max(0, e.hp! / (e.maxHp! || 1));
                        const wBar = e.radius * 2 + 4;
                        const hBar = 5;
                        const x0 = -wBar / 2;
                        const y0 = -e.radius - 9;
                        hpBar.clear();
                        hpBar.rect(x0, y0, wBar, hBar).fill({ color: 0x262d32, alpha: 0.9 });
                        hpBar.rect(x0 + 1, y0 + 1, (wBar - 2) * pct, hBar - 2).fill({ color: 0x4caf50 });
                    } else {
                        hpBar.clear();
                    }
                }
            } else if (e.kind === 'projectile') {
                e.x += e.vx * dt; e.y += e.vy * dt;
                e.life! -= dt;
                if (e.life! <= 0) { toRemove.push(e.id); continue; }
                for (const m of this.gs.entities.values()) {
                    if (m.kind !== 'mob') continue;
                    const r = m.radius + e.radius;
                    if (distSq(m.x, m.y, e.x, e.y) < r * r) {
                        m.hp! -= e.damage || 1;
                        spawnHitBurst(this.gs, { app: this.app, sprites: this.sprites }, e.x, e.y, 0xffd54f, 4);
                        playSound('hit');
                        toRemove.push(e.id);
                        if (m.hp! <= 0) {
                            this.gs.kills++;
                            const elite = (m as any).elite;
                            if (elite) this.spawnXp(m.x, m.y, 20, true); else this.spawnXp(m.x, m.y, 2);
                            rollShardDrop(this.gs, { app: this.app, sprites: this.sprites }, m.x, m.y, elite);
                            spawnHitBurst(this.gs, { app: this.app, sprites: this.sprites }, m.x, m.y, 0xff4d4d, 10);
                            toRemove.push(m.id);
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
                        toRemove.push(e.id);
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
                        const val = e.value || 1;
                        this.gs.runShards = (this.gs.runShards || 0) + val;
                        playSound('pickup');
                        toRemove.push(e.id);
                    }
                }
            } else if (e.kind === 'particle') {
                e.x += e.vx * dt; e.y += e.vy * dt;
                e.vx *= 0.9; e.vy *= 0.9;
                e.life! -= dt;
                if (e.life! <= 0) { toRemove.push(e.id); continue; }
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
            (sprite as any).x = e.x;
            (sprite as any).y = e.y;
            if (e.kind === 'particle') { (sprite as any).alpha = e.alpha ?? 1; }
            if (e.kind === 'xp' && (sprite as any).pulse) {
                const elite = (sprite as any).elite;
                const amp = elite ? 0.1 : 0.06;
                const speed = elite ? 5 : 4;
                const s = 1 + Math.sin(this.gs.time * speed + e.id) * amp;
                (sprite as any).scale.set(s);
            } else if (e.kind === 'shard' && (sprite as any).spin) {
                const t = this.gs.time * 6 + e.id;
                (sprite as any).rotation = t;
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
        }

        this.updateHud();
        this.updateStatsOverlay();
    };

    spawnShard(x: number, y: number, value: number) { spawnShard(this.gs, { app: this.app, sprites: this.sprites }, x, y, value); }
    rollShardDrop(x: number, y: number, elite: boolean) { rollShardDrop(this.gs, { app: this.app, sprites: this.sprites }, x, y, elite); }
    spawnElite() { spawnElite(this.gs, { app: this.app, sprites: this.sprites }); }

    updateStatsOverlay() { updateStatsOverlay(this.gs); }
}
