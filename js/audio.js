// Tiny chiptune-ish sound effects with WebAudio (no files).
let ac = null, enabled = true, last = {};
export function setSound(on) { enabled = on; }
function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, dur, type = 'square', vol = 0.05, when = 0, slide = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
// Rate-limit each sound so fast taps don't turn into noise.
function rl(name, ms) { const n = performance.now(); if (last[name] && n - last[name] < ms) return false; last[name] = n; return true; }

export const sfx = {
  unlock() { ctx(); },
  tap() { if (enabled && rl('tap', 45)) tone(520 + Math.random() * 120, 0.05, 'square', 0.025, 0, -200); },
  hit() { if (enabled && rl('hit', 70)) tone(220, 0.06, 'triangle', 0.04, 0, -80); },
  crit() { if (enabled && rl('crit', 90)) { tone(880, 0.07, 'square', 0.035); tone(1320, 0.08, 'square', 0.03, 0.04); } },
  coin() { if (enabled && rl('coin', 80)) { tone(988, 0.06, 'square', 0.03); tone(1319, 0.1, 'square', 0.03, 0.06); } },
  boss() { if (enabled) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.04, i * 0.09)); },
  level() { if (enabled && rl('lvl', 300)) [392, 523, 659].forEach((f, i) => tone(f, 0.1, 'triangle', 0.05, i * 0.07)); },
  loot() { if (enabled) [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.09, 'triangle', 0.045, i * 0.06)); },
  evolve() { if (enabled) [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.04, i * 0.1)); },
  fail() { if (enabled) [392, 330, 262].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.03, i * 0.12)); },
  buy() { if (enabled && rl('buy', 40)) tone(660, 0.05, 'square', 0.03, 0, 300); },
};
