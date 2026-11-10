import { detailShapes, detailPoint, cloudWindows } from './scene-details.js?v=20261110-scene4';
import { GlyphAtlas } from './glyph-atlas.js?v=20261110-scene4';

// Source-image coordinates keep motion, perspective and hit targets in agreement.
export const birds = [
  { id: 'life', center: [991,263], phase: 0, lift: 17, duration: 28,
    route: [[991,263],[1155,225],[1200,155],[1065,140],[933,195],[941,295],[1115,315]],
    points: [[939,223],[962,235],[980,250],[1016,237],[1041,241],[1014,254],[1001,270],[1017,275],[1008,283],[982,275],[974,260],[958,250],[944,233]] },
  { id: 'upper', center: [957,112], phase: 1.2, lift: 12, duration: 34,
    route: [[957,112],[1095,125],[1195,210],[1085,275],[935,220],[922,155]],
    points: [[912,94],[936,93],[950,103],[969,94],[977,87],[998,82],[989,94],[977,98],[971,116],[962,124],[966,131],[951,128],[943,113],[925,106]] },
  { id: 'middle', center: [1053,184], phase: 2.4, lift: 9, duration: 31,
    route: [[1053,184],[1178,270],[1120,326],[961,280],[945,160],[1055,130]],
    points: [[1024,181],[1044,178],[1053,182],[1068,164],[1081,163],[1072,174],[1065,189],[1057,194],[1051,190],[1037,190]] },
  { id: 'right', center: [1153,224], phase: .7, lift: 8, duration: 39,
    route: [[1153,224],[1210,165],[1105,120],[976,165],[1006,260],[1165,320],[1240,280]],
    points: [[1134,224],[1145,221],[1152,223],[1164,207],[1175,204],[1173,212],[1165,214],[1161,231],[1153,236],[1147,230]] },
  { id: 'distant', center: [1224,197], phase: 3.4, lift: 11, duration: 37,
    route: [[1224,197],[1160,130],[1018,170],[1068,280],[1215,304],[1260,248]],
    points: [[1201,203],[1211,197],[1222,193],[1227,185],[1238,176],[1243,175],[1241,183],[1236,191],[1230,197],[1224,201],[1223,207],[1220,207],[1220,201],[1212,206],[1201,206]] },
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
const skyPixel = rgb => (rgb[1] - rgb[0] > 15 && rgb[2] - rgb[0] > 20 && rgb[1] > 110) || Math.min(...rgb) > 150;
const mix = (a, b, amount) => a.map((v, i) => v * (1 - amount) + b[i] * amount);
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

function screenUV(x, y, screen) {
  const [a,b,,d] = screen.quad;
  const ax = b[0]-a[0], ay = b[1]-a[1], bx = d[0]-a[0], by = d[1]-a[1];
  const det = ax*by-ay*bx, dx = x-a[0], dy = y-a[1];
  return [(dx*by-dy*bx)/det, (ax*dy-ay*dx)/det];
}

function flight(bird, time) {
  const route = bird.route, count = route.length;
  const progress = ((time / bird.duration) % 1 + 1) % 1 * count;
  const index = Math.floor(progress), t = progress - index;
  const p0 = route[(index + count - 1) % count], p1 = route[index];
  const p2 = route[(index + 1) % count], p3 = route[(index + 2) % count];
  const position = [], velocity = [];
  for (let axis = 0; axis < 2; axis++) {
    const a = 2 * p1[axis], b = p2[axis] - p0[axis];
    const c = 2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis];
    const d = -p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis];
    position.push(.5 * (a + b * t + c * t * t + d * t * t * t));
    velocity.push(.5 * (b + 2 * c * t + 3 * d * t * t));
  }
  return { position, bank: Math.atan2(velocity[1], Math.abs(velocity[0]) + 1) * .14 };
}
function birdPose(bird, time) {
  const path = flight(bird, time);
  // A short sequence of wingbeats, followed by an extended glide. Different
  // routes and rhythms prevent the flock moving like a synchronized wave.
  const stroke = t => {
    const cycle = (t + bird.phase) % 7.6;
    const envelope = Math.sin(Math.PI * clamp(cycle / 3.2)) ** 2;
    return Math.sin(t * 4.6 + bird.phase) * envelope;
  };
  const bank = path.bank - flight(bird, 0).bank;
  return { position: path.position, flap: (stroke(time) - stroke(0)) * bird.lift,
    scale: clamp(1 + (path.position[1] - bird.center[1]) * .0008, .86, 1.12),
    cos: Math.cos(bank), sin: Math.sin(bank) };
}
export function birdPoint(bird, x, y, time, pose = birdPose(bird, time)) {
  const [cx, cy] = bird.center;
  const wing = clamp(Math.abs(x - cx) / 40) * clamp((cy - y) / 18);
  const dx = x - cx, dy = y - cy + pose.flap * wing;
  return [pose.position[0] + (dx * pose.cos - dy * pose.sin) * pose.scale,
    pose.position[1] + (dx * pose.sin + dy * pose.cos) * pose.scale];
}

const waterAreas = [
  [[870,436],[1367,433],[1363,548],[1200,578],[1120,659],[995,657],[984,579],[875,572]],
  [[716,697],[1007,686],[1114,652],[1200,696],[1126,775],[1010,800],[966,854],[865,908],[725,900],[630,836],[555,827]],
  [[255,804],[428,815],[605,863],[725,902],[866,902],[948,884],[1074,929],[1234,931],[1349,986],[1069,1023],[694,1023],[535,948],[372,938],[242,899],[154,850]],
];
const personArea = [[650,516],[711,486],[722,447],[773,445],[799,472],[859,473],[890,524],[876,613],[848,643],[812,642],[802,599],[771,564],[689,560]];
// Only the loose bottom edge below the armrest. Back, shoulders and arms stay fixed.
const hemArea = [[815,617],[848,615],[848,629],[839,637],[818,634]];
const rippleSources = [[1150,570,0],[960,735,2.7],[465,866,4.4],[352,863,1.1]];
const screens = [
  { kind: 'code', quad: [[437,369],[560,382],[554,471],[437,458]], width: 124, height: 90 },
  { kind: 'terminal', quad: [[334,404],[439,412],[439,480],[335,475]], width: 105, height: 72 },
  { kind: 'plot', quad: [[641,438],[717,444],[716,490],[641,486]], width: 77, height: 48 },
];
const codeLines = [
  'import { field } from "./sim";', '', 'const state = new Map();',
  'function step(dt) {', '  for (const p of field) {',
  '    const v = sample(p, dt);', '    state.set(p.id, v);', '  }', '  return state;', '}', '',
  'const frame = step(clock.dt);', 'render(frame);', '', 'export { step, state };',
];

function nearPolygon(x, y, polygon) {
  if (inside(x, y, polygon)) return true;
  return polygon.some(([ax, ay], i) => {
    const [bx, by] = polygon[(i + 1) % polygon.length], dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
    return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 < 6.25;
  });
}

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
      const x0 = Math.floor(Math.min(...xs)) - 3, x1 = Math.ceil(Math.max(...xs)) + 3;
      const y0 = Math.floor(Math.min(...ys)) - 3, y1 = Math.ceil(Math.max(...ys)) + 3;
      const mask = new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1));
      const stride = x1 - x0 + 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = (y * this.sourceW + x) * 4;
        if (!nearPolygon(x, y, bird.points) || sky(...this.original.slice(i, i + 3))) continue;
        mask[(y - y0) * stride + x - x0] = 1;
        const left = (y * this.sourceW + x0 - 7) * 4;
        const right = (y * this.sourceW + x1 + 7) * 4;
        const mix = (x - x0) / stride;
        for (let channel = 0; channel < 3; channel++) bitmap.data[i + channel] = this.original[left + channel] * (1 - mix) + this.original[right + channel] * mix;
      }
      return { bird, x0, y0, x1, y1, mask, stride };
    });
    this.detailMasks = detailShapes.map(shape => {
      const x0 = Math.floor(Math.min(...shape.polygon.map(p => p[0]))) - 2;
      const x1 = Math.ceil(Math.max(...shape.polygon.map(p => p[0]))) + 2;
      const y0 = Math.floor(Math.min(...shape.polygon.map(p => p[1]))) - 2;
      const y1 = Math.ceil(Math.max(...shape.polygon.map(p => p[1]))) + 2;
      const stride = x1-x0+1, mask = new Uint8Array(stride*(y1-y0+1));
      for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) {
        if (!inside(x,y,shape.polygon)) continue;
        const i=(y*this.sourceW+x)*4, r=this.original[i], g=this.original[i+1], b=this.original[i+2];
        if (shape.kind==='eye' && !(g-r>45 && b-r>45 && g>125)) continue;
        if (shape.kind==='leaves' && !(g>r*1.2 && g>b*.9 && g>40)) continue;
        mask[(y-y0)*stride+x-x0]=1;
        const left=(y*this.sourceW+x0-3)*4, right=(y*this.sourceW+x1+3)*4;
        for (let c=0; c<3; c++) {
          bitmap.data[i+c]=shape.background ? this.original[(shape.background[1]*this.sourceW+shape.background[0])*4+c] :
            this.original[left+c]*(1-(x-x0)/stride)+this.original[right+c]*(x-x0)/stride;
        }
      }
      return { shape,x0,x1,y0,y1,mask,stride };
    });
    ctx.putImageData(bitmap, 0, 0);
    this.cloudSources = cloudWindows.map(window => {
      const [x0,y0,width,height] = window.box, pixels = new Uint8ClampedArray(width*height*4);
      for (let y=0; y<height; y++) {
        const valid=[];
        for (let x=0; x<width; x++) {
          const i=((y+y0)*this.sourceW+x+x0)*4, rgb=Array.from(bitmap.data.slice(i,i+3));
          const outsideSun=Math.hypot(x+x0-1100,y+y0-375)>34;
          if (skyPixel(rgb) && window.accepts(x+x0,y+y0) && outsideSun) valid.push({x,rgb});
        }
        let next=0;
        for (let x=0; x<width; x++) {
          while (next<valid.length-1 && valid[next].x<x) next++;
          const a=valid[Math.max(0,next-1)], b=valid[next];
          const rgb = a && b ? mix(a.rgb,b.rgb,clamp((x-a.x)/Math.max(1,b.x-a.x))) : [123,202,216];
          pixels.set([...rgb,255],(y*width+x)*4);
        }
        // Match the ends of the repeating texture, so a wrap cannot introduce
        // a vertical seam as the clouds travel in one direction.
        for (let edge=0; edge<32; edge++) for (let c=0; c<3; c++) {
          const l=(y*width+edge)*4+c, r=(y*width+width-1-edge)*4+c;
          const mean=(pixels[l]+pixels[r])/2, amount=(1-edge/32)**2;
          pixels[l]=pixels[l]*(1-amount)+mean*amount; pixels[r]=pixels[r]*(1-amount)+mean*amount;
        }
      }
      return { ...window,width,height,pixels };
    });
    this.base = document.createElement('canvas');
    this.cloudLayer = document.createElement('canvas');
    this.screenLayer = document.createElement('canvas');
    this.screens = screens.map(screen => {
      const canvas = document.createElement('canvas');
      canvas.width = screen.width * 3; canvas.height = screen.height * 3;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.scale(3, 3);
      return { ...screen, canvas, ctx, frame: -1 };
    });
  }

  resize(width, height) {
    this.width = width; this.height = height;
    this.scale = width / this.sourceW;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    for (const canvas of [this.canvas, this.base, this.cloudLayer, this.screenLayer]) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.columns = Math.min(380, Math.max(240, Math.round(width / 4.6)));
    this.rows = Math.round(height / (width / this.columns * 1.28));
    this.cellW = width / this.columns; this.cellH = height / this.rows;
    this.fontSize = this.cellH * 1.06;
    this.palette = new GlyphAtlas(this.fontSize, Math.max(2,dpr));
    this.cloudCtx = this.cloudLayer.getContext('2d'); this.cloudCtx.setTransform(dpr,0,0,dpr,0,0);
    this.screenCtx = this.screenLayer.getContext('2d'); this.screenCtx.setTransform(dpr,0,0,dpr,0,0);
    this.cloudFrame = this.screenFrame = -1;
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
    this.water = [];
    this.cloudCells = []; this.screenCells = []; this.cells = [];
    const sxStep = this.sourceW / this.columns, syStep = this.sourceH / this.rows;
    const grid=[];
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.columns; col++) {
      const sx = (col + .5) * sxStep, sy = (row + .5) * syStep;
      const rgb = this.sample(sx, sy), seed = hash(col, row);
      const isWater = waterAreas.some(poly => inside(sx, sy, poly)) &&
        ((rgb[2] > rgb[0] * 1.1 && rgb[1] > rgb[0] * 1.13) || (light(rgb) > .57 && rgb[0] > 150));
      const isHem = inside(sx, sy, hemArea) && rgb[0] > rgb[2] * 1.8;
      const cloudIndex = skyPixel(rgb) ? this.cloudSources.findIndex(source => {
        const [x,y,w,h]=source.box; return sx>x && sx<x+w && sy>y && sy<y+h && source.accepts(sx,sy);
      }) : -1;
      const screenIndex = this.screens.findIndex(screen => inside(sx,sy,screen.quad));
      grid.push({sx,sy,rgb,seed,isWater,isHem,cloudIndex,screenIndex});
    }
    const occupied=new Uint8Array(grid.length);
    for (let row=0; row<this.rows; row++) for (let col=0; col<this.columns; col++) {
      const index=row*this.columns+col;
      if (occupied[index]) continue;
      const first=grid[index];
      let span=1, rgb=first.rgb, sx=first.sx, sy=first.sy;
      // Merge a few smooth 2×2 patches into one larger letter. Edges, small
      // objects and screens keep the fine grid; unlike arbitrary font inflation,
      // each large character has its own space and cannot collide with neighbors.
      if (!(col%2) && !(row%2) && col+1<this.columns && row+1<this.rows &&
          first.screenIndex<0 && !first.isHem && hash(Math.floor(col/8),Math.floor(row/8))<.42 &&
          !this.detailMasks.some(r=>sx>r.x0-4 && sx<r.x1+4 && sy>r.y0-4 && sy<r.y1+4)) {
        const indices=[index,index+1,index+this.columns,index+this.columns+1], block=indices.map(i=>grid[i]);
        const same=block.every(c=>c.cloudIndex===first.cloudIndex && c.screenIndex===first.screenIndex && c.isWater===first.isWater && !c.isHem);
        const contrast=Math.max(...[0,1,2].map(c=>Math.max(...block.map(p=>p.rgb[c]))-Math.min(...block.map(p=>p.rgb[c]))));
        if (same && contrast<38) {
          span=2; sx+=sxStep/2; sy+=syStep/2;
          rgb=[0,1,2].map(c=>block.reduce((sum,p)=>sum+p.rgb[c],0)/4);
          indices.forEach(i=>occupied[i]=1);
        }
      }
      const {seed,isWater,isHem,cloudIndex,screenIndex}=first;
      const cell = { sx, sy, rgb, span, size: span===2 ? 1.8+seed*.18 : .84+seed*.28,
        x: sx * this.scale + (seed - .5) * .4,
        y: sy * this.scale + (hash(row, col) - .5) * .35,
        seed, phase: seed * Math.PI * 2, glyph: glyph(rgb, seed), color: color(rgb),
        kind: isHem ? 'hem' : 'ambient' };
      const isAmbient = !isWater && !inside(sx, sy, personArea) && seed < .018;
      this.cells.push(cell);
      if (cloudIndex>=0) this.cloudCells.push({...cell,cloudIndex});
      else if (screenIndex>=0) this.screenCells.push({...cell,screen:this.screens[screenIndex],uv:screenUV(sx,sy,this.screens[screenIndex])});
      else if (isHem || isAmbient) this.dynamic.push(cell);
      else this.paint(baseCtx, cell, cell.x, cell.y, cell.size, cell.color);
      if (isWater) {
        // Water keeps a complete, fixed character bed. Moving light is added on
        // top; no character leaves a hole at the edge of a moving region.
        this.water.push({ ...cell, color: color(rgb.map((v, c) => Math.min(255, v * 1.15 + [52,59,62][c]))),
          waveA: sx * .052 + sy * .083, waveB: sx * .023 - sy * .037,
          rings: rippleSources.map(([x, y, phase]) => ({ distance: Math.hypot((sx - x) / 1.7, (sy - y) * 2.2), phase })) });
      }
    }
    const spriteCells = (region, detail=1) => {
      const xStep=sxStep*detail, yStep=syStep*detail;
      const cells = [];
      for (let sy = region.y0; sy < region.y1; sy += yStep) for (let sx = region.x0; sx < region.x1; sx += xStep) {
        const sum = [0, 0, 0]; let count = 0, px = 0, py = 0;
        for (let y = Math.floor(sy); y < Math.min(region.y1 + 1, sy + yStep); y++) {
          for (let x = Math.floor(sx); x < Math.min(region.x1 + 1, sx + xStep); x++) {
            if (!region.mask[(y - region.y0) * region.stride + x - region.x0]) continue;
            const i = (y * this.sourceW + x) * 4;
            for (let c = 0; c < 3; c++) sum[c] += this.original[i + c];
            count++; px += x; py += y;
          }
        }
        if (count < 3) continue;
        const rgb = sum.map(v => v / count);
        cells.push({ sx: px / count, sy: py / count, glyph: glyph(rgb, hash(sx, sy)), color: color(rgb), size: detail*(.78 + .22 * clamp(count / (xStep * yStep))) });
      }
      return cells;
    };
    this.sprites = this.birdMasks.map(region=>({bird:region.bird,cells:spriteCells(region)}));
    this.details = this.detailMasks.map(region=>({shape:region.shape,cells:spriteCells(region,region.shape.kind==='eye'?.46:1)}));
    // Rasterize colored characters once. Repeated fillText + transform + color
    // sampling for thousands of cells made the previous animation CPU-bound.
    const movingCells = [...this.dynamic, ...this.water, ...this.sprites.flatMap(sprite => sprite.cells), ...this.details.flatMap(sprite=>sprite.cells)];
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
  drawClouds(time) {
    const frame=Math.floor(time*8);
    if (frame!==this.cloudFrame) {
      this.cloudFrame=frame;
      this.cloudCtx.clearRect(0,0,this.width,this.height);
      for (const cell of this.cloudCells) {
        const source=this.cloudSources[cell.cloudIndex], [bx,by,w,h]=source.box;
        const x=((cell.sx-bx-time*2.6)%w+w)%w, y=clamp(cell.sy-by,0,h-1);
        const x0=Math.floor(x), x1=(x0+1)%w, y0=Math.floor(y), y1=Math.min(y0+1,h-1);
        const fx=x-x0, fy=y-y0, p=source.pixels;
        const cloud=[0,1,2].map(c=>
          (p[(y0*w+x0)*4+c]*(1-fx)+p[(y0*w+x1)*4+c]*fx)*(1-fy)+
          (p[(y1*w+x0)*4+c]*(1-fx)+p[(y1*w+x1)*4+c]*fx)*fy);
        const edge=smooth(Math.min((cell.sx-bx)/24,(bx+w-cell.sx)/24,(cell.sy-by)/18,(by+h-cell.sy)/18));
        const sun=smooth((Math.hypot(cell.sx-1100,cell.sy-375)-35)/60);
        const rgb=mix(cell.rgb,cloud,.84*edge*sun);
        cell.frameRGB=rgb; cell.frameGlyph=glyph(rgb,cell.seed);
        this.palette.get(cell.frameGlyph,rgb);
      }
      // Finish atlas writes before reading from it; interleaving them forces a
      // full texture upload for every newly encountered color on some devices.
      for (const cell of this.cloudCells) {
        this.palette.draw(this.cloudCtx,cell.frameGlyph,cell.frameRGB,cell.x,cell.y,cell.size);
      }
    }
    this.ctx.drawImage(this.cloudLayer,0,0,this.width,this.height);
  }
  drawScreens(time) {
    const frame = Math.floor(time * 8);
    for (const screen of this.screens) {
      if (screen.frame !== frame) {
        screen.frame = frame;
        const { ctx, width, height, kind } = screen;
        ctx.fillStyle = kind==='plot' ? '#c4dbe0' : '#102633';
        ctx.fillRect(0, 0, width, height);
        ctx.font = '600 6px monospace'; ctx.textBaseline = 'top';
        if (kind === 'code') {
          const topLine = Math.floor(time / 3.4), typed = Math.floor((time % 3.4) * 15);
          for (let row = 0; row < 12; row++) {
            const line = codeLines[(topLine + row) % codeLines.length];
            ctx.fillStyle = '#080d13'; ctx.fillRect(0, 2 + row * 7, 12 + line.length * 3, 5);
            ctx.fillStyle = '#527587'; ctx.fillText(String(topLine + row + 1).padStart(2, '0'), 2, 2 + row * 7);
            ctx.fillStyle = ['#72d9b2','#9fbfd1','#e4ba75','#8cd6df'][row % 4];
            ctx.fillText(row === 11 ? line.slice(0, typed) : line, 12, 2 + row * 7);
          }
          if (time % 1.2 < .7) { ctx.fillStyle = '#b6f4db'; ctx.fillRect(12 + Math.min(typed, codeLines[(topLine + 11) % codeLines.length].length) * 3, 79, 2.6, 5); }
        } else if (kind === 'terminal') {
          const history = ['> sample(field)', 'position = vec3(...)', 'velocity += force * dt',
            'field.update(dt)', '> integrate(state)', 'state.frame += 1', 'write(buffer)', '> draw(frame)'];
          const offset = Math.floor(time / 2.6), typed = Math.floor((time % 2.6) * 14);
          const current = history[(offset + 7) % history.length].slice(0, typed);
          const logs = [`[ t = ${time.toFixed(1)} ]`, ...Array.from({ length: 7 }, (_, row) => history[(offset + row) % history.length]), current];
          logs.forEach((line, row) => {
            ctx.fillStyle = '#080d13'; ctx.fillRect(3, 3 + row * 7.5, line.length * 3, 5);
            ctx.fillStyle = row === 4 ? '#e2ba76' : '#75c9c7'; ctx.fillText(line, 3, 3 + row * 7.5);
          });
          if (time % 1 < .55) { ctx.fillStyle = '#b1e8bc'; ctx.fillRect(3 + current.length * 3, 63, 3, 5); }
        } else {
          ctx.fillStyle = '#080d13'; ctx.fillRect(2, 1, 38, 6);
          ctx.fillStyle = '#90c7d9'; ctx.fillText('FIELD / LIVE', 3, 2);
          for (let col = 0; col < 23; col++) {
            const value = Math.sin(col * .36 - time * 1.6) * 5 + Math.sin(col * .71 + time * .6) * 2;
            ctx.fillStyle = '#080d13'; ctx.fillRect(col * 3 + 2, 19 + value, 3, 6);
            ctx.fillStyle = '#3b899f'; ctx.fillText('~', col * 3 + 2, 20 + value);
          }
          for (let col = 0; col < 9; col++) {
            const level = Math.round(2 + 1.5 * Math.sin(time * .8 + col));
            ctx.fillStyle = '#5990a4'; ctx.fillText('|'.repeat(level), 3 + col * 8, 38);
          }
        }
        screen.pixels=ctx.getImageData(0,0,screen.canvas.width,screen.canvas.height).data;
      }
    }
    if (frame!==this.screenFrame) {
      this.screenFrame=frame;
      this.screenCtx.clearRect(0,0,this.width,this.height);
      for (const cell of this.screenCells) {
        const screen=cell.screen, [u,v]=cell.uv, w=screen.canvas.width,h=screen.canvas.height;
        const x=Math.round(clamp(u)* (w-1)),y=Math.round(clamp(v)*(h-1));
        const rgb=[0,0,0];
        for (const dx of [-2,0,2]) for (const dy of [-2,0,2]) {
          const i=(clamp(y+dy,0,h-1)*w+clamp(x+dx,0,w-1))*4;
          for (let c=0;c<3;c++) rgb[c]+=screen.pixels[i+c]/9;
        }
        const edge=smooth(Math.min(u,v,1-u,1-v)/.12);
        const blended=mix(cell.rgb,rgb,edge*.65);
        // Exactly the scene's grid, font, sizing and color pipeline. Only the
        // display interior changes; the original rim and edge light are retained.
        cell.frameRGB=blended; cell.frameGlyph=glyph(blended,cell.seed);
        this.palette.get(cell.frameGlyph,blended);
      }
      for (const cell of this.screenCells) {
        this.palette.draw(this.screenCtx,cell.frameGlyph,cell.frameRGB,cell.x,cell.y,cell.size);
      }
    }
    this.ctx.drawImage(this.screenLayer,0,0,this.width,this.height);
  }
  drawDetails(time) {
    for (const sprite of this.details) {
      this.ctx.fillStyle='#080d13';
      for (const cell of sprite.cells) {
        const [x,y]=detailPoint(sprite.shape,cell.sx,cell.sy,time);
        this.ctx.fillRect(x*this.scale-this.cellW*.47*cell.size,y*this.scale-this.cellH*.44*cell.size,
          this.cellW*.94*cell.size,this.cellH*.88*cell.size);
      }
      for (const cell of sprite.cells) {
        const [x,y]=detailPoint(sprite.shape,cell.sx,cell.sy,time);
        this.stamp(cell,x*this.scale,y*this.scale,cell.size);
      }
    }
  }
  draw(time) {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.base, 0, 0, this.width, this.height);
    this.drawClouds(time);
    for (const cell of this.water) {
      const interference = .62 * Math.sin(cell.waveA - time * 1.8) + .38 * Math.sin(cell.waveB + time * .9);
      let shine = Math.max(0, interference) ** 5 * .65;
      for (const ring of cell.rings) {
        if (ring.distance > 150) continue;
        const age = (time + ring.phase) % 7.5, radius = age * 20;
        const edge = Math.abs(ring.distance - radius);
        if (edge < 9) shine += (1 - edge / 9) ** 2 * Math.sin(Math.PI * age / 7.5) * .65;
      }
      if (shine < .035) continue;
      ctx.globalAlpha = Math.min(.85, shine);
      this.stamp(cell, cell.x, cell.y, cell.size);
    }
    ctx.globalAlpha = 1;
    for (const cell of this.dynamic) {
      let x = cell.x, y = cell.y, size = cell.size;
      if (cell.kind === 'hem') {
        y += Math.sin(time * 1.3) * .35 * clamp((cell.sy - 617) / 17) * this.scale;
      } else {
        size *= 1 + .065 * Math.sin(time * .75 + cell.phase);
      }
      this.stamp(cell, x, y, size);
    }
    this.drawScreens(time);
    this.drawDetails(time);
    for (const sprite of this.sprites) {
      const pose = birdPose(sprite.bird, time);
      // Occlude only occupied feather cells. Filling the whole hit polygon can
      // expose black triangles between the bent wing and its sampled feathers.
      ctx.fillStyle = '#080d13';
      for (const cell of sprite.cells) {
        const [x, y] = birdPoint(sprite.bird, cell.sx, cell.sy, time, pose);
        const size = cell.size * pose.scale;
        ctx.fillRect(x * this.scale - this.cellW * .43 * size, y * this.scale - this.cellH * .4 * size,
          this.cellW * .86 * size, this.cellH * .8 * size);
      }
      for (const cell of sprite.cells) {
        const [x, y] = birdPoint(sprite.bird, cell.sx, cell.sy, time, pose);
        this.stamp(cell, x * this.scale, y * this.scale, cell.size * pose.scale);
      }
    }
  }
}
