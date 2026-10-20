// ===================================================================== SAVES: three claims, and codes to carry them
// Each claim is saved in this browser under its slot's key. Slot 1 keeps the key the game has always used, so a claim
// saved before there were slots is simply claim 1; claims 2 and 3 have keys of their own. Which claim is open, and the
// names the player gave them, are kept under 'bv-slots'. saveGame and loadSave (main.js) work on the open claim.
// A claim travels to another device as a code: the save squeezed (deflate, where the browser can) and written in
// base64, with a check at the end, so a code that lost or changed a few letters on the way is caught and refused
// instead of loading half a claim. The same code can go in a file.
// A save that can't be used is never the end of a claim: what can be mended is mended as it's opened (safeMend), a
// claim that still won't open is put aside under a key of its own and the title says so, with a way on (safeBroken),
// and a fault in one part of saving keeps that part's last good copy instead of stopping every save after it (safePart).
const SAVE_KEY = 'brightvein-keep-v1';
const SLOT_N = 3;
const SLOTS = { active: 1, names: {} };
try { const s = JSON.parse(localStorage.getItem('bv-slots')); if (s) { SLOTS.active = clamp(s.active | 0 || 1, 1, SLOT_N); SLOTS.names = s.names && typeof s.names === 'object' ? s.names : {}; } } catch (e) { }
const slotKey = n => n === 1 ? SAVE_KEY : SAVE_KEY + '-s' + n;
const slotName = n => (SLOTS.names[n] || '').trim() || `Claim ${n}`;
function slotsKeep() { try { localStorage.setItem('bv-slots', JSON.stringify(SLOTS)); } catch (e) { } }
function slotRaw(n) { try { return localStorage.getItem(slotKey(n)); } catch (e) { return null; } }
// a claim's save as it is stored
function slotRead(n) {
  try { const s = JSON.parse(slotRaw(n)); if (s && s.v === 2) return s; } catch (e) { }
  return null;
}
function slotWrite(n, s) { localStorage.setItem(slotKey(n), typeof s === 'string' ? s : JSON.stringify(s, safeJSON)); }
function slotClear(n) { try { localStorage.removeItem(slotKey(n)); } catch (e) { } }
// a claim in a few words, for the title screen and the claims list: day, chapter, people, when it was saved
function chapterLabel(ch) {
  const C = CHAPTERS[ch];
  if (!C) return 'The story so far is told';
  return `${ch ? `Chapter ${ch}` : 'Prologue'} · ${C.title}`;
}
function saveSummary(s) {
  if (!s) return null;
  const P = Array.isArray(s.people) ? s.people.filter(safeObj) : [], B = Array.isArray(s.buildings) ? s.buildings.filter(safeObj) : [], ch = safeObj(s.story) ? safeNum(s.story.ch, 0) : 0;
  return { day: safeNum(s.day, 1), ch, chapter: chapterLabel(ch), people: P.length, guests: P.filter(p => p.hero).length, savedAt: safeNum(s.savedAt, 0),
    keep: (B.find(b => b.type === 'keep') || {}).level || 1, setupDone: s.setupDone !== false };
}
function slotSummary(n) { return saveSummary(slotRead(n)); }
const ago = t => {
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
  if (s < 86400 * 1.5) { const h = Math.round(s / 3600); return h === 1 ? 'an hour ago' : `${h} hours ago`; }
  const d = Math.round(s / 86400); return d < 14 ? `${d} days ago` : new Date(t).toLocaleDateString();
};
const summaryLine = S => S ? `Day ${S.day} · ${S.chapter} · ${S.people} ${S.people === 1 ? 'person' : 'people'}` : 'Empty';

// ----------------------------------------------------------------- codes
// BV1z.<base64url of the deflated save>.<check>   (z: deflate-raw, g: gzip, p: not squeezed, for old browsers)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function toB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2], n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (b === undefined ? '' : B64[n >> 6 & 63]) + (c === undefined ? '' : B64[n & 63]);
  }
  return out;
}
function fromB64(str) {
  const L = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) L[B64.charCodeAt(i)] = i;
  L[43] = 62; L[47] = 63;   // a code that went through something that turned it into plain base64 (+ and /)
  const n = str.length, out = new Uint8Array(Math.floor(n * 3 / 4));
  let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < n; i++) {
    const c = str.charCodeAt(i), v = c < 128 ? L[c] : -1;
    if (v < 0) { if (c === 61) break; throw new Error('letters'); }   // '=' padding ends it
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; }
  }
  return out.subarray(0, o);
}
// a short check (CRC-32, as 7 letters of base 36) so a damaged code is refused
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_T[(c ^ bytes[i]) & 255] ^ (c >>> 8); return ((c ^ 0xFFFFFFFF) >>> 0).toString(36).padStart(7, '0'); }
async function streamBytes(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
async function squeeze(bytes) {
  for (const [k, fmt] of [['z', 'deflate-raw'], ['g', 'gzip']]) {
    try { if (typeof CompressionStream === 'function') return { k, body: await streamBytes(bytes, new CompressionStream(fmt)) }; } catch (e) { }
  }
  return { k: 'p', body: bytes };
}
async function unsqueeze(k, body) {
  if (k === 'p') return body;
  const fmt = k === 'z' ? 'deflate-raw' : 'gzip';
  if (typeof DecompressionStream !== 'function') throw new Error('old');
  try { return await streamBytes(body, new DecompressionStream(fmt)); } catch (e) { if (e.message === 'old') throw e; throw new Error('broken'); }
}
// the open claim, as a code (saved first, so the code is the claim as it is right now)
async function exportCode(n = SLOTS.active) {
  if (n === SLOTS.active && started) saveGame(true);
  const raw = slotRaw(n); if (!raw) throw new Error('empty');
  const bytes = new TextEncoder().encode(raw), { k, body } = await squeeze(bytes);
  return `BV1${k}.${toB64(body)}.${crc32(body)}`;
}
// What can go wrong with a code, in words a player can act on
const CODE_WHY = {
  empty: 'There’s nothing here yet. Paste the whole code, from BV1 to the end.',
  notcode: 'That doesn’t look like a Brightvein code. A code starts with BV1 and is one long run of letters and numbers.',
  broken: 'This code is broken: some of it is missing or changed. Copy the whole code again, from BV1 to the very end, and paste it in one piece.',
  old: 'This browser is too old to open a squeezed code. Try another browser, or update this one.',
  notclaim: 'The code opened, but there’s no claim inside it.',
  newer: 'This code comes from a newer Brightvein than this one. Open the game again so it updates, then try once more.',
};
// read a code (or the save itself, from a file), check it every way we can, and return the save
async function importCode(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) throw new Error('empty');
  let s;
  if (t[0] === '{') { try { s = JSON.parse(String(text)); } catch (e) { throw new Error('broken'); } }
  else {
    const m = /^BV(\d)([zgp])\.([A-Za-z0-9\-_+/=]+)\.([0-9a-z]{1,8})$/.exec(t);
    if (!m) throw new Error(/^BV\d/.test(t) ? 'broken' : 'notcode');
    if (+m[1] > 1) throw new Error('newer');
    let body; try { body = fromB64(m[3]); } catch (e) { throw new Error('broken'); }
    if (crc32(body) !== m[4].padStart(7, '0')) throw new Error('broken');
    const bytes = await unsqueeze(m[2], body);
    try { s = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error('broken'); }
  }
  if (!s || typeof s !== 'object' || s.v !== 2 || !Array.isArray(s.people) || !Array.isArray(s.buildings) || !s.people.length || typeof s.day !== 'number') throw new Error(s && s.v > 2 ? 'newer' : 'notclaim');
  safeMend(s);   // each person is checked: one that can't be read is left out, and a claim with nobody left is refused
  if (!s.people.length) throw new Error('notclaim');
  return s;
}
const codeWhy = e => CODE_WHY[e && e.message] || CODE_WHY.broken;
// a file with the code in it, to save on this device. At Chris's claude.ai link the page may not start a download itself,
// so it asks the viewer through the artifact's downloads capability (they confirm the save); a copy opened as a plain
// file has no window.claude and uses an ordinary download link. Rejects with { code } (e.g. 'declined') when not saved.
async function downloadText(name, text) {
  let dl = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) { await dl.save({ filename: name, data: text }); return 'saved'; }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'linked';
}
const fileSafe = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'claim';

// ----------------------------------------------------------------- switching claims
// The claim on screen was built from one save; another claim means building the page again. A note in this tab's
// session says what to do once it's up (go straight in, or start a new claim), so the title isn't shown twice.
// Once the page is on its way to another claim nothing more is saved, or the claim on the page would write itself back
// over the slot just cleared or loaded (the page saves as it closes).
const GO_KEY = 'bv-go';
let leaving = false;
function reloadInto(slot, go) {
  leaving = true;
  SLOTS.active = slot; slotsKeep();
  try { if (go) sessionStorage.setItem(GO_KEY, go); } catch (e) { }
  location.reload();
}
function takeGo() { try { const g = sessionStorage.getItem(GO_KEY); sessionStorage.removeItem(GO_KEY); return g; } catch (e) { return null; } }

// ----------------------------------------------------------------- mending a save as it's opened
// A save is used as it is, except for what can't be used. A number that's missing or isn't a number takes its starting
// value; a person with nothing to say how able they are is left out (rather than the whole claim); a missing look is
// drawn afresh; a study in a room that isn't furnished ends. A save that's already sound comes through unchanged.
// When something had to be left out, the save as it was is kept aside first (safeBackup), so nothing is lost for good.
const SAFE = { notes: [], lost: [], faults: [], seen: new Set(), told: false, parts: {}, nums: {}, failed: [], broken: null };
const SAFE_NUMS = { day: 1, t: 0.14, ore: 24, shards: 150, food: 40, recruit: 0, nights: 0, nextId: 1 };
const SAFE_STATS = ['G', 'E', 'A', 'R', 'S'];
const safeNum = (v, d) => typeof v === 'number' && Number.isFinite(v) ? v : d;
const safeObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const safeStudyName = i => (STUDY[(GAME.rooms[i] || {}).type] || {}).name || 'a study';   // a study in a room with no kind (ui.js)
function safeMend(s) {
  const notes = [];
  let lost = false;
  for (const [k, d] of Object.entries(SAFE_NUMS)) if (typeof s[k] !== 'number' || !Number.isFinite(s[k])) {
    if (k in s && (k === 'shards' || k === 'ore' || k === 'food')) { notes.push(`The claim’s ${k} couldn’t be read from its save, so they were set back to ${d}.`); lost = true; }
    s[k] = d;
  }
  if (s.day < 1 || s.day % 1) s.day = Math.max(1, Math.floor(s.day));
  if (s.t < 0 || s.t >= 1) s.t = ((s.t % 1) + 1) % 1;
  for (const k of ['story', 'night', 'weather', 'dig', 'workshop', 'sky', 'kit', 'cells', 'mats']) if (k in s && s[k] != null && !safeObj(s[k])) { delete s[k]; lost = true; }
  if (safeObj(s.mats)) for (const [k, v] of Object.entries(s.mats)) if (!Number.isFinite(v)) s.mats[k] = 0;
  if (s.stash != null && !Array.isArray(s.stash)) { delete s.stash; lost = true; }
  if (Array.isArray(s.stash) && s.stash.some(it => !safeObj(it))) { s.stash = s.stash.filter(safeObj); lost = true; }
  if (s.blueprints != null && !Array.isArray(s.blueprints)) s.blueprints = [];
  if (s.rooms != null && !Array.isArray(s.rooms)) delete s.rooms;
  if (Array.isArray(s.rooms)) s.rooms.forEach((r, i) => { if (!safeObj(r)) s.rooms[i] = { type: null, level: 0 }; else if (r.type && !STUDY[r.type]) r.type = null; });
  if (!Array.isArray(s.buildings)) { s.buildings = []; lost = true; }
  if (s.buildings.some(b => !safeObj(b) || typeof b.type !== 'string')) { s.buildings = s.buildings.filter(b => safeObj(b) && typeof b.type === 'string'); lost = true; }
  for (const b of s.buildings) if (b.level != null && (!Number.isFinite(b.level) || b.level < 1)) b.level = 1;
  // the people: each must have their abilities; the rest of a person can be mended
  if (!Array.isArray(s.people)) { s.people = []; lost = true; }
  const ids = new Set(), keep = [];
  let gone = 0;
  for (const d of s.people) {
    if (!safeObj(d) || !safeObj(d.stats)) { gone++; continue; }
    for (const k of SAFE_STATS) if (!Number.isFinite(d.stats[k])) d.stats[k] = 3;
    if (typeof d.name !== 'string' || !d.name.trim()) d.name = 'A settler with no name';
    if (!Number.isFinite(d.id) || ids.has(d.id)) d.id = null;
    else ids.add(d.id);
    if (!safeObj(d.look)) d.look = safeLook(d);
    if (d.gear != null && !safeObj(d.gear)) d.gear = {};
    if (d.job != null && !(safeObj(d.job) && typeof d.job.bid === 'string')) d.job = null;
    if (d.exp != null && !safeObj(d.exp)) d.exp = null;
    if (d.study != null && !(safeObj(d.study) && Array.isArray(s.rooms) && s.rooms[d.study.room] && s.rooms[d.study.room].type)) d.study = null;
    keep.push(d);
  }
  if (gone) { s.people = keep; lost = true; notes.push(`${gone === 1 ? 'One person' : gone + ' people'} on this claim couldn’t be read from its save, so they were left out. Everyone else is here.`); }
  for (const d of s.people) if (d.id == null) { while (ids.has(s.nextId)) s.nextId++; d.id = s.nextId++; ids.add(d.id); }
  const top = Math.max(0, ...ids); if (s.nextId <= top) s.nextId = top + 1;
  return { notes, lost };
}
// a look for someone whose save lost theirs: the cast's own, the roll's for a settler off it, or a new one
function safeLook(d) {
  if (d.hero && HERO_LOOKS[d.hero]) return { ...HERO_LOOKS[d.hero] };
  const f = typeof d.portrait === 'string' && FOLK.find(x => x.id === d.portrait);
  return randomLook(mulberry((d.seed | 0) || ((d.id | 0) * 7919 + 1)), f ? { ...f.look } : {});
}
// a saved building that won't fit where it stood looks for the nearest free spot to there (setupTown, town.js)
function safeHint(s) { const F = FOOT[s.type]; return Number.isFinite(s.tx) && Number.isFinite(s.tz) && F ? tileCenter(s.tx, s.tz, F.w, F.d) : undefined; }
// and one with no room left anywhere comes back as the shards it cost, once the claim's numbers are in (boot, main.js)
function safeRefundLost() {
  for (const s of SAFE.lost) {
    const D = DEFS[s.type]; if (!D || s.type === 'keep' || s.type === 'mast') continue;
    let r = BUY[s.type] || 0; for (let l = 2; l <= (s.level | 0); l++) r += (D.cost && D.cost[l]) || 0;
    GAME.shards += r;
    SAFE.notes.push(`There was no room left on the grid for a <b>${esc(D.name)}</b>, so the ${r} shards it cost came back.`);
  }
  SAFE.lost = [];
}
// the save as it was, kept aside in this browser under a key of its own (at most three for each claim; the same save once)
function safeBackup(n, raw) {
  if (!raw) return null;
  try {
    const pre = slotKey(n) + '-broken-', keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) keys.push(k); }
    keys.sort();
    for (const k of keys) if (localStorage.getItem(k) === raw) return k;
    while (keys.length >= 3) localStorage.removeItem(keys.shift());
    const key = pre + Date.now(); localStorage.setItem(key, raw); return key;
  } catch (e) { console.warn('[Brightvein] the save couldn’t be kept aside', e); return null; }
}
// The open claim's save, mended, for boot (main.js). A claim that couldn't be opened a moment ago in this tab isn't
// tried again (the page opened again without it, safeBroken); one whose save can't even be read is kept aside.
function safeOpen() {
  const n = SLOTS.active, broken = safeTakeBroken(), raw = slotRaw(n);
  if (broken || !raw) return { save: null, broken };
  let s = null; try { s = JSON.parse(raw); } catch (e) { }
  if (!safeObj(s) || s.v !== 2) return { save: null, broken: { slot: n, why: safeObj(s) && s.v > 2 ? 'newer' : 'unreadable', kept: safeBackup(n, raw) } };
  const M = safeMend(s);
  if (M.lost) safeBackup(n, raw);
  SAFE.notes = M.notes; SAFE.opening = true;   // a fault from here until the claim is open puts it aside (boot's catch, main.js)
  return { save: s, broken: null };
}
// The claim was mended as far as it would go and still didn't open: keep its save aside, and open the page again
// without it. The title then says so, with a way on (safeBrokenSheet). False if this tab can't hold the note.
const BROKEN_KEY = 'bv-broken';
function safeBroken(n, err) {
  console.error(`[Brightvein] claim ${n} couldn’t be opened:`, err);
  const kept = safeBackup(n, slotRaw(n));
  try { sessionStorage.setItem(BROKEN_KEY, JSON.stringify({ slot: n, why: String((err && err.message) || err).slice(0, 300), kept })); } catch (e) { return false; }
  leaving = true; location.reload(); return true;
}
function safeTakeBroken() {
  try { const B = JSON.parse(sessionStorage.getItem(BROKEN_KEY)); sessionStorage.removeItem(BROKEN_KEY); return B && B.slot === SLOTS.active ? B : null; } catch (e) { return null; }
}
// on the title: this claim couldn't be opened. Carry it off as a code, open another claim, or start fresh here.
function safeBrokenSheet(B) {
  SAFE.broken = B;
  const c = sheet(`<p class="eyebrow">${esc(slotName(B.slot))}</p><h2>This claim couldn’t be opened</h2>
    <p>${B.why === 'newer' ? 'It was saved by a newer Brightvein than this one. Open the game again so it updates, then try once more.' : 'Something in its save couldn’t be read, so it was set aside just as it was. Nothing in it has been changed.'}</p>
    <p class="small">You can carry it off as a code to keep it safe, open another claim, or start a fresh claim in its place. A copy stays put away in this browser either way.</p>
    <div class="sheet-acts"><button type="button" class="btn primary" id="bk-code">Carry it off as a code</button><button type="button" class="btn" id="bk-claims">Open another claim</button><button type="button" class="btn danger" id="bk-fresh">Start fresh</button></div>`, 'codes');
  c.querySelector('#bk-code').onclick = () => openExport();
  c.querySelector('#bk-claims').onclick = () => openClaims();
  const fresh = c.querySelector('#bk-fresh');
  fresh.onclick = () => {
    if (!fresh.dataset.sure) { fresh.dataset.sure = '1'; fresh.textContent = 'Start fresh: are you sure?'; return; }
    slotClear(B.slot); SAFE.broken = null; sheetClose(); begin(true);
  };
}

// ----------------------------------------------------------------- saving, part by part
// Each part of the save is made and written out on its own (saveGame, main.js). A part that fails keeps its last good
// copy (at first, the one the claim was opened with), its fault is noted once in the console, and the rest is saved.
// No number is ever saved as NaN: it would come back as nothing, and nothing as zero shards.
const SAFE_PART_NAMES = { people: 'its people', buildings: 'its buildings', story: 'the story', night: 'the night', weather: 'the weather', dig: 'the dig', workshop: 'the workshop', sky: 'the fleet', stash: 'the stash' };
function safeJSON(k, v) { return typeof v === 'number' && !Number.isFinite(v) ? undefined : v; }
function safePart(k, x) {
  try { const v = typeof x === 'function' ? x() : x, j = v === undefined ? undefined : JSON.stringify(v, safeJSON); SAFE.parts[k] = j; return j; }
  catch (e) {
    SAFE.failed.push(k);
    if (!SAFE.seen.has('save:' + k)) { SAFE.seen.add('save:' + k); SAFE.faults.push({ where: 'saving ' + k, msg: String(e && e.message) }); console.error(`[Brightvein] saving ${k}:`, e); }
    return SAFE.parts[k];
  }
}
// the whole save, part by part, as the text that's stored
function safeSave(parts) {
  SAFE.failed = [];
  const out = [];
  for (const [k, x] of Object.entries(parts)) { const j = safePart(k, x); if (j !== undefined) out.push(JSON.stringify(k) + ':' + j); }
  return '{' + out.join(',') + '}';
}
// the claim's numbers as they're saved: never NaN. One that went wrong is put back to its last good value.
function safeNums() {
  const out = {};
  for (const [k, d] of Object.entries(SAFE_NUMS)) {
    let v = GAME[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) { safeFault('numbers', new Error(`GAME.${k} was ${v}`)); v = GAME[k] = safeNum(SAFE.nums[k], d); }
    SAFE.nums[k] = out[k] = v;
  }
  return out;
}
// the parts the claim was opened with, as their last good copies until they're saved anew
function safeOpened(save) {
  if (!save) return;
  for (const [k, v] of Object.entries(save)) if (k in SAFE_PART_NAMES) try { SAFE.parts[k] = JSON.stringify(v, safeJSON); } catch (e) { }
  for (const k of Object.keys(SAFE_NUMS)) SAFE.nums[k] = GAME[k];
}
const safeQuota = e => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
// write it to the open claim's slot. A full browser, one that keeps nothing, and a fault in the game each say so in a
// toast, once in a row of failures, and again whenever the player saves on purpose.
function safeWrite(raw, force) {
  try { slotWrite(SLOTS.active, raw); }
  catch (e) {
    const quota = safeQuota(e), blocked = !quota && !!e && e.name === 'SecurityError';
    console.error('[Brightvein] the claim couldn’t be saved:', e);
    if (!saveFails++ || force) toast(quota ? 'The claim couldn’t be saved: this browser’s storage is full. Carry it off as a code (Settings › Saving) to be safe.'
      : blocked ? 'The claim couldn’t be saved: this browser isn’t letting the page keep anything. Carry it off as a code (Settings › Saving) to be safe.'
      : 'The claim couldn’t be saved, because of a fault in the game. Carry it off as a code (Settings › Saving) to be safe.', 'night');
    return false;
  }
  saveFails = 0;
  if (SAFE.failed.length && force) toast(`Part of the claim (${SAFE.failed.map(k => SAFE_PART_NAMES[k] || k).join(', ')}) couldn’t be saved, so its last good copy was kept. Everything else is saved.`, 'night');
  return true;
}
let saveFails = 0;

// ----------------------------------------------------------------- a night under way
// A night saved while it's on also keeps the Wildlight on the plateau, and the lamps they put out (nightsSave in
// nights.js keeps the waves still to come and a boss). When the claim opens again they climb back over the rim.
function safeNightSave(S) {
  if (S && S.on) {
    S.on.live = WL.list.filter(f => !f.dead && !f.air && !f.boss && !f.mine && !f.leaving).map(f => ({ kind: f.kind, hp: Math.round(f.hp), maxHp: Math.round(f.maxHp), seam: f.from === 'seam' }));
    S.on.snuffed = DECOR.lamps.filter(L => !L.lit).map(L => [Math.round(L.x * 10) / 10, Math.round(L.z * 10) / 10]);
  }
  return S;
}
function safeNightLoad(save) {
  const O = save && safeObj(save.night) && save.night.on, N = WL.night; if (!safeObj(O) || !N) return;
  for (const p of Array.isArray(O.snuffed) ? O.snuffed : []) for (const L of DECOR.lamps) if (Array.isArray(p) && Math.hypot(L.x - p[0], L.z - p[1]) < 0.5) L.lit = false;
  const live = (Array.isArray(O.live) ? O.live : []).filter(u => safeObj(u) && WL_KINDS[u.kind]), w = N.waves[N.waves.length - 1] || { center: 20, spread: 4 };
  if (live.length) setTimeout(() => {
    if (WL.night !== N) return;
    for (const u of live) {
      const f = spawnWildlight(u.kind, u.seam ? 'seam' : w.center + (Math.random() - 0.5) * 2 * (w.spread || 4), { hp: u.hp > 0 ? u.hp : undefined, maxHp: u.maxHp > 0 ? u.maxHp : undefined });
      N.spawned--; if (N.kinds[f.kind]) N.kinds[f.kind].spawned--;   // counted when they first came
    }
  }, 0);
}

// ----------------------------------------------------------------- a scene or a day's card that's up as the claim is saved
// A chapter counts as started as soon as it opens, so an opening scene still being told when the claim was saved is told
// again when it opens. A day's card that's up with no choice made yet comes up again, its cooldown not yet spent (it's
// dealt afresh). (storySave in story.js, eventsSave in events.js)
function safeStorySave(S) {
  const C = CHAPTERS[STORY.ch], K = EVT.card;
  if (S && C && STORY.started && STORY.shown && STORY.shown.lines === C.open) S.opening = true;
  if (S && safeObj(S.events) && K && !K.picked && K.e) {
    const id = K.e.id, seen = { ...S.events.seen }; delete seen[id];
    S.events = { ...S.events, today: { id, at: Math.min(GAME.t, 0.5) }, seen, recent: (S.events.recent || []).filter((x, i) => i || x !== id) };
  }
  return S;
}
function safeStoryLoad(s) {
  const C = CHAPTERS[STORY.ch];
  if (safeObj(s) && s.opening && STORY.started && C && C.open && !STORY.queue.some(q => q.lines === C.open)) STORY.queue.unshift({ lines: C.open, title: C.title, chapter: STORY.ch, act: C.actStart });
}

// ----------------------------------------------------------------- faults while playing
// A fault is noted once, with its stack, in the browser's console, and the rest carries on: frame() (main.js) runs its
// systems in groups that each catch their own, and anything else that slips through lands here too. The player is
// told once, gently.
function safeFault(where, e) {
  const msg = String((e && e.message) || e), k = where + ':' + msg;
  if (SAFE.seen.has(k)) return;
  SAFE.seen.add(k); SAFE.faults.push({ where, msg });
  console.error(`[Brightvein] ${where}:`, e);
  if (SAFE.told) return;
  SAFE.told = true;
  try { toast('Something went wrong behind the scenes. The claim carries on, but if anything looks stuck, use <b>Settings › Save now</b> and open the page again.', 'night'); } catch (e2) { }
}
addEventListener('error', e => { if (e.error) safeFault('page', e.error); });   // (the browser's own notes, and other pages' scripts, carry no error)
addEventListener('unhandledrejection', e => { if (e.reason instanceof Error) safeFault('page', e.reason); });
