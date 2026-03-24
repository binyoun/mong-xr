/**
 * app.js
 * 夢 XR — butterfly vision prototype
 *
 * Camera feed → compound-eye WebGL shader (hex mosaic + spectral shift)
 * Real-world objects detected via DETR → dream-bloom glows at their positions
 * Butterfly emoji drifts toward detected objects
 * Archive card system removed — the dream responds to the actual surroundings
 */

import { CameraManager }   from './camera-manager.js';
import { ButterflyXR }     from './butterfly-xr.js';
import { ButterflyVision } from './butterfly-vision.js';
import { ObjectSense }     from './object-sense.js';
import { DreamBloom }      from './dream-bloom.js';
import { initDepthParallax } from './depth-parallax.js';

class MongXRApp {
  constructor() {
    this.camera    = new CameraManager(document.getElementById('camera-viewport'));
    this.butterfly = new ButterflyXR(document.getElementById('dream-layer'));
    this.vision    = null;
    this.sense     = null;
    this.bloom     = null;
  }

  async init() {
    initDepthParallax();

    this._setStatus('TAP TO BEGIN');
    await this._waitForTap();
    this._setStatus('');

    // Camera
    const videoEl = await this.camera.start('environment');

    // Compound-eye shader replaces the raw video feed
    this.vision = new ButterflyVision(videoEl);
    this.vision.init();

    // Butterfly — appears tiny, grows to full over 33s
    this.butterfly.appear();

    // Dream bloom layer (Canvas 2D, z-index 15)
    this.bloom = new DreamBloom();
    this.bloom.mount();

    // Object detection — model loads async, status shown while waiting
    this.sense = new ObjectSense();
    await this.sense.init(msg => this._setStatus(msg));

    // Wire detections → blooms + butterfly movement
    this.sense.onDetection((detections, capW, capH) => {
      this.bloom.addDetections(detections, capW, capH);

      // Butterfly drifts to highest-confidence detection
      const best  = detections.reduce((a, b) => a.score > b.score ? a : b);
      const { xmin, ymin, xmax, ymax } = best.box;
      const pctX  = ((xmin + xmax) / 2 / capW) * 100;
      const pctY  = ((ymin + ymax) / 2 / capH) * 100;
      this._moveButterflyTo(pctX, pctY);
    });

    this.sense.startLoop(() => this.vision.captureFrame(), 1500);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _moveButterflyTo(pctX, pctY) {
    if (!this.butterfly.el) return;
    this.butterfly.el.style.left = `${pctX}%`;
    this.butterfly.el.style.top  = `${pctY}%`;
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
