const assert=require('node:assert/strict');
const{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({reducedMotion:'reduce'});await page.goto(process.env.TEST_ORIGIN||'http://127.0.0.1:8081');await page.waitForSelector('.scene-ready');
 const result=await page.evaluate(async()=>{
  const{PixelScene}=await import('./pixel-scene.js?v=20261112-book56'),image=document.querySelector('#scene-image'),r=await PixelScene.create(image,document.createElement('canvas')),c=r.clouds[0],ctx=r.ctx;
  const source=document.createElement('canvas');source.width=1536;source.height=1024;const sc=source.getContext('2d');sc.drawImage(image,0,0);const original=sc.getImageData(0,0,1536,1024).data,mask=c.mask.getContext('2d').getImageData(0,0,c.w,c.h).data;
  const boxes={leftWindowLitFace:[529,80,3,90],middleWindowFace:[836,190,10,210],rightWindowFace:[1367,190,10,210],monitorRim:[594,365,12,2],boardRim:[579,214,2,13],deskVessel:[622,378,15,19],whiteDisplayRim:[679,426,45,3],shelfSupport:[1421,310,10,110],bracketBar:[1407,334,7,1],bracketLeftLeg:[1405,337,1,11],bracketRightLeg:[1415,337,1,11],bracketInset:[1408,337,6,12],rearCityLightFace:[1411,351,3,28],robotHousing:[1448,383,10,42],rearTerminal:[1437,374,8,24],books:[1473,358,23,13],camera:[1518,336,8,8],cityCrown:[1185,359,10,8],cityAerial:[1191,330,1,15],restoredCity:[1415,356,3,25],narrowTower:[1225,388,10,12],hangingPot:[1320,132,20,20],sillPot:[1454,249,29,15],sillPotRight:[1485,248,1,12],sillToolTip:[1507,232,1,2],sillBoardFace:[1414,286,4,8],windowStrap:[800,180,2,28],windowLoop:[808,222,2,1],towerSupport:[1345,396,3,5],towerFixture:[1343,370,2,3],towerBase:[1334,407,18,4]},leaks={};
  for(const[key,[x,y,w,h]]of Object.entries(boxes)){let n=0;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)if(mask[((py-c.y)*c.w+px-c.x)*4+3])n++;leaks[key]=n;}
  const openSky={movingLeafBackdrop:[1382,98,2,4],middleFrameCyan:[832,110,3,1],middleFramePink:[832,350,3,1],middleFrameLowerCyan:[832,400,2,1],middleRightCyan:[857,110,1,1],rightFrameOldSky:[1382,230,2,190],rightFramePink:[1381,251,1,1],oldShore:[690,396,25,3],oldWhiteShape:[765,402,10,8],centerShore:[868,402,24,19],pillarBlueFringe:[1416,350,1,4],oldTowerHalo:[1173,377,3,13],vesselAerialFringe:[619,359,2,6],pillarTopRightFringe:[1435,310,2,20],blueBoardRim:[1400,280,1,1],paleBoardRim:[1394,290,1,1],sillLeftGap:[1423,245,1,5],sillTopGap:[1439,246,2,1],sillPotGap:[1444,249,2,3],sillStemGap:[1447,241,1,3],sillToolGap:[1490,246,3,8],sillLeafHole:[1431,261,1,1]},remaining={};
  for(const[key,[x,y,w,h]]of Object.entries(openSky)){let n=0;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)if(mask[((py-c.y)*c.w+px-c.x)*4+3]!==255)n++;remaining[key]=n;}
  const birdEdges={};for(const bird of r.birds){
   const pixels=bird.canvas.getContext('2d').getImageData(0,0,bird.w,bird.h).data;let cyanRim=0,solid=0;
   for(let y=1;y<bird.h-1;y++)for(let x=1;x<bird.w-1;x++){
    const i=(y*bird.w+x)*4;if(!pixels[i+3])continue;solid++;
    const edge=[i-4,i+4,i-bird.w*4,i+bird.w*4].some(j=>!pixels[j+3]);
    if(edge&&pixels[i+1]>85&&pixels[i+1]-pixels[i]>12&&pixels[i+2]-pixels[i]>12)cyanRim++;
   }
   birdEdges[bird.bird.id]={cyanRim,solid};
  }
  const expectedSky=document.createElement('canvas');expectedSky.width=c.w;expectedSky.height=c.h;const expectedSkyContext=expectedSky.getContext('2d');
  const localSkyError={};for(const mode of['dusk','dawn','noon','night']){
   await r.setTimeOfDay(mode);let error=0;
   for(const t of[0,.7,3.4,6.5]){
    ctx.drawImage(r.base,0,0);r.drawClouds(t);
    expectedSkyContext.clearRect(0,0,c.w,c.h);expectedSkyContext.drawImage(c.layer,0,0);if(r.haze)expectedSkyContext.drawImage(r.haze.canvas,r.haze.x-c.x,r.haze.y-c.y);
    const backdrop=expectedSkyContext.getImageData(0,0,c.w,c.h).data;
    for(const name of['movingLeafBackdrop','middleFrameCyan','middleFramePink','middleFrameLowerCyan','middleRightCyan','rightFrameOldSky','rightFramePink','sillLeftGap','sillTopGap','sillPotGap','sillStemGap','sillToolGap','sillLeafHole']){
     const[x,y,w,h]=openSky[name],rendered=ctx.getImageData(x,y,w,h).data;
     for(let py=0;py<h;py++)for(let px=0;px<w;px++)for(let ch=0;ch<3;ch++)error=Math.max(error,Math.abs(rendered[(py*w+px)*4+ch]-backdrop[((y+py-c.y)*c.w+x+px-c.x)*4+ch]));
    }
   }
   localSkyError[mode]=error;
  }
  await r.setTimeOfDay('dusk');
  const structureColors={};
  for(const name of['bracketInset','bracketLeftLeg','bracketRightLeg','rearCityLightFace']){
   const[x,y,w,h]=boxes[name],pixels=r.base.getContext('2d').getImageData(x,y,w,h).data;let error=0;
   for(let py=0;py<h;py++)for(let px=0;px<w;px++)for(let ch=0;ch<3;ch++)error=Math.max(error,Math.abs(pixels[(py*w+px)*4+ch]-original[((y+py)*1536+x+px)*4+ch]));
   structureColors[name]=error;
  }
  const horizonAlpha=[427,428,429].map(y=>mask[((y-c.y)*c.w+1000-c.x)*4+3]);
  const horizonPixel=Array.from(r.base.getContext('2d').getImageData(1010,445,1,1).data);
  const duck=r.details.find(s=>s.shape.id==='duck'),duckAlpha=duck.canvas.getContext('2d').getImageData(0,0,duck.w,duck.h).data;let missingDuck=0;
  for(let y=780;y<815;y++)for(let x=312;x<355;x++){
   const i=(y*1536+x)*4,n=((y-duck.y)*duck.w+x-duck.x)*4;
   if(original[i]>170&&original[i+1]>110&&original[i+2]<original[i+1]*.65&&!duckAlpha[n+3])missingDuck++;
  }
  const horizonSteps={};for(const mode of['dusk','dawn','noon','night']){
   await r.setTimeOfDay(mode);ctx.drawImage(r.base,0,0);r.drawClouds(3.2);const pixels=ctx.getImageData(980,423,100,16).data;let step=0;
   for(let y=1;y<16;y++)for(let x=0;x<100;x++)for(let ch=0;ch<3;ch++)step=Math.max(step,Math.abs(pixels[(y*100+x)*4+ch]-pixels[((y-1)*100+x)*4+ch]));
   horizonSteps[mode]=step;
  }
  await r.setTimeOfDay('dusk');
  const spriteEdges={};for(const s of r.details.filter(s=>['float','paper','hinge'].includes(s.shape.kind))){const pixels=s.canvas.getContext('2d').getImageData(0,0,s.w,s.h).data;let feather=0,border=0;for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){const a=pixels[(y*s.w+x)*4+3];if(a>0&&a<255)feather++;if(x===0||y===0||x===s.w-1||y===s.h-1)border+=a;}spriteEdges[s.shape.id]={feather,border};}
  ctx.drawImage(r.base,0,0);r.extras.draw(ctx,0);const restored=ctx.getImageData(0,0,1536,1024).data;let leafRestoreError=0,duplicates=0,leafPixels=0,clippedAlpha=0,leafSkyPixels=0;const occupied=new Set();
  for(const m of r.foliageMattes)for(let n=0;n<m.removed.length;n++)if(m.removed[n]){const i=((m.y+Math.floor(n/m.w))*1536+m.x+n%m.w)*4;for(let ch=0;ch<3;ch++)leafRestoreError=Math.max(leafRestoreError,Math.abs(restored[i+ch]-original[i+ch]));}
  for(const leaf of r.extras.leaves)for(let n=0;n<leaf.source.length/4;n++)if(leaf.source[n*4+3]){const i=(leaf.y+Math.floor(n/leaf.w))*1536+leaf.x+n%leaf.w;if(occupied.has(i))duplicates++;occupied.add(i);leafPixels++;const r=leaf.source[n*4],g=leaf.source[n*4+1],b=leaf.source[n*4+2];if(g>100&&b>=g&&b-r>15)leafSkyPixels++;}
  for(let t=0;t<=6;t+=.25){r.extras.draw(ctx,t);for(const leaf of r.extras.leaves){const p=leaf.ctx.getImageData(0,0,leaf.w,leaf.h).data;for(let x=0;x<leaf.w;x++)clippedAlpha=Math.max(clippedAlpha,p[x*4+3],p[((leaf.h-1)*leaf.w+x)*4+3]);for(let y=0;y<leaf.h;y++)clippedAlpha=Math.max(clippedAlpha,p[y*leaf.w*4+3],p[(y*leaf.w+leaf.w-1)*4+3]);}}
  let cableInteriorError=0;const repaired=r.base.getContext('2d').getImageData(649,910,38,18).data;
  for(let y=0;y<18;y++)for(let x=0;x<38;x++)for(let ch=0;ch<3;ch++)cableInteriorError=Math.max(cableInteriorError,Math.abs(repaired[(y*38+x)*4+ch]-original[((y+910)*1536+x+649)*4+ch]));
  const aerial=r.details.find(s=>s.shape.id==='robot-aerial-right');let aerialBackdropError=0;
  for(const t of[0,1.5,4.8]){ctx.drawImage(r.base,0,0);r.drawDetail(aerial,t);const p=ctx.getImageData(158,385,23,20).data;for(let y=0;y<20;y++)for(let x=0;x<23;x++)for(let ch=0;ch<3;ch++)aerialBackdropError=Math.max(aerialBackdropError,Math.abs(p[(y*23+x)*4+ch]-original[((y+385)*1536+x+158)*4+ch]));}
  const beacon=r.beacon,glow=beacon.glowMask.getContext('2d').getImageData(0,0,144,132).data;let haloEdge=0,haloGridError=0;const levels=new Set();
  for(let y=0;y<132;y++)for(let x=0;x<144;x++){const a=glow[(y*144+x)*4+3];levels.add(a);if(x===0||x===143||y===0||y===131)haloEdge=Math.max(haloEdge,a);haloGridError=Math.max(haloGridError,Math.abs(a-glow[((y-y%2)*144+x-x%2)*4+3]));}
  await r.setTimeOfDay('night');const changes={};
  for(const [key,t,night]of[['low',0,true],['high',.4,true],['day',.4,false]]){
   ctx.drawImage(r.base,0,0);const before=ctx.getImageData(105,11,144,132).data;beacon.draw(ctx,t,night);const after=ctx.getImageData(105,11,144,132).data;let sum=0,count=0;
   for(let y=0;y<132;y++)for(let x=0;x<144;x++){const d=Math.hypot(x-72,y-66);if(d<38||d>58)continue;const i=(y*144+x)*4;for(let ch=0;ch<3;ch++)sum+=after[i+ch]-before[i+ch];count+=3;}changes[key]=sum/count;
  }
  r.dispose();return{leaks,remaining,structureColors,birdEdges,localSkyError,leafSkyPixels,spriteEdges,horizonAlpha,horizonPixel,horizonSteps,missingDuck,aerialBackdropError,cableInteriorError,leafPixels,leafRestoreError,duplicates,clippedAlpha,haloEdge,haloGridError,haloLevels:levels.size,changes};
 });
 for(const[key,n]of Object.entries(result.leaks))assert.equal(n,0,`${key}: sky cuts through the foreground`);
 for(const[key,n]of Object.entries(result.remaining))assert.equal(n,0,`${key}: old scenery/fringe must be replaced by opaque moving sky`);
 for(const[id,edge]of Object.entries(result.birdEdges)){assert.equal(edge.cyanRim,0,`${id}: no old cyan sky attached to feathers`);assert(edge.solid>80,`${id}: bird keeps a complete body`);}
 for(const[mode,error]of Object.entries(result.localSkyError))assert.equal(error,0,`${mode}: plant gaps and cleared window edges show the current moving sky`);
 for(const[name,error]of Object.entries(result.structureColors))assert.equal(error,0,`${name}: retain the original filled surface and thin structure`);
 assert.equal(result.leafSkyPixels,0,'moving leaves do not carry cyan background pixels');
 for(const[id,edge]of Object.entries(result.spriteEdges)){assert.equal(edge.feather,0,`${id}: no broad translucent background attached to moving object`);assert.equal(edge.border,0,`${id}: complete contour fits inside cache`);}
 assert(result.horizonAlpha[0]===255&&result.horizonAlpha[1]<255&&result.horizonAlpha[1]>result.horizonAlpha[2]&&result.horizonAlpha[2]>0,'horizon uses a narrow monotonic transition');
 assert(result.horizonPixel[1]>result.horizonPixel[0]+15,'old gray shore fragments give way to distant water');
 assert.equal(result.missingDuck,0,'all yellow head pixels must belong to the moving duck');
 for(const [mode,step]of Object.entries(result.horizonSteps))assert(step<=20,`${mode}: no hard color step at the distant sea/sky join (${step})`);
 assert.equal(result.cableInteriorError,0,'water inside the cable loop must remain untouched');
 assert.equal(result.aerialBackdropError,0,'right aerial must not cut or move the rack behind it');
 assert(result.leafPixels>5000);assert.equal(result.duplicates,0,'one source pixel belongs to only one moving leaf');assert.equal(result.leafRestoreError,0,'neutral pose exactly restores complete original leaf pixels');assert.equal(result.clippedAlpha,0,'swaying contours fit inside the full motion cache');
 assert.equal(result.haloEdge,0,'no rectangular light boundary');assert.equal(result.haloGridError,0,'halo uses crisp two-pixel blocks');assert(result.haloLevels<40,'light uses discrete shade steps');assert(result.changes.high>result.changes.low*1.2,'surrounding light breathes with the core');assert(result.changes.low>0,'night light reaches nearby surfaces');assert.equal(result.changes.day,0,'daytime lighting does not inherit night bloom');
 console.log('PASS complete foreground silhouettes, unique/restorable leaf contours, unclipped sway and pixel-stepped breathing light',JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
