// parts.js: everything that stands on, hangs off or sticks out of a hull. Each maker puts its pieces in the batch
// under a material's name, and tells the builder where the glows are (crystals, lanterns, gun muzzles).
import * as THREE from 'three';
import { Batch, clamp, lerp, place, frame, lathe, tube, box, polygon, walls, toRect } from './kit.js';
import { hullBand, hullStrap, rivetRow, hullDecal } from './hull.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// Shapes used many times, made once per detail level
export function commonShapes(q) {
  const s = q.latheSeg;
  return {
    baluster: lathe([[0.042, 0], [0.042, 0.07], [0.022, 0.13], [0.03, 0.3], [0.04, 0.5], [0.03, 0.68], [0.02, 0.84], [0.042, 0.92], [0.042, 1]],
      Math.max(4, Math.round(s * 0.4))),
    knob: lathe([[0.001, 0], [0.06, 0.01], [0.075, 0.06], [0.06, 0.11], [0.03, 0.14], [0.012, 0.2], [0.001, 0.22]], Math.max(5, Math.round(s * 0.6))),
    rivet: lathe([[1, 0], [0.7, 0.55], [0.001, 0.8]], 5),
    ring: (r, w) => lathe([[r, -w], [r + w * 0.8, -w * 0.5], [r + w, 0], [r + w * 0.8, w * 0.5], [r, w]], s),
  };
}

// ---------- brass on the hull: bands, straps, the keel, rivets, and the cabin's windows ----------
export function brasswork(hull, batch, R, q, S) {
  const B = R.bands, T = R.tiles;
  const { zs, zb, keel, rim } = hull;
  // where a band at height y fits on the hull (the keel rises above it near the ends)
  const span = (y) => { let a = zb, b = zs; for (let z = zs; z <= zb; z += 0.05) if (keel(z) < y - 0.08 && rim(z) > y + 0.05) { a = Math.min(a, z); b = Math.max(b, z); } return [a + 0.03, b - 0.03]; };
  const I = Math.max(8, Math.round(q.stations * 0.8));
  if (q.level === 'far') {
    for (const side of [1, -1]) { const [y0, y1] = B.sheer, [a, b] = span(y1); hullBand(hull, batch, { z0: a, z1: b, top: () => y0, bottom: () => y1, side, tile: T.band, I: 10, J: 1, edges: false }); }
    return;
  }
  for (const side of [1, -1]) {
    const [y0, y1] = B.sheer, [a, b] = span(y1);
    hullBand(hull, batch, { z0: a, z1: b, top: () => y0, bottom: () => y1, side, tile: T.band, I });
    if (q.rivets) for (const yy of [y0 - 0.06, y1 + 0.06]) rivetRow(hull, batch, { z0: a, z1: b, y: () => yy, side, step: (0.28 * R.tileScale + 0.08) * q.rivetStep, rivet: S.rivet, r: 0.028 * Math.max(0.7, R.tileScale) });
    if (B.quarter && R.quarterdeck) {
      const qf = R.quarterdeck.front - 0.06;
      hullBand(hull, batch, { z0: zs + 0.03, z1: qf, top: (z) => rim(z) - 0.03, bottom: (z) => rim(z) - 0.3, side, tile: T.band, I: Math.max(4, Math.round(I * 0.2)) });
    }
    if (B.quarter && R.forecastle) {
      const fb = R.forecastle.back + 0.06;
      hullBand(hull, batch, { z0: fb, z1: zb - 0.03, top: (z) => rim(z) - 0.03, bottom: (z) => rim(z) - 0.3, side, tile: T.band, I: Math.max(4, Math.round(I * 0.2)) });
    }
    for (const [z, w] of B.straps) hullStrap(hull, batch, { z, width: w, side, J: Math.max(4, Math.round(q.rings * 0.9)) });
    // lower bands: one, or a list of them (a ship with two gun decks has one between them)
    for (const [l0, l1] of B.lower ? (Array.isArray(B.lower[0]) ? B.lower : [B.lower]) : []) { const [a, b] = span(l1); hullBand(hull, batch, { z0: a, z1: b, top: () => l0, bottom: () => l1, side, tile: T.band, I }); }
    // the keel: a brass strip along the bottom, both sides meeting under it
    hullBand(hull, batch, { z0: zs + 0.02, z1: zb - 0.02, top: (z) => keel(z) + 0.22 * (R.length / 25 + 0.4), bottom: (z) => keel(z), side, tile: T.band, I, J: 1 });
  }
  // windows in the hull's side (the cabins): one panel of three, or rows of them, `reps` panels side by side
  const sideWindows = R.windows?.side ? [].concat(R.windows.side) : [];
  for (const W of sideWindows) for (const side of [1, -1]) for (let k = 0, n = W.reps ?? 1; k < n; k++) {
    const z0 = lerp(W.z0, W.z1, k / n), z1 = lerp(W.z0, W.z1, (k + 1) / n);
    hullDecal(hull, batch, { z0, z1, y0: W.y0, y1: W.y1, side, rect: S.rects.windows3, I: Math.max(2, Math.round(q.rings / 3)), J: 2 });
  }
}

// ---------- rails: a brass handrail on turned balusters, a gunwale cap, tall posts with knobs ----------
function railPath(hull, z0, z1, side, inset, step) {
  const pts = [];
  const n = Math.max(2, Math.ceil(Math.abs(z1 - z0) / step));
  for (let i = 0; i <= n; i++) { const z = lerp(z0, z1, i / n); pts.push(V(side * (hull.deckHalf(z) - inset), hull.deckY(z), z)); }
  return pts;
}
function railAlong(batch, pts, R, q, S, h, opts = {}) {
  if (pts.length < 2) return;
  const sc = R.railScale;
  const top = pts.map((p) => p.clone().add(V(0, h, 0)));
  const per = 1;
  if (q.balusterStep) {
    batch.add('brass', tube(top, 0.042 * sc, q.tubeRad, per, opts.closed));
    batch.add('brass', tube(pts.map((p) => p.clone().add(V(0, 0.05, 0))), 0.055 * sc, q.tubeRad, per, opts.closed));
    batch.add('bronze', tube(pts.map((p) => p.clone().add(V(0, h * 0.2, 0))), 0.022 * sc, Math.max(3, q.tubeRad - 3), per, opts.closed));
  } else {
    batch.add('brass', tube(top, 0.05 * sc, q.tubeRad, 1, opts.closed));
  }
  // walk the path laying balusters every step, and a tall post every so often
  let carry = 0, count = 0;
  const step = q.balusterStep ? q.balusterStep * R.rail.step : 0, postEvery = q.balusterStep ? Math.max(3, Math.round(9 / q.balusterStep)) : 0;
  for (let i = 0; i < pts.length - 1 && step; i++) {
    const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
    let d = carry;
    while (d < len) {
      const p = a.clone().lerp(b, d / len);
      if (count % postEvery === 0) {
        batch.add('brass', box(0.1 * sc, h + 0.05, 0.1 * sc), place([p.x, p.y + (h + 0.05) / 2, p.z]));
        batch.add('brass', S.knob, place([p.x, p.y + h + 0.05, p.z], { scale: sc }));
      } else batch.add('bronze', S.baluster, place([p.x, p.y + 0.05, p.z], { scale: [sc, h - 0.06, sc] }));
      count++; d += step;
    }
    carry = d - len;
  }
}
// Where a raised deck's stairs come up: x of each flight's middle (one in the middle, one at each side, or none)
export function stairFlights(hull, St) {
  if (!St) return [];
  return St.sides ? [1, -1].map((s) => s * (hull.deckHalf(St.bottom) - St.width / 2 - 0.45)) : [0];
}
// the rail along a raised deck's edge at z, leaving gaps where its stairs come up
function edgeRail(hull, batch, R, q, S, z, St, h, inset) {
  const half = hull.deckHalf(z) - inset, y = hull.deckY(z), w = St ? St.width / 2 + 0.05 : 0;
  const runs = !St ? [[-half, half]] : St.sides ? [[-(Math.abs(stairFlights(hull, St)[0]) - w), Math.abs(stairFlights(hull, St)[0]) - w]] : [[-half, -w], [w, half]];
  for (const [a, b] of runs) if (b - a > 0.3) railAlong(batch, [V(a, y, z), V((a + b) / 2, y, z), V(b, y, z)], R, q, S, h);
}
export function rails(hull, batch, R, q, S) {
  const { zs, zb } = hull, Q = R.quarterdeck, h = R.rail.h, inset = 0.06 * R.railScale, st = q.railPath;
  const bowEnd = zb - 0.25 * R.length / 25;
  if (!Q) {
    // flush deck: one rail all the way round
    const pts = [...railPath(hull, zs + 0.06, bowEnd, 1, inset, st), ...railPath(hull, bowEnd, zs + 0.06, -1, inset, st)];
    pts.push(pts[0].clone());
    railAlong(batch, pts, R, q, S, h);
    return;
  }
  // the main deck: from the quarterdeck's front, round the bow and back (or, under a forecastle, up to it each side)
  const qf = Q.front + 0.1, F = R.forecastle, qh = R.rail.quarterH ?? h * 0.7;
  if (!F) {
    const main = [...railPath(hull, qf, bowEnd, 1, inset, st), ...railPath(hull, bowEnd, qf, -1, inset, st)];
    railAlong(batch, main, R, q, S, h);
  } else {
    const fb = F.back - 0.1;
    for (const s of [1, -1]) railAlong(batch, railPath(hull, qf, fb, s, inset, st), R, q, S, h);
    // the forecastle: down one side, round the bow and back, and along its back edge
    const fa = F.back + 0.08;
    railAlong(batch, [...railPath(hull, fa, bowEnd, 1, inset, st), ...railPath(hull, bowEnd, fa, -1, inset, st)], R, q, S, qh);
    edgeRail(hull, batch, R, q, S, fa, F.stairs, qh, inset);
  }
  // the quarterdeck: down each side, across the stern, and along its front edge
  const qb = Q.front - 0.08;
  const side = (s) => railPath(hull, qb, zs + 0.08, s, inset, st);
  const sternRun = [];
  for (let i = 0; i <= 10; i++) { const x = lerp(1, -1, i / 10) * (hull.deckHalf(zs + 0.08) - inset); sternRun.push(V(x, hull.deckY(zs + 0.08), zs + 0.08)); }
  railAlong(batch, [...side(1), ...sternRun.slice(1), ...side(-1).reverse().slice(1)], R, q, S, qh);
  edgeRail(hull, batch, R, q, S, qb, Q.stairs, qh, inset);
}

// ---------- guns ----------
// A long gun (bow and stern chasers): a crystal chamber, a long barrel with a crystal point, on a swivel.
// Built pointing along +z with its pivot at the origin; its base plate sits `post` below.
function longGun(batch, m, len, q, S, glows, { post = 0.42, swivel = true } = {}) {
  const s = len / 2.6, seg = q.latheSeg, k = (g) => g.applyMatrix4(m);
  const add = (key, g, mat) => batch.add(key, g, mat ? new THREE.Matrix4().multiplyMatrices(m, mat) : m);
  const along = (g) => g.rotateX(Math.PI / 2);
  const lvl = q.level;
  if (lvl === 'far') {
    add('bronze', along(lathe([[0.12 * s, -0.4 * s], [0.1 * s, len * 0.5], [0.07 * s, len]], 5)));
    add('crystal', along(lathe([[0.06 * s, 0], [0.001, 0.26 * s]], 4)), place([0, 0, len]));
    glows.push({ p: V(0, 0, len + 0.15 * s).applyMatrix4(m), size: 0.75 * s, color: 0xffa040 });
    return;
  }
  if (swivel) {
    add('brass', lathe([[0.001, 0], [0.34 * s, 0], [0.34 * s, 0.05 * s], [0.28 * s, 0.08 * s], [0.12 * s, 0.1 * s], [0.001, 0.1 * s]], seg), place([0, -post, 0]));
    add('bronze', new THREE.CylinderGeometry(0.075 * s, 0.1 * s, post - 0.12 * s, Math.max(6, seg >> 1)), place([0, -post / 2 - 0.02 * s, 0]));
    if (lvl === 'full') {
      for (const x of [-1, 1]) add('brass', box(0.04 * s, 0.26 * s, 0.16 * s), place([x * 0.18 * s, -0.04 * s, 0]));
      add('brass', box(0.4 * s, 0.05 * s, 0.14 * s), place([0, -0.17 * s, 0]));
      add('bronze', new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.44 * s, 6).rotateZ(Math.PI / 2), null);
    }
  }
  // the crystal chamber and the brass caps holding it
  add('crystal', along(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.62 * s, Math.max(6, seg >> 1), 1)), place([0, 0, -0.06 * s]));
  for (const z of [-0.4, 0.27]) add('brass', along(lathe([[0.001, -0.07 * s], [0.15 * s, -0.07 * s], [0.17 * s, -0.03 * s], [0.17 * s, 0.03 * s], [0.15 * s, 0.07 * s], [0.001, 0.07 * s]], seg)), place([0, 0, z * s]));
  if (lvl === 'full') for (const x of [-1, 1]) add('brass', box(0.03 * s, 0.03 * s, 0.6 * s), place([x * 0.12 * s, 0.1 * s, -0.06 * s]));
  add('brass', along(lathe([[0.001, -0.05 * s], [0.1 * s, -0.05 * s], [0.12 * s, 0.02 * s], [0.06 * s, 0.1 * s], [0.001, 0.12 * s]], seg)), place([0, 0, -0.5 * s]));
  // the barrel: dark wood with brass bands, a flared brass muzzle and a crystal point
  const L = len - 0.45 * s;
  add('wood', along(lathe([[0.1 * s, 0], [0.095 * s, L * 0.5], [0.075 * s, L]], seg)), place([0, 0, 0.34 * s]));
  for (let i = 0; i < (lvl === 'full' ? 4 : 1); i++) { const t = 0.08 + i * 0.27; add('brass', along(S.ring(lerp(0.1, 0.075, t) * s, 0.025 * s)), place([0, 0, 0.34 * s + t * L])); }
  add('brass', along(lathe([[0.07 * s, 0], [0.11 * s, 0.05 * s], [0.12 * s, 0.14 * s], [0.08 * s, 0.17 * s], [0.04 * s, 0.17 * s]], seg)), place([0, 0, 0.3 * s + L]));
  add('crystal', along(lathe([[0.055 * s, 0], [0.06 * s, 0.05 * s], [0.001, 0.26 * s]], 6)), place([0, 0, 0.45 * s + L]));
  glows.push({ p: V(0, 0, 0.55 * s + L).applyMatrix4(m), size: 0.75 * s, color: 0xffa040 });
  glows.push({ p: V(0, 0, -0.06 * s).applyMatrix4(m), size: 0.6 * s, color: 0xff9830 });
}

// A gun port in the hull: a brass frame, a dark opening, the gun's muzzle poking out, its lid propped open above
function gunPort(batch, m, w, h, q, S, glows, { gun = true, lid = true, barrelM = null } = {}) {
  const b = Math.min(w, h) * 0.1, d = 0.11, seg = q.latheSeg;
  const add = (key, g, mat) => batch.add(key, g, new THREE.Matrix4().multiplyMatrices(m, mat));
  add('dark', new THREE.PlaneGeometry(w, h), place([0, 0, 0.018]));
  for (const [x, y, bw, bh] of [[0, h / 2 + b / 2, w + 2 * b, b], [0, -h / 2 - b / 2, w + 2 * b, b], [w / 2 + b / 2, 0, b, h], [-w / 2 - b / 2, 0, b, h]])
    add('brass', box(bw, bh, d), place([x, y, d / 2 - 0.015]));
  if (q.rivets) for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add('brass', S.rivet, place([x * (w / 2 + b / 2), y * (h / 2 + b / 2), d - 0.012], { dir: V(0, 0, 1), scale: b * 0.32 }));
  if (gun) {
    const r = Math.min(w, h) * 0.17, L = 0.7 * h;
    const along = (g) => g.rotateX(Math.PI / 2);
    // the gun sits level in its port, even where the hull leans away below
    const add = (key, g, mat) => batch.add(key, g, new THREE.Matrix4().multiplyMatrices(barrelM ?? m, mat));
    add('bronze', along(lathe([[r * 1.25, 0], [r * 1.25, 0.12 * L], [r * 1.05, 0.15 * L], [r * 1.0, 0.75 * L], [r * 1.2, 0.8 * L], [r * 1.2, 0.95 * L], [r * 0.9, L]], seg)), place([0, -0.02 * h, -0.2]));
    add('brass', along(S.ring(r * 1.0, r * 0.18)), place([0, -0.02 * h, -0.2 + 0.45 * L]));
    add('crystal', along(lathe([[r * 0.85, 0], [r * 0.85, 0.08 * h], [r * 0.5, 0.12 * h], [0.001, 0.13 * h]], 8)), place([0, -0.02 * h, -0.2 + L]));
    glows.push({ p: V(0, -0.02 * h, -0.2 + L + 0.08 * h).applyMatrix4(barrelM ?? m), size: 0.75 * h, color: 0xff9a30 });
  }
  if (lid) {
    const lh = h * 0.62, t = 0.05, open = -2.25;
    const hinge = new THREE.Matrix4().compose(V(0, h / 2 + b, d * 0.6), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), open), V(1, 1, 1));
    const lidM = (mat) => new THREE.Matrix4().multiplyMatrices(hinge, mat);
    add('wood', box(w + b, lh, t, 1.4), lidM(place([0, -lh / 2, t / 2])));
    for (const [x, y, bw, bh] of [[0, -0.04, w + b, 0.07], [0, -lh + 0.04, w + b, 0.07], [(w + b) / 2 - 0.035, -lh / 2, 0.07, lh], [-(w + b) / 2 + 0.035, -lh / 2, 0.07, lh]])
      add('brass', box(bw, bh, 0.03), lidM(place([x, y, t + 0.012])));
  }
}
export function guns(hull, batch, R, q, S, glows) {
  const { at, normal, tAt } = hull;
  // broadside ports down each side, in one row or several (a ship with two gun decks)
  if (R.ports) for (const side of [1, -1]) for (const y of [].concat(R.ports.y)) for (const z of R.ports.z) {
    const t = tAt(z, y), p = at(z, t, side), n = normal(z, t, side);
    const up = UP.clone().sub(n.clone().multiplyScalar(n.y)).normalize(), right = new THREE.Vector3().crossVectors(up, n);
    const m = frame(V(...p), right, up, n);
    if (q.level === 'far') { batch.add('dark', new THREE.PlaneGeometry(R.ports.w * 1.1, R.ports.h * 1.1), new THREE.Matrix4().multiplyMatrices(m, place([0, 0, 0.03]))); continue; }
    const level = n.clone().setY(0).normalize(), lright = new THREE.Vector3().crossVectors(UP, level);
    gunPort(batch, m, R.ports.w, R.ports.h, q, S, glows, { gun: q.portGuns, lid: q.portLids, barrelM: frame(V(...p), lright, UP.clone(), level) });
  }
  for (const g of R.bowGuns) {
    if (g.face) {
      // straight out of the bow's face, through a brass collar
      longGun(batch, place([g.x, g.y, g.z]), g.len, q, S, glows, { swivel: false });
      if (q.level !== 'far') batch.add('brass', lathe([[0.42 * g.len / 2.6, -0.3], [0.5 * g.len / 2.6, -0.1], [0.42 * g.len / 2.6, 0.05], [0.24 * g.len / 2.6, 0.12]], Math.max(8, q.latheSeg)).rotateX(Math.PI / 2), place([g.x, g.y, g.z - 0.25]));
    } else longGun(batch, place([g.x, g.y, g.z]), g.len, q, S, glows, { post: Math.max(0.3, g.y - hull.deckY(g.z) + (g.swivel ? 0 : 0.02)) });
  }
  for (const g of R.swivels ?? []) {
    const m = place([g.x, g.y + R.rail.h * 0.9, g.z], { euler: [0, Math.sign(g.x) * Math.PI / 2, 0] });
    longGun(batch, m, g.len, q, S, glows, { post: R.rail.h * 0.85 + 0.05 });
  }
  for (const g of R.sternGuns ?? []) {
    if (g.port) {
      // out of a port in the flat stern, pointing back
      const m = place([g.x, g.y, hull.zs - 0.005], { euler: [0, Math.PI, 0] });
      gunPort(batch, m, 0.62 * g.len / 1.8 + 0.5, 0.75 * g.len / 1.8 + 0.4, q, S, glows, { gun: false, lid: false });
      longGun(batch, new THREE.Matrix4().multiplyMatrices(m, place([0, 0, -0.3])), g.len, q, S, glows, { swivel: false });
    } else longGun(batch, place([g.x, g.y, g.z], { euler: [0, Math.PI, 0] }), g.len, q, S, glows, { post: Math.max(0.3, g.y - hull.deckY(g.z)) });
  }
}

// ---------- crystal clusters: a glowing furnace column with brass arms holding sunstone crystals ----------
export function clusters(hull, batch, R, q, S, glows, lights, embers = []) {
  const C = R.cluster, rects = S.rects, seg = Math.max(q.level === 'far' ? 5 : 8, q.latheSeg);
  for (const cl of R.clusters) {
    const k = cl.scale ?? 1, r = C.r * k, h = C.h * k, y0 = hull.deckY(cl.z), m0 = place([0, y0, cl.z]);
    const add = (key, g, mat) => batch.add(key, g, mat ? new THREE.Matrix4().multiplyMatrices(m0, mat) : m0);
    // the plinth and the column, wearing the furnace's painted windows all round
    add('brass', lathe([[r * 1.18, 0], [r * 1.2, 0.06 * k], [r * 1.14, 0.12 * k], [r * 1.04, 0.14 * k], [r * 1.02, 0.2 * k]], seg));
    const col = new THREE.CylinderGeometry(r, r, h * 0.82, Math.max(10, seg), Math.max(1, q.latheSeg >> 3), true);
    const fr = rects.furnace, pos = col.attributes.position, uv = col.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i) / (h * 0.82) + 0.5;
      uv.setXY(i, lerp(fr.u0, fr.u1, lerp(0.04, 0.96, 0.5 + 0.5 * x / r)), 1 - lerp(fr.v0, fr.v1, lerp(0.92, 0.1, y)));
    }
    add('parts', col, place([0, 0.2 * k + h * 0.41, 0]));
    if (q.level !== 'far') for (const [y, w] of [[0.2, 0.05], [0.2 + h * 0.82 / k * 0.5, 0.035], [0.2 + h * 0.82 / k, 0.06]]) add('brass', S.ring(r * 1.0, w * k), place([0, y * k, 0]));
    const top = 0.2 * k + h * 0.82;
    add('brass', lathe([[r * 1.06, 0], [r * 1.08, 0.06 * k], [r * 0.9, 0.16 * k], [r * 0.62, 0.26 * k], [r * 0.56, 0.3 * k]], seg), place([0, top, 0]));
    // the upper works: a narrower drum ribbed with pipes
    const u0 = top + 0.28 * k, u1 = u0 + 0.5 * k;
    add('bronze', new THREE.CylinderGeometry(r * 0.52, r * 0.56, u1 - u0, seg, 1), place([0, (u0 + u1) / 2, 0]));
    const ribs = q.level === 'full' ? 10 : q.level === 'middle' ? 6 : 0;
    for (let i = 0; i < ribs; i++) { const a = (i / ribs) * Math.PI * 2; add('brass', new THREE.CylinderGeometry(0.035 * k, 0.035 * k, u1 - u0 + 0.06 * k, 6), place([Math.sin(a) * r * 0.57, (u0 + u1) / 2, Math.cos(a) * r * 0.57])); }
    add('brass', S.ring(r * 0.55, 0.05 * k), place([0, u1, 0]));
    // the central stem and the crown of cups, one crystal in each
    const n = C.crystals, cupY = u1 + 0.6 * k, spread = C.spread * k;
    add('brass', new THREE.CylinderGeometry(0.13 * k, 0.17 * k, cupY - u1 + 0.1, seg >> 1), place([0, (u1 + cupY) / 2 + 0.05, 0]));
    const spots = [{ x: 0, z: 0, y: cupY + 0.12 * k, h: C.center * k, w: C.center * k * 0.4 }];
    const around = n - 1;
    for (let i = 0; i < around; i++) {
      const a = around === 2 ? (i === 0 ? 0 : Math.PI) : Math.PI / 4 + (i / around) * Math.PI * 2;
      const hh = C.around * k * (0.92 + 0.16 * ((i * 7) % 3) / 2);
      spots.push({ x: Math.sin(a) * spread, z: Math.cos(a) * spread, y: cupY - 0.08 * k, h: hh, w: hh * 0.46 });
    }
    const tubePer = Math.max(2, q.tubePer);
    spots.forEach((c, i) => {
      if (i > 0) {
        const d = V(c.x, 0, c.z).normalize();
        const pts = [V(d.x * r * 0.4, u0 + 0.1 * k, d.z * r * 0.4), V(d.x * r * 0.75, u0 + 0.05 * k, d.z * r * 0.75), V(c.x * 0.95, u1 + 0.05 * k, c.z * 0.95), V(c.x, c.y - 0.2 * k, c.z)];
        add('brass', tube(pts, 0.065 * k, Math.max(5, q.tubeRad), tubePer));
      }
      if (!q.allCrystals && i > 0) return;
      const cw = c.w / 0.42;
      const cup = lathe([[0.04 * cw, -0.18 * cw], [0.12 * cw, -0.12 * cw], [0.13 * cw, -0.02 * cw], [0.21 * cw, 0.04 * cw], [0.24 * cw, 0.16 * cw], [0.21 * cw, 0.17 * cw], [0.18 * cw, 0.07 * cw]], seg);
      add('brass', cup, place([c.x, c.y, c.z]));
      if (!q.allCrystals && i > 0) return;
      // a sunstone crystal: a six-sided pillar with a point, brighter towards its tip
      const H = c.h, W = c.w, g = lathe([[0.001, -0.08 * H], [0.44 * W, 0.04 * H], [0.5 * W, 0.36 * H], [0.47 * W, 0.58 * H], [0.001, H]], 6).toNonIndexed();
      // each face takes its part of the painted crystal, seen from the side; the facets catch the light
      const P = g.attributes.position, U = g.attributes.uv, cr = rects.crystal;
      for (let j = 0; j < P.count; j++) {
        const u = 0.5 + 0.5 * (P.getX(j) / (0.5 * W)) * 0.62, v = clamp(1 - P.getY(j) / H, 0, 1);
        U.setXY(j, lerp(cr.u0, cr.u1, u), 1 - lerp(cr.v0, cr.v1, lerp(0.02, 0.8, v)));
      }
      add('gem', g, place([c.x, c.y + 0.02 * k, c.z], { spin: i * 0.7 + 0.3 }));
      glows.push({ p: V(c.x, c.y + H * 0.45, c.z).applyMatrix4(m0), size: H * 1.6, color: 0xff9a2a, pulse: true });
      embers.push({ p: V(c.x, c.y + H * 0.6, c.z).applyMatrix4(m0), r: W, h: H });
      if (i === 0) glows.push({ p: V(c.x, c.y + H * 0.38, c.z).applyMatrix4(m0), size: H * 0.55, color: 0xb25cff, pulse: true });
    });
    glows.push({ p: V(0, 0.2 * k + h * 0.45, 0).applyMatrix4(m0), size: r * 2.6, color: 0xff8a2a });
    lights.push({ p: V(0, cupY + 0.6 * k, 0).applyMatrix4(m0), power: 2.2 * k * R.length / 25 + 1 });
  }
}

// ---------- masts, yards, wing sails and their rigging ----------
const SAIL = { a: [493, 55], b: [72, 253], c: [495, 310] }; // the canvas's corners in the sail picture (mast top, boom tip, boom root)
export function masts(hull, batch, R, q, S, glows) {
  const rect = S.rects.sail, seg = Math.max(6, q.latheSeg);
  const sailUV = (pt) => { const [x, y] = pt; return [lerp(rect.u0, rect.u1, x / rect.w), 1 - lerp(rect.v0, rect.v1, y / rect.h)]; };
  const ropes = [];
  for (const M of R.masts) {
    const y0 = hull.deckY(M.z), H = M.height, r0 = 0.08 + 0.0045 * R.length + 0.03, r1 = r0 * 0.6;
    const mx = (y) => lerp(r0, r1, (y - y0) / H);
    batch.add('wood', lathe([[r0, 0], [lerp(r0, r1, 0.5), H * 0.5], [r1, H]], seg), place([0, y0, M.z]));
    batch.add('brass', lathe([[r0 * 1.9, 0], [r0 * 1.9, 0.08], [r0 * 1.45, 0.16], [r0 * 1.15, 0.3], [r0 * 1.1, 0.42]], seg), place([0, y0, M.z]));
    const bands = q.level === 'far' ? 0 : Math.max(2, Math.round(H / (q.level === 'full' ? 1.15 : 2.3)));
    for (let i = 1; i < bands; i++) { const y = y0 + (i / bands) * H; batch.add('brass', S.ring(mx(y), 0.035 + R.length * 0.0008), place([0, y, M.z])); }
    batch.add('brass', lathe([[r1 * 1.3, 0], [r1 * 1.45, 0.1], [r1 * 0.9, 0.22], [r1 * 1.15, 0.36], [r1 * 0.5, 0.5], [0.001, 0.82]], seg), place([0, y0 + H, M.z]));
    pennant(batch, V(0, y0 + H - 0.05, M.z), H * 0.42, H * 0.045, q.level === 'full' ? 20 : q.level === 'middle' ? 6 : 2);
    const top = V(0, y0 + H * 0.97, M.z);
    if (q.level === 'full') {
      const fr = r0 * 4.2, fh = 0.62 * R.railScale + 0.1, corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
      for (const [cx, cz] of corners) batch.add('wood', box(0.1 * R.railScale, fh, 0.1 * R.railScale, 2), place([cx * fr, y0 + fh / 2, M.z + cz * fr]));
      for (let i = 0; i < 4; i++) {
        const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4], len = Math.hypot((bx - ax) * fr, (bz - az) * fr);
        batch.add('wood', box(len, 0.07 * R.railScale, 0.16 * R.railScale, 2), place([(ax + bx) / 2 * fr, y0 + fh, M.z + (az + bz) / 2 * fr], { euler: [0, ax === bx ? Math.PI / 2 : 0, 0] }));
        for (let k = 1; k < 5; k++) {
          const t = k / 5, x = lerp(ax, bx, t) * fr, z = M.z + lerp(az, bz, t) * fr;
          batch.add('brass', lathe([[0.022, -0.12], [0.03, 0.02], [0.018, 0.06], [0.03, 0.16], [0.001, 0.2]].map(([a, b]) => [a * R.railScale, b * R.railScale]), 5), place([x, y0 + fh, z]));
        }
      }
    }
    M.tiers.forEach((Ti, ti) => {
      const yr = y0 + Ti.at * H;
      batch.add('brass', lathe([[mx(yr) * 1.25, -0.12], [mx(yr) * 1.4, -0.06], [mx(yr) * 1.4, 0.06], [mx(yr) * 1.25, 0.12]], seg), place([0, yr, M.z]));
      for (const side of [1, -1]) {
        const root = V(side * mx(yr), yr, M.z), tip = V(side * Ti.span, yr + Ti.rise, M.z - Ti.sweep);
        const yd = tip.clone().sub(root), len = yd.length();
        // the yard: a tapered spar with a brass spike at its tip
        batch.add('wood', lathe([[0.075 * R.railScale, 0], [0.045 * R.railScale, len]], Math.max(5, seg >> 1)), place(root, { dir: yd }));
        batch.add('brass', lathe([[0.06, 0], [0.075, 0.05], [0.06, 0.12], [0.035, 0.16], [0.001, 0.42]].map(([a, b]) => [a * R.railScale, b * R.railScale]), Math.max(5, seg >> 1)), place(tip, { dir: yd }));
        // the sail: from the mast (at the top, or just under the yard above) out to the yard's tip and back to its root
        const yA = ti === M.tiers.length - 1 ? y0 + H * 0.95 : y0 + M.tiers[ti + 1].at * H - 0.16;
        const A = V(side * mx(yA), yA, M.z);
        const Bp = root.clone().lerp(tip, 0.96), Cp = root.clone().lerp(tip, 0.035).add(V(0, 0.05, 0));
        sail(batch, A, Bp, Cp, q.sailDiv, sailUV, side, 0.09 * len);
        ropes.push([A.clone(), tip.clone().add(V(0, 0.05, 0))]);
        // sheets: from the yard's tip down to the rail
        const zr = clamp(tip.z - 0.6, hull.zs + 0.3, hull.zb - 0.3);
        ropes.push([tip.clone(), V(side * (hull.deckHalf(zr) - 0.05), hull.deckY(zr) + R.rail.h, zr)]);
      }
    });
    // shrouds: three a side from high on the mast to the deck edge, with ratlines across them
    const sy = y0 + H * 0.62;
    for (const side of [1, -1]) {
      const feet = [-0.55, 0, 0.55].map((dz) => { const z = clamp(M.z + dz * (0.6 + R.length * 0.02), hull.zs + 0.2, hull.zb - 0.2); return V(side * (hull.deckHalf(z) - 0.02), hull.deckY(z) + 0.06, z); });
      const head = V(side * mx(sy), sy, M.z);
      for (const f of feet) ropes.push([head, f]);
      if (q.ratlines) {
        const rungs = Math.floor((sy - y0) / 0.42);
        for (let i = 1; i < rungs; i++) {
          const t = i / rungs;
          const pts = feet.map((f) => f.clone().lerp(head, t));
          batch.add('rope', tube(pts, 0.012 + R.length * 0.0003, 3, 2, false, 0), null);
        }
      }
    }
  }
  // stays: fore mast to the bow, aft mast to the stern, and mast to mast
  const sorted = [...R.masts].sort((a, b) => b.z - a.z);
  const topOf = (M) => V(0, hull.deckY(M.z) + M.height * 0.94, M.z);
  const bowTip = R.bowsprit ? V(...R.bowsprit.to) : R.ram ? V(0, R.ram.y + R.ram.r * 0.6, R.ram.from + (R.ram.to - R.ram.from) * 0.35) : V(0, hull.deckY(hull.zb) + 0.3, hull.zb);
  ropes.push([topOf(sorted[0]), bowTip]);
  for (let i = 0; i < sorted.length - 1; i++) ropes.push([topOf(sorted[i + 1]), topOf(sorted[i]).clone().setY(topOf(sorted[i]).y - sorted[i].height * 0.08)]);
  const last = sorted[sorted.length - 1];
  for (const side of [1, -1]) ropes.push([topOf(last), V(side * (hull.deckHalf(hull.zs + 0.4) - 0.1), hull.deckY(hull.zs + 0.4) + 0.1, hull.zs + 0.4)]);
  const rr = 0.016 + R.length * 0.0004;
  for (const [a, b] of ropes) {
    if (!q.ropeRad) break;
    const mid = a.clone().lerp(b, 0.5).add(V(0, -a.distanceTo(b) * 0.012, 0));
    batch.add('rope', tube([a, mid, b], rr, q.ropeRad, Math.max(1, q.tubePer >> 1), false, 0.5), null);
  }
}
// A pennant: a long tapering streamer from the mast top, plum with a gold hoist, flying aft
function pennant(batch, top, len, wid, n) {
  const pos = [], col = [], bil = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = wid * (1 - t * 0.92);
    for (const s of [0.5, -0.5]) {
      pos.push(top.x, top.y - wid * 0.5 + s * w, top.z - t * len);
      const gold = t < 0.12; col.push(...(gold ? [0.95, 0.72, 0.28] : [0.42, 0.1, 0.3])); bil.push(t);
    }
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('billow', new THREE.Float32BufferAttribute(bil, 1));
  g.setIndex(idx); g.computeVertexNormals();
  batch.add('flag', g);
}

// One wing sail: a triangle of canvas bellied out with the wind (it fills towards the bow)
function sail(batch, A, B, C, n, uvOf, side, belly) {
  const pos = [], uv = [], bil = [], idx = [];
  const ua = uvOf(SAIL.a), ub = uvOf(SAIL.b), uc = uvOf(SAIL.c);
  const nrm = new THREE.Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A)).normalize();
  if (nrm.z < 0) nrm.negate();
  const id = (i, j) => (i * (i + 1)) / 2 + j;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= i; j++) {
    const wb = n ? (i - j) / n : 0, wc = n ? j / n : 0, wa = Math.max(0, 1 - wb - wc), bw = Math.max(0, 27 * wa * wb * wc);
    const p = A.clone().multiplyScalar(wa).add(B.clone().multiplyScalar(wb)).add(C.clone().multiplyScalar(wc)).addScaledVector(nrm, belly * Math.pow(bw, 0.8));
    pos.push(p.x, p.y, p.z); uv.push(ua[0] * wa + ub[0] * wb + uc[0] * wc, ua[1] * wa + ub[1] * wb + uc[1] * wc); bil.push(bw);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    idx.push(id(i, j), id(i + 1, j), id(i + 1, j + 1));
    if (j < i) idx.push(id(i, j), id(i + 1, j + 1), id(i, j + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('billow', new THREE.Float32BufferAttribute(bil, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  batch.add('canvas', g);
}

// ---------- fins under the belly, the rudder, the ram or bowsprit at the bow ----------
const FIN = [[7, 10], [194, 7], [230, 158], [142, 160]]; // the fin's corners in its picture: root front, root back, tip back, tip front
export function fins(hull, batch, R, q, S) {
  const rect = S.rects.fin, th = 0.07 + R.length * 0.0035;
  for (const F of R.fins) for (const side of [1, -1]) {
    const zm = (F.z0 + F.z1) / 2, t = 0.8, p = hull.at(zm, t, side), root = V(p[0], p[1] + 0.05, zm);
    const ang = F.tilt * Math.PI / 3, out = V(side * Math.cos(ang), -Math.sin(ang), 0);
    const chord = F.z1 - F.z0, tipChord = chord * 0.42;
    // in the fin's own frame: x along the ship (forward), y out along its span
    const back = F.sweep < 0, pts = back
      ? [[chord / 2, 0], [-chord / 2, 0], [-chord / 2 + F.sweep, F.span], [-chord / 2 + F.sweep + tipChord, F.span]]
      : [[-chord / 2, 0], [chord / 2, 0], [chord / 2 + F.sweep, F.span], [chord / 2 + F.sweep - tipChord, F.span]];
    const xs = pts.map((v) => v[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const uvOf = (x, y) => {
      const u = (x - x0) / (x1 - x0), v = y / F.span, px = lerp(7, 230, back ? 1 - u : u), py = lerp(9, 159, v);
      return [lerp(rect.u0, rect.u1, px / rect.w), 1 - lerp(rect.v0, rect.v1, py / rect.h)];
    };
    const m = frame(root, V(0, 0, 1), out, new THREE.Vector3().crossVectors(V(0, 0, 1), out));
    for (const f of [1, -1]) batch.add('parts', polygon(pts, uvOf).translate(0, 0, f * th / 2), m);
    batch.add('brass', walls(pts, th), m);
    // a brass root fairing where it meets the hull
    batch.add('brass', box(chord * 1.05, 0.12, th * 2.2), new THREE.Matrix4().multiplyMatrices(m, place([0, 0.03, 0])));
  }
}
export function rudder(hull, R, q, S) {
  const D = R.rudder, rect = S.rects.rudder, th = 0.08 + R.length * 0.003, h = D.top - D.bottom, w = D.width;
  const batch = new Batch();
  // the board hangs aft of its hinge line; its picture's hinge side faces the ship
  const pts = [[0, 0], [-w, 0], [-w, -h * 0.94], [-w * 0.8, -h], [0, -h]];
  const uvOf = (x, y) => [lerp(rect.u0, rect.u1, lerp(0.16, 0.98, -x / w)), 1 - lerp(rect.v0, rect.v1, lerp(0.02, 0.98, -y / h))];
  for (const f of [1, -1]) batch.add('parts', polygon(pts, uvOf).translate(0, 0, f * th / 2));
  batch.add('brass', walls(pts, th));
  for (let i = 0; i < 3; i++) {
    const y = -h * (0.12 + i * 0.36);
    batch.add('brass', new THREE.CylinderGeometry(0.06 + R.length * 0.002, 0.06 + R.length * 0.002, 0.28, 8), place([0.02, y, 0]));
    batch.add('brass', box(w * 0.55, 0.09, th + 0.04), place([-w * 0.27, y, 0]));
  }
  // the rudder lies in the ship's centre plane: its board points aft (-z)
  const pivot = place([0, D.top, D.z], { euler: [0, -Math.PI / 2, 0] });
  return { batch, pivot };
}
export function bow(hull, batch, R, q, S, glows) {
  const seg = Math.max(8, q.latheSeg);
  if (R.ram) {
    const A = R.ram, L = A.to - A.from, r = A.r, c = A.collar;
    const prof = [[0.001, 0], [c * 0.9, 0], [c, 0.06 * L], [c, 0.14 * L], [r * 1.05, 0.17 * L], [r, 0.2 * L], [r, 0.3 * L], [r * 1.12, 0.32 * L], [r * 1.12, 0.37 * L],
      [r * 0.92, 0.4 * L], [r * 0.78, 0.55 * L], [r * 0.5, 0.75 * L], [r * 0.22, 0.9 * L], [0.001, L]];
    batch.add('brass', lathe(prof, seg).rotateX(Math.PI / 2), place([0, A.y, A.from]));
    if (q.rivets) for (const t of [0.1, 0.25, 0.345]) {
      const rr = t < 0.2 ? c : t < 0.3 ? r : r * 1.12, n = Math.round(rr * 18);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; batch.add('brass', S.rivet, place([Math.cos(a) * rr, A.y + Math.sin(a) * rr, A.from + t * L], { dir: V(Math.cos(a), Math.sin(a), 0), scale: 0.03 * c })); }
    }
  }
  if (R.bowsprit) {
    const B = R.bowsprit, a = V(...B.from), b = V(...B.to), d = b.clone().sub(a);
    batch.add('wood', lathe([[B.r, 0], [B.r * 0.65, d.length()]], Math.max(6, seg >> 1)), place(a, { dir: d }));
    for (const t of [0.15, 0.45, 0.75]) batch.add('brass', S.ring(lerp(B.r, B.r * 0.65, t), 0.03), place(a.clone().lerp(b, t), { dir: d }));
    batch.add('brass', lathe([[B.r * 0.7, 0], [B.r * 0.9, 0.06], [B.r * 0.6, 0.16], [0.001, 0.5]], Math.max(6, seg >> 1)), place(b, { dir: d }));
    glows.push({ p: b.clone().add(d.clone().normalize().multiplyScalar(0.25)), size: 0.5, color: 0xffc070 });
  }
}

// ---------- lanterns on posts and on hangers ----------
export function lanterns(hull, batch, R, q, S, glows) {
  const rect = S.rects.lantern, sc = clamp(R.length / 25, 0.55, 1.15), lh = 0.68 * sc, lw = lh * rect.w / rect.h;
  const cross = (p) => {
    for (let i = 0; i < 2; i++) {
      const g = toRect(new THREE.PlaneGeometry(lw, lh), rect);
      batch.add('parts', g, place([p.x, p.y + lh / 2, p.z], { euler: [0, i * Math.PI / 2 + Math.PI / 4, 0] }));
    }
    glows.push({ p: V(p.x, p.y + lh * 0.48, p.z), size: 1.5 * sc, color: 0xffb860, flicker: true });
  };
  for (const L of R.lanterns) {
    const p = V(...L.at);
    if (L.post) {
      if (q.level !== 'far') batch.add('bronze', lathe([[0.06 * sc, 0], [0.05 * sc, 0.05], [0.035 * sc, 0.1], [0.035 * sc, L.post - 0.05], [0.07 * sc, L.post]], Math.max(5, q.latheSeg >> 1)), place(p));
      cross(p.clone().add(V(0, L.post, 0)));
    } else {
      batch.add('brass', new THREE.CylinderGeometry(0.018 * sc, 0.018 * sc, L.hang, 4), place([p.x, p.y - L.hang / 2, p.z]));
      batch.add('brass', S.ring(0.05 * sc, 0.02 * sc), place([p.x, p.y, p.z]));
      cross(p.clone().add(V(0, -L.hang - lh, 0)));
    }
  }
}

// ---------- the wheel, the stairs, hatches, the cabin's front, the stern's windows, cargo ----------
export function deckworks(hull, batch, R, q, S) {
  if (q.level === 'far') return;
  const seg = Math.max(6, q.latheSeg), rects = S.rects;
  // the wheel, on its pedestal, facing forward
  { const W = R.wheel, y0 = hull.deckY(W.z), r = W.r, cy = y0 + r * 1.55;
    batch.add('wood', box(0.22 * r / 0.6, cy - y0 - 0.1, 0.3 * r / 0.6, 2), place([0, (y0 + cy - 0.1) / 2, W.z - 0.12 * r]));
    for (const y of [y0 + 0.08, cy - 0.2]) batch.add('brass', box(0.26 * r / 0.6, 0.05, 0.34 * r / 0.6), place([0, y, W.z - 0.12 * r]));
    const m = place([0, cy, W.z + 0.08], { euler: [0, 0, 0] });
    const add = (key, g, mat) => batch.add(key, g, new THREE.Matrix4().multiplyMatrices(m, mat ?? new THREE.Matrix4()));
    add('wood', new THREE.TorusGeometry(r * 0.78, r * 0.06, Math.max(4, seg >> 2), seg * 2));
    add('wood', new THREE.TorusGeometry(r * 0.3, r * 0.045, 4, seg));
    add('brass', lathe([[0.001, -0.07], [r * 0.16, -0.07], [r * 0.18, 0], [r * 0.16, 0.07], [0.001, 0.09]], seg).rotateX(Math.PI / 2));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, d = V(Math.cos(a), Math.sin(a), 0);
      add('wood', lathe([[r * 0.045, 0], [r * 0.035, r * 0.78]], 5), place([0, 0, 0], { dir: d }));
      add('wood', lathe([[r * 0.04, 0], [r * 0.06, r * 0.08], [r * 0.045, r * 0.16], [r * 0.065, r * 0.22], [0.001, r * 0.27]], 6), place(d.clone().multiplyScalar(r * 0.84), { dir: d }));
    }
  }
  // the quarterdeck (and a forecastle): stairs up its face, brass handrails, and the face's windows either side
  // (rows of them on a tall castle). dir is which way the face looks: +1 forward (the quarterdeck), -1 aft
  const castle = (edge, St, dir) => {
    const yT = hull.deckY(edge - dir * 0.3), yB = hull.deckY(St ? St.bottom : edge + dir * 0.6), w = St?.width ?? 0;
    for (const x of stairFlights(hull, St)) {
      const n = Math.max(3, Math.round((yT - yB) / 0.23)), z0 = St.bottom, z1 = edge + dir * 0.02, rise = (yT - yB) / n, run = (z0 - z1) / n;
      for (let i = 0; i < n; i++) batch.add('deck', box(w, 0.07, Math.abs(run) + 0.06, 1), place([x, yB + rise * (i + 1) - 0.035, z0 - run * (i + 0.5)]));
      for (const s of [1, -1]) {
        const a = V(x + s * (w / 2 + 0.05), yB, z0), b = V(x + s * (w / 2 + 0.05), yT, z1);
        batch.add('wood', box(0.1, 0.32, a.distanceTo(b), 1), new THREE.Matrix4().compose(a.clone().lerp(b, 0.5).add(V(0, 0.08, 0)), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), b.clone().sub(a).normalize()), V(1, 1, 1)));
        batch.add('brass', tube([a.clone().add(V(0, 0.85, dir * 0.15)), b.clone().add(V(0, 0.85, 0))], 0.035, q.tubeRad, 2), null);
        for (const t of [0.05, 0.5, 0.95]) { const p = a.clone().lerp(b, t); batch.add('brass', new THREE.CylinderGeometry(0.025, 0.025, 0.85, 5), place([p.x, p.y + 0.425, p.z])); }
      }
    }
    // the face's windows: either side of a middle stair, or in columns across the face (between side stairs)
    const win = rects.windows2, middle = St && !St.sides;
    const span = middle ? null : St?.sides ? Math.abs(stairFlights(hull, St)[0]) - w / 2 - 0.25 : hull.deckHalf(edge) - 0.35;
    const big = 2.1 * Math.max(1, R.length / 40), pw = middle ? Math.min(big, hull.deckHalf(edge) - w / 2 - 0.25) : Math.min(big, span), ph = pw * win.h / win.w;
    const xs = middle ? [-(w / 2 + 0.15 + pw / 2), w / 2 + 0.15 + pw / 2] : Array.from({ length: Math.max(1, Math.floor((2 * span + 0.3) / (pw + 0.3))) }, (_, c, ) => c).map((c, _, arr) => (c - (arr.length - 1) / 2) * (pw + 0.3));
    const rows = Math.max(1, Math.floor((yT - yB - 0.3) / (ph + 0.3))), rowH = (yT - yB) / rows;
    for (let r = 0; r < rows; r++) for (const x of xs) {
      const g = toRect(new THREE.PlaneGeometry(pw, Math.min(ph, rowH - 0.25)), win);
      batch.add('parts', g, place([x, yB + rowH * (r + 0.52), edge + dir * 0.04], { euler: [0, dir > 0 ? 0 : Math.PI, 0] }));
    }
  };
  const Q = R.quarterdeck, F = R.forecastle;
  if (Q) castle(Q.front, Q.stairs, 1);
  if (F) castle(F.back, F.stairs, -1);
  // the capstan: a brass-bound drum with its bars
  if (R.capstan) {
    const z = R.capstan.z, y = hull.deckY(z), k = clamp(R.length / 25, 0.7, 1.2);
    batch.add('wood', lathe([[0.45 * k, 0], [0.45 * k, 0.08 * k], [0.3 * k, 0.14 * k], [0.26 * k, 0.5 * k], [0.32 * k, 0.6 * k], [0.36 * k, 0.72 * k], [0.001, 0.76 * k]], seg), place([0, y, z]));
    for (const yy of [0.08, 0.6]) batch.add('brass', S.ring(0.4 * k * (yy < 0.3 ? 1.1 : 0.85), 0.025 * k), place([0, y + yy * k, z]));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; batch.add('wood', lathe([[0.03 * k, 0], [0.025 * k, 0.9 * k]], 5), place([0, y + 0.66 * k, z], { dir: [Math.cos(a), 0.06, Math.sin(a)] })); }
  }
  // the flat stern's windows: one panel, a pair, or rows of `reps` panels
  for (const T of R.windows?.transom ? [].concat(R.windows.transom) : []) {
    const win = rects.windows3, n = T.twin ? 2 : T.reps ?? 1, w = T.twin ? T.w * 0.5 : T.w / n;
    for (let k = 0; k < n; k++) {
      const x = T.twin ? (k ? 0.52 : -0.52) * T.w : (k - (n - 1) / 2) * w;
      const g = toRect(new THREE.PlaneGeometry(T.twin ? w : w * 0.98, T.y1 - T.y0), win);
      batch.add('parts', g, place([x, (T.y0 + T.y1) / 2, hull.zs - 0.012], { euler: [0, Math.PI, 0] }));
    }
  }
  // hatches: a brass coaming with a grating on top
  for (const Hh of R.hatches ?? []) {
    const y = hull.deckY(Hh.z), h = 0.16;
    batch.add('brass', box(Hh.wid + 0.12, h, Hh.len + 0.12), place([0, y + h / 2, Hh.z]));
    const g = toRect(new THREE.PlaneGeometry(Hh.len, Hh.wid), rects.hatch);
    g.rotateX(-Math.PI / 2).rotateY(-Math.PI / 2);
    batch.add('parts', g, place([0, y + h + 0.004, Hh.z]));
  }
  // cargo: barrels with brass hoops, coils of rope, crates bound in brass
  if (!q.cargo) return;
  const C = R.cargo ?? {}, k = clamp(R.length / 25, 0.65, 1.1);
  const barrel = lathe([[0.001, 0], [0.24 * k, 0], [0.27 * k, 0.12 * k], [0.29 * k, 0.32 * k], [0.27 * k, 0.52 * k], [0.24 * k, 0.64 * k], [0.001, 0.64 * k]], seg);
  for (const [x, z] of C.barrels ?? []) {
    const y = hull.deckY(z);
    for (const [dx, dz] of [[0, 0], [0.55 * k, 0.1 * k], [0.2 * k, -0.52 * k]]) {
      batch.add('wood', barrel, place([x + dx * Math.sign(-x || 1), y, z + dz]));
      for (const t of [0.12, 0.52]) batch.add('brass', S.ring(lerp(0.27, 0.27, t) * k, 0.02 * k), place([x + dx * Math.sign(-x || 1), y + t * k, z + dz]));
    }
  }
  for (const [x, z] of C.coils ?? []) {
    const y = hull.deckY(z);
    for (let i = 0; i < 3; i++) batch.add('rope', new THREE.TorusGeometry((0.3 - i * 0.05) * k, 0.045 * k, 4, Math.max(8, seg)).rotateX(Math.PI / 2), place([x, y + 0.045 * k + i * 0.08 * k, z]));
  }
  for (const [x, z] of C.crates ?? []) {
    const y = hull.deckY(z), s = 0.62 * k;
    batch.add('deck', box(s, s, s, 1.2), place([x, y + s / 2, z], { euler: [0, 0.3, 0] }));
    for (const dy of [0.04, s - 0.04]) batch.add('brass', box(s + 0.02, 0.05, s + 0.02), place([x, y + dy, z], { euler: [0, 0.3, 0] }));
  }
}
