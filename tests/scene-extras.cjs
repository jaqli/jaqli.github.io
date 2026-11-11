const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8081';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1536,height:1024},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.waitForSelector('.scene-ready');
 const result=await page.evaluate(async()=>{
  const{PixelScene}=await import('./pixel-scene.js?v=20261111-layer44'),canvas=document.createElement('canvas');
  const r=await PixelScene.create(document.querySelector('#scene-image'),canvas),e=r.extras,ctx=r.ctx;
  const regions={steam:[628,475,26,39],fan:[1213,560,59,78],tag:[299,79,35,37],plant:[1415,213,86,33],
   greenRobot:[324,332,29,20],roundRobot:[1349,776,33,30],leftRack:[165,345,105,16],rightRack:[1447,541,65,12],cable:[611,885,124,78],dust:[900,250,162,81]};
  const fixed={cup:[620,526,28,25],fanBase:[1208,642,65,12],fanHub:[1240,595,7,7],pot:[1438,249,24,17],
   tagCord:[307,74,14,5],robotShell:[1384,778,13,22],cableEnd:[652,954,25,7],rackBorder:[1440,532,75,4]};
  const draw=t=>{ctx.drawImage(r.base,0,0);e.draw(ctx,t);};
  draw(0);const baseline=ctx.getImageData(0,0,1536,1024).data;
  const changed=(data,box)=>{const[x,y,w,h]=box;let sum=0;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)for(let c=0;c<3;c++)sum+=Math.abs(data[(py*1536+px)*4+c]-baseline[(py*1536+px)*4+c]);return sum/(w*h*3);};
  const motion=Object.fromEntries(Object.keys(regions).map(k=>[k,0])),anchors=Object.fromEntries(Object.keys(fixed).map(k=>[k,0]));
  for(const t of [.8,1.5,2.75,4.8,7.6,11.1]){
   draw(t);const data=ctx.getImageData(0,0,1536,1024).data;
   for(const[k,b]of Object.entries(regions))motion[k]=Math.max(motion[k],changed(data,b));
   for(const[k,b]of Object.entries(fixed))anchors[k]=Math.max(anchors[k],changed(data,b));
  }
  // Slow flexing must remain continuous, including its silhouette and alpha.
  let step=0;
  for(const start of [.5,1.5,3.5,5.5]){
   let before;
   for(let n=0;n<20;n++){
    ctx.drawImage(r.base,0,0);e.drawCable(ctx,start+n/60);const now=ctx.getImageData(605,880,136,90).data;
    if(before)for(let i=0;i<now.length;i++)if(i%4!==3)step=Math.max(step,Math.abs(now[i]-before[i]));before=now;
   }
  }
  // Animation may upload its tiny cable bitmap, but never read pixels back.
  const readback=CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData=()=>{throw new Error('per-frame pixel readback');};
  const costs=[];try{for(let n=0;n<120;n++){const start=performance.now();e.draw(ctx,n/60);costs.push(performance.now()-start);}}finally{CanvasRenderingContext2D.prototype.getImageData=readback;}
  const caches=new Set();function walk(v){if(v instanceof HTMLCanvasElement)caches.add(v);else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'&&(Object.getPrototypeOf(v)===Object.prototype||v.constructor?.name==='SceneFan'))Object.values(v).forEach(walk);}
  Object.values(e).forEach(walk);const canvasPixels=[...caches].reduce((n,c)=>n+c.width*c.height,0);
  draw(1.23);const a=canvas.toDataURL();draw(1.23);const deterministic=a===canvas.toDataURL();
  costs.sort((a,b)=>a-b);r.dispose();
  return{motion,anchors,cableMaxStep:step,extraCanvasPixels:canvasPixels,drawMedianMs:costs[60],drawP95Ms:costs[114],deterministic};
 });
 for(const[k,v]of Object.entries(result.motion))assert(v>(k==='dust'?.002:.015),`${k} must animate (${v})`);
 for(const[k,v]of Object.entries(result.anchors))assert.equal(v,0,`${k} stays fixed`);
 assert(result.cableMaxStep<=32,`cable must not scan or split (${result.cableMaxStep})`);
 assert(result.extraCanvasPixels<170000,'additional caches stay smaller than 0.65 MiB of RGBA with all three plants');
 assert(result.deterministic,'the shared scene clock fully determines the extra animations');
 assert.deepEqual(errors,[]);console.log('PASS ten new motions, anchored housings/roots/endpoints, smooth cable, bounded caches and no animation readback',JSON.stringify(result));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
