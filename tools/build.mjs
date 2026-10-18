// Build: concatenates src/*.js in load order into one module, inlines CSS and assets, writes dist/.
//   node tools/build.mjs            → dist/brightvein.html (the artifact) and dist/test.html (local test page)
import fs from 'fs';
import path from 'path';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
// load order matters: everything shares one module scope
const FILES = JSON.parse(rd('src/order.json'));
const assets = {};
for (const f of fs.readdirSync(path.join(ROOT, 'assets')).sort()) {
  const ext = f.split('.').pop(), mime = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', avif: 'image/avif' }[ext];
  if (!mime) continue;
  assets[f.replace(/\.\w+$/, '')] = `data:${mime};base64,` + fs.readFileSync(path.join(ROOT, 'assets', f)).toString('base64');
}
const parts = FILES.map(f => `// ---- ${f}\n` + rd('src/' + f));
const js = parts[0] + `\nconst ASSETS = ${JSON.stringify(assets)};\n` + parts.slice(1).join('\n');
const html = rd('src/shell.html').replace('/*__CSS__*/', () => rd('src/style.css')).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/brightvein.html'), html);
// local test page: the same skeleton the artifact host wraps around the page
fs.writeFileSync(path.join(ROOT, 'dist/test.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${html}</body></html>`);
console.log('built', (html.length / 1048576).toFixed(2) + ' MB', '· js', (js.length / 1024 | 0) + ' KB', '· assets', Object.keys(assets).length);
