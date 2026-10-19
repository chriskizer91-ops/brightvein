// ===================================================================== JUMPERS: Baron Tallow's crews come for the claim
// Once Tallow's letter has come (chapter 2), every few days his claim-jumpers fly in by day under rust-red sails. They
// circle the rim, fire on the sunning yards and knock the charged shards loose to carry off. The claim fights back
// with what it has: lens towers (their crews run up even by day), clockwork ballistas, the Lark if she has a crew,
// and the Captain's own ship at the Sky Dock, whose guns reach anything that comes near the north rim. Bring a jumper
// down and she falls into the cloud and leaves a crate behind; leave her be and she sails off with what she took.
// Once the Chandlery is taken, they stop coming, until act two: from chapter 11 the Gilded Exchange's hired crews come
// the same way under silver sails, until the Grindstone is sunk (exchangeCrews, acttwo.js).
// They're targets in WL.list (air: true), so every turret sees them.
const JUMP = { list: [], next: null, art: null, silverArt: null };
const JUMP_HP = { skiff: 260, cutter: 420 };
function jumperArt(silver = false) {
  const key = silver ? 'silverArt' : 'art';
  if (JUMP[key] || !SKY || !SKY.shipArt) return JUMP[key];
  const A = SKY.shipArt, M = { ...A.M, hull: A.M.hull.clone(), canvas: A.M.canvas.clone() };
  M.canvas.onBeforeCompile = A.M.canvas.onBeforeCompile; M.canvas.customProgramCacheKey = A.M.canvas.customProgramCacheKey;
  if (silver) { M.hull.color.set(0x8d939c); M.canvas.color.set(0xe4e8ee); M.canvas.emissive.set(0x2a2e36); }
  else { M.hull.color.set(0x9a8781); M.canvas.color.set(0xc8735c); M.canvas.emissive.set(0x7a3020); }
  return (JUMP[key] = { ...A, M });
}
class Jumper {
  constructor(kind, k, n) {
    this.air = true; this.kind = kind; this.dead = false; this.hp = this.max = JUMP_HP[kind] * (1 + Math.max(0, STORY.ch - 2) * 0.12);
    const R = SHIPS.find(s => s.id === kind);
    this.silver = exchangeCrews(); this.ship = buildShipAt(R, 'middle', jumperArt(this.silver)); this.root = this.ship.root; this.root.userData.jumper = this;
    scene.add(this.root);
    this.ang = Math.random() * TAU + k * (TAU / n); this.r = 36 + k * 4; this.h = 15 + k * 3;
    this.phase = 'in'; this.t = 0; this.cool = 3 + k * 1.5; this.stolen = 0; this.pos = new THREE.Vector3(); this.smokeT = 0;
    this.from = new THREE.Vector3(Math.cos(this.ang) * 260, 60, Math.sin(this.ang) * 260);
    this.root.position.copy(this.from);
  }
  hurt(d) {
    if (this.dead || this.phase === 'down') return;
    this.hp -= d; FX.sparks(this.pos.clone(), 8, 0xffa060, 3);
    if (this.hp <= 0) { this.phase = 'down'; this.t = 0; this.downAt = this.root.position.clone(); AUDIO.play('jumperdown', this.root.position); jumperDowned(this); }
  }
  die() { if (this.phase !== 'down') { this.phase = 'flee'; this.t = 0; this.fleeFrom = this.root.position.clone(); } }
  update(dt) {
    const S = this.ship, P = this.root.position;
    this.t += dt;
    const ring = a => new THREE.Vector3(Math.cos(a) * this.r, this.h + Math.sin(this.t * 0.9) * 0.6, Math.sin(a) * this.r * 0.88 - 2);
    if (this.phase === 'in') {
      const k = smooth(0, 1, this.t / 12), to = ring(this.ang);
      P.lerpVectors(this.from, to, k);
      this.root.rotation.y = Math.atan2(to.x - this.from.x, to.z - this.from.z);
      if (k >= 1) { this.phase = 'strafe'; this.t = 0; }
    } else if (this.phase === 'strafe') {
      this.ang += dt * 0.11; P.copy(ring(this.ang));
      this.root.rotation.y = Math.atan2(-Math.sin(this.ang), Math.cos(this.ang) * 0.88);
      // a volley at the nearest sunning yard (or anything of the claim's), knocking charged shards loose
      if ((this.cool -= dt) <= 0) {
        this.cool = 4 + Math.random() * 2;
        const yards = byType('yard'), pool = yards.length ? yards : Object.values(TOWN.b).filter(b => !b.pending);
        let best = null, bd = 1e9; for (const b of pool) { const d = Math.hypot(b.L.x - P.x, b.L.z - P.z); if (d < bd) { bd = d; best = b; } }
        if (best && bd < 60) {
          const at = new THREE.Vector3(best.L.x + (Math.random() - 0.5) * 4, 0.6, best.L.z + (Math.random() - 0.5) * 3);
          for (let i = 0; i < 2; i++) fireBeam(P.clone().add(new THREE.Vector3(0, 0.5, 0)), at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), 0xff5a40, 0.8);
          FX.sparks(at, 14, 0xffb050, 3); AUDIO.play('volley', P);
          const take = Math.min(Math.max(0, GAME.shards), best.type === 'yard' ? 7 : 3);
          GAME.shards -= take; this.stolen += take;
        }
      }
      if (this.t > 75) this.die();
    } else if (this.phase === 'flee') {
      const k = smooth(0, 1, this.t / 10), out = new THREE.Vector3(Math.cos(this.ang) * 300, 70, Math.sin(this.ang) * 300);
      P.lerpVectors(this.fleeFrom, out, k);
      this.root.rotation.y = Math.atan2(out.x - this.fleeFrom.x, out.z - this.fleeFrom.z);
      if (k >= 1) { if (this.stolen) toast(`The ${this.silver ? 'Exchange’s' : 'jumper'} ${this.kind} got away with ${SHARD} ${Math.round(this.stolen)} shards.`); return this.gone(); }
    } else if (this.phase === 'down') {
      // she rolls over and drops into the cloud, burning
      P.y -= dt * (2 + this.t * 3); this.root.rotation.z = Math.min(1.1, this.t * 0.35); this.root.rotation.x = Math.min(0.5, this.t * 0.12);
      if ((this.smokeT -= dt) <= 0) { this.smokeT = 0.08; FX.smoke(P.clone().add(new THREE.Vector3(0, 1, 0)), 0x3a3030); }
      if (this.t > 7) return this.gone();
    }
    S.update(dt, { calm: this.phase === 'strafe' });
    S.glow.material.uniforms.uScale.value = 0.6 * renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.pos.copy(P); this.pos.y += 0.5;
    return true;
  }
  gone() { this.dead = true; scene.remove(this.root); JUMP.list.splice(JUMP.list.indexOf(this), 1); return false; }
}
function jumperDowned(j) {
  const haul = LOOT.raidCrates('camp'), item = haul.items[0];
  GAME.shards += 25 + Math.round(j.stolen);
  if (item) addToStash(item, true);
  toast(`<b>${j.silver ? 'The Exchange’s' : 'A jumper'} ${j.kind} is going down!</b> She leaves ${SHARD} ${25 + Math.round(j.stolen)}${item ? ` and a crate: <b style="color:${rarityOf(item).color}">${esc(item.name)}</b>` : ''}.`);
}
// the Captain's ship at the Sky Dock fires on any jumper that comes in reach
const DOCK_GUN = { skiff: 16, cutter: 24, brig: 34, frigate: 46 };
let dockGunT = 0;
function dockGuns(dt) {
  const s = DOCK.ship; if (!s || s.root.parent !== scene || !JUMP.list.length) return;
  if ((dockGunT -= dt) > 0) return;
  const at = s.root.position.clone().add(new THREE.Vector3(0, 2, 0));
  let best = null, bd = 75; for (const j of JUMP.list) { if (j.phase === 'down' || j.phase === 'in') continue; const d = j.pos.distanceTo(at); if (d < bd) { bd = d; best = j; } }
  if (!best) return;
  dockGunT = 2.2;
  fireBeam(at, best.pos.clone(), 0xffd08a, 1.2); best.hurt(DOCK_GUN[s.recipe.id] || 16); AUDIO.play('cannon', at);
}
// every few days, by day, once Tallow knows the claim is there; not once the Chandlery is taken
const jumpersActive = () => JUMP.list.some(j => !j.dead && j.phase !== 'down');
function jumpersTick(dt) {
  if (!started || !BUILD.setupDone) return;
  dockGuns(dt);
  if (STORY.ch < 2 || (STORY.ch === 2 && !STORY.started) || (FLEET && FLEET.data.raids.citadel.won && !exchangeCrews()) || JUMP.list.length || BUILD.on) return;
  if (JUMP.next == null) JUMP.next = GAME.day + 1;
  if (GAME.day < JUMP.next || TOD.t < 0.2 || TOD.t > 0.45 || !jumperArt(exchangeCrews()) || EVT.card) return;
  JUMP.next = GAME.day + 2 + Math.floor(Math.random() * 2);
  const kinds = STORY.ch <= 3 ? ['skiff'] : STORY.ch <= 5 ? ['skiff', 'skiff'] : ['cutter', 'skiff'];
  kinds.forEach((k, i) => { const j = new Jumper(k, i, kinds.length); JUMP.list.push(j); WL.list.push(j); });
  toast(exchangeCrews() ? `<b>Silver sails over the rim!</b> The Exchange's hired crews have come for the yards. Turrets, the Lark and your ship will fire on them.`
    : `<b>Rust-red sails over the rim!</b> Tallow's jumpers have come for the yards. Turrets, the Lark and your ship will fire on them.`, 'night');
  AUDIO.play('warhorn');
}
