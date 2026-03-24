/**
 * archive-manager.js
 * Loads and manages the Vietnamese museum image archive.
 * Pre-loads images as Image objects for instant use in the dream renderer.
 */

export class ArchiveManager {
  constructor(archiveConfig) {
    this.images  = archiveConfig.images;
    this._loaded = {};   // id → HTMLImageElement
    this._queue  = [...this.images];
    this._used   = new Set();
  }

  /** Preload the first N images silently. */
  preload(n = 8) {
    this.images.slice(0, n).forEach(img => this._load(img));
  }

  /** Return the next unused image, cycling if all used. */
  next(theme = null) {
    let pool = theme
      ? this.images.filter(i => i.theme === theme && !this._used.has(i.id))
      : this.images.filter(i => !this._used.has(i.id));

    if (pool.length === 0) {
      this._used.clear();
      pool = theme ? this.images.filter(i => i.theme === theme) : [...this.images];
    }

    const item = pool[Math.floor(Math.random() * pool.length)];
    this._used.add(item.id);
    this._load(item);
    return item;
  }

  getLoaded(id) { return this._loaded[id] || null; }

  _load(item) {
    if (this._loaded[item.id]) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = item.url;
    this._loaded[item.id] = img;
  }
}
