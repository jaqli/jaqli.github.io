// Bound backing-store area on high-DPI/large screens without changing the
// sampling grid, font-size bins, source coordinates or motion speed.
export function scenePixelRatio(width,height){
  return Math.min(globalThis.devicePixelRatio||1,1.5,Math.sqrt(2400000/(width*height)));
}
export const sceneFrameInterval=1000/60;

// Water glyphs stay fixed; interpolate their brightness between bounded samples.
export const waterSampleInterval=1/12;
