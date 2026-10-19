// ===================================================================== THE SKY DOCK: the claim's door to the skies
// The Captain's fighting ship rides off the north rim, at the end of a tall boarding bridge that climbs over the wall
// and runs out over the drop, under a gantry crane. From here she sets sail over Aethermoor (src/sky/): the claim's
// time stands still while she's away, and the shards she wins come home to the claim's own purse. The courier Lark
// keeps her mast; the Dock is for the fleet. Ships, upgrades and the choice of skies live in the shipyard.
const DOCK = { b: null, ship: null, lines: null, t: 0, deck: 4.0 };
let SKY = null, FLEET = null;
const DOCK_DEF = { name: 'Sky Dock', max: 1, cost: [0, 0], levels: ['Boarding bridge and gantry'],
  blurb: 'Your fighting ship rides at the end of the bridge. Sail her out over Aethermoor to bring down raiders and claim-jumpers: the shards they spill come home to the claim.' };

// ----------------------------------------------------------------- the bridge and gantry
// Local frame: x along the rim, +z out over the drop (north), y up; the rim's edge at z = 0.
function modelDock(b) {
  const Y = 4.6, W = 3;                           // the bridge's walkway: high enough to clear the wall
  const pz = -6.2;                                // the landing, inside the wall (which runs along z = -3.4)
  // the stair: along the wall, up from the lawn to the landing
  const steps = 16, x0 = 2.1, run = 5.8;
  for (let i = 0; i < steps; i++) b.add(G.box(run / steps + 0.06, 0.16, 2.4), MAT.boards, x0 + run - (i + 0.5) * (run / steps), (i + 1) / steps * Y - 0.08, pz);
  for (const s of [-1, 1]) {
    beam(b, [x0 + run + 0.1, 0, pz + s * 1.25], [x0, Y, pz + s * 1.25], 0.2, MAT.oakDark);
    if (s > 0) continue;
    beam(b, [x0 + run, 1.0, pz + s * 1.25], [x0, Y + 1.0, pz + s * 1.25], 0.07, MAT.brass, 1, { cast: false });
    for (let k = 0.08; k < 1; k += 0.18) b.add(G.box(0.07, 1.0, 0.07, 1), MAT.brass, x0 + run * (1 - k), k * Y + 0.5, pz + s * 1.25, { cast: false });
  }
  // the landing: a timber trestle on a stone plinth
  b.add(G.box(4.4, 1.1, 3.4), MAT.stone, 0, 0.45, pz);
  b.add(G.box(4.6, 0.16, 3.6), MAT.dressed, 0, 1.06, pz);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(G.box(0.34, Y - 1.1, 0.34), MAT.oak, sx * 1.85, (Y + 1.1) / 2, pz + sz * 1.35);
  for (const sz of [-1, 1]) { beam(b, [-1.85, 1.2, pz + sz * 1.35], [1.85, Y - 0.3, pz + sz * 1.35], 0.16, MAT.oakDark); beam(b, [1.85, 1.2, pz + sz * 1.35], [-1.85, Y - 0.3, pz + sz * 1.35], 0.16, MAT.oakDark); }
  b.add(G.box(4.6, 0.26, 3.6), MAT.boards, 0, Y - 0.05, pz);
  b.add(G.box(4.6, 0.3, 0.3), MAT.oakDark, 0, Y - 0.3, pz - 1.65); b.add(G.box(4.6, 0.3, 0.3), MAT.oakDark, 0, Y - 0.3, pz + 1.65);
  // the walkway out over the wall and the drop: oak planks on twin stringers
  const z0 = pz + 1.6, z1 = 7.4, mid = (z0 + z1) / 2, len = z1 - z0;
  b.add(G.box(W, 0.22, len), MAT.boards, 0, Y, mid);
  for (const s of [-1, 1]) {
    b.add(G.box(0.24, 0.5, len), MAT.oakDark, s * (W / 2 - 0.05), Y - 0.32, mid);
    b.add(G.box(0.08, 0.08, len), MAT.brass, s * (W / 2 - 0.05), Y + 1.05, mid, { cast: false });
    b.add(G.box(0.05, 0.05, len), MAT.brass, s * (W / 2 - 0.05), Y + 0.55, mid, { cast: false });
    for (let z = z0 + 0.4; z <= z1; z += 1.2) b.add(G.box(0.08, 1.05, 0.08, 1), MAT.brass, s * (W / 2 - 0.05), Y + 0.52, z, { cast: false });
    // a truss under the overhang, braced back into the cliff
    beam(b, [s * 1.2, -8, -0.6], [s * 1.2, Y - 0.5, 6.9], 0.34, MAT.oak);
    beam(b, [s * 1.2, -3.4, -0.4], [s * 1.2, Y - 0.5, 3.4], 0.26, MAT.oakDark);
    beam(b, [s * 1.2, Y - 0.55, -1.2], [s * 1.2, Y - 0.55, 7.2], 0.3, MAT.oakDark);
    // and a post down to the footing on the rim
    beam(b, [s * 1.2, 0, -0.2], [s * 1.2, Y - 0.55, -0.2], 0.3, MAT.oak);
  }
  for (let z = 0.6; z < 7; z += 2.1) b.add(G.box(2.8, 0.2, 0.2, 1), MAT.iron, 0, Y - 0.6, z);
  b.add(G.box(4.4, 2.2, 2.2), MAT.stone, 0, -0.9, -0.2);      // the footing on the rim, where the truss bears
  // a gangplank down to her rail
  b.add(G.box(1.3, 0.12, 1.6), MAT.boards, 0, Y - 0.25, z1 + 0.6, { rx: 0.3 });
  // the gantry: two legs at the bridge's end, a jib out over the ship, a block and a swaying cargo net
  const H = Y + 9.4, gz = 6.6;
  for (const s of [-1, 1]) {
    beam(b, [s * 1.7, Y - 0.6, gz], [s * 1.25, H, gz], 0.32, MAT.oak);
    for (let y = Y + 1.6; y < H - 1.5; y += 2.6) beam(b, [s * lerp(1.7, 1.25, (y - Y) / (H - Y)), y, gz], [-s * lerp(1.7, 1.25, (y + 2.6 - Y) / (H - Y)), y + 2.6, gz], 0.12, MAT.oakDark, 1, { cast: false });
  }
  b.add(G.box(3.2, 0.4, 0.5), MAT.oakDark, 0, H, gz);
  beam(b, [0, H, gz - 1.5], [0, H + 0.6, gz + 8.5], 0.3, MAT.oak);                       // the jib
  beam(b, [0, H + 3.2, gz], [0, H + 0.7, gz + 8.2], 0.06, MAT.rope, 1, { cast: false });  // its stay
  beam(b, [0, H, gz], [0, H + 3.3, gz], 0.2, MAT.oak);                                     // the king post
  b.add(G.cyl(0.3, 0.3, 0.32, 12).rotateZ(Math.PI / 2), MAT.brass, 0, H + 0.3, gz + 8.2);
  // a crate of stores on the hook, slung in four ropes
  const hoist = new THREE.Group(); hoist.position.set(0, H + 0.2, gz + 8.2); hoist.userData.dynamic = true; b.group.add(hoist);
  b.add(G.cyl(0.035, 0.035, 4.2, 5), MAT.rope, 0, -2.1, 0, { parent: hoist, cast: false });
  b.add(G.cyl(0.09, 0.09, 0.3, 8), MAT.iron, 0, -4.3, 0, { parent: hoist });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const m = beam(b, [0, -4.3, 0], [sx * 0.42, -5.25, sz * 0.42], 0.03, MAT.rope, 1, { parent: hoist, cast: false }); void m;
  }
  b.add(G.box(0.95, 0.75, 0.95), MAT.oak, 0, -5.65, 0, { parent: hoist });
  for (const y of [-5.4, -5.9]) b.add(G.box(1.0, 0.07, 1.0, 1), MAT.iron, 0, y, 0, { parent: hoist });
  DOCK.hoist = hoist;
  // bollards for the mooring lines, a signal post with a pennant, lamps
  for (const s of [-1, 1]) b.add(G.cyl(0.18, 0.22, 0.7, 10), MAT.iron, s * 1.1, Y + 0.35, z1 - 0.4);
  b.add(G.cyl(0.08, 0.1, 5.6, 8), MAT.oak, -1.9, Y + 2.8, z1 - 0.4);
  const flag = new THREE.Group(); flag.position.set(-1.9, Y + 5.2, z1 - 0.4); flag.userData.dynamic = true; b.group.add(flag);
  b.add(new THREE.PlaneGeometry(1.4, 0.45).translate(0.7, 0, 0), MAT.wool, 0, 0, 0, { parent: flag, cast: false });
  DOCK.pennant = flag;
  const lampMat = DOCK.lampMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45a, emissiveIntensity: 2.2 });
  for (const [x, z] of [[1.6, pz], [-1.6, z1 - 0.2], [1.6, 2.4]]) {
    b.add(G.cyl(0.05, 0.06, 1.3, 6), MAT.brass, x, Y + 0.65, z, { cast: false });
    b.add(G.box(0.3, 0.38, 0.3, 1), lampMat, x, Y + 1.45, z, { cast: false });
    const L = new THREE.PointLight(0xffb060, 0, 11, 1.6); L.position.set(x, Y + 1.6, z); b.group.add(L);
    b.lights.push({ light: L, power: 9, lvl: 1 });
  }
}
// the ground the Dock takes: no building tiles or trees there (world coordinates)
function dockClear(x, z, pad = 0) { const D = LAYOUT.dock; return x > D.x - 9 - pad && x < D.x + 3.5 + pad && z < D.z + 9 + pad && z > D.z - 30; }

// ----------------------------------------------------------------- the ship at the dock
// Moored broadside to the claim, bow to the east, her deck level with the bridge's end, which meets her aft of
// amidships (so from the lawn the gantry doesn't hide her)
function dockAt() { const L = LAYOUT.dock; return { x: L.x, z: L.z }; }
// where a ship rides at the bridge: her centre, and how far aft of it the bridge meets her
function dockBerth(s) {
  const D = dockAt(), half = s.hull.deckHalf(0), aft = s.recipe.length * 0.26;
  return { pos: new THREE.Vector3(D.x + aft, DOCK.deck, D.z - 7.4 - 1.0 - half), half, aft };
}
async function dockMoor() {
  if (!SKY) return;
  const R = SHIPS.find(s => s.id === FLEET.data.flying), s = await SKY.shipFor(R);
  if (SKY.on) return;                                  // sailed off while she was being built
  if (DOCK.ship && DOCK.ship !== s) DOCK.ship.root.removeFromParent();
  DOCK.ship = s;
  const D = dockAt(), { pos, half, aft } = dockBerth(s);
  s.root.position.copy(pos);
  s.root.rotation.set(0, Math.PI / 2, 0);
  s.root.userData.dock = true;
  scene.add(s.root);
  // the mooring lines, bow and stern, from the bollards to her rail, sagging a little
  if (DOCK.lines) { scene.remove(DOCK.lines); DOCK.lines.geometry.dispose(); }
  const geos = [];
  for (const s2 of [-1, 1]) {
    const a = new THREE.Vector3(D.x + s2 * 1.1, 5.1, D.z - 7.0), c = new THREE.Vector3(D.x + aft + s2 * R.length * 0.32, DOCK.deck + 0.9, s.root.position.z + half * 0.9);
    const m = a.clone().lerp(c, 0.5); m.y -= 0.8;
    geos.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, c), 16, 0.05, 5, false));
  }
  DOCK.lines = new THREE.Mesh(mergeGeometries(geos), MAT.rope); DOCK.lines.castShadow = true;
  scene.add(DOCK.lines);
  const pick = $('#panel'); if (!pick.hidden && UI.cur && UI.cur.kind === 'dock') UI.refresh();
}
function dockUpdate(dt) {
  DOCK.t += dt;
  if (DOCK.hoist) { DOCK.hoist.rotation.x = Math.sin(DOCK.t * 0.9) * 0.05; DOCK.hoist.rotation.z = Math.sin(DOCK.t * 0.63) * 0.04; }
  if (DOCK.pennant) DOCK.pennant.rotation.y = Math.sin(DOCK.t * 2.3) * 0.25;
  if (DOCK.lampMat) DOCK.lampMat.emissiveIntensity = 0.25 + TOD.night * 2.2;
  const s = DOCK.ship, A = SKY && SKY.shipArt;
  if (s && A && s.root.parent === scene) {
    s.update(dt, { calm: true });
    // the claim's light is brighter than the skies', and it blooms: her sails and crystals are dimmed a little here
    s.glow.material.uniforms.uScale.value = 0.6 * renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    A.M.canvas.emissiveIntensity = 0.02 + TOD.night * 0.1;
    A.M.canvas.userData.time.value += dt;
    A.M.gem.emissiveIntensity = 0.45 + TOD.night * 0.3 + Math.sin(DOCK.t * 2.4) * 0.08;
  }
}

// ----------------------------------------------------------------- setting up, sailing out, coming home
function setupDock(save) {
  const D = dockAt();
  const b = new Building('dock', DOCK_DEF, { x: D.x, z: D.z, rot: Math.PI });   // rot π: local +z points north, out over the drop
  b.type = 'dock';
  modelDock(b); b.show(1);
  DOCK.b = b;
  FLEET = makeProgress({ wallet: { get: () => GAME.shards, set: n => { GAME.shards = n; } }, load: () => save && save.sky, store: () => saveGame() });
  SKY = makeSky({ renderer, canvas, progress: FLEET, onLeave: dockHome });
  SKY.art.then(() => setTimeout(dockMoor, 50)).catch(e => console.error(e));
}
function openSky(mode) {
  if (!SKY || SKY.on) return;
  if (BUILD.on) return;
  UI.close(); FOLLOW.v = null; VIEW.tween = null;
  controls.enabled = false; kcontrols.enabled = false;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  SKY.open(mode).catch(e => { console.error(e); toast('The skies could not be opened: ' + esc(e.message)); dockHome({}); });
}
function dockHome(r) {
  controls.enabled = VIEW.mode !== 'keep'; kcontrols.enabled = VIEW.mode === 'keep';
  clock.getDelta();
  dockMoor();
  if (r && r.ship) {
    toast(r.lost ? `<b>The ${esc(r.ship)} went down.</b> Her crew brought her home${r.got ? ` with ${SHARD} ${r.got} shards` : ''}.`
      : r.got ? `<b>The ${esc(r.ship)} is home</b> with ${SHARD} ${r.got} shards for the claim${r.downed ? `, and ${r.downed} raider${r.downed > 1 ? 's' : ''} downed` : ''}.` : `<b>The ${esc(r.ship)} is home.</b>`);
    AUDIO.play('chime');
  }
  saveGame();
}
// the Dock's panel
UI.dock = function (body) {
  const d = FLEET.data, R = SHIPS.find(s => s.id === d.flying), sk = SKIES[d.skies], owned = SHIPS.filter(s => d.ships[s.id].owned).length;
  body.append(this.h(`<h2>${esc(DOCK_DEF.name)}</h2><p class="sub">The ${esc(R.name)} · ${esc(R.cls)} · ${R.length} m</p><p>${esc(DOCK_DEF.blurb)}</p>`));
  const chips = [`<span class="chip">Skies: ${esc(sk.name)}</span>`, `<span class="chip ${d.best[d.skies] ? 'amber' : ''}">${d.best[d.skies] ? `Best: wave ${d.best[d.skies]}` : 'No waves beaten yet'}</span>`,
    `<span class="chip">${owned} ship${owned > 1 ? 's' : ''} of ${SHIPS.length}</span>`];
  if (d.voyages) chips.push(`<span class="chip">${d.voyages} voyage${d.voyages > 1 ? 's' : ''} · ${d.downed} raiders downed</span>`);
  body.append(this.h(`<div class="stats-row">${chips.join('')}</div>`));
  const acts = this.h(`<div class="stats-row"><button type="button" class="btn primary" id="dk-sail">Set sail</button><button type="button" class="btn" id="dk-yard">Shipyard</button><button type="button" class="btn" id="dk-skies">Skies</button></div>`);
  acts.querySelector('#dk-sail').onclick = () => openSky('voyage');
  acts.querySelector('#dk-yard').onclick = () => openSky('port');
  acts.querySelector('#dk-skies').onclick = () => openSky('title');
  body.append(acts);
  body.append(this.h(`<p class="small">While she's out, the claim waits: nobody works and night won't fall until she's home. Bring down raiders in waves; after each one, sail on or come home with the shards.</p>`));
};
