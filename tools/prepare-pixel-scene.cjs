// Native-resolution, deterministic restoration. Every pixel is processed from
// the original PNG; no generative redraw, resizing, masks or per-object style.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');

async function preparePixelScene(){
 const root=path.resolve(__dirname,'..'),source=path.join(root,'assets/IMG_1183.PNG');
 const {data,info}=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height}=info,clean=Buffer.from(data),pixels=Buffer.from(data);
 // Remove small color fluctuations within a surface, without averaging across
 // its boundary. A thin wire/printed stroke remains distinct from its neighbors.
 const colorWeight=Float32Array.from({length:3*255*255+1},(_,d)=>Math.exp(-d/(2*11*11)));
 const neighbors=[];
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)neighbors.push([dx,dy,Math.exp(-(dx*dx+dy*dy)/3)]);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*3,sum=[0,0,0];let total=0;
  for(const[dx,dy,spatial]of neighbors){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const j=(ny*width+nx)*3,d=(data[i]-data[j])**2+(data[i+1]-data[j+1])**2+(data[i+2]-data[j+2])**2;
   const weight=spatial*colorWeight[d];total+=weight;
   for(let c=0;c<3;c++)sum[c]+=data[j+c]*weight;
  }
  for(let c=0;c<3;c++)clean[i+c]=Math.round(sum[c]/total);
 }
 // Tighten existing transitions, including internal folds and markings. Clamp
 // to the actual local color range so sharpening cannot add light/dark halos.
 // This is a single pass, not repeated erosion or a larger pixel grid.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*3,low=[255,255,255],high=[0,0,0],sum=[0,0,0];let total=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const nx=Math.max(0,Math.min(width-1,x+dx)),ny=Math.max(0,Math.min(height-1,y+dy));
   const j=(ny*width+nx)*3,weight=(dx===0?2:1)*(dy===0?2:1);total+=weight;
   for(let c=0;c<3;c++){low[c]=Math.min(low[c],clean[j+c]);high[c]=Math.max(high[c],clean[j+c]);sum[c]+=clean[j+c]*weight;}
  }
  const range=Math.max(...high.map((v,c)=>v-low[c])),amount=1.8*Math.max(0,Math.min(1,(range-12)/28));
  for(let c=0;c<3;c++){
   const value=Math.max(low[c],Math.min(high[c],clean[i+c]+amount*(clean[i+c]-sum[c]/total)));
   // At most two channel levels of rounding; no restrictive scene-wide palette
   // that merges unrelated shades or drops low-contrast interior detail.
   pixels[i+c]=Math.min(255,Math.round(value/4)*4);
  }
 }
 const target=path.join(root,'assets/scene.webp');
 await sharp(pixels,{raw:info}).webp({lossless:true,effort:6}).toFile(target);
 await sharp(target).resize(192,128).webp({quality:72}).toFile(path.join(root,'assets/scene-seed.webp'));
 await sharp(target).resize(Math.round(width/1.5),Math.round(height/1.5),{kernel:'nearest'}).webp({lossless:true,effort:6}).toFile(path.join(root,'assets/scene-poster.webp'));
 const colors=new Set();let squared=0;const mean=[0,0,0];
 for(let i=0;i<pixels.length;i+=3){colors.add(pixels[i]*65536+pixels[i+1]*256+pixels[i+2]);for(let c=0;c<3;c++){const d=pixels[i+c]-data[i+c];squared+=d*d;mean[c]+=d;}}
 console.log(JSON.stringify({width,height,processedPixels:width*height,colors:colors.size,rmse:Math.sqrt(squared/pixels.length),meanShift:mean.map(n=>n/(width*height)),bytes:fs.statSync(target).size}));
}
preparePixelScene().catch(error=>{console.error(error);process.exitCode=1;});
