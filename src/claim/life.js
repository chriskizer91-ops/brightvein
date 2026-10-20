// ===================================================================== LIFE: what moves round the claim besides its people
// Swifts wheeling over the plateau by day, two distant airships crossing the Ironspire Peaks, fireflies along the rim
// at night, and dust hanging in the lamplight down the mine. All cheap: a handful of sprites and two batches of points.
const LIFE = { birds: [], ships: [], flies: null, dust: null, motes: null, wings: null, bees: null, t: 0 };

// a swift, hand-pixeled: two frames (wings up, wings down), 16 × 8, plum-black with a pale throat
function birdTexture() {
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 8; const g = cv.getContext('2d');
  const put = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const ink = '#241a26', mid = '#3d3040', pale = '#b9aeb8';
  // wings up
  for (const [x, y] of [[1, 1], [2, 2], [3, 2], [4, 3], [5, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 3], [11, 3], [12, 2], [13, 2], [14, 1]]) put(x, y, ink);
  for (const [x, y] of [[2, 1], [13, 1], [3, 1], [12, 1]]) put(x, y, mid);
  put(7, 5, ink); put(8, 5, ink); put(7, 3, pale); put(8, 3, ink);
  // wings down
  for (const [x, y] of [[1, 6], [2, 5], [3, 5], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 5], [13, 5], [14, 6]]) put(16 + x, y, ink);
  for (const [x, y] of [[2, 6], [13, 6]]) put(16 + x, y, mid);
  put(16 + 7, 3, ink); put(16 + 8, 3, ink); put(16 + 7, 5, pale);
  const t = canvasTex(cv, { nearest: true }); t.repeat.set(0.5, 1); return t;
}
function setupLife() {
  // swifts: a loose flock on a wide, wandering circuit over the claim
  const tex0 = birdTexture();
  for (let i = 0; i < 9; i++) {
    const t = tex0.clone(); t.needsUpdate = true;
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.5, fog: true, depthWrite: false });
    const s = new THREE.Sprite(m); s.scale.set(1.5, 0.75, 1); scene.add(s);
    LIFE.birds.push({ s, t, ph: Math.random() * TAU, r: 34 + Math.random() * 26, h: 18 + Math.random() * 16, sp: 0.16 + Math.random() * 0.06, flap: Math.random() * 10, wob: Math.random() * TAU });
  }
  // fireflies along the rim, and dust in the mine
  const glowPts = (n, place, color, size) => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = place(i); pos.set(p, i * 3); seed[i] = Math.random() * 100; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uScale: { value: 600 }, uCol: { value: new THREE.Color(color) }, uSize: { value: size } },
      vertexShader: `attribute float seed; uniform float uTime, uScale, uSize, uOn; varying float vA;
        void main() {
          vec3 p = position + vec3(sin(uTime * 0.37 + seed) * 0.9, sin(uTime * 0.53 + seed * 1.7) * 0.5, cos(uTime * 0.31 + seed * 2.3) * 0.9);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = uOn * (0.35 + 0.65 * max(0.0, sin(uTime * (0.9 + fract(seed) * 1.4) + seed * 5.0)));
          gl_PointSize = uSize * uScale / -mv.z; gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uCol; varying float vA;
        void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uCol * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts); return pts;
  };
  const R = mulberry(611);
  LIFE.flies = glowPts(70, () => {
    for (let k = 0; k < 40; k++) { const a = R() * TAU, x = Math.cos(a) * 44 * R() ** 0.3, z = Math.sin(a) * 38 * R() ** 0.3; if (onPlateau(x, z) && distToOutline(x, z) < 9 && z < WORLD.faceZ - 2) return [x, 0.6 + R() * 1.6, z]; }
    return [0, -100, 0];
  }, 0xd8ff7a, 0.22);
  // by day: pollen and seed-down drifting low over the lawn, catching the sun
  LIFE.motes = glowPts(110, () => {
    for (let k = 0; k < 40; k++) { const x = (R() - 0.5) * 84, z = -36 + R() * 66; if (onPlateau(x, z) && z < WORLD.faceZ - 2) return [x, 0.4 + R() * 2.4, z]; }
    return [0, -100, 0];
  }, 0xfff1c8, 0.06);
  setupWings(R);
  const G1 = MINE.g1, G2 = MINE.g2;
  LIFE.dust = glowPts(90, i => { const G = i % 3 ? G1 : G2; return [G.x0 + R() * (G.x1 - G.x0), G.y0 + 0.4 + R() * (G.y1 - G.y0 - 0.8), WORLD.faceZ - 0.5 - R() * (MINE.depth - 1)]; }, 0xffd9a0, 0.07);
}
// Butterflies over the flowers along the rim and the beds of the greenhouse, and bees about the greenhouse, by day.
// Butterflies are pixel-drawn (two frames: open and closed, in a few wing colours), bees are dots; one draw each.
const WING_COLS = ['#f2c14e', '#e8eef2', '#8fb8e8', '#e88a5a', '#c9a0e0'];
function butterflyTexture() {
  // two 16 × 16 frames side by side: wings spread, and wings raised (seen nearly edge on); drawn in white and greys,
  // tinted per butterfly, with a dark body, antennae and a darker wing edge
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 16; const g = cv.getContext('2d');
  const put = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const W = '#ffffff', E = '#a8a8a8', SP = '#fff8e0', B = '#2a1b2f';
  const wings = (ox, k) => {
    const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const px = x + 0.5, py = y + 0.5;
      const L = [[8 - 3.6 * k, 6.2, 3.4 * k, 3.2], [8 - 2.6 * k, 10.6, 2.4 * k, 2.2]], Rr = L.map(([cx, cy, rx, ry]) => [16 - cx, cy, rx, ry]);
      const any = (E2, sx, sy) => [...L, ...Rr].some(([cx, cy, rx, ry]) => inE(px + sx, py + sy, cx, cy, rx, ry));
      if (!any(E, 0, 0) || Math.abs(px - 8) < 0.9) continue;
      const edge = !any(E, 1, 0) || !any(E, -1, 0) || !any(E, 0, 1) || !any(E, 0, -1);
      put(ox + x, y, edge ? E : W);
    }
    if (k > 0.7) for (const [x, y] of [[4, 6], [11, 6]]) put(ox + x, y, SP);
    for (let y = 4; y <= 12; y++) { put(ox + 7, y, B); put(ox + 8, y, B); }
    for (const [x, y] of [[6, 3], [5, 2], [9, 3], [10, 2]]) put(ox + x, y, B);
  };
  wings(0, 1); wings(16, 0.38);
  return canvasTex(cv, { nearest: true });
}
function setupWings(R) {
  const homes = [];
  for (const C of DECOR.clumps) if (!C.lawn) for (const p of C.list) if (R() < 0.08) homes.push([p.x, p.z]);
  const n = Math.min(16, homes.length), pos = new Float32Array(n * 3), seed = new Float32Array(n), col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) { const h = homes[Math.floor(R() * homes.length)]; pos.set([h[0], 0.8, h[1]], i * 3); seed[i] = R() * 100; c.set(WING_COLS[i % WING_COLS.length]); col.set([c.r, c.g, c.b], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: butterflyTexture() }, uTime: { value: 0 }, uOn: { value: 0 }, uScale: { value: 600 }, uLight: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `attribute float seed; attribute vec3 color; uniform float uTime, uScale, uOn; varying vec3 vCol; varying float vF;
      void main() {
        float t = uTime * (0.35 + fract(seed) * 0.2) + seed;
        vec3 p = position + vec3(sin(t) * 1.6 + sin(t * 2.7) * 0.5, 0.6 + sin(t * 1.9) * 0.45 + sin(uTime * 7.0 + seed) * 0.08, cos(t * 0.8) * 1.4 + cos(t * 3.1) * 0.4);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vCol = color; vF = step(0.5, fract(uTime * (6.0 + fract(seed * 3.1) * 3.0) + seed));
        gl_PointSize = uOn * 0.6 * uScale / -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uLight; varying vec3 vCol; varying float vF;
      void main() {
        vec2 q = gl_PointCoord; q.y = 1.0 - q.y;
        vec4 t = texture2D(map, vec2((q.x + vF) * 0.5, q.y));
        if (t.a < 0.5) discard;
        gl_FragColor = vec4(t.rgb * vCol * uLight, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  LIFE.wings = new THREE.Points(geo, mat); LIFE.wings.frustumCulled = false; scene.add(LIFE.wings);
  // bees: a little swarm that follows the greenhouses round the claim (bees(), every frame)
  const bn = 30, bp = new Float32Array(bn * 3), bs = new Float32Array(bn);
  for (let i = 0; i < bn; i++) bs[i] = R() * 100;
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.setAttribute('seed', new THREE.BufferAttribute(bs, 1));
  const bm = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uScale: { value: 600 }, uLight: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `attribute float seed; uniform float uTime, uScale, uOn;
      void main() {
        float t = uTime * (1.6 + fract(seed) * 1.2) + seed;
        vec3 p = position + vec3(sin(t) * 0.9 + sin(t * 4.3) * 0.15, sin(t * 2.1) * 0.35 + sin(t * 9.0) * 0.05, cos(t * 1.3) * 0.9 + cos(t * 3.7) * 0.15);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = max(1.5, uOn * 0.06 * uScale / -mv.z); gl_Position = projectionMatrix * mv;
        if (uOn < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `uniform vec3 uLight;
      void main() { vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25) discard; gl_FragColor = vec4(mix(vec3(0.95, 0.7, 0.18), vec3(0.2, 0.13, 0.08), step(0.08, q.y)) * uLight, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  LIFE.bees = new THREE.Points(bg, bm); LIFE.bees.frustumCulled = false; scene.add(LIFE.bees);
}
// the swarm's homes: over each greenhouse's beds (they move with it)
function beesHome() {
  if (!LIFE.bees) return;
  const gs = Object.values(TOWN.b).filter(b => b.type === 'garden' && b.level > 0 && !b.pending), P = LIFE.bees.geometry.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const b = gs[i % Math.max(1, gs.length)];
    if (!b) { P.setXYZ(i, 0, -200, 0); continue; }
    const w = (b.L.w || 14) / 2 - 1.5, d = (b.L.d || 10) / 2 - 1.5, v = b.worldPos((((i * 7) % 11) / 10 - 0.5) * 2 * w, 0.8, (((i * 5) % 9) / 8 - 0.5) * 2 * d); P.setXYZ(i, v.x, v.y, v.z);
  }
  P.needsUpdate = true;
}
// two airships far off, on long slow passes between the peaks (once the ship builder's art is in). Each is her far
// model in one piece (one draw, and her lamps' glow: onePieceOf)
function lifeShips() {
  const A = SKY && SKY.shipArt; if (!A || LIFE.ships.length) return;
  for (const [id, r, h, sp, ph] of [['brig', 420, 40, 0.012, 1.2], ['cutter', 560, 75, -0.009, 4.1]]) {
    const R = SHIPS.find(s => s.id === id), s = buildShipFar(R, A);
    if (!s) return;
    const one = onePieceOf(s.body), old = [];
    s.body.traverse(o => { if (o.isMesh) old.push(o); });
    for (const o of old) { o.removeFromParent(); o.geometry.dispose(); }
    s.body.add(one);   // (hundreds of metres off: no shadows, which would fall on nothing)
    scene.add(s.root);
    LIFE.ships.push({ s, r, h, sp, ph });
  }
}
const _lifeLit = new THREE.Color();
function updateLife(dt, night) {
  LIFE.t += dt;
  const day = 1 - night;
  for (const b of LIFE.birds) {
    b.ph += dt * b.sp; b.flap += dt * (9 + Math.sin(b.ph * 3) * 3);
    const a = b.ph, r = b.r + Math.sin(a * 1.7 + b.wob) * 8;
    b.s.position.set(Math.cos(a) * r, b.h + Math.sin(a * 2.3 + b.wob) * 4, Math.sin(a) * r * 0.8 - 4);
    b.t.offset.x = Math.floor(b.flap) % 3 === 0 ? 0.5 : 0;
    b.s.material.opacity = day; b.s.visible = day > 0.05 && VIEW.mode !== 'keep';
  }
  lifeShips();
  for (const L of LIFE.ships) {
    L.ph += dt * L.sp;
    const x = Math.cos(L.ph) * L.r, z = Math.sin(L.ph) * L.r * 0.9;
    L.s.root.position.set(x, L.h, z);
    L.s.root.rotation.y = Math.atan2(-L.r * Math.sin(L.ph) * Math.sign(L.sp), L.r * 0.9 * Math.cos(L.ph) * Math.sign(L.sp));
    L.s.update(dt, { calm: true });
    L.s.glow.material.uniforms.uScale.value = 0.6 * renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
  const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  if (LIFE.flies) { const u = LIFE.flies.material.uniforms; u.uTime.value = LIFE.t; u.uOn.value = smooth(0.35, 0.8, night); u.uScale.value = scale; }
  if (LIFE.dust) { const u = LIFE.dust.material.uniforms; u.uTime.value = LIFE.t * 0.4; u.uOn.value = 0.55; u.uScale.value = scale; }
  // by day only, and not in the rain (weather.js): motes, butterflies and bees
  const fair = day * (1 - (WEATHER.mix ? Math.min(1, (WEATHER.mix.rain || 0) + (WEATHER.mix.storm || 0)) : 0));
  if (LIFE.motes) { const u = LIFE.motes.material.uniforms; u.uTime.value = LIFE.t * 0.25; u.uOn.value = 0.45 * fair * TOD.sunlight; u.uScale.value = scale; }
  const lit = _lifeLit.setRGB(lerp(0.45, 1, day), lerp(0.48, 1, day), lerp(0.7, 1, day));
  if (LIFE.wings) { const u = LIFE.wings.material.uniforms; u.uTime.value = LIFE.t; u.uOn.value = smooth(0.3, 0.7, fair); u.uScale.value = scale; u.uLight.value.copy(lit); }
  if (LIFE.bees) { const u = LIFE.bees.material.uniforms; u.uTime.value = LIFE.t; u.uOn.value = smooth(0.3, 0.7, fair); u.uScale.value = scale; u.uLight.value.copy(lit); LIFE.beeT = (LIFE.beeT || 0) - dt; if (LIFE.beeT <= 0) { LIFE.beeT = 1; beesHome(); } }
}
