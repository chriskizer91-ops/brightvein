# Pictures for the gear

Everything people on the claim carry has a small icon drawn in code. These prompts are for proper pictures to take
their place: one for each of the 50 kinds of gear in the Armory, the 28 named relics and the 10 guild pieces. Until
an item has a picture, it keeps its drawn icon.

Eight already have pictures, borrowed from your other games (see `reference/items/README.md`): Work Gloves, Hobnail
Boots, Gnome-Minted Coin, Leather Apron, Sunstone Locket, The Beacon Heart, The Brass Lung, and Hearthbrand,
Refitted. They're at the end, in case you want them redone to match the rest.

## How to make them

- Make each picture square, 512 × 512 (bigger is fine). The game shrinks them to 128 × 128.
- Save each as the file name given (PNG or WebP is fine) and send them to me in the chat, a few at a time or all at
  once. I'll shrink them, clear the background and put them in `assets/items/`.
- Anything without a picture keeps its drawn icon, so there's no need to do them all at once. The twelve new weapons
  come first.

## The style, for every picture

**HD pixel art, like Quill's curios** (`reference/items/quill-lantern-oil.webp`, `quill-wisp-jar.webp`,
`quill-charm-bell.webp`): it matches the claim's pixel people, its pixel fonts and the HD pixel portraits in art
request 03, and Quill's curios show the look holds up at this size.

Paste this in front of each prompt below:

> Detailed HD pixel-art game item icon, in the same style as the curios on Quill's stall: crisp high-detail pixel
> art like a modern JRPG's inventory icon. One item alone, in three-quarter view, centred, filling about 85% of the
> square, nothing cropped. Rich soft shading with plum-tinted shadows and warm cream highlights, dark coloured
> outlines (not pure black), warm light from the upper left with a soft rim light along the right-hand edges. A
> steampunk-solarpunk frontier a generation after the age of swords and spells: brass, copper, dark oak, blackened
> iron, canvas, leather, black rubber, smoked glass, lenses, clockwork, and sunstone, a crystal that glows warm amber
> like stored sunlight. Well made in a workshop, a little worn from use on a mining claim. A bold, simple silhouette
> that still reads at 128 pixels: a few big shapes, no tiny details that would vanish. Transparent background (or a
> flat dark plum, #2a1b2f, if transparency isn't possible). No people, no hands, no text, letters or numbers, no
> frame, no border, no glow around the whole picture. Square.

Two things the prompts lean on:

- **Long things lie corner to corner**: the grip, stock or handle at the lower left, the muzzle, blade or tip at the
  upper right. Guns point up and to the right.
- **Each weapon's glow is the colour of its aspect** (the kind of harm it does), so a glance tells you what it does:

  | Aspect | Colour | What it is |
  |---|---|---|
  | Glare | amber-gold (#ffc35a) | focused sunlight |
  | Arc | electric blue (#7fd6ff) | crackling Aether lightning |
  | Steam | white-grey (#d9d2c3) | steam, pressure and pistons |
  | Shade | smoky violet (#9a7cff) | smoked glass that drinks light |
  | Rime | pale ice blue (#bdf0ff) | coolant and frost |
  | Chime | rose (#f7a8d8) | a ringing note, drawn as soft rings in the air |

  Gear with no aspect keeps any crystal plain sunstone amber.

## The new weapons

### Pepperbox Flare Pistol
File: `assets/items/flare-pistol.webp` · Glare

> A pepperbox flare pistol: a short, chunky brass pistol with four fat barrels bundled round a central pin, a curved
> dark oak grip, and a small amber sunstone cell above the trigger. Each barrel mouth glows amber-gold. Small and
> stubby, like a signal gun: the smallest gun of the set.

### Rivet Gun
File: `assets/items/rivet-gun.webp` · Steam

> A pneumatic rivet gun from a shipyard, pressed into service as a weapon: a fat copper cylinder body, a short square
> iron nozzle, a black rubber pistol grip, a coiled black rubber air hose trailing from the back, and a little brass
> pressure dial on top. A puff of white-grey steam at the nozzle, two loose rivets beside it. Squat and boxy: plainly a
> workshop tool, not a gunsmith's gun.

### Wind Rifle
File: `assets/items/wind-rifle.webp` · Steam

> A long air rifle: a very long, slender blued-iron barrel, a polished dark oak stock, a bottle-shaped brass air tank
> slung under the barrel with a small pressure gauge, and a slim brass telescope sight on top. A faint white-grey wisp
> at the muzzle; no smoke or fire, because it is silent. The longest and leanest gun of the set.

### Lens Carbine
File: `assets/items/lens-carbine.webp` · Glare

> A short carbine that fires focused sunlight: a brass body and a stubby barrel that ends in a big round glass lens in
> a brass ring, like a ship's lamp; a short oak stock; and a little window in the side showing three small amber
> sunstone shards. The lens glows amber-gold. Shorter than the rifles; the round lens on the end is what you notice.

### Heliograph Musket
File: `assets/items/heliograph-musket.webp` · Glare

> A long, old-fashioned musket rebuilt to fire stored sunlight: a long brass barrel flaring into a wide bell mouth lined
> with polished mirror, a small tilting signal mirror on a gimbal above the barrel, a long walnut stock with brass
> bands, and a row of amber sunstone cells along the side. Warm amber-gold light fills the bell. Long and grand; the
> mirrored bell sets it apart from the lens carbine.

### Galvanic Coil
File: `assets/items/galvanic-coil.webp` · Arc

> A hand-held spark caster: a squat box of dark oak and brass with a black rubber grip underneath, and two curved copper
> horns sticking out of the front like a lyre, wound with fine copper wire. An electric-blue arc leaps between the horn
> tips, and a pale blue crystal glows in a window in the box. The two horns make it read at a glance.

### Umbral Net Mortar
File: `assets/items/net-mortar.webp` · Shade

> A short, fat hand mortar: a wide blackened-iron tube on a little brass swivel stock with a padded shoulder rest, a
> bundled net packed into its mouth with loose ends hanging out. The net is woven from smoked-glass thread that
> shimmers smoky violet. Wide and stubby, mouth tilted up and to the right.

### Rime Sprayer
File: `assets/items/rime-sprayer.webp` · Rime

> A coolant sprayer: a round steel tank crusted with frost and a brass hand pump on top, joined by a short black rubber
> hose to a long brass nozzle with a trigger. A thin cone of pale ice-blue mist comes from the nozzle. It reads as a
> tank and a wand, like a garden sprayer built for the cold.

### Harpoon Launcher
File: `assets/items/harpoon.webp` · Steam

> A shoulder-fired harpoon launcher from an airship's deck: a thick iron tube with a barbed steel harpoon head sticking
> out the front, a coil of tan rope on a brass reel under the tube, a wooden shoulder stock, and a big brass cocking
> lever. A white-grey hiss of steam at the breech. Heavy and long; the barbed harpoon tip is what you notice.

### Storm-Jug Thrower
File: `assets/items/storm-jug.webp` · Arc

> A spring-arm launcher for jugs: a sturdy brass frame with a coiled spring arm and a cradle at the end holding a round
> cream stoneware jug, its cork wired down with copper wire. In a little glass window in the jug a tiny thunderstorm
> crackles electric blue. The jug is the star of the picture.

### Steam Drill
File: `assets/items/steam-drill.webp` · Steam

> A hand-held steam drill: a small copper boiler with a pressure gauge and a safety valve puffing white-grey steam,
> piped to a long spiral steel drill bit, with a riveted brass grip and a leather shoulder strap. Copper, brass and
> bright steel. The boiler sits at the lower left; the long spiral bit points up and to the right.

### Piston Hammer
File: `assets/items/piston-hammer.webp` · Steam

> A two-handed hammer with a piston in it: a heavy blackened-iron head with a brass piston cylinder built into one side
> and a flat striking face, on a long oak haft with brass bands, and a little steam vent puffing white-grey. A workshop
> sledge built for fighting: heavy head at the upper right, haft to the lower left.

## The other weapons

### Prospector's Pick
File: `assets/items/pick.webp` · Steam

> A prospector's pick: a worn steel pickaxe head, pointed at one end and a narrow chisel at the other, on a well-used ash
> handle wrapped in leather at the grip, with a small brass band. Humble and practical, the first thing anyone on the
> claim owns.

### Knuckle Spanner
File: `assets/items/spanner.webp` · Steam

> A heavy adjustable spanner: long blackened steel, a big open jaw with a brass adjusting screw, and a brass knuckle
> guard looped over the handle like a knuckleduster. A wrench first and a weapon second.

### Sunsteel Machete
File: `assets/items/machete.webp` · Steam

> A wide, slightly curved machete with a bright blade that has a warm golden sheen along the edge (sunsteel), a riveted
> brass bolster and a grip of oak wrapped in leather. A few strands of green vine stuck to the blade. Broad and made for
> chopping: a brush knife, not a sword.

### Earthing Lance
File: `assets/items/earthing-lance.webp` · Arc

> A long lance for grounding lightning: an oak shaft shod in copper at both ends, a long copper spear point with a ring
> of copper wire coiled below it, and a short grounding chain with a copper spike hanging from the butt. Small
> electric-blue sparks crawl down the wire. Long and thin and copper-coloured.

### Clockwork Halberd
File: `assets/items/clock-halberd.webp` · Steam

> A halberd with clockwork inside: a steel axe blade and spike on a long oak pole, a round brass gear housing where the
> blade meets the pole with its cogs showing through a cut-away, and a big brass winding key sticking out of the side.
> The winding key and the gears set it apart from any old halberd.

### Shade Hook
File: `assets/items/shade-hook.webp` · Shade

> A long pole with a curved barb like a shepherd's crook, the hook made of dark smoked glass held in a blackened-iron
> collar. The glass glows faintly smoky violet from inside and seems to drink the light around it. A dark oak pole with
> iron bands.

### Tuning Fork
File: `assets/items/tuning-fork.webp` · Chime

> A big steel tuning fork as long as a forearm, its two prongs bright and smooth, on a brass handle with a leather grip
> and a small rose-pink crystal set in it. Soft rose-pink rings of sound shimmer off the prongs. Simple and elegant: a U
> on a stick.

## Job tools

### Ledger Engine
File: `assets/items/ledger-engine.webp`

> A brass adding machine: a compact brass box on an oak base with rows of round ivory keys (blank), a crank handle on
> the side, a little window of number wheels, and a curl of paper tape coming out of the top. Plainly a desk machine.

### Tray Tongs
File: `assets/items/tray-tongs.webp`

> Long copper tongs with flat paddle jaws and a riveted pivot, the handles wrapped in leather, gripping a small glowing
> amber sunstone crystal. Long and thin.

### Pump Can
File: `assets/items/pump-can.webp`

> A copper watering can with a small brass hand pump on top, a long spout ending in a round brass sprinkler rose, and a
> few drops of water falling from it. Round and friendly, with green patina along the seams.

### Brass Spyglass
File: `assets/items/spyglass.webp`

> A brass telescope pulled out to three sections, the middle wrapped in brown leather, a glinting lens at the wide end
> and a brass eyepiece at the narrow end. Clean and classic.

## Off-hand

### Mirror Buckler
File: `assets/items/mirror-buckler.webp`

> A small round buckler whose whole face is a polished tin mirror, slightly domed, with a riveted brass rim and a small
> brass boss in the middle, a bright glint across the mirror. Silver and brass.

### Shade Lantern
File: `assets/items/shade-lantern.webp`

> A small blackened-iron lantern with smoked-glass panes and a ring handle on top. Inside, instead of a flame, a slow
> swirl of smoky violet darkness that dims everything around it. A lantern that gives off shadow.

### Pressure Gauge
File: `assets/items/pressure-gauge.webp`

> A round brass pressure gauge the size of a hand, with a cream dial, simple tick marks (no numbers), a red needle near
> the top, a thick glass cover, a short copper pipe stub below and a leather wrist strap.

### Lamp Shield
File: `assets/items/lamp-shield.webp`

> A shield of riveted iron plates, flat-topped and pointed at the bottom, with a round glass lamp set in the middle where
> the boss would be, glowing warm sunstone amber inside a brass rim. The glowing lamp is what you notice.

## Head

### Brass Goggles
File: `assets/items/goggles.webp`

> A pair of brass goggles with round glass lenses, leather eye cups and a buckled leather strap, the lenses glinting.

### Smoked-Glass Visor
File: `assets/items/smoked-visor.webp`

> A half-helmet of curved iron with a wide visor of dark smoked glass on brass hinges, the glass tinted smoky violet-grey
> and flipped half down. Like a welder's mask made for Wildlight.

### Miner's Lamp Helm
File: `assets/items/lamp-helm.webp`

> A miner's hard hat of boiled brown leather with a narrow brim, and a brass carbide lamp on the front with a round
> polished reflector and a small warm flame.

### Flyer's Cap
File: `assets/items/flyers-cap.webp`

> A brown leather flyer's cap with cream sheepskin-lined ear flaps hanging down and a pair of brass goggles pushed up on
> the front. Soft and rounded.

### Mirrored Sun Hat
File: `assets/items/sun-hat.webp`

> A wide-brimmed straw sun hat, the underside of the brim lined with shiny silver foil that catches the light, a cloth
> band round the crown. Wide and flat.

### Brass Lung Helm
File: `assets/items/diving-helm.webp`

> A full brass helmet like an old diving helmet: a round front window with a brass grille, two small side windows,
> bolts round the collar, and a rubber hose curling back to a rebreather canister. Polished and clean, almost new. (The
> Brass Lung is a battered old one of these; this one is the plain new kind.)

## Coats and rigs

### Canvas Duster
File: `assets/items/duster.webp`

> A long oiled-canvas duster coat, khaki, with a short shoulder cape, many flap pockets and brass buttons, a little
> weathered. Shown hanging, its full length in view.

### Riveted Plate Vest
File: `assets/items/riveted-vest.webp`

> A sleeveless vest of curved grey iron boiler plates with rows of rivets, over a brown leather back, with buckled
> leather straps at the sides. Heavy and armoured.

### Insulated Coat
File: `assets/items/insulated-coat.webp`

> A heavy work coat of glossy black rubberised canvas with a high collar and brass buckles, and an electric-blue
> lightning-bolt patch stitched on the chest. Thick and glossy.

### Shade-Weave Cloak
File: `assets/items/shade-cloak.webp`

> A hooded cloak of dark grey cloth woven with threads of smoked glass that shimmer smoky violet, its hem fading into
> shadow, held at the throat by a blackened-iron clasp. Soft and draped.

### Clockwork Lift Harness
File: `assets/items/lift-harness.webp`

> A back harness of leather straps on a brass frame, with two big steel coil springs running down the back and a round
> brass gear housing at the waist: a clockwork frame that carries half of whatever you lift.

## Gloves

### Rubber Gauntlets
File: `assets/items/rubber-gauntlets.webp`

> A pair of thick black rubber gauntlets reaching to the elbow, with copper bands at the cuffs and a tiny electric-blue
> spark on one fingertip. Glossy black and copper.

### Clockwork Gauntlets
File: `assets/items/clock-gauntlets.webp`

> A pair of brass gauntlets with jointed fingers, every knuckle a small gear, and a round gear housing on the back of
> the hand, worn over brown leather gloves. Precise and mechanical.

## Boots

### Spring-Heel Boots
File: `assets/items/spring-heels.webp`

> A pair of tall brown leather boots with big steel coil springs built into the heels and brass buckles up the sides.
> The springs are the first thing you see.

### Lodestone Boots
File: `assets/items/mag-boots.webp`

> A pair of heavy boots with thick soles of dark lodestone, a few iron nails and filings stuck to the soles, brass toe
> caps and plum-dyed leather uppers.

## Charms

### Pocket Watch
File: `assets/items/pocket-watch.webp`

> A brass pocket watch with its lid open, a cream face with simple tick marks (no numbers), black hands, and a short
> brass chain.

### Aether Compass
File: `assets/items/compass.webp`

> A brass compass in a round case with a ring on top, the face plum-coloured with simple marks (no letters), and the
> needle a sliver of glowing amber sunstone.

### Spare Cell
File: `assets/items/spare-cell.webp`

> A charged sunstone cell: a stubby glowing amber crystal, shaped like a short cylinder, held in a little brass cage of
> bars with copper end caps like a battery's. Small and bright.

## Masterworks

Each is one of a kind, built on one of the gear above but plainly special. Their glow shows their power.

### Dawnbreaker
File: `assets/items/dawnbreaker.webp` · a Heliograph Musket · Glare

> Dawnbreaker, a survey heliograph from the first expedition under the Thinning, rebuilt to throw the morning back at
> the dark: the long musket with the mirrored bell, but older and finer, engraved gold-brass, a surveyor's brass sight,
> a big signal mirror on a gimbal, and a rising sun carved into the walnut stock. A bright amber-gold beam of morning
> light (its power, First Light) streams from the bell. Grander and more golden than the plain musket.

### Hush
File: `assets/items/hush.webp` · an Umbral Net Mortar · Shade

> Hush: a short dark-iron net mortar whose net nobody knows who wove, finer and older than the plain one, its threads
> glowing faint smoky violet. A small smoked-glass jar hangs from the stock on a chain, a tiny captured light glowing
> warm inside it (its power, Bottle the Light). Quiet and mysterious.

### Old Faithful
File: `assets/items/old-faithful.webp` · a Steam Drill · Steam

> Old Faithful, a steam drill whose boiler has been replaced four times and its drill bit never: a newer copper boiler
> patched with mismatched plates and rivets, and an ancient spiral bit, dark and worn smooth. White-grey steam puffs from
> the valve. Plainly loved and mended many times.

### The Lamplighter's Pole
File: `assets/items/lamplighters-pole.webp` · an Earthing Lance · Arc

> The Lamplighter's Pole: a long copper-shod pole with a copper lamplighter's hook at the top, a brass ferrule at the
> foot, and a little brass wick-holder with a small warm flame that has never once gone out. Faint electric-blue sparks
> run along the copper (its power, Every Lamp, relights them all).

### The Widow's Kettle
File: `assets/items/widows-kettle.webp` · a Rivet Gun · Steam

> The Widow's Kettle: a copper tea urn somebody bored out and pressurised in a hurry one bad night. Its spout is drilled
> out into a stubby barrel, a pistol grip and trigger are bolted to its side, a pressure gauge is strapped to the lid,
> and white-grey steam hisses from every seam (its power, Boil Over). It must still look like a tea urn.

### Corwin's Plumb
File: `assets/items/corwins-plumb.webp` · a Piston Hammer · Steam

> Corwin's Plumb: a mason's plumb bob, a heavy pointed teardrop of dull grey lead with a small brass cap, hanging from a
> brass chain wound round a short oak handle so it swings like a flail. Old and plain and well kept: it was his
> mother's. A faint white-grey shimmer where it hangs true.

### Tinderwing
File: `assets/items/tinderwing.webp` · a Pepperbox Flare Pistol · Glare

> Tinderwing, Hesper Lark's signal pistol from her courier days: a four-barrelled pepperbox flare pistol in engraved
> brass with a small winged badge, its dark grip worn pale and smooth where a thumb rests, a short red-gold tassel. The
> barrel mouths glow amber-gold (its power, Courier's Mark). Finer and lighter than the plain flare pistol.

### The Gnomewright Arc-Organ
File: `assets/items/arc-organ.webp` · a Galvanic Coil · Arc

> The Gnomewright Arc-Organ: eleven brass organ pipes of different heights fanned along a plum-lacquered box, a small
> leather bellows pack on the back, copper wires everywhere, and electric-blue lightning chaining from pipe top to pipe
> top (its power, Full Stops). Whimsical and gnome-made, like nothing else in the Armory.

### Rimekeeper
File: `assets/items/rimekeeper.webp` · a Rime Sprayer · Rime

> Rimekeeper, built after the first time the deep seam ran too hot: a bigger, heavier rime sprayer with two
> frost-crusted steel coolant tanks, thick glass gauges, and a wide fan-shaped nozzle pouring pale ice-blue mist (its
> power, Quench). Heavier and colder than the plain sprayer: an emergency tool.

### The Long Quiet
File: `assets/items/long-quiet.webp` · a Wind Rifle · Steam

> The Long Quiet, a claim-jumper's rifle whose last owner didn't hear it either: a very long air rifle in black iron and
> dark-stained wood, a long silencer tube on the muzzle, a slim brass scope, and notches cut into the stock. Sleek and
> sinister, much darker than the plain wind rifle. Only the faintest white-grey wisp at the muzzle (its power, Not a
> Sound).

### The Seventh Spanner
File: `assets/items/seventh-spanner.webp` · a Knuckle Spanner · Steam

> The Seventh Spanner: Odile has six spanners and nobody asks about this one. An adjustable spanner of unusually fine
> work, polished steel inlaid with gold-brass, seven small dots punched in a row along the handle, and a faint
> white-grey shimmer round it. A master's tool with a secret.

### Marigold's Swarm-Box
File: `assets/items/swarm-box.webp` · a Pump Can · Chime

> Marigold's Swarm-Box: a copper beekeeper's smoker with a leather bellows on its side, a cone-shaped spout, and a
> little brass music-box crank, with a few honey-gold bees round it and soft rose-pink rings of music drifting out with
> the smoke (its power, Everybody Out).

### Odile's Tuning Fork
File: `assets/items/odiles-fork.webp` · a Tuning Fork · Chime

> Odile's Tuning Fork, the ear she judges crystal with: a slender, perfect tuning fork of pale gold-brass, finer than the
> plain one, with a clear sunstone chip set where the prongs meet and rose-pink rings of sound spreading from the prongs
> (its power, The Pitch of Sunstone). Delicate and exact.

### The Assayer's Loupe
File: `assets/items/assayers-loupe.webp` · a charm

> The Assayer's Loupe, Absalom Pockett's eyeglass (he talks to it): a jeweller's loupe, a small thick round lens in a
> gold-rimmed brass barrel, with a second lens that flips down on a tiny hinge, on a fine chain. A bright glint on the
> glass.

### Pip's Night Glass
File: `assets/items/pips-night-glass.webp` · a Brass Spyglass

> Pip's Night Glass: a short, battered brass spyglass with a dark smoked lens, its leather grip scuffed, and Pip's
> initials scratched into the brass in four places (just scratch marks, no readable letters). Smaller and more
> beaten-up than the plain spyglass.

### The Saltpan Sunshade
File: `assets/items/sunshade.webp` · an off-hand, like the Mirror Buckler

> The Saltpan Sunshade, from the salt flats where the sun is a weapon: an open parasol whose canopy is a dome of small
> mirrored panels in a brass frame, dazzling white and silver, on a slim brass shaft with a curved handle. Bright glints
> bounce off the mirrors (its power, Return to Sender).

### The Prospector's Promise
File: `assets/items/prospectors-promise.webp` · a Prospector's Pick · Steam

> The Prospector's Promise, dug out of the seam with the founder's name on it: an old, heavy pick of dark steel with a
> gold-brass collar set with a small amber sunstone, a smooth dark ash handle, and a brass name plate on the handle
> (the name worn away, unreadable). Antique and important; finer and older than the plain pick.

### Clockheart
File: `assets/items/clockheart.webp` · a Pocket Watch

> Clockheart: a small glass case shaped like a pocket watch, with a ring on top for a chain, and inside it a red-copper
> clockwork heart of tiny gears and a coiled spring, glowing faintly warm. You can hear it through a coat (its power,
> Keep Ticking).

### Sky-Anchor
File: `assets/items/sky-anchor.webp` · a Piston Hammer · Steam

> Sky-Anchor, the anchor of an airship that crossed the Thinning and fell: a small dark-iron anchor with curved flukes
> and a brass crown, swung like a war hammer, with a short length of heavy chain ending in one link cut clean through.
> A white-grey burst where the flukes would strike (its power, Drop Anchor).

### Mother Ivy's Thunderjug
File: `assets/items/thunderjug.webp` · a Storm-Jug Thrower · Arc

> Mother Ivy's Thunderjug, bottled the night of the great storm: one big round cream stoneware jug with a glass window,
> its cork wired down hard with copper wire, a raging electric-blue thunderstorm inside and sparks leaking round the
> cork. It still rattles (its power, Uncork). Just the jug, bigger and wilder than the plain thrower's.

### Gloamhook
File: `assets/items/gloamhook.webp` · a Harpoon Launcher · Shade

> Gloamhook, a courier crew's grapple gun: a dark iron body with a pistol grip, a reel of dark cord, and a three-pronged
> grappling hook of smoked glass glowing smoky violet at the front (its power, Reel In). Lighter and sleeker than the
> harpoon launcher.

### The Lark's First Figurehead
File: `assets/items/lark-figurehead.webp` · a part for the airship

> The Lark's First Figurehead: a carved brass lark with its wings half open, on a short curved bracket of dark wood that
> fixes it to a ship's bow. Worn smooth and a little dented, polished bright on the high points: Hesper lost it over the
> Saltpan and stopped looking.

## Sunforged relics

Old-age relics dug out of the deep seam and refitted with sunstone. They burn with a pale white flame, the Sunforged
colour.

### The Worldforge Engine
File: `assets/items/worldforge-engine.webp` · a charm

> The Worldforge Engine, the heart of an old-age forge rebuilt into a pocket engine that ticks like a second heart: a
> round brass case the size of a palm with a glass face, gears and a tiny piston showing through, and at its centre a
> core of white-gold forge fire. Ancient and powerful. (Thareia's Worldforge Heart, in
> `reference/items/thareia-worldforge-heart.webp`, is what it was before.)

### The Thinning Compass
File: `assets/items/thinning-compass.webp` · a charm

> The Thinning Compass: an old-age compass in a tarnished silver-and-brass case, the face painted with stars and clouds
> (no letters), its needle a sliver of pale white-gold crystal pointing up at the sky, not north: to wherever something
> fell out of it. A faint white flame round the needle. Older, more precious and stranger than the Aether Compass.

### The Sunwyrm Lens
File: `assets/items/sunwyrm-lens.webp` · a module for the lens tower

> The Sunwyrm Lens, cut from the crystal heart of the first Brightmaw ever brought down: a large round lens of glowing
> amber crystal, ridged like a great creature's eye, in a heavy brass ring with clamps for mounting on a tower, white
> light pouring through it.

## Guild sets

Three sets of guild issue; each set shares its colours and badge so the pieces look like they belong together.

### Lensguild Visor
File: `assets/items/lensguild-visor.webp` · Lensguild Regalia: plum and brass, a lens badge

> A brass headband with a stack of round graduated lenses on hinges, two flipped down, plum leather padding, and a small
> brass badge shaped like a lens on the side.

### Lensguild Longcoat
File: `assets/items/lensguild-longcoat.webp` · Lensguild Regalia

> A long coat of plum wool with a high collar, brass buttons stamped with a lens, and brass lens badges on the
> shoulders. Shown hanging, its full length in view.

### Lensguild Gauntlets
File: `assets/items/lensguild-gauntlets.webp` · Lensguild Regalia

> A pair of plum leather gauntlets with brass plates over the knuckles and ridged brass grips on the palms, for turning
> the great lens in a gale, a lens badge on each cuff.

### Wallwright's Helm
File: `assets/items/wallwright-helm.webp` · Wallwrights' Order: grey iron, leather and stone dust, a mason's mark

> A riveted iron pot helmet with a short brim, a mason's mark (a simple square-and-plumb shape) punched into the front,
> a leather chin strap, and pale stone dust in the rivets.

### Wallwright's Apron
File: `assets/items/wallwright-apron.webp` · Wallwrights' Order

> A heavy leather mason's apron with tool loops and a pocket holding a trowel, so covered in pale grey mortar dust that
> the leather barely shows, a mason's mark on the chest.

### Wallwright's Boots
File: `assets/items/wallwright-boots.webp` · Wallwrights' Order

> A pair of sturdy work boots with dented steel toe caps (they have been dropped on), thick soles, leather laces and grey
> stone dust, a small mason's mark on the side.

### Skyward Post Cap
File: `assets/items/skyward-cap.webp` · Skyward Post: deep teal and brass, a winged badge

> A deep teal courier's cap with a short peak, a brass winged badge on the front, and a chin strap.

### Skyward Post Jacket
File: `assets/items/skyward-jacket.webp` · Skyward Post

> A short, warm deep-teal courier's jacket with a fleece collar, a dozen buttoned and sealed pockets, and a brass winged
> badge on the chest.

### Skyward Post Boots
File: `assets/items/skyward-boots.webp` · Skyward Post

> A pair of deep teal leather courier's boots with brass buckles, a winged badge at the ankle, and thick soles of dark
> lodestone for a pitching deck.

### Skyward Post Satchel
File: `assets/items/skyward-satchel.webp` · Skyward Post

> A deep teal leather courier's satchel with a brass winged badge on the flap and a long strap, the corner of one sealed
> letter sticking out with an unbroken red wax seal: still undelivered, never opened.

## Later: the eight borrowed pictures, redone to match

These have pictures from your other games already, so they can wait. Give the image tool the old picture as well as
the prompt, so the new one keeps what's good about it.

### Hearthbrand, Refitted
File: `assets/items/hearthbrand-refit.webp` · Sunforged · Glare · now Thareia's Hearthbrand, `reference/items/thareia-hearthbrand.webp`

> Hearthbrand, Refitted: an heirloom longsword of the old Keep, found in the deep seam with its fire gone out. A golden
> crossguard shaped like rising flames, a red leather grip, ember-red veins in the steel blade, and in the pommel a
> sunstone cell Odile fitted, glowing amber with a pale white flame. Warm again: amber-gold light along the blade (its
> power, Hearthfall).

### The Brass Lung
File: `assets/items/brass-lung.webp` · Masterwork · now Thareia's Salvager's Helm, `reference/items/thareia-salvagers-helm.webp`

> The Brass Lung: a brass diving-style helmet that somebody walked out of a flooded gallery in. Round front window with a
> grille, bolts round the collar, a rubber hose to a rebreather canister, the brass crusted with green verdigris and
> water stains, one window cracked.

### The Beacon Heart
File: `assets/items/beacon-heart.webp` · Masterwork, for the Sun Beacon · now Envoi's Node Sunstone

> The Beacon Heart: a single flawless sunstone crystal from the deep seam, cut to Odile's own pattern, many-faceted and
> blazing amber, held in a brass mount with clamps for the Sun Beacon. Light pours from it like noon at midnight (its
> power).

### Leather Apron
File: `assets/items/apron.webp` · now Thareia's Ironvein Apron

> A brown leather work apron, scorched and patched a dozen times, with a neck strap, waist ties and a front pocket
> holding a small hammer.

### Work Gloves
File: `assets/items/work-gloves.webp` · now Envoi's Dockhand's Gloves

> A pair of worn split-leather work gloves, tan and brown, with stitched seams and rolled cuffs.

### Hobnail Boots
File: `assets/items/hobnails.webp` · now Envoi's Bogstriders

> A pair of worn brown leather work boots with thick soles studded with rows of round iron hobnails, laced up the front,
> mud on the toes. Grip on wet rock.

### Gnome-Minted Coin
File: `assets/items/gnome-coin.webp` · now Envoi's Jetty Coin

> A thick gold coin with neatly milled edges, a little gear stamped on its face, gleaming. Gnomes take it at full weight.

### Sunstone Locket
File: `assets/items/sunstone-locket.webp` · now the Loot Forge's Hearth-Ash Locket

> A small brass locket on a fine chain, its lid open: on one side a chip of glowing amber sunstone, on the other a tiny
> faded portrait of someone (just a soft painted face).
