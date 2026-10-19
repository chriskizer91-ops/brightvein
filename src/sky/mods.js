// mods.js: changing a ship in port. Each ship has four upgrades, each bought in three steps with Crystal Shards, and
// one free setting, its crystal power: how much of the crystals' power goes to the sails and how much to the guns.
// loadout() turns a ship's stats and its upgrades into what the game flies and fires.
import { STATS } from '../ships/index.js';

export const MODS = [
  { id: 'armour', name: 'Armour plates', step: 'Each step: +20% hull, but 4% less top speed and 10% slower to speed up' },
  { id: 'canvas', name: 'Fine canvas', step: 'Each step: +20% sails and 4% more top speed' },
  { id: 'drill', name: 'Gun drill', step: 'Each step: guns reload 10% faster' },
  { id: 'crystals', name: 'Cut crystals', step: 'Each step: +20% crystals and climbs 12% faster' },
];
export const STEPS = 3;
// a step costs more on a bigger ship
const STEP_COST = [60, 140, 280], CLASS = { skiff: 1, cutter: 1.6, brig: 2.6, frigate: 4 };
export const modCost = (ship, step) => Math.round((STEP_COST[step] * CLASS[ship]) / 5) * 5;

// crystal power, from -2 (all to the sails) to 2 (all to the guns); each notch towards the guns: 8% faster reload and
// 6% heavier shots, but 6% less top speed and speeding up
export const POWER = ['All to sails', 'More to sails', 'Even', 'More to guns', 'All to guns'];

export function loadout(id, cfg) {
  const st = STATS[id], m = cfg.mods, p = cfg.power;
  return {
    stats: {
      ...st,
      hull: Math.round(st.hull * (1 + 0.2 * m.armour)),
      sails: Math.round(st.sails * (1 + 0.2 * m.canvas)),
      crystals: Math.round(st.crystals * (1 + 0.2 * m.crystals)),
    },
    tune: {
      speed: (1 - 0.04 * m.armour) * (1 + 0.04 * m.canvas) * (1 - 0.06 * p),
      accel: (1 - 0.1 * m.armour) * (1 - 0.06 * p),
      climb: 1 + 0.12 * m.crystals,
      turn: 1,
    },
    guns: { reload: (1 - 0.1 * m.drill) * (1 - 0.08 * p), damage: 1 + 0.06 * p },
  };
}
