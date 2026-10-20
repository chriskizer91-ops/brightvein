// coach.js: a gentle first voyage. A new Captain is taught as she goes, one short tip at a time, each at the moment it
// matters and worded for her device (a laptop's keys and mouse, a phone's thumbs, either way round with Fire on the
// left): how to steer; that the red tag is a raider to turn towards; that where she looks swings the view and picks the
// guns, and the ring locks on; how to fire; that her side guns fire when she looks to the side; to gather a wreck's
// shards; what a red fan means; how to patch her and keep out of a broadside's way; what the card between waves offers;
// and from her second voyage, the Surge; and the shot button or keys once she has more than round shot. Each shows for
// a few seconds (until she's done what it says, or it's had its time; a fight's tip goes as the fight ends), and once
// given it's never given again, on any device (the save keeps them: progress.js TIP_IDS). Settings can switch them off,
// or give them all again.
// On a laptop the tip sits at the bottom, in the middle (just over the card between waves); on a phone in the hint's
// place, low on the steering side, the hint making way for it (game.html). No tips on a sea trial (it changes nothing in
// the save). Its looks are checked ten times a second (main.js hud), never each frame.
import { on } from './events.js';

const MIN = 3.5, FADE = 400; // (each tip shows at least this long, seconds; and fades in and out over this, ms)
const QUIET = 8; // (after a tip has made way for a crowd of raiders' tags, no tip for this long, seconds: makeWay)
// (the tips about a fight: gone at once when it ends, the wave beaten, rather than giving advice about a fight that's over)
const FIGHT_TIPS = { find: true, aim: true, fire: true, guns: true, fan: true, broadside: true };
const deg = (r) => (r * 180) / Math.PI, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Each tip: when it's wanted (`when`), when she's done what it says (`done`), the most it shows (`most`, seconds), and
// its words: `all` on every device, or `laptop` and `phone` (a function of the coach's state for words that change,
// as with Fire on the left: c.left). In the order they're given when two are wanted at once
export const TIPS = {
  steer: { when: (c) => c.t > 1.5, done: (c) => c.turned > 1.5, most: 12,
    laptop: 'Steer with A and D. W sets more sail and S less; Space climbs and Shift dives.',
    phone: (c) => `${c.left ? 'Right' : 'Left'} thumb: put it down on the ${c.left ? 'right' : 'left'} and push to turn, climb and dive.` },
  find: { when: (c) => c.fight && c.sinceWave > 4.5 && c.dist > 900 && c.off > 40, done: (c) => !c.near || c.off < 40 || c.dist < 900, most: 15,
    all: 'That red tag is a raider. Turn until she\'s ahead of you.' },
  aim: { when: (c) => c.fight && c.near && c.dist < 1400 && c.free > 2, done: (c) => c.held > 0.5, most: 15,
    laptop: (c) => (c.mouse ? 'Move the mouse to put the ring on her: where you look, your guns fire.' : 'Click the sky to take hold of the aim, then move the mouse to put the ring on her.'),
    phone: (c) => `Drag on the ${c.left ? 'left' : 'right'} to swing your view round, and put the ring on her.` },
  fire: { when: (c) => c.fight && c.locked, done: (c) => c.hits > 0, most: 10,
    laptop: 'Locked on: the ring turns red and your gunners aim ahead of her. Hold the left button (or F) to fire.',
    phone: 'Locked on! Hold Fire. Slide your thumb off Fire to aim as you shoot.' },
  fan: { when: (c) => c.fight && c.since.warn < 1, done: () => false, most: 6,
    all: 'A red fan: she\'s about to fire her broadside at you. Climb out of it and she misses!' },
  shards: { when: (c) => c.killed, done: (c) => c.gathered, most: 12,
    all: 'She\'s going down! Fly through her glowing shards to gather them: they\'re your pay.' },
  guns: { when: (c) => c.fight && c.hits > 0 && c.near && c.dist < 800 && c.off > 50 && c.off < 130, done: (c) => c.sideVolley, most: 10,
    all: 'The guns facing where you look are the ones that fire. Look to her side to fire your side guns.' },
  hurt: { when: (c) => c.hull < 0.5 && !c.down, done: () => false, most: 8,
    laptop: 'She\'s hurt! Press X and your crew patch her up. Climb or dive out of their line of fire.',
    phone: 'She\'s hurt! Tap Patch and your crew patch her up. Climb or dive out of their line of fire.' },
  broadside: { when: (c) => c.fight && c.bigNear, done: () => false, most: 9,
    all: 'Ships with broadsides hit hardest from the side. Stay above or below her, or off her bow or stern.' },
  card: { when: (c) => c.choosing, done: (c) => !c.choosing, most: 12,
    all: 'Sail on for a harder wave and more shards, or go home and keep them all. If she sinks, you keep half.' },
  surge: { when: (c) => c.voyages > 0 && c.fight && c.charged && (c.since.run < 4 || c.farPrize), done: (c) => c.surged, most: 10,
    laptop: 'Press R to Surge: three seconds at full speed, to catch her or to get away.',
    phone: 'Tap Surge, the blue button: three seconds at full speed, to catch her or to get away.' },
  shot: { when: (c) => c.fight && c.moreShot && c.sinceWave > 6, done: (c) => c.picked, most: 10,
    laptop: (c) => (c.shots === 'both' ? 'More than round shot aboard: 2 loads chain shot (it shreds sails), 3 crystal breakers (they crack crystals).'
      : c.shots === 'chain' ? 'Chain shot aboard: press 2 to load it (it shreds sails), and 1 for round shot again.' : 'Crystal breakers aboard: press 3 to load them (they crack crystals), and 1 for round shot again.'),
    phone: 'More than round shot aboard: tap the shot button over Surge to load the next kind.' },
};
export const TIP_ORDER = ['steer', 'find', 'aim', 'fire', 'fan', 'shards', 'guns', 'hurt', 'broadside', 'card', 'surge', 'shot'];

// el: the tip's place on the page; `see()`: what's happening now (main.js); `placed()`: told when the tip shows or goes,
// so the raiders' tags keep clear of it (main.js layout)
export function makeCoach({ progress, settings, touch, el, see, placed, trial, clock }) {
  // this voyage: on (tips wanted), when it began, the tip showing and since when, and what's been seen to happen
  const C = { on: false, id: null, at: 0, fight: false, quiet: -99, t0: 0, turned: 0, held: 0, free: 0, hits: 0, killed: false, gathered: false, sideVolley: false, surged: false, picked: false, since: { warn: 99, run: 99 }, warnAt: -99, runAt: -99, waveAt: -99 };
  let fade = null;
  const tips = () => progress.data.tips;
  const wanted = () => settings.data.tips !== false;
  function words(id, c) {
    const T = TIPS[id], w = T.all ?? (touch ? T.phone : T.laptop);
    return typeof w === 'function' ? w(c) : w;
  }
  function show(id, c = state()) {
    C.id = id; C.at = clock(); C.fight = c.fight;
    el.textContent = words(id, c); el.dataset.tip = id;
    fade?.cancel(); el.hidden = false; document.body.classList.add('tipping');
    fade = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: 'ease-out' }); // (fading only: its place, where the tags keep clear of it, is where it is from the start)
    placed?.();
  }
  // the tip going (given: kept so in the save, never to come again)
  function hide(given = true) {
    const id = C.id;
    if (!id) return;
    C.id = null;
    if (given && tips()[id] === 0) { tips()[id] = 1; progress.mark(); }
    fade?.cancel();
    fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: 'ease-in' });
    fade.onfinish = () => { if (!C.id) { el.hidden = true; document.body.classList.remove('tipping'); placed?.(); } };
  }
  function clear() { C.id = null; fade?.cancel(); el.hidden = true; document.body.classList.remove('tipping'); placed?.(); }
  // the tip making way at once for the raiders' tags, on a screen too crowded for them all (the smallest phone held
  // sideways, raiders all round readying broadsides: main.js tags): not given, so it comes again, after a quiet while
  function makeWay() {
    if (!C.id) return false;
    C.quiet = clock() + QUIET; clear();
    return true;
  }

  // what the tips look at, made from what main.js sees (see()) and the news: the nearest raider (how far, how far off the
  // bow in degrees), whether her guns are locked on, how long they've been locked (held) or not (free), and so on
  const c = { t: 0, sinceWave: 99, fight: false, near: false, dist: Infinity, off: 0, locked: false, held: 0, free: 0, hits: 0, killed: false, gathered: false, sideVolley: false, hull: 1, down: false,
    bigNear: false, choosing: false, voyages: 0, charged: false, farPrize: false, surged: false, moreShot: false, shots: '', picked: false, turned: 0, since: C.since, left: false, mouse: false };
  function state() {
    const S = see(), now = clock(), P = S.player;
    c.t = now - C.t0; c.sinceWave = now - C.waveAt; c.fight = S.fight; c.locked = !!S.locked; c.held = C.held; c.free = C.free; c.hits = C.hits; c.killed = C.killed; c.gathered = C.gathered;
    c.sideVolley = C.sideVolley; c.surged = C.surged; c.picked = C.picked; c.turned = C.turned; c.since.warn = now - C.warnAt; c.since.run = now - C.runAt;
    c.hull = P ? P.frac('hull') : 1; c.down = !!P?.down; c.choosing = S.choosing; c.voyages = progress.data.voyages; c.charged = !!P && P.surge.charge >= 1; c.moreShot = !!S.shots; c.shots = S.shots;
    c.left = !!settings.data.leftFire && touch; c.mouse = S.mouse;
    // (the nearest raider still fighting, and any big one within a kilometre; a treasure ship getting away, far off)
    c.near = false; c.dist = Infinity; c.off = 0; c.bigNear = false; c.farPrize = false;
    if (P) for (const r of S.raiders) {
      if (r.f.down || r.gone) continue;
      const dx = r.f.pos.x - P.pos.x, dz = r.f.pos.z - P.pos.z, d = Math.hypot(dx, dz, r.f.pos.y - P.pos.y);
      if (d < c.dist) { c.dist = d; c.near = true; c.off = Math.abs(deg(wrap(Math.atan2(dx, dz) - P.heading))); }
      if (d < 1000 && (r.R.id === 'brig' || r.R.id === 'frigate' || r.R.id === 'galleon' || r.R.id === 'manowar') && r.role !== 'prize') c.bigNear = true;
      if (r.role === 'prize' && d > 700) c.farPrize = true;
    }
    return c;
  }
  // ten times a second (dt: since the last look): the tip showing kept or let go; else the first one wanted shown
  function update(dt, controls) {
    if (!C.on) return;
    const S = state();
    if (Math.abs(controls?.turn ?? 0) > 0.3) C.turned += dt;
    if (S.locked) { C.held += dt; C.free = 0; } else { C.free += dt; C.held = 0; }
    if (C.id) {
      const T = TIPS[C.id], up = clock() - C.at, ended = C.fight && !S.fight;
      C.fight = S.fight;
      // (a fight's tip, the fight just ended: gone now, given if she's done what it says or it's had its time)
      if (ended && FIGHT_TIPS[C.id]) { hide(T.done(S) || up >= MIN); return; }
      if ((up >= MIN && T.done(S)) || up >= T.most) { hide(); return; }
      // (its words kept true as things change: the mouse taken hold of, say, on a laptop)
      const w = words(C.id, S);
      if (w !== el.textContent) { el.textContent = w; placed?.(); }
      return;
    }
    if (!wanted() || clock() < C.quiet) return;
    const given = tips();
    for (const id of TIP_ORDER) if (!given[id] && TIPS[id].when(S)) { show(id, S); return; }
  }

  // the news the tips wait on
  on('voyage:start', (e) => {
    clear();
    Object.assign(C, { on: !e.trial && !trial(), quiet: -99, t0: clock(), turned: 0, held: 0, free: 0, hits: 0, killed: false, gathered: false, sideVolley: false, surged: false, picked: false, warnAt: -99, runAt: -99, waveAt: -99 });
  });
  // (home: the tip showing given if it's had its time, or it's the card's, whose words offer going home)
  on('voyage:end', () => { C.on = false; hide(C.id === 'card' || clock() - C.at >= MIN); });
  on('wave:start', () => { C.waveAt = clock(); });
  on('hit', (e) => { if (e.owner === 'player' && e.target === 'raider') C.hits++; });
  on('raider:down', (e) => { if (e.raider.role !== 'prize' || e.why === 'struck') C.killed = true; });
  on('shards:gather', () => { C.gathered = true; });
  on('volley', (e) => { if (e.owner === 'player' && (e.battery === 'port' || e.battery === 'starboard')) C.sideVolley = true; });
  on('warn', () => { C.warnAt = clock(); });
  on('raider:run', () => { C.runAt = clock(); });
  on('surge', () => { C.surged = true; });
  on('shot', (e) => { if (e.why === 'pick') C.picked = true; });
  return {
    update, TIPS, TIP_ORDER, words: (id) => words(id, state()),
    get showing() { return C.id; },
    // a tip shown at once, whatever's happening (for the checks: its place, at its longest)
    show: (id) => show(id), hide: () => hide(false), clear, makeWay,
    // every tip to be given again (Settings: "Show the tips again", which switches them on too: main.js)
    again() { for (const id in tips()) tips()[id] = 0; progress.save(); },
  };
}
