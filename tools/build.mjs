// build.mjs: makes Brightvein one page with everything inside it (three.js, the claim, the skies, every texture,
// map tile and ship part), so it opens with no internet.
//   dist/brightvein.html            the page, to open in a browser
//   dist/brightvein.artifact.html   the same page without the document around it, for publishing on claude.ai
//   dist/test.html                  the artifact page inside the same skeleton claude.ai wraps around it (for tests)
// The claim (src/claim/) is one shared scope: its files are joined in the order of src/claim/order.json into one
// module, which then imports the skies (src/sky/) and the ships (src/ship/, src/ships/) as ordinary modules.
// Run: node tools/build.mjs   (after `npm install`)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', avif: 'image/avif' };
const minify = !process.argv.includes('--debug');

// the claim's textures, as one object of data URLs the claim code looks up by name
const assets = {};
for (const f of fs.readdirSync(path.join(ROOT, 'assets/claim')).sort()) {
  const mime = MIME[f.split('.').pop()]; if (!mime) continue;
  assets[f.replace(/\.\w+$/, '')] = `data:${mime};base64,` + fs.readFileSync(path.join(ROOT, 'assets/claim', f)).toString('base64');
}
// pictures the claim shows as they are, by folder and name: ART.cast.io (the cast's portraits), ART.items['wind-rifle']
// (painted item pictures, named after the item's base id in src/claim/loot.js), ART.events.wedding (the day events'
// cards, named after the event's id in src/claim/events.js; docs/art-requests/04-events.md), ART.skies.citadel (the
// places to raid, on the Sky Dock's raid map; docs/art-requests/06-skies.md)
const art = {};
for (const dir of ['cast', 'items', 'portraits', 'events', 'skies']) {
  art[dir] = {};
  const at = path.join(ROOT, 'assets', dir);
  if (!fs.existsSync(at)) continue;
  for (const f of fs.readdirSync(at).sort()) {
    const mime = MIME[f.split('.').pop()]; if (!mime) continue;
    art[dir][f.replace(/\.\w+$/, '')] = `data:${mime};base64,` + fs.readFileSync(path.join(at, f)).toString('base64');
  }
}
// join the claim's files into one module
const order = JSON.parse(rd('src/claim/order.json'));
const parts = order.map((f) => `// ---- ${f}\n` + rd('src/claim/' + f));
const claim = parts[0] + `\nconst ASSETS = ${JSON.stringify(assets)};\nconst ART = ${JSON.stringify(art)};\n` + parts.slice(1).join('\n');
fs.mkdirSync(path.join(ROOT, '.build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/.claim.gen.js'), claim);

const out = await build({
  entryPoints: [path.join(ROOT, 'src/.claim.gen.js')], bundle: true, format: 'iife', minify, target: 'es2020', write: false,
  loader: { '.webp': 'dataurl', '.avif': 'dataurl', '.png': 'dataurl', '.woff': 'dataurl', '.json': 'json' }, legalComments: 'none', logLevel: 'warning',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const font = (f) => `data:font/${f.split('.').pop()};base64,` + fs.readFileSync(path.join(ROOT, 'assets/fonts', f)).toString('base64');
// the skies' fonts (from the airship game's stage 4), each put in where src/sky/sky.css names it (/*FONT_CINZEL*/...)
const SKY_FONTS = { CINZEL: 'cinzel.woff2', FIRA_400: 'fira-sans-400.woff2', FIRA_500: 'fira-sans-500.woff2', FIRA_600: 'fira-sans-600.woff2' };

// Two stylesheets share the page: the claim's (src/style.css) inside #app, and the skies' (src/sky/sky.css) inside
// #sky. Each rule is scoped to its own box so the two never touch: `.panel` becomes `#app .panel` and `#sky .panel`.
// Rules for the page itself (:root, html, body, and anything already starting with body or the box) stay as written.
function scopeCss(css, box) {
  const top = (sel) => {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  };
  const one = (sel) => {
    if (sel === ':root') return box === '#app' ? sel : box;
    if (/^(html|body)\b/.test(sel) || sel === box || sel.startsWith(box + ' ') || sel.startsWith(box + '[') || sel.startsWith(box + '.') || sel.startsWith(box + ':')) return sel;
    return `${box} ${sel}`;
  };
  function rules(src) {
    let out = '', i = 0;
    while (i < src.length) {
      const open = src.indexOf('{', i);
      if (open < 0) { out += src.slice(i); break; }
      const head = src.slice(i, open).trim();
      let d = 1, j = open + 1;
      while (d && j < src.length) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; }
      const body = src.slice(open + 1, j - 1);
      if (/^@(media|supports)/.test(head)) out += `${head} {${rules(body)}}\n`;
      else if (head.startsWith('@')) out += `${head} {${body}}\n`;
      else out += `${top(head).map(one).join(', ')} {${body}}\n`;
      i = j;
    }
    return out;
  }
  return rules(css.replace(/\/\*(?!FONT_)[\s\S]*?\*\//g, ''));
}
let css = (scopeCss(rd('src/style.css'), '#app') + scopeCss(rd('src/sky/sky.css'), '#sky'))
  .replaceAll('/*FONT_DISPLAY*/', font('jacquard-12.woff')).replaceAll('/*FONT_BODY*/', font('pixelify-sans.woff'));
for (const [k, f] of Object.entries(SKY_FONTS)) css = css.replaceAll(`/*FONT_${k}*/`, font(f));
const page = rd('src/shell.html').replace('/*__CSS__*/', () => css).replace('<!--__SKY__-->', () => rd('src/sky/sky.html')).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
fs.writeFileSync(path.join(ROOT, 'dist/brightvein.artifact.html'), page);
fs.writeFileSync(path.join(ROOT, 'dist/brightvein.html'), `${head}</head><body>${page}</body></html>`);
fs.writeFileSync(path.join(ROOT, 'dist/test.html'), `${head}<style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`);
console.log(`dist/brightvein.html: ${(page.length / 1048576).toFixed(2)} MB (code ${(js.length / 1024 | 0)} KB)`);
