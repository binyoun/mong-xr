/**
 * cultural-frame.js
 * Ambient cultural layer reconnecting butterfly-vision to the archive.
 *
 * Two elements:
 *   1. Archive ghosts — Vietnamese ceramic images cycle as very faint (opacity ~0.08)
 *      full-bleed overlays using mix-blend-mode: overlay. Cross-fade every 14s.
 *      Creates a sense that the archive haunts the live view without dominating it.
 *
 *   2. Archive caption — bottom-right corner shows current piece title + date
 *      in small gold text, fading in/out with the image.
 */

export class CulturalFrame {
  constructor(archiveConfig) {
    // Use only Met Museum items (have consistent /web-large/ URLs)
    this._items = archiveConfig.images.filter(
      i => i.source === 'The Metropolitan Museum of Art'
    );
    this._index   = 0;
    this._layers  = [];
    this._caption = null;
  }

  mount() {
    this._buildLayers();
    this._buildCaption();
    this._show(0);                     // show first image immediately
    setInterval(() => this._advance(), 14000);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _buildLayers() {
    const wrap = document.createElement('div');
    wrap.id = 'cultural-frame';
    document.body.appendChild(wrap);

    this._items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'archive-ghost';
      div.style.backgroundImage = `url(${item.url})`;
      wrap.appendChild(div);
      this._layers.push({ div, item });
    });
  }

  _buildCaption() {
    this._caption = document.createElement('div');
    this._caption.id = 'archive-caption';
    document.body.appendChild(this._caption);
  }

  _show(idx) {
    // Hide previous
    this._layers.forEach(l => l.div.classList.remove('active'));

    const layer = this._layers[idx];
    layer.div.classList.add('active');

    // Update caption
    if (this._caption) {
      this._caption.innerHTML =
        `${layer.item.title}<br><span>${layer.item.date} · Met Museum</span>`;
      this._caption.classList.add('active');
      // Fade out caption 3s before next cycle
      clearTimeout(this._captionTimer);
      this._captionTimer = setTimeout(
        () => this._caption.classList.remove('active'),
        10500
      );
    }
  }

  _advance() {
    this._index = (this._index + 1) % this._layers.length;
    this._show(this._index);
  }
}
