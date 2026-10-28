'use strict';
// Buyable traps, on top of the flame/shock door traps in systems.js:
//  - Electro-Grid (1,000): a 3x3 floor grid in an open area. For 18 s it fries every ground creature on it.
//  - Shredder Fan (1,250): a knee-high rotor. For 20 s its blades cut down anything that walks into them.
//  - Turret Nest (1,500): a sandbagged console beside a door. Once the door is open, it sets up a sentry for 40 s.
// All of them hurt you too if you stand in them, and cool down for 40 s after use.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, E = XH.enemies;
  const TR = XH.traps = {};
  const G = () => XH.game, P = () => XH.player, W = () => XH.world, UI = () => XH.ui;
  const PRICE = { grid: 1000, fan: 1250, nest: 1500 }, ON = { grid: 18, fan: 20, nest: 40 }, COOL = 40;
  const NAME = { grid: 'Electro-Grid', fan: 'Shredder Fan', nest: 'Turret Nest' };
  TR.list = [];
  TR.PRICE = PRICE; TR.ON = ON; TR.COOL = COOL;

  const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.5 }, o));
  function mesh(parent, geo, mat, pos, scl, rot) { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (scl) m.scale.set(...scl); if (rot) m.rotation.set(...rot); parent.add(m); return m; }
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), sph = new THREE.SphereGeometry(1, 10, 8);
  function lever(root, x, z, color, text, noCol) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    mesh(g, cyl, std(0x303438), [0, 0.6, 0], [0.07, 1.2, 0.07]);
    mesh(g, box, std(0x2a2e33), [0, 1.3, 0], [0.5, 0.5, 0.2]);
    mesh(g, box, std(0xd8a020), [0, 1.58, 0], [0.52, 0.06, 0.21]);
    const lamp = mesh(g, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x30ff60 }), [0.16, 1.45, 0.11], [0.05, 0.05, 0.05]);
    const sign = XH.sys.label ? XH.sys.label(text, color, 1.2, 0.28) : null; if (sign) { sign.position.set(0, 1.95, 0); g.add(sign); }
    if (!noCol) W().addCyl(x, z, 0.25, 1.6, { mount: false });
    return { g, lamp };
  }

  // ---------------- placement ----------------
  TR.build = (c) => {
    TR.list = [];
    const Wd = W(), ST = XH.structures, root = Wd.root; if (!ST || !ST.freeRects) return;
    const s = Wd.start, dS = (r) => Math.hypot(Wd.cx2x(r.x + 1) - s.x, Wd.cz2z(r.z + 1) - s.z);
    const pickRect = (want) => { const l = ST.freeRects(4, 4).filter((r) => dS(r) > 12); l.sort((a, b) => Math.abs(dS(a) - want) - Math.abs(dS(b) - want)); return l[0]; };
    const Z = XH.zones, G = Z && Z.place('grid'), F = Z && Z.place('fan');
    const zPick = (spec) => (spec ? Z.inZone(ST.freeRects(4, 4), spec[0])[0] || Z.inZone(ST.freeRects(3, 3), spec[0])[0] || null : null);
    const mid = (r) => [Wd.cx2x(r.x) + (r.w - 1) * Wd.CELL / 2, Wd.cz2z(r.z) + (r.h - 1) * Wd.CELL / 2];
    // the lever goes on whichever side of the trap is open floor
    const leverSpot = (cx, cz, off) => { for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = cx + dx * off, z = cz + dz * off; if (!Wd.blockedAt(x, z, 1) && !Wd.solidAt(x, z, 0.3, 0.5)) return [x, z]; } return [cx + off, cz]; };
    // Electro-Grid (or its local equivalent: a magma vent, an acid geyser, temple flame jets)
    const pin = (k) => XH.edits && XH.edits.pin(k), pinG = pin('grid');
    const auto = Wd.auto !== false;
    let gFb = false, r = pinG ? (pinG.off ? null : { x: pinG.x, z: pinG.z, w: pinG.w || 4, h: pinG.h || 4 }) : G === null || !auto ? null : zPick(G);
    if (!r && G !== null && !pinG && auto) { r = pickRect(26); gFb = !!G; } // no room where it belongs: the generic version somewhere else
    const gSkin = (G && !gFb && G[2]) || 'tech', gName = (G && !gFb && G[1]) || 'Electro-Grid';
    if (r) {
      ST.claim(r, 1);
      const [cx, cz] = mid(r), half = Math.min(1.5, (r.w - 1) / 2) * Wd.CELL;
      const glowC = { tech: 0x40a0ff, magma: 0xff5a10, acid: 0x9dff3a, flame: 0xff9030 }[gSkin];
      const plateMat = std(gSkin === 'tech' ? 0x1a1d20 : gSkin === 'flame' ? 0x6a5a40 : 0x1a1410, { metalness: gSkin === 'tech' ? 0.8 : 0.1, roughness: gSkin === 'tech' ? 0.4 : 0.95, emissive: glowC, emissiveIntensity: 0.04 });
      mesh(root, box, plateMat, [cx, 0.025, cz], [half * 2 * 0.96, 0.05, half * 2 * 0.96]);
      if (gSkin === 'tech') for (let k = -2; k <= 2; k++) { mesh(root, box, std(0x40a0ff, { emissive: 0x2060a0, emissiveIntensity: 0.5 }), [cx + k * half * 0.4, 0.055, cz], [0.05, 0.01, half * 1.9]); mesh(root, box, std(0x40a0ff, { emissive: 0x2060a0, emissiveIntensity: 0.5 }), [cx, 0.055, cz + k * half * 0.4], [half * 1.9, 0.01, 0.05]); }
      else { // cracks glowing with what is underneath, or a grid of stone nozzles
        const vein = std(glowC, { emissive: glowC, emissiveIntensity: 0.6 });
        if (gSkin === 'flame') for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { mesh(root, cyl, std(0x3a3020, { roughness: 1 }), [cx + a * half * 0.6, 0.08, cz + b * half * 0.6], [0.22, 0.16, 0.22]); mesh(root, cyl, vein, [cx + a * half * 0.6, 0.17, cz + b * half * 0.6], [0.12, 0.02, 0.12]); }
        else for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28; mesh(root, box, vein, [cx + Math.cos(a) * half * 0.45, 0.055, cz + Math.sin(a) * half * 0.45], [half * 0.9, 0.012, 0.06], [0, a, 0]); }
      }
      const pl = pin('grid.lever'), [lx, lz] = pl ? [pl.x, pl.z] : leverSpot(cx, cz, half + 0.6);
      const lv = lever(root, lx, lz, '#' + glowC.toString(16).padStart(6, '0'), gName.toUpperCase());
      Wd.piece('grid', { label: gName, shape: 'rect', x: cx, z: cz, w: half * 2, d: half * 2, cells: { x: r.x, z: r.z, w: r.w, h: r.h }, off: true });
      Wd.piece('grid.lever', { label: gName + ' lever', shape: 'point', x: lx, z: lz, r: 0.4 });
      Wd.keepClear.push([cx, cz, half + 1]);
      TR.list.push({ kind: 'grid', name: gName, skin: gSkin, pos: new THREE.Vector3(lx, 0, lz), c: new THREE.Vector3(cx, Wd.floorAt(cx, cz), cz), half, plateMat, lamp: lv.lamp, state: 'ready', t: 0 });
    }
    // Shredder Fan (a crusher rotor, a pump impeller, a temple blade wheel...); not on maps where it would make no sense
    const pinF = pin('fan');
    let fFb = false; r = pinF ? (pinF.off ? null : { x: pinF.x, z: pinF.z, w: pinF.w || 4, h: pinF.h || 4 }) : F === null || !auto ? null : zPick(F);
    if (!r && F !== null && !pinF && auto) { r = pickRect(40); fFb = !!F; }
    const fSkin = (F && !fFb && F[2]) || 'tech', fName = (F && !fFb && F[1]) || 'Shredder Fan';
    if (r) {
      ST.claim(r, 1);
      const [cx, cz] = mid(r);
      const hub = new THREE.Group(); hub.position.set(cx, 0, cz); root.add(hub);
      const blade = fSkin === 'blade';
      mesh(hub, cyl, std(blade ? 0x6a5a40 : 0x3a3e44, { metalness: blade ? 0.1 : 0.8, roughness: blade ? 1 : 0.5 }), [0, 0.35, 0], [0.35, 0.7, 0.35]);
      mesh(hub, cyl, std(blade ? 0x5a4a34 : 0xd8a020, { roughness: blade ? 1 : 0.5 }), [0, 0.02, 0], [2.3, 0.04, 2.3]);
      const rotor = new THREE.Group(); rotor.position.y = 0.62; hub.add(rotor);
      for (let k = 0; k < 3; k++) { const b = mesh(rotor, box, std(blade ? 0xc8a040 : 0xb0b8c0, { metalness: 0.9, roughness: 0.25 }), [0, 0, 0], [0.22, 0.05, 2.0]); b.position.set(Math.sin(k * 2.094) * 1.0, 0, Math.cos(k * 2.094) * 1.0); b.rotation.y = k * 2.094; }
      Wd.addCyl(cx, cz, 0.38, 0.7, { mount: false });
      const pl = pin('fan.lever'), [lx, lz] = pl ? [pl.x, pl.z] : leverSpot(cx, cz, 3.2);
      const lv = lever(root, lx, lz, '#ffb040', fName.toUpperCase());
      Wd.piece('fan', { label: fName, shape: 'rect', x: cx, z: cz, w: 4.6, d: 4.6, cells: { x: r.x, z: r.z, w: r.w, h: r.h }, off: true });
      Wd.piece('fan.lever', { label: fName + ' lever', shape: 'point', x: lx, z: lz, r: 0.4 });
      Wd.keepClear.push([cx, cz, 3.2]);
      TR.list.push({ kind: 'fan', name: fName, pos: new THREE.Vector3(lx, 0, lz), c: new THREE.Vector3(cx, Wd.floorAt(cx, cz), cz), rotor, spin: 0, lamp: lv.lamp, state: 'ready', t: 0, hitT: new Map() });
    }
    // Turret Nests beside up to three doors (only where someone could have built them)
    let n = 0;
    for (const id in Wd.doors) {
      const pinN = pin('nest.' + id);
      if (pinN && pinN.off) continue;
      if (!pinN && (!auto || n >= 3 || (Z && Z.place('nests') === false))) continue;
      const d = Wd.doors[id]; let spot = pinN ? { x: pinN.x, z: pinN.z, dx: pinN.dx || 0, dz: pinN.dx ? 0 : pinN.dz || 1 } : null;
      if (!spot) for (const ci of d.cells) {
        const x = ci % Wd.w, z = (ci / Wd.w) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + 2 * dx, nz = z + 2 * dz, ni = nz * Wd.w + nx;
          if (!Wd.inside(nx, nz) || !Wd.reach[ni] || Wd.solid[ni] || d.cells.includes(ni) || Wd.propAt(Wd.cx2x(nx), Wd.cz2z(nz), 1)) continue;
          if (Wd.sysM && Wd.sysM.traps.some((T) => Math.hypot(T.pos.x - Wd.cx2x(nx), T.pos.z - Wd.cz2z(nz)) < 2.5)) continue;
          spot = { x: Wd.cx2x(nx), z: Wd.cz2z(nz), dx, dz }; break;
        }
        if (spot) break;
      }
      if (!spot) continue;
      n++;
      const g = new THREE.Group(); g.position.set(spot.x, 0, spot.z); root.add(g);
      const sand = std(0x7a6a4a, { roughness: 1, metalness: 0 });
      for (let k = 0; k < 7; k++) { const a = -1.2 + k * 0.4 + Math.atan2(-spot.dx, -spot.dz); mesh(g, sph, sand, [Math.sin(a) * 0.95, 0.18, Math.cos(a) * 0.95], [0.34, 0.18, 0.2], [0, a + Math.PI / 2, 0]); }
      const pl = pin('nest.' + id + '.lever'), nlx = pl ? pl.x : spot.x + spot.dz * 1.4, nlz = pl ? pl.z : spot.z - spot.dx * 1.4;
      const lv = lever(root, nlx, nlz, '#40ff90', 'TURRET NEST');
      Wd.keepClear.push([spot.x, spot.z, 1.8]);
      Wd.piece('nest.' + id, { label: 'Turret nest (door ' + id + ')', shape: 'point', x: spot.x, z: spot.z, r: 1.1, dx: spot.dx, dz: spot.dz, turn: true, off: true });
      Wd.piece('nest.' + id + '.lever', { label: 'Turret nest lever (door ' + id + ')', shape: 'point', x: nlx, z: nlz, r: 0.4 });
      TR.list.push({ kind: 'nest', door: d, pos: new THREE.Vector3(nlx, 0, nlz), c: new THREE.Vector3(spot.x, 0, spot.z), yaw: Math.atan2(-spot.dx, -spot.dz), lamp: lv.lamp, state: 'ready', t: 0 });
    }
  };

  // ---------------- prompts ----------------
  TR.candidates = (out) => {
    const Pl = P().pos, Gm = G(); if (Gm.state !== 'playing') return;
    for (const T of TR.list) {
      const d = Math.hypot(T.pos.x - Pl.x, T.pos.z - Pl.z); if (d > 1.7) continue;
      const price = Gm.price((T.cost !== undefined ? T.cost : PRICE[T.kind]) * (XH.classes ? XH.classes.mul('tinkerer', 0.75) : 1));
      if (T.kind === 'nest' && T.door && !T.door.open) out.push({ tip: 'trap', dist: d, text: 'Turret Nest: open the door first', cost: null });
      else if (T.state === 'ready') out.push({ tip: 'trap', dist: d, text: `Activate ${T.name || NAME[T.kind]} (${T.on || ON[T.kind]} s)`, cost: price, act: () => { if (Gm.spend(price)) activate(T); } });
      else out.push({ tip: 'trap', dist: d, text: T.state === 'active' ? `${T.name || NAME[T.kind]} active (${Math.ceil(T.t)} s)` : `${T.name || NAME[T.kind]} cooling down (${Math.ceil(T.t)} s)`, cost: null });
    }
  };
  function activate(T) {
    T.state = 'active'; T.t = T.on || ON[T.kind]; T.lamp.material.color.setHex(0xff3020); T.cyc = 0;
    A.play({ fan: 'saw', grid: T.skin && T.skin !== 'tech' ? 'launcher' : 'arc', flame: 'launcher', tesla: 'arc', laser: 'rail', freeze: 'cryo', acid: 'acid', crusher: 'slam', spikes: 'spike' }[T.kind] || 'build', { pos: T.c });
    if (T.kind === 'nest' && XH.loadout) T.turret = XH.loadout.place(T.c.x, T.c.y, T.c.z, T.yaw, T.on || ON.nest, 'trap');
  }

  // a trigger (js/logic.js) runs a trap for free, or stops it
  TR.activateFree = (T) => { if (T.state !== 'active') { activate(T); } };
  TR.stop = (T) => { if (T.state === 'active') T.t = 0.001; };
  // ---------------- per frame ----------------
  let tick = 0;
  TR.update = (dt) => {
    tick -= dt; const hurtTick = tick <= 0; if (hurtTick) tick = 0.3;
    const Pl = P();
    for (const T of TR.list) {
      if (T.kind === 'fan') { T.spin = U.damp(T.spin, T.state === 'active' ? 24 : 0, 2, dt); T.rotor.rotation.y += T.spin * dt; }
      if (T.state === 'active') {
        T.t -= dt;
        if (T.kind === 'grid') {
          T.plateMat.emissiveIntensity = 0.4 + Math.random() * 0.5;
          for (let k = 0; k < 2; k++) {
            const x = T.c.x + U.rand(-(T.hx || T.half), T.hx || T.half), z = T.c.z + U.rand(-(T.hz || T.half), T.hz || T.half);
            if (!T.skin || T.skin === 'tech') FX.bolt(new THREE.Vector3(x, 0.05, z), new THREE.Vector3(x + U.rand(-1.2, 1.2), U.rand(0.8, 2), z + U.rand(-1.2, 1.2)), 0x9fd8ff, 0.07, 6, 0.3);
            else if (T.skin === 'acid') FX.burst({ pos: new THREE.Vector3(x, 0.2, z), n: 4, color: 0x9dff3a, speed: [1, 3], up: 3, life: [0.3, 0.6], size: [0.25, 0.05] });
            else FX.fire(new THREE.Vector3(x, 0.1, z), new THREE.Vector3(U.rand(-0.1, 0.1), 1, U.rand(-0.1, 0.1)), 1);
          }
          for (const e of E.list.slice()) {
            if (e.dead || e.fly || e.turned || e.state === 'burrowed' || Math.abs(e.pos.x - T.c.x) > (T.hx || T.half) || Math.abs(e.pos.z - T.c.z) > (T.hz || T.half)) continue;
            E.damage(e, e.def.boss ? 600 * dt : e.def.heavy ? e.maxHp * 0.15 * dt : e.hp + 1, { kind: T.skin && T.skin !== 'tech' ? (T.skin === 'acid' ? 'acid' : 'fire') : 'arc', quiet: true, point: e.center(), weapon: 'trap', stun: 0.3 });
          }
          if (hurtTick && Math.abs(Pl.pos.x - T.c.x) < (T.hx || T.half) && Math.abs(Pl.pos.z - T.c.z) < (T.hz || T.half) && Pl.pos.y - T.c.y < 0.5) Pl.hurt(12, T.c, false, false);
        } else if (T.kind === 'fan' && T.spin > 8) {
          for (const e of E.list.slice()) {
            if (e.dead || e.fly || e.turned || e.state === 'burrowed') continue;
            const d = Math.hypot(e.pos.x - T.c.x, e.pos.z - T.c.z); if (d > (T.fr || 2.1) + e.radius * 0.5) continue;
            if ((T.hitT.get(e) || -9) > G().stats.time - 0.4) continue; T.hitT.set(e, G().stats.time);
            const dmg = e.def.boss ? 400 : e.def.heavy ? e.maxHp * 0.25 : e.hp + 1;
            E.damage(e, dmg, { kind: 'bullet', point: e.center(), weapon: 'trap' });
            FX.ichor(e.center(), new THREE.Vector3(0, 1, 0), e.def.ichor, 1.5); A.play('saw', { pos: e.pos, vol: 0.6 });
            if (!e.dead && !e.def.boss) { const k = new THREE.Vector3(e.pos.x - T.c.x, 0, e.pos.z - T.c.z).normalize(); e.vel.addScaledVector(k, 8); }
          }
          const dp = Math.hypot(Pl.pos.x - T.c.x, Pl.pos.z - T.c.z);
          if (dp < (T.fr || 2.1) + 0.2 && Pl.pos.y - T.c.y < 0.9 && hurtTick) { Pl.hurt(25, T.c, false, false); if (Pl.knock) Pl.knock(new THREE.Vector3(Pl.pos.x - T.c.x, 0, Pl.pos.z - T.c.z), 7); }
        } else if (T.placed) runPlaced(T, dt, hurtTick);
        if (T.t <= 0) { T.state = 'cooldown'; T.t = T.cool || COOL; if (T.plateMat) T.plateMat.emissiveIntensity = 0.04; if (T.beams) T.beams.visible = false; if (T.press) T.press.position.y = T.top; if (T.spk) T.spk.position.y = -0.95; if (T.orb) T.orb.material.emissiveIntensity = 0.4; }
      } else if (T.state === 'cooldown') { T.t -= dt; if (T.t <= 0) { T.state = 'ready'; T.lamp.material.color.setHex(0x30ff60); } }
    }
  };
  // ---------------- traps placed by hand in the map editor ('@trap' entities) ----------------
  // { k: '@trap', tt: kind, x, z, w, d, lx, lz: where its lever stands, o: { cost, time, cool, name } }
  TR.KINDS = {
    grid: { label: 'Electro-Grid', w: 7.5, d: 7.5, color: 0x40a0ff, note: 'Fries every ground creature on the plate.' },
    fan: { label: 'Shredder Fan', w: 4.6, d: 4.6, color: 0xffb040, note: 'A spinning rotor that cuts down anything that walks into it.' },
    nest: { label: 'Turret Nest', w: 2.4, d: 2.4, color: 0x40ff90, note: 'Sets up a sentry gun for the time it runs.' },
    flame: { label: 'Flame Jets', w: 5, d: 5, color: 0xff7020, note: 'Nozzles in the floor that burn everything above them.' },
    crusher: { label: 'Crusher', w: 3.75, d: 3.75, color: 0xd8a020, note: 'A press that slams down over and over.' },
    laser: { label: 'Laser Fence', w: 7.5, d: 1, color: 0xff2040, note: 'Beams across a corridor that cut creatures in half. Lay it along the long side.' },
    spikes: { label: 'Spike Floor', w: 5, d: 5, color: 0xc8c8c8, note: 'Spikes stab up out of the floor every second.' },
    freeze: { label: 'Cryo Vents', w: 5, d: 5, color: 0x80e0ff, note: 'Freezes creatures solid (they take extra damage while frozen).' },
    tesla: { label: 'Tesla Coil', w: 1.5, d: 1.5, r: 9, color: 0x9fd8ff, note: 'A tower that zaps the nearest creatures within 9 m.' },
    acid: { label: 'Acid Sprinklers', w: 5, d: 5, color: 0x9dff3a, note: 'Acid rain from above: eats creatures and slows them.' },
  };
  Object.assign(PRICE, { flame: 1000, crusher: 1250, laser: 1500, spikes: 750, freeze: 1000, tesla: 1750, acid: 1000 });
  Object.assign(ON, { flame: 15, crusher: 20, laser: 15, spikes: 20, freeze: 15, tesla: 20, acid: 18 });
  Object.assign(NAME, { flame: 'Flame Jets', crusher: 'Crusher', laser: 'Laser Fence', spikes: 'Spike Floor', freeze: 'Cryo Vents', tesla: 'Tesla Coil', acid: 'Acid Sprinklers' });
  TR.spawnTrap = (e, a, o) => {
    const K = TR.KINDS[e.tt]; if (!K) return;
    const SD = XH.setdress, ed = SD.editor, Wd = W(), root = SD.root();
    const w = Math.max(0.5, e.w || K.w), d = Math.max(0.5, e.d || K.d), x = e.x, z = e.z;
    const lx = e.lx !== undefined ? e.lx : x + w / 2 + 0.9, lz = e.lz !== undefined ? e.lz : z;
    const name = (o && o.name) || K.label, hex = '#' + K.color.toString(16).padStart(6, '0');
    const g = new THREE.Group(); g.position.set(x, Wd.dispAt(x, z), z); g.userData.lifted = true; root.add(g);
    const T = { kind: e.tt, name, placed: true, pos: new THREE.Vector3(lx, 0, lz), c: new THREE.Vector3(x, Wd.floorAt(x, z), z), hx: w / 2, hz: d / 2, half: Math.min(w, d) / 2, state: 'ready', t: 0, g };
    if (o && o.cost !== undefined && o.cost !== '') T.cost = +o.cost;
    if (o && o.time) T.on = +o.time;
    if (o && o.cool) T.cool = +o.cool;
    const glowM = (c, k = 0.6) => std(c, { emissive: c, emissiveIntensity: k });
    switch (e.tt) {
      case 'grid': {
        T.plateMat = std(0x1a1d20, { metalness: 0.8, roughness: 0.4, emissive: 0x40a0ff, emissiveIntensity: 0.04 });
        mesh(g, box, T.plateMat, [0, 0.025, 0], [w * 0.96, 0.05, d * 0.96]);
        const vein = glowM(0x40a0ff, 0.5);
        for (let k = -2; k <= 2; k++) { mesh(g, box, vein, [k * w * 0.2, 0.055, 0], [0.05, 0.01, d * 0.95]); mesh(g, box, vein, [0, 0.055, k * d * 0.2], [w * 0.95, 0.01, 0.05]); }
        break;
      }
      case 'fan': {
        const r = Math.min(w, d) / 2;
        mesh(g, cyl, std(0x3a3e44, { metalness: 0.8 }), [0, 0.35, 0], [0.35, 0.7, 0.35]);
        mesh(g, cyl, std(0xd8a020), [0, 0.02, 0], [r, 0.04, r]);
        T.rotor = new THREE.Group(); T.rotor.position.y = 0.62; g.add(T.rotor); T.spin = 0; T.hitT = new Map(); T.fr = r * 0.9;
        for (let k = 0; k < 3; k++) { const b = mesh(T.rotor, box, std(0xb0b8c0, { metalness: 0.9, roughness: 0.25 }), [0, 0, 0], [0.22, 0.05, r * 0.9]); b.position.set(Math.sin(k * 2.094) * r * 0.45, 0, Math.cos(k * 2.094) * r * 0.45); b.rotation.y = k * 2.094; }
        if (!ed) Wd.addCyl(x, z, 0.38, 0.7, { mount: false });
        break;
      }
      case 'nest': {
        const sand = std(0x7a6a4a, { roughness: 1, metalness: 0 }); T.yaw = e.ry || 0;
        for (let k = 0; k < 7; k++) { const an = -1.2 + k * 0.4 + T.yaw; mesh(g, sph, sand, [Math.sin(an) * 0.95, 0.18, Math.cos(an) * 0.95], [0.34, 0.18, 0.2], [0, an + Math.PI / 2, 0]); }
        mesh(g, box, std(0x2a2e33), [0, 0.3, 0], [0.5, 0.6, 0.5]);
        break;
      }
      case 'flame': {
        T.spots = [];
        const nx = Math.max(1, Math.round(w / 1.25)), nz = Math.max(1, Math.round(d / 1.25));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const px = -w / 2 + (i + 0.5) * w / nx, pz = -d / 2 + (j + 0.5) * d / nz; mesh(g, cyl, std(0x2a2624), [px, 0.08, pz], [0.2, 0.16, 0.2]); mesh(g, cyl, glowM(0xff6020, 0.3), [px, 0.17, pz], [0.1, 0.02, 0.1]); T.spots.push([x + px, z + pz]); }
        mesh(g, box, std(0x3a3430, { roughness: 1, metalness: 0.1 }), [0, 0.01, 0], [w, 0.02, d]);
        break;
      }
      case 'crusher': {
        const hh = 3.6, y = std(0xd8a020);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(g, box, y, [sx * (w / 2 + 0.15), hh / 2 + 0.3, sz * (d / 2 + 0.15)], [0.3, hh + 0.6, 0.3]);
        mesh(g, box, std(0x3a3e44, { metalness: 0.7 }), [0, hh + 0.75, 0], [w + 0.7, 0.5, d + 0.7]);
        mesh(g, box, std(0x151515), [0, 0.02, 0], [w, 0.04, d]);
        T.press = mesh(g, box, std(0x5a6068, { metalness: 0.8, roughness: 0.35 }), [0, hh, 0], [w * 0.96, 0.8, d * 0.96]); T.top = hh; T.py = hh;
        if (!ed) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Wd.addProp(x + sx * (w / 2 + 0.15), z + sz * (d / 2 + 0.15), 0.15, 0.15, hh + 0.9, { mount: false });
        break;
      }
      case 'laser': {
        const along = w >= d, len = along ? w : d; T.along = along;
        for (const s of [-1, 1]) { const p = along ? [s * len / 2, 0, 0] : [0, 0, s * len / 2]; mesh(g, box, std(0x2a2e33), [p[0], 1.25, p[2]], [0.3, 2.5, 0.3]); for (let k = 0; k < 4; k++) mesh(g, box, glowM(0xff2040, 0.2), [p[0], 0.4 + k * 0.55, p[2]], [0.34, 0.06, 0.34]); if (!ed) Wd.addProp(x + p[0], z + p[2], 0.15, 0.15, 2.5, { mount: false }); }
        T.beams = new THREE.Group(); g.add(T.beams); T.beams.visible = false;
        const bm = new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
        for (let k = 0; k < 4; k++) mesh(T.beams, box, bm, [0, 0.4 + k * 0.55, 0], along ? [len, 0.05, 0.05] : [0.05, 0.05, len]);
        if (ed) T.beams.visible = true;
        T.hx = along ? len / 2 : 0.5; T.hz = along ? 0.5 : len / 2;
        break;
      }
      case 'spikes': {
        mesh(g, box, std(0x2a2c30), [0, 0.01, 0], [w, 0.02, d]);
        T.spk = new THREE.Group(); g.add(T.spk); const sm = std(0xb8bcc0, { metalness: 0.9, roughness: 0.3 }), cone = new THREE.ConeGeometry(0.09, 0.9, 5);
        for (let i = 0.35; i < w; i += 0.7) for (let j = 0.35; j < d; j += 0.7) { mesh(T.spk, cone, sm, [i - w / 2, 0.45, j - d / 2]); mesh(g, cyl, std(0x101010), [i - w / 2, 0.025, j - d / 2], [0.12, 0.02, 0.12]); }
        T.spk.position.y = ed ? 0 : -0.95; T.hitE = new Set();
        break;
      }
      case 'freeze': {
        mesh(g, box, std(0x2a3038, { metalness: 0.6 }), [0, 0.02, 0], [w, 0.04, d]);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { mesh(g, box, std(0x1a2028), [(i - 1) * w / 3, 0.05, (j - 1) * d / 3], [0.7, 0.03, 0.7]); for (let k = -2; k <= 2; k++) mesh(g, box, glowM(0x80e0ff, 0.3), [(i - 1) * w / 3 + k * 0.12, 0.07, (j - 1) * d / 3], [0.04, 0.01, 0.6]); }
        break;
      }
      case 'tesla': {
        const cm = std(0x8a6040, { metalness: 0.9, roughness: 0.3 });
        mesh(g, cyl, std(0x2a2e33, { metalness: 0.7 }), [0, 0.3, 0], [0.7, 0.6, 0.7]);
        mesh(g, cyl, std(0x3a3e44, { metalness: 0.7 }), [0, 1.6, 0], [0.18, 2.2, 0.18]);
        for (let k = 0; k < 12; k++) mesh(g, cyl, cm, [0, 0.8 + k * 0.14, 0], [0.26, 0.08, 0.26]);
        mesh(g, new THREE.TorusGeometry(0.6, 0.18, 10, 24), std(0xb8bcc0, { metalness: 0.9, roughness: 0.2 }), [0, 2.95, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
        T.orb = mesh(g, sph, glowM(0x9fd8ff, 0.4), [0, 2.95, 0], [0.25, 0.25, 0.25]); T.r = (o && o.r) || K.r; T.zapT = 0;
        if (!ed) Wd.addCyl(x, z, 0.7, 3.2, { mount: false });
        break;
      }
      case 'acid': {
        mesh(g, box, std(0x2a3020, { roughness: 0.9 }), [0, 0.01, 0], [w, 0.02, d]);
        const pipe = std(0x6a6e3a, { metalness: 0.7 });
        for (const sx of [-1, 1]) mesh(g, cyl, pipe, [sx * (w / 2 - 0.1), 1.7, -d / 2 + 0.1], [0.07, 3.4, 0.07]);
        mesh(g, cyl, pipe, [0, 3.3, -d / 2 + 0.1], [0.07, w, 0.07], [0, 0, Math.PI / 2]);
        T.heads = [];
        for (let k = 0; k < Math.max(2, Math.round(w / 1.6)); k++) { const px = -w / 2 + (k + 0.5) * w / Math.max(2, Math.round(w / 1.6)); mesh(g, cyl, pipe, [px, 3.3, 0], [0.05, d - 0.2, 0.05], [Math.PI / 2, 0, 0]); for (let j = 0; j < Math.max(1, Math.round(d / 1.6)); j++) { const pz = -d / 2 + (j + 0.5) * d / Math.max(1, Math.round(d / 1.6)); mesh(g, cyl, glowM(0x9dff3a, 0.3), [px, 3.2, pz], [0.1, 0.1, 0.1]); T.heads.push([x + px, z + pz]); } }
        break;
      }
    }
    // its lever
    const lv = lever(root, lx, lz, hex, name.toUpperCase(), ed);
    if (ed) { lv.g.position.y = Wd.dispAt(lx, lz); lv.g.userData.lifted = true; lv.g.userData.lever = true; return; }
    T.lamp = lv.lamp; Wd.keepClear.push([x, z, Math.max(w, d) / 2 + 0.6]);
    TR.list.push(T);
    T.tag = e.tag; if (e.tag && XH.logic) XH.logic.tagTrap(e.tag, T);
  };
  const inRect = (T, p, pad = 0) => Math.abs(p.x - T.c.x) < T.hx + pad && Math.abs(p.z - T.c.z) < T.hz + pad;
  const ground = (e) => !(e.dead || e.def.fly || e.turned || e.state === 'burrowed');
  // the new kinds, every frame while they run
  function runPlaced(T, dt, hurtTick) {
    const Pl = P(), pIn = inRect(T, Pl.pos) && Pl.pos.y - T.c.y < 1.2;
    switch (T.kind) {
      case 'flame': {
        for (const [sx, sz] of T.spots) if (Math.random() < 0.7) FX.fire(new THREE.Vector3(sx, T.c.y + 0.2, sz), new THREE.Vector3(U.rand(-0.1, 0.1), 1, U.rand(-0.1, 0.1)), 1.3);
        for (const e of E.list.slice()) if (ground(e) && inRect(T, e.pos)) E.damage(e, e.def.boss ? 300 * dt : e.def.heavy ? e.maxHp * 0.12 * dt : e.maxHp * 0.9 * dt, { kind: 'fire', quiet: true, point: e.center(), weapon: 'trap' });
        if (hurtTick && pIn) Pl.hurt(14, T.c, false, false);
        break;
      }
      case 'crusher': {
        T.cyc = (T.cyc || 0) + dt; const ev = 1.3, ph = T.cyc % ev, drop = ph > ev - 0.3;
        T.py = drop ? T.top - (ph - (ev - 0.3)) / 0.3 * (T.top - 0.45) : 0.45 + Math.min(1, ph / (ev - 0.5)) * (T.top - 0.45);
        T.press.position.y = T.py;
        if (drop && ph > ev - 0.06 && !T.slammed) {
          T.slammed = true; A.play('slam', { pos: T.c }); FX.shake(0.2); FX.dirt(T.c.clone().setY(T.c.y + 0.1), 14);
          for (const e of E.list.slice()) if (ground(e) && inRect(T, e.pos)) E.damage(e, e.def.boss ? 500 : e.def.heavy ? e.maxHp * 0.4 : e.hp + 1, { kind: 'bullet', point: e.center(), weapon: 'trap' });
          if (pIn) Pl.hurt(60, T.c, false, false);
        }
        if (!drop) T.slammed = false;
        break;
      }
      case 'laser': {
        T.beams.visible = true;
        for (const e of E.list.slice()) if (ground(e) && inRect(T, e.pos, e.radius * 0.5)) { E.damage(e, e.def.boss ? 400 * dt : e.def.heavy ? e.maxHp * 0.5 * dt : e.hp + 1, { kind: 'arc', quiet: true, point: e.center(), weapon: 'trap' }); if (Math.random() < 0.3) FX.sparks(e.center(), new THREE.Vector3(0, 1, 0)); }
        if (hurtTick && inRect(T, Pl.pos, 0.3) && Pl.pos.y - T.c.y < 2) Pl.hurt(30, T.c, false, false);
        break;
      }
      case 'spikes': {
        T.cyc = (T.cyc || 0) + dt; const ph = T.cyc % 1.0, up = ph < 0.45;
        if (up && !T.up) { T.hitE = new Set(); T.hitP = false; A.play('spike', { pos: T.c, vol: 0.6 }); }
        T.up = up; T.spk.position.y = up ? Math.min(0, -0.95 + ph * 10) : Math.max(-0.95, -(ph - 0.45) * 3);
        if (up) { for (const e of E.list.slice()) if (ground(e) && inRect(T, e.pos) && !T.hitE.has(e)) { T.hitE.add(e); E.damage(e, e.def.boss ? 250 : e.def.heavy ? e.maxHp * 0.2 : e.maxHp * 0.7, { kind: 'bullet', point: e.center(), weapon: 'trap' }); FX.ichor(e.center(), new THREE.Vector3(0, 1, 0), e.def.ichor, 1); } if (pIn && !T.hitP) { T.hitP = true; Pl.hurt(25, T.c, false, false); } }
        break;
      }
      case 'freeze': {
        if (Math.random() < 0.8) FX.one(T.c.x + U.rand(-T.hx, T.hx), T.c.y + 0.1, T.c.z + U.rand(-T.hz, T.hz), U.rand(-0.3, 0.3), U.rand(1.5, 3), U.rand(-0.3, 0.3), 1, 0.3, 1.2, 0xc8f0ff, 0.35, 0, 0.8, false);
        for (const e of E.list.slice()) if (ground(e) && inRect(T, e.pos)) E.damage(e, e.maxHp * 0.03 * dt + 1, { kind: 'cryo', quiet: true, point: e.center(), weapon: 'trap', freeze: (e.def.boss ? 0.15 : 1.4) * dt, noPoints: true });
        if (hurtTick && pIn && Pl.debuff) Pl.debuff('chill', 1, 0.4);
        break;
      }
      case 'tesla': {
        T.zapT -= dt; T.orb.material.emissiveIntensity = 0.6 + Math.random() * 0.8;
        if (T.zapT <= 0) {
          T.zapT = 0.35; const top = new THREE.Vector3(T.c.x, T.c.y + 2.95, T.c.z);
          const near = E.list.filter((e) => !e.dead && !e.turned && e.state !== 'burrowed' && e.pos.distanceTo(T.c) < T.r).sort((p, q) => p.pos.distanceTo(T.c) - q.pos.distanceTo(T.c)).slice(0, 3);
          for (const e of near) { FX.bolt(top, e.center(), 0x9fd8ff, 0.12, 10, 0.8); E.damage(e, e.def.boss ? 180 : e.def.heavy ? e.maxHp * 0.12 : e.maxHp * 0.55, { kind: 'arc', point: e.center(), weapon: 'trap', stun: 0.4 }); }
          if (near.length) A.play('arc', { pos: T.c, vol: 0.7 }); else if (Math.random() < 0.3) FX.bolt(top, top.clone().add(new THREE.Vector3(U.rand(-1.5, 1.5), U.rand(-1.5, 0.5), U.rand(-1.5, 1.5))), 0x9fd8ff, 0.08, 6, 0.4);
          if (Pl.pos.distanceTo(T.c) < 2.2) Pl.hurt(15, T.c, false, false);
        }
        break;
      }
      case 'acid': {
        for (const [hx, hz] of T.heads) if (Math.random() < 0.5) FX.one(hx + U.rand(-0.3, 0.3), T.c.y + 3.1, hz + U.rand(-0.3, 0.3), U.rand(-0.4, 0.4), -2, U.rand(-0.4, 0.4), 0.9, 0.08, 0.05, 0x9dff3a, 0.9, 9, 1, false);
        for (const e of E.list.slice()) if (ground(e) && inRect(T, e.pos)) { E.damage(e, e.def.boss ? 150 * dt : e.maxHp * (e.def.heavy ? 0.06 : 0.45) * dt, { kind: 'acid', quiet: true, point: e.center(), weapon: 'trap' }); e.zslow = (e.zslow || 1) * 0.6; }
        if (hurtTick && pIn) Pl.hurt(8, T.c, false, false);
        break;
      }
    }
  }
})();
