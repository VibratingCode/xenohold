'use strict';
// Mutations: colour variants of the common species that turn up on every map, each with its own trait.
// From round 4, a growing share of spawns (up to 30% by round 15) are drawn from these, each from its own round.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, E = XH.enemies;
  const MU = XH.mutations = {};
  const G = () => XH.game, P = () => XH.player, W = () => XH.world;
  const M = E.MECH, dPl = (e) => Math.hypot(P().pos.x - e.pos.x, P().pos.z - e.pos.z);

  // [id, base species, first round, weight, definition]
  const LIST = [
    ['bloodskitter', 'skitterling', 4, 3, { name: 'Blood Skitter', hp: 80, speed: 7.6, pts: 70, mech: 'frenzy', threat: 1, model: { tint: [0xb01818, 0.8], glow: 0x400404 },
      desc: 'A Skitterling running hot. Every wound makes it faster.', tip: 'Finish it in one burst. Winging it only makes it quicker.' }],
    ['venomskitter', 'skitterling', 5, 3, { name: 'Venom Skitter', hp: 110, pts: 70, mech: 'venom', threat: 1, model: { tint: [0x5ac81e, 0.8], glow: 0x183c04 },
      desc: 'Its scythes drip a toxin that burns for seconds after the cut and stops your health coming back.', tip: 'Keep it off you. Poison stops your health regenerating.' }],
    ['emberskitter', 'skitterling', 7, 2, { name: 'Ember Skitter', hp: 120, pts: 80, mech: 'ember', threat: 2, model: { tint: [0xff7a1a, 0.85], glow: 0x803000 },
      desc: 'Its body is full of burning gel. When it dies it bursts into a pool of fire.', tip: 'Kill it before it reaches you, and step out of the flames.' }],
    ['phaseskitter', 'skitterling', 9, 2, { name: 'Phase Skitter', hp: 110, pts: 90, mech: 'blink', threat: 2, model: { tint: [0x40e8ff, 0.7], glow: 0x0a5060 },
      desc: 'It folds space a few metres at a time, flickering closer faster than it can run.', tip: 'Watch for the flash. It always blinks towards you.' }],
    ['alphaskitter', 'skitterling', 8, 1, { name: 'Alpha Skitterling', hp: 420, speed: 5.6, dmg: 26, radius: 0.62, cy: 0.9, pts: 180, mech: 'pack', threat: 3, model: { scale: 1.5, tint: [0x2a2a30, 0.85], glow: 0x401010, dark: 0.8 },
      desc: 'A Skitterling that never stopped growing. The pack follows it and runs faster while it lives.', tip: 'Take the Alpha down first and the pack slows back to normal.' }],
    ['platedlancer', 'lancer', 6, 3, { name: 'Plated Lancer', hp: 300, pts: 120, mech: 'plated', threat: 2, model: { tint: [0x8a949e, 0.85], glow: 0x101418 },
      desc: 'Its chest and head are armoured in fused bone plates. Shots to the front glance off.', tip: 'Headshots go through the plates. Otherwise, flank it.' }],
    ['shocklancer', 'lancer', 8, 2, { name: 'Shock Lancer', hp: 270, pts: 120, mech: 'shock', threat: 2, model: { tint: [0x3a7aff, 0.8], glow: 0x0a2080 },
      desc: 'Its spines carry a charge. A hit locks your muscles for a moment.', tip: 'Do not let it close with others around. The stun leaves you open.' }],
    ['carrierlancer', 'lancer', 10, 2, { name: 'Carrier Lancer', hp: 320, pts: 140, mech: 'carrier', threat: 3, model: { tint: [0x9a4ab8, 0.75], glow: 0x300840 },
      desc: 'Its back is a nest. When it dies, three Broodlings crawl out of the body.', tip: 'Kill it with explosives, or be ready for the hatchlings.' }],
    ['clusterburster', 'burster', 8, 2, { name: 'Cluster Burster', hp: 150, pts: 110, mech: 'cluster', threat: 2, explode: { r: 3.4, dmg: 30 }, model: { tint: [0xffd030, 0.85], glow: 0x604000 },
      desc: 'It carries its young inside. Popping it releases three Burstlings that run at you.', tip: 'Pop it far away, then deal with what comes out.' }],
    ['frostburster', 'burster', 6, 2, { name: 'Frost Burster', hp: 120, pts: 100, mech: 'frostburst', threat: 2, explode: { r: 4.2, dmg: 18 }, model: { tint: [0xa8e8ff, 0.85], glow: 0x104060 },
      desc: 'Full of supercooled fluid. Its blast barely hurts, but it leaves you frozen stiff.', tip: 'Never let it pop next to you when others are close behind.' }],
    ['sirenshrieker', 'shrieker', 9, 2, { name: 'Siren', hp: 200, pts: 140, mech: 'siren', threat: 3, model: { tint: [0xff40c0, 0.8], glow: 0x500a40 },
      desc: 'A Shrieker whose cry drives the swarm into a frenzy. Everything near it speeds up.', tip: 'Shoot it out of the sky before it can scream twice.' }],
    ['razorwing', 'shrieker', 11, 2, { name: 'Razorwing', hp: 220, pts: 150, threat: 3, ranged: { range: [5, 26], cd: [2.2, 3.2], castT: 0.7, release: 0.5, kind: 'glaive', n: 3, dmg: 12, err: 0.08 }, model: { tint: [0xb0b8c0, 0.85], glow: 0x202830 },
      desc: 'Its wings are edged like blades. It throws three glaives at once.', tip: 'Strafe sideways. The spread is wide but slow.' }],
    ['berserker', 'behemoth', 12, 2, { name: 'Berserker', hp: 2900, pts: 480, mech: 'rage', threat: 4, model: { tint: [0x6a0a0a, 0.85], glow: 0x300000, dark: 0.85 },
      desc: 'A Behemoth that fights harder the more it bleeds. Below half health it goes berserk.', tip: 'Save your big damage for when it drops below half, and give it room.' }],
    ['gilded', 'behemoth', 10, 1, { name: 'Gilded Behemoth', hp: 3400, pts: 1500, mech: 'gilded', threat: 3, model: { tint: [0xd8a820, 0.85], glow: 0x604000 },
      desc: 'A Behemoth whose carapace has turned to something like gold. Killing it pays out, and it always drops something.', tip: 'Worth chasing. It is tougher than it looks.' }],
    ['plaguemother', 'broodmother', 12, 2, { name: 'Plague Mother', hp: 1700, pts: 420, mech: 'venom', threat: 4, model: { tint: [0x7a9a20, 0.8], glow: 0x203000 },
      desc: 'A Broodmother rotten with toxin. Her bite and her bile both poison.', tip: 'Poison stops regeneration. Fight her from range.' }],
    ['burstling', 'burster', 99, 0, { name: 'Burstling', hp: 45, speed: 6.6, radius: 0.36, cy: 0.38, pts: 20, minor: true, threat: 1, explode: { r: 2.6, dmg: 20 }, model: { scale: 0.55, tint: [0xffd030, 0.85], glow: 0x604000 },
      desc: 'A newborn Burster, released when a Cluster Burster pops.', tip: 'Small, fast and fragile. One bullet each.' }],
  ];
  const BY = {};
  for (const [id, base, from, w, def] of LIST) {
    E.addVariant(id, base, Object.assign({ appears: from < 99 ? `Any map, from round ${from}` : 'Released by Cluster Bursters' }, def));
    E.ORDER.push(id);
    if (w > 0) (BY[base] = BY[base] || []).push([id, from, w]);
  }
  MU.LIST = LIST;

  // spawn choice: sometimes swap the chosen species for one of its mutations
  MU.pick = (type, round) => {
    const opts = BY[type]; if (!opts || round < 4) return null;
    const chance = Math.min(0.3, (round - 3) * 0.025);
    if (Math.random() > chance) return null;
    const ok = opts.filter(([, from]) => round >= from); if (!ok.length) return null;
    return U.weighted(ok.map(([id, , w]) => [id, w]));
  };

  // ---------------- traits ----------------
  M.frenzy = { damage(e, amt) { if ((e.rage || 0) < 3 && amt < e.hp) { e.rage = (e.rage || 0) + 1; e.speedMul *= 1.12; FX.burst({ pos: e.center(), n: 6, color: 0xff2020, speed: [1, 3], life: [0.2, 0.4], size: [0.2, 0.05] }); } return amt; } };
  M.venom = { hitPlayer() { P().debuff('poison', 3.5, 4); } };
  M.ember = { death(e) { const p = e.pos.clone().setY(0); E.lib.addPool(p, 2.2, 5, 24, 0xff6020, 'lava'); FX.explosion(p.clone().setY(0.6), 2.2, 0xff7a20); A.play('launcher', { pos: p, vol: 0.5 }); if (P().pos.distanceTo(p) < 2.6) P().hurt(14, p, true); } };
  M.blink = { tick(e, dt) {
    e.blinkCd = (e.blinkCd === undefined ? U.rand(2, 4) : e.blinkCd) - dt;
    if (e.blinkCd > 0 || e.atkT >= 0) return;
    const d = dPl(e); if (d < 5 || d > 18) return;
    const Pl = P(), dx = (Pl.pos.x - e.pos.x) / d, dz = (Pl.pos.z - e.pos.z) / d, x = e.pos.x + dx * 4.5, z = e.pos.z + dz * 4.5;
    e.blinkCd = U.rand(2.5, 4);
    if (W().blockedAt(x, z, 1) || W().solidAt(x, z, e.radius, e.pos.y + 0.3) || !W().clearLine(e.pos.x, e.pos.z, x, z, e.radius, 1)) return;
    FX.burst({ pos: e.center(), n: 14, color: 0x40e8ff, speed: [1, 4], life: [0.2, 0.4], size: [0.25, 0.05] });
    e.pos.x = x; e.pos.z = z;
    FX.burst({ pos: e.center(), n: 14, color: 0x40e8ff, speed: [1, 4], life: [0.2, 0.4], size: [0.25, 0.05] }); A.play('void', { pos: e.pos, vol: 0.35 });
  } };
  M.plated = { damage(e, amt, o) {
    if (o.mult >= 2 || !o.dir || o.kind === 'explosive' || o.kind === 'fire') return amt;
    const front = Math.sin(e.yaw) * -o.dir.x + Math.cos(e.yaw) * -o.dir.z;
    if (front > 0.35) { if (o.point && Math.random() < 0.5) FX.sparks(o.point.clone(), new THREE.Vector3(Math.sin(e.yaw), 0.3, Math.cos(e.yaw))); return amt * 0.4; }
    return amt;
  } };
  M.shock = { hitPlayer(e) { P().debuff('stun', 0.4); FX.bolt(e.center(), P().pos.clone().setY(P().pos.y + 1), 0x6ab0ff, 0.12, 8, 0.3); A.play('arc', { pos: e.pos, vol: 0.6 }); } };
  M.carrier = { death(e) { for (let k = 0; k < 3; k++) { const s = E.spawn('broodling', e.pos.x + U.rand(-0.8, 0.8), e.pos.z + U.rand(-0.8, 0.8)); s.state = 'act'; s.pos.y = 0; } FX.burst({ pos: e.center(), n: 20, color: 0x9a4ab8, speed: [1, 4], life: [0.3, 0.6], size: [0.25, 0.05] }); A.play('hatch', { pos: e.pos }); } };
  // the Burstlings come out a moment after the blast (the blast itself would kill them)
  M.cluster = { death(e) {
    const x = e.pos.x, z = e.pos.z; let t = 0.3, done = false;
    W().anims.push((dt) => { if (done) return; t -= dt; if (t > 0) return; done = true; if (G().state !== 'playing') return; for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const s = E.spawn('burstling', x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2); s.state = 'act'; s.pos.y = 0; } A.play('hatch', { pos: new THREE.Vector3(x, 0.5, z), vol: 0.7 }); });
  } };
  M.frostburst = { death(e) { const p = e.pos; FX.shatter(e.center()); FX.ring(p.clone().setY(0.1), 4.2, 0xa8e8ff, 0.5); if (P().pos.distanceTo(p) < 4.5) P().debuff('chill', 3, 0.3); for (const o of E.list) if (!o.dead && o !== e && !o.def.boss && o.pos.distanceTo(p) < 4.2) o.frozenT = Math.max(o.frozenT, 1.5); } };
  M.siren = { tick(e, dt) {
    e.sirenCd = (e.sirenCd === undefined ? U.rand(3, 5) : e.sirenCd) - dt;
    if (e.sirenCd > 0 || dPl(e) > 30) return;
    e.sirenCd = U.rand(7, 10);
    A.play('shriek', { pos: e.pos, vol: 1 }); FX.ring(e.pos.clone().setY(0.2), 12, 0xff40c0, 0.6);
    for (const o of E.list) if (!o.dead && o !== e && !o.sirened && !o.turned && o.pos.distanceTo(e.pos) < 12) { o.sirened = true; o.speedMul *= 1.2; FX.burst({ pos: o.center(), n: 5, color: 0xff40c0, speed: [1, 2], life: [0.2, 0.4], size: [0.2, 0.05] }); }
  } };
  M.rage = { tick(e) {
    if (e.raged || e.hp > e.maxHp * 0.5) return;
    e.raged = true; e.speedMul *= 1.5; e.chargeCd = 0; e.dmgMul *= 1.25;
    for (const m of e.mats) { m.userData.base = 0x6a0000; m.emissive.setHex(0x6a0000); }
    A.creature('behemoth', 'alert', { pos: e.pos }); FX.shake(0.4); FX.burst({ pos: e.center(), n: 30, color: 0xff2010, speed: [2, 6], life: [0.3, 0.7], size: [0.4, 0.05] });
  } };
  M.gilded = { death(e) {
    const Gm = G(), bonus = Math.round(300 + Gm.round * 60);
    Gm.addPoints(bonus); XH.ui.banner('GILDED BEHEMOTH', `+${U.fmt(bonus)} points`, '#ffd040');
    if (Gm.spawnPowerup) Gm.spawnPowerup(e.pos.clone().setY(0), U.pick(['ammo', 'insta', 'double', 'nuke', 'perk']));
    FX.burst({ pos: e.center(), n: 40, color: 0xffd040, speed: [2, 7], life: [0.4, 0.9], size: [0.3, 0.05] });
  } };
})();
