// refit.js: the Shipyard's rules. Buying the six ships (shards and materials, opened by the Keep's level and the
// chapter), refitting each by part (hull, sails, guns, crystals: three levels each, with changes you can see on the
// model), its looks (hull paint, sail colour, a figurehead), the crew from the claim (gunners, a pilot and a bosun, by
// their stats), wear carried home and repairs at the dock.
// loadout() turns a ship, its refits, its crystal power and its crew into what the game flies and fires.
// recipeFor() turns a ship's recipe (src/ships/) and its refits into the recipe the builder builds (src/ship/build.js).
import * as THREE from 'three';
import { STATS } from '../ships/index.js';
import { makeHull } from '../ship/hull.js';
import { lathe } from '../ship/kit.js';

// how big each class is, for prices, refits and repairs
export const CLASS = { skiff: 1, cutter: 1.6, brig: 2.6, frigate: 4, galleon: 5.5, manowar: 7.5 };
const round5 = (n) => Math.round(n / 5) * 5;

// ---------- the ships for sale ----------
// price: shards and materials (the claim's Brass Scrap, Cut Glass and Heartstone). need: the Keep's level and the
// chapter (story.js) before the yard will build her.
export const SHIPYARD = {
  skiff: { price: { shards: 0 }, need: null },
  cutter: { price: { shards: 300, brass: 2 }, need: { ch: 2 } },
  brig: { price: { shards: 1000, brass: 3, glass: 2 }, need: { keep: 2, ch: 4 } },
  frigate: { price: { shards: 2600, glass: 4, heartstone: 2 }, need: { keep: 3, ch: 9 } },
  galleon: { price: { shards: 5000, glass: 6, heartstone: 4 }, need: { keep: 3, ch: 12 } },
  manowar: { price: { shards: 8500, glass: 8, heartstone: 6 }, need: { keep: 3, ch: 14 } },
};
// the chapters' names, for "opens in chapter 9" (story.js has the rest)
const CH_NAMES = ['Stake the Claim', 'First Light', 'A Letter Under Seal', 'The Nightjar', 'Redspire', 'The Wickmoor', 'The Moon Faire', 'The Deep Seam',
  'The Chandlery', 'Silver Sails', 'Charter Night', 'Hollowcrest', 'The Thinwatch’s Oath', 'Storm Season', 'The Long Bright Night'];
// what still stands between the claim and this ship: null when the yard can build her
export function lockedWhy(id, at) {
  const n = SHIPYARD[id].need; if (!n || !at) return null;
  if (n.ch && at.ch < n.ch) return `Opens in chapter ${n.ch}, ${CH_NAMES[n.ch] ?? ''}`;
  if (n.keep && at.keep < n.keep) return `Needs the Keep at level ${n.keep}`;
  return null;
}

// ---------- refits ----------
export const MAX = 3;
export const PARTS = {
  hull: { name: 'Hull', what: 'Armour', levels: ['Oak planks', 'Brass-strapped', 'Iron-banded', 'Iron-plated'],
    each: 'Each level: a fifth more hull, a little slower', look: ['', 'More brass straps', 'An iron band at the waterline', 'Iron plates over the planks'] },
  sails: { name: 'Sails', what: 'Speed', levels: ['Sailcloth', 'Fine canvas', 'Racing canvas', 'Crystal-thread'],
    each: 'Each level: wider sails, more speed and a sharper turn', look: ['', 'Wider yards', 'Wider still', 'Canvas woven with sunstone thread: it glows'] },
  guns: { name: 'Guns', what: 'More, or heavier', levels: ['Ship’s guns', 'Rail swivels', 'Heavy shot', 'Chasers'],
    each: 'More guns, then heavier ones', look: ['', 'A pair of swivel guns on the rail', 'Longer bow guns, a fifth heavier shot', 'Another pair of guns, and heavier again'] },
  crystals: { name: 'Crystals', what: 'Lift and boost', levels: ['Raw sunstone', 'Cut crystals', 'Crowned crystals', 'Heartcut'],
    each: 'Each level: a fifth more crystal, quicker climbing, a longer Surge', look: ['', 'Bigger clusters', 'Two more crystals in every crown', 'Bigger again'] },
};
const REFIT_SHARDS = [50, 120, 260];
const MATS = { skiff: 1, cutter: 1, brig: 2, frigate: 2, galleon: 3, manowar: 4 };
// the cost of taking this ship's part from `level` to `level + 1`
export function refitCost(id, level) {
  if (level >= MAX) return null;
  const m = MATS[id], c = { shards: round5(REFIT_SHARDS[level] * CLASS[id]) };
  if (level === 0) c.brass = m;
  else if (level === 1) { c.brass = m; c.glass = Math.ceil(m / 2); }
  else { c.glass = m; c.heartstone = Math.ceil(m / 2); }
  return c;
}

// ---------- looks: cheap, as material tints ----------
export const PAINTS = {
  oak: { name: 'Oiled oak', c: 0xffffff }, plum: { name: 'Brightvein plum', c: 0xc69ab9 }, night: { name: 'Night blue', c: 0x95a3cc },
  moss: { name: 'Moss green', c: 0xadc39a }, amber: { name: 'Sunstone amber', c: 0xf0b57a }, tar: { name: 'Tar black', c: 0x6c6460 },
};
export const SAILS = {
  cream: { name: 'Sailcloth', c: 0xffffff }, gold: { name: 'Gold', c: 0xffdc8c }, plum: { name: 'Plum', c: 0xdcaad0 },
  sky: { name: 'Sky blue', c: 0xb0d4ff }, rose: { name: 'Rose', c: 0xffc0c4 }, moss: { name: 'Moss', c: 0xc8e4ae },
};
export const FIGURES = {
  none: { name: 'None' }, sun: { name: 'The Sun', line: 'A gilded sunburst' }, lark: { name: 'The Lark', line: 'A brass lark, wings spread' },
  owl: { name: 'The Owl', line: 'A night lookout with crystal eyes' }, lantern: { name: 'The Lantern', line: 'A lamp that never needs oil' },
  star: { name: 'The Star', line: 'A five-pointed sunstone star' }, moon: { name: 'The Moon', line: 'A silver-gilt crescent' },
};
export const lookCost = (id, kind) => ({ shards: round5((kind === 'figure' ? 40 : 15) * Math.sqrt(CLASS[id])), ...(kind === 'figure' ? { brass: 1 } : {}) });

// ---------- crew ----------
// seats: a pilot (Agility: turning), a bosun (Grit: the hull crew: less harm, more patching, quicker repairs) and
// gunners (Agility: reload and aim), more of them on bigger ships. An empty seat is a dock hand, worth a 3.
export const GUNNERS = { skiff: 1, cutter: 2, brig: 3, frigate: 4, galleon: 5, manowar: 6 };
export const DOCK_HAND = 3;
// the cast's gifts at sea (art ids: quill is Barnabus, sol Brisa, brann Torvald, tock Nib)
export const CREW_GIFTS = {
  pilot: { quill: { turn: 0.1, line: 'Barnabus knows every wind in the Ironspire: a tenth sharper turning' } },
  gunner: { sol: { damage: 0.06, line: 'Brisa drills the gun crews: heavier shot' }, brann: { damage: 0.06, line: 'Torvald forged the shot himself: heavier shot' } },
  bosun: { tock: { repair: 0.3, line: 'Nib is a shipwright: repairs a third quicker' } },
};
// crew: { pilot: { A, hero }, bosun: { G, hero }, gunners: [{ A, hero }] } (any can be missing)
export function crewEffects(id, crew = {}) {
  const n = GUNNERS[id], gs = (crew.gunners || []).slice(0, n);
  const gunA = (gs.reduce((s, g) => s + g.A, 0) + (n - gs.length) * DOCK_HAND) / n;
  const pA = crew.pilot ? crew.pilot.A : DOCK_HAND, bG = crew.bosun ? crew.bosun.G : DOCK_HAND;
  const e = {
    gunA, pilotA: pA, bosunG: bG, aboard: gs.length + (crew.pilot ? 1 : 0) + (crew.bosun ? 1 : 0),
    reload: Math.max(0.6, 1 - 0.035 * (gunA - DOCK_HAND)), aim: Math.max(0.4, 1 - 0.07 * (gunA - DOCK_HAND)), damage: 1,
    turn: 1 + 0.03 * (pA - DOCK_HAND), surge: 0.4 * (pA - DOCK_HAND),
    guard: Math.max(0.6, 1 - 0.025 * (bG - DOCK_HAND)), patch: 0.03 * (bG - DOCK_HAND), repair: Math.max(0.4, 1 - 0.06 * (bG - DOCK_HAND)),
    gifts: [],
  };
  const gift = (seat, hero) => { const g = hero && CREW_GIFTS[seat][hero]; if (!g) return; e.gifts.push(g.line); if (g.turn) e.turn += g.turn; if (g.damage) e.damage += g.damage; if (g.repair) e.repair *= 1 - g.repair; };
  gift('pilot', crew.pilot?.hero); gift('bosun', crew.bosun?.hero); for (const g of gs) gift('gunner', g.hero);
  return e;
}

// ---------- what she flies and fires ----------
export const POWER = ['All to sails', 'More to sails', 'Even', 'More to guns', 'All to guns'];
export const SURGE_BASE = { boost: 0.6, time: 3, recharge: 15 };
const GUN_DAMAGE = [1, 1, 1.2, 1.32];
// id: the ship; cfg: her saved data (refit, power); crew: crewEffects() or the claim's crew
export function loadout(id, cfg, crew = null) {
  const st = STATS[id], r = cfg.refit || { hull: 0, sails: 0, guns: 0, crystals: 0 }, p = cfg.power || 0, C = crew ?? crewEffects(id);
  return {
    stats: {
      ...st,
      hull: Math.round(st.hull * (1 + 0.2 * r.hull)),
      sails: Math.round(st.sails * (1 + 0.15 * r.sails)),
      crystals: Math.round(st.crystals * (1 + 0.2 * r.crystals)),
    },
    tune: {
      speed: (1 - 0.03 * r.hull) * (1 + 0.045 * r.sails) * (1 - 0.06 * p),
      accel: (1 - 0.06 * r.hull) * (1 - 0.06 * p),
      climb: 1 + 0.1 * r.crystals,
      turn: (1 + 0.03 * r.sails) * C.turn,
      guard: C.guard,
      surge: { boost: SURGE_BASE.boost + 0.08 * r.crystals, time: SURGE_BASE.time + 0.5 * r.crystals, recharge: Math.max(8, SURGE_BASE.recharge - 1.5 * r.crystals - C.surge) },
    },
    guns: { reload: (1 - 0.08 * p) * C.reload, damage: (1 + 0.06 * p) * GUN_DAMAGE[r.guns] * C.damage, aim: C.aim },
    patch: { hull: 0.6 + C.patch, other: 0.8 + C.patch },
    crew: C,
  };
}

// ---------- wear and repairs ----------
const WEAR_COST = { hull: 30, sails: 12, crystals: 18 };
export function damageOf(cfg) { const w = cfg.wear || {}; return { hull: 1 - (w.hull ?? 1), sails: 1 - (w.sails ?? 1), crystals: 1 - (w.crystals ?? 1) }; }
export function repairCost(id, cfg) {
  const d = damageOf(cfg), s = Object.keys(WEAR_COST).reduce((a, k) => a + d[k] * WEAR_COST[k], 0) * CLASS[id];
  return s < 0.5 ? 0 : Math.max(5, round5(s));
}
// how long, in claim hours, with this bosun (crewEffects().repair)
export function repairHours(id, cfg, repairK = 1) {
  const d = damageOf(cfg), worst = d.hull + d.sails * 0.5 + d.crystals * 0.7;
  if (worst < 0.01) return 0;
  return Math.max(1, Math.round((1 + worst * 4) * Math.sqrt(CLASS[id]) * repairK * 2) / 2);
}

// start repairs on this ship now (claim days): she stays at the dock until they're done. Returns the cost paid, or
// null if there's nothing to mend or no way to pay (pay(cost) → true when paid)
export function startRepair(id, cfg, now, repairK, pay) {
  const cost = repairCost(id, cfg), hours = repairHours(id, cfg, repairK);
  if (!hours || cfg.repair || !pay({ shards: cost })) return null;
  cfg.repair = { from: now, until: now + hours / 24, cost };
  return { cost, hours };
}
// repairs finished by this claim day: the ships come out sound. Returns the ids repaired.
export function finishRepairs(data, now) {
  const done = [];
  for (const [id, cfg] of Object.entries(data.ships)) {
    if (!cfg.repair || now < cfg.repair.until) continue;
    cfg.repair = null; cfg.wear = { hull: 1, sails: 1, crystals: 1 }; done.push(id);
  }
  return done;
}
// how far along a repair is (0..1), and the claim hours left
export function repairLeft(cfg, now) {
  const R = cfg.repair; if (!R) return null;
  return { frac: clamp01((now - R.from) / Math.max(1e-6, R.until - R.from)), hours: Math.max(0, (R.until - now) * 24) };
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------- the recipe the builder builds ----------
const clone = (o) => JSON.parse(JSON.stringify(o));
// a stable key for what changes the model (a refit or a figurehead), so a ship is only rebuilt when it must be
export const buildKey = (id, cfg) => `${id}:${PARTS_KEYS.map((k) => cfg.refit?.[k] | 0).join('')}`;
const PARTS_KEYS = ['hull', 'sails', 'guns', 'crystals'];
export function recipeFor(R0, cfg) {
  const R = clone(R0), r = cfg.refit || {}, H = makeHull(R0), L = R.length, s = L / 25;
  delete R.tiles; delete R.railScale;
  // hull: more straps, an iron band at the waterline, then iron plates over the planks
  if (r.hull >= 1) {
    const span = R.hull.bow - R.hull.stern;
    R.bands.straps = [...R.bands.straps, [R.hull.stern + span * 0.36, 0.3 * Math.max(0.6, s)], [R.hull.stern + span * 0.62, 0.3 * Math.max(0.6, s)]];
  }
  if (r.hull >= 2) {
    const lows = R.bands.lower ? (Array.isArray(R.bands.lower[0]) ? R.bands.lower : [R.bands.lower]) : [];
    const deep = Math.min(...[-0.2, ...R.hull.keel.map((k) => k[1])]), y0 = deep * 0.58, y1 = y0 - 0.16 * Math.max(0.7, s);
    R.bands.lower = [...lows, [y0, y1]];
  }
  if (r.hull >= 3) R.skin = 'plates';
  // sails: wider yards, a little more rise
  if (r.sails >= 1) for (const M of R.masts) for (const T of M.tiers) { T.span *= 1 + 0.07 * r.sails; T.rise *= 1 + 0.05 * r.sails; }
  // guns: a pair of rail swivels in the waist, longer bow guns, then another pair (or stern chasers on a ship without)
  if (r.guns >= 1) {
    R.swivels = [...(R.swivels ?? [])];
    const zA = R.quarterdeck ? R.quarterdeck.front : R.hull.stern + L * 0.2, zB = R.forecastle ? R.forecastle.back : R.hull.bow - L * 0.2;
    const len = Math.max(0.8, Math.min(2.8, 0.55 + L * 0.035));
    const pair = (z) => { for (const sx of [1, -1]) R.swivels.push({ x: sx * (H.deckHalf(z) - 0.02), y: H.deckY(z) + 0.04, z, len }); };
    pair(clearZ(R, zA + (zB - zA) * (R.swivels.length ? 0.72 : 0.45)));
    if (r.guns >= 3) {
      if (!(R.sternGuns ?? []).length) R.sternGuns = [{ x: 0, y: H.deckY(R.hull.stern + 0.6 * s + 0.3) + 0.35 * Math.max(0.6, s), z: R.hull.stern + 0.55 + 0.4 * s, len: len * 1.1, deck: true }];
      else pair(clearZ(R, zA + (zB - zA) * 0.25));
    }
  }
  if (r.guns >= 2) for (const g of R.bowGuns) g.len *= 1.22;
  // crystals: bigger clusters, then two more crystals in every crown
  if (r.crystals >= 1) for (const c of R.clusters) c.scale = (c.scale ?? 1) * (1 + 0.08 * r.crystals);
  if (r.crystals >= 2) R.cluster.crystals += 2;
  return R;
}
// a spot along the deck clear of the masts and crystal clusters, near z
function clearZ(R, z) {
  const busy = [...R.masts.map((m) => m.z), ...R.clusters.map((c) => c.z)], gap = R.length * 0.05 + 0.4;
  for (let k = 0; k < 24; k++) {
    const t = z + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * gap * 0.4;
    if (busy.every((b) => Math.abs(b - t) > gap)) return t;
  }
  return z;
}

// ---------- the ship's own materials (her paint) ----------
// art: the ship art (materials.js). Each ship gets her own hull, plates and canvas materials, tinted.
export function paintArt(art, cache) {
  const M = { ...art.M };
  for (const k of ['hull', 'plates', 'canvas']) {
    M[k] = art.M[k].clone();
    if (k === 'canvas') { M.canvas.onBeforeCompile = art.M.canvas.onBeforeCompile; M.canvas.customProgramCacheKey = art.M.canvas.customProgramCacheKey; M.canvas.userData = art.M.canvas.userData; }
  }
  const out = { ...art, M, base: { hull: art.M.hull.color.clone(), plates: art.M.plates.color.clone(), canvasE: art.M.canvas.emissive.clone() } };
  if (cache) cache.art = out;
  return out;
}
export function applyPaint(A, cfg) {
  const p = cfg.paint || {}, hc = new THREE.Color(PAINTS[p.hull]?.c ?? 0xffffff), sc = new THREE.Color(SAILS[p.sails]?.c ?? 0xffffff);
  A.M.hull.color.copy(A.base.hull).multiply(hc);
  A.M.plates.color.copy(A.base.plates).multiply(hc);
  A.M.canvas.color.copy(sc);
  // crystal-thread canvas glows a little gold
  const glow = (cfg.refit?.sails | 0) >= 3;
  A.M.canvas.emissive.copy(A.base.canvasE).multiply(sc);
  if (glow) A.M.canvas.emissive.lerp(new THREE.Color(0xffc060), 0.55);
  A.glowSails = glow;
}

// ---------- the figurehead: a small gilded carving on the stem, made of plain shapes ----------
export function figurehead(ship, id, art) {
  const old = ship.body.getObjectByName('figurehead');
  if (old) { old.removeFromParent(); old.traverse((o) => o.geometry?.dispose()); }
  if (!id || id === 'none' || !FIGURES[id]) return null;
  const R = ship.recipe, H = ship.hull, s = Math.max(0.45, R.length / 25) * 0.9;
  const g = new THREE.Group(); g.name = 'figurehead';
  // just above the ram (or the stem's foot), forward of the bow
  const yTop = H.rim(H.zb), yLow = R.ram ? R.ram.y + R.ram.collar : H.keel(H.zb);
  g.position.set(0, Math.max(yLow + 0.25 * s, (yTop + yLow) / 2), H.zb + 0.12 * s);
  g.scale.setScalar(s);
  const gilt = art.M.brass, glow = art.M.gem, bronze = art.M.bronze;
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  if (id === 'sun') {
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20).rotateX(Math.PI / 2), gilt, 0, 0.1, 0.06);
    add(new THREE.SphereGeometry(0.2, 12, 8), glow, 0, 0.1, 0.12);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(new THREE.ConeGeometry(0.07, 0.34, 4), gilt, Math.cos(a) * 0.56, 0.1 + Math.sin(a) * 0.56, 0.05, 0, 0, a - Math.PI / 2); }
  } else if (id === 'lark') {
    add(new THREE.SphereGeometry(0.22, 12, 8).scale(1, 0.9, 1.6), gilt, 0, 0.1, 0.25);
    add(new THREE.SphereGeometry(0.15, 10, 8), gilt, 0, 0.26, 0.55);
    add(new THREE.ConeGeometry(0.06, 0.22, 6).rotateX(Math.PI / 2), bronze, 0, 0.24, 0.76);
    for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.9, 0.05, 0.36).translate(sx * 0.45, 0, 0), gilt, sx * 0.1, 0.2, 0.2, 0, sx * 0.25, sx * 0.45);
    add(new THREE.BoxGeometry(0.3, 0.04, 0.4), gilt, 0, 0.06, -0.15, -0.2);
  } else if (id === 'owl') {
    add(new THREE.SphereGeometry(0.3, 14, 10).scale(1, 1.15, 0.9), bronze, 0, 0.1, 0.12);
    add(new THREE.SphereGeometry(0.24, 14, 10), gilt, 0, 0.45, 0.16);
    for (const sx of [1, -1]) { add(new THREE.ConeGeometry(0.07, 0.2, 5), gilt, sx * 0.15, 0.7, 0.14, 0, 0, -sx * 0.3); add(new THREE.SphereGeometry(0.07, 8, 6), glow, sx * 0.09, 0.48, 0.37); }
    add(new THREE.ConeGeometry(0.04, 0.12, 5).rotateX(Math.PI / 2), bronze, 0, 0.4, 0.42);
  } else if (id === 'lantern') {
    add(lathe([[0.001, 0], [0.18, 0], [0.2, 0.06], [0.14, 0.1], [0.14, 0.5], [0.2, 0.54], [0.1, 0.66], [0.001, 0.74]], 10), gilt, 0, -0.2, 0.25);
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.38, 8), glow, 0, 0.09, 0.25);
    add(new THREE.TorusGeometry(0.08, 0.02, 6, 12), gilt, 0, 0.6, 0.25);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6).rotateX(Math.PI / 2.6), bronze, 0, 0.62, 0.05);
  } else if (id === 'star') {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, rr = i % 2 ? 0.2 : 0.5; (i ? sh.lineTo : sh.moveTo).call(sh, Math.cos(a) * rr, Math.sin(a) * rr); }
    add(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }), glow, 0, 0.15, 0.05);
    add(new THREE.TorusGeometry(0.58, 0.035, 6, 30), gilt, 0, 0.15, 0.1);
  } else if (id === 'moon') {
    add(new THREE.TorusGeometry(0.42, 0.11, 10, 24, Math.PI * 1.25), gilt, 0, 0.12, 0.1, 0, 0, Math.PI * 0.62);
    add(new THREE.SphereGeometry(0.09, 8, 6), glow, -0.08, 0.5, 0.12);
  }
  ship.body.add(g);
  return g;
}
