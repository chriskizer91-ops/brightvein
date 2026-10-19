# Pictures for the skies: the places to raid, and the wanted captains

The Sky Dock's raid map shows every place the claim's ships can raid. Tap one on the map and a card comes up with what it
is, how hard it is and what it pays. These prompts are for the picture on that card, one for each place. Now and then a
wanted jumper captain turns up on the map with a reward on her head, on a little wanted poster; the second set of
prompts is for the face on that poster.

Nothing waits on these: until a place or a captain has a picture, the card and the poster show their words alone. The
ships, the figureheads and the fights themselves are all drawn in the game, so they need no pictures.

## How to make them

- **The places:** landscape, 4:3, at least 1024 × 768. The game shrinks them to 480 × 360. Save each as the file name
  given and send them to me in the chat. They go in `assets/skies/` (`python3 tools/add-art.py skies <pictures>`).
- **The captains:** square, at least 1024 × 1024. The game shrinks them to 256 × 256. They go in `assets/portraits/`
  (`python3 tools/add-art.py portraits <pictures>`), named as given.
- The Chandlery and the Grindstone first: they're the two big fights at the end of each act.

## The style, for the places

Paste this in front of each place's prompt:

> Detailed HD pixel-art scene illustration, like a location card in a modern JRPG: crisp high-detail pixel art, seen from
> a little above and to one side, rich soft shading with plum-tinted shadows and warm cream highlights, dark coloured
> outlines (not pure black), a low late-afternoon sun from the left. A world of airships flying over a sea of cloud, in
> a steampunk-solarpunk style: lifted rocks held up by glowing amber sunstone crystal in their undersides, brass and
> timber airships with wing-like sails, glowing amber crystal clusters on their decks. The claim-jumpers fly rust-red
> sails with black pennants. No text, no frame, no border. Landscape, 4:3.

## The places

### Tallow's prospect camp
File: `camp.png`

> A small lifted rock floating over the cloud, its underside a rough cone of stone with amber crystals glowing through it.
> On top: four patched canvas tents, a plank shed, a stack of barrels, a rough palisade and one wooden gun tower with a
> brass cannon. A rust-red flag with a black hoist on a pole. Two small rust-sailed skiffs circling it.

### The Redspire outpost
File: `outpost.png`

> A lifted crag of red rock with a tall red stone spire rising from one side, a timber lookout on its tip with a great
> brass cannon on it. Sheds and tents behind a palisade, three wooden gun towers round the edge. Two long, low cutters
> with rust-red swept-back sails coming out from it.

### The supply galleon Wickmoor
File: `galleon.png`

> A fat, tall treasure galleon with a high stern castle full of lit windows and two rows of gun ports, sailing above the
> cloud under rust-red wing sails, crates lashed on her deck. A cutter and a skiff escort her. In the distance, a brig
> coming to help.

### The Chandlery
File: `citadel.png`

> A fortress of candle-works on a great lifted rock: a stone keep with four round towers, tall chimneys pouring dark
> smoke, round wax vats, and on its roof one enormous lit candle. Gun towers round the edge of the rock. Rising from the
> timber docks under the rock: a huge iron-plated Man-o'-war tarred black, with wax-white sails and candle flames burning
> at her mastheads: the Black Candle, Baron Tallow's flagship.

### The Plumbline
File: `survey.png`

> A survey rig on a lifted rock: three tall brass derricks with winches on top and very long iron drill strings hanging
> far down past the rock into the cloud, a stone counting-house, two gun towers. Airships with silver sails and gold
> pennants (the Gilded Exchange) on guard. Cool, clean, expensive-looking.

### The Grindstone
File: `dredge.png`

> A huge silver-sailed galleon, the Gilded Exchange's dredge, with an enormous fluted steel drill on her bow biting into
> a towering cliff of banded red and ochre rock, sparks and rock dust pouring from the wound, sunstone glinting in the
> cliff's seams. Brass drill engines glowing on outriggers either side of her hull. A frigate and a brig with silver
> sails guarding her.

### The Brass Road convoy
File: `convoy.png`

> Three of Brightvein's ore barges (sturdy brigs with plum sails and gold pennants, their decks heaped with crates of raw
> amber sunstone) flying in a line above the cloud towards a high plateau with lights on it, a small fighting ship
> beside them. Rust-sailed jumper skiffs diving at them out of a cloudbank.

### The storm front
File: `storm.png`

> A towering wall of dark blue-grey storm cloud above the sea of cloud, lightning forking inside it, rain sheeting down.
> A line of brass ring-beacons with glowing pale-blue hearts leads into the storm, and a small airship is flying through
> the first of them. Deep in the storm, at its calm eye, the faint gold glow of a wreck.

## The style, for the captains

Paste this in front of each captain's prompt, the same style as the claim's portraits (`03-portraits.md`):

> Detailed HD pixel-art character portrait, in the same style as the visitors' portraits already in the game
> (assets/cast): crisp high-detail pixel art like a modern JRPG's dialogue portrait, a head-and-shoulders bust facing
> the viewer with a slight three-quarter turn, large expressive eyes with bright highlights, rich soft shading with
> plum-tinted shadows and warm cream highlights, dark coloured outlines (not pure black), gentle warm light from the
> upper left. A claim-jumper (a sky pirate who robs sunstone mining claims) in a steampunk world of airships: weathered
> leather, rust-red cloth, brass, a little amber crystal. Transparent background (or a flat dark plum, #2a1b2f, if
> transparency isn't possible). No text, no frame, no border. Square.

## The wanted captains

### Ottoline Grieve, “the Rook”
File: `wanted-ottoline-grieve.png`

> About 45, tall and gaunt, pale skin, cropped black hair going grey at the temples, sharp dark eyes, a thin smile. A
> long black leather coat with a high collar, a rook's black feather pinned at her throat.

### Hollis Vane, “Tinder”
File: `wanted-hollis-vane.png`

> About 30, a wiry man with a wild shock of copper-red hair, soot on his cheeks, a burn scar on one hand held up with a
> lit match. A singed rust-red waistcoat, brass goggles pushed up on his forehead.

### Mags Corrie, “the Red Hand”
File: `wanted-mags-corrie.png`

> About 50, broad and weathered, brown skin, grey braids, a wide grin with a gold tooth. One hand in a red-dyed leather
> glove. A battered rust-red tricorn and a patched brown greatcoat.

### Ezra Blackwick, “Lampblack”
File: `wanted-ezra-blackwick.png`

> About 40, neat and cold, pale skin, slicked dark hair, a waxed moustache, small round smoked spectacles. A black
> waistcoat and a long brass candle-snuffer hanging on a chain at his chest. One of Baron Tallow's old men.

### Dellah Rusk, “Six Sails”
File: `wanted-dellah-rusk.png`

> About 35, sun-darkened skin, a sailor's squint, sandy hair tied back under a red scarf, six small brass sail pins on
> her coat lapel. A rust-red flight jacket with sheepskin collar.

### Fenwick Marr, “Old Iron”
File: `wanted-fenwick-marr.png`

> About 65, a huge grizzled man with a white beard and an iron plate riveted over one side of his jaw, deep-set pale
> eyes. A heavy iron-studded leather coat.

### Jessamy Coil, “the Gull”
File: `wanted-jessamy-coil.png`

> About 25, freckled, quick-eyed and laughing, a mop of dark curls, a white gull's feather tucked behind one ear. A
> loose cream shirt under a rust-red vest, a coil of rope over her shoulder.

### Barrow Twine, “the Knot”
File: `wanted-barrow-twine.png`

> About 45, a stocky, bald man with a thick neck and a knotted rope scar round it, a calm heavy-lidded stare. A tarred
> sailor's jacket, a bosun's whistle on a cord.

### Silas Embry, “Ember”
File: `wanted-silas-embry.png`

> About 30, handsome and arrogant, dark brown skin, close-cropped hair, a short beard, amber eyes that seem to glow a
> little. A rust-red long coat with brass buttons, an amber crystal earring.

### Wren Halloway, “the Quiet Gun”
File: `wanted-wren-halloway.png`

> About 28, small and still, olive skin, a straight black fringe, an unreadable face. A grey hooded cloak over a leather
> gunner's harness, a long brass rifle barrel over her shoulder.

### Gideon Stave, “the Plank”
File: `wanted-gideon-stave.png`

> About 55, a long-faced, sour man with a wooden peg nose-guard and thin grey hair, a pipe in his teeth. A faded naval
> coat with the badges torn off, a timber plank strapped across his back like a sword.

### Ida Sallow, “Wax-Eyes”
File: `wanted-ida-sallow.png`

> About 40, waxy pale skin, very pale grey eyes, white-blonde hair pinned up, an unsettling still smile. A cream lace
> collar under a rust-red bodice, a melted candle stub on a cord round her neck.
