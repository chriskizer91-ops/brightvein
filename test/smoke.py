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
    pg.goto('file://' + ROOT + '/dist/test.html', timeout=300000)
    pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden', timeout=300000)   # a loaded machine builds the claim slowly
    # the title screen comes up over the claim; with nothing saved there's nothing to continue, and a new claim begins
    r = pg.evaluate('''(() => { const B = __bv, T = document.getElementById('front');
      return { title: !T.hidden && B.TITLE.on, cont: document.getElementById('tt-continue').hidden, started: B.started, showcase: B.TITLE.showcase.length }; })()''')
    check('the title screen comes up, with no claim to continue yet', r['title'] and r['cont'] and not r['started'] and r['showcase'] > 0, json.dumps(r))
    r = pg.evaluate('''(() => { const B = __bv; B.begin(true);
      for (const t of ['yard', 'yard', 'garden', 'shop']) B.trayPick(t);
      B.exitBuild(); B.simulate(240, 0.1);
      return { day: B.GAME.day, people: B.GAME.villagers.length, shards: Math.round(B.GAME.shards), nights: B.GAME.nights, buildings: Object.keys(B.TOWN.b).length }; })()''')
    check('a day and a night on the claim', r['day'] >= 2 and r['nights'] >= 1, json.dumps(r))
    # drawing: everyone on the claim in one draw (crowd.js), the town's still pieces merged across its buildings
    # (townMerge in kit.js), and a tap on a building still finds it
    r = pg.evaluate('''(() => { const B = __bv, out = {}; B.UI.close(); while (B.STORY.shown) B.talkNext(); B.setView('town'); if (B.VIEW.tween) B.VIEW.tween.t = 0.999; B.frame();
      out.shown = B.GAME.villagers.filter(v => v.sprite.visible && v.sprite.parent).length; out.drawn = B.CROWD.meshes[0].geometry.instanceCount;
      out.layered = B.GAME.villagers.every(v => v.crowd == null || v.sprite.layers.mask === 8);
      out.merged = B.TMERGE.meshes.length; out.keepOwn = B.TOWN.b.keep.merged.every(m => m.layers.mask === 16);
      const K = B.TOWN.b.keep, cv = document.getElementById('view'); B.camera.updateMatrixWorld(); B.controls.enabled = false;   // a made-up tap has no real pointer for the camera's controls to hold
      for (const y of [8, 6, 4, 10]) {
        const p = K.worldPos(0, y, 0).project(B.camera), x = (p.x + 1) / 2 * innerWidth, yy = (1 - p.y) / 2 * innerHeight;
        cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: yy, bubbles: true })); cv.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: yy, bubbles: true }));
        out.picked = !!(B.UI.cur && B.UI.cur.kind === 'building' && B.UI.cur.ref === K); if (out.picked) break;
      }
      B.UI.close(); B.controls.enabled = true;
      return out; })()''')
    check("everyone drawn in one go, the town's pieces merged, and a tap still finds the Keep", r['shown'] > 0 and r['drawn'] == r['shown'] and r['layered'] and r['merged'] >= 8 and r['keepOwn'] and r['picked'], json.dumps(r))

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

    # a made weapon never fights worse than bare hands: the strongest person, bare-handed, against a Tooled and a
    # Calibrated wind rifle (an Agility weapon in a Grit hand), and a Tooled lance
    r = pg.evaluate('''(() => { const B = __bv, G = B.GAME, out = {};
      const v = [...G.villagers].filter(v => !v.d.exp).sort((a, b) => B.statOf(b, 'G') - B.statOf(a, 'G'))[0];
      const was = v.d.gear.hand; if (was) { delete v.d.gear.hand; v.gearCache = null; }
      out.who = v.d.name; out.grit = B.statOf(v, 'G'); out.bare = B.fightOf(v, 'flarehound').dps;
      for (const [base, rarity] of [['wind-rifle', 'tooled'], ['wind-rifle', 'calibrated'], ['earthing-lance', 'tooled'], ['flare-pistol', 'tuned']]) {
        const it = B.LOOT.makeGear({ base, rarity, ilvl: 3 }); G.stash.unshift(it); B.equip(v, it);
        out[base + ' ' + rarity] = Math.round(B.fightOf(v, 'flarehound').dps * 10) / 10;
        delete v.d.gear.hand; v.gearCache = null;
      }
      if (was) { v.d.gear.hand = was; v.gearCache = null; }
      return out; })()''')
    armed = [v for k, v in r.items() if k not in ('who', 'grit', 'bare')]
    check("bare fists don't out-hit a Tooled weapon or better", all(a > r['bare'] for a in armed), json.dumps(r))

    # saves: a claim carried off as a code comes back the same; a damaged code is refused in plain words; the three
    # claims are kept apart
    r = pg.evaluate('''(async () => { const B = __bv, out = {};
      const code = await B.exportCode(); out.len = code.length; out.head = code.slice(0, 5);
      const raw = localStorage.getItem('brightvein-keep-v1');   // the export saves the claim first: this is what it carried
      const back = await B.importCode(code); out.same = JSON.stringify(back) === raw;
      out.fields = ['t', 'ore', 'shards', 'food', 'nights', 'nextId', 'day'].filter(k => typeof back[k] !== 'number');   // every number the claim runs on is in it
      const bad = code.slice(0, 60) + (code[60] === 'A' ? 'B' : 'A') + code.slice(61);
      try { await B.importCode(bad); out.bad = 'accepted'; } catch (e) { out.bad = B.codeWhy(e); }
      try { await B.importCode('hello there'); out.junk = 'accepted'; } catch (e) { out.junk = B.codeWhy(e); }
      try { await B.importCode(code.slice(0, code.length - 30)); out.cut = 'accepted'; } catch (e) { out.cut = B.codeWhy(e); }
      const two = { ...back, day: back.day + 40, name: 'The second claim' }; B.slotWrite(2, two);
      B.GAME.day += 1; B.saveGame(); out.one = B.slotRead(1).day; out.two = B.slotRead(2).day; out.active = B.SLOTS.active;
      out.sum2 = B.slotSummary(2); B.GAME.day -= 1; B.saveGame(); B.slotClear(2); out.cleared = !B.slotRead(2) && !!B.slotRead(1);
      return out; })()''')
    check('an exported code imports to the same claim, with all its numbers', r['same'] and r['head'].startswith('BV1') and not r['fields'], json.dumps({k: r[k] for k in ('len', 'head', 'same', 'fields')}))
    check('a broken code is refused, with a plain reason', 'broken' in r['bad'] and 'Brightvein code' in r['junk'] and 'broken' in r['cut'], json.dumps({k: r[k] for k in ('bad', 'junk', 'cut')}))
    check('the three claims are kept apart', r['active'] == 1 and r['two'] == r['one'] + 39 and r['cleared'], json.dumps(r))

    # the story: the prologue opened when the claim started, and closes after the first night; the settlers came off
    # the roll, so each has a portrait to match their sprite
    # the first frame after a simulated night compiles a lot of shaders, which is slow in software: wait for it
    pg.wait_for_function('__bv.STORY.started', timeout=240000)
    r = pg.evaluate('''(async () => { const B = __bv, out = { ch0: B.STORY.ch, shown: !!B.STORY.shown };
      const until = Date.now() + 180000;  // by the clock, not a count of tries: a loaded machine draws few frames
      while (Date.now() < until && B.STORY.ch === 0) { while (B.STORY.shown) B.talkNext(); await new Promise(r => setTimeout(r, 700)); }
      out.ch = B.STORY.ch; out.title = B.CHAPTERS[B.STORY.ch].title;
      out.rolled = B.GAME.villagers.filter(v => v.d.portrait).length; out.people = B.GAME.villagers.length;
      return out; })()''')
    check('the prologue played and chapter 1 began', r['ch'] >= 1, json.dumps(r))
    check('settlers come off the roll with a portrait each', r['rolled'] >= 4, json.dumps(r))

    # toasts queue: no more than three on screen at once, the rest wait; while a card is up they hold, out of sight
    r = pg.evaluate('''(async () => { const B = __bv, out = {}; const box = document.getElementById('toasts');
      const clear = () => { while (B.STORY.shown) B.talkNext(); B.eventClose(); const d = document.getElementById('dawn'); if (d) d.hidden = true; };   // the first night's dawn report is still up
      clear();
      B.TOASTS.q.length = 0; for (const t of B.TOASTS.live.slice()) t.el.remove(); B.TOASTS.live.length = 0;
      for (let i = 0; i < 9; i++) B.toast('Test toast number ' + i);
      clear(); await new Promise(r => setTimeout(r, 350));
      out.shown = box.querySelectorAll('.toast:not(.out)').length; out.waiting = B.TOASTS.q.length; out.max = B.TOASTS.max();
      B.eventFire('courier'); await new Promise(r => setTimeout(r, 350));
      out.held = box.classList.contains('held') && getComputedStyle(box).visibility === 'hidden';
      B.eventClose(); clear(); await new Promise(r => setTimeout(r, 350)); out.back = !box.classList.contains('held') || !!B.STORY.shown;
      return out; })()''')
    check("toasts queue, never more than the cap at once, and hold while a card is up", 0 < r['shown'] <= r['max'] <= 3 and r['waiting'] >= 9 - r['max'] - 1 and r['held'] and r['back'], json.dumps(r))

    # the panels: a scene or a day's card puts the open panel aside and gives it back when it's over (UI.park, ui.js)
    r = pg.evaluate('''(async () => { const B = __bv, out = {}, K = B.TOWN.b.keep, wait = ms => new Promise(r => setTimeout(r, ms));
      while (B.STORY.shown) B.talkNext(); B.eventClose();
      B.UI.open('building', K); await wait(100);
      B.playScene({ lines: [['hesper', 'A test line.'], ['odile', 'And another.']] });
      out.during = { cur: B.UI.cur, hidden: document.getElementById('panel').hidden };
      while (B.STORY.shown) B.talkNext(); await wait(100);
      out.scene = !!B.UI.cur && B.UI.cur.kind === 'building' && B.UI.cur.ref === K && !document.getElementById('panel').hidden;
      B.eventFire('courier'); out.cardUp = !!B.EVT.card && document.getElementById('panel').hidden;
      B.eventChoose(0); B.eventClose(); await wait(100);
      out.card = !!B.UI.cur && B.UI.cur.kind === 'building' && B.UI.cur.ref === K && !document.getElementById('panel').hidden;
      out.during = out.during.cur === null && out.during.hidden;
      return out; })()''')
    check("a scene or a day's card puts the panel aside and gives it back after", r['during'] and r['scene'] and r['cardUp'] and r['card'], json.dumps(r))

    # an open panel keeps its numbers live, in place: the same elements, new numbers, no rebuild (UI.render, ui.js)
    r = pg.evaluate('''(async () => { const B = __bv, out = {}, K = B.TOWN.b.keep, G = B.GAME, wait = ms => new Promise(r => setTimeout(r, ms));
      while (B.STORY.shown) B.talkNext(); B.eventClose();
      G.recruit = 0.2; B.UI.open('building', K); await wait(50);
      const body = document.getElementById('panel-body'), h2 = body.querySelector('h2'), chip = [...body.querySelectorAll('.chip')].find(c => /Next settler/.test(c.textContent));
      out.before = chip && chip.textContent;
      // the game's own refresh, every couple of seconds of the HUD's clock (updateHUD in ui.js): run that clock round
      // by hand, so a slow machine's few frames don't matter
      G.recruit = 0.6;
      for (let i = 0; i < 9 && chip && chip.isConnected && !/60%/.test(chip.textContent); i++) B.updateHUD(0.3);
      out.after = chip && chip.textContent; out.sameChip = !!chip && chip.isConnected && chip === [...body.querySelectorAll('.chip')].find(c => /Next settler/.test(c.textContent));
      out.sameTitle = h2.isConnected && h2 === body.querySelector('h2');
      // a button turns off and says why, then on again, and is the same button throughout
      const up = () => body.querySelector('.upgrade .btn'), btn = up(), sh = G.shards;
      G.shards = 0; B.UI.refresh(); out.off = btn.disabled && !!body.querySelector('.upgrade .why');
      G.shards = 99999; B.UI.refresh(); out.on = !btn.disabled && !body.querySelector('.upgrade .why'); out.sameBtn = btn === up();
      G.shards = sh; B.UI.refresh(); B.UI.close();
      return out; })()''')
    check('an open panel brings its numbers up to date in place, without rebuilding', r['sameChip'] and r['sameTitle'] and '20%' in (r['before'] or '') and '60%' in (r['after'] or '') and r['off'] and r['on'] and r['sameBtn'], json.dumps(r))


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
    # the Shipyard: a ship bought with shards and materials, a refit that raises her numbers and rebuilds her model,
    # crew from the claim who make the guns reload faster (in the Shipyard's numbers and in the air), and repairs
    pg.evaluate('__bv.UI.close(); __bv.openSky("port")')
    pg.wait_for_function('__bv.SKY.mode === "port"', timeout=120000)
    r = pg.evaluate('''(() => { const B = __bv, g = B.SKY, d = B.FLEET.data, out = {};
      B.STORY.ch = Math.max(B.STORY.ch, 2); B.GAME.shards = 3000; Object.assign(B.GAME.mats, { brass: 10, glass: 10, heartstone: 10 });
      const c = d.ships.cutter; c.owned = false; c.refit = { hull: 0, sails: 0, guns: 0, crystals: 0 }; c.wear = { hull: 1, sails: 1, crystals: 1 }; c.repair = null;
      [...document.querySelectorAll('#port-ships button')].find(b => b.dataset.ship === 'cutter').click();
      const s0 = B.GAME.shards, b0 = B.GAME.mats.brass; document.getElementById('btn-buy').click();
      out.bought = c.owned && d.flying === 'cutter'; out.paid = [Math.round(s0 - B.GAME.shards), b0 - B.GAME.mats.brass];
      const R = { id: 'cutter' }, ship0 = g.shipNow(B.SKY.parts.raiders.templates['cutter:crew'].R), h0 = g.loadoutOf('cutter').stats.hull, straps0 = ship0.recipe.bands.straps.length;
      g.port.tab = 'refit'; document.querySelector('#pp-refit-list [data-part=hull] button').click();
      const ship1 = g.shipNow(B.SKY.parts.raiders.templates['cutter:crew'].R);
      out.hull = [h0, g.loadoutOf('cutter').stats.hull]; out.rebuilt = ship1 !== ship0 && ship1.recipe.bands.straps.length > straps0; void R;
      // the crew: nobody aboard, then the two best at Agility on the guns
      d.crew = { pilot: 0, bosun: 0, gunners: [] }; const r0 = g.loadoutOf('cutter').guns.reload;
      const ppl = B.GAME.villagers.filter(v => !v.d.exp && !v.d.study && !v.hurt).sort((a, b) => b.d.stats.A - a.d.stats.A);
      ppl[0].d.stats.A = 10; ppl[1].d.stats.A = 9; B.yardSeat('gunner', 0, ppl[0]); B.yardSeat('gunner', 1, ppl[1]);
      out.reload = [r0, g.loadoutOf('cutter').guns.reload]; out.names = B.yardCrewNames('cutter');
      B.UI.open('dock', { tab: 'crew' }); out.portraits = document.querySelectorAll('#panel-body .yseat .pframe').length; B.UI.close();
      // in the air: the gunnery reloads faster with them aboard; home again, they come down the boarding bridge
      B.yardSailing(); out.aboard = B.YARD.sailed.length; g.fly('cutter'); const withCrew = g.gunnery.reload('port'); g.endVoyage(1);
      const D = B.DOCK.b.group.position; out.home = [ppl[0], ppl[1]].map(v => v.where === 'surface' && !v.hidden && Math.hypot(v.pos.x - D.x, v.pos.z - D.z) < 12).every(Boolean);
      const keep = d.crew.gunners; d.crew.gunners = []; g.fly('cutter'); const without = g.gunnery.reload('port'); g.endVoyage(1); d.crew.gunners = keep;
      out.air = [without, withCrew];
      // repairs: harm she brought home costs shards and time at the dock, and the claim finishes them
      c.wear = { hull: 0.4, sails: 0.7, crystals: 0.9 }; B.UI.open('dock', { tab: 'ship' }); const rb = [...document.querySelectorAll('#panel-body .btn')].find(b => /Repair her/.test(b.textContent));
      const s1 = B.GAME.shards; if (rb) rb.click(); out.repair = { paid: Math.round(s1 - B.GAME.shards), until: c.repair && Math.round((c.repair.until - c.repair.from) * 24 * 10) / 10 };
      B.UI.close();
      return out; })()''')
    check('buy a ship in the Shipyard with shards and materials', r['bought'] and r['paid'][0] == 300 and r['paid'][1] == 2, json.dumps(r))
    check('a refit raises her numbers and changes her model', r['hull'][1] > r['hull'][0] and r['rebuilt'], json.dumps(r['hull']))
    check('crew from the claim make the guns reload faster, in the Shipyard and in the air', r['reload'][1] < r['reload'][0] * 0.9 and r['air'][1] < r['air'][0] * 0.9 and r['portraits'] >= 2, json.dumps({k: r[k] for k in ('reload', 'air', 'portraits', 'names')}))
    check('the crew go aboard, and come home down the boarding bridge', r['aboard'] == 2 and r['home'], json.dumps({k: r[k] for k in ('aboard', 'home')}))
    check('a ship brought home hurt is repaired at the dock for shards and time', r['repair']['paid'] > 0 and (r['repair']['until'] or 0) >= 1, json.dumps(r['repair']))
    pg.evaluate('__bv.SKY.on || __bv.openSky("port")')
    pg.wait_for_function('__bv.SKY.mode === "port"', timeout=120000)
    # a boss raid: the Chandlery's guns and guards, then Tallow's flagship rising from the rock, brought down in her
    # phases; at home its crates hold a Lark part or a module for certain
    r = pg.evaluate('''(() => { const B = __bv, d = B.FLEET.data; d.skies = 'fair'; const b = d.ships.brig; b.wear = { hull: 1, sails: 1, crystals: 1 }; b.repair = null;
      b.refit = { hull: 2, sails: 1, guns: 2, crystals: 1 }; d.raids.citadel.won = 0;
      const r = __raidPilot('citadel', 'brig', 700); const cur = B.SKY.sites.cur;
      return { state: r.state, t: r.t, saves: r.saves, boss: !!cur.boss && cur.boss.boss, bossDown: !!cur.boss && !!cur.boss.f.down, card: r.card, log: r.log.filter(x => /boss/.test(x)).slice(0, 2).concat(r.log.slice(-2)) }; })()''')
    check('a boss raid: the Black Candle rises from the Chandlery, and is brought down', r['state'] == 'taken' and r['boss'] == 'candle' and r['bossDown'], json.dumps(r))
    before = pg.evaluate('__bv.GAME.stash.length')
    pg.evaluate('document.getElementById("btn-go-port").click()')
    pg.wait_for_timeout(1200)
    r = pg.evaluate('({ stash: __bv.GAME.stash.length, won: __bv.FLEET.data.raids.citadel.won, best: __bv.FLEET.data.raids.citadel.best, lark: __bv.GAME.stash.slice(0, 8).some(it => it.type === "lark" || it.type === "module"), panel: __bv.UI.cur && __bv.UI.cur.kind })')
    check("the boss's crates come home: five, and a Lark part or module", r['stash'] >= before + 6 and r['won'] == 1 and r['best'] > 0 and r['lark'], json.dumps(r) + f' before {before}')
    # a repeat raid: the camp, taken before, is manned again after a day, and pays half
    r = pg.evaluate('''(() => { const B = __bv, out = {}; B.UI.close();
      const row = () => B.yardSites().find(x => x.s.id === 'camp');
      B.FLEET.data.raids.camp.day = B.GAME.day; out.wait = row().wait;
      B.UI.open('dock', { tab: 'raids' }); const li = [...document.querySelectorAll('#panel-body .li.raid')].find(e => /prospect camp/.test(e.textContent)); out.disabled = !!li && li.disabled; out.side = li && li.querySelector('.side').textContent; B.UI.close();
      B.simulate(240, 0.25); out.after = row().wait;
      B.SKY.raid('camp', 'skiff'); out.repeat = B.SKY.sites.cur.repeat; B.SKY.endVoyage(1); B.UI.close();
      return out; })()''')
    check("a place taken is manned again after its cooldown, and a repeat raid pays less", r['wait'] >= 1 and r['disabled'] and 'Manned again' in (r['side'] or '') and r['after'] <= 0 and r['repeat'], json.dumps(r))
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
    # the Keep: each study is furnished from its room's panel (and fitted out in front of you), a student goes in,
    # walks up the stair to their place, and is shown at work there; the empty room has its sign; nothing new is saved
    r = pg.evaluate('''(() => { const B = __bv, out = { rooms: {} }, kinds = 'GEARS';
      B.TOWN.b.keep.show(3); B.GAME.shards += 5000; B.buildInterior(true);
      const people = B.GAME.villagers.filter(v => !v.d.exp && v.where !== 'ship' && v.where !== 'mast');
      for (const v of people) if (v.d.study) B.endStudy(v);
      for (let i = 0; i < 5; i++) B.GAME.rooms[i] = { type: null, level: 0 };
      B.buildInterior(true); out.sign = B.KEEPV.spots.filter(s => s.kind === 'empty').length >= 4;
      for (let i = 0; i < 5; i++) {
        B.UI.open('room', i); const btn = document.querySelectorAll('#panel-body .list .li')[i]; if (btn) btn.click();
        if (i === 0) out.fit = !!B.KEEPV.fit && B.KEEPV.fit.key === 0;
        for (const v of people) if (!v.d.study && B.startStudy(v, i, 'student')) break;
      }
      B.UI.close();
      for (let i = 0; i < 150 && B.GAME.villagers.some(v => v.d.study && v.where !== 'study'); i++) B.simulate(1, 0.1);
      // someone already resting indoors walks to their seat rather than appearing in it: the top floor is three flights up
      for (let i = 0; i < 12 && B.GAME.villagers.some(v => v.d.study && !(v.kin && v.kin.at)); i++) B.keepTick(10, 0.1);
      out.late = B.GAME.villagers.filter(v => v.d.study && !(v.kin && v.kin.at)).map(v => [v.d.name, v.where, v.plan.map(s => s.type).join(','), v.kin ? v.kin.path.length : -1]);
      for (let i = 0; i < 5; i++) {
        const R = B.KEEPV.rooms[i], st = B.roomStudents(i);
        out.rooms[kinds[i]] = { kind: R && R.kind, spots: B.KEEPV.spots.filter(s => s.room === i && s.use === 'student').length, n: st.length,
          at: st.filter(v => v.isprite.visible && v.kin && v.kin.at && v.kin.goal && v.kin.goal.room === i && Math.abs(v.isprite.position.x - R.cx) < 4.5 && v.isprite.position.y > R.y0 - 0.5 && v.isprite.position.y < R.y0 + 4).length };
      }
      B.saveGame(); const sv = JSON.parse(localStorage.getItem('brightvein-keep-v1')); out.saved = JSON.stringify(sv.rooms);
      for (const v of B.GAME.villagers) if (v.d.study) B.endStudy(v);   // back to work, for the checks after this
      B.simulate(5, 0.1);
      return out; })()''')
    check('each study can be furnished from its panel, and is fitted out', r['sign'] and r['fit'] and all(v['kind'] == k and v['spots'] >= 4 for k, v in r['rooms'].items()), json.dumps(r))
    check('students walk in and are shown at work in their study', all(v['n'] >= 1 and v['at'] == v['n'] for v in r['rooms'].values()), json.dumps(r['rooms']) + ' late: ' + json.dumps(r['late']))
    # nights: a Bright Night brings a boss with a health bar, and it can be brought down; dawn brings the report
    r = pg.evaluate('''(() => { const B = __bv, out = {};
      if (B.GAME.t > 0.6 || B.GAME.t < 0.05 || B.WL.night) B.skipTo(0.3);   // a slow run can leave a night under way: see it out first
      B.NIGHT.grudge = null; B.GAME.nights = 4; B.forceWeather('clear', 'clear');
      B.skipTo(0.62); out.banner = !document.getElementById('nightbanner').hidden && document.getElementById('nightbanner').textContent;
      out.plan = B.NIGHT.plan && B.NIGHT.plan.n; out.bright = B.NIGHT.plan && B.NIGHT.plan.bright;
      for (let i = 0; i < 200 && !(B.WL.night && B.WL.night.boss); i++) B.simulate(1, 0.1);
      const f = B.WL.night && B.WL.night.boss; out.boss = !!f && f.boss && f.name; out.hp = f && Math.round(f.hp);
      const bb = document.getElementById('bossbar'); out.bar = !bb.hidden && getComputedStyle(bb).position === 'absolute' && bb.getBoundingClientRect().height > 20 && bb.textContent;
      const stash = B.GAME.stash.length, shards = B.GAME.shards;
      if (f) { f.hurt(1e6, 'lark'); B.simulate(1, 0.1); }
      out.dead = !!f && f.dead; out.killed = B.WL.night && B.WL.night.bossKilled; out.loot = B.GAME.stash.length - stash; out.bonus = Math.round(B.GAME.shards - shards);
      B.skipTo(0.975);
      const d = document.getElementById('dawn'); out.dawn = !!d && !d.hidden && d.textContent.slice(0, 80); out.last = B.NIGHT.last && B.NIGHT.last.bossKilled;
      return out; })()''')
    check('a Bright Night names itself at dusk', bool(r['banner']) and r['bright'] and r['plan'] == 5, json.dumps({k: r[k] for k in ('banner', 'plan', 'bright')}))
    check('a Bright Night brings a boss with a health bar', bool(r['boss']) and bool(r['bar']), json.dumps({k: r[k] for k in ('boss', 'hp', 'bar')}))
    check('the boss can be brought down, and leaves something good', r['dead'] and r['killed'] and r['loot'] >= 1 and r['bonus'] >= 60, json.dumps({k: r[k] for k in ('dead', 'killed', 'loot', 'bonus')}))
    check('the dawn report comes up', bool(r['dawn']) and r['last'], json.dumps({k: r[k] for k in ('dawn', 'last')}))
    # the wall: a section knocked down shows a gap, is saved, and the watch mends it by day
    r = pg.evaluate('''(() => { const B = __bv, s = B.WALL.segs[10], out = {};
      B.wallHit(s, 2); out.broken = s.broken; B.saveGame(); const sv = JSON.parse(localStorage.getItem('brightvein-keep-v1'));
      out.saved = sv.night && sv.night.broken[10] === 1 && sv.night.wall[10] < 0.5;
      B.GAME.shards = Math.max(B.GAME.shards, 300); if (!B.workersOf('wall').length) { const v = B.GAME.villagers.find(x => !x.d.exp); B.assignJob(v, 'wall'); }
      B.skipTo(0.45); out.mended = !s.broken; out.hp = Math.round(s.hp * 100);
      return out; })()''')
    check('a broken wall section is saved, and mended by day', r['broken'] and r['saved'] and r['mended'], json.dumps(r))
    # weather: each kind can be forced, shows in the clock, and is saved
    r = pg.evaluate('''(() => { const B = __bv, out = {};
      for (const k of Object.keys(B.WEATHERS)) { B.forceWeather(k, 'fog'); B.applyTimeOfDay(B.GAME.t, 0); B.saveGame(); const sv = B.loadSave();
        out[k] = sv.weather && sv.weather.today === k && sv.weather.next === 'fog' && document.getElementById('wx').textContent.includes(B.WEATHERS[k].name); }
      B.forceWeather('fog'); B.applyTimeOfDay(0.3, 0); out.fogFar = Math.round(B.scene.fog.far);
      B.forceWeather('clear'); B.applyTimeOfDay(0.3, 0); out.clearFar = Math.round(B.scene.fog.far);
      return out; })()''')
    check('each weather can be forced, shown and saved', all(r[k] for k in ('clear', 'overcast', 'rain', 'fog', 'storm')), json.dumps(r))
    check('fog closes in', r['fogFar'] < 400 < r['clearFar'], json.dumps(r))
    # an Aether storm: a Lightning Rod catches a bolt and turns it into shards
    r = pg.evaluate('''(() => { const B = __bv; B.forceWeather('storm'); B.GAME.shards += 100; const rod = B.addBuilding('rod', null, null, 1, { hint: [0, 10] }); const s0 = B.GAME.shards;
      const hit = B.lightningStrike(new B.THREE.Vector3(rod.L.x + 4, 0, rod.L.z + 2)); return { kind: hit.kind, gain: Math.round(B.GAME.shards - s0), caught: rod.caught || 0 }; })()''')
    check('a Lightning Rod catches a bolt and turns it into shards', r['kind'] == 'rod' and r['gain'] >= 12 and r['caught'] == 1, json.dumps(r))
    r = pg.evaluate('''(async () => { const B = __bv, A = BV_AUDIO.AUDIO, out = { before: A.status().theme };
      B.GAME.t = 0.8;
      const until = Date.now() + 90000;   // the dawn cue (18 s) may still be playing from the nights check before this
      while (Date.now() < until && A.status().theme !== 'night') { while (B.STORY.shown) B.talkNext(); B.GAME.t = 0.8; B.applyTimeOfDay(0.8, 0); await new Promise(r => setTimeout(r, 400)); }
      out.night = A.status().theme; out.want = BV_AUDIO.MUSIC.want().theme;
      B.simulate(60); await new Promise(r => setTimeout(r, 4000));
      const s = A.status(); out.voices = s.voices; out.persist = s.persist; out.state = s.state; out.dropped = s.dropped;
      return out; })()''')
    check('the music turns to the night watch at night', r['night'] == 'night', json.dumps(r))
    check("a minute of play doesn't pile up sounds", r['state'] == 'running' and r['voices'] < 72 and r['persist'] < 200, json.dumps(r))
    # act two: a claim that has finished act one goes on into act two (the Chandlery's closing scene, then a pause, then
    # chapter 9's opening under an "Act two" heading, and its goals in the journal)
    r = pg.evaluate('''(() => { const B = __bv, out = {};
      for (let i = 0; i < 60 && B.STORY.shown; i++) B.talkNext(); B.eventClose();
      B.STORY.ch = 8; B.STORY.started = true; B.STORY.at = { day: B.GAME.day, nights: B.GAME.nights, tally: { ...B.ACT.tally } };
      B.FLEET.data.ships.brig.owned = true; B.FLEET.data.raids.citadel.won = Math.max(1, B.FLEET.data.raids.citadel.won);
      B.storyTick(10); out.closing = !!B.STORY.shown;
      for (let i = 0; i < 60 && B.STORY.shown; i++) B.talkNext();
      B.storyTick(10); out.title = B.STORY.shown ? document.getElementById('talk-title').textContent : null;
      out.speakers = []; for (let i = 0; i < 60 && B.STORY.shown; i++) { out.speakers.push(document.getElementById('talk-name').textContent); B.talkNext(); }
      out.ch = B.STORY.ch; out.started = B.STORY.started; B.journalHUD(); out.journal = document.getElementById('journal').textContent;
      out.speakers = [...new Set(out.speakers)].join(', ');
      return out; })()''')
    check('act two begins after the Chandlery', r['closing'] and r['ch'] == 9 and r['started'] and 'Act two' in (r['title'] or '') and 'Silver Sails' in r['journal'] and 'Marchbank' in r['speakers'], json.dumps(r))
    # a day event: its card comes up (time waits), a choice does what it says, and it goes in the journal's days
    r = pg.evaluate('''(() => { const B = __bv, out = {}; B.eventClose();
      B.GAME.shards += 500; const s0 = B.GAME.shards, n0 = B.GAME.stash.length;
      out.fired = B.eventFire('courier'); const card = document.getElementById('evcard');
      out.shown = !card.hidden && card.querySelectorAll('.ev-ch').length >= 2 && B.GAME.talk;
      B.eventChoose(0); out.paid = Math.round(s0 - B.GAME.shards); out.got = B.GAME.stash.length - n0;
      out.result = card.querySelector('.ev-result') ? card.querySelector('.ev-result').textContent.slice(0, 100) : null;
      out.logged = B.EVT.log[0] && B.EVT.log[0].text;
      B.eventClose(); out.closed = card.hidden && !B.GAME.talk;
      return out; })()''')
    check("a day event's card comes up, and its choice does what it says", r['fired'] and r['shown'] and r['paid'] > 0 and r['got'] == 1 and r['closed'] and 'courier' in (r['logged'] or ''), json.dumps(r))
    # the mood: it falls when the food runs out, an event lifts it, and it changes how fast people work
    r = pg.evaluate('''(() => { const B = __bv, out = {};
      B.GAME.food = 300; out.hi = B.moodTarget(); B.GAME.food = 0; out.lo = B.moodTarget();
      const m0 = B.MOOD.v; B.lifeTick(30); out.fell = Math.round(m0 - B.MOOD.v);
      B.GAME.food = 300; B.moodAdd('test', 20, 1, 'A test'); out.up = B.moodTarget(); B.MOOD.mods = B.MOOD.mods.filter(m => m.id !== 'test');
      const v = B.GAME.villagers.find(v => v.d.job && B.TOWN.b[v.d.job.bid] && !v.d.exp); v.working = true;
      B.MOOD.v = 90; out.fast = v.eff(); B.MOOD.v = 10; out.slow = v.eff(); B.MOOD.v = 65; B.MOOD.shown = '';
      B.actFrame(1); out.hud = document.getElementById('r-mood').textContent;
      return out; })()''')
    check('the mood moves (hunger, events) and moves work speed', r['lo'] < r['hi'] - 15 and r['fell'] > 5 and r['up'] > r['hi'] and r['fast'] > r['slow'] > 0 and 'Happy' in r['hud'], json.dumps(r))
    # a cast member's own story: offered at the Keep, a step comes true by itself, a gift completes the next, and the
    # last pays off (Torvald's: a Masterwork from his forge)
    r = pg.evaluate('''(() => { const B = __bv, out = {};
      B.castArrive(['brann']); const v = B.GAME.villagers.find(x => x.d.hero === 'brann'); v.d.arrived = B.GAME.day - 5;
      B.keepAssign(); const bedOf = p => B.KEEPV.beds.some(b => b.owner === p), folk = B.GAME.villagers.filter(p => !p.d.exp);
      out.beds = !(folk.some(p => p.d.hero && bedOf(p)) && folk.some(p => !p.d.hero && !bedOf(p))); out.bedsN = B.KEEPV.beds.length + ' beds, ' + B.bedsUsed() + ' settlers, ' + B.guestCount() + ' guests';
      if (!B.STORY.done.includes('wickmoor')) B.STORY.done.push('wickmoor');
      delete B.QST.brann; out.ready = B.questReady('brann'); B.QST.brann = { state: 'offer', step: 0, day: B.GAME.day };
      B.UI.open('building', B.TOWN.b.keep); out.atKeep = !!document.querySelector('#panel-body .qoffer'); B.UI.close();
      B.questAccept('brann', true); out.on = B.QST.brann.state;
      const shop = B.byType('shop')[0]; shop.level = 2; B.questsCheck(); out.step1 = B.QST.brann.step;
      B.GAME.mats.heartstone = (B.GAME.mats.heartstone || 0) + 1; B.GAME.shards += 200; const n0 = B.GAME.stash.length;
      out.gave = B.questGive('brann'); for (let i = 0; i < 30 && B.STORY.shown; i++) B.talkNext();
      out.state = B.QST.brann.state; out.mw = B.GAME.stash.length > n0 && B.GAME.stash[0].name;
      B.UI.open('journal', { tab: 'cast' }); out.journal = document.getElementById('panel-body').textContent.includes('Pike’s Forge ✓'); B.UI.close();
      B.saveGame(); const s = JSON.parse(localStorage.getItem('brightvein-keep-v1')).story;
      out.saved = s.ch === 9 && s.quests.brann.state === 'done' && s.events.log.length >= 2 && typeof s.mood.v === 'number' && 'nights' in s.act.tally;
      return out; })()''')
    check("guests don't take a settler's bunk in the Keep", r['beds'], r['bedsN'])
    check("a cast member's story: a step completes, and the last pays off", r['ready'] and r['atKeep'] and r['on'] == 'on' and r['step1'] == 1 and r['gave'] and r['state'] == 'done' and r['mw'] == 'Pike’s Answer' and r['journal'], json.dumps(r))
    check('act two, the stories, the days and the mood are saved', r['saved'], json.dumps(r))
    # a claim saved before the dig, with the deep seam open: its miners keep their places in the matching rooms
    pg.evaluate('''(() => { const B = __bv; B.saveGame(); const s = JSON.parse(localStorage.getItem('brightvein-keep-v1'));
      delete s.dig; for (const b of s.buildings) if (b.type === 'head') b.level = 2;
      const m0 = { armour: 0, canvas: 0, drill: 0, crystals: 0 };   // and a fleet from before the Shipyard (v1, with upgrades as mods)
      s.sky = { skies: 'cross', flying: 'cutter', best: { fair: 3, cross: 1, mael: 0 }, voyages: 4, downed: 9, raids: { camp: { won: 2, day: 1 }, outpost: { won: 0, day: -99 } },
        ships: { skiff: { owned: true, power: 0, mods: { ...m0, armour: 1 } }, cutter: { owned: true, power: -1, mods: { armour: 2, canvas: 1, drill: 3, crystals: 0 } }, brig: { owned: false, power: 0, mods: m0 }, frigate: { owned: false, power: 0, mods: m0 } } };
      for (const k of ['act', 'quests', 'events', 'mood']) delete s.story[k];   // and from before act two's days and stories
      for (const p of s.people) if (p.job && /^(head|[md]:)/.test(p.job.bid)) p.job = null;   // only these two were miners then, so their rooms have room for them
      const ps = s.people.filter(p => !p.exp); ps[0].job = { bid: 'head', slot: 1 }; ps[1].job = { bid: 'head', slot: 5 }; ps[0].name = 'Upper Test'; ps[1].name = 'Lower Test';
      const set = Storage.prototype.setItem; localStorage.setItem('brightvein-keep-v1', JSON.stringify(s));
      Storage.prototype.setItem = function (k, v) { if (k === 'brightvein-keep-v1') return; return set.call(this, k, v); }; })()''')
    pg.goto('file://' + ROOT + '/dist/test.html', wait_until='domcontentloaded', timeout=400000)
    pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden', timeout=400000)
    # with a claim saved, the title offers to continue it (its day, chapter and people), and Continue opens it
    r = pg.evaluate('''(() => { const B = __bv, c = document.getElementById('tt-continue'), s = B.loadSave(), out = {};
      out.title = B.TITLE.on && !document.getElementById('front').hidden && !c.hidden; out.meta = c.textContent; out.day = s.day;
      out.before = B.started; c.click(); out.after = B.started; out.gone = document.getElementById('front').hidden; out.gameDay = B.GAME.day; out.people = B.GAME.villagers.length; out.saved = s.people.length;
      return out; })()''')
    r2 = pg.evaluate('''(() => { const B = __bv, s = B.loadSave(), R = B.renderer, out = {};
      out.fields = ['t', 'ore', 'shards', 'food', 'nights', 'nextId'].filter(k => typeof s[k] !== 'number'); out.nights = B.GAME.nights === s.nights;
      const p0 = R.info.programs.length, t0 = performance.now(); B.setView('keep'); B.frame(); out.newPrograms = R.info.programs.length - p0; out.ms = Math.round(performance.now() - t0);
      B.setView('town'); return out; })()''')
    check("Continue brings back the claim's numbers (time, ore, shards, food, nights)", not r2['fields'] and r2['nights'], json.dumps(r2))
    check('the Keep was made ready behind the loading screen: no new shaders on the first look in', r2['newPrograms'] <= 2, json.dumps(r2))
    check('the title screen offers the saved claim, and Continue opens it', r['title'] and f"Day {r['day']}" in r['meta'] and 'people' in r['meta'] and not r['before'] and r['after'] and r['gone'] and r['gameDay'] == r['day'] and r['people'] == r['saved'], json.dumps(r))
    r = pg.evaluate('''(() => { const B = __bv; const job = n => { const v = B.GAME.villagers.find(v => v.d.name === n); return v && v.d.job && v.d.job.bid; };
      return { rooms: B.DIG.rooms.map(R => R.id + ' ' + R.kind + ' ' + R.w), upper: job('Upper Test'), lower: job('Lower Test') }; })()''')
    check('an old save loads: the galleries are rooms, the miners keep their places', 'm:0.8 face 2' in r['rooms'] and 'm:2.8 face 2' in r['rooms'] and 'm:5.8 seam 2' in r['rooms'] and r['upper'] == 'm:0.8' and r['lower'] == 'm:2.8', json.dumps(r))
    r = pg.evaluate('''(() => { const B = __bv; return { ch: B.STORY.ch, started: B.STORY.started, last: B.ACT.lastNight, night: B.NIGHT.last && B.NIGHT.last.n, mood: B.MOOD.v, quests: Object.keys(B.QST).length }; })()''')
    check('a save from before act two loads, and goes on in act two', r['ch'] == 9 and r['last'] == (r['night'] or 0) and r['quests'] == 0 and 0 <= r['mood'] <= 100, json.dumps(r))
    r = pg.evaluate('''(() => { const d = __bv.FLEET.data; return { v: d.v, flying: d.flying, cutter: d.ships.cutter.refit, power: d.ships.cutter.power, skiff: d.ships.skiff.refit.hull, six: Object.keys(d.ships).length, galleon: d.ships.galleon.owned, camp: d.raids.camp.won, convoy: !!d.raids.convoy, crew: !!d.crew && Array.isArray(d.crew.gunners), wear: d.ships.cutter.wear.hull, moored: __bv.DOCK.ship && __bv.DOCK.ship.recipe.id }; })()''')
    check('a fleet from before the Shipyard loads: its upgrades become refits', r['v'] == 2 and r['flying'] == 'cutter' and r['cutter'] == {'hull': 2, 'sails': 1, 'guns': 3, 'crystals': 0} and r['power'] == -1 and r['skiff'] == 1 and r['six'] == 6 and not r['galleon'] and r['camp'] == 2 and r['convoy'] and r['crew'] and r['wear'] == 1, json.dumps(r))
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
