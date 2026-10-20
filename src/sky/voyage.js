// voyage.js: Brightvein's skies, the airship game's stage 4 (Skies of Aethermoor: its src/game/main.js) made into the
// claim's door to the skies. The Shipyard (port.js: buy, upgrade and dye the claim's ships, her crystal power and her
// shot), choosing the skies (how hard the raiders fight), and voyages: set sail from the claim over Chris's map and
// fight off waves of raiders, each harder than the last, or raid one of the claim's enemies' places (raids.js).
// Swing the camera round the ship to aim, and whichever guns face where you look fire. Shots tear the hull, the sails or
// the crystals (docs/ships.md). Downed raiders spill shards to fly through and gather; after each wave, sail on or go
// home to keep them. Lose the ship and the crew get her home with half, and her in pieces.
// Whatever happens is told to events.js (a gun firing, a hit, a raider down, a wave starting...), and the effects
// (fx.js, wrecks.js, surge.js), the sound (sound.js: Chris's music and effects) and the Captain's record (deeds.js)
// answer it; the HUD here answers the hits itself. Every ship shows her scars where she was hit, burns when badly holed,
// and every ship is alive: her wings fold and spread with her sails, her lids fly open and her guns run out for a fight
// (looks.js), and a glowing wake of Aether streams behind her (wakes.js). The sky at sea is the sky director's (sky.js):
// each region's air, storms rolling in for some waves, clouds to fly through and hide in. The fight's tactics
// (tactics.js): round shot, chain shot and crystal breakers, raking fire, the crew patching her mid-fight, raiders
// readying their broadsides with a red fan. Foes worth remembering: raiders with nerve, six raider captains with names
// and tricks, waves that come in different ways, the Man-o'-war's fortress battle, a choice of road between waves.
// The Captain's record (deeds.js): commendations, stars and harbour orders paid at sea are said in a toast; coming home
// from a patrol, a card says what the voyage did (record.js), with Sail again and Home to Brightvein; and a brand-new
// Captain's first voyage is a gentle one, one short tip at a time (coach.js).
// Brightvein's side of it: the ship sails as she stands in the Shipyard, with the crew the claim picked for her (the
// gunners' Agility, the pilot's, the bosun's Grit: refit.js crewEffects) and the wear she brought home last time, until
// it's repaired at the dock; her crew patch her only so far between fights. Shards come home to the claim's own purse.
// It draws with the claim's renderer, into the claim's view, while the claim's time stands still. The claim asks it to
// open('port' | 'title' | 'voyage' | 'raid') and it calls onLeave() when the Captain comes home.
// Works on a laptop (keyboard and mouse, full detail) and on a phone (touch stick, aiming drag, buttons).
import * as THREE from 'three';
import { loadShipArt } from '../ship/materials.js';
import { buildShip } from '../ship/build.js';
import { WTIME } from '../ship/dress.js';
import { applyPaint as paintShip } from './paint.js';
import { SHIPS, FLEET, GIANTS } from '../ships/index.js';
import { makeWorld, regionAt, REGIONS, SUN, HAZE, MAP, THINNING, DAY, CLOUD_Y, billowsFor, HOME } from './world.js';
import { makeSky as makeSkyDirector } from './sky.js';
import { makeInput } from './input.js';
import { makeFlyer, WIND, windHelp } from './flight.js';
import { makeBolts, makeGunnery, batteryFor, BATTERY_NAMES, intercept, KINDS } from './guns.js';
import { SHOTS, SHOT_ORDER, SHOT_ICON, RAKE, PATCH, SMART, rakeMul, NERVE, CAPTAINS, CAPTAIN_ORDER, captainById, wantedMul, plateMul, fromAstern, PLATE, FORT, LINE, ROADS, ROAD } from './tactics.js';
import { makeFx } from './fx.js';
import { makeWrecks } from './wrecks.js';
import { makeSurge } from './surge.js';
import * as events from './events.js';
import { makeRaiders, waveAt, roadWave, hasTreasure, treasureShip, treasureCount, BOUNTY, CAPTAIN, onePieceOf } from './raiders.js';
import { SKIES, NEEDS } from './progress.js';
import { loadout, crewEffects, SHIPYARD, costText } from './refit.js';
import { makePickups } from './pickups.js';
import { makePort } from './port.js';
import { hitZones, firstHit } from './damage.js';
import { smokeFrom } from './effects.js';
import { makeLooks } from './looks.js';
import { makeWakes } from './wakes.js';
import { makeAudio } from '../audio/audio.js';
import { makeSound } from './sound.js';
import { makeSettings, AIM, PICTURE } from './settings.js';
import { makeDeeds, DAY as DEED_DAY } from './deeds.js';
import { makeCoach } from './coach.js';
import { makeRecord } from './record.js';
import { applyPaint, DYES, notRaider } from './paint.js';
import { SITES } from './sites.js';
import minimapUrl from '../../assets/map/minimap.webp';

export { SKIES, SHIPS, SITES, MAP, HOME, minimapUrl, WTIME };
// a ship for the claim's own sky, at a setting of the detail dial ('full', 'middle' or 'far'), in her art's colours
export const buildShipAt = (R, level, art, opts) => buildShip(R, level, art, opts);
export const buildShipFar = (R, art) => buildShip(R, 'far', art);
// any built ship's body in one piece (one draw), for a ship small on the claim's screen
export { onePieceOf };
const $ = (id) => document.getElementById(id);
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1 && matchMedia('(hover: none)').matches;
const PARTS = ['hull', 'sails', 'crystals'];
const compassDeg = (heading) => ((180 - THREE.MathUtils.radToDeg(heading)) % 360 + 360) % 360; // north is up the map (-z)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// where something is from the ship, in plain words: `rel` is its bearing less her heading (a heading grows turning
// left, so a bearing below it is on the right)
function sideWords(rel) {
  const d = Math.abs(THREE.MathUtils.radToDeg(wrap(rel))), side = wrap(rel) < 0 ? 'right' : 'left';
  return d < 20 ? 'dead ahead' : d < 60 ? `ahead on your ${side}` : d < 120 ? `off your ${side} side` : d < 160 ? `behind you on your ${side}` : 'behind you';
}
const NUMBER = ['', 'a', 'two', 'three', 'four', 'five', 'six'];
const SUN_OFF = 400; // how far from the ship the sun's shadow camera sits, along the light
const { emit, payload } = events;

// renderer, canvas: the claim's. progress: the fleet and the Captain's record (./progress.js). onLeave(result) when the
// Captain comes home from her voyages ({ got, downed, waves, lost, ship, shipId, raid, voyages }), or ({}) leaving the
// Shipyard. claim: what the skies need from the claim (dock.js dockLink), all optional: crew(id) (the crew's stats, for
// refit.crewEffects), crewNames(id) (who's aboard), now() (the claim's day and hour, for repairs), day() (the claim's
// day number: the harbour orders change with it), at() ({ ch, keep }: what the Shipyard has opened), mats(), afford(cost)
// and pay(cost) (shards and materials), sound() ({ on, music, sfx }: the claim's Sound and its two sliders, which govern
// the skies' sound too), audioContext() (the claim's, once it has one: the skies' sound is made in it), picture() (the
// claim's detail: 'light', 'balanced' or 'high'), openSettings() (the claim's Settings panel, over the skies)
export function makeSky({ renderer, canvas, progress, onLeave, claim = {} }) {
  if (touch) document.body.classList.add('touch');
  const root = $('sky');
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 70000);
  // the settings: the claim's sound and picture, and the skies' own rows (aim speed, up and down, shake, Fire on the
  // left, tips), shown in the claim's Settings panel
  const settings = makeSettings({ touch, claim: { sound: claim.sound, picture: claim.picture } }), picture = () => PICTURE[settings.data.picture] ?? PICTURE.balanced;
  // the sound: made in the claim's own audio context, once the skies are first opened
  const audio = makeAudio({ touch, settings: () => settings.data, shared: claim.audioContext ?? null });
  if (claim.day) DEED_DAY.now = claim.day;
  let ART = null;
  const art = loadShipArt(renderer).then((a) => { ART = a; return a; }); // (the claim's dock needs the ships too)
  const pixelScale = () => renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  // the Captain's ships, each built at full detail when first needed, in her own colours (paint.js), and shared: on
  // show in the Shipyard, and flying. shipNow() once the ship art has loaded; shipFor() waits for it. (The ship moored at
  // the claim's dock is a lighter one of her own: dockShip)
  const built = new Map();
  const shipName = (id) => progress.data.ships[id]?.name || FLEET.find((s) => s.id === id).name;
  function shipNow(R) {
    let s = built.get(R.id);
    if (!s) { s = buildShip(R, 'full', ART); s.glow.material.uniforms.uScale.value = camera.userData.pixelScale ?? pixelScale(); built.set(R.id, s); }
    applyPaint(s, progress.data.ships[R.id]?.paint);
    return s;
  }
  const shipFor = async (R) => { await art; return shipNow(R); };
  // the ship moored at the Sky Dock: her middle model (about a fifth of her triangles, no lamps of her own), in her
  // colours, made once for each ship as she becomes the flagship
  const docked = new Map();
  function dockShip(R) {
    let s = docked.get(R.id);
    if (!s) { s = buildShip(R, 'middle', ART); docked.set(R.id, s); }
    applyPaint(s, progress.data.ships[R.id]?.paint);
    return s;
  }
  const crewOf = (id) => crewEffects(id, claim.crew?.(id) ?? {});
  const loadoutOf = (id) => loadout(id, progress.data.ships[id], crewOf(id));
  let mode = 'off', G = null, preparing = null;
  // (the voyages since the skies were opened: their results, told to the claim as the Captain comes home)
  const pending = [];

  async function prepare() {
    if (G) return G;
    if (!preparing) preparing = build(await art).then((g) => (G = g));
    return preparing;
  }
  // everything else, made the first time the skies are opened: the map and its sky, the Shipyard, the raiders, the
  // sound, the record. (The airship game's main(), with the claim round it)
  async function build(A) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 4000, 34000);
  const world = await makeWorld(renderer), art = A;
  scene.add(world.group);

  // the afternoon sky lights the brass: a blurred picture of it, drawn once (and again if the drawing context is lost)
  let dayLight = world.skyLight(DAY);
  scene.environment = dayLight;
  // the sky's light and the sun's, coloured by the look of the sky (world.js: the voyages' afternoon, the title's sunset)
  const hemi = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight();
  const lights = { sun, hemi, scene };
  world.setLook(DAY, lights);
  sun.castShadow = true; sun.shadow.mapSize.set(picture().shadow, picture().shadow);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);

  // the skies the fights are in: the Captain's own, but a sea trial (below) in Crosswinds at the hardest, so a ship being
  // shown off usually wins her trial
  let trial = null; // (the ship on her sea trial, while she's out)
  const skies = () => SKIES[trial && progress.data.skies === 'mael' ? 'cross' : progress.data.skies];
  // the sound (Chris's music and his effects, and the game's own: sound.js), answering the game's news
  const sound = makeSound({ audio, touch, where: () => player?.pos, weather: () => sky?.weather });
  const fx = makeFx({ scene, camera, touch }), bolts = makeBolts(scene, fx, 400, camera), pickups = makePickups(scene);
  const wrecks = makeWrecks({ fx, tear: world.tear, scene }), surge = makeSurge({ scene, fx });
  const raiders = makeRaiders(scene, art, bolts, skies, fx);
  const looks = makeLooks({ scene, touch, fx, camera }); // (every ship's scars, her life and her flames: looks.js)
  const sky = makeSkyDirector({ world, lights, scene, renderer, touch, fx }); // (the sky at sea and its weather: sky.js)
  raiders.sky = sky; // (where the thick cloud is, for a raider running to hide in it)
  const wakes = makeWakes(scene, { touch }); // (every ship's wake of Aether, in one draw)
  // the Settings card's changes, at once: the sound; the picture; the camera shake; Fire on the left (a phone)
  function applyPicture() {
    const P = picture();
    if (sun.shadow.mapSize.x !== P.shadow) { sun.shadow.mapSize.set(P.shadow, P.shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    port.setShadow(P.shadow);
    world.puffs.count(P.puffs); raiders.setDetail(P.detail); fx.setQuality(P.fx[touch ? 0 : 1]);
    world.quality(P.sky); sky.quality(P.sky); // (the sun's rays, the sea's glitter, the horizon's clouds; rain and scud)
  }
  function applyHands() {
    const left = touch && settings.data.leftFire;
    document.body.classList.toggle('fire-left', left); input.leftFire = left; layout();
    // (and the words that say which thumb does what, in the hint and How to fly: each has its left-handed words in
    // data-left, and keeps its own in data-right)
    for (const el of document.querySelectorAll('[data-left]')) { el.dataset.right ??= el.textContent; el.textContent = left ? el.dataset.left : el.dataset.right; }
  }
  settings.on((id, v, done) => {
    if (id === 'sound' || id === 'music' || id === 'effects') {
      const on = audio.apply();
      // (a tick, to hear the new level, once the sound is running again)
      if (done && (id === 'effects' || (id === 'sound' && v))) on.then((running) => { if (running) sound.ui('ui-cursor'); });
    }
    else if (id === 'picture') { applyPicture(); resize(); }
    else if (id === 'shake') fx.shake = v;
    else if (id === 'leftFire') applyHands();
    else if (id === 'tips' && !v) coach.clear();
  });

  // ---------- the ship you fly, and a voyage ----------
  const zones = new Map();
  // the Captain's record, counted from the news (deeds.js), and shown in the Shipyard and coming home (record.js)
  const deeds = makeDeeds({ progress, player: () => player, clock: () => time, wave: () => W.wave, trial: () => trial });
  const port = makePort({ renderer, env: dayLight, progress, claim, shipFor: shipNow, crewOf, touch, onSail: (id) => sail(id), onTrial: (id) => sail(id, false, true), onMode: (m) => enter(m), onHome: () => close(), deeds, onLog: () => record.openLog() });
  const record = makeRecord({ progress, deeds, onSail: (id) => sail(id), advice: () => port.advice().long, onClose: () => setTimeout(pumpNotes, 0), onHome: () => goHomeToClaim(), nameOf: shipName }); // (closed, the port's notes waiting for it are told: pumpNotes; a moment later, so Sail again's voyage keeps them for the next port)
  // a phone can drop the drawing context after a long time in the background (or a laptop's graphics can restart).
  // three.js puts back the ships, the map and the shadows by itself, but not the pictures drawn once at start-up: the
  // sky's light on the brass (the afternoon's, and the title's sunset) and the cloud pattern. Pause, and draw those
  // again when the context comes back.
  canvas.addEventListener('webglcontextlost', () => { if (mode === 'voyage' && !paused) pause(true); });
  canvas.addEventListener('webglcontextrestored', () => {
    world.clouds.bake(); dayLight = port.scene.environment = world.skyLight(DAY);
    scene.environment = dayLight;
  });
  let paused = false, player = null, gunnery = null;
  const V = { shards: 0, downed: 0, hits: 0, bonus: 0 }; // this voyage (bonus: the shards the waves paid, of `shards`)
  // the waves: which (n, from 0), what's happening between them, and the next wave once it's known (shown on the card);
  // `news`: kinds of shot earned and not yet told in a banner (earn()). `alt`: the second way on the card offers, if any
  // (roadFor); `wave`: the wave being fought (its road's shards and bonus); `met`: the raider captains met this voyage;
  // `plainAt`: a captain wave whose captain was hunted down early (a plain wave now); `treasureAt`: the last wave with a
  // treasure ship; `grudge`: a raider captain who sank her ship and got away, for its card
  // `gentle`: a brand-new Captain's first voyage, whose first raider comes gently (raiders.js spawnWave)
  const W = { n: 0, state: 'calm', timer: 5, lost: 0, choose: 0, sunk: false, next: null, bonus: 0, bonusAt: 0, bonusShown: -1, news: [], alt: null, wave: null, met: [], plainAt: -1, treasureAt: -99, grudge: null, offered: { storm: -1, treasure: -1, hunt: -1 }, hint: null, gentle: false };
  let told = null; // the screen the events were last told of
  // a new screen: the title's sky (or the afternoon's again), and a dip through the night as it changes. The change
  // itself is at once (the night covers it), then the new screen comes up out of the night over half a second
  const veil = $('veil');
  let dip = null;
  function enter(m) {
    record.hide(); // (coming home's card and the log close with any change of screen)
    if (m !== 'voyage') sky.rest(); // (no weather left in the world's sky for the Shipyard)
    if (m !== mode && m !== 'off') { dip?.cancel(); dip = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: lessMotion.matches ? 150 : 520, easing: 'ease-out' }); }
    mode = m; root.dataset.mode = m;
    if (m === 'off') delete document.body.dataset.sky; else document.body.dataset.sky = m;
    if (m === 'title') fx.clear(); // (no smoke left hanging from the last fight)
    if (m === 'port') pumpNotes();
    if (told !== m) { told = m; payload('mode').mode = m; emit('mode'); }
    input.active = m === 'voyage' && !paused;
    if (m !== 'voyage' && document.pointerLockElement) document.exitPointerLock();
  }
  // everything a voyage leaves behind, cleared for the next: the waves (and the next one, if a card was showing), the
  // hold, the raiders, shots, smoke and shards, wrecks and the holes they tore in the clouds, and the camera
  function resetVoyage() {
    Object.assign(W, { n: 0, state: 'calm', timer: 5, lost: 0, choose: 0, sunk: false, next: null, alt: null, wave: null, plainAt: -1, treasureAt: -99, grudge: null, hint: null, gentle: false }); W.news.length = 0; W.met.length = 0; newsUp.until = 0;
    for (const k in W.offered) W.offered[k] = -1;
    Object.assign(V, { shards: 0, downed: 0, hits: 0, bonus: 0 }); said.length = 0;
    raiders.clear(); bolts.clear(); pickups.clear(); fx.clear(); wrecks.clear(); world.clear(); surge.clear(); looks.clear(); wakes.clear(); sky.reset(); hideBounties(); calmUp(false); bigMap(false); raidClear();
    document.body.classList.remove('sinking'); hidNote = -99; gaveAway = -99;
    hurt = 0; Object.assign(cam, { yaw: 0, pitch: 0.2, zoom: 1 }); Object.assign(shardCount, { shown: 0, from: 0, to: 0, t: 1, n: -1 }); surgeFov.x = surgeFov.v = 0;
  }
  // whether a ship at p, heading in from bearing a, and the camera `d` metres behind her are clear of the big clouds
  // (with room to spare round the camera)
  const airP = new THREE.Vector3();
  function clearAir(p, a, d) {
    world.puffs.follow(p);
    for (const [back, side, up] of [[0, 0, 0], [0.5, 0, 0.1], [1, 0, 0.2], [1.3, 0, 0.3], [1, 50, 0.2], [1, -50, 0.2], [1, 0, -0.3], [1, 0, 0.8]]) {
      airP.set(p.x + Math.sin(a) * d * back + Math.cos(a) * side, p.y + d * up, p.z + Math.cos(a) * d * back - Math.sin(a) * side);
      if (world.puffs.inside(airP) > 0) return false;
    }
    return true;
  }
  // a sea trial (Chris: like a garage's test drive): a ship not owned yet, taken out from port for one fight that suits
  // her (TRIAL: the wave she's tried on, from 0, with no storm, in Crosswinds at the hardest; for the big two, a late
  // wave, made ready as she sails, as a card would). It earns and costs nothing
  // and changes nothing in the save: her wrecks spill no shards and no bounty rises, nothing is banked, no voyage or best
  // wave is counted, and she sails as she's built, whatever upgrades the save holds. The raiders are those of the
  // giants the Captain really owns (a trial never counts as owning her). Beaten or sunk, she comes home to the same port
  // screen, with a line saying what she costs
  const TRIAL = { cutter: 3, brig: 4, frigate: 7, galleon: 12, manowar: 14 }, AS_BUILT = { power: 0, mods: { armour: 0, canvas: 0, drill: 0, crystals: 0 } };
  // set sail: a fresh voyage in this ship, built as she stands in the Shipyard, with her crew from the claim and the wear
  // she brought home last time (`force` sails a ship not owned, or under repair, for tests), or (`onTrial`) her sea
  // trial, or (`siteId`, an id from SITES, or 'bounty') a raid on one of the claim's enemies' places (raids.js). She sets
  // out from the claim's rim, in clear air: heading away from home on patrol, towards the place on a raid. Returns
  // false if she can't sail
  function sail(id, force = false, onTrial = false, siteId = null) {
    const d = progress.data, cfg = d.ships[id];
    if (!cfg || (!cfg.owned && !force && !(onTrial && TRIAL[id] !== undefined))) return false;
    if (!force && !onTrial && cfg.repair && claim.now && claim.now() < cfg.repair.until) { port.note?.(`The ${shipName(id)} is under repair at the dock.`); return false; }
    trial = onTrial ? id : null;
    const first = progress.newCaptain && !trial;
    const R = SHIPS.find((s) => s.id === id), ship = shipNow(R), L = trial ? loadout(id, AS_BUILT, crewEffects(id)) : loadout(id, cfg, crewOf(id));
    ship.root.scale.setScalar(1);
    for (const g of GIANTS) giants[g] = !!d.ships[g]?.owned; // (the giants she owns sail among the raiders this voyage)
    const site = trial ? null : siteFor(siteId), rec = site && d.raids[site.id], repeat = !!(rec && rec.won && site.id !== 'bounty');
    // (she starts 900 m out from Brightvein, heading away, in clear air: tried round the circle until neither she nor the
    // camera behind her is in one of the big clouds, so a voyage never opens blind. A raid sets out towards its place)
    const at = { pos: new THREE.Vector3(), heading: 0 };
    for (let k = 0, a = Math.random() * Math.PI * 2; k < 12; k++, a += 0.52) {
      at.pos.set(HOME.x + Math.sin(a) * 900, 680, HOME.z + Math.cos(a) * 900); at.heading = a;
      if (clearAir(at.pos, a + Math.PI, camDistFor(R))) break;
    }
    resetVoyage();
    if (site) Object.assign(at, raidStart(site, repeat));
    ship.root.rotation.set(0, at.heading, 0); ship.root.position.copy(at.pos);
    if (player && player.ship !== ship) scene.remove(player.ship.root); // never leave the last ship hanging in the sky
    player = makeFlyer(ship, L.stats, at, L.tune);
    // she sails with the wear she brought home, until it's repaired at the dock (a sea trial, as she's built)
    if (!trial) for (const k of PARTS) player.health[k] = player.full[k] * clamp(cfg.wear?.[k] ?? 1, 0.1, 1);
    V.loadout = L;
    looks.follow(player); looks.reset(ship); // (her scars as good as new: the wear she carries is in her numbers)
    if (!zones.has(id)) zones.set(id, hitZones(ship));
    player.aimY = zones.get(id).aim.y;
    if (!feet.has(id)) feet.set(id, footprint(ship)); player.foot = feet.get(id); // (her heights seen from above, for the view to look past her: placeCamera)
    Object.assign(viewPast, { x: 0, z: 0, vx: 0, vz: 0 }); // (and the view over her middle to start with)
    // (and how far above that her sails' middle is, for a raider captain who shoots chain shot at them: tactics.js)
    { const Z = zones.get(id), m = Z.sails.filter((b) => !b.isEmpty()); player.sailUp = m.length ? m.reduce((a, b) => a + (b.min.y + b.max.y) / 2, 0) / m.length - Z.aim.y : R.length * 0.3; }
    gunnery = makeGunnery(ship, L.guns, player); loaded.port = loaded.starboard = 0; wasLocked = null;
    player.gun = gunnery; // (her guns show on her model as they fire and reload: looks.js)
    player.locked = null; // (the raider her guns are locked on to, for the smartest raiders to dodge: raiders.js)
    rakedNote = false; wasPatching = false; shotsShown(); // (round shot loaded, five volleys of breakers aboard)
    fx.follow(player); surge.follow(player, zones.get(id));
    scene.add(ship.root);
    // the sun's shadows: a box round the ship, sized to her, so her masts and sails shade her deck. The sun sits
    // 400 m off along its light, so the box reaches from just short of the ship to just past her
    const r = R.length * 0.85;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: SUN_OFF - r * 2, far: SUN_OFF + r * 2 });
    sun.shadow.camera.updateProjectionMatrix();
    cam.dist = camDistFor(R);
    $('ship-name').textContent = shipName(id); $('ship-cls').textContent = `${R.cls} · ${R.length} m`;
    const names = trial ? [] : claim.crewNames?.(id) ?? [];
    $('crew-line').textContent = trial ? 'The yard\'s own crew' : names.length ? names.join(' · ') : 'Dock hands';
    // (a raider's red fan made ready for the sky at sea and her ship's lamps, so her first warning doesn't stutter a
    // phone making it then: raiders.js fanToWarm)
    renderer.compile(raiders.fanToWarm(), camera, scene);
    renderer.compile(wrecks.flagToWarm(), camera, scene); // (and a struck ship's white flag: wrecks.js)
    renderer.compile(bolts.toWarm(), camera, scene); // (and the shots' streaks, chain shot's chain and the solid colours: guns.js)
    // (her trial's wave, known now: a raider captain's ship in it is built as she sails, not as the wave appears)
    if (trial) { W.n = TRIAL[id]; W.next = nextWave(W.n); raiders.prepareWave(W.next); }
    W.gentle = !trial && !site && !d.voyages; // (a brand-new Captain's first voyage: her first raider comes gently)
    W.raid = site; W.repeat = repeat; if (site) W.state = 'fight';
    if (rec) rec.tries = (rec.tries ?? 0) + 1;
    // (the score says it's her sea trial or a raid, not a wave she's never reached; written before the panels are measured)
    setText($('wave-word'), trial ? 'Sea trial' : site ? 'Raid' : 'Wave '); setText(H['wave-n'], trial || site ? '' : '1');
    $('score').classList.toggle('raid', !!site);
    newWind();
    setPaused(false); $('paused').hidden = true; $('howto').hidden = true;
    port.leave(); $('title').hidden = true; $('port').hidden = true; // (and a colour tried on, not bought, comes off her: port.js)
    enter('voyage');
    // on a laptop, the keys show for this device's first two voyages, until the first wave comes; after that they're
    // folded away (H brings them back). On a phone, the hint shows for the first three. (A sea trial isn't counted)
    const sailed = settings.data.voyages; if (!trial) settings.keep('voyages', sailed + 1);
    $('help').hidden = sailed >= 2; $('btn-help').hidden = sailed < 2;
    clearTimeout(hintTimer); hintTimer = 0; hint.hidden = sailed >= 3; hint.classList.remove('gone');
    layout();
    region = regionAt(at.pos.x, at.pos.z); // the region's name shows when you cross into the next one
    if (trial) banner(`Sea trial: the ${R.name}`, `One fight, as she's built · nothing won or lost`);
    else if (site) raidBanner(site, at, repeat);
    else banner(first ? 'Your first voyage, Captain' : `The ${shipName(id)} sets sail`, `From ${HOME.name} · ${skies().name} · ${windWords()}`);
    const worn = !trial && PARTS.some((k) => (cfg.wear?.[k] ?? 1) < 0.95);
    if (worn) setTimeout(() => { if (mode === 'voyage' && player) toast(`She sails as she came home: hull ${Math.round(player.frac('hull') * 100)}%`); }, 1800);
    const E = payload('voyage:start'); E.ship = id; E.skies = d.skies; E.trial = !!trial; E.raid = site?.id ?? null; emit('voyage:start');
    deeds.chart(region); // (the land she sets out over, charted: deeds.js)
    return true;
  }
  const siteFor = (siteId) => (!siteId ? null : siteId === 'bounty' ? (progress.data.bounty ? raidBounty(progress.data.bounty) : null) : SITES.find((x) => x.id === siteId) ?? null);
  // home: keep this share of the voyage's shards (from a sea trial, none, and nothing in the save changes). The voyage
  // is added to the Captain's record first (deeds.js finish: what it did, and anything it won), what's left of her comes
  // home with her (to be repaired at the dock), and the shards go into the claim's purse. With `card` (the game's own
  // ways home: Home to Brightvein between waves, the pause card's, or when her ship's lost) a patrol's homecoming card
  // shows over the Shipyard (record.js), with Sail again; otherwise (and from a raid, whose crates the claim opens) she's
  // home to the claim at once. A sea trial comes back to the Shipyard
  let summary = null, homing = false; // (the last voyage's, for the card; and its card about to show: pumpNotes)
  function endVoyage(keep, card = false) {
    const d = progress.data, tried = trial, got = tried ? 0 : Math.round(V.shards * keep), lost = W.sunk || !!player.down, id = player.ship.recipe.id;
    summary = tried ? null : deeds.finish({ got, keep, sunk: lost, gathered: V.shards - V.bonus, bonus: V.bonus });
    trial = null; said.length = 0;
    let raid = null;
    if (!tried) {
      progress.bank(got, W.raid ? 0 : W.n);
      d.downed = (d.downed ?? 0) + V.downed;
      // what's left of her comes home with her, to be repaired at the dock (a lost ship comes home in pieces)
      const cfg = d.ships[id];
      if (cfg) cfg.wear = lost ? { hull: 0.12, sails: 0.25, crystals: 0.25 } : Object.fromEntries(PARTS.map((k) => [k, Math.max(0.05, Math.round(player.frac(k) * 100) / 100)]));
      raid = raidResult(lost);
      progress.save();
    }
    const result = { got, downed: V.downed, waves: W.n, lost, ship: shipName(id), shipId: id, raid };
    raiders.clear(); bolts.clear(); pickups.clear(); gunnery.cancel(); wrecks.clear(); world.clear(); surge.clear(); wakes.clear(); hideBounties(); raidClear(); W.next = null;
    scene.remove(player.ship.root); // the Shipyard shows her (or the ship you were looking at) in its own scene
    looks.reset(player.ship); looks.clear(); // (spotless there, her scars patched and painted over)
    setPaused(false); // (leaving from the pause menu ends the pause, and that's told before the voyage's end)
    const E = payload('voyage:end'); E.kept = got; E.sunk = W.sunk; E.waves = W.n; E.trial = !!tried; emit('voyage:end');
    $('paused').hidden = true; $('howto').hidden = true; calmUp(false); bigMap(false); document.body.classList.remove('sinking');
    if (tried) {
      port.setMode('port');
      // (what she costs, and the ship to own first if the Shipyard sells her only after another)
      note(`Back from her sea trial: the ${shipName(tried)} costs ${price(tried)}${needs(tried)}`);
      return 0;
    }
    pending.push(result);
    if (card && summary && !raid) { homing = true; port.setMode('port'); homing = false; record.homecoming(summary); }
    else goHomeToClaim();
    return got;
  }
  // home to the claim, with every voyage since the skies were opened (Sail again from coming home's card sails another)
  function goHomeToClaim() {
    const list = pending.splice(0), last = list[list.length - 1];
    if (!last) { close(); return; }
    const sum = (k) => list.reduce((a, r) => a + (r[k] || 0), 0);
    close({ ...last, got: sum('got'), downed: sum('downed'), waves: Math.max(...list.map((r) => r.waves)), lost: list.some((r) => r.lost), voyages: list.length });
  }
  function newWind() { WIND.dir = Math.random() * Math.PI * 2; WIND.strength = WIND.base = 0.06 + Math.random() * 0.08; }
  // the wind, against the way the ship is heading: where it comes from (WIND.dir is the way it blows)
  const windWords = () => {
    const from = Math.abs(THREE.MathUtils.radToDeg(wrap(WIND.dir + Math.PI - player.heading)));
    return from > 125 ? 'the wind behind you' : from < 55 ? 'a head wind' : `a wind from your ${wrap(WIND.dir + Math.PI - player.heading) < 0 ? 'right' : 'left'}`;
  };
  // the port's note: shown at once, for five seconds, the quartermaster's line making way for it meanwhile (game.html);
  // a commendation won in port waits (noteLater) until the note showing has had 2.6 s, so both are read. And those
  // waiting are held while coming home's card is up over the port (or about to be), or away from port, and told once
  // it's closed (record.js onClose) or the port is entered again: never under the card's dimming
  let noteAt = -1e9, notingT = 0, laterT = 0;
  const laterNotes = [];
  function note(text) {
    const n = $('port-note'); n.textContent = text; n.classList.remove('on'); void n.offsetWidth; n.classList.add('on');
    noteAt = performance.now(); $('port').classList.add('noting'); clearTimeout(notingT); notingT = setTimeout(() => $('port').classList.remove('noting'), 5000);
  }
  function noteLater(text) { laterNotes.push(text); pumpNotes(); }
  function pumpNotes() {
    clearTimeout(laterT);
    if (!laterNotes.length || mode !== 'port' || homing || record.shown) return;
    const wait = noteAt + 2600 - performance.now();
    if (wait > 0) laterT = setTimeout(pumpNotes, wait); else { note(laterNotes.shift()); if (laterNotes.length) laterT = setTimeout(pumpNotes, 2600); }
  }
  // hiding in cloud: told once in a while as she slips into it (not every time she does), and when her guns give her away
  let hidNote = -99, gaveAway = -99;
  events.on('hidden', (e) => {
    if (mode !== 'voyage' || W.state !== 'fight') return; // (only worth saying with raiders about)
    if (e.on && time - hidNote > 25) { hidNote = time; toast('Hidden in the cloud: far-off raiders lose you'); }
    else if (!e.on && e.why === 'guns' && time - gaveAway > 12) { gaveAway = time; toast('Your guns gave you away'); }
  });
  // the raiders' nerve, their captains' tricks and the Man-o'-war's acts, said as they happen (tactics.js): a raider
  // running (catch her), her flare (and whether help came), a line of battle breaking up, a raider captain's trick,
  // the Man-o'-war launching her boats and sinking (a banner each), her guns silenced and her columns breaking
  const fighting = () => mode === 'voyage' && W.state === 'fight' && !player?.down;
  const named = (r) => (r.who ? r.who.name : `The ${r.R.cls}`);
  events.on('raider:run', (e) => { if (fighting()) toast(e.raider.line?.leader === e.raider && e.raider.line.why === 'run' ? `${named(e.raider)} runs for the clouds, and the line breaks` : `${named(e.raider)} is running for the clouds: catch her!`); });
  events.on('flare', (e) => {
    if (!fighting()) return;
    if (e.stage === 'fired') toast(`${named(e.raider)} fires a flare: sink her in ${NERVE.wait} s or help comes`);
    else if (e.stage === 'answered') toast(e.raider.flare.n > 1 ? `Help answers her flare: ${NUMBER[e.raider.flare.n]} ${skies().extra ? 'Cutters' : 'Skiffs'}` : `A ${skies().extra ? 'Cutter' : 'Skiff'} answers her flare`);
  });
  events.on('line', (e) => { if (fighting() && e.why !== 'run') toast('The line breaks: each fights on alone'); }); // (her running says it: raider:run)
  events.on('trick', (e) => {
    if (!fighting()) return;
    if (e.trick === 'cloud') toast(`${e.raider.who.name} dives into the cloud floor: watch below you`);
    else if (e.trick === 'smoke') toast(`${e.raider.who.name} vanishes in smoke: watch your other side`);
  });
  events.on('fortress', (e) => {
    if (!fighting()) return;
    if (e.act === 2) banner('She launches her boats', 'Two Skiffs from her stern · her plated sides still shrug off half');
    else banner('She\'s sinking, and fires everything', 'Her upper guns reach above her now · finish her from astern');
  });
  events.on('silenced', (e) => { if (fighting()) toast(`Six of her guns silenced: ${e.left} left`); });
  // (the first of a wave coming up through the clouds bursting through, said with where: she may be low in the view, or
  // off it, as on a phone held upright, whose view is narrow: then the toast points the way to look, an arrow on that
  // side of its words; and the tag of each one bursting through glows a moment, at the edge too: BURST_GLOW, tags).
  // Where she is is said from her bow ("ahead on your left"); but with the arrow pointing the other way from those words
  // (the view turned, looking astern, say, where she's on the left of the way you look though on the right of your
  // bow) it says which way to look instead ("look left"), so the arrow and the words always agree
  const burstAt = new THREE.Vector3();
  events.on('burst', (e) => {
    if (e.raider) e.raider.burstAt = time;
    if (!fighting() || !e.first) return;
    const bow = wrap(Math.atan2(e.at.x - player.pos.x, e.at.z - player.pos.z) - player.heading);
    burstAt.copy(e.at).project(camera);
    const rel = wrap(Math.atan2(e.at.x - camera.position.x, e.at.z - camera.position.z) - player.heading - cam.yaw), off = burstAt.z > 1 || Math.abs(burstAt.x) > 0.92;
    const arrow = off && Math.abs(rel) >= 0.12, said = sideWords(bow), look = rel > 0 ? 'left' : 'right';
    const words = `Rising through the clouds, ${arrow && /left|right/.test(said) && !said.includes(look) ? `look ${look}` : said}!`;
    toast(!arrow ? words : rel > 0 ? `\u2190 ${words}` : `${words} \u2192`);
  });
  events.on('blowout', (e) => {
    const W2 = e.raider?.ship.wear;
    if (!fighting() || !e.raider.fort || !W2) return;
    let n = 0; for (let i = 0; i < W2.clusters; i++) n += W2.blown[i];
    toast(n >= W2.clusters ? 'Her last crystal column breaks' : `A crystal column breaks: ${W2.clusters - n} left`);
  });
  // a giant bought: what she brings to the sky, said as she's bought (Chris: giant raiders only once you own one)
  const BOUGHT = { galleon: 'from now on, the treasure ships are Galleons', manowar: 'from now on, raiders sail Men-o\'-war too' };
  events.on('port:buy', (e) => note(`The ${shipName(e.ship)} is yours, and your flagship${BOUGHT[e.ship] ? `: ${BOUGHT[e.ship]}` : ''}`));
  // shot bought: how to load it at sea
  events.on('port:shot', (e) => note(`${SHOTS[e.shot].name} aboard, for every ship: ${touch ? 'tap the shot button over Surge at sea' : `press ${SHOTS[e.shot].key} at sea`}`));
  // another claim's fleet loaded (the claim's save: progress.reload): her ships put back in the colours it has for them
  progress.onLoad((d) => { for (const [id, s] of built) applyPaint(s, d.ships[id]?.paint); });
  // what the Captain's record pays out (deeds.js): at sea a toast, once the one showing has had 2.2 s (so a kill's isn't
  // cut short: `said`, taken in turn by the HUD, ten times a second); in port the note. A rank risen is told on coming
  // home's card, not mid-fight
  const said = [], SAID = { medal: (e) => `Commendation: ${e.name} · ◆ ${fmt(e.reward)}`, star: (e) => `${e.name} · ◆ ${fmt(e.reward)}`, order: (e) => `Order done: ${e.name} · ◆ ${fmt(e.reward)}`, orders: (e) => `${e.name} · ◆ ${fmt(e.reward)}` };
  events.on('deed', (e) => {
    const words = SAID[e.kind]?.(e);
    if (!words) return;
    if (mode === 'voyage') { if (said.length < 6) said.push(words); } else noteLater(words);
  });

  // ---------- the camera: behind the ship, swung round it by the mouse or a drag ----------
  const cam = { yaw: 0, pitch: 0.2, dist: 40, zoom: 1, look: new THREE.Vector3() };
  let viewFov = 55; // the view's width (degrees) before a Surge, slow motion and the guns' punch: wider on a phone held upright
  // (how far behind her the view sits: further for a bigger ship, and a little further again past 40 m, so a Galleon or
  // a Man-o'-war sits wholly in the lower part of the view, her stern in sight, with the raiders clear above her masts)
  const camDistFor = (R) => R.length * 1.35 + 16 + Math.max(0, R.length - 40) * 0.4;
  // looking down past her own ship: the point the view turns round (over her middle, `R.length * 0.42 + 2` up) moves out
  // over her bow, her side or her stern, whichever way the view looks, just as far as the middle of the view must to
  // pass over her rail with `clear` of her length to spare. So a raider below her, aimed at, is never behind her own
  // ship (a Man-o'-war's long hull and tall masts hid one ahead and below), and the farther down it looks, the farther
  // out the view moves, out to her rail at the most; and only as the view looks further down than it rests (pivot)
  // ...over all of her as she stands, masts and sails too: her `footprint`, the highest point of her model in each
  // square of a grid over her deck (squares a 30th of her length, made once for each ship as she's first sailed), and
  // the squares that lie within `clear` of the line the view looks along count in full, fading out over `soft` squares'
  // half-widths further off it (and over one square's width about her middle): so a mast head coming near the line as
  // the view turns raises the move gradually, never all at once (with a hard edge the view jumped 5 to 18 m sideways in
  // one turn of the mouse). And the move itself is followed, not copied: a spring that settles in about a quarter of a
  // second (`ease`, critically damped, worked out in steps of at most `step` s so a slow phone moves the same)
  const VIEW_PAST = { clear: 0.05, least: 0.5, soft: 2, ease: 20, step: 1 / 120 }, feet = new Map();
  const viewPast = { x: 0, z: 0, vx: 0, vz: 0 }; // (the move the camera has: in her own frame, so it turns with her; followed by its spring)
  function footprint(ship) {
    const L = ship.recipe.length, cs = Math.max(1, L / 30), top = new Map(), v = new THREE.Vector3(), m = new THREE.Matrix4(), inv = new THREE.Matrix4();
    ship.root.updateMatrixWorld(true); inv.copy(ship.root.matrixWorld).invert();
    ship.body.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const P = o.geometry.attributes.position; m.multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m);
        const k = `${Math.floor(v.x / cs)},${Math.floor(v.z / cs)}`;
        if (!(top.get(k) >= v.y)) top.set(k, v.y);
      }
    });
    const cells = new Float32Array(top.size * 3); let i = 0;
    for (const [k, y] of top) { const [x, z] = k.split(',').map(Number); cells.set([(x + 0.5) * cs, (z + 0.5) * cs, y], i * 3); i++; }
    return { cells, half: cs * 0.71 };
  }
  // how far out the view must move, looking `yaw` round from her bow and `pitch` down
  const ss = THREE.MathUtils.smoothstep;
  function pastFor(yaw, pitch) {
    const R = player.ship.recipe, h0 = R.length * 0.42 + 2, F = player.foot, tp = Math.tan(pitch);
    if (!F || tp <= 0.02 || pitch <= 0.21) return 0;
    // (the look's way across her deck, in her own frame; and each square ahead that way, near the line: how far out
    // the view must move to pass over it, times how near the line it lies)
    const dx = Math.sin(yaw), dz = Math.cos(yaw), clear = Math.max(VIEW_PAST.least, R.length * VIEW_PAST.clear), C = F.cells, edge = clear + VIEW_PAST.soft * F.half;
    let past = 0;
    for (let i = 0; i < C.length; i += 3) {
      const along = C[i] * dx + C[i + 1] * dz, across = Math.abs(C[i + 1] * dx - C[i] * dz);
      if (along <= -F.half || across >= edge) continue;
      const need = (along - (h0 - C[i + 2] - clear) / tp) * (1 - ss(across, clear, edge)) * ss(along, -F.half, F.half);
      if (need > past) past = need;
    }
    return past * ss(pitch, 0.21, 0.36); // (as the view rests, a little down, never: a small ship's mast heads reach nearly as high)
  }
  // the point the view turns round, looking that way (straight away: the camera follows it, placeCamera)
  function pivot(yaw, pitch, out) {
    const past = pastFor(yaw, pitch), a = player.heading + yaw;
    out.copy(player.pos); out.y += player.ship.recipe.length * 0.42 + 2;
    out.x += Math.sin(a) * past; out.z += Math.cos(a) * past;
    return out;
  }
  // the camera's move followed, this step
  function followPast(dt, yaw, pitch) {
    const past = pastFor(yaw, pitch), wx = Math.sin(yaw) * past, wz = Math.cos(yaw) * past, w = VIEW_PAST.ease, P = viewPast;
    const n = Math.ceil(dt / VIEW_PAST.step - 1e-6), h = dt / Math.max(1, n);
    for (let i = 0; i < n; i++) {
      P.vx += (w * w * (wx - P.x) - 2 * w * P.vx) * h; P.x += P.vx * h;
      P.vz += (w * w * (wz - P.z) - 2 * w * P.vz) * h; P.z += P.vz * h;
    }
  }
  // a Surge widens the view by `fov` degrees, with a jolt: a spring that overshoots a little, peaking about 0.15 s in
  // (with no overshoot for players whose device asks for less motion). The spring is worked out in steps of at most
  // `step` seconds, so it moves the same on a phone running slowly as on a fast laptop (in one big step it would fly off)
  const SURGE_VIEW = { fov: 12, k: 550, c: 21, calm: 47, step: 1 / 120 }, surgeFov = { x: 0, v: 0 }, lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function surgeView(dt) {
    const want = player.surge.on > 0 && !player.down ? SURGE_VIEW.fov : 0, c = lessMotion.matches ? SURGE_VIEW.calm : SURGE_VIEW.c;
    const n = Math.ceil(dt / SURGE_VIEW.step - 1e-6), h = dt / Math.max(1, n);
    for (let i = 0; i < n; i++) { surgeFov.v += (SURGE_VIEW.k * (want - surgeFov.x) - c * surgeFov.v) * h; surgeFov.x += surgeFov.v * h; }
  }
  const aimPoint = new THREE.Vector3(), target = new THREE.Vector3(), toR = new THREE.Vector3(); // (kept, not made each frame)
  let locked = null, reach = true, wasLocked = null;
  const LOCK = payload('lock');
  function placeCamera(dt, inp) {
    // (how far a drag swings the view: the Settings card's aim speed, and up and down the other way round if flipped)
    const sens = (inp.locked ? 0.0026 : touch ? 0.0042 : 0.005) * AIM[settings.data.aim];
    cam.yaw -= inp.look.x * sens;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + inp.look.y * sens * (settings.data.flip ? -1 : 1), -0.35, 1.25);
    cam.zoom = THREE.MathUtils.clamp(cam.zoom * Math.pow(1.12, inp.zoom), 0.55, 2.6);
    // left alone for a while (and not mouse-locked), the camera eases back behind the ship
    const idle = performance.now() / 1000 - inp.lastLook;
    if (!inp.locked && idle > 3.5 && !inp.fire) {
      const k = 1 - Math.exp(-dt * 1.2);
      cam.yaw = Math.atan2(Math.sin(cam.yaw), Math.cos(cam.yaw)) * (1 - k); cam.pitch += (0.2 - cam.pitch) * k;
    }
    // (a Surge drops the view back a little and lowers it, with the view's widening: surgeFov, 0 to about 1)
    const a = player.heading + cam.yaw, sk = surgeFov.x / SURGE_VIEW.fov, pitch = cam.pitch - 0.03 * sk;
    cam.look.set(Math.sin(a) * Math.cos(pitch), -Math.sin(pitch), Math.cos(a) * Math.cos(pitch));
    // (over her middle; looking down, out over her rail that way)
    followPast(dt, cam.yaw, pitch);
    const ch = Math.cos(player.heading), sh = Math.sin(player.heading);
    target.copy(player.pos); target.y += player.ship.recipe.length * 0.42 + 2;
    target.x += viewPast.x * ch + viewPast.z * sh; target.z += viewPast.z * ch - viewPast.x * sh;
    camera.position.copy(target).addScaledVector(cam.look, -cam.dist * cam.zoom * (1 + 0.08 * sk));
    camera.lookAt(target);
    fx.applyCamera(camera, cam.look); // the guns' kick, and the shake from hits and blasts
    camera.updateMatrixWorld(); // (read straight away to place things on screen, even when nothing is drawn)
    // the guns lock on to the raider nearest the crosshair, and lead it
    locked = null;
    let bestA = Infinity;
    for (const r of raiders.list) {
      if (r.f.down || r.lost) continue; // (one hidden in cloud far off can't be locked on to)
      const v = toR.copy(r.f.pos).sub(camera.position), along = v.dot(cam.look);
      if (along <= 0) continue;
      const ang = v.angleTo(cam.look), tol = Math.max(0.05, Math.atan((r.R.length * 0.8) / along));
      if (ang < tol && ang < bestA) { bestA = ang; locked = r; }
    }
    if (locked !== wasLocked) { wasLocked = locked; if (locked) { LOCK.raider = locked; emit('lock'); LOCK.raider = null; } }
    player.locked = locked;
    aimPoint.copy(target).addScaledVector(cam.look, 800);
  }
  function aimFor(battery) {
    reach = true;
    if (!locked) return;
    player.ship.root.updateMatrixWorld(true);
    const m = gunnery.muzzle(battery);
    if (!m) { reach = false; return; }
    // (her sails for chain shot, her crystals for breakers; leading her by the shot's own speed: chain shot is slower)
    intercept(m.p, player.velocity, locked.f.aimAt(gunnery.shot), locked.f.velocity, m.K.speed * SHOTS[gunnery.shot].speed, aimPoint);
    reach = gunnery.reaches(battery, aimPoint, m);
  }

  // ---------- shots landing ----------
  // a shot's path this frame, from a to c: did it hit a raider (the Captain's) or the Captain's ship (a raider's)?
  // Each hit is told to the events (the sparks, shake and buzz answer it, fx.js), and marked on the HUD. A raider's
  // shot that only just misses flares and is told as a near miss. How hard it hits: its weight, times its shot's on the
  // part it hits (tactics.js SHOTS: chain shot shreds sails, breakers crack crystals), times half as much again for a
  // broadside's shot raking her, down her length from across her bow or stern (rakeMul), either way. A plated ship's
  // hull (the Man-o'-war's, Ironsides') shrugs off half a hit from her side, and a rake does double (plateMul); the
  // Man-o'-war's stern windows take double from astern, and a hit in one of her blocks of guns hurts the block in full
  // (raiders.js blockHit: at nothing left, its six guns are silenced)
  const HIT = payload('hit'), NEAR = payload('nearMiss'), LOW = payload('player:low');
  const local = new THREE.Vector3(), inv = new THREE.Matrix4();
  function hitTest(b, a, c) {
    if (b.owner === 'player') {
      const h = raiders.hitBy(a, c);
      if (!h) return false;
      const r = h.r, part = h.h.part, was = !!r.f.down, along = b.K === KINDS.broadside && rakeMul(b.v, r.ship.body) > 1, shot = b.damage * SHOTS[b.shot][part];
      let rake = along ? RAKE.mul : 1;
      if (r.plated && part === 'hull') {
        rake = plateMul(b.v, r.ship.body, along);
        if (r.fort) {
          local.copy(h.h.at).applyMatrix4(inv.copy(r.ship.body.matrixWorld).invert());
          if (fromAstern(b.v, r.ship.body) && local.z < r.ship.hull.zs + PLATE.aft * r.R.length) rake = Math.max(rake, PLATE.stern);
          else raiders.blockHit(r, local, shot);
        }
      }
      const damage = shot * rake;
      r.f.hit(part, damage); V.hits++;
      HIT.owner = 'player'; HIT.target = 'raider'; HIT.part = part; HIT.at.copy(h.h.at); HIT.damage = damage; HIT.raider = r; HIT.size = b.K.size; HIT.raked = along; HIT.kind = b.K === KINDS.broadside ? 'broadside' : 'chaser'; HIT.shot = b.shot;
      HIT.dir.copy(b.v).normalize(); HIT.vel.copy(r.f.velocity); emit('hit');
      hitMark(part, !was && !!r.f.down); tagFlash(r, part);
      if (along) raked('player', r, h.h.at);
      return true;
    }
    // (Brightvein: the places raided, their gun towers and drill engines, and the rock or the cliff: raids.js)
    if (raidHit(b, a, c)) return true;
    if (b.owner === 'player') return false;
    // (a raider's shot at one of the claim's barges)
    const fh = raiders.friends.length ? raiders.hitFriend(a, c) : null;
    if (fh) { fh.r.f.hit(fh.h.part, b.damage * SHOTS[b.shot][fh.h.part]); fx.burst(fh.h.at, 0xffa040, 12, 0.8); return true; }
    if (player.down) return false;
    const h = firstHit(zones.get(player.ship.recipe.id), player.ship.body, a, c, player.ship.U.uFold.value.x);
    if (!h) { nearMiss(b, a, c); return false; }
    const before = player.frac(h.part), rake = b.K === KINDS.broadside ? rakeMul(b.v, player.ship.body) : 1, damage = b.damage * SHOTS[b.shot][h.part] * rake;
    player.hit(h.part, damage);
    HIT.owner = 'raider'; HIT.target = 'player'; HIT.part = h.part; HIT.at.copy(h.at); HIT.damage = damage; HIT.raider = b.from; HIT.size = b.K.size; HIT.raked = rake > 1; HIT.kind = b.K === KINDS.broadside ? 'broadside' : 'chaser'; HIT.shot = b.shot;
    HIT.dir.copy(b.v).normalize(); HIT.vel.copy(player.velocity); emit('hit');
    if (before >= 0.3 && player.frac(h.part) < 0.3) { LOW.part = h.part; emit('player:low'); }
    hurt = Math.min(1, hurt + (rake > 1 ? 0.75 : 0.45)); // (raked, the red at the screen's edge flares harder)
    incoming(b, h.part);
    if (rake > 1) raked('raider', b.from, h.at);
    return true;
  }
  // raking fire, told once a volley (its first raking hit: a broadside's shots land within half a second): yours marked
  // "Raked!" by the crosshair; a raider raking you, the first time in a voyage, is explained in a toast
  const RAKED = payload('raked'), lastRake = { player: -9, raider: -9 };
  let rakedNote = false, rakeAnim = null;
  function raked(owner, r, at) {
    if (time - lastRake[owner] < 0.6) return;
    lastRake[owner] = time;
    RAKED.owner = owner; RAKED.raider = r; RAKED.at.copy(at); emit('raked'); RAKED.raider = null;
    if (owner === 'player') { rakeAnim?.cancel(); rakeAnim = $('raked').animate([{ opacity: 1, transform: 'scale(1.35)' }, { opacity: 1, transform: 'scale(1)', offset: 0.18 }, { opacity: 1, transform: 'scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 1300, easing: 'ease-out' }); } // (at full strength most of 1.3 s, so it's seen)
    else if (!rakedNote) { rakedNote = true; toast('Raked! Don\'t let them cross your bow'); }
  }
  // a raider's shot passing close: once it's past its nearest point to the ship (not while it's still coming on, as
  // it might yet hit), within her length and a bit
  const seg = new THREE.Line3(), near = new THREE.Vector3(), nv = new THREE.Vector3();
  function nearMiss(b, a, c) {
    if (b.whiz) return;
    const t = seg.set(a, c).closestPointToPointParameter(player.pos, true);
    if (t >= 1) return;
    const limit = player.ship.recipe.length * 0.6 + 14, d = seg.at(t, near).distanceTo(player.pos);
    if (d > limit) return;
    b.whiz = true; b.flare = 0.12;
    nv.copy(near).applyMatrix4(camera.matrixWorldInverse);
    NEAR.pan = THREE.MathUtils.clamp(nv.x / 15, -1, 1); NEAR.close = 1 - d / limit; NEAR.at.copy(near);
    emit('nearMiss');
  }

  // ---------- shot, and patching her ----------
  // the shot her guns are loaded with (tactics.js): one she has (round shot always; chain shot and breakers once earned
  // or bought; breakers while any are left) is loaded, every battery reloading for it, and said so (1, 2 or 3 on a
  // laptop); the next she has, for V or a right-click, or the phone's shot button
  const SHOT = payload('shot'), PATCHED = payload('patch');
  const hasShot = (s) => s === 'round' || (!!progress.data.shots?.[s] && (s !== 'breaker' || gunnery.breakers > 0));
  const extraShots = () => !!(progress.data.shots?.chain || progress.data.shots?.breaker);
  function pickShot(s, why = 'pick') {
    if (!gunnery || player.down || !SHOTS[s] || s === gunnery.shot) return false;
    if (!hasShot(s)) {
      toast(s === 'breaker' && progress.data.shots?.breaker ? 'Out of crystal breakers' : `No ${SHOTS[s].name.toLowerCase()} yet: earn ${s === 'breaker' ? 'them' : 'it'} at sea or buy in port`);
      return false;
    }
    gunnery.setShot(s);
    SHOT.shot = s; SHOT.why = why; SHOT.left = gunnery.breakers; emit('shot');
    toast(why === 'out' ? 'Out of crystal breakers: loading round shot' : `Loading ${SHOTS[s].name.toLowerCase()}${s === 'breaker' ? ` (${gunnery.breakers} volley${gunnery.breakers === 1 ? '' : 's'} left)` : ''}`);
    shotsShown();
    return true;
  }
  const nextShot = () => { const i = SHOT_ORDER.indexOf(gunnery.shot); for (let k = 1; k < SHOT_ORDER.length; k++) { const s = SHOT_ORDER[(i + k) % SHOT_ORDER.length]; if (hasShot(s)) return s; } return gunnery.shot; };
  // the next shot she has loaded (V or a right-click on a laptop, the phone's shot button); with nothing else aboard,
  // a toast says how to get more
  function cycleShot() {
    if (!gunnery || player.down) return;
    const s = nextShot();
    if (s !== gunnery.shot) pickShot(s);
    else toast(extraShots() ? 'Out of crystal breakers' : 'Only round shot aboard: earn chain shot at sea or in port');
  }
  // a kind of shot earned by a deed: kept in the save, the phone's button shown, and said in a banner (how to load it)
  // once this frame's raiders are counted (waves()): straight away while the fight goes on. A deed that ends the wave
  // (a treasure ship that ran, caught last; a raider captain, often the last down) is said on the card between waves
  // instead ("Chain shot is yours!"), and in the banner as the next wave nears, when the shot button shows again (the
  // card would lie over the banner on a phone held sideways, and the button waits out of sight meanwhile). W.news:
  // those still to tell
  function earn(s, line) {
    const d = progress.data;
    if (d.shots[s]) return;
    d.shots[s] = true; progress.save();
    SHOT.shot = s; SHOT.why = 'earned'; SHOT.left = gunnery.breakers; emit('shot');
    W.news.push({ s, line });
    shotsShown();
  }
  // how to load it, in words: on a phone the shot button over Surge, on a laptop its key ("press 2", "press 2 or 3")
  const loadWords = (list) => (touch ? 'tap the shot button over Surge' : `press ${list.map((n) => SHOTS[n.s].key).join(' or ')}`);
  // the banner for the news (one kind: its name and the deed; both at once: both names), and until when it shows (real
  // time, in ms), so the card between waves can cut it short and tell it itself
  const newsUp = { list: [], until: 0 };
  function tellNews() {
    const L = W.news;
    if (L.length === 1) banner(`${SHOTS[L[0].s].name}!`, `${L[0].line}: ${loadWords(L)}`);
    else banner(`${SHOTS[L[0].s].name} and ${SHOTS[L[1].s].name.toLowerCase()}!`, `In their holds: ${loadWords(L)}`);
    newsUp.list = L.slice(); newsUp.until = bannerAt.until; L.length = 0;
  }
  // the news on the card between waves: its title ("Chain shot is yours!"), the wave beaten said in its line instead
  // (short: the card is small on a phone held sideways, and how to load it comes in the banner, with the button there)
  const newsCard = (L) => (L.length === 1 ? { title: `${SHOTS[L[0].s].name} is yours!`, line: '' } : { title: 'Two new kinds of shot!', line: `: ${SHOTS[L[0].s].name.toLowerCase()} and ${SHOTS[L[1].s].name.toLowerCase()} are yours` });
  // the phone's shot button (shown once she has more than round shot) and the guns' label, as her shot changes
  const shotHex = (s) => `#${SHOTS[s].color.toString(16).padStart(6, '0')}`;
  function shotsShown() {
    if (!gunnery) return;
    const s = gunnery.shot, more = extraShots(), b = $('btn-shot'), key = `${s}:${more}:${gunnery.breakers}`;
    if (b._key === key) return;
    b._key = key;
    if (document.body.classList.contains('has-shot') !== more) { document.body.classList.toggle('has-shot', more); b.hidden = !more; layout(); }
    b.innerHTML = `${SHOT_ICON[s]}<small>${SHOTS[s].short}</small>${s === 'breaker' ? `<b class="left">${gunnery.breakers}</b>` : ''}`; // (the breakers left: a badge on its shoulder)
    b.style.setProperty('--shot', shotHex(s)); b.setAttribute('aria-label', `${SHOTS[s].name} loaded${s === 'breaker' ? ` (${gunnery.breakers} left)` : ''}: tap for the next`);
    setText($('battery-shot'), more ? ` · ${SHOTS[s].name}${s === 'breaker' ? ` (${gunnery.breakers})` : ''}` : '');
    setStyle($('reload-bar'), 'background', shotHex(s));
  }
  // the crew patching her (flight.js startPatch: X, or the phone's Patch button), said in a toast; told as it starts and
  // as it's done. Refused while they're at it or getting ready again (saying how long), or with nothing to patch
  let wasPatching = false;
  function patchUp() {
    if (!player || player.down) return;
    const P = player.patch;
    if (P.cd > 0) { toast(P.t > 0 ? `The crew are patching the ${P.part}` : `The crew can patch her again in ${Math.ceil(P.cd)} s`); return; }
    const part = player.startPatch();
    if (!part) { toast(player.frac(player.worst()) < 1 ? 'The crew have patched her as far as they can: the rest waits for the dock' : 'Nothing to patch'); return; }
    toast(`The crew patch the ${part}: guns reload slower for ${PATCH.time} s`);
    PATCHED.part = part; PATCHED.stage = 'start'; emit('patch'); wasPatching = true;
  }

  // ---------- the raiders come in waves; between them, sail on or go home ----------
  // a wave in words: its raider captain's ship first (by her name: "Senna Vale's Brig", or "her Brig" with `her`), then
  // its treasure ships, then the rest, biggest first ("a raider captain's Frigate, a treasure Brig, two Frigates and a
  // Cutter")
  function describe(wave, her = false) {
    const groups = new Map(), plural = (c) => (c === 'Man-o\'-war' ? 'Men-o\'-war' : `${c}s`);
    const add = (key, order, one, many) => { const g = groups.get(key) ?? { order, n: 0, one, many }; g.n++; groups.set(key, g); };
    wave.ids.forEach((id, i) => {
      const c = FLEET.find((s) => s.id === id).cls;
      if (i === wave.captain) add('captain', -1000, wave.who ? `${her ? 'her' : `${wave.who.name}'s`} ${c}` : `a raider captain's ${c}`, '');
      else if (treasureShip(wave, i)) add('treasure:' + id, i - 100, `treasure ${c}`, `treasure ${plural(c)}`);
      else add(id, i, c, plural(c));
    });
    const parts = [...groups.values()].sort((a, b) => a.order - b.order).map((g) => (g.many === '' ? g.one : `${NUMBER[g.n]} ${g.n > 1 ? g.many : g.one}`));
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  }
  // which giants the Captain owns: only those sail among the raiders (raiders.js waveAt). Read as a voyage starts (she
  // can't buy one at sea)
  const giants = { galleon: false, manowar: false };
  // the raider captain who leads a captain wave (tactics.js CAPTAINS; k: which captain wave of the voyage, from 0): one
  // who sank the Captain's ship and is still loose (the highest price on her head first), or else the one for that
  // wave in order, if she's not been met this voyage; failing that, the first not met yet (after the sixth, any not met
  // at random), or any at random. A sea trial holds no grudges: it changes nothing in the save
  const grudges = () => progress.data.captains ?? (progress.data.captains = {});
  function captainFor(k) {
    const C = grudges(), met = W.met, free = CAPTAIN_ORDER.filter((id) => !met.includes(id));
    if (!trial) { let best = null; for (const id of free) if ((C[id]?.sank ?? 0) > (best ? C[best].sank : 0)) best = id; if (best) return captainById(best); }
    if (free.includes(CAPTAIN_ORDER[k])) return captainById(CAPTAIN_ORDER[k]);
    const pool = free.length ? free : CAPTAIN_ORDER;
    return captainById(k < CAPTAIN_ORDER.length && free.length ? free[0] : pool[Math.floor(Math.random() * pool.length)]);
  }
  // her bounty: a quarter more for each time she's sunk the Captain's ship and got away (three times at the most), and
  // the price on her head, in shards (before the skies' and the wave's bonus)
  const sankBy = (who) => (trial || !who ? 0 : grudges()[who.id]?.sank ?? 0);
  function name(w, k, more = 1) { w.who = captainFor(k); w.sank = sankBy(w.who); w.bounty = more * wantedMul(w.sank); return w; }
  // the wave n: the skies' raiders, its storm (none on a sea trial), and its raider captain named (not a Man-o'-war's
  // stand-in, who isn't one of them), or none if she was hunted down early (W.plainAt)
  function nextWave(n) {
    const w = waveAt(n, skies().extra, trial ? null : skies().storms, giants, n === W.plainAt);
    if (n === 0 && W.gentle) w.gentle = true; // (a brand-new Captain's first raider: ahead, closer, holding her fire)
    return w.captain >= 0 && !w.standIn ? name(w, Math.floor((n + 1) / 5) - 1) : w;
  }
  // the second way on, beside the steady course `next` (tactics.js ROADS; raiders.js roadWave), from the card after
  // wave 2: whichever of these the wave allows, the one offered longest ago (or never yet this voyage: so each comes up
  // in turn, and a treasure ship's trail, allowed only now and then, is offered when it is): into the storm (not on Fair
  // Winds, which never storms, nor when a storm's coming anyway), a treasure ship's trail (when none has come for three
  // waves, and none is next) and hunting the next raider captain early (when her wave is within three: in a Brig at
  // least, a Frigate from the second captain on). None when a raider captain or a Man-o'-war is next (she bars the
  // way), or on a sea trial
  const ROAD_ORDER = ['treasure', 'hunt', 'storm']; // (the order they're offered in, the first time each is allowed)
  function roadFor(next) {
    if (trial || W.n < ROAD.from || next.captain >= 0 || next.ids.includes('manowar')) return null;
    let m = W.n + 1; while ((m + 1) % 5) m++; // (the next captain wave after this one)
    let kind = null;
    for (const k of ROAD_ORDER) {
      const ok = k === 'storm' ? progress.data.skies !== 'fair' && !next.storm : k === 'treasure' ? !hasTreasure(next) && W.n - W.treasureAt > ROAD.treasureGap : m - W.n <= ROAD.huntWithin && W.plainAt !== m;
      if (ok && (kind === null || W.offered[k] < W.offered[kind])) kind = k;
    }
    if (!kind) return null;
    W.offered[kind] = W.n;
    const w = roadWave(kind, next, giants, m === 4 ? 'brig' : 'frigate');
    if (kind === 'hunt') { name(w, (m + 1) / 5 - 1, ROADS.hunt.bounty); w.huntFor = m; w.early = m - W.n; }
    return w;
  }
  // the second way on, on the card: its name and what it brings, in a line ("The same raiders, in a storm: half as many
  // shards again", or "The same Frigate, in a storm..." when the steady course is one ship; "The same raiders, and a
  // treasure Brig to catch"; "The Sail-Ripper, two waves early: half as much again on her head")
  const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const MULT_WORDS = { 1.5: 'half as many shards again', 2: 'twice the shards', 1.75: 'three quarters as many shards again', 1.25: 'a quarter more shards' };
  const HEAD_WORDS = { 1.25: 'a quarter more', 1.5: 'half as much again', 2: 'twice as much' };
  function roadWords(alt, next) {
    if (alt.road === 'storm') {
      const c = FLEET.find((s) => s.id === alt.ids.find((id) => alt.ids.filter((x) => x === id).length > next.ids.filter((x) => x === id).length))?.cls;
      const same = next.ids.length === 1 ? describe(next).replace(/^a /, '') : 'raiders';
      return [ROADS.storm.name, `The same ${same}${c ? ` and a ${c}` : ''}, in a storm: ${MULT_WORDS[ROADS.storm.mult] ?? `${ROADS.storm.mult} times the shards`}`];
    }
    if (alt.road === 'treasure') return [ROADS.treasure.name, `The same raiders, and a treasure ${FLEET.find((s) => s.id === alt.ids[alt.treasure[0] ?? alt.ids.indexOf('galleon')]).cls} to catch`];
    return [`Hunt ${alt.who.name}`, `${capital(alt.who.title)}, ${alt.early > 1 ? `${NUMBER[alt.early]} waves` : 'a wave'} early: ${HEAD_WORDS[ROADS.hunt.bounty] ?? `${ROADS.hunt.bounty} times`} on her head`];
  }
  const NUM = new Intl.NumberFormat('en'), fmt = (n) => NUM.format(Math.round(n)); // (one formatter, made once: a phone is slow to make them)
  // a ship's price, in one piece on the screen (never "◆" at the end of one line and the number on the next); and the
  // ship to own first, if the port sells her only after another (", once you own the Doldrums")
  const price = (id) => costText(SHIPYARD[id].price);
  const needs = (id) => { const first = NEEDS[id] && !progress.data.ships[NEEDS[id]].owned ? NEEDS[id] : null; return first ? `, once you own the ${shipName(first)}` : ''; };
  // where a wave is coming from, in words (raiders.js spawnWave says how: `a` its bearing): ahead, from both sides (each
  // side's words), up through the clouds below, out of the sun above, high and low, in a line. `said`: the banner's
  // title says how it comes already ("Wave 7: out of the sun!"), so the words say only where; `short`: fewer words
  function arrival(arr, said = false, short = false) {
    const side = sideWords(arr.a - player.heading), H = arr.how;
    if (H === 'pincer') return said ? (short ? '' : `${side} and ${sideWords(arr.a + Math.PI - player.heading)}`) : short ? 'on both sides' : `${side} and ${sideWords(arr.a + Math.PI - player.heading)}`;
    const how = H === 'below' ? 'below you' : H === 'sun' ? 'above you' : H === 'stack' ? 'above and below you' : '';
    return said ? (H === 'sun' ? `above you, ${side}` : side) : how ? (short ? how : `${how}, ${side}`) : side;
  }
  // a wave's banner, by how it comes ("Wave 3: up through the clouds!")
  const COMING = { ahead: '', pincer: 'from both sides!', below: 'up through the clouds!', sun: 'out of the sun!', stack: 'high and low!', line: 'a line of battle!' };
  // A wave's banner as it comes (`arr`: how and where from, raiders.js spawnWave): its title, a named raider captain's
  // name ("Wave 5: Senna Vale"; "Wanted: Senna Vale" with a price on her head), a treasure ship's, a raider captain's, a
  // Man-o'-war's, or how it comes ("Wave 3: up through the clouds!"); and its line: a named captain's title, her trick and
  // where she is (or the price on her head), or what's coming, where from in left and right words (not how it comes,
  // when the title says it), the wind, and a treasure ship's hint. The line is kept to BANNER_LINE letters, so it fits a
  // phone (two lines at most, clear of the toast and the crosshair: tools/check.mjs layoutAt tries the longest): the wind
  // left out first, then both sides' words made short, then the hint, then the ships just counted. A hint left out of it,
  // and the Man-o'-war's ("Plated sides: go for her columns, her guns or her stern") always, is said in a toast once the
  // banner has gone (`hint`)
  const BANNER_LINE = 80, HINT_AFTER = 4.6;
  function waveBanner(wave, arr) {
    const at = trial ? 'Sea trial' : `Wave ${W.n + 1}`, prize = hasTreasure(wave), rich = treasureCount(wave), fort = wave.ids.includes('manowar');
    const coming = arr.how === 'ahead' && wave.road === 'storm' ? 'into the storm!' : COMING[arr.how] ?? '';
    const title = wave.who ? `${wave.sank && !trial ? 'Wanted' : at}: ${wave.who.name}` : prize ? `${at}: ${rich > 1 ? `${NUMBER[rich]} treasure ships` : 'a treasure ship'}` : wave.captain >= 0 ? `${at}: a raider captain` : fort ? `${at}: a Man-o'-war`
      : coming ? `${at}: ${coming}` : trial ? 'Sea trial: raiders' : `Raiders, wave ${W.n + 1}`;
    if (wave.who) {
      // (where she is: below you or above you too, coming up through the clouds or out of the sun, if that fits)
      const trick = `${wave.who.title}: ${wave.who.line} · `, side = sideWords(arr.a - player.heading), up = arr.how === 'below' ? 'below you, ' : arr.how === 'sun' ? 'above you, ' : '';
      const where = wave.sank && !trial ? `◆ ${fmt(BOUNTY[wave.ids[wave.captain]] * CAPTAIN.bounty * wave.bounty * skies().shards)} on her head` : (trick + up + side).length <= BANNER_LINE ? up + side : side;
      return { title, line: trick + where, hint: '' };
    }
    const said = !!coming && title === `${at}: ${coming}`, what = describe(wave), wind = windWords(), n = wave.ids.length;
    const hint = prize ? (rich > 1 ? 'shoot their sails to catch them' : 'shoot her sails to catch her') : '', toastHint = fort ? 'Plated sides: go for her columns, her guns or her stern' : '';
    const full = arrival(arr, said), short = arrival(arr, said, true), counted = fort ? `a Man-o'-war and ${NUMBER[n - 1]} more` : `${NUMBER[n]} raiders`;
    const join = (w, where, h, wd) => `${w}${where ? `, ${where}` : ''}${wd ? ` · ${wd}` : ''}${h ? ` · ${h}` : ''}`;
    const tries = [[what, full, hint, wind], [what, full, hint, ''], [what, short, hint, ''], [what, full, '', wind], [what, full, '', ''], [what, short, '', ''], [counted, short, '', '']];
    let pick = tries[tries.length - 1];
    for (const t of tries) if (join(...t).length <= BANNER_LINE) { pick = t; break; }
    const left = hint && !pick[2] ? hint.charAt(0).toUpperCase() + hint.slice(1) : '';
    return { title, line: join(...pick), hint: toastHint || left };
  }
  const DOWN = payload('raider:down'), SPILL = payload('shards:spill');
  function waves(dt, gone) {
    for (const r of gone) {
      V.downed++;
      DOWN.raider = r; DOWN.why = r.f.down.why; DOWN.at.copy(r.f.pos); emit('raider:down'); // (her end in the sky: wrecks.js)
      // deeds that earn a kind of shot (not on a sea trial: it changes nothing): chain shot from the first treasure ship
      // that strikes to her, crystal breakers from the first raider captain's Frigate she sinks
      if (!trial && r.role === 'prize' && r.f.down.why === 'struck') earn('chain', 'Her crew left chain shot in the hold');
      if (!trial && r.captain && r.id === 'frigate') earn('breaker', 'Crystal breakers in her hold');
      // a named raider captain brought down: remembered (and the price on her head is gone)
      if (!trial && r.who) { const c = grudges()[r.who.id] ??= { beaten: 0, sank: 0 }; c.beaten++; c.sank = 0; progress.save(); }
      const why = r.f.down.why, beaten = why === 'struck' && r.role !== 'prize'; // (a crew who struck her colours: half as many shards again)
      const who = r.who ? r.who.name : r.captain ? `The captain's ${r.R.cls}` : `The ${r.R.cls}`, ship = who; // (a named captain by her name alone: short)
      if (trial) { toast(why === 'struck' ? `${who} strikes her colours!` : why === 'hull' ? `${r.captain ? who : r.R.cls} down!` : `${ship} is sinking!`); continue; } // (a sea trial: no shards)
      SPILL.at.copy(r.f.pos).setY(r.f.pos.y + 2); SPILL.total = r.bounty * skies().shards * (1 + 0.1 * W.n) * (W.wave?.mult ?? 1) * (beaten ? NERVE.prize : 1);
      pickups.spill(SPILL.at, r.f.velocity, SPILL.total); emit('shards:spill');
      bounty(r, SPILL.total, SPILL.at);
      // (her flare's help never came; a line of battle's leader gone, and the line with her: said once, as it breaks,
      // in place of the rest, to keep it short; and a crew striking says only that)
      const breaks = r.line?.leader === r && r.line.why === 'down', early = r.flare?.cut && !breaks ? ' before help came' : '', then = breaks ? ' The line breaks: each fights on alone' : early ? '' : ' Fly through her shards';
      toast(beaten ? `${who} strikes her colours: half as many shards again` : why === 'struck' ? `${who} strikes her colours! Gather her treasure` : why === 'hull' ? `${r.who ? `${who} is` : r.captain ? who : r.R.cls} down${early}!${then}` : `${ship} is sinking${early}!${then}`);
    }
    for (const r of raiders.escaped) { toast(r.role === 'prize' ? `The ${r.R.cls} got away with her treasure` : `The ${r.R.cls} got away`); payload('raider:escaped').raider = r; emit('raider:escaped'); }
    if (W.news.length && W.state === 'fight' && raiders.list.some((r) => !r.f.down)) tellNews(); // (the fight goes on: said now)
    if (W.hint && W.state === 'fight' && time >= W.hint.at) { if (raiders.list.some((r) => !r.f.down)) toast(W.hint.text); W.hint = null; } // (a wave's hint, once its banner's gone)
    if (W.sunk) return;
    if (W.lost > 0) {
      if ((W.lost -= dt) <= 0) {
        W.sunk = true; bigMap(false); // (the card says so over everything: game.html)
        $('paused-title').textContent = `The ${player.ship.recipe.name} went down`;
        // (and a raider captain who sank her, got away with a price on her head)
        const grudge = W.grudge ? ` ${W.grudge.name} got away: the price on her head is up to ◆ ${fmt(W.grudge.price)}.` : '';
        $('paused-line').textContent = trial ? 'It was only her sea trial: it cost nothing, and she\'s back in the Shipyard as good as new.' : (V.shards ? `Your crew got her home to ${HOME.name} with half this voyage's shards: ◆ ${fmt(V.shards / 2)}.` : `Your crew got her home to ${HOME.name}.`) + ' She\'ll need a long stay at the dock.' + grudge;
        $('btn-resume').hidden = true; $('btn-abandon').textContent = trial ? 'Back to the Shipyard' : 'Home'; $('paused').hidden = false;
        input.active = false;
      }
      return;
    }
    if (player.down) {
      W.lost = 4; calmUp(false); document.body.classList.add('sinking'); banner(`The ${player.ship.recipe.name} is going down`, 'All hands to the boats');
      gunnery.cancel(); payload('player:down').why = player.down.why; emit('player:down');
      // a raider captain still afloat sank her: she gets away, the price on her head up (tactics.js WANTED), and comes
      // back for her next wave (not a sea trial's: it changes nothing)
      const cap = trial ? null : raiders.list.find((r) => r.who && !r.f.down);
      if (cap) { const c = grudges()[cap.who.id] ??= { beaten: 0, sank: 0 }; c.sank++; progress.save(); W.grudge = { name: cap.who.name, price: BOUNTY[cap.id] * CAPTAIN.bounty * wantedMul(c.sank) * skies().shards }; }
      return;
    }
    if (W.state !== 'fight') { player.repair(dt * 0.06); looks.repair(player.ship, dt); } // between fights the crew patch her up, as far as they can (and her scars)
    if (W.raid) { raidStep(dt); return; }
    if (W.state === 'calm') {
      if ((W.timer -= dt) <= 0) {
        const wave = W.next ?? nextWave(W.n), arr = raiders.spawnWave(wave, player);
        W.next = null; W.wave = wave;
        if (wave.who && !W.met.includes(wave.who.id)) W.met.push(wave.who.id);
        // a storm wave: the storm rolls in (its wind blowing from it); a storm wave, and every third, coming from far
        // off comes out of a bank of cloud on the raiders' way in, 500 to 800 m ahead of them (raiders.js waveAt)
        if (wave.storm) sky.startStorm(); else sky.clearWeather();
        if (wave.bank) bankFor(raiders.list, player.pos);
        // (a treasure ship's wave: a Galleon's, or one with a treasure ship of another class, a treasure Brig before
        // the Captain owns a Galleon)
        const prize = hasTreasure(wave), fort = wave.ids.includes('manowar');
        if (prize) W.treasureAt = W.n;
        // the banner (waveBanner), and a hint that didn't fit in it said once it's gone
        const { title, line, hint } = waveBanner(wave, arr);
        W.hint = hint ? { text: hint, at: time + HINT_AFTER } : null;
        banner(title, line);
        W.state = 'fight';
        if ((W.n === 0 || trial) && !$('help').hidden) toggleHelp(); // (the keys fold away as the first wave comes, or her sea trial's)
        const E = payload('wave:start');
        Object.assign(E, { n: W.n + 1, title, captain: wave.captain >= 0, prize, fortress: fort, count: wave.ids.length });
        emit('wave:start');
      }
    } else if (W.state === 'fight') {
      if (!raiders.list.some((r) => !r.f.down)) {
        // the last raider of a wave going down (this moment: not a treasure ship getting away): the world slows for a
        // moment, and the card rises only after it
        const last = raiders.list.some((r) => r.f.down && r.f.down.t < 0.5);
        if (last) fx.slowmo(1.6, 0.25);
        W.n++;
        const bonus = trial ? 0 : Math.round(20 * W.n * skies().shards * (W.wave?.bonus ?? 1)); // (a stormy road's bonus is double)
        V.shards += bonus; V.bonus += bonus;
        const E = payload('wave:cleared'); E.n = W.n; E.bonus = bonus; emit('wave:cleared');
        W.state = 'choose'; W.choose = 25;
        $('btn-sail-on').hidden = !!trial;
        // (Back to port: on her sea trial's card the one way on, as big as Sail on, counting down to going home by itself)
        const home = $('btn-go-port'); home.classList.toggle('big', !!trial); home.classList.toggle('plain', !trial);
        setText($('go-port-text'), trial ? `Back to the Shipyard (${W.choose})` : `Home to ${HOME.name}`);
        if (trial) {
          // her sea trial won: the card says so, with only the way home (by itself after 25 s), and what she costs
          sky.clearWeather(); world.puffs.bank(null); W.alt = null; roadButton();
          $('calm-title').textContent = 'Sea trial over: she won';
          const id = player.ship.recipe.id;
          $('calm-line').textContent = `It cost nothing. She's ${price(id)} in port${needs(id)}.`;
          $('calm').classList.toggle('late', last); calmUp(true);
          W.bonus = 0; W.bonusShown = 0;
          return;
        }
        // a banner still up (a shot's, earned just before): cut short, fading as the card rises (at once if it rises at
        // once: on a phone held sideways the card takes its place), and a shot's news told on the card and again as the
        // next wave nears
        if (performance.now() < bannerAt.until) {
          const a = $('banner').getAnimations()[0], end = last ? 3170 : 4400; // (72% of its 4.4 s: where it starts to fade)
          if (a && a.currentTime < end) { bannerAt.until -= end - a.currentTime; a.currentTime = end; }
          if (performance.now() < newsUp.until) W.news.unshift(...newsUp.list);
        }
        newsUp.list = []; newsUp.until = 0;
        const news = W.news.length ? newsCard(W.news) : null;
        $('calm-title').textContent = news ? news.title : `Wave ${W.n} beaten`;
        const next = nextWave(W.n);
        W.next = next; W.alt = roadFor(next);
        // the weather: a storm wave next shows its storm on the horizon now (ahead of her, more or less), and says so on
        // the card; otherwise this wave's storm (if it had one) clears. The bank of cloud the wave came out of goes
        world.puffs.bank(null);
        let storm = '';
        if (next.storm) {
          if (!sky.weather.want) sky.front(player.heading + (Math.random() - 0.5) * 1.8);
          storm = sky.weather.want ? ' The storm isn\'t done yet.' : ` A storm is rolling in from the ${COMPASS[Math.round(compassDeg(sky.weather.from) / 45) % 8]}.`;
        } else sky.clearWeather();
        // a captain's ship (and a treasure ship) is built now, while the card is up, not as the wave appears (a stutter
        // on a phone): the second way's too
        raiders.prepareWave(next); if (W.alt) raiders.prepareWave(W.alt);
        $('calm-line').innerHTML = `${news ? `Wave ${W.n} beaten${news.line}. ` : ''}◆ <b id="calm-bonus">0</b> for the wave · ◆ ${fmt(V.shards)} aboard. Next: ${describe(next)}.${storm}`;
        roadButton(next);
        // (shown at once, for the game; it rises into view after the slow motion, and its bonus counts up as it does)
        $('calm').classList.toggle('late', last); calmUp(true);
        W.bonus = bonus; W.bonusShown = -1; W.bonusAt = performance.now() / 1000 + (last ? 1.4 : 0.1);
      }
    } else if (W.state === 'choose') {
      W.choose -= dt;
      if (trial) { setText($('go-port-text'), `Back to the Shipyard (${Math.max(0, Math.ceil(W.choose))})`); if (W.choose <= 0) goHome(); return; } // (her sea trial over: home by itself)
      setText($('sail-on-text'), `Sail on (${Math.max(0, Math.ceil(W.choose))})`);
      if (W.choose <= 0) sailOn();
    }
  }
  // the card's second way on (W.alt): its button, with its name and what it brings (and 2 to take it on a laptop); none
  // when there's only the steady course. The mouse stays locked to the view (2 takes it, as its button says, Enter sails
  // on and B goes home), so the next wave starts with the view following the mouse; Esc lets go of it to click
  const road = $('btn-road');
  function roadButton(next = null) {
    const alt = W.alt;
    road.hidden = !alt; $('calm').classList.toggle('roads', !!alt); document.body.classList.toggle('roads', !!alt); // (held sideways, Fire and Surge wait meanwhile: game.html)
    if (!alt) return;
    const [title, line] = roadWords(alt, next);
    road.dataset.road = alt.road;
    road.innerHTML = `<b>${title}</b><small>${line}</small><kbd class="mouse-only">2</kbd>`;
  }
  // whether the card between waves has risen into view (most of the way): until then, as the wave's last raider goes
  // down, 1 and 2 are still the shot keys pressed mid-fight, never a way on the Captain hasn't seen
  function cardRisen() {
    const c = $('calm');
    if (c.hidden) return false;
    const a = c.getAnimations()[0], k = a?.effect?.getComputedTiming().progress;
    return !a || a.playState === 'finished' || (k ?? 0) >= 0.5;
  }
  // on to the next wave: the steady course (0: Sail on, Enter, 1, or the card's countdown) or the second way (1: its
  // button, or 2), told (`road`)
  const ROAD_NEWS = payload('road');
  function sailOn(pick = 0) {
    if (W.state !== 'choose' || trial) return;
    const alt = pick === 1 ? W.alt : null;
    if (alt) { W.next = alt; if (alt.huntFor !== undefined) W.plainAt = alt.huntFor; }
    ROAD_NEWS.kind = alt ? alt.road : 'steady'; emit('road');
    W.alt = null; roadButton();
    calmUp(false); W.state = 'calm'; W.timer = 4; newWind();
    if (W.news.length) tellNews(); // (a shot earned as the last wave ended: the banner now, with its button showing again)
  }
  // a bank of cloud across the raiders' way in, 500 to 800 m ahead of them (and never nearer her than 600 m)
  const mid = new THREE.Vector3();
  function bankFor(list, to) {
    mid.set(0, 0, 0); let n = 0;
    for (const r of list) if (!r.f.down && r.role !== 'prize') { mid.add(r.f.pos); n++; }
    if (!n) return;
    mid.divideScalar(n);
    const d = mid.distanceTo(to);
    if (d > 1300) world.puffs.bank(mid, to, Math.min(500 + Math.random() * 300, d - 600));
  }
  const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  // the card between waves up or down (while it's up there's nothing to fire at: the guns' label makes way for it, and
  // a laptop's keys fold away; the panels the edge tags keep clear of are measured again, with the label or without)
  function calmUp(on) {
    $('calm').hidden = !on; document.body.classList.toggle('between', on); if (!on) document.body.classList.remove('roads');
    if (on && !$('help').hidden) toggleHelp();
    layout();
  }
  const goHome = () => { if (mode === 'voyage' && W.state === 'choose') endVoyage(1, true); };
  $('btn-sail-on').addEventListener('click', () => sailOn(0));
  road.addEventListener('click', () => sailOn(1));
  $('btn-go-port').addEventListener('click', goHome);
  // paused or going again, told whenever it changes (pause() below, and leaving a paused voyage for port)
  function setPaused(on) { if (paused === on) return; paused = on; payload('pause').on = on; emit('pause'); }
  function pause(on) {
    if (mode !== 'voyage' || W.sunk) return;
    setPaused(on); input.active = !on;
    if (!on) { input.look.x = input.look.y = 0; input.zoom = 0; input.pressed.clear(); } // nothing moved while paused carries over
    if (on) {
      if (document.pointerLockElement) document.exitPointerLock();
      bigMap(false); // (the pause card lies over everything at sea, but the map would be in its way when it's done)
      const fighting = W.state === 'fight' || player.down;
      $('paused-title').textContent = 'Paused';
      $('paused-line').textContent = trial ? 'Back to the Shipyard now ends her sea trial. It costs nothing.' : !V.shards ? 'Going home now ends the voyage.' : fighting ? `Home now, mid-fight, and you keep half this voyage's shards: ◆ ${fmt(V.shards / 2)}.` : `Home now keeps all this voyage's shards: ◆ ${fmt(V.shards)}.`;
      $('btn-resume').hidden = false; $('btn-abandon').textContent = trial ? 'Back to the Shipyard' : `Home to ${HOME.name}`;
    }
    $('paused').hidden = !on;
  }
  $('btn-pause').addEventListener('click', () => pause(true));
  $('btn-resume').addEventListener('click', () => pause(false));
  // how to fly (from the pause card): the touch controls on a phone, the keys on a laptop; closing it goes back to the
  // pause card (Got it, the dim sky round it, or Esc)
  const howto = $('howto');
  $('btn-howto').addEventListener('click', () => { howto.hidden = false; });
  $('btn-howto-done').addEventListener('click', () => { howto.hidden = true; });
  howto.addEventListener('click', (e) => { if (e.target === howto) howto.hidden = true; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !howto.hidden) { howto.hidden = true; e.stopPropagation(); } }, true);
  $('btn-abandon').addEventListener('click', () => endVoyage(W.sunk || W.state === 'fight' || player.down ? 0.5 : 1, true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'voyage' && !paused) pause(true);
    if (document.hidden) progress.flush(); // (what's only been kept on this device, a tip given, sent up as the page goes)
  });

  // ---------- the help, and the big map ----------
  const toggleHelp = () => { const h = $('help'); h.hidden = !h.hidden; $('btn-help').hidden = !h.hidden; layout(); };
  $('btn-help').addEventListener('click', toggleHelp);
  // the big map: as big as fits, in the middle over a dimmed sky, drawn sharp at its own size; the cross (top right of
  // it), a tap on it or round it, or M closes it
  const mini = $('minimap'), mctx = mini.getContext('2d'), mimg = new Image(); mimg.src = minimapUrl;
  const mapDim = $('map-dim'), mapClose = $('map-close');
  function bigMap(on = !mini.classList.contains('big')) {
    mini.classList.toggle('big', on); mapDim.hidden = mapClose.hidden = !on;
    hudTimer = 0; // (redrawn sharp at its new size straight away)
    if (on) placeMapClose();
  }
  function placeMapClose() { const b = mini.getBoundingClientRect(); mapClose.style.left = `${Math.round(b.right - 50)}px`; mapClose.style.top = `${Math.round(b.top + 6)}px`; }
  mini.addEventListener('click', () => bigMap());
  mapDim.addEventListener('click', () => bigMap(false)); mapClose.addEventListener('click', () => bigMap(false));

  const input = makeInput(canvas, document.body);
  // a new Captain's tips (coach.js), one at a time, from what's happening (`see`, ten times a second from the HUD)
  const SEE = { player: null, raiders: null, locked: null, fight: false, choosing: false, shots: '', mouse: false };
  let inpNow = null; // (this step's controls, for the tips: how long she's been steering)
  const coach = makeCoach({ progress, settings, touch, el: $('tip'), trial: () => trial, clock: () => time, placed: () => layout(),
    see: () => {
      const D = progress.data.shots;
      SEE.player = player; SEE.raiders = raiders.list; SEE.locked = locked; SEE.fight = W.state === 'fight' && !player?.down; SEE.choosing = W.state === 'choose' && !trial; SEE.mouse = input.locked;
      SEE.shots = D?.chain && D?.breaker ? 'both' : D?.chain ? 'chain' : D?.breaker ? 'breaker' : '';
      return SEE;
    } });
  // ("Show the tips again" switches them back on too, if they were off: it does what it says)
  // ("Show the tips again" is in the claim's Settings panel: tipsAgain)
  const tipsAgain = () => { coach.again(); if (settings.data.tips === false) settings.set('tips', true); };
  $('btn-settings-pause').addEventListener('click', () => claim.openSettings?.());
  // the touch hint (a phone's first voyages) fades a few seconds after the first touch at sea (drags in port turn the
  // ship, and don't count)
  const hint = $('touch-hint');
  let hintTimer = 0;
  canvas.addEventListener('pointerdown', () => {
    if (mode !== 'voyage' || hintTimer || hint.classList.contains('gone')) return;
    hintTimer = setTimeout(() => { hint.classList.add('gone'); hintTimer = 0; setTimeout(layout, 700); }, 4000); // (gone, the edge tags may use its place)
  });
  // the window's size, read once when it changes (reading it while the page is being written each frame would make the
  // browser lay the page out again there and then)
  const view = { w: innerWidth, h: innerHeight };
  let sizes = 0; // (how many times the window has changed size)
  function resize() {
    const w = view.w = innerWidth, h = view.h = innerHeight;

    camera.aspect = w / h; camera.fov = viewFov = w < h ? 68 : 55; camera.updateProjectionMatrix();
    camera.userData.pixelScale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    camera.userData.pixelRatio = renderer.getPixelRatio(); // (the screen's own pixels to the page's: the shots' colours, guns.js)
    billowsFor(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect))); // (a storm's billows, as many as suit the view's width)
    for (const s of built.values()) s.glow.material.uniforms.uScale.value = camera.userData.pixelScale;
    raiders.setScale(camera.userData.pixelScale, renderer.getPixelRatio()); // (and the raiders' glows, the same, and their danger fans' lines)
    sizes++; // (the tags measured again: a phone turned may give their words other sizes, as on the smallest phones)
    port.resize(); layout();
    if (mini.classList.contains('big')) placeMapClose();
  }
  // where the HUD's panels are, so the raiders' tags at the screen's edge keep clear of them: those along the top
  // (your ship's panel, the compass, the pause button, the map and the score, and on a laptop the guns' label under
  // the compass) and along the bottom (the touch buttons, the guns' label on a phone, the hint, the keys). Measured as
  // a voyage starts, and when the window, the panels or the card between waves change
  // And where the card between waves is, while it's up (bounties keep clear of it): measured where it ends up, as it
  // may still be rising into place (its rising moves it with translate, which offsets leave out; it's centred with
  // translate too)
  const EDGE = { top: [], bottom: [] }, TOP_IDS = ['ship', 'compass', 'btn-pause', 'minimap', 'score'], BOTTOM_IDS = ['touch-buttons', 'battery', 'touch-hint', 'help', 'btn-help', 'tip'];
  const CALM_AT = { on: false, l: 0, r: 0, t: 0, b: 0, top: false };
  // (and the toast's place, from its top down a line or two, for the warning to keep clear of as it moves off her ship
  // while a toast shows (until: real time, in ms, as its 3 s fade ends), and the raiders' tags too (tags: OFF); `n`
  // counts the measurings, so the warning measures its own place again after one)
  const TOAST_AT = { l: 0, r: 0, t: 0, b: 0, n: 0, until: 0 };
  function layout() {
    TOAST_AT.n++;
    if (mode !== 'voyage') return;
    const boxes = (ids) => ids.filter((id) => !$(id).classList.contains('gone')).map((id) => $(id).getBoundingClientRect()).filter((b) => b.width && b.height).map((b) => ({ l: b.left, r: b.right, t: b.top, b: b.bottom }));
    EDGE.top = boxes(TOP_IDS); EDGE.bottom = boxes(BOTTOM_IDS).filter((b) => b.t > view.h * 0.4);
    // (the guns' label, wherever it is: along the top under the compass, or along the bottom over the touch buttons,
    // even reaching up past four tenths of the way down, as it does over the shot button on a phone held sideways)
    for (const b of boxes(['battery'])) if (b.b < view.h * 0.4) EDGE.top.push(b); else if (b.t <= view.h * 0.4) EDGE.bottom.push(b);
    const c = $('calm');
    CALM_AT.on = !c.hidden && c.offsetWidth > 0;
    if (CALM_AT.on) Object.assign(CALM_AT, { l: c.offsetLeft - c.offsetWidth / 2, r: c.offsetLeft + c.offsetWidth / 2, t: c.offsetTop, b: c.offsetTop + c.offsetHeight, top: c.offsetTop + c.offsetHeight / 2 < view.h / 2 });
    if (CALM_AT.on) document.body.style.setProperty('--calm-top', `${Math.round(CALM_AT.t)}px`); // (the toast keeps over it, on a phone held upright: game.html)
    const t = $('toast').getBoundingClientRect(); TOAST_AT.l = t.left; TOAST_AT.r = t.right; TOAST_AT.t = t.top; TOAST_AT.b = t.top + Math.max(t.height, 26);
  }
  addEventListener('resize', () => { if (mode !== 'off') resize(); });
  applyPicture(); applyHands(); fx.shake = settings.data.shake;
  resize();


  // ---------- the HUD ----------
  // Written sparingly: what changes every frame (the tags' places, the reload bar) is written every frame, the rest ten
  // times a second, and nothing is written that hasn't changed, so a phone spends its time on the sky, not the page
  let region = '', regionTimer = 0, hudTimer = 0, hurt = 0;
  const shardCount = { shown: 0, from: 0, to: 0, t: 1, n: -1 }; // the shard count shown, counting up to what's in the hold (n: the whole number written)
  const flash = (el) => { el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
  // the banner, and where it is on the screen and until when (real time, in ms) it shows, so a bounty keeps clear of it
  const bannerAt = { left: 0, right: 0, top: 0, bottom: 0, until: 0 }, BANNER_BACK = 700; // (the tags under it come back as it fades: ms before it's gone)
  function banner(title, line) {
    $('region').classList.remove('on'); // (they share a place: the banner wins)
    const el = $('banner'); $('banner-title').textContent = title; $('banner-line').textContent = line; flash(el);
    const b = el.getBoundingClientRect(); // (cheap here: flash has just laid the page out)
    Object.assign(bannerAt, { left: b.left, right: b.right, top: b.top, bottom: b.bottom, until: performance.now() + 4400 });
  }
  function toast(text) {
    const t = $('toast'); t.textContent = text; flash(t);
    const b = t.getBoundingClientRect(); // (cheap here, as for the banner: its place as its words take one line or two)
    TOAST_AT.l = b.left; TOAST_AT.r = b.right; TOAST_AT.t = b.top; TOAST_AT.b = b.top + Math.max(b.height, 26); TOAST_AT.until = performance.now() + 3000;
  }
  const setText = (el, v) => { if (el._v !== v) { el._v = v; el.textContent = v; } };
  const setStyle = (el, k, v) => { if (el['_' + k] !== v) { el['_' + k] = v; el.style[k] = v; } };
  // a bar's width (f: 0 to 1). A health bar has a pale chip behind it that follows a moment later, so the piece just
  // knocked off shows white before it drains away (the lag is the chip's CSS transition)
  const setWidth = (el, f) => { const p = Math.round(f * 100); if (el._w !== p) { el._w = p; el.style.width = p + '%'; if (el._chip) el._chip.style.width = p + '%'; } };
  const chip = (el) => { el._chip = el.previousElementSibling?.tagName === 'B' ? el.previousElementSibling : null; return el; };
  const H = {}; // the HUD's elements, looked up once
  for (const id of ['hurt', 'battery-name', 'battery-count', 'reload-bar', 'aim', 'tags', 'r-speed', 'r-height', 'r-sail', 'sail-bar', 'score-n', 'wave-n', 'voyage-n',
    'heading', 'wind-arrow', 'wind-n', 'wind-words', 'h-surge', 'row-surge', 'btn-surge', 'h-patch', 'row-patch', 'btn-patch', 'warn', 'score', 'score-raiders', 'hitmark', 'hitgem', 'killring', ...PARTS.flatMap((k) => [`h-${k}`, `n-${k}`, `row-${k}`])]) H[id] = $(id);
  for (const k of PARTS) { chip(H[`h-${k}`]); H[`row-${k}`]._dt = H[`row-${k}`].querySelector('dt'); H[`row-${k}`]._bar = H[`row-${k}`].querySelector('.meter'); }

  // ---------- hits, on the HUD ----------
  // your shot landing: four ticks round the crosshair in the colour of what it hit (gold hull, cream sails, orange
  // crystals, with a sparkle), restarted at most every 50 ms so a rippling broadside reads as a chain of flickers; a
  // shot that brings her down: a red X and a ring growing out. (Animated by the browser, on transform and opacity.)
  const HIT_COLOUR = { hull: '#e2bd67', sails: '#ecdcb8', crystals: '#ff9f45', kill: '#ff4636' };
  let markAt = -1, markAnim = null, ringAnim = null;
  function hitMark(part, killed) {
    if (!killed && time - markAt < 0.05) return;
    markAt = time;
    const g = H.hitmark, k = killed ? 'kill' : part;
    g.setAttribute('stroke', HIT_COLOUR[k]); g.dataset.part = k;
    H.hitgem.setAttribute('visibility', k === 'crystals' ? 'visible' : 'hidden');
    markAnim?.cancel();
    markAnim = g.animate([{ opacity: 1, transform: 'scale(1.35)' }, { opacity: 0, transform: 'scale(1)' }], { duration: killed ? 420 : part === 'crystals' ? 260 : 180, easing: 'ease-out' });
    if (killed) { ringAnim?.cancel(); ringAnim = H.killring.animate([{ opacity: 1, transform: 'scale(0.6)' }, { opacity: 0, transform: 'scale(2.2)' }], { duration: 420, easing: 'ease-out' }); }
  }
  // the bar for the part hit flashes on the raider's tag
  const FLASH = [{ filter: 'brightness(2.6)' }, { filter: 'brightness(1)' }];
  function tagFlash(r, part) { const m = r.tag?._m[PARTS.indexOf(part)] ?? (part === 'crystals' ? r.tag?._pips[0]?.parentElement : null); if (m) m.parentElement.animate(FLASH, 150); }
  // a hit on you: a red arc on a ring round the middle of the screen pointing where the shot came from (the oldest of
  // four reused), the red at the screen's edge leaning that way, and the row for what was hit flashing in your panel
  const arcs = [...document.querySelectorAll('#incoming i')], from = new THREE.Vector3(), FADE = { duration: 1200, easing: 'ease-in' };
  const ROW = [{ color: '#ff6a50', offset: 0 }, { color: '#ff6a50', offset: 0.5 }], BAR = [{ boxShadow: '0 0 0 2px #ff4636' }, { boxShadow: '0 0 0 2px rgba(255, 70, 54, 0)' }];
  let arcN = 0, lastArc = null;
  function incoming(b, part) {
    from.copy(b.v).normalize().multiplyScalar(-300).add(player.pos).applyMatrix4(camera.matrixWorldInverse);
    const th = Math.atan2(from.x, from.y), el = arcs[arcN];
    arcN = (arcN + 1) % arcs.length; lastArc = th;
    el.style.transform = `rotate(${th.toFixed(3)}rad)`;
    el._a?.cancel(); el._a = el.animate([{ opacity: 1 }, { opacity: 0 }], FADE);
    H.hurt.style.setProperty('--hx', (-Math.sin(th)).toFixed(2)); H.hurt.style.setProperty('--hy', Math.cos(th).toFixed(2));
    const row = H[`row-${part}`];
    row._dt.animate(ROW, 300); row._bar.animate(BAR, 300);
  }
  const proj = new THREE.Vector3(), lookF = new THREE.Vector3(), lookR = new THREE.Vector3(), corner = new THREE.Vector3(), placed = [], edges = [], over = [], byY = (a, b) => a._y - b._y;
  // a tag's height in pixels, and saying "Broadside!" in place of its bars (and a pixel to spare): measured on the first
  // tags shown (the fonts decide them), until then a fair guess
  const TAG = { h: 42, warn: 44, measured: false, warned: false, sizes: 0 };
  // a tag pinned at the screen's edge sits by its bottom middle at (x, y), all of it on the screen by its own width (at
  // least 52 px in from the sides, until it's been measured): not over the panels along the top (with its arrow: up px
  // above that, its height and the arrow's reach over its top, more for a tag saying "Broadside!", whose arrow is
  // bigger) or the bottom (layout()), for any panel within half the widest tag (a treasure ship's, far off) of it
  // (the arrow: a slim dart turned to point at her, so it reaches up to ARROW px over the tag's top and ARROW_HW px either
  // side of its middle whichever way it points; more saying "Broadside!", when it's bigger: game.html)
  const TAG_HALF = 52, TAG_EDGE = 6, TAG_REACH = 86, ARROW = 24, ARROW_WARN = 26, ARROW_HW = 11, ARROW_WARN_HW = 14;
  const arrowHW = (warn) => (warn ? ARROW_WARN_HW : ARROW_HW);
  const edgeX = (el, W2) => W2 - Math.max(TAG_HALF, el._hw + TAG_EDGE); // (the furthest from the middle its bottom middle goes)
  const tagUp = (warn) => (warn ? TAG.warn + ARROW_WARN : TAG.h + ARROW);
  const tagH = (a) => (a._warn ? TAG.warn : TAG.h); // (a tag's height: taller saying "Broadside!")
  function edgeTop(x, up) { let t = 6; for (const b of EDGE.top) if (x > b.l - TAG_REACH && x < b.r + TAG_REACH && b.b + 4 > t) t = b.b + 4; return t + up; }
  // (on a touch screen a tag saying "Broadside!", or glowing as she bursts up through the clouds (warn; hw: half its
  // width), keeps out from under the thumb that steers: on the stick's side of the screen (input.js: the left 42%, the
  // right with Fire on the left) no lower than 70% of the way down, as the warning the Captain must see in time to climb
  // out of it)
  const THUMB = { side: 0.42, low: 0.7 };
  const underThumb = (x, hw) => (input.leftFire ? x + hw > view.w * (1 - THUMB.side) : x - hw < view.w * THUMB.side);
  function edgeBottom(x, warn = false, hw = 0) {
    let y = view.h - 6;
    for (const b of EDGE.bottom) if (x > b.l - TAG_REACH && x < b.r + TAG_REACH && b.t - 4 < y) y = b.t - 4;
    return warn && touch && underThumb(x, hw) ? Math.min(y, view.h * THUMB.low) : y;
  }
  // a tag over a ship (its bottom middle at x, hw half as wide as it is) may reach up to just under the panels along the
  // top over it (the compass, the guns' label...) and down to just over those along the bottom, never off the screen
  function overTop(x, hw) { let t = 6; for (const b of EDGE.top) if (x + hw > b.l - 4 && x - hw < b.r + 4 && b.b + 4 > t) t = b.b + 4; return t; }
  function overBottom(x, hw) { let y = view.h - 6; for (const b of EDGE.bottom) if (x + hw > b.l - 4 && x - hw < b.r + 4 && b.t - 4 < y) y = b.t - 4; return y; }
  // a raider's ship on the screen, for the tags to keep off (into her tag: _sl, _sr, _st, _sb, in pixels, and _box; and
  // _ship, whether tags keep off her: not when she's so big on the screen, close by, that no tag could hide her). Her
  // box: from her ram to her stern, her keel to her mast heads, her wings' spread (as every class is built, with a little
  // to spare). None when she's lost in cloud, behind the camera or pinned at the edge
  function shipBox(r, el, W2, H2) {
    const L = r.R.length, hull = r.ship.hull, M = r.ship.body.matrixWorld, top = L * 0.33 + 2.2, keel = -(L * 0.18 + 1.5), half = L * 0.22 + 1;
    let l = Infinity, rt = -Infinity, t = Infinity, b = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? half : -half, i & 2 ? top : keel, i & 4 ? hull.zb + L * 0.2 : hull.zs - L * 0.1).applyMatrix4(M).project(camera);
      if (corner.z > 1) return;
      const sx = (corner.x + 1) * W2, sy = (1 - corner.y) * H2;
      if (sx < l) l = sx; if (sx > rt) rt = sx; if (sy < t) t = sy; if (sy > b) b = sy;
    }
    el._sl = l; el._sr = rt; el._st = t; el._sb = b; el._box = true;
    el._ship = rt - l < 4 * el._hw && b - t < 2 * TAG.h;
  }
  // the Captain's own ship on the screen (OWN, in pixels): the box round her as she's built (keel to mast heads, ram to
  // stern, her wings' spread), as she flies now, in four slabs from stern to bow, each as it shows on the screen (so
  // the nearer end, bigger, and the farther end, smaller, each have their own: much closer to her than one box round
  // all of it, as she's seen in perspective). The raiders' tags and the warning keep off her (OFF), so a battered ship
  // seen from behind shows her scars. Worked out each frame the tags are placed; off when she's not in sight. (l, r, t,
  // b: round all of her)
  // The tags at the edge keep off the crosshair too (CROSS: it and the hit marks round it), so a tag moved off her ship
  // never lands on the aim (over her mast heads, as a raider dead astern's would)
  const SLABS = 4, OWN = { on: false, l: 0, r: 0, t: 0, b: 0, slabs: Array.from({ length: SLABS }, () => ({ l: 0, r: 0, t: 0, b: 0 })) }, OFF = [], CROSS = { l: 0, r: 0, t: 0, b: 0 };
  const overlaps = (l, r, t, b, o, gap = 3) => l < o.r + gap && r > o.l - gap && t < o.b + gap && b > o.t - gap;
  function ownBox(W2, H2) {
    const bd = player.ship.bounds, M = player.ship.body.matrixWorld, dz = (bd.max.z - bd.min.z) / SLABS;
    OWN.on = false; OWN.l = OWN.t = Infinity; OWN.r = OWN.b = -Infinity;
    for (let s = 0; s < SLABS; s++) {
      let l = Infinity, rt = -Infinity, t = Infinity, b = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? bd.max.x : bd.min.x, i & 2 ? bd.max.y : bd.min.y, bd.min.z + dz * (s + (i & 4 ? 1 : 0))).applyMatrix4(M).project(camera);
        if (corner.z > 1) return; // (the camera inside her box: no telling)
        const sx = (corner.x + 1) * W2, sy = (1 - corner.y) * H2;
        if (sx < l) l = sx; if (sx > rt) rt = sx; if (sy < t) t = sy; if (sy > b) b = sy;
      }
      const S = OWN.slabs[s]; S.l = l; S.r = rt; S.t = t; S.b = b;
      if (l < OWN.l) OWN.l = l; if (rt > OWN.r) OWN.r = rt; if (t < OWN.t) OWN.t = t; if (b > OWN.b) OWN.b = b;
    }
    OWN.on = !(OWN.r < 0 || OWN.l > view.w || OWN.b < 0 || OWN.t > view.h);
  }
  // (whether a box l..r, t..b lands on her ship, within `gap` pixels)
  const onOwn = (l, r, t, b, gap) => { if (!OWN.on) return false; for (let s = 0; s < SLABS; s++) if (overlaps(l, r, t, b, OWN.slabs[s], gap)) return true; return false; };
  // the warning under the crosshair (or, calmly, "Hidden in the cloud") kept off her ship: in its own place if that's
  // clear of her, or else the nearest clear place of: just under her keel, just over her mast heads (still under the
  // crosshair), and just over the crosshair, each on the screen and clear of her, the crosshair, the panels, the card
  // between waves, a banner showing and a toast showing. The place it's in counts as WARN_STAY px nearer, so it never
  // hops between two about as far as the ship rolls (but goes to one much nearer, when the view swings). Where none is
  // clear of all of them, the nearest clear of all but a toast (it lies over the toast for the moment that shows, read in
  // full); and failing that (a banner in the only room, on the smallest phone) its own place, on her but readable: better
  // than behind the touch buttons, over the crosshair or under a banner. WARN_AT: where it is, for the tags to keep off.
  // Its own place is measured when its words change, or after the panels are measured again (a new window size); then
  // it's moved with a transform
  const WARN_AT = { on: false, l: 0, r: 0, t: 0, b: 0, words: null, n: -1, home: { l: 0, r: 0, t: 0, b: 0 }, dy: 0, pick: -1 };
  function warnClear(t, all) {
    const H0 = WARN_AT.home, b = t + H0.b - H0.t, l = H0.l, r = H0.r, mid = view.h / 2, now = performance.now();
    if (t < 4 || b > view.h - 4 || onOwn(l, r, t, b, 5)) return false;
    if (t < mid + 27 && b > mid - 27) return false; // (the crosshair, and the hit marks round it)
    for (let i = 0; i < EDGE.top.length; i++) if (overlaps(l, r, t, b, EDGE.top[i])) return false;
    for (let i = 0; i < EDGE.bottom.length; i++) if (overlaps(l, r, t, b, EDGE.bottom[i])) return false;
    if (CALM_AT.on && overlaps(l, r, t, b, CALM_AT)) return false;
    if (now < bannerAt.until && l < bannerAt.right + 3 && r > bannerAt.left - 3 && t < bannerAt.bottom + 3 && b > bannerAt.top - 3) return false;
    return !all || !(now < TOAST_AT.until && t < TOAST_AT.b + 3 && b > TOAST_AT.t - 3);
  }
  const warnTops = [0, 0, 0], WARN_STAY = 24; // (under her keel, over her mast heads, over the crosshair: WARN_AT.pick, or -1 its own place)
  function placeWarn() {
    const w = H.warn, words = w.hidden ? '' : w.textContent;
    if (!words) { WARN_AT.on = false; WARN_AT.pick = -1; if (WARN_AT.dy) { WARN_AT.dy = 0; w.style.transform = ''; } return; } // (shown again, it starts from its own place)
    const H0 = WARN_AT.home;
    if (words !== WARN_AT.words || WARN_AT.n !== TOAST_AT.n) {
      // (its own place: read once with no transform; cheap, as it's only when its words or the window change)
      w.style.transform = ''; WARN_AT.dy = 0;
      const b = w.getBoundingClientRect();
      WARN_AT.words = words; WARN_AT.n = TOAST_AT.n; H0.l = b.left; H0.r = b.right; H0.t = b.top; H0.b = b.bottom;
    }
    if (H0.r - H0.l < 1) { WARN_AT.on = false; return; } // (not shown: on a phone, between waves)
    const h = H0.b - H0.t, mid = view.h / 2;
    let top = H0.t, pick = -1;
    if (onOwn(H0.l, H0.r, H0.t, H0.b, 5)) {
      warnTops[0] = OWN.b + 6; warnTops[1] = OWN.t - 6 - h; warnTops[2] = mid - 29 - h;
      for (let pass = 0; pass < 2 && pick < 0; pass++) {
        let best = Infinity;
        for (let i = 0; i < warnTops.length; i++) { const d = Math.abs(warnTops[i] - H0.t) - (i === WARN_AT.pick ? WARN_STAY : 0); if (d < best && warnClear(warnTops[i], !pass)) { best = d; pick = i; } }
      }
      if (pick >= 0) top = warnTops[pick];
    }
    WARN_AT.pick = pick;
    const dy = Math.round(top - H0.t);
    if (dy !== WARN_AT.dy) { WARN_AT.dy = dy; w.style.transform = dy ? `translateY(${dy}px)` : ''; }
    WARN_AT.on = true; WARN_AT.l = H0.l; WARN_AT.r = H0.r; WARN_AT.t = H0.t + dy; WARN_AT.b = H0.b + dy;
  }
  // what's in the way of tag a with its bottom middle at (x, y): a tag already placed (those at the edge with their
  // arrows, which may be all that says where she is, and the first `overN` of those over ships) or a raider's ship, or
  // the Captain's own and the warning (OFF) (unless `ships` is false). Going up (dir -1): the bottom it must rise to, to
  // clear them all; going down (dir 1), the bottom it must sink to. NaN: nothing's in the way
  const TAG_GAP = 2;
  let overN = 0;
  function inWay(a, x, y, dir, ships) {
    const hw = a._hw, h = tagH(a);
    let to = dir < 0 ? Infinity : -Infinity, v;
    for (let pass = 0; pass < 2; pass++) {
      const list = pass ? over : edges, n = pass ? overN : edges.length;
      for (let j = 0; j < n; j++) {
        const b = list[j], bh = b._warn ? TAG.warn : TAG.h;
        if (Math.abs(x - b._x) < hw + b._hw + TAG_GAP && y > b._y - bh - TAG_GAP && y - h < b._y + TAG_GAP) { v = dir < 0 ? b._y - bh - TAG_GAP : b._y + TAG_GAP + h; to = dir < 0 ? Math.min(to, v) : Math.max(to, v); }
        // (an edge tag's arrow, just over its middle)
        if (!pass) { const au = b._warn ? ARROW_WARN : ARROW, aw = arrowHW(b._warn); if (Math.abs(x - b._x) < hw + aw + TAG_GAP && y > b._y - bh - au - TAG_GAP && y - h < b._y - bh + TAG_GAP) { v = dir < 0 ? b._y - bh - au - TAG_GAP : b._y - bh + TAG_GAP + h; to = dir < 0 ? Math.min(to, v) : Math.max(to, v); } }
      }
    }
    if (ships) {
      for (let j = 0; j < placed.length; j++) {
        const s = placed[j];
        if (s._ship && x + hw > s._sl - TAG_GAP && x - hw < s._sr + TAG_GAP && y > s._st - TAG_GAP && y - h < s._sb + TAG_GAP) { v = dir < 0 ? s._st - TAG_GAP : s._sb + TAG_GAP + h; to = dir < 0 ? Math.min(to, v) : Math.max(to, v); }
      }
      for (let j = 0; j < OFF.length; j++) {
        const o = OFF[j];
        if (x + hw > o.l - TAG_GAP && x - hw < o.r + TAG_GAP && y > o.t - TAG_GAP && y - h < o.b + TAG_GAP) { v = dir < 0 ? o.t - TAG_GAP : o.b + TAG_GAP + h; to = dir < 0 ? Math.min(to, v) : Math.max(to, v); }
      }
    }
    return Number.isFinite(to) ? to : NaN;
  }
  // tag a at the edge, its bottom middle at (x, y), slid up past the first n tags at the edge in its way (each, and a
  // itself, with its arrow over it), and past the Captain's ship and the warning (OFF: the tag with its arrow over it), no
  // higher than `top` (the panels along the top); NaN if there's no room
  let offN = 0; // (how many of OFF it keeps off: all of them; the crosshair, last, left out; or none, for a tag with nowhere clear of both her and the other tags)
  let arrowRoom = true; // (whether the tags at the edge keep clear of each other's arrows too, or, with no room for that, of each other's tags only)
  const edgeUp = (a) => (arrowRoom ? tagUp(a._warn) : tagH(a)); // (how far up from its bottom a tag at the edge keeps others off)
  function edgeSlide(a, x, y, n, top) {
    const h = a._warn ? TAG.warn : TAG.h, up = tagUp(a._warn), au = edgeUp(a), nOff = offN;
    for (let k = 0; k <= n + nOff; k++) {
      let to = Infinity;
      for (let j = 0; j < n; j++) { const c = edges[j], cu = edgeUp(c); if (Math.abs(x - c._x) < a._hw + c._hw + TAG_GAP && y > c._y - cu - TAG_GAP && y - au < c._y + TAG_GAP) to = Math.min(to, c._y - cu - TAG_GAP); }
      for (let j = 0; j < nOff; j++) { const o = OFF[j]; if (offHit(o, a, x, y, h, up)) to = Math.min(to, o.t - TAG_GAP); }
      if (to === Infinity) return y;
      if ((y = to) < top) return NaN;
    }
    return NaN;
  }
  // (the same, slid down past them, no lower than `bottom` (the panels along the bottom); NaN if there's no room)
  function edgeSink(a, x, y, n, bottom) {
    const h = tagH(a), up = tagUp(a._warn), au = edgeUp(a), nOff = offN;
    for (let k = 0; k <= n + nOff; k++) {
      let to = -Infinity;
      for (let j = 0; j < n; j++) { const c = edges[j], cu = edgeUp(c); if (Math.abs(x - c._x) < a._hw + c._hw + TAG_GAP && y > c._y - cu - TAG_GAP && y - au < c._y + TAG_GAP) to = Math.max(to, c._y + TAG_GAP + au); }
      for (let j = 0; j < nOff; j++) { const o = OFF[j]; if (offHit(o, a, x, y, h, up)) to = Math.max(to, o.b + TAG_GAP + up); }
      if (to === -Infinity) return y;
      if ((y = to) > bottom) return NaN;
    }
    return NaN;
  }
  // tag a pinned by the left or right side of the screen kept by it: the nearer of the first clear place straight up
  // from where it's pinned and the first straight down, between the panels there (false if there's neither). So a tag
  // in the way of another by the same side stacks with it there, its arrow still pointing out of that side, rather
  // than being slid in towards the middle (on a phone held upright, a tag's width is a quarter of the screen's)
  const bySide = (a, W2) => Math.abs(a._ex - W2) > edgeX(a, W2) - 40;
  function edgeAlong(a, i) {
    const x = a._x, top = edgeTop(x, tagUp(a._warn)), bottom = edgeBottom(x, a._first, a._hw);
    if (top > bottom) return false;
    const y0 = Math.max(top, Math.min(bottom, a._y)), yu = edgeSlide(a, x, y0, i, top), yd = edgeSink(a, x, y0, i, bottom);
    const du = yu === yu ? y0 - yu : Infinity, dd = yd === yd ? yd - y0 : Infinity;
    if (du === Infinity && dd === Infinity) return false;
    a._y = du <= dd ? yu : yd; return true;
  }
  // (whether tag a at the edge, its bottom middle at (x, y), h high and up with its arrow, lands on o: the tag, or its
  // arrow just over its middle; and whether it lands on any of OFF: her ship, the warning or the crosshair)
  const offHit = (o, a, x, y, h, up) => (y > o.t - TAG_GAP && y - h < o.b + TAG_GAP && x + a._hw > o.l - TAG_GAP && x - a._hw < o.r + TAG_GAP)
    || (y - h > o.t - TAG_GAP && y - up < o.b + TAG_GAP && x + arrowHW(a._warn) > o.l - TAG_GAP && x - arrowHW(a._warn) < o.r + TAG_GAP);
  const onOff = (a, x, y) => { const h = tagH(a), up = tagUp(a._warn); for (let j = 0; j < OFF.length; j++) if (offHit(OFF[j], a, x, y, h, up)) return true; return false; };
  // tag a at the edge (the i-th from the top) moved beside the tags in its way, half a tag's width at a time, towards the
  // middle first, then the other way, still on the screen and between the panels there, and rising no higher than
  // `rise`: false if there's nowhere. One on her ship or the warning (`rise` given) tries first just beside each of
  // them it lands on, the nearer side first
  const besideX = [];
  let besideFrom = 0;
  const nearer = (p, q) => Math.abs(p - besideFrom) - Math.abs(q - besideFrom);
  function edgeAt(a, i, x, rise) {
    if (x - a._hw < 4 || x + a._hw > view.w - 4) return false;
    const top = edgeTop(x, tagUp(a._warn)), bottom = edgeBottom(x, a._first, a._hw), lim = Math.max(top, rise);
    if (top > bottom) return false;
    let y = edgeSlide(a, x, Math.max(top, Math.min(bottom, a._y)), i, lim);
    if (y !== y) y = edgeSlide(a, x, bottom, i, lim);
    if (y !== y || y < lim) return false; // (nowhere, or only higher than it may rise: the panels at the bottom there)
    a._x = x; a._y = y; return true;
  }
  function edgeFind(a, i, W2, rise) {
    const inward = a._x > W2 ? -1 : 1, step = a._hw + TAG_GAP, x0 = a._x;
    if (rise > -Infinity) {
      if (edgeAt(a, i, x0, rise)) return true;
      besideX.length = 0;
      const h = tagH(a), up = tagUp(a._warn);
      for (let j = 0; j < OFF.length; j++) {
        const o = OFF[j];
        if (offHit(o, a, x0, a._y, h, up)) besideX.push(o.l - a._hw - TAG_GAP - 1, o.r + a._hw + TAG_GAP + 1);
      }
      besideFrom = x0; besideX.sort(nearer);
      for (let j = 0; j < besideX.length; j++) if (edgeAt(a, i, besideX[j], rise)) return true;
    }
    for (let k = 0; k <= 24; k++) if (edgeAt(a, i, x0 + inward * (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step, rise)) return true;
    return false;
  }
  // tag a at the edge that lands on her ship, the warning or the crosshair, with no room clear of them within two and a
  // half tags of where it's pinned: the nearest place to there of: straight up past them, just beside each of them, and
  // half a tag's width at a time to either side (rather than the first of them, straight up: for a raider dead astern of
  // a Galleon on a phone held upright, that's the middle of the sky among the tags of raiders ahead; the nearest is at the
  // side, by her stern, its arrow still pointing behind). Where it was last frame counts as half as far, so it doesn't
  // hop between two places about as near as the ship rolls. False if there's nowhere
  function edgeNear(a, i, W2) {
    const x0 = a._x, y0 = a._y, step = a._hw + TAG_GAP, h = tagH(a), up = tagUp(a._warn), n = 25, px = a._px, py = a._py;
    besideX.length = 0;
    for (let j = 0; j < OFF.length; j++) if (offHit(OFF[j], a, x0, y0, h, up)) besideX.push(OFF[j].l - a._hw - TAG_GAP - 1, OFF[j].r + a._hw + TAG_GAP + 1);
    const inward = x0 > W2 ? -1 : 1;
    let best = Infinity, bx = 0, by = 0;
    for (let k = 0; k < n + besideX.length; k++) {
      const x = k < n ? x0 + inward * (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step : besideX[k - n];
      a._x = x0; a._y = y0;
      if (!edgeAt(a, i, x, -Infinity)) continue;
      const d = ((a._x - x0) * (a._x - x0) + (a._y - y0) * (a._y - y0)) * (Math.abs(a._x - px) < 16 && Math.abs(a._y - py) < 16 ? 0.25 : 1);
      if (d < best) { best = d; bx = a._x; by = a._y; }
    }
    a._x = x0; a._y = y0;
    if (best === Infinity) return false;
    a._x = bx; a._y = by; return true;
  }
  // a tag with no room by any edge (a small phone held sideways, crowded with raiders all round readying broadsides):
  // the nearest place anywhere on the screen clear of the panels (its arrow too, just over its middle) and of the tags
  // placed before it, and (passes `from` to `to`) of her ship, the warning and the crosshair (0), of her ship and the
  // warning (1), or of nothing more (2). (Rare, so it can look over the whole screen: every 8 by 6 pixels)
  function edgeAnywhere(a, i, from, to) {
    const h = a._warn ? TAG.warn : TAG.h, up = tagUp(a._warn), x0 = a._x, y0 = a._y;
    for (let pass = from; pass <= to; pass++) {
      let best = Infinity, bx = 0, by = 0;
      const n = pass === 0 ? OFF.length : pass === 1 ? OFF.length - 1 : 0;
      for (let x = a._hw + 4; x <= view.w - a._hw - 4; x += 8) for (let y = up + 4; y <= view.h - 4; y += 6) {
        const d = (x - x0) * (x - x0) + (y - y0) * (y - y0);
        if (d < best && clearHere(a, i, x, y, h, up, n)) { best = d; bx = x; by = y; }
      }
      if (best < Infinity) { a._x = bx; a._y = by; return true; }
    }
    return false;
  }
  const hitsPanel = (l, r, t, b) => {
    for (let j = 0; j < EDGE.top.length; j++) { const p = EDGE.top[j]; if (l < p.r + 2 && r > p.l - 2 && t < p.b + 2 && b > p.t - 2) return true; }
    for (let j = 0; j < EDGE.bottom.length; j++) { const p = EDGE.bottom[j]; if (l < p.r + 2 && r > p.l - 2 && t < p.b + 2 && b > p.t - 2) return true; }
    return false;
  };
  function clearHere(a, i, x, y, h, up, nOff) {
    const l = x - a._hw, r = x + a._hw, t = y - up, aw = arrowHW(a._warn);
    if (hitsPanel(l, r, y - h, y) || hitsPanel(x - aw, x + aw, t, y - h)) return false;
    for (let j = 0, au = edgeUp(a); j < i; j++) { const c = edges[j], cu = edgeUp(c); if (Math.abs(x - c._x) < a._hw + c._hw + TAG_GAP && y > c._y - cu - TAG_GAP && y - au < c._y + TAG_GAP) return false; }
    for (let j = 0; j < nOff; j++) if (offHit(OFF[j], a, x, y, h, up)) return false;
    return true;
  }
  // tag a slid from (x, y) up (dir -1) or down (1) until nothing's in its way; NaN if it never gets clear
  function slide(a, x, y, dir, ships = true) {
    for (let n = 0; n < 12; n++) { const to = inWay(a, x, y, dir, ships); if (to !== to) return y; y = to; }
    return NaN;
  }
  const tagFits = (a, x, y) => y === y && x - a._hw >= 4 && x + a._hw <= view.w - 4 && y - tagH(a) >= overTop(x, a._hw) && y <= overBottom(x, a._hw);
  // a tag over her ship placed: the first clear place of: just over her ship, pushed up past whatever's in the way (so a
  // stack of tags sits over all their ships, never on one of them); a little lower, just under the panels along the top
  // (her mast heads reaching up to them: at most 60% of a tag lower); a tag's width or two to either side, pushed up the
  // same (a stack fanned out where it can't rise, under the panels); under her ship; the nearest place anywhere clear of
  // them all (a crowd round the Captain on a small phone); and failing all of them, just under the panels over her,
  // pushed down past the tags in the way (over what it must). A tag moved aside (to one side,
  // or under her ship) stays where it is beside her while that's clear, and comes back over her once there's been room
  // there for TAG_HOME seconds: so tags don't hop about as a crowd of raiders closes in
  const FAN = [0, 1, -1, 2, -2, 3, -3], TAG_HOME = 0.8;
  function placeOver(a) {
    const x0 = a._nx = a._x, y0 = a._ny = a._y;
    if (!clearAt(a, x0, y0)) { a._x = x0 + a._ox; a._y = y0 + a._oy; }
    a._ox = a._x - x0; a._oy = a._y - y0; a._had = true;
  }
  // (false: where it was, beside her ship, is kept)
  function clearAt(a, x0, y0) {
    const step = a._hw * 2 + 6, aside = a._had && (Math.abs(a._ox) > 1 || a._oy > 1);
    let kept = false;
    if (aside) { const x = x0 + a._ox, w = inWay(a, x, y0 + a._oy, -1, true); kept = w !== w && tagFits(a, x, y0 + a._oy); }
    let y = slide(a, x0, y0, -1);
    if (tagFits(a, x0, y)) {
      if (kept && (a._homeAt < 0 || time - a._homeAt < TAG_HOME)) { if (a._homeAt < 0) a._homeAt = time; return false; }
      a._y = y; a._homeAt = -1; return true;
    }
    a._homeAt = -1;
    if (kept) return false;
    y = slide(a, x0, Math.max(y0, overTop(x0, a._hw) + tagH(a)), 1);
    if (y - y0 <= tagH(a) * 0.6 && tagFits(a, x0, y)) { a._y = y; return true; }
    for (let k = 1; k < FAN.length; k++) { const x = x0 + FAN[k] * step; y = slide(a, x, y0, -1); if (tagFits(a, x, y)) { a._x = x; a._y = y; return true; } }
    if (a._box) for (let k = 0; k < 3; k++) { const x = x0 + FAN[k] * step; y = slide(a, x, a._sb + TAG_GAP + tagH(a), 1); if (tagFits(a, x, y)) { a._x = x; a._y = y; return true; } }
    if (overAnywhere(a, x0, y0)) return true;
    const x = Math.max(a._hw + 4, Math.min(view.w - a._hw - 4, x0));
    y = Math.max(y0, overTop(x, a._hw) + tagH(a));
    const down = slide(a, x, y, 1, false);
    a._x = x; a._y = down === down ? down : y;
    return true;
  }
  // (the nearest place to just over her ship anywhere on the screen, clear of the panels, the other tags and their
  // arrows, the ships and OFF: looked for every 10 by 8 pixels, rarely, as it's kept while it stays clear)
  function overAnywhere(a, x0, y0) {
    let best = Infinity, bx = 0, by = 0, w;
    for (let x = a._hw + 4; x <= view.w - a._hw - 4; x += 10) for (let y = tagH(a) + 6; y <= view.h - 6; y += 8) {
      const d = (x - x0) * (x - x0) + (y - y0) * (y - y0);
      if (d < best && tagFits(a, x, y) && (w = inWay(a, x, y, -1, true)) !== w) { best = d; bx = x; by = y; }
    }
    if (best === Infinity) return false;
    a._x = bx; a._y = by; return true;
  }
  // the tags at the edge placed, top to bottom (edges, sorted by where they're pinned): stacked along it, from the bottom
  // up, the higher of two pushed up by the lower one's height (and its arrow's, unless arrowRoom is off; one saying
  // "Broadside!" may be a little taller); then from the top down, one pushed up past the highest it may be (into the
  // panels along the top) comes back down, and any stacked under it move down to make room (but never on to the panels
  // along the bottom). False if one found no room anywhere
  function placeEdges(W2) {
    let fits = true;
    for (let i = edges.length - 2; i >= 0; i--) {
      const a = edges[i];
      for (let j = edges.length - 1; j > i; j--) { const b = edges[j], h = edgeUp(b); if (Math.abs(a._x - b._x) < a._hw + b._hw && b._y - a._y < h) a._y = b._y - h; }
    }
    for (let i = 0; i < edges.length; i++) {
      const a = edges[i], h = edgeUp(a), keep = arrowRoom;
      a._y = Math.max(a._y, a._top);
      for (let j = 0; j < i; j++) { const b = edges[j]; if (Math.abs(a._x - b._x) < a._hw + b._hw) a._y = Math.max(a._y, b._y + h); }
      a._y = Math.min(a._y, edgeBottom(a._x, a._first, a._hw));
      // (no room left for it along the edge, as down the right of a phone held sideways, where the panels leave room for
      // a tag or two: it goes up past the tags in its way, or beside them, half a tag's width at a time, towards the
      // middle first, then the other way, still on the screen and between the panels there)
      // (and one landing on the Captain's ship, the warning or the crosshair, OFF, moves off them the same way: first where
      // it rises at most two and a half tags from where it's pinned, so it stays by its edge, beside her ship; then the
      // nearest place to there (edgeNear). On a screen too crowded for that, a tag on another hides more than one on her
      // ship: it keeps clear of the tags only)
      // (a tag by the side of the screen saying "Broadside!", or glowing as she bursts up through the clouds, stays by
      // that side, stacked with the others there, wherever there's room up or down it; and any other tag by a side that
      // would be slid in more than a quarter of the screen's width does the same, if there's room, as does one that
      // would stay by it but further up or down than it need: not down in the corner under the steering thumb, say,
      // where there's room just over the tags in its way)
      const side = bySide(a, W2), x0 = a._x, y0 = a._y;
      if (edgeSlide(a, a._x, a._y, i, -Infinity) !== a._y && !(side && a._first && edgeAlong(a, i))) {
        const on = onOff(a, a._x, a._y);
        if (edgeFind(a, i, W2, on ? a._y - 2.5 * TAG.h : -Infinity) || (on && edgeNear(a, i, W2))) {
          if (side) { const nx = a._x, ny = a._y, dx = Math.abs(nx - x0); a._x = x0; a._y = y0; if (!(edgeAlong(a, i) && (dx > view.w / 4 || (dx <= 1 && Math.abs(a._y - y0) < Math.abs(ny - y0))))) { a._x = nx; a._y = ny; } }
        } else {
          // (no room clear of all of them by the edge with the other tags' arrows kept clear too: the same again with
          // their arrows left out, so on a crowded screen an arrow may lie under the tag above it rather than a tag lie
          // on her ship or the crosshair. Then clear of her ship and the warning there, the crosshair left out; failing
          // that, anywhere on the screen clear of them all, or of her ship and the warning; and only then clear of the
          // other tags only, by the edge or anywhere)
          arrowRoom = false;
          if (edgeSlide(a, a._x, a._y, i, -Infinity) !== a._y && !(side && a._first && edgeAlong(a, i)) && !edgeFind(a, i, W2, on ? a._y - 2.5 * TAG.h : -Infinity) && !(on && edgeNear(a, i, W2))) {
            offN = OFF.length - 1;
            if (edgeSlide(a, a._x, a._y, i, -Infinity) !== a._y && !edgeFind(a, i, W2, -Infinity) && !edgeAnywhere(a, i, 0, 1)) {
              offN = 0;
              if (edgeSlide(a, a._x, a._y, i, -Infinity) !== a._y && !edgeFind(a, i, W2, -Infinity) && !edgeAnywhere(a, i, 2, 2)) fits = false;
            }
            offN = OFF.length;
          }
          arrowRoom = keep;
        }
      }
    }
    return fits;
  }
  // the tags at the edge (edges) placed, top to bottom (sorted by where they're pinned). A tag at the edge counts with its
  // arrow over it, so the one above never hides the arrow of the one below. On a screen too crowded for that, the
  // smallest phone with raiders all round readying broadsides, where some tag would find no room at all, they're all
  // placed again from where they were pinned, packed by their tags alone; and if even that leaves one with no room, a
  // new Captain's tip showing makes way for them (coach.js makeWay: the raiders' warnings come first), and they're placed
  // again where it was
  const rest = [], firsts = [], FIRSTS = []; // (the tags at the edge placed after those placed first, and the boxes those keep the others off: tags)
  function stackEdges(W2) {
    edges.sort(byY);
    for (let i = 0; i < edges.length; i++) { edges[i]._ex = edges[i]._x; edges[i]._ey = edges[i]._y; }
    for (let round = 0, fit = false; round < 2 && !fit; round++) {
      for (let pass = 0; pass < 2 && !fit; pass++) {
        arrowRoom = pass === 0;
        if (pass || round) for (let i = 0; i < edges.length; i++) { edges[i]._x = edges[i]._ex; edges[i]._y = edges[i]._ey; }
        fit = placeEdges(W2);
      }
      if (!fit && !coach.makeWay()) break;
    }
    arrowRoom = true;
  }
  // each raider's tag: over it, or at the edge of the screen pointing to it (flashing red and saying "Broadside!" as she
  // readies a broadside, with a ring closing as she's about to fire); its distance and health ten times a second. (dt:
  // the frame's seconds, for a tag gliding to a new place)
  const BURST_GLOW = 2.7; // (how long a raider's tag glows once she's burst up through the clouds, seconds)
  function tags(slow, dt = 0) {
    const W2 = view.w / 2, H2 = view.h / 2;
    if (TAG.sizes !== sizes) { TAG.sizes = sizes; TAG.measured = TAG.warned = false; for (const r of raiders.list) if (r.tag) r.tag._measure = true; } // (a new window size: tags measured again)
    // (her ship on the screen and the warning, kept off her: the tags keep off both)
    ownBox(W2, H2); placeWarn();
    OFF.length = 0; if (OWN.on) for (let s = 0; s < SLABS; s++) OFF.push(OWN.slabs[s]); if (WARN_AT.on) OFF.push(WARN_AT);
    // (and a toast while it shows: so "Rising through the clouds..." under the crosshair of a phone held sideways never
    // hides the tag of the raider it points to, low in the view, nor one at the edge of a phone held upright)
    if (performance.now() < TOAST_AT.until && TOAST_AT.r > TOAST_AT.l) OFF.push(TOAST_AT);
    // (and the crosshair: tags at the edge keep off it, and so do those over ships, which go just over it when they'd
    // land on it, as one over a raider coming up from under the Captain's ship would)
    CROSS.l = W2 - 27; CROSS.r = W2 + 27; CROSS.t = H2 - 27; CROSS.b = H2 + 27; OFF.push(CROSS); offN = OFF.length;
    placed.length = 0;
    // (the way the view looks, level, and its right, for the arrows at the edge)
    const E = camera.matrixWorld.elements;
    lookF.set(-E[8], 0, -E[10]); if (lookF.lengthSq() < 1e-6) lookF.set(E[4], 0, E[6]); lookF.normalize(); lookR.set(-lookF.z, 0, lookF.x);
    for (const r of tagged()) {
      let el = r.tag;
      if (!el) {
        // (a named raider captain's tag gives her name; the Man-o'-war's shows her five crystal columns, each with what's
        // left of it, in place of the crystals' bar, and how many guns she has left by her name. Brightvein's: a barge of
        // the claim's in plum, a raid's boss and its named ships by their names)
        el = r.tag = document.createElement('div'); el.className = r.friend ? 'tag friend' : r.boss ? 'tag captain boss' : r.captain ? 'tag captain' : r.role === 'prize' ? 'tag captain prize' : r.fort ? 'tag fort' : 'tag';
        const bars = (r.fort ? PARTS.slice(0, 2) : PARTS).map((k) => `<span class="meter ${k}"><b></b><i></i></span>`).join('') + (r.fort ? `<span class="pips">${'<span><i></i></span>'.repeat(r.R.clusters.length)}</span>` : '');
        const label = r.friend ? esc(r.name.replace('Ore barge ', 'Barge · ')) : r.boss || r.named ? esc(r.name) : `${r.who ? `${r.who.name} · ` : r.captain ? 'Captain · ' : r.role === 'prize' ? 'Treasure · ' : ''}${r.R.cls}`;
        el.innerHTML = `<span class="arrow"></span><b>${label}<i class="st"></i></b> <span class="d"></span>${bars}<span class="bs"><i class="ring"></i>Broadside!</span><span class="lost">Lost in the cloud</span>`;
        el._d = el.querySelector('.d'); el._m = [...el.querySelectorAll('.meter i')].map(chip); el._arrow = el.querySelector('.arrow'); el._fresh = true; el._hw = 42; el._ox = el._oy = 0; el._had = false; el._homeAt = -1;
        el._say = el.querySelector('.st'); el._pips = [...el.querySelectorAll('.pips i')];
        H.tags.append(el); // (raiders.js takes it away with its raider)
      }
      if (r.f.down) { el.remove(); continue; }
      // (one coming out of the sun: no tag till she's out of its glare, raiders.js)
      if (el._unseen !== r.unseen > 0) { el._unseen = r.unseen > 0; el.classList.toggle('unseen', el._unseen); el._measure = true; }
      if (el._unseen) continue;
      // (one hidden in cloud far off: her tag stays where she was last seen, saying so, with how far off that is; one
      // readying a broadside there isn't lost, sky.js, so a "Broadside!" at the edge points to where she really is)
      proj.copy(r.lost ? r.seenAt : r.f.pos); proj.y += r.R.length * 0.45 + 3; proj.project(camera);
      // in pixels from the middle of the screen; off screen (or behind), pinned to the edge in its direction
      const behind = proj.z > 1;
      let x = proj.x * W2 * (behind ? -1 : 1), y = -proj.y * H2 * (behind ? -1 : 1);
      // (an arrow at the edge points the way she is from where you're looking, wherever its tag ends up: by her bearing
      // from the way the view looks, level, so up is ahead, down behind and either side abeam; or, for one ahead and
      // within the view's width but above or below it, straight at her)
      const at = r.lost ? r.seenAt : r.f.pos, tx = at.x - camera.position.x, tz = at.z - camera.position.z;
      const turn = Math.round((!behind && Math.abs(proj.x) <= 1 ? Math.atan2(x, -y) : Math.atan2(tx * lookR.x + tz * lookR.z, tx * lookF.x + tz * lookF.z)) * 50) / 50;
      // (off screen: pinned where the line to her meets the edge, then kept between the panels at the top and bottom)
      const ax = edgeX(el, W2), k = Math.max(Math.abs(x) / ax, y < 0 ? -y / (H2 - tagUp(false) - 6) : y / (H2 - 6));
      const edge = behind || k > 1;
      // while she readies a broadside (her red fan showing), her tag flashes red and says so, with a ring closing as she's
      // about to fire: over her, and at the edge, where her glowing ports and her fan can't be seen (on a phone a raider
      // alongside usually is)
      const warn = !!r.charge.b, rose = time - (r.burstAt ?? -99) < BURST_GLOW; // (and just burst up through the clouds: her tag glows, game.html)
      if (warn) { const k = Math.round((r.charge.T > 0 ? 1 - Math.max(0, r.charge.t) / r.charge.T : 1) * 20) / 20; if (el._k !== k) { el._k = k; el.style.setProperty('--k', String(k)); } }
      // (and the highest an edge tag may be pushed to make room for another, below: just under the panels along the top)
      let top = TAG.h + 6;
      if (edge) {
        x /= Math.max(k, 1e-6); y /= Math.max(k, 1e-6);
        // (where the panels at the top and bottom leave no room for her tag and its arrow between them, as down the
        // right of a phone held sideways, it slides in towards the middle until they do)
        const up = tagUp(warn);
        top = edgeTop(W2 + x, up);
        let bottom = edgeBottom(W2 + x, warn || rose, el._hw);
        for (let n = 0; top > bottom && n < 24 && Math.abs(x) > 16; n++) { x -= Math.sign(x) * 16; top = edgeTop(W2 + x, up); bottom = edgeBottom(W2 + x, warn || rose, el._hw); }
        y = Math.max(top - H2, Math.min(bottom - H2, y));
      }
      if (el._edge !== edge) { el._edge = edge; el.classList.toggle('edge', edge); }
      if (el._warn !== warn) { el._warn = warn; el._measure = true; el.classList.toggle('warn', warn); if (warn && !TAG.warned && el.offsetHeight) { TAG.warned = true; TAG.warn = el.offsetHeight + 1; } }
      if (el._locked !== (r === locked)) { el._locked = r === locked; el.classList.toggle('locked', el._locked); }
      if (el._rose !== rose) { el._rose = rose; el.classList.toggle('burst', rose); }
      el._first = warn || rose ? 1 : 0; // (at the edge, hers is placed first, and kept by its side: below)
      if (el._lost !== r.lost) { el._lost = r.lost; el._measure = true; el.classList.toggle('lost', r.lost); if (r.lost) el.querySelector('.lost').textContent = r.smoke > 0 ? 'Lost in the smoke' : 'Lost in the cloud'; } // (the Ghost's smoke screen, or cloud)
      el._x = W2 + x; el._y = H2 + y; el._top = top; placed.push(el);
      el._box = el._ship = false; if (!edge && !r.lost) shipBox(r, el, W2, H2); // (her ship on the screen: tags keep off it)
      if (edge) el._had = false; // (back over her ship, her tag starts afresh)
      if (edge && el._turn !== turn) { el._turn = turn; el._arrow.style.transform = `rotate(${turn}rad)`; }
      if (slow || el._fresh) {
        el._fresh = false;
        const d = Math.round((r.lost ? r.seenAt : r.f.pos).distanceTo(player.pos) / 10) * 10; // (one lost in cloud: how far off she was last seen, where her tag is)
        if (el._dist !== d) { el._dist = d; el._d.textContent = `${d} m`; el._measure = true; }
        if (!TAG.measured && !el._warn && el.offsetHeight) { TAG.measured = true; TAG.h = el.offsetHeight + 1; }
        for (let i = 0; i < el._m.length; i++) setWidth(el._m[i], r.f.frac(PARTS[i]));
        // (what she's up to, by her name: running; her flare's help coming in so many seconds; the Man-o'-war's guns left;
        // still below the clouds, rising: one word, so her tag stays small)
        const st = r.mode === 'run' ? ' · running' : r.flare?.left > 0 ? ` · help in ${Math.ceil(r.flare.left)}` : r.fort ? ` · ${r.fort.guns} guns` : r.rising && r.f.pos.y < CLOUD_Y - 20 ? ' · rising' : '';
        if (el._said !== st) { el._said = st; el._say.textContent = st; el._measure = true; }
        if (el._pips.length) { const Wr = r.ship.wear, n = el._pips.length, each = r.f.full.crystals / n; for (let i = 0; i < n; i++) setWidth(el._pips[i], Wr ? (Wr.blown[i] ? 0 : Math.max(0, 1 - Wr.dmg[i] / each)) : 1); }
      }
    }
    // (each tag's width, measured again whenever its words change: all of them at once, so the page is laid out once.
    // One at the edge that came out wider than it was taken to be, a new one say, is brought in so all of it shows)
    for (let i = 0; i < placed.length; i++) {
      const el = placed[i];
      if (!el._measure) continue;
      el._measure = false; const w = el.offsetWidth; if (w) el._hw = w / 2;
      if (w && el._warn && !TAG.warned) { TAG.warned = true; TAG.warn = el.offsetHeight + 1; } // (and the tags' heights, after the window changed)
      if (w && !el._warn && !TAG.measured) { TAG.measured = true; TAG.h = el.offsetHeight + 1; }
      if (el._edge) { const ax = edgeX(el, W2); el._x = W2 + Math.max(-ax, Math.min(ax, el._x - W2)); }
    }
    // tags that would land on another tag, or on a raider's ship, find somewhere clear instead: those at the edge of the
    // screen stacked along it (stackEdges). The warning is always drawn on top (game.html)
    edges.length = over.length = rest.length = 0;
    for (let i = 0; i < placed.length; i++) { const a = placed[i]; (!a._edge ? over : a._first ? edges : rest).push(a); }
    // (the tags at the edge of a raider readying her broadside and of one just burst up through the clouds are placed
    // first, where they're pinned, so they point straight at her from the edge she's off; the others then keep clear of
    // them as they do of her ship (in OFF, the crosshair still last), so they're the ones that move: with the burst's
    // tag placed among the rest, the second of two raiders rising on the left was pushed off her edge to the middle of a
    // phone, over the crosshair, or down under the steering thumb)
    if (edges.length && rest.length) {
      stackEdges(W2);
      firsts.length = 0; OFF.pop();
      for (let i = 0; i < edges.length; i++) { const a = edges[i], o = FIRSTS[i] ??= { l: 0, r: 0, t: 0, b: 0 }; o.l = a._x - a._hw; o.r = a._x + a._hw; o.t = a._y - edgeUp(a); o.b = a._y; OFF.push(o); firsts.push(a); }
      OFF.push(CROSS); offN = OFF.length;
      edges.length = 0; for (let i = 0; i < rest.length; i++) edges.push(rest[i]);
      stackEdges(W2);
      // (then all of them, for the tags over ships to keep clear of; and OFF as it was)
      for (let i = 0; i < firsts.length; i++) edges.push(firsts[i]);
      OFF.length -= firsts.length + 1; OFF.push(CROSS); offN = OFF.length;
    } else { for (let i = 0; i < rest.length; i++) edges.push(rest[i]); stackEdges(W2); }
    // those over their ships, from the highest on the screen down, each in the first clear place (placeOver): the
    // highest just over her ship, one that would land on it (or on her ship: two raiders far off, one just over the
    // other) over it, so every ship of a stack shows under all its tags; one that can't rise there (under the panels
    // along the top, the compass and the guns' label among them) beside it, or under her ship
    over.sort(byY);
    for (overN = 0; overN < over.length; overN++) placeOver(over[overN]);
    // (a tag over her ship moved to a new place beside her glides there in a moment, rather than jumping: how far it is
    // from just over her eases to where it's going, while it follows her ship as she moves. One at the edge, or just
    // come back from it, jumps)
    const ease = 1 - Math.exp(-dt * 16);
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      if (a._edge) { a._glide = false; continue; }
      const tx = a._x - a._nx, ty = a._y - a._ny;
      if (!a._glide) { a._glide = true; a._gx = tx; a._gy = ty; }
      else { a._gx += (tx - a._gx) * ease; a._gy += (ty - a._gy) * ease; if (Math.abs(tx - a._gx) < 0.5 && Math.abs(ty - a._gy) < 0.5) { a._gx = tx; a._gy = ty; } }
      a._x = a._nx + a._gx; a._y = a._ny + a._gy;
    }
    // (while a banner shows, a wave's say, the tags that would be under it fade away, so both can be read: a wave's
    // raiders come in on the horizon, right where its banner is. They come back as it fades. One saying "Broadside!"
    // always shows)
    const hush = performance.now() < bannerAt.until - BANNER_BACK;
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i], x = Math.round(a._x * 2) / 2, y = Math.round(a._y * 2) / 2;
      if (a._px !== x || a._py !== y) { a._px = x; a._py = y; a.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
      const under = hush && !a._warn && x + a._hw > bannerAt.left && x - a._hw < bannerAt.right && y > bannerAt.top && y - TAG.h < bannerAt.bottom;
      if (a._hush !== under) { a._hush = under; a.classList.toggle('hush', under); }
    }
  }
  // ---------- bounties ----------
  // where a raider goes down, her bounty rises out of the wreck in gold and fades: "◆ 75", "Captain's bounty ◆ 600",
  // "Treasure ◆ 400". Six labels, reused. One that would rise over a banner showing then (a wave's, say), or rise into
  // it (it rises 40 px), shows just under it instead (dy, in pixels) and doesn't rise, so both can be read
  const BOUNTY_LIFE = 2.2, BOUNTIES = [...document.querySelectorAll('#bounties .bounty')].map((el) => ({ el, at: new THREE.Vector3(), t: BOUNTY_LIFE, dy: 0, rise: 40, w: 0, h: 0, label: el.querySelector('small'), num: el.querySelector('b span') }));
  let bountyN = 0;
  function bounty(r, total, at) {
    const b = BOUNTIES[bountyN]; bountyN = (bountyN + 1) % BOUNTIES.length;
    b.at.copy(at).setY(at.y + r.R.length * 0.3); b.t = 0; b.dy = 0; b.rise = 40;
    if (performance.now() < bannerAt.until) {
      proj.copy(b.at).project(camera);
      const x = (proj.x + 1) * view.w / 2, y = (1 - proj.y) * view.h / 2;
      if (proj.z < 1 && x > bannerAt.left - 90 && x < bannerAt.right + 90 && y > bannerAt.top - 70 && y < bannerAt.bottom + 64) { b.dy = bannerAt.bottom + 44 - y; b.rise = 0; }
    }
    b.label.textContent = r.captain ? 'Captain\'s bounty' : r.role === 'prize' ? 'Treasure' : '';
    b.num.textContent = fmt(total);
    b.el.classList.toggle('rich', r.captain || r.role === 'prize'); b.el.hidden = false;
    b.w = 0; // (its size is measured only if the card between waves comes up while it shows: not here, mid-step)
  }
  function bounties(dt) {
    for (const b of BOUNTIES) {
      if (b.el.hidden) continue;
      if ((b.t += dt) >= BOUNTY_LIFE) { b.el.hidden = true; continue; }
      const k = b.t / BOUNTY_LIFE;
      proj.copy(b.at).project(camera);
      if (proj.z > 1) { b.el.style.opacity = '0'; continue; }
      const x = (proj.x + 1) * view.w / 2, s = 1 + 0.3 * (1 - k);
      let y = (1 - proj.y) * view.h / 2 - b.rise * k + b.dy;
      // the card between waves up (or rising: the wave's last raider has just gone down), and the bounty where it is or
      // will be: it shows just under the card instead (above it, where the card is at the bottom)
      if (W.state === 'choose' && CALM_AT.on) {
        if (!b.w) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; } // (once, the first time it's wanted: rare, as a wave ends)
        const hw = (b.w * s) / 2 + 6, hh = (b.h * s) / 2 + 6, C = CALM_AT;
        if (x + hw > C.l && x - hw < C.r && y + hh > C.t && y - hh < C.b) y = C.top ? C.b + hh : C.t - hh;
      }
      b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${s.toFixed(3)})`;
      b.el.style.opacity = (k < 0.08 ? k / 0.08 : k > 0.7 ? (1 - k) / 0.3 : 1).toFixed(2);
    }
  }
  function hideBounties() { for (const b of BOUNTIES) { b.el.hidden = true; b.t = BOUNTY_LIFE; } }

  // where the big map's names go, w by h pixels at f pixels high: each in the middle of its region, unless that lands it
  // on (or within half its height of) a name placed already, from the top down; then it moves down (or up) out of
  // the way. Kept in from the map's edges. (Made only when the map's size changes, or the fonts have come in)
  const NAMES_AT = { w: 0, h: 0, fonts: '', at: [] };
  function names(w, h, f) {
    Object.assign(NAMES_AT, { w, h, fonts: document.fonts?.status, at: [] });
    const gap = f / 2, pad = f / 3;
    for (const R of [...REGIONS].sort((a, b) => a.v - b.v)) {
      const name = R.name.replace(/^The /, ''), bw = mctx.measureText(name).width + mctx.lineWidth, bh = f * 1.1;
      const L = { name, x: THREE.MathUtils.clamp(R.u * w, bw / 2 + pad, w - bw / 2 - pad), y: R.v * h, w: bw, h: bh };
      for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (const o of NAMES_AT.at) {
          if (Math.abs(L.x - o.x) >= (L.w + o.w) / 2 + gap || Math.abs(L.y - o.y) >= (L.h + o.h) / 2 + gap) continue;
          L.y = L.y >= o.y ? o.y + (L.h + o.h) / 2 + gap : o.y - (L.h + o.h) / 2 - gap; moved = true;
        }
        if (!moved) break;
      }
      L.y = THREE.MathUtils.clamp(L.y, bh / 2 + pad, h - bh / 2 - pad);
      NAMES_AT.at.push(L);
    }
  }

  function hud(dt, battery) {
    hudTimer -= dt;
    const slow = hudTimer <= 0;
    hurt = Math.max(0, hurt - dt * 1.2);
    const red = Math.round(Math.max(hurt, player.down ? 0.6 : 0) * 50) / 50;
    if (H.hurt._o !== red) { H.hurt._o = red; H.hurt.style.opacity = String(red); }
    const n = gunnery.count(battery), rl = gunnery.ready[battery], full = gunnery.reload(battery), guns = n * 10 + (locked && !reach ? 1 : 0);
    if (H.battery !== battery || H.guns !== guns) {
      H.battery = battery; H.guns = guns;
      setText(H['battery-name'], n ? BATTERY_NAMES[battery] : `No ${BATTERY_NAMES[battery].toLowerCase()}`);
      setText(H['battery-count'], !n ? '–' : locked && !reach ? 'out of reach' : `${n} gun${n > 1 ? 's' : ''}`);
    }
    setWidth(H['reload-bar'], n ? 1 - rl / full : 0);
    const aim = locked ? (reach ? 'locked' : 'locked far') : '';
    if (H.aim._v !== aim) { H.aim._v = aim; H.aim.className = aim; }
    // a warning under the crosshair (ten times a second), written before the tags are placed, as it keeps off her ship
    // and they keep off it
    if (slow) {
      const w = H.warn;
      const warn = player.down ? '' : player.frac('crystals') < 0.5 ? 'The crystals are cracked: she\'s sinking'
        : player.pos.y > THINNING - 350 ? 'Nearing the Thinning: the crystals can\'t lift you higher'
          : Math.abs(player.pos.x) > MAP.w / 2 + 1500 || Math.abs(player.pos.z) > MAP.h / 2 + 1500 ? 'Open sea: Aethermoor is behind you' : '';
      // (and in its place, calmly, while she's hidden deep in cloud)
      const note = !warn && player.hidden && W.state === 'fight' ? 'Hidden in the cloud' : '';
      w.hidden = !warn && !note; if (warn || note) setText(w, warn || note);
      if (w._note !== !!note) { w._note = !!note; w.classList.toggle('note', !!note); }
    }
    tags(slow, dt);
    bounties(dt);
    // the shard count counts up to what's in the hold (written only when the whole number shown changes)
    const C = shardCount;
    if (V.shards !== C.to) { C.from = C.shown; C.to = V.shards; C.t = 0; }
    if (C.t < 1) { C.t = Math.min(1, C.t + dt / 0.6); const k = 1 - (1 - C.t) ** 3; C.shown = C.from + (C.to - C.from) * k; }
    const sn = Math.round(C.shown);
    if (sn !== C.n) { C.n = sn; setText(H['voyage-n'], fmt(sn)); }
    // and the card's bonus for the wave, as the card rises (the same)
    if (W.state === 'choose' && W.bonusShown !== W.bonus) {
      const k = Math.min(1, Math.max(0, (performance.now() / 1000 - W.bonusAt) / 0.8)), bn = Math.round(W.bonus * (1 - (1 - k) ** 3)), b = $('calm-bonus');
      if (b && b._n !== bn) { b._n = bn; b.textContent = fmt(bn); }
      if (k >= 1) W.bonusShown = W.bonus;
    }
    if (!slow) return;
    hudTimer = 0.1;
    coach.update(0.1, inpNow); // (a new Captain's tips)
    if (said.length && performance.now() >= TOAST_AT.until - 800) toast(said.shift()); // (what her record paid out: deeds.js)
    setText(H['r-speed'], `${Math.round(player.speed * 3.6)} km/h`);
    setText(H['r-height'], `${fmt(player.pos.y)} m`);
    setText(H['r-sail'], `${Math.round(player.sail * 100)}%`);
    setWidth(H['sail-bar'], player.sail);
    for (const k of PARTS) {
      setWidth(H[`h-${k}`], player.frac(k));
      setText(H[`n-${k}`], String(Math.ceil(player.health[k])));
      H[`row-${k}`].classList.toggle('low', player.frac(k) < 0.3);
    }
    setText(H['score-n'], String(V.downed)); setText(H['score-raiders'], V.downed === 1 ? 'raider ' : 'raiders '); setText(H['wave-n'], trial ? '' : String(W.state === 'choose' ? W.n : W.n + 1)); // (the card up: the wave just beaten; on a sea trial, no wave)
    const deg = compassDeg(player.heading);
    setText(H.heading, `${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]} ${Math.round(deg)}°`);
    // the wind, against the ship: the arrow points the way it blows (up is the way you're heading), and in words how
    // much it adds to or takes from your top speed ("Wind behind: 8% faster"; on a phone just "8% faster")
    const help = Math.round(windHelp(player.heading) * 100);
    setStyle(H['wind-arrow'], 'transform', `rotate(${(-(WIND.dir - player.heading)).toFixed(2)}rad)`);
    setText(H['wind-words'], help >= 2 ? 'Wind behind:' : help <= -2 ? 'Head wind:' : 'Wind across:');
    setText(H['wind-n'], help >= 2 ? `${help}% faster` : help <= -2 ? `${-help}% slower` : 'no help');
    const sg = player.surge;
    setWidth(H['h-surge'], sg.on > 0 ? sg.on / player.SG.time : sg.charge);
    H['row-surge'].classList.toggle('ready', sg.charge >= 1);
    H['btn-surge'].disabled = sg.charge < 1;
    shotsShown(); // (her shot, if it changed some other way: a shot bought or earned)
    // the crew patching her: the row for what they patch glows; on a laptop the Patch row fills as they get ready again;
    // on a phone the Patch button shows once she's hurt (her worst part under 70%), and from the moment they patch until
    // they're ready again, dimmed, its ring filling as they get ready (a patch often lifts her over 70%: the ring still
    // says when they can again)
    const PT = player.patch, ready = 1 - PT.cd / (PATCH.time + PATCH.wait);
    for (const k of PARTS) H[`row-${k}`].classList.toggle('patching', PT.t > 0 && PT.part === k);
    setWidth(H['h-patch'], PT.t > 0 ? PT.t / PATCH.time : ready);
    H['row-patch'].classList.toggle('ready', PT.cd <= 0);
    const pw = player.worst(), pb = H['btn-patch'], show = !player.down && (PT.cd > 0 || (player.frac(pw) < PATCH.show && player.frac(pw) < player.patchCap(pw) - 0.02));
    if (pb.hidden === show) { pb.hidden = !show; layout(); }
    if (show) {
      const k = Math.round(ready * 40) / 40;
      if (pb._k !== k) { pb._k = k; pb.style.setProperty('--k', String(k)); }
      if (pb._busy !== PT.cd > 0) { pb._busy = PT.cd > 0; pb.classList.toggle('busy', pb._busy); }
      if (pb._on !== PT.t > 0) { pb._on = PT.t > 0; pb.classList.toggle('on', pb._on); }
    }
    // a new region's name, at a quiet moment: not in a fight, not over a banner (they share the sky under the compass) or a
    // toast (between waves on a phone held upright, with a tall card, the toast goes up near it),
    // and not over the card between waves where that sits at the top (a phone held sideways)
    const r = regionAt(player.pos.x, player.pos.z);
    if (r !== region && (regionTimer -= 0.1) <= 0 && W.state !== 'fight' && !(W.state === 'choose' && view.h <= 500) && !player.down && performance.now() > Math.max(bannerAt.until, TOAST_AT.until)) {
      region = r; regionTimer = 2; const el = $('region'); $('region-name').textContent = r; $('region-air').textContent = sky.line(r); flash(el);
      payload('region').name = r; emit('region'); // (a soft chord: sound.js)
    }
    // the corner map, with the ship as a gold arrow and the raiders as red dots. It's sized here, as it's drawn, so it's
    // always as sharp as it shows (it has no size while hidden on the title screen or in port, or before the big map)
    if (mimg.complete && mimg.naturalWidth) {
      const dpr = Math.min(devicePixelRatio, 2), cw = Math.round(mini.clientWidth * dpr), ch = Math.round(mini.clientHeight * dpr);
      if (cw && ch && (cw !== mini.width || ch !== mini.height)) { mini.width = cw; mini.height = ch; }
      const W2 = mini.width, H2 = mini.height;
      mctx.drawImage(mimg, 0, 0, W2, H2);
      const x = (player.pos.x / MAP.w + 0.5) * W2, y = (player.pos.z / MAP.h + 0.5) * H2, s = Math.max(5, W2 / 40);
      mctx.fillStyle = '#ff4636'; mctx.strokeStyle = '#3a1631'; mctx.lineWidth = Math.max(1, s / 5);
      for (const q of raiders.list) {
        if (q.f.down) continue;
        const at = q.lost ? q.seenAt : q.f.pos; // (one lost in cloud: a ring where she was last seen)
        mctx.beginPath(); mctx.arc((at.x / MAP.w + 0.5) * W2, (at.z / MAP.h + 0.5) * H2, s * 0.45, 0, Math.PI * 2);
        if (q.lost) { mctx.strokeStyle = '#ff4636'; mctx.stroke(); mctx.strokeStyle = '#3a1631'; } else { mctx.fill(); mctx.stroke(); }
      }
      mctx.save(); mctx.translate(x, y); mctx.rotate(-player.heading + Math.PI);
      mctx.fillStyle = '#e2bd67'; mctx.lineWidth = Math.max(1.5, s / 4);
      mctx.beginPath(); mctx.moveTo(0, -s * 1.3); mctx.lineTo(s * 0.8, s); mctx.lineTo(0, s * 0.45); mctx.lineTo(-s * 0.8, s); mctx.closePath(); mctx.fill(); mctx.stroke();
      mctx.restore();
      // the big map names the regions (never smaller than 11 of the page's pixels, to read on a phone), each clear of
      // the others (names), placed again when the map's size changes
      if (mini.classList.contains('big')) {
        const f = Math.round(Math.max(W2 / 46, 11 * dpr));
        mctx.font = `700 ${f}px Cinzel, Georgia, serif`; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.lineJoin = 'round';
        mctx.lineWidth = f / 4; mctx.strokeStyle = 'rgba(20, 10, 24, 0.85)'; mctx.fillStyle = '#ecdcb8';
        if (NAMES_AT.w !== W2 || NAMES_AT.h !== H2 || NAMES_AT.fonts !== document.fonts?.status) names(W2, H2, f);
        for (const L of NAMES_AT.at) { mctx.strokeText(L.name, L.x, L.y); mctx.fillText(L.name, L.x, L.y); }
      }
    }
  }

  let last = performance.now(), time = 0, held = null, lastPop = -1, lastShard = -9, run = 0;
  const loaded = { port: 0, starboard: 0 }, SIDES = ['port', 'starboard'], READY = payload('guns:ready'); // (each broadside's reload, as it was)
  const hold = new THREE.Vector3(); // where the ship's hold is, that the shards fly to
  const GATHER = payload('shards:gather');
  // the shard count pops gold as they come in (once in a while, as they stream in)
  const POP = [{ transform: 'scale(1.15)', boxShadow: '0 0 0 1px #e2bd67, 0 0 18px rgba(226, 189, 103, 0.8)' }, { transform: 'none', boxShadow: '0 0 0 0 rgba(226, 189, 103, 0)' }];
  const POP_TIMING = { duration: 500, easing: 'ease-out' };
  // one step of the game: controls, flying, the raiders, the camera, the guns, the shots, the HUD
  function tick(dt) {
    time += dt;
    const inp = held ?? input.read();
    for (const k of inp.pressed) {
      if (k === 'c') { cam.yaw = 0; cam.pitch = 0.2; }
      else if (k === 'm') bigMap();
      else if (k === 'h') toggleHelp();
      else if (k === 'p') pause(true);
      else if (k === 'r') { if (player.startSurge()) { toast('Surge!'); emit('surge'); } }
      else if (k === 'Enter') sailOn();
      else if (k === 'b') goHome();
      else if ((k === '1' || k === '2') && W.state === 'choose' && W.alt && cardRisen()) sailOn(+k - 1); // (between waves with a second way on, once the card's risen, 1 and 2 take a way)
      else if (k === '1' || k === '2' || k === '3') pickShot(SHOT_ORDER[+k - 1]);
      else if (k === 'shot' || k === 'v') cycleShot();
      else if (k === 'x') patchUp();
    }
    // (a key that ended the voyage, B between waves: nothing more of it this step, or her flight would carry her ship
    // back out of the port's berth, where she now stands)
    if (mode !== 'voyage') return;
    player.update(dt, inp);
    player.ship.root.updateMatrixWorld(true);
    const gone = raiders.update(dt, player, camera);
    placeCamera(dt, inp);
    sound.listen(camera, player.pos); // (where the sounds of this step are heard from)
    const battery = batteryFor(cam.yaw);
    aimFor(battery);
    gunnery.update(dt, player.patch.t > 0 ? PATCH.rate : 1); // (the guns reload at half speed while the crew patch her)
    if (wasPatching && player.patch.t <= 0) { wasPatching = false; PATCHED.part = player.patch.part; PATCHED.stage = 'done'; emit('patch'); }
    // a broadside loaded again is told (a clack: sound.js)
    for (let i = 0; i < 2; i++) {
      const b = SIDES[i];
      if (loaded[b] > 0 && gunnery.ready[b] === 0 && gunnery.B[b][0]?.kind === 'broadside' && !player.down) { READY.battery = b; READY.firing = !!inp.fire; emit('guns:ready'); }
    }
    if (inp.fire && !player.down && gunnery.fire(battery, aimPoint, bolts, 'player', player.velocity) > 0) {
      sky.reveal(); // (her guns give her away)
      player.firedOnce = true; // (a brand-new Captain's first raider holds her fire till now: raiders.js)
      if (gunnery.shot === 'breaker') { if (!gunnery.breakers) pickShot('round', 'out'); else shotsShown(); } // (her last volley of breakers: round shot again)
    }
    loaded.port = gunnery.ready.port; loaded.starboard = gunnery.ready.starboard;
    bolts.update(dt, hitTest);
    // (her scars and every raider's, and their flames, as they stand after this step's hits; and their life: her lids
    // open for a fight, a Man-o'-war's columns marked while the guns are locked on her)
    looks.cleared = W.state === 'fight'; looks.marked = locked;
    looks.update(dt, time, raiders.list);
    wakes.update(dt, time, camera, player, raiders.list);
    smokeFrom(player, fx, dt);
    for (let i = 0; i < raiders.list.length; i++) smokeFrom(raiders.list[i].f, fx, dt);
    const got = pickups.update(dt, player.ship.body.localToWorld(hold.set(0, 0.5, 0)), player.ship.recipe.length * 0.6 + 8, camera);
    // gathering shards makes the counter pop (once in a while, as they stream in), and each shard is told of, with how
    // many have come in close together
    if (got && !player.down) {
      V.shards += got; if (time - lastPop > 0.25) { lastPop = time; POP_TIMING.duration = lessMotion.matches ? 1 : 500; H.score.animate(POP, POP_TIMING); }
      GATHER.at.copy(hold);
      for (let i = 0; i < pickups.taken; i++) { run = time - lastShard < 1.5 ? run + 1 : 1; lastShard = time; GATHER.value = pickups.worth[i]; GATHER.run = run; emit('shards:gather'); }
    }
    waves(dt, gone);
    wrecks.update(dt, camera); surge.update(dt); world.update(dt);
    fx.smoke.keepClear(locked && !locked.f.down ? locked.f.pos : null, locked ? locked.R.length : 0); // (her own gunsmoke keeps off her view of her target)
    fx.update(dt); // (after everything that makes sparks, smoke or glows this frame)
    // the view: wider on a phone held upright; a Surge widens it with a jolt (a spring), slow motion narrows it a
    // little, and each of your guns punches it wider for a moment
    viewFov += ((view.w < view.h ? 68 : 55) - viewFov) * (1 - Math.exp(-dt * 5));
    surgeView(dt);
    const fov = viewFov + surgeFov.x - 6 * fx.slowness + fx.cam.fov;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    world.time.value = time;
    world.puffs.follow(player.pos);
    sky.update(dt, { player, camera, raiders: raiders.list }); // (the region's air, the storm, the clouds round her)
    sun.target.position.copy(player.pos); sun.position.copy(player.pos).addScaledVector(SUN, SUN_OFF);
    WTIME.value = time; // (the sails' ripple, the pennants, the crystals' pulse, the embers and the flames)
    player.ship.glow.material.uniforms.uScale.value = camera.userData.pixelScale;
    inpNow = inp; hud(dt, battery);
  }
  // a frame, as the claim draws it (dt: real seconds since the last)
  function frame(dt) {
    renderer.toneMappingExposure = 1;
    if (mode === 'voyage') { if (!paused && !W.sunk) tick(dt * fx.timeScale(dt)); if (mode === 'voyage') renderer.render(scene, camera); }
    else { input.read(); port.update(dt); WTIME.value += dt; port.render(); }
    // while the game stands still (paused, or your ship gone down), a tag's "Broadside!" stops flashing
    const still = mode === 'voyage' && (paused || W.sunk);
    if (H.tags._held !== still) { H.tags._held = still; H.tags.classList.toggle('held', still); }
    sound.update(dt, mode === 'voyage' ? player : null); // (real time: the music, and the sky's sound)
  }


  // the raiders' tags: the raiders, and on a convoy the claim's barges too
  const tagged = () => (raiders.friends.length ? [...raiders.list, ...raiders.friends] : raiders.list);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------- raids (raids.js: Brightvein's nine places, on this engine) ----------
  const RAIDS_READY = false;
  function raidStart() { return {}; }
  function raidBanner() {}
  function raidResult() { return null; }
  function raidClear() {}
  function raidBounty() { return null; }
  function raidHit() { return false; }
  function raidStep() {}

  // ---------- the skies opened and closed (the claim's open and close, below) ----------
  // into the skies: the Shipyard ('port'), choosing the skies ('title'), a patrol ('voyage') or a raid ('raid', with
  // opts.site: an id from SITES, or 'bounty')
  function openTo(m, opts = {}) {
    resize(); applyPicture(); applyHands(); fx.shake = settings.data.shake;
    WTIME.value = time;
    if (m === 'voyage' || m === 'raid') {
      const site = m === 'raid' && RAIDS_READY ? opts.site : null;
      if (!sail(progress.data.flying, false, false, site)) port.setMode('port');
      else if (m === 'raid' && !RAIDS_READY) toast('The raids are being fitted to the new skies: a patrol for now');
    } else port.setMode(m === 'title' ? 'title' : 'port');
  }
  // out of the skies: everything a voyage leaves behind cleared away, the cards and the HUD put away, the sound told
  function shut() {
    if (player && player.ship.root.parent === scene) {
      raiders.clear(); bolts.clear(); pickups.clear(); gunnery?.cancel(); wrecks.clear(); world.clear(); surge.clear(); wakes.clear(); hideBounties(); raidClear();
      scene.remove(player.ship.root); looks.reset(player.ship); looks.clear();
    }
    trial = null; said.length = 0; W.next = null;
    for (const id of ['paused', 'title', 'port', 'howto', 'homecoming', 'log']) $(id).hidden = true;
    calmUp(false); bigMap(false); setPaused(false); record.hide(); coach.clear?.();
    port.leave(); port.mode = 'off';
    enter('off');
    input.active = false;
    document.body.classList.remove('sinking', 'between', 'roads', 'boss-up');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ---------- what the claim (and the tests) can see of it ----------
  return {
    openTo, shut, frame, resize, applyPicture,
    get player() { return player; }, get gunnery() { return gunnery; }, get paused() { return paused; }, get time() { return time; }, get trial() { return trial; },
    cam, input, raiders, bolts, pickups, scene, world, sun, waves: W, voyage: V, fx, wrecks, surge, looks, wakes, sky, sound, deeds, coach, record, port,
    get lastArc() { return lastArc; }, waveAt, treasureShip, giants, describe,
    tactics: { SHOTS, SHOT_ORDER, RAKE, PATCH, SMART, rakeMul, NERVE, CAPTAINS, PLATE, FORT, LINE, ROADS, ROAD }, pickShot, nextShot: () => nextShot(), patchUp,
    nextWave: (n) => nextWave(n), roadWave, bannerFor: (wave, arr) => waveBanner(wave, arr), BANNER_LINE, cardRisen, BOUNTY, CAPTAIN,
    sail, endVoyage, pause, sailOn, goHome, goHomeToClaim, tipsAgain, siteFor,
    get summary() { return summary; }, saying: said, layout, edge: EDGE,
    placeTags: () => tags(true, Infinity),
    quiet() { bannerAt.until = TOAST_AT.until = 0; for (const id of ['banner', 'toast']) $(id).getAnimations().forEach((a) => a.finish()); },
    get hits() { return V.hits; }, get downed() { return V.downed; }, get locked() { return locked; },
    get surgeView() { return surgeFov.x; },
    // run the game's clock without drawing, holding these controls (for tests on slow software rendering), in frames
    // of `frame` seconds. The sound only counts the news meanwhile
    step(seconds, controls = {}, frame = 1 / 60) {
      held = { turn: 0, climb: 0, sail: 0, fire: false, look: { x: 0, y: 0 }, zoom: 0, pressed: new Set(), lastLook: performance.now() / 1000, locked: false, ...controls };
      const quiet = audio.quiet; audio.quiet = !audio.loudSteps;
      try { for (let t = 0; t < seconds && mode === 'voyage'; t += frame) if (!paused && !W.sunk) tick(frame); } finally { audio.quiet = quiet; held = null; }
    },
  };
  }

  // ---------- the claim opens the skies, and they close ----------
  async function open(m = 'port', opts = {}) {
    root.hidden = false; document.body.classList.add('sky-on');
    const wait = $('sky-loading'); wait.hidden = !!G;
    if (mode === 'off') { mode = 'loading'; root.dataset.mode = 'loading'; document.body.dataset.sky = 'loading'; }
    audio.attach(); // (the skies' sound, in the claim's audio context)
    await prepare();
    wait.hidden = true;
    G.openTo(m, opts);
  }
  // back to the claim (result: what the voyages since the skies were opened did, or nothing)
  function close(result = {}) {
    G?.shut();
    mode = 'off'; root.dataset.mode = 'off';
    root.hidden = true; document.body.classList.remove('sky-on'); delete document.body.dataset.sky;
    onLeave?.(result);
  }
  // the claim calls this every frame while the skies are open; false while they're still being made
  function frame(dt) {
    dt = Math.min(0.05, dt);
    if (!G || mode === 'loading' || mode === 'off') return false;
    G.frame(dt);
    return true;
  }

  const api = {
    open, close, frame, prepare, shipFor, shipNow, dockShip, art, HOME, settings, audio, events,
    resize: () => G?.resize(), get shipArt() { return ART; },
    get on() { return mode !== 'off'; }, get mode() { return mode; }, get paused() { return !!G?.paused; },
    loadoutOf, crewOf, shipName,
    get siteFor() { return G?.siteFor ?? (() => null); },
    // for tests
    get G() { return G; }, get player() { return G?.player ?? null; }, get gunnery() { return G?.gunnery ?? null; }, get cam() { return G?.cam; }, get input() { return G?.input; },
    get waves() { return G?.waves ?? null; }, get voyage() { return G?.voyage ?? null; }, progress,
    get raiders() { return G?.raiders; }, get parts() { return G; }, get port() { return G?.port; }, get scene() { return G?.scene; }, camera,
    get sites() { return G?.sites ?? null; }, wind: WIND,
    sail: (...a) => G?.sail(...a), endVoyage: (...a) => G?.endVoyage(...a), pause: (on) => G?.pause(on), sailOn: (k) => G?.sailOn(k),
    raid: (site, id) => G?.sail(id ?? progress.data.flying, true, false, site),
    fly: (id) => G?.sail(id, true), // a voyage in any ship, owned or not
    get hits() { return G?.hits ?? 0; }, get downed() { return G?.downed ?? 0; }, get locked() { return G?.locked ?? null; },
    step: (seconds, controls, f) => G?.step(seconds, controls, f),
    // the claim's Settings panel: the skies' rows, and "Show again" for the tips (every tip given again, and the tips on)
    tipsAgain() { for (const id in progress.data.tips) progress.data.tips[id] = 0; progress.save(); if (settings.data.tips === false) settings.set('tips', true); },
  };
  return api;
}
