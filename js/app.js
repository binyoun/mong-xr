/**
 * app.js — 夢 XR butterfly vision
 *
 * Pipeline:
 *   camera → WebGL compound-eye shader (ButterflyVision)
 *   Chầu văn-inspired generative soundscape (SoundEngine)
 */

import { CameraManager }     from './camera-manager.js';
import { ButterflyVision }   from './butterfly-vision.js';
import { SoundEngine }       from './sound-engine.js';
import { initDepthParallax } from './depth-parallax.js';

class MongXRApp {
  constructor() {
    this.camera = new CameraManager(document.getElementById('camera-viewport'));
    this.vision = null;
    this.sound  = new SoundEngine();
  }

  async init() {
    initDepthParallax();

    this._setStatus('TAP TO BEGIN');
    await this._waitForTap();
    this._setStatus('');

    const videoEl = await this.camera.start('user');

    this.vision = new ButterflyVision(videoEl);
    this.vision.init();

    // Sound starts with camera — tap gesture satisfies AudioContext requirement
    this.sound.start();
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
