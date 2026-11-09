// DOM UI: HUD, tab panels, modals, toasts. All buttons use data-act and one delegated click handler.
import {
  ANIMALS, ANIMAL_IDS, FORMS, ARCH, TRAITS, UPGRADES, PERKS, RARITIES, SLOTS, EVO_LEVELS, GEM_COSTS,
  COMPANION_STAGE, PRESTIGE_STAGE, VERSION, TALENTS, TALENT_ROWS, TALENT_BRANCHES, SP_CHANCE,
  SKILLS, BLESS_REROLL_GEMS, QUEST_REROLL_GEMS, STRIKE_LEVEL,
} from './data.js';
import {
  fmtNum, fmtTime, computeStats, upgCostN, upgMaxAffordable, perkCost, companionCost, companionUnlocked,
  pendingEvo, heroForm, companionForm, stardustGain, doPrestige, respecCost, doRespec, itemById, itemScore,
  sellValue, fmtStat, STAT_NAMES, rollItem, addItem, xpToNext, biome, WAVES, simulateOffline, Battle, FRENZY_KILLS,
  isBigBossStage, TALENT, talentRank, talentVal, branchSpent, talentCost, talentRowOpen, canLearn, learnTalent,
  talentsSpent, resetTalents, anyLearnable,
  skillSlots, BLESS, pickBlessing, rerollBlessings, blessingSummary, questText, questGold, claimQuest, rerollQuest,
  itemCompare, isUpgrade, equipBest, gearTotals,
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
  for (const id of ['h-gold', 'h-gems', 'h-dust', 'h-stage', 'h-biome', 'h-waves', 'h-boss', 'btn-boss', 'btn-frenzy', 'h-dps', 'h-tap', 'panel', 'modal', 'toasts', 'btn-evolve', 'btn-bless']) els[id] = $(id);
  els.sk = [...document.querySelectorAll('#skills .sk')];
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
    setText(els['h-boss'].lastChild, 'bt', `${isBigBossStage(s.stage) ? '👑 ' : ''}BOSS ${left.toFixed(1)}s${s.buffs.stun > 0 ? ' ⏸ frozen' : ''}`);
  }
  els['btn-boss'].classList.toggle('hidden', !s.farming);
  const fr = els['btn-frenzy'];
  const pct = s.frenzyT > 0 ? 100 * s.frenzyT / st.frenzyTime : 100 * s.frenzy / st.frenzyKills;
  fr.firstChild.style.width = pct + '%';
  fr.classList.toggle('ready', s.frenzy >= st.frenzyKills && s.frenzyT <= 0);
  setText(fr.lastChild, 'fr', s.frenzyT > 0 ? `${Math.ceil(s.frenzyT)}s` : 'Frenzy');
  // evolution badge
  const pend = pendingEvo(s.animal, s.level, s) >= 0 || (s.companion.animal && pendingEvo(s.companion.animal, s.companion.level, s) >= 0);
  els['btn-evolve'].classList.toggle('hidden', !pend);
  setBadge('hero', pendingEvo(s.animal, s.level, s) >= 0);
  setBadge('pals', (companionUnlocked(s) && !s.companion.animal) || (s.companion.animal && pendingEvo(s.companion.animal, s.companion.level, s) >= 0));
  setBadge('items', s.items.some(i => i.isNew));
  setBadge('talents', anyLearnable(s));
  setBadge('upgrades', s.quests.some(q => q.have >= q.n));
  els['btn-bless'].classList.toggle('hidden', !(s.blessPending > 0));
  // skill bar
  skillSlots(s).forEach((sl, i) => {
    const btn = els.sk[i], sk = SKILLS[sl.id];
    const cd = s.skillCd[sl.id] || 0, on = (s.buffs[sl.id] || 0) > 0;
    const key = `${sl.id}|${sl.locked}|${Math.ceil(cd)}|${on}`;
    if (cache['sk' + i] !== key) {
      cache['sk' + i] = key;
      btn.firstChild.textContent = sl.locked && sl.sig ? '❔' : sk.icon;
      btn.lastChild.textContent = sl.locked ? sl.lock : cd > 0 ? Math.ceil(cd) + 's' : '';
      btn.classList.toggle('locked', sl.locked);
      btn.classList.toggle('ready', !sl.locked && cd <= 0);
      btn.classList.toggle('on', on);
    }
    btn.children[1].style.setProperty('--p', sl.locked ? 0 : cd / (sk.cd * st.cdMult));
  });
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
    let h = questsHTML() + segX();
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
    h += `<h3>Skills</h3><div class="skl">${skillSlots(s).map(sl => {
      const sk = SKILLS[sl.id];
      return `<div class="row${sl.locked ? ' dim' : ''}"><div class="ic">${sl.locked && sl.sig ? '❔' : sk.icon}</div><div class="info"><b>${sl.locked && sl.sig ? 'Signature move' : sk.name}</b><small>${sl.locked ? '🔒 ' + lockText(sl) : sk.cd + 's cooldown'}</small>
        <div class="desc">${sl.locked && sl.sig ? 'Each evolution branch has its own move: Earthshaker (Power), Flurry (Swift) or Midas Spell (Mystic).' : sk.desc}</div></div></div>`;
    }).join('')}</div>`;
    const bl = blessingSummary(s);
    h += `<h3>Blessings this run</h3>` + (bl.length ? `<div class="blist">${bl.map(({ b, n }) => `<span class="bchip${b.risky ? ' risky' : ''}">${b.icon} ${b.name}${n > 1 ? ' ×' + n : ''}<small>${b.desc}</small></span>`).join('')}</div>`
      : `<p class="muted">Beat a big boss (every 10th stage) to choose a blessing. They last until you prestige.</p>`);
    h += `<h3>Evolution path</h3>` + treeHTML(s.animal, s.level);
    return h;
  },

  items() {
    const s = G.s;
    const base = computeStats(s);
    let h = `<div class="equip">`;
    for (const sl of SLOTS) {
      const it = itemById(s, s.equipped[sl]), info = SLOT_INFO[sl];
      h += `<div class="slot${it ? ' filled' : ''}" ${it ? `data-act="item" data-id="${it.id}" style="--rc:${RARITIES[it.rarity].color}"` : ''}>
        <div class="slab">${info.icon} ${info.name}</div>
        ${it ? `${itemTile(it, base, true)}<div class="sname" style="color:${rc(it)}">${it.name}</div>` : `<div class="sempty">${info.icon}</div><div class="sname muted">Empty</div>`}
        <div class="smain">${info.main}</div></div>`;
    }
    h += `</div>`;
    const tot = gearTotals(s);
    const chips = Object.entries(tot).map(([k, v]) => `<span class="gchip">${STAT_ICON[k] || '•'} ${fmtStat(k, v)} ${STAT_NAMES[k].toLowerCase()}</span>`).join('');
    h += `<div class="gear"><b>Your gear gives</b>${chips || '<span class="muted">nothing yet. Equip something!</span>'}</div>`;
    const eq = new Set(Object.values(s.equipped));
    const spare = s.items.filter(i => !eq.has(i.id));
    const ups = spare.map(it => ({ it, c: itemCompare(s, it, base) }));
    const nUp = ups.filter(u => u.c.value > 0.002).length;
    h += `<div class="mbtns"><button class="btn${nUp ? ' glow' : ''}" data-act="equipBest" ${nUp ? '' : 'disabled'}>⬆ Equip best${nUp ? `<small>${nUp} upgrade${nUp > 1 ? 's' : ''} found</small>` : '<small>all set!</small>'}</button></div>`;
    h += `<h3>Backpack <small class="muted">(${s.items.length}/60) · ▲ = better than what you wear</small></h3>`;
    ups.sort((a, b) => (b.c.value > 0.002) - (a.c.value > 0.002) || SLOTS.indexOf(a.it.slot) - SLOTS.indexOf(b.it.slot) || b.it.rarity - a.it.rarity || b.it.ilvl - a.it.ilvl);
    if (!ups.length) h += `<p class="muted">Defeat monsters to find loot. Bosses drop more, gift balloons sometimes do, and treasure mimics always do!</p>`;
    h += `<div class="inv">${ups.map(({ it, c }) => `<button class="it" style="--rc:${RARITIES[it.rarity].color}" data-act="item" data-id="${it.id}">${itemTile(it, base, false, c)}</button>`).join('')}</div>`;
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

  talents() {
    const s = G.s;
    const br = G.talentBr || 'might';
    const pctx = k => Math.round(SP_CHANCE[k] * 100) + '%';
    let h = `<div class="sphead"><div><h2 style="margin:0">🌳 Talents</h2><div class="muted">Spent ${talentsSpent(s)} · found ${s.spTotal} all time</div></div>
      <div class="spcount">🌟 <b>${s.sp}</b><small>skill points</small></div></div>
      <p class="muted" style="font-size:12px;margin:4px 0 8px">Bosses (${pctx('boss')}), big bosses (${pctx('bigboss')}, always on a new best stage), mimics and gem slimes (${pctx('mimic')}) can drop skill points. Deeper rows cost more and open as you invest in a branch. Talents stay through prestige.</p>`;
    h += `<div class="seg tbr">${TALENT_BRANCHES.map(b => `<button data-act="talentBr" data-br="${b.id}" class="${br === b.id ? 'on' : ''}" style="${br === b.id ? `background:${b.color}` : ''}">${b.icon} ${b.name}<small>${branchSpent(s, b.id)}</small></button>`).join('')}</div>`;
    const spent = branchSpent(s, br);
    const bdef = TALENT_BRANCHES.find(b => b.id === br);
    TALENT_ROWS.forEach((row, ri) => {
      const open = talentRowOpen(s, br, ri);
      h += `<div class="trowhead${open ? '' : ' locked'}"><span>${['I', 'II', 'III', 'IV', 'V'][ri]}</span>${open ? `${row.cost} 🌟 per rank` : `🔒 Spend ${row.need - spent} more in ${bdef.name}`}</div><div class="trow">`;
      for (const t of TALENTS.filter(t => t.br === br && t.row === ri)) {
        const r = talentRank(s, t.id), maxed = r >= t.max;
        const pips = t.max > 1 ? `<div class="pips">${Array.from({ length: t.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div>` : '';
        const now = t.max > 1 && r > 0 ? `<div class="now">Now: ${t.desc(talentVal(s, t.id))}</div>` : '';
        const what = t.max > 1 ? `${t.desc(t.v)} per rank` : t.desc(t.v);
        h += `<div class="tnode${open ? '' : ' locked'}${r ? ' has' : ''}${maxed ? ' maxed' : ''}" style="--bc:${bdef.color}">
          <div class="tt"><span class="ti">${t.icon}</span><b>${t.name}</b></div>${pips}<div class="desc">${what}</div>${now}
          ${maxed ? '<button class="btn" disabled>MAX</button>' : `<button class="btn" data-act="learn" data-id="${t.id}" ${canLearn(s, t.id) ? '' : 'disabled'}>Learn<small>🌟 ${talentCost(t)}</small></button>`}</div>`;
      }
      h += `</div>`;
    });
    h += `<div class="mbtns"><button class="btn gem" data-act="talentReset" ${!talentsSpent(s) || s.gems < GEM_COSTS.talentReset ? 'disabled' : ''}>Reset talent tree<small>💎 ${GEM_COSTS.talentReset} · refunds all points</small></button></div>`;
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
const SLOT_INFO = {
  weapon: { icon: '⚔️', name: 'Weapon', main: 'Main: damage' },
  armor: { icon: '🛡️', name: 'Outfit', main: 'Main: gold' },
  charm: { icon: '🍀', name: 'Charm', main: 'Main: a special bonus' },
};
const STAT_ICON = { dmg: '⚔️', gold: '🪙', critChance: '🎯', critDmg: '💥', speed: '💨', tap: '👆', xp: '📚', boss: '👑', luck: '🍀' };
const rc = it => RARITIES[it.rarity].color === '#c8c8c8' ? 'inherit' : RARITIES[it.rarity].color;
function itemTile(it, base, plain, cmp) {
  const lv = `<span class="il">${it.ilvl}</span>`;
  if (plain) return `<div class="it big" style="--rc:${RARITIES[it.rarity].color}">${itemIcon(it)}${lv}</div>`;
  const up = (cmp || itemCompare(G.s, it, base)).value > 0.002;
  return itemIcon(it) + lv + (it.locked ? '<span class="lk">🔒</span>' : '') + (it.isNew ? '<span class="nw"></span>' : '') + (up ? '<span class="up">▲</span>' : '');
}
function pctChip(label, v) {
  if (Math.abs(v) < 0.0005) return `<span class="dchip">${label} <b>±0%</b></span>`;
  const t = Math.abs(v) >= 10 ? fmtNum(Math.abs(v) * 100) : (Math.abs(v) * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0);
  return `<span class="dchip ${v > 0 ? 'pos' : 'neg'}">${label} <b>${v > 0 ? '▲ +' : '▼ −'}${t}%</b></span>`;
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
    rows += `<div class="statline"><span>${STAT_ICON[k] || ''} ${STAT_NAMES[k]}</span><b>${v ? fmtStat(k, v) : '—'}${cv != null ? ` <small class="muted">(now ${cv ? fmtStat(k, cv) : '—'})</small>` : ''}${diff}</b></div>`;
  }
  let verdict = '';
  if (!isEq) {
    const c = itemCompare(s, it);
    const good = c.value > 0.002, bad = c.value < -0.002;
    verdict = `<div class="verdict ${good ? 'pos' : bad ? 'neg' : ''}"><div class="vh">${good ? '⬆ Upgrade!' : bad ? '⬇ Worse than ' + (cur ? 'your ' + cur.name : 'nothing') : '≈ About the same'}</div>
      <div class="vrow">${pctChip('Idle DPS', c.dps)}${pctChip('Tap', c.tap)}${pctChip('Gold', c.gold)}</div>
      <small class="muted">What changes for you if you equip it${cur ? ' instead of ' + cur.name : ''}.</small></div>`;
  }
  modal(`<div style="text-align:center">${itemTile(it, null, true)}<h2 style="color:${rc(it)};margin:4px 0">${it.name}</h2>
    <div class="muted">${r.name} ${SLOT_INFO[it.slot].name.toLowerCase()} · item level ${it.ilvl}${isEq ? ' · <b>equipped</b>' : ''}</div></div>
    ${verdict}
    <div class="stats" style="display:block"><div class="statline"><b>What it does</b></div>${rows}</div>
    <div class="mbtns">
      ${isEq ? '' : `<button class="btn" data-act="equip" data-id="${it.id}">Equip</button>`}
      <button class="btn" data-act="lock" data-id="${it.id}">${it.locked ? 'Unlock' : 'Lock'}</button>
      ${isEq || it.locked ? '' : `<button class="btn warn" data-act="sell" data-id="${it.id}">Sell<small>🪙 ${fmtNum(sellValue(s, it))}</small></button>`}
    </div>`);
}

function lockText(sl) {
  if (sl.id === 'strike') return `unlocks at level ${STRIKE_LEVEL}`;
  if (sl.sig) return 'unlocks when you evolve (level 25)';
  return 'recruit a pal to unlock';
}

function questsHTML() {
  const s = G.s;
  let h = `<div class="quests"><div class="qh">📜 Quests <small class="muted">${s.questsDone} done · ↻ swaps one for 💎 ${QUEST_REROLL_GEMS}</small></div>`;
  s.quests.forEach((q, i) => {
    const done = q.have >= q.n;
    const rw = q.reward.sp ? '🌟 1' : q.reward.gems ? `💎 ${q.reward.gems}` : `🪙 ${fmtNum(questGold(s, q))}`;
    h += `<div class="q${done ? ' done' : ''}"><div class="qt"><span>${questText(q)}</span><div class="qbar"><i style="width:${(100 * q.have / q.n).toFixed(1)}%"></i><em>${fmtNum(q.have)} / ${fmtNum(q.n)}</em></div></div>
      ${done ? `<button class="btn" data-act="claimQuest" data-i="${i}">Claim<small>${rw}</small></button>` : `<div class="qr">${rw}</div><button class="rr" data-act="rerollQuest" data-i="${i}" ${s.gems < QUEST_REROLL_GEMS ? 'disabled' : ''}>↻</button>`}</div>`;
  });
  return h + `</div>`;
}

export function blessModal() {
  const s = G.s;
  if (!s.blessOffer) return;
  modal(`<h2>🎁 Choose a blessing</h2><p style="text-align:center;margin-top:0">The big boss is down! Pick one boon for the rest of this run${s.blessPending > 1 ? ` (${s.blessPending} to pick)` : ''}. Blessings stack and reset when you prestige.</p>
    <div class="cards">${s.blessOffer.map((id, i) => {
      const b = BLESS[id], n = s.blessings.filter(x => x === id).length;
      return `<div class="card bless${b.risky ? ' risky' : ''}"><div class="bi">${b.icon}</div><b>${b.name}</b><span>${b.desc}</span>${b.risky ? '<span class="risk">⚠ Risky</span>' : ''}${n ? `<span class="muted">You have ×${n}</span>` : ''}
        <button class="btn" data-act="blessPick" data-i="${i}">Choose</button></div>`;
    }).join('')}</div>
    <div class="mbtns"><button class="btn warn" data-act="close">Later</button><button class="btn gem" data-act="blessReroll" ${s.gems < BLESS_REROLL_GEMS ? 'disabled' : ''}>Reroll<small>💎 ${BLESS_REROLL_GEMS}</small></button></div>`);
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
    <span>Items found</span><b>${items}</b>${sum.gems ? `<span>Gems</span><b>💎 ${sum.gems}</b>` : ''}${sum.sp ? `<span>Skill points</span><b>🌟 ${sum.sp}</b>` : ''}${sum.blessings ? `<span>Blessings to choose</span><b>🎁 ${sum.blessings}</b>` : ''}</div>
    ${sum.farmStage ? `<p class="muted" style="font-size:12px">Your hero couldn't beat the monsters here without your taps, so they farmed stage ${sum.farmStage} instead.</p>` : ''}
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
  talentBr(d) { G.talentBr = d.br; },
  skill(d) {
    const sl = skillSlots(G.s)[+d.slot];
    if (sl.locked) return toast(`🔒 ${sl.sig ? 'Your signature move' : SKILLS[sl.id].name}: ${lockText(sl)}`);
    if (!G.battle.useSkill(sl.id)) return;
  },
  openBless() { blessModal(); },
  blessPick(d) {
    const b = pickBlessing(G.s, +d.i);
    if (!b) return closeModal();
    sfx.level(); vib(20); G.battle.refresh(); G.save();
    toast(`${b.icon} <b>${b.name}</b>: ${b.desc}`);
    if (G.s.blessPending > 0) blessModal(); else closeModal();
  },
  blessReroll() { if (rerollBlessings(G.s)) { sfx.buy(); blessModal(); } },
  claimQuest(d) {
    const got = claimQuest(G.s, +d.i);
    if (!got) return;
    sfx.loot(); vib(20); G.save();
    toast(`📜 Quest reward: ${got.sp ? '🌟 1 skill point' : got.gems ? `💎 ${got.gems}` : `🪙 ${fmtNum(got.gold)}`}`);
  },
  rerollQuest(d) { if (rerollQuest(G.s, +d.i)) sfx.buy(); },
  equipBest() {
    const n = equipBest(G.s);
    if (!n) return;
    G.battle.refresh(); sfx.buy(); G.save(); toast('⬆ Equipped your best gear');
  },
  learn(d) {
    if (!learnTalent(G.s, d.id)) return;
    sfx.level(); vib(15); G.battle.refresh(); G.save();
  },
  talentReset() {
    modal(`<h2>Reset talents?</h2><p>All ${talentsSpent(G.s)} spent skill points come back so you can plan a new build.</p>
      <div class="mbtns"><button class="btn warn" data-act="close">Cancel</button><button class="btn gem" data-act="talentResetYes">Spend 💎 ${GEM_COSTS.talentReset}</button></div>`);
  },
  talentResetYes() {
    if (!resetTalents(G.s)) return;
    closeModal(); G.battle.refresh(); G.save(); toast('🌳 Talent tree reset');
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
