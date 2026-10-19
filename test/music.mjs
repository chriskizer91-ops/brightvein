// music.mjs: checks the score as written (src/claim/score.js), without a browser. Must end with "all good".
//   node test/music.mjs           every bar adds up, the tunes sit on their chords, every note is in its instrument's range
//   node test/music.mjs --show    also prints each theme's sections and form
// The harmony rule is the folk-tune one: on the strong beats (1 and 3 in 4/4, 1 in 3/4, both beats of 6/8) the tune
// sits on a note of the chord, unless it's a short passing note between two steps. On the other beats it's a chord
// note, or a passing or neighbour note (reached and left by a step), or a note held over from before. Off the beat
// anything goes.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const src = fs.readFileSync(path.join(ROOT, 'src/claim/score.js'), 'utf8');
const { SCORE, SCORE_BOX, ARR } = new Function(src + '\nreturn { SCORE, SCORE_BOX, ARR };')();
const show = process.argv.includes('--show');
const RANGE = { whistle: [62, 98], flute: [55, 91], box: [64, 100], harp: [36, 93], pizz: [28, 60], pluck: [40, 88], brass: [34, 72], bell: [43, 84], bowed: [28, 72], spicc: [28, 72] };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const problems = [];
let notes = 0, bars = 0;
for (const id of Object.keys(SCORE)) {
  const th = ARR.compile(id);
  problems.push(...th.problems);
  const strongEvery = th.beats === 4 ? 2 : th.beats === 2 ? 1 : th.beats;   // beats between strong beats
  for (const S of Object.values(th.sections)) {
    bars += S.n;
    for (const [key, vars] of Object.entries(S.lines)) {
      const layer = Object.entries(th.layers).find(([n, L]) => L.kind === 'line' && (L.src || n) === key);
      const inst = layer ? layer[1].inst : null, oct = layer ? layer[1].oct || 0 : 0;
      vars.forEach((vb, vi) => {
        const flat = vb.flatMap((b, bi) => b.map(e => ({ ...e, bar: bi })));
        flat.forEach((e, i) => {
          notes++;
          const m = e.m + 12 * oct, where = `${id} ${S.name} ${key}${vi ? ' v' + vi : ''} bar ${e.bar + 1} tick ${e.t} ${nm(e.m)}`;
          if (inst && RANGE[inst] && (m < RANGE[inst][0] || m > RANGE[inst][1])) problems.push(`${where}: out of the ${inst}'s range`);
          if (e.t % th.tpb) return;                                  // off the beat: free
          const beat = e.t / th.tpb, strong = beat % strongEvery === 0;
          const ch = ARR.chordAt(S, e.bar, e.t).ch;
          if (ch.pcs.includes(e.m % 12)) return;
          const prev = flat[i - 1], next = flat[i + 1];
          const stepIn = prev && prev.bar >= e.bar - 1 && Math.abs(prev.m - e.m) <= 2 && prev.t + prev.len + (prev.bar - e.bar) * th.barLen >= e.t - 0.001;
          const stepOut = next && Math.abs(next.m - e.m) <= 2;
          if (strong ? (e.len <= 1 && stepIn && stepOut) : (stepIn && stepOut)) return;
          problems.push(`${where}: not in ${ch.sym}${strong ? ' on a strong beat' : ''}`);
        });
      });
    }
    if (show) console.log(`${id}/${S.name}: ${S.chords.map(b => b.map(c => c.ch.sym).join(' ')).join(' | ')}`);
  }
  // every layer has an instrument the engine knows, and the form names real sections
  for (const f of th.form) if (!th.sections[f.s]) problems.push(`${id}: the form names a section "${f.s}" that isn't there`);
  for (const [n, L] of Object.entries(th.layers)) if (L.kind !== 'drum' && !RANGE[L.inst] && !['pad', 'strings', 'trem'].includes(L.inst)) problems.push(`${id} ${n}: unknown instrument ${L.inst}`);
  // and the arranger makes notes for every bar without falling over
  const P = { sec: th.form[0].s, bar: 0, vars: {}, voice: {}, carry: {}, mixNow: th.mix(2), mixWas: {}, nextChord: null };
  let rng = 1; const R = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
  for (const f of th.form) { P.sec = f.s; for (let b = 0; b < th.sections[f.s].n; b++) { P.bar = b; ARR.bar(th, P, R); } }
}
for (const [id] of SCORE_BOX) if (!SCORE[id]) problems.push(`the music box lists "${id}", which isn't a theme`);
console.log(`${Object.keys(SCORE).length} themes, ${bars} bars, ${notes} written notes`);
for (const p of problems) console.log('  - ' + p);
console.log(problems.length ? `${problems.length} problem(s)` : 'all good');
process.exit(problems.length ? 1 : 0);
