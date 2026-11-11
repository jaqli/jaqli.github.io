import { birdPose, minFontSize } from './ascii-renderer.js?v=20261111-layout25';
import { SpriteAtlas } from './sprite-atlas.js?v=20261111-layout25';
import { glyphVariant } from './glyph-rhythm.js?v=20261111-layout25';
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

// Tiny transparent bird canvases move at display cadence. Their transforms do
// not wait for the full-room worker bitmap; only wing deformation repaints them.
export class FlightLayer {
  constructor(root) { this.root=root; this.sprites=[]; }
  configure({sprites,fontSize,cellW,cellH,scale,pixelRatio:dpr}) {
    this.scale=scale; this.cellW=cellW; this.cellH=cellH; this.dpr=dpr;
    this.spriteAtlas=new SpriteAtlas(fontSize,dpr);
    for(const _ of this.spriteAtlas.prepare(sprites.flatMap(s=>s.cells))){}
    this.atlas=this.spriteAtlas.canvas;
    this.sprites=sprites.map(({bird,cells})=>{
      const [cx,cy]=bird.center, pad=fontSize*2;
      const xs=cells.map(c=>(c.sx-cx)*scale), ys=cells.map(c=>(c.sy-cy)*scale);
      const x=Math.floor(Math.min(...xs)-pad), y=Math.floor(Math.min(...ys)-bird.lift*2*scale-pad);
      const width=Math.ceil(Math.max(...xs)-x+pad),height=Math.ceil(Math.max(...ys)-y+bird.lift*2*scale+pad);
      const canvas=document.createElement('canvas'); canvas.dataset.bird=bird.id;
      canvas.width=Math.ceil(width*dpr); canvas.height=Math.ceil(height*dpr);
      canvas.style.width=`${width}px`; canvas.style.height=`${height}px`;
      const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
      for (const cell of cells) {
        cell.x=(cell.sx-cx)*scale-x; cell.y=(cell.sy-cy)*scale-y;
        cell.wing=clamp(Math.abs(cell.sx-cx)/40)*clamp((cy-cell.sy)/18);
      }
      return {bird,cells,canvas,ctx,x,y,width,height,flap:NaN,scale:NaN};
    });
    this.root.replaceChildren(...this.sprites.map(s=>s.canvas));
  }
  draw(time) {
    for (const sprite of this.sprites) {
      const pose=birdPose(sprite.bird,time),{canvas,ctx,cells,x,y,width,height}=sprite;
      let lettersChanged=false;
      for(const cell of cells){const variant=glyphVariant(cell,time);if(variant!==cell.glyphVariant)lettersChanged=true;cell.glyphVariant=variant;}
      if (lettersChanged || !Number.isFinite(sprite.flap) || Math.abs(pose.flap-sprite.flap)>.001 || Math.abs(pose.scale-sprite.scale)>.002) {
        sprite.flap=pose.flap; sprite.scale=pose.scale;
        ctx.clearRect(0,0,width,height); ctx.fillStyle='#080d13';
        for (const cell of cells) {
          cell.dy=cell.y+pose.flap*cell.wing*this.scale;
          // Perspective changes the flock's spacing, never its minimum-sized
          // letters: cancel the scale applied by the composited bird canvas.
          cell.drawSize=minFontSize/pose.scale;
          ctx.fillRect(cell.x-this.cellW*.43*cell.drawSize,cell.dy-this.cellH*.4*cell.drawSize,
            this.cellW*.86*cell.drawSize,this.cellH*.8*cell.drawSize);
        }
        for (const cell of cells) {
          this.spriteAtlas.draw(ctx,cell,cell.x,cell.dy,cell.drawSize);
        }
      }
      // Match the scale of the cached glyphs exactly, including frames where
      // a subpixel perspective change does not require another rasterization.
      const a=pose.cos*sprite.scale,b=pose.sin*sprite.scale,c=-b,d=a;
      const tx=pose.position[0]*this.scale+a*x+c*y,ty=pose.position[1]*this.scale+b*x+d*y;
      canvas.style.transform=`matrix3d(${a},${b},0,0,${c},${d},0,0,0,0,1,0,${tx},${ty},0,1)`;
    }
  }
}
