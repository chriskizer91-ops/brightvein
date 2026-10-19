// ===================================================================== THE FRONT DOOR: loading, the title screen, claims, the first look
// The page opens on a loading screen with a bar that fills as the claim is built (boot in main.js reports each step).
// Then the title: the claim itself behind it, at golden hour with its lamps coming on, the camera drifting slowly
// round the plateau. On a device with a saved claim that's the player's own claim; on a new device, a handsome one
// (the starting kit set out round the Keep, taken away again when a new claim begins). The buttons: Continue (with
// the claim's day, chapter and people), New claim (which asks before replacing anything), Claims (the three slots),
// Settings, and About.
// A new player gets a short, picture-led look at how the claim works, then goes straight into laying it out.

// ----------------------------------------------------------------- loading
const LOADING = { p: 0, i: 0, t: null, shown: 0 };
const LOAD_LINES = ['Raising the town…', 'Charging the crystal…', 'Counting the shards…', 'Sweeping out the lift cage…', 'Waking the founders…', 'Tuning the lens towers…',
  'Trimming the lamp wicks…', 'Winding the ballistas…', 'Airing out the Keep…', 'Mooring the ship…', 'Reading the weather…'];
function loadStep(p, line) {
  LOADING.p = Math.max(LOADING.p, clamp(p, 0, 1));
  const bar = $('#ld-bar'); if (bar) { bar.style.setProperty('--p', LOADING.p.toFixed(3)); bar.setAttribute('aria-valuenow', String(Math.round(LOADING.p * 100))); }
  if (line) $('#ld-line').textContent = line;
}
// a new line every so often, so a slow phone always has something to read
LOADING.t = setInterval(() => { LOADING.i = (LOADING.i + 1) % LOAD_LINES.length; const el = $('#ld-line'); if (el && !$('#loading').hidden) el.textContent = LOAD_LINES[LOADING.i]; }, 1600);
// let the page draw between the steps of building the claim (a frame, or a moment if the tab is out of sight)
const breathe = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 60); });
function loadDone() {
  loadStep(1, 'Ready.');
  clearInterval(LOADING.t);
  const el = $('#loading');
  if (reducedMotion) { el.hidden = true; return; }
  el.classList.add('out');
  setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 500);
}

// ----------------------------------------------------------------- the title screen
const TITLE = { on: false, t: 0.57, ang: 0, k: 0, showcase: [], save: null };
const TITLE_T0 = 0.6, TITLE_T1 = 0.662;   // golden hour, into the first of dusk: the lamps come on
function titleShow(save) {
  TITLE.on = true; TITLE.save = save; TITLE.t = reducedMotion ? 0.645 : TITLE_T0; TITLE.k = 0;
  controls.enabled = false; kcontrols.enabled = false;
  if (VIEW.mode !== 'town') { VIEW.mode = 'town'; for (const id of ['#v-town', '#v-keep', '#v-mine']) $(id).setAttribute('aria-pressed', String(id === '#v-town')); }
  VIEW.tween = null; FOLLOW.v = null; UI.close();
  for (const id of ['qmark', 'hintcard']) { const el = document.getElementById(id); if (el) el.hidden = true; }   // the cast's "wants a word" and a tip wait for the claim
  $('#app').classList.add('titling');
  titleRender();
  $('#front').hidden = false;
  requestAnimationFrame(() => { const b = $('#front .tt-menu button:not([hidden])'); if (b && !matchMedia('(pointer:coarse)').matches) b.focus({ preventScroll: true }); });
}
function titleHide() {
  if (!TITLE.on) return;
  TITLE.on = false;
  $('#front').hidden = true; $('#app').classList.remove('titling');
  camera.clearViewOffset();
  controls.enabled = true;
}
// what the buttons say: Continue carries the open claim's day, chapter and people
function titleRender() {
  const S = saveSummary(TITLE.save), cont = $('#tt-continue');
  cont.hidden = !S;
  if (S) cont.querySelector('.tt-meta').textContent = `${slotName(SLOTS.active)} · ${summaryLine(S)}`;
  $('#tt-new').classList.toggle('primary', !S);
  const n = [1, 2, 3].filter(k => slotRaw(k)).length;
  $('#tt-claims').querySelector('.tt-meta').textContent = n ? `${n} of ${SLOT_N} in use` : 'Three places to keep a claim';
}
// the drift: slowly to and fro along the sunlit side of the plateau (the quarry face round to the west), rising and
// falling a little, while the light goes from golden hour into the first of dusk and the lamps come on
const _tt = new THREE.Vector3();
function titleFrame(rdt) {
  const calm = reducedMotion;
  TITLE.k = Math.min(1, TITLE.k + rdt / 2.5);
  if (!calm) { TITLE.clock = (TITLE.clock || 0) + rdt; TITLE.t = Math.min(TITLE_T1, TITLE.t + rdt * (TITLE_T1 - TITLE_T0) / 40); }
  TITLE.ang = 2.35 + Math.sin((TITLE.clock || 0) * 0.021) * 0.75;
  const portrait = innerHeight > innerWidth, a = TITLE.ang, R = portrait ? 170 : 132, h = (portrait ? 80 : 56) + Math.sin((TITLE.clock || 0) * 0.033) * 5;
  _tt.set(Math.cos(a) * R, h, Math.sin(a) * R * 0.9 + 4);
  // ease in from wherever the camera was
  camera.position.lerp(_tt, TITLE.k >= 1 ? 1 : Math.min(1, rdt * 2.2));
  controls.target.set(0, portrait ? -6 : -3, 3);
  camera.lookAt(controls.target);
  const snd = $('#front .tt-snd'); if (snd && !snd.hidden && AUDIO.ready) snd.hidden = true;
  // on a wide screen the menu is on the left: shift the picture right so the claim sits beside it
  if (!portrait && innerWidth >= 760) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.16, 0, innerWidth, innerHeight);
  else camera.clearViewOffset();
  return TITLE.t;
}
// a new device: set the starting kit out round the Keep so the title has a town to show (taken away for a new claim)
const SHOWCASE = [['yard', -12, 14], ['yard', 14, 14], ['garden', 18, -10], ['shop', -16, -8], ['lens', -26, -24], ['lens', 30, -20]];
function titleShowcase() {
  for (const [t, x, z] of SHOWCASE) { const b = addBuilding(t, null, null, 1, { hint: [x, z] }); if (b) { b.pad.visible = false; TITLE.showcase.push(b); } }
  layoutChanged(true);
}
function undoShowcase() {
  if (!TITLE.showcase.length) return;
  for (const b of TITLE.showcase) if (TOWN.b[b.id] === b) removeBuilding(b);
  TITLE.showcase = []; TOWN.seq = {}; BUILD.kit = { ...KIT };
  layoutChanged(true);   // their workers were let go with them (removeBuilding), and take up their trades again when the kit is set out
  for (const v of GAME.villagers) v.replan = true;
}
$('#tt-continue').onclick = () => begin(false);
$('#tt-new').onclick = () => newClaimAsk();
$('#tt-claims').onclick = () => openClaims();
$('#tt-settings').onclick = () => openMenu();
$('#tt-about').onclick = () => openAbout();
// the claim on the page can go back to the title (Settings › Title screen): it's saved, and Continue picks it up again
function toTitle() {
  if (!started) return;
  saveGame(true);
  if (BUILD.on) exitBuild();
  if (STORY.shown) endScene();
  started = false; GAME.paused = false;
  TITLE.save = slotRead(SLOTS.active);
  titleShow(TITLE.save);
}

// is one of the front door's cards open over the claim (the settings, a sheet, How to play)? The claim waits meanwhile.
const frontOpen = () => !$('#menu').hidden || !$('#fd-sheet').hidden || !$('#intro').hidden;

// ----------------------------------------------------------------- a sheet over everything: claims, about, codes
function sheet(html, cls = '') {
  const el = $('#fd-sheet'), card = el.querySelector('.sheet-card');
  card.className = 'card sheet-card ' + cls; card.innerHTML = `<button type="button" class="x sheet-x" aria-label="Close">×</button>${html}`;
  card.querySelector('.sheet-x').onclick = sheetClose;
  el.hidden = false; card.scrollTop = 0;
  return card;
}
function sheetClose() { $('#fd-sheet').hidden = true; $('#fd-sheet .sheet-card').innerHTML = ''; }
$('#fd-sheet').addEventListener('click', e => { if (e.target.id === 'fd-sheet') sheetClose(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#fd-sheet').hidden) { e.stopImmediatePropagation(); sheetClose(); } }, true);

// New claim: straight in on an empty slot; otherwise ask, and offer an empty slot instead of replacing anything
function newClaimAsk() {
  const cur = slotSummary(SLOTS.active);
  if (!cur) return begin(true);
  const free = [1, 2, 3].find(n => !slotRaw(n));
  const c = sheet(`<p class="eyebrow">New claim</p><h2>Start a new claim?</h2>
    <p><b>${esc(slotName(SLOTS.active))}</b> is ${esc(summaryLine(cur))}. Starting over there replaces it, and its town and people are lost.</p>
    ${free ? `<p class="small">Or start the new one in <b>${esc(slotName(free))}</b>, which is empty, and keep this one too.</p>` : `<p class="small">All three claims are in use. To keep this one, carry it off first as a code (Settings › Saving).</p>`}
    <div class="sheet-acts">${free ? `<button type="button" class="btn primary" id="nc-free">Start in ${esc(slotName(free))}</button>` : ''}
      <button type="button" class="btn danger" id="nc-over">Replace ${esc(slotName(SLOTS.active))}</button><button type="button" class="btn" id="nc-no">Cancel</button></div>`);
  if (free) c.querySelector('#nc-free').onclick = () => reloadInto(free, 'new');
  c.querySelector('#nc-over').onclick = () => { slotClear(SLOTS.active); reloadInto(SLOTS.active, 'new'); };
  c.querySelector('#nc-no').onclick = sheetClose;
}

// Claims: the three slots, named by the player
function openClaims() {
  const rows = [1, 2, 3].map(n => {
    const S = slotSummary(n), open = n === SLOTS.active;
    return `<div class="cl-slot ${open ? 'open' : ''} ${S ? '' : 'empty'}" data-n="${n}">
      <div class="slot-top"><input class="slot-name" value="${esc(slotName(n))}" maxlength="28" aria-label="Name of claim ${n}" spellcheck="false"><span class="pen" aria-hidden="true">✎</span>${open ? '<span class="chip amber">Open now</span>' : ''}</div>
      <p class="small">${S ? `${esc(summaryLine(S))} · saved ${esc(ago(S.savedAt))}` : 'Empty: a place for another claim.'}</p>
      <div class="slot-acts">${S ? `<button type="button" class="btn ${open ? 'primary' : ''}" data-act="play">${open ? 'Continue' : 'Open this claim'}</button><button type="button" class="btn danger" data-act="del">Delete</button>`
        : `<button type="button" class="btn" data-act="new">Start a new claim here</button>`}</div>
      <div class="confirm" hidden><p>Delete <b>${esc(slotName(n))}</b>? Its town and people will be gone for good.</p><div class="row"><button type="button" class="btn" data-act="keep">Keep it</button><button type="button" class="btn danger" data-act="kill">Delete it</button></div></div>
    </div>`;
  }).join('');
  const c = sheet(`<p class="eyebrow">Your claims</p><h2>Three claims</h2><p class="small">Each is a whole town of its own, saved in this browser. Tap a name to rename it. To carry one to another device, open it and use Settings › Saving.</p><div class="cl-slots">${rows}</div>
    <div class="sheet-acts"><button type="button" class="btn" id="cl-import">Load a claim from a code</button></div>`, 'claims');
  for (const row of c.querySelectorAll('.cl-slot')) {
    const n = +row.dataset.n, inp = row.querySelector('.slot-name');
    inp.onchange = () => { SLOTS.names[n] = inp.value.trim(); slotsKeep(); if (!$('#front').hidden) titleRender(); };
    inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
    for (const b of row.querySelectorAll('[data-act]')) b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'play') { if (n === SLOTS.active) { sheetClose(); if (!started) begin(false); } else reloadInto(n, 'continue'); }
      if (a === 'new') { if (!started && TITLE.showcase.length && !slotRaw(SLOTS.active)) { SLOTS.active = n; slotsKeep(); sheetClose(); begin(true); } else reloadInto(n, 'new'); }
      if (a === 'del') row.querySelector('.confirm').hidden = false;
      if (a === 'keep') row.querySelector('.confirm').hidden = true;
      if (a === 'kill') { slotClear(n); delete SLOTS.names[n]; slotsKeep(); if (n === SLOTS.active) { reloadInto(n, null); return; } openClaims(); if (!$('#front').hidden) titleRender(); }
    };
  }
  c.querySelector('#cl-import').onclick = () => openImport();
}

// About: who made it, and where its pictures came from
function openAbout() {
  sheet(`<p class="eyebrow">About</p><h2>Brightvein</h2>
    <p>A sunstone claim on a plateau under the Thinning, in Aethermoor: Chris’s world, first made for his tabletop games.</p>
    <h3>Made by</h3><p><b>Chris</b>, who dreamed up the claim, its people and its nights, and tries every step of it on his phone.</p>
    <h3>Borrowed from Chris’s other games</h3>
    <ul class="about-list">
      <li><b>His airship game in Aethermoor</b>: the skies, the six ships and how they fly and fight, the raiders and the map.</li>
      <li><b>Envoi on the Longest Night</b> and <b>the Moon Faire</b>: the looks and portraits the visiting cast wear here, hundreds of years later, as new people.</li>
      <li><b>Briarwatch</b>: the painted stone, timber, slate and turf the claim is built from.</li>
    </ul>
    <h3>Pictures</h3><p>The cast’s portraits, the settlers’ faces, the item pictures and the day events’ cards were generated by Chris for Brightvein. Everyone else is drawn pixel by pixel in the game’s own code.</p>
    <h3>Sound</h3><p>The music is written as notes and played live in your browser, with every effect made on the spot: there are no sound files.</p>
    <p class="small">Built with three.js. Version ${esc(BV_VERSION)}.</p>
    <div class="sheet-acts"><button type="button" class="btn primary" id="ab-ok">Back</button></div>`, 'about').querySelector('#ab-ok').onclick = sheetClose;
}
const BV_VERSION = '0.5';

// ----------------------------------------------------------------- carrying a claim: export and import
async function openExport() {
  if (!slotRaw(SLOTS.active) && !started) {
    sheet(`<p class="eyebrow">Carry a claim</p><h2>Nothing to carry yet</h2><p>${esc(slotName(SLOTS.active))} is empty. Start a claim (or open one from Claims), and this is where you’ll get its code.</p>
      <div class="sheet-acts"><button type="button" class="btn primary" id="ex-ok">Back</button></div>`, 'codes').querySelector('#ex-ok').onclick = sheetClose;
    return;
  }
  const c = sheet(`<p class="eyebrow">Carry this claim</p><h2>${esc(slotName(SLOTS.active))}</h2>
    <p class="small" id="ex-sum"></p>
    <textarea id="ex-code" class="code" readonly rows="5" aria-label="The claim’s code" placeholder="Making the code…"></textarea>
    <p class="small" id="ex-len"></p>
    <div class="sheet-acts"><button type="button" class="btn primary" id="ex-copy" disabled>Copy the code</button><button type="button" class="btn" id="ex-file" disabled>Save as a file</button></div>
    <p class="small" id="ex-note"></p>
    <ol class="steps"><li>Send the code to yourself (a message or an email), or keep the file.</li><li>Open Brightvein on the other device, then <b>Claims › Load a claim from a code</b> on the title screen (or Settings › Saving).</li><li>Paste it in. Everything comes along: the town, its people, the stash, the fleet and the story.</li></ol>
    <p class="small">The code is the claim as it is right now. Keep playing here and it falls behind.</p>`, 'codes');
  let code;
  try { code = await exportCode(); } catch (e) { c.querySelector('#ex-note').textContent = 'The code couldn’t be made: ' + (e.message === 'empty' ? 'there’s nothing saved yet.' : 'this browser refused.'); return; }
  const S = slotSummary(SLOTS.active); c.querySelector('#ex-sum').textContent = S ? summaryLine(S) : '';   // after the export saved it: the claim as it is now
  const ta = c.querySelector('#ex-code'); ta.value = code;
  c.querySelector('#ex-len').textContent = `${code.length.toLocaleString()} letters. Copy all of it: one letter missing and it won’t open.`;
  const copy = c.querySelector('#ex-copy'), file = c.querySelector('#ex-file'), note = c.querySelector('#ex-note');
  copy.disabled = file.disabled = false;
  copy.onclick = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { }
    if (!ok) { ta.focus(); ta.select(); try { ok = document.execCommand('copy'); } catch (e) { } }
    note.textContent = ok ? 'Copied. Paste it wherever you like.' : 'This browser won’t copy for us. The code is selected: copy it yourself (hold on it, or Ctrl+C).';
    if (ok) AUDIO.play('chime');
  };
  file.onclick = async () => {
    const S2 = slotSummary(SLOTS.active);
    try {
      const how = await downloadText(`brightvein-${fileSafe(slotName(SLOTS.active))}-day-${S2 ? S2.day : 1}.txt`, code);
      note.textContent = how === 'saved' ? 'Saved as a file.' : 'Saved as a file (look in your downloads). If nothing appeared, use Copy instead.';
    } catch (e) {
      note.textContent = e && e.code === 'declined' ? 'Not saved. Tap Save as a file again, or use Copy instead.'
        : e && e.code === 'rate_limited' ? 'A save is already waiting for an answer. Try again in a moment.'
        : 'This browser won’t save files from here. Use Copy instead.';
    }
  };
  ta.onfocus = () => ta.select();
}
function openImport() {
  const c = sheet(`<p class="eyebrow">Load a claim</p><h2>From a code</h2>
    <p class="small">Paste the code from your other device (it starts with BV1), or open the file you saved.</p>
    <textarea id="im-code" class="code" rows="5" aria-label="Paste the code here" placeholder="Paste the code here" spellcheck="false" autocomplete="off"></textarea>
    <div class="sheet-acts"><button type="button" class="btn" id="im-file">Open a file…</button><input type="file" id="im-pick" accept=".txt,.json,text/plain,application/json" hidden></div>
    <div id="im-state" class="im-state" aria-live="polite"></div>
    <div id="im-where" hidden><h3>Put it in</h3><div class="cl-picks" role="group" aria-label="Which claim to put it in"></div></div>
    <div class="sheet-acts"><button type="button" class="btn primary" id="im-go" disabled>Load this claim</button><button type="button" class="btn" id="im-no">Cancel</button></div>`, 'codes');
  const ta = c.querySelector('#im-code'), st = c.querySelector('#im-state'), go = c.querySelector('#im-go'), where = c.querySelector('#im-where');
  let found = null, slot = [1, 2, 3].find(n => !slotRaw(n)) || SLOTS.active, seq = 0;
  const pickRow = () => {
    const box = where.querySelector('.cl-picks'); box.innerHTML = '';
    for (const n of [1, 2, 3]) {
      const S = slotSummary(n), b = document.createElement('button'); b.type = 'button'; b.className = 'cl-pick';
      b.setAttribute('aria-pressed', String(n === slot));
      b.innerHTML = `<b>${esc(slotName(n))}</b><span>${S ? `Day ${S.day}: will be replaced` : 'Empty'}</span>`;
      b.onclick = () => { slot = n; pickRow(); }; box.append(b);
    }
  };
  const check = async () => {
    const my = ++seq, text = ta.value; found = null; go.disabled = true; where.hidden = true;
    if (!text.trim()) { st.className = 'im-state'; st.textContent = ''; return; }
    st.className = 'im-state'; st.textContent = 'Checking…';
    try {
      const s = await importCode(text); if (my !== seq) return;
      found = s; const S = saveSummary(s);
      st.className = 'im-state ok'; st.innerHTML = `<b>A claim${s.name ? `: ${esc(s.name)}` : ''}.</b> ${esc(summaryLine(S))}${S.savedAt ? ` · saved ${esc(ago(S.savedAt))}` : ''}.`;
      where.hidden = false; pickRow(); go.disabled = false;
    } catch (e) { if (my !== seq) return; st.className = 'im-state bad'; st.textContent = codeWhy(e); }
  };
  ta.addEventListener('input', () => { clearTimeout(ta._t); ta._t = setTimeout(check, 250); });
  const pick = c.querySelector('#im-pick');
  c.querySelector('#im-file').onclick = () => pick.click();
  pick.onchange = async () => { const f = pick.files && pick.files[0]; if (!f) return; if (f.size > 8e6) { st.className = 'im-state bad'; st.textContent = 'That file is far too big to be a claim.'; return; } ta.value = await f.text(); check(); };
  c.querySelector('#im-no').onclick = sheetClose;
  go.onclick = () => {
    if (!found) return;
    try { slotWrite(slot, found); } catch (e) { st.className = 'im-state bad'; st.textContent = 'This browser’s storage is full, so the claim couldn’t be kept. Delete a claim you don’t need (Claims) and try again.'; return; }
    if (found.name) SLOTS.names[slot] = found.name;
    if (started && slot !== SLOTS.active) saveGame(true);
    reloadInto(slot, 'continue');
  };
  requestAnimationFrame(() => ta.focus());
}

// ----------------------------------------------------------------- the first look, for a new player (and How to play)
let INTRO_HELP = false;
function introShow(help) {
  INTRO_HELP = !!help;
  $('#ix-go').textContent = help ? (started ? 'Back to the claim' : 'Back') : 'Lay out the claim';
  $('#ix-next').hidden = !!help; $('#ix-controls').hidden = !help;
  $('#ix-controls').textContent = matchMedia('(pointer:coarse)').matches ? 'Drag to move · pinch to zoom · two fingers to turn · tap anyone or anything' : 'Drag to move · scroll to zoom · right-drag to turn · click anyone or anything · Space pauses';
  $('#intro').hidden = false;
}
function introClose() {
  if ($('#intro').hidden) return;
  $('#intro').hidden = true;
  try { localStorage.setItem('bv-seen-intro', '1'); } catch (e) { }
  INTRO_HELP = false;
}
const introSeen = () => { try { return !!localStorage.getItem('bv-seen-intro'); } catch (e) { return false; } };
$('#ix-go').onclick = () => { introClose(); AUDIO.play('tap'); };
