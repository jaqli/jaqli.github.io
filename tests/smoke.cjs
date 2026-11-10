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

async function gullBodyPoint(page) {
  // Freeze the visible flying bird while choosing a point inside its body.
  if (await page.locator('#pause').getAttribute('aria-pressed') === 'false') await page.locator('#pause').click();
  return page.locator('[data-hotspot="life"] polygon').evaluate(polygon => {
    const point = new DOMPoint();
    for (const index of [5, 6, 9, 10]) {
      const vertex = polygon.points.getItem(index);
      point.x += vertex.x / 4; point.y += vertex.y / 4;
    }
    const screen = point.matrixTransform(polygon.getScreenCTM());
    return { x: screen.x, y: screen.y };
  });
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
      const { AsciiRenderer, birds, birdPoint } = await import('./ascii-renderer.js');
      const { detailShapes, detailPoint } = await import('./scene-details.js');
      const canvas = document.createElement('canvas');
      const renderer = new AsciiRenderer(document.querySelector('#scene-image'), canvas);
      renderer.resize(1536, 1024);
      renderer.draw(0);
      const ctx = canvas.getContext('2d');
      const regions = { wall: [350,40,150,140], bird: [934,212,114,80], water: [1010,480,100,80],
        body: [785,505,55,75], hand: [665,520,40,25],
        code: [441,383,109,77], terminal: [337,414,95,56], plot: [643,446,70,39],
        duck: [290,785,130,89], paper: [394,250,44,48], cloud: [610,190,140,120],
        windowFrame: [840,110,11,260], sun: [1091,363,18,21], pot: [1310,140,38,21], rim: [421,354,8,120] };
      const first = Object.fromEntries(Object.entries(regions).map(([key, box]) => [key, ctx.getImageData(...box).data]));
      renderer.draw(6.2);
      const changed = Object.fromEntries(Object.entries(regions).map(([key, box]) => {
        const pixels = ctx.getImageData(...box).data; let changed = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (Math.abs(pixels[i] - first[key][i]) + Math.abs(pixels[i + 1] - first[key][i + 1]) + Math.abs(pixels[i + 2] - first[key][i + 2]) > 12) changed++;
        }
        return [key, changed / (pixels.length / 4)];
      }));
      // Check whole character-sized patches, not individual dark strokes. A
      // displaced water grid previously left wide strips of unpainted pixels.
      const box = [1008,475,96,90];
      const energy = pixels => {
        const patches = [];
        for (let y = 0; y < box[3]; y += 6) for (let x = 0; x < box[2]; x += 6) {
          let total = 0;
          for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 6; dx++) {
            const i = ((y + dy) * box[2] + x + dx) * 4;
            total += pixels[i] + pixels[i + 1] + pixels[i + 2];
          }
          patches.push(total);
        }
        return patches;
      };
      renderer.draw(0);
      const baseline = energy(ctx.getImageData(...box).data);
      let coverage = 1;
      for (const time of [1.2, 4, 7.2, 12]) {
        renderer.draw(time);
        const current = energy(ctx.getImageData(...box).data);
        current.forEach((value, index) => { coverage = Math.min(coverage, value / baseline[index]); });
      }
      const flight = Array.from({ length: 57 }, (_, i) => birdPoint(birds[0], 991, 263, i * .5));
      const eyeHeight = time => {
        renderer.draw(time);
        const pixels=ctx.getImageData(141,429,17,23).data, rows=[];
        for (let y=0;y<23;y++) for (let x=0;x<17;x++) {
          const i=(y*17+x)*4;
          if (pixels[i+1]-pixels[i]>50 && pixels[i+2]-pixels[i]>50 && pixels[i+1]>80) rows.push(y);
        }
        return Math.max(...rows)-Math.min(...rows)+1;
      };
      const openEye=eyeHeight(0), closedEye=eyeHeight(2.1);
      const duck=detailShapes.find(s=>s.id==='duck'), paper=detailShapes.find(s=>s.id==='paper-yellow'), leaves=detailShapes.find(s=>s.id==='leaves');
      const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
      const floatRest=detailPoint(duck,352,850,0), floatPeak=detailPoint(duck,352,850,1.1);
      const duckLength=time=>distance(detailPoint(duck,316,798,time),detailPoint(duck,390,825,time));
      return { ...changed, coverage, columns: renderer.columns,
        sizeRatio:Math.max(...renderer.cells.map(c=>c.size))/Math.min(...renderer.cells.map(c=>c.size)),
        largeLetters:renderer.cells.filter(c=>c.size>1.5).length, openEye, closedEye,
        floatRise:floatPeak[1]-floatRest[1], rigidError:Math.abs(duckLength(0)-duckLength(3)),
        pinError:distance(detailPoint(paper,...paper.anchor,3),paper.anchor),
        paperTip:distance(detailPoint(paper,414,293,0),detailPoint(paper,414,293,1.1)),
        stemError:distance(detailPoint(leaves,...leaves.anchor,3),leaves.anchor),
        leafTip:distance(detailPoint(leaves,1270,84,0),detailPoint(leaves,1270,84,1.1)),
        flightX: Math.max(...flight.map(p => p[0])) - Math.min(...flight.map(p => p[0])),
        flightY: Math.max(...flight.map(p => p[1])) - Math.min(...flight.map(p => p[1])) };
    });
    assert(changes.wall < .04, 'architecture should stay still');
    assert.equal(changes.body, 0, 'the seated torso must not twist');
    assert.equal(changes.hand, 0, 'hands stay resting on the desk');
    for (const key of ['bird', 'water', 'code', 'terminal', 'plot']) assert(changes[key] > changes.wall * 3 + .02, `${key} should animate independently`);
    assert(changes.coverage > .65, 'water must not develop wide black gaps');
    assert(changes.columns >= 320, 'desktop ASCII should retain finer detail');
    assert(changes.flightX > 240 && changes.flightY > 120, 'the gull should traverse the sky');
    assert(changes.sizeRatio>1.9 && changes.largeLetters>200, 'mixed typography needs visibly different sizes');
    assert(changes.openEye>changes.closedEye*1.8, 'the robot should visibly close its eyes');
    assert(changes.floatRise>2 && changes.floatRise<5 && changes.rigidError<.001, 'duck and ring float as a rigid object');
    assert(changes.pinError<.001 && changes.paperTip>1, 'paper moves only away from its fixed attachment');
    assert(changes.stemError<.001 && changes.leafTip>1, 'leaf tips move while their stem stays attached');
    for (const key of ['duck','paper','cloud']) assert(changes[key]>.08, `${key} must visibly animate`);
    for (const key of ['windowFrame','sun','pot','rim']) assert(changes[key]<.01, `${key} must stay fixed while surrounding details move`);
    console.log('PASS finer ASCII, continuous water coverage, steady person, three live screens and broad gull flight');
    console.log('PASS mixed sizes, integrated monitor rims, blinking eyes, floating duck, pinned paper, drifting clouds and anchored leaves');
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
    const gullPoint = await gullBodyPoint(page);
    await page.mouse.move(gullPoint.x, gullPoint.y);
    const style = await gull.locator('polygon').evaluate(p => ({ cursor: getComputedStyle(p).cursor, stroke: getComputedStyle(p).stroke, fill: getComputedStyle(p).fill }));
    assert.equal(style.cursor, 'default');
    assert.equal(style.stroke, 'rgba(0, 0, 0, 0)');
    assert.equal(style.fill, 'rgba(0, 0, 0, 0)');
    await page.mouse.click(gullPoint.x, gullPoint.y);
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
    await clockPage.emulateMedia({ reducedMotion: 'reduce' });
    await clockPage.waitForFunction(() => document.querySelector('#pause').getAttribute('aria-pressed') === 'true', null, { polling: 50 });
    const flyingTarget = await gullBodyPoint(clockPage);
    assert(Math.abs(flyingTarget.x - 991 / 1536 * 960) > 50, 'test the bird after it has left its original location');
    await clockPage.mouse.click(flyingTarget.x, flyingTarget.y);
    await clockPage.waitForURL(`${origin}/life/`);
    await clockPage.close();
    console.log('PASS real-time motion and the hidden entry after the gull flies away');

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
