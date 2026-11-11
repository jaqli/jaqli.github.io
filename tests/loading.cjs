const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:8081';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let releaseSource;
    const sourceGate = new Promise(resolve => { releaseSource = resolve; });
    await page.route('**/assets/scene.webp*', async route => {
      await sourceGate;
      await route.continue().catch(() => {});
    });
    await page.goto(origin, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.querySelector('#scene-poster')?.naturalWidth > 0);
    await page.waitForSelector('[data-hotspot="cv"]');
    assert.equal(await page.locator('body.scene-ready').count(), 0, 'preview must be available before animation source arrives');
    assert.equal(await page.locator('#scene-progress').getAttribute('value'), '0', 'loading must not invent progress while the download is blocked');
    assert(await page.locator('#scene-progress').isVisible());
    assert.equal(await page.locator('#scene-poster').evaluate(e => getComputedStyle(e).opacity), '1');
    await page.locator('[data-hotspot="cv"] .hotspot-label rect').click();
    await page.waitForSelector('.page-transition');
    const visibleTransition = await page.locator('.page-transition canvas').evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i+1] + pixels[i+2] > 120) lit++;
      return lit / (pixels.length / 4);
    });
    assert(visibleTransition > .05, 'early navigation should dissolve the visible ASCII preview');
    await page.waitForURL(`${origin}/cv/`);
    releaseSource();
    await page.close();
    console.log('PASS ASCII preview and animated navigation work while the animation source is still loading');

    const resized = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    // Exercise the scheduler fallback used by browsers without scheduler.yield.
    await resized.addInitScript(() => Object.defineProperty(globalThis, 'scheduler', { value: undefined }));
    await resized.route('**/scene-worker.js*',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:"Object.defineProperty(globalThis,'scheduler',{value:undefined});\n"+await response.text()});
    });
    await resized.goto(origin, { waitUntil: 'commit' });
    await resized.waitForFunction(() => performance.getEntriesByName('scene-source-ready').length > 0);
    await resized.setViewportSize({ width: 390, height: 844 });
    await resized.waitForSelector('body.scene-ready');
    assert.equal(await resized.locator('#scene-progress').getAttribute('value'), '100');
    const dimensions = await resized.locator('#ascii-canvas').evaluate(canvas => {
      const rect = canvas.getBoundingClientRect();
      return { raster: [canvas.width, canvas.height], view: [Math.round(rect.width), Math.round(rect.height)], height: innerHeight };
    });
    assert.deepEqual(dimensions.raster, dimensions.view, 'resizing during setup must use the final viewport');
    assert(dimensions.view[1] >= dimensions.height);
    await resized.screenshot({ path: '/tmp/jaqli-load-mobile.png' });
    await resized.close();
    console.log('PASS rotation during initialization and scheduler fallback');

    const slow = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const cdp = await slow.context().newCDPSession(slow);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: .75e6 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await slow.addInitScript(() => {
      window.startupTasks = [];
      window.progressValues = [];
      new MutationObserver(() => {
        const progress=document.querySelector('#scene-progress');
        if (progress?.hasAttribute('value')) progressValues.push(progress.value);
      }).observe(document,{subtree:true,attributes:true,attributeFilter:['value']});
      new PerformanceObserver(list => startupTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
    });
    await slow.goto(origin, { waitUntil: 'commit' });
    await slow.waitForSelector('body.scene-ready', { timeout: 60000 });
    const timing = await slow.evaluate(() => {
      const mark = name => Math.round(performance.getEntriesByName(name)[0].startTime);
      const ready = mark('scene-ready');
      return { previewMs: mark('scene-preview-ready'), sourceMs: mark('scene-source-ready'), animatedMs: ready,
        progressSteps:[...new Set(progressValues)],
        longestStartupTaskMs: Math.round(Math.max(0, ...startupTasks.filter(t => t.start < ready).map(t => t.duration))),
        sourceImages: performance.getEntriesByType('resource').filter(r => /scene.*webp|IMG_1183/.test(r.name)).map(r => ({ file: r.name.split('/').pop(), bytes: r.encodedBodySize })) };
    });
    assert(timing.previewMs < timing.sourceMs && timing.sourceMs < timing.animatedMs);
    assert.equal(timing.sourceImages.length, 3, 'load the preview, small color backing and compressed animation source');
    assert(timing.sourceImages.find(image=>image.file.startsWith('scene-ambience.')).bytes<12000,'the static color backing should remain small');
    assert(timing.progressSteps.length>10 && timing.progressSteps.at(-1)===100);
    assert(timing.progressSteps.every((value,i,array)=>i===0 || value>=array[i-1]), 'progress should reflect completed work and never move backwards');
    await slow.locator('#pause').click();
    await slow.screenshot({ path: '/tmp/jaqli-load-desktop.png' });
    console.log('Cold load, 1.6 Mbps / 150 ms latency / 4× CPU slowdown:', JSON.stringify(timing));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
