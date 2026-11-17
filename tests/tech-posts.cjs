const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/site.json'),'utf8'));
const articles=[
 {id:'c1da59b4bb47829db679815cfc062b27',tables:8,rows:47,images:1,files:4},
 {id:'f48a59b4bb47831b95f00158c5fb5222',tables:16,rows:121,images:2,files:5}
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
   await page.goto(`${origin}/tech/`);await page.waitForSelector('.article-card');
   assert.equal(await page.locator('.article-card').count(),2);
   const links=await page.locator('.article-card').evaluateAll(nodes=>nodes.map(a=>a.href));
   for(const [index,article] of articles.entries())assert(links[index].endsWith(`?id=${article.id}`),'new articles appear first');
   for(const article of articles){
    const source=data.notion.posts.find(post=>post.id===article.id);
    await page.goto(`${origin}/post/?id=${article.id}`);
    await page.waitForFunction(()=>document.body.dataset.contentReady==='true');
    assert.equal(await page.locator('#post-title').innerText(),source.title);
    assert.match(await page.locator('#post-meta').innerText(),/TECH \/ 2026-11-03/);
    assert.equal(await page.locator('.article-table').count(),article.tables);
    assert.equal(await page.locator('.article-table tr').count(),article.rows);
    assert.equal(await page.locator('.article-body img').count(),article.images);
    assert.equal(await page.locator('.article-body video').count(),2);
    assert.equal(await page.locator('.article-body a[download]').count(),article.files);
    assert((await page.locator('.article-body strong').count())>0,'source emphasis survives import');
    assert((await page.locator('.article-body h4').count())>0,'fourth-level headings render');
    for(const img of await page.locator('.article-body img').all()){
     await img.scrollIntoViewIfNeeded();await img.evaluate(node=>node.decode());
     assert(await img.evaluate(node=>node.naturalWidth>0));
    }
    for(const a of await page.locator('.article-body a[download]').all()){
     const response=await page.request.get(await a.getAttribute('href'));
     assert(response.ok(),'downloadable attachment exists');assert((await response.body()).length>0);
    }
    for(const video of await page.locator('.article-body video').all()){
     assert.equal(await video.getAttribute('preload'),'none');
     assert.equal(await video.getAttribute('autoplay'),null);
     await video.scrollIntoViewIfNeeded();await video.evaluate(node=>node.play());
     await page.waitForFunction(()=>[...document.querySelectorAll('video')].some(v=>!v.paused&&v.currentTime>.1));
     assert(await video.evaluate(node=>node.duration>0&&node.videoWidth>0));
     await video.evaluate(node=>node.pause());
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'tables and videos do not overflow the page');
    assert.equal(await page.locator('#post-back').getAttribute('href'),'../tech/');
    assert.equal(await page.locator('.article-body > a').last().getAttribute('href'),source.source);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px ${source.title}: complete tables, local images/downloads, playable videos and no runtime/HTTP errors`);
   }
   // Hidden articles must disappear from both the snapshot and their old routes.
   for(const id of ['ca34487821e84401b9e38d7807e612c8','3b5ad8eeb6f84e33953ca624f017515a']){
    assert(!data.notion.posts.some(post=>post.id===id));
    await page.goto(`${origin}/post/?id=${id}`);
    await page.waitForFunction(()=>document.body.dataset.contentReady==='true');
    assert.equal(await page.locator('#post-title').innerText(),'Not found.');
   }
   // The shared renderer still accepts the original article format for life posts.
   const old=data.notion.posts.find(post=>post.category==='life');
   await page.goto(`${origin}/post/?id=${old.id}`);
   await page.waitForFunction(()=>document.body.dataset.contentReady==='true');
   assert.equal(await page.locator('#post-title').innerText(),old.title);
   assert.equal(await page.locator('.article-body > *').count(),old.blocks.length+1);
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
