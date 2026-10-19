// The Skiff, the Zephyr: the Captain's first ship, about the Magpie's size. Shaped from the fleet lineup
// (art/ships/lineup.png) and its stats in docs/ships.md, dressed in the Brig's painted planks and brass.
export default {
  id: 'skiff', name: 'Zephyr', cls: 'Skiff', length: 8,
  tileScale: 0.6,
  hull: {
    stern: -4.0, bow: 3.35, fullness: 0.7, wale: 0, tumblehome: 0.03,
    half: [[-4.0, 0.55], [-3.6, 0.95], [-2.8, 1.22], [-1.5, 1.32], [0.2, 1.33], [1.5, 1.22], [2.4, 0.98], [3.0, 0.62], [3.35, 0.22]],
    rim: [[-4.0, 0.42], [-3.2, 0.2], [-2.0, 0.06], [0, 0], [1.5, 0.06], [2.6, 0.22], [3.35, 0.46]],
    keel: [[-4.0, -0.55], [-3.3, -0.95], [-2.2, -1.2], [0, -1.3], [1.8, -1.22], [2.7, -0.95], [3.2, -0.5], [3.35, -0.12]],
  },
  bands: { sheer: [-0.1, -0.3], straps: [[-2.6, 0.22], [2.2, 0.24], [3.2, 0.16]] },
  ram: { from: 3.2, to: 4.0, y: 0.12, r: 0.2, collar: 0.3 },
  ports: null,
  bowGuns: [{ x: 0, y: 0.48, z: 2.75, len: 1.15, swivel: true }],
  swivels: [{ x: 1.3, y: 0.06, z: -1.15, len: 0.8 }, { x: -1.3, y: 0.06, z: -1.15, len: 0.8 }],
  sternGuns: [],
  clusters: [{ z: -0.15, scale: 1 }],
  cluster: { r: 0.4, h: 0.55, crystals: 3, center: 1.25, around: 0.7, spread: 0.46 },
  masts: [{ z: 1.45, height: 3.7, tiers: [{ at: 0.5, span: 2.7, rise: 0.4, sweep: 0.35 }] }],
  fins: [{ z0: -1.2, z1: -0.1, span: 0.85, sweep: -0.25, tilt: 0.55 }],
  rudder: { z: -3.98, top: 0.0, bottom: -1.15, width: 0.5 },
  wheel: { z: -3.25, r: 0.3 },
  hatches: [],
  windows: null,
  lanterns: [
    { at: [0, 0.42, -3.92], post: 0.42 }, { at: [1.18, 0.02, 0.75], post: 0.4 }, { at: [-1.18, 0.02, 0.75], post: 0.4 },
    { at: [0, -0.32, 3.55], hang: 0.28 },
  ],
  cargo: { barrels: [[0.75, -2.5]], coils: [[-0.5, 1.95], [0.55, -3.0]], crates: [[-0.75, -2.45]] },
  rail: { h: 0.45, step: 0.22 },
};
