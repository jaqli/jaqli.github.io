// Remove the original cyan sky from the outside of each feather silhouette.
// Flood from transparency so enclosed dark feather details remain untouched.
export function cleanBirdMatte(sprite){
 const {canvas,w,h}=sprite,ctx=canvas.getContext('2d'),image=ctx.getImageData(0,0,w,h),p=image.data;
 const outside=new Uint8Array(w*h),queue=[];
 const visit=n=>{
  if(n<0||n>=outside.length||outside[n])return;
  const i=n*4,r=p[i],g=p[i+1],b=p[i+2];
  if(!p[i+3]||(g>85&&g-r>12&&b-r>12)){outside[n]=1;queue.push(n);}
 };
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}
 for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
 for(let q=0;q<queue.length;q++){
  const n=queue[q];if(n%w)visit(n-1);if(n%w<w-1)visit(n+1);visit(n-w);visit(n+w);
 }
 for(let n=0;n<outside.length;n++)if(outside[n])p[n*4+3]=0;
 ctx.putImageData(image,0,0);
}
