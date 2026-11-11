import { distantCity } from './scene-objects.js?v=20261111-sky43';
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const smooth=t=>t*t*(3-2*t);
const skyColor=(r,g,b)=>g>118&&b>112&&!(g>r*1.16&&g>b*1.25);
// Lighting follows the complete visible sky. Motion has its own foreground
// matte; conservative animation bounds must never decide a region's palette.
export function* prepareSky(scene){
 const x0=528,y0=60,w=1008,h=366,geometry=surface(w,h),g=geometry.getContext('2d');g.translate(-x0,-y0);
 const polygon=(ctx,points)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
 g.fillStyle='#fff';
 polygon(g,[[529,65],[832,65],[832,423],[620,423],[620,378],[612,378],[611,361],[594,357],[585,336],[578,329],[585,211],[529,198]]);
 g.fillRect(858,65,501,361);g.fillRect(1384,68,152,358);
 g.fillStyle='#000';for(const city of distantCity)polygon(g,city);
 polygon(g,[[1318,111],[1341,113],[1357,124],[1359,141],[1347,159],[1341,166],[1311,172],[1298,158],[1292,143],[1289,129],[1300,121]]);
 polygon(g,[[1430,242],[1473,242],[1471,267],[1438,271],[1427,259]]);
 polygon(g,[[1394,263],[1416,250],[1427,250],[1427,271],[1405,294],[1394,300]]);
 g.fillRect(1427,268,109,32);
 const area=g.getImageData(0,0,w,h).data;
 const wires=surface(w,h),wire=wires.getContext('2d');wire.translate(-x0,-y0);wire.strokeStyle='#fff';wire.lineWidth=5;wire.lineCap='round';wire.lineJoin='round';
 for(const points of[
  [[551,60],[556,85],[569,97],[587,101],[604,97],[619,83],[625,60]],
  [[654,60],[655,103],[661,119],[674,132]],[[729,60],[731,113]],
  [[798,60],[798,126],[809,144],[815,147],[815,159],[825,176],[839,179]],
  [[798,60],[798,232],[805,245],[813,255],[830,270],[843,276]],
  [[805,60],[805,125],[812,135]],[[801,217],[811,218],[829,204],[835,193]],
  [[1469,60],[1469,166],[1478,198],[1488,209],[1501,207],[1513,199],[1524,181],[1533,157]],
  [[1276,134],[1275,162],[1286,175],[1337,176],[1364,168]],
 ]){wire.beginPath();points.forEach(([x,y],i)=>i?wire.lineTo(x,y):wire.moveTo(x,y));wire.stroke();}
 const wirePixels=wire.getImageData(0,0,w,h).data,lightMask=new Uint8Array(w*h),mask=surface(w,h),m=mask.getContext('2d'),alpha=m.createImageData(w,h),destinations=[];
 const plate=scene.plate.data,original=scene.original.data;
 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   const n=y*w+x,j=n*4,i=((y+y0)*1536+x+x0)*4;
   // Protect the lamp's actual warm pixels, not a rectangular sky margin.
   const lamp=x+x0>=1028&&x+x0<=1172&&y+y0<=82&&original[i]>155&&original[i+1]>95&&original[i]>=original[i+1]*.95&&original[i]>=original[i+2];
   const inWindow=area[j]>128&&!lamp;
   lightMask[n]=inWindow&&skyColor(original[i],original[i+1],original[i+2])?1:0;
   const land=y+y0>395&&plate[i+1]<178&&plate[i]<plate[i+1]*.77;
   const visible=inWindow&&!land&&skyColor(plate[i],plate[i+1],plate[i+2])&&wirePixels[j+3]<128;
   alpha.data[j+3]=visible?255:0;if(visible)destinations.push(n);
  }
  if(y%60===0)yield .44+.09*y/h;
 }
 m.putImageData(alpha,0,0);yield .54;
 // Build the loop from unobstructed source-art patches. No columns from
 // behind a window frame, plant, desk or city can travel into the visible sky.
 // Adjacent patches overlap with a smooth crossfade, retaining pixel texture
 // instead of blurring/inpainting large hidden foreground regions.
 const patches=[
  {x:640,y:140,w:144,h:250}, {x:870,y:80,w:368,h:248},
  {x:640,y:140,w:144,h:250,flip:true}, {x:870,y:80,w:368,h:248,flip:true},
 ];
 const overlap=48,sourceWidth=patches.reduce((sum,p)=>sum+p.w-overlap,0),sourceCanvas=surface(sourceWidth,h),sourceCtx=sourceCanvas.getContext('2d'),sourceImage=sourceCtx.createImageData(sourceWidth,h);
 const sample=(p,x,y)=>((p.y+Math.floor(y*p.h/h))*1536+p.x+(p.flip?p.w-1-x:x))*4;
 let start=0;
 for(let n=0;n<patches.length;n++){
  const p=patches[n],previous=patches[(n+patches.length-1)%patches.length],length=p.w-overlap;
  for(let y=0;y<h;y++)for(let x=0;x<length;x++){
   const j=(y*sourceWidth+start+x)*4,i=sample(p,x,y),t=x<overlap?smooth(x/overlap):1,other=sample(previous,previous.w-overlap+x,y);
   for(let c=0;c<3;c++)sourceImage.data[j+c]=t===1?plate[i+c]:plate[other+c]*(1-t)+plate[i+c]*t;
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
