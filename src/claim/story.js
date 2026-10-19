// ===================================================================== STORY: the claim's chapters, its visitors, the codex
// Brightvein's own story (docs/story.md): the founders stake the claim, the Wildlight come up the cliffs, and Baron
// Ambrose Tallow, whose candle-works the sunstone claims are putting out of business, sends his claim-jumpers. Along
// the way Io and Sol come in on the Magpie, Quill and Tock follow, Brann wants his forge back, and the Moon Faire
// tours in for a festival night. Visitors can stay as crew, each with a gift for the claim (CAST_PERKS).
// Each chapter opens with a scene, sets a few goals the player can see in the journal, and closes with a scene and a
// reward. Scenes pause the claim. The story's state is saved with the claim as `story`.
const STORY = { ch: 0, started: false, at: null, codex: [], done: [], queue: [], shown: null };

// who can speak: the six founders (found among the claim's people by name), the cast, and the Baron (by letter)
const WHO = {
  hesper: { name: 'Hesper Lark', founder: 'Hesper Lark' }, odile: { name: 'Odile Fenn', founder: 'Odile Fenn' },
  pip: { name: 'Pip Kettleby', founder: 'Pip Kettleby' }, marigold: { name: 'Marigold Thresh', founder: 'Marigold Thresh' },
  corwin: { name: 'Corwin Ashlar', founder: 'Corwin Ashlar' }, absalom: { name: 'Absalom Pockett', founder: 'Absalom Pockett' },
  io: { name: 'Io', hero: 'io' }, sol: { name: 'Sol', hero: 'sol' }, quill: { name: 'Quill', hero: 'quill' }, tock: { name: 'Tock', hero: 'tock' },
  brann: { name: 'Brann', hero: 'brann' }, jester: { name: 'The Jester', hero: 'jester' }, ranger: { name: 'The Ranger', hero: 'ranger' },
  herbal: { name: 'The Herbal Witch', hero: 'herbal' }, fox: { name: 'The Fox', hero: 'fox' },
  tallow: { name: 'Baron Ambrose Tallow', letter: true },
};

// the cast as crew: their stats, trade, trait and the gift they bring the whole claim while they're on it
const CAST_CREW = {
  io: { stats: { G: 4, E: 6, A: 6, R: 9, S: 9 }, trait: 'Warm', pref: 'garden', perk: 'Moonlore', perkText: 'The lamps burn a third less charge at night.' },
  sol: { stats: { G: 10, E: 4, A: 7, R: 4, S: 3 }, trait: 'Bold', pref: 'wall', perk: "Warden's drill", perkText: 'Everyone on the watch hits a quarter harder.' },
  quill: { stats: { G: 5, E: 7, A: 8, R: 7, S: 4 }, trait: 'Steady', pref: 'mast', perk: 'Old skyman', perkText: 'Voyages bring home a tenth more shards.' },
  tock: { stats: { G: 3, E: 10, A: 6, R: 5, S: 4 }, trait: 'Tinkerer', pref: 'shop', perk: 'Gnome mirrors', perkText: 'The sunning yards charge a fifth faster.' },
  brann: { stats: { G: 9, E: 8, A: 4, R: 5, S: 3 }, trait: 'Steady', pref: 'head', perk: "Smith's edge", perkText: 'Every weapon on the claim hits a tenth harder.' },
  fox: { stats: { G: 4, E: 5, A: 9, R: 8, S: 6 }, trait: 'Sharp-eyed', pref: 'yard', perk: "Fox's luck", perkText: 'Miners and travellers find more.' },
};
const castHere = id => GAME.villagers.some(v => v.d.hero === id && !v.d.exp);
const castPerk = id => CAST_CREW[id] && castHere(id);

const CODEX = {
  claim: { title: 'The Brightvein claim', text: 'A seam of raw sunstone broke the surface on a high plateau in the Ironspire Peaks, just under the Thinning. Whoever stakes it first owns it, as long as they can hold it.' },
  wildlight: { title: 'The Wildlight', text: 'Loose light, the old prospectors called it: sunstone glow that has come away from its stone and wanders. Glimmers, Flarehounds, Lodestars. They climb toward anything brighter than themselves, and drink it. They hate smoked glass and the ring of a tuning fork.' },
  sunstone: { title: 'Sunstone', text: 'Raw, it is dull amber rock. Laid out in the sun it charges, and charged it lifts ships, lights towns and fires the lens towers. Shards of it are Aethermoor’s money.' },
  tallow: { title: 'Baron Ambrose Tallow', text: 'He made his fortune in candles and lamp oil, back when the dark was cheap to sell against. Every sunstone claim that opens puts more of his wicks out of work, so he jumps them. His crews fly rust-red sails; his citadel is the Chandlery, a candle-works on a lifted rock.' },
  magpie: { title: 'The Magpie', text: 'Io’s ship: small, black-hulled and quick, with a lantern on the bowsprit. Quill gave her to Io. Tock keeps her in the air.' },
  wardens: { title: 'The Ember Wardens', text: 'An old order who walked the sunstone roads, kept the nodes lit and escorted sunstone to the shipyards. Each took a bird’s name at the oath. Sol is the last of them.' },
  wickmoor: { title: 'The Wickmoor', text: 'Tallow’s supply galleon: fat, slow and full of other people’s things. Shoot her sails and she strikes her colours. Sink her and her crates go down with her.' },
  moonfaire: { title: 'The Moon Faire', text: 'A travelling festival on a painted airship, run by four witches who each answer to a phase of the moon. They follow the brightest lights.' },
  deepseam: { title: 'The deep seam', text: 'Below the lower gallery the vein runs on, brighter and older. At night it hums. Something down there wakes when the seam is opened.' },
  chandlery: { title: 'The Chandlery', text: 'Tallow’s fortress: stone works and tall chimneys on a great lifted rock, with a candle burning on its roof. Taken, it stands dark.' },
};

// ---- the goals the chapters set (each: text, done(), and progress [have, need] where it helps)
const sinceStart = k => (STORY.at ? (k === 'nights' ? GAME.nights - STORY.at.nights : 0) : 0);
const raided = id => FLEET && FLEET.data.raids[id] && FLEET.data.raids[id].won > 0;
const GOAL = {
  nights: (n, text) => ({ text: text || `See out ${n === 1 ? 'the first night' : n + ' nights'}`, done: () => GAME.nights >= n, prog: () => [Math.min(n, GAME.nights), n] }),
  nightsHere: (n, text) => ({ text, done: () => sinceStart('nights') >= n, prog: () => [Math.min(n, sinceStart('nights')), n] }),
  shards: n => ({ text: `Have ${n} shards in the stores`, done: () => GAME.shards >= n, prog: () => [Math.min(n, Math.floor(GAME.shards)), n] }),
  build: (type, n, text) => ({ text, done: () => byType(type).length >= n, prog: () => [Math.min(n, byType(type).length), n] }),
  level: (id, lv, text) => ({ text, done: () => (TOWN.b[id] && TOWN.b[id].level >= lv && !TOWN.b[id].building), prog: null }),
  raid: (id, text) => ({ text, done: () => raided(id), prog: null }),
  people: (n) => ({ text: `Have ${n} people on the claim`, done: () => GAME.villagers.length >= n, prog: () => [Math.min(n, GAME.villagers.length), n] }),
  ship: (ids, text) => ({ text, done: () => FLEET && ids.some(id => FLEET.data.ships[id].owned), prog: null }),
  jobs: (ids, text) => ({ text, done: () => ids.every(id => GAME.villagers.some(v => v.d.hero === id && v.d.job)), prog: () => [ids.filter(id => GAME.villagers.some(v => v.d.hero === id && v.d.job)).length, ids.length] }),
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
  { id: 'firstlight', title: 'First Light', line: 'Every tray charged makes the claim brighter, and every night more of them come.',
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
  { id: 'magpie', title: 'The Magpie', line: 'A small black ship with a lantern on her bowsprit comes in at dusk.',
    visit: { ship: 'magpie', cast: ['io', 'sol'] },
    open: [
      ['pip', 'Ship off the north rim! Small, black hull, a lantern on the bowsprit. She’s not one of Tallow’s.'],
      ['io', 'Hello! Sorry. Hello. We saw your light from the far side of the peaks. I thought a star had come down.'],
      ['sol', 'She thought that. I thought it was a fire.'],
      ['io', 'I’m Io. I keep a Moonwell, a long way west of here. This is Sol. She’s a Warden.'],
      ['sol', 'The last one. Wardens walked the sunstone roads, once, and kept the light where it belonged. Somebody ought to keep yours.'],
      ['hesper', 'We could use the help. There’s a baron who wants our light, and something that climbs the cliffs every night that wants it more.'],
      ['io', 'The Wildlight. We saw them on the rim as we came in. They seemed… lost. Light with nowhere to go.'],
      ['sol', 'Lost or not, they bite. Give me your watch for a week.'],
    ],
    goals: [GOAL.jobs(['io', 'sol'], 'Give Io and Sol a job each (tap them)'), GOAL.nightsHere(1, 'Hold the claim through a night with them')],
    close: [
      ['io', 'The Magpie’s crystals are cracked. Odile says she can recut them, if we stay a while.'],
      ['odile', 'Beautiful stones. Badly treated.'],
      ['sol', 'We’re staying a while.'],
    ],
    reward: { shards: 60, codex: ['magpie', 'wardens'], crew: ['io', 'sol'] } },
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
      ['io', 'Quill! He gave me the Magpie. And Tock keeps her in the air.'],
      ['quill', 'Tallow’s been buying up every shipwright between here and the coast. Tock’s the one he couldn’t buy.'],
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
  { id: 'moonfaire', title: 'The Moon Faire', line: 'A painted airship tours in for a festival night.',
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
    ],
    reward: { shards: 200, codex: ['deepseam'] } },
  { id: 'chandlery', title: 'The Chandlery', line: 'Every crew Tallow has left is at his citadel.',
    open: [
      ['hesper', 'Every crew Tallow has left is at the Chandlery. Six gun towers, his frigate and a Man-o’-war.'],
      ['sol', 'Then we need a bigger ship.'],
      ['tock', 'I know a brig. I know a frigate. I know a shipyard. You know where the shards are.'],
    ],
    goals: [GOAL.ship(['brig', 'frigate'], 'Own a Brig or a Frigate (Shipyard)'), GOAL.raid('citadel', 'Take the Chandlery')],
    close: [
      ['tallow', 'Very well. The plateau is yours. You will find, as I did, that light is a hungry thing to keep. — A. T.'],
      ['hesper', 'The Chandlery’s dark. The Ironspire’s ours.'],
      ['io', 'Your lamps look like a constellation from up here.'],
      ['odile', 'Listen. The seam’s still singing.'],
    ],
    reward: { shards: 400, codex: ['chandlery'] } },
];

// ---- saving
function storySave() { return { ch: STORY.ch, started: STORY.started, at: STORY.at, codex: STORY.codex, done: STORY.done }; }
function storyLoad(s) {
  if (!s) return;
  Object.assign(STORY, { ch: s.ch || 0, started: !!s.started, at: s.at || null, codex: s.codex || [], done: s.done || [] });
  // the cast keep their latest looks
  for (const v of GAME.villagers) if (v.d.hero && HERO_LOOKS[v.d.hero]) { v.d.look = { ...HERO_LOOKS[v.d.hero] }; v.redraw(); }
  const C = CHAPTERS[STORY.ch];
  if (C && STORY.started && C.visit && C.visit.ship) visitShip(C.visit.ship, true);
  if (GAME.villagers.some(v => v.d.hero === 'io' || v.d.hero === 'sol')) visitShip('magpie', true);
}

// ---- visitors: their ship comes in east of the Sky Dock, and they walk down the bridge into town
const VISIT = { ships: {} };
function visitShip(kind, quiet) {
  if (VISIT.ships[kind] || !SKY || !SKY.shipArt) { if (!VISIT.ships[kind] && SKY) SKY.art.then(() => visitShip(kind, quiet)); return; }
  const R = SHIPS.find(s => s.id === (kind === 'faire' ? 'brig' : 'cutter')), s = buildShipAt(R, 'middle', SKY.shipArt);
  if (kind === 'faire') s.body.traverse(o => { if (o.isMesh && o.name === 'canvas') { o.material = o.material.clone(); o.material.color.set(0xd88ad0); } });
  const D = LAYOUT.dock, at = kind === 'faire' ? new THREE.Vector3(D.x - 34, 9, D.z - 18) : new THREE.Vector3(D.x + 30, 7, D.z - 13);
  s.root.position.copy(at); s.root.rotation.y = kind === 'faire' ? -Math.PI / 2 : Math.PI / 2;
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
// the cast come ashore as people of the claim (they don't take beds: they sleep aboard)
function castArrive(ids) {
  const D = LAYOUT.dock;
  for (const id of ids) {
    if (GAME.villagers.some(v => v.d.hero === id) || !HERO_LOOKS[id]) continue;
    const L = HERO_LOOKS[id], C = CAST_CREW[id] || { stats: { G: 5, E: 5, A: 6, R: 8, S: 5 }, trait: 'Warm', pref: null };
    const d = { id: GAME.nextId++, hero: id, name: L.name, title: L.title.replace(/^the /, 'The '), stats: { ...C.stats }, trait: C.trait, look: { ...L }, named: true, job: null, home: 'keep', gear: {}, pref: C.pref || null, guest: !CAST_CREW[id] };
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

// ---- the story's clock: open the chapter, watch its goals, close it
let storyT = 0;
function storyTick(dt) {
  if (!started || !BUILD.setupDone) return;
  updateVisits(dt);
  if ((storyT -= dt) > 0 || STORY.shown || (SKY && SKY.on) || BUILD.on) return;
  storyT = 0.5;
  if (STORY.queue.length) return playScene(STORY.queue.shift());
  const C = CHAPTERS[STORY.ch]; if (!C) return;
  if (!STORY.started) {
    STORY.started = true; STORY.at = { day: GAME.day, nights: GAME.nights };
    if (C.visit) { if (C.visit.ship) visitShip(C.visit.ship); castArrive(C.visit.cast || []); }
    playScene({ lines: C.open, title: C.title, chapter: STORY.ch });
    journalHUD(); return;
  }
  journalHUD();
  if (C.goals.every(g => g.done())) {
    const R = C.reward || {};
    if (C.visitAfter) castArrive(C.visitAfter.cast || []);
    playScene({ lines: C.close, after: () => {
      if (R.shards) GAME.shards += R.shards;
      for (const k of R.codex || []) if (!STORY.codex.includes(k)) STORY.codex.push(k);
      if (C.leave) castLeave(C.leave);
      STORY.done.push(C.id);
      toast(`<b>${esc(C.title)}</b>: chapter done${R.shards ? ` · ${SHARD} ${R.shards}` : ''}${(R.crew || []).length ? ` · ${R.crew.map(id => HERO_LOOKS[id].name).join(' and ')} join${R.crew.length > 1 ? '' : 's'} the crew` : ''}${(R.codex || []).length ? ' · new in the journal' : ''}.`);
      AUDIO.play('dawn');
      STORY.ch++; STORY.started = false; STORY.at = null; storyT = 6;
      journalHUD(); saveGame();
    } });
  }
}

// ---- scenes: a portrait, a name and the words, one line at a time. Tap to go on; the claim waits meanwhile.
function speakerPortrait(key, size = 120) {
  const W = WHO[key];
  if (W.letter && ART.portraits && ART.portraits['baron-tallow']) { const w = document.createElement('div'); w.className = 'pframe painted'; w.style.width = w.style.height = size + 'px'; const im = new Image(); im.src = ART.portraits['baron-tallow']; w.append(im); return w; }
  if (W.letter) {
    const wrap = document.createElement('div'); wrap.className = 'pframe letter'; wrap.style.width = wrap.style.height = size + 'px';
    wrap.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="14" width="44" height="36" rx="2" fill="#efe2c4" stroke="#6a4a2a" stroke-width="2"/><path d="M10 16l22 18 22-18" fill="none" stroke="#6a4a2a" stroke-width="2"/><circle cx="32" cy="40" r="8" fill="#9a2a1e" stroke="#4a120c" stroke-width="2"/><path d="M29 37h6M29 43h6M32 35v10" stroke="#e8b0a0" stroke-width="1.5"/></svg>';
    return wrap;
  }
  const v = GAME.villagers.find(x => (W.hero && x.d.hero === W.hero) || (W.founder && x.d.name === W.founder));
  if (v) return portraitOf(v, size);
  if (W.hero && ART.cast && ART.cast[W.hero]) { const w = document.createElement('div'); w.className = 'pframe'; w.style.width = w.style.height = size + 'px'; const im = new Image(); im.src = ART.cast[W.hero]; w.append(im); return w; }
  const w = document.createElement('div'); w.className = 'pframe'; w.style.width = w.style.height = size + 'px'; return w;
}
const TALK = { lines: null, i: 0, typing: 0, full: '', after: null };
function playScene(sc) {
  STORY.shown = sc; TALK.lines = sc.lines.filter(([k]) => WHO[k]); TALK.i = 0; TALK.after = sc.after || null;
  GAME.talk = true; UI.close();
  $('#talk').hidden = false; $('#talk-title').textContent = sc.title ? `Chapter ${sc.chapter} · ${sc.title}` : ''; $('#talk-title').hidden = !sc.title;
  if (sc.chapter === 0) $('#talk-title').textContent = `Prologue · ${sc.title}`;
  showLine();
}
function showLine() {
  const [k, text] = TALK.lines[TALK.i], W = WHO[k];
  const por = $('#talk-por'); por.innerHTML = ''; por.append(speakerPortrait(k, 128));
  $('#talk-name').textContent = W.name; TALK.full = text; TALK.typing = 0; $('#talk-text').textContent = '';
  $('#talk').classList.toggle('letter', !!W.letter);
  AUDIO.play('tap');
}
function talkFrame(dt) {
  if (!STORY.shown || TALK.typing >= TALK.full.length) return;
  TALK.typing = Math.min(TALK.full.length, TALK.typing + dt * 60);
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

// ---- the journal: the chapter and its goals on screen, and a panel with the story so far and the codex
function journalHUD() {
  const el = $('#journal'), C = CHAPTERS[STORY.ch];
  if (!started || !BUILD.setupDone || !C || !STORY.started) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<b>${STORY.ch ? `Chapter ${STORY.ch}` : 'Prologue'} · ${esc(C.title)}</b>` + C.goals.map(g => { const ok = g.done(), p = g.prog && g.prog(); return `<span class="${ok ? 'ok' : ''}"><i>${ok ? '✓' : '◇'}</i>${esc(g.text)}${p && !ok ? ` <em>${p[0]}/${p[1]}</em>` : ''}</span>`; }).join('');
}
$('#journal').onclick = () => UI.open('journal');
UI.journal = function (body) {
  body.append(this.h(`<h2>Journal</h2><p class="sub">The story of the claim so far.</p>`));
  CHAPTERS.forEach((C, i) => {
    if (i > STORY.ch) return;
    const cur = i === STORY.ch;
    body.append(this.h(`<h3>${i ? `Chapter ${i}` : 'Prologue'} · ${esc(C.title)}${cur ? '' : ' ✓'}</h3><p class="small">${esc(C.line)}</p>`));
    if (cur && STORY.started) body.append(this.h(`<ul class="traits">${C.goals.map(g => `<li>${g.done() ? '✓ ' : ''}${esc(g.text)}</li>`).join('')}</ul>`));
  });
  const crew = Object.keys(CAST_CREW).filter(castHere);
  if (crew.length) {
    body.append(this.h(`<h3>The cast on the claim</h3>`));
    for (const id of crew) body.append(this.h(`<p><b>${esc(HERO_LOOKS[id].name)}</b> · ${esc(CAST_CREW[id].perk)}: ${esc(CAST_CREW[id].perkText)}</p>`));
  }
  if (STORY.codex.length) {
    body.append(this.h(`<h3>Codex</h3>`));
    for (const k of STORY.codex) if (CODEX[k]) body.append(this.h(`<p><b>${esc(CODEX[k].title)}.</b> ${esc(CODEX[k].text)}</p>`));
  }
};
