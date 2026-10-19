// The Cutter, the Gale: the fast raider. Long, low and narrow, with a raked prow, a long bowsprit and swept-back
// sails. Shaped from the fleet lineup (art/ships/lineup.png) and its stats, dressed in the Brig's paint.
export default {
  id: 'cutter', name: 'Gale', cls: 'Cutter', length: 15,
  tileScale: 0.8,
  hull: {
    stern: -7.5, bow: 5.6, fullness: 1.05, wale: 0, tumblehome: 0.03,
    half: [[-7.5, 0.95], [-6.8, 1.45], [-5.5, 1.78], [-3.0, 1.9], [0, 1.9], [2.0, 1.78], [3.6, 1.42], [4.6, 0.95], [5.3, 0.45], [5.6, 0.14]],
    rim: [[-7.5, 0.3], [-6, 0.12], [-3, 0], [1, 0], [3.5, 0.12], [5.0, 0.38], [5.6, 0.55]],
    keel: [[-7.5, -0.7], [-6.8, -1.35], [-5.5, -1.75], [-2, -1.95], [1.5, -1.9], [3.5, -1.6], [4.6, -1.1], [5.3, -0.45], [5.6, 0.1]],
  },
  bands: { sheer: [-0.16, -0.44], straps: [[-5.8, 0.3], [3.9, 0.32], [5.45, 0.2]] },
  ram: { from: 5.4, to: 6.7, y: 0.2, r: 0.32, collar: 0.42 },
  bowsprit: { from: [0, 0.55, 4.7], to: [0, 1.55, 8.6], r: 0.11 },
  ports: { y: -0.78, z: [-2.6, -0.65, 1.3], w: 0.78, h: 0.84 },
  bowGuns: [{ x: 0, y: 0.5, z: 4.55, len: 1.85 }],
  sternGuns: [{ x: 0, y: 0.32, z: -7.1, len: 1.5, deck: true }],
  clusters: [{ z: -0.7, scale: 1 }],
  cluster: { r: 0.55, h: 0.75, crystals: 3, center: 1.7, around: 1.0, spread: 0.62 },
  masts: [
    { z: 2.5, height: 6.2, tiers: [{ at: 0.5, span: 3.9, rise: 0.75, sweep: 1.9 }] },
    { z: -3.65, height: 5.7, tiers: [{ at: 0.48, span: 3.7, rise: 0.7, sweep: 1.8 }] },
  ],
  fins: [{ z0: -4.6, z1: -3.3, span: 1.15, sweep: -0.45, tilt: 0.45 }, { z0: 1.7, z1: 2.9, span: 1.1, sweep: 0.4, tilt: 0.45 }],
  rudder: { z: -7.48, top: -0.15, bottom: -1.95, width: 0.75 },
  wheel: { z: -6.35, r: 0.45 },
  hatches: [{ z: -2.2, len: 1.0, wid: 0.9 }],
  capstan: { z: 1.0 },
  windows: null,
  lanterns: [
    { at: [1.25, 0.3, -7.05], post: 0.48 }, { at: [-1.25, 0.3, -7.05], post: 0.48 },
    { at: [0.95, 0.38, 4.85], post: 0.48 }, { at: [-0.95, 0.38, 4.85], post: 0.48 },
    { at: [0, -0.25, 5.9], hang: 0.38 },
  ],
  cargo: { barrels: [[1.3, -4.7], [-1.3, 1.6]], coils: [[0.6, 2.95], [-0.55, -4.25], [-1.2, -6.2]], crates: [[1.3, -1.9]] },
  rail: { h: 0.55, step: 0.28 },
};
