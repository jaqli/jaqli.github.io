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
      return preview.toDataURL('image/webp', .55).split(',')[1];
    });
    fs.writeFileSync(path.join(root, 'assets/scene-preview.webp'), Buffer.from(data, 'base64'));
    for (const name of ['scene.webp', 'scene-preview.webp']) {
      console.log(`${name}: ${(fs.statSync(path.join(root, 'assets', name)).size / 1024).toFixed(0)} KiB`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
