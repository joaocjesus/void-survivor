import { MetaSave } from '../types';
import { refundAllMeta, refundState, computeSpentShards } from '../meta';

export function updateRefundButton(meta: MetaSave, refundBtn: HTMLButtonElement | null) {
    if (!refundBtn) return;
    const state = refundState(meta);
    refundBtn.disabled = state.disabled;
    // Force attribute sync (some browsers may leave attribute lingering)
    if (state.disabled) {
        refundBtn.setAttribute('disabled', 'true');
    } else {
        refundBtn.removeAttribute('disabled');
    }
    // Accessibility state
    refundBtn.setAttribute('aria-disabled', state.disabled ? 'true' : 'false');
    refundBtn.classList.toggle('disabled', refundBtn.disabled);
    refundBtn.title = state.disabled ? 'No purchased upgrades to refund' : '';
    // Debug log
    try { console.info('[meta] updateRefundButton', { spent: state.spent, disabled: state.disabled }); } catch { }
}

export function handleRefundClick(meta: MetaSave, shardsEl: HTMLElement | null, refundBtn: HTMLButtonElement | null, confirmFn: (msg: string) => boolean = (msg) => window.confirm(msg), alertFn: (msg: string) => void = (msg) => window.alert(msg)) {
    const spent = computeSpentShards(meta);
    try { console.info('[meta] handleRefundClick invoked', { spent }); } catch { }
    if (spent === 0) { try { console.info('[meta] No spent shards to refund'); } catch { } return; }
    let proceed = true;
    try {
        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        proceed = confirmFn('Refund all purchased meta upgrades? You will get all spent shards back.');
        const dt = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
        // Heuristic: if confirm returned false almost instantly (<30ms), dialogs may be blocked -> auto proceed
        if (!proceed && dt < 30) {
            console.info('[meta] confirm likely suppressed (dt=' + dt.toFixed(2) + 'ms); auto-refunding');
            proceed = true;
        }
    } catch { /* ignore & proceed */ }
    if (!proceed) { try { console.info('[meta] Refund cancelled by user'); } catch { } return; }
    const { refunded } = refundAllMeta(meta);
    if (shardsEl) shardsEl.textContent = `Shards: ${meta.shards}`;
    updateRefundButton(meta, refundBtn);
    try { alertFn(`Refunded ${refunded} shards.`); } catch { }
    return refunded;
}
