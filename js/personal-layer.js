/**
 * personal-layer.js
 * Captures the viewer's face (front camera) and a photo of the painting,
 * then passes them to the dream renderer as personal archive entries.
 */

export class PersonalLayer {
  constructor(cameraManager) {
    this.camera = cameraManager;
  }

  /** Briefly switch to front camera, capture face, switch back. */
  async captureFace() {
    try {
      const dataUrl = await this.camera.captureFace();
      return { dataUrl, label: 'YOU — 2026' };
    } catch (err) {
      console.warn('[PersonalLayer] Face capture failed:', err);
      return null;
    }
  }

  /** Capture the current back-camera view (the painting the viewer sees). */
  capturePainting() {
    try {
      const dataUrl = this.camera.captureFrame();
      return { dataUrl, label: 'YOUR EYE' };
    } catch (err) {
      console.warn('[PersonalLayer] Frame capture failed:', err);
      return null;
    }
  }
}
