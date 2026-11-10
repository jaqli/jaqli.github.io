import { waterSampleInterval } from './render-budget.js?v=20261110-type15';
import { paintScreen } from './screen-content.js?v=20261110-type15';
import { createCanvas } from './canvas-factory.js?v=20261110-fps10';
import { fontStep } from './ascii-renderer.js?v=20261110-type15';

function screenMatrix(quad,w,h,scale){
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=quad,dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
  const det=dx1*dy2-dx2*dy1,g=(dx3*dy2-dx2*dy3)/det,k=(dx1*dy3-dx3*dy1)/det;
  return `matrix3d(${(x1-x0+g*x1)/w},${(y1-y0+g*y1)/w},0,${g/(w*scale)},${(x3-x0+k*x3)/h},${(y3-y0+k*y3)/h},0,${k/(h*scale)},0,0,1,0,${x0*scale},${y0*scale},0,1)`;
}
export class LayeredScene {
  constructor(renderer,display){this.r=renderer;this.display=display;this.baseCtx=display.getContext('2d',{alpha:false});}
  async prepare(){
    const r=this.r,dpr=r.pixelRatio,s=r.scale,specs=[];
    const add=(id,box,extra={})=>{const [x,y,w,h]=box;const spec={id,x,y,w,h,width:Math.ceil(w*dpr),height:Math.ceil(h*dpr),...extra};specs.push(spec);return spec;};
    this.display.width=Math.round(r.width*dpr);this.display.height=Math.round(r.height*dpr);
    this.baseCtx.setTransform(dpr,0,0,dpr,0,0);this.baseCtx.drawImage(r.base,0,0,r.width,r.height);
    add('clouds',r.cloudBox);
    const top=Math.floor(Math.min(...r.water.map(cell=>cell.y))-r.fontSize);
    for(let i=0;i<3;i++)add('water-'+i,[0,top,r.width,r.height-top],{water:true});
    for(let i=0;i<r.screens.length;i++){
      // Retain the original 3× source texture for fine code and waveforms.
      const screen=r.screens[i];add('screen-'+i,[0,0,screen.width*s,screen.height*s],{width:screen.width*3,height:screen.height*3,matrix:screenMatrix(screen.quad,screen.width,screen.height,s),quad:screen.quad.map(p=>p.map(v=>v*s))});
    }
    // Restore the actual foreground curls above the complete right monitor.
    const [hx,hy,hw,hh]=r.headMaskBox,head=createCanvas();
    const x=Math.floor(hx*s),y=Math.floor(hy*s),w=Math.ceil((hx+hw)*s)-x,h=Math.ceil((hy+hh)*s)-y;
    head.width=Math.ceil(w*dpr);head.height=Math.ceil(h*dpr);
    // Copy existing hair pixels without stretching a fractional crop. Only the
    // source mask is scaled; the foreground glyphs retain the base's sharpness.
    const ctx=head.getContext('2d');ctx.drawImage(r.base,x*dpr,y*dpr,head.width,head.height,0,0,head.width,head.height);
    ctx.globalCompositeOperation='destination-in';ctx.drawImage(r.headMask,(hx*s-x)*dpr,(hy*s-y)*dpr,hw*s*dpr,hh*s*dpr);
    add('head',[x,y,w,h],{bitmap:await createImageBitmap(head)});
    for(const sprite of r.details){
      if(sprite.texture){const {canvas,x,y,width,height}=sprite.texture;add(sprite.shape.id,[x,y,width,height],{bitmap:await createImageBitmap(canvas),shape:sprite.shape});}
      else{
        const xs=sprite.cells.map(c=>c.sx*s),ys=sprite.cells.map(c=>c.sy*s),pad=r.fontSize*2;
        const x=Math.floor(Math.min(...xs)-pad),y=Math.floor(Math.min(...ys)-pad);
        add(sprite.shape.id,[x,y,Math.ceil(Math.max(...xs)-x+pad),Math.ceil(Math.max(...ys)-y+pad)]);
      }
    }
    for(const light of r.lights)add(light.emitter.id,[light.x,light.y,light.canvas.width/dpr,light.canvas.height/dpr]);
    this.specs=specs;
    // Replaced by the small display targets below; retain only the source data.
    for(const canvas of [r.canvas,r.cloudLayer,r.screenLayer,...r.screens.map(v=>v.canvas),...r.details.filter(v=>v.texture).map(v=>v.texture.canvas)])canvas.width=canvas.height=1;
    return specs;
  }
  attach(targets){
    const r=this.r,dpr=r.pixelRatio;

    for(const target of this.targets?.values()||[])target.canvas.width=target.canvas.height=1;
    this.targets=new Map(targets.map(({id,canvas})=>{
      const spec=this.specs.find(v=>v.id===id);canvas.width=spec.width;canvas.height=spec.height;
      const ctx=canvas.getContext('2d');
      ctx.setTransform(dpr,0,0,dpr,-spec.x*dpr,-spec.y*dpr);return[id,{canvas,ctx,spec}];
    }));
    const clouds=this.targets.get('clouds');r.cloudLayer=clouds.canvas;r.cloudCtx=clouds.ctx;
    for(let i=0;i<r.screens.length;i++){
      const {canvas,ctx}=this.targets.get('screen-'+i),screen=r.screens[i];screen.canvas=canvas;screen.ctx=ctx;ctx.setTransform(3,0,0,3,0,0);screen.frame=-1;
    }
    for(const light of r.lights){const target=this.targets.get(light.emitter.id);light.canvas=target.canvas;light.ctx=target.ctx;light.frame=null;}
    const water=this.specs.find(spec=>spec.water);
    this.waterBox=[water.x,water.y,water.w,water.h];
    this.waterStage ||= new OffscreenCanvas(1,1);
    this.waterStage.width=water.width;this.waterStage.height=water.height;
    this.waterCtx=this.waterStage.getContext('2d');
    this.waterCtx.setTransform(dpr,0,0,dpr,-water.x*dpr,-water.y*dpr);
    this.resetWater();this.cloudFrame=-1;
    // Cache the same Number precision as the size calculation; float32
    // rounding made unchanged fractional bins compare unequal every frame.
    this.ambientSizes=new Float64Array(r.dynamic.length).fill(-1);
  }
  resetWater(){this.waterIndices=[-1,-1,-1];}
  draw(time){
    const r=this.r,cloudFrame=Math.floor(time*30);
    // Slow cloud tint changes need fewer texture updates than water/wing motion.
    if(cloudFrame!==this.cloudFrame){r.drawClouds(time,false);this.cloudFrame=cloudFrame;}
    const waterFrames=[],waterIndex=Math.floor(time/waterSampleInterval);
    for(let index=waterIndex;index<=waterIndex+2;index++){
      const slot=index%3;if(this.waterIndices[slot]===index)continue;
      this.waterCtx.clearRect(...this.waterBox);r.drawWater(index*waterSampleInterval,this.waterCtx);
      waterFrames.push({index,bitmap:this.waterStage.transferToImageBitmap()});this.waterIndices[slot]=index;
    }
    for(const screen of r.screens)paintScreen(screen,time);
    for(const sprite of r.details){
      if(sprite.texture)continue;
      const {ctx,spec}=this.targets.get(sprite.shape.id);ctx.clearRect(spec.x,spec.y,spec.w,spec.h);
      r.drawDetails(time,[sprite],ctx);
    }
    r.drawLights(time,false);
    for(let i=0;i<r.dynamic.length;i++){
      const cell=r.dynamic[i],size=cell.kind==='hem'?cell.size:fontStep(cell.size+.05*Math.round(Math.sin(time*.75+cell.phase)));
      if(cell.kind!=='hem'&&size===this.ambientSizes[i])continue;
      this.ambientSizes[i]=size;
      const pad=r.fontSize,x=cell.x-pad,y=cell.y-pad;
      this.baseCtx.drawImage(r.base,x*r.pixelRatio,y*r.pixelRatio,pad*2*r.pixelRatio,pad*2*r.pixelRatio,x,y,pad*2,pad*2);
      const dy=cell.kind==='hem'?Math.sin(time*1.3)*.35*Math.max(0,Math.min(1,(cell.sy-617)/17))*r.scale:0;
      r.stamp(cell,cell.x,cell.y+dy,size,this.baseCtx);
    }
    return waterFrames;
  }
}
