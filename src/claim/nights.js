// ===================================================================== NIGHTS: the shape of a night
// Every night has a name and a shape. At dusk a banner names it ("Night 7 · The Lodestars walk") and says what is
// coming. The Wildlight come in waves, each up its own stretch of cliff: amber streaks climbing out of the cloud sea,
// then spilling over the rim. Where they climb changes from night to night, so where the turrets stand matters.
// Every fifth night is a Bright Night, with a boss and its health bar along the top: a great Lodestar that drinks the
// lamps around it, or (later, or once the deep seam is open) a Brightmaw that charges the wall.
// Harm shows: wall sections crack, then fall; lamps go out in a puff of smoke; drained yards dim; the hurt limp home
// to the Keep. By day the watch mends the wall. At dawn a card says how the night went (a short line on quiet nights).
const NIGHT = { plan: null, last: null, grudge: null, bossDowned: { lodestar: 0, brightmaw: 0 }, seamWoke: false, shake: 0, shakeOff: new THREE.Vector3(), markers: [], miniT: 0 };
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
// which way a point lies from the middle of the claim (north is −z)
const compassOf = (x, z) => COMPASS[((Math.round(Math.atan2(x, -z) / (Math.PI / 4)) % 8) + 8) % 8];
const sideOf = i => { const [x, z] = OUTLINE[clamp(Math.round(i), 0, OUTLINE.length - 1)]; return compassOf(x, z); };
const BOSSES = {
  lodestar: { name: 'The Lantern-Eye', sub: 'a great Lodestar · it drinks the light of every lamp near it', scale: 2.3, width: 2.1, hp: n => 260 + n * 28, climb: 3.2 },
  brightmaw: { name: 'The Brightmaw', sub: 'up from the deep seam · it charges the wall, and drinks the lamps', scale: 3.0, width: 2.6, hp: n => 350 + n * 38, climb: 3.0 },
};
// what the claim has to lose: its stores and what it has built
function wealthK() {
  let v = GAME.shards;
  for (const b of Object.values(TOWN.b)) if (!b.pending && b.level) v += (BUY[b.type] || 80) * b.level * 0.5;
  return clamp(v / 1500, 0, 1);
}
const plural = (k, n) => n === 1 ? WL_KINDS[k].name : WL_KINDS[k].plural;
function kindList(counts) {
  const parts = ['glimmer', 'flarehound', 'lodestar', 'brightmaw'].filter(k => counts[k]).map(k => `${counts[k]} ${plural(k, counts[k])}`);
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || 'none';
}

// ----------------------------------------------------------------- the plan for a night, made at dusk
function planNight(n) {
  const R = mulberry(n * 7919 + 13), deep = TOWN.b.head && TOWN.b.head.level >= 2;
  const L = OUTLINE.length, lo = 9, hi = L - 10, span = hi - lo, spread = Math.round(L * 0.045);
  const seamBoss = deep && !NIGHT.seamWoke;
  const SN = storyNight(n);   // a night the story asks for: the Long Bright Night (acttwo.js)
  const G = SN ? (NIGHT.grudge && NIGHT.grudge.name === SN.name ? NIGHT.grudge : null)
    : n % 5 === 0 && !seamBoss ? NIGHT.grudge : null;   // a boss that got away comes back on the next Bright Night
  const bright = n % 5 === 0 || seamBoss || !!SN;
  // the threat grows with the night count and with what the claim has to lose
  const w = wealthK(), T = paceThreat(n);   // from chapter 8, harder with the claim's wealth and its nights (pace.js)
  let budget = n <= 1 ? 3 : 2 + (n - 1) * 2.2 + w * (1 + n * 0.3) + (deep ? 3 : 0) + T.add;
  if (bright) budget *= SN ? SN.budgetK : T.brightK;   // the boss is most of a Bright Night
  const share = [['glimmer', 1]];
  if (n >= 3) share.push(['flarehound', n >= 6 ? 1 : 0.6]);
  if (n >= (deep ? 4 : 6)) share.push(['lodestar', n >= 10 ? 0.5 : 0.3]);
  const units = [];
  const firstOf = n === 3 ? 'flarehound' : n === (deep ? 4 : 6) ? 'lodestar' : null;   // a new kind shows itself at least once
  if (firstOf) { units.push(firstOf); budget -= WL_KINDS[firstOf].cost; }
  const tot = share.reduce((s, x) => s + x[1], 0);
  for (let guard = 0; budget > 0.5 && units.length < T.cap && guard < 200; guard++) {
    let r = R() * tot, k = share[0][0]; for (const [kk, wt] of share) { r -= wt; if (r <= 0) { k = kk; break; } }
    if (WL_KINDS[k].cost > budget + 0.6) k = 'glimmer';
    units.push(k); budget -= WL_KINDS[k].cost;
  }
  if (!units.length) units.push('glimmer');
  // waves: one on the first night, two early on, three later; each up its own cliff
  const nw = n <= 1 ? 1 : n < 5 ? 2 : 3;
  const t0s = nw === 1 ? [0.7] : nw === 2 ? [0.7, 0.81] : [0.695, 0.775, 0.855];
  const parts = nw === 1 ? [1] : nw === 2 ? [0.45, 0.55] : [0.3, 0.32, 0.38];
  const sides = [lo + R() * span];
  while (sides.length < nw) {
    let c, tries = 0;
    do { c = lo + R() * span; tries++; } while (tries < 20 && sides.some(s => Math.abs(s - c) < span * 0.28));
    sides.push(c);
  }
  // the strongest go last; the deep seam sends some up the shaft
  units.sort((a, b) => WL_KINDS[a].cost - WL_KINDS[b].cost);
  const waves = [];
  let at = 0;
  for (let i = 0; i < nw; i++) {
    const take = i === nw - 1 ? units.length - at : Math.round(units.length * parts[i]);
    const list = units.slice(at, at + take).map(k => ({ kind: k, at: deep && R() < 0.35 ? 'seam' : null })); at += take;
    for (let j = list.length - 1; j > 0; j--) { const q = (R() * (j + 1)) | 0; [list[j], list[q]] = [list[q], list[j]]; }
    waves.push({ t0: t0s[i], center: sides[i], spread, side: sideOf(sides[i]), units: list, gap: clamp(0.02 / Math.max(1, list.length), 0.0012, 0.006) });
  }
  // a Bright Night's boss: last wave, first up
  let boss = null;
  if (bright) {
    const kind = G ? G.kind : SN ? SN.kind : (seamBoss || deep || n >= 10) ? 'brightmaw' : 'lodestar', B = SN ? { ...BOSSES[SN.kind], ...SN } : BOSSES[kind];
    const maxHp = G ? G.maxHp : Math.round(B.hp(n) * (SN ? SN.hpK : T.bossK));   // the story's own nights set their boss's strength
    boss = { kind, name: G ? G.name : B.name, sub: B.sub, scale: B.scale, width: B.width, climb: B.climb, maxHp, hp: G ? Math.min(maxHp, Math.round(maxHp * (G.frac + 0.1))) : maxHp, from: SN ? SN.from : seamBoss && !G ? 'seam' : null, grudge: !!G };
    const wv = waves[Math.min(1, waves.length - 1)];
    wv.units.unshift({ kind, at: boss.from, boss });
    wv.t0 = Math.min(wv.t0, nw === 1 ? 0.7 : 0.735);
  }
  // its name, and a line on what is coming
  const counts = {}; for (const u of units) counts[u] = (counts[u] || 0) + 1;
  const wx = WEATHER.today, first = waves[0].side;
  let title, line;
  if (SN) { title = SN.title; line = G ? `${SN.line} It got away once, and it is still hurt.` : SN.line; }
  else if (n <= 1) { title = 'The first night'; line = `A few Glimmers will climb the ${first} cliffs, drawn by the lamps. The watch and the Lark will meet them.`; }
  else if (boss && boss.grudge) { title = `${boss.name} returns`; line = `It got away, and it remembers. It climbs again tonight, still wounded, with ${kindList(counts)}.`; }
  else if (boss) {
    title = 'A Bright Night';
    line = boss.kind === 'lodestar' ? `${boss.name}, a great Lodestar, climbs the ${waves[Math.min(1, waves.length - 1)].side} cliffs tonight. It drinks the light from every lamp near it. Bring it down for what it swallowed.`
      : boss.from === 'seam' ? 'The deep seam is open, and something huge is climbing the mine shaft. Every light on the claim will draw it.'
      : `A Brightmaw is climbing the ${waves[Math.min(1, waves.length - 1)].side} cliffs. It will charge the wall.`;
  } else {
    title = counts.lodestar ? 'The Lodestars walk' : n === 3 ? 'The Flarehounds come' : counts.flarehound ? 'Flarehounds on the rim' : 'Sparks on the rim';
    if (wx === 'fog') title = 'Fog on the rim'; else if (wx === 'storm') title = 'A storm night'; else if (wx === 'rain' && !counts.lodestar) title = 'Rain on the rim';
    line = `${nw === 2 ? 'Two waves' : 'Three waves'}: ${kindList(counts)}. The first climbs the ${first} cliffs.`;
    if (firstOf === 'flarehound') line += ' New tonight: Flarehounds. They chew through walls.';
    if (firstOf === 'lodestar') line += ' New tonight: Lodestars, with something swallowed glowing in their chests.';
  }
  if (wx === 'fog') line += ' In the fog the towers won’t see them until they’re close.';
  if (wx === 'storm') line += ' Lightning will strike the claim.';
  if (deep && !boss) line += ' Some will come up the mine shaft.';
  return { n, deep, bright, boss, waves, counts, title, line, seamBoss, shown: false, hpK: T.hpK, drinkK: T.drinkK };
}

// ----------------------------------------------------------------- dusk: name the night
function nightDusk() {
  beaconDusk();   // the sun beacon, if it's kept lit every night (pace.js)
  if (!NIGHT.plan || NIGHT.plan.n !== GAME.nights + 1) nightLookout(true);
  showBanner(NIGHT.plan);
  AUDIO.play('bell');
}
// in the afternoon the lookout sees the glow gathering in the cloud under the cliffs: there's time to move turrets
function nightLookout(quiet) {
  const P = NIGHT.plan = planNight(GAME.nights + 1);
  NIGHT.markers = P.waves.map((w, i) => {
    const boss = w.units.find(u => u.boss), seam = w.units.every(u => u.at === 'seam');
    return seam ? null : { pos: cliffAt(w.center, 0, 0.6), label: boss ? boss.boss.name : P.waves.length > 1 ? `Wave ${i + 1}` : 'Tonight', until: w.t0 + 0.05, boss: !!boss };
  }).filter(Boolean);
  if (quiet) return;
  const bw = P.waves.find(w => w.units.some(u => u.boss)), B = bw && bw.units.find(u => u.boss).boss;
  toast(B ? (B.from === 'seam' ? `<b>The lookout:</b> the deep seam is glowing brighter than the sun. Something is coming up the shaft tonight.` : `<b>The lookout:</b> something huge is glowing under the <b>${bw.side}</b> cliffs. ${esc(B.name)} climbs tonight.`)
    : `<b>The lookout</b> sees glow gathering under the <b>${P.waves[0].side}</b> cliffs${P.waves.length > 1 ? ` and the ${andList(P.waves.slice(1).map(w => w.side))}` : ''}. That’s where they’ll climb tonight.`, 'night');
  for (const w of P.waves) if (w.units.some(u => u.at !== 'seam')) cloudGlow(cliffAt(w.center, -31, 3).setY(-33), 40);
}
function nightBegin() {
  const n = GAME.nights, P = NIGHT.plan && NIGHT.plan.n === n ? NIGHT.plan : planNight(n);
  NIGHT.plan = null;
  if (!P.shown) showBanner(P);
  if (P.seamBoss) NIGHT.seamWoke = true;
  if (P.boss && P.boss.grudge) NIGHT.grudge = null;
  WL.night = { n, title: P.title, bright: P.bright, deep: P.deep, hpK: P.hpK || 1, drinkK: P.drinkK || 1, waves: P.waves.map(w => ({ ...w, units: w.units.slice(), next: w.t0, warned: false })),
    spawned: 0, downed: 0, drained: 0, lamps: 0, relit: 0, walls: 0, breaches: 0, wallHit: [], spent: 0, kinds: {}, dmg: {}, hurt: [], drops: [], mats: {}, dropShards: 0,
    boss: null, bossName: P.boss && P.boss.name, bossKind: P.boss && P.boss.kind, bossKilled: false, bossEscaped: false, shards0: GAME.shards, strikes: 0 };
}
// the waves: a warning a few seconds out, then one by one up the cliff
function nightWaves(N, dt) {
  const t = TOD.t; if (t > 0.95 || t < 0.6) return;
  N.waves.forEach((w, i) => {
    if (!w.warned && t >= w.t0 - 0.02) { w.warned = true; waveWarn(N, w, i); }
    while (w.units.length && t >= w.next) {
      const u = w.units.shift(); w.next += w.gap;
      const at = u.at === 'seam' ? 'seam' : w.center + (Math.random() - 0.5) * 2 * w.spread;
      if (u.boss) { const f = spawnWildlight(u.kind, at, { boss: true, hp: u.boss.hp, maxHp: u.boss.maxHp, scale: u.boss.scale, width: u.boss.width, climb: u.boss.climb, name: u.boss.name }); f.bossDef = u.boss; f.pulseCd = 6; f.chargeCd = 0; N.boss = f; bossBar(f, true); toast(`<b>${esc(u.boss.name)}</b> is climbing ${u.at === 'seam' ? 'the mine shaft' : `the ${w.side} cliffs`}!`, 'night'); }
      else { const f = spawnWildlight(u.kind, at); if (N.hpK > 1) { f.hp *= N.hpK; f.maxHp = f.hp; } }   // tougher as the claim grows (paceThreat)
      w.started = true;
    }
  });
}
function waveWarn(N, w, i) {
  const seam = w.units.some(u => u.at === 'seam'), cliff = w.units.some(u => u.at !== 'seam');
  const where = cliff ? `the ${w.side} cliffs${seam ? ' and the mine shaft' : ''}` : 'the mine shaft';
  if (N.waves.length > 1 || N.n <= 1) toast(`${N.waves.length > 1 ? `<b>Wave ${i + 1} of ${N.waves.length}</b> is` : '<b>Wildlight</b> are'} climbing ${where}.`, 'night');
  if (cliff) {
    const p = cliffAt(w.center, 0, 0.6), boss = w.units.find(u => u.boss);
    if (!NIGHT.markers.some(m => m.pos.distanceTo(p) < 1)) NIGHT.markers.push({ pos: p, label: boss ? boss.boss.name : `Wave ${i + 1}`, until: w.t0 + 0.05, boss: !!boss });
    cloudGlow(cliffAt(w.center, -31, 3).setY(-33));
  }
  AUDIO.play('wave', cliff ? cliffAt(w.center, 0, 0) : null);   // the watch bell, rung fast
}

// ----------------------------------------------------------------- who did the damage, and what dropped
function nightCredit(src, dealt) {
  const N = WL.night; if (!N || !src || !(dealt > 0)) return;
  let key = null;
  if (src === 'lark' || src === 'storm') key = src;
  else if (src.d && src.d.id != null) key = 'v' + src.d.id;
  else if (src.type === 'lens') key = 'b' + src.id;
  else if (src.type === 'ballista') key = 'ballistas';
  if (key) N.dmg[key] = (N.dmg[key] || 0) + dealt;
}
function nightDowned(f) {
  const N = WL.night;
  if (N) { N.downed++; const k = N.kinds[f.kind] || (N.kinds[f.kind] = { spawned: 0, downed: 0 }); k.downed++; }
  if (f.boss) return bossDown(f);
  nightDrop(f.kind, f);
}
// what a Wildlight leaves: shards, sometimes materials or a piece of gear. Rare finds get a toast; all go in the report.
function nightDrop(kind, f, ctx = {}) {
  const N = WL.night;
  const r = LOOT.foeDrops(kind, { night: Math.max(1, GAME.nights), deep: TOWN.b.head.level >= 2, ...ctx });
  GAME.shards += r.shards || 0; if (N) N.dropShards += r.shards || 0;
  for (const [k, n] of Object.entries(r.materials || {})) { GAME.mats[k] = (GAME.mats[k] || 0) + n; if (N) N.mats[k] = (N.mats[k] || 0) + n; }
  for (const b of r.blueprints || []) if (!GAME.blueprints.includes(b)) GAME.blueprints.push(b);
  for (const raw of r.items || []) {
    const it = addToStash(raw, true, { pos: f && f.pos.clone().setY(Math.max(0, f.pos.y)) });   // Signed and up get a beam and their own toast (finds.js)
    if (N) N.drops.push(it);
    if ((!N || D.RARITY_ORDER.indexOf(it.rarity) >= D.RARITY_ORDER.indexOf('tuned')) && LOOT.rankOf(it.rarity) < 4) toast(`Found: <b style="color:${rarityOf(it).color}">${esc(it.name)}</b>`);
  }
  if (f && (r.items || []).length) FX.sparks(f.pos.clone().setY(1), 18, 0xfff0c0, 2);
  return r;
}

// ----------------------------------------------------------------- bosses
function bossBar(f, show) {
  const el = hudEl('bossbar', `<div class="bb-name"><b></b><span></span></div><div class="bb-track"><i class="bb-lag"></i><i class="bb-fill"></i></div>`);
  if (!show) { el.classList.add('out'); setTimeout(() => { if (el.classList.contains('out')) { el.hidden = true; $('#app').classList.remove('boss-on'); } }, 600); return; }
  el.hidden = false; el.classList.remove('out', 'won'); $('#app').classList.add('boss-on');
  el.querySelector('b').textContent = f.name; el.querySelector('span').textContent = f.bossDef ? f.bossDef.sub : '';
  bossHurt(f, 0);
}
function bossHurt(f) {
  const el = document.getElementById('bossbar'); if (!el || el.hidden) return;
  const k = clamp(f.hp / f.maxHp, 0, 1);
  el.querySelector('.bb-fill').style.width = (k * 100).toFixed(1) + '%';
  el.querySelector('.bb-lag').style.width = (k * 100).toFixed(1) + '%';
  el.classList.toggle('low', k < 0.3);
}
// what a boss does on the plateau. Returns false to let it hunt as usual, 'hold' to stand, 'run' while it charges.
function bossTick(f, dt) {
  if (f.mode !== 'hunt' || f.leaving) { f.charge = 0; return false; }
  if (f.roarT > 0) { f.roarT -= dt; f.roar = Math.sin(clamp(1 - f.roarT / 1.3, 0, 1) * Math.PI); return 'hold'; }
  f.roar = 0;
  // the Brightmaw's charge: it crouches, glows, and throws itself at the wall
  if (f.kind === 'brightmaw' && f.from !== 'seam') {
    if (f.dash) {
      const s = f.dash, d = new THREE.Vector3(s.mx - f.pos.x, 0, s.mz - f.pos.z), L = d.length();
      if (L < 1.4 || s.broken) { bossSlam(f, s); return 'hold'; }
      d.normalize(); f.vel.copy(d); f.pos.addScaledVector(d, Math.min(L, 13 * dt)); f.pos.y = 0;
      if (Math.random() < dt * 30) FX.puff(f.pos.clone().setY(0.3), 1, 0xc8b898, 1.2);
      return 'run';
    }
    if (f.windup > 0) {
      f.windup -= dt; f.crouch = 1; f.charge = 1 - f.windup / 1.3;
      const s = f.dashSeg; f.vel.set(s.mx - f.pos.x, 0, s.mz - f.pos.z).normalize();
      if (Math.random() < dt * 12) FX.puff(f.pos.clone().setY(0.2), 1, 0xb0a080, 1.5);
      if (f.windup <= 0) { f.dash = s; f.crouch = 0; }
      return 'hold';
    }
    f.chargeCd -= dt;
    if (f.chargeCd <= 0) {
      f.chargeCd = 1;
      let best = null, bd = 11;
      for (const s of WALL.segs) { if (s.broken) continue; const d = Math.hypot(s.mx - f.pos.x, s.mz - f.pos.z); if (d < bd && Math.hypot(s.mx, s.mz) < Math.hypot(f.pos.x, f.pos.z) + 1.5) { bd = d; best = s; } }
      if (best) { f.windup = 1.3; f.dashSeg = best; AUDIO.play('bossroar', f.pos); return 'hold'; }
    }
  }
  // the light-drinking pulse: it gathers the light in, then throws it out and every lamp in reach goes dark
  if (f.pulseT > 0) {
    f.pulseT -= dt; f.charge = 1 - f.pulseT / 1.5;
    if (!f.gathered) { f.gathered = true; pulseRing(f.pos, pulseR(f), -1.5); }
    if (f.pulseT <= 0) { f.gathered = false; bossPulse(f); }
    return 'hold';
  }
  f.pulseCd -= dt;
  if (f.pulseCd <= 0 && f.pos.y > -0.5) {
    const R = pulseR(f);
    if (DECOR.lamps.some(L => L.lit && Math.hypot(L.x - f.pos.x, L.z - f.pos.z) < R) || byType('yard').some(b => Math.hypot(b.L.x - f.pos.x, b.L.z - f.pos.z) < R + 4)) { f.pulseT = 1.5; return 'hold'; }
    f.pulseCd = 1.5;
  }
  f.charge = Math.max(0, (f.charge || 0) - dt * 2); f.crouch = 0;
  return false;
}
const pulseR = f => f.kind === 'brightmaw' ? 17 : 14;
function bossPulse(f) {
  const N = WL.night, R = pulseR(f);
  let n = 0;
  for (const L of DECOR.lamps) if (L.lit && Math.hypot(L.x - f.pos.x, L.z - f.pos.z) < R) { snuffLamp(L, f); n++; }
  for (const b of byType('yard')) if (Math.hypot(b.L.x - f.pos.x, b.L.z - f.pos.z) < R + 4) {
    const take = Math.min(GAME.shards, 6 * (N && N.drinkK || 1)); GAME.shards -= take; if (N) N.drained += take; b.drained = (b.drained || 0) + take; b.drainK = 1;
    FX.sparks(b.worldPos(0, 1, 0), 12, 0xffc070, 2.5);
  }
  f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.01 * n); bossHurt(f);
  f.pulseCd = f.kind === 'brightmaw' ? 15 : 11; f.charge = 0;
  pulseRing(f.pos, R, 0.7);
  FX.sparks(f.pos.clone().setY(1.5 * f.root.scale.x), 30, 0xffe0a0, 6);
  camShake(0.35); AUDIO.play('snuff', f.pos);
  WL.flowT = 0;
}
function bossSlam(f, s) {
  f.dash = null; f.windup = 0; f.charge = 0; f.chargeCd = 18;
  const i = WALL.segs.indexOf(s);
  wallHit(s, 2, f);
  for (const j of [i - 1, i + 1]) if (WALL.segs[j]) wallHit(WALL.segs[j], 0.55, f);
  const p = new THREE.Vector3(s.mx, 1.2, s.mz);
  FX.sparks(p, 40, 0xffd090, 7); FX.puff(p, 14, 0xb8a888, 2.2);
  camShake(1); AUDIO.play('wallhit', p);
  toast(`<b>${esc(f.name)}</b> has smashed through the ${compassOf(s.mx, s.mz)} wall!`, 'night');
}
// over the rim: a boss roars, and the camera feels it
function wlCrest(f) {
  if (!f.boss) return;
  f.roarT = 1.3; camShake(0.6); AUDIO.play('bossroar', f.pos);
  toast(`<b>${esc(f.name)}</b> is over the rim!`, 'night');
}
function bossDown(f) {
  const N = WL.night, B = f.bossDef || {};
  if (N) { N.bossName = f.name; N.bossKind = f.kind; }
  NIGHT.bossDowned[f.kind] = (NIGHT.bossDowned[f.kind] || 0) + 1;
  const first = NIGHT.bossDowned[f.kind] === 1;
  if (N) N.bossKilled = true;
  const ctx = { grudge: !!B.grudge };
  const r = nightDrop(f.kind, f, ctx);
  if (f.kind === 'lodestar') nightDrop('lodestar', f, ctx);   // everything it swallowed
  const bonus = f.kind === 'brightmaw' ? 150 : 60;
  GAME.shards += bonus; if (N) N.dropShards += bonus;
  // the first Brightmaw brought down always gives up a Masterwork; after night 20 it may hold the Worldforge Engine
  const extra = [];
  if (f.kind === 'brightmaw' && first) { const pool = Object.values(D.RELICS).filter(x => x.rarity === 'masterwork' && GEAR_SLOTS.includes(x.slot)); if (pool.length) extra.push(LOOT.makeRelic(pool[(Math.random() * pool.length) | 0].id, 'the first Brightmaw')); }
  if (f.kind === 'brightmaw' && GAME.nights >= 20 && Math.random() < 0.25 && D.RELICS['worldforge-engine']) extra.push(LOOT.makeRelic('worldforge-engine', 'a Brightmaw'));
  for (const raw of extra) { const it = addToStash(raw, true, { pos: f.pos.clone().setY(Math.max(0, f.pos.y)), line: `${f.name} gave it up` }); if (N) N.drops.push(it); }
  FX.sparks(f.pos.clone().setY(1.5 * f.root.scale.x), 80, 0xfff0c0, 8);
  camShake(0.9); AUDIO.play('crack');
  toast(`${f.name === WARDEN.name ? `<b>${esc(f.name)} is calm</b>, and sinks back down the shaft.` : `<b>${esc(f.name)} is down!</b>`} It leaves ${SHARD} ${bonus + (r.shards || 0)}${(r.items || []).length + extra.length ? ' and what it swallowed' : ''}.`, 'night');
  const el = document.getElementById('bossbar'); if (el) el.classList.add('won');
  setTimeout(() => bossBar(f, false), 1800);
}
// dawn and the boss still standing: it goes back down the cliff, and it will be back
function bossRetreat(f) {
  const N = WL.night, B = f.bossDef || {};
  NIGHT.grudge = { kind: f.kind, name: f.name, frac: clamp(f.hp / f.maxHp, 0.05, 1), maxHp: f.maxHp };
  if (N) { N.bossEscaped = true; N.bossName = f.name; N.bossKind = f.kind; }
  let bi = 9, bd = 1e9; for (let i = 9; i < OUTLINE.length - 10; i++) { const d = Math.hypot(OUTLINE[i][0] - f.pos.x, OUTLINE[i][1] - f.pos.z); if (d < bd) { bd = d; bi = i; } }
  const down = climbRoute(bi).reverse();
  f.leaving = true; f.mode = 'route'; f.route = down; f.inward = down.inward.clone().negate(); f.feeding = false; f.dash = null; f.windup = 0; f.pulseT = 0;
  void B;
  bossBar(f, false);
}

// ----------------------------------------------------------------- people: the Wildlight bite back
function wlBite(f, dt) {
  if (f.air || f.leaving) return;
  const reach = 1.1 + 0.55 * f.root.scale.x;
  let v = f.biting;
  if (!v || v.hidden || v.hurt || v.where !== 'surface' || Math.hypot(v.pos.x - f.pos.x, v.pos.z - f.pos.z) > reach) {
    v = null;
    for (const p of GAME.villagers) { if (p.hidden || p.hurt || p.where !== 'surface' || p.d.exp) continue; if (Math.hypot(p.pos.x - f.pos.x, p.pos.z - f.pos.z) < reach) { v = p; break; } }
    f.biting = v;
  }
  if (!v) return;
  const guard = clamp((gearOf(v).guard || 0) / 100, 0, 0.7);
  v.harm = (v.harm || 0) + f.K.bite * dt * (1 - guard) * (f.boss ? 1.6 : 1);
  if (Math.random() < dt * 4) FX.sparks(v.pos.clone().setY(1.1), 3, 0xffb070, 1.4);
  if (v.harm >= maxHpOf(v) * 0.6) hurtVillager(v);
}
function hurtVillager(v) {
  v.hurt = true; v.harm = 0; v.fighting = false;
  const N = WL.night; if (N && !N.hurt.includes(v.d.name)) N.hurt.push(v.d.name);
  const walk = walkTo(v, homeEntry(v)); walk.limp = true;
  v.plan = [walk, { type: 'enter' }, { type: 'sleep' }];
  toast(`<b>${esc(v.d.name.split(' ')[0])}</b> is hurt, and limping back to the Keep.`, 'night');
  AUDIO.play('hit');
}

// ----------------------------------------------------------------- lamps
function snuffLamp(L, by) {
  if (!L.lit) return;
  L.lit = false; L.tend = 0;
  const N = WL.night; if (N) N.lamps++;
  const p = new THREE.Vector3(L.x, 2.98, L.z);
  FX.sparks(p, 8, 0xffc070, 1.6);
  FX.puff(p, 5, 0x4e4844, 0.45);
  for (let i = 0; i < 3; i++) FX.smoke(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1 * i, (Math.random() - 0.5) * 0.3)), 0x3e3a3a);
  void by;   // (the sound: audio.js hears a lamp go out by itself)
}
function relightLamp(L) {
  if (L.lit) return;
  L.lit = true; L.tend = 0;
  const N = WL.night; if (N) N.relit++;
  FX.sparks(new THREE.Vector3(L.x, 2.98, L.z), 10, 0xffe0a0, 1.2);
  AUDIO.play('chime');
}

// ----------------------------------------------------------------- the wall: cracks, then a gap; mended by day
const wallStage = s => s.broken ? 3 : s.hp > 0.7 ? 0 : s.hp > 0.35 ? 1 : 2;
function wallHit(s, amt, by) {
  if (!s || s.broken) return;
  const N = WL.night, i = WALL.segs.indexOf(s);
  s.hp = Math.max(0, s.hp - amt);
  if (N && !N.wallHit.includes(i)) N.wallHit.push(i);
  if (s.hp <= 0) {
    s.broken = true; s.hp = 0; s.stage = 3;
    wallMatrices(); buildNav(); WL.flowT = 0;
    const p = new THREE.Vector3(s.mx, 1.2, s.mz);
    FX.puff(p, 10, TOWN.wallLevel >= 2 ? 0xa89c8c : 0x8a6a4a, 1.6); FX.sparks(p, 12, 0xffc070, 3);
    AUDIO.play('wallhit', p); AUDIO.play('crack', p);
    if (N) { N.breaches++; N.walls++; }
    if (!(by && by.boss)) toast(`Wildlight have broken through the ${compassOf(s.mx, s.mz)} wall.`, 'night');
    return;
  }
  const st = wallStage(s);
  if (st !== (s.stage || 0)) { s.stage = st; wallMatrices(); const q = new THREE.Vector3(s.mx, 1.6, s.mz); FX.puff(q, 5, TOWN.wallLevel >= 2 ? 0xa89c8c : 0x8a6a4a, 1); AUDIO.play('wallhit', q); }
}
// the cracks and rubble, drawn over the wall (called from wallMatrices)
const WDMG = { cracks: null, stones: null, logs: null };
function crackTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const R = mulberry(31337);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const crack = (x, y, ang, len, w, depth) => {
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < 6; i++) { ang += (R() - 0.5) * 0.9; x += Math.cos(ang) * len / 6; y += Math.sin(ang) * len / 6; g.lineTo(x, y); }
    g.lineWidth = w; g.stroke();
    if (depth > 0) for (let k = 0; k < 2; k++) crack(x, y, ang + (R() - 0.5) * 1.6, len * 0.55, w * 0.6, depth - 1);
  };
  g.strokeStyle = 'rgba(28,18,16,0.95)';
  for (let i = 0; i < 4; i++) crack(30 + R() * 196, 4 + R() * 20, Math.PI / 2 + (R() - 0.5) * 0.8, 60 + R() * 40, 3.2, 2);
  g.strokeStyle = 'rgba(255,190,120,0.35)'; g.lineWidth = 1.2;   // a little light caught in the deepest
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(40 + R() * 180, 30 + R() * 40); g.lineTo(60 + R() * 140, 70 + R() * 50); g.stroke(); }
  return canvasTex(c);
}
function wallDamageDraw() {
  const segs = WALL.segs, n = segs.length; if (!n) return;
  if (!WDMG.cracks) {
    const geo = new THREE.PlaneGeometry(1, 1);
    WDMG.cracks = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), n * 2);
    const sg = projUV(new THREE.DodecahedronGeometry(0.42, 0), 1);
    WDMG.stones = new THREE.InstancedMesh(sg, MAT.stone, n * 6);
    const lg = new THREE.CylinderGeometry(0.16, 0.19, 2.2, 6).rotateZ(Math.PI / 2);
    WDMG.logs = new THREE.InstancedMesh(lg, MAT.oak, n * 4);
    for (const m of [WDMG.cracks, WDMG.stones, WDMG.logs]) { m.frustumCulled = false; scene.add(m); }
    WDMG.stones.castShadow = WDMG.logs.castShadow = true; WDMG.stones.receiveShadow = WDMG.logs.receiveShadow = true;
  }
  const stone = TOWN.wallLevel >= 2 || (segs[0] && segs[0].k2 > 0.5);
  segs.forEach((s, i) => {
    const st = wallStage(s), dmg = s.broken ? 1 : 1 - s.hp;
    // cracks on both faces of a damaged stone section; wider as it gets worse
    for (const side of [-1, 1]) {
      const show = stone && !s.broken && st > 0, k = st >= 2 ? 1 : 0.6;
      _we.set(0, -s.ang + (side < 0 ? Math.PI : 0), 0); _wq.setFromEuler(_we);
      const ox = -Math.sin(s.ang) * 0.57 * side, oz = Math.cos(s.ang) * 0.57 * side;
      _wm.compose(_wp.set(s.mx + ox, 1.25, s.mz + oz), _wq, _ws.set(show ? s.len * k : 0, show ? 2.3 * (0.6 + k * 0.4) : 0, 1));
      WDMG.cracks.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), _wm);
    }
    // rubble where it has fallen: stone blocks, or split logs from the palisade
    for (let k = 0; k < 6; k++) {
      const h1 = hash2(i * 7 + k, 3), h2 = hash2(i * 7 + k, 9), t = (k + 0.5) / 6 + (h1 - 0.5) * 0.1, side = (h2 - 0.5) * 2.6;
      const x = lerp(s.a[0], s.b[0], t) - Math.sin(s.ang) * side, z = lerp(s.a[1], s.b[1], t) + Math.cos(s.ang) * side;
      const show = stone && (s.broken || (st >= 2 && k < 2));
      _we.set(h1 * 3, h2 * 6, h1 * h2 * 4); _wq.setFromEuler(_we);
      _wm.compose(_wp.set(x, 0.15, z), _wq, _ws.setScalar(show ? 0.7 + h2 * 0.7 : 0)); WDMG.stones.setMatrixAt(i * 6 + k, _wm);
      if (k < 4) {
        const showL = !stone && (s.broken || (st >= 2 && k < 1));
        _we.set(0, s.ang + (h1 - 0.5) * 1.4, 0); _wq.setFromEuler(_we);
        _wm.compose(_wp.set(x, 0.18 + (k % 2) * 0.22, z), _wq, _ws.setScalar(showL ? 0.8 + h2 * 0.4 : 0)); WDMG.logs.setMatrixAt(i * 4 + k, _wm);
      }
    }
    void dmg;
  });
  for (const m of [WDMG.cracks, WDMG.stones, WDMG.logs]) m.instanceMatrix.needsUpdate = true;
}
// by day the watch walks to the worst section and mends it, a little shard at a time
function wallRepairSpot(v) {
  if (TOD.phase === 'night' || TOD.phase === 'dusk' || WL.list.some(f => !f.dead && !f.air && !f.leaving)) { v.repairSeg = null; return null; }
  let s = v.repairSeg && v.repairSeg.hp < 1 ? v.repairSeg : null;
  if (!s) {
    const taken = new Set(GAME.villagers.filter(w => w !== v && w.repairSeg).map(w => w.repairSeg));
    let best = null, bd = 1e9;
    for (const q of WALL.segs) { if (q.hp >= 1 || taken.has(q)) continue; const d = (q.broken ? 0 : 40) - (1 - q.hp) * 20 + Math.hypot(q.mx - v.pos.x, q.mz - v.pos.z) * 0.4; if (d < bd) { bd = d; best = q; } }
    s = best;
  }
  v.repairSeg = s; if (!s) return null;
  const ix = -Math.sin(s.ang), iz = Math.cos(s.ang); let x = s.mx + ix * 1.6, z = s.mz + iz * 1.6;
  if (!onPlateau(x, z) || distToOutline(x, z) < 3.3) { x = s.mx - ix * 1.6; z = s.mz - iz * 1.6; }
  return { kind: 'surface', pos: new THREE.Vector3(x, 0, z), face: Math.atan2(s.mx - x, s.mz - z) };
}
let repairLookT = 0;
function wallRepairTick(dt) {
  if (TOD.phase === 'night' || TOD.phase === 'dusk') return;
  // the watch looks along the wall every few seconds: anyone idle at their post goes to mend the worst of it
  if ((repairLookT -= dt) <= 0) { repairLookT = 4; if (WALL.segs.some(s => s.hp < 1)) for (const v of workersOf('wall')) if (!v.repairSeg && !v.hurt) v.replan = true; }
  for (const v of GAME.villagers) {
    const s = v.repairSeg; if (!s || !v.working || v.hidden || !v.d.job || v.d.job.bid !== 'wall') continue;
    if (Math.hypot(v.pos.x - s.mx, v.pos.z - s.mz) > 3) continue;
    const rate = 0.03 * (0.5 + statOf(v, 'E') * 0.06 + statOf(v, 'G') * 0.03) * (TOWN.wallLevel >= 2 ? 0.8 : 1), cost = rate * dt * 5;
    if (GAME.shards < cost) continue;
    GAME.shards -= cost; s.hp = Math.min(1, s.hp + rate * dt);
    if (Math.random() < dt * 1.5) FX.puff(new THREE.Vector3(s.mx + (Math.random() - 0.5) * 2, 1.2, s.mz + (Math.random() - 0.5) * 2), 1, 0xc8b898, 0.5);
    if (s.broken && s.hp >= 0.5) { s.broken = false; buildNav(); WL.flowT = 0; }
    const st = wallStage(s); if (st !== (s.stage || 0)) { s.stage = st; wallMatrices(); }
    if (s.hp >= 1) { v.repairSeg = null; v.replan = true; }
  }
}

// ----------------------------------------------------------------- turrets: a charge glow, a muzzle flash
const FLASHES = [];
const flashTex = radialTex('rgba(255,255,245,1)', 'rgba(255,190,110,0)', 64);
function flashSprite() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  s.renderOrder = 6; scene.add(s); return s;
}
function muzzleFlash(p, col, size) {
  let F = FLASHES.find(x => x.t >= x.dur);
  if (!F) { if (FLASHES.length >= 16) F = FLASHES[0]; else { F = { s: flashSprite(), t: 0, dur: 0.14, size }; FLASHES.push(F); } }
  F.t = 0; F.size = size; F.s.position.copy(p); F.s.material.color.set(col); F.s.visible = true;
}
function turretCharge(b, k, muzzle) {
  if (!b.glowS) { b.glowS = flashSprite(); b.glowS.material.color.set(0xffd08a); }
  b.glowS.position.copy(muzzle); b.glowS.visible = k > 0.02;
  b.glowS.material.opacity = k * k * 0.85; b.glowS.scale.setScalar(0.5 + k * 1.4);
  b.coreMat.emissiveIntensity = Math.max(b.coreMat.emissiveIntensity, 0.8 + k * k * 2.6);
}
function flashTick(dt) {
  for (const F of FLASHES) { if (F.t >= F.dur) { F.s.visible = false; continue; } F.t += dt; const k = F.t / F.dur; F.s.scale.setScalar(F.size * (0.6 + k * 0.8)); F.s.material.opacity = 1 - k; }
}
// rings on the ground: a boss gathering light in (negative time: shrinking), or throwing it out
const PULSES = [];
const ringGeo = new THREE.RingGeometry(0.95, 1, 72).rotateX(-Math.PI / 2);
function pulseRing(p, R, dur) {
  let P = PULSES.find(x => x.t >= x.dur);
  if (!P) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide })); m.renderOrder = 5; scene.add(m); P = { m, t: 0, dur: 1 }; PULSES.push(P); }
  P.t = 0; P.dur = Math.abs(dur); P.inward = dur < 0; P.R = R; P.m.position.set(p.x, 0.25, p.z); P.m.visible = true;
}
function pulseTick(dt) {
  for (const P of PULSES) {
    if (P.t >= P.dur) { P.m.visible = false; continue; }
    P.t += dt; const k = clamp(P.t / P.dur, 0, 1), r = P.inward ? P.R * (1 - k * 0.9) : P.R * (0.1 + k * 0.9);
    P.m.scale.set(r, 1, r); P.m.material.opacity = P.inward ? 0.12 + k * 0.35 : (1 - k) * 0.6;
  }
}
// a glow in the cloud sea under the cliff a wave is about to climb
const GLOWS = [];
function cloudGlow(p, dur = 9) {
  let G = GLOWS.find(x => x.t >= x.dur);
  if (!G) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: wlGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffa050, fog: false })); scene.add(s); G = { s, t: 0, dur }; GLOWS.push(G); }
  G.t = 0; G.dur = dur; G.s.position.copy(p); G.s.visible = true;
}
function glowTick(dt) {
  for (const G of GLOWS) { if (G.t >= G.dur) { G.s.visible = false; continue; } G.t += dt; const k = G.t / G.dur; G.s.material.opacity = Math.sin(k * Math.PI) * (0.6 + 0.4 * Math.sin(G.t * 5)); G.s.scale.set(26, 14, 1); }
}

// ----------------------------------------------------------------- the camera feels the biggest hits
function camShake(k) { if (reducedMotion) return; NIGHT.shake = Math.min(1.2, Math.max(NIGHT.shake, k)); }
function shakeCamera(rdt) {
  NIGHT.shakeOff.set(0, 0, 0);
  if (NIGHT.shake < 0.01 || VIEW.mode === 'keep') { NIGHT.shake = 0; return; }
  NIGHT.shake *= Math.exp(-rdt * 4.5);
  const a = NIGHT.shake * 0.5 * clamp(camera.position.distanceTo(controls.target) / 60, 0.4, 2);
  NIGHT.shakeOff.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
  camera.position.add(NIGHT.shakeOff);
}
function unshakeCamera() { camera.position.sub(NIGHT.shakeOff); NIGHT.shakeOff.set(0, 0, 0); }

// ----------------------------------------------------------------- every tick of game time
function nightsTick(dt) {
  flashTick(dt); pulseTick(dt); glowTick(dt);
  if (!WL.night && TOD.t > 0.45 && TOD.t < 0.6 && (!NIGHT.plan || NIGHT.plan.n !== GAME.nights + 1)) nightLookout(false);
  wallRepairTick(dt);
  const night = TOD.phase === 'night';
  // the watch relights a lamp when they pass it
  if (night) for (const L of DECOR.lamps) {
    if (L.lit) continue;
    const near = GAME.villagers.some(v => !v.hidden && !v.hurt && v.where === 'surface' && v.d.job && v.d.job.bid === 'wall' && Math.hypot(v.pos.x - L.x, v.pos.z - L.z) < 2.4);
    if (near) { L.tend = (L.tend || 0) + dt; if (L.tend > 1.5) relightLamp(L); } else L.tend = 0;
  }
  // drained yards dim, and come back as the sun charges them again
  for (const b of byType('yard')) {
    if (!night) b.drained = Math.max(0, (b.drained || 0) - dt * (0.15 + TOD.sunlight * 0.4));
    b.dimK = clamp((b.drained || 0) / 30, 0, 0.85);
    if (b.drainK > 0.5 && Math.random() < dt * 8) FX.mote(b.worldPos((Math.random() - 0.5) * 9, 0.8, (Math.random() - 0.5) * 6), 0xffb050);
  }
  // the hurt: a limp, and a stagger
  for (const v of GAME.villagers) if (v.hurt && v.moving && !v.hidden) { v.sprite.position.y = v.pos.y - Math.abs(Math.sin(v.anim * 5)) * 0.07; v.mat.rotation = Math.sin(v.anim * 5) * 0.07; } else if (v.mat.rotation) v.mat.rotation = 0;
}
// how a yard's crystal glows: dimmer where the Wildlight drank, brighter when lightning supercharged it
const yardMood = (b, night) => -(b.dimK || 0) * (0.25 + night * 0.9) + (b.superT > 0 ? 1.4 : 0);
const yardLightK = b => 1 - (b.dimK || 0) * 0.75 + (b.superT > 0 ? 0.8 : 0);

// ----------------------------------------------------------------- dawn: how the night went
function nightDawn(N) {
  NIGHT.markers = [];
  for (const L of DECOR.lamps) L.lit = true;
  for (const v of GAME.villagers) { v.harm = 0; if (v.hurt) { v.hurt = false; v.mat.rotation = 0; } }
  const R = nightReport(N);
  NIGHT.last = R;
  showDawn(R, R.big);
  const br = WALL.segs.filter(s => s.broken).length, dmg = WALL.segs.filter(s => s.hp < 1).length;
  if (dmg && workersOf('wall').length) for (const v of workersOf('wall')) v.replan = true;
  void br;
}
const firstName = n => String(n).split(' ')[0];
const andList = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
function nightReport(N) {
  const R = { n: N.n, title: N.title, downed: N.downed, spawned: N.spawned, kinds: N.kinds, drained: Math.round(N.drained), spent: Math.round(N.spent), stores: Math.floor(GAME.shards),
    lamps: N.lamps, relit: N.relit, breaches: N.breaches, wallHit: N.wallHit.length, hurt: N.hurt.slice(), drops: N.drops.map(it => ({ name: it.name, color: rarityOf(it).color, rarity: it.rarity })),
    mats: { ...N.mats }, dropShards: Math.round(N.dropShards), boss: N.bossName || null, bossKind: N.bossKind || null, bossKilled: N.bossKilled, bossEscaped: N.bossEscaped, bright: N.bright };
  const dmgNow = WALL.segs.filter(s => s.hp < 1).length, openNow = WALL.segs.filter(s => s.broken).length;
  R.wallNow = dmgNow; R.wallOpen = openNow; R.watch = workersOf('wall').length;
  // who did the most
  let top = null, tv = 0, total = 0;
  for (const [k, v] of Object.entries(N.dmg)) { total += v; if (v > tv) { tv = v; top = k; } }
  let credit = '';
  if (top && tv > total * 0.3) {
    if (top === 'lark') credit = 'The Lark’s flares did most of the work.';
    else if (top === 'storm') credit = 'The lightning did most of the work. Lucky.';
    else if (top === 'ballistas') credit = 'The ballistas did most of the work.';
    else if (top[0] === 'v') { const v = GAME.villagers.find(x => 'v' + x.d.id === top); if (v) credit = `${firstName(v.d.name)} did most of the fighting.`; }
    else if (top[0] === 'b') {
      const b = TOWN.b[top.slice(1)], crew = b ? workersOf(b.id) : [];
      const towers = Object.keys(N.dmg).filter(k => k[0] === 'b').length;
      credit = crew.length ? `${firstName(crew[0].d.name)}’s lens tower did most of the work.` : 'The lens towers did most of the work.';
      void towers;
    }
  }
  // the verdict, in plain words
  let head;
  if (R.bossKilled) head = R.boss === WARDEN.name ? `${R.boss} is calm, and sinks back down the shaft. The Keep stood.` : `${R.boss} is down, and the Keep stood.`;
  else if (R.bossEscaped) head = `${R.boss} went back down the cliff at dawn, wounded. It will be back.`;
  else if (R.drained >= 40) head = `A hard night. They drank ${R.drained} shards from the claim.`;
  else if (R.breaches) head = `They broke through the wall, but the Keep stood.`;
  else if (R.lamps >= 6) head = 'The Keep stood, but half the lamps went dark.';
  else if (R.downed && R.downed === R.spawned && !R.drained && !R.lamps) head = 'Not one of them got near the lights.';
  else if (R.spawned <= 4) head = 'A quiet night. The Keep stood.';
  else head = 'The Keep stood.';
  R.head = head; R.credit = credit;
  const rare = R.drops.some(d => D.RARITY_ORDER.indexOf(d.rarity) >= D.RARITY_ORDER.indexOf('tuned'));
  R.big = N.n <= 1 || R.bright || !!R.boss || R.breaches > 0 || R.hurt.length > 0 || R.drained >= 15 || R.lamps >= 4 || rare;
  return R;
}
// the card (a big night) or a short line under the clock (a quiet one); tap either away
function showDawn(R, big) {
  if (!R) return;
  const card = hudEl('dawn', '');
  const mini = hudEl('dawnmini', '');
  card.hidden = true; mini.hidden = true;
  if (!big) {
    mini.innerHTML = `<b>Dawn · Night ${R.n}</b> ${R.downed} Wildlight downed${R.lamps ? `, ${R.lamps} lamp${R.lamps > 1 ? 's' : ''} out` : ''}${R.drained ? `, ${R.drained} shard${R.drained === 1 ? '' : 's'} drunk` : ''}. ${esc(R.head)} <u>More</u>`;
    mini.hidden = false; NIGHT.miniT = 9;
    mini.onclick = () => { mini.hidden = true; showDawn(R, true); };
    return;
  }
  const kinds = ['glimmer', 'flarehound', 'lodestar', 'brightmaw'].filter(k => R.kinds[k] && R.kinds[k].downed).map(k => `${R.kinds[k].downed} ${plural(k, R.kinds[k].downed)}`);
  const lines = [];
  lines.push(`<li><i class="dk wl"></i><span><b>Downed</b> ${R.downed ? andList(kinds) : 'none'}${R.spawned ? ` (of ${R.spawned})` : ''}${R.dropShards ? `, for ${SHARD} ${R.dropShards}` : ''}.</span></li>`);
  lines.push(`<li><i class="dk sh"></i><span><b>Shards</b> ${R.drained ? `${R.drained} drunk by the Wildlight` : 'none lost to the Wildlight'}${R.spent ? `, ${R.spent} spent on shots` : ''}. ${R.stores} in the stores.</span></li>`);
  if (R.lamps) lines.push(`<li><i class="dk lp"></i><span><b>Lamps</b> ${R.lamps} snuffed${R.relit ? `, ${R.relit} relit by the watch` : ''}. All burning again now.</span></li>`);
  if (R.wallHit) lines.push(`<li><i class="dk wa"></i><span><b>Wall</b> ${R.wallHit} section${R.wallHit > 1 ? 's' : ''} hit${R.breaches ? `, ${R.breaches} broken through` : ''}. ${R.wallNow ? (R.watch ? 'The watch will mend it today.' : 'Nobody is on the watch to mend it.') : 'Sound again.'}</span></li>`);
  if (R.hurt.length) lines.push(`<li><i class="dk hu"></i><span><b>Hurt</b> ${esc(andList(R.hurt.map(firstName)))}, who limped home to the Keep. They’ll be back on their feet today.</span></li>`);
  const mats = Object.entries(R.mats).filter(([, n]) => n).map(([k, n]) => `${n} ${esc(D.MATERIALS[k] ? D.MATERIALS[k].name : k)}`);
  if (R.drops.length || mats.length) lines.push(`<li><i class="dk fd"></i><span><b>Found</b> ${[...R.drops.map(d => `<em style="color:${d.color}">${esc(d.name)}</em>`), ...mats].join(', ')}.</span></li>`);
  const stat = (v, l, bad) => `<div class="${bad && v ? 'bad' : ''}"><b>${v}</b><span>${l}</span></div>`;
  card.innerHTML = `<div class="dawn-card" role="dialog" aria-label="How the night went">
    <p class="eyebrow">Dawn · Night ${R.n}${R.title ? ' · ' + esc(R.title) : ''}</p>
    <h2>${esc(R.head)}</h2>${R.credit ? `<p class="dawn-credit">${esc(R.credit)}</p>` : ''}
    <div class="dawn-stats">${stat(R.downed, 'downed')}${stat(R.drained, 'shards drunk', true)}${stat(R.lamps, R.lamps === 1 ? 'lamp out' : 'lamps out', true)}${stat(R.breaches, R.breaches === 1 ? 'breach' : 'breaches', true)}</div>
    <ul class="dawn-lines">${lines.join('')}</ul>
    <button type="button" class="btn primary">On with the day</button></div>`;
  card.hidden = false;
  card.onclick = () => { card.hidden = true; };
  AUDIO.play('open');
}

// ----------------------------------------------------------------- the HUD: banner, boss bar, waves, where they climb
function hudEl(id, html, cls = id) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('div'); el.id = id; el.className = cls; el.hidden = true; el.innerHTML = html; $('#app').append(el); }
  return el;
}
function showBanner(P) {
  P.shown = true;
  if (QUIET) return;
  const el = hudEl('nightbanner', '');
  el.className = 'nbanner' + (P.bright ? ' bright' : '');
  el.innerHTML = `<p class="nb-n">Night ${P.n}</p><h2>${esc(P.title)}</h2><p class="nb-line">${esc(P.line)}</p>`;
  el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');
  clearTimeout(el._t); el._t = setTimeout(() => { el.classList.add('out'); setTimeout(() => { if (el.classList.contains('out')) el.hidden = true; }, 900); }, NIGHT.bannerMs || (P.bright ? 8000 : 6500));
  el.onclick = () => { el.classList.add('out'); setTimeout(() => el.hidden = true, 400); };
}
const _mk = new THREE.Vector3();
let nightsHudT = 0;
function nightsDraw(rdt) {
  // the dawn line fades on its own
  if (NIGHT.miniT > 0) { NIGHT.miniT -= rdt; if (NIGHT.miniT <= 0) { const m = document.getElementById('dawnmini'); if (m) m.hidden = true; } }
  // where the waves will climb: a marker over the rim for each (from the lookout's warning until the wave is up),
  // pinned to the edge of the screen when it's out of view
  const show = TOD.t >= 0.45 && TOD.t < 0.95 && VIEW.mode === 'town' && !(SKY && SKY.on) && !GAME.talk;
  for (let i = 0; i < 3; i++) {
    const M = NIGHT.markers[i], el = hudEl('sidemark' + i, '<i></i><span></span>', 'sidemark');
    if (!M || !show || TOD.t >= M.until) { if (!el.hidden) el.hidden = true; continue; }
    _mk.copy(M.pos).setY(2).project(camera);
    const W = innerWidth, H = innerHeight, pad = 34;
    let x = (_mk.x * 0.5 + 0.5) * W, y = (-_mk.y * 0.5 + 0.5) * H;
    const behind = _mk.z > 1; if (behind) { x = W - x; y = H - y; }
    const off = behind || x < pad || x > W - pad || y < pad + 60 || y > H - pad - 50;
    const cx = clamp(x, pad, W - pad), cy = clamp(y, pad + 60, H - pad - 50);
    const ang = off ? Math.atan2(y - H / 2, x - W / 2) : Math.PI / 2;
    el.hidden = false; el.className = 'sidemark' + (off ? ' off' : '') + (M.boss ? ' boss' : '');
    el.style.transform = `translate(${cx}px, ${cy}px)`;
    el.querySelector('i').style.transform = `translate(-50%, -50%) rotate(${ang}rad)`;
    const sp = el.querySelector('span'); if (sp.textContent !== M.label) sp.textContent = M.label;
  }
  if ((nightsHudT -= rdt) > 0) return; nightsHudT = 0.25;
  // a small chip under the clock while a night is on: which wave, how many still about
  const chip = hudEl('wavechip', '');
  const N = WL.night;
  if (!N || VIEW.mode === 'keep' || (SKY && SKY.on)) { if (!chip.hidden) chip.hidden = true; return; }
  const alive = WL.list.filter(f => !f.dead && !f.air && !f.leaving).length, started = N.waves.filter(w => w.warned).length, left = N.waves.reduce((s, w) => s + w.units.length, 0);
  const html = `${N.bright ? '<b class="bn">Bright Night</b> · ' : ''}${N.waves.length > 1 ? `Wave ${Math.max(1, started)} of ${N.waves.length}` : `Night ${N.n}`} · ${alive ? `${alive} on the claim` : left ? 'more to come' : 'all quiet'}`;
  if (chip.innerHTML !== html) chip.innerHTML = html;
  chip.hidden = false;
}

// ----------------------------------------------------------------- saving
function nightsSave() {
  const N = WL.night, boss = N && N.boss && !N.boss.dead ? N.boss : null;
  return {
    grudge: NIGHT.grudge, bossDowned: NIGHT.bossDowned, seamWoke: NIGHT.seamWoke, last: NIGHT.last,
    wall: WALL.segs.map(s => Math.round(s.hp * 1000) / 1000), broken: WALL.segs.map(s => s.broken ? 1 : 0),
    plan: NIGHT.plan ? { n: NIGHT.plan.n } : null,
    // a night in progress: the waves still to come, and a boss that's still standing
    on: N ? { n: N.n, title: N.title, bright: N.bright, deep: N.deep, waves: N.waves.map(w => ({ t0: w.t0, center: w.center, spread: w.spread, side: w.side, units: w.units, gap: w.gap, next: w.next, warned: w.warned })),
      boss: boss ? { kind: boss.kind, name: boss.name, hp: boss.hp, maxHp: boss.maxHp, def: boss.bossDef } : null, bossName: N.bossName, bossKind: N.bossKind,
      stats: { spawned: N.spawned, downed: N.downed, drained: N.drained, lamps: N.lamps, breaches: N.breaches, spent: N.spent, kinds: N.kinds, hurt: N.hurt, dropShards: N.dropShards } } : null,
  };
}
function nightsLoad(save) {
  const S = save && save.night; if (!S) return;
  NIGHT.grudge = S.grudge || null; NIGHT.bossDowned = { lodestar: 0, brightmaw: 0, ...(S.bossDowned || {}) }; NIGHT.seamWoke = !!S.seamWoke; NIGHT.last = S.last || null;
  if (Array.isArray(S.wall) && S.wall.length === WALL.segs.length) {
    WALL.segs.forEach((s, i) => { s.hp = clamp(+S.wall[i] || 0, 0, 1); s.broken = !!(S.broken && S.broken[i]); if (s.broken) s.hp = Math.min(s.hp, 0.49); s.stage = wallStage(s); });
    wallMatrices();
  }
  const O = S.on;
  if (O && save.t > 0.66 && save.t < 0.96) {
    WL.night = { n: O.n, title: O.title, bright: O.bright, deep: O.deep, waves: (O.waves || []).map(w => ({ ...w, units: (w.units || []).slice() })), relit: 0, walls: 0, wallHit: [], dmg: {}, drops: [], mats: {},
      boss: null, bossName: O.bossName, bossKind: O.bossKind, bossKilled: false, bossEscaped: false, shards0: GAME.shards, strikes: 0,
      spawned: 0, downed: 0, drained: 0, lamps: 0, breaches: 0, spent: 0, kinds: {}, hurt: [], dropShards: 0, ...(O.stats || {}) };
    if (O.boss) {
      // the boss is still out there: it comes back over the rim where it was
      const w = WL.night.waves[WL.night.waves.length - 1] || { center: 20 };
      setTimeout(() => {
        if (!WL.night) return;
        const f = spawnWildlight(O.boss.kind, w.center, { boss: true, hp: O.boss.hp, maxHp: O.boss.maxHp, scale: (O.boss.def || BOSSES[O.boss.kind]).scale, width: (O.boss.def || BOSSES[O.boss.kind]).width, name: O.boss.name });
        WL.night.spawned--; f.bossDef = O.boss.def || { ...BOSSES[O.boss.kind] }; f.pulseCd = 6; f.chargeCd = 0; WL.night.boss = f; bossBar(f, true);
      }, 0);
    }
  }
}
