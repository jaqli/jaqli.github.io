// Run with the local static server active. The original PNG is retained.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:8081';

(async () => {
  if (!process.argv.includes('--preview-only')) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i',
    path.join(root, 'assets/IMG_1183.PNG'), '-c:v', 'libwebp', '-quality', '86',
    '-compression_level', '6', path.join(root, 'assets/scene.webp')]);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.goto(`${origin}/assets/scene.webp`);
    const data = await page.evaluate(async () => {
      const image = document.querySelector('img');
      await image.decode();
      const { AsciiRenderer } = await import('/ascii-renderer.js');
      const canvas = document.createElement('canvas');
      const renderer = await AsciiRenderer.create(image, canvas);
      await renderer.resizeAsync(1536, 1024);
      renderer.draw(0);
      const preview = document.createElement('canvas');
      preview.width = 960; preview.height = 640;
      preview.getContext('2d').drawImage(canvas, 0, 0, preview.width, preview.height);
      // The inpainted plate has no stationary copies of flying/floating items.
      // A small, blurred color field lifts gaps without showing photo detail.
      const plate=document.createElement('canvas');
      plate.width=renderer.sourceW;plate.height=renderer.sourceH;
      plate.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(renderer.platePixels),plate.width,plate.height),0,0);
      const ambience=document.createElement('canvas');ambience.width=384;ambience.height=256;
      const ambient=ambience.getContext('2d');
      ambient.filter='blur(1.2px)';
      ambient.drawImage(plate,0,0,384,256);ambient.filter='none';
      const pixels=ambient.getImageData(0,0,384,256);
      for(let i=0;i<pixels.data.length;i+=4){
        const light=(.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2])/255;
        const t=Math.max(0,Math.min(1,(light-.16)/.68));
        const gain=.32*t*t*(3-2*t);
        for(let c=0;c<3;c++)pixels.data[i+c]*=gain;
        pixels.data[i+3]=255;
      }
      ambient.putImageData(pixels,0,0);
      return {preview:preview.toDataURL('image/webp',.55).split(',')[1],
        ambience:ambience.toDataURL('image/webp',.8).split(',')[1]};
    });
    for(const [name,base64]of Object.entries(data))fs.writeFileSync(path.join(root,`assets/scene-${name}.webp`),Buffer.from(base64,'base64'));
    for (const name of ['scene.webp', 'scene-preview.webp', 'scene-ambience.webp']) {
      console.log(`${name}: ${(fs.statSync(path.join(root, 'assets', name)).size / 1024).toFixed(0)} KiB`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
