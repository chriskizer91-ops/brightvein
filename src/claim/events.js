// ===================================================================== EVENTS: days that are different
// Now and then, by day, something happens on the claim: a courier with a rare trade, a prospector at the gate, a fever,
// a festival, a lost Wildlight cub, a wedding, a quarrel, a sky-whale passing under the rim. Each is a small card with
// a picture (painted ones go in assets/events/<id>.webp; until then, the faces of the people in it), a few lines of
// story and one or two choices with a real trade-off. Time waits while you choose. The result shows what it did
// (shards, people, gear, mood, the codex) and goes into the journal's days ("Day 12 · A wedding in the Hearth Hall").
// About half of all days have one, never the same one twice in a row, and the amounts grow with the story.
const EVT = { day: 0, today: null, card: null, log: [], seen: {}, recent: [], next: null, turned: -99, flags: {}, pend: [], work: [], done: 0 };
const evScale = () => 1 + Math.max(0, STORY.ch) * 0.12;
const evAmt = n => Math.max(1, Math.round(n * evScale() / 5) * 5);
const firstOf = v => v.d.name.split(' ')[0];
const itemTag = it => `<b style="color:${rarityOf(it).color}">${esc(it.name)}</b>`;
const evIlvl = () => Math.round(3 + STORY.ch * 1.4);
const settlers = (f = () => true) => GAME.villagers.filter(v => !v.d.hero && !v.d.named && !v.d.exp && !v.d.sick && f(v));
const freeBeds = () => totalBeds() - bedsUsed();
const dayEnd = () => GAME.day + 0.62;               // dusk, in claim days
// people at the gate, not yet on the claim: off the settlers' roll (so their portraits match), never the same one twice
function strangers(n) {
  const keep = GAME.folkUsed, out = [];
  GAME.folkUsed = [...(keep || [])];
  for (let i = 0; i < n; i++) { const d = makePerson(mulberry((Math.random() * 1e9) | 0)); out.push(d); if (d.portrait) GAME.folkUsed.push(d.portrait); }
  GAME.folkUsed = keep;
  return out;
}
function pickTwo(list) { const a = pickOne(list), b = pickOne(list.filter(x => x !== a)); return b ? [a, b] : null; }

// ---- work that goes faster or slower for a while (a festival, the sky-whale, a fever): every job, or one kind of job
function dayWorkK(v) {
  const now = claimNow(); let k = 1;
  if (v.d.sick) { if (now >= v.d.sick.until) delete v.d.sick; else k *= v.d.sick.rest ? 0 : 0.5; }
  if (!EVT.work.length) return k;
  const type = v.jobB && v.jobB.type;
  for (const w of EVT.work) if (now < w.until && (!w.job || w.job === type)) k *= w.k;
  return k;
}
function workFor(days, k, job = null, tag = null) { EVT.work.push({ until: claimNow() + days, k, job, tag }); }
const festivalOn = () => EVT.work.some(w => w.tag === 'festival' && claimNow() < w.until);

// ---- what a choice does, as chips you can see. g: { shards, food, ore, mats: {glass}, item, people: [d], mood: [amt,
// days, text], codex, blueprint, note }
function evGain(g, id) {
  const chips = [], sign = n => (n > 0 ? '+' : '−') + Math.abs(Math.round(n));
  if (g.shards) { GAME.shards = Math.max(0, GAME.shards + g.shards); chips.push(`<span class="chip ${g.shards > 0 ? 'amber' : ''}">${SHARD} ${sign(g.shards)} shards</span>`); }
  if (g.food) { GAME.food = Math.max(0, GAME.food + g.food); chips.push(`<span class="chip ${g.food > 0 ? 'good' : ''}">${sign(g.food)} food</span>`); }
  if (g.ore) { GAME.ore = Math.max(0, GAME.ore + g.ore); chips.push(`<span class="chip">${sign(g.ore)} ore</span>`); }
  for (const [k, n] of Object.entries(g.mats || {})) { GAME.mats[k] = Math.max(0, (GAME.mats[k] || 0) + n); chips.push(`<span class="chip">${sign(n)} ${esc(D.MATERIALS[k].name)}</span>`); }
  if (g.item) { const it = addToStash(g.item, true); chips.push(`<span class="chip">Found: ${itemTag(it)}</span>`); }
  for (const d of g.people || []) { const D0 = LAYOUT.dock, v = addVillager(d, new THREE.Vector3(D0.x - 8 + Math.random() * 2, 0, D0.z + 6 + Math.random() * 2)); v.replan = true; autoAssign(); chips.push(`<span class="chip good">+1 person: ${esc(d.name)}</span>`); }
  if (g.mood) { moodAdd('ev-' + id, g.mood[0], g.mood[1], g.mood[2]); const days = g.mood[1]; chips.push(`<span class="chip ${g.mood[0] > 0 ? 'good' : 'warn'}">Mood ${sign(g.mood[0])}${days >= 1.5 ? ` for ${Math.round(days)} days` : days >= 0.9 ? ' for a day' : ' today'}</span>`); }
  if (g.codex && !STORY.codex.includes(g.codex)) { STORY.codex.push(g.codex); chips.push(`<span class="chip amber">New in the codex: ${esc(CODEX[g.codex].title)}</span>`); }
  if (g.blueprint) { if (!GAME.blueprints.includes(g.blueprint)) GAME.blueprints.push(g.blueprint); chips.push(`<span class="chip">Blueprint: ${esc(D.ITEMS[g.blueprint] ? D.ITEMS[g.blueprint].name : g.blueprint)}</span>`); }
  if (g.note) chips.push(`<span class="chip">${esc(g.note)}</span>`);
  return chips;
}
// a choice's result: what happened, what it did, and the line for the journal's days
const res = (text, gain = {}, log = null) => ({ text, gain, log });

// ---- the events. min/max: the chapters they can happen in. w: how likely. cool: days before it can come again.
// when(): can it happen today. make(): who's in it, the words and the choices ({ label, hint, can, why, act }).
const EVENTS = [
  { id: 'courier', title: 'A courier with a rare trade', min: 1, w: 1.2, cool: 6,
    make() {
      const rar = STORY.ch >= 7 ? 'signed' : 'calibrated', it = LOOT.makeGear({ slot: pickOne(['hand', 'hand', 'rig', 'head', 'charm', 'offhand']), rarity: rar, ilvl: evIlvl() + 2, from: 'a courier' }), price = evAmt(rar === 'signed' ? 140 : 90);
      return { who: ['absalom'], text: `A gnome courier sets down at the mast with one crate she won’t open for just anyone. Absalom talks her into it. Inside, wrapped in oilcloth: ${itemTag(it)}. “${price} shards,” she says, “and I’m being generous.”`,
        choices: [
          { label: 'Buy it', hint: `−${price} shards · ${it.name}`, can: GAME.shards >= price, why: `You need ${price} shards`, act: () => res('She counts the shards twice, tips her cap, and leaves the crate.', { shards: -price, item: it }, `Bought ${it.name} from a courier.`) },
          { label: 'Not today', hint: 'Keep your shards', act: () => res('She shrugs, shoulders the crate and climbs back aboard. “Your loss, claim.”', {}, 'Turned away a courier’s rare trade.') },
        ] };
    } },
  { id: 'prospector', title: 'A prospector at the gate', min: 1, w: 1, cool: 7,
    make() {
      const d = strangers(1)[0], keys = ['G', 'E', 'A', 'R', 'S'], top = pickOne(keys), two = pickOne(keys.filter(k => k !== top));
      d.stats[top] = 10; d.stats[two] = Math.max(d.stats[two], 8); d.trait = pickOne(['Skittish', 'Night owl']);
      const odd = d.trait === 'Skittish' ? 'jump at shadows, and will run from Wildlight at the first glimmer' : 'only really wake up after dark, and work slowly by day';
      const first = d.name.split(' ')[0], bed = freeBeds() > 0;
      return { faces: [d], text: `${esc(d.name)} walks up the bridge with years of dust on their boots and a pick over one shoulder. “Best ${STAT_NAMES[top]} in the Ironspire,” they say, and they mean it: ${STAT_NAMES[top]} 10, ${STAT_NAMES[two]} ${d.stats[two]}. They also ${odd}.`,
        choices: [
          { label: `Take ${first} in`, hint: `+1 person · ${STAT_NAMES[top]} 10 · ${d.trait}`, can: bed, why: 'No free bed in the Keep', act: () => res(`${esc(first)} drops their pack by the stove like they’ve lived here for years.`, { people: [d] }, `${d.name}, a wandering prospector, joined the claim.`) },
          { label: 'Send them on with a meal', hint: '−5 food · mood +2', act: () => res(`${esc(first)} eats two bowls of Marigold’s stew, says it’s the best on the mountain, and heads off down the bridge.`, { food: -5, mood: [2, 1, 'Fed a traveller'] }, `Fed ${d.name}, a prospector passing through.`) },
        ] };
    } },
  { id: 'fever', title: 'A fever in the Keep', min: 1, w: 0.9, cool: 8, when: () => settlers(v => v.d.job).length >= 2,
    make() {
      const v = pickOne(settlers(v => v.d.job)), f = firstOf(v);
      return { faces: [v], text: `${esc(f)} woke up hot and shivering. Marigold says it’s the mountain fever: a day in bed and they’ll mend. Or there’s her honey tonic, which works by noon, and tastes like a boot.`,
        choices: [
          { label: 'A day in bed', hint: `${f} does no work today · mood +2`, act: () => { v.d.sick = { until: claimNow() + 0.8, rest: true }; return res(`${esc(f)} sleeps for most of the day, and wakes up hungry. A good sign.`, { mood: [2, 1, 'Looking after the sick'] }, `${v.d.name} had the mountain fever, and a day in bed.`); } },
          { label: 'Marigold’s honey tonic', hint: '−20 food · back at work by noon', can: GAME.food >= 20, why: 'You need 20 food', act: () => { v.d.sick = { until: claimNow() + 0.2, rest: true }; return res(`${esc(f)} drinks it, pulls a face like a sprung trap, and is back at work by noon.`, { food: -20 }, `${v.d.name} had the mountain fever; Marigold’s tonic cured it.`); } },
        ] };
    } },
  { id: 'festival', title: 'A festival day', min: 2, w: 0.8, cool: 12,
    make() {
      const first = !EVT.flags.founders, host = castHere('fox') ? 'Clem' : 'Pip';
      return { who: ['marigold'], title: first ? 'Founders’ Day' : 'A festival day', text: `${first ? 'Absalom has declared today Founders’ Day, and stamped it, so it is. ' : ''}Somebody has strung lanterns between the yards, Marigold has baked enough pies to sink a ship, and ${host} is selling tickets to a dance that is free. Nobody is going to get much work done today.`,
        choices: [
          { label: 'Down tools and dance', hint: 'Half the work today · −20 food · mood +15 for a day', act: () => { EVT.flags.founders = true; workFor(dayEnd() - claimNow(), 0.5, null, 'festival'); return res('The fiddles come out before breakfast. By noon even Corwin is tapping one foot.', { food: -Math.min(20, Math.floor(GAME.food)), mood: [15, 1.3, 'A festival day'] }, first ? 'Founders’ Day: the whole claim downed tools and danced.' : 'A festival day: the claim downed tools and danced.'); } },
          { label: 'Work first, dance at dusk', hint: '−10 food · mood +6', act: () => { EVT.flags.founders = true; return res('The work gets done, and at dusk the lanterns go up. It is a short dance, but a good one.', { food: -Math.min(10, Math.floor(GAME.food)), mood: [6, 1, 'A dance at dusk'] }, 'A dance at dusk after the day’s work.'); } },
        ] };
    } },
  { id: 'cub', title: 'A lost Wildlight cub', min: 1, w: 0.8, cool: 99, when: () => !EVT.flags.cub && GAME.nights >= 2,
    make() {
      const t = castHere('io');
      return { who: [t ? 'io' : 'pip'], text: `At first light the tenders found something in a sunning yard: a Glimmer no bigger than a cat, curled up on a warm tray and whimpering like a kettle. It must have been left behind when the rest went back down the cliff.${t ? ' Tamsin is already sitting next to it, humming.' : ''}`,
        choices: [
          { label: 'Keep it in a smoked-glass jar', hint: 'Mood +6 for three days · it drinks a shard a night · codex', act: () => { EVT.flags.cub = { day: GAME.day }; return res('It glows a little brighter in the jar, and stops whimpering. The children of the claim name it eleven different things.', { mood: [6, 3, 'A Wildlight cub in a jar'], codex: 'wildcub' }, 'Took in a lost Wildlight cub.'); } },
          { label: 'Carry it back to the cliff', hint: 'Mood −2 · codex', act: () => { EVT.flags.cub = { day: GAME.day, gone: true }; return res('Pip carries it to the rim in a bucket and tips it over. It drifts down into the cloud like a falling coal.', { mood: [-2, 0.6, 'Put a cub over the cliff'], codex: 'wildcub' }, 'Put a lost Wildlight cub back over the cliff.'); } },
        ] };
    } },
  { id: 'cubgrown', title: 'The cub grows up', min: 1, w: 3, cool: 99, when: () => EVT.flags.cub && !EVT.flags.cub.gone && !EVT.flags.cub.grown && GAME.day >= EVT.flags.cub.day + 6,
    make() {
      return { who: [castHere('io') ? 'io' : 'marigold'], text: 'The cub is not a cub any more. It glows like a good lamp, it hums when Marigold sings, and last night it pressed itself flat against the jar, looking at the cliffs.',
        choices: [
          { label: 'Let it go home', hint: 'Mood +4 · it leaves a gift', act: () => { EVT.flags.cub.grown = 'free'; return res('It goes over the rim slowly, looking back twice. In the empty jar: a chip of crystal that is still warm.', { mats: { heartstone: 1 }, mood: [4, 1, 'The cub went home'] }, 'The Wildlight cub, grown, went home over the rim.'); } },
          { label: 'Keep it as the claim’s lamp', hint: 'Mood +3 for good', act: () => { EVT.flags.cub.grown = 'kept'; moodKeep('cub', 3, 'The claim’s own Glimmer, in its jar'); return res('It stays. Its jar hangs in the Hearth Hall, and it is never once snuffed.', {}, 'The Wildlight cub stayed on as the claim’s own lamp.'); } },
        ] };
    } },
  { id: 'collapse', title: 'The old workings fall in', min: 1, w: 0.9, cool: 8,
    make() {
      const miner = pickOne(settlers(v => v.jobB && v.jobB.type === 'head')) || null, it = LOOT.makeGear({ rarity: LOOT.rollRarity(1 + STORY.ch * 0.15, { min: 'tuned' }), ilvl: evIlvl(), from: 'the old workings' });
      return { who: ['corwin'], faces: miner ? [miner] : null, text: 'A rumble under the plateau, and dust out of the shaft. A stretch of old workings, older than anyone can remember, has come down. Behind the fall the miners can see a gap, and in the gap, the glint of brass.',
        choices: [
          { label: 'Dig it out', hint: `Something old and good${miner ? ` · ${firstOf(miner)} is hurt for half a day` : ''}`, act: () => { if (miner) miner.d.sick = { until: claimNow() + 0.5, rest: true }; return res(`It takes all morning${miner ? ` and most of ${esc(firstOf(miner))}'s skin` : ''}, but they get it out: ${itemTag(it)}, in a box with a name scratched off the lid.`, { item: it }, `Dug ${it.name} out of a collapse in the old workings.`); } },
          { label: 'Shore it up and leave it', hint: `−${evAmt(20)} shards for timber · mood +2`, can: GAME.shards >= evAmt(20), why: 'Not enough shards', act: () => res('Corwin props it with good oak and says three words about it, all of them “no”.', { shards: -evAmt(20), mood: [2, 1, 'Safer workings'] }, 'Shored up a collapse in the old workings.') },
        ] };
    } },
  { id: 'spy', title: 'Tallow’s spy', min: 9, w: 0.9, cool: 15,
    make() {
      const pay = evAmt(50);
      return { who: [castHere('sol') ? 'sol' : 'pip'], text: `${castHere('sol') ? 'Brisa' : 'Pip'} caught a man in a grey coat counting the lamps on the north rim and writing the numbers in a little book. “For the Baron,” he says, very fast. “Who works for the Exchange now. They want to know how bright you are. Please don’t drop me off anything.”`,
        choices: [
          { label: 'Walk him off the bridge', hint: 'Mood +3 · he goes home empty-handed', act: () => res(`${castHere('sol') ? 'Brisa' : 'Pip'} walks him to the end of the bridge, very gently, and waits there until his skiff is a dot.`, { mood: [3, 1, 'Saw off a spy'] }, 'Caught one of Tallow’s spies, and saw him off.') },
          { label: 'Pay him to talk', hint: `−${pay} shards · learn what the Exchange is counting (codex)`, can: GAME.shards >= pay, why: `You need ${pay} shards`, act: () => res('He talks the whole way through a pot of tea. The Exchange counts everything: lamps, shards, people. Mostly people.', { shards: -pay, codex: 'ledger' }, 'Paid one of Tallow’s spies to talk.') },
        ] };
    } },
  { id: 'skywhale', title: 'A sky-whale passes', min: 2, w: 0.7, cool: 14,
    make() {
      whalePass();
      return { who: ['pip'], text: 'Pip rings the bell, but not the alarm one. Below the rim, through the cloud sea, a sky-whale is passing: as long as the plateau, slow as a sunset, singing one low note you can feel in your teeth.',
        choices: [
          { label: 'Everyone to the rim to watch', hint: 'An hour without work · mood +8 for a day', act: () => { workFor(0.06, 0, null, 'whale'); return res('The whole claim lines the rim. Nobody says anything for a long time. Marigold cries a bit and says it is the wind.', { mood: [8, 1, 'The sky-whale'] }, 'A sky-whale passed under the rim, and the whole claim watched.'); } },
          { label: 'Pip sketches it for the codex', hint: 'Mood +2 · codex', act: () => res('Pip fills four pages and runs out of grey. The rest of the claim works on, and hears the note all day.', { mood: [2, 1, 'Pip’s sketches'], codex: 'skywhale' }, 'A sky-whale passed under the rim; Pip drew it.') },
        ] };
    } },
  { id: 'wedding', title: 'A wedding in the Hearth Hall', min: 2, w: 0.8, cool: 12, when: () => settlers().length >= 2,
    make() {
      const two = pickTwo(settlers()); if (!two) return null;
      const [a, b] = two, A = firstOf(a), B = firstOf(b);
      return { faces: two, text: `${esc(A)} and ${esc(B)} have walked the rim together every evening since spring. This morning they asked Absalom whether he can marry people. He says he can marry anyone to anything, and has the stamp to prove it.`,
        choices: [
          { label: 'Throw a proper feast', hint: `−30 food · −${evAmt(20)} shards · mood +12 for two days`, can: GAME.food >= 30 && GAME.shards >= evAmt(20), why: 'You need 30 food and some shards', act: () => res(`Absalom stamps the certificate, then ${esc(A)}, then ${esc(B)}. The feast goes on until the lamps need trimming.`, { food: -30, shards: -evAmt(20), mood: [12, 2, `${A} and ${B}’s wedding`] }, `${a.d.name} and ${b.d.name} married in the Hearth Hall, with a feast.`) },
          { label: 'A quiet one in the Keep', hint: '−5 food · mood +4', act: () => res(`A few friends, a cake, and Absalom’s stamp. ${esc(B)} cries. ${esc(A)} says they didn’t, and did.`, { food: -5, mood: [4, 1, `${A} and ${B}’s wedding`] }, `${a.d.name} and ${b.d.name} married quietly in the Hearth Hall.`) },
        ] };
    } },
  { id: 'dispute', title: 'Two settlers fall out', min: 1, w: 0.9, cool: 8, when: () => settlers().length >= 2,
    make() {
      const two = pickTwo(settlers()); if (!two) return null;
      const [a, b] = two, A = firstOf(a), B = firstOf(b), why = pickOne(['a pair of good boots', 'whose turn it is on the bunk by the stove', 'a pie that went missing', 'who snores', 'the right way to stack a tray']), fee = evAmt(10);
      return { faces: two, text: `${esc(A)} and ${esc(B)} have stopped speaking, over ${why}. Half the Keep has taken sides. The other half is selling tickets.`,
        choices: [
          { label: 'Ask Absalom to settle it', hint: `−${fee} shards (his fee) · mood +2`, can: GAME.shards >= fee, why: 'Not enough shards', act: () => res(`Absalom hears both sides, consults a very thick book, and rules that they are both right and both buying the next round.`, { shards: -fee, mood: [2, 1, 'A quarrel settled'] }, `Absalom settled a quarrel between ${a.d.name} and ${b.d.name}.`) },
          { label: 'Let them work it out', hint: 'Mood −4 for two days', act: () => res(`They do, eventually. It takes two days of very loud silence.`, { mood: [-4, 2, `${A} and ${B} aren’t speaking`] }, `${a.d.name} and ${b.d.name} fell out, and made up in the end.`) },
        ] };
    } },
  { id: 'bees', title: 'The bees swarm', min: 1, w: 0.8, cool: 10, when: () => byType('garden').length > 0,
    make() {
      const honey = evAmt(25);
      return { who: ['marigold'], text: 'Marigold’s bees have swarmed: a humming cloud over the greenhouse, heading for the heather below the rim. “If somebody follows them, there’ll be honey,” she says. “If I smoke them home, there’ll be more bees for the greenhouse. Your choice. Quickly.”',
          choices: [
          { label: 'Follow the swarm', hint: `+${honey} food now · the greenhouses grow a tenth slower for two days`, act: () => { workFor(2, 0.9, 'garden'); return res('Two gardeners come back up the rope stair sticky to the elbows, carrying a whole wild comb.', { food: honey }, 'Followed the bees down the cliff, and came back with honey.'); } },
          { label: 'Smoke them home', hint: 'The greenhouses grow a tenth faster for three days', act: () => { workFor(3, 1.1, 'garden'); return res('Marigold walks them home in a cloud of smoke, talking to them the whole way. They seem to listen.', {}, 'Smoked the bees home to the greenhouse.'); } },
        ] };
    } },
  { id: 'tinker', title: 'A tinker on the bridge', min: 2, w: 0.8, cool: 9,
    make() {
      const mend = evAmt(30), bp = evAmt(40), hurt = WALL.segs.filter(s => s.hp < 1 || s.broken).length;
      const known = new Set(GAME.blueprints), pool = Object.keys(D.ITEMS).filter(k => !known.has(k)), pick = pool.length ? pickOne(pool) : null;
      return { who: [castHere('tock') ? 'tock' : 'corwin'], text: `A gnome tinker with a cart full of clockwork has talked her way past the watch. She’ll mend anything with a gear in it, she says, or sell you the drawings for something new.${hurt ? ' She has already noticed the wall.' : ''}`,
        choices: [
          { label: 'Mend the wall', hint: `−${mend} shards · every stretch of wall made sound`, can: hurt > 0 && GAME.shards >= mend, why: hurt ? 'Not enough shards' : 'The wall is sound already', act: () => { for (const s of WALL.segs) { s.hp = 1; s.broken = false; s.stage = wallStage(s); } wallMatrices(); buildNav(); return res('She runs along the wall with a little brass machine that spits mortar. Corwin follows her, checking. He finds nothing to say.', { shards: -mend }, 'A tinker mended the wall all the way round.'); } },
          { label: 'Buy a blueprint', hint: `−${bp} shards · Odile can make ${pick ? esc(D.ITEMS[pick].name) : 'something new'}`, can: !!pick && GAME.shards >= bp, why: pick ? 'Not enough shards' : 'Odile has every drawing', act: () => res('She unrolls the drawing with a flourish. Odile reads it twice and says “huh”, which from Odile is a rave review.', { shards: -bp, blueprint: pick }, `Bought the drawings for ${D.ITEMS[pick].name} from a tinker.`) },
        ] };
    } },
  { id: 'refugees', title: 'Folk from a dead claim', min: 5, w: 0.8, cool: 12,
    make() {
      const fam = strangers(2);
      return { faces: fam, text: `${esc(fam[0].name)} and ${esc(fam[1].name)} come up the bridge with everything they own on their backs. Their claim was two valleys over. “The seam went grey,” one of them says. “All of it, in one night. Like the light just left.”`,
        choices: [
          { label: 'Take them in', hint: '+2 people · −15 food · mood +4 · codex', can: freeBeds() >= 2 && GAME.food >= 15, why: freeBeds() < 2 ? 'You need two free beds in the Keep' : 'You need 15 food', act: () => res('Marigold puts the big pot on. By supper they have jobs, and by bedtime, friends.', { people: fam, food: -15, mood: [4, 1, 'Took in folk from a dead claim'], codex: 'deadclaims' }, `${fam[0].name} and ${fam[1].name}, from a claim whose seam went grey, joined Brightvein.`) },
          { label: 'Food for the road', hint: '−20 food · mood +1 · codex', can: GAME.food >= 20, why: 'You need 20 food', act: () => res('They thank you, and go on down the mountain toward the coast. Nobody on the claim sleeps well that night.', { food: -20, mood: [1, 1, 'Helped folk on their way'], codex: 'deadclaims' }, 'Gave food to folk from a claim whose seam went grey.') },
        ] };
    } },
  { id: 'overheat', title: 'The yards are running hot', min: 1, w: 0.9, cool: 7, when: () => WEATHER.today === 'clear' && byType('yard').length > 0 && GAME.t < 0.4,
    make() {
      const loss = evAmt(30);
      return { who: ['odile'], text: 'Not a cloud for fifty miles, and the trays in the sunning yards are too hot to touch. Odile says the crystal will charge faster than ever today. She also says the word “crack”, twice.',
        choices: [
          { label: 'Push on', hint: `The yards charge half again as fast today · a third of a chance a tray cracks (−${loss} shards)`, act: () => { workFor(dayEnd() - claimNow(), 1.5, 'yard'); EVT.pend.push({ at: dayEnd(), kind: 'crack', loss }); return res('The tenders work in gloves and wet scarves. The trays sing like kettles.', { note: 'Yards: half again as fast until dusk' }, 'Pushed the sunning yards hard on a hot day.'); } },
          { label: 'Shade the trays', hint: 'Nothing lost, nothing gained · mood +1', act: () => res('Canvas goes up over the trays. The crystal charges at its usual pace, and nothing breaks.', { mood: [1, 0.6, 'A careful day'] }, 'Shaded the yards on a hot day.') },
        ] };
    } },
  { id: 'shard', title: 'A shard that sings', min: 3, w: 0.8, cool: 10,
    make() {
      const miner = pickOne(settlers(v => v.jobB && v.jobB.type === 'head')), sell = evAmt(70), who = miner ? firstOf(miner) : 'A miner';
      return { who: ['odile'], faces: miner ? [miner] : null, text: `${esc(who)} came up the shaft holding a shard at arm’s length. It glows on its own, with no sun on it at all, and it hums the same note Odile hears under the plateau at night.`,
        choices: [
          { label: 'Give it to Odile', hint: '+1 Heartstone for her bench', act: () => res('Odile holds it to her ear for a long time, then puts it in her pocket and pats it.', { mats: { heartstone: 1 } }, 'A singing shard came up the shaft; Odile kept it.') },
          { label: STORY.ch >= 9 ? 'Sell it to the Exchange’s buyer' : 'Sell it to the next courier', hint: `+${sell} shards`, act: () => res('The buyer pays without haggling, which worries Absalom more than anything else this week.', { shards: sell }, 'Sold a singing shard.') },
        ] };
    } },
  { id: 'mail', title: 'A dropped mailbag', min: 1, w: 0.8, cool: 10,
    make() {
      const fee = evAmt(20);
      return { who: ['hesper'], text: 'A courier skiff passing high over the claim dropped a mailbag, by accident or by kindness. It is stuffed with letters for people on the claim, from people who miss them.',
        choices: [
          { label: 'Hand the letters round', hint: 'Mood +6 for a day', act: () => res('The Keep goes quiet at supper, everyone reading. Then very loud, everyone reading bits out.', { mood: [6, 1, 'Letters from home'] }, 'A mailbag fell on the claim, full of letters from home.') },
          { label: 'Send it on to the coast', hint: `+${fee} shards (the post pays a finder’s fee)`, act: () => res('Hesper flies it down to the post at the coast. The letters will come back up the mountain the slow way, in a month.', { shards: fee }, 'Sent a dropped mailbag on to the coast.') },
        ] };
    } },
  { id: 'glow', title: 'Something glowing in the scree', min: 3, w: 0.8, cool: 8, when: () => GAME.nights >= 6,
    make() {
      const it = LOOT.makeGear({ rarity: LOOT.rollRarity(1.5 + STORY.ch * 0.15, { min: 'tuned' }), ilvl: evIlvl() + 1, from: 'a Lodestar' }), who = pickOne(settlers(v => !v.hidden)) || null;
      return { who: ['pip'], text: 'A Lodestar that went back down the cliff last night dropped what it had swallowed. It is lying on a ledge twenty feet below the rim, glowing like a dropped coin.',
        choices: [
          { label: 'Lower someone down on a rope', hint: 'A find, Tuned or better · a chance they get hurt', act: () => { const ouch = who && Math.random() < 0.35; if (ouch) who.d.sick = { until: claimNow() + 0.4, rest: true }; return res(`${who ? esc(firstOf(who)) : 'Somebody'} goes down on a rope and comes back up with ${itemTag(it)}${ouch ? ', and a twisted ankle' : ''}.`, { item: it, mood: ouch ? [-2, 0.5, 'A fall in the scree'] : null }, `Brought ${it.name} up from the scree.`); } },
          { label: 'Leave it to the cliff', hint: 'Nothing ventured', act: () => res('It glows on the ledge for three nights, and then a Glimmer takes it.', {}, 'Left a Lodestar’s find on the cliff.') },
        ] };
    } },
  { id: 'fulgurite', title: 'Lightning glass', min: 1, w: 1.4, cool: 6, when: () => ACT.lastStorm >= GAME.day - 1,
    make() {
      const n = STORY.ch >= 6 ? 3 : 2, sell = evAmt(25);
      return { who: ['odile'], text: 'The storm struck the scree below the rim a hundred times. Where it hit, the sand melted into tubes of glass, rough on the outside and clear as water within.',
        choices: [
          { label: 'Send a crew to dig it out', hint: `+${n} Cut Glass · the yards lose a morning’s work`, act: () => { workFor(0.15, 0, 'yard'); return res('The tenders come back with their arms full of glass tubes, and Odile with her arms full of tenders’ complaints.', { mats: { glass: n } }, 'Dug lightning glass out of the scree.'); } },
          { label: 'Sell the spot to a glass-pedlar', hint: `+${sell} shards`, act: () => res('A pedlar pays you for the spot and digs it out himself, whistling.', { shards: sell }, 'Sold a field of lightning glass to a pedlar.') },
        ] };
    } },
  { id: 'bet', title: 'Juno’s wager', min: 12, w: 0.9, cool: 9, when: () => GAME.t < 0.5,
    make() {
      const stake = evAmt(40);
      return { who: ['juno'], text: `Juno Ferrars has flown over with a bottle of something brown and a wager. “My watch against yours, tonight. If your lot bring down seven in ten of whatever climbs your cliffs, I pay you ${stake * 2}. If not, you pay me ${stake}, and I gloat.”`,
        choices: [
          { label: 'Take the bet', hint: `Stake ${stake} shards · bring down 7 in 10 tonight to win ${stake * 2}`, can: GAME.shards >= stake, why: `You need ${stake} shards`, act: () => { EVT.pend.push({ kind: 'bet', stake, night: GAME.nights + 1 }); return res('You shake on it. Juno flies home whistling, which is worrying.', { shards: -stake, note: 'Settled at dawn' }, `Took Juno’s wager on the night’s watch.`); } },
          { label: 'Decline politely', hint: 'Mood −1 (the watch wanted to)', act: () => res('Juno shrugs and pours herself a drink anyway. The watch sulk.', { mood: [-1, 0.6, 'No bet'] }, 'Turned down Juno’s wager.') },
        ] };
    } },
  { id: 'birthday', title: 'A birthday on the claim', min: 1, w: 0.7, cool: 10, when: () => birthdayFor() !== null,
    make() {
      const B = birthdayFor(); if (!B) return null;
      return { who: [B.k], text: B.text,
        choices: [
          { label: 'Bake a cake and sing', hint: '−10 food · mood +6 for a day', can: GAME.food >= 10, why: 'You need 10 food', act: () => { EVT.flags['bday-' + B.k] = GAME.day; return res(B.cake, { food: -10, mood: [6, 1, `${B.name}’s birthday`] }, `${B.name}’s birthday, with a cake.`); } },
          { label: 'A card, signed by everyone', hint: 'Mood +2', act: () => { EVT.flags['bday-' + B.k] = GAME.day; return res('Everyone signs it. Absalom stamps it. It is the most official birthday card in the Ironspire.', { mood: [2, 1, `${B.name}’s birthday`] }, `${B.name}’s birthday, with a card.`); } },
        ] };
    } },
  { id: 'map', title: 'A map in the wall', min: 2, w: 0.7, cool: 14, when: () => !EVT.flags.map,
    make() {
      const sell = evAmt(30);
      return { who: ['corwin'], text: 'Corwin pulled a loose stone out of the old foundations and found a tin behind it. In the tin: a prospector’s map of the moors, with an X on it, and the words DO NOT TELL GERALD.',
        choices: [
          { label: 'Give it to the next expedition', hint: 'The next one home brings back the cache', act: () => { EVT.flags.map = 'out'; return res('Corwin folds it into the expeditions’ satchel by the rope stair. Nobody tells Gerald.', { note: 'Whoever comes home from the wilds next finds the X' }, 'Found a treasure map in the old wall.'); } },
          { label: 'Sell it to a courier', hint: `+${sell} shards`, act: () => { EVT.flags.map = 'sold'; return res('The courier pays and flies off at once, toward the moors.', { shards: sell }, 'Sold a treasure map found in the wall.'); } },
        ] };
    } },
  { id: 'crate', title: 'A crate that won’t stay shut', min: 3, w: 0.8, cool: 10, when: () => raided('camp'),
    make() {
      const sell = evAmt(40), it = LOOT.makeGear({ rarity: 'calibrated', ilvl: evIlvl() + 1, from: 'a rattling crate' });
      return { who: [castHere('sol') ? 'sol' : 'corwin'], text: 'One of the jumpers’ crates has been rattling in the stores all week. Last night it glowed. This morning it is humming, and the lid has crept open a finger’s width.',
        choices: [
          { label: 'Open it', hint: 'Something good, or a Glimmer in your face', act: () => {
            if (Math.random() < 0.7) return res(`Inside, packed in straw and humming to itself: ${itemTag(it)}.`, { item: it }, `Opened a rattling crate and found ${it.name}.`);
            return res('A Glimmer bursts out of the straw, singes Corwin’s eyebrows and shoots off over the rim. In the bottom of the crate: a little charged dust.', { shards: 15, mood: [-3, 0.6, 'Corwin’s eyebrows'] }, 'Opened a rattling crate, and a Glimmer flew out.'); } },
          { label: 'Sell it unopened', hint: `+${sell} shards`, act: () => res('A courier buys it unopened, and holds it at arm’s length all the way to his ship.', { shards: sell }, 'Sold a rattling crate unopened.') },
        ] };
    } },
];
const BIRTHDAYS = [
  { k: 'pip', name: 'Pip', text: 'Pip is nineteen today. Or twenty. Pip has lost count, and would like a cake to help work it out.', cake: 'There are twenty candles, to be safe. Pip blows out nineteen and keeps one for the night watch.' },
  { k: 'corwin', name: 'Corwin', text: 'Corwin turns forty-five today. He told Marigold. It is the most he has said all week.', cake: 'Corwin looks at the cake for a long time, then says “thank you”. People talk about it for days.' },
  { k: 'absalom', name: 'Absalom', text: 'Absalom is two hundred and eleven today, and would like it known that he expects a cake shaped like his stamp.', cake: 'The cake is shaped like his stamp. He stamps it before he eats it.' },
  { k: 'marigold', name: 'Marigold', text: 'It is Marigold’s birthday. She has baked her own cake, because nobody else is allowed near her oven.', cake: 'Everyone sings. The bees join in, which nobody asked for.' },
  { k: 'odile', name: 'Odile', text: 'Odile is fifty today. She would like a quiet day, a sharp lens, and for nobody to sing.', cake: 'Everyone sings anyway. Odile pretends to hate it, and judges the pitch: “flat, but warm.”' },
  { k: 'hesper', name: 'Hesper', text: 'Hesper’s birthday. She says she is thirty-five. Her flying licence says something else, in very small writing.', cake: 'Hesper takes the Lark up at dusk and loops the plateau twice, with cake on her coat.' },
];
function birthdayFor() {
  const ok = BIRTHDAYS.filter(B => !EVT.flags['bday-' + B.k] && GAME.villagers.some(v => v.d.name === WHO[B.k].founder));
  return ok.length ? pickOne(ok) : null;
}

// ---- rolling the day's event: about half of all mornings, from day 3, at a random hour before mid-afternoon
function eventsNewDay() {
  EVT.today = null;
  if (GAME.day < 3 || !BUILD.setupDone) return;
  const foretold = EVT.next && EVT.next.day === GAME.day ? EVT.next.id : null;
  EVT.next = null;
  const id = foretold && evCan(EVENTS.find(e => e.id === foretold)) ? foretold : Math.random() < 0.55 ? evPick() : null;
  if (id) EVT.today = { id, at: 0.1 + Math.random() * 0.3 };
  // Clem's cards: tomorrow's, read the morning before
  if (cardsOn()) { const n = Math.random() < 0.55 ? evPick([id]) : null; EVT.next = n ? { day: GAME.day + 1, id: n } : { day: GAME.day + 1, id: null }; }
}
function evCan(e) { return !!e && STORY.ch >= (e.min || 0) && STORY.ch <= (e.max ?? 99) && (!e.when || e.when()); }
function evPick(avoid = []) {
  const pool = EVENTS.filter(e => evCan(e) && !avoid.includes(e.id) && !EVT.recent.includes(e.id) && !(EVT.seen[e.id] != null && GAME.day - EVT.seen[e.id] < (e.cool || 8)));
  if (!pool.length) return null;
  let r = Math.random() * pool.reduce((s, e) => s + (e.w || 1), 0);
  for (const e of pool) { r -= e.w || 1; if (r <= 0) return e.id; }
  return pool[pool.length - 1].id;
}
// can a card come up now: by day, with nothing else going on
function evQuiet() {
  if (!started || !BUILD.setupDone || STORY.shown || STORY.queue.length || EVT.card || (SKY && SKY.on) || BUILD.on) return false;
  if (TOD.phase !== 'day' && TOD.phase !== 'dawn') return false;
  if (jumpersActive() || WL.list.some(f => !f.dead)) return false;
  const dawn = document.getElementById('dawn'); if (dawn && !dawn.hidden) return false;
  return !frontOpen();   // not while the settings or one of their cards is open (title.js)
}
function eventsFrame() {
  const T = EVT.today; if (!T || T.fired) return;
  if (GAME.t > 0.58) { EVT.today = null; return; }   // the day got away: it never happened
  if (GAME.t >= T.at && evQuiet()) { T.fired = true; eventFire(T.id); }
}

// ---- the card
function evCardEl() {
  let el = document.getElementById('evcard');
  if (!el) { el = document.createElement('div'); el.id = 'evcard'; el.className = 'evcard'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); $('#app').append(el); }
  return el;
}
function evPicture(e, M) {
  const box = document.createElement('div'); box.className = 'ev-pic';
  const art = ART.events && (ART.events[e.pic || e.id]);
  if (art) { const im = new Image(); im.src = art; im.alt = ''; box.classList.add('art'); box.append(im); return box; }
  // the people in it, or whoever brings the news
  const faces = [];
  for (const p of M.faces || []) {
    if (p.d) { faces.push([portraitOf(p, 84), p.d.name]); continue; }   // someone on the claim
    const fr = framed(84), src = portraitSrc(p);                         // someone at the gate, not yet on the claim
    if (src) { const im = new Image(); im.src = src; im.alt = ''; fr.classList.add('painted'); fr.append(im); }
    else if (typeof drawPortrait === 'function') { const c = document.createElement('canvas'); drawPortrait({ ...p.look }, c); fr.append(c); }
    faces.push([fr, p.name]);
  }
  if (!faces.length) for (const k of M.who || []) if (WHO[k]) faces.push([speakerPortrait(k, 84), whoOf(k).name]);
  for (const [f, name] of faces.slice(0, 2)) { const fig = document.createElement('figure'); fig.append(f); const cap = document.createElement('figcaption'); cap.textContent = shortName(name); fig.append(cap); box.append(fig); }
  return box;
}
function eventFire(id) {
  const e = EVENTS.find(x => x.id === id); if (!e) return false;
  const M = e.make(); if (!M) return false;
  EVT.seen[id] = GAME.day; EVT.recent = [id, ...EVT.recent].slice(0, 3);
  const choices = M.choices.slice();
  // Clem's cards: once a week she can turn a day away
  if (cardsOn() && GAME.day - EVT.turned >= 7) choices.push({ label: 'Clem: “Not today.”', hint: 'Clem shuffles the cards, and none of this happens. Once a week.', clem: true,
    act: () => { EVT.turned = GAME.day; return res('Clem shuffles the deck, frowns, shuffles it again, and the day goes back to being an ordinary one.', {}, 'Clem turned the cards, and the day passed quietly.'); } });
  EVT.card = { e, M, choices, title: M.title || e.title };
  const el = evCardEl(); el.innerHTML = '';
  const card = document.createElement('div'); card.className = 'ev-inner';
  card.append(evPicture(e, M));
  card.append(UI.h(`<p class="eyebrow">Day ${GAME.day} · ${esc(PHASE_NAMES(GAME.t))}</p><h2>${esc(EVT.card.title)}</h2><p class="ev-text">${M.text}</p>`));
  const box = document.createElement('div'); box.className = 'ev-choices';
  choices.forEach((c, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ev-ch' + (c.clem ? ' clem' : '');
    const can = c.can !== false;
    b.innerHTML = `<b>${esc(c.label)}</b><span>${can ? esc(c.hint || '') : esc(c.why || 'Not possible')}</span>`;
    if (!can) b.disabled = true;
    b.onclick = () => eventChoose(i);
    box.append(b);
  });
  card.append(box);
  el.append(card); el.hidden = false;
  GAME.talk = true; UI.close();
  AUDIO.play('open');
  requestAnimationFrame(() => { const f = el.querySelector('.ev-ch:not([disabled])'); if (f && !matchMedia('(pointer:coarse)').matches) f.focus(); });
  return true;
}
function eventChoose(i) {
  const C = EVT.card; if (!C || C.picked) return null;
  const c = C.choices[i]; if (!c || c.can === false) return null;
  C.picked = true;
  const r = c.act() || res('');
  const chips = evGain(r.gain || {}, C.e.id);
  EVT.done++; ACT.tally.events++;
  daysLog(r.log || C.title, 'event');
  const el = evCardEl(), box = el.querySelector('.ev-choices');
  box.replaceWith(UI.h(`<div class="ev-result"><p><b>${esc(c.label)}.</b> ${r.text}</p>${chips.length ? `<div class="ev-chips">${chips.join('')}</div>` : ''}<button type="button" class="btn primary wide" id="ev-ok">Back to the claim</button></div>`));
  el.querySelector('#ev-ok').onclick = eventClose;
  AUDIO.play(chips.some(x => x.includes('Found')) ? 'chime' : 'tap');
  questsCheck(); UI.refresh(); saveGame();
  return r;
}
function eventClose() {
  const el = evCardEl(); el.hidden = true; el.innerHTML = '';
  EVT.card = null; if (!STORY.shown) GAME.talk = false;
  journalHUD();
}
addEventListener('keydown', e => { if (EVT.card && e.key === 'Escape' && EVT.card.picked) eventClose(); });

// ---- things that settle later: a cracked tray at dusk, Juno's wager at dawn, the cache on the map
function eventsTick() {
  const now = claimNow();
  for (const p of EVT.pend.slice()) {
    if (p.kind === 'crack' && now >= p.at) {
      EVT.pend.splice(EVT.pend.indexOf(p), 1);
      if (Math.random() < 0.34) {
        const y = pickOne(byType('yard')); GAME.shards = Math.max(0, GAME.shards - p.loss); if (y) y.scorch = Math.max(y.scorch || 0, 0.6);
        toast(`<b>A tray cracked</b> in the heat${y ? ` at ${esc(y.name)}` : ''}: ${SHARD} −${p.loss}. It will be slower until it’s patched.`, 'night'); daysLog('A tray cracked in the heat in the sunning yards.', 'event');
      } else toast('The yards ran hot all day, and <b>nothing cracked</b>.');
    }
  }
  EVT.work = EVT.work.filter(w => now < w.until);
}
function eventsDawn(R) {
  for (const p of EVT.pend.slice()) {
    if (p.kind !== 'bet' || R.n < p.night) continue;
    EVT.pend.splice(EVT.pend.indexOf(p), 1);
    const need = Math.ceil(R.spawned * 0.7), won = R.spawned > 0 && R.downed >= need;
    if (won) { GAME.shards += p.stake * 2; moodAdd('bet', 3, 1, 'Won Juno’s wager'); toast(`<b>Juno’s wager:</b> the watch brought down ${R.downed} of ${R.spawned}. She pays up, ${SHARD} ${p.stake * 2}, and doesn’t gloat.`); daysLog(`Won Juno’s wager: ${R.downed} of ${R.spawned} brought down.`, 'event'); }
    else { toast(`<b>Juno’s wager:</b> ${R.downed} of ${R.spawned} brought down; she needed ${need}. She gloats.`); daysLog(`Lost Juno’s wager: ${R.downed} of ${R.spawned} brought down.`, 'event'); }
  }
}
function eventsTrip(v) {
  if (EVT.flags.map !== 'out') return;
  EVT.flags.map = 'found';
  const it = LOOT.makeGear({ rarity: 'calibrated', ilvl: evIlvl() + 2, from: 'Gerald’s cache' }), n = evAmt(60);
  GAME.shards += n; addToStash(it, true);
  toast(`Following the map from the wall, <b>${esc(v.d.name)}</b> dug up the X: ${SHARD} ${n} and ${itemTag(it)}. Nobody told Gerald.`);
  daysLog(`${v.d.name} followed the map in the wall and found the cache.`, 'event');
}

// ---- the sky-whale itself: a long pale shape swimming slowly past below the rim, half in the cloud sea, with a row of
// glowing spots down its back. Made the first time it's needed, and only there while it passes.
const WHALE = { g: null, t: -1, dur: 75, tail: null };
function whaleMake() {
  const g = new THREE.Group(), skin = new THREE.MeshStandardMaterial({ color: 0x55667e, roughness: 0.8, emissive: 0x141c2a, emissiveIntensity: 0.6 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xbfb8aa, roughness: 0.9 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc46a, toneMapped: false });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), skin); body.scale.set(30, 7.5, 8.5); g.add(body);
  const under = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, TAU, Math.PI * 0.55, Math.PI * 0.45), belly); under.scale.set(29, 7.2, 8.2); g.add(under);
  for (const s of [-1, 1]) { const fin = new THREE.Mesh(new THREE.ConeGeometry(2.2, 11, 4), skin); fin.position.set(8, -3, s * 8); fin.rotation.set(s * 1.2, 0, -0.5); fin.scale.set(1, 1, 0.3); g.add(fin); }
  const tail = new THREE.Group(); tail.position.set(-29, 0, 0); g.add(tail);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 4), skin); f.position.set(-5, 0, s * 5); f.rotation.set(s * 1.35, 0, 0.9); f.scale.set(1, 1, 0.25); tail.add(f); }
  for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), glow); d.position.set(18 - i * 4.4, 6.4 - Math.abs(i - 3) * 0.35, (i % 2 ? 1 : -1) * 1.6); g.add(d); }
  WHALE.tail = tail; g.visible = false; scene.add(g); return g;
}
function whalePass() { if (!WHALE.g) WHALE.g = whaleMake(); WHALE.t = 0; WHALE.g.visible = true; }
function whaleFrame(rdt) {
  if (WHALE.t < 0 || !WHALE.g) return;
  WHALE.t += rdt; const k = WHALE.t / WHALE.dur;
  if (k >= 1) { WHALE.t = -1; WHALE.g.visible = false; return; }
  // across the north-west, beyond the rim, where the usual view over the claim can see it above the far wall
  const x = lerp(-175, 70, k), z = lerp(-25, -175, k);
  WHALE.g.position.set(x, -17 + Math.sin(WHALE.t * 0.4) * 1.5, z);
  WHALE.g.rotation.set(0, Math.atan2(150, 245), Math.sin(WHALE.t * 0.4) * 0.05);   // nose (local +x) the way it swims
  WHALE.tail.rotation.z = Math.sin(WHALE.t * 0.9) * 0.35;
}

// ---- the claim's days, for the journal: what happened, newest first
function daysLog(text, kind = 'event') {
  EVT.log.unshift({ day: GAME.day, text, kind });
  if (EVT.log.length > 80) EVT.log.length = 80;
}
function daysJournal(ui, body) {
  if (cardsOn() && EVT.next && EVT.next.day === GAME.day + 1) {
    const e = EVENTS.find(x => x.id === EVT.next.id);
    body.append(ui.h(`<p class="jr-cards"><b>Clem’s cards for tomorrow:</b> ${e ? esc(e.title.replace(/^A /, 'a ').replace(/^An /, 'an ').replace(/^The /, 'the ').replace(/^(Two|Three|Some|Someone|Something|Folk|Lightning|Bees|Birthdays) /, (m, w) => w.toLowerCase() + ' ')) : 'a quiet day'}.${GAME.day - EVT.turned >= 7 ? ' She can turn one day away this week.' : ''}</p>`));
  }
  body.append(ui.h(`<h3>Days on the claim</h3>`));
  if (!EVT.log.length) { body.append(ui.h(`<p class="small">Nothing yet. Every so often something happens by day: a courier, a fever, a festival. It goes here.</p>`)); return; }
  body.append(ui.h(`<ul class="days">${EVT.log.slice(0, 40).map(L => `<li class="${L.kind}"><em>Day ${L.day}</em>${esc(L.text)}</li>`).join('')}</ul>`));
}

// ---- saving
function eventsSave() { return { today: EVT.today, log: EVT.log, seen: EVT.seen, recent: EVT.recent, next: EVT.next, turned: EVT.turned, flags: EVT.flags, pend: EVT.pend, work: EVT.work, done: EVT.done, day: EVT.day }; }
function eventsLoad(s) {
  s = s || {};
  Object.assign(EVT, { today: s.today && !s.today.fired ? s.today : null, log: s.log || [], seen: s.seen || {}, recent: s.recent || [], next: s.next || null, turned: s.turned ?? -99, flags: s.flags || {}, pend: s.pend || [], work: s.work || [], done: s.done || 0, day: s.day || GAME.day, card: null });
}
