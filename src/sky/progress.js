// progress.js: what the Captain has earned and owns, kept between visits: Crystal Shards (Aethermoor's money), the
// ships bought, each ship's upgrades and crystal power setting, which skies (difficulty) were chosen, and the best
// wave reached. Kept in the browser on this device, and, when the game is opened on claude.ai, also in the page's own
// private store for this person, so it follows them between devices.
export const SKIES = {
  fair: { name: 'Fair Winds', line: 'Raiders aim poorly and break easily. For learning the ropes.', aim: 1.8, reload: 1.35, damage: 0.6, toughness: 0.8, pace: 0.88, extra: 0, shards: 1 },
  cross: { name: 'Crosswinds', line: 'A fair fight. Shards pay a quarter more.', aim: 1, reload: 1, damage: 1, toughness: 1, pace: 0.92, extra: 0, shards: 1.25 },
  mael: { name: 'Maelstrom', line: 'Raiders hunt in bigger packs, hit harder and aim truer. Shards pay over half as much again.', aim: 0.8, reload: 0.92, damage: 1.15, toughness: 1.15, pace: 0.96, extra: 1, shards: 1.6 },
};
export const PRICES = { skiff: 0, cutter: 300, brig: 900, frigate: 2200 };

const KEY = 'skies-of-aethermoor/save-1';
const IDS = ['skiff', 'cutter', 'brig', 'frigate'];
function fresh() {
  return {
    v: 1, saved: 0, skies: 'cross', shards: 0, flying: 'skiff', best: { fair: 0, cross: 0, mael: 0 },
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

export function makeProgress() {
  let data = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) data = merge(fresh(), JSON.parse(raw)); } catch { /* no storage here */ }
  const listeners = [];
  let remote = null, writing = false, again = false;
  const writeLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* no storage here */ } };

  // on claude.ai: this person's own save in the page's store (data/users/<id>/save), newest save wins
  async function connect() {
    if (!window.claude?.use) return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      const ref = db.doc(`data/users/${id}/save`), snap = await ref.get();
      remote = ref;
      const d = snap.exists ? snap.data() : null;
      if (d && (d.saved ?? 0) > data.saved) { data = merge(fresh(), JSON.parse(JSON.stringify(d))); writeLocal(); for (const f of listeners) f(data); }
      else if (data.saved) push();
    } catch { remote = null; }
  }
  async function push() {
    if (!remote) return;
    if (writing) { again = true; return; }
    writing = true;
    try { await remote.set(JSON.parse(JSON.stringify(data))); }
    catch (e) { if (['invalid_argument', 'not_granted', 'revoked', 'capability_disabled', 'capability_removed'].includes(e?.code)) remote = null; }
    writing = false;
    if (again) { again = false; push(); }
  }
  connect();
  return {
    get data() { return data; },
    save() { data.saved = Date.now(); writeLocal(); push(); },
    onLoad: (f) => listeners.push(f),
    reset() { data = fresh(); this.save(); },
  };
}
