const random=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+431)*43758.5453;return n-Math.floor(n);};
const clamp=(n,limit)=>Math.max(.1,Math.min(limit-.1,n));

// The sampling grid sets a bounded point budget, not the displayed positions.
// Release points across its boundaries, then reserve space proportional to
// each glyph's footprint. This runs only when preparing a new scene size.
export function* glyphLayout({columns,rows,width,height,fontSize,sizeAt,fixedAt}){
  const dx=width/columns,dy=height/rows,points=[];
  for(let row=0;row<rows;row++){
    for(let col=0;col<columns;col++){
      const x=(col+.5)*dx,y=(row+.5)*dy,fixed=fixedAt(x,y),size=fixed ? .6 : sizeAt(col,row);
      points.push({x:fixed?x:clamp(x+(random(col,row)-.5)*dx*1.4,width),
        y:fixed?y:clamp(y+(random(row+83,col+197)-.5)*dy*1.4,height),size,
        rx:fontSize*.32*size+.6,ry:fontSize*.46*size+.7,mobility:fixed?0:1/size});
    }
    if(!(row%16))yield .1*row/rows;
  }
  const bucketW=fontSize*.32*3+1.2,bucketH=fontSize*.46*3+1.4;
  const cols=Math.ceil(width/bucketW),lines=Math.ceil(height/bucketH);
  const heads=new Int32Array(cols*lines),next=new Int32Array(points.length);
  for(let pass=0;pass<8;pass++){
    heads.fill(-1);
    for(let i=0;i<points.length;i++){
      const p=points[i],bucket=Math.floor(p.y/bucketH)*cols+Math.floor(p.x/bucketW);
      next[i]=heads[bucket];heads[bucket]=i;
    }
    for(let i=0;i<points.length;i++){
      const a=points[i],col=Math.floor(a.x/bucketW),row=Math.floor(a.y/bucketH);
      for(let y=Math.max(0,row-1);y<=Math.min(lines-1,row+1);y++)for(let x=Math.max(0,col-1);x<=Math.min(cols-1,col+1);x++){
        for(let j=heads[y*cols+x];j!==-1;j=next[j]){
          if(j<=i)continue;
          const b=points[j],mobility=a.mobility+b.mobility;if(!mobility)continue;
          const vx=b.x-a.x,vy=b.y-a.y,rx=a.rx+b.rx,ry=a.ry+b.ry;
          const distance2=(vx/rx)**2+(vy/ry)**2;
          if(distance2>=1||distance2<1e-12)continue;
          const push=(1/Math.sqrt(distance2)-1)*.65,share=a.mobility/mobility;
          a.x=clamp(a.x-vx*push*share,width);a.y=clamp(a.y-vy*push*share,height);
          b.x=clamp(b.x+vx*push*(1-share),width);b.y=clamp(b.y+vy*push*(1-share),height);
        }
      }
    }
    yield .1+.9*(pass+1)/8;
  }
  return points;
}
