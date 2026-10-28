'use strict';
// Arena construction from ASCII grids, collision, grid raycasts, flow-field navigation.
(function () {
  const U = XH.U, FX = XH.fx;
  const W = XH.world = { CELL: 2.5, anims: [], root: null };
  const CELL = W.CELL;
  const texCache = {};
  const T = (k, fn) => texCache[k] || (texCache[k] = fn());

  // =================== procedural textures ===================
  const TEX = {

    // ---- surfaces for the generated arenas ----
    sand: () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 6, v * 6, 5, 6), rip = Math.sin((v * 22 + U.fbm(u * 3, v * 3, 2, 3) * 3) * Math.PI) * 0.5 + 0.5; const b = 140 + n * 50 + rip * 16; return [b * 1.08, b * 0.86, b * 0.62]; })),
    sandstone: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 5, v * 5, 5, 5), strata = Math.sin(v * 40 + n * 6) * 0.5 + 0.5, cr = U.ridge(u * 4, v * 4, 4, 4); let b = 120 + n * 50 + strata * 26; if (cr > 0.9) b *= 0.6; return [b * 1.1, b * 0.78, b * 0.55]; })),
    moss: () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 8, v * 8, 5, 8), d = U.fbm(u * 3 + 5, v * 3, 3, 3); return U.mix3([24, 40, 18], [60, 92, 34], n * 0.9 + (d > 0.62 ? -0.35 : 0)); })),
    vinestone: () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 6, v * 6, 5, 6), vine = U.ridge(u * 3 + 2, v * 8, 4, 3), r = U.ridge(u * 5, v * 5, 4, 5); let c = U.mix3([54, 58, 50], [96, 100, 88], n); if (r > 0.88) c = U.mix3(c, [30, 32, 28], 0.6); if (vine > 0.8) c = U.mix3(c, [40, 90, 30], Math.min(1, (vine - 0.8) * 6)); return c; })),
    labtile: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 8, v * 8, 3, 8); let b = 196 + n * 26; if (x % 64 < 2 || y % 64 < 2) b = 120; if (U.fbm(u * 3 + 3, v * 3, 3, 3) > 0.7) b *= 0.86; return [b * 0.96, b * 0.99, b]; })),
    labwall: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 8, v * 8, 3, 8); let b = 200 + n * 22; if (x % 128 < 3 || y % 128 < 3) b = 130; if (y % 128 > 88 && y % 128 < 96) return [60, 170, 200]; if ((x % 128 - 12) ** 2 + (y % 128 - 12) ** 2 < 7) b = 150; return [b * 0.95, b * 0.98, b]; })),
    wetconcrete: () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 7, v * 7, 5, 7), wet = U.fbm(u * 2 + 4, v * 2, 3, 2); const b = 58 + n * 34 - (wet > 0.55 ? 18 : 0); return [b * 0.92, b * 0.98, b * 0.88]; })),
    brick: () => U.tex(U.paint(256, (u, v, x, y) => { const row = Math.floor(y / 16), off = row % 2 ? 16 : 0, bx = (x + off) % 32, by = y % 16, n = U.fbm(u * 8, v * 8, 4, 8); if (bx < 2 || by < 2) return [44 + n * 20, 42 + n * 18, 38 + n * 16]; const t = U.tnoise(Math.floor((x + off) / 32) * 7.1, row * 3.3, 64) * 0.4; const b = 70 + n * 34 + t * 50; return [b * 1.15, b * 0.66, b * 0.5]; })),
    chitin: () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 6, v * 6, 5, 6), r = U.ridge(u * 6 + 3, v * 6, 4, 6), r2 = U.ridge(u * 12, v * 12, 3, 12); let c = U.mix3([22, 12, 30], [60, 30, 72], n); if (r > 0.86) c = U.mix3(c, [150, 70, 190], (r - 0.86) * 7); if (r2 > 0.94) c = U.mix3(c, [8, 4, 12], 0.6); return c; })),
    bunker: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 8, v * 8, 4, 8), g = U.fbm(u * 3, v * 3 + 2, 3, 3); let b = 92 + n * 30 - g * 20; if (x % 128 < 3 || y % 64 < 2) b -= 34; if ((x % 128 - 64) ** 2 + (y % 64 - 32) ** 2 < 5) b -= 30; if (y % 64 > 50 && U.fbm(u * 10, v * 10, 2, 10) > 0.55) b *= 0.7; return [b * 0.98, b, b * 0.94]; })),
    dirt: () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 7, v * 7, 5, 7), p = U.fbm(u * 2, v * 2 + 3, 3, 2); const b = 50 + n * 34 - (p > 0.6 ? 14 : 0); return [b * 1.05, b * 0.9, b * 0.72]; })),
    regolith: () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 8, v * 8, 5, 8), cr = U.ridge(u * 3, v * 3, 3, 3), sp = U.tnoise(u * 90, v * 90, 90); let b = 96 + n * 44 + (sp > 0.85 ? 30 : 0); if (cr > 0.9) b *= 0.7; return [b, b, b * 1.02]; })),
    module: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 8, v * 8, 3, 8); let b = 190 + n * 24; if (x % 128 < 3 || y % 64 < 3) b = 120; if (y % 64 > 46 && y % 64 < 52) return [210, 150, 40]; return [b * 0.97, b * 0.98, b]; })),
    mud: () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 6, v * 6, 5, 6), w = U.fbm(u * 2 + 8, v * 2, 3, 2); const b = 42 + n * 30; return w > 0.6 ? [b * 0.6, b * 0.78, b * 0.7] : [b * 1.02, b * 0.9, b * 0.66]; })),
    hull: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 8, v * 8, 4, 8), burn = U.fbm(u * 3, v * 3 + 6, 3, 3); let b = 70 + n * 26; if (x % 64 < 2 || y % 128 < 2) b -= 26; if ((x % 64 - 6) ** 2 + (y % 32 - 6) ** 2 < 4) b += 30; if (burn > 0.6) b *= 0.55; return [b * 0.92, b * 0.96, b]; })),
    hullpanel: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 8, v * 8, 4, 8); let b = 64 + n * 24; const px = x % 64, py = y % 128; if (px < 3 || py < 3) b -= 26; if (py > 60 && py < 66) return [70, 140, 220]; if (px > 8 && px < 56 && py > 10 && py < 54) b += 8; return [b * 0.9, b * 0.95, b * 1.08]; })),
    templestone: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 6, v * 6, 5, 6), row = Math.floor(y / 32), off = row % 2 ? 32 : 0, bx = (x + off) % 64, by = y % 32; let b = 96 + n * 44; if (bx < 2 || by < 2) b *= 0.5; const glyph = (bx > 20 && bx < 44 && by > 8 && by < 24 && ((bx + by) % 7 < 2 || bx % 11 < 1)) && U.tnoise(Math.floor((x + off) / 64), row, 64) > 0.55; if (glyph) return [200, 160, 70]; return [b * 1.0, b * 0.92, b * 0.72]; })),
    templefloor: () => U.tex(U.paint(256, (u, v, x, y) => { const n = U.fbm(u * 6, v * 6, 5, 6); let b = 84 + n * 36; if (x % 64 < 2 || y % 64 < 2) b *= 0.55; if (U.fbm(u * 3 + 2, v * 3, 3, 3) > 0.66) return U.mix3([b, b * 0.92, b * 0.7], [40, 70, 36], 0.5); return [b, b * 0.92, b * 0.72]; })),
    metalFloor: () => U.tex(U.paint(256, (u, v, x, y) => {
      const n = U.fbm(u * 8, v * 8, 4, 8), g = U.fbm(u * 2 + 3, v * 2 + 7, 3, 2);
      let b = 52 + n * 34 - g * 22;
      const px = x % 128, py = y % 128;
      if (px < 2 || py < 2) b -= 26; else if (px < 4 || py < 4) b += 10;
      const rx = px % 64, ry = py % 64;
      if ((rx - 8) ** 2 + (ry - 8) ** 2 < 6) b += 30;
      if ((x + y) % 12 < 2 && (x - y + 1024) % 12 < 2) b += 10;
      if (U.fbm(u * 4 + 9, v * 4, 2, 4) > 0.68) b *= 0.7;
      return [b * 0.92, b * 0.97, b * 1.06];
    })),
    metalWall: () => U.tex(U.paint(256, (u, v, x, y) => {
      const n = U.fbm(u * 8, v * 8, 4, 8), g = U.fbm(u * 3, v * 3 + 5, 3, 3);
      let b = 76 + n * 30 - g * 26;
      if (x % 128 < 3) b -= 30;
      if (y % 128 < 3) b -= 30; else if (y % 128 < 6) b += 12;
      if (x % 128 > 20 && x % 128 < 108 && y % 128 > 30 && y % 128 < 96) b += 8;
      if ((x % 128 - 10) ** 2 + (y % 128 - 12) ** 2 < 8) b += 30;
      return [b * 0.95, b, b * 1.05];
    })),
    rock: () => U.tex(U.paint(256, (u, v) => {
      const n = U.fbm(u * 6, v * 6, 5, 6), r = U.ridge(u * 4 + 2, v * 4, 4, 4);
      let b = 40 + n * 60; if (r > 0.86) b *= 0.45;
      return [b * 1.15, b * 0.82, b * 0.72];
    })),
    creep: () => U.tex(U.paint(256, (u, v) => {
      const n = U.fbm(u * 6, v * 6, 4, 6), r = U.ridge(u * 5 + 1, v * 5 + 3, 4, 5), r2 = U.ridge(u * 10, v * 10, 3, 10);
      let c = U.mix3([34, 12, 30], [70, 24, 58], n);
      if (r > 0.9) c = U.mix3(c, [190, 60, 150], (r - 0.9) * 10);
      if (r2 > 0.93) c = U.mix3(c, [120, 40, 100], 0.6);
      return c;
    })),
    creepDecal: () => {
      const c = U.paint(256, (u, v) => {
        const dx = u - 0.5, dy = v - 0.5, d = Math.sqrt(dx * dx + dy * dy) * 2;
        const n = U.fbm(u * 6, v * 6, 4, 6), r = U.ridge(u * 5 + 1, v * 5 + 3, 4, 5);
        let col = U.mix3([40, 12, 36], [80, 26, 66], n);
        if (r > 0.88) col = U.mix3(col, [210, 70, 170], (r - 0.88) * 8);
        const a = U.clamp((1 - d + (n - 0.5) * 0.6) * 2.2, 0, 1);
        return [col[0], col[1], col[2], a * 255];
      });
      const t = new THREE.CanvasTexture(c); return t;
    },
    snow: () => U.tex(U.paint(256, (u, v) => {
      const n = U.fbm(u * 6, v * 6, 5, 6), s = U.fbm(u * 24, v * 24, 2, 24);
      const b = 150 + n * 42 + s * 12;
      return [b * 0.93, b * 0.97, Math.min(255, b * 1.04)];
    })),
    ice: () => U.tex(U.paint(256, (u, v) => {
      const n = U.fbm(u * 5, v * 5, 4, 5), r = U.ridge(u * 6, v * 6, 4, 6);
      let c = U.mix3([70, 130, 170], [140, 200, 230], n);
      if (r > 0.9) c = U.mix3(c, [230, 245, 255], (r - 0.9) * 10);
      return c;
    })),
    iceRock: () => U.tex(U.paint(256, (u, v) => {
      const n = U.fbm(u * 6, v * 6, 5, 6), r = U.ridge(u * 4, v * 4, 4, 4);
      let b = 90 + n * 70; if (r > 0.85) b *= 0.6;
      return [b * 0.9, b * 0.97, b * 1.1];
    })),
    lava: () => U.tex(U.paint(256, (u, v) => {
      const r = U.ridge(u * 4, v * 4, 5, 4), n = U.fbm(u * 8, v * 8, 3, 8);
      const hot = Math.pow(r, 5);
      return U.mix3([40, 8, 4], [255, 150 + n * 80, 30], hot * 1.2);
    })),
    acid: () => U.tex(U.paint(256, (u, v) => {
      const r = U.ridge(u * 5, v * 5, 4, 5), n = U.fbm(u * 8, v * 8, 3, 8);
      return U.mix3([20, 60, 8], [190, 255, 70], Math.pow(r, 3) * 0.9 + n * 0.2);
    })),
    shipFloor: () => U.tex(U.paint(256, (u, v, x, y) => {
      const n = U.fbm(u * 8, v * 8, 4, 8);
      let b = 38 + n * 26;
      const gx = x % 64, gy = y % 64;
      if (gx > 6 && gx < 58 && gy > 6 && gy < 58) { if ((gx % 8 < 3) || (gy % 8 < 3)) b += 14; else b -= 16; }
      else b += 6;
      if (x % 128 < 2 || y % 128 < 2) b -= 20;
      return [b * 0.9, b, b * 0.95];
    })),
    shipWall: () => U.tex(U.paint(256, (u, v, x, y) => {
      const n = U.fbm(u * 8, v * 8, 4, 8);
      let b = 58 + n * 28;
      const px = x % 64;
      if (px < 4) b -= 22; else if (px < 8) b += 14;
      if (y % 128 < 4) b -= 25;
      if (y % 128 > 50 && y % 128 < 78) b -= 10;
      if (U.fbm(u * 3, v * 3, 2, 3) > 0.66) b *= 0.75;
      return [b * 0.88, b * 0.96, b * 0.92];
    })),
    asphalt: () => U.tex(U.paint(256, (u, v) => {
      const n = U.fbm(u * 8, v * 8, 5, 8), cr = U.ridge(u * 3 + 1, v * 3, 4, 3), sp = U.tnoise(u * 64, v * 64, 64);
      let b = 34 + n * 22 + (sp > 0.8 ? 10 : 0); if (cr > 0.93) b *= 0.55;
      if (U.fbm(u * 2, v * 2 + 5, 3, 2) > 0.62) b *= 0.8;
      return [b * 0.95, b * 0.97, b * 1.05];
    })),
    barrier: () => U.tex(U.paint(256, (u, v, x, y) => {
      const n = U.fbm(u * 8, v * 8, 4, 8);
      let b = 96 + n * 40; if (x % 128 < 3) b -= 40; if (y % 64 < 2) b -= 30;
      const stripe = (y % 128 > 100 && y % 128 < 124) && ((x + y) % 32 < 16);
      return stripe ? [200 + n * 30, 160 + n * 20, 30] : [b, b * 0.98, b * 0.95];
    })),
    grass: () => U.tex(U.paint(256, (u, v) => {
      const n = U.fbm(u * 10, v * 10, 5, 10), d = U.fbm(u * 3 + 7, v * 3, 3, 3);
      return U.mix3([28, 48, 22], [70, 96, 40], n * 0.8 + (d > 0.6 ? -0.3 : 0));
    })),
    hazard: () => U.tex(U.paint(128, (u, v, x, y) => {
      const s = ((x + y) % 64) < 32;
      const n = U.fbm(u * 8, v * 8, 3, 8) * 30;
      return s ? [200 + n, 160 + n, 20] : [25 + n, 25 + n, 25 + n];
    })),
    crate: () => U.tex(U.paint(128, (u, v, x, y) => {
      const n = U.fbm(u * 6, v * 6, 3, 6);
      let c = [60 + n * 30, 66 + n * 30, 70 + n * 30];
      if (x < 10 || x > 117 || y < 10 || y > 117) c = [34 + n * 20, 36 + n * 20, 38 + n * 20];
      if (y > 50 && y < 64) c = [210, 120, 30];
      return c;
    })),
    corrugated: () => U.tex(U.paint(128, (u, v, x) => {
      const n = U.fbm(u * 6, v * 6, 3, 6), rib = Math.sin(x / 128 * Math.PI * 16) * 0.5 + 0.5;
      const b = 150 + rib * 50 + n * 40 - (U.fbm(u * 3, v * 3 + 4, 2, 3) > 0.6 ? 60 : 0);
      return [b, b, b];
    })),
  };

  // =================== materials ===================
  let MAT = {};
  function makeMaterials(theme, def = {}) {
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
    const M = {}, sk = def.skin || {};
    const floorTex = sk.floor || { outpost: 'metalFloor', hive: 'creep', ice: 'snow', ship: 'shipFloor', city: 'asphalt' }[theme];
    const wallTex = sk.wall || { outpost: 'metalWall', hive: 'rock', ice: 'iceRock', ship: 'shipWall', city: 'barrier' }[theme];
    const ft = T(floorTex, TEX[floorTex]).clone(); ft.needsUpdate = true; ft.userData = { transient: true }; // this map's own copy, freed with it
    const wt = T(wallTex, TEX[wallTex]);
    M.floor = std({ map: ft, bumpMap: ft, bumpScale: 0.04, roughness: theme === 'ice' ? 0.9 : 0.78, metalness: theme === 'outpost' || theme === 'ship' ? 0.35 : 0.05 });
    M.floor.userData.tex = ft;
    if (sk.floorTint) M.floor.color.set(sk.floorTint);
    M.wall = std({ map: wt, bumpMap: wt, bumpScale: 0.05, roughness: 0.8, metalness: theme === 'outpost' || theme === 'ship' ? 0.4 : 0.02, flatShading: theme === 'hive' || theme === 'ice' });
    if (sk.wallTint) M.wall.color.set(sk.wallTint);
    if (sk.rough !== undefined) M.wall.flatShading = !!sk.rough;
    M.trim = std({ color: sk.trim || 0x3a4148, roughness: 0.45, metalness: 0.7 });
    M.dark = std({ color: 0x15181c, roughness: 0.6, metalness: 0.5 });
    M.concrete = std({ color: 0x8c8a84, roughness: 0.95, map: T('iceRock', TEX.iceRock) });
    M.crate = std({ map: T('crate', TEX.crate), roughness: 0.7, metalness: 0.3 });
    M.corr = std({ map: T('corrugated', TEX.corrugated), roughness: 0.6, metalness: 0.5 });
    M.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
    M.powerGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
    M.rock = std({ map: T('rock', TEX.rock), roughness: 0.95, flatShading: true });
    M.flesh = std({ color: 0x7a2448, emissive: 0x2a0418, roughness: 0.35, metalness: 0.1, flatShading: true });
    M.bone = std({ color: 0xd8c8a0, roughness: 0.5, flatShading: true });
    M.crystal = std({ color: 0x60e8ff, emissive: 0x1890b8, roughness: 0.1, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.9 });
    M.icebox = std({ color: 0xa8dcff, emissive: 0x0c2a40, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82, flatShading: true });
    M.snowcap = std({ color: 0xb8c4d0, roughness: 0.95, flatShading: true });
    M.white = std({ color: theme === 'ice' ? 0x9aa4ae : 0xdfe6ee, roughness: 0.55, metalness: 0.3 });
    M.hazard = std({ map: T('hazard', TEX.hazard), roughness: 0.6, metalness: 0.4 });
    M.vent = std({ color: 0x2a1020, emissive: 0x100008, roughness: 0.5, flatShading: true });
    M.hole = new THREE.MeshBasicMaterial({ color: 0x020001 });
    const cd = T('creepDecal', TEX.creepDecal);
    M.creep = new THREE.MeshStandardMaterial({ map: cd, transparent: true, depthWrite: false, roughness: 0.4, emissive: 0x401030, emissiveMap: cd, emissiveIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
    const lt = T('lava', TEX.lava).clone(); lt.needsUpdate = true; lt.userData = { transient: true };
    M.lava = new THREE.MeshBasicMaterial({ map: lt, color: 0xffffff });
    const at = T('acid', TEX.acid).clone(); at.needsUpdate = true; at.userData = { transient: true };
    M.acid = new THREE.MeshBasicMaterial({ map: at, color: 0xdddddd });
    const it = T('ice', TEX.ice);
    M.iceFloor = std({ map: it, roughness: 0.1, metalness: 0.4 });
    M.grass = std({ map: T('grass', TEX.grass), roughness: 0.95 });
    return M;
  }

  // =================== geometry helpers ===================
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
    cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    cone: new THREE.ConeGeometry(1, 1, 6),
    sphere: new THREE.SphereGeometry(1, 16, 10),
    torus: new THREE.TorusGeometry(1, 0.12, 6, 20),
    plane: new THREE.PlaneGeometry(1, 1),
  };
  // material variant without vertex colors, for standalone (non-merged) meshes
  const S = (m) => m.userData.solo || (m.userData.solo = (() => { const c = m.clone(); c.vertexColors = false; c.userData = {}; return c; })());
  W.Buckets = () => Buckets();
  // ---------- terrain (floor heights and ramps from the map editor) ----------
  // W.fh: floor height of each cell; W.rdir: a ramp's uphill direction (1 +x, 2 -x, 3 +z, 4 -z) and W.rrise how much it
  // climbs across the cell (W.fh is then the height at its low edge). All zero on maps nobody has shaped.
  W.zblock = new Uint8Array(1);
  W.fh = new Float32Array(1); W.rdir = new Uint8Array(1); W.rrise = new Float32Array(1); W.terrainOn = false; W.baseY = 0;
  const wallCh = (c) => c === '#' || (c >= 'a' && c <= 'w');
  // the floor height at a point (ramps slope across their cell)
  W.floorAt = (x, z) => {
    if (!W.terrainOn) return 0;
    const cx = W.cellX(x), cz = W.cellZ(z); if (!W.inside(cx, cz)) return 0;
    const i = cz * W.w + cx, d = W.rdir[i]; if (!d) return W.fh[i];
    const u = (x + W.ox) / CELL - cx, v = (z + W.oz) / CELL - cz, t = d === 1 ? u : d === 2 ? 1 - u : d === 3 ? v : 1 - v;
    return W.fh[i] + W.rrise[i] * Math.min(1, Math.max(0, t));
  };
  // how far something built at this point is lifted: the floor under it (walls stay where they are)
  W.dispAt = (x, z) => { if (!W.terrainOn) return 0; const cx = W.cellX(x), cz = W.cellZ(z); if (!W.inside(cx, cz) || wallCh(W.ch[cz * W.w + cx])) return 0; return W.floorAt(x, z); };
  // a cell's surface height at the middle of its edge facing (sx, sz), or at its middle for a diagonal
  W.edgeH = (i, sx, sz) => {
    const d = W.rdir[i], h = W.fh[i]; if (!d) return h;
    const r = W.rrise[i], mid = h + r / 2;
    if (sx && sz) return mid;
    if (d === 1) return sx > 0 ? h + r : sx < 0 ? h : mid; if (d === 2) return sx < 0 ? h + r : sx > 0 ? h : mid;
    if (d === 3) return sz > 0 ? h + r : sz < 0 ? h : mid; return sz < 0 ? h + r : sz > 0 ? h : mid;
  };
  function liftMatrix(g, mx) {
    if (!mx) { // geometry already in place: lift it by the floor under its middle
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox, dy = W.dispAt((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2);
      if (!dy || (W.def && W.def.ceiling && bb.max.y > W.def.wallH - 0.3)) return mx;
      return new THREE.Matrix4().makeTranslation(0, dy, 0);
    }
    const e = mx.elements, dy = W.dispAt(e[12], e[14]); if (!dy) return mx;
    // leave anything that hangs from a ceiling where it is
    if (W.def && W.def.ceiling) { if (!g.boundingBox) g.computeBoundingBox(); const sy = Math.hypot(e[4], e[5], e[6]); if (e[13] + g.boundingBox.max.y * sy > W.def.wallH - 0.3) return mx; }
    const out = mx.clone(); out.elements[13] += dy; return out;
  }
  function Buckets() {
    const m = new Map();
    return {
      add(mat, g, mx, c) {
        if (W.terrainOn && !W.noLift) mx = liftMatrix(g, mx);
        if (!m.has(mat)) m.set(mat, []); m.get(mat).push({ g, m: mx, c: c === undefined ? null : (c instanceof THREE.Color ? c : new THREE.Color(c)) }); },
      build(root) {
        for (const [mat, items] of m) {
          const mesh = new THREE.Mesh(U.merge(items), mat);
          mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.userData.merged = true;
          root.add(mesh);
        }
      },
    };
  }

  // =================== grid helpers ===================
  const idx = (x, z) => z * W.w + x;
  W.cellX = (x) => Math.floor((x + W.ox) / CELL);
  W.cellZ = (z) => Math.floor((z + W.oz) / CELL);
  W.cx2x = (cx) => (cx + 0.5) * CELL - W.ox;
  W.cz2z = (cz) => (cz + 0.5) * CELL - W.oz;
  W.inside = (cx, cz) => cx >= 0 && cz >= 0 && cx < W.w && cz < W.h;
  // who: 0 player, 1 ground enemy, 2 flyer. This is the navigation view (whole cells); movement and bullets use
  // W.collide / W.raycast, which skip 'soft' cells whose real shape is registered as prop colliders.
  W.blockedCell = (cx, cz, who) => {
    if (!W.inside(cx, cz)) return true;
    const i = idx(cx, cz), s = W.solid[i];
    if (s === 2) return true;
    if (s === 1) return who !== 2;
    if (who === 1 && (W.haz[i] || W.zblock[i])) return true;
    return false;
  };
  W.blockedAt = (x, z, who) => W.blockedCell(W.cellX(x), W.cellZ(z), who);

  // =================== prop colliders ===================
  // Sub-cell obstacles (poles, crates, drifts, obelisks, benches) that sit on walkable cells.
  // Boxes (axis-aligned) or upright cylinders, from y0 up to a top h. Tops you can reach can be stood on (mount).
  W.STEP = 0.62; // walk straight up anything this low
  W.BODY = 1.75;
  W.props = []; W.propGrid = new Map();
  function regProp(p) {
    if (W.terrainOn && !p.terrain && !W.noLift) { const dy = W.dispAt(p.cyl ? p.cx : (p.x0 + p.x1) / 2, p.cyl ? p.cz : (p.z0 + p.z1) / 2); if (dy) { p.y0 += dy; p.h += dy; } }
    W.props.push(p);
    for (let cz = W.cellZ(p.z0); cz <= W.cellZ(p.z1); cz++) for (let cx = W.cellX(p.x0); cx <= W.cellX(p.x1); cx++) {
      if (!W.inside(cx, cz)) continue; const k = idx(cx, cz); let l = W.propGrid.get(k); if (!l) W.propGrid.set(k, (l = [])); l.push(p);
    }
    return p;
  }
  // noClimb: creatures may not scale it (structures are reached by their ladders and stairs); struct: the structure it belongs to
  const propOpts = (o, h, minHalf) => ({ y0: o.y0 || 0, h, enemy: o.enemy !== false, bullets: o.bullets !== undefined ? o.bullets : h > 0.9, mount: o.mount !== undefined ? o.mount : (minHalf >= 0.3 && o.bullets !== false), on: true, noClimb: !!o.noClimb, noPlayer: !!o.noPlayer, struct: o.struct || null });
  W.addCyl = (x, z, r, h = 2, o = {}) => regProp(Object.assign({ cyl: true, cx: x, cz: z, r, x0: x - r, x1: x + r, z0: z - r, z1: z + r }, propOpts(o, h, r)));
  W.addProp = (x, z, hx, hz, h = 2, o = {}) => {
    const p = regProp(Object.assign({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz }, propOpts(o, h, Math.min(hx, hz))));
    return p;
  };
  // rotated footprint (w across, d deep, facing ry) as a snug axis-aligned box
  W.addPropRot = (x, z, w, d, ry, h, o) => { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), k = (c > 0.99 || s > 0.99) ? 1 : 0.85; return W.addProp(x, z, (w * c + d * s) / 2 * k, (w * s + d * c) / 2 * k, h, o); };
  function pushOut(pos, r, bx0, bz0, bx1, bz1) {
    const qx = U.clamp(pos.x, bx0, bx1), qz = U.clamp(pos.z, bz0, bz1);
    const dx = pos.x - qx, dz = pos.z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), p = r - d; pos.x += dx / d * p; pos.z += dz / d * p; }
    else { const l = pos.x - bx0, rr = bx1 - pos.x, t = pos.z - bz0, b = bz1 - pos.z, m = Math.min(l, rr, t, b); if (m === l) pos.x = bx0 - r; else if (m === rr) pos.x = bx1 + r; else if (m === t) pos.z = bz0 - r; else pos.z = bz1 + r; }
  }
  function pushOutCyl(pos, r, p) {
    const dx = pos.x - p.cx, dz = pos.z - p.cz, d2 = dx * dx + dz * dz, m = r + p.r;
    if (d2 >= m * m) return;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (m - d) / d; pos.x += dx * k; pos.z += dz * k; } else pos.x += m;
  }
  const overlap = (p, x, z, r) => {
    if (p.cyl) { const dx = x - p.cx, dz = z - p.cz, m = p.r + r; return dx * dx + dz * dz < m * m; }
    const dx = x - U.clamp(x, p.x0, p.x1), dz = z - U.clamp(z, p.z0, p.z1); return r > 0 ? dx * dx + dz * dz < r * r : dx === 0 && dz === 0;
  };
  W.propOverlap = overlap;
  // the highest point of a ramp's slope under a circle (r = 0: at the point)
  const rampTop = (p, x, z, r) => {
    const R = p.ramp; let t;
    if (R.d === 1) t = (Math.min(p.x1, x + r) - p.x0) / (p.x1 - p.x0); else if (R.d === 2) t = (p.x1 - Math.max(p.x0, x - r)) / (p.x1 - p.x0);
    else if (R.d === 3) t = (Math.min(p.z1, z + r) - p.z0) / (p.z1 - p.z0); else t = (p.z1 - Math.max(p.z0, z - r)) / (p.z1 - p.z0);
    return R.h0 + R.rise * Math.max(0, Math.min(1, t));
  };
  const topOf = (p, x, z, r) => (p.ramp ? rampTop(p, x, z, r) : p.h);
  W.propTop = topOf;
  // Is this prop in the way of a body whose feet are at 'feet'? Tops within a step are walked onto instead.
  const blocks = (p, feet, who, x, z, r) => { if (!p.on || (who === 1 && !p.enemy) || (who === 0 && p.noPlayer)) return false; const top = p.ramp ? rampTop(p, x, z, r) : p.h; return feet < top - 0.01 && feet + W.BODY > p.y0 && !(p.mount && top - feet <= W.STEP); };
  // push a circle out of blocked cells and props (mutates pos.x / pos.z; pos.y is the feet height)
  W.collide = (pos, r, who) => {
    const feet = pos.y || 0;
    for (let pass = 0; pass < 2; pass++) {
      const x0 = W.cellX(pos.x - r), x1 = W.cellX(pos.x + r), z0 = W.cellZ(pos.z - r), z1 = W.cellZ(pos.z + r);
      for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
        if (!W.blockedCell(cx, cz, who) || (who !== 2 && W.inside(cx, cz) && W.soft[idx(cx, cz)])) continue;
        const bx0 = cx * CELL - W.ox, bz0 = cz * CELL - W.oz;
        pushOut(pos, r, bx0, bz0, bx0 + CELL, bz0 + CELL);
      }
      if (who === 2 || !W.propGrid.size) continue;
      for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
        if (!W.inside(cx, cz)) continue; const l = W.propGrid.get(idx(cx, cz)); if (!l) continue;
        for (const p of l) { if (!blocks(p, feet, who, pos.x, pos.z, r)) continue; if (p.cyl) pushOutCyl(pos, r, p); else pushOut(pos, r, p.x0, p.z0, p.x1, p.z1); }
      }
    }
  };
  // Highest top you are standing on: mountable props under the circle, no higher than a step above your feet.
  W.groundAt = (x, z, r, feet) => {
    let g = W.terrainOn ? W.baseY : 0, gp = null; const lim = feet + W.STEP;
    const x0 = W.cellX(x - r), x1 = W.cellX(x + r), z0 = W.cellZ(z - r), z1 = W.cellZ(z + r);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      if (!W.inside(cx, cz)) continue; const l = W.propGrid.get(idx(cx, cz)); if (!l) continue;
      for (const p of l) { if (!p.on || !p.mount || !overlap(p, x, z, r)) continue; const top = p.ramp ? rampTop(p, x, z, r) : p.h; if (top <= lim && top > g) { g = top; gp = p; } }
    }
    W.groundProp = gp; // what you are standing on (structures say which one)
    return g;
  };
  // Would a body standing at (x, z) with feet at 'feet' be inside something solid?
  W.solidAt = (x, z, r, feet, who = 0) => {
    const x0 = W.cellX(x - r), x1 = W.cellX(x + r), z0 = W.cellZ(z - r), z1 = W.cellZ(z + r);
    if (W.ceilH && feet + W.BODY > W.ceilH) return true;
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      if (!W.inside(cx, cz)) return true;
      const i = idx(cx, cz);
      if (W.solid[i] && !W.soft[i]) { const bx0 = cx * CELL - W.ox, bz0 = cz * CELL - W.oz, qx = U.clamp(x, bx0, bx0 + CELL), qz = U.clamp(z, bz0, bz0 + CELL); if ((x - qx) ** 2 + (z - qz) ** 2 < r * r) return true; }
      const l = W.propGrid.get(i); if (!l) continue;
      for (const p of l) if (p.on && !(who === 1 && !p.enemy) && !(who === 0 && p.noPlayer) && topOf(p, x, z, r) > feet + 0.05 && p.y0 < feet + W.BODY && overlap(p, x, z, r)) return true;
    }
    return false;
  };
  // Climbing: a mountable top in front (along dx, dz), between 0.3 and maxUp above the feet, with room to stand on it.
  W.mantleTarget = (x, z, dx, dz, feet, r, maxUp, who = 0) => {
    for (let reach = 0.2; reach <= 1.0; reach += 0.2) {
      const px = x + dx * (r + reach), pz = z + dz * (r + reach), cx = W.cellX(px), cz = W.cellZ(pz);
      if (!W.inside(cx, cz)) return null;
      if (W.solid[idx(cx, cz)] && !W.soft[idx(cx, cz)]) return null; // a wall in the way
      const l = W.propGrid.get(idx(cx, cz)); if (!l) continue;
      let best = null, bh = -1e9;
      for (const p of l) { if (!p.on || !p.mount || (who === 1 && p.noClimb) || !overlap(p, px, pz, 0.01)) continue; const top = topOf(p, px, pz, 0); if (top > feet + 0.3 && top <= feet + maxUp && top > bh) { best = p; bh = top; } }
      if (!best) continue;
      for (const k of [0.3, 0.15, 0]) {
        const tx = px + dx * k, tz = pz + dz * k, ty = topOf(best, tx, tz, 0);
        if (overlap(best, tx, tz, 0.01) && !W.solidAt(tx, tz, r * 0.85, ty, who)) return { x: tx, z: tz, y: ty };
      }
      return null;
    }
    return null;
  };
  // mark cells of these grid characters as soft (their props carry the collision); cells without a prop stay solid
  W.soften = (chars) => {
    for (let i = 0; i < W.w * W.h; i++) {
      if (!chars.includes(W.ch[i]) || !W.solid[i]) continue;
      if (!W.propGrid.get(i)) { if (XH.DEBUG) console.warn('no collider for', W.ch[i], i % W.w, (i / W.w) | 0); continue; }
      W.soft[i] = 1; W.hgt[i] = 0;
    }
  };
  W.propAt = (x, z, r = 0) => { const l = W.propGrid.get(idx(W.cellX(x), W.cellZ(z))); if (!l) return null; for (const p of l) if (p.on && !p.terrain && x > p.x0 - r && x < p.x1 + r && z > p.z0 - r && z < p.z1 + r) return p; return null; }; // the floor itself does not count

  // 3D ray vs. grid (walls with heights), floor and ceiling. Returns {t, n:Vector3, kind}
  const _hit = { t: 0, n: new THREE.Vector3(), kind: '' };
  let propBest = 1e9, propRef = null; const _pn = new THREE.Vector3();
  function rayProps(o, d, ci) {
    const l = W.propGrid.get(ci); if (!l) return;
    for (const p of l) {
      if (!p.on || !p.bullets) continue;
      if (p.cyl) { rayCyl(o, d, p); continue; }
      let tn = -1e9, tf = 1e9, ax = -1, sg = 0;
      const sl = (oo, dd, a0, a1, axis) => { if (Math.abs(dd) < 1e-9) return oo >= a0 && oo <= a1; let t1 = (a0 - oo) / dd, t2 = (a1 - oo) / dd, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; } if (t1 > tn) { tn = t1; ax = axis; sg = s; } if (t2 < tf) tf = t2; return tn <= tf; };
      if (!sl(o.x, d.x, p.x0, p.x1, 0) || !sl(o.y, d.y, p.y0, p.h, 1) || !sl(o.z, d.z, p.z0, p.z1, 2)) continue;
      if (tn < 0 || tn > tf || tn >= propBest) continue;
      if (p.ramp) {
        // y(t) minus the slope under the ray is straight in t: solve for where it crosses zero inside the box
        const R = p.ramp, ax2 = R.d <= 2, sgn = R.d === 1 || R.d === 3 ? 1 : -1, e0 = R.d === 1 ? p.x0 : R.d === 2 ? p.x1 : R.d === 3 ? p.z0 : p.z1;
        const k = R.rise / (ax2 ? p.x1 - p.x0 : p.z1 - p.z0), oc = ax2 ? o.x : o.z, dc = ax2 ? d.x : d.z;
        const a0 = o.y - R.h0 - k * sgn * (oc - e0), a1 = d.y - k * sgn * dc;
        if (a0 + a1 * tn > 1e-4) { if (Math.abs(a1) < 1e-9) continue; const ts = -a0 / a1; if (ts < tn || ts > tf || ts >= propBest) continue; propBest = ts; propRef = p; const nl = Math.hypot(k, 1); _pn.set(ax2 ? -sgn * k / nl : 0, 1 / nl, ax2 ? 0 : -sgn * k / nl); continue; }
      }
      propBest = tn; propRef = p; _pn.set(ax === 0 ? sg : 0, ax === 1 ? sg : 0, ax === 2 ? sg : 0);
    }
  }
  // ray vs. upright cylinder (side and top cap)
  function rayCyl(o, d, p) {
    const ox = o.x - p.cx, oz = o.z - p.cz, a = d.x * d.x + d.z * d.z;
    if (a > 1e-10) {
      const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - p.r * p.r, disc = b * b - a * c;
      if (disc >= 0) {
        const t = (-b - Math.sqrt(disc)) / a;
        if (t >= 0 && t < propBest) { const y = o.y + d.y * t; if (y >= p.y0 && y <= p.h) { propBest = t; propRef = p; _pn.set((ox + d.x * t) / p.r, 0, (oz + d.z * t) / p.r); return; } }
      }
    }
    if (d.y < -1e-6 && o.y > p.h) { const t = (p.h - o.y) / d.y, x = ox + d.x * t, z = oz + d.z * t; if (t >= 0 && t < propBest && x * x + z * z <= p.r * p.r) { propBest = t; propRef = p; _pn.set(0, 1, 0); } }
  }
  // Is the straight line between two points hidden by a full-height wall or a closed door, all the way across that
  // cell? Low cover, props, pillars, structures and anything that could be seen over never hide anything.
  const sightCell = (i) => { const c = W.ch[i]; return c === '#' || (c >= 'a' && c <= 'w') || (c >= '0' && c <= '9' && W.hgt[i] > 0); };
  W.sightBlocked = (ox, oy, oz, tx, ty, tz) => {
    const dx = tx - ox, dy = ty - oy, dz = tz - oz;
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return false;
    const top = W.wallH + Math.min(0, W.baseY || 0) - 0.15, bot = (W.terrainOn ? W.baseY : 0) - 0.5;
    let cx = W.cellX(ox), cz = W.cellZ(oz);
    const ex = W.cellX(tx), ez = W.cellZ(tz), sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx) < 1e-9 ? 1e-9 : Math.abs(dx), adz = Math.abs(dz) < 1e-9 ? 1e-9 : Math.abs(dz);
    const bx = sx > 0 ? (cx + 1) * CELL - W.ox : cx * CELL - W.ox, bz = sz > 0 ? (cz + 1) * CELL - W.oz : cz * CELL - W.oz;
    let tMx = Math.abs(bx - ox) / adx, tMz = Math.abs(bz - oz) / adz, tIn = 0;
    const tDx = CELL / adx, tDz = CELL / adz;
    for (let it = 0; it < 400; it++) {
      const tOut = Math.min(tMx, tMz, 1);
      if (it > 0 && W.inside(cx, cz) && sightCell(idx(cx, cz))) {
        const ya = oy + dy * tIn, yb = oy + dy * tOut;
        if (Math.max(ya, yb) < top && Math.min(ya, yb) > bot) return true;
      }
      if ((cx === ex && cz === ez) || tOut >= 1) return false;
      if (tMx < tMz) { cx += sx; tIn = tMx; tMx += tDx; } else { cz += sz; tIn = tMz; tMz += tDz; }
    }
    return false;
  };
  W.raycast = (o, d, maxT) => {
    let tMax = maxT; _hit.kind = 'none'; _hit.n.set(0, 1, 0);
    propBest = 1e9; propRef = null; _hit.prop = null; const hasProps = W.propGrid.size > 0;
    const fy0 = W.terrainOn ? W.baseY : 0;
    if (d.y < -1e-6) { const tf = (fy0 - o.y) / d.y; if (tf < tMax) { tMax = tf; _hit.kind = 'floor'; _hit.n.set(0, 1, 0); } }
    if (W.ceilH && d.y > 1e-6) { const tc = (W.ceilH - o.y) / d.y; if (tc < tMax) { tMax = tc; _hit.kind = 'ceil'; _hit.n.set(0, -1, 0); } }
    let cx = W.cellX(o.x), cz = W.cellZ(o.z);
    const sx = d.x > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
    const adx = Math.abs(d.x) < 1e-9 ? 1e-9 : Math.abs(d.x), adz = Math.abs(d.z) < 1e-9 ? 1e-9 : Math.abs(d.z);
    const bx = sx > 0 ? (cx + 1) * CELL - W.ox : cx * CELL - W.ox, bz = sz > 0 ? (cz + 1) * CELL - W.oz : cz * CELL - W.oz;
    let tMx = Math.abs(bx - o.x) / adx, tMz = Math.abs(bz - o.z) / adz;
    const tDx = CELL / adx, tDz = CELL / adz;
    let tEnter = 0, axis = -1;
    if (hasProps && W.inside(cx, cz)) rayProps(o, d, idx(cx, cz));
    for (let it = 0; it < 256; it++) {
      if (propBest < tEnter && propBest < tMax) { _hit.t = propBest; _hit.kind = 'prop'; _hit.prop = propRef; _hit.n.copy(_pn); return _hit; }
      if (axis >= 0) {
        if (hasProps && W.inside(cx, cz)) rayProps(o, d, idx(cx, cz));
        if (!W.inside(cx, cz)) { _hit.t = tEnter; _hit.kind = 'wall'; _hit.n.set(axis === 0 ? -sx : 0, 0, axis === 1 ? -sz : 0); return _hit; }
        const h = W.hgt[idx(cx, cz)];
        if (h > 0 && tEnter < tMax) {
          const yE = o.y + d.y * tEnter;
          if (yE < h && yE > fy0 - 0.01) { if (propBest < tEnter) { _hit.t = propBest; _hit.kind = 'prop'; _hit.prop = propRef; _hit.n.copy(_pn); return _hit; } _hit.t = tEnter; _hit.kind = 'wall'; _hit.n.set(axis === 0 ? -sx : 0, 0, axis === 1 ? -sz : 0); return _hit; }
          if (d.y < 0) {
            const tTop = (h - o.y) / d.y, tExit = Math.min(tMx, tMz);
            if (tTop >= tEnter && tTop <= tExit && tTop < tMax) { if (propBest < tTop) { _hit.t = propBest; _hit.kind = 'prop'; _hit.prop = propRef; _hit.n.copy(_pn); return _hit; } _hit.t = tTop; _hit.kind = 'wall'; _hit.n.set(0, 1, 0); return _hit; }
          }
        }
      }
      if (tMx < tMz) { if (tMx > tMax) break; cx += sx; tEnter = tMx; tMx += tDx; axis = 0; }
      else { if (tMz > tMax) break; cz += sz; tEnter = tMz; tMz += tDz; axis = 1; }
    }
    if (propBest < tMax) { _hit.t = propBest; _hit.kind = 'prop'; _hit.prop = propRef; _hit.n.copy(_pn); return _hit; }
    _hit.t = tMax;
    return _hit;
  };

  // Is a straight path clear for a circle of radius r?
  // phys: only real walls count (soft cells are machines/cover you can reach over)
  W.clearLine = (ax, az, bx, bz, r, who, phys) => {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const nx = -dz / len * r, nz = dx / len * r, steps = Math.ceil(len / 0.6);
    const bl = phys ? (x, z) => { const cx = W.cellX(x), cz = W.cellZ(z); return W.blockedCell(cx, cz, who) && !(W.inside(cx, cz) && W.soft[idx(cx, cz)]); } : (x, z) => W.blockedAt(x, z, who);
    let hPrev = who === 1 && W.terrainOn ? W.floorAt(ax, az) : 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, x = ax + dx * t, z = az + dz * t;
      if (bl(x, z) || bl(x + nx, z + nz) || bl(x - nx, z - nz)) return false;
      if (who === 1 && W.terrainOn) { const h = W.floorAt(x, z); if (h - hPrev > W.STEP) return false; hPrev = h; }
    }
    return true;
  };

  // =================== navigation (flow fields) ===================
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let heapI = new Int32Array(1), heapD = new Float32Array(1), heapN = 0;
  function hpush(i, d) {
    let k = heapN++;
    while (k > 0) { const p = (k - 1) >> 1; if (heapD[p] <= d) break; heapI[k] = heapI[p]; heapD[k] = heapD[p]; k = p; }
    heapI[k] = i; heapD[k] = d;
  }
  function hpop() {
    const top = heapI[0]; heapN--;
    const li = heapI[heapN], ld = heapD[heapN];
    let k = 0;
    for (;;) {
      let c = k * 2 + 1; if (c >= heapN) break;
      if (c + 1 < heapN && heapD[c + 1] < heapD[c]) c++;
      if (heapD[c] >= ld) break;
      heapI[k] = heapI[c]; heapD[k] = heapD[c]; k = c;
    }
    heapI[k] = li; heapD[k] = ld;
    return top;
  }
  // a creature at ni walking to i (toward the target): more than a step up is too much
  function terrainStep(i, ni, dx, dz) {
    if (W.edgeH(i, dx, dz) - W.edgeH(ni, -dx, -dz) > W.STEP + 0.01) return true;
    // a diagonal also has to work through either of the cells beside it
    if (dx && dz) for (const m of [ni - dx, ni - dz * W.w]) if (W.edgeH(i, dx, dz) - W.edgeH(m, 0, 0) > W.STEP + 0.01 || W.edgeH(m, 0, 0) - W.edgeH(ni, 0, 0) > W.STEP + 0.01) return true;
    return false;
  }
  function flood(field, who, sx, sz) {
    field.fill(1e9);
    if (!W.inside(sx, sz)) return;
    heapN = 0;
    const s = idx(sx, sz); field[s] = 0; hpush(s, 0);
    while (heapN > 0) {
      const d0 = heapD[0], i = hpop();
      if (d0 > field[i]) continue;
      const x = i % W.w, z = (i / W.w) | 0;
      for (const [dx, dz, c] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (W.blockedCell(nx, nz, who)) continue;
        if (dx && dz && (W.blockedCell(x + dx, z, who) || W.blockedCell(x, z + dz, who))) continue;
        const ni = idx(nx, nz), nd = d0 + c;
        if (who === 1 && W.terrainOn && terrainStep(i, ni, dx, dz)) continue;
        if (nd < field[ni]) { field[ni] = nd; hpush(ni, nd); }
      }
    }
  }
  W.navCell = -1; W.navDirty = true;
  W.updateNav = (px, pz) => {
    const cx = W.cellX(px), cz = W.cellZ(pz), c = W.inside(cx, cz) ? idx(cx, cz) : -1;
    if (c === W.navCell && !W.navDirty) return;
    W.navCell = c; W.navDirty = false;
    flood(W.fGnd, 1, cx, cz); flood(W.fFly, 2, cx, cz);
  };
  function bestNext(i, field, who) {
    const x = i % W.w, z = (i / W.w) | 0;
    let best = -1, bd = field[i];
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (!W.inside(nx, nz)) continue;
      if (dx && dz && (W.blockedCell(x + dx, z, who) || W.blockedCell(x, z + dz, who))) continue;
      const ni = idx(nx, nz);
      if (field[ni] < bd) { bd = field[ni]; best = ni; }
    }
    return best;
  }
  // Steering target a few cells down the flow field, using the farthest one with a clear straight line.
  W.flowTarget = (x, z, r, fly, out) => {
    const who = fly ? 2 : 1, field = fly ? W.fFly : W.fGnd;
    const cx = W.cellX(x), cz = W.cellZ(z);
    if (!W.inside(cx, cz)) return false;
    let ci = idx(cx, cz);
    const path = [];
    for (let k = 0; k < 5; k++) { const n = bestNext(ci, field, who); if (n < 0) break; path.push(n); ci = n; }
    if (!path.length) return false;
    for (let k = path.length - 1; k >= 0; k--) {
      const tx = W.cx2x(path[k] % W.w), tz = W.cz2z((path[k] / W.w) | 0);
      if (k === 0 || W.clearLine(x, z, tx, tz, r * 0.9, who)) { out.set(tx, 0, tz); return true; }
    }
    return false;
  };
  // a ground flow field toward any cell (ladders and stairs), cached until a door opens
  W.fieldCache = new Map();
  W.fieldTo = (cx, cz) => {
    const k = idx(cx, cz); let f = W.fieldCache.get(k);
    if (!f) { f = new Float32Array(W.w * W.h); flood(f, 1, cx, cz); W.fieldCache.set(k, f); }
    return f;
  };
  W.flowTargetField = (x, z, r, field, out) => {
    const cx = W.cellX(x), cz = W.cellZ(z);
    if (!W.inside(cx, cz)) return false;
    let ci = idx(cx, cz); const path = [];
    for (let k = 0; k < 5; k++) { const n = bestNext(ci, field, 1); if (n < 0) break; path.push(n); ci = n; }
    if (!path.length) return false;
    for (let k = path.length - 1; k >= 0; k--) {
      const tx = W.cx2x(path[k] % W.w), tz = W.cz2z((path[k] / W.w) | 0);
      if (k === 0 || W.clearLine(x, z, tx, tz, r * 0.9, 1)) { out.set(tx, 0, tz); return true; }
    }
    return false;
  };
  W.navDist = (x, z, fly) => { const cx = W.cellX(x), cz = W.cellZ(z); if (!W.inside(cx, cz)) return 1e9; return (fly ? W.fFly : W.fGnd)[idx(cx, cz)]; };

  // Zones: which spawns are reachable from the start with the current doors
  W.updateZones = () => {
    const seen = new Uint8Array(W.w * W.h), q = [W.startCell];
    seen[W.startCell] = 1;
    while (q.length) {
      const i = q.pop(), x = i % W.w, z = (i / W.w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DIRS[k][0], nz = z + DIRS[k][1];
        if (!W.inside(nx, nz)) continue;
        const ni = idx(nx, nz);
        if (seen[ni] || W.solid[ni] === 2) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    W.reach = seen;
    for (const s of W.spawns) s.active = !!seen[idx(s.cx, s.cz)];
  };

  // =================== map building ===================
  const isWall = (c) => c === '#' || (c >= 'a' && c <= 'w');
  const PERK_CH = 'JRDALVEIQN';

  // ---------- flattening static models ----------
  // A model built from many parts, each with its own material, costs a draw call per part. Parts whose materials only
  // differ in colour become one mesh with the colour in its vertices. Only for parts that never change on their own
  // (the group may still move as a whole); skip: subtrees left alone.
  W.flatten = (group, skip = []) => {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), bySig = new Map(), skipSet = new Set();
    for (const s of skip) if (s) s.traverse((o) => skipSet.add(o));
    group.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || skipSet.has(o) || Array.isArray(o.material) || !o.geometry.attributes.position) return;
      const m = o.material; if (!(m.isMeshStandardMaterial || m.isMeshBasicMaterial) || m.vertexColors || m.map || m.alphaMap) return;
      const sig = [m.type, m.roughness, m.metalness, m.emissive ? m.emissive.getHex() : 0, m.emissiveIntensity, m.transparent, m.opacity, m.side, m.blending, m.depthWrite, m.flatShading].join('|');
      let l = bySig.get(sig); if (!l) bySig.set(sig, (l = [])); l.push(o);
    });
    let saved = 0;
    for (const list of bySig.values()) {
      if (list.length < 2) continue;
      const items = list.map((o) => ({ g: o.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), c: o.material.color }));
      const mat = list[0].material.clone(); mat.color = new THREE.Color(0xffffff); mat.vertexColors = true;
      const mesh = new THREE.Mesh(U.merge(items), mat); group.add(mesh);
      for (const o of list) o.parent.remove(o);
      saved += list.length - 1;
    }
    return saved;
  };
  // ---------- far culling ----------
  // The small models and sprites all over a map (vents, wall guns, perk machines, lamps, sentries, props) each cost a
  // draw call. The ones the fog has swallowed, or that would be a couple of pixels across, are left out of the render:
  // a render layer, so nothing that hides or shows them for gameplay is disturbed. The merged map itself is not touched.
  const _cs = new THREE.Sphere();
  W.buildCull = () => {
    const list = [];
    if (W.root) for (const c of W.root.children) {
      if (c.userData.merged || c.userData.noCull || c.isLight) continue;
      c.updateMatrixWorld(true);
      c.traverse((o) => {
        if (!(o.isMesh || o.isSprite || o.isPoints) || o.userData.merged || o.userData.noCull) return;
        let x, y, z, r;
        if (o.isSprite) { const e = o.matrixWorld.elements; x = e[12]; y = e[13]; z = e[14]; r = Math.max(o.scale.x, o.scale.y) * 0.6; }
        else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); _cs.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); x = _cs.center.x; y = _cs.center.y; z = _cs.center.z; r = _cs.radius; }
        if (!(r >= 0) || r > 30) return; // the big ones stay (frustum culling handles them)
        list.push({ o, x, y, z, r });
      });
    }
    W.cullList = list; W.cullT = 0; W.culled = 0;
  };
  W.cull = (cam, dt) => {
    const L = W.cullList; if (!L || !L.length) return;
    if ((W.cullT -= dt) > 0) return; W.cullT = 0.15;
    const fog = W.root && W.root.parent && W.root.parent.fog, fogD = fog && fog.density ? 2.3 / fog.density : 1e9; // 99.5% fog
    const px = cam.position.x, py = cam.position.y, pz = cam.position.z; let n = 0;
    for (const q of L) {
      const d = Math.sqrt((q.x - px) * (q.x - px) + (q.y - py) * (q.y - py) + (q.z - pz) * (q.z - pz)) - q.r;
      const show = d < fogD && d < q.r * 320 + 10;
      q.o.layers.mask = show ? 1 : 2; if (!show) n++;
    }
    W.culled = n;
  };
  W.dispose = (scene) => {
    W.cullList = null;
    if (W.root) {
      scene.remove(W.root);
      W.root.traverse((o) => {
        if (o.geometry && !o.geometry.userData.keep && !Object.values(G).includes(o.geometry)) o.geometry.dispose();
        if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map && m.map.userData && m.map.userData.transient) m.map.dispose(); m.dispose(); }); }
      });
    }
    if (W.skyRoot) {
      scene.remove(W.skyRoot);
      W.skyRoot.traverse((o) => {
        if (o.geometry && !o.isSprite) o.geometry.dispose();
        if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map && m.map.userData && m.map.userData.transient) m.map.dispose(); m.dispose(); }); }
      });
      W.skyRoot = null;
    }
    W.root = null; W.anims = [];
  };

  // every generated piece (traps, levers, structures, the bench...) says where it went, so the editor can select it
  W.pieces = [];
  W.piece = (key, o) => { W.pieces.push(Object.assign({ key }, o)); };
  // Raised and lowered floor: a top for every cell off the lowest level (sloped for ramps), a face wherever a cell drops
  // to its neighbour, and down the foot of walls beside a pit. Each cell also gets a collider you stand on and bump into.
  function buildTerrain(root, floorMat, Wt, Ht) {
    const n = W.w * W.h, top = [], tuv = [], side = [], suv = [];
    const corner = (i, ux, uz) => { const d = W.rdir[i], h = W.fh[i]; if (!d) return h; const r = W.rrise[i]; return h + r * (d === 1 ? ux : d === 2 ? 1 - ux : d === 3 ? uz : 1 - uz); };
    const walk = (i) => !isWall(W.ch[i]);
    const quad = (P, U2, a, b, c, d2, ua, ub, uc, ud) => { P.push(...a, ...b, ...c, ...a, ...c, ...d2); U2.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); };
    const fuv = (x, z) => [(x + Wt / 2) / Wt, (-z + Ht / 2) / Ht]; // the same tiling as the big floor plane
    for (let i = 0; i < n; i++) {
      if (!walk(i)) continue;
      const cx = i % W.w, cz = (i / W.w) | 0, x0 = cx * CELL - W.ox, z0 = cz * CELL - W.oz, x1 = x0 + CELL, z1 = z0 + CELL;
      const h00 = corner(i, 0, 0), h10 = corner(i, 1, 0), h01 = corner(i, 0, 1), h11 = corner(i, 1, 1);
      if (W.fh[i] !== W.baseY || W.rdir[i]) {
        quad(top, tuv, [x0, h00, z0], [x0, h01, z1], [x1, h11, z1], [x1, h10, z0], fuv(x0, z0), fuv(x0, z1), fuv(x1, z1), fuv(x1, z0));
        // what you stand on and bump into
        regProp({ x0, x1, z0, z1, y0: W.baseY - 40, h: Math.max(h00, h10, h01, h11), enemy: true, bullets: true, mount: true, on: true, noClimb: false, struct: null, terrain: true, ramp: W.rdir[i] ? { d: W.rdir[i], h0: W.fh[i], rise: W.rrise[i] } : null });
      }
      // faces down to lower neighbours; beside a wall, from a pit up to the wall's foot
      for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + sx, nz = cz + sz; if (!W.inside(nx, nz)) continue;
        const j = nz * W.w + nx;
        // the edge's two ends in this cell's corner terms, and the same points in the neighbour's
        const ends = sx > 0 ? [[1, 0], [1, 1]] : sx < 0 ? [[0, 1], [0, 0]] : sz > 0 ? [[1, 1], [0, 1]] : [[0, 0], [1, 0]];
        const P2 = ends.map(([ux, uz]) => [x0 + ux * CELL, z0 + uz * CELL]);
        const mine = ends.map(([ux, uz]) => corner(i, ux, uz));
        let lo2, hi2;
        if (walk(j)) { const other = ends.map(([ux, uz]) => corner(j, ux - sx, uz - sz)); if (!(mine[0] > other[0] + 0.01 || mine[1] > other[1] + 0.01)) continue; hi2 = mine; lo2 = [Math.min(mine[0], other[0]), Math.min(mine[1], other[1])]; }
        else { if (!(mine[0] < -0.01 || mine[1] < -0.01)) continue; lo2 = mine; hi2 = [Math.max(0, mine[0]), Math.max(0, mine[1])]; }
        const [a, b] = P2;
        quad(side, suv, [a[0], lo2[0], a[1]], [b[0], lo2[1], b[1]], [b[0], hi2[1], b[1]], [a[0], hi2[0], a[1]], [0, lo2[0] / CELL], [1, lo2[1] / CELL], [1, hi2[1] / CELL], [0, hi2[0] / CELL]);
      }
    }
    const mesh = (pos, uv, mat) => {
      if (!pos.length) return;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.userData.noLift = true; m.userData.terrain = true; root.add(m);
    };
    mesh(top, tuv, floorMat);
    const wt = MAT.wall.map ? MAT.wall.map.clone() : null; if (wt) { wt.needsUpdate = true; wt.repeat.set(1, 1); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.userData = { transient: true }; }
    mesh(side, suv, new THREE.MeshStandardMaterial({ map: wt, color: wt ? 0xb0b0b0 : 0x5a5a5a, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide }));
  }
  W.build = (def, scene) => {
    W.dispose(scene);
    W.pieces = [];
    // On a map of your own nothing places itself: traps, the altar and eyes, the egg, the bench and parts, the ammo
    // station, sentries and the theme's clutter are only there if you put them there (XH.edits.pin).
    const cm = def.custom && def.customMeta;
    W.auto = !cm || !!cm.auto; W.clutter = !cm || !!cm.clutter;
    const rows = XH.MAPGRIDS[def.id];
    const H = rows.length, Wd = rows[0].length;
    W.def = def; W.w = Wd; W.h = H; W.ox = Wd * CELL / 2; W.oz = H * CELL / 2;
    W.wallH = def.wallH; W.ceilH = def.ceiling ? def.wallH : 0;
    const n = Wd * H;
    W.props = []; W.propGrid = new Map();
    W.ch = new Array(n); W.solid = new Uint8Array(n); W.soft = new Uint8Array(n); W.hgt = new Float32Array(n); W.haz = new Uint8Array(n);
    W.fGnd = new Float32Array(n); W.fFly = new Float32Array(n);
    heapI = new Int32Array(n * 8); heapD = new Float32Array(n * 8);
    W.spawns = []; W.buys = []; W.perks = []; W.boxSpots = []; W.doors = {}; W.forge = null; W.powerSwitch = null; W.lights = []; W.powerMats = []; W.keepClear = []; if (W.fieldCache) W.fieldCache.clear();
    W.spots = { gum: null, bench: null, pylons: [], parts: [], eggs: [], heart: null };
    { const ed = XH.edits && XH.edits.get(def.id); if (ed && ed.clear) for (const k of ed.clear) W.keepClear.push(k); }
    W.power = !def.power;
    W.navCell = -1; W.navDirty = true;
    const theme = def.theme;
    const gx = (XH.MAPEXTRA || {})[def.id] || {};
    if (def.doors === 'auto') def.doors = gx.doors || {};
    if (def.lights === 'auto') def.lights = (gx.rooms || []).map((r, k) => [r.lx !== undefined ? r.lx : r.cx, r.lz !== undefined ? r.lz : r.cz, (def.palette || [0xffffff])[k % (def.palette || [1]).length], 1.35, 30]);
    MAT = W.MAT = makeMaterials(theme, def);
    const skin = def.skin || {}, rough = W.rough = skin.rough !== undefined ? skin.rough : (theme === 'hive' || theme === 'ice');
    const root = W.root = new THREE.Group();
    scene.add(root);
    const B = Buckets();
    const rnd = U.rng(def.id.length * 977 + 13);
    const tallH = def.ceiling ? def.wallH : 3.4;

    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const c = rows[z][x], i = idx(x, z);
      W.ch[i] = c;
      if (isWall(c)) { W.solid[i] = 2; W.hgt[i] = def.wallH + 30; }
      else if (c >= '0' && c <= '9') { W.solid[i] = 2; W.hgt[i] = def.wallH + 30; }
      else if (c === '=' || c === 'x') { W.solid[i] = 1; W.hgt[i] = c === 'x' ? 1.3 : 1.15; }
      else if (c === '+') { W.solid[i] = 2; W.hgt[i] = tallH; }
      else if (c === 'O') { W.solid[i] = 2; W.hgt[i] = def.wallH + 30; }
      else if (PERK_CH.includes(c)) { W.solid[i] = 2; W.hgt[i] = 2.6; }
      else if (c === 'M') { W.solid[i] = 2; W.hgt[i] = 1.1; }
      else if (c === 'U') { W.solid[i] = 2; W.hgt[i] = 2.2; }
      else if (c === 'Z') { W.solid[i] = 2; W.hgt[i] = 2; }
      else if (c === 'G' || c === 'K' || c === '$') { W.solid[i] = 2; W.hgt[i] = 2.4; }
      else if (c === 'T') { W.solid[i] = 2; W.hgt[i] = 4; }
      else if (c === '~') W.haz[i] = 1;
      else if (c === '%') W.haz[i] = 2;
      if (c === 'P') { W.start = new THREE.Vector3(W.cx2x(x), 0, W.cz2z(z)); W.startCell = i; }
      if (c === 'S') W.spawns.push({ x: W.cx2x(x), z: W.cz2z(z), cx: x, cz: z, active: false });
    }
    // terrain from the map editor: floor heights (one letter per cell, 'O' = 0, a quarter metre a step) and ramps
    W.zblock = new Uint8Array(n); // cells creatures keep out of (deadly zones, creature barriers)
    W.fh = new Float32Array(n); W.rdir = new Uint8Array(n); W.rrise = new Float32Array(n); W.terrainOn = false; W.baseY = 0; W.noLift = false;
    {
      const ter = ((XH.edits && XH.edits.get(def.id)) || {}).terrain;
      if (ter) {
        for (let z = 0; z < H && ter.h && z < ter.h.length; z++) { const row = ter.h[z]; for (let x = 0; x < Wd && x < row.length; x++) { const v = (row.charCodeAt(x) - 79) * 0.25; if (v) W.fh[idx(x, z)] = v; } }
        for (const [x, z, dir, h0, rise] of ter.ramps || []) if (W.inside(x, z) && dir >= 1 && dir <= 4) { const i = idx(x, z); W.rdir[i] = dir; W.fh[i] = h0; W.rrise[i] = rise; }
        let lo = 0;
        for (let i = 0; i < n; i++) {
          if (isWall(W.ch[i])) { W.fh[i] = 0; W.rdir[i] = 0; W.rrise[i] = 0; continue; }
          if (W.fh[i] || W.rdir[i]) W.terrainOn = true;
          lo = Math.min(lo, W.fh[i], W.fh[i] + W.rrise[i]);
        }
        W.baseY = lo;
      }
      if (W.start) W.start.y = W.floorAt(W.start.x, W.start.z);
      for (const s of W.spawns) s.y = W.floorAt(s.x, s.z);
    }
    // Black Ops pack stations (models are built by systems.js)
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const c = rows[z][x];
      if (!'GK$&?H'.includes(c)) continue;
      const spot = { x: W.cx2x(x), z: W.cz2z(z), cx: x, cz: z, dir: null };
      if (c === 'G') W.spots.gum = spot; else if (c === 'K') W.spots.bench = spot; else if (c === '$') W.spots.pylons.push(spot);
      else if (c === '&') W.spots.parts.push(spot); else if (c === '?') W.spots.eggs.push(spot); else W.spots.heart = spot;
    }
    const chAt = (x, z) => (x < 0 || z < 0 || x >= Wd || z >= H) ? '#' : rows[z][x];
    // Facing for machines and wall props: toward open floor, with the back against a wall when there is one.
    const OPEN = '.SP_~%&?H,';
    const openDir = (x, z) => {
      let best = [0, 1], bestS = -1e9;
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        if (!OPEN.includes(chAt(x + dx, z + dz) || '#')) continue;
        let sc = 0;
        for (let k = 1; k <= 5 && OPEN.includes(chAt(x + dx * k, z + dz * k) || '#'); k++) sc += 1;
        const back = chAt(x - dx, z - dz) || '#';
        if (!OPEN.includes(back)) sc += isWall(back) || back === '#' ? 10 : 6;
        for (const s2 of [-1, 1]) if (!OPEN.includes(chAt(x + dz * s2, z + dx * s2) || '#')) sc -= 1.5;
        if (sc > bestS) { bestS = sc; best = [dx, dz]; }
      }
      return best;
    };
    W.openDir = openDir;
    // direction of an adjacent wall (for props that lean on a wall)
    W.wallDir = (x, z) => { for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (isWall(chAt(x + dx, z + dz))) return [dx, dz]; return null; };
    for (const k of ['gum', 'bench', 'heart']) if (W.spots[k]) W.spots[k].dir = openDir(W.spots[k].cx, W.spots[k].cz);
    for (const q of [...W.spots.pylons, ...W.spots.parts, ...W.spots.eggs]) q.dir = openDir(q.cx, q.cz);

    // city buildings: whole rectangles instead of per-cell blocks
    W.buildings = ((XH.MAPEXTRA || {})[def.id] || {}).buildings || null;
    W.bldCells = null;
    if (W.buildings) {
      W.bldCells = new Set();
      for (const [bx, bz, bw, bd] of W.buildings) for (let z = Math.max(0, bz); z < Math.min(H, bz + bd); z++) for (let x = Math.max(0, bx); x < Math.min(Wd, bx + bw); x++) W.bldCells.add(idx(x, z));
    }
    // ---------- floor ----------
    const fw = Wd * CELL, fd = H * CELL, ext = def.ceiling ? 0 : 160;
    const fg = new THREE.PlaneGeometry(fw + ext, fd + ext); fg.rotateX(-Math.PI / 2);
    MAT.floor.userData.tex.repeat.set((fw + ext) / (CELL * 2), (fd + ext) / (CELL * 2));
    const floor = new THREE.Mesh(fg, S(MAT.floor)); root.add(floor); floor.userData.noLift = true;
    if (W.terrainOn) { floor.position.y = W.baseY - 0.004; buildTerrain(root, floor.material, fw + ext, fd + ext); }
    if (def.ceiling) {
      const cg = new THREE.PlaneGeometry(fw, fd); cg.rotateX(Math.PI / 2);
      const ck = skin.ceil || 'shipWall', ct = T(ck, TEX[ck]).clone(); ct.needsUpdate = true; ct.userData = { transient: true }; ct.repeat.set(fw / (CELL * 2), fd / (CELL * 2));
      const ceil = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: ct, color: 0x707880, roughness: 0.8, metalness: 0.4 }));
      ceil.position.y = def.wallH; ceil.userData.noLift = true; root.add(ceil);
    }

    // special floors & hazards
    const flat = (x, z, y) => U.mat(W.cx2x(x), y, W.cz2z(z), -Math.PI / 2, 0, 0, CELL, CELL, 1);
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const c = rows[z][x];
      if (W.rdir[idx(x, z)]) continue; // a flat patch cannot lie on a slope
      if (c === '_') B.add(MAT.iceFloor, G.plane, flat(x, z, 0.012));
      if (c === ',' || (theme === 'city' && c === 'T')) B.add(MAT.grass, G.plane, flat(x, z, 0.012));
      if (c === '~') B.add(MAT.lava, G.plane, flat(x, z, 0.02));
      if (c === '%') B.add(MAT.acid, G.plane, flat(x, z, 0.02));
    }

    // ---------- walls ----------
    const wallTint = { outpost: 0xffffff, hive: 0xffffff, ice: 0xffffff, ship: 0xffffff }[theme];
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const c = rows[z][x];
      if (!isWall(c)) continue;
      if (W.bldCells && W.bldCells.has(idx(x, z))) continue;
      let vis = false;
      for (let dz = -1; dz <= 1 && !vis; dz++) for (let dx = -1; dx <= 1; dx++) { const q = chAt(x + dx, z + dz); if (!isWall(q)) { vis = true; break; } }
      if (!vis) continue;
      const wx = W.cx2x(x), wz = W.cz2z(z);
      const isBuy = c >= 'a' && c <= 'w' && def.buys && def.buys[c]; // a wall weapon hangs on this cell
      if (rough && isBuy) { // a flat panel behind the wall weapon, so the rock does not swallow the board
        const h = def.ceiling ? def.wallH + 0.2 : def.wallH * 1.15;
        B.add(MAT.wall, G.box, U.mat(wx, h / 2 - 0.2, wz, 0, 0, 0, CELL * 1.02, h, CELL * 1.02));
        B.add(MAT.trim, G.box, U.mat(wx, 0.2, wz, 0, 0, 0, CELL + 0.1, 0.4, CELL + 0.1));
      } else if (rough) {
        const h = def.ceiling ? def.wallH + 0.2 : def.wallH * (1 + rnd() * 0.5);
        // the rock face stays within ~0.3 m of the cell edge, so what you see is what you bump into
        const g = U.jitter(new THREE.BoxGeometry(CELL * 1.08, h, CELL * 1.08, 2, 3, 2), 0.5, rnd, 0.9);
        const tint = new THREE.Color(wallTint).multiplyScalar(0.8 + rnd() * 0.3);
        B.add(MAT.wall, g, U.mat(wx, h / 2 - 0.2, wz, 0, Math.floor(rnd() * 4) * Math.PI / 2, 0), tint);
        if (theme === 'ice' && rnd() < 0.7) B.add(MAT.snowcap, U.jitter(new THREE.BoxGeometry(CELL * 1.25, 0.8, CELL * 1.25, 2, 1, 2), 0.5, rnd), U.mat(wx, h - 0.1, wz));
        if (theme === 'hive' && rnd() < 0.12) {
          const [dx, dz] = openDir(x, z);
          for (let k = 0; k < 4; k++) B.add(MAT.crystal, G.cone, U.mat(wx + dx * 1.1 + (rnd() - .5), 0.5 + rnd() * 2.5, wz + dz * 1.1 + (rnd() - .5), dz * 0.8 + (rnd() - .5), 0, -dx * 0.8 + (rnd() - .5), 0.18, 0.8 + rnd() * 0.8, 0.18));
          W.addProp(wx + dx * 1.55, wz + dz * 1.55, dx ? 0.3 : 0.8, dz ? 0.3 : 0.8, 3.2, { mount: false });
        }
      } else {
        B.add(MAT.wall, G.box, U.mat(wx, def.wallH / 2, wz, 0, 0, 0, CELL, def.wallH, CELL));
        B.add(MAT.trim, G.box, U.mat(wx, 0.2, wz, 0, 0, 0, CELL + 0.12, 0.4, CELL + 0.12));
        if (!def.ceiling) B.add(MAT.trim, G.box, U.mat(wx, def.wallH, wz, 0, 0, 0, CELL + 0.2, 0.25, CELL + 0.2));
        for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const q = chAt(x + dx, z + dz);
          if (isBuy || isWall(q) || q === '+' || /[0-9]/.test(q)) continue; // no pipes or vents through a wall weapon
          const fx = wx + dx * CELL / 2, fz = wz + dz * CELL / 2, ry = Math.atan2(dx, dz);
          const r = rnd();
          if (r < 0.22) { // vertical pipe
            const off = (rnd() - 0.5) * 1.6;
            B.add(MAT.trim, G.cyl, U.mat(fx + dx * 0.15 + dz * off, def.wallH / 2, fz + dz * 0.15 + dx * off, 0, 0, 0, 0.1, def.wallH, 0.1));
          } else if (r < 0.42) { // light strip
            const lc = theme === 'ship' ? 0x40ff80 : (rnd() < 0.5 ? 0xffa040 : 0x60c8ff);
            B.add(MAT.powerGlow, G.box, U.mat(fx + dx * 0.03, 2.9, fz + dz * 0.03, 0, ry, 0, 1.4, 0.08, 0.06), lc);
          } else if (r < 0.52) { // vent panel
            B.add(MAT.dark, G.box, U.mat(fx + dx * 0.04, 0.9, fz + dz * 0.04, 0, ry, 0, 1.0, 0.6, 0.06));
          }
        }
      }
    }

    // ---------- low cover & crates ----------
    for (let z = 0; z < H && theme !== 'city'; z++) for (let x = 0; x < Wd; x++) {
      const c = rows[z][x], wx = W.cx2x(x), wz = W.cz2z(z);
      if (c === 'x') {
        const ry = rnd() * 0.4;
        B.add(MAT.crate, G.box, U.mat(wx, 0.65, wz, 0, ry, 0, 1.3, 1.3, 1.3)); W.addPropRot(wx, wz, 1.3, 1.3, ry, 1.3);
        if (rnd() < 0.5) { const r2 = rnd() * 1.5; B.add(MAT.crate, G.box, U.mat(wx + 0.1, 1.65, wz - 0.1, 0, r2, 0, 0.8, 0.7, 0.8)); W.addPropRot(wx + 0.1, wz - 0.1, 0.8, 0.8, r2, 2.0, { y0: 1.3 }); }
        continue;
      }
      if (c !== '=') continue;
      const alongZ = (chAt(x, z - 1) === '=' || chAt(x, z + 1) === '=') && chAt(x - 1, z) !== '=' && chAt(x + 1, z) !== '=';
      if (skin.cover && XH.decor2 && XH.decor2.cover(skin.cover, { B, MAT, G, rnd, U, W, x: wx, z: wz, CELL, alongZ })) continue;
      // low cover: a collider shaped like the model (you can climb onto it)
      if (theme === 'outpost') W.addProp(wx, wz, CELL * 0.48, CELL * 0.4, 1.1);
      else if (theme === 'hive') W.addCyl(wx, wz, 1.2, 1.15);
      else if (theme === 'ice') W.addProp(wx, wz, CELL * 0.46, CELL * 0.46, 1.2);
      else W.addProp(wx, wz, CELL * 0.46, CELL * 0.36, 1.05);
      if (theme === 'outpost') {
        B.add(MAT.concrete, G.box, U.mat(wx, 0.38, wz, 0, 0, 0, CELL * 0.96, 0.76, CELL * 0.8));
        B.add(MAT.concrete, G.box, U.mat(wx, 0.92, wz, 0, 0, 0, CELL * 0.9, 0.36, CELL * 0.55));
        B.add(MAT.hazard, G.box, U.mat(wx, 0.55, wz, 0, 0, 0, CELL * 0.97, 0.18, CELL * 0.81));
      } else if (theme === 'hive') {
        B.add(MAT.rock, U.jitter(new THREE.DodecahedronGeometry(1.35, 1), 0.5, rnd), U.mat(wx, 0.35, wz, rnd(), rnd() * 3, 0, 1, 0.7, 1), new THREE.Color(0.8 + rnd() * .2, 0.7, 0.7));
      } else if (theme === 'ice') {
        B.add(MAT.icebox, U.jitter(new THREE.BoxGeometry(CELL * 0.9, 1.2, CELL * 0.9, 2, 1, 2), 0.25, rnd), U.mat(wx, 0.6, wz, 0, rnd(), 0));
      } else {
        B.add(MAT.trim, G.box, U.mat(wx, 0.5, wz, 0, 0, 0, CELL * 0.9, 1.0, CELL * 0.7));
        B.add(MAT.powerGlow, G.box, U.mat(wx, 1.02, wz, -0.5, 0, 0, CELL * 0.7, 0.03, 0.5), 0x30ff90);
        B.add(MAT.dark, G.box, U.mat(wx, 0.5, wz, 0, 0, 0, CELL * 0.92, 0.2, CELL * 0.72));
      }
    }

    // ---------- clusters: '+' structures and 'O' pillars ----------
    const clusters = (ch) => {
      const seen = new Uint8Array(n), out = [];
      for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
        if (rows[z][x] !== ch || seen[idx(x, z)]) continue;
        let x0 = x, x1 = x, z0 = z, z1 = z; const q = [[x, z]]; seen[idx(x, z)] = 1;
        while (q.length) {
          const [cx, cz] = q.pop();
          x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); z0 = Math.min(z0, cz); z1 = Math.max(z1, cz);
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz;
            if (chAt(nx, nz) === ch && !seen[idx(nx, nz)]) { seen[idx(nx, nz)] = 1; q.push([nx, nz]); }
          }
        }
        out.push({ x: (W.cx2x(x0) + W.cx2x(x1)) / 2, z: (W.cz2z(z0) + W.cz2z(z1)) / 2, w: (x1 - x0 + 1) * CELL, d: (z1 - z0 + 1) * CELL, cells: (x1 - x0 + 1) * (z1 - z0 + 1) });
      }
      return out;
    };
    W.clusters = clusters;
    if (XH.setdress) XH.setdress.reset();
    if (XH.zones) XH.zones.build({ def, rows, W }); // named zones, so blocks and props can be dressed for the room they are in
    const plus = theme === 'city' ? [] : clusters('+');
    const biggest = plus.reduce((a, b) => (b.cells > (a ? a.cells : 0) ? b : a), null);
    for (const cl of plus) {
      const { x, z, w, d } = cl;
      if (XH.setdress && XH.setdress.block(cl, { def, B, MAT, G, rnd, root, W, tallH })) continue;
      if (skin.block && XH.decor2 && XH.decor2.block(skin.block, cl, { B, MAT, G, rnd, U, root, FX, W })) continue;
      if (theme === 'outpost' || (theme === 'ship' && cl !== biggest)) {
        const colr = new THREE.Color(U.pick([0x9a3a2a, 0x2a5a8a, 0xb07020, 0x4a6a3a, 0x7a7a80]));
        const hh = def.ceiling ? Math.min(2.6, def.wallH - 0.2) : 2.7;
        B.add(MAT.corr, G.box, U.mat(x, hh / 2, z, 0, 0, 0, w * 0.97, hh, d * 0.97), colr);
        B.add(MAT.trim, G.box, U.mat(x, hh, z, 0, 0, 0, w * 0.99, 0.1, d * 0.99));
        W.addProp(x, z, w * 0.495, d * 0.495, hh + 0.05);
        if (!def.ceiling && cl.cells >= 4) { B.add(MAT.corr, G.box, U.mat(x, hh + 1.3, z, 0, 0.15, 0, w * 0.8, 2.6, d * 0.75), new THREE.Color(U.pick([0x9a3a2a, 0x2a5a8a, 0xb07020]))); W.addPropRot(x, z, w * 0.8, d * 0.75, 0.15, hh + 2.6, { y0: hh }); }
      } else if (theme === 'ship') { // reactor core
        W.addCyl(x, z, Math.min(w, d) * 0.47, def.wallH, { mount: false });
        B.add(MAT.trim, G.cyl, U.mat(x, 0.4, z, 0, 0, 0, w * 0.48, 0.8, d * 0.48));
        B.add(MAT.dark, G.cyl, U.mat(x, def.wallH / 2, z, 0, 0, 0, w * 0.2, def.wallH, d * 0.2));
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; B.add(MAT.trim, G.box, U.mat(x + Math.cos(a) * w * 0.38, def.wallH / 2, z + Math.sin(a) * d * 0.38, 0, -a, 0, 0.4, def.wallH, 0.4)); }
        const core = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xff9a40 }));
        core.scale.setScalar(w * 0.22); core.position.set(x, def.wallH / 2, z); root.add(core);
        const halo = FX.glowSprite(0xff8030, w * 1.4, 0.8); halo.position.copy(core.position); root.add(halo);
        const rings = [0, 1, 2].map((k) => { const r = new THREE.Mesh(G.torus, new THREE.MeshBasicMaterial({ color: 0x40e8ff })); r.scale.setScalar(w * (0.32 + k * 0.05)); r.position.copy(core.position); root.add(r); return r; });
        W.anims.push((dt, t) => { core.scale.setScalar(w * (0.22 + Math.sin(t * 3) * 0.015)); rings.forEach((r, k) => { r.rotation.x = t * (0.5 + k * 0.3); r.rotation.y = t * (0.7 - k * 0.2); }); halo.material.opacity = 0.6 + Math.sin(t * 3) * 0.2; });
      } else if (theme === 'hive') {
        const g = U.jitter(new THREE.CylinderGeometry(Math.min(w, d) * 0.3, Math.min(w, d) * 0.55, tallH + 3, 8, 5), 0.8, rnd);
        B.add(MAT.rock, g, U.mat(x, (tallH + 3) / 2, z, 0, rnd() * 3, 0));
        W.addCyl(x, z, Math.min(w, d) * 0.5, tallH + 3, { mount: false });
        for (let k = 0; k < 5; k++) B.add(MAT.bone, G.cone, U.mat(x + (rnd() - .5) * w * 0.6, 1 + rnd() * 3, z + (rnd() - .5) * d * 0.6, (rnd() - .5) * 2, 0, (rnd() - .5) * 2, 0.15, 1.6, 0.15));
      } else { // ice: hab dome
        const r = Math.max(w, d) / 2;
        const dg = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        B.add(MAT.white, dg, U.mat(x, 0.5, z, 0, 0, 0, w * 0.68, r * 0.9, d * 0.68));
        W.addCyl(x, z, Math.min(w, d) * 0.64, 0.5 + r * 0.75, { mount: false });
        B.add(MAT.trim, G.cyl, U.mat(x, 0.25, z, 0, 0, 0, w * 0.7, 0.5, d * 0.7));
        B.add(MAT.powerGlow, G.cyl, U.mat(x, 1.3, z, 0, 0, 0, w * 0.66, 0.18, d * 0.66), 0x60e0ff);
        if (cl === biggest) {
          B.add(MAT.trim, G.cyl, U.mat(x, r + 3, z, 0, 0, 0, 0.18, 7, 0.18));
          const dish = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, 1.0);
          B.add(MAT.white, dish, U.mat(x, r + 5.5, z, 2.2, 0.6, 0, 2.2, 1.2, 2.2));
          const blink = FX.glowSprite(0xff3030, 1.2); blink.position.set(x, r + 6.7, z); root.add(blink);
          W.anims.push((dt, t) => { blink.visible = (t % 1.4) < 0.25; });
        }
      }
    }
    for (const cl of (theme === 'city' ? [] : clusters('O'))) {
      const { x, z, w, d } = cl, r = Math.min(w, d) / 2;
      if (skin.spire && XH.decor2 && XH.decor2.spire(skin.spire, cl, { B, MAT, G, rnd, U, def, root, W, FX })) continue;
      W.addCyl(x, z, r * (theme === 'outpost' ? 0.95 : theme === 'hive' ? 0.75 : theme === 'ice' ? 0.7 : 0.55), def.wallH + 30, { mount: false });
      if (theme !== 'outpost' && theme !== 'hive' && theme !== 'ice') W.addCyl(x, z, r * 0.7, 0.6);
      if (theme === 'outpost') {
        B.add(MAT.white, G.cyl, U.mat(x, 2.6, z, 0, 0, 0, r * 0.92, 5.2, r * 0.92), new THREE.Color(0.85, 0.8, 0.72));
        B.add(MAT.white, G.sphere, U.mat(x, 5.2, z, 0, 0, 0, r * 0.92, r * 0.4, r * 0.92), new THREE.Color(0.85, 0.8, 0.72));
        for (const y of [0.6, 2.2, 3.8]) B.add(MAT.trim, G.cyl, U.mat(x, y, z, 0, 0, 0, r * 0.96, 0.25, r * 0.96));
        B.add(MAT.hazard, G.cyl, U.mat(x, 1.4, z, 0, 0, 0, r * 0.94, 0.3, r * 0.94));
      } else if (theme === 'hive') {
        const g = U.jitter(new THREE.CylinderGeometry(r * 0.45, r * 0.8, def.wallH + 4, 7, 6), 0.5, rnd);
        B.add(MAT.flesh, g, U.mat(x, (def.wallH + 4) / 2 - 0.5, z, 0, rnd() * 3, 0));
        for (let k = 0; k < 4; k++) B.add(MAT.bone, G.torus, U.mat(x, 1 + k * 1.6, z, Math.PI / 2 + (rnd() - .5) * 0.4, 0, 0, r * 0.7, r * 0.7, 1.5));
        const pus = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xffb040 })); pus.scale.setScalar(0.2); pus.position.set(x + r * 0.55, 1.6, z); root.add(pus);
      } else if (theme === 'ice') {
        for (let k = 0; k < 5; k++) {
          const a = k * 1.3, off = k === 0 ? 0 : r * 0.45;
          B.add(MAT.crystal, G.cone, U.mat(x + Math.cos(a) * off, (k === 0 ? 2.6 : 1.4), z + Math.sin(a) * off, (rnd() - .5) * 0.5, rnd() * 3, (rnd() - .5) * 0.5, r * (k === 0 ? 0.6 : 0.35), k === 0 ? 5.2 : 2.8, r * (k === 0 ? 0.6 : 0.35)));
        }
      } else {
        B.add(MAT.trim, G.cyl, U.mat(x, def.wallH / 2, z, 0, 0, 0, r * 0.5, def.wallH, r * 0.5));
        B.add(MAT.dark, G.cyl, U.mat(x, 0.3, z, 0, 0, 0, r * 0.7, 0.6, r * 0.7));
        B.add(MAT.dark, G.cyl, U.mat(x, def.wallH - 0.3, z, 0, 0, 0, r * 0.7, 0.6, r * 0.7));
        B.add(MAT.powerGlow, G.cyl, U.mat(x, 2.2, z, 0, 0, 0, r * 0.52, 0.12, r * 0.52), 0x40ff80);
      }
    }

    // ---------- spawn vents + creep ----------
    const creepG = new THREE.PlaneGeometry(1, 1);
    for (const s of W.spawns) {
      B.add(MAT.vent, U.jitter(new THREE.TorusGeometry(0.95, 0.38, 6, 12), 0.2, rnd), U.mat(s.x, 0.02, s.z, Math.PI / 2, 0, 0, 1, 1, 0.45));
      B.add(MAT.hole, new THREE.CircleGeometry(0.9, 12), U.mat(s.x, 0.03, s.z, -Math.PI / 2, 0, 0));
      const cr = new THREE.Mesh(creepG, MAT.creep);
      cr.rotation.x = -Math.PI / 2; cr.rotation.z = rnd() * 6; cr.scale.setScalar(6 + rnd() * 3); cr.position.set(s.x, 0.012 + rnd() * 0.004, s.z); cr.renderOrder = 1;
      root.add(cr);
      for (let k = 0; k < 5; k++) { const a = rnd() * 6.28; B.add(MAT.flesh, G.cone, U.mat(s.x + Math.cos(a) * 1.2, 0.3, s.z + Math.sin(a) * 1.2, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7, 0.1, 0.8, 0.1)); }
      // boarded grate: 5 slats the swarm must tear out
      const grate = new THREE.Group(); grate.position.set(s.x, 0.08, s.z); grate.rotation.y = rnd() * 3;
      s.slatMeshes = [];
      for (let k = 0; k < 5; k++) {
        const sl = new THREE.Mesh(G.box, S(theme === 'hive' ? MAT.bone : MAT.trim));
        sl.scale.set(1.9 - Math.abs(k - 2) * 0.28, 0.08, 0.26); sl.position.set(0, 0.02 * (k % 2), (k - 2) * 0.34); sl.rotation.y = (rnd() - 0.5) * 0.12;
        grate.add(sl); s.slatMeshes.push(sl);
      }
      root.add(grate); s.grate = grate; s.slats = 5; s.maxSlats = 5;
    }
    W.anims.push((dt, t) => { MAT.creep.emissiveIntensity = 0.45 + Math.sin(t * 1.7) * 0.25; });
    // hazard animation
    W.anims.push((dt, t) => { MAT.lava.map.offset.set(t * 0.01, t * 0.013); MAT.acid.map.offset.set(-t * 0.012, t * 0.008); });
    const hazCells = [];
    for (let i = 0; i < n; i++) if (W.haz[i]) hazCells.push(i);
    if (hazCells.length) {
      W.anims.push(() => {
        if (Math.random() < 0.3) {
          const i = U.pick(hazCells), x = W.cx2x(i % Wd) + U.rand(-1, 1), z = W.cz2z((i / Wd) | 0) + U.rand(-1, 1);
          if (W.haz[i] === 1) FX.embers(new THREE.Vector3(x, 0.1, z), 2);
          else FX.one(x, 0.05, z, 0, 0.6, 0, 0.8, 0.1, 0.25, 0x9dff3a, 0.8, 0, 1, true);
        }
      });
    }

    // ---------- doors ----------
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const c = rows[z][x];
      if (!(c >= '0' && c <= '9')) continue;
      const d = W.doors[c] || (W.doors[c] = { id: c, cells: [], x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, open: false, cost: (def.doors[c] || {}).cost || 1000, name: (def.doors[c] || {}).name || 'Door' });
      d.cells.push(idx(x, z));
      d.x0 = Math.min(d.x0, x); d.x1 = Math.max(d.x1, x); d.z0 = Math.min(d.z0, z); d.z1 = Math.max(d.z1, z);
    }
    for (const id in W.doors) {
      const d = W.doors[id];
      d.pos = new THREE.Vector3((W.cx2x(d.x0) + W.cx2x(d.x1)) / 2, 0, (W.cz2z(d.z0) + W.cz2z(d.z1)) / 2);
      const w = (d.x1 - d.x0 + 1) * CELL, dd = (d.z1 - d.z0 + 1) * CELL, hh = def.wallH;
      const g = new THREE.Group(); g.position.copy(d.pos);
      if (skin.door === 'stone') {
        const m = new THREE.Mesh(G.box, S(MAT.wall)); m.scale.set(w * 0.98, hh, dd * 0.98); m.position.y = hh / 2; g.add(m);
        const glyph = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0xffc060 })); glyph.scale.set(w > dd ? w * 0.5 : w + 0.06, 0.15, w > dd ? dd + 0.06 : dd * 0.5); glyph.position.y = hh * 0.55; g.add(glyph); d.strip = glyph;
      } else if (theme === 'hive') {
        const m = new THREE.Mesh(U.jitter(new THREE.BoxGeometry(w * 0.95, hh + 1, dd * 0.95, 3, 4, 3), 0.5), S(MAT.flesh));
        m.position.y = (hh + 1) / 2 - 0.3; g.add(m);
        for (let k = 0; k < 6; k++) { const v = new THREE.Mesh(G.cyl6, new THREE.MeshBasicMaterial({ color: 0xff4090 })); v.scale.set(0.06, hh * 0.8, 0.06); v.position.set((Math.random() - .5) * w * 0.7, hh * 0.45, (Math.random() - .5) * dd * 0.7); v.rotation.z = (Math.random() - .5) * 0.6; v.rotation.x = (Math.random() - .5) * 0.6; g.add(v); }
        W.anims.push((dt, t) => { if (!d.open) { const s = 1 + Math.sin(t * 2 + +id) * 0.025; m.scale.set(s, 1, s); } });
      } else if (theme === 'ice') {
        const m = new THREE.Mesh(U.jitter(new THREE.BoxGeometry(w * 0.95, hh, dd * 0.95, 2, 3, 2), 0.3), S(MAT.icebox)); m.position.y = hh / 2; g.add(m);
      } else {
        const m = new THREE.Mesh(G.box, S(MAT.hazard)); m.scale.set(w * 0.98, hh, dd * 0.98); m.position.y = hh / 2; g.add(m);
        const m2 = new THREE.Mesh(G.box, S(MAT.trim)); m2.scale.set(w + (w > dd ? 0 : 0.1), hh * 0.7, dd + (dd > w ? 0 : 0.1)); m2.position.y = hh * 0.45; g.add(m2);
        const strip = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0xff3020 })); strip.scale.set(w + 0.14, 0.12, dd + 0.14); strip.position.y = 2.4; g.add(strip);
        d.strip = strip;
      }
      root.add(g); d.mesh = g;
    }

    // ---------- interactables ----------
    const faceRot = (dx, dz) => Math.atan2(dx, dz);
    // a perk machine centred at (wx, wz) facing (dx, dz); o.y lifts it (on a platform), o.unique marks map-unique perks
    W.makePerkMachine = (p, wx, wz, dx, dz, o = {}) => {
      const g = new THREE.Group(); g.position.set(wx, o.y || 0, wz); g.rotation.y = faceRot(dx, dz);
      const body = new THREE.Mesh(G.box, S(MAT.dark)); body.scale.set(1.5, 2.7, 1.1); body.position.y = 1.35; g.add(body);
      const side = new THREE.Mesh(G.box, new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.4, metalness: 0.5 })); side.scale.set(1.56, 2.3, 0.9); side.position.y = 1.3; g.add(side);
      const lt = U.labelTex([{ t: p.icon, font: 'bold 150px Segoe UI Symbol, Consolas', c: p.css }, { t: p.name.toUpperCase(), font: 'bold 56px Rajdhani, Consolas, monospace', c: '#fff' }, { t: p.cost + '', font: 'bold 60px Rajdhani, Consolas, monospace', c: '#ffd860' }], { w: 512, h: 640, bg: '#08090c', glow: p.css, border: p.css });
      lt.userData = { transient: true };
      const panelMat = new THREE.MeshBasicMaterial({ map: lt, color: 0x333333 });
      const panel = new THREE.Mesh(G.plane, panelMat); panel.scale.set(1.2, 1.5, 1); panel.position.set(0, 1.65, 0.56); g.add(panel);
      const signMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(0.25) });
      const sign = new THREE.Mesh(G.box, signMat); sign.scale.set(1.55, 0.32, 1.15); sign.position.y = 2.86; g.add(sign);
      const slot = new THREE.Mesh(G.box, S(MAT.trim)); slot.scale.set(0.8, 0.35, 0.1); slot.position.set(0, 0.55, 0.56); g.add(slot);
      const vial = new THREE.Mesh(G.cyl, new THREE.MeshBasicMaterial({ color: p.color })); vial.scale.set(0.09, 0.4, 0.09); vial.position.set(0, 3.25, 0); g.add(vial);
      root.add(g);
      W.addPropRot(wx, wz, 1.56, 1.15, faceRot(dx, dz), (o.y || 0) + 3.0, { mount: false, y0: o.y || 0 });
      const m = { perk: p, key: o.key, pos: new THREE.Vector3(wx + dx * 1.6, o.y || 0, wz + dz * 1.6), panelMat, signMat, vial, unique: !!o.unique };
      W.perks.push(m);
      W.anims.push((dt, t) => { vial.rotation.y = t; vial.position.y = 3.25 + Math.sin(t * 2) * 0.05; });
      return m;
    };
    // a wall weapon board on a wall face at (fx, fz) facing (dx, dz); o.frame colours map-unique weapons
    W.makeWallBuy = (weap, fx, fz, dx, dz, o = {}) => {
      const g = new THREE.Group(); g.position.set(fx, o.y || 0, fz); g.rotation.y = faceRot(dx, dz);
      const back = new THREE.Mesh(G.box, S(MAT.dark)); back.scale.set(2.1, 1.25, 0.06); back.position.y = 1.75; g.add(back);
      const frameMat = new THREE.MeshBasicMaterial({ color: o.frame || 0x40ff90 });
      for (const [px, py, sx, sy] of [[0, 2.37, 2.14, 0.05], [0, 1.13, 2.14, 0.05], [-1.07, 1.75, 0.05, 1.29], [1.07, 1.75, 0.05, 1.29]]) { const f = new THREE.Mesh(G.box, frameMat); f.scale.set(sx, sy, 0.08); f.position.set(px, py, 0.02); g.add(f); }
      const model = XH.weapons.flatModel(weap);
      model.scale.setScalar(1.7); model.rotation.y = Math.PI / 2; model.position.set(0.15, 1.85, 0.25); g.add(model);
      const wd = XH.weapons.DEFS[weap];
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ map: U.labelTex([{ t: wd.name.toUpperCase(), font: 'bold 64px Rajdhani, Consolas, monospace' }, { t: XH.weapons.wallCost(weap) + '', c: '#ffd860', font: 'bold 58px Rajdhani, Consolas, monospace', }], { w: 512, h: 160, glow: '#0a4' }), transparent: true }));
      lbl.material.map.userData = { transient: true };
      lbl.position.set(0, 1.35, 0.06); lbl.scale.set(1, 0.9, 1); g.add(lbl);
      root.add(g);
      W.flatten(model); W.flatten(g, [model]);
      const buy = { weapon: weap, pos: new THREE.Vector3(fx + dx * 0.9, o.y || 0, fz + dz * 0.9), model, wall: g, special: !!o.frame };
      W.buys.push(buy);
      W.anims.push((dt, t) => { model.position.y = 1.85 + Math.sin(t * 1.5 + (o.phase || 0)) * 0.03; });
      return buy;
    };
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      const c = rows[z][x], wx = W.cx2x(x), wz = W.cz2z(z);
      if (c >= 'a' && c <= 'w' && c !== 'x' && def.buys[c]) {
        const [dx, dz] = openDir(x, z), weap = def.buys[c];
        const off = CELL / 2 + (rough ? 0.1 : 0.02), fx = wx + dx * off, fz = wz + dz * off;
        W.makeWallBuy(weap, fx, fz, dx, dz, { phase: x });
      } else if (PERK_CH.includes(c)) {
        const p = XH.PERKS[c], [dx, dz] = openDir(x, z);
        W.makePerkMachine(p, wx, wz, dx, dz, { key: c });
      } else if (c === 'M') {
        const [dx, dz] = openDir(x, z);
        const pad = new THREE.Mesh(G.cyl6, S(MAT.trim)); pad.scale.set(1.2, 0.12, 1.2); pad.position.set(wx, 0.06, wz); root.add(pad);
        const bp = W.addPropRot(wx, wz, 1.95, 1.0, faceRot(dx, dz), 0.95, { mount: false }); bp.on = false; // switched on while the Cache sits here
        W.addCyl(wx, wz, 1.2, 0.12);
        W.boxSpots.push({ x: wx, z: wz, rot: faceRot(dx, dz), pos: new THREE.Vector3(wx + dx * 1.7, 0, wz + dz * 1.7), prop: bp });
      } else if (c === 'U') {
        const [dx, dz] = openDir(x, z);
        const g = new THREE.Group(); g.position.set(wx, 0, wz); g.rotation.y = faceRot(dx, dz);
        const base = new THREE.Mesh(G.cyl6, S(MAT.trim)); base.scale.set(1.15, 0.5, 1.15); base.position.y = 0.25; g.add(base);
        for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + Math.PI / 6; const p = new THREE.Mesh(G.box, S(MAT.dark)); p.scale.set(0.25, 2.6, 0.25); p.position.set(Math.cos(a) * 0.95, 1.3, Math.sin(a) * 0.95); p.rotation.y = -a; g.add(p); const tip = new THREE.Mesh(G.cone, S(MAT.bone)); tip.scale.set(0.14, 0.6, 0.14); tip.position.set(Math.cos(a) * 0.95, 2.9, Math.sin(a) * 0.95); g.add(tip); }
        const core = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xc040ff })); core.scale.setScalar(0.42); core.position.y = 1.5; g.add(core);
        const halo = FX.glowSprite(0xb040ff, 3, 0.8); halo.position.y = 1.5; g.add(halo);
        const rings = [0, 1].map((k) => { const r = new THREE.Mesh(G.torus, new THREE.MeshBasicMaterial({ color: k ? 0x40ff90 : 0xff60ff })); r.scale.setScalar(0.7 + k * 0.15); r.position.y = 1.5; g.add(r); return r; });
        const top = new THREE.Mesh(G.cyl6, S(MAT.trim)); top.scale.set(0.8, 0.2, 0.8); top.position.y = 2.9; g.add(top);
        root.add(g);
        W.addCyl(wx, wz, 1.15, 3.0, { mount: false });
        W.forge = { pos: new THREE.Vector3(wx + dx * 1.7, 0, wz + dz * 1.7), group: g, core, halo, rings, busy: false, spin: 1 };
        W.anims.push((dt, t) => {
          const on = W.power, sp = on ? W.forge.spin : 0.1;
          rings[0].rotation.x += dt * 1.2 * sp; rings[0].rotation.y += dt * 0.8 * sp; rings[1].rotation.z += dt * 1.5 * sp; rings[1].rotation.x -= dt * 0.6 * sp;
          core.material.color.setHex(on ? 0xc040ff : 0x301040); halo.material.opacity = on ? 0.6 + Math.sin(t * 4) * 0.2 : 0.1;
        });
      } else if (c === 'Z') {
        const [dx, dz] = openDir(x, z);
        const g = new THREE.Group(); g.position.set(wx, 0, wz); g.rotation.y = faceRot(dx, dz);
        const body = new THREE.Mesh(G.box, S(MAT.trim)); body.scale.set(1.6, 2.0, 1.0); body.position.y = 1; g.add(body);
        const stripe = new THREE.Mesh(G.box, S(MAT.hazard)); stripe.scale.set(1.62, 0.25, 1.02); stripe.position.y = 0.3; g.add(stripe);
        const lever = new THREE.Group(); lever.position.set(0, 1.2, 0.55); g.add(lever);
        const arm = new THREE.Mesh(G.box, S(MAT.dark)); arm.scale.set(0.12, 0.7, 0.12); arm.position.y = 0.3; lever.add(arm);
        const knob = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xff3020 })); knob.scale.setScalar(0.12); knob.position.y = 0.65; lever.add(knob);
        lever.rotation.x = 0.7;
        const lamp = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xff2010 })); lamp.scale.setScalar(0.15); lamp.position.set(0, 2.15, 0); g.add(lamp);
        root.add(g);
        W.addPropRot(wx, wz, 1.62, 1.02, faceRot(dx, dz), 2.25, { mount: false });
        W.powerSwitch = { pos: new THREE.Vector3(wx + dx * 1.6, 0, wz + dz * 1.6), lever, knob, lamp };
        W.anims.push((dt, t) => { if (!W.power) lamp.visible = (t % 1) < 0.5; else lamp.visible = true; });
      }
    }

    // ---------- lights ----------
    const hemi = new THREE.HemisphereLight(def.ambient.sky, def.ambient.ground, def.ambient.i); root.add(hemi);
    W.hemi = hemi;
    W.moon = null;
    if (def.moon) { const dl = new THREE.DirectionalLight(def.moon.color, def.moon.i); dl.position.set(-40, 80, 30); root.add(dl); W.moon = dl; }
    // flashlight: always in the scene (intensity 0 when off) so switching it on never recompiles shaders
    const fl = new THREE.SpotLight(0xfff0d8, 0, 30, 0.42, 0.6, 1.3); fl.target = new THREE.Object3D(); root.add(fl); root.add(fl.target); W.flash = fl;
    const ly0 = def.ceiling ? def.wallH - 0.6 : Math.min(def.wallH, 6) - 0.4;
    for (const [lx, lz, color, inten, dist, lh, fix] of def.lights) {
      const x = W.cx2x(lx), z = W.cz2z(lz), ly = (lh !== undefined && lh !== null ? lh : ly0) + (def.ceiling ? 0 : W.dispAt(x, z));
      const l = W.lampLight(color, inten, dist, 1.4, x, ly, z);
      const glow = FX.glowSprite(color, 2.2, 0.7); glow.position.copy(l.position); glow.userData.lifted = 1; root.add(glow);
      if (fix === 0 || XH.EDITOR) { /* no fixture */ } else if (!def.ceiling && theme !== 'hive' && theme !== 'city') {
        B.add(MAT.trim, G.cyl, U.mat(x, ly / 2, z, 0, 0, 0, 0.09, ly, 0.09));
        B.add(MAT.dark, G.box, U.mat(x, ly + 0.15, z, 0, 0, 0, 0.6, 0.25, 0.4));
        W.addProp(x, z, 0.14, 0.14, ly + 0.3);
      } else if (def.ceiling) {
        B.add(MAT.dark, G.box, U.mat(x, def.wallH - 0.2, z, 0, 0, 0, 1.2, 0.4, 0.5));
      }
      W.lights.push({ light: l, glow, base: inten, flick: Math.random() * 10, color, x, z, y: ly, emergency: W.lights.length % 3 === 0 });
    }
    if (def.ceiling && theme !== 'ice') { // ceiling light strips over corridors (not in caves)
      const stripC = def.skin && def.palette ? new THREE.Color(def.palette[0]).lerp(new THREE.Color(0xffffff), 0.6) : 0xc8ffd8;
      for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
        if (rows[z][x] === '#' || (x + z * 3) % 5) continue;
        if (!'.SP'.includes(rows[z][x])) continue;
        B.add(MAT.powerGlow, G.box, U.mat(W.cx2x(x), def.wallH - 0.03, W.cz2z(z), 0, (x + z) % 2 ? 0 : Math.PI / 2, 0, 1.6, 0.05, 0.18), stripC);
      }
    }

    if (theme === 'city' && XH.city) XH.city.build({ def, rows, B, MAT, G, rnd, chAt, isWall, root, CELL, H, Wd, W, S, U, FX, theme, scene });
    // buildings, platforms, teleporters, the ammo station and the map's unique perk machine and weapon (before the set
    // dressing, which keeps clear of them)
    if (XH.structures) XH.structures.build({ def, rows, B, MAT, G, rnd, root, H, Wd, CELL });
    if (XH.uniques) XH.uniques.build({ def, rows, B, MAT, G, rnd, root, H, Wd, CELL, openDir });
    if (XH.wonders) XH.wonders.build({ def, rows, B, MAT, G, rnd, root, H, Wd, CELL, openDir });
    if (XH.secrets) XH.secrets.build({ def, rows, B, MAT, G, rnd, root, H, Wd, CELL, openDir });
    if (XH.companion) XH.companion.build({ def, rows, B, MAT, G, rnd, root, H, Wd, CELL, openDir });
    if (XH.traps) XH.traps.build({ def, rows, B, MAT, G, rnd, root, H, Wd, CELL, openDir });
    // each zone dressed for what it is (js/mapstory.js), before the generic dressing fills in around it
    if (XH.setdress) try { XH.setdress.build({ def, rows, B, MAT, G, rnd, root, W }); } catch (e) { console.error('set dressing failed', e); }
    if (XH.decor && W.clutter) XH.decor.build({ def, rows, B, MAT, G, rnd, chAt, isWall, root, CELL, H, Wd, W, S, U, FX, theme });
    if (skin.decor && XH.decor2 && W.clutter) XH.decor2.build(skin.decor, { def, rows, B, MAT, G, rnd, chAt, isWall, root, CELL, H, Wd, W, S, U, FX, theme, clusters });
    if (W.terrainOn) for (const o of root.children) {
      if (o.isLight || o.userData.noLift || o.userData.lifted || (def.ceiling && o.position.y > def.wallH - 1)) continue;
      const dy = W.dispAt(o.position.x, o.position.z); if (dy) { o.position.y += dy; o.userData.lifted = dy; }
    }
    B.build(root);
    buildSky(def, scene);
    scene.fog = new THREE.FogExp2(def.fog.color, def.fog.density);
    scene.background = new THREE.Color(def.fog.color);
    W.lit = { hemi: hemi.intensity, fog: scene.fog.color.clone(), bg: scene.background.clone(), moon: W.moon ? W.moon.intensity : 0 };
    W.timeMode = 'night';
    W.setPower(W.power, true);
    W.updateZones();
    W.soften('=x+OT' + PERK_CH + 'MUZ');
    if (XH.sys) XH.sys.buildModels(W);
    W.drawMinimap();
    W.buildCull();
    return W;
  };

  // =================== sky ===================
  function buildSky(def, scene) {
    if (!def.sky) return;
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(def.sky.top) }, mid: { value: new THREE.Color(def.sky.mid) }, bottom: { value: new THREE.Color(def.sky.bottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top,mid,bottom; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(bottom,mix(mid,top,smoothstep(0.1,0.7,h)),smoothstep(0.0,0.15,h)) : bottom; gl_FragColor=vec4(c,1.0); }',
      side: THREE.BackSide, depthWrite: false,
    });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat));
    if (def.sky.stars) {
      const n = 1500, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const v = new THREE.Vector3(U.rand(-1, 1), U.rand(0.05, 1), U.rand(-1, 1)).normalize().multiplyScalar(460); p.set([v.x, v.y, v.z], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
    }
    if (def.sky.planet) {
      const P = def.sky.planet, dir = new THREE.Vector3(...P.dir).normalize();
      const pc = new THREE.Color(P.color);
      const pt = T('planet' + pc.getHex(), () => U.tex(U.paint(256, (u, v) => { const n = U.fbm(u * 3, v * 20 + U.fbm(u * 4, v * 4, 3, 4) * 3, 4, 3); return U.mix3([pc.r * 90, pc.g * 90, pc.b * 90], [pc.r * 255, pc.g * 255, pc.b * 255], n); })));
      const planet = new THREE.Mesh(new THREE.SphereGeometry(P.size, 32, 20), new THREE.MeshBasicMaterial({ map: pt, fog: false }));
      planet.position.copy(dir.clone().multiplyScalar(420)); planet.rotation.z = 0.4; g.add(planet);
      const shade = new THREE.Mesh(new THREE.SphereGeometry(P.size * 1.005, 32, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75, fog: false }));
      shade.position.copy(planet.position); shade.rotation.y = 2.2; g.add(shade);
      const atmo = FX.glowSprite(pc.clone().lerp(new THREE.Color(0xffffff), 0.3), P.size * 3.2, 0.35); atmo.material.fog = false; atmo.position.copy(planet.position); g.add(atmo);
      if (P.ring) {
        const rt = T('ring' + pc.getHex(), () => new THREE.CanvasTexture(U.paint(256, (u) => { const b = Math.sin(u * 60) * 0.3 + 0.6; return [pc.r * 255 * b, pc.g * 230 * b, pc.b * 200 * b, 255 * Math.max(0, Math.sin(u * Math.PI)) * 0.8]; })));
        const ringG = new THREE.RingGeometry(P.size * 1.4, P.size * 2.3, 64, 1);
        const pos = ringG.attributes.position, uv = ringG.attributes.uv;
        for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - P.size * 1.4) / (P.size * 0.9), 0.5); }
        const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false }));
        ring.position.copy(planet.position); ring.lookAt(0, 0, 0); ring.rotateX(1.2); g.add(ring);
      }
    }
    if (XH.decor && XH.decor.sky) XH.decor.sky(def, g);
    if (XH.city && XH.city.sky && def.theme === 'city') XH.city.sky(def, g);
    scene.add(g);
    W.skyRoot = g;
  }

  // Time-of-day grading applied on top of an arena's own lighting (arena option)
  W.applyTime = (mode) => {
    const sc = W.root && W.root.parent; if (!sc || mode === 'night') return;
    const k = { dusk: 1.6, day: 2.7, black: 0.42 }[mode], fk = { dusk: 0.72, day: 0.45, black: 1.45 }[mode];
    if (!k) return;
    if (W.hemi) { W.lit.hemi *= k; if (mode === 'day') { W.hemi.color.lerp(new THREE.Color(0xdde8ff), 0.6); W.hemi.groundColor.lerp(new THREE.Color(0x8a8070), 0.5); } if (mode === 'dusk') W.hemi.color.lerp(new THREE.Color(0xffb080), 0.35); }
    if (sc.fog) { sc.fog.density *= fk; const fc = W.lit.fog; if (mode === 'day') fc.lerp(new THREE.Color(0xa8b8c8), 0.7); else if (mode === 'dusk') fc.lerp(new THREE.Color(0x6a4a50), 0.5); else fc.multiplyScalar(0.35); }
    const sky = W.skyRoot && W.skyRoot.children[0] && W.skyRoot.children[0].material.uniforms;
    if (sky) { const T = { day: [0x3a78c8, 0x8ab8e8, 0xc8d8e8], dusk: [0x1a1a40, 0x6a3a60, 0xe88040], black: [0x000000, 0x020204, 0x050508] }[mode]; sky.top.value.lerp(new THREE.Color(T[0]), 0.85); sky.mid.value.lerp(new THREE.Color(T[1]), 0.85); sky.bottom.value.lerp(new THREE.Color(T[2]), 0.85); }
    if (mode === 'day' || mode === 'dusk') { const sun = new THREE.DirectionalLight(mode === 'day' ? 0xfff4e0 : 0xffa060, mode === 'day' ? 1.1 : 0.6); sun.position.set(60, 120, 40); W.root.add(sun); }
    W.timeMode = mode;
    W.setPower(W.power, true);
  };

  // =================== runtime ===================
  // Maps with a generator are dark until it is switched on: dim ambient and fog, most lights dead, a few red
  // emergency lights. Switching on brings the lights back in a wave that spreads out from the generator.
  function applyLight(L, full) {
    if (full) { L.light.color.setHex(L.color); L.light.intensity = L.base; L.glow.material.color.setHex(L.color); L.glow.material.opacity = 0.7; }
    else if (L.emergency && W.dark) { L.light.color.setHex(0xff2a18); L.glow.material.color.setHex(0xff3020); }
    else { L.light.color.setHex(L.color); L.glow.material.color.setHex(L.color); }
  }
  W.setPower = (on, instant) => {
    const was = W.power;
    W.power = on;
    W.dark = !on && !!W.def.power;
    const sc = W.root && W.root.parent, L0 = W.lit, dk = W.timeMode === 'day' ? 0.7 : W.timeMode === 'dusk' ? 0.5 : 0.3;
    if (L0) {
      if (W.hemi) W.hemi.intensity = L0.hemi * (W.dark ? dk : on ? 1 : 0.75);
      if (W.moon) W.moon.intensity = L0.moon * (W.dark ? 0.35 : 1);
      if (sc && sc.fog) sc.fog.color.copy(L0.fog).multiplyScalar(W.dark ? 0.45 : 1);
      if (sc && sc.background && sc.background.isColor) sc.background.copy(L0.bg).multiplyScalar(W.dark ? 0.45 : 1);
    }
    if (XH.weapons.setVMDark) XH.weapons.setVMDark(W.dark ? 0.5 : 1);
    if (sc && XH.main && XH.main.env) sc.environment = W.dark ? XH.main.env.dark : XH.main.env.lit; // image lighting dims with the lights
    if (XH.player && was !== on) XH.player.flashUser = null;
    const src = W.powerSwitch ? W.powerSwitch.pos : null, now = W.time || 0;
    for (const L of W.lights) {
      L.onAt = on && !instant && src ? now + 0.3 + Math.hypot(L.x - src.x, L.z - src.z) * 0.035 : 0;
      applyLight(L, on && !L.onAt);
    }
    MAT.powerGlow.color.setScalar(on ? 1 : 0.15);
    for (const p of W.perks) { p.panelMat.color.setHex(on ? 0xffffff : 0x333333); p.signMat.color.set(p.perk.color).multiplyScalar(on ? 1 : 0.25); }
    if (W.powerSwitch) { W.powerSwitch.lever.rotation.x = on ? -0.7 : 0.7; W.powerSwitch.knob.material.color.setHex(on ? 0x30ff60 : 0xff3020); W.powerSwitch.lamp.material.color.setHex(on ? 0x30ff60 : 0xff2010); }
  };
  W.openDoor = (id) => {
    const d = W.doors[id]; if (!d || d.open) return;
    d.open = true;
    for (const i of d.cells) { W.solid[i] = 0; W.hgt[i] = 0; }
    W.navDirty = true; W.fieldCache.clear(); W.updateZones(); W.drawMinimap();
    const m = d.mesh, theme = W.def.theme; let t = 0;
    XH.audio.play(theme === 'hive' ? 'membrane' : 'door', { pos: d.pos });
    if (theme === 'hive') FX.burst({ pos: d.pos.clone().setY(2), n: 60, color: 0x9a2a50, speed: [2, 8], life: [0.5, 1.2], size: [0.25, 0.1], grav: 12, add: false, jitter: 2 });
    else FX.burst({ pos: d.pos.clone().setY(0.3), n: 30, color: 0x6a6a6a, speed: [1, 3], up: 1, life: [0.8, 1.6], size: [0.6, 1.8], add: false, alpha: 0.4, jitter: 2 });
    const anim = (dt) => {
      if (t > 2) return;
      t += dt;
      const y0 = m.userData.lifted || 0;
      if ((W.def.skin || {}).door === 'stone') { m.position.y = y0 - t / 1.2 * W.def.wallH; }
      else if (theme === 'hive' || theme === 'ice') { const s = Math.max(0.001, 1 - t / 1.2); m.scale.set(s, s, s); if (theme === 'ice' && Math.random() < 0.5) FX.shatter(d.pos.clone().setY(U.rand(0.5, 4))); }
      else m.position.y = y0 - U.smooth(Math.min(1, t / 1.4)) * (W.wallH + 0.3);
      if (t > 1.5) m.visible = false;
    };
    W.anims.push(anim);
  };
  // Lamps are plain records ({ intensity, color, distance, decay, position }); only a fixed pool of real PointLights
  // exists, and each follows one of the nearest lamps. Every real light costs something on every pixel, and a
  // constant light count means shaders never recompile when lamps come and go.
  W.lampLight = (color, intensity, distance, decay, x, y, z) => ({ isLamp: true, intensity, color: new THREE.Color(color), distance, decay, position: new THREE.Vector3(x, y, z) });
  const POOL = { low: 4, medium: 8, high: 12 };
  W.updateLightPool = (dt) => {
    if (!W.root) return;
    const lamps = W.lights, cap = POOL[(XH.player.settings || {}).quality] || 8, K = Math.min(lamps.length, cap);
    let pool = W.lightPool;
    if (!pool || pool.root !== W.root || pool.slots.length !== K) {
      if (pool) for (const s of pool.slots) if (s.l.parent) s.l.parent.remove(s.l);
      pool = W.lightPool = { root: W.root, slots: [], t: 0 };
      for (let i = 0; i < K; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 1.4); W.root.add(l); pool.slots.push({ l, lamp: null, target: null, fade: 0 }); }
    }
    pool.t -= dt;
    if (pool.t <= 0) {
      pool.t = 0.2;
      const c = XH.player.cam.position;
      const pick = lamps.map((L) => { const p = L.light.position; return [L, Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) / Math.max(4, L.light.distance) + (L.light.intensity > 0.02 ? 0 : 2)]; })
        .sort((a, b) => a[1] - b[1]).slice(0, K).map((q) => q[0]);
      const want = new Set(pick), missing = pick.filter((L) => !pool.slots.some((s) => s.target === L));
      for (const s of pool.slots) if (!want.has(s.target)) s.target = missing.shift() || null;
    }
    for (const s of pool.slots) {
      if (s.lamp !== s.target) { s.fade -= dt * 6; if (s.fade <= 0 || !s.lamp) { s.fade = 0; s.lamp = s.target; } }
      else s.fade = Math.min(1, s.fade + dt * 6);
      const L = s.lamp; if (!L) { s.l.intensity = 0; continue; }
      const v = L.light; s.l.position.copy(v.position); s.l.color.copy(v.color); s.l.distance = v.distance; s.l.decay = v.decay; s.l.intensity = v.intensity * s.fade;
    }
  };
  W.update = (dt, t) => {
    for (const a of W.anims) a(dt, t);
    W.updateLightPool(dt);
    W.time = t;
    for (const L of W.lights) {
      if (W.power) {
        if (!L.onAt) continue;
        if (t >= L.onAt) { L.onAt = 0; applyLight(L, true); continue; }
        L.light.intensity = L.base * (Math.random() < 0.18 ? 0.7 : 0.02); L.glow.material.opacity = L.light.intensity > 0.1 ? 0.5 : 0.05; // stuttering on
        continue;
      }
      const f = U.tnoise(t * 8 + L.flick, L.flick, 256);
      if (W.dark && L.emergency) { L.light.intensity = L.base * (0.24 + Math.sin(t * 2.2 + L.flick) * 0.07); L.glow.material.opacity = 0.4; }
      else if (W.dark) { L.light.intensity = L.base * (f > 0.78 ? 0.1 : 0.012); L.glow.material.opacity = f > 0.78 ? 0.12 : 0.03; }
      else { L.light.intensity = L.base * (f > 0.35 ? 0.28 : 0.05); L.glow.material.opacity = 0.25; }
    }
  };

  // =================== minimap ===================
  W.drawMinimap = () => {
    const s = 4, c = W.mapCanvas || (W.mapCanvas = document.createElement('canvas'));
    c.width = W.w * s; c.height = W.h * s;
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    for (let z = 0; z < W.h; z++) for (let xx = 0; xx < W.w; xx++) {
      const i = idx(xx, z), ch = W.ch[i];
      let col = null;
      if (W.solid[i] === 2) {
        if (ch >= '0' && ch <= '9') col = '#c07020';
        else if (PERK_CH.includes(ch)) col = XH.PERKS[ch].css;
        else if (ch === 'G') col = '#ff60d0';
        else if (ch === 'K') col = '#d0d0d0';
        else if (ch === '$') col = '#b040ff';
        else if (ch === 'U') col = '#c040ff';
        else if (ch === 'M') col = '#40ffb0';
        else if (ch === 'Z') col = '#ffe040';
        else if (ch >= 'a' && ch <= 'h') col = '#30c060';
        else if (ch !== '#') col = 'rgba(120,130,140,0.55)';
      } else if (W.solid[i] === 1) col = 'rgba(120,130,140,0.35)';
      else if (W.haz[i]) col = W.haz[i] === 1 ? 'rgba(255,90,30,0.6)' : 'rgba(150,255,60,0.5)';
      else col = W.reach && W.reach[i] ? 'rgba(160,200,230,0.22)' : 'rgba(160,200,230,0.07)';
      if (col) { x.fillStyle = col; x.fillRect(xx * s, z * s, s, s); }
    }
  };
})();
