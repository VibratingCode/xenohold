'use strict';
// Zone-aware set dressing: each map's recipe (js/mapstory.js) says what belongs in each of its zones, and this file
// places it. Props go against walls (with open floor in front) or in open floor away from walls, never on doors,
// vents, spawn points or anything the player uses, and they block navigation where they stand so creatures path
// around them. Text (signs, scrawls, screens) is drawn into one atlas per style; logs are readable datapads.
// Everything static is merged into the world's material buckets.
(function () {
  const SD = XH.setdress = { placed: [], logs: [] };
  let c, B, MAT, G, U, W, rnd, root, FX, CELL, rows, occ, keep, faceUsed;
  const mats = {};
  const std = (k, o) => mats[k] || (mats[k] = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.75, metalness: 0.2 }, o)));
  const M = {
    get paint() { return std('paint', { roughness: 0.7, metalness: 0.15 }); },
    get metal() { return std('metal', { roughness: 0.45, metalness: 0.75 }); },
    get cloth() { return std('cloth', { roughness: 1, metalness: 0 }); },
    get stone() { return std('stone', { roughness: 0.95, metalness: 0, flatShading: true }); },
    get organic() { return std('organic', { roughness: 0.45, metalness: 0.05 }); },
    get glow() { return mats.glow || (mats.glow = new THREE.MeshBasicMaterial({ vertexColors: true })); },
    get glass() { return mats.glass || (mats.glass = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.3, depthWrite: false })); },
    get pool() { return mats.pool || (mats.pool = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, map: XH.fx.softTex, polygonOffset: true, polygonOffsetFactor: -3 })); },
    // lit, so paint and blood take the room's light instead of glowing in the dark (and blooming once the power is on)
    get decal() { return mats.decal || (mats.decal = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.85, roughness: 0.9, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); },
  };
  SD.M = M;
  const col = (h) => (h instanceof THREE.Color ? h : new THREE.Color(h));
  const vary = (h, v = 0.12) => col(h).clone().offsetHSL(0, 0, (rnd() - 0.5) * v);

  // ---------------- local frames: +z faces into the room, +x is to the right ----------------
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function lm(a, ox, oy, oz, sx, sy, sz, rx = 0, rz = 0, ryl = 0) {
    const cs = Math.cos(a.ry), sn = Math.sin(a.ry);
    _p.set(a.x + ox * cs + oz * sn, (a.y || 0) + oy, a.z - ox * sn + oz * cs);
    _e.set(rx, a.ry + ryl, rz, 'YXZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }
  // part(anchor, material, geometry, [x, y, z], [sx, sy, sz], color, [rx, rz, ry])
  function part(a, mat, geo, o, s, color, r) { B.add(mat, geo, lm(a, o[0], o[1], o[2], s[0], s[1], s[2], r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0), color === undefined ? undefined : col(color)); }
  const wpos = (a, ox, oz) => { const cs = Math.cos(a.ry), sn = Math.sin(a.ry); return [a.x + ox * cs + oz * sn, a.z - ox * sn + oz * cs]; };
  let inBlock = false; // a block's footprint is one collider, so the props inside it add none
  function solid(a, ox, oz, w, d, h, o) {
    if (inBlock || SD.editor) return null;
    const q = Math.abs(((a.ry % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2));
    // a long piece turned off the grid: a chain of short colliders along it instead of one big square
    if (Math.min(q, Math.PI / 2 - q) > 0.03 && Math.max(w, d) > Math.min(w, d) * 1.6) {
      const along = w >= d, len = along ? w : d, n = Math.ceil(len / Math.max(0.3, Math.min(w, d))), step = len / n, out = [];
      for (let k = 0; k < n; k++) { const t = (k + 0.5) * step - len / 2, [x, z] = wpos(a, ox + (along ? t : 0), oz + (along ? 0 : t)); out.push(W.addPropRot(x, z, along ? step : w, along ? d : step, a.ry, h, o)); }
      return out[0];
    }
    const [x, z] = wpos(a, ox, oz); return W.addPropRot(x, z, w, d, a.ry, h, o);
  }
  const sub = (a, ox, oz, dry = 0, y) => { const [x, z] = wpos(a, ox, oz); return { x, z, ry: a.ry + dry, y: y === undefined ? a.y : y }; };
  SD.lib = { part, solid, sub, lm, M, std, col, vary, wpos, glowAt: (...a) => glowAt(...a) };
  // for js/kit.js, js/hazards.js and js/traps.js, which build more kinds of entity with the same tools
  SD.random = () => rnd(); SD.G = () => G; SD.MAT = () => MAT; SD.root = () => root; SD.W = () => W;
  SD.kitMeta = {};
  SD.kit = (k, fn, meta = {}) => { P[k] = (a, o, e) => fn(a, o || {}, e); SD.propOpts[k] = meta.opts || [...new Set((fn.toString().match(/\bo\.(\w+)/g) || []).map((m) => m.slice(2)))]; SD.kitMeta[k] = meta; };


  // ---------------- zones: floors and wall faces ----------------
  const FLOORCH = '._,';
  function zoneInfo(q) {
    if (q.faces) return q;
    q.faces = []; q.floorCells = [];
    const Wd = W.w;
    for (const i of q.cells) {
      const cx = i % Wd, cz = (i / Wd) | 0;
      if (FLOORCH.includes(rows[cz][cx])) q.floorCells.push(i);
      for (const [wx, wz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ch = (rows[cz + wz] || '')[cx + wx];
        if (!(ch === '#' || (ch >= 'a' && ch <= 'w'))) continue;
        let free = 0; while (free < 5 && FLOORCH.includes((rows[cz - wz * (free + 1)] || '')[cx - wx * (free + 1)] || '#')) free++;
        q.faces.push({ i, cx, cz, dx: -wx, dz: -wz, free: free + 1, x: W.cx2x(cx) + wx * CELL / 2, z: W.cz2z(cz) + wz * CELL / 2, ry: Math.atan2(-wx, -wz) });
      }
    }
    return q;
  }
  function clearAt(x, z) { return !keep.some(([kx, kz, r]) => Math.hypot(kx - x, kz - z) < r); }
  function freeCell(cx, cz) {
    if (!W.inside(cx, cz)) return false;
    const i = cz * W.w + cx;
    if (occ[i] || W.solid[i] || W.haz[i] || !FLOORCH.includes(rows[cz][cx])) return false;
    return clearAt(W.cx2x(cx), W.cz2z(cz));
  }
  let navPend = [];
  function navBlock(i) { W.solid[i] = 2; if (W.soft) W.soft[i] = 1; W.hgt[i] = 0; if (SD.rec) navPend.push(i); }
  // a wall face with `need` cells of open floor in front (so the room stays open); span 2 = two faces side by side
  function wallSlot(q, o = {}) {
    const need = o.need || 3, span = o.span || 1;
    const fk = (f) => f.i + ':' + f.dx + ':' + f.dz;
    const cands = zoneInfo(q).faces.filter((f) => f.free >= need && !faceUsed.has(fk(f)) && (o.decal ? !W.solid[f.i] && clearAt(f.x, f.z) : freeCell(f.cx, f.cz)));
    const ok = [];
    for (const f of cands) {
      if (span === 1) { ok.push([f]); continue; }
      const tx = f.dz, tz = -f.dx, g = q.faces.find((h) => h.cx === f.cx + tx && h.cz === f.cz + tz && h.dx === f.dx && h.dz === f.dz && h.free >= need);
      if (g && (o.decal || freeCell(g.cx, g.cz)) && !faceUsed.has(fk(g))) ok.push([f, g]);
    }
    if (!ok.length) return null;
    const pick = o.near ? ok.sort((A, Bq) => dist2(A[0], o.near) - dist2(Bq[0], o.near))[0] : ok[Math.floor(rnd() * ok.length)];
    for (const f of pick) { faceUsed.add(fk(f)); if (!o.decal) { occ[f.i] = 1; if (o.block !== false) navBlock(f.i); } }
    const x = pick.reduce((s, f) => s + f.x, 0) / pick.length, z = pick.reduce((s, f) => s + f.z, 0) / pick.length;
    return { x, z, ry: pick[0].ry, y: 0, face: pick[0], width: span * CELL };
  }
  const dist2 = (f, p) => (f.x - p.x) ** 2 + (f.z - p.z) ** 2;
  // open floor away from walls: w x d cells with a ring of free cells around (paths stay open)
  function floorSlot(q, o = {}) {
    const w = o.w || 1, d = o.d || 1, margin = o.margin === undefined ? 1 : o.margin, Wd = W.w;
    const cands = [];
    for (const i of zoneInfo(q).floorCells) {
      const x0 = i % Wd, z0 = (i / Wd) | 0;
      let ok = true;
      for (let z = z0 - margin; z < z0 + d + margin && ok; z++) for (let x = x0 - margin; x < x0 + w + margin && ok; x++) {
        const inner = x >= x0 && x < x0 + w && z >= z0 && z < z0 + d;
        if (inner) { if (!freeCell(x, z)) ok = false; } // the ring around must stay walkable: no walls, cover or other props
        else if (!W.inside(x, z) || occ[z * Wd + x] || W.solid[z * Wd + x]) ok = false;
      }
      if (ok) cands.push({ x0, z0 });
    }
    if (!cands.length) return null;
    let c0;
    if (o.center) { const cx = q.fx !== undefined ? W.cellX(q.fx) : q.cx, cz = q.fz !== undefined ? W.cellZ(q.fz) : q.cz; cands.sort((A, Bq) => Math.hypot(A.x0 + w / 2 - cx, A.z0 + d / 2 - cz) - Math.hypot(Bq.x0 + w / 2 - cx, Bq.z0 + d / 2 - cz)); c0 = cands[Math.min(cands.length - 1, Math.floor(rnd() * Math.min(3, cands.length)))]; }
    else c0 = cands[Math.floor(rnd() * cands.length)];
    for (let z = c0.z0; z < c0.z0 + d; z++) for (let x = c0.x0; x < c0.x0 + w; x++) { const i = z * Wd + x; occ[i] = 1; if (o.block !== false) navBlock(i); }
    return { x: W.cx2x(c0.x0) + (w - 1) * CELL / 2, z: W.cz2z(c0.z0) + (d - 1) * CELL / 2, ry: o.ry !== undefined ? o.ry : Math.floor(rnd() * 4) * Math.PI / 2 + (o.jitter ? (rnd() - 0.5) * o.jitter : 0), y: 0, w: w * CELL, d: d * CELL };
  }
  // a decal spot: any open floor in the zone (does not take the cell)
  function decalSpot(q) { const l = zoneInfo(q).floorCells.filter((i) => !occ[i] && !W.haz[i] && clearAt(W.cx2x(i % W.w), W.cz2z((i / W.w) | 0))); if (!l.length) return null; const i = l[Math.floor(rnd() * l.length)]; return { x: W.cx2x(i % W.w) + (rnd() - 0.5) * 1.2, z: W.cz2z((i / W.w) | 0) + (rnd() - 0.5) * 1.2, ry: rnd() * 6.28, y: 0 }; }

  // ---------------- floors: each zone gets the surface it would have ----------------
  const FLOORS = {
    plank: [(u, v, x, y) => { const b = Math.floor(y / 16), n = U.fbm(u * 8, v * 2 + b * 0.37, 3, 8); let c = 92 + n * 46 + ((b * 37) % 22); if (y % 16 < 1) c -= 45; if ((x + b * 53) % 128 < 1) c -= 35; return [c * 1.05, c * 0.76, c * 0.52]; }, 0.85, 0],
    plate: [(u, v, x, y) => { let c = 96 + U.fbm(u * 6, v * 6, 3, 6) * 24; const d1 = (x + y) % 16, d2 = (x - y + 256) % 16; if ((d1 < 2 && y % 16 < 8) || (d2 < 2 && y % 16 >= 8)) c += 38; if (x % 64 < 1 || y % 64 < 1) c -= 40; return [c, c * 1.02, c * 1.06]; }, 0.45, 0.7],
    tile: [(u, v, x, y) => { let c = 138 + U.fbm(u * 5, v * 5, 3, 5) * 22; if (x % 32 < 1 || y % 32 < 1) c -= 70; return [c, c, c * 1.02]; }, 0.3, 0.05],
    grate: [(u, v, x, y) => { const bar = x % 8 < 3 || y % 8 < 3; const c = bar ? 88 + U.fbm(u * 6, v * 6, 2, 6) * 20 : 18; return [c, c * 1.03, c * 1.08]; }, 0.5, 0.75],
    concrete: [(u, v, x, y) => { let c = 138 + U.fbm(u * 6, v * 6, 4, 6) * 34; if (x % 64 < 1 || y % 64 < 1) c -= 48; return [c, c * 0.98, c * 0.95]; }, 0.9, 0],
    oil: [(u, v, x, y) => { let c = 120 + U.fbm(u * 6, v * 6, 4, 6) * 30; const st = U.fbm(u * 3 + 7, v * 3, 3, 3); if (st > 0.62) c -= (st - 0.62) * 300; if (x % 128 < 5 && y % 32 < 20) return [200, 170, 40]; return [c, c * 0.97, c * 0.92]; }, 0.7, 0.05],
    gravel: [(u, v, x, y) => { const n = U.fbm(u * 24, v * 24, 2, 24); const c = 88 + n * 70; return [c * 0.96, c * 0.93, c * 0.88]; }, 1, 0],
    carpet: [(u, v, x, y) => { const n = U.fbm(u * 16, v * 16, 2, 16); const c = 0.8 + n * 0.3; return [58 * c, 72 * c, 96 * c]; }, 1, 0],
    rubber: [(u, v, x, y) => { const d = ((x % 12) - 6) ** 2 + ((y % 12) - 6) ** 2; const c = 34 + (d < 5 ? 16 : 0) + U.fbm(u * 8, v * 8, 2, 8) * 10; return [c, c, c]; }, 0.95, 0],
    lino: [(u, v, x, y) => { const n = U.fbm(u * 10, v * 10, 3, 10); let c = 190 + n * 18; if (x % 64 < 1 || y % 64 < 1) c -= 40; return [c * 0.88, c * 0.97, c * 0.92]; }, 0.35, 0],
    metal: [(u, v, x, y) => { let c = 70 + U.fbm(u * 2, v * 30, 2, 2) * 30; if (x % 42 < 1 || y % 64 < 1) c -= 28; return [c, c * 1.04, c * 1.1]; }, 0.4, 0.8],
  };
  const floorMats = {}, FLOOR_LUM = 0.24; // brightest average a floor may have (the arena floors sit around 0.12 to 0.21)
  function floorMat(style) {
    if (!floorMats[style]) {
      const [fn, rough, metal] = FLOORS[style], cv = U.paint(128, fn), t = U.tex(cv); t.anisotropy = 4;
      // keep every floor as dark as the game's own floors, so powered lights do not blow it out into bloom
      let lum = 0.4; try { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722; lum = sum / (d.length / 4) / 255; } catch (e) { /* keep the default */ }
      const k = Math.min(1, FLOOR_LUM / Math.max(0.01, lum));
      floorMats[style] = new THREE.MeshStandardMaterial({ map: t, color: new THREE.Color(k, k, k), roughness: Math.max(0.45, rough), metalness: metal, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 });
    }
    return floorMats[style];
  }
  const cellHash = (i, k) => { let h = Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 40503); h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
  function layCell(i, style) {
    const Wd = W.w, row = rows[(i / Wd) | 0]; if (!FLOORS[style] || !row || row[i % Wd] !== '.' || W.rdir[i]) return;
    const c0 = 0.9 + cellHash(i, 1) * 0.12;
    B.add(floorMat(style), G.plane, U.mat(W.cx2x(i % Wd), 0.006, W.cz2z((i / Wd) | 0), -Math.PI / 2, 0, Math.floor(cellHash(i, 2) * 4) * Math.PI / 2, CELL, CELL, 1), new THREE.Color(c0, c0, c0));
    if (SD.recFloors) SD.recFloors[i] = style;
  }
  function lay(q, style) { if (FLOORS[style]) for (const i of zoneInfo(q).floorCells) layCell(i, style); }
  // floor styles as one letter each, for the saved floor string (one letter per cell, '.' for none)
  SD.FLOORCODE = { plank: 'p', plate: 't', tile: 'i', grate: 'g', concrete: 'c', oil: 'o', gravel: 'r', carpet: 'k', rubber: 'u', lino: 'n', metal: 'm' };
  SD.FLOORSTYLE = Object.fromEntries(Object.entries(SD.FLOORCODE).map(([k, v]) => [v, k]));

  // ---------------- text: signs, scrawls and screens drawn into atlases ----------------
  const texts = { sign: [], paint: [], screen: [] };
  function textDecal(a, text, style, w, h, y, o = {}) { return asEntity(depth === 0 && SD.rec ? { k: '@text', x: rnd3(a.x), z: rnd3(a.z), ry: rnd3(a.ry || 0), text, style, w, h, ty: y, o: plain(o) } : null, () => textDecal0(a, text, style, w, h, y, o)); }
  function textDecal0(a, text, style, w, h, y, o = {}) { SD.placed.push([SD.curZone, style + ': ' + text]); texts[style].push({ a: { x: a.x, z: a.z, ry: a.ry }, text, w, h, y, o }); }
  function buildTexts() {
    for (const style of ['sign', 'paint', 'screen']) for (let c0 = 0; c0 < texts[style].length; c0 += 16) {
      const list = texts[style].slice(c0, c0 + 16), HT = 128 * Math.ceil(list.length / 2), fr = 128 / HT;
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = HT; const x = cv.getContext('2d');
      x.clearRect(0, 0, 1024, HT);
      list.forEach((q, k) => {
        const x0 = (k % 2) * 512, y0 = Math.floor(k / 2) * 128, color = q.o.color || (style === 'paint' ? '#8a0a0a' : style === 'screen' ? '#60e8ff' : '#e8e0c8');
        x.save(); x.beginPath(); x.rect(x0, y0, 512, 128); x.clip();
        if (style === 'sign') {
          x.fillStyle = q.o.bg || '#15181b'; x.fillRect(x0 + 4, y0 + 4, 504, 120); x.strokeStyle = color; x.lineWidth = 5; x.strokeRect(x0 + 10, y0 + 10, 492, 108);
          if (q.o.stripes) for (let s = 0; s < 12; s++) { x.fillStyle = s % 2 ? '#e0b020' : '#151515'; x.fillRect(x0 + 10 + s * 41, y0 + 104, 41, 14); }
          x.fillStyle = color; x.font = `bold ${q.text.length > 18 ? 40 : q.text.length > 12 ? 52 : 62}px Orbitron, Consolas, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(q.text, x0 + 256, y0 + (q.o.stripes ? 58 : 66));
          for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.35})`; x.fillRect(x0 + Math.random() * 512, y0 + Math.random() * 128, Math.random() * 10, Math.random() * 3); }
        } else if (style === 'paint') {
          x.fillStyle = color; x.font = `bold ${q.text.length > 22 ? 40 : 54}px "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive`; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.translate(x0 + 256, y0 + 60); x.rotate((Math.random() - 0.5) * 0.08); x.fillText(q.text, 0, 0);
          for (let i = 0; i < 14; i++) { const dx = (Math.random() - 0.5) * 420, len = 8 + Math.random() * 40; x.fillRect(dx, 8, 3, len); }
        } else {
          x.fillStyle = '#04080c'; x.fillRect(x0, y0, 512, 128);
          x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 12; x.font = `bold ${q.text.length > 20 ? 34 : 46}px Consolas, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
          const lines = q.text.split('\n'); lines.forEach((l, li) => x.fillText(l, x0 + 256, y0 + 64 + (li - (lines.length - 1) / 2) * 44));
          x.shadowBlur = 0; for (let yy = 0; yy < 128; yy += 4) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(x0, y0 + yy, 512, 1); }
        }
        x.restore();
      });
      const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; tex.userData = { transient: true };
      const mat = style === 'screen' ? new THREE.MeshBasicMaterial({ map: tex, vertexColors: true })
        : style === 'paint' ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 })
          : new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6, vertexColors: true });
      list.forEach((q, k) => {
        const u0 = (k % 2) * 0.5, v1 = 1 - Math.floor(k / 2) * fr, g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v1 - fr + uv.getY(i) * fr);
        B.add(mat, g, lm(q.a, 0, q.y, 0.04, q.w, q.h, 1), new THREE.Color(1, 1, 1));
      });
    }
  }
  SD.text = textDecal;

  // ---------------- readable logs ----------------
  SD.logs = [];
  function datapad(a, log, y = 0) { return asEntity(depth === 0 && SD.rec ? { k: '@log', x: rnd3(a.x), z: rnd3(a.z), y: rnd3(a.y || 0), ry: rnd3(a.ry || 0), h: y, log: plain(log) } : null, () => datapad0(a, log, y)); }
  function datapad0(a, log, y = 0) {
    const pos = new THREE.Vector3(a.x, (a.y || 0) + y, a.z);
    part({ x: pos.x, z: pos.z, ry: a.ry + 0.4, y: pos.y }, M.paint, G.box, [0, 0.02, 0], [0.34, 0.03, 0.24], 0x202428);
    part({ x: pos.x, z: pos.z, ry: a.ry + 0.4, y: pos.y }, M.glow, G.box, [0, 0.04, 0], [0.28, 0.005, 0.18], 0x40d0a0);
    const g = FX.glowSprite(0x60ffc0, 0.9, 0.55); g.position.set(pos.x, pos.y + 0.2, pos.z); root.add(g);
    SD.logs.push({ pos, log, g, read: false });
  }

  // ---------------- builders ----------------
  // wall props take an anchor on the wall facing into the room; floor props take the centre of their cells
  const P = SD.props = {};
  const BLOOD = 0x3a0406;
  P.bunk = (a, o = {}) => {
    for (const [x, z] of [[-1, 0.1], [1, 0.1], [-1, 0.95], [1, 0.95]]) part(a, M.metal, G.box, [x, 0.95, z], [0.06, 1.9, 0.06], 0x4a4e52);
    for (const y of [0.45, 1.35]) { part(a, M.metal, G.box, [0, y, 0.52], [2.05, 0.08, 0.9], 0x4a4e52); part(a, M.cloth, G.box, [0, y + 0.1, 0.52], [1.95, 0.12, 0.84], o.sheet || vary(0x6a7a5a)); part(a, M.cloth, G.box, [-0.75, y + 0.2, 0.52], [0.35, 0.1, 0.6], 0xd8d8d0); }
    if (rnd() < 0.4) part(a, M.cloth, G.box, [0.2, 0.62, 0.62], [1.2, 0.04, 0.9], vary(0x3a4a6a), [0, 0.1, 0.2]); // blanket half off
    solid(a, 0, 0.52, 2.1, 0.95, 1.9);
  };
  P.lockers = (a, o = {}) => {
    const c = o.color || vary(0x4a5a6a);
    for (let k = -1; k <= 1; k++) {
      const open = rnd() < 0.3;
      part(a, M.paint, G.box, [k * 0.62, 1.0, 0.28], [0.6, 2.0, 0.55], c);
      part(a, M.paint, G.box, [k * 0.62 + (open ? 0.28 : 0), 1.0, open ? 0.85 : 0.56], [open ? 0.04 : 0.56, 1.9, open ? 0.56 : 0.03], col(c).clone().multiplyScalar(0.85));
      for (let s = 0; s < 3; s++) part(a, M.metal, G.box, [k * 0.62, 1.65 - s * 0.06, 0.58], [0.3, 0.02, 0.02], 0x202020);
    }
    solid(a, 0, 0.28, 1.9, 0.6, 2.0);
  };
  P.shelf = (a, o = {}) => {
    for (const x of [-0.95, 0.95]) part(a, M.metal, G.box, [x, 1.1, 0.3], [0.06, 2.2, 0.6], 0x505458);
    for (const y of [0.3, 0.95, 1.6]) {
      part(a, M.metal, G.box, [0, y, 0.3], [1.95, 0.05, 0.6], 0x505458);
      for (let k = 0; k < 4; k++) { if (rnd() < 0.25) continue; const s = 0.2 + rnd() * 0.22; if (o.jars) { part(a, M.glass, G.cyl, [-0.7 + k * 0.46, y + 0.2, 0.3], [0.13, 0.36, 0.13], 0xc8f0e0); part(a, M.glow, G.sphere, [-0.7 + k * 0.46, y + 0.18, 0.3], [0.07, 0.1, 0.07], o.jars); } else part(a, M.paint, G.box, [-0.7 + k * 0.46, y + s / 2 + 0.03, 0.3], [0.38, s, 0.42], vary(o.color || 0x8a7050, 0.3)); }
    }
    solid(a, 0, 0.3, 2.0, 0.62, 2.2);
  };
  P.console = (a, o = {}) => {
    part(a, M.paint, G.box, [0, 0.45, 0.5], [2.0, 0.9, 0.8], o.color || 0x3a4048);
    part(a, M.paint, G.box, [0, 1.0, 0.25], [2.0, 0.25, 0.4], o.color || 0x3a4048, [-0.5, 0, 0]);
    for (const x of [-0.5, 0.5]) { part(a, M.metal, G.box, [x, 1.45, 0.12], [0.8, 0.55, 0.06], 0x1a1c1e); part(a, M.glow, G.plane, [x, 1.45, 0.16], [0.72, 0.47, 1], o.screen || (rnd() < 0.3 ? 0xa02020 : 0x2a8aa0)); }
    for (let k = 0; k < 8; k++) part(a, M.glow, G.box, [-0.8 + k * 0.23, 0.93, 0.48], [0.06, 0.02, 0.06], [0x30ff60, 0xffb020, 0xff3030][k % 3]);
    if (o.chair !== false) { const tip = rnd() < 0.5; part(a, M.paint, G.box, [0.3, tip ? 0.25 : 0.5, tip ? 1.5 : 1.25], [0.5, 0.08, 0.5], 0x2a2a2a, tip ? [1.4, 0.2] : undefined); part(a, M.paint, G.box, [0.3, tip ? 0.3 : 0.85, tip ? 1.85 : 1.5], [0.5, 0.6, 0.08], 0x2a2a2a, tip ? [1.4, 0.2] : undefined); }
    if (o.text) textDecal(sub(a, 0, 0.2), o.text, 'screen', 1.6, 0.4, 2.05, { color: o.textColor || '#ff5040' });
    solid(a, 0, 0.5, 2.0, 0.85, 1.0);
  };
  P.racks = (a) => {
    for (const x of [-0.5, 0.5]) { part(a, M.paint, G.box, [x, 1.05, 0.45], [0.8, 2.1, 0.85], 0x1c1e22); for (let k = 0; k < 7; k++) part(a, M.glow, G.box, [x - 0.25 + rnd() * 0.5, 0.3 + k * 0.26, 0.88], [0.05, 0.03, 0.02], rnd() < 0.2 ? 0xff3030 : 0x40ff80); }
    solid(a, 0, 0.45, 1.7, 0.9, 2.1);
  };
  P.workbench = (a) => {
    part(a, M.paint, G.box, [0, 0.9, 0.45], [2.0, 0.08, 0.85], 0x6a5040);
    for (const [x, z] of [[-0.9, 0.1], [0.9, 0.1], [-0.9, 0.8], [0.9, 0.8]]) part(a, M.metal, G.box, [x, 0.45, z], [0.07, 0.9, 0.07], 0x404448);
    part(a, M.paint, G.box, [0, 1.7, 0.05], [2.0, 1.2, 0.05], 0x8a7a5a);
    for (let k = 0; k < 7; k++) part(a, M.metal, G.box, [-0.8 + k * 0.27, 1.6 + rnd() * 0.3, 0.1], [0.05, 0.3 + rnd() * 0.3, 0.04], 0x707478, [0, (rnd() - 0.5) * 0.4]);
    part(a, M.metal, G.box, [0.6, 1.02, 0.45], [0.25, 0.18, 0.2], 0x3a4a6a); part(a, M.paint, G.box, [-0.5, 0.98, 0.5], [0.5, 0.1, 0.3], 0xa02020);
    solid(a, 0, 0.45, 2.0, 0.9, 0.95);
  };
  P.gunRack = (a) => {
    part(a, M.paint, G.box, [0, 1.0, 0.12], [1.9, 1.6, 0.1], 0x3a3a30); part(a, M.paint, G.box, [0, 0.3, 0.25], [1.9, 0.1, 0.35], 0x3a3a30);
    for (let k = 0; k < 6; k++) { if (rnd() < 0.3) continue; part(a, M.metal, G.box, [-0.8 + k * 0.32, 0.95, 0.22], [0.08, 1.2, 0.14], 0x1a1c1e, [0, 0.06]); }
    solid(a, 0, 0.2, 1.9, 0.45, 1.8);
  };
  P.cryo = (a, o = {}) => {
    part(a, M.paint, G.box, [0, 1.1, 0.4], [1.3, 2.2, 0.8], 0xd8dce0); part(a, M.glow, G.plane, [0, 1.2, 0.81], [0.9, 1.5, 1], o.glow || 0x80d0ff);
    part(a, M.metal, G.box, [0.52, 1.1, 0.82], [0.05, 0.5, 0.04], 0x303030);
    solid(a, 0, 0.4, 1.3, 0.8, 2.2);
  };
  P.labBench = (a, o = {}) => {
    part(a, M.paint, G.box, [0, 0.45, 0.45], [2.0, 0.9, 0.85], 0xe0e4e8); part(a, M.paint, G.box, [0, 0.92, 0.45], [2.02, 0.04, 0.88], 0x202428);
    part(a, M.metal, G.cyl, [-0.6, 1.1, 0.45], [0.14, 0.3, 0.14], 0x404448); part(a, M.metal, G.box, [-0.6, 1.3, 0.52], [0.06, 0.25, 0.3], 0x404448, [0.4, 0]); // microscope
    part(a, M.paint, G.cyl, [0.1, 1.05, 0.4], [0.22, 0.2, 0.22], 0xe8e8e8); // centrifuge
    for (let k = 0; k < 4; k++) { part(a, M.glass, G.cyl, [0.55 + k * 0.13, 1.05, 0.5], [0.05, 0.2, 0.05], 0xffffff); part(a, M.glow, G.cyl, [0.55 + k * 0.13, 1.0, 0.5], [0.045, 0.1, 0.045], o.fluid || [0x40ffa0, 0x60c0ff, 0xff6080][k % 3]); }
    solid(a, 0, 0.45, 2.0, 0.88, 1.0);
  };
  P.tanks = (a, o = {}) => {
    for (const x of [-0.55, 0.55]) { part(a, M.paint, G.cyl, [x, 1.2, 0.55], [0.5, 2.4, 0.5], o.color || vary(0xb0b4b8)); part(a, M.metal, G.cyl, [x, 2.5, 0.55], [0.1, 0.3, 0.1], 0x505050); part(a, M.paint, G.box, [x, 1.2, 1.06], [0.3, 0.4, 0.02], 0xe0b020); }
    part(a, M.metal, G.cyl, [0, 2.6, 0.3], [0.08, 1.4, 0.08], 0x505458, [0, Math.PI / 2]);
    solid(a, 0, 0.55, 2.1, 1.05, 2.6);
  };
  P.generator = (a) => {
    part(a, M.paint, G.box, [0, 0.65, 0.65], [1.8, 1.3, 1.1], 0x5a6a3a); part(a, M.metal, G.cyl, [0.6, 1.6, 0.4], [0.1, 0.8, 0.1], 0x303030);
    part(a, M.paint, G.box, [0, 0.2, 1.21], [1.8, 0.15, 0.02], 0xe0b020); part(a, M.glow, G.box, [-0.6, 1.0, 1.21], [0.12, 0.08, 0.02], 0x30ff60);
    solid(a, 0, 0.65, 1.8, 1.1, 1.3);
  };
  P.pump = (a) => {
    part(a, M.paint, G.cyl, [0, 0.8, 0.8], [0.7, 1.6, 0.7], 0x4a6a7a, [Math.PI / 2, 0]); part(a, M.metal, G.cyl, [0, 0.8, 0.1], [0.3, 0.6, 0.3], 0x404448, [Math.PI / 2, 0]);
    part(a, M.metal, G.torus, [0.9, 1.3, 0.8], [0.35, 0.35, 0.35], 0xa02020, [0, 0, Math.PI / 2]); part(a, M.metal, G.cyl, [0, 1.8, 0.8], [0.15, 0.8, 0.15], 0x404448);
    part(a, M.paint, G.box, [-0.9, 1.3, 0.6], [0.3, 0.3, 0.1], 0xe0e0e0); part(a, M.glow, G.cyl, [-0.9, 1.3, 0.66], [0.1, 0.01, 0.1], 0x30ff60, [Math.PI / 2, 0]);
    solid(a, 0, 0.8, 1.6, 1.5, 1.7);
  };
  P.evaRack = (a) => {
    part(a, M.metal, G.box, [0, 2.0, 0.3], [2.0, 0.08, 0.08], 0x505458);
    for (const x of [-0.55, 0.55]) { part(a, M.paint, G.box, [x, 1.25, 0.35], [0.55, 0.8, 0.35], 0xe0e0e0); part(a, M.paint, G.sphere, [x, 1.8, 0.35], [0.24, 0.26, 0.24], 0xe8e8e8); part(a, M.glow, G.sphere, [x, 1.8, 0.47], [0.16, 0.14, 0.1], 0xd0a030); part(a, M.paint, G.box, [x - 0.14, 0.45, 0.35], [0.2, 0.8, 0.25], 0xd8d8d8); part(a, M.paint, G.box, [x + 0.14, 0.45, 0.35], [0.2, 0.8, 0.25], 0xd8d8d8); }
    solid(a, 0, 0.35, 2.0, 0.5, 2.0);
  };
  P.dispenser = (a) => { part(a, M.paint, G.box, [0, 1.0, 0.35], [1.1, 2.0, 0.7], 0xc8ccd0); part(a, M.glow, G.plane, [0, 1.4, 0.71], [0.8, 0.5, 1], 0xffb040); part(a, M.metal, G.box, [0, 0.8, 0.72], [0.6, 0.35, 0.04], 0x202020); solid(a, 0, 0.35, 1.1, 0.7, 2.0); };
  P.capacitors = (a) => { for (const x of [-0.6, 0, 0.6]) { part(a, M.paint, G.cyl, [x, 0.9, 0.45], [0.26, 1.8, 0.26], 0x6a7078); for (let k = 0; k < 4; k++) part(a, M.glow, G.torus, [x, 0.4 + k * 0.4, 0.45], [0.28, 0.28, 0.2], 0x60a0ff, [Math.PI / 2, 0]); } solid(a, 0, 0.45, 1.8, 0.6, 1.8); };
  P.furnace = (a) => { part(a, M.stone, G.box, [0, 1.3, 0.35], [2.0, 2.6, 0.7], 0x3a302a); part(a, M.glow, G.plane, [0, 0.9, 0.71], [1.1, 0.9, 1], 0xff7020); part(a, M.metal, G.box, [0, 2.7, 0.35], [0.8, 0.3, 0.5], 0x2a2420); glowAt(sub(a, 0, 1.0), 1.0, 0xff6020, 3.2, 0.5); embers.push(sub(a, 0, 0.9)); solid(a, 0, 0.35, 2.0, 0.7, 2.6); };
  P.cocoon = (a, o = {}) => { // a victim wrapped and stuck to the wall
    const y = o.y || 1.2;
    part(a, M.organic, G.sphere, [0, y, 0.35], [0.45, 1.0, 0.35], o.color || 0x6a5a4a); part(a, M.organic, G.sphere, [0, y + 0.85, 0.3], [0.22, 0.26, 0.22], o.color || 0x6a5a4a);
    for (let k = 0; k < 5; k++) part(a, M.organic, G.cyl, [(rnd() - 0.5) * 1.2, y + (rnd() - 0.2) * 1.4, 0.1], [0.03, 0.9 + rnd(), 0.03], 0x4a3a2a, [(rnd() - 0.5), (rnd() - 0.5) * 2]);
    if (o.glow !== false) glowAt(sub(a, 0, 0.4), y, 0xffa040, 1.6, 0.35);
  };
  // decorations that live on the wall itself (no floor used)
  P.pipes = (a) => { for (const [y, r] of [[2.6, 0.14], [3.0, 0.09], [3.3, 0.06]]) part(a, M.metal, G.cyl, [0, y, 0.18], [r, CELL + 0.02, r], 0x6a5a4a, [0, 0, Math.PI / 2]); };
  P.panel = (a) => { part(a, M.paint, G.box, [0, 1.5, 0.06], [0.7, 0.9, 0.12], 0x5a6068); part(a, M.paint, G.box, [0, 1.95, 0.08], [0.72, 0.06, 0.14], 0xe0b020); part(a, M.glow, G.box, [0.2, 1.75, 0.13], [0.06, 0.06, 0.02], rnd() < 0.5 ? 0xff3030 : 0x30ff60); blinkers.push(sub(a, 0.2, 0.2, 0, 1.75)); };
  P.claws = (a) => { for (let k = 0; k < 4; k++) part(a, M.decal, G.plane, [(k - 1.5) * 0.14, 1.6 + rnd() * 0.3, 0.03], [0.05, 0.9, 1], 0x0a0a0a, [0, 0.3]); };
  P.floodLines = (a) => { for (const [y, h] of [[0.5, 0.18], [1.1, 0.08], [1.6, 0.05]]) part(a, M.decal, G.plane, [0, y, 0.03], [CELL, h, 1], 0x1a1c10); };
  P.skulls = (a) => { for (let k = 0; k < 12; k++) part(a, MAT.bone, G.sphere, [(rnd() - 0.5) * 2, 0.4 + rnd() * 2.6, 0.08], [0.16, 0.19, 0.14], 0xd8ccb0); };
  P.window = (a) => { part(a, M.metal, G.box, [0, 2.3, 0.04], [2.1, 1.5, 0.06], 0x505a68); part(a, M.glow, G.plane, [0, 2.3, 0.08], [1.9, 1.3, 1], 0x02040c); for (let k = 0; k < 14; k++) part(a, M.glow, G.box, [(rnd() - 0.5) * 1.8, 1.7 + rnd() * 1.2, 0.085], [0.02, 0.02, 0.005], 0xffffff); };
  P.iceGiant = (a) => { // something enormous inside the ice wall
    for (let k = 0; k < 6; k++) part(a, MAT.flesh, G.sphere, [(k - 2.5) * 0.9, 1.6 + Math.sin(k) * 0.6, -0.2], [1.1, 0.9 + rnd() * 0.5, 0.6], 0x201830);
    for (let k = 0; k < 4; k++) part(a, MAT.bone, G.cone, [(k - 1.5) * 1.2, 3.2, -0.1], [0.25, 1.6, 0.25], 0xd8d0c0, [0.4, (rnd() - 0.5)]);
    part(a, M.glow, G.sphere, [0.6, 2.2, 0.1], [0.3, 0.2, 0.05], 0xffc040);
    part(a, M.glass, G.box, [0, 2.3, 0.35], [CELL * 2.2, 4.6, 0.3], 0xa8d8ff);
    glowAt(sub(a, 0.6, 0.6), 2.2, 0xffc040, 2, 0.4);
  };
  P.frozenFall = (a) => { for (let k = 0; k < 7; k++) { const x = (k - 3) * 0.32, h = 3 + rnd() * 2; part(a, M.glass, G.cone, [x, h / 2 + 0.2, 0.25 + rnd() * 0.2], [0.25, h, 0.25], 0xd8f0ff, [Math.PI, 0]); } part(a, M.glass, G.box, [0, 0.2, 0.5], [2.2, 0.4, 0.8], 0xd8f0ff); solid(a, 0, 0.45, 2.2, 0.9, 1.0); };
  // small detail that does not get in the way: no collider, nothing to trip over
  P.debris = (a, o = {}) => {
    for (let k = 0; k < 5; k++) part(a, M.paint, G.box, [(rnd() - 0.5) * 1.6, 0.012, (rnd() - 0.5) * 1.6], [0.22, 0.004, 0.3], 0xd8d4c8, [0, 0, rnd() * 3]); // papers
    for (let k = 0; k < 2; k++) part(a, M.paint, G.cyl, [(rnd() - 0.5) * 1.4, 0.05, (rnd() - 0.5) * 1.4], [0.04, 0.12, 0.04], [0xa02020, 0x2a6a2a, 0xd8a020][k % 3], [Math.PI / 2, 0, rnd() * 3]); // cans
    if (o.box !== false) part(a, M.paint, G.box, [(rnd() - 0.5) * 1.2, 0.12, (rnd() - 0.5) * 1.2], [0.35, 0.24, 0.3], vary(0x8a7050), [0, 0, rnd()]);
  };
  P.lamp = (a, o = {}) => { // a caged wall lamp and the pool of light under it
    const c = o.color || 0xffe0a0;
    part(a, M.metal, G.box, [0, 2.9, 0.12], [0.35, 0.18, 0.24], 0x303438); part(a, M.glow, G.box, [0, 2.8, 0.16], [0.28, 0.06, 0.18], c);
    part(a, M.pool, new THREE.CircleGeometry(1, 16), [0, 0.02, 1.0], [2.0, 1.6, 1], c, [-Math.PI / 2, 0]);
    part(a, M.pool, new THREE.PlaneGeometry(1, 1), [0, 2.0, 0.05], [1.4, 1.8, 1], c);
  };
  P.stripes = (a) => { for (let k = 0; k < 8; k++) part(a, M.decal, G.plane, [(k - 3.5) * 0.3, 0.013, 0.45], [0.16, 0.5, 1], k % 2 ? 0xd8a020 : 0x151515, [-Math.PI / 2, 0, 0.6]); };
  P.cables = (a) => { for (let k = 0; k < 3; k++) part(a, M.paint, G.cyl, [0, 0.03 + k * 0.03, 0.2 + k * 0.08], [0.03, CELL, 0.03], [0x151515, 0xa02020, 0x2a4a8a][k], [0, 0, Math.PI / 2]); };
  P.vines = (a) => { for (let k = 0; k < 5; k++) { const len = 1 + rnd() * 3; part(a, M.organic, G.cyl, [(rnd() - 0.5) * 2.2, 5 - len / 2, 0.1], [0.035, len, 0.035], 0x2a5a24); } };
  P.grime = (a) => part(a, M.decal, G.plane, [0, 1.4, 0.03], [1.6 + rnd() * 0.6, 2.6, 1], 0x1a2010);
  // floor props
  P.table = (a, o = {}) => {
    part(a, M.paint, G.box, [0, 0.78, 0], [2.0, 0.06, 1.0], o.color || 0x6a6058);
    for (const [x, z] of [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]]) part(a, M.metal, G.box, [x, 0.38, z], [0.06, 0.76, 0.06], 0x404040);
    if (o.map) { part(a, M.paint, G.box, [0, 0.82, 0], [1.8, 0.01, 0.85], 0x4a6a4a); for (let k = 0; k < 6; k++) part(a, M.glow, G.box, [(rnd() - 0.5) * 1.5, 0.84, (rnd() - 0.5) * 0.7], [0.06, 0.03, 0.06], rnd() < 0.5 ? 0xff3020 : 0x30a0ff); }
    else for (let k = 0; k < 3; k++) part(a, M.paint, G.box, [(rnd() - 0.5) * 1.4, 0.83, (rnd() - 0.5) * 0.6], [0.35, 0.03, 0.25], vary(0x8a8a80), [0, 0, rnd() * 3]);
    for (let k = 0; k < (o.chairs || 3); k++) { const side = k % 2 ? 1 : -1, tip = rnd() < 0.35; part(a, M.paint, G.box, [-0.6 + k * 0.6, tip ? 0.2 : 0.45, side * 0.85], [0.45, 0.06, 0.45], 0x303438, tip ? [side * 1.5, 0] : undefined); }
    solid(a, 0, 0, 2.0, 1.0, 0.85);
  };
  P.crates = (a, o = {}) => {
    const c = o.color || 0x7a6040;
    part(a, M.paint, G.box, [-0.35, 0.55, 0], [1.1, 1.1, 1.1], vary(c)); part(a, M.paint, G.box, [0.55, 0.4, 0.2], [0.8, 0.8, 0.8], vary(c), [0, 0, 0.3]);
    if (rnd() < 0.6) part(a, M.paint, G.box, [-0.3, 1.45, 0.05], [0.8, 0.7, 0.8], vary(c), [0, 0, 0.5]);
    if (o.label) part(a, M.paint, G.box, [-0.35, 0.6, 0.56], [0.6, 0.25, 0.01], o.label);
    solid(a, 0, 0, 2.0, 1.2, 1.4);
  };
  P.barrels = (a, o = {}) => { for (let k = 0; k < 4; k++) { const x = (k % 2 - 0.5) * 0.75, z = (Math.floor(k / 2) - 0.5) * 0.75; if (k === 3 && rnd() < 0.5) { part(a, M.paint, G.cyl, [x, 0.32, z], [0.32, 0.95, 0.32], vary(o.color || 0x3a5a2a), [Math.PI / 2, 0, rnd()]); continue; } part(a, M.paint, G.cyl, [x, 0.48, z], [0.32, 0.95, 0.32], vary(o.color || 0x3a5a2a)); part(a, M.metal, G.cyl, [x, 0.3, z], [0.33, 0.05, 0.33], 0x202020); } solid(a, 0, 0, 1.6, 1.6, 1.0); };
  P.pallet = (a, o = {}) => { part(a, M.paint, G.box, [0, 0.07, 0], [1.3, 0.14, 1.1], 0x8a7050); part(a, M.cloth, G.box, [0, 0.62, 0], [1.2, 0.95, 1.0], o.wrap || 0xc8c8b8); part(a, M.paint, G.box, [0, 0.62, 0], [1.22, 0.1, 1.02], 0x303030); solid(a, 0, 0, 1.3, 1.1, 1.1); };
  P.oreCart = (a, o = {}) => {
    for (const s of [-0.5, 0.5]) part(a, M.metal, G.box, [0, 0.04, s], [3.6, 0.08, 0.08], 0x505050);
    part(a, M.paint, G.box, [0, 0.75, 0], [1.4, 0.8, 1.0], 0x6a5a3a, [0, o.tipped ? 0.5 : 0]); part(a, M.stone, G.box, [0, 1.15, 0], [1.2, 0.3, 0.85], o.ore || 0x8a5a3a);
    for (const [x, z] of [[-0.45, -0.5], [0.45, -0.5], [-0.45, 0.5], [0.45, 0.5]]) part(a, M.metal, G.cyl, [x, 0.25, z], [0.22, 0.08, 0.22], 0x303030, [Math.PI / 2, 0]);
    solid(a, 0, 0, 1.5, 1.1, 1.3);
  };
  P.orePile = (a, o = {}) => { for (let k = 0; k < 7; k++) part(a, M.stone, new THREE.DodecahedronGeometry(1, 0), [(rnd() - 0.5) * 1.4, 0.2 + rnd() * 0.3, (rnd() - 0.5) * 1.4], [0.4 + rnd() * 0.3, 0.3 + rnd() * 0.3, 0.4 + rnd() * 0.3], vary(o.color || 0x8a5a3a, 0.2), [rnd(), rnd()]); solid(a, 0, 0, 1.8, 1.8, 0.8, { bullets: false }); };
  P.luggage = (a) => { const c = [0x8a2a2a, 0x2a4a8a, 0x3a3a3a, 0x6a5a2a, 0x2a6a4a]; for (let k = 0; k < 6; k++) part(a, M.cloth, G.box, [(rnd() - 0.5) * 1.3, 0.2 + (k > 3 ? 0.4 : 0), (rnd() - 0.5) * 1.1], [0.6 + rnd() * 0.3, 0.35, 0.4], c[k % 5], [0, 0, rnd() * 3]); solid(a, 0, 0, 1.4, 1.2, 0.7, { bullets: false }); };
  P.tent = (a, o = {}) => {
    const c = o.color || 0xc86a2a;
    for (const s of [-1, 1]) part(a, M.cloth, G.box, [s * 0.62, 0.8, 0], [0.05, 1.8, 2.4], c, [0, s * 0.72]);
    part(a, M.metal, G.cyl, [0, 1.35, 0], [0.03, 2.5, 0.03], 0x404040, [Math.PI / 2, 0]);
    if (o.lamp !== false) glowAt(sub(a, 0, 1.3), 0.4, 0xffc070, 1.6, 0.4);
    solid(a, 0, 0, 1.9, 2.5, 1.5);
  };
  P.campfire = (a, o = {}) => { for (let k = 0; k < 8; k++) { const t = k / 8 * 6.28; part(a, M.stone, G.box, [Math.cos(t) * 0.5, 0.08, Math.sin(t) * 0.5], [0.2, 0.16, 0.16], 0x5a5a58, [0, 0, t]); } part(a, M.decal, new THREE.CircleGeometry(0.5, 10), [0, 0.02, 0], [1, 1, 1], 0x151010, [-Math.PI / 2, 0]); if (o.lit) { glowAt(sub(a, 0, 0), 0.4, 0xff7020, 2.2, 0.6); fires.push(sub(a, 0, 0)); } };
  P.sled = (a) => { part(a, M.paint, G.box, [0, 0.3, 0], [0.9, 0.1, 2.0], 0xa02020); for (const x of [-0.4, 0.4]) part(a, M.metal, G.box, [x, 0.12, 0], [0.05, 0.05, 2.2], 0x505050); part(a, M.paint, G.box, [0, 0.6, -0.3], [0.7, 0.5, 0.8], 0x3a4a5a); part(a, M.cloth, G.box, [0, 0.5, 0.5], [0.7, 0.3, 0.6], 0x6a6a5a); solid(a, 0, 0, 1.0, 2.2, 0.9); };
  P.tires = (a) => { for (let k = 0; k < 5; k++) part(a, M.paint, G.torus, [(k < 3 ? -0.4 : 0.45), 0.18 + (k % 3) * 0.3, (k < 3 ? 0 : 0.2)], [0.42, 0.42, 1.2], 0x151515, [Math.PI / 2, 0]); solid(a, 0, 0, 1.8, 1.0, 1.0); };
  P.jerry = (a) => { for (let k = 0; k < 5; k++) part(a, M.paint, G.box, [(k - 2) * 0.32, 0.25, (rnd() - 0.5) * 0.2], [0.25, 0.5, 0.36], k % 2 ? 0x3a5a2a : 0xa02020, [0, 0, (rnd() - 0.5) * 0.3]); };
  P.plates = (a, o = {}) => { for (let k = 0; k < 5; k++) { part(a, M.metal, G.box, [0, 0.1 + k * 0.14, 0], [2.0, 0.12, 1.0], 0x4a4440); part(a, M.glow, G.box, [0, 0.1 + k * 0.14, 0.505], [2.0, 0.05, 0.01], k > 2 ? 0xff6010 : 0x802000); } solid(a, 0, 0, 2.0, 1.0, 0.8); };
  P.molds = (a) => { for (let k = 0; k < 3; k++) { part(a, M.metal, G.box, [(k - 1) * 0.7, 0.3, 0], [0.6, 0.6, 1.0], 0x2a2a2a); part(a, M.glow, G.box, [(k - 1) * 0.7, 0.61, 0], [0.48, 0.02, 0.85], k === 1 ? 0xff9030 : 0x8a2008); } glowAt(sub(a, 0, 0), 0.9, 0xff7020, 2.4, 0.35); solid(a, 0, 0, 2.1, 1.0, 0.62); };
  P.anvil = (a) => { part(a, M.stone, G.cyl, [0, 0.35, 0], [0.4, 0.7, 0.4], 0x5a4030); part(a, M.metal, G.box, [0, 0.85, 0], [0.8, 0.3, 0.35], 0x2a2a2c); part(a, M.metal, G.cone, [0.55, 0.9, 0], [0.12, 0.35, 0.12], 0x2a2a2c, [0, Math.PI / 2]); solid(a, 0, 0, 1.0, 0.5, 1.0); };
  P.planter = (a, o = {}) => { part(a, M.paint, G.box, [0, 0.35, 0], [2.1, 0.7, 0.8], 0x5a4a3a); part(a, M.stone, G.box, [0, 0.72, 0], [2.0, 0.05, 0.72], 0x2a1a10); for (let k = 0; k < 6; k++) part(a, M.stone, new THREE.IcosahedronGeometry(1, 0), [-0.8 + k * 0.32, 0.95 + rnd() * 0.2, (rnd() - 0.5) * 0.3], [0.2, 0.3 + rnd() * 0.3, 0.2], o.dead ? vary(0x5a4a2a) : col(0x2a6a2a).offsetHSL(rnd() * 0.05, 0, (rnd() - 0.5) * 0.15)); solid(a, 0, 0, 2.1, 0.8, 0.75); };
  P.hydro = (a) => { part(a, M.metal, G.box, [0, 0.8, 0], [2.0, 0.1, 0.8], 0xc8ccd0); for (const [x, z] of [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]]) part(a, M.metal, G.box, [x, 0.4, z], [0.05, 0.8, 0.05], 0x808488); for (let k = 0; k < 8; k++) part(a, M.stone, G.sphere, [-0.85 + k * 0.24, 0.95, (k % 2 - 0.5) * 0.3], [0.12, 0.14, 0.12], 0x3a8a3a); part(a, M.glow, G.box, [0, 1.8, 0], [1.9, 0.05, 0.15], 0xff60d0); solid(a, 0, 0, 2.0, 0.8, 0.9); };
  P.eggs = (a, o = {}) => { for (let k = 0; k < 6; k++) part(a, M.organic, G.sphere, [(rnd() - 0.5) * 1.3, 0.3, (rnd() - 0.5) * 1.3], [0.28, 0.42, 0.28], o.color || 0x9a7ab0); glowAt(sub(a, 0, 0), 0.4, o.glow || 0xc060ff, 2.4, 0.4); solid(a, 0, 0, 1.6, 1.6, 0.8, { bullets: false }); };
  P.bones = (a, o = {}) => { for (let k = 0; k < 12; k++) part(a, MAT.bone, G.cyl, [(rnd() - 0.5) * 1.6, 0.1 + rnd() * 0.3, (rnd() - 0.5) * 1.6], [0.05, 0.6 + rnd() * 0.6, 0.05], 0xd8ccb0, [rnd() * 3, rnd() * 3]); for (let k = 0; k < 3; k++) part(a, MAT.bone, G.sphere, [(rnd() - 0.5) * 1.2, 0.15, (rnd() - 0.5) * 1.2], [0.16, 0.18, 0.14], 0xd8ccb0); if (o.helmets) for (let k = 0; k < 4; k++) part(a, M.paint, G.sphere, [(rnd() - 0.5) * 1.3, 0.35 + k * 0.15, (rnd() - 0.5) * 0.8], [0.2, 0.18, 0.22], [0xe0b020, 0xe0e0e0, 0x4a5a3a, 0xc86a2a][k]); solid(a, 0, 0, 1.8, 1.8, 0.6, { bullets: false }); };
  P.sarcophagus = (a, o = {}) => { part(a, M.stone, G.box, [0, 0.5, 0], [2.2, 1.0, 1.0], 0x7a6a50); part(a, M.stone, G.box, [o.open ? 0.4 : 0, 1.08, o.open ? 0.3 : 0], [2.3, 0.16, 1.1], 0x8a7a5a, [0, 0, o.open ? 0.4 : 0]); part(a, M.glow, G.box, [0, 0.6, 0.505], [1.6, 0.06, 0.01], 0x60ffe0); solid(a, 0, 0, 2.2, 1.0, 1.1); };
  P.statue = (a, o = {}) => { part(a, M.stone, G.box, [0, 0.4, 0], [1.1, 0.8, 1.1], o.color || 0x6a7a70); part(a, M.stone, G.box, [0, 1.6, 0], [0.6, 1.6, 0.4], o.color || 0x6a7a70); part(a, M.stone, G.sphere, [0, 2.65, 0], [0.3, 0.4, 0.3], o.color || 0x6a7a70); for (const s of [-1, 1]) part(a, M.stone, G.box, [s * 0.4, 1.9, 0.1], [0.18, 1.1, 0.18], o.color || 0x6a7a70, [0.3, s * 0.3]); solid(a, 0, 0, 1.1, 1.1, 2.9); };
  P.crystals = (a, o = {}) => { for (let k = 0; k < 7; k++) part(a, MAT.crystal, G.cone, [(rnd() - 0.5) * 1.2, 0.8 + rnd() * 0.6, (rnd() - 0.5) * 1.2], [0.2 + rnd() * 0.2, 1.4 + rnd() * 1.8, 0.2 + rnd() * 0.2], o.color || 0x80d0ff, [(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7]); glowAt(sub(a, 0, 0), 1.2, o.color || 0x80d0ff, 3.2, 0.45); solid(a, 0, 0, 1.6, 1.6, 2.4); };
  P.oxygen = (a) => { for (let k = 0; k < 4; k++) { part(a, M.paint, G.cyl, [(k - 1.5) * 0.36, 0.7, 0], [0.16, 1.4, 0.16], k % 2 ? 0xe0e0e0 : 0x3a8a3a); part(a, M.metal, G.cyl, [(k - 1.5) * 0.36, 1.48, 0], [0.05, 0.16, 0.05], 0x404040); } solid(a, 0, 0, 1.5, 0.4, 1.5); };
  P.chairs = (a) => { for (let k = 0; k < 4; k++) { const tip = rnd() < 0.25; part(a, M.paint, G.box, [(k - 1.5) * 0.6, tip ? 0.2 : 0.45, 0], [0.5, 0.06, 0.5], 0x3a5a8a, tip ? [1.5, 0] : undefined); if (!tip) part(a, M.paint, G.box, [(k - 1.5) * 0.6, 0.75, -0.24], [0.5, 0.55, 0.05], 0x3a5a8a); } part(a, M.metal, G.box, [0, 0.2, 0], [2.4, 0.06, 0.1], 0x404448); solid(a, 0, 0, 2.4, 0.6, 0.9, { bullets: false }); };
  P.desk = (a, o = {}) => { part(a, M.paint, G.box, [0, 0.55, 0], [2.4, 1.1, 0.7], o.color || 0xd8d4cc); part(a, M.paint, G.box, [0.85, 0.55, 0.6], [0.7, 1.1, 0.6], o.color || 0xd8d4cc); part(a, M.paint, G.box, [0, 1.13, 0], [2.5, 0.06, 0.8], 0x3a3a3a); part(a, M.metal, G.box, [-0.5, 1.4, 0.1], [0.5, 0.35, 0.05], 0x1a1a1a); part(a, M.glow, G.plane, [-0.5, 1.4, 0.13], [0.45, 0.3, 1], 0x2a8aa0); solid(a, 0, 0.15, 2.5, 1.3, 1.15); };
  P.cart = (a) => { part(a, M.paint, G.box, [0, 0.7, 0], [1.4, 0.6, 0.8], 0xe0b020); for (const [x, z] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) part(a, M.metal, G.cyl, [x, 0.15, z], [0.14, 0.08, 0.14], 0x202020, [Math.PI / 2, 0]); part(a, M.metal, G.box, [0.2, 1.1, 0], [0.4, 0.2, 0.3], 0xa02020); part(a, M.metal, G.cyl, [-0.4, 1.2, 0.1], [0.04, 0.5, 0.04], 0x505050, [0.4, 0]); solid(a, 0, 0, 1.4, 0.8, 1.2); };
  P.telescope = (a) => { part(a, M.metal, G.cyl, [0, 0.5, 0], [0.08, 1.0, 0.08], 0x404448); part(a, M.paint, G.cyl, [0, 1.25, 0.2], [0.18, 1.3, 0.18], 0xe0e0e0, [1.0, 0]); for (const t of [0, 2.1, 4.2]) part(a, M.metal, G.box, [Math.cos(t) * 0.4, 0.2, Math.sin(t) * 0.4], [0.05, 0.5, 0.05], 0x404448, [0, 0, 0.5]); solid(a, 0, 0, 0.8, 0.8, 1.6); };
  P.forklift = (a) => { part(a, M.paint, G.box, [0, 0.7, 0.3], [1.2, 1.0, 1.6], 0xe0a020); part(a, M.metal, G.box, [0, 1.6, 0.4], [1.1, 0.06, 1.2], 0x202020); for (const x of [-0.5, 0.5]) part(a, M.metal, G.box, [x, 1.1, 0.4], [0.06, 1.1, 0.06], 0x202020); part(a, M.metal, G.box, [0, 1.3, -0.6], [1.0, 2.4, 0.1], 0x303030); for (const x of [-0.25, 0.25]) part(a, M.metal, G.box, [x, 0.2, -1.1], [0.12, 0.06, 1.0], 0x303030); for (const [x, z] of [[-0.55, 0.9], [0.55, 0.9], [-0.55, -0.2], [0.55, -0.2]]) part(a, M.paint, G.cyl, [x, 0.25, z], [0.25, 0.2, 0.25], 0x151515, [0, 0, Math.PI / 2]); solid(a, 0, 0, 1.3, 2.4, 1.8); };
  P.stakes = (a) => { for (let k = 0; k < 4; k++) { const x = (rnd() - 0.5) * 1.8, z = (rnd() - 0.5) * 1.8; part(a, M.paint, G.box, [x, 0.5, z], [0.04, 1.0, 0.04], 0xd0c0a0); part(a, M.cloth, G.box, [x + 0.12, 0.92, z], [0.22, 0.14, 0.01], 0xff5020); } };
  // remains
  P.body = (a, o = {}) => { // slumped against the wall, or lying down
    const suit = o.suit || 0x4a5a3a, skin = 0x8a6a58, lying = o.lying;
    if (lying) {
      part(a, M.cloth, G.box, [0, 0.14, 0.9], [0.55, 0.26, 0.9], suit); part(a, M.paint, G.sphere, [0, 0.16, 0.25], [0.16, 0.14, 0.18], skin);
      for (const s of [-0.13, 0.13]) part(a, M.cloth, G.box, [s, 0.1, 1.7], [0.18, 0.18, 0.8], suit, [0, 0, s]);
      if (o.blanket) part(a, M.cloth, G.box, [0, 0.3, 1.0], [0.9, 0.08, 2.1], o.blanket);
    } else {
      part(a, M.cloth, G.box, [0, 0.55, 0.3], [0.5, 0.65, 0.3], suit, [-0.25, 0]); part(a, M.paint, G.sphere, [0.05, 0.98, 0.38], [0.15, 0.17, 0.16], o.helmet || skin, [0.5, 0.3]);
      for (const s of [-0.13, 0.13]) part(a, M.cloth, G.box, [s, 0.14, 0.8], [0.18, 0.18, 0.8], suit, [0, 0, s * 2]);
      for (const s of [-0.32, 0.32]) part(a, M.cloth, G.box, [s, 0.45, 0.45], [0.13, 0.55, 0.13], suit, [0.6, s]);
      if (o.gun) part(a, M.metal, G.box, [0.3, 0.12, 1.1], [0.1, 0.1, 0.9], 0x1a1c1e, [0, 0, 0.3]);
    }
    part(a, M.decal, new THREE.CircleGeometry(1, 10), [0, 0.012, lying ? 0.9 : 0.6], [0.6 + rnd() * 0.5, 0.45 + rnd() * 0.3, 1], BLOOD, [-Math.PI / 2, 0]);
  };
  P.skeleton = (a) => { part(a, MAT.bone, G.sphere, [0, 0.15, 0.2], [0.14, 0.15, 0.16], 0xd8ccb0); for (let k = 0; k < 6; k++) part(a, MAT.bone, G.cyl, [(k % 2 - 0.5) * 0.25, 0.08, 0.5 + k * 0.12], [0.03, 0.4, 0.03], 0xd8ccb0, [Math.PI / 2, 0, (k % 2 - 0.5) * 0.8]); part(a, MAT.bone, G.cyl, [0, 0.08, 0.7], [0.03, 0.7, 0.03], 0xd8ccb0, [Math.PI / 2, 0]); for (const s of [-0.12, 0.12]) part(a, MAT.bone, G.cyl, [s, 0.06, 1.35], [0.035, 0.8, 0.035], 0xd8ccb0, [Math.PI / 2, 0, s]); };
  P.barricade = (a) => { part(a, M.paint, G.box, [-0.5, 0.5, 0], [1.9, 0.06, 0.95], 0x6a6058, [Math.PI / 2 - 0.15, 0]); part(a, M.cloth, G.box, [0.7, 0.45, 0.1], [1.0, 0.9, 0.25], 0x8a8a70, [0.1, 0.2]); for (let k = 0; k < 3; k++) part(a, M.paint, G.box, [(rnd() - 0.5) * 0.8, 0.3 + k * 0.35, -0.3], [2.2, 0.12, 0.25], 0x7a5a3a, [0, 0, (rnd() - 0.5) * 0.4]); solid(a, 0, 0, 2.2, 1.0, 1.1); };
  // decals
  P.blood = (a, o = {}) => { for (let k = 0; k < (o.n || 3); k++) part(a, M.decal, new THREE.CircleGeometry(1, 9), [(rnd() - 0.5) * 1.2, 0.012, (rnd() - 0.5) * 1.2], [0.3 + rnd() * 0.9, 0.2 + rnd() * 0.5, 1], BLOOD, [-Math.PI / 2, 0, rnd() * 3]); };
  P.scorch = (a) => part(a, M.decal, new THREE.CircleGeometry(1, 12), [0, 0.012, 0], [1.4 + rnd(), 1.2 + rnd(), 1], 0x0a0806, [-Math.PI / 2, 0, rnd() * 3]);
  P.creep = (a, o = {}) => { const m = new THREE.Mesh(G.plane, MAT.creep); m.rotation.x = -Math.PI / 2; m.rotation.z = rnd() * 6; m.scale.setScalar(o.size || 4 + rnd() * 3); m.position.set(a.x, 0.013 + rnd() * 0.004, a.z); m.renderOrder = 1; root.add(m); };
  P.casings = (a) => { for (let k = 0; k < 24; k++) part(a, M.metal, G.cyl, [(rnd() - 0.5) * 1.4, 0.02, (rnd() - 0.5) * 1.4], [0.015, 0.05, 0.015], 0xc89a30, [Math.PI / 2, 0, rnd() * 3]); };
  P.trail = (a, o = {}) => { // a drag mark from here to the nearest vent
    const v = W.spawns.map((s) => ({ s, d: Math.hypot(s.x - a.x, s.z - a.z) })).filter((q) => q.d < 20).sort((p, q) => p.d - q.d)[0]; if (!v) return;
    const n = Math.floor(v.d / 0.7);
    for (let k = 0; k < n; k++) { const t = k / n; part({ x: a.x + (v.s.x - a.x) * t + (rnd() - 0.5) * 0.3, z: a.z + (v.s.z - a.z) * t + (rnd() - 0.5) * 0.3, ry: Math.atan2(v.s.x - a.x, v.s.z - a.z), y: 0 }, M.decal, new THREE.CircleGeometry(1, 7), [0, 0.012, 0], [0.18 + rnd() * 0.1, 0.4 + rnd() * 0.3, 1], o.color || BLOOD, [-Math.PI / 2, 0]); }
  };
  // big set pieces (take several cells)
  P.truck = (a) => {
    part(a, M.paint, G.box, [0, 1.6, -0.2], [2.6, 1.5, 3.6], 0xc8a020); part(a, M.paint, G.box, [0, 1.6, 2.4], [2.4, 1.8, 1.4], 0xc8a020); part(a, M.metal, G.box, [0, 2.1, 3.05], [2.2, 0.8, 0.05], 0x1a2028);
    part(a, M.stone, G.box, [0, 2.45, -0.2], [2.3, 0.4, 3.2], 0x8a5a3a); part(a, M.metal, G.box, [0, 0.9, 0.8], [2.4, 0.5, 6.2], 0x2a2a2a);
    for (const [x, z] of [[-1.3, 2.3], [1.3, 2.3], [-1.3, -1.2], [1.3, -1.2]]) part(a, M.paint, G.cyl, [x, 0.75, z], [0.75, 0.55, 0.75], 0x151515, [0, 0, Math.PI / 2]);
    solid(a, 0, 0.6, 2.8, 6.4, 2.7);
  };
  P.apc = (a, o = {}) => {
    const c = o.burnt ? 0x2a2622 : 0x4a5a3a;
    part(a, M.paint, G.box, [0, 1.1, 0], [2.4, 1.4, 5.0], c); part(a, M.paint, G.box, [0, 1.7, 1.9], [2.3, 0.6, 1.2], c, [0.35, 0]); part(a, M.paint, G.cyl, [0, 2.05, -0.4], [0.6, 0.4, 0.6], c); part(a, M.metal, G.cyl, [0, 2.1, 0.6], [0.07, 1.6, 0.07], 0x1a1a1a, [Math.PI / 2, 0]);
    for (const x of [-1.25, 1.25]) for (const z of [-1.6, 0, 1.6]) part(a, M.paint, G.cyl, [x, 0.5, z], [0.5, 0.4, 0.5], 0x151515, [0, 0, Math.PI / 2]);
    if (o.burnt) { glowAt(sub(a, 0, 0), 1.5, 0xff6020, 3.5, 0.5); fires.push(sub(a, 0.3, 0.5)); }
    solid(a, 0, 0, 2.6, 5.0, 2.4);
  };
  P.rover = (a) => { part(a, M.paint, G.box, [0, 0.9, 0], [1.8, 0.4, 3.0], 0xd8d8d8); part(a, M.metal, G.box, [0, 1.2, -0.5], [1.6, 0.4, 1.2], 0x404448); for (const [x, z] of [[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]]) part(a, M.paint, G.cyl, [x, 0.45, z], [0.45, 0.3, 0.45], 0x303030, [0, 0, Math.PI / 2]); part(a, M.metal, G.cyl, [0.6, 2.0, -1], [0.03, 1.4, 0.03], 0x606060); part(a, M.paint, G.sphere, [0.6, 2.8, -1], [0.5, 0.15, 0.5], 0xe8e8e8, [0.6, 0]); solid(a, 0, 0, 2.2, 3.0, 1.4); };
  P.drillRig = (a) => {
    const h = 8;
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) part(a, M.paint, G.box, [x * 0.8, h / 2, z * 0.8], [0.14, h, 0.14], 0xd8a020, [z * 0.05, -x * 0.05]);
    for (let k = 1; k < 6; k++) part(a, M.metal, G.box, [0, h * k / 6, 0], [1.4, 0.08, 0.08], 0x505050, [0, 0, k * 0.8]);
    part(a, M.metal, G.cyl, [0, h / 2, 0], [0.16, h, 0.16], 0x404448); part(a, M.paint, G.box, [0, 1.2, 0], [1.8, 0.2, 1.8], 0x3a3a3a);
    part(a, M.paint, G.box, [1.2, 0.7, 0], [0.9, 1.4, 1.2], 0x8a3a20);
    solid(a, 0, 0, 1.8, 1.8, h);
  };
  P.crusher = (a) => {
    part(a, M.paint, G.box, [0, 1.6, 0], [3.0, 3.2, 3.0], 0x6a5a3a); part(a, M.metal, G.cone, [0, 4.0, 0], [2.0, 1.6, 2.0], 0x505050, [Math.PI, 0]);
    part(a, M.metal, G.box, [0, 1.0, 2.6], [1.0, 0.2, 2.4], 0x303030, [-0.25, 0]); for (let k = 0; k < 4; k++) part(a, M.metal, G.cyl, [0, 0.8 + k * 0.15, 1.6 + k * 0.5], [0.12, 1.0, 0.12], 0x202020, [0, 0, Math.PI / 2]);
    part(a, M.paint, G.box, [0, 3.25, 1.51], [3.0, 0.3, 0.02], 0xe0b020);
    solid(a, 0, 0, 3.0, 3.0, 4.6);
  };
  P.ladle = (a) => { // a crucible ladle hanging from a gantry, still glowing
    for (const x of [-1.8, 1.8]) part(a, M.metal, G.box, [x, 3.5, 0], [0.3, 7, 0.3], 0x3a3a3a); part(a, M.metal, G.box, [0, 7, 0], [4, 0.4, 0.4], 0x3a3a3a);
    part(a, M.metal, G.cyl, [0, 2.2, 0], [1.2, 1.6, 1.2], 0x2a2420); part(a, M.glow, G.cyl, [0, 3.02, 0], [1.05, 0.05, 1.05], 0xff7020);
    for (const s of [-1, 1]) part(a, M.metal, G.cyl, [s * 0.9, 5, 0], [0.05, 4.2, 0.05], 0x202020, [0, 0, s * -0.15]);
    glowAt(sub(a, 0, 0), 3.4, 0xff6020, 4.5, 0.55); embers.push(sub(a, 0, 0, 0, 3));
    solid(a, 0, 0, 2.6, 2.6, 3.0); solid(a, -1.8, 0, 0.4, 0.4, 7); solid(a, 1.8, 0, 0.4, 0.4, 7);
  };
  P.crucibleBig = (a) => { part(a, M.metal, G.cyl, [0, 1.3, 0], [2.0, 2.6, 2.0], 0x2a2420); part(a, M.glow, G.cyl, [0, 2.62, 0], [1.8, 0.05, 1.8], 0xff8030); for (let k = 0; k < 3; k++) part(a, M.metal, G.torus, [0, 0.5 + k * 0.8, 0], [2.05, 2.05, 1.5], 0x3a302a, [Math.PI / 2, 0]); glowAt(sub(a, 0, 0), 3.2, 0xff6020, 6, 0.55); embers.push(sub(a, 0, 0, 0, 2.7)); solid(a, 0, 0, 4.0, 4.0, 2.7); };
  P.reactor = (a, o = {}) => { const c = o.color || 0x60e0ff; part(a, M.metal, G.cyl, [0, 0.4, 0], [1.3, 0.8, 1.3], 0x3a4048); part(a, M.glass, G.cyl, [0, 2.4, 0], [0.8, 3.2, 0.8], 0xffffff); part(a, M.glow, G.cyl, [0, 2.4, 0], [0.45, 3.0, 0.45], c); for (let k = 0; k < 4; k++) part(a, M.metal, G.torus, [0, 1.2 + k * 0.8, 0], [0.9, 0.9, 1.4], 0x505860, [Math.PI / 2, 0]); part(a, M.metal, G.cyl, [0, 4.2, 0], [1.1, 0.5, 1.1], 0x3a4048); glowAt(sub(a, 0, 0), 2.4, c, 5, 0.55); solid(a, 0, 0, 2.6, 2.6, 4.5); };
  P.helix = (a) => { // a spinning DNA hologram: two merged strands
    part(a, M.metal, G.cyl, [0, 0.3, 0], [0.8, 0.6, 0.8], 0x3a4048); part(a, M.glow, G.cyl, [0, 0.62, 0], [0.65, 0.02, 0.65], 0x60e8ff);
    const g = new THREE.Group(); g.position.set(a.x, 0.7, a.z);
    for (const [s, color] of [[0, 0x60e8ff], [Math.PI, 0xff60c0]]) { const items = []; for (let k = 0; k < 26; k++) { const t = k * 0.45; items.push({ g: G.sphere, m: new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(t + s) * 0.35, k * 0.09, Math.sin(t + s) * 0.35), new THREE.Quaternion(), new THREE.Vector3(0.07, 0.07, 0.07)) }); } g.add(new THREE.Mesh(U.merge(items), new THREE.MeshBasicMaterial({ color }))); }
    root.add(g); spinners.push(g); glowAt(a, 1.6, 0x60e8ff, 2.6, 0.35); solid(a, 0, 0, 1.6, 1.6, 3.0);
  };
  P.landingPad = (a) => {
    part(a, M.decal, new THREE.CircleGeometry(1, 40), [0, 0.011, 0], [5.2, 5.2, 1], 0x2a2c30, [-Math.PI / 2, 0]);
    part(a, M.decal, new THREE.RingGeometry(0.9, 1, 48), [0, 0.013, 0], [5, 5, 1], 0xe0b020, [-Math.PI / 2, 0]);
    for (const x of [-1, 1]) part(a, M.decal, G.plane, [x * 1.1, 0.014, 0], [0.5, 3.4, 1], 0xe8e8e8, [-Math.PI / 2, 0]); part(a, M.decal, G.plane, [0, 0.014, 0], [2.2, 0.5, 1], 0xe8e8e8, [-Math.PI / 2, 0]);
    for (let k = 0; k < 8; k++) { const t = k / 8 * 6.28, x = Math.cos(t) * 5.4, z = Math.sin(t) * 5.4; part(a, M.glow, G.cyl, [x, 0.06, z], [0.12, 0.12, 0.12], 0xff3020); blinkers.push(sub(a, x, z, 0, 0.2)); }
  };
  P.lander = (a) => { part(a, M.paint, G.box, [0, 2.4, 0], [2.4, 1.8, 2.4], 0xd8c8a0); part(a, M.metal, G.cyl, [0, 1.3, 0], [0.9, 0.6, 0.9], 0x404040); for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { part(a, M.metal, G.cyl, [x * 0.8, 1.2, z * 0.8], [0.07, 2.4, 0.07], 0x707070, [z * 0.25, -x * 0.25]); part(a, M.metal, G.cyl, [x, 0.05, z], [0.35, 0.1, 0.35], 0x707070); } part(a, M.paint, G.box, [0, 3.5, 0], [1.2, 0.4, 1.2], 0xe8e8e8); solid(a, 0, 0, 3.0, 3.0, 3.7); };
  P.shuttle = (a) => { part(a, M.paint, G.box, [0, 1.6, 0], [2.8, 2.2, 6.0], 0xd8dce0); part(a, M.paint, G.box, [0, 1.3, 3.6], [2.4, 1.6, 1.4], 0xd8dce0, [0.3, 0]); part(a, M.metal, G.box, [0, 1.9, 4.2], [2.0, 0.6, 0.6], 0x10161c, [0.5, 0]); for (const s of [-1, 1]) part(a, M.paint, G.box, [s * 2.4, 1.2, -0.8], [2.2, 0.2, 2.6], 0xc8ccd0, [0, 0, s * 0.1]); part(a, M.metal, G.cyl, [0, 1.6, -3.2], [0.8, 0.6, 0.8], 0x303030, [Math.PI / 2, 0]); part(a, M.paint, G.box, [0, 2.75, 0], [0.4, 0.08, 5.8], 0xe0b020); solid(a, 0, 0, 3.0, 7.0, 2.8); };
  P.cockpit = (a) => { part(a, M.paint, G.box, [0, 1.3, 0], [2.6, 2.2, 3.0], 0x5a6068, [0.12, 0, 0.1]); part(a, M.metal, G.box, [0, 2.0, 1.4], [2.2, 1.0, 0.1], 0x10161c, [0.6, 0]); for (let k = 0; k < 6; k++) part(a, M.glass, G.box, [(rnd() - 0.5) * 3, 0.05, 1.8 + rnd() * 1.5], [0.5, 0.02, 0.4], 0xa8c8e0, [0, 0, rnd() * 3]); part(a, M.paint, G.box, [0.5, 0.8, 0.5], [0.6, 0.9, 0.6], 0x2a2a2a); glowAt(sub(a, 0, 1.2), 1.6, 0xff3020, 1.4, 0.4); blinkers.push(sub(a, -0.6, 1.2, 0, 1.6)); solid(a, 0, 0, 2.8, 3.2, 2.6); };
  P.nacelle = (a) => { part(a, M.paint, G.cyl, [0, 1.3, 0], [1.2, 4.5, 1.2], 0x4a5058, [Math.PI / 2 - 0.2, 0, 0.3]); part(a, M.glow, G.cyl, [0.6, 1.8, -2.1], [0.9, 0.05, 0.9], 0xff8030, [Math.PI / 2 - 0.2, 0, 0.3]); glowAt(sub(a, 0.6, -2.3), 1.8, 0xff7020, 3, 0.55); fires.push(sub(a, 0.5, -1.6)); sparks.push(sub(a, -0.8, 1.2, 0, 1.6)); solid(a, 0, 0, 2.6, 4.6, 2.5); };
  P.container = (a, o = {}) => { const c = o.color || U.pick([0x9a3a2a, 0x2a5a8a, 0xb07020, 0x4a6a3a]); part(a, MAT.corr, G.box, [0, 1.3, 0], [2.4, 2.6, 5.4], c); if (o.burst) { part(a, MAT.corr, G.box, [1.35, 1.3, 2.3], [0.08, 2.4, 1.2], c, [0, 0, 0], [0, 0, 0]); for (let k = 0; k < 5; k++) part(a, M.paint, G.box, [(rnd() - 0.5) * 2, 0.3, 3.2 + rnd() * 1.4], [0.6, 0.5, 0.5], vary(0x8a7050), [0, 0, rnd() * 3]); } solid(a, 0, 0, 2.4, 5.4, 2.6); };
  P.hull = (a) => { part(a, M.paint, new THREE.CylinderGeometry(2.4, 2.4, 5, 10, 1, true, 0, Math.PI * 0.8), [0, 1.4, 0], [1, 1, 1], 0x5a6068, [Math.PI / 2, 0, 0.4]); for (let k = 0; k < 4; k++) part(a, M.metal, G.box, [(rnd() - 0.5) * 3, 0.15, (rnd() - 0.5) * 3], [0.8, 0.1, 0.6], 0x4a5058, [0, 0, rnd() * 3]); solid(a, 0, 0, 3.4, 5.0, 2.2); };
  P.throne = (a) => { part(a, MAT.flesh, G.sphere, [0, 0.8, 0], [1.6, 0.9, 1.4], 0x5a2a4a); part(a, MAT.flesh, G.box, [0, 2.4, -0.9], [2.4, 3.2, 0.6], 0x4a1a3a, [-0.15, 0]); for (let k = 0; k < 7; k++) part(a, MAT.bone, G.cone, [(k - 3) * 0.4, 4.2 + Math.abs(k - 3) * -0.25, -1.0], [0.12, 1.4, 0.12], 0xd8ccb0); part(a, M.glow, G.sphere, [0, 1.7, 0.2], [0.8, 0.12, 0.6], 0xd070ff); glowAt(sub(a, 0, 0), 2.2, 0xd070ff, 4.5, 0.5); solid(a, 0, 0, 3.0, 2.8, 2.0); };
  P.pews = (a) => { for (const z of [-0.8, 0.8]) { part(a, MAT.bone, G.box, [0, 0.45, z], [4.4, 0.12, 0.6], 0xc8b898); part(a, MAT.bone, G.box, [0, 0.9, z - 0.3], [4.4, 0.8, 0.1], 0xc8b898); for (const x of [-2, 0, 2]) part(a, MAT.bone, G.cyl, [x, 0.22, z], [0.08, 0.45, 0.08], 0xc8b898); } solid(a, 0, -0.8, 4.4, 0.7, 1.0); solid(a, 0, 0.8, 4.4, 0.7, 1.0); };
  P.altar = (a, o = {}) => { part(a, o.bone ? MAT.bone : M.stone, G.box, [0, 0.55, 0], [2.4, 1.1, 1.2], o.bone ? 0xc8b898 : 0x7a6a50); part(a, M.glow, G.box, [0, 1.12, 0], [2.0, 0.02, 0.8], o.glow || 0xd070ff); glowAt(sub(a, 0, 0), 1.4, o.glow || 0xd070ff, 3, 0.45); solid(a, 0, 0, 2.4, 1.2, 1.15); };
  P.rail = (a) => { for (const x of [-0.8, 0.8]) part(a, M.metal, G.box, [x, 0.6, 0], [0.3, 0.3, 7.2], 0x707880); for (let k = -3; k <= 3; k++) { part(a, M.metal, G.box, [0, 0.3, k * 1.1], [2.2, 0.6, 0.3], 0x505860); part(a, M.glow, G.box, [0, 0.62, k * 1.1], [1.2, 0.04, 0.2], 0x60a0ff); } solid(a, 0, 0, 2.2, 7.2, 0.8); };
  P.barge = (a) => { part(a, M.paint, G.box, [0, 0.3, 0], [2.4, 1.0, 5.2], 0x4a5a4a, [0, 0, 0.15], [0, 0, 0]); part(a, M.paint, G.box, [0, 1.2, -1.4], [1.6, 1.2, 1.4], 0xd8d8c8, [0, 0, 0.15]); part(a, M.decal, G.plane, [0, 0.03, 0], [3.2, 6, 1], 0x1a2a1a, [-Math.PI / 2, 0]); solid(a, 0, 0, 2.6, 5.2, 1.4); };
  P.digGrid = (a) => { part(a, M.decal, G.plane, [0, 0.012, 0], [4.6, 4.6, 1], 0x3a2a1a, [-Math.PI / 2, 0]); for (let k = -2; k <= 2; k++) { part(a, M.paint, G.box, [k * 1.1, 0.25, 0], [0.02, 0.02, 4.4], 0xe8d8a0); part(a, M.paint, G.box, [0, 0.25, k * 1.1], [4.4, 0.02, 0.02], 0xe8d8a0); } for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) part(a, M.paint, G.box, [x, 0.2, z], [0.05, 0.4, 0.05], 0x8a6a3a); };
  P.solar = (a) => { for (let r = -1; r <= 1; r++) { part(a, M.metal, G.box, [0, 0.5, r * 1.6], [4.4, 0.08, 0.08], 0x707070); for (let k = -2; k <= 2; k++) part(a, std('solar', { color: 0x1a2a6a, metalness: 0.6, roughness: 0.2, emissive: 0x050a20, vertexColors: true }), G.box, [k * 0.88, 0.9, r * 1.6], [0.84, 0.04, 1.1], 0xffffff, [0.5, 0]); } solid(a, 0, 0, 4.4, 4.2, 1.2, { bullets: false }); };
  P.flagpole = (a, o = {}) => { part(a, M.metal, G.cyl, [0, 3.5, 0], [0.06, 7, 0.06], 0x9a9a9a); part(a, M.cloth, G.box, [0.7, 6.2, 0], [1.4, 0.9, 0.02], o.color || 0x2a4a8a, [0, 0, 0.15]); if (o.torn) part(a, M.cloth, G.box, [0.4, 5.6, 0], [0.8, 0.5, 0.02], o.color || 0x2a4a8a, [0, 0, -0.4]); solid(a, 0, 0, 0.3, 0.3, 7); };
  P.floodlight = (a) => { const h = c && c.def && c.def.ceiling ? Math.min(6, c.def.wallH - 0.6) : 6; part(a, M.metal, G.box, [0, h / 2, 0], [0.2, h, 0.2], 0x505050); part(a, M.metal, G.box, [0, h, 0], [1.4, 0.8, 0.3], 0x303030); for (const x of [-0.4, 0, 0.4]) part(a, M.glow, G.box, [x, h, 0.16], [0.3, 0.5, 0.02], 0xfff0c0); glowAt(sub(a, 0, 0.5), h, 0xfff0c0, 3, 0.5); solid(a, 0, 0, 0.4, 0.4, h + 0.2); };
  P.hole = (a, o = {}) => { part(a, M.decal, new THREE.CircleGeometry(1, 16), [0, 0.014, 0], [1.6, 1.6, 1], 0x050303, [-Math.PI / 2, 0]); for (let k = 0; k < 10; k++) { const t = k / 10 * 6.28; part(a, M.stone, new THREE.DodecahedronGeometry(1, 0), [Math.cos(t) * 1.8, 0.2, Math.sin(t) * 1.8], [0.35, 0.3, 0.35], 0x3a3230, [rnd(), rnd()]); } glowAt(sub(a, 0, 0), 0.2, o.glow || 0xff7030, 3.6, 0.55); P.creep(a, { size: 6 }); };

  // ---------------- small animated things (only near the camera) ----------------
  // ---------------- replayable entities ----------------
  // Every top-level prop, log, sign and block runs on its own seeded random numbers, so the same call always makes the
  // same thing. The map editor records the generated dressing as a list of these entities (bake), the game plays a saved
  // list back exactly (js/mapedits.js), and the editor can rebuild any one of them on its own.
  let depth = 0;
  SD.rec = null; SD.recFloors = null; // arrays while the editor records a bake
  const seeded = (s) => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const rnd3 = (v) => Math.round(v * 1000) / 1000;
  function plain(o) { if (!o) return undefined; const r = {}; for (const k in o) { const v = o[k]; if (v === undefined || typeof v === 'function') continue; r[k] = v && v.isColor ? v.getHex() : v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; } return Object.keys(r).length ? r : undefined; }
  function asEntity(rec, fn) {
    if (depth > 0) return fn();
    const s = (rnd() * 4294967296) >>> 0, r0 = rnd;
    if (rec && SD.rec) {
      rec.s = s;
      if (navPend.length) { const ax = W.cellX(rec.x), az = W.cellZ(rec.z); rec.nav = navPend.map((i) => [i % W.w - ax, ((i / W.w) | 0) - az]); navPend = []; }
      SD.rec.push(rec);
    }
    rnd = seeded(s); depth++;
    try { return fn(); } finally { rnd = r0; depth--; }
  }
  SD.propOpts = {}; // the options each prop reads (o.xxx), for the editor's property panel
  for (const k of Object.keys(P)) {
    const f = P[k];
    SD.propOpts[k] = [...new Set((f.toString().match(/\bo\.(\w+)/g) || []).map((m) => m.slice(2)))];
    P[k] = (a, o) => asEntity(depth === 0 && SD.rec ? { k, x: rnd3(a.x), z: rnd3(a.z), y: rnd3(a.y || 0), ry: rnd3(a.ry || 0), o: plain(o) } : null, () => f(a, o));
  }
  // kinds that do not take up floor (the theme's scattered clutter may still go next to them)
  SD.FLAT = new Set(['@marker', '@trigger', 'blood', 'scorch', 'creep', 'casings', 'trail', 'stripes', 'claws', 'skulls', 'grime', 'cables', 'pipes', 'panel', 'floodLines', 'window', 'vines', 'lamp', 'debris', '@text', '@log']);

  let blinkers = [], embers = [], fires = [], sparks = [], spinners = [], glows = [];
  function glowAt(a, y, color, size, op) { const g = FX.glowSprite(color, size, op), dy = W.dispAt ? W.dispAt(a.x, a.z) : 0; g.position.set(a.x, y + dy, a.z); if (dy) g.userData.lifted = dy; root.add(g); glows.push(g); return g; }
  function animate(dt, t) {
    const cam = XH.player.cam.position, near = (p, r = 40) => Math.abs(p.x - cam.x) + Math.abs(p.z - cam.z) < r;
    for (const g of spinners) g.rotation.y += dt * 0.8;
    for (const p of embers) if (near(p) && Math.random() < 0.08) FX.embers(new THREE.Vector3(p.x, p.y || 1, p.z), 1);
    for (const p of fires) if (near(p, 35) && Math.random() < 0.5) FX.fire(new THREE.Vector3(p.x + (Math.random() - 0.5), 0.3, p.z + (Math.random() - 0.5)), new THREE.Vector3(0, 1, 0), 0.35);
    for (const p of sparks) if (near(p, 30) && Math.random() < 0.05) FX.sparks(new THREE.Vector3(p.x, p.y || 1.5, p.z), new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5));
    // readable logs pulse, and fade once read
    for (const L of SD.logs) L.g.material.opacity = L.read ? 0.12 : 0.35 + Math.sin(t * 3 + L.pos.x) * 0.2;
  }

  // ---------------- build ----------------
  SD.build = (ctx) => {
    SD.logs = [];
    const ed = XH.edits && XH.edits.get(ctx.def.id), dress = ed && ed.dress;
    const recipe = XH.mapstory && XH.mapstory[ctx.def.id]; if (!dress && (!recipe || !XH.zones || !XH.zones.list.length)) return;
    c = ctx; B = c.B; MAT = c.MAT; G = c.G; U = XH.U; W = c.W; rnd = c.rnd; root = c.root; FX = XH.fx; CELL = W.CELL; rows = c.rows;
    if (dress) { baked(dress); return; }
    occ = new Uint8Array(W.w * W.h); faceUsed = new Set();
    keep = [];
    for (const q of W.buys) keep.push([q.pos.x, q.pos.z, 2.3], [q.wall.position.x, q.wall.position.z, 1.9]);
    for (const q of W.perks) keep.push([q.pos.x, q.pos.z, 2.4]);
    for (const q of W.boxSpots) keep.push([q.pos.x, q.pos.z, 2.4], [q.x, q.z, 1.6]);
    if (W.forge) keep.push([W.forge.pos.x, W.forge.pos.z, 2.6]);
    if (W.powerSwitch) keep.push([W.powerSwitch.pos.x, W.powerSwitch.pos.z, 2.4]);
    for (const q of W.spawns) keep.push([q.x, q.z, 2.6]);
    for (const k in W.spots) { const v = W.spots[k]; for (const q of Array.isArray(v) ? v : v ? [v] : []) keep.push([q.x, q.z, 2.8]); }
    for (const id in W.doors) for (const ci of W.doors[id].cells) keep.push([W.cx2x(ci % W.w), W.cz2z((ci / W.w) | 0), 3.0]);
    keep.push([W.start.x, W.start.z, 3]);
    for (const k of W.keepClear || []) keep.push(k);
    for (const [zname, style] of Object.entries(recipe.floors || {})) { const q = XH.zones.byName(zname); if (q) lay(q, style); }
    const api = { wall: wallSlot, floor: floorSlot, decal: decalSpot, text: textDecal, log: datapad, P, part, sub, rnd, M, zone: (n) => XH.zones.byName(n) };
    for (const [zname, fn] of Object.entries(recipe.zones || {})) {
      const q = XH.zones.byName(zname); if (!q) continue;
      zoneInfo(q); SD.curZone = zname;
      try { fn(api, q); } catch (e) { console.warn('setdress', ctx.def.id, zname, e); }
    }
    if (recipe.all) try { recipe.all(api); } catch (e) { console.warn('setdress all', e); }
    // the ambient layer: small detail through every zone, in proportion to its size
    if (recipe.ambient) for (const q of XH.zones.list) {
      zoneInfo(q); SD.curZone = q.name;
      const n = Math.max(1, Math.round(q.floorCells.length / 45));
      for (const [kind, per, where, opts] of recipe.ambient) {
        const count = Math.round(per * n + (rnd() < (per * n) % 1 ? 1 : 0));
        for (let k = 0; k < count; k++) {
          const a = where === 'wall' ? wallSlot(q, { decal: true, need: 1 }) : decalSpot(q);
          if (a) try { P[kind](a, Object.assign({}, opts)); } catch (e) { console.warn('ambient', kind, e); }
        }
      }
    }
    buildTexts();
    W.anims.push(animate);
    // the generic dressing reads this to stay out of the way
    for (let i = 0; i < occ.length; i++) if (occ[i]) W.keepClear.push([W.cx2x(i % W.w), W.cz2z((i / W.w) | 0), 1.4]);
  };
  // helpers the recipes use to place several things at once
  SD.place = {
    wall: (api, q, prop, n = 1, o = {}) => { if (n < 1) n = Math.max(1, Math.round(n * q.faces.length / (o.span || 1))); let k = 0; for (let i = 0; i < n; i++) { const a = api.wall(q, o); if (!a) break; api.P[prop](a, o); k++; } SD.placed.push([q.name, prop + ' ' + k + '/' + n]); return k; },
    floor: (api, q, prop, n = 1, o = {}) => { if (n < 1) n = Math.max(1, Math.round(n * q.floorCells.length / 9)); let k = 0; for (let i = 0; i < n; i++) { const a = api.floor(q, o); if (!a) break; api.P[prop](a, o); k++; } SD.placed.push([q.name, prop + ' ' + k + '/' + n]); return k; },
    decal: (api, q, prop, n = 1, o = {}) => { for (let i = 0; i < n; i++) { const a = api.decal(q); if (a) api.P[prop](a, o); } },
  };

  // ---------------- solid blocks ('+' clusters) dressed for the zone they stand in ----------------
  // cl = { x, z, w, d } in metres; each dressing fills the footprint and gives it a collider
  const BLOCK = {};
  const flat = (cl) => ({ x: cl.x, z: cl.z, ry: 0, y: 0 });
  const circle = new THREE.CircleGeometry(1, 12);
  const spill = (a, y, r, color) => part(a, M.decal, circle, [0, y, 0], [r, r * 0.8, 1], color, [-Math.PI / 2, 0, rnd() * 3]);
  // props on both long faces, backs to a core, under one roof: the footprint reads as a single built unit edge to edge
  function module2(cl, o) {
    const along = cl.w >= cl.d, len = along ? cl.w : cl.d, dep = along ? cl.d : cl.w, inset = Math.min(o.inset, dep / 2 - 0.1);
    const n = Math.max(1, Math.floor((len - 0.2) / o.step)), c0 = flat(cl), cw = along ? len - 0.1 : dep - 2 * inset, cd = along ? dep - 2 * inset : len - 0.1;
    if (cw > 0.05 && cd > 0.05) part(c0, M.paint, G.box, [0, o.h / 2, 0], [cw, o.h, cd], o.core);
    part(c0, M.metal, G.box, [0, o.h + 0.06, 0], [cl.w - 0.04, 0.12, cl.d - 0.04], 0x3a3e44);
    for (const e of [-1, 1]) part(c0, M.paint, G.box, along ? [e * (len / 2 - 0.05), o.h / 2, 0] : [0, o.h / 2, e * (len / 2 - 0.05)], along ? [0.1, o.h, dep - 0.04] : [dep - 0.04, o.h, 0.1], o.core);
    for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
      const t = ((k + 0.5) / n - 0.5) * (len - 0.2);
      const a = along ? { x: cl.x + t, z: cl.z + s * (dep / 2 - inset), ry: s > 0 ? 0 : Math.PI, y: 0 } : { x: cl.x + s * (dep / 2 - inset), z: cl.z + t, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2, y: 0 };
      o.prop(a, s, k);
    }
    if (o.label) for (const s of [-1, 1]) { const a = along ? { x: cl.x + s * len / 2, z: cl.z, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2, y: 0 } : { x: cl.x, z: cl.z + s * len / 2, ry: s > 0 ? 0 : Math.PI, y: 0 }; textDecal(sub(a, 0, 0.02), o.label, 'sign', Math.min(dep * 0.8, 2.4), 0.45, o.h - 0.4, { color: o.labelColor || '#e8e0c8' }); }
  }
  BLOCK.bunks = (cl, o) => module2(cl, { inset: 1.0, step: 2.2, h: 2.35, core: 0x5a6050, label: o.label, prop: (a) => P.bunk(a, { sheet: vary(o.sheet || 0x6a7a5a) }) });
  BLOCK.lockers = (cl, o) => module2(cl, { inset: 0.6, step: 1.95, h: 2.3, core: 0x3a4048, label: o.label, prop: (a) => P.lockers(a, { color: o.color }) });
  BLOCK.shelves = (cl, o) => module2(cl, { inset: 0.64, step: 2.1, h: 2.4, core: 0x4a4e52, label: o.label, prop: (a) => P.shelf(a, o) });
  BLOCK.server = (cl, o) => module2(cl, { inset: 0.92, step: 1.8, h: 2.35, core: 0x1c1e22, label: o.label, labelColor: '#60c8ff', prop: (a) => P.racks(a) });
  BLOCK.cryo = (cl, o) => module2(cl, { inset: 0.84, step: 1.45, h: 2.45, core: 0xb8bcc0, label: o.label, labelColor: '#205070', prop: (a) => P.cryo(a, o) });
  // a grid of tall specimen tanks on one plinth
  BLOCK.vats = (cl, o) => {
    const nx = Math.max(1, Math.round(cl.w / 2.4)), nz = Math.max(1, Math.round(cl.d / 2.4)), sx = cl.w / nx, sz = cl.d / nz, r = Math.min(sx, sz) * 0.4;
    part(flat(cl), M.metal, G.box, [0, 0.2, 0], [cl.w - 0.1, 0.4, cl.d - 0.1], 0x3a4048);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const a = { x: cl.x - cl.w / 2 + (i + 0.5) * sx, z: cl.z - cl.d / 2 + (j + 0.5) * sz, ry: 0, y: 0 }, broken = rnd() < (o.broken === undefined ? 0.25 : o.broken);
      part(a, M.metal, G.cyl, [0, 0.55, 0], [r * 1.15, 0.3, r * 1.15], 0x505860);
      if (!broken) { part(a, M.glass, G.cyl, [0, 1.8, 0], [r, 2.2, r], 0xc8f0e0); part(a, M.glow, G.cyl, [0, 1.75, 0], [r * 0.9, 2.0, r * 0.9], o.fluid || 0x2a8a50); }
      else { part(a, M.glass, G.cyl, [0, 0.95, 0], [r, 0.5, r], 0xc8f0e0); spill(a, 0.42, r * 1.3, o.fluid || 0x2a6a40); }
      part(a, M.organic, G.sphere, [0, broken ? 0.95 : 1.9, 0], [r * 0.35, r * 0.7, r * 0.3], 0x1a2a20, broken ? [1.2, 0.3] : undefined);
      part(a, M.metal, G.cyl, [0, 3.0, 0], [r * 1.15, 0.3, r * 1.15], 0x505860);
      for (let k = 0; k < 2; k++) part(a, M.metal, G.cyl, [(k - 0.5) * r, 3.4, 0], [0.08, 0.6, 0.08], 0x404448);
      if (!broken) glowAt(a, 1.8, o.glow || 0x40ffa0, r * 3, 0.25);
    }
  };
  BLOCK.pillar = (cl, o) => { const a = flat(cl), h = o.h || 3.4; part(a, M.stone, G.box, [0, h / 2, 0], [cl.w * 0.92, h, cl.d * 0.92], o.color || 0x8a8680); part(a, M.paint, G.box, [0, 0.45, 0], [cl.w * 0.93, 0.9, cl.d * 0.93], o.band || 0xd8a020); part(a, M.paint, G.box, [0, 0.45, 0], [cl.w * 0.935, 0.12, cl.d * 0.935], 0x151515); if (o.stain) part(a, M.stone, G.box, [0, o.stain, 0], [cl.w * 0.925, 0.4, cl.d * 0.925], 0x3a4a3a); };
  // equipment housing: vents, pipes, status lights on every face
  BLOCK.machine = (cl, o) => {
    const a = flat(cl), h = o.h || 3.0;
    part(a, M.paint, G.box, [0, h * 0.45, 0], [cl.w * 0.92, h * 0.9, cl.d * 0.92], o.color || 0x5a6a5a); part(a, M.metal, G.box, [0, h * 0.94, 0], [cl.w * 0.6, h * 0.1, cl.d * 0.6], 0x3a3e44);
    for (let k = 0; k < 3; k++) part(a, M.metal, G.cyl, [(k - 1) * cl.w * 0.25, h + 0.3, cl.d * 0.2], [0.18, 1.0, 0.18], 0x505458);
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const f = { x: cl.x + fx * cl.w * 0.46, z: cl.z + fz * cl.d * 0.46, ry: Math.atan2(fx, fz), y: 0 }, span = (fx ? cl.d : cl.w) * 0.8;
      part(f, M.paint, G.box, [0, 0.3, 0.01], [span, 0.16, 0.02], 0xd8a020);
      for (let k = 0; k < 3; k++) part(f, M.metal, G.box, [(k - 1) * span * 0.3, h * 0.55, 0.02], [span * 0.22, h * 0.3, 0.03], 0x2a2e32);
      part(f, M.glow, G.box, [span * 0.4, h * 0.8, 0.03], [0.14, 0.14, 0.02], [0x30ff60, 0xffb020, 0x60c8ff][Math.floor(rnd() * 3)]);
    }
    if (o.label) for (const fz of [1, -1]) textDecal({ x: cl.x, z: cl.z + fz * cl.d * 0.465, ry: fz > 0 ? 0 : Math.PI, y: 0 }, o.label, 'sign', Math.min(cl.w * 0.7, 2.6), 0.45, h * 0.78, { color: '#e8e0c8' });
    if (o.glow) glowAt(a, h * 0.7, o.glow, Math.max(cl.w, cl.d) * 1.1, 0.25);
    if (o.spin) { const g = new THREE.Mesh(G.cyl, MAT.trim); g.scale.set(Math.min(cl.w, cl.d) * 0.3, 0.12, Math.min(cl.w, cl.d) * 0.3); g.position.set(cl.x, h + 0.05, cl.z); root.add(g); spinners.push(g); }
  };
  BLOCK.crates = (cl, o) => { const nx = Math.max(1, Math.floor(cl.w / 1.25)), nz = Math.max(1, Math.floor(cl.d / 1.25)), sx = cl.w / nx, sz = cl.d / nz; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const hh = 1 + Math.floor(rnd() * 2); for (let k = 0; k < hh; k++) part({ x: cl.x - cl.w / 2 + (i + 0.5) * sx, z: cl.z - cl.d / 2 + (j + 0.5) * sz, ry: (rnd() - 0.5) * 0.15, y: 0 }, M.paint, G.box, [0, 0.58 + k * 1.16, 0], [sx * 0.94, 1.16, sz * 0.94], vary(o.color || 0x7a6040)); } };
  // raised bed with trees under a grow-light frame
  const ico = new THREE.IcosahedronGeometry(1, 0);
  BLOCK.garden = (cl, o) => {
    const a = flat(cl); part(a, M.stone, G.box, [0, 0.45, 0], [cl.w - 0.1, 0.9, cl.d - 0.1], o.rim || 0x6a6258); part(a, M.stone, G.box, [0, 0.9, 0], [cl.w - 0.4, 0.04, cl.d - 0.4], 0x2a1a10);
    const nx = Math.max(1, Math.round(cl.w / 2.5)), nz = Math.max(1, Math.round(cl.d / 2.5));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const t = { x: cl.x - cl.w / 2 + (i + 0.5) * cl.w / nx + (rnd() - 0.5) * 0.4, z: cl.z - cl.d / 2 + (j + 0.5) * cl.d / nz + (rnd() - 0.5) * 0.4, ry: rnd() * 6, y: 0 }, dead = rnd() < (o.dead || 0);
      part(t, M.paint, G.cyl, [0, 1.6, 0], [0.14, 1.5, 0.14], 0x4a3624);
      for (let k = 0; k < 3; k++) part(t, M.stone, ico, [(rnd() - 0.5) * 0.8, 2.3 + rnd() * 0.5, (rnd() - 0.5) * 0.8], [0.6 + rnd() * 0.3, 0.45 + rnd() * 0.3, 0.6 + rnd() * 0.3], dead ? vary(0x5a4a2a) : col(o.leaf || 0x2a6a2a).offsetHSL(rnd() * 0.04, 0, (rnd() - 0.5) * 0.15));
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(a, M.metal, G.box, [sx * (cl.w / 2 - 0.15), 1.95, sz * (cl.d / 2 - 0.15)], [0.08, 2.1, 0.08], 0x505458);
    for (const s of [-1, 1]) { part(a, M.metal, G.box, [0, 3.0, s * (cl.d / 2 - 0.15)], [cl.w - 0.2, 0.08, 0.08], 0x505458); part(a, M.glow, G.box, [0, 2.95, s * (cl.d / 2 - 0.15)], [cl.w - 0.4, 0.04, 0.12], o.light || 0xff60e0); }
    glowAt(a, 2.9, o.light || 0xff60e0, Math.max(cl.w, cl.d) * 0.9, 0.18);
  };
  BLOCK.furnace = (cl, o) => {
    const a = flat(cl); part(a, M.stone, G.box, [0, 1.6, 0], [cl.w * 0.92, 3.2, cl.d * 0.92], 0x3a302a); part(a, M.metal, G.box, [0, 3.3, 0], [cl.w * 0.7, 0.3, cl.d * 0.7], 0x2a2624);
    part(a, M.metal, G.cyl, [0, 4.2, 0], [0.5, 1.8, 0.5], 0x2a2624);
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const f = { x: cl.x + fx * cl.w * 0.461, z: cl.z + fz * cl.d * 0.461, ry: Math.atan2(fx, fz), y: 0 }; part(f, M.glow, G.plane, [0, 0.9, 0.01], [Math.min(1.4, (fx ? cl.d : cl.w) * 0.45), 0.8, 1], 0xff7020); part(f, M.metal, G.box, [0, 1.35, 0.03], [Math.min(1.6, (fx ? cl.d : cl.w) * 0.5), 0.1, 0.06], 0x1a1614); }
    glowAt(a, 1.0, 0xff6020, Math.max(cl.w, cl.d) * 1.3, 0.4); embers.push({ x: cl.x, z: cl.z, y: 5 });
  };
  // a vehicle up on a service lift
  BLOCK.vehicle = (cl, o) => {
    const a = flat(cl), along = cl.w >= cl.d;
    part(a, M.metal, G.box, [0, 0.25, 0], [cl.w - 0.1, 0.5, cl.d - 0.1], 0x4a4e52);
    for (const s of [-1, 1]) part(a, M.paint, G.box, along ? [0, 0.5, s * (cl.d / 2 - 0.12)] : [s * (cl.w / 2 - 0.12), 0.5, 0], along ? [cl.w - 0.1, 0.03, 0.2] : [0.2, 0.03, cl.d - 0.1], 0xd8a020);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(a, M.paint, G.box, [sx * (cl.w / 2 - 0.25), 1.6, sz * (cl.d / 2 - 0.25)], [0.3, 3.2, 0.3], 0xb03020);
    P.apc({ x: cl.x, z: cl.z, ry: along ? Math.PI / 2 : 0, y: 0.5 }, o);
  };
  // a torn piece of the ship
  BLOCK.hull = (cl, o) => {
    const a = { x: cl.x, z: cl.z, ry: (rnd() - 0.5) * 0.2, y: 0 };
    part(a, M.paint, G.box, [0, 1.1, 0], [cl.w * 0.86, 2.2, cl.d * 0.86], 0x5a6068, [0.08, 0.05]);
    for (let k = 0; k < 3; k++) part(a, M.metal, G.box, [(k - 1) * cl.w * 0.3, 2.4, 0], [0.2, 0.8 + rnd() * 1.2, cl.d * 0.8], 0x3a4048, [0, (rnd() - 0.5) * 0.5]);
    part(a, M.paint, G.box, [0, 2.3, cl.d * 0.2], [cl.w * 0.7, 0.12, cl.d * 0.5], 0x7a8088, [0.4, 0.15]);
    spill(a, 0.012, Math.max(cl.w, cl.d) * 0.75, 0x0a0806);
    sparks.push({ x: cl.x, z: cl.z, y: 2.4 }); if (o.fire) fires.push({ x: cl.x + cl.w * 0.3, z: cl.z });
  };
  const BLOCKH = { bunks: 2.4, lockers: 2.35, shelves: 2.4, server: 2.4, cryo: 2.5, vats: 3.3, pillar: 3.4, machine: 3.0, crates: 2.3, garden: 1.0, furnace: 3.4, vehicle: 2.9, hull: 2.4 };
  // may the generic theme dressing put a piece of this kind here? (recipe.generic lists the zones where it belongs)
  SD.allow = (kind, x, z) => { const r = XH.mapstory && XH.zones && XH.mapstory[XH.zones.mapId], g = r && r.generic && r.generic[kind]; if (!g) return true; const q = XH.zones.atWorld(x, z); return !!q && g.includes(q.name); };
  // called by the world before anything is dressed, once per map
  SD.reset = () => { if (XH.hazards) XH.hazards.reset(); if (XH.logic) XH.logic.reset(); if (XH.traps && XH.traps.resetPlaced) XH.traps.resetPlaced(); blinkers = []; embers = []; fires = []; sparks = []; spinners = []; glows = []; SD.placed = []; texts.sign = []; texts.paint = []; texts.screen = []; navPend = []; if (SD.rec) { SD.rec = []; SD.recFloors = {}; } };

  // ---------------- saved entities ----------------
  // One entity: { k: prop name | '@block' | '@log' | '@text', x, z, y, ry, o: options, s: seed, nav: [[dx, dz]] cells it
  // blocks for pathing (relative to its own cell) }, plus b/w/d for a block, log/h for a log, text/style/w/h/ty for text.
  SD.spawn = (e) => {
    const a = { x: e.x, z: e.z, ry: e.ry || 0, y: e.y || 0 }, o = e.o ? JSON.parse(JSON.stringify(e.o)) : {}, np = W.props.length;
    const r0 = rnd; rnd = seeded(e.s || 1); depth++;
    try {
      if (e.k === '@block') {
        if (!BLOCK[e.b]) return;
        const cl = { x: e.x, z: e.z, w: e.w || CELL, d: e.d || CELL }; inBlock = true; try { BLOCK[e.b](cl, o); } finally { inBlock = false; }
        if (!SD.editor) W.addProp(cl.x, cl.z, cl.w * 0.49, cl.d * 0.49, BLOCKH[e.b] || 2.4);
      } else if (e.k === '@log') datapad0(a, e.log || {}, e.h || 0);
      else if (e.k === '@text') textDecal0(a, e.text || '', e.style || 'sign', e.w || 2, e.h || 0.5, e.ty === undefined ? 2 : e.ty, o);
      else if (e.k === '@zone') { if (XH.hazards) XH.hazards.spawnZone(e, a, o); }
      else if (e.k === '@trap') { if (XH.traps && XH.traps.spawnTrap) XH.traps.spawnTrap(e, a, o); }
      else if (e.k === '@trigger') { if (XH.logic) XH.logic.spawnTrigger(e, a, o); }
      else if (e.k === '@marker') { if (XH.logic) XH.logic.spawnMarker(e, a, o); }
      else if (P[e.k]) P[e.k](a, o, e);
    } finally { rnd = r0; depth--; }
    if (SD.editor) return;
    // pathing: the cells it was placed on, or (for a hand-placed entity) the cells its colliders mostly cover
    if (e.nav) { const ax = W.cellX(e.x), az = W.cellZ(e.z); for (const [dx, dz] of e.nav) if (W.inside(ax + dx, az + dz)) navBlock((az + dz) * W.w + ax + dx); }
    else for (let k = np; k < W.props.length; k++) {
      const p = W.props[k], fl = W.floorAt((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2); if (p.h - fl < 0.8 || p.y0 - fl > 1 || !p.enemy) continue;
      for (let cz = W.cellZ(p.z0); cz <= W.cellZ(p.z1); cz++) for (let cx = W.cellX(p.x0); cx <= W.cellX(p.x1); cx++) {
        if (!W.inside(cx, cz)) continue;
        const x0 = W.cx2x(cx) - CELL / 2, z0 = W.cz2z(cz) - CELL / 2, ov = Math.max(0, Math.min(p.x1, x0 + CELL) - Math.max(p.x0, x0)) * Math.max(0, Math.min(p.z1, z0 + CELL) - Math.max(p.z0, z0));
        const ex = Math.max(0, Math.min(p.x1, x0 + CELL) - Math.max(p.x0, x0)), ez = Math.max(0, Math.min(p.z1, z0 + CELL) - Math.max(p.z0, z0));
        if ((ov >= CELL * CELL * 0.4 || (p.h - fl > 1.2 && (ex > CELL * 0.7 || ez > CELL * 0.7))) && W.solid[cz * W.w + cx] === 0) navBlock(cz * W.w + cx);
      }
    }
  };
  function baked(dress) {
    if (dress.floors) for (let i = 0; i < dress.floors.length && i < W.w * W.h; i++) { const st = SD.FLOORSTYLE[dress.floors[i]]; if (st) layCell(i, st); }
    for (const e of dress.entities || []) {
      if (!SD.editor) try { if ((SD.kitMeta[e.k] && SD.kitMeta[e.k].solo) || (e.tag && (e.k === '@zone' || e.k === '@trigger'))) { const g = new THREE.Group(); g.userData.solo = true; g.userData.noLift = true; root.add(g); SD.spawnInto(e, g); } else SD.spawn(e); } catch (err) { console.warn('entity', e.k, err); }
      if (!SD.FLAT.has(e.k)) W.keepClear.push([e.x, e.z, e.k === '@block' ? Math.max(e.w || 0, e.d || 0) / 2 + 0.6 : 1.4]);
    }
    buildTexts();
    W.anims.push(animate);
  }
  // the editor builds each entity as its own group, so one can be moved or rebuilt alone; returns the logs it made
  SD.spawnInto = (e, group) => {
    const B0 = B, root0 = root, t0 = [texts.sign, texts.paint, texts.screen], lg = SD.logs.length, b = W.Buckets();
    B = b; root = group; texts.sign = []; texts.paint = []; texts.screen = [];
    try { SD.spawn(e); buildTexts(); b.build(group); } finally { B = B0; root = root0; [texts.sign, texts.paint, texts.screen] = t0; }
    return SD.logs.splice(lg);
  };
  SD.blockKinds = () => Object.keys(BLOCK);
  SD.blockOpts = (k) => (BLOCK[k] ? [...new Set((BLOCK[k].toString().match(/\bo\.(\w+)/g) || []).map((m) => m.slice(2)))] : []);
  SD.block = (cl, ctx) => {
    const ed = XH.edits && XH.edits.get(ctx.def.id), dress = ed && ed.dress;
    // a baked map: the block is dressed by its entity (spawned with the rest), or keeps the theme's look if it has none
    if (dress) return (dress.entities || []).some((e) => e.k === '@block' && Math.abs(e.x - cl.x) < cl.w / 2 && Math.abs(e.z - cl.z) < cl.d / 2);
    const recipe = XH.mapstory && XH.mapstory[ctx.def.id]; if (!recipe || !recipe.blocks || !XH.zones) return false;
    const q = XH.zones.atWorld(cl.x, cl.z); const spec = q && recipe.blocks[q.name]; if (!spec) return false;
    const [kind, o] = Array.isArray(spec) ? spec : [spec, {}];
    if (!BLOCK[kind]) return false;
    // these run before build(): set the module state they need
    B = ctx.B; MAT = ctx.MAT; G = ctx.G; U = XH.U; W = ctx.W; rnd = ctx.rnd; root = ctx.root; FX = XH.fx; CELL = W.CELL;
    SD.curZone = q.name;
    asEntity(SD.rec ? { k: '@block', b: kind, x: rnd3(cl.x), z: rnd3(cl.z), w: cl.w, d: cl.d, o: plain(o) } : null, () => { inBlock = true; try { BLOCK[kind](cl, o || {}); } finally { inBlock = false; } });
    if (!SD.editor) W.addProp(cl.x, cl.z, cl.w * 0.49, cl.d * 0.49, BLOCKH[kind] || 2.4);
    return true;
  };

  // ---------------- reading logs ----------------
  SD.candidates = (out) => {
    const Pl = XH.player.pos;
    for (const L of SD.logs) { const d = Math.hypot(L.pos.x - Pl.x, L.pos.z - Pl.z); if (d < 1.6 && Math.abs(L.pos.y - Pl.y) < 1.8) out.push({ tip: 'log', dist: d - 0.2, text: `Read: ${L.log.title}`, cost: 0, act: () => (panelLog === L ? SD.close() : SD.read(L)) }); }
  };
  let panel = null, panelT = 0, panelLog = null;
  SD.read = (L) => {
    L.read = true; panelLog = L;
    if (!panel) { panel = document.createElement('div'); panel.id = 'logPanel'; document.body.appendChild(panel); }
    panel.innerHTML = `<div class="lp-h">${L.log.title}</div><div class="lp-a">${L.log.who || ''}</div><div class="lp-b">${L.log.text.replace(/\n/g, '<br>')}</div><div class="lp-f">Walk away or press E to close</div>`;
    panel.classList.add('on'); panelT = 0;
    XH.audio.play('uiClick'); XH.audio.play('powerup', { vol: 0.3 });
    const d = XH.progress.data; d.logs = d.logs || {}; const key = XH.world.def.id + ':' + L.log.title;
    if (!d.logs[key]) { d.logs[key] = 1; XH.progress.addXP(150, 'Log found'); XH.progress.save(); }
    if (XH.achievements) XH.achievements.check();
  };
  SD.update = (dt) => {
    if (!panel || !panel.classList.contains('on')) return;
    panelT += dt;
    const Pl = XH.player.pos;
    if (panelLog && (Math.hypot(panelLog.pos.x - Pl.x, panelLog.pos.z - Pl.z) > 3.5 || panelT > 25 || XH.game.state !== 'playing')) { panel.classList.remove('on'); panelLog = null; }
  };
  SD.close = () => { if (panel) panel.classList.remove('on'); panelLog = null; };
})();
