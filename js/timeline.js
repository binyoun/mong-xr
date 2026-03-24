/**
 * timeline.js
 * Orchestrates the 4-stage experience.
 * Fires callbacks at each stage transition.
 */

export class Timeline {
  constructor(config) {
    this.stages    = config.stages;
    this._handlers = {};
    this._started  = false;
    this._timers   = [];
  }

  on(stage, fn) {
    this._handlers[stage] = fn;
    return this;
  }

  start() {
    if (this._started) return;
    this._started = true;
    const t0 = Date.now();

    Object.entries(this.stages).forEach(([key, stage]) => {
      const delay = stage.startMs;
      const timer = setTimeout(() => {
        console.log(`[夢XR] Stage: ${stage.label}`);
        if (this._handlers[key]) this._handlers[key](stage);
      }, delay);
      this._timers.push(timer);
    });
  }

  stop() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    this._started = false;
  }
}
