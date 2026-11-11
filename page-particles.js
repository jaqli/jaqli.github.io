import { drawSceneLayers, drawSceneAmbience } from './scene-snapshot.js?v=20261111-detail39';

const glyphs=Array.from({length:94},(_,i)=>String.fromCharCode(i+33)).join('');
const limit=1400;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function particle(x,y,color,char,index,size=12){
  const seed=Math.sin(index*127.1+31.7)*43758.5453,phase=(seed-Math.floor(seed))*Math.PI*2;
  return {x,y,color,char:char||glyphs[index%94],phase,size,depth:.45+(index%13)/13};
}

// One small color read on navigation, never a per-frame full-scene snapshot.
function sceneParticles(){
  const source=document.querySelector(document.body.classList.contains('scene-ready')?'#ascii-canvas':document.body.classList.contains('scene-fallback')?'#scene-poster':'#scene-intro');
  if(!source||(source instanceof HTMLImageElement&&!source.naturalWidth))return [];
  const sample=document.createElement('canvas'),scale=Math.min(1,512/innerWidth,320/innerHeight);
  sample.width=Math.ceil(innerWidth*scale);sample.height=Math.ceil(innerHeight*scale);
  const ctx=sample.getContext('2d',{willReadFrequently:true});if(!ctx)return [];
  ctx.scale(scale,scale);
  const bounds=source.getBoundingClientRect();ctx.drawImage(source,bounds.x,bounds.y,bounds.width,bounds.height);
  if(document.body.classList.contains('scene-ready')){drawSceneLayers(ctx);drawSceneAmbience(ctx);}
  let pixels;try{pixels=ctx.getImageData(0,0,sample.width,sample.height).data;}catch{return [];}
  const preview=!document.body.classList.contains('scene-ready')&&!document.body.classList.contains('scene-fallback');
  // The first loading glyphs occupy little area. A finer one-time sampling
  // pass still finds them when someone opens an entrance immediately.
  const result=[],step=preview?8:Math.max(15,Math.sqrt(innerWidth*innerHeight/limit));
  for(let y=step/2;y<innerHeight&&result.length<limit;y+=step)for(let x=step/2;x<innerWidth&&result.length<limit;x+=step){
    const i=(Math.floor(y*scale)*sample.width+Math.floor(x*scale))*4;
    if(pixels[i]+pixels[i+1]+pixels[i+2]<35)continue;
    const color=`rgb(${[0,1,2].map(c=>clamp(Math.round(pixels[i+c]*1.5),0,255)).join(' ')})`;
    result.push(particle(x,y,color,null,result.length,10+result.length%5));
  }
  sample.width=sample.height=1;return result;
}
function textParticles(){
  const particles=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const range=document.createRange();let node,visited=0;
  while((node=walker.nextNode())&&visited++<2500&&particles.length<limit){
    const text=node.textContent.trim(),parent=node.parentElement;
    if(!text||!parent||parent.closest('script,style,svg,.page-transition,[hidden],.visually-hidden'))continue;
    const bounds=parent.getBoundingClientRect();
    if(bounds.bottom<0||bounds.top>innerHeight||!bounds.width||!bounds.height)continue;
    const style=getComputedStyle(parent);if(style.visibility==='hidden'||style.display==='none')continue;
    range.selectNodeContents(node);let character=0;
    for(const rect of range.getClientRects()){
      if(rect.bottom<0||rect.top>innerHeight)continue;
      const spacing=Math.max(8,Math.min(18,parseFloat(style.fontSize)*.64));
      for(let x=rect.left;x<rect.right&&particles.length<limit;x+=spacing){
        if(x<0||x>innerWidth)continue;
        const char=text[character++%text.length];if(char===' ')continue;
        particles.push(particle(x,rect.top+rect.height*.74,style.color,/^[!-~]$/.test(char)?char:null,particles.length,clamp(parseFloat(style.fontSize),10,19)));
      }
    }
  }
  return particles;
}

export function createParticles(canvas,focus){
  const width=innerWidth,height=innerHeight,dpr=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  ctx.scale(dpr,dpr);ctx.textBaseline='middle';
  const particles=document.body.classList.contains('home')?sceneParticles():textParticles();
  const fx=focus.x*width,fy=focus.y*height;
  // Precompute velocities; each frame is a bounded set of glyph draws.
  for(const p of particles){
    const dx=p.x-fx,dy=p.y-fy;
    p.vx=dx*(.35+p.depth*.6)+Math.cos(p.phase)*100;
    p.vy=dy*(.35+p.depth*.6)+Math.sin(p.phase)*100;
  }
  return {
    draw(progress,entering,zoom,shiftX=0,shiftY=0){
      const t=entering?1-progress:progress;
      const spread=t*t,alpha=entering?Math.sin(Math.PI*Math.min(1,progress*1.08)) : Math.sin(Math.PI*progress);
      ctx.clearRect(0,0,width,height);
      ctx.save();ctx.translate(fx+shiftX,fy+shiftY);ctx.scale(zoom,zoom);ctx.translate(-fx,-fy);
      ctx.globalAlpha=Math.max(0,alpha)*.9;
      let font='';
      for(let i=0;i<particles.length;i++){
        const p=particles[i],size=Math.round(p.size*(1+spread*p.depth*.35));
        const next=`600 ${size}px "Courier New",monospace`;if(next!==font){ctx.font=next;font=next;}
        ctx.fillStyle=p.color;
        const char=t>.25?glyphs[(i+Math.floor(t*28)+Math.floor(p.phase*5))%94]:p.char;
        const curl=Math.sin(t*Math.PI)*24;
        ctx.fillText(char,p.x+p.vx*spread+Math.sin(p.phase+t*2)*curl,p.y+p.vy*spread+Math.cos(p.phase+t*2)*curl);
      }
      ctx.restore();
    },
    dispose(){particles.length=0;canvas.width=canvas.height=1;}
  };
}
