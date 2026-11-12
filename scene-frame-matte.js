// Native source pixels around the window edges contain old sky mixed
// into the frame. Resolve only these narrow bands against a real inner face
// and the neighboring original sky; leave the frame's painted interior alone.
export function prepareFrameMattes(scene,protectedPoint,sourceBlocked=protectedPoint){
 const src=scene.original.data;
 const bands=[
  {x:529,y:65,w:5,h:126,front:530,back:536,solidEnd:532},
  {x:832,y:65,w:3,h:365,front:836,back:829,darkFace:true},
  {x:857,y:65,w:1,h:365,front:855,back:862},
  {x:1360,y:65,w:2,h:365,front:1363,back:1357},
  {x:1380,y:65,w:4,h:365,front:1378,back:1387,darkFace:true,skyStart:1382},
 ];
 for(const band of bands){
  const{x,y,w,h,front,back}=band;
  band.coverage=new Int16Array(w*h).fill(-1);band.colors=new Uint8ClampedArray(w*h*3);
  for(let py=0;py<h;py++){
   const wy=y+py,blockedReference=sourceBlocked(front,wy)||sourceBlocked(back,wy);
   const f=(wy*1536+front)*4,b=(wy*1536+back)*4;
   let norm=0;for(let ch=0;ch<3;ch++)norm+=(src[f+ch]-src[b+ch])**2;
   for(let px=0;px<w;px++){
    const wx=x+px;if(protectedPoint(wx,wy))continue;
    const i=(wy*1536+wx)*4,n=py*w+px;let dot=0;
    // This three-pixel gold face is solid even where a cream cloud behind it
    // has nearly the same color. Keep geometry in this ambiguous case.
    if(band.solidEnd&&wx<band.solidEnd){band.coverage[n]=0;continue;}
    // The old trapezoidal aperture left these two whole sky columns on the
    // room side. They are outside the traced post, regardless of cloud color.
    if(band.skyStart&&wx>=band.skyStart){band.coverage[n]=255;continue;}
    // A moving leaf may have covered the source here. The known geometry
    // above still repairs its backdrop, but leaf RGB is never a matte donor.
    if(sourceBlocked(wx,wy))continue;
    // Saturated cyan in these traced border columns is old sky. A nearby
    // cable or cloud can make the same-row sky donor unsuitable for a linear
    // mix, so resolve this unambiguous case before estimating partial coverage.
    if(src[i+1]>140&&src[i+1]-src[i]>38&&src[i+2]>=src[i+1]-8){band.coverage[n]=255;continue;}
    // White/pink clouds are equally unrelated to these two dark metal faces.
    if(band.darkFace&&Math.min(src[i],src[i+1],src[i+2])>185){band.coverage[n]=255;continue;}
    if(blockedReference||norm<1600)continue;
    for(let ch=0;ch<3;ch++)dot+=(src[i+ch]-src[b+ch])*(src[f+ch]-src[b+ch]);
    let a=Math.max(0,Math.min(1,dot/norm)),error=0;
    for(let ch=0;ch<3;ch++)error+=(src[i+ch]-(src[b+ch]+a*(src[f+ch]-src[b+ch])))**2;
    if(error>1500)continue;
    if(a<.18)a=0;else if(a>.9)a=1;
    band.coverage[n]=Math.round((1-a)*255);
    for(let ch=0;ch<3;ch++)band.colors[n*3+ch]=a===1?src[i+ch]:src[f+ch];
   }
  }
 }
 return bands;
}
