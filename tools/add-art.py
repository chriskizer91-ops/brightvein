# add-art.py: brings Chris's generated pictures into the game, shrunk and saved as webp under their ids.
#   python3 tools/add-art.py portraits <picture> [<picture> ...]   -> assets/portraits/<id>.webp, 256 x 256
#   python3 tools/add-art.py items <picture> [<picture> ...]       -> assets/items/<id>.webp, 128 x 128
#   python3 tools/add-art.py cast <picture> [<picture> ...]        -> assets/cast/<id>.webp, 256 x 256
#   python3 tools/add-art.py events <picture> [<picture> ...]      -> assets/events/<id>.webp, 480 x 360 (4:3, cropped to fill)
#   python3 tools/add-art.py skies <picture> [<picture> ...]       -> assets/skies/<id>.webp, 480 x 360 (the places to raid)
# The id is the file's name without its extension (founder-hesper.png -> founder-hesper). A picture that isn't
# square is padded to square around its middle. A flat background colour sampled from the corners is made
# transparent when it's uniform (so pictures made without transparency still sit on the card's own background).
import sys, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = {'portraits': 256, 'items': 128, 'cast': 256, 'events': (480, 360), 'skies': (480, 360)}

def corners_flat(im):
    w, h = im.size
    px = [im.getpixel((x, y)) for x, y in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
    if any(p[3] < 250 for p in px): return None   # already transparent
    r, g, b = (sum(p[i] for p in px) / 4 for i in range(3))
    if all(abs(p[0] - r) + abs(p[1] - g) + abs(p[2] - b) < 24 for p in px): return (r, g, b)
    return None

def knock_out(im, col, tol=34):
    # flood from the edges: only background touching the border goes, so matching colours inside the figure stay
    w, h = im.size; px = im.load(); seen = bytearray(w * h); stack = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]: continue
        seen[y * w + x] = 1
        r, g, b, a = px[x, y]
        if abs(r - col[0]) + abs(g - col[1]) + abs(b - col[2]) > tol: continue
        px[x, y] = (r, g, b, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im

def main():
    kind, files = sys.argv[1], sys.argv[2:]
    size = SIZE[kind]
    out_dir = os.path.join(ROOT, 'assets', kind); os.makedirs(out_dir, exist_ok=True)
    for f in files:
        if kind in ('events', 'skies'):   # a landscape picture: crop to 4:3 around the middle, keep the background
            im = Image.open(f).convert('RGB'); w, h = im.size; tw, th = size
            if w / h > tw / th: nw = round(h * tw / th); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
            else: nh = round(w * th / tw); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
            im = im.resize((tw, th), Image.LANCZOS)
            name = os.path.splitext(os.path.basename(f))[0].lower().replace(' ', '-')
            out = os.path.join(out_dir, name + '.webp'); im.save(out, 'WEBP', quality=74, method=6)
            print(f'{out}  {os.path.getsize(out) // 1024} KB'); continue
        im = Image.open(f).convert('RGBA')
        col = corners_flat(im)
        if col: im = knock_out(im, col)
        w, h = im.size; s = max(w, h)
        sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - w) // 2, (s - h) // 2))
        sq = sq.resize((size, size), Image.LANCZOS)
        name = os.path.splitext(os.path.basename(f))[0].lower().replace(' ', '-')
        out = os.path.join(out_dir, name + '.webp')
        sq.save(out, 'WEBP', quality=90, method=6)
        print(f'{out}  {os.path.getsize(out) // 1024} KB' + ('  (background made transparent)' if col else ''))

main()
