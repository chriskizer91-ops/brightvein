// ===================================================================== THE DIG: Fallout Shelter's side of the claim
// The cut face below the town is a grid of rooms: six rows deep, ten columns west of the lift shaft under the
// headframe (MINE in core.js). Dig a room next to one you have, or next to the shaft, and choose what it is for; a
// crew digs it out over time. Staff it from its panel like a building. The same kind side by side merges into a
// room two or three wide that works better than its parts, and rooms level up to 3. The headframe's level sets how
// deep the lift goes: the upper rows, then the lower rows (the deep seam breaks open, chapter 7), then the deep.
// Ore goes to the foot of the shaft and the lift cage brings it up. Now and then something goes wrong down there: a
// cave-in, a flood, gas, or Wildlight breaking out of the rock. The look of it all is in minelook.js.

// ----------------------------------------------------------------- the kinds of room
const ROOMK = {
  face: { name: 'Ore Face', tag: 'Ore', short: 'Digs ore', job: { title: 'Miner', stat: 'G', night: true }, gear: 'head', cost: 40, up: [0, 0, 90, 200],
    blurb: 'Miners cut raw sunstone out of the vein. The deeper the row, the richer the ore.',
    levels: ['Picks, a lantern and a barrow', 'Timber sets, iron rails and brass lamps', 'Iron arches, crystal lamps and a steam drill'] },
  grotto: { name: 'Crystal Grotto', tag: 'Grotto', short: 'Grows shards, day and night', job: { title: 'Grotto hand', stat: 'E', stat2: 'A', night: true }, cost: 90, minRow: 2, up: [0, 0, 150, 320],
    blurb: 'Charged crystal grows on the walls down here, with no sun at all. Cutters tend it and take shards from it, day and night. Engineering and Agility both help. Only in the lower rows and deeper.',
    levels: ['A few clusters and a cutter’s bench', 'Brass growing frames: bigger clusters', 'Lenses that feed the growth: the biggest clusters'] },
  pump: { name: 'Pump Room', tag: 'Pump', short: 'Keeps the rows below it dry', job: { title: 'Pump hand', stat: 'E', night: true }, cost: 60, up: [0, 0, 100, 220],
    blurb: 'Keeps the rows below it dry, and bails out a flood fast. Lower rooms with no working pump above them can flood.',
    levels: ['A hand pump: keeps the next two rows dry', 'A beam engine: keeps three rows dry', 'A double engine: keeps every row below dry'] },
  shore: { name: 'Timber Store', tag: 'Timber', short: 'Fewer cave-ins nearby', job: { title: 'Shorer', stat: 'G', night: true }, cost: 50, up: [0, 0, 80, 180],
    blurb: 'Props and timber for the rooms around it. Cave-ins are much less likely within two rooms of it, on its own row and the rows above and below, and its crew help dig them clear.',
    levels: ['Log stacks and a saw horse', 'A hoist and squared props', 'Iron props: cave-ins are rare nearby'] },
  depot: { name: 'Cart Depot', tag: 'Carts', short: 'Faster carts to the lift', job: { title: 'Carter', stat: 'A', night: true }, cost: 70, up: [0, 0, 110, 240],
    blurb: 'Carts on rails take the ore to the lift, so miners keep cutting instead of pushing barrows. More ore from every room, most of all from the ones far from the shaft.',
    levels: ['Spare carts and a siding', 'A turntable and buffer stops', 'A little steam engine to pull the carts'] },
  assay: { name: 'Assay Cellar', tag: 'Assay', short: 'More mine finds, and better', job: { title: 'Assayer', stat: 'R', night: true }, cost: 80, up: [0, 0, 120, 260],
    blurb: 'Assayers go through every cart before it goes up, so more of what the rock turns up is found, and better things with it.',
    levels: ['A bench, scales and jars', 'A small furnace for testing', 'A brass assay engine'] },
  lamp: { name: 'Lamp Room', tag: 'Lamps', short: 'Less gas; better light nearby', job: { title: 'Lamplighter', stat: 'A', night: true }, cost: 60, up: [0, 0, 90, 200],
    blurb: 'Trims the lamps and keeps the air moving. Gas is rarer everywhere and clears faster, and the rooms right next to it work better in the light.',
    levels: ['Racks of lanterns and a hand fan', 'Bellows and an air duct', 'A crystal lamp charger'] },
  seam: { name: 'The Deep Seam', tag: 'Seam', short: 'The richest ore', job: { title: 'Seam miner', stat: 'G', night: true }, gear: 'head', fixed: true,
    blurb: 'The vein runs on down here, older and brighter: the richest ore on the claim, and the best finds. At night it glows, and Wildlight climb out of it.',
    levels: ['Broken open'] },
};
const DIG_ORDER = ['face', 'grotto', 'pump', 'shore', 'depot', 'assay', 'lamp'];
const DIG_TIERS = [
  { name: 'The upper gallery', rock: 'soft sandstone', ore: 1, gallery: 'upper' },
  { name: 'The lower gallery', rock: 'dark slate and sunstone veins', ore: 1.6, gallery: 'lower' },
  { name: 'The deep', rock: 'amber geodes and Wildlight burrows', ore: 2.2, gallery: 'deep' },
];
const tierOf = r => r < 2 ? 0 : r < 4 ? 1 : 2;
const DIG_REACH = [1, 1, 3, 5];                 // the deepest row you can dig, by headframe level
// rates: ore a second per miner at Grit 10, shards a second per cutter; two side by side work 10% better each, three
// 25%; levels 2 and 3 add 30% and 65%; a room far from the lift loses a little to pushing barrows (3.5% a room)
const DIGR = { face: 0.18, seam: 1.8, grotto: 0.06, size: [0, 1, 1.1, 1.25], lvl: [0, 1, 1.3, 1.65], haul: 0.035 };
const SEAM = { r: 5, c0: 8, w: 2 };
const INC = {
  cave: { name: 'Cave-in', tag: 'Cave-in!', text: 'The roof came down. The crew are digging it clear.' },
  flood: { name: 'Flood', tag: 'Flooding', text: 'Water is coming in. A Pump Room above bails it out fast; the crew bail slowly.' },
  gas: { name: 'Gas', tag: 'Gas!', text: 'Bad air. The crew have cleared out until it blows away. A Lamp Room clears it faster.' },
  wild: { name: 'Wildlight', tag: 'Wildlight!', text: 'Wildlight broke out of the rock. The crew are fighting it with whatever they have in hand.' },
};

// ----------------------------------------------------------------- state
const DIG = { rooms: [], digs: [], byId: {}, grid: [], oreBelow: 0, oreUp: 0, findAcc: { upper: 0, lower: 0, deep: 0 }, incT: 240, rate: 0, shardRate: 0,
  gasK: 1, vent: 0, depotCut: 0, depotBoost: 0, assayK: 1, assayLuck: 0, floats: [], sel: null, migrated: false, effT: 0 };
const CAGE = { y: 0.3, v: 0, target: null, pause: 0, riders: [], queue: [], ore: 0, dir: 0 };
const DIGIN = 0.25;                              // the rock left between rooms, each side
const headLv = () => (TOWN.b.head && TOWN.b.head.level) || 1;
const digReach = () => DIG_REACH[Math.min(3, headLv())];
const shaftBottom = () => headLv() >= 2 ? MINE.rows - 1 : DIG_REACH[1];
const cellX0 = c => MINE.colX0(c) + DIGIN, cellX1 = c => MINE.colX0(c) + MINE.cw - DIGIN;
const rowY0 = r => MINE.rowY0(r), rowY1 = r => MINE.rowY0(r) + MINE.rh;

function makeRoom(o) {
  const K = ROOMK[o.kind];
  return { isRoom: true, r: o.r, c0: o.c0, w: o.w, kind: o.kind, type: o.kind, lv: o.lv || 1, gearJob: K.gear || null, id: '', inc: null, out: 0, power: 0,
    boost: 1, shoreK: 1, dry: true, lit: 1,
    get level() { return this.lv; }, get name() { return this.kind === 'seam' ? K.name : `${K.name}, row ${this.r + 1}`; },
    def: { name: K.name, job: K.job, blurb: K.blurb, levels: K.levels, max: K.fixed ? 1 : 3 }, slots() { return K.fixed ? 4 : 2 * this.w; } };
}
function makeDigSite(o) {
  return { isRoom: true, isDig: true, r: o.r, c: o.c, kind: o.kind, type: 'dig', work: o.work, done: o.done || 0, from: o.from || 1, prev: o.prev || {}, id: `d:${o.r}.${o.c}`,
    level: 1, get name() { return `${ROOMK[this.kind].name} being dug, row ${this.r + 1}`; }, def: { name: 'Dig site', job: { title: 'Digger', stat: 'G', night: true } }, slots: () => 3 };
}
// the grid of who owns each cell, and ids for jobs ('m:row.col' of a room's west end, 'd:row.col' for a dig)
function digIndex() {
  DIG.byId = {}; DIG.grid = Array.from({ length: MINE.rows }, () => Array(MINE.cols).fill(null));
  for (const R of DIG.rooms) { R.id = `m:${R.r}.${R.c0}`; DIG.byId[R.id] = R; for (let i = 0; i < R.w; i++) DIG.grid[R.r][R.c0 + i] = R; }
  for (const d of DIG.digs) { DIG.byId[d.id] = d; DIG.grid[d.r][d.c] = d; }
  if (DIG.seam) MINE.g2 = { x0: cellX0(DIG.seam.c0), x1: cellX1(DIG.seam.c0 + DIG.seam.w - 1), y0: rowY0(DIG.seam.r), y1: rowY1(DIG.seam.r) };
}
const digAt = (r, c) => r >= 0 && r < MINE.rows && c >= 0 && c < MINE.cols ? DIG.grid[r][c] : null;
const roomAt = (r, c) => { const x = digAt(r, c); return x && !x.isDig ? x : null; };
// a job's room, even after the room it named has merged into a bigger one
function digResolve(bid) {
  if (!bid || !/^[md]:/.test(bid)) return bid;
  if (DIG.byId[bid]) return bid;
  const [r, c] = bid.slice(2).split('.').map(Number), x = digAt(r, c);
  return x ? x.id : null;
}
// can a room be dug here? (null if so, otherwise why not, in plain words)
function digWhyNot(r, c) {
  if (r < 0 || r >= MINE.rows || c < 0 || c >= MINE.cols) return 'Off the edge of the claim.';
  if (digAt(r, c)) return 'Already dug.';
  if (r > digReach()) return headLv() < 3 ? `The lift doesn’t go that deep yet. Raise the Headframe to level ${headLv() + 1}.` : 'Too deep.';
  const byShaft = c === MINE.cols - 1 && r <= shaftBottom();
  if (!byShaft && !roomAt(r, c + 1) && !roomAt(r, c - 1)) return 'Dig next to a room you have, or next to the shaft.';
  return null;
}
const digCanDig = (r, c) => !digWhyNot(r, c);
function digDiggable() { const out = []; for (let r = 0; r < MINE.rows; r++) for (let c = 0; c < MINE.cols; c++) if (digCanDig(r, c)) out.push([r, c]); return out; }
const digCost = (r, kind) => ROOMK[kind].cost + 18 * r;
const digWork = r => 28 + 18 * r + 14 * tierOf(r);
function digKindWhyNot(r, kind) { const K = ROOMK[kind]; if (K.minRow && r < K.minRow) return 'Only in the lower rows and deeper.'; return null; }
const digUpCost = R => { const K = ROOMK[R.kind]; return K.fixed || R.lv >= 3 ? 0 : Math.round(K.up[R.lv + 1] * (1 + 0.7 * (R.w - 1))); };

// ----------------------------------------------------------------- setting up, saving, and claims from before the dig
function setupDig(save) {
  const S = save && save.dig;
  if (S && Array.isArray(S.rooms)) {
    for (const o of S.rooms) if (ROOMK[o.kind]) DIG.rooms.push(makeRoom(o));
    for (const o of S.digs || []) if (ROOMK[o.kind]) DIG.digs.push(makeDigSite(o));
    DIG.oreBelow = S.oreBelow || 0; DIG.incT = S.incT ?? 240;
  } else {
    // a new claim, or one from before the dig: the upper gallery becomes an Ore Face two wide by the shaft; if the deep
    // seam was open, the old deep gallery becomes an Ore Face two wide in the lower rows, and the Deep Seam is open
    DIG.rooms.push(makeRoom({ r: 0, c0: MINE.cols - 2, w: 2, kind: 'face' }));
    if (save && headLv() >= 2) DIG.rooms.push(makeRoom({ r: 2, c0: MINE.cols - 2, w: 2, kind: 'face' }));
    DIG.migrated = !!save;
  }
  DIG.seam = DIG.rooms.find(R => R.kind === 'seam') || null;
  if (headLv() >= 2 && !DIG.seam) digOpenSeam(false);
  digIndex();
  buildDigLook();
}
function digSave() {
  return { rooms: DIG.rooms.map(R => ({ r: R.r, c0: R.c0, w: R.w, kind: R.kind, lv: R.lv })),
    digs: DIG.digs.map(d => ({ r: d.r, c: d.c, kind: d.kind, work: d.work, done: d.done, from: d.from, prev: d.prev })),
    oreBelow: Math.round((DIG.oreBelow + CAGE.ore) * 10) / 10, incT: Math.round(DIG.incT) };
}
// after the people are back: miners from before the dig take the same places in its rooms; jobs in rooms that are
// gone are let go (they find work again by what they like doing)
function digAfterLoad() {
  for (const v of GAME.villagers) {
    const j = v.d.job; if (!j) continue;
    if (j.bid === 'head') {
      const R = j.slot < 4 ? roomAt(0, MINE.cols - 1) : roomAt(2, MINE.cols - 1) || roomAt(0, MINE.cols - 1);
      v.d.job = null; v.d.pref = 'face';
      if (R) { const s = j.slot % 4; v.d.job = { bid: R.id, slot: workersOf(R.id).some(w => w.d.job.slot === s) ? freeSlot(R.id) : s }; if (v.d.job.slot < 0) v.d.job = null; }
      continue;
    }
    if (/^[md]:/.test(j.bid)) { const id = digResolve(j.bid); if (!id) v.d.job = null; else j.bid = id; }
  }
  if (DIG.migrated) setTimeout(() => toast('The mine is a dig of rooms now. Your miners kept their places. Open the <b>Mine</b> view to dig more.'), 3200);
}

// ----------------------------------------------------------------- digging, merging, upgrading
function digOrder(r, c, kind) {
  const why = digWhyNot(r, c) || digKindWhyNot(r, kind); if (why) { toast(why); return null; }
  const cost = digCost(r, kind); if (GAME.shards < cost) { toast(`That costs ${cost} shards. You have ${Math.floor(GAME.shards)}.`); return null; }
  GAME.shards -= cost;
  const from = (c === MINE.cols - 1 && r <= shaftBottom()) || roomAt(r, c + 1) ? 1 : -1;
  const d = makeDigSite({ r, c, kind, work: digWork(r), done: 0, from });
  DIG.digs.push(d); digIndex(); buildDigLook();
  digAutoCrew(d);
  digFx('start', d);
  AUDIO.play('rockfall', new THREE.Vector3((cellX0(c) + cellX1(c)) / 2, rowY0(r) + 2, WORLD.faceZ));
  return d;
}
// a crew for a new dig: anyone without work first, then miners the Ore Faces can spare (each keeps at least one)
function digAutoCrew(d, want = 2) {
  let n = workersOf(d.id).length;
  for (const v of GAME.villagers) { if (n >= want) break; if (!v.d.job && !v.d.exp && !v.d.study && digJoin(v, d)) n++; }
  for (const R of DIG.rooms) { if (n >= want) break; if (R.kind !== 'face') continue; const ws = workersOf(R.id).sort((a, b) => statOf(b, 'G') - statOf(a, 'G')); while (ws.length > 1 && n < want) if (digJoin(ws.shift(), d)) n++; }
  return n;
}
function digJoin(v, d) { const prev = v.d.job ? { ...v.d.job } : null; if (!assignJob(v, d.id)) return false; if (prev) d.prev[v.d.id] = prev; return true; }
function digCancel(d) {
  const crew = workersOf(d.id);
  DIG.digs.splice(DIG.digs.indexOf(d), 1); digIndex();
  GAME.shards += Math.floor(digCost(d.r, d.kind) / 2);
  digRelease(d, crew); buildDigLook();
}
function digRelease(d, crew) {
  for (const v of crew) {
    const prev = d.prev[v.d.id]; v.d.job = null;
    const id = prev && digResolve(prev.bid), b = id && jobBuilding(id);
    if (b && freeSlot(id) >= 0) assignJob(v, id); else { v.replan = true; v.redraw(); }
  }
  autoAssign();
}
function digFinish(d) {
  const crew = workersOf(d.id);
  DIG.digs.splice(DIG.digs.indexOf(d), 1);
  const R = makeRoom({ r: d.r, c0: d.c, w: 1, kind: d.kind, lv: 1 });
  DIG.rooms.push(R); digIndex();
  const before = R.w; digMerge(R);
  digRelease(d, crew);
  buildDigLook(); digFx('done', R, d);
  AUDIO.play('built');
  toast(R.w > before ? `The new ${esc(ROOMK[R.kind].name)} is dug out. It joins the one next door: <b>${R.w} wide</b> now, and better for it.` : `The new <b>${esc(ROOMK[R.kind].name)}</b> is dug out. Tap it to give it a crew.`);
  UI.refresh();
}
// rooms of the same kind and level side by side become one room, up to three wide (never split again)
function digMerge(R) {
  for (let again = true; again;) {
    again = false;
    for (const side of [1, -1]) {
      const N = side > 0 ? roomAt(R.r, R.c0 + R.w) : roomAt(R.r, R.c0 - 1);
      if (!N || N === R || N.kind !== R.kind || N.lv !== R.lv || ROOMK[R.kind].fixed || N.w + R.w > 3 || N.inc || R.inc) continue;
      const ids = [R.id, N.id], crew = GAME.villagers.filter(v => v.d.job && ids.includes(v.d.job.bid));
      for (const v of crew) v.d.job = null;
      R.c0 = Math.min(R.c0, N.c0); R.w += N.w; DIG.rooms.splice(DIG.rooms.indexOf(N), 1);
      digIndex();
      for (const v of crew) assignJob(v, R.id);
      again = true; break;
    }
  }
  return R;
}
function digUpgrade(R) {
  const cost = digUpCost(R); if (!cost) return false;
  if (GAME.shards < cost) { toast('Not enough shards.'); return false; }
  GAME.shards -= cost; R.lv++;
  const w = R.w; digMerge(R);
  buildDigLook(); digFx('upgrade', R);
  AUDIO.play('upgraded');
  toast(`The <b>${esc(ROOMK[R.kind].name)}</b> is now level ${R.lv}${R.w > w ? `, and joins the one next door: ${R.w} wide` : ''}.`);
  UI.refresh(); return true;
}
// the headframe reaches the deep seam: the shaft breaks through to the bottom, and the seam is a room
function digOpenSeam(show = true) {
  if (DIG.rooms.some(R => R.kind === 'seam')) return;
  const R = makeRoom({ ...SEAM, kind: 'seam' }); DIG.rooms.push(R); DIG.seam = R;
  if (!show) return;
  digIndex(); buildDigLook(); digFx('seam', R);
  setTimeout(() => toast('The deep seam is open. <b>Richer ore, and something stirs below.</b> You can dig the lower rows now.', 'night'), 1200);
  if (VIEW.mode !== 'mine') setTimeout(() => setView('mine'), 300);
}
function digHeadRaised(lv) {
  if (lv === 2) { AUDIO.play('crack'); digOpenSeam(true); }
  else { buildDigLook(); toast('The lift goes all the way down now. <b>You can dig the deepest rows.</b>'); }
}
// who takes a job by liking it: miners go to the richest face with room, everyone else to their kind of room
function digRoomFor(pref) {
  const kinds = pref === 'head' || pref === 'face' ? ['seam', 'face'] : ROOMK[pref] ? [pref] : null; if (!kinds) return null;
  let best = null, bk = -1;
  for (const R of DIG.rooms) {
    if (!kinds.includes(R.kind) || freeSlot(R.id) < 0) continue;
    const k = R.kind === 'seam' ? DIGR.seam : DIG_TIERS[tierOf(R.r)].ore * DIGR.lvl[R.lv];
    if (k > bk) { bk = k; best = R; }
  }
  return best;
}
// rooms and digs, for the jobs list on a person's card
const digJobOptions = () => [...DIG.rooms, ...DIG.digs];
// for tests and pictures: a finished room straight away (no shards, no crew), merged like any other
function digQuick(r, c, kind, lv = 1) {
  if (digAt(r, c) || r > digReach()) return null;
  const R = makeRoom({ r, c0: c, w: 1, kind, lv }); DIG.rooms.push(R); digIndex(); digMerge(R); buildDigLook(); return R;
}
function digSetHead(lv) { const H = TOWN.b.head; for (let l = H.level + 1; l <= lv; l++) { H.show(l); digHeadRaised(l); } }

// ----------------------------------------------------------------- the economy, every tick
const working = R => workersOf(R.id).some(v => v.working);
const colGap = (a, b) => Math.max(0, b.c0 - (a.c0 + a.w - 1), a.c0 - (b.c0 + b.w - 1));
function digEffects() {
  const rooms = DIG.rooms, pumps = rooms.filter(P => P.kind === 'pump' && working(P));
  let depot = 0, assay = 0, lamp = 0; DIG.assayLuck = 0;
  for (const R of rooms) { R.dry = tierOf(R.r) === 0; R.shoreK = 1; R.boost = 1; }
  for (const R of rooms) {
    if (!R.dry) R.dry = pumps.some(P => R.r > P.r && (P.lv >= 3 || R.r <= P.r + 1 + P.lv));
    if (R.kind === 'depot') depot += R.power;
    if (R.kind === 'assay') { assay += R.power; if (working(R)) DIG.assayLuck = Math.max(DIG.assayLuck, 0.25 * R.lv); }
    if (R.kind === 'lamp') lamp += R.power;
    if (R.kind === 'shore') {
      const on = working(R), cut = on ? 0.45 + 0.15 * R.lv : 0.2;
      for (const N of rooms) if (Math.abs(N.r - R.r) <= 1 && colGap(R, N) <= 2) N.shoreK = Math.min(N.shoreK, 1 - cut);
    }
    if (R.kind === 'lamp' && working(R)) for (const N of rooms) if (N !== R && Math.abs(N.r - R.r) <= 1 && colGap(R, N) <= 1) N.boost = Math.max(N.boost, 1 + 0.06 * R.lv);
  }
  DIG.depotCut = Math.min(0.85, 0.3 * depot); DIG.depotBoost = Math.min(0.25, 0.05 * depot);
  DIG.assayK = 1 + Math.min(1.5, 0.5 * assay);
  DIG.gasK = 1 - Math.min(0.75, 0.25 * lamp); DIG.vent = 0.02 * lamp;
}
// how much a room loses to pushing ore to the lift: nothing beside the shaft, more the further off (carts cut it)
const digDist = R => MINE.cols - (R.c0 + R.w);
const digHaul = R => (1 + DIG.depotBoost) / (1 + DIGR.haul * digDist(R) * (1 - DIG.depotCut));
function digEconomy(dt) {
  DIG.effT -= dt; if (DIG.effT <= 0) { DIG.effT = 0.5; digEffects(); }
  let ore = 0, shards = 0;
  const oreK = 1 + modV(TOWN.b.head, 'ore') / 100;   // a Steam Drill Head fitted at the Mine Head (fittings.js)
  for (const R of DIG.rooms) {
    let p = 0; for (const v of workersOf(R.id)) p += v.eff();
    R.power = p * DIGR.size[Math.min(3, R.w)] * DIGR.lvl[R.lv];
    let k = R.boost;
    if (R.inc) k *= R.inc.kind === 'flood' ? clamp(1 - R.inc.water / 0.8, 0, 1) * 0.9 : 0;
    R.out = 0;
    if (R.kind === 'face' || R.kind === 'seam') {
      R.out = R.power * DIGR.face * (R.kind === 'seam' ? DIGR.seam : DIG_TIERS[tierOf(R.r)].ore) * digHaul(R) * k * oreK;
      ore += R.out; DIG.findAcc[R.kind === 'seam' ? 'deep' : DIG_TIERS[tierOf(R.r)].gallery] += R.out * dt;
    } else if (R.kind === 'grotto') { R.out = R.power * DIGR.grotto * (tierOf(R.r) === 2 ? 1.35 : 1) * k; shards += R.out; }
  }
  DIG.oreBelow += ore * dt;
  // finds: every unit of ore has a small chance of turning something up (more with an Assay Cellar)
  const per = D.MINE_FINDS.perOre * DIG.assayK;
  for (const g of ['upper', 'lower', 'deep']) while (DIG.findAcc[g] >= 1) { DIG.findAcc[g] -= 1; if (Math.random() < per) mineFindHere(g); }
  const head = TOWN.b.head; if (head) head.busy = Math.abs(CAGE.v) > 0.2 ? 1 : 0;
  DIG.rate = ore; DIG.shardRate = shards;
  return { ore, shards };
}
function digFindLuck() {
  let luck = DIG.assayLuck;
  for (const R of DIG.rooms) if (R.kind === 'face' || R.kind === 'seam') for (const v of workersOf(R.id)) luck = Math.max(luck, gearOf(v).findLuck + DIG.assayLuck);
  return luck;
}

// ----------------------------------------------------------------- the dig's own clock: digging, the lift, trouble
function digTick(dt) {
  for (const d of [...DIG.digs]) {
    let p = 0; for (const v of workersOf(d.id)) if (v.working) p += statOf(v, 'G') / 10 * (v.shaken > 0 ? 0.6 : 1);
    d.done += p * dt;
    if (d.done >= d.work) { digFinish(d); continue; }
    // the diggers follow the rock back as it comes away
    const e = digEdge(d);
    for (const v of workersOf(d.id)) if (v.working) { const dx = e + d.from * (0.6 + 0.85 * v.d.job.slot) - v.pos.x; if (Math.abs(dx) > 0.05) v.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), 0.8 * dt); }
  }
  for (const v of GAME.villagers) if (v.shaken > 0) v.shaken -= dt;
  cageTick(dt);
  digIncidents(dt);
  digErrands(dt);
}
// now and then someone at work down the mine goes off on an errand along their row (fetching a prop, a lamp, word
// from the lift) and comes back; the mine looks lived in
function digErrands(dt) {
  DIG.errT = (DIG.errT ?? 15) - dt; if (DIG.errT > 0) return;
  const at = GAME.villagers.filter(v => v.working && v.where === 'mine' && v.d.job && /^m:/.test(v.d.job.bid) && v.plan.length === 1 && v.plan[0].type === 'work');
  DIG.errT = 12 + Math.random() * 18 * Math.max(1, 6 / Math.max(1, at.length));
  if (at.length < 3) return;
  const v = at[Math.random() * at.length | 0], R = jobBuilding(v.d.job.bid); if (!R || R.inc) return;
  const y = rowY0(R.r), spots = [SHAFT_X - 0.4];
  for (const c of [R.c0 - 1, R.c0 + R.w]) if (roomAt(R.r, c)) spots.push(MINE.colX0(c) + MINE.cw / 2 + (Math.random() - 0.5) * 2);
  const x = spots[Math.random() * spots.length | 0];
  v.plan = [{ type: 'line', to: new THREE.Vector3(v.pos.x, y, SHAFT_Z) }, { type: 'line', to: new THREE.Vector3(x, y, SHAFT_Z) }, { type: 'wait', t: 1.5 + Math.random() * 2 }];
}

// ----------------------------------------------------------------- the lift cage
// People wait on their landing; the cage comes, takes up to four, and drops them where they're going. When nobody
// needs it, it shuttles ore up from the foot of the shaft. Anyone kept waiting too long takes the ladder.
const CAGE_X = (MINE.shaft.x0 + MINE.shaft.x1) / 2, CAGE_Z = WORLD.faceZ - 2.0, LADDER_X = MINE.shaft.x1 - 0.55;
const CAGE_SLOTS = [[-0.42, 0.42], [0.42, 0.42], [-0.15, -0.1], [0.28, -0.12]];
const cageSpeed = () => [0, 5, 7, 9][Math.min(3, headLv())];
function liftStep(v, s, dt) {
  if (!s.st) { if (Math.abs(v.pos.y - s.to) < 0.2) return true; s.st = 'wait'; s.wt = 0; s.from = v.pos.y; s.v = v; v.where = 'mine'; CAGE.queue.push(s); }
  if (s.st === 'wait') { s.wt += dt; if (s.wt > 22) { s.st = 'ladder'; s.lp = 0; } else { v.face.set(1, 0); return false; } }
  if (s.st === 'ride') { const o = CAGE_SLOTS[s.slot || 0]; v.pos.set(CAGE_X + o[0], CAGE.y + 0.12, CAGE_Z + o[1]); v.face.set(0, 1); return false; }
  if (s.st === 'off') { v.pos.set(SHAFT_X - (s.slot || 0) * 0.3, s.to, SHAFT_Z); return true; }
  // the ladder: across to it, up or down, and back to the landing
  if (s.st === 'ladder') {
    const P = [[LADDER_X, s.from], [LADDER_X, s.to], [SHAFT_X, s.to]][s.lp], T = _dv.set(P[0], P[1], SHAFT_Z + 0.2);
    if (s.lp === 1) { v.climbing = true; v.moving = true; if (moveToward(v, T, 1.8, dt, false)) s.lp++; v.climbing = true; }
    else if (moveToward(v, T, 2.1, dt, false)) { s.lp++; if (s.lp > 2) return true; }
  }
  return false;
}
const _dv = new THREE.Vector3();
function cageTick(dt) {
  const L = CAGE;
  L.queue = L.queue.filter(s => s.st === 'wait' && s.v.plan[0] === s);
  L.riders = L.riders.filter(s => s.st === 'ride' && s.v.plan[0] === s);
  if (L.pause > 0) { L.pause -= dt; L.v = 0; return; }
  if (L.target === null) L.target = cageNext();
  if (L.target === null) { L.v = 0; return; }
  const d = L.target - L.y;
  if (Math.abs(d) < 0.02) { L.y = L.target; L.v = 0; L.target = null; cageStop(); return; }
  const want = Math.sign(d) * Math.min(cageSpeed(), Math.sqrt(2 * 3 * Math.abs(d)) + 0.25);
  L.v += clamp(want - L.v, -7 * dt, 7 * dt);
  const step = L.v * dt;
  if (Math.sign(step) === Math.sign(d) && Math.abs(step) >= Math.abs(d)) L.y = L.target; else L.y += step;
}
function cageNext() {
  const L = CAGE;
  if (L.riders.length) {
    let best = null, bc = 1e9;
    for (const s of L.riders) { const d = s.to - L.y, cost = Math.abs(d) + (L.dir && Math.sign(d) !== L.dir ? 100 : 0); if (cost < bc) { bc = cost; best = s.to; } }
    L.dir = Math.sign(best - L.y); return best;
  }
  if (L.queue.length) { const s = L.queue.reduce((a, b) => b.wt > a.wt ? b : a); L.dir = Math.sign(s.from - L.y); return s.from; }
  L.dir = 0;
  if (L.ore >= 0.5 && L.y < -0.5) return 0.3;
  if (DIG.oreBelow >= 1) { let r = 0; for (const R of DIG.rooms) if ((R.kind === 'face' || R.kind === 'seam') && R.out > 0) r = Math.max(r, R.r); return rowY0(r); }
  return null;
}
function cageStop() {
  const L = CAGE; let moved = 0;
  for (const s of L.riders) if (Math.abs(s.to - L.y) < 0.25) { s.st = 'off'; moved++; }
  L.riders = L.riders.filter(s => s.st === 'ride');
  if (L.y > -0.5) { if (L.ore >= 0.01) { GAME.ore += L.ore; DIG.oreUp += L.ore; digOreUp(L.ore); L.ore = 0; moved++; } }
  else if (DIG.oreBelow >= 0.01) { L.ore += DIG.oreBelow; DIG.oreBelow = 0; moved++; }
  for (const s of L.queue) if (Math.abs(s.from - L.y) < 0.25 && L.riders.length < 4) {
    const used = new Set(L.riders.map(q => q.slot)); s.slot = [0, 1, 2, 3].find(i => !used.has(i)); s.st = 'ride'; L.riders.push(s); moved++;
  }
  L.queue = L.queue.filter(s => s.st === 'wait');
  L.pause = moved ? 0.9 : 0.2;
}
// ore arriving at the top: a little float of "+n ore" over the headframe
function digOreUp(n) { if (n >= 0.5) DIG.floats.push({ html: `+${Math.round(n)} ore`, t: 0, pos: TOWN.b.head.worldPos(0, 3.2, 2.0) }); }

// ----------------------------------------------------------------- where everyone stands
// Each room has two places a cell. People stand side-on to what they work at (the camera sees the swing), on the
// floor between the rails and the walkway.
const DIG_STATION = { face: [1.15, 33.75, 'out'], grotto: [1.15, 33.8, 'out'], pump: [1.25, 33.6, 'in'], shore: [1.15, 33.8, 'out'], depot: [1.05, 33.5, 'in'],
  assay: [1.1, 33.55, 'in'], lamp: [1.15, 33.45, 'in'], seam: [1.15, 33.75, 'out'] };
function digStation(v, b, slot) {
  const Z = WORLD.faceZ;
  if (b.isDig) {
    const y = rowY0(b.r), edge = digEdge(b), side = b.from;
    return { kind: 'mine', gy: y, pos: new THREE.Vector3(edge + side * (0.6 + 0.85 * slot), y, Z - 2.0 - (slot % 2) * 0.6), face: side > 0 ? -Math.PI / 2 : Math.PI / 2 };
  }
  const R = b, y = rowY0(R.r);
  if (R.inc && R.inc.kind === 'gas') {   // out of the bad air, toward the shaft
    const x = Math.min(cellX1(R.c0 + R.w - 1) + 1.0 + slot * 0.45, SHAFT_X - 0.3 - slot * 0.35);
    return { kind: 'mine', gy: y, pos: new THREE.Vector3(x, y, SHAFT_Z), face: 0, idle: true };
  }
  const S = DIG_STATION[R.kind] || DIG_STATION.face, cell = Math.min(R.w - 1, slot >> 1), cx = MINE.colX0(R.c0 + cell) + MINE.cw / 2, sx = slot & 1 ? 1 : -1;
  const out = S[2] === 'out' ? sx : -sx;
  return { kind: 'mine', gy: y, pos: new THREE.Vector3(cx + sx * S[0], y, S[1]), face: out > 0 ? Math.PI / 2 : -Math.PI / 2 };
}
// how far a dig has got: the x of the rock it's working on
const digEdge = d => d.from > 0 ? lerp(cellX1(d.c), cellX0(d.c), clamp(d.done / d.work, 0, 1)) : lerp(cellX0(d.c), cellX1(d.c), clamp(d.done / d.work, 0, 1));

// ----------------------------------------------------------------- trouble down the mine
// A clock runs about once a day (less often while the dig is small): when it rings, one room with a crew at work is
// tested, and what happens depends on its row and what's protecting it. Never before day two, never more than two
// at once.
function digRisks(R) {
  const t = tierOf(R.r), seam = R.kind === 'seam';
  return {
    cave: (seam ? 0.5 : [1.1, 0.9, 1.3][t]) * R.shoreK,
    flood: t >= 1 && !R.dry ? 1.2 : 0,
    gas: [0.3, 0.6, 0.9][t] * DIG.gasK,
    wild: (seam ? 1.0 : [0, 0.4, 0.9][t]) * Math.min(1, 0.4 + GAME.nights * 0.1),
  };
}
function digIncidents(dt) {
  for (const R of DIG.rooms) if (R.inc) incUpdate(R, dt);
  if (GAME.day < 2) return;
  DIG.incT -= dt; if (DIG.incT > 0) return;
  const crewed = DIG.rooms.filter(R => !R.inc && working(R));
  DIG.incT = (150 + Math.random() * 150) * Math.max(1, 3 / Math.max(1, crewed.length));
  if (!crewed.length || DIG.rooms.filter(R => R.inc).length >= 2) return;
  const R = crewed[Math.random() * crewed.length | 0], risks = digRisks(R);
  let roll = Math.random() * (Object.values(risks).reduce((a, b) => a + b, 0) + 1.5);
  for (const [k, w] of Object.entries(risks)) { if (roll < w) { digIncident(R, k); return; } roll -= w; }
}
function digIncident(R, kind) {
  if (R.inc) return false;
  const crew = workersOf(R.id);
  R.inc = { kind, t: 0, k: 0, water: 0, spring: 22, g: 1, list: [] };
  if (kind === 'cave') { for (const v of crew) v.shaken = 40; AUDIO.play('rockfall', new THREE.Vector3((cellX0(R.c0) + cellX1(R.c0 + R.w - 1)) / 2, rowY0(R.r) + 2, WORLD.faceZ)); }
  if (kind === 'gas') for (const v of crew) v.replan = true;
  if (kind === 'wild') {
    const n = 2 + (tierOf(R.r) === 2 || R.kind === 'seam' ? 1 : 0) + (GAME.nights > 6 ? 1 : 0), y = rowY0(R.r);
    for (let i = 0; i < n; i++) {
      const x = lerp(cellX0(R.c0) + 0.6, cellX1(R.c0 + R.w - 1) - 0.6, (i + 0.5) / n + (Math.random() - 0.5) * 0.15);
      const f = new Wildlight([new THREE.Vector3(x, y, WORLD.faceZ - MINE.depth + 0.5)]);
      f.mode = 'mine'; f.mine = R; f.from = 'mine'; f.hp *= 0.8; f.prowl = 0; f.seed = Math.random() * 6.28; WL.list.push(f); R.inc.list.push(f);
      f.uni.uAlpha.value = 0.5; f.uni.uWidth.value = 0.9; f.glow.scale.set(1.4, 1.0, 1);
    }
    AUDIO.play('zap');
  }
  digFx('incident', R);
  AUDIO.play('alarm');
  toast(`<b>${INC[kind].name}</b> in the ${esc(R.name)}. ${INC[kind].text}`, 'night');
  UI.refresh();
  return true;
}
function incUpdate(R, dt) {
  const I = R.inc, crew = workersOf(R.id); I.t += dt;
  if (I.kind === 'cave') {
    let rate = 0; for (const v of crew) if (v.working) rate += statOf(v, 'G') / 10 * 0.035;
    for (const S of DIG.rooms) if (S.kind === 'shore' && S !== R && Math.abs(S.r - R.r) <= 1 && colGap(S, R) <= 2) rate += S.power * 0.02;
    I.k += rate * dt;
    if (I.k >= 1) incEnd(R, 'The rubble is cleared from the ' + esc(R.name) + '. Back to work.');
  } else if (I.kind === 'flood') {
    let bail = 0.003; for (const v of crew) bail += v.eff() * 0.008;
    for (const P of DIG.rooms) if (P.kind === 'pump' && P.r < R.r) bail += P.power * 0.03;
    I.water = clamp(I.water + ((I.spring > 0 ? 0.035 : 0) - bail) * dt, 0, 0.8); I.spring -= dt;
    if (I.spring <= 0 && I.water <= 0) incEnd(R, 'The ' + esc(R.name) + ' is bailed dry.');
  } else if (I.kind === 'gas') {
    I.g -= (0.012 + DIG.vent) * dt;
    if (I.g <= 0) incEnd(R, 'The air in the ' + esc(R.name) + ' is clear again.');
  } else if (I.kind === 'wild') {
    const live = I.list.filter(f => !f.dead && f.mine === R);
    for (const f of live) mineWildlight(f, R, dt);
    GAME.shards = Math.max(0, GAME.shards - 0.5 * live.length * dt);
    // the crew go for them
    for (const v of crew) {
      if (v.where !== 'mine' || Math.abs(v.pos.y - rowY0(R.r)) > 0.6 || !live.length) continue;
      if (!(v.plan[0] && v.plan[0].type === 'chase')) { let near = live[0], nd = 1e9; for (const f of live) { const d = Math.abs(f.pos.x - v.pos.x); if (d < nd) { nd = d; near = f; } } v.plan = [{ type: 'chase', target: near, t: 8 }]; }
    }
    if (!live.length) {
      const fought = I.list.some(f => f.hp <= 0);
      for (const v of crew) v.shaken = Math.max(v.shaken || 0, fought ? 20 : 0);
      incEnd(R, fought ? `The crew drove the Wildlight out of the ${esc(R.name)}.` : `The Wildlight in the ${esc(R.name)} faded away.`);
    }
    else if (I.t > 40) {
      for (const f of live) { f.mine = null; f.mode = 'route'; f.route = [new THREE.Vector3(SHAFT_X, f.pos.y, SHAFT_Z), new THREE.Vector3(SHAFT_X, 0.3, SHAFT_Z), HEAD_ENTRY(), TOWN.b.head.worldPos(0, 0, -4.5)]; f.speed = 3.4; }
      incEnd(R, `<b>${live.length} Wildlight got away</b> up the shaft from the ${esc(R.name)}. Watch the claim.`, 'night');
    }
  }
}
// a Wildlight loose in a room: it goes from lamp to lamp along the room, and the lamps it feeds on go dark
function mineWildlight(f, R, dt) {
  f.prowl += dt;
  const x0 = cellX0(R.c0) + 0.5, x1 = cellX1(R.c0 + R.w - 1) - 0.5, tx = lerp(x0, x1, 0.5 + 0.5 * Math.sin(f.prowl * 0.45 + f.seed)), tz = WORLD.faceZ - 2.6 + Math.sin(f.prowl * 0.8) * 0.9;
  const dx = tx - f.pos.x, dz = tz - f.pos.z, L = Math.hypot(dx, dz);
  if (L > 0.05) { const s = Math.min(L, 1.7 * dt); f.pos.x += dx / L * s; f.pos.z += dz / L * s; f.vel.set(dx / L, 0, dz / L); }
  f.pos.y = rowY0(R.r);
  R.lit = Math.max(0.25, R.lit - dt * 0.02);
}
function incEnd(R, text, kind = '') {
  const I = R.inc; R.inc = null; R.lit = 1;
  for (const v of workersOf(R.id)) v.replan = true;
  digFx('clear', R, I);
  if (text) toast(text, kind);
  digMerge(R); UI.refresh();
}

// ----------------------------------------------------------------- the Mine view's camera: straight at the face
// Drag (one finger on a phone) to pan across the dig, the wheel or a pinch to zoom; it can't wander off the dig.
const DIGCAM = { x: 10, y: -14, d: 60, wx: 10, wy: -14, wd: 60, tilt: 0.2, ptrs: new Map(), pinch: 0 };
const camT = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
// far enough out to see the whole dig, rim to bottom row, and no further
function digMaxDist() { const t = camT(), a = innerWidth / innerHeight, w = MINE.shaft.x1 - MINE.x0 + 6, h = 4.5 - rowY0(MINE.rows - 1) + 3, free = Math.max(0.6, 1 - 150 / innerHeight); return clamp(Math.max(w / 2 / (t * a), h / 2 / (t * free)) * 1.05, 46, 150); }
function digFrame() {
  const t = camT(), aspect = innerWidth / innerHeight, wide = innerWidth >= 900;
  const deepest = Math.max(...DIG.rooms.map(R => R.r), ...DIG.digs.map(d => d.r), Math.min(digReach(), DIG.rooms.length > 2 ? digReach() : 1));
  const bottom = rowY0(deepest) - 2.2, top = 4.5;
  // from two cells west of the furthest room to the shaft
  let xa = Math.min(...DIG.rooms.map(R => MINE.colX0(R.c0)), ...DIG.digs.map(d => MINE.colX0(d.c))) - MINE.cw * 2, xb = MINE.shaft.x1 + 1.5;
  xa = Math.max(MINE.x0 - 1, xa);
  if (aspect < 0.8) xa = Math.max(xa, xb - 20);                     // phones held upright: the shaft side, swipe for more
  if (wide) xb += (xb - xa) * 0.25;                                 // the panel sits on the right
  // the bars at the top and bottom of the screen cover about 70 px each
  const free = Math.max(0.6, 1 - 150 / innerHeight), w = xb - xa, h = top - bottom, d = clamp(Math.max(h / 2 / (t * free), w / 2 / (t * aspect)) * 1.03, 12, digMaxDist());
  // held upright, the view is much taller than the dig: keep the rim near the top, the rest below to dig into
  return { x: (xa + xb) / 2, y: aspect < 0.8 ? top + 3 - d * t : (top + bottom) / 2 - d * t * 0.08, d };
}
function digCamPose(x, y, d, outT, outP) {
  outT.set(x, y, WORLD.faceZ - 2.3);
  outP.set(x, y + Math.sin(DIGCAM.tilt) * d, WORLD.faceZ - 2.3 + Math.cos(DIGCAM.tilt) * d);
}
// the view to tween to when the Mine button is pressed
function digView() {
  // the first few times: how it works
  let seen = 0; try { seen = +localStorage.getItem('bv-dig-hint') || 0; localStorage.setItem('bv-dig-hint', seen + 1); } catch (e) { }
  if (seen < 3 && started) {
    const hint = $('#hint'), touch = matchMedia('(pointer:coarse)').matches;
    hint.textContent = touch ? 'Tap a dashed square to dig · drag · pinch to zoom' : 'Click a dashed square to dig a room · drag to look around · scroll to zoom';
    hint.hidden = false; clearTimeout(DIG.hintT); DIG.hintT = setTimeout(() => hint.hidden = true, 7000);
  }
  const F = digFrame(), t = new THREE.Vector3(), p = new THREE.Vector3();
  Object.assign(DIGCAM, { x: F.x, y: F.y, d: F.d, wx: F.x, wy: F.y, wd: F.d });
  digCamPose(F.x, F.y, F.d, t, p); return { t, p };
}
function digClamp() {
  const C = DIGCAM, t = camT(), a = innerWidth / innerHeight;
  C.wd = clamp(C.wd, 8, digMaxDist());
  // on a wide screen with a panel open, room to slide what you tapped clear of it, to the left (digShowRoom)
  const hh = C.wd * t, hw = hh * a, x0 = MINE.x0 - 2, x1 = MINE.shaft.x1 + 4 + (innerWidth >= 900 ? hw * (UI.cur ? 1.2 : 0.5) : 0), y0 = rowY0(MINE.rows - 1) - 3, y1 = 6;
  C.wx = x1 - x0 < hw * 2 ? (x0 + x1) / 2 : clamp(C.wx, x0 + hw * 0.6, x1 - hw * 0.6);
  C.wy = y1 - y0 < hh * 2 ? clamp(C.wy, y1 - hh, y0 + hh) : clamp(C.wy, y0 + hh * 0.6, y1 - hh * 0.6);
}
function digCamUpdate(dt) {
  const C = DIGCAM;
  if (FOLLOW.v && !FOLLOW.v.hidden && FOLLOW.v.where === 'mine') { C.wx = FOLLOW.v.pos.x; C.wy = FOLLOW.v.pos.y + 1.5; }
  digClamp();
  const k = 1 - Math.exp(-dt * 12);
  C.x = lerp(C.x, C.wx, k); C.y = lerp(C.y, C.wy, k); C.d = lerp(C.d, C.wd, k);
  digCamPose(C.x, C.y, C.d, controls.target, camera.position);
  camera.lookAt(controls.target); camera.updateMatrixWorld();
}
function digFocus(p) { DIGCAM.wx = p.x; DIGCAM.wy = p.y + 1.5; DIGCAM.wd = Math.min(DIGCAM.wd, 26); }
const digCamOn = () => VIEW.mode === 'mine' && !VIEW.tween && !BUILD.on && !(SKY && SKY.on) && !GAME.talk;
function digPan(dx, dy) { const s = 2 * DIGCAM.d * camT() / innerHeight; DIGCAM.wx -= dx * s; DIGCAM.wy += dy * s; }
function digZoom(k, sx = innerWidth / 2, sy = innerHeight / 2) {
  const C = DIGCAM, t = camT(), a = innerWidth / innerHeight, nx = sx / innerWidth * 2 - 1, ny = -(sy / innerHeight) * 2 + 1;
  const d0 = C.wd; C.wd = clamp(C.wd * k, 8, digMaxDist()); const f = 1 - C.wd / d0;
  C.wx += nx * d0 * t * a * f; C.wy += ny * d0 * t * f;
}
canvas.addEventListener('pointerdown', e => {
  if (!digCamOn() || (e.pointerType === 'mouse' && e.button !== 0)) return;
  DIGCAM.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); DIGCAM.pinch = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
});
canvas.addEventListener('pointermove', e => {
  const p = DIGCAM.ptrs.get(e.pointerId); if (!p || !digCamOn()) return;
  if (DIGCAM.ptrs.size === 1) { digPan(e.clientX - p.x, e.clientY - p.y); FOLLOW.v = null; }
  else {
    const [a, b] = [...DIGCAM.ptrs.values()], before = Math.hypot(a.x - b.x, a.y - b.y), mx0 = (a.x + b.x) / 2, my0 = (a.y + b.y) / 2;
    p.x = e.clientX; p.y = e.clientY;
    const [c, d] = [...DIGCAM.ptrs.values()], after = Math.hypot(c.x - d.x, c.y - d.y), mx = (c.x + d.x) / 2, my = (c.y + d.y) / 2;
    if (before > 10 && after > 10) digZoom(before / after, mx, my);
    digPan(mx - mx0, my - my0); return;
  }
  p.x = e.clientX; p.y = e.clientY;
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { DIGCAM.ptrs.delete(e.pointerId); });
canvas.addEventListener('wheel', e => { if (!digCamOn()) return; e.preventDefault(); digZoom(Math.exp(clamp(e.deltaY, -120, 120) * 0.0016 * camK()), e.clientX, e.clientY); }, { passive: false });   // camera speed: Settings
addEventListener('keydown', e => {
  if (!digCamOn() || e.target.closest && e.target.closest('input,textarea')) return;
  const s = DIGCAM.d * 0.06 * camK(), k = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s], a: [-s, 0], d: [s, 0], w: [0, s], s: [0, -s] }[e.key];
  if (k) { DIGCAM.wx += k[0]; DIGCAM.wy += k[1]; }
  if (e.key === '+' || e.key === '=') digZoom(0.85); if (e.key === '-') digZoom(1.18);
});

// ----------------------------------------------------------------- tapping the dig
// rooms, digs, empty cells you can dig, and the shaft; in the town view only what's nearer than the buildings
function pickDig(x, y, maxDist = Infinity) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(DLOOK.hits, false)[0];
  if (!h || h.distance > maxDist) return false;
  const u = h.object.userData;
  if (u.shaft) { selectBuilding(TOWN.b.head); return true; }
  if (u.cell && VIEW.mode !== 'mine') return false;
  const ref = u.cell ? { cell: true, r: u.r, c: u.c, id: `c:${u.r}.${u.c}` } : DIG.byId[u.id];
  if (!ref) return false;
  SEL.building = ref; SEL.villager = null; FOLLOW.v = null; DIG.sel = ref;
  UI.open('dig', ref); AUDIO.play('tap');   // UI.open brings the room clear of the panel (digShowRoom)
  return true;
}
// bring a room clear of the panel: on a phone held upright, up above it; on a wide screen, if it's under the panel on the
// right, slide the dig left until the room is in the middle of the rest (as dockView does for the ship, keepFocus for the Keep)
function digShowRoom(ref) {
  if (VIEW.mode !== 'mine' || !ref) return;
  const c = ref.cell || ref.isDig ? ref.c : ref.c0, w = ref.cell || ref.isDig ? 1 : ref.w, r = ref.r;
  if (c == null || r == null) return;
  const cx = MINE.colX0(c) + w * MINE.cw / 2, cy = (rowY0(r) + rowY1(r)) / 2;
  if (innerHeight > innerWidth) { DIGCAM.wx = cx; DIGCAM.wd = Math.min(DIGCAM.wd, 34); DIGCAM.wy = cy - DIGCAM.wd * camT() * 0.42; return; }
  if (innerWidth < 900) return;
  const el = $('#panel'), left = el && !el.hidden ? el.getBoundingClientRect().left : innerWidth - 400;
  const hw = DIGCAM.wd * camT() * innerWidth / innerHeight, edge = (left - 20) / innerWidth * 2 - 1;
  if ((cx + w * MINE.cw / 2 - DIGCAM.wx) / hw > edge || (cx - w * MINE.cw / 2 - DIGCAM.wx) / hw < -1) DIGCAM.wx = cx - ((left / 2) / innerWidth * 2 - 1) * hw;
  DIGCAM.wy = clamp(DIGCAM.wy, cy - DIGCAM.wd * camT() * 0.6, cy + DIGCAM.wd * camT() * 0.6);
}

// ----------------------------------------------------------------- panels
UI.dig = function (body, ref) {
  if (ref.cell) return digCellPanel.call(this, body, ref);
  if (ref.isDig) return digSitePanel.call(this, body, ref);
  if (!DIG.byId[ref.id]) { const id = digResolve(ref.id); if (id) { this.cur.ref = DIG.byId[id]; return this.dig(body, DIG.byId[id]); } body.append(this.h('<p>Gone.</p>')); return; }
  const R = ref, K = ROOMK[R.kind], t = tierOf(R.r), lv = R.lv, max = R.def.max, wide = ['', 'One room', 'Two wide', 'Three wide'][R.w];
  const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
  body.append(this.h(`<h2>${esc(K.name)}<span class="lvl" aria-label="Level ${lv} of ${max}">${pips}</span></h2>
    <p class="sub">${R.kind === 'seam' ? 'The bottom of the shaft' : `${wide} · row ${R.r + 1} of ${MINE.rows}`} · ${esc(DIG_TIERS[t].name)}, ${esc(DIG_TIERS[t].rock)}</p>
    <p class="sub">${esc(K.levels[lv - 1] || '')}</p><p>${esc(K.blurb)}</p>`));
  // what it's doing, and what's helping or hurting it
  const chips = [], pct = k => `${k >= 1 ? '+' : '−'}${Math.round(Math.abs(k - 1) * 100)}%`;
  if (R.kind === 'face' || R.kind === 'seam') chips.push(`<span class="chip amber">${(R.out * 60).toFixed(1)} ore a minute</span>`);
  if (R.kind === 'grotto') chips.push(`<span class="chip amber">${(R.out * 60).toFixed(2)} shards a minute</span>`);
  if (R.w > 1) chips.push(`<span class="chip good">${R.w} side by side: ${pct(DIGR.size[R.w])} each</span>`);
  if (R.boost > 1) chips.push(`<span class="chip good">Lamp Room next door: ${pct(R.boost)}</span>`);
  if (R.kind === 'face' || R.kind === 'seam') { const h = digHaul(R); if (Math.abs(h - 1) > 0.005) chips.push(`<span class="chip ${h >= 1 ? 'good' : 'warn'}">${h >= 1 ? 'Carts' : 'Pushing barrows to the lift'}: ${pct(h)}</span>`); }
  if (R.kind === 'pump') chips.push(`<span class="chip">${working(R) ? `Keeping ${lv >= 3 ? 'every row' : lv + 1 + ' rows'} below dry` : 'Needs a crew to keep anything dry'}</span>`);
  if (R.kind === 'shore') chips.push(`<span class="chip">${working(R) ? `Cave-ins ${Math.round((0.45 + 0.15 * lv) * 100)}% less likely nearby` : 'Unstaffed: cave-ins 20% less likely nearby'}</span>`);
  if (R.kind === 'depot') chips.push(`<span class="chip">Every face ${pct(1 + DIG.depotBoost)}, far ones more</span>`);
  if (R.kind === 'assay') chips.push(`<span class="chip">Finds ×${DIG.assayK.toFixed(2)}${DIG.assayLuck ? `, +${DIG.assayLuck} luck` : ''}</span>`);
  if (R.kind === 'lamp') chips.push(`<span class="chip">Gas ${Math.round((1 - DIG.gasK) * 100)}% rarer everywhere</span>`);
  if (t >= 1) chips.push(`<span class="chip ${R.dry ? 'good' : 'warn'}">${R.dry ? 'Kept dry by a Pump Room' : 'No pump above: it can flood'}</span>`);
  if (R.shoreK < 1) chips.push(`<span class="chip good">Shored: cave-ins ${Math.round((1 - R.shoreK) * 100)}% less likely</span>`);
  body.append(this.h(`<div class="stats-row">${chips.join('')}</div>`));
  if (R.inc) {
    const I = R.inc, k = I.kind === 'cave' ? I.k : I.kind === 'flood' ? 1 - I.water / 0.8 : I.kind === 'gas' ? 1 - I.g : 1 - I.list.filter(f => !f.dead).length / Math.max(1, I.list.length);
    body.append(this.h(`<div class="power alarm"><b>${esc(INC[I.kind].name)}.</b> ${esc(INC[I.kind].text)}<div class="hp" role="meter" aria-label="Dealt with" aria-valuenow="${Math.round(k * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(3, k * 100)}%"></i></div></div>`));
  }
  this.crew(body, R);
  if (!K.fixed && lv < 3) {
    const cost = digUpCost(R), can = GAME.shards >= cost;
    const u = this.h(`<div class="upgrade"><p><b>Level ${lv + 1}:</b> ${esc(K.levels[lv])}. Works ${Math.round((DIGR.lvl[lv + 1] / DIGR.lvl[lv] - 1) * 100)}% better.</p><button type="button" class="btn primary" ${can ? '' : 'disabled'}>Upgrade · <span class="cost">${SHARD} ${cost}</span></button>${can ? '' : `<p class="small why">Needs ${esc(shortOf({ shards: cost }))}.</p>`}</div>`);
    u.querySelector('button').onclick = () => digUpgrade(R);
    body.append(u);
  } else if (!K.fixed) body.append(this.h(`<p class="small" style="margin-top:12px">Fully fitted out.</p>`));
  if (!K.fixed && R.w < 3) body.append(this.h(`<p class="small" style="margin-top:8px">Dig another ${esc(K.name)} of the same level next to it to make one bigger room: two side by side work 10% better each, three 25%.</p>`));
};
// the crew slots, as on a building
UI.crew = function (body, b) {
  const def = b.def, n = slotsOf(b), ws = workersOf(b.id), st = def.job.stat2 ? `${STAT_NAMES[def.job.stat]} and ${STAT_NAMES[def.job.stat2]}` : STAT_NAMES[def.job.stat];
  body.append(this.h(`<h3>${esc(jobsOf(def.job.title))} · ${ws.length} of ${n} · best stat ${esc(st)}</h3>`));
  const box = document.createElement('div'); box.className = 'workers';
  for (let i = 0; i < n; i++) {
    const v = ws.find(w => w.d.job.slot === i), el = document.createElement('button'); el.type = 'button';
    if (v) { el.className = 'wslot'; el.append(miniSprite(v)); el.append(this.h(`<b>${esc(v.d.name.split(' ')[0])}</b><span>${SHORT_STAT[def.job.stat]} ${statOf(v, def.job.stat)}</span>`)); el.onclick = () => { SEL.villager = v; UI.open('villager', v); }; el.setAttribute('aria-label', `${v.d.name}, open`); }
    else { el.className = 'wslot empty'; el.append(this.h(`<span>+</span>Add`)); el.onclick = () => UI.open('pick', b); el.setAttribute('aria-label', `Add ${aJob(def.job.title)}`); }
    box.append(el);
  }
  body.append(box);
};
function digCellPanel(body, ref) {
  const { r, c } = ref, t = tierOf(r), why = digWhyNot(r, c);
  body.append(this.h(`<h2>Solid rock</h2><p class="sub">Row ${r + 1} of ${MINE.rows} · ${esc(DIG_TIERS[t].name)}, ${esc(DIG_TIERS[t].rock)}</p>`));
  if (why) { body.append(this.h(`<p>${esc(why)}</p>`)); return; }
  body.append(this.h(`<p>Choose a room to dig here. A crew digs it out; deeper rock costs more and takes longer. The same kind next to one you have joins it as a bigger room.</p>`));
  const list = document.createElement('div'); list.className = 'list';
  for (const kind of DIG_ORDER) {
    const K = ROOMK[kind], cost = digCost(r, kind), no = digKindWhyNot(r, kind), poor = GAME.shards < cost;
    const N = [roomAt(r, c - 1), roomAt(r, c + 1)].find(R => R && R.kind === kind && R.lv === 1 && R.w < 3);
    const el = document.createElement('button'); el.type = 'button'; el.className = 'li dk'; el.style.gridTemplateColumns = '40px 1fr auto';
    if (no || poor) { el.disabled = true; el.classList.add('off'); }   // dimmed, but the reason stays readable (style.css)
    el.append(digKindIcon(kind));
    el.append(this.h(`<span><span class="nm">${esc(K.name)}</span><span class="jb">${no ? `<span class="why">${esc(no)}</span>` : esc(K.short)}${N ? ' · joins the one next door' : ''}${!no && poor ? ` · <span class="why">Needs ${esc(shortOf({ shards: cost }))}.</span>` : ''}</span></span><span class="fit">${SHARD} ${cost}</span>`));
    el.onclick = () => { if (no || poor) return; const d = digOrder(r, c, kind); if (d) { DIG.sel = d; UI.open('dig', d); } };
    list.append(el);
  }
  body.append(list);
  body.append(this.h(`<p class="small" style="margin-top:8px">About ${fmtReal(digWork(r) / 1.4)} to dig with two good diggers.</p>`));
}
function digSitePanel(body, d) {
  if (!DIG.byId[d.id]) { const R = roomAt(d.r, d.c); if (R) { this.cur.ref = R; return this.dig(body, R); } body.append(this.h('<p>Gone.</p>')); return; }
  const K = ROOMK[d.kind], k = clamp(d.done / d.work, 0, 1);
  let rate = 0; for (const v of workersOf(d.id)) if (v.working) rate += statOf(v, 'G') / 10;
  body.append(this.h(`<h2>Digging: ${esc(K.name)}</h2><p class="sub">Row ${d.r + 1} · ${rate ? `about ${fmtReal((d.work - d.done) / rate)} to go` : workersOf(d.id).length ? 'the crew are on their way' : 'nobody is digging'}</p>
    <div class="hp" role="meter" aria-label="Dug" aria-valuenow="${Math.round(k * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(2, k * 100)}%"></i></div>
    <p>${esc(K.blurb)}</p>`));
  this.crew(body, d);
  body.append(this.h(`<p class="small">Anyone can dig; Grit digs fastest. When it’s done the diggers go back to their own work.</p>`));
  if (!workersOf(d.id).length) { const a = this.h(`<div class="stats-row"><button type="button" class="btn primary">Find diggers</button></div>`); a.querySelector('button').onclick = () => { if (!digAutoCrew(d)) toast('Nobody can be spared. Tap + to pick someone.'); UI.refresh(); }; body.append(a); }
  const x = this.h(`<div class="stats-row" style="margin-top:10px"><button type="button" class="btn">Stop digging · half the shards back</button></div>`);
  x.querySelector('button').onclick = () => { digCancel(d); UI.close(); };
  body.append(x);
}
// the headframe's panel: what the lift and the dig are doing
function digHeadChips(b) {
  const lv = b.level, n = DIG.rooms.length, below = DIG.oreBelow + CAGE.ore;
  return [`<span class="chip amber">${(DIG.rate * 60).toFixed(1)} ore a minute</span>`, `<span class="chip">${n} room${n === 1 ? '' : 's'} dug</span>`,
    `<span class="chip">Dig down to row ${digReach() + 1} of ${MINE.rows}</span>`, `<span class="chip ${lv >= 2 ? 'warn' : ''}">${lv >= 2 ? 'Deep seam open' : 'Deep seam sealed'}</span>`,
    below >= 1 ? `<span class="chip">${Math.round(below)} ore on its way up</span>` : ''].join('');
}
// a little picture for each kind of room, for the dig list
const DIG_ICON = {
  face: '<path d="M6 34 30 10" stroke="#8a5a34" stroke-width="3"/><path d="M22 6c6 0 12 4 14 10-5-3-10-4-14-4z" fill="#b9c0c8" stroke="#2a1b2f" stroke-width="1.5"/><path d="M28 36l5-8 7 2 3 7z" fill="#8a7a6c" stroke="#2a1b2f" stroke-width="1.5"/><path d="M34 32l3-2 1 4z" fill="#ffb347"/>',
  grotto: '<path d="M14 38l4-18 4 18zM22 38l5-26 5 26zM31 38l3-14 3 14z" fill="#ffb347" stroke="#5a2a10" stroke-width="1.5"/><path d="M8 38h34" stroke="#2a1b2f" stroke-width="2"/>',
  pump: '<rect x="18" y="16" width="10" height="20" fill="#7d8590" stroke="#2a1b2f" stroke-width="1.5"/><path d="M23 16V8l12-3" stroke="#5a3a26" stroke-width="2.5" fill="none"/><path d="M28 24h8v6" stroke="#7d8590" stroke-width="3" fill="none"/><path d="M36 32c2 2 2 4 0 5-2-1-2-3 0-5z" fill="#6fb6d0"/>',
  shore: '<g fill="#c99a6a" stroke="#5a3a26" stroke-width="1.5"><circle cx="15" cy="32" r="5"/><circle cx="26" cy="32" r="5"/><circle cx="37" cy="32" r="5"/><circle cx="20.5" cy="23" r="5"/><circle cx="31.5" cy="23" r="5"/><circle cx="26" cy="14" r="5"/></g>',
  depot: '<rect x="12" y="16" width="22" height="13" fill="#7d8590" stroke="#2a1b2f" stroke-width="1.5"/><circle cx="17" cy="32" r="3" fill="#2a1b2f"/><circle cx="29" cy="32" r="3" fill="#2a1b2f"/><path d="M6 36h34" stroke="#5a3a26" stroke-width="2"/><path d="M15 16l3-4 4 2 4-3 4 5z" fill="#8a7a6c"/>',
  assay: '<path d="M24 8v24M12 14h24" stroke="#c99a3c" stroke-width="2"/><path d="M8 22l4-8 4 8zM32 22l4-8 4 8z" fill="#e6c26a" stroke="#5a3a10" stroke-width="1.2"/><rect x="18" y="32" width="12" height="4" fill="#8a5a34"/>',
  seam: '<path d="M6 30l8-6 5 4 7-9 6 5 10-8" fill="none" stroke="#ffb347" stroke-width="3" stroke-linejoin="round"/><path d="M6 30l8-6 5 4 7-9 6 5 10-8" fill="none" stroke="#fff0c4" stroke-width="1" stroke-linejoin="round"/><path d="M10 36l3-6 3 6zM30 38l4-8 4 8z" fill="#9a8aff"/>',
  lamp: '<path d="M24 6v6" stroke="#2a1b2f" stroke-width="2"/><rect x="17" y="12" width="14" height="4" fill="#c99a3c" stroke="#2a1b2f" stroke-width="1.2"/><rect x="18" y="16" width="12" height="14" fill="#ffd27a" stroke="#2a1b2f" stroke-width="1.5"/><rect x="16" y="30" width="16" height="4" fill="#c99a3c" stroke="#2a1b2f" stroke-width="1.2"/>',
};
function digKindIcon(kind) { const s = document.createElement('span'); s.className = 'dkico'; s.innerHTML = `<svg viewBox="0 0 48 44" width="36" height="33" aria-hidden="true">${DIG_ICON[kind] || ''}</svg>`; return s; }

// ----------------------------------------------------------------- labels over the dig (the Mine view)
function digLabels() {
  const out = [], close = DIGCAM.d < 44, Z = WORLD.faceZ + 0.2;
  for (const R of DIG.rooms) {
    const x = (cellX0(R.c0) + cellX1(R.c0 + R.w - 1)) / 2, y = rowY1(R.r) - 0.1;
    if (R.inc) out.push({ key: 'dinc' + R.id, html: `${esc(INC[R.inc.kind].tag)}`, pos: new THREE.Vector3(x, y, Z), cls: 'alarm' });
    else if (close) out.push({ key: 'droom' + R.id, html: `${esc(DIGCAM.d < 30 || R.w > 1 ? ROOMK[R.kind].name : ROOMK[R.kind].tag)}<small>${workersOf(R.id).length}/${R.slots()}</small>`, pos: new THREE.Vector3(x, y, Z), cls: 'room' });
  }
  for (const d of DIG.digs) out.push({ key: 'ddig' + d.id, html: `Digging<small>${Math.floor(clamp(d.done / d.work, 0, 0.99) * 100)}%</small>`, pos: new THREE.Vector3((cellX0(d.c) + cellX1(d.c)) / 2, rowY1(d.r) - 0.1, Z), cls: 'build' });
  if (headLv() < 3 && close) out.push({ key: 'dreach', html: 'Raise the Headframe to dig deeper', pos: new THREE.Vector3((MINE.x0 + MINE.shaft.x0) / 2 + 6, rowY0(digReach()) - 0.35, Z), cls: 'plot' });
  for (const f of DIG.floats) out.push({ key: 'dfl' + f.id, html: f.html, pos: f.pos.clone().setY(f.pos.y + f.t * 1.2), cls: 'build' });
  return out;
}

// ----------------------------------------------------------------- every frame
let _floatId = 0;
function digFrameUpdate(rdt, gdt) {
  for (const f of DIG.floats) { if (!f.id) f.id = ++_floatId; f.t += rdt; }
  DIG.floats = DIG.floats.filter(f => f.t < 1.6);
  digLookUpdate(rdt, gdt);
  // the room panel ticks along while it's open, brought up to date in place (UI.render in ui.js)
  if (UI.cur && UI.cur.kind === 'dig') { DIG.panelT = (DIG.panelT || 0) + rdt; if (DIG.panelT > 1.5) { DIG.panelT = 0; UI.refresh(); } }
}
