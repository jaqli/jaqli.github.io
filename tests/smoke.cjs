const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:8081';

async function openScene(page) {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForSelector('body.scene-ready');
}
// Independent points selected from the actual source artwork, not hotspot definitions.
async function clickScenePoint(page, x, y, { pan = false, tap = false } = {}) {
  if (pan) await page.locator('#scene-viewport').evaluate((view, x) => {
    view.scrollLeft = x / 1536 * document.querySelector('#scene-world').getBoundingClientRect().width - view.clientWidth / 2;
  }, x);
  const world = await page.locator('#scene-world').boundingBox();
  const point = { x: world.x + x / 1536 * world.width, y: world.y + y / 1024 * world.height };
  if (tap) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await openScene(page);
    assert.equal(await page.locator('input[type=file], input[type=range], #choose-image').count(), 0);
    const bounds = await page.locator('canvas').boundingBox();
    assert(bounds.x <= 0 && bounds.y <= 0 && bounds.width >= 1440 && bounds.height >= 900);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false);
    console.log('PASS full-viewport artwork, no uploader or control panel');

    const snapshot = () => page.locator('#ascii-canvas').evaluate(c => c.toDataURL());
    let first = await snapshot();
    await page.waitForTimeout(250);
    assert.notEqual(await snapshot(), first);
    await page.locator('#pause').click();
    first = await snapshot();
    await page.waitForTimeout(200);
    assert.equal(await snapshot(), first);
    console.log('PASS scene animates and can pause');

    await clickScenePoint(page, 510, 420);
    await page.waitForSelector('.page-transition');
    await page.waitForURL(`${origin}/tech/`);
    assert.match(await page.locator('h1').textContent(), /Tech/);
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.page-transition').count(), 0);
    console.log('PASS monitor navigates through transition; Back restores scene');

    await page.locator('[data-hotspot="tech"] .hotspot-label rect').click();
    await page.waitForURL(`${origin}/tech/`);
    await openScene(page);
    console.log('PASS the visible Tech Blog label is also clickable');

    await clickScenePoint(page, 790, 530);
    await page.waitForURL(`${origin}/cv/`);
    await openScene(page);
    const gull = page.locator('[data-hotspot="life"]');
    assert.equal(await gull.locator('text, title, .hotspot-label').count(), 0);
    const world = await page.locator('#scene-world').boundingBox();
    await page.mouse.move(world.x + 991 / 1536 * world.width, world.y + 259 / 1024 * world.height);
    const style = await gull.locator('polygon').evaluate(p => ({ cursor: getComputedStyle(p).cursor, stroke: getComputedStyle(p).stroke, fill: getComputedStyle(p).fill }));
    assert.equal(style.cursor, 'default');
    assert.equal(style.stroke, 'rgba(0, 0, 0, 0)');
    assert.equal(style.fill, 'rgba(0, 0, 0, 0)');
    await clickScenePoint(page, 991, 259);
    await page.waitForURL(`${origin}/life/`);
    console.log('PASS person opens CV; unmarked gull opens Life without hover hint');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openScene(page);
    assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
    first = await snapshot(); await page.waitForTimeout(150); assert.equal(await snapshot(), first);
    await page.locator('[data-hotspot="tech"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(`${origin}/tech/`);
    assert.equal(await page.locator('.page-transition').count(), 0);
    console.log('PASS reduced motion and keyboard navigation');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    mobile.on('pageerror', e => errors.push(e.message));
    await openScene(mobile);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const scrollBefore = await mobile.locator('#scene-viewport').evaluate(e => e.scrollLeft);
    const cdp = await mobile.context().newCDPSession(mobile);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 650 }] });
    for (let x = 280; x >= 80; x -= 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 650 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.waitForFunction(before => document.querySelector('#scene-viewport').scrollLeft > before + 30, scrollBefore);
    console.log('PASS touch drag pans the room');
    for (const [x, y, route] of [[510, 420, 'tech'], [790, 530, 'cv'], [991, 259, 'life']]) {
      await openScene(mobile);
      await clickScenePoint(mobile, x, y, { pan: true, tap: true });
      await mobile.waitForURL(`${origin}/${route}/`);
    }
    await mobile.setViewportSize({ width: 844, height: 390 });
    await openScene(mobile);
    await clickScenePoint(mobile, 991, 259, { tap: true });
    await mobile.waitForURL(`${origin}/life/`);
    console.log('PASS all touch targets remain aligned after panning and rotation');

    const fixture = {
      notion: { posts: [
        { id: 'test-tech', category: 'tech', title: 'TEST ONLY: 技术笔记', date: '2026-01-01', summary: '独立测试数据', blocks: [{ type: 'heading', text: '小节' }, { type: 'code', text: '<script>window.injected=true</script>' }, { type: 'link', text: 'bad', url: 'javascript:window.injected=true' }] },
        { id: 'test-life', category: 'life', title: 'TEST ONLY: 生活', blocks: [{ type: 'paragraph', text: '测试随笔' }] },
      ] },
      profile: { syncedAt: '2026-01-01', name: '测试研究者', affiliation: '测试机构', interests: ['测试方向'], publications: [{ title: 'TEST ONLY: Paper', authors: 'Test Author', venue: 'Test Venue', year: '2026', url: 'https://example.com/paper' }], source: 'https://example.com/profile' },
    };
    await page.route('**/content/site.json', r => r.fulfill({ json: fixture }));
    await page.goto(`${origin}/tech/`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.article-card').count(), 1);
    await page.locator('.article-card').click();
    await page.waitForURL(/post\/\?id=test-tech/);
    await page.waitForSelector('.article-body pre');
    assert.match(await page.locator('pre').textContent(), /<script>/);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
    await page.goto(`${origin}/life/`, { waitUntil: 'networkidle' });
    assert.match(await page.locator('.article-card h2').textContent(), /生活/);
    await page.goto(`${origin}/cv/`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h1').textContent(), '测试研究者');
    assert.equal(await page.locator('.publication').count(), 1);
    console.log('PASS content categories, article layout, safe text rendering and CV mapping');
    assert.deepEqual(errors, []);
    console.log('PASS no page errors or failed requests');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
