import { Game } from './game';
import { META_UPGRADES, buildStartStats, loadMeta, purchaseMeta, saveMeta } from './meta';

let currentGame: Game | null = null;
const meta = loadMeta();

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
        div.innerHTML = `<h3>${def.name} <span class='lvl'>${lvl}/${def.maxLevel}</span></h3><p>${def.description}</p><p style='margin:6px 0 26px;'>Cost: ${maxed ? '-' : cost}</p>`;
        if (!maxed) {
            const btn = document.createElement('button');
            btn.textContent = 'Buy';
            btn.disabled = meta.shards < cost;
            btn.onclick = () => { if (purchaseMeta(meta, def.id)) { renderMeta(); } };
            div.appendChild(btn);
        }
        list.appendChild(div);
    }
}

function show(id: string) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function hide(id: string) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function startRun() {
    hide('mainMenu'); hide('metaMenu');
    const root = document.getElementById('app');
    if (!root) throw new Error('Missing #app element');
    if (currentGame) { location.reload(); return; }
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
    const goMain = () => { show('mainMenu'); hide('metaMenu'); hide('instructionsMenu'); hide('settingsMenu'); };
    document.getElementById('btnStart')?.addEventListener('click', startRun);
    document.getElementById('btnMeta')?.addEventListener('click', () => { renderMeta(); hide('mainMenu'); show('metaMenu'); });
    document.getElementById('btnBackMeta')?.addEventListener('click', () => { hide('metaMenu'); show('mainMenu'); });
    document.getElementById('btnInstructions')?.addEventListener('click', () => { hide('mainMenu'); show('instructionsMenu'); });
    document.getElementById('btnBackInstructions')?.addEventListener('click', goMain);
    document.getElementById('btnSettings')?.addEventListener('click', () => { hide('mainMenu'); show('settingsMenu'); });
    document.getElementById('btnBackSettings')?.addEventListener('click', goMain);
    document.getElementById('btnResetMeta')?.addEventListener('click', () => {
        if (confirm('Reset all meta progress?')) { localStorage.clear(); location.reload(); }
    });
}

// Menu navigation (keyboard + controller)
let menuButtons: HTMLButtonElement[] = [];
let menuIndex = 0;
let lastMenuInput: 'keyboard' | 'gamepad' = 'keyboard';
function collectVisibleMenuButtons() {
    menuButtons = [];
    const menus = ['mainMenu', 'metaMenu', 'instructionsMenu', 'settingsMenu'];
    for (const id of menus) {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none') {
            const btns = Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
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
    const poll = () => {
        collectVisibleMenuButtons();
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads && pads[0];
        if (gp) {
            const buttons = gp.buttons.map(b => b.pressed);
            const axV = gp.axes[1] || 0;
            const dead = 0.35;
            const vDir = Math.abs(axV) > dead ? (axV > 0 ? 1 : -1) : 0;
            const axisUsed = vDir !== 0;
            const btnUsed = buttons.some((b, i) => b && [0, 12, 13].includes(i));
            if (axisUsed || btnUsed) lastMenuInput = 'gamepad';
            if (lastMenuInput === 'gamepad') {
                // D-pad up/down 12/13
                const up = (buttons[12] && !lastButtons[12]) || (vDir === -1 && lastAxisV !== -1);
                const down = (buttons[13] && !lastButtons[13]) || (vDir === 1 && lastAxisV !== 1);
                if (up) moveMenuFocus(-1);
                if (down) moveMenuFocus(1);
                if (buttons[0] && !lastButtons[0]) activateFocused(); // A
            }
            lastAxisV = vDir;
            lastButtons = buttons;
        }
        requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
}

function bootstrap() {
    wireMenu();
    show('mainMenu');
    collectVisibleMenuButtons();
    setupMenuInput();
    // Listen for in-game restart requests (Game Over restart button)
    window.addEventListener('voidsurvivor-restart', () => {
        const root = document.getElementById('app');
        if (!root) return;
        // Clear canvas / children if any prior game exists
        if (currentGame) {
            // crude reset by replacing root contents
            root.innerHTML = '';
            currentGame = null;
        }
        const startStats = buildStartStats(meta);
        currentGame = new Game(root, startStats, meta, onRunEnd);
    });
}

bootstrap();
