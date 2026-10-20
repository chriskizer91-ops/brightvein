// livery.js: the colours a ship flies in, the same in the game and in the ships demo. Any ship can wear any of them:
//   yours     the Captain's: cream sails, plum pennants with a gold hoist (her ship as built)
//   crew      a raider crew's: rust-red sails, darker planks, crimson pennants with a black hoist
//   captain   a raider captain's, made to look like the leader from across the sky: black sails edged in crimson,
//             blackened iron fittings (her brass bands stay gold, as trim), crystals and sparks that burn crimson, red
//             lanterns and furnace windows, two red eyes glowing at her bow, gold pennants, and a great black-and-crimson
//             swallow-tailed banner streaming from her tallest mast
//   treasure  a treasure ship's (a rich merchant laden with shards, the prize of a chase): wine-red sails edged in gold,
//             gilded brass that glints and twinkles all over her, gold pennants with a wine-red hoist, and open chests
//             heaped with gold on her deck
// Each is a set of copies of the materials (made once, and shared by every ship wearing it: the ship's own copies that
// show her scars are made from these, src/ship/dress.js), the build options for the parts only some carry (build.js:
// the banner and eyes, the chests and glints), and a few touches to a ship once she's built (her pennants', glows' and
// sparks' colours). Colours aren't part of a shader, so a ship in any livery adds no new shaders.
// A Man-o'-war in any raider's colours shows her five crystal columns as the weak points they are: they glow brighter
// than any other ship's and beat slowly like a heart (her glows' uBeat; the game makes them glow gold at their edges
// when the Captain's guns lock on, and blow out one by one: src/game/looks.js).
// (and Brightvein's: `silver`, the Gilded Exchange's crews (act two): steel, cool blue sunstone, grey planks and silver
// sails; `candle`, Baron Tallow's flagship, the Black Candle: tarred black planks and wax-white canvas; `friend`, the
// claim's own ships sailing with the Captain, a convoy's barges: the Captain's colours)
import { silverArt, silverGlows } from './materials.js';
export const LIVERIES = ['yours', 'crew', 'captain', 'treasure', 'silver', 'candle', 'friend'];
// the colours of what a shot knocks off a ship in each (fx.js): her planks, and her sails
export const DEBRIS = { yours: { wood: 0x6e5440, sail: 0xecdcb8 }, crew: { wood: 0x6e5440, sail: 0xc8735c }, captain: { wood: 0x5a4838, sail: 0x3a3034 }, treasure: { wood: 0x6e5440, sail: 0x8e2a3c },
  silver: { wood: 0x8a8c90, sail: 0xd6dbe4 }, candle: { wood: 0x3a302c, sail: 0xf2ead2 }, friend: { wood: 0x6e5440, sail: 0xecdcb8 } };
// her wake (src/game/wakes.js), by livery
export const WAKE_KIND = { yours: 'player', crew: 'raider', captain: 'captain', treasure: 'treasure', silver: 'raider', candle: 'captain', friend: 'player' };
// the stripe along her sails' free edges: its colour (as light, not as painted) and how deep (a share of the sail)
const STRIPE = { captain: [0.5, 0.008, 0.025, 0.12], treasure: [0.85, 0.48, 0.07, 0.1] };
// pennants: [body, hoist] in each
const PENNANT = { crew: [[0.72, 0.09, 0.07], [0.09, 0.07, 0.06]], captain: [[0.95, 0.72, 0.28], [0.09, 0.07, 0.06]], treasure: [[0.95, 0.72, 0.28], [0.45, 0.06, 0.13]],
  silver: [[0.82, 0.85, 0.9], [0.85, 0.66, 0.22]], candle: [[0.95, 0.9, 0.75], [0.1, 0.07, 0.05]] };

// the materials for a livery, made from the Captain's (art: materials.js)
export function liveryArt(art, name) {
  if (name === 'yours' || name === 'friend') return art;
  if (name === 'silver') art = silverArt(art); // (her steel, grey planks and blue crystal: materials.js)
  const M = { ...art.M }, own = (k) => (M[k] = art.M[k].clone());
  own('hull'); own('canvas');
  if (name === 'crew') {
    M.hull.color.set(0x9a8781); M.canvas.color.set(0xc8735c); M.canvas.emissive.set(0x7a3020);
  } else if (name === 'captain') {
    M.hull.color.set(0x7d6f72); M.canvas.color.set(0x3a3034); M.canvas.emissive.set(0x1c1216);
    own('brass'); M.brass.color.set(0x2c2a2e); M.brass.metalness = 0.9; M.brass.roughness = 0.32;
    own('bronze'); M.bronze.color.set(0x3b2d27);
    own('rigMetal'); Object.assign(M.rigMetal.userData, { brass: 0x2c2a2e, bronze: 0x3b2d27 }); M.rigMetal.metalness = 0.9; M.rigMetal.roughness = 0.32;
    own('gem'); M.gem.color.set(0xff5068); M.gem.emissive.set(0xff3a5a);
    own('crystal'); M.crystal.color.set(0xff5a6a); M.crystal.emissive.set(0xff2448);
    own('parts'); M.parts.emissive.set(0xff6a5a);
  } else if (name === 'silver') {
    M.canvas.color.set(0xd6dbe4); M.canvas.emissive.set(0x4a5266);
  } else if (name === 'candle') {
    M.hull.color.set(0x5a4c48); M.canvas.color.set(0xf2ead2); M.canvas.emissive.set(0x6a4a20);
    own('brass'); M.brass.color.set(0x2c2a2e); M.brass.metalness = 0.9; M.brass.roughness = 0.32;
    own('rigMetal'); Object.assign(M.rigMetal.userData, { brass: 0x2c2a2e, bronze: 0x3b2d27 }); M.rigMetal.metalness = 0.9; M.rigMetal.roughness = 0.32;
  } else if (name === 'treasure') {
    M.hull.color.set(0xa88a78); M.canvas.color.set(0x8e2a3c); M.canvas.emissive.set(0x40101c);
    own('brass'); M.brass.color.set(0xffcf4a); M.brass.metalness = 1; M.brass.roughness = 0.2;
    own('bronze'); M.bronze.color.set(0xc8953a); M.bronze.metalness = 0.95; M.bronze.roughness = 0.25;
    own('rigMetal'); Object.assign(M.rigMetal.userData, { brass: 0xffcf4a, bronze: 0xc8953a }); M.rigMetal.metalness = 0.97; M.rigMetal.roughness = 0.22;
    own('band'); M.band.emissiveIntensity = 0.12;
  }
  if (STRIPE[name]) M.canvas.userData.stripe = STRIPE[name];
  M.canvas.onBeforeCompile = art.M.canvas.onBeforeCompile; M.canvas.customProgramCacheKey = art.M.canvas.customProgramCacheKey;
  return { ...art, M };
}
// what a ship in this livery is built with (build.js)
export const liveryOpts = (name) => ({ captain: name === 'captain' || name === 'candle', treasure: name === 'treasure' });

// A built ship's own touches: her pennants' colours (her banner keeps its own), and a raider captain's crimson glows
// and sparks; a raider Man-o'-war's beating crystals. Made once per built ship (the raiders' copies share them)
export function wearLivery(ship, name) {
  if (name === 'yours' || name === 'friend') return ship;
  if (name === 'silver') silverGlows(ship);
  const P = PENNANT[name];
  ship.body.traverse((o) => {
    if (o.isMesh && o.name === 'flag') {
      const col = o.geometry.attributes.color;
      for (let i = 0; i < col.count; i++) {
        const r = col.getX(i), b = col.getZ(i);
        if (r > 0.8) col.setXYZ(i, ...P[1]); // (the gold hoist)
        else if (b > 0.2) col.setXYZ(i, ...P[0]); // (the plum)
      }
      col.needsUpdate = true;
    }
  });
  const glow = ship.glow.geometry, col = glow.attributes.color, kind = glow.attributes.kind, group = glow.attributes.group, size = glow.attributes.size;
  if (name === 'captain') {
    for (let i = 0; i < col.count; i++) {
      // her crystals' glows (and their furnaces') crimson; her lanterns red (not her eyes, already red)
      if (group.getX(i) > 0.5) col.setXYZ(i, 1, 0.18, 0.28);
      else if (kind.getX(i) > 1.5 && kind.getX(i) < 2.5 && col.getY(i) > 0.4 && col.getZ(i) < 0.18) col.setXYZ(i, 1, 0.12, 0.05);
    }
    col.needsUpdate = true;
    if (ship.sparks) { ship.sparks.material.uniforms.uCool.value.setRGB(1, 0.08, 0.16); ship.sparks.material.uniforms.uHot.value.setRGB(1, 0.55, 0.62); }
  }
  if (ship.recipe.id === 'manowar') {
    for (let i = 0; i < size.count; i++) if (group.getX(i) > 0.5) size.setX(i, size.getX(i) * 1.25);
    size.needsUpdate = true;
    ship.glow.material.uniforms.uBeat.value = 1;
  }
  return ship;
}
