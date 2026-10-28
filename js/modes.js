'use strict';
// Game modes, picked on the arena screen and carried in the mods as `mode`:
//  - Standard:   rounds, the map's victory condition, bosses every 8th round.
//  - Boss Rush:  every round is a boss. Beat six in a row to win.
//  - Gun Game:   kills level your gun up a ladder of 20 weapons. No wall buys, Xeno Cache or Forge. Going down
//                costs a level. With the last gun, a knife kill wins.
//  - Survival:   no rounds and no breaks. The swarm never stops and grows every 40 seconds.
//  - Escape Run: reach the extraction beacon on the far side of the map and hold it for 30 seconds.
//                Doors are free. The clock is your score.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const MO = XH.modes = {};
  const G = () => XH.game, P = () => XH.player, W = () => XH.world, E = () => XH.enemies, WP = () => XH.weapons, UI = () => XH.ui;

  MO.LIST = [
    { id: 'standard', name: 'Standard', desc: "Rounds of creatures, bosses every 8th round and the map's own victory condition." },
    { id: 'bossrush', name: 'Boss Rush', desc: 'Every round is a boss fight. Beat six in a row to win. You start with 6,000 points.' },
    { id: 'gungame', name: 'Gun Game', desc: 'Kills level your gun up a ladder of 20 weapons. No wall buys, Xeno Cache or Forge. Going down costs a level. Win with a knife kill on the last gun.' },
    { id: 'survival', name: 'Survival', desc: 'No rounds and no breaks. The swarm never stops and grows every 40 seconds. Your time is your score.' },
    { id: 'escape', name: 'Escape Run', desc: 'Doors are free. Reach the extraction beacon on the far side of the map, then hold it for 30 seconds. Your time is your score.' },
  ];
  MO.id = () => (G().mods && G().mods.mode) || 'standard';
  MO.def = (id) => MO.LIST.find((m) => m.id === (id || MO.id())) || MO.LIST[0];
  MO.st = {};
  const BOSSES_TO_WIN = 6, SURVIVE_STEP = 40, HOLD = 30;

  // ---------------- start ----------------
  MO.start = () => {
    clearBeacon();
    const id = MO.id(), Gm = G();
    MO.st = { id, t: 0, bosses: 0 };
    if (id === 'bossrush') { Gm.round += 7; Gm.points = Math.max(Gm.points, 6000); UI().points(Gm.points, 0); }
    if (id === 'gungame') { MO.st.ladder = ladder(); MO.st.lv = 0; MO.st.kills = 0; setGun(false); }
    if (id === 'escape') placeBeacon();
    if (id === 'survival') MO.st.next = SURVIVE_STEP;
  };
  MO.freeDoors = () => MO.id() === 'escape';
  // wall buys, the Xeno Cache and the Forge are off in Gun Game
  MO.blocks = (tip) => MO.id() === 'gungame' && (tip === 'wallbuy' || tip === 'box' || tip === 'forge');
  MO.allowWin = () => MO.id() === 'standard';
  MO.bestKey = (mapId) => mapId + (MO.id() === 'standard' ? '' : ':' + MO.id());

  // called from nextRound once the round's numbers are set
  MO.onRound = (r) => {
    const Gm = G(), id = MO.id();
    if (id === 'bossrush') { Gm.special = 'boss'; Gm.toSpawn = Math.round(4 + r * 0.4); }
    if (id === 'survival') Gm.toSpawn = 1e6;
    if (id === 'escape') Gm.maxAlive = Math.min(44, Gm.maxAlive + 4);
  };
  MO.between = (t) => (MO.id() === 'escape' ? 4 : MO.id() === 'bossrush' ? 12 : t);

  MO.onBoss = () => {
    if (MO.id() !== 'bossrush') return;
    const st = MO.st; st.bosses++;
    if (st.bosses >= 5 && XH.achievements) XH.achievements.flag('bossrush');
    if (st.bosses >= BOSSES_TO_WIN) setTimeout(() => G().win('BOSS RUSH COMPLETE', `${BOSSES_TO_WIN} bosses down in ${clock(G().stats.time)}`, true), 1800);
    else UI().banner(`BOSS ${st.bosses} / ${BOSSES_TO_WIN} DOWN`, 'Resupply before the next one', '#d060ff');
  };
  MO.onKill = (e, o) => {
    if (MO.id() !== 'gungame' || o.noPoints) return;
    const st = MO.st;
    if (st.lv >= st.ladder.length - 1 && o.kind === 'melee') { st.done = true; if (XH.achievements) XH.achievements.flag('gungame'); G().win('GUN GAME WON', `All ${st.ladder.length} guns in ${clock(G().stats.time)}`, true); return; }
    if (o.weapon === 'frag' || o.weapon === 'turret' || st.lv >= st.ladder.length - 1 || (e.def.minor && Math.random() < 0.5)) return;
    st.kills++;
    if (st.kills >= need(st.lv)) { st.lv++; st.kills = 0; setGun(true); }
  };
  MO.onDown = () => {
    if (MO.id() !== 'gungame') return;
    const st = MO.st; if (st.lv > 0) { st.lv--; st.kills = 0; setGun(true, true); }
  };

  // ---------------- Gun Game ----------------
  const ORDER = ['Pistol', 'Hand Cannon', 'SMG', 'Shotgun', 'Rifle', 'Marksman', 'LMG', 'Sniper', 'Energy', 'Launcher', 'Special', 'Heavy', 'Wonder Weapon'];
  function ladder() {
    const D = WP().DEFS, by = {};
    for (const id in D) { const d = D[id]; if (d.map || d.melee || d.build || id === 'knife' || d.mode === 'none') continue; (by[d.cls] = by[d.cls] || []).push(id); }
    const out = [];
    for (const c of ORDER) { const l = (by[c] || []).sort((a, b) => (D[a].cost || 0) - (D[b].cost || 0)); if (!l.length) continue; const n = c === 'Wonder Weapon' ? 1 : 2; for (let k = 0; k < n && k < l.length; k++) out.push(l[Math.floor(k * l.length / n)]); }
    if (out[0] !== 'p9' && D.p9) { out.splice(out.indexOf('p9'), out.includes('p9') ? 1 : 0); out.unshift('p9'); }
    while (out.length > 20) out.splice(Math.floor(out.length / 2), 1);
    return out;
  }
  const need = (lv) => 2 + Math.floor(lv / 4);
  function setGun(announce, demoted) {
    const st = MO.st, Wp = WP(), S = Wp.state, id = st.ladder[Math.min(st.lv, st.ladder.length - 1)];
    const slot = Wp.slot(id);
    if (st.lv >= 10) Wp.upgrade(slot);
    slot.reserve = slot.s.reserve * 2;
    S.inv = [slot]; Wp.equipIndex(0); UI().weaponChanged(Wp.cur());
    if (!announce) return;
    const last = st.lv >= st.ladder.length - 1;
    if (demoted) { UI().banner('DEMOTED', `Back to level ${st.lv + 1}: ${slot.s.name}`, '#ff6040'); A.play('deny'); }
    else { UI().banner(last ? 'FINAL LEVEL' : `LEVEL ${st.lv + 1} / ${st.ladder.length}`, last ? `${slot.s.name}. Get a knife kill to win` : slot.s.name, '#ffd860'); A.play('powerup'); }
  }

  // ---------------- Escape Run ----------------
  let beacon = null;
  function clearBeacon() { if (beacon) { beacon.g.parent && beacon.g.parent.remove(beacon.g); beacon = null; } }
  function placeBeacon() {
    const Wd = W(), N = Wd.w * Wd.h, dist = new Int32Array(N).fill(-1), door = new Uint8Array(N);
    for (const id in Wd.doors) for (const c of Wd.doors[id].cells) door[c] = 1;
    const sx = Wd.cellX(Wd.start.x), sz = Wd.cellZ(Wd.start.z), q = [sx + sz * Wd.w]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % Wd.w, z = (i / Wd.w) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz; if (!Wd.inside(nx, nz)) continue;
        const ni = nx + nz * Wd.w; if (dist[ni] >= 0) continue;
        if (!door[ni] && Wd.blockedCell(nx, nz, 1)) continue;
        dist[ni] = dist[i] + 1; q.push(ni);
      }
    }
    // the farthest open cell (not a door, not next to a wall if we can help it)
    let best = q[0], bd = -1;
    for (const i of q) {
      if (door[i]) continue;
      const x = i % Wd.w, z = (i / Wd.w) | 0;
      let open = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!Wd.blockedCell(x + dx, z + dz, 1)) open++;
      const score = dist[i] + open * 0.6;
      if (score > bd) { bd = score; best = i; }
    }
    const x = Wd.cx2x(best % Wd.w), z = Wd.cz2z((best / Wd.w) | 0), y = Wd.groundAt ? Wd.groundAt(x, z, 0.3, 0.5) : 0;
    const g = new THREE.Group(); g.position.set(x, y, z); Wd.root.add(g);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 80, 16, 1, true), beamMat); beam.position.y = 40; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4, 48), new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const glow = FX.glowSprite(0x40ff90, 5, 0.7); glow.position.y = 1.2; g.add(glow);
    const halo = FX.glowSprite(0x40ff90, 9, 0.35); halo.position.y = 2; g.add(halo);
    beacon = { g, beam, ring, pos: new THREE.Vector3(x, y, z), hold: 0, holding: false, cells: dist[best] };
  }
  const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  function bearing(p) {
    const Pl = P(), dx = p.x - Pl.pos.x, dz = p.z - Pl.pos.z;
    const fx = -Math.sin(Pl.yaw), fz = -Math.cos(Pl.yaw), rx = Math.cos(Pl.yaw), rz = -Math.sin(Pl.yaw);
    const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    return ARROWS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  }

  // ---------------- per frame ----------------
  MO.update = (dt) => {
    const id = MO.id(), st = MO.st, Gm = G();
    st.t += dt;
    if (id === 'survival') {
      if (st.t >= st.next) { st.next += SURVIVE_STEP; Gm.nextRound(); UI().banner('THE SWARM GROWS', `Survived ${clock(st.t)}`, '#ff8a3a'); }
      if (st.t >= 600 && XH.achievements && !st.ach) { st.ach = true; XH.achievements.flag('survival'); }
    }
    if (id === 'escape' && beacon) {
      beacon.ring.rotation.z += dt * 0.6; beacon.beam.material.opacity = 0.22 + Math.sin(st.t * 3) * 0.06;
      const Pl = P(), d = Math.hypot(Pl.pos.x - beacon.pos.x, Pl.pos.z - beacon.pos.z);
      if (!beacon.holding && d < 4 && !Pl.downed) {
        beacon.holding = true; UI().banner('HOLD THE EXTRACTION', `Stay inside the ring for ${HOLD} seconds`, '#40ff90'); A.music.stinger('boss'); A.say('Extraction inbound. Hold position.');
        Gm.maxAlive = Math.min(48, Gm.maxAlive + 8); Gm.toSpawn = Math.max(Gm.toSpawn, 40);
      }
      if (beacon.holding && d < 8 && !Pl.downed) {
        beacon.hold += dt; Gm.toSpawn = Math.max(Gm.toSpawn, 10);
        if (beacon.hold >= HOLD && !st.done) {
          st.done = true; if (XH.achievements) XH.achievements.flag('escape');
          const best = U.load('escBest', {}), k = Gm.def.id, t = Gm.stats.time;
          const rec = !best[k] || t < best[k]; if (rec && !XH.DEBUG) { best[k] = t; U.save('escBest', best); }
          Gm.win('EXTRACTED', `Time ${clock(t)}${rec ? '  ·  NEW BEST' : best[k] ? '  ·  best ' + clock(best[k]) : ''}`, true);
        }
      }
    }
  };
  // HUD objective line
  MO.objective = () => {
    const id = MO.id(), st = MO.st;
    if (id === 'bossrush') return `Boss Rush: ${st.bosses || 0} / ${BOSSES_TO_WIN} bosses down`;
    if (id === 'survival') return `Survival: ${clock(st.t || 0)}   ·   the swarm grows in ${Math.max(0, Math.ceil((st.next || 0) - (st.t || 0)))} s`;
    if (id === 'gungame' && st.ladder) {
      const last = st.lv >= st.ladder.length - 1;
      return last ? `Gun Game: final level. Get a knife kill (V) to win` : `Gun Game: level ${st.lv + 1} / ${st.ladder.length}   ·   ${need(st.lv) - st.kills} more kill${need(st.lv) - st.kills > 1 ? 's' : ''} for the next gun`;
    }
    if (id === 'escape' && beacon) {
      if (beacon.holding) { const Pl = P(), d = Math.hypot(Pl.pos.x - beacon.pos.x, Pl.pos.z - beacon.pos.z); return d < 8 ? `Hold the extraction: ${Math.ceil(HOLD - beacon.hold)} s` : `Get back to the extraction ${bearing(beacon.pos)} (${Math.round(d)} m)`; }
      const Pl = P(); return `Escape: reach the extraction beacon ${bearing(beacon.pos)} ${Math.round(Math.hypot(Pl.pos.x - beacon.pos.x, Pl.pos.z - beacon.pos.z))} m   ·   ${clock(G().stats.time)}`;
    }
    return '';
  };
  MO.overLine = (round) => {
    const id = MO.id();
    if (id === 'survival') return `You lasted <b>${clock(G().stats.time)}</b>`;
    if (id === 'bossrush') return `You beat <b>${MO.st.bosses || 0}</b> of ${BOSSES_TO_WIN} bosses`;
    if (id === 'gungame' && MO.st.ladder) return `You reached gun <b>${MO.st.lv + 1}</b> of ${MO.st.ladder.length}`;
    if (id === 'escape') return MO.st.done ? `Extracted in <b>${clock(G().stats.time)}</b>` : `You survived <b>${round}</b> rounds`;
    return null;
  };
  const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  MO.clear = clearBeacon;

  // ---------------- mode picker on the arena screen ----------------
  MO.sel = U.load('modeSel', 'standard');
  MO.renderPicker = () => {
    const el = document.getElementById('modes'); if (!el) return;
    el.innerHTML = MO.LIST.map((m) => `<button data-m="${m.id}" class="${MO.sel === m.id ? 'on' : ''}" title="${m.desc}">${m.name}</button>`).join('');
    document.getElementById('modeDesc').textContent = MO.def(MO.sel).desc;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { MO.sel = b.dataset.m; U.save('modeSel', MO.sel); A.play('uiClick'); MO.renderPicker(); }));
  };
})();
