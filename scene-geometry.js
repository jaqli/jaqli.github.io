// A shared projective plane keeps screens, faces and their glyph axes aligned.
const matrices = new WeakMap();
export function quadPoint(quad, u, v) {
  let m = matrices.get(quad);
  if (!m) {
    const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = quad;
    const dx1=x1-x2, dx2=x3-x2, dx3=x0-x1+x2-x3;
    const dy1=y1-y2, dy2=y3-y2, dy3=y0-y1+y2-y3;
    const det=dx1*dy2-dx2*dy1;
    const g=(dx3*dy2-dx2*dy3)/det, h=(dx1*dy3-dx3*dy1)/det;
    m=[x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h];
    matrices.set(quad,m);
  }
  const w=m[6]*u+m[7]*v+1;
  return [(m[0]*u+m[1]*v+m[2])/w,(m[3]*u+m[4]*v+m[5])/w];
}
export function drawQuad(ctx, canvas, quad, width, height) {
  ctx.save();
  ctx.beginPath(); quad.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); ctx.clip();
  const rx=canvas.width/width, ry=canvas.height/height;
  for (let row=0;row<height;row+=2) {
    const h=Math.min(2.12,height-row), v=row/height;
    const left=quadPoint(quad,0,v), right=quadPoint(quad,1,v), next=quadPoint(quad,0,(row+h)/height);
    ctx.save();
    ctx.transform((right[0]-left[0])/width,(right[1]-left[1])/width,
      (next[0]-left[0])/h,(next[1]-left[1])/h,...left);
    ctx.drawImage(canvas,0,row*ry,width*rx,h*ry,0,0,width,h);
    ctx.restore();
  }
  ctx.restore();
}
