import { drawSceneLayers } from './scene-snapshot.js?v=20261111-space21';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let navigating = false;
let overlay;
window.addEventListener('pageshow', () => {
  navigating = false;
  overlay?.remove();
  document.body.classList.remove('is-leaving');
});
document.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const href = link.getAttribute('href');
  if (!href || link.hasAttribute('download') || link.getAttribute('target')) return;
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || url.pathname === location.pathname || reducedMotion.matches) return;
  event.preventDefault();
  if (navigating) return;
  navigating = true;
  document.body.classList.add('is-leaving');
  overlay = document.createElement('div');
  overlay.className = 'page-transition';
  overlay.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  overlay.append(canvas);
  document.body.append(overlay);
  const ctx = canvas.getContext('2d');
  const snapshot = document.createElement('canvas');
  snapshot.width = innerWidth;
  snapshot.height = innerHeight;
  const snap = snapshot.getContext('2d');
  if (!ctx || !snap) { location.assign(url.href); return; }
  const candidate = document.querySelector(document.body.classList.contains('scene-ready') ? '#ascii-canvas' : '#scene-poster');
  const scene = candidate instanceof HTMLImageElement ? (candidate.complete && candidate.naturalWidth ? candidate : null) : candidate;
  if (scene) {
    const rect = scene.getBoundingClientRect();
    snap.drawImage(scene, rect.x, rect.y, rect.width, rect.height);
    if (document.body.classList.contains('scene-ready')) {
      drawSceneLayers(snap);
    }
  }
  const pixels = snap.getImageData(0, 0, snapshot.width, snapshot.height).data;
  const fragments = [];
  const spacing = Math.max(14, Math.sqrt(innerWidth * innerHeight / 2200));
  for (let y = 0; y < innerHeight; y += spacing) {
    for (let x = 0; x < innerWidth; x += spacing) {
      const i = (Math.floor(y) * snapshot.width + Math.floor(x)) * 4;
      fragments.push({ x, y, phase: Math.random() * 6.28, color: scene ? `rgb(${pixels[i]} ${pixels[i + 1]} ${pixels[i + 2]})` : '#76bdc1' });
    }
  }
  const start = performance.now();
  const label = link.dataset.transition || 'jaq/li';
  function animate(now) {
    const progress = Math.min(1, (now - start) / 520);
    ctx.fillStyle = '#080d13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1 - progress;
    ctx.drawImage(snapshot, 0, 0);
    ctx.font = '12px monospace';
    for (const fragment of fragments) {
      ctx.fillStyle = fragment.color;
      const spread = progress * progress * 210;
      ctx.fillText('01.:*+'[Math.floor(progress * 20 + fragment.phase) % 6], fragment.x + Math.cos(fragment.phase) * spread, fragment.y - spread * (1 + Math.sin(fragment.phase)));
    }
    ctx.globalAlpha = Math.min(1, progress * 3);
    ctx.fillStyle = '#c9edda';
    ctx.textAlign = 'center';
    ctx.fillText(`[ ${label} ]`, canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'start';
    ctx.globalAlpha = 1;
    if (progress < 1) requestAnimationFrame(animate);
    else location.assign(url.href);
  }
  requestAnimationFrame(animate);
});
