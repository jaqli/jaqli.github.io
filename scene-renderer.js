import { scenePixelRatio } from './render-budget.js?v=20261111-mixed24';
import { SceneLayers } from './scene-layers.js?v=20261111-mixed24';
import { AsciiRenderer } from './ascii-renderer.js?v=20261111-mixed24';

class WorkerRenderer {
  constructor(worker,canvas) {
    this.worker=worker; this.canvas=canvas;this.layers=new SceneLayers(document.querySelector('#motion-layers'));
    this.requests=new Map(); this.nextId=0; this.revision=0;
    worker.onmessage=({data})=>{
      const pending=this.requests.get(data.id);
      if (!pending) { data.layers?.forEach(layer=>layer.bitmap?.close());data.waterFrames?.forEach(frame=>frame.bitmap.close()); return; }
      if ('progress' in data) { pending.progress?.(data.progress); return; }
      this.requests.delete(data.id);
      if (data.error) { pending.reject(new Error(data.error)); return; }
      if ('painted' in data){
        const current=data.painted && pending.revision===this.revision;
        if(current)this.layers.updateWater(data.waterFrames);else data.waterFrames?.forEach(frame=>frame.bitmap.close());
        pending.resolve(current);
      }
      else pending.resolve(data);
    };
    worker.onerror=error=>{
      this.error=new Error(error.message);
      for (const pending of this.requests.values()) pending.reject(this.error);
      this.requests.clear();
    };
  }
  request(type,data={},transfer=[],progress) {
    if (this.error) return Promise.reject(this.error);
    const id=++this.nextId;
    return new Promise((resolve,reject)=>{
      this.requests.set(id,{resolve,reject,progress,revision:this.revision});
      this.worker.postMessage({id,type,revision:this.revision,...data},transfer);
    });
  }
  async resizeAsync(width,height,progress) {
    this.cancelFrame();
    const dpr=scenePixelRatio(width,height);
    const result=await this.request('resize',{width,height,dpr:devicePixelRatio||1},[],progress);
    this.flightData=result.flight;this.canvas.dataset.raster=result.raster;
    const targets=this.layers.configure(result.layers,width/1536);
    await this.request('layers',{targets},targets.map(target=>target.canvas));
    this.width=width; this.height=height; this.pixelRatio=dpr;
  }
  animate(time){this.layers.draw(time);}
  getFlightData() { return this.flightData; }
  draw(time) { return this.request('draw',{time}); }
  cancelFrame() { this.revision++; this.worker.postMessage({type:'cancel',revision:this.revision}); }
  dispose() { this.worker.terminate(); }
}

// Start loading the worker/modules while the compressed scene downloads.
export function prepareSceneRenderer(canvas){
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap!=='function'||typeof canvas.transferControlToOffscreen!=='function')return null;
  try{return new WorkerRenderer(new Worker(new URL('./scene-worker.js?v=20261111-mixed24',import.meta.url),{type:'module'}),canvas);}catch{return null;}
}

export async function createSceneRenderer(image,canvas,onProgress,prepared=prepareSceneRenderer(canvas)) {
  if (prepared) {
    const renderer=prepared;
    try {
      const bitmap=await createImageBitmap(image);
      await renderer.request('init',{image:bitmap,dpr:Math.min(devicePixelRatio||1,2)},[bitmap],onProgress);
      const display=canvas.transferControlToOffscreen();
      renderer.transferred=true;
      await renderer.request('attach',{canvas:display},[display]);
      canvas.dataset.renderer='worker';
      return renderer;
    } catch {
      renderer?.dispose();
      document.querySelector('#motion-layers')?.replaceChildren();
      if(renderer?.transferred){const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;}
    }
  }
  canvas.dataset.renderer='main';canvas.dataset.raster='2d';
  const renderer=await AsciiRenderer.create(image,canvas,onProgress);
  renderer.separateFlight=true;
  return renderer;
}
