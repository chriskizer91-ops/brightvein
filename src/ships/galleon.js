// The Galleon, the Doldrums: a raider's treasure ship, tall and wide, with a high stern castle full of windows, a
// forecastle at the bow, four crystal clusters, two masts and two decks of eight gun ports a side. Measured off
// Chris's pictures of it (art/ships/galleon-hull.png and the rest).
// Side view: z = (x - 798.5) / 23.38, y = (285 - y_px) / 23.38 (the main deck's edge at y = 0).
// Top view: half-width = (738.5 - y_px) / 23.38, its upper edge (the lower one shows the hull's side in perspective).
export default {
  id: 'galleon', name: 'Doldrums', cls: 'Galleon', length: 60,
  tileScale: 1.15,
  hull: {
    stern: -30, bow: 22.1, fullness: 0.8, wale: -3.0, tumblehome: 0.08,
    half: [[-30, 5.7], [-25.6, 5.9], [-21.3, 6.2], [-19.2, 6.65], [-17, 6.9], [0, 6.9], [12.9, 6.82], [13.3, 6.6], [15, 6.18],
      [17.2, 5.1], [19.3, 3.8], [20.6, 3.1], [21.5, 2.4], [22.1, 1.6]],
    rim: [[-30, 5.69], [-21.45, 5.69], [-21.25, 0], [12.4, 0], [12.6, 3.42], [20, 3.5], [22.1, 3.8]],
    keel: [[-30, -0.64], [-27.0, -2.0], [-26.4, -4.0], [-25.4, -6.2], [-23.5, -7.8], [-19, -8.5], [-14.5, -9.0], [-8.5, -9.4],
      [-4, -9.5], [4, -9.5], [8, -9.4], [13.3, -8.6], [17.2, -8.0], [19.0, -6.9], [20.6, -5.5], [21.5, -4.0], [22.1, -2.2]],
  },
  // the stern castle, two storeys high, reached by stairs at either side; the forecastle, a storey and a half
  quarterdeck: { front: -21.35, height: 5.69, stairs: { bottom: -16.8, width: 2.6, sides: true } },
  forecastle: { back: 12.5, height: 3.42 },
  bands: { sheer: [-0.05, -0.62], lower: [[-3.25, -3.8], [-6.6, -7.15]], quarter: true,
    straps: [[-26.0, 0.75], [-19.6, 0.75], [10.9, 0.75], [16.3, 0.75], [21.5, 0.6]] },
  ram: { from: 21.9, to: 30, y: -0.5, r: 1.15, collar: 1.55 },
  ports: { y: [-2.18, -5.47], z: [-14.6, -11.2, -7.8, -4.35, -0.88, 2.63, 6.14, 9.6], w: 1.8, h: 1.8 },
  bowGuns: [{ x: 0, y: 4.42, z: 19.6, len: 4.2 }],
  sternGuns: [{ x: 2.3, y: 0.0, z: -30, len: 3.2, port: true }, { x: -2.3, y: 0.0, z: -30, len: 3.2, port: true }],
  clusters: [{ z: -13.6, scale: 1.9 }, { z: -5.4, scale: 1.95 }, { z: 2.7, scale: 1.95 }, { z: 9.6, scale: 1.9 }],
  cluster: { r: 0.87, h: 1.3, crystals: 5, center: 2.35, around: 1.25, spread: 1.05 },
  masts: [
    { z: 16.4, height: 15.5, tiers: [{ at: 0.42, span: 11.5, rise: 1.1, sweep: 1.2 }, { at: 0.76, span: 10.6, rise: 1.0, sweep: 1.3 }] },
    { z: -19.0, height: 17.0, tiers: [{ at: 0.42, span: 12.0, rise: 1.1, sweep: 1.2 }, { at: 0.76, span: 11.0, rise: 1.0, sweep: 1.3 }] },
  ],
  fins: [{ z0: -20.0, z1: -14.0, span: 5.5, sweep: -1.6, tilt: 0.55 }, { z0: 8.6, z1: 13.4, span: 5.5, sweep: 1.4, tilt: 0.55 }],
  rudder: { z: -27.4, top: -0.9, bottom: -9.4, width: 2.3 },
  wheel: { z: -26.8, r: 1.0 },
  hatches: [{ z: -9.5, len: 2.2, wid: 2.2 }, { z: -1.35, len: 2.2, wid: 2.2 }, { z: 6.15, len: 2.2, wid: 2.2 }],
  windows: {
    side: [{ z0: -29.2, z1: -22.4, y0: 3.5, y1: 5.1, reps: 2 }, { z0: -29.2, z1: -22.4, y0: 1.2, y1: 2.8, reps: 2 }, { z0: 15.4, z1: 19.6, y0: 1.8, y1: 3.0 }],
    transom: [{ w: 9.0, y0: 3.5, y1: 5.1, reps: 2 }, { w: 9.0, y0: 1.2, y1: 2.8, reps: 2 }],
  },
  lanterns: [
    { at: [5.3, 5.69, -29.6], post: 1.0 }, { at: [-5.3, 5.69, -29.6], post: 1.0 },
    { at: [5.9, 5.69, -21.7], post: 1.0 }, { at: [-5.9, 5.69, -21.7], post: 1.0 },
    { at: [6.1, 3.42, 12.9], post: 0.9 }, { at: [-6.1, 3.42, 12.9], post: 0.9 },
    { at: [1.5, -2.0, 22.8], hang: 0.8 }, { at: [-1.5, -2.0, 22.8], hang: 0.8 },
    { at: [4.9, -0.2, -29.6], hang: 0.6 }, { at: [-4.9, -0.2, -29.6], hang: 0.6 },
  ],
  cargo: { barrels: [[5.4, -16.0], [-5.4, -2.0], [5.3, 5.9]], coils: [[-2.6, -9.5], [2.6, 6.2], [0, 16.0]],
    crates: [[-5.3, -11.0], [5.4, 0.8], [-5.2, 9.0], [5.2, -7.0]] },
  rail: { h: 0.85, step: 0.42, quarterH: 0.8 },
};
