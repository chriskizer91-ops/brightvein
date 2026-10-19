// ===================================================================== ACT TWO: the money behind the Baron, and the heart under the claim
// After the Chandlery falls (docs/story.md):
//    9 Silver Sails         the Gilded Exchange, which held Tallow's notes, comes to buy the claim; Absalom's answer is a charter
//   10 Charter Night        the claim votes (one of its own settlers speaks against), with the Moon Faire back for the night
//   11 Hollowcrest          a rival claim across the gorge, on the Exchange's money; the Plumbline survey rig and its maps
//   12 The Thinwatch's Oath Seraphine tells what the deep seam is: the Heartlight, and what the Wildlight are to it
//   13 Storm Season         the Aether storms come; Hollowcrest is wrecked and its people come over; the Grindstone is seen
//   14 The Long Bright Night the Grindstone drills for the heart: sink it in the skies, hold the mine, calm the Warden
// Also here: ACT, the tallies the story and the cast's stories count from (nights, bosses, trips, bolts, events), and
// the two ticks that keep the days going: lifeTick (game time, from main.js) and actFrame (every frame, from storyTick).
const ACT_TWO = 9;
const ACT = { tally: { nights: 0, lodestar: 0, bosses: 0, brightmaws: 0, events: 0, bolts: 0, trip0: 0, trip1: 0, trip2: 0, trip3: 0 },
  charter: false, wardenDown: false, lastNight: 0, lastStorm: -99, convoy: null, offerDay: null, dayCharge: 0, day: 0, lastRecruit: 0, checkT: 0, rods: new WeakMap() };

// ---- act two's new faces (their looks and picture prompts are in folk.js, FOLK_OTHERS)
WHO.marchbank = { name: FOLK_OTHERS['provost-marchbank'].name, portrait: 'provost-marchbank', look: FOLK_OTHERS['provost-marchbank'].look };
WHO.ledger = { name: FOLK_OTHERS['provost-marchbank'].name, letter: true, portrait: 'provost-marchbank', look: FOLK_OTHERS['provost-marchbank'].look };
WHO.juno = { name: FOLK_OTHERS['captain-ferrars'].name, portrait: 'captain-ferrars', look: FOLK_OTHERS['captain-ferrars'].look };

Object.assign(CODEX, {
  exchange: { title: 'The Gilded Exchange', text: 'A counting-house in the coast cities that decides what a sunstone shard is worth. It lent Baron Tallow the money for his crews. A seam as rich as Brightvein’s makes shards cheaper, and the Exchange does not like anything that makes money cheaper.' },
  charter: { title: 'The Ironspire Compact', text: 'The old agreement between the claims of the Ironspire. A claim filed under it as a free town, with a hall, a vote and enough people to hold one, belongs to the people who live on it. No bank can buy it, and no baron can jump it. Not legally, anyway.' },
  vote: { title: 'Charter Night', text: 'The night Brightvein voted to be a free town, with the Moon Faire in the gallery. For: nearly everyone. Against: four, and a goat that wandered in.' },
  hollowcrest: { title: 'Hollowcrest', text: 'The dry flat-top across the gorge to the east, where Juno Ferrars dug in on the Exchange’s money. There was never much under it. That was never the point.' },
  survey: { title: 'The Plumbline', text: 'The Exchange’s survey rig: brass derricks and long drills, moored off Hollowcrest. Its maps were not of Hollowcrest at all. They were of the deep seam under Brightvein, drawn from the side.' },
  heartlight: { title: 'The Heartlight', text: 'Every deep seam has a heart: one stone, older than the mountain, holding the first light the seam ever drank. The Wildlight are its light, wandering. A Brightmaw is the heart reaching up to see who is digging. Take the heart, and every crystal in the seam goes grey.' },
  oath: { title: 'The Thinwatch’s oath', text: '“Dig no deeper than the light allows, and take nothing from the heart.” In the margin of the old book, in another hand: a drawing of a lamp, and the words “sing it the seam’s own note, and it sleeps.”' },
  storms: { title: 'Storm season', text: 'Once a year the Aether storms climb the Ironspire from the coast, and for a fortnight the sky is purple and loud. A Lightning Rod’s brine jar turns each bolt into shards. Hollowcrest had no rods.' },
  grindstone: { title: 'The Grindstone', text: 'The Exchange’s dredge: a great galleon with a drill on her bow the size of a lens tower, built to cut into a seam from the side, under someone else’s claim.' },
  warden: { title: 'The Warden of the Heart', text: 'The seam’s first light, woken by the Grindstone’s drill: a Brightmaw so old it glows white. It did not want to hurt anyone. It wanted the digging to stop. Odile’s lens rang the seam’s own note, and it went back down to sleep.' },
  freetown: { title: 'Brightvein, a free town', text: 'Chartered under the Ironspire Compact, held through the Long Bright Night, and owned by the people who live on it. The Exchange has withdrawn its interest. The heart under the claim sleeps.' },
  quietlamp: { title: 'The Quiet Lamp', text: 'A lamp that calms the Wildlight instead of burning them, its lens ground to the seam’s own note. Tamsin says they aren’t hungry, they’re homesick, and the lamp tells them which way is home.' },
  brassroad: { title: 'The Brass Road, again', text: 'The convoy company’s last strongbox, and its ledger of every route that ever ran. Brisa got one convoy going again: Brightvein to the coast, every few days, with news and shards.' },
  vigil: { title: 'Seraphine’s vigil', text: 'The Thinwatch is not one knight with a sword. It is anyone who keeps the watch. Seraphine took up her vows again on Brightvein’s wall, and teaches them in the Drill Yard.' },
  gannet: { title: 'The Gannet', text: 'Barnabus’s first ship: a little cutter he put down in the wreck fields forty years ago. Nib patched her. Her rudder is the right size.' },
  mirrors: { title: 'Nib’s mirrors', text: 'Silvered Cut Glass on brass poles round every sunning yard, angled to catch the low morning sun and whatever light gets through the cloud.' },
  forge: { title: 'Pike’s forge', text: 'Torvald’s forge: bought out from under him by Tallow, carried off on the Wickmoor, and lit again in Brightvein with a lump of Heartstone and a proper chimney.' },
  cards: { title: 'Clem’s cards', text: 'Clem reads them every morning over breakfast, mostly to win pies. They say what tomorrow holds. Once a week Clem shuffles them, and a bad day never happens. Don’t ask how.' },
  wildcub: { title: 'Wildlight cubs', text: 'Glimmers are born small, from the sparks of bigger Wildlight. Left behind on the plateau at dawn, a cub curls up on anything warm and whimpers like a kettle. It drinks about a shard a night.' },
  skywhale: { title: 'Sky-whales', text: 'They swim the cloud sea under the Thinning, as long as a plateau and as slow as a sunset. Nobody knows what they eat. Their song is one low note you can feel in your teeth.' },
  deadclaims: { title: 'Dead claims', text: 'Now and then a seam goes grey all at once, in one night, as if the light just left. The claim on it dies with it. The old prospectors blamed bad luck. The Thinwatch knew better.' },
  ledger: { title: 'The Exchange’s ledger', text: 'The Exchange counts everything: lamps, shards, ships, people. Mostly people. A claim with more people than lamps can be bought. A claim with more lamps than people is worth buying.' },
});

// ---- goals that use the rest of the game: the Keep's studies, the mood, the wilds, Bright Nights, the weather, the mine
// people working the mine: at the headframe, or in the dig's rooms (mine.js, when it's there)
function mineCrew() {
  let n = 0;
  for (const v of GAME.villagers) {
    const j = v.d.job; if (!j || v.d.exp) continue;
    if (j.bid === 'head' || (typeof DIG !== 'undefined' && DIG && DIG.byId && DIG.byId[j.bid])) n++;
  }
  return n;
}
Object.assign(GOAL, {
  peopleT: (n, text) => ({ text, done: () => GAME.villagers.length >= n, prog: () => [Math.min(n, GAME.villagers.length), n] }),
  room: (k, text) => ({ text, done: () => GAME.rooms.some(r => r.type === k), prog: null }),
  mood: (n, text) => ({ text, done: () => MOOD.v >= n, prog: () => [Math.min(n, Math.round(MOOD.v)), n] }),
  food: n => ({ text: `Have ${n} food in the stores`, done: () => GAME.food >= n, prog: () => [Math.min(n, Math.floor(GAME.food)), n] }),
  shardsT: (n, text) => ({ text, done: () => GAME.shards >= n, prog: () => [Math.min(n, Math.floor(GAME.shards)), n] }),
  trip: (z, text) => ({ text, done: () => sinceCh('trip' + z) >= 1, prog: null }),
  boss: text => ({ text, done: () => sinceCh('bosses') >= 1, prog: null }),
  bolts: (n, text) => ({ text, done: () => sinceCh('bolts') >= n, prog: () => [Math.min(n, sinceCh('bolts')), n] }),
  mineCrew: (n, text) => ({ text, done: () => mineCrew() >= n, prog: () => [Math.min(n, mineCrew()), n] }),
  warden: text => ({ text, done: () => ACT.wardenDown, prog: null }),
});

// ---- the chapters
CHAPTERS.push(
  { id: 'silversails', title: 'Silver Sails', line: 'The money that backed Tallow comes to call.', actStart: 'two', ship: 'exchange',
    open: [
      ['pip', 'Ship off the north rim! Silver sails, grey hull. She’s flying a flag with a coin on it.'],
      ['absalom', 'A coin on a flag. Oh dear. That is never a social call.'],
      ['marchbank', 'Good morning. Lucan Marchbank, Provost of the Gilded Exchange. Please, don’t get up. Ah. You were already up.'],
      ['marchbank', 'The Exchange held Baron Tallow’s notes. His ships, his crews, his debts, and his claim on every seam in the Ironspire. Which, since breakfast, includes yours.'],
      ['hesper', 'You paid for his crews. You paid for every raid on this plateau.'],
      ['marchbank', 'We lend money. What people do with it is their own affair. Mostly.'],
      ['marchbank', 'Two thousand shards for the claim, today. Or the Exchange takes a third of every tray, for ever. I shall wait off the rim. I am very good at waiting. It is most of banking.'],
      ['corwin', 'No.'],
      ['absalom', 'There is one thing no bank can buy: a charter. Brightvein filed under the Ironspire Compact as a free town. Then the land is ours by law, not just by lance.'],
      ['absalom', 'It needs a Parlour to meet in, enough people to count as a town, and a filing fee. The fee is large. Lawyers are expensive. I am one, so I would know.'],
    ],
    goals: [GOAL.peopleT(24, 'Have 24 people on the claim: enough to count as a town'), GOAL.room('R', 'Furnish a Parlour in the Keep to meet in (Keep › an empty room)'), GOAL.shardsT(600, 'Have 600 shards for the filing fee')],
    close: [
      ['absalom', 'The charter. Drafted, stamped, and stamped again for luck. Now the whole claim has to vote on it.'],
      ['ledger', 'A vote. How charming. Do let me know how it turns out. I shall be counting. — L. M., for the Gilded Exchange'],
      ['hesper', 'He’s going to be trouble.'],
      ['sol', 'He’s already trouble. He’s just polite about it.'],
    ],
    reward: { shards: 150, codex: ['exchange', 'charter'] } },
  { id: 'charter', title: 'Charter Night', line: 'The claim votes on its charter, and the Moon Faire comes back to see it done.', festival: true,
    visit: { ship: 'faire', cast: ['jester', 'ranger', 'herbal'] },
    open: [
      ['voice', 'Two thousand shards, the man said. Split between all of us, that’s a good pair of boots each, and a ship off this rock.'],
      ['marigold', 'And then what? Somebody else’s boots on our plateau, and somebody else’s hands on my bees.'],
      ['voice', 'I’m only saying what half the Keep says at supper.'],
      ['hesper', 'Then we vote. Everyone with a bed in the Keep gets a say, and whatever the count says, we do.'],
      ['jester', 'And a vote needs an audience! Brightvein, the Moon Faire has come back for Charter Night!'],
      ['herbal', 'We saw your beacon from the coast and heard there was going to be a vote. We love a vote. Everyone shouts.'],
      ['fox', 'I told them about the pies.'],
      ['absalom', 'People vote the way they feel. Keep them fed, keep them warm and keep the lamps lit, and the charter carries itself.'],
    ],
    goals: [GOAL.mood(60, 'Make the claim happy: mood 60 or more (the face by the people count)'), GOAL.food(120), GOAL.nightsHere(1, 'See out Charter Night')],
    close: [
      ['absalom', 'The count is in. For the charter: nearly everyone. Against: four, and a goat that wandered in.'],
      ['voice', 'I still think you’re all mad. But it’s our mad. I’ll sign.'],
      ['ranger', 'Brightvein, a free town! Somebody fetch a bigger flag.'],
      ['ledger', 'My congratulations on your little charter. A charter guards the land. It says nothing at all about what is under the land. — L. M.'],
      ['odile', 'And what’s under it is singing louder every night.'],
    ],
    leave: ['jester', 'ranger', 'herbal'],
    onClose() { ACT.charter = true; moodKeep('charter', 5, 'Brightvein is a free town'); },
    reward: { shards: 200, codex: ['vote'] } },
  { id: 'hollowcrest', title: 'Hollowcrest', line: 'A rival claim opens across the gorge, with the Exchange’s money behind it.',
    open: [
      ['pip', 'Smoke to the east! Somebody’s dug in on Hollowcrest, the flat-top across the gorge.'],
      ['juno', 'Morning, neighbours! Juno Ferrars, of the Hollowcrest claim. Nice lamps. Mine will be brighter by spring.'],
      ['hesper', 'Hollowcrest is dry rock. There isn’t a seam under it worth a shovel.'],
      ['juno', 'That’s what you think. My backers think otherwise, and they’ve paid for a great many shovels.'],
      ['sol', 'Her backers fly silver sails. Their crews have been circling our rim since dawn.'],
      ['tock', 'And there’s a survey rig moored off her rock. Brass derricks. Very long drills. You don’t need long drills for dry rock.'],
      ['halcyon', 'Long drills are for going sideways. Under someone else’s claim.'],
      ['hesper', 'Then let’s go and look at their maps. Sky Dock, Raids.'],
    ],
    goals: [GOAL.raid('survey', 'Take the Plumbline, the Exchange’s survey rig (Sky Dock › Raids)'), GOAL.trip(1, 'Scout below Hollowcrest: send someone to the gorse moors and home again'), GOAL.build('lens', 3, 'Three Lens Towers, against the Exchange’s crews')],
    close: [
      ['tock', 'Survey maps! Look. They’re not of Hollowcrest at all. They’re of us. Under us. All the way down to the deep seam, drawn from the side.'],
      ['juno', '…They told me they wanted a second claim in the Ironspire. They said I could keep whatever I dug.'],
      ['juno', 'They paid me to dig next door so they could watch yours. I’m the fence they were hiding behind.'],
      ['hesper', 'You can still keep what you dig. Dig it as a neighbour.'],
      ['juno', 'Neighbours. Fine. But my lamps will still be brighter.'],
      ['halcyon', 'These marks on the deepest map. The Thinwatch drew marks like these. They are not after your sunstone. They are after what is under it.'],
    ],
    reward: { shards: 220, codex: ['hollowcrest', 'survey'] } },
  { id: 'oath', title: 'The Thinwatch’s Oath', line: 'Seraphine tells the claim what the Thinwatch really kept watch over.',
    open: [
      ['halcyon', 'I owe you the truth. The Thinwatch did not only hunt Brightmaws. We kept watch over what they come from.'],
      ['halcyon', 'Every deep seam has a heart: one stone, older than the mountain, holding the first light the seam ever drank. We called it the Heartlight.'],
      ['io', 'And the Wildlight?'],
      ['halcyon', 'Its light, wandering. Pieces of it, climbing toward anything that looks like the sun. A Brightmaw is the heart itself, reaching up to see who is digging.'],
      ['io', 'So they’re not hungry. They’re homesick.'],
      ['absalom', 'And what would a bank want with a very old stone?'],
      ['halcyon', 'Take the heart out of a seam and every crystal in it goes grey. Dead. And the one stone is worth more than a city.'],
      ['hesper', 'So they’d kill our seam to sell its heart. And no more cheap shards out of Brightvein, either. They win twice.'],
      ['halcyon', 'Our chapter-house stood in the old ruins below the moors. Our book was kept there. If it is still there, it will say how we stopped them before.'],
      ['odile', 'And that hum I hear at night is one note, over and over. Give me a room to work in, and I’ll find it.'],
    ],
    goals: [GOAL.trip(2, 'Bring the Thinwatch’s book home from the old-age ruins (send someone into the wilds)'), GOAL.boss('Bring down a Bright Night’s boss, and see the heart reach up'), GOAL.room('E', 'Furnish a Drafting Loft in the Keep, for Odile to work out the note')],
    close: [
      ['halcyon', 'The book. Water-stained, but whole. Here is the oath: dig no deeper than the light allows, and take nothing from the heart.'],
      ['io', 'There’s more, in the margin, in another hand. A drawing of a lamp, and a note: sing it the seam’s own note, and it sleeps.'],
      ['odile', 'I’ve been hearing that note for a year. I can grind a lens to it.'],
      ['tallow', 'To the occupants of Brightvein. I find myself in the Exchange’s debt, and in its offices, and I do not care for the company. They are building something they call the Grindstone. I thought you should know. — A. T. (Retired.)'],
      ['hesper', 'Tallow, warning us. The world’s gone strange.'],
      ['corwin', 'Stranger every day.'],
    ],
    reward: { shards: 260, codex: ['heartlight', 'oath'] } },
  { id: 'storms', title: 'Storm Season', line: 'The Aether storm season climbs the Ironspire, and Hollowcrest is in its path.', season: true,
    open: [
      ['pip', 'The sky’s gone purple all the way to the coast. That’s not a storm. That’s the season.'],
      ['quill', 'Storm season. A fortnight of lightning. Every rod you’ve got, put it up. Every rod you haven’t got, build.'],
      ['juno', 'Brightvein! Hollowcrest’s lost its roof. And its other roof. And the shed we were calling a roof.'],
      ['juno', 'I’ve got people out in the scree with nowhere to go. I wouldn’t ask, but… I’m asking.'],
      ['marigold', 'Then they’ll need beds, and soup. I’ll put the big pot on.'],
      ['tock', 'Lightning is just shards falling out of the sky in a hurry. Catch it in a jar and it’s money.'],
    ],
    onOpen() {
      if (WEATHER.today !== 'storm') { WEATHER.next = 'storm'; weatherHUD(true); }
      // the first of Hollowcrest's people come up the bridge
      const n = Math.min(2, Math.max(0, totalBeds() - GAME.villagers.length)), D0 = LAYOUT.dock;
      for (let i = 0; i < n; i++) { const d = makePerson(mulberry((Math.random() * 1e9) | 0)); const v = addVillager(d, new THREE.Vector3(D0.x - 8 + Math.random() * 2, 0, D0.z + 6 + Math.random() * 2)); v.replan = true; }
      if (n) { autoAssign(); setTimeout(() => toast(`${n === 1 ? 'One' : 'Two'} of Hollowcrest’s people come up the bridge, soaked through.`), 1500); }
    },
    goals: [GOAL.build('rod', 2, 'Build two Lightning Rods'), GOAL.bolts(6, 'Catch six bolts of lightning with the rods'), GOAL.peopleT(30, 'Take in Hollowcrest’s people: 30 on the claim')],
    close: [
      ['juno', 'Your rods caught more lightning than my whole claim ever dug. I’m not saying that out loud again.'],
      ['juno', 'One more thing. The Exchange’s dredge came up the gorge in the storm, low, with no lights. The Grindstone. A ship with a drill on her bow the size of a lens tower.'],
      ['halcyon', 'Then they mean to come at the heart from the side, under the south cliff.'],
      ['hesper', 'When?'],
      ['juno', 'The next clear night. They’ll want the stars to steer by.'],
    ],
    reward: { shards: 260, codex: ['storms', 'grindstone'] } },
  { id: 'longnight', title: 'The Long Bright Night', line: 'The Grindstone drills for the heart, and every Wildlight in the Ironspire wakes.', longNight: true, actEnd: 'two',
    open: [
      ['pip', 'The cliff’s shaking! Something’s drilling into the rock under the south face!'],
      ['halcyon', 'The Grindstone. If it reaches the heart, the Warden wakes: the seam’s first light. Everything that ever climbed out of this seam, all at once.'],
      ['io', 'Odile, the lens. Is it ready?'],
      ['odile', 'It’s ground to the note. But it rings through the rock, so the mine needs people in it, holding it, while it rings.'],
      ['hesper', 'Then here’s the plan. We sink the Grindstone. We hold the mine. And we see out the longest night this plateau has ever had.'],
      ['sol', 'I like a plan with three parts. I can count to three.'],
      ['quill', 'Sky Dock’s ready, Captain. Bring your biggest ship and your worst mood.'],
      ['fox', 'I read the cards for tonight. They said “pies after”. That’s the best card there is.'],
    ],
    onOpen() { forceWeather('clear', 'clear'); if (!WL.night) { NIGHT.plan = null; NIGHT.markers = []; } },   // tonight is the Long Night: the lookout looks again
    goals: [GOAL.raid('dredge', 'Sink the Grindstone (Sky Dock › Raids)'), GOAL.mineCrew(6, 'Hold the mine: six people working in it, to carry the note'), GOAL.warden('Calm the Warden of the Heart on the Long Bright Night (bring its light down)')],
    close: [
      ['io', 'Now, Odile!'],
      ['odile', 'Ringing it… there. Listen.'],
      ['halcyon', 'It has stopped. Look at it. It is going back down the shaft. Not beaten. Sleeping.'],
      ['io', 'Sleep well. We’ll keep the lamps on for you.'],
      ['ledger', 'The Exchange has reviewed its interest in the Ironspire and finds it… regrettable. We withdraw. Do keep the Grindstone’s wreck; we have no further use for it. — L. M.'],
      ['tallow', 'Congratulations. I hear you will want candles for the founding feast. I know a man. — A. T.'],
      ['hesper', 'Brightvein. A free town, with a heart under it, asleep.'],
      ['absalom', 'Stamped.'],
    ],
    onClose() { moodAdd('longnight', 15, 3, 'The Long Bright Night is over'); },
    reward: { shards: 600, codex: ['warden', 'freetown'] } },
);

// ---- the Long Bright Night: while chapter 14 is open, every night is a Bright Night with the Warden as its boss,
// until it's brought down (a Warden that gets away at dawn comes back the next night, still hurt). It's stronger while
// the Grindstone still drills, and takes half again as much harm while six people hold the mine (wlHarmK).
const WARDEN = { name: 'The Warden of the Heart', sub: 'the seam’s first light, woken by the Grindstone · it charges the wall and drinks every lamp' };
function storyNight(n) {
  const C = CHAPTERS[STORY.ch];
  if (!C || !C.longNight || !STORY.started || ACT.wardenDown) return null;
  const sunk = raided('dredge');
  return { title: 'The Long Bright Night', kind: 'brightmaw', name: WARDEN.name, sub: WARDEN.sub, hpK: sunk ? 1.5 : 2.2, scale: 3.7, width: 3.1, from: 'seam', budgetK: 0.9,
    line: sunk ? 'The Grindstone is sunk, but the heart is awake. The Warden is climbing the mine shaft, and every Wildlight in the Ironspire is climbing with it. Hold the mine, and ring the note.'
      : 'The Grindstone is still drilling, and the heart is awake. The Warden is climbing the mine shaft, stronger every night the drill turns, with every Wildlight in the Ironspire behind it.' };
}
// how much harm the Wildlight take: Seraphine's vigil (a third more once her story is done), and the Warden while the
// mine is held
function wlHarmK(f) {
  let k = castGift('halcyon', 1.2, 1.33);
  if (f && f.name === WARDEN.name && mineCrew() >= 6) k *= 1.5;
  return k;
}
// the storm season: storms three times as likely while chapter 13 is open
const stormSeasonK = () => (CHAPTERS[STORY.ch] && CHAPTERS[STORY.ch].season && STORY.started) ? 3 : 1;
// the Exchange's hired crews raid the claim by day from chapter 11 until the Grindstone is sunk (jumpers.js)
const exchangeCrews = () => STORY.ch >= 11 && STORY.ch < CHAPTERS.length && !raided('dredge');
// a festival night (the Moon Faire's, Charter Night) or a festival day: the Faire's music plays (music.js)
const storyFestival = () => (CHAPTERS[STORY.ch] && CHAPTERS[STORY.ch].festival && STORY.started) || festivalOn();

// ---- every tick of game time (main.js): the mood, newcomers, the day's turn, and what the claim keeps count of
function lifeTick(dt) {
  if (!started || !BUILD.setupDone || !(dt > 0)) return;
  // newcomers come sooner or later with the mood (the clerks' work is already scaled by it; this is the rest)
  const d = GAME.recruit - ACT.lastRecruit; if (d > 0) GAME.recruit = ACT.lastRecruit + d * moodRecruitK(); ACT.lastRecruit = GAME.recruit;
  moodTick(dt);
  ACT.dayCharge += Math.max(0, (GAME.rates && GAME.rates.shards) || 0) * dt;
  if (WEATHER.today === 'storm') ACT.lastStorm = GAME.day;
  if (GAME.day !== ACT.day) { ACT.day = GAME.day; ACT.dayCharge = 0; newDay(); }
  const R = NIGHT.last; if (R && R.n > ACT.lastNight) { ACT.lastNight = R.n; afterNight(R); }
  for (const v of GAME.villagers) { const T = v.d.lastTrip; if (T && !T.seen) { T.seen = true; tripHome(v, T); } }
  for (const b of byType('rod')) { const c = b.caught || 0, was = ACT.rods.has(b) ? ACT.rods.get(b) : c; if (c > was) ACT.tally.bolts += c - was; ACT.rods.set(b, c); }
  eventsTick();
  if ((ACT.checkT -= dt) <= 0) { ACT.checkT = 1; questsCheck(); }
}
function newDay() {
  eventsNewDay(); questsDay();
  if (ACT.convoy != null && GAME.day >= ACT.convoy) {
    ACT.convoy = GAME.day + 4; GAME.shards += 40; moodAdd('convoy', 2, 1, 'News from the coast');
    toast(`<b>The Brass Road convoy is in</b> from the coast: ${SHARD} 40 and the news.`); daysLog('The Brass Road convoy came in from the coast.', 'cast');
  }
}
// dawn: what the night did to the claim's mood, and to the tallies
function afterNight(R) {
  const T = ACT.tally; T.nights++;
  if (R.kinds && R.kinds.lodestar) T.lodestar += R.kinds.lodestar.downed || 0;
  if (R.bossKilled) { T.bosses++; if (R.bossKind === 'brightmaw') T.brightmaws++; if (R.boss === WARDEN.name) ACT.wardenDown = true; }
  for (const id of Object.keys(CAST_CREW)) if (onWall(id)) { T['watch-' + id] = (T['watch-' + id] || 0) + 1; if (R.bright && R.bossKilled) T['bosswatch-' + id] = (T['bosswatch-' + id] || 0) + 1; }
  if (R.bossKilled) moodAdd('night-boss', 10, 1.5, `${R.boss} is down`);
  else if (R.bossEscaped) moodAdd('night-boss', -4, 1, `${R.boss} got away`);
  if (R.breaches) moodAdd('night-wall', -6, 1, 'They broke through the wall');
  if (R.drained >= 40) moodAdd('night-hard', -8, 1, 'A hard night: shards drunk');
  if (R.hurt && R.hurt.length) moodAdd('night-hurt', -Math.min(9, R.hurt.length * 3), 1, 'People hurt in the night');
  if (R.spawned && R.downed === R.spawned && !R.drained && !R.lamps && !R.breaches) moodAdd('night-clean', 3, 0.6, 'Not one of them got near the lights');
  // the claim's Glimmer drinks a shard a night
  if (EVT.flags.cub && !EVT.flags.cub.gone && EVT.flags.cub.grown !== 'free') GAME.shards = Math.max(0, GAME.shards - 1);
  eventsDawn(R);
}
// someone home from the wilds: how far they got counts for every zone up to it
function tripHome(v, T) {
  const z = Math.max(0, WILDS.zones.findIndex(Z => Z.name === T.zone));
  for (let k = 0; k <= z; k++) { ACT.tally['trip' + k] = (ACT.tally['trip' + k] || 0) + 1; if (v.d.hero) { const key = `trip-${v.d.hero}-${k}`; ACT.tally[key] = (ACT.tally[key] || 0) + 1; } }
  eventsTrip(v);
}
// every frame (from storyTick): the day's event card, the cast waiting at the Keep, and the mood on the HUD
function actFrame(rdt) { eventsFrame(); questMarker(); moodHUD(rdt); }

// ---- saving
function actSave() { const { rods, checkT, lastRecruit, ...rest } = ACT; void rods; void checkT; void lastRecruit; return JSON.parse(JSON.stringify(rest)); }
function actLoad(s) {
  if (s) { Object.assign(ACT, s, { tally: { ...ACT.tally, ...(s.tally || {}) } }); }
  else {
    // a claim from before act two: what already happened doesn't count twice
    ACT.lastNight = NIGHT.last ? NIGHT.last.n : 0;
    for (const v of GAME.villagers) if (v.d.lastTrip) v.d.lastTrip.seen = true;
    ACT.day = GAME.day;
  }
  ACT.lastRecruit = GAME.recruit; ACT.rods = new WeakMap();
}

// ---- for tests (window.__bv is made at the end of main.js, after this file has run)
queueMicrotask(() => { if (window.__bv) Object.assign(window.__bv, { ACT, MOOD, EVT, QST, QUESTS, EVENTS, CODEX, WARDEN, storyTick, lifeTick, actFrame, eventFire, eventChoose, eventClose, eventsNewDay,
  questAccept, questGive, questsCheck, questReady, questsDay, moodTarget, moodFactors, moodAdd, moodBand, mineCrew, storyNight, wlHarmK, castGift, playScene, journalHUD, whoOf, dayWorkK, sinceCh }); });
