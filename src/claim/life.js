// ===================================================================== LIFE: what moves round the claim besides its people
// Swifts wheeling over the plateau by day, two distant airships crossing the Ironspire Peaks, fireflies along the rim
// at night, and dust hanging in the lamplight down the mine. All cheap: a handful of sprites and two batches of points.
const LIFE = { birds: [], ships: [], flies: null, dust: null, t: 0 };

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
  const G1 = MINE.g1, G2 = MINE.g2;
  LIFE.dust = glowPts(90, i => { const G = i % 3 ? G1 : G2; return [G.x0 + R() * (G.x1 - G.x0), G.y0 + 0.4 + R() * (G.y1 - G.y0 - 0.8), WORLD.faceZ - 0.5 - R() * (MINE.depth - 1)]; }, 0xffd9a0, 0.07);
}
// two airships far off, on long slow passes between the peaks (once the ship builder's art is in)
function lifeShips() {
  const A = SKY && SKY.shipArt; if (!A || LIFE.ships.length) return;
  for (const [id, r, h, sp, ph] of [['brig', 420, 40, 0.012, 1.2], ['cutter', 560, 75, -0.009, 4.1]]) {
    const R = SHIPS.find(s => s.id === id), s = buildShipFar(R, A);
    if (!s) return;
    s.root.traverse(o => { if (o.isMesh) o.castShadow = false; });   // hundreds of metres off: their shadows fall on nothing
    scene.add(s.root);
    LIFE.ships.push({ s, r, h, sp, ph });
  }
}
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
}
