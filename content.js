import './navigation.js';

// Content is a reviewed local snapshot. No browser tokens or third-party scripts.
const root = document.querySelector('#content');
const section = document.body.dataset.section;
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function safeURL(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const url = new URL(value, location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function externalLink(label, href) {
  const a = el('a', label, 'source-link');
  const url = safeURL(href);
  if (url) a.href = url;
  a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}
function renderBlock(block) {
  const tags = { paragraph: 'p', heading: 'h2', subheading: 'h3', quote: 'blockquote', code: 'pre' };
  if (tags[block.type]) {
    const node = el(tags[block.type], block.text || '');
    if (Array.isArray(block.runs) && block.type !== 'code') {
      node.replaceChildren();
      for (const run of block.runs) {
        const url = safeURL(run.url);
        if (url) { const a = el('a', run.text || ''); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); }
        else node.append(document.createTextNode(run.text || ''));
      }
    }
    if (block.type === 'code') { const code = el('code', block.text || ''); node.replaceChildren(code); }
    return node;
  }
  if (block.type === 'list') { const list = el(block.ordered ? 'ol' : 'ul'); for (const item of block.items || []) list.append(el('li', item)); return list; }
  if (block.type === 'divider') return el('hr', null, 'doc-divider');
  if (block.type === 'link') return externalLink(block.text || '原文 ↗', block.url);
  if (block.type === 'image' && safeURL(block.url)) {
    const figure = el('figure');
    const img = el('img'); img.src = safeURL(block.url); img.alt = block.alt || ''; img.loading = 'lazy';
    figure.append(img);
    if (block.caption) figure.append(el('figcaption', block.caption));
    return figure;
  }
  return el('p', block.text || '');
}
function renderPosts(data) {
  const posts = data.notion.posts.filter(post => post.category === section).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!posts.length) return;
  root.replaceChildren();
  for (const post of posts) {
    const card = el('a', null, 'article-card');
    card.href = `../post/?id=${encodeURIComponent(post.id)}`;
    card.dataset.transition = section.toUpperCase();
    card.append(el('span', post.date || '', 'article-date'));
    const text = el('div'); text.append(el('h2', post.title), el('p', post.summary || '')); card.append(text, el('span', '↗', 'article-arrow'));
    root.append(card);
  }
}
function renderPost(data) {
  const id = new URLSearchParams(location.search).get('id');
  const post = data.notion.posts.find(item => item.id === id);
  if (!post) { document.querySelector('#post-title').textContent = 'Not found.'; root.replaceChildren(el('p', '这篇文章尚未收录。请返回文章列表。')); return; }
  document.title = `${post.title} — jaq/li`;
  document.querySelector('#post-title').textContent = post.title;
  document.querySelector('#post-meta').textContent = `${post.category.toUpperCase()} / ${post.date || 'NOTES'}`;
  document.querySelector('#post-back').href = `../${post.category === 'life' ? 'life' : 'tech'}/`;
  root.replaceChildren(...(post.blocks || []).map(renderBlock));
  if (post.source) root.append(externalLink('在 Notion 阅读原文 ↗', post.source));
}

try {
  const response = await fetch(new URL('./content/site.json?v=20261111-about29', import.meta.url));
  if (!response.ok) throw new Error('Content unavailable');
  const data = await response.json();
  if (section === 'cv') {
    const { renderProfile } = await import('./profile.js?v=20261111-about29');
    renderProfile(data.profile);
  }
  else if (section === 'post') renderPost(data);
  else renderPosts(data);
} catch {
  // Source links in the static HTML remain usable if the snapshot cannot load.
  if (section === 'post') root.replaceChildren(el('p', '文章暂时无法载入，请稍后再试。'));
}
