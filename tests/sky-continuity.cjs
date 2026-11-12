const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({reducedMotion:'reduce'});await page.goto(origin);await page.waitForSelector('.scene-ready');
 const result=await page.evaluate(async()=>{
  const{PixelScene}=await import('./pixel-scene.js?v=20261112-book56'),r=await PixelScene.create(document.querySelector('#scene-image'),document.createElement('canvas')),ctx=r.ctx,c=r.clouds[0];
  const skyPoints=[[788,390],[765,405],[880,415],[800,315],[820,350],[810,375],[818,397],[866,300],[1392,190],[650,380],[1040,80],[1165,81]],foregroundPoints=[[838,320],[844,120],[1368,240],[1317,144],[1448,254],[1185,393],[572,250],[630,397],[1100,70],[1422,340],[1452,409],[1515,340]];
  const palette={};
  for(const mode of['dawn','noon','night']){
   await r.setTimeOfDay(mode);const lighting=r.timeOfDay,base=r.base.getContext('2d').getImageData(0,0,1536,1024).data,original=lighting.room.original.data;
   palette[mode]=skyPoints.map(([x,y])=>{const i=(y*1536+x)*4,expected=new Uint8ClampedArray(4);lighting.color(original[i],original[i+1],original[i+2],x,y,'sky',expected,0,mode);return{point:[x,y],sky:!!lighting.isSky(x,y),error:Math.max(...[0,1,2].map(ch=>Math.abs(base[i+ch]-expected[ch])))};});
  }
  const protectedForeground=foregroundPoints.map(p=>({point:p,sky:!!r.timeOfDay.isSky(...p)}));
  await r.setTimeOfDay('dusk');
  const draw=t=>{ctx.fillStyle='#152a3d';ctx.fillRect(0,0,1536,1024);r.drawClouds(t);return ctx.getImageData(0,0,1536,1024).data;};
  let driftError=0,periodError=0,bleed=0;
  for(const t of[0,13,c.period-.5,c.period+3]){
   const a=draw(t),b=draw(t+1);
   // Track the same texture feature twelve pixels to its right one second later.
   for(let y=170;y<290;y++)for(let x=900;x<1050;x++)for(let ch=0;ch<3;ch++)driftError=Math.max(driftError,Math.abs(a[(y*1536+x)*4+ch]-b[(y*1536+x+c.speed)*4+ch]));
  }
  const a=draw(1.375),b=draw(c.period+1.375);for(let i=0;i<a.length;i++)periodError=Math.max(periodError,Math.abs(a[i]-b[i]));
  for(const t of[.01,c.period-.01,c.period+.01,18]){
   ctx.fillStyle='#f0f';ctx.fillRect(0,0,1536,1024);r.drawClouds(t);const p=ctx.getImageData(c.x,c.y,c.w,c.h).data;
   ctx.fillStyle='#0f0';ctx.fillRect(0,0,1536,1024);r.drawClouds(t);const q=ctx.getImageData(c.x,c.y,c.w,c.h).data;
   for(const n of c.destinations)for(let ch=0;ch<3;ch++)bleed=Math.max(bleed,Math.abs(p[n*4+ch]-q[n*4+ch]));
  }
  // The repeating sky contains only source sky colors, never a frame or tower.
  const source=new Uint8ClampedArray(c.sourcePixels.buffer);let darkPixels=0;
  for(let i=0;i<source.length;i+=4)if(source[i+1]<120||source[i+2]<120)darkPixels++;
  // Stitching must retain actual source colors. Wide alpha blending creates
  // thousands of new mixed shades and doubles/softens the cloud contours.
  const basePixels=r.base.getContext('2d').getImageData(0,0,1536,1024).data,sourceColors=new Set();
  const key=(p,i)=>p[i]*65536+p[i+1]*256+p[i+2];
  for(let i=0;i<basePixels.length;i+=4)sourceColors.add(key(basePixels,i));
  let mixedSkyPixels=0;for(let i=0;i<source.length;i+=4)if(!sourceColors.has(key(source,i)))mixedSkyPixels++;
  const mixedSkyFraction=mixedSkyPixels/(source.length/4);
  const boxes={hanging:[1247,66,149,90],sill:[1415,213,86,33],trailing:[1358,430,82,139]},leaves={};
  ctx.drawImage(r.base,0,0);r.extras.draw(ctx,0);const initial=ctx.getImageData(0,0,1536,1024).data;
  for(const[key,box]of Object.entries(boxes))leaves[key]=0;
  for(const t of[.3,.7,1.1,1.4,1.8]){
   ctx.drawImage(r.base,0,0);r.extras.draw(ctx,t);const pixels=ctx.getImageData(0,0,1536,1024).data;
   for(const[key,[x,y,w,h]]of Object.entries(boxes)){let sum=0;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)for(let ch=0;ch<3;ch++)sum+=Math.abs(pixels[(yy*1536+xx)*4+ch]-initial[(yy*1536+xx)*4+ch]);leaves[key]=Math.max(leaves[key],sum/(w*h*3));}
  }
  const count=r.extras.leaves.length;r.dispose();return{palette,protectedForeground,driftError,periodError,bleed,darkPixels,mixedSkyFraction,leaves,leafGroups:count};
 });
 for(const[mode,samples]of Object.entries(result.palette))for(const p of samples){assert(p.sky,`${mode}: omitted sky at ${p.point}`);assert(p.error<=1,`${mode}: different palette at ${p.point} (${p.error})`);}
 for(const p of result.protectedForeground)assert(!p.sky,`foreground recolored as sky at ${p.point}`);
 assert(result.driftError<=1,`clouds must translate right across the entire cycle (${result.driftError})`);
 assert(result.periodError<=1,`loop must rejoin exactly (${result.periodError})`);
 assert.equal(result.bleed,0,'the stationary sky must never shine through at texture seams');assert.equal(result.darkPixels,0,'no foreground silhouettes may enter the looping sky texture');
 assert(result.mixedSkyFraction<.001,'cloud stitching must preserve source pixels, allowing only isolated source-speck repairs');
 for(const[k,v]of Object.entries(result.leaves))assert(v>3,`${k} leaves must visibly sway within two seconds (${v})`);
 assert.equal(result.leafGroups,19);console.log('PASS full sky palette, protected foreground, rightward seamless loop and faster swaying in all three plants',JSON.stringify(result));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
