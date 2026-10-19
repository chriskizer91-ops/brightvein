# CLAUDE.md

## Repository rules

- This is the only repository to write to for Brightvein.
- These sibling repositories are read-only references, set in the same world. Reuse their assets, mechanics and code when useful, but never commit to them:
  - `chriskizer91-ops/airship-game-in-aethermoor-` (the skies: flight, guns, raiders, the six ships, the map)
  - `chriskizer91-ops/envoi-on-the-longest-night` (Io, Sol, Halcyon, Quill, Brann and the gnomes; their sprites and portraits)
  - `chriskizer91-ops/moon-faire` (the four witch performers and their festival airship)
- When copying assets or code from a sibling repo, note the source repo and path in the commit message.
- A sibling's own lore outranks anything written here about its characters. Envoi's retired lore stays out: the Drowned Mother, Old Snuff, the mandrakes and Mother's Hollow.

## Project

- *Brightvein*: a sunstone claim on a plateau under the Thinning, in Aethermoor (Chris's D&D world). Fallout Shelter's staffed rooms and people with stats, Clash of Clans' base building and defence, and the airship game's skies.
- Its own story: the claim, the Wildlight and the claim-jumpers are Brightvein's. Characters from Chris's other games visit (Io and Sol arrive on the Magpie, the Moon Faire's airship tours in) and can stay as special crew. Don't retell their games' plots.
- Design notes: `docs/design.md` (the whole game), `docs/keep.md` (the Keep and study), the claude.ai project docs `brightvein-design.md` and `brightvein-keep-design.md`.
- Look: HD-2D. A lit 3D diorama with pixel-art people as camera-facing sprites. People are hand-pixeled in code (`src/claim/pixel.js`): 24 × 32 frames, 5 columns (stand, step A, step B, work up, work down) × 3 rows (facing you, facing away, facing left; right is mirrored).
- Desktop first (Chris, October 18), but phones must keep working: touch controls and the Light detail setting.
- Chris tries things on his phone. Every step should end with something he can open there. Write anything Chris reads in plain words.
- When new art is needed, write the picture prompts as markdown files in `docs/art-requests/` for Chris to generate.

## Code

- `src/claim/`: the claim (town, Keep, mine, people, Wildlight, loot, UI). One shared scope: its files are joined in the order of `src/claim/order.json` into one module. Add a file there to add it to the build.
- `src/sky/`, `src/ship/`, `src/ships/`: the skies, the ship builder and the six ships, from the airship game. Ordinary ES modules.
- `src/shell.html`, `src/style.css`: the page and its look.
- `assets/claim/`: the claim's painted textures (from Briarwatch). `assets/map/`, `assets/ships/`, `assets/fonts/`: from the airship game.
- `reference/`: pictures to draw from; never loaded by the game.

## Checking a change

```
npm install
node tools/build.mjs            # dist/brightvein.html (open it) and dist/brightvein.artifact.html (publish it)
python3 test/smoke.py           # plays the claim and a voyage headless; must end with "all good"
python3 test/shot.py out.png 1280 800 "<js to run>" 6000 3000   # a screenshot after running some JS
```

- `window.__bv` exposes the game for tests (`simulate(seconds)` runs the claim without drawing).
- Headless rendering is software (SwiftShader) and slow: test logic with `simulate`, and take few screenshots.
- The game is published at the Brightvein artifact link (see `README.md`). After a change, build, then publish `dist/brightvein.artifact.html` to that link (pass the url) so Chris's link keeps working.
