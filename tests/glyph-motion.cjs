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
   const regions={wall:[350,40,150,100],sky:[610,190,140,120],body:[785,505,55,75],city:[1180,356,30,85]};
   const sample=()=>Object.fromEntries(Object.entries(regions).map(([name,box])=>[name,renderer.ctx.getImageData(...box).data]));
   const before=sample(),geometry=renderer.cells.map(c=>[c.x,c.y,c.size].join(','));let maxUpdates=0;
   for(let i=1;i<=240;i++){
    const previous=renderer.glyphMotion.cursor;renderer.glyphMotion.update(i/24);
    maxUpdates=Math.max(maxUpdates,renderer.glyphMotion.cursor-previous);
   }
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
   const palette=new GlyphAtlas(renderer.fontSize,2),cells=renderer.cells.filter(c=>c.glyphLayer==='base');
   const tiles=cells.map(c=>palette.get(c.liveGlyph||c.glyph,c.rgb));
   cells.forEach((c,i)=>palette.drawTile(ctx,tiles[i],c.x,c.y,c.size));
   const expected=ctx.getImageData(0,0,1536,1024).data,actual=renderer.base.getContext('2d').getImageData(0,0,1536,1024).data;
   let error=0;for(let i=0;i<actual.length;i++)error+=Math.abs(actual[i]-expected[i]);
   return {changes,maxUpdates,limit:glyphUpdateLimit,patchError:error/actual.length,
    stableGeometry:renderer.cells.every((c,i)=>[c.x,c.y,c.size].join(',')===geometry[i]),
    paletteSize:renderer.glyphMotion.palette.cache.size,paletteCapacity:renderer.glyphMotion.palette.rows*renderer.glyphMotion.palette.columns};
  });
  console.log('Global glyph changes',JSON.stringify(result));
  for(const[name,region]of Object.entries(result.changes)){
   assert(region.glyphs>10&&region.changed>50,`${name} must visibly change its characters`);
   assert(region.energy>.97&&region.energy<1.03,`${name} must retain its original tone`);
  }
  assert(result.stableGeometry,'global substitutions must not move or resize the characters');
  assert(result.maxUpdates<=result.limit&&result.limit<=48,'bound per-frame work');
  assert(result.paletteSize<=4096&&result.paletteCapacity<=4096,'bound glyph-cache memory');
  assert(result.patchError<.05,'local patches must match a clean reconstruction, without clipped strokes or ghosts');
  // Exercise the real worker and composited display, not only the renderer API.
  const worker=page.workers()[0];
  await worker.evaluate(async()=>{const{LayeredScene}=await import('/layered-scene.js'+location.search),draw=LayeredScene.prototype.draw;LayeredScene.prototype.draw=function(...args){self.glyphProbe=this.r;return draw.apply(this,args)};});
  const clip={x:785,y:505,width:55,height:75},beforeBody=await page.screenshot({clip});
  await page.locator('#pause').click();await page.waitForTimeout(4000);await page.locator('#pause').click();await page.waitForTimeout(250);
  const afterBody=await page.screenshot({clip});assert(!beforeBody.equals(afterBody),'the actual stationary torso must display changing glyphs');
  const visible=await worker.evaluate(()=>({changed:glyphProbe.cells.filter(c=>c.liveGlyph).length,city:glyphProbe.cells.filter(c=>c.sx>1183&&c.sx<1197&&c.sy>380&&c.sy<435).map(c=>c.size)}));
  assert(visible.changed>500&&visible.city.every(size=>size===.6));
  await page.waitForTimeout(350);assert(afterBody.equals(await page.screenshot({clip})),'pause must freeze global character changes');
  console.log('PASS visible global substitutions, original tone and geometry, bounded work/cache and complete pause');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
