/* ================================================================
   menu.js — Lobby UI: Nested menus, Level Select, 3D Background
   ================================================================ */

import * as THREE from 'three';
import { LEVELS } from './levels.js';

const DEFAULT_TEXT = 'javascript function variable constant array string number boolean async await class module import export return promise';

export class Menu {
    constructor() {
        this.screen = document.getElementById('menu-screen');

        // Panels
        this.panels = {
            lobby: document.getElementById('panel-lobby'),
            play: document.getElementById('panel-play'),
            levels: document.getElementById('panel-levels'),
            custom: document.getElementById('panel-custom'),
            settings: document.getElementById('panel-settings')
        };

        // Inputs & Selectors
        this.textInput = document.getElementById('custom-text-input');
        this.themeSelector = document.getElementById('theme-selector');
        this.letterThemeSelector = document.getElementById('letter-theme-selector');
        this.effectSelector = document.getElementById('elimination-effect-selector');
        this.subtitleToggle = document.getElementById('subtitle-toggle');
        this.letterSizeSlider = document.getElementById('letter-size-slider');
        this.letterSizeDisplay = document.getElementById('letter-size-display');

        // Level Grid
        this.levelGrid = document.getElementById('level-grid');

        this.onStart = null; // callback(config)

        this.unlockedLevel = parseInt(localStorage.getItem('typestrike_unlocked_level')) || 1;

        // 3-D background handles
        this._bgScene = null;
        this._bgCamera = null;
        this._bgRenderer = null;
        this._bgRafId = null;
        this._bgParticles = null;
        this._bgShapes = [];
        this._bgResize = null;

        this._initEvents();
        this._loadSettings();
        this._buildLevelGrid();
    }

    /* ── panel navigation ───────────────────────────────────────── */

    switchPanel(targetId) {
        // Hide all
        Object.values(this.panels).forEach(panel => {
            panel.classList.add('translate-x-full', 'opacity-0', 'pointer-events-none');
            panel.classList.remove('z-20');
            panel.classList.add('z-10');
        });

        // Show target
        const target = this.panels[targetId.replace('panel-', '')];
        if (target) {
            target.classList.remove('translate-x-full', 'opacity-0', 'pointer-events-none');
            target.classList.add('z-20');
            target.classList.remove('z-10');
        }
    }

    /* ── level grid ─────────────────────────────────────────────── */

    _buildLevelGrid() {
        this.levelGrid.innerHTML = '';

        LEVELS.forEach(level => {
            const btn = document.createElement('button');
            const isUnlocked = level.id <= this.unlockedLevel;

            btn.className = `w-full aspect-square rounded-xl flex flex-col items-center justify-center font-title font-bold text-xl transition-all border-2 `;

            if (isUnlocked) {
                btn.className += 'bg-brand-magenta/20 border-brand-magenta text-white hover:bg-brand-magenta/40 hover:scale-105 shadow-[0_0_10px_rgba(255,0,170,0.2)] cursor-pointer';
                btn.innerHTML = `<span>${level.id}</span>`;
                btn.onclick = () => this._startLevel(level);
            } else {
                btn.className += 'bg-slate-800/40 border-slate-700 text-slate-500 cursor-not-allowed';
                btn.innerHTML = `<svg class="w-6 h-6 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg><span class="text-sm">${level.id}</span>`;
            }

            this.levelGrid.appendChild(btn);
        });
    }

    refreshLevels() {
        this.unlockedLevel = parseInt(localStorage.getItem('typestrike_unlocked_level')) || 1;
        this._buildLevelGrid();
    }

    /* ── events ─────────────────────────────────────────────────── */

    _initEvents() {
        // Navigation buttons
        document.getElementById('btn-play-menu').onclick = () => this.switchPanel('panel-play');
        document.getElementById('btn-settings-menu').onclick = () => this.switchPanel('panel-settings');
        document.getElementById('btn-campaign').onclick = () => this.switchPanel('panel-levels');
        document.getElementById('btn-custom').onclick = () => this.switchPanel('panel-custom');

        // Back buttons
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.onclick = (e) => {
                const target = e.target.getAttribute('data-target');
                if (target) this.switchPanel(target);
            };
        });

        // Start Custom Game
        document.getElementById('start-custom-btn').addEventListener('click', () => {
            this._saveSettings();
            if (this.onStart) this.onStart(this._buildConfig('CUSTOM_MODE'));
        });

        if (this.letterSizeSlider) {
            this.letterSizeSlider.addEventListener('input', (e) => {
                if (this.letterSizeDisplay) this.letterSizeDisplay.innerText = Number(e.target.value).toFixed(1) + 'x';
            });
        }
    }

    _loadSettings() {
        const savedTheme = localStorage.getItem('typestrike_theme');
        if (savedTheme && this.themeSelector) this.themeSelector.value = savedTheme;

        const savedLetterTheme = localStorage.getItem('typestrike_letter_theme');
        if (savedLetterTheme && this.letterThemeSelector) this.letterThemeSelector.value = savedLetterTheme;

        const savedEffect = localStorage.getItem('typestrike_elimination_effect');
        if (savedEffect && this.effectSelector) this.effectSelector.value = savedEffect;

        const savedLetterSize = localStorage.getItem('typestrike_letter_size');
        if (savedLetterSize && this.letterSizeSlider) {
            this.letterSizeSlider.value = savedLetterSize;
            if (this.letterSizeDisplay) this.letterSizeDisplay.innerText = Number(savedLetterSize).toFixed(1) + 'x';
        }
    }

    _saveSettings() {
        if (this.themeSelector) localStorage.setItem('typestrike_theme', this.themeSelector.value);
        if (this.letterThemeSelector) localStorage.setItem('typestrike_letter_theme', this.letterThemeSelector.value);
        if (this.effectSelector) localStorage.setItem('typestrike_elimination_effect', this.effectSelector.value);
        if (this.letterSizeSlider) localStorage.setItem('typestrike_letter_size', this.letterSizeSlider.value);
    }

    _startLevel(levelData) {
        this._saveSettings();
        if (this.onStart) {
            const config = this._buildConfig('LEVEL_MODE');
            config.levelData = levelData;

            // For levels, the text is predefined
            const characters = levelData.textData.replace(/\s+/g, ' ').split('');
            config.characters = characters;

            this.onStart(config);
        }
    }

    _buildConfig(mode) {
        let characters = [];

        if (mode === 'CUSTOM_MODE') {
            let raw = this.textInput.value.trim();
            if (!raw) raw = DEFAULT_TEXT;
            characters = raw.replace(/\s+/g, ' ').split('');
        }

        return {
            gameMode: mode,
            characters,
            eliminationEffect: this.effectSelector ? this.effectSelector.value : 'fruit_slice',
            theme: this.themeSelector.value,
            letterTheme: this.letterThemeSelector ? this.letterThemeSelector.value : 'neon',
            showSubtitles: this.subtitleToggle.checked,
            letterSize: this.letterSizeSlider ? parseFloat(this.letterSizeSlider.value) : 1.0
        };
    }

    /* ── show / hide ────────────────────────────────────────────── */

    show() {
        this.screen.classList.remove('hidden');
        this.switchPanel('panel-lobby');
        this.refreshLevels();
        this._startBg();
    }

    hide() {
        this.screen.classList.add('hidden');
        this._stopBg();
    }

    /* ── animated 3-D background ────────────────────────────────── */

    _startBg() {
        const container = document.getElementById('menu-bg');
        if (!container || this._bgRenderer) return;

        this._bgScene = new THREE.Scene();
        this._bgCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
        this._bgCamera.position.z = 5;

        this._bgRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this._bgRenderer.setSize(innerWidth, innerHeight);
        this._bgRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        container.appendChild(this._bgRenderer.domElement);

        // floating particles
        const N = 350;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(N * 3);
        const col = new Float32Array(N * 3);

        for (let i = 0; i < N; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 22;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 22;

            if (Math.random() < 0.55) { col[i * 3] = 0; col[i * 3 + 1] = 0.94; col[i * 3 + 2] = 1; }
            else { col[i * 3] = 1; col[i * 3 + 1] = 0; col[i * 3 + 2] = 0.67; }
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.07, vertexColors: true, transparent: true,
            opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this._bgParticles = new THREE.Points(geo, mat);
        this._bgScene.add(this._bgParticles);

        // wireframe shapes
        this._bgShapes = [];
        for (let i = 0; i < 6; i++) {
            const geos = [
                new THREE.IcosahedronGeometry(0.5 + Math.random(), 1),
                new THREE.OctahedronGeometry(0.5 + Math.random(), 0),
                new THREE.TetrahedronGeometry(0.5 + Math.random(), 0),
            ];
            const g = geos[Math.floor(Math.random() * geos.length)];
            const m = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x00f0ff : 0xff00aa,
                wireframe: true, transparent: true, opacity: 0.12,
            });
            const mesh = new THREE.Mesh(g, m);
            mesh.position.set(
                (Math.random() - 0.5) * 9,
                (Math.random() - 0.5) * 7,
                (Math.random() - 0.5) * 5 - 3,
            );
            mesh.userData.rs = {
                x: (Math.random() - 0.5) * 0.4,
                y: (Math.random() - 0.5) * 0.4,
                z: (Math.random() - 0.5) * 0.3,
            };
            this._bgShapes.push(mesh);
            this._bgScene.add(mesh);
        }

        const tick = () => {
            this._bgRafId = requestAnimationFrame(tick);
            this._bgParticles.rotation.y += 0.0008;
            this._bgParticles.rotation.x += 0.0004;
            this._bgShapes.forEach(s => {
                s.rotation.x += s.userData.rs.x * 0.01;
                s.rotation.y += s.userData.rs.y * 0.01;
                s.rotation.z += s.userData.rs.z * 0.01;
            });
            this._bgRenderer.render(this._bgScene, this._bgCamera);
        };
        tick();

        this._bgResize = () => {
            if (!this._bgCamera || !this._bgRenderer) return;
            this._bgCamera.aspect = innerWidth / innerHeight;
            this._bgCamera.updateProjectionMatrix();
            this._bgRenderer.setSize(innerWidth, innerHeight);
        };
        window.addEventListener('resize', this._bgResize);
    }

    _stopBg() {
        if (this._bgRafId) { cancelAnimationFrame(this._bgRafId); this._bgRafId = null; }
        if (this._bgResize) { window.removeEventListener('resize', this._bgResize); this._bgResize = null; }
        const container = document.getElementById('menu-bg');
        if (container && this._bgRenderer) {
            container.removeChild(this._bgRenderer.domElement);
            this._bgRenderer.dispose();
        }
        this._bgScene = this._bgCamera = this._bgRenderer = null;
    }
}
