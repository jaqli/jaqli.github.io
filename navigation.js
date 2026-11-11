import { createParticles } from './page-particles.js?v=20261111-scene32';

const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const routeKey='jaqli-route',homeKey='jaqli-home-focus';
const html=document.documentElement;
let navigating=false,overlay,frame,timer,particles,camera=[],entering=false,revision=0;
const path=url=>url.pathname+url.search;
const isHome=url=>/^\/(?:index\.html)?$/.test(url.pathname);
const clamp=value=>Math.max(.05,Math.min(.95,value));
function read(key){try{return JSON.parse(sessionStorage.getItem(key));}catch{return null;}}
function write(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}
function remove(key){try{sessionStorage.removeItem(key);}catch{}}
function signal(active){document.dispatchEvent(new CustomEvent('site:transition',{detail:{active}}));}
function reset(){
  revision++;
  cancelAnimationFrame(frame);clearTimeout(timer);particles?.dispose();particles=null;
  overlay?.remove();overlay=null;
  for(const item of camera)item.animation.cancel();camera=[];
  html.classList.remove('route-arriving');
  document.body.classList.remove('is-leaving','is-entering');
  entering=false;navigating=false;signal(false);
}
function focusFor(link,event){
  const bounds=link.getBoundingClientRect();
  return {x:clamp((event.detail?event.clientX:bounds.x+bounds.width/2)/innerWidth),y:clamp((event.detail?event.clientY:bounds.y+bounds.height/2)/innerHeight)};
}
function animate(phase,route,done){
  const incoming=phase==='enter',home=document.body.classList.contains('home');
  const focus=home?(incoming?(read(homeKey)||{x:.5,y:.5}):route.focus):{x:.5,y:.36};
  const duration=incoming?640:560;
  const homeShift={x:((.5-focus.x)*.9-.06)*innerWidth,y:((.42-focus.y)*.8-.08)*innerHeight};
  const startScale=incoming?(home?1.95:.7):1;
  const endScale=incoming?1:(route.direction==='out'?.58:1.95);
  const startShift=incoming?(home?homeShift:{x:-innerWidth*.1,y:innerHeight*.1}):{x:0,y:0};
  const endShift=incoming?{x:0,y:0}:(home?homeShift:{x:innerWidth*.1,y:innerHeight*.12});
  overlay=document.createElement('div');overlay.className=`page-transition ${incoming?'transition-enter':'transition-leave'}`;
  overlay.setAttribute('aria-hidden','true');overlay.dataset.phase=phase;
  const canvas=document.createElement('canvas');overlay.append(canvas);
  particles=createParticles(canvas,focus);
  document.body.append(overlay);
  document.body.classList.add(incoming?'is-entering':'is-leaving');
  // Animate the live DOM: sharp text/images, no screenshot library or permanent buffer.
  const roots=document.querySelectorAll(home?'#scene-viewport,.scene-header,.motion-toggle,.pan-hint,.scene-status':'.document-main,.document-header,.document-footer');
  for(const element of roots){
    const bounds=element.getBoundingClientRect();
    const origin=`${focus.x*innerWidth-bounds.x}px ${focus.y*innerHeight-bounds.y}px`;
    const base=getComputedStyle(element).transform;
    const transform=t=>`translate(${startShift.x+(endShift.x-startShift.x)*t}px,${startShift.y+(endShift.y-startShift.y)*t}px) scale(${startScale+(endScale-startScale)*t}) ${base==='none'?'':base}`;
    const animation=element.animate([
      {transform:transform(0),transformOrigin:origin,opacity:incoming?0:1,offset:0},
      {transform:transform(.26),transformOrigin:origin,opacity:incoming?.5:1,offset:.26},
      {transform:transform(.75),transformOrigin:origin,opacity:incoming?1:.6,offset:.75},
      {transform:transform(1),transformOrigin:origin,opacity:incoming?1:0,offset:1},
    ],{duration,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
    camera.push({animation});
  }
  html.classList.remove('route-arriving');signal(true);
  const start=performance.now();
  const finish=()=>{if(incoming){reset();done?.();}else done();};
  function tick(now){
    const p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,3);
    particles?.draw(p,incoming,startScale+(endScale-startScale)*ease,startShift.x+(endShift.x-startShift.x)*ease,startShift.y+(endShift.y-startShift.y)*ease);
    if(p<1)frame=requestAnimationFrame(tick);else finish();
  }
  frame=requestAnimationFrame(tick);
  // Background tabs or a stalled animation must never prevent navigation.
  timer=setTimeout(finish,duration+100);
}

let pending=read(routeKey);remove(routeKey);
if(pending&&(pending.to!==path(location)||Date.now()-pending.at>10000))pending=null;
const restored=performance.getEntriesByType('navigation')[0]?.type==='back_forward';
if(!pending&&restored)pending={direction:isHome(location)?'out':'in',focus:{x:.5,y:.5}};
async function arrive(route){
  if(reducedMotion.matches){reset();return;}
  const current=revision;
  entering=true;
  // Start with generated characters; never wait for the complete ASCII worker.
  if(document.body.classList.contains('home')){
    if(!document.body.classList.contains('scene-ready')&&!Number(document.querySelector('#scene-intro')?.dataset.revealed))await new Promise(resolve=>{
      const ready=()=>{clearTimeout(timeout);document.removeEventListener('scene-intro-ready',ready);resolve();};
      const timeout=setTimeout(ready,300);document.addEventListener('scene-intro-ready',ready,{once:true});
    });
  }else if(!document.body.dataset.contentReady){
    await new Promise(resolve=>{
      const ready=()=>{clearTimeout(timeout);document.removeEventListener('site:content-ready',ready);resolve();};
      const timeout=setTimeout(ready,650);document.addEventListener('site:content-ready',ready,{once:true});
    });
  }
  if(current!==revision||!entering||navigating)return;
  try{animate('enter',route);}catch{reset();}
}
if(pending)arrive(pending);else html.classList.remove('route-arriving');

window.addEventListener('pagehide',reset);
window.addEventListener('pageshow',event=>{
  if(event.persisted){reset();arrive({direction:isHome(location)?'out':'in',focus:{x:.5,y:.5}});}
});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches&&!navigating)reset();});

function internalLink(event){
  const link=event.target.closest?.('a');
  if(!link||link.hasAttribute('download')||link.getAttribute('target'))return null;
  const href=link.getAttribute('href');if(!href)return null;
  let url;try{url=new URL(href,location.href);}catch{return null;}
  if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol)||path(url)===path(location))return null;
  return {link,url};
}
// Prefetch only destination HTML, not large media or scene textures.
const prefetched=new Set();
function prefetch(event){
  const target=internalLink(event);if(!target||prefetched.size>=6||prefetched.has(target.url.href)||navigator.connection?.saveData)return;
  prefetched.add(target.url.href);const hint=document.createElement('link');hint.rel='prefetch';hint.href=target.url.href;document.head.append(hint);
}
document.addEventListener('pointerover',prefetch,{passive:true});
document.addEventListener('focusin',prefetch);
document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const target=internalLink(event);if(!target||reducedMotion.matches)return;
  event.preventDefault();if(navigating)return;
  reset();navigating=true;
  const focus=focusFor(target.link,event);
  if(document.body.classList.contains('home'))write(homeKey,focus);
  const route={to:path(target.url),direction:isHome(target.url)?'out':'in',focus,at:Date.now()};
  write(routeKey,route);
  let assigned=false;
  const go=()=>{if(assigned)return;assigned=true;clearTimeout(timer);location.assign(target.url.href);};
  try{animate('leave',route,go);}catch{go();}
});
