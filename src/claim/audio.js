// ===================================================================== AUDIO: every sound in Brightvein, made live
// No sound files: the game is one offline page, so everything here is synthesised with Web Audio as it plays.
//   AU      the engine: instruments, effects and ambience, built on any AudioContext (the live one, or an offline
//           one for tests: AUDIO.render)
//   AUDIO   the game's handle on it: start on the first tap, play(name, position), volumes, the ambience each frame
// The music itself is written as notes in score.js and played by music.js.
//
// The mix: every voice goes into a bus (music, effects, ambience), each with its own volume, then a gentle
// compressor, a limiter and a soft clipper, so nothing ever clips. One shared reverb (a generated room) and an echo
// (for the mine) sit beside them. Phones: notes are scheduled a little ahead on the audio clock (music.js), voices
// are capped, noise buffers are made once and shared, silent layers and beds are stopped, and the sound sleeps while
// the tab is hidden.
const AU = (() => {
  const f2 = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = E => E.rng();

  // ---------------------------------------------------------------- the engine
  function engine(ctx, o = {}) {
    const E = { ctx, light: !!o.light, offline: !!o.offline, rng: o.rng || Math.random, ends: [], voicesMax: 0, dropped: 0, ks: new Map(), beds: {}, gen: {}, persist: 0 };
    E.cap = () => E.light ? 36 : 72;
    E.noise = { white: noiseBuf(ctx, 2, 'white'), pink: noiseBuf(ctx, 3, 'pink'), brown: noiseBuf(ctx, 3, 'brown') };
    const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
    // the end of the chain: master volume, compressor, limiter, then a soft clip that can't go past 0.98
    E.master = g(1);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 2.5; comp.attack.value = 0.006; comp.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    const clip = ctx.createWaveShaper(); clip.curve = softClip(); clip.oversample = 'none';
    E.master.connect(comp); comp.connect(lim); lim.connect(clip); clip.connect(ctx.destination);
    // the buses
    E.music = g(0.7); E.music.connect(E.master);
    E.duck = g(1); E.duck.connect(E.music);              // the game’s music; ducked under cues
    E.sfx = g(0.8); E.sfx.connect(E.master);
    E.world = ctx.createBiquadFilter(); E.world.type = 'lowpass'; E.world.frequency.value = 18000; E.world.Q.value = 0.5; E.world.connect(E.sfx);   // sounds out in the world: muffled from inside the Keep
    E.amb = g(0.8); E.amb.connect(E.master);
    // the reverb: one room for everything, fed through sends scaled by each bus's volume
    E.verb = ctx.createConvolver(); E.verb.buffer = roomIR(ctx, E.light ? 1.7 : 2.6, E.rng);
    const verbOut = g(0.55); E.verb.connect(verbOut); verbOut.connect(E.master);
    E.musicRev = g(0.7); E.musicRev.connect(E.verb);
    E.sfxRev = g(0.8); E.sfxRev.connect(E.verb);
    E.ambRev = g(0.8); E.ambRev.connect(E.verb);
    // the echo: a repeating delay, darker each time round, for plucks and drips in the mine
    E.echo = ctx.createDelay(2); E.echo.delayTime.value = 0.42;
    const fb = g(0.36), elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 2200;
    E.echo.connect(elp); elp.connect(fb); fb.connect(E.echo);
    E.echoIn = g(1); E.echoIn.connect(E.echo);
    E.echoOut = g(0.6); elp.connect(E.echoOut); E.echoOut.connect(E.music); E.echoOut.connect(E.musicRev);
    E.ambEcho = g(0); E.ambEcho.connect(E.echo);         // the mine’s drips and picks echo too
    return E;
  }
  function softClip() {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); c[i] = Math.sign(x) * (a < 0.75 ? a : 0.75 + 0.23 * Math.tanh((a - 0.75) / 0.23)); }
    return c;
  }
  function noiseBuf(ctx, secs, kind) {
    const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, br = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.7;
      else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16; }
      else { br = (br + 0.02 * w) / 1.02; d[i] = br * 3.2; }
    }
    // loop without a click: fade the seam
    const f = Math.min(2000, n / 4); for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }
    return b;
  }
  // a room: decaying noise that darkens as it fades, with a few early reflections
  function roomIR(ctx, secs, rng) {
    const sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), pre = Math.floor(sr * 0.011);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = pre; i < n; i++) {
        const k = i / n, a = 0.7 - 0.55 * k;
        lp += a * ((rng() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - k, 2.4) * Math.exp(-k * 2.5);
      }
      for (const [ms, gn] of [[13, 0.7], [23, 0.5], [37, 0.42], [52, 0.3], [71, 0.22]]) d[Math.floor(sr * (ms + ch * 3.7) / 1000)] += gn * (ch ? -1 : 1);
    }
    return b;
  }

  // ---------------------------------------------------------------- voices: counted against a cap, and tidied away
  // `end` is when the voice falls silent; prio 0 pads and drips, 1 the tune, 2 effects (which may go a little over)
  function voice(E, t, end, prio = 1) {
    const ends = E.ends;
    if (ends.length > 8) { let w = 0; for (let i = 0; i < ends.length; i++) if (ends[i] > t) ends[w++] = ends[i]; ends.length = w; }
    const cap = E.cap();
    if (ends.length >= cap + (prio >= 2 ? 24 : prio === 1 ? 6 : 0)) { E.dropped++; return null; }
    ends.push(end); if (ends.length > E.voicesMax) E.voicesMax = ends.length;
    const nodes = [];
    return {
      n(node) { nodes.push(node); return node; },
      // when the main source ends, every node of the voice lets go
      done(src) { src.onended = () => { for (const x of nodes) try { x.disconnect(); } catch (e) { } }; },
    };
  }
  const activeVoices = (E, t) => E.ends.filter(x => x > t).length;
  function noiseSrc(E, V, kind, t, end) {
    const s = V.n(E.ctx.createBufferSource()); s.buffer = E.noise[kind]; s.loop = true;
    s.start(t, rnd(E) * (s.buffer.duration - 0.2)); s.stop(end + 0.02); return s;
  }
  const mk = (E, V, type) => V.n(type === 'g' ? E.ctx.createGain() : type === 'f' ? E.ctx.createBiquadFilter() : E.ctx.createOscillator());

  // ---------------------------------------------------------------- the instruments
  // Plucked strings (Karplus-Strong): a burst of noise round a tuned delay that loses a little each pass. Each
  // note is worked out once into a buffer and kept. harp: soft and long; pluck: a brighter cittern; pizz: bass.
  const KS = { harp: { bright: 0.5, pos: 0.13, t60: [4.2, 1.5], max: 2.6, lp: 2400, gain: 1.7 }, pluck: { bright: 0.82, pos: 0.2, t60: [2.2, 0.9], max: 1.6, lp: 3600, gain: 2.1 }, pizz: { bright: 0.42, pos: 0.24, t60: [1.4, 0.8], max: 1.3, lp: 1400, gain: 2.4 } };
  function ksBuf(E, m, kind) {
    const key = kind + m; let b = E.ks.get(key); if (b) return b;
    const K = KS[kind], sr = E.light ? 16000 : 24000, f = f2(m);
    const hi = Math.min(1, Math.max(0, (m - 36) / 60)), T60 = K.t60[0] + (K.t60[1] - K.t60[0]) * hi;
    const len = Math.floor(sr * Math.min(K.max, T60 * 0.75 + 0.3));
    const P = sr / f - 0.5, N = Math.max(2, Math.floor(P)), frac = P - N, C = (1 - frac) / (1 + frac);
    const ex = new Float32Array(N), line = new Float32Array(N);
    let lp = 0; for (let i = 0; i < N; i++) { lp += K.bright * ((Math.random() * 2 - 1) - lp); ex[i] = lp; }
    const pk = Math.max(1, Math.round(N * K.pos)); let mean = 0;
    for (let i = 0; i < N; i++) { line[i] = ex[i] - 0.9 * ex[(i + pk) % N]; mean += line[i]; }
    mean /= N; for (let i = 0; i < N; i++) line[i] -= mean;
    const loss = Math.min(0.99995, Math.pow(0.001, 1 / (T60 * f)) / Math.cos(Math.PI * f / sr));
    const out = new Float32Array(len); let idx = 0, last = 0, px = 0, py = 0, peak = 1e-6;
    for (let n = 0; n < len; n++) {
      const x = line[idx], avg = 0.5 * (x + last); last = x;
      const y = C * avg + px - C * py; px = avg; py = y;
      line[idx] = y * loss; out[n] = x; if (Math.abs(x) > peak) peak = Math.abs(x);
      if (++idx >= N) idx = 0;
    }
    const fade = Math.floor(len * 0.12), nrm = 0.7 / peak;
    for (let n = 0; n < len; n++) out[n] *= nrm * (n > len - fade ? (len - n) / fade : 1);
    b = E.ctx.createBuffer(1, len, sr); b.getChannelData(0).set(out);
    if (E.ks.size > (E.light ? 64 : 96)) E.ks.delete(E.ks.keys().next().value);   // the oldest note goes
    E.ks.set(key, b); return b;
  }
  function pluck(E, t, m, dur, vel, out, o = {}) {
    const kind = o.kind || 'harp', K = KS[kind], buf = ksBuf(E, m, kind);
    const ring = kind === 'harp' ? Math.max(dur, 1.4) : kind === 'pizz' ? Math.max(dur * 1.2, 0.45) : Math.max(dur + 0.12, 0.3);
    const end = t + Math.min(ring, buf.duration);
    const V = voice(E, t, end, o.prio ?? 1); if (!V) return;
    const s = V.n(E.ctx.createBufferSource()); s.buffer = buf;
    const f = mk(E, V, 'f'); f.type = 'lowpass'; f.frequency.value = K.lp * (0.55 + vel * 0.7); f.Q.value = 0.4;
    const gn = mk(E, V, 'g'); const pk = vel * K.gain;
    gn.gain.setValueAtTime(pk, t); gn.gain.setTargetAtTime(0, end - 0.1, 0.03);
    s.connect(f); f.connect(gn); gn.connect(out); s.start(t); s.stop(end + 0.05); V.done(s);
  }
  // Whistle and flute: a sine with a little triangle, breath noise, vibrato that comes in as the note settles, and
  // the whistle's ornaments: a cut (a flick up to a higher note on the beat), a roll, a slide up into the note.
  function whistle(E, t, m, dur, vel, out, o = {}) {
    const c = E.ctx, f = f2(m), fl = !!o.flute, rel = fl ? 0.13 : 0.07, end = t + dur + rel;
    const V = voice(E, t, end, 1); if (!V) return;
    const a = mk(E, V, 'o'), b = mk(E, V, 'o'), bg = mk(E, V, 'g'), gn = mk(E, V, 'g');
    a.type = 'sine'; b.type = 'triangle'; bg.gain.value = fl ? 0.16 : 0.3;
    for (const F of [a.frequency, b.frequency]) {
      if (o.glide) { F.setValueAtTime(f * 0.89, t); F.exponentialRampToValueAtTime(f, t + 0.08); }
      else if (o.cut) { F.setValueAtTime(f * 1.335, t); F.setValueAtTime(f, t + 0.03); }
      else F.setValueAtTime(f, t);
      if (o.roll && dur > 0.45) { const u = Math.min(0.07, dur / 7); F.setValueAtTime(f * 1.335, t + u); F.setValueAtTime(f, t + u + 0.028); F.setValueAtTime(f * 0.89, t + 2.4 * u); F.setValueAtTime(f, t + 2.4 * u + 0.028); }
    }
    if (dur > 0.32) {
      const lfo = mk(E, V, 'o'), lg = mk(E, V, 'g'); lfo.frequency.value = fl ? 4.8 : 5.6;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * (fl ? 0.005 : 0.0065), t + Math.min(0.55, dur * 0.7));
      lfo.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency); lfo.start(t); lfo.stop(end);
    }
    const pk = vel * (fl ? 0.48 : 0.38);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(pk, t + (fl ? 0.055 : 0.02)); gn.gain.setTargetAtTime(pk * 0.84, t + 0.06, 0.12); gn.gain.setTargetAtTime(0, t + dur, rel / 3);
    const n = noiseSrc(E, V, 'white', t, end), bp = mk(E, V, 'f'), ng = mk(E, V, 'g');
    bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * (fl ? 1.8 : 2.6)); bp.Q.value = fl ? 1.1 : 1.8;
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vel * (fl ? 0.13 : 0.1), t + 0.014); ng.gain.setTargetAtTime(vel * (fl ? 0.05 : 0.022), t + 0.03, 0.05); ng.gain.setTargetAtTime(0, t + dur, rel / 3);
    a.connect(gn); b.connect(bg); bg.connect(gn); gn.connect(out); n.connect(bp); bp.connect(ng); ng.connect(out);
    a.start(t); b.start(t); a.stop(end + 0.02); b.stop(end + 0.02); V.done(a);
  }
  // Music box: a sine with a quickly fading frequency modulation, so it starts bright and metallic and rings pure
  function box(E, t, m, dur, vel, out, o = {}) {
    const c = E.ctx, f = f2(m), decay = Math.max(0.7, Math.min(2.6, 2.6 - (m - 60) * 0.045)), end = t + decay * 1.15;
    const V = voice(E, t, end, o.prio ?? 1); if (!V) return;
    const car = mk(E, V, 'o'), mod = mk(E, V, 'o'), mg = mk(E, V, 'g'), gn = mk(E, V, 'g');
    car.frequency.value = f; mod.frequency.value = f * 3;
    mg.gain.setValueAtTime(f * 1.5 * vel, t); mg.gain.setTargetAtTime(f * 0.03, t, 0.045);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vel * 0.62, t + 0.003); gn.gain.setTargetAtTime(0, t + 0.004, decay / 4.2);
    mod.connect(mg); mg.connect(car.frequency); car.connect(gn); gn.connect(out);
    car.start(t); mod.start(t); car.stop(end); mod.stop(end); V.done(car);
  }
  // A bell: partials the way a cast bell rings them (the hum an octave down, the minor third, the fifth...), each
  // dying at its own rate, with a clang of noise at the strike
  const BELL = [[0.5, 0.55, 1], [1, 1, 0.7], [1.19, 0.5, 0.55], [1.5, 0.3, 0.45], [2, 0.42, 0.35], [2.52, 0.22, 0.25], [3, 0.16, 0.2], [4.08, 0.1, 0.12]];
  function bell(E, t, m, dur, vel, out, o = {}) {
    const c = E.ctx, f = f2(m), T = Math.max(2.4, Math.min(7, 6.5 - (m - 55) * 0.08)) * (o.short || 1), end = t + T;
    const V = voice(E, t, end, 2); if (!V) return;
    const P = E.light ? BELL.slice(0, 5) : BELL; let first = null;
    for (const [r, a, k] of P) {
      const os = mk(E, V, 'o'), gn = mk(E, V, 'g'); os.frequency.value = f * r * (1 + (rnd(E) - 0.5) * 0.002);
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vel * a * 0.11, t + 0.002); gn.gain.setTargetAtTime(0, t + 0.003, T * k / 4.5);
      os.connect(gn); gn.connect(out); os.start(t); os.stop(end); first = first || os;
    }
    const n = noiseSrc(E, V, 'white', t, t + 0.08), bp = mk(E, V, 'f'), ng = mk(E, V, 'g');
    bp.type = 'bandpass'; bp.frequency.value = Math.min(8000, f * 5); bp.Q.value = 2;
    ng.gain.setValueAtTime(vel * 0.12, t); ng.gain.setTargetAtTime(0, t, 0.012);
    n.connect(bp); bp.connect(ng); ng.connect(out); V.done(first);
  }
  // The warm pad: detuned saws per note through one slow low-pass filter that opens as the chord swells
  function pad(E, t, ms, dur, vel, out, o = {}) {
    const c = E.ctx, att = o.att ?? Math.min(1.1, dur * 0.35 + 0.15), rel = o.rel ?? 1.5, end = t + dur + rel;
    const V = voice(E, t, end, 0); if (!V) return;
    const cut = o.cutoff || 1200, flt = mk(E, V, 'f'), gn = mk(E, V, 'g');
    flt.type = 'lowpass'; flt.Q.value = 0.5;
    flt.frequency.setValueAtTime(cut * 0.45, t); flt.frequency.linearRampToValueAtTime(cut, t + att); flt.frequency.setTargetAtTime(cut * 0.7, t + dur, rel / 2);
    const pk = vel * 0.38 / Math.sqrt(ms.length);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(pk, t + att); gn.gain.setTargetAtTime(0, t + dur, rel / 3.5);
    let first = null;
    for (const m of ms) for (const d of (E.light ? [0] : [-7, 6])) {
      const os = mk(E, V, 'o'); os.type = 'sawtooth'; os.frequency.value = f2(m); os.detune.value = d + (rnd(E) - 0.5) * 3;
      os.connect(flt); os.start(t); os.stop(end); first = first || os;
    }
    flt.connect(gn); gn.connect(out); V.done(first);
  }
  // Strings: bowed saws in a section, with a shared vibrato; tremolo for the night's tension
  function strings(E, t, ms, dur, vel, out, o = {}) {
    const c = E.ctx, att = o.att ?? Math.min(0.9, 0.2 + dur * 0.2), rel = o.rel ?? 0.9, end = t + dur + rel;
    const V = voice(E, t, end, 0); if (!V) return;
    const flt = mk(E, V, 'f'), gn = mk(E, V, 'g'), lfo = mk(E, V, 'o'), lg = mk(E, V, 'g');
    flt.type = 'lowpass'; flt.frequency.value = o.trem ? 3200 : 2600; flt.Q.value = 0.7;
    lfo.frequency.value = 5.1; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + 0.6); lfo.connect(lg);
    const pk = vel * (o.trem ? 0.7 : 0.45) / Math.sqrt(ms.length);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(pk, t + att); gn.gain.setTargetAtTime(0, t + dur, rel / 3.5);
    let last = gn;
    if (o.trem) { const tg = mk(E, V, 'g'), tl = mk(E, V, 'o'), td = mk(E, V, 'g'); tg.gain.value = 0.55; tl.frequency.value = 8.5; td.gain.value = 0.45; tl.connect(td); td.connect(tg.gain); gn.connect(tg); last = tg; tl.start(t); tl.stop(end); }
    let first = null;
    for (const m of ms) for (const d of (E.light ? [0] : [-8, 7])) {
      const os = mk(E, V, 'o'); os.type = 'sawtooth'; os.frequency.value = f2(m); os.detune.value = d; lg.connect(os.detune);
      os.connect(flt); os.start(t); os.stop(end); first = first || os;
    }
    flt.connect(gn); last.connect(out); lfo.start(t); lfo.stop(end); V.done(first);
  }
  // A bowed bass or cello line: a saw through a low-pass, a sine underneath for body, bow noise, late vibrato.
  // spicc: short and bounced, for driving patterns.
  function bowed(E, t, m, dur, vel, out, o = {}) {
    const c = E.ctx, f = f2(m), short = o.spicc || dur < 0.22, att = short ? 0.008 : Math.min(0.32, Math.max(0.06, dur * 0.22)), rel = short ? 0.08 : 0.3;
    const len = short ? Math.min(dur, 0.16) : dur, end = t + len + rel;
    const V = voice(E, t, end, 1); if (!V) return;
    const os = mk(E, V, 'o'), sub = mk(E, V, 'o'), sg = mk(E, V, 'g'), flt = mk(E, V, 'f'), gn = mk(E, V, 'g');
    os.type = 'sawtooth'; os.frequency.value = f; sub.frequency.value = f; sg.gain.value = 0.35;
    flt.type = 'lowpass'; flt.frequency.value = Math.min(5000, f * (short ? 6 : 4.5) + 350); flt.Q.value = 1.1;
    const pk = vel * 0.7;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(pk, t + att);
    if (short) gn.gain.setTargetAtTime(pk * 0.35, t + att, 0.045);
    gn.gain.setTargetAtTime(0, t + len, rel / 3);
    if (!short && dur > 0.6) { const lfo = mk(E, V, 'o'), lg = mk(E, V, 'g'); lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(7, t + 0.7); lfo.connect(lg); lg.connect(os.detune); lfo.start(t); lfo.stop(end); }
    if (!E.light) { const n = noiseSrc(E, V, 'pink', t, end), bp = mk(E, V, 'f'), ng = mk(E, V, 'g'); bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 3); bp.Q.value = 0.8; ng.gain.value = vel * 0.05; n.connect(bp); bp.connect(ng); ng.connect(gn); }
    os.connect(flt); sub.connect(sg); sg.connect(flt); flt.connect(gn); gn.connect(out);
    os.start(t); sub.start(t); os.stop(end); sub.stop(end); V.done(os);
  }
  // Low brass for the Baron: two saws and a reedy square, a filter that opens on the attack (the "blat"),
  // and a little scoop up into pitch
  function brass(E, t, m, dur, vel, out, o = {}) {
    const c = E.ctx, f = f2(m), att = o.att ?? (dur < 0.3 ? 0.03 : 0.085), rel = 0.18, end = t + dur + rel;
    const V = voice(E, t, end, 1); if (!V) return;
    const flt = mk(E, V, 'f'), gn = mk(E, V, 'g'); flt.type = 'lowpass'; flt.Q.value = 1.6;
    flt.frequency.setValueAtTime(f * 1.2 + 120, t); flt.frequency.linearRampToValueAtTime(Math.min(6000, f * (3 + vel * 5) + 500), t + att * 1.3);
    flt.frequency.setTargetAtTime(f * 2.6 + 350, t + att * 1.3, 0.25); flt.frequency.setTargetAtTime(f * 1.2 + 100, t + dur, 0.06);
    const pk = vel * 0.56;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(pk, t + att); gn.gain.setTargetAtTime(pk * 0.82, t + att, 0.2); gn.gain.setTargetAtTime(0, t + dur, rel / 3);
    let first = null;
    for (const [type, mul, det, lv] of E.light ? [['sawtooth', 1, 0, 1], ['square', 1, 0, 0.22]] : [['sawtooth', 1, -5, 0.7], ['sawtooth', 1, 5, 0.7], ['square', 1, 0, 0.2]]) {
      const os = mk(E, V, 'o'), og = mk(E, V, 'g'); os.type = type; os.frequency.value = f * mul;
      os.detune.setValueAtTime(det - 38, t); os.detune.linearRampToValueAtTime(det, t + att + 0.02); og.gain.value = lv;
      os.connect(og); og.connect(flt); os.start(t); os.stop(end); first = first || os;
    }
    flt.connect(gn); gn.connect(out); V.done(first);
  }
  // Drums: D doum (a frame drum's low note), T tek (a high slap), k ka (muted), s shaker, B a big drum, r a roll
  function drum(E, t, d, vel, out) {
    const c = E.ctx, lo = d.toLowerCase(), v = vel * (d === lo && lo !== 's' && lo !== 'k' ? 0.75 : 1) * (lo === 'b' ? 0.55 : lo === 'd' ? 1.25 : lo === 's' ? 1.6 : 1);
    if (lo === 'r') { for (let i = 0; i < 3; i++) drum(E, t + i * 0.045, 't', 0.45 + i * 0.2, out); return; }
    const big = lo === 'b', low = lo === 'd' || big;
    const dec = big ? 1.1 : lo === 'd' ? 0.42 : lo === 't' ? 0.07 : lo === 'k' ? 0.03 : 0.08, end = t + dec + 0.05;
    const V = voice(E, t, end, 1); if (!V) return;
    let src = null;
    if (low) {
      const os = mk(E, V, 'o'), gn = mk(E, V, 'g'); os.frequency.setValueAtTime(big ? 110 : 150, t); os.frequency.exponentialRampToValueAtTime(big ? 42 : 56, t + (big ? 0.22 : 0.09));
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(v * (big ? 0.75 : 0.62), t + 0.004); gn.gain.setTargetAtTime(0, t + 0.01, dec / 3.6);
      os.connect(gn); gn.connect(out); os.start(t); os.stop(end); src = os;
    }
    const n = noiseSrc(E, V, low ? 'brown' : 'white', t, end), fl = mk(E, V, 'f'), ng = mk(E, V, 'g');
    if (low) { fl.type = 'lowpass'; fl.frequency.value = big ? 260 : 420; ng.gain.setValueAtTime(v * (big ? 0.5 : 0.32), t); ng.gain.setTargetAtTime(0, t, big ? 0.05 : 0.025); }
    else if (lo === 't') { fl.type = 'bandpass'; fl.frequency.value = 2500; fl.Q.value = 1.3; ng.gain.setValueAtTime(v * 0.42, t); ng.gain.setTargetAtTime(0, t, 0.017); const os = mk(E, V, 'o'), gn = mk(E, V, 'g'); os.frequency.setValueAtTime(540, t); os.frequency.exponentialRampToValueAtTime(330, t + 0.025); gn.gain.setValueAtTime(v * 0.24, t); gn.gain.setTargetAtTime(0, t, 0.02); os.connect(gn); gn.connect(out); os.start(t); os.stop(end); }
    else if (lo === 'k') { fl.type = 'highpass'; fl.frequency.value = 1700; ng.gain.setValueAtTime(v * 0.3, t); ng.gain.setTargetAtTime(0, t, 0.008); }
    else { fl.type = 'highpass'; fl.frequency.value = 5200; ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(v * 0.16, t + 0.007); ng.gain.setTargetAtTime(0, t + 0.008, 0.028); }
    n.connect(fl); fl.connect(ng); ng.connect(out); V.done(src || n);
  }
  const INST = {
    harp: (E, t, m, d, v, out, o) => pluck(E, t, m, d, v, out, { ...o, kind: 'harp' }),
    pluck: (E, t, m, d, v, out, o) => pluck(E, t, m, d, v, out, { ...o, kind: 'pluck' }),
    pizz: (E, t, m, d, v, out, o) => pluck(E, t, m, d, v, out, { ...o, kind: 'pizz' }),
    whistle, flute: (E, t, m, d, v, out, o) => whistle(E, t, m, d, v, out, { ...o, flute: true }),
    box, bell, bowed, spicc: (E, t, m, d, v, out, o) => bowed(E, t, m, d, v, out, { ...o, spicc: true }), brass,
    pad, strings, trem: (E, t, ms, d, v, out, o) => strings(E, t, ms, d, v, out, { ...o, trem: true }),
  };

  // ---------------------------------------------------------------- effects
  // building blocks for the effects below
  function tone(E, t, out, type, f0, f1, dur, peak, att = 0.004) {
    const V = voice(E, t, t + att + dur + 0.05, 2); if (!V) return;
    const os = mk(E, V, 'o'), gn = mk(E, V, 'g'); os.type = type; os.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) os.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(peak, t + att); gn.gain.setTargetAtTime(0, t + att, dur / 4);
    os.connect(gn); gn.connect(out); os.start(t); os.stop(t + att + dur + 0.05); V.done(os);
  }
  function burst(E, t, out, dur, type, f0, f1, peak, q = 1, kind = 'white', att = 0.003) {
    const V = voice(E, t, t + att + dur + 0.05, 2); if (!V) return;
    const n = noiseSrc(E, V, kind, t, t + att + dur + 0.05), fl = mk(E, V, 'f'), gn = mk(E, V, 'g');
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(peak, t + att); gn.gain.setTargetAtTime(0, t + att, dur / 4);
    n.connect(fl); fl.connect(gn); gn.connect(out); V.done(n);
  }
  // a swell of noise (a gust, rain, a rumble), shaped by a list of [time, level] points
  function swell(E, t, out, pts, type, f0, f1, q = 0.7, kind = 'brown') {
    const T = pts[pts.length - 1][0], V = voice(E, t, t + T + 0.1, 2); if (!V) return;
    const n = noiseSrc(E, V, kind, t, t + T + 0.1), fl = mk(E, V, 'f'), gn = mk(E, V, 'g');
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + T);
    gn.gain.setValueAtTime(0, t); for (const [pt, lv] of pts) gn.gain.linearRampToValueAtTime(lv, t + pt);
    n.connect(fl); fl.connect(gn); gn.connect(out); V.done(n);
  }
  const M = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const n2m = s => { const r = /^([A-G])([#b]?)(\d)$/.exec(s); return 12 * (+r[3] + 1) + M[r[1]] + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0); };
  const notes = (E, t, out, inst, list, step, vel = 0.8, dur = 0.5) => list.split(' ').forEach((s, i) => s !== '.' && INST[inst](E, t + i * step, n2m(s), dur, vel, out, { prio: 2 }));
  // each: [(engine, time, out) => ..., how much reverb it gets, its trim in dB (measured with test/audio.py)]
  const SFX = {
    tap: [(E, t, o) => { tone(E, t, o, 'triangle', 1150, 780, 0.045, 0.09); burst(E, t, o, 0.02, 'bandpass', 2800, 2800, 0.05, 2); }, 0.08, 5],
    open: [(E, t, o) => notes(E, t, o, 'harp', 'G5 D6', 0.055, 0.7, 0.4), 0.25, -3.5],
    lift: [(E, t, o) => { burst(E, t, o, 0.14, 'bandpass', 500, 1500, 0.1, 1.5); tone(E, t, o, 'sine', 420, 600, 0.09, 0.05); }, 0.1, 6],
    place: [(E, t, o) => { tone(E, t, o, 'sine', 170, 75, 0.12, 0.3); burst(E, t, o, 0.06, 'lowpass', 700, 300, 0.22, 0.7, 'pink'); burst(E, t + 0.01, o, 0.03, 'bandpass', 2200, 1800, 0.05, 2); }, 0.12, -1],
    // hammering as work begins: a tap of metal and a knock of wood, four times, a little uneven
    build: [(E, t, o) => { for (let i = 0; i < 4; i++) { const u = t + i * 0.17 + rnd(E) * 0.03; burst(E, u, o, 0.025, 'bandpass', 3200, 2600, 0.12, 3); tone(E, u, o, 'sine', 240 - i * 8, 140, 0.07, 0.22); burst(E, u, o, 0.05, 'lowpass', 900, 400, 0.12, 0.7, 'pink'); } }, 0.2, 0.7],
    // a building finished: the last knock, then the harp runs up the chord and a music box rings the top
    built: [(E, t, o) => { tone(E, t, o, 'sine', 230, 130, 0.09, 0.25); burst(E, t, o, 0.03, 'bandpass', 3000, 2400, 0.1, 3); notes(E, t + 0.12, o, 'harp', 'G4 B4 D5 G5', 0.06, 0.75, 0.9); box(E, t + 0.4, n2m('D6'), 1, 0.7, o, { prio: 2 }); burst(E, t + 0.4, o, 0.6, 'highpass', 6000, 9000, 0.025, 0.7); }, 0.35, -4.8],
    upgraded: [(E, t, o) => { SFX.built[0](E, t, o); bell(E, t + 0.42, n2m('G4'), 1, 0.45, o, { short: 0.6 }); brass(E, t + 0.4, n2m('G3'), 0.5, 0.6, o); brass(E, t + 0.4, n2m('D4'), 0.5, 0.5, o); }, 0.38, -3.5],
    // a study mastered: the harp sweeps up the scale, a bell, and a whistle trill that lands high
    levelup: [(E, t, o) => { notes(E, t, o, 'harp', 'D4 E4 F#4 G4 A4 B4 C#5 D5 E5 F#5 A5', 0.035, 0.7, 1); bell(E, t + 0.4, n2m('D5'), 1, 0.5, o, { short: 0.7 }); for (let i = 0; i < 6; i++) whistle(E, t + 0.42 + i * 0.055, n2m(i % 2 ? 'B5' : 'A5'), 0.05, 0.6, o); whistle(E, t + 0.75, n2m('D6'), 0.6, 0.8, o); }, 0.38, -5.5],
    statup: [(E, t, o) => { box(E, t, n2m('E6'), 1, 0.7, o, { prio: 2 }); box(E, t + 0.08, n2m('B6'), 1, 0.55, o, { prio: 2 }); }, 0.35, -4.9],
    chime: [(E, t, o) => { box(E, t, n2m('A5'), 1, 0.7, o, { prio: 2 }); box(E, t + 0.07, n2m('E6'), 1, 0.6, o, { prio: 2 }); }, 0.35, -5],
    goal: [(E, t, o) => { box(E, t, n2m('A5'), 1, 0.65, o, { prio: 2 }); box(E, t + 0.09, n2m('D6'), 1, 0.75, o, { prio: 2 }); burst(E, t + 0.08, o, 0.35, 'highpass', 7000, 9000, 0.02, 0.7); }, 0.35, -5.8],
    // lens tower: a quick rising charge, then the shot
    zap: [(E, t, o) => { tone(E, t, o, 'sine', 380, 2200, 0.08, 0.06, 0.06); tone(E, t + 0.085, o, 'sawtooth', 2100, 260, 0.26, 0.07); tone(E, t + 0.085, o, 'sine', 2800, 1500, 0.18, 0.05); burst(E, t + 0.085, o, 0.12, 'bandpass', 3000, 1200, 0.1, 1.2); }, 0.2, 6.3],
    flare: [(E, t, o) => { burst(E, t, o, 0.28, 'bandpass', 700, 3200, 0.1, 2); tone(E, t + 0.22, o, 'sine', 900, 1500, 0.12, 0.04); }, 0.25, 14.9],
    // the jumpers' guns: two dull booms and a hiss
    volley: [(E, t, o) => { for (const u of [0, 0.09]) { tone(E, t + u, o, 'sine', 95, 38, 0.4, 0.36); burst(E, t + u, o, 0.3, 'lowpass', 900, 160, 0.3, 0.7, 'brown'); } burst(E, t + 0.2, o, 0.25, 'highpass', 3000, 5000, 0.04, 0.7); }, 0.3, 0],
    // the clockwork ballista: a creak of wood, the twang of the bow and the thunk of the bolt
    thunk: [(E, t, o) => { tone(E, t, o, 'sawtooth', 70, 50, 0.06, 0.06); pluck(E, t + 0.04, n2m('E2'), 0.2, 0.9, o, { kind: 'pizz', prio: 2 }); tone(E, t + 0.04, o, 'triangle', 200, 70, 0.14, 0.2); burst(E, t + 0.04, o, 0.06, 'lowpass', 700, 300, 0.16, 0.7, 'pink'); }, 0.18, -7.8],
    cannon: [(E, t, o) => { burst(E, t, o, 0.02, 'highpass', 2500, 2500, 0.18, 0.7); tone(E, t, o, 'sine', 80, 34, 0.55, 0.5); burst(E, t, o, 0.6, 'lowpass', 1200, 160, 0.42, 0.7, 'brown'); }, 0.32, 1.9],
    cannonfar: [(E, t, o) => { tone(E, t, o, 'sine', 70, 34, 0.5, 0.3); burst(E, t, o, 0.6, 'lowpass', 500, 120, 0.28, 0.7, 'brown'); }, 0.45, 0],
    hit: [(E, t, o) => { burst(E, t, o, 0.1, 'bandpass', 1000, 600, 0.2, 1.2); tone(E, t, o, 'triangle', 300, 110, 0.12, 0.12); }, 0.15, 9.3],
    hullhit: [(E, t, o) => { burst(E, t, o, 0.04, 'highpass', 1800, 1800, 0.2, 0.7); tone(E, t, o, 'sine', 140, 55, 0.25, 0.4); burst(E, t, o, 0.25, 'bandpass', 600, 250, 0.3, 1, 'pink'); }, 0.2, 3.6],
    raiderhit: [(E, t, o) => { burst(E, t, o, 0.06, 'bandpass', 1400, 800, 0.16, 1.5); tone(E, t, o, 'sine', 180, 80, 0.12, 0.14); }, 0.25, 9],
    // a Wildlight fades: glassy notes falling down the scale, and a breath of air
    poof: [(E, t, o) => { const s = ['E6', 'D6', 'B5', 'A5', 'G5', 'E5']; let k = 0; for (let i = 0; i < 6; i++) { if (rnd(E) < 0.25) continue; box(E, t + k * 0.04, n2m(s[i]), 0.5, 0.35 + rnd(E) * 0.2, o, { prio: 2 }); k++; } burst(E, t, o, 0.4, 'bandpass', 4200, 900, 0.06, 1.2); }, 0.45, -8.5],
    crack: [(E, t, o) => { burst(E, t, o, 0.5, 'lowpass', 1600, 300, 0.4, 0.7, 'pink'); tone(E, t, o, 'sine', 75, 38, 0.8, 0.4); for (let i = 0; i < 7; i++) burst(E, t + 0.08 + rnd(E) * 0.6, o, 0.03, 'bandpass', 1200 + rnd(E) * 2000, 900, 0.08, 2); }, 0.3, 0.9],
    wallhit: [(E, t, o) => { burst(E, t, o, 0.06, 'bandpass', 900, 600, 0.14, 2, 'pink'); burst(E, t + 0.02, o, 0.02, 'bandpass', 2400, 2000, 0.05, 3); }, 0.2, 23],
    // a lamp snuffed: a soft fwoomp as the flame is drunk, and a tink of glass
    snuff: [(E, t, o) => { burst(E, t, o, 0.28, 'lowpass', 2200, 180, 0.22, 0.8, 'pink'); tone(E, t, o, 'sine', 210, 110, 0.2, 0.12); tone(E, t + 0.05, o, 'sine', 2900, 2900, 0.12, 0.04); }, 0.3, 6],
    // a jumper going down: her timbers groan, a boom, and a long whistle as she falls into the cloud
    jumperdown: [(E, t, o) => { tone(E, t, o, 'sawtooth', 62, 42, 0.7, 0.07, 0.15); SFX.cannon[0](E, t + 0.15, o); tone(E, t + 0.3, o, 'sine', 1300, 260, 1.8, 0.04, 0.2); swell(E, t + 1.6, o, [[0.05, 0.2], [0.6, 0.12], [1.6, 0]], 'lowpass', 500, 120); }, 0.45, -0.7],
    raiderdown: [(E, t, o) => { SFX.cannon[0](E, t, o); for (let i = 0; i < 6; i++) burst(E, t + 0.1 + rnd(E) * 0.7, o, 0.05, 'bandpass', 600 + rnd(E) * 1500, 400, 0.1, 1.5, 'pink'); tone(E, t + 0.2, o, 'sawtooth', 58, 40, 0.8, 0.06, 0.2); }, 0.4, 1.4],
    sunk: [(E, t, o) => { tone(E, t, o, 'sawtooth', 55, 36, 1.2, 0.09, 0.2); SFX.cannon[0](E, t + 0.1, o); swell(E, t + 0.3, o, [[0.2, 0.32], [1.2, 0.2], [2.6, 0]], 'lowpass', 700, 90); }, 0.5, -0.6],
    tower: [(E, t, o) => { SFX.cannon[0](E, t, o); bell(E, t + 0.02, n2m('C#4'), 1, 0.35, o, { short: 0.25 }); }, 0.35, 0.9],
    pickup: [(E, t, o) => box(E, t, n2m(['A6', 'B6', 'D7'][Math.floor(rnd(E) * 3)]), 0.3, 0.4, o, { prio: 2 }), 0.25, 0],
    // the courier's horn: a long brass call, a fifth, from across the cloud
    horn: [(E, t, o) => { brass(E, t, n2m('D4'), 0.45, 0.75, o, { att: 0.12 }); brass(E, t + 0.5, n2m('A4'), 1.1, 0.85, o, { att: 0.14 }); }, 0.6, -4.3],
    warhorn: [(E, t, o) => { brass(E, t, n2m('C3'), 0.5, 0.9, o, { att: 0.1 }); brass(E, t + 0.55, n2m('Eb3'), 0.3, 0.85, o); brass(E, t + 0.9, n2m('C3'), 1.0, 0.95, o, { att: 0.1 }); }, 0.55, -3.3],
    bell: [(E, t, o) => bell(E, t, n2m('G3'), 1, 0.9, o), 0.5, 4.4],
    // a pick in the mine: a ring of steel on stone, and grit falling
    dig: [(E, t, o) => { const k = 0.9 + rnd(E) * 0.2; tone(E, t, o, 'sine', 2350 * k, 2300 * k, 0.11, 0.08, 0.001); tone(E, t, o, 'sine', 3170 * k, 3100 * k, 0.07, 0.05, 0.001); burst(E, t, o, 0.05, 'bandpass', 1300, 900, 0.18, 1.5, 'pink'); burst(E, t + 0.04, o, 0.15, 'highpass', 2500, 2500, 0.03, 0.7); }, 0.4, 10.8],
    rockfall: [(E, t, o) => { swell(E, t, o, [[0.06, 0.4], [0.5, 0.25], [1.3, 0]], 'lowpass', 600, 140, 0.7); for (let i = 0; i < 14; i++) burst(E, t + rnd(E) * 1.1, o, 0.025, 'bandpass', 900 + rnd(E) * 2600, 700, 0.06 + rnd(E) * 0.06, 2, 'pink'); }, 0.4, 5.2],
    cart: [(E, t, o) => { swell(E, t, o, [[0.8, 0.16], [2.5, 0.14], [3.6, 0]], 'bandpass', 160, 120, 0.9); for (let i = 0; i < 8; i++) burst(E, t + 0.3 + rnd(E) * 2.8, o, 0.03, 'bandpass', 1500 + rnd(E) * 1500, 1200, 0.03, 3); }, 0.4, 11.5],
    // thunder: a crack if it's close, then the roll, swelling and fading a few times
    thunder: [(E, t, o) => { burst(E, t, o, 0.08, 'highpass', 1500, 600, 0.12, 0.7); const pts = [[0.06, 0.45]]; let x = 0.06; for (let i = 0; i < 4; i++) { x += 0.5 + rnd(E) * 0.7; pts.push([x, 0.18 + rnd(E) * 0.3]); } pts.push([x + 1.6, 0]); swell(E, t, o, pts, 'lowpass', 420, 70, 0.7); tone(E, t + 0.04, o, 'sine', 52, 34, 1.4, 0.18, 0.05); }, 0.45, 3.4],
    raidlost: [(E, t, o) => { brass(E, t, n2m('A2'), 0.9, 0.7, o); brass(E, t + 0.5, n2m('F2'), 1.2, 0.6, o); }, 0.45, -3.4],
    sail: [(E, t, o) => { swell(E, t, o, [[0.4, 0.2], [1.2, 0.12], [2.2, 0]], 'bandpass', 400, 1200, 0.8, 'pink'); }, 0.3, 8.2],
    // a Bright Night's boss: a low growl that swells and a glassy shriek over it (the Wildlight are light, after all)
    bossroar: [(E, t, o) => { swell(E, t, o, [[0.18, 0.55], [0.8, 0.4], [1.5, 0]], 'lowpass', 900, 160, 0.9, 'pink'); tone(E, t, o, 'sawtooth', 104, 52, 1.3, 0.1, 0.09);
      tone(E, t + 0.05, o, 'sine', 1760, 2637, 0.8, 0.025, 0.18); tone(E, t + 0.1, o, 'sine', 2217, 1480, 0.95, 0.02, 0.22); }, 0.5, 0],
    // the alarm: the watch bell rung fast, for a wave of Wildlight coming up the cliffs
    alarm: [(E, t, o) => { for (let i = 0; i < 3; i++) bell(E, t + i * 0.26, n2m(i === 2 ? 'A4' : 'D5'), 1, 0.75, o, { short: 0.45 }); }, 0.5, 2],
  };
  // loot by rarity: plain for salvage, a little brighter each step, and Signed, Masterwork, Guild and Sunforged grander
  const LOOT = ['salvage', 'tooled', 'tuned', 'calibrated', 'signed', 'masterwork', 'guild', 'sunforged'];
  function loot(E, t, o, rank) {
    if (rank <= 3) { pluck(E, t, n2m(['A5', 'B5', 'C#6', 'D6'][rank]), 0.4, 0.75, o, { kind: 'pluck', prio: 2 }); burst(E, t, o, 0.02, 'bandpass', 3500, 3000, 0.06, 3); if (rank >= 2) box(E, t + 0.06, n2m(rank === 2 ? 'E6' : 'F#6'), 1, 0.5, o, { prio: 2 }); return; }
    if (rank === 4) { notes(E, t, o, 'harp', 'D5 F#5 A5', 0.06, 0.75, 0.9); box(E, t + 0.18, n2m('D6'), 1, 0.7, o, { prio: 2 }); return; }
    if (rank === 5) { notes(E, t, o, 'harp', 'D5 F#5 A5 D6', 0.055, 0.8, 1); box(E, t + 0.24, n2m('F#6'), 1, 0.7, o, { prio: 2 }); bell(E, t + 0.24, n2m('A4'), 1, 0.6, o, { short: 0.6 }); burst(E, t + 0.22, o, 0.8, 'highpass', 6500, 9000, 0.03, 0.7); return; }
    if (rank === 6) { brass(E, t, n2m('D3'), 0.4, 0.7, o); brass(E, t + 0.25, n2m('A3'), 0.8, 0.75, o); notes(E, t + 0.25, o, 'harp', 'D5 E5 F#5 A5 D6', 0.05, 0.8, 1); box(E, t + 0.52, n2m('A6'), 1, 0.65, o, { prio: 2 }); bell(E, t + 0.5, n2m('D5'), 1, 0.6, o, { short: 0.8 }); return; }
    // Sunforged: a deep boom, the harp sweeping two octaves, bells on the D major chord, brass, and a long shimmer
    tone(E, t, o, 'sine', 90, 40, 0.9, 0.35); brass(E, t + 0.05, n2m('D3'), 1.2, 0.8, o); brass(E, t + 0.05, n2m('A3'), 1.2, 0.7, o);
    notes(E, t + 0.1, o, 'harp', 'D4 F#4 A4 D5 F#5 A5 D6 F#6', 0.045, 0.8, 1.2);
    for (const [s, u] of [['D5', 0.45], ['F#5', 0.55], ['A5', 0.65]]) bell(E, t + u, n2m(s), 1, 0.45, o, { short: 0.9 });
    burst(E, t + 0.4, o, 1.8, 'highpass', 6000, 10000, 0.035, 0.7);
  }

  // ---------------------------------------------------------------- ambience: beds that run, and things that happen
  // A bed is a loop of noise (or a held tone) that's started when it's wanted and stopped when it's been silent a while.
  function bed(E, name, make) { return E.beds[name] || (E.beds[name] = { name, make, on: null, quiet: 0 }); }
  function bedSet(E, B, v, now, tau = 0.8) {
    if (v > 0.0005 && !B.on) { B.on = B.make(E); B.on.g.gain.setValueAtTime(0, now); E.persist += B.on.nodes.length; }
    if (!B.on) return;
    B.on.g.gain.setTargetAtTime(v, now, tau);
    if (v > 0.0005) { B.quiet = 0; return; }
    if (!B.quiet) B.quiet = now; else if (now - B.quiet > tau * 6 + 1) {
      for (const s of B.on.srcs) try { s.stop(); } catch (e) { }
      for (const n of B.on.nodes) try { n.disconnect(); } catch (e) { }
      E.persist -= B.on.nodes.length; B.on = null; B.quiet = 0;
    }
  }
  function loopNoise(E, kind) { const s = E.ctx.createBufferSource(); s.buffer = E.noise[kind]; s.loop = true; s.start(E.ctx.currentTime + 0.01, rnd(E) * 1.5); return s; }
  const BEDS = {
    // wind over the plateau: pink noise through a band that wanders
    wind: E => { const c = E.ctx, s = loopNoise(E, 'pink'), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.55; s.connect(f); f.connect(g); g.connect(p); p.connect(E.amb); return { g, f, p, srcs: [s], nodes: [s, f, g, p] }; },
    // the skies: a low rush and a thin whistle in the rigging, both rising with the ship's speed
    sky: E => { const c = E.ctx, s = loopNoise(E, 'brown'), w = loopNoise(E, 'white'), lo = c.createBiquadFilter(), hi = c.createBiquadFilter(), hg = c.createGain(), g = c.createGain(); lo.type = 'lowpass'; lo.frequency.value = 400; hi.type = 'bandpass'; hi.frequency.value = 1400; hi.Q.value = 5; hg.gain.value = 0.25; s.connect(lo); lo.connect(g); w.connect(hi); hi.connect(hg); hg.connect(g); g.connect(E.amb); return { g, lo, hi, hg, srcs: [s, w], nodes: [s, w, lo, hi, hg, g] }; },
    rain: E => { const c = E.ctx, s = loopNoise(E, 'white'), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 700; lp.type = 'lowpass'; lp.frequency.value = 7000; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(E.amb); return { g, srcs: [s], nodes: [s, hp, lp, g] }; },
    // the Wildlight's hum: E and B, slowly beating, when they're near
    hum: E => { const c = E.ctx, g = c.createGain(), srcs = [], nodes = [g]; for (const [f, v] of [[164.8, 0.5], [165.5, 0.4], [246.9, 0.35], [329.6, 0.12]]) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f; og.gain.value = v; o.connect(og); og.connect(g); o.start(); srcs.push(o); nodes.push(o, og); } g.connect(E.amb); g.connect(E.ambRev); return { g, srcs, nodes }; },
    // the hearth: a hiss and a low roar under the crackles
    fire: E => { const c = E.ctx, a = loopNoise(E, 'pink'), b = loopNoise(E, 'brown'), fa = c.createBiquadFilter(), fb = c.createBiquadFilter(), ga = c.createGain(), g = c.createGain(); fa.type = 'bandpass'; fa.frequency.value = 1800; fa.Q.value = 0.4; ga.gain.value = 0.35; fb.type = 'lowpass'; fb.frequency.value = 180; a.connect(fa); fa.connect(ga); ga.connect(g); b.connect(fb); fb.connect(g); g.connect(E.amb); return { g, srcs: [a, b], nodes: [a, b, fa, fb, ga, g] }; },
    // the mine: the deep, still air of the rock
    cave: E => { const c = E.ctx, s = loopNoise(E, 'brown'), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = 130; s.connect(f); f.connect(g); g.connect(E.amb); return { g, srcs: [s], nodes: [s, f, g] }; },
  };
  // a small strip for an ambient event: its pan and how much of it goes to the reverb (and the mine's echo)
  function ambOut(E, t, pan, rev, echo, len) {
    const c = E.ctx, g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(E.amb); } else g.connect(E.amb);
    const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(E.ambRev);
    let e = null; if (echo) { e = c.createGain(); e.gain.value = echo; g.connect(e); e.connect(E.ambEcho); }
    if (!E.offline) setTimeout(() => { for (const n of [g, p, r, e]) if (n) try { n.disconnect(); } catch (x) { } }, (t - c.currentTime + len + 1) * 1000);
    return g;
  }
  const chirp = (E, t, o, f0, f1, dur, v) => tone(E, t, o, 'sine', f0, f1, dur, v, 0.006);
  const EVENTS = {
    // birdsong: a few kinds, each a short phrase
    birds: [st => st.day > 0.4 && st.out && st.rain < 0.5, [1.8, 6], (E, t, st) => {
      const o = ambOut(E, t, rnd(E) * 1.6 - 0.8, 0.3, 0, 2), kind = Math.floor(rnd(E) * 3), v = 0.05 + rnd(E) * 0.04, f = 2600 + rnd(E) * 1400;
      if (kind === 0) { const n = 2 + Math.floor(rnd(E) * 3); for (let i = 0; i < n; i++) chirp(E, t + i * (0.09 + rnd(E) * 0.04), o, f, f * 1.35, 0.06, v); }
      else if (kind === 1) { chirp(E, t, o, f * 1.1, f * 1.15, 0.16, v); chirp(E, t + 0.2, o, f * 0.86, f * 0.8, 0.22, v * 0.9); }
      else { for (let i = 0; i < 8; i++) chirp(E, t + i * 0.035, o, f * 1.3, f * 1.22, 0.025, v * 0.7); }
    }],
    // distant hammering while something is going up
    hammer: [st => st.builders && st.out, [0.35, 1.1], (E, t, st) => { const o = ambOut(E, t, st.buildPan, 0.45, 0, 1); burst(E, t, o, 0.02, 'bandpass', 3000, 2600, 0.035, 3); tone(E, t, o, 'sine', 210, 150, 0.05, 0.05); }],
    crickets: [st => st.night > 0.5 && st.out && st.rain < 0.6, [0.18, 0.5], (E, t, st) => { const o = ambOut(E, t, rnd(E) * 1.8 - 0.9, 0.15, 0, 1), f = 4300 + rnd(E) * 600, v = 0.009 + rnd(E) * 0.01, n = 3 + Math.floor(rnd(E) * 2); for (let i = 0; i < n; i++) tone(E, t + i * 0.032, o, 'sine', f, f, 0.012, v, 0.003); }],
    owl: [st => st.night > 0.7 && st.out, [18, 45], (E, t, st) => { const o = ambOut(E, t, rnd(E) - 0.5, 0.5, 0, 2); tone(E, t, o, 'sine', 390, 360, 0.3, 0.035, 0.06); tone(E, t + 0.45, o, 'sine', 380, 350, 0.45, 0.03, 0.08); }],
    drips: [st => st.mine, [0.5, 2.4], (E, t, st) => { const o = ambOut(E, t, rnd(E) * 1.4 - 0.7, 0.4, 0.5, 2), f = 900 + rnd(E) * 900; tone(E, t, o, 'sine', f, f * 2.2, 0.035, 0.06, 0.001); }],
    picks: [st => st.mine && st.miners, [0.7, 2.0], (E, t, st) => { const o = ambOut(E, t, rnd(E) - 0.5, 0.4, 0.4, 1.5); SFX.dig[0](E, t, o); }],
    cart: [st => st.mine, [14, 30], (E, t, st) => { const o = ambOut(E, t, rnd(E) - 0.5, 0.4, 0.2, 5); SFX.cart[0](E, t, o); }],
    crackle: [st => st.keep, [0.03, 0.22], (E, t, st) => { const o = ambOut(E, t, rnd(E) * 0.6 - 0.3, 0.15, 0, 0.5); const pop = rnd(E) < 0.06; burst(E, t, o, pop ? 0.02 : 0.004, 'highpass', pop ? 900 : 2200, pop ? 900 : 2200, (pop ? 0.24 : 0.055) * (0.4 + rnd(E)), 0.7); }],
    creak: [st => st.sky, [5, 14], (E, t, st) => { const o = ambOut(E, t, rnd(E) - 0.5, 0.3, 0, 2); const f = 160 + rnd(E) * 90; tone(E, t, o, 'sawtooth', f, f * 0.8, 0.4, 0.012, 0.15); }],
    drops: [st => st.rain > 0.05, [0.04, 0.2], (E, t, st) => { if (rnd(E) > st.rain) return; const o = ambOut(E, t, rnd(E) * 2 - 1, 0.1, 0, 0.5), f = 2500 + rnd(E) * 3500; tone(E, t, o, 'sine', f, f * 0.7, 0.012, 0.02 * st.rain, 0.001); }],
  };
  // the ambience for this moment: set the beds, and schedule whatever happens between now and `until`
  function ambTick(E, st, now, until) {
    bedSet(E, bed(E, 'wind', BEDS.wind), st.out ? (0.1 + st.night * 0.01 + st.rain * 0.05) * (st.paused ? 0.6 : 1) : 0, now);
    const W = E.beds.wind.on; if (W) { W.f.frequency.setTargetAtTime(360 + Math.sin(now * 0.21) * 110 + Math.sin(now * 0.067) * 80 - st.night * 80, now, 1.5); if (W.p.pan) W.p.pan.setTargetAtTime(Math.sin(now * 0.13) * 0.4, now, 2); }
    bedSet(E, bed(E, 'sky', BEDS.sky), st.sky ? 0.05 + Math.min(1, st.speed / 60) * 0.1 : 0, now, 0.4);
    const S = E.beds.sky.on; if (S) { const k = Math.min(1, st.speed / 60); S.lo.frequency.setTargetAtTime(260 + k * 700, now, 0.4); S.hi.frequency.setTargetAtTime(900 + k * 1800, now, 0.4); S.hg.gain.setTargetAtTime(0.12 + k * 0.3, now, 0.4); }
    bedSet(E, bed(E, 'rain', BEDS.rain), st.rain * 0.12, now, 1.2);
    bedSet(E, bed(E, 'hum', BEDS.hum), st.hum * 0.035, now, 0.6);
    bedSet(E, bed(E, 'fire', BEDS.fire), st.keep ? 0.1 : 0, now, 0.6);
    bedSet(E, bed(E, 'cave', BEDS.cave), st.mine ? 0.14 : 0, now, 0.8);
    E.ambEcho.gain.setTargetAtTime(st.mine ? 1 : 0, now, 0.5);
    for (const [name, [when, [lo, hi], fire]] of Object.entries(EVENTS)) {
      const G = E.gen[name] || (E.gen[name] = { next: now + lo + rnd(E) * (hi - lo) });
      if (!when(st)) { G.next = Math.max(G.next, now + lo); continue; }
      while (G.next < until) { if (G.next >= now - 0.05) fire(E, Math.max(G.next, now), st); G.next += lo + rnd(E) * (hi - lo); }
    }
  }
  // an effect, at an optional place in the world: quieter the further it is from what the camera's looking at, and
  // panned to its side of the screen. P: { gain, pan, world }
  function sfx(E, name, t, P = {}) {
    const def = SFX[name]; if (!def) return false;
    const c = E.ctx, g = c.createGain(); g.gain.value = (P.gain ?? 1) * Math.pow(10, (def[2] || 0) / 20);
    const p = P.pan && c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, P.pan)); g.connect(p); p.connect(P.world ? E.world : E.sfx); } else g.connect(P.world ? E.world : E.sfx);
    const r = c.createGain(); r.gain.value = def[1] * (P.far || 1); g.connect(r); r.connect(E.sfxRev);
    def[0](E, t, g);
    if (!E.offline) setTimeout(() => { for (const n of [g, p, r]) if (n) try { n.disconnect(); } catch (x) { } }, (t - c.currentTime + 9) * 1000);   // after the longest (thunder)
    return true;
  }
  const LOOT_TRIM = [-6.5, -6, -6, -5, -5, -3.5, -4.5, -4.5];
  function lootSfx(E, rank, t, P = {}) {
    const c = E.ctx, g = c.createGain(); g.gain.value = (P.gain ?? 1) * Math.pow(10, LOOT_TRIM[rank] / 20); g.connect(E.sfx);
    const r = c.createGain(); r.gain.value = 0.4; g.connect(r); r.connect(E.sfxRev);
    loot(E, t, g, rank);
    if (!E.offline) setTimeout(() => { g.disconnect(); r.disconnect(); }, (t - c.currentTime + 9) * 1000);
  }
  return { engine, INST, SFX, LOOT, sfx, lootSfx, ambTick, activeVoices, f2, n2m, drum };
})();

// ---------------------------------------------------------------- the game's handle on the sound
const AUDIO = (() => {
  // the player's settings: music and effects volumes (0 to 1) and mute. 'bv-sound' is the old on/off switch.
  const S = { music: 0.7, sfx: 0.8, muted: false };
  try {
    S.muted = localStorage.getItem('bv-sound') === 'off';
    const m = localStorage.getItem('bv-music'), f = localStorage.getItem('bv-sfx');
    if (m != null && isFinite(+m)) S.music = Math.max(0, Math.min(1, +m)); if (f != null && isFinite(+f)) S.sfx = Math.max(0, Math.min(1, +f));
  } catch (e) { }
  let ctx = null, E = null, failed = false, timer = null, errs = 0, rainK = 0, ambT = 0;
  const last = {};
  const skyTell = id => { try { if (typeof SKY !== 'undefined' && SKY) SKY.settings.changed(id); } catch (e) { } };
  const curve = v => v * v;   // the sliders feel even: half way is about half as loud
  function applyVol() {
    if (!E) return;
    const t = ctx.currentTime;
    // muted, the sound sleeps altogether (nothing to work out on a phone); unmuted, it picks up where it was
    if (S.muted && ctx.state === 'running') ctx.suspend().catch(() => { });
    else if (!S.muted && ctx.state === 'suspended' && !document.hidden) { ctx.resume().catch(() => { }); MUSIC.wake(); }
    E.master.gain.setTargetAtTime(S.muted ? 0 : 1, t, 0.05);
    E.music.gain.setTargetAtTime(curve(S.music), t, 0.05); E.musicRev.gain.setTargetAtTime(curve(S.music), t, 0.05); E.echoOut.gain.setTargetAtTime(0.6 * curve(S.music), t, 0.05);
    E.sfx.gain.setTargetAtTime(curve(S.sfx), t, 0.05); E.sfxRev.gain.setTargetAtTime(curve(S.sfx), t, 0.05);
    E.amb.gain.setTargetAtTime(curve(S.sfx) * 0.9, t, 0.05); E.ambRev.gain.setTargetAtTime(curve(S.sfx) * 0.9, t, 0.05);
  }
  // the browser only lets sound start from a tap or a key: the first one anywhere starts it
  function start() {
    if (failed) return;
    if (ctx) { if (ctx.state === 'suspended' && !document.hidden && !S.muted) ctx.resume().catch(() => { }); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { failed = true; return; }
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { failed = true; return; } }
    try { E = AU.engine(ctx, { light: QUALITY.level === 'light' }); } catch (e) { console.warn('sound could not start', e); failed = true; ctx = null; return; }
    applyVol();
    MUSIC.attach(E);
    timer = setInterval(pump, 30);
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => { }); else if (!S.muted) { ctx.resume().catch(() => { }); MUSIC.wake(); } });
    if (ctx.state === 'suspended' && !S.muted) ctx.resume().catch(() => { });
  }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, start, { capture: true, passive: true });
  function pump() {
    if (!E || ctx.state !== 'running') return;
    E.light = QUALITY.level === 'light';
    try { MUSIC.pump(ctx.currentTime + (E.light ? 0.3 : 0.18)); } catch (e) { if (errs++ < 3) console.warn('music', e); }
  }
  // where the listener is: the camera that's drawing, and what it's looking at
  function listener() {
    if (typeof SKY !== 'undefined' && SKY && SKY.on) return SKY.camera ? { cam: SKY.camera, focus: SKY.player ? SKY.player.pos : null, ref: 120 } : null;
    if (typeof VIEW !== 'undefined' && VIEW.mode === 'keep') return { cam: kcam, focus: KCAM.at, ref: 25, inside: true };
    return typeof camera !== 'undefined' ? { cam: camera, focus: controls.target, ref: 40 } : null;
  }
  const _v = { x: 0, y: 0, z: 0 };
  function placeOf(pos, o) {
    const Ls = listener(); if (!Ls || !pos) return { world: !!pos };
    const c = Ls.cam.position, fd = Ls.focus ? Math.hypot(Ls.focus.x - c.x, Ls.focus.y - c.y, Ls.focus.z - c.z) : Ls.ref;
    const dx = pos.x - c.x, dy = pos.y - c.y, dz = pos.z - c.z, d = Math.hypot(dx, dy, dz);
    const ref = Math.max(o.ref || Ls.ref, fd * 1.1);
    const gain = Math.max(0.08, Math.min(1, Math.pow(ref / Math.max(ref, d), 1.3)));
    // pan: how far right of the camera it is
    const e = Ls.cam.matrixWorld.elements, rx = e[0], ry = e[1], rz = e[2], rl = Math.hypot(rx, ry, rz) || 1;
    const pan = d > 0.01 ? ((dx * rx + dy * ry + dz * rz) / rl / d) * 0.7 : 0;
    return { gain, pan, world: true, far: 1 + (1 - gain) * 0.8 };
  }
  // effects that are also music: these start a cue in the score as well as (or instead of) a sound
  const CUES = { dawn: 'dawn', chapter: 'flourish', raidwon: 'victory', sunk: 'lament' };
  // other names an effect might be asked for by
  const ALIAS = { pick: 'dig', mine: 'dig', lightning: 'thunder', boom: 'cannon', explosion: 'raiderdown', wave: 'alarm', boltstrike: 'thunder', nightstart: 'bell', courier: 'horn', rocks: 'rockfall', ballista: 'thunk', lens: 'zap', death: 'poof',
    anvil: 'hit', forge: 'flare', success: 'goal', fail: 'snuff' };   // Odile’s bench (bench.js)
  function play(k, pos, o = {}) {
    if (!E || S.muted) return;
    k = ALIAS[k] || k;
    const now = performance.now(); if (last[k] && now - last[k] < (o.gap ?? 70)) return; last[k] = now;
    try {
      if (CUES[k]) MUSIC.cue(CUES[k]);
      if (k === 'chapter' || k === 'dawn' || k === 'raidwon') { if (k !== 'dawn') AU.sfx(E, 'bell', ctx.currentTime + 0.02, { gain: 0.5 }); return; }
      const P = placeOf(pos, o); if (o.vol) P.gain = (P.gain ?? 1) * o.vol;
      AU.sfx(E, k, ctx.currentTime + 0.01, P);
    } catch (e) { if (errs++ < 3) console.warn('sound', k, e); }
  }
  // loot: a burst of finds (a crate opening) plays one sound, for the grandest of them
  let lootQ = null;
  function loot(rarity) {
    if (!E || S.muted) return;
    const rank = Math.max(0, AU.LOOT.indexOf(rarity));
    if (lootQ) { lootQ.rank = Math.max(lootQ.rank, rank); return; }
    lootQ = { rank };
    setTimeout(() => { const q = lootQ; lootQ = null; try { AU.lootSfx(E, q.rank, ctx.currentTime + 0.01); } catch (e) { } }, 140);
  }
  // what the ambience hears this frame
  const lampsOut = { n: -1 }, wallHp = { sum: -1, t: 0 };
  function state() {
    const sky = typeof SKY !== 'undefined' && SKY && SKY.on, mode = typeof VIEW !== 'undefined' ? VIEW.mode : 'town';
    const st = { sky, out: !sky && mode === 'town', mine: !sky && mode === 'mine', keep: !sky && mode === 'keep', day: 0, night: 0, rain: rainK, hum: 0, builders: false, buildPan: 0, miners: false, speed: 0, paused: false };
    // (in the skies the claim's ambience falls quiet: the skies have their own wind, rain and creaks, src/sky/sound.js)
    if (sky) { st.sky = false; st.rain = 0; return st; }
    st.night = TOD.night; st.day = 1 - TOD.night; st.paused = !!GAME.paused;
    const b = BUILDINGS.find(x => x.building); st.builders = !!b;
    if (b && b.group) { const P = placeOf(b.group.position, {}); st.buildPan = P.pan || 0; }
    st.miners = GAME.villagers.some(v => v.where === 'mine' && !v.hidden);
    // the Wildlight's hum: louder the more of them there are near what you're looking at
    if (st.out && WL.list.length) {
      const f = controls.target; let near = 1e9, n = 0;
      for (const w of WL.list) { if (w.dead || w.air) continue; n++; const d = Math.hypot(w.pos.x - f.x, w.pos.z - f.z); if (d < near) near = d; }
      st.hum = n ? Math.max(0, 1 - near / 45) * Math.min(1, 0.4 + n * 0.15) : 0;
    }
    return st;
  }
  // things the claim does that make a sound without calling for one: lamps going out, the wall being chewed
  function watch() {
    if (typeof DECOR !== 'undefined' && DECOR.lamps) {
      let n = 0, which = null; for (const L of DECOR.lamps) if (!L.lit) { n++; which = L; }
      if (lampsOut.n >= 0 && n > lampsOut.n && which) play('snuff', { x: which.x, y: 2.5, z: which.z });
      lampsOut.n = n;
    }
    if (typeof WALL !== 'undefined' && WALL.segs) {
      let sum = 0, hit = null; for (const s of WALL.segs) { sum += s.hp || 0; if (s.hp < 1 && !s.broken) hit = s; }
      if (wallHp.sum >= 0 && sum < wallHp.sum - 0.0005 && performance.now() - wallHp.t > 550) { wallHp.t = performance.now(); play('wallhit', hit && hit.mx != null ? { x: hit.mx, y: 1, z: hit.mz } : null, { gap: 500 }); }
      wallHp.sum = sum;
    }
  }
  return {
    start,
    play, loot,
    // the weather: rain from 0 to 1 (the weather calls this as it changes)
    rain(k) { rainK = Math.max(0, Math.min(1, +k || 0)); },
    // called every frame by the claim (and while the skies are open): the ambience, and a nudge to the music
    ambience() {
      if (!E || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (now - ambT < 0.1) return; ambT = now;
      try {
        const st = state(); watch();
        E.world.frequency.setTargetAtTime(st.keep ? 900 : 18000, now, 0.2);
        AU.ambTick(E, st, now, now + 0.25);
        pump();
      } catch (e) { if (errs++ < 3) console.warn('ambience', e); }
    },
    get on() { return !S.muted; },
    // (the Sound switch and the two sliders govern the skies' sound too: told to them as it changes, src/sky/settings.js)
    set(v) { S.muted = !v; try { localStorage.setItem('bv-sound', v ? 'on' : 'off'); } catch (e) { } applyVol(); skyTell('sound'); },
    get vols() { return { music: S.music, sfx: S.sfx, muted: S.muted }; },
    vol(which, v) { S[which] = Math.max(0, Math.min(1, +v)); try { localStorage.setItem(which === 'music' ? 'bv-music' : 'bv-sfx', S[which].toFixed(2)); } catch (e) { } applyVol(); skyTell(which === 'music' ? 'music' : 'effects'); },
    // the claim's audio context, once the first touch has made it: the skies make their sound in it too
    get ctx() { return ctx; },
    get ready() { return !!E && ctx.state === 'running'; },
    get missing() { return failed; },
    // for tests and the music box: what's playing, and how many voices are sounding
    status() { return E ? { ...MUSIC.status(), voices: AU.activeVoices(E, ctx.currentTime), voicesMax: E.voicesMax, dropped: E.dropped, beds: Object.values(E.beds).filter(b => b.on).map(b => b.name), persist: E.persist, state: ctx.state } : { state: failed ? 'missing' : 'off' }; },
    names: () => Object.keys(AU.SFX).concat(Object.keys(CUES)),
    // Render a stretch of sound offline, with the same code, and measure it (for tests). opts: theme, i (intensity),
    // seconds, sfx [[name, at]], loot [[rarity, at]], amb (an ambience state), light, wav (return a WAV as base64)
    async render(opts = {}) {
      const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) return null;
      const sr = opts.sr || 44100, secs = opts.seconds || 24, c = new OC(2, Math.ceil(sr * secs), sr);
      const e = AU.engine(c, { light: !!opts.light, offline: true, rng: mulberry(opts.seed || 7) });
      e.music.gain.value = curve(0.7); e.musicRev.gain.value = curve(0.7); e.sfx.gain.value = curve(0.8); e.sfxRev.gain.value = curve(0.8); e.amb.gain.value = e.ambRev.gain.value = curve(0.8) * 0.9;
      e.echoOut.gain.value = 0.6 * curve(0.7);
      const t0 = performance.now();
      if (opts.theme || opts.plan) MUSIC.render(e, opts.theme, opts.i || 0, secs, opts.only, opts.plan);
      for (const [name, at] of opts.sfx || []) AU.sfx(e, name, at, {});
      for (const [r, at] of opts.loot || []) AU.lootSfx(e, Math.max(0, AU.LOOT.indexOf(r)), at);
      for (const [inst, m, at, dur] of opts.notes || []) AU.INST[inst](e, at, m, dur, 0.8, e.duck, {});
      if (opts.amb) for (let t = 0; t < secs; t += 0.25) AU.ambTick(e, { day: 0, night: 0, rain: 0, hum: 0, speed: 0, ...opts.amb }, t, t + 0.25);
      const made = performance.now() - t0, buf = await c.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
      let peak = 0, sum = 0, nan = 0, quietSecs = 0, secSum = 0, secN = 0;
      const perSec = [], tenths = []; let tSum = 0, tN = 0;
      for (let i = 0; i < n; i++) {
        const a = L[i], b = R[i]; if (a !== a || b !== b) { nan++; continue; }
        const m = Math.max(Math.abs(a), Math.abs(b)); if (m > peak) peak = m;
        sum += a * a + b * b; secSum += a * a + b * b; secN++; tSum += a * a + b * b; tN++;
        if (tN >= sr / 10) { tenths.push(Math.sqrt(tSum / (2 * tN))); tSum = 0; tN = 0; }
        if (secN >= sr) { const r = Math.sqrt(secSum / (2 * secN)); perSec.push(r); if (r < 0.001) quietSecs++; secSum = 0; secN = 0; }
      }
      const rms = Math.sqrt(sum / (2 * n)), db = x => x > 0 ? 20 * Math.log10(x) : -999;
      const out = { peak: +peak.toFixed(4), peakDb: +db(peak).toFixed(1), rmsDb: +db(rms).toFixed(1), nan, quietSecs, seconds: secs, voicesMax: e.voicesMax, dropped: e.dropped, makeMs: Math.round(made), loudestSecDb: +db(Math.max(...perSec, 0)).toFixed(1) };
      if (opts.tenths) out.tenths = tenths.map(x => +(x > 0 ? 20 * Math.log10(x) : -120).toFixed(1));
      if (opts.wav) out.wav = wavB64(buf, opts.wavSeconds || secs);
      return out;
    },
  };
  // 16-bit stereo WAV, as base64
  function wavB64(buf, secs) {
    const sr = buf.sampleRate, n = Math.min(buf.length, Math.floor(sr * secs)), L = buf.getChannelData(0), R = buf.getChannelData(1);
    const bytes = new Uint8Array(44 + n * 4), dv = new DataView(bytes.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
})();
