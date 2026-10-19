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
function drawVillagerFrame(L, row, col) {
  const F = new PixFrame();
  const S = ramp(L.skin), H = ramp(L.hair), SH = ramp(L.shirt), OV = ramp(L.overCol), PA = ramp(L.pants), BO = ramp(L.boots);
  const HAT = ramp(L.hatCol || '#5a3a26'), BRASS = ramp('#c99a3c'), IRON = ramp('#7d8590'), OAK = ramp('#8a5a34'), AMB = ramp('#ffb347');
  const g = L.gnome ? 1 : 0;
  const working = col >= 3, up = col === 3;
  const bob = (col === 1 || col === 2) ? 1 : 0;
  const hy = g ? 3 : 0;                    // gnomes: head sits lower on a shorter body
  const headCY = 10 + hy + bob, headRX = 6.6, headRY = 6.2;
  const torsoTop = (g ? 20 : 17) + bob, torsoBot = 25;
  const ink = [43, 29, 42];
  const eyeC = [36, 26, 40], blush = mixc(S[2], [222, 110, 110], 0.35);

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

  // ----- torso and clothes
  const torso = () => {
    if (row !== 2) {
      F.box(7, torsoTop + 1, 16, torsoBot, SH); F.box(8, torsoTop, 15, torsoTop, SH, { tone: 3 });
      if (L.over === 'vest') { F.box(7, torsoTop + 1, 10, torsoBot - 1, OV); F.box(13, torsoTop + 1, 16, torsoBot - 1, OV); if (row === 1) F.box(7, torsoTop + 1, 16, torsoBot - 1, OV); }
      if (L.over === 'apron') { F.box(8, torsoTop + 3, 15, torsoBot + 3, OV, { noBottom: false }); if (row === 0) { F.put(9, torsoTop + 1, OV[1]); F.put(14, torsoTop + 1, OV[1]); F.put(11, torsoTop + 5, OV[3]); F.put(12, torsoTop + 5, OV[3]); } if (row === 1) F.box(7, torsoTop + 4, 16, torsoTop + 4, OV, { tone: 1 }); }
      if (L.over === 'coat') { F.box(6, torsoTop + 1, 17, torsoBot + 2, OV); if (row === 0) { F.box(11, torsoTop + 1, 12, torsoBot + 2, SH, { tone: 2 }); F.put(10, torsoTop + 3, BRASS[3]); F.put(10, torsoTop + 6, BRASS[3]); } }
      if (L.over === 'overalls') { F.box(8, torsoTop + 3, 15, torsoBot, OV); F.put(9, torsoTop + 1, OV[2]); F.put(9, torsoTop + 2, OV[2]); F.put(14, torsoTop + 1, OV[2]); F.put(14, torsoTop + 2, OV[2]); if (row === 0) { F.put(9, torsoTop + 3, BRASS[3]); F.put(14, torsoTop + 3, BRASS[3]); } }
      // belt
      if (L.over !== 'coat' && L.over !== 'overalls') { F.box(7, torsoBot - 1, 16, torsoBot - 1, ramp('#4a3226'), { flat: true }); if (row === 0) F.put(11, torsoBot - 1, BRASS[3]); }
      if (L.scarf) { F.box(8, torsoTop, 15, torsoTop + 1, ramp(L.scarf)); if (row === 0) { F.put(14, torsoTop + 2, ramp(L.scarf)[1]); F.put(14, torsoTop + 3, ramp(L.scarf)[1]); } }
      if (L.satchel && row === 0) { F.line(8, torsoTop + 1, 15, torsoBot - 2, ramp('#5a3a26')[1]); F.box(14, torsoBot - 3, 17, torsoBot, ramp('#7a5234')); }
    } else {
      F.box(9, torsoTop + 1, 14, torsoBot, SH); F.box(10, torsoTop, 13, torsoTop, SH, { tone: 3 });
      if (L.over === 'vest') F.box(11, torsoTop + 1, 14, torsoBot - 1, OV);
      if (L.over === 'apron') F.box(8, torsoTop + 3, 10, torsoBot + 3, OV);
      if (L.over === 'coat') { F.box(9, torsoTop + 1, 15, torsoBot + 2, OV); }
      if (L.over === 'overalls') F.box(9, torsoTop + 3, 14, torsoBot, OV);
      if (L.over !== 'coat' && L.over !== 'overalls') F.box(9, torsoBot - 1, 14, torsoBot - 1, ramp('#4a3226'), { flat: true });
      if (L.scarf) F.box(9, torsoTop, 14, torsoTop + 1, ramp(L.scarf));
      if (L.satchel) F.box(13, torsoBot - 3, 16, torsoBot, ramp('#7a5234'));
    }
  };

  // ----- arms (idle / walking)
  const sleeve = L.over === 'coat' ? OV : SH;
  const arms = () => {
    if (working) return;
    if (row !== 2) {
      const sa = col === 1 ? 1 : col === 2 ? -1 : 0;
      F.box(5, torsoTop + 1 + sa, 6, torsoBot - 2 + sa, sleeve); F.box(5, torsoBot - 1 + sa, 6, torsoBot + sa, S);
      F.box(17, torsoTop + 1 - sa, 18, torsoBot - 2 - sa, sleeve); F.box(17, torsoBot - 1 - sa, 18, torsoBot - sa, S);
    } else {
      const sw = col === 1 ? -2 : col === 2 ? 2 : 0;
      F.box(11, torsoTop + 1, 12, torsoBot - 3, sleeve);
      F.box(11 + Math.sign(sw), torsoBot - 2, 12 + Math.sign(sw), torsoBot - 1, sleeve);
      F.box(11 + sw / 2 * 1, torsoBot, 12 + sw / 2, torsoBot + 1, S);
    }
  };

  // ----- head
  const head = () => {
    F.box(10, torsoTop - 1, 13, torsoTop, S, { tone: 1 });
    F.ell(12, headCY, headRX, headRY, S);
    if (row === 0) {
      // big chibi eyes: highlight top-left, iris bottom-right
      const ey = headCY + 1, iris = L.eyes ? hex3(L.eyes) : [70, 50, 40];
      for (const x of [8, 14]) {
        F.put(x, ey, [250, 246, 236]); F.put(x + 1, ey, eyeC);
        F.put(x, ey + 1, eyeC); F.put(x + 1, ey + 1, mixc(iris, eyeC, 0.25));
      }
      F.put(7, ey + 2, blush); F.put(16, ey + 2, blush);
      F.put(11, ey + 3, mixc(S[1], [150, 60, 60], 0.25)); F.put(12, ey + 3, mixc(S[1], [150, 60, 60], 0.25));
      if (L.glasses) { const G = BRASS[2]; for (const cx of [8, 14]) { F.put(cx - 1, ey, G); F.put(cx + 2, ey, G); F.put(cx - 1, ey + 1, G); F.put(cx + 2, ey + 1, G); F.put(cx, ey - 1, G); F.put(cx + 1, ey - 1, G); F.put(cx, ey + 2, G); F.put(cx + 1, ey + 2, G); } F.put(11, ey, G); F.put(12, ey, G); }
    } else if (row === 2) {
      const ey = headCY + 1, iris = L.eyes ? hex3(L.eyes) : [70, 50, 40];
      F.put(7, ey, [250, 246, 236]); F.put(8, ey, eyeC); F.put(7, ey + 1, eyeC); F.put(8, ey + 1, mixc(iris, eyeC, 0.25));
      F.put(5, ey + 2, S[3]);     // nose
      F.put(9, ey + 2, blush);
      F.put(6, ey + 4, mixc(S[1], [150, 60, 60], 0.25));
      if (L.glasses) { const G = BRASS[2]; F.put(6, ey, G); F.put(6, ey + 1, G); F.put(9, ey, G); F.put(9, ey + 1, G); F.put(7, ey - 1, G); F.put(8, ey - 1, G); F.put(7, ey + 2, G); F.put(8, ey + 2, G); F.put(10, ey, G); F.put(11, ey, G); }
      F.put(12, ey + 1, S[1]); F.put(12, ey + 2, S[0]); F.put(11, ey + 1, S[2]);    // ear
    }
    if (L.beard) {
      const B = H;
      if (row === 0) { F.ell(12, headCY + 5, 5.4, 3.6 + (g ? 2.5 : 0), B, { clip: (x, y) => y >= headCY + 3 }); F.put(11, headCY + 4, S[1]); F.put(12, headCY + 4, S[1]); }
      if (row === 2) F.ell(9, headCY + 5, 3.6, 3 + (g ? 2.5 : 0), B, { clip: (x, y) => y >= headCY + 3 && x <= 11 });
    }
  };

  // ----- hair: drawn as pieces relative to the head
  const hairBack = () => {   // the part that hangs behind the shoulders (front view)
    if (row === 0 && (L.hairStyle === 'long' || L.hairStyle === 'braids')) {
      if (L.hairStyle === 'long') { F.box(5, headCY + 2, 7, headCY + 10, H); F.box(16, headCY + 2, 18, headCY + 10, H); }
      else { F.box(5, headCY + 4, 6, headCY + 12, H); F.box(17, headCY + 4, 18, headCY + 12, H); F.put(5, headCY + 13, ramp(L.scarf || '#c76b3a')[2]); F.put(18, headCY + 13, ramp(L.scarf || '#c76b3a')[2]); }
    }
  };
  const hair = () => {
    const st = L.hairStyle, top = headCY - headRY;
    if (st === 'bald') { if (row !== 0) F.ell(12, headCY - 1, 6.4, 5, H, { clip: (x, y) => y > headCY + 1 - (row === 1 ? 0 : 3) && (row === 1 || x > 11) }); return; }
    if (row === 1) {   // from behind: hair covers the head
      const ry = st === 'crop' || st === 'curly' ? 5.6 : 6.4;
      F.ell(12, headCY - (st === 'crop' ? 1 : 0), st === 'curly' ? 7.6 : 6.9, st === 'curly' ? 6.8 : ry + 0.6, H);
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
      F.ell(12, headCY - 1.6, capR, st === 'curly' ? 5.6 : 5.2, H, { clip: (x, y) => y <= headCY - 2 + (x < 7 || x > 16 ? 4 : 0) });
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
    F.ell(12.6, headCY - 1.2, st === 'curly' ? 7.4 : 6.7, st === 'curly' ? 6.2 : 5.6, H, { clip: (x, y) => y <= headCY - 2 || x >= 12 + (y > headCY + 2 ? -1 : 0) });
    for (const x of [7, 8, 9]) F.put(x, headCY - 2, H[2]);
    if (st === 'long') F.box(12, headCY + 1, 18, headCY + 10, H);
    if (st === 'bob') F.box(13, headCY + 1, 18, headCY + 4, H);
    if (st === 'braids') { F.box(15, headCY + 3, 16, headCY + 12, H); }
    if (st === 'ponytail') { F.box(18, headCY - 1, 19, headCY + 6, H); F.put(17, headCY - 1, H[2]); }
    if (st === 'bun') F.ell(16, top + 1.2, 2.4, 2.2, H);
    strands(H, headCY - 3);
  };
  function strands(R, y) { for (const [dx, dy] of [[-3, 0], [-2, 1], [1, -1], [2, 0], [4, 1]]) if (F.has(12 + dx, y + dy)) F.put(12 + dx, y + dy, R[3]); }

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
      F.box(hx, hyy, hx + 1, hyy + 1, S);
      return;
    }
    // front/back: left arm rests, right arm works
    const back = row === 1;
    F.box(5, torsoTop + 1, 6, torsoBot - 2, sleeve); F.box(5, torsoBot - 1, 6, torsoBot, S);
    const hx = up ? 17 : 15, hyy = up ? torsoTop - 5 : torsoBot - 1;
    if (up) { F.box(17, torsoTop - 3, 18, torsoTop + 2, sleeve); }
    else { F.box(17, torsoTop + 1, 18, torsoTop + 4, sleeve); F.box(15, torsoTop + 5, 17, torsoBot - 2, sleeve); }
    if (!back) drawTool(tool, hx, hyy, up ? -1.0 : -0.25, row);
    F.box(hx, hyy, hx + 1, hyy + 1, S);
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
    }
  }

  // ----- compose in painter's order
  if (row === 2) {
    // far arm behind the body
    if (!working) { const sw = col === 1 ? 2 : col === 2 ? -2 : 0; const far = ramp(mixc(sleeve[2], PLUM, 0.3)); F.box(12 + Math.sign(sw), torsoTop + 2, 13 + Math.sign(sw), torsoBot - 1, far); }
    legs(); torso(); head(); hair(); hat(); arms(); work();
  } else if (row === 1) {
    legs(); torso(); arms(); head(); hair(); hat(); work();
  } else {
    hairBack(); legs(); torso(); arms(); head(); hair(); hat(); work();
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
