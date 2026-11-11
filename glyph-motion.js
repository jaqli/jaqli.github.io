import { glyphColor } from './glyph-atlas.js?v=20261111-space21';
import { SpriteAtlas } from './sprite-atlas.js?v=20261111-space21';
import { createCanvas } from './canvas-factory.js?v=20261110-fps10';

import { alternatives } from './glyph-rhythm.js?v=20261111-space21';
const random=i=>{const n=Math.sin(i*127.1+1729)*43758.5453;return n-Math.floor(n);};
export const glyphUpdateLimit=12; // small blocks per draw, never queued behind input
export const glyphPassSeconds=12;
const blockSize=8;

// Visit every part of the scene in twelve seconds, changing half of each small
// block. The other half follows on the next pass: every letter changes in 24 s.
// Three scattered passes alternate with one broadly staggered top-to-bottom pass.
export class GlyphMotion {
  constructor(renderer){
    this.r=renderer;this.enabled=true;this.cursor=0;this.round=0;this.time=0;this.credit=0;this.lastBatch={blocks:0,cells:0};
    this.base=renderer.base.getContext('2d');this.cloud=renderer.cloudBase.getContext('2d');
    this.palette=new SpriteAtlas(renderer.fontSize,Math.max(2,renderer.pixelRatio));
    // Include the largest allowed letters and their neighbors when replacing
    // ink; a 1.0-sized patch would crop the new 1.5-sized strokes.
    this.radiusX=renderer.fontSize*renderer.maxGlyphSize*.45+1/renderer.pixelRatio;
    this.radiusY=renderer.fontSize*renderer.maxGlyphSize*.65+1/renderer.pixelRatio;
    this.scratch=createCanvas();
    this.slotW=Math.ceil((blockSize*renderer.cellW+this.radiusX*2+3)*renderer.pixelRatio);
    this.slotH=Math.ceil((blockSize*renderer.cellH+this.radiusY*2+3)*renderer.pixelRatio);
    this.scratch.width=this.slotW*4;this.scratch.height=this.slotH*4;
    this.paint=this.scratch.getContext('2d');
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
      this.blocks.push({cells,patches:layers.map(layer=>this.patchBox(x,y,w,h,layer)),y:row/renderer.rows});
    }
    this.order=Uint32Array.from(this.blocks,(_,i)=>i);
    for(let i=this.order.length-1;i>0;i--){const j=Math.floor(random(i)*(i+1));[this.order[i],this.order[j]]=[this.order[j],this.order[i]];}
    // A wide random delay spreads the ordered pass across several rows. There
    // is no brightness filter or moving band laid over the original picture.
    this.downOrder=Uint32Array.from(this.order).sort((a,b)=>(this.blocks[a].y*.65+random(a)*.35)-(this.blocks[b].y*.65+random(b)*.35));
  }
  *prepare(){
    // Bake both characters once; the atlas is immutable during animation.
    // This avoids uploading a recolored texture for every scattered update.
    yield* this.palette.prepare(this.r.cells.filter(c=>c.occupied&&c.glyphLayer!=='dynamic'),c=>glyphColor(c.rgb));
  }
  update(time,extra=[],present){
    const dt=Math.max(0,Math.min(.1,time-this.time));this.time=time;
    if(!this.enabled)return [];
    this.credit=Math.min(glyphUpdateLimit,this.credit+dt*this.blocks.length/glyphPassSeconds);
    const count=Math.floor(this.credit),dirty=[],patches=[];this.credit-=count;
    this.lastBatch={blocks:count,cells:0};
    for(let i=0;i<count;i++){
      const order=this.round%4===3?this.downOrder:this.order,block=this.blocks[order[this.cursor]],half=this.round%2;
      for(const cell of block.cells){
        if(((cell.seed*65536|0)&1)!==half)continue;
        cell.glyphVariant=cell.glyphVariant?0:1;cell.liveGlyph=cell.glyphVariant?alternatives[cell.glyph]:null;
        this.lastBatch.cells++;
      }
      patches.push(...block.patches);
      if(++this.cursor===this.order.length){this.cursor=0;this.round++;}
    }
    patches.push(...extra.map(cell=>this.patch(cell,'base')));
    // Paint sixteen patches before reading the scratch texture. Alternating
    // one tiny canvas write/read per letter forced repeated GPU uploads.
    const dpr=this.r.pixelRatio,paint=this.paint;
    for(let start=0;start<patches.length;start+=16){
      const end=Math.min(patches.length,start+16);
      paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,this.scratch.width,this.scratch.height);
      for(let i=start;i<end;i++){
        const {cloud,box:[x,y,w,h],neighbors}=patches[i],slot=i-start,sx=slot%4*this.slotW,sy=Math.floor(slot/4)*this.slotH;
        paint.setTransform(dpr,0,0,dpr,sx-x*dpr,sy-y*dpr);
        paint.save();paint.beginPath();paint.rect(x,y,w,h);paint.clip();
        if(!cloud){paint.fillStyle='#080d13';paint.fillRect(x,y,w,h);}
        for(const cell of neighbors)this.palette.draw(paint,cell,cell.x,cell.y,cell.size);
        paint.restore();
      }
      for(let i=start;i<end;i++){
        const patch=patches[i],{cloud,box:[x,y,w,h]}=patch,ctx=cloud?this.cloud:this.base,slot=i-start;
        const source=[slot%4*this.slotW,Math.floor(slot/4)*this.slotH,w*dpr,h*dpr];
        if(cloud||!present){if(cloud)ctx.clearRect(x,y,w,h);ctx.drawImage(this.scratch,...source,x,y,w,h);}
        if(!cloud){dirty.push(patch.box);present?.(this.scratch,patch,source);}
      }
    }
    return dirty;
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
