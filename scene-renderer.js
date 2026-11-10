import { AsciiRenderer } from './ascii-renderer.js?v=20261110-fps10';

class WorkerRenderer {
  constructor(worker,canvas) {
    this.worker=worker; this.canvas=canvas; this.ctx=canvas.getContext('2d',{alpha:false});
    this.requests=new Map(); this.nextId=0; this.revision=0;
    worker.onmessage=({data})=>{
      const pending=this.requests.get(data.id);
      if (!pending) { data.bitmap?.close(); return; }
      if ('progress' in data) { pending.progress?.(data.progress); return; }
      this.requests.delete(data.id);
      if (data.error) { pending.reject(new Error(data.error)); return; }
      if (data.bitmap) {
        const current=pending.revision===this.revision;
        if (current) this.ctx.drawImage(data.bitmap,0,0);
        data.bitmap.close(); pending.resolve(current);
      } else pending.resolve();
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
      this.worker.postMessage({id,type,...data},transfer);
    });
  }
  async resizeAsync(width,height,progress) {
    this.cancelFrame();
    const dpr=Math.min(devicePixelRatio||1,2);
    await this.request('resize',{width,height,dpr},[],progress);
    this.width=width; this.height=height; this.pixelRatio=dpr;
    this.canvas.width=Math.round(width*dpr); this.canvas.height=Math.round(height*dpr);
  }
  draw(time) { return this.request('draw',{time}); }
  cancelFrame() { this.revision++; }
  dispose() { this.worker.terminate(); }
}

export async function createSceneRenderer(image,canvas,onProgress) {
  if (typeof Worker!=='undefined' && typeof OffscreenCanvas!=='undefined' && typeof createImageBitmap==='function') {
    let renderer;
    try {
      const worker=new Worker(new URL('./scene-worker.js?v=20261110-fps10',import.meta.url),{type:'module'});
      renderer=new WorkerRenderer(worker,canvas);
      const bitmap=await createImageBitmap(image);
      await renderer.request('init',{image:bitmap,dpr:Math.min(devicePixelRatio||1,2)},[bitmap],onProgress);
      canvas.dataset.renderer='worker';
      return renderer;
    } catch {
      renderer?.dispose();
    }
  }
  canvas.dataset.renderer='main';
  return AsciiRenderer.create(image,canvas,onProgress);
}
