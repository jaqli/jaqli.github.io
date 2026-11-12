import { quadPoint } from './scene-geometry.js?v=20261110-fps10';
import { inside } from './scene-objects.js?v=20261111-sky43';
import { exteriorField, reflectedSample } from './pixel-surface.js?v=20261111-surface37';

// One plane defines both the white housing and the inset display. The content
// cannot acquire a different tilt or drift into the bezel as it animates.
export const plotFrame={
 outer:[[632,423],[733,427],[738,506],[637,502]],
 width:101,height:79,insetX:4,insetY:5,
};
const {outer,width,height,insetX,insetY}=plotFrame;
export const plotContentQuad=[
 [insetX/width,insetY/height],[1-insetX/width,insetY/height],
 [1-insetX/width,1-insetY/height],[insetX/width,1-insetY/height],
].map(([u,v])=>quadPoint(outer,u,v));

export function prepareDisplayFrame(scene){
 const x=632,y=423,w=107,h=84,coverage=new Int16Array(w*h).fill(-1);
 const plate=scene.plate.data,head=scene.head,hair=head.canvas.getContext('2d').getImageData(0,0,head.w,head.h).data;
 const [ox,oy]=outer[0],ax=outer[1][0]-ox,ay=outer[1][1]-oy,bx=outer[3][0]-ox,by=outer[3][1]-oy,det=ax*by-ay*bx;
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){
  const wx=x+px,wy=y+py,dx=wx+.5-ox,dy=wy+.5-oy;
  const u=(dx*by-dy*bx)/det*width,v=(ax*dy-ay*dx)/det*height;
  if(u<0||v<0||u>=width||v>=height)continue;
  coverage[py*w+px]=0;
  // The original hair and face remain in front of the complete monitor plane.
  if(wx>=head.x&&wx<head.x+head.w&&wy>=head.y&&wy<head.y+head.h&&hair[((wy-head.y)*head.w+wx-head.x)*4+3])continue;
  // Leave a two-pixel safety margin under the crisp inset: a dark opening on
  // the coarser room grid must not stick out as a second stepped outline.
  // Deep inside, dark backing also prevents a white halo around the hair mask.
  const backing=u>=insetX+2&&u<width-insetX-2&&v>=insetY+2&&v<height-insetY-2;
  const color=backing?[7,21,30]:u<1||v<1?[255,250,237]:u>=width-1||v>=height-1?[177,197,210]:[238,243,242];
  const i=(wy*1536+wx)*4;for(let ch=0;ch<3;ch++)plate[i+ch]=color[ch];
 }
 return{x,y,w,h,coverage};
}

// The small CRT has a much gentler tilt than the previous face patch. Derive
// both face axes from the opening, preserving its icons, footer and housing.
export const faceFrame={outer:[[291,653],[356,647],[357,710],[292,716]],width:65,height:63};
export const faceContentQuad=[[17,7],[63,7],[63,44],[17,44]]
 .map(([x,y])=>quadPoint(faceFrame.outer,x/faceFrame.width,y/faceFrame.height));

export function prepareFaceDisplay(scene,emitter){
 const x=306,y=648,w=54,h=49,source=scene.original.data,plate=scene.plate.data;
 const lit=new Uint8Array(w*h),remove=new Uint8Array(w*h),blocked=new Uint8Array(w*h);
 // Remove only the old cyan face and its one-pixel color fringe. Dark glass
 // stays original, so a differently tilted opaque rectangle cannot reappear.
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){
  const wx=x+px,wy=y+py,n=py*w+px,i=(wy*1536+wx)*4;
  const inFace=inside(wx,wy,emitter.polygon),r=source[i],g=source[i+1],b=source[i+2];
  lit[n]=inFace&&g>45&&b>55&&g-r>25&&b-r>30?1:0;
  // Bright footer/side pixels cannot serve as glass-repair donors.
  blocked[n]=!inFace||Math.max(r,g,b)>75?1:0;
 }
 for(let py=1;py<h-1;py++)for(let px=1;px<w-1;px++){
  const n=py*w+px;if(!inside(x+px,y+py,emitter.polygon))continue;
  for(let dy=-1;dy<=1&&!remove[n];dy++)for(let dx=-1;dx<=1;dx++)if(lit[n+dy*w+dx]){remove[n]=1;break;}
  if(remove[n])blocked[n]=1;
 }
 const field=exteriorField(blocked,w,h);
 for(let n=0;n<remove.length;n++)if(remove[n]){
  const donor=reflectedSample(n,field,blocked,w,h);if(donor<0)continue;
  const i=((y+Math.floor(n/w))*1536+x+n%w)*4,j=((y+Math.floor(donor/w))*1536+x+donor%w)*4;
  for(let c=0;c<3;c++)plate[i+c]=source[j+c];
 }
 return{...emitter,box:[308,654,48,42],polygon:faceContentQuad,plane:{width:46,height:37},transparent:true};
}
