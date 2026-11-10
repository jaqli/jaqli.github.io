const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
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
  const actual = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/site.json'), 'utf8'));
  assert(actual.notion.posts.length > 0 && actual.profile.publications.length > 0);
  assert(actual.notion.posts.every(post => post.sourceStatus === 'Published' && post.blocks.length > 0));
  const ids = actual.notion.posts.map(post => post.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const post of actual.notion.posts) for (const block of post.blocks) {
    if (block.type === 'image') {
      assert(block.url.startsWith('../assets/notion/'), 'article images must be retained locally');
      assert(fs.statSync(path.resolve(__dirname, '../post', block.url)).size > 0);
    }
  }
  console.log('PASS verified published content, unique source mappings and retained images');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await openScene(page);
    assert.equal(await page.title(), 'jaq/li');
    assert.equal(await page.locator('.wordmark').textContent(), 'jaq/li');
    assert.equal(await page.locator('.scene-signature, .scene-header > span').count(), 0);
    assert.equal(await page.locator('[data-hotspot="cv"] .hotspot-label').evaluate(e => getComputedStyle(e).opacity), '1');
    const changes = await page.evaluate(async () => {
      const { AsciiRenderer } = await import('./ascii-renderer.js');
      const canvas = document.createElement('canvas');
      const renderer = new AsciiRenderer(document.querySelector('#scene-image'), canvas);
      renderer.resize(1536, 1024);
      renderer.draw(0);
      const ctx = canvas.getContext('2d');
      // Source-image regions: fixed wall, gull, open water, and yellow hem.
      const regions = { wall: [350,40,150,140], bird: [934,212,114,80], water: [1010,480,100,80], cloth: [819,555,50,55] };
      const first = Object.fromEntries(Object.entries(regions).map(([key, box]) => [key, ctx.getImageData(...box).data]));
      renderer.draw(2.4);
      return Object.fromEntries(Object.entries(regions).map(([key, box]) => {
        const pixels = ctx.getImageData(...box).data; let changed = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (Math.abs(pixels[i] - first[key][i]) + Math.abs(pixels[i + 1] - first[key][i + 1]) + Math.abs(pixels[i + 2] - first[key][i + 2]) > 12) changed++;
        }
        return [key, changed / (pixels.length / 4)];
      }));
    });
    assert(changes.wall < .04, 'architecture should stay still');
    for (const key of ['bird', 'water', 'cloth']) assert(changes[key] > changes.wall * 3 + .02, `${key} should move independently`);
    console.log('PASS jaq/li branding, permanent About Me hint and localized scene motion');
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
    assert.match(await page.locator('#pause').textContent(), /播放动效/);
    first = await snapshot(); await page.waitForTimeout(150); assert.equal(await snapshot(), first);
    await page.locator('#pause').click();
    first = await snapshot(); await page.waitForTimeout(250); assert.notEqual(await snapshot(), first);
    await page.locator('#pause').click();
    first = await snapshot(); await page.waitForTimeout(150); assert.equal(await snapshot(), first);
    await page.locator('[data-hotspot="tech"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(`${origin}/tech/`);
    assert.equal(await page.locator('.page-transition').count(), 0);
    console.log('PASS reduced motion, explicit playback override and keyboard navigation');

    // The same real-world duration must move the gull equally on fast and slow
    // devices. Drive actual app callbacks at two cadences, without wall-clock
    // performance assertions that would depend on the test runner's load.
    const clockPage = await browser.newPage({ viewport: { width: 960, height: 640 } });
    await clockPage.addInitScript(() => {
      let nextId = 0;
      const callbacks = new Map();
      window.requestAnimationFrame = callback => { callbacks.set(++nextId, callback); return nextId; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      window.advanceFrame = time => {
        const pending = [...callbacks.values()]; callbacks.clear();
        pending.forEach(callback => callback(time));
      };
    });
    async function runCadence(step) {
      await openScene(clockPage);
      return clockPage.evaluate(step => {
        advanceFrame(1000);
        for (let time = 1000 + step; time <= 4000; time += step) advanceFrame(time);
        return document.querySelector('[data-hotspot="life"] polygon').getAttribute('points').split(/[ ,]/).map(Number);
      }, step);
    }
    const fastPosition = await runCadence(50);
    const slowPosition = await runCadence(250);
    assert(fastPosition.every((value, i) => Math.abs(value - slowPosition[i]) < .001), 'low frame rates must not slow the animation clock');
    await clockPage.close();
    console.log('PASS motion speed is independent of frame rate');

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

    await openScene(mobile);
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.waitForFunction(() => {
      return ['tech', 'cv'].every(id => {
        const rect = document.querySelector(`[data-hotspot="${id}"] .hotspot-label`).getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      });
    });
    console.log('PASS portrait framing keeps both visible entry labels on screen');

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
