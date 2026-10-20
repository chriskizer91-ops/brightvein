// ===================================================================== MAIN
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.zoomToCursor = true;
const VIEW = { mode: 'town', tween: null };
// the Keep view has its own pan and zoom, face on (keep.js); this keeps its target for the sound's listener
const kcontrols = { enabled: false, target: new THREE.Vector3(0, 6, 0), update() { } };
function viewLimits(mode) {
  if (mode === 'build') { controls.minDistance = 30; controls.maxDistance = 170; controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.1; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; return; }
  if (mode === 'town') { controls.minDistance = 12; controls.maxDistance = 150; controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.32; controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; }
  else { controls.minDistance = 14; controls.maxDistance = 110; controls.minPolarAngle = 1.2; controls.maxPolarAngle = 1.75; controls.minAzimuthAngle = -0.75; controls.maxAzimuthAngle = 0.75; }
}
function setView(mode) {
  VIEW.mode = mode;
  $('#v-town').setAttribute('aria-pressed', mode === 'town'); $('#v-mine').setAttribute('aria-pressed', mode === 'mine'); $('#v-keep').setAttribute('aria-pressed', mode === 'keep');
  kcontrols.enabled = mode === 'keep'; controls.enabled = mode === 'town';   // the Mine view has its own pan and zoom (mine.js)
  if (mode === 'keep') { FOLLOW.v = null; VIEW.tween = null; buildInterior(); frameKeep(true); return; }
  const portrait = innerHeight > innerWidth;
  // the Mine view looks straight at the dig, the town's rim along the top
  const to = mode === 'town' ? { t: new THREE.Vector3(0, 0, 6), p: new THREE.Vector3(34, 54, portrait ? 104 : 84) } : digView();
  viewLimits('free');
  controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
  VIEW.tween = { t: 0, ft: controls.target.clone(), fp: camera.position.clone(), tt: to.t, tp: to.p, mode };
}
function focusOn(p) { if (VIEW.mode === 'mine') { if (p.y < -1) { digFocus(p); return; } setView('town'); } const off = camera.position.clone().sub(controls.target); const dist = Math.min(off.length(), 40); off.setLength(dist); VIEW.tween = { t: 0, ft: controls.target.clone(), fp: camera.position.clone(), tt: new THREE.Vector3(p.x, Math.min(0, p.y), p.z), tp: new THREE.Vector3(p.x, Math.min(0, p.y), p.z).add(off), mode: VIEW.mode }; }
function updateCamera(dt) {
  if (VIEW.mode === 'keep') { keepCamUpdate(dt); return; }
  if (VIEW.mode === 'mine' && !VIEW.tween && !BUILD.on) { digCamUpdate(dt); return; }
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
const ray = new THREE.Raycaster(); ray.camera = camera; ray.layers.enable(PICK_LAYER);   // the buildings' own meshes, drawn merged with the town’s (townMerge in kit.js)
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
  // the dig's rooms (in the Mine view, the empty cells you could dig too)
  if (VIEW.mode === 'mine' ? pickDig(x, y) : pickDig(x, y, h ? h.distance : Infinity)) return;
  if (VIEW.mode === 'mine') { UI.close(); FOLLOW.v = null; return; }
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
  rod: '<path d="M19 41h16l-2-6H21z" fill="#b9ad98" stroke="#2a1b2f" stroke-width="2"/><path d="M27 35V9" stroke="#c46a3a" stroke-width="2.6"/><path d="m27 3-2.6 7h5.2z" fill="#c46a3a" stroke="#2a1b2f" stroke-width="1.2"/><rect x="34" y="29" width="7" height="8" rx="2" fill="#9fd8ff" stroke="#2a1b2f" stroke-width="1.6"/><path d="M37.5 29 28 19" stroke="#c99a3c" stroke-width="1.2"/><path d="m40 4-3 6h3l-2 5" fill="none" stroke="#ffe27a" stroke-width="1.6" stroke-linejoin="round"/>',
};
const bIcon = t => `<svg viewBox="0 0 54 44" aria-hidden="true">${BICON[t] || ''}</svg>`;
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _gp = new THREE.Vector3();
function groundAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(_plane, _gp) ? _gp.clone() : null; }
function buildBlockedReason() {
  if (WL.list.some(f => !f.dead && !f.mine)) return 'Wildlight are on the plateau. Rearrange the claim once they’re gone.';
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
  introClose();   // laying out is done, so the first look at how it works is too
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
  if (wide) tt.add(new THREE.Vector3(0.87, 0, -0.49).multiplyScalar(dist * 0.2));   // the panel’s on the right: she sits left of middle
  if (portrait) tt.y -= dist * 0.18;                                                // the panel’s below: she sits high
  const tp = tt.clone().addScaledVector(dir, portrait ? dist * 1.45 : dist);
  viewLimits('free'); controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
  VIEW.tween = { t: 0, ft: controls.target.clone(), fp: camera.position.clone(), tt, tp, mode: 'town' };
  UI.open('dock');
}
$('#b-people').onclick = () => UI.cur && UI.cur.kind === 'roster' ? UI.close() : UI.open('roster');
$('#b-build').onclick = () => enterBuild();
$('#b-speed').onclick = () => setSpeed(nextSpeed());   // up to the fastest allowed in Settings, then back to 1×
$('#b-pause').onclick = () => { GAME.paused = !GAME.paused; $('#b-pause').classList.toggle('paused', GAME.paused); $('#b-pause').setAttribute('aria-label', GAME.paused ? 'Resume' : 'Pause'); };
// the settings panel, its buttons and the speed limits are in settings.js
addEventListener('keydown', e => {
  if (SKY && SKY.on) return;
  if (e.defaultPrevented || (e.target.closest && e.target.closest('input,textarea'))) return;
  // Esc: skips a scene, puts away the dawn report, closes the settings, the first look, a building being placed, build
  // mode, then the panel. A day's card waits for its choice.
  if (e.key === 'Escape') {
    const dawn = document.getElementById('dawn');
    if (STORY.shown) endScene();
    else if (EVT.card) return;
    else if (!$('#menu').hidden) closeMenu();
    else if (dawn && !dawn.hidden) dawnHide();
    else if (!$('#intro').hidden && started) introClose(); else if (BUILD.on && BUILD.pending) cancelPending(); else if (BUILD.on) exitBuild(); else { UI.close(); FOLLOW.v = null; }
  }
  if (e.key === ' ' && (e.target === document.body || e.target.id === 'panel') && started && !STORY.shown) { e.preventDefault(); $('#b-pause').click(); }
});

// ----------------------------------------------------------------- saving
// into the open claim's slot (saves.js). Autosave can be turned off in Settings: then only a save asked for (force) is
// made, from Save now, going back to the title, or carrying the claim off as a code.
function saveGame(force) {
  if (leaving || (!force && !SETTINGS.autosave)) return;   // leaving: the page is opening another claim (saves.js)
  try {
    const s = {
      v: 2, name: (SLOTS.names[SLOTS.active] || '').trim() || undefined, day: GAME.day,   // a name the player gave it travels with it
      t: GAME.t, ore: GAME.ore, shards: GAME.shards, food: GAME.food, recruit: GAME.recruit, nights: GAME.nights, nextId: GAME.nextId,
      wall: TOWN.wallLevel, kit: BUILD.kit, setupDone: BUILD.setupDone,
      buildings: Object.values(TOWN.b).filter(b => !b.pending).map(b => ({ id: b.id, type: b.type, level: b.level, tx: b.tile ? b.tile.tx : null, tz: b.tile ? b.tile.tz : null })),
      stash: GAME.stash, mats: GAME.mats, cells: GAME.cells, blueprints: GAME.blueprints, rooms: GAME.rooms, savedAt: Date.now(),
      people: GAME.villagers.map(v => ({ ...v.d })),
      sky: FLEET ? FLEET.data : undefined, story: storySave(), jumpNext: JUMP.next,
      night: nightsSave(), weather: weatherSave(), dig: digSave(),
      workshop: workshopSave(),   // Odile’s bench, the fitted modules, the Lark’s parts, the courier (bench.js, fittings.js)
    };
    slotWrite(SLOTS.active, s);
    saveFails = 0;
  } catch (e) { if (!saveFails++) toast('The claim couldn’t be saved: this browser’s storage may be full. Carry it off as a code (Settings › Saving) to be safe.', 'night'); }
}
let saveFails = 0;
function loadSave() { return slotRead(SLOTS.active); }
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
let elapsed = 0, prevPhase = null, smokeT = 0, started = false, lampNight = -1, shadowTick = 0;
const _tint = new THREE.Color();
function frame() {
  const rdt = Math.min(clock.getDelta(), 0.1);
  // out in the skies: they draw instead, and the claim's time stands still until the ship is home
  if (SKY && SKY.on) { renderer.shadowMap.autoUpdate = true; AUDIO.ambience(0.7, true); if (SKY.frame(rdt)) return; }   // the skies draw their own shadows every frame
  elapsed += rdt;
  const gdt = started && !GAME.paused && !BUILD.on && !GAME.talk && !(SKY && SKY.on) && !frontOpen() ? rdt * GAME.speed : 0;   // the settings and their sheets pause the claim
  if (started) {
    GAME.t += gdt / DAY_LEN;
    if (GAME.t >= 1) { GAME.t -= 1; GAME.day++; }
  }
  applyTimeOfDay(TITLE.on ? titleFrame(rdt) : GAME.t, elapsed);   // the title screen shows golden hour (title.js)
  const ph = TOD.phase;
  if (started && prevPhase && ph !== prevPhase) phaseChange(prevPhase, ph);
  prevPhase = ph;
  if (gdt > 0) {
    economy(gdt);
    // sub-step villagers (and the dig: its lift cage carries them) at high speed so paths stay smooth
    const n = Math.ceil(gdt / 0.05), sdt = gdt / n;
    for (let i = 0; i < n; i++) { digTick(sdt); for (const v of GAME.villagers) v.update(sdt); }
    updateWildlight(gdt, elapsed); updateDefenders(gdt, elapsed); jumpersTick(gdt); updateExpeditions(gdt);
    announceStudy(updateStudies(gdt));
    lifeTick(gdt);   // the claim’s mood, the day’s events, the cast’s stories (acttwo.js)
  } else for (const v of GAME.villagers) { v.sprite.position.copy(v.pos); v.frame(TITLE.on ? rdt : 0); }   // they breathe and blink under the title
  benchFrame(rdt, gdt);   // the bench, the modules, the rare-find beams (bench.js)
  if (BUILD.on) updatePlaceCtl();
  if (VIEW.mode === 'keep') buildInterior();
  updateRings(); updateInterior(rdt, gdt);
  const now = performance.now() / 1000;
  for (const b of BUILDINGS) b.update(now, gdt || rdt * 0.25);
  FX.update(rdt * (GAME.paused ? 0.2 : Math.min(GAME.speed, 2)));
  wallUpdate(rdt);
  dressScene(rdt, gdt);
  dockUpdate(rdt); updateLife(rdt, TOD.night); storyTick(rdt); talkFrame(rdt);
  if (!TITLE.on) updateCamera(rdt);
  digFrameUpdate(rdt, gdt);
  if (VIEW.mode === 'keep') keepLookUpdate(rdt, gdt);   // after the camera moves: the lamplight is placed in its view
  nightsDraw(rdt); weatherDraw(rdt);
  updateHUD(rdt); updateLabels(); hintsTick(rdt);
  AUDIO.ambience(TOD.night, !GAME.paused);
  autosaveTick(rdt);   // every few minutes, as Settings says (settings.js)
  slowCheck(rdt);
  shadowsDraw(); crowdDraw(); townMerge();   // everyone’s shadow in one draw (people.js), everyone in one more (crowd.js), the town’s still pieces one per material (kit.js)
  // On Light the sun's shadows are drawn again every third frame rather than every frame: the sun moves slowly, and
  // it halves what a phone draws. A building being dragged redraws them every frame.
  if (QUALITY.level === 'light') { renderer.shadowMap.autoUpdate = false; if (++shadowTick % 3 === 0 || BUILD.drag || !sun.shadow.map) renderer.shadowMap.needsUpdate = true; }   // no map yet (just switched): draw it now
  else renderer.shadowMap.autoUpdate = true;
  const inK = VIEW.mode === 'keep', S = inK ? KSCENE : scene, C = inK ? kcam : camera;
  if (renderPass) { renderPass.scene = S; renderPass.camera = C; }
  // the lens: a model on a table from above, gentler side-on (the mine, the Keep) and when far away
  if (lensPass) {
    const dist = camera.position.distanceTo(controls.target), side = inK || VIEW.mode === 'mine';
    lensPass.uniforms.uAmount.value = VIEW.mode === 'mine' && !inK ? 0.12 : side ? 0.35 : clamp(1.25 - (dist - 25) / 110, 0.35, 1.2) * (BUILD.on ? 0.4 : 1);
    lensPass.uniforms.uFocus.value = side ? 0.5 : 0.47;
    gradePass.uniforms.uNight.value = TOD.night;
  }
  if (!inK && !TITLE.on) shakeCamera(rdt);
  composer ? composer.render() : renderer.render(S, C);
  if (!inK) unshakeCamera();
}
// running slowly (under about 22 frames a second for half a minute) on Balanced or High: once, suggest Light
const SLOW = { t: 0, n: 0, said: (() => { try { return !!localStorage.getItem('bv-slow-tip'); } catch (e) { return true; } })() };
function slowCheck(rdt) {
  if (SLOW.said || !started || QUALITY.level === 'light' || document.hidden) { SLOW.last = 0; return; }
  const now = performance.now(); if (SLOW.last) { SLOW.t += Math.min(1, (now - SLOW.last) / 1000); SLOW.n++; } SLOW.last = now;
  void rdt;
  if (SLOW.t < 30) return;
  const fps = SLOW.n / SLOW.t; SLOW.t = 0; SLOW.n = 0;
  if (fps >= 22) return;
  SLOW.said = true; try { localStorage.setItem('bv-slow-tip', '1'); } catch (e) { }
  toast('Running slowly? <b>Settings › Picture › Light</b> is made for phones and older computers.');
}
function phaseChange(a, b) {
  if (b === 'dusk') { nightDusk(); nightSlowCheck(); }   // the banner names the night to come; back to 1× if Settings asks
  if (b === 'night') startNight();
  if (a === 'night' && b === 'dawn') endNight();   // the dawn report; by day the watch mends the wall (nights.js)
  for (const v of GAME.villagers) v.replan = true;
  UI.refresh();
}
// everything that glows, smokes or sways
function dressScene(rdt, gdt) {
  WIND.time.value = elapsed;
  const night = TOD.night, pw = POWER.on ? 1 : 0.2;
  MAT.window.emissiveIntensity = night * 1.7 * pw + 0.05;
  for (const b of BUILDINGS) for (const L of b.lights) L.light.intensity = b.level >= L.lvl ? L.power * night * pw * (L.yard ? 0.4 + (b.chargeK || 0) : 1) : 0;
  for (const b of BUILDINGS) if (b.type === 'yard') for (const L of b.lights) if (L.yard) L.light.intensity *= yardLightK(b);
  const keep = TOWN.b.keep; if (keep && keep.beaconMat) keep.beaconMat.emissiveIntensity = 1.4 + night * 3 * pw + Math.sin(elapsed * 1.5) * 0.3;
  MAT.crystal.emissiveIntensity = 0.9 + night * 1.2 * pw;
  for (const b of BUILDINGS) if (b.type === 'yard' && b.crystalMat) {
    b.drainK = Math.max(0, (b.drainK || 0) - rdt);
    const glow = Math.max(0.05, 0.12 + (b.chargeK || 0) * 0.55 + night * 1.2 * pw - b.drainK * 0.6 + (b.drainK ? Math.random() * 0.4 : 0) + yardMood(b, night));
    b.crystalMat.emissiveIntensity = lerp(b.crystalMat.emissiveIntensity, glow, Math.min(1, rdt * 4));
    if ((b.chargeK || 0) > 0.25 && gdt && Math.random() < rdt * 9) FX.mote(b.worldPos((Math.random() - 0.5) * 8, 0.9, (Math.random() - 0.5) * 6));
  }
  const nk = Math.round(night * 20) / 20 + (POWER.on ? 0 : 7) + DECOR.lamps.filter(l => !l.lit).length * 13;
  if (nk !== lampNight) { lampNight = nk; setLampColors(night); }
  worldMats.mineGlow.emissiveIntensity = 2.2 * (POWER.on ? 1 : 0.3);
  worldMats.mineCrystal.emissiveIntensity = 1.3 + Math.sin(elapsed * 1.3) * 0.25;
  if (worldMats.faceCrystal) worldMats.faceCrystal.emissiveIntensity = 0.9 + night * 1.1 + Math.sin(elapsed * 1.1 + 2) * 0.2;
  faceMat.emissiveIntensity = 0.22 + night * 0.5;
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
  if (worldMats.puff) worldMats.puff.uniforms.uDrift.value += rdt * 0.004;   // one mesh, drifting in its shader (world.js)
  if (DECOR.sundial) DECOR.sundial.children[DECOR.sundial.children.length - 1].rotation.y += rdt * 0.6;
}

// ----------------------------------------------------------------- boot
// The loading screen's bar fills as each part of the claim is built (title.js), with a breath between the parts so
// the page can draw it. Then the title screen, unless the tab was reloaded to open a claim (go: 'continue' or 'new').
async function boot() {
  loadStep(0.02, 'Opening the claim book…');
  const go = takeGo(), save = loadSave();
  await loadAssets(k => loadStep(0.03 + k * 0.3));
  await breathe(); loadStep(0.36, 'Raising the plateau…');
  applyQuality();
  buildPlateau(); buildSky(); buildClouds(); buildPeaks();
  await breathe(); loadStep(0.48, 'Raising the town…');
  setupTown(save);
  await breathe(); loadStep(0.58, 'Mooring the ship…');
  setupDock(save);
  setupLife();
  await breathe(); loadStep(0.66, 'Opening the dig…');
  setupDig(save);
  fixEnv(scene);
  if (save) { TOWN.wallLevel = save.wall || 1; wallSetLevel(TOWN.wallLevel, false); }
  nightsLoad(save); weatherLoad(save);   // wall damage, a night in progress, a boss that got away; the weather
  buildNav();
  await breathe(); loadStep(0.74, 'Waking everyone up…');
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
    digAfterLoad();
    autoAssign();
    // settlers from before the roll take a place on it (keeping their names), so their sprite matches a portrait
    for (const v of GAME.villagers) if (!v.d.portrait && !v.d.named && !v.d.hero) { const f = nextFolk(v.d.pref); if (f) { v.d.portrait = f.id; v.d.look = { ...v.d.look, ...f.look }; v.redraw(); } }
    storyLoad(save.story); JUMP.next = save.jumpNext ?? null;
    workshopLoad(save.workshop);   // a claim from before the bench simply has none of it yet
    if (save.savedAt) GAME.away = catchUp((Date.now() - save.savedAt) / 1000);
    if (save.migrated) setTimeout(() => toast('Your claim is on the new build grid. Everyone lives in <b>the Keep</b> now. Tap <b>Build</b> to rearrange.'), 2500);
  } else { starterStash(); seedVillagers(); if (go !== 'new') titleShowcase(); }
  for (const v of GAME.villagers) { const S = stationFor(v); if (S && S.kind === 'surface') v.place(S.pos.x + (Math.random() - 0.5), 0, S.pos.z + (Math.random() - 0.5)); }
  applyTimeOfDay(GAME.t, 0);
  prevPhase = TOD.phase;
  addEventListener('resize', resize); resize();
  camera.position.set(60, 70, 120); controls.target.set(0, 0, 4); viewLimits('town');
  setView('town');
  applyCamSettings(); setSpeed(GAME.speed);
  const straightIn = (go === 'new' && !save) || (go === 'continue' && !!save);
  if (!straightIn) titleShow(save);
  // the first picture compiles every shader the claim uses: done here, behind the loading screen, not on the title
  await breathe(); loadStep(0.82, 'Airing out the Keep…'); await breathe();
  warmViews();
  await breathe(); loadStep(0.9, 'Lighting the lamps…'); await breathe();
  try { applyTimeOfDay(TITLE.on ? titleFrame(0) : GAME.t, 0); crowdDraw(); if (composer) composer.render(); else renderer.render(scene, camera); } catch (e) { console.warn(e); }
  renderer.setAnimationLoop(frame);
  await breathe();
  loadDone();
  if (straightIn) begin(go === 'new');
  addEventListener('visibilitychange', () => { if (document.hidden && started) saveGame(); });
  addEventListener('pagehide', () => { if (started) saveGame(); });
}
// The Keep and the mine are drawn once behind the loading screen, so their shaders, textures and meshes are ready on
// the card before anyone looks in (the first look into the Keep used to stall for its shaders). Nothing moves.
function warmViews() {
  const mode = VIEW.mode, p = camera.position.clone(), t = controls.target.clone();
  try {
    buildInterior(); VIEW.mode = 'keep'; frameKeep(true); updateInterior(0, 0); keepLookUpdate(0, 0);
    drawOnly();
  } catch (e) { console.warn(e); }
  VIEW.mode = mode;
  try {
    const F = digFrame(), dt = new THREE.Vector3(), dp = new THREE.Vector3(); digCamPose(F.x, F.y, F.d, dt, dp);
    camera.position.copy(dp); camera.lookAt(dt); camera.updateMatrixWorld();
    drawOnly();
  } catch (e) { console.warn(e); }
  camera.position.copy(p); controls.target.copy(t); camera.lookAt(t); camera.updateMatrixWorld();
}
// Into the claim. fresh: a new claim (the open slot is empty; the title's showcase comes down and the starting kit
// goes back in the tray), straight into laying it out, with the first look at how it works for a new player.
function begin(fresh) {
  AUDIO.start();
  sheetClose(); if (!$('#menu').hidden) closeMenu();
  if (INTRO_HELP) { introClose(); return; }
  if (fresh && loadSave()) { slotClear(SLOTS.active); reloadInto(SLOTS.active, 'new'); return; }   // a claim is on the page: build a new one
  if (fresh) undoShowcase();
  titleHide();
  started = true;
  applyTimeOfDay(GAME.t, elapsed); prevPhase = TOD.phase;   // back from the title’s golden hour to the claim’s own time
  for (const v of GAME.villagers) v.replan = true;
  if (!BUILD.setupDone) { enterBuild(null, true); if (!introSeen()) introShow(false); return; }
  setView('town');
  if (GAME.away && (GAME.away.lines.length || GAME.away.sec > 300)) { const A = GAME.away; setTimeout(() => { if (!GAME.talk) UI.open('away', A); }, 1300); }
  GAME.away = null;
  let shown = 0; try { shown = +localStorage.getItem('bv-controls-hint') || 0; localStorage.setItem('bv-controls-hint', shown + 1); } catch (e) { }
  if (shown < 4) {
    const hint = $('#hint');
    hint.textContent = matchMedia('(pointer:coarse)').matches ? 'Drag to move · pinch to zoom · two fingers to turn · tap anyone' : 'Drag to move · scroll to zoom · right-drag to turn · click anyone';
    hint.hidden = false; setTimeout(() => hint.hidden = true, 7000);
  }
}
// test hook: advance the simulation without rendering
function simulate(seconds, step = 0.1) {
  for (let t = 0; t < seconds; t += step) {
    GAME.t += step / DAY_LEN; if (GAME.t >= 1) { GAME.t -= 1; GAME.day++; }
    applyTimeOfDay(GAME.t, elapsed += step);
    if (prevPhase && TOD.phase !== prevPhase) phaseChange(prevPhase, TOD.phase); prevPhase = TOD.phase;
    economy(step); digTick(step); for (const v of GAME.villagers) v.update(step);
    updateWildlight(step, elapsed); updateDefenders(step, elapsed); jumpersTick(step); updateExpeditions(step); announceStudy(updateStudies(step));
    benchFrame(step, step);
    const now = performance.now() / 1000; for (const b of BUILDINGS) b.update(now, step);
    FX.update(step); wallUpdate(step); dressScene(step, step);
    lifeTick(step);
  }
}
// test hook: skip to a time of day (0 = first light, 0.6 dusk, 0.69 night, 0.96 dawn), running everything on the way
function skipTo(t, step = 0.25) { let guard = 0; while (Math.abs(GAME.t - t) > step / DAY_LEN * 1.5 && guard++ < 20000) simulate(step, step); }
// test hook: draw one frame as the game does (through the post-processing, if any), without moving anything
function drawOnly() { shadowsDraw(); crowdDraw(); townMerge(); const inK = VIEW.mode === 'keep', S = inK ? KSCENE : scene, C = inK ? kcam : camera; if (renderPass) { renderPass.scene = S; renderPass.camera = C; } if (composer) composer.render(); else renderer.render(S, C); }
function drawCalls() { const c = composer; composer = null; renderer.info.autoReset = true; renderer.render(scene, camera); const i = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, lights: 0 }; scene.traverse(o => { if (o.isPointLight) i.lights++; }); composer = c; return i; }
window.__bv = { DIG, CAGE, ROOMK, digQuick, digSetHead, digTick, recruit: recruitArrives, digOrder, digUpgrade, digCancel, digWhyNot, digDiggable, digIncident, digMerge, digSave, digFrame, DIGCAM, roomAt, digAt, digAutoCrew, DLOOK, GLOW, pickDig,
  JUMP, Jumper, STORY, CHAPTERS, talkNext, castArrive, get SKY() { return SKY; }, get FLEET() { return FLEET; }, DOCK, openSky, dockMoor, dockView, MAT, ENV_MATS, scene, startStudy, endStudy, buildInterior, catchUp, KEEPV, kcam, kcontrols, updateStudies,
  KCAM, KLIFE, KGLOW, KSCENE, keepTick, frame, keepLookUpdate, keepCamUpdate, frameKeep, pickKeep, keepAssign, kpath, keepDrawCalls, pointTime, STUDY, roomStudents, mastered, BUILD, enterBuild, exitBuild, trayPick, confirmPending, cancelPending, setTile, canPlace, addBuilding, removeBuilding, GRID, FOOT, footCenter, sendExpedition, recallExpedition, expOut, LOOT, D, equip, gearOf, fightOf, statOf, loadSave, migrateV1, DECOR, startDrag, groundAt, BEAMS, FLARES, saveGame, THREE, VIEW, FOLLOW, SEL, simulate, drawCalls, buildNav, workersOf, assignJob, stationFor, astar, GAME, TOWN, camera, controls, setView, TOD, WL, startNight, SHIP, UI, renderer, upgrade, WALLB, applyTimeOfDay, spawnWildlight, begin,
  NIGHT, WEATHER, WEATHERS, WL_KINDS, WALL, KEEP_LIMITS, BUY, DEFS, byType, autoAssign, findSpot, layoutChanged, planNight, forceWeather, lightningStrike, wallHit, nightReport, showDawn, skipTo, phaseChange, camShake, OUTLINE, cliffAt,
  showBanner, bossBar, nightLookout, BOLT, wallSetLevel, wallMatrices, snuffLamp, FX };
// the bench and the fittings, for tests (bench.js, fittings.js, finds.js)
Object.assign(window.__bv, { BENCH_T: { benchSalvage, benchOverhaul, benchRetune, benchChoose, benchCell, benchUncell, benchAttune, benchCraft, benchAssay, benchSkill, overhaulCost, retuneCost, salvageYield, findItem, allItems, fitModule, unfitModule, socketCount, socketsAt, modV, larkV, yardRate, yardBoost, itemNumbers, itemStats, dpsOf, fittedAll, workshopSave, lootMoment, courierToday, suggestFor, WALLB } });
// the front door, saves, settings, tips and toasts, for tests (title.js, saves.js, settings.js, hints.js, ui.js)
Object.assign(window.__bv, { TITLE, titleShow, titleHide, toTitle, SLOTS, slotRead, slotWrite, slotClear, slotSummary, slotName, exportCode, importCode, codeWhy, reloadInto,
  SETTINGS, setSpeed, applyLookSettings, HINTS, hintShow, hintClose, hintsReset, TOASTS, toast, bedsUsed, guestCount, openMenu, closeMenu, openExport, openImport, openClaims, openAbout,
  newClaimAsk, introShow, introClose, sheetClose, LOADING, frontOpen, drawOnly, frame, QUALITY, applyQuality, CROWD, crowdDraw, TMERGE, townMerge,
  playScene, endScene, eventFire, eventChoose, uiMorph, updateHUD });   // the panels: put aside for a scene, brought up to date in place (ui.js)
Object.defineProperty(window.__bv, 'started', { get: () => started });
boot().catch(e => { console.error(e); clearInterval(LOADING.t); $('#ld-line').textContent = 'The claim could not be built: ' + e.message + '. Try opening the page again.'; $('#loading').classList.add('failed'); });
