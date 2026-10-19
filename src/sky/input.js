// input.js: one set of controls from the keyboard and mouse (a laptop) or the touch screen (a phone), both at once.
//   Laptop: W/S sails, A/D or arrows turn, Space/E or Up climb, Shift/Q or Down dive, mouse aims (click the view to
//   lock the mouse to it; Esc lets go), left click or F fires, R surges, C looks ahead, M map, P pause, H help.
//   Phone: a stick under the left thumb steers and climbs, dragging on the right aims, Fire, Surge and the sail buttons.
// Only while `active` (flying); in port and on the title screen the controls are left alone.
export function makeInput(canvas, el) {
  const keys = new Set();
  const s = {
    turn: 0, climb: 0, sail: 0, fire: false, look: { x: 0, y: 0 }, zoom: 0, lastLook: -1e9, locked: false,
    pressed: new Set(), // keys pressed since the last frame (for one-off actions)
    active: true,
  };
  const now = () => performance.now() / 1000;
  const typing = (e) => /input|textarea|select/i.test(e.target.tagName);
  addEventListener('keydown', (e) => {
    if (typing(e) || !s.active) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys.has(k)) s.pressed.add(k);
    keys.add(k);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => { keys.clear(); s.fire = false; mouseFire = false; });

  // ---------- the mouse: lock it to the view to aim; without the lock, drag to aim and click to fire ----------
  let mouseFire = false, drag = null, lockable = !!canvas.requestPointerLock, everLocked = false, lastTouch = -9;
  const fromTouch = () => now() - lastTouch < 1; // phones also send a pretend mouse click after a tap: ignore it
  const lockOK = () => document.pointerLockElement === canvas;
  // if the page isn't allowed to lock the mouse (some embedded pages aren't), dragging aims and the left button fires
  const noLock = () => {
    if (!lockable || everLocked) return; // once it has worked, a refusal is only the browser asking to wait a moment
    lockable = false; el.classList.add('nolock');
    const hint = el.querySelector('#lock-hint'); if (hint) hint.textContent = 'Drag the sky to aim. Left click or F fires.';
  };
  if (!lockable) { lockable = true; noLock(); }
  document.addEventListener('pointerlockchange', () => { s.locked = lockOK(); everLocked ||= s.locked; el.classList.toggle('locked', s.locked); });
  document.addEventListener('pointerlockerror', noLock);
  canvas.addEventListener('mousedown', (e) => {
    if (fromTouch() || !s.active) return;
    if (e.button === 0 && (s.locked || !lockable)) mouseFire = true;
    if (s.locked) return;
    if (e.button === 0 || e.button === 2) drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button };
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseFire = false;
    if (drag && drag.button === 0 && drag.moved < 6 && !s.locked && lockable && !fromTouch()) {
      // a plain click: lock the mouse to the view for aiming (laptops); if the page won't allow it, dragging still aims
      try { const p = canvas.requestPointerLock(); p?.catch?.(noLock); } catch { noLock(); }
    }
    drag = null;
  });
  addEventListener('mousemove', (e) => {
    if (s.locked) { s.look.x += e.movementX; s.look.y += e.movementY; s.lastLook = now(); return; }
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); s.look.x += dx; s.look.y += dy; drag.x = e.clientX; drag.y = e.clientY; s.lastLook = now(); }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); s.zoom += Math.sign(e.deltaY); }, { passive: false });

  // ---------- touch: the stick on the left, aiming on the right, buttons ----------
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, aims = new Map();
  const knob = el.querySelector('#stick'), knobDot = el.querySelector('#stick i');
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !s.active) return;
    lastTouch = now();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* still works without */ }
    if (e.clientX < innerWidth * 0.42 && stick.id === null) {
      Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
      knob.hidden = false; knob.style.left = e.clientX + 'px'; knob.style.top = e.clientY + 'px'; knobDot.style.transform = 'translate(0px, 0px)';
    } else aims.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') return;
    if (e.pointerId === stick.id) {
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const r = Math.hypot(dx, dy), R = 56;
      if (r > R) { dx *= R / r; dy *= R / r; }
      stick.x = dx / R; stick.y = dy / R; knobDot.style.transform = `translate(${dx}px, ${dy}px)`;
      return;
    }
    const a = aims.get(e.pointerId); if (!a) return;
    s.look.x += (e.clientX - a.x) * 1.6; s.look.y += (e.clientY - a.y) * 1.6; a.x = e.clientX; a.y = e.clientY; s.lastLook = now();
  });
  const up = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.hidden = true; } aims.delete(e.pointerId); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  let touchFire = false, sailHold = 0;
  const hold = (id, on, off) => {
    const b = el.querySelector(id);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* still works without */ } on(); b.classList.add('on'); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { off(); b.classList.remove('on'); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  hold('#btn-fire', () => { touchFire = true; }, () => { touchFire = false; });
  hold('#btn-sail-up', () => { sailHold = 1; }, () => { sailHold = 0; });
  hold('#btn-sail-down', () => { sailHold = -1; }, () => { sailHold = 0; });
  el.querySelector('#btn-surge').addEventListener('pointerdown', (e) => { e.preventDefault(); s.pressed.add('r'); });

  // every frame: combine everything into one set of controls
  s.read = () => {
    if (!s.active) {
      keys.clear(); s.pressed.clear(); s.look.x = s.look.y = 0; s.zoom = 0; mouseFire = touchFire = false; sailHold = 0;
      return { turn: 0, climb: 0, sail: 0, fire: false, look: { x: 0, y: 0 }, zoom: 0, pressed: new Set(), lastLook: s.lastLook, locked: s.locked };
    }
    const k = (...names) => names.some((n) => keys.has(n)) ? 1 : 0;
    s.turn = Math.max(-1, Math.min(1, k('d', 'ArrowRight') - k('a', 'ArrowLeft') + stick.x));
    s.climb = Math.max(-1, Math.min(1, k(' ', 'e', 'ArrowUp') - k('Shift', 'q', 'ArrowDown') - stick.y));
    s.sail = k('w') - k('s') + sailHold;
    s.fire = mouseFire || touchFire || !!k('f');
    const look = { ...s.look }, zoom = s.zoom, pressed = new Set(s.pressed);
    s.look.x = s.look.y = 0; s.zoom = 0; s.pressed.clear();
    return { turn: s.turn, climb: s.climb, sail: s.sail, fire: s.fire, look, zoom, pressed, lastLook: s.lastLook, locked: s.locked };
  };
  return s;
}
