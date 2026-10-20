// tactics.js: the fight's own rules beyond flying and aiming, kept in one place, so raiders.js stays the raiders' minds
// and main.js the game's loop. docs/game.md ("Tactics") says each in plain words.
//   shot           three kinds of shot for the Captain's guns (Chris: round shot for all-round work, chain shot to shred
//                  sails and catch a runner, crystal breakers to crack crystals and bring a big ship down): how hard each
//                  hits the hull, the sails and the crystals, how fast and far it flies, how long it takes to load, and its
//                  colour. Chain shot is the Captain's once a treasure ship strikes her colours to her, the breakers once
//                  she sinks a raider captain's Frigate, or either is bought in port (`price`); she carries five volleys
//                  of breakers a voyage. Changing shot means drawing the old and loading the new: every battery reloads
//   raking         a broadside's shot flying down a ship's length, within 25 degrees of her bow or her stern, does half
//                  as much again: cross her bow or her stern and fire. It works both ways (main.js hitTest)
//   patching       the crew patch whatever's worst off (hull, sails or crystals) by a third over six seconds, while the
//                  guns reload at half speed; then they need thirty seconds before they can again (flight.js)
//   the warning    how long a raider's gun ports glow before her broadside is the skies' (progress.js `warn`); her
//                  gunners aim where the Captain will be if she holds her course (raiders.js), so climbing out of her
//                  red fan makes the whole broadside miss (diving, about half of it: her shots may still find the
//                  sails; a hard turn away carries only a Skiff or a Cutter clear in time, and turning towards her
//                  makes it worse: measured, play review October 12)
//   smarter raiders  on Crosswinds and the Maelstrom (progress.js `smart`): big raiders try to cross your bow to rake
//                  you; on the Maelstrom small ones also come at your stern, and one your guns are locked on to, with
//                  your loaded broadside pointed at her (not your bow or stern guns), may climb or dive out of it
//                  (raiders.js steer)
//   nerve          raiders don't all fight to the end: a crew raider beaten strikes her colours (half as many shards
//                  again), a hurt small one left on her own may run for the clouds, and a hurt Brig or Frigate fires a
//                  flare that brings help if she isn't sunk in time (NERVE: raiders.js)
//   captains       every raider captain has a name, a title and a trick to learn (CAPTAINS: raiders.js plays each
//                  trick), and one who sank the Captain's ship comes back for her, her price up (WANTED: main.js)
//   plating        the Man-o'-war's sides, and Ironsides', shrug off half of a hit from the side, and rakes do double
//                  (PLATE); the Man-o'-war fights in three acts, her weak points her crystal columns, her blocks of six
//                  guns and her stern windows (FORT: raiders.js, main.js hitTest)
//   arrivals       waves come in different ways: ahead, from both sides, up through the clouds, out of the sun, high
//                  and low, or in a line of battle (raiders.js waveAt and spawnWave; LINE: keeping station)
//   roads          between waves, a second way on beside the steady course: into a storm, after a treasure ship, or
//                  hunting the next raider captain early (ROADS: raiders.js roadWave, main.js)
import * as THREE from 'three';

// each shot: its name in words (and a short one for the phone's button), times as hard on each part, times as fast and
// as long-lived (its reach is both), times as long to load, its colour, the key that picks it, and its price in port
export const SHOTS = {
  round: { name: 'Round shot', short: 'Round', hull: 1, sails: 1, crystals: 1, speed: 1, life: 1, reload: 1, color: 0xffb347, key: '1' },
  chain: { name: 'Chain shot', short: 'Chain', hull: 0.25, sails: 2.5, crystals: 0.25, speed: 0.85, life: 0.8, reload: 1, color: 0xb592ff, key: '2', price: 200 },
  breaker: { name: 'Crystal breakers', short: 'Breaker', hull: 0.5, sails: 0.3, crystals: 1.6, speed: 1, life: 1, reload: 1.25, color: 0x9fe7ff, key: '3', price: 600, volleys: 5 },
};
export const SHOT_ORDER = ['round', 'chain', 'breaker'];
// each shot's little picture, on the phone's shot button and in port (drawn in the button's own colour)
export const SHOT_ICON = {
  round: '<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="6.5" fill="currentColor"/></svg>',
  chain: '<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle cx="-5.5" r="3.6" fill="currentColor"/><circle cx="5.5" r="3.6" fill="currentColor"/><path d="M-3 0q1.5-3 3 0t3 0" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  breaker: '<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-8.5 5.5-2 0 8.5-5.5-2Z" fill="currentColor"/><path d="M-5.5-2h11M0-8.5v17" stroke="#1e1520" stroke-width="0.9" opacity="0.55"/></svg>',
};
// what the port says of each (round shot is always aboard)
export const SHOT_LINES = { chain: 'Spinning chain that shreds sails: slow a runner, catch a treasure ship.', breaker: 'Pale blue shot that cracks crystals: bring a big ship down. Five volleys a voyage.' };

// raking: within this cosine of her length (25 degrees), a broadside's shot does `mul` times as much
export const RAKE = { cos: 0.906, mul: 1.5 };
const fwd = new THREE.Vector3();
// times as hard a broadside's shot flying along `v` hits the ship whose body is `body` (her bow is her own +z)
export function rakeMul(v, body) {
  const e = body.matrixWorld.elements;
  fwd.set(e[8], e[9], e[10]).normalize();
  const len = v.length();
  return len > 0 && Math.abs(fwd.dot(v)) / len > RAKE.cos ? RAKE.mul : 1;
}

// the crew patching her: this share of the worst part over `time` seconds, the guns reloading at `rate` meanwhile, and
// `wait` seconds more before they can again; the phone's button shows once her worst part is below `show`
export const PATCH = { share: 0.33, time: 6, wait: 30, rate: 0.5, show: 0.7 };

// smarter raiders (smart 1, Crosswinds): a big raider crosses the Captain's bow when the Captain points at her (within
// `facing` radians, nearer than `near` metres), making for `ahead` metres in front of her. Smartest (2, the Maelstrom):
// that, and a small one makes her attack runs at `stern` metres behind her, and one locked on to with a loaded
// broadside pointed at her dodges `alt` metres up or down, a `dodge` chance a second, holding it `hold` seconds. (Small
// raiders at the Captain's stern made Crosswinds much harder for a Captain who doesn't use the tactics: sim-fight.mjs)
export const SMART = { facing: 0.52, near: 700, ahead: 250, stern: 200, dodge: 0.35, alt: 60, hold: 2.5 };

// raiders with nerve (raiders.js). A crew raider (not a raider captain, a treasure ship or a Man-o'-war) strikes her
// colours with her sails shot away and her hull under `sails` of it, or, the last of her wave afloat, with her hull under
// `last`; one who strikes spills `prize` times her shards. A Skiff, Cutter or Brig crew (`runs`) with her hull under
// `alone` and no other raider of her wave afloat, or under `low` whoever's about, may run for the clouds, once (the
// skies' `flee`: the chance she does): she surges away, makes for thick cloud within `haven` metres and dives into it,
// firing only her stern guns; she gets away `far` metres off, or hidden deep in the cloud floor more than `hidden`
// metres off for `hide` seconds. A crew Brig or Frigate (`flares`) whose hull falls under `flare` fires a red flare,
// once: sink her (or make her strike) within `wait` seconds or help comes, `help` metres beyond her: a Skiff (a Cutter
// on the Maelstrom). Her flare climbs `rise` metres a second for `burst` seconds (so it bursts in view, a few hundred
// metres off or more), a red star `star` metres across, then hangs `hang` metres over her mast head while help comes
// (high enough to show over her tag, a few hundred metres off)
export const NERVE = { sails: 0.5, last: 0.15, prize: 1.5, runs: ['skiff', 'cutter', 'brig'], alone: 0.35, low: 0.2, haven: 1200, far: 2400, hidden: 700, hide: 6,
  flares: ['brig', 'frigate'], flare: 0.5, wait: 20, help: 1400, rise: 40, burst: 1.6, star: 26, hang: 58 };

// the raider captains (placeholders for Chris to rename: they're meant to fit Aethermoor, and none uses a name from
// the Magpie's page or the Witch's), each with a title and a trick (raiders.js plays it):
//   cloud   she dives into the cloud floor when first hurt below `hurt` of her hull, and every `every` seconds, hides
//           there `hide` seconds, then comes up under the Captain, `under` metres below her till she's within `near`
//   chain   every other broadside she fires is chain shot, at the Captain's sails
//   help    she fires a flare at each share of her hull in `at`, and `count` Skiffs answer each (one on Fair Winds)
//   sun     she comes out of the sun, and after every broadside flies off towards it for `hold` seconds, climbing to
//           `climb` metres over the Captain, then turns and dives back on her
//   iron    her sides are plated, as the Man-o'-war's are (PLATE)
//   smoke   at `at` of her hull she vanishes in a smoke screen (`puffs` big pale puffs, fewer on a phone), hidden for
//           `hide` seconds while she surges round the Captain to her other side, beam to beam, `far` metres off at most
//           (steering for a point `lead` radians further round), laying a thick puff or two every `trail` seconds
//           (laptop, phone) so she stays in her smoke
// (each `line` short, after her title on a banner: "the Cloud Fox: hides in cloud, rises under you", to fit a phone.)
// Waves 5, 10 and 15 are led by the first three in ORDER, the next three by the next three, then any at random; one who
// has sunk the Captain's ship and is still loose leads her next wave (main.js)
export const CAPTAINS = [
  { id: 'fox', name: 'Senna Vale', title: 'the Cloud Fox', trick: 'cloud', line: 'hides in cloud, rises under you' },
  { id: 'ripper', name: 'Corra Dunmore', title: 'the Sail-Ripper', trick: 'chain', line: 'chain shot every other broadside' },
  { id: 'bell', name: 'Hesper Quayle', title: 'the Bell', trick: 'help', line: 'hurt her and she flares for help' },
  { id: 'diver', name: 'Talia Brightling', title: 'the Sun-Diver', trick: 'sun', line: 'dives on you out of the sun' },
  { id: 'iron', name: 'Gudrun Holt', title: 'Ironsides', trick: 'iron', line: 'plated: rake her bow or stern' },
  { id: 'ghost', name: 'Ilse Marlowe', title: 'the Ghost', trick: 'smoke', line: 'hurt her and she vanishes in smoke' },
];
export const CAPTAIN_ORDER = CAPTAINS.map((c) => c.id), captainById = (id) => CAPTAINS.find((c) => c.id === id) ?? null;
export const TRICK = { cloud: { hurt: 0.7, every: 45, hide: 3, under: 60, near: 300 }, sun: { climb: 160, hold: 8 }, help: { at: [0.66, 0.33], count: 2 },
  smoke: { at: 0.5, puffs: [14, 8], hide: 8, far: 600, lead: 0.6, trail: [0.35, 0.5] } };
// a raider captain who sinks the Captain's ship gets away, and her price goes up by `rise` times each time, `most` times
// at the most: she leads her next wave, with her bigger bounty, until the Captain brings her down
export const WANTED = { rise: 1.25, most: 3 };
// a captain's bounty, with the price on her head (`sank`: how many times she's sunk the Captain's ship and got away)
export const wantedMul = (sank) => WANTED.rise ** Math.min(WANTED.most, sank || 0);

// plated sides (the Man-o'-war, and Ironsides): a hull hit from her side does `side` as much; a broadside's raking shot,
// down her length, `rake` times in place of RAKE.mul. And the Man-o'-war's stern windows: a shot flying in from astern
// (along her length, within `astern` of her length's cosine) landing in her aft `aft` share does `stern` times
export const PLATE = { side: 0.5, rake: 2, astern: 0.9, aft: 0.17, stern: 2 };
const side = new THREE.Vector3();
// times as hard a shot flying along `v` hits the hull of a plated ship whose body is `body`, raking or not (`raked`)
export function plateMul(v, body, raked) {
  if (raked) return PLATE.rake;
  const e = body.matrixWorld.elements;
  fwd.set(e[8], e[9], e[10]).normalize(); side.set(e[0], e[1], e[2]).normalize();
  return Math.abs(side.dot(v)) > Math.abs(fwd.dot(v)) ? PLATE.side : 1;
}
// whether a shot flying along `v` comes in from astern, along her length (her bow is her own +z)
export function fromAstern(v, body) {
  const e = body.matrixWorld.elements, len = v.length();
  fwd.set(e[8], e[9], e[10]).normalize();
  return len > 0 && fwd.dot(v) / len > PLATE.astern;
}

// the Man-o'-war's fortress battle (raiders.js, main.js). Her weak points: her five crystal columns (each blowing out
// as it gives out: looks.js), her eight blocks of six guns (each side's upper and lower deck, fore and aft), each worth
// `block` (times the skies' toughness) before its guns are silenced, and her stern windows (PLATE). A hit in a block
// hurts the block in full and her hull as her plating allows. Act 2, at `boats` of her hull or her first column broken:
// she launches two Skiffs from her stern. Act 3, with `sinking` columns broken: she's sinking, at least `sink` metres a
// second and faster from high up, so she's under the cloud floor (`under` metres below it, where she goes down) `last`
// seconds after it began, whatever her height then; and she fires everything: her upper deck's guns tilt up to `tilt`
// radians (above her, as below) and reload `rate` times as fast
export const FORT = { block: 450, boats: 0.66, sinking: 3, sink: 5, last: 60, tilt: 0.45, rate: 1.25, under: 60 };

// a line of battle (raiders.js): each ship of it `gap` of her length (and the next's) behind the one ahead, steering for
// where that place will be `ahead` seconds on; the leader fights abeam `wide` metres further off than a lone raider,
// turns at `turn` of her rate and sets at most `sail` of her sails, so the line can hold; a ship in it readies her side
// once the ship ahead has fired hers, or after `hold` seconds
export const LINE = { gap: 3.2, ahead: 2, wide: 80, turn: 0.7, sail: 0.85, hold: 6 };

// the roads between waves: beside the steady course (the wave planned), a second way on (raiders.js roadWave), from the
// card after wave `from`: into the storm (the same raiders, and one more ship if `more`, `tough` times as sturdy, in a
// storm: shards `mult` times, the wave's bonus `bonus` times), a treasure ship's trail (the same raiders, coming the same way, and a treasure ship
// with them, when none has come for `treasureGap` waves; with six already, she takes the smallest one's place) or
// hunting the next raider captain early, within `huntWithin` waves of hers (her bounty `bounty` times; her own wave is
// then a plain one).
// A wave led by a raider captain or a Man-o'-war leaves only the one way on (it bars the way)
export const ROADS = {
  storm: { name: 'Into the storm', mult: 1.5, bonus: 2, tough: 1.1, more: false }, // (one more ship made it much riskier for fewer shards: docs/game.md "How hard it is")
  treasure: { name: 'A treasure ship\'s trail', mult: 1, bonus: 1, tough: 1 },
  hunt: { name: 'Hunt her down', mult: 1, bonus: 1, tough: 1, bounty: 1.5 }, // (a quarter more barely paid for the risk: docs/game.md "How hard it is")
};
export const ROAD = { from: 2, treasureGap: 3, huntWithin: 3 };
