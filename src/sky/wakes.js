// wakes.js: a soft, shimmering ribbon of stirred-up Aether streaming behind every ship from under her stern, longer and
// brighter the faster she flies: gold behind the Captain's ship, red behind a raider's (so a raider far off shows as a
// red streak, and which way she's heading), crimson behind a raider captain's, glittering gold behind a treasure ship,
// a broad orange one behind a Man-o'-war. Far off, a raider's wake grows longer, wider and brighter (up to three times
// as long at 1.3 km) and steadier (a solid streak, not a row of beads), so even a raider that's only a speck shows which
// way she's going. A raider lost in cloud (sky.js) leaves no wake to give her away: hers fades out while she's lost, and
// comes back when she shows herself. In hard turns, steep dives and a Surge, thin white vapour trails peel off the tips
// of the Captain's wings too.
// Every trail in the sky is one draw: a ribbon each, turned to face the camera on the graphics card and never thinner
// than a couple of pixels however far off, its points written into one set of buffers each frame (only those in use are
// sent). Each trail is a ring of points left behind every 0.09 s, the newest following its ship every frame, so it
// never gaps; a ship gone, her trail fades out where she left it. Nothing is made new as they're drawn.
import * as THREE from 'three';
import { foldPoint } from '../ship/dress.js';

// how often a point is left behind (seconds), how many points a trail keeps (a laptop, a phone), how many trails at most,
// how wide a wake is at its head (a share of the ship's length), the thinnest it's drawn (pixels: a laptop, a phone), how
// long a gone ship's trail takes to fade (seconds), and the vapour trails' width (metres) and brightness. Far off (from
// `near` to `far` metres from the camera) a raider's points are left `long` times as far apart again, so the same
// points make a trail that much longer (the shader widens and brightens it with distance too: up to `wide` times the
// thinnest and `bright` times as bright). A raider lost in cloud: her wake fades out (and back in) at `veil` a second
export const WAKE = { every: 0.09, points: [22, 16], trails: 24, width: 0.08, minPx: [2.5, 2], fade: 1, vapour: 0.14, mist: 0.35, veil: 4,
  far: { near: 400, far: 1300, long: 2, wide: 1.8, bright: 1.6 } };
// the colours, and which glitter; how much wider and brighter a kind is than a raider's: the Captain's own a little
// narrower and half as bright (the camera looks straight down it all the time, so it's a soft shimmer behind her, not
// a blaze), a Man-o'-war's broader
export const WAKE_COLORS = { player: 0xffc860, raider: 0xff5a3a, captain: 0xff3070, treasure: 0xffd56a, manowar: 0xff8a2a, vapour: 0xf4f8ff };
export const WAKE_KINDS = { player: { wide: 0.8, bright: 0.5 }, manowar: { wide: 1.4, bright: 1 } };

export function makeWakes(scene, { touch = false } = {}) {
  const N = WAKE.points[touch ? 1 : 0], T = WAKE.trails, V = T * N * 2;
  const pos = new Float32Array(V * 3), tan = new Float32Array(V * 3), meta = new Float32Array(V * 4), col = new Float32Array(V * 4);
  const geo = new THREE.BufferGeometry(), attrs = [['position', pos, 3], ['tan', tan, 3], ['meta', meta, 4], ['col', col, 4]].map(([name, a, n]) => {
    const at = new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, at); return at;
  });
  const idx = [];
  for (let s = 0; s < T; s++) for (let k = 0; k < N - 1; k++) { const a = (s * N + k) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx); geo.setDrawRange(0, 0);
  const FAR = WAKE.far, uni = { uTime: { value: 0 }, uScale: { value: 500 }, uMinPx: { value: WAKE.minPx[touch ? 1 : 0] } };
  const mat = new THREE.ShaderMaterial({
    // (laid over what's behind as glowing light that also tints it: so it glows over the dark sea and still shows as
    // its own colour over white cloud, where light added would vanish)
    uniforms: uni, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    vertexShader: `attribute vec3 tan; attribute vec4 meta; attribute vec4 col; uniform float uScale; uniform float uMinPx;
      varying vec4 vCol; varying vec2 vM; varying float vG; varying float vFar;
      void main() {
        // (across the trail, facing the camera; never thinner than uMinPx pixels, and wider far off)
        vec3 side = cross(tan, cameraPosition - position); float l = length(side);
        side = l > 1e-6 ? side / l : vec3(0.0, 1.0, 0.0);
        float d = -(viewMatrix * vec4(position, 1.0)).z;
        vFar = smoothstep(${FAR.near.toFixed(1)}, ${FAR.far.toFixed(1)}, d);
        float hw = max(meta.z * (0.35 + 0.65 * (1.0 - meta.y)), uMinPx * (1.0 + ${(FAR.wide - 1).toFixed(2)} * vFar) * max(d, 1.0) / uScale);
        gl_Position = projectionMatrix * viewMatrix * vec4(position + side * meta.x * hw, 1.0);
        vCol = col; vM = meta.xy; vG = meta.w;
      }`,
    fragmentShader: `uniform float uTime; varying vec4 vCol; varying vec2 vM; varying float vG; varying float vFar;
      float wH(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main() {
        // (brightest just behind her, fading out along the trail and softly to nothing at its edges, shimmering as it
        // goes; never so bright that it burns out to a flat white-gold band: it eases off towards 0.7. Far off, a few
        // pixels wide, it's fuller across, fades more slowly along, is brighter and hardly shimmers, so it reads as one
        // clear streak, not a row of beads)
        float across = 1.0 - pow(abs(vM.x), 2.0 + 2.0 * vFar);
        float a = 1.4 * pow(max(0.0, 1.0 - vM.y), 1.3 - 0.6 * vFar) * smoothstep(0.0, 0.08, vM.y) * across * across * vCol.a * (0.75 + 0.25 * (1.0 - 0.85 * vFar) * sin(vM.y * 40.0 - uTime * 9.0)) * (1.0 + ${(FAR.bright - 1).toFixed(2)} * vFar);
        float most = 0.7 + 0.2 * vFar;
        a = most * (1.0 - exp(-a / most));
        if (vG > 0.5) a += step(0.97, wH(vec2(floor(vM.y * 70.0), floor(uTime * 12.0) + floor(vM.x * 2.0 + 2.0) * 31.0))) * 2.0 * vCol.a * (1.0 - vM.y);
        if (a < 0.004) discard;
        gl_FragColor = vec4(vCol.rgb * a, min(1.0, a) * 0.75);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wakes'; mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.visible = false;
  scene.add(mesh);

  // the trails: each a ring of points (newest first; the first follows its ship every frame), when each was left, and
  // how bright it was then
  // (`every`: how far apart in time its points are left now, longer far off; `hide`: her ship lost in cloud, and
  // `veil` how far her wake has faded out for it, 0 to 1)
  const made = () => ({ on: false, owner: null, seen: 0, kind: '', at: new THREE.Vector3(), w: 1, bright: 1, r: 1, g: 1, b: 1, glitter: 0, vapour: 0, side: 0, wing: null,
    pts: new Float32Array(N * 3), t: new Float32Array(N), k: new Float32Array(N), n: 0, last: 0, fade: 1, glow: 0, every: WAKE.every, hide: false, veil: 0 });
  const trails = Array.from({ length: T }, made), c = new THREE.Color(), p = new THREE.Vector3();
  let frame = 0, time = 0, used = 0;

  // a trail for flyer f (flight.js): her wake ('player', 'raider', 'captain', 'treasure' or 'manowar'), or (vapour = 1 or
  // -1) the vapour off her widest wing's tip on that side
  function attach(f, kind, vapour = 0) {
    const s = trails.find((x) => !x.on);
    if (!s) return null;
    const ship = f.ship, R = ship.recipe, hull = ship.hull, L = R.length;
    c.set(WAKE_COLORS[vapour ? 'vapour' : kind] ?? WAKE_COLORS.raider);
    const K = WAKE_KINDS[kind];
    Object.assign(s, { on: true, owner: f, seen: frame, kind, w: vapour ? WAKE.vapour : WAKE.width * L * (K?.wide ?? 1), bright: K?.bright ?? 1, r: c.r, g: c.g, b: c.b,
      glitter: kind === 'treasure' ? 1 : 0, vapour, n: 0, last: -1e9, fade: 1, glow: 0, wing: null, every: WAKE.every, hide: false, veil: 0 });
    if (vapour) {
      for (const w of ship.wings) if (w.tip && w.side > 0 && (!s.wing || w.tip.x > s.wing.tip.x)) s.wing = w;
    } else {
      // (from under her stern, a little above her keel there)
      const z = hull.zs + 0.08 * L;
      s.at.set(0, hull.keel(z) * 0.6 + hull.rim(z) * 0.4, z);
    }
    return s;
  }
  // where a trail's ship leaves it now (the world), into p
  function source(s) {
    const ship = s.owner.ship;
    if (s.vapour && s.wing) { const w = s.wing; foldPoint(p.set(s.vapour * w.tip.x, w.tip.y, w.tip.z), s.vapour, w.mz, ship.U.uFold.value.x); }
    else p.copy(s.at);
    return p.applyMatrix4(ship.body.matrixWorld);
  }
  // how bright her trail is now: the wake brighter the faster she flies, and more so in a Surge; the vapour only in hard
  // turns, steep dives near her top speed and a Surge
  function brightness(s, dt) {
    const f = s.owner, surging = f.surge?.on > 0, sp = Math.min(1.6, f.speed / f.H.vmax);
    if (f.down) return 0;
    if (!s.vapour) return (0.25 + 0.75 * Math.pow(sp, 1.5)) * (surging ? 1.8 : 1) * s.bright;
    const want = surging || Math.abs(f.turn) > 0.6 || (sp > 0.85 && f.velocity.y < -8) ? WAKE.mist : 0;
    s.glow += (want - s.glow) * (1 - Math.exp(-dt * 3));
    return s.glow;
  }

  // every frame: each ship's trails followed (the Captain `player`, the raiders' list), new ones for raiders just come,
  // the gone ones fading, a lost raider's fading out (and back in once she shows herself), and the lot written for the
  // graphics card
  function update(dt, now, camera, player, raiders) {
    frame++; time = now; uni.uTime.value = now; uni.uScale.value = camera.userData.pixelScale ?? 500;
    if (player) seen(player, 'player', true);
    for (let i = 0; i < raiders.length; i++) { const r = raiders[i]; seen(r.f, r.wake ?? (r.wake = r.captain ? 'captain' : r.role === 'prize' ? 'treasure' : r.id === 'manowar' ? 'manowar' : 'raider'), false, !!r.lost); }
    used = 0;
    for (let i = 0; i < T; i++) {
      const s = trails[i];
      if (!s.on) { if (s.n) blank(i); continue; }
      const here = s.seen === frame;
      if (!here) { s.fade -= dt / WAKE.fade; if (s.fade <= 0) { s.on = false; s.owner = null; blank(i); continue; } }
      if (here) {
        const k = brightness(s, dt);
        source(s);
        s.veil += ((s.hide ? 1 : 0) - s.veil) * (1 - Math.exp(-dt * WAKE.veil));
        // (a raider's points further apart far off: the same points, a longer trail; not while she's lost in cloud)
        if (!s.vapour && s.kind !== 'player' && !s.hide) { const d = p.distanceTo(camera.position), x = Math.min(1, Math.max(0, (d - FAR.near) / (FAR.far - FAR.near))); s.every = WAKE.every * (1 + FAR.long * x * x * (3 - 2 * x)); }
        // a new point left behind every so often (the newest moves along one), and the newest always where she is
        if (now - s.last >= s.every || !s.n) { s.pts.copyWithin(3, 0, (N - 1) * 3); s.t.copyWithin(1, 0, N - 1); s.k.copyWithin(1, 0, N - 1); s.n = Math.min(N, s.n + 1); s.last = now; }
        s.pts[0] = p.x; s.pts[1] = p.y; s.pts[2] = p.z; s.t[0] = now; s.k[0] = k;
      }
      write(i, s);
      used = i + 1;
    }
    for (const at of attrs) { const r = (at.userRange ??= { start: 0, count: 0 }); r.count = used * N * 2 * at.itemSize; at.updateRanges.length = 0; at.updateRanges.push(r); at.needsUpdate = true; }
    geo.setDrawRange(0, used * (N - 1) * 6); mesh.visible = used > 0;
  }
  // a ship this frame: her trails (attached the first time she's seen; one first seen lost in cloud, already faded out),
  // and whether she's lost in cloud (`hide`)
  function seen(f, kind, captain = false, hide = false) {
    let wake = false;
    for (let i = 0; i < T; i++) { const s = trails[i]; if (s.on && s.owner === f) { s.seen = frame; s.hide = hide; if (!s.vapour) wake = true; } }
    if (wake) return;
    const s = attach(f, kind); if (s) { s.seen = frame; s.hide = hide; s.veil = hide ? 1 : 0; }
    if (captain) for (const side of [1, -1]) { const v = attach(f, kind, side); if (v) v.seen = frame; }
  }
  // trail i's points, as two corners each (how old each is: by its time, or by its place along the trail, whichever is
  // older, so the tail always fades to nothing even just after its points were spread further apart)
  function write(i, s) {
    const life = N * s.every, fade = Math.max(0, s.fade) * (1 - s.veil);
    for (let j = 0; j < N; j++) {
      const q = Math.min(j, s.n - 1), a = q * 3, prev = Math.max(0, q - 1) * 3, next = Math.min(s.n - 1, q + 1) * 3;
      const age = j >= s.n ? 1 : Math.min(1, Math.max((time - s.t[q]) / life, j / (N - 1)));
      for (let e = 0; e < 2; e++) {
        const v = (i * N + j) * 2 + e;
        pos[v * 3] = s.pts[a]; pos[v * 3 + 1] = s.pts[a + 1]; pos[v * 3 + 2] = s.pts[a + 2];
        tan[v * 3] = s.pts[prev] - s.pts[next]; tan[v * 3 + 1] = s.pts[prev + 1] - s.pts[next + 1]; tan[v * 3 + 2] = s.pts[prev + 2] - s.pts[next + 2];
        meta[v * 4] = e ? 1 : -1; meta[v * 4 + 1] = age; meta[v * 4 + 2] = s.w; meta[v * 4 + 3] = s.glitter;
        col[v * 4] = s.r; col[v * 4 + 1] = s.g; col[v * 4 + 2] = s.b; col[v * 4 + 3] = (j >= s.n ? 0 : s.k[q]) * fade;
      }
    }
  }
  // trail i empty (nothing drawn)
  function blank(i) {
    const s = trails[i]; s.n = 0;
    for (let v = i * N * 2; v < (i + 1) * N * 2; v++) col[v * 4 + 3] = 0;
  }
  // a fresh voyage, or back to port: no trails
  function clear() { for (let i = 0; i < T; i++) { trails[i].on = false; trails[i].owner = null; blank(i); } geo.setDrawRange(0, 0); mesh.visible = false; used = 0; }
  // for tests: how many trails, and how many points they hold; a trail's length, head to tail (metres), its brightness
  // now, and how far it has faded out for her being lost in cloud
  function stats() {
    let n = 0, pts = 0;
    for (const s of trails) if (s.on) { n++; pts += s.n; }
    return { trails: n, points: pts, used };
  }
  function of(f, vapour = 0) {
    const s = trails.find((x) => x.on && x.owner === f && x.vapour === vapour);
    if (!s) return null;
    const a = s.pts, b = (s.n - 1) * 3;
    return { length: Math.hypot(a[0] - a[b], a[1] - a[b + 1], a[2] - a[b + 2]), bright: s.k[0], points: s.n, width: s.w, kind: s.kind, color: c.setRGB(s.r, s.g, s.b).getHex(), veil: s.veil };
  }
  return { mesh, update, clear, stats, of };
}
