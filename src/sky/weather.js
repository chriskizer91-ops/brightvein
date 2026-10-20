// weather.js: the pieces of weather drawn in the sky, each in one draw and only while it shows (sky.js works out when):
//   the air        rain streaks slanting past the ship (more slanted the faster she flies), or in some regions' air
//                  dust, snow or pale drifting motes: one batch of little quads in a box round the camera, each where
//                  the whole box has fallen to, so the camera flies through them
//   lightning      a jagged violet-white bolt with a fork, forking down into the cloud floor kilometres off, turned to
//                  face the camera and gone in a quarter of a second
//   the mist       inside a cloud: soft white wisps over the whole view, streaming outward as she flies on and sliding
//                  as the view swings (two layers of the cloud picture, the same picture the cloud floor is drawn from)
//   scud           small scraps of cloud near the cloud floor, in a storm, or round the big clouds, kept round the ship
//                  as she flies, so she feels her speed against them
//   glare          a soft glow round the sun and a few faint coloured rings along the line through the middle of the
//                  view, when you look into a low sun
// Nothing here is made while the game runs: every buffer is made once, and each frame only numbers are written.
import * as THREE from 'three';

// ---------- the air: rain, dust, snow or motes ----------
// each kind: how it looks (0 a streak, 1 a soft round fleck), its colour, how fast it falls (m/s), how big a box it fills
// round the camera (metres), how big each fleck is (metres; a streak's length is worked out from its speed), and how
// opaque (`a`)
export const AIR = {
  rain: { round: 0, color: [0.8, 0.84, 0.94], fall: 30, box: 70, size: 0, a: 0.62 },
  dust: { round: 1, color: [1.0, 0.86, 0.62], fall: 0.4, box: 50, size: 0.17, a: 0.55 },
  snow: { round: 1, color: [0.97, 0.98, 1.0], fall: 2.6, box: 50, size: 0.2, a: 0.9 },
  motes: { round: 1, color: [0.76, 0.94, 0.84], fall: -0.25, box: 110, size: 0.5, a: 0.45 },
};
export function makeAir(touch) {
  const N = touch ? 350 : 900;
  const pos = new Float32Array(N * 4 * 2), seed = new Float32Array(N * 4 * 4), idx = new Uint16Array(N * 6);
  let r = 7; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for (let i = 0; i < N; i++) {
    const s = [rnd(), rnd(), rnd(), rnd()];
    [[-1, 0], [1, 0], [1, 1], [-1, 1]].forEach(([a, b], k) => { pos.set([a, b], (i * 4 + k) * 2); seed.set(s, (i * 4 + k) * 4); });
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 2)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); // (placed by the shader round the camera: never culled)
  // uEye: the camera; uFall: how far the whole box has fallen (and drifted on the wind), wrapped; uRel: the air's speed
  // against the ship's (a streak lies along it); uOn: 0 to 1; uScale: the screen's pixels at a metre (so a streak is
  // never thinner than a pixel and a bit)
  const U = { uEye: { value: new THREE.Vector3() }, uFall: { value: new THREE.Vector3() }, uRel: { value: new THREE.Vector3(0, -30, 0) }, uBox: { value: 110 }, uOn: { value: 0 },
    uScale: { value: 500 }, uColor: { value: new THREE.Vector3(1, 1, 1) }, uRound: { value: 0 }, uSize: { value: 0.1 }, uA: { value: 0.5 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, uniforms: U, // (a streak falling away from the view is seen from behind)
    vertexShader: `attribute vec4 seed; uniform vec3 uEye; uniform vec3 uFall; uniform vec3 uRel; uniform float uBox; uniform float uScale; uniform float uRound; uniform float uSize; uniform float uTime;
      varying float vA; varying vec2 vQ;
      void main() {
        vec3 p = uEye + mod(seed.xyz * uBox + uFall - uEye + 0.5 * uBox, uBox) - 0.5 * uBox;
        p.x += uRound * sin(uTime * (0.7 + seed.w) + seed.w * 40.0) * 0.6; // (flecks wander a little)
        vec4 mv;
        if (uRound < 0.5) {
          vec3 dir = normalize(uRel + vec3(1e-4, 0.0, 0.0));
          mv = viewMatrix * vec4(p + dir * clamp(length(uRel) * 0.07, 2.0, 9.0) * position.y, 1.0);
          vec3 vd = (viewMatrix * vec4(dir, 0.0)).xyz;
          vec2 side = normalize(vec2(-vd.y, vd.x) + vec2(1e-4, 0.0));
          mv.xy += side * position.x * max(0.025, 1.7 * -mv.z / uScale);
        } else {
          mv = viewMatrix * vec4(p, 1.0);
          mv.xy += vec2(position.x, position.y * 2.0 - 1.0) * max(uSize * (0.6 + 0.8 * seed.w), 1.6 * -mv.z / uScale);
        }
        vA = (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(p - uEye))) * smoothstep(2.5, 8.0, -mv.z);
        vQ = vec2(position.x, position.y * 2.0 - 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uOn; uniform vec3 uColor; uniform float uRound; uniform float uA; varying float vA; varying vec2 vQ;
      void main() { float a = (uRound < 0.5 ? (1.0 - abs(vQ.x)) : max(0.0, 1.0 - dot(vQ, vQ))) * vA * uA * uOn; if (a < 0.004) discard; gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
  let share = 1, count = N, kind = 'rain';
  // which kind falls (AIR), and how many of them (`k`: a share of all, for the Settings card's picture)
  function set(name, k = share) {
    const A = AIR[name]; kind = name; share = k;
    U.uColor.value.fromArray(A.color); U.uRound.value = A.round; U.uBox.value = A.box; U.uSize.value = A.size; U.uA.value = A.a;
    count = Math.max(0, Math.round(N * k * (A.round ? 0.8 : 1))); geo.setDrawRange(0, count * 6);
  }
  set('rain');
  return { mesh, U, N, set, get kind() { return kind; }, get count() { return count; } };
}

// ---------- lightning ----------
// a bolt: 16 jagged pieces from the clouds down to the cloud floor, and a fork of 6 off its middle, each a ribbon turned
// to face the camera (its glow soft at the edges), drawn for a quarter of a second
const BOLT = 17, FORK = 7;
export function makeLightning() {
  const P = BOLT + FORK, pos = new Float32Array(P * 2 * 3), side = new Float32Array(P * 2), idx = [];
  for (let i = 0; i < P; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }
  const strip = (a, n) => { for (let i = a; i < a + n - 1; i++) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); } };
  strip(0, BOLT); strip(BOLT, FORK);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('side', new THREE.BufferAttribute(side, 1)); geo.setIndex(idx);
  const U = { uOn: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, uniforms: U,
    vertexShader: 'attribute float side; varying float vS; void main() { vS = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uOn; varying float vS; void main() { float k = 1.0 - abs(vS); float a = (pow(k, 14.0) * 2.6 + pow(k, 3.0) * 0.4) * uOn; gl_FragColor = vec4(vec3(0.85, 0.76, 1.0) * a, a); }',
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 1.5; mesh.visible = false; // (after the cloud floor, before the big clouds: one in front covers it)
  const pts = Array.from({ length: P }, () => new THREE.Vector3()), along = new THREE.Vector3(), across = new THREE.Vector3(), to = new THREE.Vector3();
  let life = 0, width = 10;
  // a strike from `top` down to `foot` (world points)
  function strike(top, foot) {
    for (let i = 0; i < BOLT; i++) {
      const k = i / (BOLT - 1), j = i && i < BOLT - 1 ? 1 : 0, wob = (1 - Math.abs(k - 0.5)) * 140 * j;
      pts[i].lerpVectors(top, foot, k).add(to.set((Math.random() - 0.5) * wob, (Math.random() - 0.5) * 30 * j, (Math.random() - 0.5) * wob));
    }
    const from = pts[5 + Math.floor(Math.random() * 4)], dx = (Math.random() < 0.5 ? -1 : 1) * (250 + Math.random() * 300);
    for (let i = 0; i < FORK; i++) {
      const k = i / (FORK - 1);
      pts[BOLT + i].copy(from).add(to.set(dx * k + (Math.random() - 0.5) * 60 * (i ? 1 : 0), -k * (top.y - foot.y) * 0.35, (Math.random() - 0.5) * 90 * k));
    }
    life = 0.25; width = Math.max(18, top.distanceTo(foot) * 0.011); mesh.visible = true;
  }
  // each frame while it shows: faced to the camera (each point's two corners either side of it, across the bolt as seen)
  function update(dt, camera) {
    if (!mesh.visible) return;
    life -= dt;
    if (life <= 0) { mesh.visible = false; U.uOn.value = 0; return; }
    U.uOn.value = Math.min(1, life / 0.08) * (0.75 + 0.25 * Math.random());
    const cam = camera.position;
    for (let i = 0; i < P; i++) {
      const a = pts[Math.max(0, i === BOLT ? i : i - 1)], b = pts[Math.min(P - 1, i === BOLT - 1 ? i : i + 1)];
      along.subVectors(b, a); to.subVectors(pts[i], cam);
      across.crossVectors(along, to).normalize().multiplyScalar(width * (i >= BOLT ? 0.6 : 1) * Math.max(1, to.length() / 2500));
      pos[i * 6] = pts[i].x - across.x; pos[i * 6 + 1] = pts[i].y - across.y; pos[i * 6 + 2] = pts[i].z - across.z;
      pos[i * 6 + 3] = pts[i].x + across.x; pos[i * 6 + 4] = pts[i].y + across.y; pos[i * 6 + 5] = pts[i].z + across.z;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { mesh, strike, update, get on() { return mesh.visible; }, clear: () => { life = 0; mesh.visible = false; U.uOn.value = 0; } };
}

// ---------- the mist inside a cloud ----------
// over the whole view: two layers of the cloud picture rushing outward from the middle (each grows and fades in turn)
// as she flies on, sliding sideways as the view swings, thicker at the edges; in the mist's colour. `uCloud` is the
// world's cloud picture
export function makeVeil(uCloud, mood) {
  const U = { uCloud, uMist: mood.uMist, uMistCol: mood.uMistCol, uZoom: { value: 0 }, uOff: { value: new THREE.Vector2() }, uAspect: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D uCloud; uniform float uMist; uniform vec3 uMistCol; uniform float uZoom; uniform vec2 uOff; uniform float uAspect; varying vec2 vUv;
      float at(vec2 uv) { return dot(texture2D(uCloud, uv).rg, vec2(255.0 * 256.0, 255.0) / 65535.0); }
      void main() {
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        float a = 0.0;
        for (int i = 0; i < 2; i++) {
          float ph = fract(uZoom + float(i) * 0.5);
          a += sin(ph * 3.14159) * smoothstep(0.42, 0.7, at(q * mix(0.5, 0.12, ph) + uOff + float(i) * 0.37));
        }
        // (wisps a little lighter than the mist, the gaps between them a little darker, so they're seen streaming by)
        float e = smoothstep(0.25, 0.85, length(q));
        gl_FragColor = vec4(uMistCol * (0.84 + 0.32 * a), uMist * (0.5 + 0.3 * e + 0.15 * a));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; mesh.renderOrder = 9; mesh.visible = false;
  return { mesh, U };
}

// ---------- scud ----------
// little scraps of cloud, 30 to 90 m across, in a box 1.6 km wide and 300 m deep round the ship, wrapping round as she
// flies; faded right by the camera and far off; `uScud` how many show (0 to 1). They use the big clouds' picture
export function makeScud(map, mood, touch) {
  const N = touch ? 28 : 40, SPAN = 1600, DEEP = 300;
  const geo = new THREE.PlaneGeometry(1, 1), offs = new Float32Array(N * 3), sizes = new Float32Array(N);
  let r = 11; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for (let i = 0; i < N; i++) { offs.set([rnd() * SPAN, rnd() * DEEP, rnd() * SPAN], i * 3); sizes[i] = 30 + rnd() * 60; }
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offs, 3)); geo.setAttribute('size', new THREE.InstancedBufferAttribute(sizes, 1));
  const ig = new THREE.InstancedBufferGeometry().copy(geo); ig.instanceCount = N;
  const U = { uMap: { value: map }, uCenter: { value: new THREE.Vector3() }, uScud: { value: 0 }, uPuffLit: mood.uPuffLit, uPuffShade: mood.uPuffShade, uFlash: mood.uFlash };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: U,
    vertexShader: `attribute vec3 offset; attribute float size; uniform vec3 uCenter; varying vec2 vUv; varying float vFade;
      void main() {
        vec3 p = uCenter + mod(offset - uCenter + vec3(${SPAN / 2}.0, ${DEEP / 2}.0, ${SPAN / 2}.0), vec3(${SPAN}.0, ${DEEP}.0, ${SPAN}.0)) - vec3(${SPAN / 2}.0, ${DEEP / 2}.0, ${SPAN / 2}.0);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        mv.xy += position.xy * vec2(size * 1.7, size * 0.7);
        vFade = smoothstep(18.0, 70.0, -mv.z) * (1.0 - smoothstep(${SPAN * 0.3}.0, ${SPAN * 0.5}.0, length(p.xz - uCenter.xz))) * (1.0 - smoothstep(${DEEP * 0.3}.0, ${DEEP * 0.5}.0, abs(p.y - uCenter.y)));
        vUv = uv; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uPuffLit; uniform vec3 uPuffShade; uniform float uScud; uniform float uFlash; varying vec2 vUv; varying float vFade;
      void main() { vec4 c = texture2D(uMap, vUv); c.rgb *= mix(uPuffShade, uPuffLit, vUv.y); c.rgb += vec3(0.45, 0.5, 0.65) * uFlash; c.a *= vFade * 0.55 * uScud; if (c.a < 0.01) discard; gl_FragColor = c;
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(ig, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
  return { mesh, U, N, count: (k) => { ig.instanceCount = Math.round(N * k); } };
}

// ---------- the sun's glare ----------
// six soft discs in one draw over everything: a big glow on the sun, then faint coloured rings along the line from it
// through the middle of the view (where each sits along that line, how big, its colour). Placed by sky.js
const GHOSTS = [[0, 0.55, [1.0, 0.9, 0.75]], [0.45, 0.06, [0.45, 0.6, 0.8]], [0.75, 0.035, [0.8, 0.6, 0.4]], [1.25, 0.09, [0.4, 0.75, 0.5]], [1.55, 0.05, [0.7, 0.45, 0.8]], [1.9, 0.14, [0.6, 0.5, 0.35]]];
export function makeGlare() {
  const n = GHOSTS.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  GHOSTS.forEach(([, , c], i) => col.set(c, i * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const U = { uOn: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, uniforms: U,
    vertexShader: 'attribute float size; varying vec3 vC; varying float vRing; void main() { vC = color; vRing = position.z; gl_PointSize = size; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uOn; varying vec3 vC; varying float vRing; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = mix(pow(max(0.0, 1.0 - r), 2.2), smoothstep(0.55, 0.8, r) * (1.0 - smoothstep(0.8, 1.0, r)) * 0.6 + (1.0 - r) * 0.15, vRing) * uOn; if (a < 0.003) discard; gl_FragColor = vec4(vC * a, a); }',
  });
  const mesh = new THREE.Points(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 8; mesh.visible = false;
  // the sun at (x, y) on the screen (-1 to 1 across and up), `k` how strong, `h` the screen's height in pixels, `most`
  // the biggest point the graphics card draws
  function place(x, y, k, h, most = 1024) {
    for (let i = 0; i < n; i++) {
      const [t, s] = GHOSTS[i];
      pos[i * 3] = x * (1 - t); pos[i * 3 + 1] = y * (1 - t); pos[i * 3 + 2] = i ? 1 : 0;
      size[i] = Math.min(h * s, most);
    }
    U.uOn.value = k; mesh.visible = k > 0.01;
    geo.attributes.position.needsUpdate = true; geo.attributes.size.needsUpdate = true;
  }
  return { mesh, U, place, hide: () => { mesh.visible = false; U.uOn.value = 0; }, get on() { return mesh.visible; }, get strength() { return U.uOn.value; } };
}
