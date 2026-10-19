// raiders.js: the raiders, the Captain's enemies, and the claim's own ships that sail with her (a convoy's barges).
// They fly the six classes, built by the same code at the middle and far settings of the detail dial, and they fly by
// the same rules (flight.js), a little slower. Raiders are easy to tell apart: rust-red sails, darker planks and
// crimson pennants with a black hoist; the Gilded Exchange's crews (act two) fly silver sails, and Tallow's own
// flagship is tarred black with wax-white canvas. The claim's ships wear its plum and gold.
//   Skiffs and Cutters chase: attack runs, bow-first, peeling away side-on when close.
//   Brigs, Frigates and the Man-o'-war fight broadside: they come alongside a few hundred metres off and fire whole
//   sides. The Man-o'-war is a fortress: two decks of twelve guns a side, slow to turn and slower to climb.
//   The Galleon is a treasure ship: she sails by, runs once she's chased, covering her escape with her stern guns, and
//   strikes her colours when her sails are gone or her hull is down to a quarter. Left too far behind, she gets away.
// On a convoy, raiders go for the barges as often as for the Captain. A raid's bosses (raids.js) can take over a
// raider's steering (`ai`), hold its fire, fire faster, or not be hurt for a while.
// They come in waves, smallest first, and every fifth wave is led by a raider captain: tougher, harder-hitting and
// quicker to reload, with black sails and a gold pennant, and worth four times the shards. How sharp the raiders are
// depends on the skies the Captain chose (progress.js).
import * as THREE from 'three';
import { buildShip, shipMotion } from '../ship/build.js';
import { FLEET, STATS } from '../ships/index.js';
import { makeFlyer } from './flight.js';
import { makeGunnery, intercept } from './guns.js';
import { hitZones, firstHit } from './damage.js';
import { CLOUD_Y } from './world.js';

// How the raiders compare with the Captain, before the skies' own settings: reload half as slowly again, and aim a
// little off (by this much for every metre to the target)
export const RAIDER = { slow: 1.5, aim: 0.02 };
export const CAPTAIN = { toughness: 2, damage: 1.2, reload: 0.9, bounty: 4 };
// the big ships' heavy guns take their crews longer to reload
const HEAVY = { galleon: 1.15, manowar: 1.3 };
// Crystal Shards for bringing one down (before the skies' and the wave's bonus)
export const BOUNTY = { skiff: 15, cutter: 30, brig: 60, frigate: 100, galleon: 300, manowar: 400 };
const ROLE = { skiff: 'chaser', cutter: 'chaser', brig: 'broadside', frigate: 'broadside', galleon: 'prize', manowar: 'broadside' };
export const WAVES = [['skiff'], ['skiff', 'skiff'], ['cutter'], ['cutter', 'skiff'], ['brig'], ['galleon', 'cutter'], ['frigate'],
  ['frigate', 'cutter', 'cutter'], ['brig', 'brig', 'skiff', 'skiff'], ['frigate', 'brig', 'cutter', 'cutter', 'skiff'],
  ['galleon', 'frigate', 'cutter'], ['manowar', 'cutter', 'cutter'], ['frigate', 'frigate', 'brig'], ['galleon', 'galleon', 'frigate', 'cutter'],
  ['manowar', 'frigate', 'brig', 'cutter']];
// wave n (from 0): which ships, the biggest first, and whether it's led by a captain (every fifth wave: the biggest
// ship but a Man-o'-war, which needs no captain); Maelstrom skies add `extra` Skiffs or Cutters from the third wave on
const SIZE = { skiff: 0, cutter: 1, brig: 2, frigate: 3, galleon: 4, manowar: 5 };
export function waveAt(n, extra = 0) {
  const pool = ['skiff', 'skiff', 'cutter', 'cutter', 'cutter', 'brig', 'brig', 'frigate', 'frigate', 'galleon', 'manowar'];
  let ids = [...(WAVES[n] ?? [])];
  if (!ids.length) {
    ids = Array.from({ length: Math.min(6, 3 + ((n - WAVES.length) >> 1)) }, () => pool[Math.floor(Math.random() * pool.length)]);
    ids = ids.filter((id, i) => id !== 'manowar' || ids.indexOf('manowar') === i); // one Man-o'-war at a time
  }
  if (n >= 2) for (let i = 0; i < extra && ids.length < 6; i++) ids.push(n % 2 ? 'cutter' : 'skiff');
  ids.sort((a, b) => SIZE[b] - SIZE[a]);
  return { ids, captain: (n + 1) % 5 === 0 ? ids.findIndex((id) => id !== 'manowar') : -1 };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the colours, on copies of the ship materials: rust-red sails for the jumpers' crews, black for their captains,
// silver for the Exchange's, tar and wax for Tallow's flagship, and the claim's own (the art as it is) for friends
const LOOKS = {
  crew: { hull: 0x9a8781, sail: 0xc8735c, glow: 0x7a3020, flag: [0.72, 0.09, 0.07], hoist: [0.09, 0.07, 0.06] },
  captain: { hull: 0x7d6f72, sail: 0x3a3034, glow: 0x1c1216, flag: [0.95, 0.72, 0.28], hoist: [0.09, 0.07, 0.06] },
  silver: { hull: 0xb7b3ae, sail: 0xd6dbe4, glow: 0x4a5266, flag: [0.82, 0.85, 0.9], hoist: [0.85, 0.66, 0.22] },
  candle: { hull: 0x5a4c48, sail: 0xf2ead2, glow: 0x6a4a20, flag: [0.95, 0.9, 0.75], hoist: [0.1, 0.07, 0.05] },
  friend: null,
};
function raiderArt(art, look) {
  const L = LOOKS[look]; if (!L) return art;
  const M = { ...art.M };
  M.hull = art.M.hull.clone(); M.hull.color.set(L.hull);
  M.canvas = art.M.canvas.clone(); M.canvas.color.set(L.sail); M.canvas.emissive.set(L.glow);
  M.canvas.onBeforeCompile = art.M.canvas.onBeforeCompile; M.canvas.customProgramCacheKey = art.M.canvas.customProgramCacheKey;
  return { ...art, M };
}
// pennants: crimson with a black hoist; a captain's gold; the Exchange's silver with a gold hoist
function recolourPennants(ship, look) {
  const L = LOOKS[look]; if (!L) return;
  ship.body.traverse((o) => {
    if (!o.isMesh || o.name !== 'flag') return;
    const c = o.geometry.attributes.color;
    for (let i = 0; i < c.count; i++) c.setXYZ(i, ...(c.getX(i) > 0.8 ? L.hoist : L.flag));
    c.needsUpdate = true;
  });
}

// One raider ship: copies of its class's middle and far models (sharing their shapes), swapped by how big it looks
function raiderShip(T) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mid = T.mid.body.clone(), far = T.far.body.clone(); far.visible = false; body.add(mid, far);
  const rudders = [], glows = [], embers = [];
  body.traverse((o) => { if (o.name === 'rudder') rudders.push(o); else if (o.name === 'glow') glows.push(o); else if (o.name === 'embers') embers.push(o); });
  const move = shipMotion(T.R, body, rudders);
  return {
    root, body, recipe: T.R, hull: T.mid.hull, length: T.R.length, level: 'middle',
    update(dt, opts) {
      const t = move(dt, opts);
      for (const g of glows) g.material.uniforms.uTime.value = t;
      for (const e of embers) e.material.uniforms.uTime.value = t;
    },
    detail(level, pixelScale) {
      mid.visible = level === 'middle'; far.visible = level === 'far'; this.level = level;
      for (const g of glows) g.material.uniforms.uScale.value = pixelScale;
      for (const e of embers) e.material.uniforms.uScale.value = pixelScale;
    },
  };
}

// `skies()` gives the current skies' settings (progress.js)
export function makeRaiders(scene, art, bolts, skies) {
  const arts = {}, T = {};
  const artFor = (look) => (arts[look] ??= raiderArt(art, look));
  // one middle and one far model per class and colours, built when first needed
  function template(id, look = 'crew') {
    const key = `${id}:${look}`;
    if (!T[key]) {
      const R = FLEET.find((s) => s.id === id), A = artFor(look), mid = buildShip(R, 'middle', A), far = buildShip(R, 'far', A);
      recolourPennants(mid, look); recolourPennants(far, look);
      T[key] = { R, mid, far, zones: hitZones(mid) };
    }
    return T[key];
  }
  for (const R of FLEET) template(R.id, 'crew');
  const list = [], friends = [], escaped = [];
  let ai = true;

  // opts: look ('crew', 'captain', 'silver', 'candle', 'friend'), friend (sails with the Captain), role, name,
  // hp ({ hull, sails, crystals } to set outright), speed (a multiple of her pace), damage (her shot's weight, a
  // multiple: a boss's two gun decks would sink anything in three broadsides otherwise), bounty
  function spawn(id, pos, heading, frozen = false, captain = false, opts = {}) {
    const S = skies(), look = opts.look ?? (captain ? 'captain' : 'crew'), Tm = template(id, look), tough = S.toughness * (captain ? CAPTAIN.toughness : 1);
    const ship = raiderShip(Tm), st = STATS[id], friend = !!opts.friend;
    const stats = { ...st, hull: Math.round(st.hull * (friend ? 1 : tough)), sails: Math.round(st.sails * (friend ? 1 : tough)), crystals: Math.round(st.crystals * (friend ? 1 : tough)) };
    if (opts.hp) for (const k in opts.hp) stats[k] = Math.round(opts.hp[k] * (friend ? 1 : S.toughness));
    const f = makeFlyer(ship, stats, { pos, heading }, { speed: friend ? (opts.speed ?? 1) : S.pace * (opts.speed ?? 1) });
    const role = opts.role ?? (friend ? 'convoy' : ROLE[id]);
    f.sail = 0.85; f.speed = f.H.vmax * (friend ? 0.4 : 0.6);
    // where the Captain's guns aim at her: her hull's middle, or a treasure ship's fore sails (shoot them to catch her)
    f.aimY = Tm.zones.aim.y;
    const sails = Tm.zones.sails.filter((b) => !b.isEmpty());
    if (role === 'prize' && sails.length) {
      const c = sails[0].getCenter(new THREE.Vector3()), at = new THREE.Vector3();
      f.aimAt = () => at.copy(c).applyMatrix4(ship.body.matrixWorld).clone();
    }
    f.strikes = role === 'prize';
    ship.root.position.copy(pos); ship.root.rotation.y = heading;
    scene.add(ship.root);
    const gun = makeGunnery(ship, { reload: RAIDER.slow * S.reload * (HEAVY[id] ?? 1) * (captain ? CAPTAIN.reload : 1), damage: S.damage * (captain ? CAPTAIN.damage : 1) * (opts.damage ?? 1) });
    const r = { id, R: Tm.R, name: opts.name ?? `Raider ${captain ? 'captain\'s ' + Tm.R.cls : Tm.R.cls}`, captain, ship, f, gun, zones: Tm.zones, role, frozen, friend, look,
      bounty: opts.bounty ?? BOUNTY[id] * (captain ? CAPTAIN.bounty : 1), aim: RAIDER.aim * S.aim,
      mode: 'attack', timer: 0, side: 1, alt: (Math.random() - 0.5) * (role === 'chaser' ? 50 : 20), counted: false, gone: false,
      course: heading, fleeing: false, weave: Math.random() * 6, fireRate: 1, ai: null, holdFire: false, target: null, retarget: 0 };
    ship.update(0, {}); ship.root.updateMatrixWorld(true);
    (friend ? friends : list).push(r);
    return r;
  }

  // a wave of raiders, 1.5 to 1.9 km ahead of the Captain, more or less, coming in, its captain (if any) leading; a
  // treasure ship is closer, about 1.2 km, sailing across the Captain's path
  function spawnWave(wave, foe) {
    const base = foe.heading + (Math.random() - 0.5) * 1.4, ids = wave.ids;
    ids.forEach((id, i) => {
      const prize = ROLE[id] === 'prize', a = base + (i - (ids.length - 1) / 2) * 0.24, d = prize ? 1100 + Math.random() * 250 : 1500 + Math.random() * 400;
      const pos = new THREE.Vector3(foe.pos.x + Math.sin(a) * d, clamp(foe.pos.y + (Math.random() - 0.5) * 160, 200, 2000), foe.pos.z + Math.cos(a) * d);
      spawn(id, pos, prize ? a + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 : a + Math.PI, false, i === wave.captain);
    });
    return base;
  }

  // who a raider is after: the Captain, or (on a convoy) one of the barges, more often the nearer
  function targetOf(r, foe, dt) {
    const live = friends.filter((f) => !f.f.down && !f.gone);
    if (!live.length || r.role === 'prize') return foe;
    r.retarget -= dt;
    const cur = r.target;
    if (cur && cur !== foe && (cur.down || !live.some((x) => x.f === cur))) r.target = null;
    if (!r.target || r.retarget <= 0) {
      r.retarget = 8 + Math.random() * 6;
      const near = live.map((x) => x.f).sort((a, b) => a.pos.distanceTo(r.f.pos) - b.pos.distanceTo(r.f.pos))[0];
      const dFoe = foe.pos.distanceTo(r.f.pos);
      r.target = dFoe < 260 || Math.random() < 0.3 ? foe : near;
    }
    return r.target;
  }

  // where to steer: chasers come at the foe bow-first and break away when close; broadside ships keep it abeam
  function steer(r, foe, dt) {
    const me = r.f, L = r.R.length, P = foe.pos, dx = P.x - me.pos.x, dz = P.z - me.pos.z, d = Math.hypot(dx, dz, P.y - me.pos.y);
    const bearing = Math.atan2(dx, dz), rel = wrap(bearing - me.heading);
    r.timer -= dt;
    let want, sailTo = 1;
    if (r.role === 'prize') {
      // a treasure ship sails her course until she's chased or hit, then runs, weaving, under every sail she has
      if (!r.fleeing && (d < 1000 || me.frac('hull') < 1 || me.frac('sails') < 1)) r.fleeing = true;
      r.weave += dt * 0.3;
      want = r.fleeing ? bearing + Math.PI + Math.sin(r.weave) * 0.45 : r.course;
      sailTo = r.fleeing ? 1 : 0.7;
    } else if (r.mode === 'break') {
      want = r.breakH;
      if (r.timer <= 0) r.mode = 'attack';
    } else if (r.role === 'chaser' || d > 1500) {
      // an attack run: come at the foe, then peel away, side-on, when close or after 10-15 seconds of chasing
      const ahead = P.clone().addScaledVector(foe.velocity, Math.min(3, d / 250));
      want = Math.atan2(ahead.x - me.pos.x, ahead.z - me.pos.z);
      sailTo = d < 300 ? 0.6 : 1;
      if (d < 900) r.run = (r.run ?? 0) + dt;
      if (r.role === 'chaser' && (d < 70 + L * 4 || r.run > (r.runFor ??= 10 + Math.random() * 5))) {
        r.run = 0; r.runFor = 10 + Math.random() * 5;
        r.mode = 'break'; r.timer = 3 + Math.random() * 2.5;
        r.breakH = bearing + (Math.random() < 0.5 ? 1 : -1) * (1.8 + Math.random() * 0.7); r.alt = (Math.random() - 0.5) * 70;
      }
    } else {
      if (Math.abs(rel) > 0.35 && Math.abs(rel) < Math.PI - 0.35) r.side = Math.sign(rel);
      const ideal = 260 + L * 4, k = clamp((d - ideal) / 300, -1, 1);
      want = bearing - r.side * (Math.PI / 2 - k * 0.9);
      sailTo = 0.75;
    }
    return toward(r, want, clamp(P.y + r.alt, 150, 2200), sailTo);
  }
  // steer for a heading and a height, keeping clear of the other ships
  function toward(r, want, wantY, sailTo) {
    const me = r.f, L = r.R.length;
    let vx = Math.sin(want), vz = Math.cos(want);
    for (const o of r.friend ? friends : list) {
      if (o === r || o.f.down) continue;
      const ox = me.pos.x - o.f.pos.x, oz = me.pos.z - o.f.pos.z, dd = Math.hypot(ox, oz), keep = (L + o.R.length) * 3 + 40;
      if (dd < keep && dd > 0.1) { const w = ((keep - dd) / keep) * 1.5; vx += (ox / dd) * w; vz += (oz / dd) * w; }
    }
    const err = wrap(Math.atan2(vx, vz) - me.heading);
    return { turn: clamp(-err * 2.2, -1, 1), climb: clamp((wantY - me.pos.y) / 60, -1, 1), sailTo };
  }
  // a convoy's barge: along her waypoints (r.route), at her own pace
  function sailRoute(r) {
    const me = r.f, wp = r.route?.[r.leg];
    if (!wp) return { turn: 0, climb: 0, sailTo: 0.3 };
    const dx = wp.x - me.pos.x, dz = wp.z - me.pos.z;
    if (Math.hypot(dx, dz) < 120 && r.leg < r.route.length - 1) r.leg++;
    return toward(r, Math.atan2(dx, dz), wp.y, r.pace ?? 0.55);
  }

  // fire every battery that can reach where the foe will be, a little off
  const off = new THREE.Vector3();
  function shoot(r, foe) {
    for (const b of ['bow', 'port', 'starboard', 'stern']) {
      if (r.gun.ready[b] > 0 || !r.gun.count(b)) continue;
      const m = r.gun.muzzle(b);
      const aim = intercept(m.p, r.f.velocity, foe.aimAt(), foe.velocity, m.K.speed);
      const dist = aim.distanceTo(m.p);
      if (dist > m.K.speed * m.K.life * 0.7 || !r.gun.reaches(b, aim)) continue; // they hold fire till it's worth it
      const e = dist * r.aim + 1.5;
      aim.add(off.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * e));
      r.gun.fire(b, aim, bolts, r.friend ? 'friend' : 'raider', r.f.velocity);
    }
  }

  // every frame: steer, fly, fire, pick the detail level; returns the raiders that went down this frame
  function update(dt, foe, camera) {
    const downed = [];
    escaped.length = 0;
    const toScreen = 1 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const r of [...list, ...friends]) {
      const live = !r.f.down;
      let c = null;
      if (r.frozen && live) r.ship.update(dt, { calm: true });
      else {
        const tgt = r.friend ? null : targetOf(r, foe, dt);
        if (!live || !ai || foe.down) c = { turn: 0, climb: 0, sailTo: 0.6 };
        else c = (r.ai && r.ai(r, foe, dt)) || (r.friend ? sailRoute(r) : steer(r, tgt, dt));
        r.f.update(dt, c);
      }
      r.ship.root.updateMatrixWorld(true);
      r.gun.update(dt * r.fireRate);
      if (live && ai && !r.frozen && !foe.down && !r.holdFire && !r.friend) shoot(r, targetOf(r, foe, 0));
      if (r.f.down && !r.counted) { r.counted = true; if (!r.friend) downed.push(r); }
      // a treasure ship (or a boss that runs) that gets far enough away has escaped
      if ((r.role === 'prize' || r.canEscape) && r.fleeing && !r.f.down && r.f.pos.distanceTo(foe.pos) > (r.escapeAt ?? 3600)) { r.gone = true; r.escaped = true; escaped.push(r); }
      if (r.f.down && (r.f.pos.y < CLOUD_Y - 140 || r.f.down.t > 16)) r.gone = true;
      const size = (r.R.length / Math.max(1, camera.position.distanceTo(r.f.pos))) * toScreen;
      r.ship.detail(size < 0.06 ? 'far' : 'middle', camera.userData.pixelScale ?? 500);
    }
    for (const L of [list, friends]) for (let i = L.length - 1; i >= 0; i--) if (L[i].gone) { scene.remove(L[i].ship.root); L.splice(i, 1); }
    return downed;
  }

  // the first raider a shot from a to b (world) hits, and where (or, with `who` = friends, the first barge)
  function hitBy(a, b, who = list) {
    let best = null;
    for (const r of who) {
      if (r.f.down) continue;
      const h = firstHit(r.zones, r.ship.body, a, b);
      if (h && (!best || h.t < best.h.t)) best = { r, h };
    }
    return best;
  }

  function clear() { for (const r of [...list, ...friends]) scene.remove(r.ship.root); list.length = 0; friends.length = 0; }
  return { list, friends, escaped, spawn, spawnWave, update, hitBy, hitFriend: (a, b) => hitBy(a, b, friends), clear, templates: T, template, setAI: (on) => { ai = on; } };
}
