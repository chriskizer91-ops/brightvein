// audio.js: the game's sound, switched on. Browsers (phones above all) only let a page make sound once the player has
// touched it, so nothing is made until the first tap, click or key anywhere on the page: then the game's one audio
// context is made and started inside that very touch, the mix is built (mixer.js), Chris's instruments
// (src/audio/thareia/sounds.js) are set up in the same context, and the game's own sounds are made into short
// recordings off to one side (voices.js, a moment's work). Every touch that finds the sound stopped starts it again
// with a silent blip beside it: an iPhone only lets a page's sound start from inside a touch it counts (the finger
// lifting, not landing), so the blip goes with every one of them.
// Chris's two files are used exactly as they are: sounds.js sends everything it plays into its output, OUT, which is
// taken away from his own compressor and fed into the mix's music bus, so the music has its own volume; his effects
// are played through buses of the mix's own instead (withBus), each at a level measured for it here, so they sit
// with the cannon. The music plays with his musicPlay, which fades the last piece out itself.
// Leaving the page (another app, another tab, the phone locked) fades the sound out and stops the audio clock; coming
// back starts it again (or the next touch does, if the browser asks for one). Every touch checks it's running, which
// brings it back after an iPhone stops it for a call. Turning the sound off in Settings stops the clock as well.
// While the clock is stopped nothing is played at all (or it would all wait, and burst out together when the sound
// came back), and with the Sounds slider at nothing none of the game's sounds are made; with the Music slider at
// nothing the music stops (and starts again when it's turned up).
// For checking: `quiet` (set while tests run the game's clock without drawing) means sounds are only counted, `stats`
// counts what was asked for and what played, `level()` says how loud it has been lately, offline() plays a scripted few
// seconds into an offline copy of the mix and measures them (sound.js's selfTest), recordMusic() records the music and
// recordEffects() some of Chris's effects (for the self-test: they can only be played live).
import { SFX, sfxInit, sfxNodes, withBus, fm } from './thareia/sounds.js';
import { musicPlay, musicStop, musicPlaying } from './thareia/music.js';
import { makeMixer, measure, KNEE } from './mixer.js';
import { bake } from './voices.js';

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
const BY_ID = new Map(SFX.map((e) => [e.id, e]));

// (Brightvein: `shared()` gives the claim's own audio context, once it has one, and the skies' sound is made in that
// same context rather than a second one; the claim's sound starts it, at the first touch)
export function makeAudio({ touch = false, settings = () => ({ sound: true, music: 0.8, effects: 1 }), shared = null } = {}) {
  let ctx = null, M = null, bank = null, piece = null, pieceLevel = 1, hidden = document.hidden, built = false, blank = null;
  const stats = { events: {}, effects: 0, played: {}, tones: 0, unlocked: 0, resumed: 0, suspended: 0, ms: 0, cues: 0, blips: {} };
  const ready = [];
  const A = {
    quiet: false, loudSteps: false, stats, touch, enabled: !shared,
    get ctx() { return ctx; }, get state() { return ctx ? ctx.state : 'none'; }, get mixer() { return M; }, get bank() { return bank; },
    get ready() { return !!bank; }, get piece() { return piece; }, get music() { return musicPlaying(); },
    // (the claim's context is there now: the skies' sound made in it, if it isn't yet)
    attach() { A.enabled = true; if (!ctx && !hidden) create(); return !!ctx; },
    onReady(f) { if (built) f(); else ready.push(f); },
  };

  // ---------- starting, and stopping when the page is left ----------
  function create() {
    if (shared) { ctx = shared() ?? null; if (!ctx) return false; }
    else {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
    }
    try { blank = ctx.createBuffer(1, 1, 22050); } catch { /* none: the resume will have to do */ }
    M = makeMixer(ctx, { touch });
    M.apply(settings(), pieceLevel);
    // Chris's instruments in the same context; their output, OUT, into the music bus
    sfxInit(ctx);
    const { OUT } = sfxNodes(); OUT.disconnect(); OUT.connect(M.musicIn);
    built = true; stats.unlocked++;
    if (!settings().sound) setTimeout(() => { if (!wanted()) ctx.suspend().catch(() => {}); }, 0); // (made, but kept still)
    for (const f of ready.splice(0)) f();
    bake({ high: 32000, low: 16000 }, ctx.sampleRate).then((b) => { bank = b; }).catch((e) => console.warn('sounds not made:', e));
    return true;
  }
  // (the sound turned off in Settings stops the audio clock too, so a phone does no sound work at all)
  const wanted = () => !hidden && settings().sound;
  // (a touch, a click or a key: the sound made, or started again if it's stopped, with the silent blip an iPhone wants)
  function wake(e) {
    if (hidden) return;
    if (!ctx && (!A.enabled || !create())) return; // (Brightvein: nothing is made until the skies are first opened)
    if (ctx.state === 'running' || !wanted()) return;
    if (blank) { try { const s = ctx.createBufferSource(); s.buffer = blank; s.connect(ctx.destination); s.start(0); stats.blips[e.type] = (stats.blips[e.type] ?? 0) + 1; } catch { /* fine */ } }
    const p = ctx.resume(); stats.resumed++; p?.catch?.(() => {});
  }
  for (const k of GESTURES) addEventListener(k, wake, { capture: true, passive: true });
  function away(now) {
    hidden = now;
    if (!ctx) return;
    const t = ctx.currentTime, g = M.master.gain;
    if (now) {
      g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.02); stats.suspended++;
      setTimeout(() => { if (hidden && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 80);
    } else if (wanted()) {
      const p = ctx.resume(); p?.catch?.(() => {});
      M.apply(settings(), pieceLevel);
    }
  }
  document.addEventListener('visibilitychange', () => away(document.hidden));
  addEventListener('pagehide', () => away(true));
  addEventListener('pageshow', () => { if (!document.hidden) away(false); });

  // ---------- what the game asks for ----------
  // the sound is running (its clock going: not stopped by Settings, an iPhone's call or the page being left), and the
  // game's sounds are heard (running, with the Sounds slider above nothing): nothing is played otherwise
  A.running = () => !!ctx && ctx.state === 'running' && !hidden;
  A.hearing = () => A.running() && settings().effects > 0;
  A.now = () => (M ? M.now() : 0);
  // the Settings card's sound rows changed: the volumes set, the music stopped at nothing, the clock stopped or started.
  // Says (a promise) whether the sound is running once it's settled, for a tick to hear the new level by
  A.apply = () => {
    if (!M) return Promise.resolve(false);
    M.apply(settings(), pieceLevel);
    if (!(settings().music > 0) && musicPlaying()) { musicStop(0.3); piece = null; }
    if (wanted()) return ctx.state === 'running' ? Promise.resolve(true) : ctx.resume().then(() => A.running(), () => false);
    if (!hidden) setTimeout(() => { if (!wanted() && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 150); // (after the fade)
    return Promise.resolve(false);
  };
  // one of Chris's effects (by its id in sounds.js), at `level` (measured for it), placed where the mix's P says (M.at /
  // M.here, called just before), into the effects bus (or the menus')
  const last = new Map();
  A.effect = (id, level, bus = 'fx', delay = 0, gap = 0.06) => {
    if (!M || A.quiet || !A.hearing()) return false;
    const e = BY_ID.get(id), t = M.now();
    if (!e || t - (last.get(id) ?? -9) < gap) return false;
    last.set(id, t);
    const c = M.chain(level, M.buses[bus] ?? M.fx);
    withBus(c.bus, c.rev, null, () => e.play(t + 0.02 + delay));
    stats.effects++; stats.played[id] = (stats.played[id] ?? 0) + 1;
    return true;
  };
  // a note on Chris's bell voice (his fm: { f, ratio, index, d, g }), placed where P says
  A.tone = (o, level = 1, bus = 'ui') => {
    if (!M || A.quiet || !A.hearing()) return;
    const c = M.chain(level, M.buses[bus] ?? M.fx), t = M.now() + 0.02;
    withBus(c.bus, c.rev, null, () => fm(t, o));
    stats.tones++;
  };
  // the music: a piece of Chris's (an id in music.js), at a level of its own; musicPlay fades the last one out. None
  // with the Music slider at nothing (apply stops it)
  A.playMusic = (id, level = 1) => {
    if (!M || !A.running() || !(settings().music > 0)) return false;
    pieceLevel = level; M.apply(settings(), level);
    if (musicPlaying() !== id) musicPlay(id);
    piece = id;
    return true;
  };
  A.stopMusic = () => { musicStop(0.8); piece = null; };
  A.level = () => (M ? M.level() : 0);

  // ---------- checking ----------
  // play a scripted few seconds into an offline copy of the mix, with every slider at the top (the loudest it can be):
  // script(mixer) is given the copy (its clock set by the script for each sound), and `music` (a recording of the
  // music, or none) plays under it all. Returns the mix's peak, how many samples clipped, its loudness and how long it
  // rang, the same for what goes into the soft clip (`into`: after the compressor, measured on two channels of their
  // own beside the sound), and how long it took to make
  A.offline = async (secs, script, music = null) => {
    const sr = ctx?.sampleRate ?? 44100, off = new OfflineAudioContext(4, Math.round(secs * sr), sr), m = makeMixer(off, { touch });
    m.apply({ sound: true, music: 1, effects: 1 }, pieceLevel);
    const split = off.createChannelSplitter(2), merge = off.createChannelMerger(4);
    m.comp.connect(split); split.connect(merge, 0, 2); split.connect(merge, 1, 3); merge.connect(off.destination);
    if (music) { const s = off.createBufferSource(); s.buffer = music; s.connect(m.musicIn); s.start(0); }
    const t0 = performance.now();
    script(m);
    const made = performance.now() - t0, t1 = performance.now(), out = await off.startRendering();
    return { ...measure(out, 0, 2), into: measure(out, 2, 2), knee: KNEE, made: +made.toFixed(1), rendered: Math.round(performance.now() - t1), stats: m.stats };
  };
  // a recording of whatever comes into `input` for `secs` (stereo, not heard); null if the sound isn't running
  const record = (input, secs) => new Promise((done) => {
    if (!M || !A.running()) return done(null);
    const n = Math.round(secs * ctx.sampleRate), rec = ctx.createBuffer(2, n, ctx.sampleRate), sp = ctx.createScriptProcessor(4096, 2, 2), mute = ctx.createGain();
    let at = 0;
    mute.gain.value = 0; input.connect(sp); sp.connect(mute); mute.connect(ctx.destination);
    sp.onaudioprocess = (e) => {
      const k = Math.min(e.inputBuffer.length, n - at);
      for (let c = 0; c < 2; c++) rec.getChannelData(c).set(e.inputBuffer.getChannelData(c).subarray(0, k), at);
      at += k;
      if (at >= n) { sp.onaudioprocess = null; input.disconnect(sp); sp.disconnect(); mute.disconnect(); done(rec); }
    };
  });
  // what the music is playing now, `secs` long (as it goes into the mix, before its volume)
  A.recordMusic = (secs) => record(M?.musicIn, secs);
  // some of Chris's effects, played now (not heard) and recorded, `secs` long: `list` is [id, level, when (s)], each
  // at the level it's played at in the game, with its reverb send (as the game's are, near) mixed in
  A.recordEffects = (list, secs) => {
    if (!M || !A.running()) return Promise.resolve(null);
    const tap = ctx.createGain(), t = ctx.currentTime + 0.05;
    for (const [id, level, at] of list) {
      const e = BY_ID.get(id); if (!e) continue;
      const g = ctx.createGain(), r = ctx.createGain(); g.gain.value = level; r.gain.value = level * 0.2; g.connect(tap); r.connect(tap);
      withBus(g, r, null, () => e.play(t + at));
    }
    return record(tap, secs);
  };
  // every recording made for the game: none silent (its peak before scaling)
  A.silent = () => (bank ? Object.entries(bank).flatMap(([k, list]) => list.filter((b) => !(b.peak > 0.05)).map(() => k)) : ['(not made)']);
  return A;
}
