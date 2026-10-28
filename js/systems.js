'use strict';
// Black Ops-style systems: traps, boarded vents, Mutagen Capsules, secret eggs + song,
// buildable shield, main quest (pylons -> Hive Heart -> Overmind), Hive voice, intro flyover.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const SY = XH.sys = {};
  const W = () => XH.world, G = () => XH.game, P = () => XH.player, E = () => XH.enemies, WP = () => XH.weapons, UI = () => XH.ui;
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 12), hex = new THREE.CylinderGeometry(1, 1, 1, 6), sph = new THREE.SphereGeometry(1, 14, 10), cone = new THREE.ConeGeometry(1, 1, 6), tor = new THREE.TorusGeometry(1, 0.08, 6, 24);
  [box, cyl, hex, sph, cone, tor].forEach((g) => { g.userData.keep = true; });
  const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.3 }, o));
  const basic = (color, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color }, o));
  function mesh(parent, geo, mat, pos, scl, rot) { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (scl) m.scale.set(...scl); if (rot) m.rotation.set(...rot); parent.add(m); return m; }
  function label(text, color, w = 2, h = 0.5) {
    const t = U.labelTex([{ t: text, font: 'bold 60px Orbitron, Consolas, monospace', c: color }], { w: 512, h: 128, bg: 'rgba(0,0,0,0.75)', glow: color, border: color });
    t.userData = { transient: true };
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  }
  SY.label = label;


  // =====================================================================
  //  Models (built into the world root so they are disposed with the map)
  // =====================================================================
  SY.shieldModel = () => {
    const g = new THREE.Group();
    const plate = std(0x3a3f46, { metalness: 0.7, roughness: 0.35 }), bone = std(0xd8c8a0, { flatShading: true }), glow = basic(0x40ffb0);
    mesh(g, box, plate, [0, 0, 0], [0.95, 1.2, 0.07]);
    mesh(g, box, std(0x23272c), [0, 0, 0.04], [0.8, 1.02, 0.03]);
    mesh(g, cyl, glow, [0, 0.12, 0.07], [0.16, 0.02, 0.16], [Math.PI / 2, 0, 0]);
    mesh(g, tor, glow, [0, 0.12, 0.07], [0.26, 0.26, 0.5]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; mesh(g, cone, bone, [Math.cos(a) * 0.5, Math.sin(a) * 0.62, 0.02], [0.05, 0.3, 0.05], [0, 0, a - Math.PI / 2]); }
    mesh(g, box, plate, [0, -0.45, 0.06], [0.7, 0.08, 0.06]);
    mesh(g, box, std(0x2a2622), [0, 0, -0.08], [0.12, 0.35, 0.06]);
    return g;
  };
  function partModel(k) {
    const g = new THREE.Group(), mat = std(0x9aa4ae, { metalness: 0.7, roughness: 0.3 });
    if (k === 0) { mesh(g, box, mat, [0, 0, 0], [0.55, 0.4, 0.05], [0, 0, 0.1]); mesh(g, box, std(0x404850), [0, 0, 0.03], [0.4, 0.28, 0.03]); }
    else if (k === 1) { mesh(g, tor, std(0xd8c8a0, { flatShading: true }), [0, 0, 0], [0.3, 0.3, 2.5]); for (let i = 0; i < 4; i++) mesh(g, cone, std(0xd8c8a0), [Math.cos(i * 1.57) * 0.3, Math.sin(i * 1.57) * 0.3, 0], [0.04, 0.18, 0.04], [0, 0, i * 1.57 - 1.57]); }
    else { mesh(g, cyl, std(0x2a2622), [0, 0, 0], [0.05, 0.35, 0.05]); mesh(g, box, mat, [0, 0.2, 0], [0.3, 0.06, 0.1]); mesh(g, box, mat, [0, -0.2, 0], [0.3, 0.06, 0.1]); }
    const glow = FX.glowSprite(0x40ffb0, 1.4, 0.55); g.add(glow);
    return g;
  }

  SY.buildModels = (Wd) => {
    const root = Wd.root, sp = Wd.spots, S = Wd.sysM = { pylons: [], parts: [], eggs: [], traps: [] };
    const face = (s) => Math.atan2(s.dir[0], s.dir[1]);
    // ---- Mutagen Capsule machine ----
    if (sp.gum) {
      const g = new THREE.Group(); g.position.set(sp.gum.x, 0, sp.gum.z); g.rotation.y = face(sp.gum); root.add(g);
      mesh(g, cyl, std(0x2a1830, { metalness: 0.6 }), [0, 0.55, 0], [0.55, 1.1, 0.55]);
      mesh(g, cyl, std(0xc040a0, { metalness: 0.6 }), [0, 1.12, 0], [0.6, 0.08, 0.6]);
      const caps = new THREE.Group(); caps.position.y = 1.6; g.add(caps);
      const cols = [0xff4080, 0x40ff90, 0xffd040, 0x60a0ff, 0xff8030, 0xc060ff];
      for (let k = 0; k < 16; k++) mesh(caps, sph, std(cols[k % 6], { emissive: cols[k % 6], emissiveIntensity: 0.4, roughness: 0.2 }), [(Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6], [0.11, 0.11, 0.11]);
      mesh(g, sph, std(0xd0e8ff, { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 }), [0, 1.6, 0], [0.5, 0.48, 0.5]);
      mesh(g, cyl, std(0x2a1830, { metalness: 0.6 }), [0, 2.12, 0], [0.3, 0.1, 0.3]);
      const crank = new THREE.Group(); crank.position.set(0.58, 0.75, 0); g.add(crank);
      mesh(crank, cyl, std(0x888888, { metalness: 0.8 }), [0.1, 0, 0], [0.04, 0.2, 0.04], [0, 0, Math.PI / 2]);
      mesh(crank, box, std(0xc040a0), [0.2, 0.15, 0], [0.05, 0.3, 0.05]);
      mesh(g, box, basic(0x000000), [0, 0.5, 0.56], [0.25, 0.2, 0.02]);
      const sign = label('MUTAGEN', '#ff60d0', 1.4, 0.35); sign.position.set(0, 2.45, 0); g.add(sign);
      const glow = FX.glowSprite(0xff60d0, 2.4, 0.4); glow.position.y = 1.6; g.add(glow);
      Wd.addCyl(sp.gum.x, sp.gum.z, 0.62, 2.2, { mount: false });
      S.gum = { g, caps, crank, pos: new THREE.Vector3(sp.gum.x + sp.gum.dir[0] * 1.6, 0, sp.gum.z + sp.gum.dir[1] * 1.6), spin: 0 };
    }
    // ---- workbench ----
    if (sp.bench) {
      const g = new THREE.Group(); g.position.set(sp.bench.x, 0, sp.bench.z); g.rotation.y = face(sp.bench); root.add(g);
      const wood = std(0x4a3a2a, { roughness: 0.9, metalness: 0 }), metal = std(0x505860, { metalness: 0.7 });
      mesh(g, box, wood, [0, 0.95, 0], [2.0, 0.1, 1.0]);
      for (const [x, z] of [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]]) mesh(g, box, metal, [x, 0.45, z], [0.08, 0.9, 0.08]);
      mesh(g, box, metal, [0, 0.35, 0], [1.8, 0.05, 0.9]);
      mesh(g, box, metal, [-0.7, 1.1, -0.3], [0.2, 0.2, 0.25]); mesh(g, cyl, metal, [-0.4, 1.02, 0.2], [0.03, 0.4, 0.03], [0, 0, Math.PI / 2]);
      mesh(g, box, std(0xc03020), [0.6, 1.05, -0.25], [0.35, 0.12, 0.2]);
      const bp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), basic(0x40a0ff, { transparent: true, opacity: 0.6 })); bp.rotation.x = -Math.PI / 2; bp.position.set(0.1, 1.011, 0.1); g.add(bp);
      const sign = label('WORKBENCH', '#40ffb0', 1.3, 0.32); sign.position.set(0, 1.9, -0.45); g.add(sign);
      const shield = SY.shieldModel(); shield.position.set(0.1, 1.35, 0.05); shield.rotation.x = -0.4; shield.visible = false; g.add(shield);
      Wd.addPropRot(sp.bench.x, sp.bench.z, 2.0, 1.0, face(sp.bench), 1.05, { mount: false });
      S.bench = { g, shield, bp, pos: new THREE.Vector3(sp.bench.x + sp.bench.dir[0] * 1.6, 0, sp.bench.z + sp.bench.dir[1] * 1.6) };
    }
    // ---- shield parts ----
    sp.parts.forEach((s, k) => {
      const g = partModel(k); g.position.set(s.x, 1, s.z); root.add(g);
      S.parts.push({ g, pos: new THREE.Vector3(s.x, 0, s.z), k, taken: false });
    });
    // ---- secret eggs ----
    const eggMat = std(0xe08040, { emissive: 0x902808, roughness: 0.3, transparent: true, opacity: 0.9 });
    sp.eggs.forEach((s) => {
      const g = new THREE.Group(); const wd = Wd.wallDir(s.cx, s.cz) || [0, 1];
      g.position.set(s.x + wd[0] * (Wd.rough ? 0.45 : 0.8), 0, s.z + wd[1] * (Wd.rough ? 0.45 : 0.8)); root.add(g);
      const egg = mesh(g, sph, eggMat, [0, 0.45, 0], [0.32, 0.45, 0.32]); Wd.addProp(g.position.x, g.position.z, 0.34, 0.34, 0.9, { bullets: false });
      for (let k = 0; k < 5; k++) mesh(g, cone, std(0x6a2040, { flatShading: true }), [Math.cos(k * 1.25) * 0.3, 0.1, Math.sin(k * 1.25) * 0.3], [0.05, 0.4, 0.05], [Math.sin(k * 1.25) * 0.6, 0, -Math.cos(k * 1.25) * 0.6]);
      const glow = FX.glowSprite(0xff8030, 1.2, 0.5); glow.position.y = 0.45; g.add(glow);
      S.eggs.push({ g, egg, glow, pos: new THREE.Vector3(s.x, 0, s.z), done: false });
    });
    // ---- quest pylons ----
    sp.pylons.forEach((s) => {
      const g = new THREE.Group(); g.position.set(s.x, 0, s.z); root.add(g); Wd.addCyl(s.x, s.z, 0.72, 3.3, { mount: false });
      const shell = std(0x2a1e30, { flatShading: true, metalness: 0.4 });
      mesh(g, hex, shell, [0, 0.2, 0], [0.75, 0.4, 0.75]);
      mesh(g, new THREE.CylinderGeometry(0.22, 0.38, 2.2, 6), shell, [0, 1.4, 0]);
      const runeMat = basic(0x301040);
      const rings = [0.8, 1.4, 2.0].map((y) => mesh(g, tor, runeMat, [0, y, 0], [0.42 - y * 0.06, 0.42 - y * 0.06, 1], [Math.PI / 2, 0, 0]));
      const crystal = mesh(g, new THREE.OctahedronGeometry(0.35), basic(0x401060), [0, 2.9, 0], [1, 1.6, 1]);
      const glow = FX.glowSprite(0xb040ff, 3, 0.15); glow.position.y = 2.9; g.add(glow);
      S.pylons.push({ g, rings, crystal, glow, runeMat, pos: new THREE.Vector3(s.x + s.dir[0] * 1.5, 0, s.z + s.dir[1] * 1.5), center: new THREE.Vector3(s.x, 2.4, s.z), state: 'dormant', souls: 0, need: 10 });
    });
    // ---- traps on doors that open off the starting zone ----
    // Two of them (dtrap0, dtrap1). The map editor can move one to another door (place.dtrapN = { door }), leave it out
    // ({ off }) or stand its lever anywhere (place['dtrapN.lever'] = { x, z }).
    const pin = (k) => XH.edits && XH.edits.pin(k), pins = [pin('dtrap0'), pin('dtrap1')];
    const auto = Object.keys(Wd.doors).filter((id) => !pins.some((p) => p && p.door === id));
    for (let slot = 0; slot < 2; slot++) {
      const ps = pins[slot]; if (ps && ps.off) continue;
      if (!ps && Wd.auto === false) continue; // a map of your own: only where you put one
      const tries = ps && ps.door !== undefined && Wd.doors[ps.door] ? [ps.door] : auto;
      for (const id of tries) { if (doorTrap(slot, id, tries.length === 1)) { const k = auto.indexOf(id); if (k >= 0) auto.splice(k, 1); break; } }
    }
    function doorTrap(slot, id, forced) {
      const d = Wd.doors[id], lp = pin('dtrap' + slot + '.lever');
      // lever spot: a free cell beside the door, preferring one with no crates or rocks in front of it
      let lever = null;
      if (!lp) for (const ci of d.cells) {
        const x = ci % Wd.w, z = (ci / Wd.w) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz, ni = nz * Wd.w + nx;
          if (!Wd.inside(nx, nz) || (!Wd.reach[ni] && !forced) || Wd.solid[ni] || d.cells.includes(ni)) continue; // a door picked by hand takes any floor beside it
          const clear = !Wd.propAt(Wd.cx2x(nx), Wd.cz2z(nz), 1.3);
          if (!lever || (clear && !lever.clear)) lever = { cx: nx, cz: nz, clear };
        }
        if (lever && lever.clear) break;
      }
      if (!lever && !lp) return false;
      const kind = Wd.def.theme === 'hive' ? 'fire' : 'shock';
      const lx = lp ? lp.x : Wd.cx2x(lever.cx), lz = lp ? lp.z : Wd.cz2z(lever.cz);
      const wd = lp ? null : Wd.wallDir(lever.cx, lever.cz);
      let dcx = 0, dcz = 0; for (const ci of d.cells) { dcx += Wd.cx2x(ci % Wd.w) / d.cells.length; dcz += Wd.cz2z((ci / Wd.w) | 0) / d.cells.length; }
      const g = new THREE.Group(); root.add(g);
      if (wd) { const inset = Wd.CELL / 2 - (Wd.rough ? 0.45 : 0.1); g.position.set(lx + wd[0] * inset, 0, lz + wd[1] * inset); g.rotation.y = Math.atan2(-wd[0], -wd[1]); }
      else { g.position.set(lx, 0, lz); if (lp) g.rotation.y = Math.atan2(dcx - lx, dcz - lz); mesh(g, cyl, std(0x303438), [0, 0.6, 0], [0.08, 1.2, 0.08]); Wd.addProp(lx, lz, 0.4, 0.2, 2.1); }
      mesh(g, box, std(0x30343a, { metalness: 0.6 }), [0, 1.35, 0], [0.7, 0.9, 0.12]);
      mesh(g, box, std(0xd8a020), [0, 1.82, 0.02], [0.72, 0.1, 0.13]);
      const handle = new THREE.Group(); handle.position.set(0, 1.35, 0.08); g.add(handle);
      mesh(handle, box, std(0x202020), [0, 0.2, 0], [0.06, 0.4, 0.06]);
      const lamp = mesh(g, sph, basic(0x30ff60), [0.25, 1.65, 0.07], [0.06, 0.06, 0.06]);
      const sign = label(kind === 'fire' ? 'FLAME TRAP' : 'SHOCK TRAP', kind === 'fire' ? '#ff8030' : '#70d0ff', 0.9, 0.22); sign.position.set(0, 2.05, 0.07); g.add(sign);
      // floor emitters over the door cells
      const plates = [];
      for (const ci of d.cells) {
        const x = Wd.cx2x(ci % Wd.w), z = Wd.cz2z((ci / Wd.w) | 0);
        const pl = mesh(root, box, std(0x1c1f22, { metalness: 0.7, emissive: kind === 'fire' ? 0xff5010 : 0x40a0ff, emissiveIntensity: 0.05 }), [x, 0.02, z], [Wd.CELL * 0.9, 0.04, Wd.CELL * 0.9]);
        plates.push(pl);
      }
      S.traps.push({ door: d, kind, cells: new Set(d.cells), pos: new THREE.Vector3(lx, 0, lz), handle, lamp, plates, state: 'ready', t: 0 });
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const ci of d.cells) { const x = Wd.cx2x(ci % Wd.w), z = Wd.cz2z((ci / Wd.w) | 0); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const nm = (kind === 'fire' ? 'Flame trap' : 'Shock trap') + ' (door ' + id + ')';
      Wd.piece('dtrap' + slot, { label: nm, shape: 'door', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0 + Wd.CELL, d: z1 - z0 + Wd.CELL, off: true });
      Wd.piece('dtrap' + slot + '.lever', { label: nm.replace(' (', ' lever ('), shape: 'point', x: lx, z: lz, r: 0.4 });
      return true;
    }
    // ---- sentry guns on lamp posts / ceiling lights: they come online with the power ----
    S.sentries = [];
    if (Wd.auto !== false && Wd.def.power && Wd.lights.some((l) => !l.noSentry) && Wd.def.theme !== 'hive') {
      const L = Wd.lights.filter((l) => !l.noSentry), st = Wd.start;
      L.sort((a, b) => Math.hypot(a.x - st.x, a.z - st.z) - Math.hypot(b.x - st.x, b.z - st.z));
      const picks = [L[0]];
      while (picks.length < Math.min(4, L.length)) {
        let best = null, bd = -1;
        for (const c of L) { if (picks.includes(c)) continue; const d = Math.min(...picks.map((p) => Math.hypot(p.x - c.x, p.z - c.z))); if (d > bd) { bd = d; best = c; } }
        picks.push(best);
      }
      for (const l of picks) S.sentries.push(sentryModel(Wd, root, l));
    }
    Wd.soften('GK$');
  };
  function sentryModel(Wd, root, l) {
    const ceil = Wd.def.ceiling, city = Wd.def.theme === 'city', y = ceil ? Wd.def.wallH - 0.7 : city ? 2.2 : 3.2;
    const g = new THREE.Group(); g.position.set(l.x, y, l.z); root.add(g);
    const dark = std(0x24282c, { metalness: 0.7 }), body = std(0x646a72, { metalness: 0.6, roughness: 0.35 }), stripe = std(0xd8a020);
    if (ceil) mesh(g, cyl, dark, [0, 0.35, 0], [0.06, 0.7, 0.06]);
    else if (city) { mesh(g, cyl, dark, [0, -1.1, 0], [0.16, 2.2, 0.16]); mesh(g, hex, dark, [0, -2.15, 0], [0.4, 0.1, 0.4]); Wd.addCyl(l.x, l.z, 0.3, 2.5, { mount: false }); }
    else mesh(g, box, dark, [0, -0.05, 0], [0.34, 0.22, 0.34]);
    const yaw = new THREE.Group(); yaw.position.y = ceil ? -0.12 : 0.2; g.add(yaw);
    const pitch = new THREE.Group(); yaw.add(pitch);
    mesh(pitch, box, body, [0, 0, 0], [0.44, 0.3, 0.56]);
    mesh(pitch, box, stripe, [0, 0.155, -0.05], [0.45, 0.03, 0.3]);
    for (const sx of [-0.11, 0.11]) mesh(pitch, cyl, dark, [sx, -0.02, 0.5], [0.04, 0.5, 0.04], [Math.PI / 2, 0, 0]);
    const led = mesh(pitch, sph, basic(0x401008), [0, 0.19, 0.12], [0.05, 0.05, 0.05]);
    const glow = FX.glowSprite(0x30ff60, 0.9, 0); glow.position.set(0, 0.2, 0.12); pitch.add(glow);
    mesh(pitch, sph, basic(0x80d0ff), [0, 0.04, 0.285], [0.07, 0.07, 0.03]);
    pitch.rotation.x = 0.55; yaw.rotation.y = Math.random() * 6; g.scale.setScalar(1.35);
    return { g, yaw, pitch, led, glow, pos: new THREE.Vector3(l.x, y + yaw.position.y * 1.35, l.z), target: null, cd: 0, heat: 0, cool: 0, retarget: Math.random() * 0.3 };
  }
  function sentryTarget(s) {
    let best = null, bd = 18;
    for (const e of E().list) {
      if (e.dead || e.turned || e.state === 'burrowed' || e.state === 'emerge') continue;
      const c = e.center(), d = c.distanceTo(s.pos); if (d >= bd) continue;
      if (W().raycast(s.pos, c.clone().sub(s.pos).normalize(), d).t < d - 0.6) continue;
      best = e; bd = d;
    }
    return best;
  }
  function updSentries(dt) {
    const S = W().sysM; if (!S || !S.sentries) return;
    const on = W().power;
    for (const s of S.sentries) {
      if (!on) { s.pitch.rotation.x = U.damp(s.pitch.rotation.x, 0.55, 3, dt); s.glow.material.opacity = 0; continue; }
      s.cd -= dt; s.retarget -= dt; if (s.cool > 0) s.cool -= dt;
      if (s.retarget <= 0) { s.retarget = 0.25; s.target = sentryTarget(s); }
      const e = s.target && !s.target.dead ? s.target : null;
      const lc = s.cool > 0 ? 0xffa020 : e ? 0xff3020 : 0x30ff60; s.led.material.color.setHex(lc); s.glow.material.color.setHex(lc); s.glow.material.opacity = 0.8;
      if (!e) { s.target = null; s.yaw.rotation.y += dt * 0.7; s.pitch.rotation.x = U.damp(s.pitch.rotation.x, 0.2, 3, dt); s.heat = Math.max(0, s.heat - dt); continue; }
      const c = e.center(), dx = c.x - s.pos.x, dz = c.z - s.pos.z, dh = Math.hypot(dx, dz), want = Math.atan2(dx, dz);
      s.yaw.rotation.y += U.angDiff(s.yaw.rotation.y, want) * Math.min(1, dt * 8);
      s.pitch.rotation.x = U.damp(s.pitch.rotation.x, Math.atan2(s.pos.y - c.y, dh), 8, dt);
      if (Math.abs(U.angDiff(s.yaw.rotation.y, want)) < 0.2 && s.cd <= 0 && s.cool <= 0) {
        s.cd = 0.24; s.heat += 0.24; if (s.heat > 3) { s.cool = 1.6; s.heat = 0; }
        const muzzle = new THREE.Vector3(Math.sin(s.yaw.rotation.y) * 0.95, 0, Math.cos(s.yaw.rotation.y) * 0.95).add(s.pos);
        const hit = Math.random() < 0.8, to = hit ? c : c.clone().add(new THREE.Vector3(U.rand(-1, 1), U.rand(-0.4, 1), U.rand(-1, 1)));
        FX.tracer(muzzle, to, 0xffd070, 0.06); FX.flash(muzzle, 0xffc060, 2, 0.05, 6);
        A.play('smg', { pos: s.pos, vol: 0.5 });
        if (hit) E().damage(e, 30 * E().hpMul(G().round), { kind: 'bullet', weapon: 'sentry', noPoints: true, point: c });
      }
    }
  }

  // =====================================================================
  //  Session state
  // =====================================================================
  SY.reset = () => {
    const S = W().sysM;
    SY.st = {
      parts: 0, shieldBuilt: false, shieldOnBench: false, benchCd: 0, building: 0,
      eggs: 0, song: false, capsUsed: 0, capsCd: 0,
      quest: 'dormant', repairPts: 0, repairT: 0, voiceT: 0, lastVoice: {},
    };
    P().shield = null;
    if (S.bench) { S.bench.shield.visible = false; }
    SY.intro = null;
  };
  SY.onRoundStart = (r) => {
    SY.st.capsUsed = 0; SY.st.repairPts = 0;
    const t = WP().state.tactical;
    if (t && !t.cls) t.n = Math.min(3, t.n + 1);
    const S = W().sysM;
    if (SY.st.shieldBuilt && !P().shield && S.bench && SY.st.benchCd > 0) { SY.st.benchCd--; if (SY.st.benchCd === 0) { SY.st.shieldOnBench = true; S.bench.shield.visible = true; } }
    if (G().special === 'swarm') SY.voice('swarm'); else if (G().special === 'boss') SY.voice('boss'); else if (r > 1) SY.voice('round');
  };

  // =====================================================================
  //  Hive voice (speech + subtitles)
  // =====================================================================
  SY.voice = (cat, force) => {
    const lines = XH.VOICE[cat]; if (!lines || !SY.st || P().settings.hiveVoice === false) return;
    const now = performance.now() / 1000;
    if (!force && (now - SY.st.voiceT < 7 || now - (SY.st.lastVoice[cat] || -99) < 25)) return;
    SY.st.voiceT = now; SY.st.lastVoice[cat] = now;
    const text = U.pick(lines);
    UI().subtitle(text);
    A.hive(text);
  };

  // =====================================================================
  //  Interaction candidates
  // =====================================================================
  SY.candidates = (out) => {
    const S = W().sysM, st = SY.st; if (!S || !st) return;
    const Pl = P().pos, d2 = (p) => Math.hypot(p.x - Pl.x, p.z - Pl.z), Gm = G();
    // traps
    for (const T of S.traps) {
      const dist = d2(T.pos); if (dist > 2.2) continue;
      if (!T.door.open) out.push({ tip: 'trap', dist, text: 'Trap offline: open the door first', cost: null });
      else if (T.state === 'ready') { const c = Gm.price(1000 * (XH.classes ? XH.classes.mul('tinkerer', 0.75) : 1)); out.push({ tip: 'trap', dist, text: `Activate ${T.kind === 'fire' ? 'flame' : 'shock'} trap`, cost: c, act: () => { if (Gm.spend(c)) activateTrap(T); } }); }
      else out.push({ tip: 'trap', dist, text: T.state === 'active' ? 'Trap active' : `Trap cooling down (${Math.ceil(T.t)}s)`, cost: null });
    }
    // capsule machine
    if (S.gum) {
      const dist = d2(S.gum.pos);
      if (dist < 2.2) {
        if (st.capsUsed >= 3) out.push({ tip: 'capsule', dist, text: 'Mutagen Capsules: 3 per round', cost: null });
        else if (st.capsCd > 0) out.push({ tip: 'capsule', dist, text: 'Dispensing…', cost: null });
        else { const c = Gm.price(500 * Math.pow(2, st.capsUsed) * (XH.classes ? XH.classes.mul('tinkerer', 0.75) : 1)); out.push({ tip: 'capsule', dist, text: 'Dispense a Mutagen Capsule', cost: c, act: () => { if (Gm.spend(c)) dispense(); } }); }
      }
    }
    // shield parts / bench
    for (const p of S.parts) { if (p.taken) continue; const dist = d2(p.pos); if (dist < 1.8) out.push({ tip: 'part', dist, text: `Pick up shield part (${st.parts}/3)`, cost: 0, act: () => { p.taken = true; p.g.visible = false; st.parts++; A.play('grab'); UI().banner('SHIELD PART', `${st.parts}/3 collected`, '#40ffb0'); UI().partsChanged(st.parts); } }); }
    if (S.bench) {
      const dist = d2(S.bench.pos);
      if (dist < 2.2) {
        if (st.building > 0) out.push({ tip: 'bench', dist, text: 'Building…', cost: null });
        else if (!st.shieldBuilt && st.parts < 3) out.push({ tip: 'bench', dist, text: `Build Shield: need parts (${st.parts}/3)`, cost: null });
        else if (!st.shieldBuilt) out.push({ tip: 'bench', dist, text: 'Build Hive Shield', cost: 0, act: () => { st.building = 1.8; A.play('build', { pos: S.bench.pos }); } });
        else if (st.shieldOnBench && !P().shield) out.push({ tip: 'bench', dist, text: 'Take Hive Shield', cost: 0, act: () => takeShield() });
        else if (!P().shield) out.push({ tip: 'bench', dist, text: `Shield rebuilds in ${st.benchCd} round${st.benchCd === 1 ? '' : 's'}`, cost: null });
      }
    }
    // eggs
    for (const e of S.eggs) { if (e.done) continue; const dist = d2(e.pos); if (dist < 1.9) out.push({ tip: 'egg', dist, text: 'Something pulses inside…', cost: 0, act: () => crackEgg(e) }); }
    // quest
    const qa = questActive();
    for (const p of S.pylons) {
      const dist = d2(p.pos); if (dist > 2.2) continue;
      const q = XH.QUESTS[W().def.id];
      if (!qa) out.push({ tip: 'pylon', dist, text: `${q.node}: no power`, cost: null });
      else if (p.state === 'dormant') out.push({ tip: 'pylon', dist, text: `Awaken the ${q.node}`, cost: 0, act: () => awaken(p) });
      else if (p.state === 'charging') out.push({ tip: 'pylon', dist, text: `${q.node} hungers: ${p.souls}/${p.need} souls`, cost: null });
    }
    if (S.heart && st.quest === 'heart') { const dist = d2(S.heart.pos); if (dist < 3) out.push({ tip: 'heart', dist, text: 'Sever the Hive Link', cost: 0, act: () => startFinale() }); }
    // boarded vents
    for (const s of W().spawns) {
      if (!s.slatMeshes || s.slats >= s.maxSlats) continue;
      const dist = Math.hypot(s.x - Pl.x, s.z - Pl.z);
      if (dist < 2.2) out.push({ tip: 'vent', dist: dist + 0.3, text: 'Hold to board up the vent', hold: true });
    }
  };

  // =====================================================================
  //  Traps
  // =====================================================================
  function activateTrap(T) {
    T.state = 'active'; T.t = 18; T.handle.rotation.x = 1.2; T.lamp.material.color.setHex(0xff3020);
    A.play(T.kind === 'fire' ? 'launcher' : 'arc', { pos: T.pos });
    A.loop('trap', true, 0.8);
    SY.voice('trap');
  }
  let trapTick = 0;
  function updTraps(dt) {
    const S = W().sysM; let anyActive = false; trapTick -= dt;
    for (const T of S.traps) {
      if (T.state === 'active') {
        anyActive = true; T.t -= dt;
        for (const pl of T.plates) pl.material.emissiveIntensity = 0.6 + Math.random() * 0.5;
        const cellsArr = [...T.cells];
        for (let k = 0; k < 3; k++) {
          const ci = U.pick(cellsArr), x = W().cx2x(ci % W().w) + U.rand(-1, 1), z = W().cz2z((ci / W().w) | 0) + U.rand(-1, 1);
          if (T.kind === 'fire') FX.fire(new THREE.Vector3(x, 0.1, z), new THREE.Vector3(U.rand(-0.1, 0.1), 1, U.rand(-0.1, 0.1)), 1);
          else FX.bolt(new THREE.Vector3(x, 0.05, z), new THREE.Vector3(x + U.rand(-1.5, 1.5), U.rand(1, 2.6), z + U.rand(-1.5, 1.5)), 0x9fd8ff, 0.08, 6, 0.4);
        }
        if (Math.random() < 0.3) FX.flash(T.door.pos.clone().setY(1), T.kind === 'fire' ? 0xff6020 : 0x70c0ff, 2.5, 0.1, 10);
        for (const e of E().list.slice()) {
          if (e.dead || e.state === 'burrowed' || e.fly) continue;
          const ci = W().cellZ(e.pos.z) * W().w + W().cellX(e.pos.x);
          if (T.cells.has(ci)) E().damage(e, e.def.boss ? 800 * dt : e.hp + 1, { kind: T.kind === 'fire' ? 'fire' : 'arc', quiet: true, point: e.center(), weapon: 'trap' });
        }
        const pc = W().cellZ(P().pos.z) * W().w + W().cellX(P().pos.x);
        if (T.cells.has(pc) && trapTick <= 0) P().hurt(12, T.door.pos, false, false);
        if (T.t <= 0) { T.state = 'cooldown'; T.t = 40; T.handle.rotation.x = 0; for (const pl of T.plates) pl.material.emissiveIntensity = 0.05; }
      } else if (T.state === 'cooldown') { T.t -= dt; if (T.t <= 0) { T.state = 'ready'; T.lamp.material.color.setHex(0x30ff60); } }
    }
    if (trapTick <= 0) trapTick = 0.3;
    if (!anyActive) A.loop('trap', false);
  }

  // =====================================================================
  //  Mutagen Capsules
  // =====================================================================
  function dispense() {
    const st = SY.st, S = W().sysM;
    st.capsUsed++; st.capsCd = 1.6; S.gum.spin = 1.6;
    A.play('capsule', { pos: S.gum.pos });
    setTimeout(() => applyCapsule(U.weighted(XH.CAPSULES.map((c) => [c, c.w]))), 1500);
  }
  function applyCapsule(c) {
    if (G().state !== 'playing') return;
    const Gm = G();
    UI().banner(c.name.toUpperCase(), c.desc, c.css);
    A.play('perk');
    if (c.id === 'surge') { const av = Object.values(XH.PERKS).filter((q) => !P().perks.has(q.id) && !(q.id === 'lazarus' && Gm.mods.oneLife)); if (av.length) P().addPerk(U.pick(av).id); }
    else if (c.id === 'perkaholic') { for (const q of Object.values(XH.PERKS)) if (!P().perks.has(q.id) && !(q.id === 'lazarus' && Gm.mods.oneLife)) P().addPerk(q.id); }
    else if (c.id === 'ghost') Gm.buffs.ghost = 12;
    else if (c.id === 'killswitch') { UI().flash('#fff8d0'); A.play('nuke'); setTimeout(() => E().killAll({}), 500); }
    else if (c.id === 'bottomless') Gm.buffs.bottomless = 30;
    else if (c.id === 'windfall') Gm.addPoints(2500, true);
    else if (c.id === 'undying') Gm.buffs.undying = 45;
    else if (c.id === 'resupply') WP().maxAmmo();
    else if (c.id === 'bloodlust') Gm.insta = 30;
    SY.voice('capsule');
  }

  // =====================================================================
  //  Shield
  // =====================================================================
  function takeShield() { UI().tip && UI().tip('shield');
    const st = SY.st, S = W().sysM;
    st.shieldOnBench = false; S.bench.shield.visible = false;
    const shp = 1500 * (XH.classes ? XH.classes.mul('tinkerer', 1.5) : 1); P().shield = { hp: shp, max: shp }; G().stats.shields++;
    A.play('grab'); UI().banner('HIVE SHIELD', 'Worn on your back. Hold X to raise it, fire to bash.', '#40ffb0');
    SY.voice('shield');
    UI().shieldChanged();
  }
  SY.shieldBroken = () => {
    SY.st.benchCd = 2; P().shield = null;
    UI().banner('SHIELD DESTROYED', 'The workbench can rebuild it in 2 rounds', '#ff5040');
    A.play('explosion', { size: 0.4 }); UI().shieldChanged();
  };

  // =====================================================================
  //  Secret eggs -> hidden song
  // =====================================================================
  function crackEgg(e) {
    e.done = true; SY.st.eggs++;
    FX.ichor(e.g.position.clone().setY(0.5), new THREE.Vector3(0, 1, 0), 0xffa040, 2.5);
    A.play('hatch', { pos: e.pos }); A.play('powerup', { pos: e.pos });
    e.egg.visible = false; e.glow.visible = false;
    if (SY.st.eggs >= 3 && !SY.st.song) {
      SY.st.song = true;
      UI().banner('♪  CHITIN & CHROME  ♪', 'The hive does not approve.', '#ff8030');
      A.music.secret(true);
      XH.progress && XH.progress.addXP(1000, 'Secret song');
      SY.voice('eggs', true);
    }
  }

  // =====================================================================
  //  Main quest
  // =====================================================================
  function questActive() { const Wd = W(); return Wd.power || !Wd.def.power || G().mods.blackout; }
  function awaken(p) {
    p.state = 'charging'; p.runeMat.color.setHex(0xb040ff); p.crystal.material.color.setHex(0xc060ff);
    A.play('forge', { pos: p.pos }); FX.ring(p.center.clone().setY(0.1), 5, 0xb040ff, 0.6);
    SY.st.quest = 'pylons';
    SY.voice('pylon', true);
  }
  SY.onKill = (e) => {
    const S = W().sysM; if (!S) return;
    for (const p of S.pylons) {
      if (p.state !== 'charging') continue;
      if (e.pos.distanceTo(p.center.clone().setY(0)) > 10) continue;
      p.souls++;
      const from = e.center();
      for (let k = 0; k < 10; k++) { const t = k / 10; const q = from.clone().lerp(p.center, t); FX.one(q.x, q.y + Math.sin(t * Math.PI) * 1.5, q.z, (p.center.x - from.x) * 0.6, 0.5, (p.center.z - from.z) * 0.6, 0.35 + t * 0.4, 0.3, 0.05, 0xc060ff); }
      A.play('powerup', { pos: p.center, vol: 0.5 });
      if (p.souls >= p.need) {
        p.state = 'full'; p.runeMat.color.setHex(0x40ff90); p.crystal.material.color.setHex(0x80ffb0); p.glow.material.color.setHex(0x40ff90);
        FX.ring(p.center.clone().setY(0.1), 8, 0x40ff90, 0.8); FX.flash(p.center, 0x40ff90, 5, 0.6, 16); A.play('perk');
        const done = S.pylons.filter((q) => q.state === 'full').length;
        UI().banner(`${XH.QUESTS[W().def.id].node.toUpperCase()} SATURATED`, `${done}/${S.pylons.length}`, '#40ff90');
        if (done === S.pylons.length && !(XH.victory && XH.victory.begin())) revealHeart(); // each map has its own finale
      }
      break;
    }
  };
  function revealHeart() {
    const Wd = W(), sp = Wd.spots.heart; if (!sp) return;
    SY.st.quest = 'heart';
    const g = new THREE.Group(); g.position.set(sp.x, -4, sp.z); Wd.root.add(g);
    const flesh = std(0x8a2040, { emissive: 0x3a0818, flatShading: true, roughness: 0.4 });
    const core = mesh(g, U.jitter(new THREE.SphereGeometry(1.6, 16, 12), 0.35), flesh, [0, 1.8, 0]);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; mesh(g, new THREE.CylinderGeometry(0.08, 0.3, 3, 6), flesh, [Math.cos(a) * 1.8, 0.9, Math.sin(a) * 1.8], null, [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]); }
    const veins = mesh(g, U.jitter(new THREE.SphereGeometry(1.65, 12, 8), 0.3), basic(0xff3080, { wireframe: true, transparent: true, opacity: 0.6 }), [0, 1.8, 0]);
    const glow = FX.glowSprite(0xff3080, 7, 0.6); glow.position.y = 1.8; g.add(glow);
    const beam = mesh(g, new THREE.CylinderGeometry(0.8, 0.8, 80, 16, 1, true), basic(0xff3080, { transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [0, 40, 0]);
    Wd.sysM.heart = { g, core, veins, glow, beam, pos: new THREE.Vector3(sp.x, 0, sp.z), t: 0, prop: Wd.addProp(sp.x, sp.z, 1.3, 1.3, 3.5) };
    FX.shake(0.6); A.play('roar', { pos: g.position, big: true });
    UI().banner('THE HIVE HEART IS EXPOSED', 'Find it. Sever the link.', '#ff3080');
    SY.voice('pylonsDone', true);
  }
  function startFinale() {
    const S = W().sysM, h = S.heart;
    SY.st.quest = 'finale';
    FX.explosion(h.pos.clone().setY(2), 7, 0xff3080); A.play('explosion', { pos: h.pos, size: 2 }); A.play('roar', { pos: h.pos, big: true });
    h.g.visible = false; if (h.prop) h.prop.on = false;
    const o = E().spawn('tyrant', h.pos.x, h.pos.z, { variant: 'elite', hpMul: 2.2 });
    o.overmind = true;
    UI().bossBar(true, 'HIVE OVERMIND');
    A.music.stinger('boss');
    SY.voice('finale', true);
  }
  SY.objective = () => {
    const mo = XH.modes && XH.modes.objective(); if (mo) return mo;
    const so = XH.secrets && XH.secrets.objective(); if (so) return so;
    const st = SY.st, S = W().sysM; if (!st || !S || !S.pylons.length) return '';
    const q = XH.QUESTS[W().def.id];
    if (!questActive()) return '';
    if (XH.victory && XH.victory.active()) return XH.victory.objective();
    if (st.quest === 'finale') return 'Kill the Hive Overmind';
    if (st.quest === 'heart') return `Sever the ${q.heart}`;
    const full = S.pylons.filter((p) => p.state === 'full').length, ch = S.pylons.find((p) => p.state === 'charging');
    if (ch) return `Feed the ${q.node}: ${ch.souls}/${ch.need}   ·   ${full}/${S.pylons.length} saturated`;
    return `Awaken the ${q.nodes} (${full}/${S.pylons.length})`;
  };

  // =====================================================================
  //  Intro flyover
  // =====================================================================
  SY.startIntro = (def) => {
    const Wd = W(), s = Wd.start;
    const center = new THREE.Vector3(0, 0, 0);
    SY.intro = { t: 0, dur: 6.5, from: new THREE.Vector3(center.x - 30, 34, center.z + 40), mid: new THREE.Vector3(s.x + 14, 14, s.z + 16), look0: center, look1: new THREE.Vector3(s.x - Math.sin(P().yaw) * 8, 1.4, s.z - Math.cos(P().yaw) * 8) };
    if (Wd.buildings && Wd.buildings.length) {
      // skyline maps: sweep in above the rooftops, then drop straight down onto the player
      let near = 0, all = 0;
      for (const [bx, bz, bw, bd, bh] of Wd.buildings) {
        const x0 = bx * Wd.CELL - Wd.ox, z0 = bz * Wd.CELL - Wd.oz, dx = Math.max(x0 - s.x, 0, s.x - x0 - bw * Wd.CELL), dz = Math.max(z0 - s.z, 0, s.z - z0 - bd * Wd.CELL);
        all = Math.max(all, bh); if (Math.hypot(dx, dz) < 28) near = Math.max(near, bh);
      }
      Object.assign(SY.intro, { sky: true, dur: 8, from: new THREE.Vector3(s.x - 90, all + 45, s.z + 130), mid: new THREE.Vector3(s.x + 3, near + 8, s.z + 4) });
    }
    UI().intro(def, XH.QUESTS[def.id].intro);
  };
  SY.skipIntro = () => { if (SY.intro) SY.intro.t = SY.intro.dur; };
  SY.updateIntro = (dt, cam) => {
    const I = SY.intro; if (!I) return false;
    I.t += dt;
    const k = Math.min(1, I.t / I.dur), e = U.smooth(k);
    const eye = new THREE.Vector3(P().pos.x, P().eyeH || 1.65, P().pos.z);
    const a = I.from.clone().lerp(I.mid, U.smooth(Math.min(1, k * 1.4))), p = a.lerp(eye, U.smooth(Math.max(0, (k - 0.55) / 0.45)));
    cam.position.copy(p);
    const look = I.look0.clone().lerp(I.look1, e);
    cam.lookAt(look); cam.fov = U.lerp(55, P().settings.fov, e); cam.updateProjectionMatrix();
    const fog = I.sky && W().root && W().root.parent && W().root.parent.fog;
    if (fog) { if (I.fog0 === undefined) I.fog0 = fog.density; fog.density = U.lerp(Math.min(0.0032, I.fog0), I.fog0, U.smooth(Math.max(0, (k - 0.35) / 0.65))); if (k >= 1) fog.density = I.fog0; }
    if (k >= 1) { SY.intro = null; UI().introEnd(); cam.rotation.order = 'YXZ'; SY.voice('start', true); return false; }
    return true;
  };

  // =====================================================================
  //  Per-frame update
  // =====================================================================
  SY.update = (dt, t) => {
    const S = W().sysM, st = SY.st; if (!S || !st) return;
    updTraps(dt);
    updSentries(dt);
    // capsule machine anim
    if (S.gum) { if (S.gum.spin > 0) { S.gum.spin -= dt; S.gum.caps.rotation.y += dt * 8; S.gum.crank.rotation.x += dt * 10; } else S.gum.caps.rotation.y += dt * 0.3; }
    st.capsCd = Math.max(0, st.capsCd - dt);
    // floating parts
    for (const p of S.parts) if (!p.taken) { p.g.rotation.y = t * 1.2 + p.k; p.g.position.y = 1 + Math.sin(t * 2 + p.k) * 0.12; }
    // eggs pulse
    for (const e of S.eggs) if (!e.done) { const s = 1 + Math.sin(t * 3 + e.pos.x) * 0.06; e.egg.scale.set(0.32 * s, 0.45 * s, 0.32 * s); }
    // bench build
    if (st.building > 0) {
      st.building -= dt;
      if (Math.random() < 0.4) FX.sparks(S.bench.g.position.clone().setY(1.1), new THREE.Vector3(0, 1, 0));
      if (st.building <= 0) { st.shieldBuilt = true; st.shieldOnBench = true; S.bench.shield.visible = true; A.play('perk'); XH.progress && XH.progress.addXP(250, 'Shield built'); }
    }
    // pylons glow
    for (const p of S.pylons) {
      p.crystal.rotation.y = t * (p.state === 'dormant' ? 0.2 : 1.5);
      p.glow.material.opacity = p.state === 'dormant' ? 0.12 : p.state === 'charging' ? 0.35 + Math.sin(t * 5) * 0.2 : 0.7;
      p.rings.forEach((r, i) => { r.rotation.z = t * (i % 2 ? 1 : -1) * (p.state === 'dormant' ? 0.1 : 1.2); });
    }
    // heart rises and beats
    if (S.heart && S.heart.g.visible) { const h = S.heart; h.t += dt; h.g.position.y = Math.min(0, -4 + h.t * 2); const b = 1 + Math.max(0, Math.sin(t * 5)) * 0.08; h.core.scale.setScalar(b); h.veins.scale.setScalar(b); }
    // vents: slat visibility + hold-to-repair
    const Pl = P();
    for (const s of W().spawns) {
      if (!s.slatMeshes) continue;
      for (let k = 0; k < s.slatMeshes.length; k++) s.slatMeshes[k].visible = k < s.slats;
    }
    if (G().playing() && Pl.keys.KeyE && !Pl.downed) {
      const v = W().spawns.find((s) => s.slatMeshes && s.slats < s.maxSlats && Math.hypot(s.x - Pl.pos.x, s.z - Pl.pos.z) < 2.2);
      if (v) {
        st.repairT += dt;
        if (st.repairT > 0.45) {
          st.repairT = 0; v.slats++;
          A.play('slat', { pos: v.grate.position });
          FX.burst({ pos: v.grate.position.clone().setY(0.3), n: 6, color: 0x888888, speed: [1, 3], up: 1, life: [0.2, 0.5], size: [0.1, 0.05], grav: 10, add: false });
          if (st.repairPts < 500) { st.repairPts += 10; G().addPoints(10); }
        }
      } else st.repairT = 0;
    } else st.repairT = 0;
    // perk machines hum their jingle when you walk up (while powered)
    const now = performance.now() / 1000;
    if (W().power || !W().def.power) for (const m of W().perks) {
      if (Math.hypot(m.pos.x - Pl.pos.x, m.pos.z - Pl.pos.z) < 5 && now - (m.jT || -99) > 30) { m.jT = now; A.jingle(m.key, m.pos); }
    }
    // low-health taunt
    if (Pl.hp / Pl.maxHp < 0.3 && !Pl.downed) SY.voice('lowhp');
  };
})();
