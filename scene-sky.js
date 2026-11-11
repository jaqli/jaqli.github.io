import { prepareShelfMatte } from './scene-shelf-matte.js?v=20261111-clarity46';
import { skyApertures, skyForeground, skyWires, sillSkyEdge } from './scene-sky-matte.js?v=20261111-clarity46';
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
 const shelf=prepareShelfMatte(scene);
 const plate=scene.plate.data,original=scene.original.data,foliage=scene.foliageMattes.filter(p=>p.y<430);
 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   const wx=x+x0,wy=y+y0,n=y*w+x,j=n*4,i=(wy*1536+wx)*4;
   const lamp=wx>=1028&&wx<=1172&&wy<=82&&original[i]>155&&original[i+1]>95&&original[i]>=original[i+1]*.95&&original[i]>=original[i+2];
   let fixedLeaf=false,originalLeaf=false;
   for(const p of foliage){const px=wx-p.x,py=wy-p.y;if(px>=0&&px<p.w&&py>=0&&py<p.h){const k=py*p.w+px;fixedLeaf=!!p.fixed[k];originalLeaf=!!p.foreground[k];}}
   // Only a traced wire's local rim uses its color to separate it from sky.
   // No global RGB threshold can punch holes in buildings or bright desk trim.
   const wireEdge=wirePixels[j+3]>32&&(original[i+1]<158||original[i]>original[i+1]*.88||original[i+2]<original[i+1]*.94);
   let boardRimSky=false;
   if(wx>=1388&&wx<=1418&&wy>=249&&wy<=300&&original[i+1]-original[i]>6&&original[i+2]-original[i]>10&&original[i+2]>=original[i+1]){
    for(let k=1;k<sillSkyEdge.length;k++){const[a,b]=sillSkyEdge[k-1],[c,d]=sillSkyEdge[k];if(wy>=b&&wy<=d){boardRimSky=Math.abs(wx-(a+(c-a)*(wy-b)/(d-b)))<4;break;}}
   }
   let amount=(area[j]>250||boardRimSky)&&!lamp&&!fixedLeaf&&!wireEdge?255:0;
   if(wx>=shelf.x&&wx<shelf.x+shelf.w&&wy>=shelf.y&&wy<shelf.y+shelf.h){const a=shelf.coverage[(wy-shelf.y)*shelf.w+wx-shelf.x];if(a>=0)amount=a;}
   // Calm distant water replaces the removed shore fragments. A two-pixel
   // transition joins the cloud layer to the water without a hard cutoff.
   const horizon=amount>0&&wy>=426&&((wx>=734&&wx<832)||(wx>=858&&wx<1115));
   if(horizon){const sx=wx<965?974+(wx%17):wx,sy=456+(wy-426),k=(sy*1536+sx)*4;for(let ch=0;ch<3;ch++)plate[i+ch]=original[k+ch];if(wy>=428)amount=Math.round(amount*(1-smooth((wy-427)/3)));}
   lightMask[n]=amount===255&&!originalLeaf&&!horizon?1:0;
   alpha.data[j+3]=amount;if(amount===255)destinations.push(n);
  }
  if(y%60===0)yield .44+.09*y/h;
 }
 // Continue the clean water beneath the old center-shore silhouettes;
 // the observer and its aerial are independent foreground sprites.
 for(let y=430;y<453;y++)for(let x=858;x<1115;x++){
  const sx=x<965?974+(x%17):x,sy=456+(y-430)%17,i=(y*1536+x)*4,k=(sy*1536+sx)*4;
  for(let ch=0;ch<3;ch++)plate[i+ch]=original[k+ch];
 }
 scene.base.getContext('2d').putImageData(scene.plate,0,0);
 m.putImageData(alpha,0,0);yield .54;
 // Build the loop from unobstructed source-art patches. No columns from
 // behind a window frame, plant, desk or city can travel into the visible sky.
 // Adjacent patches overlap with a smooth crossfade, retaining pixel texture
 // instead of blurring/inpainting large hidden foreground regions.
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
 let start=0;
 for(let n=0;n<patches.length;n++){
  const p=patches[n],previous=patches[(n+patches.length-1)%patches.length],length=p.w-overlap;
  for(let y=0;y<h;y++)for(let x=0;x<length;x++){
   const j=(y*sourceWidth+start+x)*4,i=sample(p,x,y),t=x<overlap?smooth(x/overlap):1,other=sample(previous,previous.w-overlap+x,y);
   for(let c=0;c<3;c++)sourceImage.data[j+c]=t===1?skyChannel(i,c):skyChannel(other,c)*(1-t)+skyChannel(i,c)*t;
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
