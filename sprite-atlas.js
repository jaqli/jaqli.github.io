import { createCanvas } from './canvas-factory.js?v=20261110-fps10';
import { alternatives, prepareGlyph } from './glyph-rhythm.js?v=20261111-air20';

// Two narrow monospace letters fit in approximately the old square tile area.
// Keep the original subpixel phase, color and vertical raster resolution.
export class SpriteAtlas {
  constructor(fontSize,dpr){
    this.dpr=dpr;this.fontSize=fontSize;this.tile=Math.ceil(fontSize*1.6*dpr);
    this.glyphWidth=Math.ceil(fontSize*.72*dpr);
    if(this.glyphWidth%2!==this.tile%2)this.glyphWidth++;
    this.canvas=createCanvas();
  }
  *prepare(cells,colorFor=cell=>cell.color){
    const unique=new Map(),columns=64,w=this.glyphWidth,h=this.tile;
    for(const cell of cells){
      prepareGlyph(cell);
      const color=colorFor(cell),key=cell.glyph+color;
      if(!unique.has(key))unique.set(key,{cell,color,index:unique.size});
      const {index}=unique.get(key);cell.tx=index%columns*w*2;cell.ty=Math.floor(index/columns)*h;
    }
    this.canvas.width=columns*w*2;this.canvas.height=Math.max(1,Math.ceil(unique.size/columns)*h);
    this.entries=unique.size;
    const ctx=this.canvas.getContext('2d');
    ctx.font=`500 ${this.fontSize*this.dpr}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    for(const {cell,color,index} of unique.values()){
      ctx.fillStyle=color;
      ctx.fillText(cell.glyph,cell.tx+w/2,cell.ty+h/2);
      ctx.fillText(alternatives[cell.glyph]||cell.glyph,cell.tx+w*1.5,cell.ty+h/2);
      if(!(index%512))yield index/unique.size;
    }
  }
  draw(ctx,cell,x,y,size,variant=cell.glyphSource?.glyphVariant??cell.glyphVariant){
    const w=this.glyphWidth,h=this.tile,width=w/this.dpr*size,height=h/this.dpr*size;
    ctx.drawImage(this.canvas,cell.tx+(variant?w:0),cell.ty,w,h,x-width/2,y-height/2,width,height);
  }
}
