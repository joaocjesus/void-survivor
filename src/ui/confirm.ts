// Lightweight in-game confirmation modal (promise-based)
// Creates DOM elements lazily and reuses them.
export function confirmAction(message: string, { acceptText = 'Yes', cancelText = 'Cancel' } = {}): Promise<boolean> {
    return new Promise(resolve => {
        let root = document.getElementById('vsConfirmRoot');
        if (!root) {
            root = document.createElement('div');
            root.id = 'vsConfirmRoot';
            root.innerHTML = `<div class="vs-confirm-backdrop" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:1000;font-family:inherit;">
        <div class="vs-confirm-panel" style="background:#1f252b;padding:28px 30px 26px;border-radius:18px;min-width:300px;max-width:420px;box-shadow:0 12px 34px -8px rgba(0,0,0,.6);">
          <div class="vs-confirm-msg" style="font-size:16px;line-height:1.4;margin:0 0 22px;white-space:pre-wrap;">...</div>
          <div class="vs-confirm-buttons" style="display:flex;gap:14px;justify-content:flex-end;">
            <button class="vs-btn vs-cancel" style="padding:10px 18px;border-radius:10px;background:#2a333a;color:#c9d6df;border:1px solid #394854;cursor:pointer;">Cancel</button>
            <button class="vs-btn vs-accept" style="padding:10px 20px;border-radius:10px;background:#4caf50;color:#fff;border:1px solid #55c15a;cursor:pointer;font-weight:600;">Yes</button>
          </div>
          <div class="vs-confirm-hint" style="margin-top:14px;font-size:11px;opacity:.45;text-align:right;">Enter = Yes • Esc = Cancel</div>
        </div>
      </div>`;
            document.body.appendChild(root);
        }
        const backdrop = root.firstElementChild as HTMLDivElement;
        const panel = backdrop.querySelector('.vs-confirm-panel') as HTMLDivElement;
        const msgEl = panel.querySelector('.vs-confirm-msg') as HTMLDivElement;
        const acceptBtn = panel.querySelector('.vs-accept') as HTMLButtonElement;
        const cancelBtn = panel.querySelector('.vs-cancel') as HTMLButtonElement;
        acceptBtn.textContent = acceptText;
        cancelBtn.textContent = cancelText;
        msgEl.textContent = message;
        backdrop.style.display = 'flex';

        const clean = () => {
            backdrop.style.display = 'none';
            window.removeEventListener('keydown', keyHandler);
            acceptBtn.onclick = null as any; cancelBtn.onclick = null as any;
        };

        const finish = (v: boolean) => { clean(); resolve(v); };

        acceptBtn.onclick = () => finish(true);
        cancelBtn.onclick = () => finish(false);

        const keyHandler = (e: KeyboardEvent) => {
            if (e.code === 'Escape') { e.preventDefault(); finish(false); }
            if (e.code === 'Enter') { e.preventDefault(); finish(true); }
        };
        window.addEventListener('keydown', keyHandler);

        // Focus accept by default for keyboard traverse safety, but not auto-activating
        setTimeout(() => acceptBtn.focus(), 0);
    });
}
