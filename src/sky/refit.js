// refit.js: the Shipyard's rules, Brightvein's. Buying the six ships (shards and the claim's materials, opened by the
// Keep's level and the chapter), their upgrades (the airship game's four, three steps each: mods.js), the kinds of shot
// and the colours (priced here in the claim's shards and materials), the crew from the claim (gunners, a pilot and a
// bosun, by their stats), wear carried home, and repairs on the claim's time at the dock.
// loadout() turns a ship, her upgrades, her crystal power and her crew into what the skies fly and fire.
import { STATS } from '../ships/index.js';
import { MODS, STEPS, POWER, HELM } from './mods.js';
import { SHOTS } from './tactics.js';
import { DYES } from './paint.js';

export { MODS, STEPS, POWER };
// how big each class is, for prices, upgrades and repairs
export const CLASS = { skiff: 1, cutter: 1.6, brig: 2.6, frigate: 4, galleon: 5.5, manowar: 7.5 };
const round5 = (n) => Math.round(n / 5) * 5;
export const MATS = { brass: 'Brass Scrap', glass: 'Cut Glass', heartstone: 'Heartstone' };   // as the claim names them (src/claim/loot.js)

// ---------- the ships for sale ----------
// price: shards and materials (the claim's Brass Scrap, Cut Glass and Heartstone). need: the Keep's level and the
// chapter (story.js) before the yard will build her. The big two are act two's goals (docs/story.md: act two's claim
// holds two or three thousand shards, and its yards make more than that every few days)
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

// ---------- upgrades ----------
// a step costs shards (50, 120, 260, times the ship's size) and materials: Brass for the first, Brass and Cut Glass for
// the second, Cut Glass and Heartstone for the third, more of them on a bigger ship
const STEP_SHARDS = [50, 120, 260];
const STEP_MATS = { skiff: 1, cutter: 1, brig: 2, frigate: 2, galleon: 3, manowar: 4 };
export function modCost(id, step) {
  if (step >= STEPS) return null;
  const m = STEP_MATS[id], c = { shards: round5(STEP_SHARDS[step] * CLASS[id]) };
  if (step === 0) c.brass = m;
  else if (step === 1) { c.brass = m; c.glass = Math.ceil(m / 2); }
  else { c.glass = m; c.heartstone = Math.ceil(m / 2); }
  return c;
}
// the kinds of shot (bought once, for every ship)
export const SHOT_PRICE = { chain: { shards: 150, brass: 2 }, breaker: { shards: 450, glass: 2 } };
// the colours: a dye bought once is the claim's for every ship (some can only be won: paint.js)
export const dyePrice = (id) => (DYES[id]?.price ? { shards: DYES[id].price } : null);
// a cost in words: ◆ 120 · 2 Brass Scrap · 1 Cut Glass
const fmt = (n) => Math.round(n).toLocaleString('en');
export const costText = (c) => [c.shards ? `◆ ${fmt(c.shards)}` : '', ...Object.keys(MATS).filter((k) => c[k]).map((k) => `${c[k]} ${MATS[k]}`)].filter(Boolean).join(' · ') || 'Free';
// where each material comes from, for "what you're short of" under a price
export const WHERE = {
  brass: 'Brass Scrap comes from the prospect camp, the convoy and Redspire, and from salvage at Odile’s bench',
  glass: 'Cut Glass comes in the crates at Redspire and the Wickmoor (later the Plumbline), from the old ruins in the wilds, and from lightning glass after a storm',
  heartstone: 'Heartstone comes from the Wickmoor, the storm front and the Chandlery, from the wreck fields in the wilds, and from a singing shard in the mine',
};

// ---------- crew ----------
// seats: a pilot (Agility: turning, a quicker Surge), a bosun (Grit: the hull crew: less harm, more patching, quicker
// repairs) and gunners (Agility: reload and aim), more of them on bigger ships. An empty seat is a dock hand, worth a 3.
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
// The airship game's loadout (mods.js: her upgrades, crystal power, and the big two's better helm) with her crew on it:
// the gunners' reload, aim and shot, the pilot's turning and Surge, the bosun's guard and patching. Between fights (and
// when they patch her mid-fight) the crew bring the hull up to `patch.hull` of new and the rest to `patch.other`: the
// rest waits for the dock
export const SURGE_BASE = { boost: 0.6, time: 3, recharge: 15 };
const NONE = { armour: 0, canvas: 0, drill: 0, crystals: 0 };
export function loadout(id, cfg, crew = null) {
  const st = STATS[id], m = cfg.mods ?? NONE, p = cfg.power ?? 0, helm = HELM[id], C = crew ?? crewEffects(id);
  return {
    stats: {
      ...st,
      hull: Math.round(st.hull * (1 + 0.2 * m.armour) * (helm?.tough ?? 1)),
      sails: Math.round(st.sails * (1 + 0.2 * m.canvas)),
      crystals: Math.round(st.crystals * (1 + 0.2 * m.crystals) * (helm?.tough ?? 1)),
    },
    tune: {
      speed: (1 - 0.04 * m.armour) * (1 + 0.04 * m.canvas) * (1 - 0.06 * p),
      accel: (1 - 0.1 * m.armour) * (1 - 0.06 * p),
      climb: (1 + 0.12 * m.crystals) * (helm?.climb ?? 1),
      turn: (helm?.turn ?? 1) * C.turn,
      guard: C.guard,
      surge: { recharge: Math.max(8, SURGE_BASE.recharge - C.surge) },
      patch: { hull: Math.min(1, 0.6 + C.patch), other: Math.min(1, 0.8 + C.patch) },
    },
    guns: { reload: (1 - 0.1 * m.drill) * (1 - 0.08 * p) * (helm?.reload ?? 1) * C.reload, damage: (1 + 0.06 * p) * C.damage, spread: C.aim },
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
export { SHOTS };
