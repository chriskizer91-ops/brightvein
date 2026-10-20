// deeds.js: the Captain's record, counted as she sails (the save keeps it: progress.js, version 2). It listens to the
// game's news (events.js) and counts this voyage's deeds: the raiders brought down (each class, raider captains,
// treasure ships caught, crews that struck their colours), the shots fired and the hits, the hits taken, the waves
// beaten, the lands flown over. It gives no orders to the page: main.js tells the news it pays out ('deed' events) in a
// toast, and the port and the homecoming card (record.js) read what it keeps.
//   Commendations (MEDALS): a deed done once (a first raider, a broadside that sinks her, a Man-o'-war brought down,
//   a wave beaten without a hit...) or a tally reached (raiders downed, shards brought home, voyages, treasure ships),
//   each paid in shards at once, straight into the purse in port, so it's kept even if her ship goes down after; a few
//   about her fleet (every upgrade on one ship...) are seen to in port, and as she comes home (on the homecoming card).
//   Renown and ranks (RANKS): each raider brought down and each wave beaten earns renown, more on harder skies (the
//   skies' `renown`); a rank only goes up, and each rise pays a purse, told on the homecoming card (never mid-fight);
//   every other rank wins a colour for her sails or pennants (progress.js RANK_DYES).
//   Stars: each skies' fifth, tenth and fifteenth waves beaten the first time, paid at once (progress.js STAR_PAY), and
//   on the Maelstrom the tenth and fifteenth win colours no shards can buy.
//   Records: each skies' best wave (as it's beaten, so a tab closed mid-voyage keeps it), most shards brought home and
//   most raiders downed in a voyage; and the log of the last twelve voyages.
//   Harbour orders (ORDERS): three small jobs a day, the same on every device (picked by the date, from those that suit
//   how far the Captain has come), each paid when done, and the harbourmaster's thanks for all three. They start after
//   a Captain's first voyage.
// A sea trial counts for nothing here (it changes nothing in the save). Nothing runs each frame: a few numbers added up
// on a shot, a hit, a kill or a wave's end.
import { on, emit, payload } from './events.js';
import { CLOUD_Y, LAND_OF } from './world.js';
import { SKIES, PRICES, MEDAL_IDS, STAR_WAVES, STAR_PAY, STAR_DYES, RANK_AT, RANK_DYES, LANDS, ORDERS_V, LOG_KEEP, reward } from './progress.js';
import { BOUNTY } from './raiders.js';
import { CAPTAIN_ORDER } from './tactics.js';
import { MODS, STEPS } from './mods.js';
import { SHIPS } from '../ships/index.js';

const BIG = { brig: true, frigate: true, galleon: true, manowar: true }, GIANT = { frigate: true, galleon: true, manowar: true };
const fmt = (n) => Math.round(n).toLocaleString('en');
// The commendations, in the order the Captain's log lists them: a deed (`line` says it), or a tally of the record
// (`of`, counted from the save's stats and this voyage's, `need` of them), and its reward in shards. Every one has an
// id in progress.js MEDAL_IDS (the check makes sure the two lists match)
export const MEDALS = [
  { id: 'first', name: 'First Prize', line: 'Bring down your first raider', reward: 25 },
  { id: 'home', name: 'Safe Harbour', line: 'Come home with shards in the hold', reward: 25 },
  { id: 'broadside', name: 'Broadside!', line: 'Bring a raider down with a broadside', reward: 40 },
  { id: 'rake', name: 'Raked!', line: 'Rake a raider down her length with a broadside', reward: 40 },
  { id: 'crystals', name: 'Crystals Out', line: 'Sink a raider by shooting out her crystals', reward: 50 },
  { id: 'breaker', name: 'Crystal Breaker', line: 'Sink a raider by her crystals with crystal breakers', reward: 75 },
  { id: 'high', name: 'High Ground', line: 'Bring down a Brig or bigger from 60 m or more above her', reward: 60 },
  { id: 'under', name: 'Under the Clouds', line: 'Bring down a raider while flying under the cloud floor', reward: 50 },
  { id: 'thin', name: 'Thin Air', line: 'Bring down a raider while flying above 2,000 m', reward: 40 },
  { id: 'two', name: 'Two at Once', line: 'Bring down two raiders within 5 seconds', reward: 60 },
  { id: 'untouched', name: 'Untouched', line: 'Beat a wave, from wave 2 on, without being hit', reward: 40 },
  { id: 'shave', name: 'Close Shave', line: 'Beat a wave with less than 15% of your hull left', reward: 40 },
  { id: 'flag', name: 'White Flag', line: 'Make a raider crew give up and strike their colours', reward: 60 },
  { id: 'colours', name: 'Strike Her Colours', line: 'Make a treasure ship strike her colours', reward: 100 },
  { id: 'flare', name: 'No Help Coming', line: 'Sink a raider before her flare brings help', reward: 50 },
  { id: 'captain', name: 'Captain Taken', line: 'Bring down a raider captain', reward: 75 },
  { id: 'bounty', name: 'Bounty Paid', line: 'Bring down a raider captain with a price on her head', reward: 120 },
  { id: 'storm', name: 'Storm Rider', line: 'Beat a wave in a storm', reward: 60 },
  { id: 'road', name: 'The Long Way', line: 'Beat a wave down a road you chose between waves', reward: 50 },
  { id: 'fierce', name: 'Small but Fierce', line: 'Bring down a Frigate or bigger in the Skiff', reward: 150 },
  { id: 'fortress', name: 'Fortress Fallen', line: 'Bring down a Man-o\'-war', reward: 300 },
  { id: 'hunter1', name: 'Raider Hunter', line: 'Bring down 10 raiders', of: (S) => S.downed, need: 10, reward: 50 },
  { id: 'hunter2', name: 'Raider Slayer', line: 'Bring down 50 raiders', of: (S) => S.downed, need: 50, reward: 150 },
  { id: 'hunter3', name: 'Scourge of Raiders', line: 'Bring down 200 raiders', of: (S) => S.downed, need: 200, reward: 500 },
  { id: 'treasure1', name: 'Treasure Hunter', line: 'Catch 5 treasure ships', of: (S) => S.prizes, need: 5, reward: 150 },
  { id: 'treasure2', name: 'Gold in the Hold', line: 'Catch 20 treasure ships', of: (S) => S.prizes, need: 20, reward: 400 },
  { id: 'purse1', name: 'Full Purse', line: 'Bring home ◆ 1,000 in all', of: (S) => S.banked, need: 1000, reward: 50 },
  { id: 'purse2', name: 'Heavy Purse', line: 'Bring home ◆ 5,000 in all', of: (S) => S.banked, need: 5000, reward: 150 },
  { id: 'purse3', name: 'A King\'s Ransom', line: 'Bring home ◆ 20,000 in all', of: (S) => S.banked, need: 20000, reward: 400 },
  { id: 'salt1', name: 'Seasoned', line: 'Sail 10 voyages', of: (S) => S.voyages, need: 10, reward: 40 },
  { id: 'salt2', name: 'Old Salt', line: 'Sail 50 voyages', of: (S) => S.voyages, need: 50, reward: 150 },
  { id: 'charted', name: 'Charted Aethermoor', line: 'Fly over all six lands of Aethermoor', of: (S, d) => LANDS.filter((k) => d.charted[k]).length, need: LANDS.length, reward: 100 },
  { id: 'captains', name: 'Every Captain', line: 'Bring down all six raider captains', of: (S, d) => CAPTAIN_ORDER.filter((id) => d.captains?.[id]?.beaten > 0).length, need: CAPTAIN_ORDER.length, reward: 300 },
  { id: 'four', name: 'A Fleet of Four', line: 'Own the Skiff, the Cutter, the Brig and the Frigate', port: (d) => ['skiff', 'cutter', 'brig', 'frigate'].every((id) => d.ships[id].owned), reward: 200 },
  { id: 'fitted', name: 'Fully Fitted', line: 'Every upgrade on one ship', port: (d) => Object.values(d.ships).some((s) => s.owned && MODS.every((M) => s.mods[M.id] >= STEPS)), reward: 150 },
  { id: 'fleet', name: 'Every Hull', line: 'Own all six ships', port: (d) => Object.keys(PRICES).every((id) => d.ships[id].owned), reward: 1000 },
];
// (Brightvein pays them at its own rate: progress.js REWARD)
for (const M of MEDALS) M.reward = reward(M.reward);
export const MEDAL = Object.fromEntries(MEDALS.map((M) => [M.id, M]));
// the ranks, from the renown each starts at (progress.js RANK_AT); a rise to rank i pays ◆ 50 × i
export const RANKS = ['New Captain', 'Steady Captain', 'Bold Captain', 'Raider-Bane', 'Commodore', 'Rear Admiral', 'Admiral', 'High Admiral', 'Storm Admiral', 'Legend of Aethermoor'];
export const RANK_PURSE = reward(50);
export const rankFor = (renown) => { let r = 0; while (r + 1 < RANK_AT.length && renown >= RANK_AT[r + 1]) r++; return r; };
// renown: a raider brought down is worth her bounty (a captain's twice, a treasure ship's hold twice), a wave beaten 10
// for each wave so far; both times the skies' renown (Fair Winds three quarters, the Maelstrom half as much again)
export const renownFor = (r, skies) => BOUNTY[r.id] * (r.captain ? 2 : 1) * (r.role === 'prize' ? 2 : 1) * (SKIES[skies]?.renown ?? 1);
export const WAVE_RENOWN = 10;
// The harbour orders: three a day from those that suit how far she's come (`ok`: her best wave on any skies, the save),
// each `need` times over (`kind` says what's counted, `id` a class where it matters), and paid `reward` when done; all
// three done, the harbourmaster's thanks (THANKS). Kept in the save by their place in this list (progress.js ORDERS_V:
// a new game with them in another order gives every save fresh ones)
export const ORDERS = [
  { text: 'Bring down 3 Skiffs', kind: 'down', id: 'skiff', need: 3, reward: 60, ok: () => true },
  { text: 'Bring down 3 Cutters', kind: 'down', id: 'cutter', need: 3, reward: 90, ok: (b) => b >= 3 },
  { text: 'Bring down 2 Brigs', kind: 'down', id: 'brig', need: 2, reward: 120, ok: (b) => b >= 5 },
  { text: 'Bring down a Frigate', kind: 'down', id: 'frigate', need: 1, reward: 150, ok: (b) => b >= 7 },
  { text: 'Catch a treasure ship', kind: 'prize', need: 1, reward: 200, ok: (b) => b >= 6 },
  { text: 'Beat wave 3', kind: 'wave', id: 3, need: 1, reward: 60, ok: (b) => b < 6 },
  { text: 'Beat wave 6', kind: 'wave', id: 6, need: 1, reward: 100, ok: (b) => b >= 4 && b < 12 },
  { text: 'Beat wave 10', kind: 'wave', id: 10, need: 1, reward: 150, ok: (b) => b >= 8 },
  { text: 'Bring home ◆ 200 in one voyage', kind: 'bank', id: 200, need: 1, reward: 60, ok: (b) => b < 7 },
  { text: 'Bring home ◆ 1,000 in one voyage', kind: 'bank', id: 1000, need: 1, reward: 120, ok: (b) => b >= 6 },
  { text: 'Bring down a raider under the clouds', kind: 'under', need: 1, reward: 70, ok: () => true },
  { text: 'Beat a wave without being hit', kind: 'clean', need: 1, reward: 90, ok: (b) => b >= 2 },
  { text: 'Bring a raider down with a broadside', kind: 'broadside', need: 1, reward: 60, ok: (b, d) => SHIPS.some((s) => s.ports && d.ships[s.id]?.owned) }, // (a ship with broadside guns: the Cutter on)
  { text: 'Bring down a raider on the Maelstrom', kind: 'mael', need: 1, reward: 150, ok: (b, d) => d.best.cross >= 5 || d.best.mael >= 1 },
  { text: 'Bring down a raider captain', kind: 'captain', need: 1, reward: 150, ok: (b) => b >= 5 },
  { text: 'Make a raider crew give up', kind: 'struck', need: 1, reward: 100, ok: (b) => b >= 4 },
  { text: 'Sink a raider by her crystals', kind: 'crystals', need: 1, reward: 80, ok: (b) => b >= 3 },
  { text: 'Sink a raider with crystal breakers', kind: 'breaker', need: 1, reward: 120, ok: (b, d) => !!d.shots.breaker },
];
for (const o of ORDERS) o.reward = reward(o.reward);
export const THANKS = reward(100);
// the day, as the device's own clock has it (orders change at midnight), and days since the year began (the log's dates)
// (Brightvein: a day is the claim's own, `DAY.now()`, its day number: the orders change with each new day on the claim,
// and the log says "Day 12")
export const DAY = { now: null };
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (t = new Date()) => (DAY.now ? `claim-${DAY.now()}/${ORDERS_V}` : `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}/${ORDERS_V}`);
const EPOCH = new Date(2026, 0, 1);
export const dayNumber = (t = new Date()) => (DAY.now ? DAY.now() + 1 : Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - EPOCH) / 864e5) + 1);
export const dateOf = (n) => { if (DAY.now) return `Day ${n}`; const t = new Date(EPOCH); t.setDate(t.getDate() + n - 1); return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
// three of the orders that suit her, picked by the day (the same day, the same three, on every device)
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
export function pickOrders(day, d) {
  let s = hash(day);
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const best = Math.max(...Object.values(d.best)), pool = ORDERS.map((o, i) => i).filter((i) => ORDERS[i].ok(best, d)), picks = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  while (picks.length < 3) picks.push(-1);
  return picks;
}

// `player()`: the Captain's ship now; `clock()`: the game's clock (seconds); `wave()`: the wave being fought (its storm
// and its road: main.js W.wave); `trial()`: the ship on a sea trial, if one is out
export function makeDeeds({ progress, player, clock, wave, trial }) {
  const DEED = payload('deed');
  // this voyage: on (a real voyage, not a sea trial), its ship and skies, when it began, the purse then, the best wave
  // on these skies before it, and what it counts; the earned list (commendations, stars, orders, said on the
  // homecoming card); its rewards paid so far
  const T = { on: false, added: false, ship: '', skies: 'cross', t0: 0, purse0: 0, best0: 0, downed: 0, by: {}, captains: 0, prizes: 0, escaped: 0, struck: 0, shots: 0, hits: 0, taken: 0, waveTaken: 0, waves: 0, renown: 0, lastKill: -99, sunk: false, earned: [], rewards: 0 };
  const D = () => progress.data;
  // pay out: shards into the purse at once, kept (and sent up to the store) so a ship lost after keeps them; told
  function pay(kind, id, name, reward, quiet = false) {
    const d = D();
    d.shards += reward; if (T.on) { T.rewards += reward; T.earned.push({ kind, id, name, reward }); }
    if (!quiet) progress.save();
    DEED.kind = kind; DEED.id = id; DEED.name = name; DEED.reward = reward; emit('deed');
  }
  function award(id) {
    const d = D(), M = MEDAL[id];
    if (!M || d.medals[id]) return false;
    d.medals[id] = dayNumber(); pay('medal', id, M.name, M.reward);
    return true;
  }
  // the record as it would stand with this voyage's counts added (for the tallies, as they're reached at sea), until
  // they're added to it (`added`, at home), the voyage counted as one more then, while it's being finished (after that
  // the save has counted it: progress.bank)
  const S = { downed: 0, prizes: 0, banked: 0, voyages: 0 };
  function record() {
    const d = D(), st = d.stats, add = T.on && !T.added;
    S.downed = st.downed + (add ? T.downed : 0); S.prizes = st.prizes + (add ? T.prizes : 0); S.banked = st.banked; S.voyages = d.voyages + (T.on && T.added ? 1 : 0);
    return S;
  }
  function tallies() { const d = D(), R = record(); for (const M of MEDALS) if (M.of && !d.medals[M.id] && M.of(R, d) >= M.need) award(M.id); }
  // what a commendation still needs (for the log and the port's "Nearly there"): [have, need], or null for a deed
  const progressOf = (M) => (M.of ? [Math.min(M.need, M.of(record(), D())), M.need] : null);

  // ---------- the harbour orders ----------
  // today's three, picked now if the day has changed (none before a Captain's first voyage is behind her)
  function today() {
    const d = D(), O = d.orders, day = dayKey();
    if (!d.voyages || O.day === day) return O;
    Object.assign(O, { day, picks: pickOrders(day, d), got: [0, 0, 0], done: [0, 0, 0], bonus: 0 });
    progress.mark();
    return O;
  }
  // something done that an order counts (its kind, and the class or the number where it matters): each of today's that
  // it suits goes up by one (or is done at once, for a wave or a voyage's shards that reach its number)
  function order(kind, id = null) {
    if (!T.on) return;
    const d = D(); if (!d.voyages) return;
    const O = today();
    O.picks.forEach((p, i) => {
      const o = ORDERS[p];
      if (!o || O.done[i] || o.kind !== kind) return;
      if (kind === 'down' && o.id !== id) return;
      if ((kind === 'wave' || kind === 'bank') && !(id >= o.id)) return;
      if (++O.got[i] >= o.need) { O.got[i] = o.need; O.done[i] = 1; pay('order', i, o.text, o.reward); }
    });
    if (!O.bonus && O.picks.every((p, i) => p < 0 || O.done[i]) && O.picks.some((p) => p >= 0)) { O.bonus = 1; pay('orders', 'thanks', 'The harbourmaster\'s thanks', THANKS); }
  }

  // ---------- counting, from the game's news ----------
  on('voyage:start', (e) => {
    const d = D();
    T.on = !e.trial;
    if (!T.on) return;
    Object.assign(T, { added: false, ship: e.ship, skies: e.skies, t0: clock(), purse0: d.shards, best0: d.best[e.skies] ?? 0, downed: 0, by: {}, captains: 0, prizes: 0, escaped: 0, struck: 0, shots: 0, hits: 0, taken: 0, waveTaken: 0, waves: 0, renown: 0, lastKill: -99, sunk: false, earned: [], rewards: 0 });
    today();
  });
  on('fire', (e) => { if (T.on && e.owner === 'player') T.shots++; });
  on('hit', (e) => {
    if (!T.on) return;
    if (e.owner === 'player' && e.raider) { T.hits++; e.raider.lastKind = e.kind; e.raider.lastShot = e.shot; } // (what last hit her: a broadside sinking her is a commendation, and breakers her crystals)
    else if (e.target === 'player') { T.taken++; T.waveTaken++; }
  });
  on('raked', (e) => { if (T.on && e.owner === 'player') award('rake'); });
  on('wave:start', () => { T.waveTaken = 0; });
  on('flare', (e) => { if (T.on && e.stage === 'none' && e.raider?.f.down?.why !== 'struck') award('flare'); });
  on('raider:down', (e) => {
    if (!T.on || e.raider?.friend) return; // (one of the claim's own barges lost on a convoy run counts for nothing: Brightvein)
    const r = e.raider, why = e.why, P = player(), d = D(), now = clock();
    T.downed++; T.by[r.id] = (T.by[r.id] ?? 0) + 1; T.renown += renownFor(r, T.skies);
    award('first');
    if (r.captain) T.captains++;
    if (r.role === 'prize') { T.prizes++; if (why === 'struck') award('colours'); order('prize'); }
    else if (why === 'struck') { T.struck++; award('flag'); order('struck'); }
    if (why === 'crystals') { award('crystals'); order('crystals'); if (r.lastShot === 'breaker') { award('breaker'); order('breaker'); } }
    if (r.who) { award('captain'); if ((d.captains?.[r.who.id]?.sank ?? 0) > 0) award('bounty'); order('captain'); } else if (r.captain) order('captain');
    if (r.id === 'manowar') award('fortress');
    if (r.lastKind === 'broadside' && why !== 'struck') { award('broadside'); order('broadside'); }
    if (P) {
      if (BIG[r.id] && P.pos.y - r.f.pos.y >= 60) award('high');
      if (P.pos.y < CLOUD_Y) { award('under'); order('under'); }
      if (P.pos.y > 2000) award('thin');
      if (P.ship.recipe.id === 'skiff' && GIANT[r.id]) award('fierce');
    }
    if (now - T.lastKill < 5) award('two');
    T.lastKill = now;
    if (T.skies === 'mael') order('mael');
    order('down', r.id);
    tallies();
  });
  on('raider:escaped', (e) => { if (T.on && e.raider.role === 'prize') T.escaped++; });
  on('player:down', () => { T.sunk = true; });
  on('region', (e) => chart(e.name));
  // a wave beaten: its renown, the best wave (kept at once), a star, and the commendations and orders for it
  on('wave:cleared', (e) => {
    if (!T.on) return;
    const d = D(), n = e.n, P = player(), W = wave(), k = T.skies;
    T.waves = n; T.renown += WAVE_RENOWN * n * (SKIES[k]?.renown ?? 1);
    if (n > (d.best[k] ?? 0)) d.best[k] = n;
    const i = STAR_WAVES.indexOf(n);
    if (i >= 0 && !d.stars[k][`w${n}`]) {
      d.stars[k][`w${n}`] = 1;
      const dye = STAR_DYES[k]?.[n]; if (dye) d.dyes[dye] = 1;
      pay('star', `${k}:${n}`, `${SKIES[k].name} star: wave ${n}`, STAR_PAY[k][i], true);
    }
    if (n >= 2 && T.waveTaken === 0) { award('untouched'); order('clean'); }
    if (P && P.frac('hull') < 0.15) award('shave');
    if (W?.storm) award('storm');
    if (W?.road) award('road');
    order('wave', n);
    progress.save(); // (the end of a wave: kept, and sent up)
  });
  // a land of Aethermoor flown over (by its name, as the region's banner says it)
  function chart(name) {
    if (!T.on) return;
    const k = LAND_OF[name], d = D();
    if (!k || !LANDS.includes(k) || d.charted[k]) return;
    d.charted[k] = 1; progress.mark(); tallies();
  }

  // ---------- home: the voyage added to the record ----------
  // what she brought home (`got`, after `keep`: all of it, or half), whether she went down; returns the summary for the
  // homecoming card (record.js)
  function finish({ got, keep, sunk, gathered, bonus }) {
    if (!T.on) return null;
    const d = D(), st = d.stats, k = T.skies, secs = Math.max(0, clock() - T.t0);
    order('bank', got); // (before she's counted as a Captain who has sailed: a first voyage's orders aren't drawn yet)
    for (const key of ['downed', 'captains', 'prizes', 'escaped', 'struck', 'shots', 'hits', 'taken', 'waves', 'renown']) st[key] += T[key];
    for (const id in T.by) st[id] = (st[id] ?? 0) + T.by[id];
    st.renown = Math.round(st.renown); st.banked += got; st.secs += Math.round(secs); if (sunk) st.sunk++; else st.home++;
    T.added = true; // (the voyage counts as one more from here: progress.bank, after this, counts it in the save)
    const R = d.records[k]; R.shards = Math.max(R.shards, got); R.downed = Math.max(R.downed, T.downed);
    d.log.push({ d: dayNumber(), ship: T.ship, skies: k, w: T.waves, k: T.downed, s: got, sunk: sunk ? 1 : 0 }); d.log = d.log.slice(-LOG_KEEP);
    if (!sunk && got > 0) award('home');
    tallies();
    // (and any her fleet has earned that port sees to, won as she comes in: an old save's fleet, say. Counted here, so
    // it's on the homecoming card with the rest, not told under it: inPort finds nothing more)
    for (const M of MEDALS) if (M.port && !d.medals[M.id] && M.port(d)) award(M.id);
    // a rank risen: a purse for each rank risen through, and the colours they win
    const was = d.rank, now = rankFor(st.renown);
    let purse = 0;
    if (now > was) {
      for (let r = was + 1; r <= now; r++) { purse += RANK_PURSE * r; if (RANK_DYES[r]) d.dyes[RANK_DYES[r]] = 1; }
      d.rank = now; pay('rank', now, RANKS[now], purse, true);
    }
    T.on = false;
    const next = now + 1 < RANKS.length ? RANK_AT[now + 1] : null;
    return {
      ship: T.ship, skies: k, waves: T.waves, best0: T.best0, newBest: T.waves > T.best0, downed: T.downed, by: { ...T.by }, captains: T.captains, prizes: T.prizes, escaped: T.escaped, struck: T.struck,
      shots: T.shots, hits: T.hits, taken: T.taken, secs, gathered, bonus, keep, got, sunk, purse0: T.purse0, rewards: T.rewards, earned: T.earned.slice(),
      rank: { i: now, name: RANKS[now], up: now > was, purse, renown: st.renown, from: RANK_AT[now], next, nextName: next !== null ? RANKS[now + 1] : null },
    };
  }

  // ---------- in port: the commendations her fleet earns, as it changes ----------
  // returns the names of any just won (the port says so)
  function inPort() {
    const d = D(), won = [];
    for (const M of MEDALS) if (M.port && !d.medals[M.id] && M.port(d)) { const was = T.on; T.on = false; award(M.id); T.on = was; won.push(M); }
    today();
    return won;
  }
  // the Captain's rank now, and how far to the next (for the title, the port and the log)
  function standing() {
    const d = D(), i = d.rank, next = i + 1 < RANKS.length ? RANK_AT[i + 1] : null;
    return { i, name: RANKS[i], renown: d.stats.renown, from: RANK_AT[i], next, nextName: next !== null ? RANKS[i + 1] : null };
  }
  // the tally commendation she's nearest to (half way or more), for "Nearly there"
  function nearest() {
    let best = null, f = 0.5;
    for (const M of MEDALS) {
      if (!M.of || D().medals[M.id]) continue;
      const [have, need] = progressOf(M), k = have / need;
      if (k >= f && k < 1) { f = k; best = { M, have, need }; }
    }
    return best;
  }
  return { finish, inPort, today, standing, nearest, progressOf, chart, MEDALS, ORDERS, RANKS, THANKS, STAR_PAY, pickOrders, dayKey, get voyage() { return T; } };
}
