const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const loops=new Map();
let pageHidden=false,transitioning=false;
const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const entry of entries){
    const state=loops.get(entry.target);if(!state)continue;
    state.visible=entry.isIntersecting&&entry.intersectionRatio>=.15;
    sync(state);
  }
},{threshold:[0,.15]}):null;

function shouldPlay(state){
  return state.visible&&!document.hidden&&!pageHidden&&!transitioning&&!state.userPaused&&(!reducedMotion.matches||state.motionOverride);
}
function sync(state){
  const {video}=state;
  if(!shouldPlay(state)){video.pause();return;}
  if(!state.loaded){
    video.src=state.src;
    state.loaded=true;video.load();
  }
  if(!video.paused||state.starting)return;
  state.starting=true;
  let interrupted=false;
  video.play().catch(error=>{
    // A device may block autoplay (for example Low Power Mode). Keep a usable
    // play control; ordinary playback remains silent and automatic.
    interrupted=error.name==='AbortError';
  }).finally(()=>{
    state.starting=false;
    if(interrupted&&shouldPlay(state))sync(state);
  });
}
function syncAll(){for(const state of loops.values())sync(state);}

export function videoPreview({mp4,width,height,label,preview}){
  const frame=document.createElement('div');frame.className='publication-loop';
  frame.style.aspectRatio=`${width||16} / ${height||9}`;
  const video=document.createElement('video');
  video.muted=true;video.defaultMuted=true;video.autoplay=true;video.loop=true;video.playsInline=true;video.preload='none';
  video.setAttribute('muted','');video.setAttribute('playsinline','');
  video.setAttribute('aria-label',`${label} · looping video preview`);
  video.width=width||480;video.height=height||270;
  const control=document.createElement('button');control.type='button';control.className='publication-toggle';
  const renderControl=()=>{
    control.textContent=video.paused?'▶':'Ⅱ';
    control.setAttribute('aria-label',`${video.paused?'Play':'Pause'} ${label} preview`);
    control.title=video.paused?'播放预览':'暂停预览';
  };
  const state={video,control,src:mp4,visible:!observer,loaded:false,userPaused:false,motionOverride:false,starting:false};
  frame.append(preview,video,control);loops.set(frame,state);renderControl();
  control.addEventListener('click',()=>{
    if(!video.paused){state.userPaused=true;video.pause();}
    else{state.userPaused=false;state.motionOverride=true;sync(state);}
  });
  video.addEventListener('playing',()=>{
    if(!shouldPlay(state)){video.pause();return;}
    frame.classList.add('has-video');renderControl();
  });
  video.addEventListener('pause',renderControl);
  video.addEventListener('error',()=>{frame.classList.remove('has-video');renderControl();});
  if(observer)observer.observe(frame);else sync(state);
  return frame;
}

document.addEventListener('visibilitychange',syncAll);
document.addEventListener('site:transition',event=>{transitioning=event.detail.active;syncAll();});
window.addEventListener('pagehide',()=>{pageHidden=true;syncAll();});
window.addEventListener('pageshow',()=>{pageHidden=false;transitioning=false;syncAll();});
reducedMotion.addEventListener('change',()=>{
  for(const state of loops.values())state.motionOverride=false;
  syncAll();
});
