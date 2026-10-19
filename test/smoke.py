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

    # Odile's bench and the modules: salvage gives materials, an overhaul raises damage, a cell fits, and a module
    # fitted to a sunning yard raises its charge rate (bench.js, fittings.js)
    r = pg.evaluate('''(() => { const B = __bv, T = B.BENCH_T, G = B.GAME, out = {};
      const mk = (base, rarity) => B.LOOT.makeGear({ base, rarity, ilvl: 3 });
      const junk = [mk('pick', 'salvage'), mk('duster', 'tuned'), mk('spanner', 'calibrated')]; for (const it of junk) G.stash.unshift(it);
      const m0 = G.mats.brass + G.mats.glass; out.salvage = T.benchSalvage(junk); B.simulate(10, 0.1); out.mats = G.mats.brass + G.mats.glass - m0;
      const lance = mk('earthing-lance', 'tooled'); G.stash.unshift(lance); G.shards += 500;
      out.dps = [T.dpsOf(lance, 7, 'flarehound')]; out.oh = T.benchOverhaul(lance); B.simulate(10, 0.1); out.dps.push(T.dpsOf(lance, 7, 'flarehound')); out.ohLevel = lance.overhaul;
      const rifle = mk('wind-rifle', 'calibrated'); G.stash.unshift(rifle); G.cells.smoke = (G.cells.smoke || 0) + 1;
      out.cell = T.benchCell(rifle, 0, 'smoke'); B.simulate(6, 0.1); out.cells = rifle.cells;
      const yard = Object.values(B.TOWN.b).find(b => b.type === 'yard' && b.level > 0), mod = G.stash.find(it => it.base === 'parabolic');
      out.rate = [T.yardRate(yard)]; out.boost = [T.yardBoost(yard)]; out.fit = T.fitModule(mod, yard, 0); out.rate.push(T.yardRate(yard)); out.boost.push(T.yardBoost(yard));
      out.shown = !!yard.modProps && yard.modProps.children.length > 0;
      B.saveGame(); const s = JSON.parse(localStorage.getItem('brightvein-keep-v1')); out.saved = !!s.workshop && s.workshop.sockets[yard.id][0].base === 'parabolic';
      return out; })()''')
    check('salvage at the bench gives materials', r['salvage'] and r['mats'] >= 4, json.dumps(r))
    check('an overhaul raises damage', r['oh'] and r['ohLevel'] == 1 and r['dps'][1] > r['dps'][0])
    check('a cell fits', r['cell'] and r['cells'] == ['smoke'])
    check('a module fitted to a yard raises its charge rate, shows on the yard and is saved', r['fit'] and r['boost'][1] > r['boost'][0] * 1.05 and (r['rate'][1] > r['rate'][0] * 1.05 or r['rate'][0] == 0) and r['shown'] and r['saved'])

    # the story: the prologue opened when the claim started, and closes after the first night; the settlers came off
    # the roll, so each has a portrait to match their sprite
    pg.wait_for_timeout(1500)
    r = pg.evaluate('''(async () => { const B = __bv, out = { ch0: B.STORY.ch, shown: !!B.STORY.shown };
      const until = Date.now() + 180000;  // by the clock, not a count of tries: a loaded machine draws few frames
      while (Date.now() < until && B.STORY.ch === 0) { while (B.STORY.shown) B.talkNext(); await new Promise(r => setTimeout(r, 700)); }
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
    pg.wait_for_function('BV_AUDIO.AUDIO.status().theme === "skies"', timeout=30000)
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
        if (g.waves.state === 'fight' && !out.fightWant) out.fightWant = BV_AUDIO.MUSIC.want();
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
    check('the music sails with her, and a fight brings in the drums', r.get('fightWant', {}).get('theme') == 'skies' and r['fightWant'].get('i') == 2, json.dumps(r.get('fightWant')))
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
    r = pg.evaluate('''(async () => { const B = __bv, A = BV_AUDIO.AUDIO, out = { before: A.status().theme };
      B.GAME.t = 0.8;
      for (let i = 0; i < 40 && A.status().theme !== 'night'; i++) { while (B.STORY.shown) B.talkNext(); B.GAME.t = 0.8; B.applyTimeOfDay(0.8, 0); await new Promise(r => setTimeout(r, 400)); }
      out.night = A.status().theme; out.want = BV_AUDIO.MUSIC.want().theme;
      B.simulate(60); await new Promise(r => setTimeout(r, 4000));
      const s = A.status(); out.voices = s.voices; out.persist = s.persist; out.state = s.state; out.dropped = s.dropped;
      return out; })()''')
    check('the music turns to the night watch at night', r['night'] == 'night', json.dumps(r))
    check("a minute of play doesn't pile up sounds", r['state'] == 'running' and r['voices'] < 72 and r['persist'] < 200, json.dumps(r))
    extra = os.environ.get('SMOKE_EXTRA')
    if extra: print(pg.evaluate(extra))
    # a claim saved before Odile's bench and the module sockets: no workshop in it, and only gear in the stash
    old = pg.evaluate('''(() => { __bv.saveGame(); const s = JSON.parse(localStorage.getItem('brightvein-keep-v1')); delete s.workshop;
      s.stash = s.stash.filter(it => it.type === 'gear' || it.type === 'relic');
      s.stash.unshift({ uid: 'oldgear1', type: 'gear', base: 'pick', slot: 'hand', kind: 'pick', rarity: 'tuned', ilvl: 2, name: 'Tuned Prospector’s Pick', aspect: 'steam', traits: [], cells: [], overhaul: 0, retunes: 0, from: 'a module, before modules were fitted' });
      for (const it of s.stash) { delete it.n; delete it.day; }
      return JSON.stringify(s); })()''')
    old_n = len(json.loads(old)['stash'])
    pg.evaluate('__bv.renderer.setAnimationLoop(null)'); pg.close()   # the next page loads faster on its own
    pg2 = b.new_page(viewport={'width': 480, 'height': 360})
    pg2.add_init_script('delete window.AudioContext; delete window.webkitAudioContext; delete window.OfflineAudioContext; delete window.webkitOfflineAudioContext;')
    pg2.add_init_script('localStorage.setItem("brightvein-keep-v1", ' + json.dumps(old) + ');')
    quiet = []
    pg2.on('pageerror', lambda e: quiet.append(str(e)))
    pg2.route('**/fonts.g*/**', lambda r: r.fulfill(body='', content_type='text/css'))
    pg2.goto('file://' + ROOT + '/dist/test.html', timeout=300000)
    pg2.wait_for_function('window.__bv && document.querySelector("#loading").hidden', timeout=240000)
    r = pg2.evaluate('''(async () => { const B = __bv, A = BV_AUDIO.AUDIO; B.begin(false); B.exitBuild(); B.simulate(30, 0.1);
      const old = { stash: B.GAME.stash.length, pick: B.GAME.stash.some(it => it.uid === 'oldgear1'), sockets: typeof B.GAME.sockets === 'object', bench: !B.GAME.bench.job };
      B.UI.tab = 'stash'; B.UI.open('roster'); B.UI.open('bench', { tab: 'salvage' }); B.UI.close();
      for (const k of A.names()) A.play(k, { x: 0, y: 0, z: 0 }); A.loot('sunforged'); A.rain(0.5); A.ambience(); A.vol('music', 0.5);
      document.getElementById('b-menu').click(); document.querySelector('#mb-list .mb-play').click(); document.getElementById('menu-close').click();
      return { old, missing: A.missing, status: A.status().state, render: await A.render({ theme: 'day', seconds: 1 }) }; })()''')
    check('a claim saved before the bench still loads, stash and all', r['old']['pick'] and r['old']['stash'] >= old_n and r['old']['sockets'] and not quiet, json.dumps(r['old']) + f' saved {old_n}')
    check('with no sound in the browser, nothing breaks', not quiet and r['missing'] and r['render'] is None, json.dumps(r) + ' ' + '; '.join(quiet))
    pg2.close()
    b.close()
for e in errors: print('  -', e)
print('all good' if not errors else f'{len(errors)} problem(s)')
sys.exit(1 if errors else 0)
