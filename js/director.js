'use strict';
// The Director: paces each round instead of a flat stream of creatures (the Left 4 Dead idea).
//  - Intensity (0 to 1.5) rises when you get hurt or surrounded and falls when things are quiet.
//  - Phases: BUILD (normal spawning) → PEAK (when intensity crosses the line, held for a few seconds) → RELAX
//    (no new spawns for 6-10 s, so you can breathe, reload and move) → BUILD again.
//  - If you are cruising (low intensity for a long stretch), it pushes a wave: faster spawns and a tension cue
//    (lights flicker, something roars in the distance).
//  - Camp one spot for 40 s and a group comes at you from behind, from a vent you cannot see.
//  - New creatures come from vents out of your sight when it can.
//  - Difficulty adapts a little between rounds: rounds you walk through make the next ones a bit harder,
//    rounds that down you make them a bit easier (at most ±20% on spawn rate and the number alive at once).
// The "Classic Spawning" mutator turns it off.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const DR = XH.director = { I: 0, phase: 'build', t: 0, perf: 0 };
  const G = () => XH.game, P = () => XH.player, W = () => XH.world, E = () => XH.enemies;
  const md = () => G().mods || {};
  let lastHurt = -99, anchor = null, campT = 0, flankCd = 20, peakDur = 5, relaxDur = 8, rTaken = 0, rDowns = 0, flicker = 0;

  DR.on = () => !md().classic && !(XH.modes && XH.modes.id() === 'bossrush') && G().state === 'playing';
  DR.reset = () => { DR.I = 0; DR.phase = 'build'; DR.t = 0; DR.perf = 0; lastHurt = -99; anchor = null; campT = 0; flankCd = 20; rTaken = 0; rDowns = 0; flicker = 0; };
  const now = () => G().stats.time;

  // damage and downs feed intensity
  const Pl = XH.player, baseHurt = Pl.hurt, baseDown = Pl.goDown;
  Pl.hurt = (amt, from, explosive, silent) => { const hp0 = Pl.hp, was = Pl.downed; baseHurt(amt, from, explosive, silent); const d = was ? 0 : hp0 - Math.max(0, Pl.hp); if (d > 0) { DR.I = Math.min(1.5, DR.I + d / Pl.maxHp * 1.1); lastHurt = now(); rTaken += d; } };
  Pl.goDown = () => { DR.I = 1.5; rDowns++; baseDown(); };

  DR.onRoundStart = () => { DR.phase = 'build'; DR.t = 0; rTaken = 0; rDowns = 0; };
  DR.onRoundEnd = () => {
    const Gm = G(), mx = P().maxHp;
    let d = rDowns ? -0.35 : rTaken < mx * 0.3 ? 0.15 : rTaken > mx * 1.5 ? -0.1 : 0.03;
    DR.perf = U.clamp(DR.perf + d, -1, Gm.round < 4 ? 0.2 : 1);
  };

  DR.update = (dt) => {
    const Gm = G();
    if (!DR.on()) { DR.I = Math.max(0, DR.I - dt * 0.1); return; }
    const Pl = P();
    let near = 0; for (const e of E().list) if (!e.dead && !e.turned && e.state === 'act' && !e.def.objective && Math.hypot(e.pos.x - Pl.pos.x, e.pos.z - Pl.pos.z) < 7) near++;
    DR.I = U.clamp(DR.I + near * 0.03 * dt - (near === 0 && now() - lastHurt > 3 ? 0.14 : 0.04) * dt, 0, 1.5);
    flankCd -= dt;
    if (flicker > 0) { flicker = Math.max(0, flicker - dt); flick(); }
    if (Gm.between > 0 || Pl.downed) { DR.phase = Gm.between > 0 ? 'build' : DR.phase; campT = 0; return; }
    DR.t += dt;
    const PEAK = 0.8 - 0.1 * DR.perf, surv = XH.modes && XH.modes.id() === 'survival';
    if (DR.phase === 'build') {
      if (DR.I >= PEAK) toPeak();
      else if (DR.t > 35 - 10 * DR.perf && DR.I < 0.3 && Gm.toSpawn > 6) { DR.phase = 'push'; DR.t = 0; cue(); }
    } else if (DR.phase === 'push') {
      if (DR.I >= PEAK || DR.t > 9) toPeak();
    } else if (DR.phase === 'peak') {
      if (DR.t > peakDur) { DR.phase = 'relax'; DR.t = 0; relaxDur = U.rand(6, 10) * (1 - 0.3 * DR.perf) * (surv ? 0.6 : 1); }
    } else if (DR.phase === 'relax') {
      if ((DR.t > relaxDur && DR.I < 0.35) || DR.t > relaxDur * 1.4) { DR.phase = 'build'; DR.t = 0; }
    }
    // camping: stay inside an 8 m circle for 40 s and something comes from behind
    if (!anchor || Math.hypot(Pl.pos.x - anchor.x, Pl.pos.z - anchor.z) > 8) { anchor = Pl.pos.clone(); campT = 0; }
    else if (Gm.toSpawn > 0 || surv) campT += dt;
    if (campT > 40 && flankCd <= 0) { if (flank()) { campT = 20; flankCd = 30; } }
  };
  function toPeak() {
    DR.phase = 'peak'; DR.t = 0; peakDur = U.rand(4, 7) + 2 * Math.max(0, DR.perf);
    if (XH.telemetry) XH.telemetry.peak();
  }
  // a tension cue before a pushed wave: the lights stutter and something roars far away
  function cue() {
    const Pl = P(), far = W().spawns.filter((s) => s.active).sort((a, b) => Math.hypot(b.x - Pl.pos.x, b.z - Pl.pos.z) - Math.hypot(a.x - Pl.pos.x, a.z - Pl.pos.z))[0];
    if (far) A.creature(G().round >= 8 ? 'behemoth' : 'lancer', 'alert', { pos: new THREE.Vector3(far.x, 1, far.z), vol: 0.8 });
    if (W().power) flicker = 1.4;
    FX.shake(0.15);
  }
  function flick() {
    for (const L of W().lights || []) if (!L.onAt) L.light.intensity = flicker > 0.05 ? L.base * (Math.random() < 0.35 ? 0.08 : 1) : L.base;
  }
  // a group from behind, out of sight
  function flank() {
    const Pl = P(), Gm = G(), Wd = W(), fx = -Math.sin(Pl.yaw), fz = -Math.cos(Pl.yaw);
    const cand = Wd.spawns.filter((s) => s.active).map((s) => { const dx = s.x - Pl.pos.x, dz = s.z - Pl.pos.z, d = Math.hypot(dx, dz); return { s, d, dot: (dx * fx + dz * fz) / (d || 1), seen: Wd.clearLine(s.x, s.z, Pl.pos.x, Pl.pos.z, 0.3, 1) }; })
      .filter((o) => o.d > 8 && o.d < 40 && o.dot < -0.1).sort((a, b) => (a.seen - b.seen) || (a.dot - b.dot));
    const c = cand[0]; if (!c) return false;
    const r = Gm.round, n = Math.min(7, 3 + Math.floor(r / 5));
    for (let k = 0; k < n; k++) {
      const type = r >= 8 && Math.random() < 0.25 ? 'burster' : r >= 4 && Math.random() < 0.45 ? 'lancer' : 'skitterling';
      E().spawn(type, c.s.x + U.rand(-0.8, 0.8), c.s.z + U.rand(-0.8, 0.8), { vent: c.s });
    }
    Gm.toSpawn = Math.max(0, Gm.toSpawn - n);
    A.creature('skitterling', 'alert', { pos: new THREE.Vector3(c.s.x, 1, c.s.z), vol: 1 });
    return true;
  }

  // what the spawner asks
  DR.allowSpawn = () => !DR.on() || DR.phase !== 'relax';
  DR.rateMul = () => (!DR.on() ? 1 : (DR.phase === 'push' ? 0.45 : DR.phase === 'peak' ? 0.85 : 1) * (1 - 0.2 * DR.perf));
  DR.aliveMul = () => (!DR.on() ? 1 : (DR.phase === 'push' ? 1.25 : 1) * (1 + 0.2 * DR.perf));
  // prefer vents you are not looking at
  DR.spawnWeight = (s) => {
    if (!DR.on()) return 1;
    const Pl = P(), dx = s.x - Pl.pos.x, dz = s.z - Pl.pos.z, d = Math.hypot(dx, dz) || 1;
    const dot = (dx * -Math.sin(Pl.yaw) + dz * -Math.cos(Pl.yaw)) / d;
    return dot > 0.55 && d < 30 && W().clearLine(s.x, s.z, Pl.pos.x, Pl.pos.z, 0.3, 1) ? 0.3 : 1;
  };
  DR.musicAdd = () => (!DR.on() ? 0 : DR.phase === 'peak' ? 0.45 : DR.phase === 'push' ? 0.3 : DR.phase === 'relax' ? -0.4 : 0);
})();
