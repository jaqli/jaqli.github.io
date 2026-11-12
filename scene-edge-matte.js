// Resolve only a one-pixel boundary between traced foreground and open sky.
// The source RGB may contain the old sky; keep the interior color and let the
// current sky supply the coverage instead of carrying blue/pink fringe pixels.
export function refineSkyEdges(scene,alpha,x0,y0,w,h,lightMask,precise=[]){
 const src=scene.original.data,plate=scene.plate.data,mask=alpha.data,original=mask.slice();
 for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){
  // Explicitly resolved object coverage outranks this color estimate. In
  // particular, filling an inset must not suddenly erode its dark frame.
  if(precise.some(p=>x+x0>=p.x&&x+x0<p.x+p.w&&y+y0>=p.y&&y+y0<p.y+p.h&&p.coverage[(y+y0-p.y)*p.w+x+x0-p.x]>=0))continue;
  const n=y*w+x;if(original[n*4+3]!==0)continue;
  const i=((y+y0)*1536+x+x0)*4;let best=null;
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
   const step=dy*w+dx;
   if(original[(n+step)*4+3]!==255||original[(n-step)*4+3]!==0||original[(n-step*2)*4+3]!==0||original[(n-step*3)*4+3]!==0)continue;
   const f=(((y+y0-dy*2)*1536)+x+x0-dx*2)*4,b=(((y+y0+dy*2)*1536)+x+x0+dx*2)*4;
   let dot=0,norm=0;for(let c=0;c<3;c++){const d=src[f+c]-src[b+c];dot+=(src[i+c]-src[b+c])*d;norm+=d*d;}
   if(norm<1800)continue;
   const a=Math.max(0,Math.min(1,dot/norm));let error=0;
   for(let c=0;c<3;c++)error+=(src[i+c]-(src[b+c]+(src[f+c]-src[b+c])*a))**2;
   if(error>360||a>.92)continue;
   if(!best||error<best.error)best={a,error,f};
  }
  if(!best)continue;
  const a=best.a<.18?0:best.a;
  mask[n*4+3]=Math.round((1-a)*255);
  if(!a)lightMask[n]=1;
  if(a)for(let c=0;c<3;c++)plate[i+c]=src[best.f+c];
 }
}
