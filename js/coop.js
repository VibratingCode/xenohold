'use strict';
// Local split-screen co-op. Player 1 plays on the left half with the keyboard and mouse (or a second controller),
// Player 2 on the right half with the first controller. Points are shared. Creatures go for whichever player is
// closer. Each player gets one self-revive (SELF_REVIVES for two players); after that, a downed player bleeds out
// for 30 s unless the other one revives them (stand close and hold X / E for 3 s). A player who bleeds out is back
// at the start of the next round. The game ends when both are out.
// Player 2 is a lighter soldier than Player 1: guns, a knife, grenades, doors, wall buys and revives, but no perks,
// Xeno Cache or Forge. Online co-op would need a server, so it is not here.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, E = XH.enemies, WP = XH.weapons;
  const CO = XH.coop = {};
  const G = () => XH.game, P = () => XH.player, W = () => XH.world, UI = () => XH.ui;
  const REVIVE = 3, BLEED = 30, $ = (id) => document.getElementById(id);

  CO.p2 = null;
  CO.on = () => !!(CO.p2 && G().players > 1 && G().state !== 'menu');
  CO.stats = null;
  const newStats = () => ({ kills: 0, heads: 0, shots: 0, earned: 0, doors: 0, perks: 0, time: 0, melee: 0, bosses: 0, upgrades: 0, boom: 0, hits: 0, dmg: 0, spent: 0, downs: 0, revives: 0, streak: 0, bestStreak: 0, multi: 0, bestMulti: 0, multiT: -9, wk: {}, rk: [] });

  // ---------------- models ----------------
  function bodyModel(color, layer) {
    const g = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6, metalness: 0.3 }), trim = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
    const add = (geo, mat, p, s) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.scale.set(...s); m.layers.set(layer); g.add(m); return m; };
    const box = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(1, 12, 8);
    add(box, suit, [0, 1.18, 0], [0.46, 0.62, 0.28]); add(box, trim, [0, 1.3, 0.145], [0.3, 0.08, 0.02]);
    add(sph, suit, [0, 1.66, 0], [0.16, 0.18, 0.16]); add(box, trim, [0, 1.68, 0.12], [0.2, 0.06, 0.06]);
    add(box, suit, [-0.12, 0.44, 0], [0.16, 0.86, 0.18]); add(box, suit, [0.12, 0.44, 0], [0.16, 0.86, 0.18]);
    add(box, suit, [-0.3, 1.1, 0.12], [0.12, 0.5, 0.12]); add(box, suit, [0.3, 1.1, 0.12], [0.12, 0.5, 0.12]);
    add(box, new THREE.MeshStandardMaterial({ color: 0x1c1f22, metalness: 0.7 }), [0.12, 1.12, 0.42], [0.08, 0.1, 0.55]);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.layers.set(layer); g.add(ring);
    return g;
  }

  // ---------------- start / stop ----------------
  CO.start = () => {
    CO.stop();
    const Gm = G(); if (!(Gm.mods && Gm.mods.coop)) return;
    const s = W().start, sc = W().root.parent;
    const p2 = CO.p2 = {
      isP2: true, pos: new THREE.Vector3(s.x + 1.2, 0, s.z + 0.6), vel: new THREE.Vector3(), yaw: P().yaw, pitch: 0, eyeH: 1.65, hp: 100, maxHp: 100,
      downed: null, downT: 0, lastHurt: -99, sprinting: false, onStruct: false, time: 0, lives: XH.SELF_REVIVES ? XH.SELF_REVIVES(2) : 1,
      inv: [WP.slot('p9')], cur: 0, fireCd: 0, reloadT: 0, grenades: 2, knifeCd: 0, kick: 0, crouch: false, revT: 0, prompt: null,
    };
    if (Gm.mods.oneLife) p2.lives = 0;
    p2.hurt = (amt, from) => hurt(amt, from); p2.knock = (dir, f) => { p2.vel.x += dir.x * f; p2.vel.z += dir.z * f; };
    p2.debuff = () => {};
    // camera, flashlight and viewmodel
    const cam = CO.cam = new THREE.PerspectiveCamera(P().settings.fov, 1, 0.05, 800); cam.rotation.order = 'YXZ'; sc.add(cam);
    cam.layers.enable(3);
    const fl = CO.flash = new THREE.SpotLight(0xfff2dd, W().dark ? 2.2 : 0, 30, 0.42, 0.5, 1.5); fl.position.set(0.2, -0.1, 0); cam.add(fl); fl.target.position.set(0, 0, -5); cam.add(fl.target);
    CO.vmScene = new THREE.Scene(); CO.vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    CO.vmScene.add(new THREE.HemisphereLight(0xdde6ff, 0x404048, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(1, 2, 1); CO.vmScene.add(dl);
    CO.vmGun = null; setGun();
    // bodies: each player sees the other one
    CO.body2 = bodyModel(0xffa040, 2); sc.add(CO.body2);
    CO.body1 = bodyModel(0x40c0ff, 3); sc.add(CO.body1);
    P().cam.layers.enable(2);
    CO.stats = newStats();
    CO.in = { lx: 0, ly: 0, rx: 0, ry: 0, rt: 0, lt: 0, held: {}, down: {} };
    hud(true); layout(true);
    UI().banner('SPLIT-SCREEN CO-OP', 'Player 2 is on the right, with the controller', '#ffa040');
  };
  CO.stop = () => {
    if (!CO.p2) return;
    const sc = W().root && W().root.parent;
    if (sc) { sc.remove(CO.cam); sc.remove(CO.body1); sc.remove(CO.body2); }
    P().cam.layers.disable(2);
    CO.p2 = null; hud(false); layout(false);
  };
  function setGun() {
    const p2 = CO.p2, slot = p2.inv[p2.cur];
    if (CO.vmGun) CO.vmScene.remove(CO.vmGun);
    const g = CO.vmGun = WP.flatModel(slot.id, slot.upg); g.scale.setScalar(1); g.position.set(0.16, -0.16, -0.36); g.rotation.set(0, Math.PI / 2, 0);
    CO.vmScene.add(g); p2.reloadT = 0;
  }
  // split the screen: Player 1 on the left, Player 2 on the right
  function layout(on) {
    const hudEl = $('hud'); if (hudEl) hudEl.style.right = on ? '50%' : '';
    const m = XH.main; if (m && m.setSplit) m.setSplit(on);
  }

  // ---------------- input (from gamepad.js) ----------------
  CO.input = (s, dt) => {
    if (!CO.on()) return;
    const i = CO.in; i.lx = s.lx; i.ly = s.ly; i.rx = s.rx; i.ry = s.ry; i.rt = s.val(7); i.lt = s.val(6);
    for (let b = 0; b < 17; b++) { i.held[b] = s.held(b); if (s.down(b)) i.down[b] = true; }
    if (s.down(9) && G().state === 'playing' && !XH.main.paused) XH.main.pause();
  };
  const pressed = (b) => { const d = CO.in.down[b]; CO.in.down[b] = false; return !!d; };

  // ---------------- simulation ----------------
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
  CO.update = (dt) => {
    const p2 = CO.p2; if (!p2) return;
    const i = CO.in, Wd = W(), Gm = G(), Pl = P();
    p2.time += dt; CO.stats.time += dt;
    if (p2.downed === 'down') { p2.downT -= dt; if (p2.downT <= 0) getUp(); }
    else if (p2.downed === 'bleed') { p2.downT -= dt; if (p2.downT <= 0) { p2.downed = 'out'; UI().banner('PLAYER 2 BLED OUT', 'Back at the start of the next round', '#ff5040'); } }
    const out = p2.downed === 'out';
    // look
    const ads = i.lt > 0.3 && !p2.downed ? 1 : 0, rate = 3.2 * (1 - ads * 0.45);
    p2.yaw -= Math.sign(i.rx) * i.rx * i.rx * rate * dt; p2.pitch = U.clamp(p2.pitch - Math.sign(i.ry) * i.ry * i.ry * rate * 0.75 * dt, -1.5, 1.5);
    // move
    _f.set(-Math.sin(p2.yaw), 0, -Math.cos(p2.yaw)); _r.set(Math.cos(p2.yaw), 0, -Math.sin(p2.yaw));
    _w.set(0, 0, 0).addScaledVector(_f, -i.ly).addScaledVector(_r, i.lx); if (_w.lengthSq() > 1) _w.normalize();
    if (pressed(1)) p2.crouch = !p2.crouch;
    if (pressed(10)) p2.sprintLatch = true; if (i.ly > -0.3) p2.sprintLatch = false;
    p2.sprinting = p2.sprintLatch && !p2.crouch && !p2.downed && !ads;
    let speed = p2.downed ? (out ? 0 : 1.2) : p2.crouch ? 2.8 : p2.sprinting ? 8.2 : 5.2; speed *= ads ? 0.6 : 1;
    const ground = p2.pos.y <= Wd.groundAt(p2.pos.x, p2.pos.z, 0.22, p2.pos.y) + 0.001;
    p2.vel.x = U.damp(p2.vel.x, _w.x * speed, ground ? 11 : 1.8, dt); p2.vel.z = U.damp(p2.vel.z, _w.z * speed, ground ? 11 : 1.8, dt);
    if (pressed(0) && ground && !p2.downed) { p2.vel.y = 7.4; p2.crouch = false; A.play('step', { vol: 1.2 }); }
    p2.vel.y -= 22 * ((Gm.def && Gm.def.gravity) || 1) * dt;
    const prevY = p2.pos.y;
    p2.pos.x += p2.vel.x * dt; p2.pos.z += p2.vel.z * dt; p2.pos.y += p2.vel.y * dt;
    const fy = p2.pos.y; p2.pos.y = Math.max(prevY, fy); Wd.collide(p2.pos, 0.38, 0); p2.pos.y = fy;
    const floor = Wd.groundAt(p2.pos.x, p2.pos.z, 0.22, Math.max(prevY, fy));
    if (p2.pos.y <= floor) { p2.pos.y = floor; if (p2.vel.y < 0) p2.vel.y = 0; }
    // camera
    const eye = p2.downed ? 0.5 : p2.crouch ? 1.1 : 1.65; p2.eyeSm = U.damp(p2.eyeSm || eye, eye, 10, dt);
    CO.cam.position.set(p2.pos.x, p2.pos.y + p2.eyeSm, p2.pos.z); CO.cam.rotation.set(p2.pitch + p2.kick * 0.03, p2.yaw, p2.downed ? 0.3 : 0);
    p2.kick = Math.max(0, p2.kick - dt * 8);
    CO.cam.fov = U.lerp(P().settings.fov, P().settings.fov * 0.8, ads); CO.cam.updateProjectionMatrix();
    CO.flash.intensity = Wd.dark || (Gm.mods && Gm.mods.blackout) ? 2.2 : Wd.power ? 0 : 1.2;
    // bodies
    CO.body2.position.copy(p2.pos); CO.body2.rotation.set(p2.downed ? -1.3 : 0, p2.yaw + Math.PI, 0); CO.body2.visible = !out;
    CO.body1.position.copy(Pl.pos); CO.body1.rotation.set(Pl.downed ? -1.3 : 0, Pl.yaw + Math.PI, 0);
    // regen
    if (!p2.downed && p2.time - p2.lastHurt > 4) p2.hp = Math.min(p2.maxHp, p2.hp + 25 * dt);
    // weapons
    const slot = p2.inv[p2.cur], s = slot.s;
    p2.fireCd -= dt; p2.knifeCd -= dt;
    if (p2.reloadT > 0) { p2.reloadT -= dt; if (p2.reloadT <= 0) { const n = Math.min(s.mag - slot.ammo, slot.reserve); slot.ammo += n; slot.reserve -= n; A.play('magin', { pos: p2.pos, vol: 0.6 }); } }
    if (!p2.downed) {
      const trig = i.rt > 0.3;
      if (trig && p2.fireCd <= 0 && p2.reloadT <= 0 && (s.auto !== false || !p2.trigWas)) {
        if (slot.ammo > 0) shoot(slot, ads);
        else if (slot.reserve > 0) reload(); else if (!p2.trigWas) A.play('empty', { pos: p2.pos, vol: 0.5 });
      }
      p2.trigWas = trig;
      if (pressed(3) && p2.inv.length > 1) { p2.cur = (p2.cur + 1) % p2.inv.length; setGun(); A.play('magin', { vol: 0.4 }); }
      if (pressed(11)) knife();
      if (pressed(5)) grenade();
      if (pressed(2)) { if (p2.prompt && p2.prompt.act && !p2.prompt.hold) p2.prompt.act(); else if (!p2.prompt || !p2.prompt.hold) reload(); }
    }
    for (const b in CO.in.down) CO.in.down[b] = false;
    // prompts and revives
    p2.prompt = out ? null : prompt2();
    const hold = p2.prompt && p2.prompt.hold && i.held[2];
    if (hold) { p2.revT += dt; if (p2.revT >= REVIVE) { p2.revT = 0; p2.prompt.act(); } } else if (!(p2.prompt && p2.prompt.hold)) p2.revT = 0;
    // Player 1 reviving Player 2 (hold E)
    if (p2.downed === 'bleed' && !Pl.downed && Pl.pos.distanceTo(p2.pos) < 2 && Pl.keys.KeyE) { CO.revT1 = (CO.revT1 || 0) + dt; if (CO.revT1 >= REVIVE) { CO.revT1 = 0; getUp(true); CO.stats.revived = (CO.stats.revived || 0) + 1; } } else CO.revT1 = 0;
    updNades(dt);
    // viewmodel sway and recoil
    if (CO.vmGun) { const bob = Math.sin(p2.time * 9) * 0.006 * Math.hypot(p2.vel.x, p2.vel.z) / 5; CO.vmGun.position.set(ads ? 0 : 0.16, (ads ? -0.1 : -0.16) + bob + (p2.reloadT > 0 ? -0.12 : 0), -0.36 + p2.kick * 0.04); CO.vmGun.visible = !p2.downed; }
    // both players out of the fight: the game is over
    const P1out = Pl.downed === 'bleed' || Pl.downed === 'out', P2out = p2.downed === 'bleed' || p2.downed === 'out';
    if (P1out && P2out && (Pl.downed === 'out' || p2.downed === 'out')) Gm.over();
    else if (P1out && P2out && Pl.downed === 'bleed' && p2.downed === 'bleed') { /* both bleeding: whoever bleeds out first ends it */ }
    hudUpdate(dt);
  };
  function reload() { const p2 = CO.p2, slot = p2.inv[p2.cur]; if (p2.reloadT > 0 || slot.ammo >= slot.s.mag || slot.reserve <= 0) return; p2.reloadT = slot.s.reload || 1.8; A.play('magout', { pos: p2.pos, vol: 0.6 }); }
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();
  function shoot(slot, ads) {
    const p2 = CO.p2, s = slot.s, st = CO.stats;
    slot.ammo--; p2.fireCd = s.rate || 0.15; p2.kick = Math.min(1.5, p2.kick + 0.6); st.shots++;
    A.play(s.snd || 'rifle', { pos: p2.pos, vol: 0.8 });
    const pellets = s.pellets || 1, spread = (s.spread || 0.02) * (ads ? 0.35 : 1);
    _o.copy(CO.cam.position);
    let any = false;
    for (let k = 0; k < pellets; k++) {
      CO.cam.getWorldDirection(_d); _d.x += U.rand(-spread, spread); _d.y += U.rand(-spread, spread); _d.z += U.rand(-spread, spread); _d.normalize();
      const range = s.range || 120, wall = W().raycast(_o, _d, range), hits = E.rayHits(_o, _d, wall.t, s.pierce || 1);
      let endT = wall.t;
      hits.forEach((h, n) => {
        const point = _o.clone().addScaledVector(_d, h.t);
        E.damage(h.e, s.dmg * (n ? 0.8 : 1), { mult: h.mult, head: h.mult >= 2, point, dir: _d.clone(), kind: 'bullet', weapon: slot.id, p2: true });
        any = true; if (n === hits.length - 1 && hits.length >= (s.pierce || 1)) endT = h.t;
      });
      const end = _o.clone().addScaledVector(_d, endT);
      if (s.proj && s.proj.r) WP.explode(end, s.proj.r, s.dmg, s.proj.color || 0xff8a2a, false, true, false, null);
      if (Math.random() < 0.8) FX.tracer(_o.clone().add(new THREE.Vector3(0, -0.15, 0)), end, s.tracer || s.beam || 0xffe0a0, 0.05);
      if (!hits.length && wall.kind !== 'none') FX.sparks(end, wall.n);
    }
    if (any) st.hits++;
    FX.flash(_o.clone().addScaledVector(_d, 0.8), s.flash || 0xffc060, 1.5, 0.05, 5);
  }
  function knife() {
    const p2 = CO.p2; if (p2.knifeCd > 0) return; p2.knifeCd = 0.5; A.play('knife', { pos: p2.pos });
    const f = new THREE.Vector3(-Math.sin(p2.yaw), 0, -Math.cos(p2.yaw));
    for (const e of E.list) {
      if (e.dead || e.turned || e.state === 'burrowed') continue;
      const v = new THREE.Vector3(e.pos.x - p2.pos.x, 0, e.pos.z - p2.pos.z), d = v.length();
      if (d > e.radius + 1.6 || v.normalize().dot(f) < 0.5) continue;
      E.damage(e, 150 * E.hpMul(G().round), { kind: 'melee', point: e.center(), weapon: 'knife', p2: true }); A.play('knifeHit', { pos: e.pos }); break;
    }
  }
  // Player 2's grenades: a simple bouncing frag
  const nades = [];
  function grenade() {
    const p2 = CO.p2; if (p2.grenades <= 0) { A.play('deny', { vol: 0.5 }); return; } p2.grenades--;
    const d = CO.cam.getWorldDirection(new THREE.Vector3());
    const m = FX.glowSprite(0xffb040, 0.5, 1); W().root.parent.add(m);
    nades.push({ pos: CO.cam.position.clone().addScaledVector(d, 0.6), vel: d.multiplyScalar(19).add(new THREE.Vector3(0, 4, 0)), t: 0, m });
    A.play('throw', { pos: p2.pos });
  }
  function updNades(dt) {
    for (let k = nades.length - 1; k >= 0; k--) {
      const n = nades[k]; n.t += dt; n.vel.y -= 16 * dt;
      const step = n.vel.clone().multiplyScalar(dt), len = step.length(), h = W().raycast(n.pos, step.clone().normalize(), len);
      if (h.kind !== 'none' && h.t < len) { n.pos.addScaledVector(step.normalize(), h.t).addScaledVector(h.n, 0.05); const vn = n.vel.dot(h.n); n.vel.addScaledVector(h.n, -2 * vn).multiplyScalar(0.45); }
      else n.pos.add(step);
      n.m.position.copy(n.pos);
      if (n.t > 2) { n.m.parent && n.m.parent.remove(n.m); nades.splice(k, 1); WP.explode(n.pos.clone(), 5.5, 520 + G().round * 60, 0xff8a2a, false, true, true, 'frag'); }
    }
  }

  // ---------------- damage, downs and revives ----------------
  function hurt(amt, from) {
    const p2 = CO.p2; if (!p2 || p2.downed || G().state !== 'playing') return;
    amt *= (G().diffMul || 1) * ((G().mods && G().mods.dmg) || 1);
    p2.hp -= amt; p2.lastHurt = p2.time;
    const v = $('p2dmg'); if (v) { v.style.transition = 'none'; v.style.opacity = Math.min(0.8, 0.25 + amt / 60); requestAnimationFrame(() => { v.style.transition = 'opacity 0.8s'; v.style.opacity = 0; }); }
    A.play('hurt', { pos: p2.pos, vol: 0.6 });
    if (p2.hp <= 0) goDown();
  }
  function goDown() {
    const p2 = CO.p2; p2.hp = 0; CO.stats.downs++; CO.stats.streak = 0;
    if (p2.lives > 0) { p2.lives--; p2.downed = 'down'; p2.downT = 5; CO.stats.revives++; UI().banner('PLAYER 2 IS DOWN', 'Self-revive: back up in 5 s', '#ffa040'); }
    else { p2.downed = 'bleed'; p2.downT = BLEED; UI().banner('PLAYER 2 IS DOWN', 'Player 1: hold E next to them to revive', '#ff6040'); }
    A.play('heart', { vol: 0.8 });
  }
  function getUp(byTeammate) {
    const p2 = CO.p2; p2.downed = null; p2.hp = p2.maxHp; p2.revT = 0;
    UI().banner(byTeammate ? 'PLAYER 2 REVIVED' : 'PLAYER 2 IS BACK UP', '', '#60ff90'); A.play('revive');
    FX.ring(p2.pos.clone(), 6, 0xffa040, 0.5);
    for (const e of E.list) if (!e.dead && e.pos.distanceTo(p2.pos) < 6 && !e.def.boss) { e.stunT = Math.max(e.stunT, 2); const k = new THREE.Vector3(e.pos.x - p2.pos.x, 0, e.pos.z - p2.pos.z).normalize(); e.vel.addScaledVector(k, 8); }
  }
  CO.p2Alive = () => !!(CO.p2 && (CO.p2.downed == null || CO.p2.downed === 'down'));
  // what Player 1 downed in co-op turns into (instead of game over)
  CO.p1Down = () => { const Pl = P(); Pl.downed = 'bleed'; Pl.downT = BLEED; Pl.downLabel = 'BLEEDING OUT · Player 2 can revive you'; UI().banner('PLAYER 1 IS DOWN', 'Player 2: hold X next to them to revive', '#ff6040'); };
  CO.p1Tick = (dt) => {
    const Pl = P();
    if (Pl.downed === 'bleed') { Pl.downT -= dt; if (Pl.downT <= 0) { Pl.downed = 'out'; Pl.downLabel = 'OUT · back next round'; UI().banner('PLAYER 1 BLED OUT', 'Back at the start of the next round', '#ff5040'); } }
  };
  CO.onRoundStart = () => {
    const p2 = CO.p2; if (!p2) return;
    p2.grenades = Math.min(4, p2.grenades + 2);
    const Pl = P();
    if (p2.downed === 'out') { p2.pos.set(Pl.pos.x + 1, Pl.pos.y, Pl.pos.z); getUp(); }
    if (Pl.downed === 'out') { Pl.pos.set(p2.pos.x + 1, p2.pos.y, p2.pos.z); Pl.reviveNow && Pl.reviveNow(); }
  };
  CO.refill = () => { if (!CO.p2) return; for (const s of CO.p2.inv) { s.reserve = s.s.reserve; } CO.p2.grenades = 4; };
  const baseMax = WP.maxAmmo; WP.maxAmmo = () => { baseMax(); CO.refill(); };

  // Player 2's prompts: revive Player 1, doors, wall buys
  function prompt2() {
    const p2 = CO.p2, Pl = P(), Gm = G(), Wd = W(), q = p2.pos, out = [];
    if ((Pl.downed === 'bleed') && Pl.pos.distanceTo(q) < 2) out.push({ dist: 0, text: 'Hold X to revive Player 1', hold: true, act: () => { Pl.reviveNow && Pl.reviveNow(); CO.stats.revived = (CO.stats.revived || 0) + 1; } });
    if (p2.downed) return out[0] || null;
    for (const id in Wd.doors) {
      const d = Wd.doors[id]; if (d.open) continue;
      const x0 = Wd.cx2x(d.x0) - Wd.CELL / 2, x1 = Wd.cx2x(d.x1) + Wd.CELL / 2, z0 = Wd.cz2z(d.z0) - Wd.CELL / 2, z1 = Wd.cz2z(d.z1) + Wd.CELL / 2;
      const dist = Math.hypot(Math.max(x0 - q.x, 0, q.x - x1), Math.max(z0 - q.z, 0, q.z - z1));
      const dc = XH.modes && XH.modes.freeDoors() ? 0 : Gm.price(d.cost);
      if (dist < 1.6) out.push({ dist, text: `Open ${d.name}`, cost: dc, act: () => { if (Gm.spend(dc)) { Wd.openDoor(id); CO.stats.doors++; CO.stats.spent += dc; } } });
    }
    if (!(XH.modes && XH.modes.blocks('wallbuy'))) for (const b of Wd.buys) {
      const dist = Math.hypot(b.pos.x - q.x, b.pos.z - q.z); if (dist > 2) continue;
      const def = WP.DEFS[b.weapon]; if (!def) continue;
      const own = p2.inv.find((s) => s.id === b.weapon);
      const c = own ? Gm.price(Math.round(WP.wallCost(b.weapon) / 2)) : Gm.price(WP.wallCost(b.weapon));
      out.push({ dist, text: own ? `Refill ${def.name} ammo` : `Buy ${def.name}`, cost: c, act: () => {
        if (!Gm.spend(c)) return; CO.stats.spent += c;
        if (own) { own.ammo = own.s.mag; own.reserve = own.s.reserve; } else { const sl = WP.slot(b.weapon); if (p2.inv.length >= 2) p2.inv[p2.cur] = sl; else { p2.inv.push(sl); p2.cur = p2.inv.length - 1; } setGun(); }
        A.play('buy');
      } });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out[0] || null;
  }
  // Player 1's prompt to revive Player 2 (shown in Player 1's list)
  CO.candidates = (out) => {
    const p2 = CO.p2; if (!p2 || p2.downed !== 'bleed') return;
    const d = P().pos.distanceTo(p2.pos); if (d < 2) out.push({ tip: 'revive', dist: 0, text: 'Hold E to revive Player 2', hold: true });
  };

  // ---------------- creatures pick a target ----------------
  CO.targetFor = (e) => {
    const p2 = CO.p2, Pl = P();
    if (e.tgtT > e.t && e.tgt) return e.tgt === 2 ? p2 : null;
    const ok1 = !Pl.downed, ok2 = !p2.downed;
    const d1 = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z), d2 = Math.hypot(p2.pos.x - e.pos.x, p2.pos.z - e.pos.z);
    const pick2 = ok2 && (!ok1 || d2 < d1 * 0.9);
    e.tgt = pick2 ? 2 : 1; e.tgtT = e.t + 1.5;
    return pick2 ? p2 : null;
  };
  // hazards: projectiles hitting Player 2
  CO.hitP2 = (pos, r) => { const p2 = CO.p2; if (!p2 || p2.downed) return false; const dx = pos.x - p2.pos.x, dz = pos.z - p2.pos.z, dy = pos.y - (p2.pos.y + 1); return dx * dx + dz * dz < (r + 0.45) * (r + 0.45) && Math.abs(dy) < 1.1 + r; };

  // ---------------- scoreboard ----------------
  CO.boards = () => [{ name: 'Player 1', st: G().stats }, { name: 'Player 2', st: CO.stats }];

  // ---------------- Player 2 HUD ----------------
  function hud(on) {
    let el = $('p2hud');
    if (!on) { if (el) el.classList.add('hidden'); const dv = $('splitline'); if (dv) dv.classList.add('hidden'); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'p2hud';
      el.innerHTML = `<div id="p2dmg"></div><div class="p2x"></div><div id="p2prompt"></div><div id="p2down"></div>
        <div class="p2l"><b>PLAYER 2</b><div class="p2hp"><i id="p2hpbar"></i></div><div id="p2lives"></div></div>
        <div class="p2r"><div id="p2gun"></div><div id="p2ammo"></div><div id="p2nades"></div></div>`;
      document.body.appendChild(el);
      const dv = document.createElement('div'); dv.id = 'splitline'; document.body.appendChild(dv);
    }
    el.classList.remove('hidden'); $('splitline').classList.remove('hidden');
  }
  let hudT = 0;
  function hudUpdate(dt) {
    hudT -= dt; if (hudT > 0) return; hudT = 0.05;
    const p2 = CO.p2, slot = p2.inv[p2.cur];
    $('p2hpbar').style.width = Math.max(0, p2.hp / p2.maxHp * 100) + '%';
    $('p2lives').textContent = p2.lives > 0 ? '✚'.repeat(p2.lives) + ' self-revive' : '';
    $('p2gun').textContent = slot.s.name; $('p2ammo').innerHTML = `<b>${slot.ammo}</b> / ${slot.reserve}${p2.reloadT > 0 ? ' · reloading' : ''}`;
    $('p2nades').textContent = '● '.repeat(p2.grenades).trim();
    const pr = p2.prompt, pe = $('p2prompt');
    pe.innerHTML = pr ? `<span class="key">X</span>${pr.text}${pr.cost ? ` <em>${U.fmt(pr.cost)}</em>` : ''}${pr.hold && p2.revT > 0 ? ` · ${Math.round(p2.revT / REVIVE * 100)}%` : ''}` : '';
    const dn = $('p2down');
    dn.textContent = p2.downed === 'down' ? `GETTING BACK UP · ${Math.ceil(p2.downT)}` : p2.downed === 'bleed' ? `BLEEDING OUT · ${Math.ceil(p2.downT)} · Player 1 can revive you` : p2.downed === 'out' ? 'OUT · back next round' : '';
    dn.style.display = p2.downed ? 'block' : 'none';
  }
})();
