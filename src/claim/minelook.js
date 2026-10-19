// ===================================================================== THE DIG'S LOOK: rooms in the rock, lamplight, carts, the cage
// Everything you see down the mine (the rules are in mine.js). The rock between the rooms is the face itself, cut
// with a hole for every room. Each room is a lit box running back into the rock, dressed by its row (sandstone, slate,
// the deep) and its level (bare rock, timber sets, iron arches), and furnished for its kind. The rooms' static parts
// are merged into a few meshes for the whole dig and rebuilt only when it changes. Lamplight is faked: every room
// lends one warm light to a small list the rock and timber shaders read, so there are no extra real lights.

// ----------------------------------------------------------------- the faked lamplight
const GLOW_MAX = 24;
const GLOW = { p: { value: Array.from({ length: GLOW_MAX }, () => new THREE.Vector4()) }, c: { value: Array.from({ length: GLOW_MAX }, () => new THREE.Vector3()) }, n: { value: 0 } };
function glowMat(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uGlowP = GLOW.p; sh.uniforms.uGlowC = GLOW.c; sh.uniforms.uGlowN = GLOW.n;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec4 uGlowP[${GLOW_MAX}]; uniform vec3 uGlowC[${GLOW_MAX}]; uniform int uGlowN;`)
      .replace('#include <opaque_fragment>', `{
        vec3 gP = -vViewPosition, gL = vec3(0.0);
        for (int i = 0; i < ${GLOW_MAX}; i++) {
          if (i >= uGlowN) break;
          vec3 d = uGlowP[i].xyz - gP; float dd = dot(d, d), f = max(0.0, 1.0 - dd / uGlowP[i].w); f *= f;
          gL += uGlowC[i] * f * (0.3 + 0.7 * max(dot(normal, d * inversesqrt(dd + 0.0001)), 0.0));
        }
        outgoingLight += diffuseColor.rgb * gL;
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'mineglow';
  return m;
}

// ----------------------------------------------------------------- the rock of each row, painted once
// soft gold sandstone in beds; blue-grey slate with cleavage and sunstone veins; the deep's dark plum rock, mottled,
// with amber and violet glints. Each has a floor version, darker and gravelly, and the lower two a glow map.
function digTierTextures() {
  const S = 512, out = [];
  const specs = [
    { base: '#9a7650', beds: ['#b88f60', '#86643f', '#a98252', '#c49c6c', '#94704a'], kind: 'sand' },
    { base: '#4a505c', beds: ['#565d6b', '#3f4450', '#5d6372', '#484d5a'], kind: 'slate' },
    { base: '#352a3c', beds: ['#3f3147', '#2c2232', '#45364e', '#30263a'], kind: 'deep' },
  ];
  const nine = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); };
  specs.forEach((sp, i) => {
    const R = mulberry(900 + i * 17), cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
    g.fillStyle = sp.base; g.fillRect(0, 0, S, S);
    // beds: wavy bands that wrap round left to right
    for (let y = 0; y < S;) {
      const h = 12 + R() * 44, col = sp.beds[R() * sp.beds.length | 0], a = R() * TAU, amp = 2 + R() * 7, f = 1 + (R() * 3 | 0);
      g.fillStyle = col; g.beginPath(); g.moveTo(0, y + amp * Math.sin(a));
      for (let x = 0; x <= S; x += 8) g.lineTo(x, y + amp * Math.sin(a + x / S * TAU * f));
      for (let x = S; x >= 0; x -= 8) g.lineTo(x, y + h + amp * Math.sin(a + 1 + x / S * TAU * f));
      g.fill(); y += h;
    }
    const rp = g.createPattern(IMG.rock, 'repeat'); rp.setTransform(new DOMMatrix().scale(S / IMG.rock.width, S / IMG.rock.width));
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.9; g.fillStyle = rp; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (sp.kind === 'slate') for (let k = 0; k < 70; k++) {   // cleavage: thin slanted cracks, dark with a pale lip
      const x = R() * S, y = R() * S, L = 20 + R() * 60, a = -0.9 + (R() - 0.5) * 0.3;
      nine((dx, dy) => { g.strokeStyle = 'rgba(20,22,30,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * L, y + dy + Math.sin(a) * L); g.stroke();
        g.strokeStyle = 'rgba(190,200,220,0.12)'; g.beginPath(); g.moveTo(x + dx + 1.5, y + dy + 1); g.lineTo(x + dx + 1.5 + Math.cos(a) * L, y + dy + 1 + Math.sin(a) * L); g.stroke(); });
    }
    if (sp.kind === 'deep') for (let k = 0; k < 90; k++) {    // mottling and pits
      const x = R() * S, y = R() * S, r = 4 + R() * 26, dark = R() < 0.6;
      nine((dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, dark ? 'rgba(14,8,20,0.45)' : 'rgba(120,90,140,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); });
    }
    // pick marks: the rooms were cut by hand
    for (let k = 0; k < 260; k++) { const x = R() * S, y = R() * S, l = 4 + R() * 9; g.strokeStyle = R() < 0.5 ? 'rgba(18,12,16,0.3)' : 'rgba(255,240,210,0.1)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 5, y + l); g.stroke(); }
    // the floor: the same rock, trodden darker, with gravel
    const fv = document.createElement('canvas'); fv.width = fv.height = S; const f = fv.getContext('2d');
    f.drawImage(cv, 0, 0); f.globalCompositeOperation = 'multiply'; f.fillStyle = 'rgb(150,140,135)'; f.fillRect(0, 0, S, S); f.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 900; k++) { const x = R() * S, y = R() * S, s = 1 + R() * 3; f.fillStyle = R() < 0.5 ? 'rgba(20,14,16,0.5)' : 'rgba(230,215,190,0.22)'; f.fillRect(x, y, s, s); }
    // sunstone veins in the slate and the deep, for the glow map
    let em = null;
    if (sp.kind !== 'sand') {
      em = document.createElement('canvas'); em.width = em.height = 256; const e = em.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, 256, 256);
      for (let k = 0; k < (sp.kind === 'deep' ? 7 : 5); k++) {
        let x = R() * 256, y = R() * 256, a = (R() - 0.5) * 1.2 + (R() < 0.5 ? 0 : Math.PI);
        for (let s = 0; s < 22; s++) {
          const nx = x + Math.cos(a) * 6, ny = y + Math.sin(a) * 4, w = 2.2 * (1 - s / 22) + 0.5;
          nine((dx, dy) => { e.strokeStyle = `rgba(255,${150 + R() * 60 | 0},60,0.9)`; e.lineWidth = w; e.lineCap = 'round'; e.beginPath(); e.moveTo((x + dx / 2), (y + dy / 2)); e.lineTo(nx + dx / 2, ny + dy / 2); e.stroke(); });
          x = (nx + 256) % 256; y = (ny + 256) % 256; a += (R() - 0.5) * 0.7;
        }
      }
      for (let k = 0; k < 120; k++) { e.fillStyle = sp.kind === 'deep' && R() < 0.4 ? 'rgba(170,140,255,0.8)' : `rgba(255,190,90,${0.4 + R() * 0.6})`; e.fillRect(R() * 256, R() * 256, 2, 2); }
    }
    out.push({ map: canvasTex(cv, { repeat: true }), floor: canvasTex(fv, { repeat: true }), emis: em ? canvasTex(em, { repeat: true }) : null });
  });
  return out;
}

// ----------------------------------------------------------------- materials
const DM = {};
function digMats() {
  if (DM.ok) return; DM.ok = true;
  faceMat.onBeforeCompile = sh => {
    sh.uniforms.uDetail = { value: tex('rock') };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dl = dot(texture2D(uDetail, vMapUv * vec2(${(STRATA.WX / 3).toFixed(2)}, ${(STRATA.HY / 3).toFixed(2)})).rgb, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb *= mix(1.0, dl * 2.1, 0.5);`);
  };
  faceMat.customProgramCacheKey = () => 'facedetail'; faceMat.needsUpdate = true;
  const std = (o, env = 0.15) => glowMat(trackEnv(new THREE.MeshStandardMaterial(o), env));
  const T = digTierTextures();
  DM.wall = T.map((t, i) => std({ map: t.map, color: [0xb8b0a8, 0xb8bcc8, 0xc0b0c8][i], roughness: i === 1 ? 0.78 : 0.95, emissiveMap: t.emis, emissive: t.emis ? 0xffffff : 0x000000, emissiveIntensity: t.emis ? 0.55 : 0 }));
  DM.floor = T.map(t => std({ map: t.floor, color: 0xb0a8a0, roughness: 1 }));
  DM.ceil = T.map(t => std({ map: t.map, color: 0x6a6268, roughness: 1 }));
  DM.oak = std({ map: tex('oak'), color: 0xc8b8a8, roughness: 0.85 }, 0.2);
  DM.oakDark = std({ map: tex('oak'), color: 0x7a6656, roughness: 0.9 }, 0.15);
  DM.boards = std({ map: tex('boards'), color: 0xb8a898, roughness: 0.9 }, 0.15);
  DM.iron = std({ map: tex('iron'), roughness: 0.5, metalness: 0.7 }, 0.5);
  DM.brass = std({ map: tex('brass'), color: 0xd8c8b0, roughness: 0.38, metalness: 0.85 }, 0.7);
  DM.copper = std({ map: tex('copper'), roughness: 0.5, metalness: 0.4 }, 0.6);
  DM.dressed = std({ map: tex('dressed'), color: 0xb8aa98, roughness: 0.9 }, 0.15);
  DM.rock = std({ map: tex('rock'), color: 0x9a8c80, roughness: 0.97 }, 0.1);
  DM.ore = std({ color: 0x40362f, roughness: 0.8, flatShading: true, emissive: 0x9a4a10, emissiveIntensity: 0.55 }, 0.2);
  // crystal makes its own light: it doesn't take the lamplight too
  DM.crystal = trackEnv(new THREE.MeshStandardMaterial({ color: 0xc8843a, emissive: 0xff8a24, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.1, flatShading: true }), 0.6);
  DM.crystalBlue = trackEnv(new THREE.MeshStandardMaterial({ color: 0x7a6aa8, emissive: 0x6a4cff, emissiveIntensity: 0.5, roughness: 0.2, flatShading: true }), 0.5);
  DM.canvas = std({ map: tex('canvas'), roughness: 0.95, side: THREE.DoubleSide }, 0.2);
  DM.rope = std({ color: 0xb59a70, roughness: 1 }, 0.1);
  DM.root = std({ color: 0x5a4030, roughness: 1 }, 0.05);
  DM.cream = std({ color: 0xefe4c8, roughness: 0.7 }, 0.2);
  DM.glass = std({ color: 0x9ab8b0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.5, depthWrite: false }, 0.45);
  DM.puddle = std({ color: 0x0e1418, roughness: 0.12, metalness: 0.0 }, 0.35);
  DM.water = glowMat(trackEnv(new THREE.MeshStandardMaterial({ color: 0x2d5a66, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.8 }), 0.9));
  DM.dark = new THREE.MeshBasicMaterial({ color: 0x0c0810 });
  DM.lamp = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  DM.seam = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.95, toneMapped: false, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  DM.seamGlow = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,170,70,0.9)', 'rgba(255,120,30,0)', 128), transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
  DM.gas = new THREE.MeshBasicMaterial({ color: 0xb8d060, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  DM.hit = new THREE.MeshBasicMaterial({ visible: false });
}

// ----------------------------------------------------------------- the dig's parts in the scene
const DLOOK = { static: null, front: null, hits: [], hitGroup: null, lights: [], lanterns: [], lant: null, lantCore: null, dyn: [], dynGroup: null, carts: [], cartMesh: null,
  cage: null, rope: null, tub: null, outlines: null, outlineList: [], dust: null, inc: new Map(), plugs: new Map(), debris: null, debrisList: [], sig: '' };
const RAIL_Z = WORLD.faceZ - 3.7;
let DL = null;                       // the group being filled
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _p4 = new THREE.Vector3(), _s4 = new THREE.Vector3();
// put a piece in place: baked into world space, with textures in metres, ready to merge
function dput(geo, mat, x, y, z, o = {}) {
  _e4.set(o.rx || 0, o.ry || 0, o.rz || 0); _q4.setFromEuler(_e4);
  _m4.compose(_p4.set(x, y, z), _q4, _s4.set(...(o.s || [1, 1, 1])));
  geo.applyMatrix4(_m4);
  if (mat.map && !o.keepUV) geo = projUV(geo, o.uv || 2); else if (geo.index) geo = geo.toNonIndexed();
  const m = new THREE.Mesh(geo, mat); m.castShadow = !!o.cast; m.receiveShadow = true; (o.parent || DL).add(m); return m;
}
const dbox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const dplane = (w, h) => new THREE.PlaneGeometry(w, h);
const dcyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

// ----------------------------------------------------------------- rebuilding the whole dig
function buildDigLook() {
  digMats();
  if (!DLOOK.hitGroup) digLookOnce();
  if (DLOOK.static) { scene.remove(DLOOK.static); DLOOK.static.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  for (const d of DLOOK.dyn) d.obj.parent && d.obj.parent.remove(d.obj);
  DLOOK.dyn = []; DLOOK.lights = []; DLOOK.lanterns = [];
  const g = new THREE.Group(); g.name = 'dig'; DL = g;
  for (const R of DIG.rooms) digRoomLook(R);
  for (const d of DIG.digs) digSiteLook(d);
  digShaftLook();
  mergeStatic(g); scene.add(g); DLOOK.static = g;
  digFront(); digHits(); digLanterns(); digOutlines(); digDust(); digCartsLayout();
  for (const d of [...DLOOK.plugs.keys()]) if (!DIG.digs.includes(d)) { plugOff(d); }
  for (const d of DIG.digs) if (!DLOOK.plugs.has(d)) plugOn(d);
  DL = null;
}
// things made once: the hit boxes' group, the instanced lanterns, the carts, the cage, debris
function digLookOnce() {
  DLOOK.hitGroup = new THREE.Group(); DLOOK.hitGroup.name = 'dighits'; scene.add(DLOOK.hitGroup);
  DLOOK.dynGroup = new THREE.Group(); scene.add(DLOOK.dynGroup);
  // lanterns: a chain, a cap, a cage and a glowing core, hanging from a hook (the geometry's origin) so they can sway
  const parts = [[0.035, 0.42, 0.035, 0, -0.21, 0], [0.3, 0.07, 0.3, 0, -0.45, 0], [0.32, 0.06, 0.32, 0, -0.87, 0]];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push([0.035, 0.36, 0.035, sx * 0.12, -0.66, sz * 0.12]);
  const body = mergeGeometries(parts.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed()));
  const core = new THREE.OctahedronGeometry(1, 0).scale(0.12, 0.19, 0.12).translate(0, -0.66, 0);
  DLOOK.lant = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.7 }), 96);
  DLOOK.lantCore = new THREE.InstancedMesh(core, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 96);
  for (const m of [DLOOK.lant, DLOOK.lantCore]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
  // carts: an iron tub on four wheels with a timber rim, and a heap of ore
  const C = 14;
  const tub = mergeGeometries([projUV(new THREE.BoxGeometry(1.3, 0.55, 0.9).translate(0, 0.62, 0), 1), projUV(new THREE.BoxGeometry(1.0, 0.12, 0.7).translate(0, 0.3, 0), 1)]);
  const rim = projUV(new THREE.BoxGeometry(1.38, 0.08, 0.98).translate(0, 0.92, 0), 1);
  const wheels = mergeGeometries([[-0.42, -0.47], [0.42, -0.47], [-0.42, 0.47], [0.42, 0.47]].map(([x, z]) => new THREE.CylinderGeometry(0.17, 0.17, 0.07, 10).rotateX(Math.PI / 2).translate(x, 0.2, z).toNonIndexed()));
  const R = mulberry(77), lumps = [];
  for (let i = 0; i < 9; i++) lumps.push(new THREE.DodecahedronGeometry(0.14 + R() * 0.1, 0).translate((R() - 0.5) * 1.0, 0.92 + R() * 0.16, (R() - 0.5) * 0.6));
  const ore = mergeGeometries(lumps);
  DLOOK.cartMesh = [[tub, DM.iron], [rim, DM.oakDark], [wheels, DM.iron], [ore, DM.ore]].map(([geo, mat]) => { const m = new THREE.InstancedMesh(geo, mat, C); m.count = 0; m.frustumCulled = false; m.receiveShadow = true; scene.add(m); return m; });
  // the lift cage: a timber floor, an iron roof and posts, bars round three sides (the front is open, so you see who
  // is riding), an ore tub, and a lamp on the roof
  const cage = new THREE.Group(); DL = cage;
  dput(dbox(1.6, 0.12, 1.6), DM.boards, 0, 0.06, 0);
  dput(dbox(1.7, 0.1, 1.7), DM.iron, 0, 2.25, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) dput(dbox(0.07, 2.2, 0.07), DM.iron, sx * 0.78, 1.16, sz * 0.78);
  for (let i = 0; i < 6; i++) dput(dbox(0.03, 2.1, 0.03), DM.iron, -0.65 + i * 0.26, 1.16, -0.78);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) dput(dbox(0.03, 2.1, 0.03), DM.iron, sx * 0.78, 1.16, -0.55 + i * 0.27);
  dput(dbox(1.6, 0.06, 0.06), DM.brass, 0, 1.1, 0.8);
  dput(dbox(0.5, 0.5, 0.5), DM.brass, 0, 2.5, 0);
  mergeStatic(cage);
  DLOOK.tub = new THREE.Group(); DL = DLOOK.tub;
  dput(dbox(0.9, 0.45, 0.6), DM.iron, 0, 0.35, -0.35);
  for (let i = 0; i < 6; i++) dput(new THREE.DodecahedronGeometry(0.13 + R() * 0.08, 0), DM.ore, (R() - 0.5) * 0.7, 0.62 + R() * 0.1, -0.35 + (R() - 0.5) * 0.4);
  mergeStatic(DLOOK.tub); cage.add(DLOOK.tub);
  DL = null;
  cage.position.set(CAGE_X, CAGE.y, CAGE_Z); scene.add(cage); DLOOK.cage = cage;
  DLOOK.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), DM.rope); DLOOK.rope.frustumCulled = false; scene.add(DLOOK.rope);
  // debris: chunks of rock that fall out of a dig or a cave-in and come to rest on the floor
  DLOOK.debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), DM.rock, 48); DLOOK.debris.count = 0; DLOOK.debris.frustumCulled = false; scene.add(DLOOK.debris);
}

// ----------------------------------------------------------------- the rock front: the face, with a hole for every room
function digFront() {
  if (DLOOK.front) { scene.remove(DLOOK.front); DLOOK.front.geometry.dispose(); }
  const P = minePolygon(), x0 = P[0][0], x1 = P[1][0], y1 = P[0][1], y0 = P[2][1], V = (x, y) => new THREE.Vector2(x, y);
  const shape = new THREE.Shape([V(x0, y0), V(x1, y0), V(x1, y1), V(x0, y1)]);
  const hole = (a, b, c, d) => shape.holes.push(new THREE.Path([V(a, c), V(b, c), V(b, d), V(a, d)]));
  for (const R of DIG.rooms) hole(cellX0(R.c0), cellX1(R.c0 + R.w - 1), rowY0(R.r), rowY1(R.r));
  for (const d of DIG.digs) hole(cellX0(d.c), cellX1(d.c), rowY0(d.r), rowY1(d.r));
  hole(MINE.shaft.x0 + DIGIN, MINE.shaft.x1 - DIGIN, rowY0(shaftBottom()), MINE.shaftTop);
  const geo = new THREE.ShapeGeometry(shape); geo.translate(0, 0, WORLD.faceZ); faceUV(geo);
  const m = new THREE.Mesh(geo, faceMat); m.receiveShadow = true; m.castShadow = true; m.name = 'digfront'; scene.add(m); DLOOK.front = m;
}
// what can be tapped: each room and dig, each cell you could dig, and the shaft
function digHits() {
  const G = DLOOK.hitGroup; for (const m of [...G.children]) { G.remove(m); m.geometry.dispose(); } DLOOK.hits = [];
  const add = (x0, x1, y0, y1, ud) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), DM.hit); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WORLD.faceZ + 0.05); Object.assign(m.userData, ud); G.add(m); DLOOK.hits.push(m); };
  for (const R of DIG.rooms) add(cellX0(R.c0), cellX1(R.c0 + R.w - 1), rowY0(R.r), rowY1(R.r), { id: R.id });
  for (const d of DIG.digs) add(cellX0(d.c), cellX1(d.c), rowY0(d.r), rowY1(d.r), { id: d.id });
  for (let r = 0; r <= Math.min(MINE.rows - 1, digReach() + 1); r++) for (let c = 0; c < MINE.cols; c++) {
    if (digAt(r, c)) continue;
    const near = digAt(r, c + 1) || digAt(r, c - 1) || c === MINE.cols - 1;
    if (near) add(cellX0(c), cellX1(c), rowY0(r), rowY1(r), { cell: true, r, c });
  }
  add(MINE.shaft.x0 + DIGIN, MINE.shaft.x1 - DIGIN, rowY0(shaftBottom()), MINE.shaftTop, { shaft: true });
  G.updateMatrixWorld(true);
}

// ----------------------------------------------------------------- a room
function digRoomLook(R) {
  const t = tierOf(R.r), x0 = cellX0(R.c0), x1 = cellX1(R.c0 + R.w - 1), y0 = rowY0(R.r), y1 = rowY1(R.r);
  const wOpen = !!digAt(R.r, R.c0 - 1), eOpen = R.c0 + R.w === MINE.cols ? R.r <= shaftBottom() : !!digAt(R.r, R.c0 + R.w);
  digShell(x0, x1, y0, y1, t, wOpen, eOpen);
  digLevel(R, x0, x1, y0, y1, wOpen, eOpen);
  digTierDress(R, x0, x1, y0, y1, t);
  (FURNISH[R.kind] || (() => { }))(R, x0, x1, y0, y1, t);
  // the room's lamplight, and its lanterns
  const K = ({ grotto: [1.9, 0.95, 0.38], seam: [2.6, 1.65, 0.7], lamp: [2.5, 1.75, 1.0], pump: [1.5, 1.75, 2.0], assay: [1.95, 1.9, 1.7], depot: [2.1, 1.55, 1.05] }[R.kind] || (R.lv >= 3 ? [2.0, 1.85, 1.55] : R.lv >= 2 ? [2.1, 1.55, 0.95] : [2.0, 1.4, 0.8]));
  digSign(R, x0, x1, y1);
  DLOOK.lights.push({ room: R, x: (x0 + x1) / 2, y: y1 - 1.3, z: WORLD.faceZ - 1.9, r: 4.2 + 2.4 * R.w + (R.kind === 'seam' ? 2.5 : 0), col: K, k: 1 });
  for (let i = 0; i < R.w; i++) {
    const cx = MINE.colX0(R.c0 + i) + MINE.cw / 2, xs = R.lv === 1 ? [0] : [-1.15, 1.15];
    for (const dx of xs) DLOOK.lanterns.push({ room: R, x: cx + dx, y: y1 - 0.02, z: WORLD.faceZ - 1.35 - (dx > 0 ? 0.3 : 0), lv: R.lv, ph: Math.random() * TAU });
  }
}
// a painted sign over the middle of the back wall, one per room, from the icon atlas
let SIGN_TEX = null;
const SIGN_KINDS = ['face', 'grotto', 'pump', 'shore', 'depot', 'assay', 'lamp', 'seam'];
function signTex() {
  if (SIGN_TEX) return SIGN_TEX;
  const n = SIGN_KINDS.length, S = 128, c = document.createElement('canvas'); c.width = S * n; c.height = S; const g = c.getContext('2d');
  SIGN_TEX = canvasTex(c);
  SIGN_KINDS.forEach((k, i) => {
    const x = i * S;
    g.fillStyle = '#5a3a22'; g.beginPath(); g.roundRect(x + 4, 10, S - 8, S - 20, 14); g.fill();
    g.fillStyle = '#e8d8b2'; g.beginPath(); g.roundRect(x + 11, 17, S - 22, S - 34, 9); g.fill();
    g.strokeStyle = '#c99a3c'; g.lineWidth = 3; g.beginPath(); g.roundRect(x + 8, 14, S - 16, S - 28, 11); g.stroke();
    const im = new Image(); im.onload = () => { g.drawImage(im, x + 20, 22, S - 40, S - 44); SIGN_TEX.needsUpdate = true; };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="88" viewBox="0 0 48 44">${DIG_ICON[k] || ''}</svg>`);
  });
  return SIGN_TEX;
}
function digSign(R, x0, x1, y1) {
  if (!DM.sign) DM.sign = glowMat(trackEnv(new THREE.MeshStandardMaterial({ map: signTex(), color: 0xd8ccb8, roughness: 0.8, emissive: 0xffffff, emissiveMap: signTex(), emissiveIntensity: 0.06 }), 0.1));
  const i = SIGN_KINDS.indexOf(R.kind); if (i < 0) return;
  const geo = dplane(0.95, 0.8), uv = geo.attributes.uv, n = SIGN_KINDS.length;
  for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / n);
  const BZ = WORLD.faceZ - MINE.depth, cx = (x0 + x1) / 2;
  dput(geo, DM.sign, cx, y1 - 0.62, BZ + 0.06, { keepUV: true });
  for (const dx of [-0.3, 0.3]) dput(dbox(0.04, 0.2, 0.04), DM.iron, cx + dx, y1 - 0.12, BZ + 0.06);
}
// the rock box: back wall, floor, ceiling, and the ends (a doorway where another room or the shaft is next door)
function digShell(x0, x1, y0, y1, t, wOpen, eOpen, raw = false) {
  const W = x1 - x0, H = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, D = MINE.depth, FZ = WORLD.faceZ, BZ = FZ - D, cz = FZ - D / 2;
  dput(dplane(W, H), DM.wall[t], cx, cy, BZ, { uv: 4 });
  dput(dplane(W, D), DM.floor[t], cx, y0, cz, { rx: -Math.PI / 2, uv: 4 });
  dput(dplane(W, D), DM.ceil[t], cx, y1, cz, { rx: Math.PI / 2, uv: 4 });
  for (const [x, dir, open] of [[x0, 1, wOpen], [x1, -1, eOpen]]) {
    if (!open) { dput(dplane(D, H), DM.wall[t], x, cy, cz, { ry: dir * Math.PI / 2, uv: 4 }); continue; }
    const DH = 2.9;
    dput(dplane(0.9, H), DM.wall[t], x, cy, FZ - 0.45, { ry: dir * Math.PI / 2, uv: 4 });
    dput(dplane(0.8, H), DM.wall[t], x, cy, BZ + 0.4, { ry: dir * Math.PI / 2, uv: 4 });
    dput(dplane(D - 1.7, H - DH), DM.wall[t], x, y0 + DH + (H - DH) / 2, cz - 0.05, { ry: dir * Math.PI / 2, uv: 4 });
    // the passage through the rock between the two, floored and roofed, with a timber door frame
    dput(dplane(DIGIN * 2, D - 1.7), DM.floor[t], x - dir * DIGIN, y0 + 0.005, cz - 0.05, { rx: -Math.PI / 2, uv: 4 });
    dput(dplane(DIGIN * 2, D - 1.7), DM.ceil[t], x - dir * DIGIN, y0 + DH, cz - 0.05, { rx: Math.PI / 2, uv: 4 });
    dput(dplane(DIGIN * 2, DH), DM.wall[t], x - dir * DIGIN, y0 + DH / 2, BZ + 0.8, { uv: 4 });
    if (!raw) {
      dput(dbox(0.16, DH, 0.16), DM.oakDark, x + dir * 0.08, y0 + DH / 2, FZ - 0.95);
      dput(dbox(0.16, DH, 0.16), DM.oakDark, x + dir * 0.08, y0 + DH / 2, BZ + 0.85);
      dput(dbox(0.18, 0.18, D - 1.6), DM.oakDark, x + dir * 0.09, y0 + DH - 0.05, cz - 0.05);
    }
  }
}
// level: rough props at the opening (1), timber sets and plank walkway (2), iron arches and crystal lamps (3); rails
function digLevel(R, x0, x1, y0, y1, wOpen, eOpen) {
  const lv = R.lv, FZ = WORLD.faceZ, D = MINE.depth, BZ = FZ - D, H = y1 - y0;
  if (R.kind === 'seam') { dput(dbox(0.22, H, 0.22), DM.oakDark, x0 + 0.2, y0 + H / 2, FZ - 0.25, { rz: 0.06 }); dput(dbox(x1 - x0, 0.2, 0.24), DM.oakDark, (x0 + x1) / 2, y1 - 0.12, FZ - 0.25, { rz: -0.02 }); }
  else if (lv === 1) {
    for (const x of [x0 + 0.18, x1 - 0.18]) dput(dbox(0.22, H, 0.22), DM.oak, x, y0 + H / 2, FZ - 0.3, { rz: (x - x0) * 0.01 - 0.02 });
    dput(dbox(x1 - x0, 0.2, 0.24), DM.oak, (x0 + x1) / 2, y1 - 0.12, FZ - 0.3);
  } else {
    const n = Math.max(2, Math.round((x1 - x0) / 1.55)), mat = lv >= 3 ? DM.iron : DM.oak;
    for (let i = 0; i <= n; i++) {
      const x = x0 + 0.16 + i * (x1 - x0 - 0.32) / n, th = lv >= 3 ? 0.16 : 0.22;
      for (const z of [BZ + 0.2, FZ - 0.3]) dput(dbox(th, H, th), mat, x, y0 + H / 2, z);
      dput(dbox(th, th, D - 0.3), mat, x, y1 - 0.12, FZ - D / 2 - 0.05);
      if (lv >= 3) for (const z of [BZ + 0.55, FZ - 0.65]) dput(dbox(0.08, 0.7, 0.08), DM.iron, x, y1 - 0.42, z, { rx: z < FZ - 2 ? 0.78 : -0.78 });
    }
    dput(dbox(x1 - x0, 0.06, 2.2), DM.boards, (x0 + x1) / 2, y0 + 0.03, FZ - 1.15, { uv: 2 });
    if (lv >= 3) dput(dbox(x1 - x0, 0.16, 0.3), DM.dressed, (x0 + x1) / 2, y0 + 0.08, FZ - 0.15);
  }
  // rails along the back, carrying on through the doors; timber at level 1, iron after
  if (R.kind !== 'seam' || true) {
    const ra = x0 - (wOpen ? DIGIN + 0.02 : -0.1), rb = x1 + (eOpen ? DIGIN + 0.02 : -0.1), rm = lv >= 2 ? DM.iron : DM.oakDark;
    for (const dz of [-0.33, 0.33]) dput(dbox(rb - ra, 0.07, 0.07), rm, (ra + rb) / 2, y0 + 0.1, RAIL_Z + dz);
    for (let x = ra + 0.3; x < rb - 0.1; x += 0.75) dput(dbox(0.2, 0.05, 1.05), DM.oakDark, x, y0 + 0.035, RAIL_Z);
  }
}
// the rock of the row: roots under the grass, veins and puddles in the slate, geodes and burrows in the deep
function digTierDress(R, x0, x1, y0, y1, t) {
  const Rn = mulberry(R.r * 131 + R.c0 * 17 + 7), FZ = WORLD.faceZ, BZ = FZ - MINE.depth;
  for (let i = 0; i < R.w; i++) {
    const cx = MINE.colX0(R.c0 + i) + MINE.cw / 2;
    if (t === 0) {
      if (R.r === 0) for (let k = 0; k < 5; k++) { const L = 0.4 + Rn() * 1.1; dput(dcyl(0.012, 0.035, L, 4), DM.root, cx + (Rn() - 0.5) * 3.8, y1 - L / 2, BZ + 0.3 + Rn() * 3.6, { rz: (Rn() - 0.5) * 0.4 }); }
      dput(new THREE.DodecahedronGeometry(0.35 + Rn() * 0.25, 0), DM.rock, cx + (Rn() - 0.5) * 3, y0 + 0.2, BZ + 0.45, { s: [1.3, 0.7, 1], uv: 1.5 });
    } else if (t === 1) {
      for (let k = 0; k < 4; k++) dput(new THREE.OctahedronGeometry(1, 0), DM.crystal, cx - 1.8 + k * 1.2 + Rn() * 0.4, y0 + 2.7 + Rn() * 0.9, BZ + 0.04, { rx: Math.PI / 2 - 0.3, rz: (Rn() - 0.5) * 1.2, s: [0.06, 0.16 + Rn() * 0.1, 0.06] });
      dput(new THREE.CircleGeometry(0.4 + Rn() * 0.4, 14), DM.puddle, cx + (Rn() - 0.5) * 3, y0 + 0.012, FZ - 0.8 - Rn() * 0.8, { rx: -Math.PI / 2, s: [1.6, 1, 1] });
    } else {
      // a geode high on the back wall: a ring of rock round a nest of crystal
      const gx = cx + (Rn() < 0.5 ? -1 : 1) * (1.15 + Rn() * 0.5), gy = y0 + 2.9 + Rn() * 0.3;
      dput(new THREE.CircleGeometry(0.42, 12), DM.dark, gx, gy, BZ + 0.02, { s: [1.25, 0.85, 1] });
      for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; dput(new THREE.DodecahedronGeometry(0.11 + Rn() * 0.06, 0), DM.rock, gx + Math.cos(a) * 0.5, gy + Math.sin(a) * 0.36, BZ + 0.04, { s: [1, 1, 0.5], uv: 1 }); }
      for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + 0.3; dput(new THREE.OctahedronGeometry(1, 0), k % 3 ? DM.crystal : DM.crystalBlue, gx + Math.cos(a) * 0.3, gy + Math.sin(a) * 0.2, BZ + 0.08, { rz: a + Math.PI / 2, s: [0.05, 0.14 + Rn() * 0.06, 0.05] }); }
      // a Wildlight burrow at the foot of every other cell: a dark hole with a faint glowing rim
      if ((R.c0 + i) % 2 === 0) { const bx = cx + (Rn() < 0.5 ? -1.3 : 1.3); dput(new THREE.CircleGeometry(0.42, 14), DM.dark, bx, y0 + 0.42, BZ + 0.02, { s: [1.2, 0.8, 1] }); dput(new THREE.TorusGeometry(0.44, 0.025, 4, 16), DM.seam, bx, y0 + 0.42, BZ + 0.03, { s: [1.2, 0.8, 1] }); dput(dplane(1.6, 1.2), DM.seamGlow, bx, y0 + 0.42, BZ + 0.035); }
    }
  }
}
// ----------------------------------------------------------------- furnishing each kind of room
// (cx: the middle of each cell; people stand 1.15 either side of it, side-on to what they work at)
const cellsOf = R => Array.from({ length: R.w }, (_, i) => MINE.colX0(R.c0 + i) + MINE.cw / 2);
function outcrop(x, y0, sz, mat = DM.rock, glow = DM.crystal, Rn = Math.random) {
  for (let k = 0; k < 3; k++) dput(new THREE.DodecahedronGeometry(0.42 + Rn() * 0.18, 0), mat, x + (Rn() - 0.5) * 0.35, y0 + 0.3 + k * 0.32, sz - 0.25 + (Rn() - 0.5) * 0.4, { s: [0.9, 0.8, 1.1], uv: 1.5 });
  for (let k = 0; k < 4; k++) dput(new THREE.DodecahedronGeometry(0.1 + Rn() * 0.08, 0), DM.ore, x + (Rn() - 0.5) * 0.6, y0 + 0.5 + Rn() * 0.8, sz + 0.1 + (Rn() - 0.5) * 0.4);
  for (let k = 0; k < 3; k++) dput(new THREE.OctahedronGeometry(1, 0), glow, x + (Rn() - 0.5) * 0.6, y0 + 0.7 + Rn() * 0.6, sz + 0.15, { rz: (Rn() - 0.5) * 1.4, s: [0.05, 0.14, 0.05] });
}
function cluster(x, y, z, n, s, Rn, mats = [DM.crystal], o = {}) {
  for (let k = 0; k < n; k++) {
    const h = s * (0.6 + Rn() * 0.7), a = (Rn() - 0.5) * 1.1, b = (Rn() - 0.5) * 1.1;
    dput(new THREE.OctahedronGeometry(1, 0), mats[k % mats.length], x + (Rn() - 0.5) * s * 1.2, y + (o.down ? -h * 0.9 : h * 0.9), z + (Rn() - 0.5) * s, { rx: (o.down ? Math.PI : 0) + a, rz: b, s: [h * 0.32, h, h * 0.32] });
  }
}
function cartStatic(x, y0, z, ore = true) {
  dput(dbox(1.3, 0.55, 0.9), DM.iron, x, y0 + 0.62, z, { uv: 1 }); dput(dbox(1.38, 0.08, 0.98), DM.oakDark, x, y0 + 0.92, z, { uv: 1 });
  for (const [dx, dz] of [[-0.42, -0.47], [0.42, -0.47], [-0.42, 0.47], [0.42, 0.47]]) dput(dcyl(0.17, 0.17, 0.07), DM.iron, x + dx, y0 + 0.2, z + dz, { rx: Math.PI / 2 });
  if (ore) for (let k = 0; k < 6; k++) dput(new THREE.DodecahedronGeometry(0.14 + Math.random() * 0.08, 0), DM.ore, x + (Math.random() - 0.5) * 0.9, y0 + 0.98, z + (Math.random() - 0.5) * 0.55);
}
function dynObj(R, kind, x, y, z, build, o = {}) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); DLOOK.dynGroup.add(grp);
  const keep = DL; DL = grp; build(); DL = keep;
  // dput baked world positions; shift the pieces back to the group's origin
  grp.traverse(m => { if (m.isMesh) m.geometry.translate(-x, -y, -z); });
  DLOOK.dyn.push({ obj: grp, room: R, kind, axis: o.axis || 'z', speed: o.speed || 1, amp: o.amp || 0.3, ph: Math.random() * TAU });
  return grp;
}
const FURNISH = {
  face(R, x0, x1, y0, y1, t) {
    const Rn = mulberry(R.r * 7 + R.c0 * 3 + 1), FZ = WORLD.faceZ, BZ = FZ - MINE.depth;
    for (const cx of cellsOf(R)) {
      outcrop(cx - 1.95, y0, 33.75, DM.rock, DM.crystal, Rn); outcrop(cx + 1.95, y0, 33.75, DM.rock, DM.crystal, Rn);
      // picks against the wall, spoil in the corner
      for (const dx of [-0.25, 0.1]) { dput(dbox(0.06, 1.2, 0.06), DM.oak, cx + dx, y0 + 0.6, BZ + 0.35, { rz: 0.22 }); dput(dbox(0.5, 0.07, 0.07), DM.iron, cx + dx + 0.12, y0 + 1.18, BZ + 0.35, { rz: 0.22 }); }
      for (let k = 0; k < 6; k++) dput(new THREE.DodecahedronGeometry(0.12 + Rn() * 0.12, 0), DM.rock, cx + 0.9 + Rn() * 0.5, y0 + 0.1 + Rn() * 0.15, BZ + 0.4 + Rn() * 0.5, { uv: 1 });
      if (R.lv === 1) { dput(dbox(0.6, 0.32, 0.45), DM.oak, cx - 0.5, y0 + 0.32, FZ - 0.6, { uv: 1 }); dput(dcyl(0.15, 0.15, 0.06), DM.iron, cx - 0.85, y0 + 0.15, FZ - 0.6, { rz: Math.PI / 2 }); }
      else { dput(dbox(1.0, 0.7, 0.6), DM.oakDark, cx, y0 + 2.2, BZ + 0.35); dput(dbox(0.9, 0.06, 0.9), DM.iron, cx, y0 + 1.75, BZ + 0.75, { rx: -0.6 }); }
    }
    if (R.lv >= 3) {   // the steam drill, on the rails at the far end
      const x = x0 + 0.95, y = y0, z = RAIL_Z;
      dput(dbox(1.2, 0.3, 1.0), DM.iron, x, y + 0.35, z);
      for (const [dx, dz] of [[-0.4, -0.45], [0.4, -0.45], [-0.4, 0.45], [0.4, 0.45]]) dput(dcyl(0.18, 0.18, 0.07), DM.iron, x + dx, y + 0.2, z + dz, { rx: Math.PI / 2 });
      dput(dcyl(0.38, 0.38, 1.1, 14), DM.copper, x, y + 0.95, z + 0.1, { rz: Math.PI / 2 });
      dput(dcyl(0.08, 0.1, 0.9, 8), DM.iron, x - 0.2, y + 1.6, z + 0.1);
      dput(new THREE.ConeGeometry(0.2, 0.7, 10), DM.iron, x, y + 0.9, z - 0.75, { rx: -Math.PI / 2 });
      dput(dbox(0.12, 0.12, 0.5), DM.brass, x + 0.4, y + 1.05, z - 0.2);
    }
  },
  grotto(R, x0, x1, y0, y1, t) {
    const Rn = mulberry(R.r * 11 + R.c0 * 5 + 2), FZ = WORLD.faceZ, BZ = FZ - MINE.depth, S = [0.9, 1.0, 1.15, 1.35][R.lv], mats = t === 2 ? [DM.crystal, DM.crystalBlue] : [DM.crystal];
    for (const cx of cellsOf(R)) {
      for (const sx of [-1, 1]) cluster(cx + sx * 1.95, y0, 33.8, 6, 0.5 * S, Rn, mats);
      cluster(cx + (Rn() - 0.5) * 1.6, y0 + 0.9 + Rn() * 0.8, BZ + 0.25, 5, 0.4 * S, Rn, mats);
      cluster(cx + (Rn() - 0.5) * 2.6, y1, BZ + 1 + Rn() * 2.4, 4, 0.35 * S, Rn, mats, { down: true });
      if (R.lv >= 2) for (const sx of [-1, 1]) {   // brass growing frames
        const x = cx + sx * 1.95;
        for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) dput(dbox(0.04, 1.3, 0.04), DM.brass, x + dx, y0 + 0.65, 33.8 + dz);
        dput(dbox(0.95, 0.05, 0.95), DM.brass, x, y0 + 1.3, 33.8);
      }
      if (R.lv >= 3) { dput(dbox(0.05, 1.6, 0.05), DM.brass, cx, y0 + 0.8, BZ + 0.9); dput(new THREE.TorusGeometry(0.32, 0.04, 6, 18), DM.brass, cx, y0 + 1.7, BZ + 0.9, { rx: -0.5 }); dput(new THREE.CircleGeometry(0.3, 18), DM.glass, cx, y0 + 1.7, BZ + 0.92, { rx: -0.5 }); }
      // the cutter's bench, with cut stones on it
      dput(dbox(1.1, 0.08, 0.5), DM.oak, cx, y0 + 0.8, BZ + 0.45); for (const dx of [-0.45, 0.45]) dput(dbox(0.07, 0.8, 0.4), DM.oakDark, cx + dx, y0 + 0.4, BZ + 0.45);
      for (let k = 0; k < 4; k++) dput(new THREE.OctahedronGeometry(0.07, 0), DM.crystal, cx - 0.3 + k * 0.2, y0 + 0.9, BZ + 0.45);
    }
  },
  pump(R, x0, x1, y0, y1, t) {
    const FZ = WORLD.faceZ, BZ = FZ - MINE.depth;
    dput(dcyl(0.09, 0.09, x1 - x0, 8), DM.iron, (x0 + x1) / 2, y0 + 2.55, BZ + 0.3, { rz: Math.PI / 2 });
    for (const cx of cellsOf(R)) {
      // the sump, and the pipe that takes the water up
      dput(new THREE.CircleGeometry(0.55, 16), DM.dark, cx, y0 + 0.01, 32.4, { rx: -Math.PI / 2 });
      dput(new THREE.CircleGeometry(0.45, 16), DM.water, cx, y0 - 0.06, 32.4, { rx: -Math.PI / 2 });
      dput(dcyl(0.11, 0.11, y1 - y0, 8), DM.iron, cx + 0.85, (y0 + y1) / 2, BZ + 0.3);
      dput(dcyl(0.08, 0.08, 1.2, 8), DM.iron, cx + 0.85, y0 + 0.9, 32.4 + 0.3, { rx: Math.PI / 2 - 0.5 });
      if (R.lv === 1) {   // a hand pump with a long lever
        dput(dbox(0.45, 1.0, 0.45), DM.iron, cx, y0 + 0.5, 33.6); dput(dcyl(0.06, 0.06, 0.5, 6), DM.iron, cx + 0.3, y0 + 0.85, 33.6, { rz: Math.PI / 2 });
        dynObj(R, 'rock', cx, y0 + 1.05, 33.6, () => { dput(dbox(1.4, 0.07, 0.07), DM.oak, cx - 0.2, y0 + 1.05, 33.6); dput(dbox(0.12, 0.12, 0.12), DM.oakDark, cx - 0.85, y0 + 1.05, 33.6); }, { axis: 'z', speed: 3, amp: 0.3 });
        dput(dcyl(0.3, 0.3, 0.7, 12), DM.oakDark, cx - 1.9, y0 + 0.35, 33.4);
      } else {            // a beam engine: cylinder, rocking beam, flywheel
        dput(dcyl(0.35, 0.35, 2.0, 14), DM.iron, cx - 0.55, y0 + 1.0, 32.5); dput(dcyl(0.42, 0.42, 0.12, 14), DM.brass, cx - 0.55, y0 + 2.05, 32.5);
        for (const dx of [-0.25, 0.25]) dput(dbox(0.14, 2.9, 0.14), DM.oakDark, cx + dx, y0 + 1.45, 32.5);
        dynObj(R, 'rock', cx, y0 + 2.95, 32.5, () => { dput(dbox(2.0, 0.16, 0.16), R.lv >= 3 ? DM.iron : DM.oakDark, cx, y0 + 2.95, 32.5); dput(dbox(0.06, 0.8, 0.06), DM.iron, cx - 0.55, y0 + 2.55, 32.5); }, { axis: 'z', speed: 1.6, amp: 0.16 });
        dynObj(R, 'spin', cx + 0.75, y0 + 1.05, 32.85, () => { dput(new THREE.TorusGeometry(0.62, 0.07, 6, 22), DM.iron, cx + 0.75, y0 + 1.05, 32.85); for (let k = 0; k < 3; k++) dput(dbox(0.05, 1.2, 0.05), DM.iron, cx + 0.75, y0 + 1.05, 32.85, { rz: k * Math.PI / 3 }); }, { axis: 'z', speed: 2.2 });
        if (R.lv >= 3) { dput(dcyl(0.5, 0.5, 1.6, 14), DM.copper, cx - 1.85, y0 + 0.8, 32.6); for (let k = 0; k < 2; k++) { dput(dcyl(0.16, 0.16, 0.05, 14), DM.brass, cx - 1.2 + k * 0.4, y0 + 2.2, BZ + 0.03, { rx: Math.PI / 2 }); dput(new THREE.CircleGeometry(0.12, 14), DM.cream, cx - 1.2 + k * 0.4, y0 + 2.2, BZ + 0.06); } }
      }
    }
  },
  shore(R, x0, x1, y0, y1, t) {
    const Rn = mulberry(R.r * 13 + R.c0 * 7 + 3), FZ = WORLD.faceZ, BZ = FZ - MINE.depth;
    for (const cx of cellsOf(R)) {
      for (const sx of [-1, 1]) {   // log stacks, ends to the front: three, two, one
        const x = cx + sx * 1.95;
        for (const [dx, h, n] of [[-0.42, 0.2, 0], [0, 0.2, 0], [0.42, 0.2, 0], [-0.21, 0.56, 1], [0.21, 0.56, 1], [0, 0.92, 2]]) dput(dcyl(0.19, 0.19, 1.5, 9), R.lv >= 3 && n === 0 ? DM.iron : DM.oak, x + dx, y0 + h, 33.5, { rx: Math.PI / 2, rz: (Rn() - 0.5) * 0.05 });
        for (const dx of [-0.66, 0.66]) dput(dbox(0.1, 1.2, 0.1), DM.oakDark, x + dx, y0 + 0.6, 33.5);
      }
      for (let k = 0; k < 3; k++) dput(dbox(0.16, 2.6, 0.16), DM.oak, cx - 0.5 + k * 0.4, y0 + 1.25, BZ + 0.45, { rz: -0.12 });
      dput(dbox(1.2, 0.08, 0.3), DM.oakDark, cx + 0.2, y0 + 0.7, 32.4); for (const dx of [-0.4, 0.8]) for (const s of [-1, 1]) dput(dbox(0.06, 0.8, 0.06), DM.oakDark, cx + dx - 0.2 + s * 0.15, y0 + 0.36, 32.4, { rz: s * 0.25 });
      dput(dcyl(0.15, 0.15, 1.5, 8), DM.oak, cx + 0.2, y0 + 0.88, 32.4, { rz: Math.PI / 2 });
    }
    if (R.lv >= 2) {   // a hoist over the middle
      const cx = (x0 + x1) / 2;
      for (const dx of [-1.0, 1.0]) dput(dbox(0.2, 2.8, 0.2), DM.oakDark, cx + dx, y0 + 1.4, BZ + 0.7);
      dput(dbox(2.3, 0.22, 0.22), DM.oakDark, cx, y0 + 2.75, BZ + 0.7); dput(dbox(0.03, 1.0, 0.03), DM.rope, cx, y0 + 2.2, BZ + 0.7); dput(dbox(0.2, 0.2, 0.08), DM.iron, cx, y0 + 1.65, BZ + 0.7);
    }
  },
  depot(R, x0, x1, y0, y1, t) {
    const FZ = WORLD.faceZ, BZ = FZ - MINE.depth, SZ = 33.5;
    // a siding in front of the main line, with buffer stops, and a cart on it in every cell
    for (const dz of [-0.33, 0.33]) dput(dbox(x1 - x0 - 0.4, 0.07, 0.07), DM.iron, (x0 + x1) / 2, y0 + 0.1, SZ + dz);
    for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.75) dput(dbox(0.2, 0.05, 1.05), DM.oakDark, x, y0 + 0.035, SZ);
    for (const x of [x0 + 0.25, x1 - 0.25]) { dput(dbox(0.25, 0.5, 1.0), DM.oakDark, x, y0 + 0.25, SZ); dput(dbox(0.1, 0.12, 0.9), DM.brass, x + (x < (x0 + x1) / 2 ? 0.15 : -0.15), y0 + 0.45, SZ); }
    for (const cx of cellsOf(R)) {
      cartStatic(cx, y0, SZ, false);
      for (let k = 0; k < 3; k++) dput(dcyl(0.18, 0.18, 0.08, 10), DM.iron, cx + 1.7, y0 + 0.05 + k * 0.08, BZ + 0.5);
      dput(dcyl(0.15, 0.17, 0.4, 8), DM.copper, cx - 1.75, y0 + 0.2, BZ + 0.5);
    }
    if (R.lv >= 2) dput(dcyl(0.85, 0.85, 0.08, 18), DM.iron, x1 - 1.0, y0 + 0.05, SZ - 0.1);
    if (R.lv >= 3) {   // a little steam engine to pull them
      const x = x0 + 1.1, z = SZ;
      dput(dbox(1.4, 0.3, 0.9), DM.iron, x, y0 + 0.4, z); dput(dcyl(0.32, 0.32, 1.0, 14), DM.copper, x + 0.15, y0 + 0.82, z, { rz: Math.PI / 2 });
      dput(dbox(0.5, 0.75, 0.85), DM.oakDark, x - 0.5, y0 + 0.92, z); dput(dcyl(0.08, 0.12, 0.5, 8), DM.iron, x + 0.5, y0 + 1.3, z);
      for (const dx of [-0.45, 0.45]) for (const dz of [-0.47, 0.47]) dput(dcyl(0.2, 0.2, 0.07), DM.iron, x + dx, y0 + 0.22, z + dz, { rx: Math.PI / 2 });
    }
    // a signal lamp on a post
    dput(dbox(0.08, 2.2, 0.08), DM.iron, x1 - 0.35, y0 + 1.1, FZ - 0.6); dput(dbox(0.2, 0.25, 0.2), DM.lamp, x1 - 0.35, y0 + 2.25, FZ - 0.6);
  },
  assay(R, x0, x1, y0, y1, t) {
    const Rn = mulberry(R.r * 17 + R.c0 * 9 + 4), FZ = WORLD.faceZ, BZ = FZ - MINE.depth;
    for (const cx of cellsOf(R)) {
      // the bench in the middle, the assayers either side of it
      dput(dbox(1.5, 0.09, 0.75), DM.oak, cx, y0 + 0.9, 33.55); for (const dx of [-0.65, 0.65]) for (const dz of [-0.3, 0.3]) dput(dbox(0.07, 0.9, 0.07), DM.oakDark, cx + dx, y0 + 0.45, 33.55 + dz);
      dput(dbox(0.05, 0.5, 0.05), DM.brass, cx, y0 + 1.2, 33.55); dput(dbox(0.6, 0.03, 0.03), DM.brass, cx, y0 + 1.45, 33.55);
      for (const dx of [-0.28, 0.28]) dput(dcyl(0.12, 0.08, 0.04, 12), DM.brass, cx + dx, y0 + 1.25, 33.55);
      for (let k = 0; k < 3; k++) { dput(dcyl(0.08, 0.08, 0.22, 10), DM.glass, cx - 0.5 + k * 0.5, y0 + 1.05, 33.75); dput(new THREE.OctahedronGeometry(0.05, 0), DM.crystal, cx - 0.5 + k * 0.5, y0 + 1.0, 33.75); }
      // shelves of sorted ore and jars along the back
      for (let s = 0; s < 3; s++) { dput(dbox(3.4, 0.05, 0.4), DM.oakDark, cx, y0 + 0.7 + s * 0.75, BZ + 0.25); for (let k = 0; k < 5; k++) { const x = cx - 1.4 + k * 0.7 + (Rn() - 0.5) * 0.1; if (Rn() < 0.5) dput(dbox(0.4, 0.3, 0.3), DM.oak, x, y0 + 0.88 + s * 0.75, BZ + 0.25, { uv: 1 }); else dput(dcyl(0.09, 0.09, 0.28, 8), DM.glass, x, y0 + 0.87 + s * 0.75, BZ + 0.25); } }
      dput(new THREE.TorusGeometry(0.35, 0.04, 6, 16), DM.oakDark, cx + 1.95, y0 + 0.6, BZ + 0.6, { rx: 0.2, ry: 0.6 });
    }
    if (R.lv >= 2) { const x = x1 - 0.8; dput(dbox(1.0, 1.1, 0.9), DM.dressed, x, y0 + 0.55, BZ + 0.6); dput(dbox(0.45, 0.35, 0.05), DM.lamp, x, y0 + 0.5, BZ + 1.06); dput(dcyl(0.15, 0.2, 1.4, 8), DM.dressed, x, y0 + 1.8, BZ + 0.5); }
    if (R.lv >= 3) { const x = x0 + 0.9; dput(dcyl(0.4, 0.4, 0.9, 16), DM.brass, x, y0 + 1.3, BZ + 0.7, { rz: Math.PI / 2 }); for (const dx of [-0.5, 0.5]) dput(dbox(0.1, 1.3, 0.1), DM.iron, x + dx, y0 + 0.65, BZ + 0.7); dput(new THREE.CircleGeometry(0.25, 16), DM.glass, x, y0 + 1.3, BZ + 1.12); }
  },
  lamp(R, x0, x1, y0, y1, t) {
    const FZ = WORLD.faceZ, BZ = FZ - MINE.depth;
    for (const cx of cellsOf(R)) {
      // a rack of lanterns being trimmed, in the middle
      for (const dx of [-0.6, 0.6]) dput(dbox(0.08, 2.0, 0.08), DM.oakDark, cx + dx, y0 + 1.0, 33.3);
      for (let s = 0; s < 3; s++) { dput(dbox(1.3, 0.05, 0.35), DM.oak, cx, y0 + 0.5 + s * 0.6, 33.3); for (let k = 0; k < 4; k++) { dput(dbox(0.16, 0.22, 0.16), DM.lamp, cx - 0.42 + k * 0.28, y0 + 0.65 + s * 0.6, 33.3); dput(dbox(0.2, 0.04, 0.2), DM.brass, cx - 0.42 + k * 0.28, y0 + 0.78 + s * 0.6, 33.3); } }
      for (const sx of [-1, 1]) { dput(dcyl(0.3, 0.3, 0.85, 12), sx < 0 ? DM.iron : DM.copper, cx + sx * 1.95, y0 + 0.43, 33.5); dput(dcyl(0.31, 0.31, 0.05, 12), DM.brass, cx + sx * 1.95, y0 + 0.88, 33.5); }
    }
    // the vent fan in the back wall
    const fx = x0 + 1.05, fy = y0 + 2.75;
    dput(new THREE.CircleGeometry(0.75, 20), DM.dark, fx, fy, BZ + 0.02); dput(new THREE.TorusGeometry(0.75, 0.06, 6, 24), DM.iron, fx, fy, BZ + 0.05);
    dynObj(R, 'spin', fx, fy, BZ + 0.12, () => { for (let k = 0; k < 4; k++) dput(dbox(0.22, 1.3, 0.03), DM.iron, fx, fy, BZ + 0.12, { rz: k * Math.PI / 4 }); }, { axis: 'z', speed: 4 });
    if (R.lv >= 2) { dput(dcyl(0.25, 0.25, 1.4, 10), DM.iron, x0 + 0.6, y1 - 0.7, BZ + 0.6); dput(dbox(0.8, 0.5, 0.6), DM.canvas, x0 + 0.6, y0 + 0.4, BZ + 0.6); }
    if (R.lv >= 3) { const x = x1 - 0.9; dput(dbox(0.9, 1.4, 0.6), DM.brass, x, y0 + 0.7, BZ + 0.5); for (let k = 0; k < 3; k++) dput(new THREE.OctahedronGeometry(1, 0), DM.crystal, x - 0.25 + k * 0.25, y0 + 1.6, BZ + 0.5, { s: [0.08, 0.2, 0.08] }); }
  },
  seam(R, x0, x1, y0, y1, t) {
    const Rn = mulberry(5151), FZ = WORLD.faceZ, BZ = FZ - MINE.depth;
    // the fissure: a jagged glowing crack right across the back wall
    let x = x0 + 0.5, y = y0 + 0.4;
    while (x < x1 - 0.5) { const nx = x + 0.4 + Rn() * 0.6, ny = clamp(y + (Rn() - 0.45) * 1.2, y0 + 0.5, y1 - 1.0), L = Math.hypot(nx - x, ny - y), a = Math.atan2(ny - y, nx - x);
      dput(dplane(L + 0.1, 0.06 + Rn() * 0.1), DM.seam, (x + nx) / 2, (y + ny) / 2, BZ + 0.03, { rz: a });
      dput(dplane(L + 0.6, 0.9), DM.seamGlow, (x + nx) / 2, (y + ny) / 2, BZ + 0.05, { rz: a });
      if (Rn() < 0.6) cluster((x + nx) / 2, (y + ny) / 2 - 0.1, BZ + 0.12, 2, 0.22, Rn, [DM.crystal, DM.crystalBlue]); x = nx; y = ny; }
    for (const cx of cellsOf(R)) {
      for (const sx of [-1, 1]) outcrop(cx + sx * 1.95, y0, 33.75, DM.rock, DM.crystalBlue, Rn);
      dput(dbox(1.6, 0.18, 0.18), DM.oakDark, cx + (Rn() - 0.5), y0 + 0.12, 32.6, { ry: (Rn() - 0.5) * 0.8, rz: 0.15 });
    }
    dput(dplane(x1 - x0, 3.2), DM.seamGlow, (x0 + x1) / 2, y0 + 0.02, 32.9, { rx: -Math.PI / 2 });
  },
};
// a dig in progress: raw rock, nothing in it yet
function digSiteLook(d) {
  const t = tierOf(d.r), x0 = cellX0(d.c), x1 = cellX1(d.c), y0 = rowY0(d.r), y1 = rowY1(d.r);
  digShell(x0, x1, y0, y1, t, d.from < 0, d.from > 0, true);
  DLOOK.lights.push({ room: d, x: (x0 + x1) / 2, y: y1 - 1.4, z: WORLD.faceZ - 1.8, r: 5, col: [1.0, 0.62, 0.3], k: 1 });
  DLOOK.lanterns.push({ room: d, x: x0 + (d.from > 0 ? 3.2 : 1.0), y: y1 - 0.02, z: WORLD.faceZ - 1.4, lv: 1, ph: Math.random() * TAU });
}
// the shaft: rock all round, timber cribbing, a landing at every row, the ladder and the cage's guides
function digShaftLook() {
  const x0 = MINE.shaft.x0 + DIGIN, x1 = MINE.shaft.x1 - DIGIN, yb = rowY0(shaftBottom()), yt = 0, FZ = WORLD.faceZ, D = MINE.depth, BZ = FZ - D, cz = FZ - D / 2, W = x1 - x0;
  for (let t = 0; t < 3; t++) {   // back and east walls, a stretch in each kind of rock
    const top = t === 0 ? yt : rowY1(t * 2) + 0.45; let bot = Math.max(yb, t === 2 ? yb : rowY1(t * 2 + 2) + 0.45); if (top <= bot) continue;
    if (bot <= yb + 0.01) bot = yb - 0.6;
    dput(dplane(W, top - bot), DM.wall[t], (x0 + x1) / 2, (top + bot) / 2, BZ, { uv: 4 });
    dput(dplane(D, top - bot), DM.wall[t], x1, (top + bot) / 2, cz, { ry: -Math.PI / 2, uv: 4 });
  }
  // the west wall: doors where a room meets the shaft, rock elsewhere
  let y = yt;
  for (let r = 0; r <= shaftBottom(); r++) {
    const a = rowY1(r), b = rowY0(r), t = tierOf(r);
    if (y > a) dput(dplane(D, y - a), DM.wall[t], x0, (y + a) / 2, cz, { ry: Math.PI / 2, uv: 4 });
    if (!digAt(r, MINE.cols - 1)) dput(dplane(D, a - b), DM.wall[t], x0, (a + b) / 2, cz, { ry: Math.PI / 2, uv: 4 });
    // the landing: planks over the west side, a rail, a lantern
    dput(dbox(1.3, 0.12, D - 0.4), DM.boards, x0 + 0.65, b - 0.06, cz, { uv: 2 });
    dput(dbox(0.08, 1.0, 0.08), DM.oakDark, x0 + 1.25, b + 0.5, FZ - 0.4); dput(dbox(0.08, 0.08, D - 0.6), DM.oakDark, x0 + 1.25, b + 1.0, cz);
    DLOOK.lanterns.push({ room: null, x: x0 + 0.7, y: a - 0.02, z: FZ - 1.3, lv: 1, ph: Math.random() * TAU });
    y = b;
  }
  dput(dplane(D, Math.max(0.01, y - (yb - 0.6))), DM.wall[2], x0, (y + yb - 0.6) / 2, cz, { ry: Math.PI / 2, uv: 4 });
  dput(dplane(W, D), DM.floor[tierOf(shaftBottom())], (x0 + x1) / 2, yb - 0.5, cz, { rx: -Math.PI / 2, uv: 4 });
  dput(new THREE.CircleGeometry(0.9, 16), DM.puddle, CAGE_X, yb - 0.49, cz, { rx: -Math.PI / 2, s: [1.4, 1, 1] });
  // cribbing on the back wall, the cage's guide timbers, the ladder
  for (let yy = yt - 0.6; yy > yb; yy -= 1.25) dput(dbox(W, 0.2, 0.2), DM.oakDark, (x0 + x1) / 2, yy, BZ + 0.12);
  for (const gx of [CAGE_X - 0.95, CAGE_X + 0.95]) dput(dbox(0.16, yt - yb + 0.5, 0.16), DM.oak, gx, (yt + yb) / 2 - 0.25, CAGE_Z);
  for (const lx of [LADDER_X - 0.22, LADDER_X + 0.22]) dput(dbox(0.07, yt - yb + 0.6, 0.07), DM.oak, lx, (yt + yb) / 2 - 0.2, SHAFT_Z + 0.2);
  for (let yy = yb + 0.3; yy < yt + 0.2; yy += 0.42) dput(dbox(0.48, 0.05, 0.05), DM.oak, LADDER_X, yy, SHAFT_Z + 0.2);
  DLOOK.lights.push({ room: null, cage: true, x: CAGE_X, y: 0, z: CAGE_Z + 0.6, r: 5.5, col: [1.1, 0.75, 0.4], k: 1 });
}

// ----------------------------------------------------------------- lanterns, carts, outlines, dust
function digLanterns() {
  const L = DLOOK.lanterns, n = Math.min(L.length, 96), c = new THREE.Color();
  DLOOK.lant.count = n; DLOOK.lantCore.count = n;
  for (let i = 0; i < n; i++) {
    const l = L[i];
    DLOOK.lant.setColorAt(i, c.set(l.lv >= 2 ? 0xd8b070 : 0x6a6e78));
    DLOOK.lantCore.setColorAt(i, l.lv >= 3 ? c.setRGB(1.6, 1.4, 1.0) : c.setRGB(1.7, 0.95, 0.38));
  }
  for (const m of [DLOOK.lant, DLOOK.lantCore]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
}
// a dashed outline over every cell you could dig now, with a pick in the middle
let OUTLINE_TEX = null;
function digOutlines() {
  if (!OUTLINE_TEX) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 236; const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,240,210,0.95)'; g.lineWidth = 6; g.setLineDash([18, 12]); g.beginPath(); g.roundRect(8, 8, 240, 220, 14); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,240,210,0.08)'; g.fillRect(8, 8, 240, 220);
    g.translate(128, 118); g.strokeStyle = 'rgba(255,240,210,0.9)'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-26, 30); g.lineTo(22, -18); g.stroke(); g.beginPath(); g.moveTo(-6, -34); g.quadraticCurveTo(28, -30, 36, 4); g.stroke();
    OUTLINE_TEX = canvasTex(c);
  }
  if (!DLOOK.outlines) {
    DLOOK.outlines = new THREE.InstancedMesh(new THREE.PlaneGeometry(MINE.cw - DIGIN * 2, MINE.rh), new THREE.MeshBasicMaterial({ map: OUTLINE_TEX, transparent: true, depthWrite: false, toneMapped: false }), 64);
    DLOOK.outlines.frustumCulled = false; DLOOK.outlines.renderOrder = 3; scene.add(DLOOK.outlines);
  }
  DLOOK.outlineList = digDiggable();
  const M = DLOOK.outlines, c = new THREE.Color(); M.count = Math.min(64, DLOOK.outlineList.length);
  DLOOK.outlineList.slice(0, 64).forEach(([r, cc], i) => { _m4.makeTranslation((cellX0(cc) + cellX1(cc)) / 2, (rowY0(r) + rowY1(r)) / 2, WORLD.faceZ + 0.04); M.setMatrixAt(i, _m4); M.setColorAt(i, c.set(0xffffff)); });
  M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true;
}
// dust hanging in the lamplight, a handful in every room (fewer on the Light setting)
function digDust() {
  if (DLOOK.dust) { scene.remove(DLOOK.dust); DLOOK.dust.geometry.dispose(); }
  const per = QUALITY.level === 'light' ? 3 : 7, pts = [], R = mulberry(4242);
  for (const Rm of DIG.rooms) for (let i = 0; i < Rm.w * per; i++) pts.push(cellX0(Rm.c0) + R() * (cellX1(Rm.c0 + Rm.w - 1) - cellX0(Rm.c0)), rowY0(Rm.r) + 0.4 + R() * 3.2, WORLD.faceZ - 0.6 - R() * 3.6);
  const geo = new THREE.BufferGeometry(), seed = new Float32Array(pts.length / 3).map(() => R() * 100);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uCol: { value: new THREE.Color(0xffd9a0) } },
    vertexShader: `attribute float seed; uniform float uTime, uScale; varying float vA;
      void main() { vec3 p = position + vec3(sin(uTime * 0.21 + seed) * 0.5, sin(uTime * 0.13 + seed * 1.7) * 0.35, cos(uTime * 0.17 + seed * 2.3) * 0.4);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = 0.25 + 0.5 * max(0.0, sin(uTime * (0.6 + fract(seed) * 0.9) + seed * 5.0));
        gl_PointSize = 0.06 * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uCol * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  DLOOK.dust = new THREE.Points(geo, mat); DLOOK.dust.frustumCulled = false; scene.add(DLOOK.dust);
}
// carts: one on every row that digs ore, two once a Cart Depot has a crew; they run from the far face to the shaft
function digCartsLayout() {
  const rows = new Map();
  for (const R of DIG.rooms) if (R.kind === 'face' || R.kind === 'seam') { const far = MINE.colX0(R.c0) + MINE.cw / 2; if (!rows.has(R.r) || far < rows.get(R.r)) rows.set(R.r, far); }
  const old = DLOOK.carts; DLOOK.carts = [];
  for (const [r, far] of rows) for (let k = 0; k < 2; k++) {
    const prev = old.find(c => c.r === r && c.k === k);
    DLOOK.carts.push({ r, k, far, near: MINE.shaft.x0 - 0.2, x: prev ? clamp(prev.x, far, MINE.shaft.x0) : lerp(far, MINE.shaft.x0 - 0.2, k * 0.5), st: prev ? prev.st : k ? 'back' : 'load', t: prev ? prev.t : Math.random() * 2, load: prev ? prev.load : 0 });
  }
}

// ----------------------------------------------------------------- digs in progress: the rock coming away
let CRACK_TEX = null;
function plugOn(d) {
  if (!CRACK_TEX) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 224; const g = c.getContext('2d'), R = mulberry(31337);
    g.lineCap = 'round';
    const crack = (x, y, a, n, w) => { for (let i = 0; i < n; i++) { const nx = x + Math.cos(a) * 9, ny = y + Math.sin(a) * 9; g.strokeStyle = 'rgba(16,8,12,0.9)'; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); g.strokeStyle = 'rgba(255,190,110,0.5)'; g.lineWidth = w * 0.35; g.stroke(); x = nx; y = ny; a += (R() - 0.5) * 0.9; w *= 0.93; if (R() < 0.12) crack(x, y, a + (R() - 0.5) * 2, n - i >> 1, w * 0.7); } };
    for (let k = 0; k < 9; k++) crack(128 + (R() - 0.5) * 60, 112 + (R() - 0.5) * 60, R() * TAU, 14, 3.4);
    CRACK_TEX = canvasTex(c);
  }
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), faceMat); front.receiveShadow = true;
  const t = tierOf(d.r), side = new THREE.Mesh(new THREE.PlaneGeometry(MINE.depth, MINE.rh), DM.wall[t]);
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: CRACK_TEX, transparent: true, depthWrite: false, opacity: 0.6 }));
  crack.renderOrder = 2;
  scene.add(front, side, crack);
  DLOOK.plugs.set(d, { front, side, crack, chip: 0 });
}
function plugOff(d) { const P = DLOOK.plugs.get(d); if (!P) return; scene.remove(P.front, P.side, P.crack); P.front.geometry.dispose(); P.crack.geometry.dispose(); P.crack.material.dispose(); P.side.geometry.dispose(); DLOOK.plugs.delete(d); }
function plugUpdate(d, P, gdt) {
  const k = clamp(d.done / d.work, 0, 1), a = cellX0(d.c), b = cellX1(d.c), y0 = rowY0(d.r), y1 = rowY1(d.r), FZ = WORLD.faceZ;
  const edge = digEdge(d), lo = d.from > 0 ? a : edge, hi = d.from > 0 ? edge : b, w = Math.max(0.01, hi - lo);
  for (const m of [P.front, P.crack]) { m.position.set((lo + hi) / 2, (y0 + y1) / 2, FZ + (m === P.crack ? 0.03 : 0)); m.scale.set(w, y1 - y0, 1); }
  // the front keeps the face's own strata, so it looks like the cliff until it's broken
  const uv = P.front.geometry.attributes.uv, u0 = (lo - STRATA.X0) / STRATA.WX, u1 = (hi - STRATA.X0) / STRATA.WX, v0 = 1 + y0 / STRATA.HY, v1 = 1 + y1 / STRATA.HY;
  uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); uv.needsUpdate = true;
  const cu = P.crack.geometry.attributes.uv, f0 = (lo - a) / (b - a), f1 = (hi - a) / (b - a);
  cu.setXY(0, f0, 1); cu.setXY(1, f1, 1); cu.setXY(2, f0, 0); cu.setXY(3, f1, 0); cu.needsUpdate = true;
  P.crack.material.opacity = 0.35 + 0.65 * Math.min(1, k * 2.5);
  P.side.position.set(edge, (y0 + y1) / 2, FZ - MINE.depth / 2); P.side.rotation.y = d.from > 0 ? Math.PI / 2 : -Math.PI / 2;
  // chips fly while the crew are at it
  const busy = workersOf(d.id).some(v => v.working);
  if (busy && gdt > 0) { P.chip -= gdt; if (P.chip <= 0) { P.chip = 0.35 + Math.random() * 0.5; const p = new THREE.Vector3(edge + d.from * 0.1, y0 + 0.6 + Math.random() * 2.4, FZ - 1.2 - Math.random() * 2.5); debris(p, 1 + (Math.random() * 2 | 0), d.from); if (Math.random() < 0.5) FX.puff(p, 2, 0xb8a888, 0.4); if (Math.random() < 0.3) FX.sparks(p, 3, 0xffc070, 1.5); if (VIEW.mode === 'mine' && Math.random() < 0.4) AUDIO.play('dig', p); } }
}
// rock chunks: thrown out, they fall, bounce once and settle, then shrink away
function debris(p, n, dir = 0, floorY = null) {
  for (let i = 0; i < n; i++) {
    if (DLOOK.debrisList.length >= 48) DLOOK.debrisList.shift();
    DLOOK.debrisList.push({ p: p.clone(), v: new THREE.Vector3(dir * (0.5 + Math.random() * 1.5) + (Math.random() - 0.5), 1 + Math.random() * 2, 0.5 + Math.random() * 1.2), s: 0.06 + Math.random() * 0.12, t: 0, fy: floorY ?? MINE.top - MINE.rh - Math.floor((MINE.top - p.y) / MINE.pitch) * MINE.pitch + 0.05, r: Math.random() * 3 });
  }
}
function debrisUpdate(dt) {
  const L = DLOOK.debrisList, M = DLOOK.debris; let n = 0;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i]; q.t += dt; if (q.t > 4) { L.splice(i, 1); continue; }
    q.v.y -= 9 * dt; q.p.addScaledVector(q.v, dt);
    if (q.p.y < q.fy + q.s) { q.p.y = q.fy + q.s; q.v.y = Math.abs(q.v.y) > 1.5 ? -q.v.y * 0.3 : 0; q.v.x *= 0.6; q.v.z *= 0.6; }
    q.p.z = Math.min(q.p.z, WORLD.faceZ - 0.1);
    const s = q.s * (q.t > 3 ? 4 - q.t : 1);
    _m4.compose(q.p, _q4.setFromEuler(_e4.set(q.r + q.t, q.r * 2, 0)), _s4.set(s, s * 0.8, s)); M.setMatrixAt(n++, _m4);
  }
  M.count = n; M.instanceMatrix.needsUpdate = true;
}

// ----------------------------------------------------------------- trouble you can see: alarms, rubble, water, gas, cracks
function incLook(R) {
  const I = R.inc, grp = new THREE.Group(), x0 = cellX0(R.c0), x1 = cellX1(R.c0 + R.w - 1), y0 = rowY0(R.r), y1 = rowY1(R.r), FZ = WORLD.faceZ, W = x1 - x0, cx = (x0 + x1) / 2, Rn = mulberry(R.r * 97 + R.c0);
  const alarm = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, toneMapped: false, depthWrite: false });
  for (const [x, y, w, h] of [[cx, y1 + 0.06, W + 0.3, 0.12], [cx, y0 - 0.06, W + 0.3, 0.12], [x0 - 0.09, (y0 + y1) / 2, 0.12, y1 - y0 + 0.24], [x1 + 0.09, (y0 + y1) / 2, 0.12, y1 - y0 + 0.24]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), alarm); m.position.set(x, y, FZ + 0.08); grp.add(m); }
  const V = { grp, alarm };
  if (I.kind === 'cave') {
    V.rubble = new THREE.Group(); V.rubble.position.set(cx, y0, FZ - 2.2); grp.add(V.rubble);
    for (let i = 0; i < 16 + R.w * 12; i++) { const s = 0.3 + Rn() * 0.55, z = (Rn() - 0.5) * 3.8, back = clamp(0.5 - z / 4, 0, 1), m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), DM.rock); m.position.set((Rn() - 0.5) * (W - 0.4), s * 0.5 + Rn() * (0.6 + 2.2 * back), z); m.rotation.set(Rn() * 3, Rn() * 3, Rn() * 3); V.rubble.add(m); }
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.2), DM.oakDark); m.position.set((Rn() - 0.5) * (W - 1.5), 1.3 + Rn() * 0.6, (Rn() - 0.5) * 2); m.rotation.set(0, (Rn() - 0.5) * 1.2, (Rn() - 0.5) * 0.8); V.rubble.add(m); }
  }
  if (I.kind === 'flood') { V.water = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 1, MINE.depth - 0.05), DM.water); V.water.position.set(cx, y0, FZ - MINE.depth / 2); grp.add(V.water); }
  if (I.kind === 'gas') {
    V.gasMat = DM.gas.clone();
    for (const z of [FZ - MINE.depth + 0.4, FZ - 2.4, FZ - 0.8]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, y1 - y0 - 0.2), V.gasMat); m.position.set(cx, (y0 + y1) / 2, z); grp.add(m); }
  }
  if (I.kind === 'wild') {
    V.crackMat = DM.seam.clone();
    for (const f of I.list) { let x = f.pos.x - 0.6, y = y0 + 0.2; for (let k = 0; k < 5; k++) { const nx = x + 0.2 + Rn() * 0.3, ny = y + 0.4 + Rn() * 0.3, m = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(nx - x, ny - y) + 0.06, 0.1 + Rn() * 0.08), V.crackMat); m.position.set((x + nx) / 2, (y + ny) / 2, FZ - MINE.depth + 0.04); m.rotation.z = Math.atan2(ny - y, nx - x); grp.add(m); x = nx; y = ny; } }
  }
  scene.add(grp); return V;
}
function incLookUpdate(R, V, dt, now) {
  const I = R.inc; V.alarm.opacity = 0.45 + 0.45 * Math.sin(now * 6);
  if (!I) return;
  const x0 = cellX0(R.c0), x1 = cellX1(R.c0 + R.w - 1), y0 = rowY0(R.r);
  if (V.rubble) { V.rubble.scale.y = Math.max(0.05, 1 - I.k); V.rubble.scale.x = V.rubble.scale.z = 1 - I.k * 0.4; if (dt > 0 && Math.random() < dt * 3 && workersOf(R.id).some(v => v.working)) FX.puff(new THREE.Vector3(lerp(x0, x1, Math.random()), y0 + 0.5, WORLD.faceZ - 2), 2, 0xb8a888, 0.5); }
  if (V.water) { const h = Math.max(0.01, I.water * MINE.rh); V.water.scale.y = h; V.water.position.y = y0 + h / 2 + Math.sin(now * 1.3) * 0.02; }
  if (V.gasMat) { V.gasMat.opacity = I.g * (0.16 + Math.sin(now * 1.7) * 0.04); if (dt > 0 && Math.random() < dt * 4) FX.mote(new THREE.Vector3(lerp(x0, x1, Math.random()), y0 + 0.5 + Math.random() * 3, WORLD.faceZ - 1 - Math.random() * 3), 0xb8d060); }
  if (V.crackMat) V.crackMat.opacity = I.list.some(f => !f.dead && f.mine === R) ? 0.7 + Math.sin(now * 5) * 0.25 : Math.max(0, V.crackMat.opacity - dt);
}

// ----------------------------------------------------------------- moments: digs starting and finishing, upgrades, trouble
function digFx(kind, a, b) {
  const FZ = WORLD.faceZ;
  if (kind === 'start') { const d = a, p = new THREE.Vector3((cellX0(d.c) + cellX1(d.c)) / 2, (rowY0(d.r) + rowY1(d.r)) / 2, FZ + 0.3); FX.puff(p, 14, 0xb8a888, 1.6); debris(p, 8, 0, rowY0(d.r) + 0.05); }
  if (kind === 'done' || kind === 'upgrade' || kind === 'seam') {
    const R = a, x0 = cellX0(R.c0), x1 = cellX1(R.c0 + R.w - 1), y0 = rowY0(R.r);
    for (let i = 0; i < (kind === 'upgrade' ? 6 : 12); i++) FX.puff(new THREE.Vector3(lerp(x0, x1, Math.random()), y0 + 0.5 + Math.random() * 3, FZ - 0.5 - Math.random() * 3), 3, 0xc8b898, 1);
    if (kind !== 'upgrade') debris(new THREE.Vector3((x0 + x1) / 2, y0 + 2, FZ - 1), 14, 0, y0 + 0.05);
    if (kind !== 'done') FX.sparks(new THREE.Vector3((x0 + x1) / 2, y0 + 2, FZ - 1), 30, kind === 'seam' ? 0xffd28a : 0xffc070, 3);
  }
  if (kind === 'incident') {
    const R = a, old = DLOOK.inc.get(R); if (old) scene.remove(old.grp);
    DLOOK.inc.set(R, incLook(R));
    if (R.inc.kind === 'cave') { const x0 = cellX0(R.c0), x1 = cellX1(R.c0 + R.w - 1), y0 = rowY0(R.r); for (let i = 0; i < 16; i++) FX.puff(new THREE.Vector3(lerp(x0, x1, Math.random()), y0 + Math.random() * 3.5, FZ - 0.4 - Math.random() * 3), 3, 0xb8a888, 1.2); debris(new THREE.Vector3((x0 + x1) / 2, y0 + 3.5, FZ - 1.5), 16, 0, y0 + 0.05); if (VIEW.mode === 'mine') DIGCAM.shake = 0.6; }
    if (R.inc.kind === 'wild') for (const f of R.inc.list) FX.sparks(f.pos.clone().setY(f.pos.y + 0.8), 20, 0xffd090, 3);
  }
  if (kind === 'clear') { const V = DLOOK.inc.get(a); if (V) { V.dying = 1.2; } }
}

// ----------------------------------------------------------------- every frame
const _gv = new THREE.Vector3(), _gl = [];
function digLookUpdate(rdt, gdt) {
  if (!DLOOK.static) return;
  const now = performance.now() / 1000, inMine = VIEW.mode === 'mine' && !BUILD.on, pw = POWER.on ? 1 : 0.35;
  // the cage, its rope and its load
  DLOOK.cage.position.set(CAGE_X, CAGE.y, CAGE_Z); DLOOK.tub.visible = CAGE.ore > 0.3;
  const top = CAGE.y + 2.5, len = Math.max(0.05, 0.4 - top); DLOOK.rope.position.set(CAGE_X, top + len / 2, CAGE_Z); DLOOK.rope.scale.y = len; DLOOK.rope.visible = len > 0.1;
  // lanterns sway a little on their chains; the cage's lamp goes with the cage
  const L = DLOOK.lanterns, n = DLOOK.lant.count;
  for (let i = 0; i < n; i++) {
    const l = L[i], sw = Math.sin(now * 1.3 + l.ph) * 0.07 + (l.room && l.room.inc && l.room.inc.kind === 'cave' ? Math.sin(now * 9 + l.ph) * 0.15 : 0);
    _m4.compose(_p4.set(l.x, l.y, l.z), _q4.setFromEuler(_e4.set(Math.sin(now * 0.9 + l.ph * 2) * 0.04, 0, sw)), _s4.set(1, 1, 1));
    DLOOK.lant.setMatrixAt(i, _m4); DLOOK.lantCore.setMatrixAt(i, _m4);
  }
  DLOOK.lant.instanceMatrix.needsUpdate = true; DLOOK.lantCore.instanceMatrix.needsUpdate = true;
  // the faked lamplight: the rooms nearest the middle of the view lend their light to the shaders
  camera.updateMatrixWorld();
  const max = QUALITY.level === 'light' ? 10 : GLOW_MAX, tgt = controls.target, cand = _gl; cand.length = 0;
  for (const g of DLOOK.lights) { if (g.cage) g.y = CAGE.y + 2.0; g.dd = (g.x - tgt.x) ** 2 + (g.y - tgt.y) ** 2 * 1.5; cand.push(g); }
  cand.sort((a, b) => a.dd - b.dd);
  let k = 0;
  for (const g of cand) {
    if (k >= max) break;
    const R = g.room, I = R && R.inc;
    let s = pw * (R && R.lit !== undefined ? R.lit : 1);
    if (I && I.kind === 'gas') s *= 0.55 + (Math.random() < 0.15 ? -0.4 : 0.25 * Math.sin(now * 13 + g.x));
    if (R && R.kind === 'seam') s *= 1 + 0.25 * Math.sin(now * 1.4) + (WL.night && WL.night.deep ? 0.5 : 0);
    if (R && R.kind === 'grotto') s *= 1 + 0.12 * Math.sin(now * 1.1 + g.x);
    s *= 1 + Math.sin(now * 1.3 + g.x) * 0.04;
    _gv.set(g.x + Math.sin(now * 1.3 + g.x) * 0.05, g.y, g.z).applyMatrix4(camera.matrixWorldInverse);
    GLOW.p.value[k].set(_gv.x, _gv.y, _gv.z, g.r * g.r); GLOW.c.value[k].set(g.col[0] * s, g.col[1] * s, g.col[2] * s); k++;
  }
  GLOW.n.value = k;
  // what moves: flywheels, fans, rocking beams (while their crew are at work)
  for (const o of DLOOK.dyn) {
    const on = o.room && o.room.power > 0 && !o.room.inc, sp = on ? 1 : 0;
    if (o.kind === 'spin') o.obj.rotation[o.axis] += rdt * o.speed * sp * Math.min(GAME.speed, 2);
    else if (o.kind === 'rock') { o.ph += rdt * o.speed * sp * Math.min(GAME.speed, 2); o.obj.rotation[o.axis] = Math.sin(o.ph) * o.amp; }
  }
  // the glows: veins in the slate and the deep, crystal, the seam
  DM.wall[1].emissiveIntensity = (0.45 + 0.15 * Math.sin(now * 0.7)) * pw; DM.wall[2].emissiveIntensity = (0.6 + 0.2 * Math.sin(now * 0.9 + 1)) * pw;
  DM.crystal.emissiveIntensity = 0.75 + Math.sin(now * 1.2) * 0.2; DM.crystalBlue.emissiveIntensity = 0.45 + Math.sin(now * 1.5 + 2) * 0.15;
  DM.seam.opacity = 0.65 + Math.sin(now * 2.6) * 0.25 + (WL.night && WL.night.deep ? 0.1 : 0); DM.seamGlow.opacity = 0.45 + Math.sin(now * 1.3) * 0.15 + (WL.night && WL.night.deep ? 0.25 : 0);
  // carts
  const anyDepot = DIG.rooms.some(R => R.kind === 'depot' && R.power > 0), CM = DLOOK.cartMesh; let ci = 0;
  for (const c of DLOOK.carts) {
    if (c.k === 1 && !anyDepot) continue;
    const rowOn = DIG.rooms.some(R => R.r === c.r && (R.kind === 'face' || R.kind === 'seam') && R.out > 0), sp = (anyDepot ? 3.0 : 1.5) * (gdt > 0 ? gdt / Math.max(rdt, 1e-4) : 0);
    if (gdt > 0 && rowOn) {
      c.t -= gdt;
      if (c.st === 'load') { c.load = Math.min(1, c.load + gdt * 0.4); if (c.t <= 0) c.st = 'out'; }
      else if (c.st === 'out') { c.x = Math.min(c.near, c.x + sp * rdt); if (c.x >= c.near) { c.st = 'tip'; c.t = 1.2; if (inMine) { const p = new THREE.Vector3(c.x + 0.6, rowY0(c.r) + 0.8, RAIL_Z); FX.puff(p, 2, 0x9a8a78, 0.4); if (Math.random() < 0.3) AUDIO.play('cart', p); } } }
      else if (c.st === 'tip') { c.load = Math.max(0, c.load - gdt * 1.2); if (c.t <= 0) c.st = 'back'; }
      else if (c.st === 'back') { c.x = Math.max(c.far, c.x - sp * rdt); if (c.x <= c.far) { c.st = 'load'; c.t = 2.5; } }
    }
    const tip = c.st === 'tip' ? Math.min(1, (1.2 - c.t) * 3) * 0.6 : 0;
    _m4.compose(_p4.set(c.x, rowY0(c.r) + 0.02, RAIL_Z), _q4.setFromEuler(_e4.set(0, 0, -tip)), _s4.set(1, 1, 1));
    for (const m of CM.slice(0, 3)) m.setMatrixAt(ci, _m4);
    _m4.compose(_p4.set(c.x, rowY0(c.r) + 0.02 - (1 - c.load) * 0.35, RAIL_Z), _q4, _s4.set(1, Math.max(0.01, c.load), 1)); CM[3].setMatrixAt(ci, _m4);
    ci++;
  }
  for (const m of CM) { m.count = ci; m.instanceMatrix.needsUpdate = true; }
  // digs in progress, trouble, debris, dust
  for (const [d, P] of DLOOK.plugs) plugUpdate(d, P, gdt);
  for (const [R, V] of DLOOK.inc) {
    if (V.dying !== undefined) { V.dying -= rdt; V.alarm.opacity = 0; if (V.rubble) V.rubble.scale.multiplyScalar(0.92); if (V.water) V.water.scale.y *= 0.9; if (V.gasMat) V.gasMat.opacity *= 0.9; if (V.dying <= 0) { scene.remove(V.grp); V.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); DLOOK.inc.delete(R); } continue; }
    incLookUpdate(R, V, gdt, now);
  }
  debrisUpdate(rdt * (GAME.paused ? 0.3 : 1));
  if (DLOOK.dust) { const u = DLOOK.dust.material.uniforms; u.uTime.value = now; u.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); }
  // drips in the slate and the deep
  if (gdt > 0 && inMine) for (const R of DIG.rooms) if (tierOf(R.r) > 0 && Math.random() < rdt * 0.5 * R.w) FX.sparks(new THREE.Vector3(lerp(cellX0(R.c0), cellX1(R.c0 + R.w - 1), Math.random()), rowY1(R.r) - 0.05, WORLD.faceZ - 0.8 - Math.random() * 3.4), 1, 0x9fc8e0, 0.05);
  // what you only see in the Mine view: the cells you could dig; clouds on the camera's side get out of the way
  DLOOK.outlines.visible = inMine;
  if (inMine) {
    const sel = DIG.sel && DIG.sel.cell ? DIG.sel : null, c = new THREE.Color(), cheap = Math.min(...DIG_ORDER.map(k => ROOMK[k].cost));
    DLOOK.outlineList.slice(0, 64).forEach(([r, cc], i) => DLOOK.outlines.setColorAt(i, sel && sel.r === r && sel.c === cc ? c.setRGB(1.6, 1.05, 0.4) : GAME.shards >= cheap + 18 * r ? c.setRGB(1, 0.96, 0.86).multiplyScalar(0.7 + 0.3 * Math.sin(now * 2.4 + i)) : c.setRGB(0.5, 0.45, 0.42)));
    if (DLOOK.outlines.instanceColor) DLOOK.outlines.instanceColor.needsUpdate = true;
  }
  if (!UI.cur || UI.cur.kind !== 'dig') DIG.sel = null;
  for (const s of scene.children) if (s.isSprite && s.userData.r) s.visible = !(inMine && s.position.z > 18);
  // people take on the lamplight of the room they're in
  for (const v of GAME.villagers) {
    if (v.hidden || v.where !== 'mine') continue;
    let best = 0, gas = 0; const row = Math.round((MINE.top - MINE.rh - v.pos.y) / MINE.pitch), R = digAt(row, Math.floor((v.pos.x - MINE.x0) / MINE.cw));
    for (const g of DLOOK.lights) { if (Math.abs(g.y - v.pos.y - 2.7) > 2.5) continue; const d = Math.abs(g.x - v.pos.x); best = Math.max(best, clamp(1 - d / g.r, 0, 1) * (g.room && g.room.lit !== undefined ? g.room.lit : 1)); }
    if (R && R.inc && R.inc.kind === 'gas') gas = R.inc.g;
    v.mat.color.setRGB(Math.min(1, 0.5 + 0.55 * best * pw), Math.min(1, 0.44 + 0.42 * best * pw + gas * 0.08), Math.min(1, 0.42 + 0.22 * best * pw));
  }
  // a cave-in shakes the Mine view for a moment
  if (DIGCAM.shake > 0) { DIGCAM.shake -= rdt; const s = DIGCAM.shake * 0.25; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; }
}
