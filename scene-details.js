// Coordinates and attachment points measured against the original 1536 × 1024 art.
export const detailShapes = [
  { id: 'duck', kind: 'float', anchor: [352,850],
    polygon: [[294,834],[305,829],[306,807],[314,790],[326,785],[343,787],[352,797],[353,814],[377,809],[392,814],[401,823],[404,835],[417,839],[419,853],[402,863],[370,873],[333,871],[308,861],[288,855],[290,842]] },
  { id: 'paper-yellow', kind: 'paper', anchor: [412,253], length: 44, phase: 0,
    polygon: [[398,250],[434,256],[434,296],[394,292]] },
  { id: 'paper-cream', kind: 'paper', anchor: [513,232], length: 49, phase: 1.4,
    polygon: [[505,228],[540,237],[535,281],[499,274]] },
  { id: 'paper-loose', kind: 'paper', anchor: [530,308], length: 36, phase: 2.7,
    polygon: [[513,303],[540,307],[556,316],[550,337],[526,344],[496,330]] },
  { id: 'eye-left', kind: 'eye', anchor: [149,440], phase: 0, background: [159,451],
    polygon: [[141,429],[157,429],[157,450],[141,450]] },
  { id: 'eye-right', kind: 'eye', anchor: [172,438], phase: .055, background: [159,451],
    polygon: [[164,427],[180,427],[180,448],[164,448]] },
  { id: 'leaves', kind: 'leaves', anchor: [1325,137],
    polygon: [[1248,91],[1277,68],[1321,79],[1364,67],[1395,105],[1381,137],[1344,152],[1293,147],[1260,125]] },
];

const clamp = (v, low = 0, high = 1) => Math.max(low, Math.min(high, v));
export function eyeOpening(time, phase = 0) {
  const cycle = (time + phase) % 6.6;
  return 1 - .94 * Math.exp(-(((cycle - 2.1) / .11) ** 2));
}
export function detailPoint(shape, x, y, time) {
  const [ax, ay] = shape.anchor;
  if (shape.kind === 'float') {
    const roll = .026 * Math.sin(time * 1.25), c = Math.cos(roll), s = Math.sin(roll);
    return [ax + (x - ax) * c - (y - ay) * s + 1.3 * Math.sin(time * .43),
      ay + (x - ax) * s + (y - ay) * c + 3.2 * Math.sin(time * 1.45) + .8 * Math.sin(time * .65)];
  }
  if (shape.kind === 'paper') {
    const free = clamp((y - ay) / shape.length) ** 2;
    const breeze = .7 * Math.sin(time * .85 + shape.phase) + .3 * Math.sin(time * 2.15 + shape.phase);
    const rest = Math.sin(shape.phase);
    return [x + (breeze - rest) * 2.8 * free,
      y + (Math.sin(time * 1.7 + x * .07) - Math.sin(x * .07)) * .7 * free];
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
