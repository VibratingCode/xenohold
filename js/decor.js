'use strict';
// Per-theme set dressing layered on top of the arena geometry. Static pieces are merged
// into the world's material buckets; animated pieces register into W.anims.
(function () {
  const D = XH.decor = {};
  const _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _q = new THREE.Quaternion();
  const FLOOR = '.SP_&?H';

  // matrix for a unit cylinder/cone stretched between two points
  function seg(a, b, r) {
    _v.subVectors(b, a); const len = _v.length();
    _q.setFromUnitVectors(_up, _v.normalize());
    return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), _q, new THREE.Vector3(r, len, r));
  }
  // sagging cable between two points (merged tube)
  function cable(B, mat, a, b, sag, r = 0.03) {
    const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    B.add(mat, new THREE.TubeGeometry(curve, 12, r, 4, false));
  }
  // painted once, then each map gets its own copy (the copy is freed with the map, the painting is kept)
  const painted = {};
  const copyOf = (k, fn) => { const b = painted[k] || (painted[k] = fn()), t = b.clone(); t.needsUpdate = true; t.userData = { transient: true }; return t; };
  function gradTex() { return copyOf('grad', gradPaint); }
  function mistTex() { return copyOf('mist', mistPaint); }
  function gradPaint() {
    const c = XH.U.canvas(4, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(c);
  }
  function mistPaint() {
    const U = XH.U;
    const t = U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 4, v * 4, 4, 4); const a = Math.max(0, n - 0.35) * 2.2; return [255, 255, 255, Math.min(255, a * 255)]; }));
    return t;
  }
  function signTex(text, color, bg) {
    const c = XH.U.canvas(512, 128), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = color; x.lineWidth = 6; x.strokeRect(8, 8, 496, 112);
    x.fillStyle = color; x.font = 'bold 64px Orbitron, Consolas, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 68);
    // weathering
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.35})`; x.fillRect(Math.random() * 512, Math.random() * 128, Math.random() * 12, Math.random() * 3); }
    const t = new THREE.CanvasTexture(c); t.userData = { transient: true }; t.anisotropy = 4; return t;
  }

  D.build = (c) => {
    const { rows, B, MAT, G, rnd, chAt, isWall, root, CELL, H, Wd, W, theme, def } = c;
    const faces = [], floors = [];
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const ch = rows[z][x];
      if (FLOOR.includes(ch)) floors.push({ cx: x, cz: z, x: W.cx2x(x), z: W.cz2z(z) });
      if (!isWall(ch)) continue;
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        if (!FLOOR.includes(chAt(x + dx, z + dz))) continue;
        faces.push({ cx: x, cz: z, dx, dz, x: W.cx2x(x) + dx * CELL / 2, z: W.cz2z(z) + dz * CELL / 2, ry: Math.atan2(dx, dz) });
      }
    }
    // keep props away from anything the player uses, spawn vents and doors
    const keep = [];
    for (const q of W.buys) keep.push([q.pos.x, q.pos.z, 2.2], [q.wall.position.x, q.wall.position.z, 1.8]);
    for (const q of W.perks) keep.push([q.pos.x, q.pos.z, 2.2]);
    for (const q of W.boxSpots) keep.push([q.pos.x, q.pos.z, 2.4], [q.x, q.z, 1.6]);
    if (W.forge) keep.push([W.forge.pos.x, W.forge.pos.z, 2.4]);
    if (W.powerSwitch) keep.push([W.powerSwitch.pos.x, W.powerSwitch.pos.z, 2.2]);
    for (const q of W.spawns) keep.push([q.x, q.z, 2.2]);
    for (const k in W.spots) { const v = W.spots[k]; for (const q of Array.isArray(v) ? v : v ? [v] : []) keep.push([q.x, q.z, 2.4]); }
    for (const id in W.doors) { const d = W.doors[id]; for (const ci of d.cells) keep.push([W.cx2x(ci % Wd), W.cz2z((ci / Wd) | 0), 2.2]); }
    for (const k of W.keepClear || []) keep.push(k);
    const clear = (x, z) => !keep.some(([kx, kz, r]) => Math.hypot(kx - x, kz - z) < r);
    c.clear = clear;
    const pick = (arr, frac) => arr.filter(() => rnd() < frac);
    const nearSpawn = (f, r) => W.spawns.some((s) => Math.hypot(s.x - f.x, s.z - f.z) < r);
    c.faces = faces; c.floors = floors; c.pick = pick;

    lightShafts(c);
    groundMist(c);
    // debris along wall bases
    for (const f of pick(faces, 0.12)) {
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const t = (rnd() - 0.5) * 2, px = f.x + f.dx * (0.3 + rnd() * 0.4) + f.dz * t, pz = f.z + f.dz * (0.3 + rnd() * 0.4) - f.dx * t, s = 0.12 + rnd() * 0.22;
        if (theme === 'outpost' || theme === 'ship') B.add(MAT.trim, G.box, XH.U.mat(px, s / 2, pz, 0, rnd() * 3, 0, s * 2, s, s * 1.4), new THREE.Color(0.5 + rnd() * 0.5, 0.5 + rnd() * 0.4, 0.5));
        else B.add(MAT.rock, G.sphere, XH.U.mat(px, s * 0.3, pz, rnd(), rnd() * 3, 0, s, s * 0.6, s * 0.9), new THREE.Color(0.7 + rnd() * 0.3, 0.7, 0.7));
      }
    }
    if (theme === 'outpost') outpost(c, faces, floors, pick, nearSpawn);
    else if (theme === 'hive') hive(c, faces, floors, pick, nearSpawn);
    else if (theme === 'ice') ice(c, faces, floors, pick, nearSpawn);
    else if (theme === 'ship') ship(c, faces, floors, pick, nearSpawn);
  };

  const ok = (k, x, z) => !XH.setdress || XH.setdress.allow(k, x, z), okF = (k, f) => ok(k, f.x + f.dx, f.z + f.dz);
  // ---------------- shared ----------------
  function lightShafts(c) {
    const { W, root, def } = c;
    const tex = gradTex();
    for (const L of W.lights) {
      const h = L.y, geo = new THREE.CylinderGeometry(0.3, def.ceiling ? 2.4 : 3.4, h, 24, 1, true);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: L.color, map: tex, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.position.set(L.x, h / 2, L.z); m.renderOrder = 5; root.add(m);
      L.cone = m;
    }
    W.anims.push((dt, t) => { for (const L of W.lights) if (L.cone) L.cone.material.opacity = (W.power ? 0.09 : 0.035) * (L.light.intensity > 0.01 ? Math.min(1.2, L.light.intensity / (L.base || 1) * 1.1 + 0.1) : 0); });
  }
  function groundMist(c) {
    const { W, root, theme, def } = c;
    const col = (def.mist && def.mist[0]) || { outpost: 0x9ab0c8, hive: 0xff7040, ice: 0xe8f2ff, ship: 0x70ff9a, city: 0x8a7a9a }[theme];
    const op = def.mist ? def.mist[1] : { outpost: 0.14, hive: 0.09, ice: 0.22, ship: 0.06, city: 0.1 }[theme];
    if (!op) return;
    const size = Math.max(W.w, W.h) * c.CELL + 40;
    const layers = [];
    for (let k = 0; k < 2; k++) {
      const t = mistTex(); t.repeat.set(size / 40, size / 40);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: col, map: t, transparent: true, opacity: op, depthWrite: false, blending: theme === 'hive' ? THREE.AdditiveBlending : THREE.NormalBlending }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.25 + k * 0.45; m.renderOrder = 4; root.add(m); layers.push(m);
    }
    W.anims.push((dt, t) => { layers[0].material.map.offset.set(t * 0.006, t * 0.004); layers[1].material.map.offset.set(-t * 0.004, t * 0.007); });
    void def;
  }

  // ---------------- Outpost Kestrel ----------------
  function outpost(c, faces, floors, pick, nearSpawn) {
    const { B, MAT, G, rnd, root, W, def } = c, U = XH.U;
    // pipe runs along wall tops
    for (const f of pick(faces, 0.45)) {
      const tx = f.dz, tz = -f.dx, len = c.CELL + 0.02;
      for (const [y, r, off] of [[4.3, 0.13, 0.25], [4.75, 0.08, 0.2]]) {
        const a = new THREE.Vector3(f.x + f.dx * off - tx * len / 2, y, f.z + f.dz * off - tz * len / 2), b = new THREE.Vector3(f.x + f.dx * off + tx * len / 2, y, f.z + f.dz * off + tz * len / 2);
        B.add(MAT.trim, G.cyl, seg(a, b, r), new THREE.Color(r > 0.1 ? 0x9a7a50 : 0xffffff));
      }
      B.add(MAT.dark, G.box, U.mat(f.x + f.dx * 0.15, 4.5, f.z + f.dz * 0.15, 0, f.ry, 0, 0.1, 0.8, 0.3));
    }
    // stenciled signs
    const words = (def.skin && def.skin.signs) || ['SECTOR A', 'SECTOR B', 'LANDING PAD 02', 'REFINERY', 'CMD CENTER', 'HAZARD', 'AUTHORIZED ONLY', 'KESTREL MINING CO.', 'NO ENTRY', 'EVAC ROUTE →'];
    const sgn = pick(faces, 0.05).slice(0, 12);
    sgn.forEach((f, i) => {
      const warn = i % 3 === 1;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.52), new THREE.MeshStandardMaterial({ map: signTex(words[i % words.length], warn ? '#1a1a1a' : '#e8c040', warn ? '#d8a020' : '#1b1e22'), roughness: 0.8 }));
      m.position.set(f.x + f.dx * 0.03, 3.1 + rnd() * 0.3, f.z + f.dz * 0.03); m.rotation.y = f.ry; root.add(m);
    });
    // cables between light poles
    const L = W.lights;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const d = Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z);
      if (d < 26 && d > 6) cable(B, MAT.dark, new THREE.Vector3(L[i].x, L[i].y + 0.2, L[i].z), new THREE.Vector3(L[j].x, L[j].y + 0.2, L[j].z), d * 0.08, 0.035);
    }
    // rain puddles (glossy)
    const pud = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -1, depthWrite: false });
    if (def.weather === 'rain' || def.weather === 'spores') for (const f of pick(floors, 0.05)) B.add(pud, new THREE.CircleGeometry(1, 14), U.mat(f.x + (rnd() - 0.5) * 1.5, 0.014, f.z + (rnd() - 0.5) * 1.5, -Math.PI / 2, 0, rnd() * 3, 0.6 + rnd() * 1.1, 0.4 + rnd() * 0.8, 1));
    // steam vents
    const vents = def.airless ? [] : pick(faces, 0.035).slice(0, 7);
    for (const f of vents) B.add(MAT.dark, G.box, U.mat(f.x + f.dx * 0.55, 0.03, f.z + f.dz * 0.55, 0, f.ry, 0, 1.0, 0.06, 0.6));
    W.anims.push(() => { for (const f of vents) if (Math.random() < 0.35) XH.fx.one(f.x + f.dx * 0.55 + (Math.random() - 0.5) * 0.6, 0.1, f.z + f.dz * 0.55, (Math.random() - 0.5) * 0.3, 1.4, (Math.random() - 0.5) * 0.3, 1.8, 0.4, 1.8, 0xb8c4d0, 0.25, -0.2, 0.6, false); });
    // landing pad markings around the central shuttle (Kestrel only: the generated arenas have no pad)
    if (def.skin) return;
    const pc = new THREE.Vector3(W.cx2x(23) - c.CELL / 2, 0, W.cz2z(23) - c.CELL / 2);
    const paint = new THREE.MeshStandardMaterial({ color: 0xc89a20, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 });
    B.add(paint, new THREE.RingGeometry(6.6, 7.1, 64), U.mat(pc.x, 0.012, pc.z, -Math.PI / 2, 0, 0));
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; B.add(paint, G.plane, U.mat(pc.x + Math.cos(a) * 8.2, 0.012, pc.z + Math.sin(a) * 8.2, -Math.PI / 2, 0, -a, 1.2, 0.35, 1)); }
    void def; void nearSpawn;
  }

  // ---------------- Char Depths ----------------
  function hive(c, faces, floors, pick, nearSpawn) {
    const { B, MAT, G, rnd, root, W, def, rows, chAt } = c, U = XH.U;
    // colossal rib bones curving out of the walls over the caverns
    for (const f of pick(faces, 0.09)) {
      const base = new THREE.Vector3(f.x - f.dx * 0.6, def.wallH * 0.9, f.z - f.dz * 0.6);
      const reach = 5 + rnd() * 4, side = (rnd() - 0.5) * 3;
      const ctrl = new THREE.Vector3(f.x + f.dx * reach * 0.5 + f.dz * side, def.wallH * 1.7, f.z + f.dz * reach * 0.5 - f.dx * side);
      const tip = new THREE.Vector3(f.x + f.dx * reach + f.dz * side * 1.5, def.wallH * 1.25, f.z + f.dz * reach - f.dx * side * 1.5);
      const curve = new THREE.QuadraticBezierCurve3(base, ctrl, tip), N = 7;
      for (let k = 0; k < N; k++) {
        const a = curve.getPoint(k / N), b = curve.getPoint((k + 1) / N), r = 0.45 * (1 - k / N) + 0.05;
        B.add(MAT.bone, G.cyl, seg(a, b, r));
      }
    }
    // tendrils creeping down the walls
    for (const f of pick(faces, 0.22)) {
      let p = new THREE.Vector3(f.x + f.dx * 0.12 + f.dz * (rnd() - 0.5) * 2, def.wallH * (0.7 + rnd() * 0.5), f.z + f.dz * 0.12 - f.dx * (rnd() - 0.5) * 2);
      for (let k = 0; k < 5; k++) { const q = p.clone().add(new THREE.Vector3(f.dz * (rnd() - 0.5) * 0.8, -1.1 - rnd() * 0.5, -f.dx * (rnd() - 0.5) * 0.8)); if (q.y < 0) q.y = 0; B.add(MAT.flesh, G.cyl, seg(p, q, 0.09 - k * 0.012)); p = q; if (p.y <= 0) break; }
    }
    // glowing egg clusters near spawns and in the spawning pools
    const eggMat = new THREE.MeshStandardMaterial({ color: 0xd88040, emissive: 0x803010, roughness: 0.3, transparent: true, opacity: 0.92 });
    for (const f of pick(faces, 0.1)) {
      if (!nearSpawn(f, 12) && rnd() < 0.6) continue;
      if (!c.clear(f.x + f.dx * 0.6, f.z + f.dz * 0.6)) continue;
      for (let k = 0; k < 5 + rnd() * 5; k++) { const t = (rnd() - 0.5) * 2; B.add(eggMat, G.sphere, U.mat(f.x + f.dx * (0.3 + rnd() * 0.5) + f.dz * t, 0.2, f.z + f.dz * (0.3 + rnd() * 0.5) - f.dx * t, 0, 0, 0, 0.22, 0.32, 0.22)); }
      W.addPropRot(f.x + f.dx * 0.55, f.z + f.dz * 0.55, 2.4, 1.0, f.ry, 0.55, { bullets: false });
    }
    // cyan crystal clusters with glow
    for (const f of pick(faces.filter((f) => okF('crystals', f)), 0.3)) {
      if (!c.clear(f.x + f.dx * 0.5, f.z + f.dz * 0.5)) continue;
      W.addPropRot(f.x + f.dx * 0.4, f.z + f.dz * 0.4, 1.7, 0.8, f.ry, 2.2);
      for (let k = 0; k < 5; k++) { const t = (rnd() - 0.5) * 1.5; B.add(MAT.crystal, G.cone, U.mat(f.x + f.dx * 0.4 + f.dz * t, 0.6 + rnd() * 0.6, f.z + f.dz * 0.4 - f.dx * t, (rnd() - 0.5) * 0.8 + f.dz * 0.4, 0, (rnd() - 0.5) * 0.8 - f.dx * 0.4, 0.2, 1.2 + rnd() * 1.4, 0.2)); }
      const g = XH.fx.glowSprite(0x40e8ff, 3, 0.45); g.position.set(f.x + f.dx * 0.6, 1.2, f.z + f.dz * 0.6); root.add(g);
    }
    // lavafalls pouring down walls beside lava pools
    const lavaNear = (f) => { for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (chAt(f.cx + dx, f.cz + dz) === '~') return true; return false; };
    const falls = faces.filter(lavaNear).filter(() => rnd() < 0.35).slice(0, 6);
    for (const f of falls) {
      B.add(MAT.lava, G.plane, U.mat(f.x + f.dx * 0.06, def.wallH / 2, f.z + f.dz * 0.06, 0, f.ry, 0, 1.3, def.wallH, 1));
      const g = XH.fx.glowSprite(0xff6020, 4, 0.6); g.position.set(f.x + f.dx * 0.8, 0.5, f.z + f.dz * 0.8); root.add(g);
    }
    W.anims.push(() => { if (falls.length && Math.random() < 0.5) { const f = falls[Math.floor(Math.random() * falls.length)]; XH.fx.embers(new THREE.Vector3(f.x + f.dx * 0.7, 0.3, f.z + f.dz * 0.7), 3); } });
    void rows;
  }

  // ---------------- Frostfall Relay ----------------
  function ice(c, faces, floors, pick) {
    const { B, MAT, G, rnd, root, W, def } = c, U = XH.U;
    // snow drifts banked against walls
    for (const f of pick(faces, 0.55)) {
      if (!c.clear(f.x + f.dx, f.z + f.dz)) continue;
      let free = 0; while (free < 4 && FLOOR.includes(c.chAt(f.cx + f.dx * (free + 1), f.cz + f.dz * (free + 1)))) free++;
      const sx = 1.5 + rnd() * 0.6, sy = 0.45 + rnd() * 0.5, sz = Math.min(0.9 + rnd() * 0.5, free <= 1 ? 0.55 : free === 2 ? 0.9 : 1.4);
      B.add(MAT.snowcap, U.jitter(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0.25, rnd), U.mat(f.x + f.dx * 0.1, 0, f.z + f.dz * 0.1, 0, f.ry, 0, sx, sy, sz));
      if (sy > 0.3) W.addPropRot(f.x + f.dx * sz * 0.4, f.z + f.dz * sz * 0.4, sx * 1.5, sz * 0.8, f.ry, sy * 0.85, { bullets: false });
    }
    // icicles
    for (const f of pick(faces, 0.35)) {
      for (let k = 0; k < 4; k++) { const t = (rnd() - 0.5) * 2.2, h = 0.5 + rnd() * 1.2; B.add(MAT.crystal, G.cone, U.mat(f.x + f.dx * 0.15 + f.dz * t, def.wallH - 0.4 - h / 2, f.z + f.dz * 0.15 - f.dx * t, Math.PI, 0, 0, 0.08 + rnd() * 0.06, h, 0.08)); }
    }
    // antenna masts with blinking beacons
    const masts = pick(faces.filter((f) => okF('masts', f)), 0.05).slice(0, 6);
    const blinks = [];
    for (const f of masts) {
      const x = f.x - f.dx * 0.8, z = f.z - f.dz * 0.8, h = def.wallH + 3 + rnd() * 4;
      B.add(MAT.trim, G.cyl, U.mat(x, h / 2, z, 0, 0, 0, 0.08, h, 0.08));
      for (let k = 1; k < 4; k++) B.add(MAT.trim, G.box, U.mat(x, h * k / 4, z, 0, rnd() * 3, 0, 0.8 - k * 0.15, 0.04, 0.04));
      const b = XH.fx.glowSprite(0xff3020, 1.4, 0.9); b.position.set(x, h + 0.2, z); root.add(b); blinks.push(b);
    }
    W.anims.push((dt, t) => { blinks.forEach((b, i) => { b.visible = ((t + i * 0.37) % 1.6) < 0.3; }); });
    // snow-capped supply crates
    for (const f of pick(floors, 0.012)) {
      if (W.blockedAt(f.x, f.z, 0) || !c.clear(f.x, f.z) || !ok('crates', f.x, f.z)) continue;
      const cx = f.x + (rnd() - 0.5), cz = f.z + (rnd() - 0.5), cr = rnd() * 3;
      B.add(MAT.crate, G.box, U.mat(cx, 0.4, cz, 0, cr, 0, 0.8, 0.8, 0.8));
      W.addPropRot(cx, cz, 0.8, 0.8, cr, 0.8);
    }
  }
  // aurora curtains, attached to the sky dome
  D.sky = (def, g) => {
    if (def.theme !== 'ice') return;
    const mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float t; varying vec2 vUv;
        void main(){ float x=vUv.x*40.0; float w=sin(x*0.7+t*0.35)*0.5+sin(x*1.9-t*0.6)*0.25+sin(x*4.3+t*0.9)*0.12;
          float band=smoothstep(0.0,0.25,vUv.y)*smoothstep(1.0,0.35,vUv.y)*(0.55+0.45*w);
          float rays=0.6+0.4*sin(x*9.0+t*1.3+w*3.0);
          vec3 col=mix(vec3(0.2,1.0,0.55),vec3(0.65,0.3,1.0),smoothstep(0.35,1.0,vUv.y+w*0.2));
          gl_FragColor=vec4(col*band*rays*0.55, 1.0); }`,
    });
    const a = new THREE.Mesh(new THREE.CylinderGeometry(420, 420, 140, 96, 1, true, 0.3, Math.PI * 1.3), mat);
    a.position.y = 190; g.add(a);
    const W = XH.world; W.anims.push((dt, t) => { mat.uniforms.t.value = t; });
  };

  // ---------------- Derelict Ark ----------------
  function ship(c, faces, floors, pick, nearSpawn) {
    const { B, MAT, G, rnd, root, W, def, rows, H, Wd } = c, U = XH.U;
    const ch = def.wallH;
    // ceiling pipe runs along corridors
    for (let z = 1; z < H - 1; z++) {
      if (z % 5 !== 2) continue;
      let run = null;
      for (let x = 0; x <= Wd; x++) {
        const open = x < Wd && FLOOR.includes(rows[z][x]);
        if (open && run === null) run = x;
        if ((!open || x === Wd) && run !== null) {
          if (x - run >= 3) {
            const a = new THREE.Vector3(W.cx2x(run) - c.CELL / 2, ch - 0.35, W.cz2z(z)), b = new THREE.Vector3(W.cx2x(x - 1) + c.CELL / 2, ch - 0.35, W.cz2z(z));
            B.add(MAT.trim, G.cyl, seg(a, b, 0.16), new THREE.Color(0x8a9098));
            B.add(MAT.trim, G.cyl, seg(a.clone().add(new THREE.Vector3(0, -0.1, 0.4)), b.clone().add(new THREE.Vector3(0, -0.1, 0.4)), 0.09), new THREE.Color(0xa06030));
          }
          run = null;
        }
      }
    }
    // hanging cables
    for (const f of pick(floors, 0.02)) {
      const a = new THREE.Vector3(f.x, ch - 0.05, f.z), b = new THREE.Vector3(f.x + (rnd() - 0.5) * 6, ch - 0.05, f.z + (rnd() - 0.5) * 6);
      cable(B, MAT.dark, a, b, 0.8 + rnd() * 1.2, 0.03);
    }
    // emergency beacons that spin while the power is out
    const beacons = [];
    for (const f of pick(faces, 0.04).slice(0, 10)) {
      const g = new THREE.Group(); g.position.set(f.x + f.dx * 0.15, 3.6, f.z + f.dz * 0.15); root.add(g);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 10), new THREE.MeshBasicMaterial({ color: 0xff2010 })); g.add(cap);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.rotation.z = Math.PI / 2; beam.position.x = 2; const pivot = new THREE.Group(); pivot.add(beam); g.add(pivot);
      const glow = XH.fx.glowSprite(0xff2010, 1.2, 0.8); g.add(glow);
      beacons.push({ pivot, cap, beam, glow, ph: rnd() * 6 });
    }
    W.anims.push((dt, t) => { for (const b of beacons) { b.pivot.rotation.y = t * 4 + b.ph; const on = !W.power; b.beam.visible = on; b.glow.material.opacity = on ? 0.5 + Math.sin(t * 8 + b.ph) * 0.3 : 0.1; b.cap.material.color.setHex(on ? 0xff2010 : 0x401008); } });
    // console screens with scrolling diagnostics (one shared animated texture)
    const sc = XH.U.canvas(256, 160), sx = sc.getContext('2d'), stex = new THREE.CanvasTexture(sc); stex.userData = { transient: true };
    const lines = [];
    const glyphs = 'ABCDEF0123456789:/._-#';
    const newLine = () => { let s = ''; const n = 8 + Math.floor(Math.random() * 18); for (let i = 0; i < n; i++) s += glyphs[Math.floor(Math.random() * glyphs.length)]; return (Math.random() < 0.15 ? '!! HULL BREACH ' : Math.random() < 0.15 ? 'BIO-ALERT ' : '') + s; };
    for (let i = 0; i < 12; i++) lines.push(newLine());
    const scrMat = new THREE.MeshBasicMaterial({ map: stex, color: 0x9dffb8 });
    let acc = 0;
    W.anims.push((dt) => {
      acc += dt; if (acc < 0.18) return; acc = 0;
      lines.shift(); lines.push(newLine());
      sx.fillStyle = '#020604'; sx.fillRect(0, 0, 256, 160); sx.font = '13px Consolas, monospace';
      lines.forEach((l, i) => { sx.fillStyle = l.startsWith('!!') ? '#ff5040' : l.startsWith('BIO') ? '#ffd040' : '#40ff80'; sx.fillText(l, 6, 14 + i * 12.5); });
      stex.needsUpdate = true;
      scrMat.color.setHex(W.power ? 0x9dffb8 : 0x305038);
    });
    for (const f of pick(faces, 0.06).slice(0, 12)) {
      B.add(MAT.dark, G.box, U.mat(f.x + f.dx * 0.06, 1.7, f.z + f.dz * 0.06, 0, f.ry, 0, 1.3, 0.9, 0.1));
      const m = new THREE.Mesh(G.plane, scrMat); m.scale.set(1.1, 0.7, 1); m.position.set(f.x + f.dx * 0.12, 1.7, f.z + f.dz * 0.12); m.rotation.y = f.ry; root.add(m);
    }
    // sparking broken panels
    const sparks = pick(faces, 0.03).slice(0, 8);
    for (const f of sparks) B.add(MAT.dark, G.box, U.mat(f.x + f.dx * 0.05, 2.4, f.z + f.dz * 0.05, 0, f.ry, 0.3, 0.7, 0.5, 0.08));
    W.anims.push(() => { for (const f of sparks) if (Math.random() < 0.012) { const p = new THREE.Vector3(f.x + f.dx * 0.2, 2.4, f.z + f.dz * 0.2); XH.fx.sparks(p, new THREE.Vector3(f.dx, -0.3, f.dz)); XH.fx.flash(p, 0xffd080, 2, 0.08, 6); } });
    // hive growth spreading up the walls near vents
    for (const f of faces) {
      if (!nearSpawn(f, 7) || rnd() < 0.5) continue;
      const m = new THREE.Mesh(G.plane, MAT.creep); m.scale.set(2.6, 2.8 + rnd() * 1.5, 1); m.position.set(f.x + f.dx * 0.04, 1.4, f.z + f.dz * 0.04); m.rotation.y = f.ry; root.add(m);
    }
  }
})();
