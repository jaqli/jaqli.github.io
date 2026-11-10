// The renderer runs in a worker when available, with the same Canvas2D fallback.
export const createCanvas = () => typeof document==='undefined' ? new OffscreenCanvas(1,1) : document.createElement('canvas');
