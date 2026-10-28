'use strict';
// Level structures, placed into open floor while a map is built:
//  - enterable buildings: walls with windows and a doorway, a flat roof you reach by ladder, a light inside
//  - raised platforms on pillars with a flight of stairs and railings
//  - teleporter pairs (they need power, and a clear way between the two pads)
//  - the ammo restock station (every map)
// Every piece is solid where its model is; building walls also block creature navigation.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const ST = XH.structures = { list: [] };
  const P = () => XH.player, G = () => XH.game;
  let W, C;

  // ---------------------------------------------------------------- free space
  const FLOOR = '.,';
  function keepZones() {
    const k = [];
    for (const q of W.buys) k.push([q.pos.x, q.pos.z, 3], [q.wall.position.x, q.wall.position.z, 2.4]);
    for (const q of W.perks) k.push([q.pos.x, q.pos.z, 3.2]);
    for (const q of W.boxSpots) k.push([q.x, q.z, 3.6]);
    if (W.forge) k.push([W.forge.pos.x, W.forge.pos.z, 3.4]);
    if (W.powerSwitch) k.push([W.powerSwitch.pos.x, W.powerSwitch.pos.z, 3.2]);
    for (const q of W.spawns) k.push([q.x, q.z, 3.6]);
    for (const key in W.spots) { const v = W.spots[key]; for (const q of Array.isArray(v) ? v : v ? [v] : []) k.push([q.x, q.z, 3.4]); }
    for (const id in W.doors) for (const ci of W.doors[id].cells) k.push([W.cx2x(ci % W.w), W.cz2z((ci / W.w) | 0), 3.4]);
    if (W.start) k.push([W.start.x, W.start.z, 5]);
    return k;
  }
  function makeFree() {
    const { rows, H, Wd } = C, free = new Uint8Array(W.w * W.h), keep = keepZones();
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const i = z * Wd + x;
      if (!FLOOR.includes(rows[z][x]) || W.solid[i] || W.haz[i] || (W.propGrid.get(i) || []).some((p) => !p.terrain)) continue;
      const px = W.cx2x(x), pz = W.cz2z(z);
      if (keep.some(([kx, kz, r]) => Math.hypot(kx - px, kz - pz) < r)) continue;
      free[i] = 1;
    }
    return free;
  }
  // all top-left corners where a w x h block of cells is completely free
  function rects(free, w, h) {
    const Wd = W.w, Hh = W.h, S = new Int32Array((Wd + 1) * (Hh + 1)), out = [];
    for (let z = 0; z < Hh; z++) for (let x = 0; x < Wd; x++) S[(z + 1) * (Wd + 1) + x + 1] = free[z * Wd + x] + S[z * (Wd + 1) + x + 1] + S[(z + 1) * (Wd + 1) + x] - S[z * (Wd + 1) + x];
    const sum = (x0, z0, x1, z1) => S[z1 * (Wd + 1) + x1] - S[z0 * (Wd + 1) + x1] - S[z1 * (Wd + 1) + x0] + S[z0 * (Wd + 1) + x0];
    for (let z = 0; z + h <= Hh; z++) for (let x = 0; x + w <= Wd; x++) if (sum(x, z, x + w, z + h) === w * h) out.push({ x, z, w, h });
    return out;
  }
  function claim(free, r, pad = 0) {
    for (let z = r.z - pad; z < r.z + r.h + pad; z++) for (let x = r.x - pad; x < r.x + r.w + pad; x++) if (W.inside(x, z)) free[z * W.w + x] = 0;
  }
  const centerOf = (r) => ({ x: W.cx2x(r.x) + (r.w - 1) * W.CELL / 2, z: W.cz2z(r.z) + (r.h - 1) * W.CELL / 2 });
  // pick a candidate at a given fraction of the distance range from the start (0 = nearest, 1 = farthest)
  function pickAt(list, frac) {
    if (!list.length) return null;
    const s = W.start, sc = list.map((r) => { const c = centerOf(r); return { r, d: Math.hypot(c.x - s.x, c.z - s.z) }; }).sort((a, b) => a.d - b.d);
    return sc[Math.min(sc.length - 1, Math.floor(frac * (sc.length - 1)))].r;
  }
  // how much open floor lies beyond a side of a rect (to face doors and stairs into the room)
  function openness(r, dx, dz) {
    let n = 0;
    for (let k = 1; k <= 4; k++) for (let t = 0; t < (dx ? r.h : r.w); t++) {
      const x = dx ? (dx > 0 ? r.x + r.w - 1 + k : r.x - k) : r.x + t, z = dz ? (dz > 0 ? r.z + r.h - 1 + k : r.z - k) : r.z + t;
      if (W.inside(x, z) && FLOOR.includes(C.rows[z][x]) && !W.solid[z * W.w + x]) n++;
    }
    return n;
  }
  const SIDES = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  // ---------------------------------------------------------------- materials / helpers
  function mats() {
    const M = C.MAT;
    return { wall: M.wall, trim: M.trim, dark: M.dark, glow: M.powerGlow, metal: M.trim };
  }
  function box(mat, x, y, z, sx, sy, sz, ry = 0, col) { C.B.add(mat, C.G.box, U.mat(x, y, z, 0, ry, 0, sx, sy, sz), col); }
  // a solid box that is also a collider (axis-aligned)
  function solid(mat, x0, x1, y0, y1, z0, z1, o = {}) {
    box(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, 0, o.col);
    return W.addProp((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, y1, Object.assign({ y0: y0 }, o));
  }
  function navBlock(cx, cz) { if (!W.inside(cx, cz)) return; const i = cz * W.w + cx; W.solid[i] = 2; W.soft[i] = 1; W.hgt[i] = 0; }
  // a lamp that follows the power (lights without a pole never get a sentry)
  function lamp(x, y, z, color, inten = 1.1, dist = 14) {
    const l = W.lampLight(color, inten, dist, 1.6, x, y, z); // a record: world.js's light pool lights it
    const glow = FX.glowSprite(color, 1.2, 0.6); glow.position.set(x, y, z); C.root.add(glow);
    box(C.MAT.powerGlow, x, y + 0.08, z, 0.9, 0.06, 0.25, 0, color);
    W.lights.push({ light: l, glow, base: inten, flick: Math.random() * 10, color, x, z, y, emergency: true, noSentry: true });
  }

  // ---------------------------------------------------------------- buildings
  const WALL_H = 3.4, ROOF = 3.45;
  function building(r, name) {
    const CELL = W.CELL, c = centerOf(r), half = (r.w - 1) * CELL / 2, t = 0.25, M = mats();
    const S = { kind: 'building', topY: ROOF, access: [], r, c }; // filled in below; props point at it
    const tint = new THREE.Color({ outpost: 0xb8b0a0, ice: 0xc8d4e0, city: 0xd0c8b8, ship: 0xa8b0b8, hive: 0x9a7a80 }[C.def.theme] || 0xb8b8b8);
    // doorway faces the most open side, ladder on the opposite side
    const sides = SIDES.map(([dx, dz]) => ({ dx, dz, o: openness(r, dx, dz) })).sort((a, b) => b.o - a.o);
    const door = sides[0], ladder = sides.find((s) => s.dx === -door.dx && s.dz === -door.dz);
    const ringCells = [];
    for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) if (x === r.x || z === r.z || x === r.x + r.w - 1 || z === r.z + r.h - 1) ringCells.push([x, z]);
    const doorCell = [door.dx ? (door.dx > 0 ? r.x + r.w - 1 : r.x) : r.x + (r.w >> 1), door.dz ? (door.dz > 0 ? r.z + r.h - 1 : r.z) : r.z + (r.h >> 1)];
    for (const [x, z] of ringCells) if (x !== doorCell[0] || z !== doorCell[1]) navBlock(x, z);
    // four walls (a doorway on one side, windows on the two sides next to it)
    for (const s of SIDES.map(([dx, dz]) => ({ dx, dz }))) {
      const along = s.dx ? 'z' : 'x', fixed = s.dx ? c.x + s.dx * half : c.z + s.dz * half;
      const isDoor = s.dx === door.dx && s.dz === door.dz, isWin = !isDoor && !(s.dx === ladder.dx && s.dz === ladder.dz);
      const a0 = (along === 'x' ? c.x : c.z) - half - t, a1 = (along === 'x' ? c.x : c.z) + half + t;
      const seg = (b0, b1, y0, y1) => {
        if (b1 - b0 < 0.05) return;
        if (along === 'x') solid(C.MAT.concrete, b0, b1, y0, y1, fixed - t, fixed + t, { mount: y0 === 0, col: tint, noClimb: true, struct: S });
        else solid(C.MAT.concrete, fixed - t, fixed + t, y0, y1, b0, b1, { mount: y0 === 0, col: tint, noClimb: true, struct: S });
      };
      const mid = (a0 + a1) / 2;
      if (isDoor) { seg(a0, mid - 0.95, 0, WALL_H); seg(mid + 0.95, a1, 0, WALL_H); seg(mid - 0.95, mid + 0.95, 2.45, WALL_H); }
      else if (isWin) {
        const w0 = mid - 1.5, w1 = mid + 1.5;
        seg(a0, w0, 0, WALL_H); seg(w1, a1, 0, WALL_H); seg(w0, w1, 0, 1.05); seg(w0, w1, 2.15, WALL_H);
        const sx = along === 'x' ? mid : fixed, sz = along === 'x' ? fixed : mid;
        box(M.trim, sx, 1.08, sz, along === 'x' ? 3.1 : 0.62, 0.08, along === 'x' ? 0.62 : 3.1); // sill
      } else seg(a0, a1, 0, WALL_H);
      // base trim
      box(M.trim, s.dx ? fixed : c.x, 0.12, s.dz ? fixed : c.z, s.dx ? 2 * t + 0.08 : 2 * half + 2 * t + 0.08, 0.24, s.dz ? 2 * t + 0.08 : 2 * half + 2 * t + 0.08);
    }
    // roof: one slab you can walk on, with a trim lip
    const rh = half + t + 0.1;
    solid(M.dark, c.x - rh, c.x + rh, ROOF - 0.28, ROOF, c.z - rh, c.z + rh, { mount: true, noClimb: true, struct: S });
    for (const [dx, dz] of SIDES) box(M.trim, c.x + dx * rh, ROOF + 0.05, c.z + dz * rh, dx ? 0.12 : 2 * rh, 0.12, dz ? 0.12 : 2 * rh);
    // door frame + sign
    const df = { x: c.x + door.dx * half, z: c.z + door.dz * half }, ry = Math.atan2(door.dx, door.dz);
    box(M.trim, df.x + door.dx * (t + 0.02), 2.5, df.z + door.dz * (t + 0.02), door.dx ? 0.06 : 2.1, 0.12, door.dz ? 0.06 : 2.1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.45), new THREE.MeshBasicMaterial({ map: U.labelTex([{ t: name.toUpperCase(), font: 'bold 54px Rajdhani, Consolas, monospace', c: '#e8f0f8' }], { w: 512, h: 104, bg: 'rgba(8,10,14,0.9)', glow: '#4ab', border: '#4ab' }), transparent: true }));
    sign.material.map.userData = { transient: true };
    sign.position.set(df.x + door.dx * (t + 0.05), 2.95, df.z + door.dz * (t + 0.05)); sign.rotation.y = ry; C.root.add(sign);
    // light inside
    lamp(c.x, WALL_H - 0.45, c.z, 0xffe0b0, 1.2, 13);
    // ladder up the outside of the back wall
    const lf = { x: c.x + ladder.dx * (half + t), z: c.z + ladder.dz * (half + t) };
    const L = ladderAt(lf.x, lf.z, ladder.dx, ladder.dz, ROOF, { x: c.x + ladder.dx * (half - 0.9), z: c.z + ladder.dz * (half - 0.9) });
    const b = Object.assign(S, { name, r, c, half, door, ladder: L, roofY: ROOF, inside: (x, z) => Math.abs(x - c.x) < half - 0.2 && Math.abs(z - c.z) < half - 0.2 });
    b.access.push({ kind: 'ladder', L, base: L.base, top: L.top });
    // the back wall inside: where the ammo station goes
    b.backWall = { x: c.x + ladder.dx * (half - t - 0.55), z: c.z + ladder.dz * (half - t - 0.55), dx: -ladder.dx, dz: -ladder.dz };
    b.sideWall = { x: c.x + (door.dz ? 1 : 0) * (half - t - 0.02), z: c.z + (door.dx ? 1 : 0) * (half - t - 0.02), dx: door.dz ? -1 : 0, dz: door.dx ? -1 : 0 };
    W.keepClear.push([c.x, c.z, half + 2.6]);
    ST.list.push(b);
    return b;
  }

  // ---------------------------------------------------------------- ladders
  // A ladder on a wall face (facing dx, dz) up to height top; 'roof' is where you step off at the top.
  function ladderAt(x, z, dx, dz, top, roof) {
    const g = new THREE.Group(); g.position.set(x + dx * 0.22, 0, z + dz * 0.22); g.rotation.y = Math.atan2(dx, dz); C.root.add(g);
    const rail = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.8, roughness: 0.35 });
    for (const sx of [-0.32, 0.32]) { const m = new THREE.Mesh(C.G.box, rail); m.scale.set(0.06, top + 0.9, 0.06); m.position.set(sx, (top + 0.9) / 2, 0); g.add(m); }
    for (let y = 0.3; y < top + 0.2; y += 0.34) { const m = new THREE.Mesh(C.G.cyl, rail); m.scale.set(0.025, 0.62, 0.025); m.rotation.z = Math.PI / 2; m.position.set(0, y, 0); g.add(m); }
    const stripe = new THREE.Mesh(C.G.box, new THREE.MeshBasicMaterial({ color: 0xffc030 })); stripe.scale.set(0.7, 0.05, 0.05); stripe.position.set(0, top + 0.85, 0); g.add(stripe);
    const by = W.terrainOn ? W.dispAt(roof.x, roof.z) : 0; // the structure stands on the floor under it
    const L = { kind: 'ladder', base: new THREE.Vector3(x + dx * 1.35, W.floorAt(x + dx * 1.35, z + dz * 1.35), z + dz * 1.35), top: new THREE.Vector3(roof.x, top + by, roof.z), wall: { x, z, dx, dz }, h: top + by };
    ST.ladders.push(L);
    return L;
  }

  // ---------------------------------------------------------------- raised platform with stairs
  const DECK = 3.0;
  function platform(r, stairDir, name) {
    const CELL = W.CELL, c = centerOf(r), half = r.w * CELL / 2 - 0.2, M = mats();
    // deck (y0 below the top so you can walk underneath)
    const S = { kind: 'platform', topY: DECK, access: [] };
    solid(M.dark, c.x - half, c.x + half, DECK - 0.25, DECK, c.z - half, c.z + half, { mount: true, noClimb: true, struct: S });
    box(M.trim, c.x, DECK + 0.03, c.z, 2 * half - 0.3, 0.04, 2 * half - 0.3, 0, new THREE.Color(0.55, 0.55, 0.55));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { C.B.add(M.metal, C.G.cyl, U.mat(c.x + sx * (half - 0.25), (DECK - 0.25) / 2, c.z + sz * (half - 0.25), 0, 0, 0, 0.16, DECK - 0.25, 0.16)); W.addCyl(c.x + sx * (half - 0.25), c.z + sz * (half - 0.25), 0.2, DECK - 0.25, { mount: false, noClimb: true }); }
    // stairs: a straight flight up to the deck edge on side stairDir
    const [dx, dz] = stairDir, n = 7, rise = DECK / n, tread = 0.56, wid = 1.5;
    const edge = { x: c.x + dx * half, z: c.z + dz * half };
    for (let k = 1; k <= n; k++) {
      const out = (n - k) * tread + tread / 2, sx = edge.x + dx * out, sz = edge.z + dz * out, top = k * rise;
      const hx = dx ? tread / 2 : wid / 2, hz = dz ? tread / 2 : wid / 2;
      solid(k === n ? M.dark : M.trim, sx - hx, sx + hx, 0, top, sz - hz, sz + hz, { mount: true, col: new THREE.Color(0.7, 0.7, 0.72), noClimb: true, struct: S });
      navBlock(W.cellX(sx), W.cellZ(sz));
    }
    // railings on the deck edges (not across the top of the stairs): stop you from strolling off, creatures ignore them
    const rail = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.6, roughness: 0.4 });
    for (const [sx, sz] of SIDES) {
      const isStair = sx === dx && sz === dz, ex = c.x + sx * half, ez = c.z + sz * half, len = 2 * half;
      const parts = isStair ? [[-half, -wid / 2 - 0.1], [wid / 2 + 0.1, half]] : [[-half, half]];
      for (const [p0, p1] of parts) {
        const m0 = (p0 + p1) / 2, L = p1 - p0, px = sx ? ex : c.x + m0, pz = sz ? ez : c.z + m0;
        for (const y of [DECK + 0.55, DECK + 1.0]) { const m = new THREE.Mesh(C.G.box, rail); m.scale.set(sx ? 0.05 : L, 0.05, sz ? 0.05 : L); m.position.set(px, y, pz); C.root.add(m); }
        for (let k = 0; k <= Math.ceil(L / 1.5); k++) { const a = p0 + (L * k) / Math.ceil(L / 1.5), m = new THREE.Mesh(C.G.box, rail); m.scale.set(0.05, 1.0, 0.05); m.position.set(sx ? ex : c.x + a, DECK + 0.5, sz ? ez : c.z + a); C.root.add(m); }
        W.addProp(px, pz, sx ? 0.08 : L / 2, sz ? 0.08 : L / 2, DECK + 1.05, { y0: DECK, mount: false, bullets: false, enemy: false });
      }
      void len;
    }
    lamp(c.x, DECK - 0.5, c.z, 0xffd8a0, 0.9, 12);
    const p = Object.assign(S, { name, r, c, half, deckY: DECK, stairs: { dx, dz } });
    // creatures walk up the stairs: from beyond the bottom step to just inside the deck edge
    p.access.push({ kind: 'stairs', base: new THREE.Vector3(edge.x + dx * (n * tread + 0.9), 0, edge.z + dz * (n * tread + 0.9)), top: new THREE.Vector3(edge.x - dx * 0.9, DECK, edge.z - dz * 0.9) });
    W.keepClear.push([c.x, c.z, half + 2.4], [edge.x + dx * 2.2, edge.z + dz * 2.2, 2.4]);
    ST.list.push(p);
    return p;
  }

  // ---------------------------------------------------------------- jump pads and ziplines
  // A jump pad next to a building or platform throws you up onto it; a zipline runs from its top down to a spot
  // 15-30 m away with a clear line, for a quick escape. Creatures use neither.
  function jumpPad(free, S, top) {
    const c = S.c, best = [];
    for (let z = 1; z < W.h - 1; z++) for (let x = 1; x < W.w - 1; x++) {
      if (!free[z * W.w + x]) continue;
      const px = W.cx2x(x), pz = W.cz2z(z), d = Math.hypot(px - c.x, pz - c.z);
      if (d < S.half + 3 || d > S.half + 7) continue;
      if (S.access.some((a) => Math.hypot(a.base.x - px, a.base.z - pz) < 3.5)) continue;
      if (S.door && Math.hypot(c.x + S.door.dx * S.half - px, c.z + S.door.dz * S.half - pz) < 4) continue;
      best.push({ x, z, px, pz, d });
    }
    if (!best.length) return null;
    best.sort((a, b) => a.d - b.d);
    const q = best[0]; claim(free, { x: q.x - 1, z: q.z - 1, w: 3, h: 3 });
    const g = new THREE.Group(); g.position.set(q.px, 0, q.pz); C.root.add(g);
    const base = new THREE.Mesh(C.G.cyl6, new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.7, roughness: 0.4 })); base.scale.set(1.05, 0.16, 1.05); base.position.y = 0.08; g.add(base);
    const glowM = new THREE.MeshBasicMaterial({ color: 0xffc030 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.5 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.17; g.add(disc);
    const dir = Math.atan2(c.x - q.px, c.z - q.pz), chev = [];
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 3, 1, -Math.PI / 6, Math.PI / 3 * 2), glowM); m.rotation.x = -Math.PI / 2; m.rotation.z = dir; m.position.set(Math.sin(dir) * (k - 1) * 0.35, 0.18, Math.cos(dir) * (k - 1) * 0.35); g.add(m); chev.push(m); }
    { const gs = FX.glowSprite(0xffa020, 2.2, 0.5); gs.position.y = 0.4; g.add(gs); }
    W.addCyl(q.px, q.pz, 1.05, 0.16, { mount: true });
    W.keepClear.push([q.px, q.pz, 2.4]);
    const land = new THREE.Vector3(c.x + (q.px - c.x) / q.d * Math.max(0, S.half - 2), top, c.z + (q.pz - c.z) / q.d * Math.max(0, S.half - 2));
    const pad = { kind: 'jumppad', pos: new THREE.Vector3(q.px, 0, q.pz), land, top, g, chev, disc, cd: 0 };
    ST.pads.push(pad);
    return pad;
  }
  function zipline(free, S, top) {
    const c = S.c;
    let best = null;
    for (let z = 1; z < W.h - 1; z++) for (let x = 1; x < W.w - 1; x++) {
      if (!free[z * W.w + x]) continue;
      const px = W.cx2x(x), pz = W.cz2z(z), d = Math.hypot(px - c.x, pz - c.z);
      if (d < 15 || d > 32 || (best && best.d > d)) continue;
      const ux = (px - c.x) / d, uz = (pz - c.z) / d, sx = c.x + ux * (S.half + 0.2), sz = c.z + uz * (S.half + 0.2);
      const a = new THREE.Vector3(sx, top + 2.3, sz), b = new THREE.Vector3(px, 2.5, pz), len = a.distanceTo(b);
      const f0 = new THREE.Vector3(sx + ux * 0.4, top + 0.9, sz + uz * 0.4), f1 = new THREE.Vector3(px, 1.1, pz), l2 = f0.distanceTo(f1);
      if (W.raycast(a, b.clone().sub(a).normalize(), len).t < len - 0.5) continue;
      if (W.raycast(f0, f1.clone().sub(f0).normalize(), l2).t < l2 - 0.5) continue;
      best = { x, z, px, pz, d, a, b, sx, sz, ux, uz };
    }
    if (!best) return null;
    claim(free, { x: best.x - 1, z: best.z - 1, w: 3, h: 3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3e44, metalness: 0.8, roughness: 0.35 });
    const post = (x, z, y0, h) => { const m = new THREE.Mesh(C.G.cyl, dark); m.scale.set(0.08, h, 0.08); m.position.set(x, y0 + h / 2, z); C.root.add(m); };
    post(best.sx, best.sz, top, 2.4); post(best.px, best.pz, 0, 2.6); W.addCyl(best.px, best.pz, 0.14, 2.6, { mount: false });
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
    const mid = best.a.clone().add(best.b).multiplyScalar(0.5), dirv = best.b.clone().sub(best.a); cable.scale.y = dirv.length(); cable.position.copy(mid); cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirv.normalize()); C.root.add(cable);
    const tag = FX.glowSprite(0x40ff90, 0.9, 0.8); tag.position.set(best.sx, top + 2.45, best.sz); C.root.add(tag);
    W.keepClear.push([best.px, best.pz, 2.2]);
    const zl = { kind: 'zipline', start: new THREE.Vector3(best.sx - best.ux * 0.6, top, best.sz - best.uz * 0.6), from: new THREE.Vector3(best.sx + best.ux * 0.4, top + 0.25, best.sz + best.uz * 0.4), to: new THREE.Vector3(best.px - best.ux * 0.6, 0.35, best.pz - best.uz * 0.6), top };
    ST.zips.push(zl);
    return zl;
  }

  // ---------------------------------------------------------------- teleporters
  function pad(x, z, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); C.root.add(g);
    const base = new THREE.Mesh(C.G.cyl6, new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.7, roughness: 0.4 })); base.scale.set(1.25, 0.14, 1.25); base.position.y = 0.07; g.add(base);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.15; g.add(disc);
    const rings = [0, 1].map((k) => { const m = new THREE.Mesh(C.G.torus, new THREE.MeshBasicMaterial({ color })); m.scale.setScalar(0.9 - k * 0.25); m.rotation.x = Math.PI / 2; m.position.y = 0.6 + k * 0.9; g.add(m); return m; });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 3.2, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 1.6; g.add(beam);
    const glow = FX.glowSprite(color, 3, 0.6); glow.position.y = 0.4; g.add(glow);
    W.addCyl(x, z, 1.25, 0.14, { mount: true });
    return { g, disc, rings, beam, glow, pos: new THREE.Vector3(x, 0, z), charge: 0, color };
  }
  function teleporters(free, color) {
    const p0 = XH.edits && XH.edits.pin('tele0'), p1 = XH.edits && XH.edits.pin('tele1');
    if (p0 && p1) return telePair(p0.x, p0.z, p1.x, p1.z, color);
    const cand = rects(free, 3, 3).map((r) => ({ r, c: centerOf(r) }));
    if (cand.length < 2) return null;
    let best = null, bd = 0;
    // farthest pair (sampled) that is at least 30 m apart
    const step = Math.max(1, Math.floor(cand.length / 80));
    for (let i = 0; i < cand.length; i += step) for (let j = i + 1; j < cand.length; j += step) { const d = Math.hypot(cand[i].c.x - cand[j].c.x, cand[i].c.z - cand[j].c.z); if (d > bd) { bd = d; best = [cand[i], cand[j]]; } }
    if (!best || bd < 30) return null;
    for (const q of best) claim(free, q.r, 1);
    return telePair(best[0].c.x, best[0].c.z, best[1].c.x, best[1].c.z, color);
  }
  function telePair(ax, az, bx, bz, color) {
    const A0 = pad(ax, az, color), B0 = pad(bx, bz, color);
    W.piece('tele0', { label: 'Teleporter A', shape: 'point', x: ax, z: az, r: 1.25, off: true });
    W.piece('tele1', { label: 'Teleporter B', shape: 'point', x: bx, z: bz, r: 1.25, off: true });
    A0.other = B0; B0.other = A0;
    W.keepClear.push([A0.pos.x, A0.pos.z, 2.6], [B0.pos.x, B0.pos.z, 2.6]);
    const t = { kind: 'teleporters', pads: [A0, B0], cd: 0 };
    ST.list.push(t); ST.teleporters = t;
    return t;
  }

  // ---------------------------------------------------------------- ammo restock station
  // the restock as a pile of supply crates (or a crashed drop pod) where a machine would make no sense
  function supplyCache(g, x, y, z, dx, dz, skin, add, olive, dark) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 0.9 }), brass = new THREE.MeshStandardMaterial({ color: 0xc89a30, metalness: 0.8, roughness: 0.3 });
    if (skin === 'pod') {
      add(C.G.cyl, dark, [0, 0.9, -0.2], [0.75, 1.8, 0.75], [0.35, 0, 0.1]);
      add(C.G.cyl, olive, [0, 1.05, -0.05], [0.78, 0.3, 0.78], [0.35, 0, 0.1]);
      add(C.G.box, olive, [0, 0.35, 0.45], [1.2, 0.5, 0.6]);
      for (let k = 0; k < 5; k++) add(C.G.cyl, brass, [-0.3 + k * 0.15, 0.68, 0.45], [0.04, 0.16, 0.04]);
      add(C.G.cone, new THREE.MeshBasicMaterial({ color: 0xff7020 }), [0.1, 0.25, -0.9], [0.5, 0.3, 0.5], [Math.PI / 2 + 0.35, 0, 0]);
    } else {
      add(C.G.box, olive, [-0.35, 0.35, -0.1], [0.9, 0.7, 0.7]); add(C.G.box, olive, [0.5, 0.3, 0.05], [0.7, 0.6, 0.6], [0, 0.3, 0]);
      add(C.G.box, wood, [-0.2, 0.95, -0.15], [0.8, 0.5, 0.55], [0, -0.15, 0]);
      for (let k = 0; k < 6; k++) add(C.G.cyl, brass, [-0.5 + k * 0.14, 1.28, -0.12], [0.04, 0.16, 0.04]);
      add(C.G.box, dark, [0.5, 0.66, 0.05], [0.72, 0.08, 0.62], [0, 0.3, 0]);
    }
    const tag = add(C.G.plane, new THREE.MeshBasicMaterial({ map: U.labelTex([{ t: skin === 'pod' ? 'DROP POD' : 'SUPPLY CACHE', font: 'bold 48px Orbitron, Consolas', c: '#ffd860' }, { t: 'AMMO', font: 'bold 40px Rajdhani, Consolas', c: '#e8e8e8' }], { w: 256, h: 128, bg: '#101408', glow: '#ffd860', border: '#ffd860' }) }), [0, 1.75, 0], [0.9, 0.45, 1]);
    tag.material.map.userData = { transient: true };
    W.addPropRot(x, z, 1.6, 1.0, Math.atan2(dx, dz), y + 1.3, { mount: false, y0: y });
    const s = { kind: 'ammo', g, pos: new THREE.Vector3(x + dx * 1.2, y, z + dz * 1.2), y, round: -1 };
    W.keepClear.push([x, z, 2.2]);
    ST.ammo = s; ST.list.push(s);
    return s;
  }
  function ammoStation(x, z, dx, dz, y = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.atan2(dx, dz); C.root.add(g);
    const olive = new THREE.MeshStandardMaterial({ color: 0x4a5a34, roughness: 0.7, metalness: 0.3 }), dark = new THREE.MeshStandardMaterial({ color: 0x1c1f22, metalness: 0.6, roughness: 0.4 });
    const add = (geo, mat, p, s, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.scale.set(...s); if (r) m.rotation.set(...r); g.add(m); return m; };
    const skin = XH.zones && XH.zones.place('ammoSkin');
    if (skin) return supplyCache(g, x, y, z, dx, dz, skin, add, olive, dark);
    add(C.G.box, dark, [0, 0.55, -0.1], [1.5, 1.1, 0.7]);
    add(C.G.box, olive, [0, 0.62, 0.2], [1.4, 0.5, 0.25]);
    for (let k = 0; k < 4; k++) add(C.G.box, olive, [-0.52 + k * 0.35, 1.25, -0.1], [0.3, 0.28, 0.5]);
    for (let k = 0; k < 6; k++) add(C.G.cyl, new THREE.MeshStandardMaterial({ color: 0xc89a30, metalness: 0.8, roughness: 0.3 }), [-0.35 + k * 0.14, 0.95, 0.18], [0.04, 0.16, 0.04]);
    const screen = add(C.G.plane, new THREE.MeshBasicMaterial({ map: U.labelTex([{ t: 'AMMO', font: 'bold 72px Orbitron, Consolas', c: '#ffd860' }, { t: 'RESTOCK', font: 'bold 44px Rajdhani, Consolas', c: '#e8e8e8' }], { w: 256, h: 160, bg: '#101408', glow: '#ffd860', border: '#ffd860' }) }), [0, 1.75, -0.1], [1.0, 0.62, 1]);
    screen.material.map.userData = { transient: true };
    W.addPropRot(x, z, 1.5, 0.9, Math.atan2(dx, dz), y + 1.45, { mount: false, y0: y });
    const s = { kind: 'ammo', g, pos: new THREE.Vector3(x + dx * 1.2, y, z + dz * 1.2), y, round: -1 };
    W.keepClear.push([x, z, 2.2]);
    ST.ammo = s; ST.list.push(s);
    return s;
  }
  // a free wall face in the start zone for the station (fallback when there is no building)
  function wallSpot(free, preferStart) {
    const out = wallSpots(free, preferStart);
    if (!out.length) return null;
    const s = W.start;
    out.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z));
    return out[Math.min(out.length - 1, 3)];
  }
  function wallSpots(free, preferStart) {
    const out = [];
    for (let z = 1; z < W.h - 1; z++) for (let x = 1; x < W.w - 1; x++) {
      const i = z * W.w + x; if (!free[i]) continue;
      if (preferStart && !W.reach[i]) continue;
      for (const [dx, dz] of SIDES) {
        const q = C.rows[z - dz] && C.rows[z - dz][x - dx];
        if (q !== '#' && !(q >= 'a' && q <= 'w')) continue;
        if (!free[(z + dz) * W.w + x + dx]) continue;
        out.push({ x: W.cx2x(x) - dx * 0.55, z: W.cz2z(z) - dz * 0.55, dx, dz, cx: x, cz: z });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- build (called by world.js)
  // plan (from XH.UNIQUE): { building: 'Name', platform: 'Name', teleporters: color }; every map gets the ammo station.
  ST.build = (c) => {
    W = XH.world; C = c; ST.list = []; ST.ladders = []; ST.pads = []; ST.zips = []; ST.ammo = null; ST.teleporters = null; ST.building = null; ST.platform = null;
    W.keepClear = W.keepClear || [];
    const plan = (XH.UNIQUE && XH.UNIQUE[c.def.id] && XH.UNIQUE[c.def.id].structures) || {};
    W.updateZones();
    const free = makeFree();
    const tall = !c.def.ceiling || c.def.wallH >= 6.5;
    const pin = (k) => XH.edits && XH.edits.pin(k), pinB = pin('building'), pinP = pin('platform');
    if (pinB && !pinB.off && tall) { const n = pinB.n || 5; claim(free, { x: pinB.x - 1, z: pinB.z - 1, w: n + 2, h: n + 2 }, 1); ST.building = building({ x: pinB.x, z: pinB.z, w: n, h: n }, plan.building || 'OUTPOST'); }
    else if (plan.building && tall && !pinB) {
      // a 5x5-cell building if there is room, otherwise a 3x3 shack (odd sizes keep the doorway on a cell)
      for (const n of [5, 3]) {
        const zr = XH.zones && XH.zones.place('building') ? XH.zones.inZone(rects(free, n + 2, n + 2), XH.zones.place('building')) : [];
        const r = zr[0] || pickAt(rects(free, n + 2, n + 2), plan.buildingAt !== undefined ? plan.buildingAt : 0.35);
        if (r) { claim(free, r, 1); ST.building = building({ x: r.x + 1, z: r.z + 1, w: n, h: n }, plan.building); break; }
      }
    }
    if (pinP && !pinP.off && tall) {
      const dx = pinP.dx || 0, dz = dx ? 0 : pinP.dz || 1, r = { x: pinP.x, z: pinP.z, w: dx ? 7 : 5, h: dz ? 7 : 5 };
      claim(free, r, 1); ST.platform = platform({ x: r.x + 1 + (dx < 0 ? 2 : 0), z: r.z + 1 + (dz < 0 ? 2 : 0), w: 3, h: 3 }, [dx, dz], plan.platform || 'Platform'); ST.platform.fr = r;
    } else if (plan.platform && tall && !pinP) {
      // 3x3 deck plus 2 cells of stairs on one side and a cell of margin all round
      let best = null;
      const order = SIDES.slice(), k0 = Math.floor(c.rnd() * 4);
      for (let k = 0; k < 4 && !best; k++) {
        const [dx, dz] = order[(k0 + k) % 4], w = dx ? 7 : 5, h = dz ? 7 : 5, zr = XH.zones && XH.zones.place('platform') ? XH.zones.inZone(rects(free, w, h), XH.zones.place('platform')) : [];
        const r = zr[0] || pickAt(rects(free, w, h), plan.platformAt !== undefined ? plan.platformAt : 0.7);
        if (r) best = { r, dx, dz };
      }
      if (best) {
        const { r, dx, dz } = best, deck = { x: r.x + 1 + (dx < 0 ? 2 : 0), z: r.z + 1 + (dz < 0 ? 2 : 0), w: 3, h: 3 };
        claim(free, r, 1); ST.platform = platform(deck, [dx, dz], plan.platform); ST.platform.fr = r;
      }
    }
    for (const S of [ST.building, ST.platform]) if (S) { const by = W.terrainOn && S.c ? W.dispAt(S.c.x, S.c.z) : 0; S.topY += by; const top = (S.roofY || S.deckY) + by; jumpPad(free, S, top); zipline(free, S, top); }
    if ((plan.teleporters || (pin('tele0') && pin('tele1'))) && !(pin('tele0') && pin('tele0').off)) teleporters(free, plan.teleporters || 0x60c8ff);
    if (ST.building) { const b = ST.building.r, c0 = centerOf(b); W.piece('building', { label: 'Building', shape: 'rect', x: c0.x, z: c0.z, w: b.w * W.CELL, d: b.h * W.CELL, cells: { x: b.x, z: b.z, w: b.w, h: b.h }, n: b.w, off: true }); }
    if (ST.platform && ST.platform.fr) { const r = ST.platform.fr, c0 = centerOf(r); W.piece('platform', { label: 'Platform', shape: 'rect', x: c0.x, z: c0.z, w: r.w * W.CELL, d: r.h * W.CELL, cells: { x: r.x, z: r.z, w: r.w, h: r.h }, dx: ST.platform.stairs.dx, dz: ST.platform.stairs.dz, turn: true, off: true }); }
    // ammo station: where it was placed by hand, else in the zone it belongs to (the armory, the security desk...), else
    // inside the building, else near the start
    const pinA = pin('ammo');
    if (pinA) { ammoStation(pinA.x, pinA.z, pinA.dx || 0, pinA.dx ? 0 : pinA.dz || 1); W.piece('ammo', { label: 'Ammo station', shape: 'wall', x: pinA.x, z: pinA.z, r: 0.9, dx: pinA.dx || 0, dz: pinA.dx ? 0 : pinA.dz || 1 }); ST.free = free; return; }
    if (W.auto === false) { ST.free = free; return; } // a map of your own: only where you put it
    const az = XH.zones && XH.zones.place('ammo'), bz = ST.building && XH.zones ? XH.zones.at(ST.building.r.x + 1, ST.building.r.z + 1) : null;
    const zq = az && XH.zones.byName(az);
    const inAz = zq && !(bz && bz.name === az) ? wallSpots(free, false).filter((s) => { const q = XH.zones.at(s.cx, s.cz); return q && q.name === az; }).sort((a, b) => Math.hypot(a.cx - zq.cx, a.cz - zq.cz) - Math.hypot(b.cx - zq.cx, b.cz - zq.cz))[0] : null;
    if (inAz) { ammoStation(inAz.x, inAz.z, inAz.dx, inAz.dz); claim(free, { x: inAz.cx - 1, z: inAz.cz - 1, w: 3, h: 3 }); }
    else if (ST.building) { const b = ST.building.backWall; ammoStation(b.x, b.z, b.dx, b.dz); }
    else { const s = wallSpot(free, true) || wallSpot(free, false); if (s) { ammoStation(s.x, s.z, s.dx, s.dz); claim(free, { x: s.cx - 1, z: s.cz - 1, w: 3, h: 3 }); } }
    if (ST.ammo) W.piece('ammo', { label: 'Ammo station', shape: 'wall', x: ST.ammo.g.position.x, z: ST.ammo.g.position.z, r: 0.9, dx: Math.round(Math.sin(ST.ammo.g.rotation.y)), dz: Math.round(Math.cos(ST.ammo.g.rotation.y)) });
    ST.free = free; // uniques.js places its perk machine and weapon from what is left
  };
  ST.freeRects = (w, h) => rects(ST.free, w, h);
  ST.claim = (r, pad) => claim(ST.free, r, pad);
  ST.wallSpot = (preferStart) => wallSpot(ST.free, preferStart);
  ST.wallSpots = () => wallSpots(ST.free, false);

  // ---------------------------------------------------------------- runtime
  const ammoPrice = () => { const r = G().round || 1; return G().price(Math.round((2500 + 250 * r) * (XH.uniques ? XH.uniques.priceMul('ammo') : 1) / 50) * 50); };
  ST.ammoPrice = ammoPrice;
  ST.candidates = (out) => {
    const Pl = P().pos, Wd = XH.world;
    const near = (p, r, dy = 1.2) => { const d = Math.hypot(p.x - Pl.x, p.z - Pl.z); return d < r && Math.abs((p.y || 0) - Pl.y) < dy ? d : -1; };
    const a = ST.ammo;
    if (a) {
      const d = near(a.pos, 2.1);
      if (d >= 0) {
        if (a.round === G().round) out.push({ tip: 'ammo', dist: d, text: 'Ammo restocked this round (back next round)', cost: null });
        else { const c = ammoPrice(); out.push({ tip: 'ammo', dist: d, text: 'Restock all your ammo (once per round)', cost: c, act: () => { if (!G().spend(c)) return; XH.weapons.refillAll(); a.round = G().round; A.play('magin'); A.play('grab'); XH.ui.banner('AMMO RESTOCKED', 'Every weapon you carry is full', '#ffd860'); } }); }
      }
    }
    for (const L of ST.ladders) {
      if (P().mantle || P().path) break;
      const db = near(L.base, 1.3, 0.6);
      if (db >= 0) out.push({ tip: 'ladder', dist: db, text: 'Climb the ladder', cost: 0, act: () => climb(L, true) });
      const dt = near(L.top, 1.4, 0.6);
      if (dt >= 0) out.push({ tip: 'ladder', dist: dt, text: 'Climb down the ladder', cost: 0, act: () => climb(L, false) });
    }
    for (const Z of ST.zips) { if (P().mantle || P().path) break; const d = near(Z.start, 1.8, 0.7); if (d >= 0) out.push({ tip: 'zipline', dist: d, text: 'Ride the zipline', cost: 0, act: () => { P().startPath([P().pos.clone(), Z.from, Z.to], 12); if (XH.achievements) XH.achievements.flag('zip'); A.play('saw', { vol: 0.5 }); if (XH.ui.tip) XH.ui.tip('zipline'); } }); }
    const T = ST.teleporters;
    if (T) for (const p of T.pads) { const d = near(p.pos, 1.4, 0.8); if (d >= 0 && !padActive(T)) out.push({ tip: 'teleporter', dist: d, text: padBlocked(T), cost: null }); }
    void Wd;
  };
  function climb(L, up) {
    const Pl = P(), w = L.wall, foot = new THREE.Vector3(w.x + w.dx * 0.62, 0, w.z + w.dz * 0.62); foot.y = XH.world.floorAt(foot.x, foot.z);
    const topEdge = new THREE.Vector3(w.x + w.dx * 0.45, L.h + 0.05, w.z + w.dz * 0.45);
    const pts = up ? [Pl.pos.clone(), foot, foot.clone().setY(L.h - 1.2), topEdge, L.top.clone()] : [Pl.pos.clone(), topEdge, foot.clone().setY(L.h - 1.2), foot];
    Pl.startPath(pts, 2.6);
    A.play('step', { vol: 1.2 });
  }
  const padActive = (T) => { const Wd = XH.world; if (Wd.def.power && !Wd.power) return false; return T.pads.every((p) => Wd.reach[Wd.cellZ(p.pos.z) * Wd.w + Wd.cellX(p.pos.x)]); };
  const padBlocked = (T) => { const Wd = XH.world; return Wd.def.power && !Wd.power ? 'Teleporter offline: needs power' : 'Teleporter offline: open the way to the other pad first'; };
  ST.update = (dt, t) => {
    const Pl = P();
    for (const J of ST.pads) {
      J.cd = Math.max(0, J.cd - dt);
      J.chev.forEach((m, k) => { m.material.color.setHex(Math.sin(t * 6 - k * 1.2) > 0.3 ? 0xffe060 : 0x805010); });
      if (J.cd > 0 || Pl.path || Pl.mantle || Pl.downed) continue;
      if (Math.hypot(Pl.pos.x - J.pos.x, Pl.pos.z - J.pos.z) < 0.95 && Pl.pos.y < 0.5) {
        // an arc up and over onto the roof or deck
        const a = J.pos.clone().setY(0.2), b = J.land, m = a.clone().add(b).multiplyScalar(0.5); m.y = J.top + 3.2;
        const pts = []; for (let k = 0; k <= 14; k++) { const u = k / 14; pts.push(new THREE.Vector3((1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * m.x + u * u * b.x, (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * m.y + u * u * b.y, (1 - u) * (1 - u) * a.z + 2 * (1 - u) * u * m.z + u * u * b.z)); }
        Pl.startPath(pts, 14); J.cd = 1.2; if (XH.achievements) XH.achievements.flag('pad');
        A.play('launcher', { vol: 0.8 }); FX.ring(J.pos.clone().setY(0.2), 2.4, 0xffa020, 0.4); FX.burst({ pos: J.pos.clone().setY(0.3), n: 20, color: 0xffd060, speed: [2, 6], up: 3, life: [0.3, 0.6], size: [0.2, 0.05] });
        if (XH.ui.tip) XH.ui.tip('jumppad');
      }
    }
    const T = ST.teleporters;
    if (T) {
      const on = padActive(T), Pl = P();
      T.cd = Math.max(0, T.cd - dt);
      for (const p of T.pads) {
        p.rings[0].rotation.z += dt * (on ? 2.5 : 0.3); p.rings[1].rotation.z -= dt * (on ? 1.8 : 0.2);
        p.rings.forEach((r, k) => { r.position.y = 0.6 + k * 0.9 + Math.sin(t * 2 + k) * 0.15; r.material.color.setHex(on ? p.color : 0x303438); });
        p.beam.visible = on && T.cd <= 0; p.disc.material.opacity = on ? 0.45 + Math.sin(t * 3) * 0.15 : 0.12; p.glow.material.opacity = on ? 0.6 : 0.08;
        if (!on || T.cd > 0 || Pl.downed || Pl.path || Pl.mantle) { p.charge = 0; continue; }
        const d = Math.hypot(Pl.pos.x - p.pos.x, Pl.pos.z - p.pos.z);
        if (d < 1.0 && Pl.pos.y < 0.6) {
          p.charge += dt;
          if (Math.random() < 0.5) FX.one(p.pos.x + U.rand(-0.8, 0.8), 0.2, p.pos.z + U.rand(-0.8, 0.8), 0, 3, 0, 0.5, 0.15, 0.03, p.color);
          if (p.charge > 0.45) {
            const o = p.other, fwd = new THREE.Vector3(-Math.sin(Pl.yaw), 0, -Math.cos(Pl.yaw));
            FX.flash(p.pos.clone().setY(1), p.color, 5, 0.3, 12); FX.ring(p.pos.clone().setY(0.2), 4, p.color, 0.5);
            Pl.pos.set(o.pos.x + fwd.x * 1.6, 0.2, o.pos.z + fwd.z * 1.6); Pl.vel.set(0, 0, 0);
            if (XH.world.solidAt(Pl.pos.x, Pl.pos.z, 0.4, 0.2)) Pl.pos.set(o.pos.x, 0.2, o.pos.z);
            FX.flash(o.pos.clone().setY(1), o.color, 5, 0.3, 12); FX.ring(o.pos.clone().setY(0.2), 4, o.color, 0.5); FX.shake(0.2);
            A.play('lure', { vol: 0.9 }); A.play('powerup', { vol: 0.6 });
            T.cd = 3; p.charge = 0; o.charge = 0;
            if (XH.ui.tip) XH.ui.tip('teleporter');
          }
        } else p.charge = 0;
      }
    }
  };
})();
