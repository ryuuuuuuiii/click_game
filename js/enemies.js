/* ================================================================
   enemies.js (now targets.js conceptually)
   Pure 3D Text Queue: single straight line of letters.
   No human models. Spaces are rendered as distinct tiles.
   ================================================================ */

import * as THREE from 'three';

/* ────────────────────────────────────────────────────────────────
   Canvas helper: draw a SINGLE letter tile
   States: 'pending' | 'active' | 'error'
   ──────────────────────────────────────────────────────────────── */

const TILE_SIZE = 96;

function createLetterCanvas(char, state = 'pending', isGolden = false, theme = 'neon') {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    _drawLetterTile(canvas.getContext('2d'), char, state, isGolden, theme);
    return canvas;
}

function _drawLetterTile(ctx, char, state, isGolden, theme = 'neon') {
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

    const isSpace = (char === ' ');
    const displayChar = isSpace ? '_' : char;

    let cfg;
    if (theme === 'glass') {
        cfg = {
            pending: { bg: 'rgba(200,225,255,0.15)', border: 'rgba(255,255,255,0.4)', text: '#ffffff', glow: 'rgba(255,255,255,0.6)' },
            active:  { bg: 'rgba(200,230,255,0.3)', border: 'rgba(255,255,255,0.9)', text: '#ffffff', glow: 'rgba(255,255,255,0.9)' },
            error:   { bg: 'rgba(255,50,50,0.3)', border: 'rgba(255,100,100,0.8)', text: '#ff5555', glow: 'rgba(255,80,80,0.8)' },
        }[state];
    } else if (theme === 'retro') {
        cfg = {
            pending: { bg: 'rgba(0,15,0,0.9)', border: 'rgba(0,150,0,0.6)', text: '#00cc00', glow: 'rgba(0,200,0,0.5)' },
            active:  { bg: 'rgba(0,35,0,1.0)', border: 'rgba(0,255,0,1.0)', text: '#55ff55', glow: 'rgba(0,255,0,0.9)' },
            error:   { bg: 'rgba(50,0,0,1.0)', border: 'rgba(255,0,0,1.0)', text: '#ff3333', glow: 'rgba(255,0,0,0.8)' },
        }[state];
    } else if (theme === 'fiery') {
        cfg = {
            pending: { bg: 'rgba(45,10,5,0.9)', border: 'rgba(200,60,0,0.6)', text: '#ff8844', glow: 'rgba(255,100,0,0.5)' },
            active:  { bg: 'rgba(65,15,5,0.95)', border: 'rgba(255,120,0,1.0)', text: '#ffdd44', glow: 'rgba(255,150,0,0.9)' },
            error:   { bg: 'rgba(60,0,0,0.9)', border: 'rgba(255,0,0,1.0)', text: '#ff0000', glow: 'rgba(255,0,0,0.8)' },
        }[state];
    } else {
        // default 'neon'
        cfg = {
            pending: { bg: 'rgba(8,8,30,0.85)', border: 'rgba(90,90,180,0.6)', text: '#bbc4ff', glow: 'rgba(90,90,180,0.6)' },
            active: { bg: 'rgba(0,20,50,0.95)', border: 'rgba(0,240,255,1.0)', text: '#00ffff', glow: 'rgba(0,240,255,0.9)' },
            error: { bg: 'rgba(60,4,4,0.90)', border: 'rgba(255,50,80,0.95)', text: '#ff3050', glow: 'rgba(255,50,80,0.8)' },
        }[state];
    }

    if (isGolden) {
        cfg = {
            pending: { bg: 'rgba(30,25,0,0.80)', border: 'rgba(180,150,0,0.55)', text: '#ffeebb', glow: 'rgba(180,150,0,0.6)' },
            active: { bg: 'rgba(50,40,0,0.90)', border: 'rgba(255,204,0,0.95)', text: '#ffcc00', glow: 'rgba(255,204,0,0.9)' },
            error: { bg: 'rgba(60,4,4,0.90)', border: 'rgba(255,50,80,0.95)', text: '#ff3050', glow: 'rgba(255,50,80,0.8)' },
        }[state];
    }

    if (isSpace && state === 'pending') {
        cfg.bg = isGolden ? 'rgba(30,25,0,0.40)' : 'rgba(8,8,30,0.40)';
        cfg.text = isGolden ? 'rgba(255,238,187,0.5)' : 'rgba(187,196,255,0.5)';
        if (theme === 'glass') cfg.bg = 'rgba(255,255,255,0.05)';
        else if (theme === 'retro') cfg.bg = 'rgba(0,15,0,0.4)';
        else if (theme === 'fiery') cfg.bg = 'rgba(45,10,5,0.4)';
    }

    const pad = 4;
    const r = 12;
    const s = TILE_SIZE;

    // rounded-rect background
    ctx.save();
    ctx.fillStyle = cfg.bg;
    ctx.beginPath();
    ctx.roundRect(pad, pad, s - pad * 2, s - pad * 2, r);
    ctx.fill();

    // Clip texture inside the rounded rect
    ctx.clip();

    // === THEME TEXTURES ===
    if (theme === 'glass') {
        // Frosty noise
        for (let i = 0; i < 300; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(200,220,255,0.04)';
            ctx.fillRect(Math.random() * s, Math.random() * s, Math.random() * 2 + 1, Math.random() * 2 + 1);
        }
        // Diagonal Glare 1
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(s * 0.8, -20);
        ctx.lineTo(0, s * 0.8);
        ctx.fill();
        // Diagonal Glare 2
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.moveTo(s, s * 0.2);
        ctx.lineTo(s * 0.2, s);
        ctx.lineTo(s, s);
        ctx.fill();
    } else if (theme === 'retro') {
        // Horizontal Scanlines
        ctx.fillStyle = 'rgba(0, 200, 0, 0.08)';
        for (let i = 0; i < s; i += 4) {
            ctx.fillRect(0, i, s, 2);
        }
        // Vertical Grid lines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let i = 0; i < s; i += 4) {
            ctx.fillRect(i, 0, 1, s);
        }
        // Subtle Vignette
        const grad = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.8);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, s, s);
    } else if (theme === 'fiery') {
        // Magma gradient base
        const bgGrad = ctx.createLinearGradient(0, 0, 0, s);
        bgGrad.addColorStop(0, 'rgba(255, 60, 0, 0.1)');
        bgGrad.addColorStop(1, 'rgba(100, 0, 0, 0.4)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, s, s);

        // Magma rocks/embers
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = Math.random() > 0.8 ? 'rgba(255, 200, 0, 0.3)' : 'rgba(20, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.arc(Math.random() * s, Math.random() * s, Math.random() * 5 + 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Crack veins
        ctx.strokeStyle = 'rgba(255, 50, 0, 0.4)';
        ctx.lineWidth = 2;
        for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            let curX = Math.random() * s;
            let curY = 0;
            ctx.moveTo(curX, curY);
            while (curY < s) {
                curX += (Math.random() - 0.5) * 20;
                curY += Math.random() * 15 + 5;
                ctx.lineTo(curX, curY);
            }
            ctx.stroke();
        }
    } else {
        // Neon tech grid
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < s; i += 12) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
        }
        // Tech connection dots
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        for (let i = 12; i < s; i += 24) {
            for (let j = 12; j < s; j += 24) {
                if (Math.random() > 0.5) {
                    ctx.beginPath(); ctx.arc(i, j, 1.5, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
    }
    ctx.restore();

    // border
    ctx.strokeStyle = cfg.border;
    ctx.lineWidth = state === 'active' ? 4 : 2;
    ctx.beginPath();
    ctx.roundRect(pad, pad, s - pad * 2, s - pad * 2, r);
    ctx.stroke();

    // active: outer glow ring
    if (state === 'active') {
        ctx.strokeStyle = cfg.glow;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(1, 1, s - 2, s - 2, r + 3);
        ctx.stroke();
    }

    // Setup Text Drop Shadow
    ctx.shadowColor = state === 'active' ? cfg.glow : 'rgba(0,0,0,0)';
    ctx.shadowBlur = state === 'active' ? 12 : 0;

    // text
    const fs = state === 'active' ? 52 : 44;
    
    if (theme === 'retro') {
        ctx.font = `bold ${fs-4}px "Press Start 2P", "Courier New", monospace`;
    } else if (theme === 'elegant') {
        ctx.font = `bold ${fs}px "Times New Roman", serif`;
    } else {
        ctx.font = `bold ${fs}px "Courier New", Courier, monospace`;
    }
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cfg.text;

    // adjust y-position slightly for underscore so it looks vertically centered like a dash/box
    const yOffset = isSpace ? -5 : 0;
    ctx.fillText(displayChar, s / 2, s / 2 + yOffset);
    
    // reset shadow just in case
    ctx.shadowBlur = 0;
}

/* ────────────────────────────────────────────────────────────────
   LetterTarget — represents a single character in the queue
   ──────────────────────────────────────────────────────────────── */

export class LetterTarget {
    /**
     * @param {string}      char   – single character
     * @param {THREE.Scene} scene  – the main scene
     * @param {number}      queueIndex – position in the queue (0 = front)
     * @param {string}      theme – 'cyberpunk', 'sky', 'forest'
     */
    constructor(char, scene, queueIndex = 0, theme = 'cyberpunk', isGolden = false, isOverdrive = false, letterSize = 1.0, letterTheme = 'neon') {
        this.char = char.toUpperCase();
        this.scene = scene;
        this.queueIndex = queueIndex;
        this.alive = true;
        this._state = 'pending';
        this.isGolden = isGolden;
        this.isOverdrive = isOverdrive;
        this.letterTheme = letterTheme;

        // we use a Group to hold the sprite so we can rotate/scale it easily 
        // during finishers without breaking billboard facing
        this.model = new THREE.Group();
        this.scene.add(this.model);

        // canvas sprite
        this._canvas = createLetterCanvas(this.char, 'pending', this.isGolden, this.letterTheme);
        this._texture = new THREE.CanvasTexture(this._canvas);
        this._texture.minFilter = THREE.LinearFilter;
        this._texture.magFilter = THREE.LinearFilter;

        const mat = new THREE.SpriteMaterial({
            map: this._texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });

        this.sprite = new THREE.Sprite(mat);
        // Make the tile scale based on the letterSize setting
        this.sprite.scale.set(1.5 * letterSize, 1.5 * letterSize, 1);
        this.model.add(this.sprite);

        // Platform Box (Theme-bound)
        this.boxGeometry = new THREE.BoxGeometry(2, 2, 2);
        let boxMaterial;

        if (theme === 'forest') {
            boxMaterial = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.9 });
        } else if (theme === 'sky') {
            boxMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, roughness: 0.1 });
        } else {
            // cyberpunk (neon)
            boxMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00f0ff, emissiveIntensity: 0.3, wireframe: true });
        }
        this.box = new THREE.Mesh(this.boxGeometry, boxMaterial);
        this.box.position.y = -1.5; // sit underneath the sprite
        // this.model.add(this.box);

        // Scattered Placement (Geometry Dash style)
        const spacing = QueueManager.SPACING;
        const randomY = 1.0 + Math.random() * 3.0; // random height offset
        const randomRotZ = (Math.random() - 0.5) * 0.4; // random tilt

        this.model.position.set(queueIndex * spacing, randomY, 0); // Strict X-axis only
        this.model.rotation.z = randomRotZ;

        // Add a subtle idle sway offset based on index
        this.idleTime = queueIndex * 0.5;
    }

    /* ── State updates ────────────────────────────────────────── */

    updateTheme(newTheme) {
        this.letterTheme = newTheme;
        if (!this.alive) return;
        const ctx = this._canvas.getContext('2d');
        _drawLetterTile(ctx, this.char, this._state, this.isGolden, this.letterTheme);
        this._texture.needsUpdate = true;
    }

    setState(state) {
        if (this._state === state || !this.alive) return;
        this._state = state;
        const ctx = this._canvas.getContext('2d');
        _drawLetterTile(ctx, this.char, state, this.isGolden, this.letterTheme);
        this._texture.needsUpdate = true;
    }

    setActive(active) {
        this.setState(active ? 'active' : 'pending');
    }

    typeError() {
        this.setState('error');
        setTimeout(() => {
            if (this.alive) this.setState('active');
        }, 220);
    }

    /* ── Animation & Lifecycle ────────────────────────────────── */

    update(dt) {
        if (this.isSliced) {
            // 1. Fruit Slice pieces
            if (this.leftHalf && this.rightHalf) {
                this.sliceVelocityL.y -= 30 * dt; // gravity
                this.sliceVelocityR.y -= 30 * dt;

                this.leftHalf.position.addScaledVector(this.sliceVelocityL, dt);
                this.rightHalf.position.addScaledVector(this.sliceVelocityR, dt);

                this.leftHalf.rotation.z += 18 * dt; // Fast spin
                this.leftHalf.rotation.x += 10 * dt;
                this.rightHalf.rotation.z -= 18 * dt;
                this.rightHalf.rotation.x -= 10 * dt;

                if (this.leftHalf.position.y < -15 && this.leftHalf.visible) {
                    this.leftHalf.visible = false;
                    this.rightHalf.visible = false;
                    this.leftHalf.geometry.dispose();
                    this.rightHalf.geometry.dispose();
                }
            }

            // 2. Crescent Slash (Blade Spin)
            if (this.crescentSlash) {
                this.crescentSlash.rotation.z -= 25 * dt; // Whirlwind spin
                const scaleUp = 1 + (8 * dt);
                this.crescentSlash.scale.multiplyScalar(scaleUp);
                this.crescentSlash.material.opacity -= 3.5 * dt;

                if (this.crescentSlash.material.opacity <= 0) {
                    this.model.remove(this.crescentSlash);
                    this.crescentSlash.geometry.dispose();
                    this.crescentSlash.material.dispose();
                    this.crescentSlash = null;
                }
            }

            // Fade out linear slash visual
            if (this.slashMesh) {
                this.slashMesh.material.opacity -= 6 * dt;
                if (this.slashMesh.material.opacity <= 0) {
                    this.model.remove(this.slashMesh);
                    this.slashMesh.geometry.dispose();
                    this.slashMesh.material.dispose();
                    this.slashMesh = null;
                }
            }
            return;
        }

        if (!this.alive) return;
        this.idleTime += dt;

        if (this.isOverdrive) {
            // Gravity Anomaly: exaggerated sine wave motion based on time and index
            const bob = Math.sin(this.idleTime * 4.0 + this.queueIndex * 0.5) * 1.5;
            this.sprite.position.y = bob;
        } else {
            // Gentle bobbing up and down
            const bob = Math.sin(this.idleTime * 2.0) * 0.1;
            this.sprite.position.y = bob;
        }
    }

    slice() {
        if (!this.alive) return;
        this.alive = false;
        this.isSliced = true;

        this.sprite.visible = false;
        if (this.box) this.box.visible = false;

        // Slash visual (white thin plane)
        const slashGeo = new THREE.PlaneGeometry(6, 0.15);
        const slashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
        this.slashMesh = new THREE.Mesh(slashGeo, slashMat);
        this.slashMesh.rotation.z = (Math.random() - 0.5) * Math.PI * 0.5;
        this.slashMesh.position.copy(this.sprite.position);
        this.slashMesh.position.z += 0.5; // in front
        this.model.add(this.slashMesh);

        // Simple pieces for fruit slice
        const halfGeo = new THREE.BoxGeometry(1, 2, 0.1);
        const halfMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
        this.leftHalf = new THREE.Mesh(halfGeo, halfMat);
        this.rightHalf = new THREE.Mesh(halfGeo, halfMat);
        this.leftHalf.position.copy(this.sprite.position);
        this.rightHalf.position.copy(this.sprite.position);
        this.model.add(this.leftHalf);
        this.model.add(this.rightHalf);

        this.sliceVelocityL = new THREE.Vector3(-4, 8, (Math.random() - 0.5) * 4);
        this.sliceVelocityR = new THREE.Vector3(4, 8, (Math.random() - 0.5) * 4);
    }

    spinBlade() {
        if (!this.alive) return;
        this.alive = false;
        this.isSliced = true;

        this.sprite.visible = false;
        if (this.box) this.box.visible = false;

        // Circular Crescent Slash (libasan memutar)
        const slashGeo = new THREE.RingGeometry(1.0, 2.0, 32, 1, 0, Math.PI * 1.5); // 3/4 circle
        const slashMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending });
        this.crescentSlash = new THREE.Mesh(slashGeo, slashMat);
        
        // Random tilt for dynamic feel
        this.crescentSlash.rotation.x = (Math.random() - 0.5) * Math.PI * 0.8;
        this.crescentSlash.rotation.y = (Math.random() - 0.5) * Math.PI * 0.8;
        this.crescentSlash.position.copy(this.sprite.position);
        this.crescentSlash.position.z += 0.5;
        this.model.add(this.crescentSlash);
    }

    destroy() {
        // Now handled entirely by FinisherManager in game.js / typing.js
        this.alive = false;
    }

    removeFromScene() {
        this.scene.remove(this.model);
        if (this.sprite.material.map) this.sprite.material.map.dispose();
        this.sprite.material.dispose();
        this.boxGeometry.dispose();
        if (this.leftHalf && this.leftHalf.geometry) this.leftHalf.geometry.dispose();
        if (this.rightHalf && this.rightHalf.geometry) this.rightHalf.geometry.dispose();
    }

    getLetterWorldPosition() {
        const pos = new THREE.Vector3();
        this.sprite.getWorldPosition(pos);
        return pos;
    }
}

/* ================================================================
   QueueManager — manages the flat array of LetterTargets
   ================================================================ */

export class QueueManager {
    static SPACING = 4.0; // wider distance for Geo-Dash platforming

    constructor(scene, characterList, theme = 'cyberpunk', isOverdrive = false, letterSize = 1.0, letterTheme = 'neon') {
        this.scene = scene;
        this.characterList = characterList;
        this.theme = theme;
        this.isOverdrive = isOverdrive;
        this.letterSize = letterSize;
        this.letterTheme = letterTheme;
        this.targets = [];
        this.frontIdx = 0;
    }

    spawnAll() {
        for (let i = 0; i < this.characterList.length; i++) {
            const char = this.characterList[i];
            const isGolden = false; // Disabled power-up feature
            const t = new LetterTarget(char, this.scene, i, this.theme, isGolden, this.isOverdrive, this.letterSize, this.letterTheme);
            this.targets.push(t);
        }
        if (this.targets.length > 0) this.targets[0].setActive(true);
    }

    getFrontTarget() {
        while (this.frontIdx < this.targets.length) {
            const t = this.targets[this.frontIdx];
            if (t.alive) return t;
            this.frontIdx++;
        }
        return null;
    }

    advanceQueue() {
        this.frontIdx++;

        const next = this.getFrontTarget();
        if (next) next.setActive(true);
        return next;
    }

    isAllDefeated() {
        return this.getFrontTarget() === null;
    }

    update(dt) {
        for (const t of this.targets) {
            t.update(dt);
        }
    }

    reset(characterList) {
        this.targets.forEach(t => t.removeFromScene());
        this.targets = [];
        this.characterList = characterList || [];
        this.frontIdx = 0;
    }
}
