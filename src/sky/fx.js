// fx.js: the effects engine, and how a fight feels. It owns every spark, flash and glowing point in the sky (in one
// batch with the bolts' heads), the smoke and the debris (effects.js), and the camera's shake and kick, and it listens
// to the game's news (events.js) to answer it:
//   a gun going off      a tongue of flame out of its muzzle and a billow of white-grey gunsmoke; the Captain's own guns
//                        shove the view back a little each (a broadside rolls like thunder), and buzz an Android phone,
//                        and their smoke thins and drifts aside where it lies across her view of her target
//   a shot landing       a burst of sparks the colour of what it hit, and what it knocks off: splinters from the hull
//                        and a puff of dust, scraps of canvas in her sails' colour, or glittering crystal shards; hits
//                        on the Captain's ship shake the view (the hull hardest), lurch it towards the side hit, and
//                        buzz the phone
//   a near miss          a flash of white sparks where it passed, and a twitch of the view
//   a blast              (a raider blowing up: wrecks.js) shakes the view when it's close
//   a raider going down  a longer buzz (but not a treasure ship striking her colours: she gives up quietly)
//   shards spilled       a gold flash and a spray of gold sparks; each shard gathered, a little gold glint at the hold
//   a Surge              a jolt (how it looks: surge.js)
//   the Captain's ship going down: the game slows to half speed for a moment
// The sparks live in plain number arrays made once (a fixed number: 1,100 on a laptop, 700 on a phone), so a fight
// leaves nothing for a phone to clear away; when every spark is in use the oldest-placed is reused and counted as
// `dropped`. Every count asked for is scaled by `q`: 1 on a laptop, 0.6 on a phone (less with the Settings card's
// picture set lower). Points are drawn no bigger than a phone can fill quickly.
// The time dial (slowmo, timeScale) slows the game's clock for a moment; tests step the game directly, at full speed.
// Players whose device asks for less motion get 0.3 of the shake and kick, and no buzzing.
import * as THREE from 'three';
import { upload, KINDS } from './guns.js';
import { makeSmoke, makeDebris, PUFF } from './effects.js';
import { on, emit, payload } from './events.js';

export const MOTION = 0.3; // the share of shake and kick kept for reduced motion
export const SHAKE = { pos: 0.5, yaw: 0.07, pitch: 0.06, roll: 0.08 }; // the view's shake at full trauma (metres, radians)
const K = 130, C = 2 * 0.9 * Math.sqrt(K); // the kick springs: back to rest about half a second after the last shove
// a shot landing: the sparks' colour, how many, and how big, by what it hit (fewer than before the debris came)
const BURST = { hull: [0xffa040, 18, 1.1], sails: [0xf5e6c8, 11, 0.8], crystals: [0xffe08a, 24, 1.4] };
// the debris a ship sheds: her planks' and her sails' colours (a raider's are set on her: raiders.js)
export const PLAYER_LOOKS = { wood: 0x9a7650, sail: 0xf2e6cc }, RAIDER_LOOKS = { wood: 0x6e5440, sail: 0xc8735c };
const GOLD = 0xffd27a;
const noise = (t, a, b) => Math.sin(t * 23.1 + a) * 0.6 + Math.sin(t * 37.7 + b) * 0.4; // smooth, never repeating quite the same
const CAM = ['back', 'pitch', 'side', 'fov'];

export function makeFx({ scene, camera, touch = false }) {
  // q: the share of sparks, smoke and debris asked for that's made; the Settings card's picture can turn it down (or
  // up, to `Q`, what the batches were made room for: setQuality). `shake`: off, the view holds still (Settings)
  const Q = touch ? 0.6 : 1;
  let q = Q, shake = 1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'), motion = () => (reduce.matches ? MOTION : 1) * shake;

  // ---------- the glows: sparks, flashes, the bolts' heads and anything lit for one frame, in one batch ----------
  const SCAP = touch ? 700 : 1100, GCAP = 720, GMAX = SCAP + GCAP;
  const gpos = new Float32Array(GMAX * 3), gcol = new Float32Array(GMAX * 3), gsize = new Float32Array(GMAX);
  const ggeo = new THREE.BufferGeometry();
  ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3).setUsage(THREE.DynamicDrawUsage));
  ggeo.setAttribute('color', new THREE.BufferAttribute(gcol, 3).setUsage(THREE.DynamicDrawUsage));
  ggeo.setAttribute('size', new THREE.BufferAttribute(gsize, 1).setUsage(THREE.DynamicDrawUsage));
  ggeo.setDrawRange(0, 0);
  const gmat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 }, uMax: { value: touch ? 260 : 420 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float size; varying vec3 vC; uniform float uScale; uniform float uMax; void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * uScale / -mv.z, uMax); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.0); if (a < 0.01) discard; gl_FragColor = vec4(vC * a, a); }',
    vertexColors: true,
  });
  const glows = new THREE.Points(ggeo, gmat); glows.frustumCulled = false; glows.renderOrder = 4; scene.add(glows);

  // sparks: where, how they fly, how long they last, how big, their colour, how fast the air slows them, and gravity
  const F = (n) => new Float32Array(n);
  const sx = F(SCAP), sy = F(SCAP), sz = F(SCAP), svx = F(SCAP), svy = F(SCAP), svz = F(SCAP), slife = F(SCAP), sfull = F(SCAP), ssize = F(SCAP),
    sr = F(SCAP), sg = F(SCAP), sb = F(SCAP), sdrag = F(SCAP), sgrav = F(SCAP);
  const SARR = [sx, sy, sz, svx, svy, svz, slife, sfull, ssize, sr, sg, sb, sdrag, sgrav];
  let ns = 0, cursor = 0, dropped = 0, peak = 0;
  const col = new THREE.Color(); // (colours are given as 0xrrggbb, turned into the light the shader adds, like three.js does)
  // a spark at p flying at v (both read, not kept), for `life` seconds, `size` metres across
  function spark(p, v, life, size, hex, drag = 1.5, grav = 0) {
    let i;
    if (ns < SCAP) i = ns++;
    else { i = cursor; cursor = (cursor + 1) % SCAP; dropped++; }
    col.setHex(hex);
    sx[i] = p.x; sy[i] = p.y; sz[i] = p.z; svx[i] = v.x; svy[i] = v.y; svz[i] = v.z; slife[i] = sfull[i] = life; ssize[i] = size;
    sr[i] = col.r; sg[i] = col.g; sb[i] = col.b; sdrag[i] = drag; sgrav[i] = grav;
    if (ns > peak) peak = ns;
  }
  const ZERO = new THREE.Vector3(), sv = new THREE.Vector3(), sp = new THREE.Vector3();
  // a burst of sparks flying out from p, with a flash at its heart: `n` sparks (fewer on a phone), `power` bigger and
  // faster, `flash` the flash's size (smaller for hits right in front of the camera, on the Captain's own ship)
  function burst(p, hex = 0xffc070, n = 26, power = 1, flash = 1) {
    spark(p, ZERO, 0.5, 30 * power * flash, hex);
    const m = Math.round(n * q);
    for (let i = 0; i < m; i++) {
      sv.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(20 + Math.random() * 40 * power);
      spark(p, sv, 0.6 + Math.random() * 0.8, 2.5 + Math.random() * 3, i % 3 ? hex : 0xffffff, 1.5, 4);
    }
  }
  // a glowing point for this frame only (a bolt's head, a gun port glowing before a broadside): nothing is kept
  const gx = F(GCAP), gy = F(GCAP), gz = F(GCAP), gr = F(GCAP), gg = F(GCAP), gb = F(GCAP), gs = F(GCAP);
  let ng = 0;
  function glowAt(p, r, g, b, size) {
    if (ng >= GCAP) return;
    gx[ng] = p.x; gy[ng] = p.y; gz[ng] = p.z; gr[ng] = r; gg[ng] = g; gb[ng] = b; gs[ng++] = size;
  }

  const smoke = makeSmoke(scene, touch ? 600 : 900, touch ? 420 : 700), debris = makeDebris(scene, Q, glowAt);
  // room for sparks that can be left out (a wreck's fire, the Surge's), so a fight's own always find room
  const room = (share = 0.85) => ns < SCAP * share;

  // ---------- the camera: trauma (shake) and kicks (springs back to rest) ----------
  const cam = { trauma: 0, back: 0, pitch: 0, side: 0, fov: 0 }, camV = { back: 0, pitch: 0, side: 0, fov: 0 };
  let clock = 0;
  const trauma = (a) => { cam.trauma = Math.min(1, cam.trauma + a); };
  // shove the view: back (metres, away from the ship), pitch (radians, up), FOV (degrees wider), side (metres, right)
  function kick(back, pitch = 0, fov = 0, side = 0) {
    const m = motion();
    cam.back += back * m; cam.pitch += pitch * m; cam.fov += fov * m; cam.side += side * m;
  }
  const R = new THREE.Vector3(), U = new THREE.Vector3();
  // after camera.lookAt: move and turn the camera by the kick and shake (look: which way it looks)
  function applyCamera(camera, look) {
    const s = cam.trauma * cam.trauma * motion(), t = clock;
    R.set(1, 0, 0).applyQuaternion(camera.quaternion); U.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(R, noise(t, 0, 1.3) * s * SHAKE.pos + cam.side).addScaledVector(U, noise(t, 2.1, 4.7) * s * SHAKE.pos).addScaledVector(look, -cam.back);
    camera.rotateX(cam.pitch + noise(t, 5.3, 0.4) * s * SHAKE.pitch);
    camera.rotateY(noise(t, 3.7, 2.9) * s * SHAKE.yaw);
    camera.rotateZ(noise(t, 1.9, 6.1) * s * SHAKE.roll);
  }

  // ---------- the time dial ----------
  // slowmo(seconds, low, hold): the game slows to `low` of its speed in an eighth of a second, stays there until `hold`
  // seconds, and is back to full speed by `seconds` (all real time). Each frame's time is scaled by timeScale(realDt);
  // tests step the game directly, so they never slow down
  const SLOW = payload('slowmo');
  let dial = 1, st = -1, sFrom = 1, sLow = 1, sHold = 0, sEnd = 0;
  function slowmo(seconds, low = 0.25, hold = seconds * 0.625) {
    st = 0; sFrom = dial; sLow = low; sHold = hold; sEnd = seconds;
    trauma(0.15);
    SLOW.seconds = seconds; SLOW.scale = low; emit('slowmo', SLOW);
  }
  function timeScale(realDt) {
    if (st < 0) return (dial = 1);
    const t = (st += realDt);
    if (t >= sEnd) { st = -1; return (dial = 1); }
    if (t < 0.12) dial = sFrom + (sLow - sFrom) * (t / 0.12);
    else if (t < sHold) dial = sLow;
    else { const k = (t - sHold) / (sEnd - sHold); dial = sLow + (1 - sLow) * k * k * (3 - 2 * k); }
    return dial;
  }

  // ---------- buzzing an Android phone (iPhones have no way to; nor do laptops) ----------
  const canBuzz = touch && typeof navigator.vibrate === 'function';
  const PULSES = [0, 1, 2, 3, 4, 5, 6].map((n) => Array.from({ length: n * 2 - 1 }, (_, i) => (i % 2 ? 45 : 8))); // a volley: a pulse a gun, at most six
  function buzz(pattern) {
    if (!canBuzz || reduce.matches || navigator.userActivation?.hasBeenActive === false) return;
    try { navigator.vibrate(pattern); } catch { /* not allowed here */ }
  }

  // ---------- answering the game's news ----------
  let focus = null, ship = null; // where the Captain is (blasts near her shake the view), and her ship (flight.js)
  const fp = new THREE.Vector3(), fv = new THREE.Vector3(), cs = new THREE.Vector3(), hb = new THREE.Vector3(), hv = new THREE.Vector3();
  on('fire', (e) => {
    const ks = KINDS[e.kind].size, big = e.kind === 'broadside' ? 1 : 0.6, mine = e.owner === 'player';
    // a tongue of flame: three glows along the barrel, carried along with the ship, white-gold to orange
    for (let i = 1; i <= 3; i++) spark(fp.copy(e.p).addScaledVector(e.dir, i * 1.1 * ks), e.vel, 0.1, (i === 1 ? 10 : i === 2 ? 7 : 4.5) * ks, i === 1 ? 0xfff2c0 : i === 2 ? 0xffc060 : 0xff8a30, 0);
    for (let i = 0, m = Math.round(2 * q); i < m; i++) spark(e.p, fv.copy(e.vel).addScaledVector(e.dir, KINDS[e.kind].speed * 0.04).add(sp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6)), 0.5, 2.2, 0xff9a3a);
    // and powder smoke, white-grey, billowing out of the port: a jet blasting out a dozen metres or so and spreading
    // wide, and (on a laptop) a slower cloud behind it that keeps more of her speed, so the bank she leaves rolls back
    // along her side as she sails on. Thick at first, it thins away over five seconds. (A phone gets the jet alone, as
    // many puffs as ever but each much bigger, rising a little more and lasting longer, so a broadside still leaves a
    // bank of smoke along her side that shows over her deck; and it smokes every other port of a big raider broadside).
    // The Captain's own is marked as hers, so it keeps off the line to the raider her guns are locked on to (effects.js)
    if (!(touch && !mine && e.n > 8 && e.i % 2)) {
      const s = big * (0.85 + Math.random() * 0.3);
      fv.copy(e.vel).multiplyScalar(0.7).addScaledVector(e.dir, 32 * big); fv.y += 2.5;
      smoke.emit(fp.copy(e.p).addScaledVector(e.dir, 1.5), fv, touch ? 7 : 4.5, (touch ? 4.5 : 3) * s, (touch ? 36 : 19) * s, 0.52 + Math.random() * 0.14, mine ? (touch ? 0.95 : 0.92) : 0.85, PUFF.gun, touch ? 1.1 : 0.7, 0, mine);
      if (!touch) {
        fv.copy(e.vel).multiplyScalar(0.95).addScaledVector(e.dir, 10 * big).add(sp.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(5));
        smoke.emit(fp.copy(e.p).addScaledVector(e.dir, 3), fv, 5.5, 4 * s, 25 * s, 0.6 + Math.random() * 0.14, 0.8, PUFF.bank, 1, 0, mine);
      }
    }
    if (mine) { kick(0.22 * e.weight * (e.kind === 'broadside' ? 1 : 0.5), 0.004, 0.35); trauma(0.015); }
  });
  on('volley', (e) => { if (e.owner === 'player') buzz(PULSES[Math.min(6, e.count)]); });
  on('hit', (e) => {
    const B = BURST[e.part], mine = e.target === 'player', rk = e.raked ? 1.6 : 1; // (raking fire bursts bigger: tactics.js)
    burst(e.at, B[0], B[1], B[2] * rk, (mine ? 0.45 : 1) * rk);
    // what it knocks off, thrown back the way the shot came: splinters and a puff of dark dust from the hull, scraps
    // of canvas and a pale puff from the sails, glittering shards from the crystals
    const looks = mine ? PLAYER_LOOKS : e.raider?.looks ?? RAIDER_LOOKS, back = hb.copy(e.dir).negate();
    if (e.part === 'hull') {
      debris.toss('wood', e.at, back, 1.2, e.vel, 6, 1.4, looks.wood);
      smoke.emit(e.at, hv.copy(e.vel).multiplyScalar(0.85), 1.4, 2, 7, 0.3, 0.7, 1, 0.5);
    } else if (e.part === 'sails') {
      debris.toss('canvas', e.at, back, 1.2, e.vel, 4, 1, looks.sail);
      smoke.emit(e.at, hv.copy(e.vel).multiplyScalar(0.85), 0.8, 1, 4, 0.9, 0.5, 1, 0.3);
    } else debris.toss('crystal', e.at, back, 1.2, e.vel, 8, 1);
    // a treasure ship's hull bleeds gold where it's hit
    if (!mine && e.part === 'hull' && e.raider?.role === 'prize') burst(e.at, 0xffd54a, 10, 0.6, 0.5);
    if (!mine) return;
    const sev = Math.min(1.5, e.damage / 55);
    trauma((e.part === 'hull' ? 0.35 : e.part === 'crystals' ? 0.3 : 0.15) * sev);
    cs.copy(e.at).applyMatrix4(camera.matrixWorldInverse);
    kick(0, 0, 0, Math.sign(cs.x) * 0.6 * sev); // towards the side that was hit
    buzz(30);
  });
  on('nearMiss', (e) => {
    for (let i = 0; i < 3; i++) spark(e.at, sv.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14), 0.3, 2.4, 0xffffff);
    trauma(0.05);
  });
  on('raider:down', (e) => { if (e.why !== 'struck') buzz(60); }); // (her end in the sky: wrecks.js; a treasure ship giving up gets none)
  on('blast', (e) => { if (focus) { const d = focus.distanceTo(e.at); if (d < 250) trauma(0.25 * (1 - d / 250) * (e.big ? 1.4 : 1)); } });
  on('surge', () => trauma(0.2));
  // one of a Man-o'-war's crystal columns blowing out: a shower of gold and violet sparks, and a jolt if it's close
  on('blowout', (e) => {
    burst(e.at, 0xffe08a, 50, 1.8, 1.6); burst(e.at, 0xb25cff, 30, 1.4, 0.8);
    if (focus) { const d = focus.distanceTo(e.at); if (d < 400) trauma(0.2 * (1 - d / 400)); }
  });
  // shards spilling out of a wreck: a gold flash and a spray of gold; each one gathered: a little glint at the hold
  on('shards:spill', (e) => {
    spark(e.at, ZERO, 0.35, 25, GOLD, 0);
    for (let i = 0, m = Math.round(20 * q); i < m; i++) spark(e.at, sv.set(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(6 + Math.random() * 14), 0.6 + Math.random() * 0.5, 1.6, i % 4 ? GOLD : 0xffffff, 1.2, 2);
  });
  on('shards:gather', (e) => {
    for (let i = 0, m = Math.max(1, Math.round(3 * q)); i < m; i++) {
      fv.set(Math.random() - 0.5, Math.random() + 0.2, Math.random() - 0.5).multiplyScalar(6); if (ship) fv.add(ship.velocity);
      spark(e.at, fv, 0.35, 1.3, GOLD, 0.5, 0);
    }
  });
  // the Captain's ship going down: the world slows to half speed for a moment
  on('player:down', () => slowmo(1, 0.5));

  // ---------- every frame ----------
  function update(dt) {
    clock += dt;
    debris.update(dt); // (first: its crystal shards' glitter is lit for this frame)
    // the camera's shake fades, and its kicks spring back
    cam.trauma = Math.max(0, cam.trauma - dt * 1.6);
    for (let i = 0; i < 4; i++) { const k = CAM[i], v = camV[k] + (-K * cam[k] - C * camV[k]) * dt; camV[k] = v; cam[k] += v * dt; }
    // sparks fly, slow and fall; a spent one is swapped for the last
    for (let i = ns - 1; i >= 0; i--) {
      if ((slife[i] -= dt) <= 0) { const j = --ns; if (i !== j) for (let a = 0; a < SARR.length; a++) SARR[a][i] = SARR[a][j]; continue; }
      const d = 1 - dt * sdrag[i];
      svy[i] -= sgrav[i] * dt;
      sx[i] += svx[i] * dt; sy[i] += svy[i] * dt; sz[i] += svz[i] * dt;
      svx[i] *= d; svy[i] *= d; svz[i] *= d;
    }
    // into the batch: this frame's glows, then the sparks, fading as they go
    let n = 0;
    for (let i = 0; i < ng; i++, n++) {
      gpos[n * 3] = gx[i]; gpos[n * 3 + 1] = gy[i]; gpos[n * 3 + 2] = gz[i]; gcol[n * 3] = gr[i]; gcol[n * 3 + 1] = gg[i]; gcol[n * 3 + 2] = gb[i]; gsize[n] = gs[i];
    }
    ng = 0;
    for (let i = 0; i < ns; i++, n++) {
      const k = slife[i] / sfull[i];
      gpos[n * 3] = sx[i]; gpos[n * 3 + 1] = sy[i]; gpos[n * 3 + 2] = sz[i]; gcol[n * 3] = sr[i] * k; gcol[n * 3 + 1] = sg[i] * k; gcol[n * 3 + 2] = sb[i] * k; gsize[n] = ssize[i] * (0.6 + 0.4 * k);
    }
    ggeo.setDrawRange(0, n);
    upload(ggeo.attributes.position, n); upload(ggeo.attributes.color, n); upload(ggeo.attributes.size, n);
    if (camera.userData.pixelScale) gmat.uniforms.uScale.value = camera.userData.pixelScale;
    smoke.update(dt, camera);
  }
  // a fresh voyage: no sparks, smoke, shake or kick left over
  function clear() {
    ns = 0; ng = 0; cursor = 0; ggeo.setDrawRange(0, 0); smoke.clear(); debris.clear();
    for (const k of CAM) { cam[k] = 0; camV[k] = 0; } cam.trauma = 0; st = -1; dial = 1;
  }
  return {
    get q() { return q; }, touch, spark, burst,
    // the share of effects made (Settings: picture), at most what the batches were made room for
    setQuality(v) { q = Math.min(Q, v); debris.share = q / Q; },
    // the view's shake and kick on (1) or off (0) (Settings: camera shake)
    set shake(v) { shake = v ? 1 : 0; }, get shake() { return shake > 0; }, glowAt, smoke, debris, room, cam, trauma, kick, applyCamera, slowmo, timeScale, update, clear, buzz,
    // the Captain's ship (flight.js), for the blasts near her and the glints at her hold
    follow: (flyer) => { ship = flyer; focus = flyer.pos; },
    get dial() { return dial; }, get timeScaleNow() { return dial; },
    points: glows, // (the batch of glows itself: tests hide it to see what a shot's own streaks draw)
    // how far into a slow motion the game is, 0 (none) to 1 (as slow as it gets): the view narrows with it
    get slowness() { return st < 0 ? 0 : Math.min(1, (1 - dial) / 0.75); },
    // for tests: how many sparks, puffs and pieces of debris are alive, the most sparks seen, and how many were cut
    // short for room
    stats: () => ({ sparks: ns, sparkCap: SCAP, peak, dropped, puffs: smoke.count, puffCap: smoke.max, puffsDropped: smoke.dropped, debris: debris.stats() }),
    resetStats: () => { peak = ns; dropped = 0; debris.resetStats(); },
  };
}
