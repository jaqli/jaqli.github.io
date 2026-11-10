const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  let previousWater;
  for(const time of [0,6.2]){
   const page=await browser.newPage({viewport:{width:1536,height:1024},reducedMotion:'reduce'});
   await page.route('**/app.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('elapsed = 0','elapsed = '+time)})});
   await page.goto(origin);await page.waitForSelector('body.scene-ready');
   await page.addStyleTag({content:'.scene-header,#hotspots,#pause,#scene-status,#pan-hint{visibility:hidden}'});
   await page.waitForTimeout(250);
   const picture=(await page.screenshot({path:`/tmp/jaqli-layered-${time}.png`})).toString('base64');
   const results=await page.evaluate(async({picture,time})=>{
    const {AsciiRenderer}=await import('./ascii-renderer.js');
    const reference=document.createElement('canvas'),renderer=new AsciiRenderer(document.querySelector('#scene-image'),reference);
    renderer.resize(1536,1024);renderer.draw(time);
    const image=new Image();image.src='data:image/png;base64,'+picture;await image.decode();
    const actual=document.createElement('canvas');actual.width=1536;actual.height=1024;actual.getContext('2d').drawImage(image,0,0);
    const waterSource=document.querySelector('.water-blend'),water=document.createElement('canvas');
    water.width=waterSource.firstElementChild.width;water.height=waterSource.firstElementChild.height;
    const waterCtx=water.getContext('2d');waterCtx.globalCompositeOperation='lighter';
    for(const canvas of waterSource.children){waterCtx.globalAlpha=Number(canvas.style.opacity);waterCtx.drawImage(canvas,0,0);}
    const waterPixels=water.getContext('2d').getImageData(0,0,water.width,water.height).data;
    let waterLit=0,waterChecksum=0;for(let i=3;i<waterPixels.length;i+=4){if(waterPixels[i])waterLit++;waterChecksum=(waterChecksum+waterPixels[i]*(i%65521))%2147483647;}
    const boxes={water:[1008,475,96,90],head:[700,437,100,105],screens:[327,350,420,163],cloud:[610,190,140,120],duck:[288,780,140,100],paper:[394,250,44,48],body:[785,505,55,75]};
    const comparison=Object.fromEntries(Object.entries(boxes).map(([name,box])=>{
     const a=actual.getContext('2d').getImageData(...box).data,b=reference.getContext('2d').getImageData(...box).data;let error=0,ea=0,eb=0;
     for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++){error+=Math.abs(a[i+c]-b[i+c]);ea+=a[i+c];eb+=b[i+c];}
     return[name,{error:error/(a.length/4*3),energy:ea/eb}];
    }));
    // Exercise a long sequence of lighting colors without growing the cache.
    for(let t=0;t<80;t++)renderer.drawLights(t*137.3,false);
    return {comparison,waterLit,waterChecksum,paletteSize:renderer.palette.cache.size,paletteCapacity:renderer.palette.columns*renderer.palette.rows};
   },{picture,time});
   console.log('Layer/reference comparison',time,JSON.stringify(results));
   assert(results.waterLit>500,'the visible water layer must contain moving reflection glyphs');
   if(previousWater!==undefined)assert.notEqual(results.waterChecksum,previousWater,'visible ripple pixels must change with scene time');
   previousWater=results.waterChecksum;
   for(const[name,value]of Object.entries(results.comparison)){
    assert(value.error<12,`${name} must retain its original texture and placement`);
    assert(value.energy>.8&&value.energy<1.2,`${name} must keep its brightness and coverage`);
   }
   assert(results.paletteSize<=2048&&results.paletteCapacity<=2048,'lighting cache must remain bounded over long timelines');
   await page.close();
  }
  console.log('PASS layered water, clouds, screens, hair, paper and floats match the reference; lighting cache remains bounded');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
