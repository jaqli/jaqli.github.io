const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
const snapshot=page=>page.locator('#ascii-canvas').evaluate(c=>c.toDataURL());
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
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
 assert(!resources.some(url=>/glyph-|ascii-renderer|scene-worker|scene-ambience|scene-preview/.test(url)),'full-room character machinery must not load');
 const still=await snapshot(page);await page.waitForTimeout(180);assert.equal(await snapshot(page),still,'reduced motion starts with a still picture');
 const regions=await page.evaluate(async()=>{
  const {PixelScene}=await import('./pixel-scene.js?v=20261111-surface37');
  const canvas=document.createElement('canvas'),r=await PixelScene.create(document.querySelector('#scene-image'),canvas);
  const reference=document.createElement('canvas');reference.width=1536;reference.height=1024;reference.getContext('2d').drawImage(document.querySelector('#scene-image'),0,0);
  const source=reference.getContext('2d').getImageData(0,0,1536,1024).data;
  r.draw(0);const before=r.ctx.getImageData(0,0,1536,1024).data;
  // Keep the skyline sample inside the building, excluding its moving sky.
  const boxes={wall:[15,95,30,40],person:[810,520,30,35],city:[1180,380,23,40],frame:[837,85,12,300],
   code:[445,385,145,80],wave:[342,422,88,52],plot:[648,448,53,35],
   water:[1020,575,85,30],duck:[305,805,99,50],paper:[400,265,30,25],
   eyes:[140,428,41,22],lamp:[155,56,48,43],redEye:[275,213,32,21],leftFace:[312,660,38,23],rightFace:[1464,391,52,35],cloud:[634,180,100,90],bird:[939,223,102,60]};
  const diff=(a,b,[x,y,w,h])=>{let sum=0;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)for(let c=0;c<3;c++)sum+=Math.abs(a[(py*1536+px)*4+c]-b[(py*1536+px)*4+c]);return sum/(w*h*3);};
  const result=Object.fromEntries(Object.entries(boxes).map(([name,box])=>[name,{motion:0,source:diff(before,source,box)}]));
  for(const time of [.9,2.35,4.2]){r.draw(time);const after=r.ctx.getImageData(0,0,1536,1024).data;for(const [name,box]of Object.entries(boxes))result[name].motion=Math.max(result[name].motion,diff(before,after,box));}
  // The original, stationary sky must never bleed through the moving clouds.
  // Deliberately change the backing color, then compare the same sky frame.
  result.skyBleed=0;
  for(const time of [0,8,20,40]){
   r.ctx.fillStyle='#ff00ff';r.ctx.fillRect(0,0,1536,1024);r.drawClouds(time);const a=r.ctx.getImageData(0,0,1536,1024).data;
   r.ctx.fillStyle='#00ff00';r.ctx.fillRect(0,0,1536,1024);r.drawClouds(time);const b=r.ctx.getImageData(0,0,1536,1024).data;
   result.skyBleed=Math.max(result.skyBleed,diff(a,b,boxes.cloud));
  }
  r.dispose();reference.width=reference.height=1;return result;
 });
 for(const name of ['wall','person','city','frame']){assert.equal(regions[name].motion,0,`${name} remains still`);assert.equal(regions[name].source,0,`${name} preserves original pixels and color`);}
 assert.equal(regions.skyBleed,0,'moving sky must completely replace the original clouds');
 for(const name of ['code','wave','plot','water','duck','paper','eyes','lamp','redEye','leftFace','rightFace','cloud','bird'])assert(regions[name].motion>.05,`${name} should move or change`);
 console.log('PASS unchanged original colors in wall/person/city; local screen, sky, water, object and light animation',JSON.stringify(regions));
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
 assert.equal(crop.y,0,'wide scenes keep the entire top edge');assert(crop.y+crop.height>700,'only the bottom overflows');
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.waitForSelector('.scene-ready');
 assert(await page.locator('#pan-hint').isVisible());
 assert.deepEqual(await page.locator('#ascii-canvas').evaluate(c=>[c.width,c.height]),[1536,1024]);
 await page.locator('#scene-viewport').evaluate(e=>e.scrollLeft=450);
 assert(await page.locator('#scene-viewport').evaluate(e=>e.scrollLeft>400));
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(120);
 assert.equal((await page.locator('#scene-world').boundingBox()).y,0,'rotation keeps the scene top-aligned');
 assert.deepEqual(await page.locator('#ascii-canvas').evaluate(c=>[c.width,c.height]),[1536,1024]);
 const alignment=await page.evaluate(()=>{const a=document.querySelector('#ascii-canvas').getBoundingClientRect(),b=document.querySelector('#hotspots').getBoundingClientRect();return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.width-b.width)+Math.abs(a.height-b.height);});assert(alignment<1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS mobile pan, rotation, native texture budget and aligned hit areas; no JS/HTTP errors');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
