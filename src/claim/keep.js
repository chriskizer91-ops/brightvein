// ===================================================================== THE KEEP, CUT OPEN: rooms, and study (Fallout Shelter side)
// Tap Keep and the front wall comes away. The ground floor is the Hearth Hall and the dormitory;
// above are room slots that open with the Keep's level (2 at level 1, 4 at level 2, 5 at level 3).
// Furnish each as one of five studies, one per GEARS stat. Students leave their job and train that
// stat a point at a time; a tutor strong in the stat speeds everyone up. Reaching 10 is mastery.
// This file has the rules, the Keep view's camera and tapping; keeplook.js has how it looks, keeplife.js who is in it.
const FH = 4.4, RW = 9, SWD = 3.4, KD = 6.4, KW = RW * 2 + SWD;
const STUDY = {
  G: { name: 'Drill Yard', tutor: 'Corwin Ashlar', tool: 'lance', blurb: 'Straw dummies, iron weights, a heavy bag and a sparring ring. Students come out harder: better miners and a stronger watch.', perk: 'Seam-sense', perkText: '+20% at Grit work, and 20% harder in a fight' },
  E: { name: 'Drafting Loft', tutor: 'Odile Fenn', tool: 'spanner', blurb: 'Drafting tables, a brass orrery, a workbench and a great many pencil shavings. Better cutters and menders.', perk: 'True Hand', perkText: '+20% at Engineering work, and more salvage in the wilds' },
  A: { name: 'Rigging Loft', tutor: 'Hesper Lark', tool: 'rope', blurb: 'A climbing wall, rope nets, a haul to heave and a bench of sighting lenses. Quicker hands for the lens towers and the Lark.', perk: 'Hawk-eye', perkText: '+20% at Agility work, and twice as quick to dodge in the wilds' },
  R: { name: 'Parlour', tutor: 'Absalom Pockett', tool: 'book', blurb: 'Armchairs by a little fire, tea, a map table and argument. Clerks who could talk a courier into anything.', perk: 'Silver Tongue', perkText: '+20% at Rapport work, and better company on the road' },
  S: { name: 'Seed Library', tutor: 'Marigold Thresh', tool: 'can', blurb: 'Jars of seed, a glasshouse nook of seed trays, a potting bench and the bees. Gardeners and tenders who know their sun.', perk: 'Green Sun', perkText: '+20% at Sowing work, and more foraging in the wilds' },
};
const ROOM_COST = [0, 80, 140, 220];          // furnish, then two upgrades
const ROOM_SEATS = [0, 2, 3, 4], ROOM_SPEED = [0, 1, 1.3, 1.6];
const SLOT_POS = [[1, -1], [1, 1], [2, -1], [2, 1], [3, -1]];   // floor, side
const SLOT_KEEP_LV = [1, 1, 2, 2, 3];
const STAT_MAX = 10;
// time to raise a stat by one point, in game seconds (one real second each at 1×)
const pointTime = s => Math.round(90 * Math.pow(s + 1, 1.6));   // 3→4 about 14 min, 9→10 about an hour
const mastered = (v, k) => v.d.stats[k] >= STAT_MAX;
const fmtReal = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`; };
const keepLv = () => (TOWN.b.keep && TOWN.b.keep.level) || 1;
const slotOpen = i => keepLv() >= SLOT_KEEP_LV[i];
const roomPeople = i => GAME.villagers.filter(v => v.d.study && v.d.study.room === i);
const roomStudents = i => roomPeople(i).filter(v => v.d.study.role === 'student');
const roomTutor = i => roomPeople(i).find(v => v.d.study.role === 'tutor');
// what a student or tutor has in hand: their study's tool (people.js asks this when it draws them)
const studyTool = v => { const S = v.d.study, r = S && GAME.rooms[S.room]; return r && r.type ? STUDY[r.type].tool : null; };
function tutorMult(i) { const r = GAME.rooms[i], t = roomTutor(i); if (!t || !r.type) return 1; return 1 + Math.max(0, statOf(t, r.type) - 5) * 0.15 * (mastered(t, r.type) ? 1.15 : 1); }
const studyRate = i => ROOM_SPEED[GAME.rooms[i].level] * tutorMult(i) * studyBoost();   // studyBoost: the Keep’s Book Lockers (fittings.js)
const studyLeft = v => { const S = v.d.study, k = GAME.rooms[S.room].type; return (pointTime(v.d.stats[k]) - S.prog) / Math.max(0.01, studyRate(S.room)); };
function canStudent(v, i) { const r = GAME.rooms[i]; return r.type && !v.d.exp && v.d.stats[r.type] < STAT_MAX && roomStudents(i).length < ROOM_SEATS[r.level] && !(v.d.study && v.d.study.room === i); }
function canTutor(v, i) { const r = GAME.rooms[i]; return r.type && !v.d.exp && !roomTutor(i) && statOf(v, r.type) >= 7; }
function startStudy(v, i, role) {
  if (role === 'student' ? !canStudent(v, i) : !canTutor(v, i)) return false;
  const b = v.jobB; if (b) v.d.pref = b === WALLB ? 'wall' : b.type;
  v.d.job = null;
  v.d.study = { room: i, role, prog: v.d.study && v.d.study.room === i ? v.d.study.prog : 0 };
  v.redraw();   // with the study’s tool in hand
  v.replan = true;
  if (FOLLOW.v === v) FOLLOW.v = null;
  return true;
}
function endStudy(v) { if (!v.d.study) return; v.d.study = null; v.replan = true; v.redraw(); autoAssign(); }
// advance everyone's study; returns the points gained. While away, count it even if they hadn't reached the room yet.
function updateStudies(dt, away = false) {
  const ups = [];
  for (let i = 0; i < GAME.rooms.length; i++) {
    const r = GAME.rooms[i]; if (!r.type) continue;
    const rate = studyRate(i), k = r.type;
    for (const v of roomStudents(i)) {
      if (!away && v.where !== 'study') continue;
      const S = v.d.study; S.prog += dt * rate;
      while (v.d.stats[k] < STAT_MAX && S.prog >= pointTime(v.d.stats[k])) { S.prog -= pointTime(v.d.stats[k]); v.d.stats[k]++; ups.push({ v, k, to: v.d.stats[k] }); }
      if (v.d.stats[k] >= STAT_MAX) endStudy(v);
    }
  }
  return ups;
}
function announceStudy(ups) {
  for (const u of ups) {
    // in the Keep view, a burst of sparks over them (keeplook.js)
    if (VIEW.mode === 'keep' && KEEPX.fx && u.v.kin && u.v.kin.c) KEEPX.fx.sparks(u.v.kin.c.clone().setY(u.v.kin.c.y + 0.9), u.to >= STAT_MAX ? 40 : 18, u.to >= STAT_MAX ? 0xffe08a : 0xffc070, u.to >= STAT_MAX ? 3 : 2);
    const first = esc(u.v.d.name.split(' ')[0]);
    if (u.to >= STAT_MAX) { toast(`<b>${first}</b> has mastered ${STAT_NAMES[u.k]}: <b>${esc(STUDY[u.k].perk)}</b>. ${esc(STUDY[u.k].perkText)}.`); AUDIO.play('levelup'); }
    else { toast(`<b>${first}</b>'s ${STAT_NAMES[u.k]} is now <b>${u.to}</b>.`); AUDIO.play('statup'); }
  }
  if (ups.length) UI.refresh();
}

// ----------------------------------------------------------------- the cutaway: what's in it (keeplook.js), who's in it (keeplife.js)
const KEEPV = { group: null, sig: '', hits: [], tags: [], lights: [], spots: [], beds: [], rooms: {}, dyn: [], H: 0, nF: 2, live: false };
// who is where inside, each frame (keeplife.js); the Keep's look is kept up while you're looking (keeplook.js)
function updateInterior(rdt = 0, gdt = 0) { KEEPV.live = VIEW.mode === 'keep'; keepLifeUpdate(rdt, gdt); }

// ----------------------------------------------------------------- the Keep view's camera: straight at the cutaway
// Drag (one finger on a phone) to pan, the wheel or a pinch to zoom; it can't wander off the Keep. Landscape screens
// see the whole Keep; phones held upright see one side and the stair, and swipe across for the other.
const KCAM = { x: 0, y: 6, d: 40, wx: 0, wy: 6, wd: 40, tilt: 0.09, ptrs: new Map() };
const kcamT = () => Math.tan(THREE.MathUtils.degToRad(kcam.fov / 2));
const keepTop = () => (KEEPV.H || 2 * FH) + 5.6 + (keepLv() >= 3 ? 3.4 : 0);
const kfree = () => Math.max(0.6, 1 - 150 / innerHeight);
// far enough out to see the whole Keep, ground to beacon, and no further
function keepMaxDist() { const t = kcamT(), a = innerWidth / innerHeight, w = KW + 7, h = keepTop() + 2.5; return clamp(Math.max(w / 2 / (t * a), h / 2 / (t * kfree())) * 1.06, 20, 160); }
function frameKeep(reset = true) {
  const t = kcamT(), a = innerWidth / innerHeight, top = keepTop(), bot = -1.4;
  let x, y, d;
  if (a < 0.8) {   // an upright phone: the Hearth Hall’s side and the stair, ground floor up
    const w = KW / 2 + SWD / 2 + 1.3; d = w / 2 / (t * a); x = -KW / 2 + w / 2 - 0.9;
    y = Math.max((top + bot) / 2 - d * t * 0.1, bot + d * t * 0.78);
  } else { d = keepMaxDist() / 1.06 * 1.01; x = 0; y = (top + bot) / 2 - d * t * 0.05; }
  KEEPV.dist = d;
  if (reset) { Object.assign(KCAM, { x, y, d, wx: x, wy: y, wd: d }); KLIFE.snap = true; keepCamPose(); }
  else keepClamp();
}
function keepCamPose() {
  const C = KCAM;
  kcontrols.target.set(C.x, C.y, 0);
  kcam.position.set(C.x, C.y + Math.sin(C.tilt) * C.d, Math.cos(C.tilt) * C.d);
  kcam.lookAt(kcontrols.target); kcam.updateMatrixWorld();
}
function keepClamp() {
  const C = KCAM, t = kcamT(), a = innerWidth / innerHeight, wide = innerWidth >= 900 && !!UI.cur;
  C.wd = clamp(C.wd, 7, keepMaxDist());
  // with a panel open, leave room to slide what you tapped clear of it: left on a wide screen, up on a narrow one
  const hh = C.wd * t, hw = hh * a, narrow = innerWidth < 900 && !!UI.cur;
  const x0 = -KW / 2 - 4, x1 = KW / 2 + 4 + (wide ? hw * 1.2 : 0), y0 = -2 - (narrow ? hh * 1.1 : 0), y1 = keepTop() + 1.5;
  C.wx = x1 - x0 < hw * 2 ? (x0 + x1) / 2 : clamp(C.wx, x0 + hw * 0.7, x1 - hw * 0.7);
  C.wy = y1 - y0 < hh * 2 ? clamp(C.wy, y1 - hh, y0 + hh) : clamp(C.wy, y0 + hh * 0.7, y1 - hh * 0.7);
}
function keepCamUpdate(dt) {
  const C = KCAM;
  keepClamp();
  const k = 1 - Math.exp(-dt * 12);
  C.x = lerp(C.x, C.wx, k); C.y = lerp(C.y, C.wy, k); C.d = lerp(C.d, C.wd, k);
  keepCamPose();
}
const keepCamOn = () => VIEW.mode === 'keep' && !(SKY && SKY.on) && !GAME.talk && !BUILD.on;
function keepPan(dx, dy) { const s = 2 * KCAM.d * kcamT() / innerHeight; KCAM.wx -= dx * s; KCAM.wy += dy * s; }
function keepZoom(k, sx = innerWidth / 2, sy = innerHeight / 2) {
  const C = KCAM, t = kcamT(), a = innerWidth / innerHeight, nx = sx / innerWidth * 2 - 1, ny = -(sy / innerHeight) * 2 + 1;
  const d0 = C.wd; C.wd = clamp(C.wd * k, 7, keepMaxDist()); const f = 1 - C.wd / d0;
  C.wx += nx * d0 * t * a * f; C.wy += ny * d0 * t * f;
}
// bring a room (or a point) into the clear part of the screen: left of the panel on a wide screen, above it on a phone
function keepFocus(x, y, halfW) {
  const C = KCAM, t = kcamT(), a = innerWidth / innerHeight, el = $('#panel'), box = el && !el.hidden ? el.getBoundingClientRect() : null;
  if (innerWidth < 900) {
    // the panel covers the bottom: aim at the middle of what's left between the top bar and the panel
    C.wd = Math.min(C.wd, (halfW * 2 + 1.5) / 2 / (t * a)); C.wx = x;
    const top = 60, bot = box && box.top > 100 ? box.top : innerHeight - 70, ny = 1 - (top + bot) / innerHeight;
    C.wy = y - ny * C.wd * t; return;
  }
  // the panel sits on the right: if what was tapped is under it, slide the Keep left until it's in the middle of the rest
  const hw = C.wd * t * a, left = box ? box.left : innerWidth - 400, ndcR = (left - 20) / innerWidth * 2 - 1;
  if ((x + halfW - C.wx) / hw > ndcR) C.wx = x - ((left / 2) / innerWidth * 2 - 1) * hw;
}
function keepFocusRoom(key) { const R = KEEPV.rooms[key]; if (R) keepFocus(R.cx, R.y0 + CH / 2, R.key === 'attic' ? 6 : RH); }
canvas.addEventListener('pointerdown', e => {
  if (!keepCamOn() || (e.pointerType === 'mouse' && e.button !== 0)) return;
  KCAM.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
});
canvas.addEventListener('pointermove', e => {
  const p = KCAM.ptrs.get(e.pointerId); if (!p || !keepCamOn()) return;
  if (KCAM.ptrs.size === 1) keepPan(e.clientX - p.x, e.clientY - p.y);
  else {
    const [a, b] = [...KCAM.ptrs.values()], before = Math.hypot(a.x - b.x, a.y - b.y), mx0 = (a.x + b.x) / 2, my0 = (a.y + b.y) / 2;
    p.x = e.clientX; p.y = e.clientY;
    const [c, d] = [...KCAM.ptrs.values()], after = Math.hypot(c.x - d.x, c.y - d.y), mx = (c.x + d.x) / 2, my = (c.y + d.y) / 2;
    if (before > 10 && after > 10) keepZoom(before / after, mx, my);
    keepPan(mx - mx0, my - my0); return;
  }
  p.x = e.clientX; p.y = e.clientY;
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { KCAM.ptrs.delete(e.pointerId); });
canvas.addEventListener('wheel', e => { if (!keepCamOn()) return; e.preventDefault(); keepZoom(Math.exp(clamp(e.deltaY, -120, 120) * 0.0016), e.clientX, e.clientY); }, { passive: false });
addEventListener('keydown', e => {
  if (!keepCamOn() || e.target.closest && e.target.closest('input,textarea')) return;
  const s = KCAM.d * 0.06, k = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s], a: [-s, 0], d: [s, 0], w: [0, s], s: [0, -s] }[e.key];
  if (k) { KCAM.wx += k[0]; KCAM.wy += k[1]; }
  if (e.key === '+' || e.key === '=') keepZoom(0.85); if (e.key === '-') keepZoom(1.18);
});
// tapping the Keep: a person (or the cat, or the dog), else a room
function pickKeep(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, kcam);
  let bestV = null, bd = 1e9;
  for (const v of GAME.villagers) {
    if (!v.isprite.visible || !v.kin || !v.kin.c) continue;
    const c = v.kin.c, dist = ray.ray.distanceToPoint(c), along = c.clone().sub(ray.ray.origin).length();
    if (dist < 0.75 + along * 0.005 && along < bd) { bd = along; bestV = v; }
  }
  if (bestV) { SEL.villager = bestV; UI.open('villager', bestV); keepFocus(bestV.kin.c.x, bestV.kin.c.y, 2.5); AUDIO.play('tap'); return; }
  for (const P of KLIFE.pets) {
    if (!P.spr.visible || !P.p) continue;
    const c = P.p.clone().setY(P.p.y + P.s * 0.45);
    if (ray.ray.distanceToPoint(c) < 0.45 + P.s * 0.3) { toast(`<b>${esc(P.name)}</b>, ${esc(P.text)}`); P.t = Math.min(P.t, 0.5); AUDIO.play('tap'); return; }
  }
  const h = ray.intersectObjects(KEEPV.hits, false)[0];
  if (h) { UI.open('room', h.object.userData.room); keepFocusRoom(h.object.userData.room); AUDIO.play('tap'); return; }
  UI.close();
}

// ----------------------------------------------------------------- time away
// When you come back, training and expeditions are credited with the time you were gone (up to 8 hours),
// one real second per game second, as if you'd left the game running at 1×. The claim itself waits for you.
const AWAY_CAP = 8 * 3600;
function catchUp(sec) {
  sec = Math.min(AWAY_CAP, Math.max(0, sec));
  if (sec < 30) return null;
  const before = new Map(GAME.villagers.map(v => [v, { stats: { ...v.d.stats }, exp: v.d.exp ? { state: v.d.exp.state, items: v.d.exp.haul.items.length, zone: v.d.exp.seen } : null }]));
  QUIET = true;
  try {
    for (const v of GAME.villagers) if (v.d.exp && v.d.exp.state === 'leaving') { v.d.exp.state = 'out'; v.where = 'wilds'; v.setHidden(true); v.plan = []; }
    for (let t = 0; t < sec; t += 2) { const dt = Math.min(2, sec - t); updateStudies(dt, true); updateExpeditions(dt); }
  } finally { QUIET = false; }
  const lines = [];
  for (const v of GAME.villagers) {
    const b = before.get(v); if (!b) continue;
    const first = v.d.name.split(' ')[0];
    for (const k of 'GEARS') if (v.d.stats[k] > b.stats[k]) lines.push({ v, text: `${first}: ${STAT_NAMES[k]} ${b.stats[k]} → ${v.d.stats[k]}${v.d.stats[k] >= STAT_MAX ? ` · mastered: ${STUDY[k].perk}` : ''}` });
    const E = v.d.exp;
    if (b.exp && E) {
      const got = E.haul.items.length - b.exp.items;
      const where = WILDS.zones[E.seen].name.replace(/^The /, 'the ');
      const st = E.state === 'out' ? `still out, ${fmtSpan(E.out)} in, at ${where}` : E.state === 'arriving' ? `climbing the rope stair now` : `on the way home from ${where}, about ${fmtSpan(Math.max(0, E.ret))} away`;
      lines.push({ v, text: `${first} is ${st}${E.beaten ? ', beaten' : ''}. ${got > 0 ? got + ' new find' + (got > 1 ? 's' : '') + '.' : ''}` });
    }
  }
  return { sec, lines };
}
const ROOM_FIXED = {
  hearth: { name: 'Hearth Hall', blurb: 'The long table, the big fire, the place everyone ends up. Supper is at sundown; anyone resting by day is here, and the notice board has this chapter’s goals.' },
  dorm: { name: 'Dormitory', blurb: 'Bunks with everyone’s own quilt. At night this is where they sleep, and the attic takes the rest; raise the Keep for more beds.' },
  lookout: { name: 'Lookout', blurb: 'A telescope at the big window, under the beacon. Pip says you can see the Thinning from here on a clear night.' },
  attic: { name: 'Attic', blurb: 'Straw pallets under the rafters for whoever the bunks can’t take, washing on the line, and the cat’s favourite crate. Raise the Keep for more beds up here.' },
};
const roomName = key => typeof key === 'number' ? (GAME.rooms[key].type ? STUDY[GAME.rooms[key].type].name : 'Empty room') : ROOM_FIXED[key].name;
