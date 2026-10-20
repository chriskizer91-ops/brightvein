// mixer.js: where every sound goes, and the rules that keep a big fight sounding full but never crackling. Made once
// for the game's own audio context (audio.js), and again for a few seconds in an offline one to check the mix (the
// self-test): the same buses, the same voice limits, the same placing in the sky.
//   the buses     effects and the sky's ambience (through one muffling filter, for when the Captain's ship goes down,
//                 and one gate that silences them while paused), the menus' sounds, and the music (its own volume, a
//                 dip under big moments, and a filter that dulls it while paused); one reverb, made here from noise
//   the master    a compressor that rides the loud moments, a soft clip that rounds off any peak before it can crackle
//                 (straight up to 0.7, then curving to at most 0.98, with room above: it only flattens a peak past
//                 twice full scale, and the worst fight stays under 0.95 going into it: the self-test), and the
//                 master volume ("Sound on")
//   voices        a fixed table of slots per kind of sound (gun, foe, hit, whiz, chime, blast, creak, ui...), fewer on a
//                 phone. A new sound takes a free slot, or the quietest, least important one of its kind (faded out in
//                 a few milliseconds), or is dropped if every one playing matters more. A burst of hits landing within
//                 a few hundredths of a second swells one sound rather than starting eight (merge)
//   placing       a sound out in the sky (at): quieter and duller the farther it is from the Captain's ship, panned
//                 left or right as the camera sees it, wetter with distance, and arriving late from far off (the flash
//                 first, the boom a beat later, like thunder); farther than 2.2 km, not played at all
// Nothing here is made per frame; a sound starting makes its few nodes (the browser's way), and nothing else.

export const LEVELS = { fx: 1, amb: 0.75, ui: 0.85, music: 0.62, wet: 0.5 };
// voice slots per kind, on a phone and on a laptop
// (gun: the Captain's guns; foe: the raiders')
export const CAPS = { touch: { gun: 6, foe: 5, hit: 5, whiz: 2, chime: 4, blast: 3, creak: 2, ui: 4, misc: 4 }, laptop: { gun: 8, foe: 8, hit: 8, whiz: 3, chime: 6, blast: 4, creak: 3, ui: 6, misc: 6 } };
export const FAR = 2200; // metres: farther than this, a sound isn't played (a blast is: it carries)
// the level meter (checking only): the loudest sample of every twentieth of a second, and when
const METER = `registerProcessor('peak-meter', class extends AudioWorkletProcessor {
  constructor() { super(); this.p = 0; this.n = 0; }
  process(inputs) {
    for (const c of inputs[0]) for (let k = 0; k < c.length; k++) { const a = Math.abs(c[k]); if (a > this.p) this.p = a; }
    if (++this.n >= 20) { this.port.postMessage([this.p, currentTime]); this.p = 0; this.n = 0; }
    return true;
  }
});`;

// the soft clip: straight to 0.7, then a curve that never quite reaches 0.98. A curve only covers what comes into it
// from -1 to 1 (past that it holds its end, a hard clip), so the sound is halved going in and the curve drawn for
// twice as far: it bends anything up to twice full scale smoothly
export const KNEE = 0.7, ROOM = 2;
export const soft = (x) => { const a = Math.abs(x); return a <= KNEE ? x : Math.sign(x) * (KNEE + 0.28 * Math.tanh((a - KNEE) / 0.28)); };
const CURVE = (() => {
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = soft(((i / (n - 1)) * 2 - 1) * ROOM);
  return c;
})();
// the reverb: stereo noise, a moment's delay, dying away and darkening as it goes (a filter closing from bright to dull)
function impulse(ctx, secs) {
  const sr = ctx.sampleRate, n = Math.round(sr * secs), pre = Math.round(0.012 * sr), b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let y = 0;
    for (let i = pre; i < n; i++) { const k = (i - pre) / (n - pre), a = 0.5 - 0.42 * k; y += a * (Math.random() * 2 - 1 - y); d[i] = y * Math.pow(1 - k, 2.2); }
  }
  return b;
}

export function makeMixer(ctx, { touch = false } = {}) {
  const M = { ctx, touch, clock: -1 }; // clock: the time sounds start at, when it's set (an offline render, scripted)
  const now = () => (M.clock >= 0 ? M.clock : ctx.currentTime);
  const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const lowpass = (f, to) => { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = 0.7; if (to) b.connect(to); return b; };

  // ---------- the master ----------
  // (the mix a little under full going into the compressor, which catches peaks quickly and firmly: tuned with the
  // self-test so the worst fight stays well under the soft clip's ceiling, and a calm sky sounds about as loud as before)
  const mix = gain(0.84), comp = ctx.createDynamicsCompressor(), into = gain(1 / ROOM), clip = ctx.createWaveShaper(), master = gain(1);
  comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.22;
  clip.curve = CURVE; clip.oversample = 'none';
  mix.connect(comp); comp.connect(into); into.connect(clip); clip.connect(master); master.connect(ctx.destination);
  // ---------- the buses ----------
  const hold = gain(1, mix), muffle = lowpass(20000, hold);
  const fx = gain(LEVELS.fx, muffle), amb = gain(LEVELS.amb, muffle), ui = gain(LEVELS.ui, mix);
  const tone = lowpass(20000, mix), paused = gain(1, tone), duck = gain(1, paused), music = gain(LEVELS.music, duck), musicIn = gain(1, music);
  const verbIn = gain(1), verb = ctx.createConvolver(), verbOut = gain(LEVELS.wet, fx);
  verb.buffer = impulse(ctx, touch ? 1.1 : 1.8); verbIn.connect(verb); verb.connect(verbOut);
  Object.assign(M, { mix, comp, master, fx, amb, ui, music, musicIn, duck, tone, paused, hold, muffle, verbIn, buses: { fx, amb, ui, music, master } });

  // ---------- the listener: the Captain's ship (how far), and the camera (which side) ----------
  const L = { x: 0, y: 0, z: 0, cx: 0, cy: 0, cz: -1, rx: 1, ry: 0, rz: 0 };
  // camera: a three.js camera (its matrixWorld's first column is its right); pos: the Captain's ship
  M.listen = (camera, pos) => {
    const e = camera.matrixWorld.elements;
    L.x = pos.x; L.y = pos.y; L.z = pos.z; L.cx = e[12]; L.cy = e[13]; L.cz = e[14]; L.rx = e[0]; L.ry = e[1]; L.rz = e[2];
  };
  M.listenAt = (x, y, z, cx, cy, cz, rx, ry, rz) => Object.assign(L, { x, y, z, cx, cy, cz, rx, ry, rz });
  // where a sound is: fills in P (one object, reused) and returns it
  const P = { dry: 1, pan: 0, lp: 0, send: 0, delay: 0, d: 0, near: 1, cull: false };
  M.P = P;
  M.at = (p, wet = 0.2) => {
    const dx = p.x - L.x, dy = p.y - L.y, dz = p.z - L.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const near = 1 / (1 + Math.max(0, d - 30) / 120);
    const cx = p.x - L.cx, cy = p.y - L.cy, cz = p.z - L.cz, cl = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    P.d = d; P.near = near; P.cull = d > FAR;
    P.lp = d > 60 ? Math.max(500, 16000 * Math.pow(near, 1.3)) : 0;
    P.pan = Math.max(-1, Math.min(1, ((cx * L.rx + cy * L.ry + cz * L.rz) / cl) * (0.35 + 0.6 * near)));
    P.dry = Math.pow(near, 0.9); P.send = Math.min(1, wet + 0.9 * (1 - near)) * Math.sqrt(near);
    P.delay = d < 150 ? 0 : Math.min(1.5, (d - 150) / 700);
    return P;
  };
  // a sound on the Captain's own ship, or in the menus: just panned
  M.here = (pan = 0, wet = 0.1) => { P.d = 0; P.near = 1; P.cull = false; P.lp = 0; P.pan = pan; P.dry = 1; P.send = wet; P.delay = 0; return P; };

  // ---------- the voices ----------
  const caps = CAPS[touch ? 'touch' : 'laptop'], slots = {}, stats = { started: {}, stolen: 0, merged: 0, dropped: 0, culled: 0 };
  for (const k in caps) { slots[k] = Array.from({ length: caps[k] }, () => ({ src: null, g: null, pan: null, prio: 0, end: 0, t0: -9, key: '', count: 0, gain: 1 })); stats.started[k] = 0; }
  M.stats = stats;
  // a slot for a sound of kind `cat`, mattering `prio`, starting at `at`: a free one, or the least important one playing
  // (if it matters less), faded out at once; null when every one playing matters more
  M.voice = (cat, prio, at) => {
    const S = slots[cat], t = now();
    let low = null;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (s.end <= t) { s.src = null; return s; }
      if (!low || s.prio < low.prio) low = s;
    }
    if (low.prio >= prio) { stats.dropped++; return null; }
    stats.stolen++;
    try { low.g.gain.setTargetAtTime(0, t, 0.003); low.src.stop(t + 0.04); } catch { /* already over */ }
    low.src = null; low.end = 0;
    return low;
  };
  // the sound of kind `cat` keyed `key` started in the last `window` seconds, if any (a burst landing together)
  M.merge = (cat, key, window) => {
    const S = slots[cat], t = now();
    for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.src && s.key === key && s.end > t && t - s.t0 < window) { s.count++; stats.merged++; return s; } }
    return null;
  };
  // play recording `buf` in slot s at time `at`, at `rate` and `level`, where P says (M.at / M.here, just before)
  M.play = (s, cat, prio, buf, at, rate, level, key = '', bus = fx) => {
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = gain(level * P.dry); src.connect(g);
    let tail = g;
    if (P.lp) { const f = lowpass(P.lp); f.Q.value = 0.5; tail.connect(f); tail = f; }
    let pn = null;
    if (ctx.createStereoPanner) { pn = ctx.createStereoPanner(); pn.pan.value = P.pan; tail.connect(pn); tail = pn; }
    tail.connect(bus);
    if (P.send > 0.01) tail.connect(gain(P.send / Math.max(0.05, P.dry), verbIn));
    src.start(at);
    s.src = src; s.g = g; s.pan = pn; s.prio = prio; s.t0 = at; s.end = at + buf.duration / rate + 0.05; s.key = key; s.count = 1; s.gain = level * P.dry;
    stats.started[cat]++;
    return s;
  };
  // a chain for a sound made elsewhere (one of Chris's, played live), placed where P says: its input, and its reverb send
  M.chain = (level, bus = fx) => {
    const g = gain(level * P.dry);
    let tail = g;
    if (P.lp) { tail = lowpass(P.lp); g.connect(tail); }
    if (ctx.createStereoPanner && P.pan) { const pn = ctx.createStereoPanner(); pn.pan.value = P.pan; tail.connect(pn); tail = pn; }
    tail.connect(bus);
    return { bus: g, rev: gain(level * P.send, verbIn) };
  };
  // how many sounds of each kind are playing now
  M.playing = (cat) => { let n = 0; const t = now(); for (const s of slots[cat]) if (s.src && s.end > t) n++; return n; };
  M.stopAll = () => { const t = now(); for (const k in slots) for (const s of slots[k]) if (s.src && s.end > t) { try { s.g.gain.setTargetAtTime(0, t, 0.01); s.src.stop(t + 0.06); } catch { /* over */ } s.src = null; s.end = 0; } };

  // ---------- the music dipping, the effects muffled, pausing ----------
  let duckUntil = 0, duckTo = 1;
  // dip the music by `db` for `hold` seconds (a deeper dip wins while one is on), then bring it back
  M.dipMusic = (db, holdFor) => {
    const t = now(), g = Math.pow(10, db / 20);
    if (t > duckUntil) duckTo = 1;
    duckTo = Math.min(duckTo, g); duckUntil = Math.max(duckUntil, t + holdFor);
    const p = duck.gain; p.cancelScheduledValues(t); p.setTargetAtTime(duckTo, t, 0.03); p.setTargetAtTime(1, duckUntil, 0.3);
  };
  // the effects and the sky dulled (the Captain's ship going down), or clear again (f = 20000)
  M.muffleTo = (f, tau = 0.5) => { const p = muffle.frequency, t = now(); p.cancelScheduledValues(t); p.setTargetAtTime(f, t, tau); };
  M.setPaused = (on) => {
    const t = now();
    for (const [p, v] of [[hold.gain, on ? 0 : 1], [paused.gain, on ? 0.4 : 1], [tone.frequency, on ? 700 : 20000]]) { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, on ? 0.05 : 0.15); }
  };
  // the settings: "Sound on", and the music's and the sounds' volumes (0 to 1, heard as their squares); `piece` scales
  // the music for the piece playing (Chris's pieces aren't all as loud as each other)
  let set = { sound: true, music: 0.8, effects: 1 }, piece = 1;
  const glide = (p, v) => { const t = now(); p.cancelScheduledValues(t); p.setTargetAtTime(v, t, 0.05); };
  M.apply = (s = set, k = piece) => {
    set = s; piece = k;
    const e = s.effects * s.effects;
    glide(master.gain, s.sound ? 1 : 0); glide(music.gain, LEVELS.music * s.music * s.music * k);
    glide(fx.gain, LEVELS.fx * e); glide(amb.gain, LEVELS.amb * e); glide(ui.gain, LEVELS.ui * e);
  };
  // how loud the sound has been (for checking): level() its peak over the last two thirds of a second, peak(from) its
  // peak since the audio clock read `from`. Measured on the sound's own thread by a little meter (made the first time
  // it's asked; its readings wait if the page is busy, so none is missed), or, until it's ready or where it can't be
  // made, from a tap on the master
  let an = null, buf = null, meter = null;
  const heard = new Float64Array(256), heardAt = new Float64Array(256).fill(-1); let hn = 0;
  const tap = () => {
    if (!an) {
      an = ctx.createAnalyser(); an.fftSize = 32768; master.connect(an); buf = new Float32Array(an.fftSize);
      // (its code from a data: address, which a page opened from a file can load too)
      const start = () => { meter = new AudioWorkletNode(ctx, 'peak-meter'); master.connect(meter); meter.port.onmessage = (e) => { heard[hn] = e.data[0]; heardAt[hn] = e.data[1]; hn = (hn + 1) % heard.length; }; };
      try {
        ctx.audioWorklet.addModule('data:application/javascript;charset=utf-8,' + encodeURIComponent(METER)).then(start)
          .catch(() => ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([METER], { type: 'application/javascript' }))).then(start)).catch(() => {});
      } catch { /* no meter here: the tap will do */ }
    }
    an.getFloatTimeDomainData(buf);
    let p = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; }
    return p;
  };
  M.peak = (from) => { let p = meter ? 0 : tap(); for (let i = 0; i < heard.length; i++) if (heardAt[i] >= from && heard[i] > p) p = heard[i]; return p; };
  M.level = () => Math.max(tap(), M.peak(ctx.currentTime - 0.7));
  Object.defineProperty(M, 'metered', { get: () => !!meter });
  M.now = now;
  return M;
}

// Reading a recording (its channels from `from`, `count` of them): its peak, how many samples clipped (at full scale)
// and how many went past the soft clip's knee, its loudness (dB, over the whole), and how long until it falls 50 dB
// below its peak
export function measure(buf, from = 0, count = buf.numberOfChannels - from) {
  const ch = [], n = buf.length;
  for (let c = from; c < from + count; c++) ch.push(buf.getChannelData(c));
  let peak = 0, clipped = 0, over = 0, sum = 0;
  for (const d of ch) for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (a >= 0.999) clipped++; if (a > KNEE) over++; sum += d[i] * d[i]; }
  const thr = peak * Math.pow(10, -50 / 20);
  let last = 0;
  for (let i = n - 1; i >= 0 && !last; i--) for (const d of ch) if (Math.abs(d[i]) > thr) { last = i; break; }
  return { peak: +peak.toFixed(3), clipped, over, rmsDb: +(10 * Math.log10(sum / (n * ch.length) + 1e-12)).toFixed(1), ring: +(last / buf.sampleRate).toFixed(2) };
}
