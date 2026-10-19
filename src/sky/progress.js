// progress.js: the claim's fleet, kept in the claim's save: the ships bought, each ship's refits, paint, wear and
// repairs, which ship is the flagship, the crew picked from the claim's people, which skies (difficulty) were chosen,
// the best wave reached, every raid site's record (taken how often, on which claim day, the best time) and the wanted
// jumper captain on the map, if any. Crystal Shards are the claim's own: the fleet spends from and banks into the same
// purse as the town (`wallet`), so `data.shards` reads and writes it.
// Old fleets still load: a fleet saved before the shipyard (v1, with `mods`) gets its upgrades as refits (migrate()).
export const SKIES = {
  fair: { name: 'Fair Winds', line: 'Raiders aim poorly and break easily. For learning the ropes.', aim: 1.8, reload: 1.35, damage: 0.6, toughness: 0.8, pace: 0.88, extra: 0, shards: 1 },
  cross: { name: 'Crosswinds', line: 'A fair fight. Shards pay a quarter more.', aim: 1, reload: 1, damage: 1, toughness: 1, pace: 0.92, extra: 0, shards: 1.25 },
  mael: { name: 'Maelstrom', line: 'Raiders hunt in bigger packs, hit harder and aim truer. Shards pay over half as much again.', aim: 0.8, reload: 0.92, damage: 1.15, toughness: 1.15, pace: 0.96, extra: 1, shards: 1.6 },
};
// every ship the claim can own, smallest first
export const IDS = ['skiff', 'cutter', 'brig', 'frigate', 'galleon', 'manowar'];
// every place to raid (sites.js)
export const SITE_IDS = ['camp', 'outpost', 'galleon', 'citadel', 'survey', 'dredge', 'convoy', 'storm', 'bounty'];
export const PARTS = ['hull', 'sails', 'guns', 'crystals'];

const freshShip = (id) => ({
  owned: id === 'skiff', power: 0, name: '',   // name: her own name, if she has one (Barnabus’s cutter is the Gannet)
  refit: { hull: 0, sails: 0, guns: 0, crystals: 0 },
  paint: { hull: 'oak', sails: 'cream', figure: 'none' },
  wear: { hull: 1, sails: 1, crystals: 1 },   // what’s left of each part since the last voyage (1 = sound)
  repair: null,                                // under repair: { from, until } in claim days, and what it mends
});
function fresh() {
  return {
    v: 2, skies: 'fair', flying: 'skiff', best: { fair: 0, cross: 0, mael: 0 }, voyages: 0, downed: 0,
    // each place: how often it was taken, on which claim day (manned again a few days later), and the fastest time
    raids: Object.fromEntries(SITE_IDS.map((id) => [id, { won: 0, day: -99, best: 0, tries: 0 }])),
    ships: Object.fromEntries(IDS.map((id) => [id, freshShip(id)])),
    // who sails: villager ids from the claim (0: nobody, and the dock hands do it)
    crew: { pilot: 0, bosun: 0, gunners: [] },
    // a wanted jumper captain on the map (sites.js BOUNTY), and the claim day the next one may turn up
    bounty: null, bountyNext: 5, bounties: 0,
    known: [],   // the places the claim has been told about (yard.js says so when a new one opens)
  };
}
// a fleet saved before the shipyard: its four upgrades become the four parts' refits
export function migrate(d) {
  if (!d || typeof d !== 'object' || d.v >= 2) return d;
  for (const s of Object.values(d.ships || {})) {
    if (!s || !s.mods || s.refit) continue;
    const m = s.mods;
    s.refit = { hull: m.armour | 0, sails: m.canvas | 0, guns: m.drill | 0, crystals: m.crystals | 0 };
  }
  d.v = 2;
  return d;
}
// fill in anything an older save is missing
function merge(base, d) {
  if (!d || typeof d !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in d)) continue;
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) base[k] = merge(base[k], d[k]);
    else if (typeof d[k] === typeof base[k]) base[k] = d[k];
  }
  return base;
}

// wallet: { get(), set(n) } for the claim's shards. load(): the fleet as last saved (or nothing). store(): save it.
export function makeProgress({ wallet, load, store }) {
  let data;
  const listeners = [];
  const wrap = (d) => { Object.defineProperty(d, 'shards', { get: () => wallet.get(), set: (n) => wallet.set(n), enumerable: false, configurable: true }); return d; };
  function reload() {
    let raw = null;
    try { raw = load?.() ?? null; raw = raw ? migrate(JSON.parse(JSON.stringify(raw))) : null; } catch (e) { raw = null; }
    data = wrap(merge(fresh(), raw));
    if (!data.ships[data.flying] || !data.ships[data.flying].owned) data.flying = IDS.find((id) => data.ships[id].owned) || 'skiff';
    for (const f of listeners) f(data);
  }
  reload();
  return {
    get data() { return data; },
    save() { store?.(data); },
    reload,
    onLoad: (f) => listeners.push(f),
    reset() { data = wrap(fresh()); this.save(); for (const f of listeners) f(data); },
  };
}
