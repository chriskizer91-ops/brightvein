// ===================================================================== PIXEL VILLAGERS
// Hand-pixeled people, drawn in code. Every villager gets a sheet of 24x32 frames:
// columns  0 stand · 1 step A · 2 step B · 3 work up · 4 work down
// rows     0 facing the viewer · 1 facing away · 2 facing left (right = mirrored)
const PX = { FW: 24, FH: 32, COLS: 5, ROWS: 3 };

const hex3 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const PLUM = [54, 30, 62], WARM = [255, 238, 196], INK = [30, 18, 30];
// four tones per colour: deep, shadow, base, light. Shadows drift toward plum, lights toward warm cream.
function ramp(h) {
  const b = typeof h === 'string' ? hex3(h) : h;
  return [mixc(mixc(b, [0, 0, 0], 0.5), PLUM, 0.42), mixc(mixc(b, [0, 0, 0], 0.28), PLUM, 0.26), b, mixc(mixc(b, [255, 255, 255], 0.2), WARM, 0.22)];
}

const PXPAL = {
  skin: ['#f7d6b5', '#eebd93', '#d39a6c', '#a86c48', '#7a4a32', '#5a3426'],
  hair: ['#2a1d1c', '#4a2c20', '#7a4526', '#b5562b', '#d98a3a', '#e8c46a', '#cfc6b8', '#efece4', '#3b2f45'],
  cloth: ['#6b3a5e', '#2f5d62', '#b5832a', '#9a4430', '#6f7f4c', '#2f3d5c', '#e7dcc2', '#7a5234', '#4f5660', '#a8577a', '#3f7a5a', '#c76b3a'],
  leather: ['#6a432a', '#5a3a26', '#8a5a34', '#3e2a22'],
  pants: ['#3f3a4a', '#5a4632', '#2f3d4c', '#6b5a44', '#4a3a2e'],
};

function PixFrame() { this.p = new Array(PX.FW * PX.FH).fill(null); }
PixFrame.prototype.put = function (x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= PX.FW || y >= PX.FH || !c) return;
  this.p[y * PX.FW + x] = c;
};
PixFrame.prototype.has = function (x, y) { return x >= 0 && y >= 0 && x < PX.FW && y < PX.FH && !!this.p[y * PX.FW + x]; };
// a shaded ellipse: light from upper left
PixFrame.prototype.ell = function (cx, cy, rx, ry, R, opt = {}) {
  const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1), y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    if (opt.clip && !opt.clip(x, y)) continue;
    const l = -0.55 * nx - 0.8 * ny + 0.22 * (1 - d) + (opt.bias || 0);
    this.put(x, y, R[l > 0.5 ? 3 : l > -0.18 ? 2 : l > -0.62 ? 1 : 0]);
  }
};
// a shaded box (inclusive corners)
PixFrame.prototype.box = function (x0, y0, x1, y1, R, opt = {}) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let t = 2;
    if (x === x0 && x1 - x0 > 1 && !opt.flat) t = 3;
    if (x === x1 && x1 - x0 > 0) t = 1;
    if (y === y1 && !opt.noBottom) t = Math.min(t, 1);
    if (x === x1 && y === y1 && x1 - x0 > 1) t = 0;
    if (opt.tone !== undefined) t = opt.tone;
    this.put(x, y, R[t]);
  }
};
PixFrame.prototype.line = function (x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let i = 0; i < 64; i++) {
    this.put(x0, y0, typeof c === 'function' ? c(i) : c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
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
// coloured outline: every empty pixel touching the figure takes a dark version of its neighbour
PixFrame.prototype.outline = function () {
  const src = this.p.slice();
  for (let y = 0; y < PX.FH; y++) for (let x = 0; x < PX.FW; x++) {
    if (src[y * PX.FW + x]) continue;
    let n = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < PX.FW && yy < PX.FH && src[yy * PX.FW + xx]) { n = src[yy * PX.FW + xx]; break; }
    }
    if (n) this.p[y * PX.FW + x] = mixc(n, INK, 0.78);
  }
};

// ----------------------------------------------------------------- the figure
// look: { skin, hair, hairStyle, hat, hatCol, shirt, over, overCol, pants, boots, beard, glasses, scarf, gnome, tool }
// The visiting cast (cast.js) can carry more; all of it is optional and ordinary villagers use none of it:
//   hair:    hairStyle 'wavy' | 'shag' | 'updo' | 'curlyLong', hairLen (extra rows), hairBias (below 0 darkens highlights),
//            braid (-1 | 1: over which shoulder, as seen from the front), braidTie, headband, veil [colours] (veils from the hat)
//   face:    faceLight (brighter, warmer-shadowed face), ears 'fox' | 'elf', earCol, earInner, brows, lashes, freckles, facePaint,
//            glassesCol, beard 'full', beardCol
//   hats:    'witch' (hatBand, hatTip -1 | 1 for the way the point flops, horns 'ram' | 'small', hornCol, hatBadge 'moon' | 'buckle', brimW),
//            'jester' (pomCol), 'helm' (helmTrim, plume: [colours]), 'captain' (feather), and 'gnome' with hatBand, hatStars, hatTip 'star', hatGoggles
//   body:    build 'big', over 'corset', sleeves 'rolled' | 'short' | 'puff' | 'bell', sleeveCol, bracers, cuffs, gloves,
//            neck 'low' | 'off', collar 'ruff' | 'choker', collarCol, pendant, belt (false, or a colour), pouches
//   armour:  { col, trim, plate (false for none), pauldron 'L' | 'R' | 'both', big, emblem 'sun', greaves }
//   cape:    { col, lining, trim, len, flare, hem 'straight' | 'tattered', open (worn as a cloak or long coat), emblem 'sun', cols (stripes), sparkle }
//   skirt:   { col, cols, pattern 'patch' | 'layers', len, flare, hem 'straight' | 'tattered' | 'wave', trim, emblem 'sun', slit }
//   legs:    bootsTall, legPattern 'dots' | 'lace'
//   extras:  pet 'crow', held 'dagger' | 'sword' | 'book' (heldHand -1 | 1, blade, bladeEdge, bookCol), magic (colour for tool 'spell')
//   tools:   'sword', 'dagger' and 'spell' besides the villagers' tools
function drawVillagerFrame(L, row, col) {
  const F = new PixFrame();
  // (faceLight: the cast's faces are lit a little more, with warmer shadows)
  const S0 = ramp(L.skin), S = L.faceLight ? [mixc(mixc(S0[2], [0, 0, 0], 0.42), [140, 50, 50], 0.2), mixc(mixc(S0[2], [0, 0, 0], 0.16), [200, 90, 70], 0.18), S0[2], S0[3]] : S0;
  const H = ramp(L.hair), SH = ramp(L.shirt), OV = ramp(L.overCol), PA = ramp(L.pants), BO = ramp(L.boots);
  const HAT = ramp(L.hatCol || '#5a3a26'), BRASS = ramp('#c99a3c'), IRON = ramp('#7d8590'), OAK = ramp('#8a5a34'), AMB = ramp('#ffb347');
  const g = L.gnome ? 1 : 0;
  const working = col >= 3, up = col === 3;
  const bob = (col === 1 || col === 2) ? 1 : 0;
  const hy = g ? 3 : 0;                    // gnomes: head sits lower on a shorter body
  const headCY = 10 + hy + bob, headRX = 6.6, headRY = 6.2;
  const torsoTop = (g ? 20 : 17) + bob, torsoBot = 25;
  const ink = [43, 29, 42];
  const eyeC = [36, 26, 40], blush = mixc(S[2], [222, 110, 110], 0.35);
  // the cast's extras
  const sw1 = col === 1 ? 1 : col === 2 ? -1 : 0;        // walking: which way loose things swing
  const bw = L.build === 'big' ? 1 : 0;                    // a broad build: wider body and arms
  const HAND = L.gloves ? ramp(L.gloves) : S;
  const HB = L.hairBias || 0;                             // darker hair highlights (bright hair otherwise reads as a bald crown)
  const GOLD = ramp('#e0aa48');
  const CP = L.cape || null, CR = CP ? ramp(CP.col) : null, CT = CP && CP.trim ? ramp(CP.trim) : null;
  const CLN = CP ? ramp(CP.lining || mixc(hex3(CP.col), PLUM, 0.5)) : null, CRS = CP && CP.cols ? CP.cols.map(ramp) : null;
  const shine = c => mixc(c, [255, 250, 236], 0.6);
  // legs as drawn in the side view: the near (front) leg and the far one
  let sfx = 10, sbx = 12; if (col === 1) { sfx = 8; sbx = 14; } else if (col === 2) { sfx = 13; sbx = 9; }

  // ----- legs
  const legs = () => {
    if (row !== 2) {
      const lift = [0, 0, 0][0];
      const la = col === 1 ? 1 : 0, lb = col === 2 ? 1 : 0;   // which leg is lifted
      const top = g ? 27 : 26;
      F.box(8, top, 10, 28 - la, PA); F.box(13, top, 15, 28 - lb, PA);
      F.box(8, 29 - la, 10, 31 - la, BO); F.box(13, 29 - lb, 15, 31 - lb, BO);
      if (row === 0) { F.put(8, 31 - la, BO[3]); F.put(13, 31 - lb, BO[3]); }
      void lift;
    } else {
      const top = g ? 27 : 26;
      let fx = 10, bx = 12;                 // near (front) leg, far leg
      if (col === 1) { fx = 8; bx = 14; } else if (col === 2) { fx = 13; bx = 9; }
      const far = ramp(mixc(L.pants ? hex3(L.pants) : [80, 70, 80], PLUM, 0.35)), farB = ramp(mixc(hex3(L.boots), PLUM, 0.35));
      F.box(bx, top, bx + 2, 28, far); F.box(bx, 29, bx + 2, 31, farB); F.put(bx - 1, 31, farB[1]);
      F.box(fx, top, fx + 2, 28, PA); F.box(fx, 29, fx + 2, 31, BO); F.put(fx - 1, 31, BO[2]); F.put(fx - 1, 30, BO[3]);
    }
  };
  // ----- patterned stockings and tall boots
  const legsX = () => {
    if (!L.bootsTall && !L.legPattern) return;
    const top = g ? 27 : 26, farR = ramp(mixc(hex3(L.pants), PLUM, 0.35)), farB = ramp(mixc(hex3(L.boots), PLUM, 0.35));
    if (L.legPattern) {
      const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
      for (let y = top; y <= 31; y++) for (let x = 0; x < PX.FW; x++) {
        const v = F.p[y * PX.FW + x]; if (!v) continue;
        const R = PA.some(c => same(c, v)) ? PA : farR.some(c => same(c, v)) ? farR : null; if (!R) continue;
        const on = L.legPattern === 'dots' ? (x + y) % 2 === 0 && (x * 3 + y) % 4 < 2 : (x + 2 * y) % 5 === 0 || (x + y) % 7 === 0;
        if (on) F.put(x, y, R[L.legPattern === 'dots' ? 0 : 3]);
      }
    }
    if (L.bootsTall) {
      const legsAt = row !== 2 ? [[8, col === 1 ? 1 : 0, BO], [13, col === 2 ? 1 : 0, BO]] : [[sbx, 0, farB], [sfx, 0, BO]];
      for (const [x, l, R] of legsAt) { F.box(x, 27 - l, x + 2, 28 - l, R); F.box(x, 27 - l, x + 2, 27 - l, R, { tone: 3 }); }
    }
  };

  // ----- a long skirt, robe or tabard over the legs; its hem sways as they walk
  const skirt = () => {
    const K = L.skirt; if (!K) return;
    const top = torsoBot - 1, bot = Math.min(31, top + K.len), n = Math.max(1, bot - top), fl0 = K.flare ?? 2;
    const RS = (K.cols || [K.col]).map(ramp), TR = K.trim ? ramp(K.trim) : null, ph = col === 1 ? 1 : col === 2 ? 2 : 0;
    for (let y = top; y <= bot; y++) {
      const k = (y - top) / n, fl = fl0 * k;
      let x0, x1;
      if (row !== 2) { const s = Math.round(sw1 * k * k * 1.3); x0 = Math.round(7 - bw - fl) + s; x1 = Math.round(16 + bw + fl) + s; }
      else { x0 = Math.round(9 - bw + (Math.min(sfx, sbx) - 1 - 9 + bw - fl * 0.5) * k); x1 = Math.round(14 + bw + (Math.max(sfx, sbx) + 3 - 14 - bw + fl * 0.6) * k); }
      for (let x = x0; x <= x1; x++) {
        if (K.hem === 'tattered' && y > bot - 2 + [2, 1, 0, 1][(x + ph) & 3]) continue;
        if (K.hem === 'wave' && y === bot && (x + ph) % 3 === 0) continue;
        let R = RS[0], t = x === x0 ? 3 : x === x1 ? 1 : (y > top && (x - x0) % 3 === 2) ? 1 : 2;
        if (K.pattern === 'patch') { const bx = Math.floor((x + 1) / 3), by = Math.floor((y - top + 1 + (bx & 1)) / 3); R = RS[(bx * 5 + by * 3 + (bx * by & 1)) % RS.length]; t = x === x0 ? 3 : x === x1 ? 1 : (x + 1) % 3 === 0 ? 1 : 2; }
        if (K.pattern === 'layers') { R = RS[Math.floor((y - top) / 2) % RS.length]; if ((y - top) % 2 === 1) t = Math.min(t, 1); }
        if (y === bot) t = Math.min(t, 1);
        if (TR && y === bot) { R = TR; t = x === x0 ? 3 : 2; }
        F.put(x, y, R[t]);
      }
    }
    if (row === 0 && K.emblem === 'sun') sunAt(11, top + 2);
    if (row === 0 && K.slit) { const x = K.slit > 0 ? 14 : 9; for (let y = top + 2; y < bot; y++) F.put(x, y, y < top + 4 ? S[1] : PA[1]); }
  };
  // a little gold sun: a disc and four rays
  const sunAt = (x, y) => {
    F.put(x, y, GOLD[3]); F.put(x + 1, y, GOLD[2]); F.put(x, y + 1, GOLD[2]); F.put(x + 1, y + 1, GOLD[1]);
    F.put(x - 1, y - 1, GOLD[1]); F.put(x + 2, y - 1, GOLD[1]); F.put(x - 1, y + 2, GOLD[1]); F.put(x + 2, y + 2, GOLD[1]);
  };

  // ----- torso and clothes
  const torso = () => {
    if (row !== 2) {
      F.box(7 - bw, torsoTop + 1, 16 + bw, torsoBot, SH); F.box(8 - bw, torsoTop, 15 + bw, torsoTop, SH, { tone: 3 });
      if (L.over === 'vest') { F.box(7 - bw, torsoTop + 1, 10, torsoBot - 1, OV); F.box(13, torsoTop + 1, 16 + bw, torsoBot - 1, OV); if (row === 1) F.box(7 - bw, torsoTop + 1, 16 + bw, torsoBot - 1, OV); }
      if (L.over === 'apron') { F.box(8 - bw, torsoTop + 3, 15 + bw, torsoBot + 3, OV, { noBottom: false }); if (row === 0) { F.put(9, torsoTop + 1, OV[1]); F.put(14, torsoTop + 1, OV[1]); F.put(11, torsoTop + 5, OV[3]); F.put(12, torsoTop + 5, OV[3]); } if (row === 1) F.box(7, torsoTop + 4, 16, torsoTop + 4, OV, { tone: 1 }); }
      if (L.over === 'coat') { F.box(6, torsoTop + 1, 17, torsoBot + 2, OV); if (row === 0) { F.box(11, torsoTop + 1, 12, torsoBot + 2, SH, { tone: 2 }); F.put(10, torsoTop + 3, BRASS[3]); F.put(10, torsoTop + 6, BRASS[3]); } }
      if (L.over === 'overalls') { F.box(8, torsoTop + 3, 15, torsoBot, OV); F.put(9, torsoTop + 1, OV[2]); F.put(9, torsoTop + 2, OV[2]); F.put(14, torsoTop + 1, OV[2]); F.put(14, torsoTop + 2, OV[2]); if (row === 0) { F.put(9, torsoTop + 3, BRASS[3]); F.put(14, torsoTop + 3, BRASS[3]); } }
      // belt
      if (L.over !== 'coat' && L.over !== 'overalls' && L.belt !== false) { F.box(7 - bw, torsoBot - 1, 16 + bw, torsoBot - 1, ramp(L.belt || '#4a3226'), { flat: true }); if (row === 0) F.put(11, torsoBot - 1, BRASS[3]); }
      if (L.scarf) { F.box(8, torsoTop, 15, torsoTop + 1, ramp(L.scarf)); if (row === 0) { F.put(14, torsoTop + 2, ramp(L.scarf)[1]); F.put(14, torsoTop + 3, ramp(L.scarf)[1]); } }
      if (L.satchel && row === 0) { F.line(8, torsoTop + 1, 15, torsoBot - 2, ramp('#5a3a26')[1]); F.box(14, torsoBot - 3, 17, torsoBot, ramp('#7a5234')); }
    } else {
      F.box(9 - bw, torsoTop + 1, 14 + bw, torsoBot, SH); F.box(10 - bw, torsoTop, 13 + bw, torsoTop, SH, { tone: 3 });
      if (L.over === 'vest') F.box(11, torsoTop + 1, 14, torsoBot - 1, OV);
      if (L.over === 'apron') F.box(8, torsoTop + 3, 10, torsoBot + 3, OV);
      if (L.over === 'coat') { F.box(9, torsoTop + 1, 15, torsoBot + 2, OV); }
      if (L.over === 'overalls') F.box(9, torsoTop + 3, 14, torsoBot, OV);
      if (L.over !== 'coat' && L.over !== 'overalls' && L.belt !== false) F.box(9 - bw, torsoBot - 1, 14 + bw, torsoBot - 1, ramp(L.belt || '#4a3226'), { flat: true });
      if (L.scarf) F.box(9, torsoTop, 14, torsoTop + 1, ramp(L.scarf));
      if (L.satchel) F.box(13, torsoBot - 3, 16, torsoBot, ramp('#7a5234'));
    }
  };

  // ----- the cast's clothes over the torso
  const torsoX = () => {
    if (L.over === 'corset') {
      if (row !== 2) {
        F.box(8 - bw, torsoTop + 2, 15 + bw, torsoBot - 2, OV); F.box(8 - bw, torsoTop + 2, 15 + bw, torsoTop + 2, OV, { tone: 3 });
        for (let y = torsoTop + 3; y <= torsoBot - 2; y++) F.put(11 + (y & 1), y, OV[row === 0 ? 3 : 1]);   // laces
      } else { F.box(10, torsoTop + 2, 14, torsoBot - 2, OV); F.box(10, torsoTop + 2, 14, torsoTop + 2, OV, { tone: 3 }); }
    }
    if (L.neck === 'low' && row === 0) { F.box(10, torsoTop, 13, torsoTop, S, { tone: 2 }); F.put(11, torsoTop + 1, S[1]); F.put(12, torsoTop + 1, S[1]); }
    if (L.neck === 'off') {
      if (row !== 2) { F.box(8 - bw, torsoTop, 15 + bw, torsoTop, S, { tone: 2 }); if (row === 0) F.box(10, torsoTop + 1, 13, torsoTop + 1, S, { tone: 1 }); }
      else F.box(10, torsoTop, 13, torsoTop, S, { tone: 2 });
    }
    if (L.collar === 'ruff') {
      const C = ramp(L.collarCol || '#2a2228'), [a, b] = row === 2 ? [9, 14] : [8, 15];
      for (let x = a; x <= b; x++) { F.put(x, torsoTop - 1, C[x & 1 ? 3 : 2]); F.put(x, torsoTop, C[x & 1 ? 1 : 2]); }
      F.put(a - 1, torsoTop, C[1]); F.put(b + 1, torsoTop, C[1]);
    }
    if (L.collar === 'choker' && row !== 1) {
      const C = ramp(L.collarCol || '#2a1a22');
      if (row === 0) { F.box(10, torsoTop - 1, 13, torsoTop - 1, C, { tone: 1 }); F.put(11, torsoTop, GOLD[3]); F.put(12, torsoTop, GOLD[1]); }
      else { F.box(9, torsoTop - 1, 11, torsoTop - 1, C, { tone: 1 }); F.put(9, torsoTop, GOLD[3]); }
    }
    if (L.pendant && row === 0) { const P = ramp(L.pendant); F.put(11, torsoTop + 1, GOLD[1]); F.put(12, torsoTop + 2, P[3]); F.put(11, torsoTop + 2, P[2]); F.put(11, torsoTop + 3, P[1]); }
    if (L.pouches) {
      const P = ramp(L.pouches);
      if (row === 0) { F.box(6 - bw, torsoBot, 8 - bw, torsoBot + 2, P); F.put(7 - bw, torsoBot, BRASS[3]); F.box(15 + bw, torsoBot, 16 + bw, torsoBot + 1, P); }
      else if (row === 1) F.box(15 + bw, torsoBot, 17 + bw, torsoBot + 2, P);
      else { F.box(12, torsoBot, 14, torsoBot + 2, P); F.put(12, torsoBot, BRASS[3]); }
    }
  };

  // ----- armour: a breastplate, plates on the shoulders, greaves
  const armour = () => {
    const A = L.armour; if (!A) return;
    const M = ramp(A.col);
    if (A.plate !== false) {
      const clip = (x, y) => y >= torsoTop && y <= torsoBot - 2;
      if (row !== 2) F.ell(12, torsoTop + 3, 4.1 + bw, 3.8, M, { clip }); else F.ell(12, torsoTop + 3, 2.9 + bw * 0.5, 3.8, M, { clip });
      if (row === 0) { F.put(9 - bw, torsoTop + 1, shine(M[3])); F.put(10 - bw, torsoTop + 2, M[3]); if (A.emblem === 'sun') sunAt(11, torsoTop + 3); }
      if (row === 2) F.put(10, torsoTop + 1, shine(M[3]));
      if (A.trim) { const T = ramp(A.trim); if (row !== 2) F.box(8 - bw, torsoBot - 2, 15 + bw, torsoBot - 2, T, { flat: true }); else F.box(10, torsoBot - 2, 14, torsoBot - 2, T, { flat: true }); }
    }
    if (A.greaves && !L.skirt) {
      if (row !== 2) { const la = col === 1 ? 1 : 0, lb = col === 2 ? 1 : 0; for (const [x, l] of [[8, la], [13, lb]]) { F.box(x, 27 - l, x + 2, 28 - l, M); F.put(x, 27 - l, shine(M[3])); } }
      else { F.box(sfx, 27, sfx + 2, 28, M); F.put(sfx, 27, shine(M[3])); }
    }
  };
  const pauldrons = () => {
    const A = L.armour; if (!A || !A.pauldron) return;
    const M = ramp(A.col), T = A.trim ? ramp(A.trim) : null, big = A.big ? 0.7 : 0;
    for (const s0 of A.pauldron === 'both' ? [-1, 1] : [A.pauldron === 'L' ? -1 : 1]) {
      if (row === 2) {   // facing left, the near shoulder is the one on the viewer's right in the front view
        if (s0 < 0) continue;
        F.ell(12.4, torsoTop + 1.4, 2.7 + big * 0.6, 2.2 + big * 0.4, M); F.ell(12.6, torsoTop + 3.4, 2.4 + big * 0.5, 1.5, M);
        if (T) F.put(12, torsoTop + 3, T[2]);
        F.put(11, torsoTop, shine(M[3]));
        continue;
      }
      const s = row === 1 ? -s0 : s0, cx = s < 0 ? 6 - bw : 18 + bw;
      F.ell(cx + s * (0.3 + big * 0.4), torsoTop + 1.2, 2.6 + big, 2.1 + big * 0.5, M);
      F.ell(cx + s * (0.6 + big * 0.5), torsoTop + 3.2, 2.3 + big, 1.4 + big * 0.3, M);
      if (T) { const ty = Math.round(torsoTop + 2 + big); F.put(Math.round(cx - 0.5 + s), ty, T[3]); F.put(Math.round(cx - 0.5), ty, T[2]); }
      if (row === 0) F.put(Math.floor(cx) - 1 + (s > 0 ? 1 : 0), torsoTop, shine(M[3]));
    }
  };

  // ----- arms (idle / walking)
  const sleeve = L.sleeveCol ? ramp(L.sleeveCol) : CP && CP.open ? CR : L.over === 'coat' ? OV : SH;
  // a hanging arm seen from the front or back: sleeve from y0, the hand's last row y1; side -1 is the viewer's left
  const armV = (xa, xb, y0, y1, side) => {
    const st = L.sleeves;
    if (st === 'rolled') { F.box(xa, y0, xb, y0 + 2, sleeve); F.box(xa, y0 + 3, xb, y1 - 2, S); if (L.bracers) F.box(xa, y1 - 3, xb, y1 - 2, ramp(L.bracers)); }
    else if (st === 'short') { F.box(xa, y0 + 2, xb, y1 - 2, S); F.box(xa, y0, xb, y0 + 1, sleeve); }
    else if (st === 'puff') { F.box(xa, y0 + 2, xb, y1 - 2, S); F.ell((xa + xb + 1) / 2 + side * 0.4, y0 + 1.2, 1.9, 1.9, sleeve); }
    else if (st === 'bell') { F.box(xa, y0, xb, y1 - 4, sleeve); F.box(Math.min(xa, xa + side), y1 - 3, Math.max(xb, xb + side), y1 - 2, sleeve); }
    else F.box(xa, y0, xb, y1 - 2, sleeve);
    if (L.cuffs) F.box(xa, y1 - 2, xb, y1 - 2, ramp(L.cuffs), { flat: true });
    F.box(xa, y1 - 1, xb, y1, HAND);
  };
  // the near arm seen from the side
  const armSide = () => {
    const sw = col === 1 ? -2 : col === 2 ? 2 : 0, st = L.sleeves, d = Math.sign(sw), a1 = 12 + bw;
    if (st === 'rolled') { F.box(11, torsoTop + 1, a1, torsoTop + 3, sleeve); F.box(11, torsoTop + 4, a1, torsoBot - 3, S); F.box(11 + d, torsoBot - 2, a1 + d, torsoBot - 1, L.bracers ? ramp(L.bracers) : S); }
    else if (st === 'short') { F.box(11, torsoTop + 1, a1, torsoTop + 2, sleeve); F.box(11, torsoTop + 3, a1, torsoBot - 3, S); F.box(11 + d, torsoBot - 2, a1 + d, torsoBot - 1, S); }
    else if (st === 'puff') { F.box(11, torsoTop + 3, a1, torsoBot - 3, S); F.box(11 + d, torsoBot - 2, a1 + d, torsoBot - 1, S); F.ell(12, torsoTop + 2.2, 2.0, 1.9, sleeve); }
    else if (st === 'bell') { F.box(11, torsoTop + 1, a1, torsoBot - 3, sleeve); F.box(10 + d, torsoBot - 2, a1 + 1 + d, torsoBot - 1, sleeve); }
    else { F.box(11, torsoTop + 1, a1, torsoBot - 3, sleeve); F.box(11 + d, torsoBot - 2, a1 + d, torsoBot - 1, sleeve); }
    if (L.cuffs) F.box(11 + d, torsoBot - 1, a1 + d, torsoBot - 1, ramp(L.cuffs), { flat: true });
    F.box(11 + sw / 2, torsoBot, a1 + sw / 2, torsoBot + 1, HAND);
  };
  // an arm bent to carry a book against the chest
  const bookArm = (s) => {
    const BK = ramp(L.bookCol || '#6a3a28'), PG = ramp('#efe2c4');
    if (row === 2) {
      F.box(11, torsoTop + 1, 12, torsoTop + 3, sleeve);
      F.box(5, torsoTop + 1, 8, torsoTop + 6, BK); F.box(8, torsoTop + 2, 8, torsoTop + 5, PG, { flat: true }); F.put(6, torsoTop + 3, GOLD[2]);
      F.box(8, torsoTop + 4, 11, torsoTop + 5, sleeve); F.box(7, torsoTop + 4, 8, torsoTop + 5, HAND);
      return;
    }
    const xa = s > 0 ? 17 + bw : 5 - 2 * bw, xb = xa + 1 + bw;
    F.box(xa, torsoTop + 1, xb, torsoTop + 4, sleeve);
    if (L.sleeves === 'bell') F.box(xa + (s > 0 ? 0 : -1), torsoTop + 5, xb + (s > 0 ? 1 : 0), torsoTop + 7, sleeve);
    if (row === 1) return;
    const b0 = s > 0 ? 13 : 7;
    F.box(b0, torsoTop + 2, b0 + 4, torsoTop + 7, BK); F.box(b0 + 1, torsoTop + 2, b0 + 3, torsoTop + 2, PG, { flat: true });
    F.box(s > 0 ? b0 : b0 + 4, torsoTop + 3, s > 0 ? b0 : b0 + 4, torsoTop + 7, PG, { tone: 1 }); F.put(b0 + 2, torsoTop + 4, GOLD[3]); F.put(b0 + 2, torsoTop + 5, GOLD[1]);
    F.box(s > 0 ? 16 : 6, torsoTop + 6, s > 0 ? 17 : 7, torsoTop + 7, HAND);
  };
  // something held in the hand while walking: a dagger held point up, a sword point down
  const heldItem = (sa) => {
    const h = L.held; if (!h || h === 'book') return;
    const BL = ramp(L.blade || '#c8ccd4'), ED = L.bladeEdge ? ramp(L.bladeEdge) : BL;
    if (row === 2) {
      const sw = col === 1 ? -2 : col === 2 ? 2 : 0, hx = 11 + sw / 2, hy = torsoBot;
      if (h === 'dagger') { F.put(hx - 1, hy, GOLD[3]); F.put(hx - 1, hy - 1, BL[3]); F.put(hx - 2, hy - 2, BL[3]); F.put(hx - 2, hy - 3, ED[2]); }
      if (h === 'sword') { F.line(hx - 1, hy + 2, hx + 2, hy + 2, GOLD[2]); F.line(hx + 1, hy + 3, hx + 4, 31, BL[3]); F.line(hx + 2, hy + 3, hx + 5, 31, ED[2]); }
      return;
    }
    const hh = L.heldHand || -1, s = row === 1 ? -hh : hh;
    const xa = s < 0 ? 5 - 2 * bw : 17 + bw, xb = s < 0 ? 6 - bw : 18 + 2 * bw, y1 = torsoBot + (s < 0 ? sa : -sa);
    const ox = s < 0 ? xa - 1 : xb + 1;
    if (h === 'dagger') { F.put(ox, y1 - 1, GOLD[3]); F.put(ox + s, y1 - 2, BL[3]); F.put(ox + s, y1 - 3, BL[2]); F.put(ox + 2 * s, y1 - 4, ED[3]); F.put(s < 0 ? xb + 1 : xa - 1, y1, GOLD[1]); }
    if (h === 'sword') {
      const bx = s < 0 ? xa : xb;
      F.line(xa - 1, y1 + 1, xb + 1, y1 + 1, i => GOLD[i === 1 ? 3 : 2]);
      F.line(bx, y1 + 2, bx + 2 * s, 31, BL[3]); F.line(bx + s, y1 + 2, bx + 3 * s, 31, ED[2]);
    }
  };
  const arms = () => {
    if (working) return;
    if (row !== 2) {
      const sa = col === 1 ? 1 : col === 2 ? -1 : 0;
      const book = L.held === 'book' ? (L.heldHand || 1) * (row === 1 ? -1 : 1) : 0;
      if (book < 0) bookArm(-1); else armV(5 - 2 * bw, 6 - bw, torsoTop + 1 + sa, torsoBot + sa, -1);
      if (book > 0) bookArm(1); else armV(17 + bw, 18 + 2 * bw, torsoTop + 1 - sa, torsoBot - sa, 1);
      heldItem(sa);
    } else {
      if (L.held === 'book') bookArm(1); else armSide();
      heldItem(0);
    }
  };

  // ----- head
  const head = () => {
    F.box(10, torsoTop - 1, 13, torsoTop, S, { tone: 1 });
    if (L.faceLight) F.ell(12, headCY, headRX, headRY, S, { bias: L.faceLight }); else F.ell(12, headCY, headRX, headRY, S);
    if (row === 0) {
      // big chibi eyes: highlight top-left, iris bottom-right
      const ey = headCY + 1, iris = L.eyes ? hex3(L.eyes) : [70, 50, 40];
      for (const x of [8, 14]) {
        F.put(x, ey, [250, 246, 236]); F.put(x + 1, ey, eyeC);
        F.put(x, ey + 1, eyeC); F.put(x + 1, ey + 1, mixc(iris, eyeC, 0.25));
      }
      F.put(7, ey + 2, blush); F.put(16, ey + 2, blush);
      F.put(11, ey + 3, mixc(S[1], [150, 60, 60], 0.25)); F.put(12, ey + 3, mixc(S[1], [150, 60, 60], 0.25));
      faceX(ey);
      if (L.glasses) { const G = L.glassesCol ? hex3(L.glassesCol) : BRASS[2]; for (const cx of [8, 14]) { F.put(cx - 1, ey, G); F.put(cx + 2, ey, G); F.put(cx - 1, ey + 1, G); F.put(cx + 2, ey + 1, G); F.put(cx, ey - 1, G); F.put(cx + 1, ey - 1, G); F.put(cx, ey + 2, G); F.put(cx + 1, ey + 2, G); } F.put(11, ey, G); F.put(12, ey, G); }
    } else if (row === 2) {
      const ey = headCY + 1, iris = L.eyes ? hex3(L.eyes) : [70, 50, 40];
      F.put(7, ey, [250, 246, 236]); F.put(8, ey, eyeC); F.put(7, ey + 1, eyeC); F.put(8, ey + 1, mixc(iris, eyeC, 0.25));
      F.put(5, ey + 2, S[3]);     // nose
      F.put(9, ey + 2, blush);
      F.put(6, ey + 4, mixc(S[1], [150, 60, 60], 0.25));
      faceX(ey);
      if (L.glasses) { const G = L.glassesCol ? hex3(L.glassesCol) : BRASS[2]; F.put(6, ey, G); F.put(6, ey + 1, G); F.put(9, ey, G); F.put(9, ey + 1, G); F.put(7, ey - 1, G); F.put(8, ey - 1, G); F.put(7, ey + 2, G); F.put(8, ey + 2, G); F.put(10, ey, G); F.put(11, ey, G); }
      F.put(12, ey + 1, S[1]); F.put(12, ey + 2, S[0]); F.put(11, ey + 1, S[2]);    // ear
    }
    if (L.beard) {
      const B = L.beardCol ? ramp(L.beardCol) : H;
      if (L.beard === 'full') {   // a big beard that runs up the cheeks to the ears
        if (row === 0) F.ell(12, headCY + 4.2, 6.4, 4.6 + (g ? 2.5 : 0), B, { clip: (x, y) => y >= headCY + 3 || ((x <= 7 || x >= 16) && y >= headCY + 2) });
        if (row === 2) F.ell(9.6, headCY + 4.4, 4.6, 3.8 + (g ? 2.5 : 0), B, { clip: (x, y) => x <= 12 && (y >= headCY + 3 || (x >= 9 && y >= headCY + 1)) });
      }
      if (row === 0) { F.ell(12, headCY + 5, 5.4, 3.6 + (g ? 2.5 : 0), B, { clip: (x, y) => y >= headCY + 3 }); F.put(11, headCY + 4, S[1]); F.put(12, headCY + 4, S[1]); }
      if (row === 2) F.ell(9, headCY + 5, 3.6, 3 + (g ? 2.5 : 0), B, { clip: (x, y) => y >= headCY + 3 && x <= 11 });
      if (L.beard === 'full') {
        if (row === 0) { F.box(10, headCY + 3, 13, headCY + 3, B, { tone: 3 }); F.put(11, headCY + 4, mixc(S[0], B[0], 0.5)); F.put(12, headCY + 4, mixc(S[0], B[0], 0.5)); }
        if (row === 2) { F.box(6, headCY + 3, 8, headCY + 3, B, { tone: 3 }); F.put(12, headCY + 2, S[1]); F.put(12, headCY + 3, S[0]); }
      }
    }
  };
  // ----- small things on the face: lashes, freckles, face paint, heavy brows
  function faceX(ey) {
    const D = L.brows ? ramp(L.beardCol || L.hair) : null, fr = mixc(S[1], [160, 80, 50], 0.35);
    if (row === 0) {
      if (L.lashes) { F.put(7, ey, eyeC); F.put(16, ey, eyeC); }
      if (L.freckles) { F.put(10, ey + 2, fr); F.put(13, ey + 2, fr); F.put(8, ey + 2, fr); F.put(15, ey + 2, fr); }
      if (L.facePaint) { const P = ramp(L.facePaint); F.put(8, ey + 2, P[1]); F.put(15, ey + 2, P[1]); F.put(8, ey + 3, P[2]); F.put(15, ey + 3, P[2]); F.put(11, ey + 3, P[1]); F.put(12, ey + 3, P[2]); }
      if (D) { F.put(8, ey - 1, D[0]); F.put(9, ey - 1, D[1]); F.put(10, ey, D[0]); F.put(15, ey - 1, D[0]); F.put(14, ey - 1, D[1]); F.put(13, ey, D[0]); }
    } else {
      if (L.freckles) { F.put(7, ey + 2, fr); F.put(9, ey + 3, fr); }
      if (L.facePaint) { const P = ramp(L.facePaint); F.put(8, ey + 2, P[1]); F.put(8, ey + 3, P[2]); F.put(6, ey + 4, P[1]); }
      if (D) { F.put(7, ey - 1, D[1]); F.put(8, ey - 1, D[0]); F.put(6, ey, D[0]); }
    }
  }

  // ----- hair: drawn as pieces relative to the head
  const hairBack = () => {   // the part that hangs behind the shoulders (front view)
    if (row === 0 && (L.hairStyle === 'long' || L.hairStyle === 'braids')) {
      if (L.hairStyle === 'long') { F.box(5, headCY + 2, 7, headCY + 10, H); F.box(16, headCY + 2, 18, headCY + 10, H); }
      else { F.box(5, headCY + 4, 6, headCY + 12, H); F.box(17, headCY + 4, 18, headCY + 12, H); F.put(5, headCY + 13, ramp(L.scarf || '#c76b3a')[2]); F.put(18, headCY + 13, ramp(L.scarf || '#c76b3a')[2]); }
    }
  };
  const hair = () => {
    // the cast's styles start from an ordinary one; hairX adds the rest
    const st = ({ wavy: 'long', curlyLong: 'curly', shag: 'crop', updo: 'bun' })[L.hairStyle] || L.hairStyle, top = headCY - headRY;
    if (st === 'bald') { if (row !== 0) F.ell(12, headCY - 1, 6.4, 5, H, { clip: (x, y) => y > headCY + 1 - (row === 1 ? 0 : 3) && (row === 1 || x > 11) }); return; }
    if (row === 1) {   // from behind: hair covers the head
      const ry = st === 'crop' || st === 'curly' ? 5.6 : 6.4;
      F.ell(12, headCY - (st === 'crop' ? 1 : 0), st === 'curly' ? 7.6 : 6.9, st === 'curly' ? 6.8 : ry + 0.6, H, { bias: HB });
      if (st === 'long') F.box(6, headCY + 2, 17, headCY + 10, H);
      if (st === 'bob') F.box(6, headCY + 1, 17, headCY + 4, H);
      if (st === 'braids') { F.box(7, headCY + 4, 8, headCY + 12, H); F.box(15, headCY + 4, 16, headCY + 12, H); }
      if (st === 'ponytail') F.box(11, headCY + 3, 12, headCY + 10, H);
      if (st === 'bun') F.ell(12, top + 0.5, 2.6, 2.2, H);
      strands(H, headCY);
      return;
    }
    if (row === 0) {
      // cap of hair over the top of the head
      const capR = st === 'curly' ? 7.6 : 6.9;
      F.ell(12, headCY - 1.6, capR, st === 'curly' ? 5.6 : 5.2, H, { clip: (x, y) => y <= headCY - 2 + (x < 7 || x > 16 ? 4 : 0), bias: HB });
      // fringe
      const fr = L.fringe || 'swept';
      if (st === 'curly') { for (const x of [6, 8, 10, 13, 15, 17]) F.put(x, headCY - 2, H[x < 12 ? 2 : 1]); F.put(7, headCY - 1, H[1]); F.put(16, headCY - 1, H[1]); }
      else if (fr === 'swept') { for (let x = 6; x <= 13; x++) { const d = Math.round((13 - x) * 0.45); for (let k = 0; k <= d; k++) F.put(x, headCY - 2 + k, H[k === d ? 1 : 2]); } F.put(16, headCY - 2, H[1]); F.put(17, headCY - 1, H[1]); }
      else if (fr === 'parted') { for (let x = 6; x <= 17; x++) { if (x === 11 || x === 12) continue; const d = x < 11 ? Math.round((11 - x) * 0.35) : Math.round((x - 12) * 0.35); for (let k = 0; k <= d; k++) F.put(x, headCY - 2 + k, H[x < 11 ? 2 : 1]); } }
      else { for (let x = 7; x <= 16; x++) F.put(x, headCY - 1, H[x % 3 === 0 ? 1 : 2]); for (let x = 6; x <= 17; x++) F.put(x, headCY - 2, H[2]); }
      if (st === 'bob' || st === 'long') { F.box(5, headCY - 2, 6, headCY + 4, H); F.box(17, headCY - 2, 18, headCY + 4, H); }
      if (st === 'ponytail' || st === 'braids' || st === 'bun') { F.put(6, headCY - 1, H[1]); F.put(17, headCY - 1, H[1]); }
      if (st === 'bun') F.ell(12, top + 0.2, 2.6, 2.2, H);
      if (st === 'curly') { F.put(5, headCY, H[1]); F.put(18, headCY, H[1]); F.put(5, headCY + 1, H[0]); F.put(18, headCY + 1, H[0]); }
      strands(H, headCY - 3);
      return;
    }
    // side view (facing left): hair over the back and top
    F.ell(12.6, headCY - 1.2, st === 'curly' ? 7.4 : 6.7, st === 'curly' ? 6.2 : 5.6, H, { clip: (x, y) => y <= headCY - 2 || x >= 12 + (y > headCY + 2 ? -1 : 0), bias: HB });
    for (const x of [7, 8, 9]) F.put(x, headCY - 2, H[2]);
    if (st === 'long') F.box(12, headCY + 1, 18, headCY + 10, H);
    if (st === 'bob') F.box(13, headCY + 1, 18, headCY + 4, H);
    if (st === 'braids') { F.box(15, headCY + 3, 16, headCY + 12, H); }
    if (st === 'ponytail') { F.box(18, headCY - 1, 19, headCY + 6, H); F.put(17, headCY - 1, H[2]); }
    if (st === 'bun') F.ell(16, top + 1.2, 2.4, 2.2, H);
    strands(H, headCY - 3);
  };
  function strands(R, y) { for (const [dx, dy] of [[-3, 0], [-2, 1], [1, -1], [2, 0], [4, 1]]) if (F.has(12 + dx, y + dy)) F.put(12 + dx, y + dy, R[3]); }

  // ----- the cast's hair: long wavy or curly masses, messy shags, an updo, a braid, a headband
  // the shading inside a mass of hair: wavy strands, or little curls
  const hairTex = (x, y, curly) => {
    if (curly) { const q = (x + ((y / 2) | 0) * 2) & 3, r = y & 1; return q === 0 && r === 0 ? 3 : (q === 1 && r === 1) || (q === 3 && r === 0) ? 1 : 2; }
    const wv = Math.round(Math.sin(y * 0.7 + (x > 11 ? 1.6 : 0)) * 1.1), u = x - wv + 30, p = u % 3, li = (u / 3) | 0;
    return p === 0 ? 1 : p === 1 && (y + li * 3) % 6 < 2 ? 3 : 2;
  };
  // a big mass of long hair (front view: behind the shoulders; back view: over the back); the ends sway as they walk
  const hairMass = (y0, y1, hwMax, curly) => {
    const n = Math.max(1, y1 - y0);
    for (let y = y0; y <= y1; y++) {
      const k = (y - y0) / n;
      let hw = 6.6 + (hwMax - 6.6) * Math.min(1, k * 2.4);
      if (k > 0.72) hw -= (k - 0.72) * (curly ? 12 : 9);
      const wob = curly ? (y & 1) : ((y >> 1) & 1), s = k > 0.4 ? Math.round(sw1 * (k - 0.4) * 2) : 0;
      const x0 = Math.round(11.5 - hw) - wob + s, x1 = Math.round(11.5 + hw) + wob + s;
      for (let x = x0; x <= x1; x++) {
        if (y === y1 && (x + y) % 2) continue;
        if (y === y1 - 1 && (x + y) % 4 === 1) continue;
        F.put(x, y, H[Math.min(hairTex(x, y, curly), x === x0 || x === x1 || k > 0.85 ? 1 : 3)]);
      }
    }
  };
  // the same seen from the side: it falls down the back and streams out behind as they walk
  const hairMassSide = (y0, y1, curly) => {
    const n = Math.max(1, y1 - y0), back = col === 1 ? 2 : col === 2 ? 1 : 0;
    for (let y = y0; y <= y1; y++) {
      const k = (y - y0) / n, wob = curly ? (y & 1) : ((y >> 1) & 1);
      const x0 = 12 + Math.round(k * 2.5) + Math.round(back * k), x1 = Math.round(17.8 + (k < 0.6 ? k * 1.2 : 0.7 - (k - 0.6) * 5)) + wob + Math.round(back * k * 1.5);
      for (let x = x0; x <= x1; x++) {
        if (y === y1 && (x + y) % 2) continue;
        F.put(x, y, H[Math.min(hairTex(x, y, curly), x === x0 || x === x1 || k > 0.85 ? 1 : 3)]);
      }
    }
  };
  // re-shade hair already drawn in rows y0..y1 with strands (keeps its light and shadow, adds texture)
  const hairStrands = (y0, y1, curly) => {
    for (let y = Math.max(0, y0); y <= Math.min(PX.FH - 1, y1); y++) for (let x = 0; x < PX.FW; x++) {
      const v = F.p[y * PX.FW + x], t0 = H.indexOf(v); if (t0 < 0) continue;
      const t = hairTex(x, y, curly);
      F.put(x, y, H[t === 1 ? Math.min(t0, 1) : t === 3 && t0 >= 2 ? 3 : t0]);
    }
  };
  const hairBackX = () => {   // front view, behind the body
    const st = L.hairStyle, len = L.hairLen || 0;
    if (st === 'wavy') hairMass(headCY - 3, headCY + 14 + len, 9.4, false);
    if (st === 'curlyLong') hairMass(headCY - 2, headCY + 8 + len, 8.4, true);
  };
  const hairX = () => {
    const st = L.hairStyle, len = L.hairLen || 0, top = headCY - headRY;
    if (st === 'wavy') {
      if (row === 0) for (let y = headCY - 2; y <= headCY + 7 + len; y++) { const w = (y >> 1) & 1; F.put(4 + w, y, H[2]); F.put(5 + w, y, H[1]); F.put(18 - w, y, H[1]); F.put(19 - w, y, H[1]); }
      else if (row === 1) hairMass(headCY - 2, headCY + 13 + len, 7.2, false);
      else hairMassSide(headCY - 2, headCY + 12 + len, false);
    }
    if (st === 'curlyLong') {
      if (row === 0) for (let y = headCY - 3; y <= headCY + 6 + len; y++) {   // bunches of curls down both cheeks
        const w = [0, 1, 1][(y + 3) % 3], c = (y + 3) % 3;
        for (let x = 4 - w; x <= 6; x++) F.put(x, y, H[x === 6 ? 1 : c === 1 && x === 4 - w ? 3 : c === 0 && x === 5 ? 1 : 2]);
        for (let x = 17; x <= 19 + w; x++) F.put(x, y, H[x === 17 ? 2 : x === 19 + w ? 1 : c === 1 && x === 18 ? 3 : c === 0 && x === 18 ? 1 : 2]);
      }
      else if (row === 1) hairMass(headCY - 3, headCY + 8 + len, 8.4, true);
      else hairMassSide(headCY - 3, headCY + 7 + len, true);
    }
    if (st === 'shag') {   // messy and full: tufts break the outline, the fringe is ragged; hairLen makes it chin length
      if (row === 0) {
        F.ell(12, headCY - 2.4, 7.5, 5.4, H, { clip: (x, y) => y <= headCY - 3, bias: -0.35 });
        for (const [x, y, t] of [[8, -8, 3], [14, -8, 2]]) F.put(x, headCY + y, H[t]);
        (L.fringe === 'short' ? [1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1] : [2, 3, 1, 2, 3, 2, 1, 3, 2, 1, 2, 2]).forEach((d, i) => { for (let k = 0; k < d; k++) F.put(6 + i, headCY - 2 + k, H[k === d - 1 ? 1 : i < 6 ? 3 - (k > 0) : 2]); });
        if (len) for (const [x, d, t] of [[4, 5, 2], [5, 6, 2], [6, 4, 1], [17, 4, 1], [18, 6, 1], [19, 5, 1]]) for (let k = 0; k < d; k++) F.put(x, headCY - 2 + k, H[k === d - 1 ? 1 : t]);
        strands(H, headCY - 4);
      } else if (row === 1) {
        F.ell(12, headCY - 1.6, 7.6, 6.0, H, { bias: -0.35 });
        for (const [x, y] of [[9, -8], [15, -8]]) F.put(x, headCY + y, H[2]);
        [4, 5, 6, 5, 6, 6, 5, 6, 5, 4].forEach((d, i) => { for (let k = 0; k < d + (len ? 1 : 0); k++) F.put(7 + i, headCY + 1 + k, H[(i + k) % 3 ? 2 : 1]); });
        strands(H, headCY - 3);
      } else {
        F.ell(13.2, headCY - 1.8, 7.0, 5.8, H, { clip: (x, y) => y <= headCY - 2 || x >= 12, bias: -0.35 });
        for (const [x, y, t] of [[20, -4, 2], [21, -1, 1], [17, -7, 2], [13, -9, 3], [8, -7, 3], [5, -4, 2]]) F.put(x, headCY + y, H[t]);
        for (const [x, d] of [[13, 5], [14, 6], [15, 5], [16, 5], [17, 4], [18, 3]]) for (let k = 0; k < d + (len ? 1 : 0); k++) F.put(x, headCY + 1 + k, H[(x + k) % 3 ? 2 : 1]);
        if (len) for (let y = headCY - 1; y <= headCY + 3; y++) { F.put(11, y, H[y & 1 ? 2 : 1]); F.put(12, y, H[2]); }
        for (const [x, d] of [[5, 1], [6, 2], [7, 3], [8, 1], [9, 2]]) for (let k = 0; k < d; k++) F.put(x, headCY - 2 + k, H[k === d - 1 ? 1 : 2]);
        strands(H, headCY - 4);
      }
    }
    if (st === 'updo') {   // piled up on top, with loose strands
      const spikes = row === 2 ? [[11, -2, 3], [13, -3, 3], [15, -4, 2], [17, -3, 2], [19, -1, 1], [20, 1, 1]] : [[6, -1, 2], [8, -3, 3], [10, -4, 3], [12, -3, 2], [14, -4, 2], [16, -2, 1], [17, 0, 1]];
      if (row === 0) { F.ell(12, top + 0.2, 5.6, 2.6, H, { bias: -0.3 }); for (let y = headCY - 2; y <= headCY + 4; y++) { F.put(4 + (y > headCY + 1 ? 1 : 0), y, H[y & 1 ? 2 : 3]); F.put(19 - (y > headCY + 1 ? 1 : 0), y, H[1]); } }
      else if (row === 1) { F.ell(12, top + 0.8, 5.8, 2.8, H, { bias: -0.3 }); F.ell(12, top - 0.4, 3.0, 1.8, H, { bias: -0.2 }); F.ell(12, headCY + 4.2, 3.6, 2.4, S, { clip: (x, y) => y >= headCY + 3 && F.has(x, y) }); for (const x of [8, 10, 14, 15]) F.put(x, headCY + 3 + (x & 1), H[1]); }
      else { F.ell(14.4, top + 0.6, 4.8, 2.8, H, { bias: -0.3 }); for (let y = headCY - 1; y <= headCY + 4; y++) F.put(11, y, H[y & 1 ? 2 : 3]); }
      for (const [x, y, t] of spikes) { F.put(x, top + y, H[t]); F.put(x + (x < 12 ? 1 : -1), top + y + 1, H[t === 3 ? 2 : t]); }
      hairStrands(top - 5, headCY - 2, false);
    }
    if (L.veil) {   // striped veils hanging from the hat past the face to the shoulders (they run on into a striped cloak)
      const V = L.veil.map(ramp), n = V.length, bot = torsoTop + 2, ph = col === 1 ? 1 : 0;
      const strip = (x0, x1, y0, t0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= bot + ((x + ph) % 3 === 0 ? 1 : 0); y++) F.put(x, y, V[(x + 1) % n][x === x0 ? t0 : x === x1 ? 1 : 2]); };
      if (row === 0) { strip(4, 6, headCY - 2, 2); strip(17, 19, headCY - 2, 3); }
      else if (row === 1) strip(5, 18, headCY - 1, 3);
      else strip(12, 17, headCY - 2, 2);
    }
    if (L.headband) {
      const B = ramp(L.headband), y = headCY - 4;
      for (let x = 4; x <= 19; x++) if (F.has(x, y)) { F.put(x, y, B[x < 9 ? 3 : x > 15 ? 1 : 2]); if (F.has(x, y + 1) && (row !== 0 || x < 7 || x > 16)) F.put(x, y + 1, B[1]); }
      if (row === 0) F.put(16, y, [150, 220, 255]);
    }
    if (L.braid) {   // a thick braid: over a shoulder in front, down the back from behind, streaming out behind from the side
      const B = H, TIE = ramp(L.braidTie || '#e0aa48');
      if (row === 0) {
        const x = L.braid < 0 ? 4 - bw : 18 + bw;
        for (let y = headCY + 1; y <= headCY + 12; y++) { const o = y & 1; F.put(x, y, B[o ? 3 : 2]); F.put(x + 1, y, B[o ? 1 : 2]); }
        F.box(x, headCY + 13, x + 1, headCY + 13, TIE, { flat: true }); F.put(x, headCY + 14, B[2]); F.put(x + 1, headCY + 14, B[1]); F.put(x + (L.braid < 0 ? 0 : 1), headCY + 15, B[1]);
      } else if (row === 1) {
        const s = Math.round(sw1 * 0.6), bx = 9;
        for (let y = headCY + 3; y <= headCY + 13; y++) { const o = y & 1, d = y > headCY + 8 ? s : 0; F.put(bx + d, y, B[o ? 3 : 2]); F.put(bx + 1 + d, y, B[o ? 1 : 2]); }
        F.box(bx + s, headCY + 14, bx + 1 + s, headCY + 14, TIE, { flat: true }); F.put(bx + s, headCY + 15, B[2]); F.put(bx + 1 + s, headCY + 15, B[1]);
      } else {
        const back = col === 1 ? 2 : col === 2 ? 1 : 0;
        let last = 0;
        for (let i = 0; i <= 10; i++) { const y = headCY + 2 + i, x = 15 + Math.round(i * 0.35 + back * i * 0.15); F.put(x, y, B[i & 1 ? 3 : 2]); F.put(x + 1, y, B[i & 1 ? 1 : 2]); last = x; }
        F.box(last, headCY + 13, last + 1, headCY + 13, TIE, { flat: true }); F.put(last, headCY + 14, B[2]); F.put(last + 1, headCY + 14, B[1]);
      }
    }
  };

  // ----- hats
  const hat = () => {
    const t = L.hat, top = headCY - headRY;
    if (!t) return;
    if (t === 'cap') {   // flyer's leather cap with brass goggles
      F.ell(12, headCY - 1.8, 7.1, 5.0, HAT, { clip: (x, y) => y <= headCY - 1 });
      if (row !== 1) { const gx = row === 2 ? [8] : [9, 14]; for (let x = 6; x <= 17; x++) if (F.has(x, headCY - 3)) F.put(x, headCY - 3, ramp('#3e2a22')[1]); for (const cx of gx) { F.ell(cx + 0.5, headCY - 3.5, 1.7, 1.5, BRASS); F.put(cx, headCY - 4, [196, 236, 240]); } }
      if (row === 0) { F.box(5, headCY - 1, 6, headCY + 3, HAT); F.box(17, headCY - 1, 18, headCY + 3, HAT); }
      if (row === 2) F.box(14, headCY - 1, 16, headCY + 3, HAT);
    }
    if (t === 'goggles') { if (row === 1) { for (let x = 6; x <= 17; x++) if (F.has(x, headCY - 3)) F.put(x, headCY - 3, ramp('#3e2a22')[1]); } else { const gx = row === 2 ? [8] : [9, 14]; for (const cx of gx) { F.ell(cx + 0.5, headCY - 3.5, 1.7, 1.5, BRASS); F.put(cx, headCY - 4, [196, 236, 240]); } } }
    if (t === 'brim') {
      F.ell(12, top + 2.4, 5.2, 3.4, HAT, { clip: (x, y) => y <= top + 3.2 });
      F.box(row === 2 ? 3 : 3, top + 3, row === 2 ? 19 : 20, top + 4, HAT, { flat: true });
      F.box(7, top + 2, 16, top + 2, ramp(L.scarf || '#b5832a'), { flat: true });
    }
    if (t === 'flatcap') {
      F.ell(12, headCY - 2.6, 6.9, 4.2, HAT, { clip: (x, y) => y <= headCY - 2 });
      if (row === 0) F.box(7, headCY - 2, 16, headCY - 2, HAT, { tone: 1 });
      if (row === 2) F.box(3, headCY - 2, 8, headCY - 2, HAT, { tone: 1 });
    }
    if (t === 'bandana') {
      for (let x = 5; x <= 18; x++) for (const y of [headCY - 4, headCY - 3]) if (F.has(x, y)) F.put(x, y, HAT[y === headCY - 4 ? 3 : 2]);
      F.ell(12, headCY - 3.4, 6.6, 3.2, HAT, { clip: (x, y) => y <= headCY - 3 });
      if (row !== 0) { F.put(row === 2 ? 18 : 13, headCY - 2, HAT[1]); F.put(row === 2 ? 19 : 12, headCY - 1, HAT[1]); }
    }
    if (t === 'gnome') {
      // tall pointed hat that leans back
      for (let i = 0; i <= 10; i++) {
        const y = headCY - 3 - i, w = Math.max(0, 6.5 - i * 0.62), cx = 12 + (row === 2 ? i * 0.35 : i * 0.18);
        for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
          const tone = x < cx - w * 0.3 ? 3 : x > cx + w * 0.5 ? 1 : 2;
          F.put(x, y, HAT[tone]);
        }
      }
      F.box(5, headCY - 3, 18, headCY - 2, HAT, { tone: 1 });
      if (row === 0) F.put(11, headCY - 6, BRASS[3]);
    }
    if (t === 'hood') {
      F.ell(12, headCY - 0.6, 7.6, 7.0, HAT, { clip: (x, y) => row === 1 ? true : row === 0 ? !(x >= 7 && x <= 16 && y >= headCY - 2) : !(x <= 11 && y >= headCY - 2) });
    }
  };

  // ----- the cast's hats
  const hatX = () => {
    const t = L.hat;
    if (t === 'gnome') {   // a wizard's hat: a band, stars, a star on the tip, goggles
      if (L.hatBand) { F.box(5, headCY - 3, 18, headCY - 2, ramp(L.hatBand)); F.box(5, headCY - 3, 18, headCY - 3, ramp(L.hatBand), { tone: 3 }); }
      if (L.hatStars) {
        const ST = ramp(L.hatStars);
        for (const [x, y] of row === 2 ? [[11, -5], [14, -8], [13, -11], [9, -6]] : [[9, -5], [13, -6], [11, -9], [15, -4], [12, -12]]) {
          const v = F.p[(headCY + y) * PX.FW + x]; if (v && HAT.includes(v)) F.put(x, headCY + y, ST[3]);
        }
      }
      if (L.hatTip === 'star') {
        const cx = Math.round(row === 2 ? 12 + 10 * 0.35 : 12 + (row === 1 ? -1 : 1) * 10 * 0.18) + (row === 2 ? 1 : row === 1 ? -1 : 1), cy = headCY - 13;
        F.put(cx, cy, GOLD[3]); F.put(cx - 1, cy, GOLD[2]); F.put(cx + 1, cy, GOLD[2]); F.put(cx, cy - 1, GOLD[3]); F.put(cx, cy + 1, GOLD[1]);
      }
      if (L.hatGoggles && row !== 1) {
        const gx = row === 2 ? 8 : 15;
        F.ell(gx + 0.5, headCY - 2.5, 1.9, 1.7, BRASS); F.put(gx, headCY - 3, [196, 236, 240]); F.put(gx, headCY - 2, [120, 170, 190]);
        if (row === 0) { F.ell(8.5, headCY - 2.5, 1.5, 1.4, BRASS); F.put(8, headCY - 3, BRASS[0]); }
      }
    }
    if (t === 'witch') {   // a wide brim, a band, a point that flops over; ram's horns or little horns on the band
      const dir = (L.hatTip || -1) * (row === 1 ? -1 : 1), by = headCY - 1, BAND = ramp(L.hatBand || L.hatCol), HN = ramp(L.hornCol || '#efdcc0');
      const HP = { 3: HN[3], 2: HN[2], 1: HN[1], b: BAND[0] };
      const mx = x => dir < 0 ? x : 23 - x;
      F.ell(12, by - 0.5, row === 2 ? (L.brimW || 9.6) - 0.6 : L.brimW || 9.6, 1.6, HAT);
      // the crown, from the band up; the top bends over and its point droops
      const CROWN = row === 2 ? [[8, 15], [9, 15], [9, 15], [11, 17], [14, 19]] : [[8, 15], [8, 14], [7, 13], [5, 11], [3, 8]];
      CROWN.forEach(([a, b], i) => {
        const y = by - 4 - i, x0 = row === 2 ? a : Math.min(mx(a), mx(b)), x1 = row === 2 ? b : Math.max(mx(a), mx(b)), d = row === 2 ? 1 : dir;
        for (let x = x0; x <= x1; x++) F.put(x, y, HAT[x === x0 ? 3 : x === x1 ? 1 : i === 3 && (d < 0 ? x > x0 + 3 : x < x1 - 3) ? 1 : i === 4 ? 3 : 2]);
      });
      if (row === 2) { F.put(20, by - 7, HAT[2]); F.put(21, by - 6, HAT[1]); }
      else { F.put(mx(2), by - 7, HAT[2]); F.put(mx(2), by - 6, HAT[1]); }
      F.box(7, by - 3, 16, by - 2, BAND); F.box(7, by - 3, 16, by - 3, BAND, { tone: 3 });
      if (row === 0 && L.hatBadge === 'moon') { F.put(11, by - 4, GOLD[3]); F.put(12, by - 3, GOLD[3]); F.put(11, by - 3, GOLD[2]); F.put(11, by - 2, GOLD[2]); F.put(12, by - 2, GOLD[1]); }
      if (row === 0 && L.hatBadge === 'buckle') { F.box(10, by - 3, 13, by - 2, GOLD, { flat: true }); F.put(11, by - 3, BAND[0]); F.put(12, by - 2, BAND[0]); F.put(11, by - 2, BAND[1]); }
      if (row === 2 && L.hatBadge) { F.put(8, by - 3, GOLD[3]); F.put(8, by - 2, GOLD[1]); }
      if (L.horns === 'ram') { if (row === 2) F.stamp(10, by - 4, ['.33', '3b2', '21.'], HP); else for (const f of [false, true]) F.stamp(f ? 17 : 4, by - 4, ['.33', '3b2', '21.'], HP, f); }
      if (L.horns === 'small') { if (row === 2) F.stamp(11, by - 7, ['3.', '32', '.1'], HP); else for (const f of [false, true]) F.stamp(f ? 16 : 6, by - 7, ['3.', '32', '.1'], HP, f); }
    }
    if (t === 'jester') {   // a close cap with two drooping points, each with a pompom
      const P = ramp(L.pomCol || L.hatCol), b = col === 1 ? 1 : 0;
      F.ell(12, headCY - 1.8, 7.1, 5.2, HAT, { clip: (x, y) => y <= headCY - 2 || (row !== 0 && (row === 1 || x >= 12)) && y <= headCY + 2, bias: -0.35 });
      const HORN = ['....332.', '..33222.', '.332..21', '.32....1', '322.....', '21......'];
      const pom = (cx, cy) => { F.ell(cx, cy, 1.8, 1.8, P); F.put(Math.floor(cx) - 1, Math.floor(cy) - 1, P[3]); };
      if (row !== 2) { for (const f of [false, true]) F.stamp(f ? 15 : 1, headCY - 10, HORN, HAT, f); pom(2.6, headCY - 2.6 + b); pom(21.4, headCY - 2.6 + (col === 2 ? 1 : 0)); }
      else { F.stamp(3, headCY - 10, HORN, HAT); F.stamp(13, headCY - 10, HORN, HAT, true); pom(4.6, headCY - 2.6 + b); pom(19.4, headCY - 2.6 + (col === 2 ? 1 : 0)); }
    }
    if (t === 'helm') {    // a pointed helm with cheek guards and a big plume of feathers
      const T = ramp(L.helmTrim || '#c09040'), PL = (L.plume || ['#2a6a72', '#e8ecef']).map(ramp);
      // the plume, behind the helm's point: a fan of feathers sweeping out to one side (behind, seen from the side)
      const side = row === 2, flip = row === 1, wv = col === 1 ? 0.7 : col === 2 ? -0.7 : 0, pcx = side ? 13.5 : 9, pcy = headCY - 5.5;
      for (let y = Math.max(0, headCY - 12); y <= headCY + 1; y++) for (let x = 0; x < PX.FW; x++) {
        const xx = flip ? 23 - x : x, dx = (xx + 0.5 - pcx) * (side ? 1 : -1), dy = pcy - (y + 0.5), r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (a < -0.55 || a > 1.45 || r < 1) continue;
        const f = Math.min(4, Math.floor((a + 0.55) / 2.0 * 5)), rr = (side ? 8.4 : 7.6) - Math.abs(f - 1.5) * 0.5 + (f < 2 ? wv : 0) - (f & 1 ? 0.7 : 0);
        if (r > rr) continue;
        F.put(x, y, PL[f % PL.length][r > rr - 1.3 ? 1 : f & 1 ? 3 : 2]);
      }
      F.ell(12, headCY - 1.2, 7.0, 5.8, HAT, { clip: (x, y) => y <= headCY + 3 && (row === 1 || y <= headCY - 2 || (row === 0 ? x <= 6 || x >= 17 : x >= 11)) });
      for (let i = 0; i < 4; i++) { const y = headCY - 7 - i, w = [3, 2, 1, 1][i]; for (let x = 12 - w; x <= 11 + w; x++) F.put(x, y, HAT[x < 12 ? 3 : 1]); }
      if (row === 0) {   // gold trim: the brow, a pointed arch up the front, a blue stone
        F.box(7, headCY - 2, 16, headCY - 2, T, { flat: true });
        F.line(11, headCY - 8, 8, headCY - 3, T[3]); F.line(12, headCY - 8, 15, headCY - 3, T[1]);
        F.put(11, headCY - 9, T[3]); F.put(11, headCY - 4, [120, 200, 255]); F.put(12, headCY - 4, [70, 140, 210]);
        F.put(6, headCY + 3, T[2]); F.put(17, headCY + 3, T[2]);
      }
      if (row === 1) for (let y = headCY - 9; y <= headCY + 2; y++) F.put(12, y, T[2]);
      if (row === 2) { F.box(6, headCY - 2, 11, headCY - 2, T, { flat: true }); F.put(11, headCY + 3, T[2]); for (let y = headCY - 9; y <= headCY - 3; y++) F.put(11 + Math.max(0, headCY - 6 - y > 0 ? 0 : 0), y, T[3]); }
    }
    if (t === 'captain') {   // a peaked cap: puffed crown, band with a badge, a shiny visor, a feather in the band
      const V = ramp('#22202c'), FE = ramp(L.feather || '#f2f0ea');
      if (row !== 2) {
        F.ell(12, headCY - 3.6, 7.6, 3.8, HAT);
        F.box(6, headCY - 2, 17, headCY - 2, HAT, { tone: 1 });
        for (let x = 6; x <= 17; x++) F.put(x, headCY - 3, (x & 1) ? GOLD[1] : HAT[1]);
        if (row === 0) { F.box(7, headCY - 1, 16, headCY - 1, V); F.put(9, headCY - 1, V[3]); F.put(10, headCY - 1, V[3]); F.put(11, headCY - 4, GOLD[3]); F.put(12, headCY - 4, GOLD[2]); F.put(11, headCY - 3, GOLD[2]); F.put(12, headCY - 3, GOLD[1]); }
        const s = row === 1 ? -1 : 1, fx = x => s > 0 ? x : 23 - x;
        F.line(fx(17), headCY - 2, fx(21), headCY - 8, FE[3]); F.line(fx(18), headCY - 2, fx(22), headCY - 7, FE[2]); F.put(fx(17), headCY - 1, FE[1]);
      } else {
        F.ell(12.8, headCY - 3.6, 7.2, 3.8, HAT);
        F.box(7, headCY - 2, 18, headCY - 2, HAT, { tone: 1 });
        for (let x = 7; x <= 18; x++) F.put(x, headCY - 3, (x & 1) ? GOLD[1] : HAT[1]);
        F.box(3, headCY - 1, 8, headCY - 1, V); F.put(4, headCY - 1, V[3]); F.put(7, headCY - 4, GOLD[3]); F.put(7, headCY - 3, GOLD[2]);
        F.line(14, headCY - 2, 19, headCY - 8, FE[3]); F.line(15, headCY - 2, 20, headCY - 7, FE[2]);
      }
    }
  };
  // ----- ears that show: a fox's, an elf's or a gnome's
  const ears = () => {
    if (L.ears === 'fox') {
      const IN = ramp(L.earInner || '#f2d4b8'), E = L.earCol ? ramp(L.earCol) : H, P = { 3: E[3], 2: E[2], 1: E[1], i: IN[2], j: IN[1] };
      if (row === 0) for (const f of [false, true]) F.stamp(f ? 15 : 4, headCY - 11, ['3...', '32..', '2i2.', '2ij1', '2ij1'], P, f);
      if (row === 1) for (const f of [false, true]) F.stamp(f ? 15 : 4, headCY - 11, ['3...', '32..', '232.', '2221', '2211'], P, f);
      if (row === 2) { F.stamp(9, headCY - 10, ['1.', '11'], P); F.stamp(13, headCY - 11, ['..3.', '.32.', '.i22', 'ij21', 'ij21'], P); }
    }
    if (L.ears === 'elf') {
      if (row !== 2) {
        for (const s of [-1, 1]) { const x = s < 0 ? 4 : 19; F.put(x, headCY + 1, S[2]); F.put(x + s, headCY, S[s < 0 ? 3 : 2]); F.put(x, headCY, S[1]); F.put(x + 2 * s, headCY - 1, S[s < 0 ? 3 : 2]); if (row === 0) F.put(x - s, headCY + 1, S[1]); }
      } else { F.put(12, headCY + 2, S[2]); F.put(13, headCY + 1, S[2]); F.put(14, headCY, S[3]); F.put(15, headCY - 1, S[3]); F.put(13, headCY + 2, S[1]); F.put(12, headCY + 3, S[0]); }
    }
  };

  // ----- capes and cloaks
  const capeHem = () => torsoTop + CP.len;
  const tatBottom = (x, hem) => CP.hem === 'tattered' ? hem - 1 + [0, 1, 2, 1][(x + col * 2) & 3] : hem;
  const capeCol = (x, x0) => CRS ? CRS[Math.floor((x - x0) / 2) % CRS.length] : CR;
  const sparkle = (x, y) => CP.sparkle && (x * 7 + y * 5) % 17 === 0;
  // facing the viewer the cape shows behind the arms and legs; its inside is the lining
  const capeFront = () => {
    const hem = capeHem(), fl = CP.flare ?? 2, SP = CP.sparkle ? ramp(CP.sparkle) : null;
    for (let y = torsoTop + 1; y <= hem + 1; y++) {
      const lo = Math.max(0, (y - torsoTop - 2) / Math.max(1, hem - torsoTop - 2));
      const x0 = Math.round(4 - bw - fl * lo) - (col === 1 ? Math.round(lo) : 0), x1 = Math.round(19 + bw + fl * lo) + (col === 2 ? Math.round(lo) : 0);
      for (let x = x0; x <= x1; x++) {
        const bottom = tatBottom(x, hem); if (y > bottom) continue;
        const edge = x <= x0 + 1 || x >= x1 - 1;
        let R = edge ? capeCol(x, x0) : CLN, t = edge ? (x === x0 ? 3 : x === x1 ? 1 : 2) : (x & 1 ? 1 : 0);
        if (y === bottom) t = Math.min(t, 1);
        if (CT && (x === x0 || x === x1 || (y === bottom && edge))) { R = CT; t = x === x1 ? 1 : 2; }
        F.put(x, y, SP && edge && sparkle(x, y) ? SP[3] : R[t]);
      }
    }
  };
  // seen from behind it hangs over the back (and, worn as a cloak, over the shoulders and arms)
  const capeBack = () => {
    const hem = capeHem(), fl = CP.flare ?? 2, SP = CP.sparkle ? ramp(CP.sparkle) : null;
    for (let y = torsoTop; y <= hem + 1; y++) {
      const lo = Math.max(0, (y - torsoBot + 1) / Math.max(1, hem - torsoBot + 1)), s = Math.round(sw1 * lo);
      let x0 = (y === torsoTop ? 8 : 7) - bw, x1 = (y === torsoTop ? 15 : 16) + bw;
      x0 = Math.round(x0 - fl * lo) + s; x1 = Math.round(x1 + fl * lo) + s;
      for (let x = x0; x <= x1; x++) {
        const bottom = tatBottom(x, hem); if (y > bottom) continue;
        let R = capeCol(x, x0), t = x === x0 ? 3 : x === x1 ? 1 : ((x - x0) % 3 === 2 && y > torsoTop + 1) ? 1 : 2;
        if (y === bottom) t = Math.min(t, 1);
        if (CT && (y === bottom || ((x === x0 || x === x1) && y > torsoTop + 1))) { R = CT; t = x === x1 ? 1 : 2; }
        F.put(x, y, SP && sparkle(x, y) ? SP[3] : R[t]);
      }
    }
    if (CP.emblem === 'sun') sunAt(11, torsoTop + 4);
  };
  // from the side it trails behind, and streams out further as they walk
  const capeSide = () => {
    const hem = capeHem(), n = Math.max(1, hem - torsoTop), fl = CP.flare ?? 2, billow = col === 1 ? 2 : col === 2 ? 1 : 0, SP = CP.sparkle ? ramp(CP.sparkle) : null;
    for (let y = torsoTop; y <= hem + 1; y++) {
      const k = (y - torsoTop) / n, x0 = 11, x1 = Math.round(14 + bw + (fl + 3) * Math.sqrt(k) + billow * k);
      for (let x = x0; x <= x1; x++) {
        const bottom = tatBottom(x, hem + (x > 15 ? -Math.round(billow * 0.5) : 0)); if (y > bottom) continue;
        let R = capeCol(x, x0), t = x === x1 ? 1 : ((x1 - x) % 3 === 0 && y > torsoTop + 1) ? 1 : 2;
        if (y === bottom) t = Math.min(t, 1);
        if (CT && (x === x1 || y === bottom) && y > torsoTop + 1) { R = CT; t = 1; }
        F.put(x, y, SP && sparkle(x, y) ? SP[3] : R[t]);
      }
    }
  };
  // worn open as a cloak or long coat: front panels over the body, open down the middle
  const cloakFront = () => {
    const hem = capeHem(), fl = CP.flare ?? 2, SP = CP.sparkle ? ramp(CP.sparkle) : null;
    for (let y = torsoTop; y <= hem + 1; y++) {
      const lo = Math.max(0, (y - torsoTop - 2) / Math.max(1, hem - torsoTop - 2));
      const xo0 = y === torsoTop ? 7 - bw : Math.round(4 - bw - fl * lo) - (col === 1 ? Math.round(lo) : 0);
      const xo1 = y === torsoTop ? 16 + bw : Math.round(19 + bw + fl * lo) + (col === 2 ? Math.round(lo) : 0);
      const xi0 = 9 - Math.round(lo * (CP.openW ?? 1)), xi1 = 14 + Math.round(lo * (CP.openW ?? 1));
      for (const [a, b, left] of [[xo0, xi0, true], [xi1, xo1, false]]) for (let x = a; x <= b; x++) {
        const bottom = tatBottom(x, hem); if (y > bottom) continue;
        let R = capeCol(x, xo0), t = left ? (x === a ? 3 : 2) : (x === b ? 1 : x === a ? 2 : 1);
        if (y === bottom) t = Math.min(t, 1);
        const inner = left ? x === b : x === a;
        if (inner) t = left ? 1 : 2;
        if (CT && (inner || y === bottom)) { R = CT; t = inner ? 2 : 1; }
        F.put(x, y, SP && !inner && sparkle(x, y) ? SP[3] : R[t]);
      }
    }
  };
  // the near side of an open cloak, seen from the side: it covers the body, with the dress showing at the front edge
  const cloakSide = () => {
    const hem = capeHem(), n = Math.max(1, hem - torsoTop), SP = CP.sparkle ? ramp(CP.sparkle) : null;
    for (let y = torsoTop; y <= hem + 1; y++) {
      const k = (y - torsoTop) / n, x0 = Math.round(10 - (10 - Math.min(sfx, sbx) + 0.5) * Math.max(0, k - 0.45) * 1.6), x1 = 14 + bw + Math.round(k * 1.5);
      for (let x = x0; x <= x1; x++) {
        const bottom = tatBottom(x, hem); if (y > bottom) continue;
        let R = capeCol(x, x0), t = x === x0 ? 2 : (x - x0) % 3 === 1 && y > torsoTop + 1 ? 0 : 1;
        if (y === bottom) t = 0;
        if (CT && (x === x0 || y === bottom)) { R = CT; t = x === x0 ? 2 : 1; }
        F.put(x, y, SP && sparkle(x, y) ? SP[3] : R[t]);
      }
    }
  };

  // ----- a crow on the shoulder
  const crow = () => {
    if (L.pet !== 'crow') return;
    const P = { k: [16, 12, 22], d: [30, 27, 42], b: [46, 44, 62], l: [80, 92, 122], y: [112, 106, 100], e: [238, 222, 168] };
    if (row === 0) F.stamp(16 + bw, torsoTop - 6, ['..bb..', '.blbe.', '.dbbyy', 'dbllb.', 'dbllbd', '.dbbdd', '..k.k.'], P);
    if (row === 1) F.stamp(2 - bw, torsoTop - 6, ['..bb..', '.bbbb.', 'yybbd.', '.blbbd', 'dbllbd', 'ddbbd.', '.k.k..'], P);
    if (row === 2) F.stamp(13, torsoTop - 6, ['..bb...', '.ebl...', 'yybbd..', '.bbllbd', '.dbllbd', '..dbbdd', '..k.k..'], P);
  };


  // ----- tools and working arms
  const work = () => {
    if (!working) return;
    const tool = L.tool || 'hammer';
    if (row === 2) {
      // side: arm reaches forward (left); tool swings from high to low
      const sx = 11, sy = torsoTop + 1;
      const hx = up ? 8 : 6, hyy = up ? torsoTop - 2 : torsoBot - 1;
      F.line(sx, sy, hx + 1, hyy + 1, sleeve[2]); F.line(sx + 1, sy, hx + 2, hyy + 1, sleeve[1]);
      drawTool(tool, hx, hyy, up ? -2.3 : -2.6, row);
      F.box(hx, hyy, hx + 1, hyy + 1, HAND);
      return;
    }
    // front/back: left arm rests, right arm works
    const back = row === 1;
    armV(5 - 2 * bw, 6 - bw, torsoTop + 1, torsoBot, -1);
    const hx = (up ? 17 : 15) + bw, hyy = up ? torsoTop - 5 : torsoBot - 1;
    if (up) { F.box(17 + bw, torsoTop - 3, 18 + 2 * bw, torsoTop + 2, sleeve); }
    else { F.box(17 + bw, torsoTop + 1, 18 + 2 * bw, torsoTop + 4, sleeve); F.box(15 + bw, torsoTop + 5, 17 + 2 * bw, torsoBot - 2, sleeve); }
    if (!back) drawTool(tool, hx, hyy, up ? -1.0 : -0.25, row);
    F.box(hx, hyy, hx + 1, hyy + 1, HAND);
    if (back) drawTool(tool, hx, hyy, up ? -1.0 : -0.25, row);
  };
  function drawTool(tool, hx, hy, ang, r) {
    // ang: direction of the tool's working end, radians in screen space (0 = right, -pi/2 = up)
    const c = Math.cos(ang), s = Math.sin(ang);
    const end = (len) => [hx + c * len, hy + s * len];
    if (tool === 'pick') {
      const [ex, ey] = end(8); F.line(hx - c * 2, hy - s * 2, ex, ey, i => OAK[i % 3 === 0 ? 3 : 2]);
      const px = -s, py = c; F.line(ex - px * 3, ey - py * 3, ex + px * 3, ey + py * 3, i => IRON[i < 2 ? 3 : 2]);
      F.put(ex - px * 3 + c, ey - py * 3 + s, IRON[1]);
    } else if (tool === 'hammer') {
      const [ex, ey] = end(6); F.line(hx, hy, ex, ey, OAK[2]);
      const px = -s, py = c; F.line(ex - px * 2, ey - py * 2, ex + px * 2, ey + py * 2, IRON[3]); F.line(ex - px * 2 + c, ey - py * 2 + s, ex + px * 2 + c, ey + py * 2 + s, IRON[1]);
    } else if (tool === 'can') {
      const bx = Math.round(hx + (r === 2 ? -4 : 1)), by = Math.round(hy + 1);
      F.box(bx, by, bx + 4, by + 3, ramp('#c27a44')); F.line(r === 2 ? bx - 1 : bx + 5, by + 1, r === 2 ? bx - 3 : bx + 7, by - 1 + (ang > -0.5 ? 2 : 0), ramp('#c27a44')[1]);
      if (ang > -0.5) { F.put(r === 2 ? bx - 4 : bx + 8, by + 3, [150, 205, 235]); F.put(r === 2 ? bx - 4 : bx + 8, by + 5, [150, 205, 235]); }
    } else if (tool === 'crystal') {
      const cx = Math.round(hx + 0.5), cy = Math.round(hy - 3);
      F.ell(cx + 0.5, cy + 1, 1.8, 3.2, AMB, { bias: 0.4 }); F.put(cx, cy - 1, [255, 248, 220]); F.put(cx, cy, [255, 236, 170]);
    } else if (tool === 'book') {
      const bx = Math.round(hx - (r === 2 ? 4 : 2)), by = Math.round(hy - 2);
      F.box(bx, by, bx + 4, by + 3, ramp('#6b3a5e')); F.box(bx + 1, by, bx + 3, by + 2, ramp('#efe4c8'), { flat: true }); F.put(bx + 2, by + 1, [90, 70, 80]);
    } else if (tool === 'glass') {
      const [ex, ey] = end(5); F.line(hx, hy, ex, ey, i => BRASS[i < 2 ? 3 : 2]); F.put(ex, ey, [190, 230, 240]);
    } else if (tool === 'lance') {
      const [ex, ey] = end(11); F.line(hx - c * 3, hy - s * 3, ex, ey, OAK[2]);
      F.ell(ex + c * 1.5 + 0.5, ey + s * 1.5 + 0.5, 1.4, 1.4, AMB, { bias: 0.5 }); F.put(Math.round(ex + c * 1.5), Math.round(ey + s * 1.5), [255, 245, 210]);
    } else if (tool === 'rope') {
      F.line(hx, hy, hx + (r === 2 ? -1 : 1), hy - 9, ramp('#cdb48a')[2]); F.line(hx, hy, hx + (r === 2 ? 1 : 2), hy + 6, ramp('#cdb48a')[1]);
    } else if (tool === 'wrench') {
      const [ex, ey] = end(6); F.line(hx, hy, ex, ey, IRON[2]); F.put(ex + c, ey + s, IRON[3]); F.put(ex - s, ey + c, IRON[3]); F.put(ex + s, ey - c, IRON[3]);
    } else if (tool === 'sword' || tool === 'dagger') {
      const BL = ramp(L.blade || '#c8ccd4'), ED = ramp(L.bladeEdge || L.blade || '#c8ccd4'), px = -s, py = c;
      const [ex, ey] = end(tool === 'sword' ? 10 : 5);
      F.line(hx + c, hy + s, ex, ey, i => BL[i < 2 ? 2 : 3]); F.line(hx + c + px, hy + s + py, ex + px * 0.6, ey + py * 0.6, ED[2]);
      F.line(hx + c - px * 1.5, hy + s - py * 1.5, hx + c + px * 1.5, hy + s + py * 1.5, GOLD[2]); F.put(hx - c, hy - s, GOLD[1]);
    } else if (tool === 'spell') {   // a spark of magic held up in the hand
      const MG = ramp(L.magic || '#d070ff'), [ex, ey] = end(2.5), x = Math.round(ex), y = Math.round(ey) - 1;
      F.put(x, y, [255, 248, 255]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) F.put(x + dx, y + dy, MG[3]);
      for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) F.put(x + dx, y + dy, MG[1]);
      F.put(x + (up ? 2 : -2), y - 3, MG[3]); F.put(x - 2, y + (up ? 2 : -2), MG[2]); F.put(x + 3, y + 1, MG[2]);
    }
  }

  // ----- compose in painter's order
  // (the cast's extras do nothing for ordinary villagers, so their pictures stay exactly as they were)
  if (row === 2) {
    if (CP) capeSide();
    // far arm behind the body
    if (!working) { const sw = col === 1 ? 2 : col === 2 ? -2 : 0; const far = ramp(mixc(sleeve[2], PLUM, 0.3)); F.box(12 + Math.sign(sw), torsoTop + 2, 13 + Math.sign(sw) + bw, torsoBot - 1, far); }
    legs(); legsX(); skirt(); torso(); torsoX(); armour(); head(); hair(); hairX(); hat(); hatX(); ears();
    if (CP && CP.open) cloakSide();
    arms(); pauldrons(); crow(); work();
  } else if (row === 1) {
    legs(); legsX(); skirt(); torso(); torsoX(); armour();
    if (CP && CP.open) { capeBack(); arms(); } else { arms(); if (CP) capeBack(); }
    pauldrons(); head(); hair(); hairX(); hat(); hatX(); ears(); crow(); work();
  } else {
    if (CP) capeFront();
    hairBackX(); hairBack(); legs(); legsX(); skirt(); torso(); torsoX(); armour();
    if (CP && CP.open) cloakFront();
    arms(); pauldrons(); head(); hair(); hairX(); hat(); hatX(); ears(); crow(); work();
  }
  F.outline();
  return F;
}

// draws one villager's whole sheet into a canvas
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
