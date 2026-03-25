/**
 * selfie-butterfly.js
 * Every 8s: switches to front camera, captures a selfie, processes it
 * through a hex pixelation pass matching the ButterflyVision shader,
 * then releases a tiny slow spiral-drifting butterfly into the AR layer.
 *
 * 三十三天 — each butterfly lives exactly 33s, mapping to the 33
 * Buddhist heavens already embedded in the ritual structure.
 *
 * Swarm threshold: when 8 butterflies are alive simultaneously they
 * are pulled toward their collective centroid for 5s, briefly assembling
 * into one body, then released back to their individual spirals.
 */

const CAPTURE_INTERVAL_MS = 8000;
const BUTTERFLY_LIFE_MS   = 33000;
const FADE_START_MS       = 25000;   // fade begins 8s before death
const HEX_CELL            = 8;       // simulated hex ommatidium size in px
const CAPTURE_RES         = 64;      // internal canvas resolution
// Butterfly pixel-art mask — 10 cols × 8 rows of hex cells
// Waist at row 3 pinches upper from lower wings; tail tapers to body
const BUTTERFLY_MASK = [
  [0,0,1,1,1,1,1,1,0,0],  // upper wing top — rounded
  [0,1,1,1,1,1,1,1,1,0],  // upper wings spread
  [1,1,1,1,1,1,1,1,1,1],  // widest point
  [0,0,0,1,1,1,1,0,0,0],  // waist — pinch between upper & lower wings
  [0,1,1,1,1,1,1,1,1,0],  // lower wings spread
  [0,0,1,1,1,1,1,1,0,0],  // lower wings
  [0,0,0,1,1,1,1,0,0,0],  // lower wing tips
  [0,0,0,0,1,1,0,0,0,0],  // body tail
];
const SWARM_AT            = 8;       // alive count that triggers swarm
const SWARM_DURATION_MS   = 5000;    // swarm cohesion lasts 5s
const SWARM_COOLDOWN_MS   = 40000;   // minimum gap between swarms

export class SelfieButterflySystem {
  constructor(cameraManager) {
    this._cam         = cameraManager;
    this._layer       = document.getElementById('dream-layer');
    this._intervalId  = null;
    this._busy        = false;
    this._active      = [];           // { x, y, alive } — updated each frame
    this._motionScale = 1.0;          // 0.4 (still) → 2.5 (moving)
    this._swarmStart  = -Infinity;    // timestamp of last swarm trigger
  }

  start() {
    setTimeout(() => this._capture(), 3000);
    this._intervalId = setInterval(() => this._capture(), CAPTURE_INTERVAL_MS);
  }

  stop() { clearInterval(this._intervalId); }

  /** Called by MotionSense — still = slow drift, moving = faster spirals */
  setMotion(score) {
    this._motionScale = 0.4 + score * 2.1;
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

  /** Pixelation only — real photo colors, chunky hex-cell look */
  _processFrame(dataUrl) {
    return new Promise(resolve => {
      const img  = new Image();
      img.onload = () => {
        // Downsample to HEX_CELL grid — each pixel = one ommatidium
        const tiny = document.createElement('canvas');
        tiny.width = tiny.height = CAPTURE_RES / HEX_CELL;
        const tCtx = tiny.getContext('2d');
        tCtx.imageSmoothingEnabled = false;
        tCtx.drawImage(img, 0, 0, tiny.width, tiny.height);

        // Scale back up without smoothing — chunky pixel blocks
        const out  = document.createElement('canvas');
        out.width  = out.height = CAPTURE_RES;
        const oCtx = out.getContext('2d');
        oCtx.imageSmoothingEnabled = false;
        oCtx.drawImage(tiny, 0, 0, out.width, out.height);

        resolve(out.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  _centroid() {
    const alive = this._active.filter(r => r.alive);
    if (!alive.length) return null;
    return {
      x: alive.reduce((s, r) => s + r.x, 0) / alive.length,
      y: alive.reduce((s, r) => s + r.y, 0) / alive.length,
    };
  }

  _spawnButterfly(dataUrl) {
    if (!this._layer) return;

    // ── Build hex-cell butterfly canvas ─────────────────────────────────────
    // Pointy-top hexagons; odd rows offset right by SX/2
    const R    = 4;                           // hex circumradius px
    const SX   = R * Math.sqrt(3);            // centre-to-centre horizontal
    const SY   = R * 1.5;                     // centre-to-centre vertical
    const COLS = BUTTERFLY_MASK[0].length;
    const ROWS = BUTTERFLY_MASK.length;
    const CW   = Math.ceil((COLS + 0.5) * SX);
    const CH   = Math.ceil(ROWS * SY + R);

    const canvas = document.createElement('canvas');
    canvas.width  = CW;
    canvas.height = CH;
    const flapDur = (1.1 + Math.random() * 0.5).toFixed(2);
    canvas.style.cssText = `
      position: absolute;
      pointer-events: none;
      opacity: 0;
      will-change: left, top, opacity, transform;
      animation: butterflyFlap ${flapDur}s ease-in-out infinite;
    `;
    this._layer.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Pointy-top hex path centred at (cx, cy)
    const hexPath = (cx, cy) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + R * Math.cos(a);
        const py = cy + R * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    // Sample the processed image at mask-grid resolution and draw once
    const imgEl = new Image();
    imgEl.src = dataUrl;
    const renderCells = () => {
      const sc = document.createElement('canvas');
      sc.width = COLS; sc.height = ROWS;
      const sCtx = sc.getContext('2d');
      sCtx.drawImage(imgEl, 0, 0, COLS, ROWS);
      const px = sCtx.getImageData(0, 0, COLS, ROWS).data;

      ctx.clearRect(0, 0, CW, CH);
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (!BUTTERFLY_MASK[row][col]) continue;
          const cx = (col + (row % 2) * 0.5) * SX + R;
          const cy = row * SY + R;
          const i4 = (row * COLS + col) * 4;
          hexPath(cx, cy);
          ctx.fillStyle = `rgb(${px[i4]},${px[i4+1]},${px[i4+2]})`;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.28)';
          ctx.lineWidth   = 0.6;
          ctx.stroke();
        }
      }
    };
    imgEl.onload = renderCells;
    if (imgEl.complete) renderCells();

    // ── Spawn & animate ──────────────────────────────────────────────────────
    const record = { x: 0.5, y: 0.5, alive: true };
    this._active.push(record);

    const startX    = 0.15 + Math.random() * 0.70;
    const startY    = 0.15 + Math.random() * 0.70;
    const driftX    = (Math.random() - 0.5) * 0.08;
    const driftY    = (Math.random() - 0.5) * 0.08;
    const spiralR   = 0.04 + Math.random() * 0.05;
    const spiralSpd = 0.08 + Math.random() * 0.07;
    const spinDir   = Math.random() > 0.5 ? 1 : -1;
    const system    = this;

    const born   = performance.now();
    const life   = BUTTERFLY_LIFE_MS / 1000;
    const fadeAt = FADE_START_MS / 1000;
    const halfW  = CW / 2;
    const halfH  = CH / 2;

    const tick = (now) => {
      const age = (now - born) / 1000;

      if (age >= life) {
        canvas.remove();
        record.alive = false;
        system._active = system._active.filter(r => r.alive);
        return;
      }

      // Opacity: 1s fade-in, hold, linear fade-out from fadeAt → death
      let alpha = Math.min(age, 1);
      if (age > fadeAt) alpha *= 1 - (age - fadeAt) / (life - fadeAt);
      canvas.style.opacity = alpha;

      // Spiral position — motion scale drives speed
      const spd   = spiralSpd * system._motionScale;
      const angle = age * spd * Math.PI * 2 * spinDir;
      const r     = spiralR * (1 + age * 0.12);
      let x = (startX + driftX * (age / life) + r * Math.cos(angle)) * window.innerWidth;
      let y = (startY + driftY * (age / life) + r * Math.sin(angle)) * window.innerHeight;

      // ── Swarm ──────────────────────────────────────────────────────────
      const aliveNow = system._active.filter(r => r.alive).length;
      if (aliveNow >= SWARM_AT && now - system._swarmStart > SWARM_COOLDOWN_MS) {
        system._swarmStart = now;
      }
      const swarmAge = now - system._swarmStart;
      if (swarmAge < SWARM_DURATION_MS) {
        const c = system._centroid();
        if (c) {
          const t        = swarmAge / SWARM_DURATION_MS;
          const strength = Math.sin(t * Math.PI) * 0.65;
          x += (c.x * window.innerWidth  - x) * strength;
          y += (c.y * window.innerHeight - y) * strength;
        }
      }

      record.x = x / window.innerWidth;
      record.y = y / window.innerHeight;
      canvas.style.left = `${x - halfW}px`;
      canvas.style.top  = `${y - halfH}px`;

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
