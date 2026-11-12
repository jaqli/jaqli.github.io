const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
const snapshot=page=>page.evaluate(()=>['ascii-canvas','screen-canvas'].map(id=>document.getElementById(id).toDataURL()).join('|'));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{
  window.pixelFrames=[];window.pixelLongTasks=[];
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(this.canvas.id==='ascii-canvas'&&source instanceof HTMLCanvasElement&&source.width===1536&&source.height===1024)pixelFrames.push(performance.now());return draw.call(this,source,...args);};
  new PerformanceObserver(list=>pixelLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
 });
 await page.goto(origin);await page.waitForSelector('.scene-ready');
 assert.equal(await page.locator('#ascii-canvas').getAttribute('data-renderer'),'pixel');
 assert.equal(await page.locator('#ascii-canvas').getAttribute('data-pixel-unit'),'1.5');
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
 assert(!resources.some(url=>/glyph-|ascii-renderer|scene-worker|scene-ambience|scene-preview/.test(url)),'full-room character machinery must not load');
 const still=await snapshot(page);await page.waitForTimeout(180);assert.equal(await snapshot(page),still,'reduced motion starts with a still picture');
 const displays=await page.locator('#screen-canvas').evaluate(c=>{
  const ctx=c.getContext('2d'),at=(x,y)=>ctx.getImageData((x-325)*3,(y-335)*3,1,1).data[3];
  return{size:[c.width,c.height],sampling:getComputedStyle(c).imageRendering,code:at(470,402),hair:at(722,472),paper:at(475,477)};
 });
 assert.deepEqual(displays.size,[1260,570]);assert.equal(displays.sampling,'auto');
 assert(displays.code>240&&displays.hair<10&&displays.paper<10,'sharp displays stay behind hair and the paper');
 const regions=await page.evaluate(async()=>{
  const {PixelScene}=await import('./pixel-scene.js?v=20261112-cycle52');
  const canvas=document.createElement('canvas'),r=await PixelScene.create(document.querySelector('#scene-image'),canvas);
  const reference=document.createElement('canvas');reference.width=1536;reference.height=1024;reference.getContext('2d').drawImage(document.querySelector('#scene-image'),0,0);
  const nativeSource=reference.getContext('2d').getImageData(0,0,1536,1024).data;
  const grid=document.createElement('canvas');grid.width=1024;grid.height=683;const gc=grid.getContext('2d');gc.imageSmoothingEnabled=false;gc.drawImage(reference,0,0,1024,683);
  const rc=reference.getContext('2d');rc.imageSmoothingEnabled=false;rc.drawImage(grid,0,0,1536,1024);
  const source=rc.getImageData(0,0,1536,1024).data;
  r.draw(0);const before=r.ctx.getImageData(0,0,1536,1024).data;
  // Keep the skyline sample inside the building, excluding its moving sky.
  const boxes={wall:[15,95,30,40],person:[810,520,30,35],city:[1180,380,23,40],frame:[837,85,12,300],
   code:[445,385,145,80],wave:[342,422,88,52],plot:[648,448,53,35],
   water:[1020,575,85,30],duck:[305,805,99,50],paper:[400,265,30,25],
   eyes:[140,428,41,22],lamp:[155,56,48,43],redEye:[275,213,32,21],leftFace:[312,660,38,23],rightFace:[1464,391,52,35],cloud:[634,180,100,90],bird:[939,223,102,60]};
  const diff=(a,b,[x,y,w,h])=>{let sum=0;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)for(let c=0;c<3;c++)sum+=Math.abs(a[(py*1536+px)*4+c]-b[(py*1536+px)*4+c]);return sum/(w*h*3);};
  // A fractional source-pixel step uses an integer 1024×683 working grid.
  // Verify the entire displayed image is its nearest-neighbor expansion.
  rc.drawImage(r.pixelGrid,0,0,1536,1024);const expanded=rc.getImageData(0,0,1536,1024).data;
  let gridError=0;for(let i=0;i<before.length;i++)gridError=Math.max(gridError,Math.abs(before[i]-expanded[i]));
  const result=Object.fromEntries(Object.entries(boxes).map(([name,box])=>[name,{motion:0,source:diff(before,source,box)}]));
  // These source landmarks were left behind by incomplete extraction masks.
  // Each must now belong completely to its prop, and leave water underneath.
  result.gridError=gridError;result.gridSize=[r.pixelGrid.width,r.pixelGrid.height];result.edges={};
  const landmarks={tablet:[[1081,812],[1094,822],[1107,832]],'foreground-page':[[506,905],[526,913]],
   'floating-pages':[[607,831],[618,837]],'blue-can':[[598,753],[603,779]],
   phone:[[823,957]],'yellow-card':[[536,896]],'water-controller':[[1244,974]]};
  for(const[id,points]of Object.entries(landmarks)){
   const sprite=r.details.find(s=>s.shape.id===id),ctx=sprite.canvas.getContext('2d');
   result.edges[id]=points.map(([x,y])=>{
    const pixel=ctx.getImageData(x-sprite.x,y-sprite.y,1,1).data,base=r.base.getContext('2d').getImageData(x,y,1,1).data;
    return{alpha:pixel[3],removed:Math.max(...[0,1,2].map(c=>Math.abs(base[c]-nativeSource[(y*1536+x)*4+c])))};
   });
  }
  for(const time of [.9,2.35,4.2]){r.draw(time);const after=r.ctx.getImageData(0,0,1536,1024).data;for(const [name,box]of Object.entries(boxes))result[name].motion=Math.max(result[name].motion,diff(before,after,box));}
  // The original, stationary sky must never bleed through the moving clouds.
  // Deliberately change the backing color, then compare the same sky frame.
  result.skyBleed=0;
  for(const time of [0,8,20,40]){
   r.ctx.fillStyle='#ff00ff';r.ctx.fillRect(0,0,1536,1024);r.drawClouds(time);const a=r.ctx.getImageData(0,0,1536,1024).data;
   r.ctx.fillStyle='#00ff00';r.ctx.fillRect(0,0,1536,1024);r.drawClouds(time);const b=r.ctx.getImageData(0,0,1536,1024).data;
   result.skyBleed=Math.max(result.skyBleed,diff(a,b,boxes.cloud));
  }
  // A slow rigid bob must not switch a whole source row at once. At 60 Hz,
  // nearest-neighbor rotation produced 200+ channel jumps in these real props.
  result.propSteps={};
  for(const id of ['tablet','foreground-page','water-controller','duck']){
   const sprite=r.details.find(s=>s.shape.id===id),x=sprite.x-12,y=sprite.y-12,w=sprite.w+24,h=sprite.h+24;
   let maxStep=0;
   for(const start of [.5,1.5,3.5,5.5]){
    let previous;
    for(let frame=0;frame<15;frame++){
     r.ctx.drawImage(r.base,0,0);r.drawDetail(sprite,start+frame/60);
     const data=r.ctx.getImageData(x,y,w,h).data;
     if(previous)for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)maxStep=Math.max(maxStep,Math.abs(data[i+c]-previous[i+c]));
     previous=data;
    }
   }
   result.propSteps[id]=maxStep;
  }
  r.dispose();reference.width=reference.height=1;return result;
 });
 for(const name of ['wall','person','city','frame']){assert.equal(regions[name].motion,0,`${name} remains still`);assert.equal(regions[name].source,0,`${name} preserves original colors on the requested 1.5×1.5 grid`);}
 assert.deepEqual(regions.gridSize,[1024,683],'fractional pixel grid has the expected dimensions');
 assert.equal(regions.gridError,0,'all composited layers share an exact 1.5×1.5 pixel grid');
 assert.equal(regions.skyBleed,0,'moving sky must completely replace the original clouds');
 for(const[id,points]of Object.entries(regions.edges))for(const point of points){assert.equal(point.alpha,255,`${id} must carry its entire edge`);assert(point.removed>30,`${id} must not leave a stationary edge on the base`);}
 for(const [id,step] of Object.entries(regions.propSteps))assert(step<=32,`${id} must move continuously without a column snapping to another pixel row (jump ${step})`);
 for(const name of ['code','wave','plot','water','duck','paper','eyes','lamp','redEye','leftFace','rightFace','cloud','bird'])assert(regions[name].motion>.05,`${name} should move or change`);
 console.log('PASS uniform 1.5×1.5 pixels and source colors in wall/person/city; local screen, sky, water, object and light animation',JSON.stringify(regions));
 await page.locator('#pause').click();await page.waitForTimeout(300);
 await page.evaluate(()=>{pixelFrames.length=0;pixelLongTasks.length=0;});await page.waitForTimeout(1800);
 const performanceData=await page.evaluate(()=>{const dt=pixelFrames.slice(1).map((t,i)=>t-pixelFrames[i]).sort((a,b)=>a-b);return {fps:Math.round((pixelFrames.length-1)*1000/(pixelFrames.at(-1)-pixelFrames[0])),p95Ms:Math.round(dt[Math.floor(dt.length*.95)]),longTasks:pixelLongTasks.length};});
 const tech=page.locator('[data-hotspot="tech"] .hotspot-label');await tech.hover();
 assert.notEqual(await page.locator('[data-hotspot="tech"] .hit-area').evaluate(e=>getComputedStyle(e).stroke),'rgba(0, 0, 0, 0)');
 await page.locator('#pause').click();const paused=await snapshot(page);await page.waitForTimeout(150);assert.equal(await snapshot(page),paused);
 assert.notEqual(paused,still);console.log('PASS playback, hover and full pause; observed render cadence',performanceData);
 await tech.click();await page.waitForURL(`${origin}/tech/`);await page.waitForSelector('.article-card');
 await page.goto(origin);await page.waitForSelector('.scene-ready');
 const duck=page.locator('[data-hotspot="life"]');assert.equal(await duck.locator('.hotspot-label').count(),0);
 await duck.locator('polygon').evaluate(e=>{const point=new DOMPoint(350,830).matrixTransform(e.getScreenCTM());window.duckTestPoint={x:point.x,y:point.y};});
 const point=await page.evaluate(()=>duckTestPoint);await page.mouse.click(point.x,point.y);await page.waitForURL(`${origin}/life/`);await page.waitForSelector('.article-card');
 console.log('PASS visible monitor and hidden duck entrances');
 await page.setViewportSize({width:1440,height:700});await page.goto(origin);await page.waitForSelector('.scene-ready');
 const crop=await page.locator('#scene-world').boundingBox();
 assert(Math.abs(crop.y*3+crop.height-700)<.1,'wide scenes split the top/bottom crop 1:2');assert(crop.y<0&&crop.y+crop.height>700,'excess height is cropped at both ends');
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.waitForSelector('.scene-ready');
 assert(await page.locator('#pan-hint').isVisible());
 assert.deepEqual(await page.locator('#ascii-canvas').evaluate(c=>[c.width,c.height]),[1536,1024]);
 await page.locator('#scene-viewport').evaluate(e=>e.scrollLeft=450);
 assert(await page.locator('#scene-viewport').evaluate(e=>e.scrollLeft>400));
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(120);
 const rotated=await page.locator('#scene-world').boundingBox();assert(Math.abs(rotated.y*3+rotated.height-390)<.1,'rotation retains the 1:2 crop split');
 assert.deepEqual(await page.locator('#ascii-canvas').evaluate(c=>[c.width,c.height]),[1536,1024]);
 const alignment=await page.evaluate(()=>{const a=document.querySelector('#ascii-canvas').getBoundingClientRect(),b=document.querySelector('#hotspots').getBoundingClientRect();return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.width-b.width)+Math.abs(a.height-b.height);});assert(alignment<1);
 const screenAlignment=await page.evaluate(()=>{const world=document.querySelector('#ascii-canvas').getBoundingClientRect(),screen=document.querySelector('#screen-canvas').getBoundingClientRect(),scale=world.width/1536;return Math.abs(screen.x-world.x-325*scale)+Math.abs(screen.y-world.y-335*scale)+Math.abs(screen.width-420*scale)+Math.abs(screen.height-190*scale);});assert(screenAlignment<1,'high-resolution displays follow pan, crop and rotation');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS mobile pan, rotation, native texture budget and aligned hit areas; no JS/HTTP errors');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
