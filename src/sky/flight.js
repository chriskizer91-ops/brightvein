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
import * as THREE from 'three';
import { THINNING } from './world.js';

export function handling(st) {
  return { vmax: 14 + 3.2 * st.speed, turn: 0.06 + 0.028 * st.turning, climb: 3 + 2.1 * st.climbing };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The wind: the way it blows (a heading), and how much it helps or holds back (0.1 is 10% of top speed)
export const WIND = { dir: 0, strength: 0 };
export const windHelp = (heading) => WIND.strength * Math.cos(heading - WIND.dir);
// A Surge: 60% more top speed for 3 seconds, then 15 seconds to build up again
export const SURGE = { boost: 0.6, time: 3, recharge: 15 };

// `tune` scales top speed, speeding up, turning and climbing (upgrades, and the raiders sailing a little slower)
export function makeFlyer(ship, stats, start, tune = {}) {
  const T = { speed: 1, accel: 1, turn: 1, climb: 1, ...tune };
  const H = handling(stats), pace = T.speed;
  const full = { hull: stats.hull, sails: stats.sails, crystals: stats.crystals };
  const s = {
    ship, stats, H, full, health: { ...full },
    pos: start.pos.clone(), heading: start.heading, speed: H.vmax * 0.45 * pace, sail: 0.5, vy: 0, turn: 0, climb: 0,
    velocity: new THREE.Vector3(),
    down: null, // how it's going down, once it is: 'hull' or 'crystals', and for how long
    aimY: 0, // how far below its deck to aim at it (the middle of its hull)
    surge: { on: 0, charge: 1 }, // seconds of Surge left, and how built up the next one is (1 = ready)
  };
  s.startSurge = () => { if (s.down || s.surge.charge < 1) return false; s.surge.on = SURGE.time; s.surge.charge = 0; return true; };
  s.aimAt = () => s.pos.clone().setY(s.pos.y + s.aimY);
  ship.root.rotation.order = 'YXZ';
  s.frac = (k) => s.health[k] / full[k];
  s.crew = () => Math.ceil(stats.crew * s.frac('hull')); // the crew falls with the hull
  s.forward = () => new THREE.Vector3(Math.sin(s.heading), 0, Math.cos(s.heading));
  s.repair = (k) => { for (const p in full) s.health[p] = Math.min(full[p], s.health[p] + full[p] * k); };
  s.strikes = false; // a treasure ship strikes her colours (gives up) with no sails left, or a quarter of her hull
  s.hit = (part, damage) => {
    if (s.down) return;
    s.health[part] = Math.max(0, s.health[part] - damage);
    if (s.health.hull <= 0) s.down = { why: 'hull', t: 0, roll: Math.random() < 0.5 ? -1 : 1 };
    else if (s.health.crystals <= 0) s.down = { why: 'crystals', t: 0, roll: Math.random() < 0.5 ? -1 : 1 };
    else if (s.strikes && (s.health.sails <= 0 || s.health.hull <= full.hull * 0.25)) s.down = { why: 'struck', t: 0, roll: Math.random() < 0.5 ? -1 : 1 };
  };

  // c: turn (-1 port .. 1 starboard), climb (-1 .. 1), and either sail (a rate, from the keys) or sailTo (set outright)
  s.update = (dt, c) => {
    if (s.down) return sink(dt);
    const sf = s.frac('sails'), cf = s.frac('crystals');
    const surging = s.surge.on > 0;
    if (surging) s.surge.on = Math.max(0, s.surge.on - dt); else s.surge.charge = Math.min(1, s.surge.charge + dt / SURGE.recharge);
    const vmax = H.vmax * pace * (0.3 + 0.7 * sf) * (1 + windHelp(s.heading)) * (surging ? 1 + SURGE.boost : 1);
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
    ship.update(dt, { turn: s.turn * Math.min(1, s.speed / (H.vmax * 0.4) + 0.2), climb: s.vy / H.climb });
  };

  // going down: a holed hull rolls over and falls; dead crystals let the ship sink, still upright; a ship that has
  // struck her colours drifts to a stop and settles slowly, her crew abandoning her
  function sink(dt) {
    const d = s.down; d.t += dt;
    s.speed *= Math.exp(-dt * (d.why === 'hull' ? 0.5 : d.why === 'struck' ? 0.6 : 0.25));
    if (d.why === 'hull') { s.vy -= 7 * dt; s.heading -= d.roll * 0.15 * dt; }
    else s.vy += ((d.why === 'struck' ? -7 : -16) - s.vy) * (1 - Math.exp(-dt * 0.8));
    move(dt);
    const k = Math.min(1, d.t / 6);
    ship.root.rotation.x = (d.why === 'hull' ? 0.55 : d.why === 'struck' ? 0.04 : 0.12) * k * k;
    ship.root.rotation.z = d.roll * (d.why === 'hull' ? 0.9 : d.why === 'struck' ? 0.12 : 0.25) * k;
    ship.update(dt, { turn: 0, climb: 0 });
  }
  function move(dt) {
    s.velocity.copy(s.forward()).multiplyScalar(s.speed).setY(s.vy);
    s.pos.addScaledVector(s.velocity, dt);
    ship.root.position.copy(s.pos);
    ship.root.rotation.y = s.heading;
  }
  // back to new, for a fresh start
  s.reset = (pos, heading) => {
    Object.assign(s.health, full); s.down = null; s.pos.copy(pos); s.heading = heading; s.vy = 0; s.turn = 0; s.climb = 0;
    s.speed = H.vmax * 0.45 * pace; s.sail = 0.5; s.surge.on = 0; s.surge.charge = 1; ship.root.rotation.set(0, heading, 0);
  };
  return s;
}
