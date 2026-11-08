// Sprite atlas loading. Everything is optional: missing art falls back to procedural placeholders.
// assets/sprites/index.json is produced by tools/build_sprites.py.
export const Sprites = {
  ready: false,
  forms: {},      // formId -> { img, anims: { walk: [[x,y,w,h]...], attack: [...] }, h }
  grids: {},      // 'monsters' | 'bosses' | 'items' -> { img, cells: [[x,y,w,h]...] }
  bg: {},         // biomeId -> { far: img, near: img }
};

function loadImg(src) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

export async function loadSprites(base = 'assets/sprites/') {
  let idx;
  try {
    const r = await fetch(base + 'index.json', { cache: 'no-cache' });
    if (!r.ok) throw 0;
    idx = await r.json();
  } catch { Sprites.ready = true; return Sprites; }
  const jobs = [];
  for (const [id, f] of Object.entries(idx.forms || {})) {
    jobs.push(loadImg(base + f.src).then(img => { if (img) Sprites.forms[id] = { ...f, img }; }));
  }
  for (const [id, g] of Object.entries(idx.grids || {})) {
    jobs.push(loadImg(base + g.src).then(img => { if (img) Sprites.grids[id] = { ...g, img }; }));
  }
  for (const [id, b] of Object.entries(idx.bg || {})) {
    Sprites.bg[id] = {};
    for (const layer of ['far', 'near']) {
      if (b[layer]) jobs.push(loadImg(base + b[layer]).then(img => { if (img) Sprites.bg[id][layer] = img; }));
    }
  }
  await Promise.all(jobs);
  Sprites.ready = true;
  return Sprites;
}

// Item icon as a data URL-able canvas, cached.
const iconCache = new Map();
export function itemIconCanvas(cell, size = 32) {
  const key = cell + ':' + size;
  if (iconCache.has(key)) return iconCache.get(key);
  const g = Sprites.grids.items;
  if (!g || !g.cells[cell]) return null;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const [sx, sy, sw, sh] = g.cells[cell];
  const k = Math.min(size / sw, size / sh);
  x.drawImage(g.img, sx, sy, sw, sh, (size - sw * k) / 2, (size - sh * k) / 2, sw * k, sh * k);
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
