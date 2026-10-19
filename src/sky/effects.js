// effects.js: smoke from damaged ships, thickening and darkening as the hull goes, and the black trail of a ship
// going down. One batch of soft round puffs for the whole sky (fire and sparks are the bolts' glows, guns.js).
import * as THREE from 'three';

export function makeSmoke(scene, max = 900) {
  const pos = new Float32Array(max * 3), size = new Float32Array(max), shade = new Float32Array(max), alpha = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('shade', new THREE.BufferAttribute(shade, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float size; attribute float shade; attribute float alpha; uniform float uScale; varying float vS; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * uScale / -mv.z, 700.0); vS = shade; vA = alpha; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vS; varying float vA;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.25, r) * vA;
        if (a < 0.01) discard;
        vec3 c = mix(vec3(0.07, 0.06, 0.06), vec3(0.72, 0.71, 0.7), vS) * (1.0 - d.y * 0.35);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.renderOrder = 3; scene.add(points);
  const puffs = [];
  // a puff at p drifting with v, growing from s0 to s1 metres across over its life; shade 0 is black, 1 pale grey
  function emit(p, v, life, s0, s1, shadeOf, a = 0.75) {
    if (puffs.length >= max) puffs.shift();
    puffs.push({ p: p.clone(), v: v.clone(), life, max: life, s0, s1, shade: shadeOf, a });
  }
  function update(dt, camera) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i]; q.life -= dt;
      if (q.life <= 0) { puffs.splice(i, 1); continue; }
      q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 0.6); q.v.y += dt * 1.5;
    }
    puffs.forEach((q, i) => {
      const k = 1 - q.life / q.max;
      pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z;
      size[i] = q.s0 + (q.s1 - q.s0) * Math.sqrt(k); shade[i] = q.shade; alpha[i] = q.a * Math.min(1, k * 6) * (1 - k);
    });
    geo.setDrawRange(0, puffs.length);
    for (const a of ['position', 'size', 'shade', 'alpha']) geo.attributes[a].needsUpdate = true;
    if (camera) mat.uniforms.uScale.value = camera.userData.pixelScale ?? 500;
  }
  return { emit, update, puffs };
}

// Smoke (and fire) pouring off a ship as it's damaged: none above half hull, then more and darker
const at = new THREE.Vector3(), drift = new THREE.Vector3();
export function smokeFrom(flyer, smoke, sparks, dt) {
  const f = flyer.frac('hull'), L = flyer.ship.recipe.length;
  const burning = flyer.down ? 1 : Math.max(0, (0.5 - f) * 2);
  if (burning <= 0) return;
  flyer.smokeClock = (flyer.smokeClock ?? 0) - dt;
  if (flyer.smokeClock > 0) return;
  flyer.smokeClock = flyer.down ? 0.03 : 0.12 - burning * 0.07;
  const body = flyer.ship.body;
  at.set((Math.random() - 0.5) * L * 0.08, 0.6, (Math.random() - 0.4) * L * 0.5).applyMatrix4(body.matrixWorld);
  drift.copy(flyer.velocity).multiplyScalar(0.15).add({ x: (Math.random() - 0.5) * 2, y: 2 + Math.random() * 2, z: (Math.random() - 0.5) * 2 });
  smoke.emit(at, drift, 2.5 + burning * 3, L * 0.05 + 0.6, L * (0.22 + burning * 0.3) + 3, 0.6 - burning * 0.5, 0.3 + burning * 0.35);
  if (burning > 0.5 && Math.random() < burning) sparks(at, drift.clone().add({ x: 0, y: 3, z: 0 }), 0.6 + Math.random() * 0.5, 1.2 + L * 0.06, Math.random() < 0.5 ? 0xff7a2a : 0xffc04a);
}

// Debris: planks, splinters and bits of brass knocked off a ship by a hit, tumbling and falling away. One batch of
// small boxes for the whole sky.
export function makeDebris(scene, max = 260) {
  const geo = new THREE.BoxGeometry(1, 0.22, 0.34);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.1 });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false;
  mesh.setColorAt(0, new THREE.Color()); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const bits = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
  const COLORS = { wood: [0x6e4a32, 0x8a6446, 0x4a3426], brass: [0xd9a743, 0xb58a35], canvas: [0xe8dcc0, 0xcfc2a4], crystal: [0xffb04a, 0xffd27a] };
  // n bits at p, thrown out at up to `speed` m/s on top of `vel`, each about `size` metres long
  function spawn(p, vel, n = 6, size = 0.6, kind = 'wood', speed = 14) {
    const cs = COLORS[kind] ?? COLORS.wood;
    for (let i = 0; i < n; i++) {
      if (bits.length >= max) bits.shift();
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.35 + Math.random() * 0.65));
      if (vel) v.addScaledVector(vel, 0.6);
      bits.push({ p: p.clone(), v, r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), w: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9),
        s: size * (0.4 + Math.random() * 0.9), life: 3 + Math.random() * 2.5, c: new THREE.Color(cs[Math.floor(Math.random() * cs.length)]) });
    }
  }
  function update(dt) {
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]; b.life -= dt;
      if (b.life <= 0) { bits.splice(i, 1); continue; }
      b.v.y -= 9.8 * dt; b.v.multiplyScalar(1 - dt * 0.3); b.p.addScaledVector(b.v, dt); b.r.addScaledVector(b.w, dt);
    }
    bits.forEach((b, i) => {
      const k = Math.min(1, b.life / 0.8);
      q.setFromEuler(e.set(b.r.x, b.r.y, b.r.z)); m4.compose(b.p, q, sc.set(b.s * k, b.s * k, b.s * k));
      mesh.setMatrixAt(i, m4); mesh.setColorAt(i, b.c);
    });
    mesh.count = bits.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  const clear = () => { bits.length = 0; update(0); };
  return { spawn, update, clear, bits };
}

// A flash of light for the big moments (a ship blowing up, lightning): one light, moved to the latest, fading fast
export function makeFlash(scene) {
  const light = new THREE.PointLight(0xffb060, 0, 900, 1.4);
  scene.add(light);
  let k = 0, power = 0;
  return {
    light,
    at(p, strength = 1, color = 0xffb060) { light.position.copy(p); light.color.set(color); power = Math.max(power * k, 4000 * strength); k = 1; },
    update(dt) { k = Math.max(0, k - dt * 2.4); light.intensity = power * k * k; },
  };
}

// A burning wreck: fire licking along her deck and sparks streaming off as she falls (with smokeFrom's black trail)
const fireAt = new THREE.Vector3(), fireV = new THREE.Vector3();
export function burnFrom(flyer, sparks, dt) {
  if (!flyer.down) return;
  flyer.fireClock = (flyer.fireClock ?? 0) - dt;
  if (flyer.fireClock > 0) return;
  flyer.fireClock = 0.05;
  const L = flyer.ship.recipe.length;
  for (let i = 0; i < 2; i++) {
    fireAt.set((Math.random() - 0.5) * L * 0.25, 0.5 + Math.random() * L * 0.06, (Math.random() - 0.5) * L * 0.8).applyMatrix4(flyer.ship.body.matrixWorld);
    fireV.copy(flyer.velocity).multiplyScalar(0.4).add({ x: (Math.random() - 0.5) * 3, y: 4 + Math.random() * 4, z: (Math.random() - 0.5) * 3 });
    sparks(fireAt, fireV, 0.5 + Math.random() * 0.6, 2 + L * 0.12 * Math.random(), Math.random() < 0.6 ? 0xff7a2a : 0xffc04a);
  }
}
