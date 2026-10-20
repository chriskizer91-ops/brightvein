// ===================================================================== THE WILDS: expeditions down the cliff (Fallout Shelter style)
// Kit someone out, pack rations, send them down the rope stair in the cut face. The longer they stay out,
// the farther they get: richer finds and worse company. Recall them whenever you like; the walk home takes
// half as long as they've been gone. If they're beaten, they turn back on their own and drop half the haul.
const HOUR = DAY_LEN / 24;
const WILDS = {
  every: [15, 26],           // game seconds between events (an hour is 10 s)
  ration: 3,                 // food per ration
  zones: [
    { name: 'The scree below the rim', from: 0, danger: 0.2, luck: 0, ilvl: 1, mult: 1, foes: ['glimmer'],
      text: 'Loose rock, thin wind, and the plateau overhead like a roof.' },
    { name: 'The gorse moors', from: HOUR * 12, danger: 0.32, luck: 0.6, ilvl: 3, mult: 1.6, foes: ['glimmer', 'glimmer', 'flarehound'],
      text: 'Gold gorse to the horizon, humming with wild bees.' },
    { name: 'The old ruins', from: HOUR * 36, danger: 0.44, luck: 1.3, ilvl: 6, mult: 2.4, foes: ['flarehound', 'jumper', 'glimmer'],
      text: 'Halls and hearths from before the claims, roofless now.' },
    { name: 'The wreck fields under the Thinning', from: HOUR * 72, danger: 0.56, luck: 2.2, ilvl: 10, mult: 3.4, foes: ['flarehound', 'enforcer', 'lodestar'],
      text: 'Where ships that climbed too high came down.' },
  ],
};
const FOE_W = { glimmer: { hp: 18, dps: 3.0, t: 'A Glimmer came sniffing for light' }, flarehound: { hp: 40, dps: 5, t: 'A Flarehound broke out of the gorse' },
  lodestar: { hp: 80, dps: 7, t: 'A Lodestar, something glowing in its chest' }, jumper: { hp: 30, dps: 4.5, t: 'A claim-jumper with a rifle and no claim of their own' },
  enforcer: { hp: 60, dps: 7.5, t: 'A jumper enforcer in plate, with a steam hammer' } };
const WT = {
  ore: ['Chipped raw sunstone out of a fallen boulder', 'Followed a glint down a gully and dug out a pocket of ore', 'Found an old prospector’s cache under a cairn, still full', 'Pried a seam of crystal out of a split rock'],
  forage: ['Picked wild thyme and sorrel by a spring', 'Smoked out a gorse-bee nest and took the comb', 'Dug wild leeks along a stream', 'Found a hedge heavy with bramble fruit'],
  charged: ['Found an outcrop charged by a thousand days of sun', 'Climbed to a ledge where loose shards had lain in the light for years'],
  salvage: [['A courier’s crate that fell from a passing ship', 'A snapped survey tripod with its brass fittings intact'], ['A burnt-out claim shack, picked over but not clean', 'An abandoned ore cart in the heather'],
    ['Brass fittings from an old gatehouse', 'A collapsed lens house from before the claim era'], ['The engine room of a wrecked airship', 'A crystal-sail spar, still warm']],
  find: [['Something half-buried in the scree', 'A pack left on a ledge, its owner long gone'], ['A cache under a gorse root', 'A shepherd’s lockbox, unlocked'],
    ['A niche behind a fallen hearthstone', 'An old armoury, mostly rust'], ['A captain’s locker in a broken hull', 'A crate thrown clear of a wreck']],
  trader: ['Met a gnome tinker on the road', 'Shared a fire with a courier crew', 'Traded news with a shepherd from the low valleys', 'Fell in with a lens-pedlar heading for the coast'],
  rest: ['Camped under a leaning cairn. Nothing stirred.', 'Slept in a dry gully while the wind kept watch.', 'Waited out a squall under an overhang.', 'Mended boots by a small fire.'],
  lore: [['Watched the Lark’s shadow cross the cloud below.', 'Found boot prints going down. None coming back.'],
    ['The gorse here grows in rings around old lamp posts. Nobody knows who lit them.', 'A stone marker: a claim number, and a name scratched out.'],
    ['A carved hearth in a roofless hall. The stone is warm to the touch.', 'Old-age banners, too faded to read, still hanging.'],
    ['A brass figurehead in the heather, wings half open.', 'Up here the air goes thin, and the crystals stop singing.']],
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pickOne = a => a[Math.random() * a.length | 0];
const fmtSpan = s => { const h = Math.floor(s / HOUR), d = Math.floor(h / 24); return d ? `${d}d ${h % 24}h` : `${h}h`; };
const zoneAt = out => { let z = 0; WILDS.zones.forEach((Z, i) => { if (out >= Z.from) z = i; }); return z; };
const TRAIL_TOP = () => new THREE.Vector3(LAYOUT.trail.x, 0, LAYOUT.trail.z);
const TRAIL_EDGE = () => new THREE.Vector3(LAYOUT.trail.x, 0, WORLD.faceZ - 0.25);
const TRAIL_FOOT = () => new THREE.Vector3(LAYOUT.trail.x, -12, WORLD.faceZ + 0.4);
const expOut = () => GAME.villagers.filter(v => v.d.exp);
const expLimit = () => EXP_LIMIT[(TOWN.b.keep && TOWN.b.keep.level) || 1];
function sendExpedition(v, rations, orders = { far: 1, turnAt: 0.5 }) {
  const food = rations * WILDS.ration;
  if (GAME.food < food || v.d.exp || expOut().length >= expLimit()) return false;
  GAME.food -= food; v.d.study = null;
  const b = v.jobB; if (b) v.d.pref = b === WALLB ? 'wall' : b.type;
  v.d.job = null; v.redraw();
  const max = maxHpOf(v);
  v.d.exp = { state: 'leaving', out: 0, ret: 0, hp: max, maxHp: max, rations, nextEvt: rnd(6, 12), zone: 0, seen: 0, log: [], haul: { ore: 0, shards: 0, food: 0, items: [], mats: {}, recruits: 0 }, far: orders.far, turnAt: orders.turnAt };
  logExp(v, `Set off down the rope stair with ${rations ? rations + ' ration' + (rations > 1 ? 's' : '') : 'no rations'}. Orders: go as far as ${WILDS.zones[orders.far].name.replace(/^The /, 'the ')}${orders.turnAt ? `, turn back below ${Math.round(orders.turnAt * 100)}% health` : ', and keep going whatever happens'}.`);
  v.plan = leavePlan(v); v.replan = false;
  if (FOLLOW.v === v) FOLLOW.v = null;
  AUDIO.play('open');
  return true;
}
function leavePlan(v) {
  return [...exitSteps(v), walkTo(v, TRAIL_TOP()), { type: 'line', to: TRAIL_EDGE() },
    { type: 'climb', to: TRAIL_FOOT(), then: () => { v.where = 'wilds'; v.setHidden(true); if (v.d.exp) v.d.exp.state = 'out'; } }, { type: 'away' }];
}
function arrivePlan(v) {
  return [{ type: 'climb', to: TRAIL_EDGE() }, { type: 'line', to: TRAIL_TOP(), then: () => { v.where = 'surface'; deliverHaul(v); } }];
}
function recallExpedition(v, why) {
  const E = v.d.exp; if (!E || E.state !== 'out') return;
  E.state = 'back'; E.ret = Math.max(HOUR * 2, E.out * 0.5);
  logExp(v, `${why || 'Turned for home.'} About ${fmtSpan(E.ret)} away.`);
}
function logExp(v, text, kind = 'note', extra = {}) { const E = v.d.exp; E.log.unshift({ t: E.out, text, kind, ...extra }); if (E.log.length > 80) E.log.length = 80; }
function updateExpeditions(dt) {
  for (const v of GAME.villagers) {
    const E = v.d.exp; if (!E) continue;
    if (E.state === 'out') {
      E.out += dt; E.zone = Math.min(zoneAt(E.out), E.far ?? 3);
      if (E.turnAt && E.hp < E.maxHp * E.turnAt) { recallExpedition(v, 'Hurt, and turned for home as ordered.'); continue; }
      // a day at the farthest place they were sent, then home: the wreck fields too
      const far = clamp(E.far ?? 3, 0, WILDS.zones.length - 1);
      if (E.out >= WILDS.zones[far].from + HOUR * 24) { recallExpedition(v, 'Went as far as you said, and turned for home.'); continue; }
      if (E.zone > E.seen) { E.seen = E.zone; const Z = WILDS.zones[E.zone]; logExp(v, `Reached ${Z.name}. ${Z.text}`, 'zone'); if (UI.cur && UI.cur.kind === 'exp' && UI.cur.ref === v) UI.refresh(); }
      E.nextEvt -= dt;
      if (E.nextEvt <= 0) { E.nextEvt = rnd(...WILDS.every); wildsEvent(v, E); }
    } else if (E.state === 'back') {
      E.ret -= dt;
      if (E.ret <= 0) arrive(v);
    }
  }
}
function arrive(v) {
  const E = v.d.exp; E.state = 'arriving';
  v.place(...TRAIL_FOOT().toArray()); v.where = 'cliff'; v.setHidden(false);
  v.plan = arrivePlan(v);
}
function wildsEvent(v, E) {
  const Z = WILDS.zones[E.zone], g = gearOf(v), st = k => statOf(v, k), m = Z.mult, H = E.haul;
  const w = {
    fight: 1.8 * (1 + Z.danger * 2.2) * (1 - Math.min(0.6, g.stealth)),
    ore: 2.4 * (0.6 + st('G') / 14), forage: 2.0 * (0.6 + st('S') / 14), charged: 1.5 * (0.6 + st('A') / 14),
    salvage: 1.4 * (0.6 + st('E') / 14), find: 1.3 + Z.luck * 0.5, trader: 0.7 * (0.5 + st('R') / 10), rest: 1.0, lore: 0.8,
  };
  for (const [k, e] of [['G', 'ore'], ['S', 'forage'], ['E', 'salvage'], ['R', 'trader']]) if (mastered(v, k)) w[e] *= 1.4;
  let tot = 0; for (const k in w) tot += w[k]; let r = Math.random() * tot, kind = 'rest'; for (const k in w) { r -= w[k]; if (r < 0) { kind = k; break; } }
  const luck = Z.luck + g.findLuck + st('A') * 0.04;
  const item = (o = {}) => { const it = toGear(LOOT.makeGear({ luck, ilvl: Z.ilvl, from: Z.name, ...o }), Z.ilvl); H.items.push(it); return it; };
  const named = it => `<b style="color:${rarityOf(it).color}">${esc(it.name)}</b>`;
  if (kind === 'ore') { const n = Math.round((3 + st('G') * 0.6) * m * rnd(0.7, 1.3)); H.ore += n; logExp(v, `${pickOne(WT.ore)}. <b>+${n} ore</b>`, 'find'); }
  else if (kind === 'forage') { const n = Math.round((2 + st('S') * 0.5) * m * rnd(0.7, 1.3)); H.food += n; logExp(v, `${pickOne(WT.forage)}. <b>+${n} food</b>`, 'find'); }
  else if (kind === 'charged') { const n = Math.round((2 + st('A') * 0.4) * m * rnd(0.7, 1.3)); H.shards += n; logExp(v, `${pickOne(WT.charged)}. <b>+${n} shards</b>`, 'find'); }
  else if (kind === 'salvage') {
    const mat = E.zone >= 3 && Math.random() < 0.35 ? 'heartstone' : E.zone >= 2 && Math.random() < 0.5 ? 'glass' : 'brass', n = 1 + (Math.random() < st('E') / 14 ? 1 : 0);
    H.mats[mat] = (H.mats[mat] || 0) + n;
    let txt = `${pickOne(WT.salvage[E.zone])}. <b>+${n} ${D.MATERIALS[mat].name}</b>`;
    if (Math.random() < 0.25 + st('E') * 0.02) txt += `, and ${named(item())}`;
    logExp(v, txt + '.', 'find');
  }
  else if (kind === 'find') {
    let it;
    if (E.zone >= 3 && Math.random() < 0.05) { const mw = pickOne(Object.values(D.RELICS).filter(x => x.rarity === 'masterwork' && !/Gift/.test(x.source || '') && x.slot !== 'module' && x.slot !== 'lark')); it = LOOT.makeRelic(mw.id, Z.name); H.items.push(it); }
    else it = item();
    logExp(v, `${pickOne(WT.find[E.zone])}: ${named(it)}.`, 'find', { uid: it.uid });
  }
  else if (kind === 'trader') {
    if (Math.random() < 0.06 + st('R') * 0.012) { H.recruits++; logExp(v, `${pickOne(WT.trader)}. One of them asked to come back to the claim.`, 'find'); }
    else if (Math.random() < 0.35) { const it = item({ rarity: LOOT.rollRarity(luck + 0.5, { min: 'tooled' }) }); logExp(v, `${pickOne(WT.trader)} and swapped stories for ${named(it)}.`, 'find'); }
    else { const n = Math.round((2 + st('R') * 0.6) * m * rnd(0.7, 1.3)); H.shards += n; logExp(v, `${pickOne(WT.trader)}. Sold them news of the strike for <b>${n} shards</b>.`, 'find'); }
  }
  else if (kind === 'rest') { const heal = Math.round(E.maxHp * 0.08); E.hp = Math.min(E.maxHp, E.hp + heal); logExp(v, pickOne(WT.rest)); }
  else if (kind === 'lore') logExp(v, pickOne(WT.lore[E.zone]), 'lore');
  else if (kind === 'fight') {
    const foeId = pickOne(Z.foes), F = FOE_W[foeId], hp = F.hp * (1 + E.zone * 0.25), me = fightOf(v, foeId);
    const t = hp / Math.max(1, me.dps);
    let taken = F.dps * (1 + E.zone * 0.2) * t * (1 - Math.min(60, g.guard) / 100) * rnd(0.7, 1.3);
    if (me.ranged) taken *= 0.6;
    const dodged = Math.random() < st('A') * 0.025 * (mastered(v, 'A') ? 2 : 1); if (dodged) taken *= 0.5;
    taken = Math.round(taken);
    E.hp -= taken;
    const first = v.d.name.split(' ')[0], wpn = g.weapon ? ` with the ${esc(g.weapon.name)}` : '';
    if (E.hp <= 0) {
      E.hp = 0;
      // beaten: drop half of everything and limp home
      const lost = Math.floor(H.items.length / 2); for (let i = 0; i < lost; i++) H.items.splice(Math.random() * H.items.length | 0, 1);
      for (const k of ['ore', 'shards', 'food']) H[k] = Math.floor(H[k] / 2);
      for (const k in H.mats) H.mats[k] = Math.floor(H.mats[k] / 2);
      logExp(v, `${F.t}. It was too much. ${first} was beaten, dropped half the haul and turned for home.`, 'fight');
      E.state = 'back'; E.ret = Math.max(HOUR * 3, E.out * 0.5); E.beaten = true;
      toast(`<b>${esc(v.d.name)}</b> was beaten in the wilds and is limping home.`, 'night');
    } else {
      const drop = LOOT.foeDrops(foeId, { night: Z.ilvl, deep: E.zone >= 2 });
      H.shards += drop.shards || 0; for (const [k, n] of Object.entries(drop.materials || {})) H.mats[k] = (H.mats[k] || 0) + n;
      const got = drop.items.map(x => { const it = toGear(x, Z.ilvl); H.items.push(it); return named(it); });
      logExp(v, `${F.t}. ${first} brought it down${wpn}${dodged ? ', ducking the worst of it' : ''}. <b>−${taken} health</b>${got.length ? '. It dropped ' + got.join(' and ') : ''}.`, 'fight');
      if (E.hp < E.maxHp * 0.45 && E.rations > 0) { E.rations--; E.hp = Math.min(E.maxHp, E.hp + Math.round(E.maxHp * 0.35)); logExp(v, 'Stopped to eat a ration and bind the cuts.'); }
    }
  }
  if (UI.cur && (UI.cur.kind === 'exp' && UI.cur.ref === v || UI.cur.kind === 'roster')) UI.refresh();
}
function deliverHaul(v) {
  const E = v.d.exp; if (!E) return;
  const H = E.haul;
  GAME.ore += H.ore; GAME.shards += H.shards; GAME.food += H.food;
  for (const [k, n] of Object.entries(H.mats)) GAME.mats[k] = (GAME.mats[k] || 0) + n;
  for (const it of H.items) addToStash(it, true, { pos: TRAIL_TOP(), line: `${v.d.name.split(' ')[0]} brought it back from the wilds` });
  const bits = [];
  if (H.ore) bits.push(`${H.ore} ore`); if (H.shards) bits.push(`${H.shards} shards`); if (H.food) bits.push(`${H.food} food`);
  if (H.items.length) bits.push(`${H.items.length} find${H.items.length > 1 ? 's' : ''}`);
  toast(`<b>${esc(v.d.name)}</b> is back from the wilds${bits.length ? ' with ' + bits.join(', ') : ', empty-handed'}.`);
  for (let i = 0; i < H.recruits; i++) {
    if (bedsUsed() >= totalBeds()) { toast('A traveller came with them, but there was no bed in the Keep, so they went on.'); continue; }
    const d = makePerson(mulberry((Math.random() * 1e9) | 0)); const nv = addVillager(d, TRAIL_TOP());
    toast(`<b>${esc(d.name)}</b> came back with them, looking for work.`);
    void nv;
  }
  v.d.lastTrip = { span: fmtSpan(E.out), zone: WILDS.zones[E.seen].name, items: H.items.map(it => it.uid), ore: H.ore, shards: H.shards, food: H.food, beaten: !!E.beaten };
  v.d.exp = null;
  AUDIO.play('chime');
  autoAssign(); v.replan = true;
  UI.refresh();
}
