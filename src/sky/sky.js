// sky.js: the sky director, at sea. It owns the look of the voyage's sky and the weather in it, in one place, and the
// rest of the game reads from it. The light stays the late afternoon's (world.js DAY: Chris chose no day turning to
// night); what changes it:
//   each region's air   crossing into a region blends a little of its air in over a few seconds (world.js
//                       REGION_AIR): the Sunscorch Wastes warm and hazy with dust drifting by, the Ironspire Peaks cold
//                       and clear with snow on the wind, the Gloomfen low and misty with pale motes, the Gloamwood dusky
//                       violet, the Hearthsea clear and bright, the Wilds green, the Open Sea deep blue
//   storms              some waves bring a storm (progress.js SKIES storms). While the card before it is up the storm
//                       shows on one side of the sky, a dark wall of cloud over that horizon (front); as the wave comes
//                       it rolls in over 20 s (startStorm): slate cloud, thick and low, the light dimming, rain
//                       streaking past, lightning forking down into the clouds a few kilometres off with a flash that
//                       lights the ship, and the wind blowing harder, in gusts. When the wave is beaten it clears over
//                       20 s (clearWeather)
//   clouds              inside a cloud (one of the big ones, or the cloud floor), mist streams past and the world fades
//                       into it (the haze closing in to a few hundred metres); scraps of scud drift by near the clouds
//                       and in a storm, to feel the speed against. cloudAt(p) says how deep in cloud any point is
//   hiding              a ship deep in cloud is hidden: raiders more than a little way off can't see the Captain there
//                       (raiders.js) until her own guns give her away for a few seconds (reveal), and the Captain's guns
//                       can't lock on to a raider hidden far off (unless she's readying a broadside: her gun ports glow
//                       through the cloud), and only while the cloud as it's drawn really hides most of her from the
//                       camera (world.js veil: a ship nearer than a cloud's middle is drawn in front of it, and the
//                       cloud's picture is thin at its edges). Inside a cloud the raiders aim worse at her
//   and                 her shadow on the cloud floor with the glory round it, the sun's glare when you look into it
// Its news (events.js): storm (coming, here, passing), lightning, gust and hidden. Nothing here is made while the game
// runs; each frame only numbers are written.
import * as THREE from 'three';
import { DAY, STORM, REGION_AIR, REGION_LOOK, AIR_SHARE, mixLook, regionAt, coverAt, CLOUD_Y, SUN } from './world.js';
import { makeAir, makeLightning, makeVeil, makeScud, makeGlare, AIR } from './weather.js';
import { WIND } from './flight.js';
import { emit, payload } from './events.js';

// hiding in cloud: how deep in it a ship must be (0 to 1), how near a raider can still see the Captain there on each
// skies (raiders.js uses the skies' own `sight`), how near the Captain still sees a raider hidden in it, how long the
// Captain's guns give her away for, and how little of a raider deep in cloud must show through it, as it's drawn, for
// her to be lost to the Captain's sight (`shows`: under the first share she's lost; she's found again over the second,
// so her tag doesn't flicker between the two)
export const HIDE = { thick: 0.6, near: 250, reveal: 4, shows: [0.3, 0.4] };
// where a raider is looked for through the clouds, in her own frame, from her hit zones (damage.js): her hull's middle,
// bow and stern, her sails' middle and their upper part, each weighing as much of her as it shows
const SPOT_WEIGHT = [0.3, 0.2, 0.2, 0.2, 0.1];
function spotsOf(Z) {
  const h = Z.hullBox, s = new THREE.Box3(), V = THREE.Vector3;
  for (const b of Z.sails) if (!b.isEmpty()) s.union(b);
  const y = (h.min.y + h.max.y) / 2, z = (h.min.z + h.max.z) / 2, L = h.max.z - h.min.z;
  const out = [new V(0, y, z), new V(0, y, z + L * 0.35), new V(0, y, z - L * 0.35)];
  if (s.isEmpty()) out.push(new V(0, h.max.y, z), new V(0, h.max.y, z));
  else out.push(new V(0, (s.min.y + s.max.y) / 2, (s.min.z + s.max.z) / 2), new V(0, s.min.y + (s.max.y - s.min.y) * 0.85, (s.min.z + s.max.z) / 2));
  return out;
}
// the cloud floor's thickness: from 58 m under it to 16 m over it (fully between 40 under and 6 over), as thick as
// the cloud there
const FLOOR = { below: 58, under: 40, over: 6, above: 16 };
// a storm: how long it takes to roll in and to clear (s), how strong its wind (a share of top speed, before gusts), how
// much the gusts add (0.3: 30%), how often they come (s), how often lightning strikes (s) and how far off (m)
export const STORMS = { roll: 20, front: 10, wind: [0.16, 0.24], gust: 0.3, gustEvery: [5, 11], strike: [4, 12], far: [1500, 5000] };
const SUNWARD = [150, 450, 900]; // (how far along the sun's ray a big cloud is looked for, to block its glare)
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const ease = (v, to, dt, tau) => v + (to - v) * (1 - Math.exp(-dt / tau));
const rnd = (a, b) => a + Math.random() * (b - a);

// `world` (world.js), `lights` (the sun's light, the sky's and the scene), `fx` (fx.js: a gust shakes the view)
export function makeSky({ world, lights, scene, renderer, touch = false, fx = null }) {
  const gl = renderer.getContext(), most = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)?.[1] ?? 256; // (the biggest point the card draws)
  const air = makeAir(touch), bolt = makeLightning(), veil = makeVeil(world.uCloud, world.mood), scud = makeScud(world.puffs.mesh.material.uniforms.uMap.value, world.mood, touch), glare = makeGlare();
  scene.add(air.mesh, bolt.mesh, veil.mesh, scud.mesh, glare.mesh);
  const M = world.mood, puffs = world.puffs;
  // the look: the afternoon with the region's air in it (`airLook`, eased toward the region's own), then the storm over
  // that (`look`, what's drawn); each kept, and written into, never made again
  const airLook = mixLook(DAY, DAY, 0), base = mixLook(DAY, DAY, 0), look = mixLook(DAY, DAY, 0);
  // the weather now: storm 0 to 1 (and wanted), the front showing on the horizon (and wanted), the way it comes from
  // (a bearing, as a heading), the lightning's flash, the rain falling (0 to 1), the motes in the region's air, the
  // mist round the camera, how deep the Captain's ship is in cloud (`inCloud`), and the scud
  const W = { storm: 0, want: 0, front: 0, frontWant: 0, from: 0, flash: 0, flashT: 9, strike: 6, lightningCount: 0, gust: 0, gustT: 0, gustNext: 6, windStorm: 0.2,
    flashK: 1, rain: 0, motes: 0, kind: '', mist: 0, inCloud: 0, scud: 0, region: '', regionT: 0, hidden: false, revealUntil: -1, raiderT: 0 };
  const Q = { rain: 1, scud: 1 }; // the Settings card's picture: the share of rain streaks, and scud on or off
  const STORMP = payload('storm'), BOLTP = payload('lightning'), GUSTP = payload('gust'), HIDP = payload('hidden');
  // how much of raider r shows through the clouds as they're drawn, seen from the camera (0 to 1): her spots, each
  // through the cloud floor, the big clouds and the haze in front of it (world.js veil). The big clouds are drawn
  // facing the way the camera looks, so which of them lie in front of her, and where, changes as it turns: on the
  // screen she's looked at through the camera's own view; off it, as she'd be if the camera turned to look at her
  const lookM = new THREE.Matrix4(), viewM = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), spot = new THREE.Vector3();
  function shows(r, camera) {
    const S = (r.zones.spots ??= spotsOf(r.zones)), M = r.ship.body.matrixWorld, eye = camera.position;
    spot.setFromMatrixPosition(M).project(camera);
    let view = camera.matrixWorldInverse;
    if (spot.z > 1 || Math.abs(spot.x) > 1 || Math.abs(spot.y) > 1) { lookM.lookAt(eye, spot.setFromMatrixPosition(M), UP).setPosition(eye); view = viewM.copy(lookM).invert(); }
    let seen = 0;
    for (let k = 0; k < S.length; k++) seen += SPOT_WEIGHT[k] * (1 - world.veil(eye, spot.copy(S[k]).applyMatrix4(M), view, scene.fog));
    return seen;
  }
  const mistColor = new THREE.Color(), fall = new THREE.Vector3(), rel = new THREE.Vector3(), top = new THREE.Vector3(), foot = new THREE.Vector3(), sunAt = new THREE.Vector3(), probe = new THREE.Vector3(), fwd = new THREE.Vector3();
  let clock = 0;

  // how deep in cloud a point is, 0 to 1: the cloud floor (as thick as the cloud there, within its depth) or one of the
  // big clouds (deep inside it)
  function floorAt(p, t = world.time.value) {
    const dy = p.y - CLOUD_Y;
    if (dy > FLOOR.above || dy < -FLOOR.below) return 0;
    const band = Math.min(1 - smooth(FLOOR.over, FLOOR.above, dy), smooth(-FLOOR.below, -FLOOR.under, dy));
    return band > 0 ? band * coverAt(p.x, p.z, t, M.uCover.value) : 0;
  }
  const cloudAt = (p) => Math.max(floorAt(p), smooth(0, 0.45, puffs.inside(p)));

  // ---------- the weather's moments ----------
  function tellStorm(stage) { STORMP.stage = stage; STORMP.from = W.from; emit('storm'); }
  // the storm showing on the horizon, coming from bearing `from` (as a heading: 0 is south, the way z grows)
  function front(from) {
    W.from = from; W.frontWant = 1;
    M.uStormDir.value.set(Math.sin(from), Math.cos(from));
    tellStorm('coming');
  }
  // the storm rolling in (its wind blowing from where it comes from)
  function startStorm(from = W.frontWant ? W.from : Math.random() * Math.PI * 2) {
    if (!W.frontWant) { W.from = from; M.uStormDir.value.set(Math.sin(from), Math.cos(from)); }
    W.want = 1; W.frontWant = 1; W.windStorm = rnd(STORMS.wind[0], STORMS.wind[1]);
    WIND.dir = W.from + Math.PI;
    W.strike = rnd(3, 6); W.gustNext = rnd(STORMS.gustEvery[0], STORMS.gustEvery[1]);
    tellStorm('here');
  }
  function clearWeather() { if (W.want || W.frontWant) { W.want = 0; W.frontWant = 0; tellStorm('passing'); } }

  // ---------- each frame ----------
  // `player` (flight.js), `camera`, `time` (the voyage's clock), `raiders` (raiders.js list)
  function update(dt, { player, camera, raiders }) {
    clock += dt;
    // the region's air, read ten times a second and blended in over a few seconds; the storm, rolling in or clearing
    if ((W.regionT -= dt) <= 0) { W.regionT = 0.1; W.region = regionAt(player.pos.x, player.pos.z); }
    mixLook(airLook, REGION_LOOK[W.region] ?? DAY, 1 - Math.exp(-dt / 4), airLook);
    mixLook(DAY, airLook, AIR_SHARE, base);
    W.storm = W.want > W.storm ? Math.min(W.want, W.storm + dt / STORMS.roll) : Math.max(W.want, W.storm - dt / STORMS.roll);
    W.front = W.frontWant > W.front ? Math.min(1, W.front + dt / STORMS.front) : Math.max(0, W.front - dt / STORMS.front);
    const s = smooth(0, 1, W.storm);
    mixLook(base, STORM, s, look);
    world.setLook(look, lights);
    M.uFront.value = W.front * (1 - s * 0.7);

    // lightning in a storm: every 4 to 12 s, 1.5 to 5 km off (mostly where you're looking), a flash of 1, 0.2, 0.8 and
    // gone in a third of a second, brightening the sky and the ships, and thunder after it (sound.js)
    camera.getWorldDirection(fwd);
    if (W.storm > 0.6 && (W.strike -= dt) <= 0) {
      W.strike = rnd(STORMS.strike[0], STORMS.strike[1]);
      const a = Math.random() < 0.7 ? Math.atan2(fwd.x, fwd.z) + rnd(-0.6, 0.6) : Math.random() * Math.PI * 2, far = rnd(STORMS.far[0], STORMS.far[1]);
      foot.set(player.pos.x + Math.sin(a) * far, CLOUD_Y - rnd(0, 40), player.pos.z + Math.cos(a) * far);
      top.set(foot.x + rnd(-300, 300), rnd(1700, 2300), foot.z + rnd(-300, 300));
      bolt.strike(top, foot); W.flashT = 0; W.lightningCount++;
      M.uFlashDir.value.set(Math.sin(a), Math.cos(a));
      W.flashK = 1.15 - far / 6000;
      BOLTP.at.copy(foot); BOLTP.far = far; emit('lightning');
    }
    const ft = (W.flashT += dt);
    W.flash = ft < 0.05 ? 1 : ft < 0.12 ? 0.2 : ft < 0.18 ? 0.8 : ft < 0.35 ? 0.8 * (1 - (ft - 0.18) / 0.17) : 0;
    M.uFlash.value = W.flash * W.flashK;
    lights.hemi.intensity *= 1 + 3 * M.uFlash.value;
    bolt.update(dt, camera);

    // the wind: in a storm stronger, and in gusts (each a swell over two and a half seconds that heels the ship and
    // shakes the view a little)
    if (W.storm > 0 || W.gust > 0) {
      if (W.storm > 0.5 && (W.gustNext -= dt) <= 0) {
        W.gustNext = rnd(STORMS.gustEvery[0], STORMS.gustEvery[1]); W.gustT = 2.5;
        if (!player.down) player.heelV += (Math.random() < 0.5 ? -1 : 1) * 0.12 * W.storm;
        if (fx) fx.trauma(0.12 * W.storm);
        GUSTP.strength = W.windStorm * (1 + STORMS.gust); emit('gust');
      }
      W.gustT = Math.max(0, W.gustT - dt); W.gust = W.gustT > 0 ? Math.sin((W.gustT / 2.5) * Math.PI) : 0;
      WIND.strength = (WIND.base + (W.windStorm - WIND.base) * s) * (1 + STORMS.gust * W.gust);
    }

    // in a cloud: the mist round the camera (quick to come, a breath to clear), the haze closing in to a few hundred
    // metres in the cloud's colour, and the veil of wisps streaming past
    const camIn = cloudAt(camera.position), shipIn = cloudAt(player.pos);
    W.mist = ease(W.mist, camIn, dt, camIn > W.mist ? 0.15 : 0.18);
    if (W.mist < 0.01 && camIn < 0.01) W.mist = 0; // (gone: the veil and the haze let go)
    W.inCloud = ease(W.inCloud, shipIn, dt, 0.2);
    player.cloud = W.inCloud;
    const mv = M.uMistCol.value.fromArray(look.deckLit).lerp(probe.fromArray(look.deckShade), 0.3);
    mistColor.setRGB(mv.x, mv.y, mv.z); M.uMistSky.value.set(Math.sqrt(mv.x), Math.sqrt(mv.y), Math.sqrt(mv.z)); // (the sky's is as seen)
    M.uMist.value = W.mist > 0.01 ? Math.min(1, W.mist * 1.1) : 0;
    if (W.mist > 0.01) {
      const m = Math.min(1, W.mist * 1.15), fog = scene.fog;
      fog.near += (12 - fog.near) * m; fog.far += (320 - fog.far) * m; fog.color.lerp(mistColor, m);
      veil.mesh.visible = true;
      veil.U.uZoom.value += dt * (0.12 + player.speed / 160);
      veil.U.uOff.value.set(Math.atan2(fwd.x, fwd.z) * 0.35, Math.asin(Math.max(-1, Math.min(1, fwd.y))) * 0.35);
      veil.U.uAspect.value = camera.aspect;
    } else veil.mesh.visible = false;

    // hiding: the Captain deep in cloud, and not just given away by her guns
    const hidden = shipIn > HIDE.thick && clock >= W.revealUntil && !player.down;
    if (hidden !== W.hidden) { W.hidden = hidden; HIDP.on = hidden; HIDP.why = hidden ? 'cloud' : clock < W.revealUntil ? 'guns' : 'out'; emit('hidden'); }
    player.hidden = hidden;
    // the raiders, a third of them each frame: hidden deep in cloud, or in a smoke screen of her own (the Ghost's:
    // tactics.js), and lost to the Captain's sight more than a little way off, unless she's readying a broadside (her gun
    // ports glow through the cloud and give her away); one deep in cloud only while the cloud as drawn really hides
    // her (`shows`: how much of her shows through it); and where she last saw each
    W.raiderT = (W.raiderT + 1) % 3;
    for (let i = 0; i < raiders.length; i++) {
      const r = raiders[i];
      if (r.f.down) { r.hidden = r.lost = r.clouded = false; r.shows = 1; continue; }
      if (i % 3 === W.raiderT || r.clouded === undefined) { r.clouded = cloudAt(r.f.pos) > HIDE.thick; r.shows = r.clouded ? shows(r, camera) : 1; }
      r.hidden = r.clouded || r.smoke > 0;
      const veiled = r.smoke > 0 || (r.clouded && r.shows < HIDE.shows[r.lost ? 1 : 0]);
      r.lost = veiled && !r.charge?.b && r.f.pos.distanceTo(player.pos) > HIDE.near;
      if (!r.lost) (r.seenAt ??= new THREE.Vector3()).copy(r.f.pos);
    }

    // rain (in a storm) or the region's motes, falling through a box round the camera. Changing from one to another,
    // the old fades out first (in a second or so) and the new comes in from nothing: a storm over the Wastes' dust or
    // the Peaks' snow brings its rain in as gently as it does from clear air
    W.rain = smooth(0.3, 0.8, W.storm);
    const kind = W.rain > 0.02 ? 'rain' : REGION_AIR[W.region]?.air ?? '';
    if (kind !== W.kind) { W.motes = ease(W.motes, 0, dt, 0.4); if (W.motes < 0.03) { W.kind = kind; W.motes = 0; if (kind) air.set(kind, Q.rain); } }
    else W.motes = ease(W.motes, kind === 'rain' ? W.rain : kind ? 1 : 0, dt, 1.2);
    air.U.uOn.value = W.motes; air.mesh.visible = !!W.kind && W.motes > 0.02 && air.count > 0;
    if (air.mesh.visible) {
      const A = air.U, box = A.uBox.value, rain = W.kind === 'rain';
      // (blown along by the wind: 40 m/s for each share of top speed it gives, and falling at its own speed)
      fall.set(WIND.strength * Math.sin(WIND.dir) * 40, -AIR[W.kind].fall, WIND.strength * Math.cos(WIND.dir) * 40);
      A.uFall.value.addScaledVector(fall, dt); A.uFall.value.set(A.uFall.value.x % box, A.uFall.value.y % box, A.uFall.value.z % box);
      A.uRel.value.copy(fall).sub(player.velocity);
      A.uEye.value.copy(camera.position); A.uScale.value = camera.userData.pixelScale ?? 500; A.uTime.value = clock;
    }

    // scud: near the cloud floor, round the big clouds, in a storm and in the mist
    const nearFloor = (1 - smooth(40, 220, Math.abs(player.pos.y - CLOUD_Y))) * (0.3 + 0.7 * coverAt(player.pos.x, player.pos.z, world.time.value, M.uCover.value));
    const nearPuff = smooth(-0.8, 0, puffs.inside(player.pos));
    W.scud = ease(W.scud, Math.max(nearFloor, nearPuff, W.storm * 0.8, W.mist) * Q.scud, dt, 1);
    scud.U.uScud.value = W.scud; scud.mesh.visible = W.scud > 0.01;
    scud.U.uCenter.value.copy(player.pos);

    // her shadow on the cloud floor, and the glory round it (gone in a storm or the mist)
    M.uShip.value.copy(player.pos); M.uShipH.value.set(player.pos.y, player.heading, player.ship.recipe.length);
    M.uGlory.value = (1 - s) * (1 - Math.min(1, W.mist * 2)) * smooth(0.2, 0.3, SUN.y);

    // the sun's glare, when it's in sight: weaker in haze, gone behind a big cloud, in the mist or in a storm
    sunAt.copy(camera.position).addScaledVector(SUN, 30000).project(camera);
    const edge = Math.max(Math.abs(sunAt.x), Math.abs(sunAt.y));
    let g = sunAt.z < 1 && edge < 1.25 ? (1 - smooth(0.9, 1.25, edge)) * (1 - s) * (1 - Math.min(1, W.mist * 2)) : 0;
    if (g > 0) for (let i = 0; i < 3; i++) g *= 1 - smooth(0, 0.45, puffs.inside(probe.copy(camera.position).addScaledVector(SUN, SUNWARD[i])));
    if (g > 0 && camera.position.y < CLOUD_Y) { const k = (CLOUD_Y - camera.position.y) / SUN.y; g *= 1 - coverAt(camera.position.x + SUN.x * k, camera.position.z + SUN.z * k, world.time.value, M.uCover.value); } // (under the cloud floor)
    if (g > 0.01) glare.place(sunAt.x, sunAt.y, g * 0.9, renderer.domElement.height, most);
    else glare.hide();
  }

  // the Captain's guns firing: she's given away for a few seconds, even deep in cloud
  function reveal(seconds = HIDE.reveal) { W.revealUntil = clock + seconds; }
  // a fresh voyage: the afternoon, no storm, the air as it is where she sets out (blended in from the afternoon)
  function reset() {
    Object.assign(W, { storm: 0, want: 0, front: 0, frontWant: 0, flash: 0, flashT: 9, gust: 0, gustT: 0, rain: 0, motes: 0, kind: '', mist: 0, inCloud: 0, scud: 0, region: '', regionT: 0, hidden: false, revealUntil: -1 });
    mixLook(DAY, DAY, 0, airLook);
    rest();
  }
  // off the sea (the title screen or the port): nothing of the weather left showing in the world's sky
  function rest() {
    W.want = W.frontWant = 0; W.storm = W.front = 0; W.mist = 0; W.flash = 0;
    for (const k of ['uFront', 'uFlash', 'uMist', 'uGlory']) M[k].value = 0;
    air.mesh.visible = veil.mesh.visible = scud.mesh.visible = false; bolt.clear(); glare.hide();
  }
  // the Settings card's picture: how much rain, and scud or none
  function quality({ rain = 1, scud: sc = true } = {}) { Q.rain = rain; Q.scud = sc ? 1 : 0; if (W.kind) air.set(W.kind, rain); }

  return {
    update, reset, rest, front, startStorm, clearWeather, reveal, cloudAt, floorAt, quality,
    weather: W, air, bolt, veil, scud, glare, look, picked: Q,
    get inCloud() { return W.inCloud; }, get mist() { return W.mist; }, get lightningCount() { return W.lightningCount; }, get hidden() { return W.hidden; },
    get airKind() { return W.kind; }, line: (region) => REGION_AIR[region]?.line ?? '',
  };
}
