// ===================================================================== UI
let QUIET = false;
function toast(html, kind = '') {
  if (QUIET) return;
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = html;
  const box = $('#toasts'); box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, kind === 'night' ? 5200 : 4200);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = n => n >= 100 ? Math.floor(n).toString() : n >= 10 ? Math.floor(n).toString() : (Math.floor(n * 10) / 10).toString();
const SHARD = '<svg viewBox="0 0 20 20" width="13" height="13" style="vertical-align:-2px"><path d="M10 1.5 15.5 9 10 18.5 4.5 9z" fill="#ffb347" stroke="#5a2a10" stroke-width="1.4"/></svg>';
// a small canvas with one frame of a villager's sheet
function miniSprite(v, w = 36, h = 48, col = 0, row = 0) {
  const c = document.createElement('canvas'); c.width = PX.FW; c.height = PX.FH; c.style.width = w + 'px'; c.style.height = h + 'px';
  c.getContext('2d').drawImage(v.canvas, col * PX.FW, row * PX.FH, PX.FW, PX.FH, 0, 0, PX.FW, PX.FH);
  return c;
}
const SHORT_STAT = { G: 'Grit', E: 'Eng', A: 'Agility', R: 'Rapport', S: 'Sowing' };
// a person's portrait in a gilt frame: the cast's painted ones, a drawn bust for everyone else (or, failing that, the
// head and shoulders of their sprite, close up)
function portraitOf(v, size = 128) {
  const wrap = document.createElement('div'); wrap.className = 'pframe'; wrap.style.width = wrap.style.height = size + 'px';
  const src = (v.d.hero && ART.cast && ART.cast[v.d.hero]) || portraitSrc(v.d);
  if (src) { const im = new Image(); im.src = src; im.alt = ''; wrap.append(im); wrap.classList.add('painted'); return wrap; }
  try {
    if (typeof drawPortrait === 'function') { const c = document.createElement('canvas'); drawPortrait({ ...v.d.look }, c); if (c.width > 1) { wrap.append(c); return wrap; } }
  } catch (e) { console.warn(e); }
  const c = document.createElement('canvas'), hh = Math.round(PX.FH * 0.6); c.width = PX.FW; c.height = hh;
  c.getContext('2d').drawImage(v.canvas, 0, 0, PX.FW, hh, 0, 0, PX.FW, hh);
  c.className = 'crop'; wrap.append(c);
  return wrap;
}
// an item's picture: its painted one where there is one (assets/items), otherwise its pixel icon
function itemPicture(it, size = 48) {
  const { relic } = itemBase(it), src = ART.items && (ART.items[it.base] || (relic && relic.base && ART.items[relic.base]));
  if (src) { const im = new Image(); im.src = src; im.alt = ''; im.className = 'ipic'; im.width = size; im.height = size; return im; }
  const c = itemIcon(it, 64); c.style.width = c.style.height = size + 'px'; return c;
}
const stars = s => s >= 9 ? '★★★' : s >= 6 ? '★★' : '★';
const UI = {
  cur: null, tab: 'crew',
  open(kind, ref) { this.cur = { kind, ref }; $('#panel').hidden = false; this.render(); AUDIO.play('open'); },
  close() { this.cur = null; $('#panel').hidden = true; SEL.villager = null; SEL.building = null; },
  refresh() { if (this.cur) this.render(); },
  render() {
    const c = this.cur, body = $('#panel-body'), panel = $('#panel'), key = c && c.kind + (c.ref != null && typeof c.ref !== 'object' ? c.ref : c.ref && (c.ref.id || c.ref.d?.id || c.ref.v?.d?.id || c.ref.it?.uid || c.ref.room || ''));
    const keep = this.lastKey === key ? panel.scrollTop : 0;
    panel.classList.toggle('wide', !!c && c.kind === 'villager');
    this.lastKey = key;
    body.innerHTML = '';
    requestAnimationFrame(() => { panel.scrollTop = keep; });
    if (!c) return;
    const fn = { building: this.building, villager: this.villager, roster: this.roster, pick: this.picker, jobs: this.jobs, equip: this.equipPick, item: this.item, prep: this.prep, exp: this.exp, room: this.room, studyPick: this.studyPick, studyRooms: this.studyRooms, away: this.away, dock: this.dock, haul: this.haul, journal: this.journal }[c.kind];
    if (fn) fn.call(this, body, c.ref);
  },
  h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; },
  back(body, label, fn) { const b = this.h(`<p style="margin-top:12px"><button type="button" class="btn">${esc(label)}</button></p>`); b.querySelector('button').onclick = fn; body.append(b); },
  building(body, b) {
    const def = b.def, isWall = b === WALLB, lv = b.level, max = def.max;
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    body.append(this.h(`<h2>${esc(b.name || def.name)}<span class="lvl" aria-label="Level ${lv} of ${max}">${pips}</span></h2>
      <p class="sub">${esc(def.levels[lv - 1] || '')}</p><p>${esc(def.blurb)}</p>`));
    const chips = [];
    if (b.type === 'head') { const r = (GAME.rates && GAME.rates.ore) || 0; chips.push(`<span class="chip">${(r * 60).toFixed(1)} ore a minute</span>`); chips.push(`<span class="chip ${lv >= 2 ? 'warn' : ''}">${lv >= 2 ? 'Deep seam open' : 'Deep seam sealed'}</span>`); }
    if (b.type === 'yard') { const t = workersOf(b.id).reduce((s, v) => s + v.eff(), 0) * RATES.charge * (lv >= 3 ? 1.5 : lv >= 2 ? 1.25 : 1); chips.push(`<span class="chip amber">Up to ${(t * 60).toFixed(1)} ore charged a minute, in full sun</span>`); if (TOD.sunlight < 0.05 && lv < 3) chips.push(`<span class="chip">Resting: no sun</span>`); }
    if (b.type === 'shop') chips.push(`<span class="chip amber">+${Math.round(22 * workersOf(b.id).reduce((s, v) => s + v.eff(), 0) * (lv >= 2 ? 1.3 : 1))}% shards from every tray</span>`);
    if (b.type === 'garden') { const net = (GAME.rates && GAME.rates.food || 0) * 60; chips.push(`<span class="chip ${net < 0 ? 'warn' : 'good'}">Claim food ${net >= 0 ? '+' : ''}${net.toFixed(1)} a minute</span>`); }
    if (b.type === 'keep') {
      const n = bedsOf(b), used = GAME.villagers.length, free = n - used;
      chips.push(`<span class="chip">${used} of ${n} beds taken</span>`);
      chips.push(`<span class="chip ${free > 0 ? 'amber' : 'warn'}">${free > 0 ? `Next settler ${Math.round(GAME.recruit * 100)}% of the way` : 'No free beds: raise the Keep'}</span>`);
      chips.push(`<span class="chip">${expOut().length} of ${expLimit()} out in the wilds</span>`);
    }
    if (b.type === 'lens') chips.push(`<span class="chip">Reach ${lv >= 2 ? 27 : 21} m · 1 shard a shot · needs a crew</span>`);
    if (b.type === 'ballista') chips.push(`<span class="chip">Reach ${lv >= 2 ? 17 : 14} m · ${lv >= 2 ? 14 : 10} a bolt · no crew, no shards</span>`);
    if (isWall) { const br = WALL.segs.filter(s => s.broken).length; chips.push(`<span class="chip ${br ? 'warn' : 'good'}">${br ? br + ' breaches, mended at dawn by the watch' : 'Sound all the way round'}</span>`); }
    if (b.type === 'mast') chips.push(`<span class="chip">${SHIP.state === 'docked' ? 'Moored' : 'On patrol'}</span>`);
    if (chips.length) body.append(this.h(`<div class="stats-row">${chips.join('')}</div>`));
    if (def.job) {
      const n = slotsOf(b), ws = workersOf(b.id);
      body.append(this.h(`<h3>${esc(def.job.title)}s · ${ws.length} of ${n} · best stat ${STAT_NAMES[def.job.stat]}</h3>`));
      const box = document.createElement('div'); box.className = 'workers';
      for (let i = 0; i < n; i++) {
        const v = ws.find(w => w.d.job.slot === i);
        const el = document.createElement('button'); el.type = 'button';
        if (v) { el.className = 'wslot'; el.append(miniSprite(v)); el.append(this.h(`<b>${esc(v.d.name.split(' ')[0])}</b><span>${SHORT_STAT[def.job.stat]} ${statOf(v, def.job.stat)}</span>`)); el.onclick = () => { SEL.villager = v; UI.open('villager', v); }; el.setAttribute('aria-label', `${v.d.name}, open`); }
        else { el.className = 'wslot empty'; el.append(this.h(`<span>+</span>Add`)); el.onclick = () => UI.open('pick', b); el.setAttribute('aria-label', `Add a ${def.job.title.toLowerCase()}`); }
        box.append(el);
      }
      if (!n) box.append(this.h(`<p class="small">No room for workers until it's built.</p>`));
      body.append(box);
      if (def.job.night) body.append(this.h(`<p class="small">Works through the night.</p>`));
    }
    if (b.type === 'keep') {
      body.append(this.h(`<h3>Build allowance at level ${lv}</h3>`));
      const rows = BUILD_ORDER.map(t => { const have = byType(t).length, cap = KEEP_LIMITS[t][lv], nxt = KEEP_LIMITS[t][Math.min(3, lv + 1)]; return `<span class="chip ${have < cap ? 'amber' : ''}">${esc(DEFS[t].name)} ${have}/${cap}${lv < 3 && nxt > cap ? ` <em style="font-style:normal;color:var(--good)">→ ${nxt}</em>` : ''}</span>`; });
      body.append(this.h(`<div class="stats-row">${rows.join('')}</div>`));
      if (lv < 3) body.append(this.h(`<p class="small">Level ${lv + 1} also gives ${DEFS.keep.beds[lv + 1]} beds and ${EXP_LIMIT[lv + 1]} expeditions at once.</p>`));
    }
    // actions
    const acts = document.createElement('div'); acts.className = 'stats-row';
    if (b.type === 'keep') { const gi = this.h(`<button type="button" class="btn primary">Go inside</button>`); gi.querySelector('button').onclick = () => { UI.close(); setView('keep'); }; acts.append(gi); }
    if (b.tile) { const mv = this.h(`<button type="button" class="btn">Move</button>`); mv.querySelector('button').onclick = () => enterBuild(b); acts.append(mv); }
    if (acts.children.length) body.append(acts);
    if (lv < max) {
      const cost = def.cost[lv + 1], can = GAME.shards >= cost && !b.building;
      const u = this.h(`<div class="upgrade"><p><b>Level ${lv + 1}:</b> ${esc(def.levels[lv])}</p><button type="button" class="btn primary" ${can ? '' : 'disabled'}>${b.building ? 'Building…' : `Upgrade · <span class="cost">${SHARD} ${cost}</span>`}</button>${!can && !b.building ? `<p class="small">Needs ${cost - Math.floor(GAME.shards)} more shards.</p>` : ''}</div>`);
      u.querySelector('button').onclick = () => upgrade(b);
      body.append(u);
    } else body.append(this.h(`<p class="small" style="margin-top:12px">Fully built.</p>`));
  },
  picker(body, b) {
    const def = b.def, stat = def.job.stat;
    body.append(this.h(`<h2>Choose a ${esc(def.job.title.toLowerCase())}</h2><p class="sub">For the ${esc(b.name || def.name)}. ${STAT_NAMES[stat]} matters most here.</p>`));
    const list = document.createElement('div'); list.className = 'list';
    const people = GAME.villagers.filter(v => !v.d.exp && !v.d.study && !(v.d.job && v.d.job.bid === b.id)).sort((a, c) => (!!a.d.job - !!c.d.job) || statOf(c, stat) - statOf(a, stat));
    for (const v of people) {
      const s = statOf(v, stat);
      const jb = v.d.job ? (v.jobB ? v.jobB.def.job.title + ', ' + (v.jobB.name || v.jobB.def.name) : 'Working') : 'No job';
      const el = document.createElement('button'); el.type = 'button'; el.className = 'li';
      el.append(miniSprite(v, 30, 40));
      el.append(this.h(`<span><span class="nm">${esc(v.d.name)}</span><span class="jb">${esc(jb)}</span></span><span class="fit">${stars(s)} <em>${STAT_NAMES[stat]} ${s}</em></span>`));
      el.onclick = () => { if (assignJob(v, b.id)) { v.d.pref = b === WALLB ? 'wall' : b.type; toast(`<b>${esc(v.d.name)}</b> is now a ${def.job.title.toLowerCase()}.`); AUDIO.play('tap'); } UI.open('building', b); };
      list.append(el);
    }
    body.append(list);
    this.back(body, 'Back', () => UI.open('building', b));
  },
  villager(body, v) {
    const d = v.d, b = v.jobB, E = d.exp;
    this.sheet(body, v);
    if (d.study) {
      const S = d.study, r = GAME.rooms[S.room], k = r.type;
      body.append(this.h(`<h3>${S.role === 'tutor' ? 'Teaching' : 'Studying'} in the ${esc(STUDY[k].name)}</h3>`));
      if (S.role === 'student') { const need = pointTime(d.stats[k]), f = Math.min(1, S.prog / need);
        body.append(this.h(`<p>${STAT_NAMES[k]} ${d.stats[k]} → <b>${d.stats[k] + 1}</b> · about ${fmtReal(studyLeft(v))} to go${GAME.speed > 1 ? ' at 1×' : ''}</p><div class="hp" role="meter" aria-label="Study progress" aria-valuenow="${Math.round(f * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(2, f * 100)}%"></i></div>`)); }
      else body.append(this.h(`<p class="small">Students here learn ${Math.round((tutorMult(S.room) - 1) * 100)}% faster with ${esc(d.name.split(' ')[0])} teaching.</p>`));
      const r2 = this.h(`<div class="stats-row"><button type="button" class="btn">Stop and go back to work</button><button type="button" class="btn">See the room</button></div>`);
      const [stop, see] = r2.querySelectorAll('button');
      stop.onclick = () => { endStudy(v); toast(`<b>${esc(d.name.split(' ')[0])}</b> leaves the ${esc(STUDY[k].name)}.`); UI.refresh(); };
      see.onclick = () => { setView('keep'); UI.open('room', S.room); };
      body.append(r2);
      return;
    }
    if (E) {
      body.append(this.h(`<h3>In the wilds</h3>`));
      const r = this.h(`<div class="stats-row"><button type="button" class="btn primary">See their log</button></div>`); r.querySelector('button').onclick = () => UI.open('exp', v); body.append(r);
      return;
    }
    body.append(this.h(`<h3>Job</h3><p>${b ? `<b>${esc(b.def.job.title)}</b> at the ${esc(b.name || b.def.name)}` : 'No job yet.'}</p>`));
    const row = this.h(`<div class="stats-row"><button type="button" class="btn" id="vj">${b ? 'Change job' : 'Give a job'}</button><button type="button" class="btn" id="vs">Study</button><button type="button" class="btn" id="vf">${FOLLOW.v === v ? 'Stop following' : 'Follow'}</button></div>`);
    row.querySelector('#vj').onclick = () => UI.open('jobs', v);
    row.querySelector('#vs').onclick = () => UI.open('studyRooms', v);
    row.querySelector('#vf').onclick = () => { FOLLOW.v = FOLLOW.v === v ? null : v; if (FOLLOW.v && v.where === 'mine') setView('mine'); UI.refresh(); };
    body.append(row);
    const can = expOut().length < expLimit();
    const ex = this.h(`<div class="upgrade"><p><b>The wilds.</b> Send ${esc(d.name.split(' ')[0])} down the rope stair to look for ore, food and gear. Kit them out first.</p><button type="button" class="btn primary" ${can ? '' : 'disabled'}>Get ready to set out</button>${can ? '' : `<p class="small">${expOut().length} already out. The Keep allows ${expLimit()} at once; raise it for more.</p>`}</div>`);
    ex.querySelector('button').onclick = () => UI.open('prep', v);
    body.append(ex);
    if (d.lastTrip) body.append(this.h(`<p class="small" style="margin-top:8px">Last trip: ${esc(d.lastTrip.span)}, as far as ${esc(d.lastTrip.zone)}${d.lastTrip.beaten ? ', and came back beaten' : ''}.</p>`));
  },
  room(body, key) {
    if (typeof key !== 'number') {
      const F = ROOM_FIXED[key];
      body.append(this.h(`<h2>${esc(F.name)}</h2><p>${esc(F.blurb)}</p>`));
      if (key === 'dorm') body.append(this.h(`<div class="stats-row"><span class="chip">${GAME.villagers.length} of ${totalBeds()} beds taken</span></div>`));
      const here = GAME.villagers.filter(v => v.isprite.visible && v.where === 'home');
      if (here.length && key !== 'lookout') { body.append(this.h(`<h3>Here now</h3>`)); const box = document.createElement('div'); box.className = 'workers'; for (const v of here) { const el = document.createElement('button'); el.type = 'button'; el.className = 'wslot'; el.append(miniSprite(v)); el.append(this.h(`<b>${esc(v.d.name.split(' ')[0])}</b>`)); el.onclick = () => UI.open('villager', v); box.append(el); } body.append(box); }
      return;
    }
    const i = key, r = GAME.rooms[i];
    if (!r.type) {
      body.append(this.h(`<h2>Empty room</h2><p class="sub">Furnish it as a place to study. Each kind trains one GEARS stat; you can have one of each.</p>`));
      const list = document.createElement('div'); list.className = 'list';
      for (const k of 'GEARS') {
        const S = STUDY[k], built = GAME.rooms.some(x => x.type === k), cost = ROOM_COST[1], can = !built && GAME.shards >= cost;
        const el = document.createElement('button'); el.type = 'button'; el.className = 'li'; el.style.gridTemplateColumns = '1fr auto'; if (!can) { el.disabled = true; el.style.opacity = 0.5; }
        el.append(this.h(`<span><span class="nm">${esc(S.name)} · ${STAT_NAMES[k]}</span><span class="jb">${built ? 'Already furnished' : esc(S.blurb)}</span></span><span class="fit">${SHARD} ${cost}</span>`));
        el.onclick = () => { if (!can) return; GAME.shards -= cost; r.type = k; r.level = 1; buildInterior(); AUDIO.play('build'); toast(`The <b>${esc(S.name)}</b> is furnished. ${esc(S.tutor.split(' ')[0])} would make a fine tutor.`); UI.open('room', i); };
        list.append(el);
      }
      body.append(list); return;
    }
    const S = STUDY[r.type], k = r.type, lv = r.level, pips = [1, 2, 3].map(n => `<i class="${n <= lv ? 'on' : ''}"></i>`).join('');
    const tutor = roomTutor(i), studs = roomStudents(i), seats = ROOM_SEATS[lv];
    body.append(this.h(`<h2>${esc(S.name)}<span class="lvl" aria-label="Level ${lv} of 3">${pips}</span></h2><p class="sub">Trains ${STAT_NAMES[k]}, up to ${STAT_MAX}</p><p>${esc(S.blurb)}</p>
      <div class="stats-row"><span class="chip amber">Learning speed ×${studyRate(i).toFixed(2)}</span><span class="chip">${studs.length} of ${seats} students</span></div>
      <p class="small">Mastery at ${STAT_MAX}: <b style="color:var(--gold)">${esc(S.perk)}</b>, ${esc(S.perkText)}. Students leave their job while they study.</p>`));
    body.append(this.h(`<h3>Tutor · ${STAT_NAMES[k]} 7 or better</h3>`));
    const tb = document.createElement('div'); tb.className = 'workers';
    const tel = document.createElement('button'); tel.type = 'button';
    if (tutor) { tel.className = 'wslot'; tel.append(miniSprite(tutor)); tel.append(this.h(`<b>${esc(tutor.d.name.split(' ')[0])}</b><span>+${Math.round((tutorMult(i) - 1) * 100)}%</span>`)); tel.onclick = () => UI.open('villager', tutor); }
    else { tel.className = 'wslot empty'; tel.append(this.h(`<span>+</span>Tutor`)); tel.onclick = () => UI.open('studyPick', { room: i, role: 'tutor' }); }
    tb.append(tel); body.append(tb);
    body.append(this.h(`<h3>Students</h3>`));
    const box = document.createElement('div'); box.className = 'workers';
    for (let n = 0; n < seats; n++) {
      const v = studs[n], el = document.createElement('button'); el.type = 'button';
      if (v) { el.className = 'wslot'; el.append(miniSprite(v)); el.append(this.h(`<b>${esc(v.d.name.split(' ')[0])}</b><span>${SHORT_STAT[k]} ${v.d.stats[k]}→${v.d.stats[k] + 1}</span><span>${fmtReal(studyLeft(v))}</span>`)); el.onclick = () => UI.open('villager', v); }
      else { el.className = 'wslot empty'; el.append(this.h(`<span>+</span>Add`)); el.onclick = () => UI.open('studyPick', { room: i, role: 'student' }); }
      box.append(el);
    }
    body.append(box);
    if (lv < 3) {
      const cost = ROOM_COST[lv + 1], can = GAME.shards >= cost;
      const u = this.h(`<div class="upgrade"><p><b>Level ${lv + 1}:</b> ${ROOM_SEATS[lv + 1]} seats and learning ×${ROOM_SPEED[lv + 1]}.</p><button type="button" class="btn primary" ${can ? '' : 'disabled'}>Upgrade · <span class="cost">${SHARD} ${cost}</span></button></div>`);
      u.querySelector('button').onclick = () => { if (GAME.shards < cost) return; GAME.shards -= cost; r.level++; buildInterior(); AUDIO.play('build'); toast(`The <b>${esc(S.name)}</b> is now level ${r.level}.`); UI.refresh(); };
      body.append(u);
    } else body.append(this.h(`<p class="small" style="margin-top:12px">Fully furnished.</p>`));
  },
  studyPick(body, { room: i, role }) {
    const r = GAME.rooms[i], k = r.type, S = STUDY[k];
    body.append(this.h(`<h2>${role === 'tutor' ? 'Choose a tutor' : 'Choose a student'}</h2><p class="sub">For the ${esc(S.name)} · ${STAT_NAMES[k]}. ${role === 'tutor' ? 'The stronger they are, the faster everyone learns.' : 'They leave their job while they study and take it back when they stop.'}</p>`));
    const list = document.createElement('div'); list.className = 'list';
    const ok = v => role === 'tutor' ? canTutor(v, i) : canStudent(v, i);
    const people = GAME.villagers.filter(v => !v.d.exp && !(v.d.study && v.d.study.room === i)).sort((a, b) => (ok(b) - ok(a)) || (role === 'tutor' ? statOf(b, k) - statOf(a, k) : b.d.stats[k] - a.d.stats[k]));
    for (const v of people) {
      const can = ok(v), s = v.d.stats[k], el = document.createElement('button'); el.type = 'button'; el.className = 'li'; if (!can) { el.disabled = true; el.style.opacity = 0.45; }
      const now = v.d.study ? `${v.d.study.role === 'tutor' ? 'Teaching' : 'Studying'} · ${STUDY[GAME.rooms[v.d.study.room].type].name}` : v.jobB ? v.jobB.def.job.title + ', ' + (v.jobB.name || v.jobB.def.name) : 'No job';
      const side = role === 'tutor' ? `${stars(statOf(v, k))} <em>${STAT_NAMES[k]} ${statOf(v, k)}</em>` : s >= STAT_MAX ? '<em>Mastered</em>' : `<em>${s}→${s + 1} · ${fmtReal(pointTime(s) / studyRate(i))}</em>`;
      el.append(miniSprite(v, 30, 40));
      el.append(this.h(`<span><span class="nm">${esc(v.d.name)}</span><span class="jb">${esc(now)}</span></span><span class="fit">${side}</span>`));
      el.onclick = () => { if (!can) return; if (startStudy(v, i, role)) { toast(`<b>${esc(v.d.name.split(' ')[0])}</b> heads into the Keep to ${role === 'tutor' ? 'teach' : 'study'} in the ${esc(S.name)}.`); AUDIO.play('tap'); } UI.open('room', i); };
      list.append(el);
    }
    body.append(list);
    this.back(body, 'Back', () => UI.open('room', i));
  },
  studyRooms(body, v) {
    body.append(this.h(`<h2>Where should ${esc(v.d.name.split(' ')[0])} study?</h2><p class="sub">Each room trains one stat. They leave their job while they study.</p>`));
    const list = document.createElement('div'); list.className = 'list';
    let any = false;
    GAME.rooms.forEach((r, i) => {
      if (!r.type || !slotOpen(i)) return; any = true;
      const k = r.type, s = v.d.stats[k], canS = canStudent(v, i), canT = canTutor(v, i);
      const el = document.createElement('button'); el.type = 'button'; el.className = 'li'; el.style.gridTemplateColumns = '1fr auto';
      if (!canS && !canT) { el.disabled = true; el.style.opacity = 0.45; }
      const note = s >= STAT_MAX ? (canT ? 'Mastered: could teach here' : 'Mastered') : !canS ? (canT ? 'Room full: could teach here' : 'Room full') : `${s} → ${s + 1} in about ${fmtReal(pointTime(s) / studyRate(i))}${canT ? ' · or teach' : ''}`;
      el.append(this.h(`<span><span class="nm">${esc(STUDY[k].name)} · ${STAT_NAMES[k]}</span><span class="jb">${esc(note)}</span></span><span class="fit"><em>${roomStudents(i).length}/${ROOM_SEATS[r.level]}</em></span>`));
      el.onclick = () => { if (canS ? startStudy(v, i, 'student') : canT && startStudy(v, i, 'tutor')) { toast(`<b>${esc(v.d.name.split(' ')[0])}</b> heads into the Keep.`); AUDIO.play('tap'); UI.open('villager', v); } };
      list.append(el);
    });
    if (!any) list.append(this.h(`<p class="small">No study rooms yet. Go inside the Keep and furnish an empty room.</p>`));
    body.append(list);
    const gi = this.h(`<div class="stats-row" style="margin-top:10px"><button type="button" class="btn">Go inside the Keep</button><button type="button" class="btn">Back</button></div>`);
    const [a, bk] = gi.querySelectorAll('button'); a.onclick = () => { UI.close(); setView('keep'); }; bk.onclick = () => UI.open('villager', v);
    body.append(gi);
  },
  away(body, A) {
    body.append(this.h(`<h2>While you were away</h2><p class="sub">${fmtReal(A.sec)} passed${A.sec >= AWAY_CAP ? ' (time away counts up to 8 hours)' : ''}. Training and expeditions kept going; the claim itself waited for you.</p>`));
    if (!A.lines.length) body.append(this.h(`<p>Nobody was studying or out in the wilds, so nothing changed.</p>`));
    const list = document.createElement('div'); list.className = 'list';
    for (const l of A.lines) { const el = document.createElement('button'); el.type = 'button'; el.className = 'li'; el.style.gridTemplateColumns = '40px 1fr'; el.append(miniSprite(l.v, 30, 40)); el.append(this.h(`<span><span class="jb" style="color:var(--cream);font-size:13.5px">${esc(l.text)}</span></span>`)); el.onclick = () => UI.open(l.v.d.exp ? 'exp' : 'villager', l.v); list.append(el); }
    body.append(list);
  },
  // A person's card: portrait, name and trade; their five GEARS stats, with what training and gear add; a paper doll of
  // the seven gear slots round their figure; how they fight; and what they carry.
  sheet(body, v) {
    const d = v.d, b = v.jobB, E = d.exp, g = gearOf(v), F = fightOf(v);
    const title = d.title || (b ? b.def.job.title : E ? 'Out in the wilds' : d.study ? 'Studying in the Keep' : 'Settler, looking for work');
    const where = E ? 'In the wilds' : d.study ? 'In the Keep' : v.hidden ? (v.where === 'home' ? 'Asleep in the Keep' : 'Indoors') : v.where === 'mine' ? 'Down the mine' : v.where === 'ship' ? 'Aboard the Lark' : v.working ? 'At work' : v.fighting ? 'Fighting Wildlight' : 'Out and about';
    const card = document.createElement('div'); card.className = 'sheet';
    // the header
    const head = document.createElement('div'); head.className = 'sh-head';
    head.append(portraitOf(v, 116));
    const ms = [...'GEARS'].filter(k => mastered(v, k));
    head.append(this.h(`<div class="sh-id"><p class="eyebrow">${esc(title)}</p><h2>${esc(d.name)}</h2>
      <div class="sh-tags"><span class="chip amber" title="${esc(TRAITS[d.trait] || '')}">${esc(d.trait)}</span>${ms.map(k => `<span class="chip good" title="${esc(STUDY[k].perkText)}">${esc(STUDY[k].perk)}</span>`).join('')}</div>
      <p class="small">${esc(TRAITS[d.trait] || '')}</p><p class="small sh-where">${esc(where)}</p></div>`));
    card.append(head);
    const cols = document.createElement('div'); cols.className = 'sh-cols';
    // the paper doll: their figure, big, with the gear slots round it
    const doll = document.createElement('div'); doll.className = 'doll';
    const fig = document.createElement('div'); fig.className = 'doll-fig'; fig.append(miniSprite(v, 108, 144)); doll.append(fig);
    for (const slot of GEAR_SLOTS) {
      const it = d.gear[slot], el = document.createElement('button'); el.type = 'button'; el.className = 'dslot s-' + slot + (it ? '' : ' empty');
      if (it) { const R = rarityOf(it); el.style.setProperty('--rc', R.color); el.append(itemPicture(it, 44)); el.title = `${it.name} (${R.name})`; el.setAttribute('aria-label', `${SLOT_LABEL[slot]}: ${it.name}`); }
      else { el.append(this.h(`<span class="plus">+</span>`)); el.setAttribute('aria-label', `Equip ${SLOT_LABEL[slot]}`); }
      el.append(this.h(`<span class="dl">${esc(SLOT_LABEL[slot])}</span>`));
      el.onclick = () => UI.open('equip', { v, slot });
      doll.append(el);
    }
    cols.append(doll);
    // the stats: what they were born with (cream), what their trait, training and gear add (amber), mastery at 10
    const st = document.createElement('div'); st.className = 'sh-stats';
    st.append(this.h(`<h3>GEARS</h3>`));
    for (const k of 'GEARS') {
      const s = statOf(v, k), base = d.stats[k], extra = Math.max(0, s - base);
      st.append(this.h(`<div class="srow" title="${esc(STAT_NAMES[k])}: ${base} of their own${extra ? `, +${extra} from trait and gear` : ''}${mastered(v, k) ? '. Mastered.' : ''}">
        <span class="sk">${k}</span><span class="sn">${esc(STAT_NAMES[k])}</span>
        <span class="sbar"><i class="sb-own" style="width:${Math.min(100, base / 16 * 100)}%"></i><i class="sb-more" style="left:${Math.min(100, base / 16 * 100)}%;width:${Math.min(100 - base / 16 * 100, extra / 16 * 100)}%"></i><em style="left:${10 / 16 * 100}%"></em></span>
        <span class="sv">${s}${extra ? `<small>+${extra}</small>` : ''}${mastered(v, k) ? '<b>★</b>' : ''}</span></div>`));
    }
    // how they fight
    const w = g.weapon, wa = F.aspect && D.ASPECTS[F.aspect];
    const fight = [`<span><b>${Math.round(F.dps)}</b> damage a second</span>`, `<span><b>${maxHpOf(v)}</b> health</span>`];
    if (g.guard) fight.push(`<span><b>${g.guard}%</b> guard</span>`);
    fight.push(`<span>${F.ranged ? `<b>${Math.round(F.range)} m</b> reach` : 'Close in'}</span>`);
    if (wa) fight.push(`<span style="color:${wa.color || 'inherit'}">${esc(wa.name)}</span>`);
    st.append(this.h(`<h3>In a fight${w ? ` · ${esc(w.name)}` : ' · bare-handed'}</h3><div class="sh-fight">${fight.join('')}</div>`));
    const job = v.jobB, out = job && job !== WALLB ? outFor(g, job.type) : 0, more = [];
    if (out) more.push(`<span class="chip amber">+${out}% at work</span>`);
    if (g.findLuck) more.push(`<span class="chip">+${+g.findLuck.toFixed(2)} luck</span>`);
    if (g.night) more.push(`<span class="chip">+${g.night}% at night</span>`);
    if (g.speed) more.push(`<span class="chip">+${g.speed}% speed</span>`);
    if (more.length) st.append(this.h(`<div class="stats-row">${more.join('')}</div>`));
    cols.append(st);
    card.append(cols);
    // what they carry, piece by piece
    const kit = GEAR_SLOTS.map(sl => d.gear[sl]).filter(Boolean);
    if (kit.length) {
      const list = document.createElement('div'); list.className = 'sh-kit';
      for (const it of kit) {
        const R = rarityOf(it), row = document.createElement('button'); row.type = 'button'; row.className = 'kit';
        row.append(itemPicture(it, 36));
        row.append(this.h(`<span><span class="nm" style="color:${R.color}">${esc(it.name)}</span><span class="jb">${esc(R.name)} · ${esc(itemLines(it)[0] || D.ITEMS[it.base]?.text || '')}</span></span>`));
        row.onclick = () => UI.open('item', { it, back: () => UI.open('villager', v) });
        list.append(row);
      }
      card.append(list);
    }
    body.append(card);
  },
  gearBlock(body, v, back) {
    const g = gearOf(v), F = fightOf(v);
    body.append(this.h(`<h3>Gear</h3>`));
    const box = document.createElement('div'); box.className = 'gearslots';
    for (const slot of GEAR_SLOTS) {
      const it = v.d.gear[slot], el = document.createElement('button'); el.type = 'button';
      if (it) { el.className = 'gslot'; el.style.borderColor = rarityOf(it).color + '99'; el.append(itemPicture(it, 40)); el.append(this.h(`<b style="color:${rarityOf(it).color}">${esc(SLOT_LABEL[slot])}</b>`)); el.title = it.name; el.setAttribute('aria-label', `${SLOT_LABEL[slot]}: ${it.name}`); }
      else { el.className = 'gslot empty'; el.append(this.h(`<span class="plus">+</span><span>${esc(SLOT_LABEL[slot])}</span>`)); el.setAttribute('aria-label', `Equip ${SLOT_LABEL[slot]}`); }
      el.onclick = () => UI.open('equip', { v, slot, back });
      box.append(el);
    }
    body.append(box);
    const chips = [`<span class="chip">${Math.round(F.dps)} damage a second${F.ranged ? ` · reach ${Math.round(F.range)} m` : ''}</span>`, `<span class="chip">${maxHpOf(v)} health</span>`];
    if (g.guard) chips.push(`<span class="chip">${g.guard}% guard</span>`);
    const job = v.jobB, out = job && job !== WALLB ? outFor(g, job.type) : 0;
    if (out) chips.push(`<span class="chip amber">+${out}% at work</span>`);
    if (g.findLuck) chips.push(`<span class="chip">+${+g.findLuck.toFixed(2)} luck</span>`);
    body.append(this.h(`<div class="stats-row">${chips.join('')}</div>`));
  },
  equipPick(body, { v, slot, back }) {
    const cur = v.d.gear[slot];
    body.append(this.h(`<h2>${esc(SLOT_LABEL[slot])} for ${esc(v.d.name.split(' ')[0])}</h2><p class="sub">${esc(D.SLOTS[slot].text)}</p>`));
    const list = document.createElement('div'); list.className = 'list';
    if (cur) { body.append(this.h(`<h3>Wearing</h3>`)); list.append(this.itemRow(cur, 'Take off', () => { unequip(v, slot); AUDIO.play('tap'); UI.open('equip', { v, slot, back }); })); body.append(list); }
    const opts = GAME.stash.filter(it => wearable(it) && it.slot === slot).sort((a, b) => LOOT.rankOf(b.rarity) - LOOT.rankOf(a.rarity) || (b.ilvl || 0) - (a.ilvl || 0));
    body.append(this.h(`<h3>In the stash · ${opts.length}</h3>`));
    const l2 = document.createElement('div'); l2.className = 'list';
    for (const it of opts) l2.append(this.itemRow(it, 'Equip', () => { equip(v, it); AUDIO.play('tap'); toast(`<b>${esc(v.d.name.split(' ')[0])}</b> takes the <b style="color:${rarityOf(it).color}">${esc(it.name)}</b>.`); back ? back() : UI.open('villager', v); }));
    if (!opts.length) l2.append(this.h(`<p class="small">Nothing for this slot yet. Wildlight drop gear, miners turn it up, and the wilds are full of it.</p>`));
    body.append(l2);
    this.back(body, 'Back', () => back ? back() : UI.open('villager', v));
  },
  itemRow(it, action, onAct) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'irow';
    el.append(itemPicture(it, 40));
    const first = itemLines(it)[0] || D.ITEMS[it.base]?.text || '';
    el.append(this.h(`<span><span class="nm" style="color:${rarityOf(it).color}">${esc(it.name)}</span><span class="jb">${esc(rarityOf(it).name)} · ${esc(first)}</span></span><span class="side">${esc(action || '')}</span>`));
    el.onclick = onAct || (() => UI.open('item', { it }));
    return el;
  },
  item(body, { it, back }) {
    const R = rarityOf(it), { relic, base } = itemBase(it);
    const top = document.createElement('div'); top.className = 'ihead'; top.style.setProperty('--rc', R.color); top.append(itemPicture(it, 88));
    top.append(this.h(`<div><h2 style="color:${R.color}">${esc(it.name)}</h2><p class="sub">${esc(R.name)} ${esc(D.SLOTS[it.slot]?.name || '')}${it.ilvl ? ' · item level ' + it.ilvl : ''}</p></div>`));
    body.append(top);
    const lines = itemLines(it);
    if (lines.length) body.append(this.h(`<ul class="traits">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`));
    const p = relic && relic.power || it.power;
    if (p && !it.unassayed) body.append(this.h(`<div class="power"><b>${esc(p.name)}.</b> ${esc(p.text)}</div>`));
    if (relic && relic.town) body.append(this.h(`<p class="small">${esc(relic.town.text)}</p>`));
    if (it.unassayed) {
      const a = this.h(`<div class="power">Unassayed. The maker's mark is there but nobody has read it. <button type="button" class="btn" style="margin-top:6px">Ask Absalom to assay it · ${SHARD} ${D.WORKSHOP.assay}</button></div>`);
      a.querySelector('button').onclick = () => { if (GAME.shards < D.WORKSHOP.assay) return toast('Not enough shards.'); GAME.shards -= D.WORKSHOP.assay; delete it.unassayed; AUDIO.play('chime'); toast(`Absalom reads the mark: <b>${esc(it.power?.name || 'a maker he knows')}</b>.`); UI.refresh(); };
      body.append(a);
    }
    if (it.logbook) body.append(this.h(`<p class="lore">${esc(it.logbook)}</p>`));
    if (relic && relic.lore) body.append(this.h(`<p class="lore">${esc(relic.lore)}</p>`));
    else if (base && base.text) body.append(this.h(`<p class="lore">${esc(base.text)}</p>`));
    if (it.from) body.append(this.h(`<p class="small">From ${esc(it.from)}.</p>`));
    this.back(body, 'Back', back || (() => UI.open('roster', null)));
  },
  jobs(body, v) {
    body.append(this.h(`<h2>A job for ${esc(v.d.name.split(' ')[0])}</h2><p class="sub">Stars show how well their stats fit.</p>`));
    const list = document.createElement('div'); list.className = 'list';
    const opts = [...Object.values(TOWN.b).filter(b => b.def.job && b.level > 0 && !b.pending), WALLB];
    opts.sort((a, c) => statOf(v, c.def.job.stat) - statOf(v, a.def.job.stat));
    for (const b of opts) {
      const s = statOf(v, b.def.job.stat), n = slotsOf(b), used = workersOf(b.id).length, mine = v.d.job && v.d.job.bid === b.id;
      const full = used >= n && !mine;
      const el = document.createElement('button'); el.type = 'button'; el.className = 'li'; if (full) el.disabled = true;
      el.style.gridTemplateColumns = '1fr auto'; el.style.opacity = full ? 0.5 : 1;
      el.append(this.h(`<span><span class="nm">${esc(b.def.job.title)} · ${esc(b.name || b.def.name)}</span><span class="jb">${mine ? 'Current job' : full ? 'Full' : `${used} of ${n} places taken`}${b.def.job.night ? ' · works nights' : ''}</span></span><span class="fit">${stars(s)} <em>${STAT_NAMES[b.def.job.stat]} ${s}</em></span>`));
      el.onclick = () => { if (mine) return UI.open('villager', v); if (v.d.study) endStudy(v); if (assignJob(v, b.id)) { v.d.pref = b === WALLB ? 'wall' : b.type; toast(`<b>${esc(v.d.name)}</b> is now a ${b.def.job.title.toLowerCase()}.`); AUDIO.play('tap'); } UI.open('villager', v); };
      list.append(el);
    }
    const none = document.createElement('button'); none.type = 'button'; none.className = 'li'; none.style.gridTemplateColumns = '1fr'; none.append(this.h(`<span><span class="nm">No job</span><span class="jb">Rest and wander the plateau</span></span>`));
    none.onclick = () => { assignJob(v, null); v.d.pref = null; UI.open('villager', v); };
    list.append(none);
    body.append(list);
  },
  roster(body) {
    const n = GAME.villagers.length, idle = GAME.villagers.filter(v => !v.d.job && !v.d.exp).length, out = expOut();
    body.append(this.h(`<h2>The crew</h2><p class="sub">${n} people · ${totalBeds()} beds in the Keep · ${idle ? idle + ' without work' : 'everyone busy'}</p>`));
    const tabs = this.h(`<div class="tabs" role="group" aria-label="Show"><button type="button" data-t="crew">Crew</button><button type="button" data-t="wilds">Wilds · ${out.length}/${expLimit()}</button><button type="button" data-t="stash">Stash · ${GAME.stash.length}</button></div>`);
    for (const bt of tabs.querySelectorAll('button')) { bt.setAttribute('aria-pressed', bt.dataset.t === this.tab); bt.onclick = () => { this.tab = bt.dataset.t; this.refresh(); }; }
    body.append(tabs);
    const list = document.createElement('div'); list.className = 'list';
    if (this.tab === 'crew') {
      const order = v => v.d.exp ? 'zzz' : v.d.job && v.jobB ? (v.jobB.name || v.jobB.def.name) : 'zz';
      for (const v of [...GAME.villagers].sort((a, b) => order(a).localeCompare(order(b)))) {
        const b = v.jobB, top = Object.entries(v.d.stats).sort((x, y) => statOf(v, y[0]) - statOf(v, x[0]))[0][0];
        const el = document.createElement('button'); el.type = 'button'; el.className = 'li';
        el.append(miniSprite(v, 30, 40));
        const st = v.d.study ? `${v.d.study.role === 'tutor' ? 'Teaching' : 'Studying'} · ${STUDY[GAME.rooms[v.d.study.room].type].name}` : null;
        el.append(this.h(`<span><span class="nm">${esc(v.d.name)}</span><span class="jb">${v.d.exp ? 'In the wilds' : st ? esc(st) : b ? esc(b.def.job.title + ' · ' + (b.name || b.def.name)) : 'No job'}</span></span><span class="fit"><em>${STAT_NAMES[top]}</em> ${statOf(v, top)}</span>`));
        el.onclick = () => { SEL.villager = v; FOLLOW.v = null; UI.open('villager', v); if (!v.hidden) focusOn(v.pos); };
        list.append(el);
      }
    } else if (this.tab === 'wilds') {
      body.append(this.h(`<p class="small">Down the rope stair in the cut face: scree, then gorse moor, old-age ruins and the wreck fields under the Thinning. The longer they stay, the farther they get. ${out.length} of ${expLimit()} out; raise the Keep to send more.</p>`));
      for (const v of out) {
        const E = v.d.exp, el = document.createElement('button'); el.type = 'button'; el.className = 'li';
        el.append(miniSprite(v, 30, 40));
        const st = E.state === 'leaving' ? 'Heading for the rope stair' : E.state === 'out' ? `${fmtSpan(E.out)} out · ${WILDS.zones[E.zone].name}` : E.state === 'back' ? `Coming home · ${fmtSpan(Math.max(0, E.ret))} away` : 'Climbing up';
        el.append(this.h(`<span><span class="nm">${esc(v.d.name)}</span><span class="jb">${esc(st)}</span></span><span class="fit">${E.haul.items.length} finds <em>· ${Math.round(E.hp)}/${E.maxHp}</em></span>`));
        el.onclick = () => UI.open('exp', v); list.append(el);
      }
      if (!out.length) list.append(this.h(`<p class="small">Nobody is out. Tap anyone, kit them out, and send them.</p>`));
    } else {
      const m = GAME.mats, mats = Object.entries(D.MATERIALS).map(([k, x]) => `<span class="chip">${esc(x.name)} ${m[k] || 0}</span>`), cells = Object.entries(GAME.cells).filter(([, n]) => n).map(([k, n]) => `<span class="chip">${esc(D.CELLS[k].name)} ${n}</span>`);
      body.append(this.h(`<p class="small">Everything not being worn. Tap a piece to read it; equip it from a person's Gear.</p><div class="mats">${mats.join('')}${cells.join('')}${GAME.blueprints.length ? `<span class="chip">${GAME.blueprints.length} blueprints</span>` : ''}</div>`));
      for (const it of GAME.stash) list.append(this.itemRow(it, D.SLOTS[it.slot]?.name || '', () => UI.open('item', { it, back: () => UI.open('roster') })));
      if (!GAME.stash.length) list.append(this.h(`<p class="small">The stash is empty.</p>`));
    }
    body.append(list);
  },
  prep(body, v) {
    const d = v.d;
    UI.rations = UI.rations ?? 3;
    body.append(this.h(`<h2>Ready ${esc(d.name.split(' ')[0])} for the wilds</h2><p class="sub">Down the rope stair in the cut face. Grit digs, Sowing forages, Agility spots and dodges, Engineering salvages, Rapport trades. A weapon and guard keep them standing.</p>`));
    this.gearBlock(body, v, () => UI.open('prep', v));
    const g = gearOf(v);
    const warn = [];
    if (!g.weapon) warn.push('No weapon in hand: every fight will hurt.');
    if (!g.guard) warn.push('Nothing to turn a blow.');
    if (warn.length) body.append(this.h(`<p class="small" style="color:var(--warn)">${warn.map(esc).join(' ')}</p>`));
    const maxR = Math.min(8, Math.floor(GAME.food / WILDS.ration)); UI.rations = Math.min(UI.rations, maxR);
    const rr = this.h(`<h3>Rations · ${WILDS.ration} food each</h3><div class="stats-row" style="align-items:center"><div class="step"><button type="button" aria-label="Fewer">−</button><span>${UI.rations}</span><button type="button" aria-label="More">+</button></div><span class="small">They eat one when badly hurt. You have ${Math.floor(GAME.food)} food.</span></div>`);
    const [minus, plus] = rr.querySelectorAll('.step button');
    minus.onclick = () => { UI.rations = Math.max(0, UI.rations - 1); UI.refresh(); }; plus.onclick = () => { UI.rations = Math.min(maxR, UI.rations + 1); UI.refresh(); };
    body.append(rr);
    UI.orders = UI.orders || { far: 1, turnAt: 0.5 };
    const O = UI.orders, FAR = ['Scree', 'Moors', 'Ruins', 'Wrecks'], TURN = [[0.5, 'Half health'], [0.25, 'A quarter'], [0, 'Never']];
    const ord = this.h(`<h3>Orders</h3><p class="small">Go as far as</p><div class="seg" role="group" aria-label="How far">${FAR.map((n, i) => `<button type="button" data-f="${i}" aria-pressed="${O.far === i}">${n}</button>`).join('')}</div>
      <p class="small" style="margin-top:8px">Turn back when health falls below</p><div class="seg" role="group" aria-label="Turn back at">${TURN.map(([k, n]) => `<button type="button" data-t="${k}" aria-pressed="${O.turnAt === k}">${n}</button>`).join('')}</div>
      <p class="small" style="margin-top:6px">${esc(WILDS.zones[O.far].name)}: ${esc(WILDS.zones[O.far].text)} They'll spend about a day there, then come home.${O.far === 3 ? ' (At the wrecks they keep searching until hurt.)' : ''}</p>`);
    for (const b of ord.querySelectorAll('[data-f]')) b.onclick = () => { O.far = +b.dataset.f; UI.refresh(); };
    for (const b of ord.querySelectorAll('[data-t]')) b.onclick = () => { O.turnAt = +b.dataset.t; UI.refresh(); };
    body.append(ord);
    if (v.jobB) body.append(this.h(`<p class="small" style="margin-top:8px">They'll leave their place as ${esc(v.jobB.def.job.title.toLowerCase())} and take it back when they're home, if it's still free.</p>`));
    const go = this.h(`<div class="stats-row" style="margin-top:12px"><button type="button" class="btn primary">Set out</button><button type="button" class="btn">Not yet</button></div>`);
    const [ok, no] = go.querySelectorAll('button');
    ok.onclick = () => { if (sendExpedition(v, UI.rations, { ...UI.orders })) { toast(`<b>${esc(d.name)}</b> heads for the rope stair.`); UI.open('exp', v); } else toast('They can\'t go just now.'); };
    no.onclick = () => UI.open('villager', v);
    body.append(go);
  },
  exp(body, v) {
    const E = v.d.exp;
    if (!E) { body.append(this.h(`<h2>${esc(v.d.name)}</h2><p>Home again.</p>`)); this.back(body, 'Back', () => UI.open('villager', v)); return; }
    const top = document.createElement('div'); top.className = 'portrait'; top.append(miniSprite(v, 72, 96));
    const st = E.state === 'leaving' ? 'Heading for the rope stair' : E.state === 'out' ? `${fmtSpan(E.out)} out` : E.state === 'back' ? `Coming home · ${fmtSpan(Math.max(0, E.ret))} away` : 'Climbing the rope stair';
    top.append(this.h(`<div style="flex:1"><h2>${esc(v.d.name)}</h2><p class="zone">${esc(WILDS.zones[E.zone].name)}</p><p class="sub">${esc(st)}</p></div>`));
    body.append(top);
    const k = E.hp / E.maxHp;
    body.append(this.h(`<div class="hp ${k < 0.35 ? 'low' : ''}" role="meter" aria-valuemin="0" aria-valuemax="${E.maxHp}" aria-valuenow="${Math.round(E.hp)}" aria-label="Health"><i style="width:${Math.max(2, k * 100)}%"></i></div><p class="small">Health ${Math.round(E.hp)} of ${E.maxHp} · ${E.rations} ration${E.rations === 1 ? '' : 's'} left</p>`));
    const H = E.haul, bits = [];
    if (H.ore) bits.push(`${H.ore} ore`); if (H.shards) bits.push(`${H.shards} shards`); if (H.food) bits.push(`${H.food} food`);
    for (const [m, n] of Object.entries(H.mats)) if (n) bits.push(`${n} ${D.MATERIALS[m].name}`);
    if (H.recruits) bits.push(`${H.recruits} traveller${H.recruits > 1 ? 's' : ''}`);
    body.append(this.h(`<h3>Haul</h3><p>${bits.length ? esc(bits.join(' · ')) : 'Nothing yet.'}</p>`));
    if (H.items.length) { const box = document.createElement('div'); box.className = 'haul'; for (const it of H.items) { const c = itemIcon(it, 64); c.title = it.name; box.append(c); } body.append(box); }
    if (E.state === 'out') { const r = this.h(`<div class="stats-row" style="margin-top:10px"><button type="button" class="btn primary">Recall · about ${fmtSpan(Math.max(HOUR * 2, E.out * 0.5))} home</button></div>`); r.querySelector('button').onclick = () => { recallExpedition(v); AUDIO.play('tap'); UI.refresh(); }; body.append(r); }
    body.append(this.h(`<h3>Log</h3>`));
    const log = document.createElement('div'); log.className = 'log';
    for (const e of E.log) log.append(this.h(`<div class="e ${e.kind}"><span class="t">${fmtSpan(e.t)}</span><span>${e.text}</span></div>`));
    body.append(log);
  },
};
function upgrade(b) {
  const lv = b.level, cost = b.def.cost[lv + 1];
  if (GAME.shards < cost || b.building) return;
  GAME.shards -= cost;
  if (b === WALLB) {
    TOWN.wallLevel = lv + 1; wallSetLevel(TOWN.wallLevel, true);
    for (const s of WALL.segs) { s.hp = 1; s.broken = false; }
    toast('Masons are raising <b>the stone wall</b>.'); AUDIO.play('build');
    setTimeout(() => { buildNav(); UI.refresh(); }, 6500);
    UI.refresh(); return;
  }
  b.build(lv + 1, () => {
    buildNav();
    if (b.type === 'keep') { toast(`<b>The Keep</b> is now level ${b.level}: ${DEFS.keep.beds[b.level]} beds, a new floor of rooms, more room to build, and ${EXP_LIMIT[b.level]} expeditions at once.`); buildInterior(); }
    else toast(`<b>${b.name || b.def.name}</b> is now level ${b.level}.`);
    autoAssign(); UI.refresh();
  });
  if (b.type === 'head' && lv + 1 === 2) openDeepSeam();
  UI.refresh();
}
function openDeepSeam() {
  const t0 = performance.now() / 1000;
  AUDIO.play('crack');
  setTimeout(() => toast('The deep seam is open. <b>Richer ore, and something stirs below.</b>', 'night'), 1200);
  MINE_BREAK.t0 = t0;
  if (VIEW.mode !== 'mine') setTimeout(() => setView('mine'), 300);
}
const MINE_BREAK = { t0: 0 };
function mineBreakUpdate(now) {
  if (!MINE_BREAK.t0) { for (const m of minePlugs) m.visible = TOWN.b.head.level < 2; mineDecor.g2.visible = TOWN.b.head.level >= 2; return; }
  const t = now - MINE_BREAK.t0;
  mineDecor.g2.visible = true;
  minePlugs.forEach((m, i) => {
    const k = clamp((t - 0.8 - i * 0.06) / 1.4, 0, 1);
    if (k <= 0) { m.visible = true; m.position.copy(m.userData.home); m.rotation.set(0, 0, 0); return; }
    m.visible = k < 1;
    m.position.set(m.userData.home.x + (i % 2 ? 1 : -1) * k * 1.5, m.userData.home.y - k * k * 20, m.userData.home.z + k * 3);
    m.rotation.set(k * 2, 0, (i % 3 - 1) * k * 2);
    if (k > 0 && k < 0.1 && Math.random() < 0.3) FX.puff(new THREE.Vector3(m.userData.cx, m.userData.cy, WORLD.faceZ + 0.5), 4, 0xa89070, 1.4);
  });
  if (t > 4) MINE_BREAK.t0 = 0;
}

// ----------------------------------------------------------------- HUD
const dialCtx = $('#dial').getContext('2d');
let hudT = 0;
const PHASE_NAMES = t => t < 0.05 ? 'First light' : t < 0.2 ? 'Morning' : t < 0.42 ? 'Midday' : t < 0.6 ? 'Afternoon' : t < 0.69 ? 'Dusk' : t < 0.82 ? 'Night' : t < 0.96 ? 'Deep night' : 'Before dawn';
function updateHUD(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.25;
  const set = (id, v) => { const el = $(id + ' b'); if (el.textContent !== v) el.textContent = v; };
  set('#r-ore', fmt(GAME.ore)); set('#r-shards', fmt(GAME.shards)); set('#r-food', fmt(GAME.food));
  set('#r-pop', GAME.villagers.length + '/' + totalBeds());
  const out = expOut().length, eb = $('#exp-badge'); if (eb.textContent !== (out ? String(out) : '')) eb.textContent = out ? String(out) : ''; eb.hidden = !out;
  $('#r-food').classList.toggle('low', GAME.food < 5);
  $('#r-shards').classList.toggle('low', GAME.shards < 10 && TOD.night > 0.3);
  $('#dayname').textContent = 'Day ' + GAME.day; $('#phase').textContent = PHASE_NAMES(GAME.t);
  // the dial: sun half and night half, with a hand
  const g = dialCtx, W = 96, c = W / 2;
  g.clearRect(0, 0, W, W);
  const a0 = -Math.PI / 2;
  g.lineWidth = 10;
  g.strokeStyle = '#e6b955'; g.beginPath(); g.arc(c, c, 38, a0, a0 + 0.67 * TAU); g.stroke();
  g.strokeStyle = '#4b3a72'; g.beginPath(); g.arc(c, c, 38, a0 + 0.67 * TAU, a0 + TAU); g.stroke();
  const a = a0 + GAME.t * TAU;
  g.fillStyle = TOD.night > 0.5 ? '#cfd8ff' : '#ffcf85'; g.beginPath(); g.arc(c + Math.cos(a) * 38, c + Math.sin(a) * 38, 11, 0, TAU); g.fill();
  g.strokeStyle = '#2a1b2f'; g.lineWidth = 3; g.stroke();
  if (UI.cur && (UI.cur.kind === 'building' || UI.cur.kind === 'villager') && !document.activeElement?.closest?.('#panel')) { UI.liveT = (UI.liveT || 0) + 1; if (UI.liveT % 8 === 0) UI.refresh(); }
}
// ----------------------------------------------------------------- labels over the scene
const SEL = { villager: null, building: null };
const FOLLOW = { v: null };
const tagEls = new Map();
const _pp = new THREE.Vector3();
function updateLabels() {
  const want = [], K = VIEW.mode === 'keep', cam = K ? kcam : camera;
  if (K) {
    for (const t of KEEPV.tags) { const r = typeof t.key === 'number' ? GAME.rooms[t.key] : null, n = r ? r.type ? roomStudents(t.key).length : 0 : 0;
      want.push({ key: 'room' + t.key, html: r && !r.type ? 'Empty room <small>tap to furnish</small>' : `${esc(roomName(t.key))}${r ? ` <small>${n}/${ROOM_SEATS[r.level]}</small>` : ''}`, pos: t.pos, cls: r && !r.type ? 'plot' : '' }); }
    if (SEL.villager && SEL.villager.isprite.visible) want.push({ key: 'sel', html: esc(SEL.villager.d.name), pos: SEL.villager.isprite.position.clone().add(new THREE.Vector3(0, 2.3, 0)), cls: '' });
  } else {
  if (SEL.villager && !SEL.villager.hidden) want.push({ key: 'sel', html: esc(SEL.villager.d.name), pos: _pp.copy(SEL.villager.pos).add(new THREE.Vector3(0, 2.3, 0)).clone(), cls: '' });
  if (BUILD.on && BUILD.sel && !BUILD.pending) want.push({ key: 'bsel', html: `${esc(BUILD.sel.name)} <small>${BUILD.sel.tile ? 'drag to move' : 'fixed'}</small>`, pos: new THREE.Vector3(BUILD.sel.L.x, { lens: 9, keep: 13, mast: 16, shop: 8, garden: 4.5, yard: 3.5, ballista: 3.5 }[BUILD.sel.type] || 5, BUILD.sel.L.z), cls: 'build' });
  for (const b of Object.values(TOWN.b)) if (b.building) want.push({ key: 'b' + b.id, html: `Building <small>${Math.max(0, Math.ceil(b.doneAt - performance.now() / 1000))}s</small>`, pos: b.worldPos(0, 6, 0), cls: 'build' });
  }
  const seen = new Set();
  const W = innerWidth, H = innerHeight;
  for (const w of want) {
    seen.add(w.key);
    let el = tagEls.get(w.key);
    if (!el) { el = document.createElement('div'); el.className = 'tag ' + w.cls; $('#labels').append(el); tagEls.set(w.key, el); }
    if (el.innerHTML !== w.html) el.innerHTML = w.html;
    const p = w.pos.clone().project(cam);
    const vis = p.z < 1 && p.x > -1.1 && p.x < 1.1 && p.y > -1.1 && p.y < 1.1;
    el.style.display = vis ? '' : 'none';
    if (vis) el.style.transform = `translate(${(p.x * 0.5 + 0.5) * W}px, ${(-p.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
    el.style.left = '0'; el.style.top = '0';
  }
  for (const [k, el] of tagEls) if (!seen.has(k)) { el.remove(); tagEls.delete(k); }
}
