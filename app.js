import { site } from './site.config.js';
import './navigation.js';

const viewport = document.querySelector('#scene-viewport');
const world = document.querySelector('#scene-world');
const image = document.querySelector('#scene-image');
const canvas = document.querySelector('#ascii-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const sampleCanvas = document.createElement('canvas');
const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
const pause = document.querySelector('#pause');
const status = document.querySelector('#scene-status');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const glyphs = ' .,:;i!+*?%$#@';
const svgNS = 'http://www.w3.org/2000/svg';
let cells = [], width = 0, height = 0, cellW = 0, cellH = 0;
let frame = null, elapsed = 0, previousFrame = 0;
let paused = motion.matches, ready = false, resizeFrame = null;
const pointer = { x: -10000, y: -10000 };

function svgElement(tag, attributes) {
  const element = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}
for (const hotspot of site.hotspots) {
  const link = svgElement('a', {
    href: hotspot.href, 'aria-label': hotspot.label, tabindex: '0',
    class: `hotspot${hotspot.secret ? ' secret-hotspot' : ''}`,
    'data-hotspot': hotspot.id, 'data-transition': hotspot.secret ? 'LIFE' : hotspot.label,
  });
  link.append(svgElement('polygon', { points: hotspot.points, class: 'hit-area' }));
  if (hotspot.hint) {
    const label = svgElement('g', { class: `hotspot-label ${hotspot.reveal === 'hover' ? 'on-hover' : ''}`, 'aria-hidden': 'true', transform: `translate(${hotspot.hintAt.join(' ')})` });
    label.append(svgElement('rect', { x: '-59', y: '-17', width: '118', height: '28', rx: '3' }));
    const text = svgElement('text', { 'text-anchor': 'middle', y: '1' });
    text.textContent = hotspot.hint;
    label.append(text);
    link.append(label);
  }
  document.querySelector('#hotspots').append(link);
}

function layout() {
  const bounds = viewport.getBoundingClientRect();
  const oldCenter = width ? (viewport.scrollLeft + bounds.width / 2) / width : .42;
  const scale = Math.max(bounds.width / site.width, bounds.height / site.height);
  width = site.width * scale;
  height = site.height * scale;
  world.style.width = `${width}px`;
  world.style.height = `${height}px`;
  world.style.top = `${(bounds.height - height) / 2}px`;
  viewport.scrollLeft = Math.max(0, Math.min(width - bounds.width, oldCenter * width - bounds.width / 2));
  const pannable = width > bounds.width + 5;
  document.querySelector('#pan-hint').hidden = !pannable;
  viewport.classList.toggle('is-pannable', pannable);
  if (!ctx || !sampleCtx || !ready) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const columns = Math.min(280, Math.max(150, Math.round(width / 5.3)));
  const rows = Math.round(columns * site.height / site.width * .6);
  cellW = width / columns;
  cellH = height / rows;
  sampleCanvas.width = columns;
  sampleCanvas.height = rows;
  sampleCtx.drawImage(image, 0, 0, columns, rows);
  const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;
  cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const i = (row * columns + col) * 4;
      const [r, g, b] = pixels.slice(i, i + 3);
      const light = (.2126 * r + .7152 * g + .0722 * b) / 255;
      cells.push({ x: (col + .5) * cellW, y: (row + .5) * cellH,
        glyph: Math.max(1, Math.round(Math.sqrt(light) * (glyphs.length - 1))),
        phase: col * .23 + row * .19, water: row / rows > .57,
        color: `rgb(${[r, g, b].map(v => Math.round(255 * (v / 255) ** .78)).join(' ')})`,
      });
    }
  }
  draw();
}
function draw() {
  if (!ctx) return;
  ctx.fillStyle = '#080d13';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `bold ${Math.max(4, cellH * .97)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const cell of cells) {
    const wave = Math.sin(elapsed * 1.4 + cell.phase);
    const distance = Math.hypot(cell.x - pointer.x, cell.y - pointer.y);
    const influence = paused ? 0 : Math.max(0, 1 - distance / 120);
    const shift = Math.round(Math.sin(elapsed * 1.1 + cell.phase) * .9);
    const character = glyphs[Math.max(1, Math.min(glyphs.length - 1, cell.glyph + shift))];
    const ripple = influence * Math.sin(elapsed * 5 - distance * .04) * 4;
    ctx.fillStyle = cell.color;
    ctx.fillText(character, cell.x + (cell.water ? wave * cellW * .15 : 0), cell.y + wave * cellH * .13 + ripple);
  }
}
function tick(now) {
  frame = null;
  if (!ready || paused || document.hidden) return;
  if (!previousFrame) previousFrame = now;
  const delta = now - previousFrame;
  if (delta >= 1000 / 24) {
    elapsed += Math.min(delta, 100) / 1000;
    previousFrame = now;
    draw();
  }
  frame = requestAnimationFrame(tick);
}
function syncMotion() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  previousFrame = 0;
  pause.textContent = paused ? '▷' : 'Ⅱ';
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? '播放场景动效' : '暂停场景动效');
  pause.title = paused ? '播放动效' : '暂停动效';
  if (ready && !paused && !document.hidden) frame = requestAnimationFrame(tick);
}
pause.addEventListener('click', () => { paused = !paused; syncMotion(); });
motion.addEventListener('change', event => { paused = event.matches; syncMotion(); });
document.addEventListener('visibilitychange', syncMotion);
viewport.addEventListener('pointermove', event => {
  const bounds = world.getBoundingClientRect();
  pointer.x = event.clientX - bounds.left;
  pointer.y = event.clientY - bounds.top;
});
viewport.addEventListener('pointerleave', () => { pointer.x = pointer.y = -10000; });
new ResizeObserver(() => {
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { layout(); resizeFrame = null; });
}).observe(viewport);
layout();
syncMotion();
try {
  await image.decode();
  if (!ctx || !sampleCtx) throw new Error('Canvas unavailable');
  ready = true;
  layout();
  document.body.classList.add('scene-ready');
  status.hidden = true;
  syncMotion();
} catch {
  status.textContent = '动态场景暂时无法载入，仍可点击画面入口。';
  document.body.classList.add('scene-fallback');
  pause.hidden = true;
}
