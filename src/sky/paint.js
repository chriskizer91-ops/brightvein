// paint.js: the colours the Captain's ships fly, chosen in port (Chris: a racing garage lives on its paint). Each ship
// has her own sails' dye and pennants' colour (progress.js: her `paint`), and a dye bought once is the Captain's for
// every ship. Some are bought with shards; some only won: by rising in rank (progress.js RANK_DYES) or with a star on
// the Maelstrom (STAR_DYES). Her pennants always keep their gold hoist, and no dye is a raider's rust or crimson or a
// raider captain's black (the check holds every dye to that: notRaider), so she never looks like one of them.
// A ship's sails and pennants are her own copies of their materials already (src/ship/dress.js), so dyeing them is
// only their colour: no new shaders, nothing more to draw.
import * as THREE from 'three';

// sails: a colour the canvas is dyed (it multiplies the painted canvas); pennants: their body's colour (as light, as
// the pennant's own colours are). `price` in shards, or won: `rank` (the rank that wins it) or `star` (its skies and
// wave)
export const DYES = {
  sailcloth: { kind: 'sails', name: 'Sailcloth', hex: 0xffffff, price: 0 },
  sky: { kind: 'sails', name: 'Sky blue', hex: 0x9fc4ee, price: 150 },
  sea: { kind: 'sails', name: 'Sea green', hex: 0x9fd1b4, price: 150 },
  honey: { kind: 'sails', name: 'Honey', hex: 0xf2d38a, price: 300 },
  twilight: { kind: 'sails', name: 'Twilight', hex: 0xb8a6e0, rank: 4 },
  dusk: { kind: 'sails', name: 'Dusk blue', hex: 0x7f8fd0, rank: 8 },
  storm: { kind: 'sails', name: 'Storm silver', hex: 0xc9ced8, star: ['mael', 10] },
  plum: { kind: 'pennant', name: 'Plum', rgb: [0.42, 0.1, 0.3], price: 0 },
  teal: { kind: 'pennant', name: 'Sky teal', rgb: [0.2, 0.62, 0.7], price: 80 },
  silver: { kind: 'pennant', name: 'Silver', rgb: [0.85, 0.86, 0.9], price: 120 },
  sunrise: { kind: 'pennant', name: 'Sunrise', rgb: [0.9, 0.24, 0.015], price: 120 }, // (a true orange: a golden one read as cream in the berth's warm light, like her hoist, and gold is a raider captain's)
  emerald: { kind: 'pennant', name: 'Emerald', rgb: [0.12, 0.55, 0.32], rank: 2 },
  royal: { kind: 'pennant', name: 'Royal blue', rgb: [0.12, 0.32, 0.62], rank: 6 },
  lightning: { kind: 'pennant', name: 'Lightning', rgb: [0.55, 0.85, 1], star: ['mael', 15] },
};
const CREAM = new THREE.Color(0xfff2dc), HOIST = 0.12; // (the canvas's own glow; the pennant's gold hoist, its first 12%)
const sail = new THREE.Color(), glow = new THREE.Color();
// a dye's colour as red, green and blue from 0 to 1 (a sail's as painted, a pennant's as light)
export const rgbOf = (D) => (D.rgb ? D.rgb : [(D.hex >> 16 & 255) / 255, (D.hex >> 8 & 255) / 255, (D.hex & 255) / 255]);
// and as the screen shows it: a sail's as painted, a pennant's light brought to the screen's
const onScreen = (D) => (D.rgb ? D.rgb.map((x) => x ** (1 / 2.2)) : rgbOf(D));
// what a dye looks like on a swatch in port: a sail's over the cream canvas, a pennant's as the screen shows it
export function swatch(id) {
  const D = DYES[id], [r, g, b] = onScreen(D), C = D.rgb ? [r, g, b] : [r * 0.93, g * 0.86, b * 0.72];
  return `rgb(${C.map((x) => Math.round(Math.min(1, x) * 255)).join(', ')})`;
}
// whether a dye could be mistaken for a raider's: a red hue (within 25 degrees of red, more than a little coloured: a
// crew's rust, a captain's crimson, a treasure ship's wine), or too dark (a captain's black). Hue, saturation and
// lightness as in CSS, of the colour as the screen shows it (a pennant's light, judged as it is, read redder than it
// looks: an orange one seemed red). The two she's built with (sailcloth and her plum) are hers, and not held to it
export function notRaider(id) {
  const [r, g, b] = onScreen(DYES[id]), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) * 60 : mx === g ? (2 + (b - r) / d) * 60 : (4 + (r - g) / d) * 60;
  h = (h + 360) % 360;
  return !((h < 25 || h > 335) && s > 0.35) && l >= 0.3;
}
// a ship dressed in her colours (sails: her canvas dyed, its glow seven parts the dye to three of cream; her pennants'
// bodies, past their hoist): on her model as built for her, in port, on the title and at sea
export function applyPaint(ship, paint) {
  const S = DYES[paint?.sails] ?? DYES.sailcloth, P = DYES[paint?.pennant] ?? DYES.plum, pr = P.rgb;
  sail.setHex(S.hex); glow.setHex(S.hex).lerp(CREAM, 0.3);
  ship.root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'canvas') { o.material.color.copy(sail); o.material.emissive.copy(glow); }
    else if (o.name === 'flag') {
      const col = o.geometry.attributes.color, bil = o.geometry.attributes.billow;
      if (!col || !bil) return;
      let changed = false;
      for (let i = 0; i < col.count; i++) if (bil.getX(i) >= HOIST && (col.getX(i) !== pr[0] || col.getY(i) !== pr[1] || col.getZ(i) !== pr[2])) { col.setXYZ(i, pr[0], pr[1], pr[2]); changed = true; }
      if (changed) col.needsUpdate = true;
    }
  });
  ship.paint = { sails: paint?.sails ?? 'sailcloth', pennant: paint?.pennant ?? 'plum' };
  return ship;
}
// how a dye is got, in words (for the port, when it isn't hers yet): its price, or what wins it
export function howGot(id, ranks) {
  const D = DYES[id];
  if (D.star) return `Won with the ${D.star[0] === 'mael' ? 'Maelstrom' : D.star[0]}'s wave ${D.star[1]} star`;
  if (D.rank) return `Won at the rank of ${ranks[D.rank]}`;
  return `◆ ${D.price.toLocaleString('en')}`;
}
