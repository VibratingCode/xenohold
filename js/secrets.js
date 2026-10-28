'use strict';
// The easter-egg quest, on every map:
//  1. Four Hive Eyes are hidden high on the walls. They whisper when you are close. Shoot them.
//  2. When the last one bursts, the Bone Altar wakes up. Start the ritual and stay in its circle for 25 seconds
//     while the swarm tries to stop you (leaving the circle pauses it).
//  3. The Harbinger comes through. Kill it for the Hive Blessing: every gun you carry is mutated (or goes up a
//     Forge tier), a free perk, one more perk slot and 10,000 points.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, E = XH.enemies, L = E.lib, WP = XH.weapons;
  const SC = XH.secrets = {};
  const G = () => XH.game, P = () => XH.player, W = () => XH.world, UI = () => XH.ui;
  const EYES = 4, RITUAL = 25;

  // ---------------- the secret boss ----------------
  E.addVariant('harbinger', 'lancer', {
    name: 'The Harbinger', boss: true, secret: true, heavy: true, hp: 15000, speed: 4.4, radius: 1.5, cy: 2.8, dmg: 48, reach: 2.4, atkRange: 3.6, pts: 5000, emerge: 2.5, ai: 'harbinger', threat: 5,
    model: { scale: 2.9, tint: [0x120a1e, 0.9], glow: 0x2a0c58, dark: 0.3 },
    desc: 'Whatever the hive prays to sent this. A lancer stretched to three times its height, wrapped in void. It steps through space to reach you, throws storms of glaives and calls its own hunters.',
    tip: 'It blinks next to you every few seconds: keep moving and keep it in front of you. Clear the hunters it calls before they surround you.',
  });
  L.AI.harbinger = (e, dt) => {
    const Pl = P(), B = e.bossAI || (e.bossAI = { phase: 1 });
    const dist = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
    B.blink = (B.blink === undefined ? 6 : B.blink) - dt;
    if (B.blink <= 0 && dist > 5) {
      B.blink = U.rand(5, 8) * (e.hp < e.maxHp * 0.4 ? 0.6 : 1);
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * Math.PI * 2, x = Pl.pos.x + Math.cos(a) * 5.5, z = Pl.pos.z + Math.sin(a) * 5.5;
        if (W().blockedAt(x, z, 1) || W().solidAt(x, z, e.radius, 0.5) || !W().clearLine(x, z, Pl.pos.x, Pl.pos.z, 0.3, 1)) continue;
        FX.burst({ pos: e.center(), n: 40, color: 0x8030ff, speed: [2, 7], life: [0.3, 0.8], size: [0.5, 0.05] });
        e.pos.set(x, 0, z); e.vel && e.vel.set(0, 0, 0);
        FX.burst({ pos: e.center(), n: 40, color: 0x8030ff, speed: [2, 7], life: [0.3, 0.8], size: [0.5, 0.05] });
        A.play('void', { pos: e.pos, vol: 1 }); FX.shake(0.25);
        break;
      }
    }
    B.volley = (B.volley === undefined ? 3 : B.volley) - dt;
    if (B.volley <= 0 && L.sees(e)) {
      B.volley = U.rand(3.5, 5.5);
      const from = L.headPos(e), base = L.aimAt(e, from, from.distanceTo(Pl.pos) / 15, 0.03), side = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
      for (let k = -2; k <= 2; k++) L.shoot('glaive', from, base.clone().addScaledVector(side, k * 1.2), e);
      A.play('shriek', { pos: e.pos, vol: 1 });
    }
    const hpK = e.hp / e.maxHp;
    if ((B.phase === 1 && hpK < 0.66) || (B.phase === 2 && hpK < 0.33)) {
      B.phase++;
      const sp = W().spawns.filter((s) => s.active).slice(0, 4);
      for (let k = 0; k < 4 + B.phase * 2; k++) { const s = sp[k % sp.length]; if (s) E.spawn('skitterling', s.x + U.rand(-1, 1), s.z + U.rand(-1, 1), { variant: 'frenzied' }); }
      UI().banner('THE HARBINGER CALLS ITS HUNTERS', '', '#a060ff'); A.creature('lancer', 'alert', { pos: e.pos });
    }
    if (hpK < 0.3) for (const m of e.mats) m.emissive.setHex(Math.sin(e.t * 8) > 0 ? 0x5a10a0 : m.userData.base);
    L.AI.lancer(e, dt);
  };

  // ---------------- placement ----------------
  SC.st = null;
  SC.build = (c) => {
    SC.st = null;
    const Wd = W(), ST = XH.structures; if (!ST || !ST.wallSpots) return;
    const s = Wd.start, eyes = [], used = [];
    const pin = (k) => XH.edits && XH.edits.pin(k);
    // eyes placed by hand first, then the rest at random on open walls
    for (let k = 0; k < EYES; k++) { const pe = pin('eye' + k); if (pe) { used.push([pe.x, pe.z]); eyes.push(eyeModel(new THREE.Vector3(pe.x, pe.y || 2.6, pe.z), new THREE.Vector3(pe.nx || 0, 0, pe.nz === undefined ? 1 : pe.nz))); eyes[eyes.length - 1].pinKey = 'eye' + k; } }
    const spots = U.shuffle ? U.shuffle(ST.wallSpots()) : ST.wallSpots().sort(() => Math.random() - 0.5);
    for (const sp of Wd.auto === false ? [] : spots) {
      if (eyes.length >= EYES) break;
      if (Math.hypot(sp.x - s.x, sp.z - s.z) < 14 || used.some((u) => Math.hypot(u[0] - sp.x, u[1] - sp.z) < 20)) continue;
      const y = U.rand(2.3, 2.9), dir = new THREE.Vector3(-sp.dx, 0, -sp.dz), o = new THREE.Vector3(sp.x + sp.dx * 0.8, y, sp.z + sp.dz * 0.8);
      const h = Wd.raycast(o, dir, 6); if (h.kind !== 'wall' || h.t > 5) continue;
      const p = o.clone().addScaledVector(dir, h.t - 0.06);
      used.push([sp.x, sp.z]); eyes.push(eyeModel(p, h.n));
    }
    // the altar: an open 3x3 spot away from the start
    const rects = ST.freeRects(3, 3).filter((r) => Math.hypot(Wd.cx2x(r.x + 1) - s.x, Wd.cz2z(r.z + 1) - s.z) > 18);
    const pa = pin('altar'), r = pa ? { x: Wd.cellX(pa.x) - 1, z: Wd.cellZ(pa.z) - 1, w: 3, h: 3 } : Wd.auto === false ? null : rects[Math.floor(Math.random() * rects.length)];
    let altar = null;
    if (r) { const x = pa ? pa.x : Wd.cx2x(r.x + 1), z = pa ? pa.z : Wd.cz2z(r.z + 1); ST.claim(r, 1); Wd.keepClear.push([x, z, 4]); altar = altarModel(x, z); Wd.addCyl(x, z, 0.55, 1.1, { mount: false }); Wd.piece('altar', { label: 'Bone altar (secret)', shape: 'point', x, z, r: 0.9 }); }
    // the eyes that were not placed by hand move every game: the editor lists them so they can be pinned
    let ek = 0; for (const e of eyes) { while (!e.pinKey && pin('eye' + ek)) ek++; const key = e.pinKey || 'eye' + ek++; Wd.piece(key, { label: 'Hive eye (secret)' + (e.pinKey ? '' : ', moves each game until placed'), shape: 'eye', x: e.g.position.x, z: e.g.position.z, y: e.g.position.y, nx: e.n.x, nz: e.n.z, r: 0.45 }); }
    if (eyes.length < 2 || !altar) return;
    SC.st = { eyes, altar, shot: 0, stage: 'eyes', hold: 0, whisperT: 2 };
  };
  function eyeModel(p, n) {
    const g = new THREE.Group(); g.position.copy(p); W().root.add(g);
    g.lookAt(p.clone().add(n));
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8d0a0, emissive: 0x6a5020, emissiveIntensity: 0.6, roughness: 0.3 })); g.add(sclera);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffa020 })); iris.position.z = 0.13; iris.scale.set(1, 1, 0.5); g.add(iris);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.02), new THREE.MeshBasicMaterial({ color: 0x100500 })); pupil.position.z = 0.19; g.add(pupil);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 16), new THREE.MeshStandardMaterial({ color: 0x5a2a3a, roughness: 0.8 })); g.add(lid);
    const glow = FX.glowSprite(0xffa020, 0.9, 0.5); glow.position.z = 0.1; g.add(glow);
    return { g, iris, pupil, pos: p.clone(), n: n.clone(), alive: true, blink: U.rand(1, 5) };
  }
  function altarModel(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); W().root.add(g);
    const bone = new THREE.MeshStandardMaterial({ color: 0xcfc4a4, roughness: 0.8 });
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.4, 6), bone);
      sp.position.set(Math.cos(a) * 3.2, 0.6, Math.sin(a) * 3.2); sp.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(sp);
    }
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.7 })); ped.position.y = 0.5; g.add(ped);
    const orbMat = new THREE.MeshStandardMaterial({ color: 0x100818, emissive: 0x200840, emissiveIntensity: 0.4 });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), orbMat); orb.position.y = 1.35; g.add(orb);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.6, 48), new THREE.MeshBasicMaterial({ color: 0x8030ff, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const light = FX.glowSprite(0x8030ff, 4, 0); light.position.y = 1.4; g.add(light); // a glow, not a light (lights cannot come and go mid-game)
    return { g, orb, orbMat, ring, light, pos: new THREE.Vector3(x, 0, z) };
  }

  // ---------------- shooting the eyes (hitscan rays and explosions) ----------------
  SC.ray = (o, d, maxT) => {
    const st = SC.st; if (!st || st.stage !== 'eyes') return;
    for (const e of st.eyes) {
      if (!e.alive) continue;
      const v = e.pos.clone().sub(o), t = v.dot(d); if (t < 0 || t > maxT + 0.3) continue;
      if (v.addScaledVector(d, -t).length() < 0.26) pop(e);
    }
  };
  SC.blast = (pos, r) => { const st = SC.st; if (!st || st.stage !== 'eyes') return; for (const e of st.eyes) if (e.alive && e.pos.distanceTo(pos) < r) pop(e); };
  function pop(e) {
    const st = SC.st; e.alive = false; e.g.visible = false; st.shot++;
    FX.ichor(e.pos.clone(), e.n.clone(), 0xffa020, 1.5); FX.burst({ pos: e.pos.clone(), n: 30, color: 0xffa020, speed: [2, 6], life: [0.3, 0.8], size: [0.3, 0.05] });
    A.play('splat', { pos: e.pos, vol: 1 }); A.play('wail', { pos: e.pos, vol: 0.4 });
    if (st.shot >= st.eyes.length) {
      st.stage = 'altar'; st.altar.ring.material.opacity = 0.5; st.altar.light.material.opacity = 0.6; st.altar.orbMat.emissive.setHex(0x8030ff); st.altar.orbMat.emissiveIntensity = 1.2;
      UI().banner('THE HIVE IS WATCHING', 'Something has woken at the Bone Altar', '#a060ff'); A.play('heart', { vol: 1 }); FX.shake(0.4);
    } else UI().banner(`${st.shot} / ${st.eyes.length}`, '', '#ffa020');
  }

  // ---------------- prompts ----------------
  SC.candidates = (out) => {
    const st = SC.st; if (!st || G().state !== 'playing') return;
    const Pl = P().pos, d = Math.hypot(st.altar.pos.x - Pl.x, st.altar.pos.z - Pl.z);
    if (d > 2.4) return;
    if (st.stage === 'eyes') out.push({ tip: 'altar', dist: d, text: 'A bone altar. It feels like it is waiting for something…', cost: null });
    else if (st.stage === 'altar') out.push({ tip: 'altar', dist: d, text: 'Begin the ritual', cost: 0, act: () => { st.stage = 'ritual'; st.hold = 0; UI().banner('THE RITUAL BEGINS', `Stay inside the circle for ${RITUAL} seconds`, '#a060ff'); A.music.stinger('boss'); G().toSpawn = Math.max(G().toSpawn, 30); G().maxAlive = Math.min(48, G().maxAlive + 8); } });
  };

  // ---------------- per frame ----------------
  SC.update = (dt, t) => {
    const st = SC.st; if (!st) return;
    const Pl = P();
    if (st.stage === 'eyes') {
      for (const e of st.eyes) {
        if (!e.alive) continue;
        e.blink -= dt; const s = e.blink < 0 ? Math.max(0.1, Math.abs(e.blink + 0.1) * 10) : 1; e.iris.scale.y = e.pupil.scale.y = Math.min(1, s); if (e.blink < -0.2) e.blink = U.rand(2, 6);
      }
      // a whisper when you are close to one
      st.whisperT -= dt;
      if (st.whisperT <= 0) {
        st.whisperT = U.rand(4, 7);
        const near = st.eyes.filter((e) => e.alive).map((e) => e.pos.distanceTo(Pl.pos)).sort((a, b) => a - b)[0];
        if (near < 12) A.play('wail', { pos: st.eyes.find((e) => e.alive && e.pos.distanceTo(Pl.pos) === near).pos, vol: 0.25 * (1 - near / 12) + 0.05 });
      }
    }
    const al = st.altar;
    if (st.stage !== 'eyes') { al.orb.position.y = 1.35 + Math.sin(t * 2) * 0.08; al.ring.rotation.z += dt * (st.stage === 'ritual' ? 1.5 : 0.3); }
    if (st.stage === 'ritual') {
      const d = Math.hypot(al.pos.x - Pl.pos.x, al.pos.z - Pl.pos.z), inside = d < 3.4 && !Pl.downed;
      if (inside) { st.hold += dt; G().toSpawn = Math.max(G().toSpawn, 6); }
      al.ring.material.opacity = inside ? 0.8 : 0.3 + Math.sin(t * 6) * 0.2;
      al.orb.scale.setScalar(1 + st.hold / RITUAL);
      if (Math.random() < dt * 8) FX.one(al.pos.x + U.rand(-3, 3), 0.2, al.pos.z + U.rand(-3, 3), 0, 2, 0, 0.8, 0.25, 0.05, 0x8030ff);
      if (st.hold >= RITUAL) {
        st.stage = 'boss';
        const e = E.spawn('harbinger', al.pos.x + 4, al.pos.z);
        UI().bossBar(true, 'THE HARBINGER'); UI().banner('THE HARBINGER', 'It came through', '#a060ff');
        A.music.stinger('boss'); A.say('Unknown contact. Massive.'); FX.shake(1); FX.flash(al.pos.clone().setY(1.5), 0x8030ff, 10, 0.6, 30);
        st.boss = e; al.light.material.opacity = 0.15; al.ring.material.opacity = 0.1;
      }
    }
  };
  SC.objective = () => {
    const st = SC.st; if (!st) return '';
    if (st.stage === 'ritual') { const Pl = P().pos, d = Math.hypot(st.altar.pos.x - Pl.x, st.altar.pos.z - Pl.z); return d < 3.4 ? `The ritual: ${Math.ceil(RITUAL - st.hold)} s` : 'The ritual: get back in the circle!'; }
    if (st.stage === 'boss' && st.boss && !st.boss.dead) return 'Kill the Harbinger';
    return '';
  };
  SC.onKill = (e) => {
    const st = SC.st; if (!st || e !== st.boss) return;
    st.stage = 'done';
    const Wp = WP, Pl = P();
    for (const s of Wp.state.inv) { if (!s.upg) Wp.upgrade(s); else if ((s.tier || 1) < 3) Wp.tierUp(s); }
    SC.bonus = 1;
    const perks = Object.values(XH.PERKS).filter((p) => !Pl.perks.has(p.id) && p.id !== 'lazarus');
    const pk = perks.length ? U.pick(perks) : null; if (pk) Pl.addPerk(pk.id);
    G().addPoints(10000, true);
    setTimeout(() => UI().banner('HIVE BLESSING', `Every gun mutated · ${pk ? pk.name + ' · ' : ''}one more perk slot · 10,000 points`, '#ffd860'), 2500);
    if (XH.achievements) { XH.achievements.flag('egg'); XH.achievements.flag('secret'); }
    XH.progress && XH.progress.addXP(5000, 'The Harbinger slain');
    UI().weaponChanged(Wp.cur()); UI().perksChanged && UI().perksChanged();
  };
  SC.bonus = 0;
  SC.perkBonus = () => SC.bonus;
  SC.reset = () => { SC.bonus = 0; };
})();
