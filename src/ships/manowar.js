// The Man-o'-war, the Thunderhead: a flying fortress. Long, deep and armour-plated in dark iron, with castles at both
// ends, five crystal clusters, three masts, two decks of twelve gun ports a side and four guns in its bow. Measured off
// Chris's pictures of it (art/ships/man-o-war-hull.png and the rest).
// Side view: z = (x - 822.5) / 15.17, y = (302 - y_px) / 15.17 (the main deck's edge at y = 0).
// Top view: half-width = (744.25 - y_px) / 15.17.
export default {
  id: 'manowar', name: 'Thunderhead', cls: 'Man-o\'-war', length: 90,
  tileScale: 1.3, skin: 'plates',
  hull: {
    stern: -45, bow: 34.6, fullness: 0.85, wale: -5.0, tumblehome: 0.05,
    half: [[-45, 6.6], [-44, 7.1], [-42, 7.35], [-30, 7.4], [0, 7.4], [28.8, 7.35], [31.0, 6.7], [33.0, 5.6], [34.0, 4.6], [34.6, 3.4]],
    rim: [[-45, 6.4], [-32.3, 6.4], [-32.1, 0], [22.0, 0], [22.2, 6.1], [34.6, 6.1]],
    keel: [[-45, -0.3], [-44.3, -4.7], [-43.0, -6.2], [-41.0, -8.2], [-39.1, -10.1], [-34.4, -11.9], [-29.8, -13.4], [-21.3, -13.5],
      [-11.4, -13.8], [-1.5, -13.9], [8.4, -13.7], [18.3, -13.5], [27.5, -11.3], [28.8, -10.6], [30.2, -9.6], [31.5, -8.9],
      [32.8, -8.3], [34.1, -7.3], [34.6, -5.5]],
  },
  // castles at both ends, each a storey above the main deck, reached by stairs at either side
  quarterdeck: { front: -32.2, height: 6.4, stairs: { bottom: -27.3, width: 2.8, sides: true } },
  forecastle: { back: 22.1, height: 6.1, stairs: { bottom: 17.2, width: 2.8, sides: true } },
  bands: { sheer: [0, -1.1], lower: [[-4.55, -5.25], [-8.6, -9.4]], quarter: true,
    straps: [[-41.5, 1.1], [-32.6, 1.1], [-5.4, 1.1], [21.6, 1.1], [31.5, 1.0]] },
  ram: { from: 34.4, to: 45, y: -0.2, r: 1.1, collar: 1.6 },
  ports: { y: [-2.9, -6.9], z: [-28.8, -24.5, -20.3, -16.0, -11.7, -7.5, -3.2, 1.05, 5.3, 9.6, 13.8, 18.1], w: 2.0, h: 2.0 },
  // four bow guns straight out of the bow's face, two above the ram and two below
  bowGuns: [
    { x: 2.0, y: 2.4, z: 34.7, len: 7, face: true }, { x: -2.0, y: 2.4, z: 34.7, len: 7, face: true },
    { x: 2.0, y: -2.9, z: 34.5, len: 7, face: true }, { x: -2.0, y: -2.9, z: 34.5, len: 7, face: true },
  ],
  sternGuns: [{ x: 2.5, y: 0.9, z: -45, len: 5.5, port: true }, { x: -2.5, y: 0.9, z: -45, len: 5.5, port: true }],
  clusters: [{ z: -26.0, scale: 2.1 }, { z: -15.4, scale: 2.15 }, { z: -4.8, scale: 2.2 }, { z: 5.8, scale: 2.15 }, { z: 16.3, scale: 2.1 }],
  cluster: { r: 0.87, h: 1.3, crystals: 5, center: 2.35, around: 1.25, spread: 1.05 },
  masts: [
    { z: 27.0, height: 22, tiers: [{ at: 0.42, span: 10.0, rise: 1.0, sweep: 1.4 }, { at: 0.76, span: 9.2, rise: 0.9, sweep: 1.5 }] },
    { z: 0.5, height: 26, tiers: [{ at: 0.42, span: 10.6, rise: 1.0, sweep: 1.4 }, { at: 0.76, span: 9.8, rise: 0.9, sweep: 1.5 }] },
    { z: -20.7, height: 25, tiers: [{ at: 0.42, span: 10.4, rise: 1.0, sweep: 1.4 }, { at: 0.76, span: 9.6, rise: 0.9, sweep: 1.5 }] },
  ],
  fins: [{ z0: -38.5, z1: -28.5, span: 4.8, sweep: -2.2, tilt: 0.5 }, { z0: 19.6, z1: 29.4, span: 4.8, sweep: 2.0, tilt: 0.5 }],
  rudder: { z: -45.2, top: -0.4, bottom: -10.9, width: 4.0 },
  wheel: { z: -41.5, r: 1.1 },
  hatches: [{ z: -10.1, len: 2.6, wid: 2.4 }, { z: 11.05, len: 2.6, wid: 2.4 }],
  windows: {
    side: [{ z0: -43.6, z1: -37.0, y0: 2.6, y1: 5.1, reps: 2 }, { z0: 27.4, z1: 32.2, y0: 2.6, y1: 4.7 }],
    transom: [{ w: 9.5, y0: 3.0, y1: 5.2, reps: 2 }],
  },
  lanterns: [
    { at: [6.9, 6.4, -44.6], post: 1.2 }, { at: [-6.9, 6.4, -44.6], post: 1.2 },
    { at: [7.0, 6.4, -32.6], post: 1.2 }, { at: [-7.0, 6.4, -32.6], post: 1.2 },
    { at: [7.0, 6.1, 22.6], post: 1.2 }, { at: [-7.0, 6.1, 22.6], post: 1.2 },
    { at: [3.0, 6.1, 34.2], post: 1.2 }, { at: [-3.0, 6.1, 34.2], post: 1.2 },
    { at: [1.3, -4.6, 34.9], hang: 0.8 }, { at: [-1.3, -4.6, 34.9], hang: 0.8 },
  ],
  cargo: { barrels: [[6.0, -21.5], [-6.0, -10.0], [6.0, 11.0]], coils: [[-2.8, -20.7], [2.8, 0.5]],
    crates: [[-6.0, -1.0], [6.0, -14.0], [-6.0, 14.0]] },
  rail: { h: 0.95, step: 0.45, quarterH: 0.9 },
};
