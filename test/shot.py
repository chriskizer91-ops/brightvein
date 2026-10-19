# usage: shot.py out.png [w h] [js-to-run-after-load] [wait-ms]
import sys, os, json
from playwright.sync_api import sync_playwright
out=sys.argv[1]; w=int(sys.argv[2]) if len(sys.argv)>2 else 1280; h=int(sys.argv[3]) if len(sys.argv)>3 else 800
code=sys.argv[4] if len(sys.argv)>4 else ''; wait=int(sys.argv[5]) if len(sys.argv)>5 else 2500
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # this checkout (works in worktrees too)
def route(r):
    u=r.request.url
    if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u:
        p=root+'/node_modules/three/'+u.split('three@0.160.0/')[1]
        r.fulfill(path=p, content_type='application/javascript')
    elif 'fonts.g' in u: r.fulfill(body='', content_type='text/css')
    else: r.continue_()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':w,'height':h}, device_scale_factor=1); pg.set_default_timeout(240000)
    errs=[]
    pg.on('console',lambda m: print('console:',m.type,m.text[:300]) if m.type in ('error','warning') or m.text.startswith('DBG') else None)
    pg.on('pageerror',lambda e: print('PAGEERROR',e))
    pg.route('**/*', route)
    pg.goto('file://'+root+'/dist/test.html')
    pg.wait_for_timeout(wait)
    if code:
        r=pg.evaluate(code)
        if r is not None: print('eval:', json.dumps(r)[:2000])
        pg.wait_for_timeout(int(sys.argv[6]) if len(sys.argv)>6 else 1500)
    pg.screenshot(path=out)
    b.close()
