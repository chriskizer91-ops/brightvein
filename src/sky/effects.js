// effects.js: smoke and debris. The white-grey gunsmoke that billows from every port as a broadside goes off, the
// smoke from damaged ships, thickening and darkening as the hull goes, and the trail of the Captain's ship going down (a
// raider going down pours a whole column of it: wrecks.js). One batch of puffs for the whole sky, each a billowing heap
// lit by the sun from above (fire and sparks are fx.js's glows). And the debris a shot knocks off a ship, matching what
// it hit: splinters, torn scraps of canvas, crystal shards.
// The puffs and pieces live in plain number arrays, a fixed number of them made once, so a phone never has to clear
// away thousands of little objects mid-fight: one that burns out is swapped for the last, and when every one is in use
// the oldest-placed is reused (and counted, as `dropped`).
import * as THREE from 'three';
import { upload } from './guns.js';

const ATTRS = ['position', 'size', 'shade', 'alpha', 'look', 'heat'];
// The puffs' picture, made once: four puffs side by side in one small texture. Three are billowing heaps of round lobes
// (cauliflower-like, with wispy edges), each lobe lit like a ball by the sun from above, so the creases between them
// fall into shade; the fourth is a plain soft round puff, for thin vapour. Red is how thick the smoke is, green how
// much sun it catches. (A puff is drawn mirrored or not and a little turned, so the three look like many)
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function puffAtlas() {
  const N = 128, W = N * 2, data = new Uint8Array(W * W * 4);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const Ll = Math.hypot(-0.3, 0.8, 0.5), Lx = -0.3 / Ll, Ly = 0.8 / Ll, Lz = 0.5 / Ll; // the sun: above, a little left, towards the viewer
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * N, oy = (cell >> 1) * N, plain = cell === 3, lobes = [[0, -0.04, 0.26]];
    for (let k = 0; k < 12; k++) {
      const r = 0.09 + rnd() * 0.15, a = rnd() * Math.PI * 2, d = rnd() * (0.42 - r);
      lobes.push([Math.cos(a) * d, Math.sin(a) * d * 0.85 + 0.02, r]);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N - 0.5, y = (j + 0.5) / N - 0.5, rr = Math.hypot(x, y);
      let dens, lit;
      if (plain) { dens = smooth(0.5, 0.12, rr); lit = 0.62; }
      else {
        // the edge wavers a little (wisps), then the highest lobe over this point is the smoke's surface here
        const wx = x + 0.022 * Math.sin(y * 31 + cell * 1.7) + 0.012 * Math.sin(y * 67 + x * 13), wy = y + 0.022 * Math.sin(x * 27 + cell * 2.9);
        let h = 0, nx = 0, ny = 0, nz = 1, rad = 1;
        for (const [cx, cy, r] of lobes) {
          const dx = wx - cx, dy = wy - cy, q = r * r - dx * dx - dy * dy;
          if (q > 0) { const z = Math.sqrt(q); if (z > h) { h = z; nx = dx / r; ny = dy / r; nz = z / r; rad = r; } }
        }
        dens = Math.pow(Math.min(1, h / 0.11), 0.8) * smooth(0.5, 0.44, rr);
        lit = (0.2 + 0.8 * Math.max(0, nx * Lx + ny * Ly + nz * Lz)) * (0.75 + 0.25 * Math.min(1, h / rad));
      }
      const o = ((oy + j) * W + ox + i) * 4;
      data[o] = Math.round(dens * 255); data[o + 1] = Math.round(Math.min(1, lit) * 255); data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
// The kinds of puff, and how each behaves: how quickly the air slows it (a share of its speed a second); how it grows
// (0: quickly at first and slowing; 1: billowing out at once, then hanging; 2: blasting out at once, and still spreading
// as it drifts); how quickly it shows (fully, a 6th, 14th or 25th of the way through its life); and whether it stays
// thick a while before it thins away (gunsmoke) or thins from the start.
//   pour    smoke pouring off a damaged ship or a wreck        billow  a blast, a hit's dust, a ring of cloud
//   gun     a gun's jet of powder smoke, stopping a dozen      vapour  as billow, but a plain round puff (the Surge's
//           metres out                                                 vapour trails)
//   bank    the slower cloud of powder smoke behind the jet, keeping more of the ship's speed, so it drifts back along
//           her side as she sails on
export const PUFF = { pour: 0, billow: 1, gun: 2, vapour: 3, bank: 4 };
const DRAG = [0.6, 0.6, 1.5, 0.6, 0.45], GROW = [0, 1, 2, 1, 2], SHOW = [6, 14, 25, 14, 25], LINGER = [0, 0, 1, 0, 1];
// The Captain's own gunsmoke (`mine`) keeps out of her way: where a puff of it lies across the line from the camera to
// the raider her guns are locked on to (`keepClear`), it thins to a CLEAR share of itself and drifts aside off that
// line, so a volley's hits can be seen landing through her own smoke; the rest of the bank stays as thick as ever, and
// raiders' smoke is never touched
export const CLEAR = { thin: 0.15, push: 9, margin: 1.25 };
// `max` puffs at once; `cap`: the most pixels across one may be drawn (a phone's limit is how much it fills)
export function makeSmoke(scene, max = 900, cap = 700) {
  const pos = new Float32Array(max * 3), size = new Float32Array(max), shade = new Float32Array(max), alpha = new Float32Array(max), look = new Float32Array(max), heat = new Float32Array(max);
  const geo = new THREE.BufferGeometry(), dyn = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', dyn(pos, 3)); geo.setAttribute('size', dyn(size, 1)); geo.setAttribute('shade', dyn(shade, 1));
  geo.setAttribute('alpha', dyn(alpha, 1)); geo.setAttribute('look', dyn(look, 1)); geo.setAttribute('heat', dyn(heat, 1));
  geo.setDrawRange(0, 0);
  // each puff: which of the four pictures, mirrored or not, and turned how far (packed in `look`); its shade (0 black,
  // 1 pale grey); and `heat`, fire below it lighting its shaded underside orange (a burning wreck's smoke, near her)
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 }, uMax: { value: cap }, uTex: { value: puffAtlas() } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float size; attribute float shade; attribute float alpha; attribute float look; attribute float heat;
      uniform float uScale; uniform float uMax; varying float vS; varying float vA; varying float vH; varying vec4 vR; varying vec2 vC;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * uScale / -mv.z, uMax);
        float k = floor(look / 8.0), a = look - k * 8.0 - 3.14159, m = k >= 4.0 ? -1.0 : 1.0, cell = k - (k >= 4.0 ? 4.0 : 0.0), c = cos(a), s = sin(a);
        vR = vec4(m * c, -m * s, s, c); vC = vec2(mod(cell, 2.0), floor(cell / 2.0)) * 0.5;
        vS = shade; vA = alpha; vH = heat; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uTex; varying float vS; varying float vA; varying float vH; varying vec4 vR; varying vec2 vC;
      void main() { vec2 d = gl_PointCoord - 0.5;
        if (dot(d, d) > 0.25) discard;
        vec2 r = vec2(dot(vR.xy, d), dot(vR.zw, d));
        vec4 t = texture2D(uTex, vC + vec2(r.x + 0.5, 0.5 - r.y) * 0.5);
        float a = t.r * vA;
        if (a < 0.01) discard;
        vec3 c = mix(vec3(0.07, 0.06, 0.06), vec3(0.72, 0.71, 0.7), vS) * (0.45 + 0.9 * t.g) * (1.0 - d.y * 0.3);
        c += vec3(1.0, 0.42, 0.12) * vH * (1.0 - t.g) * (0.6 + d.y);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.renderOrder = 3; scene.add(points);
  // each puff: where, how it drifts, its life, its size from s0 to s1, shade, how opaque, its kind, how it rises, its
  // picture and how it turns, and how hot
  const F = () => new Float32Array(max);
  const px = F(), py = F(), pz = F(), vx = F(), vy = F(), vz = F(), life = F(), full = F(), s0 = F(), s1 = F(), sh = F(), al = F(), kind = new Uint8Array(max), rise = F(),
    pic = F(), ang = F(), spin = F(), hot = F(), own = new Uint8Array(max);
  let n = 0, cursor = 0, dropped = 0;
  // (the line kept clear of the Captain's own smoke: to `sight`, a raider `sightR` metres across, while `seeing`)
  const sight = new THREE.Vector3();
  let seeing = false, sightR = 0, thinned = 0;
  // a puff at p drifting with v, growing from a to b metres across over its life; shade 0 is black, 1 pale grey; `kind`
  // (PUFF: how it slows, grows and fades); rise: how fast it lifts as it drifts (m/s each second); heat 0 to 1; `mine`:
  // the Captain's own gunsmoke
  function emit(p, v, lifeS, a, b, shadeOf, op = 0.75, kindOf = 0, riseBy = 1.5, heatOf = 0, mine = false) {
    let i;
    if (n < max) i = n++;
    else { i = cursor; cursor = (cursor + 1) % max; dropped++; }
    px[i] = p.x; py[i] = p.y; pz[i] = p.z; vx[i] = v.x; vy[i] = v.y; vz[i] = v.z;
    life[i] = full[i] = lifeS; s0[i] = a; s1[i] = b; sh[i] = shadeOf; al[i] = op; kind[i] = kindOf; rise[i] = riseBy; hot[i] = heatOf; own[i] = mine ? 1 : 0;
    pic[i] = (kindOf === 3 ? (Math.random() < 0.5 ? 3 : 7) : ((Math.random() * 3) | 0) + (Math.random() < 0.5 ? 4 : 0)) * 8;
    ang[i] = (Math.random() - 0.5) * 1.2; spin[i] = (Math.random() - 0.5) * 0.5;
  }
  const ARR = [px, py, pz, vx, vy, vz, life, full, s0, s1, sh, al, kind, rise, pic, ang, spin, hot, own];
  const kill = (i) => { const j = --n; if (i !== j) for (let a = 0; a < ARR.length; a++) ARR[a][i] = ARR[a][j]; };
  function update(dt, camera) {
    for (let i = n - 1; i >= 0; i--) {
      if ((life[i] -= dt) <= 0) { kill(i); continue; }
      const d = 1 - dt * DRAG[kind[i]];
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      vx[i] *= d; vy[i] *= d; vz[i] *= d; vy[i] += dt * rise[i];
      ang[i] = Math.max(-3, Math.min(3, ang[i] + spin[i] * dt));
    }
    // (the line from the camera to the raider her guns are locked on to: from (cx, cy, cz) along (lx, ly, lz), D long)
    const keeping = seeing && camera;
    let cx = 0, cy = 0, cz = 0, lx = 0, ly = 0, lz = 0, D = 0;
    if (keeping) { const c = camera.position; cx = c.x; cy = c.y; cz = c.z; lx = sight.x - cx; ly = sight.y - cy; lz = sight.z - cz; D = Math.hypot(lx, ly, lz); if (D > 1) { lx /= D; ly /= D; lz /= D; } }
    thinned = 0;
    for (let i = 0; i < n; i++) {
      const k = 1 - life[i] / full[i], K = kind[i], G = GROW[K];
      const u = 1 - k, u3 = u * u * u, g = G === 0 ? Math.sqrt(k) : G === 2 ? 0.8 * (1 - u3 * u3) + 0.2 * k : 1 - u3;
      pos[i * 3] = px[i]; pos[i * 3 + 1] = py[i]; pos[i * 3 + 2] = pz[i];
      size[i] = s0[i] + (s1[i] - s0[i]) * g; shade[i] = sh[i];
      alpha[i] = al[i] * Math.min(1, k * SHOW[K]) * (LINGER[K] ? 1 - k * k : u);
      // her own gunsmoke across the line to her target: how far it is from the line, against how far it must be to
      // keep off it (its own heap, a little under half its size across, and the raider as she looks from there); thinned
      // the nearer it is, and pushed off it
      if (keeping && own[i] && D > 1) {
        const dx = px[i] - cx, dy = py[i] - cy, dz = pz[i] - cz, t = dx * lx + dy * ly + dz * lz;
        if (t > 0 && t < D) {
          const ex = dx - lx * t, ey = dy - ly * t, ez = dz - lz * t, d = Math.sqrt(ex * ex + ey * ey + ez * ez), keep = (size[i] * 0.45 + sightR * 0.5 * t / D) * CLEAR.margin;
          if (d < keep) {
            const f = d / keep;
            alpha[i] *= CLEAR.thin + (1 - CLEAR.thin) * f * f * (3 - 2 * f); thinned++;
            const p = (CLEAR.push * (1 - f) * dt) / Math.max(d, 0.5);
            if (d > 0.01) { vx[i] += ex * p; vy[i] += ey * p; vz[i] += ez * p; } else vy[i] += CLEAR.push * dt;
          }
        }
      }
      look[i] = pic[i] + ang[i] + 3.14159;
      const h = 1 - k * 3; heat[i] = h > 0 ? hot[i] * h * h : 0; // (the glow from below fades in the first third of its life)
    }
    geo.setDrawRange(0, n);
    for (let a = 0; a < ATTRS.length; a++) upload(geo.attributes[ATTRS[a]], n);
    if (camera) mat.uniforms.uScale.value = camera.userData.pixelScale ?? 500;
  }
  const clear = () => { n = 0; cursor = 0; seeing = false; geo.setDrawRange(0, 0); };
  // room for smoke that can be left out (a wreck's column, a damaged ship's smoke, vapour trails): only while the batch
  // is less than this full, so gunsmoke and blasts always find room
  const room = (share = 0.85) => n < max * share;
  // the raider the Captain's guns are locked on to (her middle, and how long she is), or none (main.js, each step)
  function keepClear(at, length = 0) { seeing = !!at; if (at) { sight.copy(at); sightR = length; } }
  // (for tests: the batch itself, how her smoke keeps clear, and how many of her puffs were thinned this frame)
  return { emit, update, clear, room, keepClear, max, points, clearing: CLEAR, get count() { return n; }, get dropped() { return dropped; }, get thinned() { return thinned; } };
}

// Debris: what a shot knocks off a ship, by what it hit. Splinters of wood tumble and fall fast; torn scraps of canvas,
// in the colour of her sails, flap and flutter slowly down; amber crystal shards glitter as they fall (a glow each, in fx.js's
// batch). Three batches of pieces, one draw each, and none at all while nothing of theirs is in the air; how many of
// each at most (times fx's q: fewer on a phone). Sized to the worst cases measured (tools/check.mjs): a Man-o'-war
// going down beside two other wrecks in a fight needs up to about 150 splinters at once on a phone, and a barrage of 60
// shots in a second (a big broadside's worth) about 110 scraps and 190 shards on a laptop. Only the pieces in the air
// cost anything each frame; when a batch is full, its oldest piece is reused
export const DEBRIS = { wood: 320, canvas: 128, crystal: 224 };
// how each kind flies: gravity (m/s each second), how quickly the air slows it (a share a second), how fast it spins
// (radians a second, from..to), how long it lasts (seconds, from..to), and its size (metres, across x up x along)
const FLY = {
  wood: { grav: 9.8, drag: 0.3, spin: [6, 14], life: [1.8, 2.6], size: [[0.08, 0.14], [0.06, 0.06], [0.4, 1.1]] },
  canvas: { grav: 2.5, drag: 2.5, spin: [1.5, 4], life: [3, 3], size: [[0.55, 1.3], [0.45, 1.05], [0.6, 1.1]] },
  crystal: { grav: 6, drag: 0.6, spin: [10, 10], life: [1.6, 1.6], size: [[0.12, 0.12], [0.3, 0.3], [0.12, 0.12]] },
};
// A scrap of torn canvas (one shape, shared: each scrap is sized, stretched and turned its own way): a small sheet with
// a ragged edge, a corner torn out and a tear across another, bent and curled, paler in the middle than at its frayed,
// scorched edge
function scrap() {
  const g = new THREE.PlaneGeometry(1, 1, 4, 3), idx = g.index.array, P = g.attributes.position, keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    let cx = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cx += P.getX(idx[t + k]) / 3; cy += P.getY(idx[t + k]) / 3; }
    if ((cx > 0.25 && cy > 0.17) || (cx < -0.25 && cy < -0.36)) continue; // (the corner torn out, and the tear)
    keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  g.setIndex(keep);
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i);
    const rim = Math.abs(x) > 0.49 || Math.abs(y) > 0.49 || (x > 0.2 && y > 0.1) || (Math.abs(x + 0.25) < 0.01 && Math.abs(y + 0.1667) < 0.01);
    if (rim) { const k = 0.7 + rnd() * 0.42; x *= k; y *= k; } // a ragged edge
    P.setXYZ(i, x, y, 0.16 * Math.cos(x * 3.1) + 0.1 * Math.sin(y * 4.6 + x * 2) - 0.08 * y * y); // bent and curled
    const c = rim ? 0.5 + rnd() * 0.15 : 0.92 + rnd() * 0.12;
    col[i * 3] = c; col[i * 3 + 1] = c * 0.95; col[i * 3 + 2] = c * 0.88;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
// `glowAt(p, r, g, b, size)` lights a point for one frame (fx.js): the crystal shards' glitter
export function makeDebris(scene, q = 1, glowAt = null) {
  // the canvas flaps as it falls (each scrap at its own beat: its seed, which moves with it when the batch is
  // reshuffled, so its flapping never jumps), shows a soft sheen on its folds, so even a black scrap reads as cloth,
  // and lets a little sun through
  const flap = { value: 0 }, canvas = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, vertexColors: true });
  canvas.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = flap;
    sh.vertexShader = 'uniform float uTime;\nattribute float aSeed;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float fPh = aSeed, fA = uTime * 10.0 + fPh + position.x * 5.0, fB = uTime * 7.0 + fPh * 1.7 + position.y * 4.0;
        objectNormal = normalize(objectNormal - vec3(cos(fA) * 0.6, cos(fB) * 0.32, 0.0));`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n        transformed.z += sin(fA) * 0.12 + sin(fB) * 0.08;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `float fSheen = 1.0 - abs(dot(geometryViewDir, normal));
      outgoingLight += vec3(0.14, 0.13, 0.12) * fSheen * fSheen + diffuseColor.rgb * 0.25;
      #include <opaque_fragment>`);
  };
  const shapes = {
    wood: [new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff })],
    canvas: [scrap(), canvas],
    crystal: [new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffc061, toneMapped: false })],
  };
  const col = new THREE.Color(), B = {};
  for (const kind in shapes) {
    const cap = Math.round(DEBRIS[kind] * q), mesh = new THREE.InstancedMesh(shapes[kind][0], shapes[kind][1], cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false; mesh.name = 'debris-' + kind;
    if (kind !== 'crystal') { mesh.setColorAt(0, col.set(0xffffff)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    scene.add(mesh);
    const F = () => new Float32Array(cap);
    const b = { kind, mesh, cap, n: 0, cursor: 0, dropped: 0, peak: 0, tossed: 0, fly: FLY[kind], rgb: mesh.instanceColor?.array ?? null,
      px: F(), py: F(), pz: F(), vx: F(), vy: F(), vz: F(), ax: F(), ay: F(), az: F(), ang: F(), spin: F(), life: F(), full: F(), sx: F(), sy: F(), sz: F(), seed: F() };
    b.arrays = [b.px, b.py, b.pz, b.vx, b.vy, b.vz, b.ax, b.ay, b.az, b.ang, b.spin, b.life, b.full, b.sx, b.sy, b.sz, b.seed];
    // (a scrap's seed goes to the screen with it: its flapping's beat)
    if (kind === 'canvas') { b.seedAttr = new THREE.InstancedBufferAttribute(b.seed, 1).setUsage(THREE.DynamicDrawUsage); mesh.geometry.setAttribute('aSeed', b.seedAttr); }
    B[kind] = b;
  }
  const KINDS = Object.values(B), sv = new THREE.Vector3(), lerp = (r, k) => r[0] + (r[1] - r[0]) * k;
  // `n` pieces (fewer on a phone) thrown from p along `dir` (a unit vector), each leaning off it by up to `spread`
  // (1 is about 50 degrees), at 10 to 24 m/s plus `vel` (the ship's own), `size` times their usual size, in colour `hex`
  function toss(kind, p, dir, spread, vel, n, size = 1, hex = 0xffffff) {
    const b = B[kind], m = Math.max(1, Math.round(n * q * api.share)), F = b.fly;
    col.setHex(hex); b.tossed += m;
    for (let k = 0; k < m; k++) {
      let i;
      if (b.n < b.cap) i = b.n++;
      else { i = b.cursor; b.cursor = (b.cursor + 1) % b.cap; b.dropped++; }
      sv.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(spread * Math.random()).add(dir).normalize().multiplyScalar(10 + Math.random() * 14);
      b.px[i] = p.x; b.py[i] = p.y; b.pz[i] = p.z; b.vx[i] = sv.x + vel.x; b.vy[i] = sv.y + vel.y; b.vz[i] = sv.z + vel.z;
      sv.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      b.ax[i] = sv.x; b.ay[i] = sv.y; b.az[i] = sv.z; b.ang[i] = Math.random() * 6.28; b.spin[i] = lerp(F.spin, Math.random());
      b.life[i] = b.full[i] = lerp(F.life, Math.random());
      const s = F.size, a = lerp(s[0], Math.random()) * size;
      b.sx[i] = a; b.sy[i] = s[1] ? lerp(s[1], Math.random()) * size : a; b.sz[i] = s[2] ? lerp(s[2], Math.random()) * size : 1;
      b.seed[i] = Math.random() * 6.28;
      if (b.rgb) { b.rgb[i * 3] = col.r; b.rgb[i * 3 + 1] = col.g; b.rgb[i * 3 + 2] = col.b; }
      if (b.n > b.peak) b.peak = b.n;
    }
  }
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), at = new THREE.Vector3(), axis = new THREE.Vector3(), sc = new THREE.Vector3();
  let time = 0;
  function update(dt) {
    time += dt; flap.value = time;
    for (let k = 0; k < KINDS.length; k++) {
      const b = KINDS[k], F = b.fly, d = Math.max(0, 1 - dt * F.drag), canvas = b.kind === 'canvas', crystal = b.kind === 'crystal';
      for (let i = b.n - 1; i >= 0; i--) {
        if ((b.life[i] -= dt) <= 0) {
          const j = --b.n;
          if (i !== j) { for (let a = 0; a < b.arrays.length; a++) b.arrays[a][i] = b.arrays[a][j]; if (b.rgb) for (let c = 0; c < 3; c++) b.rgb[i * 3 + c] = b.rgb[j * 3 + c]; }
          continue;
        }
        b.vy[i] -= F.grav * dt; b.vx[i] *= d; b.vy[i] *= d; b.vz[i] *= d;
        b.px[i] += b.vx[i] * dt; b.py[i] += b.vy[i] * dt; b.pz[i] += b.vz[i] * dt; b.ang[i] += b.spin[i] * dt;
        if (canvas) { const w = Math.sin(time * 9 + b.seed[i]) * 1.5 * dt; b.px[i] += Math.cos(b.seed[i]) * w; b.pz[i] += Math.sin(b.seed[i]) * w; } // a scrap flutters
      }
      for (let i = 0; i < b.n; i++) {
        const fade = Math.min(1, b.life[i] / (canvas ? 0.5 : 0.3)); // shrinking away at the end
        at.set(b.px[i], b.py[i], b.pz[i]);
        qt.setFromAxisAngle(axis.set(b.ax[i], b.ay[i], b.az[i]), b.ang[i]);
        b.mesh.setMatrixAt(i, m4.compose(at, qt, sc.set(b.sx[i] * fade, b.sy[i] * fade, b.sz[i] * fade)));
        if (crystal && glowAt) glowAt(at, 1, 0.72, 0.34, (3 + 2.5 * ((time * 11 + b.seed[i]) % 1 > 0.5 ? 1 : 0)) * fade); // its glitter
      }
      b.mesh.count = b.n; b.mesh.visible = b.n > 0;
      upload(b.mesh.instanceMatrix, b.n); if (b.rgb) upload(b.mesh.instanceColor, b.n); if (b.seedAttr) upload(b.seedAttr, b.n);
    }
  }
  function clear() { for (const b of KINDS) { b.n = 0; b.cursor = 0; b.mesh.count = 0; b.mesh.visible = false; } }
  // for tests: how many of each are in the air, their caps, the most seen, how many were cut short for room (in all,
  // and of each kind), and how many were thrown
  const stats = () => ({ wood: B.wood.n, canvas: B.canvas.n, crystal: B.crystal.n, caps: { wood: B.wood.cap, canvas: B.canvas.cap, crystal: B.crystal.cap },
    peak: { wood: B.wood.peak, canvas: B.canvas.peak, crystal: B.crystal.peak }, dropped: B.wood.dropped + B.canvas.dropped + B.crystal.dropped,
    cut: { wood: B.wood.dropped, canvas: B.canvas.dropped, crystal: B.crystal.dropped }, tossed: { wood: B.wood.tossed, canvas: B.canvas.tossed, crystal: B.crystal.tossed } });
  const resetStats = () => { for (const b of KINDS) { b.peak = b.n; b.dropped = 0; b.tossed = 0; } };
  // (share: how much of `q` is made just now, 0 to 1: fx.js turns it down for the Settings card's picture)
  const api = { toss, update, clear, stats, resetStats, meshes: KINDS.map((b) => b.mesh), share: 1 };
  return api;
}

// Smoke (and fire) pouring off a ship as it's damaged, from where she was hit (her scars: looks.js). A fresh hit
// smoulders, a thin grey wisp or two from it for a few seconds; below half her hull she trails smoke from her scars,
// more and darker as it goes, and from the tips of her flames once she burns (below a quarter). A raider going down is
// a wreck, and wrecks.js pours her smoke (a treasure ship that struck her colours smokes only from her damage)
const at = new THREE.Vector3(), drift = new THREE.Vector3(), rise = new THREE.Vector3();
export function smokeFrom(flyer, fx, dt) {
  const down = flyer.down && flyer.down.why !== 'struck';
  if (down && flyer.wreck) return;
  const f = flyer.frac('hull'), L = flyer.ship.recipe.length, W = flyer.ship.wear;
  const burning = down ? 1 : Math.max(0, (0.5 - f) * 2), hot = W ? (W.hot - 0.15) / 0.85 : 0;
  if (burning <= 0 && hot <= 0.25) return;
  flyer.smokeClock = (flyer.smokeClock ?? 0) - dt;
  if (flyer.smokeClock > 0 || !fx.smoke.room()) return;
  const body = flyer.ship.body;
  if (burning <= 0) {
    // smouldering: a thin pale wisp from her hottest scar, now and then
    flyer.smokeClock = 0.3 / fx.q;
    let best = null;
    for (const s of W.scars) if (s.on && !s.patched && (!best || s.heat > best.heat)) best = s;
    if (!best) return;
    at.set(best.x + best.nx * 0.3, best.y + best.ny * 0.3, best.z + best.nz * 0.3).applyMatrix4(body.matrixWorld);
    drift.copy(flyer.velocity).multiplyScalar(0.15); drift.y += 1.5 + Math.random();
    fx.smoke.emit(at, drift, 1.8 + hot, 0.4 + L * 0.02, (L * 0.08 + 2) * (0.7 + 0.6 * hot), 0.55 + Math.random() * 0.15, 0.22 * hot + 0.08, PUFF.pour, 1.5);
    return;
  }
  flyer.smokeClock = (down ? 0.03 : 0.12 - burning * 0.07) / fx.q; // (a phone gets fewer, bigger-spaced puffs)
  // where from: the tip of one of her flames (most of the time, once she burns), one of her scars (the bigger, the
  // likelier), or, with none, somewhere along her deck
  const fires = W ? W.fires : 0, scar = W && !(fires && Math.random() < 0.7) ? pick(W.scars) : null;
  if (fires && !scar) { const i = (Math.random() * fires) | 0; at.set(W.tips[i * 3], W.tips[i * 3 + 1], W.tips[i * 3 + 2]); }
  else if (scar) at.set(scar.x + scar.nx * 0.3, scar.y + scar.ny * 0.3, scar.z + scar.nz * 0.3).applyMatrix4(body.matrixWorld);
  else at.set((Math.random() - 0.5) * L * 0.08, 0.6, (Math.random() - 0.4) * L * 0.5).applyMatrix4(body.matrixWorld);
  // (a burning ship's smoke climbs faster, so its column stands up over her sails and reads from across a fight, or
  // from behind her)
  drift.copy(flyer.velocity).multiplyScalar(0.15); drift.x += (Math.random() - 0.5) * 2; drift.y += 2 + burning * 2 + Math.random() * 2; drift.z += (Math.random() - 0.5) * 2;
  const k = 0.75 + Math.random() * 0.5; // (each puff its own size and shade, and a burning ship's lit from below)
  fx.smoke.emit(at, drift, 2.5 + burning * 3, (L * 0.05 + 0.6) * k, (L * (0.22 + burning * 0.3) + 3) * k, Math.max(0, 0.6 - burning * 0.5 + (Math.random() - 0.5) * 0.12), 0.3 + burning * 0.4, PUFF.pour, 1.5 + burning * 1.5,
    burning > 0.6 ? (burning - 0.5) * Math.random() : 0);
  if (burning > 0.5 && Math.random() < burning * (fires ? 0.5 : 1)) fx.spark(at, rise.copy(drift).setY(drift.y + 3), 0.6 + Math.random() * 0.5, 1.2 + L * 0.06, Math.random() < 0.5 ? 0xff7a2a : 0xffc04a);
}
// one of a ship's open scars (not one patched over), the bigger the likelier (none if she has none)
function pick(scars) {
  let sum = 0;
  for (const s of scars) if (s.on && !s.patched) sum += s.r;
  if (sum <= 0) return null;
  let x = Math.random() * sum;
  for (const s of scars) if (s.on && !s.patched && (x -= s.r) <= 0) return s;
  return null;
}
