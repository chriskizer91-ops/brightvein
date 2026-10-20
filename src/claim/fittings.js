// ===================================================================== FITTINGS: modules in the buildings, and the Lark's parts
// Each building level opens a socket (the Keep opens two at level 3). A module only fits the kind of building it was
// made for; the Keep takes the old Claim Hall's modules and the bunkhouses'. The Lark has three places for parts.
// A module's effect is its value (rolled with its rarity and item level), +4% for every overhaul step, more with the
// Gnomes' trait, more at night with the Watch's. The economy (gear.js), the turrets (wildlight.js) and the jumpers
// (jumpers.js) read it through modV and larkV; the rest (the wall's wire, mirrors, vents and bolt thrower, the
// turrets' rate and prism, the Lark's extra flares, the capacitor jars, the canary) runs each frame in fitTick, from
// here, so the turret and Wildlight code needs only one line each. Fitted modules show on the buildings in 3D:
// small props, merged into a few meshes per building, so phones don't feel them.
// Sockets are saved with the claim: GAME.sockets = { buildingId: [item | null, ...], wall: [...], lark: [...] }.
GAME.sockets = {}; GAME.capacitor = 0; GAME.courier = null;
const SOCKET_FOR = { keep: ['hall', 'bunk'], head: ['head'], yard: ['yard'], shop: ['shop'], garden: ['garden'], lens: ['lens'], wall: ['wall'] };
const LARK_SLOTS = 3;
const isModuleItem = it => !!it && (it.slot === 'module' || it.slot === 'lark');
const sockId = b => b === 'lark' ? 'lark' : b === WALLB ? 'wall' : b.id;
function socketCount(b) {
  if (!b) return 0;
  if (b === 'lark') return LARK_SLOTS;
  if (b === WALLB) return TOWN.wallLevel || 1;
  if (!SOCKET_FOR[b.type] || b.pending) return 0;
  return b.type === 'keep' ? [0, 1, 2, 4][b.level] || 0 : b.level || 0;
}
const socketMax = b => b === 'lark' ? LARK_SLOTS : b === WALLB ? DEFS.wall.max : !SOCKET_FOR[b.type] ? 0 : b.type === 'keep' ? 4 : b.def.max;
const socketsAt = b => GAME.sockets[sockId(b)] || (GAME.sockets[sockId(b)] = []);
const bName = b => b === 'lark' ? 'the Lark' : b.name || b.def.name;
const moduleDef = it => it.type === 'relic' ? D.RELICS[it.base] : (it.slot === 'lark' ? D.LARK_PARTS : D.MODULES)[it.base];
const moduleFor = it => it.slot === 'lark' ? 'lark' : (it.building || (D.RELICS[it.base] || {}).building);
// what kind of building a module is for, in words
const MOD_HOME = { hall: 'the Keep', bunk: 'the Keep', head: 'the Headframe', yard: 'a Sunning Yard', shop: 'the Lens Workshop', garden: 'a Greenhouse', lens: 'a Lens Tower', wall: 'the Rim Wall', lark: 'the Lark' };
const homeOf = it => MOD_HOME[moduleFor(it)] || 'a building';
function fitsIn(it, b) {
  if (!isModuleItem(it)) return false;
  if (b === 'lark') return it.slot === 'lark';
  const want = SOCKET_FOR[b === WALLB ? 'wall' : b.type];
  return !!want && it.slot === 'module' && want.includes(moduleFor(it));
}
// Aether storms seize modules up (half strength) unless they're Self-Oiling. (The storm itself is weather.js.)
const aetherStorm = () => typeof WEATHER !== 'undefined' && !!WEATHER.mix && WEATHER.mix.storm > 0.5;
const hasTrait = (it, stat) => (it.traits || []).some(t => (D.MODULE_AFFIXES[t.id] || {}).stat === stat);
const seized = it => aetherStorm() && !hasTrait(it, 'noBreak');
function attuneK(it) { const A = it.attuned && D.ATTUNE[it.attuned]; if (!A || (A.nightOnly && TOD.night <= 0.5)) return 1; return A.fitted; }
// the live strength of a module's main effect
function modValue(it) {
  let v = (it.value || 0) * ohK(it) * attuneK(it);
  for (const t of it.traits || []) { const a = D.MODULE_AFFIXES[t.id]; if (!a) continue; if (a.stat === 'valueBoost') v *= 1 + t.value / 100; if (a.stat === 'nightBoost' && TOD.night > 0.5) v *= 1 + t.value / 100; }
  return seized(it) ? v * 0.5 : v;
}
function modStat(it, stat) {
  if (it.type === 'relic') { const r = D.RELICS[it.base], v = r && r.stats && r.stats[stat]; return v ? v * ohK(it) * attuneK(it) * (seized(it) ? 0.5 : 1) : 0; }
  const d = moduleDef(it); return d && d.stat === stat ? modValue(it) : 0;
}
function modV(b, stat) { if (!b) return 0; const L = GAME.sockets[sockId(b)]; if (!L) return 0; let s = 0; for (const it of L) if (it) s += modStat(it, stat); return s; }
function modType(type, stat) { let s = 0; for (const b of byType(type)) s += modV(b, stat); return s; }
function modTrait(b, stat) { const L = b && GAME.sockets[sockId(b)]; if (!L) return 0; let s = 0; for (const it of L) if (it) for (const t of it.traits || []) if ((D.MODULE_AFFIXES[t.id] || {}).stat === stat) s += t.value; return s; }
const larkV = stat => modV('lark', stat);
const fmtNum = (v, float) => float ? String(Math.round(v * 100) / 100) : String(Math.round(v));
const RELIC_MOD_TEXT = { lightRadius: v => `The Keep’s lamps light ${v}% farther`, recruit: v => `+${v}% settler arrivals`, range: v => `+${v}% beam range`, split: v => `Each beam also hits ${v} more target${v > 1 ? 's' : ''}`, shipGuard: v => `+${v}% hull guard`, flares: v => `+${v} flare per volley` };
function moduleEffect(it) {
  if (it.type === 'relic') { const r = D.RELICS[it.base]; return Object.entries(r.stats || {}).map(([k, v]) => RELIC_MOD_TEXT[k] ? RELIC_MOD_TEXT[k](Math.round(v * ohK(it) * attuneK(it))) : '').filter(Boolean).join(' · '); }
  const d = moduleDef(it); if (!d) return '';
  return fillV(d.text, fmtNum(modValue(it), d.float));
}
// every fitted module, with where it is
function fittedAll() {
  const out = [];
  for (const [id, L] of Object.entries(GAME.sockets)) L.forEach((it, i) => { if (it) out.push({ it, id, i }); });
  return out;
}
const buildingById = id => id === 'lark' ? 'lark' : id === 'wall' ? WALLB : TOWN.b[id];

// ----------------------------------------------------------------- fitting and taking out
function fitModule(it, b, i) {
  if (!fitsIn(it, b) || i >= socketCount(b)) return false;
  const L = socketsAt(b);
  if (L.some((m, k) => m && k !== i && m.base === it.base)) { toast(`${esc(bName(b))} already has a ${esc(moduleDef(it).name)}. One of each kind per building.`); return false; }
  const si = GAME.stash.indexOf(it); if (si < 0) return false;
  GAME.stash.splice(si, 1);
  if (L[i]) GAME.stash.unshift(L[i]);
  L[i] = it;
  fitChanged(b);
  const at = fitPos(b); AUDIO.play('place', at); FX.sparks(at.clone().setY(at.y + 1.2), 16, 0xffd08a, 2.5);
  toast(`<b style="color:${rarityOf(it).color}">${esc(it.name)}</b> is fitted to ${esc(bName(b))}: ${esc(moduleEffect(it))}.`);
  return true;
}
function unfitModule(b, i) {
  const L = socketsAt(b), it = L[i]; if (!it) return null;
  L[i] = null; GAME.stash.unshift(it); fitChanged(b);
  AUDIO.play('lift', fitPos(b));
  return it;
}
function fitChanged(b) {
  if (b === 'lark') larkProps(); else if (b === WALLB) wallProps(); else moduleProps(b);
  for (const v of GAME.villagers) v.gearCache = null;
}
const fitPos = b => b === 'lark' ? TOWN.ship.ship.position.clone() : b === WALLB ? new THREE.Vector3(WALL.segs[0].mx, 2, WALL.segs[0].mz) : b.group.position.clone();

// ----------------------------------------------------------------- what the modules do, each frame
// (the economy's own hooks are in gear.js: ore, the grinding wheel, yards, greenhouses, the telegraph)
function beeBoxes() { let n = 0; for (const b of byType('garden')) for (const it of GAME.sockets[b.id] || []) if (it && it.base === 'bee-box') n++; return n; }
// a sunning yard's charge rate: mirrors always, gimbals in the low morning and evening sun, bee boxes in any greenhouse
function yardBoost(b) {
  let k = 1 + modV(b, 'charge') / 100;
  const t = TOD.t; if (t < 0.2 || (t > 0.5 && t < 0.69)) k += modV(b, 'dawnDusk') / 100;
  return k * (1 + 0.03 * beeBoxes());
}
// the Cloud Lens: under cloud or in a storm the yard still charges at its share of a clear sky (weather.js's wxSun)
function yardLight(b, light) {
  const v = modV(b, 'thinLight'); if (!v) return light;
  const k = typeof wxSun === 'function' ? wxSun(b) : 1;
  return k >= 0.999 ? light : Math.max(light, light / Math.max(0.05, k) * v / 100);
}
// ore charged a minute in full sun by a yard's tenders, as its panel shows it (and the tests check)
function yardRate(b) { const tend = workersOf(b.id).reduce((s, v) => s + (v.working ? v.eff() : jobEff(v) * workBonus(v, b)), 0), mult = b.level >= 3 ? 1.5 : b.level >= 2 ? 1.25 : 1; return tend * RATES.charge * mult * (castPerk('tock') ? 1.2 : 1) * yardBoost(b) * 60; }
// the Grow Lamp: greenhouses grow through the night for a few shards
function nightGrow(b, dt) {
  const v = modV(b, 'nightFood'); if (!v || TOD.night < 0.5) return 0;
  const cost = 0.03 * (1 - Math.min(0.9, modTrait(b, 'upkeepShards') / 100)) * dt; if (GAME.shards < cost + 2) return 0;
  GAME.shards -= cost;
  const pot = workersOf(b.id).filter(w => !w.d.exp && !w.d.study).reduce((s, w) => s + statOf(w, 'S') / 10, 0);
  return pot * RATES.food * (b.level >= 2 ? 1.3 : 1) * v / 100;
}
// people at work: the Keep's radiator in the morning, and Crew-Friendly modules where they work
function workBonus(v, b) {
  let k = 1;
  const r = modV(TOWN.b.keep, 'rest'); if (r && TOD.t < 0.22 && TOD.night < 0.5) k *= 1 + r / 100;
  const o = b ? modTrait(b, 'out') : 0; if (o) k *= 1 + o / 100;
  return k;
}
// the Alarm Bell: when the wall is breached, the watch fights harder
function watchBell(v) {
  if (!v.d.job || v.d.job.bid !== 'wall') return 1;
  const m = modV(TOWN.b.keep, 'muster'); return m && WALL.segs.some(s => s.broken) ? 1 + m / 100 : 1;
}
const studyBoost = () => 1 + modV(TOWN.b.keep, 'study') / 100;
// Armoured Hull Plates: on patrol, the Lark can take a jumper volley meant for the yards
function larkShields() {
  const g = larkV('shipGuard'); if (!g || SHIP.state !== 'patrol' || Math.random() >= g / 100) return false;
  const p = TOWN.ship.ship.position; FX.sparks(p.clone(), 14, 0xffd090, 3); AUDIO.play('hullhit', p); return true;
}
const larkBoards = () => larkV('board') > 0;
const wallSegAt = p => { const [ix, iz] = cellIx(p.x, p.z); if (!inGrid(ix, iz)) return null; const w = NAV.wall[iz * NAV.GX + ix]; return w >= 0 ? WALL.segs[w] : null; };
const FIT = { canaryNight: -1, balT: 0, sailT: 0, dayAssay: 0 };
function fitTick(dt) {
  if (dt <= 0) return;
  const head = TOWN.b.head, deepSafe = modV(head, 'deepSafe'), warn = modV(head, 'warn');
  const climbD = modV(WALLB, 'climbDmg'), daz = modV(WALLB, 'dazzle'), vent = modV(WALLB, 'wallHp'), bal = modV(WALLB, 'turret');
  // how fast Wildlight chew the wall (wildlight.js huntStep): the vents mend part of it as it goes
  const chewOf = f => (TOWN.wallLevel >= 2 ? 0.022 : 0.05) * (f.K ? f.K.chew : 1) * (f.boss ? 3 : 1) * (WL.night ? (WL.night.n <= 1 ? 0.3 : WL.night.n <= 2 ? 0.6 : 1) : 1);
  for (const f of WL.list) {
    if (f.dead || f.air) continue;
    if (!f._fit) {   // first sight of it: where it started, in case the mirrors throw it back down
      f._fit = { pos: f.pos.clone(), route: (f.route || []).map(p => p.clone()), mode: f.mode };
      if (f.from === 'seam') {
        if (deepSafe && Math.random() < deepSafe / 100) { f.dead = true; f.dying = 1; f.root.visible = false; if (WL.night) WL.night.spawned = Math.max(0, WL.night.spawned - 1); continue; }
        if (warn) { f._slow = 20 / (20 + warn); f.speed *= f._slow; if (f.climbSpeed) f.climbSpeed *= f._slow; if (FIT.canaryNight !== GAME.nights) { FIT.canaryNight = GAME.nights; toast('The canary in the headframe sings: <b>Wildlight coming up the shaft.</b>', 'night'); AUDIO.play('chime', head.group.position); } }
      }
    }
    if (f._slow && f.mode !== 'route') { f.speed /= f._slow; if (f.climbSpeed) f.climbSpeed /= f._slow; f._slow = 0; }
    // Mirror Tiles: at the crest, a climber may be dazzled and fall back down the cliff to climb again
    if (daz && f._fit.mode === 'route' && f.mode === 'hunt' && f.from === 'cliff' && !f._dz && !f.boss) {
      f._dz = true;
      if (Math.random() < daz / 100) { FX.sparks(f.pos.clone().setY(f.pos.y + 1), 18, 0xe8f6ff, 3.5); f.pos.copy(f._fit.pos); f.route = f._fit.route.map(p => p.clone()); f.mode = 'route'; AUDIO.play('zap', f.pos); }
    }
    f._fit.mode = f.mode;
    const seg = (climbD || vent) && f.mode === 'hunt' ? wallSegAt(f.pos) : null;
    // the Arc Wire: near the top of the climb, and anything chewing at the wall
    if (climbD && ((f.mode === 'route' && f.from === 'cliff' && f.pos.y > -4 && !f.leaving) || (seg && !seg.broken))) {
      f.hurt(climbD * dt);
      if (Math.random() < dt * 5) FX.sparks(f.pos.clone().setY(f.pos.y + 0.8), 3, 0x7fd6ff, 2);
    }
    // Steam Vents: the wall stands longer against them
    if (vent && seg && !seg.broken) seg.hp = Math.min(1, seg.hp + chewOf(f) * (1 - 1 / (1 + vent / 100)) * dt);
  }
  // the wall's Clockwork Ballista: a bolt every 2 s at whatever is nearest the wall
  if (bal && WL.list.length && (FIT.balT -= dt) <= 0) {
    let best = null, bs = null, bd = 14;
    for (const f of WL.list) { if (f.dead || f.air || f.pos.y < -3) continue; for (const s of WALL.segs) { const d = Math.hypot(s.mx - f.pos.x, s.mz - f.pos.z); if (d < bd) { bd = d; best = f; bs = s; } } }
    if (best) {
      FIT.balT = 2;
      const from = new THREE.Vector3(bs.mx, 3.3, bs.mz), m = new THREE.Mesh(boltGeo, MAT.iron); m.position.copy(from); scene.add(m);
      BOLTS.push({ m, from, target: best, t: 0, dur: Math.max(0.12, bd / 45), dmg: bal, src: { type: 'ballista' } }); AUDIO.play('thunk', from);
    }
  }
  // the lens towers: Rapid Shutter, Shade Hood, Efficient, and the Prism Splitter, when a tower has just fired
  for (const b of TOWN.towers) {
    const now = b.cool || 0, prev = b._fitCool ?? 0;
    if (now > prev + 1e-3 && now > 0.05) {
      const rate = modV(b, 'rate'); if (rate) b.cool = now / (1 + rate / 100);
      const save = Math.min(0.9, (modV(b, 'shardCost') + modTrait(b, 'upkeepShards')) / 100); if (save > 0) GAME.shards += save;
      const split = Math.round(modV(b, 'split')); if (split > 0) prismSplit(b, split);
    }
    b._fitCool = b.cool || 0;
  }
  // the Lark: the Gyro (faster volleys), the Flare Battery (more flares), the Crystal Sail (speed, and a little charge)
  const sc = SHIP.cool || 0, sp = FIT.shipCool ?? 0;
  if (SHIP.state === 'patrol' && sc > sp + 1e-3 && sc > 0.05) {
    const aim = larkV('aim'); if (aim) SHIP.cool = sc / (1 + aim / 100);
    const extra = Math.round(larkV('flares')); if (extra > 0) larkVolley(extra);
  }
  FIT.shipCool = SHIP.cool || 0;
  const sail = larkV('shipSpeed');
  if (sail && SHIP.state === 'patrol') SHIP.ang += dt * 0.16 * sail / 100;
  if (sail && SHIP.state === 'docked' && TOD.sunlight > 0.2) GAME.shards += sail / 15 * 0.02 * TOD.sunlight * dt;
  // Capacitor Jars: filled by day from the stores, and spent at night only when the stores run dry
  const cap = modType('yard', 'store');
  GAME.capacitor = Math.min(GAME.capacitor || 0, cap);
  if (cap) {
    if (TOD.sunlight > 0.3 && GAME.shards > 60 && GAME.capacitor < cap) { const m = Math.min(cap - GAME.capacitor, 0.5 * dt); GAME.capacitor += m; GAME.shards -= m; }
    else if (TOD.night > 0.3 && GAME.shards < 1.5 && GAME.capacitor >= 1) { GAME.capacitor -= 1; GAME.shards += 1; }
  }
  // the Assay Scale: each morning, up to so many Signed pieces assayed for free
  if (FIT.dayAssay !== GAME.day && TOD.t > 0.04 && TOD.t < 0.5) {
    FIT.dayAssay = GAME.day;
    let n = Math.round(modV(TOWN.b.keep, 'assay'));
    const done = [];
    for (const it of allItems().map(x => x.it)) { if (n <= 0) break; if (it.unassayed) { delete it.unassayed; n--; done.push(it); } }
    if (done.length) { toast(`The Assay Scale has read the mark on <b style="color:${rarityOf(done[0]).color}">${esc(done[0].name)}</b>${done.length > 1 ? ` and ${done.length - 1} more` : ''}.`); AUDIO.play('chime'); UI.refresh(); }
  }
}
// the Prism Splitter: the beam splits on its target into the nearest others
function prismSplit(b, n) {
  const muzzle = new THREE.Vector3(); b.muzzle.getWorldPosition(muzzle);
  const range = turretRange(b); let hit = null, hd = range;
  for (const f of WL.list) { if (f.dead || f.pos.y < -2) continue; const d = Math.hypot(f.pos.x - muzzle.x, f.pos.z - muzzle.z); if (d < hd) { hd = d; hit = f; } }
  if (!hit) return;
  const others = WL.list.filter(f => f !== hit && !f.dead && f.pos.y > -2 && f.pos.distanceTo(hit.pos) < 9).sort((a, c) => a.pos.distanceTo(hit.pos) - c.pos.distanceTo(hit.pos)).slice(0, n);
  for (const f of others) { fireBeam(hit.pos.clone().setY(hit.pos.y + 0.7), f.pos.clone().setY(f.pos.y + 0.7), 0xf7c8ff, 0.6); f.hurt((15 + (b.level >= 2 ? 5 : 0)) * 0.7, b); }
}
// the Flare Battery: more flares in each of the Lark's volleys, at the next nearest
function larkVolley(n) {
  const ship = TOWN.ship.ship, last = FLARES.length ? FLARES[FLARES.length - 1].target : null;
  const pool = WL.list.filter(f => !f.dead && f !== last && f.pos.distanceTo(ship.position) < 34).sort((a, c) => a.pos.distanceTo(ship.position) - c.pos.distanceTo(ship.position));
  for (let k = 0; k < n; k++) {
    const target = pool[k] || last; if (!target || GAME.shards < 1) break;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffd090 }));
    sp.scale.set(1.2, 1.2, 1); sp.position.copy(ship.position); scene.add(sp);
    FLARES.push({ sp, target, t: 0, from: ship.position.clone().add(new THREE.Vector3(0, 0.6 + k * 0.5, (k % 2 ? -1 : 1) * 0.8)) });
  }
}

// ----------------------------------------------------------------- the props: what a fitted module looks like on its building
// One small model per kind of module, a metre or two tall, from a few shared shapes. Each building's props are merged
// into one mesh per material; the lens tower's ride on its turning head instead.
const PG = {};
function propGeo() {
  if (PG.ok) return PG; PG.ok = true;
  PG.box = new THREE.BoxGeometry(1, 1, 1); PG.cyl = new THREE.CylinderGeometry(1, 1, 1, 12); PG.cyl6 = new THREE.CylinderGeometry(1, 1, 1, 6);
  PG.cone = new THREE.ConeGeometry(1, 1, 12); PG.sph = new THREE.SphereGeometry(1, 12, 8); PG.ring = new THREE.TorusGeometry(1, 0.1, 6, 24);
  PG.disc = new THREE.CircleGeometry(1, 20); PG.oct = new THREE.OctahedronGeometry(1, 0); PG.dish = new THREE.SphereGeometry(1, 16, 6, 0, TAU, 0, 0.75);
  PG.dish.scale(1, 0.45, 1);
  // polished mirror metal: bright where it catches the sky, but not a glowing lamp
  PG.mirror = trackEnv(new THREE.MeshStandardMaterial({ color: 0xd6e0e6, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), 0.6);
  // and clear glass for the props' lenses (the towers' own lenses glow; these shouldn't)
  PG.pglass = trackEnv(new THREE.MeshStandardMaterial({ color: 0x9fc8d0, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }), 0.25);
  return PG;
}
// a prop is a list of parts: [shape, material, x, y, z, sx, sy, sz, rx, ry, rz]
const PROPS = {
  // the Keep
  telegraph: () => [['cyl6', 'oakDark', 0, 1.3, 0, 0.09, 2.6, 0.09], ['box', 'oakDark', 0, 2.4, 0, 1.2, 0.1, 0.1], ['cyl6', 'cream', -0.5, 2.5, 0, 0.06, 0.14, 0.06], ['cyl6', 'cream', 0.5, 2.5, 0, 0.06, 0.14, 0.06], ['box', 'oak', 0, 0.45, 0.3, 0.7, 0.12, 0.45], ['box', 'brass', 0.05, 0.56, 0.3, 0.32, 0.08, 0.12, 0, 0, 0.25]],
  scale: () => [['box', 'oak', 0, 0.42, 0, 0.9, 0.84, 0.6], ['cyl', 'brass', 0, 1.1, 0, 0.04, 0.5, 0.04], ['box', 'brass', 0, 1.36, 0, 0.8, 0.04, 0.04], ['dish', 'brass', -0.38, 1.05, 0, 0.2, 0.2, 0.2, Math.PI], ['dish', 'brass', 0.38, 1.12, 0, 0.2, 0.2, 0.2, Math.PI], ['oct', 'crystal', 0.38, 1.2, 0, 0.07, 0.11, 0.07]],
  ticker: () => [['box', 'oak', 0, 0.42, 0, 0.7, 0.84, 0.6], ['cyl', 'brass', 0, 0.9, 0, 0.22, 0.12, 0.22], ['sph', 'glass', 0, 1.15, 0, 0.24, 0.3, 0.24], ['box', 'cream', 0.28, 0.9, 0.1, 0.3, 0.03, 0.12]],
  radiator: () => [...[0, 1, 2, 3, 4].map(i => ['box', 'copper', -0.4 + i * 0.2, 0.55, 0, 0.12, 0.9, 0.3]), ['box', 'iron', 0, 0.08, 0, 1.1, 0.12, 0.4], ['cyl', 'brass', 0.62, 0.9, 0, 0.08, 0.3, 0.08]],
  lockers: () => [['box', 'iron', -0.3, 0.8, 0, 0.55, 1.6, 0.5], ['box', 'iron', 0.3, 0.8, 0, 0.55, 1.6, 0.5], ['box', 'brass', -0.12, 0.85, 0.26, 0.05, 0.1, 0.03], ['box', 'brass', 0.48, 0.85, 0.26, 0.05, 0.1, 0.03], ['box', 'dark', 0, 1.62, 0, 1.15, 0.05, 0.52]],
  bell: () => [['box', 'oakDark', -0.55, 1.1, 0, 0.12, 2.2, 0.12], ['box', 'oakDark', 0.55, 1.1, 0, 0.12, 2.2, 0.12], ['box', 'oakDark', 0, 2.2, 0, 1.3, 0.14, 0.14], ['cone', 'brass', 0, 1.75, 0, 0.36, 0.6, 0.36], ['ring', 'brass', 0, 1.46, 0, 0.36, 0.36, 0.36, Math.PI / 2], ['sph', 'iron', 0, 1.42, 0, 0.07, 0.07, 0.07]],
  beacon: () => [['cyl', 'dressed', 0, 0.3, 0, 0.6, 0.6, 0.6], ['box', 'brass', 0, 0.7, 0, 0.9, 0.12, 0.9], ['oct', 'crystal', 0, 1.6, 0, 0.42, 0.9, 0.42], ['ring', 'brass', 0, 1.6, 0, 0.7, 0.7, 0.7, Math.PI / 2]],
  // the headframe
  drillhead: () => [['box', 'oakDark', 0, 0.3, 0, 1.0, 0.6, 0.8], ['cone', 'steel', 0, 0.95, 0, 0.32, 0.9, 0.32, Math.PI], ['cyl', 'brass', 0, 1.45, 0, 0.3, 0.16, 0.3], ...[0, 1, 2].map(i => ['ring', 'iron', 0, 0.8 + i * 0.16, 0, 0.26 - i * 0.07, 0.26 - i * 0.07, 0.26 - i * 0.07, Math.PI / 2])],
  canary: () => [['cyl6', 'oakDark', 0, 1.2, 0, 0.07, 2.4, 0.07], ['box', 'oakDark', 0.4, 2.35, 0, 0.9, 0.08, 0.08], ['cyl', 'brass', 0.75, 1.62, 0, 0.26, 0.04, 0.26], ...[0, 1, 2, 3, 4, 5].map(i => ['cyl6', 'brass', 0.75 + Math.cos(i * 1.047) * 0.24, 1.86, Math.sin(i * 1.047) * 0.24, 0.015, 0.5, 0.015]), ['sph', 'brass', 0.75, 2.12, 0, 0.26, 0.12, 0.26], ['sph', 'gold', 0.75, 1.8, 0, 0.1, 0.09, 0.08]],
  sorter: () => [['cone', 'iron', 0, 1.25, 0, 0.6, 0.8, 0.6, Math.PI], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => ['box', 'oakDark', a * 0.38, 0.45, c * 0.38, 0.08, 0.9, 0.08]), ['oct', 'crystal', 0.3, 0.12, 0.2, 0.12, 0.1, 0.12], ['oct', 'crystal', -0.25, 0.1, -0.15, 0.1, 0.09, 0.1]],
  props: () => [['box', 'iron', -0.5, 0.9, 0, 0.12, 1.8, 0.12], ['box', 'iron', 0.5, 0.9, 0, 0.12, 1.8, 0.12], ['box', 'iron', 0, 1.82, 0, 1.3, 0.14, 0.16], ['box', 'iron', 0, 0.95, 0, 0.08, 1.4, 0.08, 0, 0, 0.62]],
  // the sunning yards
  // a round mirror in a brass frame, tipped up to the sun, with a crystal held at its focus
  mirror: () => [['box', 'iron', 0, 0.06, 0, 0.6, 0.12, 0.6], ['cyl', 'iron', 0, 0.85, 0, 0.06, 1.6, 0.06], ['box', 'iron', 0, 1.62, -0.05, 0.9, 0.08, 0.08], ['cyl', 'brass', 0, 1.7, -0.03, 0.88, 0.07, 0.88, Math.PI / 2 - 0.8], ['disc', 'mirror', 0, 1.73, 0.0, 0.8, 0.8, 0.8, -0.8], ['ring', 'brass', 0, 1.73, 0.0, 0.84, 0.84, 0.84, -0.8], ['cyl', 'brass', 0, 1.92, 0.19, 0.022, 0.55, 0.022, 0.8], ['oct', 'crystal', 0, 2.1, 0.38, 0.1, 0.15, 0.1]],
  gimbal: () => [['cyl', 'iron', 0, 0.6, 0, 0.06, 1.2, 0.06], ['ring', 'brass', 0, 1.6, 0, 0.55, 0.55, 0.55], ['ring', 'copper', 0, 1.6, 0, 0.46, 0.46, 0.46, Math.PI / 2], ['disc', 'pglass', 0, 1.6, 0, 0.36, 0.36, 0.36, -0.5], ['oct', 'crystal', 0, 1.6, 0, 0.08, 0.08, 0.08]],
  cloudlens: () => [['cyl', 'oakDark', 0, 1.1, 0, 0.07, 2.2, 0.07], ['ring', 'brass', 0, 2.3, 0, 0.5, 0.5, 0.5, Math.PI / 2 - 0.5], ['disc', 'pglass', 0, 2.3, 0, 0.47, 0.47, 0.47, -Math.PI / 2 - 0.5], ['sph', 'cream', 0.3, 2.85, 0, 0.26, 0.16, 0.2], ['sph', 'cream', -0.1, 2.92, 0, 0.3, 0.18, 0.22]],
  jars: () => [['box', 'oak', 0, 0.1, 0, 1.3, 0.2, 0.5], ...[-0.42, 0, 0.42].flatMap(x => [['cyl', 'glass', x, 0.55, 0, 0.17, 0.7, 0.17], ['oct', 'crystal', x, 0.52, 0, 0.1, 0.24, 0.1], ['cyl', 'copper', x, 0.94, 0, 0.18, 0.08, 0.18]]), ['box', 'copper', 0, 1.0, 0, 1.0, 0.03, 0.03]],
  // the Lens Workshop
  wheel: () => [['box', 'oakDark', -0.35, 0.5, 0, 0.1, 1.0, 0.5], ['box', 'oakDark', 0.35, 0.5, 0, 0.1, 1.0, 0.5], ['cyl', 'stone', 0, 1.1, 0, 0.5, 0.14, 0.5, 0, 0, Math.PI / 2], ['cyl', 'iron', 0, 1.1, 0, 0.06, 0.8, 0.06, 0, 0, Math.PI / 2], ['box', 'oak', 0, 0.06, 0, 0.9, 0.12, 0.7]],
  lathe: () => [['box', 'iron', 0, 0.85, 0, 1.4, 0.18, 0.4], ['box', 'iron', -0.55, 0.42, 0, 0.16, 0.84, 0.36], ['box', 'iron', 0.55, 0.42, 0, 0.16, 0.84, 0.36], ['box', 'iron', -0.5, 1.15, 0, 0.3, 0.42, 0.34], ['cyl', 'brass', -0.25, 1.15, 0, 0.12, 0.3, 0.12, 0, 0, Math.PI / 2], ['box', 'iron', 0.45, 1.1, 0, 0.24, 0.3, 0.3]],
  bellows: () => [['box', 'oak', 0, 0.3, 0, 0.9, 0.6, 0.6], ['cone', 'canvas', -0.05, 0.95, 0, 0.42, 0.6, 0.3, 0, 0, Math.PI / 2], ['box', 'oak', 0.3, 1.0, 0, 0.5, 0.06, 0.4, 0, 0, -0.3], ['cyl', 'brass', -0.45, 0.95, 0, 0.05, 0.4, 0.05, 0, 0, Math.PI / 2]],
  // the greenhouses
  drip: () => [...[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([a, c]) => ['box', 'oakDark', a, 0.7, c, 0.08, 1.4, 0.08]), ['cyl', 'copper', 0, 1.65, 0, 0.5, 0.6, 0.5], ['cone', 'copper', 0, 2.05, 0, 0.52, 0.2, 0.52], ['cyl', 'copper', 0.5, 0.4, 0, 0.04, 1.6, 0.04, 0, 0, Math.PI / 2], ['sph', 'glass', 1.1, 0.3, 0, 0.05, 0.08, 0.05]],
  beebox: () => [['box', 'oakDark', 0, 0.25, 0, 0.12, 0.5, 0.12], ['box', 'oak', 0, 0.75, 0, 0.7, 0.5, 0.55], ['box', 'cream', 0, 1.05, 0, 0.74, 0.12, 0.6], ['cone', 'copper', 0, 1.3, 0, 0.6, 0.38, 0.5, 0, Math.PI / 4], ['box', 'dark', 0, 0.62, 0.28, 0.25, 0.06, 0.02], ['sph', 'gold', 0.4, 1.2, 0.3, 0.05, 0.04, 0.04], ['sph', 'gold', -0.35, 0.9, 0.35, 0.05, 0.04, 0.04]],
  growlamp: () => [['cyl', 'iron', 0, 1.1, 0, 0.05, 2.2, 0.05], ['box', 'iron', 0.3, 2.2, 0, 0.7, 0.06, 0.06], ['cone', 'brass', 0.62, 1.95, 0, 0.3, 0.3, 0.3], ['oct', 'crystal', 0.62, 1.78, 0, 0.12, 0.16, 0.12], ['cyl', 'copper', 0, 0.15, 0, 0.32, 0.3, 0.32], ['sph', 'leaf', 0, 0.42, 0, 0.3, 0.26, 0.3]],
  // the wall's bolt thrower when it stands on the ground (the wall itself is drawn in wallProps)
  ballista: () => [['box', 'oakDark', 0, 0.4, 0, 0.3, 0.8, 0.3], ['box', 'oak', 0, 0.9, 0.2, 0.18, 0.14, 1.3], ['box', 'iron', 0, 0.92, 0.6, 1.4, 0.08, 0.08, 0, 0.3]],
};
const PROP_MAT = k => k === 'mirror' ? PG.mirror : k === 'pglass' ? PG.pglass : k === 'steel' ? MAT.iron : k === 'gold' ? MAT.brass : MAT[k] || MAT.brass;
function addProp(group, kind, x, y, z, ry = 0, s = 1) {
  const P = propGeo(), list = (PROPS[kind] || PROPS.jars)(), holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = ry; holder.scale.setScalar(s); group.add(holder);
  const meshes = [];
  for (const [shape, mat, px, py, pz, sx, sy, sz, rx = 0, rry = 0, rz = 0] of list) {
    const m = new THREE.Mesh(P[shape], PROP_MAT(mat)); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, rry, rz);
    m.castShadow = true; m.receiveShadow = true; holder.add(m); meshes.push(m);
  }
  return meshes;
}
// where each kind of building shows its modules, in its own model's coordinates [x, y, z, turn]
const PROP_AT = {
  keep: [[-4.6, 0, 4.7, 0.3], [4.9, 0, 4.5, -0.3], [-5.8, 0, 0.2, 0], [5.8, 0, 0.2, 0]],
  head: [[-4.3, 0, 0.0, 0.4], [4.3, 0, -0.2, -0.4], [0.25, 0, -3.0, Math.PI]],   // clear of both steam winches and the ore bin
  yard: [[-4.4, 0, 4.85, 0], [2.4, 0, 4.85, 0], [-6.95, 0, -1.6, Math.PI / 2]],
  shop: [[-4.75, 0, 1.2, Math.PI / 2], [4.75, 0, -1.2, -Math.PI / 2]],
  garden: [[6.9, 0, 2.3, -Math.PI / 2], [-6.6, 0, -1.0, Math.PI / 2]],
};
function moduleProps(b) {
  if (!b || !b.group) return;
  if (b.modProps) { b.group.remove(b.modProps); for (const m of b.modProps.children) if (m.userData.merged) m.geometry.dispose(); b.modProps = null; }
  for (const m of b.lensProps || []) m.parent && m.parent.remove(m); b.lensProps = [];
  const L = (GAME.sockets[b.id] || []).filter(Boolean); if (!L.length || !b.level) return;
  if (b.type === 'lens') { lensProps(b, L); return; }
  const at = PROP_AT[b.type] || [], g = new THREE.Group(); g.userData.dynamic = true; b.group.add(g);
  const all = [];
  (GAME.sockets[b.id] || []).forEach((it, i) => { if (!it || !at[i]) return; const [x, y, z, ry] = at[i]; all.push(...addProp(g, it.kind, x, y, z, ry, 1.15)); });
  // one mesh per material for the lot
  const merged = mergeMeshes(g, all); for (const m of all) m.parent.remove(m); for (const c of [...g.children]) if (!c.isMesh) g.remove(c);
  for (const m of merged) m.userData.building = b;
  b.modProps = g;
}
// the lens tower's modules ride its turning head, so they're not merged (a few small meshes)
function lensProps(b, L) {
  const P = propGeo(), add = (parent, geo, mat, x, y, z, s, r = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(...s); m.rotation.set(...r); m.castShadow = true; m.userData.building = b; parent.add(m); b.lensProps.push(m); return m; };
  for (const it of L) {
    const k = it.kind;
    if (k === 'fresnel') { add(b.tilt, P.ring, MAT.brass, 0, 0, 0.62, [0.95, 0.95, 0.95]); add(b.tilt, P.ring, MAT.brass, 0, 0, 0.66, [0.7, 0.7, 0.7]); add(b.tilt, P.disc, P.pglass, 0, 0, 0.64, [0.9, 0.9, 0.9]); }
    else if (k === 'shutter') { add(b.tilt, P.ring, MAT.iron, 0, 0, 0.42, [0.9, 0.9, 2.2]); for (let i = 0; i < 6; i++) add(b.tilt, P.box, MAT.iron, Math.cos(i * 1.047) * 0.82, Math.sin(i * 1.047) * 0.82, 0.42, [0.26, 0.12, 0.06], [0, 0, i * 1.047]); }
    else if (k === 'prism') { add(b.tilt, P.oct, P.pglass, 0, -0.95, 0.75, [0.3, 0.42, 0.3]); add(b.tilt, P.ring, MAT.brass, 0, -0.95, 0.75, [0.32, 0.32, 0.32], [Math.PI / 2, 0, 0]); add(b.tilt, P.box, MAT.brass, 0, -0.55, 0.62, [0.06, 0.5, 0.06]); }
    else if (k === 'hood') add(b.tilt, P.cone, MAT.copper, 0, 0, 0.75, [0.95, 0.9, 0.95], [-Math.PI / 2, 0, 0]);
    else if (k === 'bigLens') { add(b.tilt, P.ring, MAT.brass, 0, 0, 0.9, [1.35, 1.35, 1.35]); add(b.tilt, P.disc, MAT.crystal, 0, 0, 0.88, [1.25, 1.25, 1.25]); }
  }
}
// the Rim Wall's modules, all the way round it, as a few instanced meshes
const WALLP = { meshes: [] };
function wallProps() {
  for (const m of WALLP.meshes) { scene.remove(m); m.dispose && m.dispose(); } WALLP.meshes = [];
  const kinds = new Set((GAME.sockets.wall || []).filter(Boolean).map(it => it.kind)); if (!kinds.size || !WALL.segs.length) return;
  const P = propGeo(), segs = WALL.segs, top = 3.15;
  const out = s => { let nx = -Math.sin(s.ang), nz = Math.cos(s.ang); if (nx * s.mx + nz * s.mz < 0) { nx = -nx; nz = -nz; } return [nx, nz]; };
  const inst = (geo, mat, list) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); list.forEach((M, i) => m.setMatrixAt(i, M)); m.count = list.length; m.castShadow = true; m.frustumCulled = false; scene.add(m); WALLP.meshes.push(m); };
  const M4 = (x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  if (kinds.has('wire')) {
    const posts = [], wires = [], knobs = [];
    for (const s of segs) { const [nx, nz] = out(s), ox = nx * 0.45, oz = nz * 0.45;
      posts.push(M4(s.a[0] + ox, top + 0.45, s.a[1] + oz, 0, 0.08, 0.9, 0.08));
      for (const h of [0.55, 0.85]) wires.push(M4(s.mx + ox, top + h, s.mz + oz, -s.ang, s.len, 0.035, 0.035));
      knobs.push(M4(s.a[0] + ox, top + 0.92, s.a[1] + oz, 0, 0.07, 0.1, 0.07)); }
    inst(P.box, MAT.oakDark, posts); inst(P.box, MAT.copper, wires); inst(P.oct, MAT.crystal, knobs);
  }
  if (kinds.has('tiles')) {
    const tiles = [];
    segs.forEach((s, i) => { const [nx, nz] = out(s); for (const t of [0.3, 0.7]) tiles.push(M4(lerp(s.a[0], s.b[0], t) + nx * 0.62, 1.7 + (i % 2) * 0.3, lerp(s.a[1], s.b[1], t) + nz * 0.62, -s.ang, 0.7, 0.7, 0.05)); });
    inst(P.box, P.mirror, tiles);
  }
  if (kinds.has('vents')) {
    const pipes = [], caps = [];
    segs.forEach((s, i) => { if (i % 2) return; const [nx, nz] = out(s); pipes.push(M4(s.mx + nx * 0.2, top + 0.5, s.mz + nz * 0.2, 0, 0.12, 1.0, 0.12)); caps.push(M4(s.mx + nx * 0.2, top + 1.05, s.mz + nz * 0.2, 0, 0.2, 0.14, 0.2)); });
    inst(P.cyl, MAT.copper, pipes); inst(P.cyl, MAT.brass, caps); WALLP.vents = segs.filter((_, i) => !(i % 2));
  } else WALLP.vents = null;
  if (kinds.has('ballista')) {
    const stocks = [], bows = [];
    segs.forEach((s, i) => { if (i % 5) return; const [nx, nz] = out(s), ry = Math.atan2(nx, nz); stocks.push(M4(s.mx, top + 0.25, s.mz, ry, 0.2, 0.18, 1.2)); bows.push(M4(s.mx + nx * 0.4, top + 0.3, s.mz + nz * 0.4, ry, 1.3, 0.08, 0.08)); });
    inst(P.box, MAT.oak, stocks); inst(P.box, MAT.iron, bows);
  }
}
// the Lark's parts, on her hull (she was merged into one mesh when she was built, so these are a group of their own).
// They're drawn half again as big as life, so they read from the lawn: each with an accent lit in its rarity's colour,
// and a pennant of that colour flown from her top yard for every part fitted. Merged into a draw per material.
const LARK_ACCENT = {};
function larkAccent(col, k = 0.9) {
  const key = col + ':' + k;
  return LARK_ACCENT[key] || (LARK_ACCENT[key] = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: k, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide }));
}
function larkPennantGeo() {
  // a long tapering pennant, streaming aft from its hoist and drooping a little
  const g = new THREE.BufferGeometry(), L = 2.2, W = 0.42, n = 8, pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const u = i / n, w = W * (1 - u * 0.92) / 2, y = -u * u * 0.35, z = Math.sin(u * 5) * 0.12 * u; pos.push(-u * L, y + w, z, -u * L, y - w, z); }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}
function larkProps() {
  const S = TOWN.ship; if (!S) return;
  if (S.parts) { S.hullG.remove(S.parts); S.parts.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); S.parts = null; }   // (the merged copies; the shapes they came from are shared)
  const L = (GAME.sockets.lark || []).filter(Boolean); if (!L.length) return;
  const P = propGeo(), g = new THREE.Group(); S.hullG.add(g); S.parts = g;
  const PEN = PG.pennant || (PG.pennant = larkPennantGeo());
  const meshes = [];
  L.forEach((it, n) => {
    const k = it.kind, acc = larkAccent(rarityOf(it).color), part = new THREE.Group();
    // each part grows from where it's fixed: that point on her deck or hull
    const at = { battery: [4.3, 0.1, 0], sail: [0.75, 4.2, 0], plates: [0, -0.35, 0], gyro: [-4.6, 1.85, 0], winch: [5.8, 0.15, 0], figurehead: [7.6, 1.0, 0] }[k] || [0, 0, 0];
    part.position.set(...at); part.scale.setScalar(k === 'plates' ? 1 : 1.6); g.add(part);
    const add = (geo, mat, x, y, z, sc, r = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(x - at[0], y - at[1], z - at[2]); m.scale.set(...sc); m.rotation.set(...r); m.castShadow = mat !== acc; part.add(m); meshes.push(m); };
    if (k === 'battery') {
      add(P.box, MAT.brass, 4.3, 0.35, 0, [1.0, 0.5, 0.9]); add(P.box, acc, 4.3, 0.35, 0, [1.04, 0.12, 0.94]);
      for (let i = 0; i < 4; i++) { const x = 4.0 + (i % 2) * 0.55, z = i < 2 ? -0.22 : 0.22; add(P.cyl, MAT.iron, x, 0.75, z, [0.12, 0.5, 0.12], [0, 0, -0.5]); add(P.sph, acc, x + 0.13, 0.98, z, [0.09, 0.09, 0.09]); }
    } else if (k === 'sail') {
      add(P.box, MAT.crystal, 0.75, 4.2, 0.0, [0.06, 2.6, 1.6]); add(P.box, MAT.brass, 0.75, 5.55, 0, [0.08, 0.1, 1.8]);
      for (const z of [-0.82, 0.82]) add(P.box, acc, 0.75, 4.2, z, [0.09, 2.6, 0.06]);
      add(P.box, acc, 0.75, 2.88, 0, [0.09, 0.06, 1.7]);
    } else if (k === 'plates') {
      for (const z of [-1, 1]) { for (let i = 0; i < 4; i++) add(P.box, MAT.iron, -3 + i * 2.1, -0.35, z * 2.14, [1.9, 0.9, 0.12]); add(P.box, acc, 0.15, 0.05, z * 2.21, [8.2, 0.1, 0.05]); }
    } else if (k === 'gyro') {
      add(P.ring, MAT.brass, -4.6, 2.4, 0, [0.55, 0.55, 0.55]); add(P.ring, MAT.copper, -4.6, 2.4, 0, [0.45, 0.45, 0.45], [Math.PI / 2, 0, 0]);
      add(P.cyl, MAT.brass, -4.6, 2.0, 0, [0.06, 0.4, 0.06]); add(P.sph, acc, -4.6, 2.4, 0, [0.16, 0.16, 0.16]);
    } else if (k === 'winch') {
      add(P.cyl, MAT.oak, 5.8, 0.55, 0, [0.35, 0.9, 0.35], [Math.PI / 2, 0, 0]); add(P.ring, MAT.iron, 5.8, 0.55, 0.3, [0.36, 0.36, 0.36]);
      add(P.cone, MAT.iron, 7.3, 1.25, 0, [0.12, 0.4, 0.12], [0, 0, -1.2]); add(P.ring, acc, 5.8, 0.55, -0.3, [0.37, 0.37, 0.37]);
    } else if (k === 'figurehead') {
      add(P.sph, MAT.brass, 7.75, 1.0, 0, [0.4, 0.28, 0.22]); add(P.cone, MAT.brass, 8.15, 1.05, 0, [0.1, 0.35, 0.1], [0, 0, -Math.PI / 2]);
      add(P.box, MAT.brass, 7.6, 1.2, 0.35, [0.5, 0.06, 0.5], [0.6, 0, 0.3]); add(P.box, MAT.brass, 7.6, 1.2, -0.35, [0.5, 0.06, 0.5], [-0.6, 0, 0.3]);
      add(P.sph, acc, 7.95, 1.08, 0, [0.09, 0.09, 0.09]);
    }
    // its pennant, from the top yard: the middle first, then each end
    const pen = new THREE.Mesh(PEN, larkAccent(rarityOf(it).color, 0.25));
    pen.position.set(0.5, 7.55, [0, -1.7, 1.7][n % 3]); pen.castShadow = true; g.add(pen); meshes.push(pen);
  });
  // one draw per material for all of it
  const merged = mergeMeshes(g, meshes);
  for (const m of meshes) m.removeFromParent();
  for (const m of merged) m.userData.ship = true;
}
function allProps() { for (const b of Object.values(TOWN.b)) moduleProps(b); wallProps(); larkProps(); }
// the steam vents puff now and then while Wildlight are about
function fitFrame(rdt) {
  if (WALLP.vents && WL.night && Math.random() < rdt * 3) { const s = WALLP.vents[Math.random() * WALLP.vents.length | 0]; FX.smoke(new THREE.Vector3(s.mx, 4.3, s.mz), 0xe8e4dc); }
}

// ----------------------------------------------------------------- the panels: a building's sockets, the fit picker, the Lark
UI.socketBlock = function (body, b) {
  const max = socketMax(b); if (!max) return;
  const n = socketCount(b), L = socketsAt(b), have = L.filter(Boolean).length;
  body.append(this.h(`<h3>${b === 'lark' ? 'Parts' : 'Module sockets'} · ${have} of ${n} fitted${n < max ? ` · ${b === WALLB || b.type !== 'keep' ? 'each level opens one' : 'the Keep opens more as it rises'}` : ''}</h3>`));
  const box = document.createElement('div'); box.className = 'sockets';
  for (let i = 0; i < max; i++) {
    const it = L[i], el = document.createElement('button'); el.type = 'button';
    if (i >= n) { el.className = 'sock locked'; el.disabled = true; const lv = b === WALLB ? i + 1 : b.type === 'keep' ? [1, 2, 3, 3][i] : i + 1; el.append(this.h(`<span class="lk">◆</span><span>Level ${lv}</span>`)); }
    else if (it) { const R = rarityOf(it); el.className = 'sock full'; el.style.setProperty('--rc', R.color); el.append(itemPicture(it, 44)); el.append(this.h(`<span class="sn" style="color:${R.color}">${esc(moduleDef(it).name)}${it.overhaul ? ' +' + it.overhaul : ''}</span><span class="se">${esc(moduleEffect(it))}${seized(it) ? ' · seized in the storm' : ''}</span>`)); el.onclick = () => UI.open('item', { it, back: () => UI.open(b === 'lark' ? 'lark' : 'building', b) }); el.setAttribute('aria-label', `${moduleDef(it).name}: ${moduleEffect(it)}`); }
    else { el.className = 'sock empty'; el.append(this.h(`<span class="plus">+</span><span>${b === 'lark' ? 'Fit a part' : 'Fit a module'}</span>`)); el.onclick = () => UI.open('fit', { b, i }); }
    box.append(el);
  }
  body.append(box);
  // what the fitted modules add up to, in a line
  const sum = [];
  if (b !== 'lark' && b.type === 'yard') { const k = yardBoost(b); if (k > 1.001) sum.push(`Charges ${Math.round((k - 1) * 100)}% faster`); const cap = modV(b, 'store'); if (cap) sum.push(`Jars ${Math.floor(GAME.capacitor || 0)} of ${Math.round(modType('yard', 'store'))} shards`); }
  if (b !== 'lark' && b.type === 'lens') { const r = modV(b, 'range'); if (r) sum.push(`Reach ${Math.round(turretRange(b))} m`); }
  if (sum.length) body.append(this.h(`<div class="stats-row">${sum.map(s => `<span class="chip amber">${esc(s)}</span>`).join('')}</div>`));
};
UI.fit = function (body, { b, i }) {
  const cur = socketsAt(b)[i], back = () => UI.open(b === 'lark' ? 'lark' : 'building', b);
  body.append(this.h(`<h2>${b === 'lark' ? 'A part for the Lark' : 'Fit a module'}</h2><p class="sub">${esc(bName(b))} · socket ${i + 1}. ${b === 'lark' ? 'Lark parts change how she flies her patrol.' : `Only modules made for ${esc(b === WALLB ? 'the Rim Wall' : MOD_HOME[SOCKET_FOR[b.type][0]])} fit here, one of each kind.`}</p>`));
  const list = document.createElement('div'); list.className = 'list';
  if (cur) { body.append(this.h(`<h3>Fitted now</h3>`)); const l0 = document.createElement('div'); l0.className = 'list'; l0.append(this.itemRow(cur, 'Take out', () => { unfitModule(b, i); UI.open('fit', { b, i }); })); body.append(l0); }
  const opts = GAME.stash.filter(it => fitsIn(it, b)).sort((a, c) => LOOT.rankOf(c.rarity) - LOOT.rankOf(a.rarity) || (c.value || 0) - (a.value || 0));
  body.append(this.h(`<h3>In the stash · ${opts.length}</h3>`));
  for (const it of opts) { const dup = socketsAt(b).some((m, k) => m && k !== i && m.base === it.base); list.append(this.itemRow(it, dup ? 'Already has one' : 'Fit', () => { if (fitModule(it, b, i)) back(); })); }
  if (!opts.length) list.append(this.h(`<p class="small">Nothing for ${esc(bName(b))} in the stash yet. Modules turn up in the mine, in raid crates and in the chests of Lodestars, and the courier at the mast sometimes has one.</p>`));
  body.append(list);
  this.back(body, 'Back', back);
};
// the Lark: her three part places and what they make of her patrol
UI.lark = function (body) {
  const crew = workersOf('mast'), agi = crew.reduce((s, v) => s + statOf(v, 'A'), 0);
  body.append(this.h(`<h2>The Lark’s fittings</h2><p class="sub">Three places for parts on a sunstone courier. With a crew aboard she patrols the rim at night, and goes up when jumpers come.</p>`));
  this.socketBlock(body, 'lark');
  const every = 2.6 / (0.5 + agi * 0.07) / (1 + larkV('aim') / 100), flares = 1 + Math.round(larkV('flares'));
  const chips = [`<span class="chip amber">${flares} flare${flares > 1 ? 's' : ''} a volley</span>`, `<span class="chip">${crew.length ? `A volley every ${every.toFixed(1)} s with this crew` : 'No crew aboard: she stays moored'}</span>`];
  if (larkV('shipSpeed')) chips.push(`<span class="chip">${Math.round(larkV('shipSpeed'))}% faster round the rim</span>`);
  if (larkV('shipGuard')) chips.push(`<span class="chip">Takes ${Math.round(larkV('shipGuard'))}% of jumper volleys</span>`);
  if (larkBoards()) chips.push(`<span class="chip good">Boards downed jumpers</span>`);
  body.append(this.h(`<h3>On patrol</h3><div class="stats-row">${chips.join('')}</div>`));
  this.back(body, 'Back to the mast', () => UI.open('building', TOWN.b.mast));
};

// ----------------------------------------------------------------- the courier at the mast: four pieces and a cell, new each morning
function courierToday() {
  const C = GAME.courier;
  if (C && C.day === GAME.day) return C;
  const ilvl = Math.max(1, Math.round(GAME.nights * 0.8)), cells = Object.keys(D.CELLS), cell = cells[(GAME.day * 7 + 3) % cells.length];
  GAME.courier = { day: GAME.day, stock: LOOT.courierStock(ilvl), cell: { id: cell, price: D.CELLS[cell].price, sold: false } };
  return GAME.courier;
}
function courierBuy(s, p) {
  if (s.sold) return false;
  if (GAME.shards < p) { toast(`That costs ${p} shards. You have ${Math.floor(GAME.shards)}.`); return false; }
  GAME.shards -= p; s.sold = true; addToStash(s.item, false, { line: 'Bought from the courier' }); AUDIO.play('chime'); return true;
}
const courierCut = () => Math.min(0.5, modV(TOWN.b.keep, 'tradeCut') / 100);
const priceOf = p => Math.max(1, Math.round(p * (1 - courierCut())));
UI.courier = function (body) {
  const C = courierToday(), cut = courierCut();
  body.append(this.h(`<h2>The courier’s wares</h2><p class="sub">A courier sets down at the mast each morning with a few things to sell: gear, modules for the buildings, and a sunstone cell. New stock tomorrow.${cut ? ` The Keep’s Trade Ticker knocks ${Math.round(cut * 100)}% off.` : ''}</p>`));
  const list = document.createElement('div'); list.className = 'list';
  for (const s of C.stock) {
    if (s.sold) continue;
    const p = priceOf(s.price), can = GAME.shards >= p;
    // a tap opens the piece to read and compare first; it's bought from there (UI.item in finds.js)
    const row = this.itemRow(s.item, `Buy · ${p}`, () => UI.open('item', { it: s.item, back: () => UI.open('courier'), buy: { price: p, go: () => courierBuy(s, p) } }));
    if (!can) row.classList.add('dim');
    row.querySelector('.side').innerHTML = `${SHARD} ${p}`;
    list.append(row);
  }
  if (!C.cell.sold) {
    const c = D.CELLS[C.cell.id], p = priceOf(C.cell.price), el = document.createElement('button'); el.type = 'button'; el.className = 'irow' + (GAME.shards >= p ? '' : ' dim');
    el.append(cellIcon(C.cell.id, 40));
    el.append(this.h(`<span><span class="nm" style="color:${c.color}">${esc(c.name)}</span><span class="jb">${esc(cellText(C.cell.id))}</span></span><span class="side">${SHARD} ${p}</span>`));
    el.onclick = () => { if (GAME.shards < p) { toast(`That costs ${p} shards.`); return; } GAME.shards -= p; C.cell.sold = true; GAME.cells[C.cell.id] = (GAME.cells[C.cell.id] || 0) + 1; toast(`Bought a <b>${esc(c.name)}</b>. Odile fits cells at her bench.`); AUDIO.play('chime'); UI.refresh(); };
    list.append(el);
  }
  if (!list.children.length) list.append(this.h(`<p class="small">Sold out. The courier will be back in the morning.</p>`));
  body.append(list);
  this.back(body, 'Back to the mast', () => UI.open('building', TOWN.b.mast));
};

// ----------------------------------------------------------------- saving
function fitSave() { return { sockets: GAME.sockets, capacitor: GAME.capacitor || 0, courier: GAME.courier, lootN: GAME.lootN || 0, assayDay: FIT.dayAssay }; }
function fitLoad(s) {
  if (s) { GAME.sockets = s.sockets || {}; GAME.capacitor = s.capacitor || 0; GAME.courier = s.courier || null; GAME.lootN = s.lootN || 0; FIT.dayAssay = s.assayDay || 0; }
  // anything fitted to a building that is no longer there goes back to the stash
  for (const id of Object.keys(GAME.sockets)) { if (buildingById(id)) continue; for (const it of GAME.sockets[id]) if (it) GAME.stash.unshift(it); delete GAME.sockets[id]; }
  allProps();
}
