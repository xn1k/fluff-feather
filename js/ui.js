// DOM UI: HUD, tab panels, modals, toasts. All buttons use data-act and one delegated click handler.
import {
  ANIMALS, ANIMAL_IDS, FORMS, ARCH, TRAITS, UPGRADES, PERKS, RARITIES, SLOTS, EVO_LEVELS, GEM_COSTS,
  COMPANION_STAGE, PRESTIGE_STAGE, VERSION,
} from './data.js';
import {
  fmtNum, fmtTime, computeStats, upgCostN, upgMaxAffordable, perkCost, companionCost, companionUnlocked,
  pendingEvo, heroForm, companionForm, stardustGain, doPrestige, respecCost, doRespec, itemById, itemScore,
  sellValue, fmtStat, STAT_NAMES, rollItem, addItem, xpToNext, biome, WAVES, simulateOffline, Battle, FRENZY_KILLS,
  isBigBossStage,
} from './core.js';
import { portrait } from './render.js';
import { Sprites, itemIconCanvas } from './sprites.js';
import { sfx, setSound } from './audio.js';

let G; // game
const $ = id => document.getElementById(id);
const els = {};
let panelPressed = false, lastPanelHTML = '', lastPanelT = 0;

export function initUI(game) {
  G = game;
  for (const id of ['h-gold', 'h-gems', 'h-dust', 'h-stage', 'h-biome', 'h-waves', 'h-boss', 'btn-boss', 'btn-frenzy', 'h-dps', 'h-tap', 'panel', 'modal', 'toasts', 'btn-evolve']) els[id] = $(id);
  els['h-waves'].innerHTML = Array.from({ length: WAVES }, (_, i) => `<i class="${i === WAVES - 1 ? 'boss' : ''}"></i>`).join('');
  els.pips = [...els['h-waves'].children];

  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) { fn(el.dataset, el); refreshPanel(true); }
  });
  els.modal.addEventListener('click', e => { if (e.target === els.modal && !els.modal.dataset.sticky) closeModal(); });
  const p = els.panel;
  p.addEventListener('pointerdown', () => { panelPressed = true; });
  window.addEventListener('pointerup', () => { setTimeout(() => { panelPressed = false; }, 0); });
  window.addEventListener('pointercancel', () => { panelPressed = false; });
  setSound(G.s.settings.sound);
  refreshPanel(true);
}

// ------------------------------------------------------------------ HUD (every frame, change-detected)
const cache = {};
function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }

export function updateHUD() {
  const s = G.s, b = G.battle, st = b.stats;
  setText(els['h-gold'], 'g', fmtNum(s.gold));
  setText(els['h-gems'], 'm', fmtNum(s.gems));
  setText(els['h-dust'], 'd', fmtNum(s.stardust));
  setText(els['h-stage'], 's', `Stage ${s.stage}${s.farming ? ' · farming' : ''}`);
  setText(els['h-biome'], 'b', biome(s.stage).name);
  setText(els['h-dps'], 'dps', fmtNum(st.autoDps));
  setText(els['h-tap'], 'tap', fmtNum(st.tapHit));
  const wk = s.wave + ':' + s.farming;
  if (cache.wk !== wk) {
    cache.wk = wk;
    els.pips.forEach((p, i) => {
      p.classList.toggle('done', !s.farming && i < s.wave - 1);
      p.classList.toggle('cur', i === s.wave - 1);
    });
  }
  const bossOn = b.isBoss();
  els['h-boss'].classList.toggle('hidden', !bossOn);
  if (bossOn) {
    const left = b.phase === 'fight' ? b.bossLeft : st.bossTime;
    els['h-boss'].firstChild.style.width = (100 * left / st.bossTime) + '%';
    setText(els['h-boss'].lastChild, 'bt', `${isBigBossStage(s.stage) ? '👑 ' : ''}BOSS ${left.toFixed(1)}s`);
  }
  els['btn-boss'].classList.toggle('hidden', !s.farming);
  const fr = els['btn-frenzy'];
  const pct = s.frenzyT > 0 ? 100 * s.frenzyT / 12 : 100 * s.frenzy / FRENZY_KILLS;
  fr.firstChild.style.width = pct + '%';
  fr.classList.toggle('ready', s.frenzy >= FRENZY_KILLS && s.frenzyT <= 0);
  setText(fr.lastChild, 'fr', s.frenzyT > 0 ? `${Math.ceil(s.frenzyT)}s` : 'Frenzy');
  // evolution badge
  const pend = pendingEvo(s.animal, s.level, s) >= 0 || (s.companion.animal && pendingEvo(s.companion.animal, s.companion.level, s) >= 0);
  els['btn-evolve'].classList.toggle('hidden', !pend);
  setBadge('hero', pendingEvo(s.animal, s.level, s) >= 0);
  setBadge('pals', (companionUnlocked(s) && !s.companion.animal) || (s.companion.animal && pendingEvo(s.companion.animal, s.companion.level, s) >= 0));
  setBadge('items', s.items.some(i => i.isNew));
  setBadge('prestige', s.maxStage >= PRESTIGE_STAGE && stardustGain(s) >= Math.max(5, s.stardustTotal * 0.25) && !s.seenPrestigeHint);
  // panel refresh (throttled; never while a finger is down on it)
  const now = performance.now();
  if (now - lastPanelT > 250) { lastPanelT = now; refreshPanel(false); }
  // animated hero portrait
  const hp = els.panel.querySelector('canvas[data-anim]');
  if (hp) portrait(hp, hp.dataset.form, now / 1000);
}
function setBadge(tab, on) {
  const k = 'badge-' + tab;
  if (cache[k] === on) return;
  cache[k] = on;
  document.querySelector(`#tabs [data-tab="${tab}"]`).classList.toggle('badge', !!on);
}

// ------------------------------------------------------------------ panels
function setTab(t) {
  G.tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'prestige') G.s.seenPrestigeHint = true;
  els.panel.scrollTop = 0;
  refreshPanel(true);
}

export function refreshPanel(force) {
  if (panelPressed && !force) return;
  const html = PANELS[G.tab]();
  if (!force && html === lastPanelHTML) return;
  lastPanelHTML = html;
  els.panel.innerHTML = html;
  drawPortraits(els.panel);
  if (G.tab === 'items') markItemsSeen();
}
function drawPortraits(root) {
  root.querySelectorAll('canvas[data-form]').forEach(c => portrait(c, c.dataset.form));
}
const portraitC = (form, size = 64, anim = false) => `<canvas width="${size * 2}" height="${size * 2}" data-form="${form}"${anim ? ' data-anim' : ''}></canvas>`;

function buyCount(u, lvl) {
  const s = G.s;
  if (G.buyX === 'max') return Math.max(1, upgMaxAffordable(u, lvl, s.gold));
  return u.max != null ? Math.min(G.buyX, u.max - lvl) : G.buyX;
}
function upgEffect(u, l) {
  switch (u.id) {
    case 'dmg': return `Base hit ${fmtNum((1 + l) * Math.pow(2, Math.floor(l / 25)))} · ×2 at Lv ${(Math.floor(l / 25) + 1) * 25}`;
    case 'speed': return `${(1 + 0.05 * l).toFixed(2)}× attack speed`;
    case 'crit': return `+${l}% crit chance`;
    case 'critd': return `+${l * 10}% crit damage`;
    case 'tap': return `+${l * 15}% tap damage`;
    case 'gold': return `+${l * 15}% gold`;
  }
}
const segX = () => `<div class="seg">Buy: ${[1, 10, 100, 'max'].map(x => `<button data-act="buyx" data-x="${x}" class="${G.buyX === x ? 'on' : ''}">${x === 'max' ? 'MAX' : '×' + x}</button>`).join('')}</div>`;

const PANELS = {
  upgrades() {
    const s = G.s;
    let h = segX();
    for (const u of UPGRADES) {
      const lvl = s.upg[u.id];
      const maxed = u.max != null && lvl >= u.max;
      const n = maxed ? 0 : buyCount(u, lvl);
      const cost = n ? upgCostN(u, lvl, n) : 0;
      h += `<div class="row"><div class="ic">${u.icon}</div><div class="info"><b>${u.name}</b><small>Lv ${lvl}${u.max ? '/' + u.max : ''}</small>
        <div class="desc">${upgEffect(u, lvl)}</div><div class="desc">${u.desc}</div></div>
        ${maxed ? '<button class="btn" disabled>MAX</button>' : `<button class="btn" data-act="upg" data-id="${u.id}" data-n="${n}" ${cost > s.gold ? 'disabled' : ''}>+${n}<small>🪙 ${fmtNum(cost)}</small></button>`}</div>`;
    }
    if (companionUnlocked(s) && s.companion.animal) h += companionRow();
    h += `<p class="muted">Tip: tapping the battlefield attacks too, and early on it beats waiting!</p>`;
    return h;
  },

  hero() {
    const s = G.s, st = G.battle.stats;
    const f = heroForm(s);
    const a = ANIMALS[s.animal];
    const need = xpToNext(s.level);
    const pend = pendingEvo(s.animal, s.level, s);
    let h = `<div class="herohead">${portraitC(f.id, 48, true)}<div style="flex:1">
      <h2 style="margin:0">${f.name}</h2><div class="muted">${a.name} · ${f.arch ? ARCH[f.arch].name + ' path' : 'No evolution yet'}</div>
      <div><b>Level ${s.level}</b> <span class="muted">${fmtNum(s.xp)} / ${fmtNum(need)} XP</span></div>
      <div class="xpbar"><i style="width:${Math.min(100, 100 * s.xp / need).toFixed(1)}%"></i></div></div></div>`;
    if (pend >= 0) h += `<button class="btn big" style="margin-top:8px" data-act="openEvo">✨ Choose your evolution!</button>`;
    h += `<div class="stats">
      <span>Damage per hit</span><b>${fmtNum(st.hit)}</b>
      <span>Attacks / sec</span><b>${st.aps.toFixed(2)}</b>
      <span>Crit chance</span><b>${(st.critChance * 100).toFixed(1)}%</b>
      <span>Crit damage</span><b>×${st.critMult.toFixed(2)}</b>
      <span>Tap damage</span><b>${fmtNum(st.tapHit)}</b>
      <span>Boss damage</span><b>×${st.boss.toFixed(2)}</b>
      <span>Gold bonus</span><b>×${st.gold.toFixed(2)}</b>
      <span>Idle DPS</span><b>${fmtNum(st.autoDps)}</b>
      <span>Passive</span><b>${a.passive.text}</b>
      ${f.trait ? `<span>Trait</span><b>${TRAITS[f.trait]}</b>` : ''}
    </div>`;
    h += `<h3>Evolution path</h3>` + treeHTML(s.animal, s.level);
    return h;
  },

  items() {
    const s = G.s;
    let h = `<div class="equip">`;
    for (const sl of SLOTS) {
      const it = itemById(s, s.equipped[sl]);
      h += it ? `<div class="slot filled" data-act="item" data-id="${it.id}">${itemTile(it, true)}<div style="color:${RARITIES[it.rarity].color === '#c8c8c8' ? 'inherit' : RARITIES[it.rarity].color};font-weight:700">${it.name}</div></div>`
        : `<div class="slot"><div style="font-size:26px;opacity:.4">${{ weapon: '⚔️', armor: '🛡️', charm: '🍀' }[sl]}</div>No ${sl}</div>`;
    }
    h += `</div><h3>Backpack (${s.items.length}/60)</h3>`;
    const eq = new Set(Object.values(s.equipped));
    const list = s.items.filter(i => !eq.has(i.id)).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || b.rarity - a.rarity || itemScore(b) - itemScore(a));
    if (!list.length) h += `<p class="muted">Defeat monsters to find loot. Bosses drop more, and treasure mimics always do!</p>`;
    h += `<div class="inv">${list.map(it => `<button class="it" style="border-color:${RARITIES[it.rarity].color}" data-act="item" data-id="${it.id}">${itemTile(it)}</button>`).join('')}</div>`;
    h += `<div class="mbtns"><button class="btn warn" data-act="sellJunk">Sell unlocked spares</button>
      <button class="btn gem" data-act="gemChest" ${s.gems < GEM_COSTS.chest ? 'disabled' : ''}>Gem chest<small>💎 ${GEM_COSTS.chest} · Rare+</small></button></div>
      <div class="toggle"><span>Auto-sell new loot below</span><select data-act-change="autoSell">${['Off', 'Uncommon', 'Rare', 'Epic'].map((n, i) => `<option value="${i}" ${s.settings.autoSell === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    return h;
  },

  pals() {
    const s = G.s;
    if (!companionUnlocked(s)) {
      return `<h2>Pals</h2><p>Reach <b>stage ${COMPANION_STAGE}</b> to recruit a friend to fight beside you!</p>
        <div class="cards">${ANIMAL_IDS.filter(a => a !== s.animal).map(a => `<div class="card" style="opacity:.5">${portraitC(ANIMALS[a].base.id, 36)}<b>${ANIMALS[a].name}</b>🔒</div>`).join('')}</div>
        <p class="muted">Best stage so far: ${s.bestStage}</p>`;
    }
    if (!s.companion.animal) {
      return `<h2>Recruit a pal!</h2><p>Your pal fights beside you, levels up with gold and evolves on its own path. Its final-form trait helps the whole party.</p>
        <div class="cards">${ANIMAL_IDS.filter(a => a !== s.animal).map(a => `<div class="card">${portraitC(ANIMALS[a].base.id, 36)}<b>${ANIMALS[a].name}</b><span class="muted">${ANIMALS[a].passive.text} (as hero)</span><button class="btn" data-act="recruit" data-animal="${a}">Recruit</button></div>`).join('')}</div>`;
    }
    const cf = companionForm(s);
    const st = G.battle.stats;
    const pend = pendingEvo(s.companion.animal, s.companion.level, s);
    let h = `<div class="herohead">${portraitC(cf.id, 48)}<div style="flex:1"><h2 style="margin:0">${cf.name}</h2>
      <div class="muted">Pal · ${ANIMALS[s.companion.animal].name}</div><div><b>Level ${s.companion.level}</b></div>
      <div class="muted">${fmtNum(st.compHit * st.compAps)} DPS${cf.trait ? ' · ' + TRAITS[cf.trait] : ''}</div></div></div>`;
    if (pend >= 0) h += `<button class="btn big" style="margin-top:8px" data-act="openEvo" data-comp="1">✨ Evolve your pal!</button>`;
    h += segX() + companionRow();
    h += `<h3>Pal evolution</h3>` + treeHTML(s.companion.animal, s.companion.level);
    const other = ANIMAL_IDS.find(a => a !== s.animal && a !== s.companion.animal);
    if (other) h += `<div class="mbtns"><button class="btn warn" data-act="swapPal" data-animal="${other}">Swap to ${ANIMALS[other].name}<small>pal level resets to 1</small></button></div>`;
    return h;
  },

  prestige() {
    const s = G.s;
    const gain = stardustGain(s);
    const next = G.nextAnimal || s.animal;
    let h = `<h2>✨ Prestige</h2>
      <p>Start over from stage ${1 + 5 * s.perks.start} and level 1, keeping your items, gems, pal and evolution choices, and earn <b style="color:#9a4ad8">Stardust</b> for permanent perks.</p>
      <div class="stats"><span>Stardust earned (all time)</span><b>${fmtNum(s.stardustTotal)}</b><span>Bonus damage from it</span><b>+${s.stardustTotal}%</b>
      <span>Highest stage this run</span><b>${s.maxStage}</b><span>Stardust if you prestige now</span><b>+${fmtNum(gain)}</b></div>`;
    if (s.maxStage < PRESTIGE_STAGE) h += `<p class="muted">Reach stage ${PRESTIGE_STAGE} to prestige.</p>`;
    else {
      h += `<h3>Hero for the next run</h3><div class="seg">${ANIMAL_IDS.map(a => `<button data-act="nextAnimal" data-animal="${a}" class="${next === a ? 'on' : ''}">${ANIMALS[a].name}</button>`).join('')}</div>
        <button class="btn dust big" data-act="prestige">Prestige for +${fmtNum(gain)} ✨</button>`;
    }
    h += `<h3>Perks</h3>`;
    for (const p of PERKS) {
      const lv = s.perks[p.id], maxed = p.max != null && lv >= p.max, c = perkCost(p, lv);
      h += `<div class="row"><div class="ic">${p.icon}</div><div class="info"><b>${p.name}</b><small>Lv ${lv}${p.max ? '/' + p.max : ''}</small><div class="desc">${p.desc} per level</div></div>
        ${maxed ? '<button class="btn dust" disabled>MAX</button>' : `<button class="btn dust" data-act="perk" data-id="${p.id}" ${c > s.stardust ? 'disabled' : ''}>Buy<small>✨ ${fmtNum(c)}</small></button>`}</div>`;
    }
    return h;
  },

  more() {
    const s = G.s, st = s.stats;
    return `<h2>Gem shop</h2>
      <div class="row"><div class="ic">⏩</div><div class="info"><b>Time Warp</b><div class="desc">Instantly get 2 hours of idle progress.</div></div><button class="btn gem" data-act="timeWarp" ${s.gems < GEM_COSTS.timeWarp ? 'disabled' : ''}>Warp<small>💎 ${GEM_COSTS.timeWarp}</small></button></div>
      <div class="row"><div class="ic">🎁</div><div class="info"><b>Gem chest</b><div class="desc">A guaranteed Rare-or-better item.</div></div><button class="btn gem" data-act="gemChest" ${s.gems < GEM_COSTS.chest ? 'disabled' : ''}>Open<small>💎 ${GEM_COSTS.chest}</small></button></div>
      <p class="muted">Gems drop from bosses and gem slimes, and you get some for every 10 new stages. Spend them to change evolution paths (Hero tab).</p>
      <h3>Settings</h3>
      <div class="toggle"><span>Sound</span><button class="btn" data-act="setting" data-k="sound">${s.settings.sound ? 'On' : 'Off'}</button></div>
      <div class="toggle"><span>Vibration</span><button class="btn" data-act="setting" data-k="vibrate">${s.settings.vibrate ? 'On' : 'Off'}</button></div>
      <h3>Stats</h3>
      <div class="stats"><span>Best stage</span><b>${s.bestStage}</b><span>Monsters defeated</span><b>${fmtNum(st.kills)}</b><span>Bosses defeated</span><b>${fmtNum(st.bossKills)}</b>
      <span>Taps</span><b>${fmtNum(st.taps)}</b><span>Prestiges</span><b>${st.prestiges}</b><span>Gold earned</span><b>${fmtNum(st.goldEarned)}</b><span>Play time</span><b>${fmtTime(st.playTime)}</b></div>
      <h3>Save</h3>
      <div class="mbtns"><button class="btn" data-act="exportSave">Export</button><button class="btn" data-act="importSave">Import</button><button class="btn warn" data-act="hardReset">Reset</button></div>
      <p class="muted">Your game saves on this device automatically. Export now and then to keep a backup.<br>Install: open the browser menu and pick “Add to Home screen”.</p>
      <p class="muted">Fluff &amp; Feather v${VERSION}</p>`;
  },
};

function companionRow() {
  const s = G.s, lv = s.companion.level;
  let n = G.buyX === 'max' ? 0 : G.buyX, cost = 0;
  if (G.buyX === 'max') { let c = 0; while (n < 1000 && c + companionCost(lv + n) <= s.gold) { c += companionCost(lv + n); n++; } cost = c; n = Math.max(1, n); if (!cost) cost = companionCost(lv); }
  else for (let i = 0; i < n; i++) cost += companionCost(lv + i);
  const cf = companionForm(s);
  return `<div class="row"><div class="ic">🤝</div><div class="info"><b>Train ${cf.name}</b><small>Lv ${lv}</small><div class="desc">Pal damage grows with your own. Evolves at Lv ${EVO_LEVELS.join(' & ')}.</div></div>
    <button class="btn" data-act="palUp" data-n="${n}" ${cost > s.gold ? 'disabled' : ''}>+${n}<small>🪙 ${fmtNum(cost)}</small></button></div>`;
}

function treeHTML(animal, level) {
  const s = G.s, a = ANIMALS[animal], e = s.evo[animal];
  const node = (f, state, extra = '') => `<div class="node ${state}">${portraitC(f.id, 24)}<b>${f.name}</b>${f.arch ? `<div class="arch" style="color:${ARCH[f.arch].color}">${ARCH[f.arch].name}</div>` : ''}${extra}</div>`;
  let h = `<div class="tree"><div class="lvl">${node(a.base, 'chosen')}</div><div class="arrow">▼ Lv ${EVO_LEVELS[0]}</div><div class="lvl">`;
  a.branches.forEach((b, i) => { h += node(FORMS[b.id], e[0] === i ? 'chosen' : e[0] == null ? '' : 'locked'); });
  h += `</div><div class="arrow">▼ Lv ${EVO_LEVELS[1]}</div><div class="lvl">`;
  const br = a.branches[e[0] ?? 0];
  br.children.forEach((c, i) => {
    const f = FORMS[c.id];
    h += node(f, e[0] == null ? 'locked' : e[1] === i ? 'chosen' : e[1] == null ? '' : 'locked', `<div style="font-size:10px">${TRAITS[c.trait]}</div>`);
  });
  h += `</div></div>`;
  if (e[0] == null) h += `<p class="muted" style="text-align:center">Branches shown: ${a.branches.map(b => b.name).join(', ')}. Pick at level ${EVO_LEVELS[0]}.</p>`;
  else {
    h += `<div class="mbtns">
      <button class="btn gem" data-act="respec" data-animal="${animal}" data-w="0" ${s.gems < respecCost(0) ? 'disabled' : ''}>Change branch<small>💎 ${respecCost(0)}</small></button>
      ${e[1] != null ? `<button class="btn gem" data-act="respec" data-animal="${animal}" data-w="1" ${s.gems < respecCost(1) ? 'disabled' : ''}>Change final form<small>💎 ${respecCost(1)}</small></button>` : ''}</div>`;
  }
  return h;
}

// ------------------------------------------------------------------ items
const EMOJI = ['🪵', '🗡️', '🥊', '🎋', '🪶', '🔱', '🪄', '🤺', '🔨', '🏹', '⚔️', '🔥', '🧣', '🍃', '🌰', '🎽', '🐚', '🧥', '🛡️', '🥷', '💠', '🐉', '🍀', '🔔', '🥚', '⭐', '🦴', '🧶', '🌙', '🎶', '🪶', '🪙'];
function itemIcon(it) {
  const url = Sprites.grids.items ? itemIconCanvas(it.icon, 48) : null;
  return url ? `<img src="${url}" alt="">` : `<span>${EMOJI[it.icon] || '❔'}</span>`;
}
function itemTile(it, plain) {
  if (plain) return `<div class="it" style="width:52px;margin:0 auto 3px;border-color:${RARITIES[it.rarity].color}">${itemIcon(it)}</div>`;
  const s = G.s;
  const cur = itemById(s, s.equipped[it.slot]);
  const better = !cur || itemScore(it) > itemScore(cur);
  return itemIcon(it) + (it.locked ? '<span class="lk">🔒</span>' : '') + (it.isNew ? '<span class="nw"></span>' : '') + (better ? '<span class="up">▲</span>' : '');
}
function markItemsSeen() { setTimeout(() => G.s.items.forEach(i => { i.isNew = false; }), 1500); }

function itemModal(it) {
  const s = G.s;
  const cur = itemById(s, s.equipped[it.slot]);
  const isEq = cur && cur.id === it.id;
  const r = RARITIES[it.rarity];
  const keys = new Set([...Object.keys(it.stats), ...(cur && !isEq ? Object.keys(cur.stats) : [])]);
  let rows = '';
  for (const k of keys) {
    const v = it.stats[k] || 0, cv = cur && !isEq ? (cur.stats[k] || 0) : null;
    const diff = cv == null ? '' : v > cv ? `<span class="d pos">▲</span>` : v < cv ? `<span class="d neg">▼</span>` : '';
    rows += `<div class="statline"><span>${STAT_NAMES[k]}</span><b>${v ? fmtStat(k, v) : '—'}${diff}</b></div>`;
  }
  modal(`<div style="text-align:center">${itemTile(it, true)}<h2 style="color:${r.color === '#c8c8c8' ? 'inherit' : r.color};margin:4px 0">${it.name}</h2>
    <div class="muted">${r.name} ${it.slot} · item level ${it.ilvl}${isEq ? ' · equipped' : ''}</div></div>
    <div class="stats" style="display:block">${rows}</div>
    ${cur && !isEq ? `<p class="muted">▲▼ compared to your ${cur.name}</p>` : ''}
    <div class="mbtns">
      ${isEq ? '' : `<button class="btn" data-act="equip" data-id="${it.id}">Equip</button>`}
      <button class="btn" data-act="lock" data-id="${it.id}">${it.locked ? 'Unlock' : 'Lock'}</button>
      ${isEq || it.locked ? '' : `<button class="btn warn" data-act="sell" data-id="${it.id}">Sell<small>🪙 ${fmtNum(sellValue(s, it))}</small></button>`}
    </div>`);
}

// ------------------------------------------------------------------ modals & toasts
export function modal(html, sticky = false) {
  const m = els.modal;
  m.firstElementChild.innerHTML = html;
  m.classList.remove('hidden');
  if (sticky) m.dataset.sticky = '1'; else delete m.dataset.sticky;
  drawPortraits(m);
}
export function closeModal() { els.modal.classList.add('hidden'); delete els.modal.dataset.sticky; }
export function modalOpen() { return !els.modal.classList.contains('hidden'); }

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = text;
  els.toasts.appendChild(t);
  setTimeout(() => t.remove(), 3100);
  while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
}

export function evoModal(comp) {
  const s = G.s;
  const animal = comp ? s.companion.animal : s.animal;
  const lvl = comp ? s.companion.level : s.level;
  const which = pendingEvo(animal, lvl, s);
  if (which < 0) return;
  const a = ANIMALS[animal];
  let opts;
  if (which === 0) opts = a.branches.map((b, i) => ({ f: FORMS[b.id], i, d: ARCH[b.arch].desc, sub: b.children.map(c => c.name).join(' · ') }));
  else opts = a.branches[s.evo[animal][0]].children.map((c, i) => ({ f: FORMS[c.id], i, d: TRAITS[c.trait], sub: '' }));
  modal(`<h2>✨ ${comp ? 'Your pal is' : FORMS[a.base.id].name + ' is'} ready to evolve!</h2>
    <p style="text-align:center">Choose wisely. Changing it later costs gems.</p>
    <div class="cards">${opts.map(o => `<div class="card">${portraitC(o.f.id, 36)}<b>${o.f.name}</b>
      ${o.f.arch ? `<span class="arch" style="color:${ARCH[o.f.arch].color};font-weight:700">${ARCH[o.f.arch].name}</span>` : ''}
      <span>${o.d}</span>${o.sub ? `<span class="muted" style="font-size:10px">→ ${o.sub}</span>` : ''}
      <button class="btn" data-act="evoPick" data-animal="${animal}" data-which="${which}" data-i="${o.i}" data-comp="${comp ? 1 : ''}">Choose</button></div>`).join('')}</div>
    <div class="mbtns"><button class="btn warn" data-act="close">Later</button></div>`);
}

export function charSelectModal() {
  modal(`<h2>🌟 Fluff &amp; Feather 🌟</h2><p style="text-align:center">Choose your hero!</p>
    <div class="cards">${ANIMAL_IDS.map(a => `<div class="card">${portraitC(ANIMALS[a].base.id, 36)}<b>${ANIMALS[a].name}</b><span>${ANIMALS[a].passive.text}</span>
      <span class="muted" style="font-size:10px">${ANIMALS[a].branches.map(b => b.name).join(' · ')}</span>
      <button class="btn" data-act="pickHero" data-animal="${a}">Pick</button></div>`).join('')}</div>
    <p class="muted" style="text-align:center">You can recruit the others as pals later, and switch heroes when you prestige.</p>`, true);
}

export function welcomeBack(sum) {
  const items = sum.items.length;
  modal(`<h2>😴 Welcome back!</h2><p style="text-align:center">You were away for <b>${fmtTime(sum.seconds)}</b>${sum.capped ? ' (max)' : ''}. Your hero kept fighting:</p>
    <div class="stats"><span>Gold</span><b>🪙 ${fmtNum(sum.gold + sum.soldGold)}</b><span>Monsters defeated</span><b>${fmtNum(sum.kills)}</b>
    <span>Stages cleared</span><b>${sum.stages} (now ${sum.endStage})</b><span>Levels gained</span><b>${sum.levels}</b>
    <span>Items found</span><b>${items}</b>${sum.gems ? `<span>Gems</span><b>💎 ${sum.gems}</b>` : ''}</div>
    <div class="mbtns"><button class="btn big" data-act="close">Yay!</button></div>`);
}

// ------------------------------------------------------------------ actions
function vib(ms) { if (G.s.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch { } }
const ACTIONS = {
  close() { closeModal(); },
  buyx(d) { G.buyX = d.x === 'max' ? 'max' : +d.x; },
  upg(d) {
    const s = G.s, u = UPGRADES.find(x => x.id === d.id);
    const lvl = s.upg[u.id];
    let n = +d.n;
    if (G.buyX === 'max') n = upgMaxAffordable(u, lvl, s.gold);
    if (u.max != null) n = Math.min(n, u.max - lvl);
    if (n <= 0) return;
    const c = upgCostN(u, lvl, n);
    if (c > s.gold) return;
    s.gold -= c; s.upg[u.id] += n;
    G.battle.refresh(); sfx.buy();
  },
  palUp(d) {
    const s = G.s;
    let n = +d.n, spent = 0;
    for (let i = 0; i < n; i++) {
      const c = companionCost(s.companion.level);
      if (c > s.gold) break;
      s.gold -= c; s.companion.level++; spent++;
      if (EVO_LEVELS.includes(s.companion.level)) { toast('✨ Your pal can evolve!'); }
    }
    if (spent) { G.battle.refresh(); G.refreshForms(); sfx.buy(); }
  },
  perk(d) {
    const s = G.s, p = PERKS.find(x => x.id === d.id);
    const c = perkCost(p, s.perks[p.id]);
    if (c > s.stardust || (p.max != null && s.perks[p.id] >= p.max)) return;
    s.stardust -= c; s.perks[p.id]++;
    G.battle.refresh(); sfx.buy(); G.save();
  },
  frenzy() { if (G.battle.activateFrenzy()) { sfx.boss(); vib(40); } },
  retryBoss() { G.battle.retryBoss(); },
  openEvo(d) {
    const s = G.s;
    if (d.comp || pendingEvo(s.animal, s.level, s) < 0) evoModal(true); else evoModal(false);
  },
  evoPick(d) {
    const s = G.s;
    s.evo[d.animal][+d.which] = +d.i;
    closeModal();
    G.battle.refresh(); G.refreshForms(); G.save();
    const f = d.comp ? companionForm(s) : heroForm(s);
    sfx.evolve(); vib([30, 50, 30]);
    G.renderer.spark(d.comp ? 62 : 96, 110, '#fff6a0', 30, 80);
    toast(`✨ Evolved into <b>${f.name}</b>!`);
  },
  respec(d) {
    const s = G.s, which = +d.w;
    modal(`<h2>Change path?</h2><p>This resets your ${which === 0 ? 'branch and final form' : 'final form'} choice for the ${ANIMALS[d.animal].name}. You'll pick again right away if the level is high enough.</p>
      <div class="mbtns"><button class="btn warn" data-act="close">Cancel</button><button class="btn gem" data-act="respecYes" data-animal="${d.animal}" data-w="${which}">Spend 💎 ${respecCost(which)}</button></div>`);
  },
  respecYes(d) {
    const s = G.s;
    if (!doRespec(s, d.animal, +d.w)) return;
    closeModal(); G.battle.refresh(); G.refreshForms(); G.save();
    const comp = d.animal === s.companion.animal;
    const lvl = comp ? s.companion.level : s.level;
    if (pendingEvo(d.animal, lvl, s) >= 0) evoModal(comp);
  },
  item(d) { const it = itemById(G.s, +d.id); if (it) { it.isNew = false; itemModal(it); } },
  equip(d) {
    const s = G.s, it = itemById(s, +d.id);
    s.equipped[it.slot] = it.id; closeModal(); G.battle.refresh(); sfx.buy(); G.save();
  },
  lock(d) { const it = itemById(G.s, +d.id); it.locked = !it.locked; itemModal(it); },
  sell(d) {
    const s = G.s, it = itemById(s, +d.id);
    s.gold += sellValue(s, it); s.items.splice(s.items.indexOf(it), 1); closeModal(); sfx.coin();
  },
  sellJunk() {
    const s = G.s, eq = new Set(Object.values(s.equipped));
    const junk = s.items.filter(i => !i.locked && !eq.has(i.id));
    if (!junk.length) return toast('Nothing to sell');
    modal(`<h2>Sell ${junk.length} items?</h2><p>All unlocked items that aren't equipped will be sold. Lock the ones you want to keep.</p>
      <div class="mbtns"><button class="btn" data-act="close">Cancel</button><button class="btn warn" data-act="sellJunkYes">Sell for 🪙 ${fmtNum(junk.reduce((a, i) => a + sellValue(s, i), 0))}</button></div>`);
  },
  sellJunkYes() {
    const s = G.s, eq = new Set(Object.values(s.equipped));
    for (const i of s.items.filter(i => !i.locked && !eq.has(i.id))) s.gold += sellValue(s, i);
    s.items = s.items.filter(i => i.locked || eq.has(i.id));
    closeModal(); sfx.coin();
  },
  gemChest() {
    const s = G.s;
    if (s.gems < GEM_COSTS.chest) return;
    s.gems -= GEM_COSTS.chest;
    const it = rollItem(s, Math.max(s.maxStage, s.stage), G.battle.stats.luck, Math.random, 2);
    s.settings._as = s.settings.autoSell; s.settings.autoSell = 0;
    addItem(s, it);
    s.settings.autoSell = s.settings._as; delete s.settings._as;
    sfx.loot(); G.battle.refresh(); G.save();
    itemModal(it);
  },
  timeWarp() {
    const s = G.s;
    if (s.gems < GEM_COSTS.timeWarp) return;
    s.gems -= GEM_COSTS.timeWarp;
    const sum = simulateOffline(s, 7200);
    G.battle = new Battle(s); G.refreshForms(); G.save();
    welcomeBack(sum);
  },
  recruit(d) {
    const s = G.s;
    s.companion.animal = d.animal; s.companion.level = 1;
    G.battle.refresh(); G.refreshForms(); G.save();
    toast(`🤝 ${ANIMALS[d.animal].name} joined your party!`); sfx.level();
  },
  swapPal(d) {
    modal(`<h2>Swap pal?</h2><p>${ANIMALS[d.animal].name} joins and your current pal leaves. Pal level resets to 1. Evolution choices are remembered for each animal.</p>
      <div class="mbtns"><button class="btn" data-act="close">Cancel</button><button class="btn warn" data-act="swapPalYes" data-animal="${d.animal}">Swap</button></div>`);
  },
  swapPalYes(d) { const s = G.s; s.companion.animal = d.animal; s.companion.level = 1; closeModal(); G.battle.refresh(); G.refreshForms(); G.save(); },
  nextAnimal(d) { G.nextAnimal = d.animal; },
  prestige() {
    const s = G.s;
    const next = G.nextAnimal || s.animal;
    modal(`<h2>✨ Prestige?</h2><p>You'll go back to stage ${1 + 5 * s.perks.start}, level 1, with 0 gold and no upgrades.</p>
      <p>You keep: items, gems, stardust perks, evolution choices and your pal.</p>
      <p>You gain: <b>+${fmtNum(stardustGain(s))} ✨ Stardust</b>${next !== s.animal ? `<br>Next hero: <b>${ANIMALS[next].name}</b>` : ''}</p>
      <div class="mbtns"><button class="btn" data-act="close">Not yet</button><button class="btn dust" data-act="prestigeYes">Prestige!</button></div>`);
  },
  prestigeYes() {
    const s = G.s;
    const gain = doPrestige(s, G.nextAnimal);
    G.nextAnimal = null;
    G.battle = new Battle(s); G.refreshForms(); G.save();
    closeModal(); sfx.evolve();
    toast(`✨ +${fmtNum(gain)} Stardust! A new journey begins.`);
  },
  pickHero(d) {
    G.newGame(d.animal); closeModal();
    toast(`Good luck, little ${ANIMALS[d.animal].name}! Tap to attack!`);
  },
  setting(d) {
    const s = G.s; s.settings[d.k] = !s.settings[d.k];
    if (d.k === 'sound') setSound(s.settings.sound);
    G.save();
  },
  exportSave() {
    const data = G.exportSave();
    modal(`<h2>Export save</h2><p class="muted">Copy this text and keep it somewhere safe.</p><textarea readonly>${data}</textarea>
      <div class="mbtns"><button class="btn" data-act="copySave">Copy</button><button class="btn" data-act="close">Done</button></div>`);
    els.modal.querySelector('textarea').select();
  },
  copySave() { const t = els.modal.querySelector('textarea'); navigator.clipboard?.writeText(t.value).then(() => toast('Copied!'), () => { t.select(); }); },
  importSave() {
    modal(`<h2>Import save</h2><p class="muted">Paste an exported save. This replaces your current game!</p><textarea id="imp"></textarea>
      <div class="mbtns"><button class="btn" data-act="close">Cancel</button><button class="btn warn" data-act="importYes">Import</button></div>`);
  },
  importYes() {
    const v = document.getElementById('imp').value.trim();
    if (G.importSave(v)) { closeModal(); toast('Save imported!'); } else toast('That save could not be read 😿');
  },
  hardReset() {
    modal(`<h2>Reset everything?</h2><p>This deletes your whole save, including stardust, gems and items. This can't be undone!</p>
      <div class="mbtns"><button class="btn" data-act="close">Cancel</button><button class="btn warn" data-act="hardResetYes">Delete save</button></div>`);
  },
  hardResetYes() { G.hardReset(); },
};
// <select> changes
document.addEventListener('change', e => {
  const el = e.target.closest('[data-act-change]');
  if (!el) return;
  if (el.dataset.actChange === 'autoSell') { G.s.settings.autoSell = +el.value; G.save(); }
});
