import { AsciiRenderer } from './ascii-renderer.js?v=20261110-flight11';
let renderer;
let queue=Promise.resolve();
self.onmessage=({data})=>{
  // Initialization/resizing yield to the worker event loop. Serialize messages
  // so a newer draw cannot observe partially rebuilt caches.
  queue=queue.then(async()=>{
    const {id,type}=data;
    if (type==='init') {
      self.devicePixelRatio=data.dpr;
      renderer=await AsciiRenderer.create(data.image,new OffscreenCanvas(1,1),value=>self.postMessage({id,progress:value}));
      renderer.separateFlight=true;
      data.image.close();
      self.postMessage({id,done:true});
    } else if (type==='resize') {
      self.devicePixelRatio=data.dpr;
      await renderer.resizeAsync(data.width,data.height,value=>self.postMessage({id,progress:value}));
      self.postMessage({id,done:true,flight:renderer.getFlightData()});
    } else if (type==='draw') {
      renderer.draw(data.time);
      const bitmap=renderer.canvas.transferToImageBitmap();
      self.postMessage({id,bitmap,time:data.time},[bitmap]);
    }
  }).catch(error=>self.postMessage({id:data.id,error:error.message}));
};
