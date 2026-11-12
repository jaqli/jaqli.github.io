import { site } from './site.config.js?v=20261111-edge48';
import { detailShapes, detailPoint } from './scene-details.js?v=20261111-edge48';
import { localSceneTime, nextSceneTime, sceneLabels } from './scene-time.js?v=20261112-book56';
import { PixelScene } from './pixel-scene.js?v=20261112-book56';
import { loadSceneImage } from './scene-loader.js?v=20261110-depth6';
import { sceneIntro } from './scene-intro.js?v=20261111-edge48';
import './navigation.js?v=20261111-detail39';

const viewport = document.querySelector('#scene-viewport');
const world = document.querySelector('#scene-world');
const image = document.querySelector('#scene-image');
const poster = document.querySelector('#scene-poster');
const canvas = document.querySelector('#ascii-canvas');
const sceneFrameInterval=1000/60;
const timeControl=document.querySelector('#time-lamp');
const edgeTimeControl=document.querySelector('#time-lamp-edge'),timeControls=[timeControl,edgeTimeControl];
let sceneTime=localSceneTime(),changingTime=false,timeChange=null,timeFade=null;
let nextTimeAt=60,pageActive=true,restoringTime=false;
document.body.dataset.sceneTime=sceneTime;
function syncTimeControl(){
  const label=`${sceneLabels[sceneTime]} · 点击吊灯切换为${sceneLabels[nextSceneTime(sceneTime)]}`;
  for(const control of timeControls){control.dataset.time=sceneTime;control.setAttribute('aria-label',label);control.title=label;}
  timeControl.querySelector('span').textContent=`${sceneLabels[sceneTime]} · 点击切换`;
}
syncTimeControl();
function syncLampVisibility(){
  if(!ready)return;
  const r=timeControl.getBoundingClientRect();
  const visibleWidth=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0));
  const visibleHeight=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
  edgeTimeControl.hidden=visibleWidth>=32&&visibleHeight>=24;
  timeControl.tabIndex=edgeTimeControl.hidden?0:-1;
}
function captureTimeFade(){
  // Both lighting states use the exact same pose and common pixel grid. Only
  // compositor opacity changes; no second scene, pixel readback or blurry zoom.
  const layer=document.createElement('canvas');layer.className='scene-time-fade';layer.setAttribute('aria-hidden','true');
  layer.width=canvas.width;layer.height=canvas.height;
  layer.getContext('2d',{alpha:false}).drawImage(canvas,0,0);canvas.after(layer);
  let animation,finished=false;
  return {
    async play(){
      if(finished)return;
      animation=layer.animate([{opacity:1},{opacity:0}],{duration:1600,easing:'ease-in-out',fill:'both'});
      await animation.finished.catch(()=>{});
    },
    finish(){finished=true;animation?.finish();},
    dispose(){animation?.cancel();layer.remove();layer.width=layer.height=1;},
  };
}
function changeTime(mode,{animate=true}={}){
  if(!ready||changingTime||mode===sceneTime)return Promise.resolve();
  changingTime=true;syncMotion();for(const control of timeControls){control.setAttribute('aria-busy','true');control.disabled=true;}
  let fade;
  timeChange=(async()=>{
    try{
      draw();fade=animate&&!motion.matches?captureTimeFade():null;timeFade=fade;
      await renderer.setTimeOfDay(mode);sceneTime=mode;document.body.dataset.sceneTime=mode;syncTimeControl();draw();
      if(fade)await fade.play();
      document.querySelector('#time-status').textContent=`已切换为${sceneLabels[mode]}场景`;
    }finally{
      fade?.dispose();timeFade=null;changingTime=false;nextTimeAt=elapsed+60;
      for(const control of timeControls){control.removeAttribute('aria-busy');control.disabled=false;}syncMotion();
    }
  })();
  return timeChange;
}
function advanceTime(){
  if(restoringTime)return;
  changeTime(nextSceneTime(sceneTime)).catch(()=>{document.querySelector('#time-status').textContent='时段切换未完成，请再点一下吊灯。';});
}
for(const control of timeControls)control.addEventListener('click',advanceTime);
viewport.addEventListener('scroll',syncLampVisibility,{passive:true});
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
  sceneIntro.progress(progressValue);
}
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';
let width = 0, height = 0, renderer, previousViewportWidth = 0, wasPannable = false;
let frame = null, elapsed = 0, previousFrame = 0, nextVisualAt = 0;
let resizeTask=null;
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
  world.style.top = `${Math.min(0, (bounds.height - height) / 3)}px`;
  sceneIntro.resize(width,height);
  const pannable = width > bounds.width + 5;
  if (pannable && !wasPannable) oldCenter = .42;
  viewport.scrollLeft = Math.max(0, Math.min(width - bounds.width, oldCenter * width - bounds.width / 2));
  previousViewportWidth = bounds.width;
  wasPannable = pannable;
  document.querySelector('#pan-hint').hidden = !pannable;
  viewport.classList.toggle('is-pannable', pannable);
  syncLampVisibility();
  if (!ready) return;
  if (renderer.width === width && renderer.height === height) return;
  if (!resizeTask) resizeTask=(async()=>{
    do { await renderer.resizeAsync(width,height); }
    while (renderer.width!==width || renderer.height!==height);
    await draw();
  })().finally(()=>{resizeTask=null;});
}
function updateLife(time) {
  const points = duck.polygon.map(([x,y])=>detailPoint(duck,x,y,time).join(',')).join(' ');
  document.querySelector('[data-hotspot="life"] polygon').setAttribute('points', points);
}
function draw() {
  renderer.draw(elapsed);updateLife(elapsed);
}
function tick(now) {
  frame = null;
  if (!ready || paused || transitioning || changingTime || restoringTime || !pageActive || document.hidden) return;
  const current=Math.max(now,previousFrame);
  const delta = previousFrame ? current - previousFrame : 0;
  previousFrame = current;
  // Keep real-time speed on slower devices. Visibility/pause resets the clock,
  // so background tabs do not accumulate a large jump on return.
  elapsed += delta / 1000;
  if(elapsed>=nextTimeAt){advanceTime();return;}
  if (!resizeTask && now>=nextVisualAt-.5) {
    if(nextVisualAt<now-sceneFrameInterval)nextVisualAt=now;
    nextVisualAt+=sceneFrameInterval;
    draw();
  }
  frame = requestAnimationFrame(tick);
}
function syncMotion() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  previousFrame = 0; nextVisualAt = 0;
  pause.textContent = paused ? '▷ 播放动效' : 'Ⅱ';
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? '播放场景动效' : '暂停场景动效');
  pause.title = paused ? (motion.matches ? '系统已启用减少动态效果，点击播放场景动效' : '播放动效') : '暂停动效';
  if (ready && !paused && !transitioning && !changingTime && !restoringTime && pageActive && !document.hidden) frame = requestAnimationFrame(tick);
}
pause.addEventListener('click', () => { paused = !paused; syncMotion(); });
motion.addEventListener('change', event => { paused = event.matches; if(event.matches)timeFade?.finish();syncMotion(); });
document.addEventListener('visibilitychange',()=>{if(document.hidden)timeFade?.finish();syncMotion();});
document.addEventListener('site:transition', event => { transitioning = event.detail.active; if(transitioning)timeFade?.finish();syncMotion(); });
window.addEventListener('pagehide',()=>{pageActive=false;timeFade?.finish();syncMotion();});
window.addEventListener('pageshow',async event=>{
  pageActive=true;
  if(event.persisted){
    restoringTime=true;timeFade?.finish();syncMotion();
    try{
      await timeChange?.catch(()=>{});
      if(ready)await changeTime(localSceneTime(),{animate:false});
      else{sceneTime=localSceneTime();document.body.dataset.sceneTime=sceneTime;syncTimeControl();}
    }catch{document.querySelector('#time-status').textContent='时段切换未完成，请再点一下吊灯。';}
    finally{nextTimeAt=elapsed+60;restoringTime=false;syncMotion();}
  }else syncMotion();
});
new ResizeObserver(() => {
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { layout(); resizeFrame = null; });
}).observe(viewport);
layout();
syncMotion();
try {
  await loadSceneImage(image, site.image, value => reportProgress(value === null ? null : value * 35, '加载场景'));
  performance.mark('scene-source-ready');
  renderer = await PixelScene.create(image, canvas, value => reportProgress(35 + value * 60, '准备像素场景'), document.querySelector('#screen-canvas'));
  do { await renderer.resizeAsync(width, height, value => reportProgress(95 + value * 4, '点亮屏幕')); }
  while (renderer.width !== width || renderer.height !== height);
  if(sceneTime!=='dusk')await renderer.setTimeOfDay(sceneTime);
  await draw();
  ready = true;nextTimeAt=elapsed+60;timeControl.hidden=false;syncLampVisibility();
  document.body.classList.add('scene-ready');
  sceneIntro.finish();
  performance.mark('scene-ready');
  reportProgress(100, '就绪');
  setTimeout(() => { status.hidden = true; }, 200);
  syncMotion();
} catch {
  renderer?.dispose();
  status.textContent = '动态场景暂时无法载入，仍可点击画面入口。';
  poster.src=poster.dataset.src;
  await poster.decode().catch(()=>{});
  document.body.classList.add('scene-fallback');
  sceneIntro.finish();
  pause.hidden = true;
}
