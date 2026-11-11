import { AsciiRenderer } from './ascii-renderer.js?v=20261111-flow18';
import { LayeredScene } from './layered-scene.js?v=20261111-flow18';
let renderer,display,layers,revision=0;
let queue=Promise.resolve();
self.onmessage=({data})=>{
  if(data.type==='cancel'){revision=data.revision;layers?.resetWater();return;}
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
    } else if(type==='attach') {
      display=data.canvas;layers=new LayeredScene(renderer,display);
      self.postMessage({id,done:true});
    } else if(type==='layers'){
      layers.attach(data.targets);self.postMessage({id,done:true});
    } else if (type==='resize') {
      self.devicePixelRatio=data.dpr;
      await renderer.resizeAsync(data.width,data.height,value=>self.postMessage({id,progress:value}));
      const specs=await layers.prepare();
      self.postMessage({id,done:true,flight:renderer.getFlightData(),layers:specs},specs.flatMap(s=>s.bitmap?[s.bitmap]:[]));
    } else if (type==='draw') {
      // Yield before presenting so a pause/resize can discard this frame.
      await new Promise(resolve=>setTimeout(resolve,0));
      const painted=data.revision===revision;
      const waterFrames=painted?layers.draw(data.time):[];
      self.postMessage({id,painted,time:data.time,waterFrames},waterFrames.map(frame=>frame.bitmap));
    }
  }).catch(error=>self.postMessage({id:data.id,error:error.message}));
};
