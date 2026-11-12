const assert=require('node:assert/strict');
const{chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
const ready=p=>p.waitForSelector('.scene-ready');
const settled=p=>p.waitForFunction(()=>!document.querySelector('#time-lamp').hasAttribute('aria-busy'));
const mode=p=>p.locator('body').getAttribute('data-scene-time');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const errors=[],watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
 // One instant produces four different initial scenes in visitors' time zones.
 for(const[timezoneId,expected]of[['America/New_York','dawn'],['Europe/London','noon'],['Asia/Karachi','dusk'],['Asia/Tokyo','night']]){
  const p=await browser.newPage({timezoneId,reducedMotion:'reduce'});watch(p);
  await p.clock.setFixedTime(new Date('2026-11-12T12:00:00Z'));
  await p.addInitScript(()=>localStorage.setItem('jaqli.scene-time','obsolete-choice'));
  await p.goto(origin);await ready(p);assert.equal(await mode(p),expected,timezoneId);
  assert.equal(await p.locator('.scene-time').count(),0,'the old four-button selector is removed');
  const boundaries=await p.evaluate(async()=>{const{localSceneTime}=await import('./scene-time.js?v=20261112-cycle52');return[0,4,5,9,10,16,17,19,20,23].map(h=>localSceneTime(new Date(2026,10,12,h,0)));});
  assert.deepEqual(boundaries,['night','night','dawn','dawn','noon','noon','dusk','dusk','night','night']);
  assert.equal(await p.evaluate(()=>localStorage.getItem('jaqli.scene-time')),'obsolete-choice','time control neither reads nor overwrites old preferences');
  await p.close();
 }
 console.log('PASS browser-local time in four time zones, midnight boundaries and ignored old preference');

 const page=await browser.newPage({viewport:{width:1440,height:900},timezoneId:'UTC'});watch(page);
 await page.clock.setFixedTime(new Date('2026-11-12T17:30:00Z'));
 // Advance the animation clock without rendering thousands of artificial
 // frames. The real DOM animation clock still measures the visible fade.
 await page.addInitScript(()=>{const raf=requestAnimationFrame;window.testFrameOffset=0;window.requestAnimationFrame=fn=>raf(t=>fn(t+window.testFrameOffset));});
 await page.goto(origin);await ready(page);await page.waitForTimeout(120);
 await page.locator('#pause').click();
 assert.equal(await page.locator('#time-lamp-edge').isVisible(),false,'desktop uses the actual lamp');
 const lamp=page.locator('#time-lamp');await lamp.click();
 await page.waitForFunction(()=>document.body.dataset.sceneTime==='night');
 assert(await lamp.isDisabled());assert.equal(await page.locator('.scene-time-fade').count(),1);
 const alpha=[];for(let i=0;i<4;i++){await page.waitForTimeout(260);alpha.push(await page.locator('.scene-time-fade').evaluate(c=>Number(getComputedStyle(c).opacity)));}
 assert(alpha[0]<1&&alpha[0]>.65&&alpha.at(-1)>.01&&alpha.at(-1)<.4,JSON.stringify(alpha));
 assert(alpha.every((a,i)=>!i||a<alpha[i-1]),'light changes continuously instead of snapping');
 await settled(page);assert.equal(await page.locator('.scene-time-fade').count(),0,'temporary fade buffer is removed');
 const paused=await page.locator('#ascii-canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(120);
 assert.equal(await page.locator('#ascii-canvas').evaluate(c=>c.toDataURL()),paused,'explicit switch preserves pause');

 const birdPresence=await page.evaluate(async()=>{
  const{PixelScene}=await import('./pixel-scene.js?v=20261112-cycle52'),r=await PixelScene.create(document.querySelector('#scene-image'),document.createElement('canvas')),birds=r.birds,result={};
  for(const mode of['night','dawn','noon','dusk']){
   await r.setTimeOfDay(mode);r.birds=birds;r.draw(1.3);const withBirds=r.canvas.toDataURL();
   r.birds=[];r.draw(1.3);result[mode]=withBirds!==r.canvas.toDataURL();
  }
  r.birds=birds;r.dispose();return result;
 });
 assert.deepEqual(birdPresence,{night:false,dawn:true,noon:true,dusk:true});
 console.log('PASS 1.6-second aligned light fade, buffer release, preserved pause and no night birds',alpha);

 await lamp.click();await settled(page);assert.equal(await mode(page),'dawn');
 await page.locator('#pause').click();await page.waitForTimeout(120);
 await page.evaluate(()=>testFrameOffset+=57000);await page.waitForTimeout(120);assert.equal(await mode(page),'dawn');
 await page.evaluate(()=>testFrameOffset+=4000);await page.waitForFunction(()=>document.body.dataset.sceneTime==='noon');await settled(page);
 await page.locator('#pause').click();await page.evaluate(()=>testFrameOffset+=120000);await page.waitForTimeout(120);assert.equal(await mode(page),'noon');
 await page.locator('#pause').click();await page.waitForTimeout(120);assert.equal(await mode(page),'noon','resume does not catch up skipped minutes');
 await lamp.click();await settled(page);assert.equal(await mode(page),'dusk');
 await page.waitForTimeout(100);await page.evaluate(()=>testFrameOffset+=57000);await page.waitForTimeout(100);assert.equal(await mode(page),'dusk','manual click restarts the minute');
 await page.evaluate(()=>testFrameOffset+=4000);await page.waitForFunction(()=>document.body.dataset.sceneTime==='night');await settled(page);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));testFrameOffset+=120000;});
 await page.waitForTimeout(100);assert.equal(await mode(page),'night');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(150);assert.equal(await mode(page),'night','background time never causes several rapid switches');
 console.log('PASS one-minute automatic cycle, manual reset, paused clock and background/resume');

 // A cached return is a new visit too: no remembered override survives.
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await page.waitForFunction(()=>document.body.dataset.sceneTime==='dusk');await settled(page);
 await page.locator('#pause').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
 assert(await page.locator('#time-lamp-edge').isVisible(),'an offscreen lamp has a compact accessible fallback');
 await page.locator('#time-lamp-edge').click();await settled(page);assert.equal(await mode(page),'night');
 await lamp.scrollIntoViewIfNeeded();await page.waitForTimeout(100);assert.equal(await page.locator('#time-lamp-edge').isVisible(),false);
 await lamp.focus();await page.keyboard.press('Enter');await settled(page);assert.equal(await mode(page),'dawn','lamp supports keyboard activation');
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(100);
 assert(await page.locator('#time-lamp-edge').isVisible(),'landscape crop keeps a visible light control');
 await page.locator('#time-lamp-edge').click();await page.waitForFunction(()=>document.body.dataset.sceneTime==='noon');
 await page.emulateMedia({reducedMotion:'reduce'});await settled(page);assert.equal(await page.locator('.scene-time-fade').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS cached-visit reset, phone pan, landscape, keyboard and reduced-motion interruption');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
