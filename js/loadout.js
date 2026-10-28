'use strict';
// Tailored Loadout (a sandbox mutator) and the Deployable Turret lethal.
//  - Every weapon, perk and lethal has an unlock you earn by playing: weapons need kills with that weapon (by class,
//    e.g. 2,500 shotgun kills), perks need to have been bought 20 times, the turret needs 100 frag grenade kills.
//  - With the mutator on, you start with the loadout you built from unlocked gear.
//  - The Deployable Turret replaces frag grenades (chosen per class): G places a sentry for 30 s. It uses two charges.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const LO = XH.loadout = {};
  const PR = () => XH.progress, D = () => XH.progress.data, P = () => XH.player, G = () => XH.game, W = () => XH.world, E = () => XH.enemies, WP = () => XH.weapons;

  // ---------------- unlocks ----------------
  LO.WEAPON_KILLS = { Pistol: 150, 'Hand Cannon': 500, SMG: 800, Rifle: 1200, Marksman: 1500, Sniper: 1500, Shotgun: 2500, LMG: 2000, Launcher: 2000, Energy: 1800, Special: 1800, Heavy: 2500, 'Wonder Weapon': 5000 };
  LO.PERK_BUYS = 20;
  LO.TURRET_FRAGS = 100;
  // lethals (G): unlocked by frag grenade kills; tacticals (T): unlocked by rank
  LO.LETHALS = [
    { id: 'frag', name: 'Frag Grenade', desc: 'Two per round', frags: 0 },
    { id: 'semtex', name: 'Sticky Charge', desc: 'Sticks to whatever it hits, bigger blast', frags: 40 },
    { id: 'cryo', name: 'Cryo Grenade', desc: 'Freezes everything in a wide burst', frags: 70 },
    { id: 'turret', name: 'Deployable Turret', desc: 'A 30 s sentry, uses 2 charges', frags: 100 },
  ];
  LO.TACTICALS = [
    { id: 'none', name: 'None', desc: 'Find tacticals in the Xeno Cache', rank: 1 },
    { id: 'decoy', name: 'Decoy Hologram', desc: 'A copy of you that creatures attack until it breaks', rank: 5 },
    { id: 'lure', name: 'Lure Beacon', desc: 'Pulls creatures in, then explodes', rank: 10 },
  ];
  LO.lethalOk = (id) => { const l = LO.LETHALS.find((q) => q.id === id); return !!l && (unlockAll() || (D().fragKills || 0) >= l.frags); };
  LO.tacticalOk = (id) => { const t = LO.TACTICALS.find((q) => q.id === id); return !!t && (unlockAll() || D().prestige > 0 || D().level >= t.rank); };
  const unlockAll = () => !!XH.DEBUG_UNLOCK;
  LO.weapons = () => Object.keys(WP().DEFS).filter((id) => { const d = WP().DEFS[id]; return !d.map && !d.melee && !d.build && id !== 'knife'; });
  LO.weaponNeed = (id) => (id === 'p9' ? 0 : LO.WEAPON_KILLS[WP().DEFS[id].cls] || 1500);
  LO.weaponOk = (id) => unlockAll() || PR().killsWith(id) >= LO.weaponNeed(id);
  LO.perkBuys = (id) => ((D().pk || {})[id] || 0);
  LO.perkOk = (id) => unlockAll() || LO.perkBuys(id) >= LO.PERK_BUYS;
  LO.turretOk = () => unlockAll() || (D().fragKills || 0) >= LO.TURRET_FRAGS;
  LO.countPerk = (id) => { const d = D(); d.pk = d.pk || {}; d.pk[id] = (d.pk[id] || 0) + 1; };
  LO.countFrag = () => { const d = D(); d.fragKills = (d.fragKills || 0) + 1; const l = LO.LETHALS.find((q) => q.frags && q.frags === d.fragKills); if (l) XH.ui.banner(l.name.toUpperCase() + ' UNLOCKED', 'Pick it as your lethal in the Classes screen', '#40ff90'); };
  LO.data = () => { const d = D(); d.loadout = d.loadout || { primary: 'p9', secondary: null, perks: [], lethal: 'frag' }; return d.loadout; };
  LO.save = () => PR().save();

  // ---------------- applying the loadout at the start of a game ----------------
  LO.apply = () => {
    const L = LO.data(), Wp = WP(), S = Wp.state;
    const guns = [L.primary, L.secondary].filter((id, k, a) => id && Wp.DEFS[id] && LO.weaponOk(id) && a.indexOf(id) === k);
    if (guns.length) {
      S.inv = guns.map((id) => Wp.slot(id));
      if (S.inv.length > 1 && !P().perks.has('holster')) S.inv.length = Math.min(S.inv.length, 2);
      Wp.equipIndex(0);
    }
    for (const id of L.perks.slice(0, 4)) if (LO.perkOk(id) && Object.values(XH.PERKS).some((p) => p.id === id)) P().addPerk(id);
    if (L.lethal && LO.lethalOk(L.lethal)) S.lethal = L.lethal;
    XH.ui.weaponChanged(Wp.cur());
  };
  // the class's lethal (without the sandbox mutator)
  LO.classLethal = () => { const c = XH.classes && XH.classes.cur(); return c && c.lethal && LO.lethalOk(c.lethal) ? c.lethal : 'frag'; };
  LO.classTactical = () => { const c = XH.classes && XH.classes.cur(); return c && c.tactical && c.tactical !== 'none' && LO.tacticalOk(c.tactical) ? c.tactical : null; };

  // ---------------- deployable turret ----------------
  LO.turrets = [];
  const TURRET_LIFE = 30, COST = 2;
  LO.charges = () => Math.floor(WP().state.grenades / COST);
  LO.deploy = () => {
    const S = WP().state, Pl = P(), Wd = W();
    if (S.grenades < COST || S.grenT > 0) { A.play('deny'); return; }
    const fx = -Math.sin(Pl.yaw), fz = -Math.cos(Pl.yaw);
    let x = Pl.pos.x + fx * 1.8, z = Pl.pos.z + fz * 1.8;
    const y = Wd.groundAt(x, z, 0.4, Pl.pos.y + 0.3);
    if (Wd.solidAt(x, z, 0.45, y) || Math.abs(y - Pl.pos.y) > 0.8) { x = Pl.pos.x; z = Pl.pos.z; if (Wd.solidAt(x, z, 0.3, Pl.pos.y)) { A.play('deny'); return; } }
    S.grenades -= COST; S.grenT = 0.6;
    const t = model(x, y, z, Pl.yaw + Math.PI);
    t.life = TURRET_LIFE; t.cd = 0; t.retarget = 0; t.target = null;
    LO.turrets.push(t);
    FX.dirt(new THREE.Vector3(x, y + 0.1, z), 10); A.play('build', { pos: t.pos }); A.play('slat', { pos: t.pos });
    XH.ui.weaponChanged(WP().cur());
    if (XH.ui.tip) XH.ui.tip('turret');
  };
  // a turret placed by something else (door Turret Nests): life in seconds, kills credited to `weapon`
  LO.place = (x, y, z, yaw, life, weapon) => {
    const t = model(x, y, z, yaw); t.life = life; t.cd = 0; t.retarget = 0; t.target = null; t.weapon = weapon || 'turret';
    LO.turrets.push(t); return t;
  };
  function model(x, y, z, yaw) {
    const g = new THREE.Group(); g.position.set(x, y, z); W().root.add(g);
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.7, roughness: 0.4 }), body = new THREE.MeshStandardMaterial({ color: 0x6a7a4a, metalness: 0.5, roughness: 0.45 });
    const add = (p, geo, mat, pos, scl, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scl); if (rot) m.rotation.set(...rot); p.add(m); return m; };
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8), box = new THREE.BoxGeometry(1, 1, 1);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; add(g, cyl, dark, [Math.cos(a) * 0.3, 0.35, Math.sin(a) * 0.3], [0.03, 0.8, 0.03], [Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45]); }
    add(g, cyl, dark, [0, 0.75, 0], [0.09, 0.2, 0.09]);
    const yawG = new THREE.Group(); yawG.position.y = 0.9; yawG.rotation.y = yaw; g.add(yawG);
    add(yawG, box, body, [0, 0.08, 0], [0.34, 0.24, 0.46]);
    for (const sx of [-0.08, 0.08]) add(yawG, cyl, dark, [sx, 0.06, 0.38], [0.03, 0.4, 0.03], [Math.PI / 2, 0, 0]);
    const led = add(yawG, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x30ff60 }), [0, 0.24, 0.05], [0.04, 0.04, 0.04]);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    return { g, yawG, led, ring, pos: new THREE.Vector3(x, y + 0.95, z) };
  }
  function target(t) {
    let best = null, bd = 16;
    for (const e of E().list) {
      if (e.dead || e.turned || e.state === 'burrowed' || e.state === 'emerge') continue;
      const c = e.center(), d = c.distanceTo(t.pos); if (d >= bd) continue;
      if (W().raycast(t.pos, c.clone().sub(t.pos).normalize(), d).t < d - 0.6) continue;
      best = e; bd = d;
    }
    return best;
  }
  LO.update = (dt) => {
    for (let i = LO.turrets.length - 1; i >= 0; i--) {
      const t = LO.turrets[i]; t.life -= dt; t.cd -= dt; t.retarget -= dt;
      t.ring.material.opacity = t.life < 5 ? (Math.sin(t.life * 12) > 0 ? 0.6 : 0.1) : 0.45;
      if (t.retarget <= 0) { t.retarget = 0.25; t.target = target(t); }
      const e = t.target && !t.target.dead ? t.target : null;
      t.led.material.color.setHex(e ? 0xff3020 : 0x30ff60);
      if (e) {
        const c = e.center(), want = Math.atan2(c.x - t.pos.x, c.z - t.pos.z);
        t.yawG.rotation.y += U.angDiff(t.yawG.rotation.y, want) * Math.min(1, dt * 9);
        if (Math.abs(U.angDiff(t.yawG.rotation.y, want)) < 0.2 && t.cd <= 0) {
          t.cd = 0.22;
          const muzzle = new THREE.Vector3(Math.sin(t.yawG.rotation.y) * 0.6, 0, Math.cos(t.yawG.rotation.y) * 0.6).add(t.pos);
          FX.tracer(muzzle, c, 0xffd070, 0.05); FX.flash(muzzle, 0xffc060, 1.5, 0.05, 5); A.play('smg', { pos: t.pos, vol: 0.45 });
          E().damage(e, 26 * E().hpMul(G().round), { kind: 'bullet', weapon: t.weapon || 'turret', point: c });
        }
      } else t.yawG.rotation.y += dt * 0.8;
      if (t.life <= 0) { FX.burst({ pos: t.pos, n: 12, color: 0x808890, speed: [1, 3], life: [0.3, 0.7], size: [0.2, 0.05], add: false }); A.play('slat', { pos: t.pos }); t.g.parent && t.g.parent.remove(t.g); LO.turrets.splice(i, 1); }
    }
  };
  LO.clear = () => { LO.turrets.length = 0; };
})();
