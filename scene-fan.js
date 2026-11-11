import { inside } from './scene-objects.js?v=20261111-surface37';
import { exteriorField, reflectedSample } from './pixel-surface.js?v=20261111-surface37';
const TAU=Math.PI*2;
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
// The four layers are independent: stationary room behind the fan, three
// transparent metal blades, fixed wire cage, and the original central hub.
export class SceneFan {
  constructor(scene){
    this.x=1205;this.y=548;this.w=76;this.h=102;
    this.canvas=surface(76,102);this.ctx=this.canvas.getContext('2d');
    this.back=surface(76,102);this.cage=surface(76,102);this.blade=surface(88,88);
    const src=scene.original.data,back=this.back.getContext('2d').createImageData(76,102),cage=this.cage.getContext('2d').createImageData(76,102),mask=new Uint8Array(76*102);
    for(let y=0;y<102;y++)for(let x=0;x<76;x++){
      const gx=x+1205,gy=y+548,v=(gy-599)/40,u=(gx-1243+v*6)/31,radius=Math.hypot(u,v),i=(gy*1536+gx)*4,j=(y*76+x)*4;
      for(let c=0;c<3;c++)back.data[j+c]=src[i+c];back.data[j+3]=radius<1?255:0;
      const warm=src[i]>src[i+1]*1.13&&src[i+1]>100&&src[i+1]>src[i+2]*1.02;
      mask[y*76+x]=radius>.9||radius<.28||!warm?1:0;
      const wire=Math.abs(u)<.035||Math.abs(v)<.025||Math.abs(u-v)<.035||Math.abs(u+v)<.035;
      if(radius<.29||(radius>.92&&radius<1.07)||(radius<1&&wire)){
        for(let c=0;c<3;c++)cage.data[j+c]=src[i+c];cage.data[j+3]=255;
      }
    }
    const field=exteriorField(mask,76,102),copy=back.data.slice();
    for(let i=0;i<mask.length;i++)if(back.data[i*4+3]){
      const donor=mask[i]?reflectedSample(i,field,mask,76,102):i;
      for(let c=0;c<3;c++)back.data[i*4+c]=copy[donor*4+c]*.69;
    }
    this.back.getContext('2d').putImageData(back,0,0);this.cage.getContext('2d').putImageData(cage,0,0);
    const b=this.blade.getContext('2d'),blade=b.createImageData(88,88);
    const outline=[[40,44],[39,35],[40,17],[45,9],[54,7],[63,12],[69,20],[67,28],[58,33],[50,39],[48,47]];
    for(let y=7;y<48;y++)for(let x=38;x<70;x++)if(inside(x+.5,y+.5,outline)){
      const gx=Math.round(1243+(x-44)*31/40-(y-44)*6/40),gy=599+y-44,i=(gy*1536+gx)*4,j=(y*88+x)*4;
      // Source metal texture, with cage shadows excluded from the blade itself.
      const lum=(src[i]+src[i+1]+src[i+2])/3,grain=(lum-120)*.33;
      const edge=x>61||y<12,base=edge?[169,163,151]:[117,121,124];
      for(let c=0;c<3;c++)blade.data[j+c]=base[c]+grain;blade.data[j+3]=255;
    }
    b.putImageData(blade,0,0);
  }
  draw(ctx,time){
    const c=this.ctx;c.clearRect(0,0,76,102);c.drawImage(this.back,0,0);
    c.save();c.translate(38,51);c.transform(1,0,-6/40,1,0,0);c.scale(31/40,1);c.beginPath();c.arc(0,0,40,0,TAU);c.clip();
    for(let i=0;i<3;i++){c.save();c.rotate(time*3.4+i*TAU/3);c.drawImage(this.blade,-44,-44);c.restore();}
    c.restore();c.drawImage(this.cage,0,0);ctx.drawImage(this.canvas,1205,548);
  }
  dispose(){for(const c of[this.canvas,this.back,this.cage,this.blade])c.width=c.height=1;}
}
