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

async function duckBodyPoint(page) {
  // Freeze the visible duck while choosing a point well inside its body.
  if (await page.locator('#pause').getAttribute('aria-pressed') === 'false') await page.locator('#pause').click();
  return page.locator('[data-hotspot="life"] polygon').evaluate(polygon => {
    const point = new DOMPoint();
    for (const index of [0, 10, 14, 16]) {
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
    await page.addInitScript(()=>{
      const Native=Worker;window.pendingSceneFrames=0;
      window.Worker=class extends Native{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if('painted' in data)pendingSceneFrames--;});}
        postMessage(data,...args){if(data.type==='draw')pendingSceneFrames++;return super.postMessage(data,...args);}};
    });
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
      const { detailShapes, detailPoint, eyeOpening, cloudSpeed } = await import('./scene-details.js');
      const canvas = document.createElement('canvas');
      const renderer = new AsciiRenderer(document.querySelector('#scene-image'), canvas);
      renderer.resize(1536, 1024);
      // Isolate object geometry here; global character substitutions have a
      // separate regression check and may legitimately alter stationary pixels.
      renderer.glyphMotion.enabled=false;
      const drawGlyph=renderer.spriteAtlas.draw;
      renderer.spriteAtlas.draw=function(ctx,cell,x,y,size){return drawGlyph.call(this,ctx,cell,x,y,size,0);};
      renderer.draw(0);
      const ctx = canvas.getContext('2d');
      const regions = { wall: [350,40,150,140], bird: [934,212,114,80], water: [1010,480,100,80],
        body: [785,505,55,75], hand: [665,520,40,25],
        code: [441,383,109,77], terminal: [337,414,95,56], plot: [643,446,70,39],
        sidebar: [567,385,25,65], status: [443,454,100,13], lamp: [155,56,48,43],
        redEye: [275,213,32,21], leftFace: [294,658,60,38], rightFace: [1464,391,52,35],
        wallPaper: [113,150,42,76], boardPaper: [415,196,41,48], monitorPaper: [457,467,45,51],
        duck: [290,785,130,89], paper: [394,250,44,48], cloud: [610,190,140,120],
        boat: [1158,486,78,51], blueCan: [575,757,26,47], redCan: [1139,719,25,34],
        floatingPages: [623,792,128,58], tablet: [953,795,166,86], phone: [724,940,102,55],
        floatingPage: [395,881,214,100], paperBoat: [753,870,73,52], waterCar: [1090,844,252,123],
        expandedPlot: [634,439,9,45], leftTop: [349,398,16,8],
        hair: [716,468,15,31], looseHair: [708,482,3,14], hairGap: [711,486,2,1], city: [1180,356,30,85],
        // The lower part of the central monitor's left rim is occluded by the
        // foreground waveform monitor; test only the exposed upper frame.
        windowFrame: [840,110,11,260], sun: [1091,363,18,21], pot: [1310,140,38,21], rim: [420,353,8,40] };
      const hairMask=renderer.headMask.getContext('2d').getImageData(0,0,renderer.headMask.width,renderer.headMask.height).data;
      const first = Object.fromEntries(Object.entries(regions).map(([key, box]) => [key, ctx.getImageData(...box).data]));
      renderer.draw(6.2);
      const changed = Object.fromEntries(Object.entries(regions).map(([key, box]) => {
        const pixels = ctx.getImageData(...box).data; let changed = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          // Real gaps between curls should show the changing monitor. Test
          // occlusion on the opaque hair mask, not the surrounding rectangle.
          if(key==='hair'||key==='looseHair'){
            const x=box[0]+i/4%box[2]-renderer.headMaskBox[0],y=box[1]+Math.floor(i/4/box[2])-renderer.headMaskBox[1];
            if(hairMask[(y*renderer.headMask.width+x)*4+3]!==255)continue;
          }
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
        // Measure the LED itself; a brighter blue face is not an open eye.
        const eye=document.createElement('canvas');eye.width=17;eye.height=23;
        const eyeCtx=eye.getContext('2d');eyeCtx.translate(-141,-429);
        renderer.drawDetails(time,renderer.details.filter(sprite=>sprite.shape.kind==='eye'),eyeCtx);
        const pixels=eyeCtx.getImageData(0,0,17,23).data, rows=[];
        for (let y=0;y<23;y++) for (let x=0;x<17;x++) {
          const i=(y*17+x)*4;
          if (pixels[i+1]-pixels[i]>50 && pixels[i+2]-pixels[i]>50 && pixels[i+1]>80) rows.push(y);
        }
        return Math.max(...rows)-Math.min(...rows)+1;
      };
      const openEye=eyeHeight(0), closedEye=eyeHeight(2.1);
      renderer.draw(0);
      const cyanCenter = ([x,y,w,h]) => {
        const pixels=ctx.getImageData(x,y,w,h).data; let sum=0, count=0;
        for (let row=0;row<h;row++) for (let col=0;col<w;col++) {
          const i=(row*w+col)*4;
          if (pixels[i+1]>85 && pixels[i+1]-pixels[i]>35 && pixels[i+2]-pixels[i]>35) { sum+=row+y; count++; }
        }
        return count ? sum/count : NaN;
      };
      const faceTilt=cyanCenter([313,663,13,19])-cyanCenter([338,651,15,20]);
      const duck=detailShapes.find(s=>s.id==='duck'), paper=detailShapes.find(s=>s.id==='paper-yellow'), leaves=detailShapes.find(s=>s.id==='leaves');
      const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
      const floatRest=detailPoint(duck,352,850,0), floatPeak=detailPoint(duck,352,850,1.1);
      const duckLength=time=>distance(detailPoint(duck,316,798,time),detailPoint(duck,390,825,time));
      const distantWing=renderer.platePixels.subarray((185*1536+1234)*4,(185*1536+1234)*4+4);
      const floatMotion=detailShapes.filter(s=>s.kind==='float').map(shape=>{
        const [a,b]=shape.polygon, initial=distance(a,b);
        const levels=Array.from({length:41},(_,i)=>detailPoint(shape,...shape.anchor,i*.3)[1]);
        return {id:shape.id,range:Math.max(...levels)-Math.min(...levels),
          rigidError:Math.max(...[1,3,5,9].map(t=>Math.abs(distance(detailPoint(shape,...a,t),detailPoint(shape,...b,t))-initial)))};
      });
      const paperOffsets=Array.from({length:241},(_,i)=>detailPoint(paper,414,293,i*.05)[0]-414);
      const paperCrossings=paperOffsets.slice(1).filter((x,i)=>x*paperOffsets[i]<0).length;
      renderer.draw(0);
      const litScene=document.createElement('canvas');litScene.width=1536;litScene.height=1024;
      const litCtx=litScene.getContext('2d');litCtx.drawImage(canvas,0,0);
      const {drawSceneAmbience}=await import('./scene-snapshot.js');
      drawSceneAmbience(litCtx,{x:0,y:0,width:1536,height:1024});
      const regionLight = box => {
        const p=litCtx.getImageData(...box).data; let sum=0;
        for (let i=0;i<p.length;i+=4) sum+=.2126*p[i]+.7152*p[i+1]+.0722*p[i+2];
        return sum/(p.length/4);
      };
      const spriteSizes=[...renderer.details,...renderer.sprites].flatMap(sprite=>sprite.cells.map(cell=>cell.size));
      // Sample actual building interiors independently of the skyline mask.
      const cityBoxes=[[1183,380,14,55],[1253,400,10,35],[1480,309,14,30],[1405,354,5,40]];
      const citySizes=cityBoxes.map(([x,y,w,h])=>[...new Set(renderer.cells.filter(c=>c.sx>x&&c.sx<x+w&&c.sy>y&&c.sy<y+h).map(c=>c.size))]);
      const cityAnimates=renderer.dynamic.some(c=>cityBoxes.some(([x,y,w,h])=>c.sx>x&&c.sx<x+w&&c.sy>y&&c.sy<y+h));
      const {FlightLayer}=await import('./flight-layer.js');
      const flightLayer=new FlightLayer(document.createElement('div'));flightLayer.configure(renderer.getFlightData());
      let fixedBirdSizeError=0,fallbackBirdSizeError=0;
      const stamp=renderer.stamp;
      renderer.stamp=function(cell,x,y,size,...args){fallbackBirdSizeError=Math.max(fallbackBirdSizeError,Math.abs(size-.5));return stamp.call(this,cell,x,y,size,...args);};
      for(const time of [0,.001,.01,6.2,14,27,60]){
        flightLayer.draw(time);renderer.drawBirds(time);
        for(const sprite of flightLayer.sprites){
          const matrix=new DOMMatrix(sprite.canvas.style.transform),scale=Math.hypot(matrix.a,matrix.b);
          for(const cell of sprite.cells)fixedBirdSizeError=Math.max(fixedBirdSizeError,Math.abs(cell.drawSize*scale-.5));
        }
      }
      renderer.stamp=stamp;
      const typeMeasure=document.createElement('canvas').getContext('2d');typeMeasure.font=`500 ${renderer.fontSize}px monospace`;
      // Local samples catch a uniform sky even when the whole scene happens
      // to contain all eight sizes. Include the room, person and water as well.
      const localSizeMix=[[610,190],[940,140],[1060,260],[350,40],[780,500],[1000,490]].map(([x,y])=>{
        const cells=renderer.cells.filter(c=>c.occupied&&c.sx>x&&c.sx<x+90&&c.sy>y&&c.sy<y+90);
        const mean=cells.reduce((sum,c)=>sum+c.size,0)/cells.length;
        return {bins:new Set(cells.map(c=>c.size)).size,spread:Math.sqrt(cells.reduce((sum,c)=>sum+(c.size-mean)**2,0)/cells.length)};
      });
      return { ...changed, coverage, columns: renderer.columns,
        cellW:renderer.cellW,cellH:renderer.cellH,letterGap:renderer.cellW-typeMeasure.measureText('M').width*1.2,totalCells:renderer.cells.length,
        middleShare:renderer.cells.filter(c=>c.size>=.8&&c.size<=1).length/renderer.cells.length,
        largeShare:renderer.cells.filter(c=>c.size>=1.1).length/renderer.cells.length,
        localSizeMix,spriteSizeBins:new Set(spriteSizes).size,
        citySizes,cityAnimates,fixedBirdSizeError,fallbackBirdSizeError,
        faceTilt, floatMotion, paperCrossings,
        cityContrast:regionLight([1160,365,17,25])/regionLight([1191,365,17,35]),
        spriteSizeRange:[Math.min(...spriteSizes),Math.max(...spriteSizes)],
        distantWingCleared:distantWing[1]-distantWing[0]>20 && distantWing[2]-distantWing[0]>20,
        sizes:[...new Set(renderer.cells.map(c=>c.size))].sort((a,b)=>a-b), openEye, closedEye,
        repeatedBlink:eyeOpening(5.3), cloudSpeed, paperCount:detailShapes.filter(s=>s.kind==='paper').length,
        floatRise:floatPeak[1]-floatRest[1], rigidError:Math.abs(duckLength(0)-duckLength(3)),
        pinError:distance(detailPoint(paper,...paper.anchor,3),paper.anchor),
        paperTip:distance(detailPoint(paper,414,293,0),detailPoint(paper,414,293,1.1)),
        stemError:distance(detailPoint(leaves,...leaves.anchor,3),leaves.anchor),
        leafTip:distance(detailPoint(leaves,1270,84,0),detailPoint(leaves,1270,84,1.1)),
        flightX: Math.max(...flight.map(p => p[0])) - Math.min(...flight.map(p => p[0])),
        flightY: Math.max(...flight.map(p => p[1])) - Math.min(...flight.map(p => p[1])) };
    });
    console.log('Scene motion and local type',JSON.stringify({wall:changes.wall,water:changes.water,city:changes.city,cityContrast:changes.cityContrast,localSizeMix:changes.localSizeMix,middleShare:changes.middleShare,largeShare:changes.largeShare}));
    assert(changes.wall < .04, 'architecture should stay still');
    assert.equal(changes.body, 0, 'the seated torso must not twist');
    assert.equal(changes.hand, 0, 'hands stay resting on the desk');
    assert.equal(changes.hair, 0, 'the complete right display must remain behind the head');
    assert.equal(changes.looseHair, 0, 'the irregular left hair edge must also occlude the display');
    assert(changes.hairGap>.1, 'the real background gap between curls should reveal the animated display');
    assert(changes.leftTop>.02, 'the newly exposed top rows of the left display should animate');
    // Mixed sizes change the amount of ink in a crop. Require both a visible
    // absolute change and motion clearly above the stationary wall sample.
    for (const key of ['bird', 'water', 'code', 'terminal', 'plot']) assert(changes[key]>.03&&changes[key]>changes.wall*3, `${key} should animate independently`);
    assert(changes.coverage > .65, 'water must not develop wide black gaps');
    assert(changes.columns>=260&&changes.columns<=300&&changes.totalCells<40000,'open up the desktop lattice without losing the city silhouette');
    assert(changes.cellW>=5.5&&changes.cellH>=7.8&&changes.letterGap>1.4,'typical letters need real horizontal and vertical breathing room');
    assert(changes.middleShare>.45&&changes.middleShare<.65&&changes.largeShare>.2,'mix smaller letters among readable medium and large glyphs');
    assert(changes.localSizeMix.every(region=>region.bins>=7&&region.spread>.14),'sky and room must each mix sizes locally, rather than only across different regions');
    assert(changes.spriteSizeBins>=7,'papers and floating objects must also contain varied letter sizes');
    assert(changes.spriteSizeRange[0]>=.5 && changes.spriteSizeRange[1]<=1.2, 'moving objects must share the requested font range');
    assert(changes.flightX > 240 && changes.flightY > 120, 'the gull should traverse the sky');
    assert(changes.distantWingCleared, 'the distant gull must not remain baked into the drifting cloud texture');
    assert.deepEqual(changes.sizes,[.5,.6,.7,.8,.9,1,1.1,1.2], 'all eight requested font sizes must be present');
    assert(changes.citySizes.every(sizes=>sizes.length===1&&sizes[0]===.5)&&!changes.cityAnimates, 'distant buildings must retain the fixed 0.50 detail size');
    // CSS serializes matrix coefficients to six significant digits.
    assert(changes.fixedBirdSizeError<1e-5&&changes.fallbackBirdSizeError===0, 'flight perspective must never enlarge or shrink the fixed-size bird glyphs');
    assert(changes.openEye>changes.closedEye*1.8, 'the robot should visibly close its eyes');
    assert(changes.repeatedBlink<.1, 'the robot should blink again after 3.2 seconds');
    assert.equal(changes.cloudSpeed,45,'clouds should move at three times the previous 15 source pixels per second');
    assert(changes.paperCount>=9, 'additional papers should join the wind animation');
    for (const key of ['sidebar','status','lamp','redEye','leftFace','rightFace','wallPaper','boardPaper','monitorPaper']) assert(changes[key]>.02, `${key} must visibly animate`);
    for (const key of ['boat','blueCan','redCan','floatingPages','tablet','phone','floatingPage','paperBoat','waterCar','expandedPlot']) assert(changes[key]>.03, `${key} must animate in its actual image region`);
    assert(changes.faceTilt>5, 'left robot eyes must follow the upward slope of its actual face panel');
    assert(changes.floatMotion.length>=11 && changes.floatMotion.every(s=>s.range>2 && s.rigidError<.001), 'floating objects should bob as intact objects');
    assert(changes.paperCrossings>=5, 'pinned papers should flutter more frequently');
    assert(changes.city<.01 && changes.cityContrast>1.2, 'the distant skyline must stay still and remain distinguishable from the sky');
    assert(changes.floatRise>2 && changes.floatRise<5 && changes.rigidError<.001, 'duck and ring float as a rigid object');
    assert(changes.pinError<.001 && changes.paperTip>1, 'paper moves only away from its fixed attachment');
    assert(changes.stemError<.001 && changes.leafTip>1, 'leaf tips move while their stem stays attached');
    for (const key of ['duck','paper','cloud']) assert(changes[key]>.08, `${key} must visibly animate`);
    for (const key of ['windowFrame','sun','pot','rim']) assert(changes[key]<.01, `${key} must stay fixed while surrounding details move`);
    console.log('PASS readable spaced ASCII, continuous water coverage, steady person, three live screens and broad gull flight');
    console.log('PASS mixed sizes, integrated monitor rims, blinking eyes, floating duck, pinned paper, drifting clouds and anchored leaves');
    console.log('PASS slanted robot face, expanded right display, fine skyline, quicker paper and eleven intact floating objects');
    assert.equal(await page.locator('input[type=file], input[type=range], #choose-image').count(), 0);
    const bounds = await page.locator('#ascii-canvas').boundingBox();
    assert(bounds.x <= 0 && bounds.y <= 0 && bounds.width >= 1440 && bounds.height >= 900);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false);
    console.log('PASS full-viewport artwork, no uploader or control panel');

    const snapshot = async () => {
      // Let a frame that began before pause finish; the blocked-frame test in
      // responsiveness.cjs separately verifies cancellation before presentation.
      if(await page.locator('#pause').getAttribute('aria-pressed')==='true')await page.waitForFunction(()=>pendingSceneFrames===0);
      // Transferred canvases commit at a compositor boundary. Let the last
      // already-painted frame settle before comparing a paused surface.
      if(await page.locator('#pause').getAttribute('aria-pressed')==='true')await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      return page.locator('#ascii-canvas').evaluate(c => c.toDataURL());
    };
    let first = await snapshot();
    await page.waitForTimeout(250);
    assert.notEqual(await snapshot(), first);
    await page.locator('#pause').click();
    first = await snapshot();
    const pausedFlight=await page.locator('#flight-layer').evaluate(e=>[...e.children].map(c=>c.style.transform+c.toDataURL()));
    await page.waitForTimeout(200);
    assert.equal(await snapshot(), first);
    assert.deepEqual(await page.locator('#flight-layer').evaluate(e=>[...e.children].map(c=>c.style.transform+c.toDataURL())),pausedFlight);
    console.log('PASS scene animates and can pause');

    await clickScenePoint(page, 510, 420);
    await page.waitForSelector('.page-transition');
    await page.waitForURL(`${origin}/tech/`);
    assert.match(await page.locator('h1').textContent(), /Tech/);
    await page.goBack({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('.page-transition'));
    assert.equal(await page.locator('.page-transition').count(), 0);
    console.log('PASS monitor navigates through transition; Back restores scene');

    await page.locator('[data-hotspot="tech"] .hotspot-label rect').click();
    await page.waitForURL(`${origin}/tech/`);
    await openScene(page);
    console.log('PASS the visible Tech Blog label is also clickable');

    await clickScenePoint(page, 790, 530);
    await page.waitForURL(`${origin}/cv/`);
    await openScene(page);
    const duckEntry = page.locator('[data-hotspot="life"]');
    assert.equal(await duckEntry.locator('text, title, .hotspot-label').count(), 0);
    const duckPoint = await duckBodyPoint(page);
    const world=await page.locator('#scene-world').boundingBox();
    const sourcePoint={x:(duckPoint.x-world.x)/world.width*1536,y:(duckPoint.y-world.y)/world.height*1024};
    assert(sourcePoint.x>320 && sourcePoint.x<385 && sourcePoint.y>820 && sourcePoint.y<875,'Life must be attached to the yellow duck');
    const flyingBird=await page.locator('[data-bird=primary]').boundingBox();
    await page.mouse.click(flyingBird.x+flyingBird.width/2,flyingBird.y+flyingBird.height/2);
    assert.equal(page.url(),`${origin}/`,'the gull is no longer a navigation entrance');
    await page.mouse.move(duckPoint.x, duckPoint.y);
    const style = await duckEntry.locator('polygon').evaluate(p => ({ cursor: getComputedStyle(p).cursor, stroke: getComputedStyle(p).stroke, fill: getComputedStyle(p).fill }));
    assert.equal(style.cursor, 'default');
    assert.equal(style.stroke, 'rgba(0, 0, 0, 0)');
    assert.equal(style.fill, 'rgba(0, 0, 0, 0)');
    await page.mouse.click(duckPoint.x, duckPoint.y);
    await page.waitForURL(`${origin}/life/`);
    console.log('PASS person opens CV; unmarked yellow duck opens Life without hover hint');

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
      Object.defineProperty(window,'Worker',{value:undefined});
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
        return [...document.querySelector('[data-hotspot="life"] polygon').getAttribute('points').split(/[ ,]/).map(Number),...new DOMMatrix(document.querySelector('[data-bird=primary]').style.transform).toFloat64Array()];
      }, step);
    }
    const fastPosition = await runCadence(50);
    const slowPosition = await runCadence(250);
    assert(fastPosition.every((value, i) => Math.abs(value - slowPosition[i]) < .001), 'low frame rates must not slow the animation clock');
    await clockPage.emulateMedia({ reducedMotion: 'reduce' });
    await clockPage.waitForFunction(() => document.querySelector('#pause').getAttribute('aria-pressed') === 'true', null, { polling: 50 });
    const floatingTarget = await duckBodyPoint(clockPage);
    await clockPage.mouse.click(floatingTarget.x, floatingTarget.y);
    await clockPage.waitForURL(`${origin}/life/`);
    await clockPage.close();
    console.log('PASS real-time flight, duck motion and the hidden entry on the floating duck');

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
    for (const [x, y, route] of [[510, 420, 'tech'], [790, 530, 'cv'], [350, 835, 'life']]) {
      await openScene(mobile);
      await clickScenePoint(mobile, x, y, { pan: true, tap: true });
      await mobile.waitForURL(`${origin}/${route}/`);
    }
    await mobile.setViewportSize({ width: 844, height: 390 });
    await openScene(mobile);
    await clickScenePoint(mobile, 350, 835, { tap: true });
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
    await page.route('**/content/site.json*', r => r.fulfill({ json: fixture }));
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
