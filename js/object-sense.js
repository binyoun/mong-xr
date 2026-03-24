/**
 * object-sense.js
 * Wraps Transformers.js (Xenova) object detection.
 * Model: Xenova/detr-resnet-50 — DETR with ResNet-50 backbone, quantized (~80MB, cached after first load)
 *
 * Returns detections as: [{ label, score, box: { xmin, ymin, xmax, ymax } }]
 * Box coordinates are in pixels of the input capture frame (default 320×320).
 *
 * Model loads asynchronously — detection loop silently skips until ready.
 */

export class ObjectSense {
  constructor() {
    this._detector   = null;
    this._busy       = false;
    this._callback   = null;
    this._intervalId = null;
  }

  /** Load the detection pipeline. Calls onStatus(msg) with progress text. */
  async init(onStatus) {
    onStatus?.('loading vision model…');
    try {
      // Dynamic import keeps Transformers.js out of the initial module graph
      const { pipeline, env } = await import(
        'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
      );
      env.allowLocalModels = false;
      env.useBrowserCache  = true;          // cache model weights in IndexedDB after first load

      this._detector = await pipeline(
        'object-detection',
        'Xenova/detr-resnet-50',
        { quantized: true }
      );
      onStatus?.('');
    } catch (err) {
      console.warn('ObjectSense: model load failed —', err.message);
      onStatus?.('');                        // fail silently; blooms just won't appear
    }
  }

  /** Register a callback: fn(detections, captureWidth, captureHeight) */
  onDetection(fn) { this._callback = fn; }

  /**
   * Start the inference loop.
   * @param {Function} captureFrameFn  — returns a Canvas element (from ButterflyVision)
   * @param {number}   intervalMs      — ms between inference runs (default 1500)
   * @param {number}   threshold       — minimum confidence score (default 0.45)
   */
  startLoop(captureFrameFn, intervalMs = 1500, threshold = 0.45) {
    this._intervalId = setInterval(async () => {
      if (this._busy || !this._detector) return;
      this._busy = true;
      try {
        const frame = captureFrameFn();
        const raw   = await this._detector(frame, { threshold });
        if (raw.length && this._callback) {
          this._callback(raw, frame.width, frame.height);
        }
      } catch (_) {
        // Inference errors (e.g. tab backgrounded) — ignore silently
      } finally {
        this._busy = false;
      }
    }, intervalMs);
  }

  stop() { clearInterval(this._intervalId); }
}
