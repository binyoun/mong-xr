/**
 * app.js — 夢 XR butterfly vision
 *
 * Pipeline:
 *   back camera  → WebGL compound-eye shader (ButterflyVision)
 *   every 8s     → front camera selfie → hex-pixelated spiral butterfly (SelfieButterflySystem)
 *   soundscape   → Chầu văn-inspired generative arc (SoundEngine)
 */

import { CameraManager }          from './camera-manager.js';
import { ButterflyVision }        from './butterfly-vision.js';
import { SoundEngine }            from './sound-engine.js';
import { MotionSense }            from './motion-sense.js';
import { SelfieButterflySystem }  from './selfie-butterfly.js';
import { initDepthParallax }      from './depth-parallax.js';

class MongXRApp {
  constructor() {
    this.camera   = new CameraManager(document.getElementById('camera-viewport'));
    this.vision   = null;
    this.sound    = new SoundEngine();
    this.selfies  = null;
  }

  async init() {
    initDepthParallax();

    this._setStatus('TAP TO BEGIN');
    await this._waitForTap();
    this._setStatus('');

    // AudioContext must be created synchronously within the gesture —
    // start sound before any awaits or iOS will block it
    this.sound.start();

    // Back camera — viewer points phone at the world
    const videoEl = await this.camera.start('environment');

    this.vision = new ButterflyVision(videoEl);
    this.vision.init();

    // MotionSense: viewer's movement conducts the ritual pace
    const motion = new MotionSense(videoEl);
    motion.onChange(score => {
      this.sound.setMotion(score);
      this.selfies?.setMotion(score);
    });
    motion.start(100);

    // Every 8s: briefly switch to front camera, capture selfie, release spiral butterfly
    this.selfies = new SelfieButterflySystem(this.camera);
    this.selfies.start();
  }

  _waitForTap() {
    return new Promise(r => document.addEventListener('click', r, { once: true }));
  }

  _setStatus(text) {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent   = text;
    el.style.opacity = text ? '1' : '0';
  }
}

document.addEventListener('DOMContentLoaded', () => new MongXRApp().init());
