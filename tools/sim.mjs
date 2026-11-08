// Balance sim: a bot plays the game (tapping + greedy upgrades + prestiges) and prints pacing.
// usage: node tools/sim.mjs [hours=6] [tapsPerSec=5]
import { newState, Battle, computeStats, upgCost, perkCost, companionCost, companionUnlocked, pendingEvo,
  stardustGain, doPrestige, itemScore, fmtNum, fmtTime, simulateOffline } from '../js/core.js';
import { UPGRADES, PERKS, PRESTIGE_STAGE } from '../js/data.js';
import { TUNE } from '../js/core.js';
if (process.argv[4]) Object.assign(TUNE, JSON.parse(process.argv[4]));

const HOURS = +(process.argv[2] || 6);
const TAPS = +(process.argv[3] || 5);
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const s = newState('kitten');
let b = new Battle(s, rand);
const dt = 0.05;
let t = 0, lastBest = 0, lastProgressT = 0;
const marks = {};
const log = [];
const effDps = st => st.autoDps + TAPS * st.tapDps;

function shop() {
  for (let guard = 0; guard < 200; guard++) {
    const base = effDps(computeStats(s));
    let best = null, bestVal = 0;
    for (const u of UPGRADES) {
      const lv = s.upg[u.id];
      if (u.max != null && lv >= u.max) continue;
      const c = upgCost(u, lv);
      if (c > s.gold) continue;
      s.upg[u.id]++;
      let gain = effDps(computeStats(s)) - base;
      s.upg[u.id]--;
      if (u.id === 'gold') gain = base * 0.08;
      const val = gain / c;
      if (val > bestVal) { bestVal = val; best = { u, c }; }
    }
    if (companionUnlocked(s)) {
      if (!s.companion.animal) { s.companion.animal = 'chick'; s.companion.level = 1; }
      const c = companionCost(s.companion.level);
      if (c <= s.gold) {
        s.companion.level++; const gain = effDps(computeStats(s)) - base; s.companion.level--;
        if (gain / c > bestVal) { bestVal = gain / c; best = { comp: true, c }; }
      }
    }
    if (!best) break;
    s.gold -= best.c;
    if (best.comp) s.companion.level++; else s.upg[best.u.id]++;
  }
  for (const a of ['kitten', 'chick']) {
    const lv = a === s.animal ? s.level : s.companion.animal === a ? s.companion.level : 0;
    const p = pendingEvo(a, lv, s);
    if (p === 0) s.evo[a][0] = 0;
    if (p === 1) s.evo[a][1] = 1;
  }
  // equip best items
  for (const it of s.items) {
    const cur = s.items.find(i => i.id === s.equipped[it.slot]);
    if (!cur || itemScore(it) > itemScore(cur)) s.equipped[it.slot] = it.id;
  }
  b.refresh();
}

function prestige() {
  const gain = doPrestige(s);
  // spend stardust greedily: cheapest of spirit/tapm/paws/start
  for (let g = 0; g < 500; g++) {
    const opts = PERKS.filter(p => (p.max == null || s.perks[p.id] < p.max) && ['spirit', 'tapm', 'paws', 'start', 'wise', 'pack'].includes(p.id))
      .map(p => ({ p, c: perkCost(p, s.perks[p.id]) * (p.id === 'spirit' ? 0.7 : 1) })).sort((a, b) => a.c - b.c);
    const o = opts[0];
    const realC = perkCost(o.p, s.perks[o.p.id]);
    if (realC > s.stardust) break;
    s.stardust -= realC; s.perks[o.p.id]++;
  }
  b = new Battle(s, rand);
  log.push(`  ⟲ prestige #${s.stats.prestiges} at ${fmtTime(t)}: +${gain} stardust (total ${s.stardustTotal}) perks=${JSON.stringify(s.perks)}`);
}

let nextShop = 0, nextReport = 0;
while (t < HOURS * 3600) {
  b.step(dt);
  // taps
  if (rand() < TAPS * dt) b.tap();
  if (s.frenzy >= 40) b.activateFrenzy();
  b.events.length = 0;
  t += dt;
  if (t >= nextShop) { shop(); nextShop = t + 2; }
  if (s.maxStage > lastBest) { lastBest = s.maxStage; lastProgressT = t; }
  for (const m of [10, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200]) {
    if (s.bestStage >= m && !marks[m]) { marks[m] = t; log.push(`stage ${m} at ${fmtTime(t)} lvl ${s.level} dps ${fmtNum(computeStats(s).autoDps)} tap ${fmtNum(computeStats(s).tapHit)}`); }
  }
  if (t >= nextReport) {
    const st = computeStats(s);
    log.push(`[${fmtTime(t)}] stage ${s.stage}${s.farming ? 'F' : ''} lvl ${s.level} gold ${fmtNum(s.gold)} auto ${fmtNum(st.autoDps)} tapdps ${fmtNum(TAPS * st.tapDps)} upg ${JSON.stringify(s.upg)} items ${s.items.length} gems ${s.gems} comp ${s.companion.level}`);
    nextReport = t + 600;
  }
  // Prestige when stuck for 4 minutes past the prestige stage, and gain is decent.
  if (s.maxStage >= PRESTIGE_STAGE && t - lastProgressT > 240 && stardustGain(s) >= Math.max(3, s.stardustTotal * 0.5)) {
    prestige(); lastBest = 0; lastProgressT = t;
  }
}
console.log(log.join('\n'));
// offline check
const s2 = JSON.parse(JSON.stringify(s));
const off = simulateOffline(s2, 8 * 3600, rand);
console.log('offline 8h from final state:', { gold: fmtNum(off.gold), kills: off.kills, stages: off.stages, levels: off.levels, items: off.items.length, gems: off.gems, start: off.startStage, end: off.endStage });
