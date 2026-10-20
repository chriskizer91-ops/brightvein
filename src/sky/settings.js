// settings.js: the skies' own settings, kept on this device (under 'bv-sky-settings'). Brightvein has one Settings
// panel (src/claim/settings.js): its sound (on or off, the Music and Effects sliders) and its picture (Light, Balanced,
// High) govern the skies too, and its "In the skies" rows are these: aim speed, up and down, camera shake, Fire on the
// left (a phone) and the tips for a new Captain. Changing one takes effect at once (whoever listens: on(fn)).
// `claim` gives what's the claim's: sound() → { on, music, sfx } and picture() → 'light' | 'balanced' | 'high'.
// The device also remembers a few things of its own here that aren't rows (KEEP): how many voyages it has sailed, so
// the laptop's key panel can fold away once you know the keys.
const KEY = 'bv-sky-settings';
export const ROWS = [
  { id: 'aim', kind: 'choice', label: 'Aim speed', def: 2, options: [[0, 'Slow'], [1, 'Gentle'], [2, 'Normal'], [3, 'Quick'], [4, 'Fast']] },
  { id: 'flip', kind: 'choice', label: 'Up and down', def: false, options: [[false, 'Normal'], [true, 'Flipped']], note: 'Flipped: drag down to look up, as with a flight stick.' },
  { id: 'shake', kind: 'switch', label: 'Camera shake', def: true },
  { id: 'leftFire', kind: 'switch', label: 'Fire button on the left', def: false, touch: true },
  { id: 'tips', kind: 'switch', label: 'Tips for a new Captain', def: true, note: 'One short tip at a time on your first voyages.' },
];
// how far the view swings for a drag, at each aim speed
export const AIM = [0.5, 0.75, 1, 1.35, 1.8];
// what each picture setting draws: the sun's shadow map, how many of the big cloud puffs, how big on screen (its length
// over the view's height) a raider must be to be drawn with her middle model rather than her far one, the effects'
// share (sparks, smoke, debris: fx.js), on a phone and on a laptop, and the sky's (sky.js, world.js): the share of rain
// streaks, the scraps of scud, the sun's rays, the sea's glitter and the towering clouds round the horizon. Brightvein's
// Light is the airship game's Smooth, its Balanced is Balanced and its High is Sharp. (The screen's sharpness is the
// claim's: core.js)
const SKY = { rain: 1, scud: true, rays: true, glitter: true, towers: true };
export const PICTURE = {
  smooth: { shadow: 512, puffs: 55, detail: 0.09, fx: [0.45, 0.5], sky: { ...SKY, rain: 0.5, scud: false, rays: false, glitter: false } },
  balanced: { shadow: 1024, puffs: 85, detail: 0.06, fx: [0.6, 0.75], sky: SKY },
  sharp: { shadow: 2048, puffs: 110, detail: 0.06, fx: [0.75, 1], sky: SKY },
};
export const PICTURE_OF = { light: 'smooth', balanced: 'balanced', high: 'sharp' };
const KEEP = { voyages: 0 };

export function makeSettings({ touch = false, claim = {} } = {}) {
  const data = { ...KEEP };
  const def = (r) => (typeof r.def === 'function' ? r.def(touch) : r.def);
  for (const r of ROWS) data[r.id] = def(r);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    for (const r of ROWS) if (r.id in saved && typeof saved[r.id] === typeof data[r.id] && (!r.options || r.options.some(([v]) => v === saved[r.id]))) data[r.id] = saved[r.id];
    for (const k in KEEP) if (typeof saved[k] === typeof KEEP[k]) data[k] = saved[k];
  } catch { /* no storage here, or something odd in it */ }
  // the claim's: the sound and the picture
  const snd = () => claim.sound?.() ?? { on: true, music: 0.8, sfx: 1 };
  Object.defineProperties(data, {
    sound: { get: () => !!snd().on, enumerable: false },
    music: { get: () => snd().music ?? 0.8, enumerable: false },
    effects: { get: () => snd().sfx ?? 1, enumerable: false },
    picture: { get: () => PICTURE_OF[claim.picture?.()] ?? 'balanced', enumerable: false },
  });
  const listeners = [];
  const tell = (id, done) => { for (const f of listeners) f(id, data[id], done); };
  const save = () => { try { const o = {}; for (const r of ROWS) o[r.id] = data[r.id]; for (const k in KEEP) o[k] = data[k]; localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* no storage here */ } };
  return {
    data, save, ROWS: ROWS.filter((r) => !r.touch || touch), touch,
    // change one (the claim's Settings panel, or a test)
    set(id, v) { data[id] = v; save(); tell(id, true); },
    // the claim's sound or picture changed: told to whoever listens, as if chosen here
    changed(id) { tell(id, true); },
    // something this device remembers that isn't a row (KEEP), kept at once
    keep(id, v) { data[id] = v; save(); },
    on: (fn) => { listeners.push(fn); },
  };
}
