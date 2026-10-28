'use strict';
// Player controller: input, movement, camera, health, perks.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const P = XH.player = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, eyeH: 1.65, hp: 100, maxHp: 100,
    perks: new Set(), traits: new Set(), stamina: 4, crouch: false, sprinting: false, airborne: false, moveFrac: 0, landDip: 0, downed: null,
    kickP: 0, kickY: 0, lastHurt: -99, time: 0, bobPhase: 0, bobAmp: 0,
  };
  P.settings = Object.assign({ sens: 1, fov: 78, invert: false, bloom: true, announcer: true, hiveVoice: true, tips: true, master: 0.8, music: 0.55, sfx: 0.85, weather: 1, particles: 1, minimap: true, fps: false, shake: 1, rawInput: true, smooth: false, quality: 'medium', bob: 1, autoRes: true }, U.load('settings', {}));
  P.cam = new THREE.PerspectiveCamera(P.settings.fov, innerWidth / innerHeight, 0.05, 800);
  P.cam.rotation.order = 'YXZ';

  // ---------------- input ----------------
  const keys = {}; const input = { mdx: 0, mdy: 0 };
  const look = { x: 0, y: 0, px: 0, py: 0, lastX: 0, lastY: 0 };
  P.keys = keys; P.input = input;
  P.locked = () => document.pointerLockElement != null || XH.DEBUG || !!(XH.gamepad && XH.gamepad.active);
  P.padLook = (dx, dy) => { look.x += dx; look.y += dy; };
  P.bindInput = (canvas) => {
    addEventListener('keydown', (e) => {
      if (e.repeat) { keys[e.code] = true; return; }
      keys[e.code] = true;
      if (!XH.game.playing()) return;
      const W = XH.weapons;
      switch (e.code) {
        case 'KeyR': W.reload(); break;
        case 'KeyE': XH.game.interact(); break;
        case 'Digit1': W.switchTo(0); break;
        case 'Digit2': W.switchTo(1); break;
        case 'Digit3': W.switchTo(2); break;
        case 'KeyQ': W.cycle(); break;
        case 'KeyV': case 'KeyF': W.knife(); break;
        case 'KeyG': W.throwGrenade(); break;
        case 'KeyT': W.throwTactical(); break;
        case 'KeyL': P.flashUser = !P.flashOn; A.play('empty', { vol: 0.5 }); break;
        case 'KeyX': W.setShield(true); break;
        case 'Space': P.jumpQueued = true; break;
        case 'KeyC': case 'ControlLeft': P.crouchToggle = !P.crouchToggle; break;
      }
      if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyX') XH.weapons.setShield(false); });
    addEventListener('keydown', (e) => { if (XH.sys && XH.sys.intro && XH.game.state === 'playing') XH.sys.skipIntro(); });
    canvas.addEventListener('mousedown', () => { if (XH.sys && XH.sys.intro) XH.sys.skipIntro(); });
    canvas.addEventListener('mousedown', (e) => {
      if (!XH.game.playing() || !P.locked()) return;
      if (e.button === 0) XH.weapons.setTrigger(true);
      if (e.button === 2) XH.weapons.setAds(true);
      if (e.button === 1 || e.button === 3) XH.weapons.knife();
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) XH.weapons.setTrigger(false);
      if (e.button === 2) XH.weapons.setAds(false);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (XH.game.playing() && P.locked() && Math.abs(e.deltaY) > 10) XH.weapons.cycle(); });
    addEventListener('mousemove', (e) => {
      if (!document.pointerLockElement || !XH.game.playing()) return;
      const mx = e.movementX || 0, my = e.movementY || 0;
      // Chromium on Windows occasionally reports a huge one-off jump under pointer lock; drop it.
      if ((Math.abs(mx) > 220 && Math.abs(look.lastX) < 25) || (Math.abs(my) > 220 && Math.abs(look.lastY) < 25)) { look.lastX = look.lastY = 0; return; }
      look.lastX = mx; look.lastY = my;
      look.x += mx; look.y += my;
    });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; XH.weapons.setTrigger(false); XH.weapons.setAds(false); });
  };

  // ---------------- lifecycle ----------------
  P.reset = (start) => {
    P.pos.copy(start); P.pos.y = XH.world.floorAt ? XH.world.floorAt(start.x, start.z) : 0; P.vel.set(0, 0, 0);
    P.yaw = Math.PI; P.pitch = 0; P.hp = P.maxHp = P.baseHp(); P.perks.clear(); P.stamina = 4; P.crouch = false; P.crouchToggle = false;
    P.downed = null; P.mantle = null; P.path = null; P.mounted = null; P.lives = 0; P.flashUser = null; P.debuffs = {}; P.forgeShots = 0; P.kineticT = 0; P.wardT = undefined; P.lastHurt = -99; P.kickP = P.kickY = 0; P.eyeSm = 1.65; P.lazarusUsed = 0; P.bobPhase = 0; P.bobAmp = 0; look.x = look.y = look.px = look.py = 0;
    // face the most open direction
    let best = 0, bd = 0;
    for (let a = 0; a < 8; a++) {
      const ang = a / 8 * Math.PI * 2, dx = -Math.sin(ang), dz = -Math.cos(ang);
      let d = 0; while (d < 40 && !XH.world.blockedAt(P.pos.x + dx * d, P.pos.z + dz * d, 0)) d += 0.5;
      if (d > bd) { bd = d; best = ang; }
    }
    P.yaw = best;
  };
  P.baseHp = () => (XH.game.mods && XH.game.mods.glass ? 50 : 100) + (P.traits && P.traits.has('thickskin') ? 25 : 0);
  const fullHp = () => P.baseHp() * (P.perks.has('titan') ? 2.5 : 1) + (XH.uniques ? XH.uniques.hpBonus() : 0);
  P.addPerk = (id) => {
    P.perks.add(id);
    const m = fullHp(); if (m > P.maxHp) { P.maxHp = m; P.hp = m; }
    XH.ui.perksChanged();
  };
  P.removePerk = (id) => { P.perks.delete(id); P.maxHp = fullHp(); P.hp = Math.min(P.hp, P.maxHp); XH.ui.perksChanged(); };
  // status effects from creatures: chill (slow), poison (damage over time, no regen), spore (slow + haze), stun
  P.debuff = (kind, t, k = 0.5) => {
    if (P.downed || (XH.uniques && XH.uniques.immune(kind === 'spore' ? 'spore' : kind))) return;
    const d = P.debuffs || (P.debuffs = {});
    const cur = d[kind];
    d[kind] = { t: Math.max(t, cur ? cur.t : 0), k: cur ? Math.min(cur.k, k) : k };
  };
  P.slowMul = () => {
    const d = P.debuffs; if (!d) return 1;
    let m = 1;
    for (const kind of ['chill', 'spore']) if (d[kind] && d[kind].t > 0) m = Math.min(m, d[kind].k);
    if (d.stun && d.stun.t > 0) m = 0.05;
    return m;
  };
  P.kick = (p, y) => { P.kickP += p; P.kickY += y; };
  P.knock = (dir, f) => { P.vel.x += dir.x * f; P.vel.z += dir.z * f; if (!P.airborne) P.vel.y = Math.max(P.vel.y, 2.5); };

  // set each frame by js/hazards.js while you stand in a zone
  const NOZONE = { speed: 1, grip: 1, px: 0, pz: 0, grav: 1, swim: 0 };
  P.zone = null;
  P.hurt = (amt, from, explosive, silent) => {
    if (P.downed || XH.game.state !== 'playing' || P.god) return;
    amt *= (XH.game.diffMul || 1) * (XH.game.mods.dmg || 1);
    if (XH.uniques) { amt = XH.uniques.hurtMod(amt, from, explosive) * (1 - XH.uniques.fortress()); if (amt <= 0) return; }
    // Hive Shield: blocks hits from the front while raised, from behind while slung on your back
    if (P.shield && from) {
      const vx = from.x - P.pos.x, vz = from.z - P.pos.z, l = Math.hypot(vx, vz) || 1;
      const dot = (vx * -Math.sin(P.yaw) + vz * -Math.cos(P.yaw)) / l, up = XH.weapons.shieldUp();
      if ((up && dot > 0.2) || (!up && dot < -0.35)) {
        P.shield.hp -= amt; A.play('shieldHit', { vol: 0.8 }); FX.shake(0.1);
        if (P.shield.hp <= 0) XH.sys.shieldBroken();
        XH.ui.shieldChanged();
        return;
      }
    }
    P.hp -= amt; P.lastHurt = P.time;
    if (P.hp <= 0 && XH.game.buffs.undying > 0) P.hp = 1;
    if (P.hp <= 0 && P.traits.has('survivor') && !P.survivorUsed) { P.survivorUsed = true; P.hp = 1; XH.game.buffs.undying = Math.max(XH.game.buffs.undying, 2); XH.ui.banner('SECOND WIND', 'You cheated death once. Not again.', '#ffd860'); }
    if (!silent) {
      A.play('hurt', { vol: 0.35 }); A.play('pain', { vol: 0.9, heavy: amt >= 25 });
      FX.shake(Math.min(0.5, amt / 60));
      XH.ui.damage(from, amt);
    }
    if (P.hp <= 0) P.goDown();
  };
  P.goDown = () => {
    P.hp = 0; A.play('pain', { vol: 1, down: true });
    const st = XH.game.stats; if (st) { st.downs++; st.streak = 0; }
    if (XH.modes) XH.modes.onDown();
    const lazarus = P.perks.has('lazarus') && !XH.game.mods.oneLife;
    if (lazarus || P.lives > 0) {
      P.downed = 'down'; P.mantle = null;
      if (lazarus) { P.downT = 3; P.downLabel = 'LAZARUS PROTOCOL ENGAGED'; P.removePerk('lazarus'); P.lazarusUsed++; XH.ui.banner('LAZARUS PROTOCOL', 'Reviving… hold on.', '#60b0ff'); }
      else {
        P.lives--; P.downT = 5; P.downLabel = 'GETTING BACK UP'; if (XH.game.stats) XH.game.stats.revives++;
        XH.ui.banner('SELF-REVIVE', P.lives ? `Getting back up… ${P.lives} self-revive${P.lives > 1 ? 's' : ''} left` : 'Getting back up… that was your last one', '#60ff90');
        if (XH.ui.tip) XH.ui.tip('revive');
      }
      A.play('heart', { vol: 1 });
    } else XH.game.over();
    if (XH.sys) XH.sys.voice('down', true);
  };
  function revive() {
    P.downed = null; P.hp = P.maxHp;
    XH.ui.banner('REVIVED', '', '#60ff90');
    A.play('revive');
    FX.ring(P.pos, 8, 0x60b0ff, 0.6); FX.flash(P.pos.clone().setY(1), 0x60b0ff, 5, 0.5, 16);
    for (const e of XH.enemies.list) {
      if (e.dead) continue;
      const d = e.pos.distanceTo(P.pos);
      if (d < 8) { e.stunT = 2.5; const dir = e.pos.clone().sub(P.pos).setY(0).normalize(); e.vel.addScaledVector(dir, 10); }
    }
  }

  // ---------------- update ----------------
  // apply accumulated mouse motion once per frame (optionally averaged over two frames)
  function applyLook() {
    let mx = look.x, my = look.y; look.x = look.y = 0;
    if (P.settings.smooth) { const sx = (mx + look.px) / 2, sy = (my + look.py) / 2; look.px = mx; look.py = my; mx = sx; my = sy; }
    if (!mx && !my) return;
    const ads = XH.weapons.adsAmount(), zoom = U.lerp(1, (XH.weapons.cur() ? XH.weapons.cur().s.adsZoom : 1), ads);
    const k = 0.0022 * P.settings.sens * zoom;
    P.yaw -= mx * k; P.pitch -= my * k * (P.settings.invert ? -1 : 1);
    P.pitch = U.clamp(P.pitch, -1.5, 1.5);
    input.mdx += mx; input.mdy += my;
  }
  const SURF = { outpost: 'metal', ship: 'metal', hive: 'creep', ice: 'snow' };
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
  let hazTick = 0, heartT = 0;
  P.update = (dt) => {
    P.time += dt;
    applyLook();
    if (P.mounted && XH.logic) XH.logic.clampLook(P);
    const W = XH.world, wpn = XH.weapons.cur();
    if (P.downed === 'down') {
      P.downT -= dt;
      if (P.downT <= 0) revive();
    }
    // wishes
    _f.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); _r.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    _w.set(0, 0, 0);
    if (keys.KeyW || keys.ArrowUp) _w.add(_f);
    if (keys.KeyS || keys.ArrowDown) _w.sub(_f);
    if (keys.KeyD || keys.ArrowRight) _w.add(_r);
    if (keys.KeyA || keys.ArrowLeft) _w.sub(_r);
    const pad = XH.gamepad && XH.gamepad.active && !(XH.coop && XH.coop.on() && XH.gamepad.p1Index() < 0) ? P.pad : null;
    if (pad) _w.addScaledVector(_f, -pad.y).addScaledVector(_r, pad.x);
    if (P.mounted) { _w.set(0, 0, 0); P.jumpQueued = false; } // manning a gun (js/logic.js)
    const wantMove = _w.lengthSq() > 0.01;
    if (wantMove) _w.normalize();
    P.crouch = (P.crouchToggle || keys.ControlLeft) && !P.downed;
    const fwd = _w.dot(_f) > 0.5;
    const canSprint = (keys.ShiftLeft || (pad && pad.sprint)) && fwd && !P.crouch && !P.downed && XH.weapons.adsAmount() < 0.3 && (P.stamina > 0.1 || P.perks.has('afterburner'));
    if (canSprint && !P.sprinting && P.stamina > 0.8) P.sprinting = true;
    if (!canSprint) P.sprinting = false;
    const stMax = P.traits.has('marathon') ? 6 : 4;
    if (P.sprinting && !P.perks.has('afterburner')) { P.stamina -= dt; if (P.stamina <= 0) P.sprinting = false; }
    else P.stamina = Math.min(stMax, P.stamina + dt * (P.sprinting ? 0 : P.traits.has('marathon') ? 1.2 : 0.8));
    if (P.sprinting && XH.weapons.firing) P.sprinting = false;
    let speed = 5.2;
    if (P.sprinting) speed = P.perks.has('afterburner') ? 9.8 : 8.2;
    if (P.crouch) speed = 2.8;
    if (P.downed) speed = 1.2;
    speed *= U.lerp(1, 0.6, XH.weapons.adsAmount());
    if (wpn && wpn.s.move) speed *= wpn.s.move;
    if (P.sprinting && !P.crouch && !P.downed) speed = Math.max(speed, XH.enemies.topSpeed() * 1.15 * (P.perks.has('afterburner') ? 1.2 : 1)) * (P.traits.has('escapist') ? 1.1 : 1) * (XH.uniques ? XH.uniques.sprintMul() : 1);
    speed *= P.slowMul();
    const Zf = P.zone || NOZONE; speed *= Zf.speed;
    if (P.sprinting && XH.game.stats) XH.game.stats.sprint = (XH.game.stats.sprint || 0) + speed * dt;
    const ground = !P.mantle && !P.path && P.pos.y <= W.groundAt(P.pos.x, P.pos.z, 0.22, P.pos.y) + 0.001;
    const lam = (ground ? 11 : 1.8) * (ground ? Zf.grip : 1);
    P.vel.x = U.damp(P.vel.x, _w.x * speed + Zf.px, lam, dt);
    P.vel.z = U.damp(P.vel.z, _w.z * speed + Zf.pz, lam, dt);
    // climbing: jump facing a ledge, or push into one in mid-air, to pull yourself up onto it
    if (!P.mantle && !P.path && !P.downed) {
      let tgt = null;
      if (P.jumpQueued && ground) { const d = wantMove ? _w : _f; tgt = W.mantleTarget(P.pos.x, P.pos.z, d.x, d.z, P.pos.y, 0.38, 1.65); if (tgt && tgt.y - P.pos.y <= W.STEP) tgt = null; }
      else if (!ground && wantMove && P.vel.y < 3) tgt = W.mantleTarget(P.pos.x, P.pos.z, _w.x, _w.z, P.pos.y, 0.38, 1.5);
      if (tgt) startMantle(tgt);
    }
    P.platingCd = Math.max(0, (P.platingCd || 0) - dt);
    if (P.path) { P.jumpQueued = false; pathTick(dt); } else if (P.mantle) { P.jumpQueued = false; mantleTick(dt); } else {
    const jv = 7.4 * (XH.uniques ? XH.uniques.jumpMul() : 1);
    if (ground) P.airJumps = XH.uniques && XH.uniques.doubleJump() ? 1 : 0;
    if (P.jumpQueued && ground && !P.downed && P.slowMul() > 0.1) { P.vel.y = jv; P.crouchToggle = false; P.jumped = true; A.play('step', { vol: 2 }); }
    else if (P.jumpQueued && Zf.swim && !P.downed) { P.vel.y = Math.max(P.vel.y, 4.6); A.play('step', { vol: 0.7 }); } // a stroke up through deep water
    else if (P.jumpQueued && !ground && P.airJumps > 0 && !P.downed) { P.airJumps--; P.vel.y = jv * 0.9; FX.ring(P.pos.clone().setY(P.pos.y + 0.1), 1.4, 0xe0e8ff, 0.3); A.play('step', { vol: 1.4 }); }
    P.jumpQueued = false;
    P.vel.y -= 22 * ((XH.game.def && XH.game.def.gravity) || 1) * Zf.grav * dt;
    const prevY = P.pos.y, fallV = P.vel.y;
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; P.pos.y += P.vel.y * dt;
    // collide at the higher of the two heights, so a fast fall onto a crate lands on it instead of sliding off
    const fy = P.pos.y; P.pos.y = Math.max(prevY, fy);
    W.collide(P.pos, 0.38, 0);
    // don't walk through big creatures
    for (const e of XH.enemies.list) {
      if (e.dead || e.fly || e.state === 'burrowed' || Math.abs(e.pos.y - P.pos.y) > 1.2) continue;
      const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz), m = e.radius + 0.38;
      if (d < m && d > 0.01) { const k = e.def.heavy ? 1 : 0.35; P.pos.x += dx / d * (m - d) * k; P.pos.z += dz / d * (m - d) * k; }
    }
    W.collide(P.pos, 0.38, 0);
    P.pos.y = fy;
    const floor = W.groundAt(P.pos.x, P.pos.z, 0.22, Math.max(prevY, fy));
    if (P.pos.y <= floor && (P.vel.y <= 0 || P.pos.y < floor - W.STEP)) { // rising through a low top doesn't snap onto it
      if (floor > prevY + 0.02) P.stepUp = (P.stepUp || 0) + (floor - prevY); // ease the camera up the step
      P.pos.y = floor;
      if (prevY > floor + 0.001 && fallV < -4) {
        P.landDip = Math.min(1, -fallV / 12); A.play('land');
        // Shock Plating: jump landings detonate
        if (P.jumped && P.perks.has('plating') && P.platingCd <= 0) {
          P.platingCd = 1.2;
          const c = P.pos.clone().setY(0.6);
          XH.enemies.radiusDamage(c, 4.5, 700 * XH.enemies.hpMul(XH.game.round), { kind: 'explosive', weapon: 'plating' });
          FX.explosion(c, 3.5, 0x9050ff); A.play('explosion', { size: 0.6 });
        }
      }
      if (prevY > floor + 0.001) P.jumped = false;
      P.vel.y = 0;
    }
    }
    if (P.mounted) { P.pos.copy(P.mounted.seat); P.vel.set(0, 0, 0); }
    P.floorY = W.groundAt(P.pos.x, P.pos.z, 0.22, P.pos.y);
    P.onStruct = !P.airborne && W.groundProp && W.groundProp.struct && P.pos.y > 1 ? W.groundProp.struct : (P.path ? P.onStruct : P.pos.y > 1.5 ? P.onStruct : null);
    P.airborne = !!P.mantle || !!P.path || P.pos.y > P.floorY + 0.05;
    const hs = Math.hypot(P.vel.x, P.vel.z);
    P.moveFrac = U.clamp(hs / 5.2, 0, 1.6);
    // walk cycle: the phase advances with distance travelled; each half-turn is a footfall (at the bottom of the bob)
    if (!P.airborne) {
      const stride = P.sprinting ? 2.5 : P.crouch ? 1.5 : 2.0, prev = P.bobPhase;
      P.bobPhase += hs * dt * Math.PI / stride;
      if (hs > 0.6 && Math.floor(P.bobPhase / Math.PI) !== Math.floor(prev / Math.PI)) A.play('step', { vol: P.crouch ? 0.45 : P.sprinting ? 1.15 : 0.9, surf: SURF[W.def.theme] });
    }
    P.bobAmp = U.damp(P.bobAmp || 0, P.airborne ? 0 : Math.min(1, hs / 5.2), 8, dt);
    // hazards
    hazTick -= dt;
    const cx = W.cellX(P.pos.x), cz = W.cellZ(P.pos.z);
    const hz = W.inside(cx, cz) ? W.haz[cz * W.w + cx] : 0;
    if (hz && !P.airborne && hazTick <= 0) {
      hazTick = 0.25; P.hurt(hz === 1 ? 9 : 6, null, false, true); XH.ui.damage(null, 5);
      if (hz === 1) FX.embers(P.pos.clone().setY(0.2), 6); else A.play('acid', { vol: 0.5 });
    }
    // health regen
    const rg = XH.uniques && XH.uniques.regen(), db = P.debuffs || {};
    if (!P.downed && !XH.game.mods.noRegen && !(db.poison && db.poison.t > 0) && P.time - P.lastHurt > (rg ? rg.delay : P.traits.has('medic') ? 1.9 : 3.2) && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 55 * (rg ? rg.rate : 1) * dt);
    // status effects wear off; poison ticks
    for (const k in db) { const q = db[k]; if (q.t <= 0) continue; q.t -= dt; if (k === 'poison') { P.poisonAcc = (P.poisonAcc || 0) + dt; if (P.poisonAcc > 0.5) { P.poisonAcc = 0; P.hurt(q.k * 0.5, null, false, true); } } }
    heartT -= dt;
    if (P.hp / P.maxHp < 0.35 && heartT <= 0 && !P.downed) { heartT = 0.9; A.play('heart', { vol: 0.8 }); }
    // camera
    const eyeT = P.downed ? 0.55 : P.crouch ? 1.05 : 1.65;
    P.eyeSm = U.damp(P.eyeSm || 1.65, eyeT, 12, dt);
    P.eyeH = P.eyeSm;
    P.landDip = U.damp(P.landDip, 0, 8, dt);
    P.stepUp = U.damp(P.stepUp || 0, 0, 14, dt);
    P.kickP = U.damp(P.kickP, 0, 9, dt); P.kickY = U.damp(P.kickY, 0, 9, dt);
    const bob = -(1 + Math.cos(2 * P.bobPhase)) * 0.5 * 0.022 * P.bobAmp * (P.sprinting ? 1.5 : 1) * P.settings.bob;
    const sh = FX.shakeOffset, sm = P.settings.shake;
    P.cam.position.set(P.pos.x + sh.x * sm, P.pos.y + P.eyeSm + bob - P.landDip * 0.15 - P.stepUp + sh.y * sm, P.pos.z);
    P.cam.rotation.set(P.pitch + P.kickP + sh.y * 0.5 * sm, P.yaw + P.kickY, sh.r * sm + (P.downed ? 0.25 : 0));
    const ads = XH.weapons.adsAmount(), zoom = wpn ? U.lerp(1, wpn.s.adsZoom, ads) : 1;
    const fovT = P.settings.fov * zoom * (P.sprinting ? 1.07 : 1);
    if (Math.abs(P.cam.fov - fovT) > 0.01) { P.cam.fov = U.damp(P.cam.fov, fovT, 14, dt); P.cam.updateProjectionMatrix(); }
    A.listener.x = P.pos.x; A.listener.z = P.pos.z; A.listener.yaw = P.yaw;
    // flashlight: on by itself while the map is dark, L overrides until the lighting changes
    const Wd = XH.world, fl = Wd.flash;
    if (fl) {
      P.flashOn = P.flashUser !== null && P.flashUser !== undefined ? P.flashUser : (Wd.dark || Wd.timeMode === 'black');
      fl.intensity = U.damp(fl.intensity, P.flashOn && P.downed !== 'down' ? 1.9 : 0, 14, dt);
      const cp = Math.cos(P.pitch), fx = -Math.sin(P.yaw) * cp, fz = -Math.cos(P.yaw) * cp, fy = Math.sin(P.pitch);
      fl.position.set(P.cam.position.x + _r.x * 0.22, P.cam.position.y - 0.22, P.cam.position.z + _r.z * 0.22);
      fl.target.position.set(fl.position.x + fx * 10, fl.position.y + fy * 10, fl.position.z + fz * 10);
    }
  };
  // pull up onto a ledge: rise first, then move over the lip
  function startMantle(t) {
    P.mantle = { t: 0, dur: 0.26 + Math.max(0, t.y - P.pos.y) * 0.16, x0: P.pos.x, z0: P.pos.z, y0: P.pos.y, x1: t.x, z1: t.z, y1: t.y };
    P.vel.set(0, 0, 0); P.sprinting = false; P.jumped = false; P.crouchToggle = false;
    A.play('step', { vol: 1.3 });
  }
  function mantleTick(dt) {
    const m = P.mantle;
    if (P.downed) { P.mantle = null; return; }
    m.t += dt;
    const k = Math.min(1, m.t / m.dur), ky = 1 - Math.pow(1 - Math.min(1, k / 0.7), 2), kx = U.smooth(U.clamp((k - 0.3) / 0.7, 0, 1));
    P.pos.set(U.lerp(m.x0, m.x1, kx), U.lerp(m.y0, m.y1, ky), U.lerp(m.z0, m.z1, kx));
    P.vel.set(0, 0, 0);
    P.kickP = Math.min(P.kickP, -0.06 * Math.sin(k * Math.PI));
    if (k >= 1) { P.pos.set(m.x1, m.y1, m.z1); P.mantle = null; A.play('land', { vol: 0.4 }); }
  }
  // follow a list of points at a steady speed (ladders); no gravity or collision on the way
  P.startPath = (pts, speed) => {
    const segs = [];
    for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1].clone(), b: pts[i].clone(), d: pts[i].distanceTo(pts[i - 1]) });
    P.path = { segs, t: 0, speed, stepT: 0 }; P.vel.set(0, 0, 0); P.sprinting = false; P.mantle = null;
  };
  function pathTick(dt) {
    const pa = P.path;
    if (P.downed) { P.path = null; return; }
    pa.t += dt * pa.speed; pa.stepT -= dt;
    if (pa.stepT <= 0) { pa.stepT = 0.32; A.play('step', { vol: 0.7, surf: 'metal' }); }
    let rem = pa.t;
    for (const s of pa.segs) { if (rem <= s.d) { P.pos.lerpVectors(s.a, s.b, s.d > 0 ? rem / s.d : 1); P.vel.set(0, 0, 0); return; } rem -= s.d; }
    P.pos.copy(pa.segs[pa.segs.length - 1].b); P.path = null;
  }
  P.consumeInput = () => { const r = { mdx: input.mdx, mdy: input.mdy }; input.mdx = 0; input.mdy = 0; return r; };
})();
