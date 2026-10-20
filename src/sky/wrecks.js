// wrecks.js: a raider going down, as a spectacle worth watching. Told of a raider going down (events.js), it plays her
// end in the sky until she's gone below the clouds:
//   blown apart (her hull gone)  a white flash and a great burst of sparks, splinters and canvas; then a chain of blasts
//                                walks along her hull from stern to bow (more on a bigger ship: three on a Skiff, nine
//                                on a Man-o'-war); her crystals sputter and go dark; her sails flare up and burn away
//                                (on a laptop, her masts crack at the deck one after another, topple over the side with
//                                their sails, break away and tumble down through the clouds trailing smoke); she rolls
//                                over and falls, trailing a thick column of black smoke and fire
//   crystals dead                no blasts: her crystals sputter, shatter and go dark, and she sinks upright in grey smoke
//   struck her colours           (a treasure ship, or a beaten crew, giving up) no blasts: her pennants come down their
//                                masts and a white flag goes up her tallest, gold glints from a treasure ship's hold,
//                                and she settles away (sinking faster and faster: flight.js)
// Falling through the cloud deck, every wreck tears it open and throws up a ring of cloud; a burning one glows orange
// through the cloud a moment after she's gone. Each explosion is told as `blast` (the shake, and the sound).
// At most two wrecks play their blasts and fire at once; another gets the flash and the smoke; and at most two ships'
// masts fall at once (three draws a mast, for a few seconds). The smoke and sparks a wreck pours out are only made while
// their batches have room, so a fight's own always find it.
import * as THREE from 'three';
import { on, emit, payload } from './events.js';
import { CLOUD_Y } from './world.js';
import { RAIDER_LOOKS } from './fx.js';
import { PUFF } from './effects.js';

// when things happen (seconds after she goes down): her crystals sputter from..to; her sails flare up; how many wrecks
// play their blasts and fire at once; the smoke column's puffs: one each time she has fallen `gap` of her length (plus
// 2 m), or at least every `puff` seconds (on a laptop, a phone), so the column is thick but not piled up
export const WRECK = { crystals: [0.4, 1.6], sails: 0.6, full: 2, puff: [0.07, 0.12], gap: [0.12, 0.19] };
// falling masts: when the first cracks, how long after it each next one does, the angle at which one breaks away
// (radians), how many ships' masts fall at once, and the longest a falling one is kept (each goes once it's wholly under
// the cloud deck; one that's still above it then, from a fight high up, shrinks away over its last `fade` seconds)
export const MASTS = { from: 0.7, every: 0.5, breaks: 1.0, ships: 2, life: 12, fade: 0.6 };
const MAX = 8, UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Vector3(), FALL = ['wood', 'brass', 'canvas'];
const FIRE = [0xff7a2a, 0xffc04a, 0xffe8a0], AMBER = 0xffc061, GOLD = 0xffd27a;
// the white flag a ship that strikes her colours runs up her tallest mast: one shape for every wreck (1 m along its pole,
// flying out from it), a share `size` of her length (`least` metres at the least), going up over `up` seconds once her
// pennants are down, to fly just over her mast head (above the smoke of her wounds), so it reads across a fight. It
// turns about its pole to face the camera, streaming out sideways as it's seen (towards her stern where it can), so it
// never shows edge-on, from her bow or her stern; and from further off than `near` metres it grows with the distance,
// up to `most` times its size, as the far wakes and her holes do (grown more, 2.2 times, it hid a Brig's whole rig).
// Far off it's hemmed in a dark edge `hem` screen pixels wide (from `edged` metres off, in full from twice that), so it
// reads against the white haze and the clouds as well as against her dark sails: along its top, its foot and its free
// end, which waves a little (`wave`, a share of its length) as cloth does, never down its pole's side, so it reads as a
// flag on a pole and not a framed board. Its drawing is made ready as each voyage starts (flagToWarm: main.js), so the
// first ship to strike doesn't stutter a phone
export const WHITE_FLAG = { size: 0.3, least: 4.5, up: 1.8, color: 0xf6f2e8, near: 140, most: 1.6, hem: 1.6, edged: 90, hemColor: 0x2e2622, wave: 0.08 };
const FLAG_GEO = new THREE.PlaneGeometry(1, 0.62).translate(0.5, -0.31, 0);
const flagMat = new THREE.MeshBasicMaterial({ color: WHITE_FLAG.color, side: THREE.DoubleSide }), flagEye = new THREE.Vector3();
flagMat.name = 'white flag';
// (the hem: how wide a screen pixel is, in metres, for each metre off, written each frame from the camera: update)
const FLAG_U = { uPx: { value: 0.002 }, uHem: { value: new THREE.Color(WHITE_FLAG.hemColor) } };
flagMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, FLAG_U);
  sh.vertexShader = 'uniform float uPx;\nvarying vec2 vFlag;\nvarying vec2 vHem;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
    vFlag = uv;
    float depth = max(1.0, -mvPosition.z), hem = ${WHITE_FLAG.hem.toFixed(2)} * uPx * depth * smoothstep(${WHITE_FLAG.edged.toFixed(1)}, ${(WHITE_FLAG.edged * 2).toFixed(1)}, depth);
    vHem = vec2(hem / length(modelMatrix[0].xyz), hem / (0.62 * length(modelMatrix[1].xyz)));`);
  sh.fragmentShader = 'uniform vec3 uHem;\nvarying vec2 vFlag;\nvarying vec2 vHem;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    float fly = 1.0 - ${WHITE_FLAG.wave.toFixed(3)} * (0.5 + 0.5 * sin(vFlag.y * 9.42)); // (its free end, waving: the pole's side is vFlag.x 0)
    if (vFlag.x > fly) discard;
    vec2 e = vec2(fly - vFlag.x, min(vFlag.y, 1.0 - vFlag.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, uHem, max(step(e.x, vHem.x), step(e.y, vHem.y)));`);
};
flagMat.customProgramCacheKey = () => 'white-flag-hem-2';

// `tear(x, z, radius)` opens a hole in the cloud deck (world.js); falling masts are added to `scene` once they break away
export function makeWrecks({ fx, tear = null, scene = null }) {
  const every = WRECK.puff[fx.touch ? 1 : 0], gap = WRECK.gap[fx.touch ? 1 : 0], debris = fx.debris, smoke = fx.smoke;
  const made = () => ({ r: null, why: '', t: 0, full: false, chain: 0, fired: 0, next: 0, busy: 0, puff: 0, flick: 0, flames: 0, lastY: 0,
    crossed: false, gone: -1, told: false, burnt: false, dark: false, glint: 0, masts: false, cut: false, blast: new THREE.Vector3(), at: new THREE.Vector3(), puffed: new THREE.Vector3(), s: 1 });
  const pool = Array.from({ length: MAX }, made), list = [];
  const BLAST = payload('blast'), DECK = payload('wreck:deck'), GONE = payload('wreck:gone');
  const p = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Vector3();

  // a point in raider r's own frame (x, y, z), in the world
  const world = (r, x, y, z, out = p) => out.set(x, y, z).applyMatrix4(r.ship.body.matrixWorld);
  // a random point inside one of her boxes, in the world
  const inBox = (r, b, out = p) => world(r, b.min.x + Math.random() * (b.max.x - b.min.x), b.min.y + Math.random() * (b.max.y - b.min.y), b.min.z + Math.random() * (b.max.z - b.min.z), out);
  const looks = (w) => w.r.looks ?? RAIDER_LOOKS;
  function tellBlast(at, size, big, first = false) { BLAST.at.copy(at); BLAST.size = size; BLAST.big = big; BLAST.first = first; emit('blast', BLAST); }

  on('raider:down', (e) => start(e.raider, e.why));
  function start(r, why) {
    if (!r?.ship) return;
    const w = pool.find((x) => !x.r);
    const L = r.R.length, f = r.f, hb = r.zones.hullBox;
    if (w) {
      // the first two burning at once get the whole show; another, the flash and the smoke
      let busy = 0;
      for (const o of list) if (o.full && o.t < o.busy) busy++;
      Object.assign(w, { r, why, flag: null, t: 0, full: why === 'hull' && busy < WRECK.full, chain: Math.min(9, 2 + Math.round(L / 12)), fired: 0, next: 0.35, puff: 0, flick: 0, flames: 0,
        lastY: f.pos.y, crossed: false, gone: -1, told: false, burnt: false, dark: false, glint: 0, cut: false, s: THREE.MathUtils.clamp(L / 22, 0.7, 3) });
      // her masts fall (a laptop's, drawn close enough for her middle model, two ships at a time, and room for them all,
      // counting the masts of wrecks about to fall). The ships whose masts are falling: those still to crack, and those
      // with masts in the air
      let felling = 0, spare = freeFallers();
      for (const o of list) if (o.masts && !o.cut) { felling++; spare -= o.r.ship.masts.masts.length; }
      for (let i = 0; i < fallers.length; i++) { const fr = fallers[i].r; if (fr && fallers.findIndex((m) => m.r === fr) === i) felling++; }
      w.masts = w.full && !!scene && !!r.ship.masts && r.ship.level === 'middle' && felling < MASTS.ships && spare >= r.ship.masts.masts.length;
      w.busy = 0.35 + w.chain * 0.5 + 1.2;
      w.blast.set(0, (hb.min.y + hb.max.y) / 2, (hb.min.z + hb.max.z) / 2); w.puffed.copy(f.pos);
      list.push(w); f.wreck = true;
    }
    const mid = world(r, 0, (hb.min.y + hb.max.y) / 2, (hb.min.z + hb.max.z) / 2, c);
    if (why === 'hull') {
      // a white flash at her heart, a great burst of fire and sparks, planks and canvas thrown out
      fx.spark(mid, ZERO, 0.15, (60 * L) / 25, 0xffffff, 0);
      fx.burst(mid, 0xff8a3a, 60, 2.2); fx.burst(v.copy(mid).setY(mid.y + 3), 0xffe08a, 30, 1.6);
      const s = THREE.MathUtils.clamp(L / 22, 0.7, 3), lk = r.looks ?? RAIDER_LOOKS;
      debris.toss('wood', mid, UP, 1.6, f.velocity, 12, s, lk.wood); debris.toss('canvas', mid, UP, 1.6, f.velocity, 6, s, lk.sail);
      tellBlast(mid, L, L >= 40, true);
    } else if (why === 'crystals') {
      // her crystals crack open: amber shards and sparks from each column
      for (const b of r.zones.crystals) {
        if (b.isEmpty()) continue;
        b.getCenter(v); world(r, v.x, b.max.y, v.z, p);
        fx.burst(p, AMBER, 10, 0.7, 0.6); debris.toss('crystal', p, UP, 1.4, f.velocity, 6, THREE.MathUtils.clamp(L / 25, 0.8, 2.5));
      }
    } else {
      // she gives up: a white puff, and a gold glint from her hold
      smoke.emit(v.copy(mid).setY(mid.y + L * 0.1), f.velocity, 2.5, L * 0.1 + 2, L * 0.3 + 8, 1.3, 0.7, 1, 1);
      fx.spark(mid, f.velocity, 0.6, L * 0.5 + 8, GOLD, 0);
    }
  }

  let cam = null; // (the camera, this frame: the white flags face it)
  function update(dt, camera = null) {
    cam = camera;
    if (camera?.userData.pixelScale) FLAG_U.uPx.value = (camera.userData.pixelRatio ?? 1) / camera.userData.pixelScale; // (the flags' hem)
    toppling(dt);
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i], r = w.r;
      w.t += dt;
      if (r.cleared) { end(i); continue; } // (the raiders cleared away: a fresh voyage, or a test)
      // through the cloud deck: torn open, with a ring of cloud thrown out (first: she may be taken away as she goes)
      const y = r.f.pos.y;
      if (!w.crossed && w.lastY >= CLOUD_Y && y < CLOUD_Y) deck(w);
      w.lastY = y; w.at.copy(r.f.pos);
      if (r.gone) { if (after(w, dt)) end(i); continue; }
      const t = w.t, L = r.R.length, Z = r.zones, hb = Z.hullBox, vel = r.f.velocity, lk = looks(w);
      // the chain of blasts, stern to bow, each somewhere across her deck
      if (w.full) while (w.fired < w.chain && t >= w.next) {
        const k = (w.fired + 0.25 + Math.random() * 0.5) / w.chain;
        w.blast.set((Math.random() - 0.5) * (hb.max.x - hb.min.x) * 0.6, hb.max.y - Math.random() * (hb.max.y - hb.min.y) * 0.3, hb.min.z + (hb.max.z - hb.min.z) * (0.08 + 0.84 * k));
        world(r, w.blast.x, w.blast.y, w.blast.z, p);
        fx.burst(p, 0xff7a2a, 18, 0.8 + L / 100, 0.8);
        smoke.emit(p, v.copy(vel).multiplyScalar(0.5).add(UP), 2.6, 3 * w.s, 10 * w.s, 0.1, 0.85, 1, 1);
        debris.toss('wood', p, UP, 1.4, vel, 4, w.s, lk.wood);
        tellBlast(p, L * 0.4, false);
        w.fired++; w.next += 0.3 + Math.random() * 0.2;
      }
      // her crystals sputter (flickering, a few times a second), then go dark
      const C0 = w.why === 'crystals' ? 0 : WRECK.crystals[0], C1 = w.why === 'crystals' ? 1.2 : WRECK.crystals[1];
      if (w.why !== 'struck' && !w.dark) {
        if (t >= C1) { lights(r, false); w.dark = true; }
        else if (t >= C0 && (w.flick -= dt) <= 0) {
          w.flick = 0.05 + Math.random() * 0.07;
          const g = r.ship.parts.glows, e = r.ship.parts.embers;
          for (let k = 0; k < g.length; k++) g[k].visible = Math.random() < 0.45;
          for (let k = 0; k < e.length; k++) e[k].visible = Math.random() < 0.3;
        }
        // as they start to go, amber shards burst from each column
        if (w.why === 'hull' && w.full && t - dt < C0 && t >= C0) for (const b of Z.crystals) {
          if (b.isEmpty()) continue;
          b.getCenter(c); world(r, c.x, b.max.y, c.z, p);
          debris.toss('crystal', p, UP, 1.4, vel, 3, w.s); fx.burst(p, AMBER, 6, 0.5, 0.5);
        }
      }
      // her sails flare up and burn away, then fire licks the bare masts for a moment
      if (w.full && !w.burnt && t >= WRECK.sails) {
        w.burnt = true;
        for (const b of Z.sails) {
          if (b.isEmpty()) continue;
          const size = THREE.MathUtils.clamp((b.max.y - b.min.y) * 0.3, 2, 12);
          for (let k = 0, m = Math.round(6 * fx.q); k < m; k++) fx.spark(inBox(r, b), v.set(Math.random() - 0.5, 3 + Math.random() * 5, Math.random() - 0.5).add(vel), 0.6 + Math.random() * 0.5, size, FIRE[k % 3], 0.6, -2);
          b.getCenter(c); world(r, c.x, c.y, c.z, p);
          debris.toss('canvas', p, UP, 1.6, vel, 2, w.s, lk.sail);
        }
        if (!w.masts) { for (const m of r.ship.parts.canvas) m.visible = false; for (const m of r.ship.parts.flags) m.visible = false; }
      }
      // her masts crack at the deck: cut out of her hull, standing for a moment, then toppling one after another
      if (w.masts && !w.cut && t >= MASTS.from) fell(w);
      if (w.burnt && t < WRECK.sails + 0.9 && fx.room()) {
        w.flames += dt * 10 * fx.q;
        for (; w.flames >= 1; w.flames--) for (const b of Z.sails) if (!b.isEmpty()) fx.spark(inBox(r, b), v.set(0, 4 + Math.random() * 4, 0).add(vel), 0.5 + Math.random() * 0.4, THREE.MathUtils.clamp((b.max.y - b.min.y) * 0.18, 1.5, 8), FIRE[(Math.random() * 3) | 0], 0.6, -2);
      }
      // a struck ship's pennants come down their masts, and her hold glints gold now and then
      if (w.why === 'struck') struck(w, dt);
      // the column of smoke (and fire, from a burning one) until she's under the cloud deck: one broad column, each
      // puff from somewhere between her stern and the latest blast (or her middle, if no blast), with its own size, shade
      // and drift, at uneven times, so it rolls rather than running in smooth ropes; near her, a burning one's smoke is
      // thick and black, lit orange from below, and it greys as it thins away. Each puff is left hanging where she was,
      // so the column marks her fall
      const hull = w.why === 'hull';
      if (w.why !== 'struck' && r.f.pos.y > CLOUD_Y - 30 && ((w.puff -= dt) <= 0 || r.f.pos.distanceTo(w.puffed) > (L * gap + 2) * (hull ? 1 : 1.6))) {
        w.puff = every * (hull ? 1 : 1.6) * (0.7 + Math.random() * 0.6); w.puffed.copy(r.f.pos);
        if (smoke.room()) {
          const bx = hb.max.x - hb.min.x, by = hb.max.y - hb.min.y, bz = hb.max.z - hb.min.z, y0 = (hb.min.y + hb.max.y) * 0.5, z0 = hb.min.z + bz * (hull ? 0.12 : 0.5);
          for (let k = 0; k < (hull ? 2 : 1); k++) {
            const u = hull ? Math.random() : 0, f = 0.7 + Math.random() * 0.6;
            world(r, w.blast.x * u + (Math.random() - 0.5) * bx * 0.5, y0 + (w.blast.y - y0) * u + Math.random() * by * 0.25, z0 + (w.blast.z - z0) * u + (Math.random() - 0.5) * bz * (hull ? 0.1 : 0.4), p);
            v.copy(vel).multiplyScalar(0.12); v.x += (Math.random() - 0.5) * 5; v.y += 1 + Math.random() * 2.5; v.z += (Math.random() - 0.5) * 5;
            if (hull) smoke.emit(p, v, 6 + Math.random() * 2, L * 0.28 * f, (L * 0.9 + 6) * f, Math.random() < 0.15 ? 0.18 + Math.random() * 0.18 : Math.random() * 0.08, 0.72 + Math.random() * 0.2, PUFF.pour, 1.1 + Math.random() * 0.8, 0.5 + Math.random() * 0.5);
            else smoke.emit(p, v, 5 + Math.random() * 2, L * 0.2 * f, (L * 0.6 + 4) * f, 0.38 + Math.random() * 0.22, 0.5 + Math.random() * 0.2, PUFF.pour, 1.1 + Math.random() * 0.8);
            if (hull && Math.random() < 0.5 && fx.room()) fx.spark(p, v.setY(v.y + 4), 0.5 + Math.random() * 0.4, 1.2 + L * 0.08, FIRE[(Math.random() * 2) | 0], 1, -1);
          }
        }
      }
    }
  }
  // her crystals' light (the glows, and the embers drifting off them), on or off
  function lights(r, on) {
    for (const g of r.ship.parts.glows) g.visible = on;
    for (const e of r.ship.parts.embers) e.visible = on;
  }
  function struck(w, dt) {
    const r = w.r, flags = r.ship.parts.flags, t = w.t;
    // her white flag: run up her tallest mast as her pennants come down, streaming aft and fluttering
    if (t >= 2.5) {
      if (!w.flag) {
        const M = r.R.masts.reduce((a, m) => (m.height > a.height ? m : a), r.R.masts[0]), L = r.R.length;
        const size = Math.max(WHITE_FLAG.least, L * WHITE_FLAG.size);
        w.flag = new THREE.Mesh(FLAG_GEO, flagMat); w.flag.name = 'white flag'; w.flag.scale.setScalar(size); w.flagSize = size;
        w.flagTop = r.ship.hull.deckY(M.z) + M.height + size * 0.62; w.flag.position.set(0, w.flagTop * 0.55, M.z); w.flagYaw = Math.PI / 2;
        r.ship.body.add(w.flag);
      }
      const k = Math.min(1, (t - 2.5) / WHITE_FLAG.up), F = w.flag;
      F.position.y = w.flagTop * (0.55 + 0.45 * k);
      // (turned to face the camera: streaming out square to the way it's seen from, aft rather than forward; eased, so
      // it swings round rather than flipping as the camera passes her bow or stern; and grown with the distance)
      let yaw = Math.PI / 2, grow = 1;
      if (cam) {
        r.ship.body.worldToLocal(flagEye.copy(cam.position));
        const ex = flagEye.x - F.position.x, ez = flagEye.z - F.position.z, e = Math.hypot(ex, ez);
        if (e > 1) { const sx = ez / e, sz = -ex / e, aft = sz > 0 ? -1 : 1; yaw = Math.atan2(-sz * aft, sx * aft); }
        grow = THREE.MathUtils.clamp(cam.position.distanceTo(r.f.pos) / WHITE_FLAG.near, 1, WHITE_FLAG.most);
      }
      w.flagYaw += Math.atan2(Math.sin(yaw - w.flagYaw), Math.cos(yaw - w.flagYaw)) * (1 - Math.exp(-dt * 4));
      F.rotation.y = w.flagYaw + Math.sin(t * 5.3) * 0.22; F.rotation.x = Math.sin(t * 7.1) * 0.08;
      F.scale.setScalar(w.flagSize * grow);
    }
    if (t < 2.6) {
      for (const m of flags) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const drop = Math.max(1, m.geometry.boundingBox.max.y - r.zones.hullBox.max.y);
        m.position.y = -drop * Math.min(1, t / 2.5);
        if (t >= 2.5) m.visible = false;
      }
    }
    if (r.role === 'prize' && t < 4 && (w.glint -= dt) <= 0) {
      w.glint = 0.3 + Math.random() * 0.3;
      inBox(r, r.zones.hullBox); p.y += 1;
      fx.spark(p, r.f.velocity, 0.4, 3 + r.R.length * 0.08, GOLD, 0);
    }
  }
  // falling through the cloud deck
  function deck(w) {
    const r = w.r, L = r.R.length, x = r.f.pos.x, z = r.f.pos.z;
    w.crossed = true;
    for (let k = 0, n = Math.round(14 * fx.q); k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.3, cx = Math.cos(a), sz = Math.sin(a);
      smoke.emit(p.set(x + cx * L * 0.6, CLOUD_Y + 4, z + sz * L * 0.6), v.set(cx * 12, 2, sz * 12), 4, L * 0.3 + 6, L * 0.6 + 28, 1.3, 0.7, 1, 0.4);
    }
    if (tear) tear(x, z, L * 0.9 + 25);
    DECK.at.set(x, CLOUD_Y, z); DECK.size = L; emit('wreck:deck', DECK);
  }
  // after she's gone: a burning wreck that fell through the deck glows orange under it a moment later; true when done
  function after(w, dt) {
    if (w.gone < 0) w.gone = 0; else w.gone += dt;
    if (w.gone < 0.4) return false;
    const fire = w.crossed && w.why === 'hull', L = w.r.R.length;
    if (!w.told) { w.told = true; GONE.at.copy(w.at); GONE.size = L; GONE.fire = fire; emit('wreck:gone', GONE); }
    if (!fire) return true;
    const k = (w.gone - 0.4) / 0.9;
    if (k >= 1) return true;
    const pulse = (0.65 + 0.35 * Math.sin(w.gone * 19)) * (1 - k) * (1 - k);
    fx.glowAt(p.set(w.at.x, CLOUD_Y - 60, w.at.z), 1, 0.45 * pulse + 0.2, 0.12, (90 + L * 1.5) * (0.6 + 0.4 * pulse));
    return false;
  }
  function end(i) { const w = list[i]; w.r = null; list.splice(i, 1); }
  function clear() { while (list.length) end(list.length - 1); for (const m of fallers) if (m.r) letGo(m); }

  // ---------- falling masts (a laptop's) ----------
  // a few kept and used over and over: a group holding a mast's wood, brass and canvas, pivoting at its foot
  const fallers = Array.from({ length: 6 }, () => {
    const g = new THREE.Group(), meshes = FALL.map((name) => { const m = new THREE.Mesh(); m.name = name; m.castShadow = false; m.frustumCulled = false; g.add(m); return m; });
    g.name = 'falling mast';
    return { g, meshes, r: null, at: 0, H: 1, th: 0, om: 0, side: 1, free: false, t: 0, smoke: 0, top0: 0, v: new THREE.Vector3(), axis: new THREE.Vector3(), prev: new THREE.Vector3() };
  });
  const freeFallers = () => { let n = 0; for (const m of fallers) if (!m.r) n++; return n; };
  const tq = new THREE.Quaternion(), tm = new THREE.Vector3();
  // the moment her masts crack: her middle model keeps only her hull, and each mast stands in its own group, on her
  function fell(w) {
    const r = w.r, S = r.ship, cut = S.masts, M = S.parts.meshes;
    w.cut = true;
    for (const name in cut.keep) if (M[name]) M[name].geometry = cut.keep[name];
    // (her far model, drawn once she's fallen far enough away, loses its masts too, and its sails and rigging)
    const FM = S.parts.farMeshes;
    for (const name in cut.farKeep) if (FM[name] && name !== 'canvas') FM[name].geometry = cut.farKeep[name];
    for (const m of S.parts.farRig) m.visible = false;
    cut.masts.forEach((mast, i) => {
      const m = fallers.find((x) => !x.r);
      if (!m) return;
      Object.assign(m, { r, at: i * MASTS.every + Math.random() * 0.15, H: mast.height, th: 0, om: 0, side: r.f.down.roll || 1, free: false, t: 0, smoke: 0 });
      m.meshes.forEach((mesh, k) => {
        const geo = mast.geo[FALL[k]];
        mesh.visible = !!geo && !!M[FALL[k]]; if (!mesh.visible) return;
        mesh.geometry = geo; mesh.material = M[FALL[k]].material; mesh.position.copy(mast.pivot).negate();
      });
      m.g.position.copy(mast.pivot); m.g.rotation.set(0, 0, 0); m.g.scale.set(1, 1, 1);
      S.body.add(m.g); m.g.updateMatrixWorld(true);
      m.top0 = tm.set(0, m.H - 1, 0).applyMatrix4(m.g.matrixWorld).y;
      m.prev.set(0, (m.H - 1) / 2, 0).applyMatrix4(m.g.matrixWorld);
    });
  }
  // each frame: one standing waits its turn; toppling, it swings over faster and faster (a falling pole); past the
  // breaking angle it breaks away and tumbles down on its own, trailing smoke from its top, until it's below the clouds
  function toppling(dt) {
    for (const m of fallers) {
      const r = m.r;
      if (!r) continue;
      if (r.cleared || (!m.free && r.gone)) { letGo(m); continue; }
      m.t += dt;
      if (!m.free) {
        if (m.t >= m.at) {
          if (!m.om) m.om = 0.5 + Math.random() * 0.3; // (cracked by a blast: it starts to go with a jolt)
          m.om += (3 * 9.8 / (2 * m.H)) * Math.sin(m.th + 0.1) * dt; m.th += m.om * dt;
          m.g.rotation.z = m.side * m.th;
        }
        m.g.updateMatrixWorld(true);
        tm.set(0, (m.H - 1) / 2, 0).applyMatrix4(m.g.matrixWorld);
        if (m.th > MASTS.breaks) {
          // she lets it go: it keeps the speed it had, and keeps turning the way it fell
          m.v.copy(tm).sub(m.prev).divideScalar(Math.max(dt, 1e-3));
          m.axis.set(0, 0, 1).transformDirection(r.ship.body.matrixWorld);
          scene.attach(m.g); m.free = true; m.t = 0;
        }
        m.prev.copy(tm);
        continue;
      }
      m.v.y -= 9.8 * dt; m.g.position.addScaledVector(m.v, dt);
      m.g.quaternion.premultiply(tq.setFromAxisAngle(m.axis, m.side * m.om * dt)); m.om *= Math.exp(-dt * 0.4);
      m.g.updateMatrixWorld(true);
      // (its trail: each puff its own size and shade, a little off the line and at uneven times, so the trail rolls
      // rather than stringing out like beads)
      if ((m.smoke -= dt) <= 0) {
        m.smoke = 0.045 + Math.random() * 0.03;
        tm.set((Math.random() - 0.5) * 1.6, m.H - 1 - Math.random() * 2, (Math.random() - 0.5) * 1.6).applyMatrix4(m.g.matrixWorld);
        const f = 0.7 + Math.random() * 0.6;
        if (smoke.room()) smoke.emit(tm, v.set((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2), 3 + Math.random(), (2.2 + m.H * 0.1) * f, (6 + m.H * 0.45) * f, 0.08 + Math.random() * 0.22, 0.5 + Math.random() * 0.25, PUFF.pour, 1, 0.7);
        if (Math.random() < 0.4 && fx.room()) fx.spark(tm, v.set(0, 3, 0), 0.5, 1 + m.H * 0.05, FIRE[(Math.random() * 3) | 0], 1, -1);
      }
      // gone once all of it is under the cloud deck (its foot more than its height below); or, kept too long, shrunk away
      if (m.g.position.y < CLOUD_Y - m.H - 15 || m.t > MASTS.life) letGo(m);
      else if (m.t > MASTS.life - MASTS.fade) m.g.scale.setScalar(Math.max(0.01, (MASTS.life - m.t) / MASTS.fade));
    }
  }
  function letGo(m) { m.g.removeFromParent(); m.r = null; m.free = false; }
  // for tests: the masts falling now: which (of the few kept), broken away or not, how far its top has come down, how
  // high its foot is and how tall it is (metres), and its size (1, or less as it shrinks away)
  const falling = () => fallers.map((m, i) => ({ m, i })).filter((x) => x.m.r).map(({ m, i }) => ({ i, free: m.free, fell: +(m.top0 - tm.set(0, m.H - 1, 0).applyMatrix4(m.g.matrixWorld).y).toFixed(1),
    y: +m.g.getWorldPosition(tm).y.toFixed(1), H: +m.H.toFixed(1), s: +m.g.scale.x.toFixed(2) }));
  // (a white flag of its own, never drawn, for main.js to have its drawing made ready as each voyage starts)
  const warmFlag = new THREE.Mesh(FLAG_GEO, flagMat);
  return { list, update, clear, start, falling, flagToWarm: () => warmFlag };
}
