// looks.js: every ship shows her scars and her life (her looks, drawn by src/ship/dress.js), kept up to date as the
// fight goes:
//   a hit           put where it struck: a scorched hole in her planks or deck, glowing with embers for a few seconds
//                   then smouldering; a ragged hole through her canvas (one close by grows instead; on a folded wing, it
//                   stays where it struck as she spreads it again); a crystal cluster dimming and cracking with the
//                   damage it takes
//   as she weakens  her hull gets sooty and streaked; her torn sails fray from their free edges and flap harder; below
//                   a third of her crystals they all sputter; badly holed, she lists towards the side that took the most
//   below a quarter flames burst from her two worst wounds (three below an eighth), streaming back as she flies, each
//   of her hull     with a glow over it so it reads from across a fight; going down holed, she burns all along her scars
//                   (src/ship/flames.js: one draw for the whole sky)
//   far off         her holes grow bigger and their soot darker the further she is from the camera (from 30 to 110 m),
//                   so a raider across a fight (or the Captain's own ship, seen from behind) still shows her wounds
//   between waves   the crew patch her up: the fires go out and the embers cool, each hole in her sails is sewn over
//                   with a square of new canvas, each hole in her planks becomes a square of fresh planks and its soot
//                   fades, and her crystals' cracks fade as they mend. Raiders never patch theirs
//   in port         she's as good as new again (reset)
//   her wings       fold back along the hull as her sails are taken in and spread as they're set (a raider's with her
//                   sails as she chases or slows to bring her side round); a Surge snaps them wide open with a shiver; a
//                   ship going down folds them
//   her pennants    stream out straight at speed and hang limp when she's slow
//   her guns        the Captain's lids fly open bow first and her guns run out as a wave arrives (clearing for action),
//                   and close again once it's beaten; firing between waves bursts a side open with its first gun, its
//                   guns run out at once. A raider's lids fly open
//                   on the side she's about to fire a broadside from, as her ports glow, and stay open while she's in
//                   the fight. Each gun kicks back in at its turn as its battery fires, stays in while it's reloaded and
//                   runs out again just as it's loaded (bow and stern guns kick back along their barrels)
//   a Man-o'-war    her crystal columns are her weak points: marked gold while the Captain's guns are locked on her,
//                   and each one blows out as it gives out (a burst of gold and violet sparks, told as `blowout`), goes
//                   dark and smokes, and she dips at that end
// The smoke from a damaged ship comes from her scars too (effects.js), and from the tips of her flames.
// Every ship's scars and life are kept on her (ship.wear), with plain numbers only: nothing is made new each frame.
import * as THREE from 'three';
import { makeWear, hullPoint, wingPoint, sputter, BATTERIES, kickAt, gunIn, foldPoint } from '../ship/dress.js';
import { makeFlames, shipFlames } from '../ship/flames.js';
import { smooth } from '../ship/kit.js';
import { on, emit, payload } from './events.js';

// a scar's size for a shot of size 1 (a chaser; a broadside is 1.35), metres: in the planks (its soot reaches about
// twice that), and in the canvas; how fast a scar's embers cool (a share a second) and how warm it stays smouldering;
// the hull's share below which she burns (two flames), and three; how far she lists, at most (radians: a raider, and
// the Captain's, less, so her guns' tilt hardly changes); how long a sail's hole takes to be sewn over (seconds)
export const SCAR = { hull: 1.4, sail: 1.0, cool: 0.2, smoulder: 0.15, burn: 0.25, burnMore: 0.12, list: 0.07, listCaptain: 0.04, sew: 4 };
// how her scars read far off: from `near` to `far` metres from the camera her holes grow to their biggest (dress.js);
// and the glow over each flame (its size, a share of the flame's height: a laptop, a phone)
export const READ = { near: 30, far: 110, glow: [1.6, 1.3] };
// her life: how fast her wings follow her sails (eased, a share a second), and snap open in a Surge; how long they take
// to fold going down (seconds); how fast her lids open as she clears for action and close again (the lids' scale, 0 to
// 2, a second; snapping open to fire), how long after the Captain fires between waves they stay open (seconds); how near
// the Captain (metres) a raider who has fired keeps her lids open, and for how long after her last shot; how a Man-o'-war
// dips at the end whose column blew out (radians, at her ends), and how often a dead column smokes (seconds)
export const LIFE = { fold: 2, snap: 8, sink: 2, open: 1.4, fast: 7, close: 0.9, idle: 6, near: 1200, keep: 8, dip: 0.035, smoke: 0.25 };

const ease = (dt, rate) => 1 - Math.exp(-dt * rate); // (how far to ease towards something this frame, at `rate` a second)

export function makeLooks({ scene, touch = false, fx = null, camera = null }) {
  const flames = makeFlames(touch ? 16 : 28); scene.add(flames.mesh);
  let player = null; // the Captain (flight.js)
  // (the flames are drawn once with none in them as a voyage starts, so their shader is ready before the first fire:
  // made then, it would stutter a phone at a dramatic moment)
  let warm = true;
  const wearOf = (ship) => (ship.wear ??= life(makeWear(ship)));
  // (her life's own numbers, beside her scars: her wings, her lids, each battery's volleys seen, her columns blown out)
  const life = (W) => Object.assign(W, { fold: 0, open: [0, 0], fired: [-1e4, -1e4], volleys: [0, 0, 0, 0], blown: new Uint8Array(8), trim: 0, mark: 0, puff: 0 });
  const inv = new THREE.Matrix4(), la = new THREE.Vector3(), ld = new THREE.Vector3(), lp = new THREE.Vector3(), ln = new THREE.Vector3(), cp = new THREE.Vector3(), cv = new THREE.Vector3(), gp = new THREE.Vector3();
  const glowK = READ.glow[touch ? 1 : 0];
  const BLOW = payload('blowout');
  const api = { cleared: false, marked: null }; // (main.js: whether the Captain's ship is in a fight; the raider her guns are locked on)

  // a shot landing (events.js): on the raider hit, or on the Captain's ship
  on('hit', (e) => {
    const ship = e.target === 'raider' ? e.raider?.ship : player?.ship;
    if (ship) hit(ship, e.part, e.at, e.dir, e.damage, e.size);
  });
  // a hit on `ship`'s part at `at` (the world), flying along `dir`, `damage` hard, from a shot `size` big
  function hit(ship, part, at, dir, damage, size = 1) {
    const W = wearOf(ship);
    inv.copy(ship.body.matrixWorld).invert();
    la.copy(at).applyMatrix4(inv); ld.copy(dir).transformDirection(inv);
    if (part === 'hull') { hullPoint(ship.hull, la, ld, lp, ln); W.scar(lp, ln, SCAR.hull * size, 1); W.from = -1; }
    else if (part === 'sails') { const w = wingPoint(ship.wings, la, ld, lp, ship.U.uFold.value.x); if (w) W.hole(lp, SCAR.sail * size, w); }
    else W.dmg[W.cluster(la)] += damage;
    W.write();
    return W;
  }

  // every frame: each ship's looks from how she stands, and the flames
  function update(dt, time, raiders) {
    flames.begin();
    if (player) { tick(player, dt, time, true); alive(player, null, dt, time); }
    for (let i = 0; i < raiders.length; i++) { tick(raiders[i].f, dt, time, false, raiders[i]); alive(raiders[i].f, raiders[i], dt, time); }
    flames.end();
    if (warm) { warm = false; flames.mesh.visible = true; }
  }
  function tick(f, dt, time, captain, r = null) {
    const ship = f.ship, W = wearOf(ship), hullF = f.frac('hull'), sailF = f.frac('sails'), crysF = f.frac('crystals'), down = f.down;
    // the fires: from her worst scars, badly holed; all of them, going down holed (not a ship that gave up)
    const fires = down ? (down.why === 'hull' ? 6 : 0) : hullF < SCAR.burnMore ? 3 : hullF < SCAR.burn ? 2 : 0;
    W.fires = shipFlames(flames, W, fires, f.velocity);
    // (a flickering glow over each, in the sparks' batch: no draw of its own; none for a raider lost in cloud, sky.js, as
    // it would shine through the cloud and give her away)
    if (fx && !r?.lost) for (let i = 0; i < W.fires; i++) {
      const j = W.firstFlame + i, fl = 0.85 + 0.15 * Math.sin(time * 17 + i * 2.3 + W.seed);
      fx.glowAt(flames.at(j, 0.5, gp), 1.3, 0.55 * fl, 0.12, flames.height(j) * glowK * fl);
    }
    // (how far off she is, for her scars to read: dress.js)
    W.read = camera ? smooth(READ.near, READ.far, camera.position.distanceTo(f.pos)) : 0;
    let hot = 0, sx = 0, sr = 0;
    W.mending = Math.max(0, W.mending - dt); // (the crew at work on her: her scars cool right down)
    for (const s of W.scars) {
      if (!s.on) continue;
      if (s.burning) s.heat = 1;
      else if (!s.patched) s.heat = Math.max(W.mending > 0 ? 0 : SCAR.smoulder, s.heat - dt * SCAR.cool);
      if (!s.patched) hot = Math.max(hot, s.heat);
      if (s.ny < 0.7) { sx += s.x * s.r; sr += s.r; } // (her list: from the scars in her sides)
    }
    W.hot = hot;
    for (let i = 0; i < W.fires; i++) { const t = flames.tip(W.firstFlame + i); W.tips[i * 3] = t.x; W.tips[i * 3 + 1] = t.y; W.tips[i * 3 + 2] = t.z; }
    // soot and grime as her hull goes; her sails fray and flap as they're torn
    W.grime = smooth(0.85, 0.15, hullF); W.fray = 0.55 * smooth(0.6, 0, sailF); W.flap = 1 + 2.5 * (1 - sailF);
    // each cluster dims and cracks with the damage it took (the share of her crystals it holds); mended, their damage
    // shrinks with what's mended
    const n = W.clusters, full = f.full.crystals, lost = full - f.health.crystals;
    let took = 0;
    for (let i = 0; i < n; i++) took += W.dmg[i];
    if (took > lost + 1e-6) { const k = lost > 0 ? lost / took : 0; for (let i = 0; i < n; i++) W.dmg[i] *= k; }
    // (going down holed or with her crystals dead, they all fade out over two seconds, sputtering)
    const fade = down && down.why !== 'struck' ? Math.max(0, 1 - down.t / 2) : 1;
    for (let i = 0; i < n; i++) {
      const col = Math.max(0, 1 - W.dmg[i] / (full / n));
      W.crys[i] = (0.2 + 0.8 * col) * fade; W.crack[i] = smooth(0.75, 0.25, col);
      // (a Man-o'-war's column that gives out blows out, once: dark and cracked from then on)
      if (r?.weak && !down && col <= 1e-3 && !W.blown[i]) blowout(r, W, i);
      if (W.blown[i]) { W.crys[i] = 0; W.crack[i] = 1; }
    }
    W.spark = crysF < 0.35 || fade < 1 ? sputter(time + W.seed) : 1;
    // badly holed, she lists towards the side that took the most hits
    const lean = sr > 0 ? Math.max(-1, Math.min(1, sx / sr / W.half)) : 0;
    const want = -lean * (1 - hullF) * (captain ? SCAR.listCaptain : SCAR.list);
    W.list += (want - W.list) * Math.min(1, dt);
    f.list = W.list;
    W.write();
  }

  // her life, every frame: her wings with her sails, her pennants with her speed, her lids and guns, a Man-o'-war's
  // mark and dip (r: the raider, or none for the Captain's)
  function alive(f, r, dt, time) {
    const W = wearOf(f.ship), U = f.ship.U, down = f.down, surging = f.surge.on > 0 && !down;
    const wantFold = down ? 1 : surging ? -0.1 : Math.min(1, Math.max(0, 1 - f.sail));
    W.fold = down ? Math.min(1, W.fold + dt / LIFE.sink) : W.fold + (wantFold - W.fold) * ease(dt, surging ? LIFE.snap : LIFE.fold);
    U.uFold.value.x = W.fold; U.uFold.value.y += ((surging ? 1 : 0) - U.uFold.value.y) * ease(dt, 4);
    U.uWind.value.x += ((down ? 0 : f.speed / f.H.vmax) - U.uWind.value.x) * ease(dt, 2);
    // each battery that fired since last frame (its volleys counted: guns.js), and when each will be loaded. A side that
    // fires with its lids still shut (between waves) bursts them open, its guns run out, as its first gun goes off: no
    // shot leaves through a shut lid
    const g = f.gun, fire = U.uFire.value, ready = U.uReady.value;
    if (g) for (let b = 0; b < 4; b++) {
      const name = BATTERIES[b];
      if (g.volleys[name] !== W.volleys[b]) { W.volleys[b] = g.volleys[name]; fire.setComponent(b, time); if (b < 2) { W.fired[b] = time; W.open[b] = 2; } }
      ready.setComponent(b, time + g.ready[name]);
    }
    // the lids, each side: the Captain's open for the fight (and for a while after she fires between waves); a raider's
    // as she readies a broadside on that side, staying open while the Captain is near and she's fired from it lately
    const foe = r ? player : null, near = foe ? f.pos.distanceToSquared(foe.pos) < LIFE.near * LIFE.near : false;
    for (let side = 0; side < 2; side++) {
      const recent = time - W.fired[side];
      let want, fast;
      if (!r) { want = !down && (api.cleared || recent < LIFE.idle); fast = recent < 0.5; }
      else { const charging = r.charge.b === BATTERIES[side]; want = !down && (charging || (near && recent < LIFE.keep)); fast = charging || recent < 0.5; }
      const o = W.open[side];
      W.open[side] = want ? Math.min(2, o + dt * (fast ? LIFE.fast : LIFE.open)) : Math.max(0, o - dt * LIFE.close);
    }
    U.uGun.value.x = W.open[0]; U.uGun.value.y = W.open[1];
    // a Man-o'-war: her columns marked gold while the Captain's guns are locked on her; her dip, and her dead columns' smoke
    W.mark += ((r && r.weak && api.marked === r && !down ? 1 : 0) - W.mark) * ease(dt, 5);
    U.uMark.value = W.mark;
    f.trim += (W.trim - f.trim) * ease(dt, 1.2);
    if (r?.weak && fx && (W.puff -= dt) <= 0) {
      W.puff = LIFE.smoke / fx.q;
      for (let i = 0; i < W.clusters; i++) if (W.blown[i] && fx.smoke.room()) {
        columnTop(r, i, cp); cv.copy(f.velocity).multiplyScalar(0.15); cv.y += 2.5;
        fx.smoke.emit(cp, cv, 3, 1.2 + r.R.length * 0.02, 5 + r.R.length * 0.08, 0.25, 0.45, 0, 1.5);
      }
    }
  }
  // where a raider's crystal column i tops out, in the world (into out)
  function columnTop(r, i, out) {
    const b = r.zones.crystals[i];
    return out.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).applyMatrix4(r.ship.body.matrixWorld);
  }
  // a Man-o'-war's column i giving out: told (fx.js bursts it in gold and violet sparks; sound.js shatters it), dark
  // from now on, and she dips at that end
  function blowout(r, W, i) {
    W.blown[i] = 1;
    const z = r.R.clusters[i].z;
    W.trim += LIFE.dip * (z / (r.R.length / 2));
    BLOW.raider = r; BLOW.i = i; columnTop(r, i, BLOW.at);
    emit('blowout', BLOW);
    BLOW.raider = null;
  }

  // between waves (the Captain's ship only): the crew patch her up as her bars fill. The fires and embers go out, each
  // hole in her sails is sewn over (it closes up, then a patch is sewn on), each scar in her planks is patched with
  // fresh planks and shrinks with how much of her hull is mended since (to half its size, mended whole). A patch only
  // ever shrinks: one from an earlier wave keeps its size as the crew start again after the next
  function repair(ship, dt) {
    const W = wearOf(ship), f = player, hullF = f ? f.frac('hull') : 1;
    if (W.from < 0) W.from = hullF;
    W.mending = 0.25;
    const mended = W.from < 1 ? Math.max(0, Math.min(1, (hullF - W.from) / (1 - W.from))) : 1;
    for (const s of W.scars) {
      if (!s.on) continue;
      s.heat = Math.max(0, s.heat - dt);
      if (!s.patched && s.heat <= 0) { s.patched = true; s.r0 = s.r; }
      if (s.patched) s.r = Math.min(s.r, s.r0 * (1 - 0.5 * mended));
    }
    for (const h of W.holes) {
      if (!h.on || h.patched) continue;
      h.sewn = (h.sewn ?? 0) + dt / SCAR.sew;
      h.r = h.r0 * Math.max(0.3, 1 - h.sewn);
      if (h.sewn >= 1) { h.patched = true; h.r = h.r0 * 0.8; h.sewn = 0; }
    }
    W.write();
  }
  // as good as new (a fresh voyage, and back in port)
  function reset(ship) {
    const W = wearOf(ship), U = ship.U;
    W.reset(); W.from = -1; W.fires = 0; W.hot = 0; W.mending = 0; warm = true;
    // (her wings spread, her lids shut and her guns run in, her pennants streaming, nothing marked)
    life(W); U.uFold.value.set(0, 0, 0, 0); U.uGun.value.set(0, 0, 0, 0); U.uFire.value.setScalar(-1e4); U.uReady.value.setScalar(0); U.uWind.value.set(0.6, 0); U.uMark.value = 0;
    if (player?.ship === ship) { player.list = 0; player.trim = 0; }
  }
  function clear() { flames.clear(); }
  // for tests: how far gun i of a ship's battery b ('port' ...) has been kicked back now (0 out .. 1 in), as drawn
  const kick = (ship, b, delay, time) => kickAt(ship.U, BATTERIES.indexOf(b), delay, time);
  return Object.assign(api, {
    update, hit, repair, reset, clear, flames, kick, gunIn, foldPoint,
    // the Captain's ship (flight.js), for the hits on her
    follow(flyer) { player = flyer; },
    // for tests: a ship's scars (and her life's numbers)
    of: wearOf,
  });
}
