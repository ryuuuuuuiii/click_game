/* ================================================================
   audio.js — Web Audio API synthesized SFX (zero external files)
   ================================================================ */

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.volume = 0.25;
    }

    /* ── helpers ─────────────────────────────────────────────────── */

    ensure() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    /** Simple tone (oscillator → gain envelope). */
    tone(freq, type, dur, vol = this.volume, detune = 0) {
        this.ensure();
        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gn  = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (detune) osc.detune.setValueAtTime(detune, t);
        gn.gain.setValueAtTime(vol, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gn).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
    }

    /** White-noise burst (for percussive / explosion sounds). */
    noise(dur, vol = this.volume) {
        this.ensure();
        const t   = this.ctx.currentTime;
        const len = Math.ceil(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const gn = this.ctx.createGain();
        gn.gain.setValueAtTime(vol, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(gn).connect(this.ctx.destination);
        src.start(t);
    }

    /** Sweep — oscillator with frequency ramp (for whoosh). */
    sweep(startFreq, endFreq, type, dur, vol = this.volume) {
        this.ensure();
        const t   = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gn  = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
        gn.gain.setValueAtTime(vol, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gn).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
    }

    /* ── game SFX ───────────────────────────────────────────────── */

    tick() {
        // Sharp mechanical click
        this.noise(0.015, 0.1);
        this.tone(1200, 'square', 0.02, 0.05);
    }

    error() {
        // Harsh buzzer
        this.tone(120, 'sawtooth', 0.25, 0.25);
        this.tone(125, 'square', 0.25, 0.2);
    }

    wordComplete() {
        this.tone(523, 'sine', 0.07, 0.15);
        setTimeout(() => this.tone(784, 'sine', 0.10, 0.15), 55);
    }

    combo() {
        setTimeout(() => this.tone(523, 'sine', 0.08, 0.14), 0);
        setTimeout(() => this.tone(659, 'sine', 0.08, 0.14), 50);
        setTimeout(() => this.tone(784, 'sine', 0.12, 0.14), 100);
    }

    slash() {
        this.sweep(900, 80, 'sawtooth', 0.28, 0.22);
        this.noise(0.10, 0.10);
    }

    bladeSpinSound() {
        // High-pitched metallic ring / spinning blade whoosh
        this.sweep(1200, 300, 'sine', 0.25, 0.25);
        this.noise(0.15, 0.15); // slice noise
        
        // Rapid spinning pulses
        this.tone(800, 'triangle', 0.05, 0.15);
        setTimeout(() => this.tone(750, 'triangle', 0.05, 0.15), 40);
        setTimeout(() => this.tone(700, 'triangle', 0.05, 0.15), 80);
        setTimeout(() => this.tone(650, 'triangle', 0.05, 0.15), 120);
    }

    gunshot() {
        this.noise(0.12, 0.35);
        this.tone(140, 'square', 0.09, 0.25);
    }

    explosion() {
        this.noise(0.55, 0.40);
        this.tone(55, 'sine',   0.55, 0.30);
        this.tone(38, 'sine',   0.80, 0.22);
        this.sweep(200, 30, 'sawtooth', 0.4, 0.15);
    }

    gameOver() {
        this.tone(440, 'sine', 0.2, 0.2);
        setTimeout(() => this.tone(330, 'sine', 0.2, 0.2), 200);
        setTimeout(() => this.tone(220, 'sine', 0.5, 0.25), 400);
    }
}
