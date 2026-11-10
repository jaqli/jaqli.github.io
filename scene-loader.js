export async function loadSceneImage(image, url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Scene source: HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length'));
  let blob;
  if (response.body) {
    const reader = response.body.getReader(), chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); received += value.byteLength;
      onProgress(total > 0 ? Math.min(1, received / total) : null);
    }
    blob = new Blob(chunks, { type: 'image/webp' });
  } else blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);
  try { image.src = objectURL; await image.decode(); }
  finally { URL.revokeObjectURL(objectURL); }
  onProgress(1);
}
