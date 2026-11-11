import { scenePixelRatio, sceneFrameInterval } from './render-budget.js?v=20261111-flow28';
import { site } from './site.config.js?v=20261110-flight11';
import { FlightLayer } from './flight-layer.js?v=20261111-flow28';
import { detailShapes, detailPoint } from './scene-details.js?v=20261111-flow28';
import { createSceneRenderer, prepareSceneRenderer } from './scene-renderer.js?v=20261111-flow28';
import { loadSceneImage } from './scene-loader.js?v=20261110-depth6';
import './navigation.js?v=20261111-profile30';

const viewport = document.querySelector('#scene-viewport');
const world = document.querySelector('#scene-world');
const image = document.querySelector('#scene-image');
const poster = document.querySelector('#scene-poster');
const canvas = document.querySelector('#ascii-canvas');
const preparedRenderer=prepareSceneRenderer(canvas);
const flightLayer = new FlightLayer(document.querySelector('#flight-layer'));
const duck = detailShapes.find(shape=>shape.id==='duck');

const pause = document.querySelector('#pause');
const status = document.querySelector('#scene-status');
const progress = document.querySelector('#scene-progress');
const progressText = document.querySelector('#scene-progress-text');
const progressNumber = document.querySelector('#scene-progress-number');
let progressValue = 0;
function reportProgress(value, label) {
  progressText.textContent = label;
  if (value === null) { progress.removeAttribute('value'); progressNumber.textContent = ''; return; }
  progressValue = Math.max(progressValue, Math.min(100, Math.round(value)));
  progress.value = progressValue;
  progressNumber.textContent = `${progressValue}%`;
}
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';
let width = 0, height = 0, renderer, previousViewportWidth = 0, wasPannable = false;
let frame = null, elapsed = 0, previousFrame = 0, nextVisualAt = 0;
let drawTask=null, resizeTask=null, drawTimer=null;
let paused = motion.matches, ready = false, resizeFrame = null, transitioning = false;


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
  // Camera transforms during navigation must not change the scene's layout size.
  const bounds = { width: viewport.clientWidth, height: viewport.clientHeight };
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
  if (!ready) return;
  if (renderer.width === width && renderer.height === height && renderer.pixelRatio === scenePixelRatio(width,height)) return;
  if (!resizeTask) resizeTask=(async()=>{
    renderer.cancelFrame?.();
    await drawTask;
    do { await renderer.resizeAsync(width,height); }
    while (renderer.width!==width || renderer.height!==height || renderer.pixelRatio!==scenePixelRatio(width,height));
    flightLayer.configure(renderer.getFlightData()); flightLayer.draw(elapsed); renderer.animate?.(elapsed);
    await draw();
  })().finally(()=>{resizeTask=null;});
}
function updateLife(time) {
  const points = duck.polygon.map(([x,y])=>detailPoint(duck,x,y,time).join(',')).join(' ');
  document.querySelector('[data-hotspot="life"] polygon').setAttribute('points', points);
}
function draw() {
  if (drawTask) return drawTask;
  const time=elapsed, requestedAt=performance.now();
  const result=renderer.draw(time);
  if (!result?.then) { updateLife(time); return; }
  drawTask=result.then(painted=>{if(painted!==false && !renderer.animate) updateLife(time);}).catch(error=>{
    if (!ready) throw error;
    paused=true; syncMotion();
    status.hidden=false; status.textContent='动效已暂停，刷新页面可重试。';
  }).finally(()=>{
    drawTask=null;
    if (ready && !paused && !transitioning && !document.hidden && !resizeTask) {
      drawTimer=setTimeout(()=>{
        drawTimer=null;
        if(paused || transitioning || document.hidden || resizeTask)return;
        const now=performance.now();elapsed+=previousFrame?(now-previousFrame)/1000:0;previousFrame=now;
        draw();
      },Math.max(0,sceneFrameInterval-(performance.now()-requestedAt)));
    }
  });
  return drawTask;
}
function tick(now) {
  frame = null;
  if (!ready || paused || transitioning || document.hidden) return;
  const current=Math.max(now,previousFrame);
  const delta = previousFrame ? current - previousFrame : 0;
  previousFrame = current;
  // Keep real-time speed on slower devices. Visibility/pause resets the clock,
  // so background tabs do not accumulate a large jump on return.
  elapsed += delta / 1000;
  if (!resizeTask && now>=nextVisualAt-.5) {
    if(nextVisualAt<now-sceneFrameInterval)nextVisualAt=now;
    nextVisualAt+=sceneFrameInterval;
    flightLayer.draw(elapsed);renderer.animate?.(elapsed);updateLife(elapsed);
  }
  // One frame in flight: never queue expensive work behind input or display
  // stale worker frames. The clock still advances when a device misses a frame.
  if (!drawTask && !resizeTask && drawTimer===null) draw();
  frame = requestAnimationFrame(tick);
}
function syncMotion() {
  if(drawTimer!==null){clearTimeout(drawTimer);drawTimer=null;}
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  previousFrame = 0; nextVisualAt = 0;
  if (paused || transitioning || document.hidden) renderer?.cancelFrame?.();
  pause.textContent = paused ? '▷ 播放动效' : 'Ⅱ';
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? '播放场景动效' : '暂停场景动效');
  pause.title = paused ? (motion.matches ? '系统已启用减少动态效果，点击播放场景动效' : '播放动效') : '暂停动效';
  if (ready && !paused && !transitioning && !document.hidden) frame = requestAnimationFrame(tick);
}
pause.addEventListener('click', () => { paused = !paused; syncMotion(); });
motion.addEventListener('change', event => { paused = event.matches; syncMotion(); });
document.addEventListener('visibilitychange', syncMotion);
document.addEventListener('site:transition', event => { transitioning = event.detail.active; syncMotion(); });
new ResizeObserver(() => {
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { layout(); resizeFrame = null; });
}).observe(viewport);
layout();
syncMotion();
poster.decode().then(() => performance.mark('scene-preview-ready')).catch(() => {});
try {
  await loadSceneImage(image, site.image, value => reportProgress(value === null ? null : value * 35, '加载场景'));
  performance.mark('scene-source-ready');
  renderer = await createSceneRenderer(image, canvas, value => reportProgress(35 + value * 20, '准备动效'),preparedRenderer);
  do { await renderer.resizeAsync(width, height, value => reportProgress(55 + value * 44, '绘制字符')); }
  while (renderer.width !== width || renderer.height !== height || renderer.pixelRatio !== scenePixelRatio(width,height));
  flightLayer.configure(renderer.getFlightData()); flightLayer.draw(elapsed); renderer.animate?.(elapsed);
  await draw();
  ready = true;
  document.body.classList.add('scene-ready');
  performance.mark('scene-ready');
  reportProgress(100, '就绪');
  setTimeout(() => { status.hidden = true; }, 200);
  syncMotion();
} catch {
  preparedRenderer?.dispose();
  status.textContent = '动态场景暂时无法载入，仍可点击画面入口。';
  document.body.classList.add('scene-fallback');
  pause.hidden = true;
}
