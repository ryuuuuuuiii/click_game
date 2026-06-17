/* ================================================================
   main.js — Boot & state machine  (MENU ↔ PLAYING ↔ GAME_OVER)
   ================================================================ */

console.log("main.js script is executing!");

import { Menu } from './menu.js';
import { Game } from './game.js';
import { LEVELS } from './levels.js';

class App {
    constructor() {
        this.menu          = new Menu();
        this.game          = null;
        this.currentConfig = null;
        this.state         = 'MENU';

        this._init();
    }

    _init() {
        // menu → game
        this.menu.onStart = (cfg) => this._startGame(cfg);

        // game-over buttons
        document.getElementById('play-again-btn')
            .addEventListener('click', () => this._playAgain());
        document.getElementById('back-menu-btn')
            .addEventListener('click', () => this._backToMenu());
        document.getElementById('next-level-btn')
            .addEventListener('click', () => this._nextLevel());
            
        // pause menu quit button
        document.getElementById('quit-btn')
            .addEventListener('click', () => {
                document.getElementById('pause-screen').classList.add('hidden');
                document.getElementById('pause-screen').classList.remove('opacity-100');
                this._backToMenu();
            });

        // show menu
        this.menu.show();
    }

    /* ── transitions ────────────────────────────────────────────── */

    _startGame(config) {
        this.state         = 'PLAYING';
        this.currentConfig = config;

        this.menu.hide();
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');

        this.game = new Game();
        this.game.init(config);
        this.game.onGameOver = () => { this.state = 'GAME_OVER'; };

        // one-frame delay so canvas is visible before first render
        requestAnimationFrame(() => this.game.start());
    }

    _playAgain() {
        if (this.game) this.game.cleanup();
        document.getElementById('game-over-screen').classList.add('hidden');
        this._startGame(this.currentConfig);
    }

    _nextLevel() {
        if (this.game) this.game.cleanup();
        document.getElementById('game-over-screen').classList.add('hidden');
        
        if (this.currentConfig && this.currentConfig.gameMode === 'LEVEL_MODE') {
            const nextId = this.currentConfig.levelData.id + 1;
            const nextLevelData = LEVELS.find(l => l.id === nextId);
            
            if (nextLevelData) {
                this.currentConfig.levelData = nextLevelData;
                this.currentConfig.characters = nextLevelData.textData.replace(/\s+/g, ' ').split('');
                this._startGame(this.currentConfig);
            } else {
                // If there are no more levels, go back to menu
                this._backToMenu();
            }
        }
    }

    _backToMenu() {
        if (this.game) { this.game.cleanup(); this.game = null; }
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        this.state = 'MENU';
        this.menu.show();
    }
}

/* ── boot ────────────────────────────────────────────────────────── */
new App();
