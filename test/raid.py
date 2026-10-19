# raid.py: flies a raid headless, with an autopilot, and checks it can be taken.
#   python3 test/raid.py [site] [ship] [fight|strike] [skies] [refit]
#     site:  camp, outpost, galleon, citadel, survey, dredge, convoy, storm, bounty
#     ship:  skiff, cutter, brig, frigate, galleon, manowar
#     strike (the default) strikes the guards down as they come in range, to test the raid itself; fight shoots
#     everything for real and counts how often she'd have gone down (for balance)
#     skies: fair, cross, mael. refit: 0 to 3, every part (and a good crew at 3)
# The autopilot (__raidPilot) is also used by the smoke test.
import sys, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
site = sys.argv[1] if len(sys.argv) > 1 else 'camp'
ship = sys.argv[2] if len(sys.argv) > 2 else 'skiff'
how = sys.argv[3] if len(sys.argv) > 3 else 'strike'
skies = sys.argv[4] if len(sys.argv) > 4 else 'fair'
refit = int(sys.argv[5]) if len(sys.argv) > 5 else 0
AUTOPILOT = '''
window.__raidPilot = (site, ship, limit, opts = {}) => {
  const B = __bv, g = B.SKY; g.raid(site, ship); g.wind.strength = 0;
  const P = g.player, out = { log: [], saves: 0 }; let t = 0, last = '';
  const near = (list, f) => list.map((x) => [x, f(x).distanceTo(P.pos)]).sort((a, b) => a[1] - b[1])[0];
  while (t < limit && g.mode === 'voyage' && !['taken', 'lost'].includes(g.waves.state)) {
    const cur = g.sites.cur, kind = cur.kind, live = g.raiders.list.filter((r) => !r.f.down);
    const boss = cur.boss && !cur.boss.f.down && !cur.boss.gone ? cur.boss : null, prize = cur.prize && !cur.prize.f.down ? cur.prize : null;
    const escort = live.filter((r) => r !== prize && r !== boss);
    const gd = escort.length ? near(escort, (r) => r.f.pos) : null;
    const goals = [...cur.towers.filter((x) => x.alive && (x.goal || kind === 'citadel')), ...cur.mounts.filter((m) => m.alive)], tw = goals.length ? near(goals, (x) => x.world) : null;
    // strike: the guards are struck down as they come in range (shooting ships is checked by the smoke test)
    if (!opts.fight) for (const r of escort) if (r.f.pos.distanceTo(P.pos) < 900 && !r.f.down) { r.f.hit('hull', 1e6); out.log.push(`${Math.round(t)}s struck down a ${r.R.cls}`); }
    let tgt = null, fire = false, run = false;
    if (kind === 'storm') {
      const b = cur.beacons[cur.next]; tgt = b ? b.pos.clone() : P.pos.clone(); run = true;
      if (gd && gd[1] < 500) { fire = true; }
    } else if (kind === 'convoy') {
      // the raider nearest a barge, or the lead barge itself
      const barges = g.raiders.friends.filter((b) => !b.f.down && !b.home);
      const threat = escort.map((r) => [r, Math.min(...barges.map((b) => b.f.pos.distanceTo(r.f.pos)), 1e9)]).sort((a, b) => a[1] - b[1])[0];
      if (threat && threat[1] < 1600) { tgt = threat[0].f.pos.clone(); fire = threat[0].f.pos.distanceTo(P.pos) < 1100; }
      else tgt = (barges[0] ?? g.raiders.friends[0]).f.pos.clone().add({ x: 0, y: 40, z: 0 });
    } else if (gd && gd[1] < 1200) { tgt = gd[0].f.pos.clone(); fire = true; }
    else if (prize) { tgt = prize.f.aimAt(); fire = prize.f.pos.distanceTo(P.pos) < 900; }
    else if (tw && tw[1] < 1400 && !(boss && boss.rise)) { tgt = tw[0].world.clone(); fire = tw[1] < 1050; }
    else if (boss) { tgt = boss.f.aimAt(); fire = boss.f.pos.distanceTo(P.pos) < 1000; }
    else if (tw) { tgt = tw[0].world.clone(); fire = tw[1] < 1050; }
    else if (gd) { tgt = gd[0].f.pos.clone(); fire = gd[1] < 1100; }
    else tgt = g.sites.where().clone().add({ x: 0, y: 120, z: 0 });
    const T = P.pos.clone(); T.y += P.ship.recipe.length * 0.42 + 2;
    const look = tgt.clone().sub(T).normalize(), a = Math.atan2(look.x, look.z) - P.heading;
    // steer: at the target until in reach, then keep it abeam (broadside) and circle, level with it; a beacon, straight at it
    const d = tgt.distanceTo(P.pos), L = P.ship.recipe.length, stand = run ? 0 : (L < 10 ? 380 : 260 + L * 7);
    const broad = !run && d < stand && g.gunnery.count('port') > g.gunnery.count('bow');
    const aimYaw = broad ? Math.sign(Math.atan2(Math.sin(a), Math.cos(a)) || 1) * Math.PI / 2 : Math.atan2(Math.sin(a), Math.cos(a));
    g.cam.pitch = Math.max(-0.35, Math.min(1.25, -Math.asin(look.y))); g.cam.yaw = broad ? Math.atan2(Math.sin(a), Math.cos(a)) : aimYaw;
    const want = run || d > stand ? Math.atan2(Math.sin(a), Math.cos(a)) : Math.atan2(Math.sin(a), Math.cos(a)) - Math.sign(Math.atan2(Math.sin(a), Math.cos(a)) || 1) * Math.PI / 2;
    const c = { fire, turn: Math.max(-1, Math.min(1, -Math.atan2(Math.sin(want), Math.cos(want)) * 2)), climb: Math.max(-1, Math.min(1, (tgt.y + (run ? 0 : 8) - P.pos.y) / 40)), sail: run || d > stand ? 0.6 : -0.3, pressed: new Set() };
    if (run && P.surge.charge >= 1 && Math.abs(want) < 0.2 && d > 250) c.pressed.add('r');
    out.hurt = Math.max(out.hurt ?? 0, Math.round(P.full.hull - P.health.hull));
    out.low = Math.min(out.low ?? 100, Math.round(P.frac('hull') * 100), Math.round(P.frac('crystals') * 100));
    // the test is about the raid, not the crew: keep her afloat (and count how often she'd have gone down)
    if (P.health.hull < P.full.hull * 0.3 || P.health.crystals < P.full.crystals * 0.55) { P.repair(0.5); out.saves++; }
    g.step(0.25, c); t += 0.25;
    const st = `${g.waves.state}/${cur.state}/w${cur.wave}/g${live.length}/t${goals.length}${boss ? '/boss' + Math.round(boss.f.frac('hull') * 100) : ''}${kind === 'storm' ? '/b' + cur.next : ''}${kind === 'convoy' ? '/home' + g.raiders.friends.filter((b) => b.home).length + '/afloat' + g.raiders.friends.filter((b) => !b.f.down).length : ''}${kind === 'dredge' ? '/drill' + Math.round((cur.drill ?? 0) * 100) : ''}`;
    if (st !== last) { out.log.push(`${Math.round(t)}s ${st}`); last = st; }
  }
  out.t = Math.round(t); out.state = g.waves.state; out.shards = Math.round(g.voyage.shards); out.downed = g.downed; out.why = g.sites.cur && g.sites.cur.why;
  out.card = document.getElementById('calm').hidden ? null : document.getElementById('calm-title').textContent;
  out.hullLeft = Math.round(P.frac('hull') * 100);
  return out;
};
0;   // (an expression that ends in a function would be called by Playwright's evaluate)'''
SETUP = '''(([ship, skies, refit, site]) => { const B = __bv, d = B.FLEET.data; d.skies = skies; B.STORY.ch = Math.max(B.STORY.ch, 14);
  for (const s of B.SITES) d.raids[s.id].won = d.raids[s.id].won || 0;
  if (!(window.__keepWon)) d.raids[site].won = 0;   // a first raid (set __keepWon for a repeat)
  const cfg = d.ships[ship]; cfg.owned = true; d.flying = ship; cfg.wear = { hull: 1, sails: 1, crystals: 1 }; cfg.repair = null;
  cfg.refit = { hull: refit, sails: refit, guns: refit, crystals: refit };
  if (site === 'bounty') d.bounty = B.makeBounty ? B.makeBounty(B.GAME.day, B.STORY.ch, 0) : d.bounty;
  if (refit >= 3) B.yardAutoCrew(ship);
  return { ship, skies, refit, crew: B.yardCrewNames(ship) }; })'''
if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 800, 'height': 500})
        pg.on('pageerror', lambda e: print('PAGE ERROR', e))
        pg.on('console', lambda m: print('console error:', m.text[:300]) if m.type == 'error' else None)
        pg.route('**/fonts.g*/**', lambda r: r.fulfill(body='', content_type='text/css'))
        pg.goto('file://' + ROOT + '/dist/test.html', timeout=180000)
        pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden && __bv.DOCK.ship', timeout=90000)
        pg.evaluate('__bv.begin(true); __bv.exitBuild(); __bv.openSky("port")')
        pg.wait_for_function('__bv.SKY.mode === "port"', timeout=120000)
        print(pg.evaluate(SETUP, [ship, skies, refit, site]))
        pg.evaluate(AUTOPILOT)
        r = pg.evaluate(f'__raidPilot("{site}", "{ship}", 900, {{ fight: {"true" if how == "fight" else "false"} }})')
        print(json.dumps(r, indent=1))
        if r['state'] == 'taken':
            before = pg.evaluate('({ stash: __bv.GAME.stash.length, shards: Math.round(__bv.GAME.shards) })')
            pg.evaluate('document.getElementById("btn-go-port").click()')
            pg.wait_for_timeout(1500)
            after = pg.evaluate('({ stash: __bv.GAME.stash.length, shards: Math.round(__bv.GAME.shards), won: __bv.FLEET.data.raids["%s"].won, panel: __bv.UI.cur && __bv.UI.cur.kind })' % site)
            print('home:', before, after)
        b.close()
