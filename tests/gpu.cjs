const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:810,height:540},reducedMotion:'reduce'});
  await page.context().route('**/layered-scene.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('new GlyphBatch(this.display,r)','new GlyphBatch(this.display,r,true)')});});
  await page.context().route('**/glyph-batch.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.canvas=canvas;this.groups=[];','this.canvas=canvas;this.groups=[];self.gpuProbe=this;')});});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);await page.waitForSelector('body.scene-ready');
  assert.equal(await page.locator('#ascii-canvas').getAttribute('data-raster'),'webgl');
  const worker=page.workers()[0];
  const result=await worker.evaluate(async()=>{
   const{fontStep}=await import('/ascii-renderer.js'+location.search);
   const gpu=gpuProbe,gl=gpu.gl,r=gpu.renderer;
   const a=new Uint8Array(gpu.canvas.width*gpu.canvas.height*4),b=new Uint8Array(a.length);let worst=0;
   for(let frame=1;frame<=24;frame++){
    for(const cell of r.dynamic){cell.glyphVariant=frame%cell.glyphPool.length;cell.renderY=cell.y+(cell.kind==='hem'?Math.sin(frame)*.3*r.scale:0);cell.renderSize=cell.kind==='hem'?cell.size:fontStep(cell.size+(frame%2?.1:-.1));}
    gpu.draw(frame/120);gl.readPixels(0,0,gpu.canvas.width,gpu.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);
    gpu.frame=-1;gpu.draw(frame/120);gl.readPixels(0,0,gpu.canvas.width,gpu.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,b);
    let error=0;for(let i=0;i<a.length;i++)error+=Math.abs(a[i]-b[i]);worst=Math.max(worst,error/a.length);
   }
   return{worst,bytes:gpu.bufferBytes,error:gl.getError()};
  });
  console.log('GPU crop comparison',JSON.stringify(result));
  assert(result.worst<.01,'cached background restoration must match a clean GPU redraw without trails');
  assert(result.bytes<32*1024**2&&result.error===0,'GPU buffers and API use must stay bounded and valid');
  const cadence=await worker.evaluate(()=>{
   const gpu=gpuProbe,r=gpu.renderer,base=gpu.groups[0],previous=base.variants.slice(),last=new Float64Array(previous.length),counts=new Uint8Array(previous.length);let maxGap=0;
   for(let i=1;i<=120;i++){
    const time=i/30;r.glyphMotion.update(time,[],()=>{});gpu.draw(time);
    base.variants.forEach((v,j)=>{if(v!==previous[j]){maxGap=Math.max(maxGap,time-last[j]);last[j]=time;previous[j]=v;counts[j]++;}});
   }
   return{minChanges:Math.min(...counts),maxGap:Math.max(maxGap,...last.map(t=>4-t))};
  });
  assert(cadence.minChanges>=4&&cadence.maxGap<=1,'presented GPU glyphs must all change at least once per second');
  await worker.evaluate(()=>{const gl=gpuProbe.gl;self.savedGPUImage=new Uint8Array(gpuProbe.canvas.width*gpuProbe.canvas.height*4);gl.readPixels(0,0,gpuProbe.canvas.width,gpuProbe.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,savedGPUImage);});
  await worker.evaluate(async()=>{
   const extension=gpuProbe.gl.getExtension('WEBGL_lose_context');
   const lost=new Promise(resolve=>gpuProbe.canvas.addEventListener('webglcontextlost',resolve,{once:true}));
   const restored=new Promise(resolve=>gpuProbe.canvas.addEventListener('webglcontextrestored',resolve,{once:true}));
   extension.loseContext();await lost;await new Promise(resolve=>setTimeout(resolve,100));extension.restoreContext();
   await Promise.race([restored,new Promise((_,reject)=>setTimeout(()=>reject(new Error('GPU context did not recover')),10000))]);await gpuProbe.restoreComplete;
  });
  const restoredError=await worker.evaluate(()=>{const gl=gpuProbe.gl,pixels=new Uint8Array(savedGPUImage.length);gl.readPixels(0,0,gpuProbe.canvas.width,gpuProbe.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let error=0;for(let i=0;i<pixels.length;i++)error+=Math.abs(pixels[i]-savedGPUImage[i]);return error/pixels.length;});
  assert.equal(restoredError,0,'context restoration must recreate the exact paused image');
  await page.setViewportSize({width:1200,height:800});
  await page.waitForFunction(()=>document.querySelector('#ascii-canvas').width===1200);
  await page.waitForTimeout(250);
  const resized=await worker.evaluate(()=>({error:gpuProbe.gl.getError(),width:gpuProbe.canvas.width}));
  assert(resized.error===0&&resized.width===1200,'resize must recreate correctly sized GPU buffers: '+JSON.stringify(resized));
  await page.locator('[data-hotspot="cv"] .hotspot-label rect').click();await page.waitForURL(origin+'/cv/');
  assert.deepEqual(errors,[]);
  console.log('PASS GPU cache restoration, bounded buffers, context recovery, resize and transition',JSON.stringify({result,cadence}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
