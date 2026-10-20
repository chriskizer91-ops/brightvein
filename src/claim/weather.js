// ===================================================================== WEATHER: a sky for every day
// Each morning the day's weather arrives (yesterday's forecast) and tomorrow's is rolled. Clear, overcast, rain, fog
// or an Aether storm: each changes the sky, the light and the cloud sea by day and by night, and each changes the
// claim a little (the yards charge slower under cloud, greenhouses love rain, the towers can't see far in fog, and
// storms throw lightning). The clock at the top right shows today's weather and tomorrow's.
// Kept cheap for phones: rain is one batch of lines moved on the GPU (fewer on Light detail); lightning is one bolt
// mesh and a pulse of light; the fog bank is a dozen soft sprites.
const WEATHERS = {
  clear: { name: 'Clear', text: 'Clear skies. The yards charge at full speed.' },
  overcast: { name: 'Overcast', text: 'Cloud over the sun. The yards charge at three-quarters speed, in flat grey light.' },
  rain: { name: 'Rain', text: 'Rain. The yards charge a little over half speed, the greenhouses grow half again as fast, and people walk a little slower.' },
  fog: { name: 'Fog', text: 'A fog bank rolls over the rim. The yards charge a little slower, and at night the towers can’t see Wildlight until they’re close.' },
  storm: { name: 'Aether storm', text: 'A dark sky and lightning. A bolt near a sunning yard supercharges it; one on a building scorches it. A Lightning Rod catches bolts and turns them into shards.' },
};
const WEATHER = { today: 'clear', next: 'clear', mix: { overcast: 0, rain: 0, fog: 0, storm: 0 }, wet: 0, flash: 0, strikeT: 6, rodT: 0, rodCaught: 0, rodShards: 0 };
// the mood of each weather, by day and by night: sky (zenith, horizon), fog, clouds (lit, shade), and how much sun,
// sky light and exposure are left
const MOODS = {
  overcast: { day: { top: '#7f8997', hor: '#b6bcc2', fog: '#a2a9b0', lit: '#c4c8cc', shade: '#737a83', sun: 0.12, hemi: 1.3, exp: 0.94 },
    night: { top: '#0e1219', hor: '#1b202b', fog: '#161b25', lit: '#3c4252', shade: '#151922', sun: 0.4, hemi: 0.9, exp: 1 } },
  rain: { day: { top: '#5f6975', hor: '#8b939c', fog: '#7f8891', lit: '#a6acb3', shade: '#575d66', sun: 0.07, hemi: 1.1, exp: 0.86 },
    night: { top: '#080b12', hor: '#131824', fog: '#0f131c', lit: '#2a3040', shade: '#0d1017', sun: 0.3, hemi: 0.8, exp: 0.98 } },
  fog: { day: { top: '#c3cace', hor: '#dadedf', fog: '#d4d8da', lit: '#eceeee', shade: '#b4babe', sun: 0.5, hemi: 1.35, exp: 1.0 },
    night: { top: '#161c2a', hor: '#273040', fog: '#222a3a', lit: '#38425a', shade: '#1a2030', sun: 0.6, hemi: 1.15, exp: 1.06 } },
  storm: { day: { top: '#262338', hor: '#433e58', fog: '#38344a', lit: '#5f5a78', shade: '#221f30', sun: 0.03, hemi: 0.6, exp: 0.72 },
    night: { top: '#050409', hor: '#0d0b15', fog: '#0a0911', lit: '#1c1a28', shade: '#07060b', sun: 0.25, hemi: 0.7, exp: 0.94 } },
};
for (const m of Object.values(MOODS)) for (const p of [m.day, m.night]) for (const k of ['top', 'hor', 'fog', 'lit', 'shade']) p[k] = new THREE.Color(p[k]);
const WX_KEYS = ['overcast', 'rain', 'fog', 'storm'];

// ----------------------------------------------------------------- what the weather does to the claim
const wxCover = () => { const M = WEATHER.mix; return clamp(M.overcast + M.rain + M.storm + M.fog * 0.45, 0, 1); };
// sun on the yards (and a scorched building works slower until it's patched)
// (Nib's mirrors, once her story is done, halve what cloud and rain take: quests.js)
function wxSun(b) { const M = WEATHER.mix, k = castGift('tock', 1, 0.5); return clamp(1 - k * (0.25 * M.overcast + 0.4 * M.rain + 0.15 * M.fog + 0.4 * M.storm), 0.3, 1) * (1 - 0.5 * ((b && b.scorch) || 0)); }
function wxGrow(b) { const M = WEATHER.mix; return (1 + 0.5 * M.rain + 0.15 * M.storm - 0.08 * M.fog) * (1 - 0.5 * ((b && b.scorch) || 0)); }
const wxWalk = () => 1 - 0.15 * WEATHER.mix.rain - 0.12 * WEATHER.mix.storm;
// how far the towers see: in fog, at night, Wildlight get much closer before anyone spots them
const wxSight = () => 1 - (0.3 * WEATHER.mix.fog + 0.06 * WEATHER.mix.rain) * smooth(0.2, 0.6, TOD.night);
// a scorched turret is slower to fire
const wxScorch = b => 1 + 0.6 * ((b && b.scorch) || 0);

// ----------------------------------------------------------------- the Lightning Rod: a cheap building that catches bolts
// (Its model and numbers live here with the weather it's for; the build tray, the grid and the save treat it like any
// other building.)
DEFS.rod = { name: 'Lightning Rod', max: 1, cost: [45, 45],
  blurb: 'A tall copper rod on a stone foot, earthed into a jar of brine. In an Aether storm it draws the lightning down to itself, away from the buildings around it, and the jar turns each bolt into shards.',
  levels: ['A copper rod and a brine jar'] };
FOOT.rod = { w: 1, d: 1, ox: 0, oz: 0 };
MODEL_SIZE.rod = [2, 2];
KEEP_LIMITS.rod = [0, 1, 2, 2];
BUY.rod = 45;
BUILD_ORDER.push('rod');
LAMP_SPOTS.rod = [];
BLOCKS.rod = [[-0.8, 0.8, -0.8, 0.8]];
MODELS.rod = modelRod;
const ROD_REACH = 18;
function modelRod(b) {
  b.add(G.cyl(0.8, 0.92, 0.4, 8), MAT.dressed, 0, 0.2, 0, { ry: Math.PI / 8 });
  b.add(G.cyl(0.42, 0.56, 0.9, 8), MAT.stone, 0, 0.85, 0, { ry: Math.PI / 8 });
  b.add(G.cyl(0.08, 0.13, 8.6, 6), MAT.copper, 0, 1.3 + 4.3, 0);
  for (const y of [2.4, 4.6, 6.8]) b.add(new THREE.TorusGeometry(0.2, 0.05, 6, 14).rotateX(Math.PI / 2), MAT.brass, 0, y, 0, { cast: false });
  b.add(new THREE.ConeGeometry(0.13, 0.9, 6), MAT.copper, 0, 10.05, 0);
  b.add(new THREE.SphereGeometry(0.16, 10, 8), MAT.brass, 0, 9.4, 0, { cast: false });
  // the jar of brine at its foot, wired to the rod
  b.jarMat = MAT.crystal.clone(); b.jarMat.color.set(0x9fd8ff); b.jarMat.emissive.set(0x4aa8ff); b.jarMat.emissiveIntensity = 0.25; trackEnv(b.jarMat, 0.8);
  b.add(G.cyl(0.26, 0.26, 0.55, 12), MAT.glass, 0.62, 0.68, 0.32, { cast: false });
  b.add(G.cyl(0.2, 0.2, 0.4, 10), b.jarMat, 0.62, 0.64, 0.32, { cast: false });
  b.add(G.cyl(0.28, 0.28, 0.08, 12), MAT.brass, 0.62, 0.98, 0.32);
  beam(b, [0.62, 1.0, 0.32], [0.08, 2.4, 0], 0.035, MAT.copper, 1, { cast: false });
  b.top = new THREE.Vector3(0, 10.4, 0);
}

// ----------------------------------------------------------------- rolling the weather
function rollWeather(dayNo, nightNo) {
  if (dayNo <= 2) return 'clear';
  const w = { clear: 38, overcast: 22, rain: 17, fog: 12, storm: dayNo >= 4 ? 11 * stormSeasonK() : 0 };   // the storm season (acttwo.js)
  if (nightNo % 5 === 0) w.fog = 0;                     // no fog on a Bright Night: the boss is enough
  if (WEATHER.today !== 'clear' && WEATHER.today === WEATHER.next) w[WEATHER.today] = 0;   // nothing three days running
  const tot = Object.values(w).reduce((s, x) => s + x, 0);
  let r = Math.random() * tot; for (const [k, x] of Object.entries(w)) { r -= x; if (r <= 0) return k; }
  return 'clear';
}
// morning: yesterday's forecast arrives, and tomorrow's is rolled
function weatherDawn() {
  WEATHER.today = WEATHER.next || 'clear';
  WEATHER.next = rollWeather(GAME.day + 2, GAME.nights + 2);
  WEATHER.rodCaught = 0; WEATHER.rodShards = 0;
  if (WEATHER.today === 'rain' || WEATHER.today === 'storm') placePuddles();
  if (WEATHER.today !== 'clear' && !QUIET) setTimeout(() => toast(`<b>${WEATHERS[WEATHER.today].name} today.</b> ${esc(WEATHERS[WEATHER.today].text.split('. ').slice(1).join('. ') || WEATHERS[WEATHER.today].text)}`), 3500);
}
function forceWeather(kind, next) {
  if (!WEATHERS[kind]) return false;
  WEATHER.today = kind; if (next && WEATHERS[next]) WEATHER.next = next;
  for (const k of WX_KEYS) WEATHER.mix[k] = k === kind ? 1 : 0;
  WEATHER.wet = kind === 'rain' || kind === 'storm' ? 1 : 0;
  if (WEATHER.wet) placePuddles();
  weatherHUD(true);
  return true;
}
function weatherSave() { return { today: WEATHER.today, next: WEATHER.next }; }
function weatherLoad(save) {
  const S = save && save.weather;
  if (S && WEATHERS[S.today]) { forceWeather(S.today, WEATHERS[S.next] ? S.next : 'clear'); }
  else { WEATHER.today = 'clear'; WEATHER.next = save ? rollWeather((save.day || 1) + 1, (save.nights || 0) + 2) : 'clear'; forceWeather('clear'); }
}

// ----------------------------------------------------------------- every tick of game time: blend, strike, mend
function weatherTick(dt) {
  const M = WEATHER.mix, k = Math.min(1, dt / 20);
  for (const key of WX_KEYS) M[key] = lerp(M[key], WEATHER.today === key ? 1 : 0, k);
  const rainy = M.rain + M.storm;
  WEATHER.wet = rainy > WEATHER.wet ? Math.min(rainy, WEATHER.wet + dt / 15) : Math.max(rainy, WEATHER.wet - dt / 70);
  // lightning
  if (M.storm > 0.6) { WEATHER.strikeT -= dt; if (WEATHER.strikeT <= 0) { WEATHER.strikeT = 4 + Math.random() * 8; lightningStrike(); } }
  WEATHER.rodT -= dt;
  // scorched buildings are patched by day (faster with cutters at the Lens Workshop); supercharged yards cool
  const cutters = byType('shop').some(s => workersOf(s.id).some(v => v.working));
  for (const b of Object.values(TOWN.b)) {
    if (b.scorch > 0 && TOD.phase !== 'night') { b.scorch = Math.max(0, b.scorch - dt / (cutters ? 35 : 100)); }
    if (b.superT > 0) b.superT -= dt;
    if (b.jarK > 0) b.jarK = Math.max(0, b.jarK - dt * 0.5);
  }
}

// ----------------------------------------------------------------- lightning
const BOLT = { mesh: null, glow: null, t: 1, dur: 0.34, from: new THREE.Vector3(), to: new THREE.Vector3() };
const BOLT_SEG = 64;
function boltMeshes() {
  if (BOLT.mesh) return;
  const g = new THREE.BufferGeometry(), n = BOLT_SEG * 4;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(n), 1));
  const idx = []; for (let i = 0; i < BOLT_SEG; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3000);
  const mk = (w, col, a) => new THREE.ShaderMaterial({
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: w }, uCol: { value: new THREE.Color(col) }, uAlpha: { value: a } },
    vertexShader: `uniform vec2 uRes; uniform float uWidth; attribute vec3 aDir; attribute float aSide; varying float vSide;
      void main(){ vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vec4 n = projectionMatrix * modelViewMatrix * vec4(position + aDir, 1.0);
        vec2 h = uRes * 0.5, sc = c.xy / c.w * h, sn = n.xy / n.w * h; vec2 d = sn - sc; d = length(d) < 1e-4 ? vec2(0.0, 1.0) : normalize(d);
        sc += vec2(-d.y, d.x) * aSide * uWidth; gl_Position = vec4(sc / h * c.w, c.z, c.w); vSide = aSide; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uAlpha; varying float vSide; void main(){ float e = 1.0 - abs(vSide); gl_FragColor = vec4(uCol * (0.7 + 0.8 * e), uAlpha * smoothstep(0.0, 0.9, e)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
  });
  BOLT.mesh = new THREE.Mesh(g, mk(2.6, 0xf4f6ff, 1)); BOLT.glow = new THREE.Mesh(g, mk(14, 0x8fb2ff, 0.5));
  BOLT.mesh.material.uniforms.uCol.value.multiplyScalar(2.2); BOLT.glow.material.uniforms.uCol.value.multiplyScalar(1.6);
  for (const m of [BOLT.mesh, BOLT.glow]) { m.frustumCulled = false; m.renderOrder = 7; m.visible = false; scene.add(m); }
}
// a jagged channel from the cloud to the strike, with a fork or two
function shapeBolt(from, to) {
  boltMeshes();
  const g = BOLT.mesh.geometry, P = g.attributes.position.array, Dv = g.attributes.aDir.array, S = g.attributes.aSide.array;
  let seg = 0;
  const put = (a, b) => {
    if (seg >= BOLT_SEG) return; const d = [b.x - a.x, b.y - a.y, b.z - a.z];
    for (let k = 0; k < 4; k++) { const p = k < 2 ? a : b, i = seg * 4 + k; P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; Dv[i * 3] = d[0]; Dv[i * 3 + 1] = d[1]; Dv[i * 3 + 2] = d[2]; S[i] = k % 2 ? 1 : -1; }
    seg++;
  };
  const chain = (a, b, n, jag) => {
    const pts = [a.clone()];
    for (let i = 1; i < n; i++) { const t = i / n, p = a.clone().lerp(b, t); const j = jag * Math.sin(t * Math.PI); p.x += (Math.random() - 0.5) * j; p.z += (Math.random() - 0.5) * j; p.y += (Math.random() - 0.5) * j * 0.3; pts.push(p); }
    pts.push(b.clone());
    for (let i = 0; i < pts.length - 1; i++) put(pts[i], pts[i + 1]);
    return pts;
  };
  const len = from.distanceTo(to), main = chain(from, to, 22, Math.min(26, len * 0.16));
  for (let f = 0; f < 3; f++) {
    const at = main[4 + ((Math.random() * 12) | 0)], end = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * len * 0.3, -len * (0.1 + Math.random() * 0.15), (Math.random() - 0.5) * len * 0.3));
    chain(at, end, 6, len * 0.05);
  }
  for (let i = seg; i < BOLT_SEG; i++) for (let k = 0; k < 4; k++) { const q = i * 4 + k; P[q * 3] = P[q * 3 + 1] = P[q * 3 + 2] = 0; Dv[q * 3] = Dv[q * 3 + 1] = Dv[q * 3 + 2] = 0; }
  g.attributes.position.needsUpdate = true; g.attributes.aDir.needsUpdate = true; g.attributes.aSide.needsUpdate = true;
  BOLT.t = 0; BOLT.mesh.visible = BOLT.glow.visible = true;
}
// a strike: far off over the peaks, or on the claim. A rod takes any bolt that falls in its reach.
function lightningStrike(at = null, o = {}) {
  let p, kind = 'far', target = null;
  if (at) { p = at.clone(); kind = 'ground'; let rd = ROD_REACH; for (const b of byType('rod')) { if (b.building || !b.level) continue; const d = Math.hypot(b.L.x - p.x, b.L.z - p.z); if (d < rd) { rd = d; target = b; kind = 'rod'; } } if (target) p = target.worldPos(0, 10.4, 0); }
  else if (!o.near && Math.random() < 0.45) {
    const a = Math.random() * TAU, r = 150 + Math.random() * 300;
    p = new THREE.Vector3(Math.cos(a) * r, -40, Math.sin(a) * r);
  } else {
    const r = Math.random(), live = WL.night ? WL.list.filter(f => !f.dead && !f.air && f.pos.y > -1) : [];
    const blds = Object.values(TOWN.b).filter(b => !b.pending && b.tile && b.type !== 'rod' && b.level);
    if (live.length && r < 0.3) { target = live[(Math.random() * live.length) | 0]; p = target.pos.clone(); kind = 'wild'; }
    else if (blds.length && r < 0.62) { target = blds[(Math.random() * blds.length) | 0]; p = new THREE.Vector3(target.L.x + (Math.random() - 0.5) * 3, 0, target.L.z + (Math.random() - 0.5) * 3); kind = 'building'; }
    else { for (let i = 0; i < 30; i++) { const x = (Math.random() - 0.5) * 84, z = -36 + Math.random() * 68; if (onPlateau(x, z)) { p = new THREE.Vector3(x, 0, z); break; } } if (!p) p = new THREE.Vector3(0, 0, 0); kind = 'ground'; }
    // the rods: anything inside their reach comes down on them instead
    let rb = null, rd = ROD_REACH; for (const b of byType('rod')) { if (b.building || !b.level) continue; const d = Math.hypot(b.L.x - p.x, b.L.z - p.z); if (d < rd) { rd = d; rb = b; } }
    if (!rb && byType('rod').length && Math.random() < 0.3) rb = byType('rod').find(b => !b.building && b.level);   // a tall rod draws them from further off, too
    if (rb) { target = rb; kind = 'rod'; p = rb.worldPos(0, 10.4, 0); }
  }
  const from = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40)); from.y = 150;
  shapeBolt(from, p);
  const near = Math.hypot(p.x - controls.target.x, p.z - controls.target.z);
  WEATHER.flash = kind === 'far' ? 0.55 : 1;
  if (kind !== 'far') muzzleFlash(p.clone().setY(p.y + 0.5), 0xd8e6ff, 16);
  if (kind !== 'far') { AUDIO.play('boltstrike', p); if (near < 45) camShake(0.3); }
  if (!QUIET) setTimeout(() => AUDIO.play('thunder', p), kind === 'far' ? 900 + Math.random() * 1500 : 120);
  const N = WL.night; if (N) N.strikes++;
  // what it hits
  if (kind === 'rod') {
    const gain = Math.round(12 + Math.random() * 10);
    GAME.shards += gain; target.jarK = 1; target.caught = (target.caught || 0) + 1; WEATHER.rodCaught++; WEATHER.rodShards += gain;
    FX.sparks(p, 30, 0xbfe0ff, 5); FX.sparks(target.worldPos(0.62, 1, 0.32), 14, 0x9fd8ff, 2);
    if (WEATHER.rodT <= 0) { WEATHER.rodT = 30; toast(`The lightning rod caught a bolt: <b>+${gain} shards</b>${WEATHER.rodCaught > 1 ? ` (${WEATHER.rodCaught} today, ${SHARD} ${WEATHER.rodShards})` : ''}.`); }
  } else if (kind === 'wild') {
    for (const f of WL.list) if (!f.dead && !f.air && Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < 4.5) f.hurt(f.boss ? 120 : 70, 'storm');
    FX.sparks(p.clone().setY(1), 36, 0xcfe0ff, 6);
  } else if (kind === 'building') {
    const b = target;
    if (b.type === 'yard' && TOD.night < 0.5) {
      // the trays drink the bolt: a burst of charge
      const gain = Math.round(18 + Math.random() * 12);
      GAME.shards += gain; b.superT = 14;
      for (let i = 0; i < 30; i++) FX.mote(b.worldPos((Math.random() - 0.5) * 10, 0.8 + Math.random(), (Math.random() - 0.5) * 6), 0xffe0a0);
      FX.sparks(p.clone().setY(0.6), 30, 0xffe8b0, 5);
      toast(`Lightning struck <b>${esc(b.name)}</b> and supercharged its trays: <b>+${gain} shards</b>.`);
    } else {
      const cost = Math.min(6, Math.floor(GAME.shards));
      GAME.shards -= cost; b.scorch = 1;
      FX.sparks(p.clone().setY(2), 30, 0xffd8a0, 5); FX.puff(p.clone().setY(2), 8, 0x3a3434, 1.2);
      toast(`Lightning scorched <b>${esc(b.name)}</b>. It works slower until it’s patched (${SHARD} ${cost}).`, 'night');
    }
  } else if (kind === 'ground') { FX.sparks(p.clone().setY(0.3), 20, 0xcfe0ff, 4); FX.puff(p.clone().setY(0.3), 6, 0x6a6058, 1); }
  return { kind, p, target };
}

// ----------------------------------------------------------------- the look: sky and light (after applyTimeOfDay)
const _wc = new THREE.Color(), _wd = new THREE.Color(), _wf = new THREE.Color();
function weatherMood(t, time) {
  const M = WEATHER.mix, nk = TOD.night, cover = wxCover();
  let sunK = 1, hemiK = 1, expK = 1;
  for (const key of WX_KEYS) {
    const w = M[key]; if (w < 0.002) continue;
    const A = MOODS[key].day, B = MOODS[key].night, mix = c => _wc.copy(A[c]).lerp(_wd.copy(B[c]), nk);
    skyU.uTop.value.lerp(mix('top'), w * 0.92);
    skyU.uHor.value.lerp(mix('hor'), w * 0.85);
    scene.fog.color.lerp(mix('fog'), w * 0.9);
    cloudU.uLit.value.lerp(mix('lit'), w * 0.85);
    cloudU.uShade.value.lerp(mix('shade'), w * 0.85);
    cloudU.uFog.value.lerp(mix('fog'), w * 0.9);
    sunK *= lerp(1, lerp(A.sun, B.sun, nk), w); hemiK *= lerp(1, lerp(A.hemi, B.hemi, nk), w); expK *= lerp(1, lerp(A.exp, B.exp, nk), w);
  }
  sun.intensity *= sunK; hemi.intensity *= hemiK; renderer.toneMappingExposure *= expK;
  const amb = clamp(M.overcast + M.rain + M.storm + M.fog * 0.6, 0, 1);
  if (amb > 0.002) { hemi.color.lerp(_wc.copy(skyU.uHor.value).multiplyScalar(1.15), amb * 0.55); hemi.groundColor.lerp(_wc.copy(scene.fog.color).multiplyScalar(0.55), amb * 0.4); sun.color.lerp(_wc.setRGB(0.85, 0.87, 0.92), amb * 0.6); }
  // clouds over the sun and stars
  skyU.uSunCol.value.multiplyScalar(1 - cover * 0.88);
  skyU.uNight.value *= 1 - cover * 0.93;
  if (worldMats.cloudFloor) worldMats.cloudFloor.color.lerp(_wf.copy(scene.fog.color).multiplyScalar(0.85), cover * 0.8);
  if (worldMats.puff) worldMats.puff.color.lerp(_wf.copy(scene.fog.color), M.fog * 0.7 + cover * 0.5);   // a grey day's cloud sea is grey
  // cloud shadows drifting over the lawn, and a little less colour in the grade (world.js, main.js)
  LOOK_CLOUDS.uK.value = (0.3 * M.overcast + 0.16 * M.rain + 0.12 * M.storm) * (1 - nk); LOOK_CLOUDS.uT.value = time;
  WEATHER.desat = clamp(0.3 * M.overcast + 0.22 * M.rain + 0.18 * M.storm + 0.25 * M.fog, 0, 0.35);
  // fog closes in; rain greys out the far peaks. A fog bank is measured from the claim rather than the camera, so
  // the claim stays readable however far out you look from, and the rim and the cliffs fade into it
  const rainy = clamp(M.rain + M.storm, 0, 1), cd = camera.position.distanceTo(controls.target);
  scene.fog.near = lerp(lerp(220, 120, rainy * 0.6 + M.overcast * 0.2), Math.max(18, cd - 15), M.fog);
  scene.fog.far = lerp(lerp(1250, 620, rainy * 0.7 + M.overcast * 0.25), cd + 140, M.fog);
  // a lightning flash lights everything for a moment
  const F = WEATHER.flash;
  if (F > 0.01) {
    const fl = F * (0.65 + 0.35 * Math.sin(time * 70));
    hemi.intensity += fl * 2.6; renderer.toneMappingExposure += fl * 0.22;
    skyU.uTop.value.r += fl * 0.35; skyU.uTop.value.g += fl * 0.4; skyU.uTop.value.b += fl * 0.6;
    skyU.uHor.value.r += fl * 0.3; skyU.uHor.value.g += fl * 0.34; skyU.uHor.value.b += fl * 0.5;
    cloudU.uLit.value.r += fl * 0.4; cloudU.uLit.value.g += fl * 0.45; cloudU.uLit.value.b += fl * 0.6;
  }
  if (DECK.u) { DECK.u.uCover.value = cover; DECK.u.uLit.value.copy(cloudU.uLit.value); DECK.u.uShade.value.copy(cloudU.uShade.value); DECK.u.uHor.value.copy(skyU.uHor.value); DECK.u.uTime.value = time; DECK.u.uFlash.value = F; DECK.u.uStorm.value = M.storm; }
}

// ----------------------------------------------------------------- the look: rain, the cloud deck, fog, puddles
const RAIN = { lines: null, max: 6000 };
function buildRain() {
  const N = RAIN.max, pos = new Float32Array(N * 2 * 3), drop = new Float32Array(N * 2 * 4), end = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const a = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 2; k++) { drop.set(a, (i * 2 + k) * 4); end[i * 2 + k] = k; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aDrop', new THREE.BufferAttribute(drop, 4)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: 110 }, uH: { value: 48 }, uSpeed: { value: 24 }, uWind: { value: new THREE.Vector2(3, 1.2) }, uCol: { value: new THREE.Color(0xc8d2de) }, uAlpha: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `uniform float uTime, uBox, uH, uSpeed; uniform vec3 uCenter, uCam; uniform vec2 uWind; attribute vec4 aDrop; attribute float aEnd; varying float vA;
      void main(){
        float y = fract(aDrop.z - uTime * uSpeed / uH * (0.85 + aDrop.w * 0.3)) * uH;
        vec3 p = vec3(uCenter.x + (aDrop.x - 0.5) * uBox, uCenter.y - 3.0 + y, uCenter.z + (aDrop.y - 0.5) * uBox);
        p.xz += uWind * (y / uH - 0.5) * 4.0;
        float len = 0.8 + aDrop.w * 0.9;
        p.y += aEnd * len; p.xz -= uWind * aEnd * len * 0.12;
        vA = (1.0 - aEnd * 0.75) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(p.xz - uCenter.xz)));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(uCol, uAlpha * vA); }`,
    transparent: true, depthWrite: false,
  });
  const L = new THREE.LineSegments(g, m); L.frustumCulled = false; L.renderOrder = 8; L.visible = false; scene.add(L);
  RAIN.lines = L;
}
// a high deck of cloud over everything on grey days
const DECK = { mesh: null, u: null };
function buildDeck() {
  DECK.u = { uCover: { value: 0 }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uTime: { value: 0 }, uFlash: { value: 0 }, uStorm: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: DECK.u, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uCover, uTime, uFlash, uStorm; uniform vec3 uLit, uShade, uHor; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
      void main(){
        vec2 p = vW.xz / 170.0 + vec2(uTime * 0.006, uTime * 0.002);
        float c = fbm(p), c2 = fbm(p * 2.7 - uTime * 0.004);
        float dens = smoothstep(0.62 - uCover * 0.55, 0.9 - uCover * 0.35, c * 0.75 + c2 * 0.35);
        vec3 col = mix(uShade, uLit, clamp(c2 * 1.2 - 0.1, 0.0, 1.0));
        col += vec3(0.55, 0.6, 0.8) * uFlash * (0.5 + c2) * (0.4 + uStorm * 0.6);
        float d = length(vW.xz - cameraPosition.xz);
        col = mix(col, uHor, smoothstep(250.0, 1000.0, d) * 0.85);
        gl_FragColor = vec4(col, dens * uCover * (1.0 - smoothstep(700.0, 1150.0, d)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat); m.rotation.x = -Math.PI / 2; m.position.y = 135; m.renderOrder = -6; m.frustumCulled = false; m.visible = false; scene.add(m);
  DECK.mesh = m;
}
// the fog bank: soft sprites that roll in over the rim and sit low on the plateau
const FOGBANK = { list: [] };
function buildFogBank() {
  const map = worldMats.puff ? worldMats.puff.map : wlGlowTex;
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    const a = i / 14 * TAU + Math.random() * 0.3, r = 14 + Math.random() * 30;
    s.userData = { a, r, y: 1.2 + Math.random() * 4.5, sp: (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.006) };
    s.scale.set(38 + Math.random() * 20, 9 + Math.random() * 5, 1); s.renderOrder = 3; s.visible = false;
    scene.add(s); FOGBANK.list.push(s);
  }
}
// puddles on the lawn: dark, glossy patches that catch the sky and the lamps
const PUDDLES = { mesh: null, n: 30 };
function buildPuddles() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), R = mulberry(77);
  for (let i = 0; i < 9; i++) { const x = 34 + R() * 60, y = 34 + R() * 60, r = 14 + R() * 22, gr = g.createRadialGradient(x, y, r * 0.5, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  const mat = trackEnv(new THREE.MeshStandardMaterial({ color: 0x2e3540, roughness: 0.04, metalness: 0.6, transparent: true, opacity: 0, alphaMap: canvasTex(c, { srgb: false }), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 1.6);
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat, PUDDLES.n);
  m.renderOrder = 1; m.frustumCulled = false; m.receiveShadow = true; scene.add(m); PUDDLES.mesh = m;
  placePuddles();
}
function placePuddles() {
  const m = PUDDLES.mesh; if (!m) return;
  const occ = occupied(null);
  for (let i = 0; i < PUDDLES.n; i++) {
    let x = 0, z = 0, ok = false;
    for (let k = 0; k < 40 && !ok; k++) {
      x = GRID.X0 + Math.random() * GRID.NX * GRID.T; z = GRID.Z0 + Math.random() * GRID.NZ * GRID.T;
      const tx = Math.floor((x - GRID.X0) / GRID.T), tz = Math.floor((z - GRID.Z0) / GRID.T);
      ok = tileOkAt(x, z) && !occ.has(tz * GRID.NX + tx) && !occ.has(tz * GRID.NX + tx + 1) && !occ.has((tz + 1) * GRID.NX + tx);
    }
    _wm.compose(_wp.set(x, 0.04, z), _wq.setFromEuler(_we.set(0, Math.random() * TAU, 0)), _ws.set(ok ? 0.9 + Math.random() * 1.6 : 0, 1, ok ? 0.6 + Math.random() * 1.0 : 0));
    m.setMatrixAt(i, _wm);
  }
  m.instanceMatrix.needsUpdate = true;
}
const RAIN_N = { light: 1400, balanced: 3200, high: 6000 };
const SCORCH_H = { keep: 11, shop: 7, garden: 4, yard: 1.5, lens: 8, ballista: 2, mast: 12, rod: 9 };
let wxSmokeT = 0, wxHudT = 0;
function weatherDraw(rdt) {
  if (!RAIN.lines) { buildRain(); buildDeck(); buildFogBank(); buildPuddles(); }
  const M = WEATHER.mix, nk = TOD.night, rainy = clamp(M.rain + M.storm * 0.9, 0, 1), inK = VIEW.mode === 'keep';
  // rain: lines falling round wherever the camera is looking
  const L = RAIN.lines, u = L.material.uniforms;
  L.visible = rainy > 0.02 && !inK;
  if (L.visible) {
    u.uTime.value += rdt * (GAME.paused ? 0.15 : 1);
    u.uCenter.value.set(controls.target.x, Math.max(0, controls.target.y), controls.target.z);
    u.uAlpha.value = rainy * lerp(0.42, 0.3, nk);
    u.uCol.value.setRGB(lerp(0.8, 0.5, nk), lerp(0.85, 0.58, nk), lerp(0.9, 0.78, nk));
    u.uSpeed.value = 22 + M.storm * 10; u.uWind.value.set(2.5 + M.storm * 5, 1 + M.storm * 2);
    L.geometry.setDrawRange(0, Math.round((RAIN_N[QUALITY.level] || 3200) * clamp(rainy * 1.2, 0, 1)) * 2);
  }
  AUDIO.rain && AUDIO.rain(inK ? rainy * 0.35 : rainy);
  // the cloud deck
  if (DECK.mesh) DECK.mesh.visible = wxCover() > 0.02 && !inK;
  // the fog bank rolls in from beyond the rim
  const fk = M.fog;
  for (const s of FOGBANK.list) {
    s.visible = fk > 0.02 && !inK;
    if (!s.visible) continue;
    const U = s.userData; U.a += rdt * U.sp;
    const r = lerp(75, U.r, smooth(0, 0.8, fk));
    s.position.set(Math.cos(U.a) * r, U.y, Math.sin(U.a) * r * 0.85 + 2);
    s.material.color.copy(scene.fog.color).multiplyScalar(lerp(1.05, 1.4, nk));
    s.material.opacity = fk * lerp(0.5, 0.42, nk);
  }
  // (the cloud puffs round the cliffs rise toward the rim in fog: their lift is set with their drift, in main.js)
  // wet ground: darker and glossier, with puddles
  const wet = WEATHER.wet;
  if (worldMats.ground) { worldMats.ground.roughness = lerp(0.96, 0.6, wet); worldMats.ground.color.setScalar(lerp(1, 0.8, wet)); }
  if (worldMats.cliff) worldMats.cliff.color.setScalar(lerp(1, 0.78, wet));
  if (PUDDLES.mesh) { PUDDLES.mesh.visible = wet > 0.02 && !inK; PUDDLES.mesh.material.opacity = wet * lerp(0.85, 0.4, nk); PUDDLES.mesh.material.color.setHex(nk > 0.5 ? 0x4a5466 : 0x2e3540); }
  // the bolt flickers and fades; the flash with it
  if (BOLT.mesh && BOLT.mesh.visible) {
    BOLT.t += rdt; const k = BOLT.t / BOLT.dur, fl = k < 1 ? (1 - k) * (0.55 + 0.45 * Math.sin(BOLT.t * 90)) : 0;
    for (const m of [BOLT.mesh, BOLT.glow]) { m.material.uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height); m.material.uniforms.uAlpha.value = fl * (m === BOLT.glow ? 0.5 : 1); }
    BOLT.mesh.material.uniforms.uWidth.value = 2.6 * renderer.getPixelRatio(); BOLT.glow.material.uniforms.uWidth.value = 14 * renderer.getPixelRatio();
    if (k >= 1) BOLT.mesh.visible = BOLT.glow.visible = false;
  }
  WEATHER.flash = Math.max(0, WEATHER.flash - rdt * 2.6);
  // scorched buildings smoke; supercharged yards fizz; a rod's jar glows after a catch
  if ((wxSmokeT -= rdt) <= 0) {
    wxSmokeT = 0.25;
    for (const b of Object.values(TOWN.b)) {
      if (b.scorch > 0.05 && Math.random() < 0.4 + b.scorch * 0.6) FX.smoke(b.worldPos((Math.random() - 0.5) * 2, SCORCH_H[b.type] || 4, (Math.random() - 0.5) * 2), 0x2e2a2a);
      if (b.superT > 0) for (let i = 0; i < 3; i++) FX.mote(b.worldPos((Math.random() - 0.5) * 10, 0.8, (Math.random() - 0.5) * 6), 0xffe0a0);
    }
  }
  for (const b of byType('rod')) if (b.jarMat) b.jarMat.emissiveIntensity = 0.25 + (b.jarK || 0) * 3 + M.storm * 0.4 * (0.6 + 0.4 * Math.sin(elapsed * 3));
  if ((wxHudT -= rdt) <= 0) { wxHudT = 0.5; weatherHUD(); }
}

// ----------------------------------------------------------------- the clock: today's weather, and tomorrow's
const WX_ICON = {
  clear: '<circle cx="10" cy="10" r="4.2" fill="#ffcf5a" stroke="#7a4a10" stroke-width="1.2"/><g stroke="#ffcf5a" stroke-width="1.6" stroke-linecap="round"><path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5"/></g>',
  overcast: '<path d="M5.5 15.5h9.5a3.3 3.3 0 0 0 .4-6.6 4.6 4.6 0 0 0-8.8-.8A3.7 3.7 0 0 0 5.5 15.5z" fill="#c9ced6" stroke="#3a3f4a" stroke-width="1.2"/>',
  rain: '<path d="M5.5 12h9.5a3 3 0 0 0 .3-6 4.2 4.2 0 0 0-8-.7A3.4 3.4 0 0 0 5.5 12z" fill="#a9b1bd" stroke="#2f3440" stroke-width="1.2"/><g stroke="#8ec4ff" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 14.2l-1 2.6M10 14.2l-1 2.6M13.5 14.2l-1 2.6"/></g>',
  fog: '<g stroke="#d8dde2" stroke-width="1.7" stroke-linecap="round"><path d="M3 6.5h14M2 10h13M5 13.5h13M3.5 17h11"/></g>',
  storm: '<path d="M5.5 11.5h9.5a3 3 0 0 0 .3-6 4.2 4.2 0 0 0-8-.7A3.4 3.4 0 0 0 5.5 11.5z" fill="#6d6880" stroke="#1e1c28" stroke-width="1.2"/><path d="M10.5 11 8 15.2h2.6L9 19l4.4-5.4h-2.6L12.5 11z" fill="#ffe27a" stroke="#6a4a10" stroke-width=".8"/>',
};
const wxSvg = k => `<svg viewBox="0 0 20 20" class="wxi" aria-hidden="true">${WX_ICON[k] || WX_ICON.clear}</svg>`;
let wxHudKey = '';
function weatherHUD(force) {
  const clock = $('#clock'); if (!clock) return;
  let el = document.getElementById('wx');
  if (!el) {
    el = document.createElement('div'); el.id = 'wx'; el.className = 'wx'; clock.append(el);
    clock.setAttribute('role', 'button'); clock.tabIndex = 0; clock.title = 'Weather and nights';
    clock.addEventListener('click', () => UI.cur && UI.cur.kind === 'weather' ? UI.close() : UI.open('weather'));
    clock.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); UI.open('weather'); } });
  }
  const key = WEATHER.today + '|' + WEATHER.next;
  if (key === wxHudKey && !force) return; wxHudKey = key;
  el.innerHTML = `<span class="wx-now">${wxSvg(WEATHER.today)}<b>${esc(WEATHERS[WEATHER.today].name)}</b></span><span class="wx-next"><em>then</em>${wxSvg(WEATHER.next)}<span>${esc(WEATHERS[WEATHER.next].name)}</span></span>`;
  el.setAttribute('aria-label', `Today: ${WEATHERS[WEATHER.today].name}. Tomorrow: ${WEATHERS[WEATHER.next].name}.`);
}
// the panel behind the clock: the weather, the nights to come, and last night's report
UI.weather = function (body) {
  const T = WEATHERS[WEATHER.today], X = WEATHERS[WEATHER.next];
  body.append(this.h(`<h2>Weather and nights</h2><p class="sub">Day ${GAME.day} · ${esc(PHASE_NAMES(GAME.t))}</p>`));
  body.append(this.h(`<div class="wx-row">${wxSvg(WEATHER.today)}<div><b>Today: ${esc(T.name)}</b><p>${esc(T.text)}</p></div></div>`));
  body.append(this.h(`<div class="wx-row">${wxSvg(WEATHER.next)}<div><b>Tomorrow: ${esc(X.name)}</b><p>${esc(X.text)}</p></div></div>`));
  const n = GAME.nights + (WL.night ? 0 : 1), bright = Math.ceil(n / 5) * 5;
  const lines = [`${WL.night ? 'Tonight is' : 'Tonight will be'} night ${n}${WL.night && WL.night.title ? ': ' + esc(WL.night.title) : ''}.`];
  lines.push(bright === n ? '<b>Tonight is a Bright Night.</b> A boss climbs with the last wave.' : `The next Bright Night is night ${bright}, in ${bright - n} night${bright - n > 1 ? 's' : ''}.`);
  if (NIGHT.grudge) lines.push(`${esc(NIGHT.grudge.name)} got away. It will be back.`);
  const open = WALL.segs.filter(s => s.broken).length, hurt = WALL.segs.filter(s => s.hp < 1).length;
  if (hurt) lines.push(`The wall has ${hurt} damaged section${hurt > 1 ? 's' : ''}${open ? `, ${open} broken through` : ''}. ${workersOf('wall').length ? 'The watch mends it by day.' : 'Put someone on the watch to mend it.'}`);
  if (byType('rod').length) { const n = byType('rod').reduce((s, b) => s + (b.caught || 0), 0); lines.push(`Lightning rods: ${n} bolt${n === 1 ? '' : 's'} caught so far.`); }
  body.append(this.h(`<h3>Nights</h3><ul class="traits">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`));
  if (NIGHT.last) {
    const R = NIGHT.last;
    body.append(this.h(`<h3>Last night</h3><p>${esc(R.head)} ${esc(R.credit || '')}</p>`));
    const b = this.h(`<p><button type="button" class="btn">The dawn report</button></p>`); b.querySelector('button').onclick = () => { UI.close(); showDawn(NIGHT.last, true); }; body.append(b);
  }
};
