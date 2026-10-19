// The six ships, smallest first, with their stats from docs/ships.md. The Captain sails the first four (SHIPS); the
// Galleon and the Man-o'-war are only ever raiders: a rich prize and a fortress.
import skiff from './skiff.js';
import cutter from './cutter.js';
import brig from './brig.js';
import frigate from './frigate.js';
import galleon from './galleon.js';
import manowar from './manowar.js';

export const SHIPS = [skiff, cutter, brig, frigate];
export const FLEET = [...SHIPS, galleon, manowar];

export const STATS = {
  skiff: { hull: 300, sails: 150, crystals: 150, speed: 8, turning: 10, climbing: 10, bow: 1, stern: 0, side: 1, crew: 4,
    blurb: 'The Captain\'s first ship. Out-turns and out-climbs everything, and quick enough to run from a fight it can\'t win.' },
  cutter: { hull: 600, sails: 300, crystals: 250, speed: 10, turning: 8, climbing: 7, bow: 1, stern: 1, side: 3, crew: 12,
    blurb: 'The fastest ship in the sky. A raider: long, low and thin-skinned.' },
  brig: { hull: 1200, sails: 600, crystals: 500, speed: 7, turning: 6, climbing: 6, bow: 2, stern: 1, side: 6, crew: 30,
    blurb: 'The all-rounder, built from Chris\'s own pictures of it.' },
  frigate: { hull: 2200, sails: 1000, crystals: 900, speed: 8, turning: 5, climbing: 5, bow: 2, stern: 2, side: 10, crew: 60,
    blurb: 'The hunter. A lot of sail for its size, which is why it\'s fast.' },
  galleon: { hull: 4000, sails: 1500, crystals: 1600, speed: 4, turning: 3, climbing: 3, bow: 1, stern: 2, side: 16, crew: 120,
    blurb: 'A treasure ship: tall and wide, with a high stern castle full of windows and two decks of guns. Slow, and a rich prize.' },
  manowar: { hull: 7000, sails: 2400, crystals: 2600, speed: 3, turning: 2, climbing: 1, bow: 4, stern: 2, side: 24, crew: 250,
    blurb: 'A flying fortress: huge and armour-plated, with two decks of twelve guns a side. It barely climbs.' },
};
