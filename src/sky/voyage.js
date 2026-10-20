// voyage.js: Brightvein's skies (from the airship game). The Shipyard (port.js: buy, refit and paint the claim's
// ships), choosing the skies (how hard the raiders fight), and voyages: set sail from the claim over Chris's map and
// fight off waves of raiders and claim-jumpers, each harder than the last, or raid one of their places (raids.js).
// Swing the camera round the ship to aim, and whichever guns face where you look fire. Shots tear the hull, the sails
// or the crystals (docs/ships.md). Downed raiders spill Crystal Shards to fly through and gather; after each wave,
// sail on or go home to keep them. Lose the ship and the crew get her home with half, and her in pieces.
// The ship sails as she stands in the Shipyard: her refits and paint (refit.js), the crew the claim picked for her
// (the gunners' Agility, the pilot's, the bosun's Grit) and the wear she brought home last time, until it's repaired.
// It draws with the claim's renderer, into the claim's view, while the claim's time stands still. The claim asks it to
// open('port' | 'title' | 'voyage' | 'raid') and it calls onLeave() when the Captain comes home.
// Works on a laptop (keyboard and mouse, full detail) and on a phone (touch stick, aiming drag, buttons).
import * as THREE from 'three';
import { loadShipArt } from '../ship/materials.js';
import { buildShip } from '../ship/build.js';
import { SHIPS, FLEET } from '../ships/index.js';
import { makeWorld, regionAt, SUN, HAZE, MAP, THINNING, HOME } from './world.js';
import { makeInput } from './input.js';
import { makeFlyer, WIND, windHelp } from './flight.js';
import { makeBolts, makeGunnery, batteryFor, BATTERY_NAMES, intercept } from './guns.js';
import { makeRaiders, waveAt } from './raiders.js';
import { SKIES } from './progress.js';
import { loadout, crewEffects, recipeFor, buildKey, paintArt, applyPaint, figurehead } from './refit.js';
import { makePickups } from './pickups.js';
import { makePort } from './port.js';
import { hitZones, firstHit } from './damage.js';
import { makeSmoke, smokeFrom, makeDebris, makeFlash, burnFrom } from './effects.js';
import { SITES, REPEAT, bountySite } from './sites.js';
import { makeRaids } from './raids.js';
import minimapUrl from '../../assets/map/minimap.webp';

export { SKIES, SHIPS, SITES, MAP, minimapUrl };
// a ship at the far setting of the detail dial, for the claim's distant traffic
export const buildShipFar = (R, art) => buildShip(R, 'far', art);
export const buildShipAt = (R, level, art) => buildShip(R, level, art);
const $ = (id) => document.getElementById(id);
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1 && matchMedia('(hover: none)').matches;
const PARTS = ['hull', 'sails', 'crystals'];
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const compassDeg = (heading) => ((180 - THREE.MathUtils.radToDeg(heading)) % 360 + 360) % 360; // north is up the map (-z)
const NUMBER = ['', 'a', 'two', 'three', 'four', 'five', 'six'];
const fmt = (n) => Math.round(n).toLocaleString('en');
const km = (d) => (d > 1500 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export { HOME };

// renderer, canvas: the claim's. progress: the fleet (./progress.js). onLeave({ got, downed, waves, lost, ship, raid })
// when the Captain comes home from a voyage, or ({}) leaving the shipyard. sound(name, position): the claim's effects.
// claim: what the skies need from the claim, all optional: crew(id) (the crew's stats, for refit.crewEffects),
// now() (the claim's day, for repairs), at() ({ ch, keep }: what the Shipyard has opened), mats() (the materials),
// afford(cost) and pay(cost) (shards and materials), crewNames(id) (who's aboard, for the HUD).
export function makeSky({ renderer, canvas, progress, onLeave, sound, claim = {} }) {
  const sfx = (k, at) => { try { sound?.(k, at); } catch (e) { /* the skies fly on without sound */ } };
  if (touch) document.body.classList.add('touch');
  const root = $('sky');
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 70000);
  let ART = null;
  const LOOK = {}; // the ships' glow as the skies light it (the claim dims it at the dock, so it’s put back here)
  const art = loadShipArt(renderer).then((a) => { ART = a; LOOK.canvas = a.M.canvas.emissiveIntensity; return a; }); // the claim’s dock needs the ships too
  const built = new Map();
  const pixelScale = () => renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  // every ship is built at full detail when first needed, as her refits make her, wearing her own paint, and shared:
  // moored at the claim's dock, on show in the shipyard, flying. A refit (or a new figurehead) rebuilds her; paint
  // only tints her materials. shipNow() once the ship art has loaded; shipFor() waits for it.
  // `over` tries paint on without keeping it (the shipyard's looks): { hull, sails, figure }
  function shipNow(R, over = null) {
    const saved = progress.data.ships[R.id], cfg = over ? { ...saved, paint: { ...saved.paint, ...over } } : saved, key = buildKey(R.id, cfg);
    let b = built.get(R.id);
    if (!b || b.key !== key) {
      const A = b?.art ?? paintArt(ART), ship = buildShip(recipeFor(R, cfg), 'full', A);
      ship.M = A.M; ship.glow.material.uniforms.uScale.value = pixelScale();
      if (b) swapShip(b.ship, ship);
      b = { key, ship, art: A, figure: null }; built.set(R.id, b);
    }
    const fig = cfg.paint?.figure || 'none';
    if (b.figure !== fig) { figurehead(b.ship, fig, b.art); b.figure = fig; }
    applyPaint(b.art, cfg);
    b.ship.paint = b.art;
    return b.ship;
  }
  // a rebuilt ship takes the old one's place wherever it was (the dock, the shipyard's berth)
  function swapShip(old, ship) {
    const p = old.root.parent;
    if (p) { ship.root.position.copy(old.root.position); ship.root.rotation.copy(old.root.rotation); Object.assign(ship.root.userData, old.root.userData); p.add(ship.root); p.remove(old.root); }
    old.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  const shipFor = async (R) => { await art; return shipNow(R); };
  const crewOf = (id) => crewEffects(id, claim.crew?.(id) ?? {});
  const loadoutOf = (id) => loadout(id, progress.data.ships[id], crewOf(id));

  let S = null; // everything else, made on the first open: the map, the port, the raiders
  let mode = 'off', paused = false, player = null, gunnery = null, preparing = null;
  const V = { shards: 0, downed: 0, hits: 0, loadout: null }; // this voyage
  const W = { n: 0, state: 'calm', timer: 5, lost: 0, choose: 0, sunk: false };
  const cam = { yaw: 0, pitch: 0.2, dist: 40, zoom: 1, look: new THREE.Vector3(), shake: 0 };
  const input = makeInput(canvas, document.body);
  input.active = false;
  const mini = $('minimap'), mctx = mini.getContext('2d'), mimg = new Image(); mimg.src = minimapUrl;
  let region = '', regionTimer = 0, hudTimer = 0, hurt = 0, time = 0, held = null, locked = null, lockedTower = null, reach = true;
  const STILL = new THREE.Vector3();

  async function prepare() {
    if (S) return S;
    if (!preparing) preparing = (async () => {
      const A = await art;
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(HAZE, 4000, 34000);
      const world = await makeWorld(renderer);
      scene.add(world.group);
      // the day sky lights the brass
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene(); envScene.add(world.group.children[0].clone());
      scene.environment = pmrem.fromScene(envScene, 0.04, 1, 60000).texture;
      scene.environmentIntensity = 0.9;
      pmrem.dispose();
      const hemi = new THREE.HemisphereLight(0xc3dcff, 0x7c8a5c, 0.75);
      const sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
      sun.castShadow = true; sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
      scene.add(hemi, sun, sun.target);
      const skies = () => SKIES[progress.data.skies];
      const bolts = makeBolts(scene), smoke = makeSmoke(scene), pickups = makePickups(scene), debris = makeDebris(scene), flash = makeFlash(scene);
      const fire0 = bolts.fire; let shotT = -1;
      bolts.fire = (from, dir, kind, owner, ...rest) => { if (owner === 'raider' && time - shotT > 0.15) { shotT = time; sfx('cannonfar', from); } return fire0(from, dir, kind, owner, ...rest); };
      const raiders = makeRaiders(scene, A, bolts, skies);
      const sites = makeRaids({ scene, bolts, smoke, raiders, skies, skiesId: () => progress.data.skies, pickups, debris, flash, sfx,
        say: { banner: (t, l) => banner(t, l), toast: (t) => toast(t) }, shake: (s) => { cam.shake = Math.max(cam.shake, s); }, player: () => player, camera: () => camera });
      const port = makePort({ renderer, env: scene.environment, progress, claim, shipFor: shipNow, crewOf, onSail: (id) => sail(id), onMode: (m) => enter(m), onHome: () => close() });
      port.mode = 'off';
      S = { scene, world, art: A, sun, hemi, skies, bolts, smoke, pickups, raiders, sites, port, debris, flash, zones: new WeakMap() };
      resize();
      return S;
    })();
    return preparing;
  }
  const zonesOf = (ship) => { let z = S.zones.get(ship); if (!z) { z = hitZones(ship); S.zones.set(ship, z); } return z; };

  function enter(m) {
    mode = m; root.dataset.mode = m; document.body.dataset.sky = m;
    input.active = m === 'voyage' && !paused;
    if (m !== 'voyage' && document.pointerLockElement) document.exitPointerLock();
  }
  // open the skies over the claim: 'port' (the shipyard), 'title' (choosing the skies), 'voyage' (set sail now, on
  // patrol) or 'raid' (set sail for one of the places: opts.site, an id from SITES, or 'bounty')
  async function open(m = 'port', opts = {}) {
    root.hidden = false; document.body.classList.add('sky-on');
    const wait = $('sky-loading'); wait.hidden = !!S;
    if (mode === 'off') enter('loading');
    await prepare();
    wait.hidden = true;
    let ok = true;
    if (m === 'voyage') ok = sail(progress.data.flying);
    else if (m === 'raid') ok = sail(progress.data.flying, false, opts.site);
    else S.port.setMode(m);
    if (ok === false) S.port.setMode('port');
  }
  // back to the claim
  function close(result = {}) {
    if (S) { S.raiders.clear(); S.bolts.clear(); S.pickups.clear(); S.sites.clear(); S.debris.clear(); S.port.mode = 'off'; }
    for (const el of [...$('tags').children]) el.remove();
    for (const id of ['paused', 'calm', 'title', 'port']) $(id).hidden = true;
    paused = false;
    enter('off');
    root.hidden = true; document.body.classList.remove('sky-on'); delete document.body.dataset.sky;
    onLeave?.(result);
  }

  // ---------- set sail: a fresh voyage in this ship, as she stands in the shipyard, from Brightvein ----------
  // (`force` sails a ship not owned, or under repair, for tests). Returns false if she can't sail.
  function siteFor(siteId) {
    if (!siteId) return null;
    if (siteId === 'bounty') return progress.data.bounty ? bountySite(progress.data.bounty) : null;
    return SITES.find((x) => x.id === siteId) ?? null;
  }
  function sail(id, force = false, siteId = null) {
    const d = progress.data, cfg = d.ships[id];
    if (!S || !cfg || (!cfg.owned && !force)) return false;
    if (!force && cfg.repair && claim.now && claim.now() < cfg.repair.until) { S.port.note?.(`The ${shipName(id)} is under repair at the dock.`); return false; }
    const R = FLEET.find((s) => s.id === id), ship = shipNow(R), L = loadoutOf(id);
    S.raiders.clear(); S.bolts.clear(); S.pickups.clear(); S.smoke.puffs.length = 0; S.sites.clear(); S.debris.clear();
    for (const el of [...$('tags').children]) el.remove();
    // out from the claim's rim: heading away from home on patrol, or towards the place on a raid
    const site = siteFor(siteId), rec = site && d.raids[site.id], repeat = !!(rec && rec.won && site.id !== 'bounty');
    newWind();
    const a = Math.random() * Math.PI * 2, at = site ? S.sites.start(site, { repeat }) : { pos: new THREE.Vector3(HOME.x + Math.sin(a) * 900, 680, HOME.z + Math.cos(a) * 900), heading: a };
    W.raid = site; W.repeat = repeat; sfx('sail');
    if (site && rec) rec.tries = (rec.tries ?? 0) + 1;
    ship.root.rotation.set(0, at.heading, 0); ship.root.position.copy(at.pos);
    player = makeFlyer(ship, L.stats, at, L.tune);
    // she sails with the wear she brought home, until it's repaired at the dock
    for (const k of PARTS) player.health[k] = player.full[k] * clamp(cfg.wear?.[k] ?? 1, 0.1, 1);
    V.loadout = L;
    player.aimY = zonesOf(ship).aim.y;
    gunnery = makeGunnery(ship, L.guns);
    S.scene.add(ship.root);
    const r = R.length * 0.85;
    Object.assign(S.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 8 });
    S.sun.shadow.camera.updateProjectionMatrix();
    cam.dist = R.length * 1.35 + 16;
    $('ship-name').textContent = shipName(id); $('ship-cls').textContent = `${R.cls} · ${R.length} m`;
    Object.assign(V, { shards: 0, downed: 0, hits: 0 }); Object.assign(W, { n: 0, state: site ? 'fight' : 'calm', timer: 5, lost: 0, choose: 0, sunk: false, next: null });
    cam.yaw = 0; cam.pitch = 0.2; cam.zoom = 1;
    paused = false; $('paused').hidden = true; $('calm').hidden = true;
    S.port.mode = 'voyage'; $('title').hidden = true; $('port').hidden = true;
    enter('voyage');
    region = regionAt(at.pos.x, at.pos.z); // the region’s name shows when you cross into the next one
    const names = claim.crewNames?.(id) ?? [];
    $('crew-line').textContent = names.length ? names.join(' · ') : 'Dock hands';
    if (site) {
      const to = new THREE.Vector3(site.x, at.pos.y, site.z).sub(at.pos), dist = Math.hypot(to.x, to.z);
      banner(`${site.kind === 'convoy' || site.kind === 'storm' ? '' : 'Raid: '}${site.short}`, `${dist > 600 ? `${(dist / 1000).toFixed(1)} km to the ${COMPASS[Math.round(compassDeg(Math.atan2(to.x, to.z)) / 45) % 8]} · ` : ''}${site.goal}${repeat ? ' · taken before: a smaller haul' : ''}`);
    } else banner(`The ${shipName(id)} sets sail`, `From ${HOME.name} · ${S.skies().name} · ${windWords()}`);
    const worn = PARTS.some((k) => (cfg.wear?.[k] ?? 1) < 0.95);
    if (worn) setTimeout(() => toast(`She sails as she came home: hull ${Math.round(player.frac('hull') * 100)}%`), 1800);
    return true;
  }
  const shipName = (id) => progress.data.ships[id]?.name || FLEET.find((s) => s.id === id).name;
  // home to the claim: keep this share of the voyage's shards
  function endVoyage(keep) {
    const d = progress.data, got = Math.round(V.shards * keep), lost = W.sunk || !!player?.down;
    d.shards += got; d.best[d.skies] = Math.max(d.best[d.skies], W.n);
    d.voyages = (d.voyages ?? 0) + 1; d.downed = (d.downed ?? 0) + V.downed;
    // what's left of her comes home with her, to be repaired at the dock (a lost ship comes home in pieces)
    if (player) {
      const cfg = d.ships[player.ship.recipe.id];
      if (cfg) cfg.wear = lost ? { hull: 0.12, sails: 0.25, crystals: 0.25 } : Object.fromEntries(PARTS.map((k) => [k, Math.max(0.05, Math.round(player.frac(k) * 100) / 100)]));
    }
    progress.save();
    const cur = S.sites.cur, taken = !!cur?.taken && !player?.down;
    const raid = W.raid ? { id: W.raid.id, loot: W.raid.loot, name: W.raid.short, taken, time: Math.round(cur?.t ?? 0), repeat: W.repeat, share: cur?.got ?? 1,
      boss: !!(cur?.boss && cur.boss.f.down), stars: W.raid.stars, why: cur?.why, bounty: W.raid.bounty ?? null } : null;
    const result = { got, downed: V.downed, waves: W.n, lost, ship: player ? shipName(player.ship.recipe.id) : '', shipId: player?.ship.recipe.id, raid };
    if (player) player.ship.root.removeFromParent();
    close(result);
    return got;
  }
  function newWind() { WIND.dir = Math.random() * Math.PI * 2; WIND.strength = 0.06 + Math.random() * 0.08; }
  const windWords = () => `the wind from the ${COMPASS[Math.round(compassDeg(WIND.dir + Math.PI) / 45) % 8]}`;

  // ---------- the camera: behind the ship, swung round it by the mouse or a drag ----------
  const aimPoint = new THREE.Vector3();
  function placeCamera(dt, inp) {
    const sens = inp.locked ? 0.0026 : touch ? 0.0042 : 0.005;
    cam.yaw -= inp.look.x * sens;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + inp.look.y * sens, -0.35, 1.25);
    cam.zoom = THREE.MathUtils.clamp(cam.zoom * Math.pow(1.12, inp.zoom), 0.55, 2.6);
    // left alone for a while (and not mouse-locked), the camera eases back behind the ship
    const idle = performance.now() / 1000 - inp.lastLook;
    if (!inp.locked && idle > 3.5 && !inp.fire) {
      const k = 1 - Math.exp(-dt * 1.2);
      cam.yaw = Math.atan2(Math.sin(cam.yaw), Math.cos(cam.yaw)) * (1 - k); cam.pitch += (0.2 - cam.pitch) * k;
    }
    const a = player.heading + cam.yaw, R = player.ship.recipe;
    cam.look.set(Math.sin(a) * Math.cos(cam.pitch), -Math.sin(cam.pitch), Math.cos(a) * Math.cos(cam.pitch));
    const target = player.pos.clone().add(new THREE.Vector3(0, R.length * 0.42 + 2, 0));
    camera.position.copy(target).addScaledVector(cam.look, -cam.dist * cam.zoom);
    camera.lookAt(target);
    if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt); const s = cam.shake * 0.012; camera.rotation.x += (Math.random() - 0.5) * s; camera.rotation.y += (Math.random() - 0.5) * s; }
    // the guns lock on to the raider nearest the crosshair, and lead it
    locked = null;
    let bestA = Infinity;
    for (const r of S.raiders.list) {
      if (r.f.down) continue;
      const v = r.f.pos.clone().sub(camera.position), along = v.dot(cam.look);
      if (along <= 0) continue;
      const ang = v.angleTo(cam.look), tol = Math.max(0.05, Math.atan((r.R.length * 0.8) / along));
      if (ang < tol && ang < bestA) { bestA = ang; locked = r; }
    }
    // or on the gun tower (or drill engine) nearest the crosshair, when there's no ship to lock on to
    lockedTower = null;
    if (!locked && S.sites.cur) for (const t of [...S.sites.cur.towers, ...S.sites.cur.mounts]) {
      if (!t.alive) continue;
      const v = t.world.clone().sub(camera.position), along = v.dot(cam.look);
      if (along <= 0 || along > 1600) continue;
      const ang = v.angleTo(cam.look), tol = Math.max(0.04, Math.atan(7 / along));
      if (ang < tol && ang < bestA) { bestA = ang; lockedTower = t; }
    }
    aimPoint.copy(target).addScaledVector(cam.look, 800);
  }
  function aimFor(battery) {
    reach = true;
    if (!locked && !lockedTower) return;
    player.ship.root.updateMatrixWorld(true);
    const m = gunnery.muzzle(battery);
    if (!m) { reach = false; return; }
    if (lockedTower) aimPoint.copy(intercept(m.p, player.velocity, lockedTower.world, STILL, m.K.speed));
    else aimPoint.copy(intercept(m.p, player.velocity, locked.f.aimAt(), locked.f.velocity, m.K.speed));
    reach = gunnery.reaches(battery, aimPoint);
  }

  // ---------- shots landing ----------
  const BURST = { hull: [0xffa040, 22, 1], sails: [0xf5e6c8, 14, 0.7], crystals: [0xffe08a, 34, 1.4] };
  const BITS = { hull: 'wood', sails: 'canvas', crystals: 'crystal' };
  let markT = 0;
  function hitMark(kind) { const el = $('hitmark'); el.className = kind; markT = 0.22; void el.offsetWidth; el.classList.add('on'); }
  function hitTest(b, a, c) {
    if (b.owner === 'player') {
      const h = S.raiders.hitBy(a, c);
      if (h) {
        if (h.r.f.invuln) { S.bolts.burst(h.h.at, 0x9fe7ff, 10, 0.6); hitMark('shield'); return true; }
        h.r.f.hit(h.h.part, b.damage); V.hits++; sfx('raiderhit', h.h.at);
        S.bolts.burst(h.h.at, ...BURST[h.h.part]);
        S.debris.spawn(h.h.at, h.r.f.velocity, b.K.size > 1 ? 5 : 3, 0.18 + h.r.R.length * 0.012, BITS[h.h.part], 12);
        hitMark(h.h.part);
        return true;
      }
    }
    // the place and its gun towers, the cliff, the drill engines
    const g = S.sites.hitBy(a, c, b.owner);
    if (g) {
      if (g.tower || g.mount) {
        const t = g.tower ?? g.mount;
        V.hits++; S.bolts.burst(g.at, 0xffa040, 22, 1); hitMark('hull');
        sfx('raiderhit', g.at); S.debris.spawn(g.at, null, 3, 0.4, t.silent || g.mount ? 'brass' : 'wood', 10);
        if (S.sites.damage(t, b.damage)) { sfx('tower', g.at); cam.shake = Math.max(cam.shake, 0.25); }
      } else S.bolts.burst(g.at, 0xb8a48a, 10, 0.6);
      return true;
    }
    if (b.owner === 'player') return false;
    // a raider's shot at one of the claim's barges
    const f = S.raiders.hitFriend(a, c);
    if (f) { f.r.f.hit(f.h.part, b.damage); S.bolts.burst(f.h.at, ...BURST[f.h.part]); S.debris.spawn(f.h.at, f.r.f.velocity, 2, 0.4, BITS[f.h.part], 10); return true; }
    if (player.down) return false;
    const h = firstHit(zonesOf(player.ship), player.ship.body, a, c);
    if (!h) return false;
    player.hit(h.part, b.damage); sfx('hullhit', h.at);
    S.bolts.burst(h.at, ...BURST[h.part]);
    S.debris.spawn(h.at, player.velocity, b.K.size > 1 ? 4 : 2, 0.16 + player.ship.recipe.length * 0.01, BITS[h.part], 10);
    hurt = Math.min(1, hurt + 0.45); cam.shake = Math.max(cam.shake, b.K.size > 1 ? 0.45 : 0.3);
    return true;
  }

  // ---------- the raiders come in waves; between them, sail on or go home ----------
  function describe(ids) {
    const count = {};
    for (const id of ids) count[id] = (count[id] ?? 0) + 1;
    const plural = (c) => (c === 'Man-o\'-war' ? 'Men-o\'-war' : `${c}s`);
    const parts = Object.entries(count).map(([id, n]) => { const c = FLEET.find((s) => s.id === id).cls; return `${NUMBER[n]} ${n > 1 ? plural(c) : c}`; });
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  }
  // between fights the crew patch her up, the hull to about two thirds and the rest a little more (the bosun does
  // better); the rest waits for the dock
  function patch(dt) {
    const P = V.loadout?.patch ?? { hull: 0.6, other: 0.8 };
    for (const k of PARTS) {
      const cap = k === 'hull' ? P.hull : P.other;
      if (player.frac(k) < cap) player.health[k] = Math.min(player.full[k] * cap, player.health[k] + player.full[k] * 0.05 * dt);
    }
  }
  function waves(dt, gone) {
    const { bolts, pickups, raiders, skies } = S;
    for (const r of gone) {
      V.downed++; sfx('raiderdown', r.f.pos);
      const big = r.R.length > 30 || r.boss;
      bolts.burst(r.f.pos, 0xff8a3a, big ? 80 : 50, big ? 2.6 : 2); bolts.burst(r.f.pos.clone().add({ x: 0, y: 3, z: 0 }), 0xffe08a, 24, 1.4);
      if (r.f.down.why !== 'struck') { S.debris.spawn(r.f.pos, r.f.velocity, big ? 40 : 18, 0.3 + r.R.length * 0.03, 'wood', 24); S.flash.at(r.f.pos, big ? 1.6 : 0.7); if (r.f.pos.distanceTo(player.pos) < 500) cam.shake = Math.max(cam.shake, big ? 0.8 : 0.35); }
      pickups.spill(r.f.pos.clone().add({ x: 0, y: 2, z: 0 }), r.f.velocity, r.bounty * skies().shards * (1 + 0.1 * W.n));
      toast(`${r.name} ${r.f.down.why === 'hull' ? 'going down' : r.f.down.why === 'struck' ? 'strikes her colours' : 'sinking, crystals dead'}: fly through the shards`);
      if (r.boss) { sfx('bossroar', r.f.pos); banner(`${r.name} is going down`, r.boss === 'candle' ? 'Tallow’s flagship falls burning through the cloud' : 'Her drill and her crystals fall dark'); }
    }
    for (const r of raiders.escaped) toast(`The ${r.R.cls} got away${r.role === 'prize' ? ' with her treasure' : ''}`);
    if (W.sunk) return;
    if (W.lost > 0) {
      if ((W.lost -= dt) <= 0) {
        W.sunk = true;
        $('paused-title').textContent = `The ${shipName(player.ship.recipe.id)} went down`;
        $('paused-line').textContent = `${V.shards ? `Your crew got her home to ${HOME.name} with half this voyage’s shards: ◆ ${fmt(V.shards / 2)}.` : `Your crew got her home to ${HOME.name}.`} She’ll need a long stay at the dock.`;
        $('btn-resume').hidden = true; $('btn-abandon').textContent = 'Home'; $('paused').hidden = false;
        input.active = false;
      }
      return;
    }
    if (player.down) { W.lost = 4; sfx('sunk'); $('calm').hidden = true; banner(`The ${shipName(player.ship.recipe.id)} is going down`, 'All hands to the boats'); return; }
    if (W.state !== 'fight') patch(dt);
    if (W.raid) { raidStep(dt); return; }
    if (W.state === 'calm') {
      if ((W.timer -= dt) <= 0) {
        const wave = W.next ?? waveAt(W.n, skies().extra), a = raiders.spawnWave(wave, player);
        W.next = null;
        const title = wave.ids.includes('galleon') ? `Wave ${W.n + 1}: a treasure ship` : wave.captain >= 0 ? `Wave ${W.n + 1}: a raider captain` : wave.ids.includes('manowar') ? `Wave ${W.n + 1}: a Man-o'-war` : `Raiders, wave ${W.n + 1}`;
        banner(title, `${describe(wave.ids)}, to the ${COMPASS[Math.round(compassDeg(a) / 45) % 8]} · ${windWords()}${wave.ids.includes('galleon') ? ' · shoot her sails to catch her' : ''}`);
        W.state = 'fight'; sfx('warhorn');
      }
    } else if (W.state === 'fight') {
      if (!raiders.list.some((r) => !r.f.down)) {
        W.n++;
        const bonus = Math.round(20 * W.n * skies().shards);
        V.shards += bonus;
        W.state = 'choose'; W.choose = 25; sfx('goal');
        $('calm-title').textContent = `Wave ${W.n} beaten`;
        const next = waveAt(W.n, skies().extra);
        W.next = next;
        $('calm-line').textContent = `◆ ${fmt(bonus)} for the wave · ◆ ${fmt(V.shards)} this voyage · hull ${Math.round(player.frac('hull') * 100)}%. Next: ${next.captain >= 0 ? 'a raider captain, with ' : ''}${describe(next.ids)}. Sail on for more, or go home to ${HOME.name} and keep them.`;
        $('btn-sail-on').hidden = false; $('btn-go-port').textContent = `Home to ${HOME.name}`;
        $('calm').hidden = false;
      }
    } else if (W.state === 'choose') {
      W.choose -= dt;
      $('btn-sail-on').textContent = `Sail on (${Math.max(0, Math.ceil(W.choose))})`;
      if (W.choose <= 0) sailOn();
    }
  }
  function sailOn() {
    if (W.state !== 'choose') return;
    $('calm').hidden = true; W.state = 'calm'; W.timer = 4; newWind();
  }
  // a raid: its director (raids.js) runs it; when it's over, the card
  function raidStep(dt) {
    const ev = S.sites.update(dt, player), cur = S.sites.cur, site = cur?.def ?? W.raid;
    if (ev !== 'taken' && ev !== 'lost') return;
    W.state = ev; sfx(ev === 'taken' ? 'raidwon' : 'raidlost');
    const taken = ev === 'taken', t = Math.round(cur.t), time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const crates = Math.max(1, Math.round(site.crates * (W.repeat ? REPEAT : 1) * (cur.got ?? 1)));
    const what = { convoy: taken ? `${Math.round((cur.got ?? 1) * 3)} of 3 barges home` : 'The barges are lost', storm: taken ? 'Through the front' : 'The front closed', bounty: taken ? `${site.short} is down` : `${site.short} got away`,
      dredge: !W.repeat && taken ? 'The Grindstone is sunk' : null, citadel: !W.repeat && taken ? 'The Black Candle is down' : null }[site.kind];
    $('calm-title').textContent = what ?? (taken ? `${site.short} strikes ${site.moving ? 'her' : 'its'} colours` : cur.why === 'escaped' ? `${site.short} got away` : cur.why === 'drilled' ? 'The drill is through' : `${site.short} went down with her crates`);
    $('calm-line').textContent = taken
      ? `In ${time}. Your crew load ${crates === 1 ? 'one crate' : `${NUMBER[crates] ?? crates} crates`} aboard · ◆ ${fmt(V.shards)} gathered. Take them home to ${HOME.name} to open them.`
      : `◆ ${fmt(V.shards)} gathered. There’ll be another run.`;
    $('btn-sail-on').hidden = true; $('btn-go-port').textContent = taken ? `Home with the crates` : `Home to ${HOME.name}`;
    $('calm').hidden = false;
    banner(taken ? (site.kind === 'storm' ? 'The strongbox is yours' : site.kind === 'convoy' ? 'The convoy is home' : `${site.short} is taken`) : 'The prize is lost', taken ? `${site.kind === 'rock' || site.kind === 'citadel' ? 'Brightvein’s colours fly over it · ' : ''}${time}` : '');
  }
  $('btn-sail-on').addEventListener('click', sailOn);
  $('btn-go-port').addEventListener('click', () => { if (W.state === 'choose' || W.state === 'taken' || W.state === 'lost') endVoyage(1); });
  function pause(on) {
    if (mode !== 'voyage' || W.sunk) return;
    paused = on; input.active = !on;
    if (on) {
      if (document.pointerLockElement) document.exitPointerLock();
      const fighting = W.state === 'fight' || player.down;
      $('paused-title').textContent = 'Paused';
      $('paused-line').textContent = !V.shards ? 'Going home now ends the voyage.' : fighting ? `Home now, mid-fight, and you keep half this voyage’s shards: ◆ ${fmt(V.shards / 2)}.` : `Home now keeps all this voyage’s shards: ◆ ${fmt(V.shards)}.`;
      $('btn-resume').hidden = false; $('btn-abandon').textContent = `Home to ${HOME.name}`;
    }
    $('paused').hidden = !on;
  }
  $('btn-pause').addEventListener('click', () => pause(true));
  $('btn-resume').addEventListener('click', () => pause(false));
  $('btn-abandon').addEventListener('click', () => endVoyage(W.sunk || W.state === 'fight' || player.down ? 0.5 : 1));
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'voyage' && !paused) pause(true); });

  // ---------- the help ----------
  const toggleHelp = () => { const h = $('help'); h.hidden = !h.hidden; $('btn-help').hidden = !h.hidden; };
  $('btn-help').addEventListener('click', toggleHelp);
  mini.addEventListener('click', () => { mini.classList.toggle('big'); });
  canvas.addEventListener('pointerdown', () => { if (mode === 'voyage') setTimeout(() => $('touch-hint').classList.add('gone'), 4000); });
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.fov = w < h ? 68 : 55; camera.updateProjectionMatrix();
    camera.userData.pixelScale = pixelScale();
    for (const b of built.values()) b.ship.glow.material.uniforms.uScale.value = camera.userData.pixelScale;
    const r = mini.getBoundingClientRect(); if (r.width) { mini.width = Math.round(r.width * devicePixelRatio); mini.height = Math.round(r.height * devicePixelRatio); }
    S?.port.resize();
  }
  addEventListener('resize', () => { if (mode !== 'off') resize(); });

  // ---------- the HUD ----------
  const flash = (el) => { el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
  function banner(title, line) { $('banner-title').textContent = title; $('banner-line').textContent = line; flash($('banner')); }
  function toast(text) { const t = $('toast'); t.textContent = text; flash(t); }
  const proj = new THREE.Vector3();
  // a point on screen, or pinned to the screen's edge in its direction when it's off screen or behind
  function screenAt(p, lift = 0) {
    const W2 = innerWidth / 2, H2 = innerHeight / 2;
    proj.copy(p); proj.y += lift; proj.project(camera);
    const behind = proj.z > 1;
    let x = proj.x * W2 * (behind ? -1 : 1), y = -proj.y * H2 * (behind ? -1 : 1);
    const k = Math.max(Math.abs(x) / (W2 - 50), Math.abs(y) / (H2 - 46)), edge = behind || k > 1;
    if (edge) { x /= Math.max(k, 1e-6); y /= Math.max(k, 1e-6); }
    return { x: W2 + x, y: H2 + y, edge, ang: Math.atan2(x, -y), dy: y };
  }
  function tags() {
    const placed = [];
    for (const r of [...S.raiders.list, ...S.raiders.friends]) {
      let el = r.tag;
      if (!el) {
        el = r.tag = document.createElement('div');
        el.className = r.friend ? 'tag friend' : r.boss || r === S.sites.cur?.boss ? 'tag captain boss' : r.captain ? 'tag captain' : r.role === 'prize' ? 'tag captain prize' : 'tag';
        const named = r.boss || r === S.sites.cur?.boss || (r.role === 'prize' && r === S.sites.cur?.prize);
        const label = r.friend ? r.name.replace('Ore barge ', 'Barge · ') : named ? r.name : `${r.captain ? 'Captain · ' : r.role === 'prize' ? 'Treasure · ' : ''}${r.R.cls}`;
        el.innerHTML = `<span class="arrow">▲</span><b></b> <span class="d"></span>${PARTS.map((k) => `<span class="meter ${k}"><i></i></span>`).join('')}`;
        el.querySelector('b').textContent = label;
        $('tags').append(el);
      }
      if (r.f.down || (r.friend && r.home)) { el.remove(); continue; }
      const s = screenAt(r.f.pos, r.R.length * 0.45 + 3);
      el.classList.toggle('edge', s.edge); el.classList.toggle('locked', r === locked);
      placed.push({ el, x: s.x, y: s.y + (s.edge && s.dy > 0 ? 40 : 0) });
      if (s.edge) el.querySelector('.arrow').style.transform = `rotate(${s.ang}rad)`;
      el.querySelector('.d').textContent = `${Math.round(r.f.pos.distanceTo(player.pos))} m`;
      PARTS.forEach((k, i) => { el.children[3 + i].firstChild.style.width = `${r.f.frac(k) * 100}%`; });
    }
    // tags that would land on top of each other are stacked instead
    placed.sort((a, b) => a.y - b.y);
    placed.forEach((a, i) => {
      for (let j = 0; j < i; j++) { const b = placed[j]; if (Math.abs(a.x - b.x) < 84 && a.y - b.y < 40) a.y = b.y + 40; }
      a.el.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -100%)`;
    });
    // the place being raided (or the next beacon): a gold tag over it, or at the edge pointing to it
    const cur = S.sites.cur;
    if (cur && !cur.def.moving || cur?.kind === 'storm') {
      let el = cur.tag;
      if (!el) { el = cur.tag = document.createElement('div'); el.className = 'tag captain site'; el.innerHTML = `<span class="arrow">▲</span><b></b> <span class="d"></span>`; el.querySelector('b').textContent = cur.kind === 'storm' ? 'Beacon' : `Raid · ${cur.def.short}`; }
      if (!el.parentNode) $('tags').append(el);
      const at = cur.kind === 'storm' ? S.sites.where() : cur.center, s = screenAt(at, cur.kind === 'storm' ? 40 : cur.def.size * 0.4 + 24);
      if (s.edge) el.querySelector('.arrow').style.transform = `rotate(${s.ang}rad)`;
      el.classList.toggle('edge', s.edge);
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      const n = S.sites.towersLeft, dist = at.distanceTo(player.pos);
      el.querySelector('.d').textContent = `${km(dist)}${cur.kind === 'storm' ? ` · ${cur.next + 1} of ${cur.beacons.length}` : n ? ` · ${n} gun${n > 1 ? 's' : ''}` : cur.taken ? ' · taken' : ''}`;
    }
    for (const el of [...$('tags').children]) if (![...S.raiders.list, ...S.raiders.friends].some((r) => r.tag === el) && el !== cur?.tag) el.remove();
  }
  // the four batteries and how ready each is, the one facing the aim lit
  const BAT = ['bow', 'port', 'starboard', 'stern'];
  function guns(battery) {
    const n = gunnery.count(battery);
    $('battery-name').textContent = n ? BATTERY_NAMES[battery] : `No ${BATTERY_NAMES[battery].toLowerCase()}`;
    $('battery-count').textContent = !n ? '–' : (locked || lockedTower) && !reach ? 'out of reach' : `${n} gun${n > 1 ? 's' : ''}`;
    for (const b of BAT) {
      const el = $(`gb-${b}`), c = gunnery.count(b), f = c ? 1 - gunnery.ready[b] / gunnery.reload(b) : 0;
      el.classList.toggle('on', b === battery); el.classList.toggle('none', !c); el.classList.toggle('ready', !!c && f >= 1);
      el.firstChild.style.height = `${f * 100}%`;
    }
    $('aim').className = locked || lockedTower ? (reach ? 'locked' : 'locked far') : '';
  }
  // the locked target's health, under the crosshair
  function target() {
    const el = $('target'), t = locked, cur = S.sites.cur;
    if (!t || t === cur?.boss || t === cur?.prize) { el.hidden = true; return; }   // (a boss’s health is in the boss bar)
    el.hidden = false;
    $('tg-name').textContent = t.boss ? t.name : t.role === 'prize' ? `${t.name}` : `${t.captain ? 'Captain’s ' : ''}${t.R.cls}`;
    $('tg-d').textContent = `${Math.round(t.f.pos.distanceTo(player.pos))} m`;
    for (const k of PARTS) $(`tg-${k}`).style.width = `${t.f.frac(k) * 100}%`;
  }
  // the raid's objective, its progress, the boss bar
  function raidHud() {
    const I = W.raid ? S.sites.info() : null, ob = $('objective'), bb = $('sky-boss');
    ob.hidden = !I || I.done; bb.hidden = !I?.boss || I.done;
    if (!I) { $('goal-dir').hidden = true; return; }
    $('obj-goal').textContent = I.goal; $('obj-sub').textContent = I.sub;
    const bars = $('obj-bars');
    if (I.bars) {
      if (bars.children.length !== I.bars.length) bars.innerHTML = I.bars.map(() => '<span class="ob"><em></em><span class="meter hull"><i></i></span></span>').join('');
      I.bars.forEach((b, i) => { const e = bars.children[i]; e.firstChild.textContent = b.home ? `${b.label} ✓` : b.label; e.querySelector('i').style.width = `${b.frac * 100}%`; e.classList.toggle('gone', b.frac <= 0); });
    } else if (bars.children.length) bars.innerHTML = '';
    const m = $('obj-meter');
    m.hidden = !I.meter; if (I.meter) { m.querySelector('i').style.width = `${I.meter.frac * 100}%`; m.classList.toggle('warn', !!I.meter.warn); }
    ob.classList.toggle('urgent', (I.timer != null && I.timer < 20) || !!I.meter?.warn);
    if (I.boss) {
      const B = I.boss;
      $('sb-name').textContent = B.name; $('sb-sub').textContent = B.sub; $('sb-phase').textContent = B.phase || '';
      $('sb-fill').style.width = `${B.frac * 100}%`; $('sb-fill2').style.width = `${(B.frac2 ?? 0) * 100}%`;
      $('sb-label2').textContent = B.label2 ?? 'Crystals'; document.querySelector('#sky .sb-two').hidden = B.frac2 == null;
      bb.classList.toggle('sails', !!B.sails); bb.classList.toggle('shield', !!B.shield);
      const marks = $('sb-marks'), key = (B.marks || []).join(',');
      if (marks.dataset.k !== key) { marks.dataset.k = key; marks.innerHTML = (B.marks || []).map((x) => `<i style="left:${x * 100}%"></i>`).join(''); }
    }
    // the compass points to the objective
    const gd = $('goal-dir');
    if (I.at && !I.done) {
      gd.hidden = false;
      const to = I.at.clone().sub(player.pos), rel = Math.atan2(to.x, to.z) - player.heading;
      $('goal-arrow').style.transform = `rotate(${-rel}rad)`;
      $('goal-d').textContent = km(Math.hypot(to.x, to.z));
    } else gd.hidden = true;
  }
  function hud(dt, battery) {
    hudTimer -= dt;
    hurt = Math.max(0, hurt - dt * 1.2);
    $('hurt').style.opacity = String(Math.max(hurt, player.down ? 0.6 : 0));
    if (markT > 0 && (markT -= dt) <= 0) $('hitmark').classList.remove('on');
    guns(battery);
    tags();
    if (hudTimer > 0) return;
    hudTimer = 0.1;
    target(); raidHud();
    $('r-speed').textContent = `${Math.round(player.speed * 3.6)} km/h`;
    $('r-height').textContent = `${Math.round(player.pos.y).toLocaleString()} m`;
    $('r-sail').textContent = `${Math.round(player.sail * 100)}%`;
    $('sail-bar').style.width = `${player.sail * 100}%`;
    for (const k of PARTS) {
      $(`h-${k}`).style.width = `${player.frac(k) * 100}%`;
      $(`n-${k}`).textContent = Math.ceil(player.health[k]);
      $(`row-${k}`).classList.toggle('low', player.frac(k) < 0.3);
    }
    // the crew falls with the hull
    const crew = player.crew(), all = player.stats.crew;
    $('h-crew').style.width = `${crew / all * 100}%`; $('n-crew').textContent = `${crew}`;
    $('row-crew').classList.toggle('low', crew / all < 0.4);
    $('score-n').textContent = V.downed; $('wave-n').textContent = W.raid ? '–' : W.n + 1; $('voyage-n').textContent = fmt(V.shards);
    $('score').classList.toggle('raid', !!W.raid);
    const deg = compassDeg(player.heading);
    $('heading').textContent = `${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]} ${Math.round(deg)}°`;
    // the wind, against the ship: the arrow points the way it blows (up is the way you're heading), and how much it
    // adds to or takes from your top speed
    const help = Math.round(windHelp(player.heading) * 100);
    $('wind-arrow').style.transform = `rotate(${-(WIND.dir - player.heading)}rad)`;
    $('wind-n').textContent = `${help > 0 ? '+' : help < 0 ? '−' : ''}${Math.abs(help)}%`;
    const sg = player.surge;
    $('h-surge').style.width = `${(sg.on > 0 ? sg.on / player.SG.time : sg.charge) * 100}%`;
    $('row-surge').classList.toggle('ready', sg.charge >= 1);
    $('btn-surge').disabled = sg.charge < 1;
    const w = $('warn');
    if (player.down) w.hidden = true;
    else if (player.frac('crystals') < 0.5) { w.hidden = false; w.textContent = 'The crystals are cracked: she’s sinking'; }
    else if (player.pos.y > THINNING - 350) { w.hidden = false; w.textContent = 'Nearing the Thinning: the crystals can’t lift you higher'; }
    else if (Math.abs(player.pos.x) > MAP.w / 2 + 1500 || Math.abs(player.pos.z) > MAP.h / 2 + 1500) { w.hidden = false; w.textContent = 'Open sea: Aethermoor is behind you'; }
    else w.hidden = true;
    const r = regionAt(player.pos.x, player.pos.z);
    if (r !== region && (regionTimer -= 0.1) <= 0) { region = r; regionTimer = 2; const el = $('region'); el.textContent = r; flash(el); }
    // the corner map: home as a gold diamond, the ship as a gold arrow, the raiders as red dots, barges as plum ones
    if (mimg.complete && mimg.naturalWidth && mini.width) {
      const W2 = mini.width, H2 = mini.height, mx = (x) => (x / MAP.w + 0.5) * W2, mz = (z) => (z / MAP.h + 0.5) * H2;
      mctx.drawImage(mimg, 0, 0, W2, H2);
      const x = mx(player.pos.x), y = mz(player.pos.z), s = Math.max(5, W2 / 40);
      mctx.lineWidth = Math.max(1, s / 5); mctx.strokeStyle = '#3a1631';
      mctx.fillStyle = '#ffcf85';
      mctx.beginPath(); mctx.moveTo(mx(HOME.x), mz(HOME.z) - s); mctx.lineTo(mx(HOME.x) + s * 0.7, mz(HOME.z)); mctx.lineTo(mx(HOME.x), mz(HOME.z) + s); mctx.lineTo(mx(HOME.x) - s * 0.7, mz(HOME.z)); mctx.closePath(); mctx.fill(); mctx.stroke();
      const site = S.sites.cur;
      if (site) { const p = S.sites.where(); mctx.fillStyle = site.taken ? '#7a3a6a' : '#ff9a3a'; mctx.fillRect(mx(p.x) - s * 0.8, mz(p.z) - s * 0.8, s * 1.6, s * 1.6); mctx.strokeRect(mx(p.x) - s * 0.8, mz(p.z) - s * 0.8, s * 1.6, s * 1.6); }
      mctx.fillStyle = '#ff4636';
      for (const q of S.raiders.list) if (!q.f.down) { mctx.beginPath(); mctx.arc(mx(q.f.pos.x), mz(q.f.pos.z), s * 0.45, 0, Math.PI * 2); mctx.fill(); mctx.stroke(); }
      mctx.fillStyle = '#d7a0d0';
      for (const q of S.raiders.friends) if (!q.f.down) { mctx.beginPath(); mctx.arc(mx(q.f.pos.x), mz(q.f.pos.z), s * 0.45, 0, Math.PI * 2); mctx.fill(); mctx.stroke(); }
      mctx.save(); mctx.translate(x, y); mctx.rotate(-player.heading + Math.PI);
      mctx.fillStyle = '#e2bd67'; mctx.lineWidth = Math.max(1.5, s / 4);
      mctx.beginPath(); mctx.moveTo(0, -s * 1.3); mctx.lineTo(s * 0.8, s); mctx.lineTo(0, s * 0.45); mctx.lineTo(-s * 0.8, s); mctx.closePath(); mctx.fill(); mctx.stroke();
      mctx.restore();
    }
  }

  // one step of a voyage: controls, flying, the raiders, the camera, the guns, the shots, the HUD
  function tick(dt) {
    const { raiders, bolts, smoke, pickups, world, sun, art: A } = S;
    time += dt;
    const inp = held ?? input.read();
    for (const k of inp.pressed) {
      if (k === 'c') { cam.yaw = 0; cam.pitch = 0.2; }
      else if (k === 'm') mini.classList.toggle('big');
      else if (k === 'h') toggleHelp();
      else if (k === 'p' || k === 'Escape') pause(true);
      else if (k === 'r') { if (player.startSurge()) toast('Surge!'); }
      else if (k === 'Enter') sailOn();
    }
    player.update(dt, inp);
    S.sites.keepOut(player);
    player.ship.root.updateMatrixWorld(true);
    const gone = raiders.update(dt, player, camera);
    placeCamera(dt, inp);
    const battery = batteryFor(cam.yaw);
    aimFor(battery);
    gunnery.update(dt);
    if (inp.fire && !player.down && gunnery.fire(battery, aimPoint, bolts, 'player', player.velocity)) sfx('cannon', player.pos);
    bolts.update(dt, hitTest, camera);
    smokeFrom(player, smoke, bolts.spark, dt); burnFrom(player, bolts.spark, dt);
    for (const r of [...raiders.list, ...raiders.friends]) { smokeFrom(r.f, smoke, bolts.spark, dt); burnFrom(r.f, bolts.spark, dt); }
    smoke.update(dt, camera); S.debris.update(dt); S.flash.update(dt);
    const got = pickups.update(dt, player.ship.body.localToWorld(new THREE.Vector3(0, 0.5, 0)), player.ship.recipe.length * 0.6 + 8, camera);
    if (got && !player.down) { V.shards += got; flash($('score')); sfx('pickup'); }
    waves(dt, gone);
    if (mode !== 'voyage') return; // the voyage ended this step
    // a Surge widens the view a little
    const fov = (innerWidth < innerHeight ? 68 : 55) + (player.surge.on > 0 ? 7 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 5)); camera.updateProjectionMatrix(); }
    world.time.value = time;
    world.puffs.follow(player.pos);
    sun.target.position.copy(player.pos); sun.position.copy(player.pos).addScaledVector(SUN, 400);
    A.M.canvas.userData.time.value = time;
    A.M.gem.emissiveIntensity = 0.55 + Math.sin(time * 2.4) * 0.09;
    const own = player.ship.paint;
    if (own) own.M.canvas.emissiveIntensity = own.glowSails ? LOOK.canvas * 2.2 : LOOK.canvas;
    player.ship.glow.material.uniforms.uScale.value = camera.userData.pixelScale;
    hud(dt, battery);
  }
  // the claim calls this every frame while the skies are open
  function frame(dt) {
    dt = Math.min(0.05, dt);
    if (!S || mode === 'loading') return false;
    // a storm front is dark: the sun goes in, the sky light greys, and the deck and the clouds are in its shadow
    const storm = mode === 'voyage' && S.sites.cur?.kind === 'storm';
    renderer.toneMappingExposure = storm ? 0.72 : 1.0;
    S.sun.intensity = storm ? 0.7 : 2.6; S.sun.color.set(storm ? 0xbfc8dc : 0xfff0d6); S.hemi.intensity = storm ? 0.45 : 0.75;
    S.world.dim.value = storm ? 0.4 : 1; S.scene.environmentIntensity = storm ? 0.45 : 0.9;
    ART.M.canvas.emissiveIntensity = LOOK.canvas;
    for (const b of built.values()) b.art.M.canvas.emissiveIntensity = b.art.glowSails ? LOOK.canvas * 2.2 : LOOK.canvas;
    if (mode === 'voyage') { if (!paused && !W.sunk) tick(dt); if (mode === 'voyage') renderer.render(S.scene, camera); }
    else { input.read(); S.port.update(dt); S.port.render(); }
    return true;
  }

  const api = {
    open, close, frame, resize, prepare, shipFor, shipNow, art, HOME, get shipArt() { return ART; },
    get on() { return mode !== 'off'; }, get mode() { return mode; }, get paused() { return paused; },
    loadoutOf, crewOf, siteFor,
    // for tests
    get player() { return player; }, get gunnery() { return gunnery; }, cam, input, waves: W, voyage: V, progress,
    get raiders() { return S?.raiders; }, get parts() { return S; }, get port() { return S?.port; }, get scene() { return S?.scene; }, camera,
    sail, endVoyage, pause, sailOn, wind: WIND, get sites() { return S?.sites; }, raid: (site, id) => sail(id ?? progress.data.flying, true, site),
    fly: (id) => sail(id, true), // a voyage in any ship, owned or not
    get hits() { return V.hits; }, get downed() { return V.downed; }, get locked() { return locked; },
    // run a voyage's clock without drawing, holding these controls (for tests on slow software rendering)
    step(seconds, controls = {}) {
      held = { turn: 0, climb: 0, sail: 0, fire: false, look: { x: 0, y: 0 }, zoom: 0, pressed: new Set(), lastLook: performance.now() / 1000, locked: false, ...controls };
      for (let t = 0; t < seconds && mode === 'voyage'; t += 1 / 60) if (!paused && !W.sunk) tick(1 / 60);
      held = null;
    },
  };
  return api;
}
