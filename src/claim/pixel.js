// ===================================================================== PIXEL PEOPLE
// Hand-pixeled people, drawn in code. Each frame is 48x64: shown 1.5 x 2 m in the town as before, at twice the old
// detail. Every person gets a sheet of frames:
// columns  0 stand · 1-4 walk (contact, pass, contact, pass) · 5-7 work (wind up, strike, follow through)
//          8 idle: a breath · 9 idle: a blink
// rows     0 facing the viewer · 1 facing away · 2 facing left (right = mirrored)
const PX = { FW: 48, FH: 64, COLS: 10, ROWS: 3, STAND: 0, WALK: 1, WORK: 5, IDLE: 8 };

const hex3 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const PLUM = [54, 30, 62], WARM = [255, 238, 196], INK = [30, 18, 30];
// five tones per colour: deep, shadow, base, light, highlight. Shadows drift toward plum, lights toward warm cream.
// Ramps are kept once made (sheets ask for the same few colours thousands of times).
const PX_RAMPS = new Map();
function ramp(h) {
  const key = typeof h === 'string' ? h : h[0] + ',' + h[1] + ',' + h[2];
  let R = PX_RAMPS.get(key); if (R) return R;
  R = makeRamp(h); PX_RAMPS.set(key, R); return R;
}
function makeRamp(h) {
  const b = typeof h === 'string' ? hex3(h) : h;
  return [mixc(mixc(b, [0, 0, 0], 0.5), PLUM, 0.42), mixc(mixc(b, [0, 0, 0], 0.28), PLUM, 0.26), b, mixc(mixc(b, [255, 255, 255], 0.2), WARM, 0.22), mixc(mixc(b, [255, 255, 255], 0.45), WARM, 0.35)];
}
// skin gets warm, rosy shadows (plum shadows read as grey on a face)
function skinRamp(h) {
  const k = 'skin' + h; let SR = PX_RAMPS.get(k); if (SR) return SR;
  const R = ramp(h), b = R[2];
  SR = [mixc(mixc(b, [0, 0, 0], 0.42), [140, 50, 50], 0.2), mixc(mixc(b, [0, 0, 0], 0.16), [200, 90, 70], 0.18), b, R[3], R[4]];
  PX_RAMPS.set(k, SR); return SR;
}
// hair and beards: white and pale grey hair would be all light and highlight, so it is shaded from a darker base and
// the colour itself becomes the light (the strands show)
function hairRamp(h) {
  const k = 'hair' + h; let HR = PX_RAMPS.get(k); if (HR) return HR;
  const b = hex3(h);
  if (0.3 * b[0] + 0.59 * b[1] + 0.11 * b[2] < 205) HR = ramp(h);
  else { HR = makeRamp(mixc(b, [118, 108, 128], 0.2)); HR[3] = b; HR[4] = mixc(b, [255, 255, 255], 0.6); }
  PX_RAMPS.set(k, HR); return HR;
}

const PXPAL = {
  skin: ['#f7d6b5', '#eebd93', '#d39a6c', '#a86c48', '#7a4a32', '#5a3426'],
  hair: ['#2a1d1c', '#4a2c20', '#7a4526', '#b5562b', '#d98a3a', '#e8c46a', '#cfc6b8', '#efece4', '#3b2f45'],
  cloth: ['#6b3a5e', '#2f5d62', '#b5832a', '#9a4430', '#6f7f4c', '#2f3d5c', '#e7dcc2', '#7a5234', '#4f5660', '#a8577a', '#3f7a5a', '#c76b3a'],
  leather: ['#6a432a', '#5a3a26', '#8a5a34', '#3e2a22'],
  pants: ['#3f3a4a', '#5a4632', '#2f3d4c', '#6b5a44', '#4a3a2e'],
};

// ----------------------------------------------------------------- a frame to paint into
// Every pixel remembers which part painted it (as(name) picks the part). When the frame is finished, a part that
// sits in front of another casts a 1-px shade on it, the sunny side (left and top) gets a soft warm rim, and the
// outline takes a darker shade of whatever it touches, lighter on the sunny side.
function PixFrame(w, h) { this.w = w || PX.FW; this.h = h || PX.FH; this.p = new Array(this.w * this.h).fill(null); this.l = new Uint8Array(this.w * this.h); this.cur = 0; this.ids = {}; this.n = 0; }
PixFrame.prototype.as = function (name) { this.cur = this.ids[name] || (this.ids[name] = ++this.n); return this; };
PixFrame.prototype.put = function (x, y, c) {
  if (!c) return;
  x = Math.floor(x + 0.5); y = Math.floor(y + 0.5);
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  const i = y * this.w + x; this.p[i] = c; this.l[i] = this.cur;
};
PixFrame.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.p[y * this.w + x] : null; };
PixFrame.prototype.has = function (x, y) { return !!this.get(x, y); };
PixFrame.prototype.clear = function (x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = null; };
// a shaded ellipse, light from the upper left. opt: clip(x, y), bias (lighter or darker), shine (a highlight)
PixFrame.prototype.ell = function (cx, cy, rx, ry, R, opt = {}) {
  const w = this.w, x0 = Math.max(0, Math.floor(cx - rx - 1)), x1 = Math.min(w - 1, Math.ceil(cx + rx + 1)), y0 = Math.max(0, Math.floor(cy - ry - 1)), y1 = Math.min(this.h - 1, Math.ceil(cy + ry + 1)), b = opt.bias || 0, clip = opt.clip, sh = opt.shine, cur = this.cur;
  for (let y = y0; y <= y1; y++) {
    const ny = (y + 0.5 - cy) / ry;
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (clip && !clip(x, y)) continue;
      const l = -0.55 * nx - 0.8 * ny + 0.22 * (1 - d) + b, i = y * w + x;
      this.p[i] = R[sh && l > 0.86 ? 4 : l > 0.5 ? 3 : l > -0.18 ? 2 : l > -0.62 ? 1 : 0]; this.l[i] = cur;
    }
  }
};
// a shaded box (inclusive corners): light left edge, shaded right edge and bottom
PixFrame.prototype.box = function (x0, y0, x1, y1, R, opt = {}) {
  x0 = Math.round(x0); x1 = Math.round(x1); y0 = Math.round(y0); y1 = Math.round(y1);
  const w = this.w, cur = this.cur, soft = opt.soft && x1 - x0 > 4 ? 1 : 0, tone = opt.tone, flat = opt.flat, noB = opt.noBottom;
  for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
    let t = 2;
    if (x === x0 && x1 - x0 > 1 && !flat) t = 3;
    if (x >= x1 - soft && x1 - x0 > 0) t = 1;
    if (y === y1 && !noB && t > 1) t = 1;
    if (x === x1 && y === y1 && x1 - x0 > 1) t = 0;
    if (tone !== undefined) t = tone;
    const i = y * w + x; this.p[i] = R[t]; this.l[i] = cur;
  }
};
PixFrame.prototype.line = function (x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let i = 0; i < 160; i++) {
    this.put(x0, y0, typeof c === 'function' ? c(i) : c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
};
// a shaded capsule (a round-ended stroke) from (x0, y0) to (x1, y1), radius r: arms, legs, shafts, braids, feathers
PixFrame.prototype.cap = function (x0, y0, x1, y1, r, R, opt = {}) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6, b = opt.bias || 0, r1 = opt.r1 ?? r;
  const w = this.w, rm = Math.max(r, r1), cur = this.cur, tone = opt.tone, sh = opt.shine, clip = opt.clip;
  const mx = Math.max(0, Math.floor(Math.min(x0, x1) - rm - 1)), Mx = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + rm + 1));
  const my = Math.max(0, Math.floor(Math.min(y0, y1) - rm - 1)), My = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1) + rm + 1));
  for (let y = my; y <= My; y++) for (let x = mx; x <= Mx; x++) {
    const px = x + 0.5 - x0, py = y + 0.5 - y0;
    let t = (px * dx + py * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = px - t * dx, qy = py - t * dy, d2 = qx * qx + qy * qy, rr = r + (r1 - r) * t;
    if (d2 > rr * rr) continue;
    if (clip && !clip(x, y)) continue;
    const d = Math.sqrt(d2), nx = qx / rr, ny = qy / rr, l = -0.55 * nx - 0.8 * ny + 0.25 * (1 - d / rr) + b, i = y * w + x;
    this.p[i] = R[tone !== undefined ? tone : sh && l > 0.8 ? 4 : l > 0.5 ? 3 : l > -0.15 ? 2 : l > -0.6 ? 1 : 0]; this.l[i] = cur;
  }
};
// a little hand-pixeled picture: rows of characters, each a key into pal ('.' or ' ' leaves the pixel alone).
// flip mirrors it left to right inside its own width.
PixFrame.prototype.stamp = function (x, y, rows, pal, flip) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i]; if (ch === '.' || ch === ' ') continue;
    this.put(flip ? x + rows[j].length - 1 - i : x + i, y + j, pal[ch]);
  }
};
// re-shade pixels painted in one of a ramp's tones, by a function of (x, y, tone) giving the new tone
PixFrame.prototype.retone = function (R, y0, y1, fn) {
  for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (let x = 0; x < this.w; x++) {
    const i = y * this.w + x, t0 = R.indexOf(this.p[i]); if (t0 < 0) continue;
    const t = fn(x, y, t0); if (t !== t0) this.p[i] = R[t];
  }
};
PixFrame.prototype.finish = function (opt = {}) {
  const w = this.w, h = this.h, p = this.p, l = this.l, n = w * h;
  const sh = new Map(), shade = c => { let s = sh.get(c); if (!s) { s = mixc(mixc(c, [0, 0, 0], 0.3), PLUM, 0.22); sh.set(c, s); } return s; };
  // a part in front shades what it overlaps by a pixel
  if (!opt.noSeams) {
    const src = p.slice();
    for (let i = 0; i < n; i++) {
      const c = src[i]; if (!c) continue;
      const a = l[i], x = i % w;
      if ((x > 0 && src[i - 1] && l[i - 1] > a) || (x < w - 1 && src[i + 1] && l[i + 1] > a) || (i >= w && src[i - w] && l[i - w] > a) || (i < n - w && src[i + w] && l[i + w] > a)) p[i] = shade(c);
    }
  }
  // a soft warm rim on the sunny edges
  const memo = (m, c, f) => { let r = m.get(c); if (!r) { r = f(c); m.set(c, r); } return r; };
  const rimA = new Map(), rimB = new Map(), outA = new Map(), outB = new Map();
  if (!opt.noRim) {
    const src = p.slice();
    for (let i = 0; i < n; i++) {
      const c = src[i]; if (!c) continue;
      const x = i % w;
      if (x === 0 || !src[i - 1]) p[i] = memo(rimA, c, c => mixc(c, WARM, 0.3));
      else if (i < w || !src[i - w]) p[i] = memo(rimB, c, c => mixc(c, WARM, 0.16));
    }
  }
  // the outline
  const src = p.slice();
  for (let i = 0; i < n; i++) {
    if (src[i]) continue;
    const x = i % w; let c = null, k = 0.8;
    if (x < w - 1 && src[i + 1]) { c = src[i + 1]; k = 0.6; }
    else if (i < n - w && src[i + w]) { c = src[i + w]; k = 0.6; }
    else if (x > 0 && src[i - 1]) c = src[i - 1];
    else if (i >= w && src[i - w]) c = src[i - w];
    if (c) p[i] = k < 0.7 ? memo(outA, c, c => mixc(c, INK, 0.6)) : memo(outB, c, c => mixc(c, INK, 0.8));
  }
};

// for hair strands: distance from a crown point, and from the nearest strand line fanning out of it
const PX_HAIR = (() => {
  const r = new Float32Array(128 * 128), d = new Float32Array(128 * 128);
  for (let iy = 0; iy < 128; iy++) for (let ix = 0; ix < 128; ix++) {
    const dx = ix - 64 + 0.5, dy = iy - 64 + 0.5, rr = Math.sqrt(dx * dx + dy * dy), q = Math.atan2(dx, dy) / 0.3 + 0.5;
    r[iy * 128 + ix] = rr; d[iy * 128 + ix] = Math.abs(q - Math.round(q)) * 0.3 * rr;
  }
  return { r, d };
})();

// ----------------------------------------------------------------- poses
// what each column is: stand, a step of the walk, a beat of the work, or an idle breath or blink
function pxPose(col) {
  if (col >= PX.WALK && col < PX.WORK) { const s = col - PX.WALK; return { walk: true, step: s, bob: s % 2 ? 0 : 1 }; }
  if (col >= PX.WORK && col < PX.IDLE) return { work: true, wf: col - PX.WORK, bob: 0 };
  return { stand: true, bob: col === PX.IDLE ? -1 : 0, blink: col === PX.IDLE + 1 };
}
// how each tool is used: a swing, a thrust, an aim, a pour...
const PX_MOTION = {
  pick: 'swing', pick2: 'swing', hammer: 'swing', plumb: 'swing', anchor: 'swing', machete: 'swing', sword: 'swing',
  lance: 'thrust', pole: 'thrust', halberd: 'thrust', hook: 'thrust', fork: 'thrust', dagger: 'thrust', drill: 'thrust',
  spanner: 'turn', wrench: 'turn',
  pistol: 'aim', rivet: 'aim', rifle: 'aim', rifle2: 'aim', carbine: 'aim', musket: 'aim', harpoon: 'aim', caster: 'aim', organ: 'aim',
  mortar: 'aim', sprayer: 'aim', kettle: 'aim', jug: 'throw',
  can: 'pour', smoker: 'pour', crystal: 'tray', tongs: 'tray', book: 'read', ledger: 'read', glass: 'look', scope: 'look', rope: 'haul', spell: 'spell',
};
// how a weapon is carried while walking: long ones upright, short ones hanging, small ones in the fist
const PX_CARRY = { lance: 'long', pole: 'long', halberd: 'long', hook: 'long', rifle: 'long', rifle2: 'long', carbine: 'long', musket: 'long', harpoon: 'long' };
const pxCarry = k => PX_CARRY[k] || (PX_MOTION[k] === 'swing' || PX_MOTION[k] === 'thrust' || PX_MOTION[k] === 'turn' ? 'short' : 'small');

// ----------------------------------------------------------------- the figure
// look: { skin, hair, hairStyle, fringe, hat, hatCol, shirt, over, overCol, pants, boots, beard, glasses, scarf, gnome,
//         satchel, eyes, tool, weapon }   (tool: what they work with; weapon: the kind of weapon in their hand slot)
// The visiting cast (cast.js) can carry more; all of it is optional and ordinary villagers use none of it:
//   hair:    hairStyle 'wavy' | 'shag' | 'updo' | 'curlyLong', hairLen (extra length), hairBias (below 0 darkens highlights),
//            braid (-1 | 1: over which shoulder, as seen from the front), braidTie, headband, veil [colours] (veils from the hat)
//   face:    faceLight (a brighter face), ears 'fox' | 'elf', earCol, earInner, brows, lashes, freckles, facePaint,
//            glassesCol, beard 'full', beardCol
//   hats:    'witch' (hatBand, hatTip -1 | 1 for the way the point flops, horns 'ram' | 'small', hornCol, hatBadge 'moon' | 'buckle', brimW),
//            'jester' (pomCol), 'helm' (helmTrim, plume: [colours]), 'captain' (feather), and 'gnome' with hatBand, hatStars, hatTip 'star', hatGoggles
//   body:    build 'big', over 'corset', sleeves 'rolled' | 'short' | 'puff' | 'bell', sleeveCol, bracers, cuffs, gloves,
//            neck 'low' | 'off', collar 'ruff' | 'choker', collarCol, pendant, belt (false, or a colour), pouches,
//            straps (crossed shoulder straps, with bags in strapBags)
//   armour:  { col, trim, plate (false for none), pauldron 'L' | 'R' | 'both', big, emblem 'sun', greaves }
//   cape:    { col, lining, trim, len, flare, hem 'straight' | 'tattered', open (worn as a cloak or long coat), emblem 'sun', cols (stripes), sparkle, openW }
//   skirt:   { col, cols, pattern 'patch' | 'layers', len, flare, hem 'straight' | 'tattered' | 'wave', trim, emblem 'sun', slit }
//   legs:    bootsTall, legPattern 'dots' | 'lace', socks (a colour: striped socks over the boots)
//   extras:  pet 'crow', held 'dagger' | 'sword' | 'book' (heldHand -1 | 1, blade, bladeEdge, bookCol), magic (colour for tool 'spell')
//   tools:   pick, hammer, can, crystal, book, glass, lance, rope, wrench, sword, dagger, spell, and every weapon kind
function drawVillagerFrame(L, row, col) {
  const F = new PixFrame();
  const P = pxPose(col), g = L.gnome ? 1 : 0, bw = L.build === 'big' ? 2 : 0, hb = bw / 2;
  const S = skinRamp(L.skin), H = hairRamp(L.hair), SH = ramp(L.shirt), OV = ramp(L.overCol), PA = ramp(L.pants), BO = ramp(L.boots);
  const HAT = ramp(L.hatCol || '#5a3a26'), BRASS = ramp('#c99a3c'), IRON = ramp('#7d8590'), OAK = ramp('#8a5a34'), AMB = ramp('#ffb347'), GOLD = ramp('#e0aa48');
  const COPPER = ramp('#c27a44'), LEATHER = ramp('#5a3a26');
  const HAND = L.gloves ? ramp(L.gloves) : S, HB = L.hairBias || 0, BEARD = L.beardCol ? hairRamp(L.beardCol) : H;
  const CP = L.cape || null, CR = CP ? ramp(CP.col) : null, CT = CP && CP.trim ? ramp(CP.trim) : null;
  const CLN = CP ? ramp(CP.lining || mixc(hex3(CP.col), PLUM, 0.5)) : null, CRS = CP && CP.cols ? CP.cols.map(ramp) : null;
  const shine = c => mixc(c, [255, 250, 236], 0.6);
  const eyeC = [36, 26, 40], WHITE = [250, 246, 236], blush = mixc(S[2], [222, 110, 110], 0.38);
  const iris = L.eyes ? hex3(L.eyes) : [70, 50, 40];
  const working = !!P.work, wf = P.wf || 0, bob = P.bob, blink = !!P.blink;
  const hy = g ? 6 : 0;
  const headCY = 19 + hy + bob, headRX = 12.6, headRY = 11, top = headCY - headRY, ey = headCY + 2;
  const torsoTop = (g ? 39 : 33) + bob, torsoBot = g ? 51 : 49, legTop = torsoBot + 1;
  const T = torsoTop, B = torsoBot, faceBias = L.faceLight ?? 0.15;
  // the walk: foot lifts and hand swings [left, right] seen from the front; ankles and the near hand seen from the side
  const step = P.walk ? P.step : -1;
  const LIFT = [[0, 2], [0, 3], [2, 0], [3, 0]], SWING = [[-1, 2], [0, 1], [2, -1], [1, 0]];
  const lift = step >= 0 ? LIFT[step] : [0, 0], swing = step >= 0 ? SWING[step] : [0, 0];
  const SIDE = [{ n: [16, 0], f: [31, 2], h: 5 }, { n: [23, 0], f: [25, 4], h: 2 }, { n: [31, 2], f: [16, 0], h: -5 }, { n: [25, 4], f: [23, 0], h: -2 }];
  const sd = step >= 0 ? SIDE[step] : { n: [21, 0], f: [26, 0], h: 0 };
  const sw1 = step === 0 ? 1 : step === 2 ? -1 : 0;     // which way loose things swing (capes, skirts, long hair)
  // what is in their hands while walking or standing: a weapon from their gear, or the cast's own item
  const carry = !working ? (L.weapon || (L.held && L.held !== 'book' ? L.held : null)) : null;
  const carryHand = L.weapon ? -1 : (L.heldHand || -1);
  const BL = ramp(L.blade || '#c8ccd4'), ED = L.bladeEdge ? ramp(L.bladeEdge) : BL;

  // ----- legs
  const bootFront = (x0, bt, lf, o, R) => {
    const x1 = x0 + 5, bot = 63 - lf;
    F.box(x0, bt, x1, bot - 2, R, { noBottom: true });
    F.box(x0, bt, x1, bt, R, { tone: 3 });
    const f0 = o < 0 ? x0 - 1 : x0, f1 = o < 0 ? x1 : x1 + 1;
    F.box(f0, bot - 1, f1, bot, R);
    for (let x = f0; x <= f1; x++) F.put(x, bot, R[0]);
    if (row === 0) { F.put(o < 0 ? x0 : x1, bot - 1, R[4]); F.put(o < 0 ? x0 + 1 : x1 - 1, bot - 1, R[3]); }
    else F.put(o < 0 ? x0 + 2 : x1 - 2, bot - 1, R[1]);
  };
  const bootSide = (ax, lf, R) => {
    const bot = 63 - lf;
    F.box(ax - 3, bot - 5, ax + 2, bot - 2, R, { noBottom: true });
    F.box(ax - 3, bot - 5, ax + 2, bot - 5, R, { tone: 3 });
    F.box(ax - 6, bot - 1, ax + 2, bot, R);
    for (let x = ax - 6; x <= ax + 2; x++) F.put(x, bot, R[0]);
    F.put(ax - 5, bot - 1, R[3]); F.put(ax - 6, bot - 1, R[2]);
  };
  const legs = () => {
    F.as('legs');
    if (row !== 2) {
      for (const [i, x0] of [[0, 17 - hb], [1, 25 + hb]]) {
        const lf = lift[i], o = i ? 1 : -1, bt = 58 - lf;
        F.box(x0, legTop, x0 + 5, bt - 1, PA, { noBottom: true });
        F.put(i ? x0 + 1 : x0 + 4, legTop + 2, PA[1]); F.put(i ? x0 + 1 : x0 + 4, legTop + 3, PA[1]);
        bootFront(x0, bt, lf, o, BO);
      }
    } else {
      const farPA = ramp(mixc(PA[2], PLUM, 0.35)), farBO = ramp(mixc(BO[2], PLUM, 0.35));
      for (const [k, R, RB] of [['f', farPA, farBO], ['n', PA, BO]]) {
        const [ax, lf] = sd[k], hip = k === 'n' ? 22.5 : 25.5;
        F.cap(hip, legTop + 0.5, ax, 58 - lf, 2.9, R);
        bootSide(ax, lf, RB);
      }
    }
  };
  // ----- patterned stockings, socks and tall boots
  const legsX = () => {
    if (!L.bootsTall && !L.legPattern && !L.socks) return;
    F.as('legs');
    const farPA = ramp(mixc(PA[2], PLUM, 0.35)), farBO = ramp(mixc(BO[2], PLUM, 0.35));
    if (L.legPattern) {
      for (const R of [PA, farPA]) F.retone(R, legTop, 63, (x, y, t) => {
        const on = L.legPattern === 'dots' ? ((x + y) % 3 === 0 && (x * 2 + y) % 5 < 3) : ((x + 2 * y) % 7 === 0 || (x - y + 70) % 9 === 0);
        return on ? (L.legPattern === 'dots' ? 0 : Math.min(4, t + 1)) : t;
      });
    }
    const legsAt = row !== 2 ? [[17 - hb, lift[0], BO, PA], [25 + hb, lift[1], BO, PA]] : [[sd.f[0] - 3, sd.f[1], farBO, farPA], [sd.n[0] - 3, sd.n[1], BO, PA]];
    for (const [x, lf, RB] of legsAt) {
      const bt = 58 - lf;
      if (L.bootsTall) { F.box(x, bt - 3, x + 5, bt - 1, RB, { noBottom: true }); F.box(x, bt - 3, x + 5, bt - 3, RB, { tone: 3 }); F.box(x, bt, x + 5, bt, RB, { tone: 2 }); }
      if (L.socks) { const SO = ramp(L.socks), y0 = bt - (L.bootsTall ? 3 : 0); for (let y = y0 - 2; y < y0; y++) for (let xx = x; xx <= x + 5; xx++) F.put(xx, y, SO[y === y0 - 2 ? 3 : xx === x + 5 ? 1 : 2]); F.put(x + 2, y0 - 1, ramp('#7a7f9a')[2]); F.put(x + 3, y0 - 1, ramp('#7a7f9a')[2]); }
    }
  };

  // ----- a long skirt, robe or tabard over the legs; its hem sways as they walk
  const sunAt = (x, y, big) => {
    const G = GOLD;
    F.put(x, y, G[4]); F.put(x + 1, y, G[3]); F.put(x, y + 1, G[3]); F.put(x + 1, y + 1, G[2]);
    if (big) { for (const [dx, dy] of [[0, -2], [1, -2], [0, 3], [1, 3], [-2, 0], [-2, 1], [3, 0], [3, 1]]) F.put(x + dx, y + dy, G[2]); for (const [dx, dy] of [[-1, -1], [2, -1], [-1, 2], [2, 2]]) F.put(x + dx, y + dy, G[1]); }
    else for (const [dx, dy] of [[-1, -1], [2, -1], [-1, 2], [2, 2]]) F.put(x + dx, y + dy, G[1]);
  };
  const skirt = () => {
    const K = L.skirt; if (!K) return;
    F.as('skirt');
    const tp = B - 3, bot = Math.min(63, tp + K.len * 2), n = Math.max(1, bot - tp), fl0 = (K.flare ?? 2) * 2;
    const RS = (K.cols || [K.col]).map(ramp), TR = K.trim ? ramp(K.trim) : null, ph = step >= 0 ? step : 0;
    const fmin = Math.min(sd.n[0], sd.f[0]), fmax = Math.max(sd.n[0], sd.f[0]);
    for (let y = tp; y <= bot; y++) {
      const k = (y - tp) / n, fl = fl0 * k;
      let x0, x1;
      if (row !== 2) { const s = Math.round(sw1 * k * k * 2.4); x0 = Math.round(14 - bw - fl) + s; x1 = Math.round(33 + bw + fl) + s; }
      else { x0 = Math.round(18 - hb + (fmin - 7 - 18 + hb - fl * 0.4) * k); x1 = Math.round(29 + hb + (fmax + 4 - 29 - hb + fl * 0.6) * k); }
      for (let x = x0; x <= x1; x++) {
        if (K.hem === 'tattered' && y > bot - 4 + [4, 3, 1, 0, 1, 3][(x + ph * 2) % 6]) continue;
        if (K.hem === 'wave' && y === bot && (x + ph) % 4 < 2) continue;
        let R = RS[0], t = x === x0 ? 3 : x >= x1 - 1 ? 1 : (y > tp + 1 && (x - x0) % 5 === 3) ? 1 : ((x - x0) % 5 === 1 && y > tp + 2) ? 3 : 2;
        if (K.pattern === 'patch') { const bx = Math.floor((x + 2) / 5), yy = y - tp + 2 + (bx & 1) * 2, by = Math.floor(yy / 5); R = RS[(bx * 5 + by * 3 + (bx * by & 1)) % RS.length]; t = x === x0 ? 3 : x >= x1 - 1 ? 1 : ((x + 2) % 5 === 0 || yy % 5 === 0) ? 1 : (x + 2) % 5 === 1 && yy % 5 === 1 ? 3 : 2; }
        if (K.pattern === 'layers') { const r = (y - tp) % 4; R = RS[Math.floor((y - tp) / 4) % RS.length]; if (r === 3) t = Math.min(t, 1); else if (r === 0 && t === 2) t = 3; }
        if (y >= bot - 1) t = Math.min(t, 1);
        if (TR && y >= bot - 1) { R = TR; t = y === bot ? 1 : x === x0 ? 3 : 2; }
        F.put(x, y, R[t]);
      }
    }
    if (row === 0 && K.emblem === 'sun') sunAt(23, tp + 5, true);
    if (row === 1 && K.emblem === 'sun') sunAt(23, tp + 6, true);
    if (row === 0 && K.slit) { const x = K.slit > 0 ? 28 : 18; for (let y = tp + 4; y < bot - 1; y++) { F.put(x, y, y < tp + 8 ? S[1] : PA[1]); F.put(x + 1, y, y < tp + 8 ? S[2] : PA[2]); } }
  };

  // ----- torso and clothes
  const bodyRows = (x0, x1, y0, y1, R, ins) => {   // a rounded-shouldered block, lit on the left
    for (let y = y0; y <= y1; y++) {
      const i = ins ? ins(y) : 0;
      for (let x = x0 + i; x <= x1 - i; x++) F.put(x, y, R[x <= x0 + i ? 3 : x >= x1 - i - 1 ? 1 : (y === y0 ? 3 : 2)]);
    }
  };
  const torso = () => {
    F.as('torso');
    const belt = L.over !== 'coat' && L.over !== 'overalls' && L.belt !== false, BT = ramp(L.belt || '#4a3226');
    if (row !== 2) {
      const x0 = 14 - bw, x1 = 33 + bw;
      bodyRows(x0, x1, T, B, SH, y => y === T ? 3 : y === T + 1 ? 1 : 0);
      // soft folds below the chest and at the waist
      for (const [x, y] of [[19, T + 8], [20, T + 9], [28, T + 8], [27, T + 9], [22, B - 4], [26, B - 4]]) F.put(x - (x < 24 ? hb : -hb), y, SH[1]);
      if (row === 0) {
        F.box(21, T, 22, T, SH, { tone: 4 }); F.box(25, T, 26, T, SH, { tone: 3 }); F.put(23, T, S[1]); F.put(24, T, S[1]); F.put(23, T + 1, S[0]); F.put(24, T + 1, SH[1]);
        for (let y = T + 2; y <= B - 4; y++) F.put(24, y, SH[1]);   // the placket, with buttons
        for (let y = T + 4; y <= B - 5; y += 4) { F.put(23, y, SH[4]); F.put(23, y + 1, SH[1]); }
        for (const [x, y] of [[x0 + 2, T + 3], [x0 + 2, T + 4], [x1 - 2, T + 3], [x1 - 2, T + 4]]) F.put(x, y, SH[1]);   // pull at the armpits
      } else { for (let y = T + 3; y <= B - 4; y++) if (y % 5) F.put(24, y, SH[1]); }
      if (L.over === 'vest') {
        if (row === 0) {
          for (const [a, b] of [[x0, x0 + 7], [x1 - 7, x1]]) { bodyRows(a, b, T + 1, B - 2, OV, y => y < T + 3 ? (a === x0 ? 0 : 0) : 0); F.put(a === x0 ? b : a, B - 1, OV[1]); }
          for (const y of [T + 7, T + 11]) { F.put(x0 + 7 - 1, y, BRASS[3]); }
          F.put(x0 + 7, T + 1, SH[1]); F.put(x1 - 7, T + 1, SH[1]);
        } else { bodyRows(x0, x1, T + 1, B - 2, OV); for (let y = T + 2; y < B - 2; y++) F.put(23, y, OV[1]); }
      }
      if (L.over === 'apron') {
        if (row === 0) {
          F.box(17 - hb, T + 6, 30 + hb, B + 7, OV, { noBottom: false, soft: true });
          for (let y = T; y < T + 6; y++) { F.put(18 - hb, y, OV[1]); F.put(19 - hb, y, OV[2]); F.put(28 + hb, y, OV[2]); F.put(29 + hb, y, OV[1]); }
          F.box(21, T + 11, 26, T + 14, OV, { tone: 1 }); F.box(21, T + 11, 26, T + 11, OV, { tone: 3 }); F.put(18 - hb, T + 6, BRASS[3]); F.put(29 + hb, T + 6, BRASS[3]);
          for (let y = B + 2; y <= B + 6; y += 2) F.put(20, y, OV[1]);
        } else {
          F.line(18 - hb, T, 29 + hb, T + 9, OV[1]); F.line(29 + hb, T, 18 - hb, T + 9, OV[1]); F.line(19 - hb, T, 30 + hb, T + 9, OV[2]); F.line(28 + hb, T, 17 - hb, T + 9, OV[2]);
          F.box(x0, T + 9, x1, T + 10, OV, { tone: 2 }); F.box(22, T + 9, 25, T + 12, OV, { tone: 3 }); F.put(22, T + 12, OV[1]); F.put(25, T + 12, OV[1]);
          F.box(x0, T + 11, x0 + 1, B + 6, OV); F.box(x1 - 1, T + 11, x1, B + 6, OV);
        }
      }
      if (L.over === 'coat') {
        F.box(x0 - 1, T + 2, x1 + 1, B + 5, OV, { soft: true });
        F.box(x0 + 1, T + 1, x1 - 1, T + 1, OV, { tone: 3 }); F.box(x0 + 3, T, x1 - 3, T, OV, { tone: 3 });
        if (row === 0) {
          F.box(22, T + 1, 25, B + 5, SH, { soft: true });
          for (let i = 0; i < 6; i++) { F.put(21 - Math.floor(i / 2), T + 1 + i, OV[3]); F.put(26 + Math.floor(i / 2), T + 1 + i, OV[2]); }
          for (const y of [T + 8, T + 12, T + 16]) { F.put(20, y, BRASS[4]); F.put(20, y + 1, BRASS[1]); }
          F.put(22, B + 5, OV[1]); F.put(25, B + 5, OV[1]);
        } else { for (let y = T + 2; y <= B + 5; y++) F.put(23, y, OV[1]); for (let y = B; y <= B + 5; y++) F.put(24, y, OV[0]); }
      }
      if (L.over === 'overalls') {
        F.box(18 - hb, T + 6, 29 + hb, B, OV, { soft: true });
        for (let y = T; y < T + 6; y++) { F.put(19 - hb, y, OV[2]); F.put(20 - hb, y, OV[1]); F.put(27 + hb, y, OV[2]); F.put(28 + hb, y, OV[1]); }
        if (row === 0) { F.put(19 - hb, T + 6, BRASS[4]); F.put(28 + hb, T + 6, BRASS[4]); F.box(21, T + 9, 26, T + 12, OV, { tone: 1 }); F.box(21, T + 9, 26, T + 9, OV, { tone: 3 }); }
        else { F.line(19 - hb, T, 28 + hb, T + 6, OV[1]); F.line(28 + hb, T, 19 - hb, T + 6, OV[1]); }
      }
      if (belt) {
        F.box(x0, B - 3, x1, B - 2, BT, { flat: true }); F.box(x0, B - 3, x1, B - 3, BT, { tone: 3 });
        if (row === 0) { F.box(22, B - 4, 25, B - 1, BRASS, { flat: true }); F.box(23, B - 3, 24, B - 2, BT, { tone: 0 }); F.put(22, B - 4, BRASS[4]); }
      }
      if (L.scarf) {
        const SC = ramp(L.scarf);
        F.box(16, T - 1, 31, T + 2, SC, { soft: true }); F.box(17, T - 1, 30, T - 1, SC, { tone: 3 });
        if (row === 0) { F.box(27, T + 2, 29, T + 9, SC, { soft: true }); F.put(27, T + 10, SC[1]); F.put(29, T + 10, SC[1]); F.ell(28.5, T + 2.5, 2.2, 1.8, SC); }
        else { F.ell(23.5, T + 1.5, 2, 1.6, SC); }
      }
      if (L.satchel) {
        const ST = LEATHER, BG = ramp('#7a5234');
        if (row === 0) { F.line(15, T + 1, 30, B - 6, ST[1]); F.line(16, T + 1, 31, B - 6, ST[2]); F.box(28, B - 7, 35, B + 1, BG, { soft: true }); F.box(28, B - 7, 35, B - 5, BG, { tone: 1 }); F.put(31, B - 4, BRASS[4]); F.put(32, B - 4, BRASS[2]); }
        else { F.line(31, T + 1, 17, B - 6, ST[1]); F.line(32, T + 1, 18, B - 6, ST[2]); }
      }
    } else {
      const x0 = 18 - hb, x1 = 29 + hb;
      bodyRows(x0, x1, T, B, SH, y => y === T ? 2 : y === T + 1 ? 1 : 0);
      for (let y = T + 3; y <= T + 9; y++) F.put(x0 - 1, y, SH[y === T + 3 ? 3 : 2]);   // the chest
      for (const [x, y] of [[22, T + 9], [23, T + 10], [21, B - 4]]) F.put(x, y, SH[1]);
      if (L.over === 'vest') { bodyRows(23, x1, T + 1, B - 2, OV); bodyRows(x0 - 1, x0 + 1, T + 3, B - 2, OV); F.put(x0 + 1, T + 8, BRASS[3]); }
      if (L.over === 'apron') { F.box(x0 - 1, T + 6, x0 + 3, B + 6, OV, { soft: true }); F.box(x0 - 1, T + 6, x0 - 1, B + 6, OV, { tone: 3 }); F.line(x0 + 3, T, x0 + 2, T + 6, OV[1]); F.box(x0, T + 9, x1, T + 10, OV, { tone: 2 }); F.box(x1 - 1, T + 9, x1 + 1, T + 13, OV, { tone: 1 }); }
      if (L.over === 'coat') { F.box(x0 - 2, T + 2, x1 + 2, B + 5, OV, { soft: true }); F.box(x0, T, x1 - 1, T + 1, OV, { tone: 3 }); F.box(x0 - 2, T + 2, x0 - 1, T + 9, SH, { tone: 3 }); F.put(x0 - 1, T + 12, BRASS[4]); F.put(x0 - 1, T + 16, BRASS[4]); }
      if (L.over === 'overalls') { F.box(x0 - 1, T + 6, x0 + 4, B, OV); F.line(x0 + 3, T, x0 + 2, T + 6, OV[1]); F.put(x0 + 2, T + 6, BRASS[4]); }
      if (belt) { F.box(x0, B - 3, x1, B - 2, BT, { flat: true }); F.box(x0, B - 3, x1, B - 3, BT, { tone: 3 }); F.put(x0, B - 3, BRASS[3]); }
      if (L.scarf) { const SC = ramp(L.scarf); F.box(x0, T - 1, x1, T + 2, SC); F.box(x1 - 2, T + 2, x1, T + 8, SC, { soft: true }); }
      if (L.satchel) { const BG = ramp('#7a5234'); F.line(x0 + 1, T + 1, x1, B - 6, LEATHER[1]); F.box(x1 - 1, B - 7, x1 + 5, B + 1, BG, { soft: true }); F.box(x1 - 1, B - 7, x1 + 5, B - 5, BG, { tone: 1 }); }
    }
  };
  // ----- the cast's clothes over the torso
  const torsoX = () => {
    F.as('torso');
    const side = row === 2, x0 = side ? 18 - hb : 14 - bw, x1 = side ? 29 + hb : 33 + bw;
    if (L.over === 'corset') {
      if (!side) {
        bodyRows(x0 + 2, x1 - 2, T + 4, B - 4, OV, y => y >= B - 5 ? 1 : 0);
        for (let y = T + 5; y <= B - 5; y++) { F.put(23, y, OV[(y & 1) ? 4 : 1]); F.put(24, y, OV[(y & 1) ? 1 : 4]); }
        F.box(x0 + 2, T + 4, x1 - 2, T + 4, OV, { tone: 3 });
      } else { bodyRows(x0, x1, T + 4, B - 4, OV); F.box(x0, T + 4, x1, T + 4, OV, { tone: 3 }); for (let y = T + 6; y <= B - 5; y += 2) F.put(x0, y, OV[4]); }
    }
    if (L.neck === 'low' && row === 0) { F.box(20, T, 27, T, S, { tone: 2 }); F.box(21, T + 1, 26, T + 1, S, { tone: 2 }); F.box(22, T + 2, 25, T + 2, S, { tone: 1 }); F.put(23, T + 3, S[1]); F.put(24, T + 3, S[1]); }
    if (L.neck === 'off') {
      if (!side) { F.box(x0 + 2, T, x1 - 2, T + 1, S, { tone: 2 }); F.box(x0 + 3, T, x1 - 3, T, S, { tone: 3 }); if (row === 0) F.box(20, T + 2, 27, T + 2, S, { tone: 1 }); }
      else F.box(x0 + 1, T, x1 - 2, T + 1, S, { tone: 2 });
    }
    if (L.collar === 'ruff') {
      const C = ramp(L.collarCol || '#2a2228'), a = side ? 17 : 15, b = side ? 30 : 32;
      for (let x = a; x <= b; x++) { const k = (x - a) % 3; F.put(x, T - 2, C[k === 1 ? 4 : 2]); F.put(x, T - 1, C[k === 1 ? 3 : 2]); F.put(x, T, C[k === 2 ? 0 : 1]); F.put(x, T + 1, C[k === 0 ? 1 : 2]); }
    }
    if (L.collar === 'choker' && row !== 1) {
      const C = ramp(L.collarCol || '#2a1a22');
      if (row === 0) { F.box(20, T - 2, 27, T - 1, C, { tone: 1 }); F.ell(23.5, T + 0.8, 1.6, 1.6, GOLD, { shine: true }); }
      else { F.box(18, T - 2, 23, T - 1, C, { tone: 1 }); F.ell(18, T + 0.8, 1.4, 1.4, GOLD); }
    }
    if (L.pendant && row === 0) { const P2 = ramp(L.pendant); F.line(21, T + 1, 23, T + 4, GOLD[1]); F.line(26, T + 1, 24, T + 4, GOLD[1]); F.ell(24, T + 6, 1.8, 2.2, P2, { shine: true }); }
    if (L.pouches) {
      const P2 = ramp(L.pouches);
      if (row === 0) { F.box(11 - bw, B - 2, 16 - bw, B + 4, P2, { soft: true }); F.box(11 - bw, B - 2, 16 - bw, B - 1, P2, { tone: 1 }); F.put(13 - bw, B, BRASS[4]); F.box(31 + bw, B - 2, 34 + bw, B + 2, P2, { soft: true }); }
      else if (row === 1) F.box(31 + bw, B - 2, 36 + bw, B + 4, P2, { soft: true });
      else { F.box(23, B - 2, 28, B + 4, P2, { soft: true }); F.box(23, B - 2, 28, B - 1, P2, { tone: 1 }); F.put(25, B, BRASS[4]); }
    }
  };

  // crossed shoulder straps with a bag on each hip, over coats and capes
  const straps = () => {
    if (!L.straps) return;
    F.as('straps');
      const ST = ramp(L.straps), BG = ramp(L.strapBags || '#7a5234');
      if (row === 1) {
        F.cap(17.5, T + 0.5, 30.5, B - 4.5, 0.9, ST); F.cap(30.5, T + 0.5, 17.5, B - 4.5, 0.9, ST);
        F.box(11, B - 6, 17, B + 2, BG, { soft: true }); F.box(30, B - 6, 36, B + 2, BG, { soft: true });
        F.box(11, B - 6, 17, B - 4, BG, { tone: 1 }); F.box(30, B - 6, 36, B - 4, BG, { tone: 1 }); F.put(14, B - 3, BRASS[4]); F.put(33, B - 3, BRASS[4]);
      } else if (row === 0) {
        F.cap(17.5, T + 0.5, 19.5, B - 4.5, 0.9, ST); F.cap(30.5, T + 0.5, 28.5, B - 4.5, 0.9, ST);
        F.box(12, B - 5, 17, B + 2, BG, { soft: true }); F.box(30, B - 5, 35, B + 2, BG, { soft: true }); F.box(12, B - 5, 17, B - 4, BG, { tone: 1 }); F.box(30, B - 5, 35, B - 4, BG, { tone: 1 });
      } else { F.cap(20.5, T + 0.5, 28.5, B - 4.5, 0.9, ST); F.box(26, B - 6, 32, B + 2, BG, { soft: true }); F.box(26, B - 6, 32, B - 4, BG, { tone: 1 }); F.put(29, B - 3, BRASS[4]); }
  };

  // ----- armour: a breastplate, plates on the shoulders, greaves
  const armour = () => {
    const A = L.armour; if (!A) return;
    F.as('armour');
    const M = ramp(A.col);
    if (A.plate !== false) {
      const clip = (x, y) => y >= T && y <= B - 4;
      if (row !== 2) F.ell(24, T + 6, 8.4 + bw, 7.6, M, { clip, shine: true }); else F.ell(23.5, T + 6, 6 + hb, 7.6, M, { clip, shine: true });
      if (row === 0) {
        F.put(18 - bw, T + 3, shine(M[3])); F.put(19 - bw, T + 3, shine(M[3])); F.put(18 - bw, T + 4, M[4]);
        for (let y = T + 3; y <= B - 6; y++) F.put(23, y, M[1]);
        if (A.emblem === 'sun') sunAt(23, T + 6, true);
      }
      if (row === 2) { F.put(19, T + 3, shine(M[3])); F.put(19, T + 4, M[4]); }
      if (A.trim) { const TR = ramp(A.trim); if (row !== 2) F.box(16 - bw, B - 5, 31 + bw, B - 4, TR, { flat: true }); else F.box(19, B - 5, 28, B - 4, TR, { flat: true }); }
    }
    if (A.greaves && !L.skirt) {
      if (row !== 2) for (const [x, lf] of [[17 - hb, lift[0]], [25 + hb, lift[1]]]) { F.box(x, 53 - lf, x + 5, 57 - lf, M); F.put(x + 1, 54 - lf, shine(M[3])); }
      else { const [ax, lf] = sd.n; F.box(ax - 3, 53 - lf, ax + 2, 57 - lf, M); F.put(ax - 2, 54 - lf, shine(M[3])); }
    }
  };
  const pauldrons = () => {
    const A = L.armour; if (!A || !A.pauldron) return;
    F.as('pauldron');
    const M = ramp(A.col), TR = A.trim ? ramp(A.trim) : null, big = A.big ? 1.4 : 0;
    for (const s0 of A.pauldron === 'both' ? [-1, 1] : [A.pauldron === 'L' ? -1 : 1]) {
      if (row === 2) {   // facing left, the near shoulder is the one on the viewer's right in the front view
        if (s0 < 0) continue;
        F.ell(24.5, T + 2.6, 5.4 + big, 4.4 + big * 0.6, M, { shine: true }); F.ell(25, T + 6.6, 4.8 + big, 3, M);
        if (TR) for (let x = 21; x <= 28; x++) F.put(x, T + 6, TR[2]);
        continue;
      }
      const s = row === 1 ? -s0 : s0, cx = s < 0 ? 12 - bw : 36 + bw;
      F.ell(cx + s * (0.6 + big * 0.6), T + 2.4, 5.2 + big, 4.2 + big * 0.6, M, { shine: true });
      F.ell(cx + s * (1.2 + big * 0.8), T + 6.4, 4.6 + big, 2.8 + big * 0.4, M);
      if (big) F.ell(cx + s * (1.6 + big), T + 9.4, 4 + big * 0.6, 2.2, M);
      if (TR) for (let x = Math.round(cx - 4); x <= Math.round(cx + 4); x++) F.put(x + s * 1, T + 5 + Math.round(big), TR[x === Math.round(cx) ? 4 : 2]);
    }
  };

  // ----- arms
  const sleeve = L.sleeveCol ? ramp(L.sleeveCol) : CP && CP.open ? CR : L.over === 'coat' ? OV : SH;
  // a hand, 4 x 4: the thumb toward the body, the fingers suggested by a crease
  const handAt = (x, y, side, R = HAND) => {
    F.stamp(x, y, side < 0 ? ['2321', '3221', '3211', '.21.'] : ['1232', '1223', '1123', '.12.'], R);
    F.put(side < 0 ? x + 2 : x + 1, y + 3, R[0]);
  };
  // a hanging arm seen from the front or back: sleeve from y0, the hand's last row y1; side -1 is the viewer's left
  const armV = (xa, xb, y0, y1, side, item) => {
    const st = L.sleeves, cx = Math.round((xa + xb - 3) / 2);
    if (st === 'rolled') { F.box(xa, y0, xb, y0 + 5, sleeve); F.box(xa, y0 + 5, xb, y0 + 5, sleeve, { tone: 3 }); F.box(xa, y0 + 6, xb, y1 - 4, S); if (L.bracers) { F.box(xa, y1 - 8, xb, y1 - 5, ramp(L.bracers)); F.box(xa, y1 - 8, xb, y1 - 8, ramp(L.bracers), { tone: 3 }); } }
    else if (st === 'short') { F.box(xa, y0 + 4, xb, y1 - 4, S); F.box(xa - (side < 0 ? 1 : 0), y0, xb + (side > 0 ? 1 : 0), y0 + 3, sleeve); }
    else if (st === 'puff') { F.box(xa, y0 + 4, xb, y1 - 4, S); F.ell((xa + xb + 1) / 2 + side * 0.8, y0 + 2.6, 3.6, 3.6, sleeve, { shine: true }); F.box(xa, y0 + 6, xb, y0 + 6, sleeve, { tone: 1 }); }
    else if (st === 'bell') { F.box(xa, y0, xb, y1 - 8, sleeve); F.box(Math.min(xa, xa + side), y1 - 7, Math.max(xb, xb + side), y1 - 6, sleeve); F.box(Math.min(xa, xa + 2 * side), y1 - 5, Math.max(xb, xb + 2 * side), y1 - 4, sleeve); F.put(side < 0 ? xa - 2 : xb + 2, y1 - 3, sleeve[1]); }
    else { F.box(xa, y0, xb, y1 - 4, sleeve); F.put(side < 0 ? xb - 1 : xa + 1, y0 + 5, sleeve[1]); F.put(side < 0 ? xb - 2 : xa + 2, y0 + 6, sleeve[1]); F.put(side < 0 ? xb - 1 : xa + 1, y0 + 7, sleeve[3]); F.box(xa, y1 - 4, xb, y1 - 4, sleeve, { tone: 1 }); }
    if (L.cuffs) F.box(xa, y1 - 5, xb, y1 - 4, ramp(L.cuffs), { flat: true });
    if (item) drawCarry(item, cx + 1.5, y1 - 1.5, side, 0);
    F.as(side < 0 ? 'handL' : 'handR'); handAt(cx, y1 - 3, side);
  };
  // the near arm seen from the side, swinging by h; the far arm is drawn behind the body
  const armSide = (item) => {
    const st = L.sleeves, h = sd.h, sx = 23.5, sy = T + 2.5, ex = sx + h * 0.45, eyy = T + 9, wx = sx + h, wy = B - 3, r = 2 + hb * 0.5;
    const skinFrom = st === 'rolled' ? 0.55 : st === 'short' ? 0.3 : st === 'puff' ? 0.4 : 2;
    F.cap(sx, sy, ex, eyy, r, skinFrom < 1 && skinFrom < 0.5 ? S : sleeve);
    if (skinFrom < 0.5) F.cap(sx, sy, sx + (ex - sx) * 0.5, sy + (eyy - sy) * 0.5, r + 0.3, sleeve);
    F.cap(ex, eyy, wx, wy, st === 'bell' ? r : r, skinFrom <= 1 ? S : sleeve, st === 'bell' ? { r1: r + 1.6 } : {});
    if (st === 'rolled' && L.bracers) F.cap(ex + (wx - ex) * 0.45, eyy + (wy - eyy) * 0.45, wx, wy - 1, r + 0.2, ramp(L.bracers));
    if (st === 'puff') F.ell(sx, sy + 1, 3.6, 3.4, sleeve, { shine: true });
    if (st === 'bell') F.cap(ex, eyy + 2, wx, wy, r + 0.6, sleeve, { r1: r + 2.2 });
    if (L.cuffs) F.cap(wx, wy - 1.5, wx, wy - 0.5, r + 0.4, ramp(L.cuffs));
    if (item) drawCarry(item, wx, wy + 1.5, 0, 2);
    F.as('handN'); F.ell(wx, wy + 1.8, 2.2, 2.4, HAND); F.put(Math.round(wx) - 2, Math.round(wy) + 3, HAND[1]);
  };
  const farArm = () => {   // side view: the far arm, behind the body, swinging the other way
    F.as('farArm');
    const far = ramp(mixc(sleeve[2], PLUM, 0.3)), h = -sd.h, sx = 25.5, sy = T + 3;
    F.cap(sx, sy, sx + h * 0.45, T + 9, 2, far); F.cap(sx + h * 0.45, T + 9, sx + h, B - 3, 2, (L.sleeves === 'rolled' || L.sleeves === 'short' || L.sleeves === 'puff') ? ramp(mixc(S[2], PLUM, 0.25)) : far);
  };
  // an arm bent to carry a book against the chest
  const bookArm = (s) => {
    const BK = ramp(L.bookCol || '#6a3a28'), PG = ramp('#efe2c4');
    if (row === 2) {
      F.cap(23.5, T + 2.5, 22, T + 7, 2, sleeve);
      F.box(10, T + 2, 16, T + 12, BK, { soft: true }); F.box(16, T + 3, 17, T + 11, PG, { tone: 3 }); F.put(12, T + 5, GOLD[4]); F.put(13, T + 6, GOLD[2]);
      F.cap(22, T + 7, 16, T + 9, 2, sleeve); F.ell(16, T + 9, 2.2, 2.2, HAND);
      return;
    }
    const xa = s > 0 ? 34 + hb : 10 - bw, xb = xa + 3 + hb;
    F.box(xa, T + 1, xb, T + 8, sleeve);
    if (L.sleeves === 'bell') F.box(xa + (s > 0 ? 0 : -2), T + 9, xb + (s > 0 ? 2 : 0), T + 14, sleeve);
    if (row === 1) return;
    const b0 = s > 0 ? 25 : 13;
    F.box(b0, T + 3, b0 + 9, T + 14, BK, { soft: true }); F.box(b0 + 1, T + 3, b0 + 8, T + 4, PG, { tone: 3 });
    F.box(s > 0 ? b0 : b0 + 9, T + 4, s > 0 ? b0 : b0 + 9, T + 14, PG, { tone: 1 });
    F.ell(b0 + 4.5, T + 9, 2, 2.2, GOLD, { shine: true }); F.put(b0 + 4, T + 12, GOLD[1]); F.put(b0 + 5, T + 12, GOLD[1]);
    handAt(s > 0 ? 31 : 13, T + 11, s);
  };
  const arms = () => {
    if (working) return;
    if (row !== 2) {
      const book = L.held === 'book' ? (L.heldHand || 1) * (row === 1 ? -1 : 1) : 0;
      const ch = row === 1 ? -carryHand : carryHand;
      F.as('armL'); if (book < 0) bookArm(-1); else armV(10 - bw, 13, T + 1, B + swing[0], -1, ch < 0 ? carry : null);
      F.as('armR'); if (book > 0) bookArm(1); else armV(34, 37 + bw, T + 1, B + swing[1], 1, ch > 0 ? carry : null);
    } else { F.as('armN'); if (L.held === 'book') bookArm(1); else armSide(carry); }
  };

  // ----- things carried while walking or standing
  function drawCarry(kind, hx, hy, side, mode) {   // mode 0: front or back, 2: side
    F.as('carry');
    const cat = kind === 'dagger' && L.held === 'dagger' ? 'up' : pxCarry(kind);
    let ang, k = 1;
    if (mode === 2) { ang = cat === 'long' ? -1.72 : cat === 'up' ? -2.3 : cat === 'short' ? 2.05 : 1.8; k = cat === 'short' ? 0.7 : cat === 'small' ? 0.85 : 1; }
    else { const o = side < 0 ? -1 : 1; ang = cat === 'long' ? -Math.PI / 2 - 0.12 * o : cat === 'up' ? -Math.PI / 2 - 0.65 * o : Math.PI / 2 + (cat === 'short' ? 0.42 : 0.12) * o; k = cat === 'short' ? 0.68 : cat === 'small' ? 0.85 : 1; }
    drawTool(kind, hx, hy, ang, -1, k);
  }

  // ----- head
  const eyeAt = (x0, right) => {   // a chibi eye, 4 wide: white on the outside, iris inside, a highlight top left
    const I = mixc(iris, WHITE, 0.12), Id = mixc(iris, eyeC, 0.5), Il = mixc(iris, WHITE, 0.4), HL = [255, 255, 252];
    if (blink && row === 0) { for (let i = 0; i < 4; i++) F.put(x0 + i, ey + (i === 0 || i === 3 ? 1 : 2), mixc(S[0], eyeC, 0.5)); F.put(right ? x0 + 4 : x0 - 1, ey, mixc(S[0], eyeC, 0.6)); return; }
    const wx = right ? x0 + 3 : x0, ix = right ? x0 : x0 + 1;
    for (let i = 0; i < 4; i++) F.put(x0 + i, ey - 1, eyeC);
    F.put(right ? x0 + 4 : x0 - 1, ey, eyeC);   // the outer corner of the lid
    F.put(wx, ey, WHITE); F.put(wx, ey + 1, WHITE); F.put(wx, ey + 2, mixc(WHITE, S[1], 0.45));
    F.put(ix, ey, HL); F.put(ix + 1, ey, Id); F.put(ix + 2, ey, Id);
    F.put(ix, ey + 1, Id); F.put(ix + 1, ey + 1, eyeC); F.put(ix + 2, ey + 1, Id);
    F.put(ix, ey + 2, I); F.put(ix + 1, ey + 2, Il); F.put(ix + 2, ey + 2, I);
    F.put(x0 + 1, ey + 3, S[1]); F.put(x0 + 2, ey + 3, S[1]);
    if (L.lashes) { F.put(right ? x0 + 4 : x0 - 1, ey - 1, eyeC); F.put(right ? x0 + 5 : x0 - 2, ey - 2, eyeC); }
  };
  const head = () => {
    F.as('neck'); F.box(20, T - 4, 27, T, S, { tone: 1 }); F.box(20, T - 4, 20, T, S, { tone: 2 });
    F.as('head');
    F.ell(24, headCY, headRX, headRY, S, { bias: faceBias });
    if (row === 0) {
      for (const x of [10, 37]) { F.put(x, ey, S[2]); F.put(x, ey + 1, S[1]); F.put(x, ey + 2, S[1]); F.put(x + (x < 24 ? 1 : -1), ey + 1, S[0]); }
      eyeAt(16, false); eyeAt(28, true);
      const m0 = mixc(S[0], [130, 40, 50], 0.45), m1 = mixc(S[1], [180, 80, 80], 0.35);
      F.put(24, ey + 4, S[1]); F.put(23, ey + 3, S[3]);
      F.put(22, ey + 6, m1); F.put(23, ey + 6, m0); F.put(24, ey + 6, m0); F.put(25, ey + 6, m1); F.put(23, ey + 7, S[3]);
      F.put(13, ey + 4, blush); F.put(14, ey + 4, blush); F.put(33, ey + 4, blush); F.put(34, ey + 4, blush);
      faceX();
      if (L.glasses) glassesF();
    } else if (row === 2) {
      // side: eye, nose, mouth, ear
      if (blink) { F.put(14, ey + 1, mixc(S[0], eyeC, 0.5)); F.put(15, ey + 2, mixc(S[0], eyeC, 0.5)); F.put(16, ey + 2, mixc(S[0], eyeC, 0.5)); }
      else {
        const Id = mixc(iris, eyeC, 0.5), I = mixc(iris, WHITE, 0.12);
        for (let x = 14; x <= 17; x++) F.put(x, ey - 1, eyeC);
        F.put(14, ey, WHITE); F.put(14, ey + 1, WHITE); F.put(15, ey, [255, 255, 252]); F.put(16, ey, Id); F.put(15, ey + 1, Id); F.put(16, ey + 1, eyeC); F.put(15, ey + 2, I); F.put(16, ey + 2, I); F.put(17, ey, eyeC);
        if (L.lashes) { F.put(17, ey - 1, eyeC); F.put(18, ey - 2, eyeC); }
      }
      F.put(10, ey + 3, S[3]); F.put(11, ey + 2, S[2]); F.put(10, ey + 4, S[1]); F.put(11, ey + 4, S[1]);
      F.put(12, ey + 6, mixc(S[1], [180, 80, 80], 0.35)); F.put(13, ey + 6, mixc(S[0], [130, 40, 50], 0.45));
      F.put(18, ey + 4, blush); F.put(19, ey + 4, blush);
      F.ell(27, ey + 2, 2.2, 3, S); F.put(27, ey + 2, S[0]); F.put(26, ey + 3, S[1]); F.put(27, ey + 4, S[1]);
      faceX();
      if (L.glasses) glassesS();
    } else {
      for (const x of [10, 37]) { F.put(x, ey, S[2]); F.put(x, ey + 1, S[1]); F.put(x, ey + 2, S[1]); }
    }
    if (L.beard) beardDraw();
  };
  const glassesF = () => {
    const G = L.glassesCol ? ramp(L.glassesCol) : BRASS, GL = [210, 236, 240];
    for (const x0 of [16, 28]) {
      for (let x = x0; x <= x0 + 3; x++) { F.put(x, ey - 2, G[2]); F.put(x, ey + 3, G[1]); }
      for (let y = ey - 1; y <= ey + 2; y++) { F.put(x0 - 1, y, G[2]); F.put(x0 + 4, y, G[1]); }
      F.put(x0, ey - 1, GL);
    }
    F.box(20, ey - 1, 27, ey - 1, G, { flat: true }); F.line(11, ey, 14, ey - 1, G[1]); F.line(36, ey, 33, ey - 1, G[1]);
  };
  const glassesS = () => {
    const G = L.glassesCol ? ramp(L.glassesCol) : BRASS;
    for (let x = 13; x <= 18; x++) { F.put(x, ey - 2, G[2]); F.put(x, ey + 3, G[1]); }
    for (let y = ey - 1; y <= ey + 2; y++) { F.put(13, y, G[2]); F.put(18, y, G[1]); }
    F.line(19, ey, 25, ey, G[1]);
  };
  // small things on the face: lashes are in eyeAt; freckles, face paint, heavy brows, and everyone's brows
  function faceX() {
    const D = L.brows ? ramp(L.beardCol || L.hair) : null, fr = mixc(S[1], [160, 80, 50], 0.35), BR = D || H;
    if (row === 0) {
      if (D) { F.box(15, ey - 4, 19, ey - 3, D, { tone: 0 }); F.box(28, ey - 4, 32, ey - 3, D, { tone: 0 }); F.put(20, ey - 2, D[0]); F.put(27, ey - 2, D[0]); }
      else { F.line(16, ey - 3, 19, ey - 4, BR[1]); F.line(28, ey - 4, 31, ey - 3, BR[1]); }
      if (L.freckles) for (const [x, y] of [[19, 4], [21, 5], [26, 5], [28, 4], [15, 5], [32, 5]]) F.put(x, ey + y, fr);
      if (L.facePaint) { const FP = ramp(L.facePaint); for (const x of [17, 30]) { F.put(x, ey + 3, FP[1]); F.put(x, ey + 4, FP[1]); F.put(x, ey + 5, FP[2]); } F.put(23, ey + 6, FP[1]); F.put(24, ey + 6, FP[1]); F.put(22, ey + 6, FP[2]); F.put(25, ey + 6, FP[2]); }
    } else {
      if (D) { F.box(14, ey - 4, 18, ey - 3, D, { tone: 0 }); F.put(13, ey - 2, D[0]); } else F.line(14, ey - 3, 17, ey - 4, BR[1]);
      if (L.freckles) for (const [x, y] of [[13, 4], [16, 5], [18, 3]]) F.put(x, ey + y, fr);
      if (L.facePaint) { const FP = ramp(L.facePaint); F.put(15, ey + 3, FP[1]); F.put(15, ey + 4, FP[1]); F.put(15, ey + 5, FP[2]); F.put(12, ey + 6, FP[1]); F.put(13, ey + 6, FP[1]); }
    }
  }
  const beardDraw = () => {
    F.as('beard');
    const Bd = BEARD, full = L.beard === 'full', gl = g ? 5 : 0;
    if (row === 0) {
      if (full) F.ell(24, headCY + 6.6, 12.6, 6.6 + gl, Bd, { clip: (x, y) => y >= headCY + 6 || ((x <= 14 || x >= 33) && y >= headCY + 3) });
      F.ell(24, headCY + 7.6, 10.2, 5.4 + gl, Bd, { clip: (x, y) => y >= headCY + 6 });
      F.put(24, ey + 4, S[1]);   // the nose tip shows above the moustache
      // the moustache and the mouth in it
      F.box(19, ey + 5, 28, ey + 5, Bd, { tone: full ? 3 : 2 }); F.put(18, ey + 6, Bd[1]); F.put(29, ey + 6, Bd[1]);
      F.put(22, ey + 7, mixc(S[0], Bd[0], 0.5)); F.put(23, ey + 7, S[0]); F.put(24, ey + 7, S[0]); F.put(25, ey + 7, mixc(S[0], Bd[0], 0.5));
      F.retone(Bd, headCY + 2, headCY + 22, (x, y, t) => { const c = CURL[y % 3 === 2 ? 3 : y % 3][(x + (((y / 3) | 0) & 1) * 2) & 3]; return c === 1 ? Math.min(t, 1) : c === 3 && t >= 2 ? 3 : t; });
    } else if (row === 2) {
      if (full) F.ell(19, headCY + 6.8, 9, 6.4 + gl, Bd, { clip: (x, y) => x <= 24 && (y >= headCY + 6 || (x >= 19 && y >= headCY + 3)) });
      F.ell(17.5, headCY + 7.8, 7, 5 + gl, Bd, { clip: (x, y) => y >= headCY + 6 && x <= 22 });
      F.box(11, ey + 5, 15, ey + 5, Bd, { tone: 2 });
      F.retone(Bd, headCY + 2, headCY + 22, (x, y, t) => { const c = CURL[y % 3 === 2 ? 3 : y % 3][(x + (((y / 3) | 0) & 1) * 2) & 3]; return c === 1 ? Math.min(t, 1) : c === 3 && t >= 2 ? 3 : t; });
      if (full) { F.put(26, ey + 2, S[1]); F.put(27, ey + 3, S[0]); }
    }
  };

  // ----- hair: drawn as pieces relative to the head
  const BASE = { wavy: 'long', curlyLong: 'curly', shag: 'crop', updo: 'bun' };
  const hairBack = () => {   // the part that hangs behind the shoulders (front view)
    if (row !== 0) return;
    F.as('hairBack');
    if (L.hairStyle === 'long') { F.box(10, headCY + 4, 14, headCY + 20, H, { soft: true }); F.box(33, headCY + 4, 37, headCY + 20, H, { soft: true }); F.clear(10, headCY + 20); F.clear(37, headCY + 20); }
    if (L.hairStyle === 'braids') { braidCol(11, headCY + 8, headCY + 24, H); braidCol(34, headCY + 8, headCY + 24, H); const SC = ramp(L.scarf || '#c76b3a'); for (const x of [11, 34]) { F.box(x, headCY + 25, x + 2, headCY + 26, SC); } }
  };
  const braidCol = (x, y0, y1, R) => { for (let y = y0; y <= y1; y++) { const o = (y >> 1) & 1; F.put(x, y, R[o ? 3 : 2]); F.put(x + 1, y, R[o ? 2 : 1]); F.put(x + 2, y, R[o ? 1 : 2]); } };
  // the shading inside hair: strands, or little curls (round 4x4 bumps, lit top left), and a band of shine
  const CURL = [[2, 3, 3, 2], [3, 2, 2, 1], [2, 2, 1, 2], [1, 2, 2, 2]];
  const hairTex = (x, y, curly) => {
    if (curly) { const v = y & 3, u = (x + ((y >> 2) & 1) * 2) & 3; return CURL[v][u]; }
    const wv = Math.round(Math.sin(y * 0.45 + (x > 23 ? 1.6 : 0)) * 1.2), u = x - wv + 60, p = u % 4, li = (u / 4) | 0;
    return p === 0 ? 1 : p === 2 && (y + li * 3) % 8 < 3 ? 3 : 2;
  };
  // strands flow out from the crown above (cx, cy): a few clean 1-px lines between the locks, and one arc of
  // shine across the sunny side
  const hairShade = (curly, cx, cy) => {
    const crownY = Math.round(cy - 9), R0 = 10.5, cxi = Math.round(cx);
    F.retone(H, 0, 63, (x, y, t) => {
      if (t > 3 || t < 1) return t;
      if (curly) { const tx = hairTex(x, y, true); return tx === 1 ? Math.min(t, 1) : tx === 3 && t >= 2 ? 3 : t; }
      const ix = x - cxi + 64, iy = y - crownY + 64; if (ix < 0 || iy < 0 || ix > 127 || iy > 127) return t;
      const k = iy * 128 + ix, r = PX_HAIR.r[k];
      if (r < 3.5) return t;
      const d = PX_HAIR.d[k], dx = x - cxi, dy = y - crownY;
      if (Math.abs(r - R0) < 1.1 && dx < 3 && dy < R0 + 3) return d < 0.6 ? t : dx < -5 && Math.abs(r - R0) < 0.6 ? 4 : 3;
      if (d < 0.55 && t >= 2) return t - 1;
      return t;
    });
  };
  const hair = () => {
    F.as('hair');
    const st = BASE[L.hairStyle] || L.hairStyle;
    const curly = st === 'curly';
    if (st === 'bald') {   // a ring of hair round the back, higher under a gnome's hat (from behind, no face-like patch of skin)
      if (row !== 0) F.ell(24, headCY - 1, 12.8, 11, H, { clip: (x, y) => y > headCY + (row === 1 ? (g ? -3 : 0) : -4) && (row === 1 || x > 23), bias: HB });
      return;
    }
    if (row === 1) {   // from behind: hair covers the head
      const ry = st === 'crop' || curly ? 11.2 : 12.8;
      F.ell(24, headCY - (st === 'crop' ? 2 : 0), curly ? 15.2 : 13.8, curly ? 13.6 : ry + 1.2, H, { bias: HB });
      if (st === 'long') { F.box(12, headCY + 4, 35, headCY + 20, H, { soft: true }); for (let x = 12; x <= 35; x += 3) F.clear(x, headCY + 20); }
      if (st === 'bob') F.box(12, headCY + 2, 35, headCY + 8, H, { soft: true });
      if (st === 'braids') { braidCol(14, headCY + 8, headCY + 24, H); braidCol(31, headCY + 8, headCY + 24, H); const SC = ramp(L.scarf || '#c76b3a'); F.box(14, headCY + 25, 16, headCY + 26, SC); F.box(31, headCY + 25, 33, headCY + 26, SC); }
      if (st === 'ponytail') { F.cap(23.5, headCY + 4, 23.5 + sw1, headCY + 20, 2.4, H, { r1: 1.4 }); F.box(22, headCY + 5, 25, headCY + 6, ramp(L.scarf || '#9a4430')); }
      if (st === 'bun') F.ell(24, top + 1.2, 5.2, 4.4, H, { bias: HB });
      hairShade(curly, 24, headCY - 2);
      return;
    }
    if (row === 0) {
      F.ell(24, headCY - 3.2, curly ? 15.2 : 13.8, curly ? 11.2 : 10.4, H, { clip: (x, y) => y <= headCY - 4 + (x < 15 || x > 32 ? 8 : 0), bias: HB });
      const fr = L.fringe || 'swept';
      if (curly) { for (const x of [11, 14, 17, 20, 25, 28, 31, 34]) { F.ell(x + 1, headCY - 3.5, 1.8, 1.6, H, { bias: HB }); } F.put(13, headCY - 1, H[1]); F.put(34, headCY - 1, H[1]); }
      else if (fr === 'swept') {
        for (let x = 12; x <= 28; x++) { const d = Math.round((28 - x) * 0.42); for (let k = 0; k <= d; k++) F.put(x, headCY - 4 + k, H[k === d ? 1 : (x % 4 === 1 ? 3 : 2)]); }
        F.put(32, headCY - 4, H[1]); F.put(33, headCY - 3, H[1]); F.put(34, headCY - 2, H[1]);
      } else if (fr === 'parted') {
        for (let x = 11; x <= 36; x++) { if (x === 23 || x === 24) continue; const d = x < 23 ? Math.round((23 - x) * 0.34) : Math.round((x - 24) * 0.34); for (let k = 0; k <= d; k++) F.put(x, headCY - 4 + k, H[k === d ? 1 : x < 23 ? 2 : 1 + (k === 0 ? 1 : 0)]); }
        F.put(23, headCY - 5, H[0]); F.put(24, headCY - 5, H[0]);
      } else {
        for (let x = 12; x <= 35; x++) { F.put(x, headCY - 4, H[2]); F.put(x, headCY - 3, H[x % 4 === 0 ? 1 : 2]); if (x % 3) F.put(x, headCY - 2, H[1]); }
      }
      if (st === 'bob' || st === 'long') { F.box(10, headCY - 4, 13, headCY + 8, H, { soft: true }); F.box(34, headCY - 4, 37, headCY + 8, H, { soft: true }); }
      if (st === 'ponytail' || st === 'braids' || st === 'bun') { F.put(12, headCY - 2, H[1]); F.put(35, headCY - 2, H[1]); F.put(12, headCY - 1, H[1]); F.put(35, headCY - 1, H[1]); }
      if (st === 'bun') F.ell(24, top + 0.4, 5.2, 4.4, H, { bias: HB });
      if (curly) { for (const y of [0, 2]) { F.put(10, headCY + y, H[1]); F.put(37, headCY + y, H[1]); F.put(11, headCY + y + 1, H[0]); F.put(36, headCY + y + 1, H[0]); } }
      hairShade(curly, 20, headCY - 4);
      return;
    }
    // side view (facing left): hair over the back and top
    F.ell(25.2, headCY - 2.4, curly ? 14.8 : 13.4, curly ? 12.4 : 11.2, H, { clip: (x, y) => y <= headCY - 4 || x >= 24 + (y > headCY + 4 ? -2 : 0), bias: HB });
    for (let x = 13; x <= 19; x++) F.put(x, headCY - 4, H[x % 3 ? 2 : 1]);
    for (const x of [14, 15, 17]) F.put(x, headCY - 3, H[1]);
    if (st === 'long') { F.box(24, headCY + 2, 36, headCY + 20, H, { soft: true }); F.clear(36, headCY + 20); }
    if (st === 'bob') F.box(26, headCY + 2, 36, headCY + 8, H, { soft: true });
    if (st === 'braids') braidCol(30, headCY + 6, headCY + 24, H);
    if (st === 'ponytail') { F.cap(37, headCY - 2, 38 + sw1, headCY + 12, 2.2, H, { r1: 1.3 }); F.box(35, headCY - 3, 37, headCY - 1, ramp(L.scarf || '#9a4430')); }
    if (st === 'bun') F.ell(32, top + 2.4, 4.8, 4.4, H, { bias: HB });
    hairShade(curly, 22, headCY - 4);
  };

  // ----- the cast's hair: long wavy or curly masses, messy shags, an updo, a braid, veils, a headband
  // a big mass of long hair (front view: behind the shoulders; back view: over the back); the ends sway as they walk
  const hairMass = (y0, y1, hwMax, curly) => {
    const n = Math.max(1, y1 - y0);
    for (let y = y0; y <= y1; y++) {
      const k = (y - y0) / n;
      let hw = 13.2 + (hwMax - 13.2) * Math.min(1, k * 2.4);
      if (k > 0.72) hw -= (k - 0.72) * (curly ? 22 : 17);
      const wob = curly ? ((y >> 1) & 1) * 2 - 1 : Math.round(Math.sin(y * 0.6) * 1.2), s = k > 0.4 ? Math.round(sw1 * (k - 0.4) * 3.5) : 0;
      const x0 = Math.round(23.5 - hw) - wob + s, x1 = Math.round(23.5 + hw) + wob + s;
      for (let x = x0; x <= x1; x++) {
        if (y >= y1 - 1 && (x + y) % 3) continue;
        if (y === y1 - 2 && (x + y) % 5 === 1) continue;
        F.put(x, y, H[Math.min(hairTex(x, y, curly), x <= x0 + 1 || x >= x1 - 1 || k > 0.86 ? 1 : 3)]);
      }
    }
  };
  // the same seen from the side: it falls down the back and streams out behind as they walk
  const hairMassSide = (y0, y1, curly) => {
    const n = Math.max(1, y1 - y0), back = step === 0 ? 3 : step === 2 ? 2 : step >= 0 ? 1 : 0;
    for (let y = y0; y <= y1; y++) {
      const k = (y - y0) / n, wob = curly ? ((y >> 1) & 1) : Math.round(Math.sin(y * 0.6));
      const x0 = 24 + Math.round(k * 5) + Math.round(back * k), x1 = Math.round(35.6 + (k < 0.6 ? k * 2.4 : 1.4 - (k - 0.6) * 10)) + wob + Math.round(back * k * 1.5);
      for (let x = x0; x <= x1; x++) {
        if (y >= y1 - 1 && (x + y) % 3) continue;
        F.put(x, y, H[Math.min(hairTex(x, y, curly), x <= x0 || x >= x1 - 1 || k > 0.86 ? 1 : 3)]);
      }
    }
  };
  const hairBackX = () => {   // front view, behind the body
    const st = L.hairStyle, len = (L.hairLen || 0) * 2;
    F.as('hairBack');
    if (st === 'wavy') hairMass(headCY - 6, headCY + 28 + len, 18.8, false);
    if (st === 'curlyLong') hairMass(headCY - 4, headCY + 16 + len, 16.8, true);
  };
  const hairX = () => {
    const st = L.hairStyle, len = (L.hairLen || 0) * 2;
    F.as('hair');
    if (st === 'wavy') {
      if (row === 0) for (let y = headCY - 4; y <= headCY + 14 + len; y++) { const w = Math.round(Math.sin(y * 0.55) * 1.2); for (let x = 8 + w; x <= 12 + w; x++) F.put(x, y, H[x === 8 + w ? 2 : x === 12 + w ? 1 : hairTex(x, y, false)]); for (let x = 35 - w; x <= 39 - w; x++) F.put(x, y, H[x === 35 - w ? 2 : x === 39 - w ? 1 : Math.min(2, hairTex(x, y, false))]); }
      else if (row === 1) hairMass(headCY - 4, headCY + 26 + len, 14.4, false);
      else hairMassSide(headCY - 4, headCY + 24 + len, false);
    }
    if (st === 'curlyLong') {
      if (row === 0) for (let y = headCY - 6; y <= headCY + 12 + len; y++) {
        const c = ((y / 2) | 0) % 3, w = [0, 1, 2][c];
        for (let x = 7 - w; x <= 12; x++) F.put(x, y, H[x === 12 ? 1 : x === 7 - w ? (c === 1 ? 3 : 2) : hairTex(x, y, true)]);
        for (let x = 35; x <= 40 + w; x++) F.put(x, y, H[x === 35 ? 2 : x === 40 + w ? 1 : hairTex(x, y, true)]);
      }
      else if (row === 1) hairMass(headCY - 6, headCY + 16 + len, 16.8, true);
      else hairMassSide(headCY - 6, headCY + 14 + len, true);
    }
    if (st === 'shag') {   // messy and full: tufts break the outline, the fringe is ragged; hairLen makes it chin length
      if (row === 0) {
        F.ell(24, headCY - 4.8, 15, 10.8, H, { clip: (x, y) => y <= headCY - 6, bias: -0.35 });
        for (const [x, y] of [[16, -16], [17, -17], [28, -16], [29, -15], [10, -11], [37, -11]]) F.put(x, headCY + y, H[2]);
        (L.fringe === 'short' ? [2, 3, 2, 1, 3, 2, 2, 3, 2, 1, 3, 2, 2, 3, 1, 2, 3, 2, 2, 3, 2, 1, 2, 2] : [3, 4, 2, 3, 5, 3, 2, 4, 3, 2, 4, 3, 2, 4, 2, 3, 4, 3, 2, 3, 3, 2, 3, 3]).forEach((d, i) => { for (let k = 0; k < d; k++) F.put(12 + i, headCY - 4 + k, H[k === d - 1 ? 1 : i < 12 ? (k === 0 ? 3 : 2) : 2]); });
        if (len) for (const [x, d, t] of [[9, 7, 2], [10, 9, 2], [11, 8, 2], [12, 5, 1], [35, 5, 1], [36, 8, 1], [37, 9, 2], [38, 7, 1]]) for (let k = 0; k < d; k++) F.put(x, headCY - 4 + k, H[k === d - 1 ? 1 : t]);
        hairShade(false, 20, headCY - 5);
      } else if (row === 1) {
        F.ell(24, headCY - 3.2, 15.2, 12, H, { bias: -0.35 });
        for (const [x, y] of [[17, -16], [29, -16]]) F.put(x, headCY + y, H[2]);
        [5, 6, 7, 6, 7, 7, 6, 7, 6, 5, 6, 7, 6, 7, 7, 6, 5, 6, 6, 5].forEach((d, i) => { for (let k = 0; k < d + len; k++) F.put(14 + i, headCY + 2 + k, H[(i + k) % 4 ? 2 : 1]); });
        hairShade(false, 20, headCY - 4);
      } else {
        F.ell(26.4, headCY - 3.6, 14, 11.6, H, { clip: (x, y) => y <= headCY - 4 || x >= 24, bias: -0.35 });
        for (const [x, y, t] of [[40, -8, 2], [41, -2, 1], [34, -14, 2], [26, -17, 3], [16, -14, 3], [10, -8, 2]]) F.put(x, headCY + y, H[t]);
        for (const [x, d] of [[26, 7], [28, 8], [30, 7], [32, 7], [34, 6], [36, 4]]) for (let k = 0; k < d + len; k++) F.put(x, headCY + 2 + k, H[(x + k) % 3 ? 2 : 1]);
        if (len) for (let y = headCY - 2; y <= headCY + 7; y++) { F.put(22, y, H[y & 1 ? 2 : 1]); F.put(23, y, H[2]); F.put(24, y, H[1]); }
        for (const [x, d] of [[10, 2], [12, 4], [14, 6], [16, 3], [18, 4]]) for (let k = 0; k < d; k++) F.put(x, headCY - 4 + k, H[k === d - 1 ? 1 : 2]);
        hairShade(false, 22, headCY - 5);
      }
    }
    if (st === 'updo') {   // piled up messily on top, with loose strands at the temples
      const spikes = row === 2 ? [[22, -4, 3], [26, -6, 3], [30, -8, 2], [34, -6, 2], [38, -2, 1], [40, 2, 1]] : [[12, -2, 2], [16, -6, 3], [20, -8, 3], [24, -6, 2], [28, -8, 2], [32, -4, 1], [34, 0, 1]];
      if (row === 0) { F.ell(24, top + 0.6, 11.4, 5.4, H, { bias: -0.3 }); for (let y = headCY - 4; y <= headCY + 8; y++) { const w = y > headCY + 3 ? 1 : 0; F.put(8 + w, y, H[y & 1 ? 2 : 3]); F.put(9 + w, y, H[1]); F.put(38 - w, y, H[2]); F.put(39 - w, y, H[1]); } }
      else if (row === 1) { F.ell(24, top + 1.6, 11.8, 5.8, H, { bias: -0.3 }); F.ell(24, top - 0.8, 6, 3.6, H, { bias: -0.2 });  }
      else { F.ell(29, top + 1.2, 9.6, 5.6, H, { bias: -0.3 }); for (let y = headCY - 2; y <= headCY + 8; y++) { F.put(22, y, H[y & 1 ? 2 : 3]); F.put(23, y, H[1]); } }
      for (const [x, y, t] of spikes) { const d = x < 24 ? 1 : -1; F.cap(x, top + y, x + d * 2, top + y + 3, 0.8, H, { tone: t }); }
      hairShade(false, 21, headCY - 6);
    }
    if (L.veil) {   // striped veils hanging from the hat past the face to the shoulders (they run on into a striped cloak)
      F.as('veil');
      const V = L.veil.map(ramp), n = V.length, bot = T + 4, ph = step >= 0 ? step : 0;
      const strip = (x0, x1, y0, t0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= bot + ((x + ph) % 4 === 0 ? 2 : (x + ph) % 4 === 2 ? 1 : 0); y++) F.put(x, y, V[Math.floor((x + 2) / 2) % n][x === x0 ? t0 : x === x1 ? 1 : (y + x) % 6 === 0 ? 3 : 2]); };
      if (row === 0) { strip(7, 12, headCY - 4, 2); strip(35, 40, headCY - 4, 3); }
      else if (row === 1) strip(9, 38, headCY - 2, 3);
      else strip(23, 35, headCY - 4, 2);
    }
    if (L.headband) {
      F.as('hair');
      const Bd = ramp(L.headband), y = headCY - 9;
      for (let x = 8; x <= 40; x++) for (const yy of [y, y + 1, y + 2]) if (H.includes(F.get(x, yy)) || S.includes(F.get(x, yy))) F.put(x, yy, Bd[yy === y ? 3 : yy === y + 2 ? 1 : x < 18 ? 3 : 2]);
      if (row === 0) { F.ell(32, y + 1.5, 1.6, 1.6, ramp('#9ad8ff'), { shine: true }); }
    }
    if (L.braid) {   // a thick braid: over a shoulder in front, down the back from behind, streaming out behind from the side
      F.as('braid');
      const Br = H, TIE = ramp(L.braidTie || '#e0aa48');
      const braidSeg = (pts) => {   // a braid along points: interlocking lobes, a tie and a tuft
        for (let i = 0; i < pts.length - 1; i++) { const [a, b] = pts[i], [c, d] = pts[i + 1]; F.cap(a, b, c, d, 2, Br); }
        for (let i = 0; i < pts.length - 1; i++) { const [a, b] = pts[i]; F.put(a - 1, b, Br[3]); F.put(a, b + 1, Br[1]); F.put(a + 1, b + 1, Br[1]); }
        const [ex, eyy] = pts[pts.length - 1];
        F.box(Math.round(ex) - 2, Math.round(eyy) + 1, Math.round(ex) + 1, Math.round(eyy) + 2, TIE, { flat: true });
        F.cap(ex, eyy + 3, ex - 0.5, eyy + 6, 1.8, Br, { r1: 1 });
      };
      if (row === 0) { const x = L.braid < 0 ? 9 - bw : 38 + bw, o = sw1 * (L.braid < 0 ? 1 : -1); braidSeg([[x + (L.braid < 0 ? 2 : -2), headCY + 2], [x, headCY + 10], [x + o, headCY + 18], [x + o, headCY + 23]]); }
      else if (row === 1) { const s = sw1; braidSeg([[22, headCY + 4], [20, headCY + 12], [19 + s, headCY + 20], [19 + s, headCY + 25]]); }
      else { const back = step === 0 ? 3 : step === 2 ? 2 : step >= 0 ? 1 : 0; braidSeg([[31, headCY + 3], [33 + back, headCY + 11], [35 + back * 1.6, headCY + 19], [36 + back * 2, headCY + 24]]); }
    }
  };

  // ----- hats
  const hat = () => {
    const t = L.hat; if (!t) return;
    F.as('hat');
    if (t === 'cap') {   // flyer's leather cap with brass goggles and ear flaps
      F.ell(24, headCY - 3.6, 14.2, 10, HAT, { clip: (x, y) => y <= headCY - 2, shine: true });
      if (row !== 1) {
        for (let x = 10; x <= 38; x++) for (const y of [headCY - 7, headCY - 6]) if (F.has(x, y)) F.put(x, y, ramp('#3e2a22')[y === headCY - 7 ? 2 : 1]);
        for (const cx of row === 2 ? [17] : [18, 30]) { F.ell(cx, headCY - 7, 3.4, 3, BRASS, { shine: true }); F.ell(cx, headCY - 7, 1.8, 1.6, ramp('#9ed4dc'), { shine: true }); }
      } else for (let x = 10; x <= 38; x++) if (F.has(x, headCY - 6)) F.put(x, headCY - 6, ramp('#3e2a22')[1]);
      if (row === 0) { F.box(10, headCY - 2, 13, headCY + 7, HAT, { soft: true }); F.box(34, headCY - 2, 37, headCY + 7, HAT, { soft: true }); }
      if (row === 2) F.box(28, headCY - 2, 32, headCY + 7, HAT, { soft: true });
    }
    if (t === 'goggles') {
      if (row === 1) { for (let x = 10; x <= 38; x++) if (F.has(x, headCY - 6)) { F.put(x, headCY - 6, ramp('#3e2a22')[1]); F.put(x, headCY - 7, ramp('#3e2a22')[2]); } }
      else { for (let x = 10; x <= 38; x++) if (F.has(x, headCY - 7)) F.put(x, headCY - 7, ramp('#3e2a22')[1]); for (const cx of row === 2 ? [17] : [18, 30]) { F.ell(cx, headCY - 7, 3.4, 3, BRASS, { shine: true }); F.ell(cx, headCY - 7, 1.8, 1.6, ramp('#9ed4dc'), { shine: true }); } }
    }
    if (t === 'brim') {
      F.ell(24, top + 4.8, 10.4, 6.8, HAT, { clip: (x, y) => y <= top + 6.4, shine: true });
      F.ell(24, top + 7, row === 2 ? 17 : 18.4, 2.6, HAT);
      F.box(14, top + 4, 33, top + 5, ramp(L.scarf || '#b5832a'), { flat: true });
      for (let x = 8; x <= 40; x += 3) if (F.has(x, top + 7)) F.put(x, top + 7, HAT[3]);
    }
    if (t === 'flatcap') {
      F.ell(24, headCY - 5.2, 13.8, 8.4, HAT, { clip: (x, y) => y <= headCY - 4, shine: true });
      for (let x = 12; x <= 36; x++) if (F.has(x, headCY - 8)) F.put(x, headCY - 8, HAT[(x & 1) ? 1 : 2]);
      if (row === 0) { F.box(14, headCY - 4, 33, headCY - 3, HAT, { tone: 1 }); F.box(15, headCY - 4, 32, headCY - 4, HAT, { tone: 2 }); }
      if (row === 2) { F.box(6, headCY - 4, 16, headCY - 3, HAT, { tone: 1 }); F.box(6, headCY - 4, 16, headCY - 4, HAT, { tone: 2 }); }
    }
    if (t === 'bandana') {
      for (let x = 9; x <= 38; x++) for (const y of [headCY - 8, headCY - 7, headCY - 6]) if (F.has(x, y)) F.put(x, y, HAT[y === headCY - 8 ? 3 : 2]);
      F.ell(24, headCY - 6.8, 13.2, 6.4, HAT, { clip: (x, y) => y <= headCY - 6, shine: true });
      for (let x = 12; x <= 36; x += 4) if (F.has(x, headCY - 9)) F.put(x, headCY - 9, HAT[4]);
      if (row !== 0) { const kx = row === 2 ? 36 : 26; F.cap(kx, headCY - 5, kx + (row === 2 ? 2 : -1), headCY - 1, 1.2, HAT); F.cap(kx, headCY - 5, kx + (row === 2 ? 4 : 2), headCY - 2, 1.1, HAT); }
    }
    if (t === 'gnome') {   // a tall pointed hat that leans back
      const n = g ? 21 : 13;   // on a gnome's lower head it can stand tall; on anyone else it must fit in the frame
      for (let i = 0; i <= n; i++) {
        const y = headCY - 6 - i, w = Math.max(0, 13 - i * 13 / n), cx = 24 + (row === 2 ? i * 0.35 : i * 0.18) * (row === 1 ? -1 : 1);
        for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) F.put(x, y, HAT[x < cx - w * 0.4 ? 3 : x > cx + w * 0.5 ? 1 : 2]);
      }
      F.box(10, headCY - 6, 37, headCY - 4, HAT, { tone: 1 }); F.box(10, headCY - 6, 37, headCY - 6, HAT, { tone: 2 });
      if (row === 0 && !L.hatGoggles) { F.ell(22, headCY - 12, 1.4, 1.4, BRASS, { shine: true }); }
    }
    if (t === 'hood') {
      F.ell(24, headCY - 1.2, 15.2, 14, HAT, { clip: (x, y) => row === 1 ? true : row === 0 ? !(x >= 13 && x <= 34 && y >= headCY - 4) : !(x <= 23 && y >= headCY - 4), shine: true });
      if (row === 0) { for (let y = headCY - 4; y <= headCY + 10; y++) { F.put(12, y, HAT[1]); F.put(35, y, HAT[0]); } }
    }
  };

  // ----- the cast's hats
  const feather = (sx, sy, cx2, cy2, ex, ey2, w, R, quill) => {   // a curved feather: a tapering vane round a quill
    const pt = t => [(1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx2 + t * t * ex, (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy2 + t * t * ey2];
    const rad = t => 0.6 + w * Math.sin(Math.PI * Math.min(0.92, t * 1.1));
    for (let i = 0; i < 8; i++) { const [a1, b1] = pt(i / 8), [a2, b2] = pt((i + 1) / 8); F.cap(a1, b1, a2, b2, rad(i / 8), R, { r1: rad((i + 1) / 8) }); }
    for (let i = 0; i <= 14; i++) { const [a1, b1] = pt(i / 16); F.put(a1, b1, quill); }
    for (let i = 3; i < 14; i += 3) { const [a1, b1] = pt(i / 16), [a2, b2] = pt((i + 1) / 16); F.put(a1 + (b2 - b1) * 1.6, b1 - (a2 - a1) * 1.6, R[1]); }
  };
  const hatX = () => {
    const t = L.hat;
    F.as('hat');
    if (t === 'gnome') {   // a wizard's hat: a band, stars, a star on the tip, goggles
      if (L.hatBand) { const HBd = ramp(L.hatBand); F.box(10, headCY - 7, 37, headCY - 4, HBd); F.box(10, headCY - 7, 37, headCY - 7, HBd, { tone: 3 }); }
      if (L.hatStars) {
        const STr = ramp(L.hatStars);
        for (const [x, y] of row === 2 ? [[22, -10], [28, -16], [26, -22], [18, -12], [30, -11]] : [[18, -10], [26, -12], [22, -18], [30, -8], [24, -24], [16, -14]]) {
          const v = F.get(x, headCY + y); if (v && HAT.includes(v)) { F.put(x, headCY + y, STr[4]); F.put(x + 1, headCY + y, STr[2]); F.put(x, headCY + y + 1, STr[2]); }
        }
      }
      if (L.hatTip === 'star') {
        const n = g ? 21 : 13, cx = Math.round(24 + (row === 2 ? n * 0.35 : n * 0.18 * (row === 1 ? -1 : 1))) + (row === 2 ? 2 : row === 1 ? -2 : 2), cy = Math.max(3, headCY - 6 - n);
        F.stamp(cx - 3, cy - 3, ['...4...', '...3...', '3343433', '.32323.', '..3.3..', '.3...3.'], GOLD);
      }
      if (L.hatGoggles && row !== 1) {
        const gx = row === 2 ? 16 : 30;
        F.ell(gx, headCY - 5.5, 3.8, 3.4, BRASS, { shine: true }); F.ell(gx, headCY - 5.5, 2.2, 2, ramp('#9ed4dc'), { shine: true });
        if (row === 0) { F.ell(17, headCY - 5.5, 3, 2.8, BRASS, { shine: true }); F.ell(17, headCY - 5.5, 1.2, 1.2, BRASS, { bias: -0.6 }); }
      }
    }
    if (t === 'witch') {   // a wide brim, a band, a point that flops over; ram's horns or little horns on the band
      const dir = (L.hatTip || -1) * (row === 1 ? -1 : 1), by = headCY - 2, BAND = ramp(L.hatBand || L.hatCol), HN = ramp(L.hornCol || '#efdcc0');
      const HP = { 4: HN[4], 3: HN[3], 2: HN[2], 1: HN[1], b: BAND[0] };
      const mx = x => dir < 0 ? x : 47 - x;
      F.ell(24, by - 1, row === 2 ? (L.brimW || 9.6) * 2 - 1.2 : (L.brimW || 9.6) * 2, 3.2, HAT, { shine: true });
      for (let x = 6; x <= 42; x += 4) if (F.has(x, by)) F.put(x, by, HAT[1]);
      // the crown, from the band up; the top bends over and its point droops
      const CROWN = row === 2
        ? [[16, 31], [17, 31], [17, 31], [18, 31], [18, 31], [19, 31], [21, 32], [23, 33], [26, 35], [29, 37]]
        : [[16, 31], [16, 30], [16, 29], [16, 28], [15, 27], [14, 26], [12, 24], [10, 22], [8, 18], [6, 16]];
      CROWN.forEach(([a, b], i) => {
        const y = by - 6 - i, x0 = row === 2 ? a : Math.min(mx(a), mx(b)), x1 = row === 2 ? b : Math.max(mx(a), mx(b)), d = row === 2 ? 1 : dir;
        for (let x = x0; x <= x1; x++) F.put(x, y, HAT[x === x0 ? 3 : x >= x1 - 1 ? 1 : i >= 6 && i <= 7 && (d < 0 ? x > x0 + 6 : x < x1 - 6) ? 1 : i >= 8 ? 3 : (x - x0) % 6 === 2 ? 3 : 2]);
      });
      const tip = row === 2 ? [[38, by - 15], [40, by - 14], [41, by - 12], [42, by - 10]] : [[mx(5), by - 15], [mx(4), by - 14], [mx(3), by - 12], [mx(3), by - 10]];
      tip.forEach(([x, y], i) => { F.put(x, y, HAT[i < 2 ? 2 : 1]); F.put(x, y + 1, HAT[1]); });
      F.box(14, by - 5, 33, by - 2, BAND); F.box(14, by - 5, 33, by - 5, BAND, { tone: 3 });
      if (row === 0 && L.hatBadge === 'moon') { F.stamp(21, by - 8, ['.44.', '43..', '3...', '32..', '.221'], GOLD); F.put(23, by - 3, GOLD[3]); F.put(24, by - 2, GOLD[1]); }
      if (row === 0 && L.hatBadge === 'buckle') { F.box(20, by - 6, 27, by - 1, GOLD, { flat: true }); F.box(22, by - 4, 25, by - 3, BAND, { tone: 0 }); F.put(20, by - 6, GOLD[4]); F.box(24, by - 4, 25, by - 3, GOLD, { tone: 3 }); }
      if (row === 2 && L.hatBadge) { F.box(15, by - 5, 17, by - 2, GOLD, { flat: true }); F.put(15, by - 5, GOLD[4]); }
      const RAM = ['..443.', '.43..3', '43.bb2', '3.b..2', '32..21', '.2221.'];
      if (L.horns === 'ram') { if (row === 2) F.stamp(19, by - 9, RAM, HP); else for (const f of [false, true]) F.stamp(f ? 33 : 9, by - 9, RAM, HP, f); }
      if (L.horns === 'small') { const SM = ['.4', '43', '32', '21']; if (row === 2) F.stamp(22, by - 12, SM, HP); else for (const f of [false, true]) F.stamp(f ? 32 : 14, by - 11, SM, HP, f); }
    }
    if (t === 'jester') {   // a close cap with two drooping points, each with a pompom
      const PM = ramp(L.pomCol || L.hatCol), b = step === 0 ? 1 : 0, b2 = step === 2 ? 1 : 0;
      F.ell(24, headCY - 3.6, 14.2, 10.4, HAT, { clip: (x, y) => y <= headCY - 4 || (row !== 0 && (row === 1 || x >= 24)) && y <= headCY + 4, bias: -0.35 });
      for (let y = headCY - 13; y <= headCY - 5; y++) if (HAT.includes(F.get(23, y))) F.put(23, y, HAT[1]);
      const horn = (s, x0) => {   // up from the cap, out to the side and down: a thick tapering curve
        const pts = [[x0, headCY - 12], [x0 + s * 5, headCY - 18], [x0 + s * 11, headCY - 18], [x0 + s * 15, headCY - 13], [x0 + s * 16, headCY - 8]];
        for (let i = 0; i < pts.length - 1; i++) F.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3.2 - i * 0.6, HAT, { r1: 3.2 - (i + 1) * 0.6, bias: -0.15 });
      };
      const pom = (cx, cy) => { F.ell(cx, cy, 3.4, 3.4, PM, { shine: true }); F.put(Math.floor(cx) - 1, Math.floor(cy) - 2, PM[4]); for (const [dx, dy] of [[-3, 0], [3, 1], [0, 3], [1, -3]]) F.put(Math.floor(cx) + dx, Math.floor(cy) + dy, PM[1]); };
      if (row !== 2) { horn(-1, 18); horn(1, 29); pom(6, headCY - 5 + b); pom(42, headCY - 5 + b2); }
      else { horn(-1, 21); horn(1, 27); pom(9, headCY - 5 + b); pom(39, headCY - 5 + b2); }
    }
    if (t === 'helm') {    // a pointed helm with cheek guards and a plume of feathers
      const TR = ramp(L.helmTrim || '#c09040'), PL = (L.plume || ['#2a6a72', '#e8ecef']).map(ramp);
      // the plume, behind the helm's point: feathers fanning out to one side (behind, seen from the side)
      F.as('plume');
      const side = row === 2, fl = x => row === 1 ? 47 - x : x, wv = step === 0 ? 1 : step === 2 ? -1 : 0;
      const fan = side
        ? [[28, -12, 38, -15, 44, -4, 1.9], [28, -13, 40, -19, 45, -9, 2.1], [27, -14, 38, -21, 43, -14, 2.1], [26, -15, 34, -21, 39, -18, 1.9], [25, -15, 29, -20, 33, -19, 1.7]]
        : [[20, -12, 10, -15, 4, -4, 1.9], [20, -13, 8, -19, 3, -9, 2.1], [21, -14, 10, -21, 5, -14, 2.1], [21, -15, 14, -21, 9, -18, 1.9], [22, -15, 19, -20, 15, -19, 1.7]];
      fan.forEach(([x0, y0, x2, y2, x1, y1, w], i) => { const R = PL[i % PL.length]; feather(fl(x0), headCY + y0, fl(x2), headCY + y2, fl(x1), headCY + y1 + (i < 2 ? wv : 0), w, R, R[i % PL.length === 1 ? 2 : 4]); });
      F.as('hat');
      F.ell(24, headCY - 2.4, 14, 11.6, HAT, { clip: (x, y) => y <= headCY + 6 && (row === 1 || y <= headCY - 4 || (row === 0 ? x <= 13 || x >= 34 : x >= 23)), shine: true });
      for (let i = 0; i < 6; i++) { const y = headCY - 12 - i, w = [6, 5, 4, 3, 2, 1][i]; for (let x = 24 - w; x <= 23 + w; x++) F.put(x, y, HAT[x < 24 ? 3 : 1]); }
      if (row === 0) {   // gold trim: the brow, a pointed arch up the front, a blue stone
        F.box(13, headCY - 4, 34, headCY - 3, TR, { flat: true }); F.box(13, headCY - 4, 34, headCY - 4, TR, { tone: 3 });
        F.line(23, headCY - 17, 16, headCY - 5, TR[3]); F.line(24, headCY - 17, 31, headCY - 5, TR[2]);
        F.line(22, headCY - 15, 18, headCY - 6, TR[1]); F.line(25, headCY - 15, 29, headCY - 6, TR[1]);
        F.ell(24, headCY - 8, 1.8, 2, ramp('#58a8e8'), { shine: true });
        F.put(12, headCY + 6, TR[2]); F.put(35, headCY + 6, TR[2]);
      }
      if (row === 1) for (let y = headCY - 17; y <= headCY + 4; y++) F.put(24, y, TR[2]);
      if (row === 2) { F.box(11, headCY - 4, 23, headCY - 3, TR, { flat: true }); F.line(22, headCY - 17, 13, headCY - 5, TR[3]); F.put(23, headCY + 6, TR[2]); }
    }
    if (t === 'captain') {   // a peaked cap: puffed crown, band with a badge, a shiny visor, a feather in the band
      const V = ramp('#22202c'), FE = ramp(L.feather || '#f2f0ea');
      if (row !== 2) {
        const s = row === 1 ? -1 : 1, fx = x => s > 0 ? x : 47 - x;
        F.as('plume'); feather(fx(33), headCY - 4, fx(40), headCY - 10, fx(42), headCY - 18, 1.8, FE, FE[2]);
        F.as('hat');
        F.ell(24, headCY - 7.2, 15.4, 7.6, HAT, { shine: true });
        F.box(12, headCY - 4, 35, headCY - 3, HAT, { tone: 1 });
        for (let x = 12; x <= 35; x++) F.put(x, headCY - 5, (x % 3) ? GOLD[1] : HAT[1]);
        if (row === 0) { F.box(14, headCY - 2, 33, headCY - 1, V); F.box(16, headCY - 2, 21, headCY - 2, V, { tone: 4 }); F.ell(24, headCY - 7, 2.2, 2, GOLD, { shine: true }); F.put(23, headCY - 4, GOLD[2]); F.put(24, headCY - 4, GOLD[2]); }
      } else {
        F.as('plume'); feather(28, headCY - 4, 35, headCY - 10, 37, headCY - 18, 1.8, FE, FE[2]);
        F.as('hat');
        F.ell(25.6, headCY - 7.2, 14.4, 7.6, HAT, { shine: true });
        F.box(14, headCY - 4, 37, headCY - 3, HAT, { tone: 1 });
        for (let x = 14; x <= 37; x++) F.put(x, headCY - 5, (x % 3) ? GOLD[1] : HAT[1]);
        F.box(5, headCY - 2, 16, headCY - 1, V); F.box(6, headCY - 2, 10, headCY - 2, V, { tone: 4 }); F.ell(15, headCY - 7, 2, 2, GOLD, { shine: true });
      }
    }
  };
  // ----- ears that show: a fox's, an elf's or a gnome's
  const ears = () => {
    F.as('ears');
    if (L.ears === 'fox') {
      const IN = ramp(L.earInner || '#f2d4b8'), E = L.earCol ? ramp(L.earCol) : H, P2 = { 4: E[4], 3: E[3], 2: E[2], 1: E[1], 0: E[0], i: IN[3], j: IN[2], k: IN[1] };
      const EAR = ['3.......', '33......', '332.....', '3i22....', '3ii21...', '3ij221..', '3ijk221.', '2ijkk221', '2ijkk221'];
      const EARB = ['3.......', '33......', '332.....', '3322....', '33221...', '332221..', '3322221.', '23222221', '23222221'];
      if (row === 0) for (const f of [false, true]) F.stamp(f ? 31 : 9, headCY - 20, EAR, P2, f);
      if (row === 1) for (const f of [false, true]) F.stamp(f ? 31 : 9, headCY - 20, EARB, P2, f);
      if (row === 2) { F.stamp(18, headCY - 18, ['1..', '11.', '111'], P2); F.stamp(26, headCY - 20, EAR, P2, true); }
    }
    if (L.ears === 'elf') {
      if (row !== 2) {
        for (const s of [-1, 1]) {
          const x = s < 0 ? 10 : 37;
          F.cap(x, ey + 2, x + s * 6, ey - 4, 1.8, S, { r1: 0.6 });
          if (row === 0) { F.put(x + s, ey + 1, S[0]); F.put(x + s * 2, ey, S[1]); F.put(x + s * 3, ey - 1, S[1]); }
        }
      } else { F.cap(27, ey + 3, 33, ey - 4, 1.8, S, { r1: 0.6 }); F.put(28, ey + 1, S[0]); F.put(29, ey, S[1]); }
    }
  };

  // ----- capes and cloaks
  const capeHem = () => T + CP.len * 2;
  const tatBottom = (x, hem) => CP.hem === 'tattered' ? hem - 2 + [0, 1, 2, 3, 2, 1][(x + Math.max(0, step) * 2) % 6] : hem;
  const capeCol = (x, x0) => CRS ? CRS[Math.floor((x - x0) / 3) % CRS.length] : CR;
  const sparkle = (x, y) => CP.sparkle && (x * 7 + y * 5) % 23 === 0;
  // facing the viewer the cape shows behind the arms and legs; its inside is the lining
  const capeFront = () => {
    F.as('cape');
    const hem = capeHem(), fl = (CP.flare ?? 2) * 2, SP = CP.sparkle ? ramp(CP.sparkle) : null;
    for (let y = T + 1; y <= hem + 3; y++) {
      const lo = Math.max(0, (y - T - 3) / Math.max(1, hem - T - 3));
      const x0 = Math.round(8 - bw - fl * lo) - (step === 0 ? Math.round(lo * 2) : 0), x1 = Math.round(39 + bw + fl * lo) + (step === 2 ? Math.round(lo * 2) : 0);
      for (let x = x0; x <= x1; x++) {
        const bottom = tatBottom(x, hem); if (y > bottom) continue;
        const edge = x <= x0 + 2 || x >= x1 - 2;
        let R = edge ? capeCol(x, x0) : CLN, t = edge ? (x === x0 ? 3 : x === x1 ? 1 : 2) : ((x >> 1) & 1 ? 1 : 0);
        if (y >= bottom - 1) t = Math.min(t, 1);
        if (CT && (x === x0 || x === x1 || (y >= bottom - 1 && edge))) { R = CT; t = x === x1 ? 1 : 2; }
        F.put(x, y, SP && edge && sparkle(x, y) ? SP[4] : R[t]);
      }
    }
  };
  // seen from behind it hangs over the back (and, worn as a cloak, over the shoulders and arms)
  const capeBack = () => {
    F.as('cape');
    const hem = capeHem(), fl = (CP.flare ?? 2) * 2, SP = CP.sparkle ? ramp(CP.sparkle) : null;
    for (let y = T; y <= hem + 3; y++) {
      const lo = Math.max(0, (y - B + 2) / Math.max(1, hem - B + 2)), s = Math.round(sw1 * lo * 2);
      let x0 = (y === T ? 17 : y === T + 1 ? 15 : 14) - bw, x1 = (y === T ? 30 : y === T + 1 ? 32 : 33) + bw;
      x0 = Math.round(x0 - fl * lo) + s; x1 = Math.round(x1 + fl * lo) + s;
      for (let x = x0; x <= x1; x++) {
        const bottom = tatBottom(x, hem); if (y > bottom) continue;
        let R = capeCol(x, x0), t = x === x0 ? 3 : x >= x1 - 1 ? 1 : ((x - x0) % 5 === 3 && y > T + 3) ? 1 : ((x - x0) % 5 === 1 && y > T + 3) ? 3 : 2;
        if (y >= bottom - 1) t = Math.min(t, 1);
        if (CT && (y >= bottom - 1 || ((x === x0 || x === x1) && y > T + 2))) { R = CT; t = x === x1 ? 1 : 2; }
        F.put(x, y, SP && sparkle(x, y) ? SP[4] : R[t]);
      }
    }
    if (CP.emblem === 'sun') sunAt(23, T + 9, true);
  };
  // from the side it trails behind, and streams out further as they walk
  const capeSide = () => {
    F.as('cape');
    const hem = capeHem(), n = Math.max(1, hem - T), fl = (CP.flare ?? 2) * 2, billow = step === 0 ? 4 : step === 2 ? 2 : step >= 0 ? 1 : 0, SP = CP.sparkle ? ramp(CP.sparkle) : null;
    for (let y = T; y <= hem + 3; y++) {
      const k = (y - T) / n, x0 = 22, x1 = Math.round(28 + bw + (fl + 6) * Math.sqrt(k) + billow * k);
      for (let x = x0; x <= x1; x++) {
        const bottom = tatBottom(x, hem + (x > 31 ? -billow : 0)); if (y > bottom) continue;
        let R = capeCol(x, x0), t = x >= x1 - 1 ? 1 : ((x1 - x) % 5 === 0 && y > T + 2) ? 1 : ((x1 - x) % 5 === 2 && y > T + 2) ? 3 : 2;
        if (y >= bottom - 1) t = Math.min(t, 1);
        if (CT && (x >= x1 - 1 || y >= bottom - 1) && y > T + 3) { R = CT; t = 1; }
        F.put(x, y, SP && sparkle(x, y) ? SP[4] : R[t]);
      }
    }
  };
  // worn open as a cloak or long coat: front panels over the body, open down the middle
  const cloakFront = () => {
    F.as('cloak');
    const hem = capeHem(), fl = (CP.flare ?? 2) * 2, SP = CP.sparkle ? ramp(CP.sparkle) : null, ow = (CP.openW ?? 1) * 2;
    for (let y = T; y <= hem + 3; y++) {
      const lo = Math.max(0, (y - T - 3) / Math.max(1, hem - T - 3));
      const xo0 = y <= T + 1 ? 14 - bw + (y === T ? 2 : 0) : Math.round(8 - bw - fl * lo) - (step === 0 ? Math.round(lo * 2) : 0);
      const xo1 = y <= T + 1 ? 33 + bw - (y === T ? 2 : 0) : Math.round(39 + bw + fl * lo) + (step === 2 ? Math.round(lo * 2) : 0);
      const xi0 = 19 - Math.round(lo * ow), xi1 = 28 + Math.round(lo * ow);
      for (const [a, b, left] of [[xo0, xi0, true], [xi1, xo1, false]]) for (let x = a; x <= b; x++) {
        const bottom = tatBottom(x, hem); if (y > bottom) continue;
        let R = capeCol(x, xo0), t = left ? (x === a ? 3 : (x - a) % 5 === 2 ? 3 : 2) : (x >= b - 1 ? 1 : (b - x) % 5 === 2 ? 2 : 1);
        if (y >= bottom - 1) t = Math.min(t, 1);
        const inner = left ? x >= b - 1 : x <= a + 1;
        if (inner) t = left ? (x === b ? 1 : 2) : (x === a ? 2 : 1);
        if (CT && ((left ? x === b : x === a) || y >= bottom - 1)) { R = CT; t = (left ? x === b : x === a) ? 3 : 1; }
        F.put(x, y, SP && !inner && sparkle(x, y) ? SP[4] : R[t]);
      }
    }
  };
  // the near side of an open cloak, seen from the side: it covers the body, with the dress showing at the front edge
  const cloakSide = () => {
    F.as('cloak');
    const hem = capeHem(), n = Math.max(1, hem - T), SP = CP.sparkle ? ramp(CP.sparkle) : null, fmin = Math.min(sd.n[0], sd.f[0]);
    for (let y = T; y <= hem + 3; y++) {
      const k = (y - T) / n, x0 = Math.round(20 - (20 - fmin + 2) * Math.max(0, k - 0.45) * 1.6), x1 = 29 + bw + Math.round(k * 3);
      for (let x = x0; x <= x1; x++) {
        const bottom = tatBottom(x, hem); if (y > bottom) continue;
        let R = capeCol(x, x0), t = x <= x0 + 1 ? 2 : (x - x0) % 5 === 2 && y > T + 3 ? 0 : (x - x0) % 5 === 4 ? 2 : 1;
        if (y >= bottom - 1) t = 0;
        if (CT && (x <= x0 + 1 || y >= bottom - 1)) { R = CT; t = x === x0 ? 3 : 1; }
        F.put(x, y, SP && sparkle(x, y) ? SP[4] : R[t]);
      }
    }
  };

  // ----- a crow on the shoulder
  const crow = () => {
    if (L.pet !== 'crow') return;
    F.as('crow');
    const P2 = { k: [16, 12, 22], d: [30, 27, 42], b: [46, 44, 62], l: [80, 92, 122], h: [130, 150, 190], y: [112, 106, 100], e: [238, 222, 168], p: [20, 16, 24] };
    const FRONT = ['....bbb.....', '...bblbb....', '..bbbebby...', '..dbbbbbyyy.', '...dbbbby...', '..dbllbbb...', '.dbllhlbbd..', '.dblllbbbdd.', '.ddbllbbddd.', '..ddbbbddd..', '...dd.ddkd..', '....k...k...'];
    const BACK = ['....bbb.....', '...bbbbb....', '.yybbbbbb...', 'yyybbbbbd...', '..dbbbbbbd..', '..dbllbbbd..', '.dbllhlbbd..', '.dblllbbbdd.', '.ddbllbbddd.', '..ddbbbddd..', '..kd...dk...', '..k.....k...'];
    const SIDE = ['...bbb......', '..bbbbb.....', '.ebbbbbb....', 'yyybbbbbd...', '..bbbllbbd..', '..dbllhlbbd.', '..dblllbbbdd', '..ddbllbbddd', '...ddbbbdddd', '....dd.dd.dd', '.....k..k...'];
    if (row === 0) F.stamp(33 + bw, T - 12, FRONT, P2);
    if (row === 1) F.stamp(3 - bw, T - 12, BACK, P2);
    if (row === 2) F.stamp(26, T - 11, SIDE, P2);
  };

  // ----- tools: drawn from the hand (hx, hy) toward ang (screen radians, 0 = right, -pi/2 = up); f is the work beat
  // (-1 when just carried), k shrinks a long tool to carry it
  function drawTool(tool, hx, hy, ang, f, k = 1) {
    F.as('tool');
    const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c;
    const at = (u, v = 0) => [hx + c * u * k + px * v, hy + s * u * k + py * v];
    const cap = (u0, v0, u1, v1, r, R, o) => { const [a, b] = at(u0, v0), [d, e] = at(u1, v1); F.cap(a, b, d, e, r, R, o); };
    const dot = (u, v, col) => { const [a, b] = at(u, v); F.put(a, b, col); };
    const ell = (u, v, rx, ry, R, o) => { const [a, b] = at(u, v); F.ell(a + 0.5, b + 0.5, rx, ry, R, o); };
    const BLD = BL, EDG = ED, GLASS = ramp('#4a5a66'), SILVER = ramp('#c8ccd4'), RIME = ramp('#8fd6e8'), CLAY = ramp('#a86a44'), ARC = [170, 220, 255];
    const sparks = (u, v, col = [255, 236, 170]) => { const [a, b] = at(u, v); for (const [dx, dy] of [[-2, -2], [2, -3], [3, 0], [-3, 1], [0, -4], [1, 2]]) F.put(a + dx, b + dy, (dx + dy) & 1 ? col : [255, 255, 240]); };
    const flash = (u, v) => { const [a, b] = at(u, v); F.ell(a + 0.5, b + 0.5, 2.4, 2.4, [[255, 180, 80], [255, 200, 110], [255, 230, 160], [255, 248, 210], [255, 255, 240]], { bias: 0.6 }); for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4], [3, 3], [-3, -3]]) F.put(a + dx, b + dy, [255, 220, 140]); };
    switch (tool) {
      case 'pick': case 'pick2': {
        const HD = tool === 'pick2' ? GOLD : IRON;
        cap(-3, 0, 14, 0, 1, OAK); cap(14, -7, 14, 7, 1.2, HD, { shine: true }); dot(13, -8, HD[1]); dot(13, 8, HD[1]); dot(12, -9, HD[1]); dot(12, 9, HD[1]); dot(14, -3, HD[4]);
        if (f === 2) sparks(14, 8); break;
      }
      case 'hammer': case 'plumb': case 'anchor': {
        cap(-2, 0, 11, 0, 1, OAK);
        if (tool === 'plumb') { cap(11, 0, 15, 0, 0.6, GOLD); ell(16, 0, 2.6, 2.6, ramp('#6a6e78'), { shine: true }); }
        else if (tool === 'anchor') { cap(10, -6, 10, 6, 1.1, IRON); cap(10, -6, 7, -8, 1, IRON); cap(10, 6, 7, 8, 1, IRON); dot(12, 0, IRON[4]); }
        else { cap(11, -4, 11, 4, 2.4, IRON, { shine: true }); dot(10, -2, IRON[4]); }
        if (f === 2) sparks(12, 4); break;
      }
      case 'sword': case 'dagger': case 'machete': {
        const len = tool === 'sword' ? 17 : tool === 'machete' ? 13 : 8;
        dot(-3, 0, GOLD[3]); cap(-2.5, 0, -0.5, 0, 0.9, LEATHER);
        if (tool !== 'machete') cap(1, -3.4, 1, 3.4, 0.9, GOLD, { shine: true });
        cap(2, 0, len, 0, tool === 'machete' ? 1.7 : 1.1, BLD, { shine: true, r1: tool === 'machete' ? 1.2 : 0.7 });
        for (let u = 3; u < len - 1; u++) dot(u, 1, EDG[3]);
        dot(len + 0.5, 0, BLD[4]);
        if (f === 2) { const [a, b] = at(len * 0.7, 0); for (let i = 0; i < 6; i++) F.put(a - i, b - 3 + i, [255, 250, 230]); }
        break;
      }
      case 'lance': case 'pole': {
        cap(-9, 0, 15, 0, 1, tool === 'pole' ? COPPER : OAK);
        if (tool === 'pole') { cap(15, 0, 18, -2, 0.8, COPPER); dot(19, -3, [255, 220, 140]); dot(19, -4, [255, 250, 210]); }
        else { ell(18, 0, 2.4, 2.4, AMB, { bias: 0.5, shine: true }); dot(18, -1, [255, 250, 225]); if (f >= 1) for (const [u, v] of [[21, -2], [20, 3], [22, 1]]) dot(u, v, [255, 220, 140]); }
        break;
      }
      case 'halberd': {
        cap(-9, 0, 18, 0, 1, OAK); cap(13, -1, 16, -6, 1.6, IRON, { shine: true }); cap(16, -6, 13, -6, 1, IRON); cap(14, 1, 15, 3, 1, IRON); cap(18, 0, 21, 0, 0.8, IRON, { r1: 0.3 }); dot(17, 0, BRASS[3]);
        break;
      }
      case 'hook': {
        cap(-7, 0, 14, 0, 1, OAK); cap(14, 0, 18, -2, 1, GLASS, { shine: true }); cap(18, -2, 17, -6, 0.9, GLASS); cap(17, -6, 15, -5, 0.6, GLASS);
        break;
      }
      case 'fork': {
        cap(-2, 0, 4, 0, 1, BRASS); cap(4, -2.5, 4, 2.5, 0.9, SILVER); cap(4, -2.5, 13, -2.5, 0.7, SILVER, { shine: true }); cap(4, 2.5, 13, 2.5, 0.7, SILVER);
        if (f === 2) for (const [u, v] of [[15, -4], [16, 0], [15, 4]]) dot(u, v, ARC);
        break;
      }
      case 'spanner': case 'wrench': {
        cap(-1, 0, 9, 0, 1.1, IRON, { shine: true }); cap(9, -2.6, 12, -2.6, 0.9, IRON); cap(9, 2.6, 12, 2.6, 0.9, IRON); ell(-2, 0, 1.6, 1.6, IRON);
        break;
      }
      case 'drill': {
        ell(1, 0, 3.2, 3.2, BRASS, { shine: true }); cap(4, 0, 13, 0, 1.4, IRON, { r1: 0.4 }); for (let u = 5; u < 13; u += 2) dot(u, (u & 2) ? -1 : 1, IRON[4]); dot(-1, -3, [230, 230, 220]);
        if (f === 2) sparks(13, 0); break;
      }
      case 'pistol': case 'rivet': case 'kettle': {
        if (tool === 'kettle') { ell(2, 0, 3.6, 3.6, BRASS, { shine: true }); cap(5, -1, 9, -2, 0.9, BRASS); }
        else if (tool === 'rivet') { ell(2, -1, 3, 2.6, BRASS, { shine: true }); cap(4, -1, 10, -1, 1, IRON); }
        else { cap(1, -1.5, 8, -1.5, 0.9, IRON, { shine: true }); ell(2.5, -1.5, 2, 2, BRASS, { shine: true }); }
        cap(0, 0, -1, 3, 1.2, OAK);
        if (f === 2) flash(tool === 'kettle' ? 10 : tool === 'rivet' ? 11 : 10, -1.5); break;
      }
      case 'rifle': case 'rifle2': case 'carbine': case 'musket': case 'harpoon': {
        const len = tool === 'rifle2' ? 20 : tool === 'harpoon' ? 14 : 17, BAR = tool === 'musket' ? BRASS : IRON;
        cap(-7, 1.4, -1, 0.6, 1.6, OAK); cap(-1, 0, 4, 0, 1.3, OAK); cap(3, -0.6, len, -0.6, 0.8, BAR, { shine: true });
        if (tool === 'musket' || tool === 'carbine') { ell(len + 1, -0.6, 1.6, 1.6, ramp('#bfe8f0'), { shine: true }); }
        if (tool === 'harpoon') { cap(len, -0.6, len + 6, -0.6, 0.7, IRON); dot(len + 5, -2, IRON[3]); dot(len + 5, 1, IRON[3]); dot(len + 4, -3, IRON[1]); dot(len + 4, 2, IRON[1]); }
        if (tool === 'rifle2') dot(6, -2, IRON[3]);
        if (f === 2) flash(len + 3, -0.6); break;
      }
      case 'caster': case 'organ': {
        ell(2, 0, 3, 3, COPPER, { shine: true }); cap(4, -1.5, 10, -4.5, 0.9, COPPER); cap(4, 1.5, 10, 4.5, 0.9, COPPER);
        if (tool === 'organ') for (let v = -3; v <= 3; v += 2) cap(0, v, -4, v, 0.6, BRASS);
        if (f >= 1) { const [a, b] = at(11, 0); F.line(a, b - 4, a + 1, b, ARC); F.line(a + 1, b, a, b + 4, ARC); if (f === 2) flash(13, 0); }
        break;
      }
      case 'mortar': { cap(0, 0, 7, 0, 2.6, IRON, { shine: true }); ell(8, 0, 3, 3.4, IRON); cap(-2, 2, 2, 4, 1, OAK); if (f === 2) flash(11, 0); break; }
      case 'sprayer': { ell(-1, 3.5, 3.4, 3.4, RIME, { shine: true }); cap(1, 0, 10, 0, 0.8, BRASS); if (f >= 1) { const [a, b] = at(12, 0); for (let i = 0; i < 7; i++) F.put(a + c * i + ((i * 7) % 3 - 1), b + s * i + ((i * 5) % 3 - 1), [210, 244, 255]); } break; }
      case 'jug': { if (f !== 2) { ell(2, 0, 3.4, 3.6, CLAY, { shine: true }); dot(2, -4, OAK[2]); dot(2, 0, ARC); } else { const [a, b] = at(14, -4); F.ell(a, b, 3, 3.4, CLAY, { shine: true }); F.put(a, b, ARC); } break; }
      case 'smoker': case 'can': {
        const R = tool === 'can' ? COPPER : BRASS;
        ell(3, 1, 4, 3.2, R, { shine: true }); cap(6, 0, 11, -3, 0.9, R); dot(12, -4, R[3]); dot(12, -3, R[1]);
        if (tool === 'smoker') { for (const [u, v] of [[13, -6], [14, -8], [12, -9]]) dot(u, v, [200, 196, 190]); }
        else if (f >= 1) { const [a, b] = at(12, -3); for (let i = 1; i < 6; i++) F.put(a + (c > 0 ? 1 : -1) * (i & 1), b + i * 1.4, [150, 205, 235]); }
        break;
      }
      case 'crystal': case 'tongs': {
        if (tool === 'tongs') { cap(0, 0, 9, -1, 0.6, COPPER); cap(0, 0, 9, 1, 0.6, COPPER); ell(11, 0, 1.8, 2.6, AMB, { bias: 0.5 }); break; }
        const [a, b] = at(0, 0); F.box(Math.round(a) - 4, Math.round(b) + 1, Math.round(a) + 4, Math.round(b) + 2, OAK, { flat: true });
        F.ell(a + 0.5, b - 3, 2.4, 4, AMB, { bias: 0.4, shine: true }); F.put(a, b - 5, [255, 250, 225]); F.put(a - 2, b - 1, AMB[3]); F.put(a + 3, b - 1, AMB[2]);
        if (f >= 1) for (const [dx, dy] of [[-4, -6], [4, -8], [5, -3]]) F.put(a + dx, b + dy, [255, 236, 170]);
        break;
      }
      case 'book': case 'ledger': {
        const [a, b] = at(0, 0), x = Math.round(a) - 4, y = Math.round(b) - 5, BK = ramp(tool === 'ledger' ? '#3f5a4a' : '#6b3a5e'), PG = ramp('#efe4c8');
        F.box(x - 1, y, x + 9, y + 6, BK, { flat: true }); F.box(x, y, x + 3, y + 5, PG, { flat: true }); F.box(x + 5, y, x + 8, y + 5, PG, { tone: 3 }); F.box(x + 4, y, x + 4, y + 5, PG, { tone: 0 });
        for (let i = 0; i < 3; i++) { F.put(x + 1 + (f === 2 ? 1 : 0), y + 1 + i * 2, [110, 90, 100]); F.put(x + 6, y + 1 + i * 2, [110, 90, 100]); }
        if (f === 1) { F.box(x + 5, y - 2, x + 7, y + 3, PG, { tone: 4 }); }
        if (f === 2) { F.line(x + 7, y - 3, x + 9, y - 6, GOLD[2]); }
        break;
      }
      case 'glass': case 'scope': { cap(0, 0, 9, 0, 1.4, BRASS, { shine: true, r1: 1 }); cap(3, 0, 3, 0, 1.6, BRASS); dot(10, 0, [200, 236, 245]); if (f === 2) dot(11, -1, [255, 255, 255]); break; }
      case 'rope': {
        const [a, b] = at(0, 0), x = Math.round(a);
        for (let y = 0; y < 64; y++) { if (Math.abs(y - b) < 2) continue; F.put(x, y, ramp('#cdb48a')[(y & 1) ? 3 : 1]); F.put(x + 1, y, ramp('#cdb48a')[(y & 1) ? 1 : 2]); }
        break;
      }
      case 'spell': {
        const MG = ramp(L.magic || '#d070ff'), [a, b] = at(3, 0), r = f === 2 ? 3.2 : f === 1 ? 2.4 : 1.6;
        F.ell(a + 0.5, b - 1, r, r, MG, { bias: 0.7, shine: true }); F.put(a, b - 1, [255, 248, 255]);
        for (const [dx, dy] of [[-5, -4], [4, -6], [6, 2], [-4, 4], [0, -8]].slice(0, f + 2)) { F.put(a + dx, b + dy, MG[4]); F.put(a + dx + 1, b + dy, MG[2]); F.put(a + dx, b + dy + 1, MG[2]); }
        break;
      }
      default: { cap(-2, 0, 10, 0, 1, OAK); cap(10, -3, 10, 3, 1.4, IRON); }
    }
  }
  // the working arm and its tool: three beats of a swing, a thrust, an aim, a pour...
  const workPose = (motion, side) => {
    const Tt = T, Bb = B;
    if (side) return ({
      swing: [[27, Tt - 9, -1.85], [16, Tt, -2.65], [13, Bb - 3, 2.45]],
      thrust: [[21, Bb - 4, Math.PI], [12, Bb - 6, Math.PI], [15, Bb - 5, Math.PI]],
      turn: [[15, Tt + 6, -2.2], [14, Tt + 7, 3.0], [15, Tt + 8, 2.3]],
      aim: [[18, Tt + 5, 2.9], [15, Tt + 2, Math.PI], [16, Tt + 2, Math.PI]],
      throw: [[29, Tt - 4, -2.4], [19, Tt - 6, -2.4], [12, Tt + 2, -2.4]],
      pour: [[17, Bb - 4, Math.PI], [15, Bb - 6, 2.6], [15, Bb - 6, 2.35]],
      tray: [[18, Bb - 6, 0], [16, Tt + 2, 0], [17, Tt + 5, 0]],
      read: [[17, Tt + 9, 0], [17, Tt + 9, 0], [17, Tt + 9, 0]],
      look: [[17, Bb - 4, -2.4], [14, ey + 2, Math.PI], [14, ey + 1, 3.05]],
      haul: [[19, Tt - 8, 0], [19, Tt, 0], [19, Bb - 3, 0]],
      spell: [[17, Bb - 3, Math.PI], [13, Tt + 2, -2.6], [11, Tt - 3, -2.3]],
    })[motion];
    return ({
      swing: [[38, Tt - 9, -2.2], [41, Tt + 3, -0.7], [37, Bb - 2, 0.65]],
      thrust: [[35, Bb - 3, -0.15], [40, Bb - 5, -0.08], [38, Bb - 4, -0.12]],
      turn: [[37, Tt + 6, -1.2], [38, Tt + 7, -0.3], [37, Tt + 8, 0.6]],
      aim: [[37, Tt + 5, 0.15], [40, Tt + 3, 0], [39, Tt + 3, 0]],
      throw: [[40, Tt - 5, -0.8], [41, Tt - 7, -0.6], [42, Tt + 2, -0.6]],
      pour: [[37, Bb - 4, 0], [38, Bb - 6, 0.55], [38, Bb - 6, 0.8]],
      tray: [[33, Bb - 6, 0], [36, Tt + 2, 0], [35, Tt + 5, 0]],
      read: [[30, Tt + 9, 0], [30, Tt + 9, 0], [30, Tt + 9, 0]],
      look: [[37, Bb - 4, -0.7], [33, ey + 2, 0], [33, ey + 1, -0.12]],
      haul: [[37, Tt - 8, 0], [37, Tt, 0], [36, Bb - 3, 0]],
      spell: [[36, Bb - 3, 0], [39, Tt + 1, -0.5], [40, Tt - 4, -0.8]],
    })[motion];
  };
  const work = () => {
    if (!working) return;
    const tool = L.tool || 'hammer', motion = PX_MOTION[tool] || 'swing';
    if (row === 2) {
      F.as('armN');
      const [hx, hyy, ang] = workPose(motion, true)[wf], sx = 23.5, sy = T + 2.5, ex = (sx + hx) / 2 + 1.5, eyy = (sy + hyy) / 2 + 2;
      F.cap(sx, sy, ex, eyy, 2, sleeve); F.cap(ex, eyy, hx, hyy, 2, L.sleeves === 'rolled' || L.sleeves === 'short' ? S : sleeve);
      drawTool(tool, hx, hyy, ang, wf);
      F.as('handN'); F.ell(hx + 0.5, hyy + 0.5, 2.2, 2.2, HAND); F.put(Math.round(hx) - 1, Math.round(hyy) + 2, HAND[1]);
      return;
    }
    // front/back: left arm rests, right arm works
    const back = row === 1;
    F.as('armL'); armV(10 - bw, 13, T + 1, B, -1, null);
    F.as('armR');
    const [hx0, hyy, ang0] = workPose(motion, false)[wf], hx = hx0 + hb, ang = ang0;
    const sx = 35.5 + hb, sy = T + 2.5, ex = Math.max(sx, hx) + 2, eyy = (sy + hyy) / 2 + 1;
    F.cap(sx, sy, ex, eyy, 2 + hb * 0.5, sleeve); F.cap(ex, eyy, hx, hyy, 2 + hb * 0.5, L.sleeves === 'rolled' || L.sleeves === 'short' ? S : sleeve);
    if (!back) drawTool(tool, hx, hyy, ang, wf);
    F.as('handR'); F.ell(hx + 0.5, hyy + 0.5, 2.3, 2.3, HAND); F.put(Math.round(hx) + 1, Math.round(hyy) + 2, HAND[1]);
    if (back) drawTool(tool, hx, hyy, ang, wf);
  };

  // ----- compose in painter's order
  if (row === 2) {
    if (CP) capeSide();
    if (!working) farArm();
    legs(); legsX(); skirt(); torso(); torsoX(); armour(); head(); hair(); hairX(); hat(); hatX(); ears();
    if (CP && CP.open) cloakSide();
    straps(); arms(); pauldrons(); crow(); work();
  } else if (row === 1) {
    legs(); legsX(); skirt(); torso(); torsoX(); armour();
    if (CP && CP.open) { capeBack(); straps(); arms(); } else { straps(); arms(); if (CP) capeBack(); }
    pauldrons(); head(); hair(); hairX(); hat(); hatX(); ears(); crow(); work();
  } else {
    if (CP) capeFront();
    hairBackX(); hairBack(); legs(); legsX(); skirt(); torso(); torsoX(); armour();
    if (CP && CP.open) cloakFront();
    straps(); arms(); pauldrons(); head(); hair(); hairX(); hat(); hatX(); ears(); crow(); work();
  }
  F.finish();
  return F;
}

// draws one person's whole sheet into a canvas
function drawVillagerSheet(L, cv) {
  cv = cv || document.createElement('canvas');
  cv.width = PX.FW * PX.COLS; cv.height = PX.FH * PX.ROWS;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(cv.width, cv.height);
  for (let r = 0; r < PX.ROWS; r++) for (let c = 0; c < PX.COLS; c++) {
    const F = drawVillagerFrame(L, r, c);
    for (let y = 0; y < PX.FH; y++) for (let x = 0; x < PX.FW; x++) {
      const v = F.p[y * PX.FW + x]; if (!v) continue;
      const i = ((r * PX.FH + y) * cv.width + c * PX.FW + x) * 4;
      img.data[i] = v[0]; img.data[i + 1] = v[1]; img.data[i + 2] = v[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ----------------------------------------------------------------- a bust portrait
// 64x64, head and shoulders in three-quarter view (turned a little to the viewer's left), on a soft vignette tinted
// by their own colours. Drawn from the same look as the sprite; made for villagers (the cast have painted portraits),
// but a cast look draws too, with what it shares with the villagers.
function drawPortrait(L, cv) {
  const N = 64, F = new PixFrame(N, N);
  const S = skinRamp(L.skin), H = hairRamp(L.hair), SH = ramp(L.shirt), OV = ramp(L.overCol || L.shirt), HAT = ramp(L.hatCol || '#5a3a26');
  const BRASS = ramp('#c99a3c'), BEARD = L.beardCol ? hairRamp(L.beardCol) : H, iris = L.eyes ? hex3(L.eyes) : [70, 50, 40];
  const eyeC = [36, 26, 40], WHITE = [250, 246, 236], g = L.gnome ? 1 : 0;
  const st = ({ wavy: 'long', curlyLong: 'curly', shag: 'crop', updo: 'bun' })[L.hairStyle] || L.hairStyle || 'crop';
  const hat = ['cap', 'goggles', 'brim', 'flatcap', 'bandana', 'gnome', 'hood'].includes(L.hat) ? L.hat : null;
  const cx = 30, cy = 30 + (g ? 2 : 0), rx = 14.6, ry = 13.8, fx = 27, ey = cy + 2;   // head centre, face centre line, eye row
  const over = L.over || 'none';
  // ----- shoulders and clothes
  F.as('body');
  for (let y = 47; y < N; y++) {
    const k = (y - 47) / 16, x0 = Math.round(16 - k * 12), x1 = Math.round(43 + k * 13);
    for (let x = x0; x <= x1; x++) F.put(x, y, SH[x <= x0 + 1 ? 3 : x >= x1 - 2 ? 1 : 2]);
  }
  for (let y = 53; y < N; y++) { const a = Math.round(21 - (y - 53) * 0.7), b = Math.round(40 + (y - 53) * 0.7); F.put(a, y, SH[1]); F.put(a - 1, y, SH[3]); F.put(b, y, SH[1]); }   // two folds from the arms
  if (over === 'vest' || over === 'coat') {
    for (let y = 48; y < N; y++) { const k = (y - 48) / 15, x0 = Math.round(15 - k * 12), x1 = Math.round(44 + k * 13), a = 27 - Math.round(k * 2), b = 34 + Math.round(k * 2); for (let x = x0; x <= x1; x++) if (x < a || x > b) F.put(x, y, OV[x <= x0 + 1 ? 3 : x >= x1 - 2 ? 1 : x === a - 1 || x === b + 1 ? (x < 30 ? 3 : 1) : 2]); }
    if (over === 'coat') { for (let i = 0; i < 7; i++) { F.put(26 - i, 48 + i, OV[4]); F.put(35 + i, 48 + i, OV[1]); } }
    F.put(24, 56, BRASS[4]); F.put(24, 61, BRASS[4]);
  }
  if (over === 'apron' || over === 'overalls') {
    const A = OV; F.box(21, 54, 40, 63, A, { soft: true }); F.box(21, 54, 40, 54, A, { tone: 3 });
    for (let y = 47; y < 54; y++) { F.put(21, y, A[3]); F.put(22, y, A[2]); F.put(39, y, A[2]); F.put(40, y, A[1]); }
    F.put(22, 54, BRASS[4]); F.put(39, 54, BRASS[4]);
  }
  // the neckline, and a scarf
  F.box(27, 47, 34, 49, S, { tone: 1 }); F.box(28, 50, 33, 50, S, { tone: 1 }); F.box(29, 51, 32, 51, S, { tone: 0 });
  if (L.scarf) { const SC = ramp(L.scarf); F.ell(30.5, 49, 10.5, 3.4, SC, { shine: true }); F.box(34, 50, 37, 58, SC, { soft: true }); F.put(35, 59, SC[1]); }
  if (L.satchel) { F.line(17, 48, 44, 63, ramp('#5a3a26')[1]); F.line(18, 48, 45, 63, ramp('#5a3a26')[2]); }
  // ----- hair that falls behind the head and shoulders
  F.as('hairBack');
  if (st === 'long') { F.box(13, cy, 21, 63, H, { soft: true }); F.box(40, cy, 47, 60, H, { soft: true }); }
  if (st === 'ponytail') F.cap(45, cy - 4, 48, cy + 18, 3, H, { r1: 1.6 });
  if (st === 'braids') { for (const x of [15, 44]) for (let y = cy + 4; y < 62; y++) { const o = (y >> 1) & 1; F.put(x, y, H[o ? 3 : 2]); F.put(x + 1, y, H[o ? 2 : 1]); F.put(x + 2, y, H[o ? 1 : 2]); } }
  if (st === 'bun') F.ell(40, cy - 15, 6, 5, H, { shine: true });
  if (st === 'curly') F.ell(cx + 1, cy + 2, 18, 17, H, { clip: (x, y) => y > cy - 2 });
  // ----- neck and head
  F.as('neck'); F.box(26, cy + 9, 35, 48, S, { tone: 1 }); F.box(26, cy + 9, 27, 48, S, { tone: 2 });
  F.as('head');
  F.ell(cx, cy, rx, ry, S, { bias: 0.18 });
  F.ell(fx - 1, cy + 10, 7.5, 4.6, S, { bias: 0.2, clip: (x, y) => y > cy + 6 });     // the chin, turned toward us
  F.ell(cx + 13.5, ey + 2, 2.6, 4, S); F.put(cx + 13, ey + 1, S[0]); F.put(cx + 13, ey + 3, S[1]);   // the ear
  // eyes: the near one full, the far one narrower
  const eye = (x0, w, far) => {
    const I = mixc(iris, WHITE, 0.12), Id = mixc(iris, eyeC, 0.5), Il = mixc(iris, WHITE, 0.42);
    for (let x = x0 - 1; x <= x0 + w; x++) F.put(x, ey - 1, eyeC);
    F.put(x0 + w, ey, eyeC);
    for (let y = ey; y <= ey + 3; y++) for (let x = x0; x < x0 + w; x++) {
      const ix = x - x0 - (far ? 0 : 1), white = far ? x === x0 + w - 1 : x === x0;
      F.put(x, y, white ? (y === ey + 3 ? mixc(WHITE, S[1], 0.5) : WHITE) : y === ey ? Id : y === ey + 1 ? (ix === 1 ? eyeC : Id) : y === ey + 2 ? (ix === 1 ? Il : I) : I);
    }
    F.put(far ? x0 : x0 + 1, ey, [255, 255, 252]); F.put(far ? x0 + 1 : x0 + 2, ey + 1, [255, 255, 252]);
    for (let x = x0; x < x0 + w; x++) F.put(x, ey + 4, S[1]);
    if (L.lashes) { F.put(far ? x0 - 2 : x0 + w + 1, ey - 2, eyeC); F.put(far ? x0 - 1 : x0 + w, ey - 2, eyeC); }
  };
  eye(19, 4, true); eye(31, 5, false);
  // brows, nose, mouth, cheeks
  const BR = L.brows ? ramp(L.beardCol || L.hair) : H;
  F.line(18, ey - 3, 22, ey - 4, BR[1]); F.line(31, ey - 4, 36, ey - 3, BR[1]); if (L.brows) { F.line(18, ey - 4, 22, ey - 5, BR[0]); F.line(31, ey - 5, 36, ey - 4, BR[0]); }
  for (let y = ey + 1; y <= ey + 5; y++) F.put(28, y, S[1]);
  F.put(26, ey + 6, S[1]); F.put(27, ey + 6, S[0]); F.put(25, ey + 5, S[3]); F.put(26, ey + 5, S[2]);
  const m0 = mixc(S[0], [130, 40, 50], 0.45), m1 = mixc(S[1], [180, 80, 80], 0.35);
  F.put(23, ey + 9, m1); F.put(24, ey + 9, m0); F.put(25, ey + 9, m0); F.put(26, ey + 9, m0); F.put(27, ey + 9, m1); F.put(28, ey + 8, m1);
  F.put(24, ey + 10, S[3]); F.put(25, ey + 10, S[3]);
  const blush = mixc(S[2], [222, 110, 110], 0.38);
  for (const [x, y] of [[34, 6], [35, 6], [36, 6], [19, 6], [20, 6]]) F.put(x, ey + y, blush);
  if (L.freckles) for (const [x, y] of [[21, 6], [23, 5], [32, 5], [34, 7], [36, 5]]) F.put(x, ey + y, mixc(S[1], [160, 80, 50], 0.35));
  // ----- beard
  if (L.beard) {
    F.as('beard');
    if (L.beard === 'full') F.ell(cx - 1, cy + 9, 15, 10 + g * 4, BEARD, { clip: (x, y) => y > ey + 6 || (x > 38 && y > ey + 2) || (x < 18 && y > ey + 3) });
    F.ell(fx, cy + 11, 11, 7 + g * 5, BEARD, { clip: (x, y) => y > ey + 6 });
    F.box(21, ey + 7, 31, ey + 8, BEARD, { tone: 3 }); F.put(24, ey + 9, mixc(S[0], BEARD[0], 0.5)); F.put(25, ey + 9, S[0]); F.put(26, ey + 9, S[0]);
    F.retone(BEARD, ey + 6, 63, (x, y, t) => (x * 3 + (y >> 1)) % 5 === 0 && t >= 2 ? 1 : (x + y) % 7 === 0 && t === 2 ? 3 : t);
  }
  // ----- glasses
  if (L.glasses) {
    const G = L.glassesCol ? ramp(L.glassesCol) : BRASS;
    for (const [x0, w] of [[18, 6], [30, 7]]) { for (let x = x0; x < x0 + w; x++) { F.put(x, ey - 2, G[2]); F.put(x, ey + 5, G[1]); } for (let y = ey - 1; y <= ey + 4; y++) { F.put(x0 - 1, y, G[2]); F.put(x0 + w, y, G[1]); } }
    F.box(24, ey, 29, ey, G, { flat: true }); F.line(37, ey, 43, ey - 1, G[1]);
  }
  // ----- hair over the head
  F.as('hair');
  if (st !== 'bald') {
    const cr = st === 'curly' ? 17.5 : 16, cry = st === 'curly' ? 13.5 : 12.4;
    F.ell(cx + 1, cy - 5, cr, cry, H, { clip: (x, y) => y <= ey - 5 + (x > 40 ? 9 : x < 17 ? 6 : 0), shine: true });
    const fr = L.fringe || 'swept';
    if (st === 'curly') { for (let x = 15; x <= 45; x += 4) F.ell(x, ey - 5.5 + ((x >> 2) & 1), 2.6, 2.2, H, { shine: true }); }
    else if (fr === 'swept') { for (let x = 15; x <= 36; x++) { const d = Math.round((36 - x) * 0.32); for (let k = 0; k <= d; k++) F.put(x, ey - 6 + k, H[k === d ? 1 : (x % 5 === 2 ? 3 : 2)]); } }
    else if (fr === 'parted') { for (let x = 14; x <= 44; x++) { if (x === 27 || x === 28) continue; const d = x < 27 ? Math.round((27 - x) * 0.3) : Math.round((x - 28) * 0.3); for (let k = 0; k <= d; k++) F.put(x, ey - 6 + k, H[k === d ? 1 : x < 27 ? 2 : 1 + (k === 0 ? 1 : 0)]); } }
    else { for (let x = 15; x <= 44; x++) { F.put(x, ey - 6, H[2]); F.put(x, ey - 5, H[x % 4 === 0 ? 1 : 2]); if (x % 3) F.put(x, ey - 4, H[1]); } }
    if (st === 'bob' || st === 'long') { F.box(13, ey - 6, 17, cy + 13, H, { soft: true }); F.box(41, ey - 6, 46, cy + 12, H, { soft: true }); }
    if (st === 'braids') { F.put(16, ey - 3, H[1]); F.put(44, ey - 3, H[1]); }
    // strands fanning from the crown and a band of shine
    F.retone(H, 0, 63, (x, y, t) => {
      if (t < 1 || t > 3) return t;
      if (st === 'curly') { const c = [[2, 3, 3, 2], [3, 2, 2, 1], [2, 2, 1, 2], [1, 2, 2, 2]][y & 3][(x + ((y >> 2) & 1) * 2) & 3]; return c === 1 ? Math.min(t, 1) : c === 3 && t >= 2 ? 3 : t; }
      const dx = x + 0.5 - 26, dy = y + 0.5 - (cy - 19), r = Math.sqrt(dx * dx + dy * dy), q = Math.atan2(dx, dy) / 0.22 + 0.5, d = Math.abs(q - Math.round(q)) * 0.22 * r;
      if (Math.abs(r - 13) < 1.2 && dx < 4) return d < 0.6 ? t : 3;
      return d < 0.55 && t >= 2 && r > 4 ? t - 1 : t;
    });
  } else F.ell(cx + 4, cy - 2, 14, 11, H, { clip: (x, y) => y > cy - 4 && x > 38 });
  // ----- hats
  if (hat) {
    F.as('hat');
    const strap = ramp('#3e2a22'), GL = ramp('#9ed4dc');
    const goggles = (y) => { for (let x = 13; x <= 46; x++) if (F.has(x, y)) { F.put(x, y, strap[2]); F.put(x, y + 1, strap[1]); } for (const [x, r] of [[22, 4], [35, 4.4]]) { F.ell(x, y + 0.5, r, r * 0.85, BRASS, { shine: true }); F.ell(x, y + 0.5, r - 1.8, r * 0.85 - 1.8, GL, { shine: true }); } };
    if (hat === 'cap') { F.ell(cx + 1, cy - 6, 16.5, 12, HAT, { clip: (x, y) => y <= ey - 6, shine: true }); F.box(13, ey - 6, 17, cy + 10, HAT, { soft: true }); F.box(42, ey - 6, 46, cy + 9, HAT, { soft: true }); goggles(cy - 11); }
    if (hat === 'goggles') goggles(cy - 11);
    if (hat === 'brim') { F.ell(cx + 1, cy - 13, 12, 7, HAT, { clip: (x, y) => y <= cy - 11, shine: true }); F.ell(cx + 1, cy - 10, 26, 4, HAT, { shine: true }); F.box(19, cy - 15, 42, cy - 13, ramp(L.scarf || '#b5832a'), { flat: true }); }
    if (hat === 'flatcap') { F.ell(cx + 2, cy - 9, 16.5, 9, HAT, { clip: (x, y) => y <= ey - 7, shine: true }); F.box(10, ey - 7, 32, ey - 6, HAT, { tone: 1 }); F.box(11, ey - 7, 31, ey - 7, HAT, { tone: 3 }); }
    if (hat === 'bandana') { F.ell(cx + 1, cy - 8, 16, 9, HAT, { clip: (x, y) => y <= ey - 6, shine: true }); F.cap(45, ey - 7, 49, ey + 1, 1.6, HAT); F.cap(45, ey - 7, 50, ey - 3, 1.4, HAT); }
    if (hat === 'gnome') { for (let i = 0; i < 30; i++) { const y = cy - 9 - i, w = Math.max(0, 16 - i * 0.55), c = cx + 1 + i * 0.3; for (let x = Math.floor(c - w); x <= Math.ceil(c + w); x++) F.put(x, y, HAT[x < c - w * 0.4 ? 3 : x > c + w * 0.5 ? 1 : 2]); } F.box(13, cy - 10, 47, cy - 7, HAT, { tone: 1 }); }
    if (hat === 'hood') { F.ell(cx + 1, cy - 1, 19, 19, HAT, { clip: (x, y) => !(x >= 16 && x <= 40 && y >= ey - 6) || y > 47, shine: true }); }
  }
  F.finish({ noRim: false });
  // ----- the background: a soft vignette in their own colours, dithered in a few steps
  const base = hex3(L.overCol && over !== 'none' ? L.overCol : L.shirt), light = mixc(mixc(base, WARM, 0.55), [255, 255, 255], 0.1), dark = mixc(base, PLUM, 0.7);
  const steps = [0, 1, 2, 3, 4].map(i => mixc(light, dark, i / 4)), BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  cv = cv || document.createElement('canvas'); cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; let v = F.p[i];
    if (!v) { const d = Math.min(1, Math.hypot((x + 0.5 - 30) / 40, (y + 0.5 - 26) / 40)) * 4, f = d - Math.floor(d); v = steps[Math.min(4, Math.floor(d) + (f * 16 > BAY[(y & 3) * 4 + (x & 3)] ? 1 : 0))]; }
    img.data[i * 4] = v[0]; img.data[i * 4 + 1] = v[1]; img.data[i * 4 + 2] = v[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// a random look, seeded
function randomLook(R, opts = {}) {
  const pick = a => a[Math.floor(R() * a.length)];
  const gnome = opts.gnome ?? R() < 0.08;
  const hairStyle = opts.hairStyle || pick(['crop', 'crop', 'bob', 'long', 'bun', 'ponytail', 'curly', 'braids', 'bald']);
  const L = {
    gnome,
    skin: opts.skin || pick(PXPAL.skin),
    hair: opts.hair || pick(gnome ? ['#efece4', '#cfc6b8', '#e8c46a', '#b5562b'] : PXPAL.hair),
    hairStyle: gnome ? 'bald' : hairStyle,
    shirt: opts.shirt || pick(['#e7dcc2', '#d9cfb4', '#c9b79a', ...PXPAL.cloth]),
    over: opts.over || pick(['vest', 'apron', 'coat', 'overalls', 'none', 'vest']),
    overCol: opts.overCol || pick(PXPAL.cloth),
    pants: opts.pants || pick(PXPAL.pants),
    boots: opts.boots || pick(PXPAL.leather),
    hat: opts.hat !== undefined ? opts.hat : gnome ? 'gnome' : pick([null, null, null, 'cap', 'goggles', 'brim', 'flatcap', 'bandana', 'hood']),
    hatCol: opts.hatCol || pick(['#5a3a26', '#6b3a5e', '#2f5d62', '#9a4430', '#4f5660', '#b5832a', '#3f7a5a']),
    beard: opts.beard ?? (gnome || ((hairStyle === 'crop' || hairStyle === 'bald' || hairStyle === 'curly') && R() < 0.4)),
    fringe: opts.fringe || pick(['swept', 'parted', 'blunt']),
    eyes: opts.eyes || pick(['#4a3020', '#2f4f6a', '#3f5a2e', '#5a3a2a']),
    glasses: opts.glasses ?? R() < 0.12,
    scarf: opts.scarf !== undefined ? opts.scarf : R() < 0.3 ? pick(PXPAL.cloth) : null,
    satchel: opts.satchel ?? R() < 0.2,
    tool: opts.tool || 'hammer',
  };
  if (L.overCol === L.shirt) L.overCol = '#7a5234';
  if (L.hat === 'gnome' && !opts.hatCol) L.hatCol = pick(['#9a4430', '#2f5d62', '#6b3a5e', '#3f7a5a']);
  return L;
}
