// hull.js: a ship's hull, shaped the Magpie's way from outlines measured off its pictures: how wide it is from above
// (half), how high its deck edge is (rim) and how deep its keel is (keel), all along its length (z, bow forward).
// Each cross-section is a straight wall from the deck edge down to the wale (the main deck's level, so the
// quarterdeck's cabin stands above it), then a round bowl down to the keel. Dressed in the Brig's painted planks,
// with real brass bands, straps and rivets standing off it.
import * as THREE from 'three';
import { curve, clamp, lerp, sheet, polygon, place } from './kit.js';

export function makeHull(R) {
  const H = R.hull;
  const half = curve(H.half), rim = curve(H.rim), keel = curve(H.keel);
  const p = H.fullness ?? 0.75, wale0 = H.wale ?? 0, lean = H.tumblehome ?? 0.05;
  const zs = H.stern, zb = H.bow;
  const wale = (z) => Math.min(rim(z), Math.max(wale0, keel(z) + 0.3)); // never below the keel (under a stern castle)
  const wallH = (z) => Math.max(0, rim(z) - wale(z));
  const bowlD = (z) => Math.max(0.02, wale(z) - keel(z));
  const fw = (z) => { const w = wallH(z); return w / (w + bowlD(z) * 1.3); };
  // a point on the section at station z: t = 0 at the deck edge, 1 at the keel; side +1 is port (+x)
  function at(z, t, side = 1) {
    const f = fw(z);
    if (t < f) { const k = t / f; return [side * half(z) * (1 - lean * (1 - k) * Math.min(1, wallH(z) / 1.5)), rim(z) - k * wallH(z), z]; }
    const a = ((t - f) / (1 - f)) * Math.PI / 2;
    return [side * half(z) * Math.cos(a), wale(z) - bowlD(z) * Math.pow(Math.sin(a), p), z];
  }
  // the t of the point at height y (between the deck edge and the keel) at station z
  function tAt(z, y) {
    const f = fw(z);
    if (y >= wale(z) && wallH(z) > 1e-3) return clamp((rim(z) - y) / wallH(z), 0, 1) * f;
    const s = clamp((wale(z) - y) / bowlD(z), 0, 1);
    return f + (1 - f) * (Math.asin(Math.pow(s, 1 / p)) / (Math.PI / 2));
  }
  // the section's outward normal at (z, t), ignoring the hull's curve along its length
  function normal(z, t, side = 1) {
    const e = 0.004, a = at(z, Math.max(0, t - e), side), b = at(z, Math.min(1, t + e), side);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return new THREE.Vector3(-dy * side, dx * side, 0).normalize();
  }
  // arc length from the keel up to t, so the planks line up from one station to the next
  function arc(z, t, steps = 12) {
    let s = 0, prev = at(z, 1);
    for (let i = 1; i <= steps; i++) { const q = at(z, 1 - (1 - t) * (i / steps)); s += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
    return s;
  }
  // stations, closer together near the ends, where the hull curves most
  const station = (u) => lerp(zs, zb, 0.5 - 0.5 * Math.cos(Math.PI * u));
  const deckY = (z) => rim(z) - 0.035;
  const deckHalf = (z) => Math.abs(at(z, 0, 1)[0]);
  return { R, half, rim, keel, wale, wallH, bowlD, at, tAt, normal, arc, station, zs, zb, deckY, deckHalf };
}

// rings sit closer together near the deck edge, where the light catches the wall
const ringT = (j) => Math.pow(j, 1.15);

// The hull's own geometry, into the batch
export function buildHull(hull, batch, q) {
  const { R, at, arc, station, zs, zb } = hull;
  const T = R.tiles, skin = R.skin ?? 'hull', tile = skin === 'plates' ? T.plates : T.planks; // planks, or the Man-o'-war's iron plates
  const I = q.stations, J = q.rings;
  for (const side of [1, -1]) {
    const g = sheet(I, J,
      (i, j) => at(station(i), ringT(j), side),
      (i, j) => { const z = station(i); return [z / tile[0], arc(z, ringT(j)) / tile[1]]; },
      side < 0);
    batch.add(skin, g);
  }
  // the flat stern, and a cap where the hull meets the ram or stem
  for (const [z, face] of [[zs, -1], [zb, 1]]) {
    const K = Math.max(4, Math.round(J * 0.8)), pts = [];
    for (let k = 0; k <= K; k++) { const p = at(z, ringT(k / K), 1); pts.push([p[0], p[1]]); }
    for (let k = K - 1; k >= 0; k--) { const p = at(z, ringT(k / K), -1); pts.push([p[0], p[1]]); }
    if (Math.abs(pts[0][0]) < 0.03) continue;
    const g = polygon(pts, (x, y) => [x / tile[0], y / tile[1]]);
    if (face < 0) g.rotateY(Math.PI);
    g.translate(0, 0, z + face * 0.002);
    batch.add(skin, g);
  }
  // the deck: boards running fore and aft; the quarterdeck's floor where the deck edge rises
  const A = q.deckAcross * 2;
  const deck = sheet(I, A,
    (i, j) => { const z = station(i); return [(j * 2 - 1) * hull.deckHalf(z) * 0.985, hull.deckY(z), z]; },
    (i, j, pp) => [pp[2] / T.deck[0], pp[0] / T.deck[1]], false);
  batch.add('deck', deck);
}

// A band of brass standing a little off the hull between two heights, along a run of the hull, with walls
// along its edges so it has thickness. top/bottom: functions of z giving heights.
export function hullBand(hull, batch, { z0, z1, top, bottom, side, off = 0.03, tile, I = 40, J = 2, key = 'band', edges = true }) {
  const { at, normal, tAt } = hull;
  const ptAt = (z, f, o) => {
    const t = lerp(tAt(z, top(z)), tAt(z, bottom(z)), f), p = at(z, t, side), n = normal(z, t, side);
    return [p[0] + n.x * o, p[1] + n.y * o, p[2]];
  };
  batch.add(key, sheet(I, J, (i, j) => ptAt(lerp(z0, z1, i), j, off), (i, j, pp) => [pp[2] / tile[0], j], side < 0));
  if (edges) for (const f of [0, 1]) batch.add('brass', sheet(I, 1, (i, j) => ptAt(lerp(z0, z1, i), f, j * off), (i, j) => [i, f], (side < 0) !== (f === 1)));
}

// A strap of brass down the hull from the deck edge (t = from) to the keel (t = to) at one station, on one side
export function hullStrap(hull, batch, { z, width, side, off = 0.035, J = 18, from = 0, to = 1 }) {
  const { at, normal } = hull;
  const pt = (zz, t, o) => { const pp = at(zz, t, side), n = normal(zz, t, side); return [pp[0] + n.x * o, pp[1] + n.y * o, zz]; };
  batch.add('band', sheet(J, 2, (i, j) => pt(z + (j - 0.5) * width, lerp(from, to, i), off), (i, j) => [lerp(from, to, i) * 5, j], side > 0));
  for (const e of [0, 1]) batch.add('brass', sheet(J, 1, (i, j) => pt(z + (e - 0.5) * width, lerp(from, to, i), j * off), () => [0, 0], (side > 0) !== (e === 1)));
}

// Rivets: little brass domes in a row, every `step` metres, at height y(z)
export function rivetRow(hull, batch, { z0, z1, y, side, step, off = 0.03, r = 0.03, rivet }) {
  const { at, normal, tAt } = hull;
  for (let z = z0 + step / 2; z < z1; z += step) {
    const t = tAt(z, y(z)), pp = at(z, t, side), n = normal(z, t, side);
    batch.add('brass', rivet, place([pp[0] + n.x * off, pp[1] + n.y * off, pp[2]], { dir: n, scale: r }));
  }
}

// A picture laid on the hull wall (the cabin's windows): the hull between z0..z1 and heights y0..y1
export function hullDecal(hull, batch, { z0, z1, y0, y1, side, rect, off = 0.012, I = 8, J = 3 }) {
  const { at, normal, tAt } = hull;
  batch.add('parts', sheet(I, J, (i, j) => {
    const z = lerp(z0, z1, i), t = tAt(z, lerp(y1, y0, j)), pp = at(z, t, side), n = normal(z, t, side);
    return [pp[0] + n.x * off, pp[1] + n.y * off, z];
  }, (i, j) => [lerp(rect.u0, rect.u1, side > 0 ? 1 - i : i), 1 - lerp(rect.v0, rect.v1, j)], side < 0));
}
