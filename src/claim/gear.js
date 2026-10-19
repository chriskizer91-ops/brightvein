// ===================================================================== GEAR: the Armory's loot on villagers
// Seven slots. Gear adds GEARS stats, job output, guard and health; the hand slot's weapon sets
// how hard the watch hits Wildlight and how an expedition fares in a fight.
const GEAR_SLOTS = ['hand', 'offhand', 'head', 'rig', 'hands', 'boots', 'charm'];
const SLOT_LABEL = { hand: 'Hand', offhand: 'Off-hand', head: 'Head', rig: 'Rig', hands: 'Gloves', boots: 'Boots', charm: 'Charm' };
const LOOT = createLoot(D, (Date.now() % 2147483647) | 1);
const rarityOf = it => D.RARITY[it.rarity] || D.RARITY.salvage;
function itemBase(it) {
  if (it.type === 'relic') { const r = D.RELICS[it.base]; return { relic: r, base: r && r.base ? D.ITEMS[r.base] : null }; }
  return { relic: null, base: D.ITEMS[it.base] || null };
}
function itemWeapon(it) { const { relic, base } = itemBase(it); return relic && relic.weapon ? relic.weapon : base && base.weapon ? base.weapon : null; }
// Hearthbrand has no base item: it is a sword in its own right
D.RELICS['hearthbrand-refit'].weapon = { dmg: 16, cd: 0.8, range: 1.8, aspect: 'glare', stat: 'G' };
// damage a second of one weapon, as the Armory works it, plus a relic's own damage bonus
function dpsOf(it, statVal, foe) {
  const w = itemWeapon(it); if (!w) return 0;
  const { relic } = itemBase(it), R = rarityOf(it);
  let dmg = w.dmg * R.statMult * (1 + (it.overhaul || 0) * D.WORKSHOP.overhaul.perLevel) * (1 + 0.08 * statVal), rate = 1 / w.cd;
  if (relic && relic.stats && relic.stats.dmg) dmg *= 1 + relic.stats.dmg / 100;
  for (const t of it.traits || []) { const a = D.AFFIXES[t.id]; if (!a) continue; if (a.stat === 'dmg') dmg *= 1 + t.value / 100; if (a.stat === 'rate') rate *= 1 + t.value / 100; }
  const parts = [{ aspect: w.aspect, k: 1 }]; for (const t of it.traits || []) { const a = D.AFFIXES[t.id]; if (a && a.stat === 'extra') parts.push({ aspect: a.aspect, k: t.value / 100 }); }
  const res = (D.FOES[foe] || {}).resist || {};
  return Math.round(dmg * rate * parts.reduce((s, p) => s + p.k * (1 - (res[p.aspect] || 0) / 100), 0) * 10) / 10;
}
const wearable = it => (it.type === 'gear' || it.type === 'relic') && GEAR_SLOTS.includes(it.slot);
// flat effects of one item
function itemStats(it) {
  const o = {}, add = (k, v) => { if (!v || typeof v !== 'number') return; if (k === 'allStats') { for (const s of 'GEARS') o[s] = (o[s] || 0) + v; return; } o[k] = (o[k] || 0) + v; };
  const { relic, base } = itemBase(it), mult = rarityOf(it).statMult;
  if (base) {
    if (base.armor) for (const [k, v] of Object.entries(base.armor)) add(k, Math.round(v * mult));
    for (const k of ['G', 'E', 'A', 'R', 'S', 'speed', 'night', 'nerve', 'findLuck', 'light', 'stealth', 'sight']) add(k, base[k]);
    if (base.tool) { o.outJob = base.tool.job === 'hall' ? 'keep' : base.tool.job; add('out', Math.round(base.tool.out * mult)); }
  }
  if (relic) for (const [k, v] of Object.entries(relic.stats || {})) if (k !== 'dmg') add(k, v);
  for (const t of it.traits || []) { const a = D.AFFIXES[t.id]; if (a && a.stat !== 'extra' && a.stat !== 'resist') add(a.stat, t.value); }
  return o;
}
const GEAR_KEYS = ['G', 'E', 'A', 'R', 'S', 'guard', 'hp', 'night', 'speed', 'findLuck', 'upkeep', 'nerve', 'vsWild', 'stealth', 'light', 'repair'];
function gearOf(v) {
  if (v.gearCache) return v.gearCache;
  const g = { outByJob: {}, outAny: 0, weapon: null }; for (const k of GEAR_KEYS) g[k] = 0;
  for (const slot of GEAR_SLOTS) {
    const it = v.d.gear && v.d.gear[slot]; if (!it) continue;
    const s = itemStats(it);
    for (const k of GEAR_KEYS) if (s[k]) g[k] += s[k];
    if (s.out) { if (s.outJob) g.outByJob[s.outJob] = (g.outByJob[s.outJob] || 0) + s.out; else g.outAny += s.out; }
    if (slot === 'hand' && itemWeapon(it)) g.weapon = it;
  }
  return v.gearCache = g;
}
const outFor = (g, type) => g.outAny + (g.outByJob[type] || 0);
// damage a second against a foe, and reach. Without a weapon the watch still carries a plain crystal lance.
// the cast's gifts in a fight: Sol drills the watch, Brann sharpens every blade
const castEdge = v => (castPerk('sol') && v.d.job && v.d.job.bid === 'wall' ? 1.25 : 1) * (castPerk('brann') ? 1.1 : 1);
function fightOf(v, foe = 'glimmer') {
  const g = gearOf(v), mk = mastered(v, 'G') ? 1.2 : 1, bare = 2.2 * statOf(v, 'G') * (v.d.trait === 'Bold' ? 1.25 : 1) * mk;
  if (!g.weapon) return { dps: bare, range: 1.6 };
  const w = itemWeapon(g.weapon), d = dpsOf(g.weapon, statOf(v, w.stat), foe) * (1 + g.vsWild / 100) * (v.d.trait === 'Bold' ? 1.1 : 1) * mk * castEdge(v);
  return w.range > 3 ? { dps: d, range: Math.min(w.range, 16), cd: w.cd, ranged: true, aspect: g.weapon.aspect || w.aspect } : { dps: Math.max(bare, d), range: Math.max(1.6, w.range * 0.8) };
}
function maxHpOf(v) { const g = gearOf(v); return Math.round(50 + statOf(v, 'G') * 5 + g.hp); }
function equip(v, it) {
  if (!wearable(it)) return false;
  const old = v.d.gear[it.slot];
  GAME.stash.splice(GAME.stash.indexOf(it), 1);
  if (old) GAME.stash.unshift(old);
  v.d.gear[it.slot] = it; v.gearCache = null;
  return true;
}
function unequip(v, slot) { const it = v.d.gear[slot]; if (!it) return; delete v.d.gear[slot]; GAME.stash.unshift(it); v.gearCache = null; }
// modules and Lark parts can't be fitted yet: anything that isn't wearable becomes gear of the same rarity
function toGear(it, ilvl = 1) { return it && (it.type === 'gear' || it.type === 'relic') ? it : LOOT.makeGear({ rarity: it ? it.rarity : 'salvage', ilvl, from: it && it.from }); }
function addToStash(it, quiet) {
  it = toGear(it, it && it.ilvl);
  GAME.stash.unshift(it);
  if (!quiet) toast(`Found: <b style="color:${rarityOf(it).color}">${esc(it.name)}</b>`);
  return it;
}
function addHaul(r) {   // the result of foeDrops / raidCrates
  if (!r) return;
  GAME.shards += r.shards || 0;
  for (const [k, n] of Object.entries(r.materials || {})) GAME.mats[k] = (GAME.mats[k] || 0) + n;
  for (const b of r.blueprints || []) if (!GAME.blueprints.includes(b)) GAME.blueprints.push(b);
  for (const it of r.items || []) addToStash(it);
}
function mineFindHere() {
  const deep = workersOf('head').some(v => v.working && MINE_STATIONS[v.d.job.slot].g === 2);
  const g = gearOf; let luck = castPerk('fox') ? 0.3 : 0; for (const v of workersOf('head')) luck = Math.max(luck, g(v).findLuck);
  const f = LOOT.mineFind(deep && Math.random() < 0.5 ? 'deep' : deep ? 'lower' : 'upper', { night: Math.max(1, GAME.nights), findLuck: luck });
  if (f.item) { const it = addToStash(f.item, true); toast(`The miners turned something up: <b style="color:${rarityOf(it).color}">${esc(it.name)}</b>`); }
  else if (f.cell) { GAME.cells[f.cell] = (GAME.cells[f.cell] || 0) + 1; toast(`The miners found a <b>${esc(D.CELLS[f.cell].name)}</b> in the rock.`); }
  else if (f.blueprint && !GAME.blueprints.includes(f.blueprint)) { GAME.blueprints.push(f.blueprint); toast(`A blueprint in the spoil: <b>${esc(D.ITEMS[f.blueprint].name)}</b>. Odile pins it up.`); }
  UI.refresh();
}
function wildlightDrop(f) {
  const foe = GAME.nights >= 6 && Math.random() < 0.25 ? 'flarehound' : 'glimmer';
  const r = LOOT.foeDrops(foe, { night: Math.max(1, GAME.nights), deep: TOWN.b.head.level >= 2 });
  if (r.items.length) FX.sparks(f.pos.clone().setY(1), 18, 0xfff0c0, 2);
  addHaul(r);
}
function starterStash() {
  const mk = (base, rarity) => LOOT.makeGear({ base, rarity, ilvl: 1, from: 'the first crates off the courier' });
  GAME.stash = [mk('earthing-lance', 'tooled'), mk('flare-pistol', 'salvage'), mk('duster', 'tooled'), mk('goggles', 'salvage'), mk('hobnails', 'salvage'), mk('work-gloves', 'salvage'), mk('sunstone-locket', 'salvage'), mk('pick', 'salvage')];
}
// ---- how items read in the UI
const icon = (kind, o = {}) => iconCanvas(kind, o, D.RARITY, D.ASPECTS);
function itemIcon(it, size = 64) { const c = icon(it.kind, { aspect: it.aspect, rarity: it.rarity, size }); return c; }
function itemLines(it) {
  const out = [], { relic, base } = itemBase(it), s = itemStats(it), w = itemWeapon(it), mult = rarityOf(it).statMult;
  if (w) out.push(`${Math.round(w.dmg * mult * (relic ? 1 : 1))} ${D.ASPECTS[it.aspect || w.aspect]?.name || ''} damage every ${w.cd}s · reach ${w.range} m · scales with ${STAT_NAMES[w.stat]}`);
  if (s.guard) out.push(`${s.guard}% guard`);
  if (s.hp) out.push(`+${s.hp} health`);
  if (s.out) out.push(`+${s.out}% output${s.outJob ? ' as ' + (DEFS[s.outJob === 'hall' ? 'keep' : s.outJob]?.job?.title || DEFS[s.outJob]?.name || s.outJob).toLowerCase() : ''}`);
  for (const k of 'GEARS') if (s[k]) out.push(`+${s[k]} ${STAT_NAMES[k]}`);
  if (s.night) out.push(`+${s.night}% work after dark`);
  if (s.speed) out.push(`${s.speed > 0 ? '+' : ''}${s.speed}% move speed`);
  if (s.findLuck) out.push(`+${s.findLuck} luck on finds`);
  if (s.upkeep) out.push(`Eats ${s.upkeep}% less`);
  if (s.nerve) out.push(`+${s.nerve} nerve`);
  if (s.stealth) out.push(`Wildlight often miss the wearer`);
  if (s.vsWild) out.push(`+${s.vsWild}% damage to Wildlight`);
  for (const t of it.traits || []) { const a = D.AFFIXES[t.id]; if (a && (a.stat === 'extra' || a.stat === 'resist' || a.stat === 'dmg' || a.stat === 'rate' || a.stat === 'range')) out.push(LOOT.traitText(t)); }
  return out;
}

// ----------------------------------------------------------------- the economy, every frame
const RATES = { mine1: 0.2, mine2: 0.34, charge: 0.3, food: 0.11, eat: 0.0055, recruit: 1 / 75, nightDrain: 0.05 };
function economy(dt) {
  const sun = TOD.sunlight, night = TOD.night;
  const sum = bid => workersOf(bid).reduce((s, v) => s + v.eff(), 0);
  // mine
  const head = TOWN.b.head;
  let ore = 0; for (const v of workersOf('head')) { const st = MINE_STATIONS[v.d.job.slot]; ore += v.eff() * (st.g === 2 ? RATES.mine2 : RATES.mine1); }
  GAME.ore += ore * dt; head.busy = ore > 0 ? 1 : 0;
  GAME.rates = { ore: ore };
  // mine finds: every unit of ore dug has a small chance of turning something up
  if (ore > 0) {
    GAME.findAcc += ore * dt;
    while (GAME.findAcc >= 1) { GAME.findAcc -= 1; if (Math.random() < D.MINE_FINDS.perOre) mineFindHere(); }
  }
  // charging in the yards
  let cut = 0; for (const b of byType('shop')) cut += sum(b.id) * (b.level >= 2 ? 1.3 : 1);
  const cutBonus = 1 + 0.22 * cut;
  let charged = 0;
  for (const b of Object.values(TOWN.b)) {
    if (b.type !== 'yard' || b.level < 1) continue;
    const tend = sum(b.id), mult = b.level >= 3 ? 1.5 : b.level >= 2 ? 1.25 : 1;
    const light = b.level >= 3 ? Math.max(sun, 0.35 * (1 - night)) : sun;
    let want = tend * RATES.charge * mult * light * dt * (castPerk('tock') ? 1.2 : 1);
    want = Math.min(want, GAME.ore);
    GAME.ore -= want; charged += want * cutBonus;
    b.chargeK = lerp(b.chargeK || 0, tend > 0 && GAME.ore > 0.5 ? light : 0, Math.min(1, dt * 2));
    b.busy = tend > 0 ? 1 : 0;
  }
  GAME.shards += charged; GAME.rates.shards = charged / Math.max(dt, 1e-4);
  for (const b of byType('shop')) b.busy = workersOf(b.id).some(v => v.working) ? 1 : 0;
  // food: everyone at home eats; gear "of Plenty" eats less
  let grown = 0; for (const b of byType('garden')) grown += sum(b.id) * RATES.food * (b.level >= 2 ? 1.3 : 1);
  let mouths = 0; for (const v of GAME.villagers) if (!v.d.exp) mouths += 1 - Math.min(0.5, gearOf(v).upkeep / 100);
  GAME.rates.food = grown - mouths * RATES.eat;
  GAME.food += GAME.rates.food * dt;
  GAME.food = Math.max(0, GAME.food);
  // lights at night cost shards
  if (night > 0.3) {
    const lit = DECOR.lamps.filter(l => l.lit).length;
    const drain = RATES.nightDrain * (0.4 + lit / 40) * (TOWN.b.keep.level >= 3 ? 1.4 : 1) * (castPerk('io') ? 0.67 : 1);
    GAME.shards -= drain * dt;
  }
  if (GAME.shards <= 0) { GAME.shards = 0; if (POWER.on) { POWER.on = false; toast('The shards are spent. <b>The lamps go dark.</b>', 'night'); } }
  else if (!POWER.on && GAME.shards > 3) POWER.on = true;
  // recruits
  const beds = totalBeds();
  if (GAME.villagers.length < beds) {
    GAME.recruit += sum('keep') * RATES.recruit * dt;
    if (GAME.recruit >= 1) { GAME.recruit = 0; recruitArrives(); }
  }
}
function recruitArrives() {
  const R = mulberry((Math.random() * 1e9) | 0), d = makePerson(R);
  const M = TOWN.b.mast, at = M.worldPos(0, 14.25, 0.6);
  const v = addVillager(d, at);
  v.where = 'mast'; v.plan = [{ type: 'climb', to: M.worldPos(0, 0, 2.2), then: () => v.where = 'surface' }];
  const best = Object.entries(d.stats).sort((a, b) => b[1] - a[1])[0][0];
  toast(`A courier sets down <b>${d.name}</b>, strong in ${STAT_NAMES[best]}.`);
  AUDIO.play('chime');
  UI.refresh();
}
