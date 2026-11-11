// Source-image coordinates. The four original origins now emit every 1.5 s
// (previously 7.5 s); smaller disturbances add different scales and rhythms.
export const rippleSources = [
  {x:1150,y:570,period:1.5,phase:0,life:6.5,speed:23,aspect:[1.7,2.2],width:10,strength:.9},
  {x:960,y:735,period:1.5,phase:.42,life:6.2,speed:25,aspect:[1.9,2.1],width:11,strength:.85},
  {x:465,y:866,period:1.5,phase:.91,life:5.8,speed:24,aspect:[1.65,2.2],width:9,strength:.85},
  {x:352,y:863,period:1.5,phase:1.21,life:4.8,speed:22,aspect:[1.45,2.1],width:8,strength:.95},
  {x:1194,y:538,period:3.1,phase:.72,life:3.8,speed:24,aspect:[2.2,2.6],width:7,strength:.8},
  {x:1080,y:621,period:3.7,phase:1.64,life:4.2,speed:23,aspect:[1.65,2.4],width:8,strength:.8},
  {x:838,y:812,period:2.8,phase:2.05,life:3.7,speed:27,aspect:[1.5,2],width:7,strength:.8},
  {x:1112,y:966,period:3.4,phase:2.61,life:4.4,speed:26,aspect:[1.8,2.3],width:9,strength:.85},
];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const random=(cycle,seed)=>{const n=Math.sin(cycle*127.1+seed*311.7+83)*43758.5453;return n-Math.floor(n);};
const band=(distance,width)=>smooth(1-Math.abs(distance)/width);

// Accumulate overlapping ripples into tiny 1D radial fields once per sampled
// water frame. Each letter only interpolates nearby fields, avoiding a loop
// over every active wave per letter. Buffers are reused for the scene lifetime.
export class RippleField {
  constructor(){
    this.fields=rippleSources.map(source=>new Float32Array(Math.ceil(source.life*source.speed*1.1+source.width*1.2)+2));
  }
  at(x,y){
    const samples=[];
    for(let i=0;i<rippleSources.length;i++){
      const source=rippleSources[i],dx=(x-source.x)/source.aspect[0],dy=(y-source.y)*source.aspect[1];
      const distance=Math.hypot(dx,dy),index=Math.floor(distance),values=this.fields[i];
      if(index+1>=values.length)continue;
      const angle=Math.atan2(dy,dx);
      samples.push({values,index,mix:distance-index,gain:.78+.22*Math.sin(angle*3+i*.7)**2});
    }
    return samples;
  }
  update(time){
    for(let i=0;i<rippleSources.length;i++){
      const source=rippleSources[i],values=this.fields[i],clock=time+source.phase;
      const latest=Math.floor(clock/source.period),count=Math.ceil(source.life/source.period);
      values.fill(0);
      for(let n=0;n<count;n++){
        const cycle=latest-n,age=clock-cycle*source.period;
        if(age<0||age>=source.life)continue;
        const variation=random(cycle,i),width=source.width*(.88+.24*variation);
        const radius=age*source.speed*(.92+.16*random(cycle,i+11));
        // Smooth starts/ends prevent a flash when a new ring is emitted or an
        // older one expires. Slight per-emission variation breaks repetition.
        const strength=source.strength*(.8+.35*variation)*smooth(age/.55)*(1-smooth((age/source.life-.48)/.52));
        const begin=Math.max(0,Math.floor(radius-width*3.5)),end=Math.min(values.length-1,Math.ceil(radius+width));
        for(let distance=begin;distance<=end;distance++){
          const edge=distance-radius;
          values[distance]+=(band(edge,width)+.35*band(edge+width*2.6,width*.9)-.6*band(edge+width*1.3,width))*strength;
        }
      }
    }
  }
}
