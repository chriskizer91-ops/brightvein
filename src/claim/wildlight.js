// ===================================================================== WILDLIGHT: creatures of loose sunstone light
// Each one is a fox drawn in a few hundred jittering strokes that "boil" a few times a second,
// rendered as screen-space ribbons and added onto the scene as light.
const WL = { list: [], uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uFrame: { value: 0 }, uPx: { value: 1 } }, night: null, flow: null, flowT: 0 };
const STROKE_VS = `
  uniform vec2 uRes; uniform float uFrame; uniform float uPx; uniform float uWidth;
  attribute vec3 aPrev; attribute vec3 aNext; attribute vec3 aInfo;
  varying float vU; varying float vSide; varying float vSeed;
  vec3 h3(float s){ return fract(sin(vec3(s, s+1.37, s+2.71)*vec3(12.9898,78.233,37.719))*43758.5453) - 0.5; }
  void main(){
    float side = aInfo.x, u = aInfo.y, seed = aInfo.z;
    vec3 J = h3(seed*1.731 + uFrame*17.13)*0.035 + h3(seed*2.917 + uFrame*9.71)*0.03*(u-0.5);
    vec4 c = projectionMatrix * modelViewMatrix * vec4(position + J, 1.0);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(aPrev + J, 1.0);
    vec4 n = projectionMatrix * modelViewMatrix * vec4(aNext + J, 1.0);
    vec2 hr = uRes*0.5, sc = c.xy/c.w*hr, sp = p.xy/p.w*hr, sn = n.xy/n.w*hr;
    vec2 d = sn - sp; float L = length(d); vec2 dir = L < 1e-4 ? vec2(1.0,0.0) : d/L;
    vec2 nrm = vec2(-dir.y, dir.x);
    float persp = clamp(28.0 / c.w, 0.55, 1.8);
    float w = uWidth * uPx * persp * (0.35 + 0.65*sin(3.14159*clamp(u,0.0,1.0)));
    sc += nrm * side * w;
    gl_Position = vec4(sc/hr*c.w, c.z, c.w);
    vU = u; vSide = side; vSeed = seed;
  }`;
const STROKE_FS = `
  uniform vec3 uCol; uniform float uAlpha; uniform float uDissolve;
  varying float vU; varying float vSide; varying float vSeed;
  void main(){
    float edge = 1.0 - abs(vSide); edge = smoothstep(0.0, 0.9, edge);
    float cut = step(fract(vSeed*7.31), 1.0 - uDissolve);
    gl_FragColor = vec4(uCol * (0.7 + 0.6*edge), edge * uAlpha * cut);
  }`;
// fox anatomy: capsules [bone, a, b, ra, rb]; nose toward +x, ground at y = 0
const FOX_PARTS = [
  ['body', [-0.55, 0.78, 0], [0.32, 0.74, 0], 0.24, 0.22], ['body', [0.32, 0.72, 0], [0.55, 0.64, 0], 0.21, 0.17],
  ['body', [0.48, 0.78, 0], [0.74, 0.98, 0], 0.15, 0.12],
  ['head', [0.0, 0.0, 0], [0.18, -0.03, 0], 0.15, 0.13], ['head', [0.16, -0.05, 0], [0.44, -0.13, 0], 0.08, 0.02],
  ['head', [0.06, 0.08, 0.08], [0.1, 0.34, 0.11], 0.07, 0.01], ['head', [0.06, 0.08, -0.08], [0.1, 0.34, -0.11], 0.07, 0.01],
  ['tail', [0, 0, 0], [-0.35, 0.12, 0], 0.13, 0.15], ['tail', [-0.35, 0.12, 0], [-0.72, 0.16, 0], 0.15, 0.11], ['tail', [-0.72, 0.16, 0], [-0.96, 0.08, 0], 0.11, 0.03],
  ['legFL', [0, 0, 0], [0.06, -0.32, 0], 0.08, 0.05], ['legFL', [0.06, -0.32, 0], [0.04, -0.62, 0], 0.05, 0.035],
  ['legFR', [0, 0, 0], [0.06, -0.32, 0], 0.08, 0.05], ['legFR', [0.06, -0.32, 0], [0.04, -0.62, 0], 0.05, 0.035],
  ['legBL', [0, 0, 0], [0.12, -0.3, 0], 0.11, 0.06], ['legBL', [0.12, -0.3, 0], [-0.04, -0.62, 0], 0.06, 0.035],
  ['legBR', [0, 0, 0], [0.12, -0.3, 0], 0.11, 0.06], ['legBR', [0.12, -0.3, 0], [-0.04, -0.62, 0], 0.06, 0.035],
];
const FOX_BONES = { body: [0, 0, 0], head: [0.76, 1.0, 0], tail: [-0.62, 0.82, 0], legFL: [0.42, 0.64, 0.1], legFR: [0.42, 0.64, -0.1], legBL: [-0.42, 0.66, 0.11], legBR: [-0.42, 0.66, -0.11] };
let FOX_GEO = null;
function buildFoxGeometry() {
  const R = mulberry(4711), byBone = {};
  const v3 = (a) => new THREE.Vector3(...a);
  for (const [bone, a, b, ra, rb] of FOX_PARTS) {
    const A = v3(a), B = v3(b), ax = B.clone().sub(A), L = ax.length(), dir = ax.clone().normalize();
    const u = new THREE.Vector3(0, 0, 1).cross(dir); if (u.lengthSq() < 1e-4) u.set(0, 1, 0); u.normalize();
    const w = dir.clone().cross(u).normalize();
    const strokes = byBone[bone] || (byBone[bone] = []);
    const n = Math.round(6 + L * 10 + (ra + rb) * 14);
    for (let s = 0; s < n; s++) {
      const ring = R() < 0.4, pts = [];
      const t0 = R(), phi0 = R() * TAU, span = ring ? 1.4 + R() * 2.2 : 0.35 + R() * 0.55, len = ring ? 0 : 0.4 + R() * 0.7;
      const N = 9;
      for (let k = 0; k < N; k++) {
        const f = k / (N - 1);
        const t = clamp(ring ? t0 + (R() - 0.5) * 0.05 : t0 - len / 2 + f * len, -0.08, 1.08);
        const phi = ring ? phi0 + f * span : phi0 + (f - 0.5) * span * 0.5;
        const r = lerp(ra, rb, clamp(t, 0, 1)) * (1.0 + (R() - 0.5) * 0.12);
        pts.push(A.clone().addScaledVector(dir, t * L).addScaledVector(u, Math.cos(phi) * r).addScaledVector(w, Math.sin(phi) * r * (bone === 'body' ? 0.75 : 1)));
      }
      strokes.push(pts);
    }
  }
  // turn stroke polylines into ribbon geometry per bone
  FOX_GEO = {};
  for (const [bone, strokes] of Object.entries(byBone)) {
    const pos = [], prev = [], next = [], info = [], idx = [];
    let base = 0;
    for (const pts of strokes) {
      const seed = R() * 1000;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k], pp = pts[Math.max(0, k - 1)], pn = pts[Math.min(pts.length - 1, k + 1)], u = k / (pts.length - 1);
        for (const side of [-1, 1]) { pos.push(p.x, p.y, p.z); prev.push(pp.x, pp.y, pp.z); next.push(pn.x, pn.y, pn.z); info.push(side, u, seed); }
        if (k < pts.length - 1) { const i = base + k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
      }
      base += pts.length * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aPrev', new THREE.Float32BufferAttribute(prev, 3));
    g.setAttribute('aNext', new THREE.Float32BufferAttribute(next, 3)); g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3)); g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.5);
    FOX_GEO[bone] = g;
  }
}
const wlGlowTex = radialTex('rgba(255,200,120,0.9)', 'rgba(255,140,40,0)', 64);
class Wildlight {
  constructor(route) {
    if (!FOX_GEO) buildFoxGeometry();
    this.uni = { ...WL.uniforms, uCol: { value: new THREE.Color(1.15, 0.62, 0.24) }, uAlpha: { value: 0.85 }, uDissolve: { value: 1 }, uWidth: { value: 1.25 } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: STROKE_VS, fragmentShader: STROKE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mat = mat;
    this.root = new THREE.Group(); this.bones = {};
    for (const [k, p] of Object.entries(FOX_BONES)) {
      const o = new THREE.Group(); o.position.set(...p); (k === 'body' ? this.root : this.bones.body).add(o); this.bones[k] = o;
      if (k === 'body') { const m = new THREE.Mesh(FOX_GEO.body, mat); m.frustumCulled = false; o.add(m); }
    }
    for (const k of Object.keys(FOX_BONES)) if (k !== 'body') { const m = new THREE.Mesh(FOX_GEO[k], mat); m.frustumCulled = false; this.bones[k].add(m); }
    // the head bone's geometry is authored around its own pivot; others around theirs
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: wlGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, color: 0xffb060 }));
    glow.scale.set(2.6, 1.8, 1); glow.position.set(0, 0.8, 0); this.root.add(glow); this.glow = glow;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: wlGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
    pool.position.y = 0.05; this.root.add(pool); this.pool = pool;
    scene.add(this.root);
    this.pos = route[0].clone(); this.route = route.slice(1); this.mode = 'route';
    this.hp = 26 + GAME.nights * 6; this.maxHp = this.hp; this.speed = 3.0 + Math.random() * 0.8;
    this.phase = Math.random() * 10; this.dead = false; this.born = 0; this.vel = new THREE.Vector3(1, 0, 0); this.target = null; this.feed = 0;
    this.root.position.copy(this.pos);
  }
  hurt(n, src) {
    if (this.dead) return;
    this.hp -= n * (castPerk('halcyon') ? 1.2 : 1); this.flash = 0.15;   // Seraphine's vigil
    if (this.hp <= 0) this.die(true);
  }
  die(killed) {
    if (this.dead) return;
    this.dead = true; this.dying = 0;
    FX.sparks(this.pos.clone().setY(this.pos.y + 0.8), killed ? 26 : 14, 0xffc070, 3.5);
    AUDIO.play('poof');
    if (killed) { WL.night && WL.night.downed++; GAME.ore += 2; wildlightDrop(this); }
  }
  update(dt) {
    this.born = Math.min(1, this.born + dt * 1.5);
    if (this.dead) {
      this.dying += dt * 1.6; this.uni.uDissolve.value = clamp(this.dying, 0, 1); this.uni.uAlpha.value = 0.85 * (1 - this.dying);
      this.glow.material.opacity = 0.55 * (1 - this.dying); this.pool.material.opacity = 0.35 * (1 - this.dying);
      this.root.position.y += dt * 0.6;
      return this.dying < 1;
    }
    this.uni.uDissolve.value = 1 - this.born;
    // movement
    let moving = true;
    if (this.mode === 'route') {
      const tgt = this.route[0];
      const d = tgt.clone().sub(this.pos), L = d.length();
      if (L < 0.12) { this.route.shift(); if (!this.route.length) this.mode = 'hunt'; }
      else { const step = Math.min(L, (this.climb ? 2.4 : this.speed) * dt); this.pos.addScaledVector(d.normalize(), step); if (Math.abs(d.y) > 0.6 * Math.hypot(d.x, d.z)) this.climbing = true; else { this.climbing = false; this.vel.set(d.x, 0, d.z).normalize(); } }
    } else if (this.mode === 'hunt') {
      moving = huntStep(this, dt);
    }
    // pose
    this.phase += dt * (moving ? this.speed * 3.2 : 2);
    const s = this.phase, run = moving ? 1 : 0.15;
    const B = this.bones;
    B.legFL.rotation.z = Math.sin(s) * 0.75 * run; B.legFR.rotation.z = Math.sin(s + 0.6) * 0.75 * run;
    B.legBL.rotation.z = Math.sin(s + Math.PI) * 0.8 * run; B.legBR.rotation.z = Math.sin(s + Math.PI + 0.6) * 0.8 * run;
    B.body.position.y = Math.abs(Math.sin(s)) * 0.08 * run;
    B.body.rotation.z = this.climbing ? 1.1 : Math.sin(s * 2) * 0.03 * run;
    B.tail.rotation.y = Math.sin(s * 0.5) * 0.35; B.tail.rotation.z = 0.15 + Math.sin(s) * 0.12 * run;
    B.head.rotation.z = Math.sin(s * 2) * 0.05 + (this.feeding ? -0.5 : 0);
    const yaw = Math.atan2(-this.vel.z, this.vel.x);
    let dy = yaw - this.root.rotation.y; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
    this.root.rotation.y += dy * Math.min(1, dt * 8);
    this.root.position.copy(this.pos);
    if (this.flash > 0) { this.flash -= dt; this.uni.uCol.value.setRGB(2.0, 1.6, 1.2); } else this.uni.uCol.value.setRGB(1.15, 0.62, 0.24);
    this.glow.material.opacity = 0.32 + Math.sin(s * 3) * 0.06;
    this.pool.visible = this.pos.y > -0.5;
    return true;
  }
}

// ----------------------------------------------------------------- what they hunt: the flow field over the grid
function lightTargets() {
  const T = [];
  for (const L of DECOR.lamps) if (L.lit && POWER.on) T.push({ kind: 'lamp', L, x: L.x, z: L.z });
  for (const b of Object.values(TOWN.b)) {
    if (b.type === 'yard' && b.level > 0 && !b.pending) T.push({ kind: 'yard', b, x: b.L.x, z: b.L.z, r: 3 });
    if (b.type === 'keep') { const p = b.worldPos(0, 0, 5.2); T.push({ kind: 'hall', b, x: p.x, z: p.z, r: 2 }); }
  }
  return T;
}
function computeFlow() {
  const GX = NAV.GX, n = GX * NAV.GZ, dist = WL.dist || (WL.dist = new Float32Array(n));
  dist.fill(1e9);
  const heap = [];
  const push = (k, d) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const targets = lightTargets(); WL.targets = targets;
  for (const t of targets) { const [ix, iz] = cellIx(t.x, t.z); if (inGrid(ix, iz)) { const k = iz * GX + ix; dist[k] = 0; push(k, 0); } }
  const costAt = k => { const w = NAV.wall[k]; if (w >= 0) return WALL.segs[w].broken ? 1 : 14; const c = NAV.cost[k]; if (c > 0) return Math.min(c, 2); const [x, z] = cellC(k % GX, (k / GX) | 0); return onPlateau(x, z) ? 7 : 0; };
  while (heap.length) {
    const [d, k] = pop(); if (d > dist[k]) continue;
    const kx = k % GX, kz = (k / GX) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = kx + dx, nz = kz + dz; if (!inGrid(nx, nz)) continue;
      const m = nz * GX + nx, c = costAt(m); if (!c) continue;
      const nd = d + c * (dx && dz ? 1.414 : 1); if (nd < dist[m]) { dist[m] = nd; push(m, nd); }
    }
  }
}
function huntStep(f, dt) {
  const GX = NAV.GX, [ix, iz] = cellIx(f.pos.x, f.pos.z);
  if (!inGrid(ix, iz)) return false;
  // feeding on a target?
  const near = (WL.targets || []).find(t => Math.hypot(t.x - f.pos.x, t.z - f.pos.z) < (t.r || 1.3));
  if (near) {
    f.feeding = true; f.feed += dt;
    if (near.kind === 'lamp') { if (f.feed > 1.2) { near.L.lit = false; WL.night && WL.night.lamps++; FX.sparks(new THREE.Vector3(near.x, 2.9, near.z), 10); f.feed = 0; f.feeding = false; WL.flowT = 0; } }
    else { const take = Math.min(GAME.shards, 4 * dt); GAME.shards -= take; WL.night && (WL.night.drained += take); if (near.b) near.b.drainK = 1; if (f.feed > 3.5) { f.die(false); } }
    return false;
  }
  f.feeding = false;
  // chewing through a wall?
  const k0 = iz * GX + ix, w = NAV.wall[k0];
  if (w >= 0 && !WALL.segs[w].broken) {
    const s = WALL.segs[w]; s.hp -= dt * (TOWN.wallLevel >= 2 ? 0.035 : 0.085);
    if (Math.random() < dt * 4) FX.puff(f.pos.clone().setY(1.2), 1, 0xb0a080);
    if (s.hp <= 0) { s.broken = true; s.hp = 0; wallMatrices(); buildNav(); WL.flowT = 0; AUDIO.play('crack'); WL.night && WL.night.walls++; toast('Wildlight has broken through the wall.', 'night'); }
    return true;
  }
  // descend the field
  let best = k0, bd = WL.dist ? WL.dist[k0] : 1e9;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = ix + dx, nz = iz + dz; if (!inGrid(nx, nz)) continue; const m = nz * GX + nx; if (WL.dist[m] < bd) { bd = WL.dist[m]; best = m; } }
  let [tx, tz] = cellC(best % GX, (best / GX) | 0);
  if (!WL.dist || WL.dist[k0] > 1e8) { tx = f.pos.x * 0.9; tz = f.pos.z * 0.9; }   // stranded off the field: head inward
  const d = new THREE.Vector3(tx - f.pos.x, 0, tz - f.pos.z);
  // keep apart from each other a little
  for (const o of WL.list) if (o !== f && !o.dead) { const ox = f.pos.x - o.pos.x, oz = f.pos.z - o.pos.z, L = Math.hypot(ox, oz); if (L < 1.4 && L > 0.01) { d.x += ox / L * 0.6; d.z += oz / L * 0.6; } }
  if (d.lengthSq() < 0.0004) return false;
  d.normalize(); f.vel.lerp(d, Math.min(1, dt * 6)).normalize();
  f.pos.addScaledVector(f.vel, f.speed * dt); f.pos.y = Math.max(0, f.pos.y - dt * 4);
  return true;
}

// ----------------------------------------------------------------- where they come from
function seamRoute() {
  const z = SHAFT_Z, G = MINE.g2;
  return [new THREE.Vector3(G.x0 + 0.4, G.y0, WORLD.faceZ - 2.3), new THREE.Vector3(G.x0 + 1.5, G.y0, z), new THREE.Vector3(SHAFT_X, G.y0, z), new THREE.Vector3(SHAFT_X, 0.3, z), HEAD_ENTRY(), TOWN.b.head.worldPos(0, 0, -4.5)];
}
function cliffRoute() {
  const loop = OUTLINE, i = 6 + (Math.random() * (loop.length - 12) | 0), [x, z] = loop[i];
  const c = Math.hypot(x, z) || 1, ox = x / c, oz = z / c;
  return [new THREE.Vector3(x + ox * 1.2, -7, z + oz * 1.2), new THREE.Vector3(x + ox * 0.3, -0.2, z + oz * 0.3), new THREE.Vector3(x - ox * 1.6, 0, z - oz * 1.6)];
}
function startNight() {
  GAME.nights++;
  const deep = TOWN.b.head.level >= 2;
  const n = Math.min(24, Math.round(3 + (GAME.nights - 1) * 1.8 + (deep ? 4 : 0)));
  WL.night = { n, spawned: 0, downed: 0, drained: 0, lamps: 0, walls: 0, deep, times: Array.from({ length: n }, () => 0.71 + Math.random() * 0.2).sort() };
  toast(deep ? `Night ${GAME.nights}. <b>The deep seam is glowing.</b> Wildlight will come from below as well.` : `Night ${GAME.nights}. Watch the rim: Wildlight climbs the cliffs.`, 'night');
  AUDIO.play('bell');
}
function endNight() {
  const N = WL.night; if (!N) return;
  for (const f of WL.list) if (!f.dead) f.die(false);
  for (const L of DECOR.lamps) L.lit = true;
  const parts = [`<b>Dawn.</b> ${N.downed} of ${N.spawned} Wildlight brought down`];
  if (N.drained > 0.5) parts.push(`${Math.round(N.drained)} shards drained`);
  if (N.lamps) parts.push(`${N.lamps} lamps snuffed`);
  if (N.walls) parts.push(`${N.walls} wall breaches`);
  toast(parts.join(', ') + '.');
  AUDIO.play('dawn');
  WL.night = null;
}
function spawnWildlight() {
  const N = WL.night, deep = N.deep;
  const route = deep && Math.random() < 0.45 ? seamRoute() : cliffRoute();
  const f = new Wildlight(route); f.from = route.length > 3 ? 'seam' : 'cliff';
  WL.list.push(f); N.spawned++;
  if (f.from === 'seam' && Math.random() < 0.5) FX.sparks(route[0].clone().setY(route[0].y + 1), 16);
}

// ----------------------------------------------------------------- defenders
const BEAMS = [];
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
function fireBeam(from, to, col = 0xffd08a, k = 1) {
  const len = from.distanceTo(to);
  for (const [r0, op] of [[0.08, 1], [0.32, 0.35]]) {
    const r = r0 * k;
    const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.material.color.multiplyScalar(2.2);
    m.position.copy(from); m.lookAt(to); m.scale.set(r, r, len); scene.add(m); BEAMS.push({ m, t: 0, dur: 0.32, op });
  }
  FX.sparks(to.clone(), k < 1 ? 4 : 8, 0xfff0c0, 2.5);
}
const FLARES = [];
const flareTex = radialTex('rgba(255,240,200,1)', 'rgba(255,160,60,0)', 64);
function towerAI(dt) {
  for (const b of TOWN.towers) {
    if (!b.level || b.pending) continue;
    const crew = workersOf(b.id).filter(v => v.working);
    b.coreMat.emissiveIntensity = lerp(b.coreMat.emissiveIntensity, crew.length ? 0.8 + TOD.night * 1.2 : 0.2, dt * 3);
    const raid = jumpersActive();   // by day the crews run up to the towers when jumpers come
    if (!crew.length && !(raid && workersOf(b.id).length) || (TOD.night < 0.4 && !raid)) { b.cool = 0; continue; }
    const range = turretRange(b), muzzle = new THREE.Vector3(); b.muzzle.getWorldPosition(muzzle);
    let best = null, bd = range;
    for (const f of WL.list) { if (f.dead || f.pos.y < -2) continue; const d = Math.hypot(f.pos.x - muzzle.x, f.pos.z - muzzle.z); if (d < bd) { bd = d; best = f; } }
    // swing the head toward the target, or sweep slowly
    const head = b.head, gp = new THREE.Vector3(); head.getWorldPosition(gp);
    const want = best ? Math.atan2(best.pos.x - gp.x, best.pos.z - gp.z) - b.group.rotation.y : Math.sin(performance.now() / 2600 + b.L.x) * 1.4 + Math.PI;
    let dy = want - head.rotation.y; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
    head.rotation.y += dy * Math.min(1, dt * 5);
    if (best) b.tilt.rotation.x = lerp(b.tilt.rotation.x, Math.atan2(7.5 - best.pos.y, bd) * 0.9, dt * 5);
    b.cool = (b.cool || 0) - dt;
    if (best && b.cool <= 0 && Math.abs(dy) < 0.25 && GAME.shards >= 1) {
      const agi = (crew.length ? crew : workersOf(b.id)).reduce((s, v) => s + statOf(v, 'A'), 0);
      b.cool = (b.level >= 2 ? 1.1 : 1.7) / (0.6 + agi * 0.06);
      GAME.shards -= 1;
      const to = best.pos.clone(); to.y += 0.7;
      fireBeam(muzzle, to); best.hurt(15 + (b.level >= 2 ? 5 : 0));
      b.coreMat.emissiveIntensity = 4;
      AUDIO.play('zap');
    }
  }
}
// ---- turret reach, drawn on the ground in build mode and while a turret is selected
const turretRange = b => (b.type === 'lens' ? (b.level >= 2 ? 27 : 21) : (b.level >= 2 ? 17 : 14)) * (1 + modV(b, 'range') / 100);   // modV: a tower's Fresnel Ring (fittings.js)
const RING_G = { line: new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), fill: new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2) };
function updateRings() {
  for (const b of [...TOWN.towers, ...TOWN.ballistas]) {
    if (!b.ring) {
      const col = b.type === 'lens' ? 0xffcf85 : 0xd8e4ff, g = new THREE.Group();
      g.add(new THREE.Mesh(RING_G.line, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })));
      g.add(new THREE.Mesh(RING_G.fill, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, depthWrite: false, toneMapped: false })));
      g.renderOrder = 4; g.children.forEach(m => m.renderOrder = 4); scene.add(g); b.ring = g;
    }
    const sel = (BUILD.on && (BUILD.sel === b || (BUILD.drag && BUILD.drag.b === b))) || (!BUILD.on && UI.cur && UI.cur.kind === 'building' && UI.cur.ref === b);
    b.ring.visible = VIEW.mode === 'town' && (BUILD.on || sel) && b.group.parent === scene;
    const r = turretRange(b); b.ring.position.set(b.L.x, 0.12, b.L.z); b.ring.scale.set(r, 1, r);
    b.ring.children[0].material.opacity = sel ? 0.95 : 0.4; b.ring.children[1].material.opacity = sel ? 0.1 : 0.035;
  }
}
// the ballistas need no crew: they wind themselves by day and loose a bolt at anything in reach
const BOLTS = [];
const boltGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5).rotateX(Math.PI / 2);
function ballistaAI(dt) {
  for (const b of TOWN.ballistas) {
    if (!b.level || b.pending || b.building) continue;
    const range = turretRange(b), muzzle = new THREE.Vector3(); b.muzzle.getWorldPosition(muzzle);
    let best = null, bd = range;
    for (const f of WL.list) { if (f.dead || f.pos.y < -2) continue; const d = Math.hypot(f.pos.x - muzzle.x, f.pos.z - muzzle.z); if (d < bd) { bd = d; best = f; } }
    const head = b.head;
    const want = best ? Math.atan2(best.pos.x - b.L.x, best.pos.z - b.L.z) : TOD.night > 0.4 ? Math.sin(performance.now() / 3100 + b.L.x) * 1.2 : head.rotation.y;
    let dy = want - head.rotation.y; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
    head.rotation.y += dy * Math.min(1, dt * 4);
    b.tilt.rotation.x = lerp(b.tilt.rotation.x, best ? -Math.atan2(best.pos.y + 0.6 - 1.9, bd) * 0.8 : 0, dt * 4);
    b.cool = (b.cool || 0) - dt;
    if (best && b.cool <= 0 && Math.abs(dy) < 0.3) {
      b.cool = b.level >= 2 ? 1.6 : 2.1;
      const m = new THREE.Mesh(boltGeo, MAT.iron); m.position.copy(muzzle); m.lookAt(best.pos.x, best.pos.y + 0.6, best.pos.z); scene.add(m);
      BOLTS.push({ m, from: muzzle.clone(), target: best, t: 0, dur: Math.max(0.12, bd / 45), dmg: b.level >= 2 ? 14 : 10 });
      AUDIO.play('thunk');
    }
  }
  for (let i = BOLTS.length - 1; i >= 0; i--) {
    const B = BOLTS[i]; B.t += dt / B.dur;
    const to = B.target.pos.clone(); to.y += 0.6;
    B.m.position.lerpVectors(B.from, to, Math.min(1, B.t)); B.m.lookAt(to);
    if (B.t >= 1) { if (!B.target.dead) B.target.hurt(B.dmg); FX.sparks(to, 6, 0xd8c8a8, 2); scene.remove(B.m); BOLTS.splice(i, 1); }
  }
}
function watchAI() {
  if (!WL.list.length) return;
  for (const v of GAME.villagers) {
    if (v.hidden || v.where !== 'surface' || v.d.exp) continue;
    let nearest = null, nd = 1e9;
    for (const f of WL.list) { if (f.dead || f.air || f.pos.y < -1) continue; const d = Math.hypot(f.pos.x - v.pos.x, f.pos.z - v.pos.z); if (d < nd) { nd = d; nearest = f; } }
    if (!nearest) continue;
    const isWatch = v.d.job && v.d.job.bid === 'wall';
    if (isWatch) { if (nd < 18 && (!v.plan[0] || v.plan[0].type !== 'chase')) v.plan = [{ type: 'chase', target: nearest, t: 9 }]; }
    else if (v.d.trait !== 'Bold' && nd < (v.d.trait === 'Skittish' ? 13 : 6.5) && !(v.plan[0] && v.plan[0].run)) {
      v.plan = [walkTo(v, homeEntry(v), { run: true }), { type: 'enter' }, { type: 'wait', t: 14 }, { type: 'warp', to: homeEntry(v), then: () => { v.where = 'surface'; v.setHidden(false); } }];
    }
  }
}
// ----------------------------------------------------------------- the Lark on patrol
const SHIP = { state: 'docked', t: 0, ang: 0, cool: 0 };
function shipAI(dt, time) {
  const S = TOWN.ship, ship = S.ship, crew = GAME.villagers.filter(v => v.where === 'ship');
  const night = TOD.night > 0.55;
  S.liftMat.emissiveIntensity = 1.0 + Math.sin(time * 2) * 0.25 + TOD.night * 1.2;
  S.lantMat.emissiveIntensity = 0.6 + TOD.night * 2.4;
  S.light.intensity = TOD.night * 30;
  S.flag.rotation.y = Math.sin(time * 3) * 0.3;
  const C = new THREE.Vector3(0, 23, -2), R = 31;
  if (SHIP.state === 'docked') {
    ship.position.copy(S.home); ship.position.y += Math.sin(time * 0.8) * 0.15; ship.rotation.set(Math.sin(time * 0.6) * 0.02, Math.PI / 2, Math.sin(time * 0.7) * 0.015);
    S.prop.rotation.x += dt * 1.5;
    if (crew.length && ((night && WL.night) || jumpersActive())) { SHIP.state = 'lift'; SHIP.t = 0; SHIP.from = ship.position.clone(); SHIP.ang = Math.atan2(S.home.z - C.z, S.home.x - C.x); toast('<b>The Lark</b> casts off to patrol the rim.'); }
  } else if (SHIP.state === 'lift' || SHIP.state === 'return') {
    SHIP.t += dt / 5;
    const k = smooth(0, 1, SHIP.t);
    const circle = new THREE.Vector3(C.x + Math.cos(SHIP.ang) * R, C.y, C.z + Math.sin(SHIP.ang) * R);
    const a = SHIP.state === 'lift' ? SHIP.from : circle, b = SHIP.state === 'lift' ? circle : S.home;
    ship.position.lerpVectors(a, b, k); ship.position.y += Math.sin(k * Math.PI) * 3;
    const tang = SHIP.state === 'lift' ? -SHIP.ang : Math.PI / 2;
    ship.rotation.y = lerp(ship.rotation.y, SHIP.state === 'lift' ? -SHIP.ang - Math.PI / 2 + Math.PI : Math.PI / 2, dt * 1.5);
    void tang;
    S.prop.rotation.x += dt * 14;
    if (SHIP.t >= 1) SHIP.state = SHIP.state === 'lift' ? 'patrol' : 'docked';
  } else if (SHIP.state === 'patrol') {
    SHIP.ang += dt * 0.16;
    ship.position.set(C.x + Math.cos(SHIP.ang) * R, C.y + Math.sin(time * 0.7) * 0.6, C.z + Math.sin(SHIP.ang) * R);
    ship.rotation.set(0, -SHIP.ang, -0.06);
    S.prop.rotation.x += dt * 14;
    SHIP.cool -= dt;
    if (SHIP.cool <= 0 && GAME.shards >= 1) {
      let best = null, bd = 34;
      for (const f of WL.list) { if (f.dead) continue; const d = f.pos.distanceTo(ship.position); if (d < bd) { bd = d; best = f; } }
      if (best) {
        const agi = crew.reduce((s, v) => s + statOf(v, 'A'), 0);
        SHIP.cool = 2.6 / (0.5 + agi * 0.07); GAME.shards -= 1;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffd090 }));
        sp.scale.set(1.4, 1.4, 1); sp.position.copy(ship.position); scene.add(sp);
        FLARES.push({ sp, target: best, t: 0, from: ship.position.clone() });
        AUDIO.play('flare');
      }
    }
    if (!crew.length || (!(night && WL.night) && !jumpersActive())) { SHIP.state = 'return'; SHIP.t = 0; }
  }
}
function updateDefenders(dt, time) {
  for (let i = BEAMS.length - 1; i >= 0; i--) { const B = BEAMS[i]; B.t += dt; B.m.material.opacity = B.op * (1 - B.t / B.dur); if (B.t >= B.dur) { scene.remove(B.m); B.m.material.dispose(); BEAMS.splice(i, 1); } }
  for (let i = FLARES.length - 1; i >= 0; i--) {
    const F = FLARES[i]; F.t += dt / 0.7;
    const to = F.target.pos.clone(); to.y += 0.7;
    F.sp.position.lerpVectors(F.from, to, Math.min(1, F.t)); F.sp.position.y += Math.sin(Math.min(1, F.t) * Math.PI) * 3;
    if (Math.random() < 0.6) FX.mote(F.sp.position.clone(), 0xffd090);
    if (F.t >= 1) { if (!F.target.dead) F.target.hurt(13); FX.sparks(to, 12); scene.remove(F.sp); FLARES.splice(i, 1); }
  }
  towerAI(dt); ballistaAI(dt); shipAI(dt, time); watchAI();
}
function updateWildlight(dt, time) {
  WL.uniforms.uFrame.value = Math.floor(time * 8);
  WL.uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  WL.uniforms.uPx.value = renderer.getPixelRatio();
  const N = WL.night;
  if (N) {
    while (N.times.length && TOD.t >= N.times[0] && TOD.t < 0.97) { N.times.shift(); spawnWildlight(); }
  }
  if (WL.list.length) {
    WL.flowT -= dt;
    if (WL.flowT <= 0) { computeFlow(); WL.flowT = 1.5; }
  }
  WL.list = WL.list.filter(f => { const alive = f.update(dt); if (!alive) scene.remove(f.root); return alive; });
}
