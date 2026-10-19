// portrait-prompts.mjs: writes docs/art-requests/03-portraits.md, the picture prompts for everyone on the claim, from
// the roll in src/claim/folk.js (so the pictures and the walking sprites describe the same people).
// Run: node tools/portrait-prompts.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const src = fs.readFileSync(path.join(ROOT, 'src/claim/folk.js'), 'utf8');
const { FOLK_FOUNDERS, FOLK_OTHERS, FOLK } = new Function(`${src}; return { FOLK_FOUNDERS, FOLK_OTHERS, FOLK };`)();

const STYLE = `Detailed HD pixel-art character portrait, in the same style as the visitors' portraits already in the game (assets/cast): crisp high-detail pixel art like a modern JRPG's dialogue portrait, a head-and-shoulders bust facing the viewer with a slight three-quarter turn, large expressive eyes with bright highlights, rich soft shading with plum-tinted shadows and warm cream highlights, dark coloured outlines (not pure black), gentle warm light from the upper left. A steampunk-solarpunk frontier in a world of airships and amber sunstone crystal: brass, canvas, leather, wool, small amber crystal details. Transparent background (or a flat dark plum, #2a1b2f, if transparency isn't possible). No text, no frame, no border. Square.`;

const lines = [];
lines.push('# Portraits for everyone on the claim');
lines.push('');
lines.push('In town, people stay pixel sprites. When you tap someone, their card shows their portrait, and so do the story scenes. These prompts are for those portraits.');
lines.push('');
lines.push('**Every settler on the claim comes from this list,** with the same name and looks as their portrait, so the sprite walking round town and the picture always match. (This file is written by `tools/portrait-prompts.mjs` from `src/claim/folk.js`. To change someone, edit them there and run the tool again.)');
lines.push('');
lines.push('## How to make them');
lines.push('');
lines.push('- Make each picture square, at least 1024 × 1024. The game shrinks them to 256 × 256.');
lines.push('- Save each as the file name given (PNG or WebP) and send them to me in the chat, a few at a time or all at once. They go in `assets/portraits/`.');
lines.push('- Anyone without a picture yet gets a bust drawn from their sprite, so there\'s no need to do them all at once. The six founders and the Baron come first.');
lines.push('- The ten visitors (Tamsin, Brisa, Dame Seraphine, Barnabus, Nib, Torvald and the Moon Faire\'s four) already have portraits, borrowed from your other games, so they aren\'t here.');
lines.push('');
lines.push('## The style, for every picture');
lines.push('');
lines.push('Paste this in front of each prompt below:');
lines.push('');
lines.push('> ' + STYLE);
lines.push('');
lines.push('## The founders');
lines.push('');
for (const [name, f] of Object.entries(FOLK_FOUNDERS)) {
  lines.push(`### ${name}`);
  lines.push(`File: \`${f.id}.png\``);
  lines.push('');
  lines.push(`> ${f.desc}`);
  lines.push('');
}
lines.push('## The Baron');
lines.push('');
for (const [id, f] of Object.entries(FOLK_OTHERS)) {
  lines.push(`### ${f.name}`);
  lines.push(`File: \`${id}.png\` (shown when his letters are read)`);
  lines.push('');
  lines.push(`> ${f.desc}`);
  lines.push('');
}
lines.push(`## The settlers (${FOLK.length})`);
lines.push('');
lines.push('They arrive as the claim grows, so the first few matter most: miners, tenders and gardeners turn up earliest.');
lines.push('');
const TRADE = { head: 'miner', yard: 'tender in the sunning yards', shop: 'lens cutter', garden: 'gardener', lens: 'lens-tower crew', wall: 'on the watch', keep: 'clerk at the Keep', mast: 'airship crew' };
for (const f of FOLK) {
  lines.push(`### ${f.name}, ${TRADE[f.pref]}`);
  lines.push(`File: \`${f.id}.png\``);
  lines.push('');
  lines.push(`> ${f.desc}`);
  lines.push('');
}
fs.mkdirSync(path.join(ROOT, 'docs/art-requests'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/art-requests/03-portraits.md'), lines.join('\n'));
console.log(`docs/art-requests/03-portraits.md: ${Object.keys(FOLK_FOUNDERS).length} founders, ${Object.keys(FOLK_OTHERS).length} other, ${FOLK.length} settlers`);
