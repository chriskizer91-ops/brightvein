// ===================================================================== THE KEEP, CUT OPEN: rooms, and study (Fallout Shelter side)
// Tap Keep and the front wall comes away. The ground floor is the Hearth Hall and the dormitory;
// above are room slots that open with the Keep's level (2 at level 1, 4 at level 2, 5 at level 3).
// Furnish each as one of five studies, one per GEARS stat. Students leave their job and train that
// stat a point at a time; a tutor strong in the stat speeds everyone up. Reaching 10 is mastery.
const FH = 4.4, RW = 9, SWD = 3.4, KD = 6.4, KW = RW * 2 + SWD;
const STUDY = {
  G: { name: 'Drill Yard', tutor: 'Corwin Ashlar', blurb: 'Sandbags, weights and sparring lances. Students come out harder: better miners and a stronger watch.', perk: 'Seam-sense', perkText: '+20% at Grit work, and 20% harder in a fight' },
  E: { name: 'Drafting Loft', tutor: 'Odile Fenn', blurb: 'Drafting tables, a brass orrery and a great many pencil shavings. Better cutters and menders.', perk: 'True Hand', perkText: '+20% at Engineering work, and more salvage in the wilds' },
  A: { name: 'Rigging Loft', tutor: 'Hesper Lark', blurb: 'Ropes, beams and a net to land in. Quicker hands for the lens towers and the Lark.', perk: 'Hawk-eye', perkText: '+20% at Agility work, and twice as quick to dodge in the wilds' },
  R: { name: 'Parlour', tutor: 'Absalom Pockett', blurb: 'Armchairs, tea and argument. Clerks who could talk a courier into anything.', perk: 'Silver Tongue', perkText: '+20% at Rapport work, and better company on the road' },
  S: { name: 'Seed Library', tutor: 'Marigold Thresh', blurb: 'Jars of seed, drying herbs and a great deal of quiet. Gardeners and tenders who know their sun.', perk: 'Green Sun', perkText: '+20% at Sowing work, and more foraging in the wilds' },
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
function tutorMult(i) { const r = GAME.rooms[i], t = roomTutor(i); if (!t || !r.type) return 1; return 1 + Math.max(0, statOf(t, r.type) - 5) * 0.15 * (mastered(t, r.type) ? 1.15 : 1); }
const studyRate = i => ROOM_SPEED[GAME.rooms[i].level] * tutorMult(i) * studyBoost();   // studyBoost: the Keep's Book Lockers (fittings.js)
const studyLeft = v => { const S = v.d.study, k = GAME.rooms[S.room].type; return (pointTime(v.d.stats[k]) - S.prog) / Math.max(0.01, studyRate(S.room)); };
function canStudent(v, i) { const r = GAME.rooms[i]; return r.type && !v.d.exp && v.d.stats[r.type] < STAT_MAX && roomStudents(i).length < ROOM_SEATS[r.level] && !(v.d.study && v.d.study.room === i); }
function canTutor(v, i) { const r = GAME.rooms[i]; return r.type && !v.d.exp && !roomTutor(i) && statOf(v, r.type) >= 7; }
function startStudy(v, i, role) {
  if (role === 'student' ? !canStudent(v, i) : !canTutor(v, i)) return false;
  const b = v.jobB; if (b) v.d.pref = b === WALLB ? 'wall' : b.type;
  v.d.job = null; v.redraw();
  v.d.study = { room: i, role, prog: v.d.study && v.d.study.room === i ? v.d.study.prog : 0 };
  v.replan = true;
  if (FOLLOW.v === v) FOLLOW.v = null;
  return true;
}
function endStudy(v) { if (!v.d.study) return; v.d.study = null; v.replan = true; autoAssign(); }
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
    const first = esc(u.v.d.name.split(' ')[0]);
    if (u.to >= STAT_MAX) { toast(`<b>${first}</b> has mastered ${STAT_NAMES[u.k]}: <b>${esc(STUDY[u.k].perk)}</b>. ${esc(STUDY[u.k].perkText)}.`); AUDIO.play('levelup'); }
    else { toast(`<b>${first}</b>'s ${STAT_NAMES[u.k]} is now <b>${u.to}</b>.`); AUDIO.play('statup'); }
  }
  if (ups.length) UI.refresh();
}

// ----------------------------------------------------------------- the cutaway diorama
const KEEPV = { group: null, sig: '', hits: [], seats: {}, tags: [], lights: [], H: 0 };
const KMAT = {};
function kmats() {
  if (KMAT.ok) return; KMAT.ok = true;
  const std = (o, env = 0.3) => trackEnv(new THREE.MeshStandardMaterial(o), env);
  KMAT.plum = std({ map: tex('wool'), color: 0x9a5a88, roughness: 1 }, 0.15);
  KMAT.green = std({ map: tex('wool'), color: 0x5f9a70, roughness: 1 }, 0.15);
  KMAT.red = std({ map: tex('wool'), color: 0xb85a40, roughness: 1 }, 0.15);
  KMAT.blue = std({ map: tex('wool'), color: 0x5a7aaa, roughness: 1 }, 0.15);
  KMAT.paper = std({ color: 0xf3ead2, roughness: 0.9 }, 0.2);
  KMAT.blueprint = std({ color: 0x3a5a8a, roughness: 0.8, emissive: 0x0a1830, emissiveIntensity: 0.3 }, 0.2);
  KMAT.turf = std({ map: tex('turf'), roughness: 1 }, 0.1);
  KMAT.walls = {
    G: std({ map: tex('limestone'), color: 0xd8ccc0, roughness: 0.95 }, 0.2), E: std({ map: tex('plaster'), color: 0xc6d4e2, roughness: 0.95 }, 0.2),
    A: std({ map: tex('boards'), color: 0xe0ccb0, roughness: 0.9 }, 0.2), R: std({ map: tex('plaster'), color: 0xdcaac4, roughness: 0.95 }, 0.2),
    S: std({ map: tex('plaster'), color: 0xc4dca6, roughness: 0.95 }, 0.2), hearth: std({ map: tex('plaster'), color: 0xf2d8b0, roughness: 0.95 }, 0.2),
    dorm: std({ map: tex('boards'), color: 0xf0dcc0, roughness: 0.9 }, 0.2), empty: std({ map: tex('limestone'), color: 0x9a8e86, roughness: 1 }, 0.1), lookout: std({ map: tex('plaster'), color: 0xd6cfe8, roughness: 0.95 }, 0.2),
  };
  KMAT.cut = new THREE.MeshStandardMaterial({ color: 0x3a2630, roughness: 1 });
  KMAT.jar = std({ color: 0xcfeedd, roughness: 0.05, transparent: true, opacity: 0.6 }, 1.4);
  KMAT.seed = std({ color: 0xc89a4a, roughness: 0.8 }, 0.2);
  KMAT.fire = new THREE.MeshBasicMaterial({ color: 0xffb050, toneMapped: false });
  KMAT.lamp = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  KMAT.hit = new THREE.MeshBasicMaterial({ visible: false });
  // lighting for the diorama
  KSCENE.background = new THREE.Color(0x150e1a);
  KSCENE.environment = envTex;
  KSCENE.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a24, 1.1));
  const d = new THREE.DirectionalLight(0xfff0dc, 1.3); d.position.set(-14, 30, 40); KSCENE.add(d); KSCENE.add(d.target);
  KSCENE.fog = new THREE.Fog(0x150e1a, 90, 220);
}
function disposeTree(o) { o.traverse(m => { if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); }); }
function buildInterior(force) {
  if (!TOWN.b.keep) return;
  kmats();
  const lv = keepLv(), nF = lv + 1;
  const sig = lv + '|' + GAME.rooms.map(r => (r.type || '-') + r.level).join(',');
  if (!force && KEEPV.sig === sig && KEEPV.group) return;
  KEEPV.sig = sig;
  if (KEEPV.group) { KSCENE.remove(KEEPV.group); disposeTree(KEEPV.group); }
  const g = new THREE.Group(); KEEPV.group = g; KSCENE.add(g);
  KEEPV.hits = []; KEEPV.seats = {}; KEEPV.tags = []; KEEPV.lights = [];
  const dyn = new THREE.Group(); g.add(dyn);      // lights and anything that mustn't be merged
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.s) m.scale.set(...o.s); m.receiveShadow = true; (o.parent || g).add(m); return m; };
  const H = nF * FH; KEEPV.H = H; KEEPV.nF = nF;
  // ground, plinth, and the shell cut through
  add(G.box(160, 0.5, 70, 4), KMAT.turf, 0, -0.95, -14);
  add(G.box(KW + 3, 0.7, KD + 2), MAT.dressed, 0, -0.35, 0);
  for (let i = 0; i < 3; i++) add(G.box(4.4 - i * 0.4, 0.22, 0.8), MAT.dressed, 0, -0.6 + i * 0.22, KD / 2 + 1.6 - i * 0.4);
  add(G.box(KW + 1.6, H + 0.5, 0.7), MAT.stone, 0, H / 2, -KD / 2 - 0.35);
  for (const s of [-1, 1]) {
    add(G.box(1.0, H + 0.9, KD + 0.8), MAT.stone, s * (KW / 2 + 0.5), (H + 0.9) / 2 - 0.2, 0);
    add(G.box(0.06, H + 0.9, 0.06), KMAT.cut, s * (KW / 2 + 0.03), (H + 0.9) / 2 - 0.2, KD / 2 + 0.42);
  }
  for (let f = 1; f <= nF; f++) { add(G.box(KW + 2.0, 0.46, KD + 0.8), MAT.dressed, 0, f * FH - 0.21, 0); add(G.box(KW + 2.0, 0.06, 0.06), KMAT.cut, 0, f * FH - 0.44, KD / 2 + 0.42); }
  // battlements and the roof, with corner turrets once the Keep has them
  for (let i = 0; i <= 11; i++) add(G.box(0.9, 0.8, 0.5), MAT.stone, -KW / 2 - 0.6 + i * (KW + 1.2) / 11, H + 0.42, KD / 2 + 0.1);
  add(G.gable(KW + 0.8, 4.2, KD + 0.2, 3), MAT.slate, 0, H + 0.02, -0.2);
  if (lv >= 2) for (const s of [-1, 1]) {
    add(G.cyl(1.4, 1.5, H + 3, 14), MAT.stone, s * (KW / 2 + 1.4), (H + 3) / 2 - 0.4, -KD / 2 + 0.4);
    add(G.cyl(1.65, 1.65, 0.35, 14), MAT.dressed, s * (KW / 2 + 1.4), H + 2.7, -KD / 2 + 0.4);
    add(new THREE.ConeGeometry(1.9, 2.8, 14), MAT.copper, s * (KW / 2 + 1.4), H + 4.3, -KD / 2 + 0.4);
  }
  if (lv >= 3) {
    const by = H + 4.0;
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) add(G.box(0.12, 3.2, 0.12, 1), MAT.brass, dx, by + 1.6, -0.2 + dz);
    add(new THREE.TorusGeometry(1.2, 0.1, 6, 24).rotateX(Math.PI / 2), MAT.brass, 0, by + 0.2, -0.2);
    const bc = add(new THREE.OctahedronGeometry(1, 0), MAT.crystal, 0, by + 1.7, -0.2, { s: [0.7, 1.4, 0.7], parent: dyn });
    const L = new THREE.PointLight(0xffb25a, 60, 40, 1.4); L.position.set(0, by + 1.7, 1); dyn.add(L); void bc;
  }
  // stairs between floors in the middle column
  for (let f = 0; f < nF - 1; f++) {
    const dir = f % 2 ? -1 : 1;
    for (let k = 0; k < 10; k++) add(G.box(0.36, 0.14, 1.7, 1), MAT.oak, dir * (-1.25 + k * 0.28), f * FH + (k + 1) * FH / 10 - 0.05, -1.9);
    add(G.box(3.0, 0.12, 0.12, 1), MAT.oakDark, 0, f * FH + FH / 2 + 0.1, -1.0, { rz: dir * Math.atan2(FH, 2.8) });
  }
  for (let k = 0; k < 9; k++) add(G.box(0.9, 0.06, 0.06, 1), MAT.oak, 0, (nF - 1) * FH + 0.4 + k * 0.45, -2.9);
  for (const s of [-0.45, 0.45]) add(G.box(0.07, 4.2, 0.07, 1), MAT.oak, s, (nF - 1) * FH + 2.1, -2.9);
  // partitions either side of the stair
  for (let f = 0; f < nF; f++) for (const s of [-1, 1]) add(G.box(0.3, FH - 0.44, KD), MAT.plaster, s * SWD / 2, f * FH + (FH - 0.44) / 2 + 0.02, 0);
  // the rooms
  const room = (key, kind, f, side, level) => {
    const cx = side * (SWD / 2 + RW / 2), y0 = f * FH + 0.03;
    add(G.box(RW - 0.3, FH - 0.5, 0.06), KMAT.walls[kind] || KMAT.walls.empty, cx, y0 + (FH - 0.5) / 2, -KD / 2 + 0.03);
    add(G.box(RW - 0.3, 0.04, KD - 0.1), MAT.boards, cx, y0 + 0.02, 0);
    // a hanging crystal lantern
    add(G.box(0.03, 0.7, 0.03, 1), MAT.iron, cx, y0 + FH - 0.8, 0.6);
    add(G.box(0.36, 0.08, 0.36, 1), MAT.brass, cx, y0 + FH - 1.15, 0.6);
    if (kind !== 'empty') { add(new THREE.OctahedronGeometry(1, 0), KMAT.lamp, cx, y0 + FH - 1.42, 0.6, { s: [0.14, 0.24, 0.14] });
      const L = new THREE.PointLight(0xffc27a, 0, 13, 1.5); L.position.set(cx, y0 + FH - 1.6, 1.2); dyn.add(L); KEEPV.lights.push(L); }
    furnish(kind, cx, y0, add, dyn, level);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.4, FH - 0.5, KD), KMAT.hit); hit.position.set(cx, y0 + (FH - 0.5) / 2, 0); hit.userData.room = key; g.add(hit); KEEPV.hits.push(hit);
    const sx = [-3, -1, 1, 3].map(x => new THREE.Vector3(cx + x, y0, 1.25));
    KEEPV.seats[key] = { students: sx, tutor: new THREE.Vector3(cx + 0.2, y0, -0.2), many: Array.from({ length: 12 }, (_, i) => new THREE.Vector3(cx - 3.6 + (i % 6) * 1.44, y0, i < 6 ? 1.3 : 0.1)) };
    KEEPV.tags.push({ key, pos: new THREE.Vector3(cx, y0 + FH - 0.35, KD / 2) });
  };
  room('hearth', 'hearth', 0, -1); room('dorm', 'dorm', 0, 1);
  SLOT_POS.forEach(([f, side], i) => { if (f < nF) { const r = GAME.rooms[i]; room(i, r.type || 'empty', f, side, r.level); } });
  if (nF > 3) room('lookout', 'lookout', 3, 1);
  // merge everything static into a few draw calls
  const keepDyn = new Set(); dyn.traverse(o => keepDyn.add(o));
  const list = []; g.traverse(o => { if (o.isMesh && o.material !== KMAT.hit && !keepDyn.has(o)) list.push(o); });
  mergeMeshes(g, list); for (const m of list) m.parent.remove(m);
  fixEnv(g);
  setInteriorLights();
}
// props for each kind of room. (cx, y0): centre of the room's floor. Back wall at z = -3.2, front at +3.2.
function furnish(kind, cx, y0, add, dyn, level = 1) {
  const legs = (x, z, w, d, h, mat = MAT.oakDark) => { for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(G.box(0.08, h, 0.08, 1), mat, x + a * (w / 2 - 0.08), y0 + h / 2, z + b * (d / 2 - 0.08)); };
  const Z = -KD / 2;
  if (kind === 'hearth') {
    add(G.box(2.6, 2.8, 0.9), MAT.dressed, cx - 2.6, y0 + 1.4, Z + 0.45); add(G.box(1.4, 1.2, 0.3), MAT.dark, cx - 2.6, y0 + 0.62, Z + 0.86);
    add(G.box(3.0, 0.16, 1.1), MAT.oak, cx - 2.6, y0 + 2.0, Z + 0.6);
    add(new THREE.OctahedronGeometry(1, 0), MAT.crystal, cx - 2.6, y0 + 0.3, Z + 0.8, { s: [0.3, 0.26, 0.18], parent: dyn });
    const F = new THREE.PointLight(0xff9a40, 9, 7, 1.8); F.position.set(cx - 2.6, y0 + 0.8, Z + 1.6); dyn.add(F);
    add(G.box(4.6, 0.12, 1.2, 1), MAT.oak, cx + 1.4, y0 + 0.85, -0.9); legs(cx + 1.4, -0.9, 4.6, 1.2, 0.8);
    for (const z of [-1.8, 0.0]) { add(G.box(4.2, 0.1, 0.36, 1), MAT.oak, cx + 1.4, y0 + 0.46, z); legs(cx + 1.4, z, 4.2, 0.36, 0.42); }
    for (let i = 0; i < 4; i++) { add(G.cyl(0.18, 0.18, 0.03, 12), MAT.cream, cx - 0.4 + i * 1.2, y0 + 0.93, -0.9); add(G.cyl(0.07, 0.06, 0.16, 8), MAT.copper, cx - 0.2 + i * 1.2, y0 + 0.99, -1.1); }
    add(new THREE.PlaneGeometry(1.2, 2.2), MAT.wool, cx + 2.8, y0 + 2.6, Z + 0.07);
    for (let i = 0; i < 3; i++) add(G.box(0.5, 0.45, 0.5, 1), MAT.oak, cx + 3.6, y0 + 0.23 + i * 0.46, Z + 0.6, { ry: i * 0.3 });
  } else if (kind === 'dorm') {
    for (const bx of [-3, 0, 3]) {
      const x = cx + bx, z = Z + 0.75;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(G.box(0.1, 2.6, 0.1, 1), MAT.oak, x + a * 1.0, y0 + 1.3, z + b * 0.48);
      for (const [y, col] of [[0.45, bx < 0 ? KMAT.blue : bx > 0 ? KMAT.green : KMAT.plum], [1.75, bx < 0 ? KMAT.red : bx > 0 ? KMAT.plum : KMAT.blue]]) {
        add(G.box(2.1, 0.1, 1.0, 1), MAT.oakDark, x, y0 + y, z); add(G.box(1.95, 0.16, 0.9, 1), MAT.cream, x, y0 + y + 0.13, z);
        add(G.box(1.25, 0.08, 0.92, 1), col, x + 0.33, y0 + y + 0.24, z); add(G.box(0.45, 0.12, 0.6, 1), MAT.wool, x - 0.7, y0 + y + 0.27, z);
      }
      for (let k = 0; k < 4; k++) add(G.box(0.5, 0.05, 0.05, 1), MAT.oak, x + 1.05, y0 + 0.5 + k * 0.4, z + 0.55);
    }
    for (const x of [-3.9, 3.9]) { add(G.box(0.7, 0.6, 0.5, 1), MAT.oak, cx + x, y0 + 0.3, Z + 2.4); add(G.box(0.72, 0.06, 0.52, 1), MAT.brass, cx + x, y0 + 0.62, Z + 2.4); }
  } else if (kind === 'G') {
    add(G.box(RW - 0.8, 0.03, KD - 1.2), MAT.loam, cx, y0 + 0.05, -0.3);
    for (const x of [-3, -0.4]) {
      add(G.box(0.14, 1.9, 0.14, 1), MAT.oakDark, cx + x, y0 + 0.95, Z + 1.3);
      add(G.cyl(0.36, 0.42, 0.95, 10), MAT.canvas, cx + x, y0 + 1.35, Z + 1.3); add(new THREE.SphereGeometry(0.24, 10, 8), MAT.canvas, cx + x, y0 + 2.05, Z + 1.3);
      add(G.box(1.1, 0.12, 0.12, 1), MAT.oak, cx + x, y0 + 1.6, Z + 1.3);
    }
    add(G.cyl(0.32, 0.32, 1.1, 12), KMAT.red, cx + 1.8, y0 + 2.4, Z + 1.4); add(G.box(0.03, 1.0, 0.03, 1), MAT.rope, cx + 1.8, y0 + 3.4, Z + 1.4);
    add(G.box(1.8, 0.1, 0.5, 1), MAT.oak, cx + 3.4, y0 + 0.9, Z + 0.5); legs(cx + 3.4, Z + 0.5, 1.8, 0.5, 0.85);
    for (let i = 0; i < 3; i++) add(G.cyl(0.18 + i * 0.04, 0.18 + i * 0.04, 0.16, 12).rotateZ(Math.PI / 2), MAT.iron, cx + 2.8 + i * 0.55, y0 + 1.15, Z + 0.5);
    for (let i = 0; i < 4; i++) { add(G.cyl(0.04, 0.05, 2.6, 6), MAT.oak, cx - 3.8 + i * 0.35, y0 + 1.4, Z + 0.25, { rz: 0.08 }); add(new THREE.ConeGeometry(0.07, 0.25, 6), MAT.copper, cx - 3.8 + i * 0.35 + 0.1, y0 + 2.8, Z + 0.25); }
    if (level >= 2) { add(G.box(2.6, 0.3, 1.6, 1), KMAT.blue, cx + 0.8, y0 + 0.15, 0.1); }
    if (level >= 3) { add(G.box(0.14, 2.4, 0.14, 1), MAT.brass, cx - 2, y0 + 1.2, Z + 2.4); add(G.box(1.6, 0.08, 0.08, 1), MAT.brass, cx - 2, y0 + 2.4, Z + 2.4); }
  } else if (kind === 'E') {
    for (const x of [-2.6, 0.4]) {
      legs(cx + x, Z + 1.4, 1.5, 0.9, 0.9); add(G.box(1.7, 0.06, 1.1, 1), MAT.oak, cx + x, y0 + 1.05, Z + 1.4, { rx: -0.45 });
      add(G.box(1.4, 0.02, 0.8, 1), KMAT.paper, cx + x, y0 + 1.1, Z + 1.42, { rx: -0.45 });
      add(G.box(0.4, 0.5, 0.4, 1), MAT.oakDark, cx + x, y0 + 0.25, Z + 2.3);
    }
    add(new THREE.TorusGeometry(0.9, 0.12, 8, 14), MAT.brass, cx - 0.9, y0 + 3.0, Z + 0.12);
    for (let i = 0; i < 6; i++) add(G.box(0.08, 1.7, 0.05, 1), MAT.brass, cx - 0.9, y0 + 3.0, Z + 0.12, { rz: i * Math.PI / 6 });
    for (const [x, y] of [[-3.6, 2.8], [1.4, 3.1], [2.5, 2.6]]) add(G.box(0.9, 0.65, 0.02, 1), KMAT.blueprint, cx + x, y0 + y, Z + 0.1, { rz: (x % 2) * 0.05 });
    add(G.box(0.12, 1.3, 0.12, 1), MAT.brass, cx + 3.3, y0 + 0.65, Z + 1.3); add(new THREE.SphereGeometry(0.22, 12, 10), MAT.brass, cx + 3.3, y0 + 1.5, Z + 1.3);
    for (const [r, t] of [[0.6, 0.4], [0.85, 1.1], [1.05, -0.5]]) { add(new THREE.TorusGeometry(r, 0.025, 4, 32), MAT.brass, cx + 3.3, y0 + 1.5, Z + 1.3, { rx: Math.PI / 2 + t * 0.3 }); add(new THREE.SphereGeometry(0.08, 8, 6), t > 0 ? MAT.copper : MAT.crystal, cx + 3.3 + r * Math.cos(t * 3), y0 + 1.5, Z + 1.3 + r * Math.sin(t * 3)); }
    add(G.box(1.8, 0.08, 0.4, 1), MAT.oak, cx + 2.6, y0 + 2.0, Z + 0.22);
    for (let i = 0; i < 5; i++) add(G.cyl(0.07, 0.07, 0.5, 8).rotateZ(Math.PI / 2), KMAT.paper, cx + 2.0 + (i % 3) * 0.15, y0 + 2.14 + Math.floor(i / 3) * 0.13, Z + 0.25);
    if (level >= 2) { legs(cx - 1.1, Z + 2.5, 1.2, 0.7, 0.8); add(G.box(1.3, 0.06, 0.8, 1), MAT.oak, cx - 1.1, y0 + 0.83, Z + 2.5); add(new THREE.TorusGeometry(0.3, 0.06, 6, 16), MAT.brass, cx - 1.1, y0 + 1.1, Z + 2.5, { rx: Math.PI / 2 }); }
    if (level >= 3) add(G.cyl(0.25, 0.35, 1.6, 12).rotateZ(1.0), MAT.brass, cx - 3.4, y0 + 1.9, Z + 1.6);
  } else if (kind === 'A') {
    for (const x of [-3.8, 3.8]) add(G.box(0.24, FH - 0.5, 0.24, 1), MAT.oak, cx + x, y0 + (FH - 0.5) / 2, Z + 1.1);
    add(G.box(7.8, 0.24, 0.24, 1), MAT.oak, cx, y0 + 3.4, Z + 1.1);
    for (const x of [-2.4, -0.6, 1.2]) add(G.cyl(0.045, 0.045, 3.0, 6), MAT.rope, cx + x, y0 + 1.9, Z + 1.1);
    for (const s of [-0.35, 0.35]) add(G.cyl(0.035, 0.035, 3.3, 6), MAT.rope, cx + 2.9 + s, y0 + 1.75, Z + 1.1);
    for (let k = 0; k < 7; k++) add(G.box(0.72, 0.06, 0.06, 1), MAT.oak, cx + 2.9, y0 + 0.4 + k * 0.45, Z + 1.1);
    add(G.box(3.4, 0.28, 1.8, 1), KMAT.blue, cx - 1.3, y0 + 0.14, Z + 1.6);
    add(G.box(2.4, 0.05, 0.9, 1), MAT.rope, cx + 0.2, y0 + 2.6, Z + 0.6, { rz: 0.06 });
    if (level >= 2) { add(G.box(2.6, 0.08, 0.3, 1), MAT.oak, cx - 2.6, y0 + 1.1, Z + 2.6); legs(cx - 2.6, Z + 2.6, 2.6, 0.3, 1.05); }
    if (level >= 3) { add(new THREE.TorusGeometry(0.5, 0.06, 6, 20), MAT.brass, cx + 1.2, y0 + 2.6, Z + 1.1); }
  } else if (kind === 'R') {
    add(G.box(4.6, 0.03, 2.6), KMAT.red, cx, y0 + 0.05, -0.8);
    for (const s of [-1, 1]) {
      const x = cx + s * 1.9, z = -1.5, ry = -s * 0.45;
      add(G.box(1.0, 0.42, 0.9, 1), KMAT.plum, x, y0 + 0.3, z, { ry }); add(G.box(1.0, 0.85, 0.2, 1), KMAT.plum, x - Math.sin(ry) * 0.4, y0 + 0.8, z - Math.cos(ry) * 0.4, { ry });
      for (const a of [-1, 1]) add(G.box(0.16, 0.6, 0.9, 1), KMAT.plum, x + Math.cos(ry) * a * 0.5, y0 + 0.4, z - Math.sin(ry) * a * 0.5, { ry });
    }
    add(G.cyl(0.6, 0.6, 0.06, 18), MAT.oak, cx, y0 + 0.72, -1.2); add(G.cyl(0.08, 0.14, 0.7, 8), MAT.oakDark, cx, y0 + 0.35, -1.2);
    add(new THREE.SphereGeometry(0.15, 10, 8), MAT.brass, cx - 0.15, y0 + 0.88, -1.2); for (const a of [0.3, 2.4]) add(G.cyl(0.06, 0.05, 0.1, 8), MAT.cream, cx + Math.cos(a) * 0.35, y0 + 0.8, -1.2 + Math.sin(a) * 0.35);
    add(G.box(2.0, 1.6, 0.5), MAT.dressed, cx, y0 + 0.8, Z + 0.25); add(G.box(1.0, 0.8, 0.2), MAT.dark, cx, y0 + 0.5, Z + 0.45);
    add(new THREE.OctahedronGeometry(1, 0), MAT.crystal, cx, y0 + 0.26, Z + 0.45, { s: [0.2, 0.18, 0.12], parent: dyn });
    add(G.box(1.3, 2.7, 0.45, 1), MAT.oak, cx - 3.6, y0 + 1.35, Z + 0.25);
    const books = [KMAT.red, KMAT.blue, KMAT.green, KMAT.plum, MAT.cream];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) add(G.box(0.14, 0.42, 0.3, 1), books[(i + r) % 5], cx - 4.1 + i * 0.19, y0 + 0.45 + r * 0.6, Z + 0.32);
    add(new THREE.PlaneGeometry(1.4, 1.0), MAT.wool, cx + 2.6, y0 + 2.7, Z + 0.07);
    if (level >= 2) { add(G.box(1.8, 0.4, 0.7, 1), KMAT.plum, cx + 3.2, y0 + 0.3, Z + 1.4); add(G.box(1.8, 0.6, 0.18, 1), KMAT.plum, cx + 3.2, y0 + 0.75, Z + 1.1); }
    if (level >= 3) { add(G.cyl(0.25, 0.3, 0.5, 12), MAT.brass, cx + 1.6, y0 + 1.9, Z + 0.3); add(G.cyl(0.5, 0.08, 0.6, 12), MAT.brass, cx + 1.6, y0 + 2.4, Z + 0.4, { rx: -0.6 }); }
  } else if (kind === 'S') {
    for (const x of [-2.6, 0.6]) {
      add(G.box(2.6, 2.9, 0.5, 1), MAT.oak, cx + x, y0 + 1.45, Z + 0.3);
      for (let r = 0; r < 4; r++) { add(G.box(2.5, 0.06, 0.48, 1), MAT.oakDark, cx + x, y0 + 0.25 + r * 0.7, Z + 0.55);
        for (let i = 0; i < 7; i++) { const m = (i + r) % 3 === 0 ? MAT.crystal : KMAT.jar; add(G.cyl(0.11, 0.11, 0.3, 8), m, cx + x - 1.05 + i * 0.35, y0 + 0.43 + r * 0.7, Z + 0.62); if (m === KMAT.jar) add(G.cyl(0.08, 0.08, 0.14, 6), KMAT.seed, cx + x - 1.05 + i * 0.35, y0 + 0.37 + r * 0.7, Z + 0.62); } }
    }
    for (const [x, z, s] of [[3.3, -2.3, 0.5], [3.8, -1.1, 0.38], [-3.9, 0.4, 0.42]]) { add(G.cyl(0.32, 0.24, 0.45, 10), MAT.copper, cx + x, y0 + 0.23, z); add(new THREE.IcosahedronGeometry(s, 0), MAT.leaf, cx + x, y0 + 0.6 + s * 0.5, z, { s: [1, 1.2, 1] }); }
    for (let i = 0; i < 6; i++) { add(G.box(0.02, 0.4, 0.02, 1), MAT.rope, cx - 3 + i * 1.2, y0 + FH - 0.7, -0.8); add(new THREE.IcosahedronGeometry(0.18, 0), MAT.leaf, cx - 3 + i * 1.2, y0 + FH - 1.0, -0.8, { s: [0.8, 1.3, 0.8] }); }
    if (level >= 2) { add(G.box(1.8, 1.0, 0.6, 1), MAT.oak, cx - 3.4, y0 + 0.5, Z + 2.4); for (let i = 0; i < 6; i++) add(G.box(0.08, 0.08, 0.04, 1), MAT.brass, cx - 4.0 + (i % 3) * 0.6, y0 + 0.3 + Math.floor(i / 3) * 0.45, Z + 2.71); }
    if (level >= 3) { add(G.box(1.2, 0.06, 0.8, 1), MAT.glass, cx + 2.6, y0 + 1.6, Z + 2.2); legs(cx + 2.6, Z + 2.2, 1.2, 0.8, 1.55); }
  } else if (kind === 'lookout') {
    add(G.cyl(0.18, 0.28, 2.0, 12).rotateZ(1.1), MAT.brass, cx + 1.4, y0 + 1.9, -0.6);
    for (const a of [0, 2.1, 4.2]) add(G.box(0.06, 1.6, 0.06, 1), MAT.oakDark, cx + 1.0 + Math.cos(a) * 0.4, y0 + 0.8, -0.6 + Math.sin(a) * 0.4, { rz: Math.cos(a) * 0.25, rx: Math.sin(a) * 0.25 });
    add(G.box(0.6, 0.45, 0.6, 1), MAT.oak, cx - 1.6, y0 + 0.23, -1.0); add(new THREE.PlaneGeometry(2.0, 1.3), KMAT.blueprint, cx - 1.8, y0 + 2.6, Z + 0.07);
  } else {   // an empty room: crates and dust
    for (const [x, z, s] of [[-2.8, -2.2, 0.9], [-1.8, -2.4, 0.7], [-2.4, -1.4, 0.6], [2.6, -2.2, 0.8]]) add(G.box(s, s, s, 1), MAT.oak, cx + x, y0 + s / 2, z, { ry: x * 0.3 });
    add(G.box(1.6, 0.9, 0.9, 1), MAT.canvas, cx + 1.4, y0 + 0.45, -2.0);
  }
}
function setInteriorLights() {
  const night = TOD.night || 0;
  for (const L of KEEPV.lights) L.intensity = 18 + night * 16;
}
// who is where inside, each frame
function updateInterior() {
  const night = TOD.night > 0.5, home = [];
  for (const v of GAME.villagers) {
    const inside = !v.d.exp && (v.where === 'study' || (v.where === 'home' && v.hidden));
    v.isprite.visible = inside && !!KEEPV.group;
    if (!inside) continue;
    v.face.set(0, 1);
    if (v.where === 'study' && v.d.study && KEEPV.seats[v.d.study.room]) {
      const S = v.d.study, seats = KEEPV.seats[S.room];
      const p = S.role === 'tutor' ? seats.tutor : seats.students[Math.max(0, roomStudents(S.room).indexOf(v)) % 4];
      v.isprite.position.copy(p);
    } else home.push(v);
  }
  const H = KEEPV.seats[night ? 'dorm' : 'hearth'];
  if (H) home.forEach((v, i) => v.isprite.position.copy(H.many[i % H.many.length]));
}
// fit the diorama to the screen
function frameKeep(reset = true) {
  const H = KEEPV.H + 5, t = Math.tan(THREE.MathUtils.degToRad(kcam.fov / 2)), aspect = innerWidth / innerHeight;
  // landscape: the whole Keep; portrait: one full room and the stair, swipe across for the other side
  const wv = aspect < 1 ? RW + SWD + 2.2 : KW + 5, dW = (wv / 2) / (t * aspect), dH = (H / 2 + 1) / t, dist = aspect < 1 ? dW : Math.max(dH, dW);
  const tx = aspect < 1 ? -KW / 2 + wv / 2 - 0.6 : 0, ty = aspect < 1 ? Math.min(KEEPV.H / 2 + 0.6, FH * 1.5) : KEEPV.H / 2 + 0.6;
  KEEPV.dist = dist;
  kcontrols.minDistance = 7; kcontrols.maxDistance = Math.max(dist, (KW + 5) / 2 / (t * aspect)) * 1.1;
  if (reset) { kcontrols.target.set(tx, ty, 0); kcam.position.set(tx, ty + 2, dist); kcontrols.update(); }
}
function pickKeep(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, kcam);
  let bestV = null, bd = 1e9;
  for (const v of GAME.villagers) {
    if (!v.isprite.visible) continue;
    const c = v.isprite.position.clone().add(new THREE.Vector3(0, 1, 0)), dist = ray.ray.distanceToPoint(c), along = c.clone().sub(ray.ray.origin).length();
    if (dist < 0.8 + along * 0.006 && along < bd) { bd = along; bestV = v; }
  }
  if (bestV) { SEL.villager = bestV; UI.open('villager', bestV); return; }
  const h = ray.intersectObjects(KEEPV.hits, false)[0];
  if (h) { UI.open('room', h.object.userData.room); AUDIO.play('tap'); return; }
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
  hearth: { name: 'Hearth Hall', blurb: 'The long table, the big fire, the place everyone ends up. Anyone resting by day is here.' },
  dorm: { name: 'Dormitory', blurb: 'Bunks for everyone on the claim. At night this is where they sleep; raise the Keep for more beds.' },
  lookout: { name: 'Lookout', blurb: 'A telescope under the beacon. Pip says you can see the Thinning from here on a clear night.' },
};
const roomName = key => typeof key === 'number' ? (GAME.rooms[key].type ? STUDY[GAME.rooms[key].type].name : 'Empty room') : ROOM_FIXED[key].name;
