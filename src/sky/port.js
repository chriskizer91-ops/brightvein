// port.js: the Shipyard, and choosing the skies. From the airship game's stage 4 (its port: Chris, "a racing game's
// garage"), tied to the claim. Your ship turns slowly in a quiet void over a round stone berth with a brass rim, lit warm
// from the front and cool from behind. Drag to turn it.
//   The skies (mode 'title'): the three skies (difficulty) to choose from, with their stars and records, and Set sail.
//   The Shipyard (mode 'port'): the claim's six ships along the bottom (buy one with shards and the claim's materials,
//   once the yard can build her: the Keep's level and the chapter, refit.js; or make one the flagship that moors at the
//   Sky Dock and sails), and the one on show in a panel: how she sails (with her crew from the claim on her: their
//   stats lift her numbers), her condition and repairs at the dock, her crew, her crystal power, her upgrades (four,
//   three steps each), the kinds of shot (for every ship), and her colours (her sails' dye and her pennants'). Looking at
//   a ship the claim doesn't own, the big gold button buys her; under it "Try her out" takes her out for a sea trial (one
//   fight, for nothing: voyage.js). On a phone the panel has three tabs: the ship, her upgrades (a gold dot when there's
//   one to buy), her colours.
//   The quartermaster's advice: one gold line under the top bar saying what's worth doing next, and under it, dim,
//   today's harbour orders and the commendation she's nearest. The Log button opens the Captain's log (record.js).
// Prices are in shards and the claim's materials (claim.afford, claim.pay). mode is 'off' while the claim is showing.
import * as THREE from 'three';
import { SHIPS, STATS } from '../ships/index.js';
import { handling } from './flight.js';
import { KINDS, GUN_WEIGHT } from './guns.js';
import { SKIES, NEEDS, DYE_IDS, STAR_WAVES, STAR_PAY } from './progress.js';
import { MODS, STEPS, POWER, SHIPYARD, SHOT_PRICE, MATS, WHERE, modCost, dyePrice, costText, lockedWhy, loadout, crewEffects, repairCost, repairHours, repairLeft, startRepair, damageOf, GUNNERS } from './refit.js';
import { emit, payload } from './events.js';
import { SHOTS, SHOT_ICON, SHOT_LINES } from './tactics.js';
import { DYES, swatch, applyPaint, howGot } from './paint.js';
import { RANKS } from './deeds.js';

const $ = (id) => document.getElementById(id);
const CALM = { calm: true };
const fmt = (n) => Math.round(n).toLocaleString('en');

function makeVoid() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main() { vP = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vP;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vP); float h = d.y;
        vec3 c = mix(vec3(0.006, 0.004, 0.012), vec3(0.04, 0.018, 0.045), smoothstep(-0.5, 0.0, h));
        c = mix(c, vec3(0.01, 0.014, 0.034), smoothstep(0.0, 0.6, h));
        float st = step(0.997, hash(floor(d * 300.0))) * smoothstep(0.05, 0.5, h);
        c += vec3(0.8, 0.8, 1.0) * st * 0.5;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  m.scale.setScalar(4000); m.frustumCulled = false; m.renderOrder = -10;
  return m;
}
function makeBerth() {
  const g = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.04, 0.06, 96), new THREE.MeshStandardMaterial({ color: 0x241b2a, roughness: 0.7, metalness: 0.2 }));
  stone.receiveShadow = true; g.add(stone);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.012, 8, 128).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9a743, metalness: 0.9, roughness: 0.3 }));
  rim.position.y = 0.03; g.add(rim);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), r = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,160,70,0.55)'); r.addColorStop(0.6, 'rgba(255,120,50,0.12)'); r.addColorStop(1, 'rgba(255,120,50,0)');
  x.fillStyle = r; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.position.y = 0.035; g.add(glow);
  return g;
}

// claim: what the Shipyard needs from the claim (dock.js dockLink): at() ({ ch, keep }), mats(), afford(cost), pay(cost),
// now() (claim days, for repairs), crewNames(id), openSettings(). crewOf(id): the crew's effects on that ship
export function makePort({ renderer, env, progress, claim = {}, shipFor, crewOf, touch = false, onSail, onTrial, onMode, onHome, deeds, onLog }) {
  const scene = new THREE.Scene();
  scene.environment = env; scene.environmentIntensity = 0.75;
  scene.add(makeVoid());
  const berth = makeBerth(); scene.add(berth);
  scene.add(new THREE.HemisphereLight(0x8a90c8, 0x2a1820, 0.6));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.8); key.castShadow = true; key.shadow.mapSize.setScalar(touch ? 1024 : 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04;
  // the key light's shadow map, n pixels square (Settings: picture); drawn afresh at the new size
  const setShadow = (n) => { if (key.shadow.mapSize.x === n) return; key.shadow.mapSize.setScalar(n); key.shadow.map?.dispose(); key.shadow.map = null; };
  const rimLight = new THREE.DirectionalLight(0x8fc8ff, 1.6);
  scene.add(key, key.target, rimLight);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 9000);
  const crewFx = (id) => crewOf?.(id) ?? crewEffects(id);
  // the claim's purse and stores
  const mats = () => claim.mats?.() ?? {};
  const afford = (c) => !!c && (claim.afford ? claim.afford(c) : progress.data.shards >= (c.shards || 0));
  const pay = (c) => { if (!afford(c)) return false; if (claim.pay) return claim.pay(c); progress.data.shards -= c.shards || 0; return true; };
  // what's missing for a price, and where to find it: "Short of 2 Cut Glass. Cut Glass comes in the crates at …"
  const shortOf = (c, where = true) => {
    const m = mats(), miss = [], from = [];
    if ((c.shards || 0) > progress.data.shards) miss.push(`◆ ${fmt(c.shards - progress.data.shards)}`);
    for (const k of Object.keys(MATS)) { const n = (c[k] || 0) - (m[k] || 0); if (n > 0) { miss.push(`${n} ${MATS[k]}`); from.push(WHERE[k]); } }
    return miss.length ? `Short of ${miss.join(', ')}.${where && from.length ? ' ' + from.join('. ') + '.' : ''}` : '';
  };
  const now = () => claim.now?.() ?? 0;
  const at = () => claim.at?.();
  const shipName = (id) => progress.data.ships[id]?.name || SHIPS.find((s) => s.id === id).name;
  const ping = (k) => { try { claim.sound?.(k); } catch { /* quiet */ } };

  let mode = 'title', viewing = progress.data.flying, ship = null, spin = 0.7, spinV = 0, drag = null, frame = { radius: 10, cy: 0 };
  // a dye tried on her ship and not hers yet ({ kind, id }), shown on the berth until it's bought or she's left
  let preview = null;
  const dress = () => { if (!ship) return; const P = progress.data.ships[viewing].paint; applyPaint(ship, preview ? { ...P, [preview.kind]: preview.id } : P); };

  // ---------- the ship on show ----------
  function show(id) {
    if (ship && preview) { preview = null; dress(); } // (a colour tried on her and not bought: off again)
    viewing = id;
    const R = SHIPS.find((s) => s.id === id), next = shipFor(R);
    if (ship && ship !== next) scene.remove(ship.root);
    ship = next; preview = null; dress();
    ship.root.rotation.set(0, spin, 0); ship.root.position.set(0, 0, 0); ship.root.scale.setScalar(1);
    scene.add(ship.root);
    const b = ship.bounds, size = b.getSize(new THREE.Vector3()), L = R.length;
    berth.scale.set(L * 0.62, L * 0.62, L * 0.62); berth.position.y = b.min.y - L * 0.1;
    frame = { radius: size.length() / 2, cy: (b.min.y + b.max.y) / 2 - L * 0.04 };
    const r = L * 0.9;
    Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 6 }); key.shadow.camera.updateProjectionMatrix();
    key.position.set(L * 1.2, L * 1.6, L * 1.4); rimLight.position.set(-L * 1.5, L * 0.6, -L * 1.6);
    refresh();
  }
  // where the ship sits on screen: clear of the panels (the same three layouts as the page: a laptop, a phone upright,
  // a phone sideways or any short window). Measured after anything in the panel changes, or the window does
  let panelTop = null, rowTop = null, adviceBottom = null;
  const remeasure = () => { panelTop = null; rowTop = null; adviceBottom = null; };
  const topRoom = (least) => { adviceBottom ??= adviceEl.offsetHeight ? adviceEl.getBoundingClientRect().bottom : 0; return Math.max(least, adviceBottom + 6); };
  document.fonts?.addEventListener?.('loadingdone', remeasure);
  function place() {
    const w = innerWidth, h = innerHeight, narrow = w <= 700, short = h <= 500, fov = THREE.MathUtils.degToRad(camera.fov / 2);
    let cx = w / 2, cy = h / 2, vw = w, vh = h;
    if (mode === 'title') {
      if (narrow && !short) { vh = h * 0.36; cy = h * 0.2; } // (above the skies' card, clear of it)
      else if (short) { vw = w * 0.34; cx = w * 0.8; vh = h * 0.8; } // (right of the card)
      else { vw = w * 0.5; cx = w * 0.72; }
    } else if (narrow && !short) { panelTop ??= panel.getBoundingClientRect().top; const top = topRoom(58); vh = Math.max(40, panelTop - top - 6); cy = top + vh / 2; }
    else {
      const pw = short ? Math.min(372, w * 0.5) : 380, top = topRoom(54); vw = w - pw - 40; cx = vw / 2;
      rowTop ??= shipsEl.getBoundingClientRect().top || h;
      vh = Math.max(40, Math.min(h - (short ? 110 : 140) - (top - 54), rowTop - (short ? 4 : 8) - top)); cy = top + vh / 2;
    }
    const t = Math.tan(fov), fit = Math.min(t * (vh / h), t * camera.aspect * (vw / w));
    const dist = (frame.radius / fit) * 1.02, el = 0.2;
    camera.position.set(0, frame.cy + Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, frame.cy, 0);
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
  }

  // ---------- drag to turn the ship (the panels let presses through to it) ----------
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => { if (mode !== 'port' && mode !== 'title') return; drag = { x: e.clientX, id: e.pointerId }; spinV = 0; });
  addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x; drag.x = e.clientX; spin += dx * 0.008; spinV = dx * 0.008; });
  addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
  addEventListener('pointercancel', () => { drag = null; });

  // ---------- choosing the skies ----------
  const skiesEl = $('skies');
  for (const [id, S] of Object.entries(SKIES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.skies = id; b.setAttribute('role', 'radio');
    b.innerHTML = `<b>${S.name}</b><span>${S.line}</span><small><i class="stars" aria-hidden="true">${STAR_WAVES.map(() => '<i class="star"></i>').join('')}</i><em></em><em class="more"></em></small>${id === 'fair' ? '<i class="first" hidden>Best for your first voyage</i>' : ''}`;
    b.addEventListener('click', () => {
      if (progress.data.skies !== id) { payload('port:skies').skies = id; emit('port:skies'); }
      progress.data.skies = id; progress.save(); refresh();
    });
    skiesEl.append(b);
  }
  $('btn-title-sail').addEventListener('click', () => onSail(progress.data.flying));
  $('btn-to-port').addEventListener('click', () => setMode('port'));
  $('btn-skies').addEventListener('click', () => setMode('title'));
  $('btn-log').addEventListener('click', () => onLog?.());
  $('btn-home').addEventListener('click', () => onHome?.());
  $('btn-settings-port').addEventListener('click', () => claim.openSettings?.());

  // ---------- the Shipyard ----------
  const shipsEl = $('port-ships');
  for (const R of SHIPS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.ship = R.id;
    b.innerHTML = `<b>${R.name}</b><small>${R.cls}</small><em></em>`;
    b.addEventListener('click', () => show(R.id));
    shipsEl.append(b);
  }
  // a giant not yet owned: the line under her Buy button says what owning her brings (Chris: giant raiders only once
  // you own one); voyage.js says it again as she's bought
  const GIANT = { galleon: 'Once she\'s yours, the treasure ships you meet are Galleons.', manowar: 'Once she\'s yours, raiders sail Men-o\'-war too.' };
  // the ship to own before this one is sold (the Galleon, before the Man-o'-war: NEEDS), or null
  const needs = (id) => (NEEDS[id] && !progress.data.ships[NEEDS[id]].owned ? SHIPS.find((s) => s.id === NEEDS[id]) : null);
  $('btn-buy').addEventListener('click', () => {
    const d = progress.data, price = SHIPYARD[viewing].price;
    if (d.ships[viewing].owned || needs(viewing) || lockedWhy(viewing, at()) || !pay(price)) return;
    d.ships[viewing].owned = true; d.flying = viewing; progress.save(); refresh();
    payload('port:buy').ship = viewing; emit('port:buy');
    if (deeds?.inPort().length) refresh(); // (her fleet may have won a commendation: deeds.js)
  });
  // the flagship: the one that moors at the Sky Dock and sails
  $('btn-flag').addEventListener('click', () => {
    const d = progress.data; if (!d.ships[viewing].owned || d.flying === viewing) return;
    d.flying = viewing; progress.save(); ping('tap'); note(`The ${shipName(viewing)} is your flagship: she moors at the Sky Dock`); refresh();
  });
  // repairs at the dock, on the claim's time
  $('btn-repair').addEventListener('click', () => {
    const d = progress.data, cfg = d.ships[viewing];
    const r = startRepair(viewing, cfg, now(), crewFx(viewing).repair, pay);
    if (r) { progress.save(); ping('build'); note(`Repairs begun: ${r.hours} hour${r.hours === 1 ? '' : 's'} at the dock`); }
    refresh();
  });
  // the tabs (on a phone): the ship, her upgrades, or her colours
  const panel = $('port-panel'), portEl = $('port'), adviceEl = $('pp-next');
  const TABS = ['ship', 'upgrades', 'colours'];
  const tab = (t) => { panel.dataset.tab = t; portEl.dataset.tab = t; for (const k of TABS) $(`pp-tab-${k}`).setAttribute('aria-selected', String(t === k)); panel.scrollTop = 0; remeasure(); };
  for (const k of TABS) $(`pp-tab-${k}`).addEventListener('click', () => tab(k));
  $('pp-power').addEventListener('input', (e) => {
    const cfg = progress.data.ships[viewing], p = +e.target.value;
    if (cfg.power !== p) { const E = payload('port:power'); E.ship = viewing; E.power = p; emit('port:power'); }
    cfg.power = p; refresh();
  });
  $('pp-power').addEventListener('change', () => progress.save());
  const modsEl = $('pp-mods');
  for (const M of MODS) {
    const row = document.createElement('div');
    row.className = 'mod'; row.dataset.mod = M.id;
    row.innerHTML = `<b>${M.name}<span class="pips"></span></b><button class="buy" type="button"></button><p>${M.line}</p><small>${M.step}</small><p class="short-of" hidden></p>`;
    row.querySelector('button').addEventListener('click', () => {
      const d = progress.data, cfg = d.ships[viewing], step = cfg.mods[M.id], cost = modCost(viewing, step);
      if (!cfg.owned || step >= STEPS || !cost || !pay(cost)) return;
      cfg.mods[M.id] = step + 1; progress.save(); refresh();
      const E = payload('port:upgrade'); E.ship = viewing; E.mod = M.id; E.step = step + 1; emit('port:upgrade');
      if (deeds?.inPort().length) refresh();
    });
    modsEl.append(row);
  }
  // the kinds of shot to buy (round shot is always aboard): bought once, for every ship she sails
  const shotsEl = $('pp-shots');
  for (const id of ['chain', 'breaker']) {
    const S = SHOTS[id], row = document.createElement('div');
    row.className = 'buyshot'; row.dataset.shot = id; row.style.setProperty('--shot', `#${S.color.toString(16).padStart(6, '0')}`);
    row.innerHTML = `<b><span style="color: var(--shot)">${SHOT_ICON[id]}</span>${S.name}</b><button class="buy" type="button"></button><p>${SHOT_LINES[id]}</p><p class="short-of" hidden></p>`;
    row.querySelector('button').addEventListener('click', () => {
      const d = progress.data;
      if (d.shots[id] || !pay(SHOT_PRICE[id])) return;
      d.shots[id] = true; progress.save(); refresh();
      payload('port:shot').shot = id; emit('port:shot');
    });
    shotsEl.append(row);
  }
  // her colours: a swatch for each dye, sails and pennants. One she has goes on at once (kept for this ship); one she
  // hasn't is tried on her ship on the berth, and the button under them buys it (or says what wins it)
  const sailsEl = $('pp-sails'), pennantsEl = $('pp-pennants');
  for (const id of DYE_IDS) {
    const D = DYES[id], b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.dataset.dye = id; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', D.name); b.title = D.name;
    b.style.setProperty('--dye', swatch(id));
    b.addEventListener('click', () => pickDye(id));
    (D.kind === 'sails' ? sailsEl : pennantsEl).append(b);
  }
  const DYE = payload('port:dye');
  function painted(kind, id, bought) { DYE.ship = viewing; DYE.kind = kind; DYE.dye = id; DYE.bought = bought; emit('port:dye'); }
  function pickDye(id) {
    const d = progress.data, cfg = d.ships[viewing], D = DYES[id];
    if (!cfg.owned) return;
    if (d.dyes[id]) { preview = null; if (cfg.paint[D.kind] !== id) { cfg.paint[D.kind] = id; progress.save(); painted(D.kind, id, false); } }
    else preview = { kind: D.kind, id };
    dress(); refresh(); clearOfFoot();
  }
  // (a colour tried on: the panel's foot grows with its note and Buy button, so the panel is scrolled on by as much,
  // never leaving the swatches under it)
  function clearOfFoot() {
    const foot = panel.querySelector('.sail-out').getBoundingClientRect(), row = pennantsEl.getBoundingClientRect();
    if (row.height && row.bottom + 6 > foot.top) panel.scrollTop += row.bottom + 6 - foot.top;
  }
  $('btn-dye').addEventListener('click', () => {
    const d = progress.data, D = preview && DYES[preview.id], price = preview && dyePrice(preview.id);
    if (!D || !price || d.dyes[preview.id] || !d.ships[viewing].owned || !pay(price)) return;
    const { kind, id } = preview;
    d.dyes[id] = 1; d.ships[viewing].paint[kind] = id; preview = null; progress.save(); dress(); refresh();
    painted(kind, id, true);
  });
  $('btn-sail').addEventListener('click', () => onSail(progress.data.flying));
  // a sea trial (Chris: a garage's test drive): a ship not owned yet taken out for one fight, for nothing (voyage.js)
  $('btn-try').addEventListener('click', () => { if (!progress.data.ships[viewing].owned) onTrial?.(viewing); });
  // a word at the top of the screen (voyage.js has the one that waits its turn)
  function note(text) { const n = $('port-note'); n.textContent = text; n.classList.remove('on'); void n.offsetWidth; n.classList.add('on'); }

  // the stat bars: this ship as built (pale) and with her upgrades and crew (gold), against the best any ship can be
  const best = { speed: 0, turn: 0, climb: 0, hull: 0, firepower: 0 };
  const figures = (id, cfg, crew = crewFx(id)) => {
    const L = loadout(id, cfg, crew), H = handling(L.stats), st = STATS[id];
    const guns = st.bow * KINDS.chaser.damage / KINDS.chaser.reload + st.side * (st.side > 1 ? KINDS.broadside.damage / KINDS.broadside.reload : KINDS.chaser.damage / KINDS.chaser.reload);
    return {
      speed: H.vmax * L.tune.speed * 3.6, turn: (H.turn * L.tune.turn * 180) / Math.PI, climb: H.climb * L.tune.climb,
      hull: L.stats.hull, sails: L.stats.sails, crystals: L.stats.crystals, firepower: (guns * GUN_WEIGHT[id] * L.guns.damage) / L.guns.reload,
      reload: (st.side > 1 ? KINDS.broadside.reload : KINDS.chaser.reload) * L.guns.reload,
    };
  };
  const atBest = (p) => ({ power: p, mods: { armour: p > 0 ? 3 : 0, canvas: 3, drill: 3, crystals: 3 } });
  const TOP = (id) => crewEffects(id, { gunners: Array.from({ length: 6 }, () => ({ A: 10 })), pilot: { A: 10 }, bosun: { G: 10 } });
  for (const R of SHIPS) for (const p of [-2, 2]) {
    const f = figures(R.id, atBest(p), TOP(R.id));
    for (const k in best) best[k] = Math.max(best[k], f[k]);
  }
  // a bar's length for a figure: its share of the best any ship can be (the hull and firepower by the square root of
  // that share, as they run from a Skiff's to a Man-o'-war's)
  const ROOT = { hull: true, firepower: true };
  const share = (k, v) => (ROOT[k] ? Math.sqrt(v / best[k]) : v / best[k]);
  // firepower in words, read against a Frigate at her best
  const HEAVIEST = figures('frigate', atBest(2), crewEffects('frigate')).firepower;
  const weight = (v) => { const k = v / HEAVIEST; return k < 0.25 ? 'light' : k < 0.5 ? 'fair' : k < 0.75 ? 'heavy' : k <= 1.1 ? 'very heavy' : 'fearsome'; };
  const STAT_ROWS = [
    ['speed', 'Top speed', (v) => `${fmt(v)} km/h`], ['turn', 'Turning', (v) => `a full circle in ${Math.round(360 / v)} s`], ['climb', 'Climbing', (v) => `${v.toFixed(0)} m a second`],
    ['hull', 'Hull', fmt], ['firepower', 'Firepower', weight],
  ];
  const statsEl = $('pp-stats');
  statsEl.innerHTML = STAT_ROWS.map(([k, label]) => `<div class="stat" data-stat="${k}"><span>${label}</span><span class="bar"><i class="now"></i><i class="base"></i><i class="mine" hidden></i></span><b></b></div>`).join('');
  const clsLine = (R, st) => {
    const guns = [st.bow && `${st.bow} in the bow`, st.side && `${st.side} each side`, st.stern && `${st.stern} in the stern`].filter(Boolean);
    return `<span>${R.cls} · ${R.length} m</span> · ${guns.map((w, i) => `<span>${i ? '' : 'Guns: '}${w}</span>`).join(', ')}`;
  };

  // ---------- the quartermaster's advice ----------
  // what's worth doing next, first that fits: a new Captain's first voyage; a ship the yard can build and the claim can
  // pay for now; an upgrade for the flagship (the lowest step first; gun drill, then armour, canvas, crystals); a kind of
  // shot; or the nearest of those in shards still to find (and what her last voyages brought home). In words, `long`
  // and `short` (a phone's: one line), and what to mark with a gold dot (`ship`, `mod`, `shot`)
  const ROLE_WORDS = { cutter: 'quick, with three guns a side', brig: 'steady and well gunned, with broadsides', frigate: 'the hunter, ten guns a side', galleon: 'a giant with two decks of guns', manowar: 'the fortress of the skies' };
  const PLAIN = { drill: 'her guns reload faster', armour: 'a tougher hull, a little slower', canvas: 'stronger sails and more speed', crystals: 'stronger crystals, and she climbs faster' };
  const ADVISE = ['drill', 'armour', 'canvas', 'crystals'];
  function advice() {
    const d = progress.data, F = { name: shipName(d.flying) }, cfg = d.ships[d.flying];
    if (!d.voyages) return { long: `Your first ship, the ${F.name}, is ready. Set sail and bring down raiders: the shards they spill are the claim's.`, short: 'Set sail and bring down raiders for shards', target: null };
    const next = SHIPS.find((s) => !d.ships[s.id].owned && !needs(s.id) && !lockedWhy(s.id, at()));
    if (next && afford(SHIPYARD[next.id].price)) return { long: `You can buy the ${shipName(next.id)} now: ${ROLE_WORDS[next.id]}.`, short: `You can buy the ${shipName(next.id)} now`, target: { ship: next.id } };
    let up = null;
    for (const id of ADVISE) { const step = cfg.mods[id], cost = modCost(d.flying, step); if (cost && afford(cost) && (!up || step < up.step)) up = { M: MODS.find((m) => m.id === id), step, cost }; }
    if (up) return { long: `You can afford ${up.M.name} for the ${F.name} (${costText(up.cost)}): ${PLAIN[up.M.id]}.`, short: `You can afford ${up.M.name}`, target: { mod: up.M.id } };
    for (const id of ['chain', 'breaker']) if (!d.shots[id] && afford(SHOT_PRICE[id])) return { long: `You can buy ${SHOTS[id].name.toLowerCase()} (${costText(SHOT_PRICE[id])}): ${SHOT_LINES[id].split(':')[0].toLowerCase()}.`, short: `You can buy ${SHOTS[id].name.toLowerCase()}`, target: { shot: id } };
    const goals = [];
    if (next) goals.push({ c: SHIPYARD[next.id].price, what: `the ${shipName(next.id)}` });
    for (const id of ADVISE) { const cost = modCost(d.flying, cfg.mods[id]); if (cost) goals.push({ c: cost, what: MODS.find((m) => m.id === id).name.toLowerCase() }); }
    for (const id of ['chain', 'breaker']) if (!d.shots[id]) goals.push({ c: SHOT_PRICE[id], what: SHOTS[id].name.toLowerCase() });
    if (!goals.length) return { long: 'Every ship the yard can build, and every upgrade, is yours. Dye her sails, chase the stars on the Maelstrom, and see your log.', short: 'Everything is yours: chase the stars', target: null };
    const g = goals.reduce((a, b) => (b.c.shards < a.c.shards ? b : a)), more = shortOf(g.c, false).replace(/^Short of /, '').replace(/\.$/, '');
    const L = d.log.slice(-5), avg = L.length >= 2 ? Math.round(L.reduce((a, e) => a + e.s, 0) / L.length / 10) * 10 : 0;
    return { long: `${more || 'A little'} more for ${g.what}.${avg ? ` Your last voyages brought home about ◆ ${fmt(avg)} each.` : ''}`, short: `${more || 'A little'} more for ${g.what}`, target: null };
  }
  // and under it, dim, for a Captain who has been to sea: how today's harbour orders stand and the commendation she's
  // nearest, half way or more; each [long, short], the short for a phone
  function nearly() {
    const d = progress.data, out = [];
    if (!d.voyages || !deeds) return out;
    const O = deeds.today(), all = O.picks.filter((p) => p >= 0).length, n = O.done.filter((x, i) => x && O.picks[i] >= 0).length;
    if (all) out.push(n >= all ? ['Today\'s orders: all done', 'Orders: all done'] : [`Today's orders: ${n} of ${all} done`, `Orders: ${n} of ${all} done`]);
    const N = deeds.nearest();
    if (N) out.push([`Nearly there: ${N.M.name}, ${fmt(N.have)} of ${fmt(N.need)}`, `${N.M.name}: ${fmt(N.have)} of ${fmt(N.need)}`]);
    return out;
  }

  function refresh() {
    remeasure();
    const d = progress.data, cfg = d.ships[viewing], R = SHIPS.find((s) => s.id === viewing), st = STATS[viewing];
    const fresh = progress.newCaptain, F = { name: shipName(d.flying) }, A0 = at();
    // each skies: its three stars, its best wave, and (where there's room) its most shards and raiders in a voyage
    for (const b of skiesEl.children) {
      const k = b.dataset.skies, n = d.best[k], Rc = d.records[k], sr = d.stars[k], won = STAR_WAVES.filter((w) => sr[`w${w}`]).length;
      b.setAttribute('aria-checked', String(k === d.skies));
      const [bestEl, more] = b.querySelectorAll('small em'), small = b.querySelector('small');
      bestEl.textContent = n ? `Best: wave ${n}` : !fresh && k === 'mael' ? `◆ ${fmt(STAR_PAY.mael.reduce((a, x) => a + x, 0))} in stars to win` : '';
      more.textContent = n && (Rc.shards || Rc.downed) ? ` · ◆ ${fmt(Rc.shards)} · ${fmt(Rc.downed)} downed` : '';
      small.querySelectorAll('.star').forEach((e, i) => e.classList.toggle('on', !!sr[`w${STAR_WAVES[i]}`]));
      small.hidden = !n && !bestEl.textContent; small.querySelector('.stars').hidden = !n && !won;
      small.setAttribute('aria-label', `${won} of 3 stars${bestEl.textContent ? ` · ${bestEl.textContent}` : ''}`);
      const first = b.querySelector('.first'); if (first) first.hidden = !fresh;
    }
    const fl = d.ships[d.flying], under = fl.repair && repairLeft(fl, now())?.hours > 0;
    const tb = $('btn-title-sail'); tb.textContent = under ? `The ${F.name} is under repair` : fresh ? 'Set sail' : `Set sail in the ${F.name}`; tb.disabled = !!under;
    const rank = $('title-rank'), rankName = RANKS[d.rank] ?? RANKS[0];
    rank.hidden = fresh; rank.innerHTML = `<b>${rankName}</b> · ◆ ${fmt(d.shards)} in the claim's purse`;
    $('btn-log').querySelector('span').textContent = rankName; $('btn-log').setAttribute('aria-label', `Captain's log: ${rankName}`);
    const sk = $('btn-skies'); sk.innerHTML = `<span>Skies: </span>${SKIES[d.skies].name}`; sk.setAttribute('aria-label', `Skies: ${SKIES[d.skies].name}`);
    $('port-shards').textContent = `◆ ${fmt(d.shards)}`;
    const m = mats();
    $('port-mats').innerHTML = `<b>${m.brass | 0}</b> Brass · <b>${m.glass | 0}</b> Glass · <b>${m.heartstone | 0}</b> Heartstone`;
    $('port-mats').title = `${m.brass | 0} Brass Scrap, ${m.glass | 0} Cut Glass, ${m.heartstone | 0} Heartstone`;
    for (const b of shipsEl.children) {
      const id = b.dataset.ship, own = d.ships[id].owned, lock = !own && (lockedWhy(id, A0) || (needs(id) ? 'first' : null));
      b.setAttribute('aria-pressed', String(id === viewing)); b.classList.toggle('locked', !!lock); b.classList.toggle('flag', id === d.flying);
      b.querySelector('b').textContent = shipName(id);
      b.querySelector('em').textContent = id === d.flying ? 'Flagship' : own ? (d.ships[id].repair ? 'Repairing' : 'Yours') : lock ? 'Locked' : `◆ ${fmt(SHIPYARD[id].price.shards)}`;
    }
    $('pp-name').textContent = shipName(viewing); $('pp-cls').innerHTML = clsLine(R, st);
    $('pp-blurb').textContent = st.blurb;
    const owned = cfg.owned;
    $('pp-buy').hidden = owned; $('pp-own').hidden = !owned; $('pp-tabs').hidden = !owned; $('pp-claim').hidden = !owned;
    panel.classList.toggle('buying', !owned); portEl.classList.toggle('buying', !owned);
    if (!owned && panel.dataset.tab !== 'ship') tab('ship');
    // the quartermaster's line, and a gold dot on what it means
    const A = advice(), N = nearly();
    adviceEl.innerHTML = `<span class="long">${A.long}</span><span class="short">${fresh ? '' : `<span class="rank">${rankName} · </span>`}${A.short}</span>`
      + (N.length ? `<span class="more"><span class="long">${N.map((x) => x[0]).join(' · ')}</span><span class="short">${N.map((x) => `<i>${x[1]}</i>`).join(' · ')}</span></span>` : '');
    for (const b of shipsEl.children) b.classList.toggle('advised', A.target?.ship === b.dataset.ship);
    // a ship the claim doesn't own: the big button buys her (filling with gold as the shards come in), unless the yard
    // can't build her yet (the chapter, the Keep) or the Shipyard sells her only once another is owned
    const price = SHIPYARD[viewing].price, first = !owned && needs(viewing), lock = !owned && lockedWhy(viewing, A0), can = afford(price), b = $('btn-buy');
    if (!owned) {
      if (lock) b.firstElementChild.textContent = lock;
      else if (first) b.firstElementChild.textContent = `Buy the ${shipName(first.id)} first`;
      else b.firstElementChild.innerHTML = `Buy<span class="the"> the</span> ${shipName(viewing)} <span class="price">· ${costText(price)}</span>`;
      b.disabled = !can || !!first || !!lock;
      b.style.setProperty('--got', `${first || lock ? 0 : Math.round(Math.min(1, d.shards / Math.max(1, price.shards)) * 100)}%`);
    }
    $('pp-need').textContent = owned ? '' : [lock ? 'The yard can\'t build her yet.' : first ? `The Shipyard sells her once you own the ${shipName(first.id)}.` : !can ? shortOf(price) : '', GIANT[viewing] ?? ''].filter(Boolean).join(' ');
    const sail = $('btn-sail'), alt = !owned || !!preview;
    sail.classList.toggle('alt', alt); sail.innerHTML = under ? `The ${F.name} is under repair` : !alt ? `Set sail in the ${F.name}` : `or <span class="long">set </span>sail <span class="long">in </span>the ${F.name}`;
    sail.disabled = !!under;
    $('btn-try').hidden = owned || !!lock; // (a ship not owned, that the yard could build, can be tried out: a sea trial)
    const base = figures(viewing, { power: 0, mods: { armour: 0, canvas: 0, drill: 0, crystals: 0 } }, crewEffects(viewing)), nowF = figures(viewing, cfg);
    const mine = viewing !== d.flying ? figures(d.flying, d.ships[d.flying]) : null;
    for (const [k, , showV] of STAT_ROWS) {
      const row = statsEl.querySelector(`[data-stat="${k}"]`), a = share(k, base[k]), n = share(k, nowF[k]);
      const [nowBar, baseBar, mark] = row.querySelectorAll('i');
      baseBar.style.width = `${Math.min(a, n) * 100}%`; nowBar.style.width = `${Math.max(a, n) * 100}%`;
      nowBar.classList.toggle('less', n < a - 1e-6);
      mark.hidden = !mine; if (mine) mark.style.left = `calc(${Math.min(1, share(k, mine[k])) * 100}% - 1px)`;
      row.querySelector('b').textContent = showV(nowF[k]);
    }
    // a ship the claim owns: the flagship button, her condition and repairs, her crew
    if (owned) {
      $('pp-flag').hidden = d.flying === viewing; $('btn-flag').textContent = `Make the ${shipName(viewing)} the flagship`;
      const dmg = damageOf(cfg), left = repairLeft(cfg, now());
      $('pp-wear').innerHTML = ['hull', 'sails', 'crystals'].map((k) => `<div class="stat wear"><span>${k[0].toUpperCase() + k.slice(1)}</span><span class="bar"><i class="now${dmg[k] > 0.5 ? ' less' : ''}" style="width:${(1 - dmg[k]) * 100}%"></i></span><b>${Math.round((1 - dmg[k]) * 100)}%</b></div>`).join('');
      const cost = repairCost(viewing, cfg), hours = repairHours(viewing, cfg, crewFx(viewing).repair), rb = $('btn-repair');
      if (left) { rb.hidden = true; $('pp-repair-note').textContent = `Under repair at the dock: ${left.hours < 1 ? 'nearly done' : `about ${Math.ceil(left.hours)} hour${Math.ceil(left.hours) === 1 ? '' : 's'} to go`}. She can't sail till she's done.`; }
      else if (!hours) { rb.hidden = true; $('pp-repair-note').textContent = 'Sound from keel to masthead.'; }
      else { rb.hidden = false; rb.textContent = `Repair her: ◆ ${fmt(cost)} · ${hours} hour${hours === 1 ? '' : 's'}`; rb.disabled = !afford({ shards: cost }); $('pp-repair-note').textContent = 'Or sail as she is. The crew patch her a little between fights.'; }
      const C = crewFx(viewing), names = claim.crewNames?.(viewing) ?? [];
      $('pp-crew').textContent = `${names.length ? names.join(' · ') : 'Dock hands only'}. Gunners ${C.gunA.toFixed(1)} Agility (${GUNNERS[viewing]} seat${GUNNERS[viewing] > 1 ? 's' : ''}), pilot ${C.pilotA}, bosun ${C.bosunG} Grit.${C.gifts.length ? ' ' + C.gifts.join('. ') + '.' : ''} Pick them at the Sky Dock.`;
    }
    const p = $('pp-power'); p.value = String(cfg.power);
    const pct = (x) => `${Math.abs(Math.round(x * 100))}%`, n = Math.abs(cfg.power);
    $('pp-power-note').textContent = cfg.power === 0 ? 'Even: the crystals feed the sails and the guns alike.'
      : cfg.power > 0 ? `${POWER[cfg.power + 2]}: she reloads ${pct(0.08 * n)} quicker and hits ${pct(0.06 * n)} harder, but she's ${pct(0.06 * n)} slower.`
        : `${POWER[cfg.power + 2]}: she's ${pct(0.06 * n)} faster, but she reloads ${pct(0.08 * n)} slower and hits ${pct(0.06 * n)} lighter.`;
    let canBuy = false;
    for (const row of modsEl.children) {
      const M = MODS.find((x) => x.id === row.dataset.mod), step = cfg.mods[M.id], bt = row.querySelector('button'), so = row.querySelector('.short-of');
      row.classList.toggle('advised', viewing === d.flying && A.target?.mod === M.id);
      row.querySelector('.pips').textContent = '●'.repeat(step) + '○'.repeat(STEPS - step);
      so.hidden = true;
      if (step >= STEPS) { bt.textContent = 'Done'; bt.disabled = true; }
      else { const cost = modCost(viewing, step), ok = afford(cost); bt.textContent = costText(cost); bt.disabled = !ok; canBuy ||= owned && ok; if (!ok && owned) { so.hidden = false; so.textContent = shortOf(cost, false); } }
    }
    for (const row of shotsEl.children) {
      const id = row.dataset.shot, bt = row.querySelector('button'), have = !!d.shots?.[id], so = row.querySelector('.short-of'), ok = afford(SHOT_PRICE[id]);
      row.classList.toggle('advised', A.target?.shot === id);
      bt.textContent = have ? 'Aboard' : costText(SHOT_PRICE[id]); bt.disabled = have || !ok;
      so.hidden = have || ok; if (!so.hidden) so.textContent = shortOf(SHOT_PRICE[id], false);
      canBuy ||= owned && !bt.disabled;
    }
    $('pp-tab-upgrades').querySelector('.dot').hidden = !canBuy;
    // her colours: the swatches (ticked: hers, or the one tried on her; a lock on those she hasn't), what's tried on her
    // and what it costs or what wins it, and the button that buys it
    const shown = (kind) => (preview?.kind === kind ? preview.id : cfg.paint[kind]);
    for (const el of [sailsEl, pennantsEl]) for (const sw of el.children) {
      const id = sw.dataset.dye, D = DYES[id];
      sw.setAttribute('aria-checked', String(shown(D.kind) === id)); sw.classList.toggle('locked', !d.dyes[id]);
    }
    const P = preview && DYES[preview.id], dp = preview && dyePrice(preview.id), dyeBtn = $('btn-dye');
    $('pp-dye-note').textContent = P ? `${P.name} ${P.kind === 'sails' ? 'sails' : 'pennants'}: ${dp ? `${afford(dp) ? 'once bought, for every ship' : `you have ◆ ${fmt(d.shards)}`}` : howGot(preview.id, RANKS)}` : '';
    $('pp-dye-buy').hidden = !P;
    if (P) { dyeBtn.innerHTML = dp ? `Buy ${P.name} <span class="price">· ◆ ${fmt(dp.shards)}</span>` : P.rank ? `Win it at ${RANKS[P.rank]}` : `Win it on the ${SKIES[P.star[0]].name}`; dyeBtn.disabled = !dp || !afford(dp); }
    panel.querySelector('.sail-out').classList.toggle('dyeing', !!P);
  }

  // the skies or the Shipyard (her ship on the berth). The screen is entered first (voyage.js), so a commendation her
  // fleet wins as she comes in is told there (deeds.inPort)
  function setMode(m) {
    if (m !== 'port' && preview) { preview = null; dress(); }
    mode = m;
    $('title').hidden = m !== 'title'; $('port').hidden = m !== 'port';
    if (m === 'title' || m === 'port') onMode?.(m);
    if (m === 'port') { deeds?.inPort(); show(viewing); } else if (m === 'title') { deeds?.today(); show(progress.data.flying); }
  }
  // setting sail (voyage.js): a colour tried on and not bought comes off her first, so she never sails in one that isn't hers
  function leave() { if (preview) { preview = null; dress(); } mode = 'voyage'; }
  progress.onLoad(() => { viewing = progress.data.flying; if (mode === 'port' || mode === 'title') show(viewing); });

  function update(dt) {
    if (!ship) return;
    if (!drag) { spin += dt * 0.18 + spinV; spinV *= Math.exp(-dt * 3); }
    ship.root.rotation.set(0, spin, 0);
    ship.root.position.y = Math.sin(performance.now() / 1300) * ship.recipe.length * 0.012;
    ship.update(dt, CALM);
    ship.glow.material.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
  function render() { place(); renderer.render(scene, camera); camera.clearViewOffset(); }
  // (for the checks: the ship's box on the screen as she's drawn, in the page's pixels)
  function shipBox() {
    place(); ship.root.updateMatrixWorld(true); camera.updateMatrixWorld();
    const b = ship.bounds, v = new THREE.Vector3(), box = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(ship.root.matrixWorld).project(camera);
      const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
      box.l = Math.min(box.l, x); box.r = Math.max(box.r, x); box.t = Math.min(box.t, y); box.b = Math.max(box.b, y);
    }
    camera.clearViewOffset();
    return box;
  }
  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); remeasure(); }
  return { scene, camera, show, setMode, leave, update, render, resize, refresh, note, setShadow, tab, shipBox, advice, pickDye, figures,
    get preview() { return preview; }, get viewing() { return viewing; }, get mode() { return mode; }, set mode(m) { mode = m; }, get spin() { return spin; } };
}
