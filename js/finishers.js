/* ================================================================
   finishers.js — Kill animations (Slash · Shoot · Explode)
   Applies directly to LetterTarget sprites.
   Camera-aware: the shoot effect spawns from the current camera pos.
   ================================================================ */

import * as THREE from 'three';


export class FinisherManager {
    /**
     * @param {THREE.Scene}     scene
     * @param {ParticleEmitter} particles
     * @param {ScreenShake}     screenShake
     * @param {AudioManager}    audio
     */
    constructor(scene, particles, screenShake, audio) {
        this.scene       = scene;
        this.particles   = particles;
        this.screenShake = screenShake;
        this.audio       = audio;
        /** @type {THREE.Camera|null} set by Game after construction */
        this.camera      = null;
    }

    execute(type, target) {
        switch (type) {
            case 'fruit_slice': this.fruitSlice(target); break;
            case 'blade_spin':  this.bladeSpin(target);  break;
            case 'shoot':       this.shoot(target);      break;
            case 'explode':     this.explode(target);    break;
            default:            this.fruitSlice(target); break;
        }
    }

    /* ────────────────────────────────────────────────────────────
       ⚔️  FRUIT SLICE — triggers the target's internal split physics
       ──────────────────────────────────────────────────────────── */
    fruitSlice(target) {
        this.audio.slash();
        target.slice();
        
        const pos = target.model.position.clone();
        // sparks
        this.particles.emit({
            position: pos,
            count: 20, colors: [0xffffff, 0x88ffff, 0x00f0ff],
            size: 0.15, speed: 6, lifetime: 0.4, gravity: -3, spread: 1.5,
        });

        this.screenShake.shake(0.08, 0.15);
    }

    /* ────────────────────────────────────────────────────────────
       🗡️  BLADE SPIN — triggers the spinning blade physics
       ──────────────────────────────────────────────────────────── */
    bladeSpin(target) {
        this.audio.bladeSpinSound();
        target.spinBlade();
        
        const pos = target.model.position.clone();
        // sparks
        this.particles.emit({
            position: pos,
            count: 20, colors: [0xffffff, 0x00f0ff, 0x00aaff],
            size: 0.20, speed: 8, lifetime: 0.5, gravity: -3, spread: 2.0,
        });

        this.screenShake.shake(0.1, 0.2);
    }

    /* ────────────────────────────────────────────────────────────
       🔫  SHOOT — muzzle flash + tracer + knockback
       Camera-relative origin so it works at any camera elevation.
       ──────────────────────────────────────────────────────────── */
    shoot(target) {
        const pos = target.model.position.clone();
        this.audio.gunshot();

        // origin near the camera
        const camPos = this.camera
            ? this.camera.position.clone()
            : new THREE.Vector3(0, 5.5, 6);
        const muzzle = camPos.clone().add(new THREE.Vector3(0.15, -0.5, -1));

        // ── muzzle flash light ──
        const flashLight = new THREE.PointLight(0xffaa00, 4, 14);
        flashLight.position.copy(muzzle);
        this.scene.add(flashLight);
        gsap.to(flashLight, {
            intensity: 0, duration: 0.08,
            onComplete: () => this.scene.remove(flashLight),
        });

        // ── muzzle flash sprite ──
        const fGeo = new THREE.PlaneGeometry(0.45, 0.45);
        const fMat = new THREE.MeshBasicMaterial({
            color: 0xffcc00, transparent: true, opacity: 1,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const flash = new THREE.Mesh(fGeo, fMat);
        flash.position.copy(muzzle);
        this.scene.add(flash);
        gsap.to(fMat, {
            opacity: 0, duration: 0.07,
            onComplete: () => { this.scene.remove(flash); fGeo.dispose(); fMat.dispose(); },
        });

        // ── bullet tracer ──
        const tGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 4);
        tGeo.rotateX(Math.PI / 2);
        const tMat = new THREE.MeshBasicMaterial({
            color: 0xffff44, transparent: true, blending: THREE.AdditiveBlending,
        });
        const tracer = new THREE.Mesh(tGeo, tMat);
        tracer.position.copy(muzzle);
        this.scene.add(tracer);

        gsap.to(tracer.position, {
            x: pos.x, y: pos.y, z: pos.z,
            duration: 0.08, ease: 'none',
            onComplete: () => { this.scene.remove(tracer); tGeo.dispose(); tMat.dispose(); },
        });

        // ── knockback and destroy ──
        setTimeout(() => {
            target.removeFromScene();

            // impact sparks & debris
            this.particles.emit({
                position: pos,
                count: 40, colors: [0xffaa00, 0x888888, 0x444444, 0xffffff],
                size: 0.15, speed: 8, lifetime: 0.5, gravity: -4, spread: 2.0,
            });
        }, 70);

        // camera recoil
        this.screenShake.shake(0.09, 0.12);
    }

    /* ────────────────────────────────────────────────────────────
       💥  EXPLODE — charge + particle burst + shockwave
       ──────────────────────────────────────────────────────────── */
    explode(target) {
        const pos = target.model.position.clone();

        // scale up dramatically as charge-up
        gsap.to(target.sprite.scale, {
            x: 2.2, y: 2.2,
            duration: 0.12, yoyo: true, repeat: 1,
            onComplete: () => {
                this.audio.explosion();

                // remove tile
                target.removeFromScene();

                // fire particles
                this.particles.emit({
                    position: pos, count: 60,
                    colors: [0xff4400, 0xff8800, 0xffcc00, 0xff0000],
                    size: 0.25, speed: 10, lifetime: 0.8, gravity: -3, spread: 2,
                });
                // smoke
                this.particles.emit({
                    position: pos, count: 25,
                    colors: [0x333333, 0x555555, 0x222222],
                    size: 0.35, speed: 3.0, lifetime: 1.2, gravity: 1.5, spread: 2,
                });

                // shockwave ring
                const rGeo = new THREE.RingGeometry(0.1, 0.3, 32);
                const rMat = new THREE.MeshBasicMaterial({
                    color: 0xff8800, transparent: true, opacity: 0.85,
                    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
                });
                const ring = new THREE.Mesh(rGeo, rMat);
                ring.position.copy(pos);
                ring.rotation.x = -Math.PI / 2;
                this.scene.add(ring);

                gsap.to(ring.scale, { x: 12, y: 12, z: 12, duration: 0.4, ease: 'power2.out' });
                gsap.to(rMat, {
                    opacity: 0, duration: 0.4, ease: 'power2.out',
                    onComplete: () => { this.scene.remove(ring); rGeo.dispose(); rMat.dispose(); },
                });

                // point-light flash
                const boom = new THREE.PointLight(0xff6600, 6, 22);
                boom.position.copy(pos);
                this.scene.add(boom);
                gsap.to(boom, {
                    intensity: 0, duration: 0.4,
                    onComplete: () => this.scene.remove(boom),
                });

                // screen flash
                const flashEl = document.getElementById('screen-flash');
                flashEl.style.background = 'rgba(255,136,0,0.28)';
                flashEl.style.opacity = '1';
                gsap.to(flashEl, { opacity: 0, duration: 0.3 });

                // big shake
                this.screenShake.shake(0.25, 0.35);
            },
        });
    }
}
