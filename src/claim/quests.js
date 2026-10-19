// ===================================================================== THE CAST'S OWN STORIES
// Each visitor who stays on as crew has a story of their own: two or three steps, offered at the Keep once they've
// settled in (three days after they arrive). A marker over the Keep says who wants a word; tap the Keep (or the
// journal's cast page) to hear them out. Steps are things the claim does anyway (a night on the wall, a trip into the
// wilds, a Bright Night's boss, Cut Glass from the bench) or a gift you hand over yourself. Each story pays off with
// something that lasts: a Masterwork, a gift to the claim that grows stronger, a convoy, Clem's cards, and a codex page.
const QST = {};      // id → { state: 'offer' | 'on' | 'done', step, at (the tallies when the step began), day }
const QUEST_JOIN = { io: 'magpie', sol: 'magpie', quill: 'redspire', tock: 'redspire', brann: 'wickmoor', fox: 'moonfaire', halcyon: 'deepseam' };
const heroV = id => GAME.villagers.find(v => v.d.hero === id);
const onWall = id => { const v = heroV(id); return !!(v && !v.d.exp && v.d.job && v.d.job.bid === 'wall'); };
const qSince = (Q, k) => (ACT.tally[k] || 0) - ((Q.at && Q.at[k]) || 0);
const questDone = id => !!(QST[id] && QST[id].state === 'done');
// a cast member's gift to the claim, as a multiplier: nothing if they're away, more once their story is done
const castGift = (id, base, better) => !castPerk(id) ? 1 : questDone(id) ? better : base;
const cardsOn = () => questDone('fox') && castHere('fox');

// the two Masterworks the cast's stories make. They're kept out of the random drop tables (not enumerable), so the
// only way to get one is the story.
const CAST_RELICS = {
  'quiet-lamp': { id: 'quiet-lamp', name: 'The Quiet Lamp', base: 'shade-lantern', kind: 'lantern', rarity: 'masterwork', slot: 'offhand', ilvl: 14, stats: { vsWild: 30, nerve: 2, guard: 6, light: 1 },
    power: { name: 'Hush', text: 'Once a night: every Wildlight near the carrier goes still for a few seconds, and stops drinking.' },
    lore: 'Tamsin’s lamp, its lens ground by Odile to the note the seam hums at night. Its light doesn’t burn the Wildlight. It calms them.', source: 'Gift: Tamsin Vey' },
  'pikes-answer': { id: 'pikes-answer', name: 'Pike’s Answer', base: 'piston-hammer', kind: 'hammer', rarity: 'masterwork', slot: 'hand', aspect: 'steam', ilvl: 16, stats: { dmg: 45, G: 3, repair: 30 },
    power: { name: 'The Last Word', text: 'Once a night: one blow that throws a Wildlight back over the rim.' },
    lore: 'The first thing off Torvald’s relit forge. He says it’s an answer. He won’t say to what.', source: 'Gift: Torvald Pike' },
};
for (const r of Object.values(CAST_RELICS)) if (!D.RELICS[r.id]) Object.defineProperty(D.RELICS, r.id, { value: r, enumerable: false, configurable: true });

// ---- the stories. step: { text (the journal), short (the HUD), done(Q) | give: { glass, brass, heartstone, shards, food } }
const QUESTS = {
  io: { title: 'The Quiet Lamp', who: 'Tamsin',
    ask: [
      ['io', 'Can I ask you something odd? Every night we burn them. The Wildlight. I want to make a lamp that calms them instead.'],
      ['io', 'A Lodestar carries a little of the seam’s light in its chest. If I could hold some of that, and look at it properly…'],
      ['odile', 'And you’ll want a lens. Cut Glass, ground very fine. I’ll do the grinding. You do the asking.'],
      ['io', 'I’m asking. Sorry. Thank you. I’m asking.'],
    ],
    steps: [
      { text: 'Bring down a Lodestar, so Tamsin can catch a little of its light', short: 'Bring down a Lodestar', done: Q => qSince(Q, 'lodestar') >= 1, prog: Q => [Math.min(1, qSince(Q, 'lodestar')), 1] },
      { text: 'Give Odile 3 Cut Glass to grind the lens', short: 'Give Odile 3 Cut Glass', give: { glass: 3 } },
      { text: 'See out a night with Tamsin on the watch, lamp in hand (give her the Rim Wall job)', short: 'A night with Tamsin on the watch', done: Q => qSince(Q, 'watch-io') >= 1 },
    ],
    close: [
      ['io', 'It worked. A Glimmer came right up to the lamp, and stopped, and just… sat there. Like a cat at a window.'],
      ['sol', 'And then?'],
      ['io', 'And then it went home. Back over the rim. I didn’t have to hurt it at all.'],
      ['odile', 'And the lens held. Beautiful stone. Well treated, for once.'],
    ],
    rewardText: 'The Quiet Lamp, a Masterwork that calms the Wildlight, and a page in the codex.',
    reward() { const it = LOOT.makeRelic('quiet-lamp', 'Tamsin Vey'), v = heroV('io'); if (v && !v.d.gear.offhand) { v.d.gear.offhand = it; v.gearCache = null; } else addToStash(it, true); return { codex: 'quietlamp', item: it }; } },
  sol: { title: 'The Brass Road', who: 'Brisa',
    ask: [
      ['sol', 'When the convoy company folded, its last strongbox never reached the coast. The driver hid it on the old route, under the moors.'],
      ['sol', 'I know the cairn. I’d like to fetch it. Company money, and nobody left to claim it but the people who guarded it.'],
      ['absalom', 'Unclaimed property. My favourite kind of paperwork.'],
    ],
    steps: [
      { text: 'Send Brisa into the wilds as far as the gorse moors, and home again (tap her › Get ready to set out)', short: 'Brisa to the gorse moors and back', done: Q => qSince(Q, 'trip-sol-1') >= 1 },
      { text: 'Under the cairn: a map to the strongbox, in the old-age ruins. Send anyone that far and home again', short: 'Anyone to the old-age ruins and back', done: Q => qSince(Q, 'trip2') >= 1 },
    ],
    close: [
      ['sol', 'The strongbox. Still locked. Still heavy.'],
      ['absalom', 'Two hundred and fifty shards, a convoy ledger, and a very good sword. The sword was not on the manifest. I have added it.'],
      ['sol', 'The ledger has every route that ever ran. I can get one convoy going again. Here to the coast, every few days.'],
    ],
    rewardText: '250 shards and a Signed weapon from the strongbox; the Brass Road convoy now calls every four days with 40 shards.',
    reward() { const it = LOOT.makeGear({ slot: 'hand', rarity: 'signed', ilvl: 12, from: 'the convoy strongbox' }); addToStash(it, true); GAME.shards += 250; ACT.convoy = GAME.day + 4; return { codex: 'brassroad', item: it, shards: 250 }; } },
  halcyon: { title: 'The Last Vigil', who: 'Seraphine',
    ask: [
      ['halcyon', 'A knight of the Thinwatch keeps one last vigil before she lays down her vows. Or takes them up again.'],
      ['halcyon', 'I have not decided which. I would like to decide on your wall.'],
      ['corwin', 'Good wall.'],
    ],
    steps: [
      { text: 'Stand a Bright Night with Seraphine on the watch, and bring its boss down (give her the Rim Wall job)', short: 'Seraphine on the wall for a Bright Night’s boss', done: Q => qSince(Q, 'bosswatch-halcyon') >= 1 },
      { text: 'Let her teach what she knows: put Seraphine in the Drill Yard as its tutor (Keep › Drill Yard)', short: 'Seraphine tutors in the Drill Yard', done: () => { const v = heroV('halcyon'); return !!(v && v.d.study && v.d.study.role === 'tutor' && GAME.rooms[v.d.study.room] && GAME.rooms[v.d.study.room].type === 'G'); } },
    ],
    close: [
      ['halcyon', 'I have decided. The Thinwatch is not one old woman with a sword. It is anyone who keeps the watch.'],
      ['halcyon', 'I take up my vows again. Here. And I will teach them to anyone who asks.'],
      ['sol', 'I’m asking.'],
    ],
    rewardText: 'Her vigil renewed: while she’s on the claim, Wildlight take a third more harm from everything.',
    reward() { return { codex: 'vigil' }; } },
  quill: { title: 'The Gannet', who: 'Barnabus',
    ask: [
      ['quill', 'Forty years ago I put my first ship down in the wreck fields under the Thinning. The Gannet. Best little cutter that ever flew.'],
      ['tock', 'She’s still there. I’ve seen her. Hull’s sound. Rigging’s soup.'],
      ['quill', 'Find her, let Nib patch her, and I’ll fly her once more. Then she’s yours.'],
    ],
    steps: [
      { text: 'Find the Gannet: send someone to the wreck fields under the Thinning and home again', short: 'Someone to the wreck fields and back', done: Q => qSince(Q, 'trip3') >= 1 },
      { text: 'Nib needs parts to patch her: 4 Brass Scrap and 200 shards', short: 'Give Nib 4 Brass Scrap and 200 shards', give: { brass: 4, shards: 200 } },
    ],
    close: [
      ['tock', 'Rudder’s the right size. I checked. Twice.'],
      ['quill', 'Listen to her creak. That’s a happy ship.'],
      ['quill', 'She’s yours, Captain. And I’ll fly with whoever you send out. Old skyman’s luck.'],
    ],
    rewardText: 'The Gannet joins the fleet (or, if you have a cutter, toughens her up), and voyages bring home a fifth more shards while Barnabus is here.',
    reward() {
      let note = 'The Gannet joins the fleet';
      if (FLEET) { const s = FLEET.data.ships.cutter; if (!s.owned) s.owned = true; else { s.mods.armour = Math.min(3, s.mods.armour + 1); s.mods.canvas = Math.min(3, s.mods.canvas + 1); note = 'Your cutter gets the Gannet’s armour and canvas'; } FLEET.save(); }
      return { codex: 'gannet', note };
    } },
  tock: { title: 'Mirrors on Poles', who: 'Nib',
    ask: [
      ['tock', 'Mirrors! On poles! Round every yard! The sun comes in sideways first thing and nobody catches it. It’s a waste. It makes me itch.'],
      ['odile', 'What Nib means is: Nib wants Cut Glass.'],
      ['tock', 'I want Cut Glass. And somebody in the Workshop to silver it. And a sunny day to show off on.'],
    ],
    steps: [
      { text: 'Give Nib 2 Cut Glass for the mirrors', short: 'Give Nib 2 Cut Glass', give: { glass: 2 } },
      { text: 'Put two cutters to work in a Lens Workshop to silver them', short: 'Two cutters in a Lens Workshop', done: () => byType('shop').some(b => workersOf(b.id).length >= 2), prog: () => [Math.min(2, Math.max(0, ...byType('shop').map(b => workersOf(b.id).length))), 2] },
      { text: 'Charge 150 shards in the sunning yards in a single day', short: 'Charge 150 shards in one day', done: () => ACT.dayCharge >= 150, prog: () => [Math.min(150, Math.floor(ACT.dayCharge)), 150] },
    ],
    close: [
      ['tock', 'See? See the morning light? Caught! Every bit of it!'],
      ['hesper', 'The yards are glowing before breakfast.'],
      ['tock', 'And on grey days the mirrors catch what light there is. Small fee. I’ll think of one.'],
    ],
    rewardText: 'Her mirrors, angled: while she’s on the claim, cloud and rain dim the yards half as much.',
    reward() { return { codex: 'mirrors' }; } },
  brann: { title: 'Pike’s Forge', who: 'Torvald',
    ask: [
      ['brann', 'My forge is off the Wickmoor and in pieces in your Workshop. I’d like it lit.'],
      ['brann', 'It wants Heartstone to light. The deep-seam crystal that never cools. And a proper chimney.'],
      ['odile', 'My chimney is a proper chimney.'],
      ['brann', 'It’s a teapot spout.'],
    ],
    steps: [
      { text: 'Raise a Lens Workshop to level 2, for a proper chimney', short: 'A Lens Workshop at level 2', done: () => byType('shop').some(b => b.level >= 2 && !b.building) },
      { text: 'Give Torvald 1 Heartstone and 150 shards to light the forge', short: 'Give Torvald 1 Heartstone and 150 shards', give: { heartstone: 1, shards: 150 } },
    ],
    close: [
      ['brann', 'She’s lit. Listen to her roar.'],
      ['brann', 'First thing off the anvil. It’s yours. Give it to whoever stands nearest the rim.'],
      ['odile', 'It’s… very good. Don’t tell him I said so.'],
      ['brann', 'I heard.'],
    ],
    rewardText: 'Pike’s Answer, a Masterwork hammer, and a page in the codex.',
    reward() { const it = addToStash(LOOT.makeRelic('pikes-answer', 'Torvald Pike'), true); return { codex: 'forge', item: it }; } },
  fox: { title: 'Clem’s Cards', who: 'Clem',
    ask: [
      ['fox', 'I read cards. Mostly to win pies. But sometimes they tell me things.'],
      ['fox', 'Feed me, keep things interesting, and I’ll read the claim’s days for you. Tomorrow’s, even.'],
      ['marigold', 'That means feed Clem.'],
      ['fox', 'It does mean feed me.'],
    ],
    steps: [
      { text: 'Give Clem 40 food', short: 'Give Clem 40 food', give: { food: 40 } },
      { text: 'Let her get the claim’s measure: see three of its days’ events through', short: 'See three day events through', done: Q => qSince(Q, 'events') >= 3, prog: Q => [Math.min(3, qSince(Q, 'events')), 3] },
    ],
    close: [
      ['fox', 'I’ve got the claim’s measure now. Every morning I’ll tell you what tomorrow holds. It’s in the journal.'],
      ['fox', 'And once a week, if the cards look bad, I can shuffle them. Don’t ask how.'],
      ['absalom', 'I’m asking how.'],
      ['fox', 'Don’t.'],
    ],
    rewardText: 'Clem’s cards: the journal shows tomorrow’s event, and once a week she can turn a day away.',
    reward() { return { codex: 'cards' }; } },
};
// the cast's gifts, renewed by their stories (shown in the journal)
const PERK_RENEWED = {
  halcyon: 'Wildlight take a third more harm from everything.',
  quill: 'Voyages bring home a fifth more shards.',
  tock: 'Cloud and rain dim the sunning yards half as much.',
};
const giveText = g => Object.entries(g).map(([k, n]) => k === 'shards' ? `${n} shards` : k === 'food' ? `${n} food` : `${n} ${D.MATERIALS[k].name}`).join(' and ');
const canGive = g => Object.entries(g).every(([k, n]) => (k === 'shards' ? GAME.shards : k === 'food' ? GAME.food : GAME.mats[k] || 0) >= n);

// ---- who's ready, offers, and hearing them out
function questReady(id) {
  if (QST[id] || !CAST_CREW[id] || !castHere(id)) return false;
  if (QUEST_JOIN[id] && !STORY.done.includes(QUEST_JOIN[id])) return false;
  const v = heroV(id); return !!v && (v.d.arrived ?? -99) <= GAME.day - 3;
}
const questsWaiting = () => Object.keys(QST).filter(id => QST[id].state === 'offer' && castHere(id));
function questsDay() {
  // one new offer at most every other day, so the stories don't all arrive at once
  if (ACT.offerDay != null && GAME.day - ACT.offerDay < 2) return;
  const id = Object.keys(QUESTS).find(questReady); if (!id) return;
  QST[id] = { state: 'offer', step: 0, day: GAME.day }; ACT.offerDay = GAME.day;
  const first = esc(CAST_NAMES[id].name.split(' ')[0]);
  toast(`<b>${first}</b> wants a word, and is waiting at the Keep. Tap the Keep to hear ${first} out.`);
  AUDIO.play('chime');
}
function questAccept(id, quiet = false) {
  const Q = QST[id], q = QUESTS[id]; if (!Q || Q.state !== 'offer') return false;
  const start = () => {
    Q.state = 'on'; Q.step = 0; Q.at = { ...ACT.tally }; Q.day = GAME.day;
    daysLog(`${CAST_NAMES[id].name.split(' ')[0]}’s story began: ${q.title}.`, 'cast');
    toast(`<b>${esc(q.who)}’s story · ${esc(q.title)}</b> is in the journal.`);
    questsCheck(); journalHUD(); UI.refresh(); saveGame();
  };
  if (quiet) { start(); return true; }
  UI.close();
  playScene({ lines: q.ask, heading: `${q.who}’s story · ${q.title}`, after: start });
  return true;
}
function questStepDone(id) {
  const Q = QST[id], q = QUESTS[id], S = q.steps[Q.step];
  Q.step++; Q.at = { ...ACT.tally };
  AUDIO.play('goal');
  if (Q.step < q.steps.length) { toast(`<b>${esc(q.who)}’s story:</b> ${esc(S.short || S.text)} ✓`); journalHUD(); return; }
  Q.state = 'done';
  const finish = () => {
    const r = q.reward() || {};
    if (r.codex && !STORY.codex.includes(r.codex)) STORY.codex.push(r.codex);
    daysLog(`${q.who}’s story is done: ${q.title}. ${q.rewardText}`, 'cast');
    toast(`<b>${esc(q.who)}’s story · ${esc(q.title)}</b> is done. ${esc(q.rewardText)}`);
    AUDIO.play('chapter'); journalHUD(); UI.refresh(); saveGame();
  };
  const sc = { lines: q.close, heading: `${q.who}’s story · ${q.title}`, after: finish };
  if (STORY.shown || EVT.card) STORY.queue.push(sc); else playScene(sc);
}
// hand over what a step asks for
function questGive(id) {
  const Q = QST[id]; if (!Q || Q.state !== 'on') return false;
  const S = QUESTS[id].steps[Q.step]; if (!S || !S.give || !canGive(S.give)) return false;
  for (const [k, n] of Object.entries(S.give)) { if (k === 'shards') GAME.shards -= n; else if (k === 'food') GAME.food -= n; else GAME.mats[k] -= n; }
  questStepDone(id); UI.refresh(); saveGame();
  return true;
}
// every so often: has anyone's current step come true?
function questsCheck() {
  for (const [id, Q] of Object.entries(QST)) {
    if (Q.state !== 'on') continue;
    const S = QUESTS[id].steps[Q.step];
    if (S && S.done && S.done(Q)) questStepDone(id);
  }
}

// ---- the HUD: under the chapter's goals, the cast's current steps and anyone waiting for a word
function questsHUD(withChapter) {
  const lines = [];
  for (const id of questsWaiting()) lines.push(`<span class="q wait"><i>✦</i>${esc(CAST_NAMES[id].name.split(' ')[0])} wants a word at the Keep</span>`);
  for (const [id, Q] of Object.entries(QST)) {
    if (Q.state !== 'on' || !castHere(id)) continue;
    const S = QUESTS[id].steps[Q.step]; if (!S) continue;
    const p = S.prog && S.prog(Q), can = S.give && canGive(S.give);
    lines.push(`<span class="q${can ? ' ready' : ''}"><i>${can ? '◆' : '◇'}</i>${esc(QUESTS[id].who)}: ${esc(S.short || S.text)}${p ? ` <em>${p[0]}/${p[1]}</em>` : ''}${can ? ' <em>(tap to give)</em>' : ''}</span>`);
  }
  if (!lines.length) return '';
  return (withChapter ? '' : '<b>The cast’s stories</b>') + lines.slice(0, 3).join('');
}

// ---- the journal's cast page: each visitor on the claim, their gift, and their story so far
function questsJournal(ui, body) {
  const ids = Object.keys(CAST_CREW).filter(id => castHere(id) || QST[id]);
  if (!ids.length) { body.append(ui.h(`<p class="small">Nobody from the cast is on the claim yet. Visitors come in the story's chapters, and some of them stay.</p>`)); return; }
  for (const id of ids) {
    const v = heroV(id), N = CAST_NAMES[id], C = CAST_CREW[id], Q = QST[id], q = QUESTS[id];
    const card = document.createElement('div'); card.className = 'qcard';
    if (v) card.append(faceOf(v));
    const info = document.createElement('div');
    info.append(ui.h(`<p class="qn"><b>${esc(N.name)}</b> <span class="small">${esc(N.title)}${v && v.d.exp ? ' · in the wilds' : !v ? ' · away' : ''}</span></p>
      <p class="small"><b>${esc(C.perk)}.</b> ${esc(C.perkText)}${questDone(id) && PERK_RENEWED[id] ? ` <span class="good">Renewed: ${esc(PERK_RENEWED[id])}</span>` : ''}</p>`));
    if (!Q) {
      const left = v ? Math.max(1, (v.d.arrived ?? 0) + 3 - GAME.day) : 0;
      info.append(ui.h(`<p class="small qwait">${v && QUEST_JOIN[id] && !STORY.done.includes(QUEST_JOIN[id]) ? 'Still settling in.' : `Settling in. ${esc(N.name.split(' ')[0])} will have something to ask${left > 1 ? ' in a day or two' : ' soon'}.`}</p>`));
    } else if (Q.state === 'offer') {
      const b = ui.h(`<p><button type="button" class="btn primary">Hear ${esc(q.who)} out</button> <span class="small">${esc(q.who)} wants a word.</span></p>`);
      b.querySelector('button').onclick = () => questAccept(id); info.append(b);
    } else {
      info.append(ui.h(`<p class="qt">${esc(q.title)}${Q.state === 'done' ? ' ✓' : ''}</p>`));
      const ul = document.createElement('ul'); ul.className = 'qsteps';
      q.steps.forEach((S, i) => {
        if (Q.state !== 'done' && i > Q.step) return;
        const li = document.createElement('li'), cur = Q.state === 'on' && i === Q.step, p = cur && S.prog && S.prog(Q);
        li.className = cur ? 'cur' : 'ok';
        li.innerHTML = `<i>${cur ? '◇' : '✓'}</i><span>${esc(S.text)}${p ? ` (${p[0]} of ${p[1]})` : ''}</span>`;
        if (cur && S.give) { const can = canGive(S.give), bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn' + (can ? ' primary' : ''); bt.disabled = !can; bt.textContent = `Give ${giveText(S.give)}`; bt.onclick = () => questGive(id); li.append(bt); }
        ul.append(li);
      });
      info.append(ul);
      if (Q.state === 'done') info.append(ui.h(`<p class="small good">${esc(q.rewardText)}</p>`));
    }
    card.append(info); body.append(card);
  }
}

// ---- at the Keep: whoever wants a word waits there (a marker over it, and a card at the top of its panel)
const _uiBuilding = UI.building;
UI.building = function (body, b) {
  if (b && b.type === 'keep') for (const id of questsWaiting()) {
    const v = heroV(id), q = QUESTS[id], row = document.createElement('div'); row.className = 'qoffer';
    if (v) row.append(faceOf(v));
    row.append(this.h(`<span><b>${esc(CAST_NAMES[id].name)}</b> wants a word.</span>`));
    const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn primary'; bt.textContent = 'Hear them out'; bt.onclick = () => questAccept(id);
    row.append(bt); body.append(row);
  }
  return _uiBuilding.call(this, body, b);
};
const _qm = new THREE.Vector3();
function questMarker() {
  const K = TOWN.b.keep, wait = questsWaiting();
  let el = document.getElementById('qmark');
  const show = wait.length && K && VIEW.mode === 'town' && !(SKY && SKY.on) && !BUILD.on && !STORY.shown && !EVT.card && !(UI.cur && UI.cur.kind === 'building' && UI.cur.ref === K);
  if (!show) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('button'); el.type = 'button'; el.id = 'qmark'; el.className = 'qmark'; el.onclick = () => selectBuilding(TOWN.b.keep); $('#app').append(el); }
  const txt = `${CAST_NAMES[wait[0]].name.split(' ')[0]} wants a word${wait.length > 1 ? ` (+${wait.length - 1})` : ''}`;
  if (el.textContent !== txt) el.textContent = txt;
  _qm.copy(K.worldPos(0, 15, 0)).project(camera);
  const vis = _qm.z < 1 && Math.abs(_qm.x) < 1.05 && Math.abs(_qm.y) < 1.05;
  el.hidden = !vis;
  if (vis) el.style.transform = `translate(${(_qm.x * 0.5 + 0.5) * innerWidth}px, ${(-_qm.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
}

// ---- saving
function questsSave() { return JSON.parse(JSON.stringify(QST)); }
function questsLoad(s) {
  for (const k of Object.keys(QST)) delete QST[k];
  for (const [id, Q] of Object.entries(s || {})) if (QUESTS[id] && Q && Q.state) QST[id] = { state: Q.state, step: Q.step || 0, at: Q.at || { ...ACT.tally }, day: Q.day ?? GAME.day };
  // the cast from before arrival days were kept: they've been here a while
  for (const v of GAME.villagers) if (v.d.hero && v.d.arrived == null) v.d.arrived = GAME.day - 3;
}
