/**
 * dream-renderer.js
 * Renders floating archive images and personal captures over the camera feed.
 * CSS-based — no Three.js needed. Images drift and breathe as absolute elements.
 */

const POSITIONS = [
  { top:  '8%',  left: '5%'  },
  { top:  '8%',  right: '5%' },
  { top: '35%',  left: '2%'  },
  { top: '35%',  right: '2%' },
  { top: '62%',  left: '5%'  },
  { top: '62%',  right: '5%' },
  { top: '15%',  left: '28%' },
  { top: '55%',  left: '28%' },
];

let _posIndex = 0;

export class DreamRenderer {
  constructor(layerEl) {
    this.layer       = layerEl;
    this._cards      = [];
    this._dissolving = false;
  }

  /**
   * Add an archive image card to the dream space.
   * @param {Object} archiveItem  - { id, title, url, source }
   * @param {HTMLImageElement} imgEl
   */
  addArchiveCard(archiveItem, imgEl) {
    const pos  = POSITIONS[_posIndex % POSITIONS.length];
    _posIndex++;

    const card = this._createCard(imgEl, archiveItem.title, archiveItem.source, pos, 'archive');
    this.layer.appendChild(card);
    this._cards.push(card);

    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('visible')));
  }

  /**
   * Add a personal capture (face or painting photo) to the dream.
   * @param {string} dataUrl   - captured image data URL
   * @param {string} label     - 'YOU' or 'YOUR EYE'
   */
  addPersonalCard(dataUrl, label) {
    const pos  = POSITIONS[_posIndex % POSITIONS.length];
    _posIndex++;

    const card = this._createCard(dataUrl, label, '', pos, 'personal');
    this.layer.appendChild(card);
    this._cards.push(card);

    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('visible')));
  }

  /** Dissolve all cards — increase opacity overlap, slow drift. */
  dissolve() {
    this._dissolving = true;
    this._cards.forEach(card => card.classList.add('dissolving'));
  }

  clear() {
    this._cards.forEach(c => c.remove());
    this._cards = [];
    this._dissolving = false;
    _posIndex = 0;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _createCard(srcOrImg, title, source, pos, type) {
    const card = document.createElement('div');
    card.className = `dream-card dream-card--${type}`;

    // Apply position
    Object.entries(pos).forEach(([k, v]) => card.style[k] = v);

    // Unique drift animation offset
    const seed = Math.random();
    card.style.setProperty('--drift-x',    `${(seed - 0.5) * 24}px`);
    card.style.setProperty('--drift-y',    `${(seed - 0.5) * 18}px`);
    card.style.setProperty('--drift-dur',  `${6 + seed * 6}s`);
    card.style.setProperty('--drift-delay',`${seed * 3}s`);

    // Depth tier — deterministic by position index
    const tier = (_posIndex - 1) % 3; // _posIndex already incremented before call
    if (tier === 0) {
      card.classList.add('depth-far');
      card.style.setProperty('--depth-z', '-280px');
    } else if (tier === 1) {
      card.classList.add('depth-mid');
      card.style.setProperty('--depth-z', '-80px');
    } else {
      card.classList.add('depth-near');
      card.style.setProperty('--depth-z', '30px');
    }

    // Build image — accept either a URL string or a preloaded HTMLImageElement
    let img;
    if (typeof srcOrImg === 'string') {
      img = document.createElement('img');
      img.src = srcOrImg;
    } else {
      img = srcOrImg;
    }
    img.crossOrigin = 'anonymous';
    card.appendChild(img);

    // Skeleton → loaded transition
    const markLoaded = () => card.classList.add('img-loaded');
    if (img.complete && img.naturalWidth > 0) {
      requestAnimationFrame(markLoaded);
    } else {
      img.addEventListener('load',  markLoaded, { once: true });
      img.addEventListener('error', markLoaded, { once: true });
      setTimeout(markLoaded, 3000); // show card even if image stalls
    }

    if (title) {
      const caption = document.createElement('div');
      caption.className = 'dream-caption';
      caption.textContent = title;
      card.appendChild(caption);
    }

    if (source) {
      const src_el = document.createElement('div');
      src_el.className = 'dream-source';
      src_el.textContent = source;
      card.appendChild(src_el);
    }

    return card;
  }
}
