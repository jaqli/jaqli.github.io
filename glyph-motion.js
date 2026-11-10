import { GlyphAtlas } from './glyph-atlas.js?v=20261111-glyph16';
import { createCanvas } from './canvas-factory.js?v=20261110-fps10';

// Stay in the same tonal family. Preserve each cell's source color and size.
const alternatives={'.':',',',':'.',':':';',';':':','-':'~','=':'+', '+':'=','*':'+','x':'o','o':'x','%':'#','#':'%','M':'W','W':'M','@':'B'};
const random=i=>{const n=Math.sin(i*127.1+1729)*43758.5453;return n-Math.floor(n);};
export const glyphUpdateLimit=24;

// A shuffled sweep changes letters throughout the room, never a scanning row.
// Repaint only a small ink rectangle and its intersecting neighbors, so large
// letters retain their full strokes without erasing adjacent cells.
export class GlyphMotion {
  constructor(renderer){
    this.r=renderer;this.enabled=true;this.cursor=0;this.time=0;this.credit=0;
    this.base=renderer.base.getContext('2d');this.cloud=renderer.cloudBase.getContext('2d');
    this.palette=new GlyphAtlas(renderer.fontSize,Math.max(2,renderer.pixelRatio),4096);
    this.scratch=createCanvas();
    this.scratch.width=Math.ceil((renderer.fontSize*.9+2/renderer.pixelRatio+2)*renderer.pixelRatio);
    this.scratch.height=Math.ceil((renderer.fontSize*1.3+2/renderer.pixelRatio+2)*renderer.pixelRatio);
    this.paint=this.scratch.getContext('2d');
    this.order=new Uint32Array(renderer.cells.length);let length=0;
    for(let i=0;i<renderer.cells.length;i++)if(renderer.cells[i].glyphLayer!=='dynamic'&&!renderer.cells[i].water)this.order[length++]=i;
    this.order=this.order.subarray(0,length);
    for(let i=this.order.length-1;i>0;i--){const j=Math.floor(random(i)*(i+1));[this.order[i],this.order[j]]=[this.order[j],this.order[i]];}
  }
  update(time,extra=[],present){
    const dt=Math.max(0,Math.min(.1,time-this.time));this.time=time;
    if(!this.enabled)return [];
    this.credit=Math.min(glyphUpdateLimit,this.credit+dt*1600);
    const count=Math.floor(this.credit),dirty=[],changed=[];this.credit-=count;
    for(let i=0;i<count;i++){
      const cell=this.r.cells[this.order[this.cursor]];this.cursor=(this.cursor+1)%this.order.length;
      cell.liveGlyph=cell.liveGlyph ? null : alternatives[cell.glyph];
      changed.push(cell);
    }
    const patches=[...changed.map(cell=>this.patch(cell)),...extra.map(cell=>this.patch(cell,'base'))];
    // Finish atlas writes before drawing from it. Interleaving fillText and
    // drawImage repeatedly uploads the atlas and stalls the rendering pipeline.
    for(let start=0;start<patches.length;){
      let end=start,references=0;const tiles=new Map();
      while(end<patches.length&&references+patches[end].neighbors.length<=3072)references+=patches[end++].neighbors.length;
      for(let i=start;i<end;i++)for(const cell of patches[i].neighbors)if(!tiles.has(cell))tiles.set(cell,this.palette.get(cell.liveGlyph||cell.glyph,cell.rgb));
      for(let i=start;i<end;i++){
        const patch=patches[i],{cloud,box,neighbors}=patch,[x,y,w,h]=box,ctx=cloud?this.cloud:this.base,dpr=this.r.pixelRatio;
        const paint=this.paint;paint.setTransform(dpr,0,0,dpr,-x*dpr,-y*dpr);
        paint.clearRect(x,y,this.scratch.width/dpr,this.scratch.height/dpr);
        if(!cloud){paint.fillStyle='#080d13';paint.fillRect(x,y,w,h);}
        for(const cell of neighbors)this.palette.drawTile(paint,tiles.get(cell),cell.x,cell.y,cell.size);
        // The worker presents directly to its persistent display. Keep its
        // large base texture immutable; only the Canvas2D fallback needs it.
        if(cloud||!present){
          if(cloud)ctx.clearRect(...box);
          ctx.drawImage(this.scratch,0,0,w*dpr,h*dpr,x,y,w,h);
        }
        if(!cloud){dirty.push(box);present?.(this.scratch,patch);}
      }
      start=end;
    }
    return dirty;
  }
  patch(cell,layer=cell.glyphLayer){
    const r=this.r,cloud=layer==='cloud',neighbors=[],dynamic=[];
    const rx=r.fontSize*.45+1/r.pixelRatio,ry=r.fontSize*.65+1/r.pixelRatio;
    const x=Math.floor(cell.x-rx),y=Math.floor(cell.y-ry),w=Math.ceil(cell.x+rx)-x,h=Math.ceil(cell.y+ry)-y;
    const left=Math.max(0,Math.floor((x-rx)/r.cellW)),right=Math.min(r.columns-1,Math.floor((x+w+rx)/r.cellW));
    const top=Math.max(0,Math.floor((y-ry)/r.cellH)),bottom=Math.min(r.rows-1,Math.floor((y+h+ry)/r.cellH));
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
      const neighbor=r.cells[row*r.columns+col];
      if(!cloud&&neighbor.glyphLayer==='dynamic')dynamic.push(neighbor);
      if(neighbor.glyphLayer!==layer)continue;
      neighbors.push(neighbor);
    }
    return {cloud,box:[x,y,w,h],neighbors,dynamic};
  }
}
