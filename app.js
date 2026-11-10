import { site } from './site.config.js';
import { AsciiRenderer, birds, birdPoint } from './ascii-renderer.js?v=20261110-scene4';
import './navigation.js';

const viewport = document.querySelector('#scene-viewport');
const world = document.querySelector('#scene-world');
const image = document.querySelector('#scene-image');
const canvas = document.querySelector('#ascii-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const pause = document.querySelector('#pause');
const status = document.querySelector('#scene-status');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';
let width = 0, height = 0, renderer, previousViewportWidth = 0, wasPannable = false;
let frame = null, elapsed = 0, previousFrame = 0, accumulated = 0;
let paused = motion.matches, ready = false, resizeFrame = null;


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
  let oldCenter = width ? (viewport.scrollLeft + previousViewportWidth / 2) / width : .42;
  const scale = Math.max(bounds.width / site.width, bounds.height / site.height);
  width = site.width * scale;
  height = site.height * scale;
  world.style.width = `${width}px`;
  world.style.height = `${height}px`;
  world.style.top = `${(bounds.height - height) / 2}px`;
  const pannable = width > bounds.width + 5;
  if (pannable && !wasPannable) oldCenter = .42;
  viewport.scrollLeft = Math.max(0, Math.min(width - bounds.width, oldCenter * width - bounds.width / 2));
  previousViewportWidth = bounds.width;
  wasPannable = pannable;
  document.querySelector('#pan-hint').hidden = !pannable;
  viewport.classList.toggle('is-pannable', pannable);
  if (!ctx || !ready) return;
  renderer.resize(width, height);
  draw();
}
function draw() {
  renderer.draw(elapsed);
  const gull = birds.find(bird => bird.id === 'life');
  const points = gull.points.map(([x, y]) => birdPoint(gull, x, y, elapsed).join(',')).join(' ');
  document.querySelector('[data-hotspot="life"] polygon').setAttribute('points', points);
}
function tick(now) {
  frame = null;
  if (!ready || paused || document.hidden) return;
  const delta = previousFrame ? now - previousFrame : 0;
  previousFrame = now;
  // Keep real-time speed on slower devices. Visibility/pause resets the clock,
  // so background tabs do not accumulate a large jump on return.
  elapsed += delta / 1000;
  accumulated += delta;
  if (accumulated >= 1000 / 30) {
    accumulated %= 1000 / 30;
    draw();
  }
  frame = requestAnimationFrame(tick);
}
function syncMotion() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  previousFrame = 0;
  accumulated = 0;
  pause.textContent = paused ? '▷ 播放动效' : 'Ⅱ';
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? '播放场景动效' : '暂停场景动效');
  pause.title = paused ? (motion.matches ? '系统已启用减少动态效果，点击播放场景动效' : '播放动效') : '暂停动效';
  if (ready && !paused && !document.hidden) frame = requestAnimationFrame(tick);
}
pause.addEventListener('click', () => { paused = !paused; syncMotion(); });
motion.addEventListener('change', event => { paused = event.matches; syncMotion(); });
document.addEventListener('visibilitychange', syncMotion);
new ResizeObserver(() => {
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { layout(); resizeFrame = null; });
}).observe(viewport);
layout();
syncMotion();
try {
  await image.decode();
  if (!ctx) throw new Error('Canvas unavailable');
  renderer = new AsciiRenderer(image, canvas);
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
