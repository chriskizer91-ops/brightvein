// progress.js: the claim's fleet and the Captain's record, kept in the claim's own save (main.js saveGame keeps it as
// `sky`). The fleet: the ships bought, each ship's upgrades, crystal power, colours, wear and repairs, which ship is
// the flagship, the crew picked from the claim's people, which skies (difficulty) were chosen, the best wave reached,
// every raid place's record (taken how often, on which claim day, the best time) and the wanted jumper captain on the
// map, if any. Shards are the claim's own: the fleet spends from and banks into the same purse as the town (`wallet`),
// so `data.shards` reads and writes it.
// And, from the airship game's stage 4, the Captain's record (deeds.js counts it): what every voyage brought down and
// brought home, the commendations won, the stars on each skies, the renown and the rank it brings, the tips already
// given, the lands flown over, the sail and pennant colours won or bought, the kinds of shot aboard, the raider captains
// met, the day's harbour orders and a log of the last twelve voyages.
// Version 3 of the fleet's save. Older fleets still load (migrate): v1's `mods` became v2's refits; v2's refits (hull,
// sails, guns, crystals) become the four upgrades (armour, canvas, gun drill, cut crystals) level for level; v2's sail
// colours become the nearest dye (and that dye is the claim's for every ship), and its hull paints and figureheads,
// which the new Shipyard doesn't sell, are paid back; its best waves earn their stars (paid once, as back pay) and a
// rank to match. Raid records, the crew and the bounty carry over as they are.
// (No imports here: the lists of what the save keeps by name are plain, and deeds.js, coach.js and paint.js give them
// their words and their rules.)

// the three skies: how well the raiders aim, how quickly they reload, how hard they hit, how much they take, how fast
// they fly, how many more of them come, what shards pay, and how much of a raider captain's edge over her crew she has;
// which waves bring a storm, how near a raider still sees the Captain hidden in cloud (`sight`, metres), how long a
// raider's gun ports glow before her broadside (`warn`, seconds), how smart the raiders fight (`smart`), the chance a
// hurt raider runs for the clouds (`flee`), and how much renown a deed there brings (`renown`)
export const SKIES = {
  fair: { name: 'Fair Winds', line: 'Raiders aim poorly, hit lightly and break easily. For learning the ropes.', aim: 1.8, reload: 1.35, damage: 0.45, toughness: 0.76, pace: 0.88, extra: 0, shards: 1, captain: 0,
    storms: { waves: [], after: 0 }, sight: 180, warn: 1, smart: 0, flee: 0.3, renown: 0.75 },
  cross: { name: 'Crosswinds', line: 'A fair fight. Shards pay a quarter more.', aim: 1, reload: 1, damage: 1, toughness: 1, pace: 0.92, extra: 0, shards: 1.25, captain: 1,
    storms: { waves: [8, 13], after: 0 }, sight: 250, warn: 0.8, smart: 1, flee: 0.5, renown: 1 },
  mael: { name: 'Maelstrom', line: 'Raiders hunt in bigger packs, hit harder and aim truer. Shards pay over half as much again.', aim: 0.8, reload: 0.92, damage: 1.15, toughness: 1.15, pace: 0.96, extra: 1, shards: 1.6, captain: 1,
    storms: { waves: [4, 8, 12], after: 0.4 }, sight: 350, warn: 0.6, smart: 2, flee: 0.6, renown: 1.5 },
};
// every ship the claim can own, smallest first
export const IDS = ['skiff', 'cutter', 'brig', 'frigate', 'galleon', 'manowar'];
// what each ship costs in shards (refit.js SHIPYARD has the whole price, materials and all, and when the yard can
// build her): the record's "Every Hull" commendation goes by these
export const PRICES = { skiff: 0, cutter: 300, brig: 1000, frigate: 2600, galleon: 5000, manowar: 8500 };
// a ship the Shipyard sells only to a claim that owns another first: the Man-o'-war after the Galleon (owning her
// alone, the treasure ships would still be treasure Brigs, and a laden Brig outruns a Man-o'-war: raiders.js)
export const NEEDS = { manowar: 'galleon' };
// every place to raid (sites.js)
export const SITE_IDS = ['camp', 'outpost', 'galleon', 'citadel', 'survey', 'dredge', 'convoy', 'storm', 'bounty'];
export const MOD_IDS = ['armour', 'canvas', 'drill', 'crystals'];

// ---------- what the Captain's record keeps by name ----------
export const MEDAL_IDS = ['first', 'home', 'broadside', 'high', 'crystals', 'breaker', 'colours', 'flag', 'captain', 'bounty', 'fortress', 'untouched', 'shave', 'two', 'under', 'thin', 'fierce',
  'rake', 'flare', 'storm', 'road', 'hunter1', 'hunter2', 'hunter3', 'purse1', 'purse2', 'purse3', 'salt1', 'salt2', 'treasure1', 'treasure2', 'four', 'fleet', 'fitted', 'charted', 'captains'];
export const TIP_IDS = ['steer', 'find', 'aim', 'fire', 'guns', 'shards', 'hurt', 'broadside', 'fan', 'card', 'surge', 'shot'];
export const SAIL_DYES = ['sailcloth', 'sky', 'sea', 'honey', 'twilight', 'dusk', 'storm'];
export const PENNANT_DYES = ['plum', 'teal', 'silver', 'sunrise', 'emerald', 'royal', 'lightning'];
export const DYE_IDS = [...SAIL_DYES, ...PENNANT_DYES];
export const LANDS = ['w', 'g', 'f', 'h', 'p', 'k'];
// Brightvein pays the record's rewards at this share of the airship game's (its shards buy a claim, too: the yards and
// the story pay more of them than a voyage does), in multiples of five
export const REWARD = 0.5;
export const reward = (n) => Math.max(5, Math.round((n * REWARD) / 5) * 5);
// a star on each skies for beating its fifth, tenth and fifteenth waves the first time, paid at once (deeds.js); the
// Maelstrom's tenth and fifteenth win colours no shards can buy
export const STAR_WAVES = [5, 10, 15];
export const STAR_PAY = Object.fromEntries(Object.entries({ fair: [50, 150, 300], cross: [100, 250, 500], mael: [200, 500, 1000] }).map(([k, v]) => [k, v.map(reward)]));
export const STAR_DYES = { mael: { 10: 'storm', 15: 'lightning' } };
export const RANK_AT = [0, 120, 400, 1000, 2000, 3500, 6000, 10000, 16000, 25000];
export const RANK_DYES = { 2: 'emerald', 4: 'twilight', 6: 'royal', 8: 'dusk' };
export const ORDERS_V = 1;
export const LOG_KEEP = 12;
const SKIES_IDS = Object.keys(SKIES);
const zeros = (ids, v = 0) => Object.fromEntries(ids.map((id) => [id, v]));

const freshShip = (id) => ({
  owned: id === 'skiff', power: 0, name: '',   // name: her own name, if she has one (Barnabus's cutter is the Gannet)
  mods: zeros(MOD_IDS),
  paint: { sails: SAIL_DYES[0], pennant: PENNANT_DYES[0] },
  wear: { hull: 1, sails: 1, crystals: 1 },   // what's left of each part since the last voyage (1 = sound)
  repair: null,                                // under repair: { from, until } in claim days, and what it mends
});
function fresh() {
  return {
    v: 3, skies: 'fair', flying: 'skiff', best: { fair: 0, cross: 0, mael: 0 }, voyages: 0, downed: 0,
    // each place: how often it was taken, on which claim day (manned again a few days later), and the fastest time
    raids: Object.fromEntries(SITE_IDS.map((id) => [id, { won: 0, day: -99, best: 0, tries: 0 }])),
    ships: Object.fromEntries(IDS.map((id) => [id, freshShip(id)])),
    // who sails: villager ids from the claim (0: nobody, and the dock hands do it)
    crew: { pilot: 0, bosun: 0, gunners: [] },
    // a wanted jumper captain on the map (sites.js), and the claim day the next one may turn up
    bounty: null, bountyNext: 5, bounties: 0,
    known: [],   // the places the claim has been told about (yard.js says so when a new one opens)
    // the Captain's record (deeds.js)
    shots: { chain: false, breaker: false },
    captains: {},
    stats: { home: 0, sunk: 0, waves: 0, downed: 0, ...zeros(IDS), captains: 0, prizes: 0, escaped: 0, struck: 0, shots: 0, hits: 0, taken: 0, banked: 0, secs: 0, renown: 0 },
    records: Object.fromEntries(SKIES_IDS.map((k) => [k, { shards: 0, downed: 0 }])),
    stars: Object.fromEntries(SKIES_IDS.map((k) => [k, zeros(STAR_WAVES.map((w) => `w${w}`))])),
    medals: zeros(MEDAL_IDS), tips: zeros(TIP_IDS), charted: zeros(LANDS), rank: 0,
    dyes: { ...zeros(DYE_IDS), [SAIL_DYES[0]]: 1, [PENNANT_DYES[0]]: 1 },
    orders: { day: '', picks: [-1, -1, -1], got: [0, 0, 0], done: [0, 0, 0], bonus: 0 },
    log: [],
  };
}

// ---------- older fleets ----------
// v2's sail colours, as the nearest dye; its hull paints and figureheads, as what they cost (refunded)
const SAIL_OF = { cream: 'sailcloth', gold: 'honey', plum: 'twilight', sky: 'sky', rose: 'twilight', moss: 'sea' };
const CLASS = { skiff: 1, cutter: 1.6, brig: 2.6, frigate: 4, galleon: 5.5, manowar: 7.5 };
const round5 = (n) => Math.round(n / 5) * 5;
// a fleet saved before this version, brought up to it as it was saved (before it's filled in): returns what's owed
// back ({ shards, brass }) for what the new Shipyard doesn't sell, and the dyes its old colours become
function migrateOld(d) {
  const owed = { shards: 0, brass: 0 }, dyes = [];
  if (!d || typeof d !== 'object' || d.v >= 3) return { owed, dyes };
  for (const [id, s] of Object.entries(d.ships || {})) {
    if (!s || typeof s !== 'object') continue;
    // v2's refits by part (a v2 fleet that began as v1 keeps its old `mods` beside them: the refits are newer), or a v1
    // fleet's four upgrades by these names already (`mods`)
    if (s.refit && typeof s.refit === 'object') {
      const r = s.refit;
      s.mods = { armour: r.hull | 0, canvas: r.sails | 0, drill: r.guns | 0, crystals: r.crystals | 0 };
    } else if (!s.mods || typeof s.mods !== 'object') s.mods = zeros(MOD_IDS);
    for (const k of MOD_IDS) s.mods[k] = Math.max(0, Math.min(3, s.mods[k] | 0));
    delete s.refit;
    const P = s.paint || {}, k = Math.sqrt(CLASS[id] || 1);
    if (P.hull && P.hull !== 'oak') owed.shards += round5(15 * k);
    if (P.figure && P.figure !== 'none') { owed.shards += round5(40 * k); owed.brass += 1; }
    const sail = SAIL_OF[P.sails] ?? (SAIL_DYES.includes(P.sails) ? P.sails : 'sailcloth');
    if (sail !== 'sailcloth') dyes.push(sail);
    s.paint = { sails: sail, pennant: PENNANT_DYES.includes(P.pennant) ? P.pennant : 'plum' };
  }
  return { owed, dyes };
}

// fill in anything an older save is missing, keeping only what the fresh save lists. An empty object in the fresh
// save is a map kept by name (`captains`): taken whole. A list is taken whole only if the fresh one is empty or as long
// (today's three orders); a number only if it's a real one; a nothing (null: the bounty, a repair) takes what's there
const isMap = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
function merge(base, d) {
  if (!isMap(d)) return base;
  for (const k of Object.keys(base)) {
    if (!(k in d)) continue;
    const b = base[k], v = d[k];
    if (b === null) { if (v === null || isMap(v)) base[k] = v; }
    else if (isMap(b) && !Object.keys(b).length) { if (isMap(v)) base[k] = v; }
    else if (isMap(b)) base[k] = merge(b, v);
    else if (Array.isArray(b)) { if (Array.isArray(v) && (!b.length || v.length === b.length)) base[k] = v; }
    else if (typeof v === typeof b && (typeof v !== 'number' || Number.isFinite(v))) base[k] = v;
  }
  return base;
}
// what a list or a name in it must be
const num = (x) => typeof x === 'number' && Number.isFinite(x);
function sanitize(d) {
  d.log = d.log.filter((e) => isMap(e) && num(e.d) && num(e.w) && num(e.k) && num(e.s) && typeof e.ship === 'string' && typeof e.skies === 'string').slice(-LOG_KEEP);
  const O = d.orders;
  O.picks = O.picks.map((x) => (Number.isInteger(x) && x >= -1 ? x : -1)); O.got = O.got.map((x) => (num(x) ? x : 0)); O.done = O.done.map((x) => (x ? 1 : 0));
  d.dyes[SAIL_DYES[0]] = d.dyes[PENNANT_DYES[0]] = 1;
  d.crew.gunners = d.crew.gunners.filter((g) => num(g));
  d.known = d.known.filter((k) => typeof k === 'string');
  for (const id of IDS) {
    const S = d.ships[id], P = S.paint;
    for (const k of MOD_IDS) S.mods[k] = Math.max(0, Math.min(3, Math.round(S.mods[k]) || 0));
    S.power = Math.max(-2, Math.min(2, Math.round(S.power) || 0));
    if (!SAIL_DYES.includes(P.sails) || !d.dyes[P.sails]) P.sails = SAIL_DYES[0];
    if (!PENNANT_DYES.includes(P.pennant) || !d.dyes[P.pennant]) P.pennant = PENNANT_DYES[0];
  }
  if (!SKIES[d.skies]) d.skies = 'fair';
  return d;
}
const rankFor = (renown) => { let r = 0; while (r + 1 < RANK_AT.length && renown >= RANK_AT[r + 1]) r++; return r; };
function rankDyes(d) { for (const r in RANK_DYES) if (d.rank >= +r) d.dyes[RANK_DYES[r]] = 1; }
// A fleet from before the Captain's record: what it already proves is credited. Each skies' best wave earns its stars
// (paid once now, as back pay, with the Maelstrom's colours) and renown, so a Captain who has sailed far starts at a
// fitting rank; one who has sailed isn't taught the beginner's tips again. Returns the back pay in shards
const BEGINNER_TIPS = TIP_IDS.filter((id) => id !== 'surge' && id !== 'shot');
function credit(d) {
  if (d.voyages > 0 || Object.values(d.best).some((n) => n > 0) || IDS.some((id) => id !== 'skiff' && d.ships[id].owned)) {
    for (const id of BEGINNER_TIPS) d.tips[id] = 1;
    d.voyages = Math.max(d.voyages, 1);
  }
  let pay = 0, renown = 0;
  for (const k of SKIES_IDS) {
    const n = d.best[k];
    STAR_WAVES.forEach((w, i) => { if (n >= w && !d.stars[k][`w${w}`]) { d.stars[k][`w${w}`] = 1; pay += STAR_PAY[k][i]; const dye = STAR_DYES[k]?.[w]; if (dye) d.dyes[dye] = 1; } });
    renown += 10 * (n * (n + 1)) / 2 * SKIES[k].renown;
  }
  d.stats.renown = Math.max(d.stats.renown, Math.round(renown));
  d.stats.downed = Math.max(d.stats.downed, d.downed | 0);
  d.rank = Math.max(d.rank, rankFor(d.stats.renown)); rankDyes(d);
  return pay;
}

// wallet: { get(), set(n) } for the claim's shards. load(): the fleet as last saved (or nothing). store(): save it.
// hold(): true while a fight is on, when a save waits for the fight's end (flush), so a phone never stutters mid-fight
export function makeProgress({ wallet, load, store, hold = () => false }) {
  let data, backPay = 0, owed = { shards: 0, brass: 0 }, dirty = false;
  const listeners = [];
  const wrap = (d) => { Object.defineProperty(d, 'shards', { get: () => wallet.get(), set: (n) => wallet.set(n), enumerable: false, configurable: true }); return d; };
  function reload() {
    let raw = null, old = null;
    try { raw = load?.() ?? null; raw = raw ? JSON.parse(JSON.stringify(raw)) : null; } catch (e) { raw = null; }
    const was = raw && typeof raw === 'object' ? raw.v | 0 : 3;
    if (raw && was < 3) old = migrateOld(raw);
    const merged = merge(fresh(), raw);
    if (old) for (const dye of old.dyes) merged.dyes[dye] = 1; // (its old sail colours, as dyes: before they're checked)
    data = wrap(sanitize(merged));
    data.v = 3;
    backPay = 0; owed = { shards: 0, brass: 0 };
    if (raw && was < 3) {
      backPay = credit(data);
      owed = old.owed;
    }
    if (!data.ships[data.flying] || !data.ships[data.flying].owned) data.flying = IDS.find((id) => data.ships[id].owned) || 'skiff';
    data.ships.skiff.owned = true;
    for (const f of listeners) f(data, false, false);
  }
  reload();
  function save() { if (hold()) { dirty = true; return; } dirty = false; store?.(data); }
  return {
    get data() { return data; },
    save,
    // a small change (a tip given, a land charted): kept with the claim's next save
    mark() { dirty = true; },
    // what's waiting to be kept, kept now
    flush() { if (dirty) { dirty = false; store?.(data); } },
    get dirty() { return dirty; },
    reload,
    // what an older fleet was owed as it was brought up to this version, once: { pay: back pay for its stars, shards
    // and brass for the hull paints and figureheads the new Shipyard doesn't sell }. The claim pays it (dock.js)
    takeOwed() { const o = { pay: backPay, shards: owed.shards, brass: owed.brass }; backPay = 0; owed = { shards: 0, brass: 0 }; return o; },
    takeBackPay() { const n = backPay; backPay = 0; return n; },
    // shards brought home from a voyage, and the wave it reached
    bank(n, wave) { if (n > 0) data.shards += n; data.best[data.skies] = Math.max(data.best[data.skies], wave); data.voyages++; save(); },
    // a Captain who has never been to sea
    get newCaptain() { return !data.voyages && !Object.values(data.best).some((n) => n > 0) && !IDS.some((id) => id !== 'skiff' && data.ships[id].owned); },
    onLoad: (f) => listeners.push(f),
    reset() { data = wrap(fresh()); save(); for (const f of listeners) f(data, false, false); },
  };
}
