import { prepareWarp, drawWarp } from './scene-deform.js?v=20261111-layer44';
const TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
export const additionalShapes=[
 {id:'robot-aerial-left',kind:'hinge',anchor:[117,407],angle:.055,speed:1.7,phase:.3,polygon:[[74,375],[80,375],[85,383],[90,385],[117,403],[120,409],[112,406],[83,389],[76,387]]},
 {id:'robot-aerial-right',kind:'hinge',anchor:[135,405],angle:.065,speed:1.4,phase:2,polygon:[[114,373],[124,373],[124,376],[127,378],[127,385],[126,386],[130,391],[133,396],[136,402],[136,406],[133,406],[132,401],[128,397],[125,391],[121,387],[117,387],[113,385],[111,382],[113,379]]},
 {id:'robot-hand',kind:'hinge',anchor:[187,495],angle:.085,speed:1.3,phase:4,polygon:[[183,487],[190,484],[196,485],[199,490],[209,490],[214,497],[218,499],[220,506],[211,511],[202,508],[190,504],[183,498]]},
 {id:'blue-book',anchor:[132,904],amplitude:1.5,period:5.4,phase:1.8,roll:.009,polygon:[[73,884],[88,875],[111,872],[131,877],[161,884],[184,893],[189,901],[175,909],[153,914],[116,909],[89,903],[72,896]]},
 {id:'purple-book',anchor:[107,979],amplitude:1.7,period:7.9,phase:3.2,roll:.008,polygon:[[25,946],[39,936],[74,925],[103,924],[146,936],[174,947],[180,956],[167,970],[143,982],[117,991],[82,984],[53,972],[30,960]]},
 {id:'beige-book',anchor:[275,920],amplitude:1.3,period:6.4,phase:5,roll:.012,polygon:[[219,902],[232,890],[259,887],[286,892],[313,898],[329,908],[329,916],[310,925],[281,932],[255,928],[233,921],[217,912]]},
 {id:'foreground-gamepad',anchor:[1007,975],amplitude:1.8,period:7.2,phase:.8,roll:.009,polygon:[[965,931],[991,929],[995,923],[1014,925],[1015,932],[1030,933],[1041,938],[1058,937],[1063,943],[1062,955],[1076,959],[1085,972],[1082,985],[1076,996],[1060,997],[1044,991],[1033,982],[997,981],[985,978],[979,984],[959,994],[943,993],[928,985],[924,974],[932,960],[945,943]]},
].map(s=>s.kind?s:{...s,kind:'float',drift:.35,waterRepair:true});
export const additionalMotionRegions={
 'robot-aerial-left':[72,373,50,40],'robot-aerial-right':[108,369,32,40],'robot-hand':[182,482,41,32],
 'hanging-wire':[270,0,85,77],'desk-terminal':[477,516,45,34],'underdesk-top':[350,600,67,14],
 'underdesk-bottom':[361,642,64,20],'right-orange-drive':[1434,511,63,14],'right-lower-led':[1441,573,64,14],
 'right-cup-steam':[1466,324,29,37],'blue-book':[68,868,125,53],'purple-book':[20,920,165,77],
 'beige-book':[211,883,124,53],'foreground-gamepad':[918,917,173,87],'city-beacon':[1185,340,11,16],
};
export class SceneAdditions{
 *prepare(scene){
  // The small floating observer in the supplied close-up: a buoyant body,
  // separate flexible aerial, and two lenses. Its trailing cable travels with it.
  this.probe=scene.cut([[870,446],[875,446],[874,457],[889,457],[896,450],[898,437],[907,431],[910,426],[922,426],[928,431],[932,426],[941,425],[948,428],[951,425],[959,429],[961,443],[958,449],[963,452],[959,461],[944,463],[930,461],[916,463],[908,459],[898,461],[891,468],[877,466],[870,462]],()=>true,true,8,undefined,true,true);
  this.aerial=scene.cut([[936,427],[933,425],[934,399],[943,390],[950,387],[959,379],[964,381],[964,388],[956,391],[947,398],[938,402]],()=>true,true,8,undefined,false,true);
  yield;
  this.wire=prepareWarp(scene.cut([[271,0],[282,0],[283,18],[293,40],[305,55],[315,62],[327,60],[334,48],[339,29],[342,0],[351,0],[348,30],[341,53],[330,68],[318,73],[306,69],[293,57],[283,40],[276,21]],(r,g,b)=>Math.max(r,g,b)<94,true,9,undefined,false,true),(x,y)=>{const f=smooth(y/68);return[f,f];});
  yield;
  const groups=[
   {id:'underdesk-top',x:350,y:600,w:67,h:14,color:(r,g,b)=>r>150&&g>140&&b<140},
   {id:'underdesk-bottom',x:361,y:642,w:64,h:20,color:(r,g,b)=>r>155&&g>100&&r>b*1.4},
   {id:'right-orange-drive',x:1434,y:511,w:63,h:14,color:(r,g,b)=>r>145&&r>g*1.2&&r>b*1.6},
   {id:'right-lower-led',x:1441,y:573,w:64,h:14,color:(r,g,b)=>g>110&&g>r*1.4&&g>b*1.12},
  ];
  this.indicators=groups.map(g=>{const s=scene.cut([[g.x,g.y],[g.x+g.w,g.y],[g.x+g.w,g.y+g.h],[g.x,g.y+g.h]],g.color,false);const ctx=s.canvas.getContext('2d');ctx.globalCompositeOperation='source-atop';ctx.fillStyle='#000';ctx.fillRect(0,0,s.w,s.h);ctx.globalCompositeOperation='source-over';return{...s,id:g.id};});
  yield;
 }
 draw(ctx,time){
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
  const bob=1.15*Math.sin(time*1.35),roll=.024*Math.sin(time*.85);
  ctx.save();ctx.translate(929,454+bob);ctx.rotate(roll);ctx.drawImage(this.probe.canvas,this.probe.x-929,this.probe.y-454);
  ctx.save();ctx.translate(936-929,427-454);ctx.rotate(.07*Math.sin(time*2.1));ctx.drawImage(this.aerial.canvas,this.aerial.x-936,this.aerial.y-427);ctx.restore();
  const look=Math.sin(time*.65)*1.1;ctx.fillStyle='rgba(125,221,241,.6)';
  ctx.fillRect(915-929+look,432-454,2,2);ctx.fillRect(938-929+look,431-454,2,2);ctx.restore();
  drawWarp(ctx,this.wire,2.2*Math.sin(time*.73),.45*Math.sin(time*1.1));
  for(let n=0;n<this.indicators.length;n++){
   const s=this.indicators[n];
   // Independent drive activity; one narrow moving activity band, or brief reads.
   const read=n===0?Math.max(0,Math.sin(time*1.6))**8:n===1?Math.max(0,Math.sin(time*3.2+1))**7:Math.max(0,Math.sin(time*(2.1+n*.3)+n))**5;
   ctx.globalAlpha=.64*(1-read);ctx.drawImage(s.canvas,s.x,s.y);
  }
  ctx.globalAlpha=1;
  // Tiny desk device, pixel status rows aligned to the front-panel perspective.
  ctx.save();ctx.transform(1,.025,-.045,1,481,520);ctx.fillStyle='#15232d';ctx.fillRect(0,0,33,25);
  for(let row=0;row<4;row++)for(let col=0;col<6;col++){
   const active=(col+row+Math.floor(time*2.3))%7<3;ctx.fillStyle=active?(row===0?'#e1ad5d':'#4a9cb1'):'#263c49';ctx.fillRect(col*5+1,row*5+2,3,2);
  }
  ctx.restore();
  // Smaller, slower steam at the yellow cup on the right monitor.
  for(let i=0;i<2;i++){
   const p=((time+i*2.1)%4.2)/4.2,fade=Math.sin(p*Math.PI)**2;
   ctx.fillStyle=`rgba(241,235,205,${fade*.52})`;
   for(let j=0;j<4;j++)ctx.fillRect(Math.round(1480+Math.sin(p*7+j)*2+p*6),Math.round(354-p*27+j*2),1,2);
  }
  const beacon=Math.exp(-(((time%5.2-4.4)/.15)**2));
  if(beacon>.01){ctx.fillStyle=`rgba(255,104,75,${beacon*.9})`;ctx.fillRect(1190,345,3,2);}
  ctx.restore();
 }
 dispose(){for(const s of[this.probe,this.aerial,this.wire,...this.indicators])s.canvas.width=s.canvas.height=1;this.wire=null;this.indicators=[];}
}
