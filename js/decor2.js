'use strict';
// Set dressing for the generated arenas: one style per skin (desert, jungle, lab, sewer, cave, foundry,
// cathedral, bunker, lunar, swamp, station, temple), plus skin versions of spires ('O') and low cover ('=').
// Anything a player could walk into gets a prop collider.
(function () {
  const D2 = XH.decor2 = {};
  const FLOOR = '.SP_&?H,';
  const mats = {};
  const std = (k, o) => mats[k] || (mats[k] = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.8 }, o)));
  const glowM = (k, c) => mats[k] || (mats[k] = new THREE.MeshBasicMaterial({ color: c, vertexColors: true }));
  function seg(a, b, r) { const d = new THREE.Vector3().subVectors(b, a), len = d.length(); return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(r, len, r)); }

  function scan(c) {
    const { rows, H, Wd, W, CELL, isWall, chAt } = c, faces = [], floors = [];
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const ch = rows[z][x];
      if (FLOOR.includes(ch)) floors.push({ cx: x, cz: z, x: W.cx2x(x), z: W.cz2z(z), ch });
      if (!isWall(ch)) continue;
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        if (!FLOOR.includes(chAt(x + dx, z + dz))) continue;
        let free = 0; while (free < 4 && FLOOR.includes(chAt(x + dx * (free + 1), z + dz * (free + 1)))) free++;
        faces.push({ cx: x, cz: z, dx, dz, free, x: W.cx2x(x) + dx * CELL / 2, z: W.cz2z(z) + dz * CELL / 2, ry: Math.atan2(dx, dz) });
      }
    }
    // keep clear of anything the player uses, vents and doors
    const keep = [];
    for (const q of W.buys) keep.push([q.pos.x, q.pos.z, 2.3], [q.wall.position.x, q.wall.position.z, 1.9]);
    for (const q of W.perks) keep.push([q.pos.x, q.pos.z, 2.3]);
    for (const q of W.boxSpots) keep.push([q.pos.x, q.pos.z, 2.4], [q.x, q.z, 1.6]);
    if (W.forge) keep.push([W.forge.pos.x, W.forge.pos.z, 2.4]);
    if (W.powerSwitch) keep.push([W.powerSwitch.pos.x, W.powerSwitch.pos.z, 2.2]);
    for (const q of W.spawns) keep.push([q.x, q.z, 2.4]);
    for (const k in W.spots) { const v = W.spots[k]; for (const q of Array.isArray(v) ? v : v ? [v] : []) keep.push([q.x, q.z, 2.6]); }
    for (const id in W.doors) for (const ci of W.doors[id].cells) keep.push([W.cx2x(ci % Wd), W.cz2z((ci / Wd) | 0), 2.4]);
    for (const k of W.keepClear || []) keep.push(k);
    c.clear = (x, z) => !keep.some(([kx, kz, r]) => Math.hypot(kx - x, kz - z) < r);
    c.faces = faces; c.floors = floors;
    c.pick = (arr, frac) => arr.filter(() => c.rnd() < frac);
  }

  // ---------------- shared props ----------------
  function tree(c, x, z, kind) {
    const { B, rnd, U } = c, bark = std('bark', { color: 0x4a3424, roughness: 0.95 });
    if (kind === 'dead') {
      const h = 5 + rnd() * 3, dark = new THREE.Color(0.55, 0.5, 0.45);
      B.add(bark, U.jitter(new THREE.CylinderGeometry(0.22, 0.5, h, 6, 4), 0.12, rnd), U.mat(x, h / 2, z, (rnd() - 0.5) * 0.15, rnd() * 3, (rnd() - 0.5) * 0.15), dark);
      for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, y = h * (0.45 + rnd() * 0.45), len = 1.4 + rnd() * 1.6; B.add(bark, new THREE.CylinderGeometry(0.03, 0.1, 1, 5), seg(new THREE.Vector3(x, y, z), new THREE.Vector3(x + Math.cos(a) * len, y + 0.5 + rnd(), z + Math.sin(a) * len), 1), dark); }
      const moss = std('moss', { color: 0x5a6a40, roughness: 1 });
      for (let k = 0; k < 5; k++) B.add(moss, new THREE.ConeGeometry(0.08, 1.2 + rnd(), 4), U.mat(x + (rnd() - 0.5) * 2, h * 0.7 - rnd(), z + (rnd() - 0.5) * 2, Math.PI, 0, 0));
      return;
    }
    const h = 6 + rnd() * 3, leaf = std('leaf', { color: 0xffffff, roughness: 0.9, flatShading: true });
    B.add(bark, U.jitter(new THREE.CylinderGeometry(0.3, 0.65, h, 7, 4), 0.1, rnd), U.mat(x, h / 2, z, 0, rnd() * 3, 0));
    for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + rnd(); B.add(bark, new THREE.CylinderGeometry(0.08, 0.22, 1.6, 5), seg(new THREE.Vector3(x + Math.cos(a) * 0.3, 0.6, z + Math.sin(a) * 0.3), new THREE.Vector3(x + Math.cos(a) * 1.3, -0.1, z + Math.sin(a) * 1.3), 1)); }
    for (let k = 0; k < 5; k++) B.add(leaf, new THREE.IcosahedronGeometry(1, 0), U.mat(x + (rnd() - 0.5) * 3, h - 0.5 + rnd() * 2, z + (rnd() - 0.5) * 3, rnd(), rnd(), 0, 2 + rnd(), 1.2 + rnd() * 0.6, 2 + rnd()), new THREE.Color(0.12 + rnd() * 0.08, 0.3 + rnd() * 0.2, 0.1 + rnd() * 0.06));
    const vine = std('vine', { color: 0x2a5a24, roughness: 1 });
    for (let k = 0; k < 6; k++) { const vx = x + (rnd() - 0.5) * 3.4, vz = z + (rnd() - 0.5) * 3.4, len = 2 + rnd() * 3; B.add(vine, c.G.cyl, U.mat(vx, h - len / 2, vz, 0, 0, 0, 0.03, len, 0.03)); }
  }
  const ok = (k, x, z) => !XH.setdress || XH.setdress.allow(k, x, z), okF = (k, f) => ok(k, f.x + f.dx, f.z + f.dz);
  function forCells(c, ch, fn) { for (let z = 0; z < c.H; z++) for (let x = 0; x < c.Wd; x++) if (c.rows[z][x] === ch) fn(c.W.cx2x(x), c.W.cz2z(z)); }
  function crateStack(c, x, z, ry) {
    const { B, MAT, G, U, W, rnd } = c;
    B.add(MAT.crate, G.box, U.mat(x, 0.6, z, 0, ry, 0, 1.2, 1.2, 1.2));
    if (rnd() < 0.6) B.add(MAT.crate, G.box, U.mat(x + 0.1, 1.55, z, 0, ry + 0.4, 0, 0.8, 0.7, 0.8));
    W.addPropRot(x, z, 1.25, 1.25, ry, 1.2);
  }
  function barrel(c, x, z, col) {
    const { B, G, U, W } = c, m = std('barrel', { color: 0xffffff, metalness: 0.5, roughness: 0.5 });
    B.add(m, G.cyl, U.mat(x, 0.5, z, 0, 0, 0, 0.32, 1, 0.32), col);
    B.add(c.MAT.dark, G.cyl, U.mat(x, 0.3, z, 0, 0, 0, 0.33, 0.06, 0.33)); B.add(c.MAT.dark, G.cyl, U.mat(x, 0.72, z, 0, 0, 0, 0.33, 0.06, 0.33));
    W.addProp(x, z, 0.34, 0.34, 1);
  }
  function glowAt(c, x, y, z, col, size, op) { const g = c.FX.glowSprite(col, size, op); g.position.set(x, y, z); c.root.add(g); return g; }

  // ---------------- per-skin dressing ----------------
  const DRESS = {
    desert(c) {
      const { B, G, U, W, rnd, MAT } = c, sand = std('sand', { color: 0xc89a68, roughness: 1, flatShading: true });
      for (const f of c.pick(c.faces, 0.5)) {
        if (!c.clear(f.x + f.dx, f.z + f.dz)) continue;
        const sx = 1.4 + rnd() * 0.8, sy = 0.35 + rnd() * 0.45, sz = Math.min(0.8 + rnd() * 0.6, f.free <= 1 ? 0.5 : 1.2);
        B.add(sand, U.jitter(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0.25, rnd), U.mat(f.x + f.dx * 0.1, 0, f.z + f.dz * 0.1, 0, f.ry, 0, sx, sy, sz));
        if (sy > 0.3) W.addPropRot(f.x + f.dx * sz * 0.4, f.z + f.dz * sz * 0.4, sx * 1.5, sz * 0.8, f.ry, sy * 0.85, { bullets: false });
      }
      for (const f of c.pick(c.floors, 0.015)) {
        if (!c.clear(f.x, f.z) || W.blockedAt(f.x, f.z, 0) || !ok('rocks', f.x, f.z)) continue;
        const s = 0.5 + rnd() * 0.7;
        B.add(MAT.wall, U.jitter(new THREE.DodecahedronGeometry(s, 0), 0.3, rnd), U.mat(f.x, s * 0.6, f.z, rnd(), rnd() * 3, rnd()), new THREE.Color(0.9, 0.8, 0.7));
        W.addProp(f.x, f.z, s * 0.8, s * 0.8, s * 1.1);
      }
      // derricks leaning on walls
      for (const f of c.pick(c.faces.filter((f) => okF('derricks', f)), 0.06).slice(0, 5)) {
        const x = f.x + f.dx * 0.6, z = f.z + f.dz * 0.6, h = 9 + rnd() * 3;
        if (!c.clear(x, z)) continue;
        for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) B.add(MAT.hazard, G.box, U.mat(x + ox * (1 - 0.3), h / 2, z + oz * (1 - 0.3), oz * 0.06, 0, -ox * 0.06, 0.14, h, 0.14));
        for (let k = 1; k < 6; k++) B.add(MAT.trim, G.box, U.mat(x, h * k / 6, z, 0, k * 0.8, 0, 1.2, 0.08, 0.08));
        B.add(MAT.dark, G.cyl, U.mat(x, h / 2, z, 0, 0, 0, 0.12, h, 0.12));
        W.addProp(x, z, 0.8, 0.8, h);
      }
      // a giant bleached ribcage in one room
      const bed = c.floors.filter((f) => ok('ribcage', f.x, f.z)), f0 = bed[Math.floor(rnd() * bed.length)];
      if (f0 && c.clear(f0.x, f0.z)) { const bone = std('bone2', { color: 0xe0d0b0, flatShading: true }); for (let k = 0; k < 7; k++) { const z = f0.z - 4 + k * 1.3; for (const sx of [-1, 1]) { const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(f0.x, 0, z), new THREE.Vector3(f0.x + sx * 3.4, 2.6, z), new THREE.Vector3(f0.x + sx * 1.4, 4.4, z + 0.4)); for (let q = 0; q < 5; q++) B.add(bone, G.cyl, seg(curve.getPoint(q / 5), curve.getPoint((q + 1) / 5), 0.16 - q * 0.02)); } } }
      W.anims.push(() => { if (Math.random() < 0.05) { const P = XH.player.pos, a = Math.random() * 6.28; for (let k = 0; k < 8; k++) c.FX.one(P.x + Math.cos(a) * 12 + (Math.random() - 0.5), 0.2 + k * 0.3, P.z + Math.sin(a) * 12, Math.cos(a + 1.6) * 3, 0.6, Math.sin(a + 1.6) * 3, 2.4, 0.9, 1.6, 0xc8a070, 0.35, 0, 0.8, false); } });
    },
    jungle(c) {
      const { B, G, U, W, rnd } = c;
      forCells(c, 'T', (x, z) => { tree(c, x, z, 'lush'); c.W.addCyl(x, z, 0.7, 9, { mount: false }); }); // one tree per cell, so every cell has its trunk
      const vine = std('vine', { color: 0x2a5a24, roughness: 1 });
      for (const f of c.pick(c.faces, 0.3)) for (let k = 0; k < 3; k++) { const t = (rnd() - 0.5) * 2, len = 1 + rnd() * 3.5; B.add(vine, G.cyl, U.mat(f.x + f.dx * 0.1 + f.dz * t, c.def.wallH - len / 2, f.z + f.dz * 0.1 - f.dx * t, 0, 0, 0, 0.035, len, 0.035)); }
      const fern = std('fern', { color: 0xffffff, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
      for (const f of c.pick(c.faces, 0.35)) {
        if (!c.clear(f.x + f.dx, f.z + f.dz)) continue;
        for (let k = 0; k < 4; k++) { const t = (rnd() - 0.5) * 2; B.add(fern, G.cone, U.mat(f.x + f.dx * 0.5 + f.dz * t, 0.35, f.z + f.dz * 0.5 - f.dx * t, (rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6, 0.5, 0.8, 0.5), new THREE.Color(0.15, 0.38 + rnd() * 0.2, 0.12)); }
        W.addPropRot(f.x + f.dx * 0.55, f.z + f.dz * 0.55, 2, 0.8, f.ry, 0.7, { bullets: false });
      }
      // glowing mushrooms
      const cap = glowM('mush', 0x9dffcf), stem = std('stem', { color: 0xd8d0b8 });
      for (const f of c.pick(c.faces, 0.08)) {
        if (!c.clear(f.x + f.dx, f.z + f.dz)) continue;
        for (let k = 0; k < 5; k++) { const t = (rnd() - 0.5) * 1.6, x = f.x + f.dx * 0.5 + f.dz * t, z = f.z + f.dz * 0.5 - f.dx * t, h = 0.3 + rnd() * 0.6; B.add(stem, G.cyl, U.mat(x, h / 2, z, 0, 0, 0, 0.05, h, 0.05)); B.add(cap, G.sphere, U.mat(x, h, z, 0, 0, 0, 0.2 + rnd() * 0.12, 0.08, 0.2 + rnd() * 0.12), new THREE.Color(rnd() < 0.5 ? 0x9dffcf : 0x80c0ff)); }
        glowAt(c, f.x + f.dx * 0.6, 0.6, f.z + f.dz * 0.6, 0x80ffc0, 2.4, 0.4);
      }
    },
    lab(c) {
      const { B, G, U, W, rnd, MAT, root } = c;
      const glass = new THREE.MeshStandardMaterial({ color: 0xa8e8ff, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2, depthWrite: false });
      const fluid = glowM('fluid', 0x40ffa0), body = std('specimen', { color: 0x1a2a20, roughness: 0.5 });
      for (const f of c.pick(c.faces.filter((f) => okF('tanks', f)), 0.16).slice(0, 14)) {
        const x = f.x + f.dx * 0.9, z = f.z + f.dz * 0.9;
        if (!c.clear(x, z) || f.free < 2) continue;
        B.add(MAT.trim, G.cyl, U.mat(x, 0.25, z, 0, 0, 0, 0.7, 0.5, 0.7)); B.add(MAT.trim, G.cyl, U.mat(x, c.def.wallH - 0.4, z, 0, 0, 0, 0.7, 0.4, 0.7));
        B.add(fluid, G.cyl, U.mat(x, 1.6, z, 0, 0, 0, 0.55, 2.2, 0.55), new THREE.Color(0.25, 0.9, 0.55).multiplyScalar(0.5));
        B.add(body, G.sphere, U.mat(x, 1.9, z, 0.3, rnd() * 3, 0, 0.3, 0.55, 0.25)); B.add(body, G.sphere, U.mat(x, 1.25, z, 0, 0, 0, 0.22, 0.35, 0.2));
        const gl = new THREE.Mesh(G.cyl, glass); gl.scale.set(0.62, c.def.wallH - 1.1, 0.62); gl.position.set(x, (c.def.wallH - 0.2) / 2 + 0.25, z); root.add(gl);
        glowAt(c, x, 1.6, z, 0x40ffa0, 2.2, 0.35);
        W.addProp(x, z, 0.7, 0.7, c.def.wallH);
      }
      // monitors on walls
      const scr = glowM('screen', 0x60e8ff);
      for (const f of c.pick(c.faces, 0.12)) { B.add(MAT.dark, G.box, U.mat(f.x + f.dx * 0.06, 1.8, f.z + f.dz * 0.06, 0, f.ry, 0, 1.0, 0.65, 0.1)); B.add(scr, G.plane, U.mat(f.x + f.dx * 0.12, 1.8, f.z + f.dz * 0.12, 0, f.ry, 0, 0.9, 0.55, 1), new THREE.Color(rnd() < 0.2 ? 0xff4050 : 0x60e8ff).multiplyScalar(0.6)); }
      // blood trails on the tiles
      const blood = new THREE.MeshBasicMaterial({ color: 0x4a0608, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
      for (const f of c.pick(c.floors, 0.02)) B.add(blood, new THREE.CircleGeometry(1, 9), U.mat(f.x + (rnd() - 0.5), 0.015, f.z + (rnd() - 0.5), -Math.PI / 2, 0, rnd() * 3, 0.4 + rnd() * 1.2, 0.2 + rnd() * 0.5, 1));
      // gurneys
      for (const f of c.pick(c.faces, 0.04)) { const x = f.x + f.dx * 0.8, z = f.z + f.dz * 0.8; if (!c.clear(x, z) || !ok('gurneys', x, z)) continue; B.add(MAT.white, G.box, U.mat(x, 0.8, z, 0, f.ry + Math.PI / 2, 0, 2, 0.1, 0.8)); for (const o of [-0.8, 0.8]) B.add(MAT.trim, G.cyl, U.mat(x + f.dz * o, 0.4, z - f.dx * o, 0, 0, 0, 0.04, 0.8, 0.04)); W.addPropRot(x, z, 2, 0.8, f.ry + Math.PI / 2, 0.9, { bullets: false }); }
    },
    sewer(c) {
      const { B, G, U, W, rnd, MAT } = c, rust = std('rustpipe', { color: 0x6a4a34, metalness: 0.6, roughness: 0.6 });
      for (const f of c.pick(c.faces, 0.55)) {
        const tx = f.dz, tz = -f.dx, len = c.CELL + 0.02;
        for (const [y, r] of [[3.6, 0.2], [4.2, 0.12]]) B.add(rust, G.cyl, seg(new THREE.Vector3(f.x + f.dx * 0.25 - tx * len / 2, y, f.z + f.dz * 0.25 - tz * len / 2), new THREE.Vector3(f.x + f.dx * 0.25 + tx * len / 2, y, f.z + f.dz * 0.25 + tz * len / 2), r));
      }
      const grime = new THREE.MeshBasicMaterial({ color: 0x1a2010, transparent: true, opacity: 0.55, depthWrite: false });
      for (const f of c.pick(c.faces, 0.25)) B.add(grime, G.plane, U.mat(f.x + f.dx * 0.03, 1.4, f.z + f.dz * 0.03, 0, f.ry, 0, 1.6, 2.8, 1));
      const outlets = c.pick(c.faces, 0.05).slice(0, 10);
      for (const f of outlets) B.add(MAT.dark, G.cyl, U.mat(f.x + f.dx * 0.3, 1.2, f.z + f.dz * 0.3, Math.PI / 2, f.ry, 0, 0.35, 0.6, 0.35));
      W.anims.push(() => { for (const f of outlets) if (Math.random() < 0.3) c.FX.one(f.x + f.dx * 0.6, 1.1, f.z + f.dz * 0.6, f.dx * 1.4, 0, f.dz * 1.4, 0.8, 0.12, 0.3, 0x8ab050, 0.8, 9, 0.9, false); });
      for (const f of c.pick(c.floors, 0.02)) { if (!c.clear(f.x, f.z)) continue; B.add(MAT.dark, G.box, U.mat(f.x, 0.02, f.z, 0, 0, 0, 1.2, 0.04, 1.2)); for (let k = -2; k <= 2; k++) B.add(MAT.trim, G.box, U.mat(f.x + k * 0.22, 0.045, f.z, 0, 0, 0, 0.06, 0.02, 1.2)); }
      W.anims.push(() => { if (Math.random() < 0.25) { const P = XH.player.pos; c.FX.one(P.x + (Math.random() - 0.5) * 16, c.def.wallH - 0.1, P.z + (Math.random() - 0.5) * 16, 0, -0.5, 0, 1.2, 0.05, 0.06, 0x9ab8c8, 0.9, 12, 0.4, false); } });
    },
    cave(c) {
      const { B, G, U, W, rnd, MAT } = c;
      for (const f of c.pick(c.floors, 0.12)) { const h = 0.6 + rnd() * 1.6; B.add(MAT.crystal, G.cone, U.mat(f.x + (rnd() - 0.5) * 2, c.def.wallH - h / 2, f.z + (rnd() - 0.5) * 2, Math.PI, 0, 0, 0.1 + rnd() * 0.12, h, 0.1 + rnd() * 0.12)); }
      for (const f of c.pick(c.faces, 0.1)) {
        if (!c.clear(f.x + f.dx, f.z + f.dz)) continue;
        for (let k = 0; k < 5; k++) { const t = (rnd() - 0.5) * 1.6; B.add(MAT.crystal, G.cone, U.mat(f.x + f.dx * 0.4 + f.dz * t, 0.7 + rnd() * 0.6, f.z + f.dz * 0.4 - f.dx * t, (rnd() - 0.5) * 0.8 + f.dz * 0.4, 0, (rnd() - 0.5) * 0.8 - f.dx * 0.4, 0.2, 1.3 + rnd() * 1.4, 0.2)); }
        glowAt(c, f.x + f.dx * 0.6, 1.2, f.z + f.dz * 0.6, 0x60c8ff, 3, 0.4);
        W.addPropRot(f.x + f.dx * 0.4, f.z + f.dz * 0.4, 1.7, 0.8, f.ry, 2.2);
      }
      for (const f of c.pick(c.faces, 0.02)) { const x = f.x + f.dx * 0.9, z = f.z + f.dz * 0.9; if (c.clear(x, z) && f.free >= 2 && ok('crates', x, z)) crateStack(c, x, z, rnd() * 3); }
    },
    foundry(c) {
      const { B, G, U, W, rnd, MAT } = c;
      const mouth = glowM('furnace', 0xff7020);
      const furn = c.pick(c.faces.filter((f) => okF('furnaces', f)), 0.1).slice(0, 12);
      for (const f of furn) { B.add(MAT.dark, G.box, U.mat(f.x + f.dx * 0.1, 1.3, f.z + f.dz * 0.1, 0, f.ry, 0, 1.8, 2.2, 0.3)); B.add(mouth, G.plane, U.mat(f.x + f.dx * 0.27, 1.1, f.z + f.dz * 0.27, 0, f.ry, 0, 1.2, 1.0, 1), new THREE.Color(1, 0.55, 0.2)); glowAt(c, f.x + f.dx * 0.8, 1.1, f.z + f.dz * 0.8, 0xff6020, 3.4, 0.55); }
      W.anims.push(() => { for (const f of furn) if (Math.random() < 0.08) c.FX.embers(new THREE.Vector3(f.x + f.dx * 0.5, 1, f.z + f.dz * 0.5), 1); });
      const chain = std('chain', { color: 0x3a3634, metalness: 0.8, roughness: 0.4 });
      for (const f of c.pick(c.faces, 0.12)) { const len = 2 + rnd() * 3; B.add(chain, G.cyl, U.mat(f.x + f.dx * 0.6, c.def.wallH - len / 2, f.z + f.dz * 0.6, 0, 0, 0, 0.05, len, 0.05)); B.add(MAT.trim, G.box, U.mat(f.x + f.dx * 0.6, c.def.wallH - len - 0.15, f.z + f.dz * 0.6, 0, 0, 0, 0.3, 0.3, 0.1)); B.add(MAT.trim, G.box, U.mat(f.x + f.dx * 0.3, c.def.wallH, f.z + f.dz * 0.3, 0, f.ry, 0, 0.2, 0.2, 0.8)); }
      for (const f of c.pick(c.faces, 0.04)) { const x = f.x + f.dx * 0.9, z = f.z + f.dz * 0.9; if (c.clear(x, z) && f.free >= 2 && ok('barrels', x, z)) barrel(c, x, z, new THREE.Color(0x6a3a20)); }
    },
    cathedral(c) {
      const { B, G, U, W, rnd, MAT, def } = c, bone = MAT.bone;
      // vaulted ribs arching over every room
      for (const f of c.pick(c.faces, 0.08)) {
        if (f.free < 4) continue;
        const a = new THREE.Vector3(f.x - f.dx * 0.3, def.wallH * 0.7, f.z - f.dz * 0.3), tip = new THREE.Vector3(f.x + f.dx * 9, def.wallH * 1.4, f.z + f.dz * 9);
        const ctrl = new THREE.Vector3(f.x + f.dx * 4, def.wallH * 2, f.z + f.dz * 4), cur = new THREE.QuadraticBezierCurve3(a, ctrl, tip);
        for (let k = 0; k < 8; k++) B.add(bone, G.cyl, seg(cur.getPoint(k / 8), cur.getPoint((k + 1) / 8), 0.5 - k * 0.05));
      }
      // bone organ pipes
      for (const f of c.pick(c.faces, 0.1)) for (let k = 0; k < 5; k++) { const t = (k - 2) * 0.4, h = 2 + (2 - Math.abs(k - 2)) * 1.4 + rnd(); B.add(bone, G.cyl, U.mat(f.x + f.dx * 0.25 + f.dz * t, h / 2, f.z + f.dz * 0.25 - f.dx * t, 0, 0, 0, 0.14, h, 0.14)); }
      // egg sacs
      const sac = new THREE.MeshStandardMaterial({ color: 0xc060ff, emissive: 0x401060, roughness: 0.3, transparent: true, opacity: 0.85, vertexColors: true });
      for (const f of c.pick(c.faces, 0.08)) { if (!c.clear(f.x + f.dx, f.z + f.dz)) continue; for (let k = 0; k < 6; k++) { const t = (rnd() - 0.5) * 2; B.add(sac, G.sphere, U.mat(f.x + f.dx * 0.6 + f.dz * t, 0.35, f.z + f.dz * 0.6 - f.dx * t, 0, 0, 0, 0.3, 0.42, 0.3)); } W.addPropRot(f.x + f.dx * 0.6, f.z + f.dz * 0.6, 2.4, 1, f.ry, 0.7, { bullets: false }); glowAt(c, f.x + f.dx * 0.7, 0.5, f.z + f.dz * 0.7, 0xc060ff, 2.6, 0.45); }
    },
    bunker(c) {
      const { B, G, U, W, rnd, MAT } = c;
      const wire = std('wire', { color: 0x5a5a5a, metalness: 0.8, roughness: 0.4 });
      for (const f of c.pick(c.faces, 0.4)) for (let k = 0; k < 3; k++) { const t = (k - 1) * 0.8; B.add(wire, new THREE.TorusGeometry(0.35, 0.02, 4, 10), U.mat(f.x - f.dx * 0.2 + f.dz * t, c.def.wallH + 0.3, f.z - f.dz * 0.2 - f.dx * t, 0, f.ry + Math.PI / 2, 0)); }
      const claw = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.7, depthWrite: false });
      for (const f of c.pick(c.faces, 0.1)) for (let k = 0; k < 4; k++) B.add(claw, G.plane, U.mat(f.x + f.dx * 0.03 + f.dz * (k - 1.5) * 0.14, 1.5, f.z + f.dz * 0.03 - f.dx * (k - 1.5) * 0.14, 0, f.ry, 0.3, 0.05, 0.9, 1));
      for (const f of c.pick(c.faces, 0.05)) { const x = f.x + f.dx * 0.9, z = f.z + f.dz * 0.9; if (!c.clear(x, z) || f.free < 2 || !ok('crates', x, z)) continue; if (rnd() < 0.5) crateStack(c, x, z, rnd() * 0.5); else barrel(c, x, z, new THREE.Color(0x3a4a2a)); }
    },
    lunar(c) {
      const { B, G, U, W, rnd, MAT } = c;
      const crater = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
      for (const f of c.pick(c.floors, 0.02)) B.add(crater, new THREE.RingGeometry(0.6, 1, 16), U.mat(f.x, 0.012, f.z, -Math.PI / 2, 0, 0, 1 + rnd() * 1.5, 1 + rnd() * 1.5, 1));
      const panel = std('solar', { color: 0x1a2a6a, metalness: 0.6, roughness: 0.2, emissive: 0x050a20 });
      for (const f of c.pick(c.faces, 0.1)) {
        const x = f.x + f.dx * 0.9, z = f.z + f.dz * 0.9; if (!c.clear(x, z) || f.free < 2 || !ok('solar', x, z)) continue;
        B.add(MAT.trim, G.cyl, U.mat(x, 0.6, z, 0, 0, 0, 0.06, 1.2, 0.06));
        B.add(panel, G.box, U.mat(x, 1.3, z, 0.6, f.ry, 0, 1.8, 0.05, 1.1));
        W.addProp(x, z, 0.5, 0.5, 1.6, { bullets: false });
      }
      const helmet = std('helmet', { color: 0xe0e0e0, metalness: 0.3, roughness: 0.3 });
      for (const f of c.pick(c.floors, 0.004)) { B.add(helmet, G.sphere, U.mat(f.x, 0.18, f.z, 0, 0, 0, 0.2, 0.2, 0.2)); B.add(glowM('visor', 0xffc040), G.sphere, U.mat(f.x + 0.1, 0.2, f.z, 0, 0, 0, 0.1, 0.12, 0.14)); }
    },
    swamp(c) {
      const { B, G, U, W, rnd, MAT, rows } = c;
      forCells(c, 'T', (x, z) => { tree(c, x, z, 'dead'); c.W.addCyl(x, z, 0.5, 8, { mount: false }); }); // one tree per cell, so every cell has its trunk
      const reed = std('reed', { color: 0x6a7a40, roughness: 1 });
      for (const f of c.floors) {
        if (f.ch !== '.' || rnd() > 0.25) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => c.chAt(f.cx + dx, f.cz + dz) === '%');
        if (!near) continue;
        for (let k = 0; k < 6; k++) { const h = 0.8 + rnd() * 1.2; B.add(reed, G.cyl, U.mat(f.x + (rnd() - 0.5) * 2, h / 2, f.z + (rnd() - 0.5) * 2, (rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2, 0.02, h, 0.02)); }
      }
      // hull plates stuck in the mud
      for (const f of c.pick(c.floors, 0.012)) {
        if (!c.clear(f.x, f.z) || W.blockedAt(f.x, f.z, 0) || !ok('plates', f.x, f.z)) continue;
        const ry = rnd() * 3, tilt = 0.4 + rnd() * 0.5;
        B.add(MAT.wall, G.box, U.mat(f.x, 0.8, f.z, tilt, ry, 0, 2.4, 1.8, 0.12));
        W.addPropRot(f.x, f.z, 2.4, 0.9, ry, 1.4);
      }
      for (const f of c.pick(c.faces, 0.04)) { const x = f.x + f.dx * 0.9, z = f.z + f.dz * 0.9; if (c.clear(x, z) && f.free >= 2) barrel(c, x, z, new THREE.Color(0x8a6a20)); }
    },
    station(c) {
      const { B, G, U, W, rnd, MAT, root } = c;
      // windows onto space
      const sc = XH.U.canvas(256, 128), x = sc.getContext('2d');
      x.fillStyle = '#01020a'; x.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${Math.random()})`; x.fillRect(Math.random() * 256, Math.random() * 128, Math.random() < 0.1 ? 2 : 1, 1); }
      const gr = x.createRadialGradient(200, 150, 10, 200, 150, 110); gr.addColorStop(0, '#6aa0ff'); gr.addColorStop(0.55, '#2a5ab0'); gr.addColorStop(0.7, '#0a1a40'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.beginPath(); x.arc(200, 150, 110, 0, 7); x.fill();
      const wt = new THREE.CanvasTexture(sc); wt.userData = { transient: true };
      const winMat = new THREE.MeshBasicMaterial({ map: wt });
      for (const f of c.pick(c.faces, 0.12)) { const m = new THREE.Mesh(G.plane, winMat); m.scale.set(1.9, 1.3, 1); m.position.set(f.x + f.dx * 0.03, 2.3, f.z + f.dz * 0.03); m.rotation.y = f.ry; root.add(m); B.add(MAT.trim, G.box, U.mat(f.x + f.dx * 0.02, 2.3, f.z + f.dz * 0.02, 0, f.ry, 0, 2.1, 1.5, 0.04)); }
      const panelG = glowM('ceilpanel', 0xd8e8ff);
      for (const f of c.pick(c.floors, 0.06)) B.add(panelG, G.box, U.mat(f.x, c.def.wallH - 0.03, f.z, 0, 0, 0, 1.4, 0.04, 0.4), new THREE.Color(0.7, 0.8, 1));
      for (const f of c.pick(c.faces, 0.05)) { const px = f.x + f.dx * 0.9, pz = f.z + f.dz * 0.9; if (c.clear(px, pz) && f.free >= 2 && ok('crates', px, pz)) crateStack(c, px, pz, 0); }
    },
    temple(c) {
      const { B, G, U, W, rnd, MAT } = c, gold = std('gold', { color: 0xc8a040, metalness: 0.9, roughness: 0.35 });
      const fires = [];
      for (const f of c.pick(c.faces, 0.1)) {
        const x = f.x + f.dx * 0.7, z = f.z + f.dz * 0.7; if (!c.clear(x, z)) continue;
        B.add(MAT.wall, G.cyl, U.mat(x, 0.5, z, 0, 0, 0, 0.25, 1, 0.25)); B.add(gold, new THREE.CylinderGeometry(0.45, 0.2, 0.35, 10), U.mat(x, 1.15, z));
        const gl = glowAt(c, x, 1.6, z, 0xff9030, 3, 0.7); fires.push({ x, z, gl });
        W.addProp(x, z, 0.4, 0.4, 1.3);
      }
      W.anims.push((dt, t) => { const P = XH.player.pos; for (const q of fires) { q.gl.material.opacity = 0.55 + Math.sin(t * 11 + q.x) * 0.1 + Math.random() * 0.1; if (Math.abs(q.x - P.x) + Math.abs(q.z - P.z) < 40 && Math.random() < 0.4) c.FX.fire(new THREE.Vector3(q.x, 1.3, q.z), new THREE.Vector3(0, 1, 0), 0.25); } });
      for (const f of c.pick(c.faces, 0.3)) B.add(gold, G.box, U.mat(f.x + f.dx * 0.04, c.def.wallH * 0.75, f.z + f.dz * 0.04, 0, f.ry, 0, c.CELL, 0.12, 0.05));
      const vine = std('vine', { color: 0x2a5a24, roughness: 1 });
      for (const f of c.pick(c.faces, 0.25)) for (let k = 0; k < 3; k++) { const t = (rnd() - 0.5) * 2, len = 1 + rnd() * 3; B.add(vine, G.cyl, U.mat(f.x + f.dx * 0.1 + f.dz * t, c.def.wallH - len / 2, f.z + f.dz * 0.1 - f.dx * t, 0, 0, 0, 0.03, len, 0.03)); }
      for (const f of c.pick(c.floors, 0.02)) { if (!c.clear(f.x, f.z)) continue; const s = 0.3 + rnd() * 0.4; B.add(MAT.wall, U.jitter(new THREE.BoxGeometry(s * 2, s, s * 1.5), 0.1, rnd), U.mat(f.x, s / 2, f.z, 0, rnd() * 3, rnd() * 0.3)); if (s > 0.5) W.addProp(f.x, f.z, s, s * 0.8, s); }
    },
  };

  D2.build = (kind, c) => { if (!DRESS[kind]) return; scan(c); DRESS[kind](c); };

  // ---------------- skin spires ('O' clusters) ----------------
  D2.spire = (kind, cl, c) => {
    const { B, MAT, G, rnd, U, def, root, FX, W } = c, { x, z, w, d } = cl, r = Math.min(w, d) / 2;
    if (kind === 'rock') {
      const h = def.wallH + 2 + rnd() * 5;
      B.add(MAT.wall, U.jitter(new THREE.CylinderGeometry(r * 0.55, r * 0.95, h, 7, 5), 0.35, rnd, 0.6), U.mat(x, h / 2 - 0.3, z, 0, rnd() * 3, 0), new THREE.Color(0.95, 0.85, 0.75));
      W.addCyl(x, z, r * 0.95, h, { mount: false });
      B.add(MAT.wall, U.jitter(new THREE.DodecahedronGeometry(r * 0.9, 0), 0.4, rnd), U.mat(x, h, z, rnd(), rnd(), 0));
      return true;
    }
    if (kind === 'tree') { tree({ B, G, U, rnd, MAT }, x, z, 'lush'); W.addCyl(x, z, 0.7, 9, { mount: false }); return true; }
    if (kind === 'deadtree') { tree({ B, G, U, rnd, MAT }, x, z, 'dead'); W.addCyl(x, z, 0.5, 8, { mount: false }); return true; }
    if (kind === 'stack') {
      const h = def.wallH + 8 + rnd() * 6;
      B.add(MAT.wall, G.cyl, U.mat(x, h / 2, z, 0, 0, 0, r * 0.7, h, r * 0.7)); W.addCyl(x, z, r * 0.75, h, { mount: false });
      for (let k = 1; k < 4; k++) B.add(MAT.trim, G.cyl, U.mat(x, h * k / 4, z, 0, 0, 0, r * 0.75, 0.3, r * 0.75));
      const ring = new THREE.Mesh(G.torus, new THREE.MeshBasicMaterial({ color: 0xff6020 })); ring.scale.setScalar(r * 0.7); ring.rotation.x = Math.PI / 2; ring.position.set(x, h, z); root.add(ring);
      XH.world.anims.push(() => { if (Math.random() < 0.3) FX.one(x + (Math.random() - 0.5) * r, h, z + (Math.random() - 0.5) * r, 0.4, 1.6, 0.2, 5, 1.4, 4, 0x2a2420, 0.35, -0.4, 0.5, false); });
      return true;
    }
    if (kind === 'dish') {
      B.add(MAT.trim, G.cyl, U.mat(x, 2.5, z, 0, 0, 0, 0.3, 5, 0.3)); W.addCyl(x, z, 0.32, 5, { mount: false });
      B.add(MAT.white, new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, 1.0), U.mat(x, 5.4, z, 2.3, rnd() * 6, 0, 2.6, 1.3, 2.6));
      const blink = FX.glowSprite(0xff3030, 1.2); blink.position.set(x, 6.8, z); root.add(blink);
      XH.world.anims.push((dt, t) => { blink.visible = (t % 1.6) < 0.25; });
      return true;
    }
    if (kind === 'idol') {
      const stone = MAT.wall;
      B.add(stone, G.box, U.mat(x, 0.6, z, 0, 0, 0, r * 1.6, 1.2, r * 1.6));
      B.add(stone, U.jitter(new THREE.BoxGeometry(r * 1.1, 3.2, r * 0.9, 2, 3, 2), 0.1, rnd), U.mat(x, 2.8, z, 0, rnd() * 0.3, 0));
      W.addProp(x, z, r * 0.8, r * 0.8, 1.2); W.addProp(x, z, r * 0.6, r * 0.5, 5.2, { y0: 1.2, mount: false });
      B.add(stone, U.jitter(new THREE.DodecahedronGeometry(r * 0.75, 0), 0.2, rnd), U.mat(x, 4.9, z));
      for (const sx of [-1, 1]) B.add(stone, G.cone, U.mat(x + sx * r * 0.6, 5.4, z, 0, 0, sx * 0.6, 0.18, 1.4, 0.18));
      for (const sx of [-1, 1]) { const e = FX.glowSprite(0x60ffe0, 0.8, 0.9); e.position.set(x + sx * r * 0.25, 5, z + r * 0.6); root.add(e); }
      return true;
    }
    return false;
  };

  // ---------------- skin blocks ('+' clusters, solid to 3.4 m) ----------------
  D2.block = (kind, cl, c) => {
    const { B, MAT, G, rnd, U, root, FX, W } = c, { x, z, w, d } = cl;
    if (kind === 'ruin') { // stacked, weathered temple masonry with a glowing glyph band
      let y = 0;
      for (let k = 0; k < 3; k++) {
        const h = k === 2 ? 3.4 - y : 1.0 + rnd() * 0.2, sh = 0.97 - k * 0.04;
        B.add(MAT.wall, U.jitter(new THREE.BoxGeometry(1, 1, 1, 2, 1, 2), 0.04, rnd), U.mat(x + (rnd() - 0.5) * 0.12, y + h / 2, z + (rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.06, 0, w * sh, h, d * sh));
        y += h;
      }
      B.add(MAT.trim, G.box, U.mat(x, 1.05, z, 0, 0, 0, w * 0.99, 0.12, d * 0.99));
      W.addProp(x, z, w * 0.49, d * 0.49, 3.4);
      const glyph = std('glyph', { color: 0x60ffe0, emissive: 0x30c0a0, emissiveIntensity: 1.2, roughness: 0.5 });
      B.add(glyph, G.box, U.mat(x, 1.7, z, 0, 0, 0, w * 0.975, 0.06, d * 0.975));
      for (let k = 0; k < 3; k++) B.add(MAT.wall, U.jitter(new THREE.DodecahedronGeometry(0.35 + rnd() * 0.25, 0), 0.15, rnd), U.mat(x + (rnd() - 0.5) * w * 0.8, 3.4 + rnd() * 0.2, z + (rnd() - 0.5) * d * 0.8, rnd(), rnd(), 0));
      void root; void FX;
      return true;
    }
    if (kind === 'module') { // lunar hab module lying on its side
      const long = w >= d, L = (long ? w : d) * 0.96, R = Math.min(2.1, (long ? d : w) * 0.44);
      const rz = long ? Math.PI / 2 : 0, rx = long ? 0 : Math.PI / 2;
      B.add(MAT.white, G.cyl, U.mat(x, R + 0.15, z, rx, 0, rz, R, L, R), new THREE.Color(0.9, 0.9, 0.92));
      for (const t of [-0.35, 0, 0.35]) B.add(MAT.trim, G.cyl, U.mat(x + (long ? t * L : 0), R + 0.15, z + (long ? 0 : t * L), rx, 0, rz, R * 1.04, 0.2, R * 1.04));
      B.add(MAT.trim, G.box, U.mat(x, 0.1, z, 0, 0, 0, w * 0.9, 0.2, d * 0.9));
      W.addProp(x, z, long ? L / 2 : R, long ? R : L / 2, 2 * R + 0.2);
      B.add(MAT.hazard, G.box, U.mat(x, 2 * R + 0.2, z, 0, 0, 0, long ? L * 0.5 : 0.5, 0.12, long ? 0.5 : L * 0.5));
      return true;
    }
    return false;
  };

  // ---------------- skin low cover ('=' cells) ----------------
  D2.cover = (kind, c) => {
    const { B, rnd, U, W, x, z, CELL, alongZ } = c;
    if (kind === 'sandbags') {
      const bag = std('sandbag', { color: 0xa0906a, roughness: 1, flatShading: true });
      for (let row = 0; row < 3; row++) for (let k = 0; k < 3; k++) {
        const a = (k - 1) * CELL * 0.3 + (row % 2 ? 0.16 : -0.04), b = (rnd() - 0.5) * 0.2;
        B.add(bag, new THREE.SphereGeometry(1, 7, 4), U.mat(x + (alongZ ? b : a), 0.18 + row * 0.33, z + (alongZ ? a : b), 0, (alongZ ? Math.PI / 2 : 0) + rnd() * 0.3, 0, CELL * 0.17, 0.2, 0.36), new THREE.Color(0.9 + rnd() * 0.1, 0.9, 0.85));
      }
      W.addProp(x, z, alongZ ? 0.45 : CELL * 0.5, alongZ ? CELL * 0.5 : 0.45, 1.0);
      return true;
    }
    return false;
  };
})();
