import { inside } from './scene-objects.js?v=20261111-sky43';
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const palette=[[48,220,255],[156,116,255],[255,156,97],[88,246,197]];
const outline=[[157,54],[173,54],[176,57],[183,57],[184,62],[189,64],[190,70],[198,70],[203,73],[203,90],[200,94],[192,96],[192,99],[184,101],[177,98],[174,95],[165,94],[164,89],[160,86],[155,82],[150,77],[150,68],[154,62],[155,57]];
const core=[[172,65],[181,65],[183,70],[187,72],[188,79],[193,80],[192,85],[180,85],[177,82],[173,83],[170,77],[172,72]];
// Keep the source's stepped blue casing and pale center. Color variants are
// baked once into those exact pixels; no blur, gradients or flat color washes.
export class SceneBeacon {
 constructor(scene){
  this.sprite=scene.cut(outline,(r,g,b,x,y)=>(b-r>24&&g-r>12)||inside(x,y,core),false);
  const s=this.sprite;this.ctx=s.canvas.getContext('2d');const original=this.ctx.getImageData(0,0,s.w,s.h);
  // Fill enclosed dark details inside the casing instead of punching tiny
  // transparent holes in it. Keep the real exterior silhouette untouched.
  const outside=new Uint8Array(s.w*s.h),queue=[];
  const visit=n=>{if(n>=0&&n<outside.length&&!outside[n]&&!original.data[n*4+3]){outside[n]=1;queue.push(n);}};
  for(let x=0;x<s.w;x++){visit(x);visit((s.h-1)*s.w+x);}for(let y=0;y<s.h;y++){visit(y*s.w);visit(y*s.w+s.w-1);}
  for(let q=0;q<queue.length;q++){const n=queue[q];if(n%s.w)visit(n-1);if(n%s.w<s.w-1)visit(n+1);visit(n-s.w);visit(n+s.w);}
  for(let n=0;n<outside.length;n++)if(!outside[n]&&!original.data[n*4+3]){const i=((s.y+Math.floor(n/s.w))*1536+s.x+n%s.w)*4;for(let ch=0;ch<3;ch++)original.data[n*4+ch]=scene.original.data[i+ch];original.data[n*4+3]=255;}
  // Average source detail on a two-pixel grid before choosing shade steps;
  // WebP's one-pixel compression noise must not become animated stippling.
  const blocks=new Map();
  for(let i=0;i<original.data.length;i+=4){if(!original.data[i+3])continue;const x=s.x+i/4%s.w,y=s.y+Math.floor(i/4/s.w),key=Math.floor(y/2)*768+Math.floor(x/2),b=blocks.get(key)||[0,0,0,0];for(let ch=0;ch<3;ch++)b[ch]+=original.data[i+ch];b[3]++;blocks.set(key,b);}
  this.variants=palette.map(color=>{
   const c=surface(s.w,s.h),g=c.getContext('2d'),out=g.createImageData(s.w,s.h);
   for(let i=0;i<original.data.length;i+=4){if(!original.data[i+3])continue;const x=s.x+i/4%s.w,y=s.y+Math.floor(i/4/s.w),b=blocks.get(Math.floor(y/2)*768+Math.floor(x/2)),r=b[0]/b[3],green=b[1]/b[3],blue=b[2]/b[3],shade=Math.round((r*.15+green*.6+blue*.25)/255*6)/6,white=Math.round(Math.max(0,Math.min(1,(r-170)/70))*3)/3*.9;
    for(let ch=0;ch<3;ch++)out.data[i+ch]=(color[ch]*(1-white)+255*white)*shade;out.data[i+3]=255;
   }
   g.putImageData(out,0,0);return c;
  });
  this.x=105;this.y=11;this.glowMask=surface(144,132);this.glow=surface(144,132);this.glowCtx=this.glow.getContext('2d');
  const g=this.glowMask.getContext('2d'),src=scene.original.data,bayer=[0,2,3,1],levels=[.29,.22,.15,.09,.045,.018],radii=[18,26,34,44,55,64];
  // Two-source-pixel light steps match the artwork. Sparse, stable dithering
  // breaks up the last ring; it never flickers independently of the breathing.
  for(let y=0;y<132;y+=2)for(let x=0;x<144;x+=2){
   const dx=x+1-72,dy=(y+1-66)*1.08,d=Math.hypot(dx,dy),band=radii.findIndex(r=>d<r);if(band<0)continue;
   if(band===5&&bayer[(x/2%2)+(y/2%2)*2]>1)continue;
   const i=((this.y+y+1)*1536+this.x+x+1)*4,l=src[i]*.2126+src[i+1]*.7152+src[i+2]*.0722,reflectance=.25+.75*Math.round(l/255*4)/4;
   g.fillStyle=`rgba(255,255,255,${levels[band]*reflectance})`;g.fillRect(x,y,2,2);
  }
 }
 draw(ctx,time,night){
  const s=this.sprite,phase=time/.8,index=Math.floor(phase)%4,blend=(1-Math.cos((phase%1)*Math.PI))/2,pulse=(1-Math.cos(time*Math.PI*2.5))/2;
  if(night){
   const color=palette[index].map((v,ch)=>Math.round(v*(1-blend)+palette[(index+1)%4][ch]*blend)),g=this.glowCtx;
   g.globalCompositeOperation='copy';g.drawImage(this.glowMask,0,0);g.globalCompositeOperation='source-in';g.fillStyle=`rgb(${color.join(' ')})`;g.fillRect(0,0,144,132);g.globalCompositeOperation='source-over';
   ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.55+.45*pulse;ctx.imageSmoothingEnabled=false;ctx.drawImage(this.glow,this.x,this.y);ctx.restore();
  }
  const c=this.ctx;c.globalCompositeOperation='copy';c.drawImage(this.variants[index],0,0);c.globalCompositeOperation='source-atop';c.globalAlpha=blend;c.drawImage(this.variants[(index+1)%4],0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=night?.62+.38*pulse:.7+.3*pulse;ctx.drawImage(s.canvas,s.x,s.y);ctx.restore();
 }
 dispose(){for(const c of [this.sprite.canvas,...this.variants,this.glow,this.glowMask])c.width=c.height=1;}
}
