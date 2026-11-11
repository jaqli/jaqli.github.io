const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1536,height:1024},reducedMotion:'reduce'});
  await page.goto(origin);await page.waitForSelector('body.scene-ready');
  const result=await page.evaluate(async()=>{
   const {AsciiRenderer}=await import('./ascii-renderer.js');
   const {GlyphAtlas}=await import('./glyph-atlas.js');
   const {glyphUpdateLimit}=await import('./glyph-motion.js');
   const renderer=new AsciiRenderer(document.querySelector('#scene-image'),document.createElement('canvas'));
   renderer.resize(1536,1024);renderer.draw(0);
   // Sample several skyline buildings: a single narrow tower has too few
   // letters at the wider spacing for a representative ink-energy average.
   const regions={wall:[350,40,150,100],sky:[610,190,140,120],body:[785,505,55,75],city:[1170,355,193,96],water:[1008,475,96,90]};
   const sample=()=>Object.fromEntries(Object.entries(regions).map(([name,box])=>[name,renderer.ctx.getImageData(...box).data]));
   const before=sample(),geometry=renderer.cells.map(c=>[c.x,c.y,c.size,c.occupied].join(',')),seen=new Uint8Array(renderer.cells.length);
   const empty=renderer.cells.filter(c=>!c.occupied);
   let openSquares=0;
   for(let row=0;row<renderer.rows-3;row++)for(let col=0;col<renderer.columns-3;col++){
    let open=true;
    for(let y=0;y<4&&open;y++)for(let x=0;x<4;x++)if(renderer.cells[(row+y)*renderer.columns+col+x].occupied){open=false;break;}
    if(open)openSquares++;
   }
   const contours=renderer.cells.filter(c=>renderer.sampleEdge(c.sx,c.sy,renderer.sourceW/renderer.columns*.34,renderer.sourceH/renderer.rows*.34).contrast>=83);
   const entries=renderer.glyphMotion.palette.entries;let maxUpdates=0,maxCells=0;
   for(let i=1;i<=720;i++){
    renderer.glyphMotion.update(i/24);
    maxUpdates=Math.max(maxUpdates,renderer.glyphMotion.lastBatch.blocks);maxCells=Math.max(maxCells,renderer.glyphMotion.lastBatch.cells);
    for(let j=0;j<seen.length;j++)if(renderer.cells[j].glyphVariant)seen[j]=1;
   }
   const missing=renderer.cells.filter((c,i)=>c.occupied&&c.glyphLayer!=='dynamic'&&!seen[i]).length;
   renderer.glyphMotion.enabled=false;renderer.draw(0);const after=sample();
   const changes=Object.fromEntries(Object.entries(regions).map(([name,[x,y,w,h]])=>{
    let a=0,b=0,changed=0;
    for(let i=0;i<before[name].length;i+=4){let difference=0;for(let c=0;c<3;c++){a+=after[name][i+c];b+=before[name][i+c];difference+=Math.abs(after[name][i+c]-before[name][i+c]);}if(difference>12)changed++;}
    return[name,{changed,energy:a/b,glyphs:renderer.cells.filter(c=>c.liveGlyph&&c.sx>x&&c.sx<x+w&&c.sy>y&&c.sy<y+h).length}];
   }));
   // Reconstruct the entire base independently. Local updates must not erase
   // neighboring strokes or leave remnants of the replaced character.
   const reference=document.createElement('canvas');reference.width=1536;reference.height=1024;
   const ctx=reference.getContext('2d');ctx.fillStyle='#080d13';ctx.fillRect(0,0,1536,1024);
   const palette=new GlyphAtlas(renderer.fontSize,2),cells=renderer.cells.filter(c=>c.occupied&&c.glyphLayer==='base');
   const tiles=cells.map(c=>palette.get(c.liveGlyph||c.glyph,c.rgb));
   cells.forEach((c,i)=>palette.drawTile(ctx,tiles[i],c.x,c.y,c.size));
   const expected=ctx.getImageData(0,0,1536,1024).data,actual=renderer.base.getContext('2d').getImageData(0,0,1536,1024).data;
   let error=0;for(let i=0;i<actual.length;i++)error+=Math.abs(actual[i]-expected[i]);
   const cloud=document.createElement('canvas');cloud.width=renderer.cloudBase.width;cloud.height=renderer.cloudBase.height;
   const cloudCtx=cloud.getContext('2d');cloudCtx.translate(-renderer.cloudBox[0],-renderer.cloudBox[1]);
   const cloudCells=renderer.cells.filter(c=>c.occupied&&c.glyphLayer==='cloud'),cloudTiles=cloudCells.map(c=>palette.get(c.liveGlyph||c.glyph,c.rgb));
   cloudCells.forEach((c,i)=>palette.drawTile(cloudCtx,cloudTiles[i],c.x,c.y,c.size));
   const expectedCloud=cloudCtx.getImageData(0,0,cloud.width,cloud.height).data,actualCloud=renderer.cloudBase.getContext('2d').getImageData(0,0,cloud.width,cloud.height).data;
   let cloudError=0;for(let i=0;i<actualCloud.length;i++)cloudError+=Math.abs(actualCloud[i]-expectedCloud[i]);
   // Moving paper, floats, wings, eyes, lamps and breathing letters all use
   // the same staggered six-second clock, including the Canvas2D fallback.
   renderer.draw(6);
   const moving=[...renderer.dynamic,...renderer.details.flatMap(s=>s.cells),...renderer.sprites.flatMap(s=>s.cells),...renderer.lights.flatMap(s=>s.cells)];
   const movingMissing=moving.filter(c=>c.glyphVariant!==1).length;
   const sourceCells=new Set(renderer.cells),waterLinked=renderer.water.every(c=>c.occupied&&c.glyphSource.occupied&&sourceCells.has(c.glyphSource));
   return {changes,maxUpdates,maxCells,missing,movingMissing,waterLinked,limit:glyphUpdateLimit,patchError:error/actual.length,cloudPatchError:cloudError/actualCloud.length,
    stableGeometry:renderer.cells.every((c,i)=>[c.x,c.y,c.size,c.occupied].join(',')===geometry[i]),
    emptyShare:empty.length/renderer.cells.length,openSquares,contoursRetained:contours.every(c=>c.occupied),
    skyRetained:renderer.cells.filter(c=>c.glyphLayer==='cloud').every(c=>c.occupied),
    brightRetained:renderer.cells.filter(c=>(.2126*c.rgb[0]+.7152*c.rgb[1]+.0722*c.rgb[2])/255>=(c.pillar?.63:.34)).every(c=>c.occupied),
    pillarSpaces:[false,true].map(right=>renderer.cells.filter(c=>c.pillar&&(c.sx>1000)===right&&!c.occupied).length),
    emptyStable:empty.every(c=>!c.occupied&&!c.liveGlyph&&!c.glyphVariant)&&[...renderer.dynamic,...renderer.cloudCells].every(c=>c.occupied),
    cityRetained:renderer.cells.filter(c=>c.sx>1183&&c.sx<1197&&c.sy>380&&c.sy<435).every(c=>c.occupied&&c.size===.6),
    paletteSize:renderer.glyphMotion.palette.entries,immutablePalette:entries===renderer.glyphMotion.palette.entries};
  });
  console.log('Global glyph changes',JSON.stringify(result));
  for(const[name,region]of Object.entries(result.changes)){
   assert(region.glyphs>10&&region.changed>50,`${name} must visibly change its characters`);
   assert(region.energy>.97&&region.energy<1.03,`${name} must retain its original tone`);
  }
  assert(result.stableGeometry,'global substitutions must not move or resize the characters');
  assert(result.maxUpdates<=result.limit&&result.limit<=12&&result.maxCells<=result.limit*64,'bound per-frame blocks and letters');
  assert.equal(result.missing,0,'each retained static character, including water, must participate');
  assert(result.emptyShare>.08&&result.emptyShare<.3&&result.openSquares>5,'include substantial space in dark regions and contiguous empty areas');
  assert(result.pillarSpaces.every(count=>count>20),'both window posts must have space in their dark inner faces');
  assert(result.emptyStable,'global changes, clouds and moving highlights must leave intentional spaces empty');
  assert(result.contoursRetained&&result.cityRetained,'preserve high-contrast details and the minimum-size city');
  assert(result.skyRetained&&result.brightRetained,'keep colorful sky, clouds and bright surfaces filled with characters');
  assert.equal(result.movingMissing,0,'all moving objects and emitters must also change their actual glyphs');
  assert(result.waterLinked,'water reflections must use the same letters as their underlying water cells');
  assert(result.paletteSize<=4096&&result.immutablePalette,'prepare a fixed palette instead of growing caches during animation');
  assert(result.patchError<.05&&result.cloudPatchError<.05,'room and transparent sky patches must match a clean reconstruction, without seams or ghosts');
  // Exercise the real worker and composited display, not only the renderer API.
  const worker=page.workers()[0];
  await worker.evaluate(async()=>{const{LayeredScene}=await import('/layered-scene.js'+location.search),draw=LayeredScene.prototype.draw;LayeredScene.prototype.draw=function(...args){self.glyphProbe=this.r;return draw.apply(this,args)};});
  const clip={x:785,y:505,width:55,height:75},beforeBody=await page.screenshot({clip});
  const floatPixels=()=>page.locator('[data-layer=duck]').evaluate(c=>c.toDataURL());
  const beforeFloat=await floatPixels();
  await page.locator('#pause').click();await page.waitForTimeout(4000);
  // The scattered traversal order depends on which blocks contain letters.
  // Wait for the torso's turn instead of assuming it always falls in 4 s.
  const deadline=Date.now()+25000;
  while(Date.now()<deadline){
   if(await worker.evaluate(()=>self.glyphProbe?.cells.some(c=>c.liveGlyph&&c.sx>785&&c.sx<840&&c.sy>505&&c.sy<580)))break;
   await page.waitForTimeout(500);
  }
  await page.locator('#pause').click();await page.waitForTimeout(250);
  const afterBody=await page.screenshot({clip});assert(!beforeBody.equals(afterBody),'the actual stationary torso must display changing glyphs');
  const afterFloat=await floatPixels();assert.notEqual(beforeFloat,afterFloat,'the duck must change its letters inside its texture, not only move the same bitmap');
  const visible=await worker.evaluate(()=>({changed:glyphProbe.cells.filter(c=>c.liveGlyph).length,city:glyphProbe.cells.filter(c=>c.sx>1183&&c.sx<1197&&c.sy>380&&c.sy<435).map(c=>c.size)}));
  assert(visible.changed>500&&visible.city.every(size=>size===.6));
  await page.waitForTimeout(350);assert(afterBody.equals(await page.screenshot({clip})),'pause must freeze global character changes');
  assert.equal(await floatPixels(),afterFloat,'pause must freeze floating-object letters too');
  console.log('PASS retained background and moving-object glyph coverage, stable negative space, contours, faithful tone and geometry, bounded batches, immutable palette and pause');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
