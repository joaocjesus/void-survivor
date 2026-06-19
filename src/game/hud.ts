import { GameState } from '../types';

interface HudElements {
    time: HTMLElement | null;
    kills: HTMLElement | null;
    metaShards: HTMLElement | null;
    runShards: HTMLElement | null;
    level: HTMLElement | null;
    xpBar: HTMLElement | null;
    xpBarLabel: HTMLElement | null;
    hp: HTMLElement | null;
    hpMax: HTMLElement | null;
    hpBar: HTMLElement | null;
}

let hudElements: HudElements | null = null;
let statsElements: { content: HTMLElement; wrap: HTMLElement; } | null = null;
let lastStatsVisible: boolean | undefined;
let lastStatsHtml = '';

function getById<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

function cacheHudElements(): HudElements {
    if (hudElements?.time?.isConnected) return hudElements;
    hudElements = {
        time: getById('time'),
        kills: getById('kills'),
        metaShards: getById('metaShards'),
        runShards: getById('runShards'),
        level: getById('level'),
        xpBar: getById('xpBar'),
        xpBarLabel: getById('xpBarLabel'),
        hp: getById('hp'),
        hpMax: getById('hpMax'),
        hpBar: getById('hpBar'),
    };
    return hudElements;
}

function cacheStatsElements() {
    if (statsElements?.content.isConnected && statsElements.wrap.isConnected) return statsElements;
    const content = getById('statsContent');
    const wrap = getById('statsOverlay');
    statsElements = content && wrap ? { content, wrap } : null;
    lastStatsVisible = undefined;
    lastStatsHtml = '';
    return statsElements;
}

function setText(el: HTMLElement | null, value: string) {
    if (el && el.textContent !== value) el.textContent = value;
}

function setDisplay(el: HTMLElement | null, value: string) {
    if (el && el.style.display !== value) el.style.display = value;
}

function setWidth(el: HTMLElement | null, value: string) {
    if (el && el.style.width !== value) el.style.width = value;
}

// Formatting helpers
export function formatXp(v: number): string {
    const rounded = Math.round(v * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded));
    if (Math.abs(rounded * 10 - Math.round(rounded * 10)) < 1e-6) return rounded.toFixed(1);
    return rounded.toFixed(2);
}

export function formatRunTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const s = total % 60;
    const minutesTotal = Math.floor(total / 60);
    const m = minutesTotal % 60;
    const h = Math.floor(minutesTotal / 60);
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function updateHud(gs: GameState) {
    const els = cacheHudElements();
    setText(els.time, formatRunTime(gs.time));
    setText(els.kills, String(gs.kills));
    const shardTotal = gs.meta.shards + (gs.runShards || 0);
    setText(els.metaShards, `Shards: ${shardTotal}`);
    setText(els.runShards, String(gs.runShards || 0));
    setText(els.level, String(gs.level));
    // XP bar
    const pctXp = (gs.xp / gs.xpNeeded) * 100;
    const statsVisible = gs.statsVisible;
    setWidth(els.xpBar, pctXp + '%');
    if (els.xpBarLabel) {
        if (statsVisible) {
            setDisplay(els.xpBarLabel, 'block');
            setText(els.xpBarLabel, `${formatXp(gs.xp)} / ${gs.xpNeeded} (${Math.floor(pctXp)}%)`);
            const centerCovered = pctXp >= 50;
            const color = centerCovered ? '#07130a' : '#ffffff';
            const shadow = centerCovered ? '0 1px 2px rgba(255,255,255,.4)' : '0 1px 2px rgba(0,0,0,.6)';
            if (els.xpBarLabel.style.color !== color) els.xpBarLabel.style.color = color;
            if (els.xpBarLabel.style.textShadow !== shadow) els.xpBarLabel.style.textShadow = shadow;
        } else {
            setDisplay(els.xpBarLabel, 'none');
        }
    }
    // HP
    const player = gs.entities.get(gs.playerId);
    if (player) {
        setText(els.hp, Math.round(player.hp || 0).toString());
        setText(els.hpMax, Math.round(player.maxHp || 0).toString());
        const pct = ((player.hp || 0) / (player.maxHp || 1)) * 100;
        setWidth(els.hpBar, pct + '%');
    }
}

export function updateStatsOverlay(gs: GameState) {
    const els = cacheStatsElements();
    if (!els) return;
    if (!gs.statsVisible) {
        if (lastStatsVisible !== false) {
            els.wrap.classList.remove('stats-visible');
            els.wrap.classList.add('stats-hidden');
            lastStatsVisible = false;
        }
        return;
    }
    if (lastStatsVisible !== true) {
        els.wrap.classList.remove('stats-hidden');
        els.wrap.classList.add('stats-visible');
        lastStatsVisible = true;
    }
    const p = gs.entities.get(gs.playerId)!;
    const rows: [string, string][] = [];
    const pct = (value: number | undefined, base: number | undefined) => `${Math.round(((value ?? base ?? 0) / (base || 1)) * 100)}%`;
    rows.push(['Level', String(gs.level)]);
    rows.push(['XP', `${Math.floor(gs.xp)}/${gs.xpNeeded}`]);
    rows.push(['Kills', String(gs.kills)]);
    rows.push(['HP', `${Math.round(p.hp || 0)}/${Math.round(p.maxHp || 0)}`]);
    rows.push(['Base Damage', String(p.damage || 0)]);
    rows.push(['Attack Speed', `${(p.attackSpeed || 1).toFixed(2)}x`]);
    rows.push(['Move Speed', pct(p.speed, gs.startStats.speed)]);
    rows.push(['Bolt Speed', pct(p.boltSpeed, gs.startStats.boltSpeed)]);
    rows.push(['Pickup Range', `${Math.round(p.pickupRange || 0)} px`]);
    rows.push(['Regeneration', `${(p.regen || 0).toFixed(2)} HP/s`]);
    rows.push(['XP Gain', `${Math.round((p.xpGain || 1) * 100)}%`]);
    const auraLevel = p.auraLevel || 0; if (auraLevel > 0) rows.push(['Magic Aura', String(auraLevel)]);
    const orbCount = p.magicOrbCount || 0; if (orbCount > 0) rows.push(['Magic Orbs', String(orbCount)]);
    const grid = rows.map(r => `<div class='stat-label'>${r[0]}</div><div class='stat-val'>${r[1]}</div>`).join('');
    if (!document.getElementById('statsGridStyle')) {
        const st = document.createElement('style'); st.id = 'statsGridStyle';
        st.textContent = `.stats-grid{display:grid;grid-template-columns:auto auto;column-gap:16px;row-gap:4px;margin-top:4px;font-size:12px}.stats-grid .stat-label{opacity:.7;padding-right:4px;}.stats-grid .stat-val{text-align:right;font-weight:600;color:#fff;}`;
        document.head.appendChild(st);
    }
    const html = `<div class='stats-grid'>${grid}</div>`;
    if (html !== lastStatsHtml) {
        els.content.innerHTML = html;
        lastStatsHtml = html;
    }
}
