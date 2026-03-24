/**
 * sound-engine.js
 * Chầu văn-inspired generative soundscape for 夢 XR
 *
 * Lên đồng ritual structure:
 *   Slow preparation → building call-and-response → threshold crossing → sustained trance
 *
 * Three timbres synthesised via Web Audio API (no samples, no network):
 *   trống  — drum       low sine with pitch drop, the pulse
 *   phách  — clapper    filtered noise burst, the subdivision marker
 *   nguyệt — melodic    triangle oscillator with vibrato, Vietnamese pentatonic root on D
 *
 * Structural arc:
 *   0s        38 BPM  trống alone, very quiet — preparation
 *   ~60s      60 BPM  phách enters — the rhythm doubles in texture
 *   ~100s     80 BPM  melodic call enters — the voice of the deity
 *   ~200s    126 BPM  threshold — sustained, no further acceleration
 *
 * A D2/A2 drone rises in volume throughout — the ground tone of transformation.
 * Feedback delay adds depth without samples.
 */

export class SoundEngine {
  constructor() {
    this._ctx        = null;
    this._active     = false;
    this._startTime  = 0;
    this._nextBeat   = 0;
    this._step       = 0;      // 16th-note step position (0–15)
    this._callIdx    = 0;      // melodic sequence cursor
    this._masterGain = null;
    this._delay      = null;

    this.BPM_START = 38;
    this.BPM_END   = 126;
    this.RAMP_SEC  = 200;     // seconds to reach full tempo
  }

  /** Call after a user gesture (tap). */
  start() {
    if (this._ctx) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._active    = true;
    this._startTime = this._ctx.currentTime;
    this._nextBeat  = this._ctx.currentTime + 0.2;

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.82;
    this._masterGain.connect(this._ctx.destination);

    this._delay = this._buildDelay();
    this._startDrone();
    this._tick();
  }

  stop() {
    this._active = false;
    try { this._ctx?.close(); } catch (_) {}
  }

  // ─── Scheduling ───────────────────────────────────────────────────────────

  _tick() {
    // Look-ahead window: 120ms — prevents audible gaps without over-scheduling
    while (this._nextBeat < this._ctx.currentTime + 0.12) {
      this._scheduleStep(this._nextBeat);
      const sixteenth = (60 / this._bpm()) / 4;
      this._nextBeat += sixteenth;
      this._step = (this._step + 1) % 16;
    }
    if (this._active) setTimeout(() => this._tick(), 28);
  }

  _bpm() {
    const t    = Math.min((this._ctx.currentTime - this._startTime) / this.RAMP_SEC, 1);
    const ease = 1 - Math.pow(1 - t, 2.4);   // ease-out — organic, not mechanical
    return this.BPM_START + (this.BPM_END - this.BPM_START) * ease;
  }

  // Velocity envelope: quiet at start, full at peak
  _vel() {
    const t = (this._bpm() - this.BPM_START) / (this.BPM_END - this.BPM_START);
    return 0.28 + t * 0.72;
  }

  _scheduleStep(time) {
    const bpm = this._bpm();
    const vel = this._vel();

    // ── trống (drum) — 16-step pattern ──────────────────────────────────────
    // Strong on 1 and 9, medium on 5 and 13, ghost on 15
    const drum = [1, 0, 0, 0,  0.55, 0, 0, 0,  0.85, 0, 0, 0,  0.55, 0, 0.25, 0];
    if (drum[this._step] > 0) {
      this._drum(time, drum[this._step] * vel);
    }

    // ── phách (clapper) — enters at 60 BPM ──────────────────────────────────
    // Off-beat subdivisions that lock the groove
    const phach = [0, 0, 0.6, 0,  0, 0.45, 0.6, 0,  0, 0, 0.6, 0,  0, 0.45, 0.6, 0.35];
    if (bpm > 60 && phach[this._step] > 0) {
      this._phach(time, phach[this._step] * vel * 0.65);
    }

    // ── nguyệt (melodic call) — enters at 80 BPM ────────────────────────────
    // Every 8 steps — call pattern, not continuous
    const call = [1, 0, 0, 0,  0, 0, 0, 0,  0.75, 0, 0, 0,  0, 0, 0, 0];
    if (bpm > 80 && call[this._step] > 0) {
      this._call(time, call[this._step] * vel * 0.45, bpm);
    }
  }

  // ─── Timbres ──────────────────────────────────────────────────────────────

  /** trống — pitch-dropping sine, the heartbeat of lên đồng */
  _drum(time, velocity) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.frequency.setValueAtTime(195, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);

    env.gain.setValueAtTime(velocity * 0.58, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

    osc.connect(env);
    env.connect(this._delay.input);
    env.connect(this._masterGain);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  /** phách — sharp filtered noise click */
  _phach(time, velocity) {
    const ctx    = this._ctx;
    const frames = Math.ceil(ctx.sampleRate * 0.038);
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 14);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3400;
    hp.Q.value = 1.2;

    const env = ctx.createGain();
    env.gain.value = velocity * 0.42;

    src.connect(hp);
    hp.connect(env);
    env.connect(this._masterGain);
    src.start(time);
  }

  /** nguyệt — triangle wave with vibrato, Vietnamese D pentatonic */
  _call(time, velocity, bpm) {
    const ctx = this._ctx;

    // D pentatonic across two octaves: D3 F3 G3 A3 C4 D4 F4 G4
    const freqs = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66, 349.23, 392.00];
    const freq  = freqs[this._callIdx % freqs.length];
    this._callIdx++;

    const osc  = ctx.createOscillator();
    osc.type   = 'triangle';
    osc.frequency.value = freq;

    // Vibrato — ~5.2Hz, ~1.8% depth
    const vib   = ctx.createOscillator();
    const vGain = ctx.createGain();
    vib.frequency.value = 5.2;
    vGain.gain.value    = freq * 0.018;
    vib.connect(vGain);
    vGain.connect(osc.frequency);

    const dur = Math.min((60 / bpm) * 1.3, 0.85);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(velocity * 0.14, time + 0.025);
    env.gain.setValueAtTime(velocity * 0.14, time + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(env);
    env.connect(this._delay.input);
    env.connect(this._masterGain);

    osc.start(time); osc.stop(time + dur);
    vib.start(time); vib.stop(time + dur);
  }

  // ─── Atmosphere ───────────────────────────────────────────────────────────

  /** Low D2 + A2 drone — the cosmological ground tone, rises through the experience */
  _startDrone() {
    const ctx = this._ctx;

    [73.42, 110.00].forEach((hz, i) => {  // D2, A2
      const osc = ctx.createOscillator();
      osc.type  = 'sine';
      osc.frequency.value = hz;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.07 : 0.04, ctx.currentTime + this.RAMP_SEC);

      osc.connect(g);
      g.connect(this._masterGain);
      osc.start();
    });
  }

  /** Feedback delay — cave reverb, makes the synthesis sound less naked */
  _buildDelay() {
    const ctx = this._ctx;
    const dly = ctx.createDelay(1.0);
    dly.delayTime.value = 0.24;

    const fb = ctx.createGain();
    fb.gain.value = 0.36;

    const wet = ctx.createGain();
    wet.gain.value = 0.26;

    dly.connect(fb);
    fb.connect(dly);
    dly.connect(wet);
    wet.connect(this._masterGain);

    return { input: dly };
  }
}
