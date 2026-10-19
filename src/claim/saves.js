// ===================================================================== SAVES: three claims, and codes to carry them
// Each claim is saved in this browser under its slot's key. Slot 1 keeps the key the game has always used, so a claim
// saved before there were slots is simply claim 1; claims 2 and 3 have keys of their own. Which claim is open, and the
// names the player gave them, are kept under 'bv-slots'. saveGame and loadSave (main.js) work on the open claim.
// A claim travels to another device as a code: the save squeezed (deflate, where the browser can) and written in
// base64, with a check at the end, so a code that lost or changed a few letters on the way is caught and refused
// instead of loading half a claim. The same code can go in a file.
const SAVE_KEY = 'brightvein-keep-v1', OLD_SAVE_KEY = 'brightvein-keep-none';
const SLOT_N = 3;
const SLOTS = { active: 1, names: {} };
try { const s = JSON.parse(localStorage.getItem('bv-slots')); if (s) { SLOTS.active = clamp(s.active | 0 || 1, 1, SLOT_N); SLOTS.names = s.names && typeof s.names === 'object' ? s.names : {}; } } catch (e) { }
const slotKey = n => n === 1 ? SAVE_KEY : SAVE_KEY + '-s' + n;
const slotName = n => (SLOTS.names[n] || '').trim() || `Claim ${n}`;
function slotsKeep() { try { localStorage.setItem('bv-slots', JSON.stringify(SLOTS)); } catch (e) { } }
function slotRaw(n) { try { return localStorage.getItem(slotKey(n)); } catch (e) { return null; } }
// a claim's save as it is stored (and, for slot 1, one from before the grid, brought up to date)
function slotRead(n) {
  try { const s = JSON.parse(slotRaw(n)); if (s && s.v === 2) return s; } catch (e) { }
  if (n === 1) try { const s = JSON.parse(localStorage.getItem(OLD_SAVE_KEY)); if (s && s.v === 1) return migrateV1(s); } catch (e) { }
  return null;
}
function slotWrite(n, s) { localStorage.setItem(slotKey(n), typeof s === 'string' ? s : JSON.stringify(s)); }
function slotClear(n) { try { localStorage.removeItem(slotKey(n)); if (n === 1) localStorage.removeItem(OLD_SAVE_KEY); } catch (e) { } }
// a claim in a few words, for the title screen and the claims list: day, chapter, people, when it was saved
function chapterLabel(ch) {
  const C = CHAPTERS[ch];
  if (!C) return 'The story so far is told';
  return `${ch ? `Chapter ${ch}` : 'Prologue'} · ${C.title}`;
}
function saveSummary(s) {
  if (!s) return null;
  const people = (s.people || []).length, guests = (s.people || []).filter(p => p.hero).length;
  return { day: s.day || 1, ch: s.story ? s.story.ch || 0 : 0, chapter: chapterLabel(s.story ? s.story.ch || 0 : 0), people, guests, savedAt: s.savedAt || 0,
    keep: ((s.buildings || []).find(b => b.type === 'keep') || {}).level || 1, setupDone: s.setupDone !== false };
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
  if (s && s.v === 1 && Array.isArray(s.people)) s = migrateV1(s);
  if (!s || typeof s !== 'object' || s.v !== 2 || !Array.isArray(s.people) || !Array.isArray(s.buildings) || !s.people.length || typeof s.day !== 'number') throw new Error(s && s.v > 2 ? 'newer' : 'notclaim');
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
