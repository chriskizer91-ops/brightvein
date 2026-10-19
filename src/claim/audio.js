// ===================================================================== AUDIO: small synthesised sounds
const AUDIO = (() => {
  let ctx = null, master = null, on = true, wind = null, windGain = null, last = {};
  try { on = localStorage.getItem('bv-sound') !== 'off'; } catch (e) { }
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = on ? 0.7 : 0; master.connect(ctx.destination);
    // wind: looping filtered noise
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let v = 0; for (let i = 0; i < len; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.06; d[i] = v; }
    wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0.0;
    wind.connect(f); f.connect(windGain); windGain.connect(master); wind.start();
    AUDIO.windFilter = f;
  }
  const env = (g, t, a, peak, dcy) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); };
  function tone(type, f0, f1, dur, peak = 0.2, a = 0.005, when = 0) {
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + a + dur + 0.05);
  }
  function noise(dur, fq, peak = 0.2, when = 0, type = 'lowpass') {
    const t = ctx.currentTime + when, n = ctx.sampleRate * dur, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = fq; const g = ctx.createGain();
    env(g, t, 0.004, peak, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const SFX = {
    tap: () => tone('triangle', 900, 620, 0.06, 0.06),
    open: () => { tone('sine', 520, 0, 0.12, 0.07); tone('sine', 780, 0, 0.14, 0.05, 0.005, 0.05); },
    build: () => { for (let i = 0; i < 4; i++) { noise(0.09, 600, 0.16, i * 0.16); tone('sine', 140 - i * 6, 90, 0.12, 0.14, 0.002, i * 0.16); } },
    zap: () => { tone('sawtooth', 1900, 240, 0.32, 0.07); tone('sine', 2600, 1700, 0.25, 0.04); },
    flare: () => { tone('square', 700, 1400, 0.18, 0.03); noise(0.25, 2400, 0.05, 0, 'highpass'); },
    poof: () => { for (let i = 0; i < 5; i++) tone('sine', 1400 + Math.random() * 1600, 0, 0.35, 0.03, 0.002, i * 0.035); },
    chime: () => { tone('sine', 1318, 0, 0.6, 0.06); tone('sine', 1976, 0, 0.8, 0.04, 0.005, 0.07); },
    bell: () => { for (const [f, p] of [[392, 0.12], [784, 0.05], [1175, 0.03], [523, 0.04]]) tone('sine', f, 0, 2.4, p, 0.004); },
    dawn: () => { [523, 659, 784, 1046].forEach((f, i) => tone('sine', f, 0, 1.4, 0.05, 0.02, i * 0.18)); },
    hit: () => { noise(0.12, 900, 0.12); tone('triangle', 300, 120, 0.12, 0.06); },
    crack: () => { noise(0.6, 380, 0.3); tone('sine', 70, 40, 0.8, 0.25); },
    thunk: () => { noise(0.07, 500, 0.18); tone('triangle', 190, 60, 0.16, 0.13); },
    place: () => { noise(0.06, 300, 0.14); tone('sine', 120, 80, 0.12, 0.12); },
    lift: () => tone('sine', 420, 560, 0.08, 0.05),
  };
  return {
    start,
    play(k) { if (!ctx || !on || !SFX[k]) return; const now = performance.now(); if (last[k] && now - last[k] < 70) return; last[k] = now; try { SFX[k](); } catch (e) { } },
    get on() { return on; },
    set(v) { on = v; try { localStorage.setItem('bv-sound', v ? 'on' : 'off'); } catch (e) { } if (master) master.gain.setTargetAtTime(v ? 0.7 : 0, ctx.currentTime, 0.05); },
    ambience(nightK, speed) { if (!ctx || !windGain) return; windGain.gain.setTargetAtTime((0.05 + nightK * 0.05) * (speed ? 1 : 0.4), ctx.currentTime, 0.5); AUDIO.windFilter.frequency.setTargetAtTime(380 + Math.sin(performance.now() / 4000) * 120, ctx.currentTime, 0.5); },
  };
})();
