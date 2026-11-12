import { drawQuad } from './scene-geometry.js?v=20261110-fps10';
import { prepareWarp, drawWarp } from './scene-deform.js?v=20261111-layer44';

// New movement lives in previously still corners of the room. Coordinates are
// native source pixels; neither masks nor animation depend on viewport size.
export const accentShapes=[
 {id:'upper-wall-sheet',kind:'paper',anchor:[367,77],length:75,phase:1.2,motionScale:.42,
  polygon:[[350,76],[368,77],[368,80],[389,82],[408,86],[412,90],[412,98],[415,98],[415,111],[410,111],[410,149],[398,153],[368,152],[368,149],[347,146],[348,112]]},
 {id:'left-wall-sheet',kind:'paper',anchor:[54,253],length:44,phase:3.4,motionScale:.52,
  polygon:[[37,251],[62,253],[62,257],[80,260],[80,269],[83,270],[83,286],[88,288],[88,297],[57,297],[57,294],[39,293]]},
 {id:'yellow-wall-note',kind:'paper',anchor:[52,159],length:31,phase:5.2,motionScale:.5,
  polygon:[[43,157],[52,158],[59,161],[67,162],[67,168],[71,169],[71,181],[76,183],[76,189],[65,190],[64,187],[46,185]]},
];

export const accentRegions={
 'upper-wall-sheet':[345,75,74,82], 'left-wall-sheet':[35,250,56,51],
 'yellow-wall-note':[42,155,38,38], 'gray-pad-controls':[236,857,44,18],
 'wall-diagnostics':[24,117,40,26], 'left-mini-terminal':[200,258,40,18],
 'desk-micro-face':[253,499,31,15], 'right-laptop':[1325,515,28,19],
 'right-keypad':[1292,548,31,17], 'wall-power':[26,205,49,35],
 'left-tower-read':[237,478,12,26], 'underdesk-network':[372,665,43,11],
 'right-level-meter':[1318,579,42,17], 'speaker-cone':[1358,552,17,17],
 'right-case-reflection':[1308,601,47,70], 'desk-reflection':[535,548,77,15],
 'blue-cup-steam':[372,485,23,29], 'middle-plant':[1009,535,50,41],
};

const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const clamp=v=>Math.max(0,Math.min(1,v));
const panelSpecs=[
 {id:'wall-diagnostics',w:38,h:21,quad:[[24,117],[63,123],[63,142],[24,136]],bg:[22,45,61],ink:[108,164,180],kind:'diagnostics'},
 {id:'left-mini-terminal',w:37,h:15,quad:[[201,259],[238,262],[238,275],[201,272]],bg:[12,35,51],ink:[92,189,219],kind:'terminal'},
 {id:'desk-micro-face',w:28,h:13,quad:[[254,499],[282,500],[282,513],[254,512]],bg:[116,125,138],ink:[25,36,43],kind:'face'},
 {id:'right-laptop',w:23,h:16,quad:[[1330,516],[1352,517],[1348,532],[1326,531]],bg:[47,56,65],ink:[178,207,190],kind:'laptop'},
 {id:'right-keypad',w:28,h:15,quad:[[1295,549],[1322,550],[1320,564],[1292,563]],bg:[83,99,115],ink:[40,183,210],kind:'signal'},
];

export class SceneAccents{
 *prepare(scene){
  this.scene=scene;this.lastFrame=-1;this.mode=null;
  this.panels=panelSpecs.map(s=>{const canvas=surface(s.w,s.h);return{...s,canvas,ctx:canvas.getContext('2d')};});
  const greens=(r,g,b)=>g>35&&g>r*.82&&g>b*1.28&&r<195;
  this.plant=prepareWarp(scene.cut([[1012,558],[1027,560],[1025,550],[1034,550],[1039,540],[1055,536],[1057,542],[1049,547],[1047,557],[1056,562],[1059,568],[1053,574],[1015,574]],greens,true,9),
   (x,y)=>{const free=clamp((574-y)/37)**1.8;return[free,free*.42];},5);
  yield;
  const red=(r,g,b)=>r>150&&r>g*1.35&&r>b*1.5;
  this.indicators=[
   {id:'wall-power',box:[26,205,49,35],accept:(r,g,b)=>red(r,g,b)||(g>150&&b<g*.65),period:5.6,phase:1.4},
   {id:'left-tower-read',box:[237,478,12,26],accept:red,period:3.8,phase:.3},
   {id:'underdesk-network',box:[372,665,43,11],accept:(r,g,b)=>g>110&&b>90&&r<g*.8,period:4.9,phase:2.4},
   {id:'right-level-meter',box:[1318,579,42,17],accept:(r,g,b)=>g>95&&g>r*1.07&&b<g*1.1,period:3.7,phase:1.1},
   {id:'gray-pad-controls',box:[237,858,41,16],accept:(r,g,b,x,y)=>((x>=238&&x<=248&&y>=861&&y<=869)||(x>=258&&x<=274&&y>=863&&y<=870))&&r<150&&g<170&&b<200,period:6.3,phase:2.6},
  ].map(spec=>{
   const[x,y,w,h]=spec.box,sprite=scene.cut([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],spec.accept,false);
   const ctx=sprite.canvas.getContext('2d');ctx.globalCompositeOperation='source-atop';ctx.fillStyle='#000';ctx.fillRect(0,0,sprite.w,sprite.h);ctx.globalCompositeOperation='source-over';
   return{...spec,...sprite};
  });
  yield;
  this.reflections=[
   {id:'right-case-reflection',polygon:[[1311,603],[1354,606],[1353,670],[1323,670],[1321,645],[1308,619]],accept:(r,g,b)=>g>75&&b>90&&g-r>35&&b-r>35,phase:1.2,period:6.4},
   {id:'desk-reflection',polygon:[[535,548],[607,552],[611,561],[535,556]],accept:(r,g,b)=>Math.min(r,g,b)>145,phase:3.1,period:5.3},
  ].map(spec=>{
   const mask=scene.cut(spec.polygon,spec.accept,false),canvas=surface(mask.w,mask.h);
   return{...spec,...mask,mask:mask.canvas,canvas,ctx:canvas.getContext('2d')};
  });
  this.cone=surface(19,19);const cone=this.cone.getContext('2d');cone.fillStyle='#08121c';
  for(let y=-8;y<=8;y++){const half=Math.floor(Math.sqrt(64-y*y));cone.fillRect(9-half,9+y,half*2+1,1);}
  yield;
 }
 lightColor(rgb,x,y,emissive=false){
  const mode=this.scene.timeOfDay.mode;
  if(mode==='dusk'||emissive&&mode==='night')return`rgb(${rgb.join(' ')})`;
  const out=new Uint8ClampedArray(3);this.scene.timeOfDay.color(...rgb,x,y,'object',out,0,mode);
  return`rgb(${out.join(' ')})`;
 }
 update(time){
  const mode=this.scene.timeOfDay.mode,frame=Math.floor(time*12);
  if(mode===this.mode&&frame===this.lastFrame)return;
  if(mode!==this.mode)for(const s of this.panels){
   s.background=this.lightColor(s.bg,...s.quad[0]);s.foreground=this.lightColor(s.ink,...s.quad[0],s.kind!=='face');
  }
  this.mode=mode;this.lastFrame=frame;
  for(const s of this.panels){
   const c=s.ctx,w=s.w,h=s.h;c.fillStyle=s.background;c.fillRect(0,0,w,h);c.fillStyle=s.foreground;
   const step=Math.floor(time*(s.kind==='terminal'?2.3:1.4));
   if(s.kind==='diagnostics'){
    for(let row=0;row<3;row++){
     c.globalAlpha=.5+row*.15;c.fillRect(3,3+row*5,2,2);
     for(let col=0;col<6;col++)if((col*3+row+step)%7<4)c.fillRect(9+col*4,3+row*5,2,1);
    }
    c.globalAlpha=1;c.fillRect(3+(step%14)*2,h-3,3,1);
   }else if(s.kind==='terminal'){
    for(let row=0;row<3;row++){
     c.globalAlpha=1-row*.2;c.fillRect(2,2+row*4,4,1);
     c.fillRect(8,2+row*4,5+(step+row*3)%11,1);c.fillRect(26,2+row*4,2+(step+row)%7,1);
    }
   }else if(s.kind==='face'){
    const blink=(time+1.1)%5.3>5.08,look=Math.round(Math.sin(time*.63));
    for(const x of[4,20])c.fillRect(x+look,4,2,blink?1:3);
    c.fillRect(11,8,5,1);if(Math.floor(time/4.7)%3===1)c.fillRect(10,7,1,1);
   }else if(s.kind==='laptop'){
    const cycle=time%6.8,typed=Math.min(13,Math.floor(cycle*6));
    c.globalAlpha=.6;c.fillRect(3,3,12,1);c.fillRect(3,6,9,1);c.globalAlpha=1;
    for(let i=0;i<typed;i+=3)c.fillRect(3+i,10,2,1);
    if(Math.floor(time*2)%2===0)c.fillRect(3+typed,12,2,1);
   }else{
    c.fillRect(5,7,2,3);for(let i=0;i<3;i++){
     c.globalAlpha=((time*.9+i*.28)%1)<.55?.8:.15;c.fillRect(10+i*4,7-i*2,2,3+i*2);
    }
   }
   c.globalAlpha=1;
  }
  for(const s of this.reflections){
   const c=s.ctx,p=((time+s.phase)%s.period)/s.period;c.clearRect(0,0,s.w,s.h);
   c.fillStyle=mode==='night'?'rgba(128,192,220,.12)':'rgba(217,240,234,.28)';
   for(let row=0;row<s.h;row+=2)c.fillRect(Math.round(p*(s.w+22)-18-row*.13),row,6,2);
   c.globalCompositeOperation='destination-in';c.drawImage(s.mask,0,0);c.globalCompositeOperation='source-over';
  }
 }
 draw(ctx,time){
  this.update(time);ctx.save();ctx.imageSmoothingEnabled=false;
  for(const s of this.panels)drawQuad(ctx,s.canvas,s.quad,s.w,s.h);
  for(let n=0;n<this.indicators.length;n++){
   const s=this.indicators[n],age=(time+s.phase)%s.period;
   if(s.id==='gray-pad-controls'){
    // A short button press stays inside the existing controls. The controller
    // shell and its waterline are never extracted or repainted.
    for(let half=0;half<2;half++){
     const press=Math.exp(-(((age-1.1-half*1.4)/.24)**2)),x=half*21,w=Math.min(21,s.w-x);
     ctx.globalAlpha=press*.38;ctx.drawImage(s.canvas,x,0,w,s.h,s.x+x,s.y,w,s.h);
    }
    continue;
   }
   // Different ports read in short bursts; their physical LEDs remain intact.
   for(let x=0;x<s.w;x+=4){
    const active=Math.max(0,Math.sin(age*(n===3?5.2:3.6)-x*.24))**6;
    ctx.globalAlpha=.66*(1-active);ctx.drawImage(s.canvas,x,0,Math.min(4,s.w-x),s.h,s.x+x,s.y,Math.min(4,s.w-x),s.h);
   }
  }
  ctx.globalAlpha=1;
  for(const s of this.reflections)ctx.drawImage(s.canvas,s.x,s.y);
  const beat=Math.max(0,Math.sin(time*5.1))**5*(.7+.3*Math.sin(time*.7));
  ctx.globalAlpha=.12+.22*beat;ctx.drawImage(this.cone,1357,551);ctx.globalAlpha=1;
  const radius=5+Math.round(beat);ctx.fillStyle=this.mode==='night'?`rgba(105,139,164,${beat*.22})`:`rgba(156,165,171,${beat*.3})`;
  for(let y=-radius;y<=radius;y+=2){const half=Math.floor(Math.sqrt(radius*radius-y*y));ctx.fillRect(1366-half,560+y,1,1);ctx.fillRect(1366+half,560+y,1,1);}
  // Steam rises from the blue mug; it never displaces the cup or monitor rim.
  for(let n=0;n<3;n++){
   const p=((time+n*1.37)%4.1)/4.1,fade=Math.sin(p*Math.PI)**2;
   ctx.fillStyle=this.mode==='night'?`rgba(153,190,203,${fade*.23})`:`rgba(230,238,214,${fade*.52})`;
   for(let k=0;k<3;k++)ctx.fillRect(Math.round(380+Math.sin(p*7+n+k*.5)*1.8+p*5),Math.round(511-p*25+k*2),1,2);
  }
  // Fixed roots and a single inverse warp avoid separate leaf strips/halos.
  drawWarp(ctx,this.plant,1.8*Math.sin(time*2.05),.65*Math.sin(time*2.7));
  ctx.restore();
 }
 dispose(){
  for(const s of[...this.panels,...this.indicators,...this.reflections,this.plant]){s.canvas.width=s.canvas.height=1;if(s.mask)s.mask.width=s.mask.height=1;}
  this.cone.width=this.cone.height=1;this.panels=[];this.indicators=[];this.reflections=[];this.plant=null;this.scene=null;
 }
}
