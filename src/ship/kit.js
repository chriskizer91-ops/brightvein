// kit.js: small tools the ship builder shares. Smooth curves through measured points, a batch that joins many
// pieces into one mesh per material (so a 100,000-triangle ship is a handful of draw calls), and quick ways to
// make and place common shapes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A smooth curve through [[z, value], ...], sorted by z: monotone cubic, so it never overshoots between points
// (a sudden step, like the quarterdeck's edge, stays a clean step).
export function curve(points) {
  const n = points.length, xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Everything of one material ends up in one geometry. Pieces arrive with their own matrix.
export class Batch {
  constructor() { this.parts = new Map(); }
  add(key, geometry, matrix) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'billow'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return g;
  }
  // Join each material's pieces. Pieces that lack an attribute others have get it filled in.
  build() {
    const out = new Map();
    for (const [key, list] of this.parts) {
      const names = new Set();
      for (const g of list) for (const n of Object.keys(g.attributes)) names.add(n);
      for (const g of list) for (const n of names) if (!g.attributes[n]) {
        const size = n === 'color' ? 3 : n === 'billow' ? 1 : 2;
        const fill = new Float32Array(g.attributes.position.count * size);
        if (n === 'color') fill.fill(1);
        g.setAttribute(n, new THREE.Float32BufferAttribute(fill, size));
      }
      const merged = mergeGeometries(list, false);
      merged.computeBoundingSphere();
      out.set(key, merged);
    }
    return out;
  }
}

export const triangles = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

// Place a piece: position, a direction its +y axis should point along, and a spin around that axis.
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export function place(pos, { dir = null, quat = null, euler = null, scale = 1, spin = 0 } = {}) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  if (quat) q.copy(quat);
  else if (euler) q.setFromEuler(new THREE.Euler(...euler, 'YXZ'));
  else if (dir) q.setFromUnitVectors(_up, new THREE.Vector3(...(Array.isArray(dir) ? dir : dir.toArray())).normalize());
  if (spin) q.multiply(_q.setFromAxisAngle(_up, spin));
  if (typeof scale === 'number') _s.set(scale, scale, scale); else _s.set(...scale);
  return m.compose(new THREE.Vector3(...(Array.isArray(pos) ? pos : pos.toArray())), q, _s);
}

// A matrix that turns a piece's local frame (x right, y up, z out) into the given axes, then moves it to pos
export function frame(pos, right, up, out) {
  return new THREE.Matrix4().makeBasis(right, up, out).setPosition(pos);
}

// A round piece turned on a lathe from [[radius, y], ...]
export function lathe(profile, segments, phi0 = 0, phiLen = Math.PI * 2) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segments, phi0, phiLen);
}

// A rope, pipe or rail through points
export function tube(points, radius, radial, perPoint = 3, closed = false, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => (Array.isArray(p) ? new THREE.Vector3(...p) : p)), closed, 'catmullrom', tension);
  return new THREE.TubeGeometry(c, Math.max(1, Math.round((points.length - 1) * perPoint)), radius, radial, closed);
}

// A straight rod between two points
export function rod(a, b, r0, r1 = r0, radial = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false);
  g.translate(0, len / 2, 0);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromUnitVectors(_up, B.clone().sub(A).normalize());
  m.compose(A, q, new THREE.Vector3(1, 1, 1));
  return { geometry: g, matrix: m };
}

// Box with UVs scaled to its size in metres (so wood grain keeps one size on every box)
export function box(w, h, d, uvScale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const [su, sv] = ax > 0.5 ? [d, h] : ay > 0.5 ? [w, d] : [w, h];
    uv.setXY(i, uv.getX(i) * su * uvScale, uv.getY(i) * sv * uvScale);
  }
  return g;
}

// Remap a geometry's 0..1 UVs into a rectangle of the parts sheet ({u0, v0, u1, v1}, v down as in the picture)
export function toRect(g, r, flipX = false) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = flipX ? 1 - uv.getX(i) : uv.getX(i), v = uv.getY(i);
    uv.setXY(i, lerp(r.u0, r.u1, u), 1 - lerp(r.v1, r.v0, v));
  }
  return g;
}

// A flat polygon (as [[x, y], ...]) with its own UVs from a function of the point
export function polygon(points, uvOf) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(shape);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const [u, v] = uvOf(p.getX(i), p.getY(i)); uv.setXY(i, u, v); }
  return g;
}

// The walls round a flat polygon of the given thickness (its faces are made separately)
export function walls(points, thickness) {
  const pos = [], n = points.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % n], h = thickness / 2;
    pos.push(ax, ay, h, bx, by, h, bx, by, -h, ax, ay, h, bx, by, -h, ax, ay, -h);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// A grid surface from a function (i/I, j/J) => [x, y, z], with UVs from another; rows along i
export function sheet(I, J, posOf, uvOf, flip = false) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= I; i++) for (let j = 0; j <= J; j++) {
    const p = posOf(i / I, j / J); pos.push(p[0], p[1], p[2]);
    const t = uvOf(i / I, j / J, p); uv.push(t[0], t[1]);
  }
  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) {
    const a = i * (J + 1) + j, b = a + 1, c = a + J + 1, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
