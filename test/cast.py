# cast.py: draws the visiting cast (src/claim/cast.js) with the claim's own pixel code, for review.
#   python3 test/cast.py [out.png] [ids...]
# Writes two pictures (default out.png = shots/cast-review.png; shots/ is not tracked):
#   out.png          every character's whole sheet at 4x on grass, beside its reference picture and portrait
#   out-lineup.png   everyone at 1x and 2x beside some ordinary villagers, to check they fit in and read small
# Pass character ids (io sol halcyon ...) after the file name to draw only those.
#
#   python3 test/cast.py --portraits
# (Re)makes the dialogue portraits assets/cast/<id>.png (112 x 112) from reference/cast (needs Pillow):
#   Envoi's own pixel portraits, cropped or padded to 112 (centred, standing on the bottom edge);
#   Io's head and shoulders, cropped from her cast pose at full size;
#   the Moon Faire four, cropped from their HD frames and reduced to 112: smooth downscale, a light sharpen,
#   then hard edges (alpha cut at half) and a limited palette with no dithering, so they read as pixel art.
import sys, os, json, base64

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def make_portraits():
    from PIL import Image, ImageFilter
    ref = lambda f: Image.open(os.path.join(ROOT, 'reference/cast', f)).convert('RGBA')
    dst = os.path.join(ROOT, 'assets/cast'); os.makedirs(dst, exist_ok=True)
    def onto112(im):   # centred across, standing on the bottom edge (or centred when too tall)
        out = Image.new('RGBA', (112, 112), (0, 0, 0, 0)); w, h = im.size
        out.alpha_composite(im, ((112 - w) // 2, 112 - h)) if h <= 112 else out.paste(im, ((112 - w) // 2, -((h - 112) // 2)), im)
        return out
    def pixelise(im, colours=64):
        im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        a = im.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        rgb = Image.new('RGB', im.size, (0, 0, 0)); rgb.paste(im.convert('RGB'), mask=a)
        q = rgb.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        out = q.convert('RGBA'); out.putalpha(a); return out
    done = {}
    for id in ['sol', 'halcyon', 'quill', 'brann', 'tock']:
        im = ref(f'envoi-{id}-portrait.png')
        if im.size[0] > 112:   # a little too big: trim it evenly (the extra is only a pixel or three)
            d = im.size[0] - 112; im = im.crop((d // 2, d // 2, d // 2 + 112, d // 2 + 112))
        done[id] = onto112(im)
    done['io'] = ref('envoi-io-cast.png').crop((122, 66, 234, 178))
    # (x, y, size) of each square crop: the head and shoulders, the face near the middle; the jester's wider for her hat's points
    for id, f, (x0, y0, S) in [('jester', 'jester', (23, 0, 150)), ('ranger', 'ranger', (7, 0, 140)), ('herbal', 'herbal_witch', (16, 0, 140)), ('fox', 'fox', (13, 0, 140))]:
        im = ref(f'moonfaire-{f}-hd.webp')
        crop = Image.new('RGBA', (S, S), (0, 0, 0, 0)); crop.alpha_composite(im.crop((x0, y0, x0 + S, y0 + S)))
        done[id] = pixelise(crop.resize((112, 112), Image.LANCZOS))
    for id, im in done.items():
        assert im.size == (112, 112); im.save(os.path.join(dst, id + '.png'), optimize=True); print('wrote assets/cast/' + id + '.png')

if __name__ == '__main__' and '--portraits' in sys.argv:
    make_portraits(); sys.exit(0)

from playwright.sync_api import sync_playwright

#   python3 test/cast.py --same [git-ref]
# Checks that ordinary villagers still look exactly as they did: draws 300 random villagers and every hat, hair,
# clothes and tool with pixel.js from git-ref (default main) and with the current one, and compares every pixel.
if __name__ == '__main__' and '--same' in sys.argv:
    import subprocess
    i = sys.argv.index('--same'); gref = sys.argv[i + 1] if len(sys.argv) > i + 1 else 'main'
    old = subprocess.run(['git', 'show', gref + ':src/claim/pixel.js'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    with open(os.path.join(ROOT, 'src/claim/pixel.js'), encoding='utf8') as h: new = h.read()
    with open(os.path.join(ROOT, 'src/claim/core.js'), encoding='utf8') as h: mul = next(l for l in h.read().splitlines() if l.startswith('function mulberry'))
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        r = pg.evaluate('''([oldSrc, newSrc, mul]) => {
          const load = src => new Function(mul + '\\n' + src + '\\nreturn { drawVillagerFrame, randomLook, mulberry };')();
          const A = load(oldSrc), B = load(newSrc), looks = [];
          for (let s = 1; s <= 300; s++) looks.push(A.randomLook(A.mulberry(s), { gnome: s % 7 === 0 }));
          const tools = ['pick', 'hammer', 'can', 'crystal', 'book', 'glass', 'lance', 'rope', 'wrench'];
          let k = 0;
          for (const hat of [null, 'cap', 'goggles', 'brim', 'flatcap', 'bandana', 'gnome', 'hood']) for (const hairStyle of ['crop', 'bob', 'long', 'bun', 'ponytail', 'curly', 'braids', 'bald']) for (const over of ['vest', 'apron', 'coat', 'overalls', 'none']) {
            looks.push({ ...A.randomLook(A.mulberry(1000 + k), { hat, hairStyle, over }), tool: tools[k % 9], scarf: k % 3 ? null : '#9a4430', satchel: k % 4 === 0, glasses: k % 5 === 0, beard: k % 2 === 0, gnome: k % 11 === 0 }); k++;
          }
          let frames = 0, differ = 0;
          for (const L of looks) for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
            const a = A.drawVillagerFrame(L, r, c).p, b = B.drawVillagerFrame(L, r, c).p; frames++;
            if (a.some((v, i) => String(v) !== String(b[i]))) differ++;
          }
          return { looks: looks.length, frames, differ };
        }''', [old, new, mul])
        b.close()
    print(f"{r['looks']} villagers, {r['frames']} frames: " + ('all the same as ' + gref if not r['differ'] else f"{r['differ']} frames differ from {gref}"))
    sys.exit(1 if r['differ'] else 0)

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'shots', 'cast-review.png')
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
only = sys.argv[2:]
stem = out[:-4] if out.endswith('.png') else out

def rd(f):
    with open(os.path.join(ROOT, f), encoding='utf8') as h: return h.read()
def data_url(f):
    p = os.path.join(ROOT, f)
    if not os.path.exists(p): return None
    mime = {'png': 'image/png', 'webp': 'image/webp', 'jpg': 'image/jpeg'}[f.rsplit('.', 1)[1]]
    with open(p, 'rb') as h: return f'data:{mime};base64,' + base64.b64encode(h.read()).decode()

# the reference pictures: [file, crop box or None] each, shown side by side at the sheet's height
R = 'reference/cast/'
REFS = {
    'io': [[R + 'envoi-io-cast.png', [115, 68, 161, 250]], [R + 'envoi-io-walk.webp', [0, 576, 192, 192]], [R + 'envoi-io-walk.webp', [0, 192, 192, 192]]],
    'sol': [[R + 'envoi-sol-walk.webp', [0, 0, 200, 178]], [R + 'envoi-sol-walk.webp', [0, 534, 200, 178]], [R + 'envoi-sol-walk.webp', [0, 178, 200, 178]]],
    'halcyon': [[R + 'envoi-halcyon-walk.webp', [0, 0, 172, 178]], [R + 'envoi-halcyon-walk.webp', [0, 534, 172, 178]], [R + 'envoi-halcyon-walk.webp', [0, 178, 172, 178]]],
    'quill': [[R + 'envoi-quill-walk.webp', [0, 0, 174, 178]], [R + 'envoi-quill-walk.webp', [0, 534, 174, 178]], [R + 'envoi-quill-walk.webp', [0, 178, 174, 178]]],
    'brann': [[R + 'envoi-brann-walk.webp', None]],
    'tock': [[R + 'envoi-tock-walk.webp', None]],
    'jester': [[R + 'moonfaire-jester-hd.webp', None], [R + 'moonfaire-jester.png', None]],
    'ranger': [[R + 'moonfaire-ranger-hd.webp', None], [R + 'moonfaire-ranger.png', None]],
    'herbal': [[R + 'moonfaire-herbal_witch-hd.webp', None], [R + 'moonfaire-herbal_witch.png', None]],
    'fox': [[R + 'moonfaire-fox-hd.webp', None], [R + 'moonfaire-fox.png', None]],
}
imgs = {}
for refs in REFS.values():
    for f, _ in refs: imgs[f] = data_url(f)
cast_src = rd('src/claim/cast.js') if os.path.exists(os.path.join(ROOT, 'src/claim/cast.js')) else 'const HERO_LOOKS = {};'
portraits = os.path.join(ROOT, 'assets/cast')
for f in sorted(os.listdir(portraits)) if os.path.isdir(portraits) else []:
    if f.endswith('.png'): imgs['assets/cast/' + f] = data_url('assets/cast/' + f)

# the claim's own code: mulberry from core.js, then pixel.js and cast.js, as they are joined in the build
core = rd('src/claim/core.js')
mul = next(l for l in core.splitlines() if l.startswith('function mulberry'))
script = mul + '\n' + rd('src/claim/pixel.js') + '\n' + cast_src + '\nwindow.__px = { drawVillagerSheet, randomLook, mulberry, PX, HERO_LOOKS };'

JS = r'''async ([IMGS, REFS, ONLY]) => {
  const { drawVillagerSheet, randomLook, mulberry, PX, HERO_LOOKS } = window.__px;
  const load = src => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const pics = {}; for (const [k, v] of Object.entries(IMGS)) if (v) pics[k] = await load(v);
  const GRASS = '#5f8a3e', GRASS2 = '#557d37', INKC = '#1e1420', PAPER = '#efe4c8';
  const ids = Object.keys(HERO_LOOKS).filter(id => !ONLY.length || ONLY.includes(id));
  const sheets = {}; for (const id of ids) sheets[id] = drawVillagerSheet(HERO_LOOKS[id]);
  const R = mulberry(7), vill = [];
  for (let i = 0; i < 6; i++) vill.push(drawVillagerSheet(randomLook(R, { gnome: i === 4 })));
  const grass = (ctx, w, h) => { ctx.fillStyle = GRASS; ctx.fillRect(0, 0, w, h); ctx.fillStyle = GRASS2; for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 8; x < w; x += 16) ctx.fillRect(x, y, 8, 8); };
  const label = (ctx, t, x, y, size = 18) => { ctx.font = `bold ${size}px monospace`; ctx.fillStyle = INKC; ctx.fillText(t, x + 1, y + 1); ctx.fillStyle = PAPER; ctx.fillText(t, x, y); };

  // ---- review: sheet at 4x | references | portrait at 3x
  const S = 4, SW = PX.FW * PX.COLS * S, SH = PX.FH * PX.ROWS * S, PAD = 16, ROWH = SH + 40;
  const refW = id => (REFS[id] || []).reduce((w, [f, box]) => { const p = pics[f]; if (!p) return w; const bw = box ? box[2] : p.width, bh = box ? box[3] : p.height; return w + Math.round(bw * SH / bh) + PAD; }, 0);
  const W = Math.max(400, ...ids.map(id => SW + PAD * 3 + refW(id) + 112 * 3)) + PAD;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = ROWH * ids.length + PAD;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; grass(ctx, cv.width, cv.height);
  ids.forEach((id, n) => {
    const y = PAD + n * ROWH + 24, L = HERO_LOOKS[id];
    label(ctx, `${id}: ${L.name || ''}${L.title ? ', ' + L.title : ''}`, PAD, y - 6);
    ctx.drawImage(sheets[id], PAD, y, SW, SH);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; for (let c = 1; c < PX.COLS; c++) ctx.strokeRect(PAD + c * PX.FW * S, y, 0.5, SH); for (let r = 1; r < PX.ROWS; r++) ctx.strokeRect(PAD, y + r * PX.FH * S, SW, 0.5);
    let x = PAD * 2 + SW;
    for (const [f, box] of REFS[id] || []) {
      const p = pics[f]; if (!p) continue;
      const [bx, by, bw, bh] = box || [0, 0, p.width, p.height], w = Math.round(bw * SH / bh);
      ctx.imageSmoothingEnabled = !f.includes('moonfaire') || f.includes('-hd') ? true : false;
      ctx.drawImage(p, bx, by, bw, bh, x, y, w, SH); x += w + PAD;
    }
    ctx.imageSmoothingEnabled = false;
    const por = pics['assets/cast/' + id + '.png'];
    if (por) ctx.drawImage(por, x, y + (SH - por.height * 3) / 2, por.width * 3, por.height * 3);
  });
  const review = cv.toDataURL('image/png');

  // ---- lineup: villagers then the cast, at 1x and 2x (front stand, side step, back), and every sheet at 1x
  const all = [...vill.map((s, i) => ['villager ' + (i + 1), s]), ...ids.map(id => [id, sheets[id]])];
  const frames = [[0, 0], [2, 1], [1, 0], [0, 3]];
  const lw = Math.max(all.length * (PX.FW * PX.COLS + 8) + 16, all.length * frames.length * PX.FW * 2 + 16, 800);
  const lc = document.createElement('canvas'); lc.width = lw; lc.height = 470;
  const lx = lc.getContext('2d'); lx.imageSmoothingEnabled = false; grass(lx, lw, lc.height);
  label(lx, 'every sheet at 1x', 8, 18, 14);
  all.forEach(([, s], i) => lx.drawImage(s, 8 + i * (PX.FW * PX.COLS + 8), 26));
  for (const [sc, y0, t] of [[1, 150, '1x: front, side step, back, work'], [2, 230, '2x']]) {
    label(lx, t, 8, y0 - 6, 14);
    let x = 8;
    all.forEach(([, s]) => { for (const [r, c] of frames) { lx.drawImage(s, c * PX.FW, r * PX.FH, PX.FW, PX.FH, x, y0, PX.FW * sc, PX.FH * sc); x += PX.FW * sc; } x += sc === 1 ? 6 : 4; });
  }
  // as the game shows them: a 2 m sprite about 48 px tall on screen, smoothly filtered (mipmaps)
  label(lx, 'smooth, about 48 px tall (in game)', 8, 316, 14);
  lx.imageSmoothingEnabled = true; lx.imageSmoothingQuality = 'high';
  let x = 8; all.forEach(([, s]) => { lx.drawImage(s, 0, 0, PX.FW, PX.FH, x, 324, 36, 48); lx.drawImage(s, PX.FW, PX.FH * 2, PX.FW, PX.FH, x + 38, 324, 36, 48); x += 80; });
  label(lx, 'smooth, about 32 px tall', 8, 400, 14);
  x = 8; all.forEach(([, s]) => { lx.drawImage(s, 0, 0, PX.FW, PX.FH, x, 408, 24, 32); lx.drawImage(s, PX.FW, PX.FH * 2, PX.FW, PX.FH, x + 26, 408, 24, 32); x += 56; });
  return [review, lc.toDataURL('image/png')];
}'''

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 800, 'height': 600})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: print('console:', m.text[:300]) if m.type == 'error' else None)
    pg.set_content('<!doctype html><html><body></body></html>')
    pg.add_script_tag(content=script)
    review, lineup = pg.evaluate(JS, [imgs, REFS, only])
    b.close()
for e in errors: print('PAGE ERROR', e)
for path, url in ((out, review), (stem + '-lineup.png', lineup)):
    with open(path, 'wb') as h: h.write(base64.b64decode(url.split(',', 1)[1]))
    print('wrote', path)
sys.exit(1 if errors else 0)
