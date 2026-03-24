/**
 * object-sense.js
 * Wraps Transformers.js object detection.
 *
 * Model: Xenova/yolos-tiny  (~6MB quantized — fast download, works on mobile)
 * Previous model (detr-resnet-50, ~80MB) caused silent stalls on gallery networks.
 *
 * Returns: [{ label, score, box: { xmin, ymin, xmax, ymax } }]
 * Box coordinates are in pixels of the input capture frame.
 */

export class ObjectSense {
  constructor() {
    this._detector   = null;
    this._busy       = false;
    this._callback   = null;
    this._intervalId = null;
  }

  async init(onStatus) {
    onStatus?.('loading vision model…');
    try {
      const { pipeline, env } = await import(
        'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
      );
      env.allowLocalModels = false;
      env.useBrowserCache  = true;

      this._detector = await pipeline(
        'object-detection',
        'Xenova/yolos-tiny',
        { quantized: true }
      );
      console.log('[ObjectSense] model ready');
      onStatus?.('');
    } catch (err) {
      console.error('[ObjectSense] model load failed:', err);
      onStatus?.('');
    }
  }

  onDetection(fn) { this._callback = fn; }

  startLoop(captureFrameFn, intervalMs = 2000, threshold = 0.25) {
    this._intervalId = setInterval(async () => {
      if (this._busy || !this._detector) return;
      this._busy = true;
      try {
        const frame   = captureFrameFn();
        // Pass as data URL — most reliable input across Transformers.js versions
        const dataUrl = frame.toDataURL('image/jpeg', 0.85);
        const raw     = await this._detector(dataUrl, { threshold });
        console.log('[ObjectSense] detections:', raw.length, raw.map(d => d.label));
        if (raw.length && this._callback) {
          this._callback(raw, frame.width, frame.height);
        }
      } catch (err) {
        console.error('[ObjectSense] inference error:', err);
      } finally {
        this._busy = false;
      }
    }, intervalMs);
  }

  stop() { clearInterval(this._intervalId); }
}
