// raids.js: a raid on one of the places in sites.js, from setting out to its colours coming down. Each kind has its
// own objective and its own set piece:
//   rock      the prospect camp, Redspire and the Plumbline: silence the guns (Redspire's great gun on its spire
//             too) or cut the Plumbline's three drill strings, and the place strikes its colours; its guards come out
//             wave by wave meanwhile, and strike too when it does.
//   galleon   the Wickmoor: a moving treasure ship and her escort; shoot her sails till she strikes (sink her and her
//             crates go down with her). At half sail she throws cargo overboard to run, and a brig comes to help.
//   citadel   the Chandlery: six gun towers and the Baron's frigate, then Tallow's flagship, the Black Candle, rises from
//             the docks under the rock: a boss with a health bar in three phases (a broadside duel; she lights the wicks
//             and fires faster with two cutters out; she comes about to ram). Bring her down and the Chandlery strikes.
//   dredge    the Grindstone: a dredge drilling into the cliff, with a drill meter filling. Knock out her two drill
//             engines before she's through, then she backs off and fights, and at the last she runs for the gorge.
//   convoy    the Brass Road: bring the claim's three ore barges home while jumpers come at them in waves.
//   storm     the storm front: fly through the Thinwatch's beacons before the time runs out, through lightning and
//             gusts, with jumper skiffs in the murk.
//   bounty    a wanted jumper captain and her escort; she runs when she's beaten, so bring her down first.
// A place taken before has no boss the next time (REPEAT pays less); the Grindstone's wreck draws salvagers instead.
// The HUD reads info(): the objective, its progress, the boss bar and where the compass should point.
import * as THREE from 'three';
import { intercept } from './guns.js';
import { HOME } from './world.js';
import { WIND } from './flight.js';
import { FLEET, STATS } from '../ships/index.js';
import { materials, buildSite, colourFlag, buildCliff, buildDrill, buildEngine, buildBeacon, REPEAT } from './sites.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a) => { const x = Math.sin(a * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const clsOf = (id) => FLEET.find((s) => s.id === id).cls;
function describe(ids) {
  const count = {};
  for (const id of ids) count[id] = (count[id] ?? 0) + 1;
  const plural = (c) => (c === 'Man-o\'-war' ? 'Men-o\'-war' : `${c}s`);
  const parts = Object.entries(count).map(([id, n]) => `${n === 1 ? 'a' : NUMBER[n]} ${n > 1 ? plural(clsOf(id)) : clsOf(id)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
}
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// the bosses: their names, their ship, their health (before the skies' toughness) and where their phases turn
export const BOSSES = {
  candle: { name: 'The Black Candle', sub: 'Baron Tallow’s flagship', ship: 'manowar', look: 'candle', hp: { hull: 5200, sails: 1900, crystals: 2400 }, marks: [0.6, 0.3], damage: 0.4 },
  grindstone: { name: 'The Grindstone', sub: 'the Gilded Exchange’s dredge', ship: 'galleon', look: 'silver', hp: { hull: 6500, sails: 2200, crystals: 2800 }, marks: [0.3], damage: 0.45 },
};
export const DRILL_TIME = { fair: 260, cross: 220, mael: 190 };   // seconds for the Grindstone to drill through
export const STORM_TIME = { per: 13, base: 30, fair: 20, cross: 0, mael: -10 };

// ctx: scene, bolts, smoke, raiders, skies(), skiesId(), pickups, debris, flash, sfx(name, at), say { banner, toast },
// shake(seconds)
export function makeRaids(ctx) {
  const { scene, bolts, smoke, raiders, skies, pickups, debris, flash, sfx, say } = ctx;
  const M = materials(), models = new Map();
  let cur = null;
  const ZERO = V();
  const modelFor = (def) => { if (!models.has(def.id)) models.set(def.id, buildSite(def, M)); return models.get(def.id); };
  const named = (look, cap, cls) => `${look === 'silver' ? 'Exchange' : 'Jumper'} ${cap ? 'captain’s ' : ''}${cls}`;

  // ---------- setting out ----------
  // def from SITES (or bountySite). opts.repeat: taken before (no boss, smaller pay). Returns where the Captain sets
  // out from, and her heading.
  function start(def0, opts = {}) {
    clear();
    let def = def0;
    const S = skies();
    cur = { def, kind: def.kind, state: 'approach', t: 0, wave: 0, waveT: 0, guards: [], towers: [], mounts: [], taken: false, lost: false, why: '',
      center: V(def.x, def.y, def.z), prize: null, boss: null, phase: 0, smokeT: 0, repeat: !!opts.repeat, flagged: {}, beacons: [], next: 0, barges: [] };
    if (cur.kind === 'dredge' && cur.repeat) { cur.kind = 'galleon'; cur.def = def = { ...def, guard: def.repeatGuard, short: 'The salvagers' }; }   // the Grindstone's wreck draws salvagers
    if (cur.kind === 'citadel' && cur.repeat) cur.kind = 'rock';           // the Black Candle doesn't come back
    const toward = Math.atan2(def.x - HOME.x, def.z - HOME.z);
    let out = { pos: V(HOME.x + Math.sin(toward) * 900, 680, HOME.z + Math.cos(toward) * 900), heading: toward };
    if (!def.moving) {
      const m = modelFor(def);
      m.group.position.copy(cur.center); m.group.rotation.y = rnd(def.size) * 6;
      scene.add(m.group); m.group.updateMatrixWorld(true);
      colourFlag(m.flag, false);
      for (const s of m.strings) { s.visible = true; s.position.y = 0; s.rotation.set(0, 0, 0); s.userData.fall = 0; }
      cur.towers = m.towers.map((t) => {
        const hp = (t.silent ? 220 : t.spire ? 700 : def.id === 'citadel' ? 420 : 260) * S.toughness;
        return { ...t, hp, max: hp, ready: 2 + Math.random() * 2, alive: true, goal: def.winches ? !!t.silent : true, world: t.local.clone().applyMatrix4(m.group.matrixWorld) };
      });
      for (const t of cur.towers) { t.head.visible = true; t.head.rotation.set(0, 0, 0); t.barrel.visible = true; }
      cur.model = m;
    } else if (cur.kind === 'galleon' || cur.kind === 'bounty') {
      spawnGuard(0, null); cur.state = 'fight';
    } else if (cur.kind === 'dredge') {
      startDredge();
    } else if (cur.kind === 'convoy') {
      out = startConvoy();
    } else if (cur.kind === 'storm') {
      out = startStorm();
    }
    return out;
  }

  // ---------- the guards: from round the place towards the Captain (or, for a moving one, from its escort) ----------
  function spawnGuard(i, foe, from) {
    const def = cur.def, w = def.guard[i]; if (!w) return [];
    const c = from ?? where(), toFoe = foe ? Math.atan2(foe.pos.x - c.x, foe.pos.z - c.z) : 0, out = [];
    w.ids.forEach((id, k) => {
      if (cur.kind === 'galleon' && id === 'galleon' && !cur.prize) {
        const r = raiders.spawn('galleon', c.clone(), Math.atan2(HOME.x - c.x, HOME.z - c.z) + Math.PI / 2, false, false, { look: def.look });
        r.name = cur.repeat && def.id === 'dredge' ? 'The salvage galleon' : def.short; cur.prize = r; cur.guards.push(r); out.push(r);
        if (cur.repeat) r.bounty *= REPEAT;   // her hold's lighter the second time
        return;
      }
      const a = (def.moving && !from ? toFoe + Math.PI : toFoe) + (k - (w.ids.length - 1) / 2) * 0.5, d = (def.size || 60) + 120 + k * 30;
      const pos = V(c.x + Math.sin(a) * d, c.y + 30 + k * 15, c.z + Math.cos(a) * d);
      const cap = k === w.captain, B = def.bounty;
      const r = raiders.spawn(id, pos, foe ? Math.atan2(foe.pos.x - pos.x, foe.pos.z - pos.z) : a + Math.PI, false, cap, { look: cap && !def.look ? 'captain' : def.look ?? (cap ? 'captain' : 'crew'),
        ...(B && cap ? { name: B.name, bounty: B.reward * 0.2, hp: bountyHp(id), damage: id === 'manowar' ? 0.5 : 0.8 } : {}) });
      if (!(B && cap)) r.name = named(def.look, cap, r.R.cls);
      if (B && cap) { cur.boss = r; r.canEscape = true; r.escapeAt = 3200; }
      cur.guards.push(r); out.push(r);
    });
    return out;
  }
  // a wanted captain's ship: half as tough again as her class (a raider captain is twice)
  const bountyHp = (id) => { const st = STATS[id]; return { hull: st.hull * 1.4, sails: st.sails * 1.4, crystals: st.crystals * 1.4 }; };
  // where the place is now (a moving one is where its prize or boss is; a convoy is its lead barge)
  function where() {
    if (!cur) return ZERO;
    if (cur.kind === 'storm') { const b = cur.beacons[cur.next]; return b ? b.pos : cur.center; }
    if (cur.kind === 'convoy') { const b = cur.barges.find((x) => !x.f.down && !x.home); return b ? b.f.pos : V(HOME.x, 700, HOME.z); }
    if (cur.boss && !cur.boss.gone && !cur.boss.f.down) return cur.boss.f.pos;
    if (cur.prize && !cur.prize.gone) return cur.prize.f.pos;
    return cur.center;
  }
  const liveGuards = () => cur.guards.filter((r) => !r.f.down && !r.gone);

  // ---------- every frame ----------
  // returns 'taken' or 'lost' when the raid is over, otherwise null
  function update(dt, foe) {
    if (!cur) return null;
    if (cur.state === 'taken' || cur.state === 'lost') { effects(dt, foe); return null; }
    cur.t += dt; cur.waveT += dt;
    towers(dt, foe);
    mounts(dt);
    let ev = null;
    if (cur.kind === 'rock' || cur.kind === 'citadel') ev = rock(dt, foe);
    else if (cur.kind === 'galleon') ev = galleon(dt, foe);
    else if (cur.kind === 'dredge') ev = dredge(dt, foe);
    else if (cur.kind === 'convoy') ev = convoy(dt, foe);
    else if (cur.kind === 'storm') ev = storm(dt, foe);
    else if (cur.kind === 'bounty') ev = bounty(dt, foe);
    if (cur.boss) bossStep(dt, foe);
    effects(dt, foe);
    if (ev === 'taken') win(); else if (ev === 'lost') { cur.state = 'lost'; cur.lost = true; }
    return ev;
  }
  // the place strikes its colours: its guns fall silent, its guards strike theirs
  function win() {
    cur.state = 'taken'; cur.taken = true;
    if (cur.model) colourFlag(cur.model.flag, true);
    for (const r of liveGuards()) if (r !== cur.boss) r.f.down = { why: 'struck', t: 0, roll: Math.random() < 0.5 ? -1 : 1 };
    for (const t of cur.towers) if (t.alive) { t.alive = false; t.struck = true; }
  }

  // the gun towers turn and fire while you're in reach (the great gun on the spire fires heavier volleys)
  const aimP = V();
  function towers(dt, foe) {
    const S = skies(), def = cur.def, fighting = cur.state === 'fight';
    for (const t of cur.towers) {
      if (!t.alive) {
        if (!t.struck && (t.smokeT = (t.smokeT ?? 0) - dt) <= 0) { t.smokeT = 0.18; smoke.emit(t.world, V((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), 4, 2 * t.big, 9 * t.big, 0.15, 0.5); }
        continue;
      }
      if (t.silent) { t.barrel.rotation.y += dt * 2; continue; }
      const td = t.world.distanceTo(foe.pos);
      t.head.rotation.y = Math.atan2(foe.pos.x - t.world.x, foe.pos.z - t.world.z) - cur.model.group.rotation.y;
      t.barrel.rotation.x = -Math.atan2(foe.pos.y - t.world.y, Math.hypot(foe.pos.x - t.world.x, foe.pos.z - t.world.z));
      t.ready -= dt;
      if (fighting && td < (t.spire ? 1400 : 1150) && t.ready <= 0 && !foe.down) {
        // a volley of two (heavier from the Chandlery), or three heavy shot from the spire gun, each a little off
        t.ready = (t.spire ? 4.6 : def.id === 'citadel' ? 3.2 : 2.6) * S.reload * (0.85 + Math.random() * 0.3);
        const from = t.world.clone().add(V(0, 0.4, 0)), e = td * 0.016 * S.aim + 2, n = t.spire ? 3 : 2;
        for (let k = 0; k < n; k++) {
          aimP.copy(intercept(from, ZERO, foe.aimAt(), foe.velocity, 430));
          aimP.add(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * e));
          bolts.fire(from, aimP.sub(from).normalize(), t.spire ? 'broadside' : 'chaser', 'raider', ZERO, (t.spire ? 0.85 : def.id === 'citadel' ? 1.1 : 0.9) * S.damage);
        }
        if (t.spire) sfx('cannon', from);
      }
    }
  }
  // targets fixed to a ship (the Grindstone's drill engines): where they are now
  function mounts(dt) {
    for (const m of cur.mounts) {
      m.ship.body.updateMatrixWorld(true);
      m.world.copy(m.local).applyMatrix4(m.ship.body.matrixWorld);
      if (!m.alive && (m.smokeT = (m.smokeT ?? 0) - dt) <= 0) { m.smokeT = 0.12; smoke.emit(m.world, V((Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3), 4, 4, 16, 0.12, 0.6); }
    }
  }

  // ---------- rock: guns (or winches) to silence, guards in waves ----------
  function rock(dt, foe) {
    const def = cur.def, d = cur.center.distanceTo(foe.pos);
    if (cur.state === 'approach' && d < 1300) {
      cur.state = 'fight'; cur.waveT = 0; spawnGuard(0, foe);
      const guns = cur.towers.filter((t) => !t.silent).length;
      say.banner(`${def.short}: the guards come out`, `${describe(def.guard[0].ids)}${guns ? ` · ${guns} gun${guns > 1 ? 's' : ''} on the rock` : ''}${def.winches ? ' · cut the drill strings' : ''}`);
      sfx('warhorn');
    }
    if (cur.state !== 'fight') return null;
    // the next wave of guards when these are down (or when the fight drags on)
    if (cur.wave + 1 < def.guard.length && (!liveGuards().length || cur.waveT > 75)) {
      cur.wave++; cur.waveT = 0; spawnGuard(cur.wave, foe);
      say.banner('More guards', describe(def.guard[cur.wave].ids)); sfx('alarm');
    }
    // the Chandlery: when half its guns are down (or the fight has gone on three minutes), the Baron's flagship rises
    if (cur.kind === 'citadel' && !cur.boss && (cur.towers.filter((t) => t.alive).length <= 3 || cur.t > 180)) riseCandle(foe);
    if (cur.kind === 'citadel') return cur.boss && cur.boss.f.down ? 'taken' : null;
    return cur.towers.some((t) => t.goal && t.alive) ? null : 'taken';
  }

  // ---------- the Black Candle: Tallow's flagship, rising from the docks under the Chandlery ----------
  function riseCandle(foe) {
    const B = BOSSES.candle, c = cur.center, out = Math.atan2(foe.pos.x - c.x, foe.pos.z - c.z) + 0.6, R = cur.def.size + 90;
    const pos = V(c.x + Math.sin(out) * R, c.y - cur.model.depth - 30, c.z + Math.cos(out) * R);
    const r = raiders.spawn(B.ship, pos, out + Math.PI / 2, false, false, { look: B.look, hp: B.hp, name: B.name, role: 'broadside', bounty: 500, damage: B.damage });
    r.boss = 'candle'; r.f.invuln = true; r.holdFire = true; r.rise = { t: 0, y0: pos.y, y1: c.y + 25, time: 9 }; r.ai = () => ({ turn: 0, climb: 0, sailTo: 0 });
    candleFlames(r);
    cur.boss = r; cur.guards.push(r); cur.phase = 0;
    say.banner('The candle-works open', 'Tallow’s flagship rises from the docks under the rock: the Black Candle'); sfx('bossroar'); sfx('warhorn');
  }
  // candle flames at her mastheads, and a great one on her stern
  function candleFlames(r) {
    const g = new THREE.Group(), H = r.ship.hull, Rr = r.R;
    for (const m of Rr.masts) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 8), M.flame); f.position.set(0, H.deckY(m.z) + m.height + 2.2, m.z); g.add(f); }
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 7, 10), M.candle); wax.position.set(0, H.deckY(Rr.hull.stern + 3) + 3.5, Rr.hull.stern + 4); g.add(wax);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4.2, 8), M.flame); fl.position.set(0, H.deckY(Rr.hull.stern + 3) + 9.1, Rr.hull.stern + 4); g.add(fl);
    r.ship.body.add(g); r.flames = g;
  }
  // the boss's phases (the Black Candle, the Grindstone and a wanted captain)
  function bossStep(dt, foe) {
    const r = cur.boss; if (!r || r.f.down || r.gone) return;
    if (r.flames) for (const f of r.flames.children) if (f.material === M.flame) f.scale.set(1, 0.85 + Math.sin(cur.t * 13 + f.position.z) * 0.15, 1);
    if (r.boss === 'candle') {
      if (r.rise) {
        const k = Math.min(1, (r.rise.t += dt) / r.rise.time), e = k * k * (3 - 2 * k);
        r.f.pos.y = r.rise.y0 + (r.rise.y1 - r.rise.y0) * e; r.f.speed = 0; r.f.vy = 0; r.ship.root.position.copy(r.f.pos);
        if (Math.random() < dt * 8) smoke.emit(r.f.pos.clone().add(V((Math.random() - 0.5) * 60, -4, (Math.random() - 0.5) * 30)), V(0, 6, 0), 5, 8, 30, 0.2, 0.5);
        if (k >= 1) { r.rise = null; r.ai = null; r.f.invuln = false; r.holdFire = false; say.toast('The Black Candle is clear of the rock: bring her down'); }
        return;
      }
      const h = r.f.frac('hull');
      if (cur.phase === 0 && h < 0.6) {
        cur.phase = 1; r.fireRate = 1.5;
        say.banner('The Baron lights the wicks', 'The Black Candle fires faster, and two cutters launch from the rock'); sfx('bossroar');
        const c = cur.center;
        for (let k = 0; k < 2; k++) { const p = V(c.x + (k ? 40 : -40), c.y + 10, c.z), x = raiders.spawn('cutter', p, Math.atan2(foe.pos.x - p.x, foe.pos.z - p.z), false, false, { look: 'crew' }); x.name = 'Jumper Cutter'; cur.guards.push(x); }
      }
      if (cur.phase === 1 && h < 0.3) { cur.phase = 2; r.ram = { cool: 0 }; say.banner('She’s coming about to ram you!', 'Turn away, and keep firing'); sfx('alarm'); }
      if (r.ram) ramStep(r, foe, dt);
    } else if (r.boss === 'grindstone') {
      // drilling: anchored at the cliff; the engines down, she fights; beaten, she runs for the gorge
      if (cur.phase === 1 && r.f.frac('hull') < 0.3) {
        cur.phase = 2; r.canEscape = true; r.fleeing = true; r.escapeAt = 3000;
        r.ai = (rr, fo) => { const away = Math.atan2(rr.f.pos.x - fo.pos.x, rr.f.pos.z - fo.pos.z) + Math.sin(cur.t * 0.4) * 0.4; return { turn: clamp(-wrap(away - rr.f.heading) * 2, -1, 1), climb: clamp((700 - rr.f.pos.y) / 60, -1, 1), sailTo: 1 }; };
        say.banner('The Grindstone runs for the gorge', 'Sink her before she gets away'); sfx('alarm');
      }
    } else if (cur.kind === 'bounty' && !r.fleeing && r.f.frac('hull') < 0.3) {
      r.fleeing = true;
      r.ai = (rr, fo) => { const away = Math.atan2(rr.f.pos.x - fo.pos.x, rr.f.pos.z - fo.pos.z); return { turn: clamp(-wrap(away - rr.f.heading) * 2, -1, 1), climb: 0.3, sailTo: 1 }; };
      say.banner(`${r.name} runs`, 'Bring her down before she gets away'); sfx('alarm');
    }
  }
  // a ramming run: straight at the Captain at full sail; a hit stoves in her hull (and the boss's bow), then she
  // breaks off and comes round again
  function ramStep(r, foe, dt) {
    const R = r.ram; R.cool -= dt;
    if (R.cool > 0) { r.ai = null; return; }
    r.ai = (rr, fo) => {
      const ahead = fo.pos.clone().addScaledVector(fo.velocity, 1.2), want = Math.atan2(ahead.x - rr.f.pos.x, ahead.z - rr.f.pos.z);
      return { turn: clamp(-wrap(want - rr.f.heading) * 2.5, -1, 1), climb: clamp((fo.pos.y - rr.f.pos.y) / 30, -1, 1), sailTo: 1 };
    };
    const reach = r.R.length * 0.42 + foe.ship.recipe.length * 0.4;
    if (r.f.pos.distanceTo(foe.pos) < reach && !foe.down) {
      const S = skies(), hit = foe.full.hull * 0.22 * S.damage + 120;
      foe.hit('hull', hit); r.f.hit('hull', r.f.full.hull * 0.04);
      const at = foe.pos.clone().lerp(r.f.pos, 0.4);
      bolts.burst(at, 0xffa040, 80, 2.6); debris?.spawn(at, foe.velocity, 22, 1.4, 'wood', 30); flash?.at(at, 1.2);
      sfx('crack', at); sfx('hullhit', at); ctx.shake?.(0.9);
      say.toast('Rammed! The Black Candle stove in your hull');
      R.cool = 9; r.ai = null;
      // knock the two ships apart
      const push = foe.pos.clone().sub(r.f.pos).setY(0).normalize();
      foe.pos.addScaledVector(push, 12); foe.speed *= 0.4;
    }
  }

  // ---------- the Wickmoor (and salvagers): a treasure ship to make strike ----------
  function galleon(dt, foe) {
    const P = cur.prize, def = cur.def;
    if (!P) return 'lost';
    if (!cur.flagged.reinforce && def.guard[1] && (P.f.frac('sails') < 0.5 || cur.t > 60)) {
      cur.flagged.reinforce = true; cur.wave = 1;
      const c = P.f.pos, a = Math.atan2(c.x - foe.pos.x, c.z - foe.pos.z);
      spawnGuard(1, foe, V(c.x + Math.sin(a) * 700, c.y + 40, c.z + Math.cos(a) * 700));
      say.banner(def.id === 'galleon' ? 'A brig from Redspire' : 'More guards', `${describe(def.guard[1].ids)}, coming to help her`); sfx('alarm');
    }
    if (!cur.flagged.cargo && P.f.frac('sails') < 0.5 && !P.f.down) {
      cur.flagged.cargo = true;
      const at = P.f.pos.clone().addScaledVector(P.f.forward(), -P.R.length * 0.45);
      pickups?.spill(at, P.f.velocity, 60 * skies().shards);
      for (let i = 0; i < 4; i++) debris?.spawn(at, P.f.velocity, 3, 1.6, 'wood', 8);
      say.toast('She’s throwing cargo overboard to run: fly through it');
    }
    if (P.f.down) return P.f.down.why === 'struck' ? 'taken' : (cur.why = 'sunk', 'lost');
    if (P.gone || P.escaped) { cur.why = 'escaped'; return 'lost'; }
    return null;
  }

  // ---------- the Grindstone ----------
  function startDredge() {
    const def = cur.def, B = BOSSES.grindstone, c = cur.center, heading = Math.PI / 2;   // she lies across the gorge, drilling east
    const r = raiders.spawn(B.ship, c.clone(), heading, false, false, { look: B.look, hp: B.hp, name: B.name, role: 'broadside', bounty: 600, damage: B.damage });
    r.boss = 'grindstone'; cur.boss = r; cur.guards.push(r); cur.phase = 0; cur.drill = 0; cur.state = 'fight';
    const drill = buildDrill(M, 24, 5.2); drill.position.set(0, r.R.ram.y + 0.6, r.R.hull.bow - 0.5); r.ship.body.add(drill); cur.drillM = drill;
    // the two drill engines on outriggers, port and starboard, amidships
    for (const sx of [1, -1]) {
      const e = buildEngine(M), half = r.ship.hull.deckHalf(-3); e.position.set(sx * (half + 5.5), 2.5, -3); e.rotation.y = sx > 0 ? 0 : Math.PI; r.ship.body.add(e);
      cur.mounts.push({ ship: r.ship, model: e, local: V(sx * (half + 5.5), 4, -3), world: V(), hp: 900 * skies().toughness, max: 900 * skies().toughness, alive: true, r: 5, name: sx > 0 ? 'port engine' : 'starboard engine' });
    }
    // the cliff she's cutting into, ahead of her drill
    const cliff = models.get('cliff') ?? buildCliff(M); models.set('cliff', cliff);
    const fwd = V(Math.sin(heading), 0, Math.cos(heading)), tip = r.R.hull.bow + 24;
    cliff.position.copy(c).addScaledVector(fwd, tip + 80 - 4); cliff.rotation.y = heading + Math.PI;
    scene.add(cliff); cliff.updateMatrixWorld(true); cur.cliff = cliff;
    r.ai = () => ({ turn: 0, climb: 0, sailTo: 0 });   // anchored to the cliff while she drills
    r.f.speed = 0; r.f.armor = 0.2;                     // and braced: her hull is shored with iron for the drilling
    spawnGuard(0, null, c.clone().add(V(-300, 30, -250)));
  }
  function dredge(dt, foe) {
    const r = cur.boss, S = skies();
    if (!r) return 'lost';
    if (cur.phase === 0) {
      cur.drill += dt / DRILL_TIME[ctx.skiesId?.() ?? 'cross'];
      r.f.speed = 0; r.f.pos.copy(cur.center); r.ship.root.position.copy(r.f.pos);
      if (cur.drillM) cur.drillM.userData.spin.rotation.z += dt * 4;
      if ((cur.smokeT -= dt) <= 0) {
        cur.smokeT = 0.08;
        const tip = V(0, r.R.ram.y + 0.6, r.R.hull.bow + 24).applyMatrix4(r.ship.body.matrixWorld);
        bolts.spark(tip, V((Math.random() - 0.5) * 30, Math.random() * 20, (Math.random() - 0.5) * 30), 0.6, 2.5, Math.random() < 0.5 ? 0xffd27a : 0xff8a3a);
        smoke.emit(tip, V((Math.random() - 0.5) * 6, 3, (Math.random() - 0.5) * 6), 3, 6, 26, 0.55, 0.4);
      }
      if (!cur.flagged.half && cur.drill > 0.5) { cur.flagged.half = true; say.banner('The drill is halfway through', 'Knock out her drill engines'); sfx('alarm'); }
      if (cur.drill >= 1) { cur.why = 'drilled'; return 'lost'; }
      if (!cur.mounts.some((m) => m.alive)) {
        cur.phase = 1; r.ai = null; r.side = 1; r.f.armor = 1;
        say.banner('The drill stops', 'Her bracing is down: the Grindstone backs off the cliff to fight. Sink her'); sfx('bossroar');
        cur.wave = 1; spawnGuard(1, foe, r.f.pos.clone().add(V(0, 40, -500)));
      }
    }
    if (r.f.down) return 'taken';
    if (r.gone || r.escaped) { cur.why = 'escaped'; return 'lost'; }
    void S;
    return null;
  }

  // ---------- the Brass Road convoy ----------
  function startConvoy() {
    const def = cur.def, c = cur.center, home = V(HOME.x, 700, HOME.z), dir = home.clone().sub(c).setY(0).normalize(), side = V(-dir.z, 0, dir.x);
    const L = c.distanceTo(home), route = [];
    for (let i = 1; i <= 4; i++) { const k = i / 4; route.push(c.clone().lerp(home, k).addScaledVector(side, Math.sin(k * Math.PI) * L * 0.12).setY(700 + Math.sin(k * 5) * 40)); }
    const heading = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < 3; i++) {
      const p = c.clone().addScaledVector(dir, -i * 140).addScaledVector(side, (i - 1) * 70).setY(700 + i * 10);
      const r = raiders.spawn('brig', p, heading, false, false, { friend: true, look: 'friend', speed: 0.85, name: `Ore barge ${['Hester', 'Plover', 'Dunlin'][i]}` });
      r.route = route; r.leg = 0; r.pace = 0.62; r.f.sail = 0.6; cur.barges.push(r);
    }
    cur.state = 'fight'; cur.nextWave = 14;
    return { pos: c.clone().addScaledVector(side, -160).addScaledVector(dir, 60).setY(720), heading };
  }
  function convoy(dt, foe) {
    const def = cur.def, home = V(HOME.x, 700, HOME.z), S = skies();
    for (const b of cur.barges) if (!b.home && !b.f.down && b.f.pos.distanceTo(home) < 420) {
      b.home = true; b.ai = () => ({ turn: 0, climb: 0, sailTo: 0 }); say.toast(`${b.name} is home`); sfx('goal');
    }
    // jumpers come out of the cloud at the convoy's flank, ahead of it
    if (cur.wave < def.guard.length && cur.t > cur.nextWave) {
      const lead = cur.barges.find((b) => !b.f.down && !b.home) ?? cur.barges[0], dir = home.clone().sub(lead.f.pos).setY(0).normalize(), side = V(-dir.z, 0, dir.x);
      const from = lead.f.pos.clone().addScaledVector(dir, 700).addScaledVector(side, (cur.wave % 2 ? -1 : 1) * 800).setY(lead.f.pos.y + 60);
      spawnGuard(cur.wave, lead.f, from);
      say.banner(cur.wave ? 'More jumpers' : 'Jumpers, out of the cloud', `${describe(def.guard[cur.wave].ids)}, after the barges`); sfx('warhorn');
      cur.wave++; cur.nextWave = cur.t + 58;
    }
    const afloat = cur.barges.filter((b) => !b.f.down), home2 = afloat.filter((b) => b.home);
    if (!afloat.length) { cur.why = 'barges'; return 'lost'; }
    if (afloat.every((b) => b.home)) { cur.got = home2.length / cur.barges.length; return 'taken'; }
    void S;
    return null;
  }

  // ---------- the storm front ----------
  let storm3 = null;
  function startStorm() {
    const def = cur.def, n = def.rings ?? 8, c = cur.center, dir = c.clone().sub(V(HOME.x, c.y, HOME.z)).setY(0).normalize(), side = V(-dir.z, 0, dir.x);
    for (let i = 0; i < n; i++) {
      const p = c.clone().addScaledVector(dir, 420 * (i + 1)).addScaledVector(side, Math.sin(i * 1.7) * 170).setY(c.y + Math.sin(i * 1.1 + 0.6) * 90);
      const m = buildBeacon(M, 30); m.position.copy(p);
      const nx = (i < n - 1 ? 1 : 0); void nx;
      scene.add(m); cur.beacons.push({ pos: p, model: m, done: false });
    }
    // each ring faces along the course
    cur.beacons.forEach((b, i) => { const to = (cur.beacons[i + 1]?.pos ?? b.pos.clone().addScaledVector(dir, 400)).clone().sub(i ? cur.beacons[i - 1].pos : c); b.normal = to.setY(0).normalize(); b.model.lookAt(b.pos.clone().add(b.normal)); });
    const sid = ctx.skiesId?.() ?? 'cross';
    cur.limit = STORM_TIME.base + STORM_TIME.per * n + (STORM_TIME[sid] ?? 0); cur.state = 'fight'; cur.next = 0;
    storm3 = makeStorm(scene, ctx);
    cur.strikeT = 4; cur.gustT = 0;
    return { pos: c.clone().addScaledVector(dir, -120).setY(c.y), heading: Math.atan2(dir.x, dir.z) };
  }
  function storm(dt, foe) {
    const def = cur.def, b = cur.beacons[cur.next];
    if (b) {
      b.model.userData.glow.material = M.beacon; b.model.rotation.z += dt * 0.5;
      const rel = foe.pos.clone().sub(b.pos), along = rel.dot(b.normal), across = rel.clone().addScaledVector(b.normal, -along).length();
      if (Math.abs(along) < 16 + foe.ship.recipe.length * 0.3 && across < 32 + foe.ship.recipe.length * 0.15) {
        b.done = true; b.model.userData.glow.material = M.beaconOn; cur.next++; cur.limit += 3;
        sfx('goal', b.pos); bolts.burst(b.pos, 0xffd27a, 40, 2);
        if (cur.next < cur.beacons.length) say.toast(`Beacon ${cur.next} of ${cur.beacons.length}: +3 seconds`);
      }
    }
    for (const x of cur.beacons) if (x !== b && !x.done) x.model.rotation.z += dt * 0.2;
    if (!cur.flagged.jumpers && cur.t > 22) { cur.flagged.jumpers = true; spawnGuard(0, foe, foe.pos.clone().addScaledVector(foe.forward(), 900).add(V(300, 40, 0))); say.banner('Jumpers in the murk', describe(def.guard[0].ids)); sfx('warhorn'); }
    // gusts: the wind swings round and blows hard
    if ((cur.gustT -= dt) <= 0) { cur.gustT = 6 + Math.random() * 5; cur.gust = { dir: Math.random() * Math.PI * 2, strength: 0.18 + Math.random() * 0.16 }; }
    if (cur.gust) { WIND.dir += wrap(cur.gust.dir - WIND.dir) * (1 - Math.exp(-dt * 0.6)); WIND.strength += (cur.gust.strength - WIND.strength) * (1 - Math.exp(-dt * 0.8)); }
    // lightning: a glow where it will fall, then the bolt
    if ((cur.strikeT -= dt) <= 0) {
      cur.strikeT = 2.6 + Math.random() * 2.8;
      const p = foe.pos.clone().addScaledVector(foe.velocity, 1.3).add(V((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 120));
      storm3?.warn(p, 1.25, (at) => {
        storm3.bolt(at); flash?.at(at, 1.5, 0xcfe6ff); sfx('thunder', at);
        if (foe.pos.distanceTo(at) < 28 + foe.ship.recipe.length * 0.25 && !foe.down) {
          foe.hit('crystals', foe.full.crystals * 0.08); foe.hit('hull', foe.full.hull * 0.04); ctx.shake?.(0.5);
          bolts.burst(foe.pos, 0xcfe6ff, 40, 1.8); say.toast('Struck by lightning: the crystals are cracked');
        }
      });
    }
    if (cur.next >= cur.beacons.length) { cur.limit = Math.max(cur.limit, cur.t); return 'taken'; }
    if (cur.t > cur.limit) { cur.why = 'time'; return 'lost'; }
    return null;
  }

  // ---------- a wanted captain ----------
  function bounty(dt, foe) {
    const r = cur.boss;
    if (!r) return 'lost';
    if (r.f.down) return 'taken';
    if (r.gone || r.escaped) { cur.why = 'escaped'; return 'lost'; }
    return null;
  }

  // ---------- the look of it ----------
  function effects(dt, foe) {
    const def = cur.def;
    // the chimneys of the Chandlery smoke
    if (def.id === 'citadel' && cur.model && (cur.smokeT -= dt) <= 0) {
      cur.smokeT = 0.25;
      const m = cur.model.group, p = V(-6 + Math.floor(Math.random() * 4) * 4, 41, 4).applyEuler(m.rotation).add(m.position);
      smoke.emit(p, V(1.5, 4, 0.5), 9, 4, 22, 0.3, 0.45);
    }
    // cut drill strings fall away
    if (cur.model) for (const s of cur.model.strings) if (s.userData.fall) { s.userData.fall += dt; s.position.y -= dt * (8 + s.userData.fall * 14); s.rotation.z += dt * 0.15; if (s.position.y < -400) s.visible = false; }
    storm3?.update(dt, foe);
  }

  // ---------- shots ----------
  // a shot from a to b: does it hit a gun tower or a drill engine (the Captain's shots), or the rock or cliff (anyone's)?
  const seg = new THREE.Line3(), near = V(), inv = new THREE.Matrix4(), lp = V();
  function hitBy(a, b, owner) {
    if (!cur) return null;
    if (owner === 'player') {
      for (const t of cur.towers) {
        if (!t.alive) continue;
        if (seg.set(a, b).closestPointToPoint(t.world, true, near).distanceTo(t.world) < 5 * t.big) return { tower: t, at: near.clone() };
      }
      for (const m of cur.mounts) {
        if (!m.alive) continue;
        if (seg.set(a, b).closestPointToPoint(m.world, true, near).distanceTo(m.world) < m.r) return { mount: m, at: near.clone() };
      }
    }
    if (cur.model && !cur.def.moving) {
      // the rock: inside its top's circle, between its top and its keel
      const c = cur.center, R = cur.def.size, dx = b.x - c.x, dz = b.z - c.z, y = b.y - c.y;
      if (y < 0.5 && y > -cur.model.depth && Math.hypot(dx, dz) < R * (1 + y / cur.model.depth * 0.9)) return { rock: true, at: b.clone() };
    }
    if (cur.cliff && inCliff(b, 0)) return { rock: true, at: b.clone() };
    return null;
  }
  function inCliff(p, pad) {
    inv.copy(cur.cliff.matrixWorld).invert(); lp.copy(p).applyMatrix4(inv);
    return Math.abs(lp.x) < 210 + pad && lp.y < 120 + pad && lp.y > -480 && Math.abs(lp.z) < 80 + pad;
  }
  // harm to a tower or an engine; true when it's knocked out
  function damage(t, dmg) {
    t.hp -= dmg;
    if (t.hp > 0 || !t.alive) return false;
    t.alive = false;
    if (t.barrel) t.barrel.visible = false;
    if (t.model?.userData.top) t.model.userData.top.visible = false;
    bolts.burst(t.world, 0xff8a3a, 60, 2.2 * (t.big ?? 1)); flash?.at(t.world, 0.8);
    debris?.spawn(t.world, null, 14, 0.9 * (t.big ?? 1), t.silent ? 'brass' : 'wood', 18);
    if (t.string) t.string.userData.fall = 0.01;
    const goal = cur.towers.filter((x) => x.goal && x.alive).length;
    if (t.spire) say.banner('The spire gun is silenced', goal ? `${goal} more gun${goal > 1 ? 's' : ''} to go` : '');
    else if (t.silent) say.toast(goal ? `A drill string cut: ${NUMBER[goal]} left` : 'The last drill string is cut');
    else if (t.local && cur.towers.includes(t)) { const n = cur.towers.filter((x) => x.alive && !x.silent).length; say.toast(n ? `A gun tower silenced: ${NUMBER[n]} left` : 'The last gun tower is silenced'); }
    else if (cur.mounts.includes(t)) { const n = cur.mounts.filter((x) => x.alive).length; say.toast(n ? `The ${t.name} is out: one more` : 'Both drill engines are out'); }
    return true;
  }
  // keep the Captain's ship out of the rock and the cliff
  function keepOut(foe) {
    if (!cur) return;
    if (cur.model && !cur.def.moving) {
      const c = cur.center, R = cur.def.size + 6, dx = foe.pos.x - c.x, dz = foe.pos.z - c.z, h = Math.hypot(dx, dz), y = foe.pos.y - c.y;
      if (h < R && y < 10 && y > -cur.model.depth * 0.8) { foe.pos.y = c.y + 10; foe.vy = Math.max(0, foe.vy); }
    }
    if (cur.cliff && inCliff(foe.pos, foe.ship.recipe.length * 0.5)) {
      // push her back out of the face
      inv.copy(cur.cliff.matrixWorld).invert(); lp.copy(foe.pos).applyMatrix4(inv); lp.z = 80 + foe.ship.recipe.length * 0.5 + 1;
      foe.pos.copy(lp.applyMatrix4(cur.cliff.matrixWorld)); foe.speed *= 0.6;
    }
  }
  function clear() {
    if (cur?.model) scene.remove(cur.model.group);
    if (cur?.cliff) scene.remove(cur.cliff);
    for (const b of cur?.beacons ?? []) { scene.remove(b.model); b.model.traverse((o) => o.geometry?.dispose()); }
    storm3?.dispose(); storm3 = null;
    cur = null;
  }

  // ---------- what the HUD shows ----------
  function info() {
    if (!cur) return null;
    const def = cur.def, out = { goal: '', sub: '', bars: null, boss: null, at: where(), timer: null, done: cur.state === 'taken' || cur.state === 'lost' };
    const guns = cur.towers.filter((t) => t.alive && !t.silent).length, gl = cur.towers.filter((t) => t.goal && t.alive).length;
    if (cur.kind === 'rock' && def.winches) { out.goal = `Drill strings left: ${gl} of 3`; out.sub = guns ? `${guns} gun tower${guns > 1 ? 's' : ''} firing` : 'Its guns are silent'; }
    else if (cur.kind === 'rock') { out.goal = gl ? `Silence the guns: ${gl} left` : 'Silenced'; out.sub = cur.state === 'approach' ? def.goal : `${liveGuards().length} guard${liveGuards().length === 1 ? '' : 's'} in the air`; }
    else if (cur.kind === 'citadel') { out.goal = cur.boss ? 'Bring down the Black Candle' : `Silence the guns: ${guns} left`; out.sub = cur.boss ? `${guns} gun${guns === 1 ? '' : 's'} still on the rock` : 'Tallow’s flagship is under the rock'; }
    else if (cur.kind === 'galleon') { const P = cur.prize; out.goal = `Make ${def.short === 'The Grindstone' ? 'her' : def.short} strike: shoot her sails`; out.sub = P && P.fleeing ? `She’s running: ${Math.round(P.f.pos.distanceTo(ctx.player().pos))} m` : 'Don’t sink her'; }
    else if (cur.kind === 'dredge') { const n = cur.mounts.filter((m) => m.alive).length; out.goal = cur.phase === 0 ? `Knock out the drill engines: ${n} left` : 'Sink the Grindstone'; out.sub = cur.phase === 0 ? `The drill is ${Math.round(cur.drill * 100)}% through` : cur.phase === 2 ? 'She’s running for the gorge' : 'She’s fighting'; out.meter = cur.phase === 0 ? { label: 'Drill', frac: cur.drill, warn: cur.drill > 0.7 } : null; }
    else if (cur.kind === 'convoy') {
      const afloat = cur.barges.filter((b) => !b.f.down).length, home = cur.barges.filter((b) => b.home).length, lead = cur.barges.find((b) => !b.f.down && !b.home);
      out.goal = `Barges afloat: ${afloat} of ${cur.barges.length}${home ? ` · ${home} home` : ''}`;
      out.sub = lead ? `${(lead.f.pos.distanceTo(V(HOME.x, 700, HOME.z)) / 1000).toFixed(1)} km to Brightvein` : 'Home';
      out.bars = cur.barges.map((b) => ({ label: b.name.replace('Ore barge ', ''), frac: b.f.down ? 0 : b.f.frac('hull'), home: !!b.home }));
    } else if (cur.kind === 'storm') { out.goal = `Beacons: ${cur.next} of ${cur.beacons.length}`; out.timer = cur.limit - cur.t; out.sub = `${mmss(out.timer)} before the front closes`; }
    else if (cur.kind === 'bounty') { out.goal = `Bring down ${cur.boss?.name ?? def.short}`; out.sub = def.bounty ? `◆ ${def.bounty.reward} on her head` : ''; }
    // the boss bar: the Black Candle, the Grindstone, a wanted captain, the Wickmoor's sails or Redspire's great gun
    const B = cur.boss;
    if (B && !B.gone) {
      const K = BOSSES[B.boss];
      out.boss = { name: B.name, sub: K ? K.sub : def.bounty ? `“${def.bounty.nick}” · a ${B.R.cls}` : B.R.cls, frac: B.f.down ? 0 : B.f.frac('hull'), frac2: B.f.frac('crystals'),
        marks: K ? K.marks : [0.3], phase: B.rise ? 'Rising' : B.f.armor < 1 ? 'Braced: knock out her engines' : B.ram ? 'Ramming' : B.fleeing ? 'Running' : K && cur.phase ? `Phase ${cur.phase + 1}` : '', shield: !!B.f.invuln || B.f.armor < 1 };
    } else if (cur.kind === 'galleon' && cur.prize && !cur.prize.gone) {
      const P = cur.prize;
      out.boss = { name: P.name, sub: 'shoot her sails to make her strike', frac: P.f.frac('sails'), frac2: P.f.frac('hull'), label2: 'Hull', marks: [0.5], phase: P.fleeing ? 'Running' : '', sails: true };
    } else if (def.spire) {
      const t = cur.towers.find((x) => x.spire);
      if (t && t.alive && cur.state === 'fight') out.boss = { name: 'The Spire Gun', sub: 'Redspire’s great gun', frac: t.hp / t.max, marks: [], phase: '' };
    }
    return out;
  }

  return {
    start, update, hitBy, damage, damageTower: damage, keepOut, clear, where, info, models,
    get cur() { return cur; },
    get towersLeft() { return cur ? cur.towers.filter((t) => t.alive && !t.silent).length : 0; },
    get guardsLeft() { return cur ? liveGuards().length : 0; },
  };
}

// ---------- the storm's weather: dark cloud, rain, lightning ----------
function makeStorm(scene, ctx) {
  const group = new THREE.Group(); scene.add(group);
  // a dark veil round the camera, dimming the sky and the far map
  const veil = new THREE.Mesh(new THREE.SphereGeometry(2600, 24, 12), new THREE.MeshBasicMaterial({ color: 0x1a2030, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false, fog: false }));
  veil.renderOrder = -5; group.add(veil);
  // rain: streaks in a box round the ship
  const N = 700, pos = new Float32Array(N * 6), rain = new THREE.BufferGeometry();
  rain.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const drops = Array.from({ length: N }, () => V((Math.random() - 0.5) * 240, Math.random() * 160 - 60, (Math.random() - 0.5) * 240));
  const lines = new THREE.LineSegments(rain, new THREE.LineBasicMaterial({ color: 0xa8b8d0, transparent: true, opacity: 0.45 })); lines.frustumCulled = false; group.add(lines);
  // the warning glow where a bolt will fall, and the bolts themselves
  const warns = [], bolts = [];
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const boltMat = new THREE.LineBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 1, toneMapped: false });
  const fog = ctx.scene.fog, keep = fog ? { color: fog.color.clone(), near: fog.near, far: fog.far } : null;
  if (fog) { fog.color.set(0x4a5466); fog.near = 200; fog.far = 5200; }
  let cloudT = 0;
  return {
    // a pillar of pale light where the bolt will fall, brightening till it strikes
    warn(p, t, then) { const m = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 420, 10, 1, true), glowMat.clone()); m.position.copy(p).add(V(0, 160, 0)); group.add(m); warns.push({ m, t, max: t, then, p: p.clone() }); },
    bolt(at) {
      const pts = [], top = at.clone().add(V((Math.random() - 0.5) * 80, 700, (Math.random() - 0.5) * 80));
      for (let i = 0; i <= 14; i++) { const k = i / 14, p = top.clone().lerp(at, k); if (i && i < 14) p.add(V((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40)); pts.push(p); }
      const g = new THREE.BufferGeometry().setFromPoints(pts.flatMap((p, i) => (i ? [pts[i - 1], p] : [])));
      const l = new THREE.LineSegments(g, boltMat.clone()); group.add(l); bolts.push({ l, t: 0.35 });
    },
    update(dt, foe) {
      const cam = ctx.camera?.() ?? null, c = cam ? cam.position : foe.pos;
      veil.position.copy(c);
      for (let i = 0; i < N; i++) {
        const d = drops[i]; d.y -= dt * 90; d.x += WIND.strength * dt * 60 * Math.sin(WIND.dir); d.z += WIND.strength * dt * 60 * Math.cos(WIND.dir);
        if (d.y < -60) { d.y += 160; d.x = (Math.random() - 0.5) * 240; d.z = (Math.random() - 0.5) * 240; }
        const x = c.x + d.x, y = c.y + d.y, z = c.z + d.z;
        pos.set([x, y, z, x - Math.sin(WIND.dir) * 1.2, y + 5, z - Math.cos(WIND.dir) * 1.2], i * 6);
      }
      rain.attributes.position.needsUpdate = true;
      for (let i = warns.length - 1; i >= 0; i--) { const w = warns[i]; w.t -= dt; const k = 1 - w.t / w.max; w.m.scale.set(1 - k * 0.6, 1, 1 - k * 0.6); w.m.material.opacity = 0.08 + 0.3 * k * (0.7 + 0.3 * Math.sin(w.t * 30)); if (w.t <= 0) { group.remove(w.m); w.m.geometry.dispose(); w.m.material.dispose(); warns.splice(i, 1); w.then(w.p); } }
      for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.t -= dt; b.l.material.opacity = Math.max(0, b.t / 0.35); if (b.t <= 0) { group.remove(b.l); b.l.geometry.dispose(); b.l.material.dispose(); bolts.splice(i, 1); } }
      // dark cloud drifting past
      if ((cloudT -= dt) <= 0 && ctx.smoke) {
        cloudT = 0.35;
        const f = foe.forward(), p = foe.pos.clone().addScaledVector(f, 300 + Math.random() * 500).add(V((Math.random() - 0.5) * 700, (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 700));
        ctx.smoke.emit(p, V((Math.random() - 0.5) * 4, 0.5, (Math.random() - 0.5) * 4), 14, 140, 260, 0.22, 0.55);
      }
    },
    dispose() {
      scene.remove(group); veil.geometry.dispose(); rain.dispose();
      for (const w of warns) w.m.geometry.dispose();
      if (fog && keep) { fog.color.copy(keep.color); fog.near = keep.near; fog.far = keep.far; }
    },
  };
}
