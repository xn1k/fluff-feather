// Canvas renderer: parallax world, critters, monsters, effects.
import { FORMS, ANIMALS, ARCH, BIOMES, RARITIES } from './data.js';
import { Sprites } from './sprites.js';
import { biome, biomeIndex, fmtNum } from './core.js';

export const W = 256, H = 160, GROUND = 134;
const MON_H = 37;
const HERO_X = 96, COMP_X = 62, MON_X = 184;
const FONT = '"Jersey 10", monospace';

// ------------------------------------------------------------------ helpers
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function hash(n) { n = (n << 13) ^ n; return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff; }

// ------------------------------------------------------------------ critter drawing
// pose: { walk: phase seconds, atk: 0..1 (attack progress) or -1 }
// Uses generated sprites when present; T2 forms without art borrow their parent's sprite, hue-shifted.
// `area` (optional): size by body mass instead of outline height, so feathers/staffs don't shrink the character.
export function drawForm(ctx, formId, x, feetY, h, pose, flip = false, area = 0) {
  const form = FORMS[formId];
  let spr = Sprites.forms[formId], hue = 0;
  if (!spr && form.tier === 2 && Sprites.forms[form.parent]) { spr = Sprites.forms[form.parent]; hue = [40, 160, 280][form.leaf]; area *= 1.12; }
  if (spr) return drawSprite(ctx, spr, x, feetY, (area && spr.sa ? area * spr.h / spr.sa : h) * (spr.scale || 1), pose, flip, hue);
  drawCritter(ctx, form, x, feetY, h, pose, flip);
}

function drawSprite(ctx, spr, x, feetY, h, pose, flip, hue) {
  let frames, fi;
  let an;
  if (pose.atk >= 0 && spr.anims.attack) { an = 'attack'; frames = spr.anims.attack; fi = Math.min(frames.length - 1, Math.floor(pose.atk * frames.length)); }
  else if (pose.moving && spr.anims.walk) { an = 'walk'; frames = spr.anims.walk; fi = Math.floor(pose.walk * 10) % frames.length; }
  else { an = spr.anims.idle ? 'idle' : 'walk'; frames = spr.anims[an]; fi = Math.floor(pose.walk * 4) % frames.length; }
  const fr = frames[fi] || frames[0];
  if (!fr) return;
  const [sx, sy, sw, sh] = fr;
  const k = h / spr.h * ((spr.animScale && spr.animScale[an]) || 1);
  const dw = sw * k, dh = sh * k;
  ctx.save();
  if (hue) ctx.filter = `hue-rotate(${hue}deg) saturate(1.2)`;
  const bob = (!pose.moving && pose.atk < 0) ? Math.round(Math.sin(pose.walk * 3) * 0.6) : 0;
  ctx.translate(Math.round(x), Math.round(feetY + bob));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(spr.img, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
  ctx.restore();
}

function drawCritter(ctx, form, x, feetY, h, pose, flip) {
  const a = ANIMALS[form.animal];
  const col = a.color;
  const dark = shade(col, -0.45);
  const tier = form.tier;
  const archCol = form.arch ? ARCH[form.arch].color : '#5aa0e0';
  const s = h / 48; // design units: 48 tall
  ctx.save();
  const lunge = pose.atk >= 0 ? Math.sin(Math.PI * Math.min(1, pose.atk)) * 7 : 0;
  const bob = pose.moving ? Math.abs(Math.sin(pose.walk * 10)) * -2 : Math.sin(pose.walk * 3) * 0.5;
  ctx.translate(Math.round(x + (flip ? -lunge : lunge)), Math.round(feetY + bob));
  ctx.scale(flip ? -s : s, s);
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#2a1a2a';
  const leg = pose.moving ? Math.sin(pose.walk * 10) * 3 : 0;

  // cape (tier 1+)
  if (tier >= 1) {
    ctx.fillStyle = archCol;
    ctx.beginPath(); ctx.moveTo(-6, -26); ctx.lineTo(-14 - Math.abs(leg), -4); ctx.lineTo(-2, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // legs
  ctx.fillStyle = form.animal === 'chick' ? '#f08a20' : dark;
  ctx.fillRect(-5 + leg, -8, 4, 8); ctx.strokeRect(-5 + leg, -8, 4, 8);
  ctx.fillRect(2 - leg, -8, 4, 8); ctx.strokeRect(2 - leg, -8, 4, 8);
  // body
  ctx.fillStyle = form.animal === 'panda' ? '#2a2a2a' : col;
  rr(ctx, -8, -24, 16, 17, 5); ctx.fill(); ctx.stroke();
  // tunic
  ctx.fillStyle = tier === 0 ? '#5cae4c' : shade(archCol, -0.15);
  rr(ctx, -7, -20, 14, 11, 3); ctx.fill();
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-7, -13, 14, 2);
  // weapon arm
  const swing = pose.atk >= 0 ? -1.6 + pose.atk * 2.6 : -0.4;
  ctx.save(); ctx.translate(6, -18); ctx.rotate(swing);
  ctx.fillStyle = tier === 2 ? '#e8e8f8' : '#a07040';
  ctx.fillRect(0, -2, 15, 3); ctx.strokeRect(0, -2, 15, 3);
  ctx.fillStyle = '#f0c040'; ctx.fillRect(-1, -4, 3, 7);
  ctx.restore();
  // head
  const hc = form.animal === 'panda' ? '#f4f4f0' : col;
  ctx.fillStyle = hc;
  ctx.beginPath(); ctx.arc(1, -34, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (form.animal === 'kitten') {
    ctx.fillStyle = col;
    for (const ex of [-8, 6]) { ctx.beginPath(); ctx.moveTo(ex, -42); ctx.lineTo(ex + 3, -51); ctx.lineTo(ex + 7, -42); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = dark; ctx.beginPath(); ctx.moveTo(-6, -40); ctx.lineTo(-3, -37); ctx.moveTo(0, -44); ctx.lineTo(1, -40); ctx.stroke(); ctx.strokeStyle = '#2a1a2a';
  } else if (form.animal === 'panda') {
    ctx.fillStyle = '#2a2a2a';
    for (const ex of [-8, 9]) { ctx.beginPath(); ctx.arc(ex, -44, 4.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(6, -35, 3.5, 4.5, 0.3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#f08a20';
    ctx.beginPath(); ctx.moveTo(11, -34); ctx.lineTo(17, -32); ctx.lineTo(11, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-2, -45); ctx.lineTo(0, -51); ctx.lineTo(3, -45); ctx.fill();
    if (tier >= 1) { ctx.fillStyle = '#e04040'; ctx.beginPath(); ctx.arc(1, -47, 3.5, Math.PI, 0); ctx.fill(); }
  }
  // eye
  ctx.fillStyle = '#1a1020'; ctx.fillRect(5, -37, 3, 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(6, -37, 1, 1);
  if (form.animal !== 'chick') { ctx.fillStyle = '#f08aa0'; ctx.fillRect(10, -32, 2, 1); }
  // tier 2 hat
  if (tier === 2) {
    ctx.fillStyle = shade(archCol, -0.25);
    ctx.beginPath(); ctx.moveTo(-10, -42); ctx.lineTo(1, -60 - form.leaf * 2); ctx.lineTo(12, -42); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f0c040'; ctx.fillRect(-10, -44, 22, 3);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ monsters
function drawMonster(ctx, m, x, feetY, t, flash, alpha = 1) {
  const g = m.big ? Sprites.grids.bosses : Sprites.grids.monsters;
  const baseH = MON_H * m.scale;
  const squash = 1 + Math.sin(t * 6) * 0.04 + flash * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(feetY));
  ctx.scale(1 / squash, squash);
  if (g && g.cells[m.cell]) {
    const [sx, sy, sw, sh] = g.cells[m.cell];
    const k = (baseH * (m.big ? 1.25 : 1)) / Math.max(sh, sw * 0.8);
    if (g.flip && g.flip.includes(m.cell)) ctx.scale(-1, 1);
    if (flash > 0) ctx.filter = 'brightness(3)';
    ctx.drawImage(g.img, sx, sy, sw, sh, -sw * k / 2, -sh * k, sw * k, sh * k);
    ctx.filter = 'none';
    if (m.kind === 'boss') drawCrown(ctx, 0, -sh * k - 3);
  } else {
    drawBlob(ctx, m, baseH, flash, t);
  }
  ctx.restore();
}
function drawCrown(ctx, x, y) {
  ctx.fillStyle = '#f0c040'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 7, y - 6); ctx.lineTo(x - 3, y - 3); ctx.lineTo(x, y - 8); ctx.lineTo(x + 3, y - 3); ctx.lineTo(x + 7, y - 6); ctx.lineTo(x + 7, y); ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function drawBlob(ctx, m, h, flash, t) {
  const col = flash > 0 ? '#ffffff' : m.col;
  const w = h * 1.1;
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#2a1a2a';
  if (m.kind === 'mimic') {
    ctx.fillStyle = col; rr(ctx, -w / 2, -h, w, h, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a4a1a'; ctx.fillRect(-w / 2, -h * 0.6, w, 3);
    ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 4 - 1, -h * 0.6 + 3, 2, 3);
    return;
  }
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w / 2, -h * 1.05, 0, -h);
  ctx.quadraticCurveTo(w / 2, -h * 1.05, w / 2, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-w * 0.18, -h * 0.7, w * 0.12, h * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
  // eyes (facing left toward the hero)
  ctx.fillStyle = '#fff';
  ctx.fillRect(-w * 0.3, -h * 0.6, 5, 6); ctx.fillRect(-w * 0.05, -h * 0.6, 5, 6);
  ctx.fillStyle = '#1a1020';
  ctx.fillRect(-w * 0.3, -h * 0.55, 3, 4); ctx.fillRect(-w * 0.05, -h * 0.55, 3, 4);
  // angry brows
  ctx.fillRect(-w * 0.32, -h * 0.66, 6, 1.5);
  if (m.kind === 'gem') { ctx.fillStyle = '#e0fffa'; ctx.beginPath(); ctx.moveTo(0, -h * 0.35); ctx.lineTo(4, -h * 0.25); ctx.lineTo(0, -h * 0.12); ctx.lineTo(-4, -h * 0.25); ctx.fill(); }
  if (m.kind === 'boss') drawCrown(ctx, 0, -h - 1);
  if (m.big) {
    ctx.fillStyle = '#f0e0c0';
    ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.9); ctx.lineTo(-w * 0.4, -h * 1.25); ctx.lineTo(-w * 0.15, -h * 0.98); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.3, -h * 0.9); ctx.lineTo(w * 0.4, -h * 1.25); ctx.lineTo(w * 0.15, -h * 0.98); ctx.fill(); ctx.stroke();
  }
}

// ------------------------------------------------------------------ background
function drawBackground(ctx, bi, scroll, t) {
  const b = BIOMES[bi];
  const img = Sprites.bg[b.id] || {};
  if (img.far) {
    tileImage(ctx, img.far, scroll * 0.15, 0, GROUND + 2);
  } else {
    const gr = ctx.createLinearGradient(0, 0, 0, GROUND);
    gr.addColorStop(0, b.sky[0]); gr.addColorStop(1, b.sky[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, GROUND);
    // sun / moon
    ctx.fillStyle = b.id === 'volcano' ? '#f8b060' : '#fff6c0';
    ctx.beginPath(); ctx.arc(210, 26, 10, 0, Math.PI * 2); ctx.fill();
    // far hills
    hills(ctx, scroll * 0.15, 96, 22, 70, b.hill2, 1);
    hills(ctx, scroll * 0.3, 112, 16, 48, b.hill, 2);
  }
  if (img.near) tileImage(ctx, img.near, scroll * 0.55, GROUND + 1 - 78, 78);
  else props(ctx, b, scroll * 0.6);
  // ground
  ctx.fillStyle = b.ground; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = b.grass; ctx.fillRect(0, GROUND, W, 4);
  const off = Math.floor(scroll) % 16;
  ctx.fillStyle = shade(b.ground, -0.2);
  for (let x = -off; x < W + 16; x += 16) {
    const k = Math.floor((x + scroll) / 16);
    ctx.fillRect(x + (hash(k) * 10 | 0), GROUND + 9 + (hash(k + 99) * 14 | 0), 3, 2);
    ctx.fillRect(x + 4, GROUND + 4, 2, 2);
  }
}
// Tiles horizontally, mirroring every other copy so the edges always meet seamlessly.
function tileImage(ctx, img, scroll, y, h) {
  const w = img.width * (h / img.height);
  const first = Math.floor(scroll / w);
  for (let i = first, x = -(scroll - first * w); x < W; i++, x += w) {
    const dx = Math.floor(x), dw = Math.ceil(w) + 1;
    if (i & 1) { ctx.save(); ctx.translate(dx + dw, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, dw, h); ctx.restore(); }
    else ctx.drawImage(img, dx, y, dw, h);
  }
}
function hills(ctx, scroll, base, amp, period, col, seed) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += 4) {
    const wx = x + scroll;
    const y = base - amp * (0.5 + 0.5 * Math.sin(wx / period + seed)) * (0.7 + 0.3 * Math.sin(wx / (period * 0.37) + seed * 3));
    ctx.lineTo(x, Math.round(y));
  }
  ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
}
function props(ctx, b, scroll) {
  const step = 40;
  const first = Math.floor(scroll / step) - 1;
  for (let i = first; i < first + W / step + 3; i++) {
    if (hash(i * 7 + 3) < 0.35) continue;
    const x = Math.round(i * step - scroll + hash(i) * 20);
    const sz = 0.7 + hash(i * 13) * 0.6;
    ctx.save(); ctx.translate(x, GROUND);
    switch (b.id) {
      case 'meadow':
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-2, -24 * sz, 4, 24 * sz);
        ctx.fillStyle = '#4caa44'; ctx.beginPath(); ctx.arc(0, -28 * sz, 12 * sz, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6ccc5c'; ctx.beginPath(); ctx.arc(-3, -31 * sz, 6 * sz, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bamboo':
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = k % 2 ? '#5abf5a' : '#48a048';
          const bx = k * 5 - 5, bh = (40 + k * 10) * sz;
          ctx.fillRect(bx, -bh, 3, bh);
          ctx.fillStyle = '#2e7a3a'; for (let j = 10; j < bh; j += 10) ctx.fillRect(bx, -j, 3, 1);
        }
        break;
      case 'desert':
        ctx.fillStyle = '#4a9a44';
        ctx.fillRect(-3, -22 * sz, 6, 22 * sz); ctx.fillRect(-9, -15 * sz, 4, 7); ctx.fillRect(-9, -15 * sz, 6, 3); ctx.fillRect(5, -18 * sz, 4, 8); ctx.fillRect(3, -12 * sz, 6, 3);
        break;
      case 'snow':
        ctx.fillStyle = '#3a6a5a';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-12 * sz + k * 2, -k * 10 * sz); ctx.lineTo(0, -(k * 10 + 16) * sz); ctx.lineTo(12 * sz - k * 2, -k * 10 * sz); ctx.fill(); }
        ctx.fillStyle = '#f4f8ff'; ctx.beginPath(); ctx.moveTo(-4 * sz, -26 * sz); ctx.lineTo(0, -36 * sz); ctx.lineTo(4 * sz, -26 * sz); ctx.fill();
        break;
      case 'volcano':
        ctx.fillStyle = '#2a1a1e'; ctx.beginPath(); ctx.moveTo(-10 * sz, 0); ctx.lineTo(-4, -16 * sz); ctx.lineTo(6, -12 * sz); ctx.lineTo(10 * sz, 0); ctx.fill();
        ctx.fillStyle = '#f06a20'; ctx.fillRect(-2, -10 * sz, 2, 4);
        break;
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ renderer
export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.scroll = 0; this.t = 0;
    this.fx = []; this.corpses = [];
    this.heroAtk = -1; this.heroAtkDur = 0.3;
    this.compAtk = -1; this.compAtkDur = 0.3;
    this.flash = 0; this.shake = 0;
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(W, Math.round(r.width * dpr));
    this.cv.height = Math.round(this.cv.width * H / W);
    this.k = this.cv.width / W;
  }
  // Convert client coords to logical.
  toLogical(cx, cy) {
    const r = this.cv.getBoundingClientRect();
    return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H];
  }
  text(str, x, y, color, size = 8, life = 0.9, vy = -22) {
    this.fx.push({ k: 'text', str, x, y, color, size, life, max: life, vy });
  }
  spark(x, y, color, n = 6, spd = 50) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
      this.fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0.4 + Math.random() * 0.3, color });
    }
  }
  handle(ev, battle) {
    const m = battle.monster;
    const mx = MON_X, my = GROUND - MON_H * 0.45 * (m ? m.scale : 1);
    switch (ev.type) {
      case 'swing':
        if (ev.src === 'hero') { this.heroAtk = 0; this.heroAtkDur = Math.min(0.32, 0.9 / battle.stats.aps); }
        else { this.compAtk = 0; this.compAtkDur = Math.min(0.32, 0.9 / battle.stats.compAps); }
        break;
      case 'hit': {
        const col = ev.src === 'skill' ? '#ff9a3c' : ev.crit ? '#ffd23c' : ev.src === 'tap' ? '#ffffff' : ev.src === 'comp' ? '#9ae0ff' : '#ffe8e0';
        this.text(fmtNum(ev.dmg) + (ev.crit ? '!' : ''), mx - 18 + Math.random() * 36, my + 6 - Math.random() * 14, col, ev.src === 'skill' ? 13 : ev.crit ? 10 : 7, ev.src === 'skill' ? 1.1 : 0.7, -26);
        this.flash = 0.08;
        if (ev.src === 'tap') this.fx.push({ k: 'slash', x: mx - 8 + Math.random() * 16, y: my - 6 + Math.random() * 12, life: 0.18, max: 0.18, a: Math.random() * Math.PI });
        if (ev.crit) { this.spark(mx, my, '#ffd23c', 5); this.shake = Math.max(this.shake, 0.12); }
        break;
      }
      case 'kill': {
        const dm = ev.monster;
        this.corpses.push({ m: dm, t: 0 });
        this.spark(MON_X, GROUND - 14 * dm.scale, dm.col, dm.big ? 24 : 12, 70);
        this.text('+' + fmtNum(ev.gold), MON_X, GROUND - 40 * dm.scale, '#ffd23c', 8, 1.1, -16);
        if (dm.kind !== 'normal') this.shake = 0.35;
        break;
      }
      case 'gems': this.text(`+${ev.n} 💎`, MON_X - 10, 50, '#7af0ff', 10, 1.6, -10); break;
      case 'loot': this.text(ev.sold ? 'sold' : 'LOOT!', MON_X, 40, RARITIES[ev.item.rarity].color, 9, 1.4, -10); break;
      case 'levelup': this.text('LEVEL UP!', HERO_X, GROUND - 64, '#8aff8a', 9, 1.2, -14); this.spark(HERO_X, GROUND - 24, '#8aff8a', 10); break;
      case 'bossFail': this.text('Boss escaped!', W / 2, 60, '#ff7a7a', 11, 1.8, -6); break;
      case 'stage': this.text(`Stage ${ev.stage}`, W / 2, 50, '#ffffff', 12, 1.6, -6); break;
      case 'frenzy': this.text('FRENZY!', HERO_X, 50, '#ff9a3c', 13, 1.5, -8); break;
      case 'sp': this.text(`+${ev.n} SKILL POINT`, W / 2, 34, '#ffe14a', 11, 2, -6); this.spark(HERO_X, GROUND - 30, '#ffe14a', 20, 70); break;
      case 'skill': {
        const SK = { strike: ['POWER STRIKE!', '#ff9a3c'], smash: ['EARTHSHAKER!', '#c89a5a'], flurry: ['FLURRY!', '#7ad0ff'], midas: ['MIDAS SPELL!', '#ffd23c'], assist: ['PAL ASSIST!', '#9ae0ff'] }[ev.id];
        this.text(SK[0], W / 2, 44, SK[1], 12, 1.3, -8);
        if (ev.id === 'assist') { this.compAtk = 0; this.compAtkDur = 0.35; } else { this.heroAtk = 0; this.heroAtkDur = 0.35; }
        if (ev.id === 'strike' || ev.id === 'assist') { for (let i = 0; i < 3; i++) this.fx.push({ k: 'slash', x: mx - 6 + i * 6, y: my - 4 + i * 4, life: 0.3, max: 0.3, a: 0.6 + i * 0.5, big: 1 }); this.shake = 0.25; }
        if (ev.id === 'smash') { this.shake = 0.6; for (let i = 0; i < 4; i++) this.spark(mx - 20 + i * 14, GROUND - 2, '#8a6a4a', 8, 90); }
        if (ev.id === 'flurry') this.spark(HERO_X, GROUND - 26, '#7ad0ff', 24, 80);
        if (ev.id === 'midas') this.spark(HERO_X, GROUND - 26, '#ffd23c', 30, 80);
        break;
      }
      case 'balloon': {
        const p = this.lastBalloon || [W / 2, 40];
        const T = { gold: ['+' + fmtNum(ev.gold || 0), '#ffd23c'], frenzy: ['FRENZY READY!', '#ff9a3c'], item: ['ITEM!', '#4fa0f0'], gems: [`+${ev.n} 💎`, '#7af0ff'], sp: ['+1 SKILL POINT', '#ffe14a'] }[ev.kind];
        this.text(T[0], p[0], p[1], T[1], 11, 1.6, -12);
        this.spark(p[0], p[1], ['#ff5a7a', '#5ab0ff', '#ffd23c', '#7ae07a'][this.lastHue || 0], 22, 90);
        break;
      }
      case 'jackpot': this.text('JACKPOT!', MON_X, 30, '#ffd23c', 11, 1.4, -10); this.spark(MON_X, GROUND - 20, '#ffd23c', 24, 90); break;
      case 'thunder': this.text('THUNDERCLAP!', MON_X, 26, '#9adfff', 10, 1.2, -10); this.spark(MON_X, GROUND - 20, '#9adfff', 18, 100); this.shake = 0.3; break;
    }
  }
  tapFx(lx, ly) { this.spark(lx, ly, '#ffffff', 3, 40); }
  balloonPos(b) { return [W + 14 - (b.age / b.dur) * (W + 28), b.y + Math.sin(b.age * 2.2) * 3]; }
  // Generous hit box: the balloon plus the gift hanging under it.
  balloonHit(lx, ly, battle) {
    const b = battle.balloon;
    if (!b) return false;
    const [x, y] = this.balloonPos(b);
    if (Math.abs(lx - x) < 15 && ly > y - 16 && ly < y + 24) { this.lastBalloon = [x, y]; this.lastHue = b.hue; return true; }
    return false;
  }
  drawBalloon(ctx, b) {
    const [x, y] = this.balloonPos(b).map(Math.round);
    const col = ['#ff5a7a', '#5ab0ff', '#ffd23c', '#7ae07a'][b.hue];
    ctx.strokeStyle = '#3a2a3a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.quadraticCurveTo(x + 3, y + 13, x, y + 16); ctx.stroke();
    ctx.fillStyle = '#1a1020'; ctx.fillRect(x - 5, y + 15, 10, 8);
    ctx.fillStyle = '#c84a4a'; ctx.fillRect(x - 4, y + 16, 8, 6);
    ctx.fillStyle = '#ffd23c'; ctx.fillRect(x - 1, y + 16, 2, 6); ctx.fillRect(x - 4, y + 18, 8, 2);
    ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x - 4, y - 5, 2, 4);
    ctx.fillStyle = '#1a1020'; ctx.fillRect(x - 1, y + 9, 3, 2);
    if (Math.floor(this.t * 4) % 2) { ctx.fillStyle = '#fff6a0'; ctx.fillRect(x + 9, y - 8, 1, 3); ctx.fillRect(x + 8, y - 7, 3, 1); }
  }

  draw(dt, game) {
    const { battle, s } = game;
    const ctx = this.ctx;
    this.t += dt;
    if (battle.phase === 'walk') this.scroll += 72 * dt;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (this.shake > 0) { this.shake -= dt; ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3); }
    drawBackground(ctx, biomeIndex(s.stage), this.scroll, this.t);

    // monster
    const m = battle.monster;
    const walking = battle.phase === 'walk';
    if (m) {
      const mx = walking ? MON_X + Math.min(1, battle.phaseT / 0.55) * 110 : MON_X;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(mx, GROUND + 1, 13 * m.scale, 3, 0, 0, Math.PI * 2); ctx.fill();
      drawMonster(ctx, m, mx, GROUND, this.t, this.flash);
      if (!walking) this.monsterBar(ctx, m, battle);
    }
    this.flash = Math.max(0, this.flash - dt);
    // corpses
    for (const c of this.corpses) {
      c.t += dt;
      drawMonster(ctx, c.m, MON_X + c.t * 30, GROUND, this.t, 0, Math.max(0, 1 - c.t * 3));
    }
    this.corpses = this.corpses.filter(c => c.t < 0.35);

    // heroes
    const hf = game.heroFormId, cf = game.compFormId;
    const pose = (atk, dur) => ({ walk: this.t, moving: walking, atk: atk >= 0 ? atk / dur : -1 });
    if (s.buffs.flurry > 0) {
      ctx.fillStyle = `rgba(110,200,255,${0.2 + Math.sin(this.t * 14) * 0.08})`;
      ctx.beginPath(); ctx.ellipse(HERO_X, GROUND - 24, 24, 32, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (s.buffs.midas > 0 && Math.random() < 0.3) this.fx.push({ k: 'spark', x: HERO_X - 14 + Math.random() * 28, y: GROUND - 50 + Math.random() * 40, vx: 0, vy: -20, life: 0.5, color: '#ffd23c' });
    if (s.frenzyT > 0) {
      ctx.fillStyle = `rgba(255,150,60,${0.18 + Math.sin(this.t * 10) * 0.08})`;
      ctx.beginPath(); ctx.ellipse(HERO_X, GROUND - 22, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(HERO_X, GROUND + 1, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (cf) {
      const cx = Math.round(COMP_X - ((game.heroA || 26) - 26 + (game.compA || 22) - 22) * 0.4); // bigger pair -> more room
      ctx.beginPath(); ctx.ellipse(cx, GROUND + 1, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      drawForm(ctx, cf, cx, GROUND, game.compH, pose(this.compAtk, this.compAtkDur), false, game.compA);
    }
    drawForm(ctx, hf, HERO_X, GROUND, game.heroH, pose(this.heroAtk, this.heroAtkDur), false, game.heroA);
    if (this.heroAtk >= 0) { this.heroAtk += dt; if (this.heroAtk > this.heroAtkDur) this.heroAtk = -1; }
    if (this.compAtk >= 0) { this.compAtk += dt; if (this.compAtk > this.compAtkDur) this.compAtk = -1; }

    if (battle.balloon) this.drawBalloon(ctx, battle.balloon);

    // effects
    for (const f of this.fx) {
      f.life -= dt;
      if (f.k === 'text') {
        f.y += f.vy * dt;
        ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
        ctx.font = `bold ${f.size}px ${FONT}`; ctx.textAlign = 'center';
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#1a1020'; ctx.strokeText(f.str, f.x, f.y);
        ctx.fillStyle = f.color; ctx.fillText(f.str, f.x, f.y);
      } else if (f.k === 'spark') {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 160 * dt;
        ctx.globalAlpha = Math.min(1, f.life * 3);
        ctx.fillStyle = f.color; ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 2);
      } else if (f.k === 'slash') {
        ctx.globalAlpha = f.life / f.max;
        ctx.strokeStyle = f.big ? '#ffd8a0' : '#ffffff'; ctx.lineWidth = f.big ? 4 : 2.5;
        const p = 1 - f.life / f.max, len = f.big ? 26 : 16;
        ctx.beginPath();
        ctx.moveTo(f.x - Math.cos(f.a) * len, f.y - Math.sin(f.a) * len);
        ctx.lineTo(f.x - Math.cos(f.a) * len + Math.cos(f.a) * len * 2 * Math.min(1, p * 2.5), f.y - Math.sin(f.a) * len + Math.sin(f.a) * len * 2 * Math.min(1, p * 2.5));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    this.fx = this.fx.filter(f => f.life > 0);
    if (this.fx.length > 160) this.fx.splice(0, this.fx.length - 160);
  }

  monsterBar(ctx, m, battle) {
    const w = 52, x = MON_X - w / 2, y = Math.max(14, GROUND - MON_H * m.scale * (m.big ? 1.25 : 1) - (m.kind === 'boss' ? 16 : 8));
    ctx.font = `bold 7px ${FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 2; ctx.strokeStyle = '#1a1020';
    const label = m.name;
    ctx.strokeText(label, MON_X, y - 3);
    ctx.fillStyle = m.kind === 'normal' ? '#ffffff' : m.kind === 'gem' ? '#7af0ff' : '#ffd23c'; ctx.fillText(label, MON_X, y - 3);
    ctx.fillStyle = '#1a1020'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = '#5a1a1a'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = '#e84a4a'; ctx.fillRect(x, y, Math.max(0, w * m.hp / m.maxHp), 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, Math.max(0, w * m.hp / m.maxHp), 1);
  }
}

// Draw a form into a small standalone canvas (UI portraits).
export function portrait(canvas, formId, t = 0, pad = 4) {
  const ctx = canvas.getContext('2d');
  const k = canvas.width / 64;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);
  drawForm(ctx, formId, 32, 64 - pad, 64 - pad * 2 - 4, { walk: t, moving: false, atk: -1 });
}
