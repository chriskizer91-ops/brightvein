# smoke.py: plays Brightvein headless and checks nothing breaks. Must end with "all good".
#   python3 test/smoke.py
import sys, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors = []
def check(name, ok, detail=''):
    print(('ok   ' if ok else 'FAIL ') + name + (f'  {detail}' if detail else ''))
    if not ok: errors.append(name)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 960, 'height': 600})
    pg.on('pageerror', lambda e: errors.append('page error: ' + str(e)) or print('PAGE ERROR', e))
    pg.on('console', lambda m: print('console error:', m.text[:300]) if m.type == 'error' else None)
    pg.route('**/fonts.g*/**', lambda r: r.fulfill(body='', content_type='text/css'))
    pg.goto('file://' + ROOT + '/dist/test.html')
    pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden', timeout=60000)
    r = pg.evaluate('''(() => { const B = __bv; B.begin(true);
      for (const t of ['yard', 'yard', 'garden', 'shop']) B.trayPick(t);
      B.exitBuild(); B.simulate(240, 0.1);
      return { day: B.GAME.day, people: B.GAME.villagers.length, shards: Math.round(B.GAME.shards), nights: B.GAME.nights, buildings: Object.keys(B.TOWN.b).length }; })()''')
    check('a day and a night on the claim', r['day'] >= 2 and r['nights'] >= 1, json.dumps(r))

    # the skies: the ship moors at the Sky Dock, sets sail, beats a wave, sails on, sinks, and the crew bring half home
    pg.wait_for_function('__bv.DOCK.ship && __bv.DOCK.ship.root.parent', timeout=60000)
    check('a ship moored at the Sky Dock', pg.evaluate('__bv.DOCK.ship.recipe.id') == 'skiff')
    pg.evaluate('__bv.GAME.shards = 1000; __bv.openSky("voyage")')
    pg.wait_for_function('__bv.SKY.mode === "voyage"', timeout=120000)
    r = pg.evaluate('''(() => {
      const B = __bv, g = B.SKY, P = g.player, out = { t0: B.GAME.t, shards0: Math.round(B.GAME.shards) };
      g.wind.strength = 0;
      out.sailed = g.mode === 'voyage' && P.ship.recipe.id === 'skiff' && document.body.classList.contains('sky-on');
      let t = 0;
      while (t < 200 && g.waves.state !== 'choose') {
        const live = g.raiders.list.filter((r) => !r.f.down);
        let c = { sail: 0.6 };
        if (live[0]) {
          const T = P.pos.clone(); T.y += P.ship.recipe.length * 0.42 + 2; const look = live[0].f.pos.clone().sub(T).normalize();
          g.cam.pitch = Math.max(-0.35, -Math.asin(look.y)); const a = Math.atan2(look.x, look.z) - P.heading; g.cam.yaw = Math.atan2(Math.sin(a), Math.cos(a));
          c = { fire: true, turn: Math.max(-1, Math.min(1, -g.cam.yaw * 2)), climb: Math.max(-1, Math.min(1, (live[0].f.pos.y - P.pos.y) / 40)) };
        }
        g.step(0.25, c); t += 0.25;
      }
      out.wave1 = Math.round(t); out.choose = !document.getElementById('calm').hidden; out.won = Math.round(g.voyage.shards);
      document.getElementById('btn-sail-on').click(); g.step(5, {});
      out.wave2 = g.waves.state === 'fight' && g.waves.n === 1;
      P.hit('hull', 1e6); g.step(6, {});
      out.sunk = !document.getElementById('paused').hidden;
      out.half = Math.round(g.voyage.shards / 2);
      document.getElementById('btn-abandon').click();
      out.home = !g.on && !document.body.classList.contains('sky-on') && document.getElementById('sky').hidden;
      out.banked = Math.round(B.GAME.shards) - out.shards0; out.claimStill = B.GAME.t === out.t0;
      out.voyages = B.FLEET.data.voyages;
      return out; })()''')
    check('set sail from the Sky Dock', r['sailed'], json.dumps(r))
    check('wave 1 beaten, then sail on to wave 2', r['choose'] and r['won'] > 0 and r['wave2'])
    check('lost the ship, and the crew got her home with half', r['sunk'] and r['home'] and abs(r['banked'] - r['half']) <= 1)
    check("the claim's time stood still while she was away", r['claimStill'] and r['voyages'] == 1)
    pg.wait_for_function('__bv.DOCK.ship.root.parent === __bv.scene', timeout=20000)
    r = pg.evaluate('''(() => { const B = __bv; B.saveGame(); const s = JSON.parse(localStorage.getItem('brightvein-keep-v1'));
      return { saved: !!s.sky && s.sky.voyages === 1 && !('shards' in s.sky), moored: B.DOCK.ship.root.parent === B.scene }; })()''')
    check('the fleet is saved with the claim, and she is moored again', r['saved'] and r['moored'], json.dumps(r))

    # a raid on the jumpers' prospect camp: the guards come out (struck down here: shooting ships is checked above),
    # the gun tower is shot down with the guns locked on to it, the camp strikes its colours, and its crates come home
    src = open(os.path.join(ROOT, 'test', 'raid.py')).read()
    pg.evaluate(src.split("AUTOPILOT = '''")[1].split("'''")[0])
    pg.evaluate('__bv.openSky("port")')
    pg.wait_for_function('__bv.SKY.mode === "port"', timeout=60000)
    r = pg.evaluate('__raidPilot("camp", "skiff", 300)')
    check('raided the prospect camp and took it', r['state'] == 'taken', json.dumps({k: r[k] for k in ('t', 'state', 'downed', 'card')}))
    before = pg.evaluate('__bv.GAME.stash.length')
    pg.evaluate('document.getElementById("btn-go-port").click()')
    pg.wait_for_timeout(1200)
    r = pg.evaluate('({ stash: __bv.GAME.stash.length, won: __bv.FLEET.data.raids.camp.won, panel: __bv.UI.cur && __bv.UI.cur.kind })')
    check("the camp's crates opened at home", r['stash'] >= before + 2 and r['won'] == 1 and r['panel'] == 'haul', json.dumps(r))
    extra = os.environ.get('SMOKE_EXTRA')
    if extra: print(pg.evaluate(extra))
    b.close()
for e in errors: print('  -', e)
print('all good' if not errors else f'{len(errors)} problem(s)')
sys.exit(1 if errors else 0)
