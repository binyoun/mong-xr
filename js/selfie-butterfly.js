/**
 * selfie-butterfly.js
 * Every 8s: switches to front camera, captures a selfie, processes it
 * through a hex pixelation pass matching the ButterflyVision shader,
 * then releases a tiny spiral-drifting butterfly into the AR layer.
 *
 * 三十三天 — 33s maps to the 33 Buddhist heavens referenced in the
 * ritual structure of lên đồng. Each self-image enters the dream
 * and dissolves in exactly that span.
 */

const CAPTURE_INTERVAL_MS = 8000;
const BUTTERFLY_LIFE_MS   = 33000;
const FADE_START_MS       = 25000;   // fade begins 8s before death
const HEX_CELL            = 8;       // simulated hex ommatidium size in px
const CAPTURE_RES         = 64;      // internal canvas resolution
const BUTTERFLY_PX        = 28;      // on-screen display size in px

export class SelfieButterflySystem {
  constructor(cameraManager) {
    this._cam        = cameraManager;
    this._layer      = document.getElementById('dream-layer');
    this._intervalId = null;
    this._busy       = false;
  }

  start() {
    // First capture after a short settle, then every 8s
    setTimeout(() => this._capture(), 3000);
    this._intervalId = setInterval(() => this._capture(), CAPTURE_INTERVAL_MS);
  }

  stop() {
    clearInterval(this._intervalId);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  async _capture() {
    if (this._busy) return;
    this._busy = true;
    try {
      const dataUrl   = await this._cam.captureFace();
      const processed = await this._processFrame(dataUrl);
      this._spawnButterfly(processed);
    } catch (err) {
      console.warn('[SelfieButterflySystem] capture failed:', err);
    } finally {
      this._busy = false;
    }
  }

  /** Hex pixelation + spectral shift to match ButterflyVision shader */
  _processFrame(dataUrl) {
    return new Promise(resolve => {
      const img   = new Image();
      img.onload  = () => {
        // Downsample to HEX_CELL grid — simulates each ommatidium as one pixel
        const tiny  = document.createElement('canvas');
        tiny.width  = tiny.height = CAPTURE_RES / HEX_CELL;
        const tCtx  = tiny.getContext('2d');
        tCtx.imageSmoothingEnabled = false;
        tCtx.drawImage(img, 0, 0, tiny.width, tiny.height);

        // Scale back up with no smoothing — chunky hex-like cells
        const out   = document.createElement('canvas');
        out.width   = out.height = CAPTURE_RES;
        const oCtx  = out.getContext('2d');
        oCtx.imageSmoothingEnabled = false;
        oCtx.drawImage(tiny, 0, 0, out.width, out.height);

        // Spectral shift: kill deep red, boost UV proxy (blue channel)
        // mirrors the GLSL spectralShift() in butterfly-vision.js
        const px = oCtx.getImageData(0, 0, out.width, out.height);
        const d  = px.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const uv = b * 0.55 + g * 0.15;
          d[i]     = Math.min(r * 0.22 + uv * 0.22, 255);
          d[i + 1] = Math.min(g * 1.0,               255);
          d[i + 2] = Math.min(b * 1.1  + uv * 0.35,  255);
        }
        oCtx.putImageData(px, 0, 0);

        resolve(out.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  _spawnButterfly(dataUrl) {
    if (!this._layer) return;
    const half = BUTTERFLY_PX / 2;

    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute;
      width:  ${BUTTERFLY_PX}px;
      height: ${BUTTERFLY_PX}px;
      background: url('${dataUrl}') center / cover no-repeat;
      image-rendering: pixelated;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      will-change: transform, left, top, opacity;
    `;
    this._layer.appendChild(el);

    // Random spawn — avoid screen edges
    const startX = 0.15 + Math.random() * 0.70;
    const startY = 0.15 + Math.random() * 0.70;

    // Slow drift direction and spiral parameters
    const driftX     = (Math.random() - 0.5) * 0.20;
    const driftY     = (Math.random() - 0.5) * 0.20;
    const spiralR    = 0.04 + Math.random() * 0.05;   // radius as fraction of screen
    const spiralSpd  = 0.5  + Math.random() * 0.5;    // rotations per second
    const spinDir    = Math.random() > 0.5 ? 1 : -1;

    const born = performance.now();
    const life = BUTTERFLY_LIFE_MS / 1000;
    const fadeAt = FADE_START_MS   / 1000;

    const tick = (now) => {
      const age = (now - born) / 1000;
      if (age >= life) { el.remove(); return; }

      // Opacity: 1s fade-in, hold, then linear fade-out from fadeAt → death
      let alpha = Math.min(age, 1);
      if (age > fadeAt) alpha *= 1 - (age - fadeAt) / (life - fadeAt);
      el.style.opacity = alpha;

      // Spiral: radius expands slowly so it opens outward like a moth circling
      const angle = age * spiralSpd * Math.PI * 2 * spinDir;
      const r     = spiralR * (1 + age * 0.12);
      const x = (startX + driftX * (age / life) + r * Math.cos(angle)) * window.innerWidth;
      const y = (startY + driftY * (age / life) + r * Math.sin(angle)) * window.innerHeight;

      el.style.left = `${x - half}px`;
      el.style.top  = `${y - half}px`;

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
