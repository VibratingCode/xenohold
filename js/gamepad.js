'use strict';
// Controller support (standard-mapping gamepads: Xbox, PlayStation, most others).
//   Left stick move · right stick look · RT fire · LT aim · A jump · B crouch · X reload / interact (hold for vents)
//   Y switch weapon · RB lethal · LB tactical · R3 knife · L3 sprint · D-pad up flashlight · D-pad down shield
//   Start pause · in menus: D-pad or left stick to move, A to select, B to go back.
// In split-screen co-op the first controller belongs to Player 2 (see coop.js) and Player 1 keeps the keyboard and
// mouse, or a second controller.
(function () {
  const U = XH.U;
  const GP = XH.gamepad = { active: false, lastUse: -1e9 };
  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  GP.B = B;
  const DEAD = 0.18;
  const prev = {}; // per pad index: previous button states
  const dz = (v) => (Math.abs(v) < DEAD ? 0 : Math.sign(v) * (Math.abs(v) - DEAD) / (1 - DEAD));

  GP.pads = () => { const out = []; const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of l) if (p && p.connected) out.push(p); return out; };
  // a snapshot of one pad with edge detection
  GP.read = (pad) => {
    const was = prev[pad.index] || [], now = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    prev[pad.index] = now;
    const ax = pad.axes;
    return {
      pad, now, down: (b) => now[b] && !was[b], held: (b) => !!now[b], val: (b) => (pad.buttons[b] ? pad.buttons[b].value : 0),
      lx: dz(ax[0] || 0), ly: dz(ax[1] || 0), rx: dz(ax[2] || 0), ry: dz(ax[3] || 0),
      any: now.some(Boolean) || Math.abs(ax[0] || 0) > 0.4 || Math.abs(ax[1] || 0) > 0.4 || Math.abs(ax[2] || 0) > 0.4 || Math.abs(ax[3] || 0) > 0.4,
    };
  };
  // who is Player 1's pad: in co-op the first pad is Player 2's, so Player 1 gets the second one (if any)
  GP.p1Index = () => { const pads = GP.pads(); if (XH.coop && XH.coop.on()) return pads[1] ? pads[1].index : -1; return pads[0] ? pads[0].index : -1; };

  addEventListener('mousemove', (e) => { if (document.pointerLockElement && (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)) GP.active = false; });
  addEventListener('keydown', () => { if (!(XH.coop && XH.coop.on())) GP.active = false; });
  addEventListener('gamepadconnected', (e) => { if (XH.ui && XH.ui.banner && XH.game && XH.game.state === 'playing') XH.ui.banner('CONTROLLER CONNECTED', e.gamepad.id.slice(0, 40), '#60c0ff'); });

  // ---------------- per frame ----------------
  let sprintLatch = false, repeatT = 0, lastDir = null;
  GP.frame = (dt) => {
    const pads = GP.pads(); if (!pads.length) return;
    // co-op: the first pad drives Player 2
    if (XH.coop && XH.coop.on() && pads[0]) XH.coop.input(GP.read(pads[0]), dt);
    const i1 = GP.p1Index(); if (i1 < 0) return;
    const pad = pads.find((p) => p.index === i1); const s = GP.read(pad);
    if (s.any) { GP.active = true; GP.lastUse = performance.now(); }
    if (!GP.active) return;
    const Gm = XH.game, M = XH.main, UI = XH.ui;
    const inGame = Gm.state === 'playing' && M.mode === 'game' && !M.paused && UI.cur == null;
    if (inGame) game(s, dt);
    else if (Gm.state === 'playing' && M.mode === 'game' && M.paused && UI.cur == null) { if (s.down(B.A) || s.down(B.START)) M.resume(); } // "click to play"
    else menu(s, dt);
  };

  function game(s, dt) {
    const P = XH.player, W = XH.weapons, G = XH.game;
    if (XH.sys && XH.sys.intro) { if (s.down(B.A) || s.down(B.START)) XH.sys.skipIntro(); return; }
    // movement and look
    P.pad = { x: s.lx, y: s.ly, sprint: false };
    if (s.down(B.L3)) sprintLatch = !sprintLatch;
    if (s.ly > -0.3) sprintLatch = false;
    P.pad.sprint = sprintLatch;
    const ads = W.adsAmount(), rate = 950 * P.settings.sens * (1 - ads * 0.45);
    const cx = Math.sign(s.rx) * s.rx * s.rx, cy = Math.sign(s.ry) * s.ry * s.ry; // curve: fine aim near the centre
    if (cx || cy) P.padLook(cx * rate * dt, cy * rate * dt * 0.75);
    // triggers
    W.setTrigger(s.val(B.RT) > 0.3); W.setAds(s.val(B.LT) > 0.3);
    if (s.down(B.A)) P.jumpQueued = true;
    if (s.down(B.B)) P.crouchToggle = !P.crouchToggle;
    if (s.down(B.X)) { const pr = G.prompt(); if (pr && pr.act && !P.downed) G.interact(); else W.reload(); }
    P.keys.KeyE = s.held(B.X); // held prompts (boarding up vents)
    if (s.down(B.Y)) W.cycle();
    if (s.down(B.RB)) W.throwGrenade();
    if (s.down(B.LB)) W.throwTactical();
    if (s.down(B.R3)) W.knife();
    if (s.down(B.UP)) { P.flashUser = !P.flashOn; XH.audio.play('empty', { vol: 0.5 }); }
    if (s.down(B.DOWN)) W.setShield(true);
    if (GP.shieldHeld && !s.held(B.DOWN)) W.setShield(false);
    GP.shieldHeld = s.held(B.DOWN);
    if (s.down(B.START) || s.down(B.BACK)) XH.main.pause();
  }

  // ---------------- menus: spatial focus ----------------
  const FOCUS = 'button:not([disabled]), .lotile:not(.locked), .mapcard, .sa:not(.locked), select, input[type=range], .achtile, [data-go]';
  function visibleItems() {
    const UI = XH.ui, cur = UI.cur ? document.getElementById('m-' + UI.cur) : null;
    const scope = cur || document;
    return [...scope.querySelectorAll(FOCUS)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.hidden'); });
  }
  let focused = null;
  function setFocus(el) {
    if (focused) focused.classList.remove('gpf');
    focused = el; if (!el) return;
    el.classList.add('gpf'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (el.matches('button, select, input')) el.focus({ preventScroll: true });
  }
  function move(dx, dy) {
    const items = visibleItems(); if (!items.length) return;
    if (!focused || !items.includes(focused)) { setFocus(items.find((e) => e.classList.contains('primary')) || items[0]); return; }
    const a = focused.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = 1e9;
    for (const el of items) {
      if (el === focused) continue;
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, vx = x - ax, vy = y - ay;
      const along = vx * dx + vy * dy; if (along <= 4) continue;
      const across = Math.abs(vx * dy - vy * dx), score = along + across * 2.5;
      if (score < bs) { bs = score; best = el; }
    }
    if (best) { setFocus(best); XH.audio.play('uiHover', { vol: 0.4 }); }
  }
  function menu(s, dt) {
    let dx = 0, dy = 0;
    if (s.held(B.UP) || s.ly < -0.6) dy = -1; else if (s.held(B.DOWN) || s.ly > 0.6) dy = 1;
    else if (s.held(B.LEFT) || s.lx < -0.6) dx = -1; else if (s.held(B.RIGHT) || s.lx > 0.6) dx = 1;
    const dir = dx || dy ? dx + ',' + dy : null;
    repeatT -= dt;
    if (dir && (dir !== lastDir || repeatT <= 0)) {
      if (focused && focused.matches('input[type=range]') && dx) { focused.value = +focused.value + dx * (+focused.step || 1); focused.dispatchEvent(new Event('input', { bubbles: true })); focused.dispatchEvent(new Event('change', { bubbles: true })); }
      else move(dx, dy);
      repeatT = dir === lastDir ? 0.12 : 0.35;
    }
    lastDir = dir;
    if (s.down(B.A)) { const items = visibleItems(); if (!focused || !items.includes(focused)) setFocus(items[0]); else { focused.click(); XH.audio.play('uiClick'); setTimeout(() => { const it = visibleItems(); if (!it.includes(focused)) setFocus(null); }, 60); } }
    if (s.down(B.B) || s.down(B.BACK)) {
      const cur = XH.ui.cur && document.getElementById('m-' + XH.ui.cur);
      const back = cur && (cur.querySelector('.back') || cur.querySelector('[data-back]') || cur.querySelector('#resumeBtn'));
      if (back) { back.click(); setFocus(null); }
    }
    if (s.down(B.START) && XH.ui.cur === 'pause') { XH.main.resume(); setFocus(null); }
    // right stick scrolls long menus
    if (Math.abs(s.ry) > 0.2) { const cur = XH.ui.cur && document.getElementById('m-' + XH.ui.cur); const sc = cur && [cur, ...cur.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)); if (sc) sc.scrollTop += s.ry * 900 * dt; }
  }
  (function loop() { let t = performance.now(); const tick = () => { const n = performance.now(), dt = Math.min(0.1, (n - t) / 1000); t = n; try { GP.frame(dt); } catch (e) { console.error(e); } requestAnimationFrame(tick); }; requestAnimationFrame(tick); })();
})();
