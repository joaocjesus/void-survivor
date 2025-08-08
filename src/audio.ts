// Simple procedural sound generation using Web Audio API
// Avoids needing binary assets; generates short blips and bursts.

let ctx: AudioContext | null = null;
let unlocked = false;

function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
}

// Unlock audio on first user input
['pointerdown', 'keydown'].forEach(ev => {
    window.addEventListener(ev, () => { if (!unlocked) { ensureCtx(); unlocked = true; } }, { once: true });
});

interface ToneOpts { freq: number; dur: number; type?: OscillatorType; vol?: number; decay?: number; detune?: number; }

function tone({ freq, dur, type = 'sine', vol = 0.25, decay = 0.002, detune = 0 }: ToneOpts) {
    if (!ctx) ensureCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq; osc.detune.value = detune || 0;
    gain.gain.setValueAtTime(vol, now);
    // exponential decay
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.001), now + dur - decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + dur);
}

function noiseHit(dur = 0.18, vol = 0.22) {
    if (!ctx) ensureCtx(); if (!ctx) return;
    const bufferSize = 0.15 * (ctx.sampleRate || 44100);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + dur);
}

let lastPlay: Record<string, number> = {};
function throttle(name: string, gapMs: number) {
    const now = performance.now();
    if ((lastPlay[name] || 0) + gapMs > now) return false;
    lastPlay[name] = now; return true;
}

export function playSound(id: 'shoot' | 'hit' | 'pickup' | 'level' | 'aura') {
    // Best-effort late init if somehow not unlocked yet but a sound is requested after interaction
    if (!unlocked) { ensureCtx(); }
    if (!ctx) return;
    switch (id) {
        case 'shoot':
            if (!throttle('shoot', 40)) return;
            // Primary low-mid body (slightly higher & louder for presence)
            tone({ freq: 260 + Math.random() * 25, dur: 0.09, type: 'square', vol: 0.22, decay: 0.03, detune: (Math.random() - 0.5) * 25 });
            // Add a faint upper harmonic for intelligibility
            setTimeout(() => tone({ freq: 520 + Math.random() * 30, dur: 0.06, type: 'square', vol: 0.08, decay: 0.025, detune: (Math.random() - 0.5) * 15 }), 4);
            // Sub layer (still quiet) for weight
            setTimeout(() => tone({ freq: 130 + Math.random() * 15, dur: 0.05, type: 'sine', vol: 0.06, decay: 0.03 }), 6);
            // Tiny noise click to help it cut through when many sounds overlap
            try { noiseHit(0.045, 0.10); } catch { /* ignore */ }
            break;
        case 'hit':
            noiseHit(0.15, 0.25);
            tone({ freq: 180 + Math.random() * 40, dur: 0.12, type: 'sawtooth', vol: 0.15 });
            break;
        case 'pickup':
            if (!throttle('pickup', 30)) return;
            tone({ freq: 880, dur: 0.07, type: 'triangle', vol: 0.16 });
            tone({ freq: 1320, dur: 0.05, type: 'triangle', vol: 0.12 });
            break;
        case 'level':
            tone({ freq: 520, dur: 0.18, type: 'triangle', vol: 0.22 });
            setTimeout(() => tone({ freq: 780, dur: 0.22, type: 'triangle', vol: 0.18 }), 60);
            break;
        case 'aura':
            if (!throttle('aura', 400)) return;
            tone({ freq: 300 + Math.random() * 40, dur: 0.2, type: 'sine', vol: 0.08 });
            break;
    }
}
