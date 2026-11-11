import { leafShapes } from './scene-foliage.js?v=20261111-sky43';
import { SceneFan } from './scene-fan.js?v=20261111-sky43';
import { prepareWarp, drawWarp } from './scene-deform.js?v=20261111-days42';
import { inside } from './scene-objects.js?v=20261111-sky43';

const TAU=Math.PI*2,W=1536;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const opening=(time,period,phase)=>1-.96*Math.exp(-((((time+phase)%period-period+.45)/.095)**2));

// Small, independent scene details. All movement shares PixelScene's clock:
// no timers, additional image requests, full-room buffers or per-frame readback.
export class SceneExtras {
  *prepare(scene){
    this.tag=scene.cut([[309,80],[315,80],[320,85],[330,87],[332,111],[322,113],[319,110],[304,110],[300,107],[304,101],[305,87]],(r,g,b,x,y)=>y>=80,true,6,undefined,false,true);
    this.leaves=leafShapes.map(leaf=>{
      const sprite=scene.cut(leaf.polygon,(r,g,b)=>g>r*(leaf.warm?.78:.91)&&g>b*1.12,true,14,undefined,false,false);
      const length=Math.max(...leaf.polygon.map(([x,y])=>Math.hypot(x-leaf.anchor[0],y-leaf.anchor[1])));
      return{...leaf,...prepareWarp(sprite,(x,y)=>{const free=clamp(Math.hypot(x-leaf.anchor[0],y-leaf.anchor[1])/length)**1.7;return[free,free*free];},8)};
    });
    yield;
    this.prepareFan(scene);
    yield;
    // Replace the two old glyph patches, preserving the green panel's uneven rim.
    const src=scene.original.data,dst=scene.plate.data;
    for(const [x0,y0,x1,y1,donorX,donorY] of [[323,329,339,341,337,352],[336,338,355,353,355,334]]){
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const i=(y*W+x)*4,donor=(donorY*W+donorX)*4;
        const alpha=smooth(Math.min(x-x0,y-y0,x1-x,y1-y)/1.5);
        for(let c=0;c<3;c++)dst[i+c]=src[i+c]*(1-alpha)+src[donor+c]*alpha;
      }
    }
    this.roundEye=scene.cut([[1351,779],[1379,779],[1379,803],[1351,803]],(r,g,b)=>g>120&&b>140&&r<g*.7,true,2);
    this.leftLeds=[
      [[169,346],[181,346],[181,355],[169,355]],[[182,346],[193,346],[193,356],[182,356]],
      [[250,349],[257,349],[257,360],[250,360]],[[258,350],[269,350],[269,361],[258,361]],
      [[165,384],[176,384],[176,394],[165,394]],[[179,385],[186,385],[186,393],[179,393]],
    ].map(p=>scene.cut(p,(r,g,b)=>(r>140&&r>b*1.25)||(g>130&&b>130&&g>r*1.3),false));
    this.rightLeds=[1449,1460,1470,1479,1491,1500].map((x,i)=>scene.cut([[x,542],[x+(i===1?7:8),542],[x+(i===1?7:8),551],[x,551]],(r,g,b)=>g>130&&g>r*1.4,false));
    for(const light of [...this.leftLeds,...this.rightLeds]){
      const ctx=light.canvas.getContext('2d');ctx.globalCompositeOperation='source-atop';ctx.fillStyle='#000';ctx.fillRect(0,0,light.w,light.h);ctx.globalCompositeOperation='source-over';
    }
    yield;
    this.prepareCable(scene);
    yield;
  }
  prepareFan(scene){this.fan=new SceneFan(scene);}

  prepareCable(scene){
    const outer=[[619,891],[640,885],[651,886],[669,889],[691,891],[709,897],[722,902],[731,916],[732,940],[725,950],[705,962],[679,965],[659,956],[637,943],[619,928],[611,914],[614,901]];
    const inner=[[625,902],[635,897],[653,897],[677,900],[697,902],[715,910],[722,922],[721,938],[713,945],[697,949],[678,951],[659,943],[638,931],[627,919],[622,909]];
    const sprite=scene.cut(outer,(r,g,b,x,y)=>!inside(x,y,inner),true,5,undefined,true,true);
    const {w,h}=sprite,ctx=sprite.canvas.getContext('2d'),pixels=ctx.getImageData(0,0,w,h).data;
    const source=new Float32Array(pixels.length),weight=new Float32Array(w*h),active=[];
    for(let i=0;i<w*h;i++){const a=pixels[i*4+3]/255;for(let c=0;c<3;c++)source[i*4+c]=pixels[i*4+c]*a;source[i*4+3]=a;}
    for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){
      const i=y*w+x;weight[i]=smooth((952-(sprite.y+y))/30);
      let visible=false;for(let dy=-3;dy<=3&&!visible;dy++)for(let dx=-3;dx<=3;dx++)if(pixels[((y+dy)*w+x+dx)*4+3]){visible=true;break;}
      if(visible)active.push(i);
    }
    this.cable={...sprite,ctx,source,weight,active:new Int32Array(active),output:ctx.createImageData(w,h)};
  }
  drawFan(ctx,time){this.fan.draw(ctx,time);}

  drawCable(ctx,time){
    const s=this.cable,{w,source,weight,active,output}=s,out=output.data,dx=.9*Math.sin(time*1.03),dy=1.9*Math.sin(time*1.37);
    // Continuous inverse sampling of one connected texture. Premultiplied
    // alpha keeps dark cable edges clean; no moving strips or snapping columns.
    for(let n=0;n<active.length;n++){
      const i=active[n],x=i%w-dx*weight[i],y=Math.floor(i/w)-dy*weight[i],ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,j=(iy*w+ix)*4,k=i*4;
      const a=(1-u)*(1-v),b=u*(1-v),c=(1-u)*v,d=u*v;
      const alpha=source[j+3]*a+source[j+7]*b+source[j+w*4+3]*c+source[j+w*4+7]*d;
      out[k+3]=alpha*255;
      if(alpha>.001)for(let ch=0;ch<3;ch++)out[k+ch]=(source[j+ch]*a+source[j+4+ch]*b+source[j+w*4+ch]*c+source[j+w*4+4+ch]*d)/alpha;
    }
    s.ctx.putImageData(output,0,0);ctx.drawImage(s.canvas,s.x,s.y);
  }
  draw(ctx,time){
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
    this.drawFan(ctx,time);
    const cycle=time%9.7,gust=Math.exp(-(((cycle-6.5)/.65)**2)),angle=.045*Math.sin(time*1.65)+.035*gust*Math.sin(time*4.2);
    ctx.save();ctx.beginPath();ctx.rect(294,80,48,42);ctx.clip();ctx.translate(313,81);ctx.rotate(angle);ctx.drawImage(this.tag.canvas,this.tag.x-313,this.tag.y-81);ctx.restore();
    for(const leaf of this.leaves){
      const wind=4.35*(Math.sin(time*2.1+leaf.phase)-Math.sin(leaf.phase))*.6+1.65*Math.sin(time*4.2+leaf.phase)*Math.sin(time*.45);
      const curl=1.55*(Math.sin(time*2.6+leaf.phase*.7)-Math.sin(leaf.phase*.7));
      drawWarp(ctx,leaf,wind,curl);
    }
    this.drawCable(ctx,time);
    this.drawFaces(ctx,time);
    // Activity varies by device. The right rack rests between short chases.
    for(let i=0;i<this.leftLeds.length;i++){
      const led=this.leftLeds[i],activity=Math.max(0,Math.sin(time*(2.7+i*.51)+i*1.83))**6;
      ctx.globalAlpha=.62*(1-activity);ctx.drawImage(led.canvas,led.x,led.y);
    }
    const chase=time%5.6;
    for(let i=0;i<this.rightLeds.length;i++){
      const led=this.rightLeds[i],flash=chase<2.1?Math.exp(-(((chase-i*.23-.16)/.16)**2)):0;
      ctx.globalAlpha=.52*(1-flash);ctx.drawImage(led.canvas,led.x,led.y);
    }
    ctx.globalAlpha=1;this.drawAir(ctx,time);ctx.restore();
  }
  drawFaces(ctx,time){
    // A small green face stays inside its original slanted display.
    const blink=opening(time,3.7,.2),mood=Math.floor(time/3.6)%4;
    ctx.save();ctx.transform(1,.035,-.07,1,323,332);ctx.fillStyle='#28543a';
    for(const x of [5,20]){ctx.fillRect(x,4+(1-blink)*2,3,Math.max(.7,4*blink));}
    if(mood===0){ctx.fillRect(11,14,7,2);ctx.fillRect(9,12,2,2);ctx.fillRect(18,12,2,2);}
    else if(mood===1){ctx.fillRect(9,13,7,2);ctx.fillRect(16,11,4,2);}
    else if(mood===2){ctx.fillRect(12,11,5,6);ctx.fillStyle='#71b582';ctx.fillRect(13,12,3,3);}
    else{ctx.fillRect(10,13,9,2);}
    ctx.restore();
    const s=this.roundEye,open=opening(time,4.3,1.1),look=2*Math.sin(time*.72)*Math.sin(time*.23);
    ctx.save();ctx.translate(1365+look,791);ctx.scale(1,open);ctx.drawImage(s.canvas,s.x-1365,s.y-791);ctx.restore();
  }
  drawAir(ctx,time){
    // Three staggered pixel wisps originate at the cup rim, never the monitor.
    for(let n=0;n<3;n++){
      const age=(time+n*1.23)%3.7,progress=age/3.7,fade=smooth(progress/.13)*(1-smooth((progress-.5)/.5));
      const x=637+Math.sin(progress*6+n*1.9)*1.8+progress*8,y=513-progress*35;
      ctx.fillStyle=`rgba(232,240,219,${fade*.6})`;
      for(let k=0;k<4;k++)ctx.fillRect(Math.round(x+Math.sin(progress*8+k*.8)*1.7),Math.round(y+k*2),k===1?2:1,2);
    }
    // A few backlit specks; paths remain entirely within clear window areas.
    for(let n=0;n<7;n++){
      const period=6.1+n*.63,progress=((time+n*1.71)%period)/period,fade=Math.sin(progress*Math.PI)**2;
      const x=904+n*23+Math.sin(progress*4+n)*5+progress*11,y=327-(n%3)*18-progress*24;
      ctx.fillStyle=`rgba(255,246,192,${fade*.56})`;ctx.fillRect(Math.round(x),Math.round(y),n%3===0?2:1,1);
    }
  }
  dispose(){
    for(const item of [this.tag,this.roundEye,this.cable,...this.leaves,...this.leftLeds,...this.rightLeds])item.canvas.width=item.canvas.height=1;
    this.fan.dispose();
    this.cable=null;this.leaves=[];this.leftLeds=[];this.rightLeds=[];
  }
}
