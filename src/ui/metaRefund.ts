import { MetaSave } from '../types';
import { refundAllMeta, refundState, computeSpentShards } from '../meta';

export function updateRefundButton(meta: MetaSave, refundBtn: HTMLButtonElement | null) {
  if (!refundBtn) return;
  const state = refundState(meta);
  refundBtn.disabled = state.disabled;
  refundBtn.classList.toggle('disabled', refundBtn.disabled);
  refundBtn.title = state.disabled ? 'No purchased upgrades to refund' : '';
}

export function handleRefundClick(meta: MetaSave, shardsEl: HTMLElement | null, refundBtn: HTMLButtonElement | null, confirmFn: (msg: string) => boolean = (msg) => window.confirm(msg), alertFn: (msg: string) => void = (msg) => window.alert(msg)) {
  const spent = computeSpentShards(meta);
  if (spent === 0) return;
  let proceed = true;
  try { proceed = confirmFn('Refund all purchased meta upgrades? You will get all spent shards back.'); } catch { /* ignore */ }
  if (!proceed) return;
  const { refunded } = refundAllMeta(meta);
  if (shardsEl) shardsEl.textContent = `Shards: ${meta.shards}`;
  updateRefundButton(meta, refundBtn);
  try { alertFn(`Refunded ${refunded} shards.`); } catch { }
  return refunded;
}
