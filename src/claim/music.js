// ===================================================================== MUSIC: the score, played to the game
// A lane plays one theme of the score (score.js) at a time, bar by bar. Notes are worked out a bar at a time and
// started a moment before they sound, on the audio clock (a timer looks ahead every 30 ms: the "two clocks" way, so
// the music keeps time even when frames stutter). Which theme plays, and how loud each of its layers is, follows the
// game: day, dusk, the night watch (fuller the more Wildlight are on the plateau), the skies (with a battle layer in
// a fight), the Baron's jumpers, story scenes, the festival night, the Keep and the mine.
// Changes wait for a bar line, so nothing cuts off: the old theme's layers fade as the new one's come in. Urgent ones
// (a scene opening, the jumpers, setting sail) come in on the next beat instead. Cues (dawn) play through once and
// hand back; short flourishes (a chapter done, a raid won, a ship lost) play over the top while the rest dips.
const MUSIC = (() => {
  let E = null, main = null, overlays = [], cue = null, boxPick = null;
  // ---------------------------------------------------------------- a lane: one theme after another
  const lane = (E, dest, want, onFinish) => ({ E, dest, want, onFinish, cur: null, q: [], next: null, resume: {} });
  function startInst(L, id, T, w) {
    const E = L.E, c = E.ctx, th = ARR.compile(id);
    const at = th.once || w.fromTop ? 0 : (L.resume[id] || 0) % th.form.length;
    const I = { id, th, beat: 60 / th.bpm, tick: 60 / th.bpm / th.tpb, beatIn: 0, formIdx: at, bar: 0, first: true, finished: false, layers: {}, nodes: [], lastVar: {}, rng: E.rng, i: w.i || 0,
      P: { sec: th.form[at].s, bar: 0, vars: {}, voice: {}, carry: {}, mixNow: {}, mixWas: {}, nextChord: null } };
    for (const [n, Ld] of Object.entries(th.layers)) {
      const g = c.createGain(); g.gain.value = 0;
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      let tail = g; if (pan) { pan.pan.value = Ld.pan || 0; g.connect(pan); tail = pan; }
      tail.connect(L.dest); I.nodes.push(g); if (pan) I.nodes.push(pan);
      if (Ld.rev) { const s = c.createGain(); s.gain.value = Ld.rev; tail.connect(s); s.connect(E.musicRev); I.nodes.push(s); }
      if (Ld.echo) { const s = c.createGain(); s.gain.value = Ld.echo; tail.connect(s); s.connect(E.echoIn); I.nodes.push(s); }
      I.layers[n] = { g, L: Ld, vol: Ld.vol * (th.level || 1) };
    }
    E.persist += I.nodes.length;
    if (L.dest === E.duck && th.echo) E.echo.delayTime.setValueAtTime(th.echo, T);   // the mine's echo, timed to its tempo
    return I;
  }
  function stopInst(L, I, T) {
    L.resume[I.id] = I.formIdx + (I.bar > 0 ? 1 : 0);
    L.q = L.q.filter(x => x.I !== I || x.at < T);                    // its notes still to come are dropped
    for (const Lr of Object.values(I.layers)) { Lr.g.gain.cancelScheduledValues(T); Lr.g.gain.setTargetAtTime(0, T, 0.3); }
    const E = L.E; if (E.offline) return;
    setTimeout(() => { for (const n of I.nodes) try { n.disconnect(); } catch (e) { } E.persist -= I.nodes.length; }, (T - E.ctx.currentTime + 4) * 1000);
  }
  // one bar: pick the written variations at the top of a section, set each layer's level at the bar line, make the notes
  function genBar(L, I, T, i) {
    const th = I.th, F = th.form[I.formIdx], S = th.sections[F.s];
    if (I.bar === 0) for (const [k, vars] of Object.entries(S.lines)) { const v = ARR.pickVar(vars.length, F, i, I.rng, I.lastVar[k]); I.P.vars[k] = v; I.lastVar[k] = v; }
    I.P.sec = F.s; I.P.bar = I.bar;
    const nf = I.bar + 1 < S.n ? null : th.form[(I.formIdx + 1) % th.form.length];
    I.P.nextChord = (nf ? th.sections[nf.s].chords[0][0] : S.chords[I.bar + 1][0]).ch;
    const mix = th.mix(i), fm = F.mix || {}, barDur = I.beat * th.beats;
    for (const [n, Lr] of Object.entries(I.layers)) {
      const k = I.only ? (n === I.only ? 1 : 0) : (mix[n] ?? 0) * (fm[n] ?? 1), v = k * Lr.vol;
      I.P.mixWas[n] = I.P.mixNow[n] ?? 0; I.P.mixNow[n] = k;
      if (I.first) { Lr.g.gain.setValueAtTime(th.once ? v : v * 0.4, T); Lr.g.gain.setTargetAtTime(v, T, barDur * 0.2); }
      else Lr.g.gain.setTargetAtTime(v, T, Math.min(0.6, barDur * 0.15));
    }
    I.first = false; I.i = i;
    for (const e of ARR.bar(th, I.P, I.rng)) {
      const Ld = th.layers[e.layer], hum = e.d ? 0.004 : Ld.kind === 'line' ? 0.009 : 0.005;
      L.q.push({ at: T + e.t * I.tick + (I.rng() - 0.5) * 2 * hum, e, I, vel: Math.max(0.1, Math.min(1.1, e.vel * (0.92 + I.rng() * 0.16))) });
    }
    L.q.sort((a, b) => a.at - b.at);
    if (++I.bar >= S.n) { I.bar = 0; if (++I.formIdx >= th.form.length) { I.formIdx = 0; if (th.once) I.finished = true; } }
  }
  function playEv(E, x) {
    const { e, I } = x, Lr = I.layers[e.layer]; if (!Lr) return;
    const Ld = Lr.L, out = Lr.g, at = Math.max(x.at, E.ctx.currentTime), dur = e.len * I.tick, v = x.vel;
    if (e.d) return AU.drum(E, at, e.d, v, out);
    if (e.pad) return AU.INST[Ld.inst](E, at, e.ms, dur, v, out, { cutoff: e.cut0 || Ld.cutoff });
    if (e.chord) {   // a strum (rolled across the strings) or a stab
      let ms = e.roll < 0 ? e.ms.slice().reverse() : e.ms; if (E.light && ms.length > 3) ms = ms.slice(0, 3);
      const step = Ld.kind === 'stab' ? 0.006 : 0.016;
      ms.forEach((m, j) => AU.INST[Ld.inst](E, at + j * step, m, dur, v * (1 - j * 0.05), out, {}));
      return;
    }
    // the whistle's ornaments: written ones, and now and then one of its own on a longer note
    const o = {};
    if (e.cut) o.cut = true; else if (e.glide) o.glide = true;
    else if (Ld.orn && dur > 0.28 && I.rng() < Ld.orn) { const r = I.rng(); if (r < 0.55) o.cut = true; else if (r < 0.85 && dur > 0.5) o.roll = true; else o.glide = true; }
    AU.INST[Ld.inst](E, at, e.m, dur, v, out, o);
  }
  // schedule everything up to `until`, a beat at a time: decide at each beat whether to change theme
  function pumpLane(L, until) {
    const E = L.E, now = E.ctx.currentTime;
    if (L.next == null || L.next < now - 0.5) { L.next = now + 0.06; L.q = L.q.filter(x => x.at >= now); }   // the first time, or after the tab slept
    let guard = 0;
    while (L.next < until && guard++ < 8192) {
      const T = L.next, I = L.cur, atBar = !I || I.beatIn === 0;
      if (I && I.finished && atBar) { stopInst(L, I, T); L.cur = null; if (L.onFinish) L.onFinish(I.id); continue; }   // a cue has played through
      const w = L.want(T, I);
      if (!w || !w.theme) { if (I) { stopInst(L, I, T); L.cur = null; } L.next = T + 0.25; continue; }
      if (!I || (w.theme !== I.id && (atBar || w.urgent))) { if (I) stopInst(L, I, T); L.cur = startInst(L, w.theme, T, w); L.cur.only = w.only || null; }
      const C = L.cur;
      if (C.beatIn === 0) genBar(L, C, T, w.i || 0);
      C.beatIn = (C.beatIn + 1) % C.th.beats;
      L.next = T + C.beat;
    }
    while (L.q.length && L.q[0].at < until) { const x = L.q.shift(); try { playEv(E, x); } catch (e) { if (!pumpLane.warned) { pumpLane.warned = true; console.warn('note', e); } } }
  }

  // ---------------------------------------------------------------- what the game wants to hear
  let sceneRef = null, sceneLetter = false, pend = null, pendSince = 0, took = null, lvl = 0, lvlLowSince = 0, lastPhase = null, dawnAt = -1e9;
  function gameWant() {
    if (typeof SKY !== 'undefined' && SKY && SKY.on) {
      const W = SKY.waves, P = SKY.player, sailing = SKY.mode === 'voyage' && !(P && P.down) && !(W && W.sunk);
      const fight = sailing && !SKY.paused && W && W.state === 'fight';
      return { theme: 'skies', i: fight ? 2 : sailing && !SKY.paused ? 1 : 0, urgent: true };
    }
    if (!started || !$('#intro').hidden || (BUILD.on && !BUILD.setupDone)) return { theme: 'title', i: 0 };
    if (STORY.shown) {
      // once the Baron's letter is read out, his music stays for the rest of the scene
      if (sceneRef !== STORY.shown) { sceneRef = STORY.shown; sceneLetter = false; }
      const k = TALK.lines && TALK.lines[TALK.i] && TALK.lines[TALK.i][0];
      if (k && WHO[k] && WHO[k].letter) sceneLetter = true;
      return { theme: sceneLetter ? 'letter' : 'scene', i: 0, urgent: true };
    }
    if (typeof jumpersActive === 'function' && jumpersActive()) return { theme: 'tallow', i: 0, urgent: true };
    const ph = TOD.phase;
    if (lastPhase === 'night' && ph === 'dawn') playCue('dawn');   // the sun's up (endNight asks for it too; it plays once)
    lastPhase = ph;
    if (ph === 'night' || (ph === 'dusk' && TOD.night > 0.55)) {
      if (STORY.ch === 6 && STORY.started) return { theme: 'faire', i: 0 };   // the Moon Faire's festival night
      let n = 0; for (const f of WL.list) if (!f.dead && !f.air) n++;
      const broken = n > 0 && WALL.segs && WALL.segs.some(s => s.broken);
      return { theme: 'night', i: Math.min(3, (n === 0 ? 0 : n < 4 ? 1 : n < 8 ? 2 : 3) + (broken ? 1 : 0)), smooth: true };
    }
    if (VIEW.mode === 'mine') return { theme: 'mine', i: 0 };
    if (VIEW.mode === 'keep') return { theme: 'keep', i: 0 };
    if (ph === 'dusk') return { theme: 'dusk', i: 0 };
    return { theme: 'day', i: 0 };
  }
  function decide() {
    if (boxPick) { if ($('#menu').hidden) { boxPick = null; boxSync(); } else return { theme: boxPick.id, i: boxPick.i, urgent: true, fromTop: true }; }
    if (cue) return { theme: cue, i: 0, urgent: true };
    const w = gameWant(), now = performance.now();
    // a new wish has to hold for a moment before the music follows it (a quick look at the mine doesn't change the tune)
    if (!pend || pend.theme !== w.theme) { pend = w; pendSince = now; }
    if (!took || w.urgent || took.theme === w.theme || now - pendSince > 900) took = w;
    // the night's intensity rises at once and falls only once it's been quieter for a few seconds
    if (took.smooth) {
      if (w.theme === took.theme && w.i > lvl) { lvl = w.i; lvlLowSince = 0; }
      else if (w.theme === took.theme && w.i < lvl) { if (!lvlLowSince) lvlLowSince = now; else if (now - lvlLowSince > 5000) { lvl--; lvlLowSince = now; } }
      else lvlLowSince = 0;
      return { ...took, i: lvl };
    }
    lvl = 0;
    return took;
  }

  // ---------------------------------------------------------------- cues and flourishes
  function playCue(id) {
    if (!E || !SCORE[id]) return;
    if (id === 'dawn') { if (performance.now() - dawnAt < 30000) return; dawnAt = performance.now(); }
    if (!SCORE[id].overlay) { cue = id; return; }
    if (overlays.some(o => o.id === id && !o.done)) return;
    // over the top, on the next beat of whatever's playing, with the rest dipped under it
    const now = E.ctx.currentTime + 0.05; let at = now;
    if (main && main.cur && main.next != null) { at = main.next; while (at < now) at += main.cur.beat; }
    const O = lane(E, E.music, () => (O.done ? null : { theme: id, i: 0 }), () => { O.done = true; });
    O.id = id; O.next = at; overlays.push(O);
    const th = ARR.compile(id), len = th.form.reduce((s, f) => s + th.sections[f.s].n, 0) * th.beats * 60 / th.bpm;
    E.duck.gain.cancelScheduledValues(at - 0.06); E.duck.gain.setTargetAtTime(0.28, at - 0.06, 0.1); E.duck.gain.setTargetAtTime(1, at + len, 0.9);
  }

  // ---------------------------------------------------------------- the music box, in the settings
  function boxSync() {
    for (const b of document.querySelectorAll('#mb-list .mb-play')) b.setAttribute('aria-pressed', !!boxPick && boxPick.k === +b.dataset.k);
  }
  function boxBuild() {
    const ul = $('#mb-list'); if (!ul || ul.childElementCount) return;
    SCORE_BOX.forEach(([id, i, label, blurb], k) => {
      const th = SCORE[id], li = document.createElement('li'), name = label || th.name;
      li.innerHTML = '<button type="button" class="mb-play" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path class="ip" d="M5 3v10l8-5z"/><path class="is" d="M4 4h8v8H4z"/></svg></button><span class="mb-t"><b></b><em></em></span>';
      const b = li.querySelector('button'); b.dataset.k = k; b.setAttribute('aria-label', 'Play ' + name);
      li.querySelector('b').textContent = name; li.querySelector('em').textContent = blurb || th.blurb;
      b.onclick = () => { AUDIO.start(); boxPick = boxPick && boxPick.k === k ? null : { id, i, k }; boxSync(); };
      ul.append(li);
    });
  }
  function soundSync() {
    const v = AUDIO.vols, m = $('#vol-music'), f = $('#vol-sfx');
    if (m) m.value = Math.round(v.music * 100); if (f) f.value = Math.round(v.sfx * 100);
    const note = $('#sound-note'); if (note) note.hidden = !AUDIO.missing;
    boxBuild(); boxSync();
  }
  if ($('#vol-music')) {
    $('#vol-music').addEventListener('input', e => { AUDIO.start(); AUDIO.vol('music', e.target.value / 100); });
    let tapT = 0;
    $('#vol-sfx').addEventListener('input', e => { AUDIO.start(); AUDIO.vol('sfx', e.target.value / 100); if (performance.now() - tapT > 180) { tapT = performance.now(); AUDIO.play('chime'); } });
    $('#b-menu').addEventListener('click', soundSync);
    $('#menu-close').addEventListener('click', () => { boxPick = null; boxSync(); });
  }

  return {
    attach(engine) { E = engine; main = lane(E, E.duck, decide, id => { if (cue === id) cue = null; }); },
    pump(until) {
      if (!main) return;
      pumpLane(main, until);
      for (const O of overlays) pumpLane(O, until);
      overlays = overlays.filter(O => !(O.done && !O.cur && !O.q.length));
    },
    wake() { if (main) main.next = null; for (const O of overlays) O.next = null; },
    cue: playCue,
    box(id, i = 0) { boxPick = id ? { id, i, k: SCORE_BOX.findIndex(x => x[0] === id && x[1] === i) } : null; boxSync(); },
    want: gameWant,
    status() { const c = main && main.cur; return { theme: c ? c.id : null, i: c ? c.i : 0, section: c ? c.th.form[c.formIdx].s : null, bar: c ? c.bar : 0, cue, box: boxPick && boxPick.id, overlays: overlays.map(o => o.id), queued: main ? main.q.length : 0 }; },
    // offline, for tests: a whole stretch of one theme scheduled at once
    render(e, id, i, secs, only, plan) {
      // a cue in the plan (dawn) plays once, then the plan moves on to what comes after it, as the game would
      const used = new Set();
      const pick = T => { let k = -1; plan.forEach((p, j) => { if (T >= p[0]) k = j; }); if (k < 0) return null; while (used.has(k) && k < plan.length - 1) k++; const [, th, n, urgent] = plan[k]; return { theme: th, i: n || 0, urgent: !!urgent }; };
      const L = lane(e, e.duck, T => (plan ? pick(T) : L.done ? null : { theme: id, i, only, fromTop: true }), done => { L.done = true; if (plan) plan.forEach((p, j) => { if (p[1] === done) used.add(j); }); });
      L.next = 0.05; pumpLane(L, secs);
    },
  };
})();
window.BV_AUDIO = { AUDIO, MUSIC, AU, ARR, SCORE };
