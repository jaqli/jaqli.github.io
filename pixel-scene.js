import { birds, birdPose, inside, waterAreas, screenOccluder, hemArea } from './scene-objects.js?v=20261111-hybrid36';
import { detailShapes, detailPoint, eyeOpening, cloudSpeed, emitters } from './scene-details.js?v=20261111-flow28';
import { screens, paintScreen } from './screen-content.js?v=20261111-hybrid36';
import { drawQuad } from './scene-geometry.js?v=20261110-fps10';
import { faceLight, lampColor } from './scene-lights.js?v=20261111-flow28';
import { rippleSources } from './water-ripples.js?v=20261111-flow28';

const W=1536,H=1024;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const yieldFrame=()=>globalThis.scheduler?.yield?scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
function surface(w,h){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;}
function bounds(polygon,pad=0){const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);const x=Math.floor(Math.min(...xs))-pad,y=Math.floor(Math.min(...ys))-pad;return [x,y,Math.ceil(Math.max(...xs))-x+pad+1,Math.ceil(Math.max(...ys))-y+pad+1];}
function near(x,y,polygon){
  if(inside(x,y,polygon))return true;
  return polygon.some(([ax,ay],i)=>{const [bx,by]=polygon[(i+1)%polygon.length],dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));return (x-ax-t*dx)**2+(y-ay-t*dy)**2<4;});
}
const sky=(r,g,b)=>g-r>26&&b-r>33;

// Original pixel artwork is the room. ASCII is confined to the three displays.
// Native-size textures stay fixed through resize; no room-sized glyph atlases.
export class PixelScene {
  static async create(image,canvas,onProgress=()=>{}){
    const scene=new PixelScene(image,canvas);
    for(const progress of scene.prepare()){onProgress(progress);await yieldFrame();}
    return scene;
  }
  constructor(image,canvas){
    this.image=image;this.canvas=canvas;canvas.width=W;canvas.height=H;
    canvas.dataset.renderer='pixel';canvas.dataset.raster='native';
    this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;
    this.base=surface(W,H);const ctx=this.base.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,W,H);
    this.original=ctx.getImageData(0,0,W,H);this.plate=new ImageData(this.original.data.slice(),W,H);
    this.birds=[];this.details=[];this.clouds=[];this.lights=[];this.lastScreen=-1;this.lastCloud=-1;
  }
  cut(polygon,accept,erase=true,pad=0,background){
    const [x,y,w,h]=bounds(polygon,pad),canvas=surface(w,h),ctx=canvas.getContext('2d'),bitmap=ctx.createImageData(w,h);
    const source=this.original.data,plate=this.plate.data;
    for(let py=0;py<h;py++)for(let px=0;px<w;px++){
      const sx=x+px,sy=y+py,i=(sy*W+sx)*4,j=(py*w+px)*4;
      if(!(pad?near(sx,sy,polygon):inside(sx,sy,polygon))||!accept(source[i],source[i+1],source[i+2],sx,sy))continue;
      for(let c=0;c<3;c++)bitmap.data[j+c]=source[i+c];bitmap.data[j+3]=255;
      if(erase){
        const left=(sy*W+Math.max(0,x-5))*4,right=(sy*W+Math.min(W-1,x+w+5))*4,mix=px/w;
        for(let c=0;c<3;c++)plate[i+c]=background?source[(background[1]*W+background[0])*4+c]:source[left+c]*(1-mix)+source[right+c]*mix;
      }
    }
    ctx.putImageData(bitmap,0,0);return {canvas,x,y,w,h};
  }
  *prepare(){
    for(const bird of birds){
      // Remove the entire old silhouette, including blue shaded feathers and
      // antialiased outlines which the ASCII color threshold used to miss.
      const [x,y,w,h]=bounds(bird.points,14),source=this.original.data;
      const skyColor=(sx,sy)=>{
        const sum=[0,0,0];let count=0;
        for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){const i=((sy+dy)*W+sx+dx)*4;if(!sky(source[i],source[i+1],source[i+2])||source[i+1]<178)continue;for(let c=0;c<3;c++)sum[c]+=source[i+c];count++;}
        return count?sum.map(n=>n/count):[123,202,216];
      };
      const corners=[skyColor(x,y),skyColor(x+w,y),skyColor(x,y+h),skyColor(x+w,y+h)];
      const backdrop=(col,row,c)=>{const u=clamp((col-x)/w),v=clamp((row-y)/h);return (corners[0][c]*(1-u)+corners[1][c]*u)*(1-v)+(corners[2][c]*(1-u)+corners[3][c]*u)*v;};
      this.birds.push({...this.cut(bird.points,(r,g,b,sx,sy)=>[r,g,b].some((v,c)=>Math.abs(v-backdrop(sx,sy,c))>18),false,3),bird});
      for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){
        const i=(row*W+col)*4,u=(col-x)/w,v=(row-y)/h,edge=smooth(Math.min(col-x,x+w-1-col,row-y,y+h-1-row)/5);
        for(let c=0;c<3;c++){const clean=(corners[0][c]*(1-u)+corners[1][c]*u)*(1-v)+(corners[2][c]*(1-u)+corners[3][c]*u)*v;this.plate.data[i+c]=source[i+c]*(1-edge)+clean*edge;}
      }
    }
    yield .12;
    const hem={id:'hem',kind:'paper',anchor:[830,615],length:24,phase:0,polygon:hemArea};
    for(const shape of [...detailShapes,hem]){
      const accept=(r,g,b)=>shape.kind==='eye'?g-r>45&&b-r>45&&g>125:shape.kind==='leaves'?g>r*1.2&&g>b*.9&&g>40:true;
      this.details.push({...this.cut(shape.polygon,accept,true,0,shape.background),shape});
      yield .12+.28*this.details.length/(detailShapes.length+1);
    }
    this.head=this.cut(screenOccluder,(r,g,b)=>Math.max(r,g,b)<135||(r>g*1.08&&r>b*1.5),false,2);
    for(const emitter of emitters){
      const lamp=emitter.kind==='lamp';
      const sprite=this.cut(emitter.polygon,(r,g,b)=>!lamp||(g>120&&b>130),false);
      const mask=surface(sprite.w,sprite.h);mask.getContext('2d').drawImage(sprite.canvas,0,0);
      const ctx=sprite.canvas.getContext('2d');
      this.lights.push({...sprite,mask,ctx,emitter,plane:surface(emitter.plane?.width||sprite.w,emitter.plane?.height||sprite.h)});
      if(!lamp){const p=this.plate.data;for(let y=sprite.y;y<sprite.y+sprite.h;y++)for(let x=sprite.x;x<sprite.x+sprite.w;x++)if(inside(x,y,emitter.polygon)){const i=(y*W+x)*4;p[i]=12;p[i+1]=25;p[i+2]=33;}}
    }
    this.base.getContext('2d').putImageData(this.plate,0,0);yield .44;
    // Sample only unobstructed sky. A full window crop contains wires, plant
    // pots and furniture; stretching those gaps creates moving horizontal bars.
    const cloudWindows=[{box:[604,145,180,230]},{box:[870,140,360,200]}];
    for(const window of cloudWindows){this.clouds.push(this.cloud(window));yield .44+.35*this.clouds.length/cloudWindows.length;}
    this.screenLayer=surface(420,190);this.screenCtx=this.screenLayer.getContext('2d');
    const quads=[screens[0].quad,[[335,407],[438,413],[440,481],[336,480]],[[640,435],[730,441],[734,501],[644,495]]];
    this.screens=screens.map((screen,i)=>{const canvas=surface(screen.width*3,screen.height*3),ctx=canvas.getContext('2d');ctx.scale(3,3);return {...screen,quad:quads[i],fontSize:4,fontWeight:700,canvas,ctx};});
    this.water=surface(W/2,H/2);this.waterCtx=this.water.getContext('2d');
    this.waterMask=surface(W/2,H/2);const mask=this.waterMask.getContext('2d'),bitmap=mask.createImageData(W/2,H/2),source=this.original.data;
    this.glints=[];
    for(let y=218;y<H/2;y++){
     for(let x=0;x<W/2;x++){
      const sx=x*2,sy=y*2;if(!waterAreas.some(p=>inside(sx,sy,p)))continue;
      const i=(sy*W+sx)*4,r=source[i],g=source[i+1],b=source[i+2];
      if(!((g>r*.87&&b>r*.8&&g>65)||Math.min(r,g,b)>150))continue;
      bitmap.data[(y*W/2+x)*4+3]=255;
      if(r+g+b>590&&((x*7+y*11)%53===0))this.glints.push({x,y,w:2+(x%6),phase:x*.17+y*.13});
     }
     if((y-218)%24===0)yield .79+.2*(y-218)/(H/2-218);
    }
    mask.putImageData(bitmap,0,0);
    // Pixel buffers are needed only for extraction, never read back each frame.
    this.original=null;this.plate=null;yield 1;
  }
  cloud(window){
    const [x0,y0,w,h]=window.box,texture=surface(w,h),fade=surface(w,h),layer=surface(w,h);
    const tc=texture.getContext('2d'),fc=fade.getContext('2d'),colors=tc.createImageData(w,h),alpha=fc.createImageData(w,h),source=this.plate.data;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=((y+y0)*W+x+x0)*4,j=(y*w+x)*4;
        for(let c=0;c<3;c++)colors.data[j+c]=source[i+c];colors.data[j+3]=255;
        const edge=smooth(Math.min(x/24,(w-1-x)/24,y/24,(h-1-y)/24));
        alpha.data[j+3]=Math.round(190*edge);
      }
      for(let edge=0;edge<24;edge++)for(let c=0;c<3;c++){const a=(y*w+edge)*4+c,b=(y*w+w-1-edge)*4+c,mean=(colors.data[a]+colors.data[b])/2,amount=(1-edge/24)**2;colors.data[a]=colors.data[a]*(1-amount)+mean*amount;colors.data[b]=colors.data[b]*(1-amount)+mean*amount;}
    }
    tc.putImageData(colors,0,0);fc.putImageData(alpha,0,0);return {x:x0,y:y0,w,h,texture,fade,layer,ctx:layer.getContext('2d')};
  }
  async resizeAsync(width,height,onProgress=()=>{}){this.width=width;this.height=height;onProgress(1);}
  drawClouds(time){
    const frame=Math.floor(time*30);
    for(const c of this.clouds){
      if(frame!==this.lastCloud){const shift=Math.floor(time*cloudSpeed)%c.w;c.ctx.globalCompositeOperation='copy';c.ctx.drawImage(c.texture,shift,0);c.ctx.globalCompositeOperation='source-over';c.ctx.drawImage(c.texture,shift-c.w,0);c.ctx.globalCompositeOperation='destination-in';c.ctx.drawImage(c.fade,0,0);}
      this.ctx.drawImage(c.layer,c.x,c.y);
    }
    this.lastCloud=frame;
  }
  drawWater(time){
    const ctx=this.waterCtx;ctx.clearRect(0,0,W/2,H/2);ctx.globalCompositeOperation='source-over';
    for(const [index,source] of rippleSources.entries()){
      const clock=time+source.phase,latest=Math.floor(clock/source.period),count=Math.ceil(source.life/source.period);
      for(let n=0;n<count;n++){
        const age=clock-(latest-n)*source.period;if(age<0||age>=source.life)continue;
        const fade=smooth(age/.5)*(1-smooth((age/source.life-.45)/.55)),r=age*source.speed/2;
        if(fade<.01)continue;
        ctx.strokeStyle=`rgba(255,243,181,${fade*.27})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(source.x/2,source.y/2,r*source.aspect[0],r/source.aspect[1],0,0,Math.PI*2);ctx.stroke();
        if(r>8){ctx.strokeStyle=`rgba(38,105,128,${fade*.16})`;ctx.beginPath();ctx.ellipse(source.x/2,source.y/2,(r-4)*source.aspect[0],(r-4)/source.aspect[1],0,index*.7,index*.7+Math.PI*1.7);ctx.stroke();}
      }
    }
    for(const p of this.glints){const strength=Math.max(0,Math.sin(time*2+p.phase))**8*.3;if(strength<.02)continue;ctx.fillStyle=`rgba(255,249,203,${strength})`;ctx.fillRect(p.x,p.y,p.w,1);}
    ctx.globalCompositeOperation='destination-in';ctx.drawImage(this.waterMask,0,0);ctx.globalCompositeOperation='source-over';
    this.ctx.drawImage(this.water,0,0,W,H);
  }
  drawScreens(time){
    const frame=Math.floor(time*24);
    if(frame!==this.lastScreen){
      const ctx=this.screenCtx;ctx.clearRect(0,0,420,190);ctx.save();ctx.translate(-325,-335);
      for(const screen of this.screens){paintScreen(screen,time);drawQuad(ctx,screen.canvas,screen.quad,screen.width,screen.height);}
      ctx.restore();this.lastScreen=frame;
    }
    this.ctx.drawImage(this.screenLayer,325,335);
    this.ctx.drawImage(this.head.canvas,this.head.x,this.head.y);
  }
  drawDetail(sprite,time){
    const {canvas,x,y,w,h,shape}=sprite,ctx=this.ctx;
    if(shape.kind==='paper'||shape.kind==='leaves'){
      for(let row=0;row<h;row+=3){const p=detailPoint(shape,x,y+row,time);ctx.drawImage(canvas,0,row,w,Math.min(3,h-row),p[0],p[1],w,Math.min(3,h-row));}
      return;
    }
    const [ax,ay]=shape.anchor,p=detailPoint(shape,ax,ay,time),px=detailPoint(shape,ax+1,ay,time),py=detailPoint(shape,ax,ay+1,time);
    ctx.save();ctx.translate(...p);ctx.transform(px[0]-p[0],px[1]-p[1],py[0]-p[0],py[1]-p[1],0,0);ctx.drawImage(canvas,x-ax,y-ay);ctx.restore();
  }
  drawBird(sprite,time){
    const {bird,canvas,x,y,w,h}=sprite,pose=birdPose(bird,time),ctx=this.ctx,[cx,cy]=bird.center;
    ctx.save();ctx.translate(...pose.position);ctx.transform(pose.cos*pose.scale,pose.sin*pose.scale,-pose.sin*pose.scale,pose.cos*pose.scale,0,0);
    for(let col=0;col<w;col+=2){const wing=clamp((Math.abs(x+col-cx)-5)/35);ctx.drawImage(canvas,col,0,Math.min(2,w-col),h,x+col-cx,y-cy+pose.flap*wing,Math.min(2,w-col),h);}
    ctx.restore();
  }
  drawLights(time){
    for(const light of this.lights){
      const {emitter,ctx,w,h}=light;
      if(emitter.kind==='lamp'){
        ctx.globalCompositeOperation='copy';ctx.drawImage(light.mask,0,0);ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=.55;ctx.fillStyle=`rgb(${lampColor(time).map(Math.round).join(' ')})`;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
        this.ctx.drawImage(light.canvas,light.x,light.y);continue;
      }
      const c=light.plane.getContext('2d'),pw=light.plane.width,ph=light.plane.height;c.fillStyle='#0c1921';c.fillRect(0,0,pw,ph);
      if(emitter.kind==='red-eye'){
        const blink=eyeOpening(time,.8);c.fillStyle='#ff5943';c.fillRect(Math.round(pw*.23+Math.sin(time*.8)),Math.round(ph*.52-3*blink),7,Math.max(1,Math.round(6*blink)));
        drawQuad(this.ctx,light.plane,emitter.polygon,pw,ph);continue;
      }
      for(let y=1;y<ph;y+=2)for(let x=1;x<pw;x+=2){const v=faceLight(emitter,x/pw,y/ph,time);if(v<.06)continue;c.fillStyle=`rgb(${emitter.tint.map(n=>Math.round(n*v)).join(' ')})`;c.fillRect(x,y,2,2);}
      drawQuad(this.ctx,light.plane,emitter.polygon,pw,ph);
    }
  }
  draw(time){
    const ctx=this.ctx;ctx.drawImage(this.base,0,0);this.drawClouds(time);this.drawWater(time);this.drawScreens(time);
    for(const sprite of this.details)this.drawDetail(sprite,time);
    this.drawLights(time);for(const sprite of this.birds)this.drawBird(sprite,time);
  }
  dispose(){for(const value of Object.values(this))if(value instanceof HTMLCanvasElement)value.width=value.height=1;this.details=[];this.birds=[];this.clouds=[];this.lights=[];}
}
