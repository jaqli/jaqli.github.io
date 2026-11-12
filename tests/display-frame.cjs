const assert=require('node:assert/strict');
const{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({reducedMotion:'reduce'});await p.goto(process.env.TEST_ORIGIN||'http://127.0.0.1:8081');await p.waitForSelector('.scene-ready');
 const result=await p.evaluate(async()=>{
  const{PixelScene}=await import('./pixel-scene.js?v=20261112-motion54'),{plotFrame}=await import('./scene-display-frame.js?v=20261112-screen53'),{quadPoint}=await import('./scene-geometry.js?v=20261110-fps10');
  const im=document.querySelector('#scene-image'),hd=document.createElement('canvas'),r=await PixelScene.create(im,document.createElement('canvas'),()=>{},hd),q=r.screens[2].quad,outer=plotFrame.outer;
  const parallel=[],gaps=[];
  for(let i=0;i<4;i++){
   const next=(i+1)%4,a=[outer[next][0]-outer[i][0],outer[next][1]-outer[i][1]],z=[q[next][0]-q[i][0],q[next][1]-q[i][1]];
   parallel.push(Math.abs(a[0]*z[1]-a[1]*z[0])/(Math.hypot(...a)*Math.hypot(...z)));
   gaps.push(Math.abs(a[0]*(q[i][1]-outer[i][1])-a[1]*(q[i][0]-outer[i][0]))/Math.hypot(...a));
  }
  const points=[[.15,.035],[.4,.035],[.7,.035],[.02,.2],[.02,.45],[.02,.7],[.1,.965],[.3,.965],[.5,.965],[.98,.12]].map(([u,v])=>quadPoint(outer,u,v).map(Math.floor));
  r.draw(0);
  const native=r.base.getContext('2d'),white=points.map(([x,y])=>Array.from(native.getImageData(x,y,1,1).data).slice(0,3));
  let bezelAlpha=0;for(const[x,y]of points)bezelAlpha=Math.max(bezelAlpha,hd.getContext('2d').getImageData((x-325)*3,(y-335)*3,1,1).data[3]);
  const plot=r.screens[2],pixels=plot.ctx.getImageData(0,0,plot.canvas.width,plot.canvas.height).data;let minAlpha=255;for(let i=3;i<pixels.length;i+=4)minAlpha=Math.min(minAlpha,pixels[i]);
  const source=document.createElement('canvas');source.width=1536;source.height=1024;const sc=source.getContext('2d');sc.drawImage(im,0,0);const original=sc.getImageData(0,0,1536,1024).data,base=native.getImageData(0,0,1536,1024).data;
  const head=r.head,hair=head.canvas.getContext('2d').getImageData(0,0,head.w,head.h).data;let hairError=0,hairPixels=0;
  for(let y=440;y<506;y++)for(let x=695;x<739;x++){
   const j=((y-head.y)*head.w+x-head.x)*4;if(x<head.x||y<head.y||x>=head.x+head.w||y>=head.y+head.h||!hair[j+3])continue;
   hairPixels++;const i=(y*1536+x)*4;for(let c=0;c<3;c++)hairError=Math.max(hairError,Math.abs(base[i+c]-original[i+c]));
  }
  const maskAlpha=hd.getContext('2d').getImageData((722-325)*3,(472-335)*3,1,1).data[3];
  const lights={};let cloudError=0;
  for(const mode of['night','dawn','noon','dusk']){
   await r.setTimeOfDay(mode);let total=0;
   for(const[x,y]of points){const v=native.getImageData(x,y,1,1).data;total+=(v[0]+v[1]+v[2])/3;}
   lights[mode]=total/points.length;
   for(const t of[0,3.4,6.5]){
    r.ctx.drawImage(r.base,0,0);r.drawClouds(t);
    for(const[x,y]of points){const a=native.getImageData(x,y,1,1).data,z=r.ctx.getImageData(x,y,1,1).data;for(let c=0;c<3;c++)cloudError=Math.max(cloudError,Math.abs(a[c]-z[c]));}
   }
  }
  r.draw(0);const before=plot.canvas.toDataURL();r.draw(.8);const moves=before!==plot.canvas.toDataURL();
  r.dispose();return{parallel,gaps,white,bezelAlpha,minAlpha,hairError,hairPixels,maskAlpha,lights,cloudError,moves};
 });
 assert(result.parallel.every(n=>n<1e-10),'content and white frame have parallel corresponding sides');
 assert(Math.abs(result.gaps[0]-result.gaps[2])<1e-10&&Math.abs(result.gaps[1]-result.gaps[3])<1e-10,'opposite frame margins are equal');
 assert(result.gaps.every(n=>n>3.5&&n<5.5),'all four frame margins remain visible');
 assert(result.white.every(rgb=>Math.min(...rgb)>230&&Math.max(...rgb)-Math.min(...rgb)<15),'the visible frame is white on every side');
 assert.equal(result.bezelAlpha,0,'animated content never spills onto the frame');assert.equal(result.minAlpha,255,'old panel content cannot bleed through a transparent screen edge');
 assert(result.hairPixels>500);assert.equal(result.hairError,0,'the original hair is preserved');assert(result.maskAlpha<10,'high-resolution content stays behind the head');
 assert.equal(result.cloudError,0,'clouds and horizon haze never cut through the frame');assert(result.lights.night<result.lights.dusk*.6,'white bezel follows room lighting at night');assert(result.moves,'waveform and spectrum still animate');
 console.log('PASS aligned white bezel, opaque animated inset, preserved hair and four lighting modes',JSON.stringify(result));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
