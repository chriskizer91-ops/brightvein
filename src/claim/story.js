// ===================================================================== STORY: the claim's chapters, its visitors, the codex
// Brightvein's own story (docs/story.md): the founders stake the claim, the Wildlight come up the cliffs, and Baron
// Ambrose Tallow, whose candle-works the sunstone claims are putting out of business, sends his claim-jumpers. Along
// the way Tamsin and Brisa come in on the Nightjar, Barnabus and Nib follow, Torvald wants his forge back, the Moon
// Faire tours in for a festival night, and a knight of the Thinwatch comes when the deep seam wakes. Visitors can stay
// as crew, each with a gift for the claim (CAST_CREW).
// The visitors wear the looks and portraits of characters from Chris's other games (cast.js; their ids are those
// games' names), but Brightvein is hundreds of years later: here they're new people, with the names in CAST_NAMES.
// Each chapter opens with a scene, sets a few goals the player can see in the journal, and closes with a scene and a
// reward. Scenes pause the claim. The story's state is saved with the claim as `story`.
// Act one (here) runs from the prologue to the Chandlery. Act two (acttwo.js) follows the money that backed Tallow,
// the charter, a rival claim, what the deep seam really is, and the Long Bright Night. The cast's own stories are in
// quests.js, the days' events in events.js and the claim's mood in mood.js; all of it is saved inside `story`.
// ready: every goal is done and the closing scene is waiting for a quiet morning (pace.js); turnDay: the day a chapter
// last opened or closed (no day event that day); paid: the goals paid for from the journal, by chapter and goal
const STORY = { ch: 0, started: false, at: null, codex: [], done: [], queue: [], shown: null, voice: null, ready: false, turnDay: -1, paid: {} };

// who can speak: the six founders (found among the claim's people by name), the cast, the Baron (by letter), and act
// two's new faces (with a look, so a bust can be drawn until their painted portrait arrives; folk.js has their prompts).
// `voice` is one of the claim's own settlers, picked when a scene needs a newcomer to speak up (whoOf).
const WHO = {
  hesper: { name: 'Hesper Lark', founder: 'Hesper Lark' }, odile: { name: 'Odile Fenn', founder: 'Odile Fenn' },
  pip: { name: 'Pip Kettleby', founder: 'Pip Kettleby' }, marigold: { name: 'Marigold Thresh', founder: 'Marigold Thresh' },
  corwin: { name: 'Corwin Ashlar', founder: 'Corwin Ashlar' }, absalom: { name: 'Absalom Pockett', founder: 'Absalom Pockett' },
  tallow: { name: 'Baron Ambrose Tallow', letter: true, portrait: 'baron-tallow' },
  voice: { name: 'A newcomer', voice: true },
};
// the visitors, by the id of the look they wear: their names and callings in Brightvein
const CAST_NAMES = {
  io: { name: 'Tamsin Vey', title: 'The lamp-witch' },
  sol: { name: 'Brisa Hale', title: 'Sword of the Brass Road' },
  halcyon: { name: 'Dame Seraphine Vael', title: 'Knight of the Thinwatch' },
  quill: { name: 'Barnabus Teague', title: 'The old skyman' },
  tock: { name: 'Nib Tolliver', title: 'The gnome shipwright' },
  brann: { name: 'Torvald Pike', title: 'The smith' },
  jester: { name: 'Mirabel Quell', title: 'The New Moon, of the Moon Faire' },
  ranger: { name: 'Rowan Thorne', title: 'The Full Moon, of the Moon Faire' },
  herbal: { name: 'Hazel Brightwater', title: 'The Waxing Moon, of the Moon Faire' },
  fox: { name: 'Clem Fennick', title: 'The Waning Moon, of the Moon Faire' },
};
for (const [id, c] of Object.entries(CAST_NAMES)) WHO[id] = { name: c.name, hero: id };
// what friends call someone: Seraphine, not Dame; Marchbank, not Provost
const shortName = n => String(n).split(' ').find(w => !['Dame', 'Provost', 'Baron', 'Captain', 'Sir'].includes(w)) || String(n);
const castFirst = id => shortName(CAST_NAMES[id].name);

// the cast as crew: their stats, trade, trait and the gift they bring the whole claim while they're on it
const CAST_CREW = {
  io: { stats: { G: 4, E: 6, A: 6, R: 9, S: 9 }, trait: 'Warm', pref: 'garden', perk: 'Lamp-craft', perkText: 'The lamps burn a third less charge at night.' },
  sol: { stats: { G: 10, E: 4, A: 7, R: 4, S: 3 }, trait: 'Bold', pref: 'wall', perk: 'Convoy drill', perkText: 'Everyone on the watch hits a quarter harder.' },
  halcyon: { stats: { G: 10, E: 5, A: 8, R: 4, S: 2 }, trait: 'Steady', pref: 'wall', perk: 'Thinwatch vigil', perkText: 'Wildlight on the plateau take a fifth more harm from everything.' },
  quill: { stats: { G: 5, E: 7, A: 8, R: 7, S: 4 }, trait: 'Steady', pref: 'mast', perk: 'Old skyman', perkText: 'Voyages bring home a tenth more shards.' },
  tock: { stats: { G: 3, E: 10, A: 6, R: 5, S: 4 }, trait: 'Tinkerer', pref: 'shop', perk: 'Gnome mirrors', perkText: 'The sunning yards charge a fifth faster.' },
  brann: { stats: { G: 9, E: 8, A: 4, R: 5, S: 3 }, trait: 'Steady', pref: 'head', perk: "Smith’s edge", perkText: 'Every weapon on the claim hits a tenth harder.' },
  fox: { stats: { G: 4, E: 5, A: 9, R: 8, S: 6 }, trait: 'Sharp-eyed', pref: 'yard', perk: "Fox’s luck", perkText: 'Miners and travellers find more.' },
};
const castHere = id => GAME.villagers.some(v => v.d.hero === id && !v.d.exp);
const castPerk = id => CAST_CREW[id] && castHere(id);

const CODEX = {
  claim: { title: 'The Brightvein claim', text: 'A seam of raw sunstone broke the surface on a high plateau in the Ironspire Peaks, just under the Thinning. Whoever stakes it first owns it, as long as they can hold it.' },
  wildlight: { title: 'The Wildlight', text: 'Loose light, the old prospectors called it: sunstone glow that has come away from its stone and wanders. Glimmers, Flarehounds, Lodestars. They climb toward anything brighter than themselves, and drink it. They hate smoked glass and the ring of a tuning fork.' },
  sunstone: { title: 'Sunstone', text: 'Raw, it is dull amber rock. Laid out in the sun it charges, and charged it lifts ships, lights towns and fires the lens towers. Shards of it are Aethermoor’s money.' },
  tallow: { title: 'Baron Ambrose Tallow', text: 'He made his fortune in candles and lamp oil, back when the dark was cheap to sell against. Every sunstone claim that opens puts more of his wicks out of work, so he jumps them. His crews fly rust-red sails; his citadel is the Chandlery, a candle-works on a lifted rock.' },
  nightjar: { title: 'The Nightjar', text: 'Tamsin’s ship: small, black-hulled and quick, with a lantern on the bowsprit. Tamsin won her at cards from a courier who couldn’t pay. Nib keeps her in the air.' },
  convoys: { title: 'The Brass Road', text: 'Sunstone travels from the claims to the shipyards in armed convoys along the Brass Road. Brisa Hale guarded them for years, until Tallow bought the road and the company folded.' },
  thinwatch: { title: 'The Thinwatch', text: 'An old order of knights who kept watch wherever sunstone runs deep, because something bright always climbs out of a deep seam once it’s opened. Seraphine Vael is the last of them.' },
  wickmoor: { title: 'The Wickmoor', text: 'Tallow’s supply galleon: fat, slow and full of other people’s things. Shoot her sails and she strikes her colours. Sink her and her crates go down with her.' },
  moonfaire: { title: 'The Moon Faire', text: 'A travelling festival on a painted airship, run by four performers who each take the name of a phase of the moon. They follow the brightest lights.' },
  deepseam: { title: 'The deep seam', text: 'Below the lower gallery the vein runs on, brighter and older. At night it hums. Something down there wakes when the seam is opened.' },
  chandlery: { title: 'The Chandlery', text: 'Tallow’s fortress: stone works and tall chimneys on a great lifted rock, with a candle burning on its roof. Taken, it stands dark.' },
};

// ---- the goals the chapters set (each: text, done(), and progress [have, need] where it helps)
// Nights are counted when they're over, at dawn (paceNightsSeen in pace.js), so a night goal never closes a chapter at
// dusk with the Wildlight still to come.
const sinceStart = k => (STORY.at ? (k === 'nights' ? paceNightsSeen() - STORY.at.nights : 0) : 0);
const raided = id => FLEET && FLEET.data.raids[id] && FLEET.data.raids[id].won > 0;
const GOAL = {
  nights: (n, text) => ({ text: text || `See out ${n === 1 ? 'the first night' : n + ' nights'}`, done: () => paceNightsSeen() >= n, prog: () => [Math.min(n, paceNightsSeen()), n] }),
  nightsHere: (n, text) => ({ text, done: () => sinceStart('nights') >= n, prog: () => [Math.min(n, sinceStart('nights')), n] }),
  shards: n => ({ text: `Have ${n} shards in the stores`, done: () => GAME.shards >= n, prog: () => [Math.min(n, Math.floor(GAME.shards)), n] }),
  build: (type, n, text) => ({ text, done: () => byType(type).length >= n, prog: () => [Math.min(n, byType(type).length), n] }),
  level: (id, lv, text) => ({ text, done: () => (TOWN.b[id] && TOWN.b[id].level >= lv && !TOWN.b[id].building), prog: null }),
  raid: (id, text) => ({ text, done: () => raided(id), prog: null }),
  people: (n) => ({ text: `Have ${n} people on the claim`, done: () => GAME.villagers.length >= n, prog: () => [Math.min(n, GAME.villagers.length), n] }),
  ship: (ids, text) => ({ text, done: () => FLEET && ids.some(id => FLEET.data.ships[id].owned), prog: null }),
  jobs: (ids, text) => ({ text, done: () => ids.every(id => GAME.villagers.some(v => v.d.hero === id && v.d.job)), prog: () => [ids.filter(id => GAME.villagers.some(v => v.d.hero === id && v.d.job)).length, ids.length] }),
  // something handed over from the journal (a fee, food for refugees): done once paid (storyPay in pace.js). then():
  // what paying it does, as a scene's lines and what happens after; log: the line for the journal's days
  pay: (cost, text, then = null, log = null) => ({ text, cost, then, log, done() { return !!STORY.paid[this.key]; }, prog: null }),
};

// ---- the chapters
const CHAPTERS = [
  { id: 'prologue', title: 'Stake the Claim', line: 'The founders have the plateau. Now to keep it.',
    open: [
      ['hesper', 'There she is. Raw sunstone, right at the surface, and not a flag on the whole plateau but ours.'],
      ['absalom', 'Claim filed, stamped and witnessed. Witnessed by me, admittedly. But it is a very official stamp.'],
      ['odile', 'Listen. Hear that hum under your boots? The seam’s singing. Lay the ore out in the sun and it’ll charge.'],
      ['corwin', 'Wall first.'],
      ['hesper', 'Corwin’s right. Up here we’re the brightest thing for fifty miles, and something always comes for the light at night.'],
    ],
    goals: [GOAL.nights(1, 'See out the first night')],
    close: [
      ['pip', 'That’s the first night gone. They came up the cliffs like sparks off a grinding wheel. They didn’t like the lenses one bit.'],
      ['marigold', 'The greenhouse is planted and the bees haven’t left. Bees know a good place.'],
      ['hesper', 'Then we stay.'],
    ],
    reward: { shards: 40, codex: ['claim', 'sunstone'] } },
  { id: 'firstlight', title: 'First Light', line: 'Every tray charged makes the claim brighter, and every night more Wildlight come.',
    open: [
      ['odile', 'Every tray we charge, the town gets brighter. And every night, more of them come.'],
      ['pip', 'They’re not animals, you know. They’re light. Loose light. They want ours.'],
      ['absalom', 'Wildlight, the old prospectors called them. They also called them a fine reason to prospect somewhere else.'],
      ['hesper', 'We’re not going anywhere. A lens tower on the rim, and a full store before the next new moon.'],
    ],
    goals: [GOAL.build('lens', 1, 'Build a Lens Tower'), GOAL.shards(250), GOAL.nights(3, 'See out three nights')],
    close: [
      ['hesper', 'Three nights and the lamps never went out. The vein’s paying.'],
      ['absalom', 'Which means someone will notice. Someone always notices.'],
    ],
    reward: { shards: 100, codex: ['wildlight'] } },
  { id: 'letter', title: 'A Letter Under Seal', line: 'Baron Tallow wants a tithe. The claim has a ship.',
    open: [
      ['pip', 'Courier skiff at the Sky Dock! Rust-red sails. She didn’t stop: dropped a satchel on the bridge and turned east.'],
      ['tallow', 'To the occupants of the Brightvein plateau. Be advised that this seam lies under the protection of the Chandlery. A tithe of three hundred shards falls due at the new moon, for your safety. My crews would hate to see your lamps go dark. — Ambrose Tallow, Baron of the Chandlery.'],
      ['absalom', '“Protection.” I have read that word on a great many ransom notes.'],
      ['hesper', 'He’s a candle-maker. Made his fortune on tallow and lamp oil, and every sunstone claim that opens puts his wicks out of work.'],
      ['corwin', 'Not paying.'],
      ['hesper', 'No. We’ve got a ship, and his crews have a camp on a lifted rock north-west of the rim. Let’s go and introduce ourselves. The Sky button, then Raids.'],
    ],
    goals: [GOAL.level('keep', 2, 'Raise the Keep to level 2'), GOAL.raid('camp', 'Take Tallow’s prospect camp (Sky Dock › Raids)')],
    close: [
      ['hesper', 'His camp’s flying our colours. That’ll reach the Chandlery before supper.'],
      ['odile', 'Then we’d better be brighter than he is.'],
    ],
    reward: { shards: 80, codex: ['tallow'] } },
  { id: 'magpie', title: 'The Nightjar', line: 'A small black ship with a lantern on her bowsprit comes in over the rim.',
    visit: { ship: 'magpie', cast: ['io', 'sol'] },
    open: [
      ['pip', 'Ship off the north rim! Small, black hull, a lantern on the bowsprit. She’s not one of Tallow’s.'],
      ['io', 'Hello! Sorry. Hello. We saw your light from the far side of the peaks. I thought a star had come down.'],
      ['sol', 'She thought that. I thought it was a fire.'],
      ['io', 'I’m Tamsin. I tend lamps, mostly. The kind that don’t need oil. This is Brisa. She guards sunstone convoys.'],
      ['sol', 'Guarded. The company folded when Tallow bought the Brass Road. Now I guard whoever’s worth it. You’ve got a lot of light lying out in the open.'],
      ['hesper', 'We could use the help. There’s a baron who wants our light, and something that climbs the cliffs every night that wants it more.'],
      ['io', 'The Wildlight. We saw them on the rim as we came in. They seemed… lost. Light with nowhere to go. I’d like to understand them.'],
      ['sol', 'Understand them later. They bite. Give me your watch for a week.'],
    ],
    goals: [GOAL.jobs(['io', 'sol'], 'Give Tamsin and Brisa a job each (tap them)'), GOAL.nightsHere(1, 'Hold the claim through a night with them')],
    close: [
      ['io', 'The Nightjar’s crystals are cracked. Odile says she can recut them, if we stay a while.'],
      ['odile', 'Beautiful stones. Badly treated.'],
      ['sol', 'We’re staying a while.'],
    ],
    reward: { shards: 60, codex: ['nightjar', 'convoys'], crew: ['io', 'sol'] } },
  { id: 'redspire', title: 'Redspire', line: 'Tallow’s crews fly out of a red crag south-west of the claim.',
    open: [
      ['sol', 'Tallow’s crews fly out of a red crag south-west of here. Redspire. That’s where they’ll come from, when they come.'],
      ['hesper', 'Then we go first.'],
      ['corwin', 'Ballistas. Two.'],
    ],
    goals: [GOAL.raid('outpost', 'Take the Redspire outpost'), GOAL.build('ballista', 2, 'Build two Clockwork Ballistas')],
    close: [
      ['quill', 'Ahoy the claim! An old skyman begs a mooring, and a gnome who won’t stop talking about your ship’s rudder.'],
      ['tock', 'It’s too small. The rudder. Lovely ship. Rudder’s too small. I’ll fix it. Small fee. Smaller than the rudder.'],
      ['io', 'Barnabus! He taught me to fly. And Nib keeps the Nightjar in the air.'],
      ['quill', 'Tallow’s been buying up every shipwright between here and the coast. Nib’s the one he couldn’t buy.'],
    ],
    visitAfter: { cast: ['quill', 'tock'] },
    reward: { shards: 120, crew: ['quill', 'tock'] } },
  { id: 'wickmoor', title: 'The Wickmoor', line: 'Tallow’s supply galleon runs south of the claim.',
    open: [
      ['quill', 'Tallow’s supply galleon runs south of here every few days. The Wickmoor. Fat as a pudding and twice as slow.'],
      ['tock', 'Shoot her sails, not her hull. Sails mend. Crates don’t swim.'],
    ],
    goals: [GOAL.raid('galleon', 'Capture the Wickmoor'), GOAL.shards(400)],
    close: [
      ['brann', 'That galleon was carrying my forge. Tallow bought it out from under me. I’d like it back, and I’d like to hit something with a hammer.'],
      ['odile', 'You can hit things at my bench.'],
      ['brann', 'Fair.'],
    ],
    visitAfter: { cast: ['brann'] },
    reward: { shards: 150, codex: ['wickmoor'], crew: ['brann'] } },
  { id: 'moonfaire', title: 'The Moon Faire', line: 'A painted airship tours in for a festival night.', festival: true,
    visit: { ship: 'faire', cast: ['jester', 'ranger', 'herbal', 'fox'] },
    open: [
      ['jester', 'Ladies, gentlemen, and things that glow in the dark! The Moon Faire has come to Brightvein!'],
      ['ranger', 'We follow the brightest lights. Yours is the brightest for a hundred miles.'],
      ['herbal', 'And the Wildlight follow bright lights too, I hear. We’ll keep an eye on them while you dance.'],
      ['fox', 'Do you have anything to eat? Not for me. For a friend. The friend is me.'],
      ['marigold', 'There are pies. There are always pies.'],
    ],
    goals: [GOAL.level('keep', 3, 'Light the sun beacon (raise the Keep to level 3)'), GOAL.nightsHere(1, 'See out the festival night')],
    close: [
      ['jester', 'Brightvein, you were a marvellous audience. Mostly.'],
      ['herbal', 'Keep the beacon lit. We’ll see it from the coast.'],
      ['fox', 'I’m staying. Somebody has to eat the pies.'],
    ],
    leave: ['jester', 'ranger', 'herbal'],
    reward: { shards: 120, codex: ['moonfaire'], crew: ['fox'] } },
  { id: 'deepseam', title: 'The Deep Seam', line: 'The vein runs on below the lower gallery, and it hums at night.',
    open: [
      ['odile', 'The seam goes further down than we’ve dug. I can hear it under the lower gallery. It’s louder at night.'],
      ['io', 'Whatever’s down there is very bright, and very old.'],
      ['brann', 'Then we’ll want better picks.'],
    ],
    goals: [GOAL.level('head', 2, 'Open the deep seam (raise the Headframe)'), GOAL.nightsHere(1, 'See out a night with the deep seam open')],
    close: [
      ['sol', 'That thing that came up the shaft. That was no spark.'],
      ['io', 'It was so bright. It went back down when the sun came up. I don’t think it was angry. I think it was hungry.'],
      ['halcyon', 'It was a Brightmaw. One climbs out wherever a deep seam is opened. I have followed their kind across the Ironspire for longer than I care to say.'],
      ['hesper', 'And who are you, coming up my bridge in armour at dawn?'],
      ['halcyon', 'Seraphine Vael, of the Thinwatch. There is one of us left. I knew someone would dig too deep here. I would stand your nights, if you will have me.'],
      ['sol', 'She’s good. She came up the bridge in full plate and isn’t out of breath. Have her.'],
    ],
    visitAfter: { cast: ['halcyon'] },
    reward: { shards: 200, codex: ['deepseam', 'thinwatch'], crew: ['halcyon'] } },
  { id: 'chandlery', title: 'The Chandlery', line: 'Every crew Tallow has left is at his citadel.', actEnd: 'one',
    open: [
      ['hesper', 'Every crew Tallow has left is at the Chandlery. Six gun towers, his frigate and a Man-o’-war.'],
      ['sol', 'Then we need a bigger ship.'],
      ['tock', 'I know a brig. I know a frigate. I know a shipyard. You know where the shards are.'],
      ['halcyon', 'And when the Chandlery is dark, its lights will still need keeping.'],
    ],
    goals: [GOAL.ship(['brig', 'frigate', 'galleon', 'manowar'], 'Own a Brig, or anything bigger (Shipyard)'), GOAL.raid('citadel', 'Take the Chandlery')],
    close: [
      ['tallow', 'Very well. The plateau is yours. You will find, as I did, that light is a hungry thing to keep. — A. T.'],
      ['hesper', 'The Chandlery’s dark. The Ironspire’s ours.'],
      ['io', 'Your lamps look like a constellation from up here.'],
      ['odile', 'Listen. The seam’s still singing.'],
    ],
    reward: { shards: 400, codex: ['chandlery'] } },
];

// ---- saving: the chapters, and inside them act two's state, the cast's stories, the days' events and the mood.
// A claim saved before any of those existed simply starts them fresh; one that finished act one goes on into act two.
function storySave() {
  return { ch: STORY.ch, started: STORY.started, at: STORY.at, codex: STORY.codex, done: STORY.done, voice: STORY.voice, ready: STORY.ready, turnDay: STORY.turnDay, paid: STORY.paid,
    act: actSave(), quests: questsSave(), events: eventsSave(), mood: moodSave() };
}
function storyLoad(s) {
  if (s) Object.assign(STORY, { ch: s.ch || 0, started: !!s.started, at: s.at || null, codex: s.codex || [], done: s.done || [], voice: s.voice ?? null,
    ready: !!s.ready, turnDay: s.turnDay ?? -1, paid: s.paid || {} });
  actLoad(s && s.act); questsLoad(s && s.quests); eventsLoad(s && s.events); moodLoad(s && s.mood);
  if (!s) return;
  // the cast keep their latest looks
  for (const v of GAME.villagers) if (v.d.hero && HERO_LOOKS[v.d.hero]) { v.d.look = { ...HERO_LOOKS[v.d.hero] }; Object.assign(v.d, CAST_NAMES[v.d.hero]); v.redraw(); }
  const C = CHAPTERS[STORY.ch];
  if (C && STORY.started && C.visit && C.visit.ship) visitShip(C.visit.ship, true);
  if (C && STORY.started && C.ship) visitShip(C.ship, true);
  if (GAME.villagers.some(v => v.d.hero === 'io' || v.d.hero === 'sol')) visitShip('magpie', true);
}

// ---- visitors: their ship comes in east of the Sky Dock, and they walk down the bridge into town
const VISIT = { ships: {} };
function visitShip(kind, quiet) {
  if (VISIT.ships[kind] || !SKY || !SKY.shipArt) { if (!VISIT.ships[kind] && SKY) SKY.art.then(() => visitShip(kind, quiet)); return; }
  // the Nightjar: small and black-hulled; the Moon Faire's ship: a brig painted teal, with rose-violet sails; the
  // Exchange's: a brig in pale grey with silver sails, standing off farther out and higher, as a bank would
  const A = SKY.shipArt, M = { ...A.M, hull: A.M.hull.clone(), canvas: A.M.canvas.clone() };
  M.canvas.onBeforeCompile = A.M.canvas.onBeforeCompile; M.canvas.customProgramCacheKey = A.M.canvas.customProgramCacheKey;
  if (kind === 'faire') { M.hull.color.set(0x5f9aa0); M.canvas.color.set(0xe0a0dc); M.canvas.emissive.set(0x5a2050); }
  else if (kind === 'exchange') { M.hull.color.set(0x5c626c); M.canvas.color.set(0xaab6c6); M.canvas.emissive.set(0x1c2a3a); }
  else { M.hull.color.set(0x4a4048); }
  const R = SHIPS.find(x => x.id === (kind === 'magpie' ? 'cutter' : 'brig')), s = buildShipAt(R, 'middle', { ...A, M });
  const D = LAYOUT.dock, at = kind === 'faire' ? new THREE.Vector3(D.x - 34, 9, D.z - 18) : kind === 'exchange' ? new THREE.Vector3(D.x - 16, 10, D.z - 24) : new THREE.Vector3(D.x + 30, 7, D.z - 13);
  s.root.position.copy(at); s.root.rotation.y = kind === 'magpie' ? Math.PI / 2 : -Math.PI / 2;
  scene.add(s.root);
  VISIT.ships[kind] = { s, at, t: Math.random() * 10, arrive: quiet ? 1 : 0 };
}
function updateVisits(dt) {
  for (const V of Object.values(VISIT.ships)) {
    V.t += dt; V.arrive = Math.min(1, V.arrive + dt / 8);
    const k = 1 - Math.pow(1 - V.arrive, 3);
    V.s.root.position.set(V.at.x + (1 - k) * 160, V.at.y + (1 - k) * 40 + Math.sin(V.t * 0.7) * 0.3, V.at.z - (1 - k) * 120);
    V.s.update(dt, { calm: true });
    V.s.glow.material.uniforms.uScale.value = 0.6 * renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}
// the cast come ashore as people of the claim (guests: they don't count against the Keep's beds)
function castArrive(ids) {
  const D = LAYOUT.dock;
  for (const id of ids) {
    if (GAME.villagers.some(v => v.d.hero === id) || !HERO_LOOKS[id]) continue;
    const L = HERO_LOOKS[id], N = CAST_NAMES[id], C = CAST_CREW[id] || { stats: { G: 5, E: 5, A: 6, R: 8, S: 5 }, trait: 'Warm', pref: null };
    const d = { id: GAME.nextId++, hero: id, name: N.name, title: N.title, stats: { ...C.stats }, trait: C.trait, look: { ...L }, named: true, job: null, home: 'keep', gear: {}, pref: C.pref || null, guest: !CAST_CREW[id], arrived: GAME.day };
    const v = addVillager(d, new THREE.Vector3(D.x - 8 + Math.random() * 2, 0, D.z + 6 + Math.random() * 2));
    v.replan = true;
  }
}
function castLeave(ids) {
  for (const id of ids) {
    const v = GAME.villagers.find(x => x.d.hero === id); if (!v) continue;
    scene.remove(v.sprite); scene.remove(v.shadow); KSCENE.remove(v.isprite);
    GAME.villagers.splice(GAME.villagers.indexOf(v), 1);
  }
  if (VISIT.ships.faire && !GAME.villagers.some(v => ['jester', 'ranger', 'herbal'].includes(v.d.hero))) { scene.remove(VISIT.ships.faire.s.root); delete VISIT.ships.faire; }
}
function shipLeaves(kind) { const V = VISIT.ships[kind]; if (V) { scene.remove(V.s.root); delete VISIT.ships[kind]; } }

// ---- the story's clock: open the chapter, watch its goals, close it
// Scenes wait for a quiet hour (pace.js): a chapter opens and closes by day, never while Wildlight or jumpers are on
// the claim, and once the dawn report has been read. A chapter whose goals all came true at night closes the next
// morning (it stays done meanwhile: STORY.ready), and the next chapter's opening follows straight on in the same scene.
let storyT = 0;
function storyTick(dt) {
  if (!started || !BUILD.setupDone) return;
  updateVisits(dt);
  actFrame(dt);   // the day’s event card, the cast waiting at the Keep, the mood on the HUD (events.js, quests.js, mood.js)
  if ((storyT -= dt) > 0 || STORY.shown || EVT.card || (SKY && SKY.on) || BUILD.on || frontOpen()) return;   // not while the settings are open (title.js)
  storyT = 0.5;
  if (STORY.queue.length && paceCalm()) return playScene(STORY.queue.shift());   // the cast's scenes: once nothing is on the claim
  const C = CHAPTERS[STORY.ch]; if (!C) { journalHUD(); return; }
  if (!STORY.started) { if (paceQuiet()) storyOpen(C); else journalHUD(); return; }
  journalHUD();
  if (!STORY.ready && C.goals.every(g => g.done())) { STORY.ready = true; saveGame(); }
  if (STORY.ready && paceQuiet()) storyClose(C);
}
function storyOpen(C) {
  STORY.started = true; STORY.ready = false; STORY.turnDay = paceDayOf();
  STORY.at = { day: GAME.day, nights: paceNightsSeen(), tally: { ...ACT.tally } };
  if (C.visit) { if (C.visit.ship) visitShip(C.visit.ship); castArrive(C.visit.cast || []); }
  if (C.ship) visitShip(C.ship);
  if (C.onOpen) C.onOpen();
  if (C.id === 'letter' || C.ship || (C.visit && C.visit.ship)) AUDIO.play('horn');
  playScene({ lines: C.open, title: C.title, chapter: STORY.ch, act: C.actStart });
  journalHUD();
}
function storyClose(C) {
  const R = C.reward || {};
  STORY.turnDay = paceDayOf();
  if (C.visitAfter) castArrive(C.visitAfter.cast || []);
  playScene({ lines: C.close, after: () => {
    if (R.shards) GAME.shards += R.shards;
    const got = paceReward(R);   // materials, Lark parts, modules, gear (pace.js)
    for (const k of R.codex || []) if (!STORY.codex.includes(k)) STORY.codex.push(k);
    if (C.leave) castLeave(C.leave);
    if (C.ship) shipLeaves(C.ship);
    if (C.onClose) C.onClose();
    STORY.done.push(C.id);
    daysLog(`${C.actEnd ? 'The end of act ' + C.actEnd + ': ' : 'Chapter done: '}${C.title}.`, 'story');
    const more = `${R.shards ? ` · ${SHARD} ${R.shards}` : ''}${got.length ? ` · ${got.join(', ')}` : ''}`;
    toast(C.actEnd ? `<b>The end of act ${C.actEnd}.</b> ${esc(C.title)} is done${more}${CHAPTERS[STORY.ch + 1] ? '. The story goes on…' : '. More to come.'}`
      : `<b>${esc(C.title)}</b>: chapter done${more}${(R.crew || []).length ? ` · ${R.crew.map(castFirst).join(' and ')} join${R.crew.length > 1 ? '' : 's'} the crew` : ''}${(R.codex || []).length ? ' · new in the journal' : ''}.`);
    AUDIO.play('chapter');
    STORY.ch++; STORY.started = false; STORY.ready = false; STORY.at = null; storyT = 6;
    journalHUD(); saveGame();
    // the next chapter's opening follows on in the same sitting, rather than a second stop a few seconds later
    const N = CHAPTERS[STORY.ch]; if (N && !EVT.card && paceQuiet()) { storyT = 0.5; storyOpen(N); }
  } });
}
// what has happened since this chapter opened: a count of something the claim keeps a tally of (ACT.tally)
const sinceCh = k => (ACT.tally[k] || 0) - ((STORY.at && STORY.at.tally && STORY.at.tally[k]) ?? (ACT.tally[k] || 0));

// ---- scenes: a portrait, a name and the words, one line at a time. Tap to go on; the claim waits meanwhile.
// who a speaker key is right now: the voice of the claim's newcomers is one of its own settlers (the same one each
// time, while they're here), so the person arguing at supper is someone you've seen walking about town
function whoOf(k) {
  const W = WHO[k]; if (!W || !W.voice) return W;
  let v = GAME.villagers.find(x => x.d.id === STORY.voice);
  if (!v) {
    const pool = GAME.villagers.filter(x => !x.d.hero && !x.d.named && !x.d.exp).sort((a, b) => statOf(b, 'R') - statOf(a, 'R'));
    v = pool[0] || null; STORY.voice = v ? v.d.id : null;
  }
  return v ? { name: v.d.name, villager: v } : W;
}
const framed = (size, cls = '') => { const w = document.createElement('div'); w.className = 'pframe' + (cls ? ' ' + cls : ''); w.style.width = w.style.height = size + 'px'; return w; };
function speakerPortrait(key, size = 120) {
  const W = whoOf(key);
  if (W.villager) return portraitOf(W.villager, size);
  // a painted portrait (the Baron's, and act two's visitors once Chris has made theirs), else a bust drawn from a look
  if (W.portrait && ART.portraits && ART.portraits[W.portrait]) { const w = framed(size, 'painted'), im = new Image(); im.src = ART.portraits[W.portrait]; im.alt = ''; w.append(im); return w; }
  if (W.look && typeof drawPortrait === 'function') { const w = framed(size), c = document.createElement('canvas'); try { drawPortrait({ ...W.look }, c); w.append(c); return w; } catch (e) { console.warn(e); } }
  if (W.letter) {
    const wrap = framed(size, 'letter');
    wrap.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="14" width="44" height="36" rx="2" fill="#efe2c4" stroke="#6a4a2a" stroke-width="2"/><path d="M10 16l22 18 22-18" fill="none" stroke="#6a4a2a" stroke-width="2"/><circle cx="32" cy="40" r="8" fill="#9a2a1e" stroke="#4a120c" stroke-width="2"/><path d="M29 37h6M29 43h6M32 35v10" stroke="#e8b0a0" stroke-width="1.5"/></svg>';
    return wrap;
  }
  const v = GAME.villagers.find(x => (W.hero && x.d.hero === W.hero) || (W.founder && x.d.name === W.founder));
  if (v) return portraitOf(v, size);
  if (W.hero && ART.cast && ART.cast[W.hero]) { const w = framed(size), im = new Image(); im.src = ART.cast[W.hero]; w.append(im); return w; }
  return framed(size);
}
const TALK = { lines: null, i: 0, typing: 0, full: '', after: null };
// sc: { lines: [[who, text]], title, chapter, act (the first chapter of an act), heading (a title of its own), after }
function playScene(sc) {
  STORY.shown = sc; TALK.lines = sc.lines.filter(([k]) => WHO[k]); TALK.i = 0; TALK.after = sc.after || null;
  if (!TALK.lines.length) { STORY.shown = null; if (TALK.after) { const a = TALK.after; TALK.after = null; a(); } return; }
  GAME.talk = true; UI.close();
  const dm = document.getElementById('dawnmini'); if (dm) dm.hidden = true;   // the dawn line would sit over the title
  const head = sc.heading || (sc.title ? `${sc.chapter ? `Chapter ${sc.chapter}` : 'Prologue'} · ${sc.title}` : '');
  const T = $('#talk-title'); T.textContent = head; T.hidden = !head;
  if (sc.act && head) { const s = document.createElement('small'); s.textContent = `Act ${sc.act}`; T.prepend(s); }
  $('#talk').hidden = false;
  showLine();
}
function showLine() {
  const [k, text] = TALK.lines[TALK.i], W = whoOf(k);
  const por = $('#talk-por'); por.innerHTML = ''; por.append(speakerPortrait(k, 128));
  $('#talk-name').textContent = W.name; TALK.full = text; TALK.typing = 0; $('#talk-text').textContent = '';
  $('#talk').classList.toggle('letter', !!W.letter);
  AUDIO.play('tap');
}
function talkFrame(dt) {
  if (!STORY.shown || TALK.typing >= TALK.full.length) return;
  TALK.typing = reducedMotion ? TALK.full.length : Math.min(TALK.full.length, TALK.typing + dt * 60);   // less motion: the words appear whole
  $('#talk-text').textContent = TALK.full.slice(0, Math.floor(TALK.typing));
}
function talkNext() {
  if (!STORY.shown) return;
  if (TALK.typing < TALK.full.length) { TALK.typing = TALK.full.length; $('#talk-text').textContent = TALK.full; return; }
  if (++TALK.i < TALK.lines.length) return showLine();
  endScene();
}
function endScene() {
  $('#talk').hidden = true; GAME.talk = false;
  const after = TALK.after; STORY.shown = null; TALK.after = null;
  if (after) after();
  journalHUD();
}
$('#talk').addEventListener('click', e => { if (e.target.id === 'talk-skip') { endScene(); return; } talkNext(); });
addEventListener('keydown', e => { if (STORY.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); talkNext(); } });

// ---- the journal: the chapter and its goals on screen (and the cast's stories under them), and a panel with the
// story so far, the cast and their stories, the claim's days and mood, and the codex
const actOf = i => i >= ACT_TWO ? 'two' : 'one';
function journalHUD() {
  const el = $('#journal'), C = CHAPTERS[STORY.ch];
  if (!started || !BUILD.setupDone) { el.hidden = true; return; }
  let html = '';
  if (C && STORY.started) html = `<b>${STORY.ch ? `Chapter ${STORY.ch}` : 'Prologue'} · ${esc(C.title)}</b>` + C.goals.map(g => {
    const ok = STORY.ready || g.done(), p = g.prog && g.prog(), note = !ok && g.note && g.note(), pay = !ok && g.cost && canGive(g.cost);
    if (ok && g.seen === false && !g.rang) { g.rang = true; AUDIO.play('goal'); } g.seen = ok;
    return `<span class="${ok ? 'ok' : pay ? 'q ready' : ''}"><i>${ok ? '✓' : pay ? '◆' : '◇'}</i>${esc(g.text)}${p && !ok ? ` <em>${Math.floor(p[0])}/${p[1]}</em>` : ''}${note ? ` <em>${esc(note)}</em>` : ''}${pay ? ' <em>(tap to pay)</em>' : ''}</span>`; }).join('');
  html += questsHUD(!!html);
  if (!html) { el.hidden = true; return; }
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = false;
}
// tapping it opens the journal: at the cast's page if someone is waiting for a word or a gift, else the story
const journalOpen = () => UI.open('journal', { tab: (questsWaiting().length || questsGiveReady()) && !storyPayReady() ? 'cast' : 'story' });
$('#journal').onclick = journalOpen;
$('#journal').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); journalOpen(); } };
UI.jtab = 'story';
UI.journal = function (body, ref) {
  if (ref && ref.tab) { UI.jtab = ref.tab; UI.cur.ref = null; }
  body.append(this.h(`<h2>Journal</h2><p class="sub">The story of the claim so far, the people in it, and its days.</p>`));
  const live = questsWaiting().length;
  const tabs = this.h(`<div class="tabs" role="group" aria-label="Show"><button type="button" data-t="story">Story</button><button type="button" data-t="cast">The cast${live ? ` · ${live} new` : ''}</button><button type="button" data-t="days">Days and mood</button><button type="button" data-t="codex">Codex · ${STORY.codex.length}</button></div>`);
  for (const bt of tabs.querySelectorAll('button')) { bt.setAttribute('aria-pressed', bt.dataset.t === UI.jtab); bt.onclick = () => { UI.jtab = bt.dataset.t; this.refresh(); }; }
  body.append(tabs);
  if (UI.jtab === 'cast') return questsJournal(this, body);
  if (UI.jtab === 'days') { moodJournal(this, body); daysJournal(this, body); return; }
  if (UI.jtab === 'codex') {
    if (!STORY.codex.length) body.append(this.h(`<p class="small">Nothing here yet. The codex fills up as the story goes on.</p>`));
    for (const k of [...STORY.codex].reverse()) if (CODEX[k]) body.append(this.h(`<p><b>${esc(CODEX[k].title)}.</b> ${esc(CODEX[k].text)}</p>`));
    return;
  }
  let act = null;
  CHAPTERS.forEach((C, i) => {
    if (i > STORY.ch) return;
    if (actOf(i) !== act) { act = actOf(i); body.append(this.h(`<p class="eyebrow jr-act">Act ${act}</p>`)); }
    const cur = i === STORY.ch;
    body.append(this.h(`<h3>${i ? `Chapter ${i}` : 'Prologue'} · ${esc(C.title)}${cur ? '' : ' ✓'}</h3><p class="small">${esc(C.line)}</p>`));
    if (cur && STORY.started) {
      const ul = this.h(`<ul class="traits">${C.goals.map(g => { const p = g.prog && g.prog(), ok = STORY.ready || g.done(), note = !ok && g.note && g.note(); return `<li>${ok ? '✓ ' : ''}${esc(g.text)}${p && !ok ? ` (${Math.floor(p[0])} of ${p[1]})` : ''}${note ? ` · ${esc(note)}` : ''}</li>`; }).join('')}</ul>`).firstElementChild;
      // a goal paid for from here: the filing fee, food for Hollowcrest's people (pace.js)
      C.goals.forEach((g, gi) => {
        if (!g.cost || STORY.ready || g.done()) return;
        const can = canGive(g.cost), bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn' + (can ? ' primary' : '');
        bt.disabled = !can; bt.textContent = `Pay ${giveText(g.cost)}`; bt.onclick = () => { storyPay(gi); this.refresh(); };
        ul.children[gi].append(' ', bt);
      });
      body.append(ul);
    }
  });
  if (STORY.ch >= CHAPTERS.length) body.append(this.h(`<p class="small jr-end">The story so far ends here: Brightvein is a free town, with a heart under it, asleep. More chapters are coming. Days on the claim go on, and so do the cast’s own stories.</p>`));
};
