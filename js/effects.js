/* ================================================================
   effects.js — Particle emitter & screen-shake system
   ================================================================ */

import * as THREE from 'three';

/* ── Particle Emitter ───────────────────────────────────────────── */

export class ParticleEmitter {
    constructor(scene) {
        this.scene = scene;
        this.systems = []; // active particle bursts
        this.pool    = []; // inactive particle bursts

        // Pre-allocate 50 particle systems (bursts) to avoid GC pauses
        for (let i = 0; i < 50; i++) {
            const maxCount = 30;
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(maxCount * 3);
            const cols = new Float32Array(maxCount * 3);
            
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
            
            const mat = new THREE.PointsMaterial({
                size: 0.15,
                vertexColors: true,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                sizeAttenuation: true,
            });

            const points = new THREE.Points(geo, mat);
            points.visible = false;
            this.scene.add(points);

            this.pool.push({
                points,
                vels: [],
                lives: [],
                maxLife: 1.0,
                gravity: 0,
                elapsed: 0,
                activeCount: 0
            });
        }
    }

    emit(opts = {}) {
        const {
            position = new THREE.Vector3(),
            count    = 20,
            color    = 0x00f0ff,
            colors   = null,
            size     = 0.12,
            speed    = 3,
            lifetime = 1.0,
            gravity  = -5,
            spread   = 1,
        } = opts;

        const s = this.pool.pop();
        if (!s) return; // Pool exhausted, skip this burst

        const actualCount = Math.min(count, 30);
        s.activeCount = actualCount;
        s.maxLife = lifetime;
        s.gravity = gravity;
        s.elapsed = 0;
        s.points.visible = true;
        s.points.material.opacity = 1;
        s.points.material.size = size;

        const posAttr = s.points.geometry.attributes.position;
        const colAttr = s.points.geometry.attributes.color;

        s.vels = [];
        s.lives = [];

        for (let i = 0; i < actualCount; i++) {
            posAttr.array[i * 3]     = position.x;
            posAttr.array[i * 3 + 1] = position.y;
            posAttr.array[i * 3 + 2] = position.z;

            s.vels.push(new THREE.Vector3(
                (Math.random() - 0.5) * spread * speed,
                (Math.random() - 0.2) * speed,
                (Math.random() - 0.5) * spread * speed,
            ));
            s.lives.push(lifetime * (0.5 + Math.random() * 0.5));

            const c = colors ? new THREE.Color(colors[Math.floor(Math.random() * colors.length)]) : new THREE.Color(color);
            colAttr.array[i * 3]     = c.r;
            colAttr.array[i * 3 + 1] = c.g;
            colAttr.array[i * 3 + 2] = c.b;
        }

        // Hide unused vertices
        for (let i = actualCount; i < 30; i++) {
            posAttr.array[i * 3]     = 9999;
            posAttr.array[i * 3 + 1] = 9999;
            posAttr.array[i * 3 + 2] = 9999;
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;

        this.systems.push(s);
    }

    /** Call every frame with delta (seconds). */
    update(dt) {
        for (let i = this.systems.length - 1; i >= 0; i--) {
            const s = this.systems[i];
            s.elapsed += dt;

            const arr = s.points.geometry.attributes.position.array;
            let allDead = true;

            for (let j = 0; j < s.vels.length; j++) {
                s.lives[j] -= dt;
                if (s.lives[j] <= 0) continue;
                allDead = false;

                const v = s.vels[j];
                v.y += s.gravity * dt;

                arr[j * 3]     += v.x * dt;
                arr[j * 3 + 1] += v.y * dt;
                arr[j * 3 + 2] += v.z * dt;
            }

            s.points.geometry.attributes.position.needsUpdate = true;

            // global fade
            const fade = 1 - s.elapsed / (s.maxLife * 1.2);
            s.points.material.opacity = Math.max(0, fade);

            if (allDead || s.elapsed > s.maxLife * 1.5) {
                s.points.visible = false;
                this.systems.splice(i, 1);
                this.pool.push(s);
            }
        }
    }
}

/* ── Screen Shake ───────────────────────────────────────────────── */

export class ScreenShake {
    constructor() {
        this.offsetX   = 0;
        this.offsetY   = 0;
        this.intensity = 0;
        this.decay     = 0;
    }

    /**
     * Start a shake.
     * @param {number} intensity – maximum pixel-offset magnitude
     * @param {number} duration  – how long to decay (seconds)
     */
    shake(intensity = 0.1, duration = 0.3) {
        // allow stacking — take the larger intensity
        this.intensity = Math.max(this.intensity, intensity);
        this.decay     = this.intensity / duration;
    }

    update(dt) {
        if (this.intensity <= 0) {
            this.offsetX = 0;
            this.offsetY = 0;
            return;
        }
        this.intensity -= this.decay * dt;
        if (this.intensity < 0) this.intensity = 0;

        this.offsetX = (Math.random() - 0.5) * this.intensity * 2;
        this.offsetY = (Math.random() - 0.5) * this.intensity * 2;
    }
}
