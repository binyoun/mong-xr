/**
 * motion-sense.js
 * Frame-differencing motion detector using the camera video element.
 *
 * Downsamples to 32×32 and compares consecutive frames.
 * Returns a score 0–1: 0 = perfectly still, 1 = maximum movement.
 *
 * Samples from the raw video element (not the WebGL canvas) for
 * cross-browser reliability. Runs at ~10fps via setInterval.
 *
 * In lên đồng: the medium's stillness holds the slow pace.
 * Their movement accelerates the ritual. This class measures that.
 */

const W = 32;
const H = 32;

export class MotionSense {
  constructor(videoEl) {
    this._video   = videoEl;
    this._canvas  = document.createElement('canvas');
    this._canvas.width  = W;
    this._canvas.height = H;
    this._ctx     = this._canvas.getContext('2d');
    this._prev    = null;
    this._score   = 0;          // smoothed motion score 0–1
    this._raw     = 0;
    this._callback = null;
    this._intervalId = null;
  }

  /** fn(score) called every sample with the current motion score 0–1 */
  onChange(fn) { this._callback = fn; }

  start(intervalMs = 100) {
    this._intervalId = setInterval(() => this._sample(), intervalMs);
  }

  stop() { clearInterval(this._intervalId); }

  getScore() { return this._score; }

  // ─── Private ──────────────────────────────────────────────────────────────

  _sample() {
    if (this._video.readyState < 2) return;

    this._ctx.drawImage(this._video, 0, 0, W, H);
    const curr = this._ctx.getImageData(0, 0, W, H).data;

    if (this._prev) {
      let diff = 0;
      for (let i = 0; i < curr.length; i += 4) {
        diff += Math.abs(curr[i]   - this._prev[i])
              + Math.abs(curr[i+1] - this._prev[i+1])
              + Math.abs(curr[i+2] - this._prev[i+2]);
      }
      // Normalize: max possible diff = W*H*3*255
      this._raw   = diff / (W * H * 3 * 255);
      // Smooth with low-pass filter — prevents single-frame spikes
      this._score += (Math.min(this._raw * 4, 1) - this._score) * 0.35;
    }

    this._prev = curr;
    this._callback?.(this._score);
  }
}
