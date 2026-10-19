// ===================================================================== WORLD: plateau, face, mine, sky
// Town layout (metres; +x east, +z south toward the cut face)
// Only the headframe is fixed (it sits over the shaft in the cut face). Everything else lives on the build grid.
const LAYOUT = {
  head: { x: 28.5, z: 31.6, w: 7.4, d: 6.4 },
  mast: { x: -31, z: -26.5 },          // where the mast starts on a new claim
  keep: { x: 0, z: -3 },               // and the Keep
  trail: { x: -25, z: 34.4 },          // the rope stair down the cut face, for expeditions (west of the dig)
  dock: { x: 6, z: 0 },                // the Sky Dock's bridge, out over the north rim (z: the rim's edge there)
};
{ let bd = 1e9; for (const [x, z] of OUTLINE) if (z < 0 && Math.abs(x - LAYOUT.dock.x) < bd) { bd = Math.abs(x - LAYOUT.dock.x); LAYOUT.dock.z = z; } }
// where things stood before the grid: used to bring an old save across
const OLD_LAYOUT = { hall: [0, -3], yardA: [-15, 19], yardB: [9.5, 22.5], shop: [19.5, 5], garden: [-21, -15], lens1: [-36, 5], lens2: [31, -18], mast: [-31, -26.5], plotN: [-3, -25], plotE: [33, 15.5] };
const PATHS = [];

// ----------------------------------------------------------------- the build grid: 2 m tiles, Clash-style
// A tile is buildable when it sits well inside the rim wall and clear of the headframe.
const GRID = { T: 2, X0: -48, Z0: -42, NX: 48, NZ: 39 };
GRID.ok = new Uint8Array(GRID.NX * GRID.NZ);
function buildGrid() {
  const { T, X0, Z0, NX, NZ } = GRID, H = LAYOUT.head;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x0 = X0 + i * T, z0 = Z0 + j * T; let ok = 1;
    for (const [x, z] of [[x0, z0], [x0 + T, z0], [x0, z0 + T], [x0 + T, z0 + T], [x0 + 1, z0 + 1]]) if (!onPlateau(x, z) || distToOutline(x, z) < 6.2) { ok = 0; break; }
    if (ok && x0 + T > H.x - H.w / 2 - 3 && x0 < H.x + H.w / 2 + 3 && z0 + T > H.z - H.d / 2 - 3.5) ok = 0;
    if (ok && (dockClear(x0, z0) || dockClear(x0 + T, z0) || dockClear(x0, z0 + T) || dockClear(x0 + T, z0 + T))) ok = 0;
    GRID.ok[j * NX + i] = ok;
  }
}
const tileCenter = (tx, tz, fw, fd) => [GRID.X0 + (tx + fw / 2) * GRID.T, GRID.Z0 + (tz + fd / 2) * GRID.T];
function tileOkAt(x, z) { const i = Math.floor((x - GRID.X0) / GRID.T), j = Math.floor((z - GRID.Z0) / GRID.T); return i >= 0 && j >= 0 && i < GRID.NX && j < GRID.NZ && !!GRID.ok[j * GRID.NX + i]; }

// ----------------------------------------------------------------- ground texture, painted once
let groundCanvas;
function paintGround() {
  const PPM = 2048 / WORLD.WX, W = 2048, H = Math.round(WORLD.WZ * PPM);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const toPx = (x, z) => [(x - WORLD.X0) * PPM, (z - WORLD.Z0) * PPM];
  const pat = (key, metres) => { const p = g.createPattern(IMG[key], 'repeat'); const s = metres * PPM / IMG[key].width; p.setTransform(new DOMMatrix().scale(s, s)); return p; };
  const R = mulberry(77);
  // base turf, with a second, larger scale to break up tiling
  g.fillStyle = pat('turf', 3.2); g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.35; g.fillStyle = pat('turf', 7.5); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  // tonal patches: sun-dried gold and deep green
  for (let i = 0; i < 220; i++) {
    const x = R() * W, y = R() * H, r = (2 + R() * 7) * PPM;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const col = R() < 0.5 ? 'rgba(196,170,92,' : R() < 0.5 ? 'rgba(40,64,30,' : 'rgba(120,140,70,';
    gr.addColorStop(0, col + (0.12 + R() * 0.14) + ')'); gr.addColorStop(1, col + '0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // stony rim near the cliff edge
  g.save();
  const rim = g.createPattern(IMG.rock, 'repeat'); rim.setTransform(new DOMMatrix().scale(3 * PPM / IMG.rock.width, 3 * PPM / IMG.rock.width));
  for (const [w, a] of [[5.5, 0.12], [3.6, 0.3], [2.2, 0.55], [1.1, 0.85]]) {
    g.globalAlpha = a; g.strokeStyle = rim; g.lineWidth = w * PPM; g.lineJoin = 'round';
    g.beginPath(); OUTLINE.forEach(([x, z], i) => { const [px, py] = toPx(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
  }
  g.restore();
  // the headframe's worn yard never moves
  const earth = pat('earth', 3), HD = LAYOUT.head;
  softRect(g, toPx, PPM, HD.x - HD.w / 2 - 1.2, HD.z - HD.d / 2 - 1.2, HD.w + 2.4, HD.d + 2.4, earth, 1.5);
  // the foot of the rope stair down the face
  softRect(g, toPx, PPM, LAYOUT.trail.x - 1.5, LAYOUT.trail.z - 1.2, 3, 2.6, earth, 1);
  // scuffs and pebbles
  for (let i = 0; i < 1600; i++) {
    const x = R() * W, y = R() * H; g.fillStyle = R() < 0.5 ? 'rgba(60,48,34,0.35)' : 'rgba(230,220,190,0.25)'; g.fillRect(x, y, 2 + R() * 2, 2 + R() * 2);
  }
  groundBase = cv;
  groundCanvas = document.createElement('canvas'); groundCanvas.width = W; groundCanvas.height = H;
  groundCanvas.getContext('2d').drawImage(cv, 0, 0);
  GROUND = { PPM, toPx, earth, cobble: pat('cobbles', 4.5), loam: pat('loam', 2.6), ctx: groundCanvas.getContext('2d') };
  return groundCanvas;
}
let groundBase, GROUND;
// a rounded rect with a soft edge
function softRect(g, toPx, PPM, x, z, w, d, fill, r = 1.2, widths = [[1.2, 0.18], [0.5, 0.42], [0, 1]]) {
  g.fillStyle = fill;
  for (const [e, a] of widths) { g.globalAlpha = a; const [px, py] = toPx(x - e, z - e); g.beginPath(); g.roundRect(px, py, (w + 2 * e) * PPM, (d + 2 * e) * PPM, (r + e) * PPM); g.fill(); }
  g.globalAlpha = 1;
}
// Redraw the lawn and the pads under every building. Called whenever the layout changes.
// The lawn inside the wall is mown in alternating 2 m squares, so the build grid reads at a glance.
function repaintGround() {
  if (!GROUND) return;
  const { PPM, toPx, earth, cobble, loam, ctx: g } = GROUND, T = GRID.T;
  g.globalAlpha = 1; g.drawImage(groundBase, 0, 0);
  for (let j = 0; j < GRID.NZ; j++) for (let i = 0; i < GRID.NX; i++) {
    if (!GRID.ok[j * GRID.NX + i]) continue;
    const [px, py] = toPx(GRID.X0 + i * T, GRID.Z0 + j * T);
    g.fillStyle = (i + j) % 2 ? 'rgba(255,248,200,0.035)' : 'rgba(18,40,8,0.03)';
    g.fillRect(px, py, T * PPM + 0.5, T * PPM + 0.5);
  }
  // worn paths: from every building's door to the Keep's, and out to the headframe, the Sky Dock's stair, the mast and
  // the rope stair down the face. They curve a little, the way people actually walk.
  const keep = TOWN.b.keep;
  if (keep && !keep.pending) {
    const door = [keep.L.x, keep.L.z + 5.2], ends = [];
    for (const b of Object.values(TOWN.b)) if (b !== keep && !b.pending && b.L) ends.push([b.L.x, b.L.z + (b.type === 'head' ? -2 : 0)]);
    const D = LAYOUT.dock; ends.push([D.x - 8.6, D.z + 6.2], [LAYOUT.trail.x, LAYOUT.trail.z - 1]);
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [x, z] of ends) {
      const mx = (x + door[0]) / 2, mz = (z + door[1]) / 2, len = Math.hypot(x - door[0], z - door[1]) || 1;
      const bend = (hash2(Math.round(x * 3), Math.round(z * 3)) - 0.5) * len * 0.35, cx = mx - (z - door[1]) / len * bend, cz = mz + (x - door[0]) / len * bend;
      for (const [w, a] of [[2.0, 0.1], [1.35, 0.22], [0.8, 0.38]]) {
        g.globalAlpha = a; g.strokeStyle = earth; g.lineWidth = w * PPM;
        const [ax, ay] = toPx(door[0], door[1]), [bx, by] = toPx(cx, cz), [ex, ey] = toPx(x, z);
        g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(bx, by, ex, ey); g.stroke();
      }
    }
    g.restore(); g.globalAlpha = 1;
  }
  for (const b of Object.values(TOWN.b)) {
    if (!b.tile || b.pending) continue;
    const F = FOOT[b.type], x0 = GRID.X0 + b.tile.tx * T, z0 = GRID.Z0 + b.tile.tz * T, w = F.w * T, d = F.d * T;
    const inset = b.type === 'lens' || b.type === 'ballista' || b.type === 'mast' ? 0.5 : 0.35;
    softRect(g, toPx, PPM, x0 + inset, z0 + inset, w - inset * 2, d - inset * 2, b.type === 'keep' ? cobble : earth, b.type === 'lens' || b.type === 'ballista' ? 1.6 : 1.0, [[0.6, 0.25], [0.25, 0.55], [0, 1]]);
    // a crisp dark edge, the way a Clash base sits on the lawn
    g.strokeStyle = 'rgba(46,30,24,0.32)'; g.lineWidth = 0.14 * PPM;
    const [px, py] = toPx(x0 + inset, z0 + inset); g.beginPath(); g.roundRect(px, py, (w - inset * 2) * PPM, (d - inset * 2) * PPM, (b.type === 'lens' || b.type === 'ballista' ? 1.6 : 1.0) * PPM); g.stroke();
    if (b.type === 'keep') { g.fillStyle = earth; g.globalAlpha = 0.85; const [ax, ay] = toPx(b.L.x - 2.4, b.L.z + 3.7); g.fillRect(ax, ay, 4.8 * PPM, 2.6 * PPM); g.globalAlpha = 1; }
    if (b.type === 'garden') for (let r = 0; r < 4; r++) { g.fillStyle = loam; const [bx, by] = toPx(b.L.x - 6.75, b.L.z + 0.25 + r * 1.15); g.fillRect(bx, by, 6.4 * PPM, 0.8 * PPM); }
  }
  if (worldMats.ground) worldMats.ground.map.needsUpdate = true;
}

// ----------------------------------------------------------------- top, cliffs, face
const FACE_RINGS = [0, -0.45, -1.4, -2.9, -5, -7.8, -11.2, -15.2, -19.8, -25, -31, -38, -46, -56, -70];
let faceEdges = null;   // per ring: [westX, eastX]
const worldMats = {};
function buildPlateau() {
  const groundTex = canvasTex(paintGround());
  // --- top surface
  const shape = new THREE.Shape(OUTLINE.map(([x, z]) => new THREE.Vector2(x, -z)));
  const top = new THREE.ShapeGeometry(shape, 1);
  top.rotateX(-Math.PI / 2);
  const p = top.attributes.position, uv = top.attributes.uv;
  for (let i = 0; i < p.count; i++) { uv.setXY(i, (p.getX(i) - WORLD.X0) / WORLD.WX, 1 - (p.getZ(i) - WORLD.Z0) / WORLD.WZ); }
  worldMats.ground = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.96, metalness: 0, envMapIntensity: 0.25 });
  const topMesh = new THREE.Mesh(top, worldMats.ground); topMesh.receiveShadow = true; topMesh.name = 'ground';
  scene.add(topMesh);

  // --- cliffs: rings hanging from the outline, rough and widening a little before they vanish into cloud
  const P = OUTLINE, n = P.length, rings = FACE_RINGS;
  const arc = [0]; for (let i = 1; i < n; i++) arc.push(arc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = arc[n - 1];
  const normals = P.map((pt, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1;
    let nx = tz / l, nz = -tx / l; if (nx * pt[0] + nz * pt[1] < 0) { nx = -nx; nz = -nz; } return [nx, nz];
  });
  const pos = [], uvs = [], cols = [], idx = [];
  faceEdges = [];
  for (let j = 0; j < rings.length; j++) {
    const y = rings[j], sc = 1 + 0.075 * smooth(0, -26, y) - 0.2 * smooth(-42, -70, y), amp = 0.25 + 3.4 * smooth(0, -30, y);
    for (let i = 0; i < n; i++) {
      const w = smooth(0, 7, Math.min(arc[i], total - arc[i]));
      const d = (fbm(arc[i] / 6.5, y / 5.5 + 3.1, 4) - 0.5) * 2 * amp * w + (j === 1 ? 0.25 : 0) * w;
      let x = P[i][0] * sc + normals[i][0] * d, z = P[i][1] * sc + normals[i][1] * d;
      if (i === 0 || i === n - 1) z = WORLD.faceZ;
      z = Math.min(z, WORLD.faceZ);
      pos.push(x, y, z); uvs.push(arc[i] / 7, y / 7);
      const depthK = 1 - 0.5 * smooth(0, -40, y), band = 0.92 + 0.12 * Math.sin(y * 0.9 + fbm(arc[i] / 20, 0) * 4);
      const k = depthK * band;
      cols.push(k * 1.02, k * 0.96, k * 0.9);
    }
    faceEdges.push([pos[(j * n) * 3], pos[(j * n + n - 1) * 3]]);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  cg.setIndex(idx); cg.computeVertexNormals();
  worldMats.cliff = new THREE.MeshStandardMaterial({ map: tex('rock'), vertexColors: true, roughness: 0.97, envMapIntensity: 0.2, side: THREE.DoubleSide });
  const cliff = new THREE.Mesh(cg, worldMats.cliff); cliff.receiveShadow = true; cliff.castShadow = true;
  scene.add(cliff);

  buildFace();
  buildMineInterior();
  return { topMesh, cliff };
}

// the cut face: painted strata, glowing veins, holes for the mine
let faceMat, veinTex;
function strataCanvas() {
  const W = 1024, H = 1024, X0 = -46, WX = 92, Y0 = 0, HY = 72;     // metres covered
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const vc = document.createElement('canvas'); vc.width = W; vc.height = H; const v = vc.getContext('2d');
  const R = mulberry(4242), sx = W / WX, sy = H / HY;
  // three beds, as the dig meets them: soft gold sandstone (the upper rows), blue-grey slate (the lower rows), and
  // the dark plum rock of the deep
  const bands = [[0, '#4a3524'], [1.1, '#8a6a48'], [2.6, '#b89263'], [5.2, '#a07a52'], [7, '#c4a274'], [9.6, '#9a7c56'], [12.2, '#8a7058'], [14, '#5e626c'], [17.5, '#525866'], [21, '#4a4e5c'], [24, '#3e3446'], [29, '#362c3e'], [40, '#30283a'], [72, '#2c2834']];
  for (let i = 0; i < bands.length - 1; i++) {
    const y0 = bands[i][0], y1 = bands[i + 1][0];
    g.fillStyle = bands[i][1]; g.beginPath();
    g.moveTo(0, y0 * sy);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, (y0 + (fbm(x / 140, y0, 3) - 0.5) * 1.4 * (i ? 1 : 0.3)) * sy);
    for (let x = W; x >= 0; x -= 16) g.lineTo(x, (y1 + (fbm(x / 140, y1, 3) - 0.5) * 1.4) * sy);
    g.fill();
  }
  // rock grain over everything
  const rp = g.createPattern(IMG.rock, 'repeat'); rp.setTransform(new DOMMatrix().scale(4 * sx / IMG.rock.width * 1.0, 4 * sx / IMG.rock.width));
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.85; g.fillStyle = rp; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.45; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // tool marks: the face was cut by hand
  g.strokeStyle = 'rgba(30,22,26,0.22)'; g.lineWidth = 1.2;
  for (let i = 0; i < 520; i++) { const x = R() * W, y = (1.5 + R() * 30) * sy; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 10, y + 6 + R() * 12); g.stroke(); }
  g.strokeStyle = 'rgba(255,240,210,0.08)';
  for (let i = 0; i < 300; i++) { const x = R() * W, y = (1.5 + R() * 40) * sy; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 8, y + 5 + R() * 9); g.stroke(); }
  // grass lip and roots at the top
  g.fillStyle = '#4f6a2c'; g.fillRect(0, 0, W, 0.35 * sy);
  g.strokeStyle = 'rgba(40,28,20,0.6)'; g.lineWidth = 1;
  for (let i = 0; i < 160; i++) { const x = R() * W; g.beginPath(); g.moveTo(x, 0.3 * sy); g.quadraticCurveTo(x + (R() - 0.5) * 20, (0.9 + R()) * sy, x + (R() - 0.5) * 30, (1 + R() * 2.2) * sy); g.stroke(); }
  // sunstone veins: wandering amber seams, densest around the galleries
  v.fillStyle = '#000'; v.fillRect(0, 0, W, H);
  const vein = (x, y, len, w0) => {
    let a = (R() - 0.5) * 0.8 + (R() < 0.5 ? 0 : Math.PI);
    v.lineCap = 'round'; g.lineCap = 'round';
    for (let k = 0; k < len; k++) {
      const nx = x + Math.cos(a) * 6, ny = y + Math.sin(a) * 4, w = w0 * (1 - k / len) + 0.6;
      v.strokeStyle = `rgba(255,${150 + R() * 60 | 0},60,${0.55 + R() * 0.45})`; v.lineWidth = w; v.beginPath(); v.moveTo(x, y); v.lineTo(nx, ny); v.stroke();
      g.strokeStyle = `rgba(255,${170 + R() * 50 | 0},90,0.75)`; g.lineWidth = w * 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      x = nx; y = ny; a += (R() - 0.5) * 0.7;
      if (R() < 0.03) vein(x, y, len * 0.35 | 0, w * 0.6);
    }
  };
  // more of them the deeper the dig goes: a few in the sandstone, many in the slate and the deep
  for (let i = 0; i < 22; i++) { const d = i < 4 ? 4 + R() * 10 : 14 + R() * 22, yy = d * sy, xx = ((MINE.x0 - 4 + R() * (MINE.shaft.x1 - MINE.x0 + 8)) - X0) * sx; vein(xx, yy, 10 + R() * 16 | 0, 1.4 + R() * 1.8); }
  for (let i = 0; i < 5; i++) vein(R() * W, (3 + R() * 36) * sy, 6 + R() * 10 | 0, 1 + R());
  // tiny glints
  for (let i = 0; i < 160; i++) { const x = R() * W, y = (2 + R() * 40) * sy; v.fillStyle = `rgba(255,190,90,${R() * 0.6})`; v.fillRect(x, y, 2, 2); g.fillStyle = 'rgba(255,214,140,0.7)'; g.fillRect(x, y, 2, 2); }
  veinTex = canvasTex(vc, { srgb: true });
  // the painted bed at a depth, to colour things set into the face
  const colorAt = depth => { const i = bands.findIndex(b => b[0] > depth) - 1; return hex3(bands[Math.max(0, i < 0 ? bands.length - 1 : i)][1]); };
  return { color: canvasTex(cv), normal: strataNormal(cv), X0, WX, HY, bands: bands.map(b => b[0]), colorAt, canvas: cv };
}
// the face's relief, read off its own picture: darker rock sits back, pale rock and grain stand out, and the cut
// marks catch the light. A normal map, so the low sun rakes across the strata.
function strataNormal(cv) {
  const W = cv.width, H = cv.height, src = cv.getContext('2d').getImageData(0, 0, W, H).data, h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) h[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.55 + src[i * 4 + 2] * 0.15) / 255;
  // soften once, so it reads as rock and not as noise
  const b = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; b[i] = (h[i] * 4 + h[i - 1] + h[i + 1] + h[i - W] + h[i + W]) / 8; }
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d'), img = g.createImageData(W, H), d = img.data, k = 5.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, l = b[y * W + Math.max(0, x - 1)], r = b[y * W + Math.min(W - 1, x + 1)], u = b[Math.max(0, y - 1) * W + x], dn = b[Math.min(H - 1, y + 1) * W + x];
    let nx = (l - r) * k, ny = (dn - u) * k, nz = 1; const n = Math.hypot(nx, ny, nz); nx /= n; ny /= n; nz /= n;
    d[i * 4] = (nx * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; d[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return canvasTex(out, { srgb: false });
}
let STRATA;
function faceUV(geo) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - STRATA.X0) / STRATA.WX, 1 + p.getY(i) / STRATA.HY);
}
function buildFace() {
  STRATA = strataCanvas();
  const rings = FACE_RINGS, E = faceEdges;
  const outline = [];
  for (let j = 0; j < rings.length; j++) outline.push(new THREE.Vector2(E[j][0], rings[j]));
  for (let j = rings.length - 1; j >= 0; j--) outline.push(new THREE.Vector2(E[j][1], rings[j]));
  const shape = new THREE.Shape(outline);
  shape.holes.push(new THREE.Path(minePolygon().map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.translate(0, 0, WORLD.faceZ);
  faceUV(geo);
  faceMat = new THREE.MeshStandardMaterial({ map: STRATA.color, normalMap: STRATA.normal, normalScale: new THREE.Vector2(1.1, -1.1), emissiveMap: veinTex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.95, envMapIntensity: 0.2 });
  const face = new THREE.Mesh(geo, faceMat); face.receiveShadow = true; face.name = 'face';
  scene.add(face);
  faceRelief();
  // the dig's own rock front (src/claim/mine.js) fills the cut-away rectangle, with a hole for every room
}

// Ledges where the harder beds stand proud of the face, a few boulders, and sunstone breaking out of it in clusters
// along the veins (thickest round the galleries), so the face has real depth and the light catches it
function faceRelief() {
  const R = mulberry(3131), mine = minePolygon(), rockMat = new THREE.MeshStandardMaterial({ map: tex('rock'), vertexColors: true, roughness: 0.97, envMapIntensity: 0.15 });
  const z0 = WORLD.faceZ, ledges = [], crystals = [];
  const edgesAt = y => { let j = 0; while (j < FACE_RINGS.length - 2 && FACE_RINGS[j + 1] > y) j++; const t = (y - FACE_RINGS[j]) / (FACE_RINGS[j + 1] - FACE_RINGS[j]); return [lerp(faceEdges[j][0], faceEdges[j + 1][0], t), lerp(faceEdges[j][1], faceEdges[j + 1][1], t)]; };
  const clear = (x, y, pad) => !pointInPoly(x, y, mine) && !pointInPoly(x - pad, y, mine) && !pointInPoly(x + pad, y, mine) && !pointInPoly(x, y + pad, mine) && !pointInPoly(x, y - pad, mine);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const bedCol = y => { const c = STRATA.colorAt(-y); return [c[0] / 255, c[1] / 255, c[2] / 255]; };
  const paint = (g, col) => { const n = g.attributes.position.count, c = []; for (let i = 0; i < n; i++) { const k = 0.85 + hash2(i, n) * 0.25; c.push(col[0] * k, col[1] * k, col[2] * k); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; };
  for (const by of STRATA.bands.slice(2, 13)) {
    const y = -by, [wx, ex] = edgesAt(y);
    for (let x = wx + 1.5; x < ex - 1.5;) {
      const len = 1 + R() * 3.4, cx = x + len / 2, out = 0.1 + R() * 0.3, th = 0.16 + R() * 0.32;
      if (R() < 0.62 && cx + len / 2 < ex - 1 && clear(cx - len / 2, y, 0.6) && clear(cx + len / 2, y, 0.6) && clear(cx, y, 0.6)) {
        const yy = y + (fbm(cx / 9, by) - 0.5) * 1.2;
        let g = new THREE.BoxGeometry(len, th, out * 2, 4, 2, 1); g = g.toNonIndexed();
        // a broken edge: no two ledges, nor two corners, alike
        const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x0 = p.getX(i), y0 = p.getY(i); const j = hash2(Math.round(x0 * 10 + cx * 7), Math.round(y0 * 10 + by)); p.setXYZ(i, x0 * (0.92 + j * 0.12), y0 * (0.7 + j * 0.6), p.getZ(i) * (0.6 + j * 0.7)); }
        g.computeVertexNormals();
        g.applyMatrix4(m4.compose(new THREE.Vector3(cx, yy, z0), q.setFromEuler(e.set(0, 0, (R() - 0.5) * 0.08)), new THREE.Vector3(1, 1, 1)));
        projUV(g, 2.5); paint(g, bedCol(yy)); ledges.push(g);
      }
      x += len + 0.6 + R() * 3.5;
    }
  }
  for (let i = 0; i < 26; i++) {
    const y = -(1.6 + R() * 38), [wx, ex] = edgesAt(y), x = wx + 2 + R() * (ex - wx - 4), s = 0.35 + R() * 0.9;
    if (!clear(x, y, s + 0.4)) continue;
    let g = new THREE.DodecahedronGeometry(s, 0); g = g.index ? g.toNonIndexed() : g;
    g.applyMatrix4(m4.compose(new THREE.Vector3(x, y, z0 + s * 0.15), q.setFromEuler(e.set(R() * 3, R() * 3, R() * 3)), new THREE.Vector3(1.2, 0.8, 0.6)));
    projUV(g, 1.5); paint(g, bedCol(y).map(c => c * 0.85)); ledges.push(g);
  }
  const lm = new THREE.Mesh(mergeGeometries(ledges), rockMat); lm.castShadow = true; lm.receiveShadow = true; scene.add(lm);
  // sunstone clusters breaking out of the face, mostly near the galleries
  const cMat = new THREE.MeshStandardMaterial({ color: 0xe8902a, emissive: 0xff7a14, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.1, flatShading: true });
  worldMats.faceCrystal = cMat;
  for (let i = 0; i < 22; i++) {
    // mostly round the edges of the dig, where the vein comes out of the rock
    const near = R() < 0.7, side = R() < 0.5, y = near ? (side ? -(3 + R() * 30) : MINE.rowY0(MINE.rows - 1) - 1.6 - R() * 4) : -(2 + R() * 30), [wx, ex] = edgesAt(y);
    const x = near ? (side ? MINE.x0 - 1.5 - R() * 5 : MINE.x0 + R() * (MINE.shaft.x1 - MINE.x0)) : wx + 3 + R() * (ex - wx - 6);
    if (!clear(x, y, 1.2) || x < wx + 1 || x > ex - 1) continue;
    for (let k = 0; k < 3 + R() * 4; k++) {
      const sc = 0.1 + R() * 0.2, g = new THREE.OctahedronGeometry(1, 0);
      g.applyMatrix4(m4.compose(new THREE.Vector3(x + (R() - 0.5) * 0.7, y + (R() - 0.5) * 0.5, z0 + 0.05), q.setFromEuler(e.set(Math.PI / 2 - 0.4 + (R() - 0.5) * 0.9, 0, (R() - 0.5) * 1.6)), new THREE.Vector3(sc * 0.55, sc * 1.9, sc * 0.55)));
      crystals.push(g.index ? g.toNonIndexed() : g);
    }
  }
  if (crystals.length) { const cm = new THREE.Mesh(mergeGeometries(crystals), cMat); cm.castShadow = true; scene.add(cm); }
}

// the mine's shared glows: the lantern on the headframe, and the sunstone breaking out of the rock. The rooms of the
// dig themselves are built by src/claim/mine.js.
function buildMineInterior() {
  worldMats.mineGlow = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45a, emissiveIntensity: 2.2 });
  worldMats.mineCrystal = new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff8a24, emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.1, flatShading: true });
}

// ----------------------------------------------------------------- sky, clouds, far peaks
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uMoon: { value: new THREE.Vector3() }, uTime: { value: 0 } };
function buildSky() {
  const geo = new THREE.SphereGeometry(1100, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uTop, uHor, uSun, uSunCol, uMoon; uniform float uNight, uTime; varying vec3 vDir;
      float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, -0.2);
        vec3 col = mix(uHor, uTop, pow(clamp(y,0.0,1.0), 0.55));
        // a warm band just above the cloud sea
        col += uSunCol * 0.18 * exp(-abs(d.y+0.02)*14.0) * (1.0-uNight*0.7);
        float sd = max(dot(d, normalize(uSun)), 0.0);
        col += uSunCol * (pow(sd, 900.0)*14.0 + pow(sd, 18.0)*0.45 + pow(sd,3.0)*0.12);
        // the Thinning: a faint iridescent veil very high up
        float veil = smoothstep(0.55,0.75,d.y)*(1.0-smoothstep(0.8,1.0,d.y));
        col += veil * 0.06 * vec3(0.6+0.4*sin(d.x*9.0+uTime*0.05), 0.7, 0.9+0.1*cos(d.z*7.0)) * (0.4+uNight);
        // stars and moon
        if(uNight > 0.01){
          vec3 g = floor(d*320.0); float s = h3(g); float tw = 0.6+0.4*sin(uTime*2.0+s*40.0);
          col += vec3(0.85,0.9,1.0) * step(0.9965, s) * tw * uNight * smoothstep(0.0,0.25,d.y) * 1.4;
          float md = max(dot(d, normalize(uMoon)), 0.0);
          col += vec3(0.85,0.9,1.0) * (smoothstep(0.99955,0.9997,md)*1.6 + pow(md,60.0)*0.25) * uNight;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  return sky;
}
const cloudU = { uTime: { value: 0 }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() } };
function buildClouds() {
  const mk = (y, scale, alpha, seed) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...cloudU, uScale: { value: scale }, uAlpha: { value: alpha }, uSeed: { value: seed } }, transparent: true, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform float uTime, uScale, uAlpha, uSeed; uniform vec3 uLit, uShade, uFog, uSun; varying vec3 vW;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          vec2 p = vW.xz/uScale + vec2(uTime*0.004, uTime*0.0015) + uSeed;
          float c = fbm(p) ; float c2 = fbm(p*2.3 + 4.0 - uTime*0.003);
          float dens = smoothstep(0.34, 0.74, c*0.78 + c2*0.36);
          vec2 e = vec2(0.02, 0.0);
          float shade = clamp(0.5 + (fbm(p - normalize(uSun.xz+0.0001)*0.06) - c)*6.0, 0.0, 1.0);
          vec3 col = mix(uShade, uLit, clamp(shade*0.75 + dens*0.45 - 0.12, 0.0, 1.0));
          float dist = length(vW.xz - cameraPosition.xz);
          float fade = 1.0 - smoothstep(380.0, 1000.0, dist);
          col = mix(col, uFog, smoothstep(150.0, 900.0, dist)*0.85);
          gl_FragColor = vec4(col, dens * uAlpha * fade);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = -5; scene.add(m); return m;
  };
  // a solid floor of cloud, a broken layer above it, and drifting puffs that hug the cliffs
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -52; scene.add(floor); worldMats.cloudFloor = floor.material;
  const a = mk(-44, 140, 0.95, 0.0), b = mk(-36, 90, 0.75, 13.0);
  // soft billboards around the base of the plateau
  const pc = document.createElement('canvas'); pc.width = pc.height = 128; const g = pc.getContext('2d');
  for (let i = 0; i < 14; i++) { const x = 30 + Math.random() * 68, y = 40 + Math.random() * 48, r = 18 + Math.random() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const puffTex = canvasTex(pc);
  const puffs = [];
  worldMats.puff = new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.85, fog: true });
  for (let i = 0; i < 26; i++) {
    const ang = i / 26 * TAU + Math.random() * 0.2, r = 46 + Math.random() * 20;
    const s = new THREE.Sprite(worldMats.puff);
    s.position.set(Math.cos(ang) * r, -34 - Math.random() * 10, Math.sin(ang) * r * 0.85 + 2); s.scale.set(48 + Math.random() * 30, 22 + Math.random() * 10, 1);
    s.userData.ang = ang; s.userData.r = r; scene.add(s); puffs.push(s);
  }
  return { a, b, puffs };
}
// The Ironspire Peaks round the claim: iron-grey spires with ridges and gullies, rust in their streaks, snow on every
// ledge high enough to hold it, and a few flat-topped mesas like this one, further off in the haze
function buildPeaks() {
  const R = mulberry(5150), group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.1 });
  worldMats.peaks = mat;
  const spire = (h, r, seed, mesa) => {
    const SEG = 30, RINGS = 22, pos = [], idx = [];
    for (let j = 0; j <= RINGS; j++) {
      const t = j / RINGS;
      for (let i = 0; i <= SEG; i++) {
        const a = i / SEG * TAU, ca = Math.cos(a), sa = Math.sin(a);
        // ridges: a few sharp ribs running up the spire, and gullies between
        const rib = Math.pow(Math.abs(Math.sin(a * 2.5 + seed + t * 1.3)), 0.6), n = fbm(ca * 2 + seed, sa * 2 + t * 3.2, 4);
        let k = mesa ? (t < 0.82 ? 1 - t * 0.28 : lerp(0.77, 0.0, (t - 0.82) / 0.18)) : Math.pow(1 - t, 1.25);
        k *= 0.72 + rib * 0.22 + (n - 0.5) * 0.5;
        const y = mesa && t >= 0.82 ? h * (0.82 + (t - 0.82) * 0.12) : t * h;
        pos.push(ca * r * Math.max(0.02, k), y + (fbm(ca * 5 + seed, sa * 5 + t * 7, 2) - 0.5) * h * 0.04, sa * r * Math.max(0.02, k));
      }
    }
    for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) { const a = j * (SEG + 1) + i, b = a + SEG + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // colour: iron grey, rusty streaks low down, green on a mesa's top, snow where it's high and flat enough
    const p = g.attributes.position, nrm = g.attributes.normal, cols = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / h, up = nrm.getY(i);
      const streak = fbm(x * 0.08 + seed, y * 0.02, 3), base = 0.3 + fbm(x * 0.05, z * 0.05 + y * 0.03, 3) * 0.12;
      let c = [base * 0.95, base, base * 1.12];
      c = [lerp(c[0], 0.46, smooth(0.55, 0.75, streak) * (1 - t) * 0.8), lerp(c[1], 0.3, smooth(0.55, 0.75, streak) * (1 - t) * 0.8), lerp(c[2], 0.22, smooth(0.55, 0.75, streak) * (1 - t) * 0.8)];
      if (mesa && t > 0.8 && up > 0.6) c = [0.32, 0.42, 0.22];
      const snow = mesa ? 0 : smooth(0.45, 0.7, up + (t - 0.7) * 1.2 + (fbm(x * 0.2, z * 0.2) - 0.5) * 0.5) * smooth(0.5, 0.68, t);
      cols.push(lerp(c[0], 0.93, snow), lerp(c[1], 0.95, snow), lerp(c[2], 1.0, snow));
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  };
  for (let i = 0; i < 22; i++) {
    const ang = i / 22 * TAU + R() * 0.2, mesa = i % 6 === 3, dist = (mesa ? 520 : 300) + R() * (mesa ? 220 : 280);
    if (Math.abs(((ang + Math.PI) % TAU) - Math.PI - Math.PI / 2) < 0.28 && dist < 420) continue;   // keep the view south clear
    const h = mesa ? 90 + R() * 60 : 110 + R() * 190, r = mesa ? 60 + R() * 50 : h * (0.28 + R() * 0.2);
    const m = new THREE.Mesh(spire(h, r, i * 7.3, mesa), mat);
    m.position.set(Math.cos(ang) * dist, -70 - R() * 30, Math.sin(ang) * dist); m.rotation.y = R() * TAU;
    group.add(m);
  }
  scene.add(group);
  return group;
}

// ----------------------------------------------------------------- lights and the hours of the day
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 320 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 2.5;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x6a5a40, 0.6); scene.add(hemi);
scene.fog = new THREE.Fog(0xcfd8e0, 220, 1250);

// time of day t in [0,1): 0 = first light, ~0.05 sunrise, 0.64 sunset, 0.7 full night, 0.97 pre-dawn
const SKY_KEYS = [
  // t,    zenith,    horizon,   sun colour, sunI, hemiSky,  hemiGnd,  hemiI, fog,       exposure, cloudLit, cloudShade
  [0.00, '#2a3456', '#c48a7a', '#ff9a66', 0.0, '#4a5680', '#2a2430', 0.25, '#8a7a8a', 0.95, '#f2b7a0', '#5a5a7a'],
  [0.05, '#4d6fa0', '#ffbd8a', '#ffb070', 1.6, '#9ab0d8', '#5a4a3a', 0.45, '#e7b8a0', 1.0, '#ffd2b0', '#8a8aa8'],
  [0.15, '#4f86c6', '#cfe2f0', '#fff0d8', 3.0, '#bfd6ff', '#6a5a40', 0.6, '#c8d8e6', 1.0, '#ffffff', '#8e9ab4'],
  [0.35, '#3f7cc4', '#d8e8f4', '#fffaf0', 3.4, '#c6dcff', '#6e5e44', 0.65, '#d0dde8', 1.0, '#ffffff', '#93a0b8'],
  [0.55, '#4a80c0', '#f0dcc0', '#ffe2b8', 2.9, '#c0d0f0', '#6a5640', 0.6, '#e0d4c4', 1.0, '#fff4e4', '#9a98ac'],
  [0.63, '#3b4f86', '#ff9e6a', '#ff8a4a', 1.4, '#8a90c0', '#5a4038', 0.45, '#e09a7a', 1.02, '#ffb88a', '#7a6a8a'],
  [0.69, '#1c2244', '#6a4a6e', '#ff6a4a', 0.0, '#3a4270', '#2a2030', 0.3, '#3a3450', 1.05, '#8a6a8a', '#2a2a46'],
  [0.78, '#0b1028', '#26304e', '#9ab0ff', 0.55, '#2a3868', '#141420', 0.24, '#1c2238', 1.1, '#4a5a80', '#141a30'],
  [0.92, '#0c122c', '#2a3352', '#9ab0ff', 0.5, '#2a3868', '#141420', 0.24, '#1e2440', 1.1, '#4a5a80', '#141a30'],
  [1.00, '#2a3456', '#c48a7a', '#ff9a66', 0.0, '#4a5680', '#2a2430', 0.25, '#8a7a8a', 0.95, '#f2b7a0', '#5a5a7a'],
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function keyLerp(t, col) {
  let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= t) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], k = smooth(0, 1, (t - a[0]) / (b[0] - a[0]));
  if (typeof a[col] === 'number') return lerp(a[col], b[col], k);
  return _c1.set(a[col]).lerp(_c2.set(b[col]), k).clone();
}
const TOD = { t: 0.12, night: 0, sunlight: 1, phase: 'day' };
function dayPhase(t) { return t < 0.05 ? 'dawn' : t < 0.6 ? 'day' : t < 0.69 ? 'dusk' : t < 0.96 ? 'night' : 'dawn'; }
function applyTimeOfDay(t, time) {
  TOD.t = t;
  // sun travels east → south → west across the day portion
  const dayK = clamp((t - 0.02) / (0.67 - 0.02), 0, 1), sunAng = dayK * Math.PI;
  const elev = Math.sin(sunAng) * 1.05 + (dayK <= 0 || dayK >= 1 ? -0.3 : 0);
  const sunDir = new THREE.Vector3(Math.cos(sunAng), Math.max(0.05, elev), 0.45 + Math.sin(sunAng) * 0.5).normalize();
  const nightK = t > 0.67 ? (t - 0.67) / 0.33 : 0;
  const moonDir = new THREE.Vector3(Math.cos(nightK * Math.PI), 0.25 + Math.sin(nightK * Math.PI) * 0.8, 0.6).normalize();
  const night = t < 0.03 ? 1 - t / 0.03 * 0.6 : t < 0.06 ? 0.4 - (t - 0.03) / 0.03 * 0.4 : smooth(0.6, 0.72, t) * (1 - smooth(0.95, 1.0, t)) + (t > 0.97 ? smooth(0.97, 1, t) : 0);
  TOD.night = clamp(night, 0, 1);
  TOD.sunlight = clamp(Math.sin(sunAng) * 1.6, 0, 1) * (t < 0.66 ? 1 : 0);
  TOD.phase = dayPhase(t);
  const useMoon = TOD.night > 0.5;
  const ld = useMoon ? moonDir : sunDir;
  sun.position.copy(ld).multiplyScalar(160); sun.target.position.set(0, 0, 0);
  sun.color.copy(keyLerp(t, 3)); sun.intensity = keyLerp(t, 4);
  hemi.color.copy(keyLerp(t, 5)); hemi.groundColor.copy(keyLerp(t, 6)); hemi.intensity = keyLerp(t, 7);
  scene.fog.color.copy(keyLerp(t, 8));
  renderer.toneMappingExposure = keyLerp(t, 9);
  skyU.uTop.value.copy(keyLerp(t, 1)); skyU.uHor.value.copy(keyLerp(t, 2));
  skyU.uSun.value.copy(sunDir); skyU.uSunCol.value.copy(keyLerp(t, 3)).multiplyScalar(TOD.night > 0.6 ? 0 : 1);
  skyU.uMoon.value.copy(moonDir); skyU.uNight.value = TOD.night; skyU.uTime.value = time;
  cloudU.uLit.value.copy(keyLerp(t, 10)); cloudU.uShade.value.copy(keyLerp(t, 11)); cloudU.uFog.value.copy(keyLerp(t, 8)); cloudU.uSun.value.copy(ld); cloudU.uTime.value = time;
  if (worldMats.cloudFloor) worldMats.cloudFloor.color.copy(keyLerp(t, 11)).multiplyScalar(0.82);
  if (worldMats.puff) worldMats.puff.color.copy(keyLerp(t, 11)).lerp(keyLerp(t, 10), 0.5);
  if (worldMats.clumps) for (const m of worldMats.clumps) m.emissiveIntensity = 0.06 + TOD.night * 0.3;
  const envK = lerp(1, 0.18, TOD.night);
  for (const m of ENV_MATS) m.envMapIntensity = m.userData.env * envK;
  if (bloom) { bloom.strength = lerp(0.42, 0.95, TOD.night); bloom.threshold = lerp(0.88, 0.62, TOD.night); }
}
const ENV_MATS = [];
function trackEnv(m, k) { if (!m.envMap) m.envMap = envTex; m.envMapIntensity = k; m.userData.env = k; ENV_MATS.push(m); return m; }
// three r163+ scales only a material's own envMap by envMapIntensity; the scene's environment ignores it. Give every
// lit material the environment directly, so each one's intensity holds (as it did when the claim was first built).
function fixEnv(root) { root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if ((m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) && !m.envMap) { m.envMap = envTex; m.needsUpdate = true; } }); }
