/**
 * dream-bloom.js
 * Canvas 2D overlay that draws dream-blooms at detected object positions.
 *
 * Each bloom:
 *   • Soft radial glow in UV-spectrum hues (200–380° hue = blue/violet/magenta)
 *   • Iridescent inner ring that pulses at ~0.3Hz
 *   • Floating object label in IBM Plex Mono
 *   • Lives 5s, fades out gracefully
 *   • Second appearance at same label refreshes the timer
 *
 * Coordinate mapping: detection boxes (capW × capH) → screen pixels.
 * Assumes the capture is a center-square crop of the video stream,
 * mapped proportionally to screen width × height.
 */

export class DreamBloom {
  constructor() {
    this.canvas         = document.createElement('canvas');
    this.canvas.id      = 'dream-bloom';
    this.canvas.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:15;';
    this.ctx    = this.canvas.getContext('2d');
    this._blooms = [];
    this._rafId  = null;
  }

  mount() {
    document.body.appendChild(this.canvas);
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._loop();
  }

  /**
   * @param {Array}  detections  — [{label, score, box:{xmin,ymin,xmax,ymax}}]
   * @param {number} capW        — pixel width of the capture frame
   * @param {number} capH        — pixel height of the capture frame
   */
  addDetections(detections, capW, capH) {
    const sw = window.innerWidth;
    const sh = window.innerHeight;

    for (const det of detections) {
      const { xmin, ymin, xmax, ymax } = det.box;

      // Map center of bounding box to screen coords
      const cx = ((xmin + xmax) / 2 / capW) * sw;
      const cy = ((ymin + ymax) / 2 / capH) * sh;

      // Bloom radius proportional to bounding box size
      const bw = ((xmax - xmin) / capW) * sw;
      const bh = ((ymax - ymin) / capH) * sh;
      const r  = Math.max(bw, bh) * 0.55 + 20;

      const existing = this._blooms.find(b => b.label === det.label);
      if (existing) {
        // Refresh position and lifetime
        Object.assign(existing, { cx, cy, r, score: det.score, born: Date.now() });
      } else {
        this._blooms.push({
          cx, cy, r,
          label: det.label,
          score: det.score,
          born:  Date.now(),
          hue:   this._labelHue(det.label),
          phase: Math.random() * Math.PI * 2,   // pulse phase offset
        });
      }
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _loop() {
    const ctx = this.ctx;
    const now = Date.now();

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Expire old blooms
    this._blooms = this._blooms.filter(b => now - b.born < 5000);

    for (const b of this._blooms) this._drawBloom(b, now);

    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _drawBloom(b, now) {
    const ctx   = this.ctx;
    const age   = (now - b.born) / 5000;           // 0 = fresh, 1 = expired
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.003 + b.phase);
    const alpha = (1 - Math.pow(age, 0.6)) * (0.55 + 0.2 * pulse);
    const { cx, cy, r, hue, label } = b;

    // ── Outer soft glow ──────────────────────────────────────────────────
    const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    outer.addColorStop(0,   `hsla(${hue},     95%, 75%, ${alpha * 0.65})`);
    outer.addColorStop(0.35,`hsla(${hue},     85%, 58%, ${alpha * 0.40})`);
    outer.addColorStop(0.75,`hsla(${hue + 30},70%, 45%, ${alpha * 0.15})`);
    outer.addColorStop(1,   `hsla(${hue},     60%, 30%, 0)`);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = outer;
    ctx.fill();

    // ── Inner iridescent ring ────────────────────────────────────────────
    const ringR     = r * (0.30 + 0.08 * pulse);
    const ringAlpha = alpha * (0.35 + 0.25 * pulse);
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue + 60}, 100%, 85%, ${ringAlpha})`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // ── Label ────────────────────────────────────────────────────────────
    const labelAlpha = alpha * (0.75 + 0.2 * pulse);
    ctx.font         = '10px "IBM Plex Mono", monospace';
    ctx.textAlign    = 'center';
    ctx.letterSpacing = '0.12em';
    ctx.fillStyle    = `hsla(${hue + 20}, 90%, 88%, ${labelAlpha})`;
    ctx.fillText(label.toUpperCase(), cx, cy - ringR - 6);
  }

  /** Deterministic hue in 200–380° range (blue → violet → magenta) */
  _labelHue(label) {
    let h = 0;
    for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) & 0xffff;
    return (h % 180) + 200;
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}
