import { createCanvas } from './canvas-factory.js?v=20261110-fps10';
import { glyphColor } from './glyph-atlas.js?v=20261111-flow28';
import { glyphWeight } from './scene-style.js?v=20261111-flow28';

// All visible ASCII characters. Space is represented by the stable scene mask;
// control characters have no printable shape.
export const asciiCharacters=Array.from({length:94},(_,i)=>String.fromCharCode(i+33)).join('');
export const glyphRateMin=1.2;
export const glyphRateMax=1.5;
let pools,byCharacter;
const colorPools=new Map();
export function glyphPools(){
  if(pools)return pools;
  const canvas=createCanvas();canvas.width=canvas.height=40;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.font=`${glyphWeight} 24px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';
  const ranked=[...asciiCharacters].map(char=>{
    ctx.clearRect(0,0,40,40);ctx.fillText(char,20,20);
    const pixels=ctx.getImageData(0,0,40,40).data;let ink=0;
    for(let i=3;i<pixels.length;i+=4)ink+=pixels[i];
    return {char,ink};
  }).sort((a,b)=>a.ink-b.ink||a.char.charCodeAt(0)-b.char.charCodeAt(0));
  pools=[];byCharacter=new Map();
  for(let i=0;i<ranked.length;i+=12){
    const pool=ranked.slice(i,i+12).map(g=>g.char).join('');
    const index=pools.length;pools.push(pool);
    for(const char of pool)byCharacter.set(char,index);
  }
  canvas.width=canvas.height=1;
  return pools;
}
export function sceneGlyph(rgb,seed){
  const list=glyphPools(),light=(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255;
  const index=Math.max(0,Math.min(list.length-1,Math.floor((Math.sqrt(light)-.15)/.85*list.length)));
  const pool=colorPool(index,rgb);return pool[Math.min(pool.length-1,Math.floor(seed*pool.length))];
}
function colorPool(index,rgb){
  const key=index+':'+(rgb?glyphColor(rgb):'light');
  if(colorPools.has(key))return colorPools.get(key);
  let hash=2166136261;for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  const source=glyphPools()[index],offset=hash%source.length;
  const chars=Array.from({length:4},(_,i)=>source[(offset+Math.floor(i*source.length/4))%source.length]);
  for(let i=chars.length-1;i>0;i--){hash=Math.imul(hash^i,16777619)>>>0;const j=hash%(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}
  const pool=chars.join('');colorPools.set(key,pool);return pool;
}
const fraction=n=>n-Math.floor(n);
const coprime=(a,b)=>{while(b){const r=a%b;a=b;b=r;}return a===1;};
export function prepareGlyph(cell){
  const x=cell.sx??cell.x,y=cell.sy??cell.y;glyphPools();
  cell.glyphOffset=fraction(Math.sin(x*127.1+y*311.7+1729)*43758.5453);
  cell.glyphRate=glyphRateMin+(glyphRateMax-glyphRateMin)*fraction(Math.sin(x*39.7+y*97.3+91)*21413.173);
  cell.glyphPoolIndex=byCharacter.get(cell.glyph)??0;cell.glyphPool=cell.glyphPoolOverride||colorPool(cell.glyphPoolIndex,cell.rgb);
  cell.glyphStart=Math.max(0,cell.glyphPool.indexOf(cell.glyph));
  cell.glyph=cell.glyphPool[cell.glyphStart];
  let stride=1+Math.floor(fraction(Math.sin(x*17.3+y*51.9+811)*31991.7)*(cell.glyphPool.length-1));
  while(!coprime(stride,cell.glyphPool.length))stride=stride%cell.glyphPool.length+1;
  cell.glyphStride=stride;cell.glyphVariant=0;
}
export function glyphStep(cell,time){return Math.floor(Math.max(0,time)*cell.glyphRate+cell.glyphOffset);}
export function glyphVariant(cell,time){return glyphStep(cell,time)%cell.glyphPool.length;}
export function glyphAt(cell,variant=cell.glyphSource?.glyphVariant??cell.glyphVariant){
  return cell.glyphPool[(cell.glyphStart+variant*cell.glyphStride)%cell.glyphPool.length];
}
