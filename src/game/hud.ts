import { GameState } from '../types';

// Formatting helpers
export function formatXp(v: number): string {
    const rounded = Math.round(v * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded));
    if (Math.abs(rounded * 10 - Math.round(rounded * 10)) < 1e-6) return rounded.toFixed(1);
    return rounded.toFixed(2);
}

export function updateHud(gs: GameState) {
    const timeEl = document.getElementById('time'); if (timeEl) timeEl.textContent = String(Math.floor(gs.time));
    const killsEl = document.getElementById('kills'); if (killsEl) killsEl.textContent = String(gs.kills);
    const shardTotal = gs.meta.shards + (gs.runShards || 0);
    const shardEl = document.getElementById('metaShards'); if (shardEl) shardEl.textContent = `Shards: ${shardTotal}`;
    const runShardEl = document.getElementById('runShards'); if (runShardEl) runShardEl.textContent = String(gs.runShards || 0);
    const totalShardEl = document.getElementById('totalShards'); if (totalShardEl) totalShardEl.textContent = String(shardTotal);
    const levelEl = document.getElementById('level'); if (levelEl) levelEl.textContent = String(gs.level);
    // XP bar
    const pctXp = (gs.xp / gs.xpNeeded) * 100;
    const xpBarDiv = document.getElementById('xpBar') as HTMLElement | null;
    if (xpBarDiv) xpBarDiv.style.width = pctXp + '%';
    const xpBarLabel = document.getElementById('xpBarLabel') as HTMLElement | null;
    const statsVisible = (gs as any)._statsVisible;
    if (xpBarLabel) {
        if (statsVisible) {
            xpBarLabel.style.display = 'block';
            xpBarLabel.textContent = `${formatXp(gs.xp)} / ${gs.xpNeeded} (${Math.floor(pctXp)}%)`;
            const centerCovered = pctXp >= 50;
            xpBarLabel.style.color = centerCovered ? '#07130a' : '#ffffff';
            xpBarLabel.style.textShadow = centerCovered ? '0 1px 2px rgba(255,255,255,.4)' : '0 1px 2px rgba(0,0,0,.6)';
        } else {
            xpBarLabel.style.display = 'none';
        }
    }
    // HP
    const player = gs.entities.get(gs.playerId);
    if (player) {
        (document.getElementById('hp'))!.textContent = Math.round(player.hp || 0).toString();
        (document.getElementById('hpMax'))!.textContent = Math.round(player.maxHp || 0).toString();
        const pct = ((player.hp || 0) / (player.maxHp || 1)) * 100;
        const hpBar = document.getElementById('hpBar') as HTMLElement | null; if (hpBar) hpBar.style.width = pct + '%';
    }
}

export function updateStatsOverlay(gs: GameState) {
    const el = document.getElementById('statsContent');
    const wrap = document.getElementById('statsOverlay');
    if (!el || !wrap) return;
    if (!(gs as any)._statsVisible) {
        wrap.classList.remove('stats-visible');
        wrap.classList.add('stats-hidden');
        return;
    }
    wrap.classList.remove('stats-hidden');
    wrap.classList.add('stats-visible');
    const p = gs.entities.get(gs.playerId)!;
    const rows: [string, string][] = [];
    rows.push(['Level', String(gs.level)]);
    rows.push(['XP', `${Math.floor(gs.xp)}/${gs.xpNeeded}`]);
    rows.push(['Kills', String(gs.kills)]);
    rows.push(['HP', `${Math.round(p.hp || 0)}/${Math.round(p.maxHp || 0)}`]);
    rows.push(['Base Damage', String(p.damage || 0)]);
    rows.push(['Attack Speed', (p.attackSpeed || 1).toFixed(2)]);
    rows.push(['Move Speed', String(Math.round(p.speed || 0))]);
    rows.push(['Projectile Speed', String(Math.round(p.projectileSpeed || 0))]);
    rows.push(['Pickup Range', String(Math.round(p.pickupRange || 0))]);
    rows.push(['Regeneration', `${(p.regen || 0).toFixed(2)}/s`]);
    rows.push(['XP Gain', 'x' + (p.xpGain || 1).toFixed(2)]);
    const auraLevel = (p as any).auraLevel || 0; if (auraLevel > 0) rows.push(['Magic Aura', String(auraLevel)]);
    const orbCount = ((p as any).magicOrbCount ?? (p as any).orbitCount) || 0; if (orbCount > 0) rows.push(['Magic Orbs', String(orbCount)]);
    const grid = rows.map(r => `<div class='stat-label'>${r[0]}</div><div class='stat-val'>${r[1]}</div>`).join('');
    if (!document.getElementById('statsGridStyle')) {
        const st = document.createElement('style'); st.id = 'statsGridStyle';
        st.textContent = `.stats-grid{display:grid;grid-template-columns:auto auto;column-gap:16px;row-gap:4px;margin-top:4px;font-size:12px}.stats-grid .stat-label{opacity:.7;padding-right:4px;}.stats-grid .stat-val{text-align:right;font-weight:600;color:#fff;}`;
        document.head.appendChild(st);
    }
    el.innerHTML = `<div class='stats-grid'>${grid}</div>`;
}
