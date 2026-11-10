// Diagnostic benchmark: frame timings depend on the machine, so report them
// without brittle FPS thresholds. Run serially, without other browser tests.
const {chromium}=require('playwright');
const fs=require('node:fs');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const results=[];
 try{
  const cases=[{name:'desktop',width:1440,height:900,dpr:1},{name:'retina',width:1440,height:900,dpr:2},{name:'mobile',width:390,height:844,dpr:2}];
  for(const config of cases.filter(c=>!process.env.PERF_CASE||c.name===process.env.PERF_CASE)){
   const page=await browser.newPage({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.dpr,reducedMotion:'reduce'});
   await page.addInitScript(()=>{
    const Native=Worker;window.sceneFrames=[];
    window.Worker=class extends Native{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.bitmap||data.painted)sceneFrames.push(performance.now())})}};
   });
   await page.goto(origin);await page.waitForSelector('body.scene-ready');
   const layered=await page.locator('#motion-layers').count()>0,worker=page.workers()[0];
   await worker.evaluate(async layered=>{
    const version=location.search,{AsciiRenderer}=await import('/ascii-renderer.js'+version);self.sceneProfile={};
    for(const name of ['draw','drawWater','drawClouds','drawScreens','drawLights','drawDetails']){
     const fn=AsciiRenderer.prototype[name];if(!fn)continue;sceneProfile[name]=[];
     AsciiRenderer.prototype[name]=function(...args){self.rendererProbe=this;const start=performance.now(),result=fn.apply(this,args);sceneProfile[name].push(performance.now()-start);return result;};
    }
    if(layered){const{LayeredScene}=await import('/layered-scene.js'+version),draw=LayeredScene.prototype.draw;sceneProfile.layered=[];
     LayeredScene.prototype.draw=function(time){self.layerProbe=this;const start=performance.now(),result=draw.call(this,time);sceneProfile.layered.push(performance.now()-start);return result;};
     const{GlyphMotion}=await import('/glyph-motion.js'+version),update=GlyphMotion.prototype.update;sceneProfile.glyphChanges=[];
     GlyphMotion.prototype.update=function(...args){const start=performance.now(),result=update.apply(this,args);sceneProfile.glyphChanges.push(performance.now()-start);return result;};
    }
   },layered);
   await page.evaluate(()=>{
    window.waterSamples=[];window.waterSampling=true;let previous='';
    function sample(now){const key=[...document.querySelectorAll('.water-blend canvas')].map(c=>c.style.opacity).join(',');if(key&&key!==previous){waterSamples.push(now);previous=key;}if(waterSampling)requestAnimationFrame(sample)}
    requestAnimationFrame(sample);
   });
   await page.locator('#pause').click();await page.waitForTimeout(6000);await page.locator('#pause').click();
   await page.evaluate(()=>{waterSampling=false;});
   const main=await page.evaluate(layered=>{
    const frames=sceneFrames.slice(1),intervals=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
    const selector=layered?'#motion-layers [data-static], #flight-layer canvas':'#ascii-canvas, #flight-layer canvas';
    return{waterFps:waterSamples.length>2?+((waterSamples.length-1)*1000/(waterSamples.at(-1)-waterSamples[0])).toFixed(1):null,fps:+((frames.length-1)*1000/(frames.at(-1)-frames[0])).toFixed(1),intervalP95Ms:+intervals[Math.floor(intervals.length*.95)].toFixed(1),
     mainBytes:[...document.querySelectorAll(selector)].reduce((n,c)=>n+c.width*c.height*4,0)};
   },layered);
   const workerResult=await worker.evaluate(()=>{
    const seen=new Set();let bytes=0;
    const walk=obj=>{if(!obj||typeof obj!=='object'||seen.has(obj))return;seen.add(obj);
     if(obj instanceof OffscreenCanvas){bytes+=obj.width*obj.height*4;return;}
     if(ArrayBuffer.isView(obj)||obj instanceof ImageBitmap||(Array.isArray(obj)&&obj.length>100))return;
     for(const value of Object.values(obj))walk(value);
    };
    walk(rendererProbe);if(self.layerProbe){walk(layerProbe.display);walk(layerProbe.waterStage);for(const target of layerProbe.targets.values())walk(target);}
    const methods=Object.fromEntries(Object.entries(sceneProfile).filter(([,v])=>v.length).map(([name,times])=>[name,+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(2)]));
    return{bytes,methods};
   });
   results.push({name:config.name,workerFps:main.fps,waterFps:main.waterFps??main.fps,intervalP95Ms:main.intervalP95Ms,canvasBuffersMiB:+((main.mainBytes+workerResult.bytes)/1024**2).toFixed(1),meanDrawMs:workerResult.methods});
   await page.close();
  }
  console.log(JSON.stringify(results,null,2));if(process.env.PERF_OUTPUT)fs.writeFileSync(process.env.PERF_OUTPUT,JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
