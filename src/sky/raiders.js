// raiders.js: the raiders, the Captain's enemies for now. They fly the Captain's classes (Skiff, Cutter, Brig,
// Frigate, and the giants, the Galleon and the Man-o'-war, only once the Captain owns that giant: waveAt), built by the
// same code at the middle and far settings of the detail dial, and they fly by the same rules (flight.js), a little
// slower. Raiders are easy to tell apart: rust-red sails, darker planks and crimson pennants with a black hoist (their
// liveries: src/ship/livery.js).
//   Skiffs and Cutters chase: attack runs, bow-first, peeling away side-on when close.
//   Brigs, Frigates and the Man-o'-war fight broadside: they come alongside a few hundred metres off and fire whole
//   sides. The Man-o'-war is a fortress: two decks of twelve guns a side, slow to turn and slower to climb. Her five
//   crystal columns glow brighter than any other ship's, beating like a heart: her weak points (looks.js blows them out).
//   A treasure ship sails by, runs once she's chased, covering her escape with her stern guns, and strikes her colours
//   when her sails are gone or her hull is down to a quarter. Left too far behind, she gets away. The Galleon always
//   sails as one; any other class can too (spawn's `treasure`, or the ships a wave's `treasure` names), in the treasure
//   ship's colours: wine-red sails edged in gold, gilded brass that glints, and chests of gold on her deck, her hold
//   worth a Galleon's, and she sails laden, a little slower than her class. Until the Captain owns a Galleon, the
//   treasure ship is a treasure Brig.
// They come in waves, smallest first, and every fifth wave is led by a raider captain: tougher, harder-hitting and
// quicker to reload, and worth four times the shards. Her ship looks the leader's: black sails edged in crimson,
// blackened iron, crimson crystals, red eyes at her bow and a great swallow-tailed banner. How sharp the raiders are
// depends on the skies the Captain chose (progress.js); on Fair Winds a captain is no tougher than her crew, hits no
// harder and reloads no faster.
// Before a raider's broadside goes off, her gun ports glow red, brightening to gold, a red fan of crisp lines opens off
// her side showing where her guns can reach (guns.js fanGeometry), and the lids on that side fly open and her guns run out
// (looks.js): for the skies' warning time (progress.js `warn`: 1 s on Fair Winds, 0.8 on Crosswinds, 0.6 on the
// Maelstrom; a little longer on the two big ships). Her gunners aim then, where the Captain will be when the side goes
// off if she holds her course, and that's where it goes: climb out of the red and it misses (dive, and about half of
// it may still find her; a hard turn carries only a Skiff or a Cutter clear in time). Then her
// side ripples off, bow to stern (guns.js). Her broadside crews reload quicker than her light guns' (RAIDER.broadside),
// so she fires as often as before the warning made her wait.
// On Crosswinds and the Maelstrom they fight smarter (progress.js `smart`, tactics.js SMART): a big raider the Captain
// points her bow at crosses ahead of it, to rake her; and on the Maelstrom a small one makes her attack runs at the
// Captain's stern, where her guns are few, and one the Captain's guns are locked on to, her loaded broadside pointed at
// her, may climb or dive out of it.
// Clouds (sky.js): a raider can't see the Captain hidden deep in cloud unless she's near (the skies' `sight`): she holds
// her fire and comes looking where she last saw her, circling there. With the Captain inside a cloud, seen or not, the
// raiders aim 2.6 times as wide.
// They have nerve, and know when they're beaten (tactics.js NERVE): a crew beaten strikes her colours (a white flag goes
// up: wrecks.js); a hurt Skiff, Cutter or Brig may run for the clouds, firing only her stern guns, and get away; a hurt
// Brig or Frigate fires a red flare, and help comes if she isn't sunk in time.
// Every raider captain has a name, a title and a trick (tactics.js CAPTAINS, played in steer and shoot); the Man-o'-war
// fights in three acts (FORT): her plated sides shrug off half a hit from the side, her blocks of six guns can be
// silenced, at two-thirds of her hull she launches two Skiffs from her stern, and with three columns blown out she's
// sinking (under the cloud floor within a minute) and fires everything, her upper deck's guns tilting up to reach above
// her.
// Waves come in different ways (waveAt's `how`: spawnWave): ahead, from both sides, up through the clouds below (in a
// ring of mist as they burst through), out of the sun (their tags hidden in its glare at first), high and low, or a line
// of battle: big raiders nose to tail, each keeping station on the one ahead and firing after her, down the line, until
// the leader is sunk (or strikes) and the line breaks up (LINE). Between waves a second way on can be taken (roadWave:
// tactics.js ROADS).
import * as THREE from 'three';
import { buildShip, shipMotion } from '../ship/build.js';
import { makeLook, dress } from '../ship/dress.js';
import { liveryArt, liveryOpts, wearLivery, DEBRIS } from '../ship/livery.js';
import { FLEET, STATS } from '../ships/index.js';
import { makeFlyer } from './flight.js';
import { makeGunnery, intercept, HEAVY, KINDS, fanGeometry, batteryFor } from './guns.js';
import { hitZones, firstHit, sailBox } from './damage.js';
import { CLOUD_Y, SUN, THINNING } from './world.js';
import { emit, payload } from './events.js';
import { SMART, NERVE, TRICK, FORT, LINE, ROADS } from './tactics.js';
import { PUFF } from './effects.js';

// How the raiders compare with the Captain, before the skies' own settings: reload half as slowly again, and aim a
// little off (by this much for every metre to the target); and her broadside crews reload in this share of that time,
// as her broadside then waits the skies' warning time (so a Crosswinds raider's side goes off about every 3.9 s, as
// before the warning: tuned with tools/sim-fight.mjs so a Captain who ignores it is as hard pressed as ever)
export const RAIDER = { slow: 1.5, aim: 0.02, broadside: 0.8 };
// how much longer the two big ships' gun ports glow than the skies' warning time (seconds), and the glow's colours,
// from first to firing
export const WARN = { big: 0.15 }, WARN_FROM = new THREE.Color(0xff4636), WARN_TO = new THREE.Color(0xffc070);
// her red danger fan while she readies a broadside: its colour, and how strong it is as she's about to fire (it grows
// from a third of that as her ports start to glow); out to where she'd fire at all (shoot: 70% of the guns' reach)
export const FAN = { color: 0xff3a2a, opacity: 0.5, reach: KINDS.broadside.speed * KINDS.broadside.life * 0.7 };
// how it's drawn, so it reads as a fan of danger from anywhere, the chase view behind the Captain above all (there
// she's inside it or just above it, its broad faces seen nearly edge-on): crisp red lines a pixel or two wide whatever
// the distance (worked out on the screen: fwidth), with only a faint wash of red between them, faintest where a face is
// seen edge-on, so it never lies over the sky as a pink haze. The lines: spokes running out from her guns along its top,
// its bottom and its two sides, rings rippling out from her side (faster as she's about to fire), its far rim, and,
// with the Captain inside it (`uHit`: how far out her ship is, as a share of its reach; below 0 when she's outside it),
// a brighter, thicker ring where it reaches her ship and its spokes burning hotter and thicker all the way from her guns
// to there, hottest by her: from behind her ship, where that ring is all round the view and off the screen, the hot
// spokes running at her still say it's her the fan has found. The wash is strongest close to her (but not over her own
// ship) and fades out along it. (Gun's own frame: +z the way the gun points, its swing and tilt given)
// Cheap for a phone: every ring is round, worked out on each pixel from how far it is from her gun (one length), and
// every spoke is where a flat plane through her gun cuts the fan, so how far a pixel is off it is a sum of products of
// where it is (no angles worked out); how squarely each face is seen comes from the corners' `normal` (fanGeometry),
// worked out once a corner; only three things are measured across the screen (fwidth), and each line's soft edge is a
// straight ramp a pixel wide; its colours are given as the screen shows them (uColor turned to the screen's colours
// once, not on every pixel). `uCut`: the planes of the spokes along its top and bottom near their corners (62% of its
// swing: cos, sin) and of the sides' (60%: cos, sin); `uTilt`: where the top and bottom begin (55% of its tilt: sin)
const FAN_VERT = `uniform float uReach; varying vec3 vP; varying vec3 vV; varying float vD;
  void main() { vP = position / uReach; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = mv.xyz; vD = dot(normalize(normalMatrix * normal), mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FAN_FRAG = `uniform vec3 uColor; uniform float uK; uniform float uTime; uniform float uReach; uniform vec4 uCut; uniform float uTilt; uniform float uHit; uniform float uOwn; uniform float uPx;
  varying vec3 vP; varying vec3 vV; varying float vD;
  // (a line px pixels wide, d pixels from its middle)
  float line(float d, float px) { return clamp(px * uPx * 0.5 + 0.5 - d, 0.0, 1.0); }
  void main() {
    // how far out (R: a share of its reach), and how far off its spokes (mu: the middle one along its top and bottom, or
    // the two near their corners; mv: the sides' middles), as the sine of the angle from each, seen from her gun; and
    // how much each changes from one pixel to the next (measured before any abs(), whose fold would read as no change at
    // all on a spoke's middle)
    float L2 = max(dot(vP, vP), 1e-8), iL = inversesqrt(L2), R = L2 * iL, xu = vP.x * iL, yv = vP.y * iL, ax = abs(xu), mv = abs(yv);
    float mu = min(ax, abs(ax * uCut.x - vP.z * iL * uCut.y));
    vec3 per = 1.0 / max(fwidth(vec3(R, xu, yv)), vec3(1e-6));
    float pR = per.x, pu = per.y, pv = per.z, V2 = dot(vV, vV), iv = inversesqrt(V2), dv = V2 * iv;
    // (nothing over her own ship, seen past the fan's first few metres from her gun: from a quarter of her length out
    // to one and a half, slowly at first, uOwn being 1 over 1.25 lengths, as a share of its reach; and nothing right by
    // the camera, where a line would sweep across the whole view)
    float near = clamp(R * uOwn - 0.2, 0.0, 1.0) * clamp((dv - 10.0) * 0.02, 0.0, 1.0);
    near *= near;
    if (near < 0.002) discard;
    // (the stretch from her guns to the Captain's ship, while she's in it: hottest by her, a third as hot half its
    // reach nearer her guns, gone just past her)
    float hot = uHit > 0.0 ? clamp((uHit + 0.005 - R) * 50.0, 0.0, 1.0) * (1.0 - 1.3 * min(0.5, uHit - R)) : 0.0;
    // spokes: three along the top and the bottom (its middle and near its corners), one along each side's middle
    float spokes = line(min(step(uTilt, mv) > 0.5 ? mu * pu : 1e4, step(vP.z * iL * uCut.w, ax * uCut.z) > 0.5 ? mv * pv : 1e4), 1.8 + 1.8 * hot);
    // the rings rippling out (fainter seen edge-on), its far rim, and the ring where it reaches the Captain's ship;
    // nothing but the far rim's outer half past its reach
    float s = R * 5.0 - uTime * (0.6 + 1.6 * uK), face = clamp((abs(vD) * iv - 0.05) * 2.5, 0.0, 1.0), q = 1.0 - R, inside = step(R, 1.0);
    float rings = line(abs(fract(s) - 0.5) * pR * 0.2, 1.4) * (0.35 + 0.65 * face);
    float rim = line(abs(q) * pR, 2.2);
    float hit = uHit > 0.0 ? line(abs(R - uHit) * pR, 3.2) : 0.0;
    // the wash: faint, strongest near her, fading along it, and fainter seen edge-on
    float q3 = q * q * q, wash = (0.03 + 0.55 * q3 * q3) * face;
    float lines = max(max(spokes * (1.0 - 0.5 * R) * (1.0 + 0.9 * hot), rings * 0.75 * q * q * (1.0 + 0.6 * hot)) * inside, max(rim * 0.8, hit));
    float a = clamp(uK * near * (wash * inside + 1.9 * lines), 0.0, 1.0);
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.87, 0.74), 0.4 * max(hit, 0.6 * hot * spokes)), a);
  }`;
// a raider captain's edge over her crew (times as tough, as hard-hitting, as long to reload), all of it on most skies
// and none on Fair Winds (the skies' `captain`), and her bounty
export const CAPTAIN = { toughness: 2, damage: 1.2, reload: 0.9, bounty: 4 };
// the colours of what a shot knocks off her (fx.js): her planks, and her sails (rust-red for the crews, black for
// their captains, wine-red for a treasure ship)
export const LOOKS = { crew: DEBRIS.crew, captain: DEBRIS.captain, treasure: DEBRIS.treasure };
// Crystal Shards for bringing one down (before the skies' and the wave's bonus); a treasure ship's hold is worth a
// Galleon's, whatever class she is (a treasure Brig plays the Galleon's part until the Captain owns one), and laden
// with it she sails at this share of her class's top speed, so even a Skiff can run her down
export const BOUNTY = { skiff: 15, cutter: 30, brig: 60, frigate: 100, galleon: 300, manowar: 400 }, TREASURE = { bounty: BOUNTY.galleon, laden: 0.85 };
const ROLE = { skiff: 'chaser', cutter: 'chaser', brig: 'broadside', frigate: 'broadside', galleon: 'prize', manowar: 'broadside' };
// whether ship i of a wave sails as a treasure ship (she runs, and strikes her colours): every Galleon, even one that's
// the wave's captain, and the ships the wave's `treasure` names (but not its captain, who fights); and whether a wave
// brings one, and how many (main.js: its banner, its sound)
export const treasureShip = (wave, i) => ROLE[wave.ids[i]] === 'prize' || (i !== wave.captain && !!wave.treasure?.includes(i));
export const hasTreasure = (wave) => wave.ids.some((id, i) => treasureShip(wave, i));
export const treasureCount = (wave) => wave.ids.filter((id, i) => treasureShip(wave, i)).length;
// The waves, smallest first. The giants sail in them only once the Captain owns that class (Chris: giant raiders only
// once you own one, whichever ship you take out that voyage; `giants` says which she owns: progress.js). Until then each
// has a stand-in (STAND_IN): for a Galleon, a treasure Brig, a rich merchant laden with shards who runs as a Galleon
// does; for a Man-o'-war, a raider captain's Frigate, leading the escorts the Man-o'-war would have had
export const WAVES = [['skiff'], ['skiff', 'skiff'], ['cutter'], ['cutter', 'skiff'], ['brig'], ['galleon', 'cutter'], ['frigate'],
  ['frigate', 'cutter', 'cutter'], ['brig', 'brig', 'skiff', 'skiff'], ['frigate', 'brig', 'cutter', 'cutter', 'skiff'],
  ['galleon', 'frigate', 'cutter'], ['manowar', 'cutter', 'cutter'], ['frigate', 'frigate', 'brig'], ['galleon', 'galleon', 'frigate', 'cutter'],
  ['manowar', 'frigate', 'brig', 'cutter']];
export const STAND_IN = { galleon: [{ id: 'brig', treasure: true }], manowar: [{ id: 'frigate', captain: true }] };
// After the fifteenth, three to six raiders at random from POOL (a giant not yet owned sails as her one-ship stand-in:
// a treasure Brig, or a Frigate), with at most one Man-o'-war and one treasure ship at once (every Galleon is one).
// Once owned, the Man-o'-war grows common: from wave 16 she comes once more in the pool every fourth wave, up to four
// times as often. The treasure ship doesn't: a Galleon or a treasure Brig comes as often whichever the Captain owns,
// so late waves stay fights, with now and then a prize to chase, not chases (COMMON)
const POOL = ['skiff', 'skiff', 'cutter', 'cutter', 'cutter', 'brig', 'brig', 'frigate', 'frigate', 'galleon', 'manowar'];
const ALONE = { galleon: { id: 'brig', treasure: true }, manowar: { id: 'frigate' } }, MOST = { galleon: 1, manowar: 1 }, COMMON = ['manowar'];
// wave n (from 0): which ships, the biggest first; which of them sail as treasure ships besides the Galleons
// (`treasure`, their places), and which is led by a raider captain (`captain`, her place, or -1): every fifth wave's
// biggest ship that fights (not a Man-o'-war, which needs no captain, nor a treasure ship; a Galleon only if the wave
// has nothing else, and she still runs), or a Man-o'-war's stand-in, her raider captain's Frigate (`standIn`: on a wave
// not every fifth, she's not one of the named captains, main.js). `plain` leaves out every fifth wave's captain (her own captain hunted down
// early, on the road before: roadWave), but not a stand-in's.
// Maelstrom skies add `extra` Skiffs or Cutters from the third wave on. `storms` (the skies', progress.js) says whether
// it brings a storm; a storm wave, and every third, comes out of a bank of cloud (main.js), if it comes from far off:
// ahead, high and low, or in a line (not up through the clouds, out of the sun or from both sides: BANKED).
// And how it comes (`how`, spawnWave): the first fifteen as HOW has them (null: a raider captain's wave, coming her
// own way: WAY), and after that at random from LATE (a line only with two big raiders to make it, or it comes ahead)
const SIZE = { skiff: 0, cutter: 1, brig: 2, frigate: 3, galleon: 4, manowar: 5 };
export const HOW = ['ahead', 'pincer', 'below', 'stack', null, 'ahead', 'sun', 'stack', 'line', null, 'sun', 'ahead', 'line', 'pincer', null];
const LATE = ['ahead', 'ahead', 'below', 'sun', 'pincer', 'stack', 'line'];
// how a raider captain's wave comes, by her trick: the Cloud Fox up through the clouds, the Sun-Diver out of the sun
export const WAY = { cloud: 'below', sun: 'sun' };
// (whether a battery has broadside guns in it, not only light swivels: a Skiff's sides have only swivels)
const broadsideIn = (guns) => { for (let i = 0; i < guns.length; i++) if (guns[i].kind === 'broadside') return true; return false; };
const BIG = (id) => ROLE[id] === 'broadside'; // (a ship that fights broadside: one for a line of battle)
const BANKED = ['ahead', 'stack', 'line'];
export function waveAt(n, extra = 0, storms = null, giants = null, plain = false) {
  const owns = (id) => !STAND_IN[id] || !!giants?.[id];
  let list;
  if (WAVES[n]) list = WAVES[n].flatMap((id) => (owns(id) ? [{ id }] : STAND_IN[id].map((e) => ({ ...e }))));
  else {
    const pool = [...POOL], more = Math.min(3, Math.floor((n - WAVES.length) / 4) + 1), count = { galleon: 0, manowar: 0 };
    for (const id of COMMON) if (owns(id)) for (let k = 0; k < more; k++) pool.push(id);
    list = Array.from({ length: Math.min(6, 3 + ((n - WAVES.length) >> 1)) }, () => {
      let id = pool[Math.floor(Math.random() * pool.length)];
      if (MOST[id] && count[id]++ >= MOST[id]) id = POOL[Math.floor(Math.random() * 9)]; // (too many of her: one of the rest)
      return owns(id) ? { id } : { ...ALONE[id] };
    });
  }
  if (n >= 2) for (let i = 0; i < extra && list.length < 6; i++) list.push({ id: n % 2 ? 'cutter' : 'skiff' });
  const storm = !!storms && (storms.waves.includes(n + 1) || (n >= WAVES.length && Math.random() < storms.after));
  let how = n < HOW.length ? HOW[n] : LATE[Math.floor(Math.random() * LATE.length)];
  if (how === 'line' && list.filter((e) => BIG(e.id) && !e.treasure).length < 2) how = 'ahead';
  return finish(list, { captain: (n + 1) % 5 === 0 && !plain, storm, bank: (storm || (n + 1) % 3 === 0) && BANKED.includes(how ?? 'ahead'), how });
}
// a wave from its ships (each { id, treasure, captain }), the biggest first: its treasure ships' places, and its captain's
// (a stand-in's, or, if `captain`, the biggest ship that fights)
function finish(list, { captain: lead = false, storm = false, bank = false, how = 'ahead' } = {}) {
  list.sort((a, b) => SIZE[b.id] - SIZE[a.id]);
  let captain = list.findIndex((e) => e.captain);
  const standIn = captain >= 0 && !lead; // (a stand-in leading every fifth wave is its raider captain, named, all the same)
  if (captain < 0 && lead) {
    captain = list.findIndex((e) => e.id !== 'manowar' && !e.treasure && ROLE[e.id] !== 'prize');
    if (captain < 0) captain = list.findIndex((e) => e.id === 'galleon');
  }
  const treasure = list.flatMap((e, i) => (e.treasure ? [i] : []));
  return { ids: list.map((e) => e.id), captain, standIn, treasure, storm, bank, how: captain >= 0 && !standIn ? null : how ?? 'ahead', list };
}
// the second way on, between waves (tactics.js ROADS), beside the steady course `wave` (the wave planned, which has no
// raider captain): into the storm, the same and one more ship (a Cutter, or a Skiff with only small raiders), in
// a storm, out of a bank of cloud, a little sturdier and worth more; a treasure ship's trail, the same raiders (coming
// the same way, in the same weather) and a treasure ship sailing with them (a treasure Brig until the Captain owns a
// Galleon), so it's richer and harder, not a small wave in place of a big one (with six already, she takes the
// smallest one's place); or the hunt, the same ships led by the next raider captain, come early (main.js names her,
// and her bounty is half as much again: tactics.js ROADS), in a ship of her own: the biggest that fights, but never smaller than `lead` (a
// Brig for the Cloud Fox, a Frigate from the Sail-Ripper on: the ship her own wave would give her). Each says which
// road it is
export function roadWave(kind, wave, giants = null, lead = 'brig') {
  const R = ROADS[kind];
  let w;
  if (kind === 'storm') {
    const more = !R.more ? [] : [{ id: wave.list.some((e) => SIZE[e.id] >= SIZE.brig) ? 'cutter' : 'skiff' }]; // (one ship more, or none: ROADS)
    w = finish([...wave.list.map((e) => ({ ...e })), ...more], { storm: true, bank: true, how: wave.how === 'line' ? 'line' : 'ahead' });
  } else if (kind === 'treasure') {
    const list = wave.list.map((e) => ({ ...e }));
    if (list.length >= 6) list.splice(list.length - 1, 1); // (the list is biggest first: the smallest goes)
    list.push(giants?.galleon ? { id: 'galleon' } : { ...STAND_IN.galleon[0] });
    w = finish(list, { storm: wave.storm, bank: wave.bank, how: wave.how ?? 'ahead' });
  } else {
    const list = wave.list.map((e) => ({ ...e })), big = list.find((e) => e.id !== 'manowar' && !e.treasure && ROLE[e.id] !== 'prize');
    if (big && SIZE[big.id] < SIZE[lead]) big.id = lead;
    else if (!big) list.push({ id: lead });
    w = finish(list, { captain: true });
  }
  return Object.assign(w, { road: kind, mult: R.mult, bonus: R.bonus, tough: R.tough, bounty: R.bounty ?? 1 });
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// where crystal breakers aim on a class (in her own frame, worked out once, from her hit zones: damage.js): the middle of
// what shows of her crystals `cb` over her rail, seen from her side (her rail found where they stand)
function breakAt(Z, cb) {
  const q = new THREE.Vector3(0, 0, (cb.min.z + cb.max.z) / 2);
  let rail = cb.min.y;
  for (let y = cb.min.y; y <= Z.hullBox.max.y + 0.5; y += 0.1) if (Z.inHull(q.setY(y))) rail = y;
  return q.set((cb.min.x + cb.max.x) / 2, (Math.min(rail, cb.max.y) + cb.max.y) / 2, q.z);
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The masts, cut out of a class's middle model once, as it's built (on a laptop: wrecks.js topples them when she's blown
// apart). For each of her meshes of wood, brass and canvas: the triangles that stay with the hull, and for each mast,
// the ones that fall with it (her pennants and all her rigging just go: snapped; so do the spikes at her yards' tips,
// while the rest of her moving metal, her guns, stays). A mast is everything a metre above the deck round its foot,
// and everything from just under its lowest yard up, fore and aft of it as far as its sails reach. The pieces share
// the model's own vertices, so they're only lists of numbers
const CUT = ['wood', 'brass', 'canvas', 'flag', 'rope', 'rigMetal'], FALL = ['wood', 'brass', 'canvas'], SNAP = ['flag', 'rope'];
function cutMasts(R, model) {
  const hull = model.hull, masts = R.masts.map((M) => {
    const y0 = hull.deckY(M.z), sweep = Math.max(...M.tiers.map((t) => t.sweep)), foot = 1 + (0.11 + 0.0045 * R.length) * 3;
    return { y0, low: y0 + Math.min(...M.tiers.map((t) => t.at)) * M.height - 0.4, z: M.z, z0: M.z - sweep - 1.5, z1: M.z + 0.9, foot, H: M.height };
  });
  const which = (x, y, z) => {
    for (let i = 0; i < masts.length; i++) {
      const m = masts[i];
      if (y > m.y0 + 1 && (y >= m.low ? z > m.z0 && z < m.z1 : Math.abs(x) < m.foot && Math.abs(z - m.z) < m.foot)) return i;
    }
    return -1;
  };
  const share = (src, list) => {
    const g = new THREE.BufferGeometry();
    for (const k in src.attributes) g.setAttribute(k, src.attributes[k]);
    g.setIndex(new THREE.BufferAttribute(Uint32Array.from(list), 1)); g.boundingSphere = src.boundingSphere;
    return g;
  };
  const keep = {}, fall = masts.map(() => ({}));
  for (const o of model.body.children) {
    if (!o.isMesh || !CUT.includes(o.name)) continue;
    const p = o.geometry.attributes.position.array, lists = [[], ...masts.map(() => [])];
    for (let t = 0, n = p.length / 9; t < n; t++) {
      const a = t * 9, i = which((p[a] + p[a + 3] + p[a + 6]) / 3, (p[a + 1] + p[a + 4] + p[a + 7]) / 3, (p[a + 2] + p[a + 5] + p[a + 8]) / 3);
      lists[i + 1].push(t * 3, t * 3 + 1, t * 3 + 2);
    }
    keep[o.name] = share(o.geometry, SNAP.includes(o.name) ? [] : lists[0]);
    if (FALL.includes(o.name)) masts.forEach((m, i) => { if (lists[i + 1].length) fall[i][o.name] = share(o.geometry, lists[i + 1]); });
  }
  // (stern first, the way the blasts walk)
  return { keep, masts: masts.map((m, i) => ({ pivot: new THREE.Vector3(0, m.y0 + 1, m.z), height: m.H, geo: fall[i] })).sort((a, b) => a.pivot.z - b.pivot.z) };
}

// One raider ship: copies of its class's middle and far models (sharing their shapes), swapped by how big it looks.
// Her parts that a wreck changes (wrecks.js) are her own: her crystals' glows and embers, her sails and her pennants,
// her middle and far models' meshes by name, and her far model's rigging (hidden when her masts fall). So are her
// looks (her scars and her life, src/ship/dress.js): one set for both models, read by her own copies of the materials
// that show them (which share their shaders with every other ship's), and by her own glows and embers
function raiderShip(T) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mid = T.mid.body.clone(), far = T.far.body.clone(); far.visible = false; body.add(mid, far);
  const U = makeLook();
  dress([mid, far], T.mid.M, U);
  const rudders = [], glows = [], embers = [], canvas = [], flags = [], meshes = {}, farMeshes = {}, farRig = [];
  body.traverse((o) => {
    if (o.name === 'rudder') rudders.push(o); else if (o.name === 'glow') glows.push(o); else if (o.name === 'embers') embers.push(o);
    else if (o.name === 'canvas') canvas.push(o); else if (o.name === 'flag') flags.push(o);
    if (o.name === 'glow' || o.name === 'embers') { o.material = o.material.clone(); for (const k in o.material.uniforms) if (U[k]) o.material.uniforms[k] = U[k]; }
  });
  for (const o of mid.children) if (o.isMesh) meshes[o.name] = o;
  for (const o of far.children) if (o.isMesh) { farMeshes[o.name] = o; if (CUT.includes(o.name) && o.name !== 'wood' && o.name !== 'brass') farRig.push(o); }
  const move = shipMotion(T.R, body, rudders);
  return {
    root, body, recipe: T.R, hull: T.mid.hull, length: T.R.length, level: 'middle', masts: T.masts ?? null, U, wings: T.mid.wings, livery: T.look,
    parts: { glows, embers, canvas, flags, meshes, farMeshes, farRig },
    update(dt, opts) {
      const t = move(dt, opts);
      for (const g of glows) g.material.uniforms.uTime.value = t;
      for (const e of embers) e.material.uniforms.uTime.value = t;
    },
    detail(level) { mid.visible = level === 'middle'; far.visible = level === 'far'; this.level = level; },
    // her glows and embers drawn at the screen's scale (its pixels at a metre: main.js), as the Captain's are
    scale(px) { for (const g of glows) g.material.uniforms.uScale.value = px; for (const e of embers) e.material.uniforms.uScale.value = px; },
  };
}

// The title screen's raiders (title.js) sail far off, so each is her far model in one piece, drawn in one go (a phone
// draws the title first, and each raider's dozen or so materials would cost it a dozen draws). Each corner of her takes
// the colour her own material gives it there: the material's colour, times its painting under that corner (for the tiled
// planks, deck and bands, their average colour), times its own colour (the pennants and crystals have their own), and
// glows as it does (the lamplight, the crystals, the sails' warmth). Her cut-out parts (the painted rails) keep only the
// triangles that are mostly painted, and her sails glow (SAIL_GLOW, of their own colour) as canvas does with the low
// sun behind it: the title looks toward the sun, so it's their shaded side that shows. The paintings are read small,
// and their pixels let go as soon as the ships being put together then are done (the title's opening puts its two or
// three together at once): kept, the two big picture sheets' would hold about 2 MB for the whole game, on a phone too.
// A class put together later reads them again
const SAIL_GLOW = 0.5;
const LIN = Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c < 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); // (a byte of a painting, as light)
const paintings = new Map(); // (a texture's pixels, while they're wanted, and the average colour of what's painted)
let letGo = false; // (the pixels' letting go is waiting for the work in hand to finish)
function painting(tex) {
  let p = paintings.get(tex);
  if (!p?.d) {
    if (!letGo) { letGo = true; queueMicrotask(() => { letGo = false; for (const q of paintings.values()) q.d = null; }); }
    const img = tex.image, w = Math.min(512, img.width), h = Math.min(512, img.height), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, mean = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 115) { mean[0] += LIN[d[i]]; mean[1] += LIN[d[i + 1]]; mean[2] += LIN[d[i + 2]]; n++; }
    p = { w, h, d, mean: mean.map((v) => v / Math.max(1, n)), tiled: tex.wrapS === THREE.RepeatWrapping };
    paintings.set(tex, p);
  }
  return p;
}
// a painting's colour (linear) and how opaque it is at a corner's place on it (uv), into out; its average if it's tiled,
// or where it isn't painted
function paintAt(tex, uv, i, out) {
  const p = painting(tex);
  out[3] = 1;
  if (!p.tiled && uv) {
    const x = Math.min(p.w - 1, Math.max(0, Math.floor(uv.getX(i) * p.w))), y = Math.min(p.h - 1, Math.max(0, Math.floor((1 - uv.getY(i)) * p.h))), k = (y * p.w + x) * 4;
    out[3] = p.d[k + 3] / 255;
    if (out[3] > 0.45) { out[0] = LIN[p.d[k]]; out[1] = LIN[p.d[k + 1]]; out[2] = LIN[p.d[k + 2]]; return out; }
  }
  out[0] = p.mean[0]; out[1] = p.mean[1]; out[2] = p.mean[2];
  return out;
}
function onePiece(body) {
  body.updateMatrixWorld(true);
  const inv = body.matrixWorld.clone().invert(), m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), c = new THREE.Color(), e = new THREE.Color(), px = [0, 0, 0, 1];
  const pos = [], nor = [], col = [], glow = [], idx = [];
  body.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, M = o.material, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, C = M.vertexColors ? g.attributes.color : null, I = g.index;
    m.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m);
    const base = pos.length / 3, alpha = new Float32Array(P.count).fill(1);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      if (N) v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); else v.set(0, 1, 0);
      nor.push(v.x, v.y, v.z);
      c.copy(M.color);
      if (M.map) { paintAt(M.map, UV, i, px); c.r *= px[0]; c.g *= px[1]; c.b *= px[2]; alpha[i] = px[3]; }
      if (C) { c.r *= C.getX(i); c.g *= C.getY(i); c.b *= C.getZ(i); }
      e.copy(M.emissive).multiplyScalar(M.emissiveIntensity);
      if (M.emissiveMap) { paintAt(M.emissiveMap, UV, i, px); e.r *= px[0]; e.g *= px[1]; e.b *= px[2]; }
      if (o.name === 'canvas') { e.r += c.r * SAIL_GLOW; e.g += c.g * SAIL_GLOW; e.b += c.b * SAIL_GLOW; }
      col.push(c.r, c.g, c.b); glow.push(e.r, e.g, e.b);
    }
    const n = I ? I.count : P.count, at = (k) => (I ? I.getX(k) : k);
    for (let t = 0; t + 2 < n; t += 3) {
      const a = at(t), b = at(t + 1), d = at(t + 2);
      if (M.alphaTest && (alpha[a] + alpha[b] + alpha[d]) / 3 < M.alphaTest) continue;
      idx.push(base + a, base + b, base + d);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 3));
  geo.setIndex(idx); geo.computeBoundingSphere();
  return geo;
}
let farMaterial = null;
function onePieceMaterial() {
  if (farMaterial) return farMaterial;
  const M = farMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide });
  M.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec3 aGlow;\nvarying vec3 vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = 'varying vec3 vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow;');
  };
  M.customProgramCacheKey = () => 'raider-one-piece';
  return M;
}
// (Brightvein: any built ship's body in one piece, one draw, for the claim's own sky: its far-off traffic, and a
// jumper or a visitor small on the screen. Made once per body asked for: share it)
export function onePieceOf(body) {
  const m = new THREE.Mesh(onePiece(body), onePieceMaterial());
  m.name = 'ship in one piece'; m.castShadow = false; m.receiveShadow = false;
  return m;
}

// `skies()` gives the current skies' settings (progress.js); `fx` draws the gun ports' glow (fx.js). On a laptop each
// class's masts are cut out of its model as it's built, so they can fall when she's blown apart (a phone skips that)
// (Brightvein: and the claim's own ships that sail with her, a convoy's barges (`friends`: never fighting, going their
// own way, the raiders going for them as often as for the Captain), and a raid's bosses (raids.js), who can take over a
// raider's steering (`ai`), hold her fire (`holdFire`), fire faster (`fireRate`), get away (`canEscape`), or not be
// hurt for a while (flight.js `invuln`, `armor`). And more colours: the Gilded Exchange's silver, the Black Candle's
// tar and wax, the claim's own: ship/livery.js)
export function makeRaiders(scene, art, bolts, skies, fx) {
  const falling = !fx.touch;
  const arts = { crew: liveryArt(art, 'crew'), captain: liveryArt(art, 'captain'), treasure: liveryArt(art, 'treasure') }, T = {};
  const artOf = (look) => (arts[look] ??= liveryArt(art, look));
  // one middle and one far model per class (and per colours: a captain's and a treasure ship's are built when first
  // needed, as the card before her wave shows)
  function template(id, look = 'crew') {
    const key = id + (look === 'crew' ? '' : ':' + look);
    if (!T[key]) {
      const R = FLEET.find((s) => s.id === id), o = liveryOpts(look), A = artOf(look);
      const mid = wearLivery(buildShip(R, 'middle', A, o), look), far = wearLivery(buildShip(R, 'far', A, o), look);
      // (her far model's masts are cut out too, only to be left out of it as her middle model's fall)
      T[key] = { R, mid, far, look, zones: hitZones(mid), masts: falling ? { ...cutMasts(R, mid), farKeep: cutMasts(R, far).keep } : null };
      glowsOf(mid.body, scale); glowsOf(far.body, scale);
    }
    return T[key];
  }
  // the screen's scale (its pixels at a metre, for the glows: main.js keeps it as the window changes), given to every
  // class's models as they're built, so a raider's crystals, lanterns, muzzles and weak points glow at the size the
  // Captain's do from her very first frame, on any screen
  let scale = 500;
  const glowsOf = (body, px) => body.traverse((o) => { if (o.name === 'glow' || o.name === 'embers') o.material.uniforms.uScale.value = px; });
  for (const R of FLEET) template(R.id);
  const list = [], escaped = [], friends = [];
  let ai = true, foeNow = null; // (the ship they're fighting this frame, for working out each gun's aim)
  let detailAt = 0.06; // how big on screen (her length over the view's height) a raider is drawn with her middle model (Settings: picture)

  // a raider of class `id`: a captain's ship, or a treasure ship (the Galleon always is; any class can be). `opt`: her
  // captain's name and trick (`who`: tactics.js CAPTAINS), how much sturdier (`tough`: a stormy road) and how much more
  // her bounty is (`bounty`: a captain hunted down early, or with a price on her head)
  // (Brightvein's `opt` too: `look` (colours: livery.js), `friend` (one of the claim's own: a barge), `hp` (her hull,
  // sails and crystals outright, before the skies' toughness), `name`, `role`, `worth` (her bounty outright), `damage`
  // (her shot's weight, times), `speed` (her pace, times), `fort` (false: a Man-o'-war boss fights her own battle, not the
  // fortress's: raids.js), `strikes` (false: she never strikes her colours))
  function spawn(id, pos, heading, frozen = false, captain = false, treasure = ROLE[id] === 'prize', opt = null) {
    const friend = !!opt?.friend, look = opt?.look ?? (friend ? 'friend' : captain ? 'captain' : treasure ? 'treasure' : 'crew');
    const S = skies(), Tm = template(id, look), edge = (k) => (captain ? 1 + (CAPTAIN[k] - 1) * S.captain : 1), tough = friend ? 1 : S.toughness * edge('toughness') * (opt?.tough ?? 1);
    const ship = raiderShip(Tm), st = STATS[id];
    const stats = { ...st, hull: Math.round(st.hull * tough), sails: Math.round(st.sails * tough), crystals: Math.round(st.crystals * tough) };
    if (opt?.hp) for (const k in opt.hp) stats[k] = Math.round(opt.hp[k] * (friend ? 1 : S.toughness));
    const role = opt?.role ?? (friend ? 'convoy' : treasure && !captain ? 'prize' : ROLE[id]);
    const f = makeFlyer(ship, stats, { pos, heading }, { speed: (friend ? 1 : S.pace) * (role === 'prize' ? TREASURE.laden : 1) * (opt?.speed ?? 1) }); // (a treasure ship sails laden)
    f.sail = 0.85; f.speed = f.H.vmax * (friend ? 0.4 : 0.6);
    // where the Captain's guns aim at her, by the shot they're loaded with (tactics.js): round shot at her hull's middle
    // (a treasure ship's fore sails: shoot them to catch her), chain shot at the middle of her middle mast's sails, and
    // crystal breakers at the middle of what shows of her middle crystals over her rail, where a level volley lands as
    // well as one from above (aimed at their tops, most of a level volley flew over them); at her hull once that part's
    // gone
    f.aimY = Tm.zones.aim.y;
    const Z = Tm.zones, hullAim = f.aimAt, at = new THREE.Vector3(), sb = new THREE.Box3();
    const masts = Z.sails.flatMap((b, i) => (b.isEmpty() ? [] : [i])), midMast = masts[masts.length >> 1], cb = Z.crystals[Z.crystals.length >> 1];
    const fore = role === 'prize' && masts.length ? Z.sails[masts[0]].getCenter(new THREE.Vector3()) : null;
    const crown = cb ? (Z.breakAt ??= breakAt(Z, cb)) : null;
    f.aimAt = (shot = 'round') => {
      if (shot === 'chain' && midMast !== undefined && f.health.sails > 0) sailBox(Z, midMast, ship.U.uFold.value.x, sb).getCenter(at);
      else if (shot === 'breaker' && crown && f.health.crystals > 0) at.copy(crown);
      else if (fore && f.health.sails > 0) at.copy(fore);
      else return hullAim();
      return at.applyMatrix4(ship.body.matrixWorld);
    };
    ship.root.position.copy(pos); ship.root.rotation.y = heading;
    scene.add(ship.root);
    const gun = makeGunnery(ship, { reload: RAIDER.slow * S.reload * (HEAVY[id] ?? 1) * edge('reload'), damage: S.damage * edge('damage') * (opt?.damage ?? 1), kinds: { broadside: RAIDER.broadside } }, f);
    const r = { id, R: Tm.R, name: opt?.name ?? `Raider ${captain ? 'captain\'s ' + Tm.R.cls : Tm.R.cls}`, captain, ship, f, gun, zones: Tm.zones, role, frozen, friend, look,
      bounty: opt?.worth ?? (captain ? BOUNTY[id] * CAPTAIN.bounty : role === 'prize' ? TREASURE.bounty : BOUNTY[id]) * (opt?.bounty ?? 1), aim: RAIDER.aim * S.aim, looks: LOOKS[look] ?? DEBRIS[look] ?? LOOKS.crew, livery: look, weak: id === 'manowar' && opt?.fort !== false,
      // (Brightvein: a raid's boss's hooks, raids.js; a barge's way home)
      ai: null, holdFire: false, fireRate: 1, canEscape: false, escapeAt: 3600, target: null, retarget: 0, route: null, leg: 0, pace: null,
      mode: 'attack', timer: 0, side: 1, alt: (Math.random() - 0.5) * (role === 'chaser' ? 50 : 20), alt0: 0, counted: false, gone: false,
      course: heading, fleeing: false, weave: Math.random() * 6,
      // whether she can see the Captain (not hidden in cloud far from her), where she last saw her (null: never yet),
      // and whether she's hidden in cloud herself, lost to the Captain's sight (sky.js)
      sees: true, seen: null, hidden: false, lost: false, seenAt: pos.clone(),
      // a broadside being readied: which battery (null when none), seconds left of how many, and the volley's aiming
      // error. Each side's aim, set as it starts to be readied: where the foe was and how she was moving, and when
      charge: { b: null, t: 0, T: 0, off: new THREE.Vector3(), aimed: false },
      aimed: { port: { p: new THREE.Vector3(), v: new THREE.Vector3(), at: -1 }, starboard: { p: new THREE.Vector3(), v: new THREE.Vector3(), at: -1 } },
      dodge: 0, fans: null,
      // her nerve (tactics.js NERVE): whether she's had her chance to run, and her flare (null, or its rise and burst,
      // and when help comes: `left` seconds); a captain's name and trick (`who`, and its state, `tk`), her smoke screen
      // (seconds left) and her plated sides (Ironsides, the Man-o'-war); how she came in (`rising` up through the cloud
      // floor; `unseen` in the sun's glare, seconds; `arrive`: the height she holds till she's `near`); her place in a
      // line of battle (its leader, the ship ahead of her, and when she last fired her side); `toY`: a height she makes
      // for this frame, whatever the foe's; `fort`: the Man-o'-war's fortress battle
      ran: false, flare: null, flares: 0, who: captain ? opt?.who ?? null : null, tk: null, smoke: 0, puffT: 0, puffAt: null, plated: id === 'manowar' || (captain && opt?.who?.trick === 'iron'),
      rising: false, lastY: pos.y, unseen: 0, arrive: null, leader: null, ahead: null, firedAt: -1, wait: 0, hid: 0, haven: null, fort: null, gunRate: 1 };
    // her nerve: a treasure ship strikes her colours with no sails left or a quarter of her hull; a crew (not a raider
    // captain's, nor a Man-o'-war's) with her sails shot away and her hull under half, or, fighting as the last of her
    // wave afloat, under 15% of it
    if (opt?.fort === false) r.plated = false;
    if (friend || opt?.strikes === false) f.strikes = null;
    else if (role === 'prize') f.strikes = (fl) => fl.health.sails <= 0 || fl.health.hull <= fl.full.hull * 0.25;
    else if (!captain && id !== 'manowar') f.strikes = (fl) => (fl.health.sails <= 0 && fl.health.hull <= fl.full.hull * NERVE.sails) || (fl.health.hull <= fl.full.hull * NERVE.last && ai && !r.frozen && lastAfloat(r));
    if (r.who) r.tk = { phase: 'fight', t: TRICK.cloud.every, hurt: false, hid: 0, bells: 0, to: new THREE.Vector3(), done: false };
    if (id === 'manowar' && opt?.fort !== false && !friend) r.fort = makeFort(r, S);
    // where a gun at `from` aims: where the foe will be when its shot gets there (each gun of a rippling broadside
    // works it out again as its turn comes, so the last guns still lead her)
    r.lead = (from, K, out) => intercept(from, f.velocity, foeNow.aimAt(), foeNow.velocity, K.speed, out);
    // a readied broadside's guns aim where the foe would be had she held her course since it began to be readied: each
    // gun as its turn comes, leading that course (so climbing out of it makes the whole side miss)
    const held = new THREE.Vector3(), course = (A) => (from, K, out) => intercept(from, f.velocity, held.copy(A.p).addScaledVector(A.v, clock - A.at), A.v, K.speed, out);
    r.held = { port: course(r.aimed.port), starboard: course(r.aimed.starboard) };
    gun.from = r; // (each of her bolts remembers her, so a hit on the Captain can tell who fired it)
    f.gun = gun; // (her guns' state shows on her model: looks.js)
    ship.update(0, {}); ship.root.updateMatrixWorld(true);
    (friend ? friends : list).push(r);
    return r;
  }
  // (Brightvein: who a raider is after: the Captain, or on a convoy one of the barges, more often the nearer)
  function targetOf(r, foe, dt) {
    if (r.role === 'prize') return foe;
    let near = null, nd = Infinity;
    for (const x of friends) if (!x.f.down && !x.gone && !x.home) { const d = x.f.pos.distanceTo(r.f.pos); if (d < nd) { nd = d; near = x.f; } }
    if (!near) return foe;
    r.retarget -= dt;
    const cur = r.target;
    if (cur && cur !== foe && (cur.down || !friends.some((x) => x.f === cur && !x.home))) r.target = null;
    if (!r.target || r.retarget <= 0) {
      r.retarget = 8 + Math.random() * 6;
      r.target = foe.pos.distanceTo(r.f.pos) < 260 || Math.random() < 0.3 ? foe : near;
    }
    return r.target;
  }
  // (a convoy's barge: along her waypoints, `route`, at her own pace, keeping clear of the others)
  const leg = { turn: 0, climb: 0, sailTo: 0.3 };
  function sailRoute(r) {
    const me = r.f, wp = r.route?.[r.leg];
    if (!wp) { leg.turn = 0; leg.climb = 0; leg.sailTo = 0.3; return leg; }
    const dx = wp.x - me.pos.x, dz = wp.z - me.pos.z, a = Math.atan2(dx, dz);
    if (Math.hypot(dx, dz) < 120 && r.leg < r.route.length - 1) r.leg++;
    let vx = Math.sin(a), vz = Math.cos(a);
    for (const o of friends) {
      if (o === r || o.f.down) continue;
      const ox = me.pos.x - o.f.pos.x, oz = me.pos.z - o.f.pos.z, dd = Math.hypot(ox, oz), keep = (r.R.length + o.R.length) * 2 + 30;
      if (dd < keep && dd > 0.1) { const w = ((keep - dd) / keep) * 1.5; vx += (ox / dd) * w; vz += (oz / dd) * w; }
    }
    const err = wrap(Math.atan2(vx, vz) - me.heading);
    leg.turn = clamp(-err * 2.2, -1, 1); leg.climb = clamp((wp.y - me.pos.y) / 60, -1, 1); leg.sailTo = r.pace ?? 0.55;
    return leg;
  }

  // a wave of raiders coming in, its captain (if any) leading, by how it comes (waveAt's `how`, or a raider captain's
  // own way: WAY):
  //   ahead   1.5 to 1.9 km ahead of the Captain, more or less, at her height
  //   pincer  in two groups, on either side of her, 1.3 to 1.6 km off
  //   below   1.3 to 1.6 km off, under the cloud floor, holding there till she's within BELOW.rise metres (across the
  //           sky), then climbing up through it at her: far enough off that she bursts through in view, ahead and low
  //   sun     out of the sun, 900 to 1,100 m off and 600 m above her, holding 150 m over her till they're 700 m off,
  //           their tags lost in its glare for 6 s (or till they're 700 m off)
  //   stack   high and low: the small ones 140 m above her and 140 m below by turns, till they're 300 m off (a big
  //           one comes on ahead)
  //   line    the big raiders nose to tail, a line of battle (LINE), 1.5 to 1.7 km ahead; the small ones come up through
  //           the clouds below
  // A treasure ship (treasureShip: one that runs, a Galleon captain too) is closer, about 1.2 km, sailing across the
  // Captain's path. Her colours are a captain's if she leads the wave, or else a treasure ship's. Coming in high or low
  // (the sun, the stack), each holds her height ARRIVE seconds at the most. A brand-new Captain's first raider (`gentle`:
  // main.js) comes on nearly dead ahead and closer (GENTLE.d metres), in clear air (at the Captain's height or the
  // nearest clear of cloud to it: never hidden in a cloud as she comes), and holds her fire until the Captain has fired
  // (or GENTLE.hold seconds have gone by). Returns the way they come from (a bearing), and how
  const OUT = { a: 0, how: 'ahead' }, ARRIVE = 30, BELOW = { from: 1300, more: 300, rise: 1250, hold: 90 }, GENTLE = { spread: 0.2, d: 1200, hold: 25, up: [0, 60, -60, 120, -120, 200, -200, 300] };
  function spawnWave(wave, foe) {
    const gentle = !!wave.gentle, base = foe.heading + (Math.random() - 0.5) * (gentle ? GENTLE.spread : 1.4), ids = wave.ids, how = wave.how ?? 'ahead', sun = Math.atan2(SUN.x, SUN.z);
    const line = [];
    let k = 0, lead = null;
    OUT.a = how === 'sun' ? sun : base; OUT.how = how; burstYet = false;
    ids.forEach((id, i) => {
      const runs = treasureShip(wave, i), cap = i === wave.captain, who = cap ? wave.who ?? null : null;
      let way = runs ? 'cross' : cap && who ? WAY[who.trick] ?? (how === 'line' ? 'ahead' : how) : how;
      if (way === 'line' && !BIG(id)) way = 'below';
      if (way === 'stack' && ROLE[id] !== 'chaser') way = 'ahead'; // (high and low: the small ones; a big one comes on ahead)
      if (cap && i === 0 && way !== 'cross') OUT.a = way === 'sun' ? sun : base, OUT.how = way; // (the banner tells her way, a captain's wave)
      const spread = (i - (ids.length - 1) / 2) * 0.24;
      let a = base + spread, d = gentle ? GENTLE.d : 1500 + Math.random() * 400, y = clamp(foe.pos.y + (Math.random() - 0.5) * 160, 200, 2000), alt = null, near = 0;
      if (way === 'cross') { d = 1100 + Math.random() * 250; }
      else if (way === 'pincer') { a = base + (k % 2) * Math.PI + (Math.floor(k / 2) - 0.5) * 0.2; d = 1300 + Math.random() * 300; k++; }
      else if (way === 'below') { a = base + spread * 1.5; d = BELOW.from + Math.random() * BELOW.more; y = Math.max(120, CLOUD_Y - 110); }
      else if (way === 'sun') { a = sun + spread * 0.6; d = 900 + Math.random() * 200; y = Math.min(THINNING - 150, foe.pos.y + 600); alt = 150; near = 700; }
      else if (way === 'stack') { const up = k++ % 2 ? -1 : 1; y = clamp(foe.pos.y + up * 140, 150, 2200); alt = up * 140; near = 300; d = 1300 + Math.random() * 300; }
      else if (way === 'line') { a = base; d = 1500 + Math.random() * 200; }
      const pos = new THREE.Vector3(foe.pos.x + Math.sin(a) * d, y, foe.pos.z + Math.cos(a) * d);
      if (gentle && api.sky) for (const up of GENTLE.up) { pos.y = clamp(foe.pos.y + up, 200, 2000); if (api.sky.cloudAt(pos) < 0.05) break; }
      let heading = runs ? a + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 : a + Math.PI;
      // (a line: the first big ship leads, the rest behind her along her heading, each her length and the next's apart)
      if (way === 'line' && lead) {
        const prev = line[line.length - 1], gap = LINE.gap * (prev.R.length + FLEET.find((s) => s.id === id).length) / 2;
        pos.copy(prev.f.pos).addScaledVector(prev.f.forward(), -gap); heading = lead.f.heading;
      }
      const r = spawn(id, pos, heading, false, cap, runs && !cap, { who, tough: wave.tough ?? 1, bounty: cap ? wave.bounty ?? 1 : 1 });
      r.seen = foe.pos.clone(); // (they know where she was as they came)
      if (gentle) r.hold = GENTLE.hold;
      if (alt !== null) { r.alt = alt; r.arrive = { near, t: ARRIVE, alt: (Math.random() - 0.5) * (r.role === 'chaser' ? 50 : 20) }; }
      if (way === 'below') { r.alt = 30; r.rising = true; }
      if (way === 'sun') r.unseen = 6;
      if (way === 'line') { if (!lead) lead = r; line.push(r); }
    });
    if (line.length > 1) formLine(line); else if (line.length === 1) line[0].line = null;
    return OUT;
  }
  // a line of battle: its ships nose to tail, each keeping station on the one ahead (her `ahead`), the first leading
  function formLine(ships) {
    const L = { ships, leader: ships[0], broken: false };
    ships.forEach((r, i) => { r.line = L; r.leader = i ? ships[0] : null; r.ahead = i ? ships[i - 1] : null; r.slot = i; });
  }
  // the line broken up (told, and why: `down`, its leader sunk or struck her colours; `run`, she ran for the clouds;
  // `sinking`, the Man-o'-war leading it in her last act), and every ship of it fights on her own
  const LINE_NEWS = payload('line');
  function breakLine(L, why = 'down') {
    if (L.broken) return;
    L.broken = true; L.why = why;
    for (const r of L.ships) { r.leader = r.ahead = null; }
    LINE_NEWS.raider = L.leader; LINE_NEWS.stage = 'broken'; LINE_NEWS.why = why; emit('line'); LINE_NEWS.raider = null;
  }
  // (a ship out of her line: going down, gone, running for the clouds, or a Man-o'-war sinking in her last act: the
  // ships behind her keep station on the one ahead of her instead, never following her away)
  const outOfLine = (A) => !!A.f.down || A.gone || A.mode === 'run' || A.fort?.act === 3;
  // the ship she keeps station on in her line (the next still in it ahead of her), or none
  function lineAhead(r) {
    if (!r.leader) return null;
    let A = r.ahead;
    while (A && outOfLine(A) && A.ahead) A = A.ahead;
    return A && !outOfLine(A) ? A : null;
  }
  // a ship leaving her line (running, or her last act): its leader breaks it up; any other, the ship behind her closes
  // up on the one ahead of her
  function leaveLine(r, why) {
    const L = r.line;
    if (!L || L.broken) return;
    if (L.leader === r) { breakLine(L, why); return; }
    for (const o of L.ships) if (o.ahead === r) o.ahead = r.ahead;
  }
  // whether she's the only one of her wave still fighting
  const lastAfloat = (r) => { for (const o of list) if (o !== r && !o.f.down && !o.gone) return false; return true; };

  // where to steer: chasers come at the foe bow-first and break away when close; broadside ships keep it abeam; a ship in
  // a line keeps her station; one running makes for the clouds; a raider captain plays her trick.
  // (The answer is one kept object, read straight away by flight.js)
  const ahead = new THREE.Vector3(), wish = { turn: 0, climb: 0, sailTo: 1 }, look = new THREE.Vector3(), still = new THREE.Vector3(), fw = new THREE.Vector3(), slot = new THREE.Vector3();
  let smart = 0; // (how smart they fight on these skies: set each frame)
  function steer(r, foe, dt) {
    // (the Captain lost in cloud: she comes looking where she last saw her, circling 200 m round it, a little above; one
    // that never saw her sails on as she was)
    let P = foe.pos, V = foe.velocity;
    if (!r.sees) {
      r.weave += dt * 0.25; V = still;
      if (r.seen) P = look.set(r.seen.x + Math.sin(r.weave) * 200, r.seen.y + 60, r.seen.z + Math.cos(r.weave) * 200);
      else P = look.set(r.f.pos.x + Math.sin(r.f.heading) * 1000, r.f.pos.y, r.f.pos.z + Math.cos(r.f.heading) * 1000); // (never saw her: sails on)
    }
    const me = r.f, L = r.R.length, dx = P.x - me.pos.x, dz = P.z - me.pos.z, d = Math.hypot(dx, dz, P.y - me.pos.y);
    const bearing = Math.atan2(dx, dz), rel = wrap(bearing - me.heading);
    r.timer -= dt;
    // (coming in high or low, out of the sun or stacked: she holds that height till she's near)
    // (and by ARRIVE seconds at the most, near or not: a broadside raider keeping her distance mustn't hang over her)
    if (r.arrive && (d < r.arrive.near || (r.arrive.t -= dt) <= 0)) { r.alt = r.arrive.alt; r.arrive = null; }
    let want, sailTo = 1, toY = null;
    const A = lineAhead(r), T = r.tk && r.sees ? trick(r, foe, d, dt) : null;
    if (r.mode === 'run') {
      // running for the clouds: to the thick cloud she saw (diving into it, and weaving there), or straight away from
      // the foe, weaving, under every sail she has
      r.weave += dt * 0.3;
      const hx = r.haven ? r.haven.x - me.pos.x : 0, hz = r.haven ? r.haven.z - me.pos.z : 0;
      want = r.haven && Math.hypot(hx, hz) > 150 ? Math.atan2(hx, hz) : bearing + Math.PI + Math.sin(r.weave) * 0.45;
      if (r.haven) toY = CLOUD_Y - 15;
    } else if (r.role === 'prize') {
      // a treasure ship sails her course until she's chased or hit, then runs, weaving, under every sail she has
      if (!r.fleeing && (d < 1000 || me.frac('hull') < 1 || me.frac('sails') < 1)) r.fleeing = true;
      r.weave += dt * 0.3;
      want = r.fleeing ? bearing + Math.PI + Math.sin(r.weave) * 0.45 : r.course;
      sailTo = r.fleeing ? 1 : 0.7;
    } else if (T) {
      // (a raider captain's trick taking her: under the foe, round to her other side in smoke, or into the cloud floor)
      want = T.want ?? bearing - r.side * Math.PI / 2; toY = T.toY ?? null; sailTo = T.sail ?? 1;
    } else if (A) {
      // keeping station in a line of battle: making for her slot behind the ship ahead (her length and a bit, the two
      // ships' lengths LINE.gap times between them), where that ship will be in a moment, a little ahead of it so she
      // eases in along the line; quicker the further behind it she is; at that ship's height
      const gap = LINE.gap * (A.R.length + L) / 2;
      fw.set(Math.sin(A.f.heading), 0, Math.cos(A.f.heading));
      slot.copy(A.f.pos).addScaledVector(fw, -gap);
      const along = (slot.x - me.pos.x) * fw.x + (slot.z - me.pos.z) * fw.z;
      ahead.copy(slot).addScaledVector(A.f.velocity, LINE.ahead).addScaledVector(fw, gap * 0.5);
      want = Math.atan2(ahead.x - me.pos.x, ahead.z - me.pos.z);
      sailTo = clamp(0.75 + along / 150, 0.3, 1); toY = A.f.pos.y;
    } else if (r.mode === 'break') {
      want = r.breakH;
      if (r.timer <= 0) r.mode = 'attack';
    } else if (r.role === 'chaser' || d > 1500) {
      // an attack run: come at the foe, then peel away, side-on, when close or after 10-15 seconds of chasing (smartest,
      // a small raider comes at her stern quarter, where her guns are few)
      ahead.copy(P).addScaledVector(V, Math.min(3, d / 250));
      if (smart >= 2 && r.role === 'chaser' && r.sees) ahead.addScaledVector(fw.set(Math.sin(foe.heading), 0, Math.cos(foe.heading)), -SMART.stern);
      want = Math.atan2(ahead.x - me.pos.x, ahead.z - me.pos.z);
      sailTo = d < 300 ? 0.6 : 1;
      if (d < 900) r.run = (r.run ?? 0) + dt;
      if (r.role === 'chaser' && (d < 70 + L * 4 || r.run > (r.runFor ??= 10 + Math.random() * 5))) {
        r.run = 0; r.runFor = 10 + Math.random() * 5;
        r.mode = 'break'; r.timer = 3 + Math.random() * 2.5;
        r.breakH = bearing + (Math.random() < 0.5 ? 1 : -1) * (1.8 + Math.random() * 0.7); r.alt = (Math.random() - 0.5) * 70;
      }
    } else if (smart >= 1 && r.sees && d < SMART.near && Math.abs(wrap(Math.atan2(-dx, -dz) - foe.heading)) < SMART.facing
      && Math.hypot(P.x + Math.sin(foe.heading) * SMART.ahead - me.pos.x, P.z + Math.cos(foe.heading) * SMART.ahead - me.pos.z) > SMART.ahead * 0.6) {
      // (smarter: the foe pointing her bow at a big raider, she makes for a spot ahead of the foe's bow, to cross it;
      // once there she turns her side to bear as ever, down the foe's length, raking her)
      ahead.set(P.x + Math.sin(foe.heading) * SMART.ahead, P.y, P.z + Math.cos(foe.heading) * SMART.ahead);
      want = Math.atan2(ahead.x - me.pos.x, ahead.z - me.pos.z);
      sailTo = 1;
    } else {
      // (a line's leader keeps further off, so the line behind her has room to bring their sides to bear)
      if (Math.abs(rel) > 0.35 && Math.abs(rel) < Math.PI - 0.35) r.side = Math.sign(rel);
      const ideal = 260 + L * 4 + (r.line && !r.leader && !r.line.broken ? LINE.wide : 0), k = clamp((d - ideal) / 300, -1, 1);
      want = bearing - r.side * (Math.PI / 2 - k * 0.9);
      sailTo = 0.75;
    }
    // (smartest: one the foe's guns are locked on to, with a loaded broadside pointed at her, may climb or dive out of it;
    // a broadside only, not her bow or stern guns, nor a Skiff's light swivels on her side: a few light guns she shrugs
    // off)
    // (her height over the foe kept, to come back to after the dodge; the foe's guns' reach and aim for the shot they're
    // loaded with)
    if (smart >= 2 && r.sees && foe.locked === r && r.dodge <= 0 && toY === null && Math.random() < SMART.dodge * dt) {
      const g = foe.gun, b = g && batteryFor(wrap(Math.atan2(-dx, -dz) - foe.heading));
      if ((b === 'port' || b === 'starboard') && g.ready[b] === 0 && broadsideIn(g.B[b]) && g.reaches(b, me.aimAt(g.shot))) { r.dodge = SMART.hold; r.alt0 = r.alt; r.alt += (r.alt > 0 ? -1 : 1) * SMART.alt; }
    }
    if (r.dodge > 0 && (r.dodge -= dt) <= 0) r.alt = r.alt0;
    // (coming up through the clouds: under the cloud floor till she's within BELOW.rise of the foe across the sky, then
    // up through it, so she bursts through ahead of her, in view)
    if (r.rising && toY === null && me.pos.y < CLOUD_Y && Math.hypot(dx, dz) > BELOW.rise) toY = CLOUD_Y - BELOW.hold;
    // (the Man-o'-war in her last act: sinking, whatever she'd like)
    if (r.fort?.act === 3) toY = me.pos.y - 100;
    // keep clear of the other raiders (but not of her own line's ships, nose to tail)
    let vx = Math.sin(want), vz = Math.cos(want);
    for (const o of list) {
      if (o === r || o.f.down || (r.line && o.line === r.line && !r.line.broken)) continue;
      const ox = me.pos.x - o.f.pos.x, oz = me.pos.z - o.f.pos.z, dd = Math.hypot(ox, oz), keep = (L + o.R.length) * 3 + 40;
      if (dd < keep && dd > 0.1) { const w = ((keep - dd) / keep) * 1.5; vx += (ox / dd) * w; vz += (oz / dd) * w; }
    }
    // (a line's leader keeps a little sail in hand, so the ships behind her can keep up)
    if (r.line && !r.leader && !r.line.broken) sailTo = Math.min(sailTo, LINE.sail);
    const err = wrap(Math.atan2(vx, vz) - me.heading), wantY = clamp(toY ?? P.y + r.alt, 150, 2200);
    // (a line's leader turns at less than her full rate, so the line behind her can follow)
    wish.turn = clamp(-err * 2.2, -1, 1) * (r.line && !r.leader && !r.line.broken ? LINE.turn : 1); wish.climb = clamp((wantY - me.pos.y) / 60, -1, 1); wish.sailTo = sailTo;
    return wish;
  }
  // a raider captain's trick (tactics.js CAPTAINS, TRICK), as she steers: what it takes of her steering this frame (a
  // kept object: where she heads, the height she makes for, her sail), or none. Told as each begins (`trick`)
  const TK = { want: null, toY: null, sail: null }, TRICKED = payload('trick'), SUN_AT = Math.atan2(SUN.x, SUN.z);
  function tell(r, trickName) { TRICKED.raider = r; TRICKED.trick = trickName; emit('trick'); TRICKED.raider = null; }
  function trick(r, foe, d, dt) {
    const tk = r.tk, me = r.f, how = r.who.trick, C = TRICK.cloud;
    TK.want = TK.toY = TK.sail = null;
    if (how === 'cloud') {
      // the Cloud Fox: into the cloud floor (hurt at last, or every so often), hidden there a few seconds, then up under
      // the foe, till she's near: then she fights again
      if (tk.phase === 'fight' && d < 1500 && ((tk.t -= dt) <= 0 || (!tk.hurt && me.frac('hull') < C.hurt))) { tk.hurt ||= me.frac('hull') < C.hurt; tk.phase = 'dive'; tk.hid = 0; tell(r, 'cloud'); }
      if (tk.phase === 'dive') {
        // (circling the foe as she dives, a little nearer each turn, so she comes up close)
        const a = Math.atan2(foe.pos.x - me.pos.x, foe.pos.z - me.pos.z), d2 = Math.hypot(foe.pos.x - me.pos.x, foe.pos.z - me.pos.z);
        TK.toY = CLOUD_Y - 15; TK.want = a - r.side * (Math.PI / 2 - clamp((d2 - 450) / 600, -0.6, 0.6));
        if (me.pos.y < CLOUD_Y && (tk.hid += dt) > C.hide) tk.phase = 'rise';
        return TK;
      }
      if (tk.phase === 'rise') {
        TK.want = Math.atan2(foe.pos.x - me.pos.x, foe.pos.z - me.pos.z); TK.toY = foe.pos.y - C.under;
        if (Math.hypot(foe.pos.x - me.pos.x, foe.pos.z - me.pos.z) < C.near) { tk.phase = 'fight'; tk.t = C.every; r.alt = -C.under * 0.5; }
        return TK;
      }
    } else if (how === 'sun') {
      // the Sun-Diver: after each broadside she climbs away towards the sun (shoot sets tk.t), out of the fight a few
      // seconds, then turns and dives on the foe out of its glare
      if (tk.phase === 'climb') {
        if ((tk.t -= dt) <= 0) { tk.phase = 'fight'; r.alt = 0; }
        else { TK.want = SUN_AT; TK.toY = foe.pos.y + TRICK.sun.climb; return TK; }
      }
    } else if (how === 'help') {
      // the Bell: a flare at each share of her hull (two Skiffs answer each; one on Fair Winds)
      const at = TRICK.help.at[tk.bells];
      if (at !== undefined && me.frac('hull') < at) { tk.bells++; fireFlare(r, skies().captain ? TRICK.help.count : 1); }
    } else if (how === 'smoke') {
      // the Ghost: at half her hull, a smoke screen; hidden in it (laying more as she goes: trail), she surges round the
      // foe to her other side, beam to beam: circling her, round her bow or her stern (whichever she's nearer), `far`
      // metres off (or as near as she is, but never within 300 m, where she'd be seen), to the place across the foe's
      // keel from where she vanished
      const S = TRICK.smoke;
      if (!tk.done && me.frac('hull') < S.at) {
        tk.done = true; r.smoke = S.hide; r.puffT = 0; me.startSurge(); smokeScreen(r);
        const a = wrap(Math.atan2(me.pos.x - foe.pos.x, me.pos.z - foe.pos.z) - foe.heading);
        tk.a0 = a; tk.dir = (Math.abs(a) < Math.PI / 2 ? -1 : 1) * (a >= 0 ? 1 : -1); // (round her bow: towards 0; round her stern: towards pi)
        tk.rad = clamp(Math.hypot(me.pos.x - foe.pos.x, me.pos.z - foe.pos.z), 300, S.far);
        tell(r, 'smoke');
      }
      if (r.smoke > 0) {
        // (where she is round the foe now; once she's across the foe's keel and as far round as she began, she makes for
        // that place; till then for a point a little further round the circle)
        const a = wrap(Math.atan2(me.pos.x - foe.pos.x, me.pos.z - foe.pos.z) - foe.heading), there = Math.sign(a) === -Math.sign(tk.a0) && (tk.dir * Math.sign(tk.a0) < 0 ? Math.abs(a) >= Math.abs(tk.a0) : Math.abs(a) <= Math.abs(tk.a0));
        const to = foe.heading + (there ? -tk.a0 : a + tk.dir * S.lead);
        tk.to.set(foe.pos.x + Math.sin(to) * tk.rad, me.pos.y, foe.pos.z + Math.cos(to) * tk.rad);
        TK.want = Math.atan2(tk.to.x - me.pos.x, tk.to.z - me.pos.z); return TK;
      }
    }
    return null;
  }
  // the Ghost's smoke screen: big pale puffs all round her (fewer on a phone), hanging a while
  const sp = new THREE.Vector3(), sv = new THREE.Vector3(), tp = new THREE.Vector3(), tv = new THREE.Vector3();
  function smokeScreen(r) {
    const n = TRICK.smoke.puffs[fx.touch ? 1 : 0], L = r.R.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      sp.copy(r.f.pos).add(sv.set(Math.sin(a) * L * 0.9, (Math.random() - 0.3) * L * 0.4, Math.cos(a) * L * 0.9));
      sv.set(Math.sin(a) * 4, 1, Math.cos(a) * 4);
      fx.smoke.emit(sp, sv, 9 + Math.random() * 2, L * 1.2, L * 2.6 + 40, 0.85, 0.9, 0, 0.4);
    }
  }
  // (and while she's hidden, more as she goes, so she's never out of it: every `trail` seconds a thick puff or two that
  // hangs (fewer on a phone), one by her and one on the foe's side of her, where she's seen from; her tag, lost in the
  // smoke, follows the smoke she's in: main.js puts it where she was last seen)
  function trail(r, foe, dt) {
    if ((r.puffT -= dt) > 0) return;
    const S = TRICK.smoke, touch = fx.touch, L = r.R.length;
    r.puffT = S.trail[touch ? 1 : 0];
    tv.copy(foe.pos).sub(r.f.pos).setY(0).normalize();
    for (let k = touch ? 1 : 0; k < 2; k++) {
      tp.copy(r.f.pos).addScaledVector(tv, L * (k ? (touch ? 0.45 : 0.7) : 0.15)).add(sp.set((Math.random() - 0.5) * L * 0.5, (Math.random() - 0.3) * L * 0.3, (Math.random() - 0.5) * L * 0.5));
      sv.copy(r.f.velocity).multiplyScalar(0.3); sv.y += 1;
      fx.smoke.emit(tp, sv, 6 + Math.random(), L * 1.3, L * 2.4 + 30, 0.85, 0.92, PUFF.bank, 0.4);
    }
    (r.seenAt ??= new THREE.Vector3()).copy(r.f.pos); r.puffAt = (r.puffAt ?? new THREE.Vector3()).copy(tp);
  }

  // fire every battery that can reach where the foe will be, a little off. A broadside of three guns or more is readied
  // first, her ports glowing and her fan showing, aimed where the foe is heading as it begins (told: `warn`), and fires
  // there when the glow is full, wherever the foe is by then. One running fires only her stern guns; the Ghost holds
  // her fire in her smoke; one in a line of battle readies her side only after the ship ahead of her has fired hers
  // (or after a while, if that ship can't bring hers to bear), so the volleys ripple down the line; the Sail-Ripper's
  // every other broadside is chain shot, aimed at the foe's sails, and the Sun-Diver flies off towards the sun after each
  const off = new THREE.Vector3(), aim = new THREE.Vector3(), SIDES = ['bow', 'port', 'starboard', 'stern'], drift = { turn: 0, climb: 0, sailTo: 0.6 }, CALM = { calm: true };
  const WARNED = payload('warn');
  let clock = 0; // (the raiders' own clock, for their readied broadsides' aim)
  const canReach = (r, b, foe) => {
    const m = r.gun.muzzle(b);
    if (!m) return -1;
    intercept(m.p, r.f.velocity, foe.aimAt(), foe.velocity, m.K.speed, aim);
    const dist = aim.distanceTo(m.p);
    return dist <= m.K.speed * m.K.life * 0.7 && r.gun.reaches(b, aim, m) ? dist : -1; // they hold fire till it's worth it
  };
  // (her turn in a line: the ship ahead of her has fired since she last did, or she's waited LINE.hold seconds with her
  // side ready to bear)
  const lineTurn = (r) => { const A = lineAhead(r); return !A || A.firedAt > r.firedAt || r.wait > LINE.hold; };
  function shoot(r, foe, dt) {
    const ch = r.charge;
    // (a brand-new Captain's first raider holds her fire until the Captain has fired, or for GENTLE.hold seconds)
    if (r.hold > 0) { if (foe.firedOnce) r.hold = 0; else { r.hold -= dt; ch.b = null; ch.aimed = false; return; } }
    if (!r.sees || r.smoke > 0) { ch.b = null; ch.aimed = false; return; } // (she can't see the Captain, or she's in her smoke: she holds her fire, and stands down a broadside)
    if (ch.b && (ch.t -= dt) <= 0) {
      const A = r.aimed[ch.b];
      if (A && !ch.aimed) { A.p.copy(foe.aimAt()); A.v.copy(foe.velocity); A.at = clock; } // (one readied some other way, a test's: aimed now)
      if (ch.shot === 'chain') r.gun.shot = 'chain';
      r.gun.fire(ch.b, A ? r.held[ch.b] : r.lead, bolts, 'raider', r.f.velocity, ch.off);
      r.gun.shot = 'round'; r.firedAt = clock;
      if (r.who?.trick === 'sun') { r.tk.phase = 'climb'; r.tk.t = TRICK.sun.hold; r.alt = TRICK.sun.climb; tell(r, 'sun'); }
      ch.b = null; ch.aimed = false; ch.shot = 'round'; // (its guns still to go off keep leading that course)
    }
    const turn = lineTurn(r);
    let waiting = false;
    for (const b of SIDES) {
      if (b === ch.b || r.gun.ready[b] > 0 || !r.gun.count(b) || (r.mode === 'run' && b !== 'stern')) continue;
      const dist = canReach(r, b, foe);
      if (dist < 0) continue;
      const e = (dist * r.aim + 1.5) * (1 + 1.6 * foe.cloud); // (wider with the Captain inside a cloud)
      off.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * e);
      if (r.gun.B[b][0].kind === 'broadside' && r.gun.count(b) >= 3) {
        if (!ch.b && !turn) waiting = true;
        else if (!ch.b) {
          ch.b = b; ch.t = ch.T = (skies().warn ?? 0.8) + (r.R.length >= 50 ? WARN.big : 0); ch.off.copy(off); r.wait = 0;
          const A = r.aimed[b]; A.p.copy(foe.aimAt()); A.v.copy(foe.velocity); A.at = clock; ch.aimed = true;
          // (the Sail-Ripper: every other side is chain shot, laid on the foe's sails)
          ch.shot = r.who?.trick === 'chain' && (r.tk.chain = !r.tk.chain) ? 'chain' : 'round';
          if (ch.shot === 'chain') A.p.y += foe.sailUp ?? foe.ship.recipe.length * 0.3;
          WARNED.raider = r; WARNED.battery = b; WARNED.time = ch.T; emit('warn'); WARNED.raider = null;
        }
        continue;
      }
      r.gun.fire(b, r.lead, bolts, 'raider', r.f.velocity, off);
    }
    r.wait = waiting ? r.wait + dt : 0;
  }
  // her red danger fan, while she readies a broadside: one shape for every raider (guns.js fanGeometry), and each raider's
  // two (port and starboard) made the first time she readies that side, children of her ship's body at her middle gun on
  // that side, pointing its way, so they lean and roll with her. Each has its own copy of the one material (its strength
  // is its own: the copies share one shader), drawn after the ships, tinting red what's behind it without hiding it
  const fanGeo = fanGeometry(KINDS.broadside, FAN.reach), BY = KINDS.broadside.yaw, FWD = new THREE.Vector3(0, 0, 1), fanTime = { value: 0 }, fanPx = { value: 1 };
  const FAN_TALL = Math.tan(FORT.tilt) / Math.tan(KINDS.broadside.pitch); // (how much taller a fan is in the Man-o'-war's last act)
  const fanMat = new THREE.ShaderMaterial({ vertexShader: FAN_VERT, fragmentShader: FAN_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(FAN.color).convertLinearToSRGB() }, uK: { value: 0 }, uTime: fanTime, uReach: { value: FAN.reach },
      uCut: { value: new THREE.Vector4(Math.cos(0.62 * BY), Math.sin(0.62 * BY), Math.cos(0.6 * BY), Math.sin(0.6 * BY)) }, uTilt: { value: Math.sin(0.55 * KINDS.broadside.pitch) },
      uHit: { value: -1 }, uOwn: { value: 16 }, uPx: fanPx } });
  fanMat.name = 'danger fan';
  // (its shader made ready before any warning, never drawn: main.js has three.js make it as each voyage starts, for a
  // fan of its own (fanToWarm) with a fresh copy of the material, lit as the sky at sea is then. three.js makes a new
  // copy's shader for the lights in the sky (the lamps of the ship she sails among them), and each raider's fans are
  // new copies, so they find it made. Made the first time a raider readies a broadside, it would stutter a phone just as
  // the Captain must see the warning)
  const warmFan = new THREE.Mesh(fanGeo, fanMat);
  warmFan.name = 'danger fan, made ready';
  function fanToWarm() {
    if (warmFan.material !== fanMat) warmFan.material.dispose();
    warmFan.material = fanMat.clone();
    return warmFan;
  }
  function fanFor(r, b) {
    r.fans ??= {};
    let m = r.fans[b];
    if (!m) {
      const g = r.gun.B[b][r.gun.B[b].length >> 1];
      m = r.fans[b] = new THREE.Mesh(fanGeo, fanMat.clone()); m.name = 'danger fan'; m.renderOrder = 4; m.visible = false;
      m.material.uniforms.uTime = fanTime; m.material.uniforms.uPx = fanPx; // (one clock for every fan, and one size of pixel)
      m.material.uniforms.uOwn.value = FAN.reach / (1.25 * r.R.length);
      m.position.copy(g.p); m.quaternion.setFromUnitVectors(FWD, g.d);
      if (r.fort?.act === 3) m.scale.y = FAN_TALL; // (the Man-o'-war's last act: her upper deck reaching above her)
      r.ship.body.add(m);
    }
    return m;
  }
  // (shown for the side being readied, growing as her ports brighten; the other hidden. With the Captain inside it, its
  // bright ring marks where it reaches her ship: how far out she is, in its own frame, and whether that's inside its
  // swing, tilt and reach, with a little to spare for her size)
  const fanAt = new THREE.Vector3();
  function showFans(r) {
    const ch = r.charge;
    if (ch.b === 'port' || ch.b === 'starboard') {
      const m = fanFor(r, ch.b), k = ch.T > 0 ? 1 - Math.max(0, ch.t) / ch.T : 1, U = m.material.uniforms;
      m.visible = true; U.uK.value = FAN.opacity * (0.35 + 0.65 * k);
      let hit = -1;
      if (foeNow && !foeNow.down) {
        m.updateWorldMatrix(true, false); m.worldToLocal(fanAt.copy(foeNow.pos));
        const d = fanAt.length(), L = foeNow.ship.recipe.length, spare = Math.atan(L * 0.4 / Math.max(d, 1));
        if (d < FAN.reach && fanAt.z > 0 && Math.abs(Math.atan2(fanAt.x, fanAt.z)) < KINDS.broadside.yaw + spare && Math.abs(Math.asin(fanAt.y / Math.max(d, 1e-3))) < KINDS.broadside.pitch + spare) hit = d / FAN.reach;
      }
      U.uHit.value = hit;
    }
    if (r.fans) for (const b in r.fans) if (b !== ch.b) r.fans[b].visible = false;
  }
  // her gun ports glowing as a broadside is readied: red and small at first, swelling to hot gold as it's about to fire
  // (none where her guns are knocked out)
  const port = new THREE.Vector3();
  function glowPorts(r) {
    const ch = r.charge, k = 1 - Math.max(0, ch.t) / ch.T, M = r.ship.body.matrixWorld, size = 2 + 6 * k;
    const cr = WARN_FROM.r + (WARN_TO.r - WARN_FROM.r) * k, cg = WARN_FROM.g + (WARN_TO.g - WARN_FROM.g) * k, cb = WARN_FROM.b + (WARN_TO.b - WARN_FROM.b) * k;
    const guns = r.gun.B[ch.b];
    for (let i = 0; i < guns.length; i++) if (!guns[i].dead) fx.glowAt(port.copy(guns[i].p).applyMatrix4(M), cr, cg, cb, size);
  }

  // ---------- nerve: running, and flares ----------
  // a hurt raider running for the clouds (told): surging away, for the nearest thick cloud floor within reach (away from
  // the foe more than towards her), if there is any (`sky`: sky.js, set by main.js; looked for once, round her in twelve
  // ways and three distances)
  const RUN = payload('raider:run'), probe = new THREE.Vector3();
  function startRun(r, foe) {
    r.mode = 'run'; r.f.startSurge(); r.charge.b = null;
    leaveLine(r, 'run'); // (a line's leader running breaks it up; any other leaves a gap the ship behind her closes)
    let best = Infinity;
    if (api.sky) for (let k = 0; k < 12; k++) for (const d of [NERVE.haven / 3, NERVE.haven * 2 / 3, NERVE.haven]) {
      const a = (k / 12) * Math.PI * 2;
      probe.set(r.f.pos.x + Math.sin(a) * d, CLOUD_Y - 10, r.f.pos.z + Math.cos(a) * d);
      const away = (Math.sin(a) * (r.f.pos.x - foe.pos.x) + Math.cos(a) * (r.f.pos.z - foe.pos.z)) / Math.max(1, Math.hypot(r.f.pos.x - foe.pos.x, r.f.pos.z - foe.pos.z));
      if (away > -0.3 && d < best && api.sky.floorAt(probe) > 0.75) { best = d; (r.haven ??= new THREE.Vector3()).copy(probe); }
    }
    RUN.raider = r; emit('raider:run'); RUN.raider = null;
  }
  // a red flare from her mast head (told), rising, then bursting: help (n of them: a Skiff, a Cutter on the Maelstrom)
  // comes NERVE.wait seconds on, unless she's down first (told either way)
  const FLARE = payload('flare'), later = [];
  function fireFlare(r, n = 1) {
    const top = Math.max(...r.R.masts.map((m) => r.ship.hull.deckY(m.z) + m.height));
    if (r.flare && r.flare.left > 0) n += r.flare.n; // (a flare still waiting for its help: the new one brings both)
    r.flare = { left: NERVE.wait, n, age: 0, top, p: new THREE.Vector3(0, top, 0).applyMatrix4(r.ship.body.matrixWorld), burst: false, fade: 0 };
    r.flares++;
    flareNews(r, 'fired');
  }
  function flareNews(r, stage) { FLARE.raider = r; FLARE.at.copy(r.flare?.p ?? r.f.pos); FLARE.stage = stage; emit('flare'); FLARE.raider = null; }
  // Its light: a red star climbing from her mast head with a short trail of red sparks, bursting a little way over her
  // (NERVE `rise` metres a second for `burst` seconds: low enough to burst in view in the chase view, a few hundred
  // metres off or more), then a red star hanging `hang` metres over her mast head, flickering, while her help is coming,
  // and fading once it's come (or she's down). The stars are drawn as solid red (STARS: blended over the sky, not added
  // to it, which over blue sky reads pink), `star` metres across, in one batch for every flare
  const STAR_MAX = 48, starPos = new Float32Array(STAR_MAX * 3), starSize = new Float32Array(STAR_MAX), starA = new Float32Array(STAR_MAX), starHot = new Float32Array(STAR_MAX);
  const starGeo = new THREE.BufferGeometry(), dynamic = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
  starGeo.setAttribute('position', dynamic(starPos, 3)); starGeo.setAttribute('size', dynamic(starSize, 1)); starGeo.setAttribute('alpha', dynamic(starA, 1)); starGeo.setAttribute('hot', dynamic(starHot, 1));
  starGeo.setDrawRange(0, 0);
  const starScale = { value: scale };
  const starMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uScale: starScale, uMax: { value: fx.touch ? 160 : 240 } },
    vertexShader: 'attribute float size; attribute float alpha; attribute float hot; uniform float uScale; uniform float uMax; varying float vA; varying float vH; void main() { vA = alpha; vH = hot; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(3.0, min(size * uScale / -mv.z, uMax)); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; varying float vH; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float a = (1.0 - smoothstep(0.45, 1.0, r)) * vA; if (a < 0.01) discard; vec3 c = mix(vec3(0.86, 0.05, 0.03), vec3(1.0, 0.78, 0.55), (1.0 - smoothstep(0.0, 0.5, r)) * vH); gl_FragColor = vec4(c, a);\n#include <colorspace_fragment>\n}' });
  starMat.name = 'flare stars';
  const stars = new THREE.Points(starGeo, starMat); stars.name = 'flare stars'; stars.frustumCulled = false; stars.renderOrder = 4; scene.add(stars);
  let starN = 0;
  const star = (p, size, a, hot) => { if (starN >= STAR_MAX) return; starPos[starN * 3] = p.x; starPos[starN * 3 + 1] = p.y; starPos[starN * 3 + 2] = p.z; starSize[starN] = size; starA[starN] = a; starHot[starN++] = hot; };
  const hangAt = new THREE.Vector3(), trailAt = new THREE.Vector3();
  function flareLight(r, dt) {
    const F = r.flare, S = NERVE.star;
    F.age += dt;
    if (F.age < NERVE.burst) {
      // (climbing, a short trail of fading stars and sparks under it)
      F.p.y += NERVE.rise * dt;
      star(F.p, S * 0.75, 1, 1);
      for (let k = 1; k <= 4; k++) star(trailAt.copy(F.p).setY(F.p.y - k * S * 0.35), S * (0.5 - k * 0.08), 0.75 - k * 0.15, 0.3);
      if (fx.room()) fx.spark(F.p, sv.set((Math.random() - 0.5) * 3, -8, (Math.random() - 0.5) * 3), 0.7, 4, 0xff3a1a, 1, 0);
      return;
    }
    if (!F.burst) { F.burst = true; fx.burst(F.p, 0xff2a1a, 70, 3, 1); }
    // (hanging over her while her help is coming, easing there from where it burst; fading once that's over)
    if (F.left <= 0 || r.f.down) F.fade += dt;
    if (F.fade > 2) return;
    if (!r.f.down) { hangAt.set(0, F.top + NERVE.hang, 0).applyMatrix4(r.ship.body.matrixWorld); F.p.addScaledVector(r.f.velocity, dt).lerp(hangAt, 1 - Math.exp(-dt * 1.2)); } // (carried along with her)
    const b = F.age - NERVE.burst, swell = b < 0.5 ? 1 + 1.6 * Math.sin((b / 0.5) * Math.PI) : 1, flicker = 0.88 + 0.12 * Math.sin(F.age * 23);
    star(F.p, S * swell * flicker, (1 - F.fade / 2) * (b < 0.5 ? 1 : 0.9), b < 0.5 ? 1 : 0.55);
  }
  // help answering her flare: `n` ships, 1.4 km beyond her from the foe, heading in (joining the wave)
  function answer(r, foe) {
    const F = r.flare, away = sv.copy(r.f.pos).sub(foe.pos).setY(0).normalize(), id = skies().extra ? 'cutter' : 'skiff';
    for (let i = 0; i < F.n; i++) {
      const pos = r.f.pos.clone().addScaledVector(away, NERVE.help).add(sp.set(-away.z, 0, away.x).multiplyScalar((i - (F.n - 1) / 2) * 120));
      pos.y = clamp(pos.y, 200, 2000);
      later.push({ id, pos, heading: Math.atan2(foe.pos.x - pos.x, foe.pos.z - pos.z) });
    }
    flareNews(r, 'answered');
  }

  // ---------- the Man-o'-war's fortress battle (tactics.js FORT) ----------
  // her eight blocks of six guns (each side's upper and lower deck, fore and aft): their guns, a box round their ports
  // (her own frame) that a hit lands in, how much each can take, and where it smokes from once silenced. `act`: 1 to 3
  const FORTP = payload('fortress'), SILENT = payload('silenced');
  function makeFort(r, S) {
    const guns = [...r.gun.B.port, ...r.gun.B.starboard].filter((g) => g.kind === 'broadside');
    const ys = guns.map((g) => g.p.y), zs = guns.map((g) => g.p.z).sort((a, b) => a - b), ySplit = (Math.min(...ys) + Math.max(...ys)) / 2, zSplit = (zs[(zs.length >> 1) - 1] + zs[zs.length >> 1]) / 2;
    const blocks = Array.from({ length: 8 }, (_, i) => ({ i, guns: [], box: new THREE.Box3(), hp: FORT.block * S.toughness, full: FORT.block * S.toughness, dead: false, puff: 0, mid: new THREE.Vector3() }));
    for (const g of guns) {
      const b = blocks[(g.p.x > 0 ? 0 : 4) + (g.p.y > ySplit ? 0 : 2) + (g.p.z > zSplit ? 0 : 1)];
      b.guns.push(g); b.box.expandByPoint(g.p);
    }
    for (const b of blocks) {
      if (!b.guns.length) continue;
      b.box.expandByVector(sv.set(1.2, 1.6, 2.3));
      if (b.box.max.x > 0) b.box.min.x -= 2.5; else b.box.max.x += 2.5; // (into her side, where the shot strikes the hull)
      b.box.getCenter(b.mid);
    }
    return { act: 1, broken: 0, blocks: blocks.filter((b) => b.guns.length), guns: r.gun.count('port') + r.gun.count('starboard'), all: guns.length };
  }
  // a hit landing at `local` (her own frame) for `damage`: in one of her blocks of guns, it takes it all (true), and at
  // nothing left its six guns are silenced (told, with a burst of sparks and smoke)
  const bp = new THREE.Vector3();
  function blockHit(r, local, damage) {
    const F = r.fort;
    if (!F) return false;
    for (const b of F.blocks) {
      if (b.dead || !b.box.containsPoint(local)) continue;
      if ((b.hp -= damage) <= 0) {
        b.dead = true; b.hp = 0;
        r.gun.silence(b.guns);
        const left = F.guns = r.gun.count('port') + r.gun.count('starboard');
        bp.copy(b.mid).applyMatrix4(r.ship.body.matrixWorld);
        fx.burst(bp, 0xff8a3a, 40, 1.8); for (let k = 0; k < 3; k++) fx.smoke.emit(bp, sv.set((Math.random() - 0.5) * 6, 3 + k, (Math.random() - 0.5) * 6).addScaledVector(r.f.velocity, 0.3), 5, 8, 34, 0.1, 0.85, 0, 1.5);
        SILENT.raider = r; SILENT.block = b.i; SILENT.left = left; SILENT.at.copy(bp); emit('silenced'); SILENT.raider = null;
      }
      return true;
    }
    return false;
  }
  // her acts, every frame (frozen too: they follow what's been done to her): her columns blown out counted (looks.js
  // keeps them); act 2 at two-thirds of her hull or her first column broken (two Skiffs from her stern); act 3 with three
  // broken (her upper deck tilting up, reloading quicker: she's sinking, steer); her silenced blocks smoking; and, sinking
  // under the cloud floor, she's gone down
  function fortress(r, dt) {
    const F = r.fort, W = r.ship.wear, f = r.f;
    if (W) { let n = 0; for (let i = 0; i < W.clusters; i++) n += W.blown[i]; F.broken = n; }
    if (F.act === 1 && (f.frac('hull') < FORT.boats || F.broken >= 1)) {
      F.act = 2;
      const back = sv.set(Math.sin(f.heading), 0, Math.cos(f.heading)), side = sp.set(back.z, 0, -back.x);
      for (const k of [-1, 1]) later.push({ id: 'skiff', pos: f.pos.clone().addScaledVector(back, -(r.R.length / 2 + 12)).addScaledVector(side, k * 14), heading: f.heading + Math.PI + k * 0.35, boat: true });
      FORTP.raider = r; FORTP.act = 2; emit('fortress'); FORTP.raider = null;
    }
    if (F.act === 2 && F.broken >= FORT.sinking) {
      F.act = 3; F.t3 = 0; r.gunRate = FORT.rate;
      const ys = F.blocks.flatMap((b) => b.guns.map((g) => g.p.y)), top = Math.max(...ys);
      for (const b of F.blocks) for (const g of b.guns) if (g.p.y > top - 1) g.up = FORT.tilt;
      if (r.fans) for (const k in r.fans) r.fans[k].scale.y = FAN_TALL; // (her fans as tall as her upper deck now reaches; one made later is too: fanFor)
      leaveLine(r, 'sinking'); // (leading a line of battle, she breaks it up: her followers don't sink with her)
      FORTP.raider = r; FORTP.act = 3; emit('fortress'); FORTP.raider = null;
    }
    // (sinking: at least FORT.sink metres a second, and faster from high up, so she's under the cloud floor FORT.last
    // seconds after her last act began, whatever height it began at. Her height is steered down (steer); here she's
    // made to fall at least that fast, her climb set so the next frame carries her down at that rate)
    if (F.act === 3 && !r.frozen) {
      F.t3 += dt;
      const rate = Math.max(FORT.sink, (f.pos.y - (CLOUD_Y - FORT.under)) / Math.max(1, FORT.last - F.t3));
      if (f.vy > -rate) f.vy = -rate;
    }
    for (const b of F.blocks) if (b.dead && (b.puff -= dt) <= 0 && fx.smoke.room()) {
      b.puff = 0.3 / fx.q;
      bp.copy(b.mid).applyMatrix4(r.ship.body.matrixWorld);
      fx.smoke.emit(bp, sv.copy(f.velocity).multiplyScalar(0.15).setY(3), 4, 5, 18, 0.12, 0.65, 0, 1.5);
    }
    if (F.act === 3 && !r.frozen && f.pos.y < CLOUD_Y - FORT.under) f.down = { why: 'crystals', t: 0, roll: Math.random() < 0.5 ? -1 : 1 };
  }

  // a raider coming up through the cloud floor: a ring of pale mist thrown out round her as she bursts through (told,
  // and whether she's the first of her wave to: main.js says where)
  const BURST = payload('burst');
  let burstYet = false; // (one of this wave has burst through: spawnWave)
  function burstUp(r) {
    const L = r.R.length;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      sp.set(r.f.pos.x + Math.sin(a) * L * 0.6, CLOUD_Y + 2, r.f.pos.z + Math.cos(a) * L * 0.6);
      sv.set(Math.sin(a) * 9, 3, Math.cos(a) * 9);
      fx.smoke.emit(sp, sv, 3, 20, 70, 1, 0.7, 0, 0.5);
    }
    BURST.raider = r; BURST.at.copy(r.f.pos); BURST.first = !burstYet; burstYet = true; emit('burst'); BURST.raider = null;
  }

  // every frame: steer, fly, fire, pick the detail level; returns the raiders that went down this frame
  const downed = [], friendsDown = []; // (kept, and read straight away by main.js; and the barges lost this frame)
  function update(dt, foe, camera) {
    downed.length = 0; friendsDown.length = 0; escaped.length = 0; foeNow = foe; clock += dt; fanTime.value = clock; smart = skies().smart ?? 0; starN = 0;
    const toScreen = 1 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)), sight = skies().sight ?? 250, flee = skies().flee ?? 0;
    // (the claim's own barges: their own way home, or a raid's hook; never fighting)
    for (const r of friends) {
      const live = !r.f.down;
      if (r.frozen && live) r.ship.update(dt, CALM);
      else r.f.update(dt, live && ai ? (r.ai?.(r, foe, dt) || sailRoute(r)) : drift);
      r.ship.root.updateMatrixWorld(true);
      if (r.f.down && !r.counted) { r.counted = true; r.gun.cancel(); friendsDown.push(r); }
      const D = r.f.down;
      if (D) { D.y0 ??= r.f.pos.y; if (D.t > 40 || r.f.pos.y < Math.max(15, Math.min(CLOUD_Y - 140, D.y0 - 150))) r.gone = true; }
      const size = (r.R.length / Math.max(1, camera.position.distanceTo(r.f.pos))) * toScreen;
      r.ship.detail(size < detailAt ? 'far' : 'middle');
    }
    for (let i = friends.length - 1; i >= 0; i--) if (friends[i].gone) { drop(friends[i]); friends.splice(i, 1); }
    for (const r of list) {
      const live = !r.f.down, fighting = live && ai && !r.frozen && !foe.down;
      // (Brightvein: on a convoy she may be after one of the barges)
      const tgt = friends.length ? targetOf(r, foe, dt) : foe;
      // she sees the Captain unless the Captain's hidden in cloud and more than `sight` off; where she last saw her
      r.sees = tgt !== foe || !foe.hidden || r.f.pos.distanceTo(foe.pos) <= sight;
      if (r.sees) (r.seen ??= new THREE.Vector3()).copy(tgt.pos);
      foeNow = tgt;
      if (r.frozen && live) r.ship.update(dt, CALM);
      else r.f.update(dt, live && ai && !foe.down ? (r.ai?.(r, foe, dt) || steer(r, tgt, dt)) : drift);
      r.ship.root.updateMatrixWorld(true);
      // a ship going down fires no more (not even the guns still waiting their turn: they're stood down before her
      // guns are asked whose turn has come, as the shot that downed her may have landed after she last fired)
      if (r.f.down && !r.counted) {
        r.counted = true; r.gun.cancel(); downed.push(r);
        if (r.flare && r.flare.left > 0) { r.flare.left = 0; r.flare.cut = true; flareNews(r, 'none'); } // (sunk before help came)
        if (r.line?.leader === r) breakLine(r.line, 'down'); // (a line's leader gone: the line breaks up)
      }
      r.gun.update(dt, r.gunRate * r.fireRate);
      if (fighting && !r.holdFire) { shoot(r, tgt, dt); if (r.charge.b) glowPorts(r); } else { r.charge.b = null; r.charge.aimed = false; }
      if (r.charge.b || r.fans) showFans(r);
      foeNow = foe;
      const dist = r.f.pos.distanceTo(foe.pos);
      // her nerve: a hurt small raider left alone (or badly hurt) may run, once; a hurt Brig or Frigate fires a flare
      if (fighting && !r.ran && !r.captain && r.role !== 'prize' && NERVE.runs.includes(r.id)) {
        const h = r.f.frac('hull');
        if (h < NERVE.low || (h < NERVE.alone && lastAfloat(r))) { r.ran = true; if (Math.random() < flee) startRun(r, foe); }
      }
      if (fighting && !r.flares && !r.captain && r.role !== 'prize' && NERVE.flares.includes(r.id) && r.f.frac('hull') < NERVE.flare) fireFlare(r, 1);
      if (r.flare) { flareLight(r, dt); if (live && r.flare.left > 0 && (r.flare.left -= dt) <= 0) answer(r, foe); }
      if (r.smoke > 0) { r.smoke = Math.max(0, r.smoke - dt); if (live) trail(r, foe, dt); } // (the Ghost hidden in her smoke, laying more)
      // how she came in: up through the cloud floor (a ring of mist as she bursts through it), or in the sun's glare
      if (r.rising && live) { if (r.lastY < CLOUD_Y && r.f.pos.y >= CLOUD_Y) { r.rising = false; burstUp(r); } r.lastY = r.f.pos.y; }
      if (r.unseen > 0 && ((r.unseen -= dt) <= 0 || dist < 700)) r.unseen = 0;
      if (r.fort && live) fortress(r, dt);
      // a treasure ship that gets far enough away has escaped; so has one running, a little nearer, or hidden deep in the
      // cloud floor far enough off for a while
      if (live && (r.role === 'prize' || r.canEscape) && r.fleeing && dist > (r.canEscape ? r.escapeAt : 3600)) { r.gone = true; r.escaped = true; escaped.push(r); }
      if (live && r.mode === 'run') {
        r.hid = r.hidden && dist > NERVE.hidden ? r.hid + dt : 0;
        if (dist > NERVE.far || r.hid > NERVE.hide) { r.gone = true; r.escaped = true; escaped.push(r); }
      }
      // a wreck falls away below the clouds before it's taken away (140 m under them), or at least 150 m if she went
      // down low, never vanishing in the open sky (every wreck falls faster and faster: flight.js); 40 s at the most
      const D = r.f.down;
      if (D) { D.y0 ??= r.f.pos.y; if (D.t > 40 || r.f.pos.y < Math.max(15, Math.min(CLOUD_Y - 140, D.y0 - 150))) r.gone = true; }
      const size = (r.R.length / Math.max(1, camera.position.distanceTo(r.f.pos))) * toScreen;
      r.ship.detail(size < detailAt ? 'far' : 'middle');
    }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].gone) { const r = list[i]; if (r.line?.leader === r) breakLine(r.line, r.escaped ? 'run' : 'down'); drop(r); list.splice(i, 1); }
    // (the flares' stars drawn this frame)
    starGeo.setDrawRange(0, starN);
    if (starN) for (const k of ['position', 'size', 'alpha', 'hot']) starGeo.attributes[k].needsUpdate = true;
    // (the ships that joined the wave this frame: a flare's help, a Man-o'-war's boats)
    while (later.length) { const L = later.shift(), r = spawn(L.id, L.pos, L.heading); r.seen = foe.pos.clone(); r.boat = !!L.boat; }
    return downed;
  }

  // the first raider a shot from a to b (world) hits, and where
  function hitBy(a, b, who = list) {
    let best = null;
    for (const r of who) {
      if (r.f.down) continue;
      const h = firstHit(r.zones, r.ship.body, a, b, r.ship.U.uFold.value.x);
      if (h && (!best || h.t < best.h.t)) best = { r, h };
    }
    return best;
  }

  // a raider taken away, with her tag on screen (main.js) if she has one; cleared away (a fresh voyage, or a test),
  // she's marked so, and her wreck (wrecks.js) stops at once
  function drop(r) { scene.remove(r.ship.root); r.tag?.remove(); }
  function clear() { for (const r of [...list, ...friends]) { r.gone = r.cleared = true; drop(r); } list.length = 0; friends.length = 0; starGeo.setDrawRange(0, 0); }
  // build a class's models ahead of time (a captain's, before her wave), so nothing is built mid-fight
  const prepare = (id, captain = false, treasure = false) => { template(id, captain ? 'captain' : treasure ? 'treasure' : 'crew'); };
  // (a wave's: its captain's ship, and its treasure ships)
  const prepareWave = (wave) => wave.ids.forEach((id, i) => { if (i === wave.captain) prepare(id, true); else if (treasureShip(wave, i)) prepare(id, false, true); });
  // a raider's ship and nothing more, for the title screen to fly across its sky far off: not one of the raiders, never
  // fighting. Her far model in one piece (made the first time it's wanted, and shared by every one of her class there)
  const pieces = {};
  function model(id) {
    const Tm = template(id), root = new THREE.Group(), body = new THREE.Mesh(pieces[id] ??= onePiece(Tm.far.body), onePieceMaterial());
    body.name = 'raider far, in one piece'; root.add(body);
    const move = shipMotion(Tm.R, body, []);
    return { root, body, recipe: Tm.R, length: Tm.R.length, level: 'far', update: (dt, opts) => { move(dt, opts); } };
  }
  // (for the check: how many paintings the title's raiders were coloured from, and how many still hold their pixels)
  const read = () => ({ read: paintings.size, held: [...paintings.values()].filter((p) => p.d).length });
  // the screen's scale changed (main.js, as the window changes): every class's models, and every raider in the sky
  function setScale(px, ratio = 1) {
    fanPx.value = ratio; // (and the danger fans' lines, as wide on any screen)
    if (!(px > 0) || px === scale) return;
    scale = starScale.value = px;
    for (const k in T) { glowsOf(T[k].mid.body, px); glowsOf(T[k].far.body, px); }
    for (const r of list) r.ship.scale(px);
  }
  // (`sky`: sky.js, set by main.js: where the thick cloud is, for a raider running to hide in it)
  const api = { sky: null, list, friends, friendsDown, escaped, spawn, spawnWave, update, hitBy, hitFriend: (a, b) => hitBy(a, b, friends), clear, prepare, prepareWave, fanToWarm, model, paintings: read, templates: T, template, setScale, get scale() { return scale; },
    setAI: (on) => { ai = on; }, setDetail: (k) => { detailAt = k; }, get detailAt() { return detailAt; }, get ai() { return ai; },
    blockHit, fireFlare, formLine, startRun: (r) => startRun(r, foeNow), get clock() { return clock; } };
  return api;
}
