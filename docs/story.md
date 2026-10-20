# Brightvein's story

Brightvein's own story, told in chapters: act one in `src/claim/story.js`, act two in `src/claim/acttwo.js`. Each chapter opens with a short scene, sets two or three goals you can see in the journal (top left; tap it for the whole story so far, the cast and their stories, the claim's days and mood, and the codex), and closes with a scene and a reward. Scenes pause the claim; tap to go on, or Skip.

**Pacing** (`src/claim/pace.js`). The story speaks in the morning or by day: a chapter never opens or closes while Wildlight or jumpers are on the claim, at dusk or at night, or before the dawn report has been read. A chapter whose goals came true in the night closes the next morning, and the next chapter's opening follows straight on in the same scene. A goal that asks to see out a night is ticked at dawn, when the night is over. Goals count from the chapter's start (or are something you do, like paying a fee from the journal), so a chapter is never done the moment it opens. The clock's panel and the journal say when the next Bright Night is.

Around the chapters, three more things keep the claim alive: each visitor who stays has **a story of their own** (`quests.js`), **days that are different** come up as small cards with a choice (`events.js`), and the claim has **a mood** (`mood.js`).

Brightvein is set hundreds of years after Chris's other games. Its visitors borrow the looks and portraits of Envoi's and the Moon Faire's characters, but they're new people with new names and their own stories here. They visit in the chapters and can stay as crew. (In the code they still go by their art's ids: `io` is Tamsin, `sol` is Brisa, and so on; see `CAST_NAMES` in `story.js`.)

## The premise

A seam of raw sunstone breaks the surface on a high plateau in the Ironspire Peaks, just under the Thinning. Six founders get there first: Hesper Lark (captain of the courier Lark), Odile Fenn (lens grinder), Pip Kettleby (night lookout), Marigold Thresh (gardener and beekeeper), Corwin Ashlar (wallwright) and Absalom Pockett (the gnome assayer).

Two things want the claim's light:

- **The Wildlight**: loose sunstone light that climbs the cliffs every night and drinks whatever's brighter than itself.
- **Baron Ambrose Tallow**, who made his fortune in candles and lamp oil. Every sunstone claim that opens puts his wicks out of work, so he jumps them. His crews fly rust-red sails; his citadel is the Chandlery, a candle-works on a lifted rock.

## Act one: the Baron

| | Chapter | What happens | Goals | Reward |
|---|---|---|---|---|
| Prologue | Stake the Claim | The founders arrive; the seam sings. | See out the first night | 40 shards; codex |
| 1 | First Light | The town gets brighter, and more Wildlight come. | A Lens Tower; 250 shards; three nights | 100 shards; the Wildlight in the codex |
| 2 | A Letter Under Seal | Tallow's courier drops a demand for a tithe. The founders won't pay. | Keep to level 2; take Tallow's prospect camp | 80 shards; Tallow in the codex |
| 3 | The Nightjar | Tamsin Vey, a lamp-witch, and Brisa Hale, a convoy guard out of work since Tallow bought the Brass Road, come in on the Nightjar, drawn by the light. Brisa takes over the watch. | Give them both jobs; a night with them on the claim | They stay as crew |
| 4 | Redspire | The jumpers' outpost on a red crag. Barnabus Teague (the old skyman who taught Tamsin to fly) and Nib Tolliver (the gnome who keeps her flying) arrive after. | Take Redspire; two ballistas | Barnabus and Nib join |
| 5 | The Wickmoor | Tallow's supply galleon. Torvald Pike, a smith, wants the forge it was carrying. | Capture the Wickmoor; 400 shards | Torvald joins |
| 6 | The Moon Faire | The Faire's painted ship tours in for a festival night, with its four Moons: Mirabel Quell (New), Rowan Thorne (Full), Hazel Brightwater (Waxing) and Clem Fennick (Waning). The Faire is an old travelling tradition by now, centuries older than its current troupe. | Light the sun beacon (Keep level 3); the festival night | Clem stays |
| 7 | The Deep Seam | The vein runs on below the lower gallery, and hums at night. A Brightmaw climbs the shaft. At dawn Dame Seraphine Vael, the last knight of the Thinwatch, comes up the bridge: she has hunted their kind across the Ironspire. | Open the deep seam; a night with it open | 200 shards; Seraphine joins |
| 8 | The Chandlery | Every crew Tallow has left is at his citadel. | Own a Brig or bigger; take the Chandlery | 400 shards; the end of act one |

## Act two: the heart under the claim

Tallow was never the real trouble. The money behind him was: **the Gilded Exchange**, a counting-house in the coast cities that decides what a shard is worth. A seam as rich as Brightvein's makes shards cheap, and under the seam is something the Exchange wants more than the claim itself. Act two follows the money, puts the claim to a vote, finds out what the Wildlight really are, and ends on the longest night the plateau has ever had. A claim that finished act one goes straight on into it.

Two new faces: **Provost Lucan Marchbank** of the Exchange (polite, patient, counting), and **Juno Ferrars**, who digs the rival claim across the gorge on the Exchange's money and ends up a neighbour. One of the claim's own settlers speaks for the newcomers who'd rather sell.

| | Chapter | What happens | Goals | Reward |
|---|---|---|---|---|
| 9 | Silver Sails | A grey ship with silver sails: Marchbank says the Exchange held Tallow's notes, and with them his claim on every seam in the Ironspire, including this one. Two thousand shards, or a third of every tray for ever. Absalom's answer: a charter, so the land is the claim's by law. | 24 names on the charter roll (gathered by clerks working in the Keep, from the chapter's start); a Parlour in the Keep; pay the 600-shard filing fee (from the journal) | 100 shards, 3 Cut Glass and a module for the Keep; the Exchange and the Ironspire Compact in the codex |
| 10 | Charter Night | A settler argues for selling: two thousand shards is a lot of boots. The claim votes, and the Moon Faire's ship comes back for the night. | Mood 60 or more; 120 food; see out Charter Night (the Faire's music plays) | 120 shards, 2 Heartstone and a Signed charm from the Faire; Brightvein is a free town (+5 mood for good, settlers come a little sooner) |
| 11 | Hollowcrest | Juno Ferrars digs in on the dry flat-top across the gorge, on the Exchange's money. The Exchange's crews start raiding the claim by day under silver sails. Her survey rig, the Plumbline, has very long drills. | Take the Plumbline (a new raid); someone to the gorse moors and back; three Lens Towers | 120 shards, 4 Cut Glass and a Lark part from the Plumbline's stores; the maps were of Brightvein's deep seam, drawn from the side |
| 12 | The Thinwatch's Oath | Seraphine tells the truth: every deep seam has a heart, the Heartlight. The Wildlight are its light, wandering, homesick; a Brightmaw is the heart reaching up to see who is digging. Take the heart and the seam goes grey, and the stone is worth more than a city. | The Thinwatch's book from the old-age ruins; a Bright Night's boss (the chapter brings its own Bright Night: the first night after it opens, then every other night until a boss is down); a Drafting Loft in the Keep | 150 shards, 3 Heartstone and a Signed weapon from the Thinwatch's chapter-house; the Heartlight and the oath in the codex; a letter from Tallow, retired, warning of the Grindstone |
| 13 | Storm Season | A fortnight of Aether storms (three times as likely). Hollowcrest is wrecked, and four of its people wait at the Sky Dock. | Two Lightning Rods; catch six bolts; take in Hollowcrest's people (60 food, paid from the journal: they come up the bridge, and sleep on bedrolls by the hall fire until a bunk is free) | 150 shards, 4 Cut Glass, 2 Heartstone and a Signed Cloud Lens; Juno saw the Grindstone come up the gorge |
| 14 | The Long Bright Night | The Grindstone, the Exchange's dredge, drills for the heart under the south cliff. Every night is a Bright Night with the Warden of the Heart as its boss until it's calmed: it's stronger while the Grindstone drills, and takes half again as much harm while six people hold the mine. | Sink the Grindstone (a new raid); six people working the mine; bring down the Warden | 400 shards, 4 Heartstone, 4 Cut Glass, a Signed Lark part and a Signed piece of gear; the Exchange withdraws; Brightvein is a free town with a heart under it, asleep. The end of act two |

From chapter 11 until the Grindstone sinks, the Exchange's hired crews raid the claim by day, the way Tallow's jumpers did. The two new raid sites are in `src/sky/sites.js`; they only show in the Sky Dock's list once their chapter comes.

Act two's chapters pay in materials, gear, modules and Lark parts as well as shards (a chapter's shards are less than half a day of the yards by then).

## The cast as crew

While they're on the claim (not away in the wilds), each brings a gift to everyone:

| | Gift |
|---|---|
| Tamsin Vey | Lamp-craft: the lamps burn a third less charge at night |
| Brisa Hale | Convoy drill: everyone on the watch hits a quarter harder |
| Dame Seraphine Vael | Thinwatch vigil: Wildlight on the plateau take a fifth more harm from everything |
| Barnabus Teague | Old skyman: voyages bring home a tenth more shards |
| Nib Tolliver | Gnome mirrors: the sunning yards charge a fifth faster |
| Torvald Pike | Smith's edge: every weapon on the claim hits a tenth harder |
| Clem Fennick | Fox's luck: miners and travellers find more |

## The cast's own stories

Each visitor who stays on as crew has a short story of their own: two or three steps, offered at the Keep three days after they arrive (a marker over the Keep says who wants a word; tap the Keep, or the journal's cast page, to hear them out). Steps are things the claim does anyway, or something you hand over. Each pays off with something that lasts. They're in the journal's cast page, with a line under the chapter's goals.

| | Story | Steps | What it gives |
|---|---|---|---|
| Tamsin | The Quiet Lamp | Bring down a Lodestar; give Odile 3 Cut Glass for the lens; a night with Tamsin on the watch | The Quiet Lamp, a Masterwork that calms the Wildlight; the codex |
| Brisa | The Brass Road | Brisa to the gorse moors and back; anyone to the old-age ruins and back | 250 shards and a Signed weapon from the convoy's last strongbox; a convoy calls every four days with 40 shards |
| Seraphine | The Last Vigil | A Bright Night's boss brought down with Seraphine on the wall; Seraphine tutors in the Drill Yard | Her vigil renewed: Wildlight take a third more harm (was a fifth) |
| Barnabus | The Gannet | Someone to the wreck fields and back; give Nib 4 Brass Scrap and 200 shards | The Gannet, his old cutter, joins the fleet (or toughens the one you have); voyages bring a fifth more (was a tenth) |
| Nib | Mirrors on Poles | Give Nib 2 Cut Glass; two lens cutters in a Lens Workshop; make 150 shards in one day | Cloud and rain dim the yards half as much |
| Torvald | Pike's Forge | A Lens Workshop at level 2; give Torvald 1 Heartstone and 150 shards | Pike's Answer, a Masterwork hammer |
| Clem | Clem's Cards | Give Clem 40 food; see three day events through | Tomorrow's event in the journal each morning, and once a week Clem can turn a day away |

The two Masterworks are kept out of the random drop tables, so the stories are the only way to get them.

## Days that are different

About one day in three, from day 3, something happens by day (never on a day a chapter opens or closes, or with a Bright Night coming). It comes up as a small card: a picture (painted ones go in `assets/events/`; until then, the faces of the people in it), a few lines, and one or two choices with a real trade-off. Time waits while you choose. The result shows what it did, and it goes in the journal's days ("Day 12 · Wynn and Quentin married in the Hearth Hall"). The same card never comes twice in a row, each has a few days' rest before it can come again, and the amounts grow with the story.

| Event | From | The choice |
|---|---|---|
| A courier with a rare trade | ch 1 | Buy a Calibrated (later Signed) piece, or keep your shards |
| A prospector at the gate | ch 1 | Take in someone with a 10 in one stat and an odd trait (Skittish or Night owl), or send them on with a meal |
| A fever in the Keep | ch 1 | A day in bed (no work today), or Marigold's tonic (20 food, back by noon) |
| A festival day (Founders' Day the first time) | ch 2 | Down tools and dance (half the work, +15 mood, the Faire's music by day), or dance at dusk |
| A lost Wildlight cub | ch 1 | Keep it in a jar (mood up; it drinks a shard a night), or carry it back to the cliff |
| The cub grows up | after the cub | Let it go home (it leaves Heartstone), or keep it as the claim's lamp (+3 mood for good) |
| The old workings fall in | ch 1 | Dig it out (something old and good; a miner hurt), or shore it up |
| Tallow's spy | ch 9 | See him off, or pay him to talk (the codex) |
| A sky-whale passes | ch 2 | Everyone to the rim to watch (an hour without work, +8 mood), or Pip sketches it (the codex) |
| A wedding in the Hearth Hall | ch 2 | A proper feast, or a quiet one. Two of your own settlers |
| Two settlers fall out | ch 1 | Absalom settles it (his fee), or let them work it out (mood down two days) |
| The bees swarm | ch 1 | Follow them (honey now, slower greenhouses), or smoke them home (faster greenhouses) |
| A tinker on the bridge | ch 2 | Mend the whole wall, or buy a blueprint for Odile's bench |
| Folk from a dead claim | ch 5 | Take in two people, or food for the road. Their seam went grey in one night |
| The yards are running hot | ch 1, clear days | Push on (the yards half again as fast, a chance a tray cracks at dusk), or shade the trays |
| A shard that sings | ch 3 | Heartstone for Odile, or shards from a buyer |
| A dropped mailbag | ch 1 | Letters from home (+6 mood), or a finder's fee |
| Something glowing in the scree | ch 3 | Lower someone on a rope (a find, a chance they're hurt), or leave it |
| Lightning glass | after a storm | Dig it out (Cut Glass, the yards lose a morning), or sell the spot |
| Juno's wager | ch 12 | Bet that the watch brings down seven in ten tonight (settled at dawn), or decline |
| A birthday on the claim | ch 1, once per founder | A cake and singing, or a card |
| A map in the wall | ch 2 | Give it to the next expedition (whoever comes home finds the cache), or sell it |
| A crate that won't stay shut | after the camp raid | Open it (a find, or a Glimmer in your face), or sell it unopened |

## The claim's mood

One number for the whole claim, 0 to 100, with a face, by the people count at the top (tap it for why; on a phone the face takes the place of the people icon, to keep the bar to one row). It drifts, about five points a game hour, toward what the claim gives its people:

- up: full larders, room in the Keep, sunshine, the sun beacon, greenhouses, furnished rooms in the Keep, the cast on the claim, the charter, festivals and good events, a boss brought down, a night when nothing got near the lights;
- down: no food (a lot), food running out, a full Keep, dark lamps, lamps snuffed at night, the hurt, fever, storms and rain, a breach in the wall, a hard night, a boss that got away, quarrels; in act two, the Exchange's ship waiting off the rim and then its crews circling it, and bedrolls by the fire in a crowded Keep.

| Mood | Name | What it does |
|---|---|---|
| 80 to 100 | Joyful | Everyone works a tenth faster; settlers come sooner |
| 60 to 79 | Happy | Everyone works a little faster; settlers come a little sooner |
| 40 to 59 | Content | Usual pace |
| 20 to 39 | Grumbling | Everyone works a tenth slower; settlers are slower to come |
| 0 to 19 | Miserable | Everyone works a fifth slower; nobody new wants to come |

## Shards, and what they're for

The sunning yards charge raw ore into shards: a yard at level 2 charges a fifth more, at level 3 a third more and in thin
light too. Each lens cutter adds to every tray, a little less the more cutters there are. The miners can dig more ore
than the yards can charge, and the spare ore feeds the sun beacon.

From chapter 8 the nights grow with what the claim has to lose (its shards, its ore and what it has built) and with how
many nights it has stood: more Wildlight, tougher ones, a stronger boss on a Bright Night, and a rich claim's Wildlight
drink deeper from the yards and the stores. A claim that leaves its lens towers unmanned loses a lot on a Bright Night.
The first nights are as gentle as ever.

Things to spend on in act two, besides the bigger ships and their refits:

- **The sun beacon** (the Keep at level 3, from its panel): feed it raw ore and some shards (120 ore and 40 shards, and 10
  ore and 4 shards more for every night the claim has stood) and it burns all night: every Wildlight on the plateau takes
  a quarter more harm, and the claim sleeps easier (mood +3). Light it for tonight, or keep it lit every night the
  stores allow.
- **A Masterwork made to order** (Odile's bench, the Blueprints tab, from chapter 9): 2,500 shards, 3 Heartstone and 4 Cut
  Glass, and half a day at the bench. A guild workshop on the coast casts one you don't have yet, and Odile fits it.

## The skies: the claim's fleet and its raids

The Sky Dock on the north rim is the claim's door to the skies (`src/sky/`). Its panel has three tabs: **Ship** (the
flagship's condition and repairs, who sails, Set sail), **Crew** and **Raids**. The **Shipyard** is its own screen with
the ship turning on a stone berth.

**The six ships.** Bought with shards and the claim's materials; the bigger ones open with the Keep and the chapter.

| Ship | Class | Price | Opens |
|---|---|---|---|
| Zephyr | Skiff | the claim's first | from the start |
| Gale | Cutter | 300 shards, 2 Brass | chapter 2 (Barnabus's story gives his old cutter, the Gannet) |
| Tradewind | Brig | 1,000 shards, 3 Brass, 2 Glass | Keep level 2 and chapter 4 |
| Tempest | Frigate | 2,600 shards, 4 Glass, 2 Heartstone | Keep level 3 and chapter 9 (act two) |
| Doldrums | Galleon | 5,000 shards, 6 Glass, 4 Heartstone | chapter 12 |
| Thunderhead | Man-o'-war | 8,500 shards, 8 Glass, 6 Heartstone | chapter 14 |

The Shipyard is the airship game's (its stage 4 port, like a racing game's garage): the ship turns on her berth, and
beside her are her numbers, her condition and repairs, her crew, her **crystal power** (a slider: more of the crystals'
power to the sails, or to the guns), her **upgrades** and her **colours**.

**Upgrades**, four of them, three steps each: **armour plates** (a fifth more hull a step, a little slower), **fine
canvas** (a fifth more sails, a little faster), **gun drill** (reloading a tenth quicker) and **cut crystals** (a fifth
more crystals, quicker climbing). A step costs shards (50, 120, 260, times the ship's size) and materials (Brass for the
first; Brass and Glass for the second; Glass and Heartstone for the third, more on a bigger ship). **Shot**: chain shot
(150 shards and 2 Brass) shreds sails, and crystal breakers (450 shards and 2 Glass) crack crystals; each is bought once
for every ship, or earned at sea. **Colours**: sail colours and pennants, bought once for every ship with shards, and
some only won (by rank, or by the stars of the hardest skies).

**The Captain's record** (the log button in the Shipyard): a rank that rises with renown, commendations for deeds at sea,
three stars on each skies (waves 5, 10 and 15), the last twelve voyages, and three harbour orders a day (a new three
each claim day), each paying shards when it's done. Coming home from a patrol, a card says what the voyage did, with
Sail again and Home to Brightvein. A Captain's first voyages come with one short tip at a time (they can be switched
off, or shown again, in Settings › In the skies).

**On patrol** raiders come in waves, each harder than the last: raiders with nerve who run or strike their colours,
named raider captains with tricks of their own, waves that come out of the sun, up through the clouds or in a line of
battle, a choice of road between waves (a storm, a treasure ship, a hunt), storms rolling in, and the Man-o'-war's
fortress battle.

**The crew** come from the claim's people: a **pilot** (Agility: turning, and a quicker Surge), a **bosun** (Grit: the
hull takes less harm, the crew patch more between fights, repairs are quicker) and one to six **gunners** by the ship's
size (Agility: reload and aim). An empty seat is a dock hand, a 3 in everything. They keep their jobs on the claim; when
the ship sails they're aboard, and when she's home they come down the boarding bridge and walk back to work (if she went
down, some come home hurt). Anyone in the wilds, studying or hurt stays ashore. Some of the cast are better at sea:
Barnabus at the wheel turns a tenth sharper, Brisa and Torvald on the guns throw heavier shot, and Nib as bosun repairs a
third quicker.

**Wear and repairs.** What harm the ship takes comes home with her, and she sails like that until she's repaired at the
dock: shards, and a few hours of claim time (a wreck takes most of a day). Between fights the crew patch her up a
little. Lose her and the crew bring her home in pieces, with half the voyage's shards.

**The places to raid** (`src/sky/sites.js`, run by `src/sky/raids.js`), each with its own objective and set piece. The
raid map shows them on Chris's map round Brightvein, with how hard each is (stars), what it pays and the best time.

| Place | From | Stars | The objective, and the set piece |
|---|---|---|---|
| Tallow's prospect camp | ch 2 | ★ | Silence its one gun and the camp strikes its colours (its guards strike with it) |
| The Brass Road convoy | ch 3, after the camp | ★★ | Bring three of the claim's ore barges home from the Brass Road while jumpers come at them in waves; pays by the barges home |
| Redspire | ch 4 | ★★ | Silence three gun towers and the great gun on the spire (a boss bar of its own) |
| The storm front | ch 7, after Redspire | ★★★ | Fly through eight Thinwatch beacons before the front closes, through lightning (a warning glow, then the bolt) and gusts, with jumper skiffs in the murk; a strongbox at the eye. Pays half again in Storm Season |
| The Wickmoor | ch 5 | ★★ | A moving treasure galleon with escorts: shoot her sails till she strikes (sink her and the crates go with her). At half sail she throws cargo overboard to run, and a brig comes from Redspire |
| The Chandlery | ch 8 | ★★★★ | Six gun towers and the Baron's frigate; then **the Black Candle**, Tallow's flagship, rises from the docks under the rock: a boss bar with three phases (a broadside duel; at 60% the Baron lights the wicks, she fires faster and two cutters launch; at 30% she comes about to ram). Bring her down and the Chandlery strikes. The end of act one |
| The Plumbline | ch 11 | ★★★ | Cut its three drill strings (shoot the winches on the derricks and watch the strings fall); two gun towers and an Exchange escort under silver sails |
| The Grindstone | ch 14 | ★★★★★ | Drilling into the cliff under the claim, braced and nearly unhurt, with a drill meter filling: knock out her two drill engines before she's through. Then she backs off and fights, and at 30% she runs for the gorge. Sink her: act two's goal |

A place taken comes back under new guards after a few days (one for the camp, six for the Grindstone's wreck), and pays
half the next time; its boss doesn't come back (the Grindstone's wreck draws Exchange salvagers instead). From chapter 3,
now and then a **wanted jumper captain** turns up on the raid map for three days, in a ship that grows with the story
(a cutter, then a brig, a frigate, a Man-o'-war) with escorts; bring her down before she runs for a big reward and her
strongbox. Twelve of them, with names and nicknames (`WANTED` in `sites.js`).

Act one's places open in their chapters (the camp in chapter 2, Redspire in 4, the Wickmoor in 5, the Chandlery in 8, and
the convoy and the storm front in 3 and 7): before then they show on the raid map as "Opens in chapter N". Act two's are
hidden until their chapter. The raid list says which ones carry Cut Glass, and the Shipyard says what you're short of
for a ship or a refit, and where to find it.

**What raids pay.** Crates opened at home with the Armory's raid tables (`RAIDS` in `src/claim/loot.js`): gear, modules,
Lark parts, materials, now and then a Masterwork. A boss brought down the first time adds a Lark part or a module for
certain, and lifts the claim's mood.

## Still open

- Whether the Moon Faire keeps that name, or gets a new one too.
- What the other three Moons do if asked to stay (only Clem stays for now).
- Act three. Threads left open: the Heartlight is asleep, not gone; the Exchange withdrew, it didn't vanish; Tallow is retired, and selling candles; Hollowcrest is a neighbour now; the other three Moons visit but don't stay.
- Painted pictures for the event cards (`docs/art-requests/04-events.md`) and portraits for Marchbank and Juno (`03-portraits.md`).
