const assert=require('node:assert/strict');
const{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({reducedMotion:'reduce'});await page.goto(process.env.TEST_ORIGIN||'http://127.0.0.1:8081');await page.waitForSelector('.scene-ready');
 const result=await page.evaluate(async()=>{
  const{PixelScene}=await import('./pixel-scene.js?v=20261111-layer44'),image=document.querySelector('#scene-image'),r=await PixelScene.create(image,document.createElement('canvas')),c=r.clouds[0],ctx=r.ctx;
  const source=document.createElement('canvas');source.width=1536;source.height=1024;const sc=source.getContext('2d');sc.drawImage(image,0,0);const original=sc.getImageData(0,0,1536,1024).data,mask=c.mask.getContext('2d').getImageData(0,0,c.w,c.h).data;
  const boxes={monitorRim:[594,365,12,2],boardRim:[579,214,2,13],deskVessel:[622,378,15,19],shore:[690,396,25,3],whiteFlyingObject:[765,402,10,8],cityCrown:[1177,355,14,12],narrowTower:[1225,388,10,12],hangingPot:[1320,132,20,20],sillPot:[1438,251,7,13]},leaks={};
  for(const[key,[x,y,w,h]]of Object.entries(boxes)){let n=0;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)if(mask[((py-c.y)*c.w+px-c.x)*4+3])n++;leaks[key]=n;}
  ctx.drawImage(r.base,0,0);r.extras.draw(ctx,0);const restored=ctx.getImageData(0,0,1536,1024).data;let leafRestoreError=0,duplicates=0,leafPixels=0,clippedAlpha=0;const occupied=new Set();
  for(const m of r.foliageMattes)for(let n=0;n<m.removed.length;n++)if(m.removed[n]){const i=((m.y+Math.floor(n/m.w))*1536+m.x+n%m.w)*4;for(let ch=0;ch<3;ch++)leafRestoreError=Math.max(leafRestoreError,Math.abs(restored[i+ch]-original[i+ch]));}
  for(const leaf of r.extras.leaves)for(let n=0;n<leaf.source.length/4;n++)if(leaf.source[n*4+3]){const i=(leaf.y+Math.floor(n/leaf.w))*1536+leaf.x+n%leaf.w;if(occupied.has(i))duplicates++;occupied.add(i);leafPixels++;}
  for(let t=0;t<=6;t+=.25){r.extras.draw(ctx,t);for(const leaf of r.extras.leaves){const p=leaf.ctx.getImageData(0,0,leaf.w,leaf.h).data;for(let x=0;x<leaf.w;x++)clippedAlpha=Math.max(clippedAlpha,p[x*4+3],p[((leaf.h-1)*leaf.w+x)*4+3]);for(let y=0;y<leaf.h;y++)clippedAlpha=Math.max(clippedAlpha,p[y*leaf.w*4+3],p[(y*leaf.w+leaf.w-1)*4+3]);}}
  const beacon=r.beacon,glow=beacon.glowMask.getContext('2d').getImageData(0,0,144,132).data;let haloEdge=0,haloGridError=0;const levels=new Set();
  for(let y=0;y<132;y++)for(let x=0;x<144;x++){const a=glow[(y*144+x)*4+3];levels.add(a);if(x===0||x===143||y===0||y===131)haloEdge=Math.max(haloEdge,a);haloGridError=Math.max(haloGridError,Math.abs(a-glow[((y-y%2)*144+x-x%2)*4+3]));}
  await r.setTimeOfDay('night');const changes={};
  for(const [key,t,night]of[['low',0,true],['high',.4,true],['day',.4,false]]){
   ctx.drawImage(r.base,0,0);const before=ctx.getImageData(105,11,144,132).data;beacon.draw(ctx,t,night);const after=ctx.getImageData(105,11,144,132).data;let sum=0,count=0;
   for(let y=0;y<132;y++)for(let x=0;x<144;x++){const d=Math.hypot(x-72,y-66);if(d<38||d>58)continue;const i=(y*144+x)*4;for(let ch=0;ch<3;ch++)sum+=after[i+ch]-before[i+ch];count+=3;}changes[key]=sum/count;
  }
  r.dispose();return{leaks,leafPixels,leafRestoreError,duplicates,clippedAlpha,haloEdge,haloGridError,haloLevels:levels.size,changes};
 });
 for(const[key,n]of Object.entries(result.leaks))assert.equal(n,0,`${key}: sky cuts through the foreground`);
 assert(result.leafPixels>5000);assert.equal(result.duplicates,0,'one source pixel belongs to only one moving leaf');assert.equal(result.leafRestoreError,0,'neutral pose exactly restores complete original leaf pixels');assert.equal(result.clippedAlpha,0,'swaying contours fit inside the full motion cache');
 assert.equal(result.haloEdge,0,'no rectangular light boundary');assert.equal(result.haloGridError,0,'halo uses crisp two-pixel blocks');assert(result.haloLevels<40,'light uses discrete shade steps');assert(result.changes.high>result.changes.low*1.2,'surrounding light breathes with the core');assert(result.changes.low>0,'night light reaches nearby surfaces');assert.equal(result.changes.day,0,'daytime lighting does not inherit night bloom');
 console.log('PASS complete foreground silhouettes, unique/restorable leaf contours, unclipped sway and pixel-stepped breathing light',JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
