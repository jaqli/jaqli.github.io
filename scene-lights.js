import { eyeOpening } from './scene-details.js?v=20261110-depth6';

const clamp = value => Math.max(0, Math.min(1, value));
const stroke = (distance, thickness = .035) => clamp(1 - Math.abs(distance) / thickness);
export function lampColor(time) {
  const palette = [[48,220,255],[156,116,255],[255,156,97],[88,246,197]];
  const phase = time / 4, i = Math.floor(phase) % palette.length, blend = (1 - Math.cos(phase % 1 * Math.PI)) / 2;
  const breath = .5 + .5 * (1 - Math.cos(time * Math.PI / 2.2)) / 2;
  return palette[i].map((v,c) => (v * (1-blend) + palette[(i+1)%palette.length][c] * blend) * breath);
}
export function faceLight(emitter, u, v, time) {
  if (emitter.kind === 'red-eye') {
    const gaze = Math.sin(time * 1.2) * .07, blink = eyeOpening(time, .8);
    return Math.max(...[.24,.76].map(x => clamp(1 - Math.max(Math.abs(u-x-gaze)/.14, Math.abs(v-.5)/(.2*blink)))));
  }
  const offset = emitter.id === 'left-face' ? 0 : 1.6;
  const expression = Math.floor((time + offset) / 3.8) % 4;
  const blink = eyeOpening(time, offset);
  let light = 0;
  for (const x of [.25,.73]) {
    const dx = u - x, dy = v - .33;
    if (Math.abs(dx) < .13 && Math.abs(dy) < .2) {
      if (expression === 0 && emitter.id === 'left-face') light = Math.max(light, stroke(dx + .08 - Math.abs(dy / Math.max(.09,blink)) * .65, .045));
      else if (expression === 1) light = Math.max(light, stroke(dy + (.11 - Math.abs(dx)) * blink, .035));
      else if (expression === 2 && x > .5) light = Math.max(light, stroke(dy, .03));
      else light = Math.max(light, clamp(1 - Math.max(Math.abs(dx)/.08,Math.abs(dy)/(.15*blink))));
    }
  }
  if (u > .25 && u < .76) {
    const smile = .77 - ((u - .5) / .3) ** 2 * .16;
    light = Math.max(light, expression === 3 ? stroke(Math.hypot((u-.5)*.75,v-.72)-.085,.04) : stroke(v-(expression===1 ? .69 : smile),.05));
  }
  return light;
}
