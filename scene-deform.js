// Small connected sprites use inverse sampling, never moving strips. Cached
// premultiplied colors preserve the silhouette through subpixel deformation.
export function prepareWarp(sprite,field,padding=5){
  const{canvas,w,h}=sprite,ctx=canvas.getContext('2d'),image=ctx.getImageData(0,0,w,h);
  const source=new Float32Array(image.data.length),wx=new Float32Array(w*h),wy=new Float32Array(w*h),active=[];
  for(let i=0;i<w*h;i++){const a=image.data[i*4+3]/255;for(let c=0;c<3;c++)source[i*4+c]=image.data[i*4+c]*a;source[i*4+3]=a;}
  // Constant-time occupancy queries keep larger motion margins cheap to
  // prepare. The prefix table is temporary; the animated footprint is exact.
  const stride=w+1,occupied=new Uint32Array(stride*(h+1));
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=image.data[(y*w+x)*4+3]?1:0;occupied[(y+1)*stride+x+1]=occupied[y*stride+x+1]+row;}}
  for(let y=padding;y<h-padding;y++)for(let x=padding;x<w-padding;x++){
    const left=x-padding,right=x+padding+1,top=(y-padding)*stride,bottom=(y+padding+1)*stride;
    if(!(occupied[bottom+right]-occupied[top+right]-occupied[bottom+left]+occupied[top+left]))continue;
    const i=y*w+x,[fx,fy]=field(sprite.x+x,sprite.y+y);wx[i]=fx;wy[i]=fy;
    active.push(i);
  }
  return{...sprite,ctx,source,wx,wy,active:new Int32Array(active),output:ctx.createImageData(w,h)};
}
export function refreshWarp(warp,pixels){
  for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3]/255;for(let c=0;c<3;c++)warp.source[i+c]=pixels[i+c]*a;warp.source[i+3]=a;}
}
export function drawWarp(ctx,s,dx,dy){
  const{w,source,wx,wy,active,output}=s,out=output.data;
  for(let n=0;n<active.length;n++){
    const i=active[n],x=i%w-dx*wx[i],y=Math.floor(i/w)-dy*wy[i],ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,j=(iy*w+ix)*4,k=i*4;
    const a=(1-u)*(1-v),b=u*(1-v),c=(1-u)*v,d=u*v;
    const alpha=source[j+3]*a+source[j+7]*b+source[j+w*4+3]*c+source[j+w*4+7]*d;
    out[k+3]=alpha*255;
    if(alpha>.001)for(let ch=0;ch<3;ch++)out[k+ch]=(source[j+ch]*a+source[j+4+ch]*b+source[j+w*4+ch]*c+source[j+w*4+4+ch]*d)/alpha;
  }
  s.ctx.putImageData(output,0,0);ctx.drawImage(s.canvas,s.x,s.y);
}
