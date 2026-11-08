import { ANIMALS, RARITIES, EVO_LEVELS } from './data.js';
import { newState, migrate, Battle, heroForm, companionForm, simulateOffline, computeStats, pendingEvo, fmtNum } from './core.js';
import { Renderer } from './render.js';
import { loadSprites } from './sprites.js';
import { initUI, updateHUD, toast, modal, modalOpen, evoModal, charSelectModal, welcomeBack, refreshPanel } from './ui.js';
import { sfx } from './audio.js';

const SAVE_KEY = 'fluffFeather.save.v1';
const MIN_AWAY = 30; // seconds away before offline progress kicks in

const G = {
  s: null, battle: null, renderer: null, tab: 'upgrades', buyX: 1, nextAnimal: null,
  heroFormId: 'kitten', compFormId: null, heroH: 40, compH: 34, heroA: 26, compA: 0,
  refreshForms() {
    const hf = heroForm(this.s), cf = companionForm(this.s);
    this.heroFormId = hf.id; this.heroH = [40, 46, 52][hf.tier]; this.heroA = [26, 32, 40][hf.tier];
    this.compFormId = cf ? cf.id : null; this.compH = cf ? [34, 38, 43][cf.tier] : 0; this.compA = cf ? [22, 27, 34][cf.tier] : 0;
  },
  save() {
    if (!this.s) return;
    this.s.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch { }
  },
  exportSave() { this.save(); return btoa(unescape(encodeURIComponent(JSON.stringify(this.s)))); },
  importSave(str) {
    try {
      const s = migrate(JSON.parse(decodeURIComponent(escape(atob(str)))));
      if (!s.animal || !ANIMALS[s.animal]) return false;
      this.s = s; this.battle = new Battle(s); this.refreshForms(); this.save(); refreshPanel(true);
      return true;
    } catch { return false; }
  },
  newGame(animal) {
    this.s = newState(animal);
    this.battle = new Battle(this.s); this.refreshForms(); this.save(); refreshPanel(true);
  },
  hardReset() {
    try { localStorage.removeItem(SAVE_KEY); } catch { }
    location.reload();
  },
};
window.G = G; // handy for debugging from the console

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('save load failed', e); }
  return null;
}

function applyOffline(showModal = true) {
  const s = G.s;
  const away = (Date.now() - s.lastSeen) / 1000;
  if (away < MIN_AWAY) return;
  const cap = computeStats(s).offlineCapH * 3600;
  const secs = Math.min(away, cap);
  const sum = simulateOffline(s, secs);
  sum.seconds = secs; sum.capped = away > cap;
  s.lastSeen = Date.now();
  G.battle = new Battle(s); G.refreshForms(); G.save();
  if (showModal && (sum.kills > 0 || sum.gold > 0)) welcomeBack(sum);
}

// ------------------------------------------------------------------ boot
async function boot() {
  const cv = document.getElementById('cv');
  G.s = load();
  const fresh = !G.s;
  if (fresh) G.s = newState('kitten');
  G.battle = new Battle(G.s);
  G.refreshForms();
  G.renderer = new Renderer(cv);
  initUI(G);
  await loadSprites();
  refreshPanel(true);
  if (fresh) charSelectModal();
  else applyOffline();

  // taps
  let tapTimes = [];
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    sfx.unlock();
    if (modalOpen()) return;
    const now = performance.now();
    tapTimes = tapTimes.filter(t => now - t < 1000);
    if (tapTimes.length >= 20) return; // anti-autoclicker cap
    tapTimes.push(now);
    const [lx, ly] = G.renderer.toLogical(e.clientX, e.clientY);
    G.battle.tap();
    G.renderer.tapFx(lx, ly);
    sfx.tap();
    if (G.s.settings.vibrate && navigator.vibrate) try { navigator.vibrate(8); } catch { }
  });
  window.addEventListener('resize', () => G.renderer.resize());

  // save on hide; offline progress on return
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); G.save(); }
    else if (hiddenAt) { applyOffline(); hiddenAt = 0; }
  });
  window.addEventListener('pagehide', () => G.save());
  setInterval(() => G.save(), 5000);

  // main loop
  let last = performance.now();
  let evoPrompted = {};
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    const s = G.s, b = G.battle;
    s.stats.playTime += dt;
    // fixed substeps for stable combat
    let rem = dt;
    while (rem > 0) { const h = Math.min(rem, 1 / 30); b.step(h); rem -= h; }
    handleEvents(b);
    G.renderer.draw(dt, G);
    updateHUD();
    // auto-open the evolution picker once per threshold
    const pe = pendingEvo(s.animal, s.level, s);
    const key = s.animal + pe;
    if (pe >= 0 && !evoPrompted[key] && !modalOpen()) { evoPrompted[key] = 1; evoModal(false); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
}

function handleEvents(b) {
  const evs = b.events;
  if (!evs.length) return;
  let formsDirty = false;
  for (const ev of evs) {
    G.renderer.handle(ev, b);
    switch (ev.type) {
      case 'hit': if (ev.src !== 'tap') { ev.crit ? sfx.crit() : sfx.hit(); } else if (ev.crit) sfx.crit(); break;
      case 'kill': sfx.coin(); if (ev.kind === 'boss' || ev.kind === 'bigboss') { sfx.boss(); vib(30); } break;
      case 'levelup': sfx.level(); formsDirty = true; break;
      case 'evo': {
        formsDirty = true;
        if (pendingEvo(G.s.animal, G.s.level, G.s) < 0) {
          sfx.evolve(); G.renderer.spark(96, 110, '#fff6a0', 30, 80);
          toast(`✨ Evolved into <b>${heroForm(G.s).name}</b>!`);
        }
        break;
      }
      case 'bossFail': sfx.fail(); toast('The boss got away! Train up, then tap <b>Fight boss</b>.'); break;
      case 'gems': toast(ev.milestone ? `🎉 New stage milestone: <b>+${ev.n} 💎</b>` : `💎 +${ev.n} gem${ev.n > 1 ? 's' : ''}!`); break;
      case 'loot': {
        const r = RARITIES[ev.item.rarity];
        if (!ev.sold) {
          if (ev.item.rarity >= 2) sfx.loot();
          toast(`${ev.equipped ? 'Equipped' : 'Found'} <b style="color:${r.color}">${ev.item.name}</b>${ev.item.rarity >= 2 ? ` (${r.name})` : ''}`);
        }
        break;
      }
      case 'sp': sfx.loot(); vib(20); toast(`🌟 You found ${ev.n > 1 ? ev.n + ' skill points' : 'a skill point'}! Spend it in <b>Talents</b>.`); break;
      case 'jackpot': sfx.loot(); break;
      case 'companionUnlock': toast('🤝 You can now recruit a <b>pal</b>! Check the Pals tab.'); break;
      case 'stage':
        if (ev.stage === 30) toast('✨ <b>Prestige</b> unlocked! Check the Prestige tab.');
        break;
    }
  }
  evs.length = 0;
  if (formsDirty) G.refreshForms();
}
function vib(ms) { if (G.s.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch { } }

boot();
