// Rebuild the small bracket guide from the image-tool foreground alpha.
// This guide is never downloaded by visitors; rendering retains source pixels.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
(async()=>{const root=path.resolve(__dirname,'..'),d=await sharp(path.join(root,'assets/mattes/shelf-support-prior.png')).extractChannel(0).raw().toBuffer(),runs=[];
 for(let y=307;y<351;y++){let start=-1;for(let x=1399;x<=1421;x++){const a=x<1421&&d[(y-256)*128+x-1376]>=128;if(a&&start<0)start=x;if(!a&&start>=0){runs.push([y,start,x-1]);start=-1;}}}
 const file=path.join(root,'scene-shelf-matte.js');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/const bracketRuns=.*;/,'const bracketRuns='+JSON.stringify(runs)+';'));
})();
