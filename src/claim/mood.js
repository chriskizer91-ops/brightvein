// ===================================================================== MOOD: how the claim feels
// One number for the whole claim, from 0 to 100, on the HUD by the people count (tap it for why). It drifts toward
// what the claim gives its people: food in the stores, a free bed, lamps that stay lit, sunshine, friends on the claim,
// a festival; and away from hunger, dark lamps, the hurt and hard nights. Events and the story move it for a day or two
// (moodAdd). Like Fallout Shelter's happiness it gently changes how fast everyone works and how soon newcomers come.
// Kept to five plain bands so it reads at a glance.
const MOOD = { v: 62, mods: [], hudT: 0, shown: '', perm: {} };
const MOOD_BANDS = [
  { at: 80, name: 'Joyful', work: 1.1, recruit: 1.25, face: 'M6.5 11.5c1 2.4 2.3 3.4 3.5 3.4s2.5-1 3.5-3.4z', text: 'Everyone works a tenth faster, and settlers come sooner.' },
  { at: 60, name: 'Happy', work: 1.05, recruit: 1.1, face: 'M6.6 12.2c1 1.4 2.1 2 3.4 2s2.4-.6 3.4-2', text: 'Everyone works a little faster, and settlers come a little sooner.' },
  { at: 40, name: 'Content', work: 1, recruit: 1, face: 'M7 13h6', text: 'Work and settlers come at their usual pace.' },
  { at: 20, name: 'Grumbling', work: 0.9, recruit: 0.7, face: 'M6.8 14.2c1-1.2 2-1.7 3.2-1.7s2.2.5 3.2 1.7', text: 'Everyone works a tenth slower, and settlers are slower to come.' },
  { at: 0, name: 'Miserable', work: 0.8, recruit: 0, face: 'M6.5 14.8c1-2 2.2-2.8 3.5-2.8s2.5.8 3.5 2.8', text: 'Everyone works a fifth slower, and nobody new wants to come.' },
];
const moodBand = (v = MOOD.v) => MOOD_BANDS.find(b => v >= b.at) || MOOD_BANDS[MOOD_BANDS.length - 1];
const claimNow = () => GAME.day + GAME.t;            // time on the claim, in days
// a mood change that lasts a while: replaces any other with the same id
function moodAdd(id, amt, days, text) {
  MOOD.mods = MOOD.mods.filter(m => m.id !== id);
  if (amt) MOOD.mods.push({ id, amt: Math.round(amt), until: claimNow() + days, text });
}
// a lasting one (the charter, the claim's own Glimmer)
function moodKeep(id, amt, text) { if (amt) MOOD.perm[id] = { amt, text }; else delete MOOD.perm[id]; }

// what's moving the mood right now, in plain words
function moodFactors() {
  const out = [], add = (amt, text) => { if (amt) out.push({ amt: Math.round(amt), text }); };
  const n = Math.max(1, GAME.villagers.length), day = TOD.night < 0.5;
  if (GAME.food < 1) add(-25, 'There is nothing to eat');
  else if ((GAME.rates && GAME.rates.food || 0) < 0 && GAME.food < n * 1.5) add(-8, 'The food is running out');
  else if (GAME.food >= n * 3) add(6, 'Full larders');
  const free = totalBeds() - bedsUsed();   // the cast are guests, so they don't fill the Keep
  if (free <= 0) add(-2, 'The Keep is full: no free beds'); else if (free >= 4) add(2, 'Room to spare in the Keep');
  if (typeof POWER !== 'undefined' && !POWER.on) add(-15, 'The lamps are dark: no shards to light them');
  const out0 = DECOR.lamps ? DECOR.lamps.filter(l => !l.lit).length : 0; if (out0 && !day) add(-Math.min(10, out0 * 2), 'Lamps snuffed by the Wildlight');
  const hurt = GAME.villagers.filter(v => v.hurt).length; if (hurt) add(-Math.min(9, hurt * 3), 'Hurt in the night');
  const sick = GAME.villagers.filter(v => v.d.sick).length; if (sick) add(-Math.min(6, sick * 3), 'Fever in the Keep');
  if (day) { const w = WEATHER.today; if (w === 'storm') add(-5, 'An Aether storm'); else if (w === 'rain') add(-2, 'Rain'); else if (w === 'fog') add(-1, 'Fog on the rim'); else if (w === 'clear') add(3, 'Sunshine'); }
  if (TOWN.b.keep && TOWN.b.keep.level >= 3) add(4, 'The sun beacon on the Keep');
  add(Math.min(4, byType('garden').length * 2), 'Flowers in the greenhouse');
  add(Math.min(3, GAME.rooms.filter(r => r.type).length), 'Things to learn in the Keep');
  add(Math.min(6, Object.keys(CAST_CREW).filter(castHere).length), 'Good company: the cast');
  for (const p of Object.values(MOOD.perm)) add(p.amt, p.text);
  for (const m of MOOD.mods) add(m.amt, m.text);
  return out;
}
const moodTarget = () => clamp(50 + moodFactors().reduce((s, f) => s + f.amt, 0), 0, 100);
// every tick of game time: the mood drifts toward its target, about five points an hour (worked out twice a game
// second, which is plenty)
function moodTick(dt) {
  MOOD.acc = (MOOD.acc || 0) + dt; if (MOOD.acc < 0.5) return;
  const now = claimNow(), step = MOOD.acc * 0.5; MOOD.acc = 0;
  MOOD.mods = MOOD.mods.filter(m => m.until > now);
  const T = moodTarget();
  MOOD.v = Math.abs(T - MOOD.v) <= step ? T : MOOD.v + Math.sign(T - MOOD.v) * step;
}
// what it does: work goes a little faster or slower (every job, through Villager.eff), and so do newcomers
const moodWorkK = () => moodBand().work;
const moodRecruitK = () => moodBand().recruit * (ACT.charter ? 1.15 : 1);

// ---- the HUD: a face and a number by the people count; tap it for the why
const moodFace = b => `<circle cx="10" cy="10" r="8" fill="${b.at >= 60 ? '#ffcf85' : b.at >= 40 ? '#e9d3a4' : b.at >= 20 ? '#d9a77a' : '#c98a7a'}" stroke="#2a1c22" stroke-width="1.2"/><circle cx="7.4" cy="8.4" r="1.05" fill="#2a1c22"/><circle cx="12.6" cy="8.4" r="1.05" fill="#2a1c22"/><path d="${b.face}" fill="${b.at >= 80 ? '#7a3a2a' : 'none'}" stroke="#2a1c22" stroke-width="1.3" stroke-linecap="round"/>`;
function moodHUD(dt) {
  if ((MOOD.hudT -= dt) > 0) return; MOOD.hudT = 0.4;
  const el = $('#r-mood'); if (!el) return;
  const b = moodBand(), v = Math.round(MOOD.v), T = Math.round(moodTarget()), key = `${v}|${b.name}|${Math.sign(T - v)}`;
  if (key === MOOD.shown) return; MOOD.shown = key;
  el.querySelector('svg').innerHTML = moodFace(b);
  const ic = $('#r-pop .mood-ic'); if (ic) { ic.innerHTML = moodFace(b); $('#r-pop').title = `People and beds. The face is the claim's mood: ${v}, ${b.name}. Tap for what's moving it.`; }
  el.querySelector('b').textContent = v;
  el.querySelector('span').textContent = b.name;
  el.classList.toggle('low', b.at < 40); el.classList.toggle('up', T > v + 2); el.classList.toggle('down', T < v - 2);
  el.title = `Mood ${v} · ${b.name}. ${b.text} ${T > v + 2 ? 'Rising.' : T < v - 2 ? 'Falling.' : ''} Tap for what's moving it.`;
  el.setAttribute('aria-label', `Mood ${v}, ${b.name}`);
}
{ const el = $('#r-mood'); if (el) { el.onclick = () => UI.open('journal', { tab: 'days' }); el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }; } }
// on narrow screens the face sits in the people pill instead (style.css), and tapping it opens the same page
{ const pop = $('#r-pop'); if (pop) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 20 20'); s.setAttribute('class', 'ic mood-ic'); s.setAttribute('aria-hidden', 'true'); pop.prepend(s);
  pop.addEventListener('click', () => { if (matchMedia('(max-width: 560px)').matches) UI.open('journal', { tab: 'days' }); }); } }

// ---- in the journal: the mood, what it does, and what's moving it
function moodJournal(ui, body) {
  const b = moodBand(), v = Math.round(MOOD.v), T = Math.round(moodTarget()), f = moodFactors().sort((x, y) => y.amt - x.amt);
  body.append(ui.h(`<div class="mood-head"><svg viewBox="0 0 20 20" aria-hidden="true">${moodFace(b)}</svg><div><b>Mood ${v} · ${b.name}</b><span>${esc(b.text)}${T > v + 2 ? ` It's rising toward ${T}.` : T < v - 2 ? ` It's falling toward ${T}.` : ''}</span></div></div>`));
  body.append(ui.h(`<p class="small">How the claim feels, from 0 to 100. Fed, housed, lit and safe people are happy; hunger, dark lamps and hard nights wear them down. Happy people work faster and draw newcomers; miserable ones work slower, and nobody new will come.</p>`));
  body.append(ui.h(`<ul class="mood-list">${f.map(x => `<li class="${x.amt > 0 ? 'good' : 'bad'}"><em>${x.amt > 0 ? '+' : '−'}${Math.abs(x.amt)}</em>${esc(x.text)}</li>`).join('') || '<li>Nothing much either way.</li>'}</ul>`));
}

// ---- the hook into work: every job's output (Villager.eff in people.js) is scaled by the mood, by a festival day,
// and by a few events (a fever, a sky-whale everyone stops to watch, the bees). Wrapped here, so people.js keeps its own.
const _villagerEff = Villager.prototype.eff;
Villager.prototype.eff = function () {
  const e = _villagerEff.call(this); if (!e) return 0;
  return e * moodWorkK() * dayWorkK(this);
};

// ---- saving
function moodSave() { return { v: Math.round(MOOD.v * 10) / 10, mods: MOOD.mods, perm: MOOD.perm }; }
function moodLoad(s) {
  MOOD.v = s && typeof s.v === 'number' ? clamp(s.v, 0, 100) : 62;
  MOOD.mods = s && Array.isArray(s.mods) ? s.mods.filter(m => m && typeof m.amt === 'number') : [];
  MOOD.perm = s && s.perm && typeof s.perm === 'object' ? s.perm : {};
  MOOD.shown = '';
}
