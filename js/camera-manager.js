/**
 * camera-manager.js
 * Manages back camera (painting) and front camera (face capture).
 * Mobile only supports one stream at a time — switches on demand.
 */

export class CameraManager {
  constructor(viewportEl) {
    this.viewport    = viewportEl;
    this.videoEl     = null;
    this._stream     = null;
    this._facing     = null;
  }

  async start(facing = 'environment') {
    if (this._stream) this._stop();

    if (!this.videoEl) {
      this.videoEl = document.createElement('video');
      this.videoEl.setAttribute('autoplay', '');
      this.videoEl.setAttribute('playsinline', '');
      this.videoEl.setAttribute('muted', '');
      this.videoEl.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      this.viewport.appendChild(this.videoEl);
    }

    this._stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing } },
      audio: false,
    });

    this.videoEl.srcObject = this._stream;
    this._facing = facing;

    await new Promise((resolve, reject) => {
      this.videoEl.onloadedmetadata = resolve;
      this.videoEl.onerror = reject;
    });
    await this.videoEl.play();
    return this.videoEl;
  }

  /** Switch to front camera, capture a snapshot, switch back. */
  async captureFace() {
    await this.start('user');
    await new Promise(r => setTimeout(r, 800)); // stabilize
    const snapshot = this._snapshot();
    await this.start('environment');
    return snapshot;
  }

  /** Capture current frame as a data URL. */
  captureFrame() {
    return this._snapshot();
  }

  getVideo() { return this.videoEl; }

  _snapshot() {
    const v = this.videoEl;
    const canvas = document.createElement('canvas');
    canvas.width  = v.videoWidth  || 640;
    canvas.height = v.videoHeight || 480;
    canvas.getContext('2d').drawImage(v, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  _stop() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
  }
}
