// Nearest unmasked points in two dimensions. Used once during preparation;
// no scanline interpolation, texture synthesis or pixel readback during motion.
export function exteriorField(mask,width,height){
  const length=width*height,distance=new Int32Array(length),nearest=new Int32Array(length);
  for(let i=0;i<length;i++){distance[i]=mask[i]?width+height:0;nearest[i]=mask[i]?-1:i;}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;if(!mask[i])continue;
    if(x&&distance[i-1]+1<distance[i]){distance[i]=distance[i-1]+1;nearest[i]=nearest[i-1];}
    if(y&&distance[i-width]+1<distance[i]){distance[i]=distance[i-width]+1;nearest[i]=nearest[i-width];}
  }
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
    const i=y*width+x;if(!mask[i])continue;
    if(x+1<width&&distance[i+1]+1<distance[i]){distance[i]=distance[i+1]+1;nearest[i]=nearest[i+1];}
    if(y+1<height&&distance[i+width]+1<distance[i]){distance[i]=distance[i+width]+1;nearest[i]=nearest[i+width];}
  }
  return nearest;
}

export function reflectedSample(index,nearest,mask,width,height){
  const edge=nearest[index];if(edge<0)return index;
  const x=index%width,y=Math.floor(index/width),ex=edge%width,ey=Math.floor(edge/width);
  // Mirror a short real texture patch across the nearest boundary, preserving
  // pixel colors and structure instead of stretching two distant row colors.
  let dx=ex-x,dy=ey-y;const scale=Math.min(1,24/Math.max(1,Math.hypot(dx,dy)));dx=Math.round(dx*scale);dy=Math.round(dy*scale);
  for(let amount=1;amount>=0;amount-=.25){
    const sx=Math.max(0,Math.min(width-1,ex+Math.round(dx*amount))),sy=Math.max(0,Math.min(height-1,ey+Math.round(dy*amount))),sample=sy*width+sx;
    if(!mask[sample])return sample;
  }
  return edge;
}
