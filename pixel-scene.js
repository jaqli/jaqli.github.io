import { birds, birdPose, inside, waterAreas, screenOccluder, hemArea } from './scene-objects.js?v=20261111-sky43';
import { exteriorField, reflectedSample } from './pixel-surface.js?v=20261111-surface37';
import { detailShapes, detailPoint, eyeOpening, emitters } from './scene-details.js?v=20261111-edge48';
import { screens, paintScreen } from './screen-content.js?v=20261111-detail39';
import { drawQuad } from './scene-geometry.js?v=20261110-fps10';
import { faceLight } from './scene-lights.js?v=20261111-flow28';
import { rippleSources } from './water-ripples.js?v=20261111-flow28';

import { SceneExtras } from './scene-extras.js?v=20261112-edge50';
import { SceneAdditions, additionalShapes } from './scene-additions.js?v=20261111-edge48';
import { SceneTime } from './scene-time.js?v=20261111-edge48';
import { prepareSky, drawSkyLayer } from './scene-sky.js?v=20261112-pixel51';
import { SceneBeacon } from './scene-beacon.js?v=20261111-layer44';
import { cleanBirdMatte } from './scene-bird-matte.js?v=20261112-edge50';

const W=1536,H=1024,PIXEL_UNIT=1.5,GRID_W=Math.round(W/PIXEL_UNIT),GRID_H=Math.round(H/PIXEL_UNIT);
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
  static async create(image,canvas,onProgress=()=>{},screenCanvas=null){
    const scene=new PixelScene(image,canvas,screenCanvas);
    for(const progress of scene.prepare()){onProgress(progress);await yieldFrame();}
    return scene;
  }
  constructor(image,canvas,screenCanvas=null){
    this.image=image;this.canvas=canvas;canvas.width=W;canvas.height=H;
    canvas.dataset.renderer='pixel';canvas.dataset.raster='native';canvas.dataset.pixelUnit=String(PIXEL_UNIT);
    this.pixelGrid=surface(GRID_W,GRID_H);this.gridCtx=this.pixelGrid.getContext('2d',{alpha:false});this.gridCtx.imageSmoothingEnabled=false;
    this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;
    this.base=surface(W,H);const ctx=this.base.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,W,H);
    this.original=ctx.getImageData(0,0,W,H);this.plate=new ImageData(this.original.data.slice(),W,H);
    this.birds=[];this.details=[];this.clouds=[];this.lights=[];this.lastScreen=-1;
    this.screenCanvas=screenCanvas;
    if(screenCanvas){
      screenCanvas.width=1260;screenCanvas.height=570;
      Object.assign(screenCanvas.style,{left:`${325/W*100}%`,top:`${335/H*100}%`,width:`${420/W*100}%`,height:`${190/H*100}%`});
      this.displayCtx=screenCanvas.getContext('2d');
    }
  }
  cut(polygon,accept,erase=true,pad=0,background,waterRepair=false,softEdge=false,backgroundKey=null,repairBackdrop=null){
    const [x,y,w,h]=bounds(polygon,pad),canvas=surface(w,h),ctx=canvas.getContext('2d'),bitmap=ctx.createImageData(w,h);
    const source=this.original.data,plate=this.plate.data;
    let coverage,repairCoverage;
    if(softEdge){
      // A moving sprite contains only the object's silhouette. Do not attach
      // an eight-pixel feather of surrounding water/paper to its texture.
      // One native pixel protects the traced rim; subpixel motion is sampled
      // later, when drawing the whole object.
      ctx.fillStyle=ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.lineJoin='round';ctx.beginPath();
      polygon.forEach(([sx,sy],i)=>i?ctx.lineTo(sx-x+.5,sy-y+.5):ctx.moveTo(sx-x+.5,sy-y+.5));ctx.closePath();ctx.fill();ctx.stroke();
      const core=ctx.getImageData(0,0,w,h).data;coverage=new Uint8Array(w*h);
      for(let i=0;i<coverage.length;i++)coverage[i]=core[i*4+3]>32?255:0;

    }
    if(coverage&&backgroundKey){
      // Trim only background connected to the exterior. Opaque inner details
      // (such as the duck's dark pupil and gray float) cannot become holes.
      const outside=new Uint8Array(w*h),queue=[];
      const visit=n=>{if(n<0||n>=outside.length||outside[n])return;const sx=x+n%w,sy=y+Math.floor(n/w),i=(sy*W+sx)*4;if(!coverage[n]||backgroundKey(source[i],source[i+1],source[i+2],sx,sy)){outside[n]=1;queue.push(n);}};
      for(let px=0;px<w;px++){visit(px);visit((h-1)*w+px);}for(let py=0;py<h;py++){visit(py*w);visit(py*w+w-1);}
      for(let q=0;q<queue.length;q++){const n=queue[q];if(n%w)visit(n-1);if(n%w<w-1)visit(n+1);visit(n-w);visit(n+w);}
      for(let n=0;n<coverage.length;n++)if(outside[n])coverage[n]=0;
    }
    for(let py=0;py<h;py++)for(let px=0;px<w;px++){
      const sx=x+px,sy=y+py,i=(sy*W+sx)*4,j=(py*w+px)*4;
      const alpha=coverage?coverage[py*w+px]:(pad?near(sx,sy,polygon):inside(sx,sy,polygon))?255:0;
      if(!alpha||!accept(source[i],source[i+1],source[i+2],sx,sy))continue;
      for(let c=0;c<3;c++)bitmap.data[j+c]=source[i+c];bitmap.data[j+3]=alpha;
      if(erase){
        if(background)for(let c=0;c<3;c++)plate[i+c]=source[(background[1]*W+background[0])*4+c];
      }
    }
    if(erase&&waterRepair&&softEdge){
      // Repair only a narrow rim around the final extracted alpha. Preserve
      // holes (e.g. the cable loop) and any background excluded by its matte.
      const empty=new Uint8Array(w*h);for(let n=0;n<empty.length;n++)empty[n]=bitmap.data[n*4+3]?0:1;
      const nearest=exteriorField(empty,w,h);repairCoverage=new Uint8Array(w*h);
      for(let n=0;n<empty.length;n++){
        const edge=nearest[n];if(edge<0)continue;
        const distance=Math.hypot(n%w-edge%w,Math.floor(n/w)-Math.floor(edge/w));
        repairCoverage[n]=Math.round(255*clamp(3-distance));
      }
    }
    if(erase&&!background){
      const margin=12,pw=w+margin*2,ph=h+margin*2,mask=new Uint8Array(pw*ph);
      for(let py=0;py<h;py++)for(let px=0;px<w;px++)mask[(py+margin)*pw+px+margin]=(repairCoverage?repairCoverage[py*w+px]:bitmap.data[(py*w+px)*4+3])?1:0;
      // Exclude neighboring prop frames from replacement water.
      // This changes repair donors only, never the original scenery outside it.
      const donors=waterRepair?mask.slice():mask;
      if(waterRepair)for(let py=0;py<ph;py++)for(let px=0;px<pw;px++){
        const sx=clamp(x+px-margin,0,W-1),sy=clamp(y+py-margin,0,H-1),i=(sy*W+sx)*4,r=source[i],g=source[i+1],b=source[i+2];
        const kind=this.waterDonorField?.[sy*W+sx]||0,coolWater=g>30&&b>40&&g-r>8&&b-r>14&&b<g*2;
        if(kind===1||!(kind===2||coolWater))donors[py*pw+px]=1;
      }
      const field=exteriorField(donors,pw,ph);
      for(let py=0;py<h;py++)for(let px=0;px<w;px++){
        const index=(py+margin)*pw+px+margin;if(!mask[index])continue;
        const sample=waterRepair&&field[index]>=0?field[index]:reflectedSample(index,field,donors,pw,ph),sx=clamp(x+sample%pw-margin,0,W-1),sy=clamp(y+Math.floor(sample/pw)-margin,0,H-1),i=((y+py)*W+x+px)*4,j=(sy*W+sx)*4;
        const alpha=(repairCoverage?repairCoverage[py*w+px]:bitmap.data[(py*w+px)*4+3])/255;
        const replacement=repairBackdrop?.(x+px,y+py,source,!!bitmap.data[(py*w+px)*4+3]);
        for(let c=0;c<3;c++)plate[i+c]=source[i+c]*(1-alpha)+(replacement?replacement[c]:source[j+c])*alpha;
      }
    }
    ctx.putImageData(bitmap,0,0);return {canvas,x,y,w,h};
  }
  *prepare(){
    // Water repair may use dark water and pale reflections, but never another
    // object's frame. Cache spatial donor classes once, before any extraction.
    const donors=surface(W,H),dc=donors.getContext('2d');
    const fill=p=>{dc.beginPath();p.forEach(([x,y],i)=>i?dc.lineTo(x,y):dc.moveTo(x,y));dc.closePath();dc.fill();};
    dc.fillStyle='#fff';for(const p of waterAreas)fill(p);
    dc.fillStyle=dc.strokeStyle='#f00';dc.lineWidth=4;dc.lineJoin='round';
    for(const shape of [...detailShapes,...additionalShapes].filter(s=>s.kind==='float')){fill(shape.polygon);dc.stroke();}
    const classes=dc.getImageData(0,0,W,H).data;this.waterDonorField=new Uint8Array(W*H);
    for(let n=0;n<this.waterDonorField.length;n++)this.waterDonorField[n]=classes[n*4]>127?(classes[n*4+1]>127?2:1):0;
    donors.width=donors.height=1;
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
      const sprite={...this.cut(bird.points,(r,g,b,sx,sy)=>[r,g,b].some((v,c)=>Math.abs(v-backdrop(sx,sy,c))>18),false,3),bird};
      cleanBirdMatte(sprite);this.birds.push(sprite);
      for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){
        const i=(row*W+col)*4,u=(col-x)/w,v=(row-y)/h,edge=smooth(Math.min(col-x,x+w-1-col,row-y,y+h-1-row)/5);
        for(let c=0;c<3;c++){const clean=(corners[0][c]*(1-u)+corners[1][c]*u)*(1-v)+(corners[2][c]*(1-u)+corners[3][c]*u)*v;this.plate.data[i+c]=source[i+c]*(1-edge)+clean*edge;}
      }
    }
    yield .12;
    const hem={id:'hem',kind:'paper',anchor:[830,615],length:24,phase:0,polygon:hemArea};
    for(const shape of [...detailShapes.filter(shape=>shape.id!=='leaves'),...additionalShapes,hem]){
      const accept=(r,g,b)=>shape.id==='paper-cream'?!(g-r>15&&b-r>20):shape.kind==='eye'?g-r>45&&b-r>45&&g>125:shape.kind==='leaves'?g>r*1.2&&g>b*.9&&g>40:true;
      const soft=shape.kind==='float'||shape.kind==='paper'||shape.kind==='hinge';
      const backgroundKey=shape.id==='duck'?(r,g,b,x,y)=>y<834?g>45&&g-r>15&&b-r>25:g>125&&g-r>24&&b-r>32:null;
      // The paper behind the duck is a fixed occluder, not blue water. Keep its
      // visible edge and continue its short corner when the head moves down.
      const backdrop=shape.id==='duck'?(x,y,source,object)=>{
        if(y>=789&&y<=802&&x>=329&&x<=357){const i=(y*W+(object?360:x))*4;return source.subarray(i,i+3);}
        if(y<782||y>809||x>332-(y-784)*1.05)return null;
        const i=(y*W+(object?Math.min(x,302):x))*4;
        return source.subarray(i,i+3);
      }:null;
      this.details.push({...this.cut(shape.polygon,accept,true,soft?8:0,shape.background,shape.waterRepair,soft,backgroundKey,backdrop),shape});
      yield .12+.28*this.details.length/(detailShapes.length+additionalShapes.length);
    }
    this.head=this.cut(screenOccluder,(r,g,b)=>Math.max(r,g,b)<135||(r>g*1.08&&r>b*1.5),false,2);
    this.beacon=new SceneBeacon(this);
    for(const emitter of emitters.filter(e=>e.kind!=='lamp')){
      const sprite=this.cut(emitter.polygon,()=>true,false);
      this.lights.push({...sprite,emitter,plane:surface(emitter.plane?.width||sprite.w,emitter.plane?.height||sprite.h)});
      const p=this.plate.data;for(let y=sprite.y;y<sprite.y+sprite.h;y++)for(let x=sprite.x;x<sprite.x+sprite.w;x++)if(inside(x,y,emitter.polygon)){const i=(y*W+x)*4;p[i]=12;p[i+1]=25;p[i+2]=33;}
    }
    // A small cached mask dims only the pendant's glowing underside. Its dark
    // shade and the room stay still; the shared clock handles pause/background.
    this.ceilingLamp=this.cut([[1028,44],[1169,44],[1169,80],[1028,80]],
      (r,g,b)=>r>155&&g>95&&r>=g*.95&&r>=b,false);
    const bulb=this.ceilingLamp.canvas.getContext('2d');bulb.globalCompositeOperation='source-atop';
    bulb.fillStyle='#000';bulb.fillRect(0,0,this.ceilingLamp.w,this.ceilingLamp.h);bulb.globalCompositeOperation='source-over';
    this.extras=new SceneExtras();let extraStep=0;
    for(const _ of this.extras.prepare(this))yield .4+.004*++extraStep;
    this.additions=new SceneAdditions();let additionStep=0;
    for(const _ of this.additions.prepare(this))yield .416+.024*++additionStep/3;
    this.base.getContext('2d').putImageData(this.plate,0,0);yield .44;
    yield* this.prepareSky();
    this.screenLayer=surface(1260,570);this.screenCtx=this.screenLayer.getContext('2d');this.screenCtx.scale(3,3);
    const quads=[screens[0].quad,[[335,407],[438,413],[440,481],[336,480]],[[640,435],[730,441],[734,501],[644,495]]];
    this.screens=screens.map((screen,i)=>{const canvas=surface(screen.width*3,screen.height*3),ctx=canvas.getContext('2d');ctx.scale(3,3);return {...screen,quad:quads[i],fontSize:[5.6,6.2,5.8][i],fontWeight:500,canvas,ctx};});
    this.monitorPaper=this.details.find(sprite=>sprite.shape.id==='paper-monitor');
    this.monitorPaperOccluder={...this.cut(this.monitorPaper.shape.polygon,()=>true,false),shape:this.monitorPaper.shape};
    this.water=surface(W/2,H/2);this.waterCtx=this.water.getContext('2d');
    this.waterMask=surface(W/2,H/2);const mask=this.waterMask.getContext('2d'),bitmap=mask.createImageData(W/2,H/2),source=this.original.data;
    this.glints=[];
    for(let y=218;y<H/2;y++){
     for(let x=0;x<W/2;x++){
      const sx=x*2,sy=y*2;if(!waterAreas.some(p=>inside(sx,sy,p)))continue;
      const i=(sy*W+sx)*4,r=source[i],g=source[i+1],b=source[i+2];
      if(!((g>r*.87&&b>r*.8&&g>65)||Math.min(r,g,b)>150))continue;
      bitmap.data[(y*W/2+x)*4+3]=255;
      if(r+g+b>590&&((x*7+y*11)%53===0)){const noise=Math.sin(x*127.1+y*311.7)*43758.5453;this.glints.push({x,y,w:2+(x%6),phase:(noise-Math.floor(noise))*Math.PI*2});}
     }
     if((y-218)%24===0)yield .79+.2*(y-218)/(H/2-218);
    }
    mask.putImageData(bitmap,0,0);
    // Pixel buffers are needed only for extraction, never read back each frame.
    this.original=null;this.plate=null;this.waterDonorField=null;this.timeOfDay=new SceneTime(this);yield 1;
  }
  *prepareSky(){yield* prepareSky(this);}
  async setTimeOfDay(mode){await this.timeOfDay.apply(mode);}
  async resizeAsync(width,height,onProgress=()=>{}){this.width=width;this.height=height;onProgress(1);}
  drawClouds(time){for(const cloud of this.clouds)drawSkyLayer(this.ctx,cloud,time);if(this.haze)this.ctx.drawImage(this.haze.canvas,this.haze.x,this.haze.y);}
  drawWater(time){
    const ctx=this.waterCtx;ctx.clearRect(0,0,W/2,H/2);ctx.globalCompositeOperation='source-over';
    for(const [index,source] of rippleSources.entries()){
      const clock=time+source.phase,latest=Math.floor(clock/source.period),count=Math.ceil(source.life/source.period);
      for(let n=0;n<count;n++){
        const age=clock-(latest-n)*source.period;if(age<0||age>=source.life)continue;
        const fade=smooth(age/.5)*(1-smooth((age/source.life-.45)/.55)),r=age*source.speed/2;
        if(fade<.01)continue;
        ctx.strokeStyle=this.timeOfDay?.mode==='night'?`rgba(139,194,224,${fade*.23})`:`rgba(255,243,181,${fade*.27})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(source.x/2,source.y/2,r*source.aspect[0],r/source.aspect[1],0,0,Math.PI*2);ctx.stroke();
        if(r>8){ctx.strokeStyle=`rgba(38,105,128,${fade*.16})`;ctx.beginPath();ctx.ellipse(source.x/2,source.y/2,(r-4)*source.aspect[0],(r-4)/source.aspect[1],0,index*.7,index*.7+Math.PI*1.7);ctx.stroke();}
      }
    }
    for(const p of this.glints){const strength=Math.max(0,Math.sin(time*2+p.phase))**8*.3;if(strength<.02)continue;ctx.fillStyle=this.timeOfDay?.mode==='night'?`rgba(165,210,235,${strength*.75})`:`rgba(255,249,203,${strength})`;ctx.fillRect(p.x,p.y,p.w,1);}
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
    if(this.screenCanvas){
      // Keep glyphs at 3× all the way to the browser compositor. Flattening
      // them into the native pixel-art canvas throws that detail away.
      const ctx=this.displayCtx;ctx.setTransform(3,0,0,3,-325*3,-335*3);ctx.clearRect(325,335,420,190);
      ctx.drawImage(this.screenLayer,325,335,420,190);
      ctx.globalCompositeOperation='destination-out';
      ctx.drawImage(this.head.canvas,this.head.x,this.head.y);
      this.drawDetail(this.monitorPaperOccluder,time,ctx);
      ctx.globalCompositeOperation='source-over';
    }else{
      this.ctx.drawImage(this.screenLayer,325,335,420,190);
      this.ctx.drawImage(this.head.canvas,this.head.x,this.head.y);
    }
  }
  drawDetail(sprite,time,ctx=this.ctx){
    const {canvas,x,y,w,h,shape}=sprite;
    // Tiny rotations with nearest-neighbor sampling make whole columns jump
    // between source rows, producing a line that sweeps across a floating prop.
    // Interpolate only these moving cutouts at subpixel positions. The room
    // keeps its original raster, colors and nearest-neighbor display scaling.
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
    if(shape.kind==='hinge'){
      const [ax,ay]=shape.anchor,angle=shape.angle*(Math.sin(time*shape.speed+shape.phase)-Math.sin(shape.phase));
      ctx.translate(ax,ay);ctx.rotate(angle);ctx.drawImage(canvas,x-ax,y-ay);ctx.restore();return;
    }
    if(shape.kind==='paper'||shape.kind==='leaves'){
      const [ax,ay]=shape.anchor,endY=shape.kind==='paper'?ay+shape.length:ay-63;
      const end=detailPoint(shape,ax,endY,time),dy=endY-ay;
      ctx.translate(ax,ay);ctx.transform(1,0,(end[0]-ax)/dy,(end[1]-ay)/dy,0,0);ctx.drawImage(canvas,x-ax,y-ay);ctx.restore();
      return;
    }
    const [ax,ay]=shape.anchor,p=detailPoint(shape,ax,ay,time),px=detailPoint(shape,ax+1,ay,time),py=detailPoint(shape,ax,ay+1,time);
    ctx.translate(...p);ctx.transform(px[0]-p[0],px[1]-p[1],py[0]-p[0],py[1]-p[1],0,0);ctx.drawImage(canvas,x-ax,y-ay);ctx.restore();
  }
  drawBird(sprite,time){
    const {bird,canvas,x,y,w,h}=sprite,pose=birdPose(bird,time),ctx=this.ctx,[cx,cy]=bird.center;
    ctx.save();ctx.translate(...pose.position);ctx.transform(pose.cos*pose.scale,pose.sin*pose.scale,-pose.sin*pose.scale,pose.cos*pose.scale,0,0);
    for(let col=0;col<w;col+=2){const wing=clamp((Math.abs(x+col-cx)-5)/35);ctx.drawImage(canvas,col,0,Math.min(2,w-col),h,x+col-cx,y-cy+pose.flap*wing,Math.min(2,w-col),h);}
    ctx.restore();
  }
  drawLights(time){
    const phase=time%3.5,blink=.82*smooth((phase-3.24)/.035)*(1-smooth((phase-3.34)/.16));
    if(blink>0){
      const lamp=this.ceilingLamp,ctx=this.ctx;ctx.save();ctx.globalAlpha=blink;ctx.drawImage(lamp.canvas,lamp.x,lamp.y);ctx.restore();
    }
    this.beacon.draw(this.ctx,time,this.timeOfDay.mode==='night');
    for(const light of this.lights){
      const {emitter}=light;
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
    const ctx=this.ctx;ctx.drawImage(this.base,0,0);this.drawClouds(time);this.timeOfDay.drawSky(ctx,time);this.drawWater(time);this.drawScreens(time);
    for(const sprite of this.details)this.drawDetail(sprite,time);
    this.drawLights(time);this.extras.draw(ctx,time);this.additions.draw(ctx,time);this.timeOfDay.drawLights(ctx,time);for(const sprite of this.birds)this.drawBird(sprite,time);
    // Composite all moving layers first, then sample one shared 1.5px grid.
    // Native extraction/motion keeps its precision; no per-object grid seams.
    this.gridCtx.drawImage(this.canvas,0,0,GRID_W,GRID_H);
    ctx.drawImage(this.pixelGrid,0,0,W,H);
  }
  dispose(){if(this.haze)this.haze.canvas.width=this.haze.canvas.height=1;this.haze=null;this.beacon?.dispose();this.beacon=null;this.foliageMattes=null;this.waterDonorField=null;for(const c of this.clouds)for(const canvas of [c.layer,c.mask,c.sourceCanvas])canvas.width=canvas.height=1;if(this.sun)this.sun.canvas.width=this.sun.canvas.height=1;this.timeOfDay?.dispose();this.timeOfDay=null;this.additions?.dispose();this.additions=null;this.extras?.dispose();this.extras=null;for(const value of Object.values(this))if(value instanceof HTMLCanvasElement)value.width=value.height=1;this.details=[];this.birds=[];this.clouds=[];this.lights=[];}
}
