const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/cv/`);await page.waitForSelector('#honors');
  assert.equal(await page.locator('#contact,#profile-nav a[href="#contact"]').count(),0);
  assert.equal(await page.locator('#honors li').count(),2);assert.equal(await page.locator('a[href*="scholar.google.com/citations"]').count(),1);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('-loop.mp4')).length),0,'below-fold videos must not preload');
  const video=page.locator('#paper-gamecraft video');await video.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const v=document.querySelector('#paper-gamecraft video');return !v.paused&&v.currentTime>.1;});
  const info=await video.evaluate(v=>({loop:v.loop,muted:v.muted,inline:v.playsInline,duration:v.duration,source:v.currentSrc}));
  assert(info.loop&&info.muted&&info.inline);assert(Math.abs(info.duration-12)<.1);assert(info.source.startsWith(origin));
  await video.evaluate(v=>v.currentTime=v.duration-.2);await page.waitForFunction(()=>document.querySelector('#paper-gamecraft video').currentTime<1);
  await page.locator('#paper-gamecraft .publication-toggle').click();assert(await video.evaluate(v=>v.paused));
  await page.evaluate(()=>scrollTo(0,0));await video.scrollIntoViewIfNeeded();await page.waitForTimeout(150);assert(await video.evaluate(v=>v.paused),'manual pause persists across scrolling');
  await page.locator('#paper-gamecraft .publication-toggle').click();await page.waitForFunction(()=>!document.querySelector('#paper-gamecraft video').paused);
  await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.paused));
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForSelector('#honors');await video.scrollIntoViewIfNeeded();await page.waitForTimeout(180);
  assert(await video.evaluate(v=>v.paused&&!v.currentSrc));
  await page.locator('#paper-gamecraft .publication-toggle').click();await page.waitForFunction(()=>!document.querySelector('#paper-gamecraft video').paused);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${width}px autoplay, loop, deferred fetch, offscreen/manual pause, reduced-motion override and compact profile`);
 }
 const bytes=['gamecraft-loop.mp4','gamecraft2-loop.mp4','nomas-loop.mp4'].reduce((sum,name)=>sum+fs.statSync(path.join(__dirname,'../assets/publications',name)).size,0);
 assert(bytes<470000);console.log(`PASS combined video previews: ${bytes} bytes`);
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
