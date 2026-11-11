import { scenePixelRatio } from './render-budget.js?v=20261111-type26';
import { createCanvas } from './canvas-factory.js?v=20261110-fps10';
import { detailShapes, detailPoint, eyeOpening, cloudWindows, cloudSpeed, emitters } from './scene-details.js?v=20261111-type26';
import { GlyphAtlas, glyphColor } from './glyph-atlas.js?v=20261111-type26';
import { screens, paintScreen } from './screen-content.js?v=20261111-type26';
import { faceLight, lampColor } from './scene-lights.js?v=20261111-type26';
import { quadPoint, drawQuad } from './scene-geometry.js?v=20261110-fps10';
import { GlyphMotion } from './glyph-motion.js?v=20261111-type26';
import { SpriteAtlas } from './sprite-atlas.js?v=20261111-type26';
import { sceneGlyph, glyphAt, prepareGlyph, glyphVariant } from './glyph-rhythm.js?v=20261111-type26';
import { glyphLayout } from './glyph-layout.js?v=20261111-type26';
import { glyphWeight, sceneColor, sceneRGB } from './scene-style.js?v=20261111-type26';

// Source-image coordinates keep motion, perspective and hit targets in agreement.
export const birds = [
  { id: 'primary', center: [991,263], phase: 0, lift: 17, duration: 28,
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

const polygonBounds = new WeakMap();
export function inside(x, y, polygon) {
  let bounds = polygonBounds.get(polygon);
  if (!bounds) {
    bounds = [Math.min(...polygon.map(p=>p[0])), Math.min(...polygon.map(p=>p[1])), Math.max(...polygon.map(p=>p[0])), Math.max(...polygon.map(p=>p[1]))];
    polygonBounds.set(polygon,bounds);
  }
  if (x < bounds[0] || y < bounds[1] || x > bounds[2] || y > bounds[3]) return false;
  let contained = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) contained = !contained;
  }
  return contained;
}
const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
// Interleave small and large letters locally, independently of symbol choice
// and negative space. Sizes are assigned once, not randomized each frame.
const sizeStops=[.03,.09,.19,.33,.52,.74,.90,1];
const mixedSize=(x,y)=>{
  const seed=hash(x+137,y+271);
  return fontSizes[sizeStops.findIndex(stop=>seed<stop)];
};
const light = c => (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / 255;
const color = sceneColor;
const glyph = sceneGlyph;
const sky = (r, g, b) => g - r > 26 && b - r > 33;
const skyPixel = rgb => (rgb[1] - rgb[0] > 15 && rgb[2] - rgb[0] > 20 && rgb[1] > 110) || Math.min(...rgb) > 150;
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const yieldToBrowser = () => globalThis.scheduler?.yield ? scheduler.yield() : new Promise(resolve=>setTimeout(resolve,0));
export const fontSizes = [.5,.6,.7,.8,.9,1,1.1,1.2];
export const minFontSize=fontSizes[0];
export const detailFontSize=.5;
export const fontIncrement=.1;
export const fontStep = size => fontSizes[clamp(Math.round((size-minFontSize)/fontIncrement),0,fontSizes.length-1)];

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
export function birdPose(bird, time) {
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
// Trace the distant buildings in source coordinates. Keep the common sampling
// grid and colors; only their glyph size is fixed. Window frames and the nearer
// monitor, shelving and plant remain outside these silhouettes.
const distantCity = [
  [[1114,447],[1134,437],[1143,437],[1143,416],[1152,415],[1152,404],[1162,404],[1163,420],[1171,419],
   [1171,376],[1178,373],[1179,357],[1186,356],[1187,345],[1191,345],[1191,359],[1197,359],[1198,376],
   [1205,379],[1205,402],[1211,402],[1211,384],[1222,384],[1222,412],[1229,406],[1238,407],[1239,417],
   [1251,418],[1251,398],[1266,397],[1266,415],[1279,413],[1279,423],[1293,425],[1293,402],[1306,399],
   [1306,423],[1317,421],[1317,435],[1324,434],[1325,411],[1335,412],[1335,423],[1341,423],[1341,412],
   [1352,411],[1352,397],[1362,397],[1362,451],[1335,452],[1318,448],[1280,453],[1256,449],[1224,450],
   [1195,450],[1160,447],[1133,453]],
  [[1384,399],[1393,391],[1394,379],[1403,377],[1403,347],[1411,337],[1411,431],[1384,431]],
  [[1427,360],[1439,360],[1439,332],[1448,332],[1448,314],[1464,314],[1464,325],[1477,325],
   [1477,307],[1496,307],[1496,300],[1527,300],[1527,332],[1512,338],[1512,351],[1494,354],
   [1471,355],[1460,351],[1450,358],[1444,361],[1427,367]],
];
const personArea = [[650,516],[711,486],[722,447],[773,445],[799,472],[859,473],[890,524],[876,613],[848,643],[812,642],[802,599],[771,564],[689,560]];
// Trace the actual curls separately from the broad body/motion exclusion area.
// The screen stays whole behind this foreground silhouette, including the
// loose locks to the left of the head and the neck at its lower-right corner.
const screenOccluder = [[722,460],[724,457],[727,457],[725,454],[728,452],[729,449],
  [726,445],[723,443],[724,441],[729,444],[732,447],[733,450],[743,449],[751,446],
  [757,440],[762,440],[759,444],[758,448],[757,451],[768,451],[769,449],[770,452],
  [769,457],[778,464],[781,463],[780,466],[785,466],[801,478],[801,540],[710,540],
  [710,515],[713,512],[708,509],[708,505],[706,501],[702,504],[699,503],[701,499],
  [703,495],[704,488],[699,488],[696,484],[697,482],[699,485],[704,486],[705,480],
  [707,476],[707,474],[701,475],[700,474],[700,472],[704,472],[707,470],[708,466],
  [713,462],[719,460]];
// Only the loose bottom edge below the armrest. Back, shoulders and arms stay fixed.
const hemArea = [[815,617],[848,615],[848,629],[839,637],[818,634]];
const monitorHousing = [[416,340],[618,358],[620,498],[417,498]];
const rippleSources = [[1150,570,0],[960,735,2.7],[465,866,4.4],[352,863,1.1]];

function nearPolygon(x, y, polygon) {
  if (inside(x, y, polygon)) return true;
  return polygon.some(([ax, ay], i) => {
    const [bx, by] = polygon[(i + 1) % polygon.length], dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
    return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 < 6.25;
  });
}

export class AsciiRenderer {
  constructor(image, canvas, deferred = false) {
    this.image = image;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.sourceW = image.naturalWidth || image.width;
    this.sourceH = image.naturalHeight || image.height;
    this.plate = createCanvas();
    this.plate.width = this.sourceW;
    this.plate.height = this.sourceH;
    const ctx = this.plate.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const bitmap = ctx.getImageData(0, 0, this.sourceW, this.sourceH);
    this.original = bitmap.data.slice();
    this.preparation = this.prepareSource(bitmap, ctx);
    if (!deferred) for (const _ of this.preparation) { /* synchronous API for exports and tests */ }
  }
  static async create(image, canvas, onProgress = () => {}) {
    const renderer = new AsciiRenderer(image,canvas,true);
    for (const progress of renderer.preparation) { onProgress(progress); await yieldToBrowser(); }
    return renderer;
  }
  *prepareSource(bitmap, ctx) {
    // Remove only bird-colored pixels from the sky plate. The bird pixels become
    // character sprites; this prevents a static ghost behind the flapping wings.
    this.birdMasks = [];
    for (const bird of birds) {
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
      this.birdMasks.push({ bird, x0, y0, x1, y1, mask, stride });
      yield this.birdMasks.length / birds.length * .15;
    }
    this.detailMasks = [];
    for (const shape of detailShapes) {
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
      this.detailMasks.push({ shape,x0,x1,y0,y1,mask,stride });
      yield .15 + this.detailMasks.length / detailShapes.length * .15;
    }
    for (const emitter of emitters) {
      const [x0,y0,w,h]=emitter.box;
      for (let y=y0;y<y0+h;y++) for (let x=x0;x<x0+w;x++) {
        if (!inside(x,y,emitter.polygon)) continue;
        const i=(y*this.sourceW+x)*4;
        if (emitter.kind==='lamp' && !(this.original[i+1]>120 && this.original[i+2]>130)) continue;
        bitmap.data[i]=12; bitmap.data[i+1]=25; bitmap.data[i+2]=33;
      }
    }
    ctx.putImageData(bitmap, 0, 0);
    this.platePixels = bitmap.data;
    // Sampling uses the retained pixels; release the redundant source canvas.
    this.plate.width=1; this.plate.height=1;
    this.headMask = createCanvas();
    this.headMaskBox = [693,437,111,104];
    const [hx,hy,hw,hh]=this.headMaskBox;
    this.headMask.width=hw; this.headMask.height=hh;
    const maskCtx=this.headMask.getContext('2d'), mask=maskCtx.createImageData(hw,hh);
    for (let y=0;y<hh;y++) for (let x=0;x<hw;x++) {
      const sx=x+hx, sy=y+hy, i=(sy*this.sourceW+sx)*4;
      const r=this.original[i], g=this.original[i+1], b=this.original[i+2];
      // Keep dark curls and warm hair/skin highlights. White/cyan background
      // inside the rough outline must remain part of the display behind it.
      const foreground=Math.max(r,g,b)<135 || (r>g*1.08 && r>b*1.5);
      if (foreground && nearPolygon(sx,sy,screenOccluder)) mask.data[(y*hw+x)*4+3]=255;
    }
    maskCtx.putImageData(mask,0,0);
    this.cloudSources = [];
    for (const window of cloudWindows) {
      const [x0,y0,width,height] = window.box, pixels = new Uint8ClampedArray(width*height*4);
      const validX = new Int32Array(width), validPixel = new Int32Array(width), source = bitmap.data;
      for (let y=0; y<height; y++) {
        let count=0;
        for (let x=0; x<width; x++) {
          const i=((y+y0)*this.sourceW+x+x0)*4, r=source[i], g=source[i+1], b=source[i+2];
          const outsideSun=(x+x0-1100)**2+(y+y0-375)**2>34**2;
          if (((g-r>15 && b-r>20 && g>110) || Math.min(r,g,b)>150) && window.accepts(x+x0,y+y0) && outsideSun) {
            validX[count]=x; validPixel[count++]=i;
          }
        }
        let next=0;
        for (let x=0; x<width; x++) {
          while (next<count-1 && validX[next]<x) next++;
          const previous=Math.max(0,next-1), a=validPixel[previous], b=validPixel[next];
          const blend=clamp((x-validX[previous])/Math.max(1,validX[next]-validX[previous])), target=(y*width+x)*4;
          for (let c=0;c<3;c++) pixels[target+c]=count ? source[a+c]*(1-blend)+source[b+c]*blend : [123,202,216][c];
          pixels[target+3]=255;
        }
        // Match the ends of the repeating texture, so a wrap cannot introduce
        // a vertical seam as the clouds travel in one direction.
        for (let edge=0; edge<32; edge++) for (let c=0; c<3; c++) {
          const l=(y*width+edge)*4+c, r=(y*width+width-1-edge)*4+c;
          const mean=(pixels[l]+pixels[r])/2, amount=(1-edge/32)**2;
          pixels[l]=pixels[l]*(1-amount)+mean*amount; pixels[r]=pixels[r]*(1-amount)+mean*amount;
        }
        if (!(y%24)) yield .3 + .7 * (this.cloudSources.length + y/height) / cloudWindows.length;
      }
      const texture=createCanvas(), fade=createCanvas(), layer=createCanvas();
      for (const canvas of [texture,fade,layer]) { canvas.width=width; canvas.height=height; }
      const textureCtx=texture.getContext('2d'), colors=textureCtx.createImageData(width,height);
      const fadeCtx=fade.getContext('2d'), opacity=fadeCtx.createImageData(width,height);
      const tone=new Uint8Array(3);
      for (let y=0;y<height;y++) {
        for (let x=0;x<width;x++) {
          const i=(y*width+x)*4;
          sceneRGB(pixels[i],pixels[i+1],pixels[i+2],tone);
          for (let c=0;c<3;c++) colors.data[i+c]=tone[c];
          colors.data[i+3]=255;
          const edge=smooth(Math.min(x/24,(width-x)/24,y/18,(height-y)/18));
          const sun=smooth((Math.hypot(x+x0-1100,y+y0-375)-35)/60);
          opacity.data[i+3]=Math.round(255*.78*edge*sun);
        }
        if (!(y%32)) yield .3 + .7*(this.cloudSources.length+.95)/cloudWindows.length;
      }
      textureCtx.putImageData(colors,0,0); fadeCtx.putImageData(opacity,0,0);
      this.cloudSources.push({ ...window,width,height,texture,fade,layer,ctx:layer.getContext('2d') });
    }
    this.base = createCanvas();
    this.cloudLayer = createCanvas();
    this.cloudBase = createCanvas();
    this.screenLayer = createCanvas();
    this.screens = screens.map(screen => {
      const canvas = createCanvas();
      canvas.width = screen.width * 3; canvas.height = screen.height * 3;
      const ctx = canvas.getContext('2d');
      ctx.scale(3, 3);
      return { ...screen, canvas, ctx, frame: -1 };
    });
    yield 1;
  }

  resize(width, height) {
    for (const _ of this.prepareSize(width,height)) { /* synchronous resize after orientation changes */ }
  }
  async resizeAsync(width, height, onProgress = () => {}) {
    for (const progress of this.prepareSize(width,height)) { onProgress(progress); await yieldToBrowser(); }
    this.drawClouds(0);
    await yieldToBrowser();
    this.drawScreens(0);
    this.drawLights(0);
    onProgress(1);
    await yieldToBrowser();
  }
  *prepareSize(width, height) {
    this.width = width; this.height = height;
    this.scale = width / this.sourceW;
    const dpr = scenePixelRatio(width,height);
    this.pixelRatio = dpr;
    for (const canvas of [this.canvas, this.base]) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    // Transparent caches cover only their content, not the whole room.
    // Integer CSS bounds avoid a second resampling of fractional-sized DOM
    // canvases. Glyph coordinates share one source-image coordinate system.
    const box=([x,y,w,h])=>{const left=Math.floor(x*this.scale),top=Math.floor(y*this.scale);
      return[left,top,Math.ceil((x+w)*this.scale)-left,Math.ceil((y+h)*this.scale)-top];};
    this.cloudBox=box([522,68,1024,355]);
    this.screenBox=box([325,350,420,165]);
    for (const [canvas,box] of [[this.cloudLayer,this.cloudBox],[this.cloudBase,this.cloudBox],[this.screenLayer,this.screenBox]]) {
      canvas.width=Math.ceil(box[2]*dpr); canvas.height=Math.ceil(box[3]*dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Use one bounded sampling budget for the room. The display positions are
    // relaxed independently below, so letters do not occupy uniform slots.
    this.columns = Math.min(300, Math.max(180, Math.round(width / 5.6)));
    this.rows = Math.round(height / (width / this.columns * 1.42));
    this.cellW = width / this.columns; this.cellH = height / this.rows;
    // Size and spacing are independent: opening the grid must not enlarge
    // every letter by the same factor and immediately fill the gaps again.
    // Retain a readable desktop floor, with proportional sizing in small views.
    this.fontSize = Math.min(width*.005, Math.max(5.6,width*.0034));
    this.maxGlyphSize=fontSizes.at(-1);
    for (const screen of this.screens) {
      screen.fontSize=this.fontSize/this.scale*(screen.kind==='code'?1:.9);
      screen.frame=-1;
    }
    this.palette = new SpriteAtlas(this.fontSize,Math.max(2,dpr));
    this.cloudCtx = this.cloudLayer.getContext('2d'); this.cloudCtx.setTransform(dpr,0,0,dpr,-this.cloudBox[0]*dpr,-this.cloudBox[1]*dpr);
    this.screenCtx = this.screenLayer.getContext('2d'); this.screenCtx.setTransform(dpr,0,0,dpr,-this.screenBox[0]*dpr,-this.screenBox[1]*dpr);
    this.screenFrame = -1;
    const baseCtx = this.base.getContext('2d', { alpha: false });
    baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseCtx.fillStyle = '#080d13'; baseCtx.fillRect(0, 0, width, height);
    this.prepare(baseCtx);
    this.dynamic = [];
    this.water = [];
    this.cloudCells = []; this.cells = [];
    const staticCells = [];
    const sxStep = this.sourceW / this.columns, syStep = this.sourceH / this.rows;
    const layout=glyphLayout({columns:this.columns,rows:this.rows,width:this.sourceW,height:this.sourceH,
      fontSize:this.fontSize/this.scale,maxSize:this.maxGlyphSize,fixedSize:detailFontSize,
      sizeAt:mixedSize,fixedAt:(x,y)=>distantCity.some(poly=>inside(x,y,poly))});
    let placement=layout.next();
    while(!placement.done){yield placement.value*.08;placement=layout.next();}
    const points=placement.value;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
      const point=points[row*this.columns+col],sx=point.x,sy=point.y;
      const {rgb,contrast} = this.sampleEdge(sx,sy,sxStep*.34,syStep*.34), seed = hash(col, row);
      const isCity=distantCity.some(polygon=>inside(sx,sy,polygon));
      const isWater = !isCity && waterAreas.some(poly => inside(sx, sy, poly)) &&
        ((rgb[2] > rgb[0] * 1.1 && rgb[1] > rgb[0] * 1.13) || (light(rgb) > .57 && rgb[0] > 150));
      const isHem = inside(sx, sy, hemArea) && rgb[0] > rgb[2] * 1.8;
      const cloudIndex = isCity ? -1 : this.cloudIndex(sx,sy,rgb);
      const skyWeight = Math.max(...this.cloudSources.map(source=>{
        const [x,y,w,h]=source.box;
        return smooth(Math.min(sx-x,x+w-sx,sy-y,y+h-sy)/28);
      }));
      // The sky shares the same local size variety as the room; do not pull
      // whole regions toward one size. The maximum stays below the former
      // silhouette cap, so no extra edge-dependent shrinking is needed.
      const variedSize=point.size;
      const size=isCity ? detailFontSize : variedSize;
      // Open up the dark room edges, not the colorful sky or bright water.
      // Featureless shadows may stay entirely empty; wider sampling protects
      // nearby contours without limiting hole size. The mask is fixed for the
      // scene, with a separate seed so remaining font sizes stay balanced.
      const smoothness=1-smooth((contrast-18)/65);
      const person=inside(sx,sy,personArea);
      const darkness=1-smooth((light(rgb)-.1)/.24);
      const sideWeight=1-smooth((sx-510)/220)+smooth((sx-1110)/220);
      const protectedCell=isCity||cloudIndex>=0||Math.hypot(sx-1100,sy-375)<33;
      const flatness=darkness>0&&!protectedCell?1-smooth((this.surfaceContrast(sx,sy,9)-10)/24):0;
      const openness=Math.max(.3+sideWeight*.55,flatness*(.35+sideWeight*.65));
      // The two narrow window posts are darker than the sky but not as dark as
      // room shadows. Open their inner faces too, keeping lit rims and cables.
      const pillarWeight=Math.max(
        smooth(Math.min(sx-833,850-sx,sy-72,483-sy)/2),
        smooth(Math.min(sx-1368,1380-sx,sy-145,515-sy)/2));
      const pillarSpace=pillarWeight*(1-smooth((light(rgb)-.43)/.2))*(1-smooth((contrast-16)/45))*.96;
      const chance=protectedCell?0:Math.max(openness*darkness*smoothness*(person?.35:1),pillarSpace);
      const blank=hash(col+91,row+47)<chance;
      const cell = { sx, sy, rgb, size, occupied:!blank, pillar:pillarWeight>0,
        x: sx * this.scale,
        y: sy * this.scale,
        seed, phase: seed * Math.PI * 2, glyph: glyph(rgb, seed), color: color(rgb),
        kind: isHem ? 'hem' : 'ambient', glyphVariant:0 };
      const isAmbient = !isCity && !isWater && contrast<65 && skyWeight<.1 && seed < .018 && !inside(sx, sy, personArea) && !inside(sx,sy,screenOccluder) && !inside(sx,sy,monitorHousing);
      cell.glyphLayer=cloudIndex>=0?'cloud':isHem||isAmbient?'dynamic':'base';
      cell.water=isWater;
      this.cells.push(cell);
      if(!cell.occupied)continue;
      if (cloudIndex>=0) {
        this.cloudCells.push({...cell,cloudIndex});
      }
      else if (isHem || isAmbient) this.dynamic.push(cell);
      else staticCells.push(cell);
      if (isWater) {
        // Reflections share the retained water cells and leave the intentional
        // spaces empty. Their layout never shifts with the ripple animation.
        this.water.push({ ...cell, glyphSource:cell, color: color(rgb.map((v, c) => Math.min(255, v * 1.15 + [52,59,62][c]))),
          sinA:Math.sin(sx*.052+sy*.083), cosA:Math.cos(sx*.052+sy*.083),
          sinB:Math.sin(sx*.023-sy*.037), cosB:Math.cos(sx*.023-sy*.037),
          rings: rippleSources.map(([x,y],index)=>({distance:Math.hypot((sx-x)/1.7,(sy-y)*2.2),index})).filter(r=>r.distance<=150) });
      }
      }
      if (!(row%4)) yield .08+row / this.rows * .52;
    }
    for(const progress of this.palette.prepare([...staticCells,...this.cloudCells],c=>glyphColor(c.rgb)))yield .6+progress*.02;
    for (let i=0;i<staticCells.length;i++) {
      const cell=staticCells[i];
      this.palette.draw(baseCtx,cell,cell.x,cell.y,cell.size);
      if (!(i%1024)) yield .62 + .13*i/staticCells.length;
    }
    const cloudBaseCtx=this.cloudBase.getContext('2d'); cloudBaseCtx.setTransform(dpr,0,0,dpr,-this.cloudBox[0]*dpr,-this.cloudBox[1]*dpr);
    for (let i=0;i<this.cloudCells.length;i++) {
      const cell=this.cloudCells[i]; this.palette.draw(cloudBaseCtx,cell,cell.x,cell.y,cell.size);
      if (!(i%1024)) yield .75;
    }
    const spriteCells = (region, detail=1) => {
      const xStep=sxStep*detail, yStep=syStep*detail;
      const cells = [];
      function* finePoints(){
        for(let y=region.y0;y<region.y1;y+=yStep)for(let x=region.x0;x<region.x1;x+=xStep)yield{x:x+xStep/2,y:y+yStep/2};
      }
      // Reuse the room's irregular positions for papers and floating objects,
      // avoiding rectangular islands of a different texture. Tiny bird/LED
      // features keep their original fine sampling for a readable silhouette.
      for(const point of region.bird||detail<1?finePoints():points){
        const sx=point.x-xStep/2,sy=point.y-yStep/2;
        if(sx+xStep<region.x0||sx>region.x1||sy+yStep<region.y0||sy>region.y1)continue;
        const sum = [0, 0, 0]; let count = 0, px = 0, py = 0;
        for (let y = Math.max(region.y0,Math.floor(sy)); y < Math.min(region.y1 + 1, sy + yStep); y++) {
          for (let x = Math.max(region.x0,Math.floor(sx)); x < Math.min(region.x1 + 1, sx + xStep); x++) {
            if (!region.mask[(y - region.y0) * region.stride + x - region.x0]) continue;
            const i = (y * this.sourceW + x) * 4;
            for (let c = 0; c < 3; c++) sum[c] += this.original[i + c];
            count++; px += x; py += y;
          }
        }
        if (count < 3) continue;
        const rgb = sum.map(v => v / count);
        const coverage=clamp(count/(xStep*yStep));
        // Papers and floats use the room's mixed sizes. Keep tiny LED features
        // legible and trim large letters at partially covered object edges.
        const size=region.bird?detailFontSize:detail<1?fontStep(detail*(1+.2*coverage)):fontStep(Math.min(point.size,1+.5*coverage));
        cells.push({ sx: px / count, sy: py / count, glyph: glyph(rgb, hash(sx, sy)), color: color(rgb), size });
      }
      return cells;
    };
    this.sprites = [];
    for (const region of this.birdMasks) { this.sprites.push({bird:region.bird,cells:spriteCells(region)}); yield .75; }
    this.details = [];
    for (const region of this.detailMasks) { this.details.push({shape:region.shape,cells:spriteCells(region,region.shape.kind==='eye'?.6:1)}); yield .78; }
    this.lights = emitters.map(emitter => {
      const [bx,by,w,h]=emitter.box, cells=[];
      if (emitter.plane) {
        const {width,height}=emitter.plane;
        for (let y=1;y<height;y+=1.8) for (let x=1;x<width;x+=1.5) {
          const u=x/width,v=y/height, p=quadPoint(emitter.polygon,u,v);
          const px=quadPoint(emitter.polygon,u+1/width,v), py=quadPoint(emitter.polygon,u,v+1/height);
          cells.push({x:p[0]*this.scale,y:p[1]*this.scale,u,v,
            basis:[px[0]-p[0],px[1]-p[1],py[0]-p[0],py[1]-p[1]],glyph:'+*'[Math.floor(hash(x,y)*2)],size:fontStep(2.8*this.scale/this.fontSize)});
        }
        return {emitter,cells};
      }
      for (let y=by+1;y<by+h;y+=1.8) for (let x=bx+1;x<bx+w;x+=1.5) {
        if (!inside(x,y,emitter.polygon)) continue;
        const i=(Math.floor(y)*this.sourceW+Math.floor(x))*4;
        const intensity=(this.original[i]+this.original[i+1]+this.original[i+2])/765;
        if (emitter.kind==='lamp' && !(this.original[i+1]>120 && this.original[i+2]>130)) continue;
        cells.push({x:x*this.scale,y:y*this.scale,u:(x-bx)/w,v:(y-by)/h,intensity,
          glyph: '+*'[Math.floor(hash(x,y)*2)],size:fontStep((emitter.kind==='lamp'?3.4:2.8)*this.scale/this.fontSize)});
      }
      return {emitter,cells};
    });
    for (const light of this.lights) {
      // Keep tiny LED faces legible while their letters still change.
      light.cells.forEach(cell=>{cell.glyphPoolOverride='+*';prepareGlyph(cell);});
      const [bx,by,w,h]=light.emitter.box, pad=this.fontSize;
      light.x=Math.floor(bx*this.scale-pad); light.y=Math.floor(by*this.scale-pad);
      light.canvas=createCanvas();
      light.canvas.width=Math.ceil((Math.ceil((bx+w)*this.scale+pad)-light.x)*dpr);
      light.canvas.height=Math.ceil((Math.ceil((by+h)*this.scale+pad)-light.y)*dpr);
      light.ctx=light.canvas.getContext('2d');
      light.ctx.setTransform(dpr,0,0,dpr,-light.x*dpr,-light.y*dpr);
      light.frame=null;
    }
    // Rasterize colored characters once. Repeated fillText + transform + color
    // sampling for thousands of cells made the previous animation CPU-bound.
    const movingCells = [...this.dynamic, ...this.water, ...this.sprites.flatMap(sprite => sprite.cells), ...this.details.flatMap(sprite=>sprite.cells)];
    this.spriteAtlas=new SpriteAtlas(this.fontSize,dpr);
    for(const progress of this.spriteAtlas.prepare(movingCells))yield .8+.12*progress;
    this.atlas=this.spriteAtlas.canvas;
    this.tilePixels=this.spriteAtlas.tile;this.tileSize=this.tilePixels/dpr;
    for (const sprite of this.details) for (const cell of sprite.cells) {
      cell.free=sprite.shape.kind==='paper' ? clamp((cell.sy-sprite.shape.anchor[1])/sprite.shape.length)**2 : clamp((sprite.shape.anchor[1]-cell.sy)/63);
      cell.sinX=Math.sin(cell.sx*.07); cell.cosX=Math.cos(cell.sx*.07);
    }
    for (const sprite of this.details) {
      if (sprite.shape.kind!=='float') continue;
      const pad=this.tileSize, xs=sprite.cells.map(c=>c.sx*this.scale), ys=sprite.cells.map(c=>c.sy*this.scale);
      const x=Math.floor(Math.min(...xs)-pad), y=Math.floor(Math.min(...ys)-pad);
      const width=Math.ceil(Math.max(...xs)-x+pad), height=Math.ceil(Math.max(...ys)-y+pad);
      const canvas=createCanvas(); canvas.width=Math.ceil(width*dpr); canvas.height=Math.ceil(height*dpr);
      sprite.texture={canvas,x,y,width,height};
      this.refreshFloat(sprite,0);
      yield .99;
    }
    // Static glyphs are baked into their textures. Lighting gets a separate,
    // bounded LRU atlas rather than retaining/growing the full photo palette.
    this.palette=new GlyphAtlas(this.fontSize,Math.max(2,dpr),2048);
    this.glyphMotion=new GlyphMotion(this);
    for(const progress of this.glyphMotion.prepare())yield .99+progress*.01;
  }

  cloudIndex(sx,sy,rgb) {
    return skyPixel(rgb) ? this.cloudSources.findIndex(source=>{
      const [x,y,w,h]=source.box;
      return sx>x && sx<x+w && sy>y && sy<y+h && source.accepts(sx,sy);
    }) : -1;
  }
  sampleEdge(sx,sy,rx,ry) {
    const pixel=(x,y)=>(clamp(Math.floor(y),0,this.sourceH-1)*this.sourceW+clamp(Math.floor(x),0,this.sourceW-1))*4;
    const p=this.platePixels, center=pixel(sx,sy), rgb=[p[center]*2,p[center+1]*2,p[center+2]*2];
    let weight=2, contrast=0;
    for (const [dx,dy] of [[-rx,-ry],[rx,-ry],[-rx,ry],[rx,ry]]) {
      const i=pixel(sx+dx,sy+dy);
      const difference=Math.max(Math.abs(p[i]-p[center]),Math.abs(p[i+1]-p[center+1]),Math.abs(p[i+2]-p[center+2]));
      contrast=Math.max(contrast,difference);
      // Average within the same surface. Don't mix the sky into a dark roof or
      // white monitor pixels into the hair merely because they share a cell.
      const w=(1-smooth((difference-24)/64));
      weight+=w;
      for (let c=0;c<3;c++) rgb[c]+=p[i+c]*w;
    }
    return {rgb:rgb.map(v=>v/weight),contrast};
  }
  surfaceContrast(sx,sy,radius) {
    const p=this.platePixels,x=Math.floor(sx),y=Math.floor(sy),center=(y*this.sourceW+x)*4;
    let contrast=0;
    for(let dy=-radius;dy<=radius;dy+=radius)for(let dx=-radius;dx<=radius;dx+=radius){
      const i=(clamp(y+dy,0,this.sourceH-1)*this.sourceW+clamp(x+dx,0,this.sourceW-1))*4;
      for(let c=0;c<3;c++)contrast=Math.max(contrast,Math.abs(p[i+c]-p[center+c]));
    }
    return contrast;
  }
  prepare(ctx) { ctx.font = `${glyphWeight} ${this.fontSize}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; }
  paint(ctx, cell, x, y, size, fill) {
    ctx.fillStyle = fill;
    if (Math.abs(size - 1) < .005) ctx.fillText(cell.glyph, x, y);
    else { ctx.save(); ctx.translate(x, y); ctx.scale(size, size); ctx.fillText(cell.glyph, 0, 0); ctx.restore(); }
  }
  stamp(cell, x, y, size, ctx=this.ctx) {
    this.spriteAtlas.draw(ctx,cell,x,y,size);
  }
  refreshFloat(sprite,time){
    const frame=Math.floor(time*4+sprite.cells[0].glyphOffset);
    if(frame===sprite.glyphFrame)return false;
    let changed=sprite.glyphFrame===undefined;sprite.glyphFrame=frame;
    for(const cell of sprite.cells){const variant=glyphVariant(cell,time);if(variant!==cell.glyphVariant)changed=true;cell.glyphVariant=variant;}
    if(!changed)return false;
    const {canvas,x,y,width,height}=sprite.texture,ctx=canvas.getContext('2d'),dpr=this.pixelRatio;
    ctx.setTransform(dpr,0,0,dpr,-x*dpr,-y*dpr);ctx.clearRect(x,y,width,height);ctx.fillStyle='#080d13';
    for(const cell of sprite.cells)ctx.fillRect(cell.sx*this.scale-this.cellW*.47*cell.size,cell.sy*this.scale-this.cellH*.44*cell.size,
      this.cellW*.94*cell.size,this.cellH*.88*cell.size);
    for(const cell of sprite.cells)this.stamp(cell,cell.sx*this.scale,cell.sy*this.scale,cell.size,ctx);
    return true;
  }
  drawClouds(time,present=true) {
    const ctx=this.cloudCtx;
    ctx.clearRect(...this.cloudBox);
    ctx.drawImage(this.cloudBase,...this.cloudBox);
    ctx.globalCompositeOperation='source-atop';
    for (const source of this.cloudSources) {
      const {width:w,height:h,texture,fade,layer}=source, field=source.ctx;
      const shift=((time*cloudSpeed)%w+w)%w;
      field.globalCompositeOperation='copy'; field.drawImage(texture,shift,0);
      field.globalCompositeOperation='source-over'; field.drawImage(texture,shift-w,0);
      field.globalCompositeOperation='destination-in'; field.drawImage(fade,0,0);
      const [x,y]=source.box;
      ctx.drawImage(layer,x*this.scale,y*this.scale,w*this.scale,h*this.scale);
    }
    ctx.globalCompositeOperation='source-over';
    if(present)this.ctx.drawImage(this.cloudLayer,...this.cloudBox);
  }
  drawScreens(time) {
    const frame = Math.floor(time * 30), ctx = this.screenCtx;
    if (frame!==this.screenFrame) {
      this.screenFrame=frame;
      ctx.clearRect(...this.screenBox);
      ctx.save(); ctx.scale(this.scale,this.scale);
      for (const screen of this.screens) {
        if (screen.frame!==frame) { screen.frame=frame; paintScreen(screen,time); }
        drawQuad(ctx,screen.canvas,screen.quad,screen.width,screen.height);
      }
      // Project the complete parallelogram, then remove only real foreground
      // pixels. A broad polygon clip retained bright background letters as a halo.
      ctx.globalCompositeOperation='destination-out';
      ctx.drawImage(this.headMask,...this.headMaskBox);
      ctx.restore();
    }
    this.ctx.drawImage(this.screenLayer,...this.screenBox);
  }
  drawLights(time,present=true) {
    const frame=Math.floor(time*30);
    for (const light of this.lights) {
      const {emitter,cells,ctx}=light;
      const offset=emitter.id==='left-face'?0:1.6;
      const key=emitter.kind==='face' ? `${Math.floor((time+offset)/3.8)%4}:${Math.round(eyeOpening(time,offset)*20)}:${Math.floor(time*8)}` : frame;
      if (key!==light.frame) {
        light.frame=key;
        ctx.clearRect(light.x,light.y,light.canvas.width/this.pixelRatio,light.canvas.height/this.pixelRatio);
        const tint=emitter.kind==='lamp'?lampColor(time):emitter.tint;
        for (const cell of cells) {
          const brightness=emitter.kind==='lamp'?.5+cell.intensity*.5:Math.sqrt(faceLight(emitter,cell.u,cell.v,time));
          const core=emitter.kind==='lamp'?clamp((cell.intensity-.68)*2)*(.5+.5*Math.sin(time*Math.PI*1.25)**2):0;
          cell.rgb=tint.map((c,i)=>[10,21,28][i]+c*brightness*(1-core)+255*core);
          cell.glyphVariant=glyphVariant(cell,time);
          cell.tile=this.palette.get(glyphAt(cell),cell.rgb);
        }
        for (const cell of cells) {
          if (cell.basis) {
            ctx.save(); ctx.transform(...cell.basis,cell.x,cell.y);
            this.palette.drawTile(ctx,cell.tile,0,0,cell.size); ctx.restore();
          } else this.palette.drawTile(ctx,cell.tile,cell.x,cell.y,cell.size);
        }
      }
      if(present)this.ctx.drawImage(light.canvas,light.x,light.y,light.canvas.width/this.pixelRatio,light.canvas.height/this.pixelRatio);
    }
  }
  drawDetails(time,details=this.details,ctx=this.ctx) {
    for (const sprite of details) {
      if (sprite.texture) {
        this.refreshFloat(sprite,time);
        const {canvas,x,y,width,height}=sprite.texture, [ax,ay]=sprite.shape.anchor;
        const p=detailPoint(sprite.shape,ax,ay,time), px=detailPoint(sprite.shape,ax+1,ay,time), py=detailPoint(sprite.shape,ax,ay+1,time);
        const a=px[0]-p[0], b=px[1]-p[1], c=py[0]-p[0], d=py[1]-p[1];
        ctx.save(); ctx.transform(a,b,c,d,(p[0]-a*ax-c*ay)*this.scale,(p[1]-b*ax-d*ay)*this.scale);
        ctx.drawImage(canvas,x,y,width,height); ctx.restore();
        continue;
      }
      const shape=sprite.shape, [ax,ay]=shape.anchor;
      const paperX=(.7*Math.sin(time*1.5+shape.phase)+.3*Math.sin(time*3.7+shape.phase)-Math.sin(shape.phase))*2.8;
      const sinY=Math.sin(time*2.9),cosY=Math.cos(time*2.9);
      const gaze=1.25*Math.sin(time*.7),opening=eyeOpening(time,shape.phase);
      const leavesX=Math.sin(time*.8)*1.8+Math.sin(time*1.8)*.5,leavesY=Math.sin(time*1.15)*.65;
      ctx.fillStyle='#080d13';
      for (const cell of sprite.cells) {
        let x=cell.sx,y=cell.sy;
        if (shape.kind==='paper') { x+=paperX*cell.free; y+=(sinY*cell.cosX+(cosY-1)*cell.sinX)*.7*cell.free; }
        else if (shape.kind==='eye') { x+=gaze; y=ay+(y-ay)*opening; }
        else { x+=leavesX*cell.free; y+=leavesY*cell.free; }
        cell.dx=x*this.scale; cell.dy=y*this.scale;
        ctx.fillRect(x*this.scale-this.cellW*.47*cell.size,y*this.scale-this.cellH*.44*cell.size,
          this.cellW*.94*cell.size,this.cellH*.88*cell.size);
      }
      for (const cell of sprite.cells) {
        cell.glyphVariant=glyphVariant(cell,time);
        this.stamp(cell,cell.dx,cell.dy,cell.size,ctx);
      }
    }
  }
  getFlightData() {
    return {fontSize:this.fontSize,cellW:this.cellW,cellH:this.cellH,scale:this.scale,pixelRatio:this.pixelRatio,
      sprites:this.sprites.map(({bird,cells})=>({bird,cells:cells.map(({sx,sy,glyph,color,size})=>({sx,sy,glyph,color,size}))}))};
  }
  draw(time) {
    const ctx = this.ctx;
    this.glyphMotion.update(time);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.base, 0, 0, this.width, this.height);
    this.drawClouds(time);
    this.drawWater(time);
    for (const cell of this.dynamic) {
      let x = cell.x, y = cell.y, size = cell.size;
      if (cell.kind === 'hem') {
        y += Math.sin(time * 1.3) * .35 * clamp((cell.sy - 617) / 17) * this.scale;
      } else {
        size = fontStep(cell.size+fontIncrement*Math.round(Math.sin(time*.75+cell.phase)));
      }
      cell.glyphVariant=glyphVariant(cell,time);
      this.stamp(cell, x, y, size);
    }
    this.drawScreens(time);
    this.drawDetails(time);
    this.drawLights(time);
    if (this.separateFlight) return;
    this.drawBirds(time);
  }
  drawWater(time,ctx=this.ctx) {
    const sinA=Math.sin(time*1.8),cosA=Math.cos(time*1.8),sinB=Math.sin(time*.9),cosB=Math.cos(time*.9);
    const rings=rippleSources.map(([, ,phase])=>{const age=(time+phase)%7.5; return {radius:age*20,strength:Math.sin(Math.PI*age/7.5)*.65};});
    for (const cell of this.water) {
      const interference=Math.max(0,.62*(cell.sinA*cosA-cell.cosA*sinA)+.38*(cell.sinB*cosB+cell.cosB*sinB));
      let shine = interference*interference*interference*interference*interference*.65;
      for (const ring of cell.rings) {
        const wave=rings[ring.index], edge=Math.abs(ring.distance-wave.radius);
        if (edge<9) shine+=(1-edge/9)**2*wave.strength;
      }
      if (shine < .035) continue;
      ctx.globalAlpha = Math.min(.85, shine);
      this.stamp(cell, cell.x, cell.y, cell.size,ctx);
    }
    ctx.globalAlpha = 1;
  }
  drawBirds(time) {
    const ctx=this.ctx;
    for (const sprite of this.sprites) {
      const pose = birdPose(sprite.bird, time);
      // Occlude only occupied feather cells. Filling the whole hit polygon can
      // expose black triangles between the bent wing and its sampled feathers.
      ctx.fillStyle = '#080d13';
      for (const cell of sprite.cells) {
        const [x, y] = birdPoint(sprite.bird, cell.sx, cell.sy, time, pose);
        const size = detailFontSize;
        ctx.fillRect(x * this.scale - this.cellW * .43 * size, y * this.scale - this.cellH * .4 * size,
          this.cellW * .86 * size, this.cellH * .8 * size);
      }
      for (const cell of sprite.cells) {
        const [x, y] = birdPoint(sprite.bird, cell.sx, cell.sy, time, pose);
        cell.glyphVariant=glyphVariant(cell,time);
        this.stamp(cell, x * this.scale, y * this.scale, detailFontSize);
      }
    }
  }
}
