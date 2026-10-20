// ===================================================================== THE CROWD: everyone drawn in one go
// Each person is a sprite with their own sheet of frames (people.js). Drawn as sprites, that's a draw call each: thirty
// people in the town, and as many again in the Keep. Here every sheet is copied into one atlas, and the people in a
// view are drawn as one instanced mesh of camera-facing cards: one draw for the town (and the mine), one for the Keep.
// The sprites stay as they were (everything still sets their position, frame, tint and tilt) but on a layer the
// cameras don't draw; each frame crowdDraw copies what they show into the instances. Someone without a place in the
// atlas (it holds 64) is drawn as their own sprite, as before.
const CROWD_LAYER = 3;
const CROWD = { cols: 4, rows: 0, max: 64, sw: PX.FW * PX.COLS, sh: PX.FH * PX.ROWS, slots: [], dirty: new Set(), canvas: null, tex: null, ncanvas: null, ntex: null, ready: false, meshes: [] };
const crowdW = () => CROWD.cols * CROWD.sw, crowdH = () => CROWD.rows * CROWD.sh;
// the atlas grows four rows (sixteen people) at a time
function crowdGrow() {
  const rows = CROWD.rows + 4, cv = document.createElement('canvas');
  cv.width = CROWD.cols * CROWD.sw; cv.height = rows * CROWD.sh;
  if (CROWD.canvas) cv.getContext('2d').drawImage(CROWD.canvas, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (CROWD.tex) CROWD.tex.dispose();
  // and the same layout for the shapes of everyone's frames (their normals: crowdNormals), read as data
  const nv = document.createElement('canvas'); nv.width = cv.width; nv.height = cv.height;
  if (CROWD.ncanvas) nv.getContext('2d').drawImage(CROWD.ncanvas, 0, 0);
  const nt = new THREE.CanvasTexture(nv); nt.colorSpace = THREE.NoColorSpace; nt.magFilter = THREE.NearestFilter; nt.minFilter = THREE.LinearMipmapLinearFilter;
  if (CROWD.ntex) CROWD.ntex.dispose();
  CROWD.canvas = cv; CROWD.tex = t; CROWD.ncanvas = nv; CROWD.ntex = nt; CROWD.rows = rows; CROWD.ready = false;
  for (const M of CROWD.meshes) { M.material.uniforms.map.value = t; M.material.uniforms.nmap.value = nt; }
}
// The HD-2D light on a pixel person: each frame's silhouette is read as a little rounded shape (its alpha, blurred, as a
// height), and its slope as a normal, so the sun can put a warm edge on the side it shines from, the lamps a glow on
// theirs, and the shade of a building fall over them. Made once for each sheet, as it's drawn.
function crowdNormals(src) {
  const w = src.width, h = src.height, A = src.getContext('2d').getImageData(0, 0, w, h).data, R = 3, n = w * h;
  const a = new Float32Array(n), t = new Float32Array(n), H = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = A[i * 4 + 3] > 127 ? 1 : 0;
  // blur within each frame (no frame bleeds into its neighbour)
  const fw = PX.FW, fh = PX.FH;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const x0 = x - x % fw; let s = 0, c = 0; for (let k = -R; k <= R; k++) { const xx = x + k; if (xx < x0 || xx >= x0 + fw) continue; s += a[y * w + xx]; c++; } t[y * w + x] = s / c; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const y0 = y - y % fh; let s = 0, c = 0; for (let k = -R; k <= R; k++) { const yy = y + k; if (yy < y0 || yy >= y0 + fh) continue; s += t[yy * w + x]; c++; } H[y * w + x] = s / c; }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d'), img = g.createImageData(w, h), D = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!a[i]) continue;
    const hx = (H[i + (x + 1 < w ? 1 : 0)] - H[i - (x > 0 ? 1 : 0)]), hy = (H[i - (y > 0 ? w : 0)] - H[i + (y + 1 < h ? w : 0)]);
    let nx = -hx * 2.2, ny = -hy * 2.2, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    D[i * 4] = (nx * 0.5 + 0.5) * 255; D[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; D[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; D[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return out;
}
const CROWD_VS = `
  attribute vec4 iPos;   // x, y, z, tilt
  attribute vec4 iSize;  // width, height, centre x, centre y
  attribute vec4 iUv;    // the frame in the atlas: offset, repeat
  attribute vec3 iCol;
  attribute vec4 iLit;   // in the sun (0..1); the nearest lit lamp's way on the screen, times how near it is; out of doors (0 or 1)
  varying vec2 vUv; varying vec3 vCol; varying vec4 vLit; varying float vFlip;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = iUv.xy + uv * iUv.zw; vCol = iCol; vLit = iLit; vFlip = iUv.z < 0.0 ? -1.0 : 1.0;
    vec4 mvPosition = modelViewMatrix * vec4(iPos.xyz, 1.0);
    vec2 a = (position.xy - (iSize.zw - vec2(0.5))) * iSize.xy, c = vec2(cos(iPos.w), sin(iPos.w));
    mvPosition.xy += vec2(c.x * a.x - c.y * a.y, c.y * a.x + c.x * a.y);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
// Lit in the picture's own terms: a soft roundness, the sun's warm edge on its side (and a deeper one when it's behind
// them), the cool of a building's shade, and lamplight on the lamp's side by night. The alpha left at 0 marks the
// people for the lens (core.js), which leaves them sharp.
const CROWD_FS = `
  uniform sampler2D map, nmap;
  uniform vec3 uSun, uSunCol, uShade;
  uniform float uLit;
  varying vec2 vUv; varying vec3 vCol; varying vec4 vLit; varying float vFlip;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture2D(map, vUv);
    if (t.a < 0.5) discard;
    vec3 n = texture2D(nmap, vUv).xyz * 2.0 - 1.0; n.x *= vFlip; n = normalize(n + vec3(0.0, 0.0, 0.001));
    float edge = pow(clamp(1.0 - n.z, 0.0, 1.0), 0.9);
    vec2 side = n.xy / max(length(n.xy), 0.001);
    vec3 col = t.rgb * vCol;
    float out_ = vLit.w, sunIn = vLit.x * uLit * out_;
    // their roundness, then the shade they stand in
    col *= mix(1.0, 0.8 + 0.3 * clamp(dot(n, uSun) * 0.5 + 0.5, 0.0, 1.0), uLit * out_);
    col *= mix(vec3(1.0), mix(uShade, vec3(1.0), vLit.x), out_);
    // the sun's edge, stronger from behind
    vec2 sd = uSun.xy / max(length(uSun.xy), 0.001);
    float rim = edge * max(dot(side, sd), 0.0) * (0.55 + 0.6 * clamp(-uSun.z, 0.0, 1.0));
    col += t.rgb * uSunCol * rim * 1.5 * sunIn + uSunCol * rim * 0.2 * sunIn;
    // the nearest lamp's glow on their lamp side
    float lk = length(vLit.yz);
    if (lk > 0.01) { float lr = edge * max(dot(side, vLit.yz / max(length(vLit.yz), 0.001)), 0.0); col += (t.rgb * 1.1 + 0.16) * vec3(1.0, 0.6, 0.26) * lr * lk; }
    gl_FragColor = vec4(col, 0.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
    gl_FragColor.a = 0.0;
  }`;
function crowdMesh(parent) {
  const N = CROWD.max, g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
  g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
  for (const [k, n] of [['iPos', 4], ['iSize', 4], ['iUv', 4], ['iCol', 3], ['iLit', 4]]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(N * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); }
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, nmap: { value: null }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0, 0, 0) }, uShade: { value: new THREE.Color(1, 1, 1) }, uLit: { value: 0 } }]), vertexShader: CROWD_VS, fragmentShader: CROWD_FS, fog: true });
  mat.uniforms.map.value = CROWD.tex; mat.uniforms.nmap.value = CROWD.ntex;
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.name = 'crowd';
  m.onAfterRender = () => { CROWD.ready = true; };   // the atlas is on the card now: changes can go up a sheet at a time
  parent.add(m); CROWD.meshes.push(m);
  return m;
}
// a place in the atlas for someone, and their sheet copied in
function crowdSlot(v) {
  if (v.crowd != null) return v.crowd;
  let i = CROWD.slots.indexOf(null); if (i < 0) i = CROWD.slots.length;
  if (i >= CROWD.max) return -1;
  if (i >= CROWD.cols * CROWD.rows) crowdGrow();
  CROWD.slots[i] = v; v.crowd = i; CROWD.dirty.add(v);
  return i;
}
function crowdFree(v) { if (v.crowd == null) return; CROWD.slots[v.crowd] = null; CROWD.dirty.delete(v); v.crowd = null; }
// their sheet changed (a new tool, a new look): copy it in again
const _crowdRedraw = Villager.prototype.redraw;
Villager.prototype.redraw = function () { _crowdRedraw.call(this); if (this.crowd != null) CROWD.dirty.add(this); };
const _cv2 = new THREE.Vector2();
function crowdUpload() {
  if (!CROWD.dirty.size) return;
  const g = CROWD.canvas.getContext('2d'), few = CROWD.ready && CROWD.dirty.size <= 4;
  for (const v of CROWD.dirty) {
    if (v.crowd == null) continue;
    const x = (v.crowd % CROWD.cols) * CROWD.sw, y = Math.floor(v.crowd / CROWD.cols) * CROWD.sh;
    g.clearRect(x, y, CROWD.sw, CROWD.sh); g.drawImage(v.canvas, x, y);
    const nc = crowdNormals(v.canvas), ng = CROWD.ncanvas.getContext('2d'); ng.clearRect(x, y, CROWD.sw, CROWD.sh); ng.drawImage(nc, x, y);
    // straight onto the card: just this sheet goes up, not the whole atlas
    if (few) { try { renderer.copyTextureToTexture(new THREE.Texture(v.canvas), CROWD.tex, null, _cv2.set(x, crowdH() - y - CROWD.sh)); renderer.copyTextureToTexture(new THREE.Texture(nc), CROWD.ntex, null, _cv2.set(x, crowdH() - y - CROWD.sh)); } catch (e) { CROWD.tex.needsUpdate = true; CROWD.ntex.needsUpdate = true; } }
  }
  if (!few) { CROWD.tex.needsUpdate = true; CROWD.ntex.needsUpdate = true; }
  CROWD.dirty.clear();
}
const CROWD_T = { town: null, keep: null };
function setupCrowd() { crowdGrow(); CROWD_T.town = crowdMesh(scene); CROWD_T.keep = crowdMesh(KSCENE); }
// every frame, before drawing: the people as their sprites show them, into the two meshes
function crowdDraw() {
  if (!CROWD_T.town) return;
  const W = crowdW(), H = crowdH();
  // people who have left the claim give their place back
  for (let i = 0; i < CROWD.slots.length; i++) { const v = CROWD.slots[i]; if (v && !GAME.villagers.includes(v)) crowdFree(v); }
  const fill = (M, pick) => {
    const g = M.geometry, P = g.attributes.iPos.array, S = g.attributes.iSize.array, U = g.attributes.iUv.array, C = g.attributes.iCol.array;
    let n = 0;
    for (const v of GAME.villagers) {
      const spr = pick(v); if (!spr) continue;
      const slot = crowdSlot(v);
      if (slot < 0) { spr.layers.set(0); continue; }   // no room in the atlas: their own sprite, as before
      if (spr.layers.mask !== 1 << CROWD_LAYER) spr.layers.set(CROWD_LAYER);
      if (!spr.visible || !spr.parent || n >= CROWD.max) continue;
      const mat = spr.material, t = mat.map || v.tex, sx = (slot % CROWD.cols) * CROWD.sw, sy = Math.floor(slot / CROWD.cols) * CROWD.sh;
      P[n * 4] = spr.position.x; P[n * 4 + 1] = spr.position.y; P[n * 4 + 2] = spr.position.z; P[n * 4 + 3] = mat.rotation || 0;
      const sk = M !== CROWD_T.town ? 1 : v.where === 'mine' ? 1 / PEOPLE_K : v.where === 'ship' ? 0.8 : 1;   // (true size in the dig's rooms; a little smaller aboard the Lark)
      S[n * 4] = spr.scale.x * sk; S[n * 4 + 1] = spr.scale.y * sk; S[n * 4 + 2] = spr.center.x; S[n * 4 + 3] = spr.center.y;
      U[n * 4] = (sx + t.offset.x * CROWD.sw) / W; U[n * 4 + 1] = (H - sy - CROWD.sh + t.offset.y * CROWD.sh) / H; U[n * 4 + 2] = t.repeat.x * CROWD.sw / W; U[n * 4 + 3] = t.repeat.y * CROWD.sh / H;
      C[n * 3] = mat.color.r; C[n * 3 + 1] = mat.color.g; C[n * 3 + 2] = mat.color.b;
      const Lt = g.attributes.iLit.array, li = M === CROWD_T.town ? crowdLight(v) : null;
      Lt[n * 4] = li ? li[0] : 1; Lt[n * 4 + 1] = li ? li[1] : 0; Lt[n * 4 + 2] = li ? li[2] : 0; Lt[n * 4 + 3] = li ? li[3] : 0;
      n++;
    }
    g.instanceCount = n;
    for (const k of ['iPos', 'iSize', 'iUv', 'iCol', 'iLit']) { const a = g.attributes[k]; a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); }
  };
  crowdSky();
  fill(CROWD_T.town, v => v.sprite);
  fill(CROWD_T.keep, v => v.isprite);
  crowdUpload();
}
// the sun's way and colour on the screen, and the shade's colour, for the town's people; indoors, none
const _cs = new THREE.Vector3(), _cl = new THREE.Vector3(), _cbox = new THREE.Box3(), _cray = new THREE.Ray(), _chit = new THREE.Vector3();
const CSUN = { boxes: [], t: 0, dir: new THREE.Vector3(0, 1, 0) };
function crowdSky() {
  const U = CROWD_T.town.material.uniforms, U2 = CROWD_T.keep.material.uniforms;
  CSUN.dir.copy(sun.position).sub(sun.target.position).normalize();
  _cs.copy(CSUN.dir).transformDirection(camera.matrixWorldInverse);
  U.uSun.value.copy(_cs);
  const day = 1 - TOD.night, k = Math.min(1.2, sun.intensity / 3) * (0.35 + 0.65 * day);
  U.uSunCol.value.copy(sun.color).multiplyScalar(k);
  U.uLit.value = CROWD.flat ? 0 : 0.35 + 0.65 * day;   // (CROWD.flat: tests compare with the old flat look)
  U.uShade.value.setRGB(lerp(1, 0.7, day), lerp(1, 0.74, day), lerp(1, 0.88, day));
  U2.uLit.value = 0; U2.uShade.value.setRGB(1, 1, 1); U2.uSunCol.value.setRGB(0, 0, 0);
  // the buildings' boxes, a few times a second, for who stands in their shade
  CSUN.t -= 1 / 60;
  if (CSUN.t <= 0) { CSUN.t = 0.5; CSUN.boxes.length = 0; for (const b of BUILDINGS) { if (!b.group || !b.group.visible || !b.group.parent) continue; const B = new THREE.Box3().setFromObject(b.group); if (!B.isEmpty()) { B.expandByScalar(-0.15); CSUN.boxes.push(B); } } }
}
// one person's light: in the sun or not (eased), and the nearest lit lamp's way across the screen
function crowdLight(v) {
  if (v.where === 'mine') return [1, 0, 0, 0];
  _cray.origin.set(v.pos.x, v.pos.y + 1.1, v.pos.z); _cray.direction.copy(CSUN.dir);
  let lit = 1;
  if (v.where !== 'ship' && v.where !== 'tower') for (const B of CSUN.boxes) if (!B.containsPoint(_cray.origin) && _cray.intersectBox(B, _chit)) { lit = 0; break; }
  v.sunLit = v.sunLit == null ? lit : v.sunLit + (lit - v.sunLit) * 0.12;
  let lx = 0, ly = 0;
  if (TOD.night > 0.2 && POWER.on) {
    let best = null, near = 7;
    for (const L of DECOR.lamps) { if (!L.lit) continue; const d = Math.hypot(L.x - v.pos.x, L.z - v.pos.z); if (d < near) { near = d; best = L; } }
    if (best) { _cl.set(best.x - v.pos.x, 1.6, best.z - v.pos.z).normalize().transformDirection(camera.matrixWorldInverse); const k = (1 - near / 7) * TOD.night * 1.1; lx = _cl.x * k; ly = _cl.y * k; }
  }
  return [v.sunLit, lx, ly, 1];
}
setupCrowd();
