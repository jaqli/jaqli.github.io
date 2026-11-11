// Keep scene glyphs crisp at small sizes. Lift middle tones and restore color
// separation without tinting whites or changing the image's hue families.
export const glyphWeight=700;
const tones=Float32Array.from({length:4097},(_,i)=>255*(i/4096)**.72);
const channel=value=>tones[Math.max(0,Math.min(4096,Math.round(value*4096/255)))];
export function sceneRGB(r,g,b,out=[0,0,0]){
  r=channel(r);g=channel(g);b=channel(b);
  const light=.2126*r+.7152*g+.0722*b,high=Math.max(r,g,b),low=Math.min(r,g,b);
  const saturation=Math.min(1.18,high>light?(255-light)/(high-light):1.18,light>low?light/(light-low):1.18);
  out[0]=Math.round(light+(r-light)*saturation);
  out[1]=Math.round(light+(g-light)*saturation);
  out[2]=Math.round(light+(b-light)*saturation);
  return out;
}
export const sceneColor=rgb=>`rgb(${sceneRGB(...rgb).join(' ')})`;
