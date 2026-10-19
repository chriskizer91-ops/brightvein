# people.py: pictures of the claim's pixel people, for review (headless Chromium, the game's own drawing code).
#   python3 test/people.py [out-dir] [--old git-ref] [--town]
# Writes into out-dir (default shots/, which git ignores):
#   people-sheets.png     40 random villagers and the ten cast: every sheet at 1x
#   people-2x.png         the same people at 2x: standing (front, side, back), a walk step and a work beat
#   people-old-new.png    the same looks drawn by the old pixel.js (from git-ref, default main) and the new one,
#                         at the same size on screen
#   people-portraits.png  bust portraits (drawPortrait) for 24 villagers and the cast's looks, at 2x
#   people-town-default.png, people-town-close.png   with --town: the people in the lit town at the default camera
#                         and close up (needs a build: node tools/build.mjs; slow, the town is drawn in software)
#
#   python3 test/people.py --check
# Draws every frame of every hat x hair x clothes combination (with each fringe, beard, glasses, scarf, satchel, gnome
# and big build mixed in), every work tool and every carried weapon, 300 random villagers and the cast, and the
# portraits; fails if anything throws, a frame comes out empty, or a standing villager's head is cut off at the top.
# Prints how long a sheet takes to draw.
import sys, os, base64, subprocess
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
town = '--town' in args
gref = args[args.index('--old') + 1] if '--old' in args else 'main'
rest = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] != '--old')]
out = rest[0] if rest else os.path.join(ROOT, 'shots')
os.makedirs(out, exist_ok=True)

def rd(f):
    with open(os.path.join(ROOT, f), encoding='utf8') as h: return h.read()
mul = next(l for l in rd('src/claim/core.js').splitlines() if l.startswith('function mulberry'))
new_src, cast_src = rd('src/claim/pixel.js'), rd('src/claim/cast.js')
try: old_src = subprocess.run(['git', 'show', gref + ':src/claim/pixel.js'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
except Exception: old_src = None

JS = r'''([newSrc, oldSrc, castSrc, mul]) => {
  const load = src => new Function(mul + '\n' + src + '\n' + castSrc + '\nreturn { drawVillagerSheet, randomLook, mulberry, PX, HERO_LOOKS, drawPortrait: typeof drawPortrait === "function" ? drawPortrait : null };')();
  const N = load(newSrc), O = oldSrc ? load(oldSrc) : null, PX = N.PX;
  const GRASS = '#5f8a3e', GRASS2 = '#557d37', INKC = '#1e1420', PAPER = '#efe4c8';
  const grass = (ctx, w, h) => { ctx.fillStyle = GRASS; ctx.fillRect(0, 0, w, h); ctx.fillStyle = GRASS2; for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 8; x < w; x += 16) ctx.fillRect(x, y, 8, 8); };
  const label = (ctx, t, x, y, size = 14) => { ctx.font = `bold ${size}px monospace`; ctx.fillStyle = INKC; ctx.fillText(t, x + 1, y + 1); ctx.fillStyle = PAPER; ctx.fillText(t, x, y); };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; grass(x, w, h); return [c, x]; };
  const looks = []; for (let s = 1; s <= 40; s++) looks.push(['villager ' + s, N.randomLook(N.mulberry(s * 7919), { gnome: s % 9 === 0 })]);
  const cast = Object.entries(N.HERO_LOOKS).map(([id, L]) => [id, L]);
  const all = [...looks, ...cast], sheets = all.map(([, L]) => N.drawVillagerSheet(L)), out = {};
  // every sheet at 1x
  { const per = 5, sw = PX.FW * PX.COLS, sh = PX.FH * PX.ROWS, [c, x] = canvas(per * (sw + 12) + 12, Math.ceil(all.length / per) * (sh + 24) + 12);
    all.forEach(([name], i) => { const X = 12 + (i % per) * (sw + 12), Y = 12 + Math.floor(i / per) * (sh + 24); label(x, name, X, Y + 10, 11); x.drawImage(sheets[i], X, Y + 14); });
    out.sheets = c.toDataURL(); }
  // 2x: front, side, back standing, a walk step and a work beat
  { const fr = [[0, PX.STAND], [2, PX.STAND], [1, PX.STAND], [2, PX.WALK], [0, PX.WORK + 1]], per = 6, cw = fr.length * PX.FW * 2 + 14, ch = PX.FH * 2 + 22;
    const [c, x] = canvas(per * cw + 12, Math.ceil(all.length / per) * ch + 12);
    all.forEach(([name], i) => { const X = 12 + (i % per) * cw, Y = 12 + Math.floor(i / per) * ch; label(x, name, X, Y + 10, 11); fr.forEach(([r, col], k) => x.drawImage(sheets[i], col * PX.FW, r * PX.FH, PX.FW, PX.FH, X + k * PX.FW * 2, Y + 16, PX.FW * 2, PX.FH * 2)); });
    out.x2 = c.toDataURL(); }
  // old and new, the same size on screen: old frames at 4x, new frames at 2x
  if (O) { const fr = [[0, 0, 0], [2, 1, PX.WALK], [1, 0, 0], [0, 3, PX.WORK + 1]], pick = [...looks.slice(0, 18), ...cast], per = 3, cw = 2 * fr.length * 96 + 40, ch = 128 + 22;
    const [c, x] = canvas(per * cw + 12, Math.ceil(pick.length / per) * ch + 12);
    pick.forEach(([name, L], i) => { const X = 12 + (i % per) * cw, Y = 12 + Math.floor(i / per) * ch, os = O.drawVillagerSheet(L), ns = N.drawVillagerSheet(L), oF = O.PX.FW, oH = O.PX.FH;
      label(x, name + ': old | new', X, Y + 10, 11);
      fr.forEach(([r, oc, nc], k) => { x.drawImage(os, oc * oF, r * oH, oF, oH, X + k * 96, Y + 16, 96, 128); x.drawImage(ns, nc * PX.FW, r * PX.FH, PX.FW, PX.FH, X + fr.length * 96 + 20 + k * 96, Y + 16, 96, 128); });
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(X + fr.length * 96 + 8, Y + 16, 3, 128); });
    out.oldnew = c.toDataURL(); }
  // portraits at 2x
  if (N.drawPortrait) { const pick = [...looks.slice(0, 24), ...cast], per = 8, [c, x] = canvas(per * 140 + 12, Math.ceil(pick.length / per) * 154 + 12);
    pick.forEach(([name, L], i) => { const X = 12 + (i % per) * 140, Y = 12 + Math.floor(i / per) * 154; label(x, name, X, Y + 10, 11); x.drawImage(N.drawPortrait(L), X, Y + 16, 128, 128); });
    out.portraits = c.toDataURL(); }
  return out;
}'''

TOWN_SETUP = r'''(() => { const B = __bv; B.begin(true); for (const t of ['yard', 'yard', 'garden', 'shop']) B.trayPick(t); B.exitBuild(); B.simulate(30, 0.1); return B.GAME.villagers.length; })()'''
TOWN_CLOSE = cast_src + r'''
;(() => { const B = __bv, vs = B.GAME.villagers, k = B.TOWN.b.keep, c = k.worldPos(0, 0, 16), all = vs.slice(0, 10);
  Object.keys(HERO_LOOKS).forEach((id, i) => { const src = vs[i % vs.length], v = new src.constructor({ ...src.d, id: 9000 + i, look: HERO_LOOKS[id], job: null, gear: {} }); B.GAME.villagers.push(v); all.push(v); });
  all.forEach((v, i) => { v.replan = false; v.d.exp = null; v.where = 'surface'; v.setHidden(false); const row = Math.floor(i / 7), n = i % 7;
    v.place(c.x - 6 + n * 1.9 + (row & 1) * 0.9, 0, c.z - 2 + row * 2.4); v.plan = [{ type: 'wait', t: 1e9 }]; v.face.set(i % 5 === 4 ? 1 : 0, i % 5 === 4 ? 0 : 1); v.anim = i * 0.37; });
  B.FOLLOW.v = null; B.VIEW.tween = null; B.controls.target.set(c.x, 1.0, c.z + 1.5); B.camera.position.set(c.x + 2, 7, c.z + 17); B.controls.update(); return all.length; })()'''

CHECK = r'''([src, castSrc, mul]) => {
  const A = new Function(mul + '\n' + src + '\n' + castSrc + '\nreturn { drawVillagerFrame, drawVillagerSheet, drawPortrait, randomLook, mulberry, PX, PX_MOTION, pxCarry, HERO_LOOKS };')();
  const { PX } = A, looks = [], problems = [], kinds = Object.keys(A.PX_MOTION);
  // what can be carried in the hand slot as a weapon (work-only things like the rope or the ledger never are)
  const arms = kinds.filter(t => !['rope', 'book', 'ledger', 'can', 'crystal', 'tongs', 'glass', 'scope', 'spell', 'wrench'].includes(t));
  let k = 0;
  for (const hat of [null, 'cap', 'goggles', 'brim', 'flatcap', 'bandana', 'gnome', 'hood']) for (const hairStyle of ['crop', 'bob', 'long', 'bun', 'ponytail', 'curly', 'braids', 'bald']) for (const over of ['vest', 'apron', 'coat', 'overalls', 'none']) {
    looks.push(['combo ' + [hat, hairStyle, over].join(' '), { ...A.randomLook(A.mulberry(1000 + k), { hat, hairStyle, over, gnome: false }), fringe: ['swept', 'parted', 'blunt'][k % 3], tool: kinds[k % kinds.length],
      weapon: k % 4 === 1 ? arms[(k * 7) % arms.length] : null, scarf: k % 3 ? null : '#9a4430', satchel: k % 4 === 0, glasses: k % 5 === 0, beard: k % 2 === 0 ? (k % 6 === 0 ? 'full' : true) : false,
      gnome: k % 11 === 0, build: k % 13 === 0 ? 'big' : undefined }]); k++;
  }
  for (const t of kinds) looks.push(['tool ' + t, { ...A.randomLook(A.mulberry(3000 + looks.length), {}), tool: t }]);
  for (const t of arms) looks.push(['weapon ' + t, { ...A.randomLook(A.mulberry(4000 + looks.length), {}), weapon: t }]);
  for (let s = 1; s <= 300; s++) looks.push(['villager seed ' + s, A.randomLook(A.mulberry(s), { gnome: s % 7 === 0 })]);
  for (const [id, L] of Object.entries(A.HERO_LOOKS)) looks.push(['cast ' + id, L]);
  let frames = 0;
  for (const [name, L] of looks) {
    try {
      for (let r = 0; r < PX.ROWS; r++) for (let c = 0; c < PX.COLS; c++) {
        const F = A.drawVillagerFrame(L, r, c); frames++;
        if (!F.p.some(Boolean)) problems.push(name + ': frame ' + r + ',' + c + ' is empty');
        // a villager's head and hat must fit: nothing on the top row while standing (a gnome hat's tip may touch it,
        // and a long weapon carried upright stands above the head)
        if (c === 0 && !name.startsWith('cast') && L.hat !== 'gnome' && !(L.weapon && A.pxCarry(L.weapon) === 'long') && F.p.slice(0, PX.FW).some(Boolean)) problems.push(name + ': cut off at the top, row ' + r);
      }
      if (!name.startsWith('cast')) { const cv = A.drawPortrait(L); if (cv.width !== 64) problems.push(name + ': portrait'); }
    } catch (e) { problems.push(name + ': ' + e.message); }
  }
  const t0 = performance.now(); for (let i = 0; i < 20; i++) A.drawVillagerSheet(looks[300 + i][1]); const villagerMs = (performance.now() - t0) / 20;
  const t1 = performance.now(); for (const [id, L] of Object.entries(A.HERO_LOOKS)) A.drawVillagerSheet(L); const castMs = (performance.now() - t1) / Object.keys(A.HERO_LOOKS).length;
  return { looks: looks.length, frames, problems: problems.slice(0, 40), nProblems: problems.length, villagerMs, castMs };
}'''

errors = []
if '--check' in args:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.set_content('<!doctype html><html><body></body></html>')
        r = pg.evaluate(CHECK, [new_src, cast_src, mul])
        b.close()
    for line in r['problems']: print('  ' + line)
    print(f"{r['looks']} people, {r['frames']} frames drawn; a sheet takes {r['villagerMs']:.1f} ms (villager), {r['castMs']:.1f} ms (cast)")
    print('all good' if not r['nProblems'] else f"{r['nProblems']} problems")
    sys.exit(1 if r['nProblems'] else 0)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.set_content('<!doctype html><html><body></body></html>')
    res = pg.evaluate(JS, [new_src, old_src, cast_src, mul])
    for key, name in (('sheets', 'people-sheets'), ('x2', 'people-2x'), ('oldnew', 'people-old-new'), ('portraits', 'people-portraits')):
        if key in res:
            path = os.path.join(out, name + '.png')
            with open(path, 'wb') as h: h.write(base64.b64decode(res[key].split(',', 1)[1]))
            print('wrote', path)
    if town:
        pg.route('**/fonts.g*/**', lambda r: r.fulfill(body='', content_type='text/css'))
        pg.goto('file://' + ROOT + '/dist/test.html')
        pg.wait_for_function('window.__bv && document.querySelector("#loading").hidden', timeout=60000)
        pg.evaluate(TOWN_SETUP); pg.wait_for_timeout(4000)
        pg.screenshot(path=os.path.join(out, 'people-town-default.png'), timeout=240000); print('wrote', os.path.join(out, 'people-town-default.png'))
        pg.evaluate(TOWN_CLOSE); pg.wait_for_timeout(5000)
        pg.screenshot(path=os.path.join(out, 'people-town-close.png'), timeout=240000); print('wrote', os.path.join(out, 'people-town-close.png'))
    b.close()
for e in errors: print('PAGE ERROR', e)
sys.exit(1 if errors else 0)
