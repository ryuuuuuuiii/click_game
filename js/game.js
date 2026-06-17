/* ================================================================
   game.js — Three.js scene with elevated camera, queue layout,
   smooth camera advance, dynamic themes, and pause state
   ================================================================ */

import * as THREE from 'three';
import { QueueManager } from './enemies.js';
import { TypingSystem } from './typing.js';
import { FinisherManager } from './finishers.js';
import { ParticleEmitter, ScreenShake } from './effects.js';
import { HUD } from './hud.js';
import { AudioManager } from './audio.js';

/* ── Camera constants ───────────────────────────────────────────── */
const CAM_HEIGHT = 5.5;         // elevated Y
const CAM_OFFSET_Z = 6.0;        // how far behind the target the camera sits
const CAM_LOOK_DOWN = 0.55;       // how many units below cam Y the lookAt targets
const CAM_ADVANCE_DURATION = 0.6; // seconds for camera to glide forward

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.running = false;
        this.isPaused = false;
        this.clock = new THREE.Clock();

        // Three core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.envGroup = null; // holds theme objects

        // subsystems
        this.particles = null;
        this.screenShake = null;
        this.hud = null;
        this.audio = null;
        this.finisherMgr = null;
        this.queueManager = null;
        this.typingSys = null;

        // camera tracking
        this.camBaseY = CAM_HEIGHT;
        this.camBaseZ = CAM_OFFSET_Z;
        this.camBaseX = 0;
        this.breathTime = 0;

        // level timer
        this._levelTimerId = null;
        this.timeRemaining = 0;

        // misc
        this.ambientParticles = null;
        this.onGameOver = null;
        this._resizeHandler = null;
        this._keydownHandler = null;
    }

    init(config) {
        this.config = config;

        /* ── renderer ───────────────────────────────────────────── */
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        /* ── scene ──────────────────────────────────────────────── */
        this.scene = new THREE.Scene();

        /* ── camera (pure side-scroller) ───────────────────────── */
        this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 200);
        this.camBaseZ = 10;
        this.camBaseY = 2;
        this.camBaseX = -4; // Center on first letter (x=-4)
        this._positionCamera();

        /* ── environment & themes ───────────────────────────────── */
        this.envGroup = new THREE.Group();
        this.scene.add(this.envGroup);
        this._applyTheme(config.theme || 'cyberpunk');

        /* ── subsystems ─────────────────────────────────────────── */
        this.particles = new ParticleEmitter(this.scene);
        this.screenShake = new ScreenShake();
        this.hud = new HUD();
        this.audio = new AudioManager();
        this.finisherMgr = new FinisherManager(this.scene, this.particles, this.screenShake, this.audio);
        this.finisherMgr.camera = this.camera;

        const isOverdrive = false; // Disabled boss mode floating/warp effects
        this.queueManager = new QueueManager(this.scene, config.characters, config.theme, isOverdrive, config.letterSize, config.letterTheme);

        this.typingSys = new TypingSystem(this.queueManager, this.finisherMgr, this.hud, this.audio, this.particles, config.eliminationEffect);

        // Subtitle Toggle
        const hudBottom = document.getElementById('hud-bottom');
        if (hudBottom) {
            hudBottom.style.opacity = config.showSubtitles ? '1' : '0';
        }

        const pauseToggle = document.getElementById('pause-subtitle-toggle');
        if (pauseToggle) {
            pauseToggle.checked = config.showSubtitles;
            pauseToggle.onchange = (e) => {
                if (hudBottom) hudBottom.style.opacity = e.target.checked ? '1' : '0';
            };
        }

        // spawn every character in a line
        this.queueManager.spawnAll();

        // wire callbacks
        const reward = isOverdrive ? 1.0 : 0.5;
        const penalty = isOverdrive ? -4 : -2;

        this.typingSys.onAllComplete = () => this._onAllComplete();
        this.typingSys.onLetterDestroyed = () => this._advanceCamera();
        this.typingSys.onCorrectKeystroke = () => this._modifyTime(reward);
        this.typingSys.onErrorKeystroke = () => this._modifyTime(penalty);
        this.typingSys.onTimeFreeze = () => this._triggerTimeFreeze();

        this.hud.reset();

        /* ── resize & pause events ──────────────────────────────── */
        this._resizeHandler = () => this._onResize();
        window.addEventListener('resize', this._resizeHandler);

        this._keydownHandler = (e) => {
            if (e.key === 'Escape' && this.running && !document.getElementById('game-over-screen').classList.contains('opacity-100')) {
                this._togglePause();
            }
        };
        window.addEventListener('keydown', this._keydownHandler);

        // Pause UI buttons
        document.getElementById('resume-btn').onclick = () => this._togglePause();
        const pauseBtn = document.getElementById('ui-pause-btn');
        if (pauseBtn) pauseBtn.onclick = () => this._togglePause();
    }

    _positionCamera() {
        this.camera.position.set(this.camBaseX, this.camBaseY, this.camBaseZ);
        this.camera.lookAt(this.camBaseX, this.camBaseY, 0);
    }

    _advanceCamera() {
        // Handled purely via lerp in _animate()
    }

    _togglePause() {
        this.isPaused = !this.isPaused;
        const pauseScreen = document.getElementById('pause-screen');
        if (this.isPaused) {
            pauseScreen.classList.remove('hidden');
            // Small delay to allow display:block to apply before animating opacity
            setTimeout(() => pauseScreen.classList.add('opacity-100'), 10);
            this.typingSys.disable();
        } else {
            pauseScreen.classList.remove('opacity-100');
            setTimeout(() => pauseScreen.classList.add('hidden'), 200);
            this.typingSys.enable();
            this.clock.getDelta(); // reset delta to prevent large jump
        }
    }

    /* ── Themes ─────────────────────────────────────────────────── */
    _applyTheme(themeName) {
        this.currentBgTexture = null;
        const textureLoader = new THREE.TextureLoader();

        // Clear previous env
        while (this.envGroup.children.length > 0) {
            const child = this.envGroup.children[0];
            this.envGroup.remove(child);
        }

        // Global Static Ground (Infinite X)
        const groundGeo = new THREE.PlaneGeometry(1000, 20);
        let groundMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const globalGround = new THREE.Mesh(groundGeo, groundMat);
        globalGround.rotation.x = -Math.PI / 2;
        globalGround.position.y = -2; // Ground level below platforms
        // this.envGroup.add(globalGround);

        const totalDepth = this.config.characters.length * QueueManager.SPACING + 40;

        if (themeName === 'forest') {
            groundMat.color.setHex(0x446644);
            
            // Procedural Dirt/Grass Floor (Pixel Art Tile)
            const cv = document.createElement('canvas');
            cv.width = 16; cv.height = 16;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#3a5a2a'; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#2a4a1a'; ctx.fillRect(0,0,8,8); ctx.fillRect(8,8,8,8);
            ctx.fillStyle = '#4a7a2a'; ctx.fillRect(2,2,4,4); ctx.fillRect(10,10,4,4);
            const tex = new THREE.CanvasTexture(cv);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(200, 200);
            groundMat.map = tex;
            groundMat.needsUpdate = true;

            this.scene.background = new THREE.Color(0x1a2e1e);
            this.scene.fog = new THREE.FogExp2(0x1a2e1e, 0.015);

            // Lights
            this.envGroup.add(new THREE.AmbientLight(0x405540, 0.8));
            const sun = new THREE.DirectionalLight(0xfffaee, 1.2);
            sun.position.set(10, 20, 5);
            this.envGroup.add(sun);

            // Background Plane
            const bgGeo = new THREE.PlaneGeometry(300, 60);
            const bgTex = textureLoader.load('assets/themes/Forest.jpeg');
            bgTex.colorSpace = THREE.SRGBColorSpace;
            bgTex.wrapS = THREE.MirroredRepeatWrapping;
            bgTex.wrapT = THREE.ClampToEdgeWrapping;
            bgTex.repeat.set(2.8, 1);
            this.currentBgTexture = bgTex;
            
            const bgMat = new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.DoubleSide });
            const backdrop = new THREE.Mesh(bgGeo, bgMat);
            backdrop.position.set(0, 2, -40);
            this.backdropMesh = backdrop;
            this.envGroup.add(backdrop);

        } else if (themeName === 'sky') {
            groundMat.color.setHex(0xffffff);
            groundMat.transparent = true;
            groundMat.opacity = 0.8; // Softer cloud floor

            // Procedural Cloud Floor (Pixel Art)
            const cv = document.createElement('canvas');
            cv.width = 16; cv.height = 16;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#e0e0e0'; ctx.fillRect(8,8,8,8);
            ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0,8,8,8); ctx.fillRect(8,0,8,8);
            const tex = new THREE.CanvasTexture(cv);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(200, 200);
            groundMat.map = tex;
            groundMat.needsUpdate = true;

            this.scene.background = new THREE.Color(0x87CEEB);
            this.scene.fog = new THREE.Fog(0x87CEEB, 40, 120);

            this.envGroup.add(new THREE.AmbientLight(0xffffff, 1.0));
            const sun = new THREE.DirectionalLight(0xffffff, 1.0);
            sun.position.set(-10, 20, -10);
            this.envGroup.add(sun);

            // Background Plane
            const bgGeo = new THREE.PlaneGeometry(300, 60);
            const bgTex = textureLoader.load('assets/themes/Sky.jpeg');
            bgTex.colorSpace = THREE.SRGBColorSpace;
            bgTex.wrapS = THREE.MirroredRepeatWrapping;
            bgTex.wrapT = THREE.ClampToEdgeWrapping;
            bgTex.repeat.set(2.8, 1);
            this.currentBgTexture = bgTex;
            
            const bgMat = new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.DoubleSide });
            const backdrop = new THREE.Mesh(bgGeo, bgMat);
            backdrop.position.set(0, 2, -40);
            this.backdropMesh = backdrop;
            this.envGroup.add(backdrop);

        } else if (themeName === 'anime') {
            groundMat.color.setHex(0x444444);

            // Procedural Asphalt Road (Pixel Art) - Repurposed from City
            const cv = document.createElement('canvas');
            cv.width = 16; cv.height = 16;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#222222'; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#111111'; ctx.fillRect(0,0,8,8); ctx.fillRect(8,8,8,8);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0,7,8,2); // dashed line
            const tex = new THREE.CanvasTexture(cv);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(200, 50);
            groundMat.map = tex;
            groundMat.needsUpdate = true;

            this.scene.background = new THREE.Color(0xffffff);
            
            this.envGroup.add(new THREE.AmbientLight(0xffffff, 1.0));
            const sun = new THREE.DirectionalLight(0xffffff, 1.0);
            sun.position.set(-10, 20, -10);
            this.envGroup.add(sun);

            // Background Plane
            const bgGeo = new THREE.PlaneGeometry(300, 60);
            const bgTex = textureLoader.load('assets/themes/Japan.jpeg');
            bgTex.colorSpace = THREE.SRGBColorSpace;
            bgTex.wrapS = THREE.MirroredRepeatWrapping;
            bgTex.wrapT = THREE.ClampToEdgeWrapping;
            bgTex.repeat.set(2.8, 1);
            this.currentBgTexture = bgTex;

            const bgMat = new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.DoubleSide });
            const backdrop = new THREE.Mesh(bgGeo, bgMat);
            backdrop.position.set(0, 2, -40);
            this.backdropMesh = backdrop;
            this.envGroup.add(backdrop);

        } else {
            // Cyberpunk (Default)
            groundMat.color.setHex(0x111111);

            // Neon Grid Ground Map
            const cv = document.createElement('canvas');
            cv.width = 16; cv.height = 16;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#080818'; ctx.fillRect(0,0,16,16);
            ctx.fillStyle = '#14143a';
            ctx.fillRect(0, 0, 16, 2);
            ctx.fillRect(0, 0, 2, 16);
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(15, 15, 1, 1);
            
            const tex = new THREE.CanvasTexture(cv);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(200, 200);

            groundMat.map = tex;
            groundMat.roughness = 0.92;
            groundMat.metalness = 0.08;
            groundMat.needsUpdate = true;

            this.scene.background = new THREE.Color(0x060614);
            this.scene.fog = new THREE.FogExp2(0x060614, 0.018);

            this.envGroup.add(new THREE.AmbientLight(0x334466, 0.8));
            const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.5);
            dirLight.position.set(-10, 20, 10);
            this.envGroup.add(dirLight);

            // Background Plane
            const bgGeo = new THREE.PlaneGeometry(300, 60);
            const bgTex = textureLoader.load('assets/themes/Cyber.jpeg');
            bgTex.colorSpace = THREE.SRGBColorSpace;
            bgTex.wrapS = THREE.MirroredRepeatWrapping;
            bgTex.wrapT = THREE.ClampToEdgeWrapping;
            bgTex.repeat.set(2.8, 1);
            this.currentBgTexture = bgTex;
            
            const bgMat = new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.DoubleSide });
            const backdrop = new THREE.Mesh(bgGeo, bgMat);
            backdrop.position.set(0, 2, -40);
            this.backdropMesh = backdrop;
            this.envGroup.add(backdrop);

            // Ambient Particles
            this._createAmbientParticles(totalDepth);
        }
    }

    _createAmbientParticles(totalDepth) {
        const N = 400;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            pos[i * 3] = (Math.random() * totalDepth - 10);
            pos[i * 3 + 1] = Math.random() * 10;
            pos[i * 3 + 2] = -(Math.random() * 22 + 2);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0x00f0ff, size: 0.04, transparent: true,
            opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.ambientParticles = new THREE.Points(geo, mat);
        this.envGroup.add(this.ambientParticles);
    }

    /* ── Game loop ──────────────────────────────────────────────── */
    start() {
        this.running = true;
        this.clock.start();
        this.typingSys.enable();
        this._animate();

        if (this.config.gameMode === 'LEVEL_MODE') {
            this.timeRemaining = this.config.levelData.timeLimit;
            document.getElementById('hud-timer').classList.remove('hidden');
            document.getElementById('timer-progress-container').classList.remove('hidden');
            this._updateTimerUI();
            this._startTimerLoop();
        }
    }

    _startTimerLoop() {
        if (this._levelTimerId) clearInterval(this._levelTimerId);
        this._levelTimerId = setInterval(() => {
            if (this.isPaused || !this.running || this.isTimeFrozen) return;
            this.timeRemaining--;
            this._updateTimerUI();

            if (this.timeRemaining <= 0) {
                this._stopTimer();
                this._gameComplete(false); // false = failed/time's up
            }
        }, 1000);
    }

    _triggerTimeFreeze() {
        if (this.config.gameMode !== 'LEVEL_MODE') return;
        this.isTimeFrozen = true;
        const timerEl = document.getElementById('timer-value');
        if (timerEl) timerEl.classList.add('text-brand-cyan');

        setTimeout(() => {
            this.isTimeFrozen = false;
            if (timerEl) timerEl.classList.remove('text-brand-cyan');
        }, 3000);
    }

    _updateTimerUI() {
        const timerEl = document.getElementById('timer-value');
        if (timerEl) {
            const mins = Math.floor(Math.max(0, this.timeRemaining) / 60);
            const secs = Math.floor(Math.max(0, this.timeRemaining)) % 60;
            timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            if (this.timeRemaining <= 5) {
                timerEl.classList.add('text-brand-red');
            } else {
                timerEl.classList.remove('text-brand-red');
            }
        }

        // Progress Bar
        const progressBar = document.getElementById('timer-progress-bar');
        if (progressBar) {
            const initialTime = this.config.levelData.timeLimit;
            const percentage = Math.max(0, Math.min(100, (this.timeRemaining / initialTime) * 100));
            progressBar.style.width = percentage + '%';

            // Reset dynamic classes
            progressBar.className = 'h-full w-full transition-all duration-200 ease-linear';

            if (percentage > 50) {
                progressBar.classList.add('bg-brand-green', 'shadow-[0_0_10px_rgba(0,255,136,0.8)]');
            } else if (percentage > 20) {
                progressBar.classList.add('bg-brand-yellow', 'shadow-[0_0_10px_rgba(255,204,0,0.8)]');
            } else {
                progressBar.classList.add('bg-brand-red', 'animate-pulse', 'shadow-[0_0_15px_rgba(255,51,85,1)]');
            }
        }
    }

    _modifyTime(amount) {
        if (!this.running || this.isPaused || this.config.gameMode !== 'LEVEL_MODE') return;

        const initialTime = this.config.levelData.timeLimit;
        this.timeRemaining += amount;

        // Capping Rule
        if (this.timeRemaining > initialTime) {
            this.timeRemaining = initialTime;
        }

        this._updateTimerUI();

        // Check lose condition immediately
        if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
            this._updateTimerUI(); // ensure it shows 00:00
            this._stopTimer();
            this._gameComplete(false); // trigger Lose Condition instantly
        }
    }

    _stopTimer() {
        if (this._levelTimerId) {
            clearInterval(this._levelTimerId);
            this._levelTimerId = null;
        }
        document.getElementById('hud-timer').classList.add('hidden');
        document.getElementById('timer-progress-container').classList.add('hidden');
        const timerEl = document.getElementById('timer-value');
        if (timerEl) timerEl.classList.remove('text-brand-red');
    }

    stop() {
        this.running = false;
        this.typingSys.disable();
    }

    _animate() {
        if (!this.running) return;
        requestAnimationFrame(() => this._animate());

        const dt = Math.min(this.clock.getDelta(), 0.1);
        if (this.isPaused) return; // Freeze everything

        this.breathTime += dt;
        const bx = Math.sin(this.breathTime * 0.7) * 0.01;
        const by = Math.sin(this.breathTime * 1.5) * 0.015;

        this.screenShake.update(dt);

        // Overdrive warp speed effect
        if (this.queueManager.isOverdrive) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 95, dt * 2.0);
            this.camera.updateProjectionMatrix();
        } else if (this.camera.fov !== 62) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 62, dt * 2.0);
            if (Math.abs(this.camera.fov - 62) < 0.1) this.camera.fov = 62;
            this.camera.updateProjectionMatrix();
        }

        const target = this.queueManager.getFrontTarget();
        const targetX = target ? target.getLetterWorldPosition().x : this.camBaseX;

        const speed = 5.0 * dt;
        this.camBaseX = THREE.MathUtils.lerp(this.camBaseX, targetX, speed);

        this.camera.position.set(
            this.camBaseX + bx + this.screenShake.offsetX,
            this.camBaseY + by + this.screenShake.offsetY,
            this.camBaseZ
        );
        this.camera.lookAt(
            this.camBaseX,
            this.camBaseY,
            0
        );

        this.queueManager.update(dt);
        this.particles.update(dt);

        if (this.ambientParticles) {
            const arr = this.ambientParticles.geometry.attributes.position.array;
            const speedMult = this.queueManager.isOverdrive ? 1.0 : 0.25; // Warp speed
            for (let i = 1; i < arr.length; i += 3) {
                arr[i] += dt * speedMult;
                if (arr[i] > 10) arr[i] = 0;
            }
            this.ambientParticles.geometry.attributes.position.needsUpdate = true;
        }

        // Seamless endless background texture pan & Parallax
        if (this.backdropMesh) {
            this.backdropMesh.position.x = this.camera.position.x;
        }
        if (this.currentBgTexture) {
            // Parallax based on camera position + continuous slow movement
            this.currentBgTexture.offset.x = (this.camera.position.x * 0.015) + (this.breathTime * 0.03);
        }

        this.renderer.render(this.scene, this.camera);
    }

    _onAllComplete() {
        this._gameComplete(true);
    }

    /* ── Game Complete ──────────────────────────────────────────── */
    _gameComplete(isWin = true) {
        this.stop();
        this._stopTimer();

        let timeBonus = 0;
        let grade = 'C';

        if (this.config.gameMode === 'LEVEL_MODE' && isWin) {
            timeBonus = this.timeRemaining * 50;
            const nextLevel = this.config.levelData.id + 1;
            const currentUnlocked = parseInt(localStorage.getItem('typestrike_unlocked_level')) || 1;
            if (nextLevel > currentUnlocked) {
                localStorage.setItem('typestrike_unlocked_level', nextLevel);
            }
        }

        const s = this.hud.getStats();
        const totalScore = s.score + timeBonus;

        document.getElementById('final-score').textContent = totalScore.toLocaleString();
        document.getElementById('final-words').textContent = s.wordsCompleted;
        document.getElementById('final-wpm').textContent = s.wpm;
        document.getElementById('final-accuracy').textContent = s.accuracy + '%';
        document.getElementById('final-combo').textContent = 'x' + s.maxCombo;

        const titleEl = document.querySelector('.game-over-title');
        const nextLevelBtn = document.getElementById('next-level-btn');
        const timeBonusDisplay = document.getElementById('time-bonus-display');
        const gradeDisplay = document.getElementById('grade-display');

        if (isWin) {
            const fl = document.getElementById('screen-flash');
            fl.style.background = 'rgba(255,204,0,0.35)';
            fl.style.opacity = '1';
            gsap.to(fl, { opacity: 0, duration: 0.8 });

            if (this.config.gameMode === 'LEVEL_MODE') {
                titleEl.textContent = 'LEVEL CLEARED!';

                let acc = parseFloat(s.accuracy);
                if (acc === 100 && this.timeRemaining >= this.config.levelData.timeLimit * 0.5) grade = 'S';
                else if (acc >= 90 && s.maxCombo >= 10) grade = 'A';
                else if (acc >= 75) grade = 'B';

                document.getElementById('grade-value').textContent = grade;
                gradeDisplay.classList.remove('hidden');
                gradeDisplay.classList.add('flex');

                document.getElementById('final-time-bonus').textContent = '+' + timeBonus;
                timeBonusDisplay.classList.remove('hidden');
                timeBonusDisplay.classList.add('flex');

                nextLevelBtn.classList.remove('hidden');
            } else {
                titleEl.textContent = 'COMPLETE!';
                gradeDisplay.classList.add('hidden');
                gradeDisplay.classList.remove('flex');
                timeBonusDisplay.classList.add('hidden');
                timeBonusDisplay.classList.remove('flex');
                nextLevelBtn.classList.add('hidden');
            }

            titleEl.classList.remove('text-brand-red');
            titleEl.classList.add('text-brand-green');
            titleEl.classList.replace('drop-shadow-[0_0_20px_rgba(255,51,85,0.6)]', 'drop-shadow-[0_0_20px_rgba(0,255,136,0.6)]');
        } else {
            // Time's Up
            const fl = document.getElementById('error-flash');
            fl.style.opacity = '1';
            gsap.to(fl, { opacity: 0, duration: 0.8 });

            titleEl.textContent = "TIME'S UP!";
            gradeDisplay.classList.add('hidden');
            gradeDisplay.classList.remove('flex');
            timeBonusDisplay.classList.add('hidden');
            timeBonusDisplay.classList.remove('flex');
            nextLevelBtn.classList.add('hidden');

            titleEl.classList.add('text-brand-red');
            titleEl.classList.remove('text-brand-green');
            titleEl.classList.replace('drop-shadow-[0_0_20px_rgba(0,255,136,0.6)]', 'drop-shadow-[0_0_20px_rgba(255,51,85,0.6)]');
        }

        setTimeout(() => {
            const screen = document.getElementById('game-over-screen');
            screen.classList.remove('hidden');
            setTimeout(() => screen.classList.add('opacity-100'), 10);
        }, 650);

        if (this.onGameOver) this.onGameOver(s);
    }

    /* ── Cleanup ────────────────────────────────────────────────── */
    _onResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(innerWidth, innerHeight);
    }

    cleanup() {
        this.stop();
        this._stopTimer();
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        if (this._keydownHandler) window.removeEventListener('keydown', this._keydownHandler);

        this.queueManager.reset([]);
        this.currentBgTexture = null;

        if (this.envGroup) {
            this.scene.remove(this.envGroup);
            this.envGroup.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    if (c.material.map) c.material.map.dispose();
                    c.material.dispose();
                }
            });
        }

        this.renderer.dispose();
        this.scene = this.camera = this.renderer = null;

        const titleEl = document.querySelector('.game-over-title');
        if (titleEl) {
            titleEl.textContent = 'GAME OVER';
            titleEl.classList.add('text-brand-red');
            titleEl.classList.remove('text-brand-green');
            titleEl.classList.replace('drop-shadow-[0_0_20px_rgba(0,255,136,0.6)]', 'drop-shadow-[0_0_20px_rgba(255,51,85,0.6)]');
        }
    }
}

