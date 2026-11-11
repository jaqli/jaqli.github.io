// Global pixel cleanup from the untouched source PNG. No redraw, spatial
// rescaling or per-object filter: all animation layers use this one master.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
(async()=>{
 const root=path.resolve(__dirname,'..'),source=path.join(root,'assets/IMG_1183.PNG');
 const {data,info}=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height,channels}=info,pixels=Buffer.from(data);let pooled=0;
 // Merge only nearly identical colors on a native 2×2 grid. High-contrast
 // leaves, wires, lettering and highlights retain their original 1 px detail.
 for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
  const ids=[];for(let dy=0;dy<2&&y+dy<height;dy++)for(let dx=0;dx<2&&x+dx<width;dx++)ids.push(((y+dy)*width+x+dx)*channels);
  const low=[255,255,255],high=[0,0,0],sum=[0,0,0];for(const i of ids)for(let c=0;c<3;c++){low[c]=Math.min(low[c],data[i+c]);high[c]=Math.max(high[c],data[i+c]);sum[c]+=data[i+c];}
  if(high.some((v,c)=>v-low[c]>18))continue;
  for(const i of ids)for(let c=0;c<3;c++)pixels[i+c]=Math.round(sum[c]/ids.length);pooled+=ids.length;
 }
 // One scene-wide palette, without dithering or lossy chroma subsampling.
 const palette=await sharp(pixels,{raw:info}).png({palette:true,colours:256,dither:0,effort:10}).toBuffer();
 const target=path.join(root,'assets/scene.webp');await sharp(palette).webp({lossless:true,effort:6}).toFile(target);
 await sharp(target).resize(192,128).webp({quality:72}).toFile(path.join(root,'assets/scene-seed.webp'));
 const decoded=await sharp(target).removeAlpha().raw().toBuffer(),colors=new Set();let squared=0;const mean=[0,0,0];
 for(let i=0;i<decoded.length;i+=3){colors.add(decoded[i]*65536+decoded[i+1]*256+decoded[i+2]);for(let c=0;c<3;c++){const d=decoded[i+c]-data[i+c];squared+=d*d;mean[c]+=d;}}
 console.log(JSON.stringify({width,height,palette:colors.size,pooledPixels:pooled,rmse:Math.sqrt(squared/decoded.length),meanShift:mean.map(n=>n/(width*height)),bytes:fs.statSync(target).size}));
})();
