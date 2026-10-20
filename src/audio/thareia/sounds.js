// Thareia sound library: 100 sound effects made entirely in code (Web Audio), no sound files.
// SFX = [{ id, cat, name, desc, play(t) }]; call sfxInit() from a tap, then SFX[i].play(ctx.currentTime + .02).
// Shared: a compressor on the master bus and one code-generated reverb (no impulse file).

const NOTE_I = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = f => {
  if (typeof f !== 'string') return f;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(f);
  const n = NOTE_I[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
};
const rnd = (a, b) => a + Math.random() * (b - a);

let AC = null, OUT = null, REV = null, NOISE = null, BUS = null, BUSREV = null, ECHO = null;
export function sfxInit(given) {
  if (AC && !given) { if (AC.state === 'suspended') AC.resume(); return AC; }
  AC = given || new (window.AudioContext || window.webkitAudioContext)();
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
  OUT = AC.createGain(); OUT.gain.value = .85; OUT.connect(comp); comp.connect(AC.destination);
  const n = AC.sampleRate * 2.4, ir = AC.createBuffer(2, n, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.8); }
  REV = AC.createConvolver(); REV.buffer = ir; const rg = AC.createGain(); rg.gain.value = .4; REV.connect(rg); rg.connect(OUT);
  const nn = AC.sampleRate * 2; NOISE = AC.createBuffer(1, nn, AC.sampleRate);
  const nd = NOISE.getChannelData(0); for (let i = 0; i < nn; i++) nd[i] = Math.random() * 2 - 1;
  return AC;
}
export const sfxContext = () => AC;

// the output of one voice: panned, with a reverb send
function route(pan = 0, rv = 0, echo = 0) {
  const g = AC.createGain();
  const out = BUS || OUT, rev = BUSREV || REV;
  if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(out); } else g.connect(out);
  if (rv) { const s = AC.createGain(); s.gain.value = rv; g.connect(s); s.connect(rev); }
  if (echo && ECHO) { const s = AC.createGain(); s.gain.value = echo; g.connect(s); s.connect(ECHO); }
  return g;
}
// attack to g over a, hold, then an exponential fall to silence at d
function envelope(t, o) {
  const a = AC.createGain(), A = o.a ?? .004, G = o.g ?? .3, D = Math.max(o.d, A + .01);
  a.gain.setValueAtTime(.0001, t); a.gain.exponentialRampToValueAtTime(G, t + A);
  if (o.hold) a.gain.setValueAtTime(G, t + A + o.hold);
  a.gain.exponentialRampToValueAtTime(.0001, t + D);
  if (o.am) { // tremolo
    const l = AC.createOscillator(), lg = AC.createGain(), m = AC.createGain();
    l.frequency.value = o.am; lg.gain.value = o.amd ?? .6; m.gain.value = 1 - (o.amd ?? .6) / 2;
    l.connect(lg); lg.connect(m.gain); l.start(t); l.stop(t + D + .1);
    a.connect(m); a.out = m; return a;
  }
  a.out = a; return a;
}
function filter(t, o, node) {
  if (!o.lp && !o.bp && !o.hp) return node;
  const f = AC.createBiquadFilter(), D = o.d;
  f.type = o.bp ? 'bandpass' : o.hp ? 'highpass' : 'lowpass';
  const f0 = o.bp || o.hp || o.lp; f.frequency.setValueAtTime(f0, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.fg ?? D));
  f.Q.value = o.q ?? (o.bp ? 2 : .8); node.connect(f); return f;
}
// a pitched voice: { f, to, glide, type, d, g, a, hold, lp|bp|hp, f2, q, pan, rv, vib, vibd, detune, am, amd }
function tone(t, o) {
  const osc = AC.createOscillator(); osc.type = o.type || 'sine';
  const f = hz(o.f); osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, hz(o.to)), t + (o.glide ?? o.d));
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibd ?? f * .02; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.d + .1); }
  const e = envelope(t, o); filter(t, o, osc).connect(e); e.out.connect(route(o.pan, o.rv, o.echo));
  osc.start(t); osc.stop(t + o.d + .05);
}
// filtered noise: { d, g, a, hold, lp|bp|hp, f2, fg, q, pan, rv, am }
function noise(t, o) {
  const s = AC.createBufferSource(); s.buffer = NOISE; if (o.rate) s.playbackRate.value = o.rate;
  const e = envelope(t, o); filter(t, o, s).connect(e); e.out.connect(route(o.pan, o.rv, o.echo));
  s.start(t, Math.random() * 1.5); s.stop(t + o.d + .05);
}
// a bell or metal strike by frequency modulation: { f, ratio, index, d, g, pan, rv }
function fm(t, o) {
  const c = AC.createOscillator(), m = AC.createOscillator(), mg = AC.createGain(), f = hz(o.f);
  c.frequency.value = f; m.frequency.value = f * (o.ratio ?? 3.5);
  mg.gain.setValueAtTime(f * (o.index ?? 2), t); mg.gain.exponentialRampToValueAtTime(f * .01 + 1, t + o.d);
  m.connect(mg); mg.connect(c.frequency);
  const e = envelope(t, { a: .002, ...o }); c.connect(e); e.out.connect(route(o.pan, o.rv, o.echo));
  c.start(t); m.start(t); c.stop(t + o.d + .05); m.stop(t + o.d + .05);
}
const arp = (t, notes, step, o) => notes.forEach((n, i) => { if (n) tone(t + i * step, { ...o, f: n, pan: (o.pan ?? 0) + (o.spread ? (i / Math.max(1, notes.length - 1) - .5) * o.spread : 0) }); });
const bells = (t, notes, step, o) => notes.forEach((n, i) => { if (n) fm(t + i * step, { ...o, f: n }); });
const chord = (t, notes, o) => notes.forEach((n, i) => tone(t, { ...o, f: n, pan: (o.pan ?? 0) + (i - (notes.length - 1) / 2) * (o.spread ?? .25) }));
const thump = (t, g = .6, f = 120, d = .25) => tone(t, { f, to: 40, d, g, type: 'sine' });
const click = (t, f = 2500, g = .2, d = .03, pan = 0) => noise(t, { bp: f, q: 6, d, g, pan });
const crackle = (t, dur, n, g = .12) => { for (let i = 0; i < n; i++) click(t + Math.random() * dur, rnd(1500, 5000), g * rnd(.4, 1), rnd(.01, .03), rnd(-.5, .5)); };
const creak = (t, d = .5, g = .08, f = 150) => tone(t, { f, to: f * 1.5, d, g, type: 'sawtooth', bp: 900, q: 4, vib: 18, vibd: 20, a: .05 });
const whoosh = (t, d = .3, g = .3, f = 400, f2 = 2500, pan = 0) => noise(t, { bp: f, f2, d, g, q: 1.2, a: d * .4, pan });
const rumble = (t, d = 1.5, g = .5) => { noise(t, { lp: 180, f2: 60, d, g, a: .05 }); tone(t, { f: 48, to: 32, d, g: g * .6 }); };

const S = [];
const add = (cat, id, name, desc, play) => S.push({ id, cat, name, desc, play });

/* ---- menus and interface ---- */
const UI = 'Menus and interface';
add(UI, 'ui-cursor', 'Cursor move', 'A tiny soft tick as the cursor moves between menu items.', t => tone(t, { f: 1760, d: .045, g: .07, type: 'square', lp: 3000 }));
add(UI, 'ui-confirm', 'Confirm', 'Two bright rising notes: yes, do it.', t => arp(t, ['E5', 'B5'], .06, { type: 'triangle', d: .2, g: .2, rv: .15 }));
add(UI, 'ui-back', 'Cancel or back', 'The confirm notes turned downward: never mind.', t => arp(t, ['B5', 'E5'], .06, { type: 'triangle', d: .16, g: .17, rv: .1 }));
add(UI, 'ui-error', "Can't do that", 'A short low double buzz.', t => { tone(t, { f: 170, d: .1, g: .13, type: 'square', lp: 900 }); tone(t + .11, { f: 160, d: .12, g: .13, type: 'square', lp: 900 }); });
add(UI, 'ui-open', 'Menu opens', 'A quick upward swish with a soft rising tone.', t => { whoosh(t, .18, .16, 700, 3200); tone(t, { f: 520, to: 880, d: .16, g: .08, type: 'triangle' }); });
add(UI, 'ui-close', 'Menu closes', 'The same swish, downward.', t => { whoosh(t, .18, .16, 3200, 700); tone(t, { f: 880, to: 520, d: .16, g: .08, type: 'triangle' }); });
add(UI, 'ui-page', 'Page turn', 'Paper flicking over, as in the journal or the Codex.', t => { noise(t, { hp: 2500, d: .12, g: .16, a: .03 }); noise(t + .08, { hp: 4000, d: .08, g: .08 }); });
add(UI, 'ui-blip', 'Dialogue text blip', 'The tick of each letter as someone speaks.', t => { for (let i = 0; i < 6; i++) tone(t + i * .07, { f: rnd(480, 560), d: .03, g: .06, type: 'square', lp: 2200 }); });
add(UI, 'ui-save', 'Game saved', 'A warm four-note chime up the major chord.', t => arp(t, ['C5', 'E5', 'G5', 'C6'], .07, { type: 'triangle', d: .5, g: .12, rv: .3, spread: .6 }));
add(UI, 'ui-buy', 'Purchase', 'Two quick coin pings: sold.', t => { fm(t, { f: 1320, ratio: 2.4, index: 1.2, d: .25, g: .1 }); fm(t + .07, { f: 1760, ratio: 2.4, index: 1.2, d: .35, g: .1 }); });

/* ---- battle: striking ---- */
const HIT = 'Battle: striking';
add(HIT, 'hit-slash', 'Sword slash', 'A sharp airy slice with a metal edge.', t => { noise(t, { bp: 2500, f2: 6500, d: .16, g: .35, q: 2 }); tone(t, { f: 900, to: 300, d: .1, g: .05, type: 'sawtooth' }); });
add(HIT, 'hit-blunt', 'Heavy blunt hit', 'A maul or hammer landing: a deep thud.', t => { thump(t, .75, 140, .3); noise(t, { lp: 900, d: .14, g: .5 }); });
add(HIT, 'hit-thrust', 'Spear thrust', 'A narrow, fast stab.', t => { noise(t, { bp: 1200, f2: 3500, d: .1, g: .32, q: 3 }); tone(t, { f: 400, to: 200, d: .08, g: .15, type: 'triangle' }); });
add(HIT, 'bow-shot', 'Arrow loosed', 'A bowstring twang, then the arrow hissing away.', t => { tone(t, { f: 190, to: 130, d: .14, g: .22, type: 'triangle' }); whoosh(t + .02, .25, .12, 2000, 5000, .3); });
add(HIT, 'arrow-hit', 'Arrow lands', 'A short thock as the arrow strikes.', t => { noise(t, { bp: 1800, d: .05, g: .32 }); tone(t, { f: 320, to: 150, d: .07, g: .1, type: 'square', lp: 1200 }); });
add(HIT, 'dagger', 'Quick dagger stabs', 'Two fast, light stabs.', t => { noise(t, { bp: 4000, d: .05, g: .25, q: 3 }); noise(t + .08, { bp: 4400, d: .05, g: .22, q: 3 }); });
add(HIT, 'crit', 'Critical hit', 'A heavy impact with a ringing high note: a natural 20.', t => { thump(t, .8, 150, .35); noise(t, { bp: 2000, f2: 7000, d: .2, g: .4 }); fm(t + .02, { f: 2600, ratio: 1.5, index: 1, d: .8, g: .08, rv: .4 }); });
add(HIT, 'graze', 'Graze', 'A glancing scrape that still does half damage.', t => { noise(t, { bp: 3000, d: .08, g: .16 }); tone(t, { f: 600, to: 480, d: .06, g: .04, type: 'sawtooth' }); });
add(HIT, 'miss', 'Miss', 'A swing that whooshes through empty air.', t => whoosh(t, .28, .28, 450, 1800, -.3));
add(HIT, 'parry', 'Block or parry', 'Steel meeting steel: a bright clang.', t => { fm(t, { f: 1400, ratio: 2.76, index: 3, d: .6, g: .14, rv: .3 }); noise(t, { hp: 5000, d: .05, g: .2 }); });
add(HIT, 'shield-bash', 'Shield bash', 'A wooden-and-iron shield slammed forward.', t => { thump(t, .6, 110, .22); noise(t, { lp: 1500, d: .09, g: .3 }); tone(t, { f: 280, d: .06, g: .15, type: 'triangle' }); });
add(HIT, 'dice-roll', 'Dice rolling', 'The d20 tumbling across the tray.', t => { let x = 0; for (let i = 0; i < 8; i++) { x += rnd(.04, .11); click(t + x, rnd(2400, 4200), .18, .02, rnd(-.4, .4)); } });
add(HIT, 'dice-land', 'Dice lands', 'The die settles with a final clack and a tiny ding.', t => { click(t, 2800, .25, .03); click(t + .05, 3200, .12, .02); fm(t + .07, { f: 2093, ratio: 2, index: .6, d: .3, g: .06 }); });
add(HIT, 'turn', 'Your turn', 'A short, clear two-note cue.', t => arp(t, ['G5', 'D6'], .05, { type: 'sine', d: .28, g: .13, rv: .2 }));

/* ---- battle: statuses ---- */
const ST = 'Battle: statuses';
add(ST, 'burn', 'Set on fire', 'A whoosh of flame catching, then crackling.', t => { noise(t, { lp: 500, f2: 3500, d: .5, g: .3, a: .08 }); crackle(t + .1, .6, 10); });
add(ST, 'chill', 'Chilled or frozen', 'Glassy ice tinkles and a cold hiss.', t => { bells(t, ['E7', 'B6', 'G#6', 'E6'], .05, { ratio: 3.5, index: 1.5, d: .5, g: .05, rv: .5 }); noise(t, { hp: 6000, d: .6, g: .06, a: .05 }); });
add(ST, 'poison', 'Poisoned', 'Sickly little bubbles rising.', t => { for (let i = 0; i < 7; i++) tone(t + i * .08 + rnd(0, .03), { f: rnd(250, 450), to: rnd(600, 900), d: .07, g: .09 }); });
add(ST, 'rot', 'Rotting', 'A low, wet, spreading sound.', t => { noise(t, { lp: 420, d: .7, g: .3, a: .1 }); tone(t, { f: 90, to: 60, d: .7, g: .12, type: 'sawtooth', lp: 300 }); });
add(ST, 'stagger', 'Staggered', 'A dazed wobble.', t => tone(t, { f: 220, to: 130, d: .45, g: .1, type: 'square', lp: 900, vib: 11, vibd: 25 }));
add(ST, 'fear', 'Frightened', 'A creeping, uneasy swell of two clashing notes.', t => { chord(t, ['C4', 'F#4'], { a: .25, d: .9, g: .08, vib: 6, vibd: 4, rv: .4 }); rumble(t, .9, .15); });
add(ST, 'charm', 'Charmed', 'A sweet, dreamy sparkle.', t => arp(t, ['E6', 'G#6', 'B6', 'E7'], .05, { type: 'triangle', d: .45, g: .08, rv: .5, vib: 7, vibd: 8, spread: .8 }));
add(ST, 'hex', 'Hexed', 'A sour minor phrase falling away.', t => arp(t, ['B4', 'G4', 'E4', 'C#4'], .09, { type: 'sawtooth', d: .35, g: .06, lp: 1400, rv: .3 }));
add(ST, 'ward', 'Ward raised', 'A calm, open chord swelling up: protected.', t => { chord(t, ['C5', 'G5', 'C6'], { a: .12, d: .9, g: .07, rv: .45 }); noise(t, { hp: 7000, d: .8, g: .03, a: .2 }); });
add(ST, 'haste', 'Hasted', 'A quick upward rush.', t => { tone(t, { f: 400, to: 1600, d: .25, g: .08, type: 'square', lp: 3000 }); arp(t + .05, ['C6', 'E6', 'G6'], .04, { type: 'triangle', d: .15, g: .06 }); });
add(ST, 'regen', 'Regenerating', 'Gentle plucked notes, like a slow breath back in.', t => arp(t, ['F5', 'A5', 'C6'], .12, { type: 'triangle', d: .6, g: .09, rv: .5, lp: 3000 }));
add(ST, 'ko', 'Knocked out', 'A falling tone and a body hitting the ground.', t => { tone(t, { f: 420, to: 80, d: .55, g: .12, type: 'sawtooth', lp: 900 }); thump(t + .45, .5, 90, .3); });

/* ---- magic: the aspects ---- */
const MAG = 'Magic: the aspects';
add(MAG, 'ember', 'Ember spell', 'A roaring burst of fire.', t => { noise(t, { lp: 300, f2: 4000, fg: .25, d: .7, g: .45, a: .05 }); tone(t, { f: 80, d: .6, g: .2, type: 'sawtooth', lp: 500 }); crackle(t + .2, .5, 8, .1); });
add(MAG, 'frost', 'Frost spell', 'A cold rush and crystals cracking into place.', t => { noise(t, { hp: 3000, f2: 9000, d: .6, g: .12, a: .1 }); bells(t + .1, ['B6', 'F#7', 'D7', 'A7', 'E7'], .06, { ratio: 3.2, index: 2, d: .6, g: .05, rv: .5 }); for (let i = 0; i < 4; i++) click(t + .35 + i * .06, 6000, .15); });
add(MAG, 'storm', 'Storm spell', 'A lightning crack, electric buzz and rolling thunder.', t => { noise(t, { hp: 1200, d: .08, g: .6 }); tone(t, { f: 60, d: .45, g: .12, type: 'sawtooth', vib: 30, vibd: 30, lp: 2500 }); rumble(t + .1, 1.4, .4); });
add(MAG, 'stone', 'Stone spell', 'The ground shakes and rocks grind and clatter.', t => { rumble(t, 1.2, .6); for (let i = 0; i < 10; i++) click(t + .1 + Math.random() * .8, rnd(500, 1500), .15, .05); });
add(MAG, 'verdant', 'Verdant spell', 'Leaves rustling and a bright rising call of growth.', t => { noise(t, { bp: 3000, d: .6, g: .12, am: 14, amd: .8 }); arp(t + .05, ['D5', 'E5', 'G5', 'A5', 'D6'], .07, { type: 'triangle', d: .35, g: .09, rv: .35, spread: .7 }); });
add(MAG, 'tide', 'Tide spell', 'A wave rising and crashing.', t => { noise(t, { lp: 300, f2: 2800, fg: .6, d: 1.3, g: .45, a: .5, pan: -.4 }); noise(t + .6, { hp: 1500, d: .7, g: .15, pan: .4 }); });
add(MAG, 'radiant', 'Radiant spell', 'A choir-like swell of holy light.', t => { chord(t, ['C5', 'E5', 'G5', 'C6'], { type: 'triangle', a: .25, d: 1.5, g: .06, rv: .6, vib: 5, vibd: 2 }); noise(t, { hp: 8000, d: 1.4, g: .03, a: .4 }); });
add(MAG, 'blight', 'Blight spell', 'A dark, rotten, sagging chord.', t => { chord(t, ['C3', 'C#3', 'G3'], { type: 'sawtooth', a: .1, d: 1, g: .05, lp: 700, f2: 250, rv: .3 }); noise(t, { lp: 600, d: .8, g: .1 }); });
add(MAG, 'heal', 'Heal', 'A soft sparkling rise up the major chord.', t => arp(t, ['C5', 'E5', 'G5', 'C6', 'E6'], .07, { type: 'sine', d: .6, g: .12, rv: .5, spread: .8 }));
add(MAG, 'revive', 'Revive', 'A longer rising phrase and a warm chord: back on their feet.', t => { arp(t, ['G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6'], .08, { type: 'triangle', d: .5, g: .09, rv: .5, spread: 1 }); chord(t + .55, ['C5', 'E5', 'G5'], { a: .15, d: 1.2, g: .06, rv: .6 }); });
add(MAG, 'surge-charge', 'Legend Surge charging', 'A rising, building roar of power.', t => { tone(t, { f: 90, to: 700, d: 1.3, g: .12, type: 'sawtooth', lp: 400, f2: 5000, a: .2 }); noise(t, { bp: 500, f2: 5000, d: 1.3, g: .15, a: .9 }); });
add(MAG, 'surge-release', 'Legend Surge unleashed', 'A huge hit and a brass chord: the relic\'s ultimate.', t => { thump(t, .9, 130, .5); noise(t, { lp: 5000, f2: 300, d: .9, g: .45 }); chord(t + .02, ['C4', 'G4', 'C5', 'E5'], { type: 'sawtooth', a: .02, d: 1.4, g: .05, lp: 3200, f2: 1200, rv: .5 }); });

/* ---- loot and relics ---- */
const LOOT = 'Loot and relics';
add(LOOT, 'grip-crack', 'Relic grip breaks', 'A crack and a rattle of chain as the holder loses its grip.', t => { noise(t, { hp: 1500, d: .07, g: .5 }); for (let i = 0; i < 5; i++) fm(t + .06 + i * .045, { f: rnd(1800, 2600), ratio: 2.1, index: 1.5, d: .12, g: .06, pan: rnd(-.5, .5) }); });
add(LOOT, 'relic-drop', 'Relic clatters to the floor', 'Metal bouncing three times and settling.', t => { [0, .22, .36, .44].forEach((x, i) => fm(t + x, { f: 1500 - i * 80, ratio: 2.7, index: 2.2, d: .3 - i * .05, g: .12 - i * .025 })); });
add(LOOT, 'reveal-common', 'Item card: common', 'A simple two-note chime.', t => arp(t, ['G5', 'C6'], .08, { type: 'triangle', d: .4, g: .12, rv: .3 }));
add(LOOT, 'reveal-heirloom', 'Item card: heirloom', 'A bell arpeggio for a gold-framed legend.', t => bells(t, ['C6', 'E6', 'G6', 'C7', 'E7'], .09, { ratio: 3.01, index: 1.4, d: 1.1, g: .07, rv: .55 }));
add(LOOT, 'reveal-primal', 'Item card: primal', 'The grandest reveal: a boom, a swell and bells.', t => { thump(t, .7, 90, .8); chord(t, ['C4', 'G4', 'C5', 'E5', 'G5'], { type: 'triangle', a: .3, d: 2, g: .05, rv: .7 }); bells(t + .3, ['G6', 'C7', 'E7', 'G7'], .1, { ratio: 3, index: 1.5, d: 1.4, g: .05, rv: .6 }); });
add(LOOT, 'equip', 'Equip', 'Leather straps and a metal clink as gear goes on.', t => { noise(t, { bp: 1400, d: .09, g: .2 }); fm(t + .07, { f: 1900, ratio: 2.3, index: 1, d: .2, g: .07 }); });
add(LOOT, 'levelup', 'Level up', 'A short bright fanfare.', t => { arp(t, ['G4', 'C5', 'E5', 'G5'], .09, { type: 'square', d: .2, g: .06, lp: 3500 }); chord(t + .36, ['C5', 'E5', 'G5', 'C6'], { type: 'square', d: .8, g: .04, lp: 3500, rv: .4 }); });
add(LOOT, 'chest', 'Chest opens', 'Old hinges creaking, a latch, and a little chime.', t => { creak(t, .45, .07, 140); click(t + .45, 1800, .2, .04); arp(t + .55, ['E6', 'A6'], .07, { type: 'triangle', d: .4, g: .08, rv: .3 }); });
add(LOOT, 'coins', 'Gold coins', 'A handful of coins clinking.', t => { for (let i = 0; i < 7; i++) fm(t + i * .045 + rnd(0, .03), { f: rnd(2400, 3600), ratio: 2.4, index: 1, d: .18, g: .05, pan: rnd(-.5, .5) }); });
add(LOOT, 'identify', 'Identify ritual', 'A mysterious shimmer as an unknown card develops.', t => { noise(t, { hp: 3000, f2: 9000, d: 1.4, g: .06, a: .6 }); arp(t + .1, ['D5', 'F5', 'A5', 'C6', 'E6'], .18, { type: 'sine', d: .7, g: .07, rv: .6, vib: 5, vibd: 3 }); });

/* ---- walking the world ---- */
const WALK = 'Walking the world';
add(WALK, 'step-grass', 'Footsteps on grass', 'Soft brushing steps.', t => { for (let i = 0; i < 4; i++) noise(t + i * .28, { bp: 1500, q: .7, d: .09, g: .12, a: .01 }); });
add(WALK, 'step-stone', 'Footsteps on cobbles', 'Hard, clicky steps on stone.', t => { for (let i = 0; i < 4; i++) { click(t + i * .28, 2400, .14, .04); tone(t + i * .28, { f: 190, d: .04, g: .08 }); } });
add(WALK, 'step-wood', 'Footsteps on a boardwalk', 'Hollow wooden knocks.', t => { for (let i = 0; i < 4; i++) tone(t + i * .28, { f: 170, d: .1, g: .22, type: 'triangle', lp: 700 }); });
add(WALK, 'step-water', 'Splashing through water', 'Wading steps in the marsh.', t => { for (let i = 0; i < 3; i++) { noise(t + i * .35, { bp: 1200, f2: 500, d: .22, g: .22 }); tone(t + i * .35 + .05, { f: 500, to: 900, d: .06, g: .04 }); } });
add(WALK, 'door', 'Door opens', 'A latch lifts and a wooden door creaks open.', t => { click(t, 1600, .25, .04); creak(t + .08, .55, .08, 170); });
add(WALK, 'bump', 'Bump into a wall', 'A dull little bonk.', t => tone(t, { f: 95, d: .12, g: .3, type: 'square', lp: 300 }));
add(WALK, 'alert', 'A foe spots you', 'The "!" moment: a sharp two-note alarm.', t => arp(t, ['E6', 'B6'], .07, { type: 'square', d: .15, g: .08, lp: 4000 }));
add(WALK, 'stairs', 'Taking the stairs', 'Footsteps stepping down a flight of stairs.', t => { for (let i = 0; i < 5; i++) tone(t + i * .12, { f: 300 - i * 25, d: .06, g: .15, type: 'triangle', lp: 900 }); });
add(WALK, 'hearthfire', 'Rest at a Hearthfire', 'A warm chord, a crackling fire and a lullaby phrase: healed and saved.', t => { chord(t, ['F4', 'A4', 'C5'], { a: .3, d: 2, g: .05, rv: .5 }); crackle(t, 1.8, 14, .07); arp(t + .4, ['C5', 'A4', 'F5', 'C5'], .3, { type: 'triangle', d: .6, g: .06, rv: .4 }); });
add(WALK, 'sign', 'Read a sign', 'A knock on a wooden post.', t => { tone(t, { f: 240, d: .08, g: .2, type: 'triangle', lp: 900 }); tone(t + .1, { f: 260, d: .08, g: .15, type: 'triangle', lp: 900 }); });

/* ---- the airship ---- */
const SHIP = 'The airship';
add(SHIP, 'ship-takeoff', 'Skiff lifts off', 'The sunstone crystals hum up in pitch as the ship rises, with wind swelling.', t => { chord(t, [110, 165, 220], { to: 2, a: .3, d: 2.2, g: .07, rv: .4, vib: 4, vibd: 2 }); [110, 165, 220].forEach((f, i) => tone(t, { f, to: f * 2, d: 2.2, g: .05, a: .4, glide: 1.8, pan: (i - 1) * .4 })); noise(t + .4, { bp: 500, f2: 1200, d: 1.8, g: .15, a: .9 }); });
add(SHIP, 'ship-land', 'Skiff lands at the dock', 'The hum settles down, a wooden bump, and ropes creak.', t => { [220, 330].forEach((f, i) => tone(t, { f, to: f / 2, d: 1.2, g: .06, pan: i ? .3 : -.3 })); thump(t + 1, .5, 110, .3); creak(t + 1.15, .5, .06, 160); });
add(SHIP, 'sails', 'Crystal sails fill', 'The magic sails catching the Aether: a strange, airy, spacey whoosh with a glassy shimmer, rising and falling like a breath.', t => {
  noise(t, { bp: 300, f2: 2200, fg: 1.1, d: 2.2, g: .22, q: 9, a: .7, pan: -.5, rv: .6 });
  noise(t + .15, { bp: 2600, f2: 500, fg: 1.4, d: 2.1, g: .16, q: 11, a: .6, pan: .5, rv: .6 });
  [[220, 330], [277, 415], [330, 494]].forEach(([a, b], i) => tone(t + i * .18, { f: a, to: b, glide: 1.3, d: 2, g: .035, a: .5, vib: 4, vibd: 5, rv: .8, pan: (i - 1) * .6 }));
  bells(t + .5, ['E6', 'B6', 'F#7'], .22, { ratio: 3.5, index: .8, d: 1.2, g: .03, rv: .8 });
});
add(SHIP, 'wind', 'High-altitude wind', 'A steady, whistling wind above the land.', t => { noise(t, { bp: 450, f2: 900, fg: 1.5, d: 3, g: .25, a: .8, q: 2 }); noise(t + .5, { bp: 1400, f2: 900, d: 2.4, g: .06, a: .6, q: 6, pan: .5 }); });
add(SHIP, 'crystal-flare', 'Crystal flare', "The ship's attack: a bright zap of focused sunstone light.", t => { tone(t, { f: 2000, to: 200, d: .35, g: .12, type: 'sawtooth', lp: 5000 }); fm(t, { f: 1760, ratio: 1.5, index: 2, d: .6, g: .06, rv: .5 }); });
add(SHIP, 'recharge', 'Sunstone recharging', 'A pulsing hum climbing to full.', t => tone(t, { f: 220, to: 660, d: 1.8, g: .12, type: 'triangle', a: .2, am: 8, amd: .9, rv: .3 }));
add(SHIP, 'aether-storm', 'Aether storm', 'Rolling thunder with an unnatural ringing shimmer.', t => { rumble(t, 2.6, .5); noise(t + .2, { hp: 1000, d: .1, g: .3 }); chord(t + .3, ['A5', 'Bb5'], { a: .6, d: 2, g: .03, vib: 3, vibd: 6, rv: .7 }); });
add(SHIP, 'rope-creak', 'Rigging creaks', 'Wooden joints and ropes straining.', t => { creak(t, .6, .07, 150); creak(t + .7, .5, .06, 190); });
add(SHIP, 'spyglass', 'Spyglass', 'Brass tubes sliding out, then a click.', t => { noise(t, { bp: 1500, f2: 4000, d: .35, g: .12, q: 4 }); click(t + .38, 3000, .2, .03); });
add(SHIP, 'serpent', 'Aether serpent', 'A huge, echoing, breathy call from something vast in the sky.', t => { tone(t, { f: 75, to: 55, d: 2, g: .2, type: 'sawtooth', bp: 600, q: 3, vib: 5, vibd: 6, a: .3, rv: .6 }); noise(t, { bp: 800, d: 1.8, g: .1, a: .4, rv: .5 }); });

/* ---- creatures ---- */
const MON = 'Creatures and foes';
add(MON, 'wolf', 'Wolf growl', 'A low, rumbling growl.', t => { noise(t, { lp: 450, d: 1, g: .35, am: 28, amd: .9, a: .1 }); tone(t, { f: 90, d: 1, g: .1, type: 'sawtooth', lp: 500, vib: 6, vibd: 5, a: .1 }); });
add(MON, 'boar', 'Boar squeal', 'A shrill, angry squeal.', t => tone(t, { f: 700, to: 1100, glide: .15, d: .45, g: .12, type: 'sawtooth', bp: 1500, q: 2, vib: 25, vibd: 60 }));
add(MON, 'bandit', 'Bandit battle cry', 'A rough shouted "Hey!"', t => { tone(t, { f: 180, to: 230, glide: .15, d: .5, g: .2, type: 'sawtooth', bp: 750, q: 3, vib: 6, vibd: 6 }); tone(t, { f: 180, to: 230, glide: .15, d: .5, g: .08, type: 'sawtooth', bp: 1250, q: 4 }); });
add(MON, 'slime', 'Slime squelch', 'A wet, bouncy squish.', t => { tone(t, { f: 180, to: 650, d: .12, g: .25 }); noise(t, { lp: 700, d: .15, g: .2 }); });
add(MON, 'skeleton', 'Skeleton rattle', 'Bones clattering.', t => { for (let i = 0; i < 12; i++) click(t + i * .04 + rnd(0, .02), rnd(1600, 2600), .16, .02, rnd(-.3, .3)); });
add(MON, 'bird', 'Bird of prey screech', 'A piercing screech from above.', t => tone(t, { f: 2400, to: 1700, d: .6, g: .08, type: 'sawtooth', bp: 3000, q: 3, vib: 22, vibd: 150 }));
add(MON, 'frog', 'Marsh frog croak', 'A deep double croak.', t => { tone(t, { f: 110, d: .3, g: .25, type: 'square', lp: 500, am: 30, amd: .9 }); tone(t + .38, { f: 105, d: .3, g: .25, type: 'square', lp: 500, am: 30, amd: .9 }); });
add(MON, 'insect', 'Insect swarm', 'A cloud of buzzing wings.', t => { tone(t, { f: 220, d: 1.5, g: .06, type: 'sawtooth', lp: 1500, am: 45, amd: .7, a: .3 }); tone(t, { f: 227, d: 1.5, g: .06, type: 'sawtooth', lp: 1500, am: 38, amd: .7, a: .3, pan: .4 }); });
add(MON, 'beast', 'Great beast roar', 'A deep, massive roar: a boss creature.', t => { tone(t, { f: 62, to: 46, d: 2, g: .25, type: 'sawtooth', bp: 400, f2: 900, q: 2, a: .15, vib: 7, vibd: 4, rv: .5 }); tone(t, { f: 63, to: 47, d: 2, g: .2, type: 'sawtooth', lp: 300, a: .15 }); noise(t, { bp: 700, d: 1.6, g: .2, a: .2 }); });
add(MON, 'ghost', 'Ghost wail', 'A hollow, drifting wail.', t => { tone(t, { f: 480, to: 760, glide: .7, d: 1.8, g: .08, vib: 5, vibd: 15, a: .4, rv: .7 }); noise(t, { hp: 3000, d: 1.6, g: .04, a: .5 }); });

/* ---- music cues and places ---- */
const CUE = 'Music cues and places';
add(CUE, 'victory', 'Victory', 'A short triumphant fanfare.', t => { arp(t, ['C5', 'C5', 'C5', 'C5'], .11, { type: 'square', d: .1, g: .06, lp: 3500 }); arp(t + .44, ['Ab4', 'Bb4', 'C5'], .15, { type: 'square', d: .2, g: .06, lp: 3500 }); chord(t + .9, ['C5', 'E5', 'G5', 'C6'], { type: 'square', d: 1, g: .035, lp: 3500, rv: .4 }); });
add(CUE, 'defeat', 'Defeat', 'A slow, sad falling phrase.', t => { arp(t, ['C5', 'Ab4', 'F4', 'D4'], .35, { type: 'triangle', d: .6, g: .09, rv: .5 }); chord(t + 1.4, ['D3', 'F3', 'Ab3'], { a: .2, d: 1.8, g: .06, rv: .5 }); });
add(CUE, 'boss', 'A boss appears', 'A dark brass stab, timpani and a crash.', t => { chord(t, ['C3', 'Eb3', 'G3', 'C4'], { type: 'sawtooth', a: .02, d: 1.2, g: .06, lp: 2000, f2: 600, rv: .4 }); for (let i = 0; i < 6; i++) thump(t + i * .06, .25 + i * .06, 90, .3); noise(t + .4, { hp: 4000, d: 1.2, g: .15, rv: .3 }); });
add(CUE, 'flee', 'Run away', 'A quick whoosh and scampering feet.', t => { whoosh(t, .3, .25, 2000, 400); for (let i = 0; i < 6; i++) click(t + .25 + i * .07, 1800, .1, .02, i % 2 ? .3 : -.3); });
add(CUE, 'quest', 'Quest complete', 'A bright rising phrase and a chime.', t => { arp(t, ['E5', 'G5', 'C6', 'E6'], .1, { type: 'triangle', d: .4, g: .09, rv: .3 }); fm(t + .45, { f: 2093, ratio: 3, index: 1.4, d: 1, g: .06, rv: .5 }); });
add(CUE, 'new-area', 'Entering a new area', 'A soft chord swelling in with a distant bell.', t => { chord(t, ['D4', 'A4', 'E5'], { a: .5, d: 2.2, g: .05, rv: .6 }); fm(t + .4, { f: 'A5', ratio: 2.4, index: 1.2, d: 1.6, g: .05, rv: .6 }); });
add(CUE, 'rain', 'Rain', 'Steady rain with scattered drops (a short sample of a looping sound).', t => { noise(t, { hp: 1800, d: 3, g: .12, a: .4 }); for (let i = 0; i < 40; i++) click(t + Math.random() * 2.8, rnd(3000, 7000), .05, .012, rnd(-.8, .8)); });
add(CUE, 'thunder', 'Thunderclap', 'A close crack and a long rumble.', t => { noise(t, { hp: 800, d: .12, g: .6 }); noise(t + .05, { lp: 1200, f2: 80, d: 2.4, g: .5, rv: .3 }); rumble(t + .1, 2.4, .4); });
add(CUE, 'campfire', 'Campfire', 'Crackling logs and a low warm hiss (a short sample of a loop).', t => { noise(t, { lp: 600, d: 3, g: .08, a: .3 }); crackle(t, 2.8, 30, .1); });
add(CUE, 'river', 'River', 'Running water (a short sample of a loop).', t => { noise(t, { lp: 1400, d: 3, g: .2, a: .5, am: 1.3, amd: .3 }); noise(t, { bp: 3000, d: 3, g: .05, a: .5, am: 2.1, amd: .5, pan: .4 }); });
add(CUE, 'bell', 'Town bell', 'A big bell tolling twice across the rooftops.', t => { fm(t, { f: 196, ratio: 2.4, index: 3, d: 2.5, g: .12, rv: .6 }); fm(t + 1.2, { f: 196, ratio: 2.4, index: 3, d: 2.5, g: .1, rv: .6 }); });
add(CUE, 'auros', 'Auros overhead', "The Moon's deep, slowly beating hum, heard on quiet nights.", t => { [55, 82.5, 110, 110.6].forEach((f, i) => tone(t, { f, d: 4, g: .07, a: 1.5, hold: 1, rv: .7, pan: (i - 1.5) * .3 })); noise(t, { hp: 6000, d: 4, g: .02, a: 1.5 }); });

/* ======== batch 2 (new) ======== */
const voice = (t, f, to, d, g, formants, o = {}) => formants.forEach(([bp, q, k]) => tone(t, { f, to, d, g: g * (k ?? 1), type: 'sawtooth', bp, q, a: o.a ?? .03, vib: o.vib ?? 6, vibd: o.vibd ?? 5, pan: o.pan, rv: o.rv }));

const GEAR = 'Weapons and gear (new)';
add(GEAR, 'sword-draw', 'Sword drawn', 'Steel sliding out of a scabbard with a bright ring.', t => { noise(t, { bp: 3500, f2: 7000, d: .35, g: .14, q: 5, a: .05 }); fm(t + .3, { f: 2200, ratio: 2.76, index: 1, d: .6, g: .05, rv: .3 }); });
add(GEAR, 'axe-chop', 'Axe chop', 'A heavy wedge biting into wood or armor.', t => { noise(t, { bp: 900, d: .12, g: .45, q: 1.5 }); thump(t, .5, 180, .2); click(t + .01, 1400, .3, .04); });
add(GEAR, 'mace', 'Mace blow', 'A studded club crunching down.', t => { thump(t, .7, 100, .3); noise(t, { lp: 2500, d: .12, g: .4 }); crackle(t + .02, .08, 4, .15); });
add(GEAR, 'crossbow', 'Crossbow bolt', 'A mechanical clack and a fast, heavy bolt.', t => { click(t, 1800, .35, .04); tone(t, { f: 120, to: 90, d: .1, g: .25, type: 'triangle' }); whoosh(t + .03, .15, .15, 3000, 6000); });
add(GEAR, 'bow-charge', 'Bow drawn back', 'The string creaking as a bow is pulled to full draw.', t => tone(t, { f: 90, to: 160, d: .8, g: .06, type: 'sawtooth', bp: 800, q: 6, vib: 25, vibd: 10, a: .2 }));
add(GEAR, 'staff-thump', 'Staff thump', 'A wooden staff striking the ground, calling magic.', t => { tone(t, { f: 160, to: 80, d: .25, g: .4, type: 'triangle' }); bells(t + .05, ['A5', 'E6'], .06, { ratio: 3, index: 1, d: .8, g: .04, rv: .5 }); });
add(GEAR, 'whip', 'Whip crack', 'A lashing crack.', t => { whoosh(t, .12, .12, 800, 4000); noise(t + .11, { hp: 2500, d: .04, g: .6 }); });
add(GEAR, 'knife-throw', 'Throwing knife', 'A spinning blade whistling through the air, then a thunk.', t => { noise(t, { bp: 3000, d: .3, g: .12, am: 28, amd: .9, q: 3 }); click(t + .3, 1200, .35, .05); });
add(GEAR, 'shield-up', 'Shield raised', 'A shield swung up with a leather creak and a solid bump.', t => { noise(t, { bp: 700, d: .15, g: .12, a: .06 }); thump(t + .12, .35, 160, .15); });
add(GEAR, 'armor-walk', 'Armor clanking', 'Plate armor jingling with each step.', t => { for (let i = 0; i < 4; i++) { fm(t + i * .3, { f: rnd(1500, 2000), ratio: 2.4, index: 1.5, d: .15, g: .04 }); click(t + i * .3 + .02, 2600, .1, .03); } });

const AE = 'Sunstone and the Ember Line (new)';
add(AE, 'shard-pickup', 'Sunstone shard picked up', 'A warm crystal hum rising as you take it.', t => { tone(t, { f: 330, to: 440, d: .8, g: .08, am: 7, amd: .4, rv: .5 }); bells(t + .1, ['E6', 'B6'], .1, { ratio: 3.5, index: 1, d: .7, g: .04, rv: .6 }); });
add(AE, 'vein-pulse', 'Ember Line pulse', 'A deep glowing throb through the stone underfoot.', t => { tone(t, { f: 55, d: 1.4, g: .3, a: .2, am: 1.4, amd: .9 }); tone(t, { f: 110, d: 1.4, g: .08, a: .2, am: 1.4, amd: .9, rv: .5 }); });
add(AE, 'resonance', 'Resonance cascade', 'Every crystal nearby ringing at once, voices and music in the hum.', t => { bells(t, ['D5', 'A5', 'E6', 'B6', 'F#7', 'C#7', 'G#6'], .07, { ratio: 3.5, index: 1.2, d: 1.8, g: .04, rv: .7 }); chord(t, ['D3', 'A3', 'E4'], { a: .4, d: 2.2, g: .04, rv: .7, vib: 3, vibd: 3 }); });
add(AE, 'egg-heartbeat', 'The egg-stone', 'A quick, alive heartbeat inside warm amber.', t => { for (let i = 0; i < 4; i++) { tone(t + i * .45, { f: 90, to: 60, d: .15, g: .35 }); tone(t + i * .45 + .15, { f: 80, to: 55, d: .15, g: .22 }); } bells(t, ['G#6'], 1, { ratio: 3.5, index: .6, d: 1.8, g: .02, rv: .7 }); });
add(AE, 'warm-road', 'The Warm Roads', 'Warm water flowing through ancient tunnels, with a low hum beneath.', t => { noise(t, { lp: 900, d: 3, g: .15, a: .6, am: 1.1, amd: .4, rv: .4 }); tone(t, { f: 73, d: 3, g: .1, a: 1, rv: .5 }); });
add(AE, 'node-wake', 'A node awakens', 'Stone lines lighting up one by one, building to a bright chord.', t => { arp(t, ['D4', 'A4', 'D5', 'F#5', 'A5', 'D6'], .18, { type: 'triangle', d: 1.4, g: .06, rv: .6 }); thump(t + 1.1, .4, 70, .8); chord(t + 1.1, ['D5', 'F#5', 'A5'], { a: .1, d: 1.6, g: .05, rv: .7 }); });
add(AE, 'sealed-door', 'Ancient sealed door', 'A huge stone door grinding open, seals breaking.', t => { noise(t, { lp: 400, d: 2, g: .35, a: .3, am: 9, amd: .6 }); rumble(t, 2, .3); fm(t + 1.8, { f: 147, ratio: 2.4, index: 2, d: 1.5, g: .08, rv: .6 }); });
add(AE, 'time-slip', 'Time slip', 'A warped, stretching sound: hours pass in a moment (the Driftlands).', t => { tone(t, { f: 880, to: 110, d: 1.5, g: .07, vib: 3, vibd: 40, rv: .8 }); tone(t, { f: 110, to: 880, d: 1.5, g: .05, vib: 5, vibd: 30, rv: .8, pan: .5 }); noise(t, { bp: 2000, f2: 200, d: 1.5, g: .06, q: 10 }); });
add(AE, 'luminal', 'Luminal tide', 'The Aether brightening: a soft golden swell of light.', t => { chord(t, ['A4', 'C#5', 'E5', 'B5'], { a: 1, d: 3, g: .04, rv: .8 }); noise(t, { hp: 7000, d: 3, g: .02, a: 1.2 }); });
add(AE, 'doldrums', 'The Doldrums', 'Lift failing: a sinking, groaning drop in pitch.', t => { tone(t, { f: 220, to: 70, d: 2.2, g: .1, type: 'triangle', rv: .5 }); creak(t + .5, .8, .06, 120); noise(t, { bp: 300, d: 2, g: .08, a: .6 }); });

const SHIP2 = 'The airship, more (new)';
add(SHIP2, 'crystal-cannon', 'Crystal cannon', 'A booming shot of focused sunstone light.', t => { thump(t, .9, 90, .6); tone(t, { f: 1500, to: 150, d: .5, g: .1, type: 'sawtooth', lp: 4000 }); noise(t, { lp: 3000, f2: 200, d: .6, g: .35, rv: .3 }); });
add(SHIP2, 'hull-hit', 'Hull struck', 'Wood splintering under a hit, the ship shuddering.', t => { thump(t, .7, 90, .4); crackle(t, .25, 12, .2); creak(t + .2, .5, .05, 110); });
add(SHIP2, 'deck-alarm', 'Deck alarm bell', 'A ship bell rung fast: all hands.', t => { for (let i = 0; i < 6; i++) fm(t + i * .16, { f: 1320, ratio: 2.4, index: 2, d: .4, g: .07, rv: .3 }); });
add(SHIP2, 'dock-clamp', 'Docking clamps', 'Heavy clamps locking onto the mooring mast.', t => { click(t, 900, .4, .06); thump(t, .4, 150, .15); click(t + .25, 1100, .4, .06); fm(t + .25, { f: 700, ratio: 2.1, index: 2, d: .3, g: .05 }); });
add(SHIP2, 'grapple', 'Raider grappling hook', 'A hook thrown over, chain rattling, and it bites into the rail.', t => { whoosh(t, .3, .15, 600, 2000); for (let i = 0; i < 6; i++) fm(t + .3 + i * .04, { f: rnd(2000, 2600), ratio: 2.1, index: 1.5, d: .1, g: .04 }); click(t + .6, 1500, .4, .05); });
add(SHIP2, 'upgrade', 'Ship upgrade installed', 'Tools, a satisfying clunk, then the crystals humming stronger.', t => { click(t, 2000, .2, .03); click(t + .12, 1800, .2, .03); thump(t + .3, .4, 140, .15); tone(t + .45, { f: 220, to: 440, d: .9, g: .07, am: 9, amd: .5, rv: .5 }); arp(t + .8, ['A5', 'E6'], .1, { type: 'triangle', d: .5, g: .07, rv: .4 }); });
add(SHIP2, 'altitude', 'Altitude warning', 'A pulsing tone as the ship nears the Thinning.', t => { for (let i = 0; i < 3; i++) tone(t + i * .35, { f: 660, to: 620, d: .25, g: .08, type: 'triangle', rv: .2 }); });
add(SHIP2, 'deck-steps', 'Footsteps on deck', 'Boots on hollow ship planks, a creak under them.', t => { for (let i = 0; i < 4; i++) tone(t + i * .3, { f: 140, d: .12, g: .22, type: 'triangle', lp: 600 }); creak(t + .5, .4, .04, 170); });

const TOWN = 'Towns and people (new)';
add(TOWN, 'market', 'Market murmur', 'A crowd chattering in a busy square (a short sample of a loop).', t => { for (let i = 0; i < 16; i++) voice(t + rnd(0, 2.5), rnd(140, 260), rnd(140, 260), rnd(.2, .4), .025, [[rnd(500, 900), 4], [rnd(1100, 1800), 5, .6]], { pan: rnd(-.8, .8), vib: rnd(3, 7), vibd: 8, rv: .3 }); noise(t, { bp: 1000, d: 3, g: .03, a: .4 }); });
add(TOWN, 'anvil', 'Blacksmith at the anvil', 'Hammer ringing on hot steel, three strikes.', t => { for (let i = 0; i < 3; i++) { fm(t + i * .45, { f: 1800 - i * 40, ratio: 2.76, index: 3, d: .6, g: .12, rv: .3 }); thump(t + i * .45, .2, 200, .08); } });
add(TOWN, 'tavern-mugs', 'Tavern mugs clink', 'Two tankards knocked together: cheers.', t => { tone(t, { f: 700, d: .15, g: .2, type: 'triangle', lp: 1500 }); tone(t + .01, { f: 820, d: .15, g: .15, type: 'triangle', lp: 1500 }); noise(t + .05, { bp: 800, d: .3, g: .06 }); });
add(TOWN, 'shop-bell', 'Shop door bell', 'The little bell above a shop door.', t => bells(t, ['E6', 'C6', 'E6'], .09, { ratio: 3.01, index: .8, d: .6, g: .06, rv: .3 }));
add(TOWN, 'hammer-wood', 'Carpenter hammering', 'Nails going into wood, a steady rhythm.', t => { for (let i = 0; i < 5; i++) { click(t + i * .35, 1800, .3, .03); tone(t + i * .35, { f: 250, d: .06, g: .15, type: 'triangle' }); } });
add(TOWN, 'dog', 'Dog barks', 'Two sharp barks.', t => { for (const x of [0, .3]) voice(t + x, 420, 300, .14, .12, [[800, 3], [1600, 4, .5]], { vib: 0, vibd: 0 }); });
add(TOWN, 'croc', 'Crocodilian bellow', 'A deep, rumbling bellow from a great marsh mount.', t => { noise(t, { lp: 250, d: 1.4, g: .45, am: 18, amd: .9, a: .15 }); tone(t, { f: 45, d: 1.4, g: .2, a: .15, am: 18, amd: .8 }); });
add(TOWN, 'chickens', 'Chickens clucking', 'A few hens pecking about.', t => { for (let i = 0; i < 6; i++) voice(t + i * .22 + rnd(0, .1), rnd(500, 700), rnd(400, 900), .1, .05, [[1200, 5], [2400, 6, .5]], { vib: 0, vibd: 0, pan: rnd(-.5, .5) }); });
add(TOWN, 'well-bucket', 'Well bucket', 'A rope creaking and a bucket splashing up full.', t => { creak(t, .8, .06, 200); noise(t + .9, { bp: 1100, f2: 500, d: .4, g: .25 }); });
add(TOWN, 'clock', 'Clock tower chime', 'Four notes from a tower clock.', t => bells(t, ['E5', 'C5', 'D5', 'G4'], .55, { ratio: 2.4, index: 1.8, d: 1.8, g: .08, rv: .6 }));

const NAT = 'Nature and weather (new)';
add(NAT, 'birdsong', 'Morning birdsong', 'Small birds trilling in the trees.', t => { for (let i = 0; i < 10; i++) { const f = rnd(2500, 4200); tone(t + rnd(0, 2.5), { f, to: f * rnd(.7, 1.4), d: rnd(.08, .2), g: .04, vib: 30, vibd: 200, pan: rnd(-.8, .8), rv: .3 }); } });
add(NAT, 'crickets', 'Crickets at night', 'A chorus of crickets.', t => { for (const [f, p] of [[4200, -.6], [4600, .1], [5000, .6]]) tone(t, { f, d: 3, g: .02, a: .4, am: 32, amd: 1, pan: p }); });
add(NAT, 'owl', 'Owl hoot', 'A soft hoot in the dark woods.', t => { tone(t, { f: 420, to: 380, d: .35, g: .1, a: .05, lp: 800, rv: .6 }); tone(t + .5, { f: 400, to: 360, d: .6, g: .1, a: .05, lp: 800, rv: .6 }); });
add(NAT, 'waterfall', 'Waterfall', 'A roaring, steady fall of water (a short sample of a loop).', t => { noise(t, { lp: 3000, d: 3, g: .3, a: .5 }); noise(t, { lp: 250, d: 3, g: .3, a: .5 }); });
add(NAT, 'leaves', 'Leaves in the wind', 'Branches swaying and leaves rustling.', t => noise(t, { bp: 3500, d: 2.8, g: .1, a: .8, am: 3, amd: .7, q: .8 }));
add(NAT, 'sandstorm', 'Sandstorm', 'Wind howling and sand hissing everywhere.', t => { noise(t, { bp: 600, f2: 1400, fg: 1.5, d: 3, g: .3, a: .7, q: 2 }); noise(t, { hp: 4000, d: 3, g: .08, a: 1 }); });
add(NAT, 'blizzard', 'Mountain blizzard', 'An icy, moaning gale on the high peaks.', t => { noise(t, { bp: 350, f2: 900, fg: 1.5, d: 3, g: .3, a: .9, q: 5 }); noise(t + 1, { bp: 1300, f2: 700, d: 2, g: .1, q: 8, pan: .5 }); });
add(NAT, 'lava', 'Lava bubbling', 'Thick molten rock blorping and hissing.', t => { for (let i = 0; i < 7; i++) tone(t + rnd(0, 2.4), { f: rnd(60, 110), to: rnd(150, 250), d: .25, g: .18 }); noise(t, { lp: 700, d: 3, g: .1, a: .5 }); crackle(t, 2.6, 10, .06); });
add(NAT, 'cave-drip', 'Cave drips', 'Water dripping in a deep, echoing cave.', t => { for (let i = 0; i < 5; i++) tone(t + i * .55 + rnd(0, .2), { f: rnd(1200, 2000), to: rnd(2400, 3200), d: .06, g: .08, rv: .9 }); });
add(NAT, 'sea', 'Sea waves and gulls', 'Waves washing on a shore, gulls crying.', t => { noise(t, { lp: 900, d: 3, g: .3, a: 1.2, am: .35, amd: .9 }); for (let i = 0; i < 3; i++) tone(t + .5 + i * .7, { f: 1600, to: 1100, d: .3, g: .04, type: 'sawtooth', bp: 1800, q: 4, vib: 12, vibd: 60, pan: .4 }); });

const MON2 = 'Creatures, more (new)';
add(MON2, 'scorpion', 'Giant scorpion', 'Chitin clicking and claws snapping.', t => { for (let i = 0; i < 10; i++) click(t + i * .07, rnd(3000, 5000), .18, .015, rnd(-.4, .4)); click(t + .8, 1500, .5, .05); });
add(MON2, 'lizardfolk', 'Lizardfolk clicks', 'The rapid clicking speech of the lizardfolk.', t => { for (let i = 0; i < 9; i++) click(t + i * .09 + (i > 4 ? .2 : 0), rnd(1800, 2600), .22, .02); noise(t + 1.1, { bp: 3000, d: .4, g: .08, a: .1 }); });
add(MON2, 'spider', 'Giant spider', 'Many legs skittering fast across stone.', t => { for (let i = 0; i < 24; i++) click(t + i * .035, rnd(4000, 7000), .12, .012, rnd(-.6, .6)); });
add(MON2, 'bear', 'Bear roar', 'A huge, open-throated roar.', t => { voice(t, 110, 80, 1.3, .2, [[500, 3], [900, 4, .6]], { a: .1, vib: 8, vibd: 6, rv: .3 }); noise(t, { bp: 600, d: 1.2, g: .15, a: .1 }); });
add(MON2, 'bats', 'Bat swarm', 'A flurry of wings and high squeaks.', t => { noise(t, { bp: 1500, d: 1.5, g: .12, am: 22, amd: .9, a: .2 }); for (let i = 0; i < 8; i++) tone(t + rnd(0, 1.3), { f: rnd(5000, 7000), d: .03, g: .03, pan: rnd(-.8, .8) }); });
add(MON2, 'sand-serpent', 'Sand serpent', 'A long, dry hiss and scales grinding through sand.', t => { noise(t, { hp: 3000, d: 1.2, g: .2, a: .2 }); noise(t, { bp: 400, d: 1.4, g: .15, am: 12, amd: .7 }); });
add(MON2, 'golem', 'Stone golem stomps', 'Heavy stone feet shaking the ground.', t => { for (let i = 0; i < 3; i++) { thump(t + i * .7, .9, 70, .5); crackle(t + i * .7, .2, 5, .12); } });
add(MON2, 'wisp', 'Will-o-wisp', 'A tinkling, teasing little light.', t => { bells(t, ['A6', 'C#7', 'E7', 'A7', 'E7'], .08, { ratio: 3.5, index: .8, d: .5, g: .04, rv: .7 }); tone(t, { f: 1760, to: 2200, d: .8, g: .02, vib: 9, vibd: 40, rv: .7 }); });
add(MON2, 'owlbear', 'Owlbear screech', 'Half hoot, half roar: a terrible screech.', t => { voice(t, 350, 220, .9, .15, [[900, 4], [2200, 6, .5]], { a: .05, vib: 11, vibd: 25 }); noise(t, { bp: 1200, d: .8, g: .12 }); });
add(MON2, 'rot-beast', 'Rot-corrupted beast', 'A sick, gurgling growl.', t => { noise(t, { lp: 350, d: 1.2, g: .35, am: 14, amd: .9 }); for (let i = 0; i < 4; i++) tone(t + rnd(0, 1), { f: rnd(80, 140), to: rnd(200, 300), d: .15, g: .12 }); });

const BAT2 = 'Battle, more (new)';
add(BAT2, 'foe-down', 'Foe defeated', 'A foe falls and fades away.', t => { thump(t, .4, 110, .25); noise(t + .1, { hp: 3000, f2: 9000, d: .6, g: .08, a: .1 }); arp(t + .15, ['E5', 'B4'], .1, { type: 'triangle', d: .4, g: .06 }); });
add(BAT2, 'summon', 'Foe calls help', 'A foe summons more to its side.', t => { tone(t, { f: 200, to: 600, d: .6, g: .1, type: 'sawtooth', lp: 1500, rv: .4 }); for (let i = 0; i < 3; i++) whoosh(t + .4 + i * .15, .3, .15, 400, 1500, (i - 1) * .6); });
add(BAT2, 'counter', 'Counterattack', 'A quick parry flowing into a strike back.', t => { fm(t, { f: 1500, ratio: 2.76, index: 2, d: .3, g: .1 }); noise(t + .15, { bp: 2500, f2: 6000, d: .15, g: .35, q: 2 }); });
add(BAT2, 'dodge', 'Dodge', 'A quick sidestep, the blow whiffing past.', t => { whoosh(t, .18, .25, 1500, 400, .4); noise(t + .05, { bp: 1500, d: .06, g: .08 }); });
add(BAT2, 'shield-break', 'Guard broken', 'A shield or guard shattering.', t => { fm(t, { f: 900, ratio: 2.76, index: 4, d: .4, g: .12 }); crackle(t, .3, 14, .25); thump(t, .5, 120, .25); });
add(BAT2, 'combo', 'Combo strikes', 'Three hits in a fast rhythm, the last one heavy.', t => { noise(t, { bp: 3000, d: .08, g: .3 }); noise(t + .12, { bp: 3500, d: .08, g: .3 }); thump(t + .26, .6, 140, .3); noise(t + .26, { bp: 2000, f2: 6000, d: .2, g: .4 }); });
add(BAT2, 'foe-charge', 'Foe winds up', 'A warning: a foe gathering a big attack.', t => { tone(t, { f: 150, to: 450, d: 1, g: .1, type: 'sawtooth', lp: 900, f2: 3000, a: .3, am: 10, amd: .5 }); });
add(BAT2, 'buff-end', 'Effect wears off', 'A soft falling fizzle as a spell fades.', t => { tone(t, { f: 900, to: 300, d: .5, g: .06, type: 'triangle' }); noise(t, { hp: 5000, f2: 2000, d: .4, g: .04 }); });
add(BAT2, 'mp-restore', 'Magic restored', 'A cool, bubbling rise of blue energy.', t => { for (let i = 0; i < 6; i++) tone(t + i * .06, { f: 500 + i * 120, to: 700 + i * 150, d: .12, g: .06 }); chord(t + .35, ['A5', 'E6'], { d: .7, g: .04, rv: .5 }); });
add(BAT2, 'flee-fail', "Can't escape", 'A stumble and a thud: the way is blocked.', t => { whoosh(t, .2, .2, 500, 1200); thump(t + .2, .45, 90, .2); tone(t + .3, { f: 200, to: 150, d: .2, g: .08, type: 'square', lp: 700 }); });

const UI2 = 'Menus, more (new)';
add(UI2, 'map-open', 'Map unrolled', 'Parchment unrolling across a table.', t => { noise(t, { hp: 2000, d: .5, g: .12, a: .1, am: 20, amd: .5 }); click(t + .5, 1500, .12, .03); });
add(UI2, 'quest-take', 'Quest accepted', 'A quill scratch and a firm stamp.', t => { noise(t, { bp: 5000, d: .3, g: .06, q: 6, am: 15, amd: .8 }); thump(t + .35, .45, 160, .12); });
add(UI2, 'notify', 'Something new', 'A gentle two-note ping for a new entry or message.', t => bells(t, ['A5', 'D6'], .1, { ratio: 3.01, index: .7, d: .6, g: .06, rv: .3 }));
add(UI2, 'toggle', 'Switch toggled', 'A soft, tactile click.', t => { click(t, 3000, .15, .02); tone(t, { f: 1200, d: .03, g: .04, type: 'square', lp: 3000 }); });
add(UI2, 'forge-good', 'Forge: temper succeeds', 'Hammer, a hiss of quench, and a bright ring: stronger.', t => { fm(t, { f: 1700, ratio: 2.76, index: 3, d: .5, g: .1 }); noise(t + .3, { hp: 3000, d: .7, g: .12, a: .05 }); arp(t + .6, ['C6', 'E6', 'G6'], .07, { type: 'triangle', d: .5, g: .07, rv: .4 }); });
add(UI2, 'forge-bad', 'Forge: temper fails', 'Hammer, then a dull crack: it did not take.', t => { fm(t, { f: 1700, ratio: 2.76, index: 3, d: .4, g: .1 }); noise(t + .35, { lp: 900, d: .2, g: .3 }); tone(t + .4, { f: 180, to: 120, d: .3, g: .1, type: 'square', lp: 600 }); });

const CUE2 = 'Story moments (new)';
add(CUE2, 'secret', 'Secret found', 'A little mysterious flourish: you found something hidden.', t => arp(t, ['G5', 'F#5', 'D#5', 'A4', 'G#4', 'E5', 'G#5', 'C6'], .09, { type: 'triangle', d: .35, g: .07, rv: .4 }));
add(CUE2, 'treasure-map', 'Treasure map found', 'A pirate-y rising phrase and a coin.', t => { arp(t, ['D5', 'F5', 'A5', 'D6'], .12, { type: 'square', d: .2, g: .05, lp: 3000 }); fm(t + .5, { f: 2600, ratio: 2.4, index: 1, d: .4, g: .06 }); });
add(CUE2, 'mystery', 'Mystery revealed', 'A slow, uneasy chord that turns to wonder.', t => { chord(t, ['D4', 'F4', 'Ab4'], { a: .4, d: 1.4, g: .05, rv: .6 }); chord(t + 1.1, ['D4', 'F#4', 'A4', 'E5'], { a: .3, d: 1.8, g: .05, rv: .7 }); });
add(CUE2, 'chapter', 'New chapter', 'A proud brass-and-bell opening.', t => { chord(t, ['G3', 'D4', 'G4', 'B4'], { type: 'sawtooth', a: .08, d: 1.6, g: .04, lp: 2400, rv: .5 }); bells(t + .2, ['G5', 'D6', 'G6'], .15, { ratio: 3, index: 1.2, d: 1.2, g: .05, rv: .5 }); thump(t, .6, 80, .6); });
add(CUE2, 'nightfall', 'Night falls', 'A soft falling phrase as the light goes.', t => { arp(t, ['E5', 'C5', 'A4', 'E4'], .35, { type: 'sine', d: .9, g: .07, rv: .7 }); tone(t, { f: 4400, d: 2.5, g: .01, a: 1, am: 32, amd: 1 }); });
add(CUE2, 'dawn', 'Dawn breaks', 'A warm rising phrase and birdsong.', t => { arp(t, ['C5', 'E5', 'G5', 'C6', 'D6'], .3, { type: 'triangle', d: .9, g: .07, rv: .6 }); for (let i = 0; i < 4; i++) tone(t + .8 + i * .25, { f: 3200, to: 4200, d: .1, g: .03, vib: 30, vibd: 200 }); });
add(CUE2, 'sedrin', 'Sedrin appears', "A short theme for crossing paths with Sedrin: low marsh drums and a proud call.", t => { for (let i = 0; i < 3; i++) thump(t + i * .22, .45, 90, .25); arp(t + .6, ['D4', 'A4', 'G4', 'D5'], .2, { type: 'triangle', d: .6, g: .09, rv: .5 }); noise(t + .6, { lp: 400, d: 1.2, g: .08, am: 18, amd: .9 }); });
add(CUE2, 'lira', "Lira's voice", 'A young voice layered over a resonant chamber hum: eerie, not hostile.', t => { voice(t, 330, 300, 1.8, .06, [[800, 6], [1200, 7, .6]], { a: .3, vib: 5, vibd: 6, rv: .8 }); voice(t, 165, 150, 1.8, .05, [[500, 5]], { a: .3, vib: 3, vibd: 2, rv: .8 }); tone(t, { f: 110, d: 2, g: .08, a: .4, am: 2, amd: .6, rv: .7 }); });

export const SFX = S;

// Shared with the music (music.js): the voices, and a way to route a whole piece through its own bus and echo.
export { tone, noise, fm, hz, rnd };
export function withBus(bus, rev, echo, fn) { const b = BUS, r = BUSREV, e = ECHO; BUS = bus; BUSREV = rev; ECHO = echo; try { fn(); } finally { BUS = b; BUSREV = r; ECHO = e; } }
export const sfxNodes = () => ({ AC, OUT, REV });

// Play one sound at its measured level (LEVEL, written by tools/level.mjs from offline renders), on a bus of its own.
export function playSfx(sound, t) {
  const e = typeof sound === 'string' ? S.find(x => x.id === sound) : sound;
  if (!e || !AC) return;
  const k = LEVEL[e.id] ?? 1;
  BUS = AC.createGain(); BUS.gain.value = k; BUS.connect(OUT);
  BUSREV = AC.createGain(); BUSREV.gain.value = k; BUSREV.connect(REV);
  try { e.play(t ?? AC.currentTime + .02); } finally { BUS = null; BUSREV = null; }
}

// LEVEL: GENERATED
const LEVEL = {'ui-cursor': 7.83, 'ui-confirm': 2.08, 'ui-back': 2.49, 'ui-error': 2.54, 'ui-open': 6.13, 'ui-close': 5.79, 'ui-page': 2.89, 'ui-blip': 3.48, 'ui-save': 1.66, 'ui-buy': 3.61, 'hit-slash': 7.86, 'hit-blunt': 1.52, 'hit-thrust': 6.7, 'bow-shot': 5.78, 'arrow-hit': 7.08, 'dagger': 6.15, 'crit': 2.31, 'graze': 14.27, 'miss': 5.92, 'parry': 3.71, 'shield-bash': 1.77, 'dice-roll': 8.66, 'dice-land': 9.76, 'turn': 4.06, 'burn': 6.43, 'chill': 4.42, 'poison': 5.43, 'rot': 7.9, 'stagger': 9.95, 'fear': 3.05, 'charm': 3.85, 'hex': 7.04, 'ward': 2.67, 'haste': 8.02, 'regen': 4.13, 'ko': 1.08, 'ember': 3.21, 'frost': 2.5, 'storm': 2.76, 'stone': 3.37, 'verdant': 3.83, 'tide': 1.48, 'radiant': 3.01, 'blight': 4.54, 'heal': 2.04, 'revive': 2.94, 'surge-charge': 3.93, 'surge-release': 1.55, 'grip-crack': 2.28, 'relic-drop': 5.12, 'reveal-common': 3.87, 'reveal-heirloom': 3.36, 'reveal-primal': 2.42, 'equip': 8.37, 'levelup': 3.05, 'chest': 4.96, 'coins': 7.19, 'identify': 3.93, 'step-grass': 3.87, 'step-stone': 3.35, 'step-wood': 1.83, 'step-water': 7.2, 'door': 15.68, 'bump': 3.24, 'alert': 4.96, 'stairs': 2.79, 'hearthfire': 2.86, 'sign': 3, 'ship-takeoff': 2.21, 'ship-land': 1.09, 'sails': 5.23, 'wind': 12.41, 'crystal-flare': 7.2, 'recharge': 3.92, 'aether-storm': 1.75, 'rope-creak': 16, 'spyglass': 13.86, 'serpent': 5.58, 'wolf': 4.13, 'boar': 16, 'bandit': 10.61, 'slime': 4.14, 'skeleton': 15.73, 'bird': 16, 'frog': 1.29, 'insect': 3.59, 'beast': 2.56, 'ghost': 4.49, 'victory': 3.42, 'defeat': 3.17, 'boss': 1.23, 'flee': 5.01, 'quest': 4.97, 'new-area': 2.95, 'rain': 1.32, 'thunder': 1.9, 'campfire': 8.2, 'river': 2.87, 'bell': 4.96, 'auros': 0.82, 'sword-draw': 9.85, 'axe-chop': 2.34, 'mace': 1.59, 'crossbow': 5.29, 'bow-charge': 16, 'staff-thump': 3.26, 'whip': 0.79, 'knife-throw': 7.94, 'shield-up': 1.61, 'armor-walk': 12.28, 'shard-pickup': 7.2, 'vein-pulse': 0.93, 'resonance': 2.61, 'egg-heartbeat': 1.66, 'warm-road': 3.96, 'node-wake': 1.19, 'sealed-door': 3.52, 'time-slip': 5.48, 'luminal': 3.74, 'doldrums': 6.89, 'crystal-cannon': 1.08, 'hull-hit': 1.83, 'deck-alarm': 6.4, 'dock-clamp': 2.99, 'grapple': 9.67, 'upgrade': 1.23, 'altitude': 6.24, 'deck-steps': 2.26, 'market': 16, 'anvil': 1.62, 'tavern-mugs': 4.9, 'shop-bell': 5.99, 'hammer-wood': 2.71, 'dog': 7.61, 'croc': 1.64, 'chickens': 16, 'well-bucket': 6.15, 'clock': 5.27, 'birdsong': 8.39, 'crickets': 6.03, 'owl': 4.31, 'waterfall': 1.66, 'leaves': 5.73, 'sandstorm': 3.75, 'blizzard': 16, 'lava': 2.48, 'cave-drip': 6.1, 'sea': 16, 'scorpion': 8.6, 'lizardfolk': 12.27, 'spider': 10.86, 'bear': 4.54, 'bats': 8.43, 'sand-serpent': 1.68, 'golem': 0.6, 'wisp': 6.99, 'owlbear': 9.87, 'rot-beast': 4.05, 'foe-down': 3.29, 'summon': 7.67, 'counter': 4.01, 'dodge': 5.93, 'shield-break': 2.13, 'combo': 0.78, 'foe-charge': 4.47, 'buff-end': 9.95, 'mp-restore': 6.54, 'flee-fail': 1.18, 'map-open': 2.79, 'quest-take': 1.21, 'notify': 6.67, 'toggle': 16, 'forge-good': 2.75, 'forge-bad': 4.22, 'secret': 5.93, 'treasure-map': 8.02, 'mystery': 2.77, 'chapter': 1.95, 'nightfall': 5.93, 'dawn': 6, 'sedrin': 1.11, 'lira': 9};
// LEVEL: END
