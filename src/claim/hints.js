// ===================================================================== HINTS: a few gentle tips, the first time each thing matters
// Laying out the claim, the first night, the first Bright Night, the dig, the bench, the Sky Dock and the first day
// event. Each shows once on this device (remembered under 'bv-hints'), sits out of the way, never stops the game, and
// can be dismissed; they can be turned off (and shown again) in Settings. They watch the game rather than being
// called from it (hintsTick, every frame from main.js), so the files they're about don't need to know about them.
const HINTS = { seen: {}, cur: null, q: [], t: 0, wait: {} };
try { const s = JSON.parse(localStorage.getItem('bv-hints')); if (s && typeof s === 'object') HINTS.seen = s; } catch (e) { }
const HINT = {
  layout: { title: 'Lay out your claim', where: 'build',
    text: 'Tap a card below to drop a building in, then drag it where you like: green means it fits. Sunning yards like open ground near the Keep; turrets do best near the rim, where the Wildlight climb.' },
  night: { title: 'Your first night', where: 'top',
    text: 'After dark, Wildlight climb the cliffs toward your light. Lens towers and the watch on the wall fight them off. The lamps burn shards, so keep a few in the stores. Arrows at the edge of the screen show where they’re climbing.' },
  bright: { title: 'A Bright Night', where: 'boss',
    text: 'Something big climbs with them tonight, with a health bar of its own. Put your strongest on the watch and keep the lens towers crewed. Bring it down for something good.' },
  dig: { title: 'The dig', where: 'top',
    text: 'Every square in the cliff can be dug out as a room: Ore Faces for ore, Pump Rooms against floods, Timber Stores against cave-ins. Dig next to a room you have. Two of a kind side by side join into a bigger one.' },
  bench: { title: 'Odile’s bench', where: 'side',
    text: 'Break gear you don’t need down into brass and glass, then spend them making your best pieces stronger. One job at a time; the better the Engineering hand at the workshop, the quicker it goes.' },
  dock: { title: 'The Sky Dock', where: 'side',
    text: 'Set sail to bring down raiders over Aethermoor, or raid the claim-jumpers’ camps. While she’s out the claim waits for you, and the shards she wins come home.' },
  event: { title: 'A day on the claim', where: 'event',
    text: 'Now and then something happens. Each choice says what it costs and what it brings, and time waits while you decide.' },
};
function hintsKeep() { try { localStorage.setItem('bv-hints', JSON.stringify(HINTS.seen)); } catch (e) { } }
function hintsReset() { HINTS.seen = {}; HINTS.q = []; hintsKeep(); }
function hintWant(id) {
  if (!SETTINGS.hints || HINTS.seen[id] || HINTS.q.includes(id) || (HINTS.cur && HINTS.cur.id === id)) return;
  HINTS.q.push(id);
}
function hintShow(id) {
  const H = HINT[id]; if (!H) return;
  HINTS.seen[id] = Date.now(); hintsKeep();
  let el = $('#hintcard');
  if (!el) {
    el = document.createElement('aside'); el.id = 'hintcard'; el.className = 'hintcard'; el.setAttribute('role', 'note'); el.hidden = true;
    el.innerHTML = '<p class="hc-k">Tip</p><b class="hc-t"></b><p class="hc-x"></p><div class="hc-acts"><button type="button" class="btn hc-ok">Got it</button><button type="button" class="hc-off">No more tips</button></div>';
    el.querySelector('.hc-ok').onclick = () => hintClose();
    el.querySelector('.hc-off').onclick = () => { SETTINGS.hints = false; settingsKeep(); hintClose(); HINTS.q = []; toast('Tips are off. Turn them back on in Settings.'); };
    $('#app').append(el);
  }
  el.querySelector('.hc-t').textContent = H.title; el.querySelector('.hc-x').textContent = H.text;
  el.dataset.where = H.where; el.hidden = false; el.style.bottom = ''; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');
  hintPlace(el);
  $('#app').style.setProperty('--hint-h', el.offsetHeight + 'px');   // a day event's card makes room for it on a phone (style.css)
  HINTS.cur = { id, t: 0 };
  AUDIO.play('chime');
}
// the layout tip sits just above the build tray, however tall the tray's heading makes it on this screen
function hintPlace(el) {
  if (!el || el.dataset.where !== 'build') return;
  const tray = $('#buildbar');
  if (tray && !tray.hidden) el.style.bottom = Math.round(innerHeight - tray.getBoundingClientRect().top + 10) + 'px';
}
function hintClose() {
  const el = $('#hintcard'); HINTS.cur = null;
  if (!el || el.hidden) return;
  el.classList.add('out'); setTimeout(() => { if (el.classList.contains('out')) el.hidden = true; }, reducedMotion ? 0 : 300);
}
// what each tip waits for, and when it's no longer the moment for it
const hintNow = {
  layout: () => BUILD.on && !BUILD.setupDone && $('#intro').hidden,
  night: () => !!WL.night && WL.night.n === 1 && !WL.night.bright && TOD.phase === 'night' && hidden('nightbanner'),
  bright: () => !!WL.night && WL.night.bright && hidden('nightbanner'),
  dig: () => VIEW.mode === 'mine' && !VIEW.tween && !BUILD.on,
  bench: () => !!UI.cur && UI.cur.kind === 'bench',
  dock: () => !!UI.cur && UI.cur.kind === 'dock',
  event: () => !!EVT.card && !EVT.card.picked,
};
const hidden = id => { const e = document.getElementById(id); return !e || e.hidden; };
function hintsTick(rdt) {
  if (!started || TITLE.on || (SKY && SKY.on)) { if (HINTS.cur) hintClose(); return; }
  if ((HINTS.t -= rdt) > 0) return; HINTS.t = 0.3;
  if (!SETTINGS.hints) return;
  for (const id of Object.keys(hintNow)) if (!HINTS.seen[id] && hintNow[id]()) hintWant(id);
  const C = HINTS.cur;
  if (C) {
    C.t += 0.3; hintPlace($('#hintcard'));
    // the moment passed (the build is done, the event card closed, the panel shut) or it's been up a good while
    if ((!hintNow[C.id]() && C.t > 1.5) || C.t > 40 || STORY.shown) hintClose();
    return;
  }
  // a scene, the settings or the dawn report is up: wait for it
  if (STORY.shown || !$('#menu').hidden || !hidden('dawn') || !$('#intro').hidden) return;
  while (HINTS.q.length) { const id = HINTS.q.shift(); if (hintNow[id]() && !HINTS.seen[id]) { hintShow(id); break; } }
}
