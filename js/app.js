/**
 * app.js
 * 夢 XR — 호접지몽
 *
 * A physical painting in a gallery.
 * Time passes. The archive surfaces from it.
 * The viewer enters the archive.
 * The boundary dissolves.
 */

import { CameraManager }   from './camera-manager.js';
import { DreamRenderer }   from './dream-renderer.js';
import { ArchiveManager }  from './archive-manager.js';
import { ButterflyXR }     from './butterfly-xr.js';
import { PersonalLayer }   from './personal-layer.js';
import { Timeline }        from './timeline.js';
import { initDepthParallax } from './depth-parallax.js';

class MongXRApp {
  constructor() {
    this.camera    = new CameraManager(document.getElementById('camera-viewport'));
    this.dream     = new DreamRenderer(document.getElementById('dream-layer'));
    this.butterfly = new ButterflyXR(document.getElementById('dream-layer'));
    this.personal  = null; // set after camera ready
    this.archive   = null; // set after config loaded
    this.timeline  = null; // set after config loaded
    this._archiveConfig  = null;
    this._timelineConfig = null;
  }

  async init() {
    [this._archiveConfig, this._timelineConfig] = await Promise.all([
      this._fetch('./config/archive.json'),
      this._fetch('./config/timeline.json'),
    ]);

    this.archive  = new ArchiveManager(this._archiveConfig);
    this.archive.preload(8); // start preloading before tap — images ready when archive surfaces

    this.timeline = new Timeline(this._timelineConfig);

    initDepthParallax();

    this._setStatus('TAP TO BEGIN');
    await this._waitForTap();
    this._setStatus('');

    await this.camera.start('environment');
    this.butterfly.appear(); // Stage 0 — tiny butterfly appears immediately, grows over 33s
    this.personal = new PersonalLayer(this.camera);

    this._wireTimeline();
    this.timeline.start();
    this._startRevealBar();
  }

  // ─── Timeline stages ──────────────────────────────────────────────────────

  _wireTimeline() {
    this.timeline
      .on('2_archive', (stage) => {
        this._beginArchiveWaves(stage);
      })
      .on('3_self', () => {
        this._enterSelf();
      })
      .on('4_dissolution', () => {
        this.butterfly.dissolve();
        this.dream.dissolve();
        this._setStatus('');
      });
  }

  _beginArchiveWaves(stage) {
    this.butterfly.startLeading(stage.waveIntervalMs);
    this._addArchiveWave(stage.imagesPerWave);

    // Keep surfacing images every wave interval
    this._archiveInterval = setInterval(() => {
      this._addArchiveWave(stage.imagesPerWave);
    }, stage.waveIntervalMs);
  }

  _addArchiveWave(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const item  = this.archive.next();
        // Use preloaded image if available; otherwise create and kick off load
        const imgEl = this.archive.getLoaded(item.id) || (() => {
          const img = new Image(); img.src = item.url; return img;
        })();

        // Add card immediately — skeleton shows, image fades in when loaded
        this.dream.addArchiveCard(item, imgEl);
        const cards = document.querySelectorAll('.dream-card');
        if (cards.length) this.butterfly.moveTo(cards[cards.length - 1]);
      }, i * 1200);
    }
  }

  async _enterSelf() {
    this._setStatus('…');

    // Capture painting from viewer's perspective
    const painting = this.personal.capturePainting();
    if (painting) this.dream.addPersonalCard(painting.dataUrl, painting.label);

    // Briefly switch to front camera for face
    await new Promise(r => setTimeout(r, 2000));
    const face = await this.personal.captureFace();
    if (face) this.dream.addPersonalCard(face.dataUrl, face.label);

    this._setStatus('');
  }

  // ─── Reveal bar ───────────────────────────────────────────────────────────

  _startRevealBar() {
    const bar = document.getElementById('reveal-bar');
    if (!bar) return;
    const dur = this._timelineConfig.stages['2_archive'].startMs;
    bar.style.setProperty('--cocoon-dur', `${dur}ms`);
    bar.classList.add('active');
    setTimeout(() => (bar.style.display = 'none'), dur + 500);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _waitForTap() {
    return new Promise(resolve => {
      document.addEventListener('click', resolve, { once: true });
    });
  }

  _setStatus(text) {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent   = text;
    el.style.opacity = text ? '1' : '0';
  }

  async _fetch(url) {
    const res = await fetch(url);
    return res.json();
  }
}

document.addEventListener('DOMContentLoaded', () => new MongXRApp().init());
