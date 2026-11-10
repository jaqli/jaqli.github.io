// Preserve the pre-optimization raster density. Tiny colored glyphs cannot
// tolerate a low-resolution backing store stretched over a Retina display.
// Save work through local updates and bounded caches, not image downscaling.
export function scenePixelRatio(){
  return Math.min(globalThis.devicePixelRatio||1,2);
}
export const sceneFrameInterval=1000/60;

// Water glyphs stay fixed; interpolate their brightness between bounded samples.
export const waterSampleInterval=1/12;
