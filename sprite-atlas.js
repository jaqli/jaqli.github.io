import { createCanvas } from './canvas-factory.js?v=20261110-fps10';
import { prepareGlyph } from './glyph-rhythm.js?v=20261111-scatter23';

// Pack just the ink and one transparent border pixel. Deduplicating by actual
// symbol/color keeps a richer alphabet close to the old two-letter atlas size.
export class SpriteAtlas {
  constructor(fontSize,dpr){
    this.dpr=dpr;this.fontSize=fontSize;this.tile=Math.ceil(fontSize*1.6*dpr);
    this.canvas=createCanvas();this.metrics=new Map();this.bounds=new Map();
  }
  measureGlyphs(chars){
    const canvas=createCanvas(),side=this.tile;canvas.width=canvas.height=side;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.font=`500 ${this.fontSize*this.dpr}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';
    for(const char of chars){
      ctx.clearRect(0,0,side,side);ctx.fillText(char,side/2,side/2);
      const p=ctx.getImageData(0,0,side,side).data;let left=side,top=side,right=0,bottom=0;
      for(let y=0;y<side;y++)for(let x=0;x<side;x++)if(p[(y*side+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
      this.metrics.set(char,{left,top,right,bottom,x:left-1,y:top-1,w:right-left+2,h:bottom-top+2});
    }
    canvas.width=canvas.height=1;
  }
  *prepare(cells,colorFor=cell=>cell.color){
    const unique=new Map(),sets=new Map(),chars=new Set();
    for(const cell of cells){
      prepareGlyph(cell);const color=colorFor(cell),key=color+':'+cell.glyphPool;
      let tiles=sets.get(key);
      if(!tiles){
        tiles=[...cell.glyphPool].map(glyph=>{const k=color+':'+glyph;let tile=unique.get(k);if(!tile){tile={glyph,color};unique.set(k,tile);chars.add(glyph);}return tile;});
        sets.set(key,tiles);
      }
      cell.glyphTiles=tiles;
    }
    this.measureGlyphs(chars);
    const entries=[...unique.values()];let area=0;
    for(const entry of entries){entry.metric=this.metrics.get(entry.glyph);area+=entry.metric.w*entry.metric.h;}
    entries.sort((a,b)=>b.metric.h-a.metric.h);
    this.canvas.width=Math.min(4096,Math.max(256,2**Math.ceil(Math.log2(Math.sqrt(area)))));
    let x=0,y=0,rowHeight=0;
    for(const entry of entries){const {w,h}=entry.metric;if(x+w>this.canvas.width){y+=rowHeight;x=0;rowHeight=0;}entry.x=x;entry.y=y;x+=w;rowHeight=Math.max(rowHeight,h);}
    this.canvas.height=Math.max(1,y+rowHeight);this.entries=entries.length;
    const ctx=this.canvas.getContext('2d');ctx.font=`500 ${this.fontSize*this.dpr}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    for(let i=0;i<entries.length;i++){
      const entry=entries[i],m=entry.metric;ctx.fillStyle=entry.color;
      ctx.fillText(entry.glyph,entry.x+this.tile/2-m.x,entry.y+this.tile/2-m.y);
      if(!(i%512))yield i/entries.length;
    }
  }
  draw(ctx,cell,x,y,size,variant=cell.glyphSource?.glyphPresentedVariant??cell.glyphSource?.glyphVariant??cell.glyphVariant,clip){
    const index=(cell.glyphStart+variant*cell.glyphStride)%cell.glyphPool.length;
    const tile=cell.glyphTiles[index],m=tile.metric,s=size/this.dpr;
    let sx=tile.x,sy=tile.y,sw=m.w,sh=m.h,dx=x+(m.x-this.tile/2)*s,dy=y+(m.y-this.tile/2)*s,dw=m.w*s,dh=m.h*s;
    if(clip){
      const [cx,cy,cw,ch]=clip,left=Math.max(dx,cx),top=Math.max(dy,cy),right=Math.min(dx+dw,cx+cw),bottom=Math.min(dy+dh,cy+ch);
      if(right<=left||bottom<=top)return;
      sx+=(left-dx)/s;sy+=(top-dy)/s;sw=(right-left)/s;sh=(bottom-top)/s;dx=left;dy=top;dw=right-left;dh=bottom-top;
    }
    ctx.drawImage(this.canvas,sx,sy,sw,sh,dx,dy,dw,dh);
  }
  inkBounds(cell,size=cell.size){
    const key=cell.glyphPool+':'+size;let bounds=this.bounds.get(key);if(bounds)return bounds;
    let left=this.tile,top=this.tile,right=0,bottom=0;
    for(const glyph of cell.glyphPool){const m=this.metrics.get(glyph);left=Math.min(left,m.left);top=Math.min(top,m.top);right=Math.max(right,m.right);bottom=Math.max(bottom,m.bottom);}
    const s=size/this.dpr,pad=size*.5/this.dpr;
    bounds=[(this.tile/2-left)*s+pad,(this.tile/2-top)*s+pad,(right-this.tile/2)*s+pad,(bottom-this.tile/2)*s+pad];
    this.bounds.set(key,bounds);return bounds;
  }
}
