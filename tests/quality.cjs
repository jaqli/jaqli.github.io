const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';

// A fractional scene scale on a Retina display exposed both the lowered
// backing-store resolution and the extra resampling of cropped DOM layers.
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const time of [0,6.2]){
   const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2,reducedMotion:'reduce'});
   await page.route('**/app.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace('elapsed = 0','elapsed = '+time)});
   });
   await page.goto(origin);await page.waitForSelector('body.scene-ready');
   await page.addStyleTag({content:'.scene-header,#hotspots,#pause,#scene-status,#pan-hint{visibility:hidden}'});
   await page.waitForTimeout(250);
   const picture=(await page.screenshot({path:`/tmp/jaqli-quality-${time}.png`})).toString('base64');
   const result=await page.evaluate(async({picture,time})=>{
    const {scenePixelRatio}=await import('./render-budget.js');
    const {AsciiRenderer}=await import('./ascii-renderer.js');
    const reference=document.createElement('canvas'),renderer=new AsciiRenderer(document.querySelector('#scene-image'),reference);
    renderer.resize(1440,960);renderer.draw(time);
    const image=new Image();image.src='data:image/png;base64,'+picture;await image.decode();
    const actual=document.createElement('canvas');actual.width=image.width;actual.height=image.height;actual.getContext('2d').drawImage(image,0,0);
    const sourceScale=1440/1536*2;
    const regions={sky:[610,190,140,120],city:[1180,356,30,85],water:[1008,475,96,90],hair:[716,468,15,31],body:[785,505,55,75],wall:[350,40,150,100],screen:[441,383,109,77]};
    const comparison=Object.fromEntries(Object.entries(regions).map(([name,box])=>{
     const pixels=box.map(v=>Math.round(v*sourceScale));
     const a=actual.getContext('2d').getImageData(...pixels).data,b=reference.getContext('2d').getImageData(...pixels).data;
     let error=0;const channels=[0,0,0];
     for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++){error+=Math.abs(a[i+c]-b[i+c]);channels[c]+=a[i+c]-b[i+c];}
     return[name,{error:error/(a.length/4*3),colorShift:Math.max(...channels.map(v=>Math.abs(v)/(a.length/4)))}];
    }));
    const base=document.querySelector('#ascii-canvas');
    return {width:base.width,height:base.height,largeDisplayDpr:scenePixelRatio(3840,2160),comparison,
     screens:[...document.querySelectorAll('[data-layer^="screen-"]')].map(c=>[c.width,c.height])};
   },{picture,time});
   assert.equal(result.width,2880,'do not upscale a low-resolution scene on Retina displays');
   assert.equal(result.height,1920);
   assert.equal(result.largeDisplayDpr,2,'large screens must not silently lose raster resolution');
   assert.deepEqual(result.screens,[[519,360],[324,258],[300,207]],'retain the original 3× screen textures');
   for(const[name,value]of Object.entries(result.comparison)){
    // Screen perspective is composited by CSS; all other checked regions
    // retain the original raster directly, including its RGB colors.
    assert(value.error<(name==='screen'?12:.3),`${name}: glyph sharpness changed (${value.error})`);
    assert(value.colorShift<(name==='screen'?2:.15),`${name}: color drift (${value.colorShift})`);
   }
   console.log('PASS Retina sharpness and RGB fidelity',time,JSON.stringify(result.comparison));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
