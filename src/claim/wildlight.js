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
const wlCoreTex = radialTex('rgba(255,255,255,1)', 'rgba(200,225,255,0)', 64);
// The kinds, smallest to greatest (their loot tiers are FOES in loot.js). Glimmers are quick sparks that come in packs;
// Flarehounds are full-grown and chew through walls; a Lodestar has something swallowed glowing in its chest; a
// Brightmaw climbs out of a deep seam. hp grows with the night count n. cost: what one is worth when a night is planned.
const WL_KINDS = {
  glimmer:    { name: 'Glimmer', plural: 'Glimmers', scale: 0.68, col: [1.3, 0.82, 0.34], glow: 0xffc870, hp: n => 14 + n * 3, speed: [3.9, 4.6], climb: 3.6, chew: 0.5, bite: 3, width: 1.1, cost: 1 },
  flarehound: { name: 'Flarehound', plural: 'Flarehounds', scale: 1.0, col: [1.25, 0.52, 0.17], glow: 0xff9a48, hp: n => 32 + n * 5, speed: [3.0, 3.6], climb: 3.0, chew: 1.5, bite: 5, width: 1.3, cost: 2.6 },
  lodestar:   { name: 'Lodestar', plural: 'Lodestars', scale: 1.38, col: [1.15, 0.86, 0.5], glow: 0xffd8a0, core: 0xcfe6ff, hp: n => 72 + n * 8, speed: [2.4, 2.7], climb: 2.5, chew: 1.0, bite: 7, width: 1.5, cost: 6 },
  brightmaw:  { name: 'Brightmaw', plural: 'Brightmaws', scale: 3.0, col: [1.5, 1.02, 0.58], glow: 0xfff0d0, core: 0xffffff, hp: n => 1100 + n * 60, speed: [2.0, 2.0], climb: 3.0, chew: 3, bite: 16, width: 2.6, cost: 0 },
};
class Wildlight {
  constructor(route, kind = 'flarehound', o = {}) {
    if (!FOX_GEO) buildFoxGeometry();
    const K = WL_KINDS[kind] || WL_KINDS.flarehound;
    this.kind = WL_KINDS[kind] ? kind : 'flarehound'; this.K = K; this.boss = !!o.boss; this.name = o.name || K.name;
    this.baseCol = new THREE.Color(...K.col);
    this.uni = { ...WL.uniforms, uCol: { value: this.baseCol.clone() }, uAlpha: { value: 0.85 }, uDissolve: { value: 1 }, uWidth: { value: o.width || K.width } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: STROKE_VS, fragmentShader: STROKE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mat = mat;
    this.root = new THREE.Group(); this.bones = {};
    for (const [k, p] of Object.entries(FOX_BONES)) {
      const o = new THREE.Group(); o.position.set(...p); (k === 'body' ? this.root : this.bones.body).add(o); this.bones[k] = o;
      if (k === 'body') { const m = new THREE.Mesh(FOX_GEO.body, mat); m.frustumCulled = false; o.add(m); }
    }
    for (const k of Object.keys(FOX_BONES)) if (k !== 'body') { const m = new THREE.Mesh(FOX_GEO[k], mat); m.frustumCulled = false; this.bones[k].add(m); }
    // the head bone's geometry is authored around its own pivot; others around theirs
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: wlGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, color: K.glow }));
    glow.scale.set(2.6, 1.8, 1); glow.position.set(0, 0.8, 0); this.root.add(glow); this.glow = glow;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: wlGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35, color: K.glow }));
    pool.position.y = 0.05; this.root.add(pool); this.pool = pool;
    // the swallowed light in a Lodestar's chest, and the white-hot heart of a Brightmaw
    if (K.core) { const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: wlCoreTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, color: K.core, toneMapped: false })); c.scale.setScalar(0.6); c.position.set(0.22, 0.76, 0); this.bones.body.add(c); this.core = c; }
    this.root.scale.setScalar(o.scale || K.scale);
    scene.add(this.root);
    this.pos = route[0].clone(); this.route = route.slice(1); this.mode = 'route'; this.inward = route.inward || null;
    this.hp = o.hp || K.hp(Math.max(1, GAME.nights)); this.maxHp = o.maxHp || this.hp; this.speed = K.speed[0] + Math.random() * (K.speed[1] - K.speed[0]); this.climbSpeed = o.climb || K.climb;
    this.phase = Math.random() * 10; this.dead = false; this.born = 0; this.vel = new THREE.Vector3(1, 0, 0); this.target = null; this.feed = 0; this.trailT = 0;
    this.root.position.copy(this.pos);
  }
  hurt(n, src) {
    if (this.dead || this.leaving) return;
    const dealt = Math.min(Math.max(0, this.hp), n * (castPerk('halcyon') ? 1.2 : 1));   // Seraphine's vigil
    this.hp -= dealt; this.flash = 0.15;
    nightCredit(src, dealt);
    if (this.boss) bossHurt(this, dealt);
    if (this.hp <= 0) this.die(true);
  }
  die(killed) {
    if (this.dead) return;
    this.dead = true; this.dying = 0;
    const s = this.root.scale.x;
    FX.sparks(this.pos.clone().setY(this.pos.y + 0.8 * s), Math.round((killed ? 26 : 14) * Math.min(3, s)), 0xffc070, 3.5 * Math.min(2, s));
    AUDIO.play('poof');
    if (killed) { GAME.ore += 2; nightDowned(this); }
  }
  update(dt) {
    this.born = Math.min(1, this.born + dt * 1.5);
    if (this.dead) {
      this.dying += dt * (this.boss ? 0.6 : 1.6); this.uni.uDissolve.value = clamp(this.dying, 0, 1); this.uni.uAlpha.value = 0.85 * (1 - this.dying);
      this.glow.material.opacity = 0.55 * (1 - this.dying); this.pool.material.opacity = 0.35 * (1 - this.dying);
      if (this.core) this.core.material.opacity = 1 - this.dying;
      this.root.position.y += dt * 0.6;
      return this.dying < 1;
    }
    // hurt ones fray: strokes drop away as their light runs out
    this.uni.uDissolve.value = Math.max(1 - this.born, (1 - Math.max(0, this.hp) / this.maxHp) * 0.45);
    // movement
    let moving = true;
    const held = this.boss && bossTick(this, dt);   // a boss winding up a pulse, or charging the wall
    if (held) moving = held === 'run';
    else if (this.mode === 'route') {
      const tgt = this.route[0];
      const d = tgt.clone().sub(this.pos), L = d.length();
      if (L < 0.12) { this.route.shift(); if (!this.route.length) { this.mode = 'hunt'; this.climbing = false; if (this.leaving) { this.die(false); return true; } wlCrest(this); } }
      else {
        const up = Math.abs(d.y) > 0.6 * Math.hypot(d.x, d.z);
        const step = Math.min(L, (up ? this.climbSpeed : this.speed) * dt); this.pos.addScaledVector(d.normalize(), step);
        if (up) { this.climbing = true; if (this.inward) this.vel.set(this.inward.x, 0, this.inward.z); }
        else { this.climbing = false; this.vel.set(d.x, 0, d.z).normalize(); }
      }
      // a streak of light up the cliff behind each climber
      if (this.climbing && (this.trailT -= dt) <= 0) { this.trailT = 0.11; FX.mote(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4 * this.root.scale.x, (Math.random() - 0.5) * 0.4)), this.K.glow); }
    } else if (this.mode === 'hunt') {
      moving = huntStep(this, dt);
      wlBite(this, dt);
    }
    // pose
    this.phase += dt * (moving ? this.speed * 3.2 / Math.sqrt(this.root.scale.x) : 2);
    const s = this.phase, run = moving ? 1 : 0.15;
    const B = this.bones;
    B.legFL.rotation.z = Math.sin(s) * 0.75 * run; B.legFR.rotation.z = Math.sin(s + 0.6) * 0.75 * run;
    B.legBL.rotation.z = Math.sin(s + Math.PI) * 0.8 * run; B.legBR.rotation.z = Math.sin(s + Math.PI + 0.6) * 0.8 * run;
    B.body.position.y = Math.abs(Math.sin(s)) * 0.08 * run;
    B.body.rotation.z = this.climbing ? 1.1 : (this.crouch || 0) * -0.25 + Math.sin(s * 2) * 0.03 * run;
    B.tail.rotation.y = Math.sin(s * 0.5) * 0.35; B.tail.rotation.z = 0.15 + Math.sin(s) * 0.12 * run;
    B.head.rotation.z = Math.sin(s * 2) * 0.05 + (this.feeding ? -0.5 : 0) + (this.roar || 0) * 0.6;
    const yaw = Math.atan2(-this.vel.z, this.vel.x);
    let dy = yaw - this.root.rotation.y; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
    this.root.rotation.y += dy * Math.min(1, dt * 8);
    this.root.position.copy(this.pos);
    const bright = 1 + (this.charge || 0) * 1.4;
    if (this.flash > 0) { this.flash -= dt; this.uni.uCol.value.setRGB(2.0, 1.6, 1.2); } else this.uni.uCol.value.copy(this.baseCol).multiplyScalar(bright);
    this.glow.material.opacity = (0.32 + Math.sin(s * 3) * 0.06) * bright;
    if (this.core) this.core.material.opacity = 0.75 + Math.sin(s * 2.3) * 0.2 + (this.charge || 0) * 0.5;
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
  if (near && !(near.kind === 'lamp' && !near.L.lit)) {
    f.feeding = true; f.feed += dt;
    if (near.kind === 'lamp') { if (f.feed > 1.2) { snuffLamp(near.L, f); f.feed = 0; f.feeding = false; WL.flowT = 0; } }
    else {
      // drinking from a yard or the hall: a boss drinks deep and never has its fill
      const take = Math.min(GAME.shards, (f.boss ? 7 : 4) * dt); GAME.shards -= take; WL.night && (WL.night.drained += take);
      if (near.b) { near.b.drainK = 1; near.b.drained = (near.b.drained || 0) + take; }
      if (f.feed > 3.5 && !f.boss) { f.die(false); }
    }
    return false;
  }
  f.feeding = false;
  // chewing through a wall?
  const k0 = iz * GX + ix, w = NAV.wall[k0];
  if (w >= 0 && !WALL.segs[w].broken) {
    // a big one tears through; on the first nights the palisade holds a while (the prologue's night is a lesson)
    const early = WL.night ? (WL.night.n <= 1 ? 0.3 : WL.night.n <= 2 ? 0.6 : 1) : 1;
    wallHit(WALL.segs[w], dt * (TOWN.wallLevel >= 2 ? 0.022 : 0.05) * f.K.chew * (f.boss ? 3 : 1) * early, f);
    if (Math.random() < dt * 4) FX.puff(f.pos.clone().setY(1.2), 1, 0xb0a080);
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
// Up the cliff from the cloud sea: the route follows the face exactly as buildPlateau shaped it (the same rings and
// the same noise), stood a little off the rock, then spills over the rim onto the grass.
const CLIFF = { arc: null, total: 0, normals: null };
function cliffAt(i, y, off = 0.6) {
  const P = OUTLINE, n = P.length;
  if (!CLIFF.arc) {
    CLIFF.arc = [0]; for (let k = 1; k < n; k++) CLIFF.arc.push(CLIFF.arc[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    CLIFF.total = CLIFF.arc[n - 1];
    CLIFF.normals = P.map((pt, k) => { const a = P[Math.max(0, k - 1)], b = P[Math.min(n - 1, k + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; let nx = tz / l, nz = -tx / l; if (nx * pt[0] + nz * pt[1] < 0) { nx = -nx; nz = -nz; } return [nx, nz]; });
  }
  i = clamp(Math.round(i), 1, n - 2);
  const ri = FACE_RINGS.indexOf(y), arc = CLIFF.arc[i];
  const sc = 1 + 0.075 * smooth(0, -26, y) - 0.2 * smooth(-42, -70, y), amp = 0.25 + 3.4 * smooth(0, -30, y);
  const w = smooth(0, 7, Math.min(arc, CLIFF.total - arc));
  const d = (fbm(arc / 6.5, y / 5.5 + 3.1, 4) - 0.5) * 2 * amp * w + (ri === 1 ? 0.25 : 0) * w;
  const [nx, nz] = CLIFF.normals[i];
  return new THREE.Vector3(P[i][0] * sc + nx * (d + off), y, Math.min(WORLD.faceZ - 0.5, P[i][1] * sc + nz * (d + off)));
}
function climbRoute(i) {
  const pts = [];
  for (const y of FACE_RINGS.slice(0, 11).reverse()) pts.push(cliffAt(i, y, y < -20 ? 1.4 : 0.55));   // from -31 m up to the rim
  pts.unshift(cliffAt(i, -31, 1.4).setY(-36));
  const [nx, nz] = CLIFF.normals[clamp(Math.round(i), 1, OUTLINE.length - 2)], top = pts[pts.length - 1];
  pts.push(new THREE.Vector3(top.x - nx * 1.6, 0, top.z - nz * 1.6));
  pts.inward = new THREE.Vector3(-nx, 0, -nz);
  return pts;
}
// the old way up, for anything that asks for a cliff at random
function cliffRoute() { return climbRoute(8 + Math.random() * (OUTLINE.length - 17)); }
function startNight() {
  GAME.nights++;
  nightBegin();
  AUDIO.play('nightstart');
}
function endNight() {
  weatherDawn();   // the day's weather arrives with the light (weather.js)
  const N = WL.night; if (!N) return;
  for (const f of WL.list) if (!f.dead && !f.air) { if (f.boss) bossRetreat(f); else f.die(false); }
  nightDawn(N);
  AUDIO.play('dawn');
  WL.night = null;
}
// one Wildlight onto the cliff (or up the shaft): kind, where (an outline index), and boss options
function spawnWildlight(kind = 'flarehound', at = null, o = {}) {
  const N = WL.night;
  const seam = at === 'seam' || (at == null && N && N.deep && Math.random() < 0.45);
  const route = seam ? seamRoute() : climbRoute(at == null || at === 'seam' ? 8 + Math.random() * (OUTLINE.length - 17) : at);
  const f = new Wildlight(route, kind, o); f.from = seam ? 'seam' : 'cliff';
  WL.list.push(f);
  if (N) { N.spawned++; const k = N.kinds[f.kind] || (N.kinds[f.kind] = { spawned: 0, downed: 0 }); k.spawned++; }
  if (f.from === 'seam' && Math.random() < 0.5) FX.sparks(route[0].clone().setY(route[0].y + 1), 16);
  return f;
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
    const range = turretRange(b) * wxSight(), muzzle = new THREE.Vector3(); b.muzzle.getWorldPosition(muzzle);
    let best = null, bd = range;
    for (const f of WL.list) { if (f.dead || f.leaving || f.pos.y < -2) continue; const d = Math.hypot(f.pos.x - muzzle.x, f.pos.z - muzzle.z); if (d < bd) { bd = d; best = f; } }
    // swing the head toward the target, or sweep slowly
    const head = b.head, gp = new THREE.Vector3(); head.getWorldPosition(gp);
    const want = best ? Math.atan2(best.pos.x - gp.x, best.pos.z - gp.z) - b.group.rotation.y : Math.sin(performance.now() / 2600 + b.L.x) * 1.4 + Math.PI;
    let dy = want - head.rotation.y; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
    head.rotation.y += dy * Math.min(1, dt * 5);
    if (best) b.tilt.rotation.x = lerp(b.tilt.rotation.x, Math.atan2(7.5 - best.pos.y, bd) * 0.9, dt * 5);
    b.cool = (b.cool || 0) - dt;
    // the core gathers light as the next shot comes round: a glow at the lens that swells, then the flash
    const agi = (crew.length ? crew : workersOf(b.id)).reduce((s, v) => s + statOf(v, 'A'), 0), period = (b.level >= 2 ? 1.1 : 1.7) / (0.6 + agi * 0.06) * wxScorch(b);
    turretCharge(b, best ? clamp(1 - b.cool / period, 0, 1) : 0, muzzle);
    if (best && b.cool <= 0 && Math.abs(dy) < 0.25 && GAME.shards >= 1) {
      b.cool = period;
      GAME.shards -= 1; WL.night && (WL.night.spent += 1);
      const to = best.pos.clone(); to.y += 0.7 * best.root.scale.x;
      fireBeam(muzzle, to); best.hurt(15 + (b.level >= 2 ? 5 : 0), b);
      b.coreMat.emissiveIntensity = 4;
      muzzleFlash(muzzle, 0xfff0c8, 2.4);
      AUDIO.play('zap');
    }
  }
}
// ---- turret reach, drawn on the ground in build mode and while a turret is selected
const turretRange = b => b.type === 'lens' ? (b.level >= 2 ? 27 : 21) : (b.level >= 2 ? 17 : 14);
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
    const range = turretRange(b) * wxSight(), muzzle = new THREE.Vector3(); b.muzzle.getWorldPosition(muzzle);
    let best = null, bd = range;
    for (const f of WL.list) { if (f.dead || f.leaving || f.pos.y < -2) continue; const d = Math.hypot(f.pos.x - muzzle.x, f.pos.z - muzzle.z); if (d < bd) { bd = d; best = f; } }
    const head = b.head;
    const want = best ? Math.atan2(best.pos.x - b.L.x, best.pos.z - b.L.z) : TOD.night > 0.4 ? Math.sin(performance.now() / 3100 + b.L.x) * 1.2 : head.rotation.y;
    let dy = want - head.rotation.y; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
    head.rotation.y += dy * Math.min(1, dt * 4);
    // the stock kicks back when a bolt goes, and eases forward again as the spring winds
    b.kick = Math.max(0, (b.kick || 0) - dt * 3);
    b.tilt.rotation.x = lerp(b.tilt.rotation.x, best ? -Math.atan2(best.pos.y + 0.6 - 1.9, bd) * 0.8 : 0, dt * 4) - b.kick * dt * 2.5;
    b.cool = (b.cool || 0) - dt;
    if (best && b.cool <= 0 && Math.abs(dy) < 0.3) {
      b.cool = (b.level >= 2 ? 1.6 : 2.1) * wxScorch(b); b.kick = 1;
      const m = new THREE.Mesh(boltGeo, MAT.iron); m.position.copy(muzzle); m.lookAt(best.pos.x, best.pos.y + 0.6, best.pos.z); scene.add(m);
      BOLTS.push({ m, from: muzzle.clone(), target: best, t: 0, dur: Math.max(0.12, bd / 45), dmg: b.level >= 2 ? 14 : 10, src: b });
      muzzleFlash(muzzle, 0xffe8c0, 1.1); FX.puff(muzzle.clone(), 2, 0xc8b898, 0.4);
      AUDIO.play('thunk');
    }
  }
  for (let i = BOLTS.length - 1; i >= 0; i--) {
    const B = BOLTS[i]; B.t += dt / B.dur;
    const to = B.target.pos.clone(); to.y += 0.6 * (B.target.root ? B.target.root.scale.x : 1);
    B.m.position.lerpVectors(B.from, to, Math.min(1, B.t)); B.m.lookAt(to);
    if (B.t >= 1) { if (!B.target.dead) B.target.hurt(B.dmg, B.src); FX.sparks(to, 6, 0xd8c8a8, 2); scene.remove(B.m); BOLTS.splice(i, 1); }
  }
}
function watchAI() {
  if (!WL.list.length) return;
  for (const v of GAME.villagers) {
    if (v.hidden || v.where !== 'surface' || v.d.exp || v.hurt) continue;
    let nearest = null, nd = 1e9;
    for (const f of WL.list) { if (f.dead || f.air || f.leaving || f.pos.y < -1) continue; const d = Math.hypot(f.pos.x - v.pos.x, f.pos.z - v.pos.z); if (d < nd) { nd = d; nearest = f; } }
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
      for (const f of WL.list) { if (f.dead || f.leaving) continue; const d = f.pos.distanceTo(ship.position); if (d < bd) { bd = d; best = f; } }
      if (best) {
        const agi = crew.reduce((s, v) => s + statOf(v, 'A'), 0);
        SHIP.cool = 2.6 / (0.5 + agi * 0.07); GAME.shards -= 1; WL.night && (WL.night.spent += 1);
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
    if (F.t >= 1) { if (!F.target.dead) F.target.hurt(13, 'lark'); FX.sparks(to, 12); scene.remove(F.sp); FLARES.splice(i, 1); }
  }
  towerAI(dt); ballistaAI(dt); shipAI(dt, time); watchAI();
}
function updateWildlight(dt, time) {
  WL.uniforms.uFrame.value = Math.floor(time * 8);
  WL.uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  WL.uniforms.uPx.value = renderer.getPixelRatio();
  const N = WL.night;
  if (N) nightWaves(N, dt);   // the waves: warnings, then each one up its cliff (nights.js)
  if (WL.list.length) {
    WL.flowT -= dt;
    if (WL.flowT <= 0) { computeFlow(); WL.flowT = 1.5; }
  }
  WL.list = WL.list.filter(f => { const alive = f.update(dt); if (!alive) scene.remove(f.root); return alive; });
  nightsTick(dt);
  weatherTick(dt);
}
