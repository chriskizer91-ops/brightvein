// ===================================================================== THE FLEET: crew, repairs, raids and bounties
// The claim's side of the skies (src/sky/): who sails, the ship's repairs at the dock, the wanted captains, the raid
// map, and what a raid brings home. The Shipyard itself (buying, refits, looks) is the skies' port screen
// (src/sky/port.js, refit.js); this is the Sky Dock's panel and everything that needs the claim's people and time.
//   Crew: a pilot (Agility: turning), a bosun (Grit: less harm to the hull, more patching, quicker repairs) and
//   gunners (Agility: reload and aim; one to six seats by the flagship's size), picked from the claim's people. They
//   keep their jobs; while she sails they're aboard, and when she's home they come down the boarding bridge and walk
//   back to work (hurt, if she went down). Anyone in the wilds, studying in the Keep or hurt stays ashore.
//   Repairs take claim time at the dock (refit.startRepair); the claim finishes them as the hours pass.
//   Bounties: now and then a wanted jumper captain turns up on the raid map for three days.
//   The raid map: a crop of Chris's map round Brightvein with every place on it, and the list: how hard, what it
//   pays, the best time, and when it's manned again.
import { GUNNERS as YARD_GUNNERS, crewEffects as yardCrewFx, CLASS as YARD_CLASS, startRepair as yardStartRepair, finishRepairs as yardFinish, repairLeft as yardLeft,
  repairCost as yardRepairCost, repairHours as yardRepairHours, damageOf as yardDamage, CREW_GIFTS as YARD_GIFTS } from './sky/refit.js';
import { REPEAT as YARD_REPEAT, makeBounty as yardMakeBounty, bountySite as yardBountySite, bountyHer as yardHer } from './sky/sites.js';
import { FLEET as YARD_FLEET } from './ships/index.js';
import { MAP as YARD_MAP, minimapUrl as YARD_MAPURL, HOME as YARD_HOME } from './sky/voyage.js';
// a place's name inside a sentence: 'the crates from the Chandlery'
const yardThe = s => String(s).replace(/^The /, 'the ');

const YARD = { tab: 'ship', sel: null, day: -1, repairT: 0, sparkT: 0, knownT: 3, sailed: [], img: null };
const yardNow = () => GAME.day + GAME.t;
const yardShip = id => YARD_FLEET.find(s => s.id === id);
const yardName = id => (FLEET.data.ships[id] && FLEET.data.ships[id].name) || yardShip(id).name;
const yardFirst = n => String(n).split(' ')[0];

// ----------------------------------------------------------------- the crew
const yardWho = id => (id ? GAME.villagers.find(v => v.d.id === id) || null : null);
// can this person sail now? (not in the wilds, not studying, not hurt)
const yardFree = v => !!v && !v.d.exp && !v.d.study && !v.hurt;
const yardWhyNot = v => v.d.exp ? 'in the wilds' : v.d.study ? 'studying in the Keep' : v.hurt ? 'hurt' : '';
function yardSeats(id = FLEET.data.flying) {
  const c = FLEET.data.crew, n = YARD_GUNNERS[id] || 1, out = [{ seat: 'pilot', v: yardWho(c.pilot) }, { seat: 'bosun', v: yardWho(c.bosun) }];
  for (let i = 0; i < n; i++) out.push({ seat: 'gunner', i, v: yardWho(c.gunners[i]) });
  return out;
}
// the crew's stats for refit.crewEffects, from whoever can sail
function yardCrewFor(id) {
  const c = FLEET.data.crew, n = YARD_GUNNERS[id] || 1, out = { gunners: [] };
  const P = yardWho(c.pilot), B = yardWho(c.bosun);
  if (yardFree(P)) out.pilot = { A: statOf(P, 'A'), hero: P.d.hero || null };
  if (yardFree(B)) out.bosun = { G: statOf(B, 'G'), hero: B.d.hero || null };
  for (const gid of c.gunners.slice(0, n)) { const g = yardWho(gid); if (yardFree(g)) out.gunners.push({ A: statOf(g, 'A'), hero: g.d.hero || null }); }
  return out;
}
function yardAboard(id = FLEET.data.flying) { return yardSeats(id).map(s => s.v).filter(yardFree); }
function yardCrewNames(id) {
  const c = FLEET.data.crew, P = yardWho(c.pilot), B = yardWho(c.bosun), n = YARD_GUNNERS[id] || 1;
  const gs = c.gunners.slice(0, n).map(yardWho).filter(yardFree).map(v => yardFirst(v.d.name)), out = [];
  if (yardFree(P)) out.push(`${yardFirst(P.d.name)} at the wheel`);
  if (yardFree(B)) out.push(`${yardFirst(B.d.name)}, bosun`);
  if (gs.length) out.push(`${gs.join(', ')} on the guns`);
  return out;
}
// put someone in a seat (out of any other seat first); v null empties it
function yardSeat(seat, i, v) {
  const c = FLEET.data.crew, id = v ? v.d.id : 0;
  if (id) { if (c.pilot === id) c.pilot = 0; if (c.bosun === id) c.bosun = 0; c.gunners = c.gunners.map(g => (g === id ? 0 : g)); }
  if (seat === 'pilot') c.pilot = id; else if (seat === 'bosun') c.bosun = id;
  else { while (c.gunners.length <= i) c.gunners.push(0); c.gunners[i] = id; }
  while (c.gunners.length && !c.gunners[c.gunners.length - 1]) c.gunners.pop();
  FLEET.save();
}
const YARD_SEAT = {
  pilot: { name: 'Pilot', stat: 'A', what: 'Agility: how sharply she turns, and how soon the Surge is back' },
  bosun: { name: 'Bosun', stat: 'G', what: 'Grit: the hull crew. Less harm to the hull, more patching between fights, quicker repairs at the dock' },
  gunner: { name: 'Gunner', stat: 'A', what: 'Agility: the guns reload faster and aim truer' },
};
// what the crew does, in words
function yardCrewLines(id) {
  const C = yardCrewFx(id, yardCrewFor(id)), pct = x => `${Math.round(Math.abs(x) * 100)}%`, out = [];
  if (C.reload < 0.995) out.push(`guns reload ${pct(1 - C.reload)} faster and aim ${pct(1 - C.aim)} truer`); else if (C.reload > 1.005) out.push(`guns reload ${pct(C.reload - 1)} slower`);
  if (C.turn > 1.005) out.push(`she turns ${pct(C.turn - 1)} sharper`);
  if (C.guard < 0.995) out.push(`the hull takes ${pct(1 - C.guard)} less harm`);
  if (C.repair < 0.995) out.push(`repairs ${pct(1 - C.repair)} quicker`);
  return { C, lines: out };
}

// ----------------------------------------------------------------- sailing out and coming home
// as she sails: the crew go aboard (the claim's time stands still while she's out)
function yardSailing() {
  YARD.sailed = yardAboard().map(v => v.d.id);
}
// home again: the crew come down the boarding bridge and walk back to work; if she went down, some come home hurt
function yardHome(r) {
  const D = LAYOUT.dock, ids = YARD.sailed; YARD.sailed = [];
  if (!r || !r.ship) return;
  let k = 0;
  for (const id of ids) {
    const v = yardWho(id); if (!v || v.d.exp || v.d.study) continue;
    v.setHidden(false); v.where = 'surface';
    v.place(D.x - 1 + (k % 3) * 0.9, 0, D.z + 7.2 + Math.floor(k / 3) * 0.8); k++;
    v.plan = []; v.replan = false;
    if (r.lost && Math.random() < 0.5 && typeof hurtVillager === 'function') hurtVillager(v);
  }
  if (ids.length) toast(r.lost ? `The crew limp home over the bridge. Some of them are hurt.` : `The crew come down the boarding bridge and go back to work.`);
}

// ----------------------------------------------------------------- every frame (from dockUpdate)
function yardTick(dt) {
  if (!FLEET || !started) return;
  // repairs done by now
  if ((YARD.repairT -= dt) <= 0) {
    YARD.repairT = 1;
    for (const id of yardFinish(FLEET.data, yardNow())) { toast(`<b>The ${esc(yardName(id))} is repaired</b> and ready to sail.`); AUDIO.play('built', DOCK.b && DOCK.b.group.position); FLEET.save(); if (UI.cur && UI.cur.kind === 'dock') UI.refresh(); }
  }
  // the yard hands at work on her: sparks along the hull and the odd hammer
  const rep = FLEET.data.ships[FLEET.data.flying].repair, s = DOCK.ship;
  if (rep && s && s.root.parent === scene && (YARD.sparkT -= dt) <= 0) {
    YARD.sparkT = 0.6 + Math.random() * 0.9;
    const L = s.recipe.length, p = s.root.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5 + Math.random(), (Math.random() - 0.5) * L * 0.8));
    FX.sparks(p, 10, 0xffc070, 1.6);
    if (Math.random() < 0.5 && VIEW.mode === 'town') AUDIO.play('hit', p);
  }
  // a new day: the wanted captains come and go
  if (GAME.day !== YARD.day) { const first = YARD.day < 0; YARD.day = GAME.day; if (!first) yardNewDay(); }
  // a new place to raid has opened: say so, once
  if ((YARD.knownT -= dt) <= 0) {
    YARD.knownT = 2;
    const k = FLEET.data.known, open = yardSites().filter(L => !L.locked && !L.bounty && !k.includes(L.s.id));
    // what's open when the claim loads is known already; a place that opens while you play is news
    for (const L of open) {
      k.push(L.s.id);
      if (YARD.knownInit && L.s.id !== 'camp') { toast(`<b>A new raid:</b> ${esc(L.s.name)} (Sky Dock › Raids). ${esc(L.s.goal)}.`); AUDIO.play('horn'); break; }
    }
    YARD.knownInit = true;
  }
}
function yardNewDay() {
  const d = FLEET.data, B = d.bounty;
  if (B && B.nick === 'the Snuffer of Lamps') B.nick = 'Lampblack';   // renamed (too like an old game’s lamplighter)
  if (B && GAME.day > B.until) { d.bounty = null; d.bountyNext = GAME.day + 2 + Math.floor(Math.random() * 3); toast(`The wanted captain <b>${esc(B.name)}</b> has moved on.`); FLEET.save(); }
  if (!d.bounty && STORY.ch >= 3 && GAME.day >= d.bountyNext) {
    d.bounty = yardMakeBounty(GAME.day, STORY.ch, d.bounties || 0);
    toast(`<b>Wanted:</b> ${esc(d.bounty.name)}, “${esc(d.bounty.nick)}”, has been seen near the claim. ${SHARD} ${d.bounty.reward} on ${yardHer(d.bounty).her} head (Sky Dock › Raids).`, 'night');
    AUDIO.play('horn'); FLEET.save();
  }
}

// ----------------------------------------------------------------- what a raid brings home
function yardRaidHome(r) {
  const R = r.raid, rec = FLEET.data.raids[R.id], first = !rec.won && R.id !== 'bounty';
  rec.won++; rec.day = GAME.day; if (R.time && (!rec.best || R.time < rec.best)) rec.best = R.time;
  const share = R.share ?? 1, season = R.id === 'storm' && STORY.ch === 13 ? 1.5 : 1;
  const scale = (first || R.id === 'bounty' ? 1 : YARD_REPEAT) * share * season;
  const haul = LOOT.raidCrates(R.loot, { scale, first, boss: R.boss });
  let bounty = 0;
  if (R.id === 'bounty' && FLEET.data.bounty) {
    bounty = FLEET.data.bounty.reward; FLEET.data.bounties = (FLEET.data.bounties || 0) + 1;
    FLEET.data.bounty = null; FLEET.data.bountyNext = GAME.day + 3 + Math.floor(Math.random() * 3);
    haul.shards += bounty;
  }
  addHaul({ ...haul, items: [] });
  const items = haul.items.map(it => addToStash(it, true, { pos: DOCK.b.group.position.clone(), line: `From the crates of ${yardThe(R.name)}` }));
  if (R.boss) moodAdd('raid-' + R.id, 6, 2, `${R.name}: the boss brought down`);
  else if (first) moodAdd('raid-' + R.id, 3, 1, `${R.name} taken`);
  FLEET.save();
  toast(`<b>${esc(R.name)}</b>${R.id === 'convoy' ? ' is home' : R.id === 'storm' ? ': the Thinwatch strongbox' : ' is taken'}. ${SHARD} ${haul.shards} and ${items.length} find${items.length === 1 ? '' : 's'}.`);
  setTimeout(() => UI.open('haul', { name: R.name, items, shards: haul.shards, got: r.got, mats: haul.materials, time: R.time, first, repeat: !first && R.id !== 'bounty', bounty, share }), 600);
}

// ----------------------------------------------------------------- the panel styles (kept here, scoped to the panel)
(function yardStyle() {
  const css = `
#app .yard-seats { display: grid; gap: 6px; }
#app .yseat { display: grid; grid-template-columns: 52px 1fr auto; gap: 10px; align-items: center; padding: 6px 8px; border-radius: 10px; border: 1px solid rgba(241,228,198,.16); background: rgba(0,0,0,.16); cursor: pointer; text-align: left; width: 100%; }
#app .yseat.empty { border-style: dashed; }
#app .yseat .pframe { width: 52px; height: 52px; }
#app .yseat .ph { width: 52px; height: 52px; border-radius: 12px; display: grid; place-items: center; font-size: 22px; color: var(--amber-2); background: rgba(0,0,0,.25); }
#app .yseat .nm { font-weight: 600; display: block; }
#app .yseat .jb { font-size: 12px; color: var(--cream-2); display: block; }
#app .yseat .st { font-size: 12px; color: var(--amber-2); text-align: right; }
#app .yseat.off { opacity: .55; }
#app .yfaces { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0; }
#app .yfaces .pframe { width: 44px; height: 44px; }
#app .ywear { display: grid; grid-template-columns: 5.5em 1fr 3em; gap: 4px 8px; align-items: center; font-size: 12px; }
#app .ywear .hp { margin: 0; }
#app .ymap { position: relative; width: 100%; aspect-ratio: 3 / 2; border-radius: 10px; overflow: hidden; border: 1px solid rgba(241,228,198,.35); background: #0a3b80; }
#app .ymap canvas { width: 100%; height: 100%; display: block; cursor: pointer; }
#app .li.raid .stars { color: var(--amber-2); letter-spacing: 1px; font-size: 11px; }
#app .li.raid .pay { font-size: 11px; color: var(--cream-2); display: block; }
#app .li.raid.sel { border-color: var(--amber-2); box-shadow: 0 0 0 1px var(--amber-2) inset; }
#app .wanted { margin: 8px 0; padding: 10px 12px; border-radius: 10px; background: linear-gradient(#e9d6aa, #cdb27c); color: #3a1f12; border: 2px solid #6e4a32; box-shadow: 0 4px 14px rgba(0,0,0,.4); }
#app .wanted h4 { margin: 0; font-family: var(--f-display); font-size: 22px; letter-spacing: .12em; text-align: center; color: #5a1a10; }
#app .wanted p, #app .panel .wanted p, #app .panel .wanted .small { margin: 4px 0; font-size: 13px; text-align: center; color: #3a1f12; }
#app .wanted b { color: #5a1a10; }
#app .wanted .btn { width: 100%; margin-top: 6px; }
#app .wanted img { display: block; width: 112px; height: 112px; margin: 6px auto; border-radius: 6px; border: 2px solid #6e4a32; filter: sepia(.35); }
#app .yplace { display: grid; grid-template-columns: 1fr; gap: 8px; margin: 8px 0; padding: 8px; border-radius: 10px; border: 1px solid var(--amber-2); background: rgba(0,0,0,.2); }
#app .yplace img { width: 100%; aspect-ratio: 4 / 3; max-height: 260px; object-fit: cover; border-radius: 8px; display: block; }
#app .yplace .stars { color: var(--amber-2); font-size: 11px; }
#app .yplace p { margin: 3px 0; }
#app .yplace .btn { margin-top: 4px; }
`;
  const el = document.createElement('style'); el.textContent = css; document.head.append(el);
})();

// ----------------------------------------------------------------- the Sky Dock's panel: Ship, Crew, Raids
UI.dock = function (body, ref) {
  if (ref && ref.pick) return yardPick(this, body, ref.pick);
  if (ref && ref.tab) YARD.tab = ref.tab;
  const d = FLEET.data, id = d.flying, R = yardShip(id), cfg = d.ships[id];
  body.append(this.h(`<h2>${esc(DOCK_DEF.name)}</h2><p class="sub">The ${esc(yardName(id))} · ${esc(R.cls)} · ${R.length} m · your flagship</p>`));
  const n = YARD_GUNNERS[id], aboard = yardAboard(id).length, B = d.bounty;
  const tabs = this.h(`<div class="tabs" role="group" aria-label="Show"><button type="button" data-t="ship">Ship</button><button type="button" data-t="crew">Crew · ${aboard}/${n + 2}</button><button type="button" data-t="raids">Raids${B ? ' · Wanted!' : ''}</button></div>`);
  for (const bt of tabs.querySelectorAll('button')) { bt.setAttribute('aria-pressed', bt.dataset.t === YARD.tab); bt.onclick = () => { YARD.tab = bt.dataset.t; UI.refresh(); }; }
  body.append(tabs);
  if (YARD.tab === 'crew') return yardCrewTab(this, body, id);
  if (YARD.tab === 'raids') return yardRaidsTab(this, body);
  // ---- the ship: condition, repairs, crew, setting sail
  body.append(this.h(`<p>${esc(DOCK_DEF.blurb)}</p>`));
  const dmg = yardDamage(cfg), left = yardLeft(cfg, yardNow());
  body.append(this.h(`<h3>Condition</h3><div class="ywear">${['hull', 'sails', 'crystals'].map(k => `<span>${k[0].toUpperCase() + k.slice(1)}</span><div class="hp${dmg[k] > 0.5 ? ' low' : ''}"><i style="width:${Math.max(2, (1 - dmg[k]) * 100)}%"></i></div><b>${Math.round((1 - dmg[k]) * 100)}%</b>`).join('')}</div>`));
  const C = yardCrewFx(id, yardCrewFor(id)), cost = yardRepairCost(id, cfg), hours = yardRepairHours(id, cfg, C.repair);
  if (left) body.append(this.h(`<p class="small">Under repair at the dock: ${left.hours < 1 ? 'nearly done' : `about ${Math.ceil(left.hours)} hour${Math.ceil(left.hours) === 1 ? '' : 's'} to go`}. She can’t sail till she’s done.</p><div class="hp"><i style="width:${Math.max(3, left.frac * 100)}%"></i></div>`));
  else if (hours) {
    const r = this.h(`<div class="stats-row"><button type="button" class="btn">Repair her: <span class="cost">${SHARD} ${cost}</span> · ${hours} hour${hours === 1 ? '' : 's'}</button></div>`), b = r.querySelector('button');
    b.disabled = GAME.shards < cost;
    b.onclick = () => { const x = yardStartRepair(id, cfg, yardNow(), C.repair, c => { if (GAME.shards < c.shards) return false; GAME.shards -= c.shards; return true; }); if (x) { FLEET.save(); AUDIO.play('build'); toast(`The yard hands start on the <b>${esc(yardName(id))}</b>: ${x.hours} hour${x.hours === 1 ? '' : 's'}.`); } UI.refresh(); };
    body.append(r);
    if (GAME.shards < cost) body.append(this.h(`<p class="small why">Needs ${esc(shortOf({ shards: cost }))}.</p>`));   // why the button is off
  } else body.append(this.h(`<p class="small">Sound from keel to masthead.</p>`));
  // who sails
  const crew = yardAboard(id);
  body.append(this.h(`<h3>Crew · ${crew.length} of ${n + 2} seats</h3>`));
  const faces = document.createElement('div'); faces.className = 'yfaces';
  for (const v of crew) faces.append(portraitOf(v, 44));
  if (!crew.length) faces.append(this.h(`<p class="small">Dock hands only. Pick a pilot, a bosun and gunners from the claim (Crew).</p>`));
  body.append(faces);
  const L = yardCrewLines(id); if (L.lines.length) body.append(this.h(`<p class="small">With this crew: ${esc(L.lines.join(', '))}.</p>`));
  const sk = SKIES[d.skies], owned = YARD_FLEET.filter(s => d.ships[s.id].owned).length;
  const chips = [`<span class="chip">Skies: ${esc(sk.name)}</span>`, `<span class="chip ${d.best[d.skies] ? 'amber' : ''}">${d.best[d.skies] ? `Best: wave ${d.best[d.skies]}` : 'No waves beaten yet'}</span>`,
    `<span class="chip">${owned} ship${owned > 1 ? 's' : ''} of ${YARD_FLEET.length}</span>`];
  if (d.voyages) chips.push(`<span class="chip">${d.voyages} voyage${d.voyages > 1 ? 's' : ''} · ${d.downed} raiders downed</span>`);
  body.append(this.h(`<div class="stats-row">${chips.join('')}</div>`));
  // (the raids are the Raids tab above)
  const acts = this.h(`<div class="stats-row"><button type="button" class="btn primary" id="dk-sail">Set sail</button><button type="button" class="btn" id="dk-yard">Shipyard</button><button type="button" class="btn" id="dk-skies">Skies</button></div>`);
  const sailB = acts.querySelector('#dk-sail'); sailB.disabled = !!left;
  sailB.onclick = () => openSky('voyage');
  acts.querySelector('#dk-yard').onclick = () => openSky('port');
  acts.querySelector('#dk-skies').onclick = () => openSky('title');
  body.append(acts);
  body.append(this.h(`<p class="small">On patrol, raiders come in waves; after each one, sail on or come home with the shards. While she’s out, the claim waits: nobody works and night won’t fall until she’s home. Whatever harm she takes comes home with her.</p>`));
};

// ---- the crew tab: the seats, with portraits
function yardCrewTab(ui, body, id) {
  const R = yardShip(id), seats = yardSeats(id), c = FLEET.data.crew;
  body.append(ui.h(`<p class="small">The ${esc(yardName(id))} has seats for a pilot, a bosun and ${YARD_GUNNERS[id] === 1 ? 'one gunner' : `${YARD_GUNNERS[id]} gunners`}. An empty seat is a dock hand (a 3 in everything). The crew keep their jobs on the claim; while she sails they’re aboard.</p>`));
  const list = document.createElement('div'); list.className = 'yard-seats';
  for (const S of seats) {
    const K = YARD_SEAT[S.seat], v = S.v, el = document.createElement('button'); el.type = 'button'; el.className = 'yseat' + (v ? '' : ' empty') + (v && !yardFree(v) ? ' off' : '');
    if (v) {
      el.append(portraitOf(v, 52));
      const gift = v.d.hero && YARD_GIFTS[S.seat === 'gunner' ? 'gunner' : S.seat][v.d.hero];
      el.append(ui.h(`<span><span class="nm">${esc(v.d.name)}</span><span class="jb">${esc(K.name)}${yardFree(v) ? '' : ` · ${yardWhyNot(v)}, stays ashore`}${gift ? ` · ${esc(gift.line)}` : ''}</span></span><span class="st">${stars(statOf(v, K.stat))}<br>${STAT_NAMES[K.stat]} ${statOf(v, K.stat)}</span>`));
    } else {
      el.append(ui.h(`<span class="ph">+</span><span><span class="nm">${esc(K.name)}${S.seat === 'gunner' ? ` ${S.i + 1}` : ''}</span><span class="jb">${esc(K.what)}</span></span><span class="st">Dock hand<br>3</span>`));
    }
    el.onclick = () => UI.open('dock', { pick: { seat: S.seat, i: S.i || 0 } });
    list.append(el);
  }
  body.append(list);
  // gunners kept for a bigger ship
  const extra = c.gunners.slice(YARD_GUNNERS[id]).map(yardWho).filter(Boolean);
  if (extra.length) body.append(ui.h(`<p class="small">No seat on the ${esc(R.cls)} for ${esc(andList(extra.map(v => yardFirst(v.d.name))))}: they’ll sail on a bigger ship.</p>`));
  const L = yardCrewLines(id);
  body.append(ui.h(`<h3>What they do</h3><p class="small">${L.lines.length ? esc(L.lines.join(', ')) + '.' : 'Nothing yet: dock hands only.'}${L.C.gifts.length ? ' ' + esc(L.C.gifts.join('. ')) + '.' : ''}</p>`));
  const r = ui.h(`<div class="stats-row"><button type="button" class="btn">Best crew for the job</button></div>`);
  r.querySelector('button').onclick = () => { yardAutoCrew(id); AUDIO.play('tap'); UI.refresh(); };
  body.append(r);
}
// the best free people for each seat: the two best at Agility on the guns and the wheel, the grittiest as bosun
function yardAutoCrew(id) {
  const pool = GAME.villagers.filter(yardFree), used = new Set(), take = (k) => { const v = pool.filter(p => !used.has(p)).sort((a, b) => statOf(b, k) - statOf(a, k))[0]; if (v) used.add(v); return v || null; };
  const B = take('G'), P = take('A'), gs = []; for (let i = 0; i < YARD_GUNNERS[id]; i++) gs.push(take('A'));
  const c = FLEET.data.crew; c.pilot = P ? P.d.id : 0; c.bosun = B ? B.d.id : 0; c.gunners = gs.map(v => (v ? v.d.id : 0));
  FLEET.save();
}
// the picker for one seat: the claim's people by the stat that matters there
function yardPick(ui, body, ref) {
  const K = YARD_SEAT[ref.seat], c = FLEET.data.crew, cur = yardWho(ref.seat === 'pilot' ? c.pilot : ref.seat === 'bosun' ? c.bosun : c.gunners[ref.i]);
  body.append(ui.h(`<h2>Choose a ${esc(K.name.toLowerCase())}</h2><p class="sub">For the ${esc(yardName(FLEET.data.flying))}. ${esc(K.what)}.</p>`));
  if (cur) { const r = ui.h(`<div class="stats-row"><button type="button" class="btn">${esc(yardFirst(cur.d.name))} steps ashore</button></div>`); r.querySelector('button').onclick = () => { yardSeat(ref.seat, ref.i, null); UI.open('dock', { tab: 'crew' }); }; body.append(r); }
  const seatOf = v => (c.pilot === v.d.id ? 'Pilot' : c.bosun === v.d.id ? 'Bosun' : c.gunners.includes(v.d.id) ? 'Gunner' : '');
  const list = document.createElement('div'); list.className = 'list';
  const people = GAME.villagers.filter(v => v !== cur).sort((a, b) => (yardFree(b) - yardFree(a)) || statOf(b, K.stat) - statOf(a, K.stat));
  for (const v of people) {
    const s = statOf(v, K.stat), seat = seatOf(v), jb = v.d.job ? (v.jobB ? v.jobB.def.job.title + ', ' + (v.jobB.name || v.jobB.def.name) : 'Working') : 'No job';
    const el = document.createElement('button'); el.type = 'button'; el.className = 'li'; el.disabled = !yardFree(v);
    el.append(faceOf(v));
    el.append(ui.h(`<span><span class="nm">${esc(v.d.name)}</span><span class="jb">${esc(yardFree(v) ? jb : yardWhyNot(v))}${seat ? ` · now ${seat.toLowerCase()}` : ''}</span></span><span class="fit">${stars(s)} <em>${STAT_NAMES[K.stat]} ${s}</em></span>`));
    el.onclick = () => { yardSeat(ref.seat, ref.i, v); toast(`<b>${esc(v.d.name)}</b> signs on as ${K.name.toLowerCase()}.`); AUDIO.play('tap'); UI.open('dock', { tab: 'crew' }); };
    list.append(el);
  }
  body.append(list);
  ui.back(body, 'Back', () => UI.open('dock', { tab: 'crew' }));
}

// ---- the raids tab: the map, the wanted poster, the list
function yardSites() {
  const d = FLEET.data, out = [];
  for (const s of SITES) {
    if (s.ch && STORY.ch < s.ch && !(d.raids[s.id] && d.raids[s.id].won)) continue;   // act two’s places turn up in their chapters
    const st = d.raids[s.id], after = s.after && SITES.find(x => x.id === s.after), locked = !!after && !d.raids[after.id].won;
    const wait = st.won ? s.regrow - (GAME.day - st.day) : 0;
    out.push({ s, st, locked, after, wait });
  }
  if (d.bounty) out.push({ s: yardBountySite(d.bounty), st: d.raids.bounty, locked: false, wait: 0, bounty: d.bounty });
  return out;
}
const yardStars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const yardTime = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
function yardRaidsTab(ui, body) {
  const d = FLEET.data, list = yardSites(), flag = yardShip(d.flying), cfg = d.ships[d.flying], left = yardLeft(cfg, yardNow());
  // the map round Brightvein
  const wrap = document.createElement('div'); wrap.className = 'ymap'; const cv = document.createElement('canvas'); wrap.append(cv); body.append(wrap);
  // drawn whenever it has room on screen: a panel held out of sight under a scene or a tip comes back with its map drawn
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!cv.isConnected) return ro.disconnect(); if (cv.getBoundingClientRect().width) yardDrawMap(cv, list); }); ro.observe(wrap); }
  else requestAnimationFrame(() => yardDrawMap(cv, list));
  cv.onclick = e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    let best = null, bd = 0.06;
    for (const L of list) { const p = yardMapAt(L.s); const dd = Math.hypot(p[0] - x, p[1] - y); if (dd < bd) { bd = dd; best = L; } }
    if (best) { YARD.sel = best.s.id; UI.refresh(); }
  };
  if (left) body.append(ui.h(`<p class="small">The ${esc(yardName(d.flying))} is under repair: no raids till she’s done.</p>`));
  // the place picked on the map: its picture (when Chris has painted it: assets/skies/<id>.webp), what it is, and Raid
  const P = list.find(L => L.s.id === YARD.sel && !L.bounty && !L.locked);
  if (P) {
    const s = P.s, st = P.st, pic = ART.skies && ART.skies[s.id], repeat = st.won > 0;
    const card = ui.h(`<div class="yplace">${pic ? `<img src="${pic}" alt="">` : ''}<div><b>${esc(s.name)}</b> <span class="stars">${yardStars(s.stars)}</span><p class="small">${esc(s.line)}</p><p class="small">${esc(s.goal)}. ${esc(s.pays)}${repeat ? ' (half, taken before)' : ''}.${st.best ? ` Best time ${yardTime(st.best)}.` : ''} Best in a ${esc(yardShip(s.ship).cls)} or bigger.</p><button type="button" class="btn primary">${P.wait > 0 ? `Manned again in ${P.wait} day${P.wait > 1 ? 's' : ''}` : 'Raid'}</button></div></div>`);
    const b = card.querySelector('button'); b.disabled = P.wait > 0 || !!left; b.onclick = () => openSky('raid', { site: s.id });
    body.append(card);
  }
  // a wanted captain
  const B = d.bounty;
  if (B && B.nick === 'the Snuffer of Lamps') B.nick = 'Lampblack';
  if (B) {
    const face = ART.portraits && ART.portraits['wanted-' + B.name.toLowerCase().replace(/[^a-z]+/g, '-')];
    const W = ui.h(`<div class="wanted"><h4>WANTED</h4>${face ? `<img src="${face}" alt="">` : ''}<p><b>${esc(B.name)}</b>, called “${esc(B.nick)}”</p><p>A jumper ${esc(yardShip(B.ship).cls)} and ${B.escorts.length} escorts · ${SHARD} ${B.reward} on ${yardHer(B).her} head</p><p class="small">Seen near the claim. Gone in ${Math.max(1, B.until - GAME.day + 1)} day${B.until - GAME.day ? 's' : ''}.</p><button type="button" class="btn primary">Hunt ${yardHer(B).him} down</button></div>`);
    const b = W.querySelector('button'); b.disabled = !!left; b.onclick = () => openSky('raid', { site: 'bounty' });
    body.append(W);
  }
  body.append(ui.h(`<h3>Raids · your flagship is a ${esc(flag.cls)}</h3>`));
  const box = document.createElement('div'); box.className = 'list';
  for (const L of list) {
    if (L.bounty) continue;
    const s = L.s, st = L.st, repeat = st.won > 0, crates = Math.max(1, Math.round(s.crates * (repeat ? YARD_REPEAT : 1)));
    const small = YARD_CLASS[d.flying] < YARD_CLASS[s.ship], icon = L.locked ? '?' : st.won ? '⚑' : '◆';
    const side = L.locked ? '' : L.wait > 0 ? `Manned again in ${L.wait} day${L.wait > 1 ? 's' : ''}` : `${crates} crate${crates > 1 ? 's' : ''} · Raid`;
    const el = document.createElement('button'); el.type = 'button'; el.className = 'li raid' + (YARD.sel === s.id ? ' sel' : '');
    el.append(ui.h(`<span class="rk">${icon}</span><span><span class="nm">${esc(L.locked ? 'Somewhere out there' : s.name)}</span>${L.locked ? `<span class="jb">${esc(`Take ${L.after.short.replace(/^The /, 'the ')} first.`)}</span>` : `<span class="stars">${yardStars(s.stars)}</span> <span class="jb">${esc(s.goal)}.</span><span class="pay">${esc(s.pays)}${repeat ? ' · taken before: half the haul' : ''}${st.best ? ` · best ${yardTime(st.best)}` : ''}${st.won ? ` · taken ${st.won}×` : ''}${small ? ` · hard in a ${flag.cls}: a ${yardShip(s.ship).cls} or bigger` : ''}</span>`}</span><span class="side">${side}</span>`));
    el.disabled = L.locked || L.wait > 0 || !!left;
    el.onclick = () => openSky('raid', { site: s.id });
    box.append(el);
  }
  body.append(box);
  body.append(ui.h(`<p class="small">A place taken comes back under new guards after a few days, with half the haul. Its boss doesn’t come back.</p>`));
}
// where a place sits on the raid map (0..1 across and down): a window of Chris's map round Brightvein
const YARD_WIN = { x: YARD_HOME.x, z: YARD_HOME.z + 1300, w: 11000, h: 7333 };
const yardMapAt = s => [(s.x - YARD_WIN.x) / YARD_WIN.w + 0.5, (s.z - YARD_WIN.z) / YARD_WIN.h + 0.5];
function yardDrawMap(cv, list) {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.width = Math.round(r.width * dpr), H = cv.height = Math.round(r.height * dpr), g = cv.getContext('2d');
  const draw = () => {
    const im = YARD.img, M = YARD_MAP;
    if (im && im.complete && im.naturalWidth) {
      const sx = ((YARD_WIN.x - YARD_WIN.w / 2) / M.w + 0.5) * im.naturalWidth, sy = ((YARD_WIN.z - YARD_WIN.h / 2) / M.h + 0.5) * im.naturalHeight;
      g.imageSmoothingEnabled = true; g.drawImage(im, sx, sy, YARD_WIN.w / M.w * im.naturalWidth, YARD_WIN.h / M.h * im.naturalHeight, 0, 0, W, H);
    } else { g.fillStyle = '#0a3b80'; g.fillRect(0, 0, W, H); }
    g.fillStyle = 'rgba(20,8,24,.25)'; g.fillRect(0, 0, W, H);
    const s = 7 * dpr, font = `${Math.round(11 * dpr)}px system-ui, sans-serif`;
    // Brightvein
    const [hx, hy] = yardMapAt(YARD_HOME).map((v, i) => v * (i ? H : W));
    g.lineWidth = 2 * dpr; g.strokeStyle = '#3a1631'; g.fillStyle = '#ffcf85';
    g.beginPath(); g.moveTo(hx, hy - s * 1.4); g.lineTo(hx + s, hy); g.lineTo(hx, hy + s * 1.4); g.lineTo(hx - s, hy); g.closePath(); g.fill(); g.stroke();
    g.font = `bold ${font}`; g.textAlign = 'center'; g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(20,8,24,.9)'; g.strokeText('Brightvein', hx, hy + s * 3); g.fillText('Brightvein', hx, hy + s * 3);
    for (const L of list) {
      const [x, y] = yardMapAt(L.s).map((v, i) => v * (i ? H : W)), sel = YARD.sel === L.s.id;
      if (x < 0 || y < 0 || x > W || y > H) continue;
      const col = L.bounty ? '#ff5a46' : L.locked ? '#8a7a90' : L.wait > 0 ? '#c9a0d8' : L.st.won ? '#e2bd67' : '#ff9a3a';
      g.beginPath(); g.arc(x, y, s * (sel ? 1.3 : 1), 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 2 * dpr; g.strokeStyle = sel ? '#fff3d0' : '#3a1631'; g.stroke();
      if (L.bounty) { g.fillStyle = '#3a1631'; g.font = `bold ${Math.round(10 * dpr)}px system-ui`; g.fillText('!', x, y + 4 * dpr); }
      const label = L.locked ? '?' : L.bounty ? 'Wanted' : L.s.short;
      g.font = font; g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(20,8,24,.9)'; g.strokeText(label, x, y - s * 1.6); g.fillStyle = '#f3ead8'; g.fillText(label, x, y - s * 1.6);
      if (!L.locked && !L.bounty) { g.font = `${Math.round(9 * dpr)}px system-ui`; g.fillStyle = '#ffcf85'; g.strokeText(yardStars(L.s.stars).replace(/☆/g, ''), x, y + s * 2.4); g.fillText(yardStars(L.s.stars).replace(/☆/g, ''), x, y + s * 2.4); }
    }
  };
  if (!YARD.img) { YARD.img = new Image(); YARD.img.src = YARD_MAPURL; }
  if (!YARD.img.complete) YARD.img.addEventListener('load', () => { if (cv.isConnected) draw(); }, { once: true });
  draw();
}

// ---- what a raid brought home
UI.haul = function (body, h) {
  const mats = Object.entries(h.mats || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${D.MATERIALS[k] ? D.MATERIALS[k].name : k}`);
  body.append(this.h(`<h2>The crates from ${esc(yardThe(h.name))}</h2><p class="sub">${SHARD} ${h.shards} shards in the crates${h.bounty ? ` (${h.bounty} of them the bounty)` : ''}${h.got ? `, and ${SHARD} ${h.got} gathered on the way` : ''}${mats.length ? `, and ${esc(andList(mats))}` : ''}. Everything else is in the stash.</p>`));
  const chips = [];
  if (h.time) chips.push(`<span class="chip">In ${yardTime(h.time)}</span>`);
  if (h.first) chips.push(`<span class="chip amber">First time: the full haul</span>`);
  if (h.repeat) chips.push(`<span class="chip">Taken before: half the haul</span>`);
  if (h.share != null && h.share < 1) chips.push(`<span class="chip warn">${Math.round(h.share * 3)} of 3 barges home</span>`);
  if (chips.length) body.append(this.h(`<div class="stats-row">${chips.join('')}</div>`));
  const list = document.createElement('div'); list.className = 'list';
  for (const it of h.items) list.append(this.itemRow(it, '', () => UI.open('item', { it, back: () => UI.open('haul', h) })));
  body.append(list);
  this.back(body, 'To the Sky Dock', () => UI.open('dock'));
};

// ---- for tests (window.__bv is made at the end of main.js, after this file has run)
queueMicrotask(() => { if (window.__bv) Object.assign(window.__bv, { YARD, yardSeat, yardSeats, yardCrewFor, yardCrewNames, yardAutoCrew, yardAboard, yardTick, yardNewDay, yardSites, yardRaidHome, yardSailing, yardHome, SITES, makeBounty: yardMakeBounty }); });
