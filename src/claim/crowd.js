// ===================================================================== THE CROWD: everyone drawn in one go
// Each person is a sprite with their own sheet of frames (people.js). Drawn as sprites, that's a draw call each: thirty
// people in the town, and as many again in the Keep. Here every sheet is copied into one atlas, and the people in a
// view are drawn as one instanced mesh of camera-facing cards: one draw for the town (and the mine), one for the Keep.
// The sprites stay as they were (everything still sets their position, frame, tint and tilt) but on a layer the
// cameras don't draw; each frame crowdDraw copies what they show into the instances. Someone without a place in the
// atlas (it holds 64) is drawn as their own sprite, as before.
const CROWD_LAYER = 3;
const CROWD = { cols: 4, rows: 0, max: 64, sw: PX.FW * PX.COLS, sh: PX.FH * PX.ROWS, slots: [], dirty: new Set(), canvas: null, tex: null, ready: false, meshes: [] };
const crowdW = () => CROWD.cols * CROWD.sw, crowdH = () => CROWD.rows * CROWD.sh;
// the atlas grows four rows (sixteen people) at a time
function crowdGrow() {
  const rows = CROWD.rows + 4, cv = document.createElement('canvas');
  cv.width = CROWD.cols * CROWD.sw; cv.height = rows * CROWD.sh;
  if (CROWD.canvas) cv.getContext('2d').drawImage(CROWD.canvas, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (CROWD.tex) CROWD.tex.dispose();
  CROWD.canvas = cv; CROWD.tex = t; CROWD.rows = rows; CROWD.ready = false;
  for (const M of CROWD.meshes) M.material.uniforms.map.value = t;
}
const CROWD_VS = `
  attribute vec4 iPos;   // x, y, z, tilt
  attribute vec4 iSize;  // width, height, centre x, centre y
  attribute vec4 iUv;    // the frame in the atlas: offset, repeat
  attribute vec3 iCol;
  varying vec2 vUv; varying vec3 vCol;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = iUv.xy + uv * iUv.zw; vCol = iCol;
    vec4 mvPosition = modelViewMatrix * vec4(iPos.xyz, 1.0);
    vec2 a = (position.xy - (iSize.zw - vec2(0.5))) * iSize.xy, c = vec2(cos(iPos.w), sin(iPos.w));
    mvPosition.xy += vec2(c.x * a.x - c.y * a.y, c.y * a.x + c.x * a.y);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const CROWD_FS = `
  uniform sampler2D map;
  varying vec2 vUv; varying vec3 vCol;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture2D(map, vUv);
    if (t.a < 0.5) discard;
    gl_FragColor = vec4(t.rgb * vCol, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
function crowdMesh(parent) {
  const N = CROWD.max, g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
  g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
  for (const [k, n] of [['iPos', 4], ['iSize', 4], ['iUv', 4], ['iCol', 3]]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(N * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); }
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]), vertexShader: CROWD_VS, fragmentShader: CROWD_FS, fog: true });
  mat.uniforms.map.value = CROWD.tex;
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
    // straight onto the card: just this sheet goes up, not the whole atlas
    if (few) { try { renderer.copyTextureToTexture(new THREE.Texture(v.canvas), CROWD.tex, null, _cv2.set(x, crowdH() - y - CROWD.sh)); } catch (e) { CROWD.tex.needsUpdate = true; } }
  }
  if (!few) CROWD.tex.needsUpdate = true;
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
      S[n * 4] = spr.scale.x; S[n * 4 + 1] = spr.scale.y; S[n * 4 + 2] = spr.center.x; S[n * 4 + 3] = spr.center.y;
      U[n * 4] = (sx + t.offset.x * CROWD.sw) / W; U[n * 4 + 1] = (H - sy - CROWD.sh + t.offset.y * CROWD.sh) / H; U[n * 4 + 2] = t.repeat.x * CROWD.sw / W; U[n * 4 + 3] = t.repeat.y * CROWD.sh / H;
      C[n * 3] = mat.color.r; C[n * 3 + 1] = mat.color.g; C[n * 3 + 2] = mat.color.b;
      n++;
    }
    g.instanceCount = n;
    for (const k of ['iPos', 'iSize', 'iUv', 'iCol']) { const a = g.attributes[k]; a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); }
  };
  fill(CROWD_T.town, v => v.sprite);
  fill(CROWD_T.keep, v => v.isprite);
  crowdUpload();
}
setupCrowd();
