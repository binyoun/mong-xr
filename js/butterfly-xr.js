/**
 * butterfly-xr.js
 * The butterfly — appears in Stage 1, leads through the archive in Stage 2.
 * Movement is ambient and time-based, responding to how long the viewer has been present.
 * Replace textContent with an <img> or <canvas> when the 3D asset is ready.
 */

const WAYPOINTS = [
  { top: '20%', left: '50%' },
  { top: '15%', left: '20%' },
  { top: '30%', left: '75%' },
  { top: '50%', left: '15%' },
  { top: '45%', left: '65%' },
  { top: '25%', left: '45%' },
  { top: '60%', left: '40%' },
];

export class ButterflyXR {
  constructor(containerEl) {
    this.container   = containerEl;
    this.el          = null;
    this._waypointIdx = 0;
    this._moveTimer  = null;
    this._active     = false;
  }

  appear() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.id = 'butterfly-xr';
    this.el.textContent = '蝶';
    this._applyWaypoint(WAYPOINTS[0]);
    this.container.appendChild(this.el);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.el.classList.add('visible');
    }));
    this._active = true;
  }

  /** Begin moving between archive card positions — called in Stage 2. */
  startLeading(intervalMs = 9000) {
    if (this._moveTimer) return;
    this._moveTimer = setInterval(() => this._moveToNext(), intervalMs);
  }

  /** Move toward a specific element (e.g. a newly added archive card). */
  moveTo(el) {
    if (!this.el || !el) return;
    const rect = el.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    this.el.style.left = `${(cx / window.innerWidth)  * 100}%`;
    this.el.style.top  = `${(cy / window.innerHeight) * 100}%`;
  }

  dissolve() {
    if (this.el) this.el.classList.add('dissolving');
  }

  remove() {
    if (this._moveTimer) { clearInterval(this._moveTimer); this._moveTimer = null; }
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
    this._active = false;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _moveToNext() {
    if (!this.el) return;
    this._waypointIdx = (this._waypointIdx + 1) % WAYPOINTS.length;
    this._applyWaypoint(WAYPOINTS[this._waypointIdx]);
  }

  _applyWaypoint(wp) {
    if (!this.el) return;
    this.el.style.top  = wp.top;
    this.el.style.left = wp.left;
  }
}
