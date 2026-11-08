// Pure game logic: state, formulas, battle simulation. No DOM here (runs in Node for balance sims).
import {
  ANIMALS, FORMS, EVO_LEVELS, BIOMES, BOSSES, SPECIALS, UPGRADES, PERKS, RARITIES, SLOTS, ITEM_BASES,
  PREFIXES, AFFIXES, COMPANION_STAGE, PRESTIGE_STAGE, GEM_COSTS,
} from './data.js';

// Balance knobs (tools/sim.mjs can override them: node tools/sim.mjs 3 5 '{"hpGrowth":1.6}')
export const TUNE = {
  hpGrowth: 1.55, hpLate: 1.02, hpLateStart: 20, goldGrowth: 1.4, goldBase: 1.5,
  levelMult: 1.04, compBase: 0.15, compPer: 0.02, sdExp: 1.7, sdPer: 0.01, spirit: 0.5,
};
export const BOSS_TIME = 30;
export const WAVES = 10;
const MAX_ITEMS = 60;

// ---------------------------------------------------------------- state
export function newState(animal) {
  const s = {
    v: 1, animal, created: Date.now(), lastSeen: Date.now(),
    gold: 0, gems: 0, stardust: 0, stardustTotal: 0,
    stage: 1, wave: 1, maxStage: 1, bestStage: 1, farming: false, failRatio: 0,
    level: 1, xp: 0,
    upg: Object.fromEntries(UPGRADES.map(u => [u.id, 0])),
    perks: Object.fromEntries(PERKS.map(p => [p.id, 0])),
    evo: Object.fromEntries(Object.keys(ANIMALS).map(a => [a, [null, null]])),
    companion: { animal: null, level: 0 },
    items: [], equipped: { weapon: null, armor: null, charm: null }, nextItemId: 1,
    stats: { kills: 0, bossKills: 0, taps: 0, prestiges: 0, goldEarned: 0, playTime: 0 },
    settings: { autoSell: 0, vibrate: true, sound: true },
    frenzy: 0, frenzyT: 0,
    gemMilestone: 0,
  };
  return s;
}

// Fill in fields added in later versions.
export function migrate(s) {
  const d = newState(s.animal || 'kitten');
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  for (const k of ['upg', 'perks', 'evo', 'settings', 'stats', 'equipped']) {
    for (const kk of Object.keys(d[k])) if (s[k][kk] === undefined) s[k][kk] = d[k][kk];
  }
  return s;
}

// ---------------------------------------------------------------- forms / evolution
export function tierFor(level, evo) {
  if (level >= EVO_LEVELS[1] && evo[0] != null && evo[1] != null) return 2;
  if (level >= EVO_LEVELS[0] && evo[0] != null) return 1;
  return 0;
}
export function formId(animal, evo, tier) {
  const a = ANIMALS[animal];
  if (tier === 0) return a.base.id;
  const b = a.branches[evo[0]];
  if (tier === 1) return b.id;
  return b.children[evo[1]].id;
}
export function heroForm(s) { return FORMS[formId(s.animal, s.evo[s.animal], tierFor(s.level, s.evo[s.animal]))]; }
export function companionForm(s) {
  const c = s.companion;
  if (!c.animal) return null;
  return FORMS[formId(c.animal, s.evo[c.animal], tierFor(c.level, s.evo[c.animal]))];
}
// Which evolution choice is pending for the given animal at that level (0/1) or -1.
export function pendingEvo(animal, level, s) {
  const e = s.evo[animal];
  if (level >= EVO_LEVELS[0] && e[0] == null) return 0;
  if (level >= EVO_LEVELS[1] && e[1] == null) return 1;
  return -1;
}
export function companionUnlocked(s) { return s.bestStage >= COMPANION_STAGE; }

// ---------------------------------------------------------------- monsters
export function biomeIndex(stage) { return Math.floor((stage - 1) / 10) % BIOMES.length; }
export function biome(stage) { return BIOMES[biomeIndex(stage)]; }
export function isBigBossStage(stage) { return stage % 10 === 0; }

export function baseHp(stage) {
  let hp = 10 * Math.pow(TUNE.hpGrowth, stage - 1);
  if (stage > TUNE.hpLateStart) hp *= Math.pow(TUNE.hpLate, stage - TUNE.hpLateStart);
  if (stage > 120) hp *= Math.pow(1.04, stage - 120);
  return hp;
}
export function monsterHp(stage, wave, kind) {
  let hp = baseHp(stage) * (1 + 0.05 * (wave - 1));
  if (kind === 'boss') hp *= 6;
  if (kind === 'bigboss') hp *= 10;
  if (kind === 'gem' || kind === 'mimic') hp *= 2;
  return hp;
}
export function monsterGold(stage, kind) {
  let g = TUNE.goldBase * Math.pow(TUNE.goldGrowth, stage - 1);
  if (kind === 'boss') g *= 5;
  if (kind === 'bigboss') g *= 9;
  if (kind === 'mimic') g *= 4;
  return Math.max(1, g);
}
export function monsterXp(stage, kind) {
  let x = 2 * Math.pow(1.105, stage - 1);
  if (kind === 'boss') x *= 6;
  if (kind === 'bigboss') x *= 12;
  return x;
}
export function xpToNext(level) { return 12 * Math.pow(1.115, level - 1); }

export function makeMonster(stage, wave, rand = Math.random) {
  const b = biome(stage);
  let kind = 'normal';
  if (wave === WAVES) kind = isBigBossStage(stage) ? 'bigboss' : 'boss';
  else if (rand() < 0.0015) kind = 'gem';
  else if (rand() < 0.01) kind = 'mimic';
  let name, col, cell, scale = 1;
  const bi = biomeIndex(stage);
  if (kind === 'bigboss') {
    const bossIdx = (stage / 10 - 1) % BOSSES.length;
    [name, col] = BOSSES[bossIdx];
    cell = bossIdx; scale = 1.6;
  } else if (kind === 'gem' || kind === 'mimic') {
    const sp = kind === 'gem' ? SPECIALS.gemSlime : SPECIALS.mimic;
    name = sp.name; col = sp.col; cell = sp.cell;
  } else {
    const mi = kind === 'boss' ? (stage % 6) : Math.floor(rand() * 6);
    [name, col] = b.monsters[mi];
    cell = bi * 6 + mi;
    if (kind === 'boss') { name = 'Big ' + name; scale = 1.35; }
  }
  const hp = monsterHp(stage, wave, kind);
  return { name, col, cell, kind, hp, maxHp: hp, scale, big: kind === 'bigboss' };
}

// ---------------------------------------------------------------- items
export function itemById(s, id) { return s.items.find(i => i.id === id); }
export function equippedItems(s) { return SLOTS.map(sl => itemById(s, s.equipped[sl])).filter(Boolean); }

export function itemPrimary(slot, ilvl, mult) {
  if (slot === 'weapon') return { stat: 'dmg', v: 0.03 * ilvl * mult + 0.1 * mult };
  if (slot === 'armor') return { stat: 'gold', v: 0.03 * ilvl * mult + 0.05 * mult };
  return null; // charm: primary is a doubled affix
}
export const STAT_NAMES = { dmg: 'Damage', ...Object.fromEntries(Object.entries(AFFIXES).map(([k, a]) => [k, a.name])) };
export function fmtStat(stat, v) {
  if (stat === 'dmg') return `+${fmtPct(v)}`;
  return AFFIXES[stat].fmt(v);
}
function fmtPct(v) { return v >= 10 ? `${fmtNum(v * 100)}%` : `${Math.round(v * 100)}%`; }

function rollRarity(luck, rand, minRarity = 0) {
  const ws = RARITIES.map((r, i) => i < minRarity ? 0 : r.weight * Math.pow(1 + luck, i));
  let t = rand() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) { t -= ws[i]; if (t <= 0) return i; }
  return ws.length - 1;
}

export function rollItem(s, ilvl, luck, rand = Math.random, minRarity = 0) {
  const slot = SLOTS[Math.floor(rand() * 3)];
  const r = rollRarity(luck, rand, minRarity);
  const rar = RARITIES[r];
  // Better bases unlock with item level.
  const bases = ITEM_BASES[slot];
  const maxBase = Math.min(bases.length - 1, Math.floor(ilvl / 12) + r);
  const bi = Math.max(0, maxBase - Math.floor(rand() * 3));
  const [baseName, icon] = bases[bi];
  const stats = {};
  const prim = itemPrimary(slot, ilvl, rar.mult);
  if (prim) stats[prim.stat] = prim.v;
  const keys = Object.keys(AFFIXES);
  let nAff = rar.affixes + (slot === 'charm' ? 1 : 0);
  const pool = keys.slice();
  for (let n = 0; n < nAff && pool.length; n++) {
    const k = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const mul = (slot === 'charm' && n === 0) ? 2 : 1;
    stats[k] = (stats[k] || 0) + AFFIXES[k].roll(ilvl, rar.mult) * mul * (0.8 + rand() * 0.4);
  }
  const prefix = r >= 1 ? PREFIXES[Math.min(PREFIXES.length - 1, Math.floor(rand() * 4) + r * 1.5 | 0)] + ' ' : '';
  return { id: s.nextItemId++, slot, rarity: r, ilvl, name: prefix + baseName, icon, stats, locked: false, isNew: true };
}

// Rough single-number score for comparing items within a slot.
export function itemScore(it) {
  let sc = 0;
  for (const [k, v] of Object.entries(it.stats)) {
    const w = { dmg: 1, gold: 0.5, critChance: 8, critDmg: 0.8, speed: 4, tap: 0.6, xp: 0.3, boss: 0.6, luck: 0.8 }[k] || 0.5;
    sc += v * w;
  }
  return sc;
}
export function sellValue(s, it) { return monsterGold(Math.max(1, Math.min(it.ilvl, s.maxStage)), 'normal') * 3 * RARITIES[it.rarity].mult; }

export function addItem(s, it) {
  if (it.rarity < s.settings.autoSell) return { sold: true, gold: sellValue(s, it) };
  // Auto-equip into empty slot.
  if (!s.equipped[it.slot]) { s.items.push(it); s.equipped[it.slot] = it.id; return { equipped: true }; }
  if (s.items.length >= MAX_ITEMS) {
    // Sell the worst unlocked, unequipped item to make room (or the new one if it's the worst).
    const eq = new Set(Object.values(s.equipped));
    const cand = s.items.filter(i => !i.locked && !eq.has(i.id)).sort((a, b) => itemScore(a) - itemScore(b))[0];
    if (!cand || itemScore(cand) > itemScore(it)) return { sold: true, gold: sellValue(s, it) };
    s.items.splice(s.items.indexOf(cand), 1);
    s.gold += sellValue(s, cand);
  }
  s.items.push(it);
  return {};
}

// ---------------------------------------------------------------- upgrades
export function upgCost(u, lvl) { return u.base * Math.pow(u.growth, lvl); }
export function upgCostN(u, lvl, n) {
  // geometric series
  const g = u.growth;
  return u.base * Math.pow(g, lvl) * (Math.pow(g, n) - 1) / (g - 1);
}
export function upgMaxAffordable(u, lvl, gold) {
  const g = u.growth;
  let n = Math.floor(Math.log(gold * (g - 1) / (u.base * Math.pow(g, lvl)) + 1) / Math.log(g));
  if (u.max != null) n = Math.min(n, u.max - lvl);
  return Math.max(0, n);
}
export function perkCost(p, lvl) { return Math.ceil(p.base * Math.pow(p.growth, lvl)); }

export function companionCost(lvl) { return 1e9 * Math.pow(1.1, lvl); }

// ---------------------------------------------------------------- stats
const TIER_MULT = [1, 3, 10];

function traitsOf(s) {
  const out = [];
  const hf = heroForm(s); if (hf.trait) out.push(hf.trait);
  const cf = companionForm(s); if (cf && cf.trait) out.push(cf.trait);
  return out;
}

export function computeStats(s) {
  const hf = heroForm(s);
  const passive = ANIMALS[s.animal].passive;
  const traits = traitsOf(s);
  const has = t => traits.filter(x => x === t).length;
  const item = { dmg: 0, gold: 0, critChance: 0, critDmg: 0, speed: 0, tap: 0, xp: 0, boss: 0, luck: 0 };
  for (const it of equippedItems(s)) for (const [k, v] of Object.entries(it.stats)) item[k] += v;
  const P = s.perks, U = s.upg;
  const frenzy = s.frenzyT > 0;

  const arch = hf.tier >= 1 ? hf.arch : null;
  let hit = (1 + U.dmg) * Math.pow(2, Math.floor(U.dmg / 25));
  hit *= Math.pow(TUNE.levelMult, s.level - 1);
  hit *= TIER_MULT[hf.tier];
  if (arch === 'power') hit *= 1.5;
  hit *= Math.pow(1.8, has('heavy')) * Math.pow(1.2, has('cleave'));
  hit *= 1 + TUNE.spirit * P.spirit;
  hit *= 1 + TUNE.sdPer * s.stardustTotal;
  hit *= 1 + item.dmg;

  let aps = 1 * (1 + 0.05 * U.speed) * (1 + item.speed);
  if (arch === 'swift') aps *= 1.25;
  aps *= Math.pow(1.4, has('haste'));
  if (frenzy) aps *= 2;
  aps = Math.min(aps, 12);

  let critChance = 0.03 + 0.01 * U.crit + (passive.critChance || 0) + item.critChance + 0.12 * has('precision');
  if (arch === 'swift') critChance += 0.05;
  critChance = Math.min(0.75, critChance);
  const critMult = 2 + 0.1 * U.critd + item.critDmg + 1.5 * has('precision');

  let tapHit = hit * 0.6 * (1 + 0.15 * U.tap) * (1 + 0.4 * P.tapm) * (1 + item.tap);
  if (arch === 'mystic') tapHit *= 2;
  tapHit *= Math.pow(3, has('storm'));
  if (frenzy) tapHit *= 2;

  let gold = (1 + 0.15 * U.gold) * (1 + (passive.gold || 0)) * (1 + 0.3 * P.paws) * (1 + item.gold);
  if (arch === 'mystic') gold *= 1.25;
  gold *= Math.pow(2, has('midas'));

  const xp = (1 + 0.3 * P.wise) * (1 + item.xp);
  let boss = (1 + (passive.boss || 0) + item.boss) * Math.pow(2.5, has('bossSlayer'));
  const luckLv = 0.2 * P.luck + item.luck + (has('lucky') ? 0.6 : 0);
  const lootMult = (1 + 0.2 * P.luck) * Math.pow(2, has('lucky'));
  const gemMult = Math.pow(2, has('lucky'));

  // companion
  let compHit = 0, compAps = 1.2;
  const cf = companionForm(s);
  if (cf) {
    const lv = s.companion.level;
    let cdps = hit * aps * (TUNE.compBase + TUNE.compPer * lv);
    cdps *= [1, 1.6, 2.8][cf.tier];
    if (cf.tier >= 1 && cf.arch === 'power') cdps *= 1.4;
    if (cf.tier >= 1 && cf.arch === 'swift') compAps = 1.6;
    cdps *= 1 + 0.5 * P.pack;
    if (frenzy) cdps *= 2;
    compHit = cdps / compAps;
  }

  const expCrit = 1 + critChance * (critMult - 1);
  const doubleChance = has('double') ? 0.25 : 0;
  const autoDps = hit * aps * expCrit * (1 + doubleChance) + compHit * compAps;
  return {
    hit, aps, critChance, critMult, tapHit, gold, xp, boss, luck: luckLv, lootMult, gemMult,
    compHit, compAps, doubleChance, cleave: has('cleave') > 0,
    bossTime: BOSS_TIME + 3 * P.boss, autoDps, tapDps: tapHit * expCrit,
    offlineCapH: 8 + 2 * P.nap,
  };
}

// ---------------------------------------------------------------- prestige
export function stardustGain(s) {
  if (s.maxStage < PRESTIGE_STAGE) return 0;
  return Math.floor(Math.pow((s.maxStage - 20) / 5, TUNE.sdExp));
}
export function startStage(s) { return 1 + 5 * s.perks.start; }

export function doPrestige(s, newAnimal) {
  const gain = stardustGain(s);
  if (gain <= 0) return 0;
  s.stardust += gain; s.stardustTotal += gain;
  s.stats.prestiges++;
  if (newAnimal && newAnimal !== s.animal) {
    if (s.companion.animal === newAnimal) s.companion.animal = s.animal;
    s.animal = newAnimal;
  }
  s.gold = 0; s.level = 1; s.xp = 0;
  s.stage = startStage(s); s.wave = 1; s.maxStage = s.stage; s.farming = false; s.failRatio = 0;
  for (const k of Object.keys(s.upg)) s.upg[k] = 0;
  s.companion.level = s.companion.animal ? 1 : 0;
  s.frenzy = 0; s.frenzyT = 0;
  return gain;
}

// ---------------------------------------------------------------- gems
export function respecCost(which) { return which === 0 ? GEM_COSTS.respecBranch : GEM_COSTS.respecLeaf; }
export function doRespec(s, animal, which) {
  const cost = respecCost(which);
  if (s.gems < cost) return false;
  s.gems -= cost;
  if (which === 0) s.evo[animal] = [null, null];
  else s.evo[animal][1] = null;
  return true;
}

// ---------------------------------------------------------------- XP / level
export function addXp(s, amount, events) {
  s.xp += amount;
  let n = 0;
  while (s.xp >= xpToNext(s.level) && n < 1000) {
    s.xp -= xpToNext(s.level); s.level++; n++;
    events && events.push({ type: 'levelup', level: s.level });
    if (EVO_LEVELS.includes(s.level)) events && events.push({ type: 'evo', who: 'hero' });
  }
}

// ---------------------------------------------------------------- battle
// The battle holds transient state (current monster, timers). Persistent progress lives in `s`.
export class Battle {
  constructor(s, rand = Math.random) {
    this.s = s; this.rand = rand;
    this.events = [];
    this.stats = computeStats(s);
    this.dirtyStats = false;
    this.phase = 'walk'; this.phaseT = 0.6;
    this.atkT = 0; this.compT = 0.3;
    this.bossLeft = 0;
    this.monster = null;
    this.carry = 0;
    this.spawn();
  }
  refresh() { this.stats = computeStats(this.s); }

  spawn() {
    const s = this.s;
    if (s.farming && s.wave >= WAVES) s.wave = 1;
    this.monster = makeMonster(s.stage, s.wave, this.rand);
    if (this.carry > 0 && this.monster.kind === 'normal') this.monster.hp -= Math.min(this.carry, this.monster.hp * 0.95);
    this.carry = 0;
  }

  isBoss() { const k = this.monster.kind; return k === 'boss' || k === 'bigboss'; }

  damage(amount, src, crit) {
    const m = this.monster;
    if (!m || this.phase !== 'fight') return;
    if (m.hp <= 0) { this.kill(); return; }
    if (this.isBoss()) amount *= this.stats.boss;
    m.hp -= amount;
    this.events.push({ type: 'hit', dmg: amount, src, crit });
    if (m.hp <= 0) {
      if (this.stats.cleave && !this.isBoss()) this.carry = -m.hp;
      this.kill();
    }
  }

  rollHit(base) {
    const st = this.stats;
    const crit = this.rand() < st.critChance;
    return { dmg: base * (crit ? st.critMult : 1), crit };
  }

  tap() {
    const s = this.s;
    s.stats.taps++;
    if (this.phase !== 'fight') { this.phaseT = Math.max(0, this.phaseT - 0.12); return; }
    const { dmg, crit } = this.rollHit(this.stats.tapHit);
    this.damage(dmg, 'tap', crit);
  }

  kill() {
    const s = this.s, m = this.monster, st = this.stats;
    s.stats.kills++;
    const boss = this.isBoss();
    if (boss) s.stats.bossKills++;
    const gold = monsterGold(s.stage, m.kind) * st.gold;
    s.gold += gold; s.stats.goldEarned += gold;
    this.events.push({ type: 'kill', gold, kind: m.kind, monster: m });
    addXp(s, monsterXp(s.stage, m.kind) * st.xp, this.events);
    if (s.frenzyT <= 0) s.frenzy = Math.min(FRENZY_KILLS, s.frenzy + 1);

    // gems
    let gems = 0;
    if (m.kind === 'gem') gems += 1 + Math.floor(this.rand() * 2);
    if (boss && this.rand() < 0.03 * st.gemMult) gems += 1;
    if (gems) { s.gems += gems; this.events.push({ type: 'gems', n: gems }); }

    // loot
    let chance = (m.kind === 'bigboss' ? 1 : boss ? 0.3 : m.kind === 'mimic' ? 1 : 0.02) * st.lootMult;
    while (chance > 0) {
      if (this.rand() < chance) {
        const it = rollItem(s, s.stage, st.luck, this.rand, m.kind === 'mimic' || m.kind === 'bigboss' ? 1 : 0);
        const res = addItem(s, it);
        if (res.sold) s.gold += res.gold;
        this.events.push({ type: 'loot', item: it, ...res });
        if (res.equipped) this.dirtyStats = true;
      }
      chance -= 1;
    }

    // advance
    if (boss) {
      s.stage++; s.wave = 1; s.farming = false; s.failRatio = 0;
      if (s.stage > s.maxStage) s.maxStage = s.stage;
      if (s.stage > s.bestStage) {
        s.bestStage = s.stage;
        // Gem milestone every 10 stages, first time ever.
        const ms = Math.floor((s.stage - 1) / 10);
        if (ms > s.gemMilestone) {
          const g = 2 + Math.floor(ms / 2); s.gems += g; s.gemMilestone = ms;
          this.events.push({ type: 'gems', n: g, milestone: true });
        }
        if (s.bestStage === COMPANION_STAGE) this.events.push({ type: 'companionUnlock' });
      }
      this.events.push({ type: 'stage', stage: s.stage });
    } else if (s.farming) {
      s.wave = s.wave >= WAVES - 1 ? 1 : s.wave + 1;
      // Auto-retry the boss when we've grown enough.
      if (s.wave === 1 && this.shouldRetryBoss()) { s.farming = false; s.wave = WAVES; }
    } else {
      s.wave++;
    }
    this.phase = 'walk'; this.phaseT = 0.55;
    this.dirtyStats = true;
    this.spawn();
  }

  shouldRetryBoss() {
    const s = this.s;
    const kind = isBigBossStage(s.stage) ? 'bigboss' : 'boss';
    const need = monsterHp(s.stage, WAVES, kind) / this.stats.boss;
    return this.stats.autoDps * this.stats.bossTime * 0.9 >= need;
  }

  retryBoss() {
    const s = this.s;
    if (!s.farming) return;
    s.farming = false; s.wave = WAVES;
    this.phase = 'walk'; this.phaseT = 0.6;
    this.spawn();
  }

  bossFail() {
    const s = this.s, m = this.monster;
    s.failRatio = 1 - m.hp / m.maxHp;
    s.farming = true; s.wave = 1;
    this.events.push({ type: 'bossFail' });
    this.phase = 'walk'; this.phaseT = 0.8;
    this.spawn();
  }

  activateFrenzy() {
    const s = this.s;
    if (s.frenzy < FRENZY_KILLS || s.frenzyT > 0) return false;
    s.frenzy = 0; s.frenzyT = FRENZY_TIME;
    this.refresh();
    this.events.push({ type: 'frenzy' });
    return true;
  }

  step(dt) {
    const s = this.s;
    if (this.dirtyStats) { this.refresh(); this.dirtyStats = false; }
    if (s.frenzyT > 0) { s.frenzyT -= dt; if (s.frenzyT <= 0) { s.frenzyT = 0; this.refresh(); } }
    if (this.phase === 'walk') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.phase = 'fight';
        if (this.isBoss()) this.bossLeft = this.stats.bossTime;
        this.atkT = Math.min(this.atkT, 0.25);
      }
      return;
    }
    const st = this.stats;
    if (this.isBoss()) {
      this.bossLeft -= dt;
      if (this.bossLeft <= 0) { this.bossFail(); return; }
    }
    this.atkT -= dt;
    while (this.atkT <= 0 && this.phase === 'fight') {
      this.atkT += 1 / st.aps;
      const { dmg, crit } = this.rollHit(st.hit);
      this.events.push({ type: 'swing', src: 'hero' });
      this.damage(dmg, 'hero', crit);
      if (st.doubleChance && this.phase === 'fight' && this.rand() < st.doubleChance) {
        const h2 = this.rollHit(st.hit); this.damage(h2.dmg, 'hero', h2.crit);
      }
    }
    if (st.compHit > 0 && this.phase === 'fight') {
      this.compT -= dt;
      while (this.compT <= 0 && this.phase === 'fight') {
        this.compT += 1 / st.compAps;
        const { dmg, crit } = this.rollHit(st.compHit);
        this.events.push({ type: 'swing', src: 'comp' });
        this.damage(dmg, 'comp', crit);
      }
    }
  }
}
export const FRENZY_KILLS = 40;
export const FRENZY_TIME = 12;

// ---------------------------------------------------------------- offline progress
// Analytic-ish: walk stage by stage with auto DPS (no taps). Returns a summary.
export function simulateOffline(s, seconds, rand = Math.random) {
  const sum = { seconds, gold: 0, xp: 0, kills: 0, stages: 0, items: [], soldGold: 0, gems: 0, levels: 0, startStage: s.stage };
  const WALK = 0.55;
  let t = seconds;
  let guard = 0;
  const startLevel = s.level;
  while (t > 0 && guard++ < 5000) {
    const st = computeStats(s);
    const dps = st.autoDps;
    const stage = s.stage;
    const normHp = monsterHp(stage, 5, 'normal');
    const tNorm = Math.max(normHp / dps, 0.15) + WALK;
    const kind = isBigBossStage(stage) ? 'bigboss' : 'boss';
    const bossHp = monsterHp(stage, WAVES, kind) / st.boss;
    const canBoss = bossHp / dps <= st.bossTime * 0.95;
    let kills, bossKills = 0, dur;
    if (canBoss) {
      const wavesLeft = s.farming ? WAVES - 1 : WAVES - s.wave;
      kills = Math.max(0, wavesLeft);
      dur = kills * tNorm + bossHp / dps + WALK;
      if (dur > t) { // partial stage: farm what we can and stop
        kills = Math.floor(t / tNorm); dur = t; bossKills = 0;
        s.wave = Math.min(WAVES - 1, s.wave + kills);
      } else { bossKills = 1; }
    } else {
      // Farm the stage for the rest of the time (in chunks so levels/xp can make the boss beatable).
      const chunk = Math.min(t, 600);
      kills = Math.floor(chunk / tNorm); dur = chunk;
      s.farming = true;
    }
    const g = (kills * monsterGold(stage, 'normal') + bossKills * monsterGold(stage, kind)) * st.gold;
    const x = (kills * monsterXp(stage, 'normal') + bossKills * monsterXp(stage, kind)) * st.xp;
    s.gold += g; sum.gold += g; s.stats.goldEarned += g;
    sum.xp += x; addXp(s, x, null);
    s.stats.kills += kills + bossKills; sum.kills += kills + bossKills;
    // loot: expected count, roll individually up to a cap
    let drops = kills * 0.02 * st.lootMult + bossKills * (kind === 'bigboss' ? 1 : 0.3) * st.lootMult;
    let n = Math.floor(drops) + (rand() < drops % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const it = rollItem(s, stage, st.luck, rand, 0);
      const res = addItem(s, it);
      if (res.sold) { s.gold += res.gold; sum.soldGold += res.gold; }
      else sum.items.push(it);
    }
    if (bossKills) {
      s.stats.bossKills++;
      if (rand() < 0.03 * st.gemMult) { s.gems++; sum.gems++; }
      s.stage++; s.wave = 1; s.farming = false; sum.stages++;
      if (s.stage > s.maxStage) s.maxStage = s.stage;
      if (s.stage > s.bestStage) {
        s.bestStage = s.stage;
        const ms = Math.floor((s.stage - 1) / 10);
        if (ms > s.gemMilestone) { const gg = 2 + Math.floor(ms / 2); s.gems += gg; sum.gems += gg; s.gemMilestone = ms; }
      }
    }
    t -= dur;
    // Spend nothing automatically — the player gets to shop when they return.
    if (!canBoss && kills === 0) break;
  }
  sum.levels = s.level - startLevel;
  sum.endStage = s.stage;
  return sum;
}

// ---------------------------------------------------------------- number formatting
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function fmtNum(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmtNum(-n);
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
  const e = Math.floor(Math.log10(n) / 3);
  let suf;
  if (e < SUFFIX.length) suf = SUFFIX[e];
  else {
    const k = e - SUFFIX.length; // aa, ab, ...
    suf = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26);
  }
  const v = n / Math.pow(1000, e);
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + suf;
}
export function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
