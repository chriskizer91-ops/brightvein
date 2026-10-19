// pickups.js: Crystal Shards, Aethermoor's money. A raider brought down spills its shards, glowing amber, and they
// drift down slowly; fly close and they're drawn to your ship. Left too long, they fall away into the clouds.
import * as THREE from 'three';

const MAX = 200, LIFE = 30, PULL = 140, PULL_SPEED = 120;
export function makePickups(scene) {
  const geo = new THREE.OctahedronGeometry(1, 0).scale(0.55, 1.2, 0.55);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffc061, emissive: 0xff8a1e, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.1, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false;
  scene.add(mesh);
  // a soft glow round each, so they can be seen from far off
  const gpos = new Float32Array(MAX * 3), ggeo = new THREE.BufferGeometry();
  ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3).setUsage(THREE.DynamicDrawUsage));
  const gmat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'uniform float uScale; uniform float uTime; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float k = 0.85 + 0.15 * sin(uTime * 5.0 + position.x); gl_PointSize = min(9.0 * k * uScale / -mv.z, 200.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.0) * 0.8; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.68, 0.25) * a, a); }',
  });
  const glows = new THREE.Points(ggeo, gmat); glows.frustumCulled = false; glows.renderOrder = 3; scene.add(glows);

  const list = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), to = new THREE.Vector3();
  let time = 0;
  // `total` shards, spilled from p as a handful of pieces
  function spill(p, vel, total) {
    const n = Math.max(4, Math.min(14, Math.round(total / 10)));
    for (let i = 0; i < n && list.length < MAX; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(8 + Math.random() * 14).addScaledVector(vel, 0.3);
      list.push({ p: p.clone(), v, value: total / n, life: LIFE, spin: Math.random() * 6, pulled: false });
    }
  }
  // move them; returns the shards the ship picked up this frame
  function update(dt, ship, reach, camera) {
    time += dt;
    let got = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.life -= dt; s.spin += dt * 2.5;
      to.copy(ship).sub(s.p);
      const d = to.length();
      if (d < reach) { got += s.value; list.splice(i, 1); continue; }
      if (d < PULL || s.pulled) {
        s.pulled = true;
        s.v.lerp(to.multiplyScalar(PULL_SPEED / Math.max(d, 1)), 1 - Math.exp(-dt * 4));
      } else {
        s.v.multiplyScalar(Math.exp(-dt * 0.8)); s.v.y += (-4 - s.v.y) * (1 - Math.exp(-dt * 0.8));
      }
      s.p.addScaledVector(s.v, dt);
      if (s.life <= 0 && !s.pulled) list.splice(i, 1);
    }
    list.forEach((s, i) => {
      const k = Math.min(1, s.life / 3);
      q.setFromEuler(e.set(0.3, s.spin, 0)); m4.compose(s.p, q, one.setScalar(0.4 + 0.6 * Math.max(0, k)));
      mesh.setMatrixAt(i, m4); gpos.set([s.p.x, s.p.y, s.p.z], i * 3);
    });
    mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true;
    ggeo.setDrawRange(0, list.length); ggeo.attributes.position.needsUpdate = true;
    gmat.uniforms.uTime.value = time;
    if (camera) gmat.uniforms.uScale.value = camera.userData.pixelScale ?? 500;
    return got;
  }
  const clear = () => { list.length = 0; update(0, new THREE.Vector3(), 0); };
  return { spill, update, clear, list };
}
