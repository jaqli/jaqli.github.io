const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
const shot=p=>p.evaluate(()=>['ascii-canvas','screen-canvas'].map(id=>document.getElementById(id).toDataURL()).join('|'));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(origin);await page.waitForSelector('.scene-ready');
 const motion=await page.evaluate(async()=>{
  const{PixelScene}=await import('./pixel-scene.js?v=20261112-pixel51'),{additionalMotionRegions,additionalShapes}=await import('./scene-additions.js?v=20261111-edge48');
  const canvas=document.createElement('canvas'),r=await PixelScene.create(document.querySelector('#scene-image'),canvas),ctx=r.ctx;
  const moving=r.details.filter(s=>additionalShapes.some(a=>a.id===s.shape.id));
  const draw=t=>{ctx.drawImage(r.base,0,0);for(const s of moving)r.drawDetail(s,t);r.additions.draw(ctx,t);r.extras.draw(ctx,t);};
  const regions={...additionalMotionRegions,observer:[870,376,99,94],hangingLeaves:[1247,66,149,89],windowLeaves:[1415,213,86,33]};
  draw(0);const first=ctx.getImageData(0,0,1536,1024).data;
  const diff=(a,b,[x,y,w,h])=>{let sum=0;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)for(let c=0;c<3;c++)sum+=Math.abs(a[(py*1536+px)*4+c]-b[(py*1536+px)*4+c]);return sum/(w*h*3);};
  const changes=Object.fromEntries(Object.keys(regions).map(k=>[k,0]));let pot=0;
  for(const t of[.7,1.5,2.8,4.4,6.1,9.2]){draw(t);const data=ctx.getImageData(0,0,1536,1024).data;for(const[k,box]of Object.entries(regions))changes[k]=Math.max(changes[k],diff(first,data,box));pot=Math.max(pot,diff(first,data,[1310,145,32,17]));}
  const fan=r.extras.fan,blade=fan.blade.getContext('2d').getImageData(0,0,88,88).data;let opaque=0;
  for(let i=3;i<blade.length;i+=4)if(blade[i])opaque++;
  const cage=fan.cage.toDataURL(),back=fan.back.toDataURL();for(let t=0;t<2;t+=.1)fan.draw(ctx,t);
  const staticFan=cage===fan.cage.toDataURL()&&back===fan.back.toDataURL();
  const steps={};
  for(const s of moving.filter(s=>s.shape.kind==='float')){
   let max=0;for(const start of[.5,2,4]){let previous;for(let n=0;n<12;n++){
    ctx.drawImage(r.base,0,0);r.drawDetail(s,start+n/60);const pixels=ctx.getImageData(s.x-8,s.y-8,s.w+16,s.h+16).data;
    if(previous)for(let i=0;i<pixels.length;i++)if(i%4!==3)max=Math.max(max,Math.abs(pixels[i]-previous[i]));previous=pixels;
   }}steps[s.shape.id]=max;
  }
  r.draw(0);const original=ctx.getImageData(0,0,1536,1024).data,colors={};
  let backupCount=0,backupBytes=0;
  for(const mode of['night','dawn','noon','dusk']){
   await r.setTimeOfDay(mode);r.draw(0);const pixels=ctx.getImageData(0,0,1536,1024).data;
   let sum=0;for(let y=85;y<340;y+=5)for(let x=870;x<1250;x+=5){const i=(y*1536+x)*4;sum+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;}
   colors[mode]={skyLuma:sum/(51*76),change:diff(original,pixels,[0,0,1536,1024])};
   if(backupCount&&backupCount!==r.timeOfDay.assets.length)throw new Error('theme cache grows per selection');
   backupCount=r.timeOfDay.assets.length;backupBytes=r.timeOfDay.assets.reduce((n,a)=>n+a.original.data.byteLength,0)+r.timeOfDay.skySource.byteLength;
  }
  // Captured theme sources are restored on return to dusk; no cumulative tint.
  const readback=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=()=>{throw new Error('animation pixel readback');};
  try{for(let n=0;n<30;n++)r.draw(n/60);}finally{CanvasRenderingContext2D.prototype.getImageData=readback;}
  r.dispose();return{changes,pot,bladeCoverage:opaque/(88*88),staticFan,steps,colors,backupCount,backupBytes};
 });
 assert.equal(Object.keys(motion.changes).length,18);
 for(const[id,v]of Object.entries(motion.changes))assert(v>.01,`${id} must visibly change (${v})`);
 assert.equal(motion.pot,0,'hanging plant pot stays anchored');
 assert(motion.bladeCoverage>.035&&motion.bladeCoverage<.18,'rotating source is one isolated blade, not a disk');assert(motion.staticFan,'backdrop and grille never rotate');
 for(const[id,v]of Object.entries(motion.steps))assert(v<32,`${id} must not scan or split (${v})`);
 assert(motion.colors.night.skyLuma<motion.colors.dusk.skyLuma*.55,'night sky must become dark');
 assert(motion.colors.noon.skyLuma>motion.colors.night.skyLuma*2.5,'noon and night should be distinct');
 assert(motion.colors.dawn.change>5&&motion.colors.noon.change>5,JSON.stringify(motion.colors));
 assert(motion.colors.dusk.change<.015,'return to dusk must restore original colors without cumulative shifts');
 assert(motion.backupBytes<13*1024*1024,'store one scene source backup, not four full scenes');
 console.log('PASS 15 additional motions, observer, flexible foliage, isolated fan blades, continuous props and reversible lighting',JSON.stringify(motion));
 const pictures=[];for(const mode of['night','dawn','noon','dusk']){
  await page.locator(`[data-time="${mode}"]`).click();await page.waitForFunction(m=>document.body.dataset.sceneTime===m&&!document.querySelector('.scene-time').hasAttribute('aria-busy'),mode);
  assert.equal(await page.locator(`[data-time="${mode}"]`).getAttribute('aria-pressed'),'true');
  const before=await shot(page);await page.waitForTimeout(100);assert.equal(await shot(page),before,'changing time while paused stays paused');pictures.push(before);
 }
 assert.equal(new Set(pictures).size,4);
 await page.locator('[data-time="night"]').click();await page.waitForFunction(()=>document.body.dataset.sceneTime==='night');
 await page.reload();await page.waitForSelector('.scene-ready');assert.equal(await page.locator('body').getAttribute('data-scene-time'),'night');
 assert.equal(await page.evaluate(()=>localStorage.getItem('jaqli.scene-time')),'night');
 await page.locator('[data-hotspot="cv"] .hotspot-label').click();await page.waitForURL(`${origin}/cv/`);await page.goBack();await page.waitForSelector('.scene-ready');assert.equal(await page.locator('body').getAttribute('data-scene-time'),'night');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const controls=await page.locator('.scene-time').boundingBox();assert(controls.x>=0&&controls.x+controls.width<=390);
 // A denied storage backend must not prevent a manual selection.
 const blocked=await browser.newPage({reducedMotion:'reduce'});await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('denied');}});});
 await blocked.goto(origin);await blocked.waitForSelector('.scene-ready');await blocked.locator('[data-time="dawn"]').click();await blocked.waitForFunction(()=>document.body.dataset.sceneTime==='dawn');await blocked.close();
 assert.deepEqual(errors,[]);console.log('PASS four selectable scenes, pause, remembered choice, history, mobile controls and denied-storage fallback');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
