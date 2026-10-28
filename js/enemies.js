'use strict';
// Enemy species definitions, AI behaviors, damage/death, enemy projectiles and hazards.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, MON = XH.monsters;
  const E = XH.enemies = { list: [], boss: null };
  let scene;
  const W = () => XH.world, P = () => XH.player, G = () => XH.game;

  // =================== species ===================
  const T = E.TYPES = {
    skitterling: { name: 'Skitterling', hp: 100, speed: 6.4, radius: 0.45, cy: 0.6, dmg: 16, reach: 0.9, atkRange: 1.4, atkTime: 0.5, atkHit: 0.5, atkCd: 0.35, pts: 60, vocal: 'chitter', emerge: 0.7, leap: true, ichor: 0xb8e04a,
      threat: 1, desc: 'The swarm\'s endless foot soldiers. Skitterlings hunt in packs, close distance in terrifying leaps and shred armor with scythe forelimbs. Alone they are fragile. They are never alone.', tip: 'Aim for the head. Backpedal when one lunges, because the leap commits it.' },
    lancer: { name: 'Lancer', hp: 240, speed: 3.6, radius: 0.55, cy: 1.2, dmg: 22, reach: 1.2, atkRange: 1.9, atkTime: 0.8, atkHit: 0.55, atkCd: 0.6, pts: 90, vocal: 'hiss', emerge: 1.0, ichor: 0xc8e050,
      ranged: { range: [5, 20], cd: [2.6, 4.2], castT: 1.1, release: 0.7, kind: 'spine', n: 3, dmg: 13, err: 0.035 },
      threat: 2, desc: 'Serpentine artillery. The Lancer flares its bony cowl, rears back and hurls volleys of needle spines from chest launchers. Up close, its bone scythes are no less lethal.', tip: 'The cowl flare is your warning. Break line of sight or punish the wind-up.' },
    burster: { name: 'Burster', hp: 80, speed: 5.4, radius: 0.6, cy: 0.62, pts: 70, vocal: 'gurgle', emerge: 0.8, ichor: 0x9dff3a, explode: { r: 4.2, dmg: 55 },
      threat: 2, desc: 'A living bomb. A swollen sac of volatile acid carried on stubby legs, rolling toward prey and rupturing in a caustic blast. The acid does not discriminate. It melts the swarm too.', tip: 'Pop them early, ideally in the middle of a pack.' },
    shrieker: { name: 'Shrieker', hp: 170, speed: 5.6, radius: 0.6, cy: 0, fly: true, hover: 3.4, dmg: 14, reach: 1.3, atkRange: 2, atkTime: 0.6, atkHit: 0.5, atkCd: 1, pts: 100, vocal: 'shriek', emerge: 1.0, ichor: 0xc050a0,
      ranged: { range: [4, 20], cd: [1.8, 3.2], castT: 0.6, release: 0.5, kind: 'glaive', n: 1, dmg: 12, err: 0.05 },
      threat: 2, desc: 'Winged harriers that ride thermal currents above the battlefield, spitting ricocheting glaive-bolts. Low cover means nothing to a Shrieker.', tip: 'Look up. Their glaives curve, so strafe instead of just ducking.' },
    behemoth: { name: 'Behemoth', hp: 2600, speed: 2.7, radius: 1.5, cy: 2.0, dmg: 45, reach: 1.8, atkRange: 3.4, atkTime: 1.25, atkHit: 0.62, atkCd: 1.2, pts: 400, vocal: 'roar', emerge: 2.0, heavy: true, ichor: 0xd0c040,
      charge: { range: [8, 20], cd: [7, 10], speed: 12, dur: 1.7, dmg: 40 },
      threat: 4, desc: 'A walking siege engine sheathed in overlapping carapace. Its twin kaiser blades cleave through barricades and bone alike. When it lowers its head, get out of the way.', tip: 'Front plating shrugs off bullets. Flank it and hit the glowing nerve-sac on its back.' },
    broodmother: { name: 'Broodmother', hp: 1500, speed: 2.0, radius: 1.3, cy: 1.4, dmg: 24, reach: 1.3, atkRange: 2.4, atkTime: 0.9, atkHit: 0.55, atkCd: 1, pts: 350, vocal: 'wail', emerge: 1.8, ichor: 0xffa040,
      ranged: { range: [5, 18], cd: [3, 5], castT: 1.0, release: 0.6, kind: 'bile', n: 1, dmg: 16, err: 0.06 },
      eggs: { cd: [6, 9], n: 3 },
      threat: 3, desc: 'The hive\'s incubator. Her translucent sac is packed with gestating broodlings, which she launches in egg-pods that hatch on impact. She also spews caustic bile that pools on the ground.', tip: 'The egg sac is soft. Kill her fast, or the brood will bury you.' },
    broodling: { name: 'Broodling', hp: 40, speed: 7.2, radius: 0.3, cy: 0.25, dmg: 6, reach: 0.6, atkRange: 0.9, atkTime: 0.35, atkHit: 0.5, atkCd: 0.3, pts: 20, vocal: 'chitter', emerge: 0.2, minor: true, life: 22, ichor: 0xb8e04a,
      threat: 1, desc: 'Short-lived hatchlings with one purpose, which is to swarm. They wither away within half a minute of hatching.', tip: 'Splash damage. Or run. They will die on their own.' },
    burrower: { name: 'Burrower', hp: 650, speed: 4.8, radius: 1.0, cy: 0.7, dmg: 30, pts: 250, vocal: 'roar', emerge: 1.0, ichor: 0xd0c040, burrow: true,
      threat: 3, desc: 'An ambush predator that tunnels beneath the floor, invisible except for the churn of earth. It surfaces at range, anchors itself and drives lines of spine eruptions through the ground.', tip: 'Watch for moving dirt mounds. It is vulnerable only while surfaced. Sidestep the spine line.' },
    tyrant: { name: 'Hive Tyrant', hp: 16000, speed: 3.1, radius: 2.0, cy: 3.6, dmg: 55, reach: 2.4, atkRange: 4.6, atkTime: 1.2, atkHit: 0.62, atkCd: 1.1, pts: 3000, vocal: 'roar', emerge: 3.0, boss: true, heavy: true, ichor: 0xd060ff,
      threat: 5, desc: 'The apex of the Brood. A towering, crowned monstrosity that commands the swarm with a thought. It rains spines, sends shockwaves through the ground and summons its children to die for it.', tip: 'Shoot the glowing pustules. Jump the shockwave rings. Never stop moving.' },
  };
  E.ORDER = ['skitterling', 'lancer', 'burster', 'shrieker', 'broodling', 'broodmother', 'burrower', 'behemoth', 'tyrant'];

  // Variants (map-unique creatures and alternate bosses): a base species plus overrides and its own model.
  // The instance keeps the base type (so every species rule still applies); e.vid holds the variant id.
  E.addVariant = (id, base, over) => {
    T[id] = Object.assign({}, T[base], over, { base, vid: id });
    if (MON.addVariant) MON.addVariant(id, base, over.model || {});
  };
  // special abilities: E.MECH[name] = { tick(e, dt), damage(e, amt, o), death(e, o), hitPlayer(e, how) }
  E.MECH = {};
  const mechOf = (e) => e.def.mech && E.MECH[e.def.mech];
  E.onHitPlayer = (e, how) => { const m = e && e.def && mechOf(e); if (m && m.hitPlayer) m.hitPlayer(e, how); };
  E.hpMul = (r) => (r <= 10 ? 1 + (r - 1) * 0.24 : 3.16 * Math.pow(1.09, r - 10));

  // =================== spawn ===================
  E.init = (sc) => { scene = sc; };
  let uid = 0;
  E.spawn = (type, x, z, o = {}) => {
    const def = T[type], mods = G().mods || {}, vid = def.base ? type : null;
    if (vid) type = def.base;
    if (mods.elite && !def.minor && !def.boss) o.variant = 'elite';
    else if (mods.frenzy && type === 'skitterling') o.variant = 'frenzied';
    const inst = MON.create(vid || type, o.variant);
    const root = inst.root;
    root.position.set(x, def.fly ? 0.2 : -def.cy * 2 - 0.3, z);
    root.rotation.y = Math.atan2(P().pos.x - x, P().pos.z - z);
    scene.add(root);
    const r = G().round || 1;
    let hp = def.hp * (def.boss ? 1 + r * 0.12 : E.hpMul(r)) * (o.variant === 'elite' ? 2 : 1) * (o.hpMul || 1) * (mods.hp || 1);
    const e = {
      id: uid++, type, def, root, rig: inst.rig, mats: inst.mats, hit: inst.hit, parts: inst.parts, skeleton: inst.skeleton, bsY: inst.bsY, bsR: inst.bsR, pos: root.position, vel: new THREE.Vector3(),
      hp, maxHp: hp, radius: def.radius, fly: !!def.fly, state: 'emerge', t: 0, emergeT: 0, yaw: root.rotation.y,
      st: { t: 0, phase: Math.random() * 6, move: 0, atk: -1, cast: -1, seed: Math.random() * 10, spit: -1, rollSpeed: 0, fuse: 0 },
      atkCd: U.rand(0.2, 0.8), atkT: -1, castT: -1, castCd: U.rand(1, 3), eggCd: U.rand(3, 6), chargeCd: U.rand(3, 6), leapCd: U.rand(0.5, 2),
      stunT: 0, chill: 0, frozenT: 0, burnT: 0, flashT: 0, navT: 0, goal: new THREE.Vector3(x, 0, z), vocalT: U.rand(1, 5),
      speedMul: Math.min(1.3, 0.9 + r * 0.025) * (o.variant === 'frenzied' || (mods.frenzy && type === 'skitterling') ? 1.25 : 1) * (mods.speed || 1), dmgMul: 1 + Math.max(0, r - 10) * 0.03,
      variant: o.variant, vid, life: def.life || 0, stuckT: 0, lastPos: new THREE.Vector3(x, 0, z), lastPosT: 0,
      shadow: FX.shadow(def.radius * (def.fly ? 0.8 : 1)), bossAI: def.boss ? { t: 3, phase: 1, act: '', actT: 0, summoned: 0 } : null,
      burrowed: false, surfaceT: 0,
    };
    e.center = () => new THREE.Vector3(e.pos.x, def.fly ? e.pos.y : e.pos.y + def.cy, e.pos.z);
    if (XH.events) XH.events.onSpawn(e);
    e.vent = o.vent || null;
    if (e.vent && (def.heavy || def.boss) && e.vent.slats > 0) breakVent(e.vent);
    e.shadow.position.set(x, 0.03, z); scene.add(e.shadow);
    if (def.burrow) { e.burrowed = true; e.state = 'burrowed'; root.visible = false; e.mound = makeMound(); scene.add(e.mound); e.hopT = 0; }
    else { FX.dirt(new THREE.Vector3(x, 0.1, z), def.heavy ? 30 : 12); A.play('emerge', { pos: e.pos }); }
    if (def.boss) E.boss = e;
    E.list.push(e);
    root.updateMatrixWorld(true);
    return e;
  };
  function makeMound() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(U.jitter(new THREE.SphereGeometry(1.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0.3), new THREE.MeshStandardMaterial({ color: 0x3a2e28, roughness: 1, flatShading: true }));
    m.scale.set(1, 0.45, 1.3); g.add(m);
    return g;
  }
  // Fastest ground/air chase speed any creature can reach right now (round scaling, frenzy, difficulty slider, shrieker dives).
  E.topSpeed = () => {
    const r = G().round || 1, mods = G().mods || {}, rm = Math.min(1.3, 0.9 + r * 0.025) * (mods.speed || 1);
    let top = 0;
    for (const k in T) { const d = T[k]; top = Math.max(top, d.boss ? d.speed * 1.35 : d.speed * rm * (k === 'skitterling' ? 1.25 : k === 'shrieker' ? 1.4 : 1)); }
    return top;
  };
  E.aliveCount = () => { let n = 0; for (const e of E.list) if (!e.dead && !e.def.objective && !e.def.ally) n++; return n; };
  E.countType = (t) => { let n = 0; for (const e of E.list) if (!e.dead && e.type === t) n++; return n; };

  // =================== queries (used by weapons) ===================
  const _c = new THREE.Vector3(), _v = new THREE.Vector3();
  function updHit(e) { for (const h of e.hit) { h.wp.copy(h.off); h.node.localToWorld(h.wp); } }
  const targetable = (e) => !e.dead && e.state !== 'burrowed' && !e.turned;
  function breakVent(v) {
    if (!v || !v.slats) return;
    v.slats = 0;
    FX.burst({ pos: new THREE.Vector3(v.x, 0.3, v.z), n: 20, color: 0x777777, speed: [2, 7], up: 1, life: [0.4, 0.9], size: [0.15, 0.08], grav: 12, add: false });
    A.play('tear', { pos: new THREE.Vector3(v.x, 0, v.z) });
  }
  E.breakVent = breakVent;
  // Explosive damage can blow the legs off smaller creatures: they keep coming, crawling.
  function makeCrawler(e) {
    e.crawler = true; e.speedMul *= 0.35; e.leapCd = 1e9;
    const R = e.rig;
    if (e.type === 'skitterling') { if (R.hL0) R.hL0.visible = false; if (R.hR0) R.hR0.visible = false; }
    if (e.type === 'lancer') { if (R.tl3) R.tl3.visible = false; }
    FX.ichor(e.center(), new THREE.Vector3(0, 1, 0), e.def.ichor, 2);
    A.play('screech', { pos: e.pos });
  }
  E.turn = (e, secs) => {
    if (e.dead || e.def.boss || e.def.heavy || e.fly || e.def.burrow) return false;
    e.turned = secs; e.atkT = -1; e.castT = -1; e.st.cast = -1;
    for (const m of e.mats) { m.userData.base = 0x0a7018; m.emissive.setHex(0x0a7018); }
    FX.burst({ pos: e.center(), n: 20, color: 0x70ff70, speed: [1, 4], life: [0.3, 0.7], size: [0.3, 0.05] });
    return true;
  };
  E.rayHits = (o, d, maxT, pierce) => {
    const res = [];
    for (const e of E.list) {
      if (!targetable(e)) continue;
      const c = e.center(); _v.subVectors(c, o);
      const tc = _v.dot(d); const reach = e.radius + 3;
      if (tc < -reach || tc > maxT + reach) continue;
      if (_v.lengthSq() - tc * tc > reach * reach) continue;
      updHit(e);
      let best = null;
      for (const h of e.hit) {
        _v.subVectors(h.wp, o);
        const t = _v.dot(d), d2 = _v.lengthSq() - t * t;
        if (d2 > h.r * h.r) continue;
        const t0 = t - Math.sqrt(h.r * h.r - d2);
        if (t0 < 0 || t0 > maxT) continue;
        if (!best || t0 < best.t - 0.25 || (h.mult > best.mult && t0 < best.t + 0.3)) best = { e, t: t0, mult: h.mult };
      }
      if (best) { best.point = o.clone().addScaledVector(d, best.t); res.push(best); }
    }
    res.sort((a, b) => a.t - b.t);
    return res.slice(0, pierce);
  };
  E.sphereHit = (p, r) => {
    for (const e of E.list) {
      if (!targetable(e)) continue;
      if (e.center().distanceToSquared(p) > (e.radius + 3 + r) ** 2) continue;
      updHit(e);
      for (const h of e.hit) if (h.wp.distanceToSquared(p) < (h.r + r) ** 2) return e;
    }
    return null;
  };
  E.nearest = (p, r, filter) => {
    let best = null, bd = r * r;
    for (const e of E.list) {
      if (!targetable(e) || (filter && !filter(e))) continue;
      const d = e.center().distanceToSquared(p);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  E.forCone = (o, dir, range, cone, fn) => {
    const cc = Math.cos(cone);
    for (const e of E.list) {
      if (!targetable(e)) continue;
      const c = e.center(); _v.subVectors(c, o);
      const dist = _v.length();
      if (dist > range + e.radius) continue;
      if (dist > 1.5 && _v.dot(dir) / dist < cc - e.radius / dist * 0.5) continue;
      const w = W().raycast(o, _v.normalize(), dist);
      if (w.t < dist - e.radius - 0.2) continue;
      fn(e, dist);
    }
  };
  E.meleeTarget = (o, dir, range) => {
    let best = null, bd = 1e9;
    for (const e of E.list) {
      if (!targetable(e)) continue;
      const c = e.center(); _v.subVectors(c, o); _v.y *= 0.5;
      const dist = _v.length() - e.radius;
      if (dist > range) continue;
      if (_v.normalize().dot(dir) < 0.45) continue;
      if (dist < bd) { bd = dist; best = e; }
    }
    return best;
  };
  E.radiusDamage = (p, r, dmg, o = {}) => {
    for (const e of E.list.slice()) {
      if (!targetable(e)) continue;
      const c = e.center(), d = Math.max(0, c.distanceTo(p) - e.radius * 0.6);
      if (d >= r) continue;
      const k = 1 - (d / r) * 0.65;
      E.damage(e, dmg * k, Object.assign({ point: c, dir: c.clone().sub(p).normalize() }, o));
    }
  };
  E.pullToward = (p, R, dt, k) => {
    for (const e of E.list.slice()) {
      if (!targetable(e)) continue;
      const c = e.center(), d = c.distanceTo(p);
      if (d > R) continue;
      const pull = (1 - d / R) * 9 * k;
      _v.subVectors(p, c).setY(0).normalize();
      e.pos.x += _v.x * pull * dt; e.pos.z += _v.z * pull * dt;
      e.stunT = Math.max(e.stunT, 0.2);
      const dps = e.def.boss ? 1400 : e.maxHp * 1.6 + 200;
      E.damage(e, dps * dt * k, { kind: 'void', quiet: true, weapon: 'void' });
      if (!e.dead && d < 1.2 && !e.def.boss) E.damage(e, e.hp + 1, { kind: 'void', weapon: 'void' });
    }
  };
  E.killAll = (o) => { for (const e of E.list.slice()) if (!e.dead && !e.def.boss && !(e.burrowed && e.state === 'burrowed' && false)) E.damage(e, e.hp + 1, Object.assign({ kind: 'nuke', noPoints: true }, o)); };

  // =================== damage & death ===================
  E.damage = (e, amt, o = {}) => {
    if (e.dead) return false;
    if (e.burrowed && e.state === 'burrowed' && o.kind !== 'nuke') return false;
    amt *= o.mult || 1;
    if (XH.weapons.hitMod) amt = XH.weapons.hitMod(e, amt, o);
    const mh = mechOf(e); if (mh && mh.damage) amt = mh.damage(e, amt, o);
    if (E.auraMod) amt = E.auraMod(e, amt, o);
    if (!(amt > 0)) return false;
    if (e.frozenT > 0) amt *= 1.5;
    if (e.variant === 'elite') amt *= 0.85;
    if (G().insta > 0 && !e.def.boss) amt = e.hp + 1;
    const st = G().stats;
    if (st && !o.noPoints && o.weapon !== 'turret') {
      st.dmg += Math.max(0, Math.min(amt, e.hp));
      const WS = XH.weapons.state; if (o.kind === 'bullet' && WS.shotSerial && WS.shotSerial !== st.hitSerial) { st.hitSerial = WS.shotSerial; st.hits++; if (o.weapon) { const wh = st.wh || (st.wh = {}); wh[o.weapon] = (wh[o.weapon] || 0) + 1; } }
    }
    e.hp -= amt;
    e.flashT = 0.07; e.lastHitT = e.t;
    if (e.hp > 0 && !e.crawler && o.kind === 'explosive' && (e.type === 'skitterling' || e.type === 'lancer') && e.hp < e.maxHp * 0.55 && Math.random() < 0.6) makeCrawler(e);
    if (o.kind !== 'fire' && o.kind !== 'void') e.flinch = Math.min(1, (e.flinch || 0) + 0.35 + (amt / e.maxHp) * 2);
    if (o.burn) { e.burnT = 3; e.burnDps = Math.max(e.burnDps || 0, 35 * E.hpMul(G().round)); }
    if (o.freeze) { e.chill = Math.min(1.3, e.chill + o.freeze); if (e.chill >= 1 && e.frozenT <= 0) { e.frozenT = 2.5; A.play('cryo', { pos: e.pos, vol: 0.6 }); } }
    if (o.stun) e.stunT = Math.max(e.stunT, o.stun * (e.def.heavy ? 0.3 : 1));
    if (o.point && o.kind !== 'fire' && !o.quiet) {
      FX.ichor(o.point, o.dir ? o.dir.clone().negate().add(new THREE.Vector3(0, 0.5, 0)) : null, e.def.ichor, e.def.heavy ? 1.5 : 1);
      if ((o.mult || 1) < 0.9) A.play('armor', { pos: o.point });
    }
    if (!o.quiet && !o.noPoints) G().onHit(e, o);
    if (e.hp <= 0) { kill(e, o); return true; }
    if (!(e.painT > e.t) && o.kind !== 'fire') { e.painT = e.t + (e.def.heavy ? 1.1 : 0.45); A.creature(e.type, 'pain', { pos: e.pos }); }
    return false;
  };
  function kill(e, o) {
    e.dead = true; e.state = 'dead'; e.deathT = 0; e.st.atk = -1; e.st.cast = -1;
    const c = e.center();
    const mh = mechOf(e); if (mh && mh.death) mh.death(e, o);
    G().onKill(e, o);
    A.play('kill', { pos: c }); A.creature(e.type, 'death', { pos: c });
    const big = o.kind === 'explosive' || o.kind === 'void' || o.kind === 'nuke' || (G().insta > 0 && Math.random() < 0.5);
    if (e.frozenT > 0) { FX.shatter(c); removeEnemy(e); return; }
    if (G().mods && G().mods.acid && e.type !== 'burster' && o.kind !== 'nuke') { addPool(e.pos.clone().setY(0), 1.3 + e.radius * 0.6, 4, 12); FX.burst({ pos: c, n: 8, color: 0x9dff3a, speed: [1, 3], up: 1, life: [0.3, 0.6], size: [0.2, 0.05] }); }
    if (e.type === 'burster') { burst(e, true); removeEnemy(e); return; }
    if (o.kind === 'void') { FX.burst({ pos: c, n: 30, color: 0xb040ff, speed: [1, 4], life: [0.2, 0.5], size: [0.3, 0.05] }); removeEnemy(e); return; }
    FX.decal(e.pos, e.def.ichor === 0xd060ff || e.def.ichor === 0xc050a0 ? 'purple' : 'ichor', e.radius * 1.6);
    if (big && !e.def.heavy) {
      FX.ichor(c, new THREE.Vector3(0, 1, 0), e.def.ichor, 3);
      FX.burst({ pos: c, n: 14, color: 0x3a2240, color2: 0x8e2c48, speed: [3, 8], up: 1, life: [0.6, 1.2], size: [0.2, 0.15], grav: 14, add: false });
      A.play('gib', { pos: c });
      removeEnemy(e); return;
    }
    FX.ichor(c, new THREE.Vector3(0, 1, 0), e.def.ichor, e.def.heavy ? 3 : 1.5);
    if (e.def.boss) { FX.explosion(c, 6, 0xd060ff); FX.shake(1); A.play('roar', { pos: c, big: true }); }
    e.deathSide = Math.random() < 0.5 ? -1 : 1;
    // fall away from the shot, and slide with it
    const Pl = P(), dir = o.dir ? new THREE.Vector3(o.dir.x, 0, o.dir.z) : new THREE.Vector3(e.pos.x - Pl.pos.x, 0, e.pos.z - Pl.pos.z);
    if (dir.lengthSq() > 1e-6 && !e.fly) {
      dir.normalize();
      const fwd = Math.sin(e.yaw) * dir.x + Math.cos(e.yaw) * dir.z, side = Math.cos(e.yaw) * dir.x - Math.sin(e.yaw) * dir.z;
      e.root.rotation.order = 'YXZ'; e.deathRX = fwd * 1.25; e.deathRZ = -side * 1.25;
      if (Math.abs(fwd) + Math.abs(side) < 0.4) e.deathRZ = 1.25 * e.deathSide;
      const push = (o.kind === 'explosive' ? 7 : o.pellets || o.kind === 'melee' ? 4.5 : 3) * (e.def.heavy ? 0.25 : 1) * (o.mult >= 2 ? 1.2 : 1);
      e.deathVel = dir.multiplyScalar(push);
    }
    // headshot kills pop
    if (o.mult >= 2 && !e.def.heavy && !e.def.boss) { const h = headPos(e, 0.1); FX.ichor(h, new THREE.Vector3(0, 1, 0), e.def.ichor, 2.2); FX.burst({ pos: h, n: 10, color: 0xe8d8b0, speed: [2, 5], up: 1, life: [0.4, 0.8], size: [0.07, 0.03], grav: 14, add: false }); A.play('splat', { pos: h, vol: 0.8 }); }
    // hit-stop: a split-second freeze on the kills that matter
    const rt = performance.now(); E.kb = rt - (E.kbT || 0) < 120 ? (E.kb || 0) + 1 : 1; E.kbT = rt;
    const M = XH.main; if (M && !o.p2) { const hs = e.def.boss ? 0.14 : e.def.heavy ? 0.06 : E.kb === 3 ? 0.05 : 0; if (hs) M.hitstop = Math.max(M.hitstop || 0, hs); }
  }
  function removeEnemy(e) {
    scene.remove(e.root); scene.remove(e.shadow);
    if (e.mound) scene.remove(e.mound);
    e.mats.forEach((m) => m.dispose());
    if (e.skeleton) e.skeleton.dispose();
    e.removed = true;
    if (E.boss === e) E.boss = null;
    const i = E.list.indexOf(e); if (i >= 0) E.list.splice(i, 1);
  }
  E.clear = () => { for (const e of E.list.slice()) removeEnemy(e); E.list.length = 0; E.boss = null; clearProj(); };

  function burst(e, killed) {
    const c = e.center(), def = e.def.explode;
    FX.acidBurst(c, def.r);
    A.play('acidburst', { pos: c });
    FX.decal(e.pos, 'ichor', 2.5);
    addPool(e.pos.clone(), 2.2, 5, 16);
    const Pl = P(), d = Pl.pos.distanceTo(new THREE.Vector3(c.x, Pl.pos.y, c.z));
    if (d < def.r) Pl.hurt(def.dmg * (1 - d / def.r * 0.6) * e.dmgMul, c);
    for (const o of E.list.slice()) {
      if (o === e || o.dead) continue;
      const dd = o.center().distanceTo(c);
      if (dd < def.r) E.damage(o, 260 * E.hpMul(G().round) * (1 - dd / def.r * 0.5), { kind: 'explosive', point: o.center(), weapon: 'burster', noPoints: !killed });
    }
  }

  // =================== enemy projectiles & hazards ===================
  const proj = [], pools = [], quakes = [], rings = [];
  function clearProj() {
    for (const p of proj) scene.remove(p.mesh); proj.length = 0;
    for (const p of pools) scene.remove(p.mesh); pools.length = 0;
    for (const q of quakes) q.spikes.forEach((s) => scene.remove(s.m)); quakes.length = 0;
    for (const r of rings) scene.remove(r.mesh); rings.length = 0;
  }
  const spineGeo = (() => { const g = new THREE.ConeGeometry(0.06, 0.7, 5); g.rotateX(Math.PI / 2); g.userData.keep = true; return g; })();
  const spineMat = new THREE.MeshStandardMaterial({ color: 0xe8d8b0, emissive: 0x302010, roughness: 0.4 });
  function shoot(kind, from, to, e) {
    let mesh, vel, grav = 0, dmg = (e ? e.def.ranged ? e.def.ranged.dmg : 15 : 15) * (e ? e.dmgMul : 1), home = 0, r = 0.5;
    const dir = to.clone().sub(from).normalize();
    if (kind === 'spine') { mesh = new THREE.Mesh(spineGeo, spineMat); vel = dir.multiplyScalar(28); A.play('spit', { pos: from }); }
    else if (kind === 'glaive') { mesh = FX.glowSprite(0xa0ff40, 0.9, 1); vel = dir.multiplyScalar(15); home = 0.8; A.play('spit', { pos: from, vol: 0.7 }); }
    else if (kind === 'bile' || kind === 'egg' || kind === 'rain') {
      mesh = kind === 'egg' ? new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd08040, emissive: 0x602008, transparent: true, opacity: 0.9 })) : FX.glowSprite(0x9dff3a, 0.9, 1);
      grav = 14;
      const flat = to.clone().sub(from); const h = flat.y; flat.y = 0; const dist = flat.length();
      const tFlight = U.clamp(dist / 14, 0.6, 1.6);
      vel = flat.divideScalar(tFlight); vel.y = (h + 0.5 * grav * tFlight * tFlight) / tFlight;
      if (kind === 'rain') { vel.set(0, -22, 0); grav = 0; }
      A.play('spit', { pos: from });
    }
    mesh.position.copy(from);
    if (kind === 'spine') mesh.lookAt(from.clone().add(vel));
    scene.add(mesh);
    proj.push({ kind, mesh, pos: from.clone(), vel, grav, dmg, home, r, life: 0, owner: e });
  }
  E.shoot = shoot;
  const _pc = new THREE.Vector3();
  function playerHit(p, r) {
    const Pl = P(), px = Pl.pos.x, pz = Pl.pos.z;
    const y = U.clamp(p.y, Pl.pos.y + 0.2, Pl.pos.y + Pl.eyeH);
    const dx = p.x - px, dy = p.y - y, dz = p.z - pz;
    return dx * dx + dy * dy + dz * dz < (0.45 + r) ** 2;
  }
  function updProj(dt) {
    const Pl = P();
    for (let i = proj.length - 1; i >= 0; i--) {
      const p = proj[i]; p.life += dt;
      if (p.home && p.life < 1.1) {
        const tgt = _pc.copy(Pl.pos).setY(Pl.pos.y + Pl.eyeH - 0.4).sub(p.pos).normalize().multiplyScalar(p.vel.length());
        p.vel.lerp(tgt, Math.min(1, p.home * dt));
      }
      p.vel.y -= p.grav * dt;
      const step = p.vel.clone().multiplyScalar(dt), len = step.length();
      const hit = W().raycast(p.pos, step.clone().normalize(), len);
      let done = false, hitPlayer = false;
      if (hit.kind !== 'none' && hit.t < len) { p.pos.addScaledVector(step.normalize(), hit.t); done = true; }
      else p.pos.add(step);
      if (!done && playerHit(p.pos, p.r * 0.5)) { done = true; hitPlayer = true; }
      if (p.life > 6) done = true;
      p.mesh.position.copy(p.pos);
      if (p.kind === 'spine') p.mesh.lookAt(p.pos.clone().add(p.vel));
      if (p.kind === 'glaive') { p.mesh.material.rotation += dt * 15; if (Math.random() < 0.6) FX.one(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.25, 0.3, 0.05, 0xa0ff40); }
      if (p.kind === 'bile' && Math.random() < 0.6) FX.one(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.3, 0.3, 0.05, 0x9dff3a);
      if (p.kind === 'rain') FX.one(p.pos.x, p.pos.y, p.pos.z, 0, 2, 0, 0.3, 0.4, 0.05, 0x9dff3a);
      if (done) {
        scene.remove(p.mesh); proj.splice(i, 1);
        if (hitPlayer && p.kind !== 'egg') { Pl.hurt(p.dmg, p.owner ? p.owner.pos : p.pos); E.onHitPlayer(p.owner, 'proj'); }
        if (p.kind === 'spine') FX.burst({ pos: p.pos, n: 5, color: 0xe8d8b0, speed: [1, 3], life: [0.3, 0.6], size: [0.06, 0.03], grav: 10, add: false });
        else if (p.kind === 'glaive') FX.burst({ pos: p.pos, n: 10, color: 0xa0ff40, speed: [1, 4], life: [0.2, 0.4], size: [0.2, 0.05] });
        else if (p.kind === 'bile' || p.kind === 'rain') {
          const gp = p.pos.clone(); gp.y = 0;
          FX.acidBurst(p.pos, 1.5); A.play('acid', { pos: p.pos });
          addPool(gp, p.kind === 'rain' ? 1.8 : 2.4, 6, p.kind === 'rain' ? 14 : 18);
          const d = Pl.pos.distanceTo(gp); if (d < 2.2 && !hitPlayer) Pl.hurt(p.dmg * 0.6, gp);
        } else if (p.kind === 'egg') {
          const gp = p.pos.clone(); gp.y = 0;
          hatchAt(gp, p.owner);
        }
      }
    }
  }
  function hatchAt(pos, owner) {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd08040, emissive: 0x602008 }));
    egg.position.copy(pos).setY(0.3); egg.scale.set(1, 1.3, 1); scene.add(egg);
    let t = 0;
    hatchers.push((dt) => {
      t += dt; const s = 1 + Math.sin(t * 20) * 0.08 * t;
      egg.scale.set(s, 1.3 * s, s);
      if (t > 0.9) {
        scene.remove(egg);
        FX.ichor(pos.clone().setY(0.3), new THREE.Vector3(0, 1, 0), 0xffa040, 2); A.play('hatch', { pos });
        const n = owner ? owner.def.eggs.n : 3;
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2, x = pos.x + Math.cos(a) * 0.6, z = pos.z + Math.sin(a) * 0.6;
          if (W().blockedAt(x, z, 1)) continue;
          const b = E.spawn('broodling', x, z); b.state = 'act'; b.pos.y = W().floorAt(x, z);
        }
        return true;
      }
      return false;
    });
  }
  const hatchers = [];
  const poolMat = new THREE.MeshBasicMaterial({ color: 0x7dff2a, transparent: true, opacity: 0.55, map: null, depthWrite: false, blending: THREE.AdditiveBlending });
  function addPool(pos, r, dur, dps, color, kind = 'acid') {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), poolMat.clone());
    if (color) m.material.color.setHex(color);
    m.material.map = FX.softTex; m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.04, pos.z); m.renderOrder = 3;
    scene.add(m);
    pools.push({ pos: pos.clone().setY(0), r, t: 0, dur, dps, mesh: m, kind });
  }
  E.addPool = addPool;
  let poolTick = 0;
  function updPools(dt) {
    const Pl = P(); poolTick -= dt;
    let inPool = null;
    for (let i = pools.length - 1; i >= 0; i--) {
      const p = pools[i]; p.t += dt;
      const k = p.t < 0.3 ? p.t / 0.3 : p.t > p.dur - 1 ? Math.max(0, p.dur - p.t) : 1;
      p.mesh.material.opacity = 0.5 * k; p.mesh.scale.setScalar(0.6 + 0.4 * Math.min(1, p.t / 0.3));
      if (Math.random() < 0.25) FX.one(p.pos.x + U.rand(-p.r, p.r) * 0.7, 0.05, p.pos.z + U.rand(-p.r, p.r) * 0.7, 0, 0.7, 0, 0.6, 0.12, 0.25, 0x9dff3a, 0.7);
      if (Pl.pos.y < 0.3 && Math.hypot(Pl.pos.x - p.pos.x, Pl.pos.z - p.pos.z) < p.r * 0.85) inPool = p;
      if (p.t >= p.dur) { scene.remove(p.mesh); pools.splice(i, 1); }
    }
    if (inPool && XH.uniques && XH.uniques.immune(inPool.kind)) inPool = null;
    if (inPool && poolTick <= 0) { poolTick = 0.25; Pl.hurt(inPool.dps * 0.25, inPool.pos, false, true); A.play('acid', { vol: 0.5 }); }
  }
  // spine eruption line (Burrower)
  const spikeGeo = (() => { const g = new THREE.ConeGeometry(0.28, 1.8, 5); g.translate(0, 0.9, 0); g.userData.keep = true; return g; })();
  function quake(from, dir, dmg) {
    quakes.push({ pos: from.clone().setY(0), dir: dir.clone().setY(0).normalize(), dist: 0, spikes: [], hitDone: false, nextAt: 0.8, dmg, dead: false });
    A.play('burrow', { pos: from });
  }
  function updQuakes(dt) {
    const Pl = P();
    for (let i = quakes.length - 1; i >= 0; i--) {
      const q = quakes[i];
      if (!q.dead) {
        q.dist += 15 * dt;
        while (q.nextAt <= q.dist && !q.dead) {
          const p = q.pos.clone().addScaledVector(q.dir, q.nextAt);
          if (W().blockedAt(p.x, p.z, 0) || q.nextAt > 20) { q.dead = true; break; }
          const m = new THREE.Mesh(spikeGeo, spineMat); m.position.copy(p); m.rotation.set(U.rand(-0.3, 0.3), U.rand(0, 6), U.rand(-0.3, 0.3)); m.scale.set(1, 0.01, 1);
          scene.add(m); q.spikes.push({ m, t: 0 });
          FX.dirt(p, 5);
          if (q.spikes.length % 3 === 0) A.play('spike', { pos: p });
          if (!q.hitDone && Pl.pos.y < 1.2 && Math.hypot(Pl.pos.x - p.x, Pl.pos.z - p.z) < 1.2) { q.hitDone = true; Pl.hurt(q.dmg, p); Pl.knock(q.dir, 4); }
          q.nextAt += 0.75;
        }
      }
      let alive = false;
      for (const s of q.spikes) {
        s.t += dt;
        const k = s.t < 0.1 ? s.t / 0.1 : s.t < 0.6 ? 1 : Math.max(0, 1 - (s.t - 0.6) / 0.4);
        s.m.scale.set(1, Math.max(0.01, k), 1);
        if (k > 0) alive = true; else if (s.m.parent) scene.remove(s.m);
      }
      if (q.dead && !alive) { q.spikes.forEach((s) => scene.remove(s.m)); quakes.splice(i, 1); }
    }
  }
  // shockwave ring (Tyrant slam) — jump over it!
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd060ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  function shockwave(pos, maxR, dmg) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), ringMat.clone()); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.15, pos.z); scene.add(m);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.9, 48, 1, true), ringMat.clone()); wall.position.set(pos.x, 0.45, pos.z); wall.material.opacity = 0.35; scene.add(wall);
    rings.push({ mesh: m, wall, pos: pos.clone(), r: 0.5, maxR, dmg, hit: false });
    FX.shake(0.8); A.play('slam', { pos });
    FX.dirt(pos, 40);
  }
  function updRings(dt) {
    const Pl = P();
    for (let i = rings.length - 1; i >= 0; i--) {
      const R = rings[i]; const prev = R.r; R.r += 11 * dt;
      R.mesh.scale.setScalar(R.r); R.wall.scale.set(R.r, 1, R.r);
      const k = 1 - R.r / R.maxR; R.mesh.material.opacity = 0.8 * k; R.wall.material.opacity = 0.35 * k;
      const d = Math.hypot(Pl.pos.x - R.pos.x, Pl.pos.z - R.pos.z);
      if (!R.hit && d > prev - 0.4 && d < R.r + 0.4 && Pl.pos.y < 0.6) { R.hit = true; Pl.hurt(R.dmg, R.pos); Pl.knock(new THREE.Vector3(Pl.pos.x - R.pos.x, 0, Pl.pos.z - R.pos.z).normalize(), 7); }
      if (R.r >= R.maxR) { scene.remove(R.mesh); scene.remove(R.wall); rings.splice(i, 1); }
    }
  }

  // =================== AI ===================
  const _dir = new THREE.Vector3(), _des = new THREE.Vector3(), _tmp = new THREE.Vector3();
  function distracted(e) { return !e.def.boss && (G().buffs.ghost > 0 || (XH.weapons.lure && e.pos.distanceTo(XH.weapons.lure.pos) < 35)); }
  function losTo(e, fromY) {
    if (distracted(e)) return false;
    const Pl = P(), o = new THREE.Vector3(e.pos.x, fromY, e.pos.z), tgt = new THREE.Vector3(Pl.pos.x, Pl.pos.y + Pl.eyeH - 0.2, Pl.pos.z);
    const d = tgt.clone().sub(o), len = d.length();
    return W().raycast(o, d.normalize(), len).t >= len - 0.3;
  }
  function steer(e, dt, speed, opts = {}) {
    const Pl = P(), who = e.fly ? 2 : 1;
    const dx = Pl.pos.x - e.pos.x, dz = Pl.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
    // Lure Beacon pulls everything nearby; Phase Shift leaves them wandering
    if (!opts.goal && !e.def.boss) {
      const lure = XH.weapons.lure;
      if (lure && e.pos.distanceTo(lure.pos) < 35) opts = Object.assign({}, opts, { goal: lure.pos, stop: lure.kind === 'decoy' ? 1.1 : 0 });
      else if (G().buffs.ghost > 0) {
        if (!e.wander || e.wanderT < e.t) { e.wanderT = e.t + U.rand(1.5, 3); e.wander = new THREE.Vector3(e.pos.x + U.rand(-8, 8), 0, e.pos.z + U.rand(-8, 8)); }
        opts = Object.assign({}, opts, { goal: e.wander, stop: 0 });
      }
    }
    e.navT -= dt;
    if (e.via && !e.fly && !opts.goal) { // heading for a ladder or the stairs
      const v = e.via, Wd = W();
      if (e.onStairs) e.goal.set(v.x, 0, v.z);
      else if (e.navT <= 0) { e.navT = 0.2; if (Wd.clearLine(e.pos.x, e.pos.z, v.x, v.z, e.radius * 0.85, 1)) e.goal.set(v.x, 0, v.z); else if (!Wd.flowTargetField(e.pos.x, e.pos.z, e.radius, Wd.fieldTo(Wd.cellX(v.x), Wd.cellZ(v.z)), e.goal)) e.goal.set(v.x, 0, v.z); }
    } else if (e.navT <= 0) {
      e.navT = 0.18 + Math.random() * 0.14;
      const direct = dist < 22 && W().clearLine(e.pos.x, e.pos.z, Pl.pos.x, Pl.pos.z, e.radius * 0.85, who);
      if (opts.goal) e.goal.copy(opts.goal);
      else if (direct) e.goal.set(Pl.pos.x, 0, Pl.pos.z);
      else if (!W().flowTarget(e.pos.x, e.pos.z, e.radius, e.fly, e.goal)) e.goal.set(Pl.pos.x, 0, Pl.pos.z);
      if (opts.goal && !W().clearLine(e.pos.x, e.pos.z, opts.goal.x, opts.goal.z, e.radius * 0.85, who)) W().flowTarget(e.pos.x, e.pos.z, e.radius, e.fly, e.goal);
    }
    _des.set(e.goal.x - e.pos.x, 0, e.goal.z - e.pos.z);
    const gl = _des.length();
    if (gl > 0.05) _des.multiplyScalar(speed / gl); else _des.set(0, 0, 0);
    if (opts.stop && dist < opts.stop) _des.multiplyScalar(0);
    if (e.wait) _des.multiplyScalar(0); // queuing for the ladder
    if (opts.orbit) { _tmp.set(-dz, 0, dx).normalize().multiplyScalar(speed * opts.orbit); _des.add(_tmp); }
    // separation
    for (const o of E.list) {
      if (o === e || o.dead || o.burrowed || o.fly !== e.fly) continue;
      const sx = e.pos.x - o.pos.x, sz = e.pos.z - o.pos.z, rr = e.radius + o.radius, d2 = sx * sx + sz * sz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), f = (rr - d) / rr * speed * 1.6 * (o.def.heavy && !e.def.heavy ? 2 : 1); _des.x += sx / d * f; _des.z += sz / d * f; }
    }
    const acc = e.def.heavy ? 4 : 9;
    e.vel.x = U.damp(e.vel.x, _des.x, acc, dt); e.vel.z = U.damp(e.vel.z, _des.z, acc, dt);
    return dist;
  }
  function integrate(e, dt, noCollidePlayer) {
    if (e.climb) { climbTick(e, dt); return; }
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
    W().collide(e.pos, e.radius * 0.8, e.fly ? 2 : 1);
    if (!e.fly && e.state === 'act') groundTick(e, dt);
    if (!noCollidePlayer) {
      const Pl = P(), dx = e.pos.x - Pl.pos.x, dz = e.pos.z - Pl.pos.z, d = Math.hypot(dx, dz), m = e.radius + 0.35;
      if (d < m && d > 0.01 && Math.abs(e.pos.y - Pl.pos.y - (e.fly ? 1 : 0)) < 1.5) { e.pos.x += dx / d * (m - d); e.pos.z += dz / d * (m - d); }
    }
  }
  // Ground creatures stand on crates and cover like the player does, fall off edges, and climb up after you.
  function groundTick(e, dt) {
    if (e.floatT > e.t) { e.pos.y = U.damp(e.pos.y, 2.3, 5, dt); e.vy = 0; e.root.rotation.z = Math.sin(e.t * 3) * 0.3; return; } // Moon Driver
    if (e.root.rotation.z) e.root.rotation.z = 0;
    const Wd = W(), floor = Wd.groundAt(e.pos.x, e.pos.z, e.radius * 0.4, e.pos.y);
    if (e.pos.y > floor + 0.01) { e.vy = (e.vy || 0) - 22 * dt; e.pos.y = Math.max(floor, e.pos.y + e.vy * dt); }
    else { e.pos.y = floor; e.vy = 0; }
    const Pl = P();
    if (e.def.boss || e.crawler) return;
    // the player is up on a building or platform: go round to its ladder or stairs
    const S = Pl.onStruct;
    if (S && S.access && S.access.length && e.pos.y < S.topY - 0.5) { accessTick(e, S); return; }
    if (e.via) { e.via = null; e.viaA = null; e.onStairs = false; e.wait = false; }
    if (Pl.pos.y < e.pos.y + 0.6) return;
    const dx = Pl.pos.x - e.pos.x, dz = Pl.pos.z - e.pos.z, d = Math.hypot(dx, dz);
    if (d > 7 || d < 0.2) return;
    const t = Wd.mantleTarget(e.pos.x, e.pos.z, dx / d, dz / d, e.pos.y, e.radius * 0.7, 3.4, 1);
    if (t) e.climb = { t: 0, dur: (0.35 + (t.y - e.pos.y) * 0.2) * (e.def.heavy ? 1.6 : 1), x0: e.pos.x, z0: e.pos.z, y0: e.pos.y, x1: t.x, z1: t.z, y1: t.y };
  }
  // ladders take one creature at a time; the rest queue at the foot
  function accessTick(e, S) {
    let a = e.viaA && S.access.includes(e.viaA) ? e.viaA : null;
    if (!a) { let bd = 1e9; for (const q of S.access) { const d = Math.hypot(q.base.x - e.pos.x, q.base.z - e.pos.z); if (d < bd) { bd = d; a = q; } } e.viaA = a; e.onStairs = false; }
    const d = Math.hypot(a.base.x - e.pos.x, a.base.z - e.pos.z);
    e.wait = false;
    // no way to get there (a closed door): just chase as usual
    const Wd = W(); if (d > 2 && Wd.fieldTo(Wd.cellX(a.base.x), Wd.cellZ(a.base.z))[Wd.cellZ(e.pos.z) * Wd.w + Wd.cellX(e.pos.x)] > 1e8) { e.via = null; return; }
    if (a.kind === 'stairs') { if (d < 1.4) e.onStairs = true; e.via = e.onStairs ? a.top : a.base; return; }
    const L = a.L; e.via = a.base;
    if (L.busy && (L.busy.dead || L.busy.climbL !== L)) L.busy = null;
    if (d < 1.1) {
      if (!L.busy) {
        L.busy = e; e.climbL = L;
        const w = L.wall, foot = new THREE.Vector3(w.x + w.dx * (0.45 + e.radius * 0.6), 0, w.z + w.dz * (0.45 + e.radius * 0.6));
        e.climb = { path: [e.pos.clone(), foot, foot.clone().setY(L.h - 0.9), new THREE.Vector3(w.x - w.dx * 0.2, L.h + 0.05, w.z - w.dz * 0.2), L.top.clone().setY(L.h)], seg: 0, t: 0, speed: e.def.heavy ? 1.3 : 2.1, face: Math.atan2(-w.dx, -w.dz), done: () => { L.busy = null; e.climbL = null; } };
        A.play('slat', { pos: e.pos, vol: 0.6 });
      } else e.wait = true;
    }
  }
  function climbTick(e, dt) {
    const c = e.climb;
    if (c.path) { // ladder: follow the rungs
      c.t += dt * c.speed;
      while (c.seg < c.path.length - 1 && c.t >= c.path[c.seg].distanceTo(c.path[c.seg + 1])) { c.t -= c.path[c.seg].distanceTo(c.path[c.seg + 1]); c.seg++; }
      if (c.seg >= c.path.length - 1) { e.pos.copy(c.path[c.path.length - 1]); e.climb = null; if (c.done) c.done(); return; }
      const a = c.path[c.seg], b = c.path[c.seg + 1], dd = a.distanceTo(b);
      e.pos.lerpVectors(a, b, dd > 0 ? c.t / dd : 1); e.vel.set(0, 0, 0); e.vy = 0; e.st.move = 0.9;
      e.yaw = c.face; e.root.rotation.y = e.yaw;
      return;
    }
    c.t += dt;
    const k = Math.min(1, c.t / c.dur), ky = 1 - Math.pow(1 - Math.min(1, k / 0.75), 2), kx = U.smooth(U.clamp((k - 0.35) / 0.65, 0, 1));
    e.pos.set(U.lerp(c.x0, c.x1, kx), U.lerp(c.y0, c.y1, ky), U.lerp(c.z0, c.z1, kx));
    e.vel.set(0, 0, 0); e.vy = 0; e.st.move = 0.8;
    if (k >= 1) e.climb = null;
  }
  function face(e, dt, tx, tz, rate = 8) {
    const want = Math.atan2(tx - e.pos.x, tz - e.pos.z);
    e.yaw += U.angDiff(e.yaw, want) * Math.min(1, rate * dt);
    e.root.rotation.y = e.yaw;
  }
  function tell(e, dur) {
    e.tellT = dur;
    const Pl = P(); if (Pl.isP2 || !XH.ui.warnDir) return;
    const dx = e.pos.x - Pl.pos.x, dz = e.pos.z - Pl.pos.z, d = Math.hypot(dx, dz) || 1;
    if ((dx * -Math.sin(Pl.yaw) + dz * -Math.cos(Pl.yaw)) / d < 0.5 && d < 14) XH.ui.warnDir(e.pos);
  }
  function meleeTick(e, dt, dist) {
    const def = e.def, Pl = P();
    const gap = dist - e.radius - 0.35, reach = def.reach || 1;
    const dc = XH.weapons.lure; // a Decoy Hologram in reach takes the swing instead of the player
    if (dc && dc.kind === 'decoy' && e.atkT < 0 && e.atkCd <= 0 && gap >= reach * 0.9 && Math.hypot(dc.pos.x - e.pos.x, dc.pos.z - e.pos.z) - e.radius < reach + 0.6) {
      e.atkT = 0; e.atkDone = true; dc.hp -= def.dmg * 1.2;
      A.play(def.heavy ? 'slash' : 'claw', { pos: e.pos, vol: 0.7 });
    }
    if (e.atkT < 0 && e.atkCd <= 0 && !e.climb && !(e.blindT > e.t) && gap < reach * 0.9 && Math.abs((Pl.pos.y + 1) - (e.fly ? e.pos.y : e.pos.y + 1)) < 2.2 && W().clearLine(e.pos.x, e.pos.z, Pl.pos.x, Pl.pos.z, 0.15, 1, true)) {
      e.atkT = 0; e.atkDone = false; tell(e, Math.min(0.45, def.atkTime * def.atkHit));
      A.play(def.heavy ? 'slash' : 'claw', { pos: e.pos });
      if (Math.random() < 0.7) A.creature(e.type, 'attack', { pos: e.pos });
    }
    if (e.atkT >= 0) {
      e.atkT += dt; e.st.atk = e.atkT / def.atkTime;
      if (!e.atkDone && e.st.atk >= def.atkHit) {
        e.atkDone = true;
        const toP = _tmp.set(Pl.pos.x - e.pos.x, 0, Pl.pos.z - e.pos.z), d = toP.length();
        const facing = toP.normalize().dot(new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)));
        const vy = Math.abs((Pl.pos.y + 1) - (e.fly ? e.pos.y : e.pos.y + 1));
        if (Math.hypot(d, e.fly ? vy : 0) - e.radius - 0.35 <= reach && vy < 2.2 && facing > (def.heavy ? 0.1 : 0.35) && W().clearLine(e.pos.x, e.pos.z, Pl.pos.x, Pl.pos.z, 0.15, 1, true)) { Pl.hurt(def.dmg * e.dmgMul, e.pos); if (def.heavy) { Pl.knock(toP, 6); FX.shake(0.5); } E.onHitPlayer(e, 'melee'); }
      }
      if (e.atkT >= def.atkTime) { e.atkT = -1; e.st.atk = -1; e.atkCd = def.atkCd * U.rand(0.8, 1.3); }
      return true;
    }
    return false;
  }
  function castTick(e, dt, onRelease) {
    const r = e.def.ranged;
    if (e.castT <= 0) tell(e, Math.min(0.6, r.castT * r.release));
    e.castT += dt / r.castT; e.st.cast = e.castT;
    if (!e.released && e.castT >= r.release) { e.released = true; onRelease(); }
    if (e.castT >= 1) { e.castT = -1; e.st.cast = -1; e.castCd = U.rand(r.cd[0], r.cd[1]); }
  }
  const headPos = (e, up = 0) => new THREE.Vector3(e.pos.x + Math.sin(e.yaw) * e.radius, (e.fly ? e.pos.y : e.pos.y + e.def.cy) + up, e.pos.z + Math.cos(e.yaw) * e.radius);
  // Can this creature see the player right now (eye height to chest)?
  const sees = (e) => { const y = e.fly ? e.pos.y : e.pos.y + e.def.cy + (e.def.boss ? 1.5 : 0.4); return losTo(e, y); };
  // Imperfect aim: partial lead on the player's motion plus a random miss that grows with distance.
  function aimAt(e, from, flight, err) {
    const Pl = P(), t = new THREE.Vector3(Pl.pos.x, Pl.pos.y + Pl.eyeH - 0.45, Pl.pos.z), d = t.distanceTo(from);
    const lead = flight * U.rand(0.1, 0.9); t.x += Pl.vel.x * lead; t.z += Pl.vel.z * lead;
    // miss radius (1 sigma, metres): ~0.45 m at 8 m, ~0.7 m at 16 m, ~1 m at 25 m; worse if you sprint
    const sig = (0.2 + d * 0.031) * ((err || 0.04) / 0.04) * (Pl.sprinting ? 1.35 : 1), off = sig * Math.sqrt(-2 * Math.log(Math.max(1e-4, Math.random())));
    const a = Math.random() * Math.PI * 2; t.x += Math.cos(a) * off; t.z += Math.sin(a) * off; t.y += U.rand(-0.5, 0.5) * off;
    return t;
  }
  E.aimAt = aimAt;
  const playerAim = (lead = 0) => { const Pl = P(); return new THREE.Vector3(Pl.pos.x + Pl.vel.x * lead, Pl.pos.y + Pl.eyeH - 0.35, Pl.pos.z + Pl.vel.z * lead); };

  const AI = {
    skitterling(e, dt) {
      const Pl = P(), sp = e.def.speed * e.speedMul;
      if (e.leapT >= 0) {
        e.leapT += dt; const k = e.leapT / 0.45;
        e.st.leap = Math.sin(Math.PI * Math.min(1, k)) * 0.9; e.st.leapPitch = (0.5 - k) * 0.6;
        integrate(e, dt);
        if (k >= 1) { e.leapT = -1; e.st.leap = 0; e.st.leapPitch = 0; e.vel.multiplyScalar(0.3); e.atkCd = 0; }
        e.st.move = 0.3;
        return;
      }
      const dist = steer(e, dt, e.atkT >= 0 ? sp * 0.35 : sp);
      e.leapCd -= dt;
      if (e.leapCd <= 0 && !e.crawler && !distracted(e) && dist > 3 && dist < 6.5 && e.atkT < 0 && W().clearLine(e.pos.x, e.pos.z, Pl.pos.x, Pl.pos.z, e.radius, 1)) {
        e.leapCd = U.rand(3, 5); e.leapT = 0;
        const dx = Pl.pos.x - e.pos.x, dz = Pl.pos.z - e.pos.z, d = Math.hypot(dx, dz);
        e.vel.set(dx / d * (d / 0.45) * 0.85, 0, dz / d * (d / 0.45) * 0.85);
        A.creature(e.type, 'special', { pos: e.pos });
      }
      meleeTick(e, dt, dist);
      integrate(e, dt);
      face(e, dt, e.pos.x + e.vel.x + (Pl.pos.x - e.pos.x) * 0.3, e.pos.z + e.vel.z + (Pl.pos.z - e.pos.z) * 0.3, 10);
      e.st.move = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / sp);
    },
    lancer(e, dt) {
      const Pl = P(), sp = e.def.speed * e.speedMul, r = e.def.ranged;
      const dist = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
      e.castCd -= dt;
      if (e.castT >= 0) {
        e.vel.multiplyScalar(Math.exp(-6 * dt));
        castTick(e, dt, () => {
          if (!sees(e)) return;
          const from = headPos(e, -0.2), base = aimAt(e, from, from.distanceTo(P().pos) / 28, r.err);
          for (let k = 0; k < r.n; k++) { const tgt = base.clone().add(new THREE.Vector3(U.rand(-0.9, 0.9), U.rand(-0.3, 0.3), U.rand(-0.9, 0.9)).multiplyScalar(k ? 1 : 0)); shoot('spine', from, tgt, e); }
          A.play('hiss', { pos: e.pos });
        });
        integrate(e, dt); face(e, dt, Pl.pos.x, Pl.pos.z, 6); e.st.move = 0.2;
        return;
      }
      if (e.castCd <= 0 && dist > r.range[0] && dist < r.range[1] && e.atkT < 0 && losTo(e, e.def.cy + 0.8)) {
        e.castT = 0; e.released = false; A.creature('lancer', 'special', { pos: e.pos }); e.st.hiss = 1;
      }
      e.st.hiss = Math.max(0, (e.st.hiss || 0) - dt * 2);
      steer(e, dt, e.atkT >= 0 ? sp * 0.3 : sp);
      meleeTick(e, dt, dist);
      integrate(e, dt);
      face(e, dt, Pl.pos.x, Pl.pos.z, 5);
      e.st.move = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / sp);
    },
    burster(e, dt) {
      const Pl = P(), sp = e.def.speed * e.speedMul;
      if (e.fuse >= 0) {
        e.fuse += dt; e.st.fuse = e.fuse / 0.55;
        e.vel.multiplyScalar(Math.exp(-3 * dt)); integrate(e, dt);
        if (e.fuse >= 0.55) { e.dead = true; e.state = 'dead'; burst(e, false); removeEnemy(e); }
        return;
      }
      const dist = steer(e, dt, sp);
      integrate(e, dt);
      face(e, dt, e.pos.x + e.vel.x, e.pos.z + e.vel.z, 6);
      const v = Math.hypot(e.vel.x, e.vel.z);
      e.st.move = Math.min(1, v / sp); e.st.rollSpeed = v / 0.62;
      if (dist < 2.0 && Math.abs(Pl.pos.y - e.pos.y) < 1.5) { e.fuse = 0; A.creature('burster', 'special', { pos: e.pos }); }
    },
    shrieker(e, dt) {
      const Pl = P(), sp = e.def.speed * e.speedMul, r = e.def.ranged;
      const dist = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
      e.castCd -= dt;
      const targetY = e.swoop ? Pl.pos.y + 1.4 : W().floorAt(e.pos.x, e.pos.z) + e.def.hover + Math.sin(e.t * 1.3 + e.st.seed) * 0.6;
      e.pos.y = U.damp(e.pos.y, targetY, e.swoop ? 3 : 1.5, dt);
      if (e.castT >= 0) {
        castTick(e, dt, () => { if (sees(e)) { const from = headPos(e), aim = aimAt(e, from, from.distanceTo(P().pos) / 15, r.err), n = r.n || 1, side = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw)); for (let k = 0; k < n; k++) shoot('glaive', from, aim.clone().addScaledVector(side, (k - (n - 1) / 2) * 1.6), e); } });
      } else if (e.castCd <= 0 && dist < r.range[1] && dist > 3 && losTo(e, 0)) { e.castT = 0; e.released = false; A.play('shriek', { pos: e.pos }); }
      e.swoopCd = (e.swoopCd === undefined ? U.rand(4, 8) : e.swoopCd) - dt;
      if (e.swoopCd <= 0 && !e.swoop && dist < 14) { e.swoop = true; e.swoopT = 0; A.creature('shrieker', 'special', { pos: e.pos }); }
      if (e.swoop) { e.swoopT += dt; if (e.swoopT > 3.5 || e.atkDone) { e.swoop = false; e.swoopCd = U.rand(5, 9); e.atkDone = false; } }
      steer(e, dt, sp * (e.swoop ? 1.4 : 1), { stop: e.swoop ? 0 : 7, orbit: e.swoop ? 0 : (dist < 12 ? 0.7 : 0) });
      if (e.swoop) meleeTick(e, dt, Math.hypot(dist, e.pos.y - Pl.pos.y - 1));
      integrate(e, dt, true);
      const prevYaw = e.yaw;
      face(e, dt, Pl.pos.x, Pl.pos.z, 4);
      e.root.rotation.z = U.damp(e.root.rotation.z, U.clamp(U.angDiff(prevYaw, e.yaw) / dt * -0.3, -0.6, 0.6), 4, dt);
      e.st.move = 1;
      if (Math.random() < dt * 1.5) A.play('flap', { pos: e.pos });
    },
    behemoth(e, dt) {
      const Pl = P(), sp = e.def.speed * e.speedMul, ch = e.def.charge;
      const dist = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
      e.chargeCd -= dt;
      if (e.chargeState === 'wind') {
        e.chargeT += dt; e.st.charge = Math.min(1, e.chargeT / 0.9); e.vel.multiplyScalar(Math.exp(-5 * dt));
        face(e, dt, Pl.pos.x, Pl.pos.z, 3); integrate(e, dt);
        if (e.chargeT > 0.9) { e.chargeState = 'run'; e.chargeT = 0; e.chargeDir = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)); e.chargeHit = false; }
        e.st.move = 0.2; return;
      }
      if (e.chargeState === 'run') {
        e.chargeT += dt;
        e.vel.set(e.chargeDir.x * ch.speed, 0, e.chargeDir.z * ch.speed);
        const bx = e.pos.x, bz = e.pos.z;
        integrate(e, dt, true);
        const moved = Math.hypot(e.pos.x - bx, e.pos.z - bz);
        const d = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
        if (!e.chargeHit && d < e.radius + 0.9) { e.chargeHit = true; Pl.hurt(ch.dmg * e.dmgMul, e.pos); Pl.knock(e.chargeDir, 12 * (e.def.chargeKnock || 1)); FX.shake(0.8); E.onHitPlayer(e, 'charge'); }
        if (Math.random() < 0.5) FX.dirt(new THREE.Vector3(e.pos.x, 0.1, e.pos.z), 3);
        if (e.chargeT > ch.dur || moved < ch.speed * dt * 0.3) {
          if (moved < ch.speed * dt * 0.3) { FX.shake(0.6); A.play('stomp', { pos: e.pos }); FX.dirt(headPos(e).setY(1), 20); e.stunT = 1.2; }
          e.chargeState = null; e.st.charge = 0; e.chargeCd = U.rand(ch.cd[0], ch.cd[1]);
        }
        e.st.move = 1; e.st.phase += dt * 6; return;
      }
      if (e.chargeCd <= 0 && dist > ch.range[0] && dist < ch.range[1] && e.atkT < 0 && W().clearLine(e.pos.x, e.pos.z, Pl.pos.x, Pl.pos.z, e.radius * 0.9, 1)) {
        e.chargeState = 'wind'; e.chargeT = 0; A.creature('behemoth', 'special', { pos: e.pos }); FX.shake(0.2);
      }
      steer(e, dt, e.atkT >= 0 ? sp * 0.2 : sp);
      meleeTick(e, dt, dist);
      integrate(e, dt);
      face(e, dt, Pl.pos.x, Pl.pos.z, 2.5);
      e.st.move = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / sp);
    },
    broodmother(e, dt) {
      const Pl = P(), sp = e.def.speed * e.speedMul, r = e.def.ranged;
      const dist = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
      e.castCd -= dt; e.eggCd -= dt;
      if (e.layT >= 0) {
        e.layT += dt / 1.2; e.st.cast = e.layT; e.vel.multiplyScalar(Math.exp(-5 * dt));
        if (!e.laid && e.layT > 0.6) {
          e.laid = true;
          const from = e.pos.clone().add(new THREE.Vector3(-Math.sin(e.yaw) * 1.8, 2.8, -Math.cos(e.yaw) * 1.8));
          const tgt = Pl.pos.clone().add(new THREE.Vector3(U.rand(-4, 4), 0, U.rand(-4, 4)));
          tgt.lerp(e.pos, 0.35); tgt.y = 0;
          shoot('egg', from, tgt, e); A.creature('broodmother', 'special', { pos: e.pos });
        }
        if (e.layT >= 1) { e.layT = -1; e.st.cast = -1; e.eggCd = U.rand(e.def.eggs.cd[0], e.def.eggs.cd[1]); }
        integrate(e, dt); face(e, dt, Pl.pos.x, Pl.pos.z, 2); e.st.move = 0; return;
      }
      if (e.spitT >= 0) {
        e.spitT += dt / r.castT; e.st.spit = e.spitT; e.vel.multiplyScalar(Math.exp(-5 * dt));
        if (!e.released && e.spitT > r.release) { e.released = true; if (sees(e)) { const from = headPos(e, 0.2); shoot('bile', from, aimAt(e, from, 1, r.err).setY(0), e); } }
        if (e.spitT >= 1) { e.spitT = -1; e.st.spit = -1; e.castCd = U.rand(r.cd[0], r.cd[1]); }
        integrate(e, dt); face(e, dt, Pl.pos.x, Pl.pos.z, 3); e.st.move = 0; return;
      }
      if (e.eggCd <= 0 && dist < 22 && E.countType('broodling') < 14 && sees(e)) { e.layT = 0; e.laid = false; }
      else if (e.castCd <= 0 && dist > r.range[0] && dist < r.range[1] && losTo(e, 2.2)) { e.spitT = 0; e.released = false; }
      steer(e, dt, sp, { stop: 9 });
      meleeTick(e, dt, dist);
      integrate(e, dt);
      face(e, dt, Pl.pos.x, Pl.pos.z, 2.5);
      e.st.move = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / sp);
    },
    broodling(e, dt) {
      const Pl = P(), sp = e.def.speed * e.speedMul;
      e.life -= dt;
      if (e.life <= 0) { E.damage(e, e.hp + 1, { kind: 'wither', noPoints: true, quiet: true }); return; }
      const dist = steer(e, dt, e.atkT >= 0 ? sp * 0.4 : sp);
      meleeTick(e, dt, dist);
      integrate(e, dt);
      face(e, dt, Pl.pos.x, Pl.pos.z, 12);
      e.st.move = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / sp);
    },
    burrower(e, dt) {
      const Pl = P();
      const dist = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
      if (e.state === 'burrowed') {
        e.root.visible = false; e.mound.visible = true;
        // find an ambush spot 8-14m from the player with line of sight
        e.spotT = (e.spotT || 0) - dt;
        if (!e.spot || e.spotT <= 0) {
          e.spotT = 2;
          for (let k = 0; k < 10; k++) {
            const a = Math.random() * Math.PI * 2, rr = U.rand(8, 14), x = Pl.pos.x + Math.cos(a) * rr, z = Pl.pos.z + Math.sin(a) * rr;
            if (!W().blockedAt(x, z, 1) && W().navDist(x, z, false) < 1e8 && W().clearLine(x, z, Pl.pos.x, Pl.pos.z, 0.3, 0)) { e.spot = new THREE.Vector3(x, 0, z); break; }
          }
        }
        const sp = e.def.speed * e.speedMul;
        steer(e, dt, sp, e.spot ? { goal: e.spot } : {});
        integrate(e, dt, true);
        e.mound.position.set(e.pos.x, 0, e.pos.z); e.mound.rotation.y += dt;
        if (Math.random() < dt * 12) FX.dirt(new THREE.Vector3(e.pos.x + U.rand(-0.8, 0.8), 0.1, e.pos.z + U.rand(-0.8, 0.8)), 2);
        if (Math.random() < dt * 0.6) A.creature('burrower', 'special', { pos: e.pos, vol: 0.6 });
        const atSpot = e.spot && Math.hypot(e.spot.x - e.pos.x, e.spot.z - e.pos.z) < 1.2;
        e.hopT += dt;
        if ((atSpot || (e.hopT > 10 && dist < 16 && dist > 5)) && e.hopT > 1.5) { e.state = 'surfacing'; e.burrowed = false; e.surfaceT = 0; e.hopT = 0; e.vel.set(0, 0, 0); A.play('emerge', { pos: e.pos }); A.creature('burrower', 'alert', { pos: e.pos }); FX.dirt(e.pos.clone().setY(0.2), 30); }
        return;
      }
      if (e.state === 'surfacing') {
        e.surfaceT += dt; const k = Math.min(1, e.surfaceT / 0.9);
        e.root.visible = true; e.mound.visible = k < 0.5;
        e.pos.y = (k - 1) * 1.6; e.st.fold = k < 0.7;
        face(e, dt, Pl.pos.x, Pl.pos.z, 6);
        if (k >= 1) { e.state = 'surfaced'; e.volleys = U.randi(3, 4); e.castCd = 0.4; e.st.fold = false; A.play('roar', { pos: e.pos }); }
        return;
      }
      if (e.state === 'surfaced') {
        e.castCd -= dt; face(e, dt, Pl.pos.x, Pl.pos.z, 4);
        if (e.atkT >= 0) {
          e.atkT += dt / 0.9; e.st.atk = e.atkT;
          if (!e.atkDone && e.atkT > 0.45) { e.atkDone = true; if (!W().clearLine(e.pos.x, e.pos.z, Pl.pos.x, Pl.pos.z, 0.3, 0)) { e.volleys = 0; return; } const ap = aimAt(e, e.pos, dist / 15, 0.05), dir = new THREE.Vector3(ap.x - e.pos.x, 0, ap.z - e.pos.z); quake(e.pos.clone().addScaledVector(dir.clone().normalize(), 1.4), dir, e.def.dmg * e.dmgMul); FX.shake(0.25); }
          if (e.atkT >= 1) { e.atkT = -1; e.st.atk = -1; e.castCd = U.rand(1.3, 1.9); e.volleys--; }
        } else if (e.castCd <= 0) {
          if (e.volleys <= 0 || dist < 4.5) { e.state = 'burrowing'; e.surfaceT = 0; A.play('burrow', { pos: e.pos }); }
          else { e.atkT = 0; e.atkDone = false; }
        }
        return;
      }
      if (e.state === 'burrowing') {
        e.surfaceT += dt; const k = Math.min(1, e.surfaceT / 0.8);
        e.pos.y = -k * 1.6; e.st.fold = true;
        if (Math.random() < 0.5) FX.dirt(e.pos.clone().setY(0.2), 3);
        if (k >= 1) { e.state = 'burrowed'; e.burrowed = true; e.spot = null; e.hopT = 0; }
      }
    },
    tyrant(e, dt) {
      const Pl = P(), B = e.bossAI;
      const dist = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
      B.seeT = (B.seeT || 0) - dt; if (B.seeT <= 0) { B.seeT = 0.25; B.sees = sees(e); }
      B.unseen = B.sees ? 0 : (B.unseen || 0) + dt;
      if (B.unseen >= E.BOSS_LOST && !B.act) { bossRelocate(e); return; }
      const hpK = e.hp / e.maxHp;
      const enraged = hpK < 0.3;
      const sp = e.def.speed * (enraged ? 1.35 : 1);
      // phase transitions summon the brood
      if ((B.phase === 1 && hpK < 0.66) || (B.phase === 2 && hpK < 0.33)) { B.phase++; B.act = 'roar'; B.actT = 0; B.summon = true; }
      if (B.act) {
        B.actT += dt / (B.act === 'slam' ? 1.5 : B.act === 'barrage' ? 2.2 : B.act === 'roar' ? 1.8 : 2.0);
        e.st.act = B.act; e.st.actT = B.actT;
        e.vel.multiplyScalar(Math.exp(-4 * dt));
        if (B.act === 'barrage') {
          const vol = Math.floor(B.actT * 4);
          if (vol !== B.lastVol && B.actT > 0.2 && B.actT < 0.9 && B.sees) {
            B.lastVol = vol; const from = e.center().add(new THREE.Vector3(Math.sin(e.yaw) * 1.5, 1.5, Math.cos(e.yaw) * 1.5));
            const base = aimAt(e, from, from.distanceTo(Pl.pos) / 28, 0.03), side = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
            for (let k = -3; k <= 3; k++) shoot('spine', from, base.clone().addScaledVector(side, k * 1.6), e);
            FX.shake(0.15);
          }
        } else if (B.act === 'slam' && !B.slammed && B.actT > 0.62 && B.sees) {
          B.slammed = true; shockwave(e.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)), 3), 16, 32 * e.dmgMul);
        } else if (B.act === 'roar') {
          if (!B.roared && B.actT > 0.2) { B.roared = true; A.play('roar', { pos: e.pos, big: true }); FX.shake(0.6); }
          if (B.summon && B.actT > 0.5) {
            B.summon = false;
            const spots = W().spawns.filter((s) => s.active).sort((a, b) => Math.hypot(a.x - e.pos.x, a.z - e.pos.z) - Math.hypot(b.x - e.pos.x, b.z - e.pos.z)).slice(0, 4);
            for (let k = 0; k < 6 + B.phase * 2; k++) { const s = spots[k % spots.length]; if (s) E.spawn('skitterling', s.x + U.rand(-1, 1), s.z + U.rand(-1, 1), { variant: 'frenzied' }); }
          }
        } else if (B.act === 'rain' && !B.rained && B.actT > 0.4 && B.sees) {
          B.rained = true;
          for (let k = 0; k < 7; k++) { const p = Pl.pos.clone().add(new THREE.Vector3(U.rand(-5, 5), 0, U.rand(-5, 5))); if (k === 0) p.copy(Pl.pos).add(new THREE.Vector3(U.rand(-1.5, 1.5), 0, U.rand(-1.5, 1.5))); const delay = 0.5 + k * 0.18; rainMarks.push({ p: p.setY(0), t: -delay, fired: false }); }
          A.play('wail', { pos: e.pos, vol: 1 });
        }
        face(e, dt, Pl.pos.x, Pl.pos.z, B.act === 'slam' && B.actT > 0.5 ? 0.3 : 2);
        integrate(e, dt);
        if (B.actT >= 1) { B.act = ''; e.st.act = ''; B.t = U.rand(2.5, 4.5) * (enraged ? 0.6 : 1); B.slammed = B.roared = B.rained = false; B.lastVol = -1; }
        e.st.move = 0; return;
      }
      B.t -= dt; B.summonT = (B.summonT || 25) - dt;
      if (B.t <= 0) {
        const los = B.sees;
        const opts = [];
        if (los && dist < 10) opts.push(['slam', 3]);
        if (los && dist > 6) opts.push(['barrage', 3]);
        if (los && dist > 5) opts.push(['rain', enraged ? 3 : 1.5]);
        if (B.summonT <= 0) { opts.push(['roar', 4]); }
        if (opts.length) { B.act = U.weighted(opts); B.actT = 0; if (B.act === 'roar') { B.summon = true; B.summonT = 25; } }
        else B.t = 1;
      }
      steer(e, dt, e.atkT >= 0 ? sp * 0.2 : sp);
      meleeTick(e, dt, dist);
      integrate(e, dt);
      face(e, dt, Pl.pos.x, Pl.pos.z, 2.5);
      e.st.move = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / sp);
      if (enraged) for (const m of e.mats) m.emissive.setHex(Math.sin(e.t * 8) > 0 ? 0x5a1060 : m.userData.base);
    },
  };

  // internals for bosses.js and uniques.js
  E.lib = { steer, integrate, face, meleeTick, castTick, shoot, shockwave, sees, losTo, aimAt, headPos, addPool, AI, T, rainAt: (p, delay) => rainMarks.push({ p: p.clone().setY(0), t: -delay, fired: false }), bossRelocate: (e) => bossRelocate(e) };
  // The Tyrant digs under and resurfaces somewhere near the player when it has lost them for too long.
  E.BOSS_LOST = 120;
  function bossRelocate(e) {
    const Pl = P(), B = e.bossAI;
    B.unseen = 0; B.act = ''; e.st.act = ''; e.atkT = -1; e.st.atk = -1;
    const cand = W().spawns.filter((s) => s.active !== false).map((s) => ({ s, d: Math.hypot(s.x - Pl.pos.x, s.z - Pl.pos.z) })).filter((q) => q.d > 9 && q.d < 34 && W().navDist(q.s.x, q.s.z, false) < 1e8).sort((a, b) => a.d - b.d);
    const pick = cand.length ? cand[Math.min(cand.length - 1, U.randi(0, 2))].s : null; if (!pick) return;
    FX.dirt(e.pos.clone().setY(0.2), 60); FX.shake(0.5); A.play('burrow', { pos: e.pos }); A.creature('tyrant', 'special', { pos: e.pos });
    e.pos.set(pick.x, -e.def.cy * 2 - 0.3, pick.z); e.vel.set(0, 0, 0); e.state = 'emerge'; e.emergeT = 0; e.stuckT = 0; e.lastPos.set(pick.x, 0, pick.z);
    XH.ui && XH.ui.banner && XH.ui.banner('THE ' + e.def.name.toUpperCase() + (e.fly ? ' SWOOPS IN' : ' BURROWS'), 'The ground trembles nearby…', '#d060ff');
  }

  // A creature Turned by the mutation effect fights for you until it burns out.
  function turnedAI(e, dt) {
    e.turned -= dt;
    if (Math.random() < dt * 8) FX.one(e.pos.x + U.rand(-0.4, 0.4), e.pos.y + e.def.cy + 0.3, e.pos.z + U.rand(-0.4, 0.4), 0, 1, 0, 0.5, 0.2, 0.03, 0x70ff70);
    if (e.turned <= 0) { e.turned = 0; E.damage(e, e.hp + 1, { kind: 'turned', noPoints: true, point: e.center() }); return; }
    let tgt = null, bd = 1e9;
    for (const o of E.list) {
      if (o === e || o.dead || o.turned || o.state === 'burrowed' || o.state === 'emerge') continue;
      const d = o.pos.distanceTo(e.pos); if (d < bd) { bd = d; tgt = o; }
    }
    const sp = e.def.speed * e.speedMul * 1.15;
    if (tgt) {
      steer(e, dt, bd < e.radius + tgt.radius + 0.6 ? 0 : sp, { goal: tgt.pos });
      e.tAtk = (e.tAtk || 0) - dt;
      if (bd < e.radius + tgt.radius + 0.9 && e.tAtk <= 0) {
        e.tAtk = 0.55; e.turnSwing = 0.5;
        E.damage(tgt, 260 * E.hpMul(G().round), { kind: 'turned', point: tgt.center(), weapon: 'turned' });
        A.play('claw', { pos: e.pos });
      }
      face(e, dt, tgt.pos.x, tgt.pos.z, 10);
    } else { e.vel.multiplyScalar(Math.exp(-4 * dt)); }
    e.turnSwing = Math.max(0, (e.turnSwing || 0) - dt);
    e.st.atk = e.turnSwing > 0 ? 1 - e.turnSwing / 0.5 : -1;
    integrate(e, dt, true);
    e.st.move = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / sp);
  }
  const rainMarks = [];
  const markMat = new THREE.MeshBasicMaterial({ color: 0x9dff3a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  function updRain(dt) {
    for (let i = rainMarks.length - 1; i >= 0; i--) {
      const r = rainMarks[i]; r.t += dt;
      if (r.t > -0.9 && !r.mesh) { r.mesh = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 32), markMat.clone()); r.mesh.rotation.x = -Math.PI / 2; r.mesh.position.set(r.p.x, 0.06, r.p.z); scene.add(r.mesh); }
      if (r.mesh) r.mesh.material.opacity = 0.3 + Math.sin(r.t * 20) * 0.3;
      if (r.t >= 0 && !r.fired) { r.fired = true; shoot('rain', r.p.clone().setY(18), r.p, { def: { ranged: { dmg: 18 } }, dmgMul: 1, pos: r.p }); }
      if (r.t > 1.2) { if (r.mesh) scene.remove(r.mesh); rainMarks.splice(i, 1); }
    }
  }

  // =================== update ===================
  E.update = (dt) => {
    const Pl = P();
    for (let i = E.list.length - 1; i >= 0; i--) {
      const e = E.list[i];
      if (!e) continue;
      const def = e.def;
      e.t += dt; e.st.t = e.t;
      if (e.dead) { deathAnim(e, dt); continue; }
      // status effects
      if (e.burnT > 0) {
        e.burnT -= dt; E.damage(e, e.burnDps * dt, { kind: 'fire', quiet: true });
        if (Math.random() < dt * 20) { const c = e.center(); FX.burst({ pos: c, n: 1, color: 0xffa040, color2: 0xff3000, speed: [0.5, 2], up: 1, life: [0.3, 0.6], size: [0.25, 0.6], jitter: e.radius }); }
        if (e.dead) continue;
      }
      if (G().mods.regen && e.hp < e.maxHp && e.t - (e.lastHitT || 0) > 2.5) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04 * dt);
      if (e.frozenT > 0) { e.frozenT -= dt; if (e.frozenT <= 0) { e.chill = 0; restoreTint(e); } }
      else if (e.chill > 0) e.chill = Math.max(0, e.chill - dt * 0.3);
      if (e.flashT > 0) { e.flashT -= dt; for (const m of e.mats) m.emissive.setHex(e.flashT > 0 ? 0x806060 : m.userData.base); }
      else if (e.tellT > 0) { e.tellT -= dt; if (!(e.frozenT > 0)) for (const m of e.mats) m.emissive.setHex(e.tellT > 0 ? (Math.sin(e.tellT * 45) > 0 ? 0xb04810 : 0x5a1e06) : m.userData.base); }
      if (e.frozenT > 0) for (const m of e.mats) { m.color.setHex(0x9fd8ff); m.emissive.setHex(0x103850); }
      // emerge
      if (e.state === 'emerge' && e.vent && e.vent.slats > 0 && !def.fly && !def.burrow) {
        e.tearT = (e.tearT || 0) + dt;
        e.pos.y = W().floorAt(e.pos.x, e.pos.z) - def.cy * 1.25;
        e.st.atk = (e.tearT % 0.6) / 0.6; e.st.move = 0; MON.animate(e.type, e.rig, e.st, dt);
        if (Math.random() < 0.3) FX.dirt(new THREE.Vector3(e.pos.x + U.rand(-0.6, 0.6), 0.1, e.pos.z + U.rand(-0.6, 0.6)), 1);
        if (e.tearT >= 0.6) {
          e.tearT = 0; e.vent.slats = Math.max(0, e.vent.slats - 1);
          A.play('tear', { pos: e.pos });
          FX.burst({ pos: new THREE.Vector3(e.pos.x, 0.2, e.pos.z), n: 6, color: 0x888888, speed: [1, 4], up: 1, life: [0.3, 0.6], size: [0.12, 0.06], grav: 12, add: false });
        }
        e.st.atk = -1;
        e.shadow.position.set(e.pos.x, 0.03 + W().floorAt(e.pos.x, e.pos.z), e.pos.z);
        continue;
      }
      if (e.state === 'emerge') {
        e.emergeT += dt; const k = Math.min(1, e.emergeT / def.emerge);
        const fl = W().floorAt(e.pos.x, e.pos.z);
        if (def.fly) e.pos.y = fl + U.lerp(0.2, def.hover, U.smooth(k));
        else e.pos.y = fl + (k - 1) * (def.cy * 2 + 0.3);
        if (Math.random() < 0.5) FX.dirt(new THREE.Vector3(e.pos.x + U.rand(-e.radius, e.radius), 0.1, e.pos.z + U.rand(-e.radius, e.radius)), 2);
        face(e, dt, Pl.pos.x, Pl.pos.z, 3);
        e.st.move = 0.5; e.st.phase += dt * 6;
        MON.animate(e.type, e.rig, e.st, dt);
        if (k >= 1) { e.state = 'act'; if (!def.fly) e.pos.y = fl; if (def.boss || def.heavy || Math.random() < 0.45) A.creature(e.type, 'alert', { pos: e.pos }); if (def.boss || def.heavy) FX.shake(def.boss ? 1 : 0.4); }
        e.shadow.position.set(e.pos.x, 0.03 + W().floorAt(e.pos.x, e.pos.z), e.pos.z);
        continue;
      }
      // behavior
      e.flinch = Math.max(0, (e.flinch || 0) - dt * 5);
      const mult = (e.frozenT > 0 ? 0 : e.stunT > 0 ? 0.15 : 1 - Math.min(0.7, e.chill * 0.6)) * (1 - e.flinch * (def.heavy ? 0.1 : 0.45)) * (e.zslow || 1);
      e.stunT -= dt; e.atkCd -= dt;
      const sdt = dt * Math.max(0.0001, mult);
      if (mult > 0) { if (e.turned > 0 && !def.ally) turnedAI(e, sdt); else AI[def.ai || e.type](e, sdt); const mh = mechOf(e); if (mh && mh.tick && (e.state === 'act' || mh.always)) mh.tick(e, sdt); }
      if (e.dead || e.removed) continue;
      // stuck / far relocation
      e.lastPosT += dt;
      if (e.lastPosT > 2) {
        const moved = Math.hypot(e.pos.x - e.lastPos.x, e.pos.z - e.lastPos.z), d = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
        if ((moved < 0.6 && d > 6 && !e.burrowed && e.castT < 0) || W().navDist(e.pos.x, e.pos.z, e.fly) > 60) e.stuckT += e.lastPosT; else e.stuckT = 0;
        e.lastPos.copy(e.pos); e.lastPosT = 0;
        if (e.stuckT > 8 && !def.boss && !def.ally) relocate(e);
      }
      // anim
      const spd = Math.hypot(e.vel.x, e.vel.z);
      e.st.phase += dt * mult * (def.heavy ? 2.2 : 7) * Math.max(0.35, spd / (def.speed || 1));
      // a creature that cannot be seen (off screen or behind walls) animates at 15 fps until it shows again
      e.animDt = (e.animDt || 0) + dt * mult;
      if (e.seen !== false || e.animDt >= 1 / 15) {
        MON.animate(e.type, e.rig, e.st, e.animDt); e.animDt = 0;
        if (e.crawler) { if (e.rig.body && e.type === 'skitterling') e.rig.body.position.y -= 0.32; if (e.rig.torso) e.rig.torso.rotation.x += 1.0; }
      }
      e.root.rotation.x = (e.crawler ? 0.18 : 0) - e.flinch * (def.heavy ? 0.04 : def.fly ? 0.3 : 0.18);
      if (!def.fly && !e.burrowed && Math.floor(e.st.phase / Math.PI) !== e.stepIdx) {
        e.stepIdx = Math.floor(e.st.phase / Math.PI);
        if (spd > 0.5) {
          A.creature(e.type, 'step', { pos: e.pos, vol: def.boss ? 1 : def.heavy ? 0.75 : 0.55 });
          if (def.heavy) { const d = Pl.pos.distanceTo(e.pos); if (d < 14) FX.shake((def.boss ? 0.25 : 0.15) * (1 - d / 14)); }
        }
      }
      // voice
      e.vocalT -= dt;
      if (e.vocalT <= 0) { e.vocalT = U.rand(3, 8); A.creature(e.type, 'idle', { pos: e.pos, vol: 0.8 }); }
      e.shadow.position.set(e.pos.x, 0.03 + W().floorAt(e.pos.x, e.pos.z), e.pos.z);
      e.shadow.visible = !e.burrowed || e.state !== 'burrowed';
    }
    updProj(dt); updPools(dt); updQuakes(dt); updRings(dt); updRain(dt);
    for (let i = hatchers.length - 1; i >= 0; i--) if (hatchers[i](dt)) hatchers.splice(i, 1);
  };
  // ---- drawing only the creatures that can be seen ----
  // Outside the view, or fully behind walls and closed doors (lines of sight through the wall grid from the camera to
  // the middle, top and both sides of each creature), a creature is not drawn. Hidden twice in a row before it goes,
  // shown again the moment any line clears.
  const _fr = new THREE.Frustum(), _pv = new THREE.Matrix4(), _cs = new THREE.Sphere();
  function behindWalls(c, x, y, z, r) {
    const Wd = W(); let px = c.z - z, pz = x - c.x; const l = Math.hypot(px, pz) || 1; px *= r * 0.8 / l; pz *= r * 0.8 / l;
    return Wd.sightBlocked(c.x, c.y, c.z, x, y, z) && Wd.sightBlocked(c.x, c.y, c.z, x, y + r * 0.8, z)
      && Wd.sightBlocked(c.x, c.y, c.z, x + px, y, z + pz) && Wd.sightBlocked(c.x, c.y, c.z, x - px, y, z - pz);
  }
  E.cull = (cam) => {
    cam.updateMatrixWorld(); _pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_pv);
    const c = cam.position, occl = !!W().sightBlocked;
    for (const e of E.list) {
      if (!e.parts) continue;
      const s = e.root.scale.x, r = e.bsR * s, y = e.pos.y + e.bsY * s;
      _cs.center.set(e.pos.x, y, e.pos.z); _cs.radius = r;
      let see = _fr.intersectsSphere(_cs);
      if (see && occl && behindWalls(c, e.pos.x, y, e.pos.z, r)) { e.occN = (e.occN || 0) + 1; if (e.occN >= 2) see = false; } else e.occN = 0;
      if (e.seen !== see) { e.seen = see; for (const m of e.parts) m.visible = see; }
    }
  };
  function restoreTint(e) { for (const m of e.mats) { m.color.setHex(m.userData.baseColor); m.emissive.setHex(m.userData.base); } }
  function relocate(e) {
    const Pl = P();
    const cands = W().spawns.filter((s) => s.active && Math.hypot(s.x - Pl.pos.x, s.z - Pl.pos.z) > 10).sort((a, b) => Math.hypot(a.x - Pl.pos.x, a.z - Pl.pos.z) - Math.hypot(b.x - Pl.pos.x, b.z - Pl.pos.z));
    const s = cands[U.randi(0, Math.min(2, cands.length - 1))];
    if (!s) return;
    e.pos.set(s.x, e.fly ? 0.2 : -e.def.cy * 2, s.z); e.vent = s; e.state = e.def.burrow ? 'burrowed' : 'emerge'; if (e.def.burrow) { e.burrowed = true; e.root.visible = false; e.spot = null; } e.emergeT = 0; e.stuckT = 0; e.vel.set(0, 0, 0);
    if (!e.def.burrow) FX.dirt(new THREE.Vector3(s.x, 0.1, s.z), 12);
  }
  function deathAnim(e, dt) {
    e.deathT += dt;
    const k = Math.min(1, e.deathT / 0.55);
    const dfl = W().floorAt(e.pos.x, e.pos.z) + 0.3;
    if (e.fly && e.pos.y > dfl) { e.vel.y = (e.vel.y || 0) - 20 * dt; e.pos.y = Math.max(dfl, e.pos.y + e.vel.y * dt); e.root.rotation.x += dt * 3; }
    else {
      if (e.deathRX !== undefined) { e.root.rotation.x = U.smooth(k) * e.deathRX; e.root.rotation.z = U.smooth(k) * e.deathRZ; } else e.root.rotation.z = U.smooth(k) * 1.25 * e.deathSide;
      if (e.deathVel) { e.pos.x += e.deathVel.x * dt; e.pos.z += e.deathVel.z * dt; e.deathVel.multiplyScalar(Math.exp(-6 * dt)); W().collide(e.pos, e.radius * 0.6, 1); }
      if (e.deathT > 1.8) e.pos.y -= dt * (e.def.heavy ? 0.8 : 0.5);
    }
    e.st.move = 0; e.st.atk = -1;
    if (e.deathT < 0.6) MON.animate(e.type, e.rig, e.st, dt * 0.3);
    if (e.deathT > (e.def.boss ? 5 : 3.2)) removeEnemy(e);
  }
})();
