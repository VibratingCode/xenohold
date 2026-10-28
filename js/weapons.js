'use strict';
// Weapons: definitions, procedural models, viewmodel animation, firing, projectiles.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const WP = XH.weapons = {};

  // =================== definitions ===================
  // rate = seconds between shots. mode: hit | flame | arc | proj
  const DEFS = WP.DEFS = {
    p9: { name: 'P-9 Sidearm', cls: 'Pistol', mode: 'hit', dmg: 45, rate: 0.13, mag: 12, reserve: 84, reload: 1.3, spread: 0.012, ads: 0.003, recoil: 0.02, snd: 'pistol', flash: 0xffc070, adsZoom: 0.85,
      upg: { name: 'P-9X Hellfire', dmg: 3, mag: 1.5, reserve: 2, splash: 2.4, tracer: 0xff6020 } },
    carbine: { name: 'Vx-12 Carbine', cls: 'SMG', mode: 'hit', dmg: 38, rate: 0.068, auto: true, mag: 32, reserve: 256, reload: 1.8, spread: 0.028, ads: 0.01, recoil: 0.011, snd: 'smg', flash: 0xffc070, cost: 1000, adsZoom: 0.8,
      upg: { name: 'Vx-99 Ripper', dmg: 2.6, mag: 1.5, reserve: 1.6 } },
    pulse: { name: 'AR-7 Pulse Rifle', cls: 'Rifle', mode: 'hit', dmg: 62, rate: 0.095, auto: true, mag: 40, reserve: 280, reload: 2.1, spread: 0.022, ads: 0.004, recoil: 0.015, snd: 'rifle', flash: 0x80d0ff, tracer: 0x80d0ff, cost: 1400, adsZoom: 0.75,
      upg: { name: 'AR-77 Nova Pulse', dmg: 2.6, pierce: 3, mag: 1.25 } },
    breacher: { name: 'Breacher-12', cls: 'Shotgun', mode: 'hit', dmg: 42, pellets: 9, rate: 0.72, mag: 6, reserve: 48, reload: 2.4, spread: 0.075, ads: 0.06, recoil: 0.07, snd: 'shotgun', flash: 0xffb050, cost: 1200, adsZoom: 0.85, falloff: true,
      upg: { name: 'Breacher Maximus', dmg: 2.6, mag: 1.5, reserve: 1.6, burn: true, tracer: 0xff7020 } },
    burst: { name: 'Tri-Burst DMR', cls: 'Marksman', mode: 'hit', dmg: 100, burst: 3, rate: 0.34, mag: 30, reserve: 210, reload: 2.2, spread: 0.012, ads: 0.002, recoil: 0.018, snd: 'burst', flash: 0xffc070, cost: 1600, adsZoom: 0.6,
      upg: { name: 'Triad Executioner', dmg: 2.6, pierce: 2, mag: 1.5 } },
    rail: { name: 'Longshot Railgun', cls: 'Sniper', mode: 'hit', dmg: 750, pierce: 12, rate: 1.1, mag: 5, reserve: 35, reload: 2.6, spread: 0.07, ads: 0, recoil: 0.09, snd: 'rail', flash: 0x60c8ff, beam: 0x60c8ff, cost: 2500, adsZoom: 0.3, scope: true, box: 4,
      upg: { name: 'Longshot Obliterator', dmg: 2.6, mag: 1.6, reserve: 1.6 } },
    magnum: { name: 'Kodiak .60', cls: 'Hand Cannon', mode: 'hit', dmg: 300, pierce: 2, rate: 0.3, mag: 6, reserve: 60, reload: 2.0, spread: 0.015, ads: 0.002, recoil: 0.08, snd: 'magnum', flash: 0xffc070, adsZoom: 0.8, box: 9,
      upg: { name: 'Grizzly Hand-Cannon', dmg: 2.6, mag: 1.34, splash: 2.8, tracer: 0xff6020 } },
    havoc: { name: 'Havoc Minigun', cls: 'Heavy', mode: 'hit', dmg: 50, rate: 0.042, auto: true, spin: 0.5, mag: 150, reserve: 600, reload: 3.4, spread: 0.04, ads: 0.03, recoil: 0.006, snd: 'minigun', flash: 0xffb050, adsZoom: 0.9, move: 0.8, box: 8,
      upg: { name: 'Havoc Deathwheel', dmg: 2.6, mag: 1.34, pierce: 2 } },
    inferno: { name: 'Inferno Projector', cls: 'Special', mode: 'flame', dmg: 26, rate: 0.05, auto: true, mag: 100, reserve: 400, reload: 2.8, range: 9, cone: 0.3, spread: 0, ads: 0, recoil: 0, snd: 'flame', adsZoom: 0.9, box: 8,
      upg: { name: "Dragon's Breath", dmg: 2.6, range: 1.35 } },
    arc: { name: 'Arc Lance', cls: 'Special', mode: 'arc', dmg: 230, rate: 0.28, auto: true, chains: 4, mag: 20, reserve: 160, reload: 2.2, spread: 0.01, ads: 0.004, recoil: 0.02, snd: 'arc', flash: 0x9fc8ff, adsZoom: 0.85, box: 7,
      upg: { name: 'Tempest Lance', dmg: 2.6, chains: 8, mag: 1.5 } },
    plasma: { name: 'Plasma Caster', cls: 'Special', mode: 'proj', dmg: 340, rate: 0.26, auto: true, mag: 16, reserve: 128, reload: 2.3, spread: 0.008, ads: 0.003, recoil: 0.03, snd: 'plasma', flash: 0x40c8ff, adsZoom: 0.85, box: 9,
      proj: { speed: 60, grav: 0, r: 3, color: 0x40c8ff, size: 0.35 }, upg: { name: 'Sun Caster', dmg: 2.6, projR: 1.4, color: 0xffa030 } },
    gl: { name: 'M-40 Frag Launcher', cls: 'Launcher', mode: 'proj', dmg: 950, rate: 0.85, mag: 6, reserve: 36, reload: 3, spread: 0.01, ads: 0.004, recoil: 0.08, snd: 'launcher', flash: 0xffb050, adsZoom: 0.85, box: 8,
      proj: { speed: 32, grav: 14, r: 5, color: 0xffb040, size: 0.2, bounce: true, fuse: 1.4, grenade: true }, upg: { name: 'M-400 Devastator', dmg: 2.6, mag: 1.5, reserve: 1.5, projR: 1.25 } },
    cryo: { name: 'Cryo Blaster', cls: 'Special', mode: 'hit', dmg: 30, pellets: 4, rate: 0.1, auto: true, mag: 60, reserve: 360, reload: 2.4, spread: 0.045, ads: 0.03, recoil: 0.008, snd: 'cryo', flash: 0xa0e8ff, tracer: 0xa0e8ff, freeze: 0.1, adsZoom: 0.9, range: 25, box: 8,
      upg: { name: 'Absolute Zero', dmg: 2.6, freeze: 2 } },
    void: { name: 'Singularity Driver', cls: 'Wonder Weapon', mode: 'proj', dmg: 0, rate: 1.2, mag: 3, reserve: 9, reload: 2.6, spread: 0, ads: 0, recoil: 0.05, snd: 'void', flash: 0xb040ff, adsZoom: 0.85, box: 2.5,
      proj: { speed: 24, grav: 0, color: 0xb040ff, size: 0.5, void: true }, upg: { name: 'Event Horizon', mag: 1.67, reserve: 2.2, voidR: 1.4 } },
  };
  WP.BOX_POOL = Object.entries(DEFS).filter(([k, d]) => d.box || (d.cost && k !== 'rail')).map(([k, d]) => [k, d.box || 4]);

  // stats for a slot (applies upgrade multipliers)
  // tier II and III mutations: more damage, more ammo, one more mutation effect each
  function computeStats(id, upg, tier = 1) {
    const s = computeStats0(id, upg);
    if (upg && tier > 1) { s.tier = tier; s.dmg *= 1 + 0.4 * (tier - 1); s.mag = Math.round(s.mag * (1 + 0.15 * (tier - 1))); s.reserve = Math.round(s.reserve * (1 + 0.25 * (tier - 1))); s.name += tier === 2 ? ' II' : ' III'; }
    return s;
  }
  function computeStats0(id, upg) {
    const d = DEFS[id], u = upg ? d.upg : {};
    const s = Object.assign({}, d);
    s.id = id; s.upg = !!upg; s.name = upg ? u.name : d.name;
    s.dmg = d.dmg * (u.dmg || 1);
    s.mag = Math.round(d.mag * (u.mag || 1));
    s.reserve = Math.round(d.reserve * (u.reserve || (upg ? 1.5 : 1)) * (XH.game && XH.game.mods && XH.game.mods.scarcity ? 0.5 : 1));
    s.pierce = u.pierce || d.pierce || 1;
    s.chains = u.chains || d.chains || 0;
    s.range = (d.range || 150) * (u.range || 1);
    s.splash = u.splash || d.splash || 0; s.burn = !!(u.burn || d.burn);
    s.tracer = u.tracer || d.tracer || 0xffe0a0;
    s.freeze = (d.freeze || 0) * (u.freeze || 1);
    s.cone = d.cone || 0.3; s.push = d.push || 0; s.kind = d.kind || null; s.beam = u.beam || d.beam;
    if (d.proj) { s.proj = Object.assign({}, d.proj); if (upg) { s.proj.r = (d.proj.r || 0) * (u.projR || 1); if (u.color) s.proj.color = u.color; s.voidR = u.voidR || 1; } }
    // gunsmith attachments
    const fx = WP.attFx ? WP.attFx(id, XH.progress && XH.progress.attFor ? XH.progress.attFor(id) : null) : {};
    s.dmg *= fx.dmg || 1; s.recoil *= fx.recoil || 1; s.spread *= fx.spread || 1; s.ads *= fx.ads || 1;
    s.adsZoom = (d.adsZoom || 0.8) * (fx.adsZoom || 1); s.reload = d.reload * (fx.reload || 1);
    s.mag = Math.max(1, Math.round(s.mag * (fx.mag || 1))); s.move = (d.move || 1) * (fx.move || 1); s.noFlash = !!fx.noFlash;
    s.adsTime = 0.16 * (fx.adsTime || 1); s.swap = 1;
    // weapon traits that change stats
    const tr = s.traits = new Set(d.traits || []);
    if (tr.has('quickdraw')) { s.swap *= 0.5; s.adsTime *= 0.55; }
    if (tr.has('hipfire')) s.spread *= 0.5;
    if (tr.has('steady')) { s.recoil *= 0.5; s.ads *= 0.6; }
    if (tr.has('mobile')) s.move *= 1.08;
    if (tr.has('overpen')) s.pierce += 2;
    if (tr.has('incendiary')) s.burn = true;
    // class traits
    const ct = XH.player && XH.player.traits;
    if (ct && ct.has('packrat')) s.reserve = Math.round(s.reserve * 1.3);
    if (ct && ct.has('quickhands')) s.reload *= 0.8;
    return s;
  }
  WP.slot = (id, upg = false) => { const s = computeStats(id, upg); return { id, upg, s, ammo: s.mag, reserve: s.reserve, model: null }; };

  // =================== models ===================
  const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6), sph: new THREE.SphereGeometry(1, 12, 8), cone: new THREE.ConeGeometry(1, 1, 8), torus: new THREE.TorusGeometry(1, 0.2, 6, 16) };
  Object.values(G).forEach((g) => { g.rotateX(0); g.userData.keep = true; });
  const camoTex = (() => {
    const t = U.tex(U.paint(128, (u, v) => {
      const r = U.ridge(u * 4, v * 4, 4, 4), n = U.fbm(u * 6 + 3, v * 6, 3, 6);
      return U.mix3([30, 8, 50], r > 0.85 ? [240, 90, 255] : [60 + n * 60, 20, 120 + n * 60], r > 0.85 ? 1 : 0.6);
    }));
    return t;
  })();
  const M = WP.MATS = {
    metal: new THREE.MeshStandardMaterial({ color: 0x5a626b, metalness: 0.7, roughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24282d, metalness: 0.5, roughness: 0.45 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.1, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: 0xc8d0d8, metalness: 0.5, roughness: 0.35 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xd06a18, metalness: 0.5, roughness: 0.4 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x4a5236, metalness: 0.4, roughness: 0.6 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xd8c8a0, metalness: 0.1, roughness: 0.5, flatShading: true }),
    camo: new THREE.MeshStandardMaterial({ color: 0x3a1450, metalness: 0.7, roughness: 0.3, emissive: 0xffffff, emissiveMap: camoTex, emissiveIntensity: 0.9, map: camoTex }),
  };
  const glowCache = {};
  const glow = (c) => glowCache[c] || (glowCache[c] = new THREE.MeshBasicMaterial({ color: c }));
  function B(p, mat, pos, scl, rot) { const m = new THREE.Mesh(G.box, mat); m.position.set(...pos); m.scale.set(...scl); if (rot) m.rotation.set(...rot); p.add(m); return m; }
  function C(p, mat, pos, r, len, rot, geo) { const m = new THREE.Mesh(geo || G.cyl, mat); m.position.set(...pos); m.scale.set(r, len, r); m.rotation.set(...(rot || [Math.PI / 2, 0, 0])); p.add(m); return m; }
  function muzzle(g, z, y = 0) { const o = new THREE.Object3D(); o.position.set(0, y, z); g.add(o); g.userData.muzzle = o; }

  const BUILD = {
    p9(g, m) {
      B(g, m, [0, 0.05, -0.1], [0.07, 0.085, 0.34]);
      B(g, M.dark, [0, 0.0, -0.08], [0.066, 0.04, 0.3]);
      B(g, M.grip, [0, -0.1, 0.03], [0.062, 0.2, 0.09], [0.25, 0, 0]);
      B(g, M.dark, [0, -0.03, -0.02], [0.02, 0.05, 0.08]);
      C(g, M.dark, [0, 0.05, -0.28], 0.016, 0.04);
      B(g, glow(0x40ff80), [0, 0.1, -0.24], [0.012, 0.012, 0.012]); B(g, glow(0x40ff80), [0, 0.1, 0.05], [0.03, 0.012, 0.012]);
      g.userData.adsY = -0.098; muzzle(g, -0.3, 0.05);
    },
    carbine(g, m) {
      B(g, m, [0, 0.02, -0.12], [0.085, 0.12, 0.46]);
      B(g, M.orange, [0.044, 0.03, -0.12], [0.004, 0.03, 0.3]); B(g, M.orange, [-0.044, 0.03, -0.12], [0.004, 0.03, 0.3]);
      C(g, M.dark, [0, 0.04, -0.46], 0.017, 0.24);
      B(g, M.dark, [0, -0.14, -0.1], [0.05, 0.2, 0.07], [0.2, 0, 0]);
      B(g, M.grip, [0, -0.1, 0.06], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      B(g, M.dark, [0, 0.0, 0.2], [0.05, 0.08, 0.2]);
      B(g, M.dark, [0, 0.1, -0.1], [0.03, 0.03, 0.18]);
      B(g, glow(0xff5030), [0, 0.125, -0.06], [0.008, 0.008, 0.008]);
      g.userData.adsY = -0.125; muzzle(g, -0.58, 0.04);
    },
    pulse(g, m) {
      B(g, m, [0, 0.02, -0.14], [0.11, 0.14, 0.6]);
      B(g, M.dark, [0, 0.05, -0.47], [0.09, 0.09, 0.14]);
      for (let i = 0; i < 3; i++) B(g, glow(0x40b8ff), [0.056, 0.04, -0.3 + i * 0.08], [0.004, 0.05, 0.04]);
      for (let i = 0; i < 3; i++) B(g, glow(0x40b8ff), [-0.056, 0.04, -0.3 + i * 0.08], [0.004, 0.05, 0.04]);
      C(g, M.metal, [0, 0.05, -0.62], 0.022, 0.22);
      B(g, M.dark, [0, -0.14, -0.08], [0.06, 0.22, 0.09], [0.15, 0, 0]);
      B(g, M.grip, [0, -0.11, 0.1], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      B(g, M.dark, [0, 0.0, 0.26], [0.06, 0.1, 0.18]);
      B(g, M.dark, [0, 0.13, -0.12], [0.05, 0.06, 0.18]);
      B(g, glow(0x60d0ff), [0, 0.13, -0.215], [0.035, 0.035, 0.005]);
      g.userData.adsY = -0.13; muzzle(g, -0.74, 0.05);
    },
    breacher(g, m) {
      B(g, m, [0, 0.02, -0.02], [0.1, 0.12, 0.36]);
      C(g, M.dark, [0, 0.05, -0.45], 0.028, 0.55);
      C(g, M.dark, [0, -0.01, -0.38], 0.024, 0.4);
      const pump = B(g, M.grip, [0, -0.01, -0.36], [0.07, 0.07, 0.16]); g.userData.pump = pump;
      B(g, M.grip, [0, -0.1, 0.1], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      B(g, M.grip, [0, -0.02, 0.28], [0.06, 0.1, 0.22]);
      B(g, M.orange, [0, 0.085, -0.05], [0.03, 0.01, 0.3]);
      g.userData.adsY = -0.115; muzzle(g, -0.73, 0.05);
    },
    burst(g, m) {
      B(g, m, [0, 0.02, -0.14], [0.09, 0.12, 0.62]);
      C(g, M.dark, [0, 0.04, -0.58], 0.018, 0.34);
      C(g, M.dark, [0, 0.13, -0.12], 0.035, 0.28);
      B(g, glow(0xff3030), [0, 0.13, -0.265], [0.03, 0.03, 0.004]);
      B(g, M.dark, [0, -0.14, -0.1], [0.05, 0.18, 0.08]);
      B(g, M.grip, [0, -0.1, 0.07], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      B(g, M.white, [0, 0.0, 0.26], [0.06, 0.11, 0.22]);
      g.userData.adsY = -0.13; muzzle(g, -0.76, 0.04);
    },
    rail(g, m) {
      B(g, m, [0, 0.0, -0.1], [0.1, 0.1, 0.6]);
      for (const sx of [-1, 1]) B(g, M.dark, [0.035 * sx, 0.02, -0.62], [0.02, 0.03, 0.62]);
      for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(G.torus, glow(0x60c8ff)); t.scale.setScalar(0.045); t.position.set(0, 0.02, -0.4 - i * 0.1); g.add(t); }
      C(g, M.dark, [0, 0.12, -0.12], 0.04, 0.34);
      B(g, glow(0x60c8ff), [0, 0.12, -0.3], [0.05, 0.05, 0.004]);
      B(g, M.grip, [0, -0.11, 0.06], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      B(g, M.white, [0, -0.02, 0.3], [0.06, 0.13, 0.24]);
      g.userData.adsY = -0.12; muzzle(g, -0.95, 0.02);
    },
    magnum(g, m) {
      B(g, m, [0, 0.05, -0.16], [0.055, 0.065, 0.3]);
      C(g, m, [0, 0.03, -0.01], 0.05, 0.08);
      B(g, M.grip, [0, -0.08, 0.07], [0.055, 0.18, 0.08], [0.35, 0, 0]);
      B(g, M.dark, [0, 0.09, -0.02], [0.02, 0.03, 0.06]);
      B(g, glow(0xffb030), [0, 0.09, -0.3], [0.01, 0.015, 0.01]);
      g.userData.adsY = -0.1; muzzle(g, -0.32, 0.05);
    },
    havoc(g, m) {
      B(g, m, [0, -0.02, 0.05], [0.17, 0.17, 0.32]);
      const barrels = new THREE.Group(); barrels.position.set(0, -0.02, -0.2); g.add(barrels);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; C(barrels, M.dark, [Math.cos(a) * 0.04, Math.sin(a) * 0.04, -0.28], 0.013, 0.58); }
      C(barrels, M.metal, [0, 0, -0.52], 0.06, 0.03); C(barrels, M.metal, [0, 0, -0.1], 0.065, 0.05);
      g.userData.spin = barrels;
      B(g, M.olive, [0.12, -0.08, 0.08], [0.08, 0.14, 0.18]);
      B(g, M.dark, [0, 0.12, 0.05], [0.03, 0.08, 0.16]);
      B(g, M.grip, [0, -0.15, 0.12], [0.05, 0.14, 0.06], [0.3, 0, 0]);
      g.userData.adsY = -0.06; muzzle(g, -0.8, -0.02);
    },
    inferno(g, m) {
      B(g, m, [0, 0.0, -0.1], [0.1, 0.12, 0.5]);
      for (const sx of [-1, 1]) { C(g, M.orange, [0.08 * sx, -0.04, 0.02], 0.045, 0.3); C(g, M.dark, [0.08 * sx, -0.04, -0.14], 0.02, 0.04); }
      const n = new THREE.Mesh(G.cone, M.dark); n.scale.set(0.05, 0.16, 0.05); n.rotation.x = Math.PI / 2; n.position.set(0, 0.02, -0.42); g.add(n);
      const pilot = new THREE.Mesh(G.sph, glow(0x60a0ff)); pilot.scale.setScalar(0.014); pilot.position.set(0, -0.02, -0.52); g.add(pilot);
      B(g, M.grip, [0, -0.12, 0.06], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      g.userData.adsY = -0.09; muzzle(g, -0.55, 0.0);
    },
    arc(g, m) {
      B(g, m, [0, 0.0, -0.05], [0.1, 0.12, 0.42]);
      for (const sx of [-1, 1]) B(g, M.metal, [0.04 * sx, 0.01, -0.38], [0.018, 0.04, 0.3], [0, -0.1 * sx, 0]);
      const core = new THREE.Mesh(G.sph, glow(0x9fc8ff)); core.scale.setScalar(0.035); core.position.set(0, 0.01, -0.46); g.add(core); g.userData.core = core;
      for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(G.torus, M.metal); t.scale.setScalar(0.07); t.position.set(0, 0.0, -0.1 - i * 0.08); g.add(t); }
      B(g, M.grip, [0, -0.12, 0.08], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      C(g, glow(0x6090ff), [0, 0.09, 0.0], 0.02, 0.2);
      g.userData.adsY = -0.1; muzzle(g, -0.52, 0.01);
    },
    plasma(g, m) {
      const b = new THREE.Mesh(G.sph, m); b.scale.set(0.085, 0.09, 0.28); b.position.set(0, 0.02, -0.12); g.add(b);
      C(g, M.dark, [0, 0.03, -0.42], 0.03, 0.18);
      C(g, glow(0x40c8ff), [0, 0.03, -0.3], 0.02, 0.3);
      for (const sx of [-1, 1]) B(g, M.white, [0.08 * sx, 0.02, -0.16], [0.02, 0.1, 0.2]);
      B(g, M.grip, [0, -0.11, 0.06], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      g.userData.adsY = -0.12; muzzle(g, -0.52, 0.03);
    },
    gl(g, m) {
      C(g, m, [0, 0.03, -0.25], 0.055, 0.45);
      C(g, M.dark, [0, -0.02, -0.02], 0.08, 0.13);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; C(g, M.orange, [Math.cos(a) * 0.05, -0.02 + Math.sin(a) * 0.05, 0.05], 0.02, 0.01); }
      B(g, M.grip, [0, -0.12, 0.1], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      B(g, M.grip, [0, -0.06, -0.25], [0.04, 0.1, 0.05]);
      B(g, M.dark, [0, 0.1, -0.1], [0.02, 0.05, 0.04]);
      g.userData.adsY = -0.11; muzzle(g, -0.5, 0.03);
    },
    cryo(g, m) {
      B(g, M.white, [0, 0.0, -0.1], [0.1, 0.12, 0.48]);
      C(g, glow(0x80e8ff), [0, 0.1, -0.05], 0.035, 0.26);
      for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(G.torus, m); t.scale.setScalar(0.06); t.position.set(0, 0.02, -0.36 - i * 0.04); g.add(t); }
      C(g, M.dark, [0, 0.02, -0.42], 0.025, 0.12);
      B(g, M.grip, [0, -0.12, 0.06], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      g.userData.adsY = -0.1; muzzle(g, -0.5, 0.02);
    },
    void(g, m) {
      B(g, m, [0, -0.02, 0.02], [0.1, 0.1, 0.3]);
      const cage = new THREE.Group(); cage.position.set(0, 0.02, -0.26); g.add(cage);
      for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(G.torus, M.bone); t.scale.setScalar(0.085); t.rotation.set(i * 1.05, i * 0.7, 0); cage.add(t); }
      const orb = new THREE.Mesh(G.sph, glow(0xb040ff)); orb.scale.setScalar(0.045); cage.add(orb);
      g.userData.spin = cage; g.userData.core = orb;
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; const s = new THREE.Mesh(G.cone, M.bone); s.scale.set(0.015, 0.2, 0.015); s.position.set(Math.cos(a) * 0.07, 0.02 + Math.sin(a) * 0.07, -0.38); s.rotation.x = -Math.PI / 2; g.add(s); }
      B(g, M.grip, [0, -0.12, 0.08], [0.055, 0.16, 0.07], [0.3, 0, 0]);
      g.userData.adsY = -0.1; muzzle(g, -0.45, 0.02);
    },
  };
  BUILD.lure = (g) => {
    const body = new THREE.Mesh(G.cyl, M.dark); body.scale.set(0.07, 0.16, 0.07); g.add(body);
    const band = new THREE.Mesh(G.cyl, M.orange); band.scale.set(0.075, 0.03, 0.075); g.add(band);
    const ant = new THREE.Mesh(G.cyl, M.metal); ant.scale.set(0.006, 0.18, 0.006); ant.position.set(0.03, 0.16, 0); g.add(ant);
    const bulb = new THREE.Mesh(G.sph, glow(0xff3030)); bulb.scale.setScalar(0.03); bulb.position.y = 0.1; g.add(bulb); g.userData.bulb = bulb;
  };
  BUILD.decoy = (g) => {
    const base = new THREE.Mesh(G.cyl, M.dark); base.scale.set(0.08, 0.04, 0.08); g.add(base);
    const lens = new THREE.Mesh(G.cyl, glow(0x60e0ff)); lens.scale.set(0.05, 0.012, 0.05); lens.position.y = 0.026; g.add(lens);
    const fin = new THREE.Mesh(G.box, M.metal); fin.scale.set(0.012, 0.05, 0.1); fin.position.set(0.07, 0.01, 0); g.add(fin);
  };
  // unlockable camos (non-mutated weapons)
  WP.CAMOS = [{ id: 'none', name: 'Standard', css: '#8a939c' }, { id: 'bone', name: 'Ossuary', css: '#d8cfb8' }, { id: 'magma', name: 'Magma', css: '#ff6020' }, { id: 'hive', name: 'Hivebloom', css: '#50ff90' }, { id: 'abyss', name: 'Abyss', css: '#a060ff' }];
  const camoCache = {};
  function camoMat(k) {
    if (camoCache[k]) return camoCache[k];
    let m;
    if (k === 'bone') m = new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.6, metalness: 0.1, map: U.tex(U.paint(128, (u, v) => { const r = U.ridge(u * 5, v * 5, 4, 5), n = U.fbm(u * 8, v * 8, 3, 8); const b = 190 + n * 50 - (r > 0.9 ? 90 : 0); return [b, b * 0.95, b * 0.82]; })) });
    else if (k === 'magma') { const t = U.tex(U.paint(128, (u, v) => { const r = U.ridge(u * 4, v * 4, 4, 4); const h = Math.pow(r, 6); return U.mix3([22, 14, 12], [255, 120, 20], h * 1.3); })); m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.4 }); }
    else if (k === 'hive') { const t = U.tex(U.paint(128, (u, v) => { const r = U.ridge(u * 6, v * 6, 4, 6), n = U.fbm(u * 5, v * 5, 3, 5); return r > 0.88 ? [80, 255, 140] : [18 + n * 30, 30 + n * 30, 26]; })); m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.5 }); }
    else if (k === 'abyss') { const t = U.tex(U.paint(128, (u, v) => { const n = U.fbm(u * 3, v * 3, 4, 3); if (Math.random() < 0.012) return [255, 255, 255]; return [10 + n * 70, 5 + n * 10, 25 + n * 110]; })); m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1, roughness: 0.2, metalness: 0.8 }); }
    return (camoCache[k] = m || M.metal);
  }
  WP.camoMat = camoMat;
  WP.BUILD = BUILD;
  WP._p = { B, C, glow, muzzle, M, G };
  // Wall price. Guns first designed for the Xeno Cache have no 'cost' (that marks them as Cache-only in the pool), so
  // when a map puts one on a wall it gets a price from its class, a little more for the rarer ones.
  const WALL_BASE = { Pistol: 700, SMG: 1300, Rifle: 1600, Shotgun: 1500, Marksman: 1800, Sniper: 2400, 'Hand Cannon': 1200, Heavy: 3000, Special: 2200, Launcher: 2400, Energy: 2200, LMG: 2600, 'Wonder Weapon': 6000 };
  WP.wallCost = (id) => {
    const d = DEFS[id]; if (!d) return 0;
    if (typeof d.cost === 'number' && isFinite(d.cost)) return d.cost;
    const b = d.box || 5;
    return Math.round(((WALL_BASE[d.cls] || 1500) + (b <= 2 ? 800 : b <= 4 ? 300 : 0)) / 50) * 50;
  };
  // the Xeno Cache pool; a map's own unique weapon joins it only on that map
  WP.rebuildPool = (mapId) => { WP.BOX_POOL = Object.entries(DEFS).filter(([k, d]) => (d.box || (d.cost && k !== 'rail')) && (!d.map || d.map === mapId)).map(([k, d]) => [k, d.map ? 2 : d.box || 4]); };
  WP.model = (id, upg, camo) => {
    const g = new THREE.Group();
    BUILD[id](g, upg ? M.camo : camo && camo !== 'none' ? camoMat(camo) : M.metal);
    g.userData.id = id;
    return g;
  };
  // Static display copy of a gun (wall buys, the Xeno Cache): one merged mesh per material.
  const flatCache = {};
  WP.flatModel = (id, upg = false) => {
    const key = id + (upg ? '+' : '') + JSON.stringify(XH.progress && XH.progress.attFor ? XH.progress.attFor(id) || {} : {});
    if (!flatCache[key]) {
      const src = WP.model(id, upg); src.updateMatrixWorld(true);
      const byMat = new Map();
      src.traverse((o) => { if (o.isMesh) { if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push({ g: o.geometry, m: o.matrixWorld }); } });
      flatCache[key] = [...byMat].map(([mat, items]) => { const g = U.merge(items); g.userData.keep = true; return [g, mat]; });
    }
    const g = new THREE.Group();
    for (const [geo, mat] of flatCache[key]) g.add(new THREE.Mesh(geo, mat));
    g.userData.id = id;
    return g;
  };
  function knifeModel() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(G.box, M.metal); b.scale.set(0.008, 0.035, 0.22); b.position.z = -0.14; g.add(b);
    const tip = new THREE.Mesh(G.cone, M.metal); tip.scale.set(0.02, 0.06, 0.005); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.28; g.add(tip);
    const h = new THREE.Mesh(G.box, M.grip); h.scale.set(0.025, 0.035, 0.12); h.position.z = 0.03; g.add(h);
    const guard = new THREE.Mesh(G.box, M.dark); guard.scale.set(0.02, 0.07, 0.015); guard.position.z = -0.03; g.add(guard);
    g.userData.needsHand = true;
    return g;
  }


  // =================== first-person arms (gloved hands + sleeves) ===================
  const ARM = {
    sleeve: new THREE.MeshStandardMaterial({ color: 0x2e3428, roughness: 0.92, metalness: 0.05 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.7, metalness: 0.1 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x3e464e, roughness: 0.45, metalness: 0.55 }),
  };
  const armGeo = new THREE.CylinderGeometry(1, 0.82, 1, 10); armGeo.userData.keep = true;
  // [right hand], [left hand], optional left-elbow direction (gun space)
  const GRIPS = {
    p9: [[0, -0.1, 0.03], [-0.025, -0.12, 0.07], [-0.16, -0.24, 0.32]],
    magnum: [[0, -0.08, 0.07], [-0.025, -0.1, 0.1], [-0.16, -0.24, 0.32]],
    carbine: [[0, -0.1, 0.06], [0, -0.035, -0.3]], pulse: [[0, -0.11, 0.1], [0, -0.07, -0.36]],
    breacher: [[0, -0.1, 0.1], [0, -0.03, -0.36]], burst: [[0, -0.1, 0.07], [0, -0.04, -0.32]],
    rail: [[0, -0.11, 0.06], [0, -0.035, -0.4]], havoc: [[0, -0.15, 0.12], [-0.02, 0.12, 0.03], [-0.26, -0.06, 0.28]],
    inferno: [[0, -0.12, 0.06], [0, -0.06, -0.24]], arc: [[0, -0.12, 0.08], [0, -0.06, -0.26]],
    plasma: [[0, -0.11, 0.06], [0, -0.06, -0.3]], gl: [[0, -0.12, 0.1], [0, -0.07, -0.25]],
    cryo: [[0, -0.12, 0.06], [0, -0.06, -0.28]], void: [[0, -0.12, 0.08], [0, -0.07, -0.2]],
  };
  const _av = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function limbBetween(parent, a, b, r, mat) {
    const m = new THREE.Mesh(armGeo, mat);
    _av.subVectors(b, a); const len = _av.length();
    m.position.copy(a).addScaledVector(_av, 0.5);
    m.scale.set(r, len, r);
    m.quaternion.setFromUnitVectors(_up, _av.normalize());
    parent.add(m); return m;
  }
  function hand(parent, pos, side) {
    const h = new THREE.Group(); h.position.copy(pos); parent.add(h);
    const fist = new THREE.Mesh(G.sph, ARM.glove); fist.scale.set(0.042, 0.052, 0.058); h.add(fist);
    const knuckle = new THREE.Mesh(G.box, ARM.pad); knuckle.scale.set(0.02, 0.05, 0.06); knuckle.position.set(0.035 * side, 0.005, -0.005); h.add(knuckle);
    const thumb = new THREE.Mesh(G.sph, ARM.glove); thumb.scale.set(0.016, 0.016, 0.035); thumb.position.set(-0.03 * side, 0.03, -0.02); h.add(thumb);
    return h;
  }
  function arm(parent, handPos, elbowDir, side) {
    const g = new THREE.Group(); parent.add(g);
    const hp = new THREE.Vector3(...handPos);
    hand(g, hp, side);
    const wrist = hp.clone().add(new THREE.Vector3(0.012 * side, -0.03, 0.05));
    const elbow = hp.clone().add(new THREE.Vector3(...elbowDir));
    const shoulder = elbow.clone().add(new THREE.Vector3(0.1 * side, -0.14, 0.32));
    limbBetween(g, hp, wrist, 0.036, ARM.glove);
    limbBetween(g, wrist, elbow, 0.048, ARM.sleeve);
    const pad = new THREE.Mesh(G.box, ARM.pad); pad.position.lerpVectors(wrist, elbow, 0.5); pad.quaternion.setFromUnitVectors(_up, _av.subVectors(elbow, wrist).normalize()); pad.scale.set(0.07, 0.14, 0.04); pad.translateX(0.03 * side); g.add(pad);
    limbBetween(g, elbow, shoulder, 0.062, ARM.sleeve);
    return g;
  }
  function addArms(model) {
    if (model.userData.armed) return;
    model.userData.armed = true;
    const gp = model.userData.grips || GRIPS[model.userData.id] || GRIPS.carbine;
    arm(model, gp[0], [0.12, -0.24, 0.34], 1);
    const left = arm(model, gp[1], gp[2] || [-0.2, -0.2, 0.24], -1);
    model.userData.leftArm = left;
  }

  // =================== viewmodel ===================
  let vmScene, vmCam, holder, knife, muzzleFlash, vmLight, vmHemi, vmDir;
  WP.initVM = () => {
    vmScene = new THREE.Scene();
    vmCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 10);
    vmHemi = new THREE.HemisphereLight(0xb0c0d8, 0x302820, 1.1); vmScene.add(vmHemi);
    const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(1, 2, 1); vmScene.add(dl); vmDir = dl;
    vmLight = new THREE.PointLight(0xffc070, 0, 3); vmLight.position.set(0.2, -0.05, -0.8); vmScene.add(vmLight);
    holder = new THREE.Group(); vmScene.add(holder);
    knife = knifeModel(); knife.visible = false; vmScene.add(knife);
    arm(knife, [0, 0, 0.04], [0.1, -0.22, 0.34], 1);
    muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex(), color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    muzzleFlash.scale.setScalar(0.25); muzzleFlash.visible = false;
    WP.vmScene = vmScene; WP.vmCam = vmCam;
  };
  function flashTex() {
    const c = U.canvas(128), x = c.getContext('2d');
    x.translate(64, 64);
    for (let i = 0; i < 7; i++) { x.rotate(Math.PI * 2 / 7); const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(1, 'rgba(255,160,40,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -6); x.lineTo(62, 0); x.lineTo(0, 6); x.fill(); }
    const rg = x.createRadialGradient(0, 0, 0, 0, 0, 30); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = rg; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill();
    return new THREE.CanvasTexture(c);
  }
  // fill every carried weapon (ammo restock station)
  WP.refillAll = () => { for (const sl of S.inv) { sl.ammo = sl.s.mag; sl.reserve = sl.s.reserve; } if (XH.ui) XH.ui.weaponChanged(WP.cur()); };
  WP.setVMDark = (k) => { if (vmHemi) vmHemi.intensity = 1.1 * k; if (vmDir) vmDir.intensity = 0.7 * k; };
  WP.setVMLight = (sky, ground) => { if (vmHemi) { vmHemi.color.set(sky); vmHemi.groundColor.set(ground); } };

  // =================== state ===================
  const S = WP.state = { inv: [], cur: 0, cd: 0, burstLeft: 0, burstT: 0, reloadT: 0, reloadDur: 0, reloadStage: 0, switchT: 0, knifeT: 0, knifeHit: false, grenT: 0, spin: 0, trigger: false, lastTrigger: false, adsT: 0, adsWant: false, grenades: 2, bloom: 0,
    recoilZ: 0, recoilX: 0, swayX: 0, swayY: 0, bobT: 0, pumpT: 0, fireFlash: 0, raise: 0, maxSlots: 2 };
  WP.reset = () => {
    S.tactical = null; S.shieldWant = false; S.shieldT = 0; S.bashCd = 0; S.dischargeCd = 0;
    if (WP.lure) { scene.remove(WP.lure.group); WP.lure = null; }
    S.inv = [WP.slot('p9')]; S.cur = 0; S.grenades = XH.game.mods && XH.game.mods.scarcity ? 1 : 2; S.cd = 0; S.reloadT = 0; S.switchT = 0; S.knifeT = 0; S.spin = 0; S.adsT = 0; S.burstLeft = 0; S.maxSlots = 2;
    equip(0, true);
    projectiles.forEach((p) => p.mesh && scene.remove(p.mesh)); projectiles.length = 0;
    voids.forEach((v) => scene.remove(v.group)); voids.length = 0;
    storms.length = 0;
  };
  WP.cur = () => S.inv[S.cur];
  function equip(i, instant) {
    S.cur = i; S.reloadT = 0; S.burstLeft = 0; S.spin = 0;
    const slot = S.inv[i];
    if (!slot.model) slot.model = WP.model(slot.id, slot.upg, XH.progress ? XH.progress.camoFor(slot.id) : null);
    addArms(slot.model);
    while (holder.children.length) holder.remove(holder.children[0]);
    holder.add(slot.model);
    const mz = slot.model.userData.muzzle; if (mz) mz.add(muzzleFlash);
    S.switchT = instant ? 0 : 0.45 * (slot.s.swap || 1);
    S.cd = Math.max(S.cd, instant ? 0 : 0.3);
    A.loop('flame', false); A.loop('spin', false); A.loop('beam', false);
    XH.ui && XH.ui.weaponChanged && XH.ui.weaponChanged(slot);
  }
  WP.equipIndex = (i) => equip(i, true);
  WP.switchTo = (i) => { if (i === S.cur || !S.inv[i] || S.knifeT > 0) return; equip(i); A.play('magin', { vol: 0.5 }); };
  WP.cycle = () => { if (S.inv.length > 1) WP.switchTo((S.cur + 1) % S.inv.length); };
  WP.has = (id) => S.inv.find((s) => s.id === id);
  WP.give = (id, upg = false) => {
    const had = WP.has(id);
    if (had) { had.ammo = had.s.mag; had.reserve = had.s.reserve; if (upg && !had.upg) WP.upgrade(had); XH.ui && XH.ui.weaponChanged(WP.cur()); return had; }
    const slot = WP.slot(id, upg);
    if (S.inv.length < maxSlots()) { S.inv.push(slot); equip(S.inv.length - 1); }
    else { S.inv[S.cur] = slot; equip(S.cur); }
    return slot;
  };
  WP.upgrade = (slot) => {
    slot.upg = true; slot.tier = 1; slot.aats = []; slot.s = computeStats(slot.id, true); slot.ammo = slot.s.mag; slot.reserve = slot.s.reserve; slot.model = null;
    WP.rollAAT(slot);
    if (isElectric(slot.s) && XH.ui && XH.ui.tip) XH.ui.tip('discharge');
    if (slot === WP.cur()) equip(S.cur);
  };
  // re-roll every effect the gun has (tier I: one, II: two, III: three), all different
  WP.rollAAT = (slot) => {
    const n = Math.max(1, slot.tier || 1), old = slot.aats || [slot.aat];
    // new effects first (in random order), then old ones to fill the slots
    const keys = Object.keys(XH.AATS).map((k) => [k, (old.includes(k) ? 1 : 0) + Math.random() * 0.5]).sort((a, b) => a[1] - b[1]).map((q) => q[0]);
    const pick = keys.slice(0, n);
    slot.aats = pick; slot.aat = pick[0]; slot.aatCd = 0;
    if (slot === WP.cur() && XH.ui) XH.ui.weaponChanged(slot);
  };
  WP.tierUp = (slot) => {
    slot.tier = Math.min(3, (slot.tier || 1) + 1); slot.s = computeStats(slot.id, true, slot.tier); slot.ammo = slot.s.mag; slot.reserve = slot.s.reserve; slot.model = null;
    const left = Object.keys(XH.AATS).filter((k) => !(slot.aats || [slot.aat]).includes(k));
    slot.aats = [...(slot.aats || [slot.aat]), U.pick(left)]; slot.aat = slot.aats[0];
    if (slot === WP.cur()) equip(S.cur);
    if (slot.tier === 3 && XH.achievements) XH.achievements.flag('forge3');
  };
  WP.maxAmmo = () => { for (const s of S.inv) s.reserve = s.s.reserve; S.grenades = XH.game.mods && XH.game.mods.scarcity ? 2 : 4; XH.ui && XH.ui.weaponChanged(WP.cur()); };
  WP.takeCurrent = () => { // remove current weapon (for forge); returns slot
    const slot = WP.cur();
    if (S.inv.length > 1) { S.inv.splice(S.cur, 1); equip(Math.min(S.cur, S.inv.length - 1)); }
    return slot;
  };
  WP.returnSlot = (slot) => {
    if (WP.has(slot.id)) { const h = WP.has(slot.id); Object.assign(h, slot); equip(S.inv.indexOf(h)); return; }
    if (S.inv.length < maxSlots()) { S.inv.push(slot); equip(S.inv.length - 1); } else { S.inv[S.cur] = slot; equip(S.cur); }
  };
  function maxSlots() { return XH.player.perks.has('holster') ? 3 : 2; }

  const perk = (id) => XH.player.perks.has(id);
  function rateMul() { return (perk('overclock') ? 0.75 : 1) * (XH.uniques ? XH.uniques.rateMul() : 1); }
  let shotMul = 1;
  function dmgMul() { return (perk('overclock') ? 1.25 : 1) * (XH.game.mods && XH.game.mods.glass ? 2 : 1) * shotMul; }
  // ---- damage-time traits (weapon traits and the player's class traits) ----
  const SMALL = new Set(['skitterling', 'broodling', 'burster']), BIG = new Set(['behemoth', 'broodmother', 'burrower', 'tyrant']);
  WP.hitMod = (e, amt, o) => {
    const P = XH.player, ct = P.traits;
    if (ct && ct.size) {
      if (ct.has('deadeye') && o.mult >= 2) amt *= 1.2;
      if (ct.has('exterminator') && SMALL.has(e.type)) amt *= 1.15;
      if (ct.has('biggame') && BIG.has(e.type)) amt *= 1.15;
      if (ct.has('bossbane') && e.def.boss) amt *= 1.25;
      if (ct.has('demolitions') && o.kind === 'explosive') amt *= 1.25;
      if (ct.has('butcher') && o.kind === 'melee') amt *= 2;
    }
    if (e.markT > e.t) amt *= 1.2;
    const slot = o.weapon && WP.has(o.weapon), tr = slot && slot.s.traits;
    if (XH.uniques) amt = XH.uniques.hitMod(e, amt, o, slot);
    if (slot && !o.chain && !(slot.stormCd > 0) && isElectric(slot.s) && Math.random() < stormChance(slot)) startStorm(slot, e, amt);
    if (!tr || !tr.size) return amt;
    const flat = o.dir ? new THREE.Vector3(o.dir.x, 0, o.dir.z).normalize() : null;
    if (tr.has('headhunter') && o.mult >= 2) amt *= 1.5;
    if (tr.has('executioner') && e.hp < e.maxHp * 0.35) amt *= 2;
    if (tr.has('giantslayer') && (e.def.heavy || e.def.boss || e.variant === 'elite')) amt *= 1.5;
    if (tr.has('closeq')) { const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); amt *= d < 6 ? 1.4 : d > 15 ? 0.8 : 1; }
    if (tr.has('shred') && (o.mult || 1) < 1) amt /= o.mult;
    if (tr.has('marker')) e.markT = e.t + 3;
    if (tr.has('stagger') && !e.def.heavy && !e.def.boss) { e.stunT = Math.max(e.stunT, 0.22); if (flat) e.vel.addScaledVector(flat, 3); }
    if (tr.has('knockback') && !e.def.boss && flat) e.vel.addScaledVector(flat, e.def.heavy ? 2 : 6);
    if (tr.has('suppress')) e.chill = Math.min(0.9, (e.chill || 0) + 0.12);
    if (tr.has('shock') && !o.chain && Math.random() < 0.25) { const n = XH.enemies.nearest(e.center(), 6, (q) => q !== e); if (n) { FX.bolt(e.center(), n.center(), 0x9fc8ff, 0.12, 8, 0.3); XH.enemies.damage(n, amt * 0.6, { kind: 'arc', weapon: o.weapon, chain: true, point: n.center(), quiet: true }); } }
    return amt;
  };
  // kill-time weapon traits; returns the points multiplier
  WP.killMod = (e, o) => {
    const slot = o.weapon && WP.has(o.weapon), tr = slot && slot.s.traits, P = XH.player; let m = 1;
    if (tr) {
      if (tr.has('bounty')) m *= 1.5;
      if (tr.has('vampiric')) P.hp = Math.min(P.maxHp, P.hp + 5);
      if (tr.has('scavenger') && slot.ammo < slot.s.mag) slot.ammo++;
    }
    if (P.traits && P.traits.has('adrenaline') && P.time - (P.lastHurt || -99) < 3) P.hp = Math.min(P.maxHp, P.hp + 10);
    if (XH.uniques) m *= XH.uniques.killMod(e, o, slot);
    return m;
  };

  WP.reload = () => {
    const slot = WP.cur(); if (!slot) return;
    if (S.reloadT > 0 || S.switchT > 0 || S.knifeT > 0 || slot.ammo >= slot.s.mag || slot.reserve <= 0) return;
    S.reloadDur = slot.s.reload * (perk('rapid') ? 0.5 : 1) * (slot.s.traits && slot.s.traits.has('tactical') && slot.ammo > 0 ? 0.6 : 1); S.reloadT = S.reloadDur;
    if (XH.game.stats) XH.game.stats.reloads = (XH.game.stats.reloads || 0) + 1; S.reloadStage = 0; S.burstLeft = 0;
    A.loop('flame', false);
    if (perk('discharge') && S.dischargeCd <= 0) {
      S.dischargeCd = 3;
      const P = XH.player, c = P.pos.clone().setY(1), frac = 1 - slot.ammo / slot.s.mag;
      XH.enemies.radiusDamage(c, 5.5, (200 + 900 * frac) * XH.enemies.hpMul(XH.game.round), { kind: 'arc', stun: 1, weapon: 'discharge' });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; FX.bolt(c, c.clone().add(new THREE.Vector3(Math.cos(a) * 5, U.rand(-0.8, 0.8), Math.sin(a) * 5)), 0x70e8ff, 0.2, 7, 0.6); }
      FX.ring(P.pos.clone(), 5.5, 0x70e8ff, 0.35); FX.flash(c, 0x70e8ff, 4, 0.2, 10); A.play('arc');
    }
  };
  // ---- tactical: Lure Beacon ----
  WP.giveTactical = (type, n) => { S.tactical = { type, n }; XH.ui && XH.ui.tip && XH.ui.tip(type === 'decoy' ? 'decoy' : 'lure'); XH.ui && XH.ui.weaponChanged(WP.cur()); };
  WP.throwTactical = () => {
    const T = S.tactical;
    if (!T || T.n <= 0 || S.grenT > 0 || S.knifeT > 0) return;
    T.n--; S.grenT = 0.55;
    const cam = XH.player.cam, dir = cam.getWorldDirection(new THREE.Vector3());
    spawnProj({ pos: cam.position.clone().addScaledVector(dir, 0.6), vel: dir.multiplyScalar(16).add(new THREE.Vector3(0, 4, 0)), grav: 16, color: T.type === 'decoy' ? 0x60e0ff : 0xff3030, size: 0.12, bounce: true, grenade: true, frag: true, lure: true, decoy: T.type === 'decoy', fuse: 99 });
    A.play('throw'); XH.ui && XH.ui.weaponChanged(WP.cur());
  };
  function settleLure(pos) {
    pos.y = 0.1;
    const g = new THREE.Group(); g.position.copy(pos); BUILD.lure(g); g.scale.setScalar(2.4); scene.add(g);
    const halo = FX.glowSprite(0xff3030, 1.2, 0.8); halo.position.y = 0.3; g.add(halo);
    WP.lure = { pos: pos.clone(), group: g, halo, t: 0, dur: 8, beep: 0 };
    A.play('lure', { pos });
  }
  // Decoy Hologram: a flickering copy of you; creatures attack it until it breaks
  function settleDecoy(pos) {
    if (WP.lure) { scene.remove(WP.lure.group); WP.lure = null; }
    pos.y = XH.world.groundAt(pos.x, pos.z, 0.3, pos.y + 0.4);
    const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
    const mat = new THREE.MeshBasicMaterial({ color: 0x60e0ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    const part = (w, h, d, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = y; g.add(m); return m; };
    part(0.42, 0.8, 0.24, 1.15); part(0.26, 0.26, 0.26, 1.72); part(0.16, 0.75, 0.16, 0.4).position.x = -0.12; part(0.16, 0.75, 0.16, 0.4).position.x = 0.12;
    const gun = part(0.08, 0.1, 0.5, 1.25); gun.position.set(0.18, 1.25, 0.25);
    g.add(FX.glowSprite(0x60e0ff, 2.2, 0.35));
    g.rotation.y = XH.player.yaw + Math.PI;
    WP.lure = { kind: 'decoy', pos: pos.clone(), group: g, mat, t: 0, dur: 12, hp: 150, beep: 0 };
    A.play('powerup', { pos }); FX.ring(pos.clone().setY(0.1), 2, 0x60e0ff, 0.4);
  }
  function updLure(dt) {
    const L = WP.lure; if (!L) return;
    if (L.kind === 'decoy') {
      L.t += dt; L.mat.opacity = 0.3 + Math.random() * 0.25;
      if (L.hp <= 0 || L.t >= L.dur) { scene.remove(L.group); WP.lure = null; FX.burst({ pos: L.pos.clone().setY(1), n: 30, color: 0x60e0ff, speed: [2, 6], life: [0.3, 0.7], size: [0.25, 0.05] }); A.play('arc', { pos: L.pos, vol: 0.6 }); }
      return;
    }
    L.t += dt; L.beep -= dt;
    const on = Math.sin(L.t * (10 + L.t * 3)) > 0;
    L.halo.material.opacity = on ? 0.9 : 0.15; L.group.userData.bulb.material.color.setHex(on ? 0xff3030 : 0x401010);
    if (L.beep <= 0) { L.beep = Math.max(0.12, 0.45 - L.t * 0.04); A.play('lure', { pos: L.pos }); FX.ring(L.pos.clone().setY(0.1), 3, 0xff3030, 0.4); }
    if (L.t >= L.dur) {
      scene.remove(L.group); WP.lure = null;
      FX.explosion(L.pos.clone().setY(0.6), 7, 0xff4030); A.play('explosion', { pos: L.pos, size: 1.4 });
      XH.enemies.radiusDamage(L.pos.clone().setY(0.5), 7.5, 1e6, { kind: 'explosive', weapon: 'lure' });
      const P = XH.player, d = P.pos.distanceTo(L.pos); if (d < 7 && !perk('plating')) P.hurt(40 * (1 - d / 7), L.pos, true);
    }
  }
  // ---- shield (raised with X) ----
  WP.setShield = (d) => { S.shieldWant = d; };
  WP.shieldUp = () => S.shieldT > 0.5;
  let vmShield = null;
  function shieldBash() {
    const P = XH.player, dir = P.cam.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    S.bashCd = 0.75; S.bashT = 0.25; A.play('knife'); let hit = false;
    for (const e of XH.enemies.list.slice()) {
      if (e.dead || e.state === 'burrowed' || e.turned) continue;
      const v = e.pos.clone().sub(P.pos).setY(0), d = v.length() - e.radius;
      if (d > 2.8 || v.normalize().dot(dir) < 0.35) continue;
      hit = true;
      XH.enemies.damage(e, 450 * XH.enemies.hpMul(XH.game.round) * (e.def.heavy ? 0.3 : 1), { kind: 'melee', point: e.center(), dir, stun: 0.9, weapon: 'shield' });
      if (!e.def.heavy) e.vel.addScaledVector(dir, 9);
    }
    if (hit) { A.play('knifeHit'); FX.shake(0.25); if (P.shield) { P.shield.hp -= 40; if (P.shield.hp <= 0) XH.sys.shieldBroken(); XH.ui.shieldChanged(); } }
  }
  // ---- mutation effects (Pack-a-Punch style ammo) ----
  function procAAT(slot, e, point, chance) {
    if (!slot || !slot.upg || !slot.aat || (slot.aatCd || 0) > 0 || !e || Math.random() > chance) return;
    slot.aatCd = 5;
    let k = slot.aats && slot.aats.length ? U.pick(slot.aats) : slot.aat;
    const E = XH.enemies, hm = E.hpMul(XH.game.round) * (1 + 0.3 * ((slot.tier || 1) - 1)), c = (point || e.center()).clone();
    if (k === 'turned' && (e.dead || !E.turn(e, 15))) k = 'shock';
    XH.ui.aatProc(k);
    if (k === 'shock') {
      let from = c.clone(), cur = e.dead ? E.nearest(c, 8) : e; const done = new Set();
      for (let n = 0; n < 7 && cur; n++) {
        done.add(cur); const to = cur.center();
        FX.bolt(from, to, 0x9fd8ff, 0.25, 10, 0.8); FX.bolt(from, to, 0xffffff, 0.1, 6, 0.4); FX.electric(to);
        E.damage(cur, 520 * hm, { kind: 'arc', point: to, stun: 1.2, weapon: 'aat' });
        from = to; cur = E.nearest(from, 8, (q) => !done.has(q));
      }
      A.play('arc', { pos: c });
    } else if (k === 'furnace') {
      FX.burst({ pos: c, n: 50, color: 0xffe080, color2: 0xff3000, speed: [3, 9], life: [0.3, 0.8], size: [0.5, 1.6], drag: 2 });
      FX.flash(c, 0xff6020, 5, 0.4, 14); FX.ring(c.clone().setY(0.1), 5, 0xff6020, 0.4);
      E.radiusDamage(c, 5, 320 * hm, { kind: 'fire', burn: true, weapon: 'aat' });
      A.play('launcher', { pos: c });
    } else if (k === 'cryo') {
      FX.burst({ pos: c, n: 50, color: 0xe8f8ff, color2: 0x60c0ff, speed: [3, 10], life: [0.4, 0.9], size: [0.3, 0.8], drag: 2 });
      FX.ring(c.clone().setY(0.1), 6, 0xa8f0ff, 0.5); A.play('cryo', { pos: c });
      for (const q of E.list) { if (q.dead || q.turned || q.def.boss || q.center().distanceTo(c) > 6) continue; q.frozenT = 3; q.chill = 1.3; E.damage(q, 120 * hm, { kind: 'cryo', quiet: true, weapon: 'aat' }); }
    } else if (k === 'gravity') {
      spawnVoid(c, 0.6, false, 2.2);
    }
  }
  WP.procAAT = procAAT;
  // ---- electric guns: the arc guns (Arc Lance, Spark Pistol, Tesla Coil, Stormbreaker) and the arcing energy guns (Ionic AR, Pulse Cannon) ----
  function isElectric(s) { return !!s && (s.mode === 'arc' || !!(s.traits && (s.traits.has('shock') || s.traits.has('arcchain') || s.traits.has('tempest')))); }
  WP.isElectric = isElectric;
  // can a bolt get from a to b without going through a wall
  const _lv = new THREE.Vector3();
  function clearPath(a, b) { const d = a.distanceTo(b); if (d < 0.5) return true; _lv.subVectors(b, a).divideScalar(d); return XH.world.raycast(a, _lv, d).t > d - 0.4; }
  // Pack-a-Punched: a round that hits the ground (or a wall) discharges, and bolts leap out from it to the creatures nearby
  function groundArc(slot, p, n) {
    if (!slot || !slot.upg || !isElectric(slot.s) || (slot.gaCd || 0) > 0) return;
    slot.gaCd = 0.2; // fast guns discharge every few rounds, not on every one
    const s = slot.s, E = XH.enemies, arc = s.mode === 'arc', R = arc ? 7 : 5.5, max = arc ? 3 + Math.min(5, s.chains || 0) : 4;
    const o = p.clone(); if (n) o.addScaledVector(n, 0.25); else o.y += 0.25;
    FX.electric(o); FX.electric(o); FX.ring(o, R * 0.55, 0x9fc8ff, 0.3); FX.flash(o, 0x9fc8ff, 3, 0.14, R * 1.6);
    for (let k = 0; k < 4; k++) { const a = Math.random() * Math.PI * 2, r = U.rand(1, 2.4); FX.bolt(o, new THREE.Vector3(o.x + Math.cos(a) * r, Math.max(0.05, o.y - 0.2), o.z + Math.sin(a) * r), 0x9fc8ff, 0.12, 5, 0.35); }
    const done = new Set(), dir = new THREE.Vector3(); let hit = 0;
    while (hit < max) {
      const e = E.nearest(o, R, (q) => !done.has(q)); if (!e) break;
      done.add(e); const c = e.center();
      if (!clearPath(o, c)) continue;
      const d = c.distanceTo(o); dir.subVectors(c, o).normalize();
      FX.bolt(o, c, 0x9fc8ff, 0.18, 9, 0.7); FX.bolt(o, c, 0xffffff, 0.08, 6, 0.35); FX.electric(c);
      E.damage(e, s.dmg * dmgMul() * (arc ? 0.75 : 1.2) * (1 - d / R * 0.4), { kind: 'arc', point: c, dir, weapon: slot.id, stun: 0.35, quiet: hit > 1, chain: hit > 0 }); // one storm roll per shot
      hit++;
    }
    A.play('arc', { pos: o, vol: hit ? 1 : 0.5 });
  }
  // any electric gun: now and then a hit sets off a chain storm that leaps from creature to creature, up to 50 of them
  const storms = [], STORM_MAX = 50;
  // one roll per shot: about one storm every five or six seconds of steady hits, whatever the gun's rate of fire
  function stormChance(slot) { return (slot.upg ? 0.08 : 0.05) * U.clamp((slot.s.rate || 0.3) / 0.3, 0.25, 1.5); }
  function startStorm(slot, e, amt) {
    slot.stormCd = 3;
    const c = e.center();
    storms.push({ id: slot.id, from: c, done: new Set([e]), n: 1, dmg: Math.max(amt, slot.s.dmg) * 0.7, t: 0.05 });
    FX.flash(c, 0xbfe0ff, 5, 0.25, 16); FX.ring(c, 3, 0x9fc8ff, 0.35); FX.electric(c); A.play('arc', { pos: c });
  }
  function updStorms(dt) {
    const E = XH.enemies;
    for (let i = storms.length - 1; i >= 0; i--) {
      const st = storms[i]; st.t -= dt;
      while (st.t <= 0) {
        // the nearest creature it has not hit yet, that it can reach without going through a wall
        let e = null;
        for (let tries = 0; tries < 6 && st.n < STORM_MAX; tries++) { const q = E.nearest(st.from, 9, (x) => !st.done.has(x)); if (!q) break; if (clearPath(st.from, q.center())) { e = q; break; } st.done.add(q); }
        if (!e) { storms.splice(i, 1); break; }
        const c = e.center();
        FX.bolt(st.from, c, 0x9fd8ff, 0.22, 9, 0.8); FX.bolt(st.from, c, 0xffffff, 0.1, 5, 0.4); FX.electric(c);
        st.done.add(e); st.n++;
        E.damage(e, st.dmg * Math.max(0.4, Math.pow(0.97, st.n)), { kind: 'arc', point: c, weapon: st.id, chain: true, stun: 0.3, quiet: st.n % 4 !== 0 });
        if (st.n % 5 === 0) A.play('arc', { pos: c, vol: 0.6 });
        st.from = c; st.t += 0.045;
      }
    }
  }
  WP.storms = storms;
  // Neural Link: snap to the nearest head in view when you aim
  function aimAssist() {
    const P = XH.player, cam = P.cam, fwd = cam.getWorldDirection(new THREE.Vector3());
    let best = null, bestA = 0.2;
    for (const e of XH.enemies.list) {
      if (e.dead || e.state === 'burrowed' || e.state === 'emerge' || e.turned) continue;
      const h = e.hit.find((q) => q.mult >= 2) || e.hit[0];
      const hp = h.node.localToWorld(h.off.clone()), v = hp.clone().sub(cam.position), d = v.length();
      if (d > 45) continue;
      const a = Math.acos(U.clamp(v.clone().normalize().dot(fwd), -1, 1));
      if (a >= bestA) continue;
      if (XH.world.raycast(cam.position, v.clone().normalize(), d).t < d - 0.3) continue;
      bestA = a; best = hp;
    }
    if (best) { const dx = best.x - cam.position.x, dy = best.y - cam.position.y, dz = best.z - cam.position.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }
  }
  WP.isReloading = () => S.reloadT > 0;
  WP.setTrigger = (d) => { S.trigger = d; };
  WP.setAds = (d) => { S.adsWant = d; };
  WP.adsAmount = () => S.adsT;
  WP.knife = () => {
    if (S.knifeT > 0) return;
    S.knifeT = 0.5; S.knifeHit = false; S.reloadT = 0; S.burstLeft = 0;
    A.play('knife');
  };
  WP.throwGrenade = () => {
    if (S.lethal === 'turret' && XH.loadout) { XH.loadout.deploy(); return; }
    if (S.grenT > 0 || S.grenades <= 0 || S.knifeT > 0) return;
    S.grenades--; S.grenT = 0.55;
    const cam = XH.player.cam, dir = cam.getWorldDirection(new THREE.Vector3());
    const pos = cam.position.clone().addScaledVector(dir, 0.6);
    const vel = dir.multiplyScalar(19).add(new THREE.Vector3(0, 4, 0)), base = 520 + XH.game.round * 60;
    if (S.lethal === 'semtex') spawnProj({ pos, vel, grav: 16, r: 4.6, dmg: base * 1.4, color: 0xff4030, size: 0.13, sticky: true, fuse: 1.4, grenade: true, frag: true });
    else if (S.lethal === 'cryo') spawnProj({ pos, vel, grav: 16, r: 6, dmg: base * 0.3, color: 0xa8f0ff, size: 0.14, bounce: true, fuse: 1.6, grenade: true, frag: true, freezeImpact: true });
    else spawnProj({ pos, vel, grav: 16, r: 5.5, dmg: base, color: 0xffb040, size: 0.14, bounce: true, fuse: 2.0, grenade: true, frag: true });
    A.play('throw');
    XH.ui && XH.ui.weaponChanged(WP.cur());
  };

  // spread in radians (current)
  WP.spread = () => {
    const slot = WP.cur(); if (!slot) return 0;
    const P = XH.player, s = slot.s;
    let sp = U.lerp(s.spread, s.ads, S.adsT);
    sp *= 1 + (P.moveFrac || 0) * 0.8 * (1 - S.adsT) + (P.airborne ? 1 : 0);
    if (P.crouch) sp *= 0.75;
    return sp + S.bloom * (1 - S.adsT * 0.7);
  };

  // =================== firing ===================
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3(), _mz = new THREE.Vector3(), _q = new THREE.Vector3();
  function muzzleWorld(out) {
    const cam = XH.player.cam;
    const off = new THREE.Vector3(U.lerp(0.2, 0, S.adsT), U.lerp(-0.16, -0.06, S.adsT), -0.7).applyQuaternion(cam.quaternion);
    return out.copy(cam.position).add(off);
  }
  function aimDir(out, spread) {
    const cam = XH.player.cam;
    cam.getWorldDirection(out);
    if (spread > 0) {
      const r = Math.sqrt(Math.random()) * spread, a = Math.random() * Math.PI * 2;
      const right = _q.set(1, 0, 0).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      out.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    }
    return out;
  }
  const patCache = {};
  function recoilPattern(id) {
    if (!patCache[id]) { let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 100003; const r = (k) => ((h * (k + 1) * 9301 + 49297) % 233280) / 233280; patCache[id] = { f: 0.35 + r(1) * 0.5, ph: r(2) * 6.28, bias: (r(3) - 0.5) * 0.8 }; }
    return patCache[id];
  }
  // spent casings fly out to the right and bounce once on the floor
  const shells = [], shellGeo = new THREE.BoxGeometry(0.014, 0.014, 0.04), brass = new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.9, roughness: 0.3 }), redShell = new THREE.MeshStandardMaterial({ color: 0xa02018, metalness: 0.3, roughness: 0.5 });
  shellGeo.userData.keep = true;
  const NO_SHELL = new Set(['Energy', 'Special', 'Wonder Weapon', 'Launcher']);
  function ejectShell(s) {
    if (s.mode !== 'hit' || s.beam || NO_SHELL.has(s.cls) || !scene) return;
    let sh = shells.find((q) => q.life <= 0);
    if (!sh) { if (shells.length >= 40) return; sh = { m: new THREE.Mesh(shellGeo, brass), vel: new THREE.Vector3(), life: 0 }; sh.m.frustumCulled = false; scene.add(sh.m); shells.push(sh); }
    const cam = XH.player.cam, f = cam.getWorldDirection(_sf), r = _sr.set(-f.z, 0, f.x).normalize();
    const big = s.cls === 'Shotgun';
    sh.m.material = big ? redShell : brass; sh.m.scale.setScalar(big ? 1.8 : s.cls === 'Pistol' ? 0.8 : 1);
    sh.m.position.copy(cam.position).addScaledVector(f, 0.35).addScaledVector(r, 0.16).add(_su.set(0, -0.1, 0));
    sh.vel.copy(r).multiplyScalar(U.rand(1.6, 2.6)).add(_su.set(0, U.rand(1.6, 2.6), 0)).addScaledVector(f, U.rand(-0.3, 0.4)).add(XH.player.vel);
    sh.spin = U.rand(12, 22); sh.life = 1.6; sh.bounced = false; sh.m.visible = true;
  }
  const _sf = new THREE.Vector3(), _sr = new THREE.Vector3(), _su = new THREE.Vector3();
  function updShells(dt) {
    for (const sh of shells) {
      if (sh.life <= 0) continue;
      sh.life -= dt; if (sh.life <= 0) { sh.m.visible = false; continue; }
      sh.vel.y -= 12 * dt; sh.m.position.addScaledVector(sh.vel, dt); sh.m.rotation.x += sh.spin * dt; sh.m.rotation.y += sh.spin * 0.6 * dt;
      const fl = XH.world.groundAt(sh.m.position.x, sh.m.position.z, 0.02, sh.m.position.y + 0.1);
      if (sh.m.position.y < fl + 0.01) { sh.m.position.y = fl + 0.01; if (!sh.bounced && sh.vel.y < -1) { sh.bounced = true; sh.vel.y *= -0.35; sh.vel.x *= 0.4; sh.vel.z *= 0.4; sh.spin *= 0.4; if (Math.random() < 0.5) A.play('shell', { pos: sh.m.position, vol: 0.25 }); } else { sh.vel.set(0, 0, 0); sh.spin = 0; } }
    }
  }
  WP.updShells = updShells;
  function onShotFx(slot) {
    const s = slot.s;
    S.fireFlash = 0.05; muzzleFlash.visible = true; muzzleFlash.material.color.set(s.flash || 0xffc070);
    muzzleFlash.material.rotation = Math.random() * 6; muzzleFlash.scale.setScalar(s.cls === 'Shotgun' || s.cls === 'Hand Cannon' ? 0.4 : 0.26);
    vmLight.intensity = 3; vmLight.color.set(s.flash || 0xffc070);
    FX.flash(muzzleWorld(_mz), s.flash || 0xffc070, 2.2, 0.06, 9);
    S.recoilZ += 0.05 + s.recoil * 0.8; S.recoilX += s.recoil * 3;
    // recoil pattern: each gun climbs and drifts the same way every time, so a spray can be learned and controlled
    const now = XH.player.time; if (now - (S.lastRecoilT || -9) > 0.35) S.heat = 0; S.lastRecoilT = now; S.heat = (S.heat || 0) + 1;
    const pat = recoilPattern(slot.id), steady = 1 - S.adsT * 0.4;
    const climb = s.recoil * (1 + Math.min(S.heat, 8) * 0.08), drift = s.recoil * 0.55 * (Math.sin(S.heat * pat.f + pat.ph) + pat.bias);
    XH.player.kick(climb * steady, (drift + (Math.random() - 0.5) * s.recoil * 0.15) * steady);
    ejectShell(s);
    S.bloom = Math.min(0.06, S.bloom + s.spread * 0.25);
    A.play(s.snd);
    if (slot.model && slot.model.userData.pump && !s.auto) S.pumpT = 0.5;
    if (slot.model && slot.model.userData.cylinder) slot.model.userData.cylinder.rotation.z += Math.PI / 3;
    if (s.noFlash) { muzzleFlash.visible = false; vmLight.intensity = 0.4; }
    if (s.recoil > 0.05) FX.shake(0.15);
  }
  function hitscan(slot) {
    const s = slot.s, P = XH.player, pellets = s.pellets || 1, sp = WP.spread();
    _o.copy(P.cam.position);
    muzzleWorld(_mz);
    for (let i = 0; i < pellets; i++) {
      aimDir(_d, sp);
      const wall = XH.world.raycast(_o, _d, s.range);
      const wt = wall.t, wkind = wall.kind, wn = wall.n.clone();
      if (XH.secrets) XH.secrets.ray(_o, _d, wt);
      if (wkind === 'prop' && wall.prop && wall.prop.onShot) wall.prop.onShot(s.dmg * dmgMul());
      const hits = XH.enemies.rayHits(_o, _d, wt, s.pierce);
      let endT = wt;
      hits.forEach((h, k) => {
        let dmg = s.dmg * dmgMul() * (k === 0 ? 1 : 0.8) * (h.mult >= 2 && perk('neural') ? 1.25 : 1);
        if (s.falloff && !(s.traits && s.traits.has('marksman') && S.adsT > 0.8)) dmg *= U.clamp(1 - (h.t - 7) / 18, 0.3, 1);
        if (k > 0 && s.traits && s.traits.has('overpen')) dmg /= 0.8;
        XH.enemies.damage(h.e, dmg, { head: h.mult >= 2, mult: h.mult, point: h.point, dir: _d, kind: s.freeze ? 'cryo' : 'bullet', freeze: s.freeze, burn: s.burn, weapon: slot.id });
        if (k === 0 && i === 0) procAAT(slot, h.e, h.point, 0.22);
        if (s.splash) WP.explode(h.point, s.splash, s.dmg * 0.5, 0xff6020, true, true);
        if (k === hits.length - 1 && hits.length >= s.pierce) endT = h.t;
      });
      const end = _f.copy(_o).addScaledVector(_d, endT);
      if (s.beam) { FX.tracer(_mz, end, s.beam, 0.35); FX.bolt(_mz, end, 0xffffff, 0.12, 12, 0.08); }
      else if (Math.random() < (pellets > 1 ? 0.4 : 0.85)) FX.tracer(_mz, end, s.tracer, 0.05);
      if (!hits.length || hits.length < s.pierce) {
        if (wkind === 'wall' || wkind === 'floor' || wkind === 'ceil') {
          const hp = _o.clone().addScaledVector(_d, wt);
          if (s.freeze) FX.burst({ pos: hp, n: 4, color: 0xc0f0ff, speed: [1, 3], dir: wn, life: [0.2, 0.4], size: [0.12, 0.03] });
          else FX.sparks(hp, wn);
          if (Math.random() < 0.6) FX.hole(hp, wn);
          if (s.splash) WP.explode(hp, s.splash, s.dmg * 0.5, 0xff6020, true, true);
          if (slot.upg) groundArc(slot, hp, wn);
        }
      }
    }
  }
  function arcShot(slot) {
    const s = slot.s, P = XH.player;
    _o.copy(P.cam.position); muzzleWorld(_mz); aimDir(_d, WP.spread());
    const wall = XH.world.raycast(_o, _d, 40);
    const hits = XH.enemies.rayHits(_o, _d, wall.t, 1);
    if (!hits.length) { const end = _o.clone().addScaledVector(_d, wall.t); FX.bolt(_mz, end, 0x9fc8ff, 0.12, 10, 0.5); FX.electric(end); if (wall.kind !== 'none') groundArc(slot, end, wall.n.clone()); return; }
    let cur = hits[0].e, from = _mz.clone(), dmg = s.dmg * dmgMul();
    const done = new Set();
    let to = hits[0].point.clone();
    for (let k = 0; k <= s.chains && cur; k++) {
      done.add(cur);
      FX.bolt(from, to, 0x9fc8ff, 0.16, 10, k === 0 ? 0.5 : 0.7); FX.bolt(from, to, 0xffffff, 0.08, 6, 0.3);
      FX.electric(to);
      XH.enemies.damage(cur, dmg, { point: to, dir: _d, kind: 'arc', weapon: slot.id, stun: 0.4, chain: k > 0 });
      if (k === 0) procAAT(slot, cur, to, 0.22);
      from = to.clone(); dmg *= 0.85;
      const next = XH.enemies.nearest(from, 8, (e) => !done.has(e));
      cur = next; if (next) to = next.center();
    }
  }
  function flameTick(slot) {
    const s = slot.s, P = XH.player, dir = P.cam.getWorldDirection(_d);
    muzzleWorld(_mz);
    if (s.kind === 'cryo') FX.frost(_mz, dir), FX.frost(_mz, dir);
    else if (s.kind === 'acid') FX.burst({ pos: _mz, n: 5, color: 0xb0ff40, color2: 0x40a010, speed: [10, 15], dir, spread: 0.15, life: [0.3, 0.55], size: [0.15, 0.9], drag: 2.5 });
    else FX.fire(_mz, dir, 1.2 * (slot.upg ? 1.4 : 1));
    if (slot.upg && !s.kind) FX.burst({ pos: _mz, n: 1, color: 0x80a0ff, speed: [12, 16], dir, spread: 0.1, life: [0.2, 0.35], size: [0.2, 0.8] });
    XH.enemies.forCone(P.cam.position, dir, s.range, s.cone, (e, dist) => {
      if (s.kind === 'cryo') XH.enemies.damage(e, s.dmg * dmgMul() * (1 - dist / s.range * 0.4), { kind: 'cryo', freeze: 0.06, weapon: slot.id, quiet: true });
      else XH.enemies.damage(e, s.dmg * dmgMul() * (1 - dist / s.range * 0.4), { kind: 'fire', burn: true, weapon: slot.id, quiet: true });
      procAAT(slot, e, null, 0.015);
    });
    FX.flash(_mz.clone().addScaledVector(dir, 2), s.kind === 'cryo' ? 0x80d0ff : s.kind === 'acid' ? 0x90ff40 : 0xff7a20, 2, 0.08, 10);
  }
  function projShot(slot) {
    const s = slot.s, P = XH.player; muzzleWorld(_mz);
    // aim at what the crosshair looks at
    aimDir(_d, WP.spread());
    const wall = XH.world.raycast(P.cam.position, _d, 200);
    const target = P.cam.position.clone().addScaledVector(_d, Math.max(4, wall.t));
    const dir = target.sub(_mz).normalize();
    const pr = s.proj, n = pr.pellets || 1;
    for (let k = 0; k < n; k++) {
      const d2 = dir.clone();
      if (n > 1) { d2.x += U.rand(-1, 1) * (pr.spread || 0.06); d2.y += U.rand(-1, 1) * (pr.spread || 0.06) * 0.6; d2.z += U.rand(-1, 1) * (pr.spread || 0.06); d2.normalize(); }
      spawnProj({ slot, pos: _mz.clone(), vel: d2.multiplyScalar(pr.speed * (n > 1 ? U.rand(0.9, 1.1) : 1)), grav: pr.grav, r: pr.r, dmg: s.dmg * dmgMul(), color: pr.color, size: pr.size, bounce: pr.bounce || pr.saw, fuse: pr.fuse || 3, grenade: pr.grenade, void: pr.void, voidR: s.voidR || 1, upg: slot.upg,
        homing: pr.homing, saw: pr.saw, rocket: pr.rocket, freezeImpact: pr.freezeImpact, turnImpact: pr.turnImpact, maxBounce: pr.saw ? 8 : 6, hitT: pr.saw ? new Map() : null });
    }
  }
  // continuous beam (Laser Lance etc.)
  function beamTick(slot) {
    const s = slot.s, P = XH.player; muzzleWorld(_mz); aimDir(_d, s.spread * 0.3);
    _o.copy(P.cam.position);
    const wall = XH.world.raycast(_o, _d, s.range || 70), hits = XH.enemies.rayHits(_o, _d, wall.t, s.pierce);
    hits.forEach((h, k) => { XH.enemies.damage(h.e, s.dmg * dmgMul() * (h.mult >= 2 ? 1.5 : 1), { kind: 'beam', point: h.point, dir: _d, weapon: slot.id, quiet: k > 0 || Math.random() < 0.7, burn: s.burn }); if (k === 0) procAAT(slot, h.e, h.point, 0.02); });
    const end = _o.clone().addScaledVector(_d, hits.length >= s.pierce ? hits[hits.length - 1].t : wall.t);
    const col = s.beam || 0xff3030;
    FX.tracer(_mz, end, col, 0.06); FX.tracer(_mz, end, 0xffffff, 0.03);
    FX.one(end.x, end.y, end.z, U.rand(-1, 1), U.rand(0, 2), U.rand(-1, 1), 0.25, 0.4, 0.05, col);
    if (Math.random() < 0.3) FX.flash(end, col, 1.5, 0.06, 6);
  }
  // cone shockwave (Thunderclap, Sonic Disruptor)
  function waveShot(slot) {
    const s = slot.s, P = XH.player, dir = P.cam.getWorldDirection(new THREE.Vector3()), flat = dir.clone().setY(0).normalize();
    muzzleWorld(_mz);
    XH.enemies.forCone(P.cam.position, dir, s.range, s.cone, (e, dist) => {
      const k = 1 - dist / s.range * 0.6;
      XH.enemies.damage(e, s.dmg * dmgMul() * k, { kind: 'wave', point: e.center(), dir, stun: 0.9, weapon: slot.id });
      if (!e.dead && !e.def.heavy) { e.vel.addScaledVector(flat, s.push * k); if (e.fly) e.pos.y += 0.5; }
    });
    for (let k = 0; k < 40; k++) { const d2 = dir.clone().add(new THREE.Vector3(U.rand(-1, 1), U.rand(-0.6, 0.6), U.rand(-1, 1)).multiplyScalar(s.cone)).normalize(); const sp = U.rand(12, 30); FX.one(_mz.x, _mz.y, _mz.z, d2.x * sp, d2.y * sp, d2.z * sp, 0.4, 0.4, 1.8, slot.s.flash || 0xa0c8ff, 0.7, 0, 3); }
    FX.ring(P.pos.clone().addScaledVector(flat, 3), s.range * 0.4, slot.s.flash || 0xa0c8ff, 0.3); FX.shake(0.35);
  }
  function fireOnce(slot) {
    if (XH.uniques) XH.uniques.onShot();
    const s = slot.s, tr = s.traits || new Set();
    if (!(XH.game.buffs.bottomless > 0)) slot.ammo--;
    if (s.mag >= 8 && slot.ammo > 0 && slot.ammo <= 3) A.play('uiHover', { vol: 0.5 }); // last rounds in the magazine
    shotMul = 1;
    if (tr.has('lastround') && slot.ammo === 0) shotMul *= 3;
    if (tr.has('firstshot') && XH.player.time - (S.lastShotT || -9) > 0.8) shotMul *= 2;
    if (tr.has('marksman') && S.adsT > 0.8) shotMul *= 1.25;
    S.lastShotT = XH.player.time;
    onShotFx(slot);
    if (s.mode === 'hit') hitscan(slot);
    else if (s.mode === 'arc') arcShot(slot);
    else if (s.mode === 'proj') projShot(slot);
    else if (s.mode === 'wave') waveShot(slot);
    shotMul = 1;
    XH.game.stats.shots++; S.shotSerial = (S.shotSerial || 0) + 1;
    const ws = XH.game.stats.ws || (XH.game.stats.ws = {}); ws[slot.id] = (ws[slot.id] || 0) + 1;
  }

  // =================== projectiles ===================
  const projectiles = [], voids = [];
  let scene;
  WP.initScene = (sc) => { scene = sc; };
  function spawnProj(o) {
    const mesh = o.void ? new THREE.Group() : FX.glowSprite(o.color, o.size * 4, 1);
    if (o.void) { const core = new THREE.Mesh(G.sph, glow(0x08000c)); core.scale.setScalar(0.22); mesh.add(core); mesh.add(FX.glowSprite(0xb040ff, 1.6, 0.9)); }
    else if (o.grenade) { const b = new THREE.Mesh(G.sph, M.olive); b.scale.set(0.07, 0.07, 0.1); mesh.add(b); mesh.scale.setScalar(1); mesh.material.opacity = 0.5; }
    else if (o.rocket) { const r = new THREE.Group(); const b = new THREE.Mesh(G.cyl, M.olive); b.scale.set(0.06, 0.45, 0.06); b.rotation.x = Math.PI / 2; r.add(b); const tip = new THREE.Mesh(G.cone, M.dark); tip.scale.set(0.06, 0.14, 0.06); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.29; r.add(tip); mesh.add(r); mesh.userData.body = r; mesh.material.opacity = 0.6; }
    else if (o.saw) { const d = new THREE.Mesh(G.cyl, M.metal); d.scale.set(0.28, 0.02, 0.28); mesh.add(d); for (let k = 0; k < 8; k++) { const t = new THREE.Mesh(G.cone, M.metal); t.scale.set(0.04, 0.1, 0.01); const a = k / 8 * Math.PI * 2; t.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); t.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2); mesh.add(t); } mesh.material.opacity = 0.3; }
    mesh.position.copy(o.pos); scene.add(mesh);
    projectiles.push(Object.assign({ mesh, life: 0, bounces: 0 }, o));
  }
  const _pp = new THREE.Vector3(), _step = new THREE.Vector3();
  function updProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life += dt;
      p.vel.y -= (p.grav || 0) * dt;
      if (p.homing && p.life > 0.12) {
        const sp = p.vel.length(), fwd = p.vel.clone().normalize();
        let best = null, bd = 40;
        for (const e of XH.enemies.list) { if (e.dead || e.turned || e.state === 'burrowed') continue; const v = e.center().sub(p.pos), d = v.length(); if (d < bd && v.normalize().dot(fwd) > 0.3) { bd = d; best = e; } }
        if (best) { const want = best.center().sub(p.pos).normalize().multiplyScalar(sp); p.vel.lerp(want, Math.min(1, dt * 5)); p.vel.setLength(sp); }
      }
      if (p.sticky) { // Sticky Charge: stick to the first thing it touches, then blow
        if (p.stuckTo) { if (!p.stuckTo.dead) p.pos.copy(p.stuckTo.pos).add(p.off); }
        else if (!p.stuck) {
          const sl = p.vel.length() * dt, sd = p.vel.clone().normalize(), h = XH.world.raycast(p.pos, sd, sl), en = XH.enemies.sphereHit(p.pos, 0.35);
          if (en) { p.stuckTo = en; p.off = p.pos.clone().sub(en.pos); A.play('slat', { pos: p.pos, vol: 0.6 }); }
          else if (h.kind !== 'none' && h.t < sl) { p.pos.addScaledVector(sd, h.t).addScaledVector(h.n, 0.05); p.stuck = true; A.play('slat', { pos: p.pos, vol: 0.6 }); }
          else p.pos.addScaledVector(p.vel, dt);
        }
        if (p.stuck || p.stuckTo) p.vel.set(0, 0, 0);
        p.mesh.position.copy(p.pos); if (Math.random() < 0.3) FX.one(p.pos.x, p.pos.y, p.pos.z, 0, 0.5, 0, 0.3, 0.12, 0.03, 0xff3020);
        if (p.life < p.fuse) continue;
      }
      _step.copy(p.vel).multiplyScalar(dt);
      const len = _step.length(), dir = _step.clone().normalize();
      let boom = !!p.sticky;
      const hit = XH.world.raycast(p.pos, dir, len);
      if (hit.kind !== 'none' && hit.t < len) {
        _pp.copy(p.pos).addScaledVector(dir, hit.t);
        if (p.bounce && p.bounces < (p.maxBounce || 6)) {
          p.pos.copy(_pp).addScaledVector(hit.n, 0.05);
          const vn = p.vel.dot(hit.n); p.vel.addScaledVector(hit.n, -2 * vn).multiplyScalar(p.saw ? 0.95 : 0.45);
          if (p.saw) { FX.sparks(p.pos.clone(), hit.n); A.play('bounce', { pos: p.pos }); }
          p.bounces++;
          if (Math.abs(vn) > 2) A.play('bounce', { pos: p.pos });
        } else { p.pos.copy(_pp).addScaledVector(hit.n, 0.1); boom = true; }
      } else p.pos.add(_step);
      if (!boom && p.saw) {
        for (const e of XH.enemies.list) {
          if (e.dead || e.turned || e.state === 'burrowed' || (p.hitT.get(e) || -9) > p.life - 0.35) continue;
          if (e.center().distanceTo(p.pos) > e.radius + 0.5) continue;
          p.hitT.set(e, p.life);
          XH.enemies.damage(e, p.dmg, { kind: 'bullet', point: p.pos.clone(), dir: p.vel.clone().normalize(), weapon: p.slot && p.slot.id });
        }
        if (p.life > 3.5) { scene.remove(p.mesh); projectiles.splice(i, 1); FX.sparks(p.pos.clone(), new THREE.Vector3(0, 1, 0)); continue; }
        p.mesh.rotation.y += dt * 30; p.mesh.position.copy(p.pos); continue;
      }
      if (!boom && !(p.frag)) {
        const e = XH.enemies.sphereHit(p.pos, p.void ? 0.6 : 0.3);
        if (e) boom = true;
      }
      if (!boom && p.void && p.life > 1.4) boom = true;
      if (!boom && p.fuse && p.bounce && p.life > p.fuse) boom = true;
      if (p.lure && (p.life > 2.5 || (p.bounces > 0 && p.vel.length() < 2.5))) { scene.remove(p.mesh); projectiles.splice(i, 1); if (p.decoy) settleDecoy(p.pos.clone()); else settleLure(p.pos.clone()); continue; }
      if (!boom && p.life > 6) boom = true;
      p.mesh.position.copy(p.pos);
      if (p.void) { p.mesh.rotation.y += dt * 6; FX.one(p.pos.x, p.pos.y, p.pos.z, U.rand(-1, 1), U.rand(-1, 1), U.rand(-1, 1), 0.4, 0.3, 0.05, 0xb040ff); }
      else if (p.rocket) { p.mesh.userData.body.lookAt(p.pos.clone().add(p.vel)); p.mesh.userData.body.rotateY(Math.PI); FX.one(p.pos.x, p.pos.y, p.pos.z, U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), U.rand(-0.3, 0.3), 1.2, 0.2, 1.1, 0x9a9a9a, 0.35, -0.3, 0.8, false); FX.one(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.1, 0.35, 0.05, 0xffa040); }
      else if (!p.grenade) FX.one(p.pos.x, p.pos.y, p.pos.z, 0, 0, 0, 0.18, p.size * 2.5, 0.05, p.color);
      else if (Math.random() < 0.5) FX.one(p.pos.x, p.pos.y, p.pos.z, 0, 0.3, 0, 0.4, 0.08, 0.2, 0x888888, 0.4, 0, 1, false);
      if (boom) {
        scene.remove(p.mesh); projectiles.splice(i, 1);
        if (p.void) spawnVoid(p.pos.clone(), p.voidR || 1, p.upg);
        else if (p.saw) FX.sparks(p.pos.clone(), new THREE.Vector3(0, 1, 0));
        else {
          if (p.turnImpact) {
            const e = XH.enemies.nearest(p.pos, 2.8);
            FX.burst({ pos: p.pos.clone(), n: 24, color: 0x70ff70, speed: [1, 5], life: [0.3, 0.7], size: [0.3, 0.05] }); A.play('hatch', { pos: p.pos });
            if (e && !XH.enemies.turn(e, 20)) XH.enemies.damage(e, p.dmg * 4, { kind: 'bullet', point: e.center(), weapon: p.slot && p.slot.id });
          } else WP.explode(p.pos.clone(), p.r, p.dmg, p.color, !p.grenade && !p.rocket, false, p.frag, p.slot && p.slot.id);
          if (p.freezeImpact) { FX.shatter(p.pos.clone()); FX.ring(p.pos.clone().setY(0.1), p.r * 1.2, 0xa8f0ff, 0.5); for (const q of XH.enemies.list) { if (q.dead || q.def.boss || q.center().distanceTo(p.pos) > p.r) continue; q.frozenT = 3.5; q.chill = 1.3; } }
          if (p.slot) { const e = XH.enemies.nearest(p.pos, p.r || 3); if (e) procAAT(p.slot, e, e.center(), 0.3); }
        }
      }
    }
  }
  // Explosion: damages enemies and (lightly) the player
  WP.explode = (pos, r, dmg, color = 0xff8a2a, small = false, noSelf = false, frag = false, wid = null) => {
    if (wid && XH.uniques) XH.uniques.onExplode(pos, r, dmg, wid);
    if (XH.secrets) XH.secrets.blast(pos, r);
    if (XH.hazards) XH.hazards.blast(pos, r, dmg);
    if (XH.logic) XH.logic.blast(pos, r, dmg);
    if (small) {
      FX.burst({ pos, n: 16, color: 0xfff0b0, color2: color, speed: [2, r * 3], life: [0.15, 0.35], size: [0.6, 0.1] });
      FX.flash(pos, color, 3, 0.15, r * 4); FX.ring(pos, r, color, 0.25);
      A.play('explosion', { pos, size: 0.4, vol: 0.5 });
    } else {
      FX.explosion(pos, r, color);
      A.play('explosion', { pos, size: r / 5 });
    }
    XH.enemies.radiusDamage(pos, r, dmg, { kind: 'explosive', weapon: wid || (frag ? 'frag' : 'explosion') });
    if (!noSelf && !perk('plating')) {
      const P = XH.player, d = P.pos.distanceTo(pos);
      if (d < r) P.hurt((frag ? 45 : 25) * (1 - d / r), pos, true);
    }
  };
  // singularity (wonder weapon)
  function spawnVoid(pos, rMul, upg, dur) {
    pos.y = Math.max(1.2, pos.y);
    const g = new THREE.Group(); g.position.copy(pos);
    const core = new THREE.Mesh(G.sph, glow(0x000000)); core.scale.setScalar(0.1); g.add(core);
    const halo = FX.glowSprite(0xb040ff, 1, 0.9); g.add(halo);
    const ring = new THREE.Mesh(G.torus, glow(0xe080ff)); ring.scale.setScalar(0.1); g.add(ring);
    scene.add(g);
    voids.push({ group: g, core, halo, ring, t: 0, dur: dur || (upg ? 5.5 : 4), R: 7.5 * rMul, pos });
    A.play('singularity', { pos });
    FX.flash(pos, 0xb040ff, 5, 0.6, 18);
  }
  function updVoids(dt) {
    for (let i = voids.length - 1; i >= 0; i--) {
      const v = voids[i]; v.t += dt;
      const k = Math.min(1, v.t / 0.4) * (v.t > v.dur - 0.4 ? Math.max(0, (v.dur - v.t) / 0.4) : 1);
      v.core.scale.setScalar(0.1 + k * 0.9);
      v.halo.scale.setScalar(1 + k * 6 + Math.sin(v.t * 20) * 0.3); v.halo.material.opacity = 0.7 * k;
      v.ring.scale.setScalar(0.5 + k * 1.8); v.ring.rotation.x = v.t * 3; v.ring.rotation.y = v.t * 2;
      for (let n = 0; n < 6; n++) {
        const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI, rr = v.R * U.rand(0.5, 1);
        const x = v.pos.x + Math.cos(a) * Math.cos(b) * rr, y = v.pos.y + Math.sin(b) * rr * 0.6, z = v.pos.z + Math.sin(a) * Math.cos(b) * rr;
        FX.one(x, y, z, (v.pos.x - x) * 1.8, (v.pos.y - y) * 1.8, (v.pos.z - z) * 1.8, 0.5, 0.12, 0.02, n % 2 ? 0xb040ff : 0xffffff);
      }
      XH.enemies.pullToward(v.pos, v.R, dt, k);
      if (v.t >= v.dur) {
        scene.remove(v.group); voids.splice(i, 1);
        FX.explosion(v.pos, 4, 0xb040ff);
        XH.enemies.radiusDamage(v.pos, 5, 3000, { kind: 'void', weapon: 'void' });
        A.play('explosion', { pos: v.pos, size: 0.8 });
      }
    }
  }

  // =================== update ===================
  const _hip = new THREE.Vector3(0.2, -0.19, -0.5);
  let flameAcc = 0;
  WP.update = (dt, input) => {
    const slot = WP.cur(); if (!slot) return;
    if (XH.logic && XH.logic.mounted) { S.lastTrigger = S.trigger; return; }
    const s = slot.s, P = XH.player;
    S.cd -= dt; S.grenT -= dt; S.switchT = Math.max(0, S.switchT - dt);
    S.bloom = Math.max(0, S.bloom - dt * 0.12);
    S.dischargeCd = Math.max(0, (S.dischargeCd || 0) - dt); S.bashCd = Math.max(0, (S.bashCd || 0) - dt); S.bashT = Math.max(0, (S.bashT || 0) - dt);
    for (const q of S.inv) { if (q.aatCd > 0) q.aatCd -= dt; if (q.gaCd > 0) q.gaCd -= dt; if (q.stormCd > 0) q.stormCd -= dt; }
    S.shieldT = U.clamp(S.shieldT + ((S.shieldWant && P.shield && !P.downed) ? dt : -dt) / 0.2, 0, 1);
    if (S.adsWant && !S.adsPrev && perk('neural')) aimAssist();
    S.adsPrev = S.adsWant;
    updLure(dt);
    const busy = S.switchT > 0 || S.knifeT > 0 || S.grenT > 0.2 || P.downed === 'down' || S.shieldT > 0.3;
    if (S.shieldT > 0.5 && S.trigger && !S.lastTrigger && S.bashCd <= 0) shieldBash();
    // ADS
    const adsOk = S.adsWant && !P.sprinting && S.reloadT <= 0 && S.knifeT <= 0;
    S.adsT = U.clamp(S.adsT + (adsOk ? dt : -dt) / (s.adsTime || 0.16), 0, 1);
    // reload progress
    // sprinting pauses a reload unless you have Extra Holster
    if (S.reloadT > 0 && !(P.sprinting && !perk('holster'))) {
      S.reloadT -= dt;
      const prog = 1 - S.reloadT / S.reloadDur;
      if (S.reloadStage === 0 && prog > 0.2) { S.reloadStage = 1; A.play('magout'); }
      if (S.reloadStage === 1 && prog > 0.62) { S.reloadStage = 2; A.play('magin'); }
      if (S.reloadStage === 2 && prog > 0.85) { S.reloadStage = 3; A.play('chamber'); }
      if (S.reloadT <= 0) { const n = Math.min(s.mag - slot.ammo, slot.reserve); slot.ammo += n; slot.reserve -= n; S.reloadT = 0; if (XH.uniques) XH.uniques.onReload(slot); }
    }
    // knife
    if (S.knifeT > 0) {
      S.knifeT -= dt;
      if (!S.knifeHit && S.knifeT < 0.36) {
        S.knifeHit = true;
        const e = XH.enemies.meleeTarget(P.cam.position, P.cam.getWorldDirection(_d), 2.6);
        if (e) {
          const dmg = 160 * (perk('vampire') ? 3 : 1);
          XH.enemies.damage(e, dmg, { kind: 'melee', point: e.center(), dir: _d, weapon: 'knife' });
          A.play('knifeHit'); FX.shake(0.15);
        }
      }
    }
    // firing
    const edge = S.trigger && !S.lastTrigger;
    S.lastTrigger = S.trigger;
    if (!S.trigger) S.rampT = Math.max(0, (S.rampT || 0) - dt * 3);
    let firing = false;
    if (!busy && S.reloadT <= 0) {
      if (s.spin) { S.spin = S.trigger ? Math.min(s.spin, S.spin + dt) : Math.max(0, S.spin - dt * 1.5); A.loop('spin', S.spin > 0.02, S.spin / s.spin); }
      const ready = !s.spin || S.spin >= s.spin;
      if (s.mode === 'flame' || s.mode === 'beam') {
        if (S.trigger && slot.ammo > 0) {
          firing = true; flameAcc += dt;
          while (flameAcc >= s.rate * rateMul()) { flameAcc -= s.rate * rateMul(); if (slot.ammo > 0) { if (!(XH.game.buffs.bottomless > 0)) slot.ammo--; if (s.mode === 'beam') beamTick(slot); else flameTick(slot); } }
          A.loop(s.mode === 'beam' ? 'beam' : 'flame', true); P.sprinting = false;
        } else { A.loop('flame', false); A.loop('beam', false); flameAcc = 0; if (S.trigger && edge && slot.ammo <= 0) { A.play('empty'); WP.reload(); } }
      } else if (S.burstLeft > 0) {
        S.burstT -= dt;
        if (S.burstT <= 0 && slot.ammo > 0) { fireOnce(slot); S.burstLeft--; S.burstT = 0.065; firing = true; }
        if (slot.ammo <= 0) S.burstLeft = 0;
      } else if (S.cd <= 0 && ready && (s.auto ? S.trigger : edge)) {
        if (slot.ammo > 0) {
          if (s.burst) { S.burstLeft = s.burst; S.burstT = 0; }
          else fireOnce(slot);
          if (s.traits && s.traits.has('ramp')) S.rampT = Math.min(1.5, (S.rampT || 0) + s.rate);
          S.cd = s.rate * rateMul() * (s.traits && s.traits.has('ramp') ? 1 - 0.375 * Math.min(1, (S.rampT || 0) / 1.5) : 1); firing = true; P.sprinting = false;
        } else if (edge || s.auto) {
          A.play('empty'); S.cd = 0.25;
          if (slot.reserve > 0) WP.reload();
        }
      }
      if (slot.ammo <= 0 && slot.reserve > 0 && S.cd <= 0 && S.burstLeft <= 0 && !S.trigger) WP.reload();
    } else { A.loop('flame', false); A.loop('beam', false); if (s.spin && !S.trigger) S.spin = Math.max(0, S.spin - dt * 1.5); }
    if (s.spin === undefined) A.loop('spin', false);
    WP.firing = firing;

    updProjectiles(dt);
    updVoids(dt);
    updStorms(dt);
    animateVM(dt, slot, input);
  };

  function animateVM(dt, slot, input) {
    const P = XH.player, m = slot.model; if (!m) return;
    updShells(dt);
    S.recoilZ = U.damp(S.recoilZ, 0, 14, dt); S.recoilX = U.damp(S.recoilX, 0, 12, dt);
    const idt = 1 / Math.max(dt, 1e-4);
    S.mvx = U.damp(S.mvx || 0, (input.mdx || 0) * idt, 12, dt); S.mvy = U.damp(S.mvy || 0, (input.mdy || 0) * idt, 12, dt);
    S.swayX = U.damp(S.swayX, U.clamp(-S.mvx * 0.000022, -0.05, 0.05), 10, dt);
    S.swayY = U.damp(S.swayY, U.clamp(-S.mvy * 0.000022, -0.05, 0.05), 10, dt);
    S.bobT = P.bobPhase || 0;
    const bobA = (P.sprinting ? 0.022 : 0.009) * (P.bobAmp || 0) * (1 - S.adsT * 0.85) * P.settings.bob;
    const ads = S.adsT, adsY = m.userData.adsY || -0.11;
    if (m.userData.stockParts) { const vis = ads < 0.55; if (m.userData.stockVis !== vis) { m.userData.stockVis = vis; m.userData.stockParts.forEach((o) => { o.visible = vis; }); } }
    const nearWant = 0.01 + ads * 0.07; if (Math.abs(vmCam.near - nearWant) > 0.003) { vmCam.near = nearWant; vmCam.updateProjectionMatrix(); }
    const hx = U.lerp(_hip.x, 0, ads), hy = U.lerp(_hip.y, adsY, ads), hz = U.lerp(_hip.z, m.userData.adsZ || -0.3, ads);
    let px = hx + Math.sin(S.bobT) * bobA + S.swayX * (1 - ads * 0.7);
    let py = hy - (1 + Math.cos(2 * S.bobT)) * 0.5 * bobA + S.swayY * (1 - ads * 0.7) + (P.landDip || 0) * -0.05;
    let pz = hz + S.recoilZ * (1 - ads * 0.5);
    let rx = S.recoilX * 0.6 + S.swayY * 0.5, ry = S.swayX * 0.8, rz = Math.sin(S.bobT) * bobA * 1.2;
    if (P.sprinting && ads < 0.1) { const k = 1; px += 0.04 * k; py -= 0.06 * k; ry += 0.6 * k; rz += 0.25 * k; rx -= 0.15; }
    if (S.reloadT > 0) {
      const pr = 1 - S.reloadT / S.reloadDur, k = Math.sin(Math.PI * U.clamp(pr * 1.15, 0, 1));
      py -= 0.09 * k; rx += 0.35 * k; rz -= 0.7 * k; px -= 0.03 * k;
    }
    if (S.switchT > 0) { const k = S.switchT / 0.45; py -= 0.35 * k; rx -= 0.8 * k; }
    if (S.grenT > 0) { const k = Math.sin(Math.PI * U.clamp(S.grenT / 0.55, 0, 1)); py -= 0.25 * k; rz += 0.3 * k; }
    if (P.downed === 'down') { py -= 0.05; rz += 0.3; }
    if (S.knifeT > 0) { const k = Math.sin(Math.PI * U.clamp(S.knifeT / 0.5, 0, 1)); py -= 0.3 * k; px += 0.1 * k; }
    if (S.shieldT > 0) { const k = U.smooth(S.shieldT); py -= 0.45 * k; rx -= 0.5 * k; }
    // scoped rail hides the gun
    m.visible = !(slot.s.scope && ads > 0.85);
    if (S.shieldT > 0.01 || vmShield) {
      if (!vmShield) { vmShield = XH.sys.shieldModel(); vmScene.add(vmShield); }
      const k = U.smooth(S.shieldT), b = S.bashT > 0 ? Math.sin(Math.PI * (1 - S.bashT / 0.25)) : 0;
      vmShield.visible = k > 0.01;
      vmShield.position.set(0.02 + S.swayX, -0.85 + k * 0.62 + S.swayY - (1 + Math.cos(2 * S.bobT)) * 0.5 * bobA, -0.62 - b * 0.25);
      vmShield.rotation.set(-0.05 + b * 0.2, 0.18, 0.04);
      vmShield.scale.setScalar(0.62);
    }
    for (const k in camoCache) { const cm = camoCache[k]; if (cm.emissiveMap && (k === 'abyss' || k === 'hive')) cm.emissiveMap.offset.y += dt * 0.04; }
    holder.position.set(px, py, pz);
    holder.rotation.set(rx, ry, rz);
    // knife swing
    if (S.knifeT > 0) {
      knife.visible = true; const t = 1 - S.knifeT / 0.5, k = U.smooth(U.clamp(t * 1.8, 0, 1));
      knife.position.set(U.lerp(0.35, -0.2, k), U.lerp(-0.25, -0.12, k), U.lerp(-0.35, -0.5, k));
      knife.rotation.set(-0.2, U.lerp(0.9, -0.6, k), U.lerp(-1.2, 0.4, k));
    } else knife.visible = false;
    // weapon-specific bits
    if (m.userData.spin) m.userData.spin.rotation.z += dt * (slot.id === 'havoc' ? S.spin * 40 : 2);
    if (m.userData.core) { const c = m.userData.core; c.scale.setScalar((c.userData.base || (slot.id === 'void' ? 0.045 : 0.035)) * (1 + Math.sin(performance.now() * 0.01) * 0.2)); }
    const scr = m.userData.ammoScreen; if (scr && scr.last !== slot.ammo) { scr.last = slot.ammo; scr.draw(slot.ammo, slot.s.mag); }
    if (m.userData.pump) { S.pumpT = Math.max(0, S.pumpT - dt); const k = Math.sin(Math.PI * U.clamp((0.5 - S.pumpT) / 0.4, 0, 1)) * (S.pumpT > 0 ? 1 : 0); m.userData.pump.position.z = (m.userData.pump.userData.z0 !== undefined ? m.userData.pump.userData.z0 : -0.36) + k * 0.1; if (m.userData.leftArm) m.userData.leftArm.position.z = k * 0.1; }
    S.fireFlash -= dt;
    if (S.fireFlash <= 0) muzzleFlash.visible = false;
    vmLight.intensity = Math.max(0, vmLight.intensity - dt * 30);
    M.camo.emissiveMap.offset.y += dt * 0.15;
  }
  WP.updateAspect = (a) => { if (vmCam) { vmCam.aspect = a; vmCam.updateProjectionMatrix(); } };
})();
