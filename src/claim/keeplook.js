// ===================================================================== THE KEEP'S LOOK: the cutaway, room by room
// Everything you see inside the Keep (its rules are in keep.js, the people in it in keeplife.js). The front wall is
// cut away: the Hearth Hall and the Dormitory on the ground floor, a study (or an empty room) either side of the
// stairwell on each floor above, and the attic under the roof, where the overflow sleep. A switchback stair climbs
// the middle; a ladder goes up to the attic. Every room is dressed by its kind and its level (the fixed rooms and the
// attic by the Keep's level), with windows that show the sky outside and let the day in.
// Kept fast for phones: every static piece is baked into a few big meshes (one per material, vertex colours for the
// tints), and lamplight is faked in the shaders: each lamp, fire and window lends a light to a short list the
// materials read, so there are no extra real lights. Lanterns and quilts are instanced; the flames, the window panes,
// the light shafts and the dust are one mesh each.

// ----------------------------------------------------------------- sizes
const RH = (KW / 2 - SWD / 2 - 0.15) / 2;       // half the inside width of a room (4.425)
const CH = FH - 0.46;                            // clear height of a storey, floor to ceiling
const LZ = 2.3;                                  // the walkway along the front of every floor
const ROOF_H = 5.0;                              // the attic's height at the ridge
const roomCX = side => side * (SWD / 2 + 0.15 + RH);

// ----------------------------------------------------------------- the faked lamplight
const KGLOW_MAX = 28;
const KGLOW = { p: { value: Array.from({ length: KGLOW_MAX }, () => new THREE.Vector4()) }, c: { value: Array.from({ length: KGLOW_MAX }, () => new THREE.Vector3()) }, n: { value: 0 } };
function kglowMat(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uKGlowP = KGLOW.p; sh.uniforms.uKGlowC = KGLOW.c; sh.uniforms.uKGlowN = KGLOW.n;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec4 uKGlowP[${KGLOW_MAX}]; uniform vec3 uKGlowC[${KGLOW_MAX}]; uniform int uKGlowN;`)
      .replace('#include <opaque_fragment>', `{
        vec3 gP = -vViewPosition, gL = vec3(0.0);
        for (int i = 0; i < ${KGLOW_MAX}; i++) {
          if (i >= uKGlowN) break;
          vec3 d = uKGlowP[i].xyz - gP; float dd = dot(d, d), f = max(0.0, 1.0 - dd / uKGlowP[i].w); f *= f;
          gL += uKGlowC[i] * f * (0.35 + 0.65 * max(dot(normal, d * inversesqrt(dd + 0.0001)), 0.0));
        }
        outgoingLight += diffuseColor.rgb * gL;
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'keepglow';
  return m;
}

// ----------------------------------------------------------------- materials (few of them: tints are vertex colours)
const KM = {};
function keepMats() {
  if (KM.ok) return; KM.ok = true;
  const env = (m, k) => { m.envMap = envTex; m.envMapIntensity = k; return m; };
  const std = (o, k = 0.18) => kglowMat(env(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }), k));
  KM.wood = std({ map: tex('oak'), roughness: 0.8 });
  KM.boards = std({ map: tex('boards'), roughness: 0.86 });
  KM.stone = std({ map: tex('limestone'), roughness: 0.93 }, 0.12);
  KM.dressed = std({ map: tex('dressed'), roughness: 0.9 }, 0.12);
  KM.plaster = std({ map: tex('plaster'), roughness: 0.96 }, 0.12);
  KM.cloth = std({ map: tex('canvas'), roughness: 1, side: THREE.DoubleSide }, 0.08);
  KM.brass = std({ map: tex('brass'), roughness: 0.36, metalness: 0.8 }, 0.9);
  KM.iron = std({ map: tex('iron'), roughness: 0.5, metalness: 0.65 }, 0.6);
  KM.plain = std({ roughness: 0.72 }, 0.2);
  KM.slate = std({ map: tex('slate'), roughness: 0.7 }, 0.3);
  KM.turf = std({ map: tex('turf'), roughness: 1 }, 0.08);
  KM.crystal = kglowMat(env(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffc070, emissive: 0xff8a24, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1, flatShading: true }), 0.6));
  KM.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  KM.glass = env(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xd8f0ea, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }), 0.9);
  KM.plants = std({ map: plantAtlas(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }, 0.05);
  KM.sign = std({ map: signAtlas(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 }, 0.1);
  KM.signLit = new THREE.MeshBasicMaterial({ map: KM.sign.map, vertexColors: true, toneMapped: false });
  KM.shade = new THREE.MeshBasicMaterial({ map: radialTex('rgba(16,8,14,0.6)', 'rgba(16,8,14,0)', 64), transparent: true, depthWrite: false, vertexColors: true });
  KM.hit = new THREE.MeshBasicMaterial({ visible: false });
  // the panes of every window: the sky outside, its clouds, stars at night, rain on the glass
  KM.pane = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uNight: { value: 0 }, uRain: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uFog: { value: 0 }, uBright: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uTop, uHor; uniform float uNight, uRain, uTime, uFlash, uFog, uBright; varying vec2 vUv; varying vec3 vW;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float y = clamp(vW.y * 0.045 + 0.25, 0.0, 1.0);
        vec3 c = mix(uHor, uTop, y);
        float cl = vn(vec2(vW.x * 0.4 + uTime * 0.03, vW.y * 1.3)) * 0.6 + vn(vec2(vW.x * 1.1 - uTime * 0.05, vW.y * 2.7)) * 0.4;
        c = mix(c, mix(uHor * 1.25 + 0.03, uHor * 0.55, uNight), smoothstep(0.55, 0.85, cl) * (0.35 + 0.5 * uFog));
        float st = step(0.992, h21(floor(vW.xy * 18.0 + vec2(vW.z * 7.0, 0.0)))) * uNight * (1.0 - uFog);
        c += st * vec3(0.9, 0.9, 1.0) * (0.6 + 0.4 * sin(uTime * 3.0 + vW.x * 40.0));
        // rain running down the glass
        float col = floor(vUv.x * 26.0), r = h21(vec2(col, floor(vW.y)));
        float drop = fract(vUv.y * 1.6 + uTime * (0.9 + r * 1.4) + r * 7.0);
        c = mix(c, c * 0.65 + 0.14, uRain * smoothstep(0.62, 0.95, drop) * (1.0 - step(0.975, drop)) * step(0.5, r));
        c *= 1.0 - 0.18 * uRain;
        c += uFlash * vec3(0.9, 0.92, 1.0);
        // a soft frost at the edges of the glass
        vec2 e = min(vUv, 1.0 - vUv); c *= 0.82 + 0.18 * smoothstep(0.0, 0.08, min(e.x, e.y));
        gl_FragColor = vec4(c * uBright, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // shafts of daylight from the windows, slanting with the sun
  KM.shaft = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color(1, 0.92, 0.75) }, uSlant: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `attribute float aEnd; uniform float uSlant; varying vec2 vUv; varying float vEnd; void main() { vUv = uv; vEnd = aEnd; vec3 p = position; p.x += uSlant * aEnd; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uK, uTime; uniform vec3 uCol; varying vec2 vUv; varying float vEnd;
      void main() { float side = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x); float a = side * (1.0 - vEnd * 0.75) * smoothstep(0.0, 0.08, vEnd) * uK;
        a *= 0.85 + 0.15 * sin(vUv.x * 13.0 + uTime * 0.7 + vEnd * 4.0);
        gl_FragColor = vec4(uCol * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  // flames: hearths, candles, braziers
  KM.flame = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uK: { value: 1 } },
    vertexShader: `attribute float aSeed; varying vec2 vUv; varying float vSeed; void main() { vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uK; varying vec2 vUv; varying float vSeed;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float t = uTime * 2.2 + vSeed * 13.0;
        float n = vn(vec2(vUv.x * 4.0 + vSeed * 3.0, vUv.y * 3.0 - t)) * 0.65 + vn(vec2(vUv.x * 9.0, vUv.y * 6.0 - t * 1.7)) * 0.35;
        float w = mix(0.5, 0.04, pow(vUv.y, 0.8));
        float d = abs(vUv.x - 0.5 + (n - 0.5) * 0.35 * vUv.y) / w;
        float a = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(0.0, 0.07, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y + (n - 0.5) * 0.5));
        float hot = clamp(1.0 - d * 0.9 - vUv.y * 0.7, 0.0, 1.0);
        vec3 c = mix(vec3(0.9, 0.22, 0.04), vec3(1.0, 0.68, 0.22), smoothstep(0.0, 0.5, hot));
        c = mix(c, vec3(1.0, 0.95, 0.75), smoothstep(0.55, 0.95, hot));
        a *= uK; gl_FragColor = vec4(c * a * 1.7, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  // the lights and the sky outside
  KSCENE.background = new THREE.Color(0x150e1a);
  KEEPV.hemi = new THREE.HemisphereLight(0xfff0dc, 0x3a2630, 1.0); KSCENE.add(KEEPV.hemi);
  KEEPV.sun = new THREE.DirectionalLight(0xfff0dc, 0.9); KEEPV.sun.position.set(-16, 26, 40); KSCENE.add(KEEPV.sun); KSCENE.add(KEEPV.sun.target);
  KSCENE.fog = new THREE.Fog(0x150e1a, 140, 320);
  keepBackdrop();
  keepOnce();
}

// ----------------------------------------------------------------- painted pictures: notices, signs, banners, maps
// One canvas holds them all (and the notice board is redrawn on it when the journal changes).
const KSIGN = { cv: null, tex: null, nbSig: '' };
const SIGN_R = { nb: [0, 0, 320, 240], furnish: [320, 0, 320, 240], bSun: [640, 0, 128, 256], bLens: [768, 0, 128, 256], pennant: [896, 0, 128, 256],
  map: [0, 256, 320, 240], chalk: [320, 256, 320, 240], blue: [640, 256, 256, 192], tally: [0, 512, 256, 192], paint1: [256, 512, 160, 128],
  paint2: [416, 512, 160, 128], web: [576, 512, 128, 128], target: [704, 512, 128, 128], clock: [832, 512, 128, 128], labels: [0, 704, 256, 128],
  crest: [256, 704, 128, 128], holds: [384, 704, 128, 128] };
function signAtlas() {
  if (KSIGN.tex) return KSIGN.tex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024; const g = cv.getContext('2d'); KSIGN.cv = cv;
  const R = mulberry(4711), at = k => SIGN_R[k];
  const font = (s, w = 600, f = 'Georgia, serif') => `${w} ${s}px ${f}`;
  // the furnish sign: a painted board
  { const [x, y, w, h] = at('furnish'); const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#8a5a34'); gr.addColorStop(1, '#6a4226'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,20,10,${0.08 + R() * 0.12})`; g.lineWidth = 1 + R() * 2; const yy = y + R() * h; g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + w * 0.3, yy + R() * 6 - 3, x + w * 0.7, yy + R() * 6 - 3, x + w, yy); g.stroke(); }
    g.strokeStyle = '#e8c070'; g.lineWidth = 6; g.strokeRect(x + 10, y + 10, w - 20, h - 20); g.strokeStyle = '#3a2214'; g.lineWidth = 2; g.strokeRect(x + 16, y + 16, w - 32, h - 32);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(56, 800); g.lineWidth = 8; g.strokeStyle = '#2a1608'; g.strokeText('FURNISH', x + w / 2, y + 92); g.fillStyle = '#ffd27a'; g.fillText('FURNISH', x + w / 2, y + 92);
    g.font = font(22, 600, 'system-ui, sans-serif'); g.fillStyle = '#f6e8c8'; g.fillText('tap to make this', x + w / 2, y + 150); g.fillText('room a study', x + w / 2, y + 176);
    // a hammer and a saw, crossed
    g.save(); g.translate(x + 46, y + 196); g.rotate(-0.6); g.fillStyle = '#c8a070'; g.fillRect(-3, -26, 6, 40); g.fillStyle = '#9aa4ae'; g.fillRect(-12, -32, 24, 10); g.restore();
    g.save(); g.translate(x + w - 46, y + 196); g.rotate(0.6); g.fillStyle = '#b8c0c8'; g.beginPath(); g.moveTo(-6, -30); g.lineTo(8, -30); g.lineTo(4, 12); g.lineTo(-6, 12); g.fill(); g.fillStyle = '#8a5a34'; g.fillRect(-8, 10, 18, 12); g.restore(); }
  // banners: the claim's sun on plum, a lens on green, and a pennant
  const banner = (k, bg, draw) => { const [x, y, w, h] = at(k); g.fillStyle = bg; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < h; i += 6) g.fillRect(x, y + i, w, 2);
    g.strokeStyle = '#d8a84a'; g.lineWidth = 5; g.strokeRect(x + 7, y + 4, w - 14, h - 26); draw(x + w / 2, y + h * 0.42); g.fillStyle = bg; g.clearRect(x, y + h - 22, w, 22);
    g.fillStyle = bg; g.beginPath(); g.moveTo(x, y + h - 22); g.lineTo(x + w / 2, y + h - 2); g.lineTo(x + w, y + h - 22); g.fill(); };
  banner('bSun', '#5a2a52', (cx, cy) => { g.fillStyle = '#f0c060'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18); g.lineTo(cx + Math.cos(a + 0.13) * 40, cy + Math.sin(a + 0.13) * 40); g.lineTo(cx + Math.cos(a - 0.13) * 40, cy + Math.sin(a - 0.13) * 40); g.fill(); }
    g.beginPath(); g.arc(cx, cy, 20, 0, TAU); g.fill(); g.fillStyle = '#5a2a52'; g.beginPath(); g.moveTo(cx - 6, cy + 12); g.lineTo(cx + 2, cy - 4); g.lineTo(cx - 2, cy - 4); g.lineTo(cx + 6, cy - 14); g.lineTo(cx - 2, cy + 2); g.lineTo(cx + 2, cy + 2); g.fill(); });
  banner('bLens', '#2f5a48', (cx, cy) => { g.strokeStyle = '#e8e0c8'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, 26, 0, TAU); g.stroke(); g.fillStyle = '#bfe6e2'; g.beginPath(); g.arc(cx, cy, 20, 0, TAU); g.fill(); g.strokeStyle = '#f0c060'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 26, cy - 10); g.lineTo(cx + 48, cy - 26); g.stroke(); });
  { const [x, y, w, h] = at('pennant'); g.fillStyle = '#9a4430'; g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x + w - 8, y); g.lineTo(x + w / 2, y + h - 4); g.fill(); g.fillStyle = '#f0c060'; g.beginPath(); g.arc(x + w / 2, y + 70, 22, 0, TAU); g.fill(); g.fillStyle = '#9a4430'; g.beginPath(); g.arc(x + w / 2, y + 70, 12, 0, TAU); g.fill(); }
  // a map of the peaks round the claim
  { const [x, y, w, h] = at('map'); g.fillStyle = '#e8d6aa'; g.fillRect(x, y, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(120,80,40,${R() * 0.08})`; g.fillRect(x + R() * w, y + R() * h, 3 + R() * 9, 3 + R() * 9); }
    g.strokeStyle = 'rgba(90,60,30,0.55)'; g.lineWidth = 2; for (let k = 0; k < 9; k++) { const px = x + 30 + R() * (w - 60), py = y + 30 + R() * (h - 60); g.beginPath(); g.moveTo(px - 18, py + 12); g.lineTo(px, py - 14); g.lineTo(px + 18, py + 12); g.stroke(); g.beginPath(); g.moveTo(px - 5, py - 6); g.lineTo(px, py - 14); g.lineTo(px + 6, py - 5); g.stroke(); }
    g.strokeStyle = 'rgba(60,90,120,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + h * 0.7); g.bezierCurveTo(x + w * 0.3, y + h * 0.55, x + w * 0.6, y + h * 0.9, x + w, y + h * 0.65); g.stroke();
    g.fillStyle = '#c03a2a'; g.beginPath(); g.arc(x + w * 0.52, y + h * 0.42, 7, 0, TAU); g.fill(); g.setLineDash([6, 6]); g.strokeStyle = '#7a2a1a'; g.beginPath(); g.moveTo(x + w * 0.52, y + h * 0.42); g.lineTo(x + w * 0.2, y + h * 0.25); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, h - 6); g.font = font(18, 700); g.fillStyle = 'rgba(70,40,20,0.8)'; g.textAlign = 'left'; g.fillText('The Ironspire', x + 18, y + 28); }
  // a chalkboard of drills and sums
  { const [x, y, w, h] = at('chalk'); g.fillStyle = '#2c3a34'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(240,240,230,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.arc(x + 80, y + 90, 40, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x + 80, y + 90); g.lineTo(x + 112, y + 70); g.stroke();
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x + 160, y + 40 + i * 26); g.lineTo(x + 160 + 60 + R() * 90, y + 40 + i * 26); g.stroke(); }
    g.font = font(20, 500); g.fillStyle = 'rgba(240,240,230,0.8)'; g.fillText('θ = 42°', x + 40, y + 190); g.strokeStyle = '#7a5434'; g.lineWidth = 10; g.strokeRect(x + 5, y + 5, w - 10, h - 10); }
  // a blueprint of gears
  { const [x, y, w, h] = at('blue'); g.fillStyle = '#2f5488'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(220,235,255,0.75)'; g.lineWidth = 1.5;
    for (let i = 0; i < w; i += 16) { g.globalAlpha = 0.2; g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i, y + h); g.stroke(); } for (let i = 0; i < h; i += 16) { g.beginPath(); g.moveTo(x, y + i); g.lineTo(x + w, y + i); g.stroke(); } g.globalAlpha = 1;
    const gear = (cx, cy, r, n) => { g.beginPath(); for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * TAU, rr = i % 2 ? r : r * 0.82; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke(); g.beginPath(); g.arc(cx, cy, r * 0.25, 0, TAU); g.stroke(); };
    gear(x + 80, y + 90, 50, 12); gear(x + 160, y + 120, 32, 9); gear(x + 205, y + 60, 22, 7); }
  // the drill yard's tally board
  { const [x, y, w, h] = at('tally'); g.fillStyle = '#7a5434'; g.fillRect(x, y, w, h); g.fillStyle = '#2a3430'; g.fillRect(x + 12, y + 12, w - 24, h - 24); g.strokeStyle = 'rgba(240,240,230,0.75)'; g.lineWidth = 2;
    for (let r = 0; r < 5; r++) { const yy = y + 36 + r * 30; g.beginPath(); g.moveTo(x + 24, yy); g.lineTo(x + 24 + 40 + R() * 30, yy); g.stroke(); for (let k = 0; k < 2 + (R() * 7 | 0); k++) { const xx = x + 120 + k * 11; g.beginPath(); g.moveTo(xx, yy - 10); g.lineTo(xx, yy + 8); g.stroke(); } } }
  // two paintings: the plateau at dusk, and an airship
  { const [x, y, w, h] = at('paint1'); const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#f0a868'); gr.addColorStop(0.6, '#c86a6a'); gr.addColorStop(1, '#4a3050'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#3a2840'; g.beginPath(); g.moveTo(x, y + h); for (let i = 0; i <= 8; i++) g.lineTo(x + i * w / 8, y + h * 0.55 + (i % 2 ? -18 : 6) + R() * 10); g.lineTo(x + w, y + h); g.fill(); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x + w * 0.7, y + h * 0.35, 9, 0, TAU); g.fill();
    g.strokeStyle = '#c99a3c'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, w - 8, h - 8); }
  { const [x, y, w, h] = at('paint2'); g.fillStyle = '#8ab0c8'; g.fillRect(x, y, w, h); g.fillStyle = '#e8eef0'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + R() * w, y + h * 0.75 + R() * 20, 30, 10, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(x + w / 2, y + 48, 44, 16, 0, 0, TAU); g.fill(); g.fillStyle = '#6a4226'; g.fillRect(x + w / 2 - 22, y + 66, 44, 12); g.strokeStyle = '#5a3a26'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + w / 2 - 20, y + 60); g.lineTo(x + w / 2 - 16, y + 68); g.moveTo(x + w / 2 + 20, y + 60); g.lineTo(x + w / 2 + 16, y + 68); g.stroke();
    g.strokeStyle = '#c99a3c'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, w - 8, h - 8); }
  // a cobweb (see-through), a target, a clock face, drawer labels, the claim's crest, climbing holds
  { const [x, y, w] = at('web'); g.strokeStyle = 'rgba(235,235,240,0.95)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = i / 5 * Math.PI / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * w, y + Math.sin(a) * w); g.stroke(); }
    for (let r = 20; r < w; r += 22) { g.beginPath(); for (let i = 0; i <= 5; i++) { const a = i / 5 * Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.stroke(); } }
  { const [x, y, w, h] = at('target'); g.fillStyle = '#e8dcc0'; g.fillRect(x, y, w, h); for (const [r, c] of [[56, '#2a3a5a'], [44, '#e8dcc0'], [32, '#c03a2a'], [20, '#e8dcc0'], [9, '#f0c060']]) { g.fillStyle = c; g.beginPath(); g.arc(x + w / 2, y + h / 2, r, 0, TAU); g.fill(); } }
  { const [x, y, w, h] = at('clock'); g.fillStyle = '#5a3a26'; g.fillRect(x, y, w, h); g.fillStyle = '#f4ead2'; g.beginPath(); g.arc(x + w / 2, y + h / 2, 52, 0, TAU); g.fill(); g.strokeStyle = '#2a1b2f'; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(x + w / 2 + Math.cos(a) * 42, y + h / 2 + Math.sin(a) * 42); g.lineTo(x + w / 2 + Math.cos(a) * 49, y + h / 2 + Math.sin(a) * 49); g.stroke(); }
    g.beginPath(); g.moveTo(x + w / 2, y + h / 2); g.lineTo(x + w / 2 + 22, y + h / 2 - 18); g.moveTo(x + w / 2, y + h / 2); g.lineTo(x + w / 2 - 6, y + h / 2 - 36); g.stroke(); }
  { const [x, y, w, h] = at('labels'); g.fillStyle = '#7a5434'; g.fillRect(x, y, w, h); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = '#e8dcc0'; g.fillRect(x + 10 + c * 62, y + 10 + r * 30, 50, 20); g.fillStyle = 'rgba(60,40,20,0.7)'; g.fillRect(x + 16 + c * 62, y + 18 + r * 30, 20 + R() * 18, 3); } }
  { const [x, y, w, h] = at('crest'); g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(x, y, w, h); g.fillStyle = '#c99a3c'; g.beginPath(); g.moveTo(x + 14, y + 10); g.lineTo(x + w - 14, y + 10); g.lineTo(x + w - 14, y + 60); g.quadraticCurveTo(x + w / 2, y + h, x + w / 2, y + h - 4); g.quadraticCurveTo(x + w / 2, y + h, x + 14, y + 60); g.fill();
    g.fillStyle = '#5a2a52'; g.beginPath(); g.moveTo(x + 22, y + 18); g.lineTo(x + w - 22, y + 18); g.lineTo(x + w - 22, y + 58); g.quadraticCurveTo(x + w / 2, y + h - 12, x + w / 2, y + h - 14); g.quadraticCurveTo(x + w / 2, y + h - 12, x + 22, y + 58); g.fill();
    g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x + w / 2, y + 52, 16, 0, TAU); g.fill(); }
  { const [x, y, w, h] = at('holds'); g.fillStyle = '#c8a878'; g.fillRect(x, y, w, h); for (let i = 0; i < 22; i++) { g.fillStyle = ['#c03a2a', '#f0c060', '#3a6aa8', '#4a8a4a', '#8a4a8a'][i % 5]; g.beginPath(); g.ellipse(x + 8 + R() * (w - 16), y + 8 + R() * (h - 16), 4 + R() * 4, 3 + R() * 3, R() * 3, 0, TAU); g.fill(); } }
  KSIGN.tex = canvasTex(cv);
  drawNoticeBoard(true);
  return KSIGN.tex;
}
// the notice board in the Hearth Hall: this chapter's goals, pinned up, ticked off as they're done
function drawNoticeBoard(force) {
  if (!KSIGN.cv) return;
  let C = null, goals = [];
  try { C = typeof CHAPTERS !== 'undefined' && STORY.started ? CHAPTERS[STORY.ch] : null; goals = C && C.goals ? C.goals.map(q => ({ text: q.text, ok: !!q.done() })) : []; } catch (e) { goals = []; }
  const title = C ? `${STORY.ch ? 'Chapter ' + STORY.ch : 'Prologue'} · ${C.title}` : 'The claim', sig = title + goals.map(q => q.text + q.ok).join('|');
  if (!force && sig === KSIGN.nbSig) return; KSIGN.nbSig = sig;
  const g = KSIGN.cv.getContext('2d'), [x, y, w, h] = SIGN_R.nb, R = mulberry(77);
  g.fillStyle = '#b4875a'; g.fillRect(x, y, w, h);
  for (let i = 0; i < 500; i++) { g.fillStyle = R() < 0.5 ? 'rgba(90,50,20,0.25)' : 'rgba(240,210,160,0.18)'; g.fillRect(x + R() * w, y + R() * h, 2, 2); }
  const wrap = (t, mw) => { const out = []; let line = ''; for (const wd of t.split(' ')) { const tt = line ? line + ' ' + wd : wd; if (g.measureText(tt).width > mw && line) { out.push(line); line = wd; } else line = tt; } if (line) out.push(line); return out; };
  g.textAlign = 'left'; g.textBaseline = 'top';
  // the heading, on a strip of parchment
  g.save(); g.translate(x + 14, y + 10); g.rotate(-0.015); g.fillStyle = '#efe2c2'; g.fillRect(0, 0, w - 28, 40); g.fillStyle = '#5a2a52'; g.font = '700 19px Georgia, serif'; g.fillText(title.length > 30 ? title.slice(0, 29) + '…' : title, 10, 10); g.restore();
  g.fillStyle = '#c03a2a'; g.beginPath(); g.arc(x + w / 2, y + 16, 4, 0, TAU); g.fill();
  let yy = y + 60;
  goals.slice(0, 3).forEach((q, i) => {
    g.font = '600 18px system-ui, sans-serif'; const lines = wrap(q.text, w - 84).slice(0, 3), hh = 12 + lines.length * 21;
    g.save(); g.translate(x + 22 + (i % 2) * 8, yy); g.rotate((R() - 0.5) * 0.04);
    g.fillStyle = q.ok ? '#e2ecd0' : '#f6efd8'; g.fillRect(0, 0, w - 52, hh); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, hh, w - 52, 3);
    g.fillStyle = q.ok ? '#3a7a3a' : '#7a5a3a'; g.font = '700 17px system-ui, sans-serif'; g.fillText(q.ok ? '✓' : '◇', 8, 6);
    g.fillStyle = '#3a2a24'; g.font = '600 18px system-ui, sans-serif'; lines.forEach((l, k) => g.fillText(l, 30, 7 + k * 21));
    if (q.ok) { g.strokeStyle = 'rgba(58,122,58,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(28, hh / 2 + 2); g.lineTo(w - 70, hh / 2 + 2); g.stroke(); }
    g.restore(); g.fillStyle = ['#c03a2a', '#3a6aa8', '#e0a030'][i]; g.beginPath(); g.arc(x + w / 2 + (i - 1) * 30, yy + 3, 4, 0, TAU); g.fill();
    yy += hh + 10;
  });
  if (!goals.length) { g.fillStyle = '#f6efd8'; g.fillRect(x + 30, y + 70, w - 60, 60); g.fillStyle = '#3a2a24'; g.font = '500 15px system-ui, sans-serif'; g.fillText('Supper at sundown.', x + 44, y + 90); }
  if (KSIGN.tex) KSIGN.tex.needsUpdate = true;
}
// fern, herb and reed pictures side by side, for potted plants and drying herbs
function plantAtlas() {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 256; const g = cv.getContext('2d');
  ['fern', 'herb', 'reed'].forEach((k, i) => { if (IMG[k]) g.drawImage(IMG[k], i * 256, 0, 256, 256); });
  const t = canvasTex(cv); return t;
}

// ----------------------------------------------------------------- putting pieces in place
// Every piece is baked into world space with its tint as vertex colours and textures in metres, ready to merge.
let KB = null, KR = null, KT = 1;                      // the pieces being collected, the room they're for, their tier
const _km = new THREE.Matrix4(), _kq = new THREE.Quaternion(), _ke = new THREE.Euler(), _kv = new THREE.Vector3(), _ks = new THREE.Vector3(), _kc = new THREE.Color();
function kput(geo, mat, x, y, z, o = {}) {
  _ke.set(o.rx || 0, o.ry || 0, o.rz || 0, o.ord || 'XYZ'); _kq.setFromEuler(_ke);
  _km.compose(_kv.set(x, y, z), _kq, _ks.set(...(o.s || [1, 1, 1])));
  if (geo.index) geo = geo.toNonIndexed();
  geo.applyMatrix4(_km);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (mat.map && !o.keepUV) geo = projUV(geo, o.uv || 2);
  else if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), P = geo.attributes.position;
  _kc.set(o.col ?? 0xffffff); if (o.k) _kc.multiplyScalar(o.k);
  for (let i = 0; i < n; i++) {
    let k = 1;
    if (o.ao) { const [ya, yb, ka, kb] = o.ao, y = P.getY(i); k = Math.min(lerp(ka, 1, clamp((y - ya) / 1.1, 0, 1)), lerp(kb, 1, clamp((yb - y) / 0.7, 0, 1))); }
    col[i * 3] = _kc.r * k; col[i * 3 + 1] = _kc.g * k; col[i * 3 + 2] = _kc.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  KB.push({ geo, mat, room: KR ? KR.key : null, tier: KT });
  return geo;
}
// merge a list of pieces into one mesh per material
function kmerge(group, recs) {
  const by = new Map();
  for (const r of recs) { if (!by.has(r.mat)) by.set(r.mat, []); by.get(r.mat).push(r.geo); }
  const out = [];
  for (const [mat, geos] of by) {
    const clean = geos.map(g => { const b = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv', 'color']) b.setAttribute(k, g.attributes[k]); return b; });
    const merged = mergeGeometries(clean); if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.matrixAutoUpdate = false; group.add(m); out.push(m);
    for (const g of geos) g.dispose();
  }
  return out;
}
// local helpers for the room being furnished: u across the room from its middle, y up from its floor
const kx = u => KR.cx + u, ky = y => KR.y0 + y;
const KBOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const kbox = (w, h, d, mat, u, y, z, o) => kput(KBOX(w, h, d), mat, kx(u), ky(y), z, o);
const kcyl = (rt, rb, h, mat, u, y, z, o = {}) => kput(new THREE.CylinderGeometry(rt, rb, h, o.seg || 10, 1, !!o.open), mat, kx(u), ky(y), z, o);
const ksph = (r, mat, u, y, z, o = {}) => kput(new THREE.SphereGeometry(r, o.seg || 10, o.hseg || 7, 0, TAU, 0, o.half ? Math.PI / 2 : Math.PI), mat, kx(u), ky(y), z, o);
const kplane = (w, h, mat, u, y, z, o) => kput(new THREE.PlaneGeometry(w, h, 1, o && o.seg || 1), mat, kx(u), ky(y), z, o);
// a quad showing part of an atlas: region [x, y, w, h] in a canvas of size S
function kquad(w, h, mat, region, u, y, z, o = {}) {
  const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv, [rx, ry, rw, rh] = region, S = o.S || 1024, SH = o.SH || S;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (rx + uv.getX(i) * rw) / S, 1 - (ry + (1 - uv.getY(i)) * rh) / SH);
  return kput(geo, mat, kx(u), ky(y), z, { ...o, keepUV: true });
}
// a contact shadow on the floor under furniture
const kshade = (u, z, w, d, k = 1) => kput(new THREE.PlaneGeometry(w, d), KM.shade, kx(u), ky(0.012), z, { rx: -Math.PI / 2, col: new THREE.Color(k, k, k), keepUV: true });

// ----------------------------------------------------------------- lists that become their own meshes
const KEEPX = { panes: [], shafts: [], flames: [], dust: [], bees: [], lamps: [], quiltBeds: [], embers: [], steam: [], fx: null };
function kpane(w, h, x, y, z, o = {}) { const g = new THREE.PlaneGeometry(w, h); if (o.ry) g.rotateY(o.ry); g.translate(x, y, z); KEEPX.panes.push(g); }
// a shaft of light from a window, slanting down into the room; aEnd runs 0 at the glass to 1 on the floor
function kshaft(x, y0w, y1w, w, zw, floorY, reach) {
  const top = y1w - 0.15, bot = y0w, len = reach;
  const geo = new THREE.BufferGeometry(), P = [], U = [], E = [];
  const q = (ax, ay, az, au, ae) => { P.push(ax, ay, az); U.push(au, ae); E.push(ae); };
  // a slab of light: the top edge at the window, the bottom edge on the floor in front of it
  const fz = zw + len, fy = floorY + 0.02;
  q(x - w / 2, top, zw, 0, 0); q(x + w / 2, top, zw, 1, 0); q(x + w / 2, fy, fz, 1, 1);
  q(x - w / 2, top, zw, 0, 0); q(x + w / 2, fy, fz, 1, 1); q(x - w / 2, fy, fz, 0, 1);
  q(x - w / 2, bot, zw, 0, 0); q(x + w / 2, bot, zw, 1, 0); q(x + w / 2, fy, fz - len * 0.45, 1, 1);
  q(x - w / 2, bot, zw, 0, 0); q(x + w / 2, fy, fz - len * 0.45, 1, 1); q(x - w / 2, fy, fz - len * 0.45, 0, 1);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setAttribute('aEnd', new THREE.Float32BufferAttribute(E, 1));
  KEEPX.shafts.push(geo);
}
// a flame: two crossed quads, rising from (x, y, z)
function kflame(x, y, z, w, h, seed = Math.random()) {
  for (const ry of [0, Math.PI / 2]) {
    const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0); if (ry) { g.rotateY(ry); g.scale(0.7, 1, 1); } g.translate(x, y, z);
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(seed + (ry ? 0.37 : 0)), 1));
    KEEPX.flames.push(g.index ? g.toNonIndexed() : g);
  }
}
// a glowing light source the materials take light from
function klight(kind, x, y, z, r, col, o = {}) { KEEPV.lights.push({ kind, x, y, z, r, col, room: KR ? KR.key : null, k: 1, ...o }); }

// ----------------------------------------------------------------- prefabs
function ktable(u, z, w, d, h = 0.84, o = {}) {
  const mat = o.mat || KM.wood, col = o.col ?? 0xb08a64, legCol = o.legCol ?? 0x6a5040;
  kbox(w, 0.08, d, mat, u, h - 0.04, z, { col });
  if (o.trestle) { for (const s of [-1, 1]) { kbox(0.1, h - 0.08, 0.1, mat, u + s * (w / 2 - 0.35), (h - 0.08) / 2, z, { col: legCol }); kbox(0.1, 0.08, d * 0.9, mat, u + s * (w / 2 - 0.35), 0.06, z, { col: legCol }); kbox(0.08, 0.08, d * 0.8, mat, u + s * (w / 2 - 0.35), h - 0.14, z, { col: legCol }); } kbox(w - 0.8, 0.07, 0.07, mat, u, 0.35, z, { col: legCol }); }
  else for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kbox(0.08, h - 0.08, 0.08, mat, u + a * (w / 2 - 0.1), (h - 0.08) / 2, z + b * (d / 2 - 0.1), { col: legCol });
  // a cloth that hangs down the front (it hides the knees of whoever sits behind)
  if (o.skirt) { kbox(w + 0.06, 0.025, d + 0.06, KM.cloth, u, h + 0.005, z, { col: o.skirt }); kbox(w + 0.06, h - 0.14, 0.025, KM.cloth, u, (h + 0.12) / 2, z + d / 2 + 0.03, { col: new THREE.Color(o.skirt).multiplyScalar(0.92) }); }
  if (!o.noShade) kshade(u, z, w * 1.2, d * 1.4, 0.9);
}
function kbench(u, z, w, o = {}) { const col = o.col ?? 0x8a6a50; kbox(w, 0.07, 0.32, KM.wood, u, 0.44, z, { col }); for (const s of [-1, 1]) kbox(0.07, 0.42, 0.28, KM.wood, u + s * (w / 2 - 0.2), 0.21, z, { col: 0x6a5040 }); }
function kstool(u, z, o = {}) { kcyl(0.2, 0.2, 0.06, KM.wood, u, 0.48, z, { col: o.col ?? 0x9a7656, seg: 10 }); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; kbox(0.05, 0.48, 0.05, KM.wood, u + Math.cos(a) * 0.13, 0.23, z + Math.sin(a) * 0.13, { col: 0x6a5040, rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12 }); } }
// a chair facing direction f (radians about y; 0 faces the camera)
function kchair(u, z, f = 0, o = {}) {
  const col = o.col ?? 0x8a6448, s = Math.sin(f), c = Math.cos(f), at = (a, b) => [u + a * c + b * s, z - a * s + b * c];
  let [x, zz] = at(0, 0); kbox(0.48, 0.06, 0.46, KM.wood, x, 0.46, zz, { col, ry: f });
  [x, zz] = at(0, -0.22); kbox(0.48, 0.6, 0.06, KM.wood, x, 0.78, zz, { col, ry: f });
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { [x, zz] = at(a * 0.2, b * 0.19); kbox(0.05, 0.45, 0.05, KM.wood, x, 0.22, zz, { col: 0x5a4030 }); }
  if (o.cushion) { [x, zz] = at(0, 0.02); kbox(0.42, 0.06, 0.4, KM.cloth, x, 0.52, zz, { col: o.cushion, ry: f }); }
}
// an armchair, upholstered, facing direction f
function karmchair(u, z, f, col) {
  const s = Math.sin(f), c = Math.cos(f), at = (a, b) => [u + a * c + b * s, z - a * s + b * c];
  let [x, zz] = at(0, 0.02); kbox(0.9, 0.4, 0.8, KM.cloth, x, 0.32, zz, { col, ry: f });
  [x, zz] = at(0, -0.36); kbox(0.9, 0.95, 0.2, KM.cloth, x, 0.7, zz, { col, ry: f });
  for (const a of [-1, 1]) { [x, zz] = at(a * 0.4, 0.0); kbox(0.16, 0.62, 0.8, KM.cloth, x, 0.42, zz, { col: new THREE.Color(col).multiplyScalar(0.85), ry: f }); }
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { [x, zz] = at(a * 0.38, b * 0.32); kbox(0.07, 0.14, 0.07, KM.wood, x, 0.07, zz, { col: 0x4a3020 }); }
  kshade(u, z, 1.2, 1.1);
}
function kcrate(u, y, z, s = 0.6, o = {}) {
  const col = o.col ?? 0xb08a60, ry = o.ry || 0;
  kbox(s, s, s, KM.wood, u, y + s / 2, z, { col, ry, uv: 1 });
  for (const yy of [0.12, 0.88]) kbox(s + 0.03, 0.07, s + 0.03, KM.wood, u, y + s * yy, z, { col: 0x6a4a30, ry });
  if (!o.noShade && y < 0.05) kshade(u, z, s * 1.6, s * 1.6, 0.8);
}
function kbarrel(u, z, h = 0.9, o = {}) {
  kcyl(0.32, 0.27, h, KM.wood, u, h / 2, z, { col: o.col ?? 0x9a6a44, seg: 12 });
  for (const yy of [0.15, 0.5, 0.85]) kcyl(0.335, 0.335, 0.05, KM.iron, u, h * yy, z, { seg: 12, col: 0x8a8a8a });
  kcyl(0.28, 0.28, 0.02, KM.wood, u, h + 0.005, z, { col: 0x7a5434, seg: 12 }); kshade(u, z, 1.0, 1.0);
}
const BOOKC = [0x8a3a2a, 0x2f5a6a, 0x4a6a3a, 0x6a3a5e, 0xc8a060, 0x5a4a8a, 0x9a6a3a, 0x2a3a5a];
function kbooks(u, y, z, w, R, o = {}) {
  let x = u - w / 2;
  while (x < u + w / 2 - 0.08) { const bw = 0.06 + R() * 0.07, bh = 0.24 + R() * 0.16; if (R() < 0.08) { x += 0.1; continue; } kbox(bw, bh, 0.22, KM.plain, x + bw / 2, y + bh / 2, z, { col: BOOKC[R() * BOOKC.length | 0], k: 0.8 + R() * 0.3, rz: R() < 0.06 ? 0.25 : 0 }); x += bw + 0.008; }
}
function kshelfUnit(u, z, w, h, rows, R, fill = 'books', o = {}) {
  const col = o.col ?? 0x7a5a40, d = o.d ?? 0.4;
  for (const s of [-1, 1]) kbox(0.06, h, d, KM.wood, u + s * (w / 2 - 0.03), h / 2, z, { col });
  kbox(w, h, 0.03, KM.wood, u, h / 2, z - d / 2 + 0.015, { col: new THREE.Color(col).multiplyScalar(0.7) });
  for (let r = 0; r <= rows; r++) kbox(w, 0.05, d, KM.wood, u, 0.06 + r * (h - 0.1) / rows, z, { col });
  for (let r = 0; r < rows; r++) { const yy = 0.09 + r * (h - 0.1) / rows; if (fill === 'books') kbooks(u, yy, z + 0.03, w - 0.16, R); else if (fill === 'jars') kjars(u, yy, z + 0.04, w - 0.2, R); else if (fill === 'plates') for (let i = 0; i < 4; i++) kcyl(0.16, 0.16, 0.025, KM.plain, u - w / 2 + 0.3 + i * (w - 0.5) / 3, yy + 0.17, z - 0.06, { col: 0xefe6d0, rx: Math.PI / 2 - 0.2, seg: 14 }); }
  kshade(u, z + 0.1, w * 1.1, d * 1.6);
}
function kjars(u, y, z, w, R) {
  const n = Math.max(1, Math.round(w / 0.24));
  for (let i = 0; i < n; i++) { const x = u - w / 2 + (i + 0.5) * w / n, h = 0.18 + R() * 0.1; kcyl(0.075, 0.075, h, KM.glass, x, y + h / 2, z, { seg: 8 }); kcyl(0.06, 0.06, h * 0.6, KM.plain, x, y + h * 0.3, z, { col: [0xc89a4a, 0x8a5a2a, 0x6a8a3a, 0xd8c070, 0x9a3a2a][R() * 5 | 0], seg: 6 }); kcyl(0.08, 0.08, 0.03, KM.wood, x, y + h + 0.015, z, { col: 0x6a4a30, seg: 8 }); }
}
// a candle in a brass holder, with its flame
function kcandle(u, y, z, o = {}) {
  if (!o.bare) kcyl(0.07, 0.09, 0.03, KM.brass, u, y + 0.015, z, { seg: 8 });
  const h = o.h ?? 0.16; kcyl(0.028, 0.03, h, KM.plain, u, y + 0.03 + h / 2, z, { col: 0xf4ecd8, seg: 6 });
  kflame(kx(u), ky(y + 0.03 + h), z, 0.05, 0.12);
  if (o.light) klight('candle', kx(u), ky(y + h + 0.3), z + 0.3, o.r ?? 2.2, [1.2, 0.75, 0.35]);
}
// a hanging lantern (instanced, it sways) with the light it gives
function klamp(u, z, o = {}) {
  const y = ky(CH) - 0.02; KEEPX.lamps.push({ x: kx(u), y, z, lv: o.lv || 1, ph: Math.random() * TAU, lit: o.lit !== false, chain: o.chain ?? 0.4 });
  if (o.lit !== false) klight('lamp', kx(u), y - 1.2 - (o.chain ?? 0.4), z + 0.6, o.r ?? 6.5, o.col || [1.3, 0.86, 0.42]);
}
// a wall sconce: a brass plate and a candle
function ksconce(u, y, z = -KD / 2) { kbox(0.16, 0.26, 0.04, KM.brass, u, y, z + 0.03); kbox(0.05, 0.05, 0.18, KM.brass, u, y - 0.1, z + 0.11); kcandle(u, y - 0.08, z + 0.2, { bare: true, h: 0.14, light: true, r: 2.6 }); }
// a window in the back wall: frame, mullions, sill, the pane (the sky), a shaft of light and the light it lets in
function kwin(u, yb, w, h, o = {}) {
  const Z = -KD / 2, x = kx(u), frame = o.frame ?? 0x6a4a34;
  kpane(w, h, x, ky(yb + h / 2), Z + 0.025);
  kbox(w + 0.26, 0.12, 0.2, KM.wood, u, yb + h + 0.06, Z + 0.08, { col: frame });
  kbox(w + 0.36, 0.09, 0.3, KM.wood, u, yb - 0.045, Z + 0.13, { col: frame, k: 1.1 });
  for (const s of [-1, 1]) kbox(0.12, h + 0.12, 0.2, KM.wood, u + s * (w / 2 + 0.06), yb + h / 2, Z + 0.08, { col: frame });
  const nx = o.cols ?? (w > 0.9 ? 2 : 1), ny = o.rows ?? 2;
  for (let i = 1; i < nx; i++) kbox(0.05, h, 0.06, KM.wood, u - w / 2 + i * w / nx, yb + h / 2, Z + 0.05, { col: frame });
  for (let i = 1; i < ny; i++) kbox(w, 0.05, 0.06, KM.wood, u, yb + i * h / ny, Z + 0.05, { col: frame });
  if (o.arch) kput(new THREE.CircleGeometry(w / 2 + 0.12, 16, 0, Math.PI), KM.wood, x, ky(yb + h + 0.11), Z + 0.07, { col: frame });
  if (o.curtain) for (const s of [-1, 1]) kbox(0.3, h + 0.4, 0.06, KM.cloth, u + s * (w / 2 + 0.22), yb + h / 2 + 0.05, Z + 0.2, { col: o.curtain });
  if (o.shaft !== false) kshaft(x, ky(yb), ky(yb + h), w * 0.95, Z + 0.06, ky(0), o.reach ?? 3.0);
  klight('win', x, ky(yb + h * 0.55), Z + 1.3, o.r ?? 5.2, [1, 1, 1], { w: w * h });
}
// a round window (an oculus)
function koculus(u, y, r, o = {}) {
  const Z = o.z ?? -KD / 2, x = kx(u);
  const g = new THREE.CircleGeometry(r, 18); g.translate(x, ky(y), Z + 0.025); KEEPX.panes.push(g);
  kput(new THREE.TorusGeometry(r + 0.04, 0.07, 6, 20), KM.wood, x, ky(y), Z + 0.06, { col: o.frame ?? 0x6a4a34 });
  kbox(0.04, r * 2, 0.05, KM.wood, u, y, Z + 0.05, { col: o.frame ?? 0x6a4a34 }); kbox(r * 2, 0.04, 0.05, KM.wood, u, y, Z + 0.05, { col: o.frame ?? 0x6a4a34 });
  klight('win', x, ky(y), Z + 1.1, o.reach ?? 3.6, [1, 1, 1], { w: r * r * 2 });
}
// a rug: a border and a field
function krug(u, z, w, d, col, col2, o = {}) {
  kplane(w, d, KM.cloth, u, 0.014, z, { rx: -Math.PI / 2, col: col2, uv: 0.6 });
  kplane(w - 0.24, d - 0.24, KM.cloth, u, 0.018, z, { rx: -Math.PI / 2, col, uv: 0.6 });
  if (o.stripes) for (let i = 1; i < 4; i++) kplane(0.06, d - 0.4, KM.cloth, u - w / 2 + i * w / 4, 0.021, z, { rx: -Math.PI / 2, col: col2, uv: 0.6 });
}
// a plant from the atlas (0 fern, 1 herb, 2 reed): two crossed cards
function kplant(u, y, z, which, s, o = {}) {
  for (const ry of [0.4, 0.4 + Math.PI / 2]) kquad(s, s, KM.plants, [which * 256, 0, 256, 256], u, y + s / 2 - 0.02, z, { S: 768, SH: 256, ry, col: o.col ?? 0xffffff, rx: o.flip ? Math.PI : 0 });
}
function kpot(u, y, z, r = 0.16, o = {}) {
  kcyl(r, r * 0.75, r * 1.6, KM.plain, u, y + r * 0.8, z, { col: o.col ?? 0xb86a44, seg: 10 }); kcyl(r * 1.08, r * 1.08, 0.04, KM.plain, u, y + r * 1.6, z, { col: o.col ?? 0xb86a44, k: 0.9, seg: 10 });
  kcyl(r * 0.92, r * 0.92, 0.02, KM.plain, u, y + r * 1.55, z, { col: 0x4a3426, seg: 10 });
  if (o.plant !== undefined) kplant(u, y + r * 1.5, z, o.plant, o.ps ?? r * 4.5);
}
function kframe(u, y, w, h, region, o = {}) { const Z = o.z ?? -KD / 2; kquad(w, h, KM.sign, SIGN_R[region], u, y, Z + 0.04, o); }
function kbanner(u, y, w, h, region, o = {}) { const Z = o.z ?? -KD / 2; kbox(w + 0.25, 0.05, 0.05, KM.wood, u, y + h / 2 + 0.04, Z + 0.1, { col: 0x5a3a26 }); kquad(w, h, KM.sign, SIGN_R[region], u, y, Z + 0.07, o); }
// a bunk bed: posts, two decks with mattresses and pillows, a ladder. Returns its two beds.
function kbunk(u, z, o = {}) {
  const L = 2.05, D = 0.95, col = o.col ?? 0x8a6448, beds = [], decks = o.decks || [0.42, 1.72], top = decks[decks.length - 1] + 0.95;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kbox(0.1, top, 0.1, o.brass ? KM.brass : KM.wood, u + a * (L / 2 - 0.05), top / 2, z + b * (D / 2 - 0.05), { col: o.brass ? 0x9a8058 : col });
  if (o.brass) for (const a of [-1, 1]) for (const b of [-1, 1]) ksph(0.07, KM.brass, u + a * (L / 2 - 0.05), top + 0.03, z + b * (D / 2 - 0.05));
  for (const y of decks) {
    kbox(L, 0.12, D, KM.wood, u, y, z, { col: new THREE.Color(col).multiplyScalar(0.8) });
    kbox(L - 0.14, 0.16, D - 0.1, KM.cloth, u, y + 0.14, z, { col: 0xe8dcc0, uv: 0.8 });
    kbox(0.42, 0.13, D - 0.25, KM.cloth, u - L / 2 + 0.3, y + 0.28, z, { col: 0xf4eee0 });
    kbox(L, 0.16, 0.06, KM.wood, u, y + 0.24, z - D / 2 + 0.03, { col });
    beds.push({ x: kx(u), y: ky(y + 0.22), z, L });
  }
  kbox(L - 0.1, 0.12, 0.05, KM.wood, u, top - 0.25, z - D / 2 + 0.02, { col });
  const lx = u + L / 2 - 0.2;
  for (const s of [-0.18, 0.18]) kbox(0.05, decks[decks.length - 1] + 0.3, 0.05, KM.wood, lx + s, (decks[decks.length - 1] + 0.3) / 2, z + D / 2 + 0.05, { col });
  for (let y = 0.35; y < decks[decks.length - 1] + 0.2; y += 0.32) kbox(0.36, 0.04, 0.04, KM.wood, lx, y, z + D / 2 + 0.05, { col });
  kshade(u, z, L * 1.15, D * 1.4);
  return beds;
}
// a training dummy: a post, a straw body, a sack head, crossbar arms
function kdummy(u, z, o = {}) {
  kbox(0.12, 1.75, 0.12, KM.wood, u, 0.88, z, { col: 0x5a4030 }); kbox(0.5, 0.06, 0.5, KM.wood, u, 0.03, z, { col: 0x5a4030 });
  kcyl(0.25, 0.3, 0.72, KM.cloth, u, 1.15, z, { col: 0xd8b878, seg: 10 }); ksph(0.18, KM.cloth, u, 1.72, z, { col: 0xc8a868 });
  kbox(0.9, 0.08, 0.08, KM.wood, u, 1.38, z, { col: 0x6a4a34 }); kcyl(0.255, 0.255, 0.05, KM.plain, u, 1.32, z, { col: 0x8a4a2a, seg: 10 });
  if (o.target) kquad(0.36, 0.36, KM.sign, SIGN_R.target, u, 1.16, z + 0.31);
  kshade(u, z, 0.9, 0.9);
}

// ----------------------------------------------------------------- the whole cutaway
function keepOnce() {
  // lanterns: a chain, a cap, a cage and a glowing core, hanging from a hook (the origin) so they can sway
  const parts = [[0.035, 0.42, 0.035, 0, -0.21, 0], [0.3, 0.07, 0.3, 0, -0.45, 0], [0.32, 0.06, 0.32, 0, -0.87, 0]];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push([0.035, 0.36, 0.035, sx * 0.12, -0.66, sz * 0.12]);
  const body = mergeGeometries(parts.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed()));
  const core = new THREE.OctahedronGeometry(1, 0).scale(0.12, 0.19, 0.12).translate(0, -0.66, 0);
  KEEPV.lant = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.7, envMap: envTex, envMapIntensity: 0.6 }), 64);
  KEEPV.lantCore = new THREE.InstancedMesh(core, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 64);
  // quilts: one for everyone's bed, in their own colours; raised over whoever is asleep in it
  const qg = new THREE.BoxGeometry(1, 1, 1); qg.translate(0, 0.5, 0);
  KEEPV.quilts = new THREE.InstancedMesh(projUV(qg, 0.6), kglowMat(new THREE.MeshStandardMaterial({ map: tex('canvas'), roughness: 1, envMap: envTex, envMapIntensity: 0.08 })), 48);
  for (const m of [KEEPV.lant, KEEPV.lantCore, KEEPV.quilts]) { m.count = 0; m.frustumCulled = false; KSCENE.add(m); }
  // particles: embers, steam and dust puffs
  KEEPX.fx = keepFX(KSCENE);
}
function buildInterior(force) {
  if (!TOWN.b.keep) return;
  keepMats();
  const lv = keepLv(), nF = lv + 1, light = QUALITY.level === 'light';
  const sig = lv + '|' + GAME.rooms.map(r => (r.type || '-') + r.level).join(',') + '|' + (light ? 'L' : '');
  if (!force && KEEPV.sig === sig && KEEPV.group) return;
  // a room that has just been furnished, or raised a level, is fitted out in front of you
  const prev = KEEPV.prevRooms; let fit = -1;
  if (!force && prev && KEEPV.lv === lv && KEEPV.group) GAME.rooms.forEach((r, i) => { if (fit < 0 && r.type && prev[i] && (prev[i].type !== r.type || r.level > prev[i].level)) fit = i; });
  if (fit >= 0) KEEPV.fit = { key: fit, t: 0, from: prev[fit].type === GAME.rooms[fit].type ? prev[fit].level : 0 };
  else KEEPV.fit = null;
  KEEPV.sig = sig; KEEPV.lv = lv; KEEPV.prevRooms = GAME.rooms.map(r => ({ ...r }));
  if (KEEPV.group) { KSCENE.remove(KEEPV.group); KEEPV.group.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); }); }
  const g = new THREE.Group(); KEEPV.group = g; KSCENE.add(g);
  KEEPV.hits = []; KEEPV.tags = []; KEEPV.lights = []; KEEPV.spots = []; KEEPV.rooms = {}; KEEPV.dyn = []; KEEPV.beds = [];
  for (const k of ['panes', 'shafts', 'flames', 'dust', 'bees', 'lamps', 'embers', 'steam']) KEEPX[k] = [];
  const H = nF * FH; KEEPV.H = H; KEEPV.nF = nF;
  KB = []; KR = null; KT = 1;
  keepShell(lv, nF);
  keepStair(nF);
  const room = (key, kind, f, side, level) => {
    const R = { key, kind, f, side, level, cx: roomCX(side), y0: f * FH + 0.02, ou: side };
    KEEPV.rooms[key] = R; KR = R; KT = 0;
    roomShell(R);   // (tier 0: the walls stay put while a room is fitted out)
    KT = 1;
    (KFURN[kind] || KFURN.empty)(R, mulberry(31 + f * 7 + (side + 1) * 3 + String(kind).length));
    KT = 1; KR = null;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(RH * 2, CH, KD), KM.hit); hit.position.set(R.cx, R.y0 + CH / 2, 0); hit.userData.room = key; g.add(hit); KEEPV.hits.push(hit);
    KEEPV.tags.push({ key, pos: new THREE.Vector3(R.cx, R.y0 + CH - 0.1, KD / 2) });
  };
  room('hearth', 'hearth', 0, -1, lv); room('dorm', 'dorm', 0, 1, lv);
  SLOT_POS.forEach(([f, side], i) => { if (f < nF) { const r = GAME.rooms[i]; room(i, r.type || 'empty', f, side, r.level || 1); } });
  if (nF > 3) room('lookout', 'lookout', 3, 1, lv);
  keepAttic(lv, nF);
  // the static pieces: one mesh per material for the whole Keep, except a room being fitted out
  const F = KEEPV.fit, fitRecs = F ? KB.filter(r => r.room === F.key && r.tier > F.from) : [];
  const fset = new Set(fitRecs);
  kmerge(g, KB.filter(r => !fset.has(r)));
  if (F) keepFitBuild(g, fitRecs);
  KB = null;
  // what isn't merged with the rest: panes, shafts, flames, dust, bees
  const add = (geos, mat, name) => { if (!geos.length) return null; const clean = geos.map(x => x.index ? x.toNonIndexed() : x); const m = new THREE.Mesh(mergeGeometries(clean), mat); m.name = name; m.frustumCulled = false; g.add(m); return m; };
  const only = (x, keys) => { if (x.index) x = x.toNonIndexed(); const b = new THREE.BufferGeometry(); for (const k of keys) b.setAttribute(k, x.attributes[k]); return b; };
  add(KEEPX.panes.map(x => only(x, ['position', 'uv'])), KM.pane, 'panes');
  if (!light) add(KEEPX.shafts, KM.shaft, 'shafts');
  KEEPV.flames = add(KEEPX.flames.map(x => only(x, ['position', 'uv', 'aSeed'])), KM.flame, 'flames');
  if (KEEPV.flames) KEEPV.flames.renderOrder = 4;
  keepDust(g, light);
  keepLanterns();
  // where everyone sleeps: the dorm's bunks first, then the attic, then bedrolls by the hall's fire
  KEEPV.beds.sort((a, b) => a.order - b.order);
  for (const s of KEEPV.spots) s.p.y = s.p.y;   // (kept for clarity: spots are in world space)
  KEEPV.built = (KEEPV.built || 0) + 1;
  setInteriorLights();
}

// ----------------------------------------------------------------- the shell: walls, floors, roof, ground
function keepShell(lv, nF) {
  const H = nF * FH, Zb = -KD / 2;
  // the ground in front, the plinth and the steps up to the door
  kput(KBOX(220, 0.5, 90), KM.turf, 0, -0.95, -18, { col: 0xb8c0a0, uv: 6 });
  kput(KBOX(KW + 3, 0.7, KD + 2.2), KM.dressed, 0, -0.35, 0, { col: 0xa89a88 });
  for (let i = 0; i < 3; i++) kput(KBOX(4.0 - i * 0.4, 0.22, 0.8), KM.dressed, 0, -0.6 + i * 0.22, KD / 2 + 1.7 - i * 0.4, { col: 0xb8aa98 });
  kput(new THREE.PlaneGeometry(3.2, 14), KM.dressed, 0, -0.69, KD / 2 + 9, { rx: -Math.PI / 2, col: 0x9a8c7c, uv: 1.2 });
  // the back wall and the end walls, outside
  kput(KBOX(KW + 1.6, H + 0.5, 0.7), KM.stone, 0, H / 2, Zb - 0.35, { col: 0xc8bcb0 });
  for (const s of [-1, 1]) {
    kput(KBOX(1.0, H + 0.6, KD + 0.8), KM.stone, s * (KW / 2 + 0.5), (H + 0.6) / 2 - 0.3, -0.1, { col: 0xc8bcb0 });
    // the cut face, darker, with a pale lip where the wall was sawn through
    kput(new THREE.PlaneGeometry(1.0, H + 0.6), KM.stone, s * (KW / 2 + 0.5), (H + 0.6) / 2 - 0.3, KD / 2 + 0.31, { col: 0x8a7c74, uv: 1.4 });
    kput(KBOX(0.05, H + 0.6, 0.05), KM.plain, s * (KW / 2 + 0.03), (H + 0.6) / 2 - 0.3, KD / 2 + 0.32, { col: 0xe8dcc4 });
    // buttresses down the outside of the end walls
    for (const z of [-2.4, 2.0]) kput(KBOX(0.6, 2.2, 0.8), KM.stone, s * (KW / 2 + 1.25), 0.8, z, { col: 0xb8aca0, rz: s * 0.08 });
  }
  // the floors between the storeys: the cut slab, with its pale lip (the stairwell's slabs are made with the stair)
  for (let f = 1; f <= nF; f++) for (const s of [-1, 1]) {
    const cx = s * (KW / 2 + SWD / 2) / 2, w = KW / 2 - SWD / 2 + (f === nF ? 0.6 : 0);
    kput(KBOX(w, 0.46, KD), KM.dressed, cx + (f === nF ? s * 0.3 : 0), f * FH - 0.21, 0, { col: 0xa89888 });
    kput(new THREE.PlaneGeometry(w, 0.46), KM.dressed, cx + (f === nF ? s * 0.3 : 0), f * FH - 0.21, KD / 2 + 0.005, { col: 0x6a5a58, uv: 1.4 });
    kput(KBOX(w, 0.04, 0.05), KM.plain, cx + (f === nF ? s * 0.3 : 0), f * FH + 0.02, KD / 2 + 0.02, { col: 0xe8dcc4 });
  }
  // the roof: two slopes of slate over boards, cut open at the front; the back gable in stone
  const half = KW / 2 + 0.9, slope = Math.atan2(ROOF_H, half), L = Math.hypot(half, ROOF_H) + 0.3;
  for (const s of [-1, 1]) {
    const mx = s * half / 2, my = H + ROOF_H / 2;
    kput(KBOX(L, 0.16, KD + 1.0), KM.slate, mx + s * 0.12, my + 0.16, -0.1, { rz: -s * slope, col: 0xd0d4dc, uv: 2.2 });
    kput(KBOX(L, 0.14, KD + 0.9), KM.boards, mx, my, -0.1, { rz: -s * slope, col: 0x8a7058, uv: 1.6 });
  }
  kput(KBOX(0.5, 0.3, KD + 1.2), KM.wood, 0, H + ROOF_H + 0.12, -0.1, { col: 0x5a4030 });
  const gable = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, ROOF_H)]);
  const gg = new THREE.ExtrudeGeometry(gable, { depth: 0.7, bevelEnabled: false }); gg.translate(0, 0, -0.7);
  kput(gg, KM.stone, 0, H, Zb, { col: 0xb0a49a });
  // corner turrets with copper caps once the Keep has them; the sun beacon on the ridge at level 3
  if (lv >= 2) for (const s of [-1, 1]) {
    const x = s * (KW / 2 + 1.4), z = Zb + 0.6, th = H + ROOF_H * 0.8;
    kput(new THREE.CylinderGeometry(1.4, 1.5, th, 14), KM.stone, x, th / 2 - 0.4, z, { col: 0xc8bcb0 });
    kput(new THREE.CylinderGeometry(1.65, 1.65, 0.35, 14), KM.dressed, x, th - 0.4, z, { col: 0xb8aa98 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; kput(KBOX(0.5, 0.6, 0.4), KM.stone, x + Math.cos(a) * 1.5, th + 0.05, z + Math.sin(a) * 1.5, { ry: -a, col: 0xc8bcb0 }); }
    kput(new THREE.ConeGeometry(1.9, 2.8, 14), KM.slate, x, th + 1.6, z, { col: 0x7ab8a0, uv: 1.2 });
  }
  if (lv >= 3) {
    const by = H + ROOF_H + 0.3;
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) kput(KBOX(0.12, 2.6, 0.12), KM.brass, dx, by + 1.3, -0.1 + dz);
    kput(new THREE.TorusGeometry(1.05, 0.09, 6, 24), KM.brass, 0, by + 0.2, -0.1, { rx: Math.PI / 2 }); kput(new THREE.TorusGeometry(1.05, 0.07, 6, 24), KM.brass, 0, by + 2.6, -0.1, { rx: Math.PI / 2 });
    kput(new THREE.OctahedronGeometry(1, 0), KM.crystal, 0, by + 1.4, -0.1, { s: [0.6, 1.2, 0.6] });
    klight('beacon', 0, by + 1.4, 1.6, 8, [1.6, 1.0, 0.42]);
  }
  // the chimney, over the Hearth Hall's fire, and the outside lamp by the door
  kput(KBOX(1.3, 3.0, 1.1), KM.stone, -8.6, H + ROOF_H * 0.35 + 1.2, Zb + 0.4, { col: 0xb8aca0 });
  kput(KBOX(1.5, 0.25, 1.3), KM.dressed, -8.6, H + ROOF_H * 0.35 + 2.75, Zb + 0.4, { col: 0x9a8e86 });
  KEEPV.chimney = new THREE.Vector3(-8.6, H + ROOF_H * 0.35 + 3.0, Zb + 0.4);
  for (const s of [-1, 1]) { kput(KBOX(0.1, 1.0, 0.1), KM.iron, s * 1.55, 0.0 + 0.5 - 0.2, KD / 2 + 1.0, { col: 0x5a5a5a }); kput(KBOX(0.24, 0.3, 0.24), KM.glow, s * 1.55, 0.95, KD / 2 + 1.0, { col: new THREE.Color(1.6, 1.15, 0.6) }); kput(KBOX(0.3, 0.05, 0.3), KM.iron, s * 1.55, 1.12, KD / 2 + 1.0, { col: 0x4a4a4a }); }
  klight('porch', 0, 1.2, KD / 2 + 1.4, 4.0, [1.6, 1.05, 0.5]);
  // a few things outside, clear of the cut: barrels and a crate by the west wall, a bench by the east
  KR = { key: 'out', cx: 0, y0: 0 };
  kbarrel(-12.6, 1.0, 0.9); kbarrel(-12.4, 2.0, 0.8); kcrate(12.7, 0, 1.6, 0.7, { ry: 0.3 });
  kbench(12.6, -0.6, 1.6, { col: 0x8a6a50 });
  KR = null;
}

// ----------------------------------------------------------------- the stairwell: a switchback stair up the middle
function keepStair(nF) {
  const Zb = -KD / 2, W = SWD - 0.3, xa = -0.78, xb = 0.78, zf = 1.55, zr = -2.15, FW = 1.36;
  KR = { key: 'stair', cx: 0, y0: 0 };
  for (let f = 0; f < nF; f++) {
    const y = f * FH;
    // the partitions either side, with a doorway at the front onto the landing
    for (const s of [-1, 1]) {
      const x = s * SWD / 2;
      kput(KBOX(0.3, CH, zf - Zb), KM.dressed, x, y + CH / 2 + 0.02, (zf + Zb) / 2, { col: 0xc0b0a0, uv: 1.6 });
      kput(KBOX(0.3, 0.9, 0.2), KM.dressed, x, y + CH - 0.43, 2.95, { col: 0xc0b0a0, uv: 1.6 });
      kput(KBOX(0.3, CH - 2.55, 2.95 - zf), KM.dressed, x, y + 2.55 + (CH - 2.55) / 2 + 0.02, (zf + 2.95) / 2, { col: 0xc0b0a0, uv: 1.6 });
      kput(KBOX(0.3, CH, 0.26), KM.dressed, x, y + CH / 2 + 0.02, 3.07, { col: 0xc0b0a0, uv: 1.6 });
      // the door frame
      for (const z of [zf + 0.04, 2.91]) kput(KBOX(0.38, 2.55, 0.1), KM.wood, x, y + 1.3, z, { col: 0x5a4030 });
      kput(KBOX(0.4, 0.14, 2.95 - zf + 0.1), KM.wood, x, y + 2.57, (zf + 2.95) / 2, { col: 0x5a4030 });
    }
    // the back wall, a sconce, and a round window at the half landing
    kput(new THREE.PlaneGeometry(W, CH, 1, 6), KM.dressed, 0, y + CH / 2 + 0.02, Zb + 0.01, { col: 0xc8bca8, ao: [y, y + CH, 0.55, 0.7], uv: 1.6 });
    // the floor: flagstones on the ground floor, a landing strip at the front above it
    if (f === 0) kput(new THREE.PlaneGeometry(W, KD), KM.dressed, 0, 0.025, 0, { rx: -Math.PI / 2, col: 0xb0a090, uv: 1.4 });
    else {
      kput(KBOX(SWD, 0.46, KD / 2 - zf + 0.02), KM.dressed, 0, y - 0.21, (zf + KD / 2) / 2, { col: 0xa89888 });
      kput(new THREE.PlaneGeometry(W, KD / 2 - zf), KM.boards, 0, y + 0.025, (zf + KD / 2) / 2, { rx: -Math.PI / 2, col: 0xa88a6a, uv: 1.5 });
      kput(new THREE.PlaneGeometry(SWD, 0.46), KM.dressed, 0, y - 0.21, KD / 2 + 0.005, { col: 0x6a5a58, uv: 1.4 });
      kput(KBOX(SWD, 0.04, 0.05), KM.plain, 0, y + 0.02, KD / 2 + 0.02, { col: 0xe8dcc4 });
    }
    if (f < nF - 1) {
      // flight A (left) climbs away from you to the half landing; flight B (right) comes back up to the next floor
      const N = 12, run = (zf - zr) / N, rise = FH / 2 / N;
      for (const [x, up] of [[xa, 0], [xb, 1]]) {
        for (let k = 0; k < N; k++) {
          const t = up ? N - 1 - k : k, z = zf - (t + 0.5) * run, yy = y + (up ? FH / 2 : 0) + (k + 1) * rise;
          kput(KBOX(FW, 0.07, run + 0.04), KM.wood, x, yy - 0.035, z, { col: 0xa07a54 });
          kput(KBOX(FW, rise, 0.04), KM.wood, x, yy - rise / 2 - 0.03, up ? z - run / 2 : z + run / 2, { col: 0x6a4a34 });
        }
        // the soffit under the flight, and its stringers
        const ang = Math.atan2(FH / 2, zf - zr), len = Math.hypot(FH / 2, zf - zr), my = y + (up ? FH * 0.75 : FH * 0.25) - 0.12;
        kput(KBOX(FW, 0.2, len), KM.plaster, x, my - 0.06, (zf + zr) / 2, { rx: up ? -ang : ang, col: 0xd8ccb8 });
        for (const s of [-1, 1]) kput(KBOX(0.07, 0.34, len + 0.1), KM.wood, x + s * (FW / 2 + 0.03), my + 0.06, (zf + zr) / 2, { rx: up ? -ang : ang, col: 0x5a4030 });
      }
      // the half landing, and the handrail between the flights
      kput(KBOX(W, 0.25, Zb + 0.0 - zr + 0.95), KM.wood, 0, y + FH / 2 - 0.125, (zr + Zb) / 2 - 0.02, { col: 0x8a6a4a });
      const ang = Math.atan2(FH / 2, zf - zr), len = Math.hypot(FH / 2, zf - zr);
      kput(KBOX(0.07, 0.07, len), KM.wood, 0, y + FH * 0.25 + 0.95, (zf + zr) / 2, { rx: ang, col: 0x5a4030 });
      kput(KBOX(0.07, 0.07, len), KM.wood, 0, y + FH * 0.75 + 0.95, (zf + zr) / 2, { rx: -ang, col: 0x5a4030 });
      for (let k = 0; k <= 6; k++) { const t = k / 6, z = zf - t * (zf - zr); kput(KBOX(0.05, 0.95, 0.05), KM.wood, 0, y + t * FH / 2 + 0.5, z, { col: 0x6a4a34 }); kput(KBOX(0.05, 0.95, 0.05), KM.wood, 0.02, y + FH / 2 + (1 - t) * FH / 2 + 0.5, z, { col: 0x6a4a34 }); }
      kput(KBOX(0.12, FH + 1.0, 0.12), KM.wood, 0, y + FH / 2 + 0.4, zr - 0.05, { col: 0x4a3020 });
      koculusAt(0, y + FH / 2 + 1.35, 0.36);
      ksconceAt(-1.2, y + FH / 2 + 1.0);
    } else {
      // the top floor: a rail along the gallery, and the ladder up to the attic
      kput(KBOX(1.55, 0.07, 0.07), KM.wood, -0.78, y + 0.95, zf + 0.02, { col: 0x5a4030 });
      for (let k = 0; k < 5; k++) kput(KBOX(0.05, 0.95, 0.05), KM.wood, -1.5 + k * 0.36, y + 0.48, zf + 0.02, { col: 0x6a4a34 });
      for (const s of [-0.22, 0.22]) kput(KBOX(0.07, FH + 0.9, 0.07), KM.wood, -0.8 + s, y + (FH + 0.9) / 2, 2.75, { col: 0x8a6a4a });
      for (let yy = 0.3; yy < FH + 0.6; yy += 0.34) kput(KBOX(0.44, 0.045, 0.05), KM.wood, -0.8, y + yy, 2.75, { col: 0x8a6a4a });
      kput(new THREE.PlaneGeometry(W, zf - Zb), KM.boards, 0, y + 0.025 - 0.0, (zf + Zb) / 2, { rx: -Math.PI / 2, col: 0x5a4434, uv: 1.5 });
      kput(KBOX(SWD, 0.46, zf - Zb), KM.dressed, 0, y - 0.21, (zf + Zb) / 2, { col: 0xa89888 });
      koculusAt(0, y + 2.4, 0.42);
    }
    // a lantern over every landing
    KEEPX.lamps.push({ x: 0.0, y: y + CH - 0.02, z: 2.3, lv: 1, ph: Math.random() * TAU, lit: true, chain: 0.3 });
    klight('lamp', 0, y + CH - 1.6, 2.6, 4.8, [1.15, 0.78, 0.4], { room: 'stair' });
  }
  // the front door at the cut: a low stone sill and the stumps of the doorposts, a mat, coats on pegs inside
  kput(KBOX(2.6, 0.12, 0.5), KM.dressed, 0, 0.06, KD / 2 + 0.05, { col: 0xb8aa98 });
  for (const s of [-1, 1]) kput(KBOX(0.3, 0.55, 0.45), KM.dressed, s * 1.3, 0.28, KD / 2 + 0.05, { col: 0xb8aa98 });
  kput(new THREE.PlaneGeometry(1.4, 0.8), KM.cloth, 0, 0.035, KD / 2 - 0.6, { rx: -Math.PI / 2, col: 0x8a5a3a });
  kput(KBOX(0.06, 0.06, 1.0), KM.wood, 1.45, 1.75, -1.2, { col: 0x5a4030 });
  for (const [z, c] of [[-1.55, 0x5a6a4a], [-1.15, 0x7a3a2a], [-0.8, 0x3a4a6a]]) kput(KBOX(0.08, 0.9, 0.3), KM.cloth, 1.42, 1.25, z, { col: c });
  klight('door', 0, 1.4, KD / 2 - 0.4, 5.0, [1, 1, 1]);
  KR = null;
}
function koculusAt(x, y, r) { const k = KR; KR = { key: 'stair', cx: 0, y0: 0 }; koculus(x, y, r, { reach: 3.2 }); KR = k; }
function ksconceAt(x, y) { const k = KR; KR = { key: 'stair', cx: 0, y0: 0 }; ksconce(x, y); KR = k; }

// ----------------------------------------------------------------- a room's walls, floor and ceiling, by kind
const KWALL = {
  hearth: { mat: 'plaster', col: 0xf2dcb4, low: ['dressed', 0xb8a890, 1.05], floor: ['dressed', 0xa89880, 1.5], beams: 0x5a4030 },
  dorm: { mat: 'plaster', col: 0xf0e4cc, low: ['boards', 0xb89a74, 1.2], floor: ['boards', 0xc0a080, 1.6], beams: 0x6a4a34 },
  G: { mat: 'stone', col: 0xe0d4c4, floor: ['boards', 0xa88a68, 1.6], beams: 0x5a4030 },
  E: { mat: 'plaster', col: 0xd0dde8, low: ['wood', 0x8a6a50, 0.9], floor: ['boards', 0xb89878, 1.6], beams: 0x5a4434 },
  A: { mat: 'boards', col: 0xe8d4b4, floor: ['boards', 0xb08e6c, 1.6], beams: 0x4a3424 },
  R: { mat: 'plaster', col: 0xe4b8c4, low: ['wood', 0x6a4030, 1.0], floor: ['boards', 0x9a7458, 1.6], beams: 0x4a3020 },
  S: { mat: 'plaster', col: 0xcfe0b4, low: ['boards', 0x9a8a68, 0.9], floor: ['boards', 0xb09878, 1.6], beams: 0x5a4a34 },
  lookout: { mat: 'plaster', col: 0xd8d0ec, low: ['wood', 0x6a5040, 0.9], floor: ['boards', 0xa08870, 1.6], beams: 0x4a3a30 },
  empty: { mat: 'stone', col: 0xa89c94, floor: ['boards', 0x7a6858, 1.6], beams: 0x3a2c24 },
};
function roomShell(R) {
  const S = KWALL[R.kind] || KWALL.empty, Zb = -KD / 2, W = RH * 2, y0 = R.y0, out = R.side * (KW / 2);
  const ao = [y0, y0 + CH, 0.55, 0.62];
  kput(new THREE.PlaneGeometry(W, CH, 1, 8), KM[S.mat], R.cx, y0 + CH / 2, Zb + 0.005, { col: S.col, ao, uv: S.mat === 'stone' ? 2.2 : 2 });
  kput(new THREE.PlaneGeometry(KD, CH, 1, 8), KM[S.mat], out - R.side * 0.005, y0 + CH / 2, 0, { ry: -R.side * Math.PI / 2, col: new THREE.Color(S.col).multiplyScalar(0.92), ao, uv: S.mat === 'stone' ? 2.2 : 2 });
  kput(new THREE.PlaneGeometry(KD, CH, 1, 8), KM[S.mat], R.side * (SWD / 2 + 0.152), y0 + CH / 2, 0, { ry: R.side * Math.PI / 2, col: new THREE.Color(S.col).multiplyScalar(0.88), ao, uv: S.mat === 'stone' ? 2.2 : 2 });
  // a wainscot along the lower wall
  if (S.low) {
    const [m, c, h] = S.low;
    kput(KBOX(W, h, 0.05), KM[m], R.cx, y0 + h / 2, Zb + 0.03, { col: c, ao: [y0, y0 + 9, 0.6, 1], uv: m === 'boards' ? 1.6 : 2 });
    kput(KBOX(0.05, h, KD), KM[m], out - R.side * 0.03, y0 + h / 2, 0, { col: new THREE.Color(c).multiplyScalar(0.9), ao: [y0, y0 + 9, 0.6, 1], uv: m === 'boards' ? 1.6 : 2 });
    kput(KBOX(W, 0.07, 0.1), KM.wood, R.cx, y0 + h, Zb + 0.05, { col: 0x5a4030 });
  }
  // the floor, and the skirting
  const [fm, fc, fu] = S.floor;
  kput(new THREE.PlaneGeometry(W, KD), KM[fm], R.cx, y0 + 0.005, 0, { rx: -Math.PI / 2, col: fc, uv: fu });
  // the ceiling: boards with joists running back, and a beam along the back wall
  kput(new THREE.PlaneGeometry(W, KD), KM.boards, R.cx, y0 + CH - 0.005, 0, { rx: Math.PI / 2, col: 0x7a6250, uv: 1.6 });
  for (let i = 0; i < 6; i++) kput(KBOX(0.16, 0.22, KD), KM.wood, R.cx - RH + 0.6 + i * (W - 1.2) / 5, y0 + CH - 0.11, 0, { col: S.beams });
  kput(KBOX(W, 0.26, 0.22), KM.wood, R.cx, y0 + CH - 0.13, Zb + 0.11, { col: S.beams });
  // posts at the corners of the back wall
  for (const s of [-1, 1]) kput(KBOX(0.2, CH, 0.2), KM.wood, R.cx + s * (RH - 0.1), y0 + CH / 2, Zb + 0.1, { col: S.beams });
}

// ----------------------------------------------------------------- furnishing each kind of room
// Each furnishes its room for its level (KT marks the pieces a level adds, so a new level can be fitted out in front
// of you) and adds the places people use: study seats, table seats, beds, favourite spots (keeplife.js).
// u runs across the room from its middle; R.ou is +1 where the outer wall is at +u (the door is on the other side).
function kspot(use, u, y, z, o = {}) {
  const s = { room: KR.key, kind: KR.kind, use, p: new THREE.Vector3(kx(u), ky(y), z), face: o.face ?? 0, pose: o.pose || 'stand', sink: o.sink || 0, i: o.i ?? 0, who: o.who || null, climb: o.climb || null, lie: o.lie || 0, bed: o.bed || null, work: !!o.work, cat: !!o.cat };
  KEEPV.spots.push(s); return s;
}
// a bed in the beds list, with a place to lie in it
function kbed(b, order, o = {}) {
  const bed = { x: b.x, y: b.y, z: b.z, L: b.L || 1.9, order, room: KR.key, owner: null, dir: o.dir || 1 };
  KEEPV.beds.push(bed);
  const s = kspot('sleep', 0, 0, b.z, { pose: 'lie' }); s.p.set(b.x + bed.dir * (bed.L / 2 - 0.12), b.y, b.z + 0.12); s.bed = bed; s.lie = bed.dir;
  return bed;
}
const FACE = { cam: 0, right: Math.PI / 2, left: -Math.PI / 2, back: Math.PI };
const KFURN = {
  // ----- the Hearth Hall: the great fire, the long table, supper
  hearth(R, Rn) {
    const lv = R.level, Zb = -KD / 2, fu = -2.55;
    // the fireplace: hearthstone, jambs, a dark firebox, the mantel, a hood up to the ceiling
    kbox(3.3, 0.18, 1.4, KM.dressed, fu, 0.09, Zb + 0.7, { col: 0xa89888, uv: 1.2 });
    for (const s of [-1, 1]) { kbox(0.55, 2.25, 1.0, KM.dressed, fu + s * 1.33, 1.12, Zb + 0.5, { col: 0xc8b8a4, uv: 1.2 }); kbox(0.05, 1.7, 0.85, KM.plain, fu + s * 1.03, 1.0, Zb + 0.5, { col: 0x2a1c1a }); }
    kbox(2.1, 1.85, 0.05, KM.plain, fu, 1.0, Zb + 0.04, { col: 0x1a1012 });
    kbox(2.1, 0.06, 0.95, KM.plain, fu, 1.92, Zb + 0.48, { col: 0x2a1c1a });
    kbox(3.5, 0.34, 1.18, KM.wood, fu, 2.4, Zb + 0.6, { col: 0x5a3c2a });
    kbox(3.0, CH - 2.57, 0.9, lv >= 3 ? KM.dressed : KM.plaster, fu, 2.57 + (CH - 2.57) / 2, Zb + 0.45, { col: lv >= 3 ? 0xc8b8a4 : 0xe8d0a8, ao: [R.y0 + 2.5, R.y0 + CH, 0.7, 0.65] });
    // the fire: logs on firedogs, embers, flames, and its light
    for (const s of [-1, 1]) { kbox(0.06, 0.32, 0.5, KM.iron, fu + s * 0.55, 0.34, Zb + 0.62, { col: 0x5a5a5a }); kbox(0.08, 0.08, 0.08, KM.brass, fu + s * 0.55, 0.52, Zb + 0.88); }
    for (const [dx, dy, dz, r] of [[-0.05, 0.36, 0.55, 0.1], [0.1, 0.36, 0.7, 0.11], [0.02, 0.52, 0.62, 0.09]]) kcyl(r, r, 1.15, KM.wood, fu + dx, dy, Zb + dz, { rz: Math.PI / 2, ry: dx * 2, col: 0x4a3020, seg: 8 });
    for (let i = 0; i < 9; i++) kput(new THREE.DodecahedronGeometry(0.06 + Rn() * 0.05, 0), KM.glow, kx(fu + (Rn() - 0.5) * 1.0), ky(0.24), Zb + 0.5 + Rn() * 0.4, { col: new THREE.Color(1.8, 0.55 + Rn() * 0.3, 0.12) });
    for (let i = 0; i < 4; i++) kflame(kx(fu - 0.45 + i * 0.3), ky(0.3), Zb + 0.62 + (i % 2) * 0.1, 0.42, 0.85 + Rn() * 0.35, Rn());
    klight('fire', kx(fu), ky(0.9), Zb + 1.8, 6.5, [1.9, 0.82, 0.28]);
    KEEPX.embers.push(new THREE.Vector3(kx(fu), ky(0.6), Zb + 0.6));
    // the crane and the cook pot over the fire, steaming
    kbox(0.06, 1.7, 0.06, KM.iron, fu + 0.92, 1.0, Zb + 0.42, { col: 0x4a4a4a }); kbox(0.95, 0.05, 0.05, KM.iron, fu + 0.47, 1.78, Zb + 0.6, { col: 0x4a4a4a, ry: -0.35 });
    kbox(0.03, 0.42, 0.03, KM.iron, fu + 0.05, 1.55, Zb + 0.75, { col: 0x3a3a3a });
    ksph(0.3, KM.iron, fu + 0.05, 1.08, Zb + 0.75, { s: [1, 0.85, 1], col: 0x3a3a3c }); kput(new THREE.TorusGeometry(0.27, 0.035, 6, 16), KM.iron, kx(fu + 0.05), ky(1.3), Zb + 0.75, { rx: Math.PI / 2, col: 0x2a2a2a });
    KEEPX.steam.push(new THREE.Vector3(kx(fu + 0.05), ky(1.36), Zb + 0.75));
    // on the mantel: candlesticks, plates, and a clock at level 2
    kcandle(fu - 1.4, 2.57, Zb + 0.75, { light: lv >= 2 }); kcandle(fu + 1.4, 2.57, Zb + 0.75);
    for (const dx of [-0.8, -0.45, 0.6]) kcyl(0.17, 0.17, 0.025, KM.plain, fu + dx, 2.76, Zb + 0.35, { rx: Math.PI / 2 - 0.25, col: 0xf0e8d4, seg: 14 });
    if (lv >= 2) { kbox(0.42, 0.55, 0.22, KM.wood, fu + 0.05, 2.85, Zb + 0.6, { col: 0x6a4030 }); kquad(0.32, 0.32, KM.sign, SIGN_R.clock, fu + 0.05, 2.92, Zb + 0.72); }
    if (lv >= 3) { kquad(0.9, 0.9, KM.sign, SIGN_R.crest, fu, 3.3, Zb + 0.91); for (const s of [-1, 1]) kbox(0.05, 1.6, 0.05, KM.wood, fu + s * 0.2, 3.25, Zb + 0.93, { col: 0x8a6a4a, rz: s * 0.7 }); }
    // the log basket and the bellows
    kcyl(0.3, 0.26, 0.38, KM.wood, fu - 1.4, 0.19, Zb + 1.45, { col: 0xb89a68, seg: 10 }); for (let i = 0; i < 4; i++) kcyl(0.07, 0.07, 0.6, KM.wood, fu - 1.4 + (i - 1.5) * 0.12, 0.43, Zb + 1.45, { rx: Math.PI / 2, col: 0x6a4a30, seg: 6 });
    kbox(0.04, 0.9, 0.04, KM.iron, fu + 1.75, 0.5, Zb + 1.05, { rz: 0.12, col: 0x4a4a4a });
    // the window, the banner, the notice board with the journal's goals
    kwin(0.15, 1.35, 1.05, 1.65, { frame: 0x5a3c2a });
    if (lv === 1) kbanner(1.75, 2.75, 0.55, 1.1, 'pennant'); else kbanner(1.75, 2.55, 0.85, 1.6, 'bSun');
    kbox(1.75, 1.32, 0.08, KM.wood, 3.1, 1.85, Zb + 0.05, { col: 0x5a3c2a }); kquad(1.6, 1.2, KM.sign, SIGN_R.nb, 3.1, 1.85, Zb + 0.1);
    if (lv >= 3) { kbanner(-4.0, 2.55, 0.7, 1.4, 'bLens', { z: Zb }); }
    // the long table, its benches, and supper laid
    const tw = lv >= 2 ? 4.5 : 3.4, tu = lv >= 2 ? 1.25 : 1.2, tz = -0.55, n = lv >= 2 ? 5 : 4;
    ktable(tu, tz, tw, 1.05, 0.84, { trestle: lv === 1, col: lv >= 3 ? 0x9a6a48 : 0xb08a64, skirt: lv === 1 ? 0xd8ccb0 : lv === 2 ? 0xc8d4c0 : 0xe8dcc8 });
    if (lv >= 2) for (let i = 0; i < 3; i++) kbox(0.35, 0.02, 1.12, KM.cloth, tu - tw / 2 + 0.6 + i * (tw - 1.2) / 2, 0.86, tz, { col: lv >= 3 ? 0x7a2a3a : 0x5a7a9a });
    kbench(tu, tz - 0.78, tw - 0.2); kbench(tu, tz + 0.78, tw - 0.2);
    for (let i = 0; i < n; i++) {
      const u = tu - tw / 2 + 0.5 + i * (tw - 1.0) / (n - 1);
      kcyl(0.13, 0.09, 0.07, KM.plain, u, 0.88, tz - 0.25, { col: 0xe8dcc4, seg: 10 }); kcyl(0.05, 0.05, 0.13, KM.plain, u + 0.2, 0.9, tz - 0.12, { col: lv >= 2 ? 0x9a9aa0 : 0x8a6a4a, seg: 8 });
      kspot('eat', u, 0, tz - 0.78, { pose: 'sit', sink: 0.38, i, face: FACE.cam });
      if (i % 2 === 0) { kcyl(0.13, 0.09, 0.07, KM.plain, u + 0.3, 0.88, tz + 0.25, { col: 0xe8dcc4, seg: 10 }); kspot('eat', u + 0.3, 0, tz + 0.78, { pose: 'sit', sink: 0.38, i: 10 + i, face: FACE.back }); }
    }
    ksph(0.18, KM.plain, tu - 0.3, 0.92, tz + 0.05, { s: [1.5, 0.7, 1], col: 0xc8904a }); kcyl(0.09, 0.12, 0.28, KM.plain, tu + 0.5, 0.98, tz + 0.1, { col: 0xb8b0a0, seg: 10 });
    kcandle(tu + 1.2, 0.84, tz, { light: true, r: 2.4 });
    // stools by the fire for warming, and the cook's place at the pot
    kstool(fu - 1.15, -0.95); kstool(fu + 1.35, -0.95);
    kspot('fire', fu - 1.15, 0, -0.95, { pose: 'sit', sink: 0.32, face: FACE.right }); kspot('fire', fu + 1.35, 0, -0.95, { pose: 'sit', sink: 0.32, face: FACE.left });
    kspot('cook', fu + 0.9, 0, Zb + 1.55, { face: FACE.left, work: true });
    kspot('rest', fu + 0.2, 0, -1.25, { face: FACE.back });
    // herbs drying over the fire
    kbox(3.2, 0.05, 0.05, KM.wood, fu, CH - 0.55, -1.2, { col: 0x5a4030 });
    for (let i = 0; i < 7; i++) { kbox(0.015, 0.25, 0.015, KM.plain, fu - 1.4 + i * 0.47, CH - 0.68, -1.2, { col: 0xb59a70 }); kplant(fu - 1.4 + i * 0.47, CH - 1.32, -1.2, i % 3 === 2 ? 2 : 1, 0.55, { flip: true, col: i % 2 ? 0xc8d0a0 : 0xffffff }); }
    // barrels and sacks in the outer corner, a dresser by the door at level 2, a rug before the fire
    const o = R.ou;
    kbarrel(-o * 3.85, 0.95, 0.9); kbarrel(-o * 3.3, 1.2, 0.8, { col: 0x8a5a3a }); kbox(0.5, 0.5, 0.45, KM.cloth, -o * 3.9, 0.25, 0.25, { col: 0xd8c8a0, ry: 0.4 });
    // a woodpile in the outer corner, and the cat's basket by the fire
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) kcyl(0.09, 0.09, 0.7, KM.wood, o * 3.95 - o * (i * 0.19 + r * 0.095), 0.1 + r * 0.16, 1.45, { rx: Math.PI / 2, col: [0x7a5434, 0x8a6440, 0x6a4a30][(i + r) % 3], seg: 7 });
    kput(new THREE.TorusGeometry(0.28, 0.08, 6, 14), KM.wood, kx(fu - 0.75), ky(0.08), -0.35, { rx: Math.PI / 2, col: 0xb89a68 }); kcyl(0.26, 0.26, 0.06, KM.cloth, fu - 0.75, 0.05, -0.35, { col: 0x9a4a4a, seg: 12 });
    kspot('fire', fu - 0.75, 0.06, -0.35, { face: FACE.cam, cat: true });
    if (lv >= 2) {
      KT = 2;
      // a plate rack on the wall, with jugs
      kbox(1.6, 0.06, 0.28, KM.wood, 3.1, 2.95, Zb + 0.14, { col: 0x5a3c2a }); kbox(1.6, 0.06, 0.28, KM.wood, 3.1, 3.4, Zb + 0.14, { col: 0x5a3c2a });
      for (let i = 0; i < 5; i++) kcyl(0.13, 0.13, 0.02, KM.plain, 2.5 + i * 0.3, 3.12, Zb + 0.1, { rx: Math.PI / 2 - 0.2, col: 0xefe6d0, seg: 14 });
      for (let i = 0; i < 4; i++) kcyl(0.07, 0.09, 0.22, KM.plain, 2.55 + i * 0.4, 3.54, Zb + 0.14, { col: [0x8a5a3a, 0x5a6a8a, 0xb88a4a, 0x6a7a5a][i], seg: 8 });
      krug(fu, -0.6, 2.8, 1.3, 0x8a3a3a, 0xc89a4a, { stripes: true });
      kbox(0.6, 0.6, 0.5, KM.wood, o * 3.0, 0.3, 0.5, { col: 0x8a6a4a }); kcyl(0.12, 0.1, 0.25, KM.plain, o * 3.0, 0.72, 0.5, { col: 0x8a5a3a, seg: 8 });
      klamp(tu - 1.2, tz); klamp(tu + 1.2, tz);
    } else klamp(tu, tz);
    if (lv >= 3) {
      KT = 3;
      // a brass chandelier over the table, and a high-backed chair at the fire for whoever likes it best
      karmchair(o * 3.35, 0.55, -o * 0.6, 0x6a2a3a);
      kspot('fav', o * 3.35, 0, 0.5, { pose: 'sit', sink: 0.3, face: FACE.cam, i: 1 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; kcandle(tu + Math.cos(a) * 0.55, CH - 1.35, tz + Math.sin(a) * 0.35, { bare: true, h: 0.12 }); }
      kput(new THREE.TorusGeometry(0.6, 0.035, 6, 24), KM.brass, kx(tu), ky(CH - 1.35), tz, { rx: Math.PI / 2, s: [1, 0.62, 1] });
      for (const s of [-1, 1]) kbox(0.02, 1.3, 0.02, KM.iron, tu + s * 0.4, CH - 0.68, tz, { col: 0x3a3a3a });
      klight('candle', kx(tu), ky(CH - 1.6), tz + 0.6, 4.5, [0.9, 0.58, 0.28]);
      kframe(-o * 3.4, 2.95, 0.9, 0.72, 'paint1', { z: Zb });
    } else kspot('fav', fu - 1.15, 0, -0.95, { pose: 'sit', sink: 0.32, face: FACE.right, i: 1 });
  },
  // ----- the Dormitory: bunks with everyone's quilts, chests, a washstand, windows that show the hour
  dorm(R, Rn) {
    const lv = R.level, Zb = -KD / 2, o = R.ou;
    const bunks = [-2.85, 0, 2.85];
    bunks.forEach((u, k) => {
      const beds = kbunk(u, Zb + 0.55, { brass: lv >= 3, col: 0x8a6448 });
      beds.forEach((b, j) => kbed(b, k * 2 + j, { dir: 1 }));
      // a chest at the foot
      kbox(0.95, 0.5, 0.5, KM.wood, u - 0.2, 0.25, Zb + 1.45, { col: [0x7a5434, 0x6a4a30, 0x8a6440][k], uv: 1 }); kbox(0.97, 0.05, 0.52, KM.brass, u - 0.2, 0.5, Zb + 1.45); kbox(0.08, 0.12, 0.03, KM.brass, u - 0.2, 0.4, Zb + 1.71);
      if (lv >= 2) { KT = 2; kbox(0.05, 2.7, 0.9, KM.cloth, u - 1.07, 1.45, Zb + 0.55, { col: [0x6a7a9a, 0x9a6a5a, 0x6a8a6a][k] }); KT = 1; }
    });
    for (const u of [-1.425, 1.425]) kwin(u, 1.1, 0.5, 1.85, { cols: 1, rows: 3, reach: 2.4, r: 4 });
    // the washstand, a mirror and a towel, by the outer wall
    ktable(o * 3.9, 0.2, 0.6, 0.55, 0.85, { col: 0x8a6448 }); kcyl(0.22, 0.14, 0.12, KM.plain, o * 3.9, 0.92, 0.2, { col: 0xe8eef0, seg: 14 }); kcyl(0.07, 0.1, 0.3, KM.plain, o * 3.75, 1.02, 0.38, { col: 0xd8e0e8, seg: 10 });
    kplane(0.5, 0.65, KM.glass, o * 4.4, 1.6, 0.2, { ry: -o * Math.PI / 2, col: 0xe8f4f8 }); kbox(0.04, 0.75, 0.6, KM.wood, o * 4.42, 1.6, 0.2, { col: 0x6a4a34 });
    kbox(0.04, 0.5, 0.35, KM.cloth, o * 4.35, 1.0, -0.3, { col: 0xe8e0d0 });
    kspot('rest', o * 3.3, 0, 0.2, { face: o > 0 ? FACE.right : FACE.left });
    // a basket of washing, and slippers by the bunks
    kcyl(0.3, 0.24, 0.36, KM.wood, o * 2.6, 0.18, 1.45, { col: 0xb89a68, seg: 10 }); ksph(0.26, KM.cloth, o * 2.6, 0.36, 1.45, { s: [1, 0.4, 1], col: 0xe8e0d0 });
    for (const u of [-2.85, 0, 2.85]) for (const s of [-1, 1]) kbox(0.1, 0.05, 0.22, KM.cloth, u + 0.5 + s * 0.07, 0.025, Zb + 1.85, { col: 0x7a4a3a });
    // pegs with coats, hats and a satchel by the door
    kbox(0.05, 0.06, 1.6, KM.wood, -o * 4.38, 1.75, 0.2, { col: 0x5a4030 });
    for (const [z, c] of [[-0.4, 0x4a5a6a], [0.1, 0x7a5a3a], [0.6, 0x6a3a4a]]) kbox(0.1, 0.85, 0.32, KM.cloth, -o * 4.33, 1.3, z - 0.2, { col: c });
    klamp(0, -0.6, { lv: 1 });
    if (lv >= 2) {
      KT = 2;
      krug(0, -0.9, 6.2, 1.1, 0x6a7a9a, 0xd8c8a0, { stripes: true });
      kcandle(o * 4.0, 0.84, 0.4); klamp(o * 2.6, 0.3, { lv: 2 });
    }
    if (lv >= 3) {
      KT = 3;
      // a stove in the outer corner, and pictures over the windows
      kcyl(0.35, 0.38, 0.9, KM.iron, o * 3.8, 0.45, 1.4, { col: 0x3a3a3c, seg: 12 }); kcyl(0.08, 0.08, CH - 0.9, KM.iron, o * 3.8, 0.9 + (CH - 0.9) / 2, 1.4, { col: 0x3a3a3c, seg: 8 });
      kbox(0.3, 0.18, 0.05, KM.glow, o * 3.8, 0.45, 1.75, { col: new THREE.Color(1.6, 0.6, 0.2) }); klight('fire', kx(o * 3.8), ky(0.6), 2.2, 3.2, [1.4, 0.6, 0.25]);
      kframe(-1.425, 3.4, 0.55, 0.42, 'paint2'); kframe(1.425, 3.4, 0.55, 0.42, 'paint1');
    }
    kspot('fire', 0, 0, -1.7, { face: FACE.cam, cat: true });
  },
  // ----- Grit: a training yard. Dummies, weights, a sparring ring, a heavy bag.
  G(R, Rn) {
    const lv = R.level, Zb = -KD / 2, o = R.ou, d = -o;
    // the sand of the ring, and its ropes from level 2
    kbox(3.6, 0.04, 2.6, KM.dressed, 0.2, 0.02, -0.75, { col: 0xc8b08a, uv: 0.9 });
    if (lv === 1) kput(new THREE.RingGeometry(1.0, 1.06, 28), KM.plain, kx(0.2), ky(0.045), -0.75, { rx: -Math.PI / 2, col: 0xa8a090 });
    // two dummies at the outer end, the weapon rack on the back wall, the window
    kdummy(o * 3.55, -2.15, { target: true }); kdummy(o * 3.55, 0.05);
    kspot('student', o * 2.75, 0, -2.15, { i: 0, face: o > 0 ? FACE.right : FACE.left, work: true });
    for (let i = 0; i < 4; i++) { kcyl(0.035, 0.04, 2.4, KM.wood, d * 3.9 + d * -0.25 * i, 1.2, Zb + 0.25, { rz: d * 0.07, col: 0x8a6a4a, seg: 6 }); kput(new THREE.ConeGeometry(0.06, 0.2, 6), KM.iron, kx(d * 3.9 - d * 0.25 * i + d * 0.08), ky(2.45), Zb + 0.25, { col: 0x7a7a7a }); }
    kbox(1.2, 0.08, 0.2, KM.wood, d * 3.55, 1.6, Zb + 0.12, { col: 0x5a4030 }); kbox(1.2, 0.08, 0.2, KM.wood, d * 3.55, 0.35, Zb + 0.12, { col: 0x5a4030 });
    kwin(-0.6 * o, 1.35, 1.1, 1.6, {});
    // sparring in the ring, the tutor calling the drill behind it
    kspot('student', -0.55, 0, -0.6, { i: 1, face: FACE.right, work: true }); kspot('student', 0.95, 0, -0.6, { i: 2, face: FACE.left, work: true });
    kspot('tutor', 0.2, 0, -2.45, { face: FACE.cam, work: true });
    // the heavy bag on the door side, swinging when someone works it
    kbox(0.12, 0.12, 2.0, KM.wood, d * 2.65, CH - 0.35, -1.6, { col: 0x4a3424 });
    KEEPV.dyn.push(kdyn('bag', kx(d * 2.65), ky(CH - 0.4), -1.6, () => { kbox(0.03, 0.9, 0.03, KM.plain, d * 2.65, CH - 0.85, -1.6, { col: 0xb59a70 }); kcyl(0.28, 0.28, 1.05, KM.cloth, d * 2.65, CH - 1.85, -1.6, { col: 0x8a3a2a, seg: 12 }); kcyl(0.29, 0.29, 0.06, KM.plain, d * 2.65, CH - 1.35, -1.6, { col: 0x4a3020, seg: 12 }); }, { axis: 'x', amp: 0.18, speed: 3.2, room: R.key, student: 3 }));
    kspot('student', d * 1.8, 0, -1.6, { i: 3, face: d > 0 ? FACE.right : FACE.left, work: true });
    // weights by the door: a rack of iron and a few kettlebells
    kbox(1.3, 0.08, 0.5, KM.wood, d * 3.4, 0.5, 0.65, { col: 0x5a4030 }); for (const s of [-1, 1]) kbox(0.08, 0.5, 0.5, KM.wood, d * 3.4 + s * 0.6, 0.25, 0.65, { col: 0x5a4030 });
    for (let i = 0; i < 3; i++) kcyl(0.16 + i * 0.04, 0.16 + i * 0.04, 0.1, KM.iron, d * 3.0 + d * 0.38 * i, 0.72, 0.65, { rx: Math.PI / 2, col: 0x4a4a4a, seg: 12 });
    for (let i = 0; i < 2; i++) { ksph(0.15, KM.iron, d * 2.6 + d * 0.4 * i, 0.15, 1.25, { col: 0x3a3a3a }); kput(new THREE.TorusGeometry(0.08, 0.025, 5, 10, Math.PI), KM.iron, kx(d * 2.6 + d * 0.4 * i), ky(0.28), 1.25, { col: 0x3a3a3a }); }
    kshade(d * 3.4, 0.65, 1.6, 0.8);
    kspot('fav', d * 3.4, 0, 1.25, { face: FACE.cam, i: 1 });
    // a bench by the outer wall with a towel and a bucket of water
    kbench(o * 3.45, 1.4, 1.3, { col: 0x7a5a40 }); kbox(0.4, 0.05, 0.3, KM.cloth, o * 3.2, 0.5, 1.4, { col: 0xe8e0d0 }); kcyl(0.16, 0.13, 0.3, KM.wood, o * 3.9, 0.15, 0.9, { col: 0x8a6a4a, seg: 10 }); kcyl(0.14, 0.14, 0.01, KM.plain, o * 3.9, 0.29, 0.9, { col: 0x4a6a7a, seg: 10 });
    klamp(0.2, -0.8, { lv });
    if (lv >= 2) {
      KT = 2;
      for (const [a, b] of [[-1.55, -2.0], [1.95, -2.0], [-1.55, 0.5], [1.95, 0.5]]) { kbox(0.12, 1.15, 0.12, KM.wood, a, 0.58, b, { col: 0x6a4a34 }); kbox(0.16, 0.12, 0.16, KM.cloth, a, 1.18, b, { col: 0xc03a2a }); }
      for (const y of [0.55, 0.95]) { kbox(3.5, 0.03, 0.03, KM.plain, 0.2, y, -2.0, { col: 0xd8c8a0 }); kbox(3.5, 0.03, 0.03, KM.plain, 0.2, y, 0.5, { col: 0xd8c8a0 }); kbox(0.03, 0.03, 2.5, KM.plain, -1.55, y, -0.75, { col: 0xd8c8a0 }); kbox(0.03, 0.03, 2.5, KM.plain, 1.95, y, -0.75, { col: 0xd8c8a0 }); }
      kframe(o * 2.25, 2.3, 1.2, 0.9, 'tally'); klamp(d * 2.2, 0.2, { lv });
    }
    if (lv >= 3) {
      KT = 3;
      kdummy(o * 3.7, -1.05);
      for (const s of [-1, 1]) { kcyl(0.3, 0.3, 0.06, KM.brass, o * 2.25 + s * 0.45, 3.3, Zb + 0.06, { rx: Math.PI / 2, seg: 16, col: 0xb89860 }); kcyl(0.13, 0.13, 0.08, KM.plain, o * 2.25 + s * 0.45, 3.3, Zb + 0.09, { rx: Math.PI / 2, col: s > 0 ? 0x5a2a52 : 0x2f5a48, seg: 12 }); }
      kbanner(o * 0.65, 2.45, 0.5, 1.1, 'pennant');
    }
  },
  // ----- Engineering: the Drafting Loft. Tables, a brass orrery, a workbench, pencil shavings.
  E(R, Rn) {
    const lv = R.level, Zb = -KD / 2, o = R.ou, d = -o;
    // two drafting tables, students side-on at them (the door side's back corner keeps the rolled plans)
    for (const [k, u] of [[0, d * 3.45], [1, d * 0.0]]) {
      kbox(0.08, 0.95, 0.08, KM.wood, u - 0.5, 0.48, -1.6, { col: 0x5a4030 }); kbox(0.08, 0.95, 0.08, KM.wood, u + 0.5, 0.48, -1.6, { col: 0x5a4030 }); kbox(1.1, 0.06, 0.6, KM.wood, u, 0.3, -1.6, { col: 0x5a4030 });
      kbox(1.25, 0.05, 0.85, KM.wood, u, 1.02, -1.6, { rx: 0.42, col: 0xc8a878 });
      kbox(1.0, 0.012, 0.65, KM.plain, u, 1.055, -1.58, { rx: 0.42, col: k ? 0xd8d0bc : 0x5a7aa8 });
      kbox(0.6, 0.02, 0.03, KM.plain, u + 0.1, 1.08, -1.57, { rx: 0.42, rz: 0.4, col: 0x2a2a2a });
      kshade(u, -1.6, 1.6, 1.2);
      kspot('student', u - d * 0.95, 0, -1.6, { i: k, face: d > 0 ? FACE.right : FACE.left, work: true });
      for (let i = 0; i < 6; i++) kput(new THREE.ConeGeometry(0.03, 0.05, 5), KM.plain, kx(u - d * 0.5 + (Rn() - 0.5) * 1.2), ky(0.02), -1.1 + (Rn() - 0.5) * 0.8, { rx: Math.PI / 2, rz: Rn() * 6, col: 0xd8b888 });
      kstool(u - d * 0.95, -0.85, { col: 0x8a6a4a });
    }
    // the chalkboard between them on the back wall, the tutor at it
    kbox(1.6, 1.25, 0.06, KM.wood, d * 1.15, 2.05, Zb + 0.05, { col: 0x5a3c2a }); kquad(1.46, 1.1, KM.sign, SIGN_R.chalk, d * 1.15, 2.05, Zb + 0.09);
    kbox(1.5, 0.05, 0.12, KM.wood, d * 1.15, 1.4, Zb + 0.1, { col: 0x5a3c2a }); for (let i = 0; i < 3; i++) kbox(0.08, 0.025, 0.025, KM.plain, d * (0.75 + i * 0.3), 1.44, Zb + 0.12, { col: 0xf0f0e8 });
    kspot('tutor', d * 1.0, 0, Zb + 0.6, { face: FACE.cam, work: true });
    // the workbench on the outer half: a vice, gears, tools on the wall, blueprints pinned up
    const wu = o * 2.55;
    ktable(wu, Zb + 0.5, 1.9, 0.75, 0.88, { col: 0x9a7650 });
    kbox(0.2, 0.18, 0.2, KM.iron, wu - 0.6, 1.0, Zb + 0.35, { col: 0x4a4a4a }); for (let i = 0; i < 3; i++) kput(new THREE.TorusGeometry(0.1 + i * 0.03, 0.03, 4, 10), KM.brass, kx(wu + i * 0.25), ky(0.9), Zb + 0.55 + i * 0.05, { rx: Math.PI / 2 });
    kbox(1.6, 0.9, 0.04, KM.wood, wu, 1.85, Zb + 0.04, { col: 0x8a6a4a }); for (let i = 0; i < 5; i++) kbox(0.04, 0.4, 0.04, KM.iron, wu - 0.6 + i * 0.3, 1.85, Zb + 0.09, { col: 0x6a6a6a, rz: (i % 2 - 0.5) * 0.4 });
    kquad(0.95, 0.72, KM.sign, SIGN_R.blue, wu - 0.2, 2.85, Zb + 0.06, { rz: 0.03 }); kquad(0.7, 0.55, KM.sign, SIGN_R.blue, wu + 0.75, 2.75, Zb + 0.07, { rz: -0.05 });
    kspot('student', o * 3.85, 0, Zb + 0.75, { i: 2, face: o > 0 ? FACE.left : FACE.right, work: true });
    // the orrery: a brass sun on a pedestal, its rings turning
    const ou = o * 2.0, oz = 0.35;
    kcyl(0.3, 0.38, 0.9, KM.wood, ou, 0.45, oz, { col: 0x5a3c2a, seg: 10 }); kcyl(0.06, 0.06, 0.6, KM.brass, ou, 1.2, oz, { seg: 8 }); ksph(0.2, KM.crystal, ou, 1.55, oz, { col: 0xffe0a0 });
    KEEPV.dyn.push(kdyn('spin', kx(ou), ky(1.55), oz, () => {
      for (const [r, t, c] of [[0.5, 0.0, KM.plain], [0.75, 1.3, KM.crystal], [1.0, 2.6, KM.plain]]) { kput(new THREE.TorusGeometry(r, 0.02, 4, 36), KM.brass, kx(ou), ky(1.55), oz, { rx: Math.PI / 2 + 0.15 }); ksph(0.08 + r * 0.05, c === KM.crystal ? KM.crystal : KM.plain, ou + Math.cos(t) * r, 1.55 + Math.sin(t) * r * 0.15, oz + Math.sin(t) * r, { col: [0x6a8ab8, 0xffc070, 0xc06a4a][Math.round(r * 2) % 3] }); }
    }, { axis: 'y', speed: 0.35, room: R.key }));
    kshade(ou, oz, 1.0, 1.0);
    kspot('student', ou + o * 1.25, 0, oz, { i: 3, face: o > 0 ? FACE.left : FACE.right, work: true });
    // rolled plans on a shelf by the door, the window over the workbench's end
    kbox(1.3, 0.05, 0.35, KM.wood, d * 3.6, 2.6, Zb + 0.18, { col: 0x6a4a34 }); for (let i = 0; i < 6; i++) kcyl(0.06, 0.06, 0.6, KM.plain, d * 3.6 + (i - 2.5) * 0.17, 2.68 + (i % 2) * 0.1, Zb + 0.2, { rz: Math.PI / 2, ry: Math.PI / 2, col: i % 2 ? 0xe0d6bc : 0x8aa0c0, seg: 8 });
    kwin(o * 0.75, 1.45, 0.9, 1.5, {});
    kspot('fav', wu, 0, Zb + 1.2, { face: FACE.back, work: true, i: 1 });
    // crates of parts by the door, a few cogs spilled on the floor
    kcrate(d * 3.85, 0, 0.75, 0.55, { ry: 0.3 }); kcrate(d * 3.8, 0.55, 0.78, 0.4, { ry: -0.2 }); for (let i = 0; i < 4; i++) kput(new THREE.TorusGeometry(0.06, 0.02, 4, 8), KM.brass, kx(d * (3.2 + Rn() * 0.5)), ky(0.02), 1.0 + Rn() * 0.4, { rx: Math.PI / 2 });
    klamp(d * 2.0, -1.4, { lv });
    if (lv >= 2) {
      KT = 2;
      kshelfUnit(d * 3.95, 0.3, 0.7, 1.9, 4, Rn, 'jars', { d: 0.4, col: 0x6a4a34 });
      klamp(o * 2.0, -0.6, { lv });
      krug(o * 2.2, 0.55, 2.4, 1.1, 0x3a5a7a, 0xc8a860);
      kframe(o * 0.9, 3.0, 0.7, 0.55, 'paint2');
    }
    if (lv >= 3) {
      KT = 3;
      // a calculating engine: a brass cabinet of wheels and a crank; a lamp shade of brass over the tables
      const cu = d * 2.35;
      kbox(0.9, 1.0, 0.45, KM.brass, cu, 0.5, Zb + 0.3, { col: 0xb89860 });
      for (let i = 0; i < 3; i++) kcyl(0.12, 0.12, 0.05, KM.plain, cu - 0.26 + i * 0.26, 0.78, Zb + 0.55, { rx: Math.PI / 2, col: 0xe8e0c8, seg: 12 });
      kbox(0.05, 0.4, 0.05, KM.iron, cu + 0.48, 0.6, Zb + 0.45, { col: 0x4a4a4a, rz: 0.5 });
      kput(new THREE.ConeGeometry(0.28, 0.4, 10, 1, true), KM.brass, kx(d * 1.8), ky(CH - 0.75), -1.6, { rx: Math.PI, col: 0xb89860 });
      kbox(0.02, 0.55, 0.02, KM.iron, d * 1.8, CH - 0.28, -1.6, { col: 0x3a3a3a });
      klight('candle', kx(d * 1.8), ky(CH - 1.4), -1.2, 3.5, [1.4, 1.1, 0.6]);
    }
  },
  // ----- Agility: the Rigging Loft. A climbing wall, ratlines, a haul rope, a lens-sighting bench.
  A(R, Rn) {
    const lv = R.level, Zb = -KD / 2, o = R.ou, d = -o;
    // the climbing wall on the outer half of the back wall, a mat under it
    const cw = o * 3.05;
    kbox(2.1, CH - 0.3, 0.12, KM.wood, cw, (CH - 0.3) / 2, Zb + 0.08, { col: 0xd8b88a });
    kquad(2.0, CH - 0.4, KM.sign, SIGN_R.holds, cw, (CH - 0.3) / 2, Zb + 0.15);
    kbox(2.2, 0.22, 1.3, KM.cloth, cw, 0.11, Zb + 0.9, { col: 0x3a5a8a });
    kspot('student', cw - o * 0.25, 0, Zb + 0.42, { i: 0, face: FACE.back, climb: [0.15, 1.9] });
    // ratlines: a rope net from a spar near the ceiling to the floor
    const ru = o * 0.6;
    kcyl(0.09, 0.09, 2.6, KM.wood, ru, CH - 0.45, Zb + 0.7, { rz: Math.PI / 2, col: 0x6a4a30, seg: 8 });
    for (let i = 0; i < 6; i++) kbox(0.035, CH - 0.5, 0.035, KM.plain, ru - 1.0 + i * 0.4, (CH - 0.5) / 2, Zb + 0.7 + 0.25, { rx: -0.12, col: 0x8a7050 });
    for (let y = 0.4; y < CH - 0.6; y += 0.38) kbox(2.1, 0.03, 0.03, KM.plain, ru, y, Zb + 0.7 + 0.25 + (CH * 0.5 - y) * 0.12, { col: 0x8a7050 });
    kspot('student', ru + o * 0.3, 0, Zb + 1.35, { i: 1, face: FACE.back, climb: [0.1, 1.6] });
    // the haul: a block from the ceiling, a rope, a sandbag to lift
    const hu = d * 2.0;
    kbox(0.22, 0.3, 0.16, KM.wood, hu, CH - 0.45, -1.2, { col: 0x5a4030 }); kput(new THREE.TorusGeometry(0.11, 0.03, 4, 12), KM.iron, kx(hu), ky(CH - 0.45), -1.2, { col: 0x5a5a5a });
    kbox(0.03, CH - 1.6, 0.03, KM.plain, hu + 0.1, (CH - 0.45 + 1.15) / 2, -1.2, { col: 0xb59a70 });
    ksph(0.3, KM.cloth, hu + 0.1, 0.32, -1.2, { s: [1, 1.1, 1], col: 0xb89a68 });
    kspot('student', hu - d * 0.6, 0, -1.2, { i: 2, face: d > 0 ? FACE.right : FACE.left, work: true });
    // the lens-sighting bench by the door: brass lenses on stands, a target on the wall
    const lu = d * 3.4;
    ktable(lu, Zb + 0.5, 1.4, 0.65, 0.95, { col: 0x8a6a4a });
    for (const s of [-0.35, 0.35]) { kbox(0.04, 0.35, 0.04, KM.brass, lu + s, 1.13, Zb + 0.5); kput(new THREE.TorusGeometry(0.12, 0.025, 6, 16), KM.brass, kx(lu + s), ky(1.33), Zb + 0.5, { ry: Math.PI / 2 }); kput(new THREE.CircleGeometry(0.11, 14), KM.glass, kx(lu + s), ky(1.33), Zb + 0.5, { ry: Math.PI / 2 }); }
    kquad(0.6, 0.6, KM.sign, SIGN_R.target, d * 4.38 * -1 * -1 - d * 0.0, 1.5, 0, { ry: d > 0 ? -Math.PI / 2 : Math.PI / 2, s: [1, 1, 1] });
    kspot('student', lu - d * 0.0, 0, Zb + 1.25, { i: 3, face: FACE.back, work: true });
    kspot('tutor', d * 0.55, 0, -0.2, { face: FACE.cam, work: true });
    // coils of rope, a spar across the room, the window
    for (let i = 0; i < 3; i++) kput(new THREE.TorusGeometry(0.22, 0.07, 5, 14), KM.plain, kx(o * 3.9 - o * i * 0.1), ky(0.07 + i * 0.12), 0.9, { rx: Math.PI / 2, col: 0xb59a70 });
    kwin(d * 1.2, 1.5, 0.9, 1.45, {});
    kspot('fav', o * 3.6, 0, 1.0, { face: FACE.cam, i: 1 });
    // a barrel of chalk for the hands by the door
    kbarrel(d * 3.85, 0.85, 0.75, { col: 0x8a6a4a }); kcyl(0.27, 0.27, 0.02, KM.plain, d * 3.85, 0.76, 0.85, { col: 0xf0f0ea, seg: 12 });
    klamp(0, -0.2, { lv });
    if (lv >= 2) {
      KT = 2;
      // a ship's wheel on the wall, and a second lamp
      kput(new THREE.TorusGeometry(0.42, 0.05, 6, 20), KM.wood, kx(d * 2.9), ky(2.9), Zb + 0.1, { col: 0x7a5434 }); for (let i = 0; i < 4; i++) kbox(1.05, 0.04, 0.04, KM.wood, d * 2.9, 2.9, Zb + 0.12, { rz: i * Math.PI / 4, col: 0x7a5434 });
      klamp(d * 2.2, 0.2, { lv });
    }
    if (lv >= 3) {
      KT = 3;
      // a model airship hanging from the beams
      const mu = d * 1.6, mz = 0.9;
      ksph(0.32, KM.cloth, mu, CH - 0.85, mz, { s: [1.9, 0.62, 0.62], col: 0xc8a070 }); kbox(0.38, 0.1, 0.16, KM.wood, mu, CH - 1.12, mz, { col: 0x6a4226 });
      for (const s of [-1, 1]) { kbox(0.015, 0.45, 0.015, KM.plain, mu + s * 0.3, CH - 0.4, mz, { col: 0x8a8a8a }); kbox(0.02, 0.22, 0.14, KM.cloth, mu + s * 0.62, CH - 0.85, mz, { col: 0x9a4430 }); }
    }
  },
  // ----- Rapport: the Parlour. Armchairs by a little fire, tea, a map table, books.
  R(R, Rn) {
    const lv = R.level, Zb = -KD / 2, o = R.ou, d = -o, fu = o * 0.9;
    krug(fu, -0.9, 3.8, 2.6, 0x7a2a3a, 0xd8a860, { stripes: true });
    // the fireplace, its mirror (a painting at level 1), candles on the mantel
    for (const s of [-1, 1]) kbox(0.45, 1.35, 0.5, KM.dressed, fu + s * 0.72, 0.68, Zb + 0.25, { col: 0xd8ccbc });
    kbox(1.0, 0.5, 0.5, KM.dressed, fu, 1.12, Zb + 0.25, { col: 0xd8ccbc }); kbox(1.0, 0.86, 0.04, KM.plain, fu, 0.43, Zb + 0.03, { col: 0x1a1012 });
    kbox(1.0, 0.04, 0.5, KM.plain, fu, 0.86, Zb + 0.25, { col: 0x2a1c1a }); kbox(1.1, 0.08, 0.35, KM.dressed, fu, 0.04, Zb + 0.62, { col: 0xb8aca0 });
    kbox(2.2, 0.1, 0.62, KM.wood, fu, 1.4, Zb + 0.3, { col: 0x4a2a20 });
    for (let i = 0; i < 3; i++) kflame(kx(fu - 0.25 + i * 0.25), ky(0.12), Zb + 0.3, 0.3, 0.55, Rn());
    kcyl(0.07, 0.07, 0.7, KM.wood, fu, 0.15, Zb + 0.3, { rz: Math.PI / 2, col: 0x3a2418, seg: 6 });
    klight('fire', kx(fu), ky(0.6), Zb + 1.5, 4.6, [1.3, 0.56, 0.2]);
    kcandle(fu - 0.85, 1.45, Zb + 0.35); kcandle(fu + 0.85, 1.45, Zb + 0.35, { light: true });
    if (lv >= 2) { kbox(1.1, 0.9, 0.04, KM.wood, fu, 2.2, Zb + 0.04, { col: 0xc99a3c }); kplane(0.95, 0.75, KM.glass, fu, 2.2, Zb + 0.07, { col: 0xc8d8e0 }); }
    else kframe(fu, 2.2, 0.9, 0.72, 'paint1');
    // two armchairs, a low table between them with the tea service
    karmchair(fu - 1.35, -1.5, 0.35, 0x5a7a6a); karmchair(fu + 1.35, -1.5, -0.35, 0x6a5a8a);
    kspot('student', fu - 1.35, 0, -1.5, { i: 0, pose: 'sit', sink: 0.3, face: FACE.cam, work: true }); kspot('student', fu + 1.35, 0, -1.5, { i: 1, pose: 'sit', sink: 0.3, face: FACE.cam, work: true });
    ktable(fu, -0.55, 1.0, 0.6, 0.45, { col: 0x5a3020 });
    ksph(0.12, KM.plain, fu - 0.15, 0.55, -0.55, { col: 0xe8e4f0 }); kcyl(0.02, 0.03, 0.14, KM.plain, fu - 0.02, 0.58, -0.55, { rz: -1.0, col: 0xe8e4f0, seg: 5 });
    for (const s of [-1, 1]) { kcyl(0.05, 0.04, 0.06, KM.plain, fu + 0.25 + s * 0.12, 0.48, -0.5 + s * 0.08, { col: 0xf0ece8, seg: 8 }); kcyl(0.07, 0.07, 0.01, KM.plain, fu + 0.25 + s * 0.12, 0.455, -0.5 + s * 0.08, { col: 0xf0ece8, seg: 10 }); }
    KEEPX.steam.push(new THREE.Vector3(kx(fu - 0.15), ky(0.7), -0.55));
    // the map table by the door, two students reading it
    const mu = d * 2.95;
    ktable(mu, -1.3, 1.7, 1.15, 0.86, { col: 0x6a4030 });
    kquad(1.5, 1.0, KM.sign, SIGN_R.map, mu, 0.865, -1.3, { rx: -Math.PI / 2 });
    kbox(0.05, 0.12, 0.05, KM.brass, mu + 0.5, 0.92, -1.0); kbox(0.05, 0.08, 0.05, KM.brass, mu - 0.4, 0.9, -1.6);
    kspot('student', mu - 0.4, 0, -2.25, { i: 2, face: FACE.cam, work: true }); kspot('student', mu + 0.45, 0, -2.25, { i: 3, face: FACE.cam, work: true });
    // the tutor by the fire, a tall bookcase in the outer corner, the window
    kspot('tutor', fu + o * 1.45 + o * 0.6, 0, Zb + 0.9, { face: FACE.cam, work: true });
    kshelfUnit(o * 3.85, Zb + 0.3, 0.95, 2.9, 5, Rn, 'books', { col: 0x4a2a1e });
    kwin(d * 1.6, 1.45, 0.95, 1.55, { curtain: 0x7a2a3a });
    kspot('fav', fu, 0, -0.05, { face: FACE.back, i: 1 });
    // a footstool, and a little table with a lamp and a fern by the door
    kbox(0.5, 0.25, 0.4, KM.cloth, fu - 1.35, 0.2, -0.55, { col: 0x5a7a6a }); ktable(o * 3.8, 1.05, 0.6, 0.6, 0.7, { col: 0x5a3020 }); kpot(o * 3.7, 0.7, 0.95, 0.1, { plant: 0, ps: 0.5 }); kcandle(o * 3.95, 0.7, 1.2, { h: 0.2 });
    klamp(fu, -0.6, { lv });
    if (lv >= 2) {
      KT = 2;
      // a globe on a stand, a second lamp, portraits
      kcyl(0.04, 0.12, 0.8, KM.wood, d * 3.7, 0.4, 0.6, { col: 0x4a2a1e, seg: 8 }); ksph(0.3, KM.plain, d * 3.7, 1.1, 0.6, { col: 0x4a7a9a }); kput(new THREE.TorusGeometry(0.33, 0.02, 4, 20), KM.brass, kx(d * 3.7), ky(1.1), 0.6, { ry: 0.5 });
      kframe(d * 3.0, 2.75, 0.8, 0.64, 'paint2'); klamp(mu, -1.3, { lv });
    }
    if (lv >= 3) {
      KT = 3;
      // the gramophone, and a chaise by the window
      kbox(0.5, 0.25, 0.4, KM.wood, o * 2.35, 0.9 + 0.0, Zb + 0.45, { col: 0x5a2a20 }); ktable(o * 2.35, Zb + 0.45, 0.6, 0.5, 0.78, { col: 0x5a2a20, noShade: true });
      kput(new THREE.ConeGeometry(0.3, 0.6, 12, 1, true), KM.brass, kx(o * 2.35 + o * 0.15), ky(1.45), Zb + 0.5, { rz: o * 0.9 });
    }
  },
  // ----- Sowing: the Seed Library, with a glasshouse nook. Seed trays, a potting bench, bees, jars of seed.
  S(R, Rn) {
    const lv = R.level, Zb = -KD / 2, o = R.ou, d = -o;
    // the glasshouse nook: the outer half of the back wall is glass
    const gu = o * 2.4, gw = 3.6;
    kbox(gw + 0.2, 0.6, 0.18, KM.dressed, gu, 0.3, Zb + 0.09, { col: 0xc8bca8 });
    kpane(gw, 2.7, kx(gu), ky(0.6 + 1.35), Zb + 0.03);
    for (let i = 0; i <= 4; i++) kbox(0.07, 2.75, 0.1, KM.wood, gu - gw / 2 + i * gw / 4, 0.6 + 1.37, Zb + 0.06, { col: 0xe8e4d8 });
    for (let i = 0; i <= 3; i++) kbox(gw, 0.06, 0.1, KM.wood, gu, 0.62 + i * 0.9, Zb + 0.06, { col: 0xe8e4d8 });
    kshaft(kx(gu), ky(0.8), ky(3.2), gw * 0.9, Zb + 0.06, ky(0), 3.4);
    klight('win', kx(gu), ky(1.9), Zb + 1.4, 6.0, [1, 1, 1], { w: gw * 2.7 * 0.7 });
    kbox(gw, 0.04, 1.2, KM.plain, gu, 0.008, Zb + 0.95, { col: 0xb8704a, uv: 0.5 });
    // staging under the glass: tiers of seed trays and pots
    for (let t = 0; t < 3; t++) {
      kbox(gw - 0.4, 0.05, 0.32, KM.wood, gu, 0.55 + t * 0.42, Zb + 0.75 - t * 0.28, { col: 0x8a6a4a });
      for (let i = 0; i < 4; i++) { const x = gu - gw / 2 + 0.55 + i * (gw - 1.1) / 3; kbox(0.62, 0.08, 0.26, KM.wood, x, 0.62 + t * 0.42, Zb + 0.75 - t * 0.28, { col: 0x6a4a30 }); for (let k = 0; k < 4; k++) kput(new THREE.ConeGeometry(0.04, 0.1, 4), KM.plain, kx(x - 0.22 + k * 0.15), ky(0.7 + t * 0.42), Zb + 0.75 - t * 0.28, { col: 0x6aa04a }); }
    }
    for (const s of [-1, 1]) kbox(0.05, 1.4, 0.05, KM.wood, gu + s * (gw / 2 - 0.25), 0.7, Zb + 0.75, { col: 0x6a4a30 });
    kpot(gu - o * 1.4, 0, Zb + 1.55, 0.22, { plant: 0, ps: 0.9 }); kpot(gu + o * 0.2, 0, Zb + 1.7, 0.18, { plant: 1, ps: 0.75 });
    kspot('student', gu - o * 0.3, 0, Zb + 1.45, { i: 1, face: FACE.back, work: true });
    // the potting bench in front of the nook
    const pu = o * 2.6;
    ktable(pu, -0.45, 1.5, 0.65, 0.88, { col: 0x8a6a4a });
    kbox(0.6, 0.12, 0.4, KM.plain, pu - 0.3, 0.94, -0.45, { col: 0x4a3426 }); kpot(pu + 0.3, 0.88, -0.4, 0.1, { plant: 1, ps: 0.4 }); kpot(pu + 0.55, 0.88, -0.55, 0.08);
    kspot('student', pu - o * 1.05, 0, -0.45, { i: 0, face: o > 0 ? FACE.right : FACE.left, work: true });
    // jars of seed on the door side, and the drawers of the library
    kshelfUnit(d * 2.95, Zb + 0.28, 1.7, 2.9, 5, Rn, 'jars', { col: 0x6a4a34 });
    kspot('student', d * 1.6, 0, Zb + 0.9, { i: 2, face: d > 0 ? FACE.right : FACE.left, work: true });
    // the bees' hive on the door side front, a few bees about it and the flowers
    const bu = d * 3.55, bz = 0.55;
    if (lv === 1) { kcyl(0.05, 0.36, 0.6, KM.cloth, bu, 0.95, bz, { col: 0xd8b060, seg: 10 }); }
    else { kbox(0.6, 0.7, 0.5, KM.wood, bu, 1.0, bz, { col: 0xe8d8b0 }); kbox(0.7, 0.08, 0.6, KM.wood, bu, 1.38, bz, { col: 0x8a6a4a }); for (let k = 0; k < 3; k++) kbox(0.6, 0.02, 0.51, KM.wood, bu, 0.75 + k * 0.2, bz, { col: 0xc8b890 }); }
    ktable(bu, bz, 0.7, 0.6, 0.65, { col: 0x6a4a34 });
    KEEPX.bees.push({ x: kx(bu), y: ky(1.2), z: bz, n: 5 + lv * 2, r: 0.6 }, { x: kx(gu), y: ky(1.4), z: Zb + 1.0, n: 3 + lv, r: 1.0 });
    kspot('student', bu - d * 1.0, 0, bz, { i: 3, face: d > 0 ? FACE.right : FACE.left, work: true });
    // the tutor at a sorting table, seed packets spread out
    ktable(d * 0.55, -0.55, 1.1, 0.55, 0.8, { col: 0x7a5a40, skirt: 0x8a9a6a });
    for (let i = 0; i < 5; i++) kbox(0.12, 0.01, 0.16, KM.plain, d * 0.55 - 0.4 + i * 0.2, 0.83, -0.55 + (Rn() - 0.5) * 0.2, { ry: Rn(), col: [0xe8d8a8, 0xc8d8a0, 0xe8c0a0][i % 3] });
    kspot('tutor', d * 0.55, 0, -1.2, { face: FACE.cam, work: true });
    // herbs drying from the beams, a watering can, a sack of seed
    for (let i = 0; i < 6; i++) kplant(-2.6 + i * 1.05, CH - 0.95, -1.4, i % 2 ? 1 : 2, 0.6, { flip: true });
    kcyl(0.13, 0.15, 0.3, KM.brass, d * 0.9, 0.15, 0.9, { col: 0xb87a4a, seg: 10 }); kbox(0.45, 0.55, 0.4, KM.cloth, d * 0.2, 0.27, 1.1, { col: 0xd8c8a0 });
    kspot('fav', o * 0.0, 0, 0.7, { face: FACE.cam, i: 1 });
    // sacks of seed and pots waiting in the outer corner
    kbox(0.45, 0.6, 0.4, KM.cloth, o * 3.9, 0.3, 1.2, { col: 0xc8b890, ry: 0.3 }); kbox(0.42, 0.5, 0.38, KM.cloth, o * 3.45, 0.25, 1.4, { col: 0xb8a878, ry: -0.2 }); for (let i = 0; i < 3; i++) kpot(o * (3.0 - i * 0.05), 0, 0.85 + i * 0.25, 0.1 + i * 0.02);
    klamp(d * 1.5, -0.8, { lv });
    if (lv >= 2) {
      KT = 2;
      kbox(1.0, 1.0, 0.45, KM.wood, d * 0.85, 0.5, Zb + 0.25, { col: 0x6a4a34 }); kquad(0.9, 0.9, KM.sign, SIGN_R.labels, d * 0.85, 0.5, Zb + 0.48, { S: 1024 });
      kpot(o * 4.0, 0, 0.9, 0.24, { plant: 0, ps: 1.0 }); klamp(o * 1.6, -0.2, { lv, col: [1.3, 1.5, 0.8] });
    }
    if (lv >= 3) {
      KT = 3;
      // a crystal grow-lamp over the trays
      kbox(1.8, 0.06, 0.25, KM.brass, gu, CH - 0.6, Zb + 0.9); for (let i = 0; i < 4; i++) kput(new THREE.OctahedronGeometry(1, 0), KM.crystal, kx(gu - 0.6 + i * 0.4), ky(CH - 0.75), Zb + 0.9, { s: [0.06, 0.13, 0.06] });
      klight('crystal', kx(gu), ky(CH - 1.2), Zb + 1.2, 3.6, [1.8, 1.2, 0.5]);
      for (let i = 0; i < 3; i++) kpot(d * 0.3 + i * 0.5 * d, 0, 1.4, 0.15, { plant: i % 2, ps: 0.6 });
    }
  },
  // ----- the Lookout, under the roof at level 3: a telescope at a big window, charts, a brazier
  lookout(R, Rn) {
    const Zb = -KD / 2, o = R.ou, d = -o;
    kwin(0.4, 0.9, 2.2, 2.3, { cols: 3, rows: 3, reach: 3.6, r: 6.5 });
    // the telescope on its tripod, pointing up and out
    kcyl(0.13, 0.2, 1.8, KM.brass, 0.6, 1.75, -1.4, { rz: o * 1.1, rx: -0.4, col: 0xa08050 });
    for (const a of [0, 2.1, 4.2]) kbox(0.05, 1.5, 0.05, KM.wood, 0.4 + Math.cos(a) * 0.35, 0.72, -1.6 + Math.sin(a) * 0.35, { col: 0x5a4030, rz: Math.cos(a) * 0.25, rx: Math.sin(a) * 0.25 });
    kspot('fav', 0.4 - o * 0.85, 0, -1.6, { face: o > 0 ? FACE.right : FACE.left, work: true, i: 1 });
    // a chart table and a chair, charts on the wall, a brazier
    ktable(d * 2.9, -0.8, 1.4, 0.9, 0.84, { col: 0x6a4a34 }); kquad(1.2, 0.75, KM.sign, SIGN_R.map, d * 2.9, 0.845, -0.8, { rx: -Math.PI / 2 });
    kchair(d * 2.9, -1.55, 0, { cushion: 0x5a4a8a }); kspot('fav', d * 2.9, 0, -1.55, { pose: 'sit', sink: 0.32, face: FACE.cam, i: 2 });
    kframe(d * 3.1, 2.4, 1.1, 0.8, 'map');
    kcyl(0.32, 0.18, 0.45, KM.iron, o * 3.5, 0.55, 0.6, { col: 0x3a3a3a, seg: 10 }); for (const a of [0, 2.1, 4.2]) kbox(0.04, 0.55, 0.04, KM.iron, o * 3.5 + Math.cos(a) * 0.2, 0.27, 0.6 + Math.sin(a) * 0.2, { col: 0x3a3a3a });
    for (let i = 0; i < 3; i++) kflame(kx(o * 3.5 - 0.15 + i * 0.15), ky(0.75), 0.6, 0.22, 0.45, Rn());
    klight('fire', kx(o * 3.5), ky(1.2), 1.2, 4.2, [1.8, 0.9, 0.35]); KEEPX.embers.push(new THREE.Vector3(kx(o * 3.5), ky(0.9), 0.6));
    kspot('rest', o * 2.6, 0, 1.0, { face: o > 0 ? FACE.right : FACE.left });
    klamp(d * 1.2, -0.4, {});
  },
  // ----- an empty room: dust, sheets over old furniture, crates, and the sign to furnish it
  empty(R, Rn) {
    const Zb = -KD / 2, o = R.ou, d = -o;
    kwin(-o * 0.8, 1.4, 1.0, 1.6, { reach: 3.4, frame: 0x5a4a40 });
    // sheets over a table and a chair, crates and a sack, a broom and a ladder
    kbox(1.7, 0.85, 0.9, KM.cloth, o * 2.5, 0.43, -1.9, { col: 0xd8d4cc }); kbox(1.9, 0.05, 1.1, KM.cloth, o * 2.5, 0.85, -1.9, { col: 0xe0dcd4 });
    for (const s of [-1, 1]) kbox(0.04, 0.8, 1.05, KM.cloth, o * 2.5 + s * 0.94, 0.42, -1.9, { col: 0xd0ccc4, rz: s * 0.05 });
    kbox(0.7, 1.1, 0.7, KM.cloth, o * 3.6, 0.55, -0.7, { col: 0xd8d4cc, ry: 0.3 }); ksph(0.38, KM.cloth, o * 3.6, 1.1, -0.75, { s: [1, 0.5, 1], col: 0xe0dcd4 });
    kcrate(d * 3.3, 0, -2.3, 0.75, { ry: 0.2 }); kcrate(d * 2.5, 0, -2.4, 0.6, { ry: -0.15 }); kcrate(d * 3.25, 0.75, -2.3, 0.55, { ry: 0.5 }); kbox(0.5, 0.55, 0.42, KM.cloth, d * 2.3, 0.27, -1.5, { col: 0xc8b890, ry: 0.5 });
    kbox(0.04, 1.4, 0.04, KM.wood, d * 3.95, 0.7, -0.6, { rz: d * 0.18, col: 0x8a6a4a }); kbox(0.3, 0.25, 0.08, KM.plain, d * 3.83, 0.12, -0.6, { col: 0xb89a60 });
    for (const s of [-0.22, 0.22]) kbox(0.05, 2.6, 0.05, KM.wood, o * 0.6 + s, 1.25, Zb + 0.45, { rx: -0.18, col: 0x9a7a54 }); for (let y = 0.3; y < 2.4; y += 0.36) kbox(0.44, 0.04, 0.04, KM.wood, o * 0.6, y, Zb + 0.45 + (2.6 - y) * 0.0 + (1.25 - y) * 0.18, { col: 0x9a7a54 });
    // straw and dust on the floor, cobwebs in the corners
    for (let i = 0; i < 14; i++) kbox(0.25 + Rn() * 0.3, 0.01, 0.02, KM.plain, (Rn() - 0.5) * 6, 0.012, -1 + Rn() * 2.4, { ry: Rn() * 3, col: 0xd8c080 });
    for (const s of [-1, 1]) kquad(0.9, 0.9, KM.sign, SIGN_R.web, s * (RH - 0.5), CH - 0.5, Zb + 0.08, { s: [s, 1, 1], col: 0xe8e8ec });
    kquad(0.8, 0.8, KM.sign, SIGN_R.web, o * (RH - 0.06), CH - 0.45, 0.2, { ry: -o * Math.PI / 2, s: [-1, 1, 1] });
    // the sign: an easel at the front with FURNISH painted on it
    for (const s of [-1, 1]) kbox(0.07, 1.75, 0.07, KM.wood, s * 0.6, 0.85, 0.85, { rx: -0.12, rz: -s * 0.08, col: 0x6a4a30 });
    kbox(0.07, 1.6, 0.07, KM.wood, 0, 0.78, 0.45, { rx: 0.35, col: 0x6a4a30 });
    kbox(1.5, 0.06, 0.12, KM.wood, 0, 0.62, 0.95, { col: 0x6a4a30 });
    kquad(1.45, 1.09, KM.signLit, SIGN_R.furnish, 0, 1.22, 0.97, { rx: -0.12, col: new THREE.Color(0.85, 0.82, 0.78) });
    klight('sign', kx(0), ky(1.3), 1.9, 2.4, [0.9, 0.7, 0.4]);
    kspot('rest', o * 1.4, 0, 0.6, { face: FACE.cam, cat: true });
    klamp(0, -0.8, { lit: false });
  },
};
// a moving piece: built like the rest, then kept as its own small group that turns or swings
function kdyn(kind, x, y, z, build, o = {}) {
  const keep = KB; KB = []; build(); const recs = KB; KB = keep;
  for (const r of recs) r.geo.translate(-x, -y, -z);
  const grp = new THREE.Group(); grp.position.set(x, y, z); kmerge(grp, recs);
  KEEPV.group.add(grp);
  return { obj: grp, kind, axis: o.axis || 'y', speed: o.speed || 1, amp: o.amp || 0.3, ph: Math.random() * TAU, room: o.room, student: o.student };
}

// ----------------------------------------------------------------- the attic, under the roof: where the overflow sleep
function keepAttic(lv, nF) {
  const Y = nF * FH + 0.02, Zb = -KD / 2;
  KR = { key: 'attic', kind: 'attic', cx: 0, y0: Y, side: 0, ou: 1, level: lv }; KEEPV.rooms.attic = KR; KT = 1;
  const Rn = mulberry(909);
  // the floor, with the hatch at the top of the ladder
  kplane(KW + 0.6, KD, KM.boards, 0, 0.005, 0, { rx: -Math.PI / 2, col: 0x9a8064, uv: 1.6 });
  kbox(1.0, 0.04, 0.9, KM.plain, -0.8, 0.012, 2.75, { col: 0x1a1214 });
  kbox(1.05, 0.06, 0.08, KM.wood, -0.8, 0.03, 2.3, { col: 0x5a4030 });
  // rafters: pairs along the slopes, a collar beam and a king post; a purlin each side; the ridge
  const half = KW / 2 + 0.9, ang = Math.atan2(ROOF_H, half), L = Math.hypot(half, ROOF_H);
  for (const z of [-2.7, -0.9, 0.9, 2.7]) {
    for (const s of [-1, 1]) kbox(L, 0.22, 0.16, KM.wood, s * half / 2, ROOF_H / 2 - 0.2, z, { rz: -s * ang, col: 0x5a4030 });
    kbox(half * 0.75, 0.18, 0.14, KM.wood, 0, ROOF_H * 0.62, z, { col: 0x4a3424 });
    kbox(0.16, ROOF_H * 0.38, 0.14, KM.wood, 0, ROOF_H * 0.81, z, { col: 0x4a3424 });
  }
  for (const s of [-1, 1]) kbox(0.16, 0.16, KD, KM.wood, s * half * 0.5, ROOF_H * 0.5 - 0.25, 0, { col: 0x4a3424 });
  // the round window in the back gable, and a lantern from the collar
  koculus(0, ROOF_H * 0.42, 0.55, { reach: 4.5 });
  klamp(2.2, -0.2, { chain: 0.2 - (CH - ROOF_H * 0.62) });
  // beds: straw pallets under the slopes, more as the Keep grows
  const spots = [[-4.6, -1.9], [4.6, -1.9], [-6.8, -1.9], [6.8, -1.9], [-4.6, 0.05], [4.6, 0.05], [-6.8, 0.05], [6.8, 0.05], [-8.9, -1.9], [8.9, -1.9]];
  const n = lv >= 3 ? 10 : lv >= 2 ? 8 : 6;
  spots.slice(0, n).forEach(([u, z], i) => {
    kbox(1.95, 0.16, 0.85, KM.cloth, u, 0.08, z, { col: 0xd8c080, uv: 0.7 });
    kbox(0.4, 0.1, 0.6, KM.cloth, u + Math.sign(u) * 0.72, 0.21, z, { col: 0xf0e8d4 });
    kshade(u, z, 2.3, 1.2, 0.7);
    kbed({ x: kx(u), y: ky(0.18), z, L: 1.95 }, 20 + i, { dir: -Math.sign(u) });
  });
  // crates, a trunk, a dress form, laundry on a line
  kcrate(-2.3, 0, -2.4, 0.7, { ry: 0.2 }); kcrate(-2.1, 0.7, -2.45, 0.5, { ry: -0.3 }); kcrate(2.6, 0, -2.5, 0.6, { ry: 0.6 });
  kbox(0.9, 0.5, 0.5, KM.wood, 1.5, 0.25, -2.6, { col: 0x5a3a2a }); kcyl(0.25, 0.25, 0.9, KM.wood, 1.5, 0.5, -2.6, { rz: Math.PI / 2, col: 0x5a3a2a, seg: 10, s: [1, 1, 0.8] });
  kcyl(0.04, 0.04, 1.0, KM.wood, -1.3, 0.5, -1.2, { col: 0x5a4030, seg: 6 }); ksph(0.24, KM.cloth, -1.3, 1.25, -1.2, { s: [1, 1.5, 0.8], col: 0xb8a0b8 });
  kbox(4.4, 0.02, 0.02, KM.plain, 0.4, 2.55, -1.2, { col: 0xb59a70 });
  for (const [u, c, w, h] of [[-1.2, 0xe8e0d0, 0.55, 0.7], [-0.4, 0x8a5a6a, 0.45, 0.6], [0.5, 0x6a8a9a, 0.6, 0.5], [1.4, 0xe8d8a0, 0.4, 0.8]]) kplane(w, h, KM.cloth, u, 2.55 - h / 2, -1.2, { col: c });
  kspot('rest', -0.2, 0, -2.3, { face: FACE.back });
  kspot('fav', 0.6, 0, -2.0, { face: FACE.back, i: 1 });
  kspot('fire', 2.6, 0.6, -2.5, { face: FACE.cam, cat: true });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(12, ROOF_H * 0.8, KD), KM.hit); hit.position.set(0, Y + ROOF_H * 0.4, 0); hit.userData.room = 'attic'; KEEPV.group.add(hit); KEEPV.hits.push(hit);
  KEEPV.tags.push({ key: 'attic', pos: new THREE.Vector3(0, Y + ROOF_H * 0.78, KD / 2) });
  KR = null;
}

// ----------------------------------------------------------------- the sky behind, the peaks, the stars
function keepBackdrop() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uTop, uHor, uFog; uniform float uNight, uTime, uFlash; varying vec3 vW;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h21(vec2(i, 0.0)), h21(vec2(i + 1.0, 0.0)), f); }
      void main() {
        float y = vW.y;
        vec3 c = mix(uHor, uTop, smoothstep(-4.0, 60.0, y));
        vec2 sc = vW.xy * 1.6, cell = floor(sc); float sh = h21(cell);
        float st = step(0.985, sh) * (1.0 - smoothstep(0.03, 0.12, length(fract(sc) - 0.5 - (vec2(h21(cell + 3.1), h21(cell + 7.7)) - 0.5) * 0.6))) * uNight * smoothstep(6.0, 26.0, y);
        c += st * vec3(0.95, 0.95, 1.0) * (0.6 + 0.4 * sin(uTime * 2.0 + sh * 40.0));
        // two ranges of peaks, the far one paler
        float p1 = 4.0 + vn(vW.x * 0.06 + 3.0) * 16.0 + vn(vW.x * 0.21) * 4.0;
        float p2 = -1.0 + vn(vW.x * 0.09 + 11.0) * 10.0 + vn(vW.x * 0.33 + 5.0) * 2.5;
        c = mix(c, mix(uFog, uHor, 0.35) * 0.85, step(y, p1) * 0.85);
        c = mix(c, uFog * 0.62, step(y, p2) * 0.9);
        c += uFlash * vec3(0.5, 0.52, 0.6);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(600, 260), mat); m.position.set(0, 60, -90); m.renderOrder = -1; m.frustumCulled = false;
  KSCENE.add(m); KEEPV.backdrop = m;
}

// ----------------------------------------------------------------- dust in the light, bees about the hive
function keepDust(g, light) {
  const pts = [], R = mulberry(4243), per = light ? 4 : 10;
  for (const R0 of Object.values(KEEPV.rooms)) { if (R0.key === 'attic') continue; for (let i = 0; i < per; i++) pts.push(R0.cx + (R() - 0.5) * RH * 1.8, R0.y0 + 0.4 + R() * 3.2, -2.8 + R() * 4.2); }
  for (let i = 0; i < per * 2; i++) pts.push((R() - 0.5) * 14, KEEPV.H + 0.5 + R() * 3, -2.6 + R() * 3.6);
  const bees = []; if (!light) for (const b of KEEPX.bees) for (let i = 0; i < b.n; i++) bees.push(b.x, b.y, b.z, b.r);
  const mk = (arr, bee) => {
    const geo = new THREE.BufferGeometry(), n = arr.length / (bee ? 4 : 3);
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), rad = new Float32Array(n);
    for (let i = 0; i < n; i++) { const s = bee ? 4 : 3; pos[i * 3] = arr[i * s]; pos[i * 3 + 1] = arr[i * s + 1]; pos[i * 3 + 2] = arr[i * s + 2]; seed[i] = R() * 100; rad[i] = bee ? arr[i * s + 3] : 0.5; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1)); geo.setAttribute('rad', new THREE.BufferAttribute(rad, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uCol: { value: new THREE.Color(bee ? 0xffd040 : 0xffe6b8) }, uK: { value: 1 } },
      vertexShader: bee ? `attribute float seed, rad; uniform float uTime, uScale; varying float vA;
          void main() { float t = uTime * (1.4 + fract(seed) * 1.2) + seed; vec3 p = position + vec3(sin(t) * rad, sin(t * 1.7) * 0.25 * rad + 0.1, cos(t * 0.8) * rad * 0.7);
            p += vec3(sin(uTime * 23.0 + seed) * 0.02, cos(uTime * 19.0 + seed) * 0.02, 0.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = 1.0; gl_PointSize = 0.07 * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`
        : `attribute float seed; uniform float uTime, uScale; varying float vA;
          void main() { vec3 p = position + vec3(sin(uTime * 0.17 + seed) * 0.6, sin(uTime * 0.11 + seed * 1.7) * 0.4, cos(uTime * 0.13 + seed * 2.3) * 0.5);
            vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = 0.25 + 0.5 * max(0.0, sin(uTime * (0.5 + fract(seed) * 0.8) + seed * 5.0));
            gl_PointSize = 0.045 * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uK; varying float vA; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), ${bee ? '1.0' : '2.0'}) * vA * uK; if (a < 0.01) discard; gl_FragColor = vec4(uCol * a, a); }`,
      transparent: true, depthWrite: false, blending: bee ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const m = new THREE.Points(geo, mat); m.frustumCulled = false; g.add(m); return m;
  };
  KEEPV.dust = pts.length ? mk(pts, false) : null;
  KEEPV.bees = bees.length ? mk(bees, true) : null;
}
// the lanterns' places (they sway in keepLookUpdate)
function keepLanterns() {
  const L = KEEPX.lamps, n = Math.min(L.length, 64), c = new THREE.Color();
  KEEPV.lant.count = n; KEEPV.lantCore.count = n;
  for (let i = 0; i < n; i++) {
    const l = L[i];
    KEEPV.lant.setColorAt(i, c.set(l.lv >= 2 ? 0xd8b070 : 0x6a6e78));
    KEEPV.lantCore.setColorAt(i, l.lit ? (l.lv >= 3 ? c.setRGB(1.6, 1.4, 1.0) : c.setRGB(1.7, 0.95, 0.38)) : c.setRGB(0.25, 0.22, 0.2));
  }
  for (const m of [KEEPV.lant, KEEPV.lantCore]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

// ----------------------------------------------------------------- fitting out a room in front of you
// The new pieces are sorted bottom up into a dozen batches; crates drop in, their lids fly off, the batches rise into
// place one after another, the crates go, and then the room is baked in with the rest.
function keepFitBuild(g, recs) {
  const F = KEEPV.fit, R = KEEPV.rooms[F.key]; if (!R) { KEEPV.fit = null; return; }
  recs.forEach(r => { r.geo.computeBoundingBox(); r.cy = r.geo.boundingBox.min.y; });
  recs.sort((a, b) => a.cy - b.cy);
  const N = Math.min(12, Math.max(4, Math.ceil(recs.length / 14))), per = Math.ceil(recs.length / N);
  F.batches = [];
  for (let i = 0; i < recs.length; i += per) {
    const part = recs.slice(i, i + per), box = new THREE.Box3();
    for (const r of part) box.union(r.geo.boundingBox);
    const c = box.getCenter(new THREE.Vector3()); c.y = box.min.y;
    for (const r of part) r.geo.translate(-c.x, -c.y, -c.z);
    const grp = new THREE.Group(); grp.position.copy(c); kmerge(grp, part); grp.visible = false; g.add(grp);
    F.batches.push({ grp, home: c.clone() });
  }
  F.crates = [];
  if (F.crates !== null && F.from === 0) {
    const keep = KB;
    for (let i = 0; i < 3; i++) {
      KB = []; const s = 0.7 - i * 0.08, x = R.cx + (i - 1) * 1.1, z = 0.6 + (i % 2) * 0.4;
      kput(KBOX(s, s * 0.85, s), KM.wood, 0, s * 0.425, 0, { col: 0xb08a60, uv: 1 }); for (const yy of [0.1, 0.75]) kput(KBOX(s + 0.03, 0.06, s + 0.03), KM.wood, 0, s * yy, 0, { col: 0x6a4a30 });
      const body = new THREE.Group(); kmerge(body, KB);
      KB = []; kput(KBOX(s + 0.06, 0.07, s + 0.06), KM.wood, 0, 0.035, 0, { col: 0x8a6440 }); const lid = new THREE.Group(); kmerge(lid, KB); lid.position.y = s * 0.85; body.add(lid);
      body.position.set(x, R.y0 + 3, z); body.rotation.y = (i - 1) * 0.3; g.add(body);
      F.crates.push({ body, lid, x, z, y0: R.y0, s, ph: i * 0.12, ry: (Math.random() - 0.5) * 2 });
    }
    KB = keep;
  }
  F.t = 0; F.len = F.from === 0 ? 3.2 : 2.0;
  for (const o of KEEPV.dyn) if (o.room === F.key) o.obj.visible = false;   // the orrery and the bag come with the rest
  AUDIO.play('build');
}
function keepFitUpdate(rdt) {
  const F = KEEPV.fit; if (!F || !F.batches) return;
  F.t += rdt; const t = F.t, R = KEEPV.rooms[F.key], fx = KEEPX.fx;
  const t0 = F.from === 0 ? 0.75 : 0.1, span = F.from === 0 ? 1.9 : 1.4;
  F.batches.forEach((b, i) => {
    const k = clamp((t - t0 - i * span / F.batches.length) / 0.45, 0, 1);
    if (k <= 0) { b.grp.visible = false; return; }
    b.grp.visible = true; const e = 1 - Math.pow(1 - k, 3);
    b.grp.position.set(b.home.x, b.home.y + (1 - e) * 1.2, b.home.z); b.grp.scale.setScalar(0.4 + 0.6 * e);
    if (k >= 1 && !b.done) { b.done = true; if (fx) fx.puff(b.home.clone().setY(b.home.y + 0.1), 4, 0xd8c8a8, 0.6); }
  });
  for (const c of F.crates) {
    const k = clamp((t - c.ph) / 0.45, 0, 1), land = R.y0;
    const y = k < 1 ? land + 3 * (1 - k * k) : land + Math.max(0, Math.sin(clamp((t - c.ph - 0.45) / 0.25, 0, 1) * Math.PI) * 0.15);
    c.body.position.y = y;
    if (k >= 1 && !c.landed) { c.landed = true; if (fx) fx.puff(new THREE.Vector3(c.x, land + 0.2, c.z), 6, 0xc8b898, 0.8); }
    const lk = clamp((t - 0.6 - c.ph) / 0.5, 0, 1);
    if (lk > 0) { c.lid.position.y = c.s * 0.85 + lk * 1.6 - lk * lk * 1.4; c.lid.position.x = lk * 0.6 * c.ry; c.lid.rotation.z = lk * 2.4 * c.ry; c.lid.scale.setScalar(Math.max(0.01, 1 - Math.max(0, lk - 0.6) * 2.5)); if (!c.opened) { c.opened = true; if (fx) fx.sparks(new THREE.Vector3(c.x, land + c.s, c.z), 8, 0xffd27a, 2); } }
    const sk = clamp((t - 2.5 - c.ph) / 0.4, 0, 1); c.body.scale.setScalar(Math.max(0.01, 1 - sk));
  }
  if (t >= F.len) { KEEPV.fit = null; buildInterior(true); }
}

// ----------------------------------------------------------------- particles in the Keep (embers, steam, dust puffs)
function keepFX(target) {
  const N = 260, parts = [], mk = blend => new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: blend, vertexColors: true,
    vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float uScale;
      void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float r = length(d); if(r>0.5) discard; float a = smoothstep(0.5,0.0,r); gl_FragColor = vec4(vC, a*a*vA); }`,
  });
  const sys = {};
  for (const [k, blend] of [['soft', THREE.NormalBlending], ['glow', THREE.AdditiveBlending]]) {
    const geo = new THREE.BufferGeometry();
    for (const [a, n] of [['position', 3], ['color', 3], ['size', 1], ['alpha', 1]]) geo.setAttribute(a, new THREE.BufferAttribute(new Float32Array(N * n), n));
    const pts = new THREE.Points(geo, mk(blend)); pts.frustumCulled = false; pts.renderOrder = 5; target.add(pts);
    sys[k] = { pts, g: geo, list: [], free: Array.from({ length: N }, (_, i) => N - 1 - i) };
  }
  const _c = new THREE.Color();
  const emit = (k, p, v, c, s, life, o = {}) => { const S = sys[k]; if (!S.free.length) return; S.list.push({ i: S.free.pop(), p: p.clone(), v: v.clone(), c: _c.set(c).clone(), s, life, age: 0, g: o.g ?? -0.6, drag: o.drag ?? 1.2, grow: o.grow ?? 0.6, a0: o.a ?? 0.8 }); };
  return {
    puff(p, n = 6, c = 0xd8c8a8, spread = 0.8) { for (let k = 0; k < n; k++) emit('soft', p, new THREE.Vector3((Math.random() - 0.5) * spread * 2, Math.random() * 0.8 + 0.3, (Math.random() - 0.5) * spread * 2), c, 0.5 + Math.random() * 0.5, 0.8 + Math.random() * 0.6, { g: 0.2, drag: 2.2, grow: 1.4, a: 0.5 }); },
    steam(p) { emit('soft', p, new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08), 0xf4f0ea, 0.18, 2.2 + Math.random(), { g: 0.06, drag: 0.5, grow: 2.2, a: 0.3 }); },
    smoke(p, c) { emit('soft', p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.4)), new THREE.Vector3(0.25 + Math.random() * 0.2, 0.8 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2), c, 0.7, 4 + Math.random() * 2, { g: 0.08, drag: 0.35, grow: 2.4, a: 0.32 }); },
    ember(p) { emit('glow', p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.3)), new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.8, (Math.random() - 0.5) * 0.2), 0xffa040, 0.05 + Math.random() * 0.04, 1.2 + Math.random() * 1.2, { g: 0.15, drag: 0.6, grow: -0.5, a: 1 }); },
    sparks(p, n = 14, c = 0xffc070, sp = 3) { for (let k = 0; k < n; k++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(sp * (0.4 + Math.random())); emit('glow', p, v, c, 0.1 + Math.random() * 0.12, 0.5 + Math.random() * 0.6, { g: -2.4, drag: 1.6, grow: -0.3, a: 1 }); } },
    update(dt) {
      for (const k in sys) {
        const S = sys[k], P = S.g.attributes.position.array, C = S.g.attributes.color.array, Z = S.g.attributes.size.array, A = S.g.attributes.alpha.array;
        S.list = S.list.filter(q => {
          q.age += dt;
          if (q.age >= q.life) { A[q.i] = 0; S.free.push(q.i); return false; }
          q.v.y += q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.p.addScaledVector(q.v, dt);
          const t = q.age / q.life;
          P[q.i * 3] = q.p.x; P[q.i * 3 + 1] = q.p.y; P[q.i * 3 + 2] = q.p.z; C[q.i * 3] = q.c.r; C[q.i * 3 + 1] = q.c.g; C[q.i * 3 + 2] = q.c.b;
          Z[q.i] = Math.max(0.02, q.s * (1 + q.grow * t)); A[q.i] = q.a0 * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
          return true;
        });
        S.pts.visible = S.list.length > 0; if (!S.pts.visible) continue;
        for (const a of ['position', 'color', 'size', 'alpha']) S.g.attributes[a].needsUpdate = true;
        S.pts.material.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.6;
      }
    },
  };
}

// ----------------------------------------------------------------- every frame, in the Keep view
// the light of the hour: daylight from the windows by day, lamps and fires by night, and the weather in both
const _kgv = new THREE.Vector3(), _kgl = [], _kday = new THREE.Color(), _kmoon = new THREE.Color(0.35, 0.45, 0.8), _kwarm = new THREE.Color(1, 0.95, 0.85);
function keepLightK(g, now, out) {
  const night = TOD.night, M = WEATHER.mix, cover = wxCover(), day = clamp(1 - night * 1.15, 0, 1);
  if (g.kind === 'win' || g.kind === 'door') {
    // the window's light: the sky's own colour, brighter in the sun, dimmer under cloud; moonlight at night
    _kday.copy(skyU.uHor.value).lerp(_kwarm, 0.55);
    const sunK = (0.45 + 0.45 * TOD.sunlight) * (1 - 0.5 * cover) * day * (g.kind === 'door' ? 1.2 : 1);
    const moonK = (1 - day) * 0.22 * (1 - 0.8 * cover);
    const fl = WEATHER.flash * 2.5;
    const k = Math.min(1.0, Math.sqrt(g.w || 1) * 0.55);
    out.setRGB((_kday.r * sunK + _kmoon.r * moonK + fl) * k, (_kday.g * sunK + _kmoon.g * moonK + fl) * k, (_kday.b * sunK + _kmoon.b * moonK + fl) * k);
    return out;
  }
  let s = 1;
  if (g.kind === 'lamp') s = 0.3 + 0.85 * night + 0.25 * cover * day;
  else if (g.kind === 'fire') s = 0.85 + 0.35 * night + 0.12 * Math.sin(now * 11 + g.x) + 0.08 * Math.sin(now * 23.7 + g.z * 3) + 0.06 * Math.sin(now * 5.3);
  else if (g.kind === 'candle') s = (0.5 + 0.8 * night) * (1 + 0.1 * Math.sin(now * 17 + g.x * 9));
  else if (g.kind === 'porch') s = night * 1.1;
  else if (g.kind === 'beacon') s = 0.5 + night * 1.4 + Math.sin(now * 1.5) * 0.15;
  else if (g.kind === 'crystal') s = 0.7 + 0.2 * Math.sin(now * 1.3) + night * 0.4;
  else if (g.kind === 'sign') s = 0.25 + night * 0.9;
  if (POWER && !POWER.on && g.kind === 'lamp') s *= 0.35;
  return out.setRGB(g.col[0] * s, g.col[1] * s, g.col[2] * s);
}
const _klc = new THREE.Color();
function setInteriorLights() { /* the Keep's light is set every frame in keepLookUpdate */ }
function keepLookUpdate(rdt, gdt) {
  if (!KEEPV.group || VIEW.mode !== 'keep') return;
  const now = performance.now() / 1000, night = TOD.night, M = WEATHER.mix, cover = wxCover(), day = clamp(1 - night * 1.15, 0, 1), light = QUALITY.level === 'light';
  // the real lights: soft, so the lamps and windows do the work
  KEEPV.hemi.intensity = lerp(0.95, 0.3, night) * (1 - 0.25 * cover * day) + WEATHER.flash * 1.2;
  KEEPV.hemi.color.set(0xfff0dc).lerp(_klc.setRGB(0.55, 0.62, 0.95), night * 0.6);
  KEEPV.sun.intensity = lerp(0.85, 0.16, night) * (1 - 0.3 * cover * day);
  renderer.toneMappingExposure = lerp(1.02, 1.12, night) + WEATHER.flash * 0.2;
  if (bloom) { bloom.strength = lerp(0.4, 0.55, night); bloom.threshold = lerp(0.92, 0.84, night); bloom.radius = 0.5; }
  // the far ground fades into the horizon
  KSCENE.fog.color.copy(skyU.uHor.value).lerp(scene.fog.color, 0.5); KSCENE.fog.near = KCAM.d + 12; KSCENE.fog.far = KCAM.d + 95;
  KSCENE.background.copy(skyU.uTop.value).multiplyScalar(0.6);
  // the sky outside and in the windows
  const B = KEEPV.backdrop.material.uniforms;
  B.uTop.value.copy(skyU.uTop.value); B.uHor.value.copy(skyU.uHor.value); B.uFog.value.copy(scene.fog.color); B.uNight.value = night; B.uTime.value = now; B.uFlash.value = WEATHER.flash;
  const P = KM.pane.uniforms;
  P.uTop.value.copy(skyU.uTop.value); P.uHor.value.copy(skyU.uHor.value); P.uNight.value = night * (1 - cover * 0.9); P.uRain.value = clamp(M.rain + M.storm, 0, 1); P.uTime.value = now; P.uFlash.value = WEATHER.flash; P.uFog.value = M.fog;
  P.uBright.value = lerp(1.0, 0.85, night) * (1 + 0.15 * TOD.sunlight * (1 - cover));
  const S = KM.shaft.uniforms;
  S.uK.value = (0.06 + 0.16 * TOD.sunlight) * (1 - 0.85 * cover) * day; S.uTime.value = now;
  S.uSlant.value = clamp(-skyU.uSun.value.x * 1.6, -1.6, 1.6);
  S.uCol.value.setRGB(1, 0.86 + 0.1 * TOD.sunlight, 0.62 + 0.25 * TOD.sunlight);
  KM.flame.uniforms.uTime.value = now; KM.flame.uniforms.uK.value = 0.85 + 0.25 * night;
  KM.crystal.emissiveIntensity = 0.7 + night * 0.5 + Math.sin(now * 1.2) * 0.15;
  // the faked lamplight: the lights nearest the middle of the view lend their light to the shaders
  kcam.updateMatrixWorld();
  const max = light ? 10 : KGLOW_MAX, tgt = kcontrols.target, cand = _kgl; cand.length = 0;
  for (const g of KEEPV.lights) { g.dd = (g.x - tgt.x) ** 2 + (g.y - tgt.y) ** 2 * 1.3; cand.push(g); }
  cand.sort((a, b) => a.dd - b.dd);
  let k = 0;
  for (const g of cand) {
    if (k >= max) break;
    keepLightK(g, now, _klc); g.cur = g.cur || new THREE.Color(); g.cur.copy(_klc);
    if (_klc.r + _klc.g + _klc.b < 0.02) continue;
    _kgv.set(g.x, g.y, g.z).applyMatrix4(kcam.matrixWorldInverse);
    KGLOW.p.value[k].set(_kgv.x, _kgv.y, _kgv.z, g.r * g.r); KGLOW.c.value[k].set(_klc.r, _klc.g, _klc.b); k++;
  }
  KGLOW.n.value = k;
  // lanterns sway on their chains
  const L = KEEPX.lamps, n = KEEPV.lant.count, _p = _kv, _q = _kq, _e = _ke, _s = _ks;
  for (let i = 0; i < n; i++) {
    const l = L[i];
    _km.compose(_p.set(l.x, l.y, l.z), _q.setFromEuler(_e.set(Math.sin(now * 0.9 + l.ph * 2) * 0.03, 0, Math.sin(now * 1.3 + l.ph) * 0.05)), _s.set(1, 1 + l.chain * 0, 1));
    KEEPV.lant.setMatrixAt(i, _km); KEEPV.lantCore.setMatrixAt(i, _km);
  }
  KEEPV.lant.instanceMatrix.needsUpdate = true; KEEPV.lantCore.instanceMatrix.needsUpdate = true;
  // what moves: the orrery's rings, the heavy bag when it's being worked
  for (const o of KEEPV.dyn) {
    if (o.kind === 'spin') o.obj.rotation[o.axis] += rdt * o.speed;
    else if (o.kind === 'bag') { const on = keepWorking(o.room, o.student); o.ph += rdt * o.speed * (on ? 1 : 0.15); o.obj.rotation[o.axis] = Math.sin(o.ph) * o.amp * (on ? 1 : 0.2); }
  }
  // embers from the fires, steam from the pot and the teapot, dust drifting, bees
  const fx = KEEPX.fx;
  if (fx) {
    if (rdt > 0) for (const e of KEEPX.embers) if (Math.random() < rdt * (light ? 2 : 5)) fx.ember(e);
    if (rdt > 0) for (const s of KEEPX.steam) if (Math.random() < rdt * (light ? 1.5 : 3)) fx.steam(s);
    // smoke from the Hearth Hall's chimney, thicker at night when the fire's banked up
    if (rdt > 0 && KEEPV.chimney && Math.random() < rdt * (light ? 2 : 4)) fx.smoke(KEEPV.chimney, night > 0.5 ? 0x6a6470 : 0xb8b0a8);
    fx.update(rdt);
  }
  const sc = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(kcam.fov / 2)));
  for (const m of [KEEPV.dust, KEEPV.bees]) if (m) { m.material.uniforms.uTime.value = now; m.material.uniforms.uScale.value = sc; }
  if (KEEPV.dust) KEEPV.dust.material.uniforms.uK.value = 0.5 + 0.9 * day * (1 - 0.6 * cover);
  // the notice board follows the journal
  KEEPV.nbT = (KEEPV.nbT || 0) - rdt; if (KEEPV.nbT <= 0) { KEEPV.nbT = 2; drawNoticeBoard(); }
  keepFitUpdate(rdt);
}
// the test hook: draw calls, triangles and real lights in the Keep view (one plain render, no post effects)
function keepDrawCalls() {
  const r = renderer, keep = r.info.autoReset; r.info.autoReset = true; r.render(KSCENE, kcam); r.info.autoReset = keep;
  let L = 0, M = 0; KSCENE.traverse(o => { if (o.isLight && !o.isHemisphereLight && !o.isDirectionalLight) L++; if (o.isMesh || o.isSprite || o.isPoints) M++; });
  return { calls: r.info.render.calls, tris: r.info.render.triangles, lights: L, objects: M, glows: KGLOW.n.value };
}
// is someone at work at this student place? (the heavy bag swings for them)
function keepWorking(room, i) { if (typeof room !== 'number') return false; const v = roomStudents(room)[i]; return !!(v && v.kin && v.kin.at && v.where === 'study'); }
