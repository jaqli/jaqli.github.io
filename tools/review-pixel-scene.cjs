// Export a complete 4×4 inspection grid, at the same native scale on both
// sides. Call with before-image, after-image and output-directory arguments.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
(async()=>{
 const [before,after,out]=process.argv.slice(2);
 if(!before||!after||!out)throw new Error('Usage: node tools/review-pixel-scene.cjs BEFORE AFTER OUTPUT_DIRECTORY');
 const a=await sharp(before).metadata(),b=await sharp(after).metadata();
 if(a.width!==b.width||a.height!==b.height)throw new Error('Images must have identical native dimensions');
 fs.mkdirSync(out,{recursive:true});const rows=[];
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const x=Math.floor(col*a.width/4),y=Math.floor(row*a.height/4),w=Math.floor((col+1)*a.width/4)-x,h=Math.floor((row+1)*a.height/4)-y;
  const crop={left:x,top:y,width:w,height:h},images=[];
  for(const input of[before,after])images.push(await sharp(input).extract(crop).resize(w*2,h*2,{kernel:'nearest'}).png().toBuffer());
  const name=`${row+1}-${col+1}.png`;
  await sharp({create:{width:w*4,height:h*2,channels:3,background:'#080d13'}}).composite([{input:images[0],left:0,top:0},{input:images[1],left:w*2,top:0}]).png().toFile(path.join(out,name));
  rows.push(`<figure><figcaption>${row+1}-${col+1}: x=${x}, y=${y} — before / after, both 2× nearest</figcaption><img src="${name}" width="${w*4}" height="${h*2}" loading="lazy"></figure>`);
 }
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Whole-scene pixel review</title><style>body{background:#080d13;color:#cbdeda;font:14px monospace;margin:24px}figure{margin:24px 0}figcaption{margin-bottom:8px}img{image-rendering:pixelated;max-width:none}</style><h1>All 16 regions, unchanged scale</h1>${rows.join('\n')}`);
 console.log(`All native pixels covered by 16 before/after comparisons: ${path.resolve(out,'index.html')}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
