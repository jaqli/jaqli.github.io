import { site } from './site.config.js';

const canvas = document.querySelector('#ascii-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const sampleCanvas = document.createElement('canvas');
const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
const artwork = document.querySelector('#artwork');
const density = document.querySelector('#density');
const pauseButton = document.querySelector('#pause');
const imageInput = document.querySelector('#image-input');
const status = document.querySelector('#status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const glyphs = ' .,:;i!+*?%$#@';
const background = '#090b0c';

let source = site.image ? null : makeStudy();
let cells = [];
let width = 0;
let height = 0;
let cellWidth = 0;
let cellHeight = 0;
let paused = reducedMotion.matches;
let frameId = null;
let lastFrame = 0;
let time = 0;
let imageRequest = 0;
let toastTimer;
const pointer = { x: -10000, y: -10000 };

// Fallback artwork for an unset or unavailable image.
function makeStudy() {
  const study = document.createElement('canvas');
  study.width = 780;
  study.height = 720;
  const studyCtx = study.getContext('2d');
  const pixels = studyCtx.createImageData(study.width, study.height);
  const palette = [[85, 197, 223], [188, 206, 133], [247, 168, 109], [212, 118, 150], [99, 117, 212], [85, 197, 223]];
  for (let y = 0; y < study.height; y++) {
    for (let x = 0; x < study.width; x++) {
      const nx = (x / study.width - .5) * 2;
      const ny = (y / study.height - .5) * 2;
      const angle = Math.atan2(ny, nx);
      const radius = Math.hypot(nx * 1.05, ny * 1.12);
      const center = .55 + .065 * Math.sin(angle * 3 + .7);
      const band = (radius - center) / .17;
      const light = Math.exp(-band * band * 1.7);
      const rib = .64 + .36 * Math.pow(.5 + .5 * Math.sin(radius * 100 + angle * 4), 2);
      const brightness = light * rib;
      const position = ((angle / (2 * Math.PI) + 1.65) % 1) * (palette.length - 1);
      const index = Math.floor(position);
      const mix = position - index;
      const offset = (y * study.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels.data[offset + channel] = (palette[index][channel] * (1 - mix) + palette[index + 1][channel] * mix) * brightness;
      }
      pixels.data[offset + 3] = 255;
    }
  }
  studyCtx.putImageData(pixels, 0, 0);
  return study;
}

function sample() {
  const bounds = artwork.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!source) {
    cells = [];
    draw();
    return;
  }
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight) * .98;
  const imageWidth = sourceWidth * scale;
  const imageHeight = sourceHeight * scale;
  // Spend the character budget on the image, not the surrounding letterbox.
  const columns = Math.max(40, Math.round(Number(density.value) * Math.min(1, Math.max(.5, imageWidth / 800))));
  cellWidth = imageWidth / columns;
  const rows = Math.max(1, Math.round(imageHeight / (cellWidth / .6)));
  cellHeight = imageHeight / rows;
  const offsetX = (width - imageWidth) / 2;
  const offsetY = (height - imageHeight) / 2;
  sampleCanvas.width = columns;
  sampleCanvas.height = rows;
  sampleCtx.clearRect(0, 0, columns, rows);
  sampleCtx.drawImage(source, 0, 0, columns, rows);
  const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;
  cells = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const i = (row * columns + column) * 4;
      const alpha = pixels[i + 3] / 255;
      const r = pixels[i] * alpha;
      const g = pixels[i + 1] * alpha;
      const b = pixels[i + 2] * alpha;
      const luminance = (.2126 * r + .7152 * g + .0722 * b) / 255;
      if (luminance < .018 || alpha < .05) continue;
      cells.push({
        x: offsetX + (column + .5) * cellWidth,
        y: offsetY + (row + .5) * cellHeight,
        glyph: Math.max(1, Math.round(Math.sqrt(luminance) * (glyphs.length - 1))),
        phase: column * .23 + row * .17,
        // Lift shadows slightly to compensate for the space between glyphs.
        color: `rgb(${[r, g, b].map(value => Math.round(255 * (value / 255) ** .82)).join(' ')})`,
      });
    }
  }
  draw();
}

function draw() {
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${Math.max(3, cellHeight * .95)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const cell of cells) {
    const wave = Math.sin(time * .7 + cell.phase);
    const distance = Math.hypot(cell.x - pointer.x, cell.y - pointer.y);
    const interaction = paused ? 0 : Math.max(0, 1 - distance / 120);
    const shift = Math.round(Math.sin(time * 1.15 + cell.phase) * .85);
    const glyph = glyphs[Math.max(1, Math.min(glyphs.length - 1, cell.glyph + shift + Math.round(interaction * 2)))];
    ctx.fillStyle = cell.color;
    ctx.fillText(glyph, cell.x, cell.y + wave * cellHeight * .09 + interaction * Math.sin(time * 4 - distance * .04) * 3);
  }
}

function tick(now) {
  frameId = null;
  if (paused || document.hidden) return;
  if (!lastFrame) lastFrame = now;
  const delta = now - lastFrame;
  if (delta >= 1000 / 24) {
    time += Math.min(delta, 100) / 1000;
    lastFrame = now;
    draw();
  }
  frameId = requestAnimationFrame(tick);
}

function syncAnimation() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  lastFrame = 0;
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? '播放动效' : '暂停动效');
  document.querySelector('#play-icon').textContent = paused ? '▷' : 'Ⅱ';
  document.querySelector('#play-label').textContent = paused ? '播放' : '暂停';
  if (!paused && !document.hidden) frameId = requestAnimationFrame(tick);
}

function notify(message) {
  clearTimeout(toastTimer);
  status.textContent = message;
  status.hidden = false;
  toastTimer = setTimeout(() => { status.hidden = true; }, 6000);
}

async function setImage(url, description) {
  const request = ++imageRequest;
  const image = new Image();
  image.src = url;
  await image.decode();
  if (request !== imageRequest) return false;
  source = image;
  canvas.setAttribute('aria-label', description);
  document.querySelector('#art-label').textContent = 'PHOTO STUDY / 001';
  sample();
  return true;
}

async function loadFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp|avif|gif)$/.test(file.type)) {
    notify('请选择 PNG、JPG、WEBP、AVIF 或 GIF 图片。');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    notify('图片太大了，请选择 20 MB 以内的照片。');
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    if (await setImage(url, '由所选照片转换而成的动态彩色 ASCII 字符画')) {
      notify('照片已转成字符画，仅在本次浏览中使用。');
    }
  } catch {
    notify('这张图片无法读取，请尝试其他图片。');
  } finally {
    URL.revokeObjectURL(url);
  }
}

pauseButton.addEventListener('click', () => { paused = !paused; syncAnimation(); });
density.addEventListener('input', sample);
document.querySelector('#choose-image').addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  imageInput.value = '';
  void loadFile(file);
});
artwork.addEventListener('pointermove', (event) => {
  const bounds = artwork.getBoundingClientRect();
  pointer.x = event.clientX - bounds.left;
  pointer.y = event.clientY - bounds.top;
});
artwork.addEventListener('pointerleave', () => { pointer.x = pointer.y = -10000; });
reducedMotion.addEventListener('change', (event) => { paused = event.matches; syncAnimation(); });
document.addEventListener('visibilitychange', syncAnimation);

let dragDepth = 0;
document.addEventListener('dragenter', (event) => {
  if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  dragDepth++;
  document.body.classList.add('is-dragging');
});
document.addEventListener('dragover', (event) => {
  if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault();
});
document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) document.body.classList.remove('is-dragging');
});
document.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('is-dragging');
  void loadFile(event.dataTransfer?.files[0]);
});

new ResizeObserver(sample).observe(artwork);
sample();
syncAnimation();
if (site.image) {
  setImage(site.image, site.imageAlt).catch(() => {
    // Keep a newer local selection if it completed before the default failed.
    if (imageRequest !== 1) return;
    source = makeStudy();
    document.querySelector('#art-label').textContent = 'GENERATIVE STUDY / 001';
    canvas.setAttribute('aria-label', '由彩色字符组成的流动光环');
    sample();
    notify('首页照片暂时无法读取，正在展示生成图案。');
  });
} else {
  document.querySelector('#art-label').textContent = 'GENERATIVE STUDY / 001';
  canvas.setAttribute('aria-label', '由彩色字符组成的流动光环');
}
