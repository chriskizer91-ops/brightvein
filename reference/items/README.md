# Item pictures from Chris's other games

Every item, weapon, relic, gem and material picture found on Chris's published pages: 208 pictures, to draw
from. The game never loads this folder. The ones that fit a Brightvein item were copied into `assets/items/` (see the
end of this page).

## Where they came from

| Page | What it had |
|---|---|
| [Envoi Keepsakes](https://claude.ai/artifact/AAtAnWcqszRj4qhVCfgPp5) | 20 painted keepsakes, Chris's pictures from Envoi's art request 14 (256×256, clear background). [Envoi on the Longest Night](https://claude.ai/artifact/BgSiyXBu53iW7DJVF1seV8) carries the same 20 files beside it (`art/keepsakes/`), byte for byte, so they are listed once. |
| [Quill's Swap Shop](https://claude.ai/artifact/C5A9gJTmrmYrvpmFvHMZzG) | 16 pixel-art curios (96×96), 10 herbs (128×128) and 8 little 16×16 icons drawn from character grids in the page's code. |
| [Thareia](https://claude.ai/artifact/P2yF7d3Maikrh1FiH3QgqK) | 79 relics and 41 base items, all drawn by the page's own code when it loads (no picture files). |
| [Aethermoor Loot Forge](https://claude.ai/artifact/7VLRxPNbLLjf6etdK87FW4) | 35 fixed pieces (four heroes' starting gear and the six drops), drawn by code. |
| [Aethermoor: Hearth & Heirloom](https://claude.ai/artifact/9i9bPrdG6ZY22xWnXgGUQa) | Drawn by the same code: its 12 relics and its base items come out exactly like Thareia's, and its 34 fixed pieces exactly like the Loot Forge's, so none are listed twice. |
| [Brightvein Armory](https://claude.ai/artifact/JrVbcx7tZvAU2fBummJ28d) | Brightvein's own catalogue. Its 32×32 icons are drawn by `src/claim/loot.js`, so nothing was copied from it. |

How they were taken:

- The keepsakes were turned into WebP without changing a pixel. Quill's WebP pictures were copied as they are.
- The code-drawn pictures were made by opening a local copy of each page in a headless browser and asking its own
  drawing code for each item at its own size, 64×64, with the page's drop shadow and rim light on a clear background
  (the pages put a coloured rarity backdrop behind them; that was left off). The rim light is tinted by the item's
  rarity in those games.
- Thareia draws a fresh look for every base item it drops (a seed picks the shapes and metals), so there is one
  example of each base item here, at Wrought rarity. Half plate draws exactly like full plate, so it is listed once.
- Left out: people, portraits, faces, scenes, ships, effects, and Quill's mandrake (Envoi's retired lore).
- Nothing on these pages credits another artist. The keepsake page calls its pictures Chris's; Quill's pixel
  pictures carry no credit at all, so they are taken to be his too; the rest are drawn by his games' own code.

In the last column, **bold** marks the 8 pictures now in `assets/items/`; plain text is a looser match, or a
note on why it doesn't fit.

## Envoi Keepsakes: painted keepsakes (20)

| File | What it is | Size | Style | Could stand in for |
|---|---|---|---|---|
| `envoi-keepsakes-crescent-locket.webp` | The Crescent Locket: a little locket with a crescent moon on its lid and a moonstone in it, on a fine chain | 256×256 | painted | no: a moon locket, Io's |
| `envoi-keepsakes-knotted-shawl.webp` | Nettie's Knotted Shawl: a plum-purple shawl knotted at the front, edged with cream lace and tassels, a little crescent moon stitched in its corner | 256×256 | painted | - |
| `envoi-keepsakes-fen-heart-lamp.webp` | The Fen-Heart Lamp: a little brass lantern with green glass panes, a warm flame still burning inside | 256×256 | painted | - |
| `envoi-keepsakes-moonglass.webp` | Ysmera's Moonglass: a hand mirror of pale, pearly moon-glass in a gilded frame, a crescent at its crown | 256×256 | painted | - |
| `envoi-keepsakes-pass-bell.webp` | The Pass Bell: a bronze hand-bell rimed with frost and hung with icicles, on a leather-wrapped handle | 256×256 | painted | - |
| `envoi-keepsakes-heart-seed.webp` | The Colossus Heart-Seed: a seed shaped like a heart, woven of bramble round a glowing amber core, a green leaf at its top | 256×256 | painted | - |
| `envoi-keepsakes-wardens-brooch.webp` | The Warden's Brooch: a round bronze brooch, a bird with its wings spread round a glowing ember-red stone | 256×256 | painted | - |
| `envoi-keepsakes-hall-gauntlets.webp` | The Wardens' Hall Gauntlets: a pair of plate gauntlets in steel and bronze, every plate engraved | 256×256 | painted | loosely `clock-gauntlets` or `lensguild-gauntlets` (engraved plate, but no gears) |
| `envoi-keepsakes-node-sunstone.webp` | The Node Sunstone: a glowing amber sunstone in a bronze setting, a little sun worked beneath it | 256×256 | painted | **`beacon-heart`** (used): a cut crystal in a mount. Would also do for `sunstone-locket` |
| `envoi-keepsakes-crossroads-pennant.webp` | The Crossroads Pennant: a red pennant edged in gold, tasselled, on a short staff | 256×256 | painted | - |
| `envoi-keepsakes-hearth-coal.webp` | Ede's Hearth-Coal: a glowing coal in a little cage of bronze wire on a leather cord | 256×256 | painted | loosely `spare-cell` (a cage, but a coal, not a crystal cell) |
| `envoi-keepsakes-colossus-thorn.webp` | The Colossus Thorn: a great curved thorn, red as embers, its base bound in leather as a grip | 256×256 | painted | - |
| `envoi-keepsakes-forge-horseshoe.webp` | The Forge Horseshoe: an iron horseshoe still glowing copper at its edges, its nail holes empty | 256×256 | painted | - |
| `envoi-keepsakes-jetty-coin.webp` | The Jetty Coin: an old copper coin with a little sailing boat on its face, green with age at the rim | 256×256 | painted | **`gnome-coin`** (used) |
| `envoi-keepsakes-frog-ring.webp` | The Thornwood Frog-Ring: a bronze ring with a little green frog sitting on it | 256×256 | painted | - |
| `envoi-keepsakes-hag-stone.webp` | The Bogmire Hag-Stone: a speckled grey stone with a hole worn through it, on a loop of rough twine | 256×256 | painted | - |
| `envoi-keepsakes-bogstriders.webp` | The Bogstriders: worn leather boots with moss-green cuffs and thick studded soles | 256×256 | painted | **`hobnails`** (used): the studded soles are hobnails |
| `envoi-keepsakes-kettle-helm.webp` | The Dawnroost Kettle-Helm: a round iron helm with bronze studs, a little rooster weather vane on top | 256×256 | painted | no: the rooster vane makes it Envoi's |
| `envoi-keepsakes-dockhand-gloves.webp` | The Dockhand's Gloves: worn brown leather gloves with sea-green cuffs | 256×256 | painted | **`work-gloves`** (used) |
| `envoi-keepsakes-misthollow-cowl.webp` | The Misthollow Cowl: a frost-white hooded cowl, blue snowflakes stitched round its edge, a silver clasp | 256×256 | painted | - |

## Quill's Swap Shop: pixel-art curios, herbs and little icons (34)

| File | What it is | Size | Style | Could stand in for |
|---|---|---|---|---|
| `quill-charm-horseshoe.webp` | Horseshoe charm: an iron horseshoe charm | 96×96 | pixel art | - |
| `quill-charm-owl.webp` | Owl charm: a little carved owl | 96×96 | pixel art | - |
| `quill-charm-bell.webp` | Bell charm: a silver bell with a crescent moon | 96×96 | pixel art | - |
| `quill-heartsease-tonic.webp` | Heartsease Tonic: a pink potion in a heart-shaped bottle | 96×96 | pixel art | - |
| `quill-hush-tea.webp` | Hush Tea: a violet flask tied with lavender | 96×96 | pixel art | - |
| `quill-warming-balm.webp` | Warming Balm: an open tin of red balm | 96×96 | pixel art | - |
| `quill-lantern-oil.webp` | Lantern Oil: a brass oil pot | 96×96 | pixel art | - |
| `quill-remembrance-incense.webp` | Remembrance Incense: an incense cone on a dish | 96×96 | pixel art | - |
| `quill-wisp-calm.webp` | Wisp-Calm: a slim green vial | 96×96 | pixel art | - |
| `quill-swamp-tea.webp` | Swamp Tea: a teacup of green tea | 96×96 | pixel art | - |
| `quill-hiccup-tonic.webp` | Hiccup Tonic: a purple flask | 96×96 | pixel art | - |
| `quill-droopy-hat-draught.webp` | Droopy-Hat Draught: a blue flask with a bent neck | 96×96 | pixel art | - |
| `quill-wisp-jar.webp` | Wisp jar: a corked jar with a green wisp inside | 96×96 | pixel art | - |
| `quill-grave-candle.webp` | Grave candle: a black candle stub in a holder | 96×96 | pixel art | - |
| `quill-hag-stone.webp` | Hag-stone: a holed grey stone on twine | 96×96 | pixel art | - |
| `quill-moonwater.webp` | Moonwater: a round bottle of moonlit water | 96×96 | pixel art | - |
| `quill-lavender.webp` | Lavender (herb) | 128×128 | pixel art | - |
| `quill-moonpetal.webp` | Moonpetal (herb) | 128×128 | pixel art | - |
| `quill-witchs-bells.webp` | Witch's bells (herb) | 128×128 | pixel art | - |
| `quill-nightrose.webp` | Nightrose (herb) | 128×128 | pixel art | - |
| `quill-chapel-moss.webp` | Chapel moss (herb) | 128×128 | pixel art | - |
| `quill-silver-mugwort.webp` | Silver mugwort (herb) | 128×128 | pixel art | - |
| `quill-ember-star-lily.webp` | Ember-star lily (herb) | 128×128 | pixel art | - |
| `quill-wisp-sprout.webp` | Wisp-sprout (herb) | 128×128 | pixel art | - |
| `quill-bogwick.webp` | Bogwick (herb) | 128×128 | pixel art | - |
| `quill-glowcap.webp` | Glowcap (herb) | 128×128 | pixel art | - |
| `quill-bog-amber.webp` | Bog Amber: a gem of amber (a 16-pixel icon) | 16×16 | pixel art | - |
| `quill-bow-lamp.webp` | The bow-lamp: a little lamp with a violet flame (a 16-pixel icon) | 16×16 | pixel art | - |
| `quill-brass-spyglass.webp` | Brass spyglass (a 16-pixel icon) | 16×16 | pixel art | reads as `spyglass`, but only 16 px: smaller than the game's own icons |
| `quill-eldergrown-amulet.webp` | Eldergrown amulet: a copper charm (a 16-pixel icon) | 16×16 | pixel art | - |
| `quill-mossbound-boots.webp` | Mossbound boots (a 16-pixel icon) | 16×16 | pixel art | - |
| `quill-veilkissed-focus.webp` | Veilkissed focus: a pale stone (a 16-pixel icon) | 16×16 | pixel art | - |
| `quill-wickhollow-flame.webp` | Wickhollow flame: a violet witchfire flame (a 16-pixel icon) | 16×16 | pixel art | - |
| `quill-willowmurk-gloves.webp` | Willowmurk gloves: fen-lace riding gloves (a 16-pixel icon) | 16×16 | pixel art | - |

## Thareia: relics, then base items (drawn by code) (119)

| File | What it is | Size | Style | Could stand in for |
|---|---|---|---|---|
| `thareia-anvil-heart.webp` | The Anvil Heart: heirloom amulet relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-ashen-aegis.webp` | The Ashen Aegis: heirloom shield relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-barge-gauntlets.webp` | The Barge-Chain Gauntlets: heirloom gauntlets relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-bogstriders.webp` | The Bogstriders: heirloom boots relic, verdant | 64×64 | pixel art, drawn by code | `hobnails` (painted Bogstriders used) |
| `thareia-briarfang.webp` | Briarfang: heirloom dagger relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-cairnmaul.webp` | Cairnmaul: heirloom hammer relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-cantors-staff.webp` | The Cantor's Staff: heirloom staff relic, tide | 64×64 | pixel art, drawn by code | - |
| `thareia-cinder-crown.webp` | The Cinder Crown: heirloom helm relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-cinderfang.webp` | Cinderfang: heirloom sword relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-corvus-harpoon.webp` | Corvus's Harpoon: heirloom spear relic, tide | 64×64 | pixel art, drawn by code | no: a hand harpoon; Brightvein's `harpoon` is a launcher |
| `thareia-cutters-pick.webp` | The Cutter's Pick: heirloom axe relic, frost | 64×64 | pixel art, drawn by code | a pick, but frost-blue; `pick` and `prospectors-promise` are Steam |
| `thareia-dawnbell.webp` | Dawnbell: heirloom mace relic, radiant | 64×64 | pixel art, drawn by code | - |
| `thareia-deep-pearl.webp` | The Deep-Pearl: heirloom amulet relic, tide | 64×64 | pixel art, drawn by code | - |
| `thareia-drowned-censer.webp` | The Drowned Censer: heirloom focus (off-hand) relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-dunebreaker.webp` | Dunebreaker: heirloom hammer relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-fawnrest-heartstone.webp` | The Fawnrest Heartstone: heirloom amulet relic, ember | 64×64 | pixel art, drawn by code | `sunstone-locket`, loosely |
| `thareia-fenwicks-poker.webp` | Fenwick's Poker: primal mace relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-first-seed.webp` | The First Seed: heirloom amulet relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-gar-tooth.webp` | The Gar's Tooth: heirloom dagger relic, tide | 64×64 | pixel art, drawn by code | - |
| `thareia-glass-carapace.webp` | The Glass Carapace: heirloom plate armour relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-hag-stone.webp` | The Hag-Stone: heirloom ring relic, blight | 64×64 | pixel art, drawn by code | - |
| `thareia-hartshorn.webp` | Hartshorn: heirloom bow relic, storm | 64×64 | pixel art, drawn by code | - |
| `thareia-hearthbrand.webp` | Hearthbrand: heirloom sword relic, ember | 64×64 | pixel art, drawn by code | **`hearthbrand-refit`** (used): the very sword that relic refits |
| `thareia-hexbane-shawl.webp` | Nettie's Hexbane Shawl: heirloom robe relic, blight | 64×64 | pixel art, drawn by code | - |
| `thareia-hollow-chain.webp` | The Hollow Chain: regalia amulet relic, blight | 64×64 | pixel art, drawn by code | - |
| `thareia-hollow-chalice.webp` | The Hollow Chalice: regalia focus (off-hand) relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-hollow-gauntlet.webp` | The Hollow Gauntlet: regalia gauntlets relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-hollow-wreath.webp` | The Hollow Wreath: regalia circlet relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-hushweave-cowl.webp` | The Hushweave Cowl: heirloom hood relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-ichor-mask.webp` | Ichor Mask: heirloom helm relic, blight | 64×64 | pixel art, drawn by code | - |
| `thareia-ironvein-apron.webp` | The Ironvein Apron: regalia leather armour relic, stone | 64×64 | pixel art, drawn by code | **`apron`** (used). Would also do for `wallwright-apron` |
| `thareia-ironvein-bracers.webp` | Ironvein Bracers: heirloom gauntlets relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-ironwall.webp` | Ironwall: heirloom shield relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-isoldes-oath.webp` | Isolde's Oath: heirloom sword relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-lamplighters-lantern.webp` | The Lamplighter's Lantern: heirloom focus (off-hand) relic, radiant | 64×64 | pixel art, drawn by code | - |
| `thareia-lightfingers.webp` | Lightfingers: heirloom gloves relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-mirage-glass.webp` | The Mirage Glass: heirloom amulet relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-mire-pearl.webp` | Mire Pearl: heirloom ring relic, tide | 64×64 | pixel art, drawn by code | - |
| `thareia-mosswatch-lantern.webp` | Mosswatch Lantern: heirloom focus (off-hand) relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-mourning-veil.webp` | The Mourning Veil: heirloom hood relic, tide | 64×64 | pixel art, drawn by code | - |
| `thareia-oathshield.webp` | Oathshield: heirloom shield relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-qasims-signet.webp` | Qasim's Signet: heirloom ring relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-rime-crozier.webp` | The Rime Crozier: heirloom staff relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-roc-feather-cloak.webp` | The Roc-Feather Cloak: heirloom leather armour relic, storm | 64×64 | pixel art, drawn by code | - |
| `thareia-rootsong.webp` | Rootsong: heirloom staff relic, tide | 64×64 | pixel art, drawn by code | - |
| `thareia-rotwood-circlet.webp` | Rotwood Circlet: heirloom circlet relic, blight | 64×64 | pixel art, drawn by code | - |
| `thareia-runestaff.webp` | Harrow's Runestaff: heirloom staff relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-saltglass.webp` | Saltglass: heirloom bow relic, storm | 64×64 | pixel art, drawn by code | - |
| `thareia-salvagers-helm.webp` | The Salvager's Helm: heirloom helm relic, tide | 64×64 | pixel art, drawn by code | **`brass-lung`** (used): a crusted brass diving helm. Would also do for `diving-helm` |
| `thareia-sandwalkers.webp` | Sandwalkers: heirloom boots relic, storm | 64×64 | pixel art, drawn by code | - |
| `thareia-scorchgate-key.webp` | The Scorchgate Key: heirloom ring relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-stillwater-lance.webp` | Stillwater Lance: heirloom spear relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-sunstone-heart.webp` | The Sunstone Heart: heirloom amulet relic, ember | 64×64 | pixel art, drawn by code | `sunstone-locket` (the Loot Forge locket was used instead) |
| `thareia-sunstone-lantern.webp` | Sunstone Lantern: heirloom focus (off-hand) relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-tallyknife.webp` | Tallyknife: storied dagger relic, blight | 64×64 | pixel art, drawn by code | - |
| `thareia-tamsins-bargain.webp` | Tamsin's Bargain: regalia sword relic, blight | 64×64 | pixel art, drawn by code | - |
| `thareia-th-crateknife.webp` | Crateknife: storied dagger relic, blight | 64×64 | pixel art, drawn by code | - |
| `thareia-th-lightfingers.webp` | Lightfingers: heirloom gloves relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-th-thornwreath.webp` | Thornwreath: heirloom crown relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-thanes-rune.webp` | The Thane's Rune-Key: heirloom ring relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-thornsplitter.webp` | Thornsplitter Hatchet: heirloom axe relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-thornwatch-boots.webp` | Thornwatch Boots: regalia boots relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-thornwatch-hood.webp` | Thornwatch Hood: regalia hood relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-thornwatch-jerkin.webp` | Thornwatch Jerkin: regalia leather armour relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-thornwreath.webp` | Thornwreath: heirloom crown relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-trollhide-mantle.webp` | The Trollhide Mantle: heirloom leather armour relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-unfair-toll.webp` | Hodge's Unfair Toll: heirloom amulet relic, tide | 64×64 | pixel art, drawn by code | `gnome-coin`, loosely (painted Jetty Coin used) |
| `thareia-unmaking-hammer.webp` | The Unmaking Hammer: regalia hammer relic, ember | 64×64 | pixel art, drawn by code | - |
| `thareia-vale-gauntlets.webp` | Vale Gauntlets: heirloom gauntlets relic, storm | 64×64 | pixel art, drawn by code | - |
| `thareia-veilbell.webp` | The Veilbell: heirloom amulet relic, frost | 64×64 | pixel art, drawn by code | - |
| `thareia-wardens-seal.webp` | The Warden's Seal: storied amulet relic, radiant | 64×64 | pixel art, drawn by code | - |
| `thareia-watchkeepers-kettle.webp` | Watchkeeper's Kettle: heirloom kettle helm relic, storm | 64×64 | pixel art, drawn by code | - |
| `thareia-weeping-bow.webp` | The Weeping Bow: heirloom bow relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-willow-ward.webp` | The Willow-Ward: heirloom shield relic, verdant | 64×64 | pixel art, drawn by code | - |
| `thareia-windstep-boots.webp` | Windstep Boots: heirloom boots relic, storm | 64×64 | pixel art, drawn by code | - |
| `thareia-worldforge-hammer.webp` | The Worldforge Hammer: heirloom hammer relic, ember | 64×64 | pixel art, drawn by code | the forge the Worldforge Engine came from (lore only) |
| `thareia-worldforge-heart.webp` | The Worldforge Heart: primal ring relic, ember | 64×64 | pixel art, drawn by code | what `worldforge-engine` was before its refit (a ring here, not a pocket engine) |
| `thareia-wyrmscale.webp` | Wyrmscale: heirloom shield relic, stone | 64×64 | pixel art, drawn by code | - |
| `thareia-zaras-orrery.webp` | The Orrery of Hours: heirloom amulet relic, storm | 64×64 | pixel art, drawn by code | - |
| `thareia-amulet.webp` | Copper Amulet: base amulet, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-arming-sword.webp` | Arming Sword: base sword, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-bearded-axe.webp` | Bearded Axe: base axe, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-belt-knife.webp` | Belt Knife: base dagger, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-boar-spear.webp` | Boar Spear: base spear, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-boots.webp` | Travel Boots: base boots, one example (Wrought) | 64×64 | pixel art, drawn by code | `hobnails`, loosely |
| `thareia-brigandine.webp` | Brigandine: base leather armour, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-bronze-crown.webp` | Bronze Crown: base crown, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-buckler.webp` | Buckler: base shield, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-chain-shirt.webp` | Chain Shirt: base mail, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-circlet.webp` | Circlet: base circlet, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-flanged-mace.webp` | Flanged Mace: base mace, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-full-plate.webp` | Full Plate: base plate armour, one example (Wrought) (half plate draws the same) | 64×64 | pixel art, drawn by code | - |
| `thareia-gauntlets.webp` | Gauntlets: base gauntlets, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-gloves.webp` | Riding Gloves: base gloves, one example (Wrought) | 64×64 | pixel art, drawn by code | `work-gloves` (painted Dockhand's Gloves used) |
| `thareia-great-helm.webp` | Great Helm: base helm, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-greatsword.webp` | Greatsword: base sword, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-hand-axe.webp` | Hand Axe: base axe, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-hauberk.webp` | Hauberk: base mail, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-heater-shield.webp` | Heater Shield: base shield, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-holy-symbol.webp` | Holy Symbol: base focus (off-hand), one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-hood.webp` | Hood: base hood, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-ironshod-boots.webp` | Ironshod Boots: base boots, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-jerkin.webp` | Leather Jerkin: base leather armour, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-kettle-helm.webp` | Kettle Helm: base kettle helm, one example (Wrought) | 64×64 | pixel art, drawn by code | loosely `wallwright-helm` (a plain pot, no rivets or mason's mark) |
| `thareia-longbow.webp` | Longbow: base bow, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-longsword.webp` | Longsword: base sword, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-mace.webp` | Mace: base mace, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-mail-coif.webp` | Mail Coif: base coif, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-maul.webp` | Maul: base hammer, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-quarterstaff.webp` | Quarterstaff: base staff, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-ring.webp` | Iron Band: base ring, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-robe.webp` | Robe: base robe, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-rondel.webp` | Rondel Dagger: base dagger, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-rowan-staff.webp` | Rowan Staff: base staff, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-rune-focus.webp` | Rune Focus: base focus (off-hand), one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-shortbow.webp` | Shortbow: base bow, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-spear.webp` | Spear: base spear, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-tower-shield.webp` | Tower Shield: base shield, one example (Wrought) | 64×64 | pixel art, drawn by code | - |
| `thareia-warhammer.webp` | Warhammer: base hammer, one example (Wrought) | 64×64 | pixel art, drawn by code | - |

## Aethermoor Loot Forge: its fixed pieces (drawn by code) (35)

| File | What it is | Size | Style | Could stand in for |
|---|---|---|---|---|
| `lootforge-apron.webp` | Forge-Scale Apron: common body | 64×64 | pixel art, drawn by code | - |
| `lootforge-ashring.webp` | Ash Ring: common ring | 64×64 | pixel art, drawn by code | - |
| `lootforge-bogbow.webp` | Bogwater Longbow: rare weapon | 64×64 | pixel art, drawn by code | - |
| `lootforge-bracers.webp` | Archer's Bracers: uncommon hands | 64×64 | pixel art, drawn by code | - |
| `lootforge-buckler.webp` | Pine Buckler: common offhand | 64×64 | pixel art, drawn by code | - |
| `lootforge-chainshirt.webp` | Chain Shirt: common body | 64×64 | pixel art, drawn by code | - |
| `lootforge-circlet.webp` | Ember Circlet: uncommon head | 64×64 | pixel art, drawn by code | - |
| `lootforge-coif.webp` | Soot-Black Coif: common head | 64×64 | pixel art, drawn by code | - |
| `lootforge-copperband.webp` | Copper Band: common ring | 64×64 | pixel art, drawn by code | - |
| `lootforge-crown.webp` | Crown of the Drowned Bells: mythic head | 64×64 | pixel art, drawn by code | - |
| `lootforge-emberheart.webp` | Emberheart: legendary weapon | 64×64 | pixel art, drawn by code | - |
| `lootforge-gauntlets.webp` | Smith's Gauntlets: common hands | 64×64 | pixel art, drawn by code | - |
| `lootforge-hauberk.webp` | Gloomfen Scale Hauberk: uncommon body | 64×64 | pixel art, drawn by code | - |
| `lootforge-hidegloves.webp` | Hide Gloves: common hands | 64×64 | pixel art, drawn by code | `work-gloves` (painted Dockhand's Gloves used) |
| `lootforge-hood.webp` | Mossgreen Hood: common head | 64×64 | pixel art, drawn by code | - |
| `lootforge-ironboots.webp` | Ironshod Boots: common feet | 64×64 | pixel art, drawn by code | - |
| `lootforge-kettle.webp` | Dented Kettle Helm: common head | 64×64 | pixel art, drawn by code | loosely `wallwright-helm` |
| `lootforge-locket.webp` | Hearth-Ash Locket: uncommon amulet | 64×64 | pixel art, drawn by code | **`sunstone-locket`** (used): a locket with a glowing amber core |
| `lootforge-mace.webp` | Tinder Mace: uncommon weapon | 64×64 | pixel art, drawn by code | - |
| `lootforge-marshboots.webp` | Marsh Boots: common feet | 64×64 | pixel art, drawn by code | `hobnails`, loosely |
| `lootforge-oath.webp` | Ironvein's Oath: epic weapon | 64×64 | pixel art, drawn by code | - |
| `lootforge-prayerbeads.webp` | Ashwood Prayer Beads: common amulet | 64×64 | pixel art, drawn by code | - |
| `lootforge-reedcharm.webp` | Reed Charm: common amulet | 64×64 | pixel art, drawn by code | - |
| `lootforge-robes.webp` | Hearthkeeper Robes: common body | 64×64 | pixel art, drawn by code | - |
| `lootforge-roundshield.webp` | Riveted Round Shield: common offhand | 64×64 | pixel art, drawn by code | - |
| `lootforge-rusted.webp` | Rusted Militia Sword: common weapon | 64×64 | pixel art, drawn by code | - |
| `lootforge-sandals.webp` | Pilgrim Sandals: common feet | 64×64 | pixel art, drawn by code | - |
| `lootforge-shortsword.webp` | Chipped Shortsword: common weapon | 64×64 | pixel art, drawn by code | - |
| `lootforge-sigil.webp` | Hearth Sigil: uncommon offhand | 64×64 | pixel art, drawn by code | - |
| `lootforge-signet.webp` | Anvil Signet: uncommon ring | 64×64 | pixel art, drawn by code | - |
| `lootforge-smith.webp` | Smith's Hammer: common weapon | 64×64 | pixel art, drawn by code | - |
| `lootforge-softboots.webp` | Soft Boots: common feet | 64×64 | pixel art, drawn by code | - |
| `lootforge-studded.webp` | Studded Leather: common body | 64×64 | pixel art, drawn by code | - |
| `lootforge-wraps.webp` | Linen Wraps: common hands | 64×64 | pixel art, drawn by code | - |
| `lootforge-yew.webp` | Yew Shortbow: common weapon | 64×64 | pixel art, drawn by code | - |

## What went into `assets/items/`

Eight pictures fit a Brightvein item well enough to show in the game now. Each is 128×128 with a clear background,
named after the item's id in `src/claim/loot.js`:

| Game picture | Brightvein item | From | How it was made |
|---|---|---|---|
| `work-gloves.webp` | Work Gloves | Envoi Keepsakes: The Dockhand's Gloves | painted, 256 shrunk to 128 |
| `hobnails.webp` | Hobnail Boots | Envoi Keepsakes: The Bogstriders | painted, 256 shrunk to 128 |
| `gnome-coin.webp` | Gnome-Minted Coin | Envoi Keepsakes: The Jetty Coin | painted, 256 shrunk to 128 |
| `beacon-heart.webp` | The Beacon Heart | Envoi Keepsakes: The Node Sunstone | painted, 256 shrunk to 128 |
| `hearthbrand-refit.webp` | Hearthbrand, Refitted | Thareia: Hearthbrand | pixel art, 64 doubled to 128 |
| `brass-lung.webp` | The Brass Lung | Thareia: The Salvager's Helm | pixel art, 64 doubled to 128 |
| `apron.webp` | Leather Apron | Thareia: The Ironvein Apron | pixel art, 64 doubled to 128 |
| `sunstone-locket.webp` | Sunstone Locket | Loot Forge: Hearth-Ash Locket | pixel art, 64 doubled to 128 |

The four pixel ones were drawn again with a plain grey rim light instead of their old games' rarity colours, so they
don't clash with Brightvein's own rarity colours. Pixel art was only ever doubled whole (each pixel becomes a 2×2
block), so it stays crisp. Prompts for every other item, and for redoing these eight later in one matching
style, are in `docs/art-requests/02-items.md`.
