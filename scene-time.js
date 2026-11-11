import { refreshWarp } from './scene-deform.js?v=20261111-days42';
const W=1536,H=1024,TAU=Math.PI*2;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const yieldTask=()=>globalThis.scheduler?.yield?scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
export const sceneTimes=['dawn','noon','dusk','night'];
// Lighting is baked into the existing small textures only on a user selection.
// There is one source backup, not four scene renderers or a per-frame color pass.
export class SceneTime {
 constructor(scene){this.scene=scene;this.mode='dusk';this.assets=null;this.stars=Array.from({length:42},(_,i)=>({x:875+(i*137)%470,y:90+(i*59)%235,phase:i*1.73}));}
 capture(){
  const r=this.scene,e=r.extras,a=r.additions;this.assets=[];
  const add=(sprite,kind='object',position)=>{
   const {canvas,x=0,y=0}=sprite,ctx=canvas.getContext('2d');let pixels;
   if(sprite.source instanceof Float32Array){
    pixels=new ImageData(canvas.width,canvas.height);
    for(let i=0;i<pixels.data.length;i+=4){const alpha=sprite.source[i+3];for(let c=0;c<3;c++)pixels.data[i+c]=alpha?sprite.source[i+c]/alpha:0;pixels.data[i+3]=alpha*255;}
   }else pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
   this.assets.push({canvas,ctx,x,y,w:canvas.width,h:canvas.height,original:pixels,kind,position,warp:sprite.source instanceof Float32Array?sprite:null});
  };
  add({canvas:r.base},'room');this.room=this.assets[0];
  for(const sprite of [...r.details,...r.birds,r.head,e.tag,e.roundEye,...e.leaves,a.probe,a.aerial])add(sprite);
  add(e.cable);add(a.wire);
  for(const key of ['back','cage'])add({canvas:e.fan[key],x:1205,y:548});
  add({canvas:e.fan.blade},'object',(x,y)=>[1243+(x-44)*31/40-(y-44)*6/40,599+y-44]);
  this.sky=r.clouds[0];this.skySource=new Uint8ClampedArray(this.sky.sourcePixels.buffer.slice(0));
  this.skyMask=new Uint8Array(this.sky.w*this.sky.h);for(const index of this.sky.destinations)this.skyMask[index]=1;
  this.lightField=new Float32Array(96*64);
  for(let y=0;y<64;y++)for(let x=0;x<96;x++){
   const wx=x*16,wy=y*16;
   this.lightField[y*96+x]=clamp(.72*Math.exp(-((wx-1100)**2/210**2+(wy-110)**2/260**2))+.9*Math.exp(-((wx-485)**2/205**2+(wy-432)**2/220**2))+.55*Math.exp(-((wx-1485)**2/150**2+(wy-422)**2/170**2)));
  }
 }
 isSky(x,y){const c=this.sky,ix=Math.round(x)-c.x,iy=Math.round(y)-c.y;return ix>=0&&ix<c.w&&iy>=0&&iy<c.h&&this.skyMask[iy*c.w+ix];}
 color(r,g,b,x,y,kind,out,i,mode){
  const l=r*.2126+g*.7152+b*.0722;
  const sky=kind==='sky'||this.isSky(x,y)||((x-1100)**2+(y-375)**2<31**2);
  if(sky){
   const cloud=clamp((r/Math.max(g,1)-.57)/.39);
   if(mode==='night'){
    out[i]=(6+l*.045)*(1-cloud)+(14+l*.14)*cloud;
    out[i+1]=(12+l*.075)*(1-cloud)+(23+l*.17)*cloud;
    out[i+2]=(27+l*.15)*(1-cloud)+(43+l*.24)*cloud;
   }else if(mode==='noon'){
    out[i]=(16+l*.16)*(1-cloud)+(42+l*.82)*cloud;
    out[i+1]=(106+l*.36)*(1-cloud)+(42+l*.83)*cloud;
    out[i+2]=(166+l*.28)*(1-cloud)+(44+l*.84)*cloud;
   }else{
    out[i]=(95+l*.25)*(1-cloud)+(45+l*.88)*cloud;
    out[i+1]=(133+l*.28)*(1-cloud)+(36+l*.72)*cloud;
    out[i+2]=(168+l*.26)*(1-cloud)+(43+l*.74)*cloud;
   }
   return;
  }
  if(mode==='night'){
   const bulb=x>1028&&x<1169&&y>44&&y<80&&r>155&&g>95;
   const eye=((x>135&&x<182&&y>425&&y<452)||(x>1348&&x<1382&&y>775&&y<806))&&g>125&&b>135;
   if(bulb||eye){out[i]=r;out[i+1]=g;out[i+2]=b;return;}
   const water=y>427&&x>540&&g>r*.91&&b>r*.83&&g>110;
   if(water){out[i]=6+l*.19;out[i+1]=17+l*.32;out[i+2]=31+l*.43;return;}
   const fx=clamp(x/16,0,95),fy=clamp(y/16,0,63),ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy;
   const field=this.lightField,right=Math.min(ix+1,95),bottom=Math.min(iy+1,63);
   const light=(field[iy*96+ix]*(1-u)+field[iy*96+right]*u)*(1-v)+(field[bottom*96+ix]*(1-u)+field[bottom*96+right]*u)*v,gain=.23+light*.35;
   out[i]=r*(gain+.035*light);out[i+1]=g*(gain+.09);out[i+2]=b*(gain+.24)+3;
  }else if(mode==='noon'){
   const warm=clamp((r-b-15)/120)*clamp((l-90)/150);
   out[i]=r*(1.03-.13*warm)+3;out[i+1]=g*1.06+3;out[i+2]=b*1.08+warm*37+4;
  }else{out[i]=r*.90+5;out[i+1]=g*.94+7;out[i+2]=b*1.06+10;}
 }
 async convert(asset,mode){
  const original=asset.original.data,output=new ImageData(asset.w,asset.h),out=output.data;
  if(mode==='dusk'){out.set(original);return output;}
  for(let offset=0;offset<original.length;offset+=65536){
   const end=Math.min(original.length,offset+65536);
   for(let i=offset;i<end;i+=4){
    out[i+3]=original[i+3];if(!out[i+3])continue;
    const px=i/4%asset.w,py=Math.floor(i/4/asset.w);
    const point=asset.position?asset.position(px,py):null,x=point?point[0]:px+asset.x,y=point?point[1]:py+asset.y;
    let rr=original[i],gg=original[i+1],bb=original[i+2];
    // The low dusk sun is removed for noon/night, before placing a separate
    // high sun/moon. Copy nearby sky through a feathered disk, not a second sun.
    if((asset.kind==='room'||asset.kind==='sky')&&mode!=='dawn'&&Math.abs(x-1100)<26&&Math.abs(y-375)<26){
     const distance=Math.hypot(x-1100,y-375),mix=smooth((26-distance)/5),j=i-40*4;
     rr=rr*(1-mix)+original[j]*mix;gg=gg*(1-mix)+original[j+1]*mix;bb=bb*(1-mix)+original[j+2]*mix;
    }
    this.color(rr,gg,bb,x,y,asset.kind,out,i,mode);
   }
   await yieldTask();
  }
  return output;
 }
 async apply(mode){
  if(!sceneTimes.includes(mode))throw new Error('Unknown scene time');
  if(mode===this.mode)return;
  if(!this.assets)this.capture();
  const outputs=[];
  for(const asset of this.assets)outputs.push(await this.convert(asset,mode));
  const c=this.sky,sky=await this.convert({w:c.w,h:c.h,x:c.x,y:c.y,kind:'sky',original:{data:this.skySource}},mode);
  for(let n=0;n<this.assets.length;n++){
   const asset=this.assets[n];asset.ctx.putImageData(outputs[n],0,0);
   if(asset.warp)refreshWarp(asset.warp,outputs[n].data);
  }
  c.sourcePixels.set(new Uint32Array(sky.data.buffer));this.scene.lastCloud=-1;this.mode=mode;
 }
 drawSky(ctx,time){
  if(this.mode==='dusk'||this.mode==='dawn')return;
  const night=this.mode==='night',cx=1101,cy=151,r=night?18:23;
  ctx.save();
  if(night){
   for(const s of this.stars){
    if(!this.isSky(s.x,s.y))continue;
    ctx.fillStyle=`rgba(207,227,255,${.38+.3*Math.sin(time*.65+s.phase)**2})`;ctx.fillRect(s.x,s.y,1,1);
   }
  }
  // Stepped rows keep the sun and moon in the original pixel vocabulary.
  for(let y=-r;y<=r;y+=2){
   const half=Math.floor(Math.sqrt(Math.max(0,r*r-y*y))/2)*2;
   ctx.fillStyle=night?(y<-4?'#d6e9ef':y<8?'#bed8e9':'#a7c8df'):'#fff8d4';ctx.fillRect(cx-half,cy+y,half*2,2);
  }
  if(night){ctx.fillStyle='#9ebcd2';ctx.fillRect(cx+4,cy-8,4,3);ctx.fillRect(cx-8,cy+4,6,3);ctx.fillRect(cx+5,cy+7,3,3);}
  ctx.restore();
 }
 drawLights(ctx,time){
  if(this.mode!=='night')return;
  ctx.save();
  // Individual city windows, lit inside existing building silhouettes.
  for(const [x,y,w,h]of[[1177,386,12,35],[1215,397,7,27],[1255,410,9,28],[1298,411,6,29],[1346,421,10,23],[1401,388,6,32]]){
   for(let row=0;row<h;row+=8)for(let col=0;col<w;col+=6){
    if((x+y+row+col)%5===0)continue;
    ctx.fillStyle=(row+col)%3?'#d8ad68':'#72b2cc';ctx.globalAlpha=.63+.12*Math.sin(time*.16+x+row);ctx.fillRect(x+col,y+row,2,3);
   }
  }
  ctx.globalAlpha=.12;ctx.fillStyle='#fee4a4';ctx.fillRect(1070,81,66,2);
  ctx.restore();
 }
 dispose(){this.assets=null;this.skySource=null;this.skyMask=null;this.lightField=null;}
}
