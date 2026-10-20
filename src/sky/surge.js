// surge.js: how a Surge looks. The crystals pour into the sails for three seconds, and it should feel fast: pale
// streaks of wind rush past the ship, her crystals flare and stream blue light up into the sails, two white vapour
// trails pour from her outermost sail tips and hang where she's been, and a ring of blue sparks bursts from her stern
// as she leaps forward (and main.js widens the view with a jolt and drops it back a little). Diving near her top speed
// shows the streaks faintly too.
// The streaks are one draw: a few dozen thin quads whose places are all worked out on the graphics card from a handful
// of numbers, and only those change each frame; hidden, they cost nothing.
import * as THREE from 'three';
import { on } from './events.js';
import { PUFF } from './effects.js';
import { foldPoint } from '../ship/dress.js';

// how many streaks (times fx's q), how long a stretch of sky they fill (metres), how bright the crystals flare, blue
// sparks a second, seconds between vapour puffs (a laptop, a phone), and the view's low rumble (trauma, fx.js)
export const SURGE_FX = { streaks: 90, span: 140, flare: 0.8, sparks: 30, trail: [0.04, 0.07], rumble: 0.25 };
const BLUE = 0x9fe7ff, UP = new THREE.Vector3(0, 1, 0);

export function makeSurge({ scene, fx }) {
  const N = Math.round(SURGE_FX.streaks * fx.q), trailEvery = SURGE_FX.trail[fx.touch ? 1 : 0];
  // a streak: a quad from its head (x = 0) back along its tail (x = 1), its width across y
  const quad = new THREE.BufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0], 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const geo = new THREE.InstancedBufferGeometry().copy(quad); geo.instanceCount = N;
  const seed = new Float32Array(N * 3); // each streak: its angle round the ship's path, how far out (0..1), and its place along it (0..1)
  for (let i = 0; i < N; i++) { seed[i * 3] = Math.random() * Math.PI * 2; seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random(); }
  geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seed, 3));
  const U = { uOrigin: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, 1) }, uSide: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) },
    uPhase: { value: 0 }, uLen: { value: 6 }, uAlpha: { value: 0 }, uR: { value: new THREE.Vector2(6, 30) }, uSpan: { value: SURGE_FX.span } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 seed; uniform vec3 uOrigin; uniform vec3 uDir; uniform vec3 uSide; uniform vec3 uUp; uniform float uPhase; uniform float uLen;
      uniform float uAlpha; uniform vec2 uR; uniform float uSpan; varying float vA; varying float vU;
      void main() {
        // where along the path (the air stands still, so the streaks rush back past the ship as she flies), and round it
        float along = mod(seed.z * uSpan - uPhase, uSpan) - uSpan * 0.5;
        float r = uR.x + seed.y * (uR.y - uR.x);
        vec3 c = uOrigin + uDir * along + (uSide * cos(seed.x) + uUp * sin(seed.x)) * r;
        vec3 across = normalize(cross(uDir, normalize(cameraPosition - c)));
        float d = length(cameraPosition - c);
        vec3 p = c - uDir * (position.x * uLen) + across * (position.y * (0.12 + d * 0.0025));
        float e = 1.0 - abs(along) / (uSpan * 0.5);
        vA = uAlpha * e * e; vU = position.x;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `varying float vA; varying float vU;
      void main() { float a = vA * (1.0 - vU) * 0.55; if (a < 0.004) discard; gl_FragColor = vec4(vec3(0.84, 0.94, 1.0), a); }`,
  });
  const streaks = new THREE.Mesh(geo, mat);
  streaks.frustumCulled = false; streaks.visible = false; streaks.renderOrder = 4; streaks.name = 'surge-streaks';
  scene.add(streaks);

  let P = null, Z = null, alpha = 0, flare = 0, sparks = 0, trail = 0;
  const tips = [new THREE.Vector3(), new THREE.Vector3()], p = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Vector3(), s = new THREE.Vector3(), u = new THREE.Vector3();
  // the Captain's ship (flight.js) and her hit zones (damage.js): her vapour trails pour from the tips of her widest
  // wings, snapped open as they are in a Surge (src/ship/dress.js)
  function follow(flyer, zones) {
    if (P && P !== flyer) P.ship.glow.material.uniforms.uBoost.value = 1;
    P = flyer; Z = zones;
    let best = null;
    for (const w of flyer.ship.wings) if (w.tip && w.side > 0 && (!best || w.tip.x > best.tip.x)) best = w;
    if (best) for (const [i, side] of [[0, 1], [1, -1]]) foldPoint(tips[i].set(side * best.tip.x, best.tip.y, best.tip.z), side, best.mz, -0.1);
  }
  const M = () => P.ship.body.matrixWorld;
  // a ring of blue sparks bursting from her stern as she leaps forward
  on('surge', () => {
    if (!P || !Z) return;
    const hb = Z.hullBox;
    p.set(0, (hb.min.y + hb.max.y) / 2, hb.min.z).applyMatrix4(M());
    s.set(1, 0, 0).transformDirection(M()); u.set(0, 1, 0).transformDirection(M());
    for (let i = 0, n = Math.round(24 * fx.q); i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      fx.spark(p, v.copy(P.velocity).addScaledVector(s, Math.cos(a) * 18).addScaledVector(u, Math.sin(a) * 18), 0.5, 2.2, BLUE, 2.5, 0);
    }
  });

  function update(dt) {
    if (!P) return;
    const on = P.surge.on > 0 && !P.down, speed = P.velocity.length(), L = P.ship.recipe.length;
    const dive = !P.down && speed > P.H.vmax * 0.9 && P.velocity.y < -3;
    const want = on ? 1 : dive ? 0.25 : 0;
    alpha += (want - alpha) * (1 - Math.exp(-dt * (want > alpha ? 8 : 3)));
    flare += ((on ? 1 : 0) - flare) * (1 - Math.exp(-dt * (on ? 10 : 3)));
    P.ship.glow.material.uniforms.uBoost.value = 1 + SURGE_FX.flare * flare;
    // the streaks: only a few numbers change each frame
    streaks.visible = alpha > 0.01;
    if (streaks.visible) {
      if (speed > 1) U.uDir.value.copy(P.velocity).divideScalar(speed); else U.uDir.value.set(Math.sin(P.heading), 0, Math.cos(P.heading));
      U.uSide.value.crossVectors(U.uDir.value, UP);
      if (U.uSide.value.lengthSq() < 0.01) U.uSide.value.set(1, 0, 0);
      U.uSide.value.normalize(); U.uUp.value.crossVectors(U.uSide.value, U.uDir.value);
      U.uOrigin.value.copy(P.pos).setY(P.pos.y + L * 0.25);
      U.uPhase.value = (U.uPhase.value + speed * dt) % SURGE_FX.span;
      U.uLen.value = Math.max(2, speed * 0.12); U.uAlpha.value = alpha; U.uR.value.set(4 + L * 0.35, 12 + L * 1.3);
    }
    if (!on || !Z) return;
    // a low rumble while it lasts
    fx.cam.trauma = Math.max(fx.cam.trauma, SURGE_FX.rumble);
    // blue light streaming from the tops of her crystals up into the middle of her sails
    sparks += dt * SURGE_FX.sparks * fx.q;
    if (sparks >= 1 && Z.crystals.length && Z.sails.length && fx.room()) for (; sparks >= 1; sparks--) {
      const b = Z.crystals[(Math.random() * Z.crystals.length) | 0], t = Z.sails[(Math.random() * Z.sails.length) | 0];
      if (b.isEmpty() || t.isEmpty()) continue;
      b.getCenter(c); p.set(c.x + (Math.random() - 0.5) * (b.max.x - b.min.x) * 0.6, b.max.y, c.z + (Math.random() - 0.5) * (b.max.z - b.min.z) * 0.6).applyMatrix4(M());
      t.getCenter(c); c.applyMatrix4(M());
      fx.spark(p, v.copy(c).sub(p).multiplyScalar(0.9 / 0.45).add(P.velocity), 0.45, 0.5 + L * 0.02, BLUE, 0, 0);
    }
    sparks = Math.min(sparks, 3);
    // two white vapour trails from her sail tips, left hanging where she's been
    if ((trail -= dt) <= 0) {
      trail = trailEvery;
      if (fx.smoke.room()) for (const t of tips) fx.smoke.emit(p.copy(t).applyMatrix4(M()), v.set(0, 0, 0), 1.4, 0.9 * (0.6 + L / 50), 4 * (0.6 + L / 50), 1.3, 0.45, PUFF.vapour, 0);
    }
  }
  // a fresh voyage, or back to port: nothing showing, and her crystals back to their own glow
  function clear() {
    alpha = flare = sparks = trail = 0; streaks.visible = false;
    if (P) P.ship.glow.material.uniforms.uBoost.value = 1;
  }
  return { streaks, follow, update, clear, get alpha() { return alpha; } };
}
