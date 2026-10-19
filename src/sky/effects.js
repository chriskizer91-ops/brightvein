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
