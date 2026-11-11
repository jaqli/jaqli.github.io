import { drawQuad } from './scene-geometry.js?v=20261110-fps10';

// Screen is commutative. Apply the backing after composing every normal art
// layer, matching the isolated CSS group without an extra full-size canvas.
export function drawSceneAmbience(ctx,rect=document.querySelector('#scene-world')?.getBoundingClientRect()){
  const image=document.querySelector('#scene-ambience');
  if(!rect||!image?.complete||!image.naturalWidth)return;
  ctx.save();ctx.globalCompositeOperation='screen';
  ctx.drawImage(image,rect.x,rect.y,rect.width,rect.height);ctx.restore();
}

export function drawSceneLayers(ctx){
  const displays=document.querySelector('#screen-canvas');
  if(displays&&document.body.classList.contains('scene-ready')){
    const rect=displays.getBoundingClientRect();ctx.drawImage(displays,rect.x,rect.y,rect.width,rect.height);
  }
  for(const root of document.querySelectorAll('#motion-layers, #flight-layer')){
    const origin=root.getBoundingClientRect();
    for(const group of root.querySelectorAll('.water-blend')){
      const bounds=group.getBoundingClientRect(),blend=document.createElement('canvas');
      blend.width=Math.ceil(bounds.width);blend.height=Math.ceil(bounds.height);
      const water=blend.getContext('2d');water.globalCompositeOperation='lighter';
      for(const canvas of group.children){water.globalAlpha=Number(canvas.style.opacity);water.drawImage(canvas,0,0,blend.width,blend.height);}
      ctx.drawImage(blend,bounds.x,bounds.y,bounds.width,bounds.height);
    }
    for(const canvas of root.querySelectorAll('canvas')){
      if(canvas.parentElement.classList.contains('water-blend'))continue;
      const style=getComputedStyle(canvas),w=parseFloat(style.width),h=parseFloat(style.height);
      ctx.save();ctx.translate(origin.x,origin.y);
      if(canvas.dataset.quad)drawQuad(ctx,canvas,JSON.parse(canvas.dataset.quad),w,h);
      else{
        const m=new DOMMatrix(style.transform);
        ctx.translate(parseFloat(style.left)||0,parseFloat(style.top)||0);
        ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);ctx.drawImage(canvas,0,0,w,h);
      }
      ctx.restore();
    }
  }
}
