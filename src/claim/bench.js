// ===================================================================== ODILE'S BENCH: the workshop at the Lens Workshop
// Aethermoor's forge, at Odile's bench: salvage what you don't need into Brass Scrap, Cut Glass and Heartstone; retune
// one trait (and keep the new roll or put the old one back); overhaul a piece +1 … +10 (from +6 a step can fail); fit
// sunstone cells into its sockets; attune a Masterwork one of two ways; have Absalom assay Signed pieces; and make
// the base items you've found blueprints for. Every job takes a little time at the bench (game time: it waits while
// the claim is paused), with sparks at the workshop and the ring of a hammer, and one job runs at a time.
// The bench is worked by the Lens Workshop's best Engineering hand (Odile, as a rule): a better hand is quicker,
// fails less at the high overhauls and makes better things from blueprints. With nobody there you work it yourself.
// The bench is saved with the claim: GAME.bench = { job, choice } (a job in progress, and a retune waiting on you).
GAME.bench = { job: null, choice: null };
const BENCH = { fxT: 0, hamT: 0, uiT: 0 };
const WS = D.WORKSHOP;
// ---- who works the bench, and how well
function benchShop() { const shops = byType('shop').filter(b => b.level > 0); if (!shops.length) return null; const h = benchHand(); return (h && h.jobB && h.jobB.type === 'shop' ? h.jobB : null) || shops[0]; }
function benchHand() {
  let best = null, bs = -1;
  for (const b of byType('shop')) for (const v of workersOf(b.id)) { if (v.d.exp || v.d.study) continue; const s = statOf(v, 'E'); if (s > bs) { bs = s; best = v; } }
  return best;
}
const benchSkill = () => { const h = benchHand(); return h ? statOf(h, 'E') : 3; };
const benchSpeed = () => 0.5 + benchSkill() * 0.07;                  // Engineering 7: about 1; Odile (11): 1.27
const failMult = () => clamp(1 - (benchSkill() - 5) * 0.06, 0.4, 1.3); // Odile: about two-thirds the risk
const craftLuck = () => Math.max(0, (benchSkill() - 5) * 0.3);
const handWords = s => s >= 11 ? 'a master’s hand: quick, and steady at the high overhauls' : s >= 8 ? 'a good hand: quick enough, and careful' : s >= 5 ? 'a fair hand: slower, and the high overhauls fail more' : 'a rough hand: slow, and risky at the high overhauls';
// the Worldforge Engine, worn by someone at the workshop: retuning and overhauls cost half
const worldforge = () => byType('shop').some(b => workersOf(b.id).some(v => GEAR_SLOTS.some(s => v.d.gear[s] && v.d.gear[s].base === 'worldforge-engine'))) ? 0.5 : 1;

// ---- every piece on the claim, wherever it is
function allItems() {
  const out = GAME.stash.map(it => ({ it, where: 'stash' }));
  for (const v of GAME.villagers) for (const s of GEAR_SLOTS) if (v.d.gear[s]) out.push({ it: v.d.gear[s], where: 'worn', v });
  for (const f of fittedAll()) out.push({ it: f.it, where: 'fitted', id: f.id, i: f.i });
  if (GAME.bench.job && GAME.bench.job.items) for (const it of GAME.bench.job.items) out.push({ it, where: 'bench' });
  return out;
}
const findItem = uid => allItems().find(x => x.it.uid === uid) || null;
function whereText(x) {
  if (!x) return '';
  if (x.where === 'worn') return `Worn by ${x.v.d.name.split(' ')[0]}`;
  if (x.where === 'fitted') { const b = buildingById(x.id); return `Fitted to ${b === 'lark' ? 'the Lark' : b ? b.name || b.def.name : 'a building'}`; }
  if (x.where === 'bench') return 'On the bench';
  return 'In the stash';
}
const onBench = it => !!GAME.bench.job && (GAME.bench.job.uid === it.uid || (GAME.bench.job.items || []).includes(it));
const touched = () => { for (const v of GAME.villagers) v.gearCache = null; };

// ---- what things cost
const matLine = m => Object.entries(m || {}).filter(([, n]) => n).map(([k, n]) => `${n} ${D.MATERIALS[k].name}`).join(', ');
function costText(c) { const bits = []; if (c.shards) bits.push(`${SHARD} ${c.shards}`); const m = matLine(c.materials); if (m) bits.push(esc(m)); return bits.join(' · ') || 'free'; }
function canPay(c) { if (!c) return false; if (GAME.shards < (c.shards || 0)) return false; for (const [k, n] of Object.entries(c.materials || {})) if ((GAME.mats[k] || 0) < n) return false; return true; }
function shortOf(c) { const out = []; if (GAME.shards < (c.shards || 0)) out.push(`${Math.ceil(c.shards - GAME.shards)} more shards`); for (const [k, n] of Object.entries(c.materials || {})) if ((GAME.mats[k] || 0) < n) out.push(`${n - (GAME.mats[k] || 0)} more ${D.MATERIALS[k].name}`); return out.join(' and '); }
function pay(c) { GAME.shards -= c.shards || 0; for (const [k, n] of Object.entries(c.materials || {})) GAME.mats[k] = (GAME.mats[k] || 0) - n; }
function salvageYield(it) {
  const y = { ...(LOOT.salvageYield(it) || {}) };
  if (it.overhaul >= 3) y.brass = (y.brass || 0) + Math.floor(it.overhaul / 3);
  return y;
}
const canSalvage = it => it.type !== 'relic' && !!WS.salvage[it.rarity];
function overhaulCost(it) {
  const c = LOOT.overhaulCost(it); if (!c) return null;
  const k = (1 - Math.min(0.6, modType('shop', 'overhaulCost') / 100)) * worldforge();
  return { shards: Math.max(1, Math.round(c.shards * k)), materials: c.materials };
}
const overhaulFail = it => (WS.overhaul.fail[it.overhaul || 0] || 0) * failMult();
function retuneCost(it) {
  const c = LOOT.retuneCost(it); if (!c) return null;
  const k = (1 - Math.min(0.6, modType('shop', 'retuneCost') / 100)) * worldforge();
  return { shards: Math.max(1, Math.round(c.shards * k)), materials: c.materials };
}
const canRetune = it => !!retuneCost(it);
const canOverhaul = it => (it.type === 'gear' || it.type === 'relic' || isModuleItem(it)) && (it.overhaul || 0) < WS.overhaul.max;
const sockets = it => wearable(it) ? LOOT.socketsOf(it) : 0;
const canAttune = it => it.type === 'relic' && it.rarity === 'masterwork' && !it.attuned;
const attuneCost = () => ({ shards: WS.attune.shards, materials: { heartstone: WS.attune.heartstone } });
const craftIlvl = base => Math.max(D.ITEMS[base].minLvl || 1, Math.round(Math.max(1, GAME.nights) * 0.8));
function craftCost(base) { const L = craftIlvl(base), C = WS.craft; const m = { brass: C.brass }; if (L >= C.glassFrom) m.glass = 1; return { shards: C.shards + C.perIlvl * L, materials: m }; }
function craftOdds() { const o = LOOT.rarityOdds(craftLuck()), keep = ['tooled', 'tuned', 'calibrated', 'signed'], tot = keep.reduce((s, k) => s + o[k], 0); return keep.map(k => [k, Math.round(o[k] / tot * 100)]); }

// ---- jobs: one at a time, paid when they start
const jobTime = s => s / benchSpeed();
function benchBusy() { return !!GAME.bench.job; }
function startJob(job) {
  if (GAME.bench.job) { toast('The bench is busy. One job at a time.'); return false; }
  if (!benchShop()) { toast('Build the Lens Workshop first: the bench is in it.'); return false; }
  GAME.bench.job = { t: 0, ...job };
  const p = benchPos(); AUDIO.play('forge', p); FX.sparks(p, 12, 0xffc070, 2.4);
  BENCH.hamT = 0.3; UI.refresh();
  return true;
}
function benchSalvage(items) {
  items = items.filter(it => GAME.stash.includes(it) && canSalvage(it) && !onBench(it)); if (!items.length) return false;
  const y = {}; for (const it of items) for (const [k, n] of Object.entries(salvageYield(it))) y[k] = (y[k] || 0) + n;
  const cells = []; for (const it of items) for (const c of it.cells || []) if (c) cells.push(c);
  for (const it of items) GAME.stash.splice(GAME.stash.indexOf(it), 1);
  return startJob({ kind: 'salvage', items, yield: y, cells, need: Math.min(WS.salvage.maxTime, WS.salvage.time * items.length), label: items.length === 1 ? `Breaking down the ${items[0].name}` : `Breaking down ${items.length} pieces` });
}
function benchOverhaul(it) {
  const c = overhaulCost(it); if (!c || !canOverhaul(it) || onBench(it)) return false;
  if (!canPay(c)) { toast(`Not enough for that: ${shortOf(c)}.`); return false; }
  if (GAME.bench.job) { toast('The bench is busy. One job at a time.'); return false; }
  pay(c);
  const to = (it.overhaul || 0) + 1;
  if (!startJob({ kind: 'overhaul', uid: it.uid, to, cost: c, fail: overhaulFail(it), need: WS.overhaul.time[to - 1], label: `Overhauling the ${it.name} to +${to}` })) { GAME.shards += c.shards; for (const [k, n] of Object.entries(c.materials)) GAME.mats[k] += n; return false; }
  return true;
}
function benchRetune(it, index) {
  const c = retuneCost(it); if (!c || onBench(it) || !it.traits[index]) return false;
  if (!canPay(c)) { toast(`Not enough for that: ${shortOf(c)}.`); return false; }
  if (GAME.bench.job || GAME.bench.choice) { toast('The bench is busy.'); return false; }
  pay(c);
  return startJob({ kind: 'retune', uid: it.uid, index, need: WS.retune.time, label: `Retuning the ${it.name}` });
}
function benchCell(it, slot, cell) {
  if (!sockets(it) || slot >= sockets(it) || !(GAME.cells[cell] > 0) || onBench(it)) return false;
  if (GAME.shards < WS.socket) { toast(`Fitting a cell costs ${WS.socket} shards.`); return false; }
  if (GAME.bench.job) { toast('The bench is busy. One job at a time.'); return false; }
  GAME.shards -= WS.socket; GAME.cells[cell]--;
  return startJob({ kind: 'cell', uid: it.uid, slot, cell, need: WS.cellTime, label: `Setting a ${D.CELLS[cell].name} into the ${it.name}` });
}
function benchUncell(it, slot) {
  const c = it.cells && it.cells[slot]; if (!c || onBench(it)) return false;
  it.cells[slot] = null; GAME.cells[c] = (GAME.cells[c] || 0) + 1; touched();
  AUDIO.play('tap'); toast(`The <b>${esc(D.CELLS[c].name)}</b> is back in the box.`); return true;
}
function benchAttune(it, way) {
  if (!canAttune(it) || !D.ATTUNE[way] || onBench(it)) return false;
  const c = attuneCost(); if (!canPay(c)) { toast(`Not enough for that: ${shortOf(c)}.`); return false; }
  if (GAME.bench.job) { toast('The bench is busy. One job at a time.'); return false; }
  pay(c);
  return startJob({ kind: 'attune', uid: it.uid, way, need: WS.attune.time, label: `Attuning ${it.name}` });
}
function benchCraft(base) {
  if (!GAME.blueprints.includes(base) || !D.ITEMS[base]) return false;
  const c = craftCost(base); if (!canPay(c)) { toast(`Not enough for that: ${shortOf(c)}.`); return false; }
  if (GAME.bench.job) { toast('The bench is busy. One job at a time.'); return false; }
  pay(c);
  return startJob({ kind: 'craft', base, need: WS.craft.time, label: `Making a ${D.ITEMS[base].name}` });
}
function benchAssay(it) {
  if (!it.unassayed) return false;
  if (GAME.shards < WS.assay) { toast(`Absalom charges ${WS.assay} shards to read a mark.`); return false; }
  GAME.shards -= WS.assay; delete it.unassayed; AUDIO.play('chime'); touched();
  toast(`Absalom reads the mark: <b>${esc(it.power ? it.power.name : 'a maker he knows')}</b>.`);
  return true;
}
// the retune's result waits on you: keep the new trait, or put the old one back (the cost is spent either way)
function benchChoose(keep) {
  const C = GAME.bench.choice; if (!C) return;
  const x = findItem(C.uid);
  if (keep && x) { Object.assign(x.it, { traits: C.after.traits, name: C.after.name, aspect: C.after.aspect !== undefined ? C.after.aspect : x.it.aspect }); touched(); if (x.where === 'fitted') fitChanged(buildingById(x.id)); toast(`Kept the new trait on the <b>${esc(x.it.name)}</b>.`); }
  else if (x) toast(`The old trait goes back on the <b>${esc(x.it.name)}</b>.`);
  GAME.bench.choice = null; AUDIO.play('tap'); UI.refresh();
}
function finishJob(J) {
  const p = benchPos(), x = J.uid ? findItem(J.uid) : null, it = x && x.it;
  let ok = true, msg = '';
  if (J.kind === 'salvage') {
    for (const [k, n] of Object.entries(J.yield)) GAME.mats[k] = (GAME.mats[k] || 0) + n;
    for (const c of J.cells) GAME.cells[c] = (GAME.cells[c] || 0) + 1;
    msg = `Odile breaks down ${J.items.length === 1 ? 'the ' + esc(J.items[0].name) : J.items.length + ' pieces'}: <b>${esc(matLine(J.yield)) || 'nothing worth keeping'}</b>${J.cells.length ? `, and ${J.cells.length} cell${J.cells.length > 1 ? 's' : ''} back in the box` : ''}.`;
  } else if (!it && J.kind !== 'craft') { ok = false; msg = 'The piece went missing from the bench.'; }
  else if (J.kind === 'overhaul') {
    if (Math.random() < J.fail) { ok = false; const back = Math.floor(J.cost.shards / 2); GAME.shards += back; msg = `The +${J.to} didn't take on the <b>${esc(it.name)}</b>. ${matLine(J.cost.materials) ? 'The ' + esc(matLine(J.cost.materials)) + ' is spent; ' : ''}${back} shards come back. It's still +${J.to - 1}.`; }
    else { it.overhaul = J.to; msg = `The <b style="color:${rarityOf(it).color}">${esc(it.name)}</b> is now <b>+${J.to}</b>.`; if (x.where === 'fitted') fitChanged(buildingById(x.id)); }
  } else if (J.kind === 'retune') {
    const fresh = LOOT.retune(it, J.index);
    it.retunes = (it.retunes || 0) + 1;
    if (!fresh) { ok = false; msg = `Nothing else would take on the <b>${esc(it.name)}</b>. It's as it was.`; }
    else { GAME.bench.choice = { uid: it.uid, index: J.index, before: it.traits[J.index], after: { traits: fresh.traits, name: fresh.name, aspect: fresh.aspect } }; msg = `Odile has retuned the <b>${esc(it.name)}</b>. Keep the new trait, or put the old one back?`; }
  } else if (J.kind === 'cell') {
    it.cells = it.cells || []; const old = it.cells[J.slot]; if (old) GAME.cells[old] = (GAME.cells[old] || 0) + 1;
    it.cells[J.slot] = J.cell; msg = `The <b>${esc(D.CELLS[J.cell].name)}</b> is set in the <b>${esc(it.name)}</b>.`;
  } else if (J.kind === 'attune') {
    it.attuned = J.way; it.name = `${D.RELICS[it.base].name}, ${D.ATTUNE[J.way].name}`; msg = `<b style="color:${rarityOf(it).color}">${esc(it.name)}</b>. ${esc(D.ATTUNE[J.way].text)}`;
    if (x.where === 'fitted') fitChanged(buildingById(x.id));
  } else if (J.kind === 'craft') {
    const made = LOOT.makeGear({ base: J.base, rarity: LOOT.rollRarity(craftLuck(), { min: 'tooled', max: 'signed' }), ilvl: craftIlvl(J.base), from: 'Odile’s bench' });
    addToStash(made, true, { pos: p, line: 'Odile made' });
    msg = `Odile has made a <b style="color:${rarityOf(made).color}">${esc(made.name)}</b> (${esc(rarityOf(made).name)}).`;
  }
  touched();
  AUDIO.play(ok ? 'success' : 'fail', p);
  FX.sparks(p.clone().setY(p.y + 0.4), ok ? 30 : 12, ok ? 0xfff0c0 : 0xff7a50, ok ? 3.6 : 2);
  if (msg) toast(msg, ok ? '' : 'night');
}
const benchPos = () => { const b = benchShop(); return b ? b.worldPos(-1.9, 1.35, 4.0) : new THREE.Vector3(); };
function benchTick(dt) {
  const J = GAME.bench.job; if (!J || dt <= 0) return;
  J.t += dt * benchSpeed();
  if (J.t >= J.need) { GAME.bench.job = null; finishJob(J); UI.refresh(); }
}
// each frame: the bench, the modules (fittings.js), the rare-find beams (finds.js); sparks and the hammer while it works
function benchFrame(rdt, gdt) {
  benchTick(gdt); fitTick(gdt); fitFrame(rdt); lootFxUpdate(rdt);
  const J = GAME.bench.job, b = J && benchShop();
  if (b && gdt > 0) {
    b.busy = 1;
    if ((BENCH.fxT -= rdt) <= 0) { BENCH.fxT = 0.11; FX.sparks(benchPos(), 3, Math.random() < 0.3 ? 0xffe0a0 : 0xffa040, 1.7); }
    if ((BENCH.hamT -= gdt) <= 0) { BENCH.hamT = 0.75; AUDIO.play('anvil', benchPos()); }
  }
  // the progress bar in the bench's panel, without redrawing the panel
  if (J && UI.cur && UI.cur.kind === 'bench' && (BENCH.uiT -= rdt) <= 0) {
    BENCH.uiT = 0.15;
    const bar = document.getElementById('bench-bar'), t = document.getElementById('bench-left');
    if (bar) bar.style.width = Math.min(100, J.t / J.need * 100).toFixed(1) + '%';
    if (t) t.textContent = GAME.paused ? 'paused' : `about ${Math.max(1, Math.ceil((J.need - J.t) / benchSpeed() / Math.max(1, GAME.speed)))} s`;
  }
}

// ---- the bench's panel
const BENCH_TABS = [['salvage', 'Salvage'], ['retune', 'Retune'], ['overhaul', 'Overhaul'], ['cells', 'Cells'], ['attune', 'Attune'], ['assay', 'Assay'], ['craft', 'Blueprints']];
UI.benchSel = { tab: 'overhaul', uid: null, trait: null, sock: null, pick: new Set() };
const starStr = n => '★'.repeat(n) + '<i>' + '★'.repeat(5 - n) + '</i>';
function cellIcon(id, size = 36) {
  const src = ART.items && ART.items['cell-' + id]; if (src) { const im = new Image(); im.src = src; im.alt = ''; im.className = 'cicon ipic'; im.width = im.height = size; return im; }   // a painted one (art request 04)
  const C = D.CELLS[id]; const c = iconCanvas('cellGem', { aspect: 'cell-' + id, rarity: 'tuned', size: 64 }, D.RARITY, { ['cell-' + id]: { color: C.color } }); c.style.width = c.style.height = size + 'px'; c.className = 'cicon'; return c; }
const cellText = (id, it) => { const C = D.CELLS[id], show = e => Object.entries(e).map(([k, v]) => k === 'extra' ? Object.entries(v).map(([a, n]) => `+${n}% damage as ${D.ASPECTS[a].name}`).join(', ') : k === 'resist' ? Object.entries(v).map(([a, n]) => `resist ${D.ASPECTS[a].name} ${n}%`).join(', ') : k === 'vsWild' ? `+${v}% damage to Wildlight` : k === 'stealth' ? 'Wildlight often miss the wearer' : k === 'guard' ? `+${v}% guard` : k === 'nerve' ? `+${v} nerve` : k === 'S' ? `+${v} Sowing` : '').join(', ');
  return it ? show(isWeaponItem(it) ? C.hand : C.other) : `In a weapon: ${show(C.hand)}. In anything else: ${show(C.other)}.`; };
UI.bench = function (body, ref) {
  // a ref picks the tab (and the piece) once; after that the panel remembers where you are
  const S = UI.benchSel; if (ref && ref.tab) { S.tab = ref.tab; if (ref.uid !== undefined) { S.uid = ref.uid; S.trait = null; S.sock = null; } ref.tab = null; ref.uid = undefined; }
  const shop = benchShop(), hand = benchHand(), sk = benchSkill(), J = GAME.bench.job;
  body.append(this.h(`<h2>Odile's bench</h2><p class="sub">${shop ? `At the ${esc(shop.name || shop.def.name)}.` : 'In the Lens Workshop, once it’s built.'} Break down what you don't need, retune, overhaul, fit cells, attune, and make things from blueprints.</p>`));
  // who works it
  const who = document.createElement('div'); who.className = 'bench-who';
  if (hand) { who.append(faceOf(hand)); who.append(this.h(`<span><b>${esc(hand.d.name)}</b> works the bench · Engineering ${sk}<br><span class="small">${esc(handWords(sk))}</span></span>`)); }
  else { who.append(this.h(`<span class="small">Nobody is working the bench. Give the Lens Workshop a cutter (Odile is best); until then you work it yourself, slowly, and the high overhauls fail more often.</span>`)); if (shop) { const bt = this.h(`<button type="button" class="btn">Choose a cutter</button>`); bt.querySelector('button').onclick = () => UI.open('pick', shop); who.append(bt); } }
  body.append(who);
  // what's in the box
  const m = GAME.mats, cells = Object.entries(GAME.cells).filter(([, n]) => n > 0);
  body.append(this.h(`<div class="mats bench-mats">${Object.entries(D.MATERIALS).map(([k, x]) => `<span class="chip mat" style="--mc:${x.color}" title="${esc(x.text)}"><i></i>${esc(x.name)} <b>${m[k] || 0}</b></span>`).join('')}<span class="chip">${SHARD} <b>${Math.floor(GAME.shards)}</b></span>${cells.map(([k, n]) => `<span class="chip mat" style="--mc:${D.CELLS[k].color}"><i></i>${esc(D.CELLS[k].name)} <b>${n}</b></span>`).join('')}</div>`));
  // the job on the bench
  if (J) body.append(this.h(`<div class="bench-job"><p><b>${esc(J.label)}</b> · <span id="bench-left">about ${Math.max(1, Math.ceil((J.need - J.t) / benchSpeed()))} s</span></p><div class="hp bench-hp" role="progressbar" aria-label="${esc(J.label)}"><i id="bench-bar" style="width:${Math.min(100, J.t / J.need * 100)}%"></i></div></div>`));
  // a retune waiting on you
  const C = GAME.bench.choice;
  if (C) {
    const x = findItem(C.uid);
    if (!x) GAME.bench.choice = null;
    else {
      const it = x.it, nt = C.after.traits[C.index], R = rarityOf(it);
      const card = this.h(`<div class="bench-choice"><p><b style="color:${R.color}">${esc(it.name)}</b>: keep the new trait, or put the old one back?</p>
        <div class="tr-cmp"><div class="old"><span class="small">Now</span><b>${esc(LOOT.traitText(C.before))}</b><span class="stars">${starStr(LOOT.traitStars(C.before, it.rarity, it.ilvl))}</span></div><span class="arrow">→</span>
        <div class="new"><span class="small">New roll</span><b>${esc(LOOT.traitText(nt))}</b><span class="stars">${starStr(LOOT.traitStars(nt, it.rarity, it.ilvl))}</span></div></div>
        <div class="stats-row"><button type="button" class="btn primary">Keep the new one</button><button type="button" class="btn">Put the old one back</button></div></div>`);
      const [k, r] = card.querySelectorAll('button'); k.onclick = () => benchChoose(true); r.onclick = () => benchChoose(false);
      body.append(card);
    }
  }
  // the tabs
  const tabs = this.h(`<div class="tabs bench-tabs" role="group" aria-label="At the bench">${BENCH_TABS.map(([k, n]) => `<button type="button" data-t="${k}" aria-pressed="${S.tab === k}">${n}</button>`).join('')}</div>`);
  for (const bt of tabs.querySelectorAll('button')) bt.onclick = () => { S.tab = bt.dataset.t; S.trait = null; S.sock = null; UI.refresh(); };
  body.append(tabs);
  const pane = document.createElement('div'); pane.className = 'bench-pane'; body.append(pane);
  ({ salvage: benchSalvagePane, retune: benchRetunePane, overhaul: benchOverhaulPane, cells: benchCellsPane, attune: benchAttunePane, assay: benchAssayPane, craft: benchCraftPane })[S.tab].call(this, pane);
  if (shop) this.back(body, `Back to the ${shop.name || shop.def.name}`, () => UI.open('building', shop));
};
// a list of pieces to choose from, for the one-piece tabs
function benchPicker(ui, pane, list, side, empty) {
  const S = UI.benchSel;
  if (!list.length) { pane.append(ui.h(`<p class="small">${esc(empty)}</p>`)); return null; }
  const cur = list.find(x => x.it.uid === S.uid);
  if (cur) {
    const row = ui.itemRow(cur.it, 'Choose another', () => { S.uid = null; S.trait = null; S.sock = null; UI.refresh(); });
    row.classList.add('sel'); row.querySelector('.jb').textContent = `${rarityOf(cur.it).name} · ${whereText(cur)}`;
    pane.append(row);
    return cur.it;
  }
  pane.append(ui.h(`<p class="small">Choose a piece.</p>`));
  const l = document.createElement('div'); l.className = 'list';
  for (const x of list) { const row = ui.itemRow(x.it, side(x.it), () => { S.uid = x.it.uid; S.trait = null; S.sock = null; UI.refresh(); }); row.querySelector('.jb').textContent = `${rarityOf(x.it).name} · ${whereText(x)}`; if (onBench(x.it)) row.classList.add('dim'); l.append(row); }
  pane.append(l);
  return null;
}
const sortBest = list => list.sort((a, b) => LOOT.rankOf(b.it.rarity) - LOOT.rankOf(a.it.rarity) || (b.it.overhaul || 0) - (a.it.overhaul || 0) || (b.it.ilvl || 0) - (a.it.ilvl || 0));
function benchSalvagePane(pane) {
  const S = UI.benchSel, ui = this;
  const list = GAME.stash.filter(it => canSalvage(it) && !onBench(it)).sort((a, b) => LOOT.rankOf(a.rarity) - LOOT.rankOf(b.rarity) || (a.ilvl || 0) - (b.ilvl || 0));
  for (const it of [...S.pick]) if (!list.includes(it)) S.pick.delete(it);
  pane.append(this.h(`<p class="small">Break down pieces from the stash into materials for the bench: Brass Scrap from the plain grades, Cut Glass from the better ones, Heartstone from Signed pieces. Cells come back out. Masterworks and other named pieces can't be broken down. Worn and fitted pieces aren't listed.</p>`));
  const quick = document.createElement('div'); quick.className = 'stats-row';
  for (const r of ['salvage', 'tooled', 'tuned']) {
    const n = list.filter(it => it.rarity === r && !(it.overhaul > 0) && !(it.cells || []).some(Boolean)).length; if (!n) continue;
    const b = this.h(`<button type="button" class="btn">All ${esc(D.RARITY[r].name)}-grade · ${n}</button>`); b.querySelector('button').onclick = () => { for (const it of list) if (it.rarity === r && !(it.overhaul > 0) && !(it.cells || []).some(Boolean)) S.pick.add(it); UI.refresh(); }; quick.append(b);
  }
  if (S.pick.size) { const b = this.h(`<button type="button" class="btn">Clear</button>`); b.querySelector('button').onclick = () => { S.pick.clear(); UI.refresh(); }; quick.append(b); }
  if (quick.children.length) pane.append(quick);
  const y = {}; for (const it of S.pick) for (const [k, n] of Object.entries(salvageYield(it))) y[k] = (y[k] || 0) + n;
  const go = this.h(`<div class="bench-go"><button type="button" class="btn primary" ${S.pick.size && !GAME.bench.job ? '' : 'disabled'}>Salvage ${S.pick.size || ''} piece${S.pick.size === 1 ? '' : 's'}</button><span class="small">${S.pick.size ? `Gives ${esc(matLine(y))}` : 'Tap pieces to choose them.'}</span></div>`);
  go.querySelector('button').onclick = () => { if (benchSalvage([...S.pick])) S.pick.clear(); UI.refresh(); };
  pane.append(go);
  const l = document.createElement('div'); l.className = 'list';
  for (const it of list) {
    const on = S.pick.has(it), row = this.itemRow(it, on ? '✓ Chosen' : `+${matLine(salvageYield(it))}`, () => { on ? S.pick.delete(it) : S.pick.add(it); UI.refresh(); });
    row.classList.toggle('picked', on); row.setAttribute('aria-pressed', on);
    if (it.overhaul || (it.cells || []).some(Boolean)) row.querySelector('.jb').textContent += it.overhaul ? ` · +${it.overhaul}` : ' · has a cell';
    l.append(row);
  }
  if (!list.length) l.append(this.h(`<p class="small">Nothing in the stash to break down.</p>`));
  pane.append(l);
  void ui;
}
function benchOverhaulPane(pane) {
  const S = UI.benchSel;
  const list = sortBest(allItems().filter(x => x.where !== 'bench' && canOverhaul(x.it)));
  const it = benchPicker(this, pane, list, it => `+${it.overhaul || 0} → +${(it.overhaul || 0) + 1}`, 'Nothing to overhaul.');
  if (!it) { pane.prepend(this.h(`<p class="small">Each overhaul step adds 4% to a piece's own numbers: a weapon's damage, a coat's guard, a tool's output, a module's effect. +1 to +3 cost only shards; +4 to +6 need Cut Glass; +7 to +10 need Heartstone. From +6 a step can fail: the materials are lost and half the shards come back.</p>`)); return; }
  const c = overhaulCost(it), to = (it.overhaul || 0) + 1, fail = overhaulFail(it);
  const after = { ...it, overhaul: to };
  pane.append(this.h(`<div class="oh-pips" aria-label="Overhaul ${it.overhaul || 0} of 10">${Array.from({ length: 10 }, (_, i) => `<i class="${i < (it.overhaul || 0) ? 'on' : i === to - 1 ? 'next' : ''}"></i>`).join('')}<span>+${it.overhaul || 0}</span></div>`));
  pane.append(numbersCompare(this, itemNumbers(it), itemNumbers(after), `+${it.overhaul || 0}`, `+${to}`));
  const cant = !canPay(c);
  const go = this.h(`<div class="bench-go"><button type="button" class="btn primary" ${cant || GAME.bench.job ? 'disabled' : ''}>Overhaul to +${to} · ${costText(c)}</button>
    <span class="small">${fail > 0 ? `<b class="${fail > 0.25 ? 'risk' : ''}">${Math.round(fail * 100)}% chance it fails</b> · ` : 'It can’t fail. '}About ${Math.ceil(jobTime(WS.overhaul.time[to - 1]))} s at the bench.${cant ? ` Needs ${esc(shortOf(c))}.` : ''}</span></div>`);
  go.querySelector('button').onclick = () => { benchOverhaul(it); UI.refresh(); };
  pane.append(go);
  void S;
}
function benchRetunePane(pane) {
  const S = UI.benchSel;
  const list = sortBest(allItems().filter(x => x.where !== 'bench' && canRetune(x.it)));
  const it = benchPicker(this, pane, list, it => `${it.traits.length} trait${it.traits.length > 1 ? 's' : ''}`, 'Nothing to retune. Tooled, Tuned, Calibrated and Signed pieces have traits to retune.');
  if (!it) { pane.prepend(this.h(`<p class="small">Roll one trait again and keep the rest. You see the new roll before you decide: keep it, or put the old one back. Each retune of the same piece costs more.</p>`)); return; }
  pane.append(this.h(`<p class="small">Choose the trait to roll again.</p>`));
  const l = document.createElement('div'); l.className = 'list';
  it.traits.forEach((t, i) => {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'li trait-li' + (S.trait === i ? ' sel' : ''); el.setAttribute('aria-pressed', S.trait === i);
    el.append(this.h(`<span><span class="nm">${esc(LOOT.traitText(t))}</span><span class="jb">${esc((D.AFFIXES[t.id] || D.MODULE_AFFIXES[t.id] || {}).name || '')}</span></span><span class="stars">${starStr(LOOT.traitStars(t, it.rarity, it.ilvl))}</span>`));
    el.onclick = () => { S.trait = i; UI.refresh(); };
    l.append(el);
  });
  pane.append(l);
  const c = retuneCost(it), cant = !canPay(c);
  const go = this.h(`<div class="bench-go"><button type="button" class="btn primary" ${S.trait == null || cant || GAME.bench.job || GAME.bench.choice ? 'disabled' : ''}>Retune this trait · ${costText(c)}</button><span class="small">${S.trait == null ? 'Tap a trait above.' : `About ${Math.ceil(jobTime(WS.retune.time))} s.`}${it.retunes ? ` Retuned ${it.retunes} time${it.retunes > 1 ? 's' : ''} before.` : ''}${cant ? ` Needs ${esc(shortOf(c))}.` : ''}</span></div>`);
  go.querySelector('button').onclick = () => { benchRetune(it, S.trait); UI.refresh(); };
  pane.append(go);
}
function benchCellsPane(pane) {
  const S = UI.benchSel;
  const list = sortBest(allItems().filter(x => x.where !== 'bench' && sockets(x.it) > 0));
  const it = benchPicker(this, pane, list, it => `${(it.cells || []).filter(Boolean).length} of ${sockets(it)} sockets`, 'Nothing with a cell socket yet. Calibrated and Signed pieces have one; Masterworks have two; Sunforged relics three.');
  if (!it) { pane.prepend(this.h(`<p class="small">Sunstone cells set into a socket. Each does one thing in a weapon and another in anything else. Fitting one costs ${WS.socket} shards; taking one out is free, and it goes back in the box.</p>`)); return; }
  const n = sockets(it), box = document.createElement('div'); box.className = 'sockets cells-row';
  for (let i = 0; i < n; i++) {
    const c = (it.cells || [])[i], el = document.createElement('button'); el.type = 'button'; el.className = 'sock ' + (c ? 'full' : 'empty') + (S.sock === i ? ' sel' : '');
    if (c) { el.style.setProperty('--rc', D.CELLS[c].color); el.append(cellIcon(c, 40)); el.append(this.h(`<span class="sn" style="color:${D.CELLS[c].color}">${esc(D.CELLS[c].name)}</span><span class="se">${esc(cellText(c, it))}</span>`)); }
    else el.append(this.h(`<span class="plus">+</span><span>Empty socket</span>`));
    el.onclick = () => { S.sock = i; UI.refresh(); };
    box.append(el);
  }
  pane.append(box);
  if (S.sock == null || S.sock >= n) { pane.append(this.h(`<p class="small">Tap a socket.</p>`)); return; }
  const cur = (it.cells || [])[S.sock];
  if (cur) { const b = this.h(`<div class="stats-row"><button type="button" class="btn" ${onBench(it) ? 'disabled' : ''}>Take the ${esc(D.CELLS[cur].name)} out</button></div>`); b.querySelector('button').onclick = () => { benchUncell(it, S.sock); UI.refresh(); }; pane.append(b); }
  const have = Object.keys(D.CELLS).filter(k => GAME.cells[k] > 0);
  pane.append(this.h(`<h3>${cur ? 'Or swap it for' : 'Set a cell'} · ${WS.socket} shards</h3>`));
  const l = document.createElement('div'); l.className = 'list';
  for (const k of have) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'irow'; el.disabled = !!GAME.bench.job || k === cur;
    el.append(cellIcon(k, 40));
    el.append(this.h(`<span><span class="nm" style="color:${D.CELLS[k].color}">${esc(D.CELLS[k].name)} <em class="small">×${GAME.cells[k]}</em></span><span class="jb">${esc(cellText(k, it))}</span></span><span class="side">${k === cur ? 'Fitted' : 'Set it'}</span>`));
    el.onclick = () => { benchCell(it, S.sock, k); UI.refresh(); };
    l.append(el);
  }
  if (!have.length) l.append(this.h(`<p class="small">No cells in the box. The miners find them in the rock, and the courier at the mast sells one each morning.</p>`));
  pane.append(l);
}
function benchAttunePane(pane) {
  const list = allItems().filter(x => x.where !== 'bench' && x.it.type === 'relic' && x.it.rarity === 'masterwork');
  const it = benchPicker(this, pane, list, it => it.attuned ? D.ATTUNE[it.attuned].name : 'Not yet', 'No Masterworks yet. They come from Lodestars and Brightmaws, the deep seam, the wreck fields, raids, and gifts from the founders.');
  if (!it) { pane.prepend(this.h(`<p class="small">A Masterwork can be attuned once, one of two ways: to the sun, for the working day and the jumpers who raid by day, or to the moon, for the night watch and the Wildlight. It takes Heartstone.</p>`)); return; }
  if (it.attuned) { pane.append(this.h(`<p>Already <b>${esc(D.ATTUNE[it.attuned].name)}</b>. ${esc(D.ATTUNE[it.attuned].text)}</p>`)); return; }
  const c = attuneCost(), cant = !canPay(c), hand = isWeaponItem(it), fitted = isModuleItem(it);
  const box = document.createElement('div'); box.className = 'attune';
  for (const [k, A] of Object.entries(D.ATTUNE)) {
    const e = fitted ? `Its whole effect ${Math.round((A.fitted - 1) * 100)}% stronger${A.nightOnly ? ' at night' : ''}` : statWords(hand ? A.hand : A.other);
    const card = this.h(`<div class="att att-${k}"><b>${esc(A.name)}</b><p class="small">${esc(A.text)}</p><p>${esc(e)}</p><button type="button" class="btn primary" ${cant || GAME.bench.job ? 'disabled' : ''}>Attune · ${costText(c)}</button></div>`);
    card.querySelector('button').onclick = () => { benchAttune(it, k); UI.refresh(); };
    box.append(card);
  }
  pane.append(box);
  if (cant) pane.append(this.h(`<p class="small">Needs ${esc(shortOf(c))}. Heartstone comes from Signed pieces broken down, the deep seam, the wreck fields and the bigger raids.</p>`));
}
function benchAssayPane(pane) {
  const list = allItems().filter(x => x.it.unassayed);
  const scale = Math.round(modV(TOWN.b.keep, 'assay'));
  pane.append(this.h(`<p class="small">Signed pieces come with a maker's mark nobody has read. Absalom Pockett reads them at the Keep for ${WS.assay} shards, and then the piece's power works.${scale ? ` The Keep's Assay Scale reads ${scale} each morning for nothing.` : ' An Assay Scale fitted to the Keep would read one each morning for nothing.'}</p>`));
  const l = document.createElement('div'); l.className = 'list';
  for (const x of list) { const row = this.itemRow(x.it, `Assay · ${WS.assay}`, () => { benchAssay(x.it); UI.refresh(); }); row.querySelector('.jb').textContent = `Signed · ${whereText(x)}`; l.append(row); }
  if (!list.length) l.append(this.h(`<p class="small">Nothing waiting to be read.</p>`));
  pane.append(l);
}
function benchCraftPane(pane) {
  const odds = craftOdds();
  pane.append(this.h(`<p class="small">Blueprints come with drops and out of the mine. Odile can make the base item of any she has, at a grade that depends on the bench hand's Engineering. Her odds now: ${odds.filter(([, p]) => p > 0).map(([r, p]) => `<b style="color:${D.RARITY[r].color}">${D.RARITY[r].name} ${p}%</b>`).join(' · ')}.</p>`));
  const l = document.createElement('div'); l.className = 'list';
  for (const base of GAME.blueprints) {
    const B = D.ITEMS[base]; if (!B) continue;
    const c = craftCost(base), cant = !canPay(c), el = document.createElement('div'); el.className = 'irow craft';
    el.append(itemPicture({ base, kind: B.kind, rarity: 'tooled', type: 'gear' }, 40));
    el.append(this.h(`<span><span class="nm">${esc(B.name)}</span><span class="jb">${esc(D.SLOTS[B.slot].name)} · item level ${craftIlvl(base)} · ${costText(c)}</span></span>`));
    const bt = this.h(`<button type="button" class="btn" ${cant || GAME.bench.job ? 'disabled' : ''}>Make one</button>`); bt.querySelector('button').onclick = () => { benchCraft(base); UI.refresh(); };
    el.append(bt); l.append(el);
  }
  if (!GAME.blueprints.length) l.append(this.h(`<p class="small">No blueprints yet. Some drops teach the blueprint of what they are, and the miners turn them up in the spoil.</p>`));
  pane.append(l);
}
// a line for the workshop's own panel: the bench, and what it's doing
UI.benchLink = function (body, b) {
  const J = GAME.bench.job, hand = benchHand();
  const r = this.h(`<div class="upgrade bench-link"><p><b>Odile's bench.</b> ${J ? esc(J.label) + '…' : hand ? `${esc(hand.d.name.split(' ')[0])} is at the bench (Engineering ${statOf(hand, 'E')}).` : 'Nobody at the bench.'}${GAME.bench.choice ? ' A retune is waiting on you.' : ''}</p><button type="button" class="btn primary">Open the bench</button></div>`);
  r.querySelector('button').onclick = () => UI.open('bench', {});
  body.append(r);
};

// ---- saving: the bench and the fittings, together
function workshopSave() { return { bench: { job: GAME.bench.job, choice: GAME.bench.choice }, ...fitSave() }; }
function workshopLoad(s) {
  if (s && s.bench) GAME.bench = { job: s.bench.job || null, choice: s.bench.choice || null };
  fitLoad(s);
}
