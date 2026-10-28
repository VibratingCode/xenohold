'use strict';
// Map-unique victory conditions. Every map still starts its main quest by saturating the pylons; what you do after
// that is different on each map:
//   hold     - stay inside a zone for N seconds while the swarm surges
//   rooftop  - the same, but up on the map's building roof or platform
//   boss     - kill a named finale boss
//   destroy  - destroy N hive nodes that keep hatching broodlings
//   deliver  - the map's own creature drops cores; carry N of them to a terminal
//   charges  - plant charges at the pylons, then reach the evac point before they blow
//   overmind - the classic: sever the Hive Heart and kill the Overmind (systems.js)
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, E = XH.enemies;
  const V = XH.victory = {};
  const P = () => XH.player, G = () => XH.game, W = () => XH.world;

  V.PLANS = {
    kestrel: { type: 'hold', secs: 75, r: 7, name: 'Hold the landing pad', where: 'Landing pad', win: ['SHUTTLE AWAY', 'The dropship made it down. So did you.'] },
    depths: { type: 'overmind' },
    frostfall: { type: 'destroy', n: 3, name: 'Destroy the Frozen Hive Nodes', node: 'Frozen Hive Node', win: ['THE RELAY IS CLEAR', 'Signal sent. Rescue is on the way.'] },
    ark: { type: 'charges', n: 3, secs: 60, name: 'Rig the reactor valves', where: 'Lifeboat', win: ['ARK SCUTTLED', 'The lifeboat cleared the blast. The hive burns with the ship.'] },
    city: { type: 'rooftop', secs: 60, name: 'Signal the evac chopper from the rooftop', win: ['EVAC CHOPPER', 'Wheels up over Hesperus.'] },
    dustbasin: { type: 'boss', boss: 'titan', name: 'Kill the Basin Titan', title: 'BASIN TITAN', win: ['THE BASIN IS QUIET', 'The drills can finally stop.'] },
    verdant: { type: 'deliver', n: 5, name: 'Deliver Spore Cores to the Seed Vault', item: 'Spore Core', where: 'Seed Vault', win: ['SEED VAULT SEALED', 'The station burns its own jungle. You are out.'] },
    helix: { type: 'destroy', n: 3, name: 'Destroy the Specimen Vats', node: 'Specimen Vat', win: ['CONTAINMENT RESTORED', 'Helix Labs goes dark. You walk out.'] },
    undercroft: { type: 'hold', secs: 70, r: 7, name: 'Hold the pump station while it drains', where: 'Pump station', win: ['TUNNELS DRAINED', 'The way up is clear.'] },
    glacier: { type: 'boss', boss: 'wraith', name: 'Kill the Frost Wraith', title: 'FROST WRAITH', win: ['THE GLACIER SLEEPS', 'What was frozen stays frozen.'] },
    crucible: { type: 'charges', n: 3, secs: 60, name: 'Rig the furnaces', where: 'Freight lift', win: ['MELTDOWN', 'The foundry pours itself into the vent. You rode the lift out.'] },
    cathedral: { type: 'boss', boss: 'empress', name: 'Kill the Brood Empress', title: 'BROOD EMPRESS', win: ['THE CHOIR FALLS SILENT', 'The queen is dead.'] },
    bastion: { type: 'hold', secs: 90, r: 8, name: 'Hold the flare point until relief arrives', where: 'Flare point', win: ['RELIEF HAS ARRIVED', 'Bastion 9 held. Barely.'] },
    selene: { type: 'deliver', n: 4, name: 'Load Void Cores into the Mass Driver', item: 'Void Core', where: 'Mass Driver', win: ['MASS DRIVER FIRED', 'The cores are off the moon. So are you.'] },
    starfall: { type: 'rooftop', secs: 60, name: 'Signal the rescue ship from the wreck lookout', win: ['RESCUE SHIP', 'Out of the swamp at last.'] },
    vesper: { type: 'destroy', n: 3, name: 'Seal the Breach Nodes', node: 'Breach Node', win: ['HULL SEALED', 'Vesper holds air again. The hive does not.'] },
    temple: { type: 'overmind' },
  };
  E.addVariant('hivenode', 'broodmother', {
    name: 'Hive Node', hp: 2600, speed: 0, radius: 1.3, pts: 500, ai: 'node', objective: true, heavy: true, threat: 3,
    model: { scale: 1.2, tint: [0x6a1a3a, 0.8], glow: 0x500020 },
    desc: 'A rooted growth that pumps out hatchlings. It cannot move, but it will not stop until it is destroyed.', tip: 'Explosives. Lots of them.',
  });
  E.lib.AI.node = (e, dt) => {
    const Pl = P();
    e.vel.set(0, 0, 0); e.st.move = 0;
    e.nodeT = (e.nodeT === undefined ? 4 : e.nodeT) - dt;
    if (e.nodeT <= 0) { e.nodeT = U.rand(6, 9); for (let k = 0; k < 2; k++) { const b = E.spawn('broodling', e.pos.x + U.rand(-2, 2), e.pos.z + U.rand(-2, 2)); b.state = 'act'; b.pos.y = 0; } A.play('hatch', { pos: e.pos }); }
    E.lib.face(e, dt, Pl.pos.x, Pl.pos.z, 0.5);
    for (const m of e.mats) m.emissive.setHex(Math.sin(e.t * 3) > 0.6 ? 0x700030 : m.userData.base);
  };

  const plan = () => V.PLANS[W().def.id];
  V.active = () => !!V.st;
  V.reset = () => { if (V.st && V.st.cleanup) V.st.cleanup(); V.st = null; };
  // called by systems.js when every pylon is saturated; false = use the classic Overmind finale
  V.begin = () => {
    if (XH.modes && !XH.modes.allowWin()) return false;
    const p = plan();
    if (!p || p.type === 'overmind') return false;
    const Wd = W(), sp = Wd.spots.heart || Wd.spots.pylons[0] || { x: Wd.start.x, z: Wd.start.z };
    const st = V.st = { p, t: 0, prog: 0, pos: new THREE.Vector3(sp.x, 0, sp.z), objs: [] };
    if (p.type === 'hold' || p.type === 'rooftop') {
      const S = XH.structures, top = p.type === 'rooftop' && S && (S.building || S.platform);
      if (top) { st.roof = top; st.pos.set(top.c.x, 0, top.c.z); st.r = top.half + 0.2; st.y = top.roofY || top.deckY; }
      else { st.r = p.r || 7; st.y = 0; }
      st.zone = zoneMarker(st.pos, st.r, st.y, 0x40ff90);
      XH.ui.banner(p.name.toUpperCase(), st.roof ? `Get up on the ${st.roof.name} and stay there` : `Stay inside the ring at the ${p.where}`, '#40ff90');
    } else if (p.type === 'boss') {
      const e = E.spawn(p.boss, st.pos.x, st.pos.z, { variant: 'elite', hpMul: 1.6 });
      e.overmind = true; st.boss = e;
      XH.ui.bossBar(true, p.title); A.music.stinger('boss'); FX.shake(0.6);
      XH.ui.banner(p.title, 'It has come for you.', '#d060ff');
    } else if (p.type === 'destroy') {
      const spots = Wd.spawns.slice().sort((a, b) => Math.hypot(b.x - Wd.start.x, b.z - Wd.start.z) - Math.hypot(a.x - Wd.start.x, a.z - Wd.start.z));
      const picks = [];
      for (const s of spots) { if (picks.length >= p.n) break; if (picks.every((q) => Math.hypot(q.x - s.x, q.z - s.z) > 15)) picks.push(s); }
      for (const s of spots) { if (picks.length >= p.n) break; if (!picks.includes(s)) picks.push(s); }
      for (const s of picks) { const e = E.spawn('hivenode', s.x + 1.5, s.z + 1.5); e.nodeName = p.node; st.objs.push(e); }
      XH.ui.banner(p.name.toUpperCase(), `${p.n} of them. They keep hatching.`, '#ff3080');
    } else if (p.type === 'deliver') {
      st.carry = 0; st.done = 0; st.cores = [];
      st.zone = zoneMarker(st.pos, 2.2, 0, 0x60e0ff);
      XH.ui.banner(p.name.toUpperCase(), `Kill ${E.TYPES[XH.uniques.enemyFor(Wd.def.id)].name}s for their cores`, '#60e0ff');
    } else if (p.type === 'charges') {
      st.planted = 0; st.targets = Wd.sysM.pylons.map((q) => ({ pos: q.pos.clone(), center: q.center, planted: false }));
      st.zone = zoneMarker(st.pos, 3, 0, 0xffa020); st.zone.visible = false;
      XH.ui.banner(p.name.toUpperCase(), 'Plant a charge at each node you saturated', '#ffa020');
    }
    A.say(p.name + '.');
    return true;
  };

  function zoneMarker(pos, r, y, color) {
    const g = new THREE.Group(); g.position.set(pos.x, y + 0.06, pos.z); W().root.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.25, r, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 30; g.add(beam);
    g.userData.ring = ring;
    return g;
  }
  const inZone = (st) => { const Pl = P(); return Math.hypot(Pl.pos.x - st.pos.x, Pl.pos.z - st.pos.z) < st.r && Pl.pos.y >= st.y - 0.3 && !Pl.downed; };
  function surge(dt) {
    const g = G(); V.surgeT = (V.surgeT || 0) - dt;
    if (V.surgeT > 0 || E.aliveCount() >= (g.maxAlive || 20)) return;
    V.surgeT = Math.max(0.6, 1.8 - g.round * 0.05);
    const s = g.pickSpawn(10, 50); if (s) E.spawn(U.pick(['skitterling', 'skitterling', 'lancer', 'burster']), s.x, s.z, { vent: s });
  }
  function win(p) { const st = V.st; if (st && st.zone) st.zone.visible = false; G().win(p.win[0], p.win[1]); }

  V.update = (dt) => {
    const st = V.st; if (!st || G().state !== 'playing') return;
    const p = st.p, Pl = P(); st.t += dt;
    if (st.zone) { st.zone.userData.ring.material.opacity = 0.35 + Math.sin(st.t * 4) * 0.25; }
    if (p.type === 'hold' || p.type === 'rooftop') {
      surge(dt);
      if (inZone(st)) { st.prog += dt; if (Math.random() < 0.3) FX.one(st.pos.x + U.rand(-st.r, st.r) * 0.7, st.y + 0.2, st.pos.z + U.rand(-st.r, st.r) * 0.7, 0, 2, 0, 0.8, 0.15, 0.03, 0x40ff90); }
      if (st.prog >= p.secs) win(p);
    } else if (p.type === 'destroy') {
      const left = st.objs.filter((e) => !e.dead).length;
      if (left !== st.left) { if (st.left !== undefined && left < st.left) XH.ui.banner(p.node.toUpperCase() + ' DESTROYED', `${p.n - left}/${p.n}`, '#40ff90'); st.left = left; }
      if (!left) win(p);
    } else if (p.type === 'deliver') {
      for (let i = st.cores.length - 1; i >= 0; i--) {
        const c = st.cores[i]; c.t -= dt; c.g.rotation.y += dt * 3; c.g.position.y = 0.8 + Math.sin(st.t * 3 + i) * 0.15;
        if (Math.hypot(Pl.pos.x - c.pos.x, Pl.pos.z - c.pos.z) < 1.5 && !Pl.downed) { st.carry++; A.play('grab'); XH.ui.banner(p.item.toUpperCase() + ' COLLECTED', `Carrying ${st.carry}. Take them to the ${p.where}.`, '#60e0ff'); c.t = 0; }
        if (c.t <= 0) { c.g.parent && c.g.parent.remove(c.g); st.cores.splice(i, 1); }
      }
      if (st.done >= p.n) win(p);
    } else if (p.type === 'charges') {
      if (st.planted >= p.n) {
        if (!st.clock) { st.clock = p.secs; st.zone.visible = true; A.play('capsule'); XH.ui.banner('CHARGES ARMED', `Reach the ${p.where} in ${p.secs} seconds`, '#ffa020'); }
        st.clock -= dt; surge(dt);
        if (Math.hypot(Pl.pos.x - st.pos.x, Pl.pos.z - st.pos.z) < 3 && !Pl.downed) win(p);
        else if (st.clock <= 0) { for (const t of st.targets) FX.explosion(t.pos.clone().setY(1.5), 8, 0xffa020); FX.shake(1.2); A.play('nuke'); XH.ui.banner('YOU DID NOT MAKE IT OUT', '', '#ff4030'); G().over(); }
      }
    }
  };
  // map creature kills drop cores during a delivery finale
  V.onKill = (e) => {
    const st = V.st; if (!st || st.p.type !== 'deliver' || e.vid !== XH.uniques.enemyFor(W().def.id)) return;
    const g = new THREE.Group(); g.position.set(e.pos.x, 0.8, e.pos.z); W().root.add(g);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0x60e0ff })); g.add(m);
    g.add(FX.glowSprite(0x60e0ff, 1.8, 0.8));
    st.cores.push({ g, pos: e.pos.clone().setY(0), t: 30 });
  };
  V.spawnBoost = () => { const st = V.st; return st && st.p.type === 'deliver' ? 3 : 1; };
  V.candidates = (out) => {
    const st = V.st; if (!st) return; const Pl = P().pos, p = st.p;
    const d2 = (q) => Math.hypot(q.x - Pl.x, q.z - Pl.z);
    if (p.type === 'deliver') { const d = d2(st.pos); if (d < 2.4) out.push({ tip: 'quest', dist: d - 0.6, text: st.carry ? `Load ${st.carry} ${p.item}${st.carry > 1 ? 's' : ''} into the ${p.where}` : `${p.where}: bring ${p.item}s (${st.done}/${p.n})`, cost: st.carry ? 0 : null, act: st.carry ? () => { st.done += st.carry; st.carry = 0; A.play('forge', { pos: st.pos }); FX.ring(st.pos.clone().setY(0.2), 4, 0x60e0ff, 0.6); XH.ui.banner(p.where.toUpperCase(), `${Math.min(st.done, p.n)}/${p.n} loaded`, '#60e0ff'); } : null }); }
    if (p.type === 'charges' && st.planted < p.n) for (const t of st.targets) { if (t.planted) continue; const d = d2(t.pos); if (d < 2.4) out.push({ tip: 'quest', dist: d - 0.6, text: 'Plant a charge', cost: 0, act: () => { t.planted = true; st.planted++; A.play('build', { pos: t.pos }); const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0x3a3a2a, emissive: 0x802000 })); c.position.set(t.pos.x, 0.9, t.pos.z); W().root.add(c); c.add(FX.glowSprite(0xff4020, 0.8, 0.9)); XH.ui.banner('CHARGE PLANTED', `${st.planted}/${p.n}`, '#ffa020'); } }); }
  };
  V.objective = () => {
    const st = V.st, p = st.p;
    if (p.type === 'hold' || p.type === 'rooftop') return `${p.name}: ${Math.floor(st.prog)}/${p.secs} s${inZone(st) ? '' : st.roof ? `   ·   get up on the ${st.roof.name}` : '   ·   get back in the ring'}`;
    if (p.type === 'boss') return p.name;
    if (p.type === 'destroy') return `${p.name}: ${p.n - (st.left === undefined ? p.n : st.left)}/${p.n}`;
    if (p.type === 'deliver') return `${p.name}: ${st.done}/${p.n}${st.carry ? `   ·   carrying ${st.carry}` : ''}`;
    if (p.type === 'charges') return st.clock ? `Reach the ${p.where}: ${Math.max(0, Math.ceil(st.clock))} s` : `${p.name}: ${st.planted}/${p.n}`;
    return '';
  };
  // the waypoint the HUD can point at
  V.target = () => { const st = V.st; if (!st) return null; if (st.p.type === 'destroy') { const n = st.objs.find((e) => !e.dead); return n ? n.pos : null; } if (st.p.type === 'charges' && st.planted < st.p.n) { const t = st.targets.find((q) => !q.planted); return t ? t.pos : null; } return st.pos; };
})();
