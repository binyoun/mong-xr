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
const BUTTERFLY_PX        = 28;      // on-screen display size in px
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

  /** Hex pixelation + spectral shift — matches ButterflyVision GLSL shader */
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

        // Scale back up without smoothing — chunky hex-like cells
        const out  = document.createElement('canvas');
        out.width  = out.height = CAPTURE_RES;
        const oCtx = out.getContext('2d');
        oCtx.imageSmoothingEnabled = false;
        oCtx.drawImage(tiny, 0, 0, out.width, out.height);

        // Spectral shift: kill deep red, boost UV proxy (mirrors GLSL spectralShift)
        const px = oCtx.getImageData(0, 0, out.width, out.height);
        const d  = px.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const uv = b * 0.55 + g * 0.15;
          d[i]     = Math.min(r * 0.22 + uv * 0.22, 255);
          d[i + 1] = Math.min(g,                     255);
          d[i + 2] = Math.min(b * 1.1  + uv * 0.35,  255);
        }
        oCtx.putImageData(px, 0, 0);
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
      will-change: left, top, opacity;
    `;
    this._layer.appendChild(el);

    const record = { x: 0.5, y: 0.5, alive: true };
    this._active.push(record);

    // Random spawn — avoid screen edges
    const startX    = 0.15 + Math.random() * 0.70;
    const startY    = 0.15 + Math.random() * 0.70;

    // Slow drift — each butterfly wanders in a slightly different direction
    const driftX    = (Math.random() - 0.5) * 0.08;
    const driftY    = (Math.random() - 0.5) * 0.08;

    // Slow spiral — 0.08–0.15 rotations per second at rest
    const spiralR   = 0.04 + Math.random() * 0.05;
    const spiralSpd = 0.08 + Math.random() * 0.07;
    const spinDir   = Math.random() > 0.5 ? 1 : -1;
    const system    = this;

    const born   = performance.now();
    const life   = BUTTERFLY_LIFE_MS / 1000;
    const fadeAt = FADE_START_MS / 1000;

    const tick = (now) => {
      const age = (now - born) / 1000;

      if (age >= life) {
        el.remove();
        record.alive = false;
        system._active = system._active.filter(r => r.alive);
        return;
      }

      // Opacity: 1s fade-in, hold, linear fade-out from fadeAt → death
      let alpha = Math.min(age, 1);
      if (age > fadeAt) alpha *= 1 - (age - fadeAt) / (life - fadeAt);
      el.style.opacity = alpha;

      // Spiral position — motion scale drives speed
      const spd   = spiralSpd * system._motionScale;
      const angle = age * spd * Math.PI * 2 * spinDir;
      const r     = spiralR * (1 + age * 0.12);   // slowly opening spiral
      let x = (startX + driftX * (age / life) + r * Math.cos(angle)) * window.innerWidth;
      let y = (startY + driftY * (age / life) + r * Math.sin(angle)) * window.innerHeight;

      // ── Swarm ────────────────────────────────────────────────────────────
      const aliveNow = system._active.filter(r => r.alive).length;

      // Trigger a new swarm if threshold met and cooldown has passed
      if (aliveNow >= SWARM_AT && now - system._swarmStart > SWARM_COOLDOWN_MS) {
        system._swarmStart = now;
      }

      // Apply swarm pull within the active swarm window
      const swarmAge = now - system._swarmStart;
      if (swarmAge < SWARM_DURATION_MS) {
        const c = system._centroid();
        if (c) {
          // Bell curve: peaks at 0.5 of swarm duration, smooth in/out
          const t        = swarmAge / SWARM_DURATION_MS;
          const strength = Math.sin(t * Math.PI) * 0.65;
          x += (c.x * window.innerWidth  - x) * strength;
          y += (c.y * window.innerHeight - y) * strength;
        }
      }

      // Update shared record for centroid calculation
      record.x = x / window.innerWidth;
      record.y = y / window.innerHeight;

      el.style.left = `${x - half}px`;
      el.style.top  = `${y - half}px`;

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
