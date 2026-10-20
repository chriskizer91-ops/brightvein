// ===================================================================== THE LARK, BUILT LIKE THE FLEET
// The ship that guards the claim at night is a smaller sister of the one at the Sky Dock: the same class, built by the
// same shipwright (the skies' ship builder, src/ship/build.js) in the flagship's own sails and pennant, but light and
// quick enough to circle the rim (the big ships turn too slowly to keep a wall). She's shown at 10 to 12 m whatever
// the flagship's size, so she reads from the lawn and never crowds the Keep.
// Her old model (buildAirship in buildings.js) is still built first, for its parts the code moves (her lamps, her
// light, her place on the mast); its meshes are hidden once she's built, which is as soon as the ships' art has loaded.
// Nothing here changes what she does: shipAI (wildlight.js) flies her as before.
const LARK = { s: null, key: '', root: null, k: 1, wait: 0, glow: [] };
const larkLen = R => clamp((R.length || 10) * 0.5, 10, 12);
function larkKey() {
  const R = yardShip(FLEET.data.flying), p = FLEET.data.ships[R.id] && FLEET.data.ships[R.id].paint;
  return R.id + '|' + (p ? (p.sails || '') + ',' + (p.pennant || '') : '') + '|' + QUALITY.level;
}
function larkBuild() {
  const S = TOWN.ship; if (!S || !SKY || !SKY.shipArt || !FLEET) return false;
  const key = larkKey(); if (key === LARK.key && LARK.s) return true;
  const R = yardShip(FLEET.data.flying), s = buildShipAt(R, QUALITY.level === 'light' ? 'far' : 'middle', SKY.shipArt);
  skyPaint(s, FLEET.data.ships[R.id] && FLEET.data.ships[R.id].paint);
  // the skies build a ship bow to +z; the Lark's frame has her bow to +x and her deck at y = 0
  const k = larkLen(R) / R.length, z0 = (s.hull.zs + s.hull.zb) / 2, deck = s.hull.deckY(0);
  const root = new THREE.Group(); root.rotation.y = Math.PI / 2; root.scale.setScalar(k);
  s.root.position.set(0, -deck, -z0); root.add(s.root);
  root.traverse(o => { if (o.isMesh || o.isPoints) o.userData.ship = true; });
  // her glowing materials, dimmed by day as the Dock's are (the claim's light blooms)
  const glow = [];
  s.body.traverse(o => { if (o.isMesh && ['canvas', 'parts', 'crystal', 'gem'].includes(o.name) && !glow.some(g => g.m === o.material)) glow.push({ m: o.material, kind: o.name }); });
  if (LARK.root) { LARK.root.removeFromParent(); safeFree(LARK.root); }
  S.ship.add(root);
  // her old model's meshes give way (her light and the parts' group stay)
  for (const o of S.hullG.children) if (o !== S.parts && !o.isLight) o.visible = false;
  // where things go on her now: the crew's deck spots, her parts, and her pennants from the top of her mainmast
  const M = (R.masts || []).reduce((a, m) => !a || m.height > a.height ? m : a, null);
  const top = M ? new THREE.Vector3(0, s.hull.deckY(M.z) - deck + M.height * 0.92, M.z - z0) : new THREE.Vector3(0, 4, 0);
  S.penAt = [top.z * k, top.y * k, 0];   // (bow +z in her build is +x in the Lark's frame)
  S.partsK = larkLen(R) / 15;            // her parts were placed for the old 15 m hull
  S.deckK = Math.min(1, (s.hull.deckHalf(0) * k) / 2.1);
  Object.assign(LARK, { s, key, root, k, glow });
  if (typeof larkProps === 'function') larkProps();
  return true;
}
// every frame, from shipAI: her sails and pennants, her glows at the claim's scale, and her lean into the patrol's turn
function larkFrame(dt, turn) {
  LARK.wait -= dt;
  if (LARK.wait <= 0) { LARK.wait = 1; if (SKY && SKY.shipArt && FLEET && larkKey() !== LARK.key) larkBuild(); }
  const s = LARK.s; if (!s) return;
  s.update(dt, { calm: SHIP.state === 'docked', turn: turn || 0 });
  const n = TOD.night, px = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  s.glow.material.uniforms.uScale.value = 0.6 * LARK.k * (0.12 + 0.6 * n) * px;
  for (const L of s.lamps) L.intensity *= 0.3;
  for (const g of LARK.glow) g.m.emissiveIntensity = g.kind === 'canvas' ? 0.02 + n * 0.1 : g.kind === 'gem' ? 0.45 + n * 0.3 + Math.sin(DOCK.t * 2.4) * 0.08 : g.kind === 'parts' ? 0.3 + n * 1.0 : 0.25 + n * 0.7;
}
