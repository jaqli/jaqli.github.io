const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    await page.addInitScript(()=>{
      const NativeWorker=Worker;
      window.workerProbe={busy:false,inFlight:0,maxInFlight:0};
      window.Worker=class extends NativeWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener('message',({data})=>{
            if(data.testBusy)workerProbe.busy=true;
            if('painted' in data){workerProbe.busy=false;workerProbe.inFlight--;}
          });
        }
        postMessage(data,...args) {
          if(data.type==='draw')workerProbe.maxInFlight=Math.max(workerProbe.maxInFlight,++workerProbe.inFlight);
          return super.postMessage(data,...args);
        }
      };
    });
    // Deliberately stall only the worker. A hover must paint before this frame
    // completes, and pause must discard the late frame rather than flash it.
    await page.route('**/scene-worker.js*',async route=>{
      const response=await route.fetch();
      const script=(await response.text()).replace('// Yield before presenting',
        "if(data.time>0){self.postMessage({testBusy:true});const until=performance.now()+1200;while(performance.now()<until){}}\n// Yield before presenting");
      await route.fulfill({response,body:script});
    });
    await page.goto(origin);await page.waitForSelector('body.scene-ready');
    assert.equal(await page.locator('#ascii-canvas').getAttribute('data-renderer'),'worker');
    await page.locator('#pause').click();
    await page.waitForFunction(()=>workerProbe.busy,null,{polling:20});
    const label=await page.locator('[data-hotspot=tech] .hotspot-label').boundingBox();
    await page.mouse.move(label.x+label.width/2,label.y+label.height/2);
    const hover=await page.locator('[data-hotspot=tech] .hit-area').evaluate(e=>({busy:workerProbe.busy,stroke:getComputedStyle(e).stroke}));
    assert(hover.busy,'hover feedback should arrive while the expensive worker frame is still running');
    assert.notEqual(hover.stroke,'rgba(0, 0, 0, 0)','the Tech Blog outline should appear immediately');
    const flight=await page.evaluate(async()=>{
      const bird=document.querySelector('[data-bird=primary]'),poses=new Set(),before=bird.toDataURL(),start=performance.now();
      await new Promise(resolve=>{function sample(){poses.add(bird.style.transform);if(performance.now()-start<300)requestAnimationFrame(sample);else resolve()}requestAnimationFrame(sample)});
      return {poses:poses.size,wingChanged:before!==bird.toDataURL(),busy:workerProbe.busy};
    });
    assert(flight.busy && flight.poses>=10,'flight must keep updating at display cadence while the room worker is blocked');
    assert(flight.wingChanged,'wingbeats must also continue while the room worker is blocked');
    await page.locator('#pause').click();
    const pausedFlight=await page.locator('[data-bird=primary]').evaluate(c=>c.style.transform+c.toDataURL());
    const snapshot=()=>page.locator('#ascii-canvas').evaluate(c=>c.toDataURL());
    const paused=await snapshot();
    const pausedLayers=await page.locator('#motion-layers').evaluate(e=>[...e.querySelectorAll('canvas')].map(c=>c.style.cssText+c.toDataURL()));
    await page.waitForFunction(()=>!workerProbe.busy,null,{polling:50});
    assert.equal(await snapshot(),paused,'late worker output must not repaint a paused scene');
    assert.deepEqual(await page.locator('#motion-layers').evaluate(e=>[...e.querySelectorAll('canvas')].map(c=>c.style.cssText+c.toDataURL())),pausedLayers,'pause must freeze water, clouds, papers, screens and floats');
    assert.equal(await page.locator('[data-bird=primary]').evaluate(c=>c.style.transform+c.toDataURL()),pausedFlight,'pause must also freeze the independent flight layer');
    assert.equal(await page.evaluate(()=>workerProbe.maxInFlight),1,'only one render request may be in flight');
    console.log('PASS continuous flight and wingbeats during a blocked room render, immediate hover and complete pause cancellation');
    await page.close();
    const fallback=await browser.newPage({viewport:{width:960,height:640},reducedMotion:'reduce'});
    await fallback.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('Test worker startup failure');}};});
    await fallback.goto(origin);await fallback.waitForSelector('body.scene-ready');
    assert.equal(await fallback.locator('#ascii-canvas').getAttribute('data-renderer'),'main');
    await fallback.locator('#pause').click();
    const first=await fallback.locator('#ascii-canvas').evaluate(c=>c.toDataURL());
    await fallback.waitForTimeout(250);
    assert.notEqual(await fallback.locator('#ascii-canvas').evaluate(c=>c.toDataURL()),first);
    console.log('PASS working animation fallback when worker startup is unavailable');
    await fallback.close();
    const transferred=await browser.newPage({viewport:{width:960,height:640},reducedMotion:'reduce'});
    await transferred.route('**/scene-worker.js*',async route=>{
      const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('display=data.canvas;',"throw new Error('Test attach failure');display=data.canvas;")});
    });
    await transferred.goto(origin);await transferred.waitForSelector('body.scene-ready');
    assert.equal(await transferred.locator('#ascii-canvas').getAttribute('data-renderer'),'main');
    assert.equal(await transferred.locator('#motion-layers canvas').count(),0);
    console.log('PASS clean Canvas2D recovery after transferring a display');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
