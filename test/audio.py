# audio.py: renders Brightvein's music and sounds offline in headless Chromium (the game's own code, through an
# OfflineAudioContext) and measures them. Must end with "all good".
#   python3 test/audio.py            every theme, effect and ambience: not silent, never clipping, no NaN, levels in line
#   python3 test/audio.py --wav      also saves a WAV of each to shots/audio/ to listen to
#   python3 test/audio.py day night  only these
import sys, os, json, base64, math, struct
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
WAV = '--wav' in sys.argv
OUT = os.path.join(ROOT, 'shots', 'audio')
errors = []
def check(name, ok, detail=''):
    print(('ok   ' if ok else 'FAIL ') + name + (f'  {detail}' if detail else ''))
    if not ok: errors.append(name)

# (theme, intensity, seconds, file name); cues are short
THEMES = [('title', 0, 30, 'title'), ('day', 0, 30, 'day'), ('dusk', 0, 26, 'dusk'), ('night', 0, 24, 'night-quiet'), ('night', 1, 24, 'night-1'),
          ('night', 3, 24, 'night-3'), ('dawn', 0, 22, 'dawn'), ('letter', 0, 34, 'letter'), ('tallow', 0, 36, 'tallow'), ('skies', 1, 26, 'skies'),
          ('skies', 2, 26, 'skies-battle'), ('scene', 0, 26, 'scene'), ('flourish', 0, 10, 'flourish'), ('victory', 0, 11, 'victory'), ('lament', 0, 11, 'lament'),
          ('faire', 0, 26, 'faire'), ('keep', 0, 26, 'keep'), ('mine', 0, 30, 'mine')]
SFX = ['tap', 'open', 'lift', 'place', 'build', 'built', 'upgraded', 'levelup', 'statup', 'chime', 'goal', 'zap', 'flare', 'volley', 'thunk', 'cannon',
       'cannonfar', 'hit', 'hullhit', 'raiderhit', 'poof', 'crack', 'wallhit', 'snuff', 'jumperdown', 'raiderdown', 'sunk', 'tower', 'horn', 'warhorn',
       'bell', 'alarm', 'bossroar', 'dig', 'rockfall', 'cart', 'thunder', 'raidlost', 'pickup', 'sail']
LOOT = ['salvage', 'tuned', 'signed', 'masterwork', 'guild', 'sunforged']
AMB = [('day', {'out': True, 'day': 1}), ('night', {'out': True, 'night': 1, 'hum': 0.7}), ('mine', {'mine': True, 'miners': True}),
       ('keep', {'keep': True}), ('skies', {'sky': True, 'speed': 40}), ('rain', {'out': True, 'day': 1, 'rain': 0.8})]
if args == ['effects']: THEMES = []
elif args:
    THEMES = [t for t in THEMES if t[0] in args or t[3] in args]
    SFX = [s for s in SFX if s in args] if any(a in SFX for a in args) else ([] if THEMES else SFX)

def samples(wav, t0=0, t1=None):
    sr = struct.unpack('<I', wav[24:28])[0]; n = (len(wav) - 44) // 4
    a, b = int(t0 * sr), min(n, int((t1 or n / sr) * sr))
    return sr, [struct.unpack_from('<h', wav, 44 + i * 4)[0] / 32768 for i in range(a, b)]
def pitch(wav, t0, t1):
    # the fundamental, by autocorrelation (finding the lag where the wave best matches itself), refined between samples
    sr, x = samples(wav, t0, t1)
    x = x[:8192]; n = len(x); m = sum(x) / n; x = [v - m for v in x]
    lo, hi = int(sr / 1200), int(sr / 70)
    def ac(L): return sum(x[i] * x[i + L] for i in range(0, n - L, 2))
    vals = {L: ac(L) for L in range(lo, hi)}
    best = max(vals, key=vals.get)
    # the first strong peak, not a multiple of it
    for L in range(lo, hi):
        if vals[L] > 0.85 * vals[best] and vals.get(L - 1, -1e9) < vals[L] >= vals.get(L + 1, -1e9): best = L; break
    a, b, c = vals.get(best - 1, 0), vals[best], vals.get(best + 1, 0)
    d = (a - c) / (2 * (a - 2 * b + c)) if (a - 2 * b + c) else 0
    return sr / (best + d)
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]   # Krumhansl's key profiles
MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
def key_of(wav):
    # which key it's in: how much of each of the 12 notes sounds, matched to the major and minor key profiles. Two ways
    # of hearing it: every frequency as it is (which hears low brass a fifth high, from its harmonics), and only the
    # spectrum's peaks, each credited to the lowest sounding note it could be a harmonic of. Returns both best guesses.
    try: import numpy as np
    except ImportError: return None
    sr = struct.unpack('<I', wav[24:28])[0]
    x = np.frombuffer(wav[44:], dtype='<i2').reshape(-1, 2).mean(axis=1) / 32768
    N = 8192; win = np.hanning(N); plain = np.zeros(12); peaks = np.zeros(12)
    f = np.fft.rfftfreq(N, 1 / sr); ok = (f > 50) & (f < 2000)
    pcs = (np.round(12 * np.log2(np.maximum(f, 1) / 440)) + 9) % 12
    for s0 in range(0, len(x) - N, N // 2):
        mag = np.abs(np.fft.rfft(x[s0:s0 + N] * win))
        for k in range(12): plain[k] += np.sqrt(mag[ok & (pcs == k)]).sum()
        top = mag[ok].max()
        pk = [i for i in range(2, len(mag) - 2) if ok[i] and mag[i] > mag[i - 1] and mag[i] >= mag[i + 1] and mag[i] > 0.02 * top]
        for i in pk:
            owner = f[i]
            for h in (2, 3, 4, 5, 6):
                g = f[i] / h
                if g < 50: break
                if any(abs(1200 * np.log2(f[j] / g)) < 35 for j in pk if f[j] < f[i]): owner = g
            peaks[int(round(12 * np.log2(owner / 440)) + 9) % 12] += np.sqrt(mag[i])
    def best(c): return max((np.corrcoef(c, np.roll(prof, t))[0, 1], NAMES[t] + suf) for t in range(12) for prof, suf in ((MAJ, ''), (MIN, 'm')))
    return best(plain), best(peaks)
def save(name, b64):
    if not WAV or not b64: return
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + '.wav'), 'wb') as f: f.write(base64.b64decode(b64))

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 640, 'height': 400})
    pg.on('pageerror', lambda e: errors.append('page error: ' + str(e)) or print('PAGE ERROR', e))
    pg.on('console', lambda m: print('console:', m.text[:300]) if m.type in ('error', 'warning') else None)
    pg.route('**/fonts.g*/**', lambda r: r.fulfill(body='', content_type='text/css'))
    pg.set_default_timeout(240000)
    pg.goto('file://' + ROOT + '/dist/test.html', timeout=180000)
    pg.wait_for_function('window.__bv && window.BV_AUDIO && document.querySelector("#loading").hidden', timeout=180000)
    pg.evaluate('__bv.renderer.setAnimationLoop(null)')   # stop drawing: the audio renders on the CPU too
    levels = {}
    keys = pg.evaluate('Object.fromEntries(Object.entries(BV_AUDIO.SCORE).map(([k, t]) => [k, t.key || BV_AUDIO.SCORE[t.base].key]))')
    for theme, i, secs, name in THEMES:
        r = pg.evaluate(f'BV_AUDIO.AUDIO.render({{ theme: "{theme}", i: {i}, seconds: {secs}, wav: true }})')
        w = r.pop('wav', None); save(name, w)
        levels[name] = r
        once = theme in ('dawn', 'flourish', 'victory', 'lament')
        ok = r['nan'] == 0 and r['peak'] < 0.98 and r['peak'] > 0.05 and (once or r['quietSecs'] <= 3)
        check(f'theme {name}', ok, json.dumps(r))
        # it sounds in the key it's written in (the cues are too short to say: they go from one key to another)
        if not once:
            k = key_of(base64.b64decode(w))
            if k: check(f'theme {name} sounds in {keys[theme]}', keys[theme] in (k[0][1], k[1][1]), f'heard {k[0][1]} ({k[0][0]:.2f}) and {k[1][1]} ({k[1][0]:.2f})')
    # journeys: the score following the game from theme to theme, to hear (and check) the changes between them. The
    # music must never drop out at a change, nor jump suddenly louder.
    JOURNEYS = [('journey-day-and-night', 98, [[0, 'title'], [12, 'day'], [30, 'dusk'], [44, 'night', 0], [56, 'night', 1], [66, 'night', 3], [78, 'dawn', 0, True], [79, 'day']]),
                ('journey-around-the-claim', 112, [[0, 'keep'], [12, 'mine'], [24, 'scene', 0, True], [34, 'letter', 0, True], [46, 'tallow', 0, True], [60, 'skies', 1, True], [74, 'skies', 2], [88, 'skies', 0], [94, 'faire']])]
    if not args:
        for name, secs, plan in JOURNEYS:
            r = pg.evaluate(f'BV_AUDIO.AUDIO.render({{ plan: {json.dumps(plan)}, seconds: {secs}, sr: 32000, tenths: true, wav: {str(WAV).lower()} }})')
            save(name, r.pop('wav', None)); t = r.pop('tenths')
            gaps = [i / 10 for i, v in enumerate(t[5:-5], 5) if v < -55]
            jump = max(t[i] - max(t[i - 3:i]) for i in range(3, len(t)))
            check(f'{name}: no drop-outs or sudden jumps at the changes', r['nan'] == 0 and r['peak'] < 0.98 and not gaps and jump < 18, json.dumps({**r, 'gaps': gaps[:5], 'biggestJumpDb': round(jump, 1)}))
    if THEMES:
        loops =[levels[n]['rmsDb'] for _, _, _, n in THEMES if n not in ('dawn', 'flourish', 'victory', 'lament', 'night-quiet', 'mine', 'scene', 'letter', 'keep')]
        if loops:
            spread = max(loops) - min(loops)
            check('the themes sit within a few dB of each other', spread <= 6, f'{min(loops)} to {max(loops)} dB RMS')
    if SFX:
        peaks = {}
        for s in SFX:
            r = pg.evaluate(f'BV_AUDIO.AUDIO.render({{ sfx: [["{s}", 0.05]], seconds: 5, wav: {str(WAV).lower()} }})')
            save('sfx-' + s, r.pop('wav', None)); peaks[s] = r['peakDb']
            check(f'effect {s}', r['nan'] == 0 and 0.02 < r['peak'] < 0.98, json.dumps({k: r[k] for k in ('peakDb', 'rmsDb', 'loudestSecDb', 'voicesMax')}))
        for rr in LOOT:
            r = pg.evaluate(f'BV_AUDIO.AUDIO.render({{ loot: [["{rr}", 0.05]], seconds: 5, wav: {str(WAV).lower()} }})')
            save('loot-' + rr, r.pop('wav', None))
            check(f'loot {rr}', r['nan'] == 0 and 0.02 < r['peak'] < 0.98, json.dumps({k: r[k] for k in ('peakDb', 'rmsDb', 'loudestSecDb')}))
        for name, st in AMB:
            r = pg.evaluate(f'BV_AUDIO.AUDIO.render({{ amb: {json.dumps(st)}, seconds: 16, wav: {str(WAV).lower()} }})')
            save('amb-' + name, r.pop('wav', None))
            check(f'ambience {name}', r['nan'] == 0 and 0.002 < r['peak'] < 0.98, json.dumps({k: r[k] for k in ('peakDb', 'rmsDb')}))
        # everything at once: the loudest theme, a pile of effects and the busiest ambience, through the limiter
        r = pg.evaluate('BV_AUDIO.AUDIO.render({ theme: "skies", i: 2, seconds: 8, sfx: [["cannon", 0.5], ["cannon", 0.52], ["raiderdown", 0.6], ["hullhit", 0.7], ["thunder", 1], ["jumperdown", 1.2], ["upgraded", 2]], loot: [["sunforged", 2.2]], amb: { sky: true, speed: 60, rain: 1 } })')
        check('everything at once never clips', r['nan'] == 0 and r['peak'] < 0.98, json.dumps(r))
        # every instrument plays in tune: one A (220 or 440 Hz) each, its pitch measured from the sound
        for inst, m in [('harp', 69), ('pluck', 69), ('pizz', 45), ('whistle', 81), ('flute', 69), ('box', 81), ('bowed', 45), ('brass', 57)]:
            r = pg.evaluate(f'BV_AUDIO.AUDIO.render({{ notes: [["{inst}", {m}, 0.02, 1.2]], seconds: 1.6, wav: true }})')
            f0 = pitch(base64.b64decode(r['wav']), 0.12, 0.9)
            want = 440 * 2 ** ((m - 69) / 12)
            cents = 1200 * math.log2(f0 / want) if f0 else 9999
            check(f'the {inst} is in tune', abs(cents) < 12, f'{f0:.1f} Hz for {want:.1f} Hz ({cents:+.1f} cents)')
        # phones: the Light setting plays every theme with fewer voices
        r = pg.evaluate('BV_AUDIO.AUDIO.render({ theme: "night", i: 3, seconds: 12, light: true })')
        check('the Light setting keeps under its voice cap', r['nan'] == 0 and r['voicesMax'] <= 36 + 24 and r['peak'] > 0.05, json.dumps(r))
    b.close()
if levels:
    print('\nlevels (dB):')
    for n, r in levels.items(): print(f'  {n:14s} rms {r["rmsDb"]:6.1f}   peak {r["peakDb"]:5.1f}   voices {r["voicesMax"]:3d}   dropped {r["dropped"]}')
for e in errors: print('  -', e)
print('all good' if not errors else f'{len(errors)} problem(s)')
sys.exit(1 if errors else 0)
