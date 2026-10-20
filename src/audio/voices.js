// voices.js: the sounds made for this game: the cannon (a chaser's crack, a broadside gun's boom and its rolling
// thunder), shots landing on wood, canvas and crystal, a thud through your own deck, near misses whizzing past, ships
// blowing up and their crystals dying, a wreck falling and booming under the clouds, shard chimes, creaking timbers,
// the clack of guns run out again, and a raider's call as she readies her broadside at you.
// They're played on the same instruments as Chris's sounds (src/audio/thareia/sounds.js): tone, noise and fm here take
// the same settings as his (f, to, glide, type, d, g, a, hold, lp/bp/hp, f2, fg, q, vib, vibd, am, amd, ratio, index),
// but are built in whatever audio context they're given. That lets them be made once, when the sound starts, in a
// context that renders off to one side (an OfflineAudioContext) into short recordings (bake), so a big fight plays
// recordings rather than building hundreds of oscillators a second. (His sounds.js keeps one context of its own for
// the music and his effects, so it's never pointed at that one.)
// Each recipe is (ctx, out, t, v): played into `out` from time t, v its variant (0, 1, 2...), each a little different.

const rnd = (a, b) => a + Math.random() * (b - a);
let NOISE = null; // two seconds of white noise, made once per sample rate
function noiseBuf(ctx) {
  if (NOISE && NOISE.sampleRate === ctx.sampleRate) return NOISE;
  const n = Math.round(ctx.sampleRate * 2), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return (NOISE = b);
}
export const whiteNoise = noiseBuf;

// attack to g over a, hold, then an exponential fall to silence at d (as sounds.js)
function envelope(ctx, t, o) {
  const e = ctx.createGain(), A = o.a ?? 0.004, G = o.g ?? 0.3, D = Math.max(o.d, A + 0.01);
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(G, t + A);
  if (o.hold) e.gain.setValueAtTime(G, t + A + o.hold);
  e.gain.exponentialRampToValueAtTime(0.0001, t + D);
  if (o.am) { // tremolo (or, with a square wave, chopping)
    const l = ctx.createOscillator(), lg = ctx.createGain(), m = ctx.createGain(), depth = o.amd ?? 0.6;
    l.type = o.amType ?? 'sine'; l.frequency.value = o.am; lg.gain.value = depth / 2; m.gain.value = 1 - depth / 2;
    l.connect(lg); lg.connect(m.gain); l.start(t); l.stop(t + D + 0.1);
    e.connect(m); e.out = m; return e;
  }
  e.out = e; return e;
}
function filter(ctx, t, o, node) {
  if (!o.lp && !o.bp && !o.hp) return node;
  const f = ctx.createBiquadFilter(), D = o.d;
  f.type = o.bp ? 'bandpass' : o.hp ? 'highpass' : 'lowpass';
  f.frequency.setValueAtTime(o.bp || o.hp || o.lp, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.fg ?? D));
  f.Q.value = o.q ?? (o.bp ? 2 : 0.8); node.connect(f); return f;
}
// a pitched voice
export function tone(ctx, out, t, o) {
  const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.glide ?? o.d));
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibd ?? o.f * 0.02; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.d + 0.1); }
  const e = envelope(ctx, t, o); filter(ctx, t, o, osc).connect(e); e.out.connect(out);
  osc.start(t); osc.stop(t + o.d + 0.05);
}
// filtered noise
export function noise(ctx, out, t, o) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); if (o.rate) s.playbackRate.value = o.rate;
  const e = envelope(ctx, t, o); filter(ctx, t, o, s).connect(e); e.out.connect(out);
  s.start(t, Math.random() * 1.5); s.stop(t + o.d + 0.05);
}
// a bell or metal strike by frequency modulation
export function fm(ctx, out, t, o) {
  const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), f = o.f;
  c.frequency.value = f; m.frequency.value = Math.min(f * (o.ratio ?? 3.5), ctx.sampleRate * 0.45); // (kept under the recording's highest note)
  mg.gain.setValueAtTime(f * (o.index ?? 2), t); mg.gain.exponentialRampToValueAtTime(f * 0.01 + 1, t + o.d);
  m.connect(mg); mg.connect(c.frequency);
  const e = envelope(ctx, t, { a: 0.002, ...o }); c.connect(e); e.out.connect(out);
  c.start(t); m.start(t); c.stop(t + o.d + 0.05); m.stop(t + o.d + 0.05);
}
const ticks = (c, o, t, n, span, f0, f1, g, d = 0.03) => { for (let i = 0; i < n; i++) noise(c, o, t + Math.random() * span, { bp: rnd(f0, f1), q: 6, d, g: g * rnd(0.4, 1), a: 0.001 }); };

// The recipes: how long each is (seconds), how many variants, which of the two banks (low: the deep sounds, kept at a
// lower sample rate as they need no high notes), and how it's played
const crack = (zing, dark) => (c, o, t, v) => { // a chaser: a sharp crack, the report's tail, and a crystal zing on top
  const j = 1 + v * 0.04;
  noise(c, o, t, { hp: (dark ? 1500 : 2600) * j, d: 0.14, g: dark ? 1 : 1.5, a: 0.0008 });
  noise(c, o, t, { bp: (dark ? 2400 : 4200) * j, q: 1.4, d: 0.08, g: dark ? 0.7 : 1.1, a: 0.0008 });
  noise(c, o, t, { bp: dark ? 700 : 900, q: 1, d: 0.3, g: dark ? 0.55 : 0.35, a: 0.002 });
  tone(c, o, t, { f: 260 * j, to: 90, glide: 0.06, d: 0.25, g: dark ? 0.6 : 0.4, a: 0.001 });
  noise(c, o, t + 0.015, { lp: 1600, f2: 260, fg: 0.3, d: 0.55, g: 0.22, a: 0.01 });
  tone(c, o, t + 0.005, { f: zing * j, to: zing / 2 * j, glide: 0.16, d: 0.28, g: 0.16, type: 'triangle', a: 0.002 });
};
export const RECIPES = {
  // the Captain's chasers (bright), and the raiders' (the zing a tritone lower: darker)
  crack: { len: 0.7, n: 2, play: crack(2093, false) },
  crackR: { len: 0.7, n: 2, play: crack(1480, true) },
  // one broadside gun: a punch, a deep thump and a dark burst of smoke-noise
  boom: { len: 2.2, n: 3, low: true, play: (c, o, t, v) => {
    noise(c, o, t, { bp: 1100 * (1 + v * 0.06), q: 1, d: 0.2, g: 1, a: 0.0008 });
    tone(c, o, t, { f: 120 - v * 8, to: 36, glide: 0.28, d: 1.4, g: 1.3, a: 0.002 });
    noise(c, o, t, { lp: 900, f2: 140, fg: 0.7, d: 2.0, g: 0.9, a: 0.004 });
    tone(c, o, t, { f: 64, to: 40, glide: 0.5, d: 1.1, g: 0.5, a: 0.01, type: 'triangle' });
  } },
  // the broadside's thunder, rolling on after the guns (and, slowed, a Man-o'-war's)
  roll: { len: 6, n: 2, low: true, play: (c, o, t, v) => {
    noise(c, o, t, { lp: 240 + v * 30, q: 0.9, d: 5.8, g: 0.9, a: 0.06, am: 3 + v * 1.3, amd: 0.45 });
    tone(c, o, t, { f: 52, to: 30, glide: 1, d: 3.5, g: 0.6, a: 0.05 });
    noise(c, o, t + 0.3, { lp: 160, d: 5.5, g: 0.7, a: 0.5 });
  } },
  // shots landing: a woody knock with splinters on a hull; a ripping tear in canvas; a glassy shatter on crystal
  wood: { len: 0.5, n: 3, play: (c, o, t, v) => {
    tone(c, o, t, { f: 260 + v * 30, to: 85, glide: 0.08, d: 0.25, g: 0.6, a: 0.001 });
    noise(c, o, t, { bp: 1300 + v * 150, q: 1.6, d: 0.35, g: 1, a: 0.001 });
    noise(c, o, t, { bp: 500, q: 1.2, d: 0.2, g: 0.45, a: 0.001 });
    noise(c, o, t, { hp: 3000, d: 0.06, g: 0.8, a: 0.0005 });
    for (let i = 0; i < 5; i++) noise(c, o, t + 0.008 + i * rnd(0.012, 0.025), { hp: 3500, d: 0.04, g: 0.9 * rnd(0.5, 1), a: 0.0005 });
  } },
  canvas: { len: 0.45, n: 3, play: (c, o, t, v) => {
    noise(c, o, t, { bp: 1500, f2: 3600 + v * 300, fg: 0.16, q: 1.6, d: 0.32, g: 1.2, a: 0.004, am: 70 + v * 15, amd: 0.75 });
    noise(c, o, t + 0.02, { bp: 3800, q: 1.6, d: 0.22, g: 0.5, a: 0.01, am: 45, amd: 0.7 });
    noise(c, o, t, { bp: 2400, q: 2, d: 0.12, g: 0.4, a: 0.002 });
  } },
  crystal: { len: 0.9, n: 3, play: (c, o, t, v) => {
    fm(c, o, t, { f: rnd(2300, 2700), ratio: 2.76, index: 2.2, d: 0.6, g: 0.4 });
    fm(c, o, t + 0.01, { f: rnd(3400, 3900), ratio: 5.4, index: 1.5, d: 0.45, g: 0.25 });
    noise(c, o, t, { bp: 5000, q: 2, d: 0.04, g: 0.6, a: 0.0005 });
    for (let i = 0; i < 6; i++) fm(c, o, t + 0.02 + i * rnd(0.02, 0.05) + v * 0.005, { f: rnd(4000, 6500), ratio: 2.2, index: 0.8, d: 0.25, g: 0.12 });
  } },
  // a hit on your own ship, felt through the deck
  thud: { len: 0.7, n: 1, low: true, play: (c, o, t) => {
    tone(c, o, t, { f: 90, to: 48, glide: 0.12, d: 0.6, g: 1, a: 0.002 });
    noise(c, o, t, { lp: 300, d: 0.3, g: 0.6, a: 0.002 });
  } },
  // a raider readying her broadside at you: a short rising call, two quick notes, the second higher and trembling (a
  // bosun's whistle, heard over the guns)
  warn: { len: 0.55, n: 1, play: (c, o, t) => {
    tone(c, o, t, { f: 620, to: 930, glide: 0.12, d: 0.17, g: 0.5, a: 0.008, type: 'triangle' });
    tone(c, o, t + 0.15, { f: 930, to: 1400, glide: 0.14, d: 0.34, g: 0.55, a: 0.008, type: 'triangle', vib: 11, vibd: 18 });
  } },
  // a shot passing close: a falling whistle and rush of air
  whiz: { len: 0.55, n: 2, play: (c, o, t, v) => {
    noise(c, o, t, { bp: 3200 + v * 400, f2: 700, fg: 0.35, q: 3, d: 0.45, g: 1, a: 0.08 });
    tone(c, o, t, { f: 1250 + v * 120, to: 520, glide: 0.35, d: 0.42, g: 0.18, a: 0.07, type: 'triangle' });
  } },
  // a ship blown apart: a deep blast, a crack, crackling fire and her timbers groaning as she breaks
  blast: { len: 4.6, n: 2, low: true, play: (c, o, t, v) => {
    tone(c, o, t, { f: 85 - v * 8, to: 26, glide: 0.7, d: 4.4, g: 1.4, a: 0.003 });
    noise(c, o, t, { lp: 1800, f2: 140, fg: 1.4, d: 4.4, g: 1, a: 0.004 });
    noise(c, o, t + 0.2, { lp: 150, d: 4.2, g: 0.7, a: 0.3 });
    noise(c, o, t, { bp: 1400, q: 0.8, d: 0.25, g: 0.8, a: 0.0008 });
    ticks(c, o, t + 0.1, 10, 1.5, 1500, 4500, 0.35);
    tone(c, o, t + 0.25, { f: 78, to: 52, glide: 1.4, d: 1.8, g: 0.3, a: 0.2, type: 'sawtooth', bp: 420, q: 6, vib: 7, vibd: 3 });
  } },
  // one blast of the chain that walks along a wreck's hull
  pop: { len: 1.5, n: 2, low: true, play: (c, o, t, v) => {
    tone(c, o, t, { f: 110 + v * 15, to: 40, glide: 0.3, d: 1.2, g: 1, a: 0.002 });
    noise(c, o, t, { lp: 2000, f2: 250, fg: 0.6, d: 1.3, g: 0.8, a: 0.003 });
    ticks(c, o, t + 0.05, 4, 0.5, 1500, 4000, 0.3);
  } },
  // a ship's crystals dying: bells falling as her lights go out, and the power draining away
  crystalsDie: { len: 2.8, n: 1, play: (c, o, t) => {
    [1174.7, 987.8, 880, 698.5, 587.3].forEach((f, i) => fm(c, o, t + i * 0.16, { f, ratio: 2, index: 1.2, d: 1.2, g: 0.32 }));
    tone(c, o, t, { f: 660, to: 70, glide: 1.3, d: 1.6, g: 0.3, type: 'triangle', a: 0.02 });
    noise(c, o, t, { hp: 5000, f2: 1500, d: 1, g: 0.08, a: 0.05 });
  } },
  // a wreck falling away: a long rush of air, falling in pitch
  fall: { len: 5.5, n: 1, low: true, play: (c, o, t) => {
    noise(c, o, t, { bp: 900, f2: 250, fg: 5, q: 1.5, d: 5.4, g: 1, a: 1.2 });
    tone(c, o, t, { f: 70, to: 50, glide: 5, d: 5, g: 0.25, a: 2 });
  } },
  // a wreck breaking through the cloud deck: a soft, muffled whump
  whump: { len: 1.1, n: 1, low: true, play: (c, o, t) => {
    noise(c, o, t, { lp: 400, d: 1, g: 1, a: 0.25 });
    tone(c, o, t + 0.1, { f: 60, to: 40, d: 0.8, g: 0.4, a: 0.1 });
  } },
  // a shard gathered (played higher for each shard of a run, up the scale): a crystal chime with a touch of octave
  chime: { len: 1, n: 1, play: (c, o, t) => {
    fm(c, o, t, { f: 587.3, ratio: 3, index: 1.3, d: 0.9, g: 0.5 });
    fm(c, o, t, { f: 1174.7, ratio: 2, index: 0.5, d: 0.6, g: 0.08 });
  } },
  // timbers and rigging straining
  creak: { len: 1.1, n: 3, play: (c, o, t, v) => {
    const f = 90 + v * 25;
    tone(c, o, t, { f, to: f * 1.25, glide: 0.8, d: 0.9, g: 3, a: 0.08, type: 'sawtooth', bp: 600 + v * 150, q: 12, am: 30 - v * 4, amd: 0.8 });
  } },
  // a crackle of fire, or a little click
  tick: { len: 0.06, n: 2, play: (c, o, t, v) => noise(c, o, t, { bp: v ? 4500 : 2500, q: 6, d: 0.04, g: 1, a: 0.0005 }) },
  // a gun run out again, loaded: a wooden clack
  clack: { len: 0.14, n: 1, play: (c, o, t) => {
    noise(c, o, t, { bp: 1800, q: 4, d: 0.06, g: 1, a: 0.0005 });
    tone(c, o, t, { f: 700, d: 0.06, g: 0.3, type: 'square', lp: 1500, a: 0.001 });
  } },
};

// Bake every recipe once: each bank's recipes laid end to end in one offline render, then cut apart into recordings,
// each scaled to the same peak (0.9; how loud each is played is up to the game), cut short once it has died away, and
// faded out at its very end.
// Returns a promise of { name: [buffer per variant] }. `rates`: the two banks' sample rates
export async function bake(rates = { high: 32000, low: 16000 }, fallback = 44100) {
  const out = {};
  // (an older iPhone only renders offline at its own rate)
  const offline = (n, sr) => { try { return new OfflineAudioContext(1, Math.ceil(n * sr), sr); } catch { return new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.ceil(n * fallback), fallback); } };
  for (const low of [false, true]) {
    const names = Object.keys(RECIPES).filter((k) => !!RECIPES[k].low === low), sr = low ? rates.low : rates.high;
    const gap = 0.05, at = [];
    let total = 0;
    for (const k of names) for (let v = 0; v < RECIPES[k].n; v++) { at.push([k, v, total]); total += RECIPES[k].len + gap; }
    const off = offline(total, sr), rate = off.sampleRate;
    for (const [k, v, t] of at) RECIPES[k].play(off, off.destination, t + 0.002, v);
    const all = await new Promise((ok, no) => { off.oncomplete = (e) => ok(e.renderedBuffer); const p = off.startRendering(); if (p?.then) p.then(ok, no); });
    const src = all.getChannelData(0);
    for (const [k, v, t] of at) {
      // each cut short where it has died away below a thousandth of its peak (so its voice is free once it's heard)
      const len = Math.round(RECIPES[k].len * rate), from = Math.round(t * rate), fade = Math.round(0.02 * rate);
      let peak = 0, end = 0;
      for (let i = 0; i < len; i++) { const a = Math.abs(src[from + i] || 0); if (a > peak) peak = a; }
      for (let i = len - 1; i >= 0; i--) if (Math.abs(src[from + i] || 0) > peak * 0.001) { end = i; break; }
      const n = Math.min(len, end + fade), b = off.createBuffer(1, Math.max(1, n), rate), d = b.getChannelData(0), k2 = peak > 0 ? 0.9 / peak : 1;
      for (let i = 0; i < n; i++) d[i] = (src[from + i] || 0) * k2 * (i > n - fade ? (n - i) / fade : 1);
      b.peak = peak; // (before scaling: a recipe gone silent shows here)
      (out[k] ??= [])[v] = b;
    }
  }
  return out;
}
