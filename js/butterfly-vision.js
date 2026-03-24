/**
 * butterfly-vision.js
 * Renders the camera feed through a WebGL compound-eye shader:
 *   • Hexagonal mosaic — IQ-style Voronoi hex grid (14px ommatidium radius)
 *   • Spectral shift   — UV proxy boost, deep red attenuated (butterflies ≤640nm)
 *   • Facet-edge glint — iridescent border between ommatidia
 *
 * Science basis:
 *   - ~12,000–17,000 ommatidia per eye, each one pixel of visual input
 *   - Spectral range 300–640nm (UV vivid, deep red invisible)
 *   - Compound eye = low-res mosaic in pointy-top hexagonal lattice
 */

export class ButterflyVision {
  constructor(videoEl) {
    this.video  = videoEl;
    this.canvas = document.createElement('canvas');
    this._gl    = null;
    this._prog  = null;
    this._tex   = null;
    this._resLoc = null;
    this._rafId  = null;
  }

  init() {
    const gl = this.canvas.getContext('webgl') ||
               this.canvas.getContext('experimental-webgl');
    if (!gl) { console.warn('ButterflyVision: WebGL unavailable'); return false; }
    this._gl = gl;

    // Mount canvas over the video inside #camera-viewport
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this.video.style.opacity  = '0';          // hide raw video; canvas shows it processed
    this.video.parentElement.appendChild(this.canvas);

    this._buildShader();
    this._buildQuad();
    this._setupTexture();

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._loop();
    return true;
  }

  /**
   * Capture a square frame from the video (center crop) for ML inference.
   * Returns a Canvas element in natural video colours (not hex-processed).
   */
  captureFrame(size = 320) {
    const c   = document.createElement('canvas');
    c.width   = size;
    c.height  = size;
    const ctx = c.getContext('2d');
    const vw  = this.video.videoWidth  || size;
    const vh  = this.video.videoHeight || size;
    const min = Math.min(vw, vh);
    const ox  = (vw - min) / 2;
    const oy  = (vh - min) / 2;
    ctx.drawImage(this.video, ox, oy, min, min, 0, 0, size, size);
    return c;
  }

  stop() { if (this._rafId) cancelAnimationFrame(this._rafId); }

  // ─── Private ──────────────────────────────────────────────────────────────

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width  = w;
    this.canvas.height = h;
    this._gl.viewport(0, 0, w, h);
  }

  _loop() {
    const gl = this._gl;
    if (this.video.readyState >= 2) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, this._tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
      gl.uniform2f(this._resLoc, this.canvas.width, this.canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _buildShader() {
    const gl = this._gl;

    const vert = `
      attribute vec2 a_pos;
      varying   vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;   /* UV (0,0)=bottom-left — UNPACK_FLIP corrects orientation */
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    const frag = `
      precision mediump float;
      uniform sampler2D u_tex;
      uniform vec2      u_res;
      varying vec2      v_uv;

      const float SQRT3 = 1.7320508;

      /*
       * IQ hex Voronoi: returns offset from nearest hex lattice center.
       * Lattice basis: (1, sqrt3)*r — all nearest neighbors equidistant → regular hexagons.
       * length(offset) / r  ∈ [0, 1]  (0 = center, 1 = vertex)
       */
      vec2 hexOffset(vec2 p, float r) {
        vec2 R = vec2(1.0, SQRT3) * r;
        vec2 H = R * 0.5;
        vec2 a = mod(p, R)     - H;
        vec2 b = mod(p - H, R) - H;
        return dot(a, a) < dot(b, b) ? a : b;
      }

      /*
       * Spectral shift toward butterfly-visible range:
       *   • deep red (r channel) strongly reduced — butterflies ≤ ~640nm
       *   • UV proxy (violet/blue boost) — butterflies see 300-380nm as vivid colour
       *   • warm dream tint on midtones
       */
      vec3 spectralShift(vec3 c) {
        c.r *= 0.22;                                    // kill deep red
        float uvProxy = c.b * 0.55 + c.g * 0.15;       // UV proxy signal
        c.b  = min(c.b * 1.1  + uvProxy * 0.35, 1.0);  // UV boost → blue
        c.r  = c.r           + uvProxy * 0.22;          // violet bleed
        float lum = dot(c, vec3(0.2, 0.7, 0.1));
        c   += vec3(0.04, 0.03, 0.0) * smoothstep(0.15, 0.55, lum); // warm lift
        return clamp(c, 0.0, 1.0);
      }

      void main() {
        vec2 pixel  = v_uv * u_res;
        float r     = 14.0;                             /* ommatidium radius in pixels */
        vec2 offset = hexOffset(pixel, r);
        vec2 center = (pixel - offset) / u_res;         /* UV of hex centre */

        vec4 col = texture2D(u_tex, center);
        col.rgb  = spectralShift(col.rgb);

        /* Facet-edge iridescent glint — brighter at hex boundaries */
        float d    = length(offset) / r;                /* 0=centre, 1=vertex */
        float edge = smoothstep(0.72, 0.98, d);
        col.rgb   += edge * 0.07 * vec3(0.45, 0.20, 1.0); /* violet-gold glint */

        gl_FragColor = col;
      }
    `;

    const vs = this._compile(gl.VERTEX_SHADER,   vert);
    const fs = this._compile(gl.FRAGMENT_SHADER, frag);
    this._prog = gl.createProgram();
    gl.attachShader(this._prog, vs);
    gl.attachShader(this._prog, fs);
    gl.linkProgram(this._prog);
    if (!gl.getProgramParameter(this._prog, gl.LINK_STATUS)) {
      console.error('ButterflyVision shader link failed:', gl.getProgramInfoLog(this._prog));
    }
    gl.useProgram(this._prog);
    this._resLoc = gl.getUniformLocation(this._prog, 'u_res');
    gl.uniform1i(gl.getUniformLocation(this._prog, 'u_tex'), 0);
  }

  _compile(type, src) {
    const gl = this._gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  _buildQuad() {
    const gl  = this._gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,  1,-1,  -1, 1,
       1,-1,  1, 1,  -1, 1,
    ]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this._prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  _setupTexture() {
    const gl  = this._gl;
    this._tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._tex);
    // Non-power-of-2 video textures require CLAMP_TO_EDGE + no mipmaps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
}
