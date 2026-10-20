// events.js: the game's news, in one place. Whatever happens that something else might want to answer (a gun going
// off, a shot landing, a raider going down, a wave starting, a ship bought in port) is told here, and the effects
// (fx.js), the sound and music, the first-voyage guide and the commendations listen for it. Nothing here knows who's
// listening, so each of them can be added or taken away without touching the rest of the game.
//
// Every event has ONE payload object, made once and filled in afresh each time (a fight tells hundreds of these a
// second, and a phone would stutter clearing away a new object for each). So a listener reads it straight away and
// copies anything it wants to keep; it never holds on to the payload or its vectors.
//
//   mode            { mode }                     'title', 'port' or 'voyage': the screen changed
//   pause           { on }                       the voyage paused (true) or resumed (false); leaving a paused voyage
//                                                for port tells it ended (false) just before voyage:end
//   voyage:start    { ship, skies, trial }       set sail: the ship's id ('brig'...), the skies' id ('cross'...), and
//                                                whether it's her sea trial (a ship not owned, out for one fight)
//   voyage:end      { kept, sunk, waves, trial } back in port: shards banked, whether she went down, waves beaten,
//                                                and whether it was a sea trial (nothing banked)
//   fire            { owner, kind, battery, p, dir, weight, ship, vel, i, n, raider }
//                                                one gun going off: 'player' or 'raider'; 'chaser' or 'broadside';
//                                                'bow', 'port', 'starboard' or 'stern'; where its muzzle is and which
//                                                way it points (world); the shot's weight; the ship's class id; the
//                                                ship's velocity; this gun's place in the volley (from 0) of n guns;
//                                                the raider firing (null for the Captain's guns)
//   volley          { owner, battery, count, kind, ship, p }
//                                                a battery starting to fire (its guns ripple off after it, bow first);
//                                                p is its middle gun
//   hit             { owner, target, part, at, damage, raider, dir, vel, size, raked, kind, shot }
//                                                a shot landing: who fired it, 'player' or 'raider' hit, 'hull',
//                                                'sails' or 'crystals', where (world), how hard, the raider: the one
//                                                hit, or the one that fired at the Captain (she may be going down by
//                                                then; null for a shot no raider's guns fired), which way the shot was
//                                                flying (a unit vector), the velocity of the ship it hit, and how big
//                                                the shot was (1 a chaser's, 1.35 a broadside's: the scar it leaves),
//                                                and whether it was raking fire (down her length: tactics.js), the
//                                                kind of gun it came from ('chaser' or 'broadside'), and its shot
//                                                ('round', 'chain' or 'breaker')
//   raked           { owner, raider, at }        a broadside's shot raking a ship (the first of a volley's hits that
//                                                do): 'player' (the Captain raked the raider) or 'raider' (a raider
//                                                raked the Captain); where it landed
//   warn            { raider, battery, time }    a raider starting to ready a broadside at the Captain: her ports glow
//                                                and her red fan shows for `time` seconds, then she fires where the
//                                                Captain was heading
//   shot            { shot, why, left }          the Captain's shot: 'round', 'chain' or 'breaker'; why 'pick' (she
//                                                loaded it), 'out' (no crystal breakers left: round shot loaded) or
//                                                'earned' (a new kind earned by a deed, in the hold, not loaded); and
//                                                how many volleys of breakers are left
//   patch           { part, stage }              the Captain's crew patching her: 'start' or 'done', and what
//   port:shot       { shot }                     a kind of shot bought in port
//   nearMiss        { pan, close, at }           a raider's shot just missing the Captain's ship: pan -1 (left of the
//                                                view) to 1 (right), close 0 (barely) to 1 (a hair's breadth)
//   raider:down     { raider, why, at }          'hull', 'crystals' or 'struck' (a treasure ship, or a beaten crew,
//                                                giving up)
//   raider:escaped  { raider }                   a treasure ship, or a raider who ran, got away
//   raider:run      { raider }                   a hurt raider turning to run for the clouds (tactics.js NERVE)
//   flare           { raider, at, stage }        a raider's flare: 'fired' (help comes if she isn't sunk in time),
//                                                'answered' (help came: a Skiff or two joining the wave) or 'none'
//                                                (she was sunk, or struck, first)
//   trick           { raider, trick }            a raider captain playing her trick: 'cloud' (diving into the cloud
//                                                floor), 'sun' (climbing back into the sun), 'smoke' (vanishing in
//                                                a smoke screen): tactics.js CAPTAINS
//   burst           { raider, at, first }        a raider bursting up through the cloud floor, in a ring of mist (first:
//                                                the first of her wave to)
//   line            { raider, stage, why }       a line of battle breaking up ('broken'), and why: its leader down
//                                                ('down'), running ('run') or the Man-o'-war leading it sinking ('sinking')
//   fortress        { raider, act }              the Man-o'-war's next act: 2 (she launches her boats) or 3 (sinking,
//                                                she fires everything)
//   silenced        { raider, block, left, at }  a block of six of the Man-o'-war's guns knocked out (which, from 0;
//                                                how many broadside guns she has left; where)
//   road            { kind }                     the way on chosen between waves: 'steady', 'storm', 'treasure' or
//                                                'hunt'
//   blowout         { raider, i, at }            one of a Man-o'-war's crystal columns giving out (which, from 0, and
//                                                where its crystals were: looks.js)
//   blast           { at, size, big, first }     an explosion (a raider blowing up, and each blast of the chain that
//                                                walks along her hull after): how big in metres, whether it's a big one,
//                                                and whether it's the first (her blowing apart) or one of the chain
//   wreck:deck      { at, size }                 a wreck falling through the cloud deck, tearing it open (size: her length)
//   wreck:gone      { at, size, fire }           a wreck gone below the clouds; fire: she was burning (a glow and a
//                                                muffled boom under the cloud)
//   shards:spill    { at, total }                a downed raider spilling her shards
//   shards:gather   { value, run, at }           one shard gathered; run counts the shards gathered close together
//                                                (each within 1.5 s of the last), for a rising chime; at: the ship's hold
//   surge           { }                          the Captain's Surge
//   lock            { raider }                   the Captain's guns locking on to a raider (another than just before)
//   guns:ready      { battery, firing }          one of the Captain's broadsides loaded again ('port' or 'starboard'),
//                                                and whether she's holding the trigger (it fires at once, then)
//   slowmo          { seconds, scale }           the game slowing for a moment (the last raider of a wave going down,
//                                                or the Captain's ship): for how long (real seconds), how slow at most
//   wave:start      { n, title, captain, prize, fortress, count }
//                                                wave n (from 1) arriving: its banner, and whether it has a raider
//                                                captain, a treasure ship or a Man-o'-war, and how many ships
//   wave:cleared    { n, bonus }                 wave n beaten, and the shards it added
//   raid            { stage, at, big }           (Brightvein) a raid's moment (raids.js): 'start' (its guards come out,
//                                                or it begins), 'more' (more guards), 'boss' (a boss rises or turns to
//                                                fight), 'phase' (her next phase), 'tower' (a gun tower or drill engine
//                                                knocked out), 'beacon' (a storm beacon passed, a barge home), 'warn' (a
//                                                ram, the drill halfway, a boss running), 'taken' or 'lost'; where, and
//                                                whether it's a big fight (a boss or a wanted captain)
//   player:down     { why }                      the Captain's ship going down ('hull' or 'crystals')
//   player:low      { part }                     one of her parts dropping below 30%
//   region          { name }                     the Captain's ship crossing into another region (its name shown)
//   storm           { stage, from }              the weather (sky.js): a storm 'coming' (showing on the horizon, as
//                                                the card before its wave is up), 'here' (rolling in as the wave comes)
//                                                or 'passing' (clearing once it's beaten); from: the way it comes from,
//                                                as a heading
//   lightning       { at, far }                  lightning striking: where it struck the cloud floor, and how far from
//                                                the Captain's ship (metres): its thunder comes after it (sound.js)
//   gust            { strength }                 a gust of wind in a storm (its strength, a share of top speed)
//   hidden          { on, why }                  the Captain's ship hidden deep in cloud (on), or seen again: 'guns'
//                                                (her own guns gave her away) or 'out' (out of the cloud)
//   port:buy        { ship }                     a ship bought
//   port:upgrade    { ship, mod, step }          an upgrade bought (step: how many of it she has now)
//   port:power      { ship, power }              the crystal power moved (-2 sails .. 2 guns)
//   port:skies      { skies }                    other skies chosen
//   port:dye        { ship, kind, dye, bought }  a ship's colours changed in port: 'sails' or 'pennant', the dye's id,
//                                                and whether it was bought just now (paint.js)
//   deed            { kind, id, name, reward }   something in the Captain's record paid out (deeds.js): a 'medal' (a
//                                                commendation), a 'star', an 'order' done, the harbourmaster's thanks
//                                                for all three ('orders') or a 'rank' risen; its name, and its shards
// (the sound, sound.js, answers nearly all of them)
import { Vector3 } from 'three';

const v = () => new Vector3();
// the payloads, with every field from the start (so each keeps one shape, which is quicker to read)
export const PAYLOAD = {
  mode: { mode: '' },
  pause: { on: false },
  'voyage:start': { ship: '', skies: '', trial: false },
  'voyage:end': { kept: 0, sunk: false, waves: 0, trial: false },
  fire: { owner: '', kind: '', battery: '', p: v(), dir: v(), weight: 1, ship: '', vel: v(), i: 0, n: 1, raider: null },
  volley: { owner: '', battery: '', count: 0, kind: '', ship: '', p: v() },
  hit: { owner: '', target: '', part: '', at: v(), damage: 0, raider: null, dir: v(), vel: v(), size: 1, raked: false, kind: '', shot: '' },
  raked: { owner: '', raider: null, at: v() },
  warn: { raider: null, battery: '', time: 0 },
  shot: { shot: '', why: '', left: 0 },
  patch: { part: '', stage: '' },
  nearMiss: { pan: 0, close: 0, at: v() },
  'raider:down': { raider: null, why: '', at: v() },
  'raider:escaped': { raider: null },
  'raider:run': { raider: null },
  flare: { raider: null, at: v(), stage: '' },
  trick: { raider: null, trick: '' },
  burst: { raider: null, at: v(), first: false },
  line: { raider: null, stage: '', why: '' },
  fortress: { raider: null, act: 0 },
  silenced: { raider: null, block: 0, left: 0, at: v() },
  road: { kind: '' },
  blowout: { raider: null, i: 0, at: v() },
  blast: { at: v(), size: 0, big: false, first: false },
  'wreck:deck': { at: v(), size: 0 },
  'wreck:gone': { at: v(), size: 0, fire: false },
  'shards:spill': { at: v(), total: 0 },
  'shards:gather': { value: 0, run: 0, at: v() },
  surge: {},
  lock: { raider: null },
  'guns:ready': { battery: '', firing: false },
  slowmo: { seconds: 0, scale: 1 },
  'wave:start': { n: 0, title: '', captain: false, prize: false, fortress: false, count: 0 },
  'wave:cleared': { n: 0, bonus: 0 },
  raid: { stage: '', at: v(), big: false },
  'player:down': { why: '' },
  'player:low': { part: '' },
  region: { name: '' },
  storm: { stage: '', from: 0 },
  lightning: { at: v(), far: 0 },
  gust: { strength: 0 },
  hidden: { on: false, why: '' },
  'port:buy': { ship: '' },
  'port:upgrade': { ship: '', mod: '', step: 0 },
  'port:power': { ship: '', power: 0 },
  'port:skies': { skies: '' },
  'port:shot': { shot: '' },
  'port:dye': { ship: '', kind: '', dye: '', bought: false },
  deed: { kind: '', id: '', name: '', reward: 0 },
};
// Each event's listeners, in the order they started listening. A listener may stop listening (or another start) while
// the event is being told: one that stops is only blanked out until the telling is over (taking it out of the list there
// and then would make the next one miss it), and is told no more; one that starts is told from the next time on
const subs = {}, telling = {}, blanked = {};
for (const k in PAYLOAD) { subs[k] = []; telling[k] = 0; blanked[k] = false; }
const known = (name) => { if (!subs[name]) throw new Error(`no such event: ${name}`); return subs[name]; };

// listen for an event; returns a function that stops listening
export function on(name, fn) { known(name).push(fn); return () => off(name, fn); }
export function off(name, fn) {
  const L = known(name), i = L.indexOf(fn);
  if (i < 0) return;
  if (telling[name]) { L[i] = null; blanked[name] = true; } else L.splice(i, 1);
}
// the payload to fill in before telling an event (the same object every time)
export const payload = (name) => PAYLOAD[name];
// tell everyone listening; the payload is the event's own unless another is given
export function emit(name, p = PAYLOAD[name]) {
  const L = known(name);
  telling[name]++;
  try {
    for (let i = 0, n = L.length; i < n; i++) { const f = L[i]; if (f) f(p, name); }
  } finally {
    if (--telling[name] === 0 && blanked[name]) {
      blanked[name] = false;
      let j = 0;
      for (let i = 0; i < L.length; i++) if (L[i]) L[j++] = L[i];
      L.length = j;
    }
  }
  return p;
}
// how many are listening (for tests)
export const listeners = (name) => { let n = 0; for (const f of known(name)) if (f) n++; return n; };
