import { quadPoint } from './scene-geometry.js?v=20261110-fps10';

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
