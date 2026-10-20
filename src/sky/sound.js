// sound.js: what the game sounds like. It listens to the game's news (events.js) and answers it with sound, picks
// which of Chris's pieces of music plays, and keeps the sky itself sounding while the Captain flies.
//   the guns           the Captain's bow guns crack sharply, with a crystal zing on top; a broadside booms down the
//                      side gun by gun as it ripples (four to six booms however many guns, so a Man-o'-war's 24 cost
//                      what five do), then rolls on like thunder, deeper the heavier the guns (crystal power, a bigger
//                      ship); a raider's guns sound a little darker, a captain's louder; a Man-o'-war's broadside adds
//                      a slow second roll. Far guns are dull and late, like distant thunder: the flash comes first
//   shots landing      a woody knock and splinters on a hull, a ripping tear on sails, a glassy shatter on crystals; a
//                      hit on your own ship thuds through the deck. A broadside landing all at once swells one sound
//                      rather than starting ten. A near miss whizzes past on the side it passed
//   ships going down   a deep blast and groaning timbers, then smaller blasts walking along her hull; crystals dying in
//                      falling bells; a treasure ship giving up rings her bell; each wreck falls away with a long rush
//                      of air, a whump as she breaks through the cloud deck and, if she burned, a muffled boom below it.
//                      Your own ship going down: everything goes dull and far away
//   rewards            each shard gathered chimes, higher up the scale for each one of a run; spilled shards clink;
//                      the Surge fills the sails with a rush, and as the next one charges a hum climbs to full and a
//                      soft ping says it's ready; locking on clicks; a broadside loaded again clacks
//   tactics            loading another shot clacks like a crossbow drawn; a shot earned at sea rings like a charm; the
//                      crew patching her ring out with a hammer on an anvil; a raider readying her broadside at you
//                      gives a short rising call from her side (so one behind you, off the screen, is heard too)
//   Chris's effects    (sounds.js) for the moments they fit: setting sail and coming home, a wave arriving (an alarm, a
//                      boss's brass for a captain or a Man-o'-war, a pirate phrase for a treasure ship), a wave beaten,
//                      the ship lost, alarms when she's badly hurt, a soft chord on crossing into another region,
//                      buying and upgrading in port, her colours, the skies, the menus; a commendation, a star or an
//                      order paid (a chime and its shards clinking), a rank risen
//   the sky            wind rising with speed and height, gusts, the rigging whistling at full tilt or in a Surge, the
//                      crystals humming higher as she climbs (wavering near the Thinning, sour when they're cracked),
//                      timbers creaking (more in hard turns, or badly hurt), fire crackling when she burns; the wind
//                      muffled inside a cloud, and stronger in a storm, with rain hissing
//   the weather        (sky.js) a storm far off rumbling as it shows on the horizon, Chris's Aether storm as it rolls
//                      in, his thunderclap after each lightning strike (later and duller the further off it struck),
//                      and his wind in each gust
//   the music          (Chris's, music.js) Thareia on the title screen, Market Day in port, Sunstone Wind between
//                      waves (Gloomfen Drift over the Gloomfen, Sunscorch Road over the Sunscorch Wastes), Break the
//                      Grip for a wave of raiders, The Holder Wakes for a raider captain, a Man-o'-war or the ship going
//                      down. Pieces change only at those moments (and on crossing into another region between waves,
//                      not more than once in 20 s). It dips under your broadsides, blasts and banners
// Sounds play at their normal speed in slow motion. While tests run the game's clock without drawing (audio.quiet),
// the news is only counted, and so it is while the sound isn't running (turned off, or the page left) or the Sounds
// slider is at nothing: nothing is made then, not even the sky's sound. Another part of the game can play one of
// Chris's effects with effect(id, { at }) (its level is in CHRIS: add one there first).
import { on } from './events.js';
import { regionAt, CLOUD_Y, THINNING } from './world.js';
import { SURGE } from './flight.js';
import { whiteNoise } from '../audio/voices.js';
import { LEVELS } from '../audio/mixer.js';

// Chris's effects that are used, each at a level of its own: about what's wanted (its loudest twentieth of a second)
// over what it has, from offline recordings of each
export const CHRIS = {
  'shard-pickup': 1.9, coins: 4.9, 'ui-buy': 2.8, 'ui-confirm': 1.7, 'ui-back': 2.2, 'ui-open': 3.8, 'ui-close': 3.8, toggle: 8.5, 'ui-cursor': 4.3,
  notify: 2.6, sails: 3.2, wind: 4.9, 'rope-creak': 10, recharge: 1.3, alert: 4, boss: 0.77, victory: 3.1, defeat: 2.4, thunder: 1.1,
  'treasure-map': 4.5, 'ship-takeoff': 1.5, 'ship-land': 0.74, bell: 1.8, 'deck-alarm': 3.3, doldrums: 2.4, hex: 4.8, upgrade: 1.04,
  'dock-clamp': 1.1, haste: 2.6, charm: 2.2, anvil: 1.3, crossbow: 2, resonance: 1.6, 'map-open': 1.9, 'new-area': 1.85, 'aether-storm': 0.8,
};
// Chris's pieces, each at a level of its own (they aren't all as loud as each other)
export const PIECES = { title: 1.8, town: 1, flight: 1.5, marsh: 1.35, desert: 1.3, battle: 1, boss: 0.85 };
const CALM = { 'The Gloomfen': 'marsh', 'The Sunscorch Wastes': 'desert' };
// how a shard's chime climbs: a major pentatonic, an octave higher every five shards, at most 26 semitones up
const SCALE = [0, 2, 4, 7, 9];
// each upgrade's own sound, after the toolbox
const UPGRADE = { armour: 'anvil', canvas: 'map-open', drill: 'crossbow', crystals: 'resonance' };
// one of the ship's parts dropping below 30%
const LOW = { hull: 'deck-alarm', crystals: 'doldrums', sails: 'rope-creak' };
// the menu buttons' sounds (by id)
const BUTTONS = { 'btn-to-port': 'ui-confirm', 'btn-skies': 'ui-back', 'btn-pause': 'ui-open', 'btn-resume': 'ui-close', 'btn-sail-on': 'ui-confirm', 'btn-road': 'ui-confirm', 'btn-go-port': 'ui-back', 'btn-abandon': 'ui-back',
  'btn-settings-title': 'ui-open', 'btn-settings-port': 'ui-open', 'btn-settings-pause': 'ui-open', 'btn-settings-done': 'ui-close',
  'btn-howto': 'ui-open', 'btn-howto-done': 'ui-close', 'map-close': 'ui-close', 'pp-tab-ship': 'ui-cursor', 'pp-tab-upgrades': 'ui-cursor', 'pp-tab-colours': 'ui-cursor',
  'btn-log': 'map-open', 'btn-log-done': 'ui-close', 'log-tab-deeds': 'ui-cursor', 'log-tab-records': 'ui-cursor', 'log-tab-voyages': 'ui-cursor', 'btn-again': 'ui-confirm', 'btn-hc-port': 'ui-close',
  'btn-tips-again': 'toggle' };

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[(Math.random() * list.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The answers to the news, played into mixer M from recordings B (voices.js). `effect` plays one of Chris's (live
// only: none in an offline check). Each takes the event's payload; nothing in them makes anything but sound nodes
export function makeCues(M, B, { touch = false, effect = null } = {}) {
  const K = touch ? 4 : 6, KR = touch ? 3 : 5; // how many booms a broadside gets, the Captain's and a raider's
  const S = { lastWhiz: -9, lastChime: -9, lastLock: -9, lastWarn: -9 }; // (when each was last played)
  const hitKey = { player: { hull: 'ph', sails: 'ps', crystals: 'pc' }, raider: { hull: 'rh', sails: 'rs', crystals: 'rc' } };
  const PART = { hull: 'wood', sails: 'canvas', crystals: 'crystal' };
  const C = {};
  // a gun going off: the Captain's or a raider's; a chaser's crack, or one boom of a rippling broadside (and, with its
  // first gun, the broadside's roll of thunder)
  C.fire = (e) => {
    const mine = e.owner === 'player', broad = e.kind === 'broadside', w = e.weight || 1, cap = !!e.raider?.captain, t = M.now();
    const P = M.at(e.p, broad ? 0.35 : 0.2);
    if (P.cull) { M.stats.culled++; return; }
    const at = t + P.delay, deep = clamp(1 / Math.sqrt(w), 0.75, 1.25) * (cap ? 0.97 : 1), loud = cap ? 1.26 : 1, cat = mine ? 'gun' : 'foe';
    if (!broad) {
      const s = M.voice(cat, mine ? 2 : P.near * w, at);
      if (s) M.play(s, cat, mine ? 2 : P.near * w, pick(mine ? B.crack : B.crackR), at, deep * rnd(0.93, 1.07), (mine ? 0.75 : 0.7) * loud);
      return;
    }
    const n = e.n, k = Math.min(n, mine ? K : KR), prio = mine ? 3 : P.near * Math.min(1, n / 6) * w;
    if (e.i === 0) {
      // the roll of thunder after the guns, and the music dipping under it
      const level = Math.min(1, 0.35 + n / 16) * loud, s = M.voice(cat, prio + 0.1, at);
      if (s) M.play(s, cat, prio + 0.1, pick(B.roll), at + 0.04, 0.95 * deep * rnd(0.97, 1.03), level * 0.9);
      if (e.ship === 'manowar') { M.at(e.p, 0.6); const s2 = M.voice(cat, prio, at); if (s2) M.play(s2, cat, prio, B.roll[1], at + 0.25, 0.7, level * 0.8); }
      if (mine) M.dipMusic(-3, 0.35); else if (P.d < 250) M.dipMusic(-4, 0.3);
      M.at(e.p, 0.35);
    }
    // only k of the n guns boom, spread evenly down the side; together they're about k^0.45 times one, not n times
    if (Math.floor((e.i * k) / n) === Math.floor(((e.i - 1) * k) / n)) return;
    const s = M.voice(cat, prio, at);
    if (s) M.play(s, cat, prio, pick(B.boom), at + Math.random() * 0.008, deep * rnd(0.94, 1.06), (mine ? 0.95 : 0.9) * loud / Math.pow(k, 0.55));
  };
  // a shot landing: on the raider's (or the Captain's) hull, sails or crystals. A hit within 45 ms of another on the
  // same part swells that one instead of starting another
  C.hit = (e) => {
    const mine = e.target === 'player', t = M.now(), key = hitKey[e.target][e.part], m = M.merge('hit', key, 0.045);
    if (m) { try { m.g.gain.setTargetAtTime(Math.min(1.5, Math.sqrt(m.count)) * m.gain, t, 0.005); } catch { /* over */ } return; }
    const P = M.at(e.at, 0.15);
    if (P.cull) { M.stats.culled++; return; }
    const prio = mine ? 3 : P.near * 1.2, level = Math.min(1.1, 0.45 + (e.damage || 40) / 100), s = M.voice('hit', prio, t + P.delay);
    if (s) M.play(s, 'hit', prio, pick(B[PART[e.part]]), t + P.delay, rnd(0.92, 1.08), level * (mine ? 0.8 : 0.85), key);
    if (mine) {
      // felt through the deck (less for a hit in the sails)
      M.here(0, 0.05);
      const s2 = M.voice('hit', 3, t);
      if (s2) M.play(s2, 'hit', 3, B.thud[0], t, rnd(0.95, 1.05), e.part === 'sails' ? 0.4 : 0.75);
    }
  };
  // a raider's shot just missing: a whizz on the side it passed, sweeping away (at most one every 90 ms)
  C.nearMiss = (e) => {
    const t = M.now();
    if (t - S.lastWhiz < 0.09) return;
    S.lastWhiz = t;
    const pan = clamp(e.pan * 1.2, -1, 1);
    M.here(pan, 0.15);
    const s = M.voice('whiz', 1 + e.close, t);
    if (!s) return;
    M.play(s, 'whiz', 1 + e.close, pick(B.whiz), t, rnd(0.9, 1.12), 0.3 + 0.4 * e.close);
    if (s.pan) { s.pan.pan.setValueAtTime(pan, t); s.pan.pan.linearRampToValueAtTime(pan * 0.3, t + 0.4); }
  };
  // an explosion: the first, as she's blown apart (a great blast, carrying even from far off), or one of the chain
  // walking along her hull
  C.blast = (e) => {
    const t = M.now(), P = M.at(e.at, 0.4), first = !!e.first;
    if (!first && P.cull) return;
    const prio = first ? 2 + P.near : P.near, s = M.voice('blast', prio, t + P.delay);
    if (!s) return;
    if (first) { M.play(s, 'blast', prio, pick(B.blast), t + P.delay, clamp(1 / Math.sqrt(e.size / 25), 0.7, 1.3), e.big ? 1.1 : 0.95); M.dipMusic(-8, 1.2); }
    else M.play(s, 'blast', prio, pick(B.pop), t + P.delay, clamp(1 / Math.sqrt(e.size / 10), 0.75, 1.3) * rnd(0.9, 1.1), 0.5);
  };
  // a raider going down: (her blast is told as a blast) her crystals dying in falling bells, or a treasure ship ringing
  // her bell as she strikes her colours; and, whichever, the long fall
  C.down = (e) => {
    const t = M.now(), P = M.at(e.at, 0.4);
    if (e.why === 'crystals') { const s = M.voice('blast', 1.5, t + P.delay); if (s) M.play(s, 'blast', 1.5, B.crystalsDie[0], t + P.delay, 1, 0.8); M.dipMusic(-5, 1); }
    else if (e.why === 'struck') { effect?.('bell', CHRIS.bell, 'fx', P.delay); M.at(e.at, 0.4); const s = M.voice('hit', 1, t + P.delay); if (s) M.play(s, 'hit', 1, B.canvas[0], t + P.delay + 0.3, 0.7, 0.5); M.dipMusic(-4, 1); }
    M.at(e.at, 0.5);
    const s = M.voice('misc', 0.5, t + 1.2);
    if (s && !P.cull) M.play(s, 'misc', 0.5, B.fall[0], t + 1.2 + P.delay, rnd(0.9, 1.1), 0.45);
  };
  // a Man-o'-war's crystal column blowing out: a glassy shatter, then its crystals dying in falling bells
  C.blowout = (e) => {
    const t = M.now(), P = M.at(e.at, 0.4);
    if (P.cull) return;
    const s = M.voice('blast', 1.4, t + P.delay); if (s) M.play(s, 'blast', 1.4, B.crystalsDie[0], t + P.delay, 1.15, 0.75);
    const s2 = M.voice('hit', 1.4, t + P.delay); if (s2) M.play(s2, 'hit', 1.4, pick(B.crystal), t + P.delay, 0.8, 0.9);
  };
  // a wreck breaking through the cloud deck, and a burning one's muffled boom under it as she's gone
  C.deck = (e) => {
    const t = M.now(), P = M.at(e.at, 0.5);
    if (P.cull) return;
    const s = M.voice('misc', 0.6, t + P.delay);
    if (s) M.play(s, 'misc', 0.6, B.whump[0], t + P.delay, rnd(0.9, 1.1), Math.min(1, 0.4 + e.size / 40));
  };
  C.gone = (e) => {
    if (!e.fire) return;
    const t = M.now(), P = M.at(e.at, 0.8);
    if (P.cull) return;
    P.lp = Math.min(P.lp || 300, 300);
    const s = M.voice('blast', 0.4, t + 0.4 + P.delay);
    if (s) M.play(s, 'blast', 0.4, pick(B.blast), t + 0.4 + P.delay, 0.6, 0.8);
  };
  // a shard gathered: a chime, higher for each one of a run
  C.gather = (e) => {
    const t = M.now(), i = Math.max(0, e.run - 1), st = Math.min(26, SCALE[i % 5] + 12 * Math.floor(i / 5));
    if (t - S.lastChime < 0.03) return; // (two at once: the next one's higher anyway)
    S.lastChime = t;
    M.here(rnd(-0.25, 0.25), 0.3);
    const s = M.voice('chime', 1, t);
    if (s) M.play(s, 'chime', 1, B.chime[0], t, Math.pow(2, st / 12), 0.42);
  };
  // the guns locking on to a raider: a soft click (not more than once in 0.4 s)
  C.lock = () => {
    const t = M.now();
    if (t - S.lastLock < 0.4) return;
    S.lastLock = t;
    M.here(0, 0.05);
    const s = M.voice('ui', 0.5, t);
    if (s) M.play(s, 'ui', 0.5, B.tick[1], t, 1, 0.22, '', M.ui);
  };
  // a raider readying her broadside at you: a short rising call from her side, as loud from far as near (it's a
  // warning), not more than once in 0.6 s (two readying at once: one call)
  C.warn = (e) => {
    const t = M.now();
    if (t - S.lastWarn < 0.6 || !e.raider) return;
    S.lastWarn = t;
    const side = M.at(e.raider.f.pos, 0.1).pan / Math.max(0.35, 0.35 + 0.6 * M.P.near); // (which side, whatever the distance)
    M.here(clamp(side * 0.8, -0.8, 0.8), 0.12);
    const s = M.voice('ui', 1.5, t);
    if (s) M.play(s, 'ui', 1.5, B.warn[0], t, 1, 0.32);
  };
  // a broadside loaded and run out again: two wooden clacks
  C.ready = (e) => {
    if (e.firing) return;
    const t = M.now();
    M.here(e.battery === 'port' ? -0.5 : e.battery === 'starboard' ? 0.5 : 0, 0.05);
    for (let i = 0; i < 2; i++) { const s = M.voice('ui', 0.6, t + i * 0.045); if (s) M.play(s, 'ui', 0.6, B.clack[0], t + i * 0.045, rnd(0.95, 1.08), 0.3, '', M.ui); }
  };
  return C;
}

// The sky's own sound, made when a voyage starts and let go when it ends: wind (noise through two filters, with two
// slow gusts), the rigging's whistle, and the crystals' hum (two sines a hair apart, beating slowly, and a fifth
// above). set() turns its knobs from how the ship is flying
export function makeSky(M) {
  const ctx = M.ctx, nb = whiteNoise(ctx), nodes = [];
  const make = (fn) => { const n = fn(); nodes.push(n); return n; };
  const src = (rate) => make(() => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 1.5); return s; });
  const filt = (type, f, q) => make(() => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; });
  const gain = (v) => make(() => { const g = ctx.createGain(); g.gain.value = v; return g; });
  const osc = (type, f) => make(() => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; });
  // the wind, and its gusts
  const w = src(1), wbp = filt('bandpass', 400, 0.8), wlp = filt('lowpass', 1500, 0.7), wg = gain(0.03);
  w.connect(wbp); wbp.connect(wlp); wlp.connect(wg); wg.connect(M.amb);
  const g1 = osc('sine', 0.07), g1g = gain(0.01), g2 = osc('sine', 0.19), g2g = gain(0.006);
  g1.connect(g1g); g1g.connect(wg.gain); g2.connect(g2g); g2g.connect(wg.gain);
  // the rigging's whistle
  const r = src(0.97), rbp = filt('bandpass', 1800, 9), rg = gain(0);
  r.connect(rbp); rbp.connect(rg); rg.connect(M.amb);
  // rain hissing in a storm (silent until then)
  const rn = src(1.3), rhp = filt('highpass', 2600, 0.6), rlp = filt('lowpass', 9000, 0.5), rng = gain(0);
  rn.connect(rhp); rhp.connect(rlp); rlp.connect(rng); rng.connect(M.amb);
  // the crystals' hum
  const h1 = osc('sine', 98), h2 = osc('sine', 98 * 1.0065), h3 = osc('triangle', 147), h3g = gain(0.25), hg = gain(0), trem = osc('sine', 6), tg = gain(0);
  h1.connect(hg); h2.connect(hg); h3.connect(h3g); h3g.connect(hg); hg.connect(M.amb); trem.connect(tg); tg.connect(hg.gain);
  const glide = (p, v, tau = 0.3) => p.setTargetAtTime(v, M.now(), tau);
  return {
    // v: speed (1 = 60 m/s), h: height (1 = the Thinning), climb (-1..1), surging, crystals (0..1), near the cloud
    // deck or in a cloud (0..1), going down, and how stormy (0..1)
    set(v, h, climb, surging, crystals, cloud, down, storm = 0) {
      const k = down ? 0 : 1;
      glide(wbp.frequency, 260 + 900 * v + (surging ? 700 : 0) - 120 * cloud);
      glide(wlp.frequency, 900 + 3000 * v - 500 * cloud);
      glide(wg.gain, k * (0.035 + 0.16 * v * v + 0.045 * h + 0.08 * cloud + 0.07 * storm));
      glide(rng.gain, 0.05 * storm * storm, 0.8);
      glide(g1g.gain, 0.01 + 0.025 * v); glide(g2g.gain, 0.006 + 0.015 * v);
      glide(rbp.frequency, 1300 + 1400 * Math.min(1.2, v));
      glide(rg.gain, k * (Math.max(0, v - 0.55) * 0.18 + (surging ? 0.09 : 0)), 0.2);
      const f = 98 * Math.pow(2, (7 * h + 2 * climb) / 12);
      glide(h1.frequency, f, 0.5); glide(h2.frequency, f * (crystals < 0.5 ? 1.03 : 1.0065), 0.5); glide(h3.frequency, f * 1.5, 0.5);
      glide(hg.gain, k * (0.04 + 0.1 * h + 0.05 * Math.max(0, climb)) * (0.4 + 0.6 * crystals) * 0.5, 0.5);
      glide(tg.gain, h > (THINNING - 350) / THINNING ? 0.02 : 0, 0.5);
    },
    stop() {
      const t = M.now();
      for (const g of [wg, rg, hg, rng]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.1); }
      setTimeout(() => { for (const n of nodes) { try { n.stop?.(); n.disconnect(); } catch { /* gone */ } } }, 600);
    },
  };
}

// The game's sound: `audio` (audio.js), where the Captain's ship is (for the region's music), and the weather now
// (sky.js: how stormy, how deep in mist)
export function makeSound({ audio, touch = false, where = () => null, weather = () => null }) {
  const stats = audio.stats;
  let cues = null, sky = null, mode = 'title';
  // the answers, once the sound is on and its recordings made
  const live = () => {
    if (!audio.ready || !audio.hearing()) return null;
    return (cues ??= makeCues(audio.mixer, audio.bank, { touch, effect: audio.effect }));
  };
  const M = () => audio.mixer;
  // one of Chris's effects: in the menus, or on the ship (P: M.here or M.at, just before)
  const fx = (id, bus = 'ui', delay = 0, scale = 1) => { if (!audio.mixer || audio.quiet) return; if (bus === 'ui') audio.mixer.here(0, 0.15); audio.effect(id, CHRIS[id] * scale, bus, delay); };
  // each piece of news: counted, then answered (unless only counting)
  const cue = (name, f) => on(name, (e) => {
    stats.events[name] = (stats.events[name] ?? 0) + 1;
    if (audio.quiet || !audio.mixer) return;
    const t0 = performance.now(); f(e); stats.ms += performance.now() - t0; stats.cues++;
  });
  const withCues = (f) => (e) => { const c = live(); if (c) f(c, e); };

  // ---------- the fight ----------
  cue('fire', withCues((c, e) => c.fire(e)));
  cue('hit', withCues((c, e) => c.hit(e)));
  cue('nearMiss', withCues((c, e) => c.nearMiss(e)));
  cue('blast', withCues((c, e) => c.blast(e)));
  cue('raider:down', withCues((c, e) => c.down(e)));
  cue('wreck:deck', withCues((c, e) => c.deck(e)));
  cue('wreck:gone', withCues((c, e) => c.gone(e)));
  cue('shards:gather', withCues((c, e) => { c.gather(e); if (e.run === 1) { M().here(0, 0.3); audio.effect('shard-pickup', CHRIS['shard-pickup'], 'fx', 0, 0.4); } }));
  cue('shards:spill', (e) => { if (!audio.mixer) return; const P = M().at(e.at, 0.3); if (!P.cull) audio.effect('coins', CHRIS.coins, 'fx', P.delay); });
  cue('lock', withCues((c, e) => c.lock(e)));
  cue('guns:ready', withCues((c, e) => c.ready(e)));
  cue('warn', withCues((c, e) => c.warn(e)));
  cue('raider:escaped', () => fx('hex'));
  cue('shot', (e) => fx(e.why === 'earned' ? 'charm' : 'crossbow', 'ui', 0, e.why === 'earned' ? 1 : 0.6));
  cue('patch', (e) => { if (e.stage === 'start') fx('anvil', 'ui', 0, 0.55); });
  // a Man-o'-war's crystal column blowing out: a glassy shatter and crystals dying in falling bells, where it is
  cue('blowout', withCues((c, e) => c.blowout(e)));
  // the raiders' nerve and tricks, and the Man-o'-war's acts (tactics.js), each where it happens: a raider running (her
  // crystals pouring into her sails), a flare going up (Chris's notify, and his alert as help answers it), one bursting
  // up through the clouds (his wind), a raider captain's smoke screen (his hex), a block of guns silenced (a blast), the
  // Man-o'-war's next act (his boss sting) and a line of battle breaking up
  const at = (p, wet = 0.4) => { if (!audio.mixer) return null; const P = M().at(p, wet); return P.cull ? null : P; };
  cue('raider:run', (e) => { const P = at(e.raider.f.pos); if (P) audio.effect('haste', CHRIS.haste * 0.6, 'fx', P.delay); });
  cue('flare', (e) => { if (e.stage === 'none') return; const P = at(e.at, 0.5); if (P) audio.effect(e.stage === 'fired' ? 'notify' : 'alert', (e.stage === 'fired' ? CHRIS.notify : CHRIS.alert) * 0.7, 'fx', P.delay); });
  cue('burst', (e) => { const P = at(e.at, 0.5); if (P) audio.effect('wind', CHRIS.wind * 0.6, 'fx', P.delay); });
  cue('trick', (e) => { if (e.trick !== 'smoke') return; const P = at(e.raider.f.pos, 0.5); if (P) audio.effect('hex', CHRIS.hex * 0.7, 'fx', P.delay); });
  cue('silenced', withCues((c, e) => c.blast({ at: e.at, size: 20, big: false, first: true })));
  cue('fortress', () => { fx('boss'); M()?.dipMusic(-6, 1.5); });
  cue('line', () => fx('notify', 'ui', 0, 0.6));
  cue('road', () => {}); // (its button's own sound answers it: BUTTONS)
  // crossing into another region (its name shown): a soft chord with a far bell
  cue('region', () => { if (!audio.mixer) return; M().here(0, 0.4); audio.effect('new-area', CHRIS['new-area'] * 0.6, 'fx'); });
  cue('surge', () => { if (!audio.mixer) return; M().here(0, 0.4); audio.effect('sails', CHRIS.sails, 'fx'); M().here(0, 0.2); audio.effect('haste', CHRIS.haste, 'fx'); });
  // the weather: a storm showing far off rumbles low, Chris's Aether storm as it rolls in; his thunderclap after each
  // lightning strike, heard from where it struck (a moment later and duller the further off: sound is slower than
  // light, though not as slow as true thunder, which would come 5 to 15 s late); his wind in each gust
  cue('storm', (e) => {
    if (!audio.mixer || e.stage === 'passing') return;
    const m = M(); m.here(0, 0.5);
    if (e.stage === 'coming') { m.P.lp = 700; audio.effect('thunder', CHRIS.thunder * 0.45, 'fx', 0.6); }
    else audio.effect('aether-storm', CHRIS['aether-storm'], 'fx', 0.2);
  });
  cue('lightning', (e) => {
    if (!audio.mixer) return;
    const m = M(), P = m.at(e.at, 0.5);
    m.here(P.pan, 0.5); m.P.lp = Math.max(900, 9000 - e.far * 1.5);
    audio.effect('thunder', CHRIS.thunder * clamp(1.25 - e.far / 5000, 0.4, 1), 'fx', 0.3 + e.far / 1500, 0.4);
  });
  cue('gust', () => { if (!audio.mixer) return; M().here(rnd(-0.5, 0.5), 0.3); audio.effect('wind', CHRIS.wind * 0.7, 'fx'); });
  // one of her parts badly hurt: the alarm bell for the hull, her lift failing for the crystals, the rigging for the sails
  cue('player:low', (e) => { if (!audio.mixer) return; const id = LOW[e.part]; M().here(0, 0.2); audio.effect(id, CHRIS[id], 'fx'); });
  // the Captain's ship going down: everything dull and far away, her end, and a sad phrase as the crew take to the boats
  cue('player:down', (e) => {
    const c = live(), m = M(); if (!m) return;
    m.muffleTo(600, 1);
    if (c) { m.here(0, 0.3); const s = m.voice('blast', 9, m.now()); if (s) m.play(s, 'blast', 9, e.why === 'crystals' ? audio.bank.crystalsDie[0] : audio.bank.blast[0], m.now(), e.why === 'crystals' ? 1 : 0.85, 1); }
    m.here(0, 0.3); audio.effect('defeat', CHRIS.defeat, 'ui', 2.5);
  });
  // the waves: a banner's sound (and the music dipping under it), and the next piece
  cue('wave:start', (e) => { fx(e.prize ? 'treasure-map' : e.captain || e.fortress ? 'boss' : 'alert'); M()?.dipMusic(-6, 1.5); });
  cue('wave:cleared', () => { fx('victory'); M()?.dipMusic(-6, 1.8); });
  // (Brightvein's raids, raids.js: the guards coming out, a boss rising and her phases, a gun tower or a drill engine
  // knocked out, a beacon passed or a barge home, a warning, and the raid won or lost)
  cue('raid', (e) => {
    if (e.stage === 'start' || e.stage === 'more') { fx(e.big ? 'boss' : 'alert'); M()?.dipMusic(-6, 1.5); }
    else if (e.stage === 'boss' || e.stage === 'phase') { fx('boss'); M()?.dipMusic(-6, 1.5); }
    else if (e.stage === 'tower') { const c = live(); if (c) c.blast({ at: e.at, size: 14, big: false, first: true }); }
    else if (e.stage === 'beacon') fx('charm');
    else if (e.stage === 'warn') fx('deck-alarm');
    else if (e.stage === 'taken') { fx('victory'); M()?.dipMusic(-6, 1.8); }
    else if (e.stage === 'lost') fx('defeat');
  });
  cue('pause', (e) => { D.paused = e.on; M()?.setPaused(e.on); });
  cue('voyage:start', () => { D.charge = 1; if (!audio.mixer) return; M().muffleTo(20000, 0.1); M().here(0, 0.3); audio.effect('ship-takeoff', CHRIS['ship-takeoff'], 'fx'); });
  cue('voyage:end', (e) => { if (!audio.mixer) return; M().stopAll(); M().muffleTo(20000, 0.1); fx('ship-land'); if (e.kept > 0) fx('coins', 'ui', 0.7); });
  // ---------- the port and the title screen ----------
  cue('port:buy', () => { fx('ui-buy'); fx('coins', 'ui', 0.15); fx('dock-clamp', 'ui', 0.4); });
  cue('port:upgrade', (e) => { fx('upgrade'); if (UPGRADE[e.mod]) fx(UPGRADE[e.mod], 'ui', 0.35, 0.7); });
  cue('port:shot', () => { fx('ui-buy'); fx('coins', 'ui', 0.15); fx('crossbow', 'ui', 0.35, 0.7); });
  // her colours: a dye tried on chimes softly; one bought rings the till
  cue('port:dye', (e) => { if (e.bought) { fx('ui-buy'); fx('coins', 'ui', 0.15); } else fx('ui-cursor'); });
  // the Captain's record paying out (deeds.js): a commendation, a star or an order done chimes and clinks its shards;
  // a rank risen (on coming home's card) rings brighter
  cue('deed', (e) => { if (e.kind === 'rank') { fx('upgrade', 'ui', 0.5); fx('coins', 'ui', 0.8); } else { fx('charm', 'ui'); fx('coins', 'ui', 0.25, 0.8); } });
  // a note for each notch of crystal power: high and airy towards the sails, lower and metallic towards the guns
  cue('port:power', (e) => { if (!audio.mixer) return; const k = e.power + 2; audio.mixer.here(0, 0.2); audio.tone(k <= 2 ? { f: [880, 740, 587][k], ratio: 2, index: 0.8, d: 0.6, g: 0.12 } : { f: [440, 294][k - 3], ratio: 1.41, index: 2.5, d: 0.7, g: 0.12 }, 1, 'ui'); });
  cue('port:skies', (e) => fx(e.skies === 'fair' ? 'charm' : e.skies === 'cross' ? 'wind' : 'thunder', 'ui', 0, e.skies === 'cross' ? 0.7 : 1));
  // the menus' buttons (and the ships at the bottom of the port)
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('button');
    if (!b || b.disabled) return;
    const id = BUTTONS[b.id] ?? (b.closest('#port-ships') ? 'ui-cursor' : null);
    if (id) fx(id);
  });

  // ---------- the music, and the sky ----------
  const D = { mode: 'title', fight: false, big: false, down: false, want: 'title', changed: -99, look: 0, sky: 0, creak: 3, crackle: 0, charge: 1, paused: false };
  const calm = () => { const p = where(); return p ? CALM[regionAt(p.x, p.z)] ?? 'flight' : 'flight'; };
  function decide() {
    const was = D.want;
    // (Brightvein: the skies closed, back over the claim, whose own music takes over: none of Chris's here)
    if (D.mode === 'off' || D.mode === 'loading') { D.want = null; if (audio.piece) audio.stopMusic(); return; }
    D.want = D.mode === 'title' ? 'title' : D.mode === 'port' ? 'town' : D.down ? 'boss' : D.fight ? (D.big ? 'boss' : 'battle') : calm();
    if (D.want !== was) D.changed = performance.now() / 1000;
    if (!audio.quiet && audio.running() && D.want !== audio.piece) audio.playMusic(D.want, PIECES[D.want] ?? 1); // (else at the next frame)
  }
  on('mode', (e) => { D.mode = e.mode; mode = e.mode; if (e.mode !== 'voyage') { D.fight = D.down = false; sky?.stop(); sky = null; } decide(); });
  on('voyage:start', () => { D.fight = D.down = false; decide(); });
  on('wave:start', (e) => { D.fight = true; D.big = e.captain || e.fortress; decide(); });
  on('wave:cleared', () => { D.fight = false; decide(); });
  // (a raid: the fight's music from its start, the boss's for a boss or a wanted captain, calm again once it's over)
  on('raid', (e) => {
    if (e.stage === 'start' || e.stage === 'more') { D.fight = true; D.big = D.big || e.big; decide(); }
    else if (e.stage === 'boss') { D.fight = true; D.big = true; decide(); }
    else if (e.stage === 'taken' || e.stage === 'lost') { D.fight = false; D.big = false; decide(); }
  });
  on('player:down', () => { D.down = true; decide(); });
  audio.onReady(() => decide());

  // every frame (real time): the music changing piece when it should, and ten times a second the sky's sound from how
  // the ship is flying (`player`: flight.js, or none)
  const R = { frames: 0, ms: 0 };
  function update(dt, player) {
    if (!audio.mixer || !audio.running()) return;
    const t0 = performance.now(), t = t0 / 1000;
    if (D.want && D.want !== audio.piece) audio.playMusic(D.want, PIECES[D.want] ?? 1);
    // between waves, crossing into the Gloomfen or the Sunscorch Wastes (or out of them) changes the music, now and then
    if (mode === 'voyage' && !D.fight && !D.down && (D.look -= dt) <= 0) { D.look = 1; const c = calm(); if (c !== D.want && t - D.changed > 20) { D.want = c; D.changed = t; } }
    if (mode === 'voyage' && player && audio.ready) {
      if (audio.hearing()) {
        if (!sky) sky = makeSky(audio.mixer);
        if ((D.sky -= dt) <= 0) { D.sky = 0.1; skyFrom(player); }
        if (!D.paused) extras(dt, player);
      } else if (sky) { sky.stop(); sky = null; } // (the Sounds slider at nothing: the sky's sound let go)
      D.charge = player.surge.charge;
    }
    R.frames++; R.ms += performance.now() - t0;
  }
  function skyFrom(p) {
    const w = weather(), v = Math.min(1.4, p.speed / 60), h = clamp(p.pos.y / THINNING, 0, 1), cloud = Math.max(clamp(1 - Math.abs(p.pos.y - CLOUD_Y) / 40, 0, 1), w?.mist ?? 0);
    sky.set(v, h, p.down ? 0 : p.climb, p.surge.on > 0, p.frac('crystals'), cloud, !!p.down, w?.storm ?? 0);
  }
  // timbers creaking now and then (more in hard turns, or badly hurt), fire crackling while she burns, and the Surge
  // charging: a hum climbing to full that ends as it's ready (Chris's recharge, started 1.7 s before), then a soft ping
  const HUM = 1 - 1.7 / SURGE.recharge;
  function extras(dt, p) {
    const m = audio.mixer, B = audio.bank, hurt = p.frac('hull');
    if (!p.down && (D.creak -= dt * (Math.abs(p.turn) > 0.6 || hurt < 0.3 ? 3 : 1)) <= 0) {
      D.creak = rnd(2, 6); m.here(rnd(-0.4, 0.4), 0.2);
      const s = m.voice('creak', 0.5, m.now()); if (s) m.play(s, 'creak', 0.5, pick(B.creak), m.now(), rnd(0.85, 1.15), hurt < 0.3 ? 0.35 : 0.2);
    }
    if (!p.down && hurt < 0.25 && (D.crackle -= dt) <= 0) {
      D.crackle = rnd(0.1, 0.17); m.here(rnd(-0.5, 0.5), 0.1);
      const s = m.voice('misc', 0.2, m.now()); if (s) m.play(s, 'misc', 0.2, pick(B.tick), m.now(), rnd(0.7, 1.3), 0.12);
    }
    const c = p.surge.charge;
    if (c >= HUM && D.charge < HUM && c < 1 && !p.down) { m.here(0, 0.3); audio.effect('recharge', CHRIS.recharge * 0.5, 'fx'); }
    if (c >= 1 && D.charge < 1 && !p.down) { m.here(0, 0.3); audio.effect('notify', CHRIS.notify * 0.6, 'fx'); }
  }
  const listen = (camera, pos) => { if (audio.mixer) audio.mixer.listen(camera, pos); };
  // one of Chris's effects (an id in sounds.js) for any other part of the game: out in the sky at `at` (a point in the
  // world), or on the Captain's ship, `scale` times its own level
  function effect(id, { at = null, scale = 1, bus = 'fx' } = {}) {
    const m = audio.mixer;
    if (!m || audio.quiet || !(id in CHRIS)) return false;
    const P = at ? m.at(at, 0.4) : m.here(0, 0.2);
    if (P.cull) return false;
    return audio.effect(id, CHRIS[id] * scale, bus, P.delay);
  }

  // ---------- checking ----------
  // the worst a fight can sound, played into an offline copy of the mix: the Captain's Frigate firing a broadside and
  // her bow guns in a melee of five raiders (a captain's Man-o'-war 150 m off firing all 24 guns of a side, a Frigate,
  // a Brig and two Cutters), eight hits on her hull and eight on a raider within 30 ms, near misses, a raider blown
  // apart 200 m off with the chain of blasts along her hull, fourteen shards gathered, the wind at full speed, and (if
  // given) a recording of the music under it all, and some of Chris's effects that come in the same moments (WORST: a
  // captain's wave banner with the music dipping under it, the hull's alarm bell, spilled shards' coins and a shard's
  // pickup, recorded live by worstChris(), as his effects can't be played offline)
  // a few seconds played offline: fn(cues, mixer) answers news made up for it (setting the mixer's clock for each), heard
  // from a ship at (0, 900, 0) with the camera behind her looking north
  const scene = (secs, fn, music = null) => audio.offline(secs, (m) => { m.listenAt(0, 900, 0, 0, 915, -45, -1, 0, 0); fn(makeCues(m, audio.bank, { touch }), m); m.clock = -1; }, music);
  const WORST = [['boss', 0, 'ui'], ['deck-alarm', 0.15], ['coins', 0.3], ['shard-pickup', 0.5]];
  const worstChris = () => audio.recordEffects(WORST.map(([id, at, bus]) => [id, CHRIS[id] * (bus === 'ui' ? LEVELS.ui / LEVELS.fx : 1), at]), 3);
  function selfTest(music = null, chris = null) {
    return scene(7, (c, m) => {
      const V = (x, y, z) => ({ x, y, z });
      const gun = (t, owner, kind, ship, p, i, n, weight, captain = false) => { m.clock = t; c.fire({ owner, kind, battery: 'port', p, weight, ship, i, n, raider: owner === 'raider' ? { captain } : null }); };
      const sky = makeSky(m); sky.set(1.1, 0.4, 0.5, true, 1, 0, false);
      for (let i = 0; i < 10; i++) gun(0.2 + i * 0.055, 'player', 'broadside', 'frigate', V(6, 900, 14 - i * 3), i, 10, 1.25);
      for (let i = 0; i < 2; i++) gun(0.25 + i * 0.08, 'player', 'chaser', 'frigate', V(0, 902, 20), i, 2, 1.25);
      for (let i = 0; i < 24; i++) gun(0.3 + (i >> 1) * 0.05, 'raider', 'broadside', 'manowar', V(-150, 905, 30 - (i >> 1) * 3.5), i, 24, 1.45, true);
      for (let i = 0; i < 10; i++) gun(0.35 + i * 0.055, 'raider', 'broadside', 'frigate', V(120, 890, 250 - i * 3), i, 10, 1.1);
      for (let i = 0; i < 6; i++) gun(0.4 + i * 0.09, 'raider', 'broadside', 'brig', V(-200, 900, -120 + i * 3), i, 6, 1);
      for (let k = 0; k < 2; k++) for (let i = 0; i < 2; i++) gun(0.3 + k * 0.2 + i * 0.08, 'raider', 'chaser', 'cutter', V(80 - k * 200, 910, 200 + k * 200), i, 2, 0.9);
      for (let i = 0; i < 8; i++) {
        m.clock = 0.45 + i * 0.004;
        c.hit({ owner: 'raider', target: 'player', part: 'hull', at: V(2, 901, 3), damage: 70 });
        c.hit({ owner: 'player', target: 'raider', part: ['hull', 'sails', 'crystals'][i % 3], at: V(10, 905, 250), damage: 60 });
        c.nearMiss({ pan: i % 2 ? 0.8 : -0.7, close: 0.8, at: V(10, 900, 0) });
      }
      m.clock = 0.6; c.blast({ at: V(30, 900, 200), size: 42, big: true, first: true }); c.down({ why: 'hull', at: V(30, 900, 200) });
      for (let k = 0; k < 5; k++) { m.clock = 0.95 + k * 0.35; c.blast({ at: V(30, 900, 195 + k * 4), size: 17, big: false, first: false }); }
      for (let i = 0; i < 14; i++) { m.clock = 1.1 + i * 0.07; c.gather({ value: 10, run: i + 1, at: V(0, 900, 0) }); }
      if (chris) { m.clock = 0.25; m.dipMusic(-6, 1.5); const s = m.ctx.createBufferSource(); s.buffer = chris; s.connect(m.fx); s.start(0.2); }
    }, music);
  }
  return { update, listen, effect, ui: (id) => fx(id), selfTest, worstChris, scene, makeSky, stats, get cues() { return cues; }, get sky() { return sky; }, director: D, frame: R, CHRIS, PIECES };
}
