// ===================================================================== MAIN
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.zoomToCursor = true;
const VIEW = { mode: 'town', tween: null };
const kcontrols = new OrbitControls(kcam, canvas);
kcontrols.enabled = false; kcontrols.enableDamping = true; kcontrols.dampingFactor = 0.08; kcontrols.screenSpacePanning = true; kcontrols.zoomToCursor = true;
kcontrols.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
kcontrols.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
kcontrols.minAzimuthAngle = -0.5; kcontrols.maxAzimuthAngle = 0.5; kcontrols.minPolarAngle = 1.15; kcontrols.maxPolarAngle = 1.85;
function viewLimits(mode) {
  if (mode === 'build') { controls.minDistance = 30; controls.maxDistance = 170; controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.1; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; return; }
  if (mode === 'town') { controls.minDistance = 12; controls.maxDistance = 150; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.32; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; }
  else { controls.minDistance = 14; controls.maxDistance = 110; controls.minPolarAngle = 1.2; controls.maxPolarAngle = 1.75; controls.minAzimuthAngle = -0.75; controls.maxAzimuthAngle = 0.75; }
}
function setView(mode) {
  VIEW.mode = mode;
  $('#v-town').setAttribute('aria-pressed', mode === 'town'); $('#v-mine').setAttribute('aria-pressed', mode === 'mine'); $('#v-keep').setAttribute('aria-pressed', mode === 'keep');
  kcontrols.enabled = mode === 'keep'; controls.enabled = mode !== 'keep';
  if (mode === 'keep') { FOLLOW.v = null; VIEW.tween = null; buildInterior(); frameKeep(true); return; }
  const portrait = innerHeight > innerWidth;
  const to = mode === 'town'
    ? { t: new THREE.Vector3(0, 0, 6), p: new THREE.Vector3(34, 54, portrait ? 104 : 84) }
    : (TOWN.b.head && TOWN.b.head.level >= 2)
      ? { t: new THREE.Vector3(portrait ? 14 : 8, -12.5, 34), p: new THREE.Vector3(portrait ? 14 : 8, -9, portrait ? 96 : 76) }
      // the deep seam still sealed: frame the upper gallery and the shaft
      : { t: new THREE.Vector3(portrait ? 20 : 16, -6.5, 34), p: new THREE.Vector3(portrait ? 20 : 16, -3.5, portrait ? 84 : 62) };
  viewLimits('free');
  controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
  VIEW.tween = { t: 0, ft: controls.target.clone(), fp: camera.position.clone(), tt: to.t, tp: to.p, mode };
}
function focusOn(p) { const off = camera.position.clone().sub(controls.target); const dist = Math.min(off.length(), 40); off.setLength(dist); VIEW.tween = { t: 0, ft: controls.target.clone(), fp: camera.position.clone(), tt: new THREE.Vector3(p.x, Math.min(0, p.y), p.z), tp: new THREE.Vector3(p.x, Math.min(0, p.y), p.z).add(off), mode: VIEW.mode }; }
function updateCamera(dt) {
  if (VIEW.mode === 'keep') {
    const t = kcontrols.target, before = t.clone();
    t.x = clamp(t.x, -KW / 2 - 2, KW / 2 + 2); t.y = clamp(t.y, 1, KEEPV.H + 3); t.z = clamp(t.z, -2, 2);
    kcam.position.add(t.clone().sub(before)); kcontrols.update(); return;
  }
  const T = VIEW.tween;
  if (T) {
    T.t = Math.min(1, T.t + dt / 1.2); const k = smooth(0, 1, T.t);
    controls.target.lerpVectors(T.ft, T.tt, k); camera.position.lerpVectors(T.fp, T.tp, k);
    if (T.t >= 1) { VIEW.tween = null; viewLimits(T.mode); }
  } else if (FOLLOW.v && !FOLLOW.v.hidden) {
    const v = FOLLOW.v, d = new THREE.Vector3(v.pos.x, v.where === 'mine' ? v.pos.y + 1 : 0, v.pos.z).sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
    controls.target.add(d); camera.position.add(d);
  }
  // keep the view over the claim
  const t = controls.target, before = t.clone();
  if (VIEW.mode === 'town') { t.x = clamp(t.x, -46, 46); t.z = clamp(t.z, -52, 38); t.y = clamp(t.y, -2, 6); }
  else { t.x = clamp(t.x, -24, 36); t.y = clamp(t.y, -26, 2); t.z = clamp(t.z, 30, 40); }
  camera.position.add(t.clone().sub(before));
  controls.update();
}

// ----------------------------------------------------------------- picking
const ray = new THREE.Raycaster(); ray.camera = camera;
const ndc = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; AUDIO.start(); });
canvas.addEventListener('pointerup', e => {
  if (!downAt || (SKY && SKY.on)) { downAt = null; return; }
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y), dt = performance.now() - downAt.t; downAt = null;
  if (moved > 8 || dt > 600) return;
  if (BUILD.on) { selectInBuild(pickBuildingAt(e.clientX, e.clientY)); return; }
  if (VIEW.mode === 'keep') { pickKeep(e.clientX, e.clientY); return; }
  pick(e.clientX, e.clientY);
});
function pick(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // people first: a generous hit area around each sprite
  let bestV = null, bd = 1e9;
  for (const v of GAME.villagers) {
    if (v.hidden) continue;
    const c = v.pos.clone().add(new THREE.Vector3(0, 1, 0)), dist = ray.ray.distanceToPoint(c), along = c.clone().sub(ray.ray.origin).length();
    const tol = 0.9 + along * 0.008;
    if (dist < tol && along < bd) { bd = along; bestV = v; }
  }
  const objs = [...Object.values(TOWN.b).map(b => b.group), TOWN.ship.ship, DOCK.b && DOCK.b.group, DOCK.ship && DOCK.ship.root.parent === scene && DOCK.ship.root, ...Object.values(WALL.mesh), scene.getObjectByName('ground'), scene.getObjectByName('face')].filter(Boolean);
  const hits = ray.intersectObjects(objs, true).filter(h => h.object.visible);
  const h = hits[0];
  if (bestV && (!h || bd < h.distance + 1.5)) { selectVillager(bestV); return; }
  if (!h) { UI.close(); FOLLOW.v = null; return; }
  let o = h.object;
  if (Object.values(WALL.mesh).includes(o)) return selectBuilding(WALLB);
  while (o) { if (o.userData.building) return selectBuilding(o.userData.building); if (o.userData.ship || o === TOWN.ship.ship) return selectBuilding(TOWN.b.mast); if (o.userData.dock) return selectBuilding(DOCK.b); o = o.parent; }
  if (h.object.name === 'face' || (h.point.z > 30 && h.point.y < -1)) return selectBuilding(TOWN.b.head);
  UI.close(); FOLLOW.v = null;
}
function selectVillager(v) { SEL.villager = v; SEL.building = null; UI.open('villager', v); }
function selectBuilding(b) { SEL.building = b; SEL.villager = null; FOLLOW.v = null; if (b === DOCK.b) { UI.open('dock'); return; } UI.open('building', b); }

// ----------------------------------------------------------------- build mode: the grid, the tray, drag to move
// Time stops while you plan. Drag any building (except the headframe) and it snaps to the 2 m tiles;
// its pad shows green where it fits and red where it doesn't. Let go somewhere red and it goes back.
// Bought buildings wait on ✓ / ✕ before the shards are spent; the starting kit is free and drops straight in.
const BICON = {
  keep: '<path d="M14 40V16h4v-5h5v5h8v-5h5v5h4v24z" fill="#b9ad98" stroke="#2a1b2f" stroke-width="2"/><path d="M22 40V30a5 5 0 0 1 10 0v10z" fill="#6a432a" stroke="#2a1b2f" stroke-width="2"/><path d="M14 16 27 6l13 10" fill="#4b5560" stroke="#2a1b2f" stroke-width="2"/>',
  yard: '<rect x="5" y="14" width="44" height="24" rx="3" fill="#d8cbb0" stroke="#2a1b2f" stroke-width="2"/><g fill="#c99a3c" stroke="#2a1b2f" stroke-width="1.6"><rect x="9" y="18" width="36" height="5"/><rect x="9" y="26" width="36" height="5"/></g><g fill="#ffb347"><path d="m14 17 2 3-2 3-2-3z"/><path d="m24 25 2 3-2 3-2-3z"/><path d="m34 17 2 3-2 3-2-3z"/><path d="m40 25 2 3-2 3-2-3z"/></g>',
  garden: '<path d="M7 34a20 20 0 0 1 40 0z" fill="#bfe6e2" fill-opacity=".7" stroke="#2a1b2f" stroke-width="2"/><path d="M17 34a10 14 0 0 1 20 0M27 15v19" fill="none" stroke="#b5832a" stroke-width="1.6"/><rect x="5" y="34" width="44" height="5" rx="1" fill="#6a432a" stroke="#2a1b2f" stroke-width="2"/><circle cx="16" cy="30" r="3" fill="#6f9a44"/><circle cx="38" cy="30" r="3" fill="#6f9a44"/>',
  shop: '<path d="M10 40V20h34v20z" fill="#e6dcc6" stroke="#2a1b2f" stroke-width="2"/><path d="M7 21 27 8l20 13" fill="#4b5560" stroke="#2a1b2f" stroke-width="2"/><circle cx="19" cy="29" r="5" fill="#2a2433" stroke="#c99a3c" stroke-width="2"/><rect x="29" y="27" width="8" height="13" fill="#8a5a34" stroke="#2a1b2f" stroke-width="1.6"/>',
  lens: '<path d="M19 41V18h16v23z" fill="#b9ad98" stroke="#2a1b2f" stroke-width="2"/><rect x="16" y="15" width="22" height="4" fill="#d8cbb0" stroke="#2a1b2f" stroke-width="1.6"/><circle cx="27" cy="9" r="6" fill="#d8f4f0" stroke="#c99a3c" stroke-width="2.4"/><path d="M27 9 46 4" stroke="#ffcf85" stroke-width="2"/>',
  ballista: '<path d="M10 40h34l-4-8H14z" fill="#d8cbb0" stroke="#2a1b2f" stroke-width="2"/><path d="M12 22c8-10 22-10 30 0" fill="none" stroke="#7d8590" stroke-width="3"/><path d="M12 22 27 30l15-8" fill="none" stroke="#cdb48a" stroke-width="1.4"/><rect x="25" y="12" width="4" height="22" fill="#8a5a34" stroke="#2a1b2f" stroke-width="1.6"/><circle cx="27" cy="32" r="3" fill="#c99a3c" stroke="#2a1b2f" stroke-width="1.4"/>',
  mast: '<path d="M18 42 23 8h8l5 34" fill="none" stroke="#8a5a34" stroke-width="3"/><path d="M20 30h14M21 20h12" stroke="#5a3a26" stroke-width="2"/><rect x="20" y="5" width="14" height="4" fill="#c99a3c" stroke="#2a1b2f" stroke-width="1.6"/>',
};
const bIcon = t => `<svg viewBox="0 0 54 44" aria-hidden="true">${BICON[t] || ''}</svg>`;
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _gp = new THREE.Vector3();
function groundAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(_plane, _gp) ? _gp.clone() : null; }
function buildBlockedReason() {
  if (WL.list.some(f => !f.dead)) return 'Wildlight are on the plateau. Rearrange the claim once they’re gone.';
  if (GAME.t > 0.64 && GAME.t < 0.97 && BUILD.setupDone) return 'It’s getting dark. Rearrange the claim by day.';
  return null;
}
function enterBuild(sel = null, setup = false) {
  const why = buildBlockedReason(); if (why && !setup) { toast(why, 'night'); return; }
  kcontrols.enabled = false; controls.enabled = true; $('#v-keep').setAttribute('aria-pressed', false);
  BUILD.on = true; BUILD.sel = null; UI.close(); FOLLOW.v = null;
  $('.bottombar').hidden = true; $('#buildbar').hidden = false;
  gridOverlay.visible = true;
  for (const b of Object.values(TOWN.b)) if (b.pad) { b.pad.visible = true; padColor(b, 'idle'); }
  if (sel && sel.tile) selectInBuild(sel);
  $('#bb-title').textContent = setup ? 'Lay out your claim' : 'Build';
  $('#bb-sub').textContent = setup ? 'Tap a card to drop it in, then drag buildings where you want them. The kit is free; turrets cost shards. You can rearrange any time by day.'
    : 'Drag a building to move it. Tap a card to add one. Time stops while you plan.';
  $('#bb-done').textContent = setup ? 'Start day one' : 'Done';
  renderTray();
  // look down on the claim, a little more from above, like a Clash base
  const portrait = innerHeight > innerWidth, t = sel && sel.tile ? new THREE.Vector3(sel.L.x, 0, sel.L.z) : new THREE.Vector3(0, 0, 0);
  VIEW.mode = 'town'; $('#v-town').setAttribute('aria-pressed', true); $('#v-mine').setAttribute('aria-pressed', false);
  viewLimits('build'); controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.minDistance = 1; controls.maxDistance = 1000;
  VIEW.tween = { t: 0, ft: controls.target.clone(), fp: camera.position.clone(), tt: t, tp: t.clone().add(new THREE.Vector3(18, portrait ? 118 : 86, portrait ? 64 : 52)), mode: 'build' };
  AUDIO.play('open');
}
function exitBuild() {
  if (BUILD.pending) cancelPending();
  if (BUILD.drag) endDrag(null);
  BUILD.on = false; selectInBuild(null);
  $('.bottombar').hidden = false; $('#buildbar').hidden = true; $('#placectl').hidden = true;
  gridOverlay.visible = false;
  for (const b of Object.values(TOWN.b)) if (b.pad) b.pad.visible = false;
  layoutChanged(true);
  // people standing where a building now is step out of the way; tower crews follow their tower
  for (const v of GAME.villagers) {
    if (v.d.exp || v.hidden && v.where !== 'tower') continue;
    if (v.where === 'tower' && v.towerB) { const S = stationFor(v); if (S && S.pos) v.place(S.pos.x, S.pos.y, S.pos.z); continue; }
    if (v.where !== 'surface') continue;
    const [ix, iz] = cellIx(v.pos.x, v.pos.z);
    if (!inGrid(ix, iz) || NAV.cost[iz * NAV.GX + ix] <= 0) { const o = nearestOpen(ix, iz, 12); if (o) { const [x, z] = cellC(...o); v.place(x, 0, z); } }
  }
  for (const v of GAME.villagers) { v.replan = true; if (!v.d.exp) v.plan = []; }
  if (!BUILD.setupDone) { BUILD.setupDone = true; setTimeout(() => toast('Morning on the claim. <b>Tap a person</b> to see what they are good at.'), 600); }
  viewLimits('town'); setView('town');
  saveGame(); UI.refresh();
}
function layoutChanged(full) {
  repaintGround(); updateClumps();
  if (full) { buildNav(); autoAssign(); WL.flowT = 0; }
}
function selectInBuild(b) {
  if (BUILD.sel && BUILD.sel.pad) padColor(BUILD.sel, 'idle');
  BUILD.sel = b; if (b && b.pad) padColor(b, 'sel');
}
function renderTray() {
  const tray = $('#tray'); tray.innerHTML = '';
  const lv = TOWN.b.keep.level;
  for (const t of BUILD_ORDER) {
    const have = countType(t), cap = KEEP_LIMITS[t][lv], kit = BUILD.kit[t] || 0, cost = BUY[t];
    const full = have >= cap, poor = !kit && GAME.shards < cost;
    const el = document.createElement('button'); el.type = 'button'; el.className = 'tcard' + (kit ? ' kit' : ''); el.setAttribute('role', 'listitem');
    if (full || poor || BUILD.pending) el.setAttribute('aria-disabled', 'true');
    el.innerHTML = `${bIcon(t)}<span class="tn">${esc(DEFS[t].name)}</span><span class="tc">${have}/${cap}${full && lv < 3 ? ' · Keep ' + (lv + 1) : ''}</span>${kit ? `<span class="tp free">Free ×${kit}</span>` : `<span class="tp">${SHARD} ${cost}</span>`}`;
    el.onclick = () => trayPick(t);
    tray.append(el);
  }
}
function trayPick(t) {
  if (BUILD.pending) { toast('Place or cancel the one you’re holding first.'); return; }
  const lv = TOWN.b.keep.level, cap = KEEP_LIMITS[t][lv];
  if (countType(t) >= cap) { toast(lv < 3 ? `The Keep allows ${cap} ${DEFS[t].name}${cap === 1 ? '' : 's'}. Raise it to level ${lv + 1} for more.` : `That’s as many as the claim can hold.`); return; }
  const kit = BUILD.kit[t] || 0;
  if (!kit && GAME.shards < BUY[t]) { toast(`A ${DEFS[t].name} costs ${BUY[t]} shards. You have ${Math.floor(GAME.shards)}.`); return; }
  const at = controls.target, b = addBuilding(t, null, null, 1, { hint: [at.x, at.z] });
  if (!b) { toast('There’s no room left on the grid for that.'); return; }
  b.pad.visible = true; nameBuildings();
  if (kit) {
    BUILD.kit[t] = kit - 1;
    b.show(0); b.build(1, () => { buildNav(); UI.refresh(); });
    AUDIO.play('place'); selectInBuild(b); layoutChanged(false); autoAssign();
  } else {
    b.pending = true; BUILD.pending = b; selectInBuild(b);
    b.show(1); setGhost(b, true);
    AUDIO.play('lift');
  }
  renderTray();
}
// a building waiting on ✓ is drawn see-through
function setGhost(b, on) {
  b.group.traverse(o => { if (!o.isMesh) return; if (on) { if (!o.userData.realMat) { o.userData.realMat = o.material; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; } } else if (o.userData.realMat) { o.material.dispose(); o.material = o.userData.realMat; delete o.userData.realMat; } });
}
function confirmPending() {
  const b = BUILD.pending; if (!b) return;
  const cost = BUY[b.type];
  if (GAME.shards < cost) { toast('Not enough shards.'); return; }
  if (!canPlace(b.type, b.tile.tx, b.tile.tz, b)) { toast('It doesn’t fit there. Drag it somewhere green.'); return; }
  GAME.shards -= cost; b.pending = false; BUILD.pending = null; setGhost(b, false);
  b.show(0); b.build(1, () => { buildNav(); toast(`The new <b>${esc(b.name)}</b> is finished.`); autoAssign(); UI.refresh(); });
  $('#placectl').hidden = true; layoutChanged(false); renderTray(); AUDIO.play('place');
}
function cancelPending() {
  const b = BUILD.pending; if (!b) return;
  BUILD.pending = null; BUILD.sel = null; setGhost(b, false); removeBuilding(b);
  $('#placectl').hidden = true; layoutChanged(false); renderTray();
}
// ---- dragging
function pickBuildingAt(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const objs = Object.values(TOWN.b).flatMap(b => b.pad ? [b.group, b.pad] : [b.group]).concat([TOWN.ship.ship]);
  for (const h of ray.intersectObjects(objs, true)) { for (let o = h.object; o; o = o.parent) { if (o.userData.building) return o.userData.building; if (o.userData.ship || o === TOWN.ship.ship) return TOWN.b.mast; } }
  return null;
}
function startDrag(e) {
  const b = pickBuildingAt(e.clientX, e.clientY);
  if (!b || !b.tile || b.building) { if (b && b.building) toast('Wait for the builders to finish.'); return false; }
  const p = groundAt(e.clientX, e.clientY); if (!p) return false;
  const [cx, cz] = footCenter(b);
  BUILD.drag = { b, id: e.pointerId, ox: p.x - cx, oz: p.z - cz, from: { ...b.tile }, moved: false, x0: e.clientX, y0: e.clientY };
  controls.enabled = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
  selectInBuild(b); padColor(b, 'ok');
  return true;
}
function moveDrag(e) {
  const Dg = BUILD.drag; if (!Dg || e.pointerId !== Dg.id) return;
  if (!Dg.moved && Math.hypot(e.clientX - Dg.x0, e.clientY - Dg.y0) < 6) return;
  if (!Dg.moved) { Dg.moved = true; AUDIO.play('lift'); }
  const p = groundAt(e.clientX, e.clientY); if (!p) return;
  const [tx, tz] = snapTile(Dg.b.type, p.x - Dg.ox, p.z - Dg.oz), F = FOOT[Dg.b.type];
  const cx = clamp(tx, -1, GRID.NX - F.w + 1), cz = clamp(tz, -1, GRID.NZ - F.d + 1);
  if (cx !== Dg.b.tile.tx || cz !== Dg.b.tile.tz) { setTile(Dg.b, cx, cz); Dg.ok = canPlace(Dg.b.type, cx, cz, Dg.b); padColor(Dg.b, Dg.ok ? 'ok' : 'bad'); }
}
function endDrag(e) {
  const Dg = BUILD.drag; if (!Dg || (e && e.pointerId !== Dg.id)) return;
  BUILD.drag = null; controls.enabled = true;
  const b = Dg.b;
  if (!canPlace(b.type, b.tile.tx, b.tile.tz, b)) {
    if (Dg.from.tx !== b.tile.tx || Dg.from.tz !== b.tile.tz) { setTile(b, Dg.from.tx, Dg.from.tz); toast('That spot’s taken or off the grid, so it went back.'); }
  } else if (Dg.moved) AUDIO.play('place');
  padColor(b, 'sel');
  if (Dg.moved) layoutChanged(false);
}
canvas.addEventListener('pointerdown', e => {
  if (!BUILD.on || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if (startDrag(e)) { e.stopImmediatePropagation(); e.preventDefault(); }
  else { downAt = { x: e.clientX, y: e.clientY, t: performance.now(), build: true }; }
}, { capture: true });
canvas.addEventListener('pointermove', e => { if (BUILD.drag) { moveDrag(e); e.stopImmediatePropagation(); } }, { capture: true });
canvas.addEventListener('pointerup', e => { if (BUILD.drag) { endDrag(e); e.stopImmediatePropagation(); downAt = null; } }, { capture: true });
canvas.addEventListener('pointercancel', e => { if (BUILD.drag) endDrag(e); }, { capture: true });
$('#bb-done').onclick = () => exitBuild();
$('#pc-ok').onclick = () => confirmPending();
$('#pc-no').onclick = () => cancelPending();
// the ✓ / ✕ buttons float over the building you're placing
const _pcv = new THREE.Vector3();
function updatePlaceCtl() {
  const b = BUILD.pending, el = $('#placectl');
  if (!b) { if (!el.hidden) el.hidden = true; return; }
  const h = { lens: 9, keep: 12, mast: 16, shop: 7, garden: 4, yard: 3, ballista: 3 }[b.type] || 4;
  _pcv.set(b.L.x, h, b.L.z).project(camera);
  el.hidden = false;
  el.style.transform = `translate(${(_pcv.x * 0.5 + 0.5) * innerWidth}px, ${(-_pcv.y * 0.5 + 0.5) * innerHeight - 8}px) translate(-50%, -100%)`;
  const ok = canPlace(b.type, b.tile.tx, b.tile.tz, b), cost = BUY[b.type];
  $('#pc-ok').disabled = !ok || GAME.shards < cost;
  $('#pc-cost').innerHTML = ok ? `${SHARD} ${cost}` : 'Drag to a green spot';
  if (!BUILD.drag) padColor(b, ok ? 'sel' : 'bad');
}

// ----------------------------------------------------------------- buttons
$('#panel-x').onclick = () => { UI.close(); FOLLOW.v = null; };
$('#v-town').onclick = () => { FOLLOW.v = null; setView('town'); };
$('#v-mine').onclick = () => { FOLLOW.v = null; setView('mine'); };
$('#v-keep').onclick = () => setView('keep');
$('#v-sky').onclick = () => { FOLLOW.v = null; if (VIEW.mode !== 'town') setView('town'); dockView(); };
// the Sky Dock: the camera swings round to the ship at the bridge, and the Dock's panel opens
function dockView() {
  const D = LAYOUT.dock, portrait = innerHeight > innerWidth, wide = innerWidth >= 900, s = DOCK.ship, L = s ? s.recipe.length : 10;
  const tt = s ? dockBerth(s).pos.add(new THREE.Vector3(0, 2, 0)) : new THREE.Vector3(D.x, 5, D.z - 10);
  const dist = 24 + L * 0.9, dir = new THREE.Vector3(0.45, 0.42, 0.79).normalize();
  if (wide) tt.add(new THREE.Vector3(0.87, 0, -0.49).multiplyScalar(dist * 0.2));   // the panel's on the right: she sits left of middle
  if (portrait) tt.y -= dist * 0.18;                                                // the panel's below: she sits high
  const tp = tt.clone().addScaledVector(dir, portrait ? dist * 1.45 : dist);
  viewLimits('free'); controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
  VIEW.tween = { t: 0, ft: controls.target.clone(), fp: camera.position.clone(), tt, tp, mode: 'town' };
  UI.open('dock');
}
for (const b of document.querySelectorAll('#spd-seg button')) b.onclick = () => { GAME.speed = +b.dataset.s; $('#b-speed').textContent = GAME.speed + '×'; syncMenu(); };
$('#b-people').onclick = () => UI.cur && UI.cur.kind === 'roster' ? UI.close() : UI.open('roster');
$('#b-build').onclick = () => enterBuild();
$('#b-speed').onclick = () => { GAME.speed = GAME.speed === 1 ? 2 : GAME.speed === 2 ? 4 : 1; $('#b-speed').textContent = GAME.speed + '×'; };
$('#b-pause').onclick = () => { GAME.paused = !GAME.paused; $('#b-pause').classList.toggle('paused', GAME.paused); $('#b-pause').setAttribute('aria-label', GAME.paused ? 'Resume' : 'Pause'); };
$('#b-menu').onclick = () => { $('#menu').hidden = false; syncMenu(); };
$('#menu-close').onclick = () => { $('#menu').hidden = true; $('#reset-confirm').hidden = true; };
function syncMenu() { for (const b of document.querySelectorAll('#q-seg button')) b.setAttribute('aria-pressed', b.dataset.q === QUALITY.level); for (const b of document.querySelectorAll('#spd-seg button')) b.setAttribute('aria-pressed', +b.dataset.s === GAME.speed); $('#b-sound').textContent = AUDIO.on ? 'On' : 'Off'; $('#b-sound').setAttribute('aria-pressed', AUDIO.on); }
for (const b of document.querySelectorAll('#q-seg button')) b.onclick = () => { QUALITY.level = b.dataset.q; try { localStorage.setItem('bv-quality', QUALITY.level); } catch (e) { } applyQuality(); syncMenu(); };
$('#b-sound').onclick = () => { AUDIO.start(); AUDIO.set(!AUDIO.on); syncMenu(); };
$('#b-help').onclick = () => { $('#menu').hidden = true; $('#intro').hidden = false; $('#b-start').textContent = 'Back to the claim'; $('#b-continue').hidden = true; INTRO_HELP = true; };
$('#b-reset').onclick = () => { $('#reset-confirm').hidden = false; };
$('#reset-no').onclick = () => { $('#reset-confirm').hidden = true; };
$('#reset-yes').onclick = () => { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(OLD_SAVE_KEY); } catch (e) { } location.reload(); };
let INTRO_HELP = false;
addEventListener('keydown', e => { if (SKY && SKY.on) return; if (e.key === 'Escape') { if (!$('#menu').hidden) $('#menu').hidden = true; else if (BUILD.on && BUILD.pending) cancelPending(); else if (BUILD.on) exitBuild(); else UI.close(); } if (e.key === ' ' && e.target === document.body) { e.preventDefault(); $('#b-pause').click(); } });

// ----------------------------------------------------------------- saving
const SAVE_KEY = 'brightvein-keep-v1', OLD_SAVE_KEY = 'brightvein-keep-none';
function saveGame() {
  try {
    const s = {
      v: 2, day: GAME.day, t: GAME.t, ore: GAME.ore, shards: GAME.shards, food: GAME.food, recruit: GAME.recruit, nights: GAME.nights, nextId: GAME.nextId,
      wall: TOWN.wallLevel, kit: BUILD.kit, setupDone: BUILD.setupDone,
      buildings: Object.values(TOWN.b).filter(b => !b.pending).map(b => ({ id: b.id, type: b.type, level: b.level, tx: b.tile ? b.tile.tx : null, tz: b.tile ? b.tile.tz : null })),
      stash: GAME.stash, mats: GAME.mats, cells: GAME.cells, blueprints: GAME.blueprints, rooms: GAME.rooms, savedAt: Date.now(),
      people: GAME.villagers.map(v => ({ ...v.d })),
      sky: FLEET ? FLEET.data : undefined,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch (e) { }
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) return s; } catch (e) { }
  try { const s = JSON.parse(localStorage.getItem(OLD_SAVE_KEY)); if (s && s.v === 1) return migrateV1(s); } catch (e) { }
  return null;
}
// A claim from before the grid: keep the people, stores and building levels; set each building down
// on the grid as near as it will go to where it stood. Bunkhouses fold into the Keep.
function migrateV1(s) {
  const L = s.levels || {}, list = [], ids = {};
  const put = (oldId, type, level) => { const id = type === 'keep' || type === 'mast' ? type : type + (list.filter(x => x.type === type).length + 1); ids[oldId] = id; list.push({ id, type, level: level || 1, hint: OLD_LAYOUT[oldId] || [0, 0] }); };
  put('hall', 'keep', L.hall); list.push({ id: 'head', type: 'head', level: L.head || 1 }); ids.head = 'head';
  for (const k of ['yardA', 'yardB', 'shop', 'garden', 'lens1', 'lens2']) put(k, { yardA: 'yard', yardB: 'yard', shop: 'shop', garden: 'garden', lens1: 'lens', lens2: 'lens' }[k], L[k]);
  put('mast', 'mast', 1);
  let refund = 0;
  for (const [pid, p] of Object.entries(s.plots || {})) { if (p.type === 'bunk') { refund += 60; continue; } put(pid, p.type, p.level); ids[pid + '_' + p.type] = ids[pid]; }
  const pop = (s.people || []).length, keep = list.find(x => x.type === 'keep');
  while (keep.level < 3 && DEFS.keep.beds[keep.level] < pop) keep.level++;
  for (const d of s.people || []) {
    d.home = 'keep'; d.gear = d.gear || {};
    if (d.job) { const nb = ids[d.job.bid] || (d.job.bid === 'wall' ? 'wall' : null); d.pref = nb === 'wall' ? 'wall' : (list.find(x => x.id === nb) || {}).type || null; d.job = null; }
  }
  return { ...s, v: 2, buildings: list, shards: (s.shards || 0) + refund, kit: {}, setupDone: true, migrated: true };
}

// ----------------------------------------------------------------- the loop
const clock = { last: performance.now(), getDelta() { const n = performance.now(), d = (n - this.last) / 1000; this.last = n; return d; } };
let elapsed = 0, prevPhase = null, saveT = 15, smokeT = 0, started = false, lampNight = -1;
const _tint = new THREE.Color();
function frame() {
  const rdt = Math.min(clock.getDelta(), 0.1);
  // out in the skies: they draw instead, and the claim's time stands still until the ship is home
  if (SKY && SKY.on) { AUDIO.ambience(0.7, true); if (SKY.frame(rdt)) return; }
  elapsed += rdt;
  const gdt = started && !GAME.paused && !BUILD.on && !(SKY && SKY.on) ? rdt * GAME.speed : 0;
  if (started) {
    GAME.t += gdt / DAY_LEN;
    if (GAME.t >= 1) { GAME.t -= 1; GAME.day++; }
  }
  applyTimeOfDay(GAME.t, elapsed);
  const ph = TOD.phase;
  if (started && prevPhase && ph !== prevPhase) phaseChange(prevPhase, ph);
  prevPhase = ph;
  if (gdt > 0) {
    economy(gdt);
    // sub-step villagers at high speed so paths stay smooth
    const n = Math.ceil(gdt / 0.05), sdt = gdt / n;
    for (let i = 0; i < n; i++) for (const v of GAME.villagers) v.update(sdt);
    updateWildlight(gdt, elapsed); updateDefenders(gdt, elapsed); updateExpeditions(gdt);
    announceStudy(updateStudies(gdt));
  } else for (const v of GAME.villagers) { v.sprite.position.copy(v.pos); v.frame(0); }
  if (BUILD.on) updatePlaceCtl();
  updateRings(); updateInterior();
  if (VIEW.mode === 'keep') { buildInterior(); setInteriorLights(); }
  const now = performance.now() / 1000;
  for (const b of BUILDINGS) b.update(now, gdt || rdt * 0.25);
  FX.update(rdt * (GAME.paused ? 0.2 : Math.min(GAME.speed, 2)));
  wallUpdate(rdt); mineBreakUpdate(now);
  dressScene(rdt, gdt);
  dockUpdate(rdt); updateLife(rdt, TOD.night);
  updateCamera(rdt);
  updateHUD(rdt); updateLabels();
  AUDIO.ambience(TOD.night, !GAME.paused);
  saveT -= rdt; if (saveT <= 0 && started) { saveT = 15; saveGame(); }
  const inK = VIEW.mode === 'keep', S = inK ? KSCENE : scene, C = inK ? kcam : camera;
  if (renderPass) { renderPass.scene = S; renderPass.camera = C; }
  // the lens: a model on a table from above, gentler side-on (the mine, the Keep) and when far away
  if (lensPass) {
    const dist = camera.position.distanceTo(controls.target), side = inK || VIEW.mode === 'mine';
    lensPass.uniforms.uAmount.value = side ? 0.35 : clamp(1.25 - (dist - 25) / 110, 0.35, 1.2) * (BUILD.on ? 0.4 : 1);
    lensPass.uniforms.uFocus.value = side ? 0.5 : 0.47;
    gradePass.uniforms.uNight.value = TOD.night;
  }
  composer ? composer.render() : renderer.render(S, C);
}
function phaseChange(a, b) {
  if (b === 'dusk') { toast('Dusk. The tenders bring the crystal in, and <b>the lamps take over.</b>', 'night'); AUDIO.play('bell'); }
  if (b === 'night') startNight();
  if (a === 'night' && b === 'dawn') {
    endNight();
    // the watch mends breaches at dawn
    const br = WALL.segs.filter(s => s.broken);
    if (br.length) {
      const watch = workersOf('wall').length;
      const fix = Math.min(br.length, watch ? br.length : 0), cost = fix * 4;
      if (fix && GAME.shards >= cost) { GAME.shards -= cost; for (const s of br) { s.broken = false; s.hp = 1; } wallMatrices(); buildNav(); toast(`The watch mends ${fix} breach${fix > 1 ? 'es' : ''} for ${cost} shards.`); }
      else if (!watch) toast('Nobody is on the watch, so <b>the wall stays broken.</b>', 'night');
    }
  }
  for (const v of GAME.villagers) v.replan = true;
  UI.refresh();
}
// everything that glows, smokes or sways
function dressScene(rdt, gdt) {
  WIND.time.value = elapsed;
  const night = TOD.night, pw = POWER.on ? 1 : 0.2;
  MAT.window.emissiveIntensity = night * 1.7 * pw + 0.05;
  for (const b of BUILDINGS) for (const L of b.lights) L.light.intensity = b.level >= L.lvl ? L.power * night * pw * (L.yard ? 0.4 + (b.chargeK || 0) : 1) : 0;
  const keep = TOWN.b.keep; if (keep && keep.beaconMat) keep.beaconMat.emissiveIntensity = 1.4 + night * 3 * pw + Math.sin(elapsed * 1.5) * 0.3;
  MAT.crystal.emissiveIntensity = 0.9 + night * 1.2 * pw;
  for (const b of BUILDINGS) if (b.type === 'yard' && b.crystalMat) {
    b.drainK = Math.max(0, (b.drainK || 0) - rdt);
    const glow = 0.12 + (b.chargeK || 0) * 0.55 + night * 1.2 * pw - b.drainK * 0.6 + (b.drainK ? Math.random() * 0.4 : 0);
    b.crystalMat.emissiveIntensity = lerp(b.crystalMat.emissiveIntensity, glow, Math.min(1, rdt * 4));
    if ((b.chargeK || 0) > 0.25 && gdt && Math.random() < rdt * 9) FX.mote(b.worldPos((Math.random() - 0.5) * 8, 0.9, (Math.random() - 0.5) * 6));
  }
  const nk = Math.round(night * 20) / 20 + (POWER.on ? 0 : 7) + DECOR.lamps.filter(l => !l.lit).length * 13;
  if (nk !== lampNight) { lampNight = nk; setLampColors(night); }
  for (const L of mineDecor.lights) L.intensity = 26 * (POWER.on ? 1 : 0.35);
  worldMats.mineGlow.emissiveIntensity = 2.2 * (POWER.on ? 1 : 0.3);
  worldMats.mineCrystal.emissiveIntensity = 1.3 + Math.sin(elapsed * 1.3) * 0.25;
  if (worldMats.faceCrystal) worldMats.faceCrystal.emissiveIntensity = 0.9 + night * 1.1 + Math.sin(elapsed * 1.1 + 2) * 0.2;
  if (mineDecor.seam) for (const m of mineDecor.seam.children) m.material.opacity = 0.6 + Math.sin(elapsed * 3 + m.position.y) * 0.3 + (WL.night && WL.night.deep ? 0.3 : 0);
  faceMat.emissiveIntensity = 0.22 + night * 0.5;
  // the lift cage rides up and down the shaft
  const cy = lerp(MINE.g1.y0 + 0.06, -2.2, (Math.sin(elapsed * 0.35) + 1) / 2);
  mineDecor.cage.position.y = cy; mineDecor.rope.position.y = (cy + 2.1 - 0.3) / 2; mineDecor.rope.scale.y = Math.max(0.1, -0.3 - (cy + 2.1));
  // chimney smoke
  smokeT -= rdt;
  if (smokeT <= 0) { smokeT = 0.28; for (const b of BUILDINGS) { for (const p of b.smoke) if (Math.random() < 0.7) FX.smoke(p); if (b.smoke2 && b.level >= 2 && b.busy) FX.smoke(b.smoke2, 0x8a8a8a); } }
  // people take on the light around them
  const dayTint = _tint.setRGB(lerp(1, 0.42, night), lerp(1, 0.46, night), lerp(1, 0.7, night));
  for (const v of GAME.villagers) {
    if (v.hidden) continue;
    let r = dayTint.r, g = dayTint.g, bl = dayTint.b;
    if (v.where === 'mine') { r = 0.92; g = 0.78; bl = 0.62; }
    else if (night > 0.2) {
      let near = 99; for (const L of DECOR.lamps) { if (!L.lit || !POWER.on) continue; const d = Math.hypot(L.x - v.pos.x, L.z - v.pos.z); if (d < near) near = d; }
      const k = clamp(1 - near / 7, 0, 1) * night; r += 0.55 * k; g += 0.32 * k; bl += 0.08 * k;
    }
    v.mat.color.setRGB(Math.min(1, r), Math.min(1, g), Math.min(1, bl));
  }
  // cloud puffs drift
  for (const s of scene.children) if (s.isSprite && s.userData.r) { s.userData.ang += rdt * 0.004; s.position.x = Math.cos(s.userData.ang) * s.userData.r; s.position.z = Math.sin(s.userData.ang) * s.userData.r * 0.85 + 2; }
  if (DECOR.sundial) DECOR.sundial.children[DECOR.sundial.children.length - 1].rotation.y += rdt * 0.6;
}

// ----------------------------------------------------------------- boot
async function boot() {
  const save = loadSave();
  await loadAssets();
  applyQuality();
  buildPlateau(); buildSky(); buildClouds(); buildPeaks();
  setupTown(save);
  setupDock(save);
  setupLife();
  fixEnv(scene);
  if (save) { TOWN.wallLevel = save.wall || 1; wallSetLevel(TOWN.wallLevel, false); }
  buildNav();
  if (save) {
    Object.assign(GAME, { day: save.day, t: save.t, ore: save.ore, shards: save.shards, food: save.food, recruit: save.recruit, nights: save.nights, nextId: save.nextId,
      stash: save.stash || [], mats: { brass: 0, glass: 0, heartstone: 0, ...(save.mats || {}) }, cells: save.cells || {}, blueprints: save.blueprints || [] });
    if (save.rooms) save.rooms.forEach((r, i) => { if (GAME.rooms[i]) GAME.rooms[i] = { type: r.type || null, level: r.level || 0 }; });
    BUILD.kit = { ...(save.kit || {}) }; BUILD.setupDone = save.setupDone !== false;
    if (!save.stash) starterStash();
    for (const d of save.people) {
      d.gear = d.gear || {}; d.home = 'keep';
      if (d.exp && d.exp.state === 'arriving') { d.exp.state = 'back'; d.exp.ret = 0; }
      const v = addVillager(d); v.redraw();
      if (d.exp && d.exp.state !== 'leaving') { v.setHidden(true); v.where = 'wilds'; }
      else if (d.study) { v.setHidden(true); v.where = 'study'; v.plan = [{ type: 'study' }]; }
    }
    autoAssign();
    if (save.savedAt) GAME.away = catchUp((Date.now() - save.savedAt) / 1000);
    if (save.migrated) setTimeout(() => toast('Your claim is on the new build grid. Everyone lives in <b>the Keep</b> now. Tap <b>Build</b> to rearrange.'), 2500);
  } else { starterStash(); seedVillagers(); }
  for (const v of GAME.villagers) { const S = stationFor(v); if (S && S.kind === 'surface') v.place(S.pos.x + (Math.random() - 0.5), 0, S.pos.z + (Math.random() - 0.5)); }
  applyTimeOfDay(GAME.t, 0);
  prevPhase = TOD.phase;
  addEventListener('resize', resize); resize();
  camera.position.set(60, 70, 120); controls.target.set(0, 0, 4); viewLimits('town');
  setView('town');
  renderer.setAnimationLoop(frame);
  $('#loading').hidden = true;
  if (save) { $('#b-continue').hidden = false; $('#b-start').textContent = 'Start a new claim'; }
  addEventListener('visibilitychange', () => { if (document.hidden && started) saveGame(); });
}
function begin(fresh) {
  AUDIO.start();
  if (INTRO_HELP) { $('#intro').hidden = true; INTRO_HELP = false; return; }
  if (fresh && loadSave()) { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(OLD_SAVE_KEY); } catch (e) { } location.reload(); return; }
  $('#intro').hidden = true; started = true;
  if (!BUILD.setupDone) { enterBuild(null, true); return; }
  if (GAME.away && (GAME.away.lines.length || GAME.away.sec > 300)) { const A = GAME.away; setTimeout(() => UI.open('away', A), 400); }
  GAME.away = null;
  const hint = $('#hint');
  hint.textContent = matchMedia('(pointer:coarse)').matches ? 'Drag to move · pinch to zoom · two fingers to turn · tap anyone' : 'Drag to move · scroll to zoom · right-drag to turn · click anyone';
  hint.hidden = false; setTimeout(() => hint.hidden = true, 7000);
}
$('#b-start').onclick = () => begin(true);
$('#b-continue').onclick = () => begin(false);
// test hook: advance the simulation without rendering
function simulate(seconds, step = 0.1) {
  for (let t = 0; t < seconds; t += step) {
    GAME.t += step / DAY_LEN; if (GAME.t >= 1) { GAME.t -= 1; GAME.day++; }
    applyTimeOfDay(GAME.t, elapsed += step);
    if (prevPhase && TOD.phase !== prevPhase) phaseChange(prevPhase, TOD.phase); prevPhase = TOD.phase;
    economy(step); for (const v of GAME.villagers) v.update(step);
    updateWildlight(step, elapsed); updateDefenders(step, elapsed); updateExpeditions(step); announceStudy(updateStudies(step));
    const now = performance.now() / 1000; for (const b of BUILDINGS) b.update(now, step);
    FX.update(step); wallUpdate(step); dressScene(step, step);
  }
}
function drawCalls() { const c = composer; composer = null; renderer.info.autoReset = true; renderer.render(scene, camera); const i = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, lights: 0 }; scene.traverse(o => { if (o.isPointLight) i.lights++; }); composer = c; return i; }
window.__bv = { get SKY() { return SKY; }, get FLEET() { return FLEET; }, DOCK, openSky, dockMoor, dockView, MAT, ENV_MATS, scene, startStudy, endStudy, buildInterior, catchUp, KEEPV, kcam, kcontrols, updateStudies, pointTime, STUDY, roomStudents, mastered, BUILD, enterBuild, exitBuild, trayPick, confirmPending, cancelPending, setTile, canPlace, addBuilding, removeBuilding, GRID, FOOT, footCenter, sendExpedition, recallExpedition, expOut, LOOT, D, equip, gearOf, fightOf, statOf, loadSave, migrateV1, DECOR, startDrag, groundAt, BEAMS, FLARES, saveGame, THREE, VIEW, FOLLOW, SEL, simulate, drawCalls, buildNav, workersOf, assignJob, stationFor, astar, GAME, TOWN, camera, controls, setView, TOD, WL, startNight, SHIP, UI, renderer, upgrade, WALLB, applyTimeOfDay, spawnWildlight, begin };
boot().catch(e => { console.error(e); $('#loading').textContent = 'The town could not be raised: ' + e.message; });
