const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
const settled=page=>page.waitForFunction(()=>!document.querySelector('.page-transition')&&!document.documentElement.classList.contains('route-arriving')&&!document.body.classList.contains('is-entering'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],phases=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('recordRoute',value=>phases.push(value));
  await page.addInitScript(()=>document.addEventListener('site:transition',event=>{
   if(event.detail.active)window.recordRoute({path:location.pathname,phase:document.querySelector('.page-transition')?.dataset.phase});
  }));
  await page.goto(origin);await page.waitForSelector('.scene-ready');
  await page.locator('[data-hotspot="cv"] .hotspot-label').click();
  await page.waitForSelector('.transition-leave');
  const before=await page.locator('#scene-viewport').evaluate(e=>getComputedStyle(e).transform);
  await page.waitForTimeout(160);
  assert.notEqual(await page.locator('#scene-viewport').evaluate(e=>getComputedStyle(e).transform),before,'camera moves during departure');
  await page.waitForFunction(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('#scene-viewport')).transform);return m.a>1.35&&Math.abs(m.e)+Math.abs(m.f)>40;});
  await page.waitForURL(`${origin}/cv/`);await page.waitForSelector('#experience');await settled(page);
  assert.equal(await page.locator('.publication').count(),7);
  assert.deepEqual(await page.locator('.publication-name').allTextContents(),['Hy-Nomas','GameCraft 2','GameCraft','CH3Depth','SDDR','DADP','NVDS']);
  assert.equal(await page.locator('#education,#competitions,.contact-codes,.profile-portrait figcaption').count(),0);
  assert.equal(await page.locator('video').count(),3);
  assert.equal(await page.locator('video[src]').count(),0,'below-fold videos do not preload');
  await page.locator('#profile-nav a[href="#publications"]').click();
  assert.equal(await page.locator('.page-transition').count(),0,'anchors stay native');
  await page.evaluate(()=>scrollTo(0,0));await page.locator('.back-link').click();
  await page.waitForURL(`${origin}/`);await page.waitForSelector('.scene-ready');await settled(page);
  const bounds=await page.locator('#scene-world').boundingBox();
  assert.equal(Math.round(bounds.width),1280,'camera scale must not affect scene layout');
  assert.equal(Math.round(bounds.y),0,'returning camera restores top alignment without cropping the upper scene');
  await page.goBack();await page.waitForSelector('#experience');await settled(page);
  await page.goForward();await page.waitForSelector('.scene-ready');await settled(page);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1280);
  assert(phases.some(p=>p.path==='/cv/'&&p.phase==='enter'));
  assert(phases.some(p=>p.path==='/'&&p.phase==='enter'));
  assert(phases.some(p=>p.path==='/cv/'&&p.phase==='leave'));
  console.log('PASS two-way scatter/assembly, camera movement, restored scene geometry and history cleanup');

  // Query-only navigation is common between articles, and must use the same transition.
  await page.goto(`${origin}/tech/`);await page.waitForSelector('.article-card');
  const ids=await page.locator('.article-card').evaluateAll(as=>as.map(a=>a.href));
  await page.goto(ids[0]);await page.waitForSelector('.article-body > *');
  await page.evaluate(href=>{const a=document.createElement('a');a.href=href;a.id='next-article';a.textContent='Next article';document.querySelector('main').prepend(a);},ids[1]);
  await page.locator('#next-article').click();await page.waitForSelector('.transition-leave');await page.waitForURL(ids[1]);await settled(page);
  console.log('PASS query-only article navigation');

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`${origin}/cv/`);await page.waitForSelector('#experience');
  await page.locator('.back-link').click();await page.waitForURL(`${origin}/`);
  assert.equal(await page.locator('.page-transition').count(),0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('jaqli-route')),null);
  console.log('PASS reduced-motion navigation has no animation or stale route marker');

  const fallback=await browser.newPage();
  await fallback.addInitScript(()=>sessionStorage.setItem('jaqli-route',JSON.stringify({to:'/cv/',at:Date.now(),direction:'in',focus:{x:.5,y:.5}})));
  await fallback.route('**/navigation.js*',route=>route.abort());
  await fallback.goto(`${origin}/cv/`);await fallback.waitForFunction(()=>!document.documentElement.classList.contains('route-arriving'));
  assert.equal(await fallback.locator('.document-main').evaluate(e=>getComputedStyle(e).opacity),'1');
  await fallback.close();console.log('PASS failed module cannot leave destination invisible');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
