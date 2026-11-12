// Bracket location guided by the generated foreground matte; original scene
// colors and one-pixel edge coverage are resolved at native resolution.
const bracketRuns=[[322,1419,1420],[323,1419,1420],[324,1419,1420],[325,1419,1420],[326,1419,1420],[327,1418,1420],[328,1417,1420],[329,1417,1420],[330,1416,1420],[331,1416,1419],[332,1415,1418],[333,1407,1417],[334,1405,1417],[335,1405,1416],[336,1405,1407],[336,1415,1416],[337,1405,1406],[337,1415,1416],[338,1405,1406],[338,1415,1416],[339,1405,1406],[339,1415,1416],[340,1405,1406],[340,1415,1416],[341,1405,1406],[341,1415,1416],[342,1405,1406],[342,1415,1416],[343,1405,1406],[343,1415,1416],[344,1405,1406],[344,1415,1416],[345,1405,1406],[345,1415,1416],[346,1405,1406],[346,1415,1416],[347,1405,1406],[347,1415,1416],[348,1405,1406],[348,1415,1416],[349,1406,1406],[349,1415,1415]];
const clamp=n=>Math.max(0,Math.min(1,n));
export function prepareShelfMatte(scene){
 const x=1399,y=301,w=40,h=129,coverage=new Int16Array(w*h).fill(-1),src=scene.original.data,plate=scene.plate.data;
 const nearPrior=(px,py)=>bracketRuns.some(([row,left,right])=>Math.abs(row-py)<=4&&px>=left-4&&px<=right+4);
 const strong=new Uint8Array(w*h);
 for(let py=309;py<351;py++)for(let px=1401;px<1422;px++){
  const i=(py*1536+px)*4,r=src[i],g=src[i+1],b=src[i+2];
  strong[(py-y)*w+px-x]=nearPrior(px,py)&&r>80&&r>g*1.3&&r>b*1.65?1:0;
 }
 const edge=(px,py,fx,bx)=>{
  const i=(py*1536+px)*4,f=(py*1536+fx)*4,b=(py*1536+bx)*4;let dot=0,norm=0;
  for(let c=0;c<3;c++){const d=src[f+c]-src[b+c];dot+=(src[i+c]-src[b+c])*d;norm+=d*d;}
  let a=norm>900?clamp(dot/norm):1;if(a<.1)a=0;else if(a>.9)a=1;
  if(a>0&&a<1)for(let c=0;c<3;c++)plate[i+c]=src[f+c];
  return Math.round((1-a)*255);
 };
 for(let py=y;py<y+h;py++){
  // Keep the original cream trim and side face; remove only the exterior
  // fringe. The city and terminal to the right remain separate foreground.
  const left=py<395?1420:1419,right=py<334?1432:1431;
  for(let px=1413;px<=right;px++)coverage[(py-y)*w+px-x]=px<left-1?255:px===left-1?edge(px,py,left+1,left-3):0;
  if(py<350){coverage[(py-y)*w+right+1-x]=edge(right+1,py,right,right+3);for(let px=right+2;px<1438;px++)coverage[(py-y)*w+px-x]=255;}
  if(py>=309&&py<351)for(let px=1401;px<1422;px++){
   const n=(py-y)*w+px-x,i=(py*1536+px)*4,r=src[i],g=src[i+1],b=src[i+2];
   let adjacent=false;for(let dy=-1;dy<=1&&!adjacent;dy++)for(let dx=-1;dx<=1;dx++)if(strong[n+dy*w+dx]){adjacent=true;break;}
   const priorCore=bracketRuns.some(([row,left,right])=>row===py&&px>=left&&px<=right);
   // The traced prongs are geometry, not a brightness classification. Their
   // pale edge pixels must survive restoration and different color palettes.
   // The original has a pale inset between the two dark sides. It is an
   // opaque face, not an opening through which the moving sky can pass.
   const inset=px>=1407&&px<1415&&py>=336&&py<350;
   const stem=priorCore||inset;
   const rim=adjacent&&(Math.max(r,g,b)<105||r>b*1.1&&r>g*.95);
   if(nearPrior(px,py)&&(px<left-1||strong[n]))coverage[n]=strong[n]||rim||stem?0:255;
  }
 }
 return{x,y,w,h,coverage};
}
