'use strict';
// XENOHOLD — shared namespace + utilities
const XH = window.XH = {};
XH.DEBUG = /[?&]debug/.test(location.search);
XH.EDITOR = /[?&]editor\b/.test(location.search); // the map editor (XenoholdEditor.exe) runs the game page in this mode
XH.MUTE = XH.DEBUG || XH.EDITOR || /[?&]mute/.test(location.search);

(function () {
  const U = XH.U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (a) => a[Math.floor(Math.random() * a.length)];
  U.damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.angDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  U.weighted = (items) => {
    let tot = 0;
    for (const it of items) tot += it[1];
    let r = Math.random() * tot;
    for (const it of items) if ((r -= it[1]) <= 0) return it[0];
    return items[items.length - 1][0];
  };
  U.rng = (seed) => {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  };
  U.$ = (id) => document.getElementById(id);
  U.fmt = (n) => Math.floor(n).toLocaleString('en-US');

  // ---------- tileable value noise ----------
  const perm = new Uint8Array(512);
  {
    const p = [...Array(256).keys()], r = U.rng(1337);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  }
  const hp = (x, y, p) => { x = ((x % p) + p) % p; y = ((y % p) + p) % p; return perm[(perm[x & 255] + (y & 255)) & 511] / 255; };
  U.tnoise = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hp(xi, yi, p), b = hp(xi + 1, yi, p), c = hp(xi, yi + 1, p), d = hp(xi + 1, yi + 1, p);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  U.fbm = (x, y, oct, p) => {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += U.tnoise(x * f, y * f, p * f) * a; n += a; a *= 0.5; f *= 2; }
    return s / n;
  };
  U.ridge = (x, y, oct, p) => 1 - Math.abs(U.fbm(x, y, oct, p) * 2 - 1);

  // ---------- canvas textures ----------
  U.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  U.tex = (canvas, repeat = 1) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    return t;
  };
  // Paint every pixel from fn(u,v) -> [r,g,b] (0..255). u,v in [0,1).
  U.paint = (size, fn) => {
    const c = U.canvas(size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size), d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const col = fn(x / size, y / size, x, y), i = (y * size + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col[3] === undefined ? 255 : col[3];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };
  U.mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  U.hex3 = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

  // Label texture (for wall buys, perk machines, etc.)
  U.labelTex = (lines, { w = 512, h = 256, bg = 'rgba(0,0,0,0)', color = '#9f9', font = 'bold 54px Rajdhani, Consolas, monospace', glow = '#0f0', border = null } = {}) => {
    const c = U.canvas(w, h), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (border) { x.strokeStyle = border; x.lineWidth = 8; x.strokeRect(6, 6, w - 12, h - 12); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const ls = Array.isArray(lines) ? lines : [lines];
    ls.forEach((l, i) => {
      const txt = typeof l === 'string' ? l : l.t;
      x.font = (l && l.font) || font;
      x.shadowColor = glow; x.shadowBlur = 18;
      x.fillStyle = (l && l.c) || color;
      x.fillText(txt, w / 2, h * (i + 1) / (ls.length + 1));
    });
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  };

  // ---------- geometry merge ----------
  // items: [{g: BufferGeometry, m: Matrix4, c: Color}]
  U.merge = (items) => {
    const parts = []; let total = 0;
    for (const it of items) {
      const g = it.g.index ? it.g.toNonIndexed() : it.g.clone();
      if (it.m) g.applyMatrix4(it.m);
      parts.push([g, it.c]); total += g.attributes.position.count;
    }
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = new Float32Array(total * 3);
    let o = 0;
    for (const [g, c] of parts) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      const r = c ? c.r : 1, gg = c ? c.g : 1, b = c ? c.b : 1;
      for (let i = 0; i < n; i++) { const k = (o + i) * 3; col[k] = r; col[k + 1] = gg; col[k + 2] = b; }
      o += n; g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  U.mat = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
    return _m.clone().compose(_p, _q, _s);
  };
  // jitter vertices of a geometry (for organic rock shapes); returns non-indexed geometry
  U.jitter = (g, amt, rnd = Math.random, amtY = amt) => {
    g = g.index ? g.toNonIndexed() : g;
    const p = g.attributes.position, map = new Map();
    for (let i = 0; i < p.count; i++) {
      const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let off = map.get(k);
      if (!off) { off = [(rnd() - .5) * amt, (rnd() - .5) * amtY, (rnd() - .5) * amt]; map.set(k, off); }
      p.setXYZ(i, p.getX(i) + off[0], p.getY(i) + off[1], p.getZ(i) + off[2]);
    }
    g.computeVertexNormals();
    return g;
  };

  // ---------- storage ----------
  U.load = (k, def) => { try { const v = localStorage.getItem('xenohold.' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  U.save = (k, v) => { try { localStorage.setItem('xenohold.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
})();
