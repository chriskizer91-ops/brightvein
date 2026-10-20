// mods.js: changing a ship in port. Each ship has four upgrades, each bought in three steps with Crystal Shards, and
// one free setting, its crystal power: how much of the crystals' power goes to the sails and how much to the guns.
// loadout() turns a ship's stats and its upgrades into what the game flies and fires (with the big two's helm).
import { STATS } from '../ships/index.js';

// each in plain words (line), and exactly, a step at a time (step, in smaller print in port)
export const MODS = [
  { id: 'armour', name: 'Armour plates', line: 'A tougher hull, but a little slower.', step: 'Each step: hull +20%, top speed −4%, speeding up −10%' },
  { id: 'canvas', name: 'Fine canvas', line: 'Stronger sails, and a little faster.', step: 'Each step: sails +20%, top speed +4%' },
  { id: 'drill', name: 'Gun drill', line: 'Your gunners reload faster.', step: 'Each step: reloading 10% quicker' },
  { id: 'crystals', name: 'Cut crystals', line: 'Stronger crystals, and she climbs faster.', step: 'Each step: crystals +20%, climbing +12%' },
];
export const STEPS = 3;
// a step costs more on a bigger ship (the big two's are late-game goals too)
const STEP_COST = [60, 140, 280], CLASS = { skiff: 1, cutter: 1.6, brig: 2.6, frigate: 4, galleon: 7, manowar: 10 };
export const modCost = (ship, step) => Math.round((STEP_COST[step] * CLASS[ship]) / 5) * 5;

// crystal power, from -2 (all to the sails) to 2 (all to the guns); each notch towards the guns: 8% faster reload and
// 6% heavier shots, but 6% less top speed and speeding up
export const POWER = ['All to sails', 'More to sails', 'Even', 'More to guns', 'All to guns'];

// the big two are better found under the Captain than under a raider crew, so buying one feels mighty at once (tuned
// with many runs of tools/sim-fight.mjs: a new Galleon well ahead of a Frigate with every upgrade, the Man-o'-war ahead
// again): they answer the helm better (the best crew in the sky, and a 54-second circle would be no fun to fly), times
// as quick to turn and to climb; her shipwrights plate their hulls heavier and her crystal-cutters set their crystals
// deeper (`tough`, times as tough: a big ship is a big target, her crystals heaped high on her deck, and every raider's
// shots find her); and her gunners, the best in the sky, reload the heavy guns quicker than any crew (`reload`, times as
// long; a raider crew takes longer than most: guns.js HEAVY). Raiders sail them as built
export const HELM = { galleon: { turn: 1.4, climb: 1.15, tough: 2.2, reload: 0.8 }, manowar: { turn: 1.4, climb: 1.4, tough: 2.1, reload: 0.75 } };

export function loadout(id, cfg) {
  const st = STATS[id], m = cfg.mods, p = cfg.power, helm = HELM[id];
  return {
    stats: {
      ...st,
      hull: Math.round(st.hull * (1 + 0.2 * m.armour) * (helm?.tough ?? 1)),
      sails: Math.round(st.sails * (1 + 0.2 * m.canvas)),
      crystals: Math.round(st.crystals * (1 + 0.2 * m.crystals) * (helm?.tough ?? 1)),
    },
    tune: {
      speed: (1 - 0.04 * m.armour) * (1 + 0.04 * m.canvas) * (1 - 0.06 * p),
      accel: (1 - 0.1 * m.armour) * (1 - 0.06 * p),
      climb: (1 + 0.12 * m.crystals) * (helm?.climb ?? 1),
      turn: helm?.turn ?? 1,
    },
    guns: { reload: (1 - 0.1 * m.drill) * (1 - 0.08 * p) * (helm?.reload ?? 1), damage: 1 + 0.06 * p },
  };
}
