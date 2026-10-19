// port.js: choosing the skies and the Shipyard. Both show a ship turning slowly in a quiet void over a round stone
// berth with a brass rim, lit warm from the front and cool from behind. Drag to turn it.
//   Title: the three skies (difficulty) to choose from.
//   Shipyard: the claim's six ships along the bottom (buy one, or make one the flagship that moors at the Dock and
//   sails), and the one on show in a panel with three tabs: Ship (how she sails, her condition and repairs, her crew,
//   her crystal power), Refit (hull, sails, guns and crystals, three levels each, shown on the model as you buy them)
//   and Looks (hull paint, sail colour, a figurehead: try them on, then keep them).
// Prices are in shards and the claim's materials (claim.afford, claim.pay); the bigger ships open with the Keep's level
// and the chapter (refit.lockedWhy). mode is 'off' while the claim is showing.
import * as THREE from 'three';
import { SHIPS, FLEET, STATS } from '../ships/index.js';
import { handling } from './flight.js';
import { KINDS, GUN_WEIGHT } from './guns.js';
import { SKIES, IDS } from './progress.js';
import { PARTS, MAX, POWER, SHIPYARD, PAINTS, SAILS, FIGURES, refitCost, lookCost, lockedWhy, loadout, recipeFor, crewEffects, repairCost, repairHours, repairLeft, startRepair, damageOf, GUNNERS } from './refit.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en');
const MATS = { brass: 'Brass', glass: 'Glass', heartstone: 'Heartstone' };
// a cost in words: ◆ 120 · 2 Brass · 1 Glass
export const costText = (c) => [c.shards ? `◆ ${fmt(c.shards)}` : '', ...Object.keys(MATS).filter((k) => c[k]).map((k) => `${c[k]} ${MATS[k]}`)].filter(Boolean).join(' · ') || 'Free';
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

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

// the figures the stat bars show: top speed, turning, climbing, hull, sails, crystals, firepower (bow and one side,
// a second), the Surge and the time to reload a broadside
export function shipFigures(id, cfg, crew) {
  const L = loadout(id, cfg, crew), H = handling(L.stats), R = recipeFor(FLEET.find((s) => s.id === id), cfg);
  const side = (R.ports ? R.ports.z.length * [].concat(R.ports.y).length : 0), swiv = (R.swivels ?? []).length / 2, bow = R.bowGuns.length, stern = (R.sternGuns ?? []).length;
  const ch = KINDS.chaser.damage / KINDS.chaser.reload, bs = KINDS.broadside.damage / KINDS.broadside.reload, mixed = side > 0;
  const dps = (bow * ch + side * bs + swiv * (mixed ? KINDS.chaser.damage / KINDS.broadside.reload : ch)) * GUN_WEIGHT[id] * L.guns.damage / L.guns.reload;
  return {
    speed: H.vmax * L.tune.speed * 3.6, turn: (H.turn * L.tune.turn * 180) / Math.PI, climb: H.climb * L.tune.climb,
    hull: L.stats.hull, sails: L.stats.sails, crystals: L.stats.crystals, firepower: dps, surge: L.tune.surge.boost * L.tune.surge.time,
    reload: (side ? KINDS.broadside.reload : KINDS.chaser.reload) * L.guns.reload, guns: { bow, side: side + swiv, stern },
  };
}

export function makePort({ renderer, env, progress, claim = {}, shipFor, crewOf, onSail, onMode, onHome }) {
  const scene = new THREE.Scene();
  scene.environment = env; scene.environmentIntensity = 0.75;
  scene.add(makeVoid());
  const berth = makeBerth(); scene.add(berth);
  scene.add(new THREE.HemisphereLight(0x8a90c8, 0x2a1820, 0.6));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04;
  const rimLight = new THREE.DirectionalLight(0x8fc8ff, 1.6);
  scene.add(key, key.target, rimLight);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 9000);
  const crewFx = (id) => crewOf?.(id) ?? crewEffects(id);
  const afford = (c) => (claim.afford ? claim.afford(c) : progress.data.shards >= (c.shards || 0));
  const pay = (c) => { if (!afford(c)) return false; if (claim.pay) return claim.pay(c); progress.data.shards -= c.shards || 0; return true; };
  const now = () => claim.now?.() ?? 0;

  let mode = 'title', viewing = progress.data.flying, ship = null, spin = 0.7, spinV = 0, drag = null, frame = { radius: 10, cy: 0 }, tab = 'ship';
  let tryOn = null;   // paint being tried on in the Looks tab: { hull, sails, figure }
  const shipName = (id) => progress.data.ships[id]?.name || FLEET.find((s) => s.id === id).name;

  // ---------- the ship on show ----------
  function show(id, keepSpin = true) {
    if (id !== viewing) tryOn = null;
    viewing = id;
    const R = FLEET.find((s) => s.id === id), next = shipFor(R, tryOn);
    if (ship && ship !== next) scene.remove(ship.root);
    ship = next;
    if (!keepSpin) spin = 0.7;
    ship.root.rotation.set(0, spin, 0); ship.root.position.set(0, 0, 0);
    scene.add(ship.root);
    const b = new THREE.Box3().setFromObject(ship.body), size = b.getSize(new THREE.Vector3()), L = R.length;
    berth.scale.set(L * 0.62, L * 0.62, L * 0.62); berth.position.y = b.min.y - L * 0.1;
    frame = { radius: size.length() / 2, cy: (b.min.y + b.max.y) / 2 - L * 0.04 };
    const r = L * 0.9;
    Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 6 }); key.shadow.camera.updateProjectionMatrix();
    key.position.set(L * 1.2, L * 1.6, L * 1.4); rimLight.position.set(-L * 1.5, L * 0.6, -L * 1.6);
    refresh();
  }
  // where the ship sits on screen: clear of the panels
  function place() {
    const w = innerWidth, h = innerHeight, narrow = w < 700, fov = THREE.MathUtils.degToRad(camera.fov / 2);
    let cx = w / 2, cy = h / 2, vw = w, vh = h;
    if (mode === 'title') { if (narrow) { vh = h * 0.42; cy = h * 0.24; } else { vw = w * 0.5; cx = w * 0.72; } }
    else if (narrow) { vh = h * 0.4 - 60; cy = 60 + vh / 2; } else { vw = w - 440; cx = vw / 2; vh = h - 150; cy = 54 + vh / 2; }
    const t = Math.tan(fov), fit = Math.min(t * (vh / h), t * camera.aspect * (vw / w));
    const dist = (frame.radius / fit) * 1.02, el = 0.2;
    camera.position.set(0, frame.cy + Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, frame.cy, 0);
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
  }

  // ---------- drag to turn the ship ----------
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => { if (mode !== 'port' && mode !== 'title') return; drag = { x: e.clientX, id: e.pointerId }; spinV = 0; });
  addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x; drag.x = e.clientX; spin += dx * 0.008; spinV = dx * 0.008; });
  addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
  addEventListener('pointercancel', () => { drag = null; });

  // ---------- the title screen ----------
  const skiesEl = $('skies');
  for (const [id, S] of Object.entries(SKIES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.skies = id; b.setAttribute('role', 'radio');
    b.innerHTML = `<b>${S.name}</b><span>${S.line}</span><small></small>`;
    b.addEventListener('click', () => { progress.data.skies = id; progress.save(); refresh(); });
    skiesEl.append(b);
  }
  $('btn-to-port').addEventListener('click', () => setMode('port'));
  $('btn-skies').addEventListener('click', () => setMode('title'));
  $('btn-home').addEventListener('click', () => onHome?.());

  // a word at the top of the screen
  function note(text) { const n = $('port-note'); n.textContent = text; n.classList.remove('on'); void n.offsetWidth; n.classList.add('on'); }
  const ping = (k) => { try { claim.sound?.(k); } catch (e) { /* quiet */ } };

  // ---------- the six ships along the bottom ----------
  const shipsEl = $('port-ships');
  for (const R of FLEET) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.ship = R.id;
    b.innerHTML = `<b>${R.name}</b><small>${R.cls}</small><em></em>`;
    b.addEventListener('click', () => show(R.id, false));
    shipsEl.append(b);
  }
  $('btn-buy').addEventListener('click', () => {
    const d = progress.data, price = SHIPYARD[viewing].price;
    if (d.ships[viewing].owned || lockedWhy(viewing, claim.at?.()) || !pay(price)) return;
    d.ships[viewing].owned = true; d.flying = viewing; progress.save(); ping('upgraded');
    note(`The ${shipName(viewing)} is yours, and your flagship`); refresh();
  });
  $('btn-flag').addEventListener('click', () => {
    const d = progress.data; if (!d.ships[viewing].owned) return;
    d.flying = viewing; progress.save(); ping('tap'); note(`The ${shipName(viewing)} is your flagship: she moors at the Sky Dock`); refresh();
  });
  $('btn-repair').addEventListener('click', () => {
    const d = progress.data, cfg = d.ships[viewing];
    const r = startRepair(viewing, cfg, now(), crewFx(viewing).repair, pay);
    if (r) { progress.save(); ping('build'); note(`Repairs begun: ${r.hours} hour${r.hours === 1 ? '' : 's'} at the dock`); }
    refresh();
  });
  $('pp-power').addEventListener('input', (e) => { progress.data.ships[viewing].power = +e.target.value; refresh(); });
  $('pp-power').addEventListener('change', () => progress.save());
  // the tabs
  for (const b of document.querySelectorAll('#port .pp-tabs button')) b.addEventListener('click', () => { tab = b.dataset.tab; if (tab !== 'looks' && tryOn) { tryOn = null; show(viewing); } refresh(); });
  // refits: one row a part
  const refitEl = $('pp-refit-list');
  for (const k of Object.keys(PARTS)) {
    const P = PARTS[k], row = document.createElement('div');
    row.className = 'mod'; row.dataset.part = k;
    row.innerHTML = `<b><span class="pn">${P.name}</span> <span class="pips"></span> <span class="lv"></span></b><button class="buy" type="button"></button><p class="next"></p><p class="what">${P.what}. ${P.each}.</p>`;
    row.querySelector('button').addEventListener('click', () => {
      const d = progress.data, cfg = d.ships[viewing], lv = cfg.refit[k], cost = refitCost(viewing, lv);
      if (!cfg.owned || !cost || !pay(cost)) return;
      cfg.refit[k] = lv + 1; progress.save(); ping('upgraded');
      note(`${P.name}: ${P.levels[lv + 1]}${P.look[lv + 1] ? ` (${P.look[lv + 1].toLowerCase()})` : ''}`);
      show(viewing);
    });
    refitEl.append(row);
  }
  // looks: swatches for the hull and the sails, and the figureheads
  function swatches(el, list, kind) {
    for (const [id, P] of Object.entries(list)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch'; b.dataset.id = id; b.title = P.name;
      if (P.c != null) b.style.setProperty('--c', hex(P.c)); else b.classList.add('fig');
      b.innerHTML = P.c != null ? `<i></i><span>${P.name}</span>` : `<span>${P.name}</span>`;
      b.addEventListener('click', () => { tryOn = { ...(tryOn ?? {}), [kind]: id }; show(viewing); });
      el.append(b);
    }
  }
  swatches($('pp-paint'), PAINTS, 'hull'); swatches($('pp-sailc'), SAILS, 'sails'); swatches($('pp-fig'), FIGURES, 'figure');
  $('btn-looks').addEventListener('click', () => {
    const d = progress.data, cfg = d.ships[viewing]; if (!tryOn || !cfg.owned) return;
    const cost = looksCost(); if (!pay(cost)) return;
    cfg.paint = { ...cfg.paint, ...tryOn }; tryOn = null; progress.save(); ping('built'); note(`The ${shipName(viewing)} is freshly painted`); show(viewing);
  });
  $('btn-looks-undo').addEventListener('click', () => { tryOn = null; show(viewing); });
  function looksCost() {
    const cfg = progress.data.ships[viewing], c = { shards: 0, brass: 0 };
    for (const k of ['hull', 'sails', 'figure']) if (tryOn?.[k] && tryOn[k] !== cfg.paint[k]) { const x = lookCost(viewing, k === 'figure' ? 'figure' : 'paint'); c.shards += x.shards; c.brass += x.brass || 0; }
    return c;
  }
  $('btn-sail').addEventListener('click', () => onSail(progress.data.flying));

  // the stat bars: this ship as built (pale) and with her refits and crew (gold), against the best any ship can be
  const best = { speed: 0, turn: 0, climb: 0, hull: 0, sails: 0, crystals: 0, firepower: 0, surge: 0 };
  const top = { gunners: Array.from({ length: 6 }, () => ({ A: 10 })), pilot: { A: 10 }, bosun: { G: 10 } };
  for (const id of IDS) for (const p of [-2, 2]) {
    const f = shipFigures(id, { power: p, refit: { hull: p > 0 ? 3 : 0, sails: 3, guns: 3, crystals: 3 } }, crewEffects(id, top));
    for (const k in best) best[k] = Math.max(best[k], f[k]);
  }
  const STAT_ROWS = [
    ['speed', 'Top speed', (v) => `${fmt(v)} km/h`], ['turn', 'Turning', (v) => `${v.toFixed(0)}°/s`], ['climb', 'Climbing', (v) => `${v.toFixed(0)} m/s`],
    ['hull', 'Hull', fmt], ['sails', 'Sails', fmt], ['crystals', 'Crystals', fmt], ['firepower', 'Firepower', (v) => `${fmt(v)}/s`], ['surge', 'Surge', (v) => `${v.toFixed(1)}`],
  ];
  const statsEl = $('pp-stats');
  statsEl.innerHTML = STAT_ROWS.map(([k, label]) => `<div class="stat" data-stat="${k}"><span>${label}</span><span class="bar"><i class="now"></i><i class="base"></i></span><b></b></div>`).join('');

  function refresh() {
    const d = progress.data, cfg = d.ships[viewing], R = FLEET.find((s) => s.id === viewing), st = STATS[viewing], at = claim.at?.();
    for (const b of skiesEl.children) {
      b.setAttribute('aria-checked', String(b.dataset.skies === d.skies));
      const n = d.best[b.dataset.skies];
      b.querySelector('small').textContent = n ? `Best: wave ${n}` : '';
    }
    $('btn-skies').textContent = innerWidth < 500 ? SKIES[d.skies].name : `Skies: ${SKIES[d.skies].name}`;
    $('port-shards').textContent = `◆ ${fmt(d.shards)}`;
    const m = claim.mats?.();
    $('port-mats').hidden = !m; if (m) $('port-mats').textContent = `${m.brass | 0} Brass · ${m.glass | 0} Glass · ${m.heartstone | 0} Heartstone`;
    for (const b of shipsEl.children) {
      const id = b.dataset.ship, own = d.ships[id].owned, lock = !own && lockedWhy(id, at);
      b.setAttribute('aria-pressed', String(id === viewing)); b.classList.toggle('locked', !!lock); b.classList.toggle('flag', id === d.flying);
      b.querySelector('b').textContent = shipName(id);
      b.querySelector('em').textContent = id === d.flying ? 'Flagship' : own ? (d.ships[id].repair ? 'Repairing' : 'Yours') : lock ? 'Locked' : `◆ ${fmt(SHIPYARD[id].price.shards)}`;
    }
    $('pp-name').textContent = shipName(viewing);
    const F = shipFigures(viewing, cfg, crewFx(viewing)), base = shipFigures(viewing, { power: 0, refit: { hull: 0, sails: 0, guns: 0, crystals: 0 } }, crewEffects(viewing));
    $('pp-cls').textContent = `${R.cls} · ${R.length} m · ${F.guns.bow} bow, ${F.guns.side} a side, ${F.guns.stern} stern · crew of ${st.crew}`;
    $('pp-blurb').textContent = st.blurb;
    for (const b of document.querySelectorAll('#port .pp-tabs button')) b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
    for (const t of ['ship', 'refit', 'looks']) $(`pp-${t}`).hidden = t !== tab;
    const owned = cfg.owned;
    // buying her, or making her the flagship
    $('pp-buy').hidden = owned; $('pp-own').hidden = !owned; $('pp-flag').hidden = !owned || d.flying === viewing;
    if (!owned) {
      const price = SHIPYARD[viewing].price, lock = lockedWhy(viewing, at), b = $('btn-buy');
      b.textContent = lock ? lock : `Buy the ${shipName(viewing)}: ${costText(price)}`; b.disabled = !!lock || !afford(price);
      $('pp-need').textContent = lock ? 'The yard can’t build her yet.' : afford(price) ? '' : 'Not enough in the stores yet. The yards charge shards, raids bring home materials.';
    }
    $('btn-flag').textContent = `Make the ${shipName(viewing)} the flagship`;
    for (const [k, , show] of STAT_ROWS) {
      const row = statsEl.querySelector(`[data-stat="${k}"]`), a = base[k] / best[k], n = F[k] / best[k];
      // pale: what's kept either way; past it, gold for what the refits and crew add, red for what they cost
      const [nowBar, baseBar] = row.querySelectorAll('i');
      baseBar.style.width = `${Math.min(a, n) * 100}%`; nowBar.style.width = `${Math.max(a, n) * 100}%`;
      nowBar.classList.toggle('less', n < a - 1e-6);
      row.querySelector('b').textContent = show(F[k]);
    }
    // condition and repairs
    if (owned) {
      const dmg = damageOf(cfg), left = repairLeft(cfg, now());
      $('pp-wear').innerHTML = ['hull', 'sails', 'crystals'].map((k) => `<div class="stat wear"><span>${k[0].toUpperCase() + k.slice(1)}</span><span class="bar"><i class="now${dmg[k] > 0.5 ? ' less' : ''}" style="width:${(1 - dmg[k]) * 100}%"></i></span><b>${Math.round((1 - dmg[k]) * 100)}%</b></div>`).join('');
      const cost = repairCost(viewing, cfg), hours = repairHours(viewing, cfg, crewFx(viewing).repair), rb = $('btn-repair');
      if (left) { rb.hidden = true; $('pp-repair-note').textContent = `Under repair at the dock: ${left.hours < 1 ? 'nearly done' : `about ${Math.ceil(left.hours)} hour${Math.ceil(left.hours) === 1 ? '' : 's'} to go`}. She can’t sail till she’s done.`; }
      else if (!hours) { rb.hidden = true; $('pp-repair-note').textContent = 'Sound from keel to masthead.'; }
      else { rb.hidden = false; rb.textContent = `Repair her: ◆ ${fmt(cost)} · ${hours} hour${hours === 1 ? '' : 's'}`; rb.disabled = !afford({ shards: cost }); $('pp-repair-note').textContent = 'Or sail as she is. The crew patch her a little between fights.'; }
      // the crew
      const C = crewFx(viewing), names = claim.crewNames?.(viewing) ?? [];
      $('pp-crew').textContent = `${names.length ? names.join(' · ') : 'Dock hands only'}. Gunners ${C.gunA.toFixed(1)} Agility (${GUNNERS[viewing]} seat${GUNNERS[viewing] > 1 ? 's' : ''}), pilot ${C.pilotA}, bosun ${C.bosunG} Grit.${C.gifts.length ? ' ' + C.gifts.join('. ') + '.' : ''} Pick them at the Sky Dock.`;
      const p = $('pp-power'); p.value = String(cfg.power);
      const pct = (x) => `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;
      $('pp-power-note').textContent = cfg.power === 0 ? 'Even: the crystals feed the sails and the guns alike.'
        : `${POWER[cfg.power + 2]}: top speed ${pct(-0.06 * cfg.power)}, time to reload ${pct(-0.08 * cfg.power)}, shot weight ${pct(0.06 * cfg.power)}.`;
    }
    // refits
    for (const row of refitEl.children) {
      const k = row.dataset.part, P = PARTS[k], lv = cfg.refit[k], b = row.querySelector('button'), cost = refitCost(viewing, lv);
      row.querySelector('.pips').textContent = '●'.repeat(lv) + '○'.repeat(MAX - lv);
      row.querySelector('.lv').textContent = P.levels[lv];
      row.querySelector('.next').textContent = lv >= MAX ? 'Fully refitted.' : `Next: ${P.levels[lv + 1]}. ${P.look[lv + 1]}.`;
      if (!owned) { b.textContent = 'Buy her first'; b.disabled = true; }
      else if (!cost) { b.textContent = 'Done'; b.disabled = true; }
      else { b.textContent = costText(cost); b.disabled = !afford(cost); }
    }
    // looks
    const shown = { ...cfg.paint, ...(tryOn ?? {}) };
    for (const [el, kind] of [[$('pp-paint'), 'hull'], [$('pp-sailc'), 'sails'], [$('pp-fig'), 'figure']]) for (const b of el.children) { b.setAttribute('aria-pressed', String(b.dataset.id === shown[kind])); b.classList.toggle('kept', b.dataset.id === cfg.paint[kind]); }
    const lc = tryOn ? looksCost() : null, changed = lc && (lc.shards || lc.brass);
    $('pp-looks-buy').hidden = !changed;
    if (changed) { const b = $('btn-looks'); b.textContent = owned ? `Keep these looks: ${costText(lc)}` : 'Buy her first'; b.disabled = !owned || !afford(lc); }
    $('pp-looks-note').textContent = changed ? 'Trying them on. The yard paints her when you keep them.' : 'Tap a colour or a figurehead to try it on.';
    const F2 = d.flying, rf = d.ships[F2];
    const sb = $('btn-sail'); sb.textContent = rf.repair && repairLeft(rf, now())?.hours > 0 ? `The ${shipName(F2)} is under repair` : `Set sail in the ${shipName(F2)}`; sb.disabled = !!(rf.repair && repairLeft(rf, now())?.hours > 0);
  }

  function setMode(m) {
    mode = m;
    $('title').hidden = m !== 'title'; $('port').hidden = m !== 'port';
    if (m === 'title' || m === 'port') { tryOn = null; show(m === 'title' ? progress.data.flying : viewing); onMode?.(m); }
  }
  progress.onLoad(() => { viewing = progress.data.flying; if (mode === 'port' || mode === 'title') show(viewing); });

  function update(dt) {
    if (!ship) return;
    if (!drag) { spin += dt * 0.18 + spinV; spinV *= Math.exp(-dt * 3); }
    ship.root.rotation.set(0, spin, 0);
    ship.root.position.y = Math.sin(performance.now() / 1300) * ship.recipe.length * 0.012;
    ship.update(dt, { calm: true });
    ship.glow.material.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
  function render() { place(); renderer.render(scene, camera); camera.clearViewOffset(); }
  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  // two ships side by side on the berth, for comparing (and for the review pictures)
  function pair(a, b) {
    const A = shipFor(FLEET.find((s) => s.id === a)), B = shipFor(FLEET.find((s) => s.id === b));
    scene.add(A.root, B.root); const L = Math.max(A.recipe.length, B.recipe.length);
    A.root.position.set(-L * 0.34, 0, L * 0.05); B.root.position.set(L * 0.3, 0, -L * 0.05); A.root.rotation.set(0, 0.85, 0); B.root.rotation.set(0, 0.85, 0);
    ship = null; frame = { radius: L * 0.62, cy: L * 0.06 }; berth.scale.setScalar(L * 0.75); berth.position.y = -L * 0.16;
    return [A, B];
  }
  return { scene, camera, show, setMode, update, render, resize, refresh, note, pair, get viewing() { return viewing; }, get tab() { return tab; }, set tab(t) { tab = t; refresh(); }, get mode() { return mode; }, set mode(m) { mode = m; } };
}
