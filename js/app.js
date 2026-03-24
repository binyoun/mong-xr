/**
 * app.js — 夢 XR butterfly vision
 *
 * Pipeline:
 *   camera → WebGL compound-eye shader (ButterflyVision)
 *   archive images → ambient ghost overlay cycling (CulturalFrame)
 *   object detection → dream-bloom glows at detected positions (ObjectSense + DreamBloom)
 */

import { CameraManager }   from './camera-manager.js';
import { ButterflyVision } from './butterfly-vision.js';
import { ObjectSense }     from './object-sense.js';
import { DreamBloom }      from './dream-bloom.js';
import { CulturalFrame }   from './cultural-frame.js';
import { initDepthParallax } from './depth-parallax.js';

class MongXRApp {
  constructor() {
    this.camera  = new CameraManager(document.getElementById('camera-viewport'));
    this.vision  = null;
    this.sense   = null;
    this.bloom   = null;
    this.frame   = null;
  }

  async init() {
    initDepthParallax();

    // Load archive config for cultural frame
    const archiveConfig = await fetch('./config/archive.json').then(r => r.json());

    this._setStatus('TAP TO BEGIN');
    await this._waitForTap();
    this._setStatus('');

    // Camera
    const videoEl = await this.camera.start('environment');

    // Compound-eye shader
    this.vision = new ButterflyVision(videoEl);
    this.vision.init();

    // Cultural layer — archive images cycle as faint ghost overlays
    this.frame = new CulturalFrame(archiveConfig);
    this.frame.mount();

    // Dream blooms (object detection results)
    this.bloom = new DreamBloom();
    this.bloom.mount();

    // Object detection
    this.sense = new ObjectSense();
    await this.sense.init(msg => this._setStatus(msg));

    this.sense.onDetection((detections, capW, capH) => {
      this.bloom.addDetections(detections, capW, capH);
    });

    this.sense.startLoop(() => this.vision.captureFrame(), 2000);
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
