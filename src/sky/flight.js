// flight.js: how a ship flies, the Captain's and the raiders' alike. How fast it goes, how tight it turns and how
// quickly it climbs all come from its stats in docs/ships.md (src/ships/index.js), so each class feels different:
//   top speed = 14 + 3.2 m/s per point of speed   (the Cutter's 10 is 46 m/s, about 165 km/h)
//   turning   = 0.06 + 0.028 radians a second per point   (the Skiff's 10 turns a full circle in 18 seconds)
//   climbing  = 3 + 2.1 m/s per point
// and damage takes its toll (docs/ships.md, "What the stats mean"):
//   torn sails slow the ship and make it turn badly
//   cracked crystals make it climb badly and sink, and at zero force it down out of the fight
//   at zero hull it goes down
// Upgrades bought in port (mods.js) scale the speed, speeding up, turning and climbing. The wind helps a ship sailing
// with it and holds back one sailing into it, and a Surge pours the crystals into the sails for a few seconds.
// A broadside's recoil heels the ship (guns.js pushes `heelV`); she rights herself on a soft spring.
// Her crew can patch her mid-fight (startPatch: the Captain's, tactics.js PATCH): whatever's worst off, by a third over
// six seconds, then thirty seconds before they can again.
import * as THREE from 'three';
import { THINNING } from './world.js';
import { PATCH } from './tactics.js';

export function handling(st) {
  return { vmax: 14 + 3.2 * st.speed, turn: 0.06 + 0.028 * st.turning, climb: 3 + 2.1 * st.climbing };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The wind: the way it blows (a heading), and how much it helps or holds back (0.1 is 10% of top speed); `base` is the
// wave's own wind, which a storm (sky.js) blows harder than, in gusts
export const WIND = { dir: 0, strength: 0, base: 0 };
export const windHelp = (heading) => WIND.strength * Math.cos(heading - WIND.dir);
// A Surge: 60% more top speed for 3 seconds, then 15 seconds to build up again
export const SURGE = { boost: 0.6, time: 3, recharge: 15 };
// A ship sinking (dead crystals, or struck colours): from `from` seconds her lift gives out over `ramp` seconds, and
// she falls faster by `fall` m/s each second, up to `most` m/s
export const SINK = { from: 2.5, ramp: 2, fall: 8, most: 70 };

// `tune` scales top speed, speeding up, turning and climbing (upgrades, the pilot, and the raiders sailing a little
// slower); `guard` is how much of a hit on the hull lands (Brightvein: the bosun's hull crew); `surge` is this ship's own
// Surge (the pilot's: a quicker recharge)
export function makeFlyer(ship, stats, start, tune = {}) {
  const T = { speed: 1, accel: 1, turn: 1, climb: 1, guard: 1, ...tune }, SG = { ...SURGE, ...(tune.surge || {}) };
  const H = handling(stats), pace = T.speed;
  const full = { hull: stats.hull, sails: stats.sails, crystals: stats.crystals };
  const s = {
    ship, stats, H, full, health: { ...full },
    pos: start.pos.clone(), heading: start.heading, speed: H.vmax * 0.45 * pace, sail: 0.5, vy: 0, turn: 0, climb: 0,
    velocity: new THREE.Vector3(),
    down: null, // how it's going down, once it is: 'hull' or 'crystals', and for how long
    aimY: 0, // how far below its deck to aim at it (the middle of its hull)
    surge: { on: 0, charge: 1 }, // seconds of Surge left, and how built up the next one is (1 = ready)
    heel: 0, heelV: 0, // the roll from her own broadsides (radians, + to starboard), and how fast it's changing
    list: 0, // how far she lists towards the side that took the most hits, badly holed (radians, + to starboard: looks.js)
    trim: 0, // how far she dips at one end (radians, + bow down: a Man-o'-war whose crystal column there blew out, looks.js)
    cloud: 0, hidden: false, // how deep in cloud she is (0 to 1), and whether she's hidden in it (the Captain's: sky.js)
    patch: { t: 0, cd: 0, part: null }, // her crew patching her: seconds of it left, seconds before they can again, and the part
    SG, T, // (her own Surge, and her tune)
  };
  const look = { turn: 0, climb: 0, heel: 0, list: 0, trim: 0 }; // what the model is told each frame (kept, not made each time)
  // the heel's spring: a broadside's kick rolls her over for a second or so, then she rights herself
  const settle = (dt) => { s.heelV += (-6 * s.heel - 1.6 * s.heelV) * dt; s.heel += s.heelV * dt; };
  s.startSurge = () => { if (s.down || s.surge.charge < 1) return false; s.surge.on = SG.time; s.surge.charge = 0; return true; };
  const aim = new THREE.Vector3();
  s.aimAt = () => aim.copy(s.pos).setY(s.pos.y + s.aimY); // (the same vector each time: use it before asking again)
  ship.root.rotation.order = 'YXZ';
  s.frac = (k) => s.health[k] / full[k];
  s.crew = () => Math.ceil(stats.crew * s.frac('hull')); // the crew falls with the hull
  s.forward = () => new THREE.Vector3(Math.sin(s.heading), 0, Math.cos(s.heading));
  // (her crew patch her only so far: the hull to `T.patch.hull` of new and the rest to `T.patch.other`, Brightvein's
  // bosun; the rest waits for the dock. A raider's crew, all the way)
  const capOf = (p) => (T.patch ? (p === 'hull' ? T.patch.hull : T.patch.other) : 1);
  s.patchCap = capOf;
  s.repair = (k) => { for (const p in full) { const top = full[p] * capOf(p); if (s.health[p] < top) s.health[p] = Math.min(top, s.health[p] + full[p] * k); } };
  // the part worst off (its share of full), and the crew patching it: refused while she's going down, while they're
  // getting ready again, or with nothing to patch; else the part they patch
  s.worst = () => { let w = 'hull'; for (const p in full) if (s.frac(p) / capOf(p) < s.frac(w) / capOf(w)) w = p; return w; };
  s.startPatch = () => {
    if (s.down || s.patch.cd > 0 || s.frac(s.worst()) >= capOf(s.worst()) - 1e-6) return null;
    const P = s.patch; P.part = s.worst(); P.t = PATCH.time; P.cd = PATCH.time + PATCH.wait;
    return P.part;
  };
  // whether she strikes her colours (gives up) as she stands, after a hit: a raider's own rule (raiders.js: a treasure
  // ship with no sails left, or a quarter of her hull; a beaten crew: tactics.js NERVE), or none (the Captain never does)
  s.strikes = null;
  s.hit = (part, damage) => {
    if (s.down || s.invuln) return;
    if (part === 'hull') damage *= T.guard;
    damage *= s.armor ?? 1; // (a boss braced or armoured for a while: raids.js)
    s.health[part] = Math.max(0, s.health[part] - damage);
    if (s.health.hull <= 0) s.down = { why: 'hull', t: 0, roll: Math.random() < 0.5 ? -1 : 1 };
    else if (s.health.crystals <= 0) s.down = { why: 'crystals', t: 0, roll: Math.random() < 0.5 ? -1 : 1 };
    else if (s.strikes?.(s)) s.down = { why: 'struck', t: 0, roll: Math.random() < 0.5 ? -1 : 1 };
  };

  // c: turn (-1 port .. 1 starboard), climb (-1 .. 1), and either sail (a rate, from the keys) or sailTo (set outright)
  s.update = (dt, c) => {
    if (s.down) return sink(dt);
    const P = s.patch;
    if (P.t > 0) { const k = Math.min(dt, P.t); P.t -= k; s.health[P.part] = Math.max(s.health[P.part], Math.min(full[P.part] * capOf(P.part), s.health[P.part] + (full[P.part] * PATCH.share * k) / PATCH.time)); }
    if (P.cd > 0) P.cd = Math.max(0, P.cd - dt);
    const sf = s.frac('sails'), cf = s.frac('crystals');
    const surging = s.surge.on > 0;
    if (surging) s.surge.on = Math.max(0, s.surge.on - dt); else s.surge.charge = Math.min(1, s.surge.charge + dt / SG.recharge);
    const vmax = H.vmax * pace * (0.3 + 0.7 * sf) * (1 + windHelp(s.heading)) * (surging ? 1 + SG.boost : 1);
    const turnRate = H.turn * T.turn * (0.45 + 0.55 * sf), climbRate = H.climb * T.climb * (0.25 + 0.75 * cf);
    s.sail = c.sailTo != null ? clamp(c.sailTo, 0, 1) : clamp(s.sail + (c.sail ?? 0) * dt * 0.5, 0, 1);
    const target = (surging ? 1 : s.sail) * vmax;
    s.speed += (target - s.speed) * (1 - Math.exp(-dt * (target > s.speed ? (surging ? 1.6 : 0.35 * T.accel) : 0.6)));
    // controls are eased in, the way a heavy ship answers its wheel
    s.turn += ((c.turn ?? 0) - s.turn) * (1 - Math.exp(-dt * 3));
    s.climb += ((c.climb ?? 0) - s.climb) * (1 - Math.exp(-dt * 2.5));
    const grip = 0.35 + 0.65 * Math.min(1, s.speed / (H.vmax * 0.3));
    s.heading -= s.turn * turnRate * grip * dt;
    // lift fades in the thin air near the Thinning, sooner with cracked crystals, and a badly cracked set sinks
    const ceiling = 200 + (THINNING - 200) * (0.3 + 0.7 * cf);
    let want = s.climb * climbRate;
    if (want > 0) want *= clamp((ceiling - s.pos.y) / 400, 0, 1);
    want -= Math.max(0, 0.5 - cf) * 10;
    if (s.pos.y < 90 && want < 0) want *= Math.max(0, (s.pos.y - 60) / 30);
    s.vy += (want - s.vy) * (1 - Math.exp(-dt * 2.2));
    move(dt);
    s.pos.y = clamp(s.pos.y, 60, THINNING);
    settle(dt);
    look.turn = s.turn * Math.min(1, s.speed / (H.vmax * 0.4) + 0.2); look.climb = s.vy / H.climb; look.heel = s.heel; look.list = s.list; look.trim = s.trim;
    ship.update(dt, look);
  };

  // going down: a holed hull rolls over and falls; dead crystals let the ship sink, still upright; a ship that has
  // struck her colours drifts to a stop and settles slowly, her crew abandoning her. A few seconds in, the last of a
  // sinking ship's lift gives out and she drops away faster and faster (SINK), so she's through the cloud deck within
  // about 14 seconds from a fight's height, like a ship blown apart
  function sink(dt) {
    const d = s.down; d.t += dt;
    s.speed *= Math.exp(-dt * (d.why === 'hull' ? 0.5 : d.why === 'struck' ? 0.6 : 0.25));
    if (d.why === 'hull') { s.vy -= 7 * dt; s.heading -= d.roll * 0.15 * dt; }
    else {
      const k = clamp((d.t - SINK.from) / SINK.ramp, 0, 1);
      s.vy += ((d.why === 'struck' ? -7 : -16) - s.vy) * (1 - Math.exp(-dt * 0.8)) * (1 - k);
      s.vy = Math.max(-SINK.most, s.vy - SINK.fall * k * dt);
    }
    move(dt);
    // a holed hull goes nose-down and rolls right over as she falls; the others stay nearly upright
    const k = Math.min(1, d.t / 6);
    ship.root.rotation.x = (d.why === 'hull' ? 0.75 : d.why === 'struck' ? 0.04 : 0.12) * k * k;
    ship.root.rotation.z = d.roll * (d.why === 'hull' ? 1.4 : d.why === 'struck' ? 0.12 : 0.25) * k;
    settle(dt);
    look.turn = 0; look.climb = 0; look.heel = s.heel; look.list = s.list; look.trim = s.trim;
    ship.update(dt, look);
  }
  function move(dt) {
    s.velocity.set(Math.sin(s.heading) * s.speed, s.vy, Math.cos(s.heading) * s.speed);
    s.pos.addScaledVector(s.velocity, dt);
    ship.root.position.copy(s.pos);
    ship.root.rotation.y = s.heading;
  }
  // back to new, for a fresh start
  s.reset = (pos, heading) => {
    Object.assign(s.health, full); s.down = null; s.pos.copy(pos); s.heading = heading; s.vy = 0; s.turn = 0; s.climb = 0;
    s.speed = H.vmax * 0.45 * pace; s.sail = 0.5; s.surge.on = 0; s.surge.charge = 1; s.heel = s.heelV = 0; s.list = 0; s.trim = 0; ship.root.rotation.set(0, heading, 0);
    s.patch.t = s.patch.cd = 0; s.patch.part = null;
  };
  return s;
}
