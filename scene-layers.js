import { waterSampleInterval } from './render-budget.js?v=20261111-glyph16';
import { detailPoint } from './scene-details.js?v=20261110-depth6';

// The browser composites small canvases in their original image coordinates.
// Rigid floats use CSS transforms; only sampled water frames are transferred.
export class SceneLayers {
  constructor(root){this.root=root;this.floats=[];}
  configure(specs,scale){
    for(const old of this.root.querySelectorAll('[data-static]'))old.width=old.height=1;
    this.scale=scale;this.floats=[];this.water=[];this.time=0;const targets=[],nodes=[];let waterGroup;
    for(const spec of specs){
      const canvas=document.createElement('canvas');canvas.dataset.layer=spec.id;
      canvas.width=spec.width;canvas.height=spec.height;
      Object.assign(canvas.style,{width:spec.w+'px',height:spec.h+'px',left:spec.x+'px',top:spec.y+'px'});
      if(spec.quad)canvas.dataset.quad=JSON.stringify(spec.quad);
      if(spec.matrix){canvas.style.left=canvas.style.top='0px';canvas.style.transform=spec.matrix;}
      if(spec.water){
        if(!waterGroup){waterGroup=document.createElement('div');waterGroup.className='water-blend';Object.assign(waterGroup.style,{left:spec.x+'px',top:spec.y+'px',width:spec.w+'px',height:spec.h+'px'});nodes.push(waterGroup);}
        canvas.dataset.static='';canvas.style.left=canvas.style.top='0px';canvas.style.opacity='0';waterGroup.append(canvas);
        this.water.push({canvas,ctx:canvas.getContext('2d'),index:-1});continue;
      }
      if(spec.bitmap){canvas.dataset.static='';canvas.getContext('2d').drawImage(spec.bitmap,0,0);spec.bitmap.close();}
      else targets.push({id:spec.id,canvas:canvas.transferControlToOffscreen()});
      if(spec.shape){canvas.dataset.floating='';this.floats.push({canvas,spec});}
      nodes.push(canvas);
    }
    this.root.replaceChildren(...nodes);return targets;
  }
  updateWater(frames=[]){
    for(const {index,bitmap} of frames){const slot=this.water[index%3];slot.ctx.clearRect(0,0,slot.canvas.width,slot.canvas.height);slot.ctx.drawImage(bitmap,0,0);bitmap.close();slot.index=index;}
    this.drawWater(this.time);
  }
  drawWater(time){
    const ordered=this.water.filter(slot=>slot.index>=0).sort((a,b)=>a.index-b.index);
    if(!ordered.length)return;
    let left=ordered[0],right=ordered.at(-1);
    for(const slot of ordered){if(slot.index*waterSampleInterval<=time)left=slot;if(slot.index*waterSampleInterval>=time){right=slot;break;}}
    const span=(right.index-left.index)*waterSampleInterval;
    const mix=span>0?Math.max(0,Math.min(1,(time-left.index*waterSampleInterval)/span)):0;
    for(const slot of this.water)slot.canvas.style.opacity=String(slot===left?1-mix:slot===right?mix:0);
  }
  draw(time){
    this.time=time;this.drawWater(time);
    const s=this.scale;
    for(const {canvas,spec} of this.floats){
      const [ax,ay]=spec.shape.anchor,p=detailPoint(spec.shape,ax,ay,time),px=detailPoint(spec.shape,ax+1,ay,time),py=detailPoint(spec.shape,ax,ay+1,time);
      const a=px[0]-p[0],b=px[1]-p[1],c=py[0]-p[0],d=py[1]-p[1];
      canvas.style.transform=`matrix(${a},${b},${c},${d},${(p[0]-a*ax-c*ay)*s+(a-1)*spec.x+c*spec.y},${(p[1]-b*ax-d*ay)*s+b*spec.x+(d-1)*spec.y})`;
    }
  }
}
