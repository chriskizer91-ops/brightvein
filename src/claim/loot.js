// ===================================================================== LOOT: the Armory's data, engine and pixel icons
const D = (() => {
// Brightvein loot data. Mechanics carried over from Aethermoor (rarity ladder, luck curve,
// prefix/suffix traits, enemy-tier drops, salvage → retune → overhaul → cells → attune),
// re-themed for the claim era: brass, steam, lenses, sunstone cells and growing things.
// Numbers are scaled to the demo: Wildlight 26 HP + 6 per night; the watch hits for ~2.2 × Grit per second.

const ASPECTS = {
  glare: { name: "Glare", color: "#ffc35a", text: "Focused sunlight. Burns claim-jumpers; overloads Wildlight." },
  arc:   { name: "Arc",   color: "#7fd6ff", text: "Aether discharge from charged crystal. Jumps between targets." },
  steam: { name: "Steam", color: "#d9d2c3", text: "Pressure and piston. Plain hard hitting; knocks back." },
  shade: { name: "Shade", color: "#9a7cff", text: "Smoked glass and umbral weave that drinks light. Wildlight hate it." },
  rime:  { name: "Rime",  color: "#bdf0ff", text: "Coolant that slows and stops crystal overheating." },
  chime: { name: "Chime", color: "#f7a8d8", text: "Resonance. A tuned note shatters creatures made of crystal light." },
};

const SLOTS = {
  hand:    { name: "Hand",    text: "Tool or weapon. Most double as the job's tool." },
  offhand: { name: "Off-hand", text: "Buckler, lantern, gauge or ledger." },
  head:    { name: "Head",    text: "Goggles, helms, caps." },
  rig:     { name: "Rig",     text: "Coats, aprons, plating, harnesses." },
  hands:   { name: "Gloves",  text: "Work gloves and gauntlets." },
  boots:   { name: "Boots",   text: "Boots." },
  charm:   { name: "Charm",   text: "Watches, lockets, cells, lucky coins." },
  module:  { name: "Module",  text: "Fitted into a building. Each building level opens a socket." },
  lark:    { name: "Lark part", text: "Fitted to the airship." },
};
const SLOT_WEIGHT = { hand: 3, rig: 2, head: 2, offhand: 1.4, hands: 1, boots: 1, charm: 0.8 };

// ---------------------------------------------------------------- rarity ladder
// Same shape as Aethermoor's Worn → Primal. Ranks 0–4 drop at random, 5–7 are hand-made.
const RARITY_ORDER = ["salvage", "tooled", "tuned", "calibrated", "signed", "masterwork", "guild", "sunforged"];
const RANDOM_RARITIES = ["salvage", "tooled", "tuned", "calibrated", "signed"];
const RARITY = {
  salvage:    { rank: 0, name: "Salvage",    color: "#8b8b8b", affixes: 0, statMult: 1.00, cells: 0, dropWeight: 100, text: "Scavenged and patched. Base stats only." },
  tooled:     { rank: 1, name: "Tooled",     color: "#f1e4c6", affixes: 1, statMult: 1.00, cells: 0, dropWeight: 55,  text: "Workshop-made. One trait." },
  tuned:      { rank: 2, name: "Tuned",      color: "#7cc95a", affixes: 2, statMult: 1.10, cells: 0, dropWeight: 22,  text: "Set up by someone who cared. Two traits." },
  calibrated: { rank: 3, name: "Calibrated", color: "#4f9be8", affixes: 3, statMult: 1.20, cells: 1, dropWeight: 7,   text: "Three traits and a cell socket." },
  signed:     { rank: 4, name: "Signed",     color: "#a866e8", affixes: 3, statMult: 1.35, cells: 1, dropWeight: 1.5, unassayed: true, text: "A maker's mark, a serial number and a logbook line. A minor power. Arrives unassayed until Absalom reads the mark." },
  masterwork: { rank: 5, name: "Masterwork", color: "#e6b955", affixes: 0, statMult: 1.50, cells: 2, dropWeight: 0,   handmade: true, text: "Named, one of a kind. A signature power, and often a town power." },
  guild:      { rank: 6, name: "Guild",      color: "#2fb8a6", affixes: 0, statMult: 1.50, cells: 1, dropWeight: 0,   handmade: true, set: true, text: "Guild-issue sets. Wear more of the set for set bonuses." },
  sunforged:  { rank: 7, name: "Sunforged",  color: "#fff6dc", affixes: 0, statMult: 1.80, cells: 3, dropWeight: 0,   handmade: true, text: "Old-age Aethermoor relics dug out of the deep seam and refitted with sunstone. White flame." },
};

// ---------------------------------------------------------------- base items (random drops, craftable once the blueprint is found)
// weapon: dmg per hit, cd seconds between hits, range in metres, scales with stat (+8% per point).
// tool: { job, out } = +out% output at that job. armor: guard = % less harm taken, hp = extra health.
const W = (id, name, kind, minLvl, jobs, weapon, o = {}) => ({ id, name, slot: "hand", kind, minLvl, jobs, weapon, ...o });
const A = (id, name, slot, kind, minLvl, o = {}) => ({ id, name, slot, kind, minLvl, ...o });
const ITEMS = Object.fromEntries([
  // melee
  W("pick", "Prospector's Pick", "pick", 1, ["head"], { dmg: 5, cd: 0.6, range: 1.5, aspect: "steam", stat: "G" }, { tool: { job: "head", out: 10 }, text: "The first thing anyone on the claim owns." }),
  W("steam-drill", "Steam Drill", "drill", 6, ["head"], { dmg: 9, cd: 0.8, range: 1.5, aspect: "steam", stat: "G" }, { tool: { job: "head", out: 25 }, text: "A boiler on your back and a screw on your arm." }),
  W("spanner", "Knuckle Spanner", "spanner", 1, ["shop"], { dmg: 4, cd: 0.5, range: 1.2, aspect: "steam", stat: "E" }, { tool: { job: "shop", out: 10 }, text: "Fits every nut on the claim and most jaws." }),
  W("piston-hammer", "Piston Hammer", "hammer", 4, ["shop", "wall"], { dmg: 12, cd: 1.2, range: 1.6, aspect: "steam", stat: "G" }, { tool: { job: "shop", out: 15 }, text: "Drives rivets. Drives Wildlight back down the cliff." }),
  W("machete", "Sunsteel Machete", "machete", 1, ["garden"], { dmg: 6, cd: 0.5, range: 1.4, aspect: "steam", stat: "A" }, { tool: { job: "garden", out: 8 }, text: "For brush, vines and anything that glows wrong." }),
  W("earthing-lance", "Earthing Lance", "lance", 1, ["wall"], { dmg: 7, cd: 0.6, range: 2.4, aspect: "arc", stat: "G" }, { text: "Copper-shod. Bleeds a Wildlight's light into the ground." }),
  W("clock-halberd", "Clockwork Halberd", "halberd", 5, ["wall"], { dmg: 11, cd: 0.9, range: 2.6, aspect: "steam", stat: "G" }, { text: "Wind the key and the blade swings itself on the backstroke." }),
  W("shade-hook", "Shade Hook", "hook", 3, ["wall"], { dmg: 6, cd: 0.5, range: 2.0, aspect: "shade", stat: "A" }, { text: "Smoked-glass barb on a pole. Catches Wildlight and drags them dim." }),
  W("tuning-fork", "Tuning Fork", "fork", 7, ["shop", "wall"], { dmg: 10, cd: 1.0, range: 1.8, aspect: "chime", stat: "E" }, { tool: { job: "shop", out: 10 }, text: "Struck once, it rings at the pitch of raw sunstone." }),
  // ranged
  W("flare-pistol", "Pepperbox Flare Pistol", "pistol", 1, ["mast", "wall"], { dmg: 8, cd: 1.4, range: 14, aspect: "glare", stat: "A" }, { text: "Four barrels of signal flare. Marks a target for the towers." }),
  W("rivet-gun", "Rivet Gun", "rivet", 3, ["shop"], { dmg: 6, cd: 0.7, range: 9, aspect: "steam", stat: "E" }, { tool: { job: "shop", out: 8 }, text: "Pneumatic. Meant for hull plates." }),
  W("wind-rifle", "Wind Rifle", "rifle", 3, ["wall", "mast"], { dmg: 11, cd: 1.6, range: 22, aspect: "steam", stat: "A" }, { text: "Compressed air, silent, and longer than you'd think." }),
  W("lens-carbine", "Lens Carbine", "carbine", 4, ["lens"], { dmg: 9, cd: 1.0, range: 18, aspect: "glare", stat: "A", shardCost: 0.1 }, { tool: { job: "lens", out: 10 }, text: "A lens tower you can carry. Spends a tenth of a shard a shot." }),
  W("heliograph-musket", "Heliograph Musket", "musket", 8, ["lens", "wall"], { dmg: 22, cd: 2.6, range: 30, aspect: "glare", stat: "A", day: 1.5 }, { text: "Fires stored sunlight. Half again as strong while the sun is up." }),
  W("galvanic-coil", "Galvanic Coil", "caster", 6, ["lens"], { dmg: 8, cd: 0.9, range: 10, aspect: "arc", stat: "E", chain: 2 }, { text: "Two copper horns. The spark jumps to a second target." }),
  W("net-mortar", "Umbral Net Mortar", "mortar", 5, ["wall", "mast"], { dmg: 4, cd: 3.0, range: 16, aspect: "shade", stat: "A", snare: 2.5 }, { text: "Throws a net of shade-weave. Holds a Wildlight still for a few seconds." }),
  W("rime-sprayer", "Rime Sprayer", "sprayer", 6, ["wall"], { dmg: 3, cd: 0.25, range: 6, aspect: "rime", stat: "G", slow: 0.4 }, { text: "A coolant tank and a brass nozzle. Everything it touches slows." }),
  W("harpoon", "Harpoon Launcher", "harpoon", 4, ["mast"], { dmg: 14, cd: 2.2, range: 20, aspect: "steam", stat: "A" }, { text: "Ship's gear. Pins what it hits." }),
  W("storm-jug", "Storm-Jug Thrower", "jug", 9, ["wall", "mast"], { dmg: 18, cd: 3.0, range: 14, aspect: "arc", stat: "A", splash: 3 }, { text: "Lobs stoppered jars of bottled Aether storm." }),
  // job tools that are not weapons
  A("ledger-engine", "Ledger Engine", "hand", "ledger", 1, { jobs: ["hall"], tool: { job: "hall", out: 15 }, text: "A brass adding machine that clicks like a cricket." }),
  A("tray-tongs", "Tray Tongs", "hand", "tongs", 1, { jobs: ["yard"], tool: { job: "yard", out: 12 }, text: "Long copper tongs for turning hot crystal." }),
  A("pump-can", "Pump Can", "hand", "can", 1, { jobs: ["garden"], tool: { job: "garden", out: 12 }, text: "A watering can with a hand pump and a fine rose." }),
  A("spyglass", "Brass Spyglass", "hand", "scope", 1, { jobs: ["mast", "wall"], tool: { job: "mast", out: 10 }, sight: 6, text: "Spots Wildlight on the cliff before they crest it." }),
  // off-hand
  A("mirror-buckler", "Mirror Buckler", "offhand", "buckler", 1, { armor: { guard: 6 }, text: "Polished tin. Throws a Wildlight's own light back at it." }),
  A("shade-lantern", "Shade Lantern", "offhand", "lantern", 3, { armor: { guard: 2 }, stealth: 0.3, text: "Burns dark. Wildlight look straight past you." }),
  A("pressure-gauge", "Pressure Gauge", "offhand", "gauge", 2, { jobs: ["head", "shop"], tool: { job: "head", out: 6 }, text: "Tells you when the boiler or the seam is about to go." }),
  A("lamp-shield", "Lamp Shield", "offhand", "lampshield", 6, { armor: { guard: 10 }, light: 1, text: "A riveted shield with a lamp in the boss. A light Wildlight can't snuff." }),
  // head
  A("goggles", "Brass Goggles", "head", "goggles", 1, { armor: { guard: 2 }, text: "Every prospector's face." }),
  A("smoked-visor", "Smoked-Glass Visor", "head", "visor", 3, { armor: { guard: 3 }, nerve: 1, text: "Wildlight can't dazzle what can't see the glare." }),
  A("lamp-helm", "Miner's Lamp Helm", "head", "helm", 1, { armor: { guard: 4 }, jobs: ["head"], tool: { job: "head", out: 5 }, text: "Hard leather and a carbide lamp." }),
  A("flyers-cap", "Flyer's Cap", "head", "cap", 1, { armor: { guard: 2 }, jobs: ["mast"], tool: { job: "mast", out: 5 }, text: "Sheepskin flaps and a strap of goggles." }),
  A("sun-hat", "Mirrored Sun Hat", "head", "sunhat", 1, { jobs: ["yard", "garden"], tool: { job: "yard", out: 6 }, text: "A wide straw brim lined with foil." }),
  A("diving-helm", "Brass Lung Helm", "head", "diving", 9, { armor: { guard: 8 }, deep: 1, text: "A full helm with a rebreather. For the deep seam's bad air." }),
  // rig
  A("duster", "Canvas Duster", "rig", "coat", 1, { armor: { guard: 4 }, text: "Long, oiled, and full of pockets." }),
  A("apron", "Leather Apron", "rig", "apron", 1, { armor: { guard: 3 }, jobs: ["shop", "yard"], tool: { job: "shop", out: 5 }, text: "Scorched and patched a dozen times." }),
  A("riveted-vest", "Riveted Plate Vest", "rig", "vest", 3, { armor: { guard: 9 }, speed: -5, text: "Boiler plate on a leather back." }),
  A("insulated-coat", "Insulated Coat", "rig", "coat2", 5, { armor: { guard: 6 }, resist: { arc: 25 }, text: "Rubber-lined. For working the charged racks." }),
  A("shade-cloak", "Shade-Weave Cloak", "rig", "cloak", 6, { armor: { guard: 4 }, stealth: 0.4, text: "Woven with smoked-glass thread. Wildlight lose you in it." }),
  A("lift-harness", "Clockwork Lift Harness", "rig", "harness", 8, { armor: { guard: 5 }, G: 2, text: "A spring frame that carries half of whatever you lift." }),
  // gloves
  A("work-gloves", "Work Gloves", "hands", "gloves", 1, { armor: { guard: 1 }, text: "Split leather." }),
  A("rubber-gauntlets", "Rubber Gauntlets", "hands", "gauntlet", 3, { armor: { guard: 2 }, resist: { arc: 15 }, text: "For handling live crystal." }),
  A("clock-gauntlets", "Clockwork Gauntlets", "hands", "gauntlet2", 7, { armor: { guard: 4 }, E: 1, text: "Geared fingers. A fine grip on a fine screw." }),
  // boots
  A("hobnails", "Hobnail Boots", "boots", "boots", 1, { armor: { guard: 2 }, text: "Grip on wet rock." }),
  A("spring-heels", "Spring-Heel Boots", "boots", "boots2", 5, { armor: { guard: 1 }, speed: 15, text: "Coil springs in the heel." }),
  A("mag-boots", "Lodestone Boots", "boots", "boots3", 7, { armor: { guard: 3 }, jobs: ["mast"], tool: { job: "mast", out: 8 }, text: "Stick to a deck in an Aether gale." }),
  // charms
  A("pocket-watch", "Pocket Watch", "charm", "watch", 1, { night: 5, text: "Knowing the hour helps you last the night." }),
  A("sunstone-locket", "Sunstone Locket", "charm", "locket", 1, { nerve: 1, text: "A chip of charged crystal and a picture of someone." }),
  A("compass", "Aether Compass", "charm", "compass", 2, { findLuck: 0.25, text: "Points to the strongest crystal nearby. Usually." }),
  A("gnome-coin", "Gnome-Minted Coin", "charm", "coin", 1, { R: 1, text: "Milled edges. Gnomes take it at full weight." }),
  A("spare-cell", "Spare Cell", "charm", "cell", 4, { light: 1, text: "A charged sunstone cell in a brass cage." }),
].map(b => [b.id, b]));

// ---------------------------------------------------------------- traits (affixes)
// Prefixes are makers and workshops of the new age; suffixes are the GEARS and the shifts.
const P = (id, name, stat, range, slots, o = {}) => ({ id, name, type: "prefix", stat, range, slots, minTier: 1, perLevel: 0, ...o });
const S = (id, name, stat, range, slots, o = {}) => ({ id, name, type: "suffix", stat, range, slots, minTier: 1, perLevel: 0, ...o });
const ARMOR = ["offhand", "head", "rig", "hands", "boots"], WEAR = ["head", "rig", "hands", "boots", "charm"], ANY = ["hand", "offhand", "head", "rig", "hands", "boots", "charm"];
const AFFIXES = Object.fromEntries([
  // damage aspects (weapons)
  P("sunwright", "Sunwright", "extra", [10, 25], ["hand"], { aspect: "glare", group: "extra", text: "+{v}% damage as Glare" }),
  P("galvanic", "Galvanic", "extra", [10, 25], ["hand"], { aspect: "arc", group: "extra", text: "+{v}% damage as Arc" }),
  P("pneumatic", "Pneumatic", "extra", [10, 25], ["hand"], { aspect: "steam", group: "extra", text: "+{v}% damage as Steam" }),
  P("umbral", "Umbral", "extra", [10, 25], ["hand"], { aspect: "shade", group: "extra", minTier: 2, text: "+{v}% damage as Shade" }),
  P("rimecooled", "Rimecooled", "extra", [10, 25], ["hand"], { aspect: "rime", group: "extra", text: "+{v}% damage as Rime" }),
  P("resonant", "Resonant", "extra", [10, 25], ["hand"], { aspect: "chime", group: "extra", minTier: 2, text: "+{v}% damage as Chime" }),
  P("overclocked", "Overclocked", "rate", [8, 18], ["hand"], { group: "rate", text: "+{v}% attack rate" }),
  P("long-barrel", "Long-Barrel", "range", [10, 25], ["hand"], { group: "range", text: "+{v}% range" }),
  P("heavy-bore", "Heavy-Bore", "dmg", [8, 20], ["hand"], { perLevel: 0.4, group: "dmg", text: "+{v}% damage" }),
  P("economy", "Economy", "shardCost", [15, 35], ["hand", "module"], { text: "{v}% less shard cost" }),
  // protection
  P("boilerplate", "Boilerplate", "guard", [2, 4], ARMOR, { group: "guard", perLevel: 0.15, text: "+{v}% guard" }),
  P("insulated", "Insulated", "resist", [10, 25], ARMOR, { aspect: "arc", group: "resist", text: "Resist Arc {v}%" }),
  P("smoked", "Smoked", "resist", [10, 25], ARMOR, { aspect: "glare", group: "resist", text: "Resist Glare {v}%" }),
  P("quilted", "Quilted", "hp", [4, 9], ["rig", "head", "offhand"], { perLevel: 0.5, text: "+{v} health" }),
  P("featherweight", "Featherweight", "speed", [5, 12], ["boots", "rig", "hand"], { group: "speed", text: "+{v}% move speed" }),
  P("gnomewright", "Gnomewright", "out", [6, 14], ANY, { group: "out", text: "+{v}% output at this item's job" }),
  P("thinning-rated", "Thinning-Rated", "nerve", [1, 2], ["head", "rig", "charm"], { minTier: 2, text: "+{v} nerve" }),
  P("lamplit", "Lamplit", "light", [1, 1], ["offhand", "head", "charm"], { text: "Carries a light that keeps nearby lamps from being snuffed" }),
  P("copperbottom", "Copperbottom", "repair", [10, 25], ["hand", "hands", "rig"], { text: "+{v}% wall and tower repair speed" }),
  // GEARS and shifts
  S("seam", "of the Deep Seam", "G", [1, 2], ANY, { group: "G", text: "+{v} Grit" }),
  S("spanner", "of the Spanner", "E", [1, 2], ANY, { group: "E", text: "+{v} Engineering" }),
  S("rigging", "of the Rigging", "A", [1, 2], ANY, { group: "A", text: "+{v} Agility" }),
  S("handshake", "of the Handshake", "R", [1, 2], ANY, { group: "R", text: "+{v} Rapport" }),
  S("green-sun", "of the Green Sun", "S", [1, 2], ANY, { group: "S", text: "+{v} Sowing" }),
  S("night-shift", "of the Night Shift", "night", [8, 18], WEAR, { text: "+{v}% work after dark" }),
  S("steady-nerves", "of Steady Nerves", "nerve", [1, 2], WEAR, { text: "+{v} nerve: holds the line instead of running" }),
  S("plenty", "of Plenty", "upkeep", [10, 25], WEAR, { text: "Eats {v}% less" }),
  S("prospector", "of the Prospector", "findLuck", [0.2, 0.5], ["hand", "charm", "head"], { text: "+{v} luck on mine finds", float: true }),
  S("lamplighter", "of the Lamplighter", "relight", [1, 1], ["hand", "offhand", "charm"], { text: "Relights snuffed lamps in passing" }),
  S("first-claim", "of the First Claim", "allStats", [1, 1], ANY, { minTier: 3, text: "+{v} to every GEARS stat" }),
  S("long-night", "of the Long Night", "vsWild", [10, 20], ["hand"], { text: "+{v}% damage to Wildlight" }),
  S("jumper", "of the Claim-Jumper", "vsJumper", [10, 20], ["hand"], { text: "+{v}% damage to claim-jumpers" }),
].map(a => [a.id, a]));

// ---------------------------------------------------------------- building modules
// One socket per building level (the Hall gets two at level 3). Value scales with rarity like gear stats.
const M = (id, name, building, kind, stat, base, text, o = {}) => ({ id, name, slot: "module", building, kind, stat, base, text, minLvl: 1, ...o });
const MODULES = Object.fromEntries([
  M("telegraph", "Telegraph Key", "hall", "telegraph", "recruit", 15, "+{v}% settler arrivals"),
  M("assay-scale", "Assay Scale", "hall", "scale", "assay", 1, "Assays up to {v} Signed piece each morning, free"),
  M("trade-ticker", "Trade Ticker", "hall", "ticker", "tradeCut", 10, "Couriers sell {v}% cheaper"),
  M("drill-head", "Steam Drill Head", "head", "drillhead", "ore", 12, "+{v}% ore"),
  M("canary-cage", "Canary Cage", "head", "canary", "warn", 20, "The canary sings when the deep seam stirs: Wildlight take {v}s longer up the shaft"),
  M("ore-sorter", "Ore Sorter", "head", "sorter", "findLuck", 0.5, "+{v} luck on mine finds", { float: true }),
  M("pit-props", "Iron Pit Props", "head", "props", "deepSafe", 20, "{v}% fewer Wildlight from the deep seam", { minLvl: 6 }),
  M("parabolic", "Parabolic Mirror", "yard", "mirror", "charge", 12, "+{v}% charge rate"),
  M("gimbal", "Sun-Tracking Gimbal", "yard", "gimbal", "dawnDusk", 30, "+{v}% charge in morning and evening light"),
  M("cloud-lens", "Cloud Lens", "yard", "cloudlens", "thinLight", 25, "Charges at {v}% in cloud and storm", { minLvl: 5 }),
  M("capacitor", "Capacitor Jars", "yard", "jars", "store", 40, "Holds {v} shards in reserve that Wildlight can't drain: they keep the lamps lit when the stores run dry"),
  M("grinding-wheel", "Diamond Grinding Wheel", "shop", "wheel", "cut", 10, "+{v}% shards from every tray"),
  M("retuning-lathe", "Retuning Lathe", "shop", "lathe", "retuneCost", 20, "Retuning costs {v}% less"),
  M("bellows", "Forge Bellows", "shop", "bellows", "overhaulCost", 15, "Overhauls cost {v}% less"),
  M("drip-line", "Drip Irrigator", "garden", "drip", "food", 12, "+{v}% food"),
  M("bee-box", "Clockwork Bee Box", "garden", "beebox", "food", 8, "+{v}% food, and pollinates the yards: +3% charge"),
  M("grow-lamp", "Sunstone Grow Lamp", "garden", "growlamp", "nightFood", 50, "Grows at {v}% through the night. Spends shards", { minLvl: 4 }),
  M("radiator", "Steam Radiator", "bunk", "radiator", "rest", 15, "Sleepers wake fresher: everyone works {v}% harder in the morning"),
  M("lockers", "Book Lockers", "bunk", "lockers", "study", 10, "Students keep their books to hand: study in the Keep goes {v}% faster"),
  M("alarm-bell", "Alarm Bell", "bunk", "bell", "muster", 25, "When the wall is breached, the watch fights {v}% harder"),
  M("fresnel", "Fresnel Ring", "lens", "fresnel", "range", 15, "+{v}% beam range"),
  M("shutter", "Rapid Shutter", "lens", "shutter", "rate", 12, "+{v}% beam rate"),
  M("prism", "Prism Splitter", "lens", "prism", "split", 1, "Each beam also hits {v} more target", { minLvl: 6 }),
  M("shade-hood", "Shade Hood", "lens", "hood", "shardCost", 20, "Beams cost {v}% fewer shards"),
  M("arc-wire", "Arc Wire", "wall", "wire", "climbDmg", 3, "Climbing Wildlight take {v} damage a second"),
  M("mirror-tiles", "Mirror Tiles", "wall", "tiles", "dazzle", 15, "{v}% chance a climber is dazzled and falls"),
  M("steam-vents", "Steam Vents", "wall", "vents", "wallHp", 25, "+{v}% wall strength"),
  M("ballista", "Clockwork Ballista", "wall", "ballista", "turret", 10, "A wind-up bolt thrower: {v} damage every 2s", { minLvl: 5 }),
].map(m => [m.id, m]));

// Lark parts (slot "lark"): flown on night patrols now, raids later.
const LARK_PARTS = Object.fromEntries([
  M("flare-battery", "Flare Battery", "mast", "battery", "flares", 1, "+{v} flare per volley"),
  M("crystal-sail", "Crystal Sail", "mast", "sail", "shipSpeed", 15, "+{v}% airspeed; charges a little shard by day"),
  M("hull-plates", "Armoured Hull Plates", "mast", "plates", "shipGuard", 15, "+{v}% hull guard: on patrol she takes jumper volleys meant for the yards"),
  M("gyro", "Gyro Stabiliser", "mast", "gyro", "aim", 15, "Steadies her aim in the wind: she fires flares {v}% faster"),
  M("harpoon-winch", "Harpoon Winch", "mast", "winch", "board", 1, "The crew board downed jumpers: each one leaves a second crate"),
].map(m => [m.id, { ...m, slot: "lark" }]));

const MODULE_AFFIXES = Object.fromEntries([
  P("efficient", "Efficient", "upkeepShards", [10, 25], ["module", "lark"], { text: "Runs on {v}% fewer shards" }),
  P("self-oiling", "Self-Oiling", "noBreak", [1, 1], ["module", "lark"], { text: "Never seizes in an Aether storm" }),
  P("crew-friendly", "Crew-Friendly", "out", [4, 10], ["module"], { text: "+{v}% output for workers here" }),
  S("of-the-watch", "of the Watch", "nightBoost", [10, 20], ["module", "lark"], { text: "+{v}% effect at night" }),
  S("of-the-gnomes", "of the Gnomes", "valueBoost", [8, 16], ["module", "lark"], { text: "+{v}% to the main effect" }),
].map(a => [a.id, a]));

// ---------------------------------------------------------------- Signed items (rank 4): generated maker, model and epithet
const NAMES = {
  makers: ["Wexley & Daughter", "Brassmoor Works", "Quillon Pneumatics", "Hob & Tansy", "The Thornfield Foundry", "Pellinore Optics", "Gearwhistle Bros.", "Saltpan Lensery", "Aldous Crane", "Mother Ivy's Shop", "Copperbottom & Sons", "The Fennick Collective"],
  models: ["Model {n}", "No. {n}", "Mark {r}", "Series {n}", "Pattern {n}"],
  epithets: ["the Widowmaker", "Old Reliable", "the Long Shift", "Second Chance", "the Night Owl", "Sweet Thunder", "the Quiet One", "Last Light", "the Stubborn", "Dawn's Debt", "the Cliff-Keeper", "Lucky Seven", "Grandmother", "the Argument"],
  logbook: [
    "Found in a collapsed gallery with a lamp still lit beside it.",
    "Stamped with a claim number nobody on the plateau recognises.",
    "Someone kept a tally of nights scratched into it. The tally stops at forty.",
    "Came up the shaft inside a Wildlight that had swallowed it.",
    "The maker's mark has been filed off and stamped again, crooked.",
    "Taken off a claim-jumper who swore it was his grandmother's.",
    "Still warm when it came out of the rock.",
    "Wrapped in an oilcloth with a letter that was never posted.",
  ],
};
const SIGNED_POWERS = {
  glare: { name: "Burn-Out", text: "Once a night: a flash that blinds every Wildlight nearby for 3s." },
  arc:   { name: "Lightning Rod", text: "Once a night: the next Arc hit chains to 4 targets." },
  steam: { name: "Blow-Off", text: "Once a night: a scalding burst that throws back everything within 3m." },
  shade: { name: "Swallow the Glow", text: "Once a night: a Wildlight brought down by this is caught, not killed. +3 shards." },
  rime:  { name: "Cold Snap", text: "Once a night: freezes a Wildlight solid for 4s." },
  chime: { name: "Perfect Pitch", text: "Once a night: a struck note that cracks every Wildlight within 6m for 12 damage." },
  none:  { name: "Second Wind", text: "Once a night: the wearer shrugs off a hit and keeps working." },
};

// ---------------------------------------------------------------- Masterworks (rank 5): hand-made, named, found not bought
// power: active, once a night. town: passive effect on the claim while equipped by a worker there.
const MW = (id, name, base, kind, o) => ({ id, name, base, kind, rarity: "masterwork", ...o });
const RELICS = Object.fromEntries([
  MW("dawnbreaker", "Dawnbreaker", "heliograph-musket", "musket", { slot: "hand", aspect: "glare", ilvl: 14, stats: { dmg: 30, A: 2 },
    power: { name: "First Light", text: "Sweeps a beam the length of the rim. Every Wildlight it touches takes 40 Glare." },
    lore: "A survey heliograph from the first expedition under the Thinning, rebuilt to throw the morning back at the dark.", source: "Raid: Claim-baron's citadel" }),
  MW("hush", "Hush", "net-mortar", "mortar", { slot: "hand", aspect: "shade", ilvl: 10, stats: { snare: 2, vsWild: 20 },
    power: { name: "Bottle the Light", text: "Catches a Wildlight alive in a smoked-glass jar. It hangs as a lamp that never needs shards." },
    town: { text: "One street lamp near the carrier burns for free." },
    lore: "Nobody knows who wove the net. It hums when the sun goes down.", source: "Night: Lodestar Wildlight" }),
  MW("old-faithful", "Old Faithful", "steam-drill", "drill", { slot: "hand", aspect: "steam", ilvl: 8, stats: { out: 40, G: 2 },
    power: { name: "Strike the Seam", text: "One long bore: 20 ore at once, and a mine find with +3 luck." },
    town: { text: "+10% ore for the whole mine shift." },
    lore: "Its boiler has been replaced four times. The drill bit never.", source: "Mine: lower gallery" }),
  MW("lamplighters-pole", "The Lamplighter's Pole", "earthing-lance", "pole", { slot: "hand", aspect: "arc", ilvl: 6, stats: { relight: 1, range: 1 },
    power: { name: "Every Lamp", text: "Relights every snuffed lamp on the plateau at once." },
    town: { text: "Lamps within 10m of the carrier can't be snuffed." },
    lore: "Copper hook, brass ferrule, and a wick that has never once gone out.", source: "Night: any, after 5 nights with no lamps lost" }),
  MW("widows-kettle", "The Widow's Kettle", "rivet-gun", "kettle", { slot: "hand", aspect: "steam", ilvl: 12, stats: { dmg: 25, splash: 2 },
    power: { name: "Boil Over", text: "Vents the whole boiler: 35 Steam to everything within 4m." },
    lore: "A tea urn somebody bored out and pressurised in a hurry, one bad night.", source: "Raid: outpost" }),
  MW("corwins-plumb", "Corwin's Plumb", "piston-hammer", "plumb", { slot: "hand", aspect: "steam", ilvl: 9, stats: { repair: 50, guard: 6 },
    power: { name: "True", text: "The wall segment he stands on is mended whole, and can't break again tonight." },
    town: { text: "+25% wall repair while Corwin or the carrier is on watch." },
    lore: "A lead plumb on a brass chain. Corwin says it was his mother's. That's three words more than usual.", source: "Gift: Corwin Ashlar, wall level 2" }),
  MW("tinderwing", "Tinderwing", "flare-pistol", "pistol", { slot: "hand", aspect: "glare", ilvl: 7, stats: { A: 2, mark: 1 },
    power: { name: "Courier's Mark", text: "A flare that lights every Wildlight on the cliff. They take +25% damage from everyone." },
    lore: "Hesper Lark's signal pistol from her courier days. The grip is worn to the shape of her thumb.", source: "Gift: Hesper Lark" }),
  MW("arc-organ", "The Gnomewright Arc-Organ", "galvanic-coil", "organ", { slot: "hand", aspect: "arc", ilvl: 15, stats: { chain: 3, E: 2 },
    power: { name: "Full Stops", text: "Plays a chord: lightning chains through 8 targets." },
    lore: "Eleven organ pipes, a bellows pack and a gnome's opinion of music.", source: "Raid: claim-baron's citadel" }),
  MW("rimekeeper", "Rimekeeper", "rime-sprayer", "sprayer", { slot: "hand", aspect: "rime", ilvl: 11, stats: { slow: 0.2, coolSeam: 1 },
    power: { name: "Quench", text: "Floods a gallery with coolant: Wildlight in it freeze, and an overheating node cools at once." },
    town: { text: "Mine nodes never overheat while the carrier is below." },
    lore: "The deep seam runs hot. Somebody built this after the first time it ran too hot.", source: "Mine: deep seam" }),
  MW("long-quiet", "The Long Quiet", "wind-rifle", "rifle2", { slot: "hand", aspect: "steam", ilvl: 16, stats: { range: 60, vsJumper: 40 },
    power: { name: "Not a Sound", text: "One shot at any range: 80 Steam, and the target never knew." },
    lore: "A claim-jumper's rifle. Its last owner didn't hear it either.", source: "Raid: claim-jumper airship" }),
  MW("seventh-spanner", "The Seventh Spanner", "spanner", "spanner", { slot: "hand", aspect: "steam", ilvl: 8, stats: { E: 3, out: 20 },
    power: { name: "Done by Supper", text: "Finishes the current stage of a building upgrade on the spot." },
    town: { text: "Building upgrades rise 20% faster." },
    lore: "Odile has six spanners. Nobody asks about the seventh.", source: "Mine: upper gallery" }),
  MW("swarm-box", "Marigold's Swarm-Box", "pump-can", "smoker", { slot: "hand", aspect: "chime", ilvl: 6, stats: { S: 3, out: 20 },
    power: { name: "Everybody Out", text: "Releases the hive: claim-jumpers nearby flee; Wildlight are swarmed for 15 Chime." },
    town: { text: "+15% food and +5% charge in the yards next to the greenhouse." },
    lore: "A bee smoker with a brass music box inside. The bees like the tune. Marigold won't say what it is.", source: "Gift: Marigold Thresh, greenhouse level 2" }),
  MW("odiles-fork", "Odile's Tuning Fork", "tuning-fork", "fork", { slot: "hand", aspect: "chime", ilvl: 12, stats: { E: 2, vsWild: 30 },
    power: { name: "The Pitch of Sunstone", text: "Rings the vein's own note: every Wildlight within 8m cracks for 30 Chime." },
    town: { text: "+10% shards from every tray." },
    lore: "She judges crystal by ear. This is the ear.", source: "Gift: Odile Fenn, workshop level 2" }),
  MW("assayers-loupe", "The Assayer's Loupe", "gnome-coin", "loupe", { slot: "charm", ilvl: 5, stats: { R: 3, assay: 1 },
    power: { name: "Read the Mark", text: "Assays every Signed item in the stash." },
    town: { text: "Couriers pay 15% more for anything you sell." },
    lore: "Absalom Pockett's eyeglass. He talks to it.", source: "Gift: Absalom Pockett" }),
  MW("pips-night-glass", "Pip's Night Glass", "spyglass", "scope", { slot: "hand", ilvl: 6, stats: { sight: 20, night: 20 },
    power: { name: "There, and There", text: "Marks where every Wildlight will crest the rim tonight." },
    town: { text: "The night warning comes a quarter-hour sooner." },
    lore: "A spyglass with a smoked lens and Pip's initials scratched in four places.", source: "Gift: Pip Kettleby" }),
  MW("sunshade", "The Saltpan Sunshade", "mirror-buckler", "parasol", { slot: "offhand", ilvl: 10, stats: { guard: 20, reflect: 1 },
    power: { name: "Return to Sender", text: "For 6s, every beam or flare aimed at the carrier goes back where it came from." },
    lore: "A parasol of mirrored panels from the salt flats, where the sun is a weapon.", source: "Raid: outpost" }),
  MW("prospectors-promise", "The Prospector's Promise", "pick", "pick2", { slot: "hand", aspect: "steam", ilvl: 18, stats: { G: 3, out: 35, findLuck: 1 },
    power: { name: "Stake It", text: "The next mine find is guaranteed Calibrated or better." },
    town: { text: "+1 luck on every mine find." },
    lore: "Dug out of the seam with the founder's name on it. The founder of which claim, nobody can say.", source: "Mine: deep seam" }),
  MW("clockheart", "Clockheart", "pocket-watch", "heart", { slot: "charm", ilvl: 9, stats: { upkeep: 50, nerve: 2 },
    power: { name: "Keep Ticking", text: "The wearer works through hunger and fear until dawn." },
    lore: "A clockwork heart in a glass case. You can hear it through a coat.", source: "Night: Brightmaw" }),
  MW("brass-lung", "The Brass Lung", "diving-helm", "diving", { slot: "head", ilvl: 14, stats: { guard: 12, deep: 2, G: 1 },
    power: { name: "Hold Your Breath", text: "The carrier's mine crew ignores bad air and cave-ins for the rest of the shift." },
    lore: "Somebody walked out of a flooded gallery in this. Nobody knows how far they walked first.", source: "Mine: deep seam" }),
  MW("sky-anchor", "Sky-Anchor", "piston-hammer", "anchor", { slot: "hand", aspect: "steam", ilvl: 17, stats: { dmg: 40, G: 2 },
    power: { name: "Drop Anchor", text: "Slams the ground: 45 Steam within 5m, and nothing nearby can climb for 5s." },
    lore: "The anchor of an airship that crossed the Thinning and fell. The chain was cut clean.", source: "Raid: claim-jumper airship" }),
  MW("thunderjug", "Mother Ivy's Thunderjug", "storm-jug", "jug", { slot: "hand", aspect: "arc", ilvl: 13, stats: { splash: 3, chain: 1 },
    power: { name: "Uncork", text: "Opens a captive storm over the wall for 8s: lightning on every climber." },
    lore: "Bottled the night of the great storm. The cork is wired down. It still rattles.", source: "Night: during an Aether storm" }),
  MW("gloamhook", "Gloamhook", "harpoon", "harpoon", { slot: "hand", aspect: "shade", ilvl: 11, stats: { range: 10, board: 1 },
    power: { name: "Reel In", text: "Hooks a Wildlight or a raider and drags them to the watch." },
    lore: "A grapple-gun with a smoked-glass head. Courier crews used them to stop thieves cutting the cargo.", source: "Raid: claim-jumper airship" }),
  MW("lark-figurehead", "The Lark's First Figurehead", null, "figurehead", { slot: "lark", ilvl: 12, stats: { shipGuard: 25, flares: 1 },
    power: { name: "Sing Out", text: "The Lark fires a full volley at every Wildlight on the rim." },
    lore: "Carved brass lark, wings half open. Hesper says she lost it over the Saltpan and stopped looking.", source: "Raid: claim-jumper airship" }),
  MW("beacon-heart", "The Beacon Heart", null, "beacon", { slot: "module", building: "hall", ilvl: 15, stats: { lightRadius: 30, recruit: 25 },
    power: { name: "Noon at Midnight", text: "The Sun Beacon blazes for 20s. No Wildlight can climb while it burns." },
    lore: "A single flawless crystal from the deep seam, cut to Odile's own pattern.", source: "Mine: deep seam, Hall level 3" }),
].map(r => [r.id, r]));

// ---------------------------------------------------------------- Guild sets (rank 6)
const SETS = {
  lensguild: { name: "Lensguild Regalia", pieces: ["lensguild-visor", "lensguild-longcoat", "lensguild-gauntlets"],
    bonuses: [{ n: 2, text: "Beams reach 25% farther.", stats: { range: 25 } }, { n: 3, text: "Beams pierce: they keep going through the first target.", stats: { pierce: 1 } }] },
  wallwrights: { name: "Wallwrights' Order", pieces: ["wallwright-helm", "wallwright-apron", "wallwright-boots"],
    bonuses: [{ n: 2, text: "+30% wall repair.", stats: { repair: 30 } }, { n: 3, text: "The wall segment you stand on can't break.", stats: { holdWall: 1 } }] },
  skyward: { name: "Skyward Post", pieces: ["skyward-cap", "skyward-jacket", "skyward-boots", "skyward-satchel"],
    bonuses: [{ n: 2, text: "+15% move speed.", stats: { speed: 15 } }, { n: 4, text: "On the Lark: +1 flare a volley and the ship never takes the first hit of a night.", stats: { flares: 1, shipShield: 1 } }] },
};
const G = (id, name, set, slot, kind, ilvl, stats, text) => ({ id, name, set, slot, kind, ilvl, rarity: "guild", stats, text });
Object.assign(RELICS, Object.fromEntries([
  G("lensguild-visor", "Lensguild Visor", "lensguild", "head", "visor", 10, { A: 2, guard: 4 }, "Graduated lenses that flip down on a hinge."),
  G("lensguild-longcoat", "Lensguild Longcoat", "lensguild", "rig", "coat", 11, { A: 1, guard: 8, out: 15 }, "Plum wool, brass buttons stamped with a lens."),
  G("lensguild-gauntlets", "Lensguild Gauntlets", "lensguild", "hands", "gauntlet2", 12, { E: 1, rate: 10 }, "For turning the great lens in a gale."),
  G("wallwright-helm", "Wallwright's Helm", "wallwrights", "head", "helm", 9, { G: 2, guard: 6 }, "A riveted pot with a mason's mark."),
  G("wallwright-apron", "Wallwright's Apron", "wallwrights", "rig", "apron", 10, { G: 1, E: 1, guard: 8 }, "Leather and mortar dust, mostly mortar dust."),
  G("wallwright-boots", "Wallwright's Boots", "wallwrights", "boots", "boots", 9, { guard: 4, nerve: 1 }, "Steel toes. They have been dropped on."),
  G("skyward-cap", "Skyward Post Cap", "skyward", "head", "cap", 7, { A: 1, guard: 2 }, "A courier's cap with the Post's wing badge."),
  G("skyward-jacket", "Skyward Post Jacket", "skyward", "rig", "coat2", 8, { A: 2, guard: 5 }, "Short, warm, with a dozen sealed pockets."),
  G("skyward-boots", "Skyward Post Boots", "skyward", "boots", "boots3", 8, { speed: 10, guard: 2 }, "Lodestone soles for a pitching deck."),
  G("skyward-satchel", "Skyward Post Satchel", "skyward", "charm", "satchel", 9, { R: 2 }, "Still holds one undelivered letter. Nobody has opened it."),
].map(g => [g.id, g])));

// ---------------------------------------------------------------- Sunforged (rank 7): old-age relics from the deep seam, refitted
const SF = (id, name, slot, kind, ilvl, o) => ({ id, name, slot, kind, ilvl, rarity: "sunforged", ...o });
Object.assign(RELICS, Object.fromEntries([
  SF("hearthbrand-refit", "Hearthbrand, Refitted", "hand", "sword", 25, { aspect: "glare", stats: { dmg: 50, G: 3, A: 2 },
    power: { name: "Hearthfall", text: "The old sword remembers the hearth: 60 Glare to every Wildlight on the plateau." },
    town: { text: "No lamp on the plateau can be snuffed." },
    lore: "An heirloom of the old Keep, found in the deep seam with its fire gone out. Odile fitted a sunstone cell in the pommel. It is warm again.", source: "Mine: deep seam, very rare" }),
  SF("worldforge-engine", "The Worldforge Engine", "charm", "engine", 25, { stats: { allStats: 2, out: 25 },
    power: { name: "Strike the Forge", text: "Every worker on the claim works at double pace for 30s." },
    town: { text: "Retuning and overhauls cost half." },
    lore: "The heart of an old-age forge, rebuilt into a pocket engine that ticks like a second heart.", source: "Night: Brightmaw, after night 20" }),
  SF("thinning-compass", "The Thinning Compass", "charm", "compass", 25, { stats: { findLuck: 2, R: 2 },
    power: { name: "Where Ships Fall", text: "Reveals a wreck under the Thinning. The Lark can fly to salvage it for a guaranteed Masterwork." },
    lore: "It does not point north. It points to wherever something fell out of the sky.", source: "Raid: claim-baron's citadel" }),
  SF("sunwyrm-lens", "The Sunwyrm Lens", "module", "bigLens", 28, { building: "lens", stats: { range: 50, split: 2 },
    power: { name: "Eye of the Seam", text: "The tower fires one continuous beam for 10s, cutting through everything it crosses." },
    lore: "Cut from the crystal heart of the first Brightmaw ever brought down.", source: "Night: Brightmaw" }),
].map(s => [s.id, s])));

// ---------------------------------------------------------------- enemies and drop sources
// Wildlight tiers map onto Aethermoor's rabble / veteran / relic-bearer / champion.
const FOES = {
  glimmer:   { tier: "rabble",   name: "Glimmer",   hp: 18, text: "A spark of a fox. Comes in packs.", resist: { glare: -10, shade: -50, chime: -25 } },
  flarehound:{ tier: "veteran",  name: "Flarehound", hp: 40, text: "A full-grown Wildlight. Chews through walls.", resist: { glare: 25, shade: -50, chime: -25 } },
  lodestar:  { tier: "bearer",   name: "Lodestar",  hp: 80, text: "A Wildlight with something swallowed glowing in its chest. Kill it to get the thing back.", resist: { glare: 50, shade: -40, chime: -25 } },
  brightmaw: { tier: "champion", name: "Brightmaw", hp: 300, text: "A great Wildlight from the deep seam. One a week, if you're lucky.", resist: { glare: 75, shade: -25, chime: -40, arc: 25 } },
  jumper:    { tier: "rabble",   name: "Claim-Jumper", hp: 30, text: "A rival prospector with a rifle and no claim of their own.", resist: { shade: 50, chime: 50, glare: -25 } },
  enforcer:  { tier: "veteran",  name: "Jumper Enforcer", hp: 60, text: "Plate vest, steam hammer, bad attitude.", resist: { shade: 50, chime: 50, steam: 25 } },
  baron:     { tier: "champion", name: "Claim-Baron", hp: 220, text: "Runs the jumper crews from a citadel on a stolen claim.", resist: { shade: 50, chime: 50, glare: 25 } },
};
const DROPS = {
  // Same structure as Aethermoor's TUNING.drops
  rabbleChance: 0.25, rabbleKeepChance: 0.35, luckCurve: 0.7,
  luck: { rabble: 0, veteran: 1, bearer: 2, champion: 3 },
  extra: { rabble: 0, veteran: 0, bearer: 1, champion: 2 },
  minRarity: { rabble: "salvage", veteran: "salvage", bearer: "tooled", champion: "tuned" },
  shards: { rabble: 1, veteran: 3, bearer: 8, champion: 25 },
  materials: { veteran: { brass: 1 }, bearer: { glass: 1 }, champion: { glass: 2, heartstone: 2 } },
  nightLuck: 0.1,        // +luck per night survived
  deepLuck: 1,           // +luck once the deep seam is open
  masterworkChance: { bearer: 0.06, champion: 0.35 },   // chance a named item is the swallowed thing / the prize
  blueprintChance: 0.15, // chance a drop also teaches its base item's blueprint (if unknown)
};
// Mine finds: each unit of ore dug has a small chance of turning something up.
const MINE_FINDS = {
  perOre: 0.012,
  galleries: {
    upper: { luck: 0, ilvlBonus: 0, table: { item: 52, module: 16, cell: 12, blueprint: 8, material: 12 }, materials: { brass: 80, glass: 20 } },
    lower: { luck: 1, ilvlBonus: 3, table: { item: 48, module: 18, cell: 12, blueprint: 8, material: 14 }, materials: { brass: 50, glass: 44, heartstone: 6 } },
    deep:  { luck: 2, ilvlBonus: 6, table: { item: 44, module: 18, cell: 12, blueprint: 7, material: 14, antique: 5 }, materials: { brass: 20, glass: 50, heartstone: 30 } },
  },
  sunforgedChance: 0.002,  // per deep-seam find
};
// Raids (later: flown on the Lark). Each camp is a crate table.
const RAIDS = {
  camp:     { name: "Prospect camp", tier: "veteran",  crates: 2, ilvl: 4,  shards: [20, 40], materials: { brass: 2 } },
  outpost:  { name: "Jumper outpost", tier: "bearer",  crates: 3, ilvl: 9,  shards: [50, 90], masterwork: 0.15, materials: { brass: 3, glass: 2 } },
  airship:  { name: "Claim-jumper airship", tier: "bearer", crates: 3, ilvl: 12, shards: [60, 120], masterwork: 0.25, larkPart: 0.5, materials: { glass: 3, heartstone: 1 } },
  citadel:  { name: "Claim-baron's citadel", tier: "champion", crates: 5, ilvl: 18, shards: [150, 300], masterwork: 0.6, sunforged: 0.05, materials: { glass: 4, heartstone: 3 } },
};
// Courier trade: buy Salvage–Tuned gear and modules with shards.
const TRADE = { stock: 4, maxRarity: "tuned", pricePerIlvl: 6, rarityMult: { salvage: 1, tooled: 2, tuned: 4 } };

// ---------------------------------------------------------------- the workshop (Aethermoor's forge, at Odile's bench)
const MATERIALS = {
  brass:      { name: "Brass Scrap", color: "#c9a046", text: "From gear melted down. Retunes Tooled and Tuned pieces." },
  glass:      { name: "Cut Glass",   color: "#cfe8ff", text: "Lens offcuts. For the middle overhauls (+4 to +6) and retuning Calibrated and Signed pieces." },
  heartstone: { name: "Heartstone",  color: "#ff8a3c", text: "Deep-seam crystal that never cools. The high overhauls (+7 to +10) and Attuning need it." },
};
// Times are in game seconds at the bench (an hour is 10 s), for an Engineering of about 7; a better hand is quicker.
const WORKSHOP = {
  salvage: { salvage: { brass: 1 }, tooled: { brass: 2 }, tuned: { brass: 1, glass: 1 }, calibrated: { glass: 2 }, signed: { heartstone: 1, glass: 1 }, time: 1.2, maxTime: 8 },
  retune: { base: 20, material: { tooled: "brass", tuned: "brass", calibrated: "glass", signed: "glass" }, time: 7 },  // shards = base × ⌈ilvl/2⌉ × (1 + times retuned)
  // each step +1 … +10: shards = base × ⌈ilvl/2⌉ × mult, plus glass and heartstone; perLevel: how much each step adds
  // to the item's own numbers (damage, guard, output, a module's effect). From +6 a step can fail: the materials
  // are lost and half the shards come back, and the piece keeps its level. A good hand at the bench fails less.
  overhaul: { max: 10, base: 15, mult: [1, 2, 4, 6, 8, 11, 14, 18, 23, 30], glass: [0, 0, 0, 1, 2, 3, 0, 0, 0, 0], heartstone: [0, 0, 0, 0, 0, 0, 1, 2, 3, 4], perLevel: 0.04,
    fail: [0, 0, 0, 0, 0, 0.08, 0.15, 0.25, 0.35, 0.45], time: [3, 3.5, 4, 5, 6, 7, 8, 9.5, 11, 12] },
  socket: 10, assay: 15, cellTime: 2.5,
  attune: { heartstone: 2, shards: 80, time: 14 },
  // blueprints: Odile makes the base item, at a rarity rolled with the bench hand's Engineering (Tooled to Signed)
  craft: { shards: 12, perIlvl: 5, brass: 2, glassFrom: 6, time: 12 },
};
// Attuning a Masterwork: one of two ways, once. In a hand it changes how it fights; anywhere else, how it works.
// A Masterwork module or Lark part takes its whole effect up instead.
const ATTUNE = {
  sun:  { name: "Sun-attuned", text: "Burns brighter by day: harder on claim-jumpers, and better at its work.", hand: { vsJumper: 25, out: 20 }, other: { out: 15, allStats: 1 }, fitted: 1.15 },
  moon: { name: "Moon-attuned", text: "Burns brighter by night: harder on Wildlight, and steadier in the dark.", hand: { vsWild: 25, nerve: 2 }, other: { night: 20, nerve: 2, guard: 3 }, fitted: 1.3, nightOnly: true },
};
// Sunstone cells (Aethermoor's gems): one effect in a weapon, another in anything else.
const CELLS = {
  amber:   { name: "Amber Cell",   color: "#ffb43c", hand: { extra: { glare: 15 } }, other: { resist: { glare: 10 } }, price: 45 },
  cobalt:  { name: "Cobalt Cell",  color: "#5aa7ff", hand: { extra: { arc: 15 } },   other: { resist: { arc: 10 } }, price: 45 },
  smoke:   { name: "Smoke Cell",   color: "#8a74c9", hand: { extra: { shade: 15 } }, other: { stealth: 0.1 }, price: 60 },
  rime:    { name: "Rime Cell",    color: "#bfe6ff", hand: { extra: { rime: 15 } },  other: { guard: 3 }, price: 50 },
  rose:    { name: "Rose Cell",    color: "#f59bd0", hand: { extra: { chime: 15 } }, other: { nerve: 1 }, price: 60 },
  verdant: { name: "Verdant Cell", color: "#7fcf5e", hand: { vsWild: 8 },           other: { S: 1 }, price: 40 },
};

return {ASPECTS,SLOTS,SLOT_WEIGHT,RARITY_ORDER,RANDOM_RARITIES,RARITY,ITEMS,AFFIXES,MODULES,LARK_PARTS,MODULE_AFFIXES,NAMES,SIGNED_POWERS,RELICS,SETS,FOES,DROPS,MINE_FINDS,RAIDS,TRADE,MATERIALS,WORKSHOP,ATTUNE,CELLS};
})();
// Brightvein loot engine. Aethermoor's rules (luck curve, traits, tier drops, workshop loop)
// running on Brightvein's data. Pure functions over a seeded rng; no DOM.
//
//   import * as D from "./brightvein-loot-data.js";
//   import { createLoot } from "./brightvein-loot.js";
//   const loot = createLoot(D, seed);
//   loot.nightDrops("flarehound", { night: 6, deep: true });
//   loot.mineFind("lower", { night: 6 });
//   loot.raidCrates("outpost");

function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), chance: p => next() < p, pick: a => a[Math.floor(next() * a.length)],
    float: (lo, hi) => lo + next() * (hi - lo) };
}

function createLoot(D, seed = Date.now()) {
  const rng = makeRng(seed);
  const { RARITY, RARITY_ORDER: ORDER, RANDOM_RARITIES, ITEMS, AFFIXES, MODULES, LARK_PARTS, MODULE_AFFIXES, RELICS, SETS,
          NAMES, SIGNED_POWERS, DROPS, MINE_FINDS, RAIDS, WORKSHOP, CELLS, FOES, SLOT_WEIGHT, TRADE } = D;
  const rankOf = id => ORDER.indexOf(id);
  const SIGNED = rankOf("signed");
  const ALL_AFFIX = { ...AFFIXES, ...MODULE_AFFIXES };
  const uid = () => "b" + rng.int(0, 2 ** 31 - 1).toString(36) + rng.int(0, 2 ** 31 - 1).toString(36);
  const wpick = entries => { const tot = entries.reduce((a, e) => a + Math.max(0, e.w), 0); if (tot <= 0) return entries[0]?.v; let r = rng.next() * tot; for (const e of entries) { r -= Math.max(0, e.w); if (r < 0) return e.v; } return entries.at(-1).v; };
  const pickTable = t => wpick(Object.entries(t).map(([v, w]) => ({ v, w })));

  // ---- rarity (identical curve to Aethermoor)
  const rarityWeights = (luck = 0) => RANDOM_RARITIES.map((id, i) => ({ v: id, w: RARITY[id].dropWeight * Math.pow(1 + Math.max(0, luck), i * DROPS.luckCurve) }));
  function rollRarity(luck = 0, { min = "salvage", max = "signed" } = {}) {
    const lo = rankOf(min), hi = Math.min(rankOf(max), SIGNED);
    const e = rarityWeights(luck).filter(x => rankOf(x.v) >= lo && rankOf(x.v) <= hi);
    return wpick(e.length ? e : [{ v: min, w: 1 }]);
  }
  const bumpRarity = (id, n = 1) => rankOf(id) >= SIGNED ? id : ORDER[Math.min(SIGNED, rankOf(id) + n)];
  function rarityOdds(luck = 0) { const w = rarityWeights(luck), t = w.reduce((a, e) => a + e.w, 0); return Object.fromEntries(w.map(e => [e.v, +(100 * e.w / t).toFixed(2)])); }

  // ---- traits
  function affixValue(a, rarity, ilvl, roll) {
    let v = roll * RARITY[rarity].statMult + ilvl * (a.perLevel || 0);
    return a.float ? Math.round(v * 100) / 100 : Math.round(v);
  }
  function rollTraits(slot, rarity, ilvl, pool, want, keep = []) {
    const rank = rankOf(rarity), out = [...keep];
    const groups = new Set(keep.map(k => ALL_AFFIX[k.id]?.group).filter(Boolean)), count = { prefix: 0, suffix: 0 };
    keep.forEach(k => ALL_AFFIX[k.id] && count[ALL_AFFIX[k.id].type]++);
    while (out.length < want) {
      const p = Object.values(pool).filter(a => a.slots.includes(slot) && a.minTier <= rank && !out.some(o => o.id === a.id) && !(a.group && groups.has(a.group)) && count[a.type] < 2);
      if (!p.length) break;
      const a = rng.pick(p), roll = a.float ? rng.float(a.range[0], a.range[1]) : rng.int(a.range[0], a.range[1]);
      out.push({ id: a.id, value: affixValue(a, rarity, ilvl, roll) });
      if (a.group) groups.add(a.group); count[a.type]++;
    }
    return out;
  }
  const traitText = t => { const a = ALL_AFFIX[t.id]; return a ? a.text.replace("{v}", t.value) : ""; };
  function traitStars(t, rarity, ilvl) {
    const a = ALL_AFFIX[t.id]; if (!a) return 1;
    const raw = (t.value - ilvl * (a.perLevel || 0)) / RARITY[rarity].statMult, span = a.range[1] - a.range[0];
    return span <= 0 ? 5 : Math.max(1, Math.min(5, 1 + Math.round(4 * (raw - a.range[0]) / span)));
  }
  function aspectOf(base, traits) {
    for (const t of traits) { const a = ALL_AFFIX[t.id]; if (a?.aspect && a.stat === "extra") return a.aspect; }
    return base.weapon?.aspect || null;
  }
  function nameFor(base, rarity, traits) {
    if (rarity === "salvage") return `${rng.pick(["Patched", "Dented", "Rusty", "Second-hand", "Scorched", "Bent"])} ${base.name}`;
    if (rarity === "signed") {
      const n = rng.int(3, 99), r = rng.pick(["II", "III", "IV", "VII", "IX", "XII"]);
      return `${rng.pick(NAMES.makers)} ${rng.pick(NAMES.models).replace("{n}", n).replace("{r}", r)}, "${rng.pick(NAMES.epithets)}"`;
    }
    const pre = traits.map(t => ALL_AFFIX[t.id]).find(a => a?.type === "prefix"), suf = traits.map(t => ALL_AFFIX[t.id]).find(a => a?.type === "suffix");
    return [pre?.name, base.name, suf?.name].filter(Boolean).join(" ");
  }

  // ---- bases
  function pickBase({ slot, ilvl = 1 } = {}) {
    const s = slot || wpick(Object.entries(SLOT_WEIGHT).map(([v, w]) => ({ v, w })));
    const pool = Object.values(ITEMS).filter(b => b.slot === s && b.minLvl <= Math.max(1, ilvl));
    return wpick(pool.map(b => ({ v: b.id, w: 1 + b.minLvl / 3 }))) || "pick";
  }
  function pickModule({ building, ilvl = 1, lark = false } = {}) {
    const src = lark ? LARK_PARTS : MODULES;
    const pool = Object.values(src).filter(m => (!building || m.building === building) && m.minLvl <= Math.max(1, ilvl));
    return rng.pick(pool)?.id;
  }

  // ---- generate
  function makeGear({ base, slot, rarity, ilvl = 1, luck = 0, from = null } = {}) {
    const b = ITEMS[base] || ITEMS[pickBase({ slot, ilvl })];
    const r = rarity || rollRarity(luck);
    const traits = rollTraits(b.slot, r, ilvl, AFFIXES, RARITY[r].affixes);
    const aspect = aspectOf(b, traits);
    const it = { uid: uid(), type: "gear", base: b.id, slot: b.slot, kind: b.kind, rarity: r, ilvl, name: nameFor(b, r, traits), aspect, traits, cells: [], overhaul: 0, retunes: 0, from };
    if (r === "signed") { it.unassayed = true; it.logbook = rng.pick(NAMES.logbook); it.power = SIGNED_POWERS[aspect || "none"]; }
    return it;
  }
  function makeModule({ id, building, rarity, ilvl = 1, luck = 0, lark = false, from = null } = {}) {
    const src = lark ? LARK_PARTS : MODULES;
    const m = src[id] || src[pickModule({ building, ilvl, lark })];
    const r = rarity || rollRarity(luck);
    const value = m.float ? Math.round(m.base * RARITY[r].statMult * (1 + ilvl * 0.02) * 100) / 100 : Math.round(m.base * RARITY[r].statMult * (1 + ilvl * 0.02));
    const traits = rollTraits(m.slot, r, ilvl, MODULE_AFFIXES, Math.min(2, RARITY[r].affixes));
    const pre = traits.map(t => MODULE_AFFIXES[t.id]).find(a => a.type === "prefix"), suf = traits.map(t => MODULE_AFFIXES[t.id]).find(a => a.type === "suffix");
    return { uid: uid(), type: m.slot, base: m.id, slot: m.slot, building: m.building, kind: m.kind, rarity: r, ilvl, value,
      name: [pre?.name, m.name, suf?.name].filter(Boolean).join(" "), effect: m.text.replace("{v}", value), traits, from };
  }
  function makeRelic(id, from = null) {
    const r = RELICS[id];
    return { uid: uid(), type: "relic", base: r.id, slot: r.slot, kind: r.kind, rarity: r.rarity, ilvl: r.ilvl, name: r.name, aspect: r.aspect || null, traits: [], cells: [], overhaul: 0, from };
  }
  const relicsOf = rarity => Object.values(RELICS).filter(r => r.rarity === rarity);
  const assay = it => { const c = { ...it }; delete c.unassayed; return c; };

  // ---- drops: Wildlight & claim-jumpers
  // ctx: { night, deep, grudge, carried:[{base,rarity}|{relic}], known:Set of blueprint ids }
  function foeDrops(foeId, ctx = {}) {
    const foe = FOES[foeId], tier = foe.tier, night = ctx.night || 1;
    const ilvl = Math.max(1, Math.round(night * 0.8) + (ctx.deep ? 3 : 0));
    const luck = DROPS.luck[tier] + night * DROPS.nightLuck + (ctx.deep ? DROPS.deepLuck : 0) + (ctx.grudge ? 1 : 0);
    const from = foe.name, items = [];
    const rand = (min = "salvage", max = "signed") => makeGear({ rarity: rollRarity(luck, { min, max }), ilvl, from });
    if (tier === "rabble") { if (rng.chance(DROPS.rabbleChance)) items.push(rand("salvage", ORDER[Math.min(4, 1 + Math.floor(night / 8))])); }
    else if (tier === "veteran") items.push(rand());
    else if (tier === "bearer") {
      // the swallowed thing: usually gear, sometimes a Masterwork or a module
      if (rng.chance(DROPS.masterworkChance.bearer)) { const m = rng.pick(relicsOf("masterwork").filter(r => r.ilvl <= ilvl + 6)); if (m) items.push(makeRelic(m.id, from)); }
      else items.push(rng.chance(0.3) ? makeModule({ rarity: rollRarity(luck, { min: "tooled" }), ilvl, from }) : rand("tooled"));
    } else if (tier === "champion" && rng.chance(DROPS.masterworkChance.champion)) {
      const m = rng.pick(relicsOf("masterwork")); items.push(makeRelic(m.id, from));
    }
    for (let i = 0; i < (DROPS.extra[tier] || 0) + (ctx.grudge ? 1 : 0); i++) items.push(rand(DROPS.minRarity[tier]));
    const out = ctx.grudge ? items.map(it => it.type === "relic" ? it : { ...it, rarity: bumpRarity(it.rarity), stamp: "grudge-settled" }) : items;
    const blueprints = [];
    for (const it of out) if (it.type === "gear" && ctx.known && !ctx.known.has(it.base) && rng.chance(DROPS.blueprintChance)) blueprints.push(it.base);
    return { items: out, shards: DROPS.shards[tier] || 0, materials: { ...(DROPS.materials[tier] || {}) }, blueprints };
  }

  // ---- mine finds
  function mineFind(gallery = "upper", ctx = {}) {
    const g = MINE_FINDS.galleries[gallery], night = ctx.night || 1;
    const ilvl = Math.max(1, Math.round(night * 0.8) + g.ilvlBonus), luck = g.luck + (ctx.findLuck || 0) + night * DROPS.nightLuck;
    if (gallery === "deep" && rng.chance(MINE_FINDS.sunforgedChance)) { const s = rng.pick(relicsOf("sunforged").filter(r => /Mine/.test(r.source))); if (s) return { kind: "sunforged", item: makeRelic(s.id, "the deep seam") }; }
    const kind = pickTable(g.table);
    if (kind === "item") return { kind, item: makeGear({ luck, ilvl, from: `the ${gallery} gallery` }) };
    if (kind === "module") return { kind, item: makeModule({ luck, ilvl, from: `the ${gallery} gallery` }) };
    if (kind === "cell") return { kind, cell: rng.pick(Object.keys(CELLS)) };
    if (kind === "blueprint") return { kind, blueprint: pickBase({ ilvl: ilvl + 2 }) };
    if (kind === "material") { const m = pickTable(g.materials || { brass: 1 }); return { kind, material: m, n: m === "heartstone" ? 1 : rng.int(1, 2) }; }
    const mw = rng.pick(relicsOf("masterwork").filter(r => /Mine/.test(r.source)));
    return { kind: "masterwork", item: makeRelic(mw.id, "the deep seam") };
  }

  // ---- raids
  function raidCrates(raidId) {
    const R = RAIDS[raidId], luck = DROPS.luck[R.tier] + 1, crates = [];
    for (let i = 0; i < R.crates; i++) {
      const roll = rng.next();
      if (roll < 0.25) crates.push(makeModule({ luck, ilvl: R.ilvl, from: R.name }));
      else crates.push(makeGear({ luck, ilvl: R.ilvl, rarity: rollRarity(luck, { min: DROPS.minRarity[R.tier] }), from: R.name }));
    }
    if (R.larkPart && rng.chance(R.larkPart)) crates.push(makeModule({ lark: true, luck, ilvl: R.ilvl, from: R.name }));
    if (R.masterwork && rng.chance(R.masterwork)) { const m = rng.pick(relicsOf("masterwork").filter(r => /Raid/.test(r.source))); crates.push(makeRelic(m.id, R.name)); }
    if (R.sunforged && rng.chance(R.sunforged)) { const s = rng.pick(relicsOf("sunforged").filter(r => /Raid/.test(r.source))); if (s) crates.push(makeRelic(s.id, R.name)); }
    return { items: crates, shards: rng.int(R.shards[0], R.shards[1]), materials: { ...(R.materials || {}) } };
  }

  // ---- courier trade
  function courierStock(ilvl = 1) {
    const out = [];
    for (let i = 0; i < TRADE.stock; i++) {
      const r = rollRarity(0.5, { max: TRADE.maxRarity });
      const it = rng.chance(0.3) ? makeModule({ rarity: r, ilvl }) : makeGear({ rarity: r, ilvl });
      out.push({ item: it, price: Math.round(TRADE.pricePerIlvl * Math.max(1, ilvl) * TRADE.rarityMult[r]) });
    }
    return out;
  }

  // ---- workshop (Odile's bench)
  const half = it => Math.ceil(Math.max(1, it.ilvl || 1) / 2);
  const salvageYield = it => it.type === "relic" ? null : { ...(WORKSHOP.salvage[it.rarity] || {}) };
  const isModule = it => it.type === "module" || it.type === "lark";
  function retuneCost(it) {
    const mat = WORKSHOP.retune.material[it.rarity]; if (!mat || !(it.type === "gear" || isModule(it)) || !(it.traits || []).length) return null;
    return { shards: WORKSHOP.retune.base * half(it) * (1 + (it.retunes || 0)), materials: { [mat]: 1 } };
  }
  // a fresh roll for one trait (the rest stay); returns a new copy of the item, or null if nothing else could roll
  function retune(it, index) {
    if (!it.traits || !it.traits[index]) return null;
    const mod = isModule(it), src = it.type === "lark" ? LARK_PARTS : MODULES, b = mod ? src[it.base] : ITEMS[it.base]; if (!b) return null;
    const keep = it.traits.filter((_, i) => i !== index);
    let fresh = null;
    for (let k = 0; k < 8 && (!fresh || fresh.id === it.traits[index].id); k++) fresh = rollTraits(mod ? it.slot : b.slot, it.rarity, it.ilvl, mod ? MODULE_AFFIXES : AFFIXES, keep.length + 1, keep).at(-1);
    if (!fresh || fresh.id === it.traits[index].id) return null;
    const traits = it.traits.map((t, i) => i === index ? fresh : t);
    if (mod) {
      const pre = traits.map(t => MODULE_AFFIXES[t.id]).find(a => a && a.type === "prefix"), suf = traits.map(t => MODULE_AFFIXES[t.id]).find(a => a && a.type === "suffix");
      return { ...it, traits, retunes: (it.retunes || 0) + 1, name: [pre?.name, b.name, suf?.name].filter(Boolean).join(" ") };
    }
    return { ...it, traits, retunes: (it.retunes || 0) + 1, aspect: aspectOf(b, traits), name: ["salvage", "signed"].includes(it.rarity) ? it.name : nameFor(b, it.rarity, traits) };
  }
  function overhaulCost(it) {
    const O = WORKSHOP.overhaul, t = it.overhaul || 0; if (t >= O.max) return null;
    const materials = {}; if (O.glass[t]) materials.glass = O.glass[t]; if (O.heartstone[t]) materials.heartstone = O.heartstone[t];
    return { shards: O.base * half(it) * O.mult[t], materials };
  }
  const socketsOf = it => it.type === "relic" ? RARITY[it.rarity].cells : ["calibrated", "signed"].includes(it.rarity) ? RARITY[it.rarity].cells : 0;
  function setBonuses(bases) {
    const out = []; for (const [id, s] of Object.entries(SETS)) { const n = s.pieces.filter(p => bases.includes(p)).length; for (const b of s.bonuses) if (n >= b.n) out.push({ set: id, name: s.name, ...b }); }
    return out;
  }

  // ---- weapon numbers for the town sim: damage per second against a foe, given the wielder's stat
  function weaponDps(it, statValue = 6, foeId = null) {
    const b = ITEMS[it.base] || ITEMS[RELICS[it.base]?.base]; if (!b?.weapon) return 0;
    const w = b.weapon, r = RARITY[it.rarity];
    let dmg = w.dmg * r.statMult * (1 + (it.overhaul || 0) * WORKSHOP.overhaul.perLevel) * (1 + 0.08 * statValue);
    let rate = 1 / w.cd;
    for (const t of it.traits || []) { const a = AFFIXES[t.id]; if (!a) continue; if (a.stat === "dmg") dmg *= 1 + t.value / 100; if (a.stat === "rate") rate *= 1 + t.value / 100; }
    const parts = [{ aspect: w.aspect, k: 1 }];
    for (const t of it.traits || []) { const a = AFFIXES[t.id]; if (a?.stat === "extra") parts.push({ aspect: a.aspect, k: t.value / 100 }); }
    const res = foeId ? FOES[foeId].resist : {};
    const mult = parts.reduce((s, p) => s + p.k * (1 - (res[p.aspect] || 0) / 100), 0);
    return Math.round(dmg * rate * mult * 10) / 10;
  }

  return { rng, rankOf, rarityOdds, rollRarity, bumpRarity, makeGear, makeModule, makeRelic, assay, traitText, traitStars,
    foeDrops, mineFind, raidCrates, courierStock, salvageYield, retuneCost, retune, overhaulCost, socketsOf, setBonuses, weaponDps };
}

const { KINDS, iconCanvas } = (() => {
// Pixel icons for Brightvein loot: each kind is a few shapes in a 32×32 grid,
// rasterised with per-material 4-tone ramps (shadows lean plum, lights lean cream),
// a coloured outline, and crystal parts tinted by the item's aspect.
const MATS = {
  brass:   ["#4a2c10", "#9a6a26", "#d9a845", "#fff0b0"],
  copper:  ["#45180f", "#9a4a2a", "#d27a4a", "#ffc8a0"],
  iron:    ["#221d2a", "#4a4858", "#7f8296", "#c9ccd8"],
  steel:   ["#2a2e3e", "#5e6d82", "#a3b3c6", "#eef4ff"],
  wood:    ["#331c14", "#6e4426", "#a06a3c", "#d8a46c"],
  leather: ["#2a1614", "#5e3424", "#8e5a3a", "#c08a60"],
  canvas:  ["#3e3428", "#82725a", "#c2b08a", "#ece0c0"],
  plum:    ["#1e1222", "#3e2448", "#6a3e72", "#a070a8"],
  glass:   ["#1c3044", "#3e7090", "#8ac4e0", "#f0ffff"],
  green:   ["#1c2e18", "#3e6a2a", "#6ea44e", "#b8e08a"],
  dark:    ["#130b15", "#271a2b", "#3b2a41", "#58435f"],
  rubber:  ["#121114", "#26252b", "#3e3d48", "#62617a"],
  gold:    ["#4e3008", "#b07a10", "#f0c040", "#fff6c0"],
  bone:    ["#4e463e", "#a49a8a", "#ddd4c4", "#ffffff"],
  red:     ["#3a0f12", "#7e2026", "#c0443c", "#ff9a7a"],
  shade:   ["#140c26", "#33215e", "#5e44a8", "#a68cff"],
};
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
function rgbHex(c) { return "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""); }
function crystalRamp(hex) { const c = hexToRgb(hex); return [rgbHex(mix(c, [40, 12, 30], 0.7)), rgbHex(mix(c, [60, 20, 40], 0.3)), hex, rgbHex(mix(c, [255, 252, 235], 0.6))]; }

// shapes: L line(x1,y1,x2,y2,w,m) · R rect(x,y,w,h,m) · C circle(cx,cy,r,m) · E ellipse(cx,cy,rx,ry,m) · P poly(pts,m) · O ring(cx,cy,r,w,m)
const L = (x1, y1, x2, y2, w, m) => ({ t: "L", x1, y1, x2, y2, w, m });
const R = (x, y, w, h, m) => ({ t: "R", x, y, w, h, m });
const C = (cx, cy, r, m) => ({ t: "C", cx, cy, r, m });
const E = (cx, cy, rx, ry, m) => ({ t: "E", cx, cy, rx, ry, m });
const P = (pts, m) => ({ t: "P", pts, m });
const O = (cx, cy, r, w, m) => ({ t: "O", cx, cy, r, w, m });
const X = "crystal";

const KINDS = {
  pick: [L(7, 27, 21, 9, 2.6, "wood"), P([[11, 5], [17, 6], [24, 9], [29, 15], [25, 13], [18, 10], [12, 8]], "iron"), C(20, 9.5, 2, "brass")],
  pick2: [L(7, 27, 21, 9, 2.8, "wood"), P([[10, 4], [17, 5], [24, 8], [30, 15], [25, 13], [18, 10], [11, 8]], "steel"), C(20, 9.5, 2.4, "gold"), C(20, 9.5, 1, X)],
  drill: [R(5, 15, 9, 11, "copper"), C(9.5, 14, 4.5, "brass"), L(13, 18, 22, 13, 4, "iron"), P([[21, 10], [30, 9], [23, 17]], "steel"), L(9, 26, 9, 29, 2, "dark"), C(9.5, 14, 1.6, "glass")],
  spanner: [L(8, 25, 22, 11, 3, "steel"), O(24, 9, 4.2, 2.2, "steel"), R(23, 4, 3, 4, "dark"), O(7, 26, 3, 1.6, "steel")],
  hammer: [L(9, 28, 19, 12, 2.4, "wood"), R(13, 5, 14, 8, "iron"), R(16, 3, 8, 12, "brass"), C(20, 9, 1.6, "dark")],
  plumb: [L(16, 3, 16, 17, 1, "brass"), O(16, 3, 2, 1, "brass"), P([[12, 17], [20, 17], [16, 29]], "iron"), C(16, 20, 1.4, "gold")],
  anchor: [L(16, 4, 16, 26, 3, "iron"), O(16, 5, 2.6, 1.6, "iron"), L(9, 10, 23, 10, 2.4, "iron"), P([[5, 19], [9, 27], [16, 29], [23, 27], [27, 19], [24, 23], [16, 26], [8, 23]], "iron"), C(16, 17, 2, "brass")],
  machete: [L(6, 27, 10, 23, 3, "leather"), R(9, 21, 4, 3, "brass"), P([[11, 21], [25, 6], [28, 6], [27, 10], [13, 24]], "steel")],
  lance: [L(5, 28, 25, 8, 2.2, "wood"), L(23, 10, 28, 5, 2.6, "copper"), P([[26, 2], [30, 2], [30, 6]], "copper"), R(14, 17, 3, 3, "brass")],
  pole: [L(5, 28, 25, 8, 2, "copper"), O(26, 6, 3, 1.4, "brass"), C(25, 11, 2.2, X), R(12, 19, 3, 3, "brass")],
  halberd: [L(5, 28, 24, 9, 2, "wood"), P([[18, 6], [26, 3], [24, 11], [19, 13]], "steel"), L(24, 9, 29, 4, 1.6, "steel"), C(18, 15, 2.6, "brass"), C(18, 15, 1, "dark")],
  hook: [L(5, 28, 21, 12, 2, "wood"), O(23, 9, 4.5, 2, "shade"), R(16, 16, 3, 3, "brass")],
  fork: [L(16, 30, 16, 16, 3, "brass"), L(11, 16, 11, 3, 3, "steel"), L(21, 16, 21, 3, 3, "steel"), L(11, 16, 21, 16, 3, "steel"), C(16, 22, 1.6, X)],
  pistol: [P([[6, 12], [24, 12], [24, 17], [12, 17], [12, 18]], "brass"), L(8, 9, 22, 9, 3, "iron"), L(8, 13, 22, 13, 2, "iron"), P([[10, 17], [15, 17], [13, 27], [7, 27]], "wood"), C(25, 11, 1.8, X)],
  rivet: [R(7, 10, 17, 7, "copper"), R(22, 11, 6, 3, "iron"), P([[9, 17], [15, 17], [14, 27], [8, 27]], "rubber"), L(9, 10, 6, 5, 1.4, "rubber"), C(13, 13, 2, "brass")],
  kettle: [E(12, 16, 7, 8, "copper"), R(17, 13, 11, 4, "brass"), P([[8, 22], [13, 22], [11, 29], [6, 29]], "wood"), L(9, 8, 15, 8, 2, "brass"), C(12, 16, 2, "glass")],
  rifle: [L(3, 22, 29, 10, 2.2, "iron"), P([[3, 22], [11, 18], [12, 22], [5, 27]], "wood"), E(16, 18, 4, 2.4, "brass"), C(16, 18, 1, "glass")],
  rifle2: [L(2, 22, 30, 9, 2, "steel"), P([[2, 22], [10, 18], [11, 22], [4, 27]], "dark"), E(15, 18, 4, 2.4, "steel"), L(17, 13, 24, 10, 1.6, "brass")],
  carbine: [L(4, 22, 24, 12, 3, "brass"), E(26, 10, 3.4, 4, "brass"), E(26, 10, 2.2, 3, "glass"), P([[6, 21], [12, 19], [12, 24], [6, 27]], "wood"), C(14, 18, 1.6, X)],
  musket: [L(2, 24, 26, 10, 2.6, "brass"), C(27, 9, 4, "brass"), C(27, 9, 2.6, "glass"), P([[2, 24], [10, 19], [11, 24], [4, 29]], "wood"), R(14, 16, 4, 3, "copper")],
  caster: [R(8, 14, 10, 10, "copper"), L(16, 15, 27, 6, 2, "copper"), L(16, 21, 28, 16, 2, "copper"), C(13, 19, 2.6, X), P([[9, 24], [14, 24], [13, 29], [8, 29]], "rubber")],
  organ: [R(6, 14, 18, 12, "plum"), ...[0, 1, 2, 3, 4].map(i => R(7 + i * 3.4, 4 + (i % 2) * 2, 2.6, 11 - (i % 2) * 2, "brass")), C(15, 20, 2.4, X), L(24, 18, 29, 12, 1.6, "copper")],
  mortar: [P([[7, 27], [25, 27], [22, 22], [10, 22]], "iron"), L(12, 22, 24, 8, 5, "iron"), E(24.5, 7.5, 3, 2, "dark"), C(13, 22, 2, "brass"), C(26, 4, 1.4, "shade")],
  sprayer: [R(5, 9, 7, 16, "steel"), E(8.5, 9, 3.5, 2, "steel"), L(12, 17, 24, 13, 2, "brass"), P([[23, 11], [29, 9], [29, 16], [23, 15]], "brass"), C(8.5, 17, 2, X)],
  harpoon: [L(4, 26, 20, 14, 3, "iron"), L(17, 16, 28, 6, 1.4, "steel"), P([[26, 3], [30, 3], [29, 8]], "steel"), L(26, 9, 23, 7, 1, "steel"), P([[6, 24], [11, 23], [11, 28], [6, 29]], "wood")],
  jug: [E(16, 19, 8, 9, "canvas"), R(13, 6, 6, 5, "canvas"), R(12, 4, 8, 3, "wood"), E(16, 19, 4, 4, X), L(13, 7, 19, 7, 1, "copper")],
  smoker: [R(10, 12, 12, 15, "copper"), P([[10, 12], [22, 12], [19, 6], [13, 6]], "brass"), R(14, 3, 4, 4, "brass"), L(22, 18, 28, 22, 3, "leather"), C(16, 19, 2.4, "gold")],
  sword: [L(6, 26, 25, 7, 3, "steel"), L(25, 7, 28, 4, 2, "steel"), L(5, 20, 12, 27, 2.4, "gold"), L(3, 29, 7, 25, 2.4, "leather"), C(8.5, 23.5, 2, X)],
  ledger: [R(6, 8, 20, 18, "brass"), R(8, 10, 16, 5, "glass"), ...[0, 1, 2].map(i => R(8 + i * 6, 17, 4, 3, "bone")), ...[0, 1, 2].map(i => R(8 + i * 6, 21, 4, 3, "bone")), L(26, 12, 29, 9, 2, "brass")],
  tongs: [L(6, 28, 22, 5, 2, "copper"), L(10, 28, 26, 5, 2, "copper"), C(14.5, 17, 1.8, "brass"), C(24, 4, 2.4, X)],
  can: [R(9, 13, 13, 13, "copper"), L(21, 17, 28, 9, 2.4, "copper"), E(28.5, 8.5, 2, 1.4, "brass"), O(10, 13, 5, 1.6, "brass"), L(13, 8, 13, 13, 1.6, "iron")],
  scope: [L(4, 26, 27, 6, 4.4, "brass"), L(6, 24, 13, 18, 5.2, "leather"), C(27.5, 5.5, 2.2, "glass"), R(16, 13, 3, 3, "dark")],
  loupe: [O(14, 14, 7, 2.2, "gold"), C(14, 14, 5, "glass"), L(19, 19, 27, 27, 2.6, "brass"), C(11, 11, 1.4, "bone")],
  buckler: [C(16, 16, 12, "steel"), C(16, 16, 9, "glass"), C(16, 16, 3, "brass")],
  parasol: [P([[3, 14], [16, 3], [29, 14], [22, 12], [16, 14], [10, 12]], "glass"), L(16, 3, 16, 14, 1, "brass"), L(16, 14, 16, 28, 1.6, "brass"), L(16, 28, 13, 29, 1.6, "brass")],
  lantern: [R(10, 9, 12, 16, "dark"), R(12, 11, 8, 12, "shade"), O(16, 6, 3, 1.4, "iron"), R(9, 25, 14, 3, "iron"), R(9, 7, 14, 3, "iron")],
  gauge: [C(16, 16, 11, "brass"), C(16, 16, 8.5, "bone"), L(16, 16, 21, 11, 1.4, "red"), C(16, 16, 1.6, "dark"), R(14, 3, 4, 3, "brass")],
  lampshield: [P([[5, 5], [27, 5], [27, 16], [16, 29], [5, 16]], "iron"), C(16, 14, 4.4, "brass"), C(16, 14, 3, X)],
  goggles: [L(4, 16, 28, 16, 2.4, "leather"), C(11, 16, 5, "brass"), C(21, 16, 5, "brass"), C(11, 16, 3.4, "glass"), C(21, 16, 3.4, "glass")],
  visor: [E(16, 18, 12, 9, "iron"), P([[5, 14], [27, 14], [26, 21], [6, 21]], "shade"), R(4, 11, 24, 3, "brass")],
  helm: [E(16, 18, 11, 10, "leather"), R(4, 20, 24, 4, "leather"), C(16, 12, 4, "brass"), C(16, 12, 2.6, X)],
  cap: [E(16, 17, 11, 10, "leather"), R(5, 21, 5, 7, "canvas"), R(22, 21, 5, 7, "canvas"), C(11, 12, 3, "brass"), C(19, 12, 3, "brass"), C(11, 12, 1.8, "glass"), C(19, 12, 1.8, "glass")],
  sunhat: [E(16, 21, 14, 4, "canvas"), E(16, 15, 7, 6, "canvas"), R(9, 17, 14, 2, "glass")],
  diving: [C(16, 15, 11, "brass"), C(16, 15, 6, "glass"), R(6, 24, 20, 5, "copper"), C(6, 15, 2, "copper"), C(26, 15, 2, "copper")],
  coat: [P([[9, 5], [23, 5], [27, 29], [5, 29]], "canvas"), P([[13, 5], [19, 5], [16, 14]], "plum"), L(16, 14, 16, 29, 1, "canvas"), C(14, 18, 1, "brass"), C(14, 23, 1, "brass")],
  coat2: [P([[9, 5], [23, 5], [26, 27], [6, 27]], "rubber"), P([[12, 5], [20, 5], [16, 12]], "canvas"), L(16, 12, 16, 27, 1, "brass")],
  apron: [P([[11, 6], [21, 6], [21, 12], [25, 29], [7, 29], [11, 12]], "leather"), L(6, 12, 26, 12, 1.4, "leather"), R(12, 18, 8, 5, "canvas")],
  vest: [P([[8, 6], [24, 6], [25, 27], [7, 27]], "iron"), ...[0, 1, 2, 3].map(i => L(8, 10 + i * 5, 24, 10 + i * 5, 0.8, "dark")), ...[0, 1, 2].map(i => C(10, 11 + i * 6, 0.9, "brass")), ...[0, 1, 2].map(i => C(22, 11 + i * 6, 0.9, "brass"))],
  cloak: [P([[12, 4], [20, 4], [28, 29], [4, 29]], "shade"), E(16, 6, 5, 3, "shade"), C(16, 8, 1.6, "brass")],
  harness: [L(10, 4, 10, 28, 2, "leather"), L(22, 4, 22, 28, 2, "leather"), C(16, 14, 5, "brass"), C(16, 14, 3, "iron"), L(10, 22, 22, 22, 2, "iron"), O(16, 14, 6.4, 1, "copper")],
  gloves: [P([[9, 28], [9, 13], [12, 6], [15, 13], [16, 5], [19, 13], [21, 7], [23, 15], [23, 28]], "leather"), R(8, 23, 16, 5, "canvas")],
  gauntlet: [P([[9, 28], [9, 13], [12, 6], [15, 13], [16, 5], [19, 13], [21, 7], [23, 15], [23, 28]], "rubber"), R(8, 23, 16, 5, "copper")],
  gauntlet2: [P([[9, 28], [9, 13], [12, 6], [15, 13], [16, 5], [19, 13], [21, 7], [23, 15], [23, 28]], "brass"), C(16, 18, 2.4, "steel"), C(16, 18, 1, "dark"), R(8, 23, 16, 5, "iron")],
  boots: [P([[8, 5], [17, 5], [17, 20], [28, 23], [28, 28], [8, 28]], "leather"), R(7, 26, 22, 3, "iron")],
  boots2: [P([[8, 5], [17, 5], [17, 19], [27, 22], [27, 25], [8, 25]], "leather"), L(10, 26, 10, 29, 1.6, "steel"), L(14, 26, 14, 29, 1.6, "steel"), L(22, 26, 22, 29, 1.6, "steel")],
  boots3: [P([[8, 5], [17, 5], [17, 20], [28, 23], [28, 28], [8, 28]], "plum"), R(7, 25, 22, 4, "iron"), R(9, 9, 7, 2, "brass")],
  watch: [O(16, 6, 3, 1.4, "brass"), C(16, 18, 10, "brass"), C(16, 18, 8, "bone"), L(16, 18, 16, 12, 1.2, "dark"), L(16, 18, 20, 19, 1.2, "dark")],
  heart: [C(16, 17, 11, "glass"), P([[16, 26], [8, 17], [9, 11], [13, 10], [16, 13], [19, 10], [23, 11], [24, 17]], "red"), C(16, 17, 3, "brass"), C(16, 17, 1.4, "dark")],
  locket: [L(9, 3, 16, 10, 1, "gold"), L(23, 3, 16, 10, 1, "gold"), E(16, 18, 7, 8, "gold"), E(16, 18, 4, 5, X)],
  compass: [C(16, 16, 11, "brass"), C(16, 16, 8.5, "plum"), P([[16, 8], [18, 16], [16, 24], [14, 16]], "bone"), P([[16, 8], [18, 16], [14, 16]], "red"), C(16, 16, 1.4, "gold")],
  coin: [C(16, 16, 11, "gold"), C(16, 16, 8, "gold"), R(13, 12, 6, 8, "brass")],
  cell: [R(10, 6, 12, 21, "brass"), R(12, 9, 8, 15, X), ...[0, 1, 2].map(i => L(10, 11 + i * 5, 22, 11 + i * 5, 0.8, "brass")), R(13, 3, 6, 3, "copper")],
  satchel: [R(6, 12, 20, 15, "leather"), P([[6, 12], [26, 12], [24, 19], [8, 19]], "leather"), C(16, 18, 1.6, "brass"), L(8, 12, 12, 3, 1.4, "leather"), L(24, 12, 20, 3, 1.4, "leather")],
  engine: [C(16, 16, 10, "brass"), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => C(16 + Math.cos(i * 0.785) * 11, 16 + Math.sin(i * 0.785) * 11, 2, "brass")), C(16, 16, 5.5, X), C(16, 16, 2, "bone")],
  figurehead: [P([[4, 18], [14, 10], [24, 4], [20, 12], [29, 12], [18, 18], [10, 24]], "brass"), C(22, 9, 1.2, "dark"), L(10, 24, 6, 29, 2, "wood")],
  beacon: [P([[16, 2], [25, 14], [16, 30], [7, 14]], X), P([[16, 2], [20, 14], [16, 30]], X), R(9, 25, 14, 4, "brass")],
  bigLens: [O(16, 16, 12, 2.6, "brass"), C(16, 16, 9.4, "glass"), O(16, 16, 6, 1, "glass"), C(16, 16, 3, X)],
  // modules
  telegraph: [R(6, 20, 20, 6, "wood"), L(10, 18, 22, 14, 2, "brass"), C(23, 13.5, 2.4, "dark"), C(10, 18, 2, "brass"), L(26, 23, 29, 23, 1.4, "copper")],
  scale: [L(16, 6, 16, 26, 1.6, "brass"), L(6, 10, 26, 10, 1.6, "brass"), E(8, 18, 5, 2, "brass"), E(24, 16, 5, 2, "brass"), L(8, 10, 8, 18, 0.8, "brass"), L(24, 10, 24, 16, 0.8, "brass"), C(24, 14, 2, X), R(10, 26, 12, 3, "wood")],
  ticker: [E(16, 13, 8, 8, "glass"), R(10, 20, 12, 7, "brass"), L(16, 13, 16, 20, 1, "brass"), R(22, 22, 8, 2, "canvas")],
  drillhead: [P([[8, 6], [24, 6], [16, 29]], "steel"), ...[0, 1, 2].map(i => L(9 + i * 1.6, 10 + i * 6, 23 - i * 1.6, 13 + i * 6, 1, "iron")), R(8, 3, 16, 4, "brass")],
  canary: [O(16, 14, 9, 1.4, "brass"), R(7, 23, 18, 3, "wood"), E(16, 16, 4, 3, "gold"), C(18, 13.5, 2.2, "gold"), C(19, 13, 0.6, "dark"), L(16, 2, 16, 5, 1, "brass")],
  sorter: [P([[6, 6], [26, 6], [20, 16], [12, 16]], "iron"), R(12, 16, 8, 6, "iron"), C(10, 26, 2.4, X), C(16, 27, 2, "dark"), C(22, 26, 2.4, X)],
  props: [L(8, 4, 8, 28, 3, "iron"), L(24, 4, 24, 28, 3, "iron"), L(5, 6, 27, 6, 3, "iron"), L(9, 9, 23, 25, 1.4, "iron")],
  mirror: [E(16, 14, 12, 9, "brass"), E(16, 14, 10, 7, "glass"), L(16, 22, 16, 28, 2, "iron"), R(10, 27, 12, 3, "iron")],
  gimbal: [O(16, 16, 11, 1.6, "brass"), E(16, 16, 11, 5, "copper"), C(16, 16, 5, "glass"), C(16, 16, 2, X)],
  cloudlens: [E(16, 10, 10, 5, "bone"), C(10, 9, 4, "bone"), C(20, 7, 5, "bone"), C(16, 21, 6, "glass"), O(16, 21, 6, 1.2, "brass")],
  jars: [...[0, 1, 2].map(i => R(5 + i * 8, 10, 6, 16, "glass")), ...[0, 1, 2].map(i => R(6 + i * 8, 15, 4, 10, X)), R(4, 8, 24, 3, "copper"), R(4, 26, 24, 3, "wood")],
  wheel: [C(16, 15, 10, "bone"), O(16, 15, 10, 1.6, "steel"), C(16, 15, 2, "iron"), R(6, 25, 20, 4, "wood"), L(16, 15, 16, 25, 2, "iron")],
  lathe: [R(4, 18, 24, 6, "iron"), R(5, 10, 6, 8, "iron"), R(21, 12, 6, 6, "iron"), L(11, 14, 21, 14, 2, "brass"), C(8, 9, 3, "brass")],
  bellows: [P([[4, 16], [22, 6], [26, 16], [22, 26]], "leather"), L(22, 6, 22, 26, 1.6, "wood"), L(26, 16, 30, 16, 2, "brass"), L(4, 16, 22, 6, 1.4, "wood"), L(4, 16, 22, 26, 1.4, "wood")],
  drip: [L(4, 8, 28, 8, 2.4, "copper"), ...[0, 1, 2].map(i => C(8 + i * 8, 12 + i % 2 * 3, 1.4, "glass")), P([[6, 28], [26, 28], [24, 22], [8, 22]], "wood"), ...[0, 1, 2].map(i => L(9 + i * 7, 22, 9 + i * 7, 18, 1.6, "green"))],
  beebox: [R(6, 12, 20, 15, "wood"), P([[4, 13], [16, 4], [28, 13]], "copper"), R(14, 23, 4, 2, "dark"), E(22, 9, 2, 1.4, "gold"), E(9, 18, 2, 1.4, "gold")],
  growlamp: [L(16, 2, 16, 10, 1.4, "iron"), P([[8, 14], [24, 14], [20, 9], [12, 9]], "brass"), E(16, 15, 6, 2, X), L(16, 30, 16, 22, 2, "green"), E(12, 23, 4, 2, "green"), E(20, 25, 4, 2, "green")],
  radiator: [...[0, 1, 2, 3, 4].map(i => R(5 + i * 4.6, 7, 3.6, 19, "copper")), R(4, 24, 24, 3, "iron"), C(27, 10, 2, "brass")],
  lockers: [R(6, 4, 9, 24, "iron"), R(17, 4, 9, 24, "iron"), ...[0, 1].map(i => L(8 + i * 11, 7, 13 + i * 11, 7, 0.8, "dark")), C(13, 16, 1, "brass"), C(24, 16, 1, "brass")],
  bell: [P([[9, 23], [11, 10], [16, 6], [21, 10], [23, 23]], "brass"), R(7, 23, 18, 3, "brass"), C(16, 27, 2, "iron"), O(16, 5, 2, 1, "iron")],
  fresnel: [...[11, 8, 5].map((r, i) => O(16, 16, r, 1.5, i === 0 ? "brass" : "glass")), C(16, 16, 2.4, X)],
  shutter: [C(16, 16, 11, "iron"), ...[0, 1, 2, 3, 4, 5].map(i => P([[16, 16], [16 + Math.cos(i * 1.047) * 9, 16 + Math.sin(i * 1.047) * 9], [16 + Math.cos(i * 1.047 + 0.8) * 9, 16 + Math.sin(i * 1.047 + 0.8) * 9]], i % 2 ? "steel" : "dark")), C(16, 16, 3, "glass")],
  prism: [P([[16, 6], [25, 24], [7, 24]], "glass"), L(2, 16, 12, 16, 1.4, "bone"), L(21, 15, 30, 10, 1, X), L(21, 17, 30, 20, 1, "shade")],
  hood: [P([[6, 26], [10, 8], [22, 8], [26, 26]], "copper"), E(16, 22, 7, 4, "dark"), E(16, 22, 5, 2.6, "shade")],
  wire: [L(3, 10, 29, 10, 1, "copper"), L(3, 18, 29, 18, 1, "copper"), L(8, 6, 8, 28, 2, "wood"), L(24, 6, 24, 28, 2, "wood"), C(16, 10, 1.6, X), C(16, 18, 1.6, X)],
  tiles: [...[0, 1, 2].flatMap(r => [0, 1, 2].map(c => R(5 + c * 8, 5 + r * 8, 7, 7, (r + c) % 2 ? "glass" : "steel")))],
  vents: [R(5, 16, 22, 12, "iron"), ...[0, 1, 2].map(i => R(8 + i * 6, 18, 3, 8, "dark")), E(11, 10, 3, 4, "bone"), E(19, 7, 4, 5, "bone")],
  ballista: [L(4, 14, 28, 14, 2, "iron"), L(6, 8, 6, 20, 2, "wood"), P([[16, 14], [5, 6], [5, 22]], "wood"), C(16, 22, 4, "brass"), C(16, 22, 1.6, "iron"), L(16, 26, 12, 30, 2, "iron"), L(16, 26, 20, 30, 2, "iron")],
  battery: [R(5, 14, 22, 12, "brass"), ...[0, 1, 2, 3].map(i => C(9 + i * 5, 11, 2.2, "iron")), ...[0, 1, 2, 3].map(i => C(9 + i * 5, 11, 1, X))],
  sail: [L(16, 3, 16, 29, 1.6, "wood"), P([[17, 4], [29, 20], [17, 22]], "canvas"), P([[15, 6], [4, 22], [15, 22]], "glass"), L(15, 14, 7, 20, 0.8, "brass")],
  plates: [P([[6, 6], [26, 6], [28, 24], [16, 29], [4, 24]], "iron"), ...[0, 1].map(i => L(6, 13 + i * 6, 26, 13 + i * 6, 0.8, "dark")), ...[0, 1, 2].map(i => C(8 + i * 8, 9, 0.9, "brass"))],
  gyro: [O(16, 16, 11, 1.4, "brass"), E(16, 16, 5, 11, "copper"), O(16, 16, 6, 1, "steel"), C(16, 16, 2.4, "glass")],
  winch: [E(16, 16, 9, 11, "wood"), O(16, 16, 8, 1.4, "iron"), L(4, 16, 28, 16, 2, "iron"), L(25, 20, 29, 29, 1, "canvas"), C(16, 16, 2, "brass")],
};
// cells and materials have simple icons too
KINDS.cellGem = [R(10, 6, 12, 21, "brass"), R(12, 9, 8, 15, X), R(13, 3, 6, 3, "copper")];
KINDS.brass = [P([[5, 22], [11, 10], [21, 8], [27, 18], [19, 26]], "brass"), C(14, 17, 3, "dark"), L(17, 10, 23, 18, 1, "copper")];
KINDS.glass = [P([[6, 22], [12, 8], [20, 12], [26, 24], [16, 28]], "glass"), P([[12, 8], [16, 18], [6, 22]], "glass")];
KINDS.heartstone = [P([[16, 3], [26, 14], [20, 28], [10, 28], [6, 14]], X), P([[16, 3], [19, 14], [16, 28]], X)];

function raster(kind, aspectColor) {
  const N = 32, mat = new Array(N * N).fill(null), tone = new Float32Array(N * N);
  const crystal = crystalRamp(aspectColor || "#ffad4a");
  for (const s of KINDS[kind] || KINDS.coin) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5; let inside = false, t = 0.5;
      if (s.t === "L") {
        const vx = s.x2 - s.x1, vy = s.y2 - s.y1, l2 = vx * vx + vy * vy || 1, u = Math.max(0, Math.min(1, ((px - s.x1) * vx + (py - s.y1) * vy) / l2));
        const dx = px - (s.x1 + vx * u), dy = py - (s.y1 + vy * u), d = Math.hypot(dx, dy);
        if (d <= s.w / 2 + 0.15) { inside = true; const l = Math.sqrt(l2), side = (dx * -vy + dy * vx) / l; t = 0.5 - (side / (s.w / 2 + 0.01)) * 0.45 * Math.sign(vx || 1) * (vy < 0 ? 1 : -1); }
      } else if (s.t === "R") {
        if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) { inside = true; const fx = (px - s.x) / s.w, fy = (py - s.y) / s.h; t = 0.85 - 0.4 * fx - 0.5 * fy; if (fx < 0.12 || fy < 0.12) t += 0.25; if (fx > 0.88 || fy > 0.88) t -= 0.25; }
      } else if (s.t === "C" || s.t === "E") {
        const rx = s.t === "C" ? s.r : s.rx, ry = s.t === "C" ? s.r : s.ry, nx = (px - s.cx) / rx, ny = (py - s.cy) / ry, d = nx * nx + ny * ny;
        if (d <= 1.02) { inside = true; t = 0.55 - (nx + ny) * 0.35 - (d > 0.7 ? 0.15 : 0); if (nx < -0.2 && ny < -0.2 && d < 0.45 && d > 0.15) t += 0.35; }
      } else if (s.t === "O") {
        const d = Math.hypot(px - s.cx, py - s.cy);
        if (Math.abs(d - s.r) <= s.w / 2 + 0.1) { inside = true; t = 0.55 - ((px - s.cx) + (py - s.cy)) / (s.r * 2.4); }
      } else if (s.t === "P") {
        let c = false; const p = s.pts;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > py) !== (p[j][1] > py) && px < (p[j][0] - p[i][0]) * (py - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; }
        if (c) { inside = true; let minx = 99, maxx = -99, miny = 99, maxy = -99; for (const q of p) { minx = Math.min(minx, q[0]); maxx = Math.max(maxx, q[0]); miny = Math.min(miny, q[1]); maxy = Math.max(maxy, q[1]); } t = 0.8 - 0.35 * (px - minx) / (maxx - minx + 0.01) - 0.4 * (py - miny) / (maxy - miny + 0.01); }
      }
      if (inside) { mat[y * N + x] = s.m; tone[y * N + x] = t; }
    }
  }
  const out = new Array(N * N).fill(null);
  const dither = (x, y) => ((x * 3 + y * 5) % 4) / 4 - 0.4;
  for (let i = 0; i < N * N; i++) {
    const m = mat[i]; if (!m) continue;
    const ramp = m === X ? crystal : MATS[m], x = i % N, y = i / N | 0;
    let t = tone[i] + dither(x, y) * 0.18;
    // edge darkening where this material borders another
    const up = mat[i - N], left = x > 0 ? mat[i - 1] : null;
    if (up && up !== m) t -= 0.12;
    const k = t > 0.92 ? 3 : t > 0.55 ? 2 : t > 0.22 ? 1 : 0;
    out[i] = ramp[k === 0 && left === m ? 1 : k];
  }
  // coloured outline: darkest tone of the neighbouring material, plum-leaning
  for (let i = 0; i < N * N; i++) {
    if (mat[i]) continue;
    const x = i % N, y = i / N | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const m = mat[yy * N + xx];
      if (m) { const r = m === X ? crystal : MATS[m]; out[i] = rgbHex(mix(hexToRgb(r[0]), [22, 10, 26], 0.55)); break; }
    }
  }
  return out;
}

const cache = new Map();
// Returns a canvas: rarity backdrop (radial glow), the icon, and a glow for crystal parts.
function iconCanvas(kind, { aspect = null, rarity = "salvage", size = 96, bg = true } = {}, RARITY, ASPECTS) {
  const key = [kind, aspect, rarity, size, bg].join("|");
  if (cache.has(key)) return cache.get(key).cloneNode ? cloneCanvas(cache.get(key)) : cache.get(key);
  const px = raster(kind, aspect ? ASPECTS[aspect].color : null);
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d");
  const s = size / 32;
  if (bg) {
    const col = RARITY[rarity]?.color || "#8b8b8b";
    const grd = g.createRadialGradient(size / 2, size * 0.48, size * 0.05, size / 2, size / 2, size * 0.62);
    grd.addColorStop(0, col + (RARITY[rarity]?.rank >= 3 ? "66" : "40")); grd.addColorStop(0.6, col + "14"); grd.addColorStop(1, "#00000000");
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
  }
  for (let i = 0; i < px.length; i++) if (px[i]) { g.fillStyle = px[i]; g.fillRect((i % 32) * s, (i / 32 | 0) * s, Math.ceil(s), Math.ceil(s)); }
  cache.set(key, c);
  return cloneCanvas(c);
}
function cloneCanvas(src) { const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d").drawImage(src, 0, 0); return c; }

return { KINDS, iconCanvas };
})();
