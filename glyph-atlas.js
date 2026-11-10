// A bounded color/glyph cache shared by the sky and monitor layers. Reusing
// rasterized letters keeps color changes from invoking fillText every frame.
export class GlyphAtlas {
  constructor(fontSize, dpr) {
    this.dpr = dpr;
    this.fontSize = fontSize;
    this.tile = Math.ceil(fontSize * 1.6 * dpr);
    this.side = this.tile / dpr;
    this.columns = 64; this.rows = 8;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.tile * this.columns;
    this.canvas.height = this.tile * this.rows;
    this.ctx = this.canvas.getContext('2d');
    this.prepare();
    this.cache = new Map();
  }
  prepare() {
    this.ctx.font = `500 ${this.fontSize * this.dpr}px monospace`;
    this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
  }
  get(glyph, rgb) {
    // Finer color steps preserve the original blue / cream gradients; coarse
    // independent RGB rounding introduced colored speckles in the sky.
    const values = rgb.map(v => Math.min(255, Math.round(255 * (Math.max(0, Math.min(1, v / 255)) ** .84) / 16) * 16));
    const key = `${glyph}:${values.join(',')}`;
    let tile = this.cache.get(key);
    if (!tile) {
      const index = this.cache.size;
      // Allocate only colors encountered so far, particularly on large/high-DPI
      // displays. Growth preserves cached tiles and their existing coordinates.
      if (index === this.columns * this.rows) {
        const previous = document.createElement('canvas');
        previous.width = this.canvas.width; previous.height = this.canvas.height;
        previous.getContext('2d').drawImage(this.canvas,0,0);
        this.rows *= 2; this.canvas.height = this.tile * this.rows;
        this.prepare(); this.ctx.drawImage(previous,0,0);
      }
      tile = { x: index % this.columns * this.tile, y: Math.floor(index / this.columns) * this.tile };
      this.ctx.fillStyle = `rgb(${values.join(' ')})`;
      this.ctx.fillText(glyph, tile.x + this.tile / 2, tile.y + this.tile / 2);
      this.cache.set(key, tile);
    }
    return tile;
  }
  draw(ctx, glyph, rgb, x, y, size = 1) {
    const tile = this.get(glyph, rgb), side = this.side * size;
    ctx.drawImage(this.canvas, tile.x, tile.y, this.tile, this.tile, x - side / 2, y - side / 2, side, side);
  }
}
