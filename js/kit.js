'use strict';
// The builder's kit: solid, walkable pieces for the map editor (fortifications, walls and buildings, stairs, decks and
// bridges, industrial plant, explosive barrels, rocks, trees and alien growths). Each is a set-dressing prop
// (js/setdress.js): an entity { k, x, z, y, ry, o, s } built from parts, with real colliders you can stand on, take
// cover behind and shoot over. Pieces face +z and are centred on their position. y lifts a whole piece (a deck on a deck).
(function () {
  const SD = XH.setdress, L = SD.lib, M = L.M, part = L.part, sub = L.sub, vary = L.vary;
  let G = null;
  const R = () => SD.random();
  const CON = 0x8c8a84, CON2 = 0x6e6c66, SAND = 0x9a8a62, OLIVE = 0x4c5438, STEEL = 0x5a6068, DARK = 0x2a2e33, WOOD = 0x6a4a30, YEL = 0xd8a020, RUST = 0x7a4a2a;
  const geo = {};
  const GEO = (k, f) => geo[k] || (geo[k] = f());
  const pyr = () => GEO('pyr', () => new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4));
  const rock = () => GEO('rock', () => new THREE.DodecahedronGeometry(1, 0));
  const ico = () => GEO('ico', () => new THREE.IcosahedronGeometry(1, 0));
  const dome = () => GEO('dome', () => new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2));
  const cone = () => GEO('cone12', () => new THREE.ConeGeometry(1, 1, 12));
  const hex = () => GEO('hex', () => new THREE.CylinderGeometry(1, 1, 1, 6));
  const ring = () => GEO('ring', () => new THREE.RingGeometry(0.8, 1, 32));
  const circle = () => GEO('circle', () => new THREE.CircleGeometry(1, 24));
  // a plane whose texture repeats every `every` metres (chain-link, grating)
  const tiled = (w, h, every) => { const g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / every, uv.getY(i) * h / every); return g; };
  const mats = {};
  function texMat(k, draw, o = {}) {
    return mats[k] || (mats[k] = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d'));
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      return new THREE.MeshStandardMaterial(Object.assign({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }, o));
    })());
  }
  const chainMat = () => texMat('chain', (x) => { x.strokeStyle = '#b4b8bc'; x.lineWidth = 3; for (let k = -64; k < 128; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.stroke(); x.beginPath(); x.moveTo(k + 64, 0); x.lineTo(k, 64); x.stroke(); } });
  const grateMat = () => texMat('grate', (x) => { x.fillStyle = '#50565c'; for (let k = 0; k < 64; k += 8) { x.fillRect(k, 0, 3, 64); x.fillRect(0, k, 64, 3); } }, { alphaTest: 0.5, metalness: 0.8 });
  const netMat = () => texMat('net', (x) => { x.fillStyle = '#3e4a2c'; for (let k = 0; k < 90; k++) { x.beginPath(); x.ellipse(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 5, 2 + Math.random() * 3, Math.random() * 3, 0, 6.3); x.fill(); } x.strokeStyle = '#2a3020'; x.lineWidth = 1; for (let k = 0; k < 64; k += 6) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 64); x.stroke(); x.beginPath(); x.moveTo(0, k); x.lineTo(64, k); x.stroke(); } }, { metalness: 0, roughness: 1, alphaTest: 0.3 });
  const fieldMat = (color) => mats['field' + color] || (mats['field' + color] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));

  // a collider from the piece's own height (y) up: w across, d deep, top h, from y0
  const sol = (a, ox, oz, w, d, h, o = {}) => L.solid(a, ox, oz, w, d, h + (a.y || 0), Object.assign({}, o, { y0: (o.y0 || 0) + (a.y || 0) }));
  const cyl = (a, ox, oz, r, h, o = {}) => { if (SD.editor) return null; const [x, z] = L.wpos(a, ox, oz); return SD.W().addCyl(x, z, r, h + (a.y || 0), Object.assign({}, o, { y0: (o.y0 || 0) + (a.y || 0) })); };
  const box = (a, m, x, y, z, sx, sy, sz, c, r) => part(a, m, G.box, [x, y, z], [sx, sy, sz], c, r);
  // the local rectangle as a world box (for zones the piece brings with it)
  function worldRect(a, ox, oz, w, d) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [x, z] = L.wpos(a, ox + sx * w / 2, oz + sz * d / 2); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
  }
  const area = (a, zt, ox, oz, w, d, o) => { if (SD.editor || !XH.hazards) return; const r = worldRect(a, ox, oz, w, d); XH.hazards.area(zt, r.x, r.z, r.w, r.d, o); };

  // steps climbing along +z of anchor s, from z 0 to len, height y0 to y1 (each step no more than 0.45)
  function steps(s, len, w, y0, y1, c, open) {
    const n = Math.max(1, Math.ceil((y1 - y0) / 0.45 - 1e-6)), run = len / n, rise = (y1 - y0) / n;
    for (let k = 1; k <= n; k++) {
      const top = y0 + k * rise, zs = (k - 1) * run;
      if (open) box(s, M.metal, 0, top - 0.03, zs + run / 2, w, 0.06, run * 0.95, c);
      else box(s, M.stone, 0, (y0 + top) / 2, zs + run / 2, w, top - y0, run, vary(c, 0.05));
      sol(s, 0, (zs + len) / 2, w, len - zs, top, { y0: Math.max(0, y0 - 0.3), noClimb: true });
    }
    if (open) for (const sx of [-1, 1]) { const ang = Math.atan2(y1 - y0, len), hl = Math.hypot(len, y1 - y0); box(s, M.metal, sx * (w / 2 + 0.04), (y0 + y1) / 2 - 0.1, len / 2, 0.06, 0.22, hl, DARK, [-ang, 0]); }
  }
  // a climbable ladder on the face at local (lx, lz), facing out along (fx, fz), up to local height top; onto: where you step off
  function ladder(a, lx, lz, fx, fz, top, onto) {
    const s = sub(a, lx + fx * 0.2, lz + fz * 0.2, Math.atan2(fx, fz));
    for (const sx of [-0.3, 0.3]) box(s, M.metal, sx, (top + 0.9) / 2, 0, 0.06, top + 0.9, 0.06, 0x9aa2aa);
    for (let y = 0.3; y < top + 0.2; y += 0.34) part(s, M.metal, G.cyl, [0, y, 0], [0.025, 0.6, 0.025], 0x9aa2aa, [0, Math.PI / 2]);
    box(s, M.glow, 0, top + 0.85, 0, 0.66, 0.05, 0.05, 0xffc030);
    if (SD.editor || !XH.structures || !XH.structures.ladders) return;
    const Wd = SD.W(), [wx, wz] = L.wpos(a, lx, lz), [ox, oz] = L.wpos(a, lx + fx, lz + fz), dx = ox - wx, dz = oz - wz, [tx, tz] = L.wpos(a, onto[0], onto[1]);
    const by = Wd.dispAt(a.x, a.z) + (a.y || 0);
    XH.structures.ladders.push({ kind: 'ladder', base: new THREE.Vector3(wx + dx * 1.35, Wd.floorAt(wx + dx * 1.35, wz + dz * 1.35), wz + dz * 1.35), top: new THREE.Vector3(tx, top + by, tz), wall: { x: wx, z: wz, dx, dz }, h: top + by });
  }
  // railings around a deck: sides that are true get a rail; gap: [side, from, to] leaves an opening
  function rails(a, w, d, y, sides, c = YEL, gap) {
    const run = (side, x0, x1) => {
      const len = x1 - x0; if (len < 0.2) return;
      const mid = (x0 + x1) / 2, [px, pz, rw, rd] = side === 'f' ? [mid, d / 2, len, 0.06] : side === 'b' ? [mid, -d / 2, len, 0.06] : side === 'l' ? [-w / 2, mid, 0.06, len] : [w / 2, mid, 0.06, len];
      box(a, M.paint, px, y + 1.02, pz, rw, 0.06, rd, c); box(a, M.paint, px, y + 0.55, pz, rw * 0.99, 0.04, rd * 0.99, c);
      const n = Math.max(1, Math.round(len / 1.2));
      for (let k = 0; k <= n; k++) { const t = x0 + len * k / n; box(a, M.paint, side === 'f' || side === 'b' ? t : px, y + 0.52, side === 'f' || side === 'b' ? pz : t, 0.05, 1.04, 0.05, c); }
      sol(a, px, pz, Math.max(rw, 0.12), Math.max(rd, 0.12), y + 1.05, { y0: y, bullets: false, mount: false });
    };
    for (const side of ['f', 'b', 'l', 'r']) {
      if (!sides.includes(side)) continue;
      const half = side === 'f' || side === 'b' ? w / 2 : d / 2;
      if (gap && gap[0] === side) { run(side, -half, gap[1]); run(side, gap[2], half); } else run(side, -half, half);
    }
  }
  // explosive things: shoot them (or blow something up next to them) and they go off
  function boomer(a, props, o) {
    if (SD.editor || !XH.hazards) return;
    const g = SD.root(); if (!g.userData.solo) return;
    const Wd = SD.W();
    XH.hazards.addBarrel(Object.assign({ x: a.x, z: a.z, y: Wd.floorAt(a.x, a.z) + (a.y || 0), group: g, props }, o));
  }
  // register: name, label, category, defaults, builder (a, o with defaults filled in)
  const K = (name, label, cat, def, fn, extra = {}) => SD.kit(name, (a, o0, e) => { G = SD.G(); const o = Object.assign({}, def, o0); return fn(a, o, e); }, Object.assign({ cat, label, def, opts: Object.keys(def) }, extra));

  // =============================================================== fortifications
  const FORT = 'Fortifications';
  K('jersey', 'Jersey barrier', FORT, { len: 3, color: CON, stripes: false }, (a, o) => {
    const c = vary(o.color, 0.06);
    box(a, M.stone, 0, 0.12, 0, o.len, 0.24, 0.62, c); box(a, M.stone, 0, 0.36, 0, o.len, 0.26, 0.44, c, [0, 0]); box(a, M.stone, 0, 0.66, 0, o.len, 0.36, 0.24, c);
    for (const sx of [-1, 1]) box(a, M.stone, sx * (o.len / 2 - 0.02), 0.4, 0, 0.04, 0.8, 0.5, col(c, 0.85));
    if (o.stripes) for (let k = 0; k < Math.round(o.len / 0.5); k++) box(a, M.paint, -o.len / 2 + (k + 0.5) * 0.5, 0.66, 0.125, 0.25, 0.3, 0.01, k % 2 ? 0xe8e8e0 : 0xc02020);
    sol(a, 0, 0, o.len, 0.6, 0.85);
  });
  const col = (c, k) => new THREE.Color(c).multiplyScalar(k);
  K('twall', 'T-wall (tall concrete barrier)', FORT, { n: 1, h: 3.6, color: CON }, (a, o) => {
    const n = Math.max(1, Math.round(o.n)), W0 = 1.52 * n;
    for (let k = 0; k < n; k++) {
      const x = -W0 / 2 + 0.76 + k * 1.52, c = vary(o.color, 0.07);
      box(a, M.stone, x, o.h / 2, 0, 1.5, o.h, 0.3, c); box(a, M.stone, x, 0.28, 0, 1.5, 0.56, 1.3, c);
      box(a, M.stone, x, 0.62, 0, 1.5, 0.14, 0.5, c);
      for (const sx of [-0.4, 0.4]) part(a, M.metal, G.torus, [x + sx, o.h + 0.06, 0], [0.08, 0.08, 0.08], 0x4a4a4a);
      if (R() < 0.5) box(a, M.paint, x, o.h * 0.6, 0.156, 0.5, 0.3, 0.01, R() < 0.5 ? 0xd8c040 : 0xe8e8e0);
    }
    sol(a, 0, 0, W0, 0.34, o.h, { noClimb: o.h > 3 }); sol(a, 0, 0, W0, 1.3, 0.56);
  });
  K('concreteWall', 'Concrete wall', FORT, { len: 5, h: 3, thick: 0.3, color: CON }, (a, o) => {
    const c = vary(o.color, 0.05);
    box(a, M.stone, 0, o.h / 2, 0, o.len, o.h, o.thick, c); box(a, M.stone, 0, o.h + 0.05, 0, o.len + 0.04, 0.1, o.thick + 0.08, col(c, 0.9));
    for (let x = -o.len / 2 + 0.6; x < o.len / 2; x += 1.2) for (let y = 0.5; y < o.h; y += 1) for (const s of [-1, 1]) part(a, M.metal, G.cyl, [x, y, s * (o.thick / 2 + 0.003)], [0.03, 0.01, 0.03], 0x3a3a38, [Math.PI / 2, 0]);
    sol(a, 0, 0, o.len, o.thick, o.h, { noClimb: o.h > 3 });
  });
  K('concreteBlocks', 'Concrete blocks', FORT, { stack: 2, n: 2, color: CON }, (a, o) => {
    const n = Math.max(1, Math.round(o.n)), st = Math.max(1, Math.round(o.stack));
    for (let j = 0; j < st; j++) for (let k = 0; k < n; k++) { const off = j % 2 ? 0.4 : 0; if (j % 2 && k === n - 1) continue; box(a, M.stone, -n * 0.8 + 0.8 + k * 1.6 + off, 0.4 + j * 0.8, 0, 1.58, 0.78, 0.8, vary(o.color, 0.08)); }
    sol(a, 0, 0, n * 1.6, 0.8, st * 0.8);
  });
  K('dragonTeeth', "Dragon's teeth", FORT, { n: 4, color: CON }, (a, o) => {
    const n = Math.max(1, Math.round(o.n));
    for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * 1.6, z = (k % 2) * 0.8 - 0.4; part(a, M.stone, pyr(), [x, 0.6, z], [0.85, 1.2, 0.85], vary(o.color, 0.08)); box(a, M.stone, x, 0.08, z, 1.3, 0.16, 1.3, vary(o.color, 0.08)); sol(a, x, z, 1.1, 1.1, 1.0); }
  });
  K('pillbox', 'Pillbox bunker', FORT, { color: CON, ladder: true }, (a, o) => {
    const c = vary(o.color, 0.05), S = 5, T = 0.45, H = 2.2, dark = 0x1a1a18;
    // walls with firing slits on three sides, a door at the back
    for (const ry of [0, Math.PI / 2, -Math.PI / 2]) {
      const s = sub(a, Math.sin(ry) * (S / 2 - T / 2), Math.cos(ry) * (S / 2 - T / 2), ry);
      box(s, M.stone, 0, 0.6, 0, S, 1.2, T, c); box(s, M.stone, 0, 1.9, 0, S, 0.6, T, c);
      for (const e of [-1.9, 1.9]) { box(s, M.stone, e, 1.4, 0, 1.2, 0.4, T, c); sol(s, e, 0, 1.2, T, H); }
      box(s, M.paint, 0, 1.4, 0, 2.6, 0.4, T * 0.5, dark);
      sol(s, 0, 0, S, T, 1.2); sol(s, 0, 0, S, T, H, { y0: 1.6, mount: false });
    }
    for (const sx of [-1, 1]) { box(a, M.stone, sx * 1.55, H / 2, -S / 2 + T / 2, 1.9, H, T, c); sol(a, sx * 1.55, -S / 2 + T / 2, 1.9, T, H); }
    box(a, M.stone, 0, 2.05, -S / 2 + T / 2, 1.2, 0.3, T, c);
    box(a, M.stone, 0, H + 0.18, 0, S + 0.3, 0.36, S + 0.3, col(c, 0.92)); sol(a, 0, 0, S + 0.3, S + 0.3, H + 0.36, { y0: H - 0.05 });
    box(a, M.paint, 0, 0.02, 0, S - 2 * T, 0.04, S - 2 * T, 0x3a3a36);
    part(a, M.metal, G.box, [1.4, 0.45, 1.6], [1.2, 0.9, 0.5], OLIVE); part(a, M.paint, G.box, [-1.4, 0.35, -1], [0.8, 0.7, 0.5], 0x5a4a30);
    L.glowAt(sub(a, 0, 0), 2.0, 0xffc070, 1.2, 0.35);
    if (o.ladder) ladder(a, 1.6, -S / 2, 0, -1, H + 0.36, [1.6, -1.6]);
  });
  K('bunker', 'Command bunker', FORT, { color: CON }, (a, o) => {
    const c = vary(o.color, 0.05), Wb = 8, Db = 6, T = 0.5, H = 2.6, top = H + 0.4, dark = 0x141412;
    // front wall with a long slit
    box(a, M.stone, 0, 0.65, Db / 2 - T / 2, Wb, 1.3, T, c); box(a, M.stone, 0, 2.15, Db / 2 - T / 2, Wb, 0.9, T, c);
    for (const sx of [-1, 1]) box(a, M.stone, sx * 3.25, 1.5, Db / 2 - T / 2, 1.5, 0.4, T, c);
    box(a, M.paint, 0, 1.5, Db / 2 - T / 2, 5, 0.4, T * 0.4, dark);
    sol(a, 0, Db / 2 - T / 2, Wb, T, 1.3); sol(a, 0, Db / 2 - T / 2, Wb, T, H, { y0: 1.7, mount: false }); for (const sx of [-1, 1]) sol(a, sx * 3.25, Db / 2 - T / 2, 1.5, T, H);
    // sides and the back with a door
    for (const sx of [-1, 1]) { box(a, M.stone, sx * (Wb / 2 - T / 2), H / 2, 0, T, H, Db, c); sol(a, sx * (Wb / 2 - T / 2), 0, T, Db, H); }
    for (const sx of [-1, 1]) { box(a, M.stone, sx * 2.4, H / 2, -Db / 2 + T / 2, 3.2, H, T, c); sol(a, sx * 2.4, -Db / 2 + T / 2, 3.2, T, H); }
    box(a, M.stone, 0, 2.4, -Db / 2 + T / 2, 1.6, 0.4, T, c); box(a, M.metal, 0, 2.3, -Db / 2 - 0.02, 1.8, 0.1, 0.1, YEL);
    // the roof, with sandbags round its edge and steps up the side
    box(a, M.stone, 0, H + 0.2, 0, Wb + 0.4, 0.4, Db + 0.4, col(c, 0.92)); sol(a, 0, 0, Wb + 0.4, Db + 0.4, top, { y0: H - 0.05 });
    const bag = (x, z, w, d) => { for (let j = 0; j < 2; j++) for (let t = -1; t <= 1; t += 2 / Math.max(1, Math.round(Math.max(w, d) / 0.6))) box(a, M.cloth, x + (w > d ? t * (w / 2 - 0.3) : 0), top + 0.15 + j * 0.28, z + (w > d ? 0 : t * (d / 2 - 0.3)), w > d ? 0.62 : 0.5, 0.28, w > d ? 0.5 : 0.62, vary(SAND, 0.1)); sol(a, x, z, w, d, top + 0.6, { y0: top, bullets: true, mount: false }); };
    bag(0, Db / 2 - 0.1, Wb, 0.5); bag(-Wb / 2 + 0.1, 0, 0.5, Db - 0.6); bag(0, -Db / 2 + 0.1, Wb, 0.5); bag(Wb / 2 - 0.1, -1, 0.5, 3.6);
    steps(sub(a, Wb / 2 + 0.75, -Db / 2 - 0.2), 4.6, 1.3, 0, top, CON2);
    box(a, M.paint, 0, 0.02, 0, Wb - 2 * T, 0.04, Db - 2 * T, 0x34342f);
    box(a, M.paint, -2.2, 0.8, 1.2, 1.8, 0.06, 1.0, 0x4a5a4a); box(a, M.paint, -2.2, 0.4, 1.2, 1.6, 0.8, 0.8, 0x3a4030); box(a, M.paint, 2.5, 0.5, -1.5, 1.2, 1.0, 1.2, OLIVE); box(a, M.glow, -2.2, 0.84, 1.2, 1.2, 0.01, 0.7, 0x88c8a0);
    L.glowAt(sub(a, 0, 0), 2.3, 0xffc070, 1.6, 0.4);
  });
  const sandbagRun = (a, x, z, len, rows, alongX) => {
    for (let j = 0; j < rows; j++) { const n = Math.max(1, Math.round(len / 0.6)); for (let k = 0; k < n; k++) { const t = -len / 2 + (k + 0.5 + (j % 2) * 0.5) * len / n; if (t > len / 2) continue; box(a, M.cloth, x + (alongX ? t : 0), 0.14 + j * 0.27, z + (alongX ? 0 : t), alongX ? len / n * 1.02 : 0.5, 0.26, alongX ? 0.5 : len / n * 1.02, vary(SAND, 0.12), [0, 0, (R() - 0.5) * 0.1]); } }
    sol(a, x, z, alongX ? len : 0.62, alongX ? 0.62 : len, rows * 0.27, { bullets: rows > 3, mount: true });
  };
  K('sandbags', 'Sandbag wall', FORT, { len: 3, rows: 4 }, (a, o) => sandbagRun(a, 0, 0, o.len, Math.max(1, Math.round(o.rows)), true));
  K('sandbagCorner', 'Sandbag corner', FORT, { len: 3, rows: 4 }, (a, o) => { const r = Math.max(1, Math.round(o.rows)); sandbagRun(a, 0, o.len / 2, o.len, r, true); sandbagRun(a, -o.len / 2 + 0.25, 0, o.len - 0.5, r, false); });
  K('mgNest', 'Sandbag gun nest', FORT, { gun: true }, (a, o) => {
    sandbagRun(a, 0, 1.4, 3.2, 4, true); sandbagRun(a, -1.6, 0.2, 2.2, 4, false); sandbagRun(a, 1.6, 0.2, 2.2, 4, false);
    if (o.gun) { part(a, M.metal, G.cyl, [0, 0.55, 1.0], [0.05, 1.1, 0.05], DARK); box(a, M.metal, 0, 1.18, 1.1, 0.16, 0.18, 0.7, DARK); part(a, M.metal, G.cyl, [0, 1.2, 1.7], [0.04, 0.8, 0.04], 0x202020, [Math.PI / 2, 0]); box(a, M.metal, 0.14, 1.12, 1.05, 0.16, 0.2, 0.3, OLIVE); }
    box(a, M.paint, 0.9, 0.2, -0.3, 0.6, 0.4, 0.35, OLIVE); box(a, M.paint, 0.9, 0.42, -0.3, 0.6, 0.04, 0.35, 0x3a4028);
  });
  K('foxhole', 'Foxhole ring', FORT, {}, (a) => {
    for (let k = 0; k < 10; k++) { if (k === 7) continue; const t = k / 10 * Math.PI * 2, x = Math.sin(t) * 1.3, z = Math.cos(t) * 1.3; for (let j = 0; j < 3; j++) box(a, M.cloth, x, 0.13 + j * 0.25, z, 0.8, 0.26, 0.5, vary(SAND, 0.12), [0, 0, t]); sol(a, x, z, 0.8, 0.8, 0.75, { bullets: false }); }
    part(a, M.decal, circle(), [0, 0.012, 0], [1.1, 1.1, 1], 0x2a2418, [-Math.PI / 2, 0]);
  });
  K('hesco', 'HESCO barrier', FORT, { n: 3, tall: false }, (a, o) => {
    const n = Math.max(1, Math.round(o.n)), h = o.tall ? 2.2 : 1.1;
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * 1.08;
      box(a, M.cloth, x, h / 2, 0, 1.04, h, 1.04, vary(0xa89a78, 0.08)); box(a, M.cloth, x, h - 0.02, 0, 0.98, 0.06, 0.98, vary(0x8a7650, 0.1));
      for (let y = 0.1; y < h; y += 0.25) for (const s of [-1, 1]) { box(a, M.metal, x, y, s * 0.525, 1.05, 0.02, 0.01, 0x9a9a90); box(a, M.metal, x + s * 0.525, y, 0, 0.01, 0.02, 1.05, 0x9a9a90); }
      for (const sx of [-0.52, 0, 0.52]) for (const s of [-1, 1]) box(a, M.metal, x + sx, h / 2, s * 0.525, 0.02, h, 0.012, 0x9a9a90);
    }
    sol(a, 0, 0, n * 1.08, 1.06, h, { noClimb: o.tall });
  });
  K('tankTrap', 'Tank trap (hedgehog)', FORT, {}, (a) => {
    const c = vary(RUST, 0.12);
    for (const [rx, rz, ry] of [[0.9, 0, 0], [0.9, 0, Math.PI * 2 / 3], [0.9, 0, -Math.PI * 2 / 3]]) box(a, M.metal, 0, 0.55, 0, 0.14, 1.8, 0.14, c, [rx, rz, ry]);
    box(a, M.metal, 0, 0.55, 0, 0.16, 0.16, 0.16, col(c, 0.8));
    sol(a, 0, 0, 1.3, 1.3, 1.1, { bullets: false });
  });
  K('wire', 'Barbed wire (tangles)', FORT, { len: 3, stakes: true }, (a, o) => {
    const n = Math.max(2, Math.round(o.len / 0.32));
    for (let k = 0; k < n; k++) part(a, M.metal, G.torus, [-o.len / 2 + (k + 0.5) * o.len / n, 0.42, (R() - 0.5) * 0.08], [0.42, 0.42, 0.42], 0x76766e, [0, (R() - 0.5) * 0.3, Math.PI / 2 + (R() - 0.5) * 0.4]);
    if (o.stakes) for (let x = -o.len / 2; x <= o.len / 2 + 0.01; x += Math.max(0.8, o.len / Math.max(1, Math.round(o.len / 1.5)))) box(a, M.metal, x, 0.5, 0, 0.04, 1.0, 0.04, 0x4a4a42, [0.1, 0]);
    area(a, 'wire', 0, 0, o.len, 1.0, {});
  });
  K('razorFence', 'Chain-link fence', FORT, { len: 3, h: 2.4, razor: true }, (a, o) => {
    part(a, chainMat(), tiled(o.len, o.h, 0.35), [0, o.h / 2, 0], [o.len, o.h, 1]);
    const n = Math.max(1, Math.round(o.len / 2.5));
    for (let k = 0; k <= n; k++) part(a, M.metal, G.cyl, [-o.len / 2 + k * o.len / n, (o.h + 0.2) / 2, 0], [0.04, o.h + 0.2, 0.04], 0x80868c);
    part(a, M.metal, G.cyl, [0, o.h, 0], [0.025, o.len, 0.025], 0x80868c, [0, Math.PI / 2]);
    if (o.razor) for (let k = 0; k < Math.round(o.len / 0.28); k++) part(a, M.metal, G.torus, [-o.len / 2 + (k + 0.5) * 0.28, o.h + 0.28, 0], [0.26, 0.26, 0.26], 0x9a9a92, [0, 0, Math.PI / 2 + (R() - 0.5) * 0.3]);
    sol(a, 0, 0, o.len, 0.14, o.h + (o.razor ? 0.5 : 0), { bullets: false, mount: false, noClimb: true });
  });
  K('guardTower', 'Guard tower', FORT, { h: 4.5, color: WOOD }, (a, o) => {
    const h = o.h, c = vary(o.color, 0.08);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { box(a, M.paint, sx * 1.35, h / 2, sz * 1.35, 0.22, h, 0.22, c, [sz * 0.03, -sx * 0.03]); sol(a, sx * 1.35, sz * 1.35, 0.3, 0.3, h - 0.2, { mount: false }); }
    for (const y of [h * 0.35, h * 0.7]) for (const [px, pz, w, d] of [[0, -1.35, 2.7, 0.1], [0, 1.35, 2.7, 0.1], [-1.35, 0, 0.1, 2.7], [1.35, 0, 0.1, 2.7]]) box(a, M.paint, px, y, pz, w, 0.12, d, col(c, 0.85));
    for (const [px, pz, ry] of [[0, -1.35, 0], [-1.35, 0, Math.PI / 2], [1.35, 0, Math.PI / 2]]) box(a, M.paint, px, h * 0.52, pz, 3.6, 0.1, 0.08, col(c, 0.8), [0, 0.68, ry]);
    box(a, M.paint, 0, h - 0.1, 0, 3.4, 0.2, 3.4, col(c, 0.9)); sol(a, 0, 0, 3.4, 3.4, h, { y0: h - 0.25 });
    // armour on three sides and half the front, the ladder in the gap
    for (const [px, pz, w, d] of [[0, -1.65, 3.4, 0.1], [-1.65, 0, 0.1, 3.4], [1.65, 0, 0.1, 3.4], [-1.1, 1.65, 1.2, 0.1], [1.1, 1.65, 1.2, 0.1]]) { box(a, M.paint, px, h + 0.55, pz, w, 1.1, d, col(c, 0.95)); sol(a, px, pz, Math.max(w, 0.14), Math.max(d, 0.14), h + 1.1, { y0: h, mount: false }); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(a, M.paint, sx * 1.6, h + 1.3, sz * 1.6, 0.12, 2.6, 0.12, c);
    part(a, M.paint, pyr(), [0, h + 3.0, 0], [2.7, 0.9, 2.7], 0x3a3530); sol(a, 0, 0, 3.6, 3.6, h + 3.3, { y0: h + 2.55, mount: false });
    box(a, M.metal, 1.4, h + 1.35, 1.4, 0.4, 0.3, 0.45, DARK); part(a, M.glow, G.cyl, [1.4, h + 1.35, 1.64], [0.15, 0.02, 0.15], 0xfff2c0, [Math.PI / 2, 0]); L.glowAt(sub(a, 1.4, 1.75), h + 1.35, 0xfff0c0, 2.2, 0.5);
    ladder(a, 0, 1.7, 0, 1, h, [0, 0.9]);
  });
  K('sniperDeck', 'Sniper platform', FORT, { h: 2.5, color: STEEL }, (a, o) => {
    const h = o.h, c = vary(o.color, 0.06);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { box(a, M.metal, sx * 1.15, h / 2, sz * 1.15, 0.14, h, 0.14, c); sol(a, sx * 1.15, sz * 1.15, 0.2, 0.2, h - 0.2, { mount: false }); }
    part(a, grateMat(), tiled(2.6, 2.6, 0.5), [0, h, 0], [2.6, 2.6, 1], undefined, [-Math.PI / 2, 0]); box(a, M.metal, 0, h - 0.06, 0, 2.6, 0.1, 2.6, DARK); sol(a, 0, 0, 2.6, 2.6, h, { y0: h - 0.2 });
    for (const x of [-0.9, 0, 0.9]) box(a, M.cloth, x, h + 0.2, -1.1, 0.8, 0.36, 0.45, vary(SAND, 0.1)); sol(a, 0, -1.1, 2.6, 0.5, h + 0.4, { y0: h, mount: false });
    rails(a, 2.6, 2.6, h, 'lr', YEL);
    steps(sub(a, 0, 1.3), h * 1.15, 1.2, 0, h, c, true);
    for (const sx of [-0.62, 0.62]) { const s = sub(a, sx, 1.3); box(s, M.paint, 0, 0.5 + h / 2, h * 0.575, 0.05, 0.05, Math.hypot(h * 1.15, h), YEL, [-Math.atan2(h, h * 1.15), 0]); }
  });
  K('checkpoint', 'Checkpoint', FORT, { open: false }, (a, o) => {
    box(a, M.paint, -3, 1.3, 0, 2, 2.6, 2, 0xd8d4c8); box(a, M.glass, -3, 1.6, 0, 2.02, 0.9, 2.02, 0x9ad0e8); box(a, M.paint, -3, 2.7, 0, 2.3, 0.2, 2.3, 0x3a3a3a);
    box(a, M.paint, -3, 0.02, 0, 2.4, 0.04, 2.4, 0x3a3a36); sol(a, -3, 0, 2, 2, 2.8);
    box(a, M.paint, -1.7, 0.55, 0, 0.35, 1.1, 0.35, 0xd8d4c8); const up = !!o.open;
    for (let k = 0; k < 8; k++) box(a, M.paint, up ? -1.7 : -1.2 + k * 0.5, up ? 1.4 + k * 0.5 : 1.0, 0, up ? 0.09 : 0.5, up ? 0.5 : 0.09, 0.09, k % 2 ? 0xe8e8e0 : 0xc02020);
    if (!up) sol(a, 1.5, 0, 4, 0.2, 1.1, { bullets: false, mount: false });
    for (const sx of [-1, 1]) box(a, M.stone, 2 * sx + 1, 0.4, 2.2 * sx, 3, 0.8, 0.6, CON);
    sol(a, 3, 2.2, 3, 0.6, 0.85); sol(a, -1, -2.2, 3, 0.6, 0.85);
    L.glowAt(sub(a, -3, 1.1), 2.4, 0xfff0c0, 1.2, 0.4);
  });
  K('trench', 'Trench line', FORT, { len: 6 }, (a, o) => {
    for (const s of [-1, 1]) {
      for (let x = -o.len / 2 + 0.3; x < o.len / 2; x += 0.6) box(a, M.paint, x, 0.65, s * 1.0, 0.56, 1.3, 0.06, vary(WOOD, 0.14));
      for (let x = -o.len / 2; x <= o.len / 2; x += 1.5) box(a, M.paint, x, 0.75, s * 1.05, 0.1, 1.5, 0.1, 0x4a3420);
      box(a, M.stone, 0, 0.75, s * 1.4, o.len, 1.5, 0.7, vary(0x4a3c2a, 0.06));
      for (let x = -o.len / 2 + 0.4; x < o.len / 2; x += 0.8) box(a, M.cloth, x, 1.6, s * 1.2, 0.62, 0.26, 0.45, vary(SAND, 0.12));
      sol(a, 0, s * 1.3, o.len, 0.8, 1.75);
    }
    for (let x = -o.len / 2 + 0.25; x < o.len / 2; x += 0.5) box(a, M.paint, x, 0.05, 0, 0.4, 0.06, 1.2, vary(0x5a4430, 0.1));
  });
  K('camoNet', 'Camouflage net', FORT, { w: 6, d: 5, h: 2.8 }, (a, o) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { part(a, M.paint, G.cyl, [sx * o.w / 2 * 0.9, o.h / 2, sz * o.d / 2 * 0.9], [0.05, o.h, 0.05], 0x4a4030); cyl(a, sx * o.w / 2 * 0.9, sz * o.d / 2 * 0.9, 0.1, o.h - 0.3, { mount: false }); }
    part(a, netMat(), tiled(o.w, o.d, 1.2), [0, o.h, 0], [o.w, o.d, 1], undefined, [-Math.PI / 2, 0]);
    for (const [sx, sz] of [[-1, 0], [1, 0]]) part(a, netMat(), tiled(o.d, 1.2, 1.2), [sx * o.w / 2, o.h - 0.55, sz], [o.d, 1.2, 1], undefined, [0, 0, Math.PI / 2]);
  });
  K('radioMast', 'Radio mast', FORT, { h: 12 }, (a, o) => {
    const h = o.h;
    for (const [sx, sz] of [[-1, -1], [1, -1], [0, 1]]) part(a, M.metal, G.cyl, [sx * 0.25, h / 2, sz * 0.25], [0.03, h, 0.03], k2(sx));
    for (let y = 0.5; y < h; y += 0.8) part(a, M.metal, G.torus, [0, y, 0], [0.3, 0.3, 0.3], 0xc8c8c0, [Math.PI / 2, 0]);
    for (const t of [0, 2.1, 4.2]) box(a, M.metal, Math.sin(t) * h * 0.25, h * 0.4, Math.cos(t) * h * 0.25, 0.015, h * 0.82, 0.015, 0x6a6a6a, [Math.cos(t) * 0.57, -Math.sin(t) * 0.57]);
    part(a, M.glow, G.sphere, [0, h + 0.1, 0], [0.12, 0.12, 0.12], 0xff2020); L.glowAt(sub(a, 0, 0), h + 0.1, 0xff3020, 1.5, 0.6);
    box(a, M.paint, 0.9, 0.6, 0.9, 1.2, 1.2, 0.9, OLIVE); sol(a, 0.9, 0.9, 1.2, 0.9, 1.2); cyl(a, 0, 0, 0.35, h, { mount: false });
    function k2(sx) { return sx ? 0xc02020 : 0xe8e8e0; }
  });
  K('ammoCrates', 'Ammo crates', FORT, { n: 4 }, (a, o) => {
    const n = Math.max(1, Math.round(o.n));
    for (let k = 0; k < n; k++) { const x = (k % 2) * 1.0 - 0.5, y = Math.floor(k / 2) % 2 * 0.5, z = Math.floor(k / 4) * 0.6; box(a, M.paint, x, 0.25 + y, z, 0.95, 0.48, 0.55, vary(OLIVE, 0.1)); box(a, M.paint, x, 0.25 + y, z + 0.28, 0.5, 0.12, 0.01, 0xe0d8a0); for (const s of [-0.35, 0.35]) box(a, M.metal, x + s, 0.25 + y, z, 0.06, 0.5, 0.57, 0x2a2e22); }
    sol(a, 0, Math.floor((n - 1) / 4) * 0.3, 2, 0.6 + Math.floor((n - 1) / 4) * 0.6, n > 2 ? 1.0 : 0.5);
  });
  K('barricade2', 'Junk barricade', FORT, { len: 3 }, (a, o) => {
    for (let k = 0; k < Math.round(o.len * 2.5); k++) { const x = (R() - 0.5) * o.len, t = R(); if (t < 0.4) box(a, M.paint, x, 0.3 + R() * 0.6, (R() - 0.5) * 0.4, 0.2 + R() * 1.4, 0.06, 0.25, vary(WOOD, 0.2), [(R() - 0.5), (R() - 0.5) * 1.2]); else if (t < 0.7) part(a, M.metal, G.torus, [x, 0.3, (R() - 0.5) * 0.4], [0.38, 0.38, 0.9], 0x1a1a1a, [Math.PI / 2 + (R() - 0.5) * 0.4, 0]); else box(a, M.metal, x, 0.4 + R() * 0.5, 0, 0.6 + R() * 0.4, 0.7, 0.05, vary(STEEL, 0.2), [(R() - 0.5) * 0.3, (R() - 0.5) * 0.5]); }
    box(a, M.paint, 0, 0.35, 0, o.len * 0.9, 0.7, 0.4, 0x5a4634);
    sol(a, 0, 0, o.len, 0.6, 1.1);
  });
  K('spotTower', 'Floodlight tower', FORT, { h: 6, color: 0xfff0d0 }, (a, o) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(a, M.metal, sx * 0.3, o.h / 2, sz * 0.3, 0.06, o.h, 0.06, 0x8a8e92);
    for (let y = 0.8; y < o.h; y += 1) for (const [px, pz, w, d] of [[0, -0.3, 0.6, 0.03], [0, 0.3, 0.6, 0.03], [-0.3, 0, 0.03, 0.6], [0.3, 0, 0.03, 0.6]]) box(a, M.metal, px, y, pz, w, 0.03, d, 0x8a8e92);
    box(a, M.metal, 0, o.h + 0.05, 0, 1.4, 0.1, 0.4, DARK);
    for (const x of [-0.5, 0, 0.5]) { box(a, M.metal, x, o.h + 0.35, 0.05, 0.4, 0.4, 0.25, DARK, [-0.4, 0]); part(a, M.glow, G.box, [x, o.h + 0.31, 0.18], [0.34, 0.34, 0.02], o.color, [-0.4, 0]); }
    L.glowAt(sub(a, 0, 0.4), o.h + 0.3, o.color, 3.2, 0.55);
    box(a, M.stone, 0, 0.1, 0, 1, 0.2, 1, CON2); sol(a, 0, 0, 0.8, 0.8, o.h, { mount: false });
  });

  // =============================================================== walls and buildings
  const BLD = 'Walls and buildings';
  function wallFace(a, style, len, h, t, c) {
    if (style === 'brick') {
      box(a, M.stone, 0, h / 2, 0, len, h, t, vary(c, 0.05));
      for (let y = 0.25; y < h; y += 0.25) for (const s of [-1, 1]) box(a, M.paint, 0, y, s * (t / 2 + 0.003), len, 0.02, 0.005, 0x5a4a40);
      for (let y = 0.125, j = 0; y < h; y += 0.25, j++) for (let x = -len / 2 + (j % 2 ? 0.2 : 0.4); x < len / 2; x += 0.4) for (const s of [-1, 1]) box(a, M.paint, x, y, s * (t / 2 + 0.003), 0.015, 0.23, 0.005, 0x5a4a40);
    } else if (style === 'metal') {
      box(a, M.metal, 0, h / 2, 0, len, h, t * 0.5, vary(c, 0.05));
      for (let x = -len / 2 + 0.15; x < len / 2; x += 0.3) for (const s of [-1, 1]) box(a, M.metal, x, h / 2, s * t * 0.3, 0.08, h, 0.05, vary(c, 0.04));
      box(a, M.metal, 0, h - 0.05, 0, len, 0.1, t * 0.8, DARK);
    } else if (style === 'wood') {
      for (let x = -len / 2 + 0.1; x < len / 2; x += 0.2) box(a, M.paint, x, h / 2, 0, 0.19, h, t * 0.6, vary(c, 0.14));
      for (const y of [0.4, h - 0.4]) for (const s of [-1, 1]) box(a, M.paint, 0, y, s * t * 0.4, len, 0.14, 0.04, col(c, 0.8));
    } else if (style === 'glass') {
      box(a, M.glass, 0, h / 2, 0, len, h, 0.04, 0x9ad0e8);
      for (let x = -len / 2; x <= len / 2 + 0.01; x += len / Math.max(1, Math.round(len / 1.25))) box(a, M.metal, x, h / 2, 0, 0.08, h, 0.12, DARK);
      for (const y of [0.04, h - 0.04]) box(a, M.metal, 0, y, 0, len, 0.08, 0.12, DARK);
    } else {
      box(a, M.stone, 0, h / 2, 0, len, h, t, vary(c, 0.05)); box(a, M.stone, 0, h + 0.04, 0, len + 0.02, 0.08, t + 0.06, col(c, 0.9));
    }
  }
  const WALLS = { wallConcrete: ['Wall: concrete', 'concrete', CON], wallBrick: ['Wall: brick', 'brick', 0x8a4a34], wallMetal: ['Wall: sheet metal', 'metal', 0x6a7078], wallWood: ['Wall: planks', 'wood', WOOD], wallGlass: ['Wall: glass (shoot through)', 'glass', 0x9ad0e8] };
  for (const [k, [label, style, c]] of Object.entries(WALLS)) K(k, label, BLD, { len: 5, h: 3, color: c }, (a, o) => {
    const t = style === 'glass' ? 0.12 : 0.3;
    wallFace(a, style, o.len, o.h, t, o.color);
    sol(a, 0, 0, o.len, t, o.h, { bullets: style !== 'glass', noClimb: o.h > 3 });
  });
  // a wall with an opening: the solid parts around it
  function holed(a, o, hx, hw, hy0, hy1, style) {
    const t = 0.3, left = -o.len / 2, right = o.len / 2, x0 = hx - hw / 2, x1 = hx + hw / 2;
    const seg = (sx0, sx1, y0, y1) => { if (sx1 - sx0 < 0.02 || y1 - y0 < 0.02) return; const s = sub(a, (sx0 + sx1) / 2, 0), s2 = Object.assign({}, s, { y: (a.y || 0) + y0 }); wallFace(s2, style, sx1 - sx0, y1 - y0, t, o.color); sol(a, (sx0 + sx1) / 2, 0, sx1 - sx0, t, y1, { y0, mount: y0 < 0.1 }); };
    seg(left, x0, 0, o.h); seg(x1, right, 0, o.h); seg(x0, x1, 0, hy0); seg(x0, x1, hy1, o.h);
    for (const [x, y, w, hh] of [[x0, (hy0 + hy1) / 2, 0.08, hy1 - hy0], [x1, (hy0 + hy1) / 2, 0.08, hy1 - hy0], [hx, hy1, hw + 0.16, 0.08]]) box(a, M.metal, x, y, 0, w, hh, t + 0.04, DARK);
    if (hy0 > 0.05) box(a, M.metal, hx, hy0, 0, hw + 0.16, 0.08, t + 0.1, DARK);
  }
  const STYLES = ['concrete', 'brick', 'metal', 'wood'];
  K('wallWindow', 'Wall with window', BLD, { len: 5, h: 3, color: CON, style: 'concrete', glass: false }, (a, o) => { holed(a, o, 0, 1.8, 1.0, 2.1, o.style); if (o.glass) { box(a, M.glass, 0, 1.55, 0, 1.8, 1.1, 0.03, 0x9ad0e8); sol(a, 0, 0, 1.8, 0.2, 2.1, { y0: 1.0, bullets: false, mount: false }); } }, { choices: { style: STYLES } });
  K('doorway', 'Wall with doorway', BLD, { len: 5, h: 3, color: CON, style: 'concrete', door: 'none' }, (a, o) => {
    holed(a, o, 0, 1.5, 0, 2.3, o.style);
    if (o.door === 'open') { box(a, M.paint, -0.75 + 0.04, 1.15, 0.72, 0.06, 2.25, 1.44, vary(0x5a5048, 0.1)); }
    else if (o.door === 'closed') { box(a, M.paint, 0, 1.15, 0, 1.44, 2.25, 0.06, vary(0x5a5048, 0.1)); sol(a, 0, 0, 1.5, 0.3, 2.3); }
  }, { choices: { style: STYLES, door: ['none', 'open', 'closed'] } });
  K('pillarSquare', 'Pillar (square)', BLD, { h: 4, w: 0.8, color: CON }, (a, o) => { box(a, M.stone, 0, o.h / 2, 0, o.w, o.h, o.w, vary(o.color, 0.05)); box(a, M.stone, 0, 0.1, 0, o.w + 0.16, 0.2, o.w + 0.16, col(o.color, 0.85)); box(a, M.stone, 0, o.h - 0.1, 0, o.w + 0.16, 0.2, o.w + 0.16, col(o.color, 0.85)); sol(a, 0, 0, o.w, o.w, o.h, { noClimb: true }); });
  K('pillarRound', 'Pillar (round)', BLD, { h: 4, r: 0.45, color: CON }, (a, o) => { part(a, M.stone, G.cyl, [0, o.h / 2, 0], [o.r, o.h, o.r], vary(o.color, 0.05)); part(a, M.stone, G.cyl, [0, 0.1, 0], [o.r + 0.1, 0.2, o.r + 0.1], col(o.color, 0.85)); cyl(a, 0, 0, o.r, o.h, { noClimb: true }); });
  K('arch', 'Archway', BLD, { w: 3, h: 3.4, color: CON }, (a, o) => {
    const c = vary(o.color, 0.05);
    for (const sx of [-1, 1]) { box(a, M.stone, sx * (o.w / 2 + 0.35), o.h / 2, 0, 0.7, o.h, 0.8, c); sol(a, sx * (o.w / 2 + 0.35), 0, 0.7, 0.8, o.h); }
    box(a, M.stone, 0, o.h + 0.3, 0, o.w + 1.4, 0.6, 0.8, col(c, 0.95)); sol(a, 0, 0, o.w + 1.4, 0.8, o.h + 0.6, { y0: o.h });
    for (let k = 0; k < 7; k++) { const t = k / 6 * Math.PI, r = o.w / 2; box(a, M.stone, -Math.cos(t) * r * 0.97, o.h - 0.55 + Math.sin(t) * 0.55, 0, 0.45, 0.25, 0.8, c, [0, 0, 0]); }
  });
  K('stairs', 'Stairs', BLD, { h: 2.5, w: 1.6, open: false, color: CON2 }, (a, o) => {
    const len = Math.max(1, o.h * 1.15); steps(sub(a, 0, -len / 2), len, o.w, 0, o.h, o.color, o.open);
    if (o.open) for (const sx of [-1, 1]) { const ang = Math.atan2(o.h, len); box(a, M.paint, sx * (o.w / 2 + 0.05), o.h / 2 + 0.95, 0, 0.05, 0.05, Math.hypot(len, o.h), YEL, [-ang, 0]); for (const t of [-0.45, 0, 0.45]) box(a, M.paint, sx * (o.w / 2 + 0.05), o.h * (0.5 + t) + 0.5, t * len, 0.04, 1.0, 0.04, YEL); }
  });
  K('rampMetal', 'Ramp', BLD, { h: 1.5, len: 5, w: 2.5, color: STEEL }, (a, o) => {
    const ang = Math.atan2(o.h, o.len), hl = Math.hypot(o.len, o.h), c = vary(o.color, 0.06);
    box(a, M.metal, 0, o.h / 2 - 0.05, 0, o.w, 0.1, hl, c, [-ang, 0]);
    for (let k = 1; k < hl / 0.4; k++) box(a, M.metal, 0, o.h / 2 - 0.05 + Math.sin(ang) * (k * 0.4 - hl / 2) + 0.06, Math.cos(ang) * (k * 0.4 - hl / 2), o.w * 0.9, 0.03, 0.04, DARK, [-ang, 0]);
    for (const sx of [-1, 1]) { box(a, M.metal, sx * o.w / 2, o.h / 2 - 0.2, 0, 0.08, 0.3, hl, DARK, [-ang, 0]); box(a, M.metal, sx * (o.w / 2 - 0.1), o.h / 2 - 0.02, o.len / 2 - 0.1, 0.12, o.h, 0.12, DARK); }
    const n = Math.max(2, Math.ceil(o.h / 0.24));
    for (let k = 1; k <= n; k++) { const z0 = -o.len / 2 + (k - 1) * o.len / n; sol(a, 0, (z0 + o.len / 2) / 2, o.w, o.len / 2 - z0, k * o.h / n, { noClimb: true, mount: true, bullets: k * o.h / n > 0.9 }); }
  });
  K('deck', 'Raised deck', BLD, { w: 5, d: 5, h: 2.5, rail: true, color: STEEL }, (a, o) => {
    const c = vary(o.color, 0.06), nx = Math.max(1, Math.round(o.w / 2.5)), nz = Math.max(1, Math.round(o.d / 2.5));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) { const x = -o.w / 2 + 0.12 + i * (o.w - 0.24) / nx, z = -o.d / 2 + 0.12 + j * (o.d - 0.24) / nz; box(a, M.metal, x, o.h / 2, z, 0.16, o.h, 0.16, c); if (i === 0 || i === nx || j === 0 || j === nz) sol(a, x, z, 0.2, 0.2, o.h - 0.25, { mount: false }); }
    box(a, M.metal, 0, o.h - 0.08, 0, o.w, 0.14, o.d, DARK); part(a, grateMat(), tiled(o.w, o.d, 0.5), [0, o.h + 0.001, 0], [o.w, o.d, 1], undefined, [-Math.PI / 2, 0]);
    sol(a, 0, 0, o.w, o.d, o.h, { y0: o.h - 0.25 });
    if (o.rail) rails(a, o.w, o.d, o.h, 'blr', YEL);
  });
  K('catwalk', 'Catwalk', BLD, { len: 10, h: 3, w: 1.4, color: STEEL }, (a, o) => {
    const c = vary(o.color, 0.06), n = Math.max(1, Math.round(o.len / 3.3));
    part(a, grateMat(), tiled(o.len, o.w, 0.5), [0, o.h + 0.001, 0], [o.len, o.w, 1], undefined, [-Math.PI / 2, 0]);
    for (const s of [-1, 1]) box(a, M.metal, 0, o.h - 0.1, s * o.w / 2, o.len, 0.2, 0.06, DARK);
    for (let k = 0; k <= n; k++) { const x = -o.len / 2 + 0.2 + k * (o.len - 0.4) / n; for (const s of [-1, 1]) box(a, M.metal, x, o.h / 2, s * (o.w / 2 - 0.05), 0.1, o.h, 0.1, c); box(a, M.metal, x, o.h - 0.25, 0, 0.1, 0.1, o.w, c); sol(a, x, 0, 0.2, o.w, o.h - 0.3, { mount: false, bullets: false }); }
    sol(a, 0, 0, o.len, o.w, o.h, { y0: o.h - 0.25 });
    rails(a, o.len, o.w, o.h, 'fb', YEL);
  });
  K('bridge', 'Bridge', BLD, { len: 10, w: 3, h: 2.5, color: CON }, (a, o) => {
    const c = vary(o.color, 0.05);
    box(a, M.stone, 0, o.h - 0.25, 0, o.len, 0.5, o.w, c); box(a, M.paint, 0, o.h + 0.005, 0, o.len, 0.01, o.w * 0.9, 0x3a3a38);
    for (let x = -o.len / 2 + 1; x < o.len / 2; x += 2) box(a, M.paint, x, o.h + 0.012, 0, 0.8, 0.005, 0.1, 0xd8c040);
    for (const s of [-1, 1]) { box(a, M.stone, 0, o.h + 0.45, s * (o.w / 2 - 0.12), o.len, 0.9, 0.24, col(c, 0.9)); sol(a, 0, s * (o.w / 2 - 0.12), o.len, 0.26, o.h + 0.9, { y0: o.h, mount: false }); }
    for (const sx of [-1, 1]) { box(a, M.stone, sx * (o.len / 2 - 0.5), (o.h - 0.5) / 2, 0, 1, o.h - 0.5, o.w - 0.4, col(c, 0.85)); sol(a, sx * (o.len / 2 - 0.5), 0, 1, o.w - 0.4, o.h - 0.5, { mount: false }); }
    box(a, M.metal, 0, o.h - 0.65, 0, o.len - 2, 0.3, 0.3, DARK);
    sol(a, 0, 0, o.len, o.w, o.h, { y0: o.h - 0.5 });
  });
  K('scaffold', 'Scaffolding', BLD, { levels: 2, w: 2.5, len: 5 }, (a, o) => {
    const n = Math.max(1, Math.round(o.levels)), H = n * 2, nx = Math.max(1, Math.round(o.len / 2.5));
    for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) { const x = -o.len / 2 + i * o.len / nx; part(a, M.metal, G.cyl, [x, H / 2 + 0.5, s * o.w / 2], [0.03, H + 1, 0.03], 0x9aa0a6); sol(a, x, s * o.w / 2, 0.12, 0.12, H + 1, { mount: false, bullets: false }); }
    for (let j = 1; j <= n; j++) {
      const y = j * 2;
      for (let k = 0; k < 5; k++) box(a, M.paint, 0, y, -o.w / 2 + 0.25 + k * (o.w - 0.5) / 4, o.len, 0.05, 0.42, vary(0x8a6a3a, 0.12));
      sol(a, 0, 0, o.len, o.w, y + 0.03, { y0: y - 0.15 });
      for (const s of [-1, 1]) part(a, M.metal, G.cyl, [0, y + 1, s * o.w / 2], [0.025, o.len, 0.025], 0x9aa0a6, [0, Math.PI / 2]);
      part(a, M.metal, G.cyl, [0, y - 1, -o.w / 2], [0.02, Math.hypot(o.len, 2), 0.02], 0x9aa0a6, [0, Math.atan2(o.len, 2)]);
    }
    rails(a, o.len, o.w, H, 'b', 0x9aa0a6);
    ladder(a, -o.len / 2 + 0.8, o.w / 2, 0, 1, H, [-o.len / 2 + 0.8, 0.3]);
  });
  K('pavilion', 'Roof on posts', BLD, { w: 5, d: 5, h: 3, color: CON }, (a, o) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { box(a, M.stone, sx * (o.w / 2 - 0.25), o.h / 2, sz * (o.d / 2 - 0.25), 0.35, o.h, 0.35, vary(o.color, 0.06)); sol(a, sx * (o.w / 2 - 0.25), sz * (o.d / 2 - 0.25), 0.35, 0.35, o.h, { mount: false }); }
    box(a, M.stone, 0, o.h + 0.15, 0, o.w + 0.4, 0.3, o.d + 0.4, col(o.color, 0.9)); sol(a, 0, 0, o.w + 0.4, o.d + 0.4, o.h + 0.3, { y0: o.h });
  });
  K('floorPlate', 'Floor plate', BLD, { w: 2.5, d: 2.5, style: 'steel' }, (a, o) => {
    if (o.style === 'grate') part(a, grateMat(), tiled(o.w, o.d, 0.5), [0, 0.03, 0], [o.w, o.d, 1], undefined, [-Math.PI / 2, 0]);
    else { box(a, M.metal, 0, 0.02, 0, o.w, 0.04, o.d, o.style === 'hazard' ? 0x2a2a2a : 0x6a6e72); if (o.style === 'hazard') for (let k = 0; k < Math.round(o.w / 0.3); k++) box(a, M.paint, -o.w / 2 + (k + 0.5) * 0.3, 0.045, 0, 0.12, 0.005, o.d, YEL, [0, 0, 0.6]); else for (let x = -o.w / 2 + 0.15; x < o.w / 2; x += 0.3) for (let z = -o.d / 2 + 0.15; z < o.d / 2; z += 0.3) box(a, M.metal, x, 0.042, z, 0.12, 0.005, 0.03, 0x7a7e82, [0, 0, (x + z) % 0.6 > 0.3 ? 0.8 : -0.8]); }
  }, { flat: true, choices: { style: ['steel', 'grate', 'hazard'] } });
  K('railing', 'Railing', BLD, { len: 3, color: YEL }, (a, o) => rails(sub(a, 0, 0), o.len, 0, 0, 'f', o.color));
  K('fenceWood', 'Wooden fence', BLD, { len: 3, h: 1.2 }, (a, o) => {
    for (let x = -o.len / 2 + 0.07; x < o.len / 2; x += 0.16) box(a, M.paint, x, o.h / 2, 0, 0.13, o.h * (0.95 + R() * 0.05), 0.03, vary(WOOD, 0.14));
    for (const y of [0.3, o.h - 0.25]) box(a, M.paint, 0, y, -0.04, o.len, 0.1, 0.04, col(WOOD, 0.8));
    sol(a, 0, 0, o.len, 0.12, o.h, { bullets: false, mount: false });
  });
  K('gate', 'Fence gate', BLD, { w: 4, open: false }, (a, o) => {
    const hw = o.w / 2;
    for (const s of [-1, 1]) {
      part(a, M.metal, G.cyl, [s * hw, 1.25, 0], [0.06, 2.5, 0.06], 0x80868c);
      const leaf = o.open ? sub(a, s * hw, 0, s * Math.PI / 2 * 0.95) : sub(a, s * hw, 0);
      part(leaf, chainMat(), tiled(hw - 0.05, 2.1, 0.35), [-s * hw / 2, 1.15, 0], [hw - 0.05, 2.1, 1]);
      for (const y of [0.1, 2.2]) part(leaf, M.metal, G.cyl, [-s * hw / 2, y, 0], [0.025, hw, 0.025], 0x80868c, [0, Math.PI / 2]);
    }
    if (!o.open) sol(a, 0, 0, o.w, 0.14, 2.3, { bullets: false, mount: false });
  });
  K('hut', 'Hut', BLD, { w: 3.5, d: 3.5, color: 0x6a7070 }, (a, o) => {
    const c = vary(o.color, 0.1), h = 2.4, t = 0.1, w = o.w, d = o.d;
    const wall = (px, pz, len, along) => { const s = sub(a, px, pz, along ? 0 : Math.PI / 2); for (let x = -len / 2 + 0.1; x < len / 2; x += 0.2) box(s, M.metal, x, h / 2, 0, 0.18, h, 0.06, vary(c, 0.05)); sol(a, px, pz, along ? len : t * 1.5, along ? t * 1.5 : len, h); };
    wall(0, -d / 2, w, true); wall(-w / 2, 0, d, false); wall(w / 2, 0, d, false);
    wall(-w / 4 - 0.35, d / 2, w / 2 - 0.7, true); wall(w / 4 + 0.35, d / 2, w / 2 - 0.7, true); box(a, M.metal, 0, h - 0.2, d / 2, 1.4, 0.4, 0.06, c); sol(a, 0, d / 2, 1.4, t * 1.5, h, { y0: 2.05, mount: false });
    box(a, M.glass, w / 2, 1.5, 0, 0.08, 0.6, 0.9, 0x9ad0e8);
    part(a, M.metal, G.box, [0, h + 0.18, 0], [w + 0.5, 0.06, d + 0.5], vary(0x5a5048, 0.1), [0.08, 0]); sol(a, 0, 0, w + 0.4, d + 0.4, h + 0.35, { y0: h });
    box(a, M.paint, -w / 2 + 0.5, 0.45, -d / 2 + 0.45, 0.8, 0.9, 0.7, WOOD); box(a, M.cloth, w / 2 - 0.5, 0.25, -0.4, 0.8, 0.3, 1.8, 0x4a5a3a);
    L.glowAt(sub(a, 0, 0), h - 0.3, 0xffd080, 1, 0.35);
  });
  K('garage', 'Garage', BLD, { w: 6, d: 6, door: 'up', color: 0xa8a49a }, (a, o) => {
    const c = vary(o.color, 0.05), h = 3.4, t = 0.3, w = o.w, d = o.d;
    wallFace(sub(a, 0, -d / 2 + t / 2), 'brick', w, h, t, c); sol(a, 0, -d / 2 + t / 2, w, t, h);
    for (const s of [-1, 1]) { wallFace(sub(a, s * (w / 2 - t / 2), 0, Math.PI / 2), 'brick', d, h, t, c); sol(a, s * (w / 2 - t / 2), 0, t, d, h); }
    box(a, M.stone, 0, h - 0.3, d / 2 - t / 2, w, 0.6, t, c); sol(a, 0, d / 2 - t / 2, w, t, h, { y0: h - 0.6, mount: false });
    if (o.door === 'down') { for (let y = 0.15; y < h - 0.6; y += 0.3) box(a, M.metal, 0, y, d / 2 - t / 2, w - 2 * t, 0.28, 0.06, vary(0x8a8e92, 0.05)); sol(a, 0, d / 2 - t / 2, w, t, h - 0.6); }
    else if (o.door === 'half') { for (let y = 1.3; y < h - 0.6; y += 0.3) box(a, M.metal, 0, y, d / 2 - t / 2, w - 2 * t, 0.28, 0.06, vary(0x8a8e92, 0.05)); sol(a, 0, d / 2 - t / 2, w, t, h, { y0: 1.2, mount: false }); }
    box(a, M.stone, 0, h + 0.15, 0, w + 0.3, 0.3, d + 0.3, 0x4a4a48); sol(a, 0, 0, w + 0.3, d + 0.3, h + 0.3, { y0: h });
    box(a, M.paint, 0, 0.02, 0, w - 0.6, 0.04, d - 0.6, 0x3a3a36); part(a, M.decal, circle(), [0.6, 0.05, 0.4], [1.2, 0.8, 1], 0x151412, [-Math.PI / 2, 0]);
    box(a, M.paint, -w / 2 + 0.6, 0.9, -d / 4, 0.7, 1.8, 2.2, 0x6a3020); sol(a, -w / 2 + 0.6, -d / 4, 0.7, 2.2, 1.8);
    L.glowAt(sub(a, 0, 0), h - 0.2, 0xe8f0ff, 1.5, 0.4);
  }, { choices: { door: ['up', 'half', 'down'] } });
  K('containerOpen', 'Container (walk-in)', BLD, { color: 0x2a5a8a, open: true }, (a, o) => {
    const c = vary(o.color, 0.1), Lx = 6.1, Wz = 2.44, H = 2.6, t = 0.08;
    const ribs = (s, len) => { for (let x = -len / 2 + 0.1; x < len / 2; x += 0.2) box(s, M.metal, x, H / 2, 0, 0.1, H - 0.1, 0.06, c); };
    for (const s of [-1, 1]) { const sa = sub(a, 0, s * (Wz / 2 - t / 2)); box(sa, M.metal, 0, H / 2, 0, Lx, H, t, c); ribs(sub(a, 0, s * (Wz / 2)), Lx); sol(a, 0, s * (Wz / 2 - t / 2), Lx, t * 2, H); }
    box(a, M.metal, -Lx / 2 + t / 2, H / 2, 0, t, H, Wz, c); sol(a, -Lx / 2 + t / 2, 0, t * 2, Wz, H);
    box(a, M.metal, 0, H - t / 2, 0, Lx, t, Wz, col(c, 0.9)); sol(a, 0, 0, Lx, Wz, H, { y0: H - 0.1 });
    box(a, M.paint, 0, 0.05, 0, Lx - 0.1, 0.02, Wz - 0.2, 0x5a4a38);
    if (o.open) for (const s of [-1, 1]) { const leaf = sub(a, Lx / 2, s * Wz / 2, s * Math.PI * 0.45); box(leaf, M.metal, 0, H / 2, -s * Wz / 4, 0.06, H - 0.1, Wz / 2, c); }
    else { box(a, M.metal, Lx / 2 - t / 2, H / 2, 0, t, H, Wz, col(c, 0.95)); sol(a, Lx / 2 - t / 2, 0, t * 2, Wz, H); }
  });
  K('containerStack', 'Container stack', BLD, { n: 2 }, (a, o) => {
    const n = Math.max(1, Math.round(o.n)), Lx = 6.1, Wz = 2.44, H = 2.6;
    for (let k = 0; k < n; k++) { const c = vary([0x2a5a8a, 0x8a3a2a, 0x3a6a3a, 0xa87a2a, 0x6a6a6a][Math.floor(R() * 5)], 0.08), off = (R() - 0.5) * 0.2; box(a, M.metal, off, H / 2 + k * H, 0, Lx, H - 0.02, Wz, c); for (let x = -Lx / 2 + 0.1; x < Lx / 2; x += 0.2) for (const s of [-1, 1]) box(a, M.metal, off + x, H / 2 + k * H, s * Wz / 2, 0.1, H - 0.1, 0.06, c); for (const s of [-1, 1]) box(a, M.metal, off + s * Lx / 2, H / 2 + k * H, 0, 0.04, H - 0.1, Wz - 0.1, col(c, 0.8)); }
    sol(a, 0, 0, Lx, Wz, n * H, { noClimb: n > 1 });
  });
  K('ladder', 'Ladder (climbable)', BLD, { h: 3 }, (a, o) => {
    ladder(a, 0, 0, 0, 1, o.h, [0, -0.6]);
  }, { note: 'Stand it against a wall, deck or roof, facing out (the side you climb from). h: how high it reaches.' });

  // =============================================================== industrial
  const IND = 'Industrial';
  K('fuelTank', 'Fuel tank', IND, { len: 5, color: 0xd8d4c8 }, (a, o) => {
    const c = vary(o.color, 0.05);
    part(a, M.metal, G.cyl, [0, 1.4, 0], [1.1, o.len, 1.1], c, [0, Math.PI / 2]); for (const s of [-1, 1]) part(a, M.metal, dome(), [s * o.len / 2, 1.4, 0], [0.35, 1.1, 1.1], c, [0, -s * Math.PI / 2]);
    for (const x of [-o.len / 3, o.len / 3]) box(a, M.paint, x, 0.35, 0, 0.3, 0.7, 2, 0x3a3a3a);
    for (const x of [-o.len / 4, 0, o.len / 4]) part(a, M.metal, G.torus, [x, 1.4, 0], [1.12, 1.12, 1.5], 0x9a9a92, [0, 0, Math.PI / 2]);
    box(a, M.paint, 0, 1.4, 1.11, 1.2, 0.35, 0.01, 0xc02020); box(a, M.metal, 0, 2.55, 0, 0.5, 0.15, 0.5, DARK);
    sol(a, 0, 0, o.len + 0.6, 2.2, 2.5);
  });
  K('silo', 'Silo', IND, { h: 9, r: 1.8, color: 0xb8b8b0 }, (a, o) => {
    part(a, M.metal, G.cyl, [0, o.h / 2, 0], [o.r, o.h, o.r], vary(o.color, 0.05)); part(a, M.metal, cone(), [0, o.h + 0.5, 0], [o.r + 0.1, 1, o.r + 0.1], col(o.color, 0.85));
    for (let y = 1; y < o.h; y += 1.5) part(a, M.metal, G.torus, [0, y, 0], [o.r + 0.02, o.r + 0.02, 0.5], 0x8a8a84, [Math.PI / 2, 0]);
    for (const s of [-0.25, 0.25]) box(a, M.metal, s, o.h / 2, o.r + 0.2, 0.05, o.h, 0.05, 0x9aa2aa); for (let y = 0.3; y < o.h; y += 0.34) box(a, M.metal, 0, y, o.r + 0.2, 0.5, 0.03, 0.03, 0x9aa2aa);
    for (let y = 2.5; y < o.h; y += 0.6) part(a, M.metal, G.torus, [0, y, o.r + 0.35], [0.35, 0.35, 0.3], 0x9aa2aa, [Math.PI / 2, 0]);
    cyl(a, 0, 0, o.r, o.h + 1, { noClimb: true });
  });
  K('pipeRack', 'Pipe rack', IND, { len: 8, h: 2.6 }, (a, o) => {
    const n = Math.max(1, Math.round(o.len / 2.7));
    for (let k = 0; k <= n; k++) { const x = -o.len / 2 + k * o.len / n; for (const s of [-1, 1]) { box(a, M.metal, x, o.h / 2, s * 0.9, 0.16, o.h, 0.16, 0x6a6e3a); sol(a, x, s * 0.9, 0.22, 0.22, o.h - 0.1, { mount: false }); } box(a, M.metal, x, o.h, 0, 0.16, 0.16, 2, 0x6a6e3a); }
    [[-0.55, 0.28, 0x8a8e92], [0, 0.22, 0xc0a030], [0.55, 0.34, 0x9a4a2a]].forEach(([z, r, c]) => part(a, M.metal, G.cyl, [0, o.h + 0.1 + r, z], [r, o.len + 0.6, r], c, [0, Math.PI / 2]));
    sol(a, 0, 0, o.len + 0.6, 2, o.h + 0.8, { y0: o.h - 0.1 });
  });
  K('transformer', 'Transformer', IND, { hum: true }, (a) => {
    box(a, M.metal, 0, 1.0, 0, 2.2, 2, 1.4, 0x5a6a5a); for (let x = -0.9; x <= 0.9; x += 0.15) for (const s of [-1, 1]) box(a, M.metal, x, 0.95, s * 0.8, 0.04, 1.6, 0.2, 0x4a5a4a);
    for (const x of [-0.6, 0, 0.6]) { for (let k = 0; k < 5; k++) part(a, M.paint, G.cyl, [x, 2.15 + k * 0.12, 0], [0.12, 0.06, 0.12], 0xa84a2a); part(a, M.metal, G.cyl, [x, 2.85, 0], [0.03, 0.2, 0.03], 0x8a8a8a); }
    box(a, M.paint, 0, 1.4, 0.71, 0.45, 0.4, 0.01, YEL); part(a, M.paint, pyr(), [0, 1.42, 0.72], [0.12, 0.2, 0.02], 0x151515);
    sol(a, 0, 0, 2.4, 1.8, 2.2);
    if (!SD.editor) L.glowAt(sub(a, 0, 0), 2.9, 0x60a0ff, 0.8, 0.25);
  });
  K('cableSpool', 'Cable spool', IND, { lying: false }, (a, o) => {
    const s = o.lying ? sub(a, 0, 0) : a, rot = o.lying ? [Math.PI / 2, 0] : [0, Math.PI / 2];
    const y = o.lying ? 0.45 : 0.85;
    for (const d of [-0.45, 0.45]) part(a, M.paint, G.cyl, o.lying ? [0, y + d, 0] : [d, y, 0], [0.85, 0.08, 0.85], vary(WOOD, 0.1), o.lying ? undefined : rot);
    part(s, M.paint, G.cyl, [0, y, 0], [0.6, 0.85, 0.6], 0x1a1a1a, o.lying ? undefined : rot);
    if (o.lying) sol(a, 0, 0, 1.7, 1.7, 0.95); else sol(a, 0, 0, 1, 1.7, 1.7);
  });
  K('tallTank', 'Chemical tank', IND, { h: 6, r: 1.5, color: 0x8ab0a0 }, (a, o) => {
    part(a, M.metal, G.cyl, [0, o.h / 2 + 0.6, 0], [o.r, o.h, o.r], vary(o.color, 0.06)); part(a, M.metal, dome(), [0, o.h + 0.6, 0], [o.r, 0.5, o.r], col(o.color, 0.9));
    for (let k = 0; k < 4; k++) { const t = k * Math.PI / 2 + 0.78; box(a, M.metal, Math.sin(t) * o.r * 0.8, 0.3, Math.cos(t) * o.r * 0.8, 0.2, 0.6, 0.2, DARK); }
    box(a, M.paint, 0, o.h * 0.6, o.r + 0.01, 1.2, 0.8, 0.01, 0xe8e8e0); part(a, M.paint, pyr(), [0, o.h * 0.6, o.r + 0.02], [0.3, 0.5, 0.02], 0xd02020);
    part(a, M.metal, G.cyl, [o.r * 0.7, 0.4, o.r * 0.7], [0.12, 0.8, 0.12], 0x9a9a92);
    cyl(a, 0, 0, o.r, o.h + 1.1, { noClimb: true });
  });
  K('craneMast', 'Crane tower', IND, { h: 16, jib: 12 }, (a, o) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(a, M.paint, sx * 0.7, o.h / 2, sz * 0.7, 0.12, o.h, 0.12, YEL);
    for (let y = 1; y < o.h; y += 1.4) for (const [ry, px, pz] of [[0, 0, -0.7], [0, 0, 0.7], [Math.PI / 2, -0.7, 0], [Math.PI / 2, 0.7, 0]]) box(a, M.paint, px, y + 0.7, pz, 1.9, 0.06, 0.06, YEL, [0, 0.8, ry]);
    box(a, M.paint, o.jib / 2 - 2, o.h + 0.5, 0, o.jib + 4, 0.8, 0.9, YEL); box(a, M.paint, -3.2, o.h + 0.1, 0, 1.6, 1.4, 1.4, 0x8a8a84);
    box(a, M.paint, 0.2, o.h - 0.8, 0.9, 1.4, 1.4, 1.2, 0xd8d4c8); box(a, M.glass, 0.2, o.h - 0.7, 1.5, 1.2, 0.8, 0.02, 0x9ad0e8);
    const hx = o.jib * 0.7; part(a, M.metal, G.cyl, [hx, o.h / 2 + 2, 0], [0.02, o.h - 4, 0.02], 0x2a2a2a); box(a, M.metal, hx, 5.8, 0, 0.5, 0.5, 0.3, YEL); part(a, M.metal, G.torus, [hx, 5.3, 0], [0.25, 0.25, 0.25], DARK);
    part(a, M.glow, G.sphere, [o.jib + 1.8, o.h + 1, 0], [0.12, 0.12, 0.12], 0xff2020); L.glowAt(sub(a, o.jib + 1.8, 0), o.h + 1, 0xff3020, 1.6, 0.6);
    box(a, M.stone, 0, 0.3, 0, 2.6, 0.6, 2.6, CON2); sol(a, 0, 0, 2.6, 2.6, 0.6); sol(a, 0, 0, 1.6, 1.6, o.h, { mount: false, noClimb: true, bullets: false });
  });
  K('beltConveyor', 'Conveyor machine', IND, { len: 6, boxes: true }, (a, o) => {
    for (let x = -o.len / 2 + 0.3; x < o.len / 2; x += 1.2) for (const s of [-1, 1]) box(a, M.metal, x, 0.45, s * 0.5, 0.08, 0.9, 0.08, 0x6a6e72);
    for (const s of [-1, 1]) box(a, M.metal, 0, 0.92, s * 0.55, o.len, 0.18, 0.06, YEL);
    box(a, M.paint, 0, 0.95, 0, o.len, 0.05, 1.0, 0x1a1a1a);
    for (let x = -o.len / 2 + 0.2; x < o.len / 2; x += 0.4) part(a, M.metal, G.cyl, [x, 0.88, 0], [0.07, 1.0, 0.07], 0x8a8e92, [Math.PI / 2, 0]);
    if (o.boxes) for (let x = -o.len / 2 + 0.6; x < o.len / 2; x += 1.1 + R() * 0.5) box(a, M.paint, x, 1.2, (R() - 0.5) * 0.3, 0.45, 0.45, 0.45, vary(0x9a7a50, 0.12), [0, 0, R()]);
    box(a, M.metal, o.len / 2 + 0.4, 0.8, 0, 0.8, 1.6, 1.2, 0x4a5058); box(a, M.glow, o.len / 2 + 0.81, 1.2, 0.3, 0.02, 0.1, 0.1, 0x40ff60);
    sol(a, 0, 0, o.len, 1.2, 1.0); sol(a, o.len / 2 + 0.4, 0, 0.8, 1.2, 1.6);
  });
  K('press', 'Hydraulic press', IND, {}, (a) => {
    box(a, M.metal, 0, 0.4, 0, 2.2, 0.8, 1.8, 0x3a4048); for (const sx of [-1, 1]) box(a, M.metal, sx * 0.9, 2, 0, 0.35, 3.2, 1.2, 0x5a6a7a); box(a, M.metal, 0, 3.45, 0, 2.3, 0.5, 1.4, 0x5a6a7a);
    part(a, M.metal, G.cyl, [0, 2.7, 0], [0.25, 1.1, 0.25], 0xc8ccd0); box(a, M.metal, 0, 2.05, 0, 1.3, 0.3, 1.0, 0x4a4e52);
    for (let k = 0; k < 5; k++) box(a, M.paint, -0.8 + k * 0.4, 0.82, 0.9, 0.2, 0.04, 0.01, k % 2 ? YEL : 0x151515);
    box(a, M.paint, 1.4, 1.1, 0.4, 0.4, 0.6, 0.3, 0x2a2e33); box(a, M.glow, 1.4, 1.2, 0.56, 0.1, 0.1, 0.01, 0xff3030);
    sol(a, 0, 0, 2.3, 1.8, 3.7);
  });
  K('ventStack', 'Exhaust stack', IND, { h: 8 }, (a, o) => {
    part(a, M.metal, G.cyl, [0, o.h / 2, 0], [0.4, o.h, 0.4], 0x7a7a74); part(a, M.metal, G.cyl, [0, o.h + 0.1, 0], [0.48, 0.2, 0.48], 0x3a3a38);
    for (let y = 1; y < o.h; y += 2) part(a, M.metal, G.torus, [0, y, 0], [0.42, 0.42, 0.5], 0x5a5a54, [Math.PI / 2, 0]);
    for (const t of [0, 2.1, 4.2]) box(a, M.metal, Math.sin(t) * o.h * 0.2, o.h * 0.42, Math.cos(t) * o.h * 0.2, 0.012, o.h * 0.9, 0.012, 0x6a6a6a, [Math.cos(t) * 0.42, -Math.sin(t) * 0.42]);
    box(a, M.stone, 0, 0.2, 0, 1.1, 0.4, 1.1, CON2); cyl(a, 0, 0, 0.45, o.h, { mount: false, noClimb: true });
  });
  K('dieselGen', 'Diesel generator', IND, { lit: true }, (a, o) => {
    box(a, M.paint, 0, 0.8, 0, 3, 1.5, 1.3, 0x3a5a3a); box(a, M.paint, 0, 0.05, 0, 3.2, 0.1, 1.4, 0x2a2a2a);
    for (let x = -1.2; x <= 1.2; x += 0.2) box(a, M.metal, x, 0.9, 0.66, 0.08, 0.9, 0.01, 0x2a3a2a);
    part(a, M.metal, G.cyl, [1.1, 1.9, -0.3], [0.08, 0.8, 0.08], 0x3a3a38); box(a, M.paint, -1.1, 1.1, 0.66, 0.5, 0.4, 0.01, 0x1a1a1a);
    if (o.lit) { box(a, M.glow, -1.2, 1.15, 0.67, 0.08, 0.08, 0.01, 0x40ff60); box(a, M.glow, -1.0, 1.15, 0.67, 0.08, 0.08, 0.01, 0xffb020); }
    sol(a, 0, 0, 3.2, 1.4, 1.6);
  });
  K('dumpster', 'Dumpster', IND, { open: false, color: 0x2a5a3a }, (a, o) => {
    const c = vary(o.color, 0.1);
    box(a, M.metal, 0, 0.7, 0, 2, 1.3, 1.2, c); box(a, M.metal, 0, 0.1, 0, 2.05, 0.2, 1.25, col(c, 0.7));
    if (o.open) { box(a, M.metal, 0, 1.4, -0.9, 2, 0.05, 0.6, col(c, 0.9), [1.2, 0]); box(a, M.paint, 0, 1.3, 0, 1.8, 0.1, 1.0, 0x2a2420); } else box(a, M.metal, 0, 1.4, 0, 2.05, 0.06, 1.25, col(c, 0.9), [0.05, 0]);
    sol(a, 0, 0, 2.05, 1.25, 1.4);
  });
  K('valves', 'Pipe junction', IND, {}, (a) => {
    part(a, M.metal, G.cyl, [0, 0.6, 0], [0.35, 3, 0.35], 0x8a8e92, [0, Math.PI / 2]); part(a, M.metal, G.cyl, [0, 1.2, 0], [0.35, 1.3, 0.35], 0x8a8e92);
    part(a, M.metal, G.cyl, [0, 1.85, 0], [0.35, 0.8, 0.35], 0x8a8e92, [Math.PI / 2, 0]);
    for (const x of [-1, 1]) { part(a, M.metal, G.cyl, [x, 0.6, 0], [0.45, 0.12, 0.45], DARK, [0, Math.PI / 2]); part(a, M.paint, G.torus, [x * 0.6, 1.0, 0], [0.22, 0.22, 0.22], 0xc02020); part(a, M.metal, G.cyl, [x * 0.6, 0.8, 0], [0.03, 0.4, 0.03], DARK); }
    box(a, M.metal, 0, 0.1, 0, 3.2, 0.2, 0.6, 0x4a4a48); sol(a, 0, 0, 3.2, 1, 1.2); sol(a, 0, 0, 0.8, 0.8, 2.3, { mount: false });
  });
  // explosive
  K('barrelBoom', 'Explosive barrel', IND, { color: 0xb02a1a }, (a, o) => {
    part(a, M.paint, G.cyl, [0, 0.45, 0], [0.3, 0.9, 0.3], vary(o.color, 0.06)); for (const y of [0.25, 0.65]) part(a, M.metal, G.cyl, [0, y, 0], [0.31, 0.04, 0.31], 0x3a3a3a);
    part(a, M.metal, G.cyl, [0, 0.905, 0], [0.28, 0.02, 0.28], 0x5a1a10); box(a, M.paint, 0, 0.5, 0.3, 0.24, 0.24, 0.01, YEL); part(a, M.paint, pyr(), [0, 0.5, 0.31], [0.07, 0.12, 0.01], 0x151515);
    boomer(a, [sol(a, 0, 0, 0.6, 0.6, 0.9)], { hp: 25, r: 4.5, dmg: 900 });
  }, { solo: true, note: 'Blows up when shot or caught in a blast, and sets off others nearby.' });
  K('gasCans', 'Gas cylinders', IND, { n: 4 }, (a, o) => {
    const n = Math.max(1, Math.round(o.n)); const props = [];
    for (let k = 0; k < n; k++) { const x = (k % 3 - 1) * 0.4, z = Math.floor(k / 3) * 0.4; part(a, M.paint, G.cyl, [x, 0.7, z], [0.15, 1.3, 0.15], k % 2 ? 0xe8e8e0 : 0xc84020); part(a, M.metal, dome(), [x, 1.35, z], [0.15, 0.12, 0.15], k % 2 ? 0xe8e8e0 : 0xc84020); part(a, M.metal, G.cyl, [x, 1.5, z], [0.04, 0.12, 0.04], 0x9a9a92); }
    box(a, M.metal, 0, 0.9, -0.2, 1.3, 0.04, 0.04, 0x4a4a48);
    props.push(sol(a, 0, 0.2, 1.3, 0.8, 1.5, { mount: false }));
    boomer(a, props, { hp: 30, r: 6, dmg: 1400, color: 0xff9030 });
  }, { solo: true, note: 'A big blast when shot.' });
  K('fuelDrums', 'Fuel drums', IND, { n: 3 }, (a, o) => {
    const n = Math.max(1, Math.round(o.n));
    for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * 0.62, y = k === n - 1 && n > 3 ? 0.9 : 0; part(a, M.paint, G.cyl, [x, 0.45 + y, (k % 2) * 0.1], [0.3, 0.9, 0.3], vary(0xd8b020, 0.1)); part(a, M.paint, G.cyl, [x, 0.45 + y, (k % 2) * 0.1], [0.305, 0.15, 0.305], 0x151515); }
    part(a, M.decal, circle(), [0.3, 0.012, 0.5], [0.9, 0.6, 1], 0x151008, [-Math.PI / 2, 0]);
    boomer(a, [sol(a, 0, 0, n * 0.62, 0.7, 0.9)], { hp: 35, r: 5, dmg: 1000, fire: true });
  }, { solo: true, note: 'Explodes when shot and leaves the ground burning for a while.' });

  // =============================================================== nature and alien
  const NAT = 'Nature and alien';
  K('boulder', 'Boulder', NAT, { size: 1.5, color: 0x6a6660 }, (a, o) => {
    const s = o.size;
    part(a, M.stone, rock(), [0, s * 0.45, 0], [s * (0.9 + R() * 0.3), s * (0.6 + R() * 0.2), s * (0.8 + R() * 0.3)], vary(o.color, 0.1), [R() * 3, R() * 3, R() * 3]);
    if (R() < 0.6) part(a, M.stone, rock(), [s * 0.6, s * 0.2, s * 0.3], [s * 0.4, s * 0.3, s * 0.4], vary(o.color, 0.12), [R() * 3, R() * 3]);
    cyl(a, 0, 0, s * 0.85, s * 0.95);
  });
  K('rocks', 'Rock cluster', NAT, { n: 6, color: 0x6a6660 }, (a, o) => {
    for (let k = 0; k < Math.round(o.n); k++) { const r = 0.25 + R() * 0.6, x = (R() - 0.5) * 3, z = (R() - 0.5) * 3; part(a, M.stone, ico(), [x, r * 0.5, z], [r, r * 0.8, r * (0.8 + R() * 0.4)], vary(o.color, 0.14), [R() * 3, R() * 3, R() * 3]); if (r > 0.55) cyl(a, x, z, r * 0.8, r * 1.1); }
  });
  K('pine', 'Pine tree', NAT, { h: 8, color: 0x2a4a2a, snow: false }, (a, o) => {
    part(a, M.paint, G.cyl, [0, o.h * 0.25, 0], [0.18, o.h * 0.5, 0.18], 0x4a3020);
    for (let k = 0; k < 4; k++) { const y = o.h * (0.3 + k * 0.17), r = o.h * (0.28 - k * 0.055); part(a, M.organic, cone(), [0, y + r * 0.6, 0], [r, r * 1.5, r], vary(o.color, 0.1), [0, 0, R() * 2]); if (o.snow) part(a, M.paint, cone(), [0, y + r * 0.9, 0], [r * 0.7, r * 0.9, r * 0.7], 0xe8f0f4); }
    cyl(a, 0, 0, 0.25, o.h, { mount: false, bullets: true });
  });
  K('deadTree', 'Dead tree', NAT, { h: 6 }, (a, o) => {
    part(a, M.paint, G.cyl, [0, o.h * 0.35, 0], [0.22, o.h * 0.7, 0.2], 0x3a3028, [0.05, 0.04]);
    for (let k = 0; k < 6; k++) { const y = o.h * (0.35 + R() * 0.45), t = R() * 6.28, l = 1 + R() * 1.8; part(a, M.paint, G.cyl, [Math.sin(t) * l * 0.4, y + l * 0.3, Math.cos(t) * l * 0.4], [0.06, l, 0.06], 0x3a3028, [Math.cos(t) * 0.9, -Math.sin(t) * 0.9]); }
    cyl(a, 0, 0, 0.28, o.h * 0.7, { mount: false });
  });
  K('bush', 'Bush', NAT, { size: 1.2, color: 0x3a5a2a }, (a, o) => { for (let k = 0; k < 5; k++) part(a, M.organic, G.sphere, [(R() - 0.5) * o.size, o.size * (0.3 + R() * 0.3), (R() - 0.5) * o.size], [o.size * (0.4 + R() * 0.2), o.size * (0.35 + R() * 0.15), o.size * (0.4 + R() * 0.2)], vary(o.color, 0.15)); }, { note: 'No collider: you walk through it, but it hides you.' });
  K('grass', 'Grass patch', NAT, { size: 2, color: 0x5a7a3a }, (a, o) => { for (let k = 0; k < Math.round(o.size * o.size * 8); k++) part(a, M.organic, G.cone, [(R() - 0.5) * o.size, 0.2, (R() - 0.5) * o.size], [0.03, 0.4 + R() * 0.3, 0.03], vary(o.color, 0.2), [(R() - 0.5) * 0.5, (R() - 0.5) * 0.5]); }, { flat: true });
  K('fallenLog', 'Fallen log', NAT, { len: 5 }, (a, o) => {
    part(a, M.paint, G.cyl, [0, 0.4, 0], [0.4, o.len, 0.4], 0x4a3a28, [0, Math.PI / 2 + (R() - 0.5) * 0.1]); for (const s of [-1, 1]) part(a, M.paint, G.cyl, [s * o.len / 2, 0.4, 0], [0.36, 0.02, 0.36], 0x8a6a48, [0, Math.PI / 2]);
    part(a, M.paint, G.cyl, [o.len * 0.2, 0.7, 0.3], [0.08, 1.2, 0.08], 0x4a3a28, [0.8, 0.4]); sol(a, 0, 0, o.len, 0.8, 0.8);
  });
  K('stalagmite', 'Stalagmite', NAT, { h: 3, color: 0x7a6a5a }, (a, o) => { part(a, M.stone, cone(), [0, o.h / 2, 0], [o.h * 0.22, o.h, o.h * 0.22], vary(o.color, 0.08)); part(a, M.stone, cone(), [o.h * 0.15, o.h * 0.25, 0.1], [o.h * 0.1, o.h * 0.5, o.h * 0.1], vary(o.color, 0.1)); cyl(a, 0, 0, o.h * 0.18, o.h, { mount: false }); });
  K('crystalPillar', 'Crystal pillar', NAT, { h: 4, color: 0x60d0ff }, (a, o) => {
    for (let k = 0; k < 5; k++) { const h = o.h * (0.4 + R() * 0.6), t = R() * 6.28, r = k ? 0.4 : 0; part(a, M.glass, hex(), [Math.sin(t) * r, h / 2, Math.cos(t) * r], [0.25, h, 0.25], o.color, [(R() - 0.5) * 0.4 * (k ? 1 : 0), (R() - 0.5) * 0.4 * (k ? 1 : 0)]); part(a, M.glow, hex(), [Math.sin(t) * r, h / 2, Math.cos(t) * r], [0.1, h * 0.9, 0.1], o.color, [(R() - 0.5) * 0.4 * (k ? 1 : 0), 0]); }
    L.glowAt(sub(a, 0, 0), o.h * 0.6, o.color, 2.5, 0.45); cyl(a, 0, 0, 0.5, o.h, { mount: false });
  });
  K('glowShrooms', 'Glowing mushrooms', NAT, { color: 0x60ffc0 }, (a, o) => {
    for (let k = 0; k < 7; k++) { const x = (R() - 0.5) * 1.6, z = (R() - 0.5) * 1.6, h = 0.2 + R() * 0.7; part(a, M.organic, G.cyl, [x, h / 2, z], [0.04, h, 0.04], 0xd8d0c0); part(a, M.glow, dome(), [x, h, z], [0.12 + h * 0.2, 0.1, 0.12 + h * 0.2], o.color); }
    L.glowAt(sub(a, 0, 0), 0.5, o.color, 1.6, 0.4);
  }, { flat: true });
  K('cactus', 'Cactus', NAT, { h: 3 }, (a, o) => {
    part(a, M.organic, G.cyl, [0, o.h / 2, 0], [0.25, o.h, 0.25], 0x4a7a3a); part(a, M.organic, G.sphere, [0, o.h, 0], [0.25, 0.2, 0.25], 0x4a7a3a);
    for (const s of [-1, 1]) { const y = o.h * (0.4 + R() * 0.2); part(a, M.organic, G.cyl, [s * 0.4, y, 0], [0.15, 0.5, 0.15], 0x4a7a3a, [0, s * Math.PI / 2]); part(a, M.organic, G.cyl, [s * 0.6, y + 0.4, 0], [0.15, 0.8, 0.15], 0x4a7a3a); }
    cyl(a, 0, 0, 0.3, o.h, { mount: false });
  });
  K('iceSpike', 'Ice spikes', NAT, { h: 3 }, (a, o) => { for (let k = 0; k < 4; k++) { const h = o.h * (0.4 + R() * 0.6), t = R() * 6.28, r = k ? 0.5 : 0; part(a, M.glass, cone(), [Math.sin(t) * r, h / 2, Math.cos(t) * r], [0.3, h, 0.3], 0xc0e8ff, [(R() - 0.5) * 0.3, (R() - 0.5) * 0.3]); } part(a, M.paint, G.cyl, [0, 0.05, 0], [1, 0.1, 1], 0xe0f0ff); cyl(a, 0, 0, 0.5, o.h * 0.8, { mount: false }); });
  K('hiveColumn', 'Hive column', NAT, { h: 5, color: 0x5a3a4a, glow: 0xa0ff40 }, (a, o) => {
    for (let k = 0; k < 6; k++) part(a, M.organic, G.sphere, [(R() - 0.5) * 0.2, (k + 0.5) * o.h / 6, (R() - 0.5) * 0.2], [0.7 - k * 0.05, o.h / 6 * 0.8, 0.7 - k * 0.05], vary(o.color, 0.12));
    for (let k = 0; k < 8; k++) { const t = R() * 6.28, y = R() * o.h; part(a, M.organic, G.cyl, [Math.sin(t) * 0.62, y, Math.cos(t) * 0.62], [0.08, 1.2, 0.08], col(o.color, 0.8), [(R() - 0.5) * 0.6, (R() - 0.5) * 0.6]); }
    for (let k = 0; k < 5; k++) { const t = R() * 6.28, y = 0.4 + R() * (o.h - 0.8); part(a, M.glow, G.sphere, [Math.sin(t) * 0.66, y, Math.cos(t) * 0.66], [0.12, 0.12, 0.12], o.glow); }
    L.glowAt(sub(a, 0, 0), o.h * 0.4, o.glow, 1.8, 0.3); cyl(a, 0, 0, 0.7, o.h);
  });
  K('hiveWall', 'Hive wall', NAT, { len: 5, h: 3.5, color: 0x4a2a3a, glow: 0xa0ff40 }, (a, o) => {
    box(a, M.organic, 0, o.h / 2, 0, o.len, o.h, 0.35, vary(o.color, 0.08));
    for (let x = -o.len / 2 + 0.3; x < o.len / 2; x += 0.5 + R() * 0.3) for (const s of [-1, 1]) part(a, M.organic, G.cyl, [x, o.h / 2, s * 0.2], [0.09, o.h * (0.8 + R() * 0.2), 0.09], col(o.color, 0.7), [(R() - 0.5) * 0.3, (R() - 0.5) * 0.3]);
    for (let k = 0; k < o.len * 1.5; k++) part(a, M.glow, G.sphere, [(R() - 0.5) * o.len, R() * o.h, (R() < 0.5 ? -1 : 1) * 0.2], [0.1, 0.1, 0.05], o.glow);
    for (let k = 0; k < o.len; k++) part(a, M.organic, G.sphere, [(R() - 0.5) * o.len, o.h, 0], [0.4, 0.3, 0.3], col(o.color, 0.9));
    sol(a, 0, 0, o.len, 0.5, o.h + 0.2);
  });
  K('obelisk', 'Alien obelisk', NAT, { h: 6, glow: 0x60ff90 }, (a, o) => {
    box(a, M.stone, 0, o.h / 2, 0, 0.9, o.h, 0.9, 0x151518, [0, 0, Math.PI / 4]); part(a, M.stone, pyr(), [0, o.h + 0.35, 0], [0.64, 0.7, 0.64], 0x151518);
    for (let k = 0; k < 8; k++) { const y = 0.6 + k * (o.h - 1) / 8, s = k % 2 ? 1 : -1; box(a, M.glow, s * 0.33, y, 0.33, 0.25, 0.08, 0.01, o.glow, [0, 0, Math.PI / 4]); }
    box(a, M.stone, 0, 0.15, 0, 2, 0.3, 2, 0x2a2a2e, [0, 0, Math.PI / 4]); L.glowAt(sub(a, 0, 0), o.h * 0.5, o.glow, 3, 0.35);
    sol(a, 0, 0, 1.1, 1.1, o.h + 0.7, { noClimb: true }); sol(a, 0, 0, 2, 2, 0.3);
  });
  K('forceField', 'Force field (creatures only)', NAT, { len: 4, h: 3, color: 0x40c0ff }, (a, o) => {
    for (const s of [-1, 1]) { box(a, M.metal, s * (o.len / 2 + 0.15), o.h / 2 + 0.1, 0, 0.3, o.h + 0.2, 0.4, DARK); box(a, M.glow, s * (o.len / 2 + 0.01), o.h / 2 + 0.1, 0, 0.04, o.h, 0.1, o.color); sol(a, s * (o.len / 2 + 0.15), 0, 0.3, 0.4, o.h + 0.2); }
    part(a, fieldMat(o.color), G.plane, [0, o.h / 2 + 0.1, 0], [o.len, o.h, 1]);
    for (let y = 0.4; y < o.h; y += 0.6) box(a, M.glow, 0, y, 0, o.len, 0.015, 0.015, o.color);
    L.glowAt(sub(a, 0, 0), o.h / 2, o.color, 2.5, 0.3);
    sol(a, 0, 0, o.len, 0.3, o.h + 0.2, { noPlayer: true, bullets: false, mount: false, noClimb: true });
  }, { note: 'Creatures cannot cross it. You and your shots go straight through.' });
  K('eggCluster', 'Alien egg cluster', NAT, { n: 6, glow: 0xc0ff60 }, (a, o) => {
    part(a, M.decal, circle(), [0, 0.012, 0], [1.6, 1.6, 1], 0x2a1a24, [-Math.PI / 2, 0]);
    for (let k = 0; k < Math.round(o.n); k++) { const t = R() * 6.28, r = R() * 1.1, s = 0.3 + R() * 0.2; part(a, M.organic, G.sphere, [Math.sin(t) * r, s * 1.2, Math.cos(t) * r], [s, s * 1.5, s], vary(0x6a5a4a, 0.14)); part(a, M.glow, G.sphere, [Math.sin(t) * r, s * 2.4, Math.cos(t) * r], [s * 0.4, s * 0.15, s * 0.4], o.glow); }
    L.glowAt(sub(a, 0, 0), 0.6, o.glow, 1.8, 0.35);
  });

  // =============================================================== street and camp
  const STR = 'Street and camp';
  K('lampPost', 'Lamp post', STR, { h: 5, color: 0xffe0a0 }, (a, o) => {
    part(a, M.metal, G.cyl, [0, o.h / 2, 0], [0.07, o.h, 0.07], 0x3a3e42); box(a, M.metal, 0, o.h, 0.45, 0.08, 0.08, 1, 0x3a3e42);
    box(a, M.metal, 0, o.h - 0.1, 0.9, 0.35, 0.14, 0.6, 0x2a2e33); box(a, M.glow, 0, o.h - 0.18, 0.9, 0.3, 0.02, 0.5, o.color);
    L.glowAt(sub(a, 0, 0.9), o.h - 0.3, o.color, 2.4, 0.55); cyl(a, 0, 0, 0.12, o.h, { mount: false });
  });
  K('beacon', 'Warning beacon', STR, { color: 0xffa020 }, (a, o) => {
    part(a, M.metal, G.cyl, [0, 0.5, 0], [0.05, 1, 0.05], 0x3a3e42); part(a, M.glass, G.sphere, [0, 1.1, 0], [0.14, 0.18, 0.14], o.color); part(a, M.glow, G.sphere, [0, 1.1, 0], [0.08, 0.12, 0.08], o.color);
    L.glowAt(sub(a, 0, 0), 1.1, o.color, 1.8, 0.6);
  });
  K('cones', 'Traffic cones', STR, { n: 3 }, (a, o) => { for (let k = 0; k < Math.round(o.n); k++) { const x = (k - (o.n - 1) / 2) * 0.8, z = (R() - 0.5) * 0.3; part(a, M.paint, G.cone, [x, 0.36, z], [0.18, 0.7, 0.18], 0xff6010); part(a, M.paint, G.cyl, [x, 0.4, z], [0.13, 0.08, 0.13], 0xf0f0f0); box(a, M.paint, x, 0.02, z, 0.4, 0.04, 0.4, 0x1a1a1a); } }, { flat: true });
  K('sawhorse', 'Road barrier', STR, { len: 2 }, (a, o) => {
    for (const y of [0.9, 0.6]) for (let k = 0; k < Math.round(o.len / 0.3); k++) box(a, M.paint, -o.len / 2 + (k + 0.5) * o.len / Math.round(o.len / 0.3), y, 0, o.len / Math.round(o.len / 0.3), 0.18, 0.04, k % 2 ? 0xf0f0f0 : 0xe05010);
    for (const s of [-1, 1]) for (const d of [-1, 1]) box(a, M.paint, s * (o.len / 2 - 0.1), 0.5, d * 0.2, 0.06, 1.05, 0.06, 0xd0d0d0, [d * 0.35, 0]);
    part(a, M.glow, G.sphere, [-o.len / 2 + 0.15, 1.08, 0], [0.07, 0.07, 0.07], 0xffa020);
    sol(a, 0, 0, o.len, 0.5, 1.0, { bullets: false, mount: false });
  });
  K('bench', 'Bench', STR, {}, (a) => { for (const z of [-0.12, 0.05, 0.22]) box(a, M.paint, 0, 0.45, z, 1.8, 0.04, 0.15, vary(WOOD, 0.1)); box(a, M.paint, 0, 0.75, -0.22, 1.8, 0.35, 0.04, vary(WOOD, 0.1), [-0.2, 0]); for (const s of [-1, 1]) box(a, M.metal, s * 0.75, 0.3, 0, 0.06, 0.6, 0.5, 0x2a2a2a); sol(a, 0, 0, 1.8, 0.55, 0.5); });
  K('portaloo', 'Portable toilet', STR, { color: 0x3a6ab0 }, (a, o) => {
    box(a, M.paint, 0, 1.15, 0, 1.1, 2.3, 1.1, vary(o.color, 0.08)); part(a, M.paint, dome(), [0, 2.3, 0], [0.6, 0.15, 0.6], 0xe8e8e0);
    box(a, M.paint, 0, 1.1, 0.56, 0.9, 2.0, 0.02, col(o.color, 0.9)); box(a, M.paint, 0.3, 1.1, 0.58, 0.14, 0.05, 0.02, 0xc02020);
    sol(a, 0, 0, 1.1, 1.1, 2.3);
  });
  K('helipad', 'Helipad marking', STR, { r: 5 }, (a, o) => {
    part(a, M.paint, circle(), [0, 0.012, 0], [o.r, o.r, 1], 0x2a2c2e, [-Math.PI / 2, 0]); part(a, M.paint, ring(), [0, 0.016, 0], [o.r, o.r, 1], 0xe8e8e0, [-Math.PI / 2, 0]);
    for (const x of [-0.35, 0.35]) box(a, M.paint, x * o.r * 0.9, 0.018, 0, o.r * 0.14, 0.004, o.r * 0.9, YEL); box(a, M.paint, 0, 0.018, 0, o.r * 0.6, 0.004, o.r * 0.14, YEL);
    for (let k = 0; k < 8; k++) { const t = k / 8 * 6.28; part(a, M.glow, G.cyl, [Math.sin(t) * o.r, 0.05, Math.cos(t) * o.r], [0.1, 0.1, 0.1], 0x40ff60); }
  }, { flat: true });
  K('tentMil', 'Command tent', STR, { color: OLIVE }, (a, o) => {
    const c = vary(o.color, 0.08);
    for (const s of [-1, 1]) box(a, M.cloth, s * 1.25, 1.55, 0, 2.9, 0.05, 4.6, c, [0, s * 0.62]);
    box(a, M.cloth, 0, 0.8, -2.3, 3.8, 1.6, 0.05, c); for (const s of [-1, 1]) box(a, M.cloth, s * 2.35, 0.55, 0, 0.05, 1.1, 4.6, c);
    part(a, M.paint, G.cyl, [0, 1.35, 0], [0.04, 2.7, 0.04], 0x3a3a3a); box(a, M.paint, 0, 0.75, 0, 1.6, 0.06, 0.9, 0x5a4a3a); box(a, M.paint, 0, 0.78, 0, 1.2, 0.01, 0.7, 0xc8c0a0);
    for (const s of [-1, 1]) sol(a, s * 2.35, 0, 0.3, 4.6, 1.1, { mount: false, bullets: false }); sol(a, 0, -2.3, 4.6, 0.3, 1.6, { mount: false, bullets: false });
    L.glowAt(sub(a, 0, 0), 2.1, 0xffd080, 1.2, 0.4);
  });
  K('flagPole2', 'Flag', STR, { color: 0xc02020, h: 6 }, (a, o) => { part(a, M.metal, G.cyl, [0, o.h / 2, 0], [0.05, o.h, 0.05], 0xc8c8c0); box(a, M.cloth, 0.8, o.h - 0.6, 0, 1.5, 0.9, 0.02, o.color, [0, 0, 0.1]); box(a, M.stone, 0, 0.1, 0, 0.8, 0.2, 0.8, CON2); cyl(a, 0, 0, 0.1, o.h, { mount: false }); });

  // editor lists: every kit piece's category (the editor's Assets panel reads SD.kitMeta)
  for (const k of Object.keys(SD.kitMeta)) if (SD.kitMeta[k].flat) SD.FLAT.add(k);
})();
