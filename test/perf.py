# perf.py: grows a big claim headless and measures what a frame costs at each detail level, in each view.
#   python3 test/perf.py                 1280 x 800, as a desktop
#   python3 test/perf.py 390 844 3       a phone: 390 x 844 at three pixels to the point
# The claim: the Keep at level 3 with all five studies furnished and in use, 20-odd buildings, a deep dig of 16 rooms,
# 30 people, and a Bright Night with its boss up, in the rain. For each detail level (Light, Balanced, High) and each
# view (the town, the Keep, the mine) it draws a few frames as the game does (frame() in main.js, through the
# post-processing) and prints the draw calls, triangles and milliseconds per frame. Headless drawing is software
# (SwiftShader), so the milliseconds only compare one run with another; the draw calls are what a phone feels.
# It also times the first look into the Keep and the mine (the shaders they need, if they weren't warmed up).
import sys, os, json, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
H = int(sys.argv[2]) if len(sys.argv) > 2 else 800
DPR = float(sys.argv[3]) if len(sys.argv) > 3 else 1
FRAMES = int(os.environ.get('PERF_FRAMES', '6'))
GROW = '''(() => { const B = __bv, G = B.GAME, out = {};
  B.renderer.setAnimationLoop(null);   // the frames are drawn one at a time below
  B.begin(true); for (const t of ['yard', 'yard', 'garden', 'shop']) B.trayPick(t); B.exitBuild();
  G.shards = 1e5; G.food = 2000;
  const K = B.TOWN.b.keep; K.show(3);
  for (const [t, x, z] of [['yard', -20, 18], ['yard', 22, 16], ['lens', -30, -20], ['lens', 32, -18], ['lens', -34, 10], ['lens', 34, 12],
    ['ballista', 0, -36], ['ballista', -24, 26], ['garden', 20, -24], ['shop', -18, -28], ['rod', 6, 26], ['garden', -8, 30]]) B.addBuilding(t, null, null, 2, { hint: [x, z] });
  B.layoutChanged(true);
  const kinds = ['G', 'E', 'A', 'R', 'S']; for (let i = 0; i < 5; i++) G.rooms[i] = { type: kinds[i], level: 3 };
  B.digSetHead(3);
  const dig = [[0, 7, 'face'], [1, 9, 'pump'], [1, 8, 'face'], [1, 7, 'shore'], [2, 9, 'grotto'], [2, 8, 'grotto'], [2, 7, 'depot'], [3, 9, 'face'], [3, 8, 'lamp'],
    [3, 7, 'assay'], [4, 9, 'grotto'], [4, 8, 'pump'], [4, 7, 'face'], [5, 7, 'shore'], [0, 6, 'face'], [1, 6, 'depot']];
  for (const [r, c, k] of dig) B.digQuick(r, c, k, 2);
  while (G.villagers.length < 30) B.recruit();
  B.autoAssign(); B.buildNav();
  const free = G.villagers.filter(v => !v.d.exp && !v.d.hero);
  let n = 0; for (let i = 0; i < 5; i++) for (const v of free) { if (n >= 12) break; if (!v.d.study && B.startStudy(v, i, 'student')) { n++; if (B.roomStudents(i).length >= 2) break; } }
  B.simulate(20, 0.1);
  B.NIGHT.grudge = null; G.nights = 4; B.forceWeather('rain', 'rain');
  B.skipTo(0.62);
  for (let i = 0; i < 240 && !(B.WL.night && B.WL.night.boss); i++) B.simulate(1, 0.1);
  for (const T of B.TOASTS.live.slice()) T.el.remove(); B.TOASTS.live.length = 0; B.TOASTS.q.length = 0;
  while (B.STORY.shown) B.talkNext(); B.eventClose && B.eventClose();
  B.UI.close();
  out.buildings = Object.keys(B.TOWN.b).length; out.rooms = B.DIG.rooms.length; out.people = G.villagers.length; out.keep = K.level;
  out.studies = G.rooms.filter(r => r.type).length; out.students = G.villagers.filter(v => v.d.study).length;
  out.boss = !!(B.WL.night && B.WL.night.boss); out.rain = B.WEATHER.today; out.wild = B.WL.list.filter(f => !f.dead).length;
  let L = 0, C = 0; B.scene.traverse(o => { if (o.isPointLight) L++; if (o.castShadow && o.visible) C++; }); out.pointLights = L; out.shadowCasters = C;
  return out; })()'''
MEASURE = '''((n) => { const B = __bv, R = B.renderer, gl = R.getContext(), px = new Uint8Array(4), calls = [], tris = [], ms = [];
  R.info.autoReset = false;
  for (let i = 0; i < n; i++) {
    R.info.reset(); const t0 = performance.now(); B.frame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    ms.push(performance.now() - t0); calls.push(R.info.render.calls); tris.push(R.info.render.triangles);
  }
  R.info.autoReset = true;
  const avg = a => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
  return { calls: avg(calls), callsMin: Math.min(...calls), callsMax: Math.max(...calls), tris: avg(tris), ms: avg(ms), programs: R.info.programs.length }; })'''
FIRST = '''((mode) => { const B = __bv, R = B.renderer, gl = R.getContext(), px = new Uint8Array(4), p0 = R.info.programs.length;
  const t0 = performance.now(); B.setView(mode); if (B.VIEW.tween) B.VIEW.tween.t = 0.999; B.frame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { ms: Math.round(performance.now() - t0), newPrograms: R.info.programs.length - p0 }; })'''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=DPR)
    pg.set_default_timeout(900000)
    pg.on('pageerror', lambda e: print('PAGE ERROR', e))
    pg.route('**/fonts.g*/**', lambda r: r.fulfill(body='', content_type='text/css'))
    pg.add_init_script('localStorage.setItem("bv-quality", "light"); localStorage.setItem("bv-settings", JSON.stringify({ hints: false }));')
    t0 = time.time()
    pg.goto('file://' + ROOT + '/dist/test.html', timeout=900000)
    pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden', timeout=900000, polling=500)
    print(f'loaded in {time.time() - t0:.1f}s ({W}x{H} at {DPR}x)')
    print('claim:', json.dumps(pg.evaluate(GROW)))
    # the first look into the Keep and the mine on Light: the shaders they need, unless they were warmed up already
    pg.evaluate(MEASURE + '(2)')
    for mode in ('keep', 'mine'):
        print(f'first look into the {mode}:', json.dumps(pg.evaluate(FIRST + f'("{mode}")')))
        pg.evaluate('__bv.setView("town"); if (__bv.VIEW.tween) __bv.VIEW.tween.t = 0.999; __bv.frame()')
    rows = []
    for q in ('light', 'balanced', 'high'):
        pg.evaluate(f'__bv.QUALITY.level = "{q}"; __bv.applyQuality();')
        for mode in ('town', 'keep', 'mine'):
            pg.evaluate(f'__bv.setView("{mode}"); if (__bv.VIEW.tween) __bv.VIEW.tween.t = 0.999;')
            pg.evaluate(MEASURE + '(3)')   # settle, and compile anything new for this level
            r = pg.evaluate(MEASURE + f'({FRAMES})')
            rows.append((q, mode, r))
            print(f'{q:9} {mode:5} draws {r["calls"]:4} ({r["callsMin"]}-{r["callsMax"]})  tris {r["tris"]:8}  {r["ms"]:5} ms  programs {r["programs"]}', flush=True)
    b.close()
