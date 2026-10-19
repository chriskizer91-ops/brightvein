// damage.js: what a shot hits. Each ship has three things to shoot at (docs/ships.md): its hull, its sails and its
// crystals. Their shapes are read off the ship's own model once per class: the sails from the canvas, one box per
// mast; the crystals from each furnace column and its crown of gems; the hull from the outlines it was built from.
import * as THREE from 'three';
import { curve } from '../ship/kit.js';

const V = () => new THREE.Vector3();

export function hitZones(ship) {
  const R = ship.recipe, Hh = R.hull, hull = ship.hull;
  const half = curve(Hh.half), rim = curve(Hh.rim), keel = curve(Hh.keel);
  const meshes = {};
  ship.body.traverse((o) => { if (o.isMesh) (meshes[o.name] ??= []).push(o.geometry); });
  const each = (name, fn) => { for (const g of meshes[name] ?? []) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) fn(p.getX(i), p.getY(i), p.getZ(i)); } };
  const nearest = (list, z) => { let best = 0; list.forEach((m, i) => { if (Math.abs(m.z - z) < Math.abs(list[best].z - z)) best = i; }); return best; };

  // sails: the canvas, split by the nearest mast
  const sails = R.masts.map(() => new THREE.Box3());
  each('canvas', (x, y, z) => sails[nearest(R.masts, z)].expandByPoint(new THREE.Vector3(x, y, z)));
  for (const b of sails) b.expandByScalar(0.25);

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

  const all = hullBox.clone(); for (const b of [...sails, ...crystals]) all.union(b);
  const sphere = all.getBoundingSphere(new THREE.Sphere());
  // where to aim: the middle of the hull, below the deck
  const aim = new THREE.Vector3(0, hullBox.min.y * 0.4, 0);
  return { sails, crystals, hullBox, inHull, sphere, aim };
}

// The first thing the shot from a to b (in the world) hits on this ship, if any: { part, at (world), t (0..1) }
const ray = new THREE.Ray(), la = V(), lb = V(), dir = V(), hitP = V(), probe = V(), inv = new THREE.Matrix4(), wc = V(), near = V(), seg = new THREE.Line3();
export function firstHit(Z, body, a, b) {
  wc.copy(Z.sphere.center).applyMatrix4(body.matrixWorld);
  if (seg.set(a, b).closestPointToPoint(wc, true, near).distanceTo(wc) > Z.sphere.radius) return null;
  inv.copy(body.matrixWorld).invert();
  la.copy(a).applyMatrix4(inv); lb.copy(b).applyMatrix4(inv);
  const len = la.distanceTo(lb); if (len < 1e-6) return null;
  dir.copy(lb).sub(la).divideScalar(len); ray.set(la, dir);
  let best = null;
  const tryBox = (box, part) => {
    if (box.isEmpty()) return;
    const p = box.containsPoint(la) ? la : ray.intersectBox(box, hitP);
    if (!p) return;
    const t = p.distanceTo(la) / len;
    if (t <= 1 && (!best || t < best.t)) best = { part, t };
  };
  for (const box of Z.crystals) tryBox(box, 'crystals');
  for (const box of Z.sails) tryBox(box, 'sails');
  // the hull: step through its box until inside the outlines
  const enter = Z.hullBox.containsPoint(la) ? la.clone() : ray.intersectBox(Z.hullBox, V());
  if (enter) {
    const t0 = enter.distanceTo(la) / len;
    for (let t = t0; t <= 1 && (!best || t < best.t); t += 0.2 / len) {
      if (Z.inHull(probe.copy(la).addScaledVector(dir, t * len))) { best = { part: 'hull', t }; break; }
    }
  }
  if (!best) return null;
  best.at = a.clone().lerp(b, best.t);
  return best;
}
