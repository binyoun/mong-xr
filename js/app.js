/**
 * app.js — 夢 XR butterfly vision
 *
 * Pipeline:
 *   camera → WebGL compound-eye shader (ButterflyVision)
 *   archive images → ambient ghost overlay cycling (CulturalFrame)
 *   object detection → dream-bloom glows at detected positions (ObjectSense + DreamBloom)
 */

import { CameraManager }     from './camera-manager.js';
import { ButterflyVision }   from './butterfly-vision.js';
import { SoundEngine }       from './sound-engine.js';
import { CulturalFrame }     from './cultural-frame.js';
import { ObjectSense }       from './object-sense.js';
import { DreamBloom }        from './dream-bloom.js';
import { initDepthParallax } from './depth-parallax.js';

class MongXRApp {
  constructor() {
    this.camera  = new CameraManager(document.getElementById('camera-viewport'));
    this.vision  = null;
    this.sound   = new SoundEngine();
    this.bloom   = new DreamBloom();
    this.detect  = new ObjectSense();
    this.archive = null;
  }

  async init() {
    initDepthParallax();

    // Load archive config and preload first wave of Met images before the viewer taps —
    // by the time the 14s ghost cycle begins, they'll already be cached.
    const archiveConfig = await fetch('config/archive.json').then(r => r.json());
    archiveConfig.images
      .filter(i => i.source === 'The Metropolitan Museum of Art')
      .slice(0, 8)
      .forEach(item => { const img = new Image(); img.crossOrigin = 'anonymous'; img.src = item.url; });

    this._setStatus('TAP TO BEGIN');
    await this._waitForTap();
    this._setStatus('');

    // Back camera — viewer points phone at the painting
    const videoEl = await this.camera.start('environment');

    this.vision = new ButterflyVision(videoEl);
    this.vision.init();

    // Sound starts with camera — tap gesture satisfies AudioContext requirement
    this.sound.start();

    // Archive ghost overlay — Met Museum ceramics haunt the live view
    this.archive = new CulturalFrame(archiveConfig);
    this.archive.mount();

    // Object detection + dream blooms — detect what the camera sees
    this.bloom.mount();
    await this.detect.init(text => this._setStatus(text));
    this.detect.onDetection((dets, w, h) => this.bloom.addDetections(dets, w, h));
    this.detect.startLoop(() => this.vision.captureFrame(), 2000, 0.25);
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
