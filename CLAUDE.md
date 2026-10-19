# CLAUDE.md

## Repository rules

- This is the only repository to write to for Brightvein.
- These sibling repositories are read-only references, set in the same world. Reuse their assets, mechanics and code when useful, but never commit to them:
  - `chriskizer91-ops/airship-game-in-aethermoor-` (the skies: flight, guns, raiders, the six ships, the map)
  - `chriskizer91-ops/envoi-on-the-longest-night` (the looks and portraits Brightvein's visiting cast wear)
  - `chriskizer91-ops/moon-faire` (the looks of the four Moon Faire performers and their festival airship)
- When copying assets or code from a sibling repo, note the source repo and path in the commit message.
- Brightvein is hundreds of years after Chris's other games (Chris, October 18). It reuses their art and borrows their world, but its people are new: the visiting cast wear the looks and portraits of Envoi's and the Moon Faire's characters under new names and new stories (`CAST_NAMES` in `src/claim/story.js`). Never use the old names (Io, Sol, Halcyon, Quill, Brann, Tock, the Magpie) or those games' plots in what players see. The cast's ids in the code (`io`, `sol`, ...) are only the names of the art. Envoi's retired lore stays out: the Drowned Mother, Old Snuff, the mandrakes and Mother's Hollow.

## Project

- *Brightvein*: a sunstone claim on a plateau under the Thinning, in Aethermoor (Chris's D&D world). Fallout Shelter's staffed rooms and people with stats, Clash of Clans' base building and defence, and the airship game's skies.
- Its own story (`docs/story.md`): the claim, the Wildlight, Baron Tallow and his claim-jumpers are Brightvein's. Visitors arrive in its chapters (Tamsin and Brisa on the Nightjar, Barnabus and Nib, Torvald, the Moon Faire's four, Dame Seraphine of the Thinwatch) and can stay as special crew.
- Design notes: `docs/design.md` (the whole game), `docs/keep.md` (the Keep and study), the claude.ai project docs `brightvein-design.md` and `brightvein-keep-design.md`.
- Look: HD-2D. A lit 3D diorama with pixel-art people as camera-facing sprites. People are hand-pixeled in code (`src/claim/pixel.js`): 48 × 64 frames, 10 columns (stand, walk × 4, work × 3, idle × 2: a breath and a blink) × 3 rows (facing you, facing away, facing left; right is mirrored). `drawPortrait` draws a bust for anyone without a painted portrait. `python3 test/people.py --check` draws every look and must pass.
- Desktop first (Chris, October 18), but phones must keep working: touch controls and the Light detail setting.
- Chris tries things on his phone. Every step should end with something he can open there. Write anything Chris reads in plain words.
- When new art is needed, write the picture prompts as markdown files in `docs/art-requests/` for Chris to generate.

## Code

- `src/claim/`: the claim (town, Keep, mine, people, Wildlight, loot, UI). One shared scope: its files are joined in the order of `src/claim/order.json` into one module. Add a file there to add it to the build.
  - `folk.js`: everyone's portrait and look, picture first. Settlers come off this roll so their sprite and portrait match. `node tools/portrait-prompts.mjs` writes `docs/art-requests/03-portraits.md` from it.
  - `cast.js`: the visiting cast's looks. `story.js`: chapters, scenes, visitors, the journal and codex (`docs/story.md`). `dock.js`: the Sky Dock and the fleet's panel. `life.js`: birds, distant ships, fireflies, mine dust.
  - Loot: `loot.js` is the Armory's data (`D`: items, traits, modules, Lark parts, relics, drops, `WORKSHOP` costs and times, `ATTUNE`, `CELLS`) and engine (`createLoot`). `gear.js`: gear on people (`itemStats`, `dpsOf`, `fightOf`, overhauls, cells), the stash (`addToStash`) and the economy. `bench.js`: Odile's bench at the Lens Workshop (salvage, retune, overhaul, cells, attune, assay, blueprints), its jobs (`GAME.bench`, game time, one at a time; better with a good Engineering hand) and its panel. `fittings.js`: modules in building sockets and the Lark's parts (`GAME.sockets`, `modV(b, stat)`, `larkV`), what they do each frame (`fitTick`), their props on the buildings, the sockets block, the fit picker, the Lark's panel and the courier at the mast. `finds.js`: the rare-find moment (`lootMoment`), the item panel with compare, the stash's sort and filter, and "best for this job". The bench and fittings save as `workshop` in the claim's save.
  - Sound (no sound files: all synthesised live with Web Audio). The music is written as notes in `score.js` (each theme's chords, tunes, drum patterns and form; the notation is explained at its top, and every theme grows from one motif). `music.js` plays it, choosing the theme from the game's state and changing on bar lines, and runs the Music box in the settings. `audio.js` has the instruments, effects and ambience: `AUDIO.play(name, position)` plays an effect (unknown names are ignored; a position makes it quieter with distance), `AUDIO.loot(rarity)`, `AUDIO.rain(0..1)`.
  - `wildlight.js`: the Wildlight (`WL_KINDS`: Glimmer, Flarehound, Lodestar, Brightmaw), their climb up the cliff (`climbRoute`), hunting, and the turrets, the Lark and the watch.
  - `nights.js`: the shape of a night (`NIGHT`, `planNight`): the lookout's afternoon warning, the dusk banner, waves up their own cliffs, Bright Nights and their bosses (`BOSSES`), the boss bar, harm you can see (wall cracks and rubble, snuffed lamps, dimmed yards, the hurt limping home), the watch mending the wall by day, muzzle flashes and camera shake, and the dawn report.
  - `weather.js`: the day's weather and tomorrow's forecast (`WEATHER`, `forceWeather`), its moods by day and night (`weatherMood`, called from `applyTimeOfDay`), rain, fog, the cloud deck, puddles, lightning, the Lightning Rod building, and the weather in the clock.
  - `mine.js`: the dig, Fallout Shelter's side: a grid of rooms in the cut face (`MINE` in `core.js`: 6 rows, 10 columns west of the shaft), digging, merging (2 or 3 wide), room levels, the kinds of room and what they do, the lift cage, trouble down the mine (cave-ins, floods, gas, Wildlight breaking out), the Mine view's own pan and zoom, and the dig's panels. Rooms are pseudo-buildings with ids `m:row.col` (`d:row.col` while being dug), so jobs work as on buildings. `minelook.js`: how the dig looks: the rock front with a hole for every room, rooms dressed by row and level and furnished by kind, lamplight faked in the shaders (no extra lights), swaying lanterns, carts, the cage, visible trouble.
- `src/sky/`, `src/ship/`, `src/ships/`: the skies, the ship builder and the six ships, from the airship game. Ordinary ES modules.
- `src/shell.html`, `src/style.css`: the page and its look.
- `assets/claim/`: the claim's painted textures (from Briarwatch). `assets/map/`, `assets/ships/`, `assets/fonts/`: from the airship game.
- `assets/cast/`, `assets/portraits/`, `assets/items/`: pictures shown as they are (portraits on cards and in scenes, item pictures), inlined by the build as `ART.cast`, `ART.portraits`, `ART.items`, named by id. Shrink portraits to 256 × 256 and items to 128 × 128 (webp) before adding them.
- `src/sky/sites.js`: the claim-jumpers' places to raid.
- `reference/`: pictures to draw from; never loaded by the game.

## Checking a change

```
npm install
node tools/build.mjs            # dist/brightvein.html (open it) and dist/brightvein.artifact.html (publish it)
python3 test/smoke.py           # plays the claim and a voyage headless; must end with "all good"
python3 test/shot.py out.png 1280 800 "<js to run>" 6000 3000   # a screenshot after running some JS
node test/music.mjs             # the written music: every bar adds up, tunes sit on their chords, notes in range
python3 test/audio.py [--wav]   # renders every theme, effect and ambience offline and measures it (--wav: shots/audio/)
```

- `window.__bv` exposes the game for tests (`simulate(seconds)` runs the claim without drawing).
- Headless rendering is software (SwiftShader) and slow: test logic with `simulate`, and take few screenshots.
- The game is published at the Brightvein artifact link (see `README.md`). After a change, build, then publish `dist/brightvein.artifact.html` to that link (pass the url) so Chris's link keeps working.
