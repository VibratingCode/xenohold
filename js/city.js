'use strict';
// Hesperus City renderer: skyscrapers, streets, props, signage, skyline. Static geometry is merged
// into the world's material buckets so the whole city costs a few dozen draw calls.
(function () {
  const U = XH.U;
  const CITY = XH.city = {};
  const KINDS = [['docks', 'neon', 'capitol'], ['market', 'downtown', 'park'], ['residential', 'metro', 'crater']];
  const cache = {};

  // ---------------- textures ----------------
  const STY = {
    glass: { base: '#1b2835', glass: '#1f3a4f', pad: 3, top: 4, bot: 7, lit: 0.34, lights: ['#c8ecff', '#fff2cc', '#9fd8ff'], rough: 0.25, metal: 0.65 },
    office: { base: '#686c72', glass: '#171d24', pad: 9, top: 14, bot: 16, lit: 0.3, lights: ['#ffe1a0', '#fff0c8', '#e8f0ff'], rough: 0.8, metal: 0.15, strip: true },
    brick: { base: '#6b3a29', glass: '#16120e', pad: 17, top: 12, bot: 22, lit: 0.26, lights: ['#ffcf88', '#ffe0a8'], rough: 0.9, metal: 0.05, brick: true, frame: '#d8d0c0' },
    warehouse: { base: '#4a5048', glass: '#1a2020', pad: 18, top: 8, bot: 44, lit: 0.08, lights: ['#ffe8b0'], rough: 0.7, metal: 0.45, ribs: true },
    neon: { base: '#231b2c', glass: '#120a18', pad: 8, top: 10, bot: 14, lit: 0.46, lights: ['#ff4fd8', '#4fd8ff', '#ffd84f', '#9f5fff', '#ff6040'], rough: 0.6, metal: 0.3 },
    ruin: { base: '#34302e', glass: '#050505', pad: 10, top: 12, bot: 16, lit: 0.03, lights: ['#ff7020'], rough: 0.95, metal: 0.05, broken: true },
  };
  function facade(style, seed) {
    const P = STY[style], r = U.rng(seed);
    const c = U.canvas(256), x = c.getContext('2d'), e = U.canvas(256), ex = e.getContext('2d');
    x.fillStyle = P.base; x.fillRect(0, 0, 256, 256);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
    if (P.brick) for (let y = 0; y < 256; y += 6) for (let bx = (y / 6) % 2 ? 0 : 6; bx < 256; bx += 12) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,220,200'},${0.05 + r() * 0.08})`; x.fillRect(bx, y, 11, 5); }
    if (P.ribs) for (let bx = 0; bx < 256; bx += 8) { x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(bx, 0, 3, 256); x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(bx + 4, 0, 2, 256); }
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.1})`; x.fillRect(r() * 256, r() * 256, 2 + r() * 5, 3 + r() * 14); }
    for (let f = 0; f < 4; f++) {
      if (P.ribs && f % 2) continue;
      for (let b = 0; b < 4; b++) {
        const wx = b * 64 + P.pad, wy = f * 64 + P.top, ww = 64 - P.pad * 2, wh = 64 - P.top - P.bot;
        if (P.broken && r() < 0.35) { x.fillStyle = '#0a0808'; x.beginPath(); x.moveTo(wx, wy + wh); x.lineTo(wx + ww * r(), wy); x.lineTo(wx + ww, wy + wh * r()); x.fill(); continue; }
        const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh); g.addColorStop(0, P.glass); g.addColorStop(0.6, shade(P.glass, 1.35)); g.addColorStop(1, P.glass);
        x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
        if (P.frame) { x.strokeStyle = P.frame; x.lineWidth = 2; x.strokeRect(wx, wy, ww, wh); x.fillStyle = P.frame; x.fillRect(wx, wy + wh / 2, ww, 1); }
        if (style === 'glass') { x.fillStyle = 'rgba(160,210,255,0.08)'; x.fillRect(wx, wy, ww * 0.3, wh); }
        if (r() < P.lit) {
          const col = P.lights[Math.floor(r() * P.lights.length)], blind = r();
          ex.fillStyle = col; ex.globalAlpha = 0.55 + r() * 0.45; ex.fillRect(wx + 2, wy + 2 + (blind > 0.7 ? wh * 0.4 : 0), ww - 4, wh - 4 - (blind > 0.7 ? wh * 0.4 : 0)); ex.globalAlpha = 1;
          x.fillStyle = col; x.globalAlpha = 0.45; x.fillRect(wx + 2, wy + 2, ww - 4, wh - 4); x.globalAlpha = 1;
          if (r() < 0.3) { x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(wx + ww * r(), wy + wh * 0.4, 5, wh * 0.6); }   // silhouette
        }
      }
      // floor slab
      x.fillStyle = shade(P.base, 0.75); x.fillRect(0, f * 64 + 58, 256, 6);
    }
    x.fillStyle = shade(P.base, 0.75); x.fillRect(0, 0, 6, 256);   // pillar (and the roof texel at the corner)
    const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
    return { map: mk(c), emi: mk(e) };
  }
  function shade(hex, k) { const c = new THREE.Color(hex).multiplyScalar(k); return '#' + c.getHexString(); }
  function storefrontTex() {
    const c = U.canvas(512, 128), x = c.getContext('2d');
    const awn = ['#c02040', '#20a0c0', '#e0a020', '#40c060', '#8040c0', '#e05020'];
    for (let s = 0; s < 4; s++) {
      const x0 = s * 128;
      x.fillStyle = '#1a1c20'; x.fillRect(x0, 0, 128, 128);
      x.fillStyle = awn[(s * 7) % awn.length]; x.fillRect(x0 + 4, 0, 120, 22);
      for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(x0 + 4 + k * 20, 0, 10, 22); }
      const lit = s % 3 !== 1;
      const g = x.createLinearGradient(0, 30, 0, 124); g.addColorStop(0, lit ? '#fff0c8' : '#101418'); g.addColorStop(1, lit ? '#c08040' : '#060808');
      x.fillStyle = g; x.fillRect(x0 + 8, 30, 72, 90);
      x.fillStyle = '#0a0a0a'; x.fillRect(x0 + 88, 34, 32, 90);
      if (lit) for (let k = 0; k < 5; k++) { x.fillStyle = `hsl(${Math.random() * 360},70%,55%)`; x.fillRect(x0 + 14 + k * 13, 95 - Math.random() * 20, 9, 25); }
      x.strokeStyle = '#555'; x.lineWidth = 3; x.strokeRect(x0 + 8, 30, 72, 90);
      if (s === 2) { x.strokeStyle = 'rgba(20,20,24,0.85)'; x.lineWidth = 1.5; for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28 + Math.random() * 0.4; x.beginPath(); x.moveTo(x0 + 48, 70); x.lineTo(x0 + 48 + Math.cos(a) * 60, 70 + Math.sin(a) * 60); x.stroke(); } x.fillStyle = 'rgba(0,0,0,0.75)'; x.beginPath(); x.arc(x0 + 48, 70, 9, 0, 7); x.fill(); } // smashed
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
  }
  const H_SIGNS = [['RAMEN 24H', '#ff4fd8'], ['HOTEL LUXE', '#4fd8ff'], ['XENO-KOLA', '#ff4040'], ['PAWN & GUNS', '#ffd84f'], ['CYBERDECK', '#8fff6f'], ['BAR', '#ff8f3f'], ['CLINIC', '#6fffd8'], ['ARCADE', '#c05fff']];
  const V_SIGNS = [['HOTEL', '#4fd8ff'], ['NEON', '#ff4fd8'], ['SAKE', '#ffd84f'], ['LIVE', '#ff5050'], ['BAR', '#8fff6f'], ['OPEN', '#6fd8ff'], ['VOID', '#c05fff'], ['DINER', '#ff9f3f']];
  const ADS = [['XENO-KOLA', 'Taste the frontier', '#ff3040', '#200408'], ['HESPERUS SYNTHETICS', 'Better than human', '#40d8ff', '#04141c'], ['NEURAL+', 'Think faster. Feel less.', '#c060ff', '#12041c'], ['JOIN THE COLONIAL GUARD', 'Someone has to.', '#ffd040', '#1c1404'], ['NOODLE MOON', 'Open 24/7 · Always', '#ff8030', '#1c0a04'], ['STAY INDOORS', 'Quarantine in effect', '#ff2020', '#140000'], ['EVAC SHUTTLES', 'All departures: CANCELLED', '#ffffff', '#101010'], ['HIVE? WHAT HIVE?', 'Hesperus Tourism Board', '#60ff90', '#04140a']];
  function signAtlas() {
    const c = U.canvas(1024), x = c.getContext('2d');
    x.clearRect(0, 0, 1024, 1024);
    H_SIGNS.forEach(([t, col], i) => {
      const x0 = (i % 2) * 512, y0 = Math.floor(i / 2) * 128;
      x.fillStyle = 'rgba(8,4,12,0.92)'; x.fillRect(x0 + 6, y0 + 6, 500, 116);
      x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 18; x.strokeRect(x0 + 12, y0 + 12, 488, 104);
      x.fillStyle = col; x.font = 'bold 64px Orbitron, Consolas, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, x0 + 256, y0 + 68); x.shadowBlur = 0;
    });
    V_SIGNS.forEach(([t, col], i) => {
      const x0 = i * 128, y0 = 512;
      x.fillStyle = 'rgba(8,4,12,0.92)'; x.fillRect(x0 + 6, y0 + 6, 116, 500);
      x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 16; x.strokeRect(x0 + 12, y0 + 12, 104, 488);
      x.fillStyle = col; x.font = 'bold 70px Orbitron, Consolas, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const step = 470 / t.length; [...t].forEach((ch, k) => x.fillText(ch, x0 + 64, y0 + 30 + step * (k + 0.5)));
      x.shadowBlur = 0;
    });
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function adAtlas() {
    const c = U.canvas(1024), x = c.getContext('2d');
    ADS.forEach(([t, sub, col, bg], i) => {
      const x0 = (i % 2) * 512, y0 = Math.floor(i / 2) * 256;
      const g = x.createLinearGradient(x0, y0, x0 + 512, y0 + 256); g.addColorStop(0, bg); g.addColorStop(1, shade(col, 0.25));
      x.fillStyle = g; x.fillRect(x0, y0, 512, 256);
      x.strokeStyle = col; x.lineWidth = 8; x.strokeRect(x0 + 8, y0 + 8, 496, 240);
      x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 20; x.textAlign = 'center';
      x.font = `bold ${t.length > 14 ? 40 : 60}px Orbitron, Consolas, monospace`; x.fillText(t, x0 + 256, y0 + 120);
      x.shadowBlur = 0; x.fillStyle = '#ffffff'; x.font = '28px Rajdhani, Consolas, sans-serif'; x.fillText(sub, x0 + 256, y0 + 180);
      for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.4})`; x.fillRect(x0 + Math.random() * 512, y0 + Math.random() * 256, Math.random() * 30, 3); }
    });
    return new THREE.CanvasTexture(c);
  }
  let sidewalkTex = null; // painted once and kept for every rebuild
  function paintMats() {
    return {
      paint: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
      sidewalk: new THREE.MeshStandardMaterial({ color: 0x8c8a86, vertexColors: true, roughness: 0.9, map: sidewalkTex || (sidewalkTex = U.tex(U.paint(128, (u, v, x, y) => { const n = U.fbm(u * 6, v * 6, 3, 6); let b = 120 + n * 40; if (x % 64 < 2 || y % 64 < 2) b -= 45; return [b, b * 0.98, b * 0.95]; }))), polygonOffset: true, polygonOffsetFactor: -1 }),
      glowV: new THREE.MeshBasicMaterial({ vertexColors: true }),
      additive: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      pool: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
      carPaint: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.35, metalness: 0.6 }),
      carGlass: new THREE.MeshStandardMaterial({ color: 0x10161c, roughness: 0.1, metalness: 0.8 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }),
      foliage: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, flatShading: true }),
      bark: new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.95 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x8a8884, vertexColors: true, roughness: 0.9 }),
      water: new THREE.MeshStandardMaterial({ color: 0x2a6a8a, emissive: 0x0a2a40, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.85 }),
    };
  }

  // ---------------- geometry helpers ----------------
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  // position (ox,oy,oz) in a local frame rotated by ry about (cx,cz); extra local rotation (rx,rz) applied before the yaw
  function lm(cx, cz, ry, ox, oy, oz, sx, sy, sz, rx = 0, rz = 0, ryl = 0) {
    const c = Math.cos(ry), s = Math.sin(ry);
    _p.set(cx + ox * c + oz * s, oy, cz - ox * s + oz * c);
    _e.set(rx, ry + ryl, rz, 'YXZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }
  function bldGeo(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, 0.008, 0.008); continue; }
      const span = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * span / 10, uv.getY(i) * h / 12);
    }
    return g;
  }
  function uvRect(g, u0, v0, u1, v1) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); return g; }

  // =====================================================================
  CITY.build = (c) => {
    const { rows, B, MAT, G, rnd, chAt, root, CELL, H, Wd, W } = c;
    const PM = paintMats();
    // facade materials (two variants per style so the lit-window pattern doesn't tile)
    const FAC = {};
    for (const st of Object.keys(STY)) FAC[st] = [0, 1].map((v) => {
      const key = st + v; if (!cache[key]) cache[key] = facade(st, 101 + v * 37 + st.length * 11);
      const T = cache[key], P = STY[st];
      return new THREE.MeshStandardMaterial({ map: T.map, emissiveMap: T.emi, emissive: 0xffffff, emissiveIntensity: 0.95, roughness: P.rough, metalness: P.metal, vertexColors: true });
    });
    if (!cache.store) cache.store = storefrontTex();
    const storeMat = new THREE.MeshStandardMaterial({ map: cache.store, emissiveMap: cache.store, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.5, vertexColors: true });
    if (!cache.signs) cache.signs = signAtlas();
    const signMat = new THREE.MeshBasicMaterial({ map: cache.signs, transparent: true });
    if (!cache.ads) cache.ads = adAtlas();
    const adMat = new THREE.MeshBasicMaterial({ map: cache.ads, color: 0xdddddd });
    const idx = (x, z) => z * Wd + x;
    const bx2w = (bx) => bx * CELL - W.ox, bz2w = (bz) => bz * CELL - W.oz;
    const isBld = (x, z) => W.bldCells.has(idx(x, z)) || x < 0 || z < 0 || x >= Wd || z >= H;
    const district = (cx, cz) => {
      const dx = Math.max(0, Math.min(2, Math.floor((cx - 2) / 32))), dy = Math.max(0, Math.min(2, Math.floor((cz - 2) / 32)));
      return { kind: KINDS[dy][dx], lx: cx - 2 - dx * 32, ly: cz - 2 - dy * 32, dx, dy };
    };
    const isFloor = (x, z) => '.SP&?H'.includes(chAt(x, z));
    const tint = (base, v = 0.12) => new THREE.Color(base).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * v);

    // ------------------------------------------------ buildings
    const blds = W.buildings.map((b) => ({ x: b[0], z: b[1], w: b[2], d: b[3], h: b[4], style: b[5] }));
    for (const b of blds) {
      const w = b.w * CELL, d = b.d * CELL, cx = bx2w(b.x) + w / 2, cz = bz2w(b.z) + d / 2;
      const mat = FAC[b.style][Math.floor(rnd() * 2)];
      B.add(mat, bldGeo(w, b.h, d), U.mat(cx, b.h / 2, cz), tint(0xffffff, 0.2));
      b.cx = cx; b.cz = cz; b.W = w; b.D = d;
      // parapet
      for (const [ox, oz, sx, sz] of [[0, -d / 2, w, 0.35], [0, d / 2, w, 0.35], [-w / 2, 0, 0.35, d], [w / 2, 0, 0.35, d]]) B.add(MAT.trim, G.box, U.mat(cx + ox, b.h + 0.4, cz + oz, 0, 0, 0, sx + 0.1, 0.8, sz + 0.1));
      roof(b);
      if (b.x < 0 || b.z < 0 || b.x >= Wd || b.z >= H) continue;   // skyline filler outside the arena: no street dressing
      streetDressing(b);
    }
    function roof(b) {
      const { cx, cz, W: w, D: d, h } = b;
      if (b.style === 'ruin') {
        for (let k = 0; k < 5; k++) { const hh = 1 + rnd() * 4; B.add(FAC.ruin[0], bldGeo(w * (0.2 + rnd() * 0.3), hh, d * (0.2 + rnd() * 0.3)), U.mat(cx + (rnd() - 0.5) * w * 0.6, h + hh / 2, cz + (rnd() - 0.5) * d * 0.6), tint(0x999999)); }
        for (let k = 0; k < 8; k++) B.add(MAT.dark, G.cyl, U.mat(cx + (rnd() - 0.5) * w, h + 1, cz + (rnd() - 0.5) * d, (rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6, 0.03, 2 + rnd() * 2, 0.03));
        return;
      }
      if (b.style === 'warehouse') {
        const n = Math.max(2, Math.floor(w / 6));
        for (let k = 0; k < n; k++) B.add(MAT.corr, new THREE.CylinderGeometry(0.01, 1.8, d * 0.9, 3, 1), U.mat(cx - w / 2 + (k + 0.5) * w / n, h + 0.9, cz, Math.PI / 2, 0, 0, 1, 1, 1), new THREE.Color(0x707a70));
        if (rnd() < 0.7) crane(b);
        return;
      }
      // AC units & vents
      const n = 2 + Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) { const sx = 1 + rnd() * 2, sz = 1 + rnd() * 2; B.add(MAT.trim, G.box, U.mat(cx + (rnd() - 0.5) * (w - 3), h + 0.6, cz + (rnd() - 0.5) * (d - 3), 0, 0, 0, sx, 1.2, sz)); }
      if (b.style === 'brick' && rnd() < 0.6) waterTower(cx + (rnd() - 0.5) * w * 0.4, h, cz + (rnd() - 0.5) * d * 0.4);
      if (h > 42) {
        // crown: neon band + antenna with aircraft warning light
        const col = new THREE.Color(U.pick([0x40d8ff, 0xff4fd8, 0xffffff, 0x60ff90]));
        for (const [ox, oz, sx, sz] of [[0, -d / 2 - 0.06, w, 0.1], [0, d / 2 + 0.06, w, 0.1], [-w / 2 - 0.06, 0, 0.1, d], [w / 2 + 0.06, 0, 0.1, d]]) B.add(PM.glowV, G.box, U.mat(cx + ox, h - 1.5, cz + oz, 0, 0, 0, sx, 0.35, sz), col);
        if (b.style === 'glass' && rnd() < 0.6) { B.add(FAC.glass[0], new THREE.CylinderGeometry(0.2, Math.min(w, d) * 0.35, h * 0.18, 4), U.mat(cx, h + h * 0.09, cz, 0, Math.PI / 4, 0)); }
        const ah = 6 + rnd() * 10;
        B.add(MAT.trim, G.cyl, U.mat(cx + w * 0.2, h + ah / 2, cz - d * 0.2, 0, 0, 0, 0.12, ah, 0.12));
        B.add(PM.glowV, G.sphere, U.mat(cx + w * 0.2, h + ah + 0.2, cz - d * 0.2, 0, 0, 0, 0.35, 0.35, 0.35), new THREE.Color(0xff2010));
        for (const [ox, oz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) B.add(PM.glowV, G.sphere, U.mat(cx + ox, h + 0.9, cz + oz, 0, 0, 0, 0.18, 0.18, 0.18), new THREE.Color(0xff2010));
        if (h > 60 && rnd() < 0.5) { // helipad
          B.add(MAT.dark, G.cyl, U.mat(cx, h + 0.9, cz, 0, 0, 0, Math.min(w, d) * 0.35, 0.2, Math.min(w, d) * 0.35));
          B.add(PM.paint, new THREE.RingGeometry(Math.min(w, d) * 0.28, Math.min(w, d) * 0.31, 32), U.mat(cx, h + 1.01, cz, -Math.PI / 2, 0, 0), new THREE.Color(0xe0e0e0));
        }
      } else if ((b.style === 'neon' || b.style === 'office') && rnd() < 0.55 && w > 7) billboard(b);
    }
    function waterTower(x, h, z) {
      for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) B.add(MAT.trim, G.cyl, U.mat(x + ox, h + 1.5, z + oz, 0, 0, 0, 0.08, 3, 0.08));
      B.add(PM.concrete, G.cyl, U.mat(x, h + 4.2, z, 0, 0, 0, 1.4, 2.6, 1.4), new THREE.Color(0x6a4a30));
      B.add(PM.concrete, new THREE.ConeGeometry(1.5, 1, 12), U.mat(x, h + 6, z), new THREE.Color(0x4a3a2a));
    }
    function billboard(b) {
      const { cx, cz, W: w, h } = b, bw = Math.min(w * 0.8, 14), bh = bw / 2, face = rnd() < 0.5 ? 1 : -1;
      const z = cz + face * b.D * 0.25;
      for (const ox of [-bw * 0.4, bw * 0.4]) B.add(MAT.trim, G.box, U.mat(cx + ox, h + 2, z, 0, 0, 0, 0.25, 4, 0.25));
      B.add(MAT.dark, G.box, U.mat(cx, h + 4 + bh / 2, z, 0, 0, 0, bw + 0.4, bh + 0.4, 0.3));
      const i = Math.floor(rnd() * ADS.length), u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) * 0.25;
      B.add(adMat, uvRect(new THREE.PlaneGeometry(1, 1), u0, v1 - 0.25, u0 + 0.5, v1), U.mat(cx, h + 4 + bh / 2, z + face * 0.17, 0, face > 0 ? 0 : Math.PI, 0, bw, bh, 1));
    }
    function crane(b) {
      const { cx, cz, W: w, h } = b, x = cx - w * 0.3, z = cz, th = 18 + rnd() * 8;
      for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) B.add(MAT.hazard, G.box, U.mat(x + ox, h + th / 2, z + oz, 0, 0, 0, 0.18, th, 0.18));
      for (let k = 1; k < 8; k++) B.add(MAT.hazard, G.box, U.mat(x, h + k * th / 8, z - 0.6, 0, 0, (k % 2 ? 1 : -1) * 0.7, 0.08, 1.9, 0.08));
      const ry = rnd() * Math.PI * 2, len = 16 + rnd() * 6;
      B.add(MAT.hazard, G.box, lm(x, z, ry, len / 2 - 4, h + th + 0.6, 0, len, 0.9, 0.9));
      B.add(MAT.trim, G.box, lm(x, z, ry, -3.5, h + th + 0.3, 0, 2.2, 1.6, 1.6));
      B.add(MAT.dark, G.cyl, lm(x, z, ry, len - 6, h + th - 5, 0, 0.03, 10, 0.03));
      B.add(PM.glowV, G.sphere, lm(x, z, ry, len - 4, h + th + 1.1, 0, 0.25, 0.25, 0.25), new THREE.Color(0xff2010));
    }
    function streetDressing(b) {
      const { cx, cz, W: w, D: d } = b;
      const dist = district(b.x + Math.floor(b.w / 2), b.z + Math.floor(b.d / 2));
      const shoppy = ['downtown', 'neon', 'market', 'metro', 'capitol'].includes(dist.kind) && b.h >= 8 && b.style !== 'warehouse';
      // for each side, find a street-facing run at the side midpoint
      const sides = [[0, -1, w, [0, -d / 2]], [0, 1, w, [0, d / 2]], [-1, 0, d, [-w / 2, 0]], [1, 0, d, [w / 2, 0]]];
      for (const [nx, nz, len, [ox, oz]] of sides) {
        const mx = nx === 0 ? b.x + Math.floor(b.w / 2) : nx < 0 ? b.x - 1 : b.x + b.w;
        const mz = nz === 0 ? b.z + Math.floor(b.d / 2) : nz < 0 ? b.z - 1 : b.z + b.d;
        if (!isFloor(mx, mz)) continue;
        const ry = Math.atan2(nx, nz), fx = cx + ox, fz = cz + oz;
        if (shoppy && len > 5) {
          const g = new THREE.PlaneGeometry(len - 0.6, 3.6), uv = g.attributes.uv, u0 = Math.floor(rnd() * 4) * 0.25; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * Math.max(1, Math.round((len - 0.6) / 2.6)) * 0.25 + u0);
          B.add(storeMat, g, U.mat(fx + nx * 0.05, 1.8, fz + nz * 0.05, 0, ry, 0), tint(0xffffff, 0.3));
          B.add(MAT.trim, G.box, U.mat(fx + nx * 0.3, 3.75, fz + nz * 0.3, 0, ry, 0, len - 0.4, 0.15, 0.6));
          if (rnd() < 0.55) { // horizontal shop sign
            const i = Math.floor(rnd() * H_SIGNS.length), u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) * 0.125;
            B.add(signMat, uvRect(new THREE.PlaneGeometry(1, 1), u0, v1 - 0.125, u0 + 0.5, v1), U.mat(fx + nx * 0.1, 4.5, fz + nz * 0.1, 0, ry, 0, Math.min(5, len - 1), 1.25, 1));
          }
          if (b.h > 14 && rnd() < 0.45) { // vertical blade sign sticking out from the corner
            const i = Math.floor(rnd() * V_SIGNS.length), u0 = i * 0.125;
            const tx = nz !== 0 ? 1 : 0, tz = nx !== 0 ? 1 : 0, off = len / 2 - 0.8;
            for (const sd of [1, -1]) B.add(signMat, uvRect(new THREE.PlaneGeometry(1, 1), u0, 0, u0 + 0.125, 0.5), U.mat(fx + tx * off + nx * 0.9, 9, fz + tz * off + nz * 0.9, 0, ry + sd * Math.PI / 2, 0, 1.3, 5.2, 1));
            B.add(MAT.trim, G.box, U.mat(fx + tx * off + nx * 0.9, 11.7, fz + tz * off + nz * 0.9, 0, ry, 0, 0.1, 0.2, 1.8));
          }
        }
        // fire escape ladders on brick buildings
        if (b.style === 'brick' && rnd() < 0.5 && b.h > 9) {
          for (let y = 3.5; y < b.h - 1; y += 3) { B.add(MAT.dark, G.box, U.mat(fx + nx * 0.7, y, fz + nz * 0.7, 0, ry, 0, 2.4, 0.08, 1.2)); B.add(MAT.dark, G.box, U.mat(fx + nx * 1.25, y + 0.5, fz + nz * 1.25, 0, ry, 0, 2.4, 0.9, 0.05)); }
        }
      }
    }

    // ------------------------------------------------ skybridges between towers
    let bridges = 0;
    for (let i = 0; i < blds.length && bridges < 8; i++) for (let j = i + 1; j < blds.length && bridges < 8; j++) {
      const a = blds[i], b = blds[j];
      if (a.h < 28 || b.h < 28 || a.x < 0 || b.x < 0 || a.z < 0 || b.z < 0 || a.x >= Wd || b.x >= Wd) continue;
      const ox0 = Math.max(a.x, b.x), ox1 = Math.min(a.x + a.w, b.x + b.w), oz0 = Math.max(a.z, b.z), oz1 = Math.min(a.z + a.d, b.z + b.d);
      const y = Math.min(a.h, b.h) * (0.45 + rnd() * 0.3);
      if (ox1 - ox0 >= 2) { const gap0 = Math.min(a.z + a.d, b.z + b.d), gap1 = Math.max(a.z, b.z); if (gap1 - gap0 >= 2 && gap1 - gap0 <= 6) { const x = bx2w((ox0 + ox1) / 2), z0 = bz2w(gap0), z1 = bz2w(gap1); B.add(FAC.glass[1], bldGeo(3, 3, z1 - z0), U.mat(x, y, (z0 + z1) / 2)); bridges++; } }
      else if (oz1 - oz0 >= 2) { const gap0 = Math.min(a.x + a.w, b.x + b.w), gap1 = Math.max(a.x, b.x); if (gap1 - gap0 >= 2 && gap1 - gap0 <= 6) { const z = bz2w((oz0 + oz1) / 2), x0 = bx2w(gap0), x1 = bx2w(gap1); B.add(FAC.glass[1], bldGeo(x1 - x0, 3, 3), U.mat((x0 + x1) / 2, y, z)); bridges++; } }
    }

    // ------------------------------------------------ streets: sidewalks, curbs, markings, lights
    const side = new Uint8Array(Wd * H);
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      if (!isFloor(x, z)) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (W.bldCells.has(idx(x + dx, z + dz))) { side[idx(x, z)] = 1; break; }
    }
    const flat = (x, z, y, sx = CELL, sz = CELL) => U.mat(W.cx2x(x), y, W.cz2z(z), -Math.PI / 2, 0, 0, sx, sz, 1);
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      if (!side[idx(x, z)]) continue;
      B.add(PM.sidewalk, G.plane, flat(x, z, 0.014), tint(0xffffff, 0.1));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!isFloor(x + dx, z + dz) || side[idx(x + dx, z + dz)]) continue;
        B.add(PM.concrete, G.box, U.mat(W.cx2x(x) + dx * CELL / 2, 0.07, W.cz2z(z) + dz * CELL / 2, 0, 0, 0, dx ? 0.2 : CELL, 0.14, dz ? 0.2 : CELL), new THREE.Color(0xb0aca4));
      }
    }
    const yellow = new THREE.Color(0xd8b020), white = new THREE.Color(0xd8d8d0);
    const lamps = [];
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const kind = KINDS[dy][dx], x0 = 2 + dx * 32, z0 = 2 + dy * 32;
      if (kind === 'park') continue;
      for (let t = 0; t < 30; t++) {
        const inter = t >= 12 && t <= 17;
        // horizontal avenue (rows 13..16), vertical avenue (cols 13..16)
        for (const [ax, az, alongX] of [[x0 + t, null, true], [null, z0 + t, false]]) {
          if (inter) continue;
          const cx = alongX ? ax : x0 + 14, cz = alongX ? z0 + 14 : az;
          if (!isFloor(cx, cz) && chAt(cx, cz) !== '=') continue;
          const wx = alongX ? W.cx2x(ax) : W.cx2x(x0 + 14) + CELL / 2, wz = alongX ? W.cz2z(z0 + 14) + CELL / 2 : W.cz2z(az);
          // double yellow center line
          for (const off of [-0.12, 0.12]) B.add(PM.paint, G.plane, U.mat(wx + (alongX ? 0 : off), 0.018, wz + (alongX ? off : 0), -Math.PI / 2, 0, alongX ? 0 : Math.PI / 2, CELL, 0.1, 1), yellow);
          // white lane dashes
          if (t % 2 === 0) for (const off of [-CELL, CELL]) B.add(PM.paint, G.plane, U.mat(wx + (alongX ? 0 : off), 0.018, wz + (alongX ? off : 0), -Math.PI / 2, 0, alongX ? 0 : Math.PI / 2, CELL * 0.55, 0.12, 1), white);
        }
      }
      // crosswalks at the four approaches to the intersection
      for (const [cx, cz, alongX] of [[x0 + 12, z0 + 14, false], [x0 + 17, z0 + 14, false], [x0 + 14, z0 + 12, true], [x0 + 14, z0 + 17, true]]) {
        const wx = W.cx2x(cx) + (alongX ? CELL / 2 : 0), wz = W.cz2z(cz) + (alongX ? 0 : CELL / 2);
        for (let k = -4; k <= 4; k++) B.add(PM.paint, G.plane, U.mat(wx + (alongX ? k * 1.1 : 0), 0.019, wz + (alongX ? 0 : k * 1.1), -Math.PI / 2, 0, alongX ? Math.PI / 2 : 0, 2.2, 0.55, 1), white);
      }
      // streetlights along the avenue sidewalks
      for (const t of [2, 7, 22, 27]) for (const [cx, cz, nx, nz] of [[x0 + t, z0 + 12, 0, 1], [x0 + t, z0 + 17, 0, -1], [x0 + 12, z0 + t, 1, 0], [x0 + 17, z0 + t, -1, 0]]) {
        if (!isFloor(cx, cz)) continue;
        lamps.push([W.cx2x(cx) - nx * 0.9, W.cz2z(cz) - nz * 0.9, nx, nz, kind]);
      }
      // traffic lights at the intersection corners
      for (const [cx, cz] of [[x0 + 12, z0 + 12], [x0 + 17, z0 + 12], [x0 + 12, z0 + 17], [x0 + 17, z0 + 17]]) {
        if (!isFloor(cx, cz) || kind === 'downtown') continue;
        const x = W.cx2x(cx), z = W.cz2z(cz);
        B.add(MAT.dark, G.cyl, U.mat(x, 2.4, z, 0, 0, 0, 0.09, 4.8, 0.09)); W.addProp(x, z, 0.14, 0.14, 4.8);
        B.add(MAT.dark, G.box, U.mat(x, 4.3, z, 0, 0, 0, 0.35, 1.0, 0.35));
        [0xff2010, 0xffb020, 0x30ff60].forEach((col, k) => B.add(PM.glowV, G.sphere, U.mat(x + 0.18, 4.62 - k * 0.3, z, 0, 0, 0, 0.1, 0.1, 0.1), new THREE.Color(col).multiplyScalar(k === (cx + cz) % 3 ? 1 : 0.15)));
      }
    }
    const shaftTex = (() => { const cv = U.canvas(4, 64), x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 64); const t = new THREE.CanvasTexture(cv); t.userData = { transient: true }; return t; })();
    PM.additive.map = shaftTex;
    const poolTex = XH.fx.softTex; PM.pool.map = poolTex;
    const shaftGeo = new THREE.CylinderGeometry(0.15, 2.4, 5.6, 14, 1, true);
    for (const [x, z, nx, nz, kind] of lamps) {
      const col = new THREE.Color(kind === 'neon' ? 0xff80e0 : kind === 'crater' ? 0xff6040 : 0xffd8a0);
      const hx = x + nx * 1.4, hz = z + nz * 1.4;
      B.add(MAT.dark, G.cyl, U.mat(x, 3.2, z, 0, 0, 0, 0.09, 6.4, 0.09)); W.addProp(x, z, 0.14, 0.14, 6.4);
      B.add(MAT.dark, G.box, U.mat(x + nx * 0.7, 6.3, z + nz * 0.7, 0, Math.atan2(nx, nz), 0, 0.1, 0.1, 1.5));
      B.add(MAT.dark, G.box, U.mat(hx, 6.2, hz, 0, 0, 0, 0.5, 0.18, 0.5));
      B.add(PM.glowV, G.box, U.mat(hx, 6.08, hz, 0, 0, 0, 0.4, 0.06, 0.4), col);
      B.add(PM.additive, shaftGeo, U.mat(hx, 3.2, hz), col);
      B.add(PM.pool, new THREE.CircleGeometry(2.6, 16), U.mat(hx, 0.02, hz, -Math.PI / 2, 0, 0), col);
    }

    // park: benches and globe lamps along the footpaths
    {
      const px0 = 2 + 2 * 32, pz0 = 2 + 32, wood = new THREE.Color(0x6a4428), warm = new THREE.Color(0xffe0a8);
      for (let z = pz0; z < pz0 + 30; z++) for (let x = px0; x < px0 + 30; x++) {
        if (chAt(x, z) !== '.') continue;
        const gd = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => chAt(x + dx, z + dz) === ',');
        if (!gd) continue;
        const [gx, gz] = gd, h = (x * 7 + z * 13) % 11, ry = Math.atan2(gx, gz);
        const wx = W.cx2x(x) + gx * CELL * 0.4, wz = W.cz2z(z) + gz * CELL * 0.4;
        if (h === 0) {
          B.add(MAT.dark, G.cyl, U.mat(wx, 1.8, wz, 0, 0, 0, 0.07, 3.6, 0.07)); W.addProp(wx, wz, 0.18, 0.18, 4);
          B.add(MAT.dark, G.cyl, U.mat(wx, 0.15, wz, 0, 0, 0, 0.18, 0.3, 0.18));
          B.add(PM.glowV, G.sphere, U.mat(wx, 3.85, wz, 0, 0, 0, 0.32, 0.32, 0.32), warm);
          B.add(MAT.dark, G.cyl, U.mat(wx, 4.2, wz, 0, 0, 0, 0.2, 0.08, 0.2));
          B.add(PM.pool, new THREE.CircleGeometry(2.4, 16), U.mat(wx, 0.02, wz, -Math.PI / 2, 0, 0), warm);
        } else if (h === 5 || h === 8) {
          B.add(PM.carPaint, G.box, lm(wx, wz, ry, 0, 0.45, 0, 0.5, 0.07, 1.7), wood); W.addPropRot(wx, wz, 1.7, 0.6, ry + Math.PI / 2, 0.95, { bullets: false });
          B.add(PM.carPaint, G.box, lm(wx, wz, ry, 0.22, 0.78, 0, 0.06, 0.4, 1.7), wood);
          for (const oz of [-0.7, 0.7]) B.add(MAT.dark, G.box, lm(wx, wz, ry, 0.05, 0.22, oz, 0.5, 0.45, 0.07));
        } else if (h === 3) {
          B.add(MAT.dark, G.cyl, U.mat(wx, 0.45, wz, 0, 0, 0, 0.25, 0.9, 0.25)); W.addProp(wx, wz, 0.26, 0.26, 0.9, { bullets: false });
          B.add(PM.foliage, G.sphere, U.mat(wx, 0.95, wz, 0, 0, 0, 0.22, 0.12, 0.22), new THREE.Color(0.25, 0.3, 0.2));
        }
      }
    }

    // ------------------------------------------------ props from grid clusters
    const cl = (ch) => W.clusters(ch);
    const carCols = [0x9a2020, 0x204a8a, 0xd0d0d0, 0x202020, 0xc09020, 0x2a6a3a, 0x6a6a70, 0x7a3a8a];
    const burning = [];
    for (const k of cl('=')) {
      const cx0 = W.cellX(k.x), cz0 = W.cellZ(k.z), dist = district(cx0, cz0);
      if (k.cells === 2 && dist.kind !== 'crater') car(k.x, k.z, k.w > k.d, dist.kind);
      else if (dist.kind === 'metro') { W.addProp(k.x, k.z, k.w / 2, k.d * 0.45, 1.1); B.add(PM.concrete, G.box, U.mat(k.x, 0.55, k.z, 0, 0, 0, k.w, 1.1, k.d * 0.9), new THREE.Color(0x9a9890)); B.add(PM.paint, G.box, U.mat(k.x, 1.11, k.z, 0, 0, 0, k.w, 0.02, k.d * 0.95), yellow); }
      else if (dist.kind === 'crater') { W.addCyl(k.x, k.z, Math.max(k.w, k.d) * 0.42, 1.1); for (let i = 0; i < 4; i++) B.add(MAT.concrete, U.jitter(new THREE.DodecahedronGeometry(0.9, 0), 0.4, rnd), U.mat(k.x + (rnd() - 0.5) * k.w * 0.6, 0.4, k.z + (rnd() - 0.5) * k.d * 0.6, rnd(), rnd() * 3, rnd())); }
      else { // planter with shrub
        B.add(PM.concrete, G.box, U.mat(k.x, 0.5, k.z, 0, 0, 0, k.w * 0.95, 1.0, k.d * 0.95), new THREE.Color(0xa8a49a)); W.addProp(k.x, k.z, k.w * 0.475, k.d * 0.475, 1.0);
        for (let i = 0; i < 3; i++) B.add(PM.foliage, new THREE.IcosahedronGeometry(0.7, 0), U.mat(k.x + (rnd() - 0.5) * k.w * 0.6, 1.3, k.z + (rnd() - 0.5) * k.d * 0.5), new THREE.Color(0.18, 0.35 + rnd() * 0.15, 0.14));
      }
    }
    function car(x, z, alongX, kind) {
      const ry = (alongX ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.25 + (rnd() < 0.5 ? Math.PI : 0);
      const burnt = rnd() < 0.3, col = burnt ? new THREE.Color(0x1a1614) : new THREE.Color(U.pick(carCols));
      const tilt = rnd() < 0.15 ? (rnd() - 0.5) * 0.3 : 0;
      W.addPropRot(x, z, 4.4, 1.9, ry, 1.0); W.addPropRot(x, z, 2.3, 1.75, ry, 1.48, { y0: 0.9 });
      B.add(PM.carPaint, G.box, lm(x, z, ry, 0, 0.62, 0, 4.4, 0.72, 1.9, 0, tilt), col);
      B.add(PM.carPaint, G.box, lm(x, z, ry, -0.25, 1.2, 0, 2.3, 0.55, 1.75, 0, tilt), col);
      B.add(PM.carGlass, G.box, lm(x, z, ry, -0.25, 1.2, 0, 2.2, 0.48, 1.78, 0, tilt));
      B.add(PM.carGlass, G.box, lm(x, z, ry, -0.25, 1.2, 0, 2.34, 0.44, 1.6, 0, tilt));
      for (const [ox, oz] of [[1.35, 0.9], [-1.35, 0.9], [1.35, -0.9], [-1.35, -0.9]]) B.add(PM.rubber, G.cyl, lm(x, z, ry, ox, 0.36, oz, 0.36, 0.26, 0.36, Math.PI / 2));
      if (!burnt) { for (const oz of [-0.65, 0.65]) { B.add(PM.glowV, G.box, lm(x, z, ry, 2.2, 0.72, oz, 0.04, 0.14, 0.34), new THREE.Color(rnd() < 0.5 ? 0xfff0c0 : 0x404040)); B.add(PM.glowV, G.box, lm(x, z, ry, -2.2, 0.72, oz, 0.04, 0.12, 0.3), new THREE.Color(0xa01010)); } }
      else burning.push(new THREE.Vector3(x, 1.2, z));
      void kind;
    }
    for (const k of cl('x')) {
      if (rnd() < 0.6) { const ry = rnd(); B.add(PM.carPaint, G.box, U.mat(k.x, 0.65, k.z, 0, ry, 0, 1.8, 1.3, 1.1), new THREE.Color(0x2a5a30)); B.add(MAT.dark, G.box, U.mat(k.x, 1.33, k.z, 0.1, ry, 0, 1.85, 0.08, 1.15)); W.addPropRot(k.x, k.z, 1.85, 1.15, ry, 1.37); }
      else { const ry = rnd(); B.add(PM.concrete, G.box, U.mat(k.x, 0.5, k.z, 0, ry, 0, 1.6, 1.0, 1.0), new THREE.Color(0xc0c0b8)); B.add(MAT.hazard, G.box, U.mat(k.x, 0.5, k.z, 0, ry, 0, 1.62, 0.2, 1.02)); W.addPropRot(k.x, k.z, 1.62, 1.02, ry, 1.0); }
    }
    for (const k of cl('+')) {
      const cx0 = W.cellX(k.x), cz0 = W.cellZ(k.z), dist = district(cx0, cz0), long = Math.max(k.w, k.d), short = Math.min(k.w, k.d);
      if (dist.kind === 'downtown' && k.cells >= 16) monument(k);
      else if (dist.kind === 'capitol') fountain(k);
      else if (dist.kind === 'park') gazebo(k);
      else if (dist.kind === 'metro' && long > 10) train(k);
      else if (dist.kind === 'metro' || k.cells === 1) { W.addProp(k.x, k.z, 0.72, 0.72, 14, { mount: false }); B.add(PM.concrete, G.box, U.mat(k.x, c.def.wallH, k.z, 0, 0, 0, 1.4, 12, 1.4), new THREE.Color(0x9a988e)); B.add(PM.glowV, G.box, U.mat(k.x, 3, k.z, 0, 0, 0, 1.45, 0.12, 1.45), new THREE.Color(0x60c0ff)); }
      else if (dist.kind === 'market') stall(k);
      else container(k, long, short);
    }
    function monument(k) {
      for (let s = 0; s < 3; s++) { B.add(PM.concrete, G.box, U.mat(k.x, 0.3 + s * 0.6, k.z, 0, 0, 0, k.w - s * 2, 0.6, k.d - s * 2), new THREE.Color(0xb8b4aa)); W.addProp(k.x, k.z, (k.w - s * 2) / 2, (k.d - s * 2) / 2, 0.6 + s * 0.6); }
      W.addCyl(k.x, k.z, 1.25, 18, { mount: false }); W.addProp(k.x + 3, k.z + 3, 0.4, 0.4, 6, { y0: 1.8, mount: false });
      B.add(PM.concrete, new THREE.CylinderGeometry(0.4, 1.4, 16, 4), U.mat(k.x, 9.8, k.z, 0, Math.PI / 4, 0), new THREE.Color(0xc8c4ba));
      B.add(PM.glowV, G.box, U.mat(k.x, 4, k.z, 0, Math.PI / 4, 0, 2.2, 0.25, 2.2), new THREE.Color(0x70d0ff));
      // statue: colonial marine planting a flag
      const sx = k.x + 3, sz = k.z + 3, bronze = new THREE.Color(0x6a5030);
      B.add(PM.carPaint, G.box, U.mat(sx, 2.4, sz, 0, 0.6, 0, 0.5, 1.0, 0.35), bronze);
      B.add(PM.carPaint, G.box, U.mat(sx, 3.3, sz, 0, 0.6, 0, 0.7, 0.9, 0.45), bronze);
      B.add(PM.carPaint, G.sphere, U.mat(sx, 4.0, sz, 0, 0, 0, 0.25, 0.28, 0.25), bronze);
      B.add(PM.carPaint, G.cyl, U.mat(sx - 0.3, 4.5, sz - 0.2, 0.2, 0, 0.15, 0.04, 3.4, 0.04), bronze);
      B.add(PM.carPaint, G.box, U.mat(sx + 0.2, 5.6, sz - 0.4, 0.2, 0.6, 0.15, 1.2, 0.7, 0.03), bronze);
    }
    function fountain(k) {
      B.add(PM.concrete, G.cyl, U.mat(k.x, 0.45, k.z, 0, 0, 0, k.w * 0.48, 0.9, k.d * 0.48), new THREE.Color(0xb0aca4));
      W.addCyl(k.x, k.z, Math.min(k.w, k.d) * 0.48, 0.9); W.addCyl(k.x, k.z, 0.4, 3.3, { mount: false });
      B.add(PM.water, G.cyl, U.mat(k.x, 0.8, k.z, 0, 0, 0, k.w * 0.44, 0.1, k.d * 0.44));
      B.add(PM.concrete, G.cyl, U.mat(k.x, 2, k.z, 0, 0, 0, 0.35, 3, 0.35), new THREE.Color(0xc0bcb4));
      B.add(PM.concrete, G.cyl, U.mat(k.x, 3.4, k.z, 0, 0, 0, 1.3, 0.2, 1.3), new THREE.Color(0xc0bcb4));
      W.anims.push(() => { if (Math.random() < 0.5) XH.fx.one(k.x + (Math.random() - 0.5) * 0.4, 3.6, k.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2, 0.9, 0.1, 0.05, 0x9fd8ff, 0.8, 9, 0.2, false); });
    }
    function gazebo(k) {
      B.add(PM.concrete, G.cyl, U.mat(k.x, 0.15, k.z, 0, 0, 0, k.w * 0.5, 0.3, k.d * 0.5), new THREE.Color(0xd0ccc4)); W.addCyl(k.x, k.z, Math.min(k.w, k.d) * 0.5, 0.3);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B.add(PM.concrete, G.cyl, U.mat(k.x + Math.cos(a) * k.w * 0.42, 1.8, k.z + Math.sin(a) * k.d * 0.42, 0, 0, 0, 0.12, 3.2, 0.12), new THREE.Color(0xe8e4dc)); W.addCyl(k.x + Math.cos(a) * k.w * 0.42, k.z + Math.sin(a) * k.d * 0.42, 0.16, 3.4, { mount: false }); }
      B.add(PM.carPaint, new THREE.ConeGeometry(k.w * 0.62, 1.8, 6), U.mat(k.x, 4.2, k.z), new THREE.Color(0x3a6a4a));
    }
    function train(k) {
      const alongX = k.w > k.d, len = Math.max(k.w, k.d), ry = alongX ? 0 : Math.PI / 2;
      B.add(PM.carPaint, G.box, lm(k.x, k.z, ry, 0, 2.0, 0, len - 0.3, 3.0, 2.4), new THREE.Color(0xc8ccd0)); W.addPropRot(k.x, k.z, len - 0.3, 2.44, ry, 3.6);
      B.add(PM.carPaint, G.box, lm(k.x, k.z, ry, 0, 1.3, 0, len - 0.25, 0.3, 2.42), new THREE.Color(0xc03030));
      B.add(PM.carGlass, G.box, lm(k.x, k.z, ry, 0, 2.5, 0, len - 1.2, 0.9, 2.44));
      for (let i = -3; i <= 3; i++) B.add(PM.glowV, G.box, lm(k.x, k.z, ry, i * (len / 8), 2.5, 0, len / 10, 0.7, 2.46), new THREE.Color(rnd() < 0.5 ? 0x406050 : 0x101410));
      B.add(MAT.trim, G.box, lm(k.x, k.z, ry, 0, 3.6, 0, len - 0.6, 0.2, 2.0));
      for (const off of [-len / 2 + 2.5, len / 2 - 2.5]) B.add(PM.rubber, G.box, lm(k.x, k.z, ry, off, 0.35, 0, 2.2, 0.6, 2.2));
      for (const oz of [-0.72, 0.72]) B.add(MAT.trim, G.box, lm(k.x, k.z, ry, 0, 0.06, oz, len + 20, 0.12, 0.12));
      for (let i = -Math.floor(len / 2) - 8; i < len / 2 + 8; i += 1.2) B.add(PM.concrete, G.box, lm(k.x, k.z, ry, i, 0.03, 0, 0.25, 0.06, 2.2), new THREE.Color(0x4a3a2e));
    }
    function stall(k) {
      const col = new THREE.Color(U.pick([0xc02040, 0x20a0c0, 0xe0a020, 0x40c060, 0x8040c0]));
      B.add(MAT.crate, G.box, U.mat(k.x, 0.5, k.z, 0, 0, 0, k.w * 0.9, 1.0, k.d * 0.6)); W.addProp(k.x, k.z, k.w * 0.45, k.d * 0.3, 1.2, { mount: false });
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { B.add(MAT.trim, G.cyl, U.mat(k.x + ox * k.w * 0.42, 1.3, k.z + oz * k.d * 0.42, 0, 0, 0, 0.05, 2.6, 0.05)); W.addCyl(k.x + ox * k.w * 0.42, k.z + oz * k.d * 0.42, 0.08, 2.7, { mount: false }); }
      B.add(PM.carPaint, G.box, U.mat(k.x, 2.7, k.z, 0.15, 0, 0, k.w, 0.08, k.d), col);
      for (let i = 0; i < 6; i++) B.add(PM.carPaint, G.box, U.mat(k.x + (rnd() - 0.5) * k.w * 0.7, 1.1, k.z + (rnd() - 0.5) * k.d * 0.4, 0, rnd(), 0, 0.3, 0.2, 0.3), new THREE.Color().setHSL(rnd(), 0.7, 0.5));
      B.add(PM.glowV, G.sphere, U.mat(k.x, 2.4, k.z, 0, 0, 0, 0.15, 0.15, 0.15), new THREE.Color(0xffd080));
    }
    function container(k, long, short) {
      const alongX = k.w >= k.d, ry = alongX ? 0 : Math.PI / 2, n = Math.max(1, Math.round(long / 6));
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * (long / n), col = new THREE.Color(U.pick([0x9a3a2a, 0x2a5a8a, 0xb07020, 0x4a6a3a, 0x7a7a80]));
        B.add(MAT.corr, G.box, lm(k.x, k.z, ry, off, 1.3, 0, long / n - 0.1, 2.6, short * 0.95), col);
        const ccx = k.x + (alongX ? off : 0), ccz = k.z + (alongX ? 0 : off), hl = (long / n - 0.1) / 2, hs = short * 0.475;
        W.addProp(ccx, ccz, alongX ? hl : hs, alongX ? hs : hl, 2.6);
        if (rnd() < 0.55) { B.add(MAT.corr, G.box, lm(k.x, k.z, ry, off, 3.9, 0, long / n - 0.1, 2.6, short * 0.95, 0, 0, (rnd() - 0.5) * 0.2), new THREE.Color(U.pick([0x9a3a2a, 0x2a5a8a, 0xb07020]))); W.addProp(ccx, ccz, alongX ? hl : hs, alongX ? hs : hl, 5.2, { y0: 2.6 }); }
      }
    }
    // trees
    for (const k of cl('T')) {
      B.add(PM.bark, G.cyl, U.mat(k.x, 1.6, k.z, 0, 0, 0, 0.22, 3.2, 0.22)); W.addCyl(k.x, k.z, 0.3, 3.4, { mount: false });
      for (let i = 0; i < 3; i++) B.add(PM.foliage, new THREE.IcosahedronGeometry(1, 0), U.mat(k.x + (rnd() - 0.5) * 1.2, 3.6 + i * 0.7 + rnd() * 0.4, k.z + (rnd() - 0.5) * 1.2, rnd(), rnd(), 0, 1.6 - i * 0.3, 1.3 - i * 0.2, 1.6 - i * 0.3), new THREE.Color(0.12 + rnd() * 0.08, 0.3 + rnd() * 0.18, 0.1 + rnd() * 0.06));
    }
    // hive spires in the crater
    for (const k of cl('O')) {
      const r = Math.min(k.w, k.d) / 2, h = 9 + rnd() * 9;
      W.addCyl(k.x, k.z, r * 0.85, h, { mount: false });
      B.add(MAT.flesh, U.jitter(new THREE.CylinderGeometry(r * 0.2, r * 0.9, h, 7, 6), 0.6, rnd), U.mat(k.x, h / 2 - 0.3, k.z, (rnd() - 0.5) * 0.2, rnd() * 3, (rnd() - 0.5) * 0.2));
      for (let i = 0; i < 5; i++) B.add(MAT.bone, G.cone, U.mat(k.x + (rnd() - 0.5) * r, 1 + rnd() * h * 0.7, k.z + (rnd() - 0.5) * r, (rnd() - 0.5) * 2, 0, (rnd() - 0.5) * 2, 0.15, 1.4, 0.15));
      for (let i = 0; i < 3; i++) B.add(PM.glowV, G.sphere, U.mat(k.x + (rnd() - 0.5) * r * 1.2, 1 + rnd() * h * 0.6, k.z + (rnd() - 0.5) * r * 1.2, 0, 0, 0, 0.3, 0.3, 0.3), new THREE.Color(0xffa030));
    }
    // creep spread across the crater + tendrils climbing nearby buildings
    const crater = { x: W.cx2x(2 + 64 + 15), z: W.cz2z(2 + 64 + 15) };
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, rr = rnd() * 32;
      const m = new THREE.Mesh(G.plane, MAT.creep); m.rotation.x = -Math.PI / 2; m.rotation.z = rnd() * 6; m.scale.setScalar(7 + rnd() * 8);
      m.position.set(crater.x + Math.cos(a) * rr, 0.013 + rnd() * 0.004, crater.z + Math.sin(a) * rr); m.renderOrder = 1; root.add(m);
    }
    for (const b of blds) {
      if (Math.hypot(b.cx - crater.x, b.cz - crater.z) > 55) continue;
      for (let i = 0; i < 6; i++) {
        const sd = Math.floor(rnd() * 4), t = rnd() - 0.5, y0 = b.h * (0.3 + rnd() * 0.6);
        const fx = b.cx + (sd === 2 ? -b.W / 2 : sd === 3 ? b.W / 2 : t * b.W), fz = b.cz + (sd === 0 ? -b.D / 2 : sd === 1 ? b.D / 2 : t * b.D);
        let p = new THREE.Vector3(fx, y0, fz);
        for (let k = 0; k < 6 && p.y > 0; k++) { const q = p.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.8, -1.4, (rnd() - 0.5) * 0.8)); if (q.y < 0) q.y = 0; const v = q.clone().sub(p), len = v.length(); B.add(MAT.flesh, G.cyl, new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()), new THREE.Vector3(0.18 - k * 0.02, len, 0.18 - k * 0.02))); p = q; }
      }
    }
    // steam from manholes + burning wrecks (particles only near the player)
    const manholes = [];
    for (let i = 0; i < 40; i++) { const x = Math.floor(rnd() * Wd), z = Math.floor(rnd() * H); if (isFloor(x, z) && !side[idx(x, z)] && chAt(x, z) === '.') { const wx = W.cx2x(x), wz = W.cz2z(z); B.add(MAT.dark, G.cyl, U.mat(wx, 0.02, wz, 0, 0, 0, 0.55, 0.03, 0.55)); if (rnd() < 0.4) manholes.push(new THREE.Vector3(wx, 0.1, wz)); } }
    for (const p of burning) { const g = XH.fx.glowSprite(0xff6020, 5, 0.55); g.position.copy(p); root.add(g); p.glow = g; }
    W.anims.push((dt, t) => {
      const cam = XH.player.cam.position;
      for (const p of manholes) if (Math.random() < 0.25 && Math.abs(p.x - cam.x) + Math.abs(p.z - cam.z) < 60) XH.fx.one(p.x + (Math.random() - 0.5) * 0.4, 0.1, p.z + (Math.random() - 0.5) * 0.4, 0, 1.2, 0, 2.2, 0.5, 2.4, 0xb0b8c4, 0.22, -0.1, 0.6, false);
      for (const p of burning) {
        p.glow.material.opacity = 0.4 + Math.sin(t * 13 + p.x) * 0.12 + Math.random() * 0.08;
        if (Math.abs(p.x - cam.x) + Math.abs(p.z - cam.z) < 55) { if (Math.random() < 0.7) XH.fx.fire(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 1)), new THREE.Vector3(0, 1, 0), 0.4); if (Math.random() < 0.3) XH.fx.one(p.x, 2.2, p.z, 0.3, 1.6, 0, 3, 0.8, 3, 0x2a2622, 0.35, -0.3, 0.5, false); }
      }
    });
    // quarantine gates: floodlights + barricades flanking every door
    for (const id in W.doors) {
      const d = W.doors[id];
      const g = XH.fx.glowSprite(0xfff0d0, 4, 0.5); g.position.copy(d.pos).setY(5.5); root.add(g);
    }
  };

  // ---------------- distant skyline, hive spire and searchlights (sky dome) ----------------
  CITY.sky = (def, g) => {
    if (!def.sky || !def.sky.city) return;
    const U2 = XH.U;
    const speck = U2.canvas(128), x = speck.getContext('2d');
    x.fillStyle = '#07060c'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 160; i++) { x.fillStyle = U2.pick(['#ffd890', '#c8e8ff', '#ff80d0', '#fff']); x.globalAlpha = 0.4 + Math.random() * 0.6; x.fillRect(Math.floor(Math.random() * 32) * 4, Math.floor(Math.random() * 32) * 4, 2, 2); }
    const st = new THREE.CanvasTexture(speck); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.userData = { transient: true };
    const items = [], rnd = U2.rng(55);
    for (let i = 0; i < 90; i++) {
      const a = i / 90 * Math.PI * 2 + rnd() * 0.05, r = 330 + rnd() * 90, w = 16 + rnd() * 40, h = 50 + rnd() * rnd() * 240;
      const bg = new THREE.BoxGeometry(w, h, w), uv = bg.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 16, uv.getY(k) * h / 16);
      items.push({ g: bg, m: U2.mat(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r, 0, -a, 0) });
    }
    g.add(new THREE.Mesh(U2.merge(items), new THREE.MeshBasicMaterial({ map: st, fog: false, color: 0xb0a8c8 })));
    // the hive spire on the horizon
    const sp = new THREE.Mesh(U2.jitter(new THREE.CylinderGeometry(4, 38, 360, 9, 12), 5, rnd), new THREE.MeshBasicMaterial({ color: 0x1a0812, fog: false }));
    sp.position.set(290, 150, 260); g.add(sp);
    const veins = new THREE.Mesh(U2.jitter(new THREE.CylinderGeometry(4.4, 39, 360, 9, 12), 5, rnd), new THREE.MeshBasicMaterial({ color: 0xff3080, wireframe: true, fog: false, transparent: true, opacity: 0.35 }));
    veins.position.copy(sp.position); g.add(veins);
    // searchlights sweeping the smog
    const beams = [];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(9, 0.8, 520, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xc8d8ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      b.geometry.translate(0, 260, 0);
      const piv = new THREE.Group(); const a = i * 1.7 + 0.4; piv.position.set(Math.cos(a) * 300, -10, Math.sin(a) * 300); piv.add(b); g.add(piv);
      beams.push({ piv, ph: i * 2.1 });
    }
    XH.world.anims.push((dt, t) => { for (const b of beams) { b.piv.rotation.z = Math.sin(t * 0.21 + b.ph) * 0.5; b.piv.rotation.x = Math.cos(t * 0.17 + b.ph) * 0.4; } veins.material.opacity = 0.25 + Math.sin(t * 1.3) * 0.12; });
  };
})();
