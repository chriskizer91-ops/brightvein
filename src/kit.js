// ===================================================================== KIT: materials, pieces, construction, effects
const MAT = {};
function makeMaterials() {
  const std = (o, env = 0.3) => trackEnv(new THREE.MeshStandardMaterial(o), env);
  MAT.stone = std({ map: tex('limestone'), roughness: 0.9 }, 0.25);
  MAT.dressed = std({ map: tex('dressed'), roughness: 0.88 }, 0.25);
  MAT.plaster = std({ map: tex('plaster'), roughness: 0.95 }, 0.2);
  MAT.oak = std({ map: tex('oak'), roughness: 0.82 }, 0.25);
  MAT.oakDark = std({ map: tex('oak'), color: 0x8a7464, roughness: 0.85 }, 0.2);
  MAT.boards = std({ map: tex('boards'), roughness: 0.85 }, 0.2);
  MAT.slate = std({ map: tex('slate'), roughness: 0.7 }, 0.45);
  MAT.copper = std({ map: tex('copper'), roughness: 0.5, metalness: 0.4 }, 0.9);
  MAT.brass = std({ map: tex('brass'), color: 0xd8c8b0, roughness: 0.38, metalness: 0.85 }, 0.85);
  MAT.iron = std({ map: tex('iron'), roughness: 0.48, metalness: 0.7 }, 0.7);
  MAT.canvas = std({ map: tex('canvas'), roughness: 0.95, side: THREE.DoubleSide }, 0.25);
  MAT.wool = std({ map: tex('wool'), roughness: 1, side: THREE.DoubleSide }, 0.15);
  MAT.teal = std({ color: 0x2f5d62, roughness: 0.9, side: THREE.DoubleSide }, 0.15);
  MAT.rock = std({ map: tex('rock'), roughness: 0.96 }, 0.15);
  MAT.loam = std({ map: tex('loam'), roughness: 1 }, 0.1);
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x1b1218, roughness: 1 });
  MAT.glass = std({ color: 0xbfe6e2, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }, 1.6);
  MAT.window = std({ color: 0x2a2433, roughness: 0.2, metalness: 0.2, emissive: 0xffb35c, emissiveIntensity: 0 }, 1.0);
  MAT.lens = std({ color: 0xd8f4f0, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.55, emissive: 0xffc070, emissiveIntensity: 0.1, side: THREE.DoubleSide }, 2.0);
  MAT.crystal = std({ color: 0xffb04a, emissive: 0xff8a24, emissiveIntensity: 1.2, roughness: 0.22, metalness: 0.1, flatShading: true }, 0.8);
  MAT.crystalDull = std({ color: 0x9a7a5a, emissive: 0x5a2a08, emissiveIntensity: 0.2, roughness: 0.6, flatShading: true }, 0.3);
  MAT.leaf = std({ color: 0x5a7a3a, roughness: 0.9, flatShading: true }, 0.1);
  MAT.cream = std({ color: 0xefe4c8, roughness: 0.7 }, 0.3);
  MAT.rope = std({ color: 0xb59a70, roughness: 1 }, 0.1);
  MAT.pumpkin = std({ color: 0xd98a3a, roughness: 0.7 }, 0.2);
  MAT.ore = std({ color: 0x8a7a6c, roughness: 0.9, flatShading: true, emissive: 0x7a3a10, emissiveIntensity: 0.25 }, 0.2);
}

// box-projected UVs in metres, so every texture keeps its real-world scale
function projUV(geo, scale = 2, off = [0, 0]) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const p = geo.attributes.position, n = geo.attributes.normal; if (!n) geo.computeVertexNormals();
  const N = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / scale + off[0]; uv[i * 2 + 1] = v / scale + off[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const G = {
  box: (w, h, d, s = 2) => projUV(new THREE.BoxGeometry(w, h, d), s),
  cyl: (rt, rb, h, seg = 12, s = 2, open = false) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); return g; },
  // a prism with a triangular end (gable walls, pediments); spans x, peak height h, thickness t along z
  gable: (w, h, t, s = 2) => { const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]); const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2); return projUV(g, s); },
};
// one roof slope: a thin slab tilted about its upper edge
function roofSlabs(w, d, h, over = 0.5, t = 0.22) {
  // ridge along x at height h above eaves; slopes fall to ±d/2
  const half = d / 2 + over, slope = Math.atan2(h, d / 2), len = Math.hypot(h, d / 2) + over * 1.05;
  const out = [];
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(w + over * 2, t, len);
    const p = projUV(g, 2.2);
    p.translate(0, 0, s * len / 2);
    p.rotateX(s * slope);
    p.translate(0, h + 0.05, 0);
    out.push(p);
  }
  void half;
  return out;
}

// ----------------------------------------------------------------- buildings made of pieces
const BUILDINGS = [];
class Building {
  constructor(id, def, L) {
    this.id = id; this.def = def; this.L = L; this.name = def.name; this.level = 0; this.pieces = []; this.anim = [];
    this.group = new THREE.Group(); this.group.position.set(L.x, 0, L.z); this.group.rotation.y = L.rot || 0;
    this.group.userData.building = this; scene.add(this.group);
    this.lights = []; this.glows = []; this.spin = []; this.smoke = [];
    BUILDINGS.push(this);
  }
  // add a piece: geo, mat, position (local), options
  add(geo, mat, x, y, z, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    if (o.sx) m.scale.set(o.sx, o.sy || 1, o.sz || 1);
    m.castShadow = o.cast !== false; m.receiveShadow = true;
    m.userData.lvl = o.lvl || 1; m.userData.building = this; m.userData.rise = o.rise ?? 2.2;
    m.userData.home = m.position.clone(); m.userData.homeScale = m.scale.clone();
    m.userData.drop = o.drop || 0;    // pieces removed when this level is reached (replaced by better ones)
    (o.parent || this.group).add(m);
    this.pieces.push(m);
    return m;
  }
  // instantly set the visible level
  show(level) {
    this.unbake();
    this.level = level;
    for (const m of this.pieces) { m.visible = m.userData.lvl <= level && !(m.userData.drop && m.userData.drop <= level); m.position.copy(m.userData.home); m.scale.copy(m.userData.homeScale); }
    this.onLevel && this.onLevel(level);
    this.bake();
  }
  bake() {
    this.unbake();
    const list = this.pieces.filter(m => m.visible && !isDynamic(m, this.group));
    this.merged = mergeMeshes(this.group, list);
    for (const m of list) m.visible = false;
    this.baked = list;
  }
  unbake() {
    if (!this.merged) return;
    for (const m of this.merged) { this.group.remove(m); m.geometry.dispose(); }
    for (const m of this.baked) m.visible = true;
    this.merged = null; this.baked = null;
  }
  // raise a new level piece by piece, bottom up
  build(level, onDone) {
    this.unbake();
    const fresh = this.pieces.filter(m => m.userData.lvl === level);
    const gone = this.pieces.filter(m => m.userData.drop === level);
    fresh.sort((a, b) => (a.userData.home.y - b.userData.home.y) || (a.userData.order || 0) - (b.userData.order || 0));
    const step = clamp(5.2 / Math.max(1, fresh.length), 0.03, 0.16);
    const t0 = performance.now() / 1000;
    for (const m of gone) this.anim.push({ m, t0, dur: 0.5, kind: 'out' });
    fresh.forEach((m, i) => { m.visible = false; this.anim.push({ m, t0: t0 + 0.4 + i * step, dur: 0.42, kind: 'in' }); });
    this.level = level;
    this.building = true;
    const total = 0.4 + fresh.length * step + 0.5;
    scaffoldOn(this);
    this.doneAt = t0 + total; this.onDone = onDone;
    this.onLevel && this.onLevel(level, true);
    AUDIO.play('build');
  }
  update(now, dt) {
    if (this.anim.length) {
      const w = new THREE.Vector3();
      this.anim = this.anim.filter(a => {
        const k = (now - a.t0) / a.dur;
        if (k < 0) return true;
        const m = a.m;
        if (a.kind === 'out') { m.scale.copy(m.userData.homeScale).multiplyScalar(Math.max(0.001, 1 - k)); if (k >= 1) { m.visible = false; m.scale.copy(m.userData.homeScale); return false; } return true; }
        m.visible = true;
        const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3);
        m.position.copy(m.userData.home); m.position.y += (1 - e) * m.userData.rise;
        m.scale.copy(m.userData.homeScale).multiplyScalar(0.55 + 0.45 * e);
        if (k >= 1) { m.position.copy(m.userData.home); m.scale.copy(m.userData.homeScale); m.getWorldPosition(w); if (Math.random() < 0.35) FX.puff(w, 3, 0xd8c8a8); return false; }
        return true;
      });
    }
    if (this.building && now > this.doneAt && !this.anim.length) { this.building = false; scaffoldOff(this); this.bake(); this.onDone && this.onDone(); }
    for (const s of this.spin) s.obj.rotation[s.axis] += dt * s.speed * (s.when ? s.when() : 1);
  }
  worldPos(x, y, z) { return this.group.localToWorld(new THREE.Vector3(x, y, z)); }
}

// merge static meshes under a root into one mesh per material: far fewer draw calls
function mergeMeshes(root, meshes) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), M = new THREE.Matrix4();
  for (const m of meshes) {
    const key = m.material.uuid + (m.castShadow ? 'c' : 'n');
    if (!groups.has(key)) groups.set(key, { mat: m.material, cast: m.castShadow, geos: [] });
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', g.attributes.position.clone());
    if (g.attributes.normal) ng.setAttribute('normal', g.attributes.normal.clone()); else { ng.computeVertexNormals(); }
    ng.setAttribute('uv', g.attributes.uv ? g.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    ng.applyMatrix4(M.multiplyMatrices(inv, m.matrixWorld));
    groups.get(key).geos.push(ng);
  }
  const out = [];
  for (const { mat, cast, geos } of groups.values()) {
    const g = mergeGeometries(geos); if (!g) continue;
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = cast; mesh.receiveShadow = true; mesh.userData.merged = true;
    root.add(mesh); out.push(mesh);
  }
  for (const g of groups.values()) for (const ge of g.geos) ge.dispose();
  return out;
}
function isDynamic(m, root) { for (let o = m.parent; o && o !== root; o = o.parent) if (o.userData.dynamic) return true; return !!m.userData.dynamic; }
function mergeStatic(root, skip = () => false) {
  const list = [];
  root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.visible && !isDynamic(o, root) && !skip(o)) list.push(o); });
  const merged = mergeMeshes(root, list);
  for (const m of list) m.parent.remove(m);
  return merged;
}

// scaffolding: poles and planks around a footprint while it is being built
const SCAF = { pool: [] };
function scaffoldOn(b) {
  const L = b.L, w = (L.w || 6) / 2 + 0.6, d = (L.d || 6) / 2 + 0.6, h = 3 + b.level * 3.2;
  const grp = new THREE.Group(); grp.position.copy(b.group.position); grp.rotation.y = b.group.rotation.y;
  const pole = G.box(0.14, h, 0.14, 1), plank = G.box(1, 0.08, 0.5, 1);
  for (const [x, z] of [[-w, -d], [w, -d], [-w, d], [w, d], [0, -d], [0, d], [-w, 0], [w, 0]]) {
    const m = new THREE.Mesh(pole, MAT.oakDark); m.position.set(x, h / 2, z); m.castShadow = true; grp.add(m);
  }
  for (let y = 2.2; y < h; y += 2.8) for (const [x, z, sx, r] of [[0, d, w * 2, 0], [0, -d, w * 2, 0], [w, 0, d * 2, Math.PI / 2], [-w, 0, d * 2, Math.PI / 2]]) {
    const m = new THREE.Mesh(plank, MAT.boards); m.scale.x = sx; m.position.set(x, y, z); m.rotation.y = r; m.castShadow = true; grp.add(m);
  }
  scene.add(grp); b.scaffold = grp;
}
function scaffoldOff(b) { if (b.scaffold) { scene.remove(b.scaffold); b.scaffold = null; } }

// windows and doors on a wall plane. dir: which way the wall faces, in the building's local frame
function windowAt(b, x, y, z, w, h, ry = 0, lvl = 1, o = {}) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; b.group.add(grp);
  b.add(G.box(w, h, 0.08, 1), MAT.window, 0, 0, 0.02, { parent: grp, lvl, cast: false });
  const f = o.frame || MAT.oak, t = 0.11;
  b.add(G.box(w + t * 2, t, 0.14, 1), f, 0, h / 2 + t / 2, 0.05, { parent: grp, lvl });
  b.add(G.box(w + t * 3, t * 1.2, 0.26, 1), f, 0, -h / 2 - t / 2, 0.1, { parent: grp, lvl });
  b.add(G.box(t, h, 0.14, 1), f, -w / 2 - t / 2, 0, 0.05, { parent: grp, lvl, cast: false });
  b.add(G.box(t, h, 0.14, 1), f, w / 2 + t / 2, 0, 0.05, { parent: grp, lvl, cast: false });
  if (!o.noMullion) { b.add(G.box(0.05, h, 0.1, 1), f, 0, 0, 0.06, { parent: grp, lvl, cast: false }); b.add(G.box(w, 0.05, 0.1, 1), f, 0, h * 0.1, 0.06, { parent: grp, lvl, cast: false }); }
  if (o.shutters) for (const s of [-1, 1]) b.add(G.box(w / 2, h * 1.02, 0.06, 1), o.shutters, s * (w * 0.75 + 0.15), 0, 0.08, { parent: grp, lvl, cast: false, ry: s * 0.5 });
  return grp;
}
function doorAt(b, x, y, z, w, h, ry = 0, lvl = 1, mat = MAT.oak) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; b.group.add(grp);
  b.add(G.box(w + 0.3, h + 0.15, 0.1, 1), MAT.dark, 0, h / 2, 0.0, { parent: grp, lvl, cast: false });
  b.add(G.box(w, h, 0.12, 1), mat, 0, h / 2, 0.06, { parent: grp, lvl });
  b.add(G.box(w + 0.4, 0.22, 0.24, 1), MAT.oakDark, 0, h + 0.12, 0.08, { parent: grp, lvl });
  b.add(G.box(0.08, 0.08, 0.08, 1), MAT.brass, w * 0.3, h * 0.48, 0.14, { parent: grp, lvl, cast: false });
  for (const yy of [h * 0.25, h * 0.75]) b.add(G.box(w * 0.9, 0.07, 0.04, 1), MAT.iron, 0, yy, 0.13, { parent: grp, lvl, cast: false });
  return grp;
}
// timber framing over a plaster block: posts, rails and a few braces on the faces of a w×h×d box at y0
function timberFrame(b, cx, y0, cz, w, h, d, lvl, faces = ['f', 'b', 'l', 'r']) {
  const t = 0.16, o = 0.04;
  const face = (axis, sign) => {
    const len = axis === 'x' ? w : d, n = Math.max(2, Math.round(len / 1.5));
    const off = (axis === 'x' ? d : w) / 2 + o;
    const at = (u, y, gw, gh) => axis === 'x' ? [cx + u, y, cz + sign * off, gw, gh, t] : [cx + sign * off, y, cz + u, t, gh, gw];
    for (let i = 0; i <= n; i++) { const u = -len / 2 + len * i / n; const [x, y, z, a, bb, c] = at(u, y0 + h / 2, t, h); b.add(G.box(a, bb, c, 1), MAT.oakDark, x, y, z, { lvl }); }
    for (const yy of [y0 + t / 2, y0 + h - t / 2, y0 + h * 0.52]) { const [x, y, z, a, bb, c] = at(0, yy, len, t); b.add(G.box(a, bb, c, 1), MAT.oakDark, x, y, z, { lvl, cast: false }); }
  };
  if (faces.includes('f')) face('x', 1); if (faces.includes('b')) face('x', -1);
  if (faces.includes('l')) face('z', -1); if (faces.includes('r')) face('z', 1);
}

// ----------------------------------------------------------------- particles: dust, sparks, motes, smoke
const FX = (() => {
  const N = 900;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const parts = [];
  const mk = (blend) => new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: blend, vertexColors: true,
    vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float uScale;
      void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float r = length(d); if(r>0.5) discard; float a = smoothstep(0.5,0.0,r); gl_FragColor = vec4(vC, a*a*vA); }`,
  });
  // two systems: soft (normal blend) for dust/smoke, glow (additive) for sparks and motes
  const sys = {};
  for (const [k, blend] of [['soft', THREE.NormalBlending], ['glow', THREE.AdditiveBlending]]) {
    const g = geo.clone();
    const pts = new THREE.Points(g, mk(blend)); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
    sys[k] = { pts, g, list: [], free: Array.from({ length: N }, (_, i) => N - 1 - i) };
  }
  const _c = new THREE.Color();
  function emit(k, p, v, c, s, life, o = {}) {
    const S = sys[k]; if (!S.free.length) return;
    const i = S.free.pop();
    S.list.push({ i, p: p.clone(), v: v.clone(), c: _c.set(c).clone(), s, life, age: 0, g: o.g ?? -0.6, drag: o.drag ?? 1.2, grow: o.grow ?? 0.6, a0: o.a ?? 0.8 });
  }
  return {
    puff(p, n = 6, c = 0xd8c8a8, spread = 0.8) { for (let k = 0; k < n; k++) emit('soft', p, new THREE.Vector3((Math.random() - 0.5) * spread * 2, Math.random() * 0.8 + 0.3, (Math.random() - 0.5) * spread * 2), c, 0.6 + Math.random() * 0.6, 0.8 + Math.random() * 0.6, { g: 0.2, drag: 2.2, grow: 1.4, a: 0.55 }); },
    smoke(p, c = 0xbab0a8) { emit('soft', p, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3), c, 0.5, 3.2 + Math.random(), { g: 0.15, drag: 0.4, grow: 1.1, a: 0.42 }); },
    sparks(p, n = 14, c = 0xffc070, sp = 3) { for (let k = 0; k < n; k++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(sp * (0.4 + Math.random())); emit('glow', p, v, c, 0.18 + Math.random() * 0.2, 0.5 + Math.random() * 0.7, { g: -2.4, drag: 1.6, grow: -0.3, a: 1 }); } },
    mote(p, c = 0xffc070) { emit('glow', p, new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2), c, 0.12 + Math.random() * 0.1, 2 + Math.random() * 1.5, { g: 0.1, drag: 0.3, grow: -0.1, a: 0.9 }); },
    update(dt) {
      for (const k in sys) {
        const S = sys[k], P = S.g.attributes.position.array, C = S.g.attributes.color.array, Z = S.g.attributes.size.array, A = S.g.attributes.alpha.array;
        S.list = S.list.filter(q => {
          q.age += dt;
          if (q.age >= q.life) { A[q.i] = 0; S.free.push(q.i); return false; }
          q.v.y += q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.p.addScaledVector(q.v, dt);
          const t = q.age / q.life;
          P[q.i * 3] = q.p.x; P[q.i * 3 + 1] = q.p.y; P[q.i * 3 + 2] = q.p.z;
          C[q.i * 3] = q.c.r; C[q.i * 3 + 1] = q.c.g; C[q.i * 3 + 2] = q.c.b;
          Z[q.i] = Math.max(0.02, q.s * (1 + q.grow * t)); A[q.i] = q.a0 * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
          return true;
        });
        S.g.attributes.position.needsUpdate = true; S.g.attributes.color.needsUpdate = true; S.g.attributes.size.needsUpdate = true; S.g.attributes.alpha.needsUpdate = true;
        S.pts.material.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.6;
      }
    },
  };
})();

// soft round texture for light pools and shadows
function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return canvasTex(c);
}
