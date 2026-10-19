// progress.js: the Captain's fleet, kept in the claim's save: the ships bought, each ship's upgrades and crystal power
// setting, which skies (difficulty) were chosen, and the best wave reached. Crystal Shards are the claim's own: the
// fleet spends from and banks into the same purse as the town (`wallet`), so `data.shards` reads and writes it.
export const SKIES = {
  fair: { name: 'Fair Winds', line: 'Raiders aim poorly and break easily. For learning the ropes.', aim: 1.8, reload: 1.35, damage: 0.6, toughness: 0.8, pace: 0.88, extra: 0, shards: 1 },
  cross: { name: 'Crosswinds', line: 'A fair fight. Shards pay a quarter more.', aim: 1, reload: 1, damage: 1, toughness: 1, pace: 0.92, extra: 0, shards: 1.25 },
  mael: { name: 'Maelstrom', line: 'Raiders hunt in bigger packs, hit harder and aim truer. Shards pay over half as much again.', aim: 0.8, reload: 0.92, damage: 1.15, toughness: 1.15, pace: 0.96, extra: 1, shards: 1.6 },
};
export const PRICES = { skiff: 0, cutter: 300, brig: 900, frigate: 2200 };

const IDS = ['skiff', 'cutter', 'brig', 'frigate'];
function fresh() {
  return {
    v: 1, skies: 'fair', flying: 'skiff', best: { fair: 0, cross: 0, mael: 0 }, voyages: 0, downed: 0,
    ships: Object.fromEntries(IDS.map((id) => [id, { owned: id === 'skiff', power: 0, mods: { armour: 0, canvas: 0, drill: 0, crystals: 0 } }])),
  };
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
  function reload() { data = wrap(merge(fresh(), load?.() ?? null)); for (const f of listeners) f(data); }
  reload();
  return {
    get data() { return data; },
    save() { store?.(data); },
    reload,
    onLoad: (f) => listeners.push(f),
    reset() { data = wrap(fresh()); this.save(); for (const f of listeners) f(data); },
  };
}
