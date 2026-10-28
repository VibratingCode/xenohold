'use strict';
// Buildable wonder weapons. Every map has one: find its three parts (scattered around the map, some behind doors),
// bring them to the Wonder Bench and build it. It never appears in the Xeno Cache. If you lose it, the bench
// rebuilds it two rounds later. Five designs, each shared by a few maps of the same kind:
//  - Winter's Howl (ice maps):        a freezing gale; frozen creatures shatter for triple damage
//  - Heart of the Mountain (fire):    a magma mortar that leaves burning pools
//  - Hivesong (hive and bio maps):    a beam that turns wounded creatures into thralls for 20 s
//  - Stormbreaker (outposts, cities): a chain-lightning cannon that calls strikes from the sky
//  - Rift Caster (ships, ruins):      rifts that fling creatures to the far side of the map, stunned
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, WP = XH.weapons, E = XH.enemies;
  const WW = XH.wonders = {};
  const G = () => XH.game, P = () => XH.player, W = () => XH.world, UI = () => XH.ui;

  Object.assign(XH.WTRAITS, {
    blizzard: ['Blizzard', 'Freezes what it hits; frozen creatures shatter for triple damage'],
    eruption: ['Eruption', 'Impacts leave a pool of magma that burns creatures'],
    thrall: ['Thrall', 'Wounded creatures it hits fight for you for 20 s'],
    tempest: ['Tempest', 'Hits can call lightning down on the target'],
    banish: ['Banish', 'Creatures that survive a rift are flung across the map, stunned'],
  });
  WP.defineGuns([
    ['wintershowl', 'wonder', "Winter's Howl", "Winter's Wrath", 'Wonder: freezing gale', ['wonder', 'blizzard'], { mode: 'wave', dmg: 900, range: 16, cone: 0.5, push: 5, rate: 0.9, mag: 6, reserve: 36, reload: 2.2, snd: 'cryo', flash: 0xa8f0ff, recoil: 0.08, build: true, cal: 'CRYO' }, { body: [0.5, 0.15, 0.09, 'energy'], color: 'white', glow: 0xa8f0ff, barrel: [0.2, 0.05], shroud: 'fins', muzzle: 'bell', mag: 'canister', stock: 'heavy', optic: 'energy', extras: ['tank', 'coils'] }],
    ['magmaheart', 'wonder', 'Heart of the Mountain', 'Heart of the Volcano', 'Wonder: magma mortar', ['wonder', 'eruption', 'explosive'], { mode: 'proj', dmg: 1800, rate: 0.8, mag: 4, reserve: 24, snd: 'launcher', flash: 0xff6020, proj: { speed: 30, grav: 12, r: 5, color: 0xff6020, size: 0.3, grenade: true }, build: true, cal: 'MAGMA' }, { body: [0.44, 0.16, 0.1, 'bulky'], color: 'black', accent: 0x3a2a1a, glow: 0xff5010, barrel: [0.26, 0.055], shroud: 'vented', muzzle: 'bell', mag: 'cyl', stock: 'heavy', extras: ['tank', 'orb'] }],
    ['hivesong', 'wonder', 'Hivesong', 'Hivesong Chorus', 'Wonder: thrall beam', ['wonder', 'thrall'], { mode: 'beam', dmg: 40, rate: 0.04, mag: 120, reserve: 480, pierce: 2, range: 36, beam: 0x70ff90, build: true, cal: 'PSI', upg: { beam: 0xd0ff60 } }, { body: [0.46, 0.14, 0.08, 'organic'], color: 'flesh', glow: 0x70ff90, barrel: [0.22, 0.03], shroud: 'bone', muzzle: 'energy', mag: 'none', stock: 'organic', optic: 'energy', extras: ['spikes', 'orb'] }],
    ['stormbreaker', 'wonder', 'Stormbreaker', 'Stormbreaker Ragnarok', 'Wonder: storm cannon', ['wonder', 'tempest'], { mode: 'arc', dmg: 900, chains: 10, rate: 0.5, mag: 10, reserve: 60, snd: 'arc', flash: 0x9fc8ff, build: true, cal: 'STORM', upg: { chains: 16 } }, { body: [0.5, 0.16, 0.08, 'energy'], color: 'gunmetal', glow: 0x9fd8ff, barrel: [0.18, 0.03], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'heavy', optic: 'energy', extras: ['coils', 'orb'] }],
    ['riftcaster', 'wonder', 'Rift Caster', 'Rift Sovereign', 'Wonder: banishing rifts', ['wonder', 'banish'], { mode: 'proj', dmg: 600, rate: 0.5, mag: 8, reserve: 48, snd: 'void', flash: 0xb040ff, proj: { speed: 45, grav: 0, r: 3.5, color: 0xb040ff, size: 0.25 }, build: true, cal: 'RIFT' }, { body: [0.38, 0.14, 0.08, 'round'], color: 'purple', glow: 0xb040ff, barrel: [0.14, 0.04], shroud: 'coil', muzzle: 'energy', mag: 'none', stock: 'fixed', optic: 'energy', extras: ['cage', 'orb'] }],
  ]);
  const KINDS = {
    wintershowl: { color: 0xa8f0ff, parts: ['Cryo Core', 'Frost Emitter', 'Howling Horn'], maps: ['glacier', 'frostfall', 'selene'] },
    magmaheart: { color: 0xff6020, parts: ['Magma Heart', 'Obsidian Barrel', 'Pressure Valve'], maps: ['depths', 'crucible', 'dustbasin'] },
    hivesong: { color: 0x70ff90, parts: ['Queen Gland', 'Chitin Lens', 'Neural Coil'], maps: ['verdant', 'undercroft', 'helix', 'cathedral'] },
    stormbreaker: { color: 0x9fd8ff, parts: ['Storm Cell', 'Tesla Spire', 'Grounding Rod'], maps: ['kestrel', 'starfall', 'city', 'bastion'] },
    riftcaster: { color: 0xc060ff, parts: ['Rift Shard', 'Phase Coil', 'Null Crystal'], maps: ['ark', 'temple', 'vesper'] },
  };
  WW.KINDS = KINDS;
  WW.forMap = (mapId) => Object.keys(KINDS).find((k) => KINDS[k].maps.includes(mapId)) || 'stormbreaker';
  WW.st = null;

  // ---------------- placement (at map build, before decor) ----------------
  WW.build = (c) => {
    WW.st = null;
    const Wd = W(), ST = XH.structures; if (!ST || !ST.freeRects) return;
    const id = WW.forMap(c.def.id), K = KINDS[id], s = Wd.start, root = Wd.root;
    const dS = (x, z) => Math.hypot(x - s.x, z - s.z);
    // the bench: somewhere open, a fair walk from the start
    const rects = ST.freeRects(3, 3);
    rects.sort((a, b) => Math.abs(dS(Wd.cx2x(a.x + 1), Wd.cz2z(a.z + 1)) - 22) - Math.abs(dS(Wd.cx2x(b.x + 1), Wd.cz2z(b.z + 1)) - 22));
    const zr = XH.zones && XH.zones.place('bench') ? XH.zones.inZone(rects, XH.zones.place('bench')) : [];
    const pin = (k) => XH.edits && XH.edits.pin(k), pb = pin('bench');
    if (!pb && Wd.auto === false) return; // a map of your own: only where you put it
    const r = pb ? { x: Wd.cellX(pb.x) - 1, z: Wd.cellZ(pb.z) - 1, w: 3, h: 3 } : zr[0] || rects[0]; if (!r) return;
    const cx = r.x + 1, cz = r.z + 1, [dx, dz] = pb && (pb.dx || pb.dz) ? [pb.dx, pb.dz] : c.openDir(cx, cz), bx = pb ? pb.x : Wd.cx2x(cx), bz = pb ? pb.z : Wd.cz2z(cz);
    ST.claim(r, 1); Wd.keepClear.push([bx, bz, 3]);
    Wd.piece('bench', { label: 'Wonder Bench', shape: 'point', x: bx, z: bz, r: 1.1, dx, dz, turn: true });
    const bench = benchModel(bx, bz, Math.atan2(dx, dz), id, K.color);
    Wd.addPropRot(bx, bz, 1.9, 0.9, Math.atan2(dx, dz), 1.0, { mount: false });
    // three parts, spread out: each one as far as possible from the start, the bench and the others
    const cells = ST.freeRects(1, 1).map((q) => [Wd.cx2x(q.x), Wd.cz2z(q.z)]).filter(([x, z]) => dS(x, z) > 12 && Math.hypot(x - bx, z - bz) > 8);
    const taken = [[s.x, s.z], [bx, bz]], parts = [];
    for (let k = 0; k < 3 && (cells.length || Wd.auto === false); k++) {
      const pp = pin('part' + k);
      if (!pp && Wd.auto === false) continue;
      if (pp) { taken.push([pp.x, pp.z]); Wd.keepClear.push([pp.x, pp.z, 1.5]); parts.push(partModel(pp.x, pp.z, k, K.color, root)); Wd.piece('part' + k, { label: 'Wonder weapon part ' + (k + 1), shape: 'point', x: pp.x, z: pp.z, r: 0.5 }); continue; }
      let best = null, bd = -1;
      for (const p of cells) { const d = Math.min(...taken.map((t) => Math.hypot(p[0] - t[0], p[1] - t[1]))) * U.rand(0.8, 1.2); if (d > bd) { bd = d; best = p; } }
      taken.push(best); Wd.keepClear.push([best[0], best[1], 1.5]);
      parts.push(partModel(best[0], best[1], k, K.color, root));
      Wd.piece('part' + k, { label: 'Wonder weapon part ' + (k + 1), shape: 'point', x: best[0], z: best[1], r: 0.5 });
    }
    WW.st = { id, K, bench, parts, have: 0, state: 'parts', t: 0, cd: 0, bpos: new THREE.Vector3(bx + dx * 1.4, 0, bz + dz * 1.4) };
  };
  function benchModel(x, z, yaw, id, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; W().root.add(g);
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.7, roughness: 0.4 }), top = new THREE.MeshStandardMaterial({ color: 0x40464f, metalness: 0.5, roughness: 0.5 });
    const glow = new THREE.MeshBasicMaterial({ color });
    const box = (m, p, s) => { const o = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m); o.position.set(...p); o.scale.set(...s); g.add(o); return o; };
    box(top, [0, 0.95, 0], [1.9, 0.1, 0.9]); box(dark, [0, 0.45, 0], [1.7, 0.8, 0.7]);
    box(glow, [0, 0.95, 0.46], [1.9, 0.04, 0.02]); box(glow, [0, 0.62, 0.36], [1.2, 0.03, 0.02]);
    // the blueprint: a hologram of the weapon until it is built
    const holo = WP.flatModel(id, false); holo.scale.setScalar(2.4); holo.position.set(0, 1.45, 0); holo.rotation.y = Math.PI / 2;
    const hm = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.55, depthWrite: false });
    holo.traverse((o) => { if (o.isMesh) o.material = hm; }); g.add(holo);
    const real = WP.flatModel(id, false); real.scale.setScalar(2.4); real.position.set(0, 1.2, 0); real.rotation.set(0, Math.PI / 2, 0); real.visible = false; g.add(real);
    // three sockets that light up as parts come in
    const sockets = [-0.55, 0, 0.55].map((sx) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0x303840 })); m.position.set(sx, 1.03, 0.25); g.add(m); return m; });
    const sign = XH.sys && XH.sys.label ? XH.sys.label('WONDER BENCH', '#' + color.toString(16).padStart(6, '0'), 1.5, 0.34) : null;
    if (sign) { sign.position.set(0, 2.25, -0.3); g.add(sign); }
    const halo = FX.glowSprite(color, 3.2, 0.35); halo.position.set(0, 1.5, 0.2); g.add(halo); // no real light: adding or removing lights recompiles every shader
    return { g, holo, real, sockets };
  }
  function partModel(x, z, k, color, root) {
    const g = new THREE.Group(); g.position.set(x, 1, z); root.add(g);
    const geo = [new THREE.OctahedronGeometry(0.22), new THREE.TorusKnotGeometry(0.14, 0.05, 48, 8), new THREE.CylinderGeometry(0.08, 0.14, 0.45, 8)][k];
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x30343a, emissive: color, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.35 })); g.add(m);
    const gl = FX.glowSprite(color, 1.3, 0.75); g.add(gl);
    const gl2 = FX.glowSprite(color, 3.5, 0.18); g.add(gl2); // soft halo instead of a point light (see benchModel)
    return { g, k, pos: new THREE.Vector3(x, 0, z), taken: false };
  }

  // ---------------- prompts ----------------
  WW.candidates = (out) => {
    const st = WW.st; if (!st || G().state !== 'playing') return;
    const Pl = P().pos, K = st.K, name = WP.DEFS[st.id].name;
    for (const p of st.parts) {
      if (p.taken) continue;
      const d = Math.hypot(p.pos.x - Pl.x, p.pos.z - Pl.z);
      if (d < 1.8 && Math.abs(Pl.y - 0) < 1.5) out.push({ tip: 'wonder', dist: d, text: `Pick up ${K.parts[p.k]} (${name} part)`, cost: 0, act: () => take(p) });
    }
    const d = Math.hypot(st.bpos.x - Pl.x, st.bpos.z - Pl.z);
    if (d > 2.2) return;
    if (st.state === 'parts') out.push({ tip: 'wonder', dist: d, text: st.have < 3 ? `${name}: find the parts (${st.have}/3)` : `Build ${name}`, cost: st.have < 3 ? null : 0, act: st.have < 3 ? null : () => { st.state = 'building'; st.t = 2.5; A.play('build', { pos: st.bpos }); } });
    else if (st.state === 'building') out.push({ tip: 'wonder', dist: d, text: 'Building…', cost: null });
    else if (st.state === 'ready') out.push({ tip: 'wonder', dist: d, text: `Take ${name}`, cost: 0, act: () => { WP.give(st.id); st.state = 'taken'; st.bench.real.visible = false; A.play('perk'); UI().banner(name.toUpperCase(), WP.DEFS[st.id].role, '#' + K.color.toString(16).padStart(6, '0')); } });
    else if (st.state === 'taken' && !WP.has(st.id)) out.push({ tip: 'wonder', dist: d, text: `${name} rebuilds in ${st.cd || 2} round${(st.cd || 2) === 1 ? '' : 's'}`, cost: null });
    else if (st.state === 'taken') out.push({ tip: 'wonder', dist: d, text: `${name}: in your hands`, cost: null });
  };
  function take(p) {
    const st = WW.st; p.taken = true; p.g.visible = false; st.have++;
    st.bench.sockets[st.have - 1].material.color.setHex(st.K.color);
    A.play('grab'); A.play('powerup', { vol: 0.5 });
    UI().banner(st.K.parts[p.k].toUpperCase(), st.have < 3 ? `${st.have}/3 parts for ${WP.DEFS[st.id].name}` : `All parts found: build it at the Wonder Bench`, '#' + st.K.color.toString(16).padStart(6, '0'));
    if (UI().tip) UI().tip('wonder');
  }
  WW.onRoundStart = () => {
    const st = WW.st; if (!st || st.state !== 'taken' || WP.has(st.id)) return;
    st.cd = (st.cd || 3) - 1;
    if (st.cd <= 0) { st.cd = 0; st.state = 'ready'; st.bench.real.visible = true; }
  };

  // ---------------- per frame ----------------
  const banishQ = [];
  WW.update = (dt, t) => {
    const st = WW.st;
    if (st) {
      for (const p of st.parts) if (!p.taken) { p.g.rotation.y = t * 1.3 + p.k; p.g.position.y = 1 + Math.sin(t * 2 + p.k) * 0.12; }
      st.bench.holo.rotation.y = Math.PI / 2 + Math.sin(t * 0.6) * 0.5; st.bench.holo.visible = st.state === 'parts' || st.state === 'building';
      if (st.state === 'building') {
        st.t -= dt; if (Math.random() < 0.4) FX.sparks(st.bench.g.position.clone().setY(1.2), new THREE.Vector3(0, 1, 0));
        if (st.t <= 0) { st.state = 'ready'; st.bench.real.visible = true; A.play('forge', { pos: st.bpos }); if (XH.achievements) XH.achievements.flag('ww'); XH.progress && XH.progress.addXP(500, 'Wonder weapon built'); }
      }
      if (st.state === 'ready') st.bench.real.rotation.y = Math.PI / 2 + t * 0.8;
    }
    // Rift Caster: survivors get flung to the far side of the map
    while (banishQ.length) {
      const e = banishQ.shift(); if (e.dead || e.banishT > e.t) continue;
      const Pl = P().pos, sp = W().spawns.filter((s) => s.active).sort((a, b) => Math.hypot(b.x - Pl.x, b.z - Pl.z) - Math.hypot(a.x - Pl.x, a.z - Pl.z))[Math.floor(Math.random() * 3)];
      if (!sp) continue;
      FX.burst({ pos: e.center(), n: 24, color: 0xc060ff, speed: [2, 6], life: [0.3, 0.7], size: [0.35, 0.05] });
      e.pos.set(sp.x + U.rand(-1, 1), e.fly ? e.pos.y : 0, sp.z + U.rand(-1, 1)); e.vel && e.vel.set(0, 0, 0);
      e.stunT = Math.max(e.stunT, 3); e.banishT = e.t + 2;
      FX.burst({ pos: e.center(), n: 24, color: 0xc060ff, speed: [2, 6], life: [0.3, 0.7], size: [0.35, 0.05] });
    }
  };

  // ---------------- weapon effects ----------------
  const UQ = XH.uniques, baseHit = UQ.hitMod, baseExplode = UQ.onExplode;
  UQ.hitMod = (e, amt, o, slot) => {
    amt = baseHit(e, amt, o, slot);
    const w = o.weapon;
    if (w === 'wintershowl') {
      if (e.frozenT > 0 && !e.def.boss) { amt *= 3 / 1.5; if (amt >= e.hp) FX.shatter(e.center()); }
      else if (!e.def.boss) { e.frozenT = Math.max(e.frozenT, e.def.heavy ? 1.2 : 3); e.chill = 1.3; }
      else e.chill = Math.min(1.3, (e.chill || 0) + 0.3);
    } else if (w === 'hivesong') {
      if (!e.turned && !e.def.boss && e.hp - amt < e.maxHp * 0.5 && E.turn(e, 20)) { A.play('hatch', { pos: e.pos, vol: 0.6 }); return 0; }
    } else if (w === 'stormbreaker') {
      if (!o.tempest && Math.random() < 0.35) {
        const c = e.center(); FX.bolt(c.clone().add(new THREE.Vector3(U.rand(-2, 2), 16, U.rand(-2, 2))), c, 0xc8f0ff, 0.25, 12, 1.2);
        FX.flash(c, 0xc8f0ff, 6, 0.2, 18); A.play('arc', { pos: c });
        E.radiusDamage(c, 3.5, amt * 1.2, { kind: 'arc', weapon: 'stormbreaker', tempest: true, chain: true });
      }
    } else if (w === 'riftcaster' && !e.def.boss) banishQ.push(e);
    return amt;
  };
  UQ.onExplode = (pos, r, dmg, wid) => {
    baseExplode(pos, r, dmg, wid);
    if (wid === 'magmaheart') UQ.epools.push({ pos: pos.clone().setY(0), r: 3.2, t: 7, kind: 'fire', mesh: UQ.poolMesh(pos, 3.2, 0xff5a10) });
    if (wid === 'riftcaster') { FX.ring(pos.clone().setY(0.1), r, 0xc060ff, 0.5); A.play('void', { pos }); }
  };
})();
