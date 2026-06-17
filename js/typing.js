/* ================================================================
   typing.js — Strict index 0 typing system for pure letter queue
   ================================================================ */



export class TypingSystem {
    /**
     * @param {QueueManager}    queueManager
     * @param {FinisherManager} finisherManager
     * @param {HUD}             hud
     * @param {AudioManager}    audio
     * @param {ParticleEmitter} particles
     * @param {string}          eliminationEffect
     */
    constructor(queueManager, finisherManager, hud, audio, particles, eliminationEffect) {
        this.queueManager    = queueManager;
        this.finisherManager = finisherManager;
        this.hud             = hud;
        this.audio           = audio;
        this.particles       = particles;
        this.eliminationEffect = eliminationEffect;

        this.enabled = false;
        this.onAllComplete = null;
        this.onLetterDestroyed = null;
        this.onCorrectKeystroke = null;
        this.onErrorKeystroke = null;
        this.onTimeFreeze = null;
        this._lastHitTime = null;

        this._onKeyDown = this._handleKey.bind(this);
    }

    enable() {
        this.enabled = true;
        document.addEventListener('keydown', this._onKeyDown);
        this._showUpcomingTargets();
    }

    disable() {
        this.enabled = false;
        document.removeEventListener('keydown', this._onKeyDown);
    }

    /* ── main key handler ───────────────────────────────────────── */

    _handleKey(e) {
        if (!this.enabled) return;
        if (e.key.length !== 1) return;            // ignore specials
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();

        const key = e.key.toUpperCase();
        const target = this.queueManager.getFrontTarget();

        if (!target) return; // queue empty

        const expected = target.char;

        if (key === expected) {
            // ── correct keystroke ──
            const now = Date.now();
            if (this._lastHitTime && now - this._lastHitTime > 500) {
                this.hud.resetCombo();
            }
            this._lastHitTime = now;

            this.hud.recordKeystroke(true);
            this.audio.tick();
            if (this.onCorrectKeystroke) this.onCorrectKeystroke();
            
            const pos = target.getLetterWorldPosition();
            this._emitLetterSpark(pos);
            
            this._destroyTarget(target);

            // Power-Ups
            if (target.isGolden && !target.failedGolden) {
                if (Math.random() < 0.5) {
                    if (this.onTimeFreeze) this.onTimeFreeze();
                    
                    // Visual feedback for time freeze
                    const fl = document.getElementById('screen-flash');
                    fl.style.background = 'rgba(0, 240, 255, 0.4)';
                    fl.style.opacity = '1';
                    gsap.to(fl, { opacity: 0, duration: 1.0 });
                } else {
                    // Bomb powerup - clear next 3 letters
                    const fl = document.getElementById('screen-flash');
                    fl.style.background = 'rgba(255, 204, 0, 0.4)';
                    fl.style.opacity = '1';
                    gsap.to(fl, { opacity: 0, duration: 0.5 });

                    setTimeout(() => {
                        for(let i=0; i<3; i++) {
                            const t = this.queueManager.getFrontTarget();
                            if (t) {
                                this.finisherManager.execute(this.eliminationEffect, t);
                                this.hud.addScore(30);
                                this.queueManager.advanceQueue();
                                if (this.onLetterDestroyed) this.onLetterDestroyed();
                            }
                        }
                        this._showUpcomingTargets();
                        if (this.queueManager.isAllDefeated() && this.onAllComplete) {
                            setTimeout(() => this.onAllComplete(), 800);
                        }
                    }, 50);
                }
            }

        } else {
            // ── wrong keystroke ──
            this._lastHitTime = null;
            this.hud.recordKeystroke(false);
            target.typeError();
            this.audio.error();
            if (this.onErrorKeystroke) this.onErrorKeystroke();
            this.hud.flashTargetError();
            this._flashError();
            this.hud.resetCombo();
        }
    }

    /* ── Target destroyed ───────────────────────────────────────── */

    _destroyTarget(target) {
        // scoring
        this.hud.incrementCombo();
        const pts = Math.floor(10 * (1 + (this.hud.combo * 0.1)));
        this.hud.addScore(pts);

        if (target.char === ' ') {
            this.hud.wordCompleted();
            this.audio.wordComplete();
        }

        if (this.hud.combo > 0 && this.hud.combo % 10 === 0) this.audio.combo();

        // Trigger selected finisher
        this.finisherManager.execute(this.eliminationEffect, target);

        // Advance queue
        const next = this.queueManager.advanceQueue();
        if (this.onLetterDestroyed) this.onLetterDestroyed();

        if (next) {
            this._showUpcomingTargets();
        } else {
            this.hud.clearTargetWord();
            if (this.onAllComplete) setTimeout(() => this.onAllComplete(), 800);
        }
    }

    /* ── HUD upcoming display ───────────────────────────────────── */

    _showUpcomingTargets() {
        // Grab the next ~15 characters from the queue to show in HUD
        const upcoming = [];
        let idx = this.queueManager.frontIdx;
        while (idx < this.queueManager.targets.length && upcoming.length < 15) {
            upcoming.push(this.queueManager.targets[idx].char);
            idx++;
        }
        this.hud.setUpcomingLetters(upcoming);
    }

    /* ── helpers ─────────────────────────────────────────────────── */

    _emitLetterSpark(pos) {
        this.particles.emit({
            position: pos, count: 8,
            colors: [0x00f0ff, 0x00ff88, 0xffffff],
            size: 0.07, speed: 2, lifetime: 0.45, gravity: -2, spread: 0.5,
        });
    }

    _flashError() {
        const el = document.getElementById('error-flash');
        el.style.opacity = '1';
        gsap.to(el, { opacity: 0, duration: 0.18 });
    }
}
