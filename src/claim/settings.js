// ===================================================================== SETTINGS: one panel for how the game looks, plays and saves
// Kept in this browser under 'bv-settings' (the picture's detail keeps its own old key, 'bv-quality'; the sound's
// volumes are AUDIO's). Text size scales the words in panels, cards and scenes; camera speed scales turning, zooming
// and panning; less motion stills the camera shake, the sliding cards and the title's drift (it follows the device's
// own setting until it's changed here); autosave saves the open claim every few minutes (and when the page is hidden);
// the speed limits cap the fast-forward and can drop it back to 1× when night falls; tips are the first-time hints.
const DEVICE_CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SETTINGS = { text: 1, cam: 1, calm: null, autosave: true, every: 1, fastest: 4, nightSlow: false, hints: true };
try { const s = JSON.parse(localStorage.getItem('bv-settings')); if (s && typeof s === 'object') for (const k of Object.keys(SETTINGS)) if (k in s) SETTINGS[k] = s[k]; } catch (e) { }
function settingsKeep() { try { localStorage.setItem('bv-settings', JSON.stringify(SETTINGS)); } catch (e) { } }
const QUALITY_TEXT = {
  light: 'For phones and older computers: no glow or soft focus, simpler shadows, fewer raindrops and sparks, drawn at the screen’s plain sharpness.',
  balanced: 'Glow on the lamps and crystal, the soft-focus lens, soft shadows, drawn a little sharper. Good for most computers and newer phones.',
  high: 'Everything on and as sharp as the screen can show. For a strong computer.',
};
// what can be applied before the claim is built (the page's look); the camera's speed waits for the controls
function applyLookSettings() {
  reducedMotion = SETTINGS.calm == null ? DEVICE_CALM : !!SETTINGS.calm;
  const app = $('#app'); app.classList.toggle('calm', reducedMotion);
  app.style.setProperty('--tz', String(SETTINGS.text || 1));
  const sky = document.getElementById('sky'); if (sky) sky.style.setProperty('--tz', String(SETTINGS.text || 1));   // the skies' words too (sky.css)
}
applyLookSettings();
function applyCamSettings() {
  const k = clamp(+SETTINGS.cam || 1, 0.4, 2.5);
  controls.rotateSpeed = k; controls.zoomSpeed = k; controls.panSpeed = k;
}
const camK = () => clamp(+SETTINGS.cam || 1, 0.4, 2.5);
// the game speed: the fast-forward button steps up to the fastest allowed, then back to 1×
const SPEEDS = [1, 2, 3, 4];
function setSpeed(s) {
  GAME.speed = clamp(s, 1, SETTINGS.fastest);
  const b = $('#b-speed'); if (b) b.textContent = GAME.speed + '×';
  if ($('#menu') && !$('#menu').hidden) syncMenu();
}
const nextSpeed = () => { const i = SPEEDS.indexOf(GAME.speed), n = SPEEDS[i + 1]; return n && n <= SETTINGS.fastest ? n : 1; };

// ----------------------------------------------------------------- the panel
function syncMenu() {
  const press = (sel, test) => { for (const b of document.querySelectorAll(sel)) b.setAttribute('aria-pressed', String(!!test(b))); };
  press('#q-seg button', b => b.dataset.q === QUALITY.level);
  $('#q-note').textContent = QUALITY_TEXT[QUALITY.level] || '';
  press('#tz-seg button', b => +b.dataset.z === +SETTINGS.text);
  press('#spd-seg button', b => +b.dataset.s === GAME.speed);
  for (const b of document.querySelectorAll('#spd-seg button')) b.disabled = +b.dataset.s > SETTINGS.fastest;
  press('#fast-seg button', b => +b.dataset.f === SETTINGS.fastest);
  press('#as-seg button', b => (SETTINGS.autosave ? String(SETTINGS.every) : 'off') === b.dataset.a);
  const tog = (id, on, yes = 'On', no = 'Off') => { const b = $(id); b.setAttribute('aria-pressed', String(!!on)); b.textContent = on ? yes : no; };
  tog('#calm-btn', reducedMotion); tog('#night-btn', SETTINGS.nightSlow); tog('#tips-btn', SETTINGS.hints); tog('#b-sound', AUDIO.on);
  $('#calm-note').textContent = SETTINGS.calm == null ? `Following this device’s setting (${DEVICE_CALM ? 'less motion' : 'full motion'}).` : 'Set here, not by the device.';
  const cam = $('#cam-rng'); cam.value = Math.round(camK() * 100); $('#cam-v').textContent = camK().toFixed(1).replace(/\.0$/, '') + '×';
  // (opened over the skies: no title screen, starting over or the claim's first look from there)
  const sky = !!(SKY && SKY.on);
  $('#b-title').hidden = !started || sky; $('#b-save-now').hidden = !started; $('#b-reset').hidden = !started || sky; $('#b-help').hidden = sky;
  $('#menu-close').textContent = sky ? 'Back to the skies' : started ? 'Back to the claim' : 'Done';
  skyRows();
}
// the skies' own rows (src/sky/settings.js: aim speed, up and down, camera shake, Fire on the left on a phone, the
// tips for a new Captain), drawn from their list; each takes effect in the skies at once
function skyRows() {
  const box = $('#sky-rows'); if (!box || !SKY) return;
  const S = SKY.settings, D = S.data;
  if (!box.childElementCount) {
    for (const r of S.ROWS) {
      const row = document.createElement('div'); row.className = 'row'; row.dataset.id = r.id;
      const label = `<span>${esc(r.label)}</span>`;
      if (r.kind === 'choice') {
        row.innerHTML = `${label}<div class="seg" role="group" aria-label="${esc(r.label)}">${r.options.map(([v, t], i) => `<button type="button" data-i="${i}">${esc(t)}</button>`).join('')}</div>`;
        row.querySelectorAll('button').forEach(b => { b.onclick = () => { S.set(r.id, r.options[+b.dataset.i][0]); syncMenu(); }; });
      } else {
        row.innerHTML = `${label}<span class="mc-pair"><button type="button" class="btn tog" aria-pressed="false">On</button>${r.id === 'tips' ? '<button type="button" class="btn" id="sky-tips-again">Show again</button>' : ''}</span>`;
        row.querySelector('.tog').onclick = () => { S.set(r.id, !D[r.id]); syncMenu(); };
        if (r.id === 'tips') row.querySelector('#sky-tips-again').onclick = () => { SKY.tipsAgain(); syncMenu(); flash('#sky-tips-again', 'They’ll show again'); };
      }
      box.append(row);
      if (r.note) { const p = document.createElement('p'); p.className = 'small'; p.textContent = r.note; box.append(p); }
    }
  }
  for (const row of box.querySelectorAll('.row')) {
    const r = S.ROWS.find(x => x.id === row.dataset.id); if (!r) continue;
    if (r.kind === 'choice') row.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(r.options[+b.dataset.i][0] === D[r.id])));
    else { const b = row.querySelector('.tog'); b.setAttribute('aria-pressed', String(!!D[r.id])); b.textContent = D[r.id] ? 'On' : 'Off'; }
  }
}
// saving: which claim is open, and when it was last saved (read from the save itself, so only when the panel opens)
function menuSaveLine() {
  const S = slotSummary(SLOTS.active);
  // the claim as it is on the page (the save may be a minute behind it), and when it was last saved
  const now = started ? { day: GAME.day, chapter: chapterLabel(STORY.ch), people: GAME.villagers.length } : S;
  $('#save-where').innerHTML = `<b>${esc(slotName(SLOTS.active))}</b> · ${now ? esc(summaryLine(now)) + ' · ' : ''}${S ? `saved ${esc(ago(S.savedAt))}` : 'not saved yet'}`;
}
// opening the settings moves focus into them, and closing gives it back to whatever opened them (the keyboard's way round)
let menuOpener = null;
function openMenu() {
  const a = document.activeElement; menuOpener = a && a !== document.body && !a.closest('#menu') ? a : null;
  $('#menu').hidden = false; $('#reset-confirm').hidden = true; syncMenu(); menuSaveLine(); const c = $('#menu .menu-card'); if (c) { c.scrollTop = 0; c.tabIndex = -1; c.focus({ preventScroll: true }); }
}
function closeMenu() {
  const inside = $('#menu').contains(document.activeElement);
  $('#menu').hidden = true; $('#reset-confirm').hidden = true;
  if (inside && menuOpener && menuOpener.isConnected && menuOpener.offsetParent) menuOpener.focus({ preventScroll: true });
  menuOpener = null;
}
$('#b-menu').onclick = openMenu;
$('#menu-close').onclick = closeMenu;
$('#menu-x').onclick = () => $('#menu-close').click();
$('#menu').addEventListener('click', e => { if (e.target.id === 'menu') $('#menu-close').click(); });
for (const b of document.querySelectorAll('#q-seg button')) b.onclick = () => {
  QUALITY.level = b.dataset.q; try { localStorage.setItem('bv-quality', QUALITY.level); } catch (e) { } applyQuality(); syncMenu();
  if (SKY) SKY.settings.changed('picture');   // the skies' picture follows it (src/sky/settings.js PICTURE_OF)
  if (DOCK.ship && DOCK.ship.dockParts) dockFarAgain(DOCK.ship);   // and the moored ship's stand-in on Light (dock.js)
};
for (const b of document.querySelectorAll('#tz-seg button')) b.onclick = () => { SETTINGS.text = +b.dataset.z; settingsKeep(); applyLookSettings(); syncMenu(); };
$('#calm-btn').onclick = () => { SETTINGS.calm = !reducedMotion; settingsKeep(); applyLookSettings(); syncMenu(); };
$('#cam-rng').addEventListener('input', e => { SETTINGS.cam = Math.round(+e.target.value / 10) / 10; settingsKeep(); applyCamSettings(); syncMenu(); });
for (const b of document.querySelectorAll('#spd-seg button')) b.onclick = () => setSpeed(+b.dataset.s);
for (const b of document.querySelectorAll('#fast-seg button')) b.onclick = () => { SETTINGS.fastest = +b.dataset.f; settingsKeep(); if (GAME.speed > SETTINGS.fastest) setSpeed(SETTINGS.fastest); syncMenu(); };
$('#night-btn').onclick = () => { SETTINGS.nightSlow = !SETTINGS.nightSlow; settingsKeep(); syncMenu(); };
$('#tips-btn').onclick = () => { SETTINGS.hints = !SETTINGS.hints; settingsKeep(); if (!SETTINGS.hints) hintClose(); syncMenu(); };
$('#tips-again').onclick = () => { hintsReset(); SETTINGS.hints = true; settingsKeep(); syncMenu(); flash('#tips-again', 'They’ll show again'); };
// a button says what it did for a moment (toasts wait while the settings are open)
function flash(sel, text) { const b = $(sel); if (!b._was) b._was = b.textContent; b.textContent = text; clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = b._was; b._was = null; }, 1800); }
for (const b of document.querySelectorAll('#as-seg button')) b.onclick = () => { const a = b.dataset.a; SETTINGS.autosave = a !== 'off'; if (a !== 'off') SETTINGS.every = +a; settingsKeep(); autosaveT = autosaveEvery(); syncMenu(); };
$('#b-sound').onclick = () => { AUDIO.start(); AUDIO.set(!AUDIO.on); syncMenu(); };
$('#b-save-now').onclick = () => { if (!started) return; const ok = saveGame(true); menuSaveLine(); flash('#b-save-now', ok ? 'Saved ✓' : 'Not saved'); };
$('#b-export').onclick = () => openExport();
$('#b-import').onclick = () => openImport();
$('#b-help').onclick = () => { closeMenu(); introShow(true); };
$('#b-title').onclick = () => { closeMenu(); toTitle(); };
$('#b-reset').onclick = () => { $('#reset-confirm').hidden = false; $('#reset-confirm').scrollIntoView({ block: 'nearest' }); };
$('#reset-no').onclick = () => { $('#reset-confirm').hidden = true; };
$('#reset-yes').onclick = () => { slotClear(SLOTS.active); reloadInto(SLOTS.active, 'new'); };

// ----------------------------------------------------------------- autosave
// every few minutes of play (real time), and whenever the page is put away
const autosaveEvery = () => (SETTINGS.every || 1) * 60;
let autosaveT = autosaveEvery();
function autosaveTick(rdt) {
  if (!started || !SETTINGS.autosave) return;
  if ((autosaveT -= rdt) <= 0) { autosaveT = autosaveEvery(); saveGame(); }
}
// night falls: back to 1× if asked
function nightSlowCheck() { if (SETTINGS.nightSlow && GAME.speed > 1) { setSpeed(1); toast('Night falls: back to 1× speed.', 'night'); } }
