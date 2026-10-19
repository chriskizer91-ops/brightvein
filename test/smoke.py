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
    pg.goto('file://' + ROOT + '/dist/test.html', timeout=120000)
    pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden', timeout=60000)
    r = pg.evaluate('''(() => { const B = __bv; B.begin(true);
      for (const t of ['yard', 'yard', 'garden', 'shop']) B.trayPick(t);
      B.exitBuild(); B.simulate(240, 0.1);
      return { day: B.GAME.day, people: B.GAME.villagers.length, shards: Math.round(B.GAME.shards), nights: B.GAME.nights, buildings: Object.keys(B.TOWN.b).length }; })()''')
    check('a day and a night on the claim', r['day'] >= 2 and r['nights'] >= 1, json.dumps(r))

    # the story: the prologue opened when the claim started, and closes after the first night; the settlers came off
    # the roll, so each has a portrait to match their sprite
    pg.wait_for_timeout(1500)
    r = pg.evaluate('''(async () => { const B = __bv, out = { ch0: B.STORY.ch, shown: !!B.STORY.shown };
      for (let i = 0; i < 40 && B.STORY.ch === 0; i++) { while (B.STORY.shown) B.talkNext(); await new Promise(r => setTimeout(r, 700)); }
      out.ch = B.STORY.ch; out.title = B.CHAPTERS[B.STORY.ch].title;
      out.rolled = B.GAME.villagers.filter(v => v.d.portrait).length; out.people = B.GAME.villagers.length;
      return out; })()''')
    check('the prologue played and chapter 1 began', r['ch'] >= 1, json.dumps(r))
    check('settlers come off the roll with a portrait each', r['rolled'] >= 4, json.dumps(r))

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
    # the dig: the upper Ore Face a new claim starts with, ore up the lift, a room dug and staffed, two merged, an
    # upgrade, a cave-in dug clear, Wildlight out of the deep seam, and a claim from before the dig loaded
    r = pg.evaluate('''(() => { const B = __bv, out = {}, F = B.roomAt(0, 9);
      B.DIG.incT = 1e9; for (const R of B.DIG.rooms) if (R.inc) R.inc = null;   // no trouble but what's asked for
      out.start = !!F && F.kind === 'face' && F.w === 2 && B.workersOf(F.id).length >= 1;
      const up0 = B.DIG.oreUp; B.simulate(40, 0.1); out.oreUp = Math.round((B.DIG.oreUp - up0) * 10) / 10;
      B.GAME.shards = 3000;
      const d = B.digOrder(1, 9, 'face'); out.ordered = !!d; out.diggers = d ? B.workersOf(d.id).length : 0;
      for (let i = 0; i < 40 && B.DIG.digs.includes(d); i++) B.simulate(10, 0.1);
      const R = B.roomAt(1, 9); out.dug = !!R && R.kind === 'face';
      const v = B.GAME.villagers.find(v => !v.d.exp && !v.d.study && v.where !== 'ship' && v.where !== 'mast' && !(v.d.job && /^[md]:/.test(v.d.job.bid)));
      if (R && v) B.assignJob(v, R.id);
      for (let i = 0; i < 12 && R && !(R.out > 0); i++) B.simulate(10, 0.1);
      out.staffedOut = R ? Math.round(R.out * 1000) / 1000 : 0; out.who = v && [v.d.name, v.where, v.plan.map(s => s.type).join(',')];
      const d2 = B.digOrder(1, 8, 'face'); if (d2) { d2.done = d2.work; B.digTick(0.1); }
      const M = B.roomAt(1, 9); out.merged = !!M && M === B.roomAt(1, 8) && M.w === 2;
      out.upgraded = B.digUpgrade(M) && M.lv === 2;
      const C = B.roomAt(0, 9); B.digIncident(C, 'cave'); out.cave = !!C.inc;
      for (let i = 0; i < 30 && C.inc; i++) B.simulate(5, 0.1); out.caveCleared = !C.inc;
      B.digSetHead(2); const S = B.roomAt(5, 9); out.seam = !!S && S.kind === 'seam';
      for (const p of B.GAME.villagers.filter(p => !p.d.exp).slice(0, 3)) B.assignJob(p, S.id);
      B.simulate(60, 0.1);
      out.breach = B.digIncident(S, 'wild'); out.wild = B.WL.list.filter(f => f.mine === S && !f.dead).length;
      for (let i = 0; i < 12 && S.inc; i++) B.simulate(5, 0.1); out.breachOver = !S.inc;
      return out; })()''')
    check('a new claim starts with the upper Ore Face, staffed', r['start'], json.dumps(r))
    check('ore comes up in the lift cage', r['oreUp'] > 2)
    check('dig a room: a crew digs it out', r['ordered'] and r['diggers'] >= 1 and r['dug'])
    check('staff it, and it digs ore', r['staffedOut'] > 0)
    check('two of a kind side by side merge', r['merged'] and r['upgraded'])
    check('a cave-in, dug clear by the crew', r['cave'] and r['caveCleared'])
    check('Wildlight out of the deep seam, fought off or gone', r['seam'] and r['breach'] and r['wild'] >= 2 and r['breachOver'])
    # a claim saved before the dig, with the deep seam open: its miners keep their places in the matching rooms
    pg.evaluate('''(() => { const B = __bv; B.saveGame(); const s = JSON.parse(localStorage.getItem('brightvein-keep-v1'));
      delete s.dig; for (const b of s.buildings) if (b.type === 'head') b.level = 2;
      const ps = s.people.filter(p => !p.exp); ps[0].job = { bid: 'head', slot: 1 }; ps[1].job = { bid: 'head', slot: 5 }; ps[0].name = 'Upper Test'; ps[1].name = 'Lower Test';
      const set = Storage.prototype.setItem; localStorage.setItem('brightvein-keep-v1', JSON.stringify(s));
      Storage.prototype.setItem = function (k, v) { if (k === 'brightvein-keep-v1') return; return set.call(this, k, v); }; })()''')
    pg.goto('file://' + ROOT + '/dist/test.html', wait_until='domcontentloaded', timeout=400000)
    pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden', timeout=400000)
    r = pg.evaluate('''(() => { const B = __bv; B.begin(false); const job = n => { const v = B.GAME.villagers.find(v => v.d.name === n); return v && v.d.job && v.d.job.bid; };
      return { rooms: B.DIG.rooms.map(R => R.id + ' ' + R.kind + ' ' + R.w), upper: job('Upper Test'), lower: job('Lower Test') }; })()''')
    check('an old save loads: the galleries are rooms, the miners keep their places', 'm:0.8 face 2' in r['rooms'] and 'm:2.8 face 2' in r['rooms'] and 'm:5.8 seam 2' in r['rooms'] and r['upper'] == 'm:0.8' and r['lower'] == 'm:2.8', json.dumps(r))
    extra = os.environ.get('SMOKE_EXTRA')
    if extra: print(pg.evaluate(extra))
    b.close()
for e in errors: print('  -', e)
print('all good' if not errors else f'{len(errors)} problem(s)')
sys.exit(1 if errors else 0)
