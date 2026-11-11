import { glyphColor } from './glyph-atlas.js?v=20261111-rhythm22';
import { SpriteAtlas } from './sprite-atlas.js?v=20261111-rhythm22';

import { alternatives, glyphRateMin, glyphRateMax, glyphStep } from './glyph-rhythm.js?v=20261111-rhythm22';
const random=i=>{const n=Math.sin(i*127.1+1729)*43758.5453;return n-Math.floor(n);};
export const glyphUpdateLimit=32; // bounded blocks per draw, never queued behind input
export const glyphBlockSize=16;
const blockSize=glyphBlockSize;

// Every retained letter changes at 1.2–1.5 Hz. Small blocks use staggered phases
// and slightly different rates so the room does not pulse as one large surface.
export class GlyphMotion {
  constructor(renderer){
    this.r=renderer;this.enabled=true;this.cursor=0;this.lastBatch={blocks:0,cells:0};
    this.base=renderer.base.getContext('2d');this.cloud=renderer.cloudBase.getContext('2d');
    this.palette=new SpriteAtlas(renderer.fontSize,Math.max(2,renderer.pixelRatio));
    // Include the largest allowed letters and their neighbors when replacing
    // ink; a 1.0-sized patch would crop the new 1.5-sized strokes.
    this.radiusX=renderer.fontSize*renderer.maxGlyphSize*.45+1/renderer.pixelRatio;
    this.radiusY=renderer.fontSize*renderer.maxGlyphSize*.65+1/renderer.pixelRatio;
    this.blocks=[];
    for(let row=0;row<renderer.rows;row+=blockSize)for(let col=0;col<renderer.columns;col+=blockSize){
      const cells=[];
      for(let y=row;y<Math.min(row+blockSize,renderer.rows);y++)for(let x=col;x<Math.min(col+blockSize,renderer.columns);x++){
        const cell=renderer.cells[y*renderer.columns+x];
        if(cell.occupied&&cell.glyphLayer!=='dynamic')cells.push(cell);
      }
      if(!cells.length)continue;
      const x=Math.floor(col*renderer.cellW-this.radiusX),y=Math.floor(row*renderer.cellH-this.radiusY);
      const w=Math.ceil((col+blockSize)*renderer.cellW+this.radiusX)-x,h=Math.ceil((row+blockSize)*renderer.cellH+this.radiusY)-y;
      const layers=[...new Set(cells.map(c=>c.glyphLayer))];
      const index=this.blocks.length;
      this.blocks.push({cells,patches:layers.map(layer=>this.patchBox(x,y,w,h,layer)),step:0,
        glyphRate:glyphRateMin+(glyphRateMax-glyphRateMin)*random(index+57),glyphOffset:random(index+911)});
    }
    this.order=Uint32Array.from(this.blocks,(_,i)=>i);
    for(let i=this.order.length-1;i>0;i--){const j=Math.floor(random(i)*(i+1));[this.order[i],this.order[j]]=[this.order[j],this.order[i]];}
  }
  *prepare(){
    // Bake both characters once; the atlas is immutable during animation.
    // This avoids uploading a recolored texture for every scattered update.
    yield* this.palette.prepare(this.r.cells.filter(c=>c.occupied&&c.glyphLayer!=='dynamic'),c=>glyphColor(c.rgb));
    for(const block of this.blocks)for(const cell of block.cells){cell.glyphRate=block.glyphRate;cell.glyphOffset=block.glyphOffset;}
  }
  update(time,extra=[],present){
    if(!this.enabled)return [];
    // A new renderer can begin midway through the scene after a resize. Resolve
    // that instant directly, and discard old cycles after a long interruption.
    const resync=this.time===undefined||time<this.time||time-this.time>1;
    this.time=time;
    const limit=resync?this.order.length:glyphUpdateLimit;
    const dirty=[],patches=[];
    this.lastBatch={blocks:0,cells:0,resync};
    for(let checked=0;checked<this.order.length&&this.lastBatch.blocks<limit;checked++){
      const block=this.blocks[this.order[this.cursor]];
      this.cursor=(this.cursor+1)%this.order.length;
      // Coalesce texture writes at 12 Hz while each letter still changes at
      // 1.2–1.5 Hz. This avoids uploading changed sky/base textures every frame.
      const step=glyphStep(block,Math.floor(time*12)/12);
      if(step===block.step)continue;
      const changed=(step%2)!==(block.step%2);block.step=step;
      if(!changed)continue; // Skip missed cycles instead of queuing catch-up frames.
      this.lastBatch.blocks++;
      for(const cell of block.cells){
        cell.glyphVariant=step%2;cell.liveGlyph=cell.glyphVariant?alternatives[cell.glyph]:null;
        this.lastBatch.cells++;
      }
      patches.push(...block.patches);
    }
    patches.push(...extra.map(cell=>this.patch(cell,'base')));
    // Draw from the immutable glyph atlas straight into each final target.
    // Fast substitutions made the old mutable scratch uploads cost more than
    // the glyphs themselves; no full-scene variants or extra buffers are needed.
    for(const patch of patches){
      if(patch.cloud)this.paintPatch(this.cloud,patch);
      else{dirty.push(patch.box);if(present)present(patch);else this.paintPatch(this.base,patch);}
    }
    return dirty;
  }
  paintPatch(ctx,{cloud,box:[x,y,w,h],neighbors}){
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    if(cloud)ctx.clearRect(x,y,w,h);
    else{ctx.fillStyle='#080d13';ctx.fillRect(x,y,w,h);}
    for(const cell of neighbors)this.palette.draw(ctx,cell,cell.x,cell.y,cell.size);
    ctx.restore();
  }
  patch(cell,layer=cell.glyphLayer){
    const r=this.r;
    // Only the changed letter needs clearing. Reserve the maximum footprint
    // for breathing letters, whose previous size may differ from this frame.
    const breathing=cell.glyphLayer==='dynamic',pad=1/r.pixelRatio;
    const rx=breathing?this.radiusX:r.fontSize*cell.size*.45+pad;
    const ry=breathing?this.radiusY:r.fontSize*cell.size*.65+pad;
    const x=Math.floor(cell.x-rx),y=Math.floor(cell.y-ry),w=Math.ceil(cell.x+rx)-x,h=Math.ceil(cell.y+ry)-y;
    return this.patchBox(x,y,w,h,layer);
  }
  patchBox(x,y,w,h,layer){
    const r=this.r,cloud=layer==='cloud',neighbors=[],dynamic=[],pad=1/r.pixelRatio;
    const left=Math.max(0,Math.floor((x-this.radiusX)/r.cellW)),right=Math.min(r.columns-1,Math.floor((x+w+this.radiusX)/r.cellW));
    const top=Math.max(0,Math.floor((y-this.radiusY)/r.cellH)),bottom=Math.min(r.rows-1,Math.floor((y+h+this.radiusY)/r.cellH));
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
      const neighbor=r.cells[row*r.columns+col];
      if(!neighbor.occupied)continue;
      if(!cloud&&neighbor.glyphLayer==='dynamic')dynamic.push(neighbor);
      if(neighbor.glyphLayer!==layer)continue;
      const nx=r.fontSize*neighbor.size*.45+pad,ny=r.fontSize*neighbor.size*.65+pad;
      if(neighbor.x+nx<x||neighbor.x-nx>x+w||neighbor.y+ny<y||neighbor.y-ny>y+h)continue;
      neighbors.push(neighbor);
    }
    return {cloud,box:[x,y,w,h],neighbors,dynamic};
  }
}
