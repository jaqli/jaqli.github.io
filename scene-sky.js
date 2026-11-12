import { inside } from './scene-objects.js?v=20261111-sky43';
import { refineSkyEdges } from './scene-edge-matte.js?v=20261112-pixel51';
import { prepareShelfMatte } from './scene-shelf-matte.js?v=20261112-pixel51';
import { prepareSillMatte } from './scene-sill-matte.js?v=20261112-edge50';
import { prepareFrameMattes } from './scene-frame-matte.js?v=20261112-pixel51';
import { skyApertures, skyForeground, skyWires, rearCity } from './scene-sky-matte.js?v=20261112-pixel51';
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const smooth=t=>t*t*(3-2*t);
// Lighting follows the complete visible sky. Motion has its own foreground
// matte; conservative animation bounds must never decide a region's palette.
export function* prepareSky(scene){
 const x0=528,y0=60,w=1008,h=370,geometry=surface(w,h),g=geometry.getContext('2d');g.translate(-x0,-y0);
 const polygon=(ctx,points)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
 g.fillStyle='#fff';for(const p of skyApertures)polygon(g,p);
 g.fillStyle='#000';for(const p of skyForeground)polygon(g,p);
 const area=g.getImageData(0,0,w,h).data;
 const wires=surface(w,h),wire=wires.getContext('2d');wire.translate(-x0,-y0);wire.strokeStyle='#fff';wire.lineCap='round';wire.lineJoin='round';
 for(const {points,width}of skyWires){wire.lineWidth=width;wire.beginPath();points.forEach(([x,y],i)=>i?wire.lineTo(x,y):wire.moveTo(x,y));wire.stroke();}
 const wirePixels=wire.getImageData(0,0,w,h).data,lightMask=new Uint8Array(w*h),mask=surface(w,h),m=mask.getContext('2d'),alpha=m.createImageData(w,h),destinations=[];
 const shelf=prepareShelfMatte(scene),sill=prepareSillMatte(scene);
 const plate=scene.plate.data,original=scene.original.data,foliage=scene.foliageMattes.filter(p=>p.y<430);
 const wireAt=(wx,wy)=>{
  const j=((wy-y0)*w+wx-x0)*4,i=(wy*1536+wx)*4;
  return wirePixels[j+3]>32&&(original[i+1]<158||original[i]>original[i+1]*.88||original[i+2]<original[i+1]*.94);
 };
 const leafAt=(wx,wy,field)=>foliage.some(p=>wx>=p.x&&wx<p.x+p.w&&wy>=p.y&&wy<p.y+p.h&&p[field][(wy-p.y)*p.w+wx-p.x]);
 const frames=prepareFrameMattes(scene,(wx,wy)=>wireAt(wx,wy)||leafAt(wx,wy,'fixed'),(wx,wy)=>wireAt(wx,wy)||leafAt(wx,wy,'foreground'));
 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   const wx=x+x0,wy=y+y0,n=y*w+x,j=n*4,i=(wy*1536+wx)*4;
   const lamp=wx>=1028&&wx<=1172&&wy<=82&&original[i]>155&&original[i+1]>95&&original[i]>=original[i+1]*.95&&original[i]>=original[i+2];
   let fixedLeaf=false,originalLeaf=false;
   for(const p of foliage){const px=wx-p.x,py=wy-p.y;if(px>=0&&px<p.w&&py>=0&&py<p.h){const k=py*p.w+px;fixedLeaf=!!p.fixed[k];originalLeaf=!!p.foreground[k];}}
   // Only a traced wire's local rim uses its color to separate it from sky.
   // No global RGB threshold can punch holes in buildings or bright desk trim.
   const wireEdge=wireAt(wx,wy);
   let amount=area[j]>250&&!lamp&&!fixedLeaf&&!wireEdge?255:0;
   if(wx>=sill.x&&wx<sill.x+sill.w&&wy>=sill.y&&wy<sill.y+sill.h)amount=fixedLeaf?0:sill.coverage[(wy-sill.y)*sill.w+wx-sill.x];
   // The thin red aerial has no blue face: these local cyan edge pixels are
   // its old sky, not part of the filament or the dark cap below it.
   if(wx>=620&&wx<=630&&wy>=354&&wy<370&&original[i+1]>original[i]+3&&original[i+2]>original[i]+8)amount=255;
   if(wx>=shelf.x&&wx<shelf.x+shelf.w&&wy>=shelf.y&&wy<shelf.y+shelf.h){const a=shelf.coverage[(wy-shelf.y)*shelf.w+wx-shelf.x];if(a>=0)amount=inside(wx,wy,rearCity)?0:a;}
   for(const f of frames)if(wx>=f.x&&wx<f.x+f.w&&wy>=f.y&&wy<f.y+f.h){
    const k=(wy-f.y)*f.w+wx-f.x,a=f.coverage[k];if(a<0)continue;
    amount=a;if(a>0&&a<255)for(let ch=0;ch<3;ch++)plate[i+ch]=f.colors[k*3+ch];
   }
   // Calm distant water replaces the removed shore fragments. A two-pixel
   // transition joins the cloud layer to the water without a hard cutoff.
   const horizon=amount>0&&wy>=426&&((wx>=734&&wx<832)||(wx>=858&&wx<1115));
   if(horizon){const sx=wx<965?974+(wx%17):wx,sy=456+(wy-426),k=(sy*1536+sx)*4;for(let ch=0;ch<3;ch++)plate[i+ch]=original[k+ch];if(wy>=428)amount=Math.round(amount*(1-smooth((wy-427)/3)));}
   lightMask[n]=amount===255&&!originalLeaf&&!horizon?1:0;
   alpha.data[j+3]=amount;
  }
  if(y%60===0)yield .44+.09*y/h;
 }
 // Continue the clean water beneath the old center-shore silhouettes;
 // the observer and its aerial are independent foreground sprites.
 for(let y=430;y<453;y++)for(let x=858;x<1115;x++){
  const sx=x<965?974+(x%17):x,sy=456+(y-430)%17,i=(y*1536+x)*4,k=(sy*1536+sx)*4;
  for(let ch=0;ch<3;ch++)plate[i+ch]=original[k+ch];
 }
 refineSkyEdges(scene,alpha,x0,y0,w,h,lightMask,[sill,shelf,...frames]);
 for(let n=0;n<w*h;n++){if(alpha.data[n*4+3]===255)destinations.push(n);if(alpha.data[n*4+3]>0&&alpha.data[n*4+3]<255)lightMask[n]=0;}
 scene.base.getContext('2d').putImageData(scene.plate,0,0);
 m.putImageData(alpha,0,0);yield .54;
 // A narrow atmospheric band unifies both sides of the distant horizon. It
 // covers background only; buildings, mullions and the observer remain crisp.
 const haze=surface(w,60),hc=haze.getContext('2d'),hp=hc.createImageData(w,60),horizon=[0,0,0];let samples=0;
 for(let sy=457;sy<462;sy++)for(let sx=977;sx<1114;sx++){const i=(sy*1536+sx)*4;for(let c=0;c<3;c++)horizon[c]+=original[i+c];samples++;}
 for(let c=0;c<3;c++)horizon[c]=Math.round(horizon[c]/samples);
 for(let y=0;y<60;y++)for(let x=0;x<w;x++){
  const wx=x+x0,wy=y+400,skyIndex=(wy-y0)*w+x;
  const seaWindow=(wx>=858&&wx<=1361)||(wx>=734&&wx<832&&wy<443);
  const above=wy<430&&(alpha.data[skyIndex*4+3]===255||(wy>=424&&seaWindow&&!skyForeground.some(p=>inside(wx,wy,p))));
  const below=wy>=430&&seaWindow&&!skyForeground.some(p=>inside(wx,wy,p));
  if(!above&&!below)continue;
  const fade=wy<430?smooth(Math.max(0,(wy-400)/30)):1-smooth(Math.min(1,(wy-430)/28));
  const i=(y*w+x)*4;for(let c=0;c<3;c++)hp.data[i+c]=horizon[c];hp.data[i+3]=Math.round(fade*255);
 }
 hc.putImageData(hp,0,0);scene.haze={canvas:haze,x:x0,y:400};
 // Build the loop from unobstructed source-art patches. No columns from
 // behind a window frame, plant, desk or city can travel into the visible sky.
 // Join overlapping patches along their closest-color path. A wide crossfade
 // superimposes two cloud contours and softens the restored pixels again.
 const patches=[
  {x:640,y:140,w:144,h:235}, {x:870,y:80,w:368,h:240},
  {x:640,y:140,w:144,h:235,flip:true}, {x:870,y:80,w:368,h:240,flip:true},
 ];
 const overlap=48,sourceWidth=patches.reduce((sum,p)=>sum+p.w-overlap,0),sourceCanvas=surface(sourceWidth,h),sourceCtx=sourceCanvas.getContext('2d'),sourceImage=sourceCtx.createImageData(sourceWidth,h);
 // Isolated dark source specks must not repeat across the scrolling sky.
 const cleanColors=new Map(),skyChannel=(i,c)=>{
  if(plate[i+1]>=150&&plate[i+2]>=150)return plate[i+c];
  let rgb=cleanColors.get(i);if(!rgb){rgb=[0,0,0];let count=0;for(const offset of[-4,4,-1536*4,1536*4]){const j=i+offset;if(plate[j+1]<150||plate[j+2]<150)continue;for(let k=0;k<3;k++)rgb[k]+=plate[j+k];count++;}if(count)rgb=rgb.map(v=>v/count);else rgb=Array.from(plate.slice(i,i+3));cleanColors.set(i,rgb);}return rgb[c];
 };
 const sample=(p,x,y)=>((p.y+Math.floor(y*p.h/h))*1536+p.x+(p.flip?p.w-1-x:x))*4;
 const seam=(p,previous)=>{
  let cost=new Float64Array(overlap);const path=new Int8Array(h*overlap),cut=new Int16Array(h);
  for(let y=0;y<h;y++){
   const next=new Float64Array(overlap).fill(Infinity);
   for(let x=1;x<overlap-1;x++){
    const a=sample(p,x,y),b=sample(previous,previous.w-overlap+x,y);
    let difference=0;for(let c=0;c<3;c++)difference+=(skyChannel(a,c)-skyChannel(b,c))**2;
    let from=x,best=cost[x];
    for(const dx of[-1,1])if(x+dx>0&&x+dx<overlap-1&&cost[x+dx]+12<best){from=x+dx;best=cost[from]+12;}
    next[x]=best+difference;path[y*overlap+x]=from-x;
   }
   cost=next;
  }
  let x=1;for(let n=2;n<overlap-1;n++)if(cost[n]<cost[x])x=n;
  for(let y=h-1;y>=0;y--){cut[y]=x;x+=path[y*overlap+x];}
  return cut;
 };
 let start=0;
 for(let n=0;n<patches.length;n++){
  const p=patches[n],previous=patches[(n+patches.length-1)%patches.length],length=p.w-overlap,cut=seam(p,previous);
  for(let y=0;y<h;y++)for(let x=0;x<length;x++){
   const j=(y*sourceWidth+start+x)*4,i=x<cut[y]?sample(previous,previous.w-overlap+x,y):sample(p,x,y);
   for(let c=0;c<3;c++)sourceImage.data[j+c]=skyChannel(i,c);
   sourceImage.data[j+3]=255;
  }
  start+=length;yield .54+.24*(n+1)/patches.length;
 }
 sourceCtx.putImageData(sourceImage,0,0);
 const layer=surface(w,h),ctx=layer.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
 scene.clouds=[{x:x0,y:y0,w,h,layer,ctx,mask,pattern:ctx.createPattern(sourceCanvas,'repeat-x'),transform:new DOMMatrix(),lightMask,destinations:new Int32Array(destinations),sourceCanvas,sourceCtx,sourceWidth,sourcePixels:new Uint32Array(sourceImage.data.buffer),speed:12,period:sourceWidth/12}];
 geometry.width=geometry.height=wires.width=wires.height=1;
 const points=Array.from({length:32},(_,i)=>[1100+21*Math.cos(i*Math.PI/16),375+21*Math.sin(i*Math.PI/16)]);
 scene.sun=scene.cut(points,()=>true,false,1);yield .79;
}
export function drawSkyLayer(ctx,c,time){
 const offset=((time*c.speed)%c.sourceWidth+c.sourceWidth)%c.sourceWidth;
 const out=c.ctx;out.globalCompositeOperation='source-over';out.clearRect(0,0,c.w,c.h);
 c.transform.e=offset;c.pattern.setTransform(c.transform);out.fillStyle=c.pattern;out.fillRect(0,0,c.w,c.h);
 out.globalCompositeOperation='destination-in';out.drawImage(c.mask,0,0);out.globalCompositeOperation='source-over';
 ctx.drawImage(c.layer,c.x,c.y);
}
