// Scene motion is expressed in source-image coordinates. Architecture and screens
// stay still; the moving objects are sampled and drawn separately.
export const birds = [
  { id: 'life', center: [991, 263], phase: 0, lift: 15, points: [[939,223],[962,235],[980,250],[1016,237],[1041,241],[1014,254],[1001,270],[1017,275],[1008,283],[982,275],[974,260],[958,250],[944,233]] },
  { id: 'upper', center: [957,112], phase: 1.2, lift: 11, points: [[912,94],[936,93],[950,103],[969,94],[977,87],[998,82],[989,94],[977,98],[971,116],[962,124],[966,131],[951,128],[943,113],[925,106]] },
  { id: 'middle', center: [1053,184], phase: 2.4, lift: 8, points: [[1024,181],[1044,178],[1053,182],[1068,164],[1081,163],[1072,174],[1065,189],[1057,194],[1051,190],[1037,190]] },
  { id: 'right', center: [1153,224], phase: .7, lift: 7, points: [[1134,224],[1145,221],[1152,223],[1164,207],[1175,204],[1173,212],[1165,214],[1161,231],[1153,236],[1147,230]] },
];

export function inside(x, y, polygon) {
  let contained = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) contained = !contained;
  }
  return contained;
}
const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const bands = ['.,', ':;', '-=', '+*', 'xo', '%#', 'MW', '@'];
const light = c => (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / 255;
const color = c => `rgb(${c.map(v => Math.round(255 * (clamp(v / 255) ** .84))).join(' ')})`;
const glyph = (c, seed) => { const band = bands[Math.min(bands.length - 1, Math.floor(Math.sqrt(light(c)) * bands.length))]; return band[Math.floor(seed * band.length) % band.length]; };
const sky = (r, g, b) => g - r > 26 && b - r > 33;

export function birdPoint(bird, x, y, time) {
  const [cx, cy] = bird.center;
  const wing = clamp(Math.abs(x - cx) / 40) * clamp((cy - y) / 18);
  const flap = (Math.sin(time * 2.05 + bird.phase) - Math.sin(bird.phase)) * bird.lift * wing;
  return [x + 8 * (Math.sin(time * .48 + bird.phase) - Math.sin(bird.phase)),
    y + 3.6 * (Math.sin(time * .86 + bird.phase) - Math.sin(bird.phase)) + flap];
}

const waterAreas = [
  [[870,436],[1367,433],[1363,548],[1200,578],[1120,659],[995,657],[984,579],[875,572]],
  [[716,697],[1007,686],[1114,652],[1200,696],[1126,775],[1010,800],[966,854],[865,908],[725,900],[630,836],[555,827]],
  [[255,804],[428,815],[605,863],[725,902],[866,902],[948,884],[1074,929],[1234,931],[1349,986],[1069,1023],[694,1023],[535,948],[372,938],[242,899],[154,850]],
];
const clothArea = [[778,478],[854,476],[887,524],[866,621],[815,605],[783,565]];

export class AsciiRenderer {
  constructor(image, canvas) {
    this.image = image;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.sourceW = image.naturalWidth;
    this.sourceH = image.naturalHeight;
    this.plate = document.createElement('canvas');
    this.plate.width = this.sourceW;
    this.plate.height = this.sourceH;
    const ctx = this.plate.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const bitmap = ctx.getImageData(0, 0, this.sourceW, this.sourceH);
    this.original = bitmap.data.slice();
    // Remove only bird-colored pixels from the sky plate. The bird pixels become
    // character sprites; this prevents a static ghost behind the flapping wings.
    this.birdMasks = birds.map(bird => {
      const xs = bird.points.map(p => p[0]), ys = bird.points.map(p => p[1]);
      const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
      const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      const mask = new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1));
      const stride = x1 - x0 + 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = (y * this.sourceW + x) * 4;
        if (!inside(x, y, bird.points) || sky(...this.original.slice(i, i + 3))) continue;
        mask[(y - y0) * stride + x - x0] = 1;
        const left = (y * this.sourceW + x0 - 7) * 4;
        const right = (y * this.sourceW + x1 + 7) * 4;
        const mix = (x - x0) / stride;
        for (let channel = 0; channel < 3; channel++) bitmap.data[i + channel] = this.original[left + channel] * (1 - mix) + this.original[right + channel] * mix;
      }
      return { bird, x0, y0, x1, y1, mask, stride };
    });
    ctx.putImageData(bitmap, 0, 0);
    this.base = document.createElement('canvas');
  }

  resize(width, height) {
    this.width = width; this.height = height;
    this.scale = width / this.sourceW;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    for (const canvas of [this.canvas, this.base]) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.columns = Math.min(250, Math.max(150, Math.round(width / 6.8)));
    this.rows = Math.round(height / (width / this.columns * 1.28));
    this.cellW = width / this.columns; this.cellH = height / this.rows;
    this.fontSize = this.cellH * 1.06;
    const texture = document.createElement('canvas');
    texture.width = this.columns * 2; texture.height = this.rows * 2;
    const texCtx = texture.getContext('2d', { willReadFrequently: true });
    texCtx.drawImage(this.plate, 0, 0, texture.width, texture.height);
    this.texture = texCtx.getImageData(0, 0, texture.width, texture.height).data;
    this.texW = texture.width; this.texH = texture.height;
    const baseCtx = this.base.getContext('2d', { alpha: false });
    baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseCtx.fillStyle = '#080d13'; baseCtx.fillRect(0, 0, width, height);
    this.prepare(baseCtx);
    this.dynamic = [];
    const sxStep = this.sourceW / this.columns, syStep = this.sourceH / this.rows;
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.columns; col++) {
      const sx = (col + .5) * sxStep, sy = (row + .5) * syStep;
      const rgb = this.sample(sx, sy), seed = hash(col, row);
      const isWater = waterAreas.some(poly => inside(sx, sy, poly)) &&
        ((rgb[2] > rgb[0] * 1.1 && rgb[1] > rgb[0] * 1.13) || (light(rgb) > .57 && rgb[0] > 150));
      const isCloth = inside(sx, sy, clothArea) && rgb[0] > rgb[2] * 1.8 && rgb[0] > rgb[1] * 1.08;
      const cell = { sx, sy, x: sx * this.scale + (seed - .5) * .4,
        y: sy * this.scale + (hash(row, col) - .5) * .35,
        seed, phase: seed * Math.PI * 2, glyph: glyph(rgb, seed), color: color(rgb),
        kind: isWater ? 'water' : isCloth ? 'cloth' : 'ambient' };
      if (isWater || isCloth || seed < .05) this.dynamic.push(cell);
      else this.paint(baseCtx, cell, cell.x, cell.y, 1, cell.color);
    }
    this.sprites = this.birdMasks.map(region => {
      const cells = [];
      for (let sy = region.y0; sy < region.y1; sy += syStep) for (let sx = region.x0; sx < region.x1; sx += sxStep) {
        const sum = [0, 0, 0]; let count = 0, px = 0, py = 0;
        for (let y = Math.floor(sy); y < Math.min(region.y1 + 1, sy + syStep); y++) {
          for (let x = Math.floor(sx); x < Math.min(region.x1 + 1, sx + sxStep); x++) {
            if (!region.mask[(y - region.y0) * region.stride + x - region.x0]) continue;
            const i = (y * this.sourceW + x) * 4;
            for (let c = 0; c < 3; c++) sum[c] += this.original[i + c];
            count++; px += x; py += y;
          }
        }
        if (count < 3) continue;
        const rgb = sum.map(v => v / count);
        cells.push({ sx: px / count, sy: py / count, glyph: glyph(rgb, hash(sx, sy)), color: color(rgb), size: .7 + .3 * clamp(count / (sxStep * syStep)) });
      }
      return { bird: region.bird, cells };
    });
    // Rasterize colored characters once. Repeated fillText + transform + color
    // sampling for thousands of cells made the previous animation CPU-bound.
    const movingCells = [...this.dynamic, ...this.sprites.flatMap(sprite => sprite.cells)];
    this.atlas = document.createElement('canvas');
    this.tilePixels = Math.ceil(this.fontSize * 1.6 * dpr);
    this.tileSize = this.tilePixels / dpr;
    const atlasColumns = 64;
    this.atlas.width = atlasColumns * this.tilePixels;
    this.atlas.height = Math.ceil(movingCells.length / atlasColumns) * this.tilePixels;
    const atlasCtx = this.atlas.getContext('2d');
    atlasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.prepare(atlasCtx);
    movingCells.forEach((cell, index) => {
      cell.tx = (index % atlasColumns) * this.tilePixels;
      cell.ty = Math.floor(index / atlasColumns) * this.tilePixels;
      this.paint(atlasCtx, cell, cell.tx / dpr + this.tileSize / 2,
        cell.ty / dpr + this.tileSize / 2, 1, cell.color);
    });
  }

  sample(sx, sy) {
    const x = clamp(sx / this.sourceW * this.texW - .5, 0, this.texW - 1);
    const y = clamp(sy / this.sourceH * this.texH - .5, 0, this.texH - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, this.texW - 1), y1 = Math.min(y0 + 1, this.texH - 1);
    const fx = x - x0, fy = y - y0, pixels = this.texture, stride = this.texW;
    return [0, 1, 2].map(c => (pixels[(y0 * stride + x0) * 4 + c] * (1 - fx) + pixels[(y0 * stride + x1) * 4 + c] * fx) * (1 - fy) +
      (pixels[(y1 * stride + x0) * 4 + c] * (1 - fx) + pixels[(y1 * stride + x1) * 4 + c] * fx) * fy);
  }
  prepare(ctx) { ctx.font = `500 ${this.fontSize}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
  paint(ctx, cell, x, y, size, fill) {
    ctx.fillStyle = fill;
    if (Math.abs(size - 1) < .005) ctx.fillText(cell.glyph, x, y);
    else { ctx.save(); ctx.translate(x, y); ctx.scale(size, size); ctx.fillText(cell.glyph, 0, 0); ctx.restore(); }
  }
  stamp(cell, x, y, size) {
    const side = this.tileSize * size;
    this.ctx.drawImage(this.atlas, cell.tx, cell.ty, this.tilePixels, this.tilePixels,
      x - side / 2, y - side / 2, side, side);
  }
  draw(time) {
    const ctx = this.ctx;
    ctx.drawImage(this.base, 0, 0, this.width, this.height);
    for (const cell of this.dynamic) {
      let x = cell.x, y = cell.y, size = 1;
      if (cell.kind === 'water') {
        const drift = Math.sin(time * .95 + cell.sy * .024) * 4.8 + Math.sin(time * .55 + cell.sx * .019) * 2.5;
        const rise = Math.sin(time * .8 + cell.sx * .013) * 1.8;
        x += drift * this.scale; y += rise * this.scale;
        size = 1 + .1 * Math.sin(time * 1.15 + cell.phase);
      } else if (cell.kind === 'cloth') {
        const hem = clamp((cell.sy - 490) / 125);
        x += Math.sin(time * 1.65 + cell.sy * .026) * 7 * hem * this.scale;
        y += Math.sin(time * 1.15 + cell.sx * .02) * 3 * hem * this.scale;
        size = 1 + .14 * hem * Math.sin(time * 1.5 + cell.phase);
      } else {
        // Independent, sparse breathing. No row/column phase or traveling bands.
        size = 1 + .14 * Math.sin(time * .95 + cell.phase);
      }
      this.stamp(cell, x, y, size);
    }
    for (const sprite of this.sprites) for (const cell of sprite.cells) {
      const [x, y] = birdPoint(sprite.bird, cell.sx, cell.sy, time);
      this.stamp(cell, x * this.scale, y * this.scale, cell.size);
    }
  }
}
