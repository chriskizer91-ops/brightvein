// record.js: the Captain's record on the screen (deeds.js counts it).
//   Coming home: a card rises over the port, "Home from the voyage" (or "The Gale went down", or "Raised to Raider-Bane!"
//   when her rank rose), with what the voyage did in plain words: the waves beaten (and a new best on these skies), the
//   raiders brought down by class, treasure ships caught and got away, shots fired and hits, hits taken, the time at
//   sea, the shards gathered and the waves' pay (all kept, or half), the commendations, stars and orders won as gold
//   ribbons, her rank with a bar to the next, one line of what to aim for next (the quartermaster's advice, port.js),
//   and the purse counting up to what's in it now. Then a big gold "Sail again" (out at once in the same ship) and a
//   plain "To port".
//   The Captain's log, from the port's Log button: three pages. Commendations (today's harbour orders first, then every
//   commendation: gold ribbons for those won, with the day, the rest dim, saying how far she's got), Records (each skies'
//   stars, best wave, most shards and most raiders in a voyage; then everything over every voyage), and Voyages (the last
//   twelve).
// Both are cards over a dimmed screen (game.html), scrolling on a small phone with their buttons always in view; any
// change of screen closes them.
import { SHIPS, FLEET } from '../ships/index.js';
import { SKIES, STAR_WAVES, STAR_PAY, LANDS } from './progress.js';
import { MEDALS, ORDERS, RANKS, THANKS, dateOf } from './deeds.js';
import { CAPTAINS } from './tactics.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en');
const gem = (n) => `<span class="gem">◆ ${fmt(n)}</span>`; // (a price in one piece, never "◆" at the end of a line)
const NUMBER = ['no', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const BIGGEST = ['manowar', 'galleon', 'frigate', 'brig', 'cutter', 'skiff'];
const cls = (id) => FLEET.find((s) => s.id === id).cls;
const plural = (c) => (c === 'Man-o\'-war' ? 'Men-o\'-war' : `${c}s`);
// raiders by class in words, biggest first ("two Skiffs, two Cutters and a Brig")
export function classWords(by) {
  const parts = BIGGEST.filter((id) => by[id]).map((id) => (by[id] === 1 ? `a ${cls(id)}` : `${NUMBER[by[id]] ?? fmt(by[id])} ${plural(cls(id))}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? '';
}
// a time at sea in words ("6 min 12 s", "3 h 12 min")
export function timeWords(s) {
  s = Math.round(s);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}
// the rank's bar: her rank, and how far through it to the next ("820 of 1,000 renown to Raider-Bane")
function rankBar(R) {
  const frac = R.next === null ? 1 : Math.max(0, Math.min(1, (R.renown - R.from) / (R.next - R.from)));
  const words = R.next === null ? 'The highest rank there is' : `${fmt(R.renown)} of ${fmt(R.next)} renown to ${R.nextName}`;
  return `<div class="rankbar"><b>${R.name}</b><span class="bar"><i style="width:${Math.round(frac * 100)}%"></i></span><small>${words}</small></div>`;
}
// a ribbon: a commendation, a star, an order done (gold), or one not won yet (dim, with how far she's got)
// (its line may hold a price, already in one piece: gem; `kind`: 'order', in plain type, as an order is a sentence)
const ribbon = (name, line, won = true, kind = '') => `<div class="ribbon${won ? '' : ' dim'}${kind ? ` ${kind}` : ''}"><b>${esc(name)}</b>${line ? `<small>${line}</small>` : ''}</div>`;
const EARNED = { medal: 'Commendation', star: 'Star', order: 'Order done', orders: 'All three orders', rank: 'Rank' };

// `deeds`, `progress`; `onSail(ship)`: set sail again; `advice()`: the quartermaster's line (port.js), in words;
// `onClose()`: told as coming home's card closes (the port's notes wait for it: main.js)
// (Brightvein: `onHome()`: coming home's plain button takes the Captain home to the claim; `nameOf(id)`: a ship's own name,
// the Gannet say)
export function makeRecord({ progress, deeds, onSail, advice, onClose, onHome, nameOf = (id) => SHIPS.find((s) => s.id === id)?.name ?? id }) {
  const card = $('homecoming'), log = $('log');
  let counting = null;
  // ---------- coming home ----------
  function homecoming(S) {
    if (!S) return;
    const d = progress.data, sk = SKIES[S.skies], ship = { name: nameOf(S.ship) }, R = S.rank;
    $('hc-title').textContent = R.up ? `Raised to ${R.name}!` : S.sunk ? `The ${ship.name} went down` : 'Home from the voyage';
    $('hc-sub').textContent = `The ${ship.name} · ${sk.name} · ${timeWords(S.secs)} at sea`;
    const rows = [];
    const row = (k, v) => rows.push(`<dt>${k}</dt><dd>${v}</dd>`);
    row('Waves beaten', `${S.waves}${S.newBest && S.waves ? ` <b class="gold">· a new best on ${sk.name}!</b>` : ''}`);
    row('Raiders downed', S.downed ? `${S.downed}: ${classWords(S.by)}${S.captains ? ` (${S.captains === 1 ? 'one a raider captain' : `${NUMBER[S.captains] ?? fmt(S.captains)} of them raider captains`})` : ''}` : 'none');
    if (S.prizes || S.escaped) row('Treasure ships', `${S.prizes} caught${S.escaped ? `, ${S.escaped} got away` : ''}`);
    row('Shots', `${fmt(S.shots)} fired, ${fmt(S.hits)} hit`);
    row('Hits taken', fmt(S.taken));
    const gathered = Math.max(0, Math.round(S.gathered)), bonus = Math.round(S.bonus);
    // (what came in, and what she keeps of it; with nothing at all, just that)
    const took = [gathered ? `${gem(gathered)} gathered` : '', bonus ? `${gem(bonus)} for the wave${S.waves === 1 ? '' : 's'}` : ''].filter(Boolean).join(' + ');
    row('Shards', took || S.got ? `${took || 'none'}. ${S.keep < 1 ? 'You keep half' : 'You keep it all'}: <b class="gold" id="hc-got">${gem(S.got)}</b>` : 'none this time');
    $('hc-rows').innerHTML = rows.join('');
    // what she won, as ribbons (commendations, stars, orders, her rank)
    $('hc-ribbons').innerHTML = S.earned.map((e) => ribbon(e.kind === 'rank' ? `Raised to ${e.name}` : e.name, `${EARNED[e.kind]} · ${gem(e.reward)}`, true, e.kind === 'order' ? 'order' : '')).join('');
    $('hc-ribbons').hidden = !S.earned.length;
    $('hc-rank').innerHTML = rankBar(R);
    // one line more: the first time she went down, what to do next time; on gentler skies, what the Maelstrom would have
    // paid (all she keeps, the waves' pay too, as the skies scale both: so always more than she has); then what to aim
    // for next
    const lines = [];
    if (S.sunk && d.stats.sunk === 1) lines.push('Next time, go home between waves to keep everything.');
    if (S.skies !== 'mael' && Math.max(d.best.fair, d.best.cross) >= 5 && S.got > 0) lines.push(`On the Maelstrom this voyage would have paid ◆\u00a0${fmt(Math.round((S.got * SKIES.mael.shards) / sk.shards / 10) * 10)}.`);
    const next = advice?.();
    if (next) lines.push(next);
    $('hc-next').innerHTML = lines.map((l, i) => `<span class="${i === lines.length - 1 && next ? 'gold' : 'dim'}">${esc(l)}</span>`).join(' ');
    $('btn-again').textContent = `Sail again in the ${nameOf(d.flying)}`;
    // the purse, counting up from what it was as she set sail to what it is now
    const from = S.purse0, to = d.shards, el = $('hc-purse');
    card.hidden = false; card.scrollTop = 0; card.querySelector('.card').scrollTop = 0;
    counting?.(); el.textContent = fmt(from);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) el.textContent = fmt(to);
    else {
      const t0 = performance.now(); let raf = 0;
      // (by the clock now, not the frame's own time, which can be a little before the card was shown)
      const step = () => { const k = Math.max(0, Math.min(1, (performance.now() - t0) / 1200)); el.textContent = fmt(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1 && !card.hidden) raf = requestAnimationFrame(step); else counting = null; };
      raf = requestAnimationFrame(step); counting = () => { cancelAnimationFrame(raf); counting = null; };
    }
  }
  $('btn-again').addEventListener('click', () => { hide(); onSail(progress.data.flying); });
  $('btn-hc-port').addEventListener('click', () => { hide(); onHome?.(); });

  // ---------- the Captain's log ----------
  let page = 'deeds';
  const tabs = { deeds: $('log-tab-deeds'), records: $('log-tab-records'), voyages: $('log-tab-voyages') };
  for (const [k, b] of Object.entries(tabs)) b.addEventListener('click', () => { page = k; draw(); });
  function deedsPage() {
    const d = progress.data, O = deeds.today(), out = [];
    if (d.voyages && O.picks.some((p) => p >= 0)) {
      const done = O.done.filter(Boolean).length;
      out.push(`<h3>Today's orders <small>${done} of 3 done · new ones tomorrow</small></h3><div class="ribbons">`);
      O.picks.forEach((p, i) => { const o = ORDERS[p]; if (o) out.push(ribbon(o.text, O.done[i] ? `Done · ${gem(o.reward)}` : `${O.got[i]} of ${o.need} · ${gem(o.reward)}`, !!O.done[i], 'order')); });
      out.push(ribbon('The harbourmaster\'s thanks', O.bonus ? `All three done · ${gem(THANKS)}` : `For all three: ${gem(THANKS)}`, !!O.bonus, 'order'), '</div>');
    } else out.push('<h3>Today\'s orders</h3><p class="dim">The harbourmaster gives orders once you\'ve been to sea: three small jobs a day, each paid in shards.</p>');
    const won = MEDALS.filter((M) => d.medals[M.id]).length;
    out.push(`<h3>Commendations <small>${won} of ${MEDALS.length}</small></h3><div class="ribbons">`);
    for (const M of MEDALS) {
      const at = d.medals[M.id], P = deeds.progressOf(M);
      out.push(ribbon(M.name, at ? `${esc(M.line)} <span class="gem">· ${dateOf(at)}</span> <span class="gem">· ◆ ${fmt(M.reward)}</span>` : `${esc(M.line)}${P ? ` <b class="have gem">· ${fmt(P[0])} of ${fmt(P[1])}</b>` : ''} <span class="gem">· ◆ ${fmt(M.reward)}</span>`, !!at));
    }
    out.push('</div>');
    return out.join('');
  }
  function recordsPage() {
    const d = progress.data, st = d.stats, out = ['<h3>Each skies</h3><dl class="records">'];
    for (const [k, S] of Object.entries(SKIES)) {
      const stars = STAR_WAVES.map((w) => `<i class="star${d.stars[k][`w${w}`] ? ' on' : ''}" title="Wave ${w}"></i>`).join('');
      const R = d.records[k], waiting = STAR_WAVES.reduce((n, w, i) => n + (d.stars[k][`w${w}`] ? 0 : STAR_PAY[k][i]), 0);
      out.push(`<dt>${S.name} <span class="stars">${stars}</span></dt><dd>${d.best[k] ? `Best wave ${d.best[k]}${R.shards || R.downed ? ` · most in a voyage: ${gem(R.shards)}, ${fmt(R.downed)} downed` : ''}` : 'Not sailed yet'}${waiting ? ` · <span class="gold">${gem(waiting)} in stars to win</span>` : ''}</dd>`);
    }
    out.push('</dl><h3>Every voyage</h3><dl class="records">');
    const by = classWords(Object.fromEntries(BIGGEST.map((id) => [id, st[id]])));
    const beaten = CAPTAINS.filter((C) => d.captains?.[C.id]?.beaten > 0).length;
    const rows = [
      ['Voyages', `${fmt(d.voyages)} (${fmt(st.home)} home, ${fmt(st.sunk)} went down)`], ['Waves beaten', fmt(st.waves)],
      ['Raiders downed', `${fmt(st.downed)}${by ? `: ${by}` : ''}`], ['Raider captains', `${fmt(st.captains)} brought down (${beaten} of the ${NUMBER[CAPTAINS.length]} with names)`],
      ['Treasure ships', `${fmt(st.prizes)} caught, ${fmt(st.escaped)} got away`], ['Crews that gave up', fmt(st.struck)],
      ['Shots', `${fmt(st.shots)} fired, ${fmt(st.hits)} hit`], ['Hits taken', fmt(st.taken)], ['Shards brought home', gem(st.banked)],
      ['Time at sea', timeWords(st.secs)], ['Lands charted', `${LANDS.filter((k) => d.charted[k]).length} of ${LANDS.length}`], ['Renown', fmt(st.renown)],
    ];
    for (const [k, v] of rows) out.push(`<dt>${k}</dt><dd>${v}</dd>`);
    out.push('</dl>');
    return out.join('');
  }
  function voyagesPage() {
    const L = progress.data.log;
    if (!L.length) return '<p class="dim">No voyages yet. Each one you sail is written here: the last twelve.</p>';
    return `<ol class="voyages">${[...L].reverse().map((e) => { return `<li><b>${dateOf(e.d)} · the ${esc(nameOf(e.ship))}</b> ${esc(SKIES[e.skies]?.name ?? e.skies)} · wave ${e.w} · ${e.k} downed · ${gem(e.s)} · ${e.sunk ? 'went down' : 'home'}</li>`; }).join('')}</ol>`;
  }
  function draw() {
    for (const [k, b] of Object.entries(tabs)) b.setAttribute('aria-selected', String(k === page));
    const R = deeds.standing();
    $('log-rank').innerHTML = rankBar(R);
    $('log-body').innerHTML = page === 'deeds' ? deedsPage() : page === 'records' ? recordsPage() : voyagesPage();
    $('log-body').scrollTop = 0;
  }
  function openLog(p = 'deeds') { page = p; draw(); log.hidden = false; }
  $('btn-log-done').addEventListener('click', () => { log.hidden = true; });
  log.addEventListener('click', (e) => { if (e.target === log) log.hidden = true; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !log.hidden) { log.hidden = true; e.stopPropagation(); } }, true);
  // (any change of screen closes both)
  function hide() { const was = !card.hidden; card.hidden = true; log.hidden = true; counting?.(); if (was) onClose?.(); }
  return { homecoming, openLog, hide, draw, get shown() { return !card.hidden; }, get logShown() { return !log.hidden; }, ribbon };
}
