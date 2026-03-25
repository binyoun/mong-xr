/**
 * selfie-butterfly.js
 * Every 8s: captures a selfie, clips it into a smooth butterfly silhouette,
 * and releases it as a slowly morphing AR creature.
 *
 * 三十三天 — each butterfly lives exactly 33s.
 * Metamorphosis arc: natural colours → iridescent → hue-shifted dissolution.
 *
 * Swarm threshold: when 8 butterflies are alive simultaneously they
 * are pulled toward their collective centroid for 5s.
 */

const CAPTURE_INTERVAL_MS = 8000;
const BUTTERFLY_LIFE_MS   = 33000;
const FADE_START_MS       = 25000;
const SWARM_AT            = 8;
const SWARM_DURATION_MS   = 5000;
const SWARM_COOLDOWN_MS   = 40000;

const CW = 60;
const CH = 48;

export class SelfieButterflySystem {
  constructor(cameraManager) {
    this._cam         = cameraManager;
    this._layer       = document.getElementById('dream-layer');
    this._intervalId  = null;
    this._busy        = false;
    this._active      = [];
    this._motionScale = 1.0;
    this._swarmStart  = -Infinity;
  }

  start() {
    setTimeout(() => this._capture(), 3000);
    this._intervalId = setInterval(() => this._capture(), CAPTURE_INTERVAL_MS);
  }

  stop() { clearInterval(this._intervalId); }

  setMotion(score) {
    this._motionScale = 0.4 + score * 2.1;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  async _capture() {
    if (this._busy) return;
    this._busy = true;
    try {
      const dataUrl = await this._cam.captureFace();
      this._spawnButterfly(dataUrl);
    } catch (err) {
      console.warn('[SelfieButterflySystem] capture failed:', err);
    } finally {
      this._busy = false;
    }
  }

  _centroid() {
    const alive = this._active.filter(r => r.alive);
    if (!alive.length) return null;
    return {
      x: alive.reduce((s, r) => s + r.x, 0) / alive.length,
      y: alive.reduce((s, r) => s + r.y, 0) / alive.length,
    };
  }

  /** Draw the butterfly silhouette (filled) onto ctx, scaled to CW×CH */
  _drawButterflyPath(ctx) {
    const sx = CW / 110, sy = CH / 88;
    const x = v => v * sx, y = v => v * sy;

    // Upper wings
    ctx.beginPath();
    ctx.moveTo(x(55), y(14));
    ctx.bezierCurveTo(x(44), y( 4), x( 6), y( 4), x(  4), y(18));
    ctx.bezierCurveTo(x( 2), y(30), x( 4), y(44), x( 16), y(48));
    ctx.bezierCurveTo(x(28), y(52), x(42), y(50), x( 55), y(46));
    ctx.bezierCurveTo(x(68), y(50), x(82), y(52), x( 94), y(48));
    ctx.bezierCurveTo(x(106),y(44), x(108),y(30), x(106), y(18));
    ctx.bezierCurveTo(x(104),y( 4), x(66), y( 4), x( 55), y(14));
    ctx.closePath();

    // Lower wings
    ctx.moveTo(x(55), y(46));
    ctx.bezierCurveTo(x(40), y(48), x(12), y(52), x(14), y(66));
    ctx.bezierCurveTo(x(16), y(74), x(28), y(78), x(38), y(72));
    ctx.bezierCurveTo(x(46), y(68), x(50), y(60), x(55), y(56));
    ctx.bezierCurveTo(x(60), y(60), x(64), y(68), x(72), y(72));
    ctx.bezierCurveTo(x(82), y(78), x(94), y(74), x(96), y(66));
    ctx.bezierCurveTo(x(98), y(52), x(70), y(48), x(55), y(46));
    ctx.closePath();
  }

  _spawnButterfly(dataUrl) {
    if (!this._layer) return;

    // ── Wrapper: perspective tilt + morph animation ───────────────────────
    const flapDur = (1.1 + Math.random() * 0.5).toFixed(2);
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: absolute;
      pointer-events: none;
      opacity: 0;
      will-change: left, top, opacity;
      transform: perspective(120px) rotateX(28deg) rotateY(${(Math.random()*10-5).toFixed(1)}deg);
      animation: butterflyMorph 33s linear forwards;
    `;
    this._layer.appendChild(wrapper);

    // ── Canvas: selfie clipped to butterfly shape ─────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width  = CW;
    canvas.height = CH;
    canvas.style.cssText = `
      display: block;
      animation: butterflyFlap ${flapDur}s ease-in-out infinite;
    `;
    wrapper.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const imgEl = new Image();
    imgEl.src = dataUrl;

    const render = () => {
      ctx.clearRect(0, 0, CW, CH);

      // 1. Draw the full selfie — face centred, fills canvas
      ctx.save();
      ctx.drawImage(imgEl, 0, 0, CW, CH);
      ctx.restore();

      // 2. Clip to butterfly shape via destination-in
      //    Build a feathered mask on a scratch canvas first
      const mask = document.createElement('canvas');
      mask.width = CW; mask.height = CH;
      const mCtx = mask.getContext('2d');
      mCtx.filter = 'blur(4px)';
      mCtx.fillStyle = '#fff';
      this._drawButterflyPath(mCtx);
      mCtx.fill();

      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      // 3. Iridescence overlay — shifts colour like real wing scales
      this._drawButterflyPath(ctx);
      const iri = ctx.createLinearGradient(0, 0, CW, CH);
      iri.addColorStop(0,   'rgba(140,200,255,0.18)');
      iri.addColorStop(0.4, 'rgba(255,230,120,0.10)');
      iri.addColorStop(1,   'rgba(200,120,255,0.18)');
      ctx.fillStyle = iri;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // 4. Dark body centre — thin ellipse gives anatomical definition
      ctx.beginPath();
      ctx.ellipse(55*(CW/110), 46*(CH/88), 3.5*(CW/110), 30*(CH/88), 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
    };

    imgEl.onload = render;
    if (imgEl.complete) render();

    // ── Spawn & animate ───────────────────────────────────────────────────
    const record  = { x: 0.5, y: 0.5, alive: true };
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

    const tick = (now) => {
      const age = (now - born) / 1000;

      if (age >= life) {
        wrapper.remove();
        record.alive = false;
        system._active = system._active.filter(r => r.alive);
        return;
      }

      let alpha = Math.min(age, 1);
      if (age > fadeAt) alpha *= 1 - (age - fadeAt) / (life - fadeAt);
      wrapper.style.opacity = alpha;

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
      wrapper.style.left = `${x - CW / 2}px`;
      wrapper.style.top  = `${y - CH / 2}px`;

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
