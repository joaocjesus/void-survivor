// Simple procedural sound generation using Web Audio API
// Avoids needing binary assets; generates short blips and bursts.

let ctx: AudioContext | null = null;
let unlocked = false;
const AUDIO_STORAGE_KEY = 'void_survivor_audio_v1';

export interface AudioSettings {
    muted: boolean;
    volume: number;
}

let settings: AudioSettings = loadAudioSettings();
let noiseBuffer: AudioBuffer | null = null;

function clampVolume(v: number) {
    if (!Number.isFinite(v)) return 0.75;
    return Math.max(0, Math.min(1, v));
}

function loadAudioSettings(): AudioSettings {
    try {
        const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                muted: Boolean(parsed.muted),
                volume: clampVolume(Number(parsed.volume)),
            };
        }
    } catch { }
    return { muted: false, volume: 0.75 };
}

function saveAudioSettings() {
    try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings)); } catch { }
}

export function getAudioSettings(): AudioSettings {
    return { ...settings };
}

export function setMuted(muted: boolean) {
    settings = { ...settings, muted };
    saveAudioSettings();
}

export function setMasterVolume(volume: number) {
    settings = { ...settings, volume: clampVolume(volume) };
    saveAudioSettings();
}

function effectiveVolume(vol: number) {
    if (settings.muted || settings.volume <= 0) return 0;
    return vol * settings.volume;
}

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
    vol = effectiveVolume(vol);
    if (vol <= 0) return;
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

function getNoiseBuffer() {
    if (!ctx) return null;
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const bufferSize = Math.floor(0.15 * (ctx.sampleRate || 44100));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    noiseBuffer = buffer;
    return noiseBuffer;
}

function noiseHit(dur = 0.18, vol = 0.22) {
    vol = effectiveVolume(vol);
    if (vol <= 0) return;
    if (!ctx) ensureCtx(); if (!ctx) return;
    const buffer = getNoiseBuffer();
    if (!buffer) return;
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
    if (settings.muted || settings.volume <= 0) return;
    // Best-effort late init if somehow not unlocked yet but a sound is requested after interaction
    if (!unlocked) { ensureCtx(); }
    if (!ctx) return;
    switch (id) {
        case 'shoot':
            if (!throttle('shoot', 80)) return;
            tone({ freq: 270 + Math.random() * 20, dur: 0.075, type: 'square', vol: 0.18, decay: 0.03, detune: (Math.random() - 0.5) * 18 });
            break;
        case 'hit':
            if (!throttle('hit', 35)) return;
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
