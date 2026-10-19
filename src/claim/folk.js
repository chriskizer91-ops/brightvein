// ===================================================================== FOLK: the people of the claim, picture first
// Everyone on the claim has a painted portrait (shown on their card and in scenes) and a pixel sprite (walking round
// town). So that the two always match, settlers come from this roll: each has a name, what they look like in words
// (the picture prompt in docs/art-requests/03-portraits.md is built from it by tools/portrait-prompts.mjs), and the
// same look for the sprite. Their pictures go in assets/portraits/<id>.webp; until one arrives, the card draws a bust
// from the sprite. If the roll runs out, newcomers get a random look and no picture.
//   look: the sprite's look (see randomLook in pixel.js for the options)
const FOLK_FOUNDERS = {
  'Hesper Lark': { id: 'founder-hesper', desc: 'Captain of the Lark and a former sky courier, about 35. Windburned fair skin, long auburn-red hair swept back, green eyes, a bold half-smile. A brown leather flyer’s cap with brass goggles, a long teal coat over a cream shirt, a mustard-yellow scarf.' },
  'Odile Fenn': { id: 'founder-odile', desc: 'The lens grinder, about 50; she judges sunstone by the sound it makes. Tan skin, silver-grey hair in a bun, round spectacles, head tilted as if listening. A plum blouse under a brown leather apron, a tuning fork in her breast pocket and a jeweller’s loupe on a cord.' },
  'Pip Kettleby': { id: 'founder-pip', desc: 'The night-shift lookout, about 19, sleepy-eyed by day. Pale freckled skin, short ginger-orange hair under a grey flat cap, navy overalls over a cream shirt, a rust-red scarf, a small brass spyglass.' },
  'Marigold Thresh': { id: 'founder-marigold', desc: 'Gardener and beekeeper, about 40, with a warm, easy smile. Rosy skin, golden-blonde braids, a wide straw sun hat with a bee resting on the brim, a rose-pink scarf, an olive-green vest over a cream shirt.' },
  'Corwin Ashlar': { id: 'founder-corwin', desc: 'The wallwright, about 45; he says about four words a day. Deep brown skin, a bald head, a short black beard, a steady serious gaze. A grey work shirt with the sleeves rolled, a brown leather vest, stone dust on his shoulders, a brass plumb bob on a cord.' },
  'Absalom Pockett': { id: 'founder-absalom', desc: 'The claim’s assayer: an elderly gnome, kindly and a little mischievous. A white beard and bushy white brows, round spectacles, a tall rust-red gnome hat, a plum coat with brass buttons, a loupe in one eye and a big brass official stamp in his hand.' },
};
// note: when they're seen. look: for act two's visitors, the bust drawn until their painted portrait arrives.
const FOLK_OTHERS = {
  'baron-tallow': { name: 'Baron Ambrose Tallow', note: 'shown when his letters are read', desc: 'The claim-jumpers’ master, about 60, a candle-maker grown rich. Pale, waxy skin, silver hair slicked back, long mutton-chop whiskers, a polished and dangerous smile. A rust-red frock coat with black velvet lapels, a gold candle-flame pin, a lit candle in a brass holder held up beside his face.' },
  'provost-marchbank': { name: 'Provost Lucan Marchbank', note: 'act two: the Gilded Exchange’s man, in person and in his letters',
    desc: 'Provost of the Gilded Exchange, a counting-house in the coast cities, about 55. Pale, well-kept skin, neat silver hair parted on one side, small round gold spectacles, a thin polite smile that never reaches his grey eyes. A dove-grey frock coat buttoned high, a gold silk cravat with a coin-shaped pin, a slim ledger tucked under one arm.',
    look: { skin: '#ecd0b4', hair: '#cfc6b8', hairStyle: 'crop', fringe: 'parted', hat: null, shirt: '#e7dcc2', over: 'coat', overCol: '#7d8590', scarf: '#c99a3c', eyes: '#5a6a78', glasses: true, beard: false, satchel: false } },
  'captain-ferrars': { name: 'Juno Ferrars', note: 'act two: the Hollowcrest claim’s boss, across the gorge',
    desc: 'The boss of the rival Hollowcrest claim, about 30, brash and grinning. Warm brown skin, thick black hair in a high ponytail, brass flying goggles pushed up on her forehead, a confident sideways grin and a smudge of soot on one cheek. A battered brown leather flight jacket over a cream shirt, a green scarf, a prospector’s hammer on her shoulder.',
    look: { skin: '#b0764e', hair: '#2a1d1c', hairStyle: 'ponytail', fringe: 'swept', hat: 'goggles', hatCol: '#5a3a26', shirt: '#e7dcc2', over: 'coat', overCol: '#7a5234', scarf: '#3f7a5a', eyes: '#4a3020', glasses: false, beard: false, satchel: false } },
};
// [id, name, who, focus, trade, description, look]
const FOLK = [
  ['settler-01', 'Ottilie Ashdown', 'a young miner', 'G', 'head', 'A young woman, freckled fair skin, copper-red hair in a high ponytail, brass goggles pushed up on her forehead, ore dust on one cheek, grinning. A grey work shirt under navy canvas overalls.',
    { skin: '#f7d6b5', hair: '#b5562b', hairStyle: 'ponytail', fringe: 'swept', hat: 'goggles', hatCol: '#5a3a26', shirt: '#4f5660', over: 'overalls', overCol: '#2f3d5c', pants: '#2f3d4c', boots: '#5a3a26', eyes: '#2f4f6a', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-02', 'Jory Penhallow', 'a young tender', 'S', 'yard', 'A young man, warm brown skin, short black curls, a wide straw sun hat, a cream shirt with rolled sleeves, an olive-green vest, squinting cheerfully against the sun.',
    { skin: '#a86c48', hair: '#2a1d1c', hairStyle: 'curly', fringe: 'blunt', hat: 'brim', hatCol: '#b5832a', shirt: '#e7dcc2', over: 'vest', overCol: '#6f7f4c', pants: '#5a4632', boots: '#6a432a', eyes: '#4a3020', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-03', 'Maren Saltmarsh', 'a lens cutter', 'E', 'shop', 'A woman in her forties, tan skin, dark brown hair in a tidy bun, round spectacles, a plum blouse under a brown leather apron, a jeweller’s loupe on a cord, focused.',
    { skin: '#d39a6c', hair: '#4a2c20', hairStyle: 'bun', fringe: 'parted', hat: null, shirt: '#6b3a5e', over: 'apron', overCol: '#7a5234', pants: '#3f3a4a', boots: '#5a3a26', eyes: '#5a3a2a', beard: false, glasses: true, scarf: null, satchel: false }],
  ['settler-04', 'Silas Coalbrook', 'an old miner', 'G', 'head', 'An older man, deep brown skin, bald, a short grey beard, a grey flat cap, a rust-red scarf, a brown vest over a grey shirt, crinkled kind eyes.',
    { skin: '#5a3426', hair: '#cfc6b8', hairStyle: 'bald', fringe: 'swept', hat: 'flatcap', hatCol: '#4f5660', shirt: '#4f5660', over: 'vest', overCol: '#5a4632', pants: '#3f3a4a', boots: '#3e2a22', eyes: '#4a3020', beard: true, glasses: false, scarf: '#9a4430', satchel: false }],
  ['settler-05', 'Hettie Fairweather', 'a young gardener', 'S', 'garden', 'A young woman, rosy fair skin, honey-blonde braids, a green bandana, a cream shirt, an olive vest, a satchel of seed packets, soil on her fingers.',
    { skin: '#eebd93', hair: '#e8c46a', hairStyle: 'braids', fringe: 'blunt', hat: 'bandana', hatCol: '#3f7a5a', shirt: '#e7dcc2', over: 'vest', overCol: '#6f7f4c', pants: '#6b5a44', boots: '#8a5a34', eyes: '#3f5a2e', beard: false, glasses: false, scarf: null, satchel: true }],
  ['settler-06', 'Rook Dunmore', 'one of the watch', 'G', 'wall', 'A young man, olive-tan skin, black hair cropped short, dark stubble, a teal coat with brass buttons over a grey shirt, watchful and wry.',
    { skin: '#d39a6c', hair: '#2a1d1c', hairStyle: 'crop', fringe: 'swept', hat: null, shirt: '#4f5660', over: 'coat', overCol: '#2f5d62', pants: '#2f3d4c', boots: '#3e2a22', eyes: '#4a3020', beard: true, glasses: false, scarf: null, satchel: false }],
  ['settler-07', 'Linnea Hartwell', 'a clerk', 'R', 'keep', 'A woman in her forties, dark skin, long black hair, wire spectacles, a burgundy coat over a cream shirt, a ledger under her arm, a patient smile.',
    { skin: '#7a4a32', hair: '#2a1d1c', hairStyle: 'long', fringe: 'parted', hat: null, shirt: '#e7dcc2', over: 'coat', overCol: '#9a4430', pants: '#3f3a4a', boots: '#3e2a22', eyes: '#4a3020', beard: false, glasses: true, scarf: null, satchel: false }],
  ['settler-08', 'Ezra Quarrie', 'airship crew', 'A', 'mast', 'A young man, pale skin, shaggy dark brown hair under a leather flyer’s cap, a canvas duster coat in tan, a navy scarf, windblown and eager.',
    { skin: '#f7d6b5', hair: '#4a2c20', hairStyle: 'crop', fringe: 'swept', hat: 'cap', hatCol: '#5a3a26', shirt: '#d9cfb4', over: 'coat', overCol: '#7a5234', pants: '#5a4632', boots: '#5a3a26', eyes: '#2f4f6a', beard: false, glasses: false, scarf: '#2f3d5c', satchel: false }],
  ['settler-09', 'Calla Rowntree', 'an old tender', 'S', 'yard', 'An older woman, tan skin, a silver bob, a plum wide-brimmed hat, a cream shirt, a mustard vest, deep laugh lines.',
    { skin: '#d39a6c', hair: '#cfc6b8', hairStyle: 'bob', fringe: 'blunt', hat: 'brim', hatCol: '#6b3a5e', shirt: '#e7dcc2', over: 'vest', overCol: '#b5832a', pants: '#6b5a44', boots: '#6a432a', eyes: '#5a3a2a', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-10', 'Tobin Greaves', 'a big miner', 'G', 'head', 'A big young man, fair skin, short red-brown hair, a red beard, a rust-red bandana, brown overalls over a cream shirt, broad shoulders, cheerful.',
    { skin: '#eebd93', hair: '#7a4526', hairStyle: 'crop', fringe: 'swept', hat: 'bandana', hatCol: '#9a4430', shirt: '#d9cfb4', over: 'overalls', overCol: '#5a4632', pants: '#5a4632', boots: '#3e2a22', eyes: '#3f5a2e', beard: true, glasses: false, scarf: null, satchel: false }],
  ['settler-11', 'Greer Whitlock', 'lens-tower crew', 'A', 'lens', 'A young woman, brown skin, long black braids, brass goggles on her forehead, a navy vest over a cream shirt, sharp eyes on the horizon.',
    { skin: '#a86c48', hair: '#2a1d1c', hairStyle: 'braids', fringe: 'parted', hat: 'goggles', hatCol: '#5a3a26', shirt: '#e7dcc2', over: 'vest', overCol: '#2f3d5c', pants: '#2f3d4c', boots: '#5a3a26', eyes: '#4a3020', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-12', 'Aldous Merriwether', 'an old clerk', 'R', 'keep', 'An old man, fair skin, short white hair and a long white beard, round spectacles, a plum coat, a quill behind his ear, twinkling.',
    { skin: '#f7d6b5', hair: '#efece4', hairStyle: 'crop', fringe: 'parted', hat: null, shirt: '#e7dcc2', over: 'coat', overCol: '#6b3a5e', pants: '#3f3a4a', boots: '#3e2a22', eyes: '#2f4f6a', beard: true, glasses: true, scarf: null, satchel: false }],
  ['settler-13', 'Peony Larkspur', 'a gardener', 'S', 'garden', 'A young woman, deep brown skin, a cloud of black curls, a straw sun hat, a rose-pink scarf, a green apron over a cream shirt, a trowel in hand.',
    { skin: '#5a3426', hair: '#2a1d1c', hairStyle: 'curly', fringe: 'blunt', hat: 'brim', hatCol: '#b5832a', shirt: '#e7dcc2', over: 'apron', overCol: '#6f7f4c', pants: '#6b5a44', boots: '#8a5a34', eyes: '#4a3020', beard: false, glasses: false, scarf: '#a8577a', satchel: false }],
  ['settler-14', 'Ivo Tremayne', 'a lens cutter', 'E', 'shop', 'A man in his forties, olive skin, dark hair neatly parted, a trim moustache and beard, a teal shirt under a brown leather apron, a lens held up to one eye.',
    { skin: '#d39a6c', hair: '#3b2f45', hairStyle: 'crop', fringe: 'parted', hat: null, shirt: '#2f5d62', over: 'apron', overCol: '#7a5234', pants: '#3f3a4a', boots: '#3e2a22', eyes: '#5a3a2a', beard: true, glasses: false, scarf: null, satchel: false }],
  ['settler-15', 'Saffi Yarrow', 'a tender', 'S', 'yard', 'A young woman, fair skin, chestnut hair in a bun, a green hood, a cream shirt, a mustard vest, amber light on her face.',
    { skin: '#eebd93', hair: '#7a4526', hairStyle: 'bun', fringe: 'swept', hat: 'hood', hatCol: '#3f7a5a', shirt: '#e7dcc2', over: 'vest', overCol: '#b5832a', pants: '#5a4632', boots: '#6a432a', eyes: '#3f5a2e', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-16', 'Bastian Farrow', 'one of the watch', 'G', 'wall', 'A man in his forties, brown skin, a shaved head, a full black beard, a grey coat, a satchel strap across his chest, calm and immovable.',
    { skin: '#a86c48', hair: '#2a1d1c', hairStyle: 'bald', fringe: 'swept', hat: null, shirt: '#e7dcc2', over: 'coat', overCol: '#4f5660', pants: '#2f3d4c', boots: '#3e2a22', eyes: '#4a3020', beard: true, glasses: false, scarf: null, satchel: true }],
  ['settler-17', 'Nell Thistlewood', 'an old miner', 'G', 'head', 'An older woman, weathered fair skin, grey hair in a bun under a brown flat cap, navy overalls, forearms like a blacksmith’s, a no-nonsense look.',
    { skin: '#eebd93', hair: '#cfc6b8', hairStyle: 'bun', fringe: 'swept', hat: 'flatcap', hatCol: '#5a3a26', shirt: '#d9cfb4', over: 'overalls', overCol: '#2f3d5c', pants: '#2f3d4c', boots: '#3e2a22', eyes: '#2f4f6a', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-18', 'Caspar Jessop', 'airship crew', 'A', 'mast', 'A young man, dark skin, long locs tied back, a teal flyer’s cap, a brown leather coat, an easy grin.',
    { skin: '#7a4a32', hair: '#2a1d1c', hairStyle: 'long', fringe: 'swept', hat: 'cap', hatCol: '#2f5d62', shirt: '#e7dcc2', over: 'coat', overCol: '#7a5234', pants: '#5a4632', boots: '#5a3a26', eyes: '#4a3020', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-19', 'Wynn Upton', 'lens-tower crew', 'A', 'lens', 'A young person, fair skin, an ash-blonde bob, brass goggles, a rust-orange vest over a cream shirt, quick and curious.',
    { skin: '#f7d6b5', hair: '#cfc6b8', hairStyle: 'bob', fringe: 'blunt', hat: 'goggles', hatCol: '#5a3a26', shirt: '#e7dcc2', over: 'vest', overCol: '#c76b3a', pants: '#3f3a4a', boots: '#5a3a26', eyes: '#2f4f6a', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-20', 'Delphine Marlow', 'a gardener', 'S', 'garden', 'A woman in her forties, tan skin, long auburn hair, a green wide-brimmed hat, an olive apron over a cream shirt, a basket of greens.',
    { skin: '#d39a6c', hair: '#b5562b', hairStyle: 'long', fringe: 'parted', hat: 'brim', hatCol: '#3f7a5a', shirt: '#e7dcc2', over: 'apron', overCol: '#6f7f4c', pants: '#6b5a44', boots: '#8a5a34', eyes: '#3f5a2e', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-21', 'Fitz Gilchrist', 'a young miner', 'G', 'head', 'A young man, freckled fair skin, sandy hair, a rust-red cap, a brown vest over a grey shirt, a cheeky grin with a chipped tooth.',
    { skin: '#f7d6b5', hair: '#d98a3a', hairStyle: 'crop', fringe: 'swept', hat: 'cap', hatCol: '#9a4430', shirt: '#4f5660', over: 'vest', overCol: '#5a4632', pants: '#5a4632', boots: '#3e2a22', eyes: '#3f5a2e', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-22', 'Rosalind Everly', 'a clerk', 'R', 'keep', 'A young woman, brown skin, hair in a neat bun, spectacles, a teal coat, a mustard scarf, a pencil behind her ear, warm and sharp.',
    { skin: '#a86c48', hair: '#4a2c20', hairStyle: 'bun', fringe: 'parted', hat: null, shirt: '#e7dcc2', over: 'coat', overCol: '#2f5d62', pants: '#3f3a4a', boots: '#3e2a22', eyes: '#4a3020', beard: false, glasses: true, scarf: '#b5832a', satchel: false }],
  ['settler-23', 'Emrys Sedgwick', 'an old tender', 'S', 'yard', 'An old man, tan skin, short white hair and a white beard, a brown wide-brimmed hat, a green vest, gentle and unhurried.',
    { skin: '#d39a6c', hair: '#efece4', hairStyle: 'crop', fringe: 'swept', hat: 'brim', hatCol: '#5a3a26', shirt: '#d9cfb4', over: 'vest', overCol: '#3f7a5a', pants: '#6b5a44', boots: '#6a432a', eyes: '#5a3a2a', beard: true, glasses: false, scarf: null, satchel: false }],
  ['settler-24', 'Juniper Oakes', 'one of the watch', 'G', 'wall', 'A young woman, deep brown skin, close-cropped hair, a rust-orange bandana, a grey coat, a satchel, fearless.',
    { skin: '#5a3426', hair: '#2a1d1c', hairStyle: 'crop', fringe: 'blunt', hat: 'bandana', hatCol: '#c76b3a', shirt: '#e7dcc2', over: 'coat', overCol: '#4f5660', pants: '#2f3d4c', boots: '#3e2a22', eyes: '#4a3020', beard: false, glasses: false, scarf: null, satchel: true }],
  ['settler-25', 'Lorcan Winslow', 'a lens cutter', 'E', 'shop', 'A young man, pale skin, black curly hair, round spectacles, a plum shirt under a brown leather apron, earnest and bookish.',
    { skin: '#f7d6b5', hair: '#2a1d1c', hairStyle: 'curly', fringe: 'blunt', hat: null, shirt: '#6b3a5e', over: 'apron', overCol: '#7a5234', pants: '#3f3a4a', boots: '#3e2a22', eyes: '#2f4f6a', beard: false, glasses: true, scarf: null, satchel: false }],
  ['settler-26', 'Mabel Hollins', 'an old clerk', 'R', 'keep', 'An older woman, dark skin, short white curls, spectacles, a rose-pink coat over a cream shirt, a twinkle of mischief.',
    { skin: '#7a4a32', hair: '#efece4', hairStyle: 'curly', fringe: 'blunt', hat: null, shirt: '#e7dcc2', over: 'coat', overCol: '#a8577a', pants: '#3f3a4a', boots: '#3e2a22', eyes: '#4a3020', beard: false, glasses: true, scarf: null, satchel: false }],
  ['settler-27', 'Osric Pryce', 'airship crew', 'A', 'mast', 'A man in his forties, fair skin, long red hair in a ponytail, a red beard, brass goggles on his forehead, a navy coat, weathered by the sky.',
    { skin: '#eebd93', hair: '#b5562b', hairStyle: 'ponytail', fringe: 'swept', hat: 'goggles', hatCol: '#5a3a26', shirt: '#d9cfb4', over: 'coat', overCol: '#2f3d5c', pants: '#2f3d4c', boots: '#5a3a26', eyes: '#2f4f6a', beard: true, glasses: false, scarf: null, satchel: false }],
  ['settler-28', 'Una Ingleby', 'a young miner', 'G', 'head', 'A young woman, tan skin, a black ponytail, brass goggles, brown overalls over a grey shirt, determined.',
    { skin: '#d39a6c', hair: '#2a1d1c', hairStyle: 'ponytail', fringe: 'parted', hat: 'goggles', hatCol: '#5a3a26', shirt: '#4f5660', over: 'overalls', overCol: '#5a4632', pants: '#5a4632', boots: '#3e2a22', eyes: '#4a3020', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-29', 'Quentin Lowry', 'a gardener', 'S', 'garden', 'A man in his fifties, brown skin, greying dark hair, an olive hood, a green apron, a gentle face.',
    { skin: '#a86c48', hair: '#3b2f45', hairStyle: 'crop', fringe: 'swept', hat: 'hood', hatCol: '#6f7f4c', shirt: '#d9cfb4', over: 'apron', overCol: '#3f7a5a', pants: '#6b5a44', boots: '#6a432a', eyes: '#4a3020', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-30', 'Willa Rushworth', 'lens-tower crew', 'A', 'lens', 'A young woman, fair skin, blonde braids, a teal flyer’s cap, a rust-red vest over a cream shirt, freckles, bright-eyed.',
    { skin: '#eebd93', hair: '#e8c46a', hairStyle: 'braids', fringe: 'swept', hat: 'cap', hatCol: '#2f5d62', shirt: '#e7dcc2', over: 'vest', overCol: '#9a4430', pants: '#3f3a4a', boots: '#5a3a26', eyes: '#2f4f6a', beard: false, glasses: false, scarf: null, satchel: false }],
  ['settler-31', 'Zillah Vane', 'one of the watch', 'G', 'wall', 'A woman in her forties, deep brown skin, long black braids, a grey hood, a plum coat, a scar across one eyebrow, unshakeable.',
    { skin: '#5a3426', hair: '#2a1d1c', hairStyle: 'braids', fringe: 'parted', hat: 'hood', hatCol: '#4f5660', shirt: '#e7dcc2', over: 'coat', overCol: '#6b3a5e', pants: '#2f3d4c', boots: '#3e2a22', eyes: '#4a3020', beard: false, glasses: false, scarf: null, satchel: false }],
  ['gnome-01', 'Tibbet Brasswhistle', 'a gnome lens cutter', 'E', 'shop', 'A gnome, rosy cheeks, a fluffy white beard, round spectacles, a tall rust-red gnome hat, a teal coat with brass buttons, a tiny screwdriver behind one ear.',
    { gnome: true, skin: '#eebd93', hair: '#efece4', hairStyle: 'bald', fringe: 'swept', hat: 'gnome', hatCol: '#9a4430', shirt: '#e7dcc2', over: 'coat', overCol: '#2f5d62', pants: '#3f3a4a', boots: '#5a3a26', eyes: '#2f4f6a', beard: true, glasses: true, scarf: null, satchel: false }],
  ['gnome-02', 'Orsolya Gearwhit', 'a gnome engineer', 'E', 'shop', 'A gnome woman, rosy cheeks, silver hair in two braids, a tall teal gnome hat, brass goggles, a mustard apron, a grin full of ideas.',
    { gnome: true, skin: '#f7d6b5', hair: '#cfc6b8', hairStyle: 'bald', fringe: 'swept', hat: 'gnome', hatCol: '#2f5d62', shirt: '#e7dcc2', over: 'apron', overCol: '#b5832a', pants: '#3f3a4a', boots: '#5a3a26', eyes: '#3f5a2e', beard: false, glasses: false, scarf: null, satchel: false }],
  ['gnome-03', 'Nackle Tumbleby', 'a gnome clerk', 'R', 'keep', 'A gnome, a bushy ginger beard, spectacles, a tall green gnome hat, a plum vest, a ledger as big as he is.',
    { gnome: true, skin: '#eebd93', hair: '#b5562b', hairStyle: 'bald', fringe: 'swept', hat: 'gnome', hatCol: '#3f7a5a', shirt: '#e7dcc2', over: 'vest', overCol: '#6b3a5e', pants: '#3f3a4a', boots: '#5a3a26', eyes: '#4a3020', beard: true, glasses: true, scarf: null, satchel: false }],
  ['gnome-04', 'Wimble Nubbins', 'a gnome miner', 'G', 'head', 'A gnome, a straw-yellow beard, a tall plum gnome hat with a miner’s lamp strapped to it, navy overalls, ore dust everywhere.',
    { gnome: true, skin: '#d39a6c', hair: '#e8c46a', hairStyle: 'bald', fringe: 'swept', hat: 'gnome', hatCol: '#6b3a5e', shirt: '#d9cfb4', over: 'overalls', overCol: '#2f3d5c', pants: '#2f3d4c', boots: '#3e2a22', eyes: '#5a3a2a', beard: true, glasses: false, scarf: null, satchel: false }],
  ['gnome-05', 'Fennimore Pockett', 'a gnome gardener', 'S', 'garden', 'A gnome, Absalom’s cousin, a neat white beard, a tall olive gnome hat with a sprig of herbs in it, a cream shirt and an olive vest, a watering can.',
    { gnome: true, skin: '#eebd93', hair: '#efece4', hairStyle: 'bald', fringe: 'swept', hat: 'gnome', hatCol: '#6f7f4c', shirt: '#e7dcc2', over: 'vest', overCol: '#6f7f4c', pants: '#6b5a44', boots: '#8a5a34', eyes: '#3f5a2e', beard: true, glasses: false, scarf: null, satchel: false }],
].map(([id, name, who, focus, pref, desc, look]) => ({ id, name, who, focus, pref, desc, look }));

// the next settler off the roll: one not already on the claim, preferring the trade asked for
function nextFolk(pref) {
  const used = new Set(GAME.villagers.map(v => v.d.portrait).concat(GAME.folkUsed || []));
  const free = FOLK.filter(f => !used.has(f.id));
  if (!free.length) return null;
  const want = free.filter(f => !pref || f.pref === pref);
  const pool = want.length ? want : free;
  return pool[Math.floor(Math.random() * pool.length)];
}
// a person's painted picture, if it has arrived (assets/portraits)
function portraitSrc(d) {
  const P = ART.portraits || {};
  if (d.portrait && P[d.portrait]) return P[d.portrait];
  const f = FOLK_FOUNDERS[d.name]; if (d.named && f && P[f.id]) return P[f.id];
  return null;
}
