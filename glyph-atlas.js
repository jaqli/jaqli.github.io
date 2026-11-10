import { createCanvas } from './canvas-factory.js?v=20261110-fps10';
// Gamma/color quantization is independent of animation time. A lookup table
// avoids exponentiation, temporary arrays and string keys for every lit glyph.
const bins=Uint8Array.from({length:4097},(_,i)=>Math.min(16,Math.round(255*(i/4096)**.84/16)));
const channel=v=>bins[Math.max(0,Math.min(4096,Math.round(v*4096/255)))];
// A bounded color/glyph cache shared by the sky and monitor layers. Reusing
// rasterized letters keeps color changes from invoking fillText every frame.
export class GlyphAtlas {
  constructor(fontSize, dpr, limit=Infinity) {
    this.limit=limit;
    this.dpr = dpr;
    this.fontSize = fontSize;
    this.tile = Math.ceil(fontSize * 1.6 * dpr);
    this.side = this.tile / dpr;
    this.columns = 64; this.rows = 8;
    this.canvas = createCanvas();
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
    const r=channel(rgb[0]), g=channel(rgb[1]), b=channel(rgb[2]);
    const key = glyph.charCodeAt(0)*4913+(r*17+g)*17+b;
    let tile = this.cache.get(key);
    if (!tile) {
      let reused;
      if(this.cache.size>=this.limit){const key=this.cache.keys().next().value;reused=this.cache.get(key);this.cache.delete(key);}
      const index = this.cache.size;
      // Allocate only colors encountered so far, particularly on large/high-DPI
      // displays. Growth preserves cached tiles and their existing coordinates.
      if (!reused && index === this.columns * this.rows) {
        const previous = createCanvas();
        previous.width = this.canvas.width; previous.height = this.canvas.height;
        previous.getContext('2d').drawImage(this.canvas,0,0);
        this.rows *= 2; this.canvas.height = this.tile * this.rows;
        this.prepare(); this.ctx.drawImage(previous,0,0);
      }
      tile = reused || { x: index % this.columns * this.tile, y: Math.floor(index / this.columns) * this.tile };
      if(reused)this.ctx.clearRect(tile.x,tile.y,this.tile,this.tile);
      this.ctx.fillStyle = `rgb(${Math.min(255,r*16)} ${Math.min(255,g*16)} ${Math.min(255,b*16)})`;
      this.ctx.fillText(glyph, tile.x + this.tile / 2, tile.y + this.tile / 2);
      this.cache.set(key, tile);
    }
    if(Number.isFinite(this.limit)){this.cache.delete(key);this.cache.set(key,tile);}
    return tile;
  }
  draw(ctx, glyph, rgb, x, y, size = 1) {
    this.drawTile(ctx,this.get(glyph,rgb),x,y,size);
  }
  drawTile(ctx,tile,x,y,size=1) {
    const side=this.side*size;
    ctx.drawImage(this.canvas, tile.x, tile.y, this.tile, this.tile, x - side / 2, y - side / 2, side, side);
  }
}
