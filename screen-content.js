import { createCanvas } from './canvas-factory.js?v=20261110-fps10';
// Screen content shares the scene's reference font and requested size range.
// Render once into their source-space textures; don't resample the text a second time.
export const screens = [
  { kind: 'code', quad: [[434,359],[602,377],[608,479],[437,479]], width: 173, height: 120 },
  // Extend the upper display through another one to two pale character rows.
  { kind: 'wave', quad: [[333,395],[439,401],[442,481],[335,482]], width: 108, height: 86 },
  // A complete parallelogram continues down/right behind the head. Occlusion
  // belongs to the foreground hair, not to the display's four-corner geometry.
  { kind: 'plot', quad: [[633,431],[733,438],[737,507],[637,500]], width: 100, height: 69, brightness: .85, ambientGain: .4 },
];
const lines = [
  'import { field } from "./sim";', 'const state = new Map();', '',
  'function step(dt) {', '  for (const p of field) {',
  '    const v = sample(p, dt);', '    state.set(p.id, v);', '  }',
  '  return state;', '}', '', 'const frame = step(clock.dt);',
  'render(frame);', 'await nextFrame();', '', 'export { step, state };',
];
// Cache repeated code lines, grid rows and waveform symbols. Bound dynamic
// labels so a long-running page cannot grow the cache without limit.
const textCache=new Map();
let textCacheBytes=0;
const maxTextCacheBytes=2*1024*1024;
function text(ctx, value, x, y, color = '#84d6cd') {
  if (!value) return;
  const key=`${ctx.font}:${color}:${value}`;
  let tile=textCache.get(key);
  if (!tile) {
    const canvas=createCanvas(), ratio=3, size=parseFloat(ctx.font.split(' ')[1]);
    canvas.width=Math.ceil((ctx.measureText(value).width+2)*ratio);
    canvas.height=Math.ceil(size*1.6*ratio);
    const paint=canvas.getContext('2d'); paint.scale(ratio,ratio);
    paint.font=ctx.font; paint.textBaseline='top'; paint.fillStyle=color; paint.fillText(value,0,0);
    tile={canvas,width:canvas.width/ratio,height:canvas.height/ratio};
    tile.bytes=canvas.width*canvas.height*4;
    while(textCache.size && (textCache.size>=384 || textCacheBytes+tile.bytes>maxTextCacheBytes)){
      const oldest=textCache.keys().next().value;textCacheBytes-=textCache.get(oldest).bytes;textCache.delete(oldest);
    }
    textCacheBytes+=tile.bytes;
    textCache.set(key,tile);
  }
  ctx.drawImage(tile.canvas,x,y,tile.width,tile.height);
}
function wave(ctx, time, x, y, width, amplitude, phase = 0, color = '#56dfd5') {
  for (let i = 0; i < width; i += 1.65) {
    const v = Math.sin(i * .12 - time * 1.8 + phase) + .32 * Math.sin(i * .3 + time * 2.1);
    text(ctx, i % 5 < 2 ? (Math.floor(time*2+i*.37)%2?'=':'+') : (Math.floor(time*2+i*.37)%2?';':':'), x + i, y + v * amplitude, color);
  }
}
export function paintScreen(screen, time) {
  const { ctx, width: w, height: h, kind } = screen;
  ctx.font = `${screen.fontWeight||500} ${screen.fontSize}px monospace`; ctx.textBaseline = 'top';
  // The dim changing character bed is cached separately. Its long rows must
  // not evict live code and waveforms from the small text cache every frame.
  const bedFrame=`${screen.fontSize}:${Math.floor(time*2)}`;
  if(screen.bedFrame!==bedFrame){
    screen.bedFrame=bedFrame;
    const canvas=screen.bed ||= createCanvas();
    if(canvas.width!==w*3||canvas.height!==h*3){canvas.width=w*3;canvas.height=h*3;}
    const paint=canvas.getContext('2d');paint.setTransform(3,0,0,3,0,0);
    paint.fillStyle='#0a1923';paint.fillRect(0,0,w,h);
    paint.font=ctx.font;paint.textBaseline='top';paint.fillStyle='#1e3440';
    const moment=Math.floor(time*2)/2;
    for(let y=1;y<h;y+=4.8){
      let row='';for(let x=0;x<Math.ceil(w/8);x++)row+=Math.floor(moment*(1.2+.3*((x*.37+y*.19)%1))+(x*.37+y*.19)%1)%2?', ; ':'. : ';
      paint.fillText(row,1,y);
    }
  }
  ctx.clearRect(0,0,w,h);ctx.drawImage(screen.bed,0,0,w,h);
  if (kind === 'code') {
    text(ctx, `main.ts  /  frame ${String(Math.floor(time * 30)).padStart(5, '0')}`, 3, 2, '#a9d6de');
    const top = Math.floor(time / .8), typed = Math.floor(time % .8 * 60);
    for (let row = 0; row < 14; row++) {
      const line = lines[(top + row) % lines.length];
      text(ctx, String(top + row + 1).padStart(2, '0'), 3, 11 + row * 6.4, '#4f7e92');
      text(ctx, row === 13 ? line.slice(0, typed) : line, 13, 11 + row * 6.4,
        ['#7eebad','#b3d6eb','#f0c77b','#8ed6e1'][row % 4]);
    }
    if (time % 1 < .55) text(ctx, '_', 13 + Math.min(typed, lines[(top + 13) % lines.length].length) * 3, 94.2, '#ddffe8');
    for (let y = 10; y < h - 12; y += 4) text(ctx, Math.floor(time*1.5+y*.17)%2?':':'|', 122, y, '#42616f');
    text(ctx, 'CPU / MEM', 128, 11, '#9edce5');
    for (let i = 0; i < 5; i++) {
      const value = Math.round(3 + 2 * Math.sin(time * 1.2 + i));
      text(ctx, `${i} ${'|'.repeat(value)}${'.'.repeat(6 - value)}`, 128, 19 + i * 6.5, i % 2 ? '#e8c17a' : '#74c9e3');
    }
    wave(ctx, time, 128, 64, 37, 5);
    text(ctx, `dt ${(16 + Math.sin(time) * 2).toFixed(1)}`, 128, 79, '#c4e4d2');
    text(ctx, `${Math.floor(256 + time * 24)} KB/s`, 128, 93, '#b7dcd2');
    text(ctx, `> ${['compile','running','syncing','ready'][Math.floor(time / .8) % 4]}  ${Math.floor(time * 61)} ops`, 4, h-10, '#e2bc77');
    text(ctx, `${'='.repeat(1 + Math.floor(time * 3) % 10)}>`, 126, h-10, '#80d4c6');
  } else if (kind === 'wave') {
    text(ctx, `SCOPE  ${time.toFixed(1)}s  CH1+CH2`, 3, 2, '#b5ddeb');
    for (let i = 0; i < 3; i++) text(ctx, `> ${['sample(field)', 'integrate(dt)', 'stream(buffer)'][(i + Math.floor(time / .8)) % 3]}`, 3, 9 + i * 5, '#86cda9');
    for (let y = 29; y < h-15; y += 10) text(ctx, (Math.floor(time*1.5+y*.13)%2?'~ , ':'- . ').repeat(10), 4, y, '#325568');
    wave(ctx, time, 4, h*.57, 96, h*.14, 0, '#50e4d4');
    wave(ctx, time * .7, 4, h*.6, 96, h*.085, 2.3, '#7badea');
    text(ctx, `f ${(42 + Math.sin(time) * 5).toFixed(1)}Hz   ${Math.floor(time * 30)} samples`, 3, h-7, '#a3d2b7');
  } else {
    text(ctx, `FIELD / ${Math.floor(time * 12)}`, 2, 1, '#bededa');
    wave(ctx, time, 3, 20, w-8, 8, .8, '#8cd9e8');
    for (let col = 0; col < 14; col++) {
      const level = 1 + Math.floor((1 + Math.sin(time * 1.4 + col * .6)) * 2.5);
      for (let y = 0; y < level; y++) text(ctx, Math.floor(time*1.5+col*.37+y*.17)%2?'+':'=', 3 + col * 6, h-9 - y * 2.8, '#90c8b1');
    }
    text(ctx, 'FFT  /  live', 2, h-5, '#edca86');
  }
  // Dim the texture without weakening its occlusion or losing waveform detail.
  if(screen.brightness<1){
    ctx.globalCompositeOperation='source-atop';ctx.fillStyle=`rgb(0 0 0 / ${1-screen.brightness})`;
    ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
  }
  // Alpha ramps at all four edges retain the original edge pixels/reflections.
  ctx.globalCompositeOperation = 'destination-in';
  for (const horizontal of [true, false]) {
    const end = horizontal ? w : h, feather = Math.min(3 / end, .12);
    const fade = ctx.createLinearGradient(0, 0, horizontal ? w : 0, horizontal ? 0 : h);
    fade.addColorStop(0, '#0000'); fade.addColorStop(feather, '#000');
    fade.addColorStop(1 - feather, '#000'); fade.addColorStop(1, '#0000');
    ctx.fillStyle = fade; ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
}
