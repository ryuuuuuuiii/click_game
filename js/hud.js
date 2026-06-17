/* ================================================================
   hud.js — DOM-based heads-up display (score, combo, WPM, accuracy)
   ================================================================ */

export class HUD {
    constructor() {
        this.scoreEl    = document.getElementById('score-value');
        this.comboEl    = document.getElementById('combo-value');
        this.wpmEl      = document.getElementById('wpm-value');
        this.accuracyEl = document.getElementById('accuracy-value');
        this.targetEl   = document.getElementById('target-word');
    }

    /* ── state ──────────────────────────────────────────────────── */

    reset() {
        this.score            = 0;
        this.combo            = 0;
        this.maxCombo         = 0;
        this.wordsCompleted   = 0;
        this.totalKeystrokes  = 0;
        this.correctKeystrokes = 0;
        this.totalCharsTyped  = 0;
        this.startTime        = Date.now();

        this._updateAll();
        this.clearTargetWord();
    }

    /* ── score ──────────────────────────────────────────────────── */

    addScore(pts) {
        this.score += pts;
        this._pop(this.scoreEl);
        this.scoreEl.textContent = this.score.toLocaleString();
    }

    /* ── combo ──────────────────────────────────────────────────── */

    incrementCombo() {
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.comboEl.textContent = `x${this.combo}`;
        this._pop(this.comboEl);
        
        if (this.combo > 10) {
            document.getElementById('game-screen').classList.add('high-combo-pulse');
        }
    }

    resetCombo() {
        this.combo = 0;
        this.comboEl.textContent = 'x0';
        document.getElementById('game-screen').classList.remove('high-combo-pulse');
    }

    /* ── keystrokes / WPM / accuracy ────────────────────────────── */

    recordKeystroke(correct) {
        this.totalKeystrokes++;
        if (correct) {
            this.correctKeystrokes++;
            this.totalCharsTyped++;
        }
        this._updateAccuracy();
        this._updateWPM();
    }

    wordCompleted() { this.wordsCompleted++; }

    /* ── target word display ────────────────────────────────────── */

    setUpcomingLetters(letters) {
        this.targetEl.innerHTML = '';
        for (let i = 0; i < letters.length; i++) {
            const span = document.createElement('span');
            // render spaces as middle-dot for visibility
            span.textContent = letters[i] === ' ' ? '·' : letters[i];

            if (i === 0) span.className = 'letter current';
            else         span.className = 'letter';

            this.targetEl.appendChild(span);
        }
    }

    flashTargetError() {
        this.targetEl.classList.remove('error-flash');
        void this.targetEl.offsetWidth;            // reflow to restart anim
        this.targetEl.classList.add('error-flash');
    }

    clearTargetWord() {
        this.targetEl.innerHTML =
            '<span class="no-target">Type the first letter to lock on…</span>';
    }

    /* ── stats snapshot (for game-over) ─────────────────────────── */

    getStats() {
        const mins = this.startTime
            ? (Date.now() - this.startTime) / 60_000
            : 0;
        return {
            score:          this.score,
            wordsCompleted: this.wordsCompleted,
            wpm:            mins > 0 ? Math.round((this.totalCharsTyped / 5) / mins) : 0,
            accuracy:       this.totalKeystrokes
                ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100)
                : 100,
            maxCombo:       this.maxCombo,
        };
    }

    /* ── private helpers ────────────────────────────────────────── */

    _updateWPM() {
        if (!this.startTime) return;
        const mins = (Date.now() - this.startTime) / 60_000;
        if (mins <= 0) return;
        this.wpmEl.textContent = Math.round((this.totalCharsTyped / 5) / mins);
    }

    _updateAccuracy() {
        if (this.totalKeystrokes === 0) { this.accuracyEl.textContent = '100%'; return; }
        const acc = Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100);
        this.accuracyEl.textContent = `${acc}%`;
    }

    _updateAll() {
        this.scoreEl.textContent    = '0';
        this.comboEl.textContent    = 'x0';
        this.wpmEl.textContent      = '0';
        this.accuracyEl.textContent = '100%';
    }

    _pop(el) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
    }
}
