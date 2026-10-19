// ===================================================================== LIFE IN THE KEEP: who is where, doing what
// Everyone indoors has a place: students and tutors at work in their study, folk resting by day by the fire or in a
// favourite corner, supper at the long table at sundown (and a midday meal for whoever's in), then bed: the bunks in
// the Dormitory, pallets in the attic, bedrolls by the hall's fire. People walk there through the doors and up the
// switchback stair (and the attic ladder), sit behind tables, and lie down in bed under a quilt in their own colours.
// The founders and the visitors who stay have a favourite room. A cat and a dog live here too.
// None of this changes the game's numbers (study is counted in keep.js); it's what you see when you look in.
const KLIFE = { t: 0, snap: true, sig: '', pets: [], built: -1 };

// ----------------------------------------------------------------- favourite rooms
// the founders by name, the visitors by the id of the look they wear (story.js names them)
const KFAV = {
  'Hesper Lark': ['lookout', 'R', 'A'], 'Odile Fenn': ['E', 'hearth'], 'Pip Kettleby': ['lookout', 'attic'], 'Marigold Thresh': ['S', 'hearth'],
  'Corwin Ashlar': ['G', 'hearth'], 'Absalom Pockett': ['R', 'hearth'],
  io: ['S', 'R'], sol: ['G', 'hearth'], halcyon: ['lookout', 'G'], quill: ['hearth'], tock: ['E', 'attic'], brann: ['hearth', 'G'],
  jester: ['R', 'hearth'], ranger: ['A', 'lookout'], herbal: ['S'], fox: ['hearth'],
};
const kfavOf = v => KFAV[v.d.hero] || KFAV[v.d.name] || null;
// whoever's home at supper and likes it best does the cooking
const KCOOKS = ['fox', 'Marigold Thresh', 'brann', 'Absalom Pockett'];

// ----------------------------------------------------------------- what each person wants to be doing indoors
function keepWant(v) {
  const t = TOD.t;
  if (v.where === 'study' && v.d.study) return { use: v.d.study.role, room: v.d.study.room };
  if (v.hurt) return { use: 'sleep' };
  if (t >= 0.62 && t < 0.79) return { use: 'eat', supper: true };
  if (t >= 0.3 && t < 0.37) return { use: 'eat' };
  if (v.d.trait === 'Night owl' && t >= 0.79 && t < 0.92) return { use: 'fire' };
  if (t >= 0.85 || t < 0.1) return { use: 'sleep' };
  return { use: 'leisure', evening: t >= 0.79 };
}
const LEISURE = new Set(['fav', 'fire', 'rest']);
function spotFits(s, w, v) {
  if (!s) return false;
  if (w.use === 'student') return s.use === 'student' && s.room === w.room && s.i === Math.max(0, roomStudents(w.room).indexOf(v)) % 4;
  if (w.use === 'tutor') return s.use === 'tutor' && s.room === w.room;
  if (w.use === 'sleep') return s.use === 'sleep' ? s.bed.owner === v : !s.bed && (s.use === 'fire' || s.use === 'rest') && !keepBedOf(v);
  if (w.use === 'eat') return s.use === 'eat' || s.use === 'cook' && w.supper;
  if (w.use === 'fire') return s.use === 'fire' && !s.cat;
  return LEISURE.has(s.use) && !s.cat;
}
const keepBedOf = v => KEEPV.beds && KEEPV.beds.find(b => b.owner === v) || null;

// ----------------------------------------------------------------- giving everyone a place
function keepAssign() {
  const spots = KEEPV.spots; if (!spots) return;
  // beds: every settler has their own, in the order they came to the claim (those up all night at their books last,
  // so the bunks go to people who'll sleep in them). The cast are guests (bedsUsed in people.js): they take a bunk
  // only when one is spare, and otherwise a bedroll by the hall's fire.
  const away = v => (isGuest(v) ? 4 : 0) + (v.d.study ? 2 : 0) + (isNightJob(v) || v.where === 'ship' || v.where === 'mast' ? 1 : 0);
  const people = GAME.villagers.filter(v => !v.d.exp).sort((a, b) => (away(a) - away(b)) || a.d.id - b.d.id);
  for (const b of KEEPV.beds) b.owner = null;
  people.forEach((v, i) => { if (KEEPV.beds[i]) KEEPV.beds[i].owner = v; });
  const inside = people.filter(v => v.inside), taken = new Set(), todo = [];
  for (const v of inside) {
    const K = v.kin || (v.kin = { p: null, path: [], spot: null });
    K.want = keepWant(v);
    // the Keep was rebuilt: keep the same place if it's still there, so nobody gets up for nothing
    if (K.spot && !spots.includes(K.spot)) {
      const o = K.spot, n = spots.find(s => s.room === o.room && s.use === o.use && s.i === o.i && s.p.distanceToSquared(o.p) < 0.01) || null;
      if (K.goal === o) K.goal = n; K.spot = n;
    }
    if (spotFits(K.spot, K.want, v) && !taken.has(K.spot)) taken.add(K.spot); else todo.push(v);
  }
  const free = s => !taken.has(s);
  const pick = (v, list) => { const s = list.find(free); if (s) { taken.add(s); return s; } return null; };
  // the cook first, at supper
  const supper = inside.filter(v => v.kin.want.use === 'eat' && v.kin.want.supper);
  if (supper.length && !inside.some(v => v.kin.spot && v.kin.spot.use === 'cook')) {
    const cook = KCOOKS.map(k => supper.find(v => v.d.hero === k || v.d.name === k)).find(Boolean) || supper[supper.length - 1];
    const s = spots.find(s => s.use === 'cook' && free(s)); if (cook && s && todo.includes(cook)) { if (cook.kin.spot) taken.delete(cook.kin.spot); cook.kin.spot = s; taken.add(s); todo.splice(todo.indexOf(cook), 1); }
  }
  for (const v of todo) {
    const K = v.kin, w = K.want; let s = null;
    if (w.use === 'student' || w.use === 'tutor') s = pick(v, spots.filter(x => spotFits(x, w, v)));
    else if (w.use === 'sleep') { const b = keepBedOf(v); s = b ? pick(v, spots.filter(x => x.bed === b)) : null; if (!s) s = pick(v, spots.filter(x => (x.use === 'fire' || x.use === 'rest') && !x.cat)); }
    else if (w.use === 'eat') s = pick(v, spots.filter(x => x.use === 'eat').sort((a, b) => a.i - b.i)) || pick(v, spots.filter(x => LEISURE.has(x.use) && !x.cat && x.room === 'hearth'));
    else {
      // a favourite room first, if it's furnished and its corner is free; then the fire; then anywhere comfortable
      const fav = kfavOf(v) || [];
      for (const kind of fav) { if (s) break; s = pick(v, spots.filter(x => x.kind === kind && (x.use === 'fav' || x.use === 'rest') && !x.cat)); }
      if (!s) s = pick(v, spots.filter(x => x.use === 'fire' && !x.cat && (w.use === 'fire' || x.room === 'hearth')));
      if (!s) s = pick(v, spots.filter(x => LEISURE.has(x.use) && !x.cat));
      if (!s) s = pick(v, spots.filter(x => x.use === 'eat'));
    }
    K.spot = s;
  }
}

// ----------------------------------------------------------------- the way through the Keep
const floorY = f => f * FH + 0.02;
function kplace(p) {
  const nF = KEEPV.nF || 2;
  if (p.y > nF * FH - 0.4) return { f: nF, s: 0, attic: true };
  return { f: clamp(Math.floor((p.y + 0.8) / FH), 0, nF - 1), s: p.x < -SWD / 2 - 0.05 ? -1 : p.x > SWD / 2 + 0.05 ? 1 : 0 };
}
const KV = (x, y, z, o) => Object.assign(new THREE.Vector3(x, y, z), o || {});
function kflight(f, up) {
  const y = floorY(f), m = y + FH / 2, t = floorY(f + 1);
  const n = [KV(-0.78, y, LZ), KV(-0.78, y, 1.55), KV(-0.78, m, -2.15), KV(-0.78, m, -2.65), KV(0.78, m, -2.65), KV(0.78, m, -2.15), KV(0.78, t, 1.55), KV(0.78, t, LZ)];
  return up ? n : n.reverse();
}
// a list of points from a (where someone stands) to b (where they're going), both on a floor
function kpath(a, b, o = {}) {
  const A = kplace(a), B = kplace(b), out = [], nF = KEEPV.nF, Y = floorY(nF), top = nF - 1;
  const lane = (x, f) => KV(x, floorY(f), LZ);
  if (A.attic === B.attic && A.f === B.f && A.s === B.s) {
    const zl = A.attic ? 1.2 : LZ;
    if ((Math.abs(a.z - zl) > 0.5 || Math.abs(b.z - zl) > 0.5) && Math.abs(a.x - b.x) > 0.9) out.push(KV(a.x, a.y, zl), KV(b.x, b.y, zl));
    out.push(b.clone()); return out;
  }
  let f = A.f;
  if (A.attic) { out.push(KV(a.x, Y, 1.2), KV(-0.8, Y, 2.0), KV(-0.8, Y, 2.95), KV(-0.8, floorY(top), 2.95, { climb: true }), lane(-0.8, top)); f = top; }
  else if (A.s) out.push(lane(a.x, f), lane(A.s * (SWD / 2 + 0.3), f), lane(A.s * 0.5, f));
  else out.push(lane(clamp(a.x, -1.2, 1.2), f));
  const fT = B.attic ? top : B.f;
  while (f < fT) { out.push(...kflight(f, true)); f++; }
  while (f > fT) { out.push(...kflight(f - 1, false)); f--; }
  if (B.attic) out.push(lane(-0.8, f), KV(-0.8, floorY(f), 2.95), KV(-0.8, Y, 2.95, { climb: true }), KV(-0.8, Y, 2.0), KV(b.x, Y, 1.2), b.clone());
  else if (B.s) out.push(lane(B.s * 0.5, f), lane(B.s * (SWD / 2 + 0.3), f), lane(b.x, f), b.clone());
  else out.push(b.clone());
  return out;
}
// where someone stands to get into a place: on its floor, in front of it
function kfoot(s) { const P = kplace(s.p), y = P.attic ? floorY(KEEPV.nF) : floorY(P.f); return s.pose === 'lie' ? KV(s.bed.x, y, s.bed.z + 0.75) : s.p.y - y > 0.3 ? KV(s.p.x, y, s.p.z + 0.6) : KV(s.p.x, y, s.p.z); }
const KDOOR = () => KV(0, 0.02, KD / 2 + 0.3);

// ----------------------------------------------------------------- every frame
function keepLifeUpdate(rdt, gdt) {
  if (!KEEPV.spots || !KEEPV.group) { for (const v of GAME.villagers) if (v.isprite) v.isprite.visible = false; return; }
  const rebuilt = KLIFE.built !== KEEPV.built; KLIFE.built = KEEPV.built;
  KLIFE.t -= rdt;
  const sig = GAME.villagers.map(v => v.inside ? v.d.id + (v.where === 'study' ? 's' : 'h') + (v.hurt ? 'x' : '') : '').join(',') + '|' + Math.floor(TOD.t * 200);
  if (rebuilt || KLIFE.t <= 0 || sig !== KLIFE.sig) { KLIFE.t = 0.6; KLIFE.sig = sig; keepAssign(); }
  const dt = Math.min(gdt, 0.25), snap = KLIFE.snap; KLIFE.snap = false;
  for (const v of GAME.villagers) {
    const inside = !v.d.exp && v.inside;
    if (!inside) { if (v.isprite.visible) v.isprite.visible = false; if (v.kin) { v.kin.p = null; v.kin.path = []; v.kin.at = false; v.kin.goal = null; } continue; }
    const K = v.kin || (v.kin = { p: null, path: [], spot: null });
    if (v.isprite.material === v.mat) { v.imat = new THREE.SpriteMaterial({ map: v.tex, alphaTest: 0.5, toneMapped: false }); v.isprite.material = v.imat; }
    // a new arrival walks in at the door; anyone already here when you look in is in their place
    if (!K.p) { K.p = KDOOR(); K.goal = null; K.path = []; K.at = false; if (snap || rebuilt && !KEEPV.live) K.snapMe = true; }
    if ((snap || K.snapMe) && K.spot) { K.p.copy(K.spot.p); K.path = []; K.goal = K.spot; K.at = true; K.snapMe = false; }
    // off to a new place: out of the old one first (to the floor in front of it), along the way, and into the new one
    if (!K.path.length && K.spot !== K.goal) {
      const pts = []; let from = K.p.clone();
      if (K.goal && K.at) { from = kfoot(K.goal); pts.push(from); }
      if (K.spot) pts.push(...kpath(from, kfoot(K.spot)), K.spot.p.clone());
      K.path = pts; K.goal = K.spot; K.at = false;
    }
    keepWalk(v, K, dt);
    keepPose(v, K, rdt);
  }
  keepQuilts();
  keepPets(rdt, dt, snap);
}
// along the path: a little quicker on the level, slower on the stair, slow up a ladder
function keepWalk(v, K, dt) {
  v.moving = false; v.climbing = false; v.running = false;
  if (!K.path.length || dt <= 0) { if (K.path.length) { v.moving = true; v.climbing = !!K.path[0].climb; } return; }
  let left = dt;
  while (left > 0 && K.path.length) {
    const n = K.path[0], dx = n.x - K.p.x, dy = n.y - K.p.y, dz = n.z - K.p.z, L = Math.hypot(dx, dy, dz);
    const sp = n.climb ? 0.9 : Math.abs(dy) > 0.3 ? 1.3 : 1.75;
    if (L < 1e-3) { K.p.copy(n); K.path.shift(); continue; }
    const step = Math.min(L, sp * left); left -= step / sp;
    K.p.x += dx / L * step; K.p.y += dy / L * step; K.p.z += dz / L * step;
    if (n.climb) { v.face.set(0, -1); v.climbing = true; } else if (Math.hypot(dx, dz) > 0.01) v.face.set(dx, dz).normalize();
    v.moving = true;
    if (step >= L - 1e-4) { K.p.copy(n); K.path.shift(); }
  }
  if (!K.path.length && K.goal) K.at = true;
}
// in place: sitting, lying, climbing the wall, working; the sprite takes the room's light
const _kt = new THREE.Vector3();
function keepPose(v, K, rdt) {
  const s = K.at ? K.goal : null, spr = v.isprite;
  spr.visible = true;
  let x = K.p.x, y = K.p.y, z = K.p.z, rot = 0;
  if (s) {
    x = s.p.x; z = s.p.z; y = s.p.y - s.sink;
    v.face.set(Math.sin(s.face), Math.cos(s.face));
    v.working = !!s.work; v.moving = false;
    if (s.climb) {
      // up and down the wall, a hand at a time
      K.cl = (K.cl || 0) + rdt * Math.min(GAME.speed, 2) * (GAME.paused ? 0 : 1);
      const k = 0.5 - 0.5 * Math.cos(K.cl * 0.45 + v.d.id); y = s.p.y + lerp(s.climb[0], s.climb[1], k);
      v.climbing = Math.abs(Math.sin(K.cl * 0.45 + v.d.id)) > 0.15; v.moving = v.climbing; v.working = false;
    }
    if (s.pose === 'lie') { rot = s.lie > 0 ? Math.PI / 2 : -Math.PI / 2; v.working = false; v.face.set(0, 1); }
  }
  // supper: people at the table don't swing their tools
  if (s && s.use === 'eat') v.working = false;
  if (v.imat) v.imat.rotation = rot;
  spr.position.set(x, rot ? y + 0.3 : y, z);
  v.frame(0);
  // the pick centre and the light on them
  K.c = (K.c || new THREE.Vector3()).set(rot ? x - Math.sign(rot) * 0.8 : x, rot ? y + 0.35 : y + 1.0, z);
  keepTint(v, K.c);
}
function keepTint(v, c) {
  const night = TOD.night, base = lerp(0.92, 0.42, night) * (1 - 0.18 * wxCover() * (1 - night));
  let r = base, g = base * 0.97, b = base * (0.95 + night * 0.1);
  for (const L of KEEPV.lights) {
    if (!L.cur) continue;
    const dd = (L.x - c.x) ** 2 + (L.y - c.y) ** 2 + (L.z - c.z) ** 2, f = Math.max(0, 1 - dd / (L.r * L.r)); if (f <= 0) continue;
    const k = f * f * 0.32; r += L.cur.r * k; g += L.cur.g * k; b += L.cur.b * k;
  }
  if (v.imat) v.imat.color.setRGB(Math.min(1.08, r), Math.min(1.05, g), Math.min(1.02, b));
}
// quilts on every owned bed: made and flat, or pulled up over whoever's asleep in it
const _qm = new THREE.Matrix4(), _qp = new THREE.Vector3(), _qs = new THREE.Vector3(), _qq = new THREE.Quaternion(), _qc = new THREE.Color();
function keepQuilts() {
  const Q = KEEPV.quilts; if (!Q || !KEEPV.beds) return;
  let n = 0;
  for (const b of KEEPV.beds) {
    const v = b.owner; if (!v || n >= 48) continue;
    const asleep = v.kin && v.kin.at && v.kin.goal && v.kin.goal.bed === b && v.isprite.visible;
    const L = b.L - 0.35, len = asleep ? L * 0.62 : L * 0.7, cx = asleep ? b.x + b.dir * (b.L / 2 - 0.12 - len / 2) : b.x + b.dir * (b.L / 2 - 0.15 - len / 2);
    _qm.compose(_qp.set(cx, b.y - 0.02, b.z + (asleep ? 0.14 : 0.02)), _qq, _qs.set(len, asleep ? 0.34 : 0.07, asleep ? 0.62 : 0.84));
    Q.setMatrixAt(n, _qm);
    const L0 = v.d.look || {}; _qc.set(L0.quilt || L0.overCol || L0.shirt || '#8a6a9a'); _qc.offsetHSL(0, 0.05, 0.04);
    Q.setColorAt(n, _qc); n++;
  }
  Q.count = n; Q.instanceMatrix.needsUpdate = true; if (Q.instanceColor) Q.instanceColor.needsUpdate = true;
}

// ----------------------------------------------------------------- the Keep's cat and dog
// Tansy the cat sleeps where it's warm and wanders the whole Keep (the attic too); Brindle the dog follows whoever he
// likes best that's indoors, and lies down by the fire. Tap either of them.
const KPET_ART = {
  cat: { w: 24, h: 16, s: 0.46, name: 'Tansy', text: 'the Keep’s cat. She came up in a crate of lens glass and never left.' },
  dog: { w: 30, h: 20, s: 0.66, name: 'Brindle', text: 'the Keep’s dog. He thinks the Wildlight are a game nobody will let him play.' },
};
function petSheet(kind) {
  const A = KPET_ART[kind], W = A.w, H = A.h, F = 4, cv = document.createElement('canvas'); cv.width = W * F; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W * F, H);
  const pal = kind === 'cat' ? { a: [217, 130, 43], b: [240, 168, 80], d: [168, 84, 28], w: [241, 228, 198], e: [122, 199, 79], n: [232, 154, 154] }
    : { a: [138, 92, 56], b: [176, 126, 80], d: [92, 58, 34], w: [236, 222, 196], e: [40, 28, 24], n: [40, 28, 24] };
  for (let f = 0; f < F; f++) {
    const px = Array.from({ length: H }, () => new Array(W).fill(null)), put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) px[y][x] = c; };
    const ell = (cx, cy, rx, ry, c) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) put(x, y, c); };
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
    if (kind === 'cat') {
      if (f < 2) {   // walking, facing left
        const st = f ? 1 : -1;
        ell(13, 9, 6.5, 3, pal.a); for (const x of [11, 14, 17]) rect(x, 7, x, 9, pal.d);
        rect(8 + st, 11, 8 + st, 14, pal.a); rect(10 - st, 11, 10 - st, 14, pal.b); rect(16 + st, 11, 16 + st, 14, pal.a); rect(18 - st, 11, 18 - st, 14, pal.b);
        for (let i = 0; i < 6; i++) put(19 + i * 0.7, 8 - i * 0.9, pal.a);
        ell(6, 7, 3.2, 2.8, pal.a); put(4, 4, pal.a); put(4, 5, pal.a); put(5, 5, pal.a); put(7, 4, pal.a); put(7, 5, pal.a); put(8, 5, pal.a);
        put(4, 7, pal.e); put(3, 8, pal.n); rect(5, 9, 7, 10, pal.w);
      } else if (f === 2) {   // sitting, facing you a little
        ell(12, 10, 4.5, 4.5, pal.a); ell(12, 11, 2.5, 3, pal.w); ell(12, 5.5, 3.3, 3, pal.a);
        put(10, 2, pal.a); put(10, 3, pal.a); put(11, 3, pal.a); put(14, 2, pal.a); put(14, 3, pal.a); put(13, 3, pal.a);
        put(11, 5, pal.e); put(13, 5, pal.e); put(12, 7, pal.n); rect(10, 14, 11, 14, pal.w); rect(13, 14, 14, 14, pal.w);
        for (let i = 0; i < 6; i++) put(16 + i * 0.6, 13 - Math.sin(i * 0.6) * 2, pal.a);
      } else {   // asleep, curled
        ell(12, 11.5, 6.5, 3.5, pal.a); for (const x of [9, 12, 15]) rect(x, 9, x, 11, pal.d);
        ell(7, 11, 2.8, 2.4, pal.a); put(5, 9, pal.a); put(8, 8, pal.a); rect(6, 11, 7, 11, pal.d);
        for (let i = 0; i < 9; i++) put(7 + i, 14.5, pal.b);
      }
    } else {
      if (f < 2) {   // trotting, facing left
        const st = f ? 1 : -1;
        ell(16, 10, 8, 3.8, pal.a); ell(16, 12, 6, 1.6, pal.w);
        rect(10 + st, 13, 11 + st, 18, pal.a); rect(13 - st, 13, 14 - st, 18, pal.b); rect(20 + st, 13, 21 + st, 18, pal.a); rect(23 - st, 13, 24 - st, 18, pal.b);
        for (let i = 0; i < 5; i++) put(24 + i, 8 - i * 0.8, pal.a);
        ell(7, 7, 4, 3.4, pal.a); ell(3.5, 8.5, 2.4, 1.6, pal.b); put(1.5, 8, pal.n); rect(7, 4, 9, 9, pal.d); put(5, 6, pal.e); rect(5, 10, 7, 11, pal.w);
      } else if (f === 2) {   // sitting
        ell(15, 12, 5, 6, pal.a); ell(15, 13, 3, 4, pal.w); ell(15, 5.5, 4, 3.6, pal.a); ell(15, 7.5, 2.2, 1.6, pal.b);
        rect(10, 3, 11, 8, pal.d); rect(19, 3, 20, 8, pal.d); put(13, 5, pal.e); put(17, 5, pal.e); put(15, 7, pal.n);
        rect(12, 18, 13, 19, pal.a); rect(17, 18, 18, 19, pal.a);
      } else {   // lying down, chin on his paws
        ell(16, 15, 9, 3.4, pal.a); ell(16, 16.5, 7, 1.4, pal.w); ell(6, 14, 4, 3, pal.a); ell(3, 16, 2.6, 1.4, pal.b); put(1, 16, pal.n);
        rect(6, 11, 8, 15, pal.d); put(4, 14, pal.e); rect(2, 18, 9, 18, pal.b); for (let i = 0; i < 5; i++) put(25 + i, 15 - i * 0.3, pal.a);
      }
    }
    // a dark outline round the shape, then into the sheet
    const OL = kind === 'cat' ? [58, 32, 30] : [42, 26, 22];
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && px[y][x] && px[y][x] !== OL;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!px[y][x] && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) px[y][x] = OL;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = px[y][x]; if (!c) continue; const i = (y * W * F + f * W + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  const t = canvasTex(cv, { nearest: true }); return t;
}
function keepPetsMake() {
  if (KLIFE.pets.length) return;
  for (const kind of ['cat', 'dog']) {
    const A = KPET_ART[kind], tex = petSheet(kind); tex.repeat.set(1 / 4, 1);
    const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, toneMapped: false }), spr = new THREE.Sprite(mat);
    spr.center.set(0.5, 0.04); spr.scale.set(A.s * A.w / A.h, A.s, 1); KSCENE.add(spr);
    KLIFE.pets.push({ kind, spr, mat, tex, p: null, path: [], spot: null, t: 2 + Math.random() * 4, frame: 3, face: -1, anim: Math.random() * 3, ...A });
  }
}
function keepPets(rdt, dt, snap) {
  keepPetsMake();
  const spots = KEEPV.spots, night = TOD.t >= 0.8 || TOD.t < 0.08;
  for (const P of KLIFE.pets) {
    P.t -= dt; P.anim += rdt;
    // where to next: the cat picks a warm spot, a bed at night, or wanders; the dog keeps by his person
    if (!P.p || snap || P.t <= 0 && !P.path.length) {
      P.t = P.kind === 'cat' ? 18 + Math.random() * 30 : 8 + Math.random() * 10;
      let to = null;
      if (P.kind === 'cat') {
        const beds = night ? KEEPV.beds.filter(b => b.owner && b.owner.kin && b.owner.kin.at && b.owner.kin.goal && b.owner.kin.goal.bed === b) : [];
        if (beds.length && Math.random() < 0.7) { const b = beds[Math.random() * beds.length | 0]; to = KV(b.x - b.dir * 0.35, b.y + 0.3, b.z + 0.05, { bed: true }); }
        else { const cs = spots.filter(s => s.cat); const s = cs[Math.random() * cs.length | 0]; if (s) to = s.p.clone(); }
      } else {
        const fond = ['Corwin Ashlar', 'brann', 'sol', 'Pip Kettleby'];
        const who = fond.map(k => GAME.villagers.find(v => (v.d.name === k || v.d.hero === k) && v.inside && v.kin && v.kin.at)).find(Boolean) || GAME.villagers.find(v => v.inside && v.kin && v.kin.at && v.kin.goal && v.kin.goal.room !== 'attic');
        if (who && !night) { const s = who.kin.goal, f = kfoot(s); to = KV(f.x + 0.7, f.y, Math.min(f.z + 0.4, 1.4)); }
        else { const s = spots.find(x => x.cat && x.room === (night ? 'dorm' : 'hearth')); if (s) to = s.p.clone(); }
      }
      if (to) {
        const ground = kplace(to), fy = ground.attic ? floorY(KEEPV.nF) : floorY(ground.f), foot = KV(to.x, fy, to.bed ? to.z + 0.7 : to.z);
        if (P.kind === 'dog' && ground.attic) { /* the dog won't climb the ladder */ }
        else if (!P.p || snap) { P.p = to.clone(); P.path = []; P.up = to; }
        else { P.path = kpath(P.up && P.up.y - floorY(kplace(P.up).f) > 0.25 ? KV(P.p.x, floorY(kplace(P.p).f), P.p.z + 0.5) : P.p.clone(), foot); if (to.bed || to.y - fy > 0.25) P.path.push(to.clone()); P.up = to; }
      }
    }
    if (!P.p) { P.spr.visible = false; continue; }
    // moving
    let moving = false;
    if (P.path.length && dt > 0) {
      let left = dt;
      while (left > 0 && P.path.length) {
        const n = P.path[0], dx = n.x - P.p.x, dy = n.y - P.p.y, dz = n.z - P.p.z, L = Math.hypot(dx, dy, dz), sp = P.kind === 'cat' ? 1.4 : 1.9;
        if (L < 1e-3) { P.path.shift(); continue; }
        const st = Math.min(L, sp * left); left -= st / sp;
        P.p.x += dx / L * st; P.p.y += dy / L * st; P.p.z += dz / L * st; if (Math.abs(dx) > 0.02) P.face = dx < 0 ? -1 : 1;
        moving = true; if (st >= L - 1e-4) { P.p.copy(n); P.path.shift(); }
      }
    }
    const fr = moving ? Math.floor(P.anim * 7) % 2 : P.kind === 'cat' ? (night || P.t > 9 ? 3 : 2) : (night || TOD.t < 0.2 ? 3 : 2);
    P.tex.repeat.set(P.face > 0 ? -1 / 4 : 1 / 4, 1); P.tex.offset.set(P.face > 0 ? (fr + 1) / 4 : fr / 4, 0);
    P.spr.position.copy(P.p); P.spr.visible = true;
    const c = KV(P.p.x, P.p.y + 0.3, P.p.z); const fake = { imat: P.mat }; keepTint(fake, c);
  }
}

// ----------------------------------------------------------------- resting indoors by day
// Someone with nothing to do by day sometimes goes into the Keep to sit by the fire (or in their favourite room) a
// while, and comes out again. (Called from think() in people.js.)
function keepRestPlan(v) {
  if (!TOWN.b.keep || v.d.exp || v.hurt || v.d.study) return null;
  const t = TOD.t; if (t < 0.12 || t > 0.56) return null;
  if (v.where === 'home') return Math.random() < 0.55 ? [{ type: 'wait', t: 20 + Math.random() * 30 }] : null;
  if (Math.random() > 0.4) return null;
  return [...exitSteps(v), walkTo(v, homeEntry(v)), { type: 'enter' }, { type: 'wait', t: 25 + Math.random() * 35 }];
}

// who is in a room now (for its panel): those in their place there, or on their way to it
function keepHere(key) { return GAME.villagers.filter(v => v.inside && v.isprite.visible && v.kin && v.kin.goal && v.kin.goal.room === key); }

// ----------------------------------------------------------------- the test hook: a few frames of life without drawing
function keepTick(sec = 1, step = 0.1) { for (let t = 0; t < sec; t += step) keepLifeUpdate(step, step); }
