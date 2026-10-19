# raid.py: flies a raid on one of the jumpers' places headless, with an autopilot, and checks it can be taken.
#   python3 test/raid.py [camp|outpost|galleon|citadel] [ship]
import sys, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
site = sys.argv[1] if len(sys.argv) > 1 else 'camp'
ship = sys.argv[2] if len(sys.argv) > 2 else 'skiff'
AUTOPILOT = '''
window.__raidPilot = (site, ship, limit) => {
  const B = __bv, g = B.SKY; g.raid(site, ship); g.wind.strength = 0;
  const P = g.player, out = { log: [] }; let t = 0, last = '';
  while (t < limit && g.mode === 'voyage' && !['taken', 'lost'].includes(g.waves.state)) {
    const cur = g.sites.cur, live = g.raiders.list.filter((r) => !r.f.down);
    const prize = cur.prize && !cur.prize.f.down ? cur.prize : null;
    // the prize is shot in her sails; otherwise the nearest guard, then the nearest gun tower, then the place itself
    let tgt = null, fire = false;
    const near = (list, f) => list.map((x) => [x, f(x).distanceTo(P.pos)]).sort((a, b) => a[1] - b[1])[0];
    const escort = live.filter((r) => r !== prize);
    const gd = escort.length ? near(escort, (r) => r.f.pos) : null;
    const towers = cur.towers.filter((x) => x.alive), tw = towers.length ? near(towers, (x) => x.world) : null;
    // (shooting ships down is checked by the smoke test: here the guards are struck down as they come in range)
    for (const r of escort) if (r.f.pos.distanceTo(P.pos) < 900 && !r.f.down) { r.f.hit('hull', 1e6); out.log.push(`${Math.round(t)}s struck down a ${r.R.cls}`); }
    if (gd && gd[1] < 1400) { tgt = gd[0].f.pos.clone(); fire = true; }
    else if (prize) { tgt = prize.f.aimAt(); fire = prize.f.pos.distanceTo(P.pos) < 900; }
    else if (tw && tw[1] < 1300) { tgt = tw[0].world.clone(); fire = tw[1] < 1000; }
    else if (gd) { tgt = gd[0].f.pos.clone(); fire = gd[1] < 1100; }
    else tgt = g.sites.where().clone().add({ x: 0, y: 120, z: 0 });
    const T = P.pos.clone(); T.y += P.ship.recipe.length * 0.42 + 2;
    const look = tgt.clone().sub(T).normalize(), a = Math.atan2(look.x, look.z) - P.heading;
    g.cam.pitch = Math.max(-0.35, Math.min(1.25, -Math.asin(look.y))); g.cam.yaw = Math.atan2(Math.sin(a), Math.cos(a));
    // steer: at the target until close, then circle it
    // steer: at the target until in reach, then keep it abeam (broadside) and circle, level with it
    const d = tgt.distanceTo(P.pos), stand = P.ship.recipe.id === 'skiff' ? 420 : 600;
    const want = d > stand ? g.cam.yaw : g.cam.yaw - Math.sign(g.cam.yaw || 1) * Math.PI / 2;
    const c = { fire, turn: Math.max(-1, Math.min(1, -Math.atan2(Math.sin(want), Math.cos(want)) * 2)), climb: Math.max(-1, Math.min(1, (tgt.y + 8 - P.pos.y) / 40)), sail: d < stand ? -0.3 : 0.6 };
    out.hurt = Math.max(out.hurt ?? 0, Math.round(P.full.hull - P.health.hull));
    if (P.health.hull < P.full.hull * 0.35) P.repair(0.5);   // the test is about the raid, not the crew: keep her afloat
    g.step(0.25, c); t += 0.25;
    const st = `${g.waves.state}/${cur.state}/w${cur.wave}/g${live.length}/t${towers.length}`;
    if (st !== last) { out.log.push(`${Math.round(t)}s ${st}`); last = st; }
  }
  out.t = Math.round(t); out.state = g.waves.state; out.shards = Math.round(g.voyage.shards); out.downed = g.downed;
  out.card = document.getElementById('calm').hidden ? null : document.getElementById('calm-title').textContent;
  return out;
};
0;   // (an expression that ends in a function would be called by Playwright's evaluate)'''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 800, 'height': 500})
    pg.on('pageerror', lambda e: print('PAGE ERROR', e))
    pg.on('console', lambda m: print('console error:', m.text[:300]) if m.type == 'error' else None)
    pg.route('**/fonts.g*/**', lambda r: r.fulfill(body='', content_type='text/css'))
    pg.goto('file://' + ROOT + '/dist/test.html')
    pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden && __bv.DOCK.ship', timeout=90000)
    pg.evaluate('__bv.begin(true); __bv.exitBuild(); __bv.openSky("port")')
    pg.wait_for_function('__bv.SKY.mode === "port"', timeout=120000)
    pg.evaluate(AUTOPILOT)
    r = pg.evaluate(f'__raidPilot("{site}", "{ship}", 900)')
    print(json.dumps(r, indent=1))
    if r['state'] == 'taken':
        before = pg.evaluate('({ stash: __bv.GAME.stash.length, shards: Math.round(__bv.GAME.shards) })')
        pg.evaluate('document.getElementById("btn-go-port").click()')
        pg.wait_for_timeout(1500)
        after = pg.evaluate('({ stash: __bv.GAME.stash.length, shards: Math.round(__bv.GAME.shards), won: __bv.FLEET.data.raids["%s"].won, panel: __bv.UI.cur && __bv.UI.cur.kind })' % site)
        print('home:', before, after)
    b.close()
