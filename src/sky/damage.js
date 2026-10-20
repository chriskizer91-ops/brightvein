// damage.js: what a shot hits. Each ship has three things to shoot at (docs/ships.md): its hull, its sails and its
// crystals. Their shapes are read off the ship's own model once per class: the sails from the canvas, one box per
// mast with its wings spread and one with them folded back (src/ship/dress.js), and a shot meets the box between the
// two that fits how far her wings are folded then; the crystals from each furnace column and its crown of gems; the
// hull from the outlines it was built from.
import * as THREE from 'three';
import { curve } from '../ship/kit.js';
import { foldPoint } from '../ship/dress.js';

const V = () => new THREE.Vector3();

export function hitZones(ship) {
  const R = ship.recipe, Hh = R.hull, hull = ship.hull;
  const half = curve(Hh.half), rim = curve(Hh.rim), keel = curve(Hh.keel);
  const meshes = {};
  ship.body.traverse((o) => { if (o.isMesh) (meshes[o.name] ??= []).push(o.geometry); });
  const each = (name, fn) => { for (const g of meshes[name] ?? []) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) fn(p.getX(i), p.getY(i), p.getZ(i)); } };
  const nearest = (list, z) => { let best = 0; list.forEach((m, i) => { if (Math.abs(m.z - z) < Math.abs(list[best].z - z)) best = i; }); return best; };

  // sails: the canvas, split by the nearest mast, with its wings spread and folded
  const sails = R.masts.map(() => new THREE.Box3()), folded = R.masts.map(() => new THREE.Box3()), p = new THREE.Vector3(), f = new THREE.Vector3();
  for (const g of meshes.canvas ?? []) {
    const P = g.attributes.position, G = g.attributes.rig;
    for (let i = 0; i < P.count; i++) {
      p.fromBufferAttribute(P, i);
      const m = nearest(R.masts, p.z), wing = G && Math.round(G.getX(i)) === 1;
      sails[m].expandByPoint(p); folded[m].expandByPoint(wing ? foldPoint(p, Math.sign(G.getY(i)), G.getZ(i), 1, f) : p);
    }
  }
  for (const b of [...sails, ...folded]) b.expandByScalar(0.25);

  // crystals: each furnace column from the deck up, and its gems
  const C = R.cluster;
  const crystals = R.clusters.map((cl) => {
    const r = C.r * (cl.scale ?? 1) * 1.15, y0 = hull.deckY(cl.z);
    return new THREE.Box3(new THREE.Vector3(-r, y0, cl.z - r), new THREE.Vector3(r, y0 + 1, cl.z + r));
  });
  each('gem', (x, y, z) => crystals[nearest(R.clusters, z)].expandByPoint(new THREE.Vector3(x, y, z)));
  for (const b of crystals) b.expandByScalar(0.15);

  // the hull: inside its outlines, up to the rail (and the quarterdeck), ram included
  const qd = R.quarterdeck, railH = R.rail?.h ?? 0.5;
  const zMin = Hh.stern - 0.3, zMax = Math.max(Hh.bow, R.ram?.to ?? Hh.bow) + 0.2;
  const top = (z) => (qd && z < qd.front ? Math.max(rim(z), qd.height) : rim(z)) + railH;
  const inHull = (p) => {
    if (p.z < zMin || p.z > zMax) return false;
    if (p.z > Hh.bow) return Math.hypot(p.x, p.y - (R.ram?.y ?? 0)) < (R.ram?.collar ?? 0.4) + 0.2; // the ram
    return Math.abs(p.x) <= half(p.z) + 0.2 && p.y >= keel(p.z) - 0.2 && p.y <= top(p.z);
  };
  const hullBox = new THREE.Box3();
  for (const name of ['hull', 'band', 'deck']) each(name, (x, y, z) => hullBox.expandByPoint(new THREE.Vector3(x, y, z)));
  hullBox.expandByScalar(0.3);

  const all = hullBox.clone(); for (const b of [...sails, ...folded, ...crystals]) all.union(b);
  const sphere = all.getBoundingSphere(new THREE.Sphere());
  // where to aim: the middle of the hull, below the deck
  const aim = new THREE.Vector3(0, hullBox.min.y * 0.4, 0);
  return { sails, folded, crystals, hullBox, inHull, sphere, aim };
}
// mast i's sail box with her wings folded `fold` (0 spread .. 1 folded), into out
export function sailBox(Z, i, fold, out) {
  const k = Math.min(1, Math.max(0, fold)), a = Z.sails[i], b = Z.folded[i];
  if (a.isEmpty()) return out.makeEmpty();
  out.min.lerpVectors(a.min, b.min, k); out.max.lerpVectors(a.max, b.max, k);
  return out;
}

// The first thing the shot from a to b (in the world) hits on this ship, her wings folded `fold`, if any: { part, at
// (world), t (0..1) }. It's asked for every shot near a ship every frame, so it makes nothing new until something is hit
const ray = new THREE.Ray(), la = V(), lb = V(), dir = V(), hitP = V(), probe = V(), inv = new THREE.Matrix4(), wc = V(), near = V(), seg = new THREE.Line3(), enterP = V(), sb = new THREE.Box3();
let bestT = Infinity, bestPart = null, segLen = 1;
function tryBox(box, part) {
  if (box.isEmpty()) return;
  const p = box.containsPoint(la) ? la : ray.intersectBox(box, hitP);
  if (!p) return;
  const t = p.distanceTo(la) / segLen;
  if (t <= 1 && t < bestT) { bestT = t; bestPart = part; }
}
export function firstHit(Z, body, a, b, fold = 0) {
  wc.copy(Z.sphere.center).applyMatrix4(body.matrixWorld);
  if (seg.set(a, b).closestPointToPoint(wc, true, near).distanceTo(wc) > Z.sphere.radius) return null;
  inv.copy(body.matrixWorld).invert();
  la.copy(a).applyMatrix4(inv); lb.copy(b).applyMatrix4(inv);
  const len = la.distanceTo(lb); if (len < 1e-6) return null;
  dir.copy(lb).sub(la).divideScalar(len); ray.set(la, dir);
  bestT = Infinity; bestPart = null; segLen = len;
  for (const box of Z.crystals) tryBox(box, 'crystals');
  for (let i = 0; i < Z.sails.length; i++) tryBox(sailBox(Z, i, fold, sb), 'sails');
  // the hull: step through its box until inside the outlines
  const enter = Z.hullBox.containsPoint(la) ? enterP.copy(la) : ray.intersectBox(Z.hullBox, enterP);
  if (enter) {
    const t0 = enter.distanceTo(la) / len;
    for (let t = t0; t <= 1 && t < bestT; t += 0.2 / len) {
      if (Z.inHull(probe.copy(la).addScaledVector(dir, t * len))) { bestT = t; bestPart = 'hull'; break; }
    }
  }
  if (!bestPart) return null;
  return { part: bestPart, t: bestT, at: a.clone().lerp(b, bestT) };
}
