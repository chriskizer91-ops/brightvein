// port.js: the title screen and the port. Both show your ship turning slowly in a quiet void over a round stone
// berth with a brass rim, lit warm from the front and cool from behind. Drag to turn it.
//   Title: the game's name and the three skies (difficulty) to choose from.
//   Port: pick which ship to sail, buy ships and upgrades with Crystal Shards, and set where the crystals' power goes.
import * as THREE from 'three';
import { SHIPS, STATS } from '../ships/index.js';
import { handling } from './flight.js';
import { KINDS, GUN_WEIGHT } from './guns.js';
import { SKIES, PRICES } from './progress.js';
import { MODS, STEPS, POWER, modCost, loadout } from './mods.js';

const $ = (id) => document.getElementById(id);
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

export function makePort({ renderer, env, progress, shipFor, onSail, onMode }) {
  const scene = new THREE.Scene();
  scene.environment = env; scene.environmentIntensity = 0.75;
  scene.add(makeVoid());
  const berth = makeBerth(); scene.add(berth);
  scene.add(new THREE.HemisphereLight(0x8a90c8, 0x2a1820, 0.6));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04;
  const rimLight = new THREE.DirectionalLight(0x8fc8ff, 1.6);
  scene.add(key, key.target, rimLight);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 9000);

  let mode = 'title', viewing = progress.data.flying, ship = null, spin = 0.7, spinV = 0, drag = null, frame = { radius: 10, cy: 0 };

  // ---------- the ship on show ----------
  function show(id) {
    viewing = id;
    const R = SHIPS.find((s) => s.id === id), next = shipFor(R);
    if (ship && ship !== next) scene.remove(ship.root);
    ship = next;
    ship.root.rotation.set(0, spin, 0); ship.root.position.set(0, 0, 0);
    scene.add(ship.root);
    const b = ship.bounds, size = b.getSize(new THREE.Vector3()), L = R.length;
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
    else if (narrow) { vh = h * 0.47 - 60; cy = 60 + vh / 2; } else { vw = w - 420; cx = vw / 2; vh = h - 140; cy = 54 + vh / 2; }
    const t = Math.tan(fov), fit = Math.min(t * (vh / h), t * camera.aspect * (vw / w));
    const dist = (frame.radius / fit) * 1.02, el = 0.2;
    camera.position.set(0, frame.cy + Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, frame.cy, 0);
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
  }

  // ---------- drag to turn the ship ----------
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => { if (mode === 'voyage') return; drag = { x: e.clientX, id: e.pointerId }; spinV = 0; });
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

  // ---------- the port ----------
  const shipsEl = $('port-ships');
  for (const R of SHIPS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.ship = R.id;
    b.innerHTML = `<b>${R.name}</b><small>${R.cls}</small><em></em>`;
    b.addEventListener('click', () => {
      const own = progress.data.ships[R.id].owned;
      if (own && progress.data.flying !== R.id) { progress.data.flying = R.id; progress.save(); }
      show(R.id);
    });
    shipsEl.append(b);
  }
  $('btn-buy').addEventListener('click', () => {
    const d = progress.data, price = PRICES[viewing];
    if (d.ships[viewing].owned || d.shards < price) return;
    d.shards -= price; d.ships[viewing].owned = true; d.flying = viewing; progress.save(); refresh();
  });
  $('pp-power').addEventListener('input', (e) => { progress.data.ships[viewing].power = +e.target.value; refresh(); });
  $('pp-power').addEventListener('change', () => progress.save());
  const modsEl = $('pp-mods');
  for (const M of MODS) {
    const row = document.createElement('div');
    row.className = 'mod'; row.dataset.mod = M.id;
    row.innerHTML = `<b>${M.name} <span class="pips"></span></b><button class="buy" type="button"></button><p>${M.step}</p>`;
    row.querySelector('button').addEventListener('click', () => {
      const d = progress.data, cfg = d.ships[viewing], step = cfg.mods[M.id], cost = modCost(viewing, step);
      if (!cfg.owned || step >= STEPS || d.shards < cost) return;
      d.shards -= cost; cfg.mods[M.id] = step + 1; progress.save(); refresh();
    });
    modsEl.append(row);
  }
  $('btn-sail').addEventListener('click', () => onSail(progress.data.flying));

  // the stat bars: this ship as built (pale) and with its upgrades (gold), against the best any ship can be
  const best = { speed: 0, turn: 0, climb: 0, hull: 0, firepower: 0 };
  const figures = (id, cfg) => {
    const L = loadout(id, cfg), H = handling(L.stats), st = STATS[id];
    const guns = st.bow * KINDS.chaser.damage / KINDS.chaser.reload + st.side * (st.side > 1 ? KINDS.broadside.damage / KINDS.broadside.reload : KINDS.chaser.damage / KINDS.chaser.reload);
    return {
      speed: H.vmax * L.tune.speed * 3.6, turn: (H.turn * L.tune.turn * 180) / Math.PI, climb: H.climb * L.tune.climb,
      hull: L.stats.hull, sails: L.stats.sails, crystals: L.stats.crystals, firepower: (guns * GUN_WEIGHT[id] * L.guns.damage) / L.guns.reload,
      reload: (st.side > 1 ? KINDS.broadside.reload : KINDS.chaser.reload) * L.guns.reload,
    };
  };
  for (const R of SHIPS) for (const p of [-2, 2]) {
    const f = figures(R.id, { power: p, mods: { armour: p > 0 ? 3 : 0, canvas: 3, drill: 3, crystals: 3 } });
    for (const k in best) best[k] = Math.max(best[k], f[k]);
  }
  const STAT_ROWS = [
    ['speed', 'Top speed', (v) => `${fmt(v)} km/h`], ['turn', 'Turning', (v) => `${v.toFixed(0)}°/s`], ['climb', 'Climbing', (v) => `${v.toFixed(0)} m/s`],
    ['hull', 'Hull', fmt], ['firepower', 'Firepower', (v) => `${fmt(v)}/s`],
  ];
  const statsEl = $('pp-stats');
  statsEl.innerHTML = STAT_ROWS.map(([k, label]) => `<div class="stat" data-stat="${k}"><span>${label}</span><span class="bar"><i class="now"></i><i class="base"></i></span><b></b></div>`).join('');

  function refresh() {
    const d = progress.data, cfg = d.ships[viewing], R = SHIPS.find((s) => s.id === viewing), st = STATS[viewing];
    for (const b of skiesEl.children) {
      b.setAttribute('aria-checked', String(b.dataset.skies === d.skies));
      const n = d.best[b.dataset.skies];
      b.querySelector('small').textContent = n ? `Best: wave ${n}` : '';
    }
    $('btn-skies').textContent = `Skies: ${SKIES[d.skies].name}`;
    $('port-shards').textContent = `◆ ${fmt(d.shards)}`;
    for (const b of shipsEl.children) {
      const id = b.dataset.ship, own = d.ships[id].owned;
      b.setAttribute('aria-pressed', String(id === viewing));
      b.querySelector('em').textContent = id === d.flying ? 'Sailing' : own ? 'Yours' : `◆ ${fmt(PRICES[id])}`;
    }
    $('pp-name').textContent = R.name; $('pp-cls').textContent = `${R.cls} · ${R.length} m · ${st.bow} bow, ${st.side} a side, ${st.stern} stern`;
    $('pp-blurb').textContent = st.blurb;
    const owned = cfg.owned;
    $('pp-buy').hidden = owned; $('pp-own').hidden = !owned;
    if (!owned) {
      const price = PRICES[viewing], b = $('btn-buy');
      b.textContent = `Buy the ${R.name} for ◆ ${fmt(price)}`; b.disabled = d.shards < price;
      $('pp-need').textContent = d.shards < price ? `You need ◆ ${fmt(price - d.shards)} more. Bring down raiders to earn Crystal Shards.` : '';
    }
    const base = figures(viewing, { power: 0, mods: { armour: 0, canvas: 0, drill: 0, crystals: 0 } }), now = figures(viewing, cfg);
    for (const [k, , show] of STAT_ROWS) {
      const row = statsEl.querySelector(`[data-stat="${k}"]`), a = base[k] / best[k], n = now[k] / best[k];
      // pale: what's kept either way; past it, gold for what the upgrades add, red for what they cost
      const [nowBar, baseBar] = row.querySelectorAll('i');
      baseBar.style.width = `${Math.min(a, n) * 100}%`; nowBar.style.width = `${Math.max(a, n) * 100}%`;
      nowBar.classList.toggle('less', n < a - 1e-6);
      row.querySelector('b').textContent = show(now[k]);
    }
    const p = $('pp-power'); p.value = String(cfg.power);
    const pct = (x) => `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;
    $('pp-power-note').textContent = cfg.power === 0 ? 'Even: the crystals feed the sails and the guns alike.'
      : `${POWER[cfg.power + 2]}: top speed ${pct(-0.06 * cfg.power)}, time to reload ${pct(-0.08 * cfg.power)}, shot weight ${pct(0.06 * cfg.power)}.`;
    for (const row of modsEl.children) {
      const M = MODS.find((m) => m.id === row.dataset.mod), step = cfg.mods[M.id], b = row.querySelector('button');
      row.querySelector('.pips').textContent = '●'.repeat(step) + '○'.repeat(STEPS - step);
      if (step >= STEPS) { b.textContent = 'Done'; b.disabled = true; }
      else { const cost = modCost(viewing, step); b.textContent = `◆ ${fmt(cost)}`; b.disabled = d.shards < cost; }
    }
    const F = SHIPS.find((s) => s.id === d.flying);
    $('btn-sail').textContent = `Set sail in the ${F.name}`;
  }

  function setMode(m) {
    mode = m;
    $('title').hidden = m !== 'title'; $('port').hidden = m !== 'port';
    if (m === 'title' || m === 'port') { show(m === 'title' ? progress.data.flying : viewing); onMode?.(m); }
  }
  progress.onLoad(() => { viewing = progress.data.flying; if (mode !== 'voyage') show(viewing); });

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
  return { scene, camera, show, setMode, update, render, resize, refresh, get mode() { return mode; }, set mode(m) { mode = m; } };
}
