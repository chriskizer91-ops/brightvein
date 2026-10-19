// ===================================================================== SCORE: Brightvein's music, written out as notes
// Every theme is composed here as note data; music.js plays it through the instruments in audio.js.
//
// THE MOTIF. Everything grows from one figure, "sol do re-mi sol" then "fa mi re do": a rising fourth that climbs on
// to the fifth, then steps back down. In D on the title: A4 D5 E5 F#5 A5 | G5 F#5 E5 D5. It comes back changed:
// lilting in G by day, in E minor and broken up at night, in C minor against the Baron's brass, augmented (slowed to
// half speed) in the skies, as a jig for the Moon Faire, as a waltz in the Keep, and low and echoing in the mine.
//
// HOW IT'S WRITTEN. A theme has a tempo (bpm), beats to the bar and ticks to the beat (tpb: 2 = eighth notes in 4/4,
// 3 = eighths in 6/8), a key, layers (each an instrument with a volume, reverb and pan), sections of 8 bars and a form
// (the order the sections play in). Inside a section:
//   chords  'G | C:4 G:4 | Am'      one chord per bar, or several with their length in ticks
//   a line  'D5:2 G5:2 A5 B5 D6:2'  notes with their length in ticks (1 if left out); '.' rests a tick, '.:4' four;
//                                   '-' holds the last note a tick longer; '|' is a bar line (checked).
//                                   Marks before a note: '~' a cut (a quick grace note above, whistle style),
//                                   '^' an accent, '>' a slide up into the note.
//   patterns, one bar long, repeated each bar and following the chords:
//     arp    '0 1 2 3 4 3 2 1'      chord tones from the bass up (0 the root, then the fifth, octave, tenth, twelfth...)
//     bass   'R . . . F . . A'      R root, F fifth, O octave, A a step into the next bar's root
//     strum  'B . C . F . C c'      B bass note, F fifth, C a strummed chord, c a softer up-stroke
//     stab   'X . . . x . . .'      a short chord (X loud, x soft)
//     drums  { a: [...], b: [...], fill: [...] }: lines of D doum (low drum), d soft doum, T tek (high slap), t soft
//            tek, k ka (muted), s shaker, S loud shaker, B big drum, b soft big drum, r a roll. Each line has its own
//            grid (8 tokens to a 4/4 bar are eighths, 16 are sixteenths). 'a' plays on even bars, 'b' on odd bars,
//            'fill' on a section's last bar.
//   pad / strings follow the chords on their own, voice-led (each chord's notes move as little as they can).
// A list of lines or patterns gives written variations; which one plays is chosen as the music goes, so it never
// loops the same twice but never wanders off what's written.
// Each theme's mix(i) says how loud each layer is at intensity i (night: how many Wildlight are on the plateau).
const SCORE = {
  title: {
    name: 'Brightvein', blurb: 'The title: the main theme, on music box, harp and whistle.',
    bpm: 72, beats: 4, tpb: 2, key: 'D', level: 1,
    layers: {
      box: { kind: 'line', src: 'lead', inst: 'box', vol: 0.34, rev: 0.4, pan: 0.2, oct: 1 },
      lead: { kind: 'line', inst: 'whistle', vol: 0.3, rev: 0.32, pan: 0.05, orn: 0.12 },
      harp: { kind: 'arp', inst: 'harp', vol: 0.36, rev: 0.4, pan: -0.25, oct: 3 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.2, rev: 0.5, cutoff: 1500 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.3, rev: 0.25, oct: 2, follow: true },
    },
    parts: { harp: ['0 1 2 3 4 3 2 1', '0 1 2 1 3 2 4 2'], bass: 'R - - - - - - -' },
    sections: {
      A: {
        chords: 'D | Em7 | Bm | Asus4:4 A:4 | D | Gmaj7 | Em:4 A7:4 | D',
        lead: 'A4:2 D5:2 E5 F#5 A5:2 | G5:3 F#5 E5:2 D5:2 | B4:2 D5 E5 F#5:2 E5 D5 | E5:6 .:2 | A4:2 D5:2 E5 F#5 A5:2 | B5:3 A5 G5:2 F#5:2 | E5:2 F#5 G5 A5:2 C#5:2 | D5:6 .:2',
      },
      B: {
        chords: 'Bm7 | Em | A | D:4 Bm:4 | G:4 D/F#:4 | Em:4 Bm:4 | Em:4 A7:4 | D',
        lead: 'F#5:2 F#5 G5 A5:2 F#5:2 | E5:2 E5 F#5 G5:2 E5:2 | A5:2 A5 B5 C#6:2 A5:2 | D6:3 C#6 B5:2 A5:2 | G5:2 B5:2 A5 G5 F#5:2 | E5:2 G5:2 F#5 E5 D5:2 | E5:3 F#5 E5:2 C#5:2 | D5:6 A4:2',
        harp: '0 2 1 3 2 4 3 2',
      },
    },
    form: [{ s: 'A', mix: { lead: 0, bass: 0.5 } }, { s: 'B', mix: { box: 0 } }, { s: 'A', mix: { box: 0.45 } }],
    mix: () => ({ box: 1, lead: 1, harp: 1, pad: 1, bass: 1 }),
  },

  day: {
    name: 'Morning on the Claim', blurb: 'Day on the claim: warm and unhurried, plucked strings and a whistle.',
    bpm: 92, beats: 4, tpb: 2, key: 'G', level: 1,
    layers: {
      lead: { kind: 'line', inst: 'whistle', vol: 0.28, rev: 0.26, pan: 0.12, orn: 0.18 },
      resp: { kind: 'line', inst: 'harp', vol: 0.34, rev: 0.32, pan: -0.3 },
      harp: { kind: 'arp', inst: 'harp', vol: 0.3, rev: 0.32, pan: -0.25, oct: 3 },
      strum: { kind: 'strum', inst: 'pluck', vol: 0.2, rev: 0.2, pan: 0.32, range: [55, 74] },
      bass: { kind: 'bass', inst: 'pizz', vol: 0.42, rev: 0.12, oct: 2, follow: true },
      pad: { kind: 'pad', inst: 'pad', vol: 0.17, rev: 0.45, cutoff: 1500 },
      perc: { kind: 'drum', vol: 0.36, rev: 0.14, pan: -0.08 },
    },
    parts: {
      harp: ['0 1 2 3 4 3 2 1', '0 1 2 1 3 1 2 1'], strum: 'B . C . F . C c', bass: 'R . . . F . . .',
      perc: { a: ['d . . . . . d .', '. . s . . . s .'], fill: ['d . . . d . t t', '. . s . . . s s'] },
    },
    sections: {
      A: {
        chords: 'G | C:4 G:4 | Am:4 Em:4 | D | G | C | Am:4 D7:4 | G',
        lead: [
          'D5:2 G5:2 A5 B5 D6:2 | C6:2 B5 A5 B5:2 G5:2 | A5:2 B5 A5 G5:2 E5:2 | D5:4 F#5:2 A5:2 | D5:2 G5:2 A5 B5 D6:2 | E6:3 D6 C6:2 B5:2 | A5:2 B5 C6 A5:2 F#5:2 | G5:6 .:2',
          'D5:2 G5:2 A5 B5 D6:2 | C6:2 E6 D6 B5:2 G5:2 | A5:2 C6 B5 G5:2 E5:2 | D5:2 E5 F#5 A5:4 | D5:2 G5:2 A5 B5 D6:2 | E6:3 D6 C6:2 B5:2 | A5:2 B5 C6 A5:2 F#5:2 | G5:6 .:2',
        ],
      },
      A2: {
        chords: 'G | C:4 G:4 | Am:4 Em:4 | D | G | C | G/B:4 D7:4 | G',
        lead: 'D5:2 G5:2 A5 B5 D6:2 | C6:2 B5 A5 B5:2 G5:2 | A5:2 B5 A5 G5:2 E5:2 | D5:4 F#5:2 A5:2 | D5:2 G5:2 A5 B5 D6:2 | E6:2 G6:2 E6 D6 C6:2 | B5:2 D6 B5 A5:2 F#5:2 | G5:6 .:2',
      },
      B: {
        chords: 'Em7 | D:4 G:4 | C | D | Em7 | C:4 Am7:4 | G/D:4 D7:4 | G',
        lead: 'B5:2 B5 C6 D6:2 B5:2 | A5:2 G5 F#5 G5:4 | .:8 | .:8 | B5:2 B5 C6 D6:2 E6:2 | C6:2 B5 A5 G5:2 A5:2 | B5:2 A5 G5 A5:2 D5:2 | G5:6 .:2',
        resp: '.:8 | .:8 | E5:2 E5 F#5 G5:2 E5:2 | F#5:2 E5 D5 A4:2 D5:2 | .:8 | .:8 | .:8 | .:8',
        harp: '0 2 1 3 2 4 3 2', strum: 'B . C c F . C c',
        perc: { a: ['D . . t d . t .', '. s . s . s . s'], fill: ['D . t t D t T T', '. s . s . s s s'] },
      },
    },
    form: [{ s: 'A', v: 0, mix: { strum: 0, perc: 0 } }, { s: 'A2', mix: { perc: 0 } }, { s: 'B' }, { s: 'A', v: 1, mix: { perc: 0.6 } }],
    mix: () => ({ lead: 1, resp: 1, harp: 1, strum: 1, bass: 1, pad: 1, perc: 1 }),
  },

  // dusk: the day's tune thinned out and slowed, on a low flute, with the pad darkening (and the IV chord turning minor)
  dusk: {
    name: 'Lamplighting', blurb: 'Dusk: the day tune slows and thins, on a low flute, as the light goes.',
    base: 'day', bpm: 74, level: 1.05, thin: [1, 1, 0, 0],
    layers: {
      lead: { kind: 'line', inst: 'flute', vol: 0.3, rev: 0.4, pan: 0.1, oct: -1, orn: 0 },
      resp: { kind: 'line', inst: 'harp', vol: 0.3, rev: 0.45, pan: -0.3 },
      harp: { kind: 'arp', inst: 'harp', vol: 0.3, rev: 0.45, pan: -0.25, oct: 3 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.26, rev: 0.3, oct: 2, follow: true },
      pad: { kind: 'pad', inst: 'pad', vol: 0.22, rev: 0.5, cutoff: 650 },
    },
    parts: { harp: '0 . 2 . 3 . 2 .', bass: 'R - - - - - - -' },
    chordsOver: { A: { 3: 'C:4 Cm:4', 5: 'Cmaj7' }, A2: { 3: 'C:4 Cm:4', 7: 'Cm:4 G:4' } },
    form: [{ s: 'A', v: 0 }, { s: 'A2' }],
    mix: () => ({ lead: 1, resp: 0.8, harp: 1, bass: 1, pad: 1 }),
  },

  night: {
    name: 'The Night Watch', blurb: 'Night: a plucked pattern over a low drone. Drums and high strings rise as more Wildlight climb the cliffs.',
    bpm: 84, beats: 4, tpb: 2, key: 'Em', level: 1,
    layers: {
      ost: { kind: 'arp', inst: 'pluck', vol: 0.3, rev: 0.3, pan: -0.2, oct: 3 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.2, rev: 0.5, cutoff: 520 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.3, rev: 0.2, oct: 2, follow: true },
      heart: { kind: 'drum', vol: 0.4, rev: 0.2 },
      lead: { kind: 'line', inst: 'flute', vol: 0.3, rev: 0.4, pan: 0.15, orn: 0.06 },
      drums: { kind: 'drum', vol: 0.3, rev: 0.12, pan: 0.1 },
      trem: { kind: 'pad', inst: 'trem', vol: 0.11, rev: 0.4, pan: 0.25, voices: 2, range: [71, 86] },
      brass: { kind: 'stab', inst: 'brass', vol: 0.2, rev: 0.35, range: [40, 59] },
      big: { kind: 'drum', vol: 0.42, rev: 0.3 },
    },
    parts: {
      ost: ['0 2 3 0 2 3 0 1', '0 2 3 0 2 3 1 2'], bass: 'R - - - - - - -',
      heart: { a: ['D . . d . . . .'], b: ['D . . d . . d .'] },
      drums: { a: ['T . t k t . T . t k t . T t k t', 'D . . . . . D . . . . . D . . .'], b: ['T . t k t . T . t k t . T . T T', 'D . . . . . D . . . . . D . . .'], fill: ['T t t T t t T t t T t t T T T T', 'D . . . . . D . . . . . D . D D'] },
      brass: 'X - - - - - - -', big: { a: ['B . . . . . . . . . . . B . . .'], fill: ['B . . . . . B . . . . . B . B .'] },
    },
    sections: {
      A: {
        chords: 'Em | Em | C | C | Am | Am | B | B7',
        lead: [
          'B4:2 E5:2 F#5 G5 B5:2 | G5:3 F#5 E5:4 | .:8 | .:4 E5 F#5 G5 B5 | C6:3 B5 A5:4 | .:8 | D#5:2 F#5:2 B5:4 | A5:3 G5 F#5:4',
          'B4:2 E5:2 F#5 G5 B5:2 | G5:3 F#5 E5:2 B4:2 | C5:2 E5 G5 C6:2 G5:2 | E5:2 G5 E5 C5:2 E5:2 | A5:3 G5 E5:2 C5:2 | E5:2 A5:2 C6:2 E6:2 | D#6:4 B5:2 F#5:2 | A5:2 B5 A5 F#5:2 D#5:2',
        ],
      },
      B: {
        chords: 'Em | D | C | B7 | Em | D | C | B',
        lead: 'E5:2 G5 B5 E6:2 B5:2 | D6:3 A5 F#5:2 A5:2 | E6:2 C6:2 G5:2 E5:2 | D#5:2 F#5 A5 B5:4 | E5:2 G5 B5 E6:2 F#6 G6 | F#6:3 E6 D6:2 A5:2 | G5:2 E5 G5 C6:2 B5 A5 | B5:6 .:2',
      },
    },
    form: [{ s: 'A', pick: 'intensity' }, { s: 'B' }],
    // 0 quiet, 1 a few Wildlight, 2 four or more, 3 eight or more (or the wall broken)
    mix: i => ({ ost: 1, pad: 1, bass: 1, heart: i === 1 ? 1 : 0, lead: i >= 1 ? 1 : 0, drums: i >= 2 ? (i >= 3 ? 1 : 0.7) : 0, trem: i >= 2 ? 1 : 0, brass: i >= 3 ? 1 : 0, big: i >= 3 ? 1 : 0 }),
  },

  dawn: {
    name: 'First Light', blurb: 'Dawn: a short cue as the sun comes up, turning the night\'s minor into the morning\'s major.',
    bpm: 66, beats: 4, tpb: 2, key: 'G', level: 1, once: true,
    layers: {
      box: { kind: 'line', inst: 'box', vol: 0.36, rev: 0.45, pan: 0.2 },
      lead: { kind: 'line', inst: 'whistle', vol: 0.3, rev: 0.4, pan: -0.05, orn: 0 },
      bell: { kind: 'line', inst: 'bell', vol: 0.3, rev: 0.55, pan: -0.15 },
      harp: { kind: 'arp', inst: 'harp', vol: 0.32, rev: 0.45, pan: -0.25, oct: 3 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.2, rev: 0.5, cutoff: 700 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.28, rev: 0.25, oct: 2, follow: true },
    },
    parts: { harp: '0 1 2 3 4 5 4 3', bass: 'R - - - - - - -' },
    sections: {
      A: {
        chords: 'Em | C | Dsus4:4 D:4 | G | G',
        box: 'B4:2 E5:2 F#5 G5 B5:2 | C6:3 B5 G5:2 E5:2 | D6:2 A5:2 F#5:2 A5:2 | G5:2 B5:2 D6:4 | G6:8',
        lead: '.:8 | .:8 | .:8 | D5:2 G5:2 A5 B5 D6:2 | B5:8',
        bell: '.:8 | .:8 | .:8 | G4:8 | .:8',
        padCut: [600, 800, 1100, 1600, 1900],
      },
    },
    form: [{ s: 'A' }],
    mix: () => ({ box: 1, lead: 1, bell: 1, harp: 1, pad: 1, bass: 1 }),
  },

  letter: {
    name: 'A Letter Under Seal', blurb: 'Baron Tallow\'s motif: low brass in C minor, over a ticking music box, for his letters.',
    bpm: 60, beats: 4, tpb: 2, key: 'Cm', level: 0.85,
    layers: {
      brass: { kind: 'line', inst: 'brass', vol: 0.36, rev: 0.4, pan: 0 },
      tick: { kind: 'line', inst: 'box', vol: 0.2, rev: 0.5, pan: 0.3 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.2, rev: 0.5, cutoff: 500 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.26, rev: 0.25, oct: 2, follow: true },
      drum: { kind: 'drum', vol: 0.36, rev: 0.3 },
    },
    parts: { bass: 'R - - - - - - -', drum: { a: ['b . . . . . . .'], b: ['b . . . b . . .'] } },
    sections: {
      A: {
        chords: 'Cm | G | Ab:4 D7/F#:2 G:2 | Cm | Cm | G | Fm | G',
        brass: 'C3:4 Eb3:2 D3 C3 | B2:4 G2:4 | Ab2:4 F#2:2 G2:2 | C3:8 | Eb3:4 G3:2 F3 Eb3 | D3:4 B2:4 | C3:4 Ab2:4 | G2:8',
        tick: 'C6:4 G5:4 | B5:4 G5:4 | C6:4 A5:2 G5:2 | C6:4 G5:4 | Eb6:4 C6:4 | D6:4 B5:4 | C6:4 Ab5:4 | B5:4 G5:4',
      },
      A2: {
        chords: 'Cm | G | Ab:4 D7/F#:2 G:2 | Cm | Cm | G | Fm:4 G7:4 | Cm',
        brass: 'C3:4 Eb3:2 D3 C3 | B2:4 G2:4 | Ab2:4 F#2:2 G2:2 | C3:8 | Eb3:4 G3:2 F3 Eb3 | D3:4 B2:4 | Ab2:4 G2:4 | C3:8',
        tick: 'C6:4 G5:4 | B5:4 G5:4 | C6:4 A5:2 G5:2 | C6:4 G5:4 | Eb6:4 C6:4 | D6:4 B5:4 | C6:4 B5:4 | C6:4 G5:4',
      },
    },
    form: [{ s: 'A' }, { s: 'A2' }],
    mix: () => ({ brass: 1, tick: 1, pad: 1, bass: 1, drum: 1 }),
  },

  tallow: {
    name: 'Rust-Red Sails', blurb: 'The jumpers come over the rim: Tallow\'s motif as a march, and the claim\'s own tune fighting back.',
    bpm: 112, beats: 4, tpb: 2, key: 'Cm', level: 0.95,
    layers: {
      brass: { kind: 'line', inst: 'brass', vol: 0.32, rev: 0.3, pan: -0.05 },
      lead: { kind: 'line', inst: 'whistle', vol: 0.28, rev: 0.28, pan: 0.15, orn: 0.1 },
      ost: { kind: 'arp', inst: 'spicc', vol: 0.3, rev: 0.18, pan: -0.15, oct: 2 },
      stab: { kind: 'stab', inst: 'brass', vol: 0.2, rev: 0.3, range: [43, 62] },
      pad: { kind: 'pad', inst: 'pad', vol: 0.14, rev: 0.45, cutoff: 700 },
      drums: { kind: 'drum', vol: 0.32, rev: 0.12 },
    },
    parts: {
      ost: '0 0 1 0 0 1 2 1', stab: 'X . . . x . . .',
      drums: { a: ['D . . . D . . .', 'T . t t T . t t T . t t T t t t'], fill: ['D . D . D D D D', 'T t t t T t t t T t T t T T T T'] },
    },
    sections: {
      A: {
        chords: 'Cm | G | Ab:4 D7/F#:2 G:2 | Cm | Cm | G | Fm | G',
        brass: 'C4:4 Eb4:2 D4 C4 | B3:4 G3:4 | Ab3:4 F#3:2 G3:2 | C4:8 | Eb4:4 G4:2 F4 Eb4 | D4:4 B3:4 | C4:4 Ab3:4 | G3:8',
        lead: '.:8 | .:8 | .:8 | .:8 | .:8 | .:8 | .:8 | .:8',
      },
      A2: {
        chords: 'Cm | G | Ab:4 D7/F#:2 G:2 | Cm | Cm | G | Fm:4 G7:4 | Cm',
        brass: 'C4:4 Eb4:2 D4 C4 | B3:4 G3:4 | Ab3:4 F#3:2 G3:2 | C4:8 | Eb4:4 G4:2 F4 Eb4 | D4:4 B3:4 | Ab3:4 G3:4 | C4:8',
        lead: '.:8 | .:8 | .:8 | .:8 | .:8 | .:8 | .:8 | .:8',
      },
      B: {
        chords: 'Cm | Bb | Cm | G | Cm | Fm | G7 | Cm',
        lead: 'G4:2 C5:2 D5 Eb5 G5:2 | F5:3 Eb5 D5:2 Bb4:2 | C5:2 Eb5 F5 G5:2 Ab5:2 | G5:6 .:2 | G4:2 C5:2 D5 Eb5 G5:2 | Ab5:3 G5 F5:2 Eb5:2 | D5:2 Eb5 F5 G5:2 B4:2 | C5:6 .:2',
        brass: '.:8 | .:8 | .:8 | .:8 | .:8 | .:8 | .:8 | .:8',
      },
    },
    form: [{ s: 'A', mix: { stab: 0 } }, { s: 'A2', mix: { stab: 0 } }, { s: 'B' }, { s: 'A2' }],
    mix: () => ({ brass: 1, lead: 1, ost: 1, stab: 1, pad: 1, drums: 1 }),
  },

  skies: {
    name: 'Open Skies', blurb: 'Sailing: the main motif slowed to half speed, soaring over strings and wind.',
    bpm: 100, beats: 4, tpb: 2, key: 'D', level: 1,
    layers: {
      lead: { kind: 'line', inst: 'whistle', vol: 0.28, rev: 0.35, pan: 0.1, orn: 0.1 },
      strings: { kind: 'pad', inst: 'strings', vol: 0.16, rev: 0.45, pan: -0.1, voices: 3, range: [62, 81] },
      harp: { kind: 'arp', inst: 'harp', vol: 0.26, rev: 0.35, pan: -0.3, oct: 3 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.14, rev: 0.5, cutoff: 2200 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.28, rev: 0.2, oct: 2, follow: true },
      perc: { kind: 'drum', vol: 0.24, rev: 0.15 },
      drums: { kind: 'drum', vol: 0.32, rev: 0.12 },
      ost: { kind: 'arp', inst: 'spicc', vol: 0.3, rev: 0.15, pan: 0.15, oct: 2 },
      stab: { kind: 'stab', inst: 'brass', vol: 0.2, rev: 0.3, range: [45, 64] },
    },
    parts: {
      harp: '0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1', bass: 'R - - - - - - -', ost: '0 0 1 0 0 1 2 1', stab: 'X . . . . . . .',
      perc: { a: ['d . . . d . . .', '. . s . . . s .'] },
      drums: { a: ['D . . D . . D .', 'T . t t . t T . t . t t T . t t'], fill: ['D . D D . D D D', 'T t t T t t T t T t t T T T T T'] },
    },
    sections: {
      A: {
        chords: 'D | Em7:4 D/F#:4 | G | Em:4 A:4 | D | Em7:4 D/F#:4 | G | A',
        lead: 'A4:4 D5:4 | E5:3 F#5 A5:4 | B5:6 A5:2 | G5:3 F#5 E5:4 | A4:4 D5:4 | E5:3 F#5 A5:4 | D6:6 C#6 B5 | A5:8',
      },
      B: {
        chords: 'D | C | G | D | Bm | C | G | A',
        lead: 'F#5:2 A5:2 D6:4 | E6:2 C6:2 G5:4 | B5:2 D6 B5 G5:4 | A5:4 F#5:2 D5:2 | F#5:2 B5:2 D6:4 | E6:3 D6 C6:2 G5:2 | B5:2 G5 A5 B5:2 D6:2 | C#6:4 E6:2 A5:2',
      },
    },
    form: [{ s: 'A' }, { s: 'B' }],
    // 0 in the shipyard, 1 under sail, 2 in a fight
    mix: i => ({ lead: i === 0 ? 0 : i >= 2 ? 0.75 : 1, strings: 1, harp: i >= 2 ? 0.4 : 1, pad: 1, bass: 1, perc: i === 1 ? 1 : 0, drums: i >= 2 ? 1 : 0, ost: i >= 2 ? 1 : 0, stab: i >= 2 ? 1 : 0 }),
  },

  scene: {
    name: 'Around the Fire', blurb: 'Under the story scenes: soft and slow, so the words come first.',
    bpm: 66, beats: 4, tpb: 2, key: 'G', level: 1.15,
    layers: {
      box: { kind: 'line', inst: 'box', vol: 0.26, rev: 0.5, pan: 0.2 },
      harp: { kind: 'arp', inst: 'harp', vol: 0.26, rev: 0.45, pan: -0.25, oct: 3 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.17, rev: 0.5, cutoff: 1000 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.2, rev: 0.3, oct: 2, follow: true },
    },
    parts: { harp: ['0 - 1 - 2 - 1 -', '0 - 2 - 3 - 2 -'], bass: 'R - - - - - - -' },
    sections: {
      A: {
        chords: 'G | Em | C | D | G | Em | Am | D',
        box: [
          'D5:2 G5:2 B5:4 | .:8 | E5:2 G5:2 C6:4 | .:4 A5:2 F#5:2 | D5:2 G5:2 B5:2 D6:2 | .:8 | C6:2 B5:2 A5:4 | .:8',
          'B4:2 D5:2 G5:4 | .:8 | C5:2 E5:2 G5:4 | .:4 F#5:2 A5:2 | B5:2 A5:2 G5:2 B5:2 | .:8 | A5:2 C6:2 E6:4 | .:4 D6:2 A5:2',
        ],
      },
    },
    form: [{ s: 'A', v: 0 }, { s: 'A', v: 1 }],
    mix: () => ({ box: 1, harp: 1, pad: 1, bass: 1 }),
  },

  flourish: {
    name: 'Chapter Done', blurb: 'A short flourish when a chapter of the story is finished.',
    bpm: 96, beats: 4, tpb: 2, key: 'D', level: 1, once: true, overlay: true,
    layers: {
      lead: { kind: 'line', inst: 'whistle', vol: 0.32, rev: 0.4, pan: 0.05, orn: 0 },
      box: { kind: 'line', inst: 'box', vol: 0.3, rev: 0.45, pan: 0.25 },
      bell: { kind: 'line', inst: 'bell', vol: 0.3, rev: 0.55, pan: -0.15 },
      harp: { kind: 'arp', inst: 'harp', vol: 0.32, rev: 0.4, pan: -0.25, oct: 3 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.18, rev: 0.5, cutoff: 1800 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.26, rev: 0.25, oct: 2, follow: true },
    },
    parts: { harp: '0 1 2 3 4 5 4 3', bass: 'R - - - - - - -' },
    sections: {
      A: {
        chords: 'D | G:4 A:4 | D',
        lead: 'A4 D5 E5 F#5 A5:4 | G5:2 B5:2 E6:2 C#6:2 | D6:8',
        box: '.:8 | .:8 | F#6:8', bell: '.:8 | .:8 | D4:8',
      },
    },
    form: [{ s: 'A' }],
    mix: () => ({ lead: 1, box: 1, bell: 1, harp: 1, pad: 1, bass: 1 }),
  },

  victory: {
    name: 'Colours Struck', blurb: 'A raid won: brass and whistle as the jumpers strike their colours.',
    bpm: 104, beats: 4, tpb: 2, key: 'D', level: 0.95, once: true, overlay: true,
    layers: {
      lead: { kind: 'line', inst: 'whistle', vol: 0.3, rev: 0.35, pan: 0.1, orn: 0.2 },
      brass: { kind: 'line', inst: 'brass', vol: 0.3, rev: 0.35, pan: -0.1 },
      harp: { kind: 'arp', inst: 'harp', vol: 0.28, rev: 0.35, pan: -0.25, oct: 3 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.16, rev: 0.5, cutoff: 2000 },
      drums: { kind: 'drum', vol: 0.32, rev: 0.15 },
    },
    parts: { harp: '0 1 2 3 4 3 2 1', drums: { a: ['D . . . D . D D'], fill: ['B . . . . . . .'] } },
    sections: {
      A: {
        chords: 'D | Bm | G:4 A:4 | D',
        lead: 'A5:2 D6:2 E6 F#6 A6:2 | F#6:4 D6:4 | D6:2 B5:2 C#6:2 E6:2 | D6:8',
        brass: 'D3:2 A3:2 D4:2 F#4:2 | B3:4 F#3:4 | G3:4 A3:4 | D3:8',
      },
    },
    form: [{ s: 'A' }],
    mix: () => ({ lead: 1, brass: 1, harp: 1, pad: 1, drums: 1 }),
  },

  lament: {
    name: 'All Hands to the Boats', blurb: 'When your ship goes down: a few slow notes on the flute.',
    bpm: 72, beats: 4, tpb: 2, key: 'Dm', level: 1.1, once: true, overlay: true,
    layers: {
      lead: { kind: 'line', inst: 'flute', vol: 0.32, rev: 0.5, pan: 0.05, orn: 0 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.2, rev: 0.55, cutoff: 600 },
      bass: { kind: 'bass', inst: 'bowed', vol: 0.26, rev: 0.3, oct: 2, follow: true },
    },
    parts: { bass: 'R - - - - - - -' },
    sections: { A: { chords: 'Dm | Gm:4 A7:4 | Dm', lead: 'A4:3 D5 F5:2 E5:2 | D5:2 Bb4:2 C#5:2 E5:2 | D5:8' } },
    form: [{ s: 'A' }],
    mix: () => ({ lead: 1, pad: 1, bass: 1 }),
  },

  faire: {
    name: 'The Moon Faire', blurb: 'The festival night: a jig on whistle, with a frame drum and a strummed cittern.',
    bpm: 108, beats: 2, tpb: 3, key: 'D', level: 0.95,
    layers: {
      lead: { kind: 'line', inst: 'whistle', vol: 0.27, rev: 0.25, pan: 0.12, orn: 0.3 },
      harm: { kind: 'harm', of: 'lead', steps: -2, inst: 'box', vol: 0.13, rev: 0.35, pan: 0.3 },
      strum: { kind: 'strum', inst: 'pluck', vol: 0.24, rev: 0.2, pan: -0.3, range: [55, 74] },
      bass: { kind: 'bass', inst: 'pizz', vol: 0.32, rev: 0.12, oct: 2 },
      perc: { kind: 'drum', vol: 0.34, rev: 0.12, pan: -0.05 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.08, rev: 0.4, cutoff: 1400 },
    },
    parts: {
      strum: 'B . C F . C', bass: 'R . . F . .',
      perc: { a: ['D t t D t t', '. s s . s s'], b: ['D t k D t t', '. s s . s s'], fill: ['D t t D D D', '. s s S s s'] },
    },
    sections: {
      A: {
        chords: 'D | D:3 G:3 | D:3 A:3 | G:3 A:3 | D | G | D:3 A:3 | D',
        lead: [
          'A4 D5 D5 F#5 D5 F#5 | A5 F#5 A5 B5 A5 G5 | F#5 E5 D5 E5 F#5 E5 | D5 B4 A4 A4 B4 C#5 | D5 F#5 A5 D6 A5 F#5 | G5 F#5 G5 B5 A5 G5 | F#5 A5 F#5 E5 D5 C#5 | D5:3 D5 E5 F#5',
          'A4 D5 D5 F#5 E5 D5 | A5 F#5 A5 B5 C#6 D6 | A5 F#5 D5 E5 F#5 E5 | D5 B4 A4 A4 B4 C#5 | D5 F#5 A5 D6 E6 F#6 | G6 F#6 E6 D6 B5 G5 | F#5 A5 F#5 E5 D5 C#5 | D5:3 D5 F#5 A5',
        ],
      },
      B: {
        chords: 'D | G | Em:3 A:3 | D | Bm | G | A7 | D',
        lead: [
          'A5 D6 E6 F#6 E6 D6 | B5 G5 B5 D6 B5 G5 | E6 B5 G5 A5 C#6 E6 | F#6 D6 A5 D6:3 | B5 F#5 B5 D6 B5 F#5 | G5 B5 D6 G6 D6 B5 | A5 G5 E5 C#6 B5 A5 | D6:3 D6 A5 F#5',
          'A5 D6 E6 F#6 E6 D6 | B5 G5 B5 D6 B5 G5 | E6 B5 G5 A5 C#6 E6 | F#6 D6 A5 D6:3 | B5 F#5 B5 D6 B5 F#5 | G5 B5 D6 G6 D6 B5 | A5 C#6 E6 G6 E6 C#6 | D6:3 A5 F#5 E5',
        ],
      },
    },
    form: [{ s: 'A', v: 0, mix: { harm: 0 } }, { s: 'A', v: 1 }, { s: 'B', v: 0 }, { s: 'B', v: 1, mix: { harm: 0 } }],
    mix: () => ({ lead: 1, harm: 1, strum: 1, bass: 1, perc: 1, pad: 1 }),
  },

  keep: {
    name: 'By the Hearth', blurb: 'Inside the Keep: the motif as a slow waltz on music box and harp.',
    bpm: 84, beats: 3, tpb: 2, key: 'G', level: 1.1,
    layers: {
      box: { kind: 'line', inst: 'box', vol: 0.3, rev: 0.4, pan: 0.15 },
      flute: { kind: 'line', src: 'box', inst: 'flute', vol: 0.2, rev: 0.4, pan: -0.1, oct: -1, orn: 0 },
      harp: { kind: 'arp', inst: 'harp', vol: 0.32, rev: 0.35, pan: -0.25, oct: 2 },
      pad: { kind: 'pad', inst: 'pad', vol: 0.14, rev: 0.45, cutoff: 900 },
    },
    parts: { harp: ['0 . 2 . 3 .', '0 . 2 3 4 3'] },
    sections: {
      A: {
        chords: 'G | C | G | D | G | C | Am:4 D7:2 | G',
        box: 'D5:2 G5:2 A5 B5 | C6:4 B5 A5 | B5:2 G5:2 D5:2 | A5:4 F#5:2 | D5:2 G5:2 A5 B5 | E6:4 D6 C6 | C6:2 B5 A5 F#5:2 | G5:6',
      },
      B: {
        chords: 'Em | C | G | D | Em | C | G/D:2 D7:4 | G',
        box: 'B5:2 E6:3 D6 | C6:2 E6:2 D6 C6 | B5:2 D6:2 G5:2 | A5:4 D5:2 | G5:2 B5:2 E6:2 | E6:3 D6 C6:2 | B5:2 A5:2 C6 F#5 | G5:6',
      },
    },
    form: [{ s: 'A', mix: { flute: 0 } }, { s: 'B', mix: { flute: 0 } }, { s: 'A' }, { s: 'B' }],
    mix: () => ({ box: 1, flute: 1, harp: 1, pad: 1 }),
  },

  mine: {
    name: 'Down the Vein', blurb: 'The mine: low harp that echoes off the rock, a drone, and drips of music box.',
    bpm: 60, beats: 4, tpb: 2, key: 'Am', level: 1.1, echo: 0.75,
    layers: {
      low: { kind: 'line', inst: 'harp', vol: 0.42, rev: 0.45, echo: 0.55, pan: -0.1 },
      drone: { kind: 'pad', inst: 'strings', vol: 0.16, rev: 0.4, voices: 2, range: [40, 60] },
      pad: { kind: 'pad', inst: 'pad', vol: 0.16, rev: 0.5, cutoff: 420 },
      drip: { kind: 'drip', inst: 'box', vol: 0.16, rev: 0.5, echo: 0.6, density: 0.09, range: [76, 93] },
    },
    sections: {
      A: {
        chords: 'Am | Am | Fmaj7 | Fmaj7 | Dm | Dm | Esus4:4 E:4 | Am',
        low: [
          'E3:2 A3:2 B3 C4 E4:2 | .:8 | F4:3 E4 C4:4 | .:8 | D4:2 F4:2 A4:4 | .:8 | B3:4 G#3:4 | A3:8',
          'E4:2 A4:2 B4 C5 E5:2 | .:8 | F4:3 A4 C5:4 | .:8 | F4:2 A4:2 D5:4 | .:8 | E4:4 G#4:4 | A4:8',
        ],
      },
    },
    form: [{ s: 'A', v: 0 }, { s: 'A', v: 1 }],
    mix: () => ({ low: 1, drone: 1, pad: 1, drip: 1 }),
  },
};
// the music box in the settings lists these, in this order (with the intensity to play them at)
const SCORE_BOX = [
  ['title', 0], ['day', 0], ['dusk', 0], ['night', 0, 'The Night Watch (quiet)'], ['night', 3, 'The Night Watch (Wildlight on the plateau)'],
  ['dawn', 0], ['letter', 0], ['tallow', 0], ['skies', 1], ['skies', 2, 'Open Skies (a fight)'], ['scene', 0], ['flourish', 0],
  ['victory', 0], ['lament', 0], ['faire', 0], ['keep', 0], ['mine', 0],
];

// ---------------------------------------------------------------- the arranger: notes from the score, bar by bar
const ARR = (() => {
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const acc = a => a === '#' ? 1 : a === 'b' ? -1 : 0;
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7],
    dim: [0, 3, 6], dim7: [0, 3, 6, 9], 5: [0, 7], add9: [0, 4, 7, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], aug: [0, 4, 8], '7sus4': [0, 5, 7, 10],
  };
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  const NOTE = /^([~^>]*)([A-G])([#b]?)(-?\d)(?::(\d+(?:\.\d+)?))?$/;
  const midi = (l, a, o) => 12 * (+o + 1) + PC[l] + acc(a);
  function keyOf(k) { const m = /^([A-G])([#b]?)(m?)$/.exec(k); return { tonic: (PC[m[1]] + acc(m[2]) + 12) % 12, scale: SCALES[m[3] ? 'minor' : 'major'] }; }
  const chordCache = new Map();
  function chordOf(sym) {
    if (chordCache.has(sym)) return chordCache.get(sym);
    const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
    if (!m || !QUAL[m[3]]) throw new Error('unknown chord ' + sym);
    const root = (PC[m[1]] + acc(m[2]) + 12) % 12, iv = QUAL[m[3]];
    const c = { sym, root, bass: m[4] ? (PC[m[4]] + acc(m[5]) + 12) % 12 : root, iv, pcs: iv.map(i => (root + i) % 12) };
    chordCache.set(sym, c); return c;
  }
  // a line of notes: events with absolute ticks, and where its bar lines fell
  function parseLine(str) {
    const evs = [], bars = []; let t = 0, last = null;
    for (const tok of str.trim().split(/\s+/)) {
      if (tok === '|') { bars.push(t); continue; }
      if (tok === '-') { if (last) last.len += 1; t += 1; continue; }
      const r = /^\.(?::(\d+(?:\.\d+)?))?$/.exec(tok);
      if (r) { t += r[1] ? +r[1] : 1; last = null; continue; }
      const m = NOTE.exec(tok); if (!m) throw new Error('bad note "' + tok + '"');
      const e = { t, len: m[5] ? +m[5] : 1, m: midi(m[2], m[3], m[4]), cut: m[1].includes('~'), acc: m[1].includes('^'), glide: m[1].includes('>') };
      evs.push(e); last = e; t += e.len;
    }
    return { evs, bars, len: t };
  }
  function parseChords(str, barLen) {
    return str.split('|').map(b => {
      const toks = b.trim().split(/\s+/).filter(Boolean).map(s => { const [sym, n] = s.split(':'); return { ch: chordOf(sym), len: n ? +n : 0 }; });
      const fixed = toks.reduce((s, x) => s + x.len, 0), free = toks.filter(x => !x.len).length;
      let t = 0; for (const x of toks) { if (!x.len) x.len = (barLen - fixed) / free; x.t = t; t += x.len; }
      if (Math.abs(t - barLen) > 1e-6) throw new Error(`chords "${b.trim()}" fill ${t} of ${barLen} ticks`);
      return toks;
    });
  }
  const pat = s => s.trim().split(/\s+/);
  // check a line's bar lines against the bar length; returns a list of problems (empty when it's right)
  function checkLine(p, barLen, nBars, label) {
    const out = [];
    p.bars.forEach((b, i) => { if (Math.abs(b - (i + 1) * barLen) > 1e-6) out.push(`${label}: bar ${i + 1} ends at tick ${b}, not ${(i + 1) * barLen}`); });
    if (Math.abs(p.len - nBars * barLen) > 1e-6) out.push(`${label}: ${p.len} ticks, not ${nBars * barLen} (${nBars} bars)`);
    return out;
  }
  // the theme with its sections parsed; a theme with `base` takes the sections of another and changes a few things
  const compiled = {};
  function compile(id) {
    if (compiled[id]) return compiled[id];
    const T = SCORE[id], B = T.base ? SCORE[T.base] : T;
    const th = { ...B, ...T, id, sections: {}, problems: [] };
    th.layers = T.layers; th.parts = { ...(B.parts || {}), ...(T.parts || {}) };
    th.barLen = th.beats * th.tpb; th.key0 = keyOf(th.key);
    // the names in a section that hold lines of notes: what each 'line' layer reads (its src, or its own name) and
    // what each 'harm' layer harmonises
    const lineKeys = new Set();
    for (const [n, L] of Object.entries(T.layers)) { if (L.kind === 'line') lineKeys.add(L.src || n); if (L.kind === 'harm') lineKeys.add(L.of); }
    for (const [name, S0] of Object.entries(B.sections)) {
      const over = (T.chordsOver || {})[name] || {};
      let chords;
      try { chords = parseChords(S0.chords, th.barLen); for (const [i, c] of Object.entries(over)) chords[i] = parseChords(c, th.barLen)[0]; }
      catch (e) { th.problems.push(`${id} ${name}: ${e.message}`); continue; }
      const S = { name, chords, n: chords.length, lines: {}, raw: S0 };
      for (const [k, v] of Object.entries(S0)) {
        if (!lineKeys.has(k)) continue;
        S.lines[k] = (Array.isArray(v) ? v : [v]).map((str, vi) => {
          const p = parseLine(str); th.problems.push(...checkLine(p, th.barLen, S.n, `${id} ${name} ${k}${vi ? ' v' + vi : ''}`));
          const bars = Array.from({ length: S.n }, () => []);
          for (const e of p.evs) { const b = Math.floor(e.t / th.barLen + 1e-9); if (bars[b]) bars[b].push({ ...e, t: e.t - b * th.barLen }); }
          if (T.thin) bars.forEach((b, bi) => { if (!T.thin[bi % T.thin.length]) b.length = 0; });
          return bars;
        });
      }
      th.sections[name] = S;
    }
    return (compiled[id] = th);
  }
  const chordAt = (S, bar, t) => { const cs = S.chords[bar]; let c = cs[0]; for (const x of cs) if (t >= x.t - 1e-6) c = x; return c; };
  // chord tones from the bass up, for arpeggios: the bass, then every chord tone from a fifth above it, two octaves on
  const arpCache = new Map();
  function arpTones(ch, oct) {
    const key = ch.sym + oct; if (arpCache.has(key)) return arpCache.get(key);
    const low = 12 * (oct + 1) + ch.bass, out = [low];
    for (let m = low + 7; m <= low + 34; m++) if (ch.pcs.includes(m % 12)) out.push(m);
    arpCache.set(key, out); return out;
  }
  // voice leading: the voicing of `ch` (n notes between lo and hi, each chord tone at least once) nearest to `prev`
  function voice(ch, prev, n, lo, hi) {
    const cands = [];
    const pcs = ch.pcs.length > n ? ch.pcs.filter((p, i) => i !== 2 || ch.pcs.length < 4).slice(0, n) : ch.pcs;
    const pool = []; for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) pool.push(m);
    const rec = (start, cur) => {
      if (cur.length === n) { if (pcs.every(p => cur.some(m => m % 12 === p)) || n < pcs.length) cands.push(cur.slice()); return; }
      for (let i = start; i < pool.length; i++) { if (cur.length && pool[i] - cur[cur.length - 1] < 3) continue; if (cur.length && pool[i] - cur[0] > 19) break; cur.push(pool[i]); rec(i + 1, cur); cur.pop(); }
    };
    rec(0, []);
    if (!cands.length) return pcs.slice(0, n).map(p => lo + ((p - lo) % 12 + 12) % 12);
    let best = cands[0], bs = 1e9;
    const mid = (lo + hi) / 2;
    for (const c of cands) {
      const s = prev && prev.length === n ? c.reduce((a, m, i) => a + Math.abs(m - prev[i]), 0) : Math.abs(c.reduce((a, m) => a + m, 0) / n - mid) * 2;
      if (s < bs) { bs = s; best = c; }
    }
    return best;
  }
  // a note moved by scale steps in the theme's key (harmony a third below is steps: -2)
  function stepIn(key, m, steps) {
    const rel = ((m - key.tonic) % 12 + 12) % 12; let deg = 0, best = 99;
    key.scale.forEach((s, i) => { const d = Math.abs(s - rel); if (d < best) { best = d; deg = i; } });
    const oct = Math.floor((m - key.tonic - rel) / 12) * 12, fix = rel - key.scale[deg];
    let d = deg + steps, o = 0; while (d < 0) { d += 7; o -= 12; } while (d > 6) { d -= 7; o += 12; }
    return key.tonic + oct + o + key.scale[d] + fix * 0;
  }
  // pick a written variation: from the form, by intensity, or at random but not the same as last time
  function pickVar(n, f, i, rng, last) { if (n <= 1) return 0; if (f.v != null) return Math.min(n - 1, f.v); if (f.pick === 'intensity') return Math.max(0, Math.min(n - 1, i - 1)); let v = Math.floor(rng() * n); if (v === last) v = (v + 1) % n; return v; }

  // everything every layer plays in one bar: [{ layer, t, len, m | ms | d, vel, cut, acc, glide, roll }] in ticks
  function bar(th, P, rng) {
    const S = th.sections[P.sec], k = P.bar, BL = th.barLen, out = [];
    const sOf = name => S.raw[name] != null ? S.raw[name] : th.parts[name];
    for (const [name, L] of Object.entries(th.layers)) {
      const g = P.mixNow[name] || 0; if (g <= 0.001 && (P.mixWas[name] || 0) <= 0.001) continue;   // silent layers make no notes
      const push = e => out.push({ layer: name, vel: 0.8, ...e });
      if (L.kind === 'line') {
        const src = L.src || name, vars = S.lines[src]; if (!vars) continue;
        const vi = P.vars[src] ?? 0, evs = (vars[vi] || vars[0])[k] || [];
        for (const e of evs) push({ t: e.t, len: e.len, m: e.m + 12 * (L.oct || 0), vel: e.acc ? 1 : 0.78 + (e.t % th.tpb === 0 ? 0.08 : 0), cut: e.cut, acc: e.acc, glide: e.glide });
      } else if (L.kind === 'harm') {
        const vars = S.lines[L.of]; if (!vars) continue;
        const vi = P.vars[L.of] ?? 0, evs = (vars[vi] || vars[0])[k] || [];
        for (const e of evs) push({ t: e.t, len: e.len, m: stepIn(th.key0, e.m, L.steps) + 12 * (L.oct || 0), vel: 0.7 });
      } else if (L.kind === 'arp' || L.kind === 'bass' || L.kind === 'strum' || L.kind === 'stab') {
        let p = sOf(name); if (p == null) continue;
        if (Array.isArray(p)) p = p[Math.floor(k / 4) % p.length];
        const toks = pat(p), step = BL / toks.length;
        let lastE = null, lastCh = null;
        toks.forEach((tok, i) => {
          const t = i * step, C = chordAt(S, k, t), ch = C.ch, changed = lastCh && lastCh !== C; lastCh = C;
          if (tok === '-') { if (changed && L.follow && L.kind === 'bass') { lastE = { t, len: step, m: 12 * ((L.oct ?? 2) + 1) + ch.bass, vel: 0.7 }; push(lastE); } else if (lastE) lastE.len += step; return; }
          if (tok === '.') { lastE = null; return; }
          const acc = tok.startsWith('^'); const tk = acc ? tok.slice(1) : tok;
          const vel = (acc ? 1 : 0.72) + (t % th.tpb === 0 ? 0.08 : 0) + (t === 0 ? 0.06 : 0);
          if (L.kind === 'arp') { const tones = arpTones(ch, L.oct ?? 3); lastE = { t, len: step, m: tones[Math.min(+tk, tones.length - 1)], vel }; push(lastE); return; }
          if (L.kind === 'bass') {
            const root = 12 * ((L.oct ?? 2) + 1) + ch.bass;
            let m = root;
            if (tk === 'F' && !(changed && t === C.t)) m = root + 7 > 12 * ((L.oct ?? 2) + 1) + 11 ? root - 5 : root + 7;
            else if (tk === 'O') m = root + 12;
            else if (tk === 'A') { const nb = P.nextChord ? 12 * ((L.oct ?? 2) + 1) + P.nextChord.bass : root; m = stepIn(th.key0, nb, nb > root ? -1 : 1); }
            lastE = { t, len: step, m, vel }; push(lastE); return;
          }
          const lo = (L.range || [55, 74])[0], hi = (L.range || [55, 74])[1];
          if (tk === 'B' || tk === 'F') { const root = 12 * 4 + ch.bass; lastE = { t, len: step, m: tk === 'F' ? (root + 7 > 59 ? root - 5 : root + 7) : root, vel: vel * 0.9 }; push(lastE); return; }
          P.voice[name] = voice(ch, P.voice[name], L.voices || (L.kind === 'stab' ? 3 : 4), lo, hi);
          lastE = { t, len: step, ms: P.voice[name], vel: tk === 'c' || tk === 'x' ? vel * 0.6 : vel, roll: tk === 'c' ? -1 : 1, chord: true }; push(lastE);
        });
      } else if (L.kind === 'pad') {
        const cs = S.chords[k];
        cs.forEach((C, ci) => {
          // held across the bar line: one long note instead of striking the same chord again
          if (ci === 0 && k > 0 && P.carry[name] === C.ch.sym) return;
          let len = C.len, bb = k, cc = ci;
          for (;;) { cc++; if (cc >= S.chords[bb].length) { bb++; cc = 0; } if (bb >= S.n || S.chords[bb][cc].ch.sym !== C.ch.sym) break; len += S.chords[bb][cc].len; }
          const lo = (L.range || [52, 76])[0], hi = (L.range || [52, 76])[1];
          P.voice[name] = voice(C.ch, P.voice[name], L.voices || 4, lo, hi);
          push({ t: C.t, len, ms: P.voice[name], vel: 0.8, chord: true, pad: true, cut0: S.raw.padCut ? S.raw.padCut[k] : null });
        });
        const lastC = cs[cs.length - 1]; P.carry[name] = k + 1 < S.n && S.chords[k + 1][0].ch.sym === lastC.ch.sym ? lastC.ch.sym : null;
      } else if (L.kind === 'drum') {
        const D = sOf(name); if (!D) continue;
        const last = k === S.n - 1, set = last && D.fill && rng() < 0.8 ? D.fill : (k % 2 && D.b) ? D.b : D.a;
        for (const line of set) {
          const toks = pat(line), step = BL / toks.length;
          toks.forEach((tok, i) => { if (tok === '.' || tok === '-') return; push({ t: i * step, len: step, d: tok, vel: /[A-Z]/.test(tok) ? 1 : 0.6 }); });
        }
      } else if (L.kind === 'drip') {
        const [lo, hi] = L.range || [76, 93];
        for (let t = 0; t < BL; t += 0.5) {
          if (rng() > (L.density || 0.08)) continue;
          const ch = chordAt(S, k, t).ch, pool = []; for (let m = lo; m <= hi; m++) if (ch.pcs.includes(m % 12)) pool.push(m);
          push({ t: t + rng() * 0.2, len: 1, m: pool[Math.floor(rng() * pool.length)], vel: 0.4 + rng() * 0.5 });
        }
      }
    }
    return out;
  }
  return { compile, bar, chordOf, parseLine, arpTones, voice, stepIn, pickVar, chordAt, keyOf };
})();
