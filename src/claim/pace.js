// ===================================================================== PACE: when the story speaks, and when the claim is left alone
// The story waits for a quiet morning. A chapter opens and closes by day, never while Wildlight or jumpers are on the
// claim, and only once the dawn report has been read (storyTick in story.js). The nights a goal asks for are counted when
// they're over, at dawn (paceNightsSeen), so the story never talks over a night that's still coming. A day with a
// chapter turning or a Bright Night coming has no event card (events.js), and event days are about one in three.
// Chapter 12 brings a Bright Night of its own (storyNight in acttwo.js) instead of waiting for the fifth night, and the
// clock's panel and the journal say when the next one is.
// Also here: goals paid for from the journal (the filing fee, food for Hollowcrest's people), the people from
// Hollowcrest who come over in chapter 13 (as guests on bedrolls until a bunk is free), and what act two's chapters
// give besides shards (materials, gear, modules, Lark parts).
const PACE = {
  eventDays: 0.36,   // the chance a morning rolls a day event (some are then given up to a chapter or a Bright Night)
  roll: 0.08,        // names on the charter roll for each clerk's worth of work a second (chapter 9)
  afterEvent: 0.08,  // a chapter scene waits this long (in days) after a day event's card, so they don't come back to back
  richAt: 4000,      // from chapter 8: how much wealth over 1,500 makes the nights a step harder (paceThreat)
};

// nights seen out: the one under way doesn't count until its dawn
function paceNightsSeen() { return GAME.nights - (WL.night ? 1 : 0); }
// nothing on the claim to fight: no night under way, no Wildlight up anywhere, no jumpers overhead
function paceCalm() { return !WL.night && !jumpersActive() && !WL.list.some(f => !f.dead); }
// a quiet hour for the chapters' scenes: calm, by day (dusk and night wait for the morning), the dawn report read (or
// the morning well on), and not straight after a day event's card
function paceQuiet() {
  if (!paceCalm()) return false;
  const t = GAME.t; if (t >= 0.6 && t < 0.96) return false;
  if (EVT.firedAt != null && claimNow() - EVT.firedAt < PACE.afterEvent) return false;
  const dawn = document.getElementById('dawn');
  return !(dawn && !dawn.hidden) || (t >= 0.12 && t < 0.6);
}
// the day whose daylight this is: the last hour of a night already belongs to the morning after
const paceDayOf = () => GAME.day + (GAME.t >= 0.9 ? 1 : 0);
// does the story have today: a chapter opened or closed today, or one is waiting to (no day event then)
function paceStoryDay() {
  if (STORY.turnDay === paceDayOf()) return true;
  return !!CHAPTERS[STORY.ch] && (!STORY.started || STORY.ready);
}

// ---- Bright Nights: every fifth night, the night the deep seam first wakes, and the story's own (storyNight)
function paceBright(n) {
  if (WL.night && WL.night.n === n) return !!WL.night.bright;
  const deep = TOWN.b.head && TOWN.b.head.level >= 2;
  return n % 5 === 0 || (deep && !NIGHT.seamWoke && n === paceNightsSeen() + 1) || !!storyNight(n);
}
function paceNextBright() { const n0 = GAME.nights + (WL.night ? 0 : 1); for (let n = n0; n < n0 + 5; n++) if (paceBright(n)) return n; return Math.ceil(n0 / 5) * 5; }
// for a goal that wants a Bright Night's boss: when the next one is
function paceBrightNote() {
  const n0 = GAME.nights + (WL.night ? 0 : 1), b = paceNextBright(), k = b - n0;
  if (WL.night && WL.night.bright) return 'a Bright Night tonight';
  return k <= 0 ? 'a Bright Night tonight' : k === 1 ? 'next Bright Night: tomorrow night' : `next Bright Night in ${k} nights`;
}

// ---- goals paid for from the journal: the chapter's goals know their place, so a payment is kept with the claim
for (const C of CHAPTERS) C.goals.forEach((g, i) => { g.key = `${C.id}:${i}`; });
const storyPayReady = () => { const C = STORY.started && CHAPTERS[STORY.ch]; return !!C && !STORY.ready && C.goals.some(g => g.cost && !g.done() && canGive(g.cost)); };
function storyPay(i) {
  const C = STORY.started && CHAPTERS[STORY.ch], g = C && C.goals[i];
  if (!g || !g.cost || g.done() || STORY.ready || !canGive(g.cost)) return false;
  for (const [k, n] of Object.entries(g.cost)) { if (k === 'shards') GAME.shards -= n; else if (k === 'food') GAME.food -= n; else GAME.mats[k] -= n; }
  STORY.paid[g.key] = true;
  AUDIO.play('goal');
  if (g.log) daysLog(g.log, 'story');
  const sc = g.then ? g.then() : null;
  if (sc && sc.lines && !STORY.shown && !EVT.card) playScene({ lines: sc.lines, heading: C.title, after: sc.after });
  else if (sc) { if (sc.lines) STORY.queue.push({ lines: sc.lines, heading: C.title, after: sc.after }); else if (sc.after) sc.after(); }
  else toast(`<b>${esc(C.title)}:</b> ${esc(g.text.replace(/ \(.*\)$/, ''))} ✓`);
  journalHUD(); UI.refresh(); saveGame();
  return true;
}

// ---- Hollowcrest's people (chapter 13): up the bridge from the Sky Dock. With no bunk free they're the claim's guests,
// on bedrolls by the hall fire (isGuest in people.js), and each takes a bunk as soon as one comes free (paceTick).
function paceRefugees(n) {
  const D0 = LAYOUT.dock, names = [];
  for (let i = 0; i < n; i++) {
    const d = makePerson(mulberry((Math.random() * 1e9) | 0)); d.from = 'Hollowcrest';
    if (bedsUsed() >= totalBeds()) d.guest = true;
    const v = addVillager(d, new THREE.Vector3(D0.x - 8 + Math.random() * 3, 0, D0.z + 6 + Math.random() * 2)); v.replan = true; names.push(d.name.split(' ')[0]);
  }
  autoAssign();
  toast(`<b>${esc(andList(names))}</b> come up the bridge from Hollowcrest, soaked through${GAME.villagers.some(v => v.d.guest && !v.d.hero) ? '. Bedrolls by the hall fire until a bunk comes free' : ''}.`);
  daysLog(`Hollowcrest’s people came over the bridge: ${andList(names)}.`, 'story');
}
// once a second of game time (lifeTick): a guest from Hollowcrest takes a bunk that has come free
function paceTick() {
  if (bedsUsed() >= totalBeds()) return;
  const v = GAME.villagers.find(x => x.d.guest && !x.d.hero); if (!v) return;
  v.d.guest = false; toast(`<b>${esc(v.d.name)}</b> rolls up the bedroll by the fire and takes a bunk in the Keep.`);
}

// ---- what a chapter gives besides shards: materials, a piece of gear, a module or a Lark part (act two). Returns the
// lines for the chapter's toast.
function paceReward(R) {
  const got = [], ilvl = Math.max(8, Math.round(Math.max(1, GAME.nights) * 0.8)), from = R.from || 'the story';
  for (const [k, n] of Object.entries(R.mats || {})) { GAME.mats[k] = (GAME.mats[k] || 0) + n; got.push(`${n} ${esc(D.MATERIALS[k] ? D.MATERIALS[k].name : k)}`); }
  const add = it => { if (!it) return; addToStash(it, true, { line: `A gift from ${from}` }); got.push(`<b style="color:${rarityOf(it).color}">${esc(it.name)}</b>`); };
  if (R.gear) add(LOOT.makeGear({ ...R.gear, ilvl, from }));
  if (R.module) add(LOOT.makeModule({ ...R.module, ilvl, from }));
  if (R.lark) add(LOOT.makeModule({ ...R.lark, lark: true, ilvl, from }));
  return got;
}

// ---- how hard a night comes (planNight in nights.js): from chapter 8 the nights grow with what the claim has to lose
// (its stores, its ore and what it has built) and with how many nights it has stood. Before then nothing changes, so
// the first nights stay gentle. add: more Wildlight; hpK: tougher ones; brightK: how much of a Bright Night's budget is
// Wildlight besides its boss; bossK: a tougher boss; cap: the most that climb in one night; drinkK: how deep they drink
// from the yards and the stores (a rich claim that leaves its lights unguarded loses more).
function paceWealth() {
  let v = GAME.shards + GAME.ore / 10;
  for (const b of Object.values(TOWN.b)) if (!b.pending && b.level) v += (BUY[b.type] || 80) * b.level * 0.5;
  return v;
}
function paceThreat(n) {
  if (STORY.ch < 8) return { rich: 0, age: 0, add: 0, hpK: 1, brightK: 0.5, bossK: 1, cap: 34, drinkK: 1 };
  const rich = clamp((paceWealth() - 1500) / PACE.richAt, 0, 2), age = clamp((n - 8) / 16, 0, 1.25);
  return { rich, age, add: rich * (2 + n * 0.2) + age * 4, hpK: 1 + 0.12 * rich + 0.2 * age, brightK: 0.5 + 0.15 * Math.min(1, rich + age),
    bossK: 1 + 0.15 * rich + 0.25 * age, cap: 34 + Math.round(6 * Math.min(1, rich)), drinkK: 1 + 1.5 * rich };
}

// ---- the sun beacon, fed raw ore (the Keep at level 3): for a night it burns over the whole plateau, and every
// Wildlight on it takes a quarter more harm (wlHarmK in acttwo.js). The miners' spare ore goes into it, and some shards.
// Light it from the Keep's panel for tonight, or keep it lit every night it can be paid for (at dusk).
function beaconCost(n = paceNightsSeen() + 1) { return { ore: 120 + 10 * n, shards: 40 + 4 * n }; }
const beaconLit = () => !!ACT.beacon && ACT.beacon.night === (WL.night ? WL.night.n : -1);
const beaconReady = () => TOWN.b.keep && TOWN.b.keep.level >= 3 && !TOWN.b.keep.building;
function beaconLight(quiet = false) {
  const n = WL.night ? WL.night.n : paceNightsSeen() + 1, c = beaconCost(n), B = ACT.beacon || (ACT.beacon = { auto: false, night: -1 });
  if (!beaconReady() || B.night === n || GAME.ore < c.ore || GAME.shards < c.shards) return false;
  GAME.ore -= c.ore; GAME.shards -= c.shards; B.night = n;
  moodAdd('beacon', 3, 1, 'The sun beacon burns all night');
  if (!quiet) { toast(`<b>The sun beacon</b> will burn all night: Wildlight on the plateau take a quarter more harm. ${c.ore} ore, ${SHARD} ${c.shards}.`); AUDIO.play('chime'); }
  UI.refresh();
  return true;
}
// at dusk (nightDusk): a beacon kept lit every night is fed, if the stores allow
function beaconDusk() { const B = ACT.beacon; if (B && B.auto && beaconReady() && B.night !== paceNightsSeen() + 1) beaconLight(true); }
// in the Keep's panel, under what quests.js puts there
const _paceBuilding = UI.building;
UI.building = function (body, b) {
  const r = _paceBuilding.call(this, body, b);
  if (b && b.type === 'keep' && beaconReady()) {
    const n = WL.night ? WL.night.n : paceNightsSeen() + 1, c = beaconCost(n), B = ACT.beacon || { auto: false, night: -1 }, lit = B.night === n, can = GAME.ore >= c.ore && GAME.shards >= c.shards;
    const box = this.h(`<div class="upgrade beacon"><p><b>The sun beacon.</b> Feed it raw ore and it burns over the whole plateau all night: every Wildlight on the claim takes a quarter more harm, and the claim sleeps easier. ${lit ? '<b>It is lit for tonight.</b>' : `Tonight: ${c.ore} ore, ${SHARD} ${c.shards}.`}</p>
      <div class="stats-row"><button type="button" class="btn${lit ? '' : ' primary'}" ${lit || !can ? 'disabled' : ''}>${lit ? 'Lit for tonight' : 'Light it tonight'}</button><label class="small"><input type="checkbox" ${B.auto ? 'checked' : ''}> Every night, when the stores allow</label></div></div>`);
    box.querySelector('button').onclick = () => { beaconLight(); UI.refresh(); };
    box.querySelector('input').onchange = e => { (ACT.beacon || (ACT.beacon = { auto: false, night: -1 })).auto = e.target.checked; if (e.target.checked && !WL.night && GAME.t >= 0.5) beaconDusk(); UI.refresh(); };
    body.append(box);
  }
  return r;
};

// ---- a Masterwork made to order (act two): Odile draws it up, a guild workshop on the coast casts it, and she fits it
// at the bench. A large sum and the rarest materials, and half a day of bench time. One of each, never a second.
const COMMISSION = { shards: 2500, materials: { heartstone: 3, glass: 4 }, need: 120 };
function commissionPool() {
  const have = new Set(allItems().filter(x => x.it.type === 'relic').map(x => x.it.base));
  if (GAME.bench.job && GAME.bench.job.kind === 'commission') have.add(GAME.bench.job.relic);
  return Object.values(D.RELICS).filter(x => x.rarity === 'masterwork' && GEAR_SLOTS.includes(x.slot) && !have.has(x.id));
}
const commissionOpen = () => STORY.ch >= ACT_TWO;
function benchCommission() {
  const pool = commissionPool(), c = COMMISSION;
  if (!commissionOpen() || !pool.length || !canPay(c)) return false;
  if (GAME.bench.job) { toast('The bench is busy. One job at a time.'); return false; }
  const R = pool[(Math.random() * pool.length) | 0];
  pay(c);
  if (!startJob({ kind: 'commission', relic: R.id, need: c.need, label: 'Fitting a Masterwork, made to order on the coast' })) { GAME.shards += c.shards; for (const [k, n] of Object.entries(c.materials)) GAME.mats[k] += n; return false; }
  return true;
}
function commissionFinish(J, p) {
  const it = LOOT.makeRelic(J.relic, 'Odile’s bench, made to order');
  addToStash(it, true, { pos: p, line: 'Made to order' });
  return `Odile has fitted the <b style="color:${rarityOf(it).color}">${esc(it.name)}</b>, a Masterwork made to order.`;
}
// at the foot of the bench's Blueprints tab
function paceCommissionPane(ui, pane) {
  if (!commissionOpen()) return;
  const pool = commissionPool(), c = COMMISSION, can = canPay(c) && pool.length && !GAME.bench.job;
  const box = ui.h(`<div class="upgrade commission"><h3>A Masterwork, made to order</h3><p class="small">Odile draws it up, a guild workshop on the coast casts it, and she fits it here: a Masterwork for any hand, one you don’t have yet, chosen by the guild. ${costText(c)} and half a day at the bench.${pool.length ? '' : ' You have every Masterwork the guild makes.'}${pool.length && !canPay(c) ? ` Needs ${esc(shortOf(c))}.` : ''}</p><button type="button" class="btn primary" ${can ? '' : 'disabled'}>Commission one</button></div>`);
  box.querySelector('button').onclick = () => { benchCommission(); UI.refresh(); };
  pane.append(box);
}

// ---- for tests (window.__bv is made at the end of main.js, after this file has run)
queueMicrotask(() => { if (window.__bv) Object.assign(window.__bv, { PACE, paceNightsSeen, paceCalm, paceQuiet, paceStoryDay, paceBright, paceNextBright, paceBrightNote, storyPay, storyPayReady, paceRefugees, paceReward, storyOpen, storyClose,
  paceThreat, paceWealth, beaconCost, beaconLight, beaconLit, beaconDusk, benchCommission, commissionPool, COMMISSION, RATES }); });
