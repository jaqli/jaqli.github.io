const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({reducedMotion:'reduce',timezoneId:'UTC'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 p.setDefaultTimeout(30000);
 await p.clock.setFixedTime(new Date('2026-11-12T17:30:00Z'));await p.goto(process.env.TEST_ORIGIN||'http://127.0.0.1:8081');await p.waitForSelector('.scene-ready');
 const result=await p.evaluate(async()=>{
  const{PixelScene}=await import('./pixel-scene.js?v=20261112-face55'),{accentShapes,accentRegions}=await import('./scene-accents.js?v=20261112-motion54');
  const image=document.querySelector('#scene-image'),r=await PixelScene.create(image,document.createElement('canvas')),a=r.accents,c=r.ctx;
  const shapes=r.details.filter(s=>accentShapes.some(shape=>shape.id===s.shape.id));
  const draw=t=>{c.drawImage(r.base,0,0);for(const s of shapes)r.drawDetail(s,t);a.draw(c,t);};
  const pixels=()=>c.getImageData(0,0,1536,1024).data;
  const diff=(before,after,[x,y,w,h])=>{let sum=0;for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)for(let ch=0;ch<3;ch++)sum+=Math.abs(before[(row*1536+col)*4+ch]-after[(row*1536+col)*4+ch]);return sum/(w*h*3);};
  const source=document.createElement('canvas');source.width=1536;source.height=1024;source.getContext('2d').drawImage(image,0,0);const original=source.getContext('2d').getImageData(0,0,1536,1024).data;
  draw(0);const before=pixels(),restored={};
  for(const s of shapes){
   const mask=s.canvas.getContext('2d').getImageData(0,0,s.w,s.h).data;let error=0;
   for(let n=0;n<s.w*s.h;n++)if(mask[n*4+3]===255){const i=((s.y+Math.floor(n/s.w))*1536+s.x+n%s.w)*4;for(let ch=0;ch<3;ch++)error=Math.max(error,Math.abs(original[i+ch]-before[i+ch]));}
   restored[s.shape.id]=error;
  }
  const changes=Object.fromEntries(Object.keys(accentRegions).map(id=>[id,0]));
  const fixed={plantPot:[1019,579,35,14],cup:[360,519,45,30],speakerRim:[1354,550,2,20],laptopShell:[1358,515,10,19],rightCabinet:[1361,611,10,45],deskLeg:[536,590,6,40],window:[839,170,9,100],grayPadRim:[280,866,20,12],grayPadWater:[235,887,50,4]};
  const anchors=Object.fromEntries(Object.keys(fixed).map(id=>[id,0]));
  for(const t of[.31,.7,1.9,2.4,3.1,5.8,8.4]){
   draw(t);const current=pixels();for(const[k,box]of Object.entries(accentRegions))changes[k]=Math.max(changes[k],diff(before,current,box));
   for(const[k,box]of Object.entries(fixed))anchors[k]=Math.max(anchors[k],diff(before,current,box));
  }
  // Every physical sprite returns the complete original art at rest. Screen
  // content alone may change; surrounding cases, pots, frames and cup stay put.
  let maxStep=0;
  for(const start of[.4,2.2,4.3]){let last;for(let n=0;n<15;n++){
   c.drawImage(r.base,0,0);for(const s of shapes)r.drawDetail(s,start+n/60);const now=pixels();
   if(last)for(const s of shapes){const[x,y,w,h]=accentRegions[s.shape.id];for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)for(let ch=0;ch<3;ch++)maxStep=Math.max(maxStep,Math.abs(now[(py*1536+px)*4+ch]-last[(py*1536+px)*4+ch]));}last=now;
  }}
  // Only the already masked material can catch either moving reflection.
  let reflectionLeak=0;for(const s of a.reflections){const mask=s.mask.getContext('2d').getImageData(0,0,s.w,s.h).data;for(const t of[0,2,4,6]){a.update(t);const data=s.ctx.getImageData(0,0,s.w,s.h).data;for(let i=3;i<data.length;i+=4)if(!mask[i])reflectionLeak=Math.max(reflectionLeak,data[i]);}}
  const canvases=[...a.panels,...a.indicators,...a.reflections,a.plant,...shapes].map(s=>s.canvas);canvases.push(a.cone,...a.reflections.map(s=>s.mask));
  const bytes=[...new Set(canvases)].reduce((n,c)=>n+c.width*c.height*4,0);
  const read=CanvasRenderingContext2D.prototype.getImageData,create=document.createElement;
  CanvasRenderingContext2D.prototype.getImageData=()=>{throw new Error('per-frame readback');};document.createElement=()=>{throw new Error('per-frame allocation');};
  const costs=[];try{for(let n=0;n<180;n++){const start=performance.now();a.draw(c,n/60);costs.push(performance.now()-start);}}finally{CanvasRenderingContext2D.prototype.getImageData=read;document.createElement=create;}
  draw(1.23);const still=r.canvas.toDataURL();draw(1.23);const deterministic=still===r.canvas.toDataURL();
  const colors={};draw(0);const dusk=pixels();for(const mode of['night','dawn','noon','dusk']){await r.setTimeOfDay(mode);draw(0);colors[mode]=diff(dusk,pixels(),[0,0,1536,1024]);}
  costs.sort((a,b)=>a-b);r.dispose();return{changes,anchors,restored,maxStep,reflectionLeak,canvasBytes:bytes,medianMs:costs[90],p95Ms:costs[171],deterministic,colors};
 });
 console.log(JSON.stringify(result));
 assert.equal(Object.keys(result.changes).length,18);for(const[k,v]of Object.entries(result.changes))assert(v>.01,`${k} should visibly animate (${v})`);
 for(const[k,v]of Object.entries(result.anchors))assert.equal(v,0,`${k} must stay anchored`);
 for(const[k,v]of Object.entries(result.restored))assert(v<.001,`${k} must preserve its entire source at rest (${v})`);
 assert(result.maxStep<=32,`moving sprite rows must not split or scan (${result.maxStep})`);assert.equal(result.reflectionLeak,0);
 assert(result.canvasBytes<180000,'new textures must stay below 176 KiB');assert(result.deterministic);
 assert(result.colors.night>30);assert(result.colors.dusk<.001,'returning to dusk restores all new textures without cumulative tint');
 assert.deepEqual(errors,[]);console.log('PASS 18 new regions, fixed borders/roots, original artwork, continuous motion, bounded caches and four lighting modes');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
