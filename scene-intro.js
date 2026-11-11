// A small independent module paints actual glyphs while the full renderer loads.
// It shares the room's coordinates, so panning and camera transitions stay aligned.
const canvas=document.querySelector('#scene-intro');
const world=document.querySelector('#scene-world');
const viewport=document.querySelector('#scene-viewport');
const ctx=canvas?.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=:;?/<>[]{}';
let pixels,points=[],width=0,height=0,progress=0,head=0,timer,frame,done=false,blocked=false,marked=false;
const hash=i=>{const n=Math.sin(i*127.1+31.7)*43758.5453;return n-Math.floor(n);};
const seed=new Image();
seed.src=new URL('./assets/scene-seed.webp?v=20261111-clarity46',import.meta.url).href;

function schedule(delay=40){
  if(done||blocked||document.hidden||!pixels||timer||frame)return;
  timer=setTimeout(()=>{timer=null;frame=requestAnimationFrame(paint);},delay);
}
function cancel(){clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=null;}
function paint(now){
  frame=null;if(done||blocked||document.hidden)return;
  const target=reduced.matches?points.length:Math.floor(points.length*(.18+.8*progress/100));
  const end=Math.min(target,head+(reduced.matches?points.length:280));
  for(let i=head;i<end;i++)points[i].born=now;
  const start=Math.max(0,head-180);
  for(let i=start;i<end;i++){
    const p=points[i],fresh=now-p.born<240;
    ctx.clearRect(p.x-p.dx/2,p.y-p.dy/2,p.dx,p.dy);
    ctx.fillStyle=p.color;ctx.font=`700 ${p.size}px "Courier New",monospace`;
    ctx.fillText(fresh&&!reduced.matches?alphabet[(p.char+Math.floor(now/120+p.phase))%alphabet.length]:alphabet[p.char],p.x,p.y);
  }
  head=end;canvas.dataset.revealed=String(head);
  if(!marked&&head){marked=true;performance.mark('scene-preview-ready');document.dispatchEvent(new Event('scene-intro-ready'));}
  if(!reduced.matches)schedule(head<target?35:125);
}
function rebuild(w,h){
  if(done||!ctx)return;
  width=w;height=h;
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.ceil(w*dpr);canvas.height=Math.ceil(h*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.textAlign='center';ctx.textBaseline='middle';
  if(!pixels)return;
  const cols=Math.max(96,Math.min(170,Math.round(w/9))),dx=w/cols,rows=Math.round(h/(dx*1.38)),dy=h/rows;
  points=[];head=0;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const id=row*cols+col,random=hash(id),sx=Math.min(191,Math.floor((col+.5)/cols*192)),sy=Math.min(127,Math.floor((row+.5)/rows*128));
    const i=(sy*192+sx)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
    if(Math.max(r,g,b)<43&&random<.75)continue;
    const light=(r+g+b)/765;
    // Three integer font sizes keep the browser's glyph cache small at startup.
    points.push({x:(col+.5)*dx,y:(row+.5)*dy,dx,dy,size:Math.max(5,Math.round(dx*(.8+Math.floor(random*3)*.1))),
      color:`rgb(${r} ${g} ${b})`,char:Math.floor(hash(id+918)*alphabet.length),phase:random*7,born:0,
      // Individual jitter breaks up the reveal front; no rectangular batches.
      rank:row/rows*.42+col/cols*.12+hash(id+193)*.46+light*.025});
  }
  points.sort((a,b)=>a.rank-b.rank);
  canvas.dataset.total=String(points.length);document.body.classList.add('scene-generating');schedule(0);
}
export const sceneIntro={
  resize(w,h){if(w!==width||h!==height)rebuild(w,h);},
  progress(value){if(Number.isFinite(value)){progress=Math.max(progress,value);schedule(0);}},
  finish(){
    done=true;cancel();points=[];pixels=null;seed.removeAttribute('src');
    setTimeout(()=>{canvas.width=canvas.height=1;canvas.hidden=true;},reduced.matches?0:200);
  },
};
if(canvas&&ctx){
  const scale=Math.max(viewport.clientWidth/1536,viewport.clientHeight/1024);
  world.style.width=`${1536*scale}px`;world.style.height=`${1024*scale}px`;
  world.style.top=`${Math.min(0,(viewport.clientHeight-1024*scale)/3)}px`;
  viewport.scrollLeft=Math.max(0,1536*scale*.42-viewport.clientWidth/2);
  rebuild(1536*scale,1024*scale);
  seed.decode().then(()=>{
    if(done)return;
    const sample=document.createElement('canvas');sample.width=192;sample.height=128;
    const sampleContext=sample.getContext('2d',{willReadFrequently:true});sampleContext.drawImage(seed,0,0,192,128);
    pixels=sampleContext.getImageData(0,0,192,128).data;sample.width=sample.height=1;
    rebuild(width,height);
  }).catch(()=>{});
}
document.addEventListener('visibilitychange',()=>{cancel();if(!document.hidden)schedule(0);});
document.addEventListener('site:transition',event=>{blocked=event.detail.active;cancel();if(!blocked)schedule(0);});
window.addEventListener('pagehide',cancel);
window.addEventListener('pageshow',()=>schedule(0));
reduced.addEventListener('change',()=>{cancel();rebuild(width,height);});
