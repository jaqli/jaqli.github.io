import { glyphColor } from './glyph-atlas.js?v=20261111-scatter23';
import { SpriteAtlas } from './sprite-atlas.js?v=20261111-scatter23';

import { glyphAt } from './glyph-rhythm.js?v=20261111-scatter23';
export const glyphUpdateLimit=8192; // changed characters per draw; old states are skipped

// Every retained letter has its own 1.2–1.5 Hz clock and symbol sequence.
// Cache precise ink footprints so scattered changes touch very few neighbors.
export class GlyphMotion {
  constructor(renderer){
    this.r=renderer;this.enabled=true;this.lastBatch={cells:0};
    this.base=renderer.base.getContext('2d');this.cloud=renderer.cloudBase.getContext('2d');
    this.palette=new SpriteAtlas(renderer.fontSize,Math.max(2,renderer.pixelRatio));
    // Include the largest allowed letters and their neighbors when replacing
    // ink; a 1.0-sized patch would crop the new 1.5-sized strokes.
    this.radiusX=renderer.fontSize*renderer.maxGlyphSize*.45+1/renderer.pixelRatio;
    this.radiusY=renderer.fontSize*renderer.maxGlyphSize*.65+1/renderer.pixelRatio;
    this.cells=renderer.cells.filter(c=>c.occupied&&c.glyphLayer!=='dynamic');
  }
  *prepare(){
    yield* this.palette.prepare(this.cells,c=>glyphColor(c.rgb));
    for(const cell of this.r.cells)if(cell.occupied){
      const breathing=cell.glyphLayer==='dynamic',size=breathing?Math.min(1.5,cell.size+.1):cell.size;
      const atlas=breathing?this.r.spriteAtlas:this.palette;
      const [l,t,rr,b]=atlas.inkBounds(cell,size),dpr=this.r.pixelRatio;
      const dy=cell.kind==='hem'?.35*this.r.scale:0;
      const x=Math.floor((cell.x-l)*dpr)/dpr,y=Math.floor((cell.y-t-dy)*dpr)/dpr;
      cell.inkBox=[x,y,Math.ceil((cell.x+rr)*dpr)/dpr-x,Math.ceil((cell.y+b+dy)*dpr)/dpr-y];
    }
    for(const cell of this.r.cells)if(cell.occupied){
      cell.glyphPatch=this.patch(cell,cell.glyphLayer==='cloud'?'cloud':'base');cell.nextGlyphChange=0;
      const phase=Math.sin(cell.x*19.7+cell.y*71.3+911)*43758.5453;cell.glyphCheckPhase=phase-Math.floor(phase);
    }
  }

  enableGPU(){
    this.gpu=true;
    // The GPU handles the base; retain local patch lists only for the sky.
    for(const cell of this.r.cells)if(cell.glyphLayer!=='cloud')cell.glyphPatch=null;
  }
  advance(cell,time,targetTick,patches){
    const step=Math.floor(Math.max(0,time)*cell.glyphRate+cell.glyphOffset);
    const due=(step+1-cell.glyphOffset)/cell.glyphRate;
    cell.nextGlyphChange=this.gpu?due:(Math.ceil(due*8+cell.glyphCheckPhase)-cell.glyphCheckPhase)/8;
    cell.glyphNextTick=Math.max(targetTick+1,Math.ceil(cell.nextGlyphChange*60));
    this.wheel[cell.glyphNextTick%64].push(cell);
    const variant=step%cell.glyphPool.length;if(variant===cell.glyphVariant)return;
    cell.glyphVariant=variant;cell.liveGlyph=glyphAt(cell);this.lastBatch.cells++;
    if(cell.glyphPatch)patches.push(cell.glyphPatch);
  }
  update(time,extra=[],present){
    if(!this.enabled)return [];
    const resync=this.time===undefined||time<this.time||time-this.time>1;
    this.time=time;
    const targetTick=Math.floor(time*60),dirty=[],patches=[];
    this.lastBatch={cells:0,resync};
    if(resync){
      // Deadlines are less than a second away. A small timing wheel replaces
      // scanning tens of thousands of unchanged characters on every frame.
      this.wheel=Array.from({length:64},()=>[]);this.tick=targetTick;this.due=[];this.dueIndex=0;
      for(const cell of this.cells)this.advance(cell,time,targetTick,patches);
    }else while(this.lastBatch.cells<glyphUpdateLimit){
      if(this.dueIndex===this.due.length){
        if(this.tick>=targetTick)break;
        this.tick++;const slot=this.tick%64;
        this.due=this.wheel[slot];this.wheel[slot]=[];this.dueIndex=0;
      }
      if(this.dueIndex===this.due.length)continue;
      const cell=this.due[this.dueIndex++];
      // A late frame may wrap a newly scheduled entry into an earlier slot.
      if(cell.glyphNextTick>targetTick){this.wheel[cell.glyphNextTick%64].push(cell);continue;}
      this.advance(cell,time,targetTick,patches);
    }
    if(!this.gpu)for(const cell of extra)patches.push(cell.glyphPatch);
    for(const patch of patches){
      if(patch.cloud)this.paintPatch(this.cloud,patch);
      else{dirty.push(patch.box);if(present)present(patch);else this.paintPatch(this.base,patch);}
    }
    return dirty;
  }
  paintPatch(ctx,{cloud,box,neighbors}){
    const [x,y,w,h]=box;
    if(cloud)ctx.clearRect(x,y,w,h);
    else{ctx.fillStyle='#080d13';ctx.fillRect(x,y,w,h);}
    for(const cell of neighbors)this.palette.draw(ctx,cell,cell.x,cell.y,cell.size,cell.glyphVariant,box);
  }
  patch(cell,layer=cell.glyphLayer){return this.patchBox(...cell.inkBox,layer);}
  patchBox(x,y,w,h,layer){
    const r=this.r,cloud=layer==='cloud',neighbors=[],dynamic=[];
    const left=Math.max(0,Math.floor((x-this.radiusX)/r.cellW)),right=Math.min(r.columns-1,Math.floor((x+w+this.radiusX)/r.cellW));
    const top=Math.max(0,Math.floor((y-this.radiusY)/r.cellH)),bottom=Math.min(r.rows-1,Math.floor((y+h+this.radiusY)/r.cellH));
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
      const neighbor=r.cells[row*r.columns+col];
      if(!neighbor.occupied)continue;
      const [xx,yy,ww,hh]=neighbor.inkBox;
      if(xx+ww<=x||xx>=x+w||yy+hh<=y||yy>=y+h)continue;
      if(!cloud&&neighbor.glyphLayer==='dynamic')dynamic.push(neighbor);
      else if(neighbor.glyphLayer===layer)neighbors.push(neighbor);
    }
    return {cloud,box:[x,y,w,h],neighbors,dynamic};
  }
}
