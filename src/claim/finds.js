// ===================================================================== FINDS: how loot reads and how it feels
// A rare find (Signed and better) gets a moment: a beam of its rarity's colour where it dropped, and a toast with its
// picture you can tap. The item panel shows a piece large: its picture, every number, its traits with stars, its
// cells, its overhaul, its maker's mark, what it's best for (which job; Wildlight or claim-jumpers, by its aspect),
// and a side-by-side against what someone wears now, green for better and red for worse. The stash sorts and
// filters, with modules and Lark parts under their own headings, and a person's card suggests the best kit in the
// stash for their job.

// ----------------------------------------------------------------- the moment
const LOOTFX = { beams: [], geo: null, tex: null };
function lootMoment(it, pos, line) {
  if (QUIET) return;
  if (pos && VIEW.mode === 'town' && !(typeof SKY !== 'undefined' && SKY && SKY.on)) lootBeam(pos, rarityOf(it).color, LOOT.rankOf(it.rarity));
  rareToast(it, line);
}
function lootBeam(pos, color, rank) {
  if (!LOOTFX.geo) {
    LOOTFX.geo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0);
    const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(120,120,120,1)'); gr.addColorStop(0.92, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128); LOOTFX.tex = canvasTex(c, { srgb: false });
  }
  const col = new THREE.Color(color), group = new THREE.Group(); group.position.copy(pos);
  const big = rank >= 5 ? 1.35 : 1;
  for (const [r, h, op] of [[0.32, 44, 1], [1.0, 34, 0.45], [2.2, 14, 0.22]]) {
    const m = new THREE.Mesh(LOOTFX.geo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.2), map: LOOTFX.tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.scale.set(r * big, h * big, r * big); m.userData.op = op; m.renderOrder = 6; group.add(m);
  }
  const ring = new THREE.Mesh(RING_G.line, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ring.position.y = 0.15; ring.userData.op = 0.9; ring.userData.ring = true; group.add(ring);
  scene.add(group);
  LOOTFX.beams.push({ g: group, t: 0, dur: 4.5, col: col.getHex(), pos: pos.clone() });
  FX.sparks(pos.clone().setY(pos.y + 0.6), 36, col.getHex(), 4.5);
}
function lootFxUpdate(rdt) {
  for (let i = LOOTFX.beams.length - 1; i >= 0; i--) {
    const B = LOOTFX.beams[i]; B.t += rdt; const k = B.t / B.dur, a = k < 0.08 ? k / 0.08 : Math.max(0, 1 - (k - 0.08) / 0.92);
    for (const m of B.g.children) {
      if (m.userData.ring) { const r = 1 + k * 7; m.scale.set(r, 1, r); m.material.opacity = m.userData.op * a * (1 - k); }
      else { m.material.opacity = m.userData.op * a * (0.85 + 0.15 * Math.sin(B.t * 9)); m.rotation.y += rdt * 0.6; }
    }
    if (Math.random() < rdt * 14 * a) FX.mote(B.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 6, (Math.random() - 0.5) * 1.6)), B.col);
    if (B.t >= B.dur) { scene.remove(B.g); for (const m of B.g.children) m.material.dispose(); LOOTFX.beams.splice(i, 1); }
  }
}
function rareToast(it, line) {
  const R = rarityOf(it), el = document.createElement('button');
  el.type = 'button'; el.className = 'toast rare'; el.style.setProperty('--rc', R.color);
  el.append(itemPicture(it, 52));
  el.append(UI.h(`<span class="rt"><em>${esc(line || (LOOT.rankOf(it.rarity) >= 5 ? 'Something remarkable' : 'A rare find'))}</em><b style="color:${R.color}">${esc(it.name)}</b><span>${esc(R.name)} ${esc(D.SLOTS[it.slot]?.name || '')} · tap to look</span></span>`));
  el.onclick = () => { UI.open('item', { it }); el.remove(); };
  toast('', 'rare', { el, ms: 7500 });   // it takes its turn with the other toasts (ui.js)
}

// ----------------------------------------------------------------- an item's numbers, as rows that can be compared
const JOB_OF = { hall: 'keep' };
// who a job's people are, and where they work, in words
const JOB_FOLK = { keep: 'clerks', head: 'miners', yard: 'tenders', shop: 'lens cutters', garden: 'gardeners', lens: 'lens gunners', wall: 'the watch', mast: 'the Lark’s crew' };
const JOB_AT = { keep: 'as a clerk', head: 'in the mine', yard: 'in the yards', shop: 'at the Lens Workshop', garden: 'in the greenhouse', lens: 'on the lens towers', wall: 'on the watch', mast: 'on the Lark' };
const jobTitle = j => { const t = JOB_OF[j] || j; return JOB_FOLK[t] || (DEFS[t] && DEFS[t].job ? DEFS[t].job.title.toLowerCase() : t); };
const jobAt = j => JOB_AT[JOB_OF[j] || j] || 'at work';
const listWords = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
const STAT_WORDS = { G: v => `+${v} Grit`, E: v => `+${v} Engineering`, A: v => `+${v} Agility`, R: v => `+${v} Rapport`, S: v => `+${v} Sowing`, allStats: v => `+${v} to every stat`,
  guard: v => `+${v}% guard`, hp: v => `+${v} health`, out: v => `+${v}% output at its job`, night: v => `+${v}% work after dark`, nerve: v => `+${v} nerve`,
  vsWild: v => `+${v}% damage to Wildlight`, vsJumper: v => `+${v}% damage to claim-jumpers`, speed: v => `${v > 0 ? '+' : ''}${v}% move speed`, upkeep: v => `eats ${v}% less` };
const statWords = e => Object.entries(e || {}).map(([k, v]) => STAT_WORDS[k] ? STAT_WORDS[k](v) : '').filter(Boolean).join(', ');
// the stat a weapon would be swung with: the person's own if given, else a fair hand (7)
const wStat = (it, v) => { const w = itemWeapon(it); return v ? statOf(v, w.stat) : 7; };
function itemDps(it, foe, v) {
  const s = itemStats(it), d = dpsOf(it, wStat(it, v), foe);
  return d * (1 + ((WILD_FOES.has(foe) ? s.vsWild : JUMPER_FOES.has(foe) ? s.vsJumper : 0) || 0) / 100);
}
// a module's main number, by what it does: [label, unit]
const MOD_LABEL = { recruit: ['Settler arrivals', '%'], assay: ['Signed pieces read each morning', ''], tradeCut: ['Off the courier’s prices', '%'], ore: ['More ore', '%'], warn: ['Longer up the shaft', ' s'],
  findLuck: ['Luck on mine finds', ''], deepSafe: ['Fewer Wildlight from the seam', '%'], charge: ['Charge rate', '%'], dawnDusk: ['Charge in the low sun', '%'], thinLight: ['Charges under cloud at', '%'],
  store: ['Shards held in reserve', ''], cut: ['More shards from every tray', '%'], retuneCost: ['Off retuning', '%'], overhaulCost: ['Off overhauls', '%'], food: ['More food', '%'], nightFood: ['Grows through the night at', '%'],
  rest: ['Harder work in the morning', '%'], study: ['Faster study', '%'], muster: ['The watch, when the wall is breached', '%'], range: ['Beam range', '%'], rate: ['Beam rate', '%'], split: ['More targets for each beam', ''],
  shardCost: ['Fewer shards a beam', '%'], climbDmg: ['Damage a second to climbers', ''], dazzle: ['Chance a climber falls', '%'], wallHp: ['Wall strength', '%'], turret: ['Damage a bolt, every 2 s', ''],
  flares: ['More flares a volley', ''], shipSpeed: ['Airspeed', '%'], shipGuard: ['Hull guard', '%'], aim: ['Faster volleys', '%'], board: ['Boards downed jumpers', ''], lightRadius: ['The Keep’s lamps light farther', '%'] };
function itemNumbers(it, v) {
  const rows = [], add = (key, label, val, unit = '', o = {}) => rows.push({ key, label, val, unit, ...o });
  if (isModuleItem(it)) {
    const d = moduleDef(it), lab = k => MOD_LABEL[k] || [k, ''];
    if (it.type === 'relic') for (const [k, val] of Object.entries(D.RELICS[it.base].stats || {})) add(k, lab(k)[0], val * ohK(it) * attuneK(it), lab(k)[1]);
    else add(d.stat, lab(d.stat)[0], modValue(it), lab(d.stat)[1], { float: d.float });
    return rows;
  }
  const w = itemWeapon(it), s = itemStats(it), { relic } = itemBase(it);
  if (w) {
    let hit = w.dmg * rarityOf(it).statMult * ohK(it); if (relic && relic.stats && relic.stats.dmg) hit *= 1 + relic.stats.dmg / 100;
    add('hit', 'Damage a hit', hit, '', { dec: 1 });
    add('dpsW', 'A second, against Wildlight', itemDps(it, 'flarehound', v), '', { dec: 1, note: v ? `at ${v.d.name.split(' ')[0]}'s ${STAT_NAMES[w.stat]}` : `at ${STAT_NAMES[w.stat]} 7` });
    add('dpsJ', 'A second, against claim-jumpers', itemDps(it, 'jumper', v), '', { dec: 1 });
    add('reach', 'Reach', w.range, ' m', { dec: 1 });
  }
  if (s.guard) add('guard', 'Guard', s.guard, '%');
  if (s.hp) add('hp', 'Health', s.hp);
  if (s.out) add('out', s.outJob ? `Output ${jobAt(s.outJob)}` : 'Output at any job', s.out, '%');
  for (const k of 'GEARS') if (s[k]) add(k, STAT_NAMES[k], s[k]);
  if (s.night) add('night', 'Work after dark', s.night, '%');
  if (s.speed) add('speed', 'Move speed', s.speed, '%');
  if (s.findLuck) add('luck', 'Luck on finds', s.findLuck, '', { dec: 2 });
  if (s.upkeep) add('upkeep', 'Eats less', s.upkeep, '%');
  if (s.nerve) add('nerve', 'Nerve', s.nerve);
  if (s.repair) add('repair', 'Repair speed', s.repair, '%');
  if (!w && s.vsWild) add('vsWild', 'Damage to Wildlight', s.vsWild, '%');
  if (!w && s.vsJumper) add('vsJumper', 'Damage to claim-jumpers', s.vsJumper, '%');
  return rows;
}
const fmtRow = (r, val = r.val) => `${r.dec ? (Math.round(val * 10 ** r.dec) / 10 ** r.dec).toFixed(r.dec === 2 ? 2 : 1).replace(/\.0$/, '') : r.float ? (Math.round(val * 100) / 100) : Math.round(val)}${r.unit}`;
// two sets of rows side by side, with the change in green or red
function numbersCompare(ui, A, B, la, lb) {
  const keys = [...new Set([...A.map(r => r.key), ...B.map(r => r.key)])];
  const t = document.createElement('div'); t.className = 'cmp';
  t.append(ui.h(`<div class="cmp-h"><span></span><span>${esc(la)}</span><span>${esc(lb)}</span><span></span></div>`));
  for (const k of keys) {
    const a = A.find(r => r.key === k), b = B.find(r => r.key === k), r = a || b, va = a ? a.val : 0, vb = b ? b.val : 0, d = vb - va;
    const better = d > 0, tiny = Math.abs(d) < (r.dec === 2 ? 0.005 : r.dec ? 0.05 : r.float ? 0.005 : 0.5);
    t.append(ui.h(`<div class="cmp-r"><span class="cl">${esc(r.label)}</span><span>${a ? fmtRow(a) : '—'}</span><span>${b ? fmtRow(b) : '—'}</span><span class="cd ${tiny ? '' : better ? 'up' : 'down'}">${tiny ? '' : (d > 0 ? '+' : '−') + fmtRow({ ...r, unit: r.unit }, Math.abs(d))}</span></div>`));
  }
  return t;
}
// what a piece is best for: which job, and which fight
function bestFor(it) {
  const out = [];
  if (isModuleItem(it)) { out.push(`Fits ${homeOf(it)}`); return out; }
  const { base } = itemBase(it), s = itemStats(it), w = itemWeapon(it);
  const jobs = new Set(); if (s.outJob) jobs.add(s.outJob); for (const j of (base && base.jobs) || []) jobs.add(JOB_OF[j] || j);
  if (jobs.size) out.push(`For ${listWords([...jobs].map(jobTitle))}${s.out && s.outJob ? ` (+${s.out}% ${jobAt(s.outJob)})` : ''}`);
  const st = [...'GEARS'].filter(k => s[k] > 0).sort((a, b) => s[b] - s[a]);
  if (st.length && !jobs.size) { const k = st[0]; out.push(`Good for ${STAT_NAMES[k]} work: ${{ G: 'miners and the watch', E: 'cutters and menders', A: 'lens crews and the Lark', R: 'clerks', S: 'tenders and gardeners' }[k]}`); }
  if (w) {
    const dw = itemDps(it, 'flarehound'), dj = itemDps(it, 'jumper'), asp = D.ASPECTS[it.aspect || w.aspect];
    const fight = dw > dj * 1.12 ? 'Best against Wildlight' : dj > dw * 1.12 ? 'Best against claim-jumpers' : 'Good against Wildlight and jumpers alike';
    out.push(`${fight}${asp ? ` · ${asp.name}: ${asp.text.replace(/\.$/, '')}` : ''}${w.range > 3 ? ' · shoots from reach' : ''}`);
  } else if (s.vsWild || s.night) out.push('For the night watch');
  if (s.findLuck) out.push('For miners and expeditions: better finds');
  if (s.guard >= 6 || s.hp >= 6) out.push('For the wilds: it turns a blow');
  return out;
}

// ----------------------------------------------------------------- a person's numbers with and without a piece
// as Villager.eff (people.js) works it out, at work and well fed, by day: rooms down the dig count as the mine
function jobEff(v, b = v.jobB) {
  if (!b || !b.def || !b.def.job) return 0;
  const J = b.def.job;
  let e = J.stat2 ? (statOf(v, J.stat) + statOf(v, J.stat2)) / 20 : statOf(v, J.stat) / 10;
  if (v.d.trait === 'Steady') e *= 1.1;
  e *= 1 + outFor(gearOf(v), b.gearJob || b.type) / 100;
  if (mastered(v, J.stat)) e *= 1.2;
  return e;
}
function personNums(v) {
  const g = gearOf(v), b = v.jobB, rows = [];
  rows.push({ key: 'dpsW', label: 'A second vs Wildlight', val: fightOf(v, 'flarehound').dps, unit: '', dec: 1 });
  rows.push({ key: 'dpsJ', label: 'A second vs jumpers', val: fightOf(v, 'jumper').dps, unit: '', dec: 1 });
  rows.push({ key: 'hp', label: 'Health', val: maxHpOf(v), unit: '' });
  rows.push({ key: 'guard', label: 'Guard', val: g.guard, unit: '%' });
  for (const k of 'GEARS') rows.push({ key: k, label: STAT_NAMES[k], val: statOf(v, k), unit: '' });
  if (b && b !== WALLB) rows.push({ key: 'work', label: `Work as ${aJob(b.def.job.title)}`, val: jobEff(v) * 100, unit: '%' });
  if (g.speed) rows.push({ key: 'speed', label: 'Move speed', val: g.speed, unit: '%' });
  if (g.findLuck) rows.push({ key: 'luck', label: 'Luck on finds', val: g.findLuck, unit: '', dec: 2 });
  return rows;
}
function withItem(v, it, fn) {
  const slot = it.slot, old = v.d.gear[slot];
  v.d.gear[slot] = it; v.gearCache = null;
  try { return fn(); } finally { if (old) v.d.gear[slot] = old; else delete v.d.gear[slot]; v.gearCache = null; }
}
const wornBy = it => GAME.villagers.find(v => GEAR_SLOTS.some(s => v.d.gear[s] === it)) || null;

// ----------------------------------------------------------------- the item panel
UI.item = function (body, { it, back }) {
  const R = rarityOf(it), { relic, base } = itemBase(it), x = findItem(it.uid), mod = isModuleItem(it);
  const top = document.createElement('div'); top.className = 'ihead big'; top.style.setProperty('--rc', R.color); top.append(itemPicture(it, 128));
  top.append(this.h(`<div><p class="eyebrow" style="color:${R.color}">${esc(R.name)} ${esc(D.SLOTS[it.slot]?.name || '')}</p><h2 style="color:${R.color}">${it.overhaul ? `<span class="ohn">+${it.overhaul}</span> ` : ''}${esc(it.name)}</h2>
    <p class="sub">${it.ilvl ? 'Item level ' + it.ilvl : ''}${x ? ' · ' + esc(whereText(x)) : ''}</p>
    <div class="sh-tags">${it.overhaul ? `<span class="chip amber">Overhauled +${it.overhaul} of 10</span>` : ''}${it.attuned ? `<span class="chip good">${esc(D.ATTUNE[it.attuned].name)}</span>` : ''}${it.unassayed ? '<span class="chip warn">Unassayed</span>' : ''}${it.stamp === 'grudge-settled' ? '<span class="chip">Grudge settled</span>' : ''}</div></div>`));
  body.append(top);
  if (it.overhaul) body.append(this.h(`<div class="oh-pips small-pips" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < it.overhaul ? 'on' : ''}"></i>`).join('')}</div>`));
  // the numbers
  const nums = itemNumbers(it);
  if (nums.length) body.append(this.h(`<div class="nums">${nums.map(r => `<div class="nr"><span>${esc(r.label)}${r.note ? ` <em>${esc(r.note)}</em>` : ''}</span><b>${fmtRow(r)}</b></div>`).join('')}</div>`));
  if (mod) body.append(this.h(`<p class="power-line">${esc(moduleEffect(it))}${seized(it) ? ' <em>(seized in the storm: half strength)</em>' : ''}</p>`));
  // traits, with stars
  if ((it.traits || []).length) {
    body.append(this.h(`<h3>Traits</h3>`));
    body.append(this.h(`<ul class="traits stars-list">${it.traits.map(t => `<li><span>${esc(LOOT.traitText(t))}</span><span class="stars" title="${LOOT.traitStars(t, it.rarity, it.ilvl)} of 5">${starStr(LOOT.traitStars(t, it.rarity, it.ilvl))}</span></li>`).join('')}</ul>`));
  }
  // cells
  const ns = sockets(it);
  if (ns) {
    body.append(this.h(`<h3>Cell sockets · ${(it.cells || []).filter(Boolean).length} of ${ns}</h3>`));
    const row = document.createElement('div'); row.className = 'cellrow';
    for (let i = 0; i < ns; i++) { const c = (it.cells || [])[i], el = document.createElement('div'); el.className = 'cslot' + (c ? ' full' : ''); if (c) { el.append(cellIcon(c, 30)); el.append(this.h(`<span><b style="color:${D.CELLS[c].color}">${esc(D.CELLS[c].name)}</b><em>${esc(cellText(c, it))}</em></span>`)); } else el.append(this.h(`<span class="small">Empty: Odile can set a cell here</span>`)); row.append(el); }
    body.append(row);
  }
  // powers
  const p = relic && relic.power || it.power;
  if (p && !it.unassayed) body.append(this.h(`<div class="power"><b>${esc(p.name)}.</b> ${esc(p.text)}</div>`));
  if (relic && relic.town) body.append(this.h(`<p class="small">${esc(relic.town.text)}</p>`));
  if (it.attuned) body.append(this.h(`<p class="small"><b>${esc(D.ATTUNE[it.attuned].name)}.</b> ${esc(D.ATTUNE[it.attuned].text)} ${esc(isModuleItem(it) ? '' : statWords(isWeaponItem(it) ? D.ATTUNE[it.attuned].hand : D.ATTUNE[it.attuned].other))}</p>`));
  // the maker's mark
  if (it.rarity === 'signed') {
    if (it.unassayed) { const a = this.h(`<div class="power mark">The maker’s mark is there, but nobody has read it. Its power won’t work until Absalom assays it. <button type="button" class="btn" style="margin-top:6px">Ask Absalom to assay it · ${SHARD} ${WS.assay}</button></div>`); a.querySelector('button').onclick = () => { benchAssay(it); UI.refresh(); }; body.append(a); }
    else body.append(this.h(`<div class="mark-line"><span class="small">Maker’s mark</span> <b>${esc(it.name)}</b></div>`));
  }
  // what it's best for
  const bf = bestFor(it);
  if (bf.length) body.append(this.h(`<h3>Best for</h3><ul class="traits best">${bf.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`));
  // against what someone wears now; for a module, the buildings it could go in
  if (wearable(it)) this.compareBlock(body, it);
  if (mod && x && x.where === 'stash') this.fitPlaces(body, it, back);
  // what you can do with it
  const acts = document.createElement('div'); acts.className = 'stats-row item-acts';
  const btn = (label, cls, fn, off) => { const b = this.h(`<button type="button" class="btn ${cls}" ${off ? 'disabled' : ''}>${label}</button>`); b.querySelector('button').onclick = fn; acts.append(b); };
  const self = () => UI.open('item', { it, back });
  if (x && x.where === 'worn') btn(`Take it off ${esc(x.v.d.name.split(' ')[0])}`, '', () => { unequip(x.v, it.slot); AUDIO.play('tap'); self(); });
  if (x && x.where === 'fitted') btn('Take it out', '', () => { unfitModule(buildingById(x.id), x.i); self(); });
  if (!onBench(it)) btn('Take it to Odile', '', () => UI.open('bench', { tab: canAttune(it) ? 'attune' : canOverhaul(it) ? 'overhaul' : canRetune(it) ? 'retune' : sockets(it) ? 'cells' : 'overhaul', uid: it.uid }));
  if (x && x.where === 'stash' && canSalvage(it) && !onBench(it)) btn(`Salvage · +${esc(matLine(salvageYield(it)))}`, '', () => { if (benchSalvage([it])) (back || (() => UI.open('roster')))(); });
  if (acts.children.length) body.append(acts);
  if (it.logbook) body.append(this.h(`<p class="lore">${esc(it.logbook)}</p>`));
  if (relic && relic.lore) body.append(this.h(`<p class="lore">${esc(relic.lore)}</p>`));
  else if (base && base.text) body.append(this.h(`<p class="lore">${esc(base.text)}</p>`));
  if (it.from) body.append(this.h(`<p class="small">From ${esc(it.from)}${it.day ? `, day ${it.day}` : ''}.</p>`));
  this.back(body, 'Back', back || (() => UI.open('roster', null)));
};
// the compare view: tap a face to see this piece on them against what they wear in that slot now
UI.compareBlock = function (body, it) {
  const wearer = wornBy(it), slot = it.slot;
  const want = new Set(); { const { base } = itemBase(it), s = itemStats(it); if (s.outJob) want.add(s.outJob); for (const j of (base && base.jobs) || []) want.add(JOB_OF[j] || j); if (itemWeapon(it)) want.add('wall'); }
  const jobOf = v => v.jobB ? (v.jobB === WALLB ? 'wall' : v.jobB.gearJob || v.jobB.type) : null;
  const people = GAME.villagers.filter(v => !v.d.exp && v !== wearer).sort((a, b) => (b === UI.cmpV) - (a === UI.cmpV) || want.has(jobOf(b)) - want.has(jobOf(a)) || (b.d.gear[slot] ? 0 : 1) - (a.d.gear[slot] ? 0 : 1));
  if (!people.length) return;
  const v = people.includes(UI.cmpV) ? UI.cmpV : people[0];
  body.append(this.h(`<h3>Compare · on ${esc(v.d.name.split(' ')[0])}, against ${v.d.gear[slot] ? 'what they wear now' : slot === 'hand' ? 'their bare hands' : 'nothing in that slot'}</h3>`));
  const faces = document.createElement('div'); faces.className = 'cmp-faces';
  for (const p of people.slice(0, 8)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'cmp-face' + (p === v ? ' on' : ''); b.setAttribute('aria-pressed', p === v); b.title = p.d.name; b.append(faceOf(p)); b.append(this.h(`<span>${esc(p.d.name.split(' ')[0])}</span>`)); b.onclick = () => { UI.cmpV = p; UI.refresh(); }; faces.append(b); }
  body.append(faces);
  const cur = v.d.gear[slot];
  if (cur) { const r = this.itemRow(cur, 'Wearing', () => UI.open('item', { it: cur, back: () => UI.open('item', { it }) })); r.classList.add('cmp-cur'); body.append(r); }
  const A = personNums(v), B = withItem(v, it, () => personNums(v));
  const changed = B.filter(b => { const a = A.find(r => r.key === b.key); return !a || Math.abs(a.val - b.val) > 0.04; }).map(r => r.key);
  const show = k => changed.includes(k) || ['dpsW', 'hp', 'guard'].includes(k) || (k === 'work' && v.jobB);
  body.append(numbersCompare(this, A.filter(r => show(r.key)), B.filter(r => show(r.key)), 'Now', 'With this'));
  const x = findItem(it.uid);
  if (x && (x.where === 'stash' || x.where === 'worn') && !onBench(it)) {
    const r = this.h(`<div class="stats-row"><button type="button" class="btn primary">Give it to ${esc(v.d.name.split(' ')[0])}</button></div>`);
    r.querySelector('button').onclick = () => { if (x.where === 'worn') unequip(x.v, slot); if (equip(v, it)) { AUDIO.play('tap'); toast(`<b>${esc(v.d.name.split(' ')[0])}</b> takes the <b style="color:${rarityOf(it).color}">${esc(it.name)}</b>.`); } UI.refresh(); };
    body.append(r);
  }
};

// where a module from the stash could go: every building of its kind, with its free sockets and what's in them
UI.fitPlaces = function (body, it, back) {
  const home = moduleFor(it), places = it.slot === 'lark' ? ['lark'] : home === 'wall' ? [WALLB] : ['hall', 'bunk'].includes(home) ? [TOWN.b.keep] : byType(home);
  body.append(this.h(`<h3>Where it can go</h3>`));
  if (!places.length) { body.append(this.h(`<p class="small">There’s no ${esc(homeOf(it).replace(/^(the|a) /, ''))} on the claim yet.</p>`)); return; }
  const l = document.createElement('div'); l.className = 'list';
  for (const b of places) {
    const L = socketsAt(b), n = socketCount(b), free = []; for (let i = 0; i < n; i++) if (!L[i]) free.push(i);
    const dup = L.some(m => m && m.base === it.base), inIt = L.filter(Boolean).map(m => moduleDef(m).name);
    const el = document.createElement('button'); el.type = 'button'; el.className = 'li'; el.style.gridTemplateColumns = '1fr auto';
    el.append(this.h(`<span><span class="nm">${esc(bName(b))}</span><span class="jb">${n ? `${free.length} of ${n} socket${n > 1 ? 's' : ''} free${inIt.length ? ' · has ' + esc(inIt.join(', ')) : ''}` : 'No sockets until it is built up'}</span></span><span class="fit">${dup ? '<em>Has one</em>' : free.length ? 'Fit here' : n ? '<em>Swap…</em>' : ''}</span>`));
    if (!n || dup) { el.disabled = true; el.style.opacity = 0.55; }
    el.onclick = () => { if (free.length) { if (fitModule(it, b, free[0])) UI.open(b === 'lark' ? 'lark' : 'building', b); } else UI.open('fit', { b, i: 0 }); };
    l.append(el);
  }
  body.append(l);
  void back;
};

// ----------------------------------------------------------------- the stash: sort, filter, and modules under their own heading
UI.stashF = { slot: 'all', rar: 0, sort: 'new' };
const STASH_SLOTS = [['all', 'All'], ['hand', 'Hand'], ['offhand', 'Off-hand'], ['head', 'Head'], ['rig', 'Rig'], ['hands', 'Gloves'], ['boots', 'Boots'], ['charm', 'Charm'], ['module', 'Modules'], ['lark', 'Lark parts']];
const STASH_SORT = { new: (a, b) => (b.n || 0) - (a.n || 0), grade: (a, b) => LOOT.rankOf(b.rarity) - LOOT.rankOf(a.rarity) || (b.ilvl || 0) - (a.ilvl || 0), level: (a, b) => (b.ilvl || 0) - (a.ilvl || 0) || LOOT.rankOf(b.rarity) - LOOT.rankOf(a.rarity), slot: (a, b) => STASH_SLOTS.findIndex(s => s[0] === a.slot) - STASH_SLOTS.findIndex(s => s[0] === b.slot) || LOOT.rankOf(b.rarity) - LOOT.rankOf(a.rarity) };
UI.stashTab = function (body, list) {
  const F = UI.stashF, m = GAME.mats;
  const mats = Object.entries(D.MATERIALS).map(([k, x]) => `<span class="chip mat" style="--mc:${x.color}" title="${esc(x.text)}"><i></i>${esc(x.name)} <b>${m[k] || 0}</b></span>`), cells = Object.entries(GAME.cells).filter(([, n]) => n > 0).map(([k, n]) => `<span class="chip mat" style="--mc:${D.CELLS[k].color}"><i></i>${esc(D.CELLS[k].name)} <b>${n}</b></span>`);
  body.append(this.h(`<p class="small">Everything not being worn or fitted. Tap a piece to read it, compare it, or take it to Odile.</p><div class="mats">${mats.join('')}${cells.join('')}${GAME.blueprints.length ? `<span class="chip">${GAME.blueprints.length} blueprint${GAME.blueprints.length > 1 ? 's' : ''}</span>` : ''}</div>`));
  const junk = GAME.stash.filter(it => it.rarity === 'salvage' && canSalvage(it) && !(it.overhaul > 0) && !(it.cells || []).some(Boolean));
  const acts = this.h(`<div class="stats-row"><button type="button" class="btn">Odile’s bench</button>${junk.length ? `<button type="button" class="btn">Break down all Salvage-grade · ${junk.length}</button>` : ''}</div>`);
  const [ob, sb] = acts.querySelectorAll('button'); ob.onclick = () => UI.open('bench', { tab: 'salvage' });
  if (sb) sb.onclick = () => { UI.benchSel.pick = new Set(junk); UI.open('bench', { tab: 'salvage' }); };
  body.append(acts);
  // the filters
  const count = k => k === 'all' ? GAME.stash.length : GAME.stash.filter(it => it.slot === k).length;
  const fl = this.h(`<div class="stash-f"><div class="tabs chips" role="group" aria-label="Show">${STASH_SLOTS.filter(([k]) => k === 'all' || count(k)).map(([k, n]) => `<button type="button" data-s="${k}" aria-pressed="${F.slot === k}">${n} <em>${count(k)}</em></button>`).join('')}</div>
    <div class="stash-row"><span class="sg"><span class="small">Grade</span><span class="seg mini" role="group" aria-label="Grade">${['Any', 'Tuned+', 'Calibrated+', 'Signed+'].map((n, i) => `<button type="button" data-r="${i}" aria-pressed="${F.rar === i}">${n}</button>`).join('')}</span></span>
    <span class="sg"><span class="small">Sort</span><span class="seg mini" role="group" aria-label="Sort">${[['new', 'Newest'], ['grade', 'Grade'], ['level', 'Level'], ['slot', 'Slot']].map(([k, n]) => `<button type="button" data-o="${k}" aria-pressed="${F.sort === k}">${n}</button>`).join('')}</span></span></div></div>`);
  for (const b of fl.querySelectorAll('[data-s]')) b.onclick = () => { F.slot = b.dataset.s; UI.refresh(); };
  for (const b of fl.querySelectorAll('[data-r]')) b.onclick = () => { F.rar = +b.dataset.r; UI.refresh(); };
  for (const b of fl.querySelectorAll('[data-o]')) b.onclick = () => { F.sort = b.dataset.o; UI.refresh(); };
  body.append(fl);
  const minRank = [0, 2, 3, 4][F.rar], shown = GAME.stash.filter(it => (F.slot === 'all' || it.slot === F.slot) && LOOT.rankOf(it.rarity) >= minRank).sort(STASH_SORT[F.sort]);
  const row = it => this.itemRow(it, isModuleItem(it) ? `For ${homeOf(it).replace(/^(the|a) /, '')}` : D.SLOTS[it.slot]?.name || '', () => UI.open('item', { it, back: () => UI.open('roster') }));
  const groups = F.slot === 'all' ? [['Gear', shown.filter(it => !isModuleItem(it))], ['Building modules', shown.filter(it => it.slot === 'module')], ['Lark parts', shown.filter(it => it.slot === 'lark')]] : [[null, shown]];
  for (const [title, items] of groups) {
    if (!items.length) continue;
    if (title) list.append(this.h(`<h3 class="list-h">${esc(title)} · ${items.length}</h3>`));
    for (const it of items) list.append(row(it));
  }
  if (!shown.length) list.append(this.h(`<p class="small">${GAME.stash.length ? 'Nothing matches.' : 'The stash is empty.'}</p>`));
};

// ----------------------------------------------------------------- the best kit in the stash for someone's job
function jobScore(v) { const b = v.jobB; if (!b) return 0; if (b === WALLB) return fightOf(v, 'flarehound').dps; return jobEff(v); }
function suggestFor(v) {
  const b = v.jobB; if (!b || !b.def || !b.def.job) return [];
  const base = jobScore(v); if (!(base > 0)) return [];
  const best = {};
  for (const it of GAME.stash) {
    if (!wearable(it)) continue;
    const s = withItem(v, it, () => jobScore(v)), gain = s - base;
    if (gain > base * 0.02 && (!best[it.slot] || gain > best[it.slot].gain)) best[it.slot] = { it, gain };
  }
  return Object.values(best).sort((a, c) => c.gain - a.gain).slice(0, 3).map(x => ({ ...x, text: b === WALLB ? `+${x.gain.toFixed(1)} damage a second on the watch` : `+${Math.round(x.gain / base * 100)}% at work` }));
}
UI.suggestBlock = function (card, v) {
  const b = v.jobB; if (!b || v.d.exp || v.d.study) return;
  const S = suggestFor(v), box = document.createElement('div'); box.className = 'suggest';
  box.append(this.h(`<h3>Best for this job${b === WALLB ? ': the watch' : `: ${esc(b.def.job.title.toLowerCase())}`}</h3>`));
  if (!S.length) box.append(this.h(`<p class="small">${esc(v.d.name.split(' ')[0])} already has the best the stash can offer for this work.</p>`));
  for (const x of S) {
    const r = this.itemRow(x.it, 'Wear it', () => { equip(v, x.it); AUDIO.play('tap'); toast(`<b>${esc(v.d.name.split(' ')[0])}</b> takes the <b style="color:${rarityOf(x.it).color}">${esc(x.it.name)}</b>.`); UI.refresh(); });
    r.querySelector('.jb').textContent = x.text; box.append(r);
  }
  card.append(box);
};
