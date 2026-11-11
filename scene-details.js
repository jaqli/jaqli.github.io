import { floatingShapes } from './scene-floats.js?v=20261111-detail39';
// Coordinates and attachment points measured against the original 1536 × 1024 art.
export const detailShapes = [
  { id: 'duck', kind: 'float', anchor: [352,850], waterRepair:true,
    polygon: [[294,834],[305,829],[306,807],[314,790],[326,785],[343,787],[352,797],[353,814],[377,809],[392,814],[401,823],[404,835],[417,839],[419,853],[402,863],[370,873],[333,871],[308,861],[288,855],[290,842]] },
  ...floatingShapes,
  { id: 'paper-yellow', kind: 'paper', anchor: [412,253], length: 44, phase: 0,
    polygon: [[398,250],[434,256],[434,296],[394,292]] },
  { id: 'paper-cream', kind: 'paper', anchor: [513,232], length: 49, phase: 1.4,
    polygon: [[505,228],[529,234],[528,251],[530,253],[540,257],[540,273],[536,274],[532,280],[530,282],[526,279],[502,273],[499,272],[502,247],[503,235]] },
  { id: 'paper-loose', kind: 'paper', anchor: [530,308], length: 36, phase: 2.7,
    polygon: [[513,303],[540,307],[556,316],[550,337],[526,344],[496,330]] },
  { id: 'paper-wall-blue', kind: 'paper', anchor: [132,154], length: 70, phase: .8,
    polygon: [[113,150],[148,156],[154,217],[116,225]] },
  { id: 'paper-wall-white', kind: 'paper', anchor: [95,188], length: 43, phase: 3.6,
    polygon: [[81,185],[112,192],[112,230],[82,221]] },
  { id: 'paper-board-top', kind: 'paper', anchor: [397,174], length: 36, phase: 2,
    polygon: [[383,170],[415,177],[416,211],[386,208]] },
  { id: 'paper-board-white', kind: 'paper', anchor: [433,199], length: 41, phase: 4.2,
    polygon: [[421,196],[447,202],[455,242],[415,235]] },
  { id: 'paper-board-bottom', kind: 'paper', anchor: [374,299], length: 37, phase: 5.3,
    polygon: [[358,296],[386,299],[391,333],[361,331]] },
  { id: 'paper-monitor', kind: 'paper', anchor: [476,468], length: 48, phase: 1.9,
    polygon: [[457,466],[491,471],[495,488],[503,508],[494,511],[492,521],[457,526]] },
  { id: 'eye-left', kind: 'eye', anchor: [149,440], phase: 0, background: [159,451],
    polygon: [[141,429],[157,429],[157,450],[141,450]] },
  { id: 'eye-right', kind: 'eye', anchor: [172,438], phase: .055, background: [159,451],
    polygon: [[164,427],[180,427],[180,448],[164,448]] },
  { id: 'leaves', kind: 'leaves', anchor: [1325,137],
    polygon: [[1248,91],[1277,68],[1321,79],[1364,67],[1395,105],[1381,137],[1344,152],[1293,147],[1260,125]] },
];

const clamp = (v, low = 0, high = 1) => Math.max(low, Math.min(high, v));
export function eyeOpening(time, phase = 0) {
  const cycle = (time + phase) % 3.2;
  return 1 - .94 * Math.exp(-(((cycle - 2.1) / .11) ** 2));
}
export function detailPoint(shape, x, y, time) {
  const [ax, ay] = shape.anchor;
  if (shape.kind === 'float') {
    if (shape.period) {
      const phase=shape.phase, angle=time*Math.PI*2/shape.period;
      const roll=shape.roll*(Math.sin(angle*.83+phase)-Math.sin(phase)), c=Math.cos(roll), s=Math.sin(roll);
      return [ax+(x-ax)*c-(y-ay)*s+shape.drift*(Math.sin(angle*.61+phase)-Math.sin(phase)),
        ay+(x-ax)*s+(y-ay)*c+shape.amplitude*(Math.sin(angle+phase)-Math.sin(phase))];
    }
    const roll = .026 * Math.sin(time * 1.25), c = Math.cos(roll), s = Math.sin(roll);
    return [ax + (x - ax) * c - (y - ay) * s + 1.3 * Math.sin(time * .43),
      ay + (x - ax) * s + (y - ay) * c + 3.2 * Math.sin(time * 1.45) + .8 * Math.sin(time * .65)];
  }
  if (shape.kind === 'paper') {
    const free = clamp((y - ay) / shape.length) ** 2;
    const breeze = .7 * Math.sin(time * 1.5 + shape.phase) + .3 * Math.sin(time * 3.7 + shape.phase);
    const rest = Math.sin(shape.phase);
    return [x + (breeze - rest) * 2.8 * free,
      y + (Math.sin(time * 2.9 + x * .07) - Math.sin(x * .07)) * .7 * free];
  }
  if (shape.kind === 'eye') {
    return [x + 1.25 * Math.sin(time * .7), ay + (y - ay) * eyeOpening(time, shape.phase)];
  }
  const free = clamp((ay - y) / 63);
  return [x + (Math.sin(time * .8) * 1.8 + Math.sin(time * 1.8) * .5) * free,
    y + Math.sin(time * 1.15) * .65 * free];
}

// The foreground frames, wires, lamp, skyline and sun are not advected.
export const cloudWindows = [
  { box: [532,78,262,300], accepts: (x,y) => !(x < 600 && y > 168) },
  { box: [864,80,494,333], accepts: (x,y) => !(x > 1140 && y > 345) && !(x > 1282 && x < 1375 && y > 118 && y < 191) },
  { box: [1392,80,144,132], accepts: () => true },
];

export const cloudSpeed = 45;

// Emitters are confined to their original light/face panels; their housings stay still.
export const emitters = [
  { id: 'cloud-lamp', kind: 'lamp', box: [155,56,48,43], tint: [55,218,255],
    polygon: [[160,56],[184,60],[191,70],[203,74],[201,94],[183,98],[164,90],[155,79]] },
  { id: 'red-robot', kind: 'red-eye', box: [275,213,32,21], tint: [255,83,62],
    polygon: [[275,213],[307,213],[307,234],[275,234]] },
  { id: 'left-face', kind: 'face', box: [309,651,47,42], tint: [30,222,239],
    plane: { width:44, height:32 },
    polygon: [[309,661],[353,651],[356,682],[310,693]] },
  { id: 'right-face', kind: 'face', box: [1464,391,52,35], tint: [30,244,157],
    polygon: [[1464,391],[1516,391],[1516,426],[1464,426]] },
];
