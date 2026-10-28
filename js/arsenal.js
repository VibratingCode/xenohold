'use strict';
// The full arsenal: every gun (the 14 originals and 54 more) is built from one parametric part library,
// textured, stamped with its name, customisable in the Gunsmith, and given a unique role + traits.
(function () {
  const U = XH.U, WP = XH.weapons;
  const { B, C, glow, muzzle, M, G } = WP._p;

  // ---------------- surface textures (grey detail maps that tint with the material colour) ----------------
  function detailTex(kind) {
    const c = U.canvas(128), x = c.getContext('2d'), r = U.rng(kind.length * 97 + 11);
    if (kind === 'metal') {
      x.fillStyle = '#e4e4e4'; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 260; i++) { const v = 205 + Math.floor(r() * 50); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, Math.floor(r() * 128), 128, 1); }
      x.globalAlpha = 0.5; for (let i = 0; i < 26; i++) { x.strokeStyle = r() < 0.5 ? '#ffffff' : '#9a9a9a'; x.lineWidth = 0.6; x.beginPath(); const a = r() * 128, b = r() * 128; x.moveTo(a, b); x.lineTo(a + (r() - 0.5) * 50, b + (r() - 0.5) * 14); x.stroke(); }
      x.globalAlpha = 1; for (let i = 0; i < 90; i++) { const v = 150 + Math.floor(r() * 60); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 1 + Math.floor(r() * 2), 1); }
    } else if (kind === 'poly') {
      x.fillStyle = '#dadada'; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 2600; i++) { const v = 185 + Math.floor(r() * 70); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 1, 1); }
    } else if (kind === 'grip') {
      x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, 128, 128);
      x.strokeStyle = '#8a8a8a'; x.lineWidth = 1;
      for (let k = -128; k < 256; k += 6) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.stroke(); x.beginPath(); x.moveTo(k + 128, 0); x.lineTo(k, 128); x.stroke(); }
      for (let i = 0; i < 900; i++) { const v = 200 + Math.floor(r() * 55); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 1, 1); }
    } else if (kind === 'panel') {
      x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, 128, 128);
      x.strokeStyle = '#9c9c9c'; x.lineWidth = 1.2;
      for (let k = 0; k < 128; k += 32) { x.beginPath(); x.moveTo(0, k + 0.5); x.lineTo(128, k + 0.5); x.stroke(); }
      for (let k = 0; k < 6; k++) { const px = Math.floor(r() * 4) * 32 + 0.5; x.beginPath(); x.moveTo(px, Math.floor(r() * 4) * 32); x.lineTo(px, Math.floor(r() * 4) * 32 + 32); x.stroke(); }
      x.fillStyle = '#b0b0b0'; for (let i = 0; i < 20; i++) { x.beginPath(); x.arc(Math.floor(r() * 16) * 8 + 3, Math.floor(r() * 16) * 8 + 3, 1.1, 0, 7); x.fill(); }
    }
    const t = U.tex(c); t.userData = { keep: true }; return t;
  }
  const TX = { metal: detailTex('metal'), poly: detailTex('poly'), grip: detailTex('grip'), panel: detailTex('panel') };
  const std = (c, o = {}, tex = 'metal') => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.6, roughness: 0.4, map: tex ? TX[tex] : null }, o));
  const MX = {
    gunmetal: std(0x464a52, { metalness: 0.75, roughness: 0.32 }), black: std(0x1c1e22, { metalness: 0.5, roughness: 0.5 }),
    tan: std(0xb09a72, { metalness: 0.2, roughness: 0.7 }, 'poly'), red: std(0x9a2a2a, { metalness: 0.4 }, 'panel'), blue: std(0x2e527e, { metalness: 0.5 }, 'panel'),
    chrome: std(0xe0e4e8, { metalness: 1, roughness: 0.14 }), bone: std(0xd8c8a0, { metalness: 0, roughness: 0.5, flatShading: true }, 'poly'),
    purple: std(0x55307a, {}, 'panel'), teal: std(0x226666, {}, 'panel'), green: std(0x42663a, { metalness: 0.3, roughness: 0.6 }, 'poly'), yellow: std(0xd4a226, { metalness: 0.3, roughness: 0.5 }, 'poly'),
    white: std(0xd4dae0, { metalness: 0.4, roughness: 0.35 }, 'panel'), olive: std(0x565e3e, { metalness: 0.35, roughness: 0.6 }, 'poly'), orange: std(0xd06a18, { metalness: 0.5, roughness: 0.4 }),
    dark: M.dark, metal: M.metal, grip: std(0x2e2a26, { metalness: 0.1, roughness: 0.9 }, 'grip'),
    polymer: std(0x26282c, { metalness: 0.15, roughness: 0.75 }, 'poly'), steel: std(0x30333a, { metalness: 0.85, roughness: 0.35 }),
    flesh: std(0x8a2a48, { metalness: 0.1, roughness: 0.45, flatShading: true }, 'poly'),
    wood: std(0xffffff, { metalness: 0, roughness: 0.65, map: U.tex(U.paint(128, (u, v) => { const n = U.fbm(u * 4, v * 4, 3, 4), r = 0.5 + 0.5 * Math.sin((v * 18 + n * 4) * Math.PI * 2), k = 0.62 + r * 0.22 + n * 0.16; return [104 * k, 60 * k, 32 * k]; })) }, null),
    brass: std(0xc8a040, { metalness: 0.9, roughness: 0.3 }),
  };
  const accCache = {};
  const acc = (hex) => accCache[hex] || (accCache[hex] = std(hex, { metalness: 0.4, roughness: 0.45 }, null));
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x60e0ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });

  // engraved side stamp: name, calibre, serial
  const stampCache = {};
  function stampMat(text) {
    if (stampCache[text]) return stampCache[text];
    const c = U.canvas(256, 32), x = c.getContext('2d');
    x.font = 'bold 19px Rajdhani, Consolas, monospace'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillText(text, 5, 17);
    x.fillStyle = 'rgba(235,235,225,0.85)'; x.fillText(text, 4, 16);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    return (stampCache[text] = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.6, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }));
  }
  // live ammo readout (energy guns and smart sights)
  function ammoScreen(parent, pos, rot, w, h, hex) {
    const c = U.canvas(64, 32), x = c.getContext('2d'), t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    m.position.set(...pos); m.rotation.set(...rot); parent.add(m);
    const col = '#' + new THREE.Color(hex).getHexString();
    const draw = (n, max) => {
      x.fillStyle = '#020806'; x.fillRect(0, 0, 64, 32);
      x.fillStyle = col; x.globalAlpha = 0.18; for (let k = 0; k < 32; k += 2) x.fillRect(0, k, 64, 1); x.globalAlpha = 1;
      x.font = 'bold 22px Consolas, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = n <= Math.ceil(max * 0.25) ? '#ff5040' : col; x.fillText(String(n).padStart(2, '0'), 32, 15);
      x.fillStyle = col; x.fillRect(4, 27, 56 * Math.max(0, Math.min(1, n / Math.max(1, max))), 2);
      t.needsUpdate = true;
    };
    draw(0, 1);
    return { draw, last: -1 };
  }

  // ---------------- geometry helpers ----------------
  const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  function shape(pts, holes) { const s = new THREE.Shape(V2(pts)); for (const h of holes || []) s.holes.push(new THREE.Path(V2(h))); return s; }
  function uvScale(geo, k) { const uv = geo.attributes.uv; if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); }
  function side(p, mat, pts, w, o = {}) {
    const bev = o.bev === undefined ? Math.min(0.004, w * 0.12) : o.bev, d = Math.max(0.0005, w - bev * 2);
    const flip = (a) => a.map(([z, y]) => [-z, y]);
    const geo = new THREE.ExtrudeGeometry(shape(flip(pts), (o.holes || []).map(flip)), { depth: d, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 1, curveSegments: 8 });
    geo.rotateY(Math.PI / 2); geo.translate(-d / 2 + (o.x || 0), 0, 0); uvScale(geo, 6);
    const m = new THREE.Mesh(geo, mat); p.add(m); return m;
  }
  function front(p, mat, pts, len, z0, o = {}) {
    const geo = new THREE.ExtrudeGeometry(shape(pts, o.holes), { depth: len, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, z0); uvScale(geo, 6);
    const m = new THREE.Mesh(geo, mat); p.add(m); return m;
  }
  function lathe(p, mat, prof, y, segs = 16) {
    const geo = new THREE.LatheGeometry(V2(prof), segs); geo.rotateX(Math.PI / 2); geo.translate(0, y, 0);
    const m = new THREE.Mesh(geo, mat); p.add(m); return m;
  }
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const oct = (a, b, c, cy = 0) => [[-a + c, cy - b], [a - c, cy - b], [a, cy - b + c], [a, cy + b - c], [a - c, cy + b], [-a + c, cy + b], [-a, cy + b - c], [-a, cy - b + c]];
  function rail(p, mat, z0, z1, y, w = 0.022) {
    const n = Math.max(2, Math.round((z1 - z0) / 0.011)), st = (z1 - z0) / n, pts = [[z1, y - 0.005], [z0, y - 0.005]];
    for (let k = 0; k < n; k++) { const a = z0 + k * st; pts.push([a, y + 0.005], [a + st * 0.55, y + 0.005], [a + st * 0.55, y + 0.001], [a + st, y + 0.001]); }
    return side(p, mat, pts, w, { bev: 0.001 });
  }

  // ======================================================================
  //  The builder
  // ======================================================================
  function build(g, main, sp) {
    const [L, Hh, Wd, style = 'bevel'] = sp.body;
    const camo = main !== M.metal;
    const body = camo ? main : MX[sp.color || 'gunmetal'];
    const lower = camo ? main : MX[sp.lower || 'black'], furn = MX[sp.furn || 'polymer'];
    const dark = MX.black, steel = MX.steel, gripM = MX[sp.gripMat || 'grip'], aM = acc(sp.accent || 0xd06a18), gM = glow(sp.glow || 0x40ff90);
    const pistol = !!sp.pistol, bull = !!sp.bullpup, organic = style === 'organic', revolver = style === 'revolver';
    const zc = -L * 0.32, zf = zc - L / 2, zb = zc + L / 2, rear = bull ? zb + 0.2 : zb;
    const top = 0.02 + Hh / 2, bot = 0.02 - Hh / 2, ym = pistol ? top - Hh * 0.5 : 0.02 - Hh * 0.08;
    const gz = pistol ? zb - 0.055 : bull ? zc + L * 0.06 : zb - Math.min(0.08, L * 0.2);
    const mg = sp.mag || (pistol ? 'grip' : 'box');
    const mzc = bull ? zb + 0.09 : Math.max(gz - 0.165, zf + L * 0.16 + 0.056);
    const well = !pistol && ['box', 'curved', 'cell', 'drum'].includes(mg);
    const [bl, br] = sp.barrel || [0.2, 0.016], by = sp.barrelY !== undefined ? sp.barrelY : (pistol ? top - Hh * 0.28 : 0.02 + Hh * 0.08);

    // ================= receiver =================
    const lowerPts = () => {
      const pts = [[zf + L * 0.12, ym], [rear, ym], [rear, bot + 0.012], [rear - 0.014, bot]];
      if (well) pts.push([mzc + 0.05, bot], [mzc + 0.044, bot - 0.022], [mzc - 0.044, bot - 0.022], [mzc - 0.05, bot]);
      pts.push([zf + L * 0.16, bot], [zf + L * 0.12, bot + Hh * 0.22]);
      return pts;
    };
    if (organic) {
      const m = new THREE.Mesh(G.sph, body); m.scale.set(Wd * 0.62, Hh * 0.62, L * 0.56); m.position.set(0, 0.02, zc); g.add(m);
      const m2 = new THREE.Mesh(G.sph, body); m2.scale.set(Wd * 0.45, Hh * 0.45, L * 0.3); m2.position.set(0, top - Hh * 0.1, zc + L * 0.2); g.add(m2);
      for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(G.cone, MX.bone); c.scale.set(0.011, 0.085, 0.011); c.position.set((k % 2 ? 1 : -1) * Wd * 0.42, top - 0.01, zc - L * 0.32 + k * L * 0.13); c.rotation.set(-0.9, 0, (k % 2 ? -1 : 1) * 0.5); g.add(c); }
      for (let k = 0; k < 4; k++) { const v = new THREE.Mesh(G.sph, gM); v.scale.set(0.008, 0.008, L * 0.18); v.position.set((k % 2 ? 1 : -1) * Wd * 0.55, 0.02 + (k < 2 ? 0.01 : -0.015), zc + (k < 2 ? -0.05 : 0.06)); g.add(v); }
      for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(G.torus, MX.bone); r.scale.setScalar(Wd * (0.66 - k * 0.04)); r.position.set(0, 0.02, zc - L * 0.2 + k * L * 0.2); g.add(r); }
    } else if (style === 'slide') {
      side(g, body, [[zf, ym], [zf, top - 0.012], [zf + 0.014, top], [zb - 0.01, top], [zb, top - 0.012], [zb, ym]], Wd);
      side(g, lower, [[zf + 0.012, ym], [zb + 0.006, ym], [zb + 0.014, ym - 0.012], [zb - 0.018, bot], [zf + 0.05, bot], [zf + 0.012, bot + 0.014]], Wd * 0.92);
      for (let k = 0; k < 6; k++) B(g, dark, [0, top - Hh * 0.25, zb - 0.014 - k * 0.009], [Wd * 1.03, Hh * 0.34, 0.003]);
      B(g, dark, [Wd * 0.2, top + 0.001, zc + 0.02], [Wd * 0.45, 0.004, 0.05]);
      B(g, MX.brass, [Wd * 0.2, top - 0.004, zc + 0.02], [Wd * 0.3, 0.004, 0.03]);
      rail(g, dark, zf + 0.015, zf + 0.09, bot + 0.002, Wd * 0.7);
      C(g, steel, [0, top - Hh * 0.2, zb + 0.004], 0.006, 0.012, [0, 0, 0]);
    } else if (revolver) {
      // frame with top strap, open window for the cylinder, and a hammer
      const cz0 = zc - L * 0.12, cz1 = zc + L * 0.2, cr = Hh * 0.44;
      side(g, lower, [[zf + 0.02, top - 0.01], [zb, top - 0.01], [zb + 0.01, top - 0.03], [zb, bot + 0.02], [zb - 0.03, bot], [zf + 0.05, bot], [zf + 0.02, bot + 0.02]], Wd * 0.9,
        { holes: [[[cz0, 0.02 - cr * 0.95], [cz1, 0.02 - cr * 0.95], [cz1, 0.02 + cr * 0.95], [cz0, 0.02 + cr * 0.95]]] });
      const cyl = new THREE.Group(); cyl.position.set(0, 0.02, (cz0 + cz1) / 2); g.add(cyl);
      lathe(cyl, body, [[0, -(cz1 - cz0) / 2 + 0.002], [cr * 0.9, -(cz1 - cz0) / 2], [cr, -(cz1 - cz0) / 2 + 0.008], [cr, (cz1 - cz0) / 2 - 0.008], [cr * 0.9, (cz1 - cz0) / 2], [0, (cz1 - cz0) / 2 - 0.002]], 0, 12);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; B(cyl, dark, [Math.cos(a) * cr * 0.98, Math.sin(a) * cr * 0.98, 0], [0.006, 0.006, (cz1 - cz0) * 0.7], [0, 0, a]); C(cyl, MX.brass, [Math.cos(a + 0.5) * cr * 0.55, Math.sin(a + 0.5) * cr * 0.55, -(cz1 - cz0) / 2 - 0.001], cr * 0.2, 0.004); }
      g.userData.cylinder = cyl;
      side(g, dark, [[zb - 0.01, top - 0.01], [zb + 0.012, top + 0.012], [zb + 0.022, top + 0.008], [zb + 0.012, top - 0.02]], Wd * 0.4, { bev: 0.001 });
      B(g, body, [0, top - 0.004, zc], [Wd * 0.55, 0.012, L * 0.9]);
    } else {
      let up;
      if (style === 'bulky') up = [[zf, ym], [zf, top - Hh * 0.45], [zf + Hh * 0.55, top], [rear - 0.02, top], [rear, top - 0.025], [rear, ym]];
      else if (style === 'energy') up = [[zf, ym], [zf, ym + (top - ym) * 0.45], [zf + L * 0.1, top - 0.006], [zf + L * 0.25, top + 0.008], [rear - L * 0.2, top + 0.008], [rear - L * 0.05, top - 0.004], [rear, ym + (top - ym) * 0.5], [rear, ym]];
      else up = [[zf, ym], [zf, top - Hh * 0.2], [zf + Hh * 0.25, top], [rear - 0.012, top], [rear, top - 0.012], [rear, ym]];
      if (style === 'round') { lathe(g, body, [[0, zf - 0.002], [Hh * 0.46, zf], [Hh * 0.5, zf + 0.02], [Hh * 0.5, rear - 0.02], [Hh * 0.46, rear], [0, rear + 0.002]], 0.02 + Hh * 0.05, 18); }
      else side(g, body, up, Wd);
      side(g, lower, lowerPts(), Wd * 0.92);
      B(g, dark, [Wd / 2 + 0.001, top - Hh * 0.32, zc + L * 0.08], [0.004, Hh * 0.22, L * 0.17]);
      B(g, MX.brass, [Wd / 2 - 0.004, top - Hh * 0.32, zc + L * 0.08], [0.004, Hh * 0.1, L * 0.08]);
      B(g, steel, [Wd / 2 + 0.002, top - Hh * 0.32, zc + L * 0.08 - L * 0.06], [0.003, Hh * 0.12, 0.012]);
      if (style !== 'energy') C(g, dark, [Wd / 2 + 0.006, top - Hh * 0.2, rear - 0.05], 0.009, 0.03, [0, 0, 0]);
      B(g, dark, [0, top - 0.004, rear - 0.012], [Wd * 0.55, 0.012, 0.028]);
      B(g, dark, [-Wd * 0.3, top - 0.004, rear + 0.002], [0.02, 0.01, 0.012]);
      for (const sx of [-1, 1]) {
        for (const pz of [gz - 0.06, gz + 0.015]) C(g, steel, [sx * (Wd * 0.46 + 0.002), ym - Hh * 0.18, pz], 0.0045, 0.004, [0, 0, Math.PI / 2]);
        C(g, steel, [sx * (Wd * 0.5 + 0.002), ym + Hh * 0.18, zf + L * 0.1], 0.0045, 0.004, [0, 0, Math.PI / 2]);
      }
      C(g, dark, [-Wd * 0.46 - 0.004, ym - Hh * 0.12, gz - 0.02], 0.008, 0.006, [0, 0, Math.PI / 2]);
      B(g, dark, [-Wd * 0.46 - 0.008, ym - Hh * 0.12 + 0.006, gz - 0.02], [0.004, 0.014, 0.004], [0.6, 0, 0]);
      if (sp.stripe !== false) B(g, aM, [0, ym + (top - ym) * 0.45, zc - L * 0.12], [Wd + 0.004, 0.008, L * 0.4]);
      if (style === 'energy') for (const sx of [-1, 1]) { B(g, gM, [sx * (Wd / 2 + 0.002), ym + (top - ym) * 0.55, zc - L * 0.05], [0.003, 0.006, L * 0.6]); for (let k = 0; k < 4; k++) B(g, gM, [sx * (Wd / 2 + 0.002), ym - Hh * 0.05, zc - L * 0.3 + k * 0.025], [0.003, Hh * 0.18, 0.008]); }
      if (bull) { B(g, MX.black, [0, bot + 0.004, rear - 0.004], [Wd * 0.95, Hh * 1.02, 0.02]); B(g, aM, [0, top - 0.02, rear - 0.07], [Wd + 0.004, 0.01, 0.1]); }
    }
    // name stamps on both sides of the receiver
    if (!organic && sp.stamp) {
      const sm = stampMat(sp.stamp), sw = Math.min(L * 0.55, 0.2), sh2 = sw / 8;
      for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh2), sm); pl.position.set(sx * (Wd / 2 + (revolver ? -0.001 : 0.0028)) * (revolver ? 0.9 : 1), pistol || revolver ? bot + Hh * 0.28 : ym - Hh * 0.2, zc + (pistol ? 0.01 : L * 0.05)); pl.rotation.y = sx * Math.PI / 2; g.add(pl); }
    }

    // ================= grip, trigger guard, trigger =================
    const s = 0.3, gh = 0.155, gw = pistol || revolver ? Wd * 0.94 : Wd * 0.78, gb = bot;
    const fz = (d) => gz - 0.03 + d * s, rz = (d) => gz + 0.034 + d * s;
    side(g, gripM, [[fz(0), gb + 0.006], [fz(0.028) - 0.004, gb - 0.028], [fz(0.042), gb - 0.042], [fz(0.066) - 0.005, gb - 0.066], [fz(0.08), gb - 0.08], [fz(0.105) - 0.005, gb - 0.105], [fz(0.12), gb - 0.12], [fz(gh), gb - gh], [rz(gh) + 0.004, gb - gh], [rz(gh) + 0.007, gb - gh + 0.012], [rz(0.03), gb - 0.03], [rz(0) + (pistol || revolver ? 0.02 : 0.012), gb + 0.006]], gw);
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) B(g, dark, [sx * (gw / 2 + 0.001), gb - 0.04 - k * 0.022, gz + 0.012 + (0.04 + k * 0.022) * s], [0.002, 0.004, 0.045], [s, 0, 0]);
    for (const sx of [-1, 1]) C(g, MX.chrome, [sx * (gw / 2 + 0.002), gb - 0.075, gz + 0.03], 0.005, 0.003, [0, 0, Math.PI / 2]);
    if (mg === 'grip') B(g, dark, [0, gb - gh - 0.005, gz + 0.003 + gh * s], [gw * 1.02, 0.012, 0.074]);
    side(g, lower, [[gz - 0.028, gb + 0.012], [gz - 0.108, gb + 0.012], [gz - 0.108, gb - 0.016], [gz - 0.088, gb - 0.038], [gz - 0.028, gb - 0.038]], 0.012, { holes: [[[gz - 0.036, gb - 0.001], [gz - 0.1, gb - 0.001], [gz - 0.1, gb - 0.014], [gz - 0.084, gb - 0.03], [gz - 0.036, gb - 0.03]]], bev: 0.001 });
    side(g, steel, [[gz - 0.06, gb + 0.004], [gz - 0.052, gb + 0.004], [gz - 0.056, gb - 0.024], [gz - 0.064, gb - 0.022]], 0.006, { bev: 0.001 });

    // ================= barrel + handguard =================
    const hgLen = pistol || revolver ? 0 : Math.min(bl * 0.72, bl - 0.03);
    C(g, steel, [0, by, zf - bl / 2 + 0.01], br, bl + 0.02);
    if (revolver) { B(g, body, [0, by + br * 0.9, zf - bl / 2], [br * 1.4, br * 1.2, bl]); B(g, lower, [0, by - br * 1.1, zf - bl * 0.3], [br * 1.6, br * 1.2, bl * 0.6]); }
    const sh = sp.shroud || 'none';
    const fzGrip = hgLen > 0 && ['rails', 'vented', 'heavy'].includes(sh) ? zf - hgLen * 0.5 : zf - bl * 0.3;
    if (sh === 'rails') {
      const a = Wd * 0.46, h2 = Hh * 0.36;
      front(g, body, oct(a, h2, a * 0.35, by), hgLen, zf - hgLen);
      rail(g, dark, zf - hgLen + 0.008, zf, by + h2 + 0.004, 0.022);
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) B(g, dark, [sx * (a + 0.001), by, zf - hgLen * (0.2 + k * 0.28)], [0.004, h2 * 0.5, hgLen * 0.18]);
      B(g, dark, [0, by - h2 - 0.002, zf - hgLen * 0.5], [a, 0.004, hgLen * 0.8]);
    } else if (sh === 'vented') {
      const h2 = Hh * 0.32, n = Math.max(3, Math.floor(hgLen / 0.034)), holes = [];
      for (let k = 0; k < n; k++) { const z0 = zf - hgLen + 0.014 + k * (hgLen - 0.02) / n; holes.push(rect(z0, by - h2 * 0.45, z0 + (hgLen - 0.02) / n * 0.55, by + h2 * 0.6)); }
      side(g, body, [[zf, by - h2], [zf - hgLen + 0.012, by - h2], [zf - hgLen, by - h2 + 0.012], [zf - hgLen, by + h2 - 0.012], [zf - hgLen + 0.012, by + h2], [zf, by + h2]], Wd * 0.82, { holes });
      lathe(g, dark, [[br * 1.6, zf - hgLen - 0.012], [br * 2.2, zf - hgLen - 0.006], [br * 2.2, zf - hgLen + 0.004], [br * 1.6, zf - hgLen + 0.008]], by);
    } else if (sh === 'heavy') {
      const h2 = Hh * 0.46, holes = [];
      for (let k = 0; k < 4; k++) { const z0 = zf - hgLen * 0.85 + k * hgLen * 0.2; holes.push(rect(z0, by - h2 * 0.2, z0 + hgLen * 0.12, by + h2 * 0.35)); }
      side(g, body, [[zf, by + h2], [zf - hgLen + 0.03, by + h2], [zf - hgLen, by + h2 * 0.3], [zf - hgLen, by - h2 * 0.55], [zf - hgLen + 0.04, by - h2], [zf, by - h2]], Wd * 1.04, { holes });
      B(g, aM, [0, by + h2 + 0.002, zf - hgLen * 0.45], [Wd * 0.5, 0.006, hgLen * 0.7]);
    } else if (sh === 'coil') {
      const cr = Math.min(br * 2.6, 0.05);
      for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(G.torus, gM); t.scale.setScalar(cr); t.position.set(0, by, zf - bl * 0.1 - k * bl * 0.14); g.add(t); }
      for (const sx of [-1, 1]) B(g, body, [sx * cr, by, zf - bl * 0.42], [0.008, Math.min(br * 1.4, 0.03), bl * 0.8]);
    } else if (sh === 'twin') {
      C(g, steel, [0, by - br * 2.2, zf - bl / 2 + 0.01], br, bl + 0.02);
      side(g, body, [[zf + 0.01, by + br * 1.2], [zf - bl * 0.35, by + br * 1.2], [zf - bl * 0.38, by - br * 1.1], [zf - bl * 0.35, by - br * 3.4], [zf + 0.01, by - br * 3.4]], br * 2.6);
      B(g, dark, [0, by + br * 1.1, zf - bl + 0.02], [0.004, 0.008, 0.006]);
    } else if (sh === 'multi') {
      const grp = new THREE.Group(); grp.position.set(0, by, zf); g.add(grp);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; C(grp, dark, [Math.cos(a) * br * 2.2, Math.sin(a) * br * 2.2, -bl / 2], br * 0.7, bl); }
      for (const z of [-bl * 0.1, -bl * 0.55, -bl * 0.95]) lathe(grp, body, [[br * 3.1, z - 0.015], [br * 3.4, z - 0.01], [br * 3.4, z + 0.01], [br * 3.1, z + 0.015]], 0);
      g.userData.spin = grp;
    } else if (sh === 'fins') {
      const fr = Math.min(br * 2.2, 0.05); for (let k = 0; k < 7; k++) front(g, body, oct(fr, fr, fr * 0.36, by), 0.007, zf - bl * 0.1 - k * bl * 0.1);
    } else if (sh === 'bone') {
      for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(G.torus, MX.bone); t.scale.setScalar(br * 2.4); t.position.set(0, by, zf - bl * 0.15 - k * bl * 0.2); t.rotation.z = k; g.add(t); }
    }
    if (!pistol && !revolver && bl > 0.15 && ['rails', 'vented', 'heavy', 'none'].includes(sh)) {
      const gzb = zf - hgLen - 0.022;
      B(g, dark, [0, by + br * 0.6, gzb], [br * 2.4, br * 3, 0.026]);
      if ((sp.optic || 'irons') === 'irons') side(g, dark, [[gzb - 0.01, by + br * 2], [gzb + 0.01, by + br * 2], [gzb + 0.004, top + 0.028], [gzb - 0.004, top + 0.028]], 0.006, { bev: 0.001 });
    }

    // ================= muzzle =================
    let mz = zf - bl;
    const mt = sp.muzzle || 'none';
    if (mt === 'brake') {
      const holes = [0, 1, 2].map((k) => rect(mz - 0.012 - k * 0.016, by - br * 0.9, mz - 0.006 - k * 0.016, by + br * 0.9));
      side(g, dark, [[mz + 0.004, by - br * 1.5], [mz - 0.058, by - br * 1.5], [mz - 0.062, by - br * 1.2], [mz - 0.062, by + br * 1.2], [mz - 0.058, by + br * 1.5], [mz + 0.004, by + br * 1.5]], br * 3, { holes, bev: 0.002 });
      mz -= 0.062;
    } else if (mt === 'suppressor') {
      const r = Math.min(br * 2.3, 0.045);
      lathe(g, dark, [[br * 0.9, mz - 0.2], [r * 0.9, mz - 0.199], [r, mz - 0.19], [r, mz - 0.025], [r * 1.04, mz - 0.02], [r * 1.04, mz - 0.006], [br * 1.2, mz + 0.004]], by);
      for (let k = 0; k < 3; k++) lathe(g, steel, [[r * 1.01, mz - 0.16 + k * 0.05], [r * 1.02, mz - 0.155 + k * 0.05], [r * 1.02, mz - 0.15 + k * 0.05], [r * 1.01, mz - 0.145 + k * 0.05]], by);
      mz -= 0.2;
    } else if (mt === 'flash') {
      lathe(g, dark, [[br * 1.3, mz - 0.07], [br * 1.65, mz - 0.064], [br * 1.55, mz - 0.012], [br * 1.1, mz + 0.004]], by);
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; B(g, MX.black, [Math.cos(a) * br * 1.62, by + Math.sin(a) * br * 1.62, mz - 0.05], [0.004, 0.004, 0.03]); }
      mz -= 0.07;
    } else if (mt === 'energy') {
      const t = new THREE.Mesh(G.torus, gM); t.scale.setScalar(Math.min(br * 2.8, 0.055)); t.position.set(0, by, mz - 0.02); g.add(t);
      for (const sx of [-1, 1]) side(g, body, [[mz + 0.01, by + sx * br * 1.5], [mz - 0.07, by + sx * br * 2.6], [mz - 0.075, by + sx * br * 2.2], [mz + 0.01, by + sx * br * 0.9]], 0.012, { bev: 0.001 });
      mz -= 0.05;
    } else if (mt === 'bell') {
      const q = Math.min(1, 0.022 / br);
      lathe(g, body, [[br * 3.4 * q, mz - 0.12], [br * 3.6 * q, mz - 0.114], [br * 2.6 * q, mz - 0.08], [br * 1.7 * q, mz - 0.03], [br * 1.3, mz + 0.004]], by);
      mz -= 0.1;
    } else if (mt === 'warhead') {
      lathe(g, MX.olive, [[0, mz - 0.2], [br * 0.35, mz - 0.19], [br * 0.95, mz - 0.1], [br * 1.05, mz - 0.07], [br * 1.05, mz - 0.02], [br * 0.6, mz + 0.01]], by);
      lathe(g, steel, [[br * 0.5, mz + 0.01], [br * 0.5, mz + 0.03]], by);
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.78; B(g, dark, [Math.cos(a) * br * 0.75, by + Math.sin(a) * br * 0.75, mz + 0.004], [0.004, 0.004, 0.03], [0, 0, a]); }
      mz -= 0.2;
    } else if (!pistol) lathe(g, dark, [[br * 1.1, mz - 0.012], [br * 1.35, mz - 0.008], [br * 1.35, mz + 0.01]], by);
    muzzle(g, mz, by);

    // ================= stock =================
    const st = bull ? 'none' : sp.stock || 'none';
    const nStock = g.children.length;
    if (st === 'fixed') {
      C(g, dark, [0, top - Hh * 0.38, rear + 0.07], 0.017, 0.14);
      const hy = top - Hh * 0.62, holes = [[[rear + 0.14, top - 0.036], [rear + 0.212, top - 0.042], [rear + 0.212, bot - 0.035], [rear + 0.195, bot - 0.035]]];
      side(g, camo ? main : furn, [[rear + 0.07, top - 0.008], [rear + 0.2, top - 0.02], [rear + 0.238, top - 0.026], [rear + 0.245, top - 0.04], [rear + 0.245, bot - 0.055], [rear + 0.225, bot - 0.066], [rear + 0.2, bot - 0.062], [rear + 0.11, hy], [rear + 0.07, hy]], Wd * 0.8, { holes });
      side(g, dark, [[rear + 0.244, top - 0.036], [rear + 0.262, top - 0.04], [rear + 0.262, bot - 0.058], [rear + 0.244, bot - 0.066]], Wd * 0.86);
      B(g, aM, [0, bot - 0.035, rear + 0.215], [Wd * 0.84, 0.008, 0.05]);
    } else if (st === 'skeleton') {
      side(g, camo ? main : dark, [[rear, top - 0.006], [rear + 0.23, top - 0.012], [rear + 0.245, top - 0.025], [rear + 0.245, bot - 0.045], [rear + 0.225, bot - 0.055], [rear, bot + 0.02]], Wd * 0.45,
        { holes: [[[rear + 0.02, top - 0.024], [rear + 0.212, top - 0.028], [rear + 0.225, bot - 0.035], [rear + 0.02, bot + 0.036]]] });
      side(g, gripM, [[rear + 0.24, top - 0.02], [rear + 0.258, top - 0.024], [rear + 0.258, bot - 0.05], [rear + 0.24, bot - 0.056]], Wd * 0.7);
    } else if (st === 'heavy') {
      side(g, camo ? main : furn, [[rear, top - 0.006], [rear + 0.25, top - 0.016], [rear + 0.27, top - 0.028], [rear + 0.27, bot - 0.07], [rear + 0.24, bot - 0.08], [rear + 0.12, bot - 0.02], [rear, bot + 0.005]], Wd * 0.9);
      side(g, dark, [[rear + 0.06, top + 0.002], [rear + 0.2, top - 0.004], [rear + 0.21, top - 0.016], [rear + 0.05, top - 0.012]], Wd * 0.6);
      side(g, dark, [[rear + 0.268, top - 0.026], [rear + 0.29, top - 0.03], [rear + 0.29, bot - 0.068], [rear + 0.268, bot - 0.078]], Wd * 0.95);
      C(g, steel, [Wd * 0.47, top - 0.03, rear + 0.14], 0.01, 0.012, [0, 0, Math.PI / 2]);
    } else if (st === 'wood') {
      side(g, MX.wood, [[rear, top - 0.008], [rear + 0.3, top - 0.028], [rear + 0.315, top - 0.04], [rear + 0.315, bot - 0.095], [rear + 0.295, bot - 0.105], [rear + 0.08, bot - 0.03], [rear + 0.03, bot - 0.012], [rear, bot]], Wd * 0.85, { bev: 0.006 });
      side(g, dark, [[rear + 0.313, top - 0.036], [rear + 0.328, top - 0.04], [rear + 0.328, bot - 0.1], [rear + 0.313, bot - 0.106]], Wd * 0.87);
    } else if (st === 'wire') {
      B(g, MX.chrome, [0, top - 0.02, rear + 0.1], [0.008, 0.008, 0.2]); B(g, MX.chrome, [0, bot + 0.01, rear + 0.1], [0.008, 0.008, 0.21], [0.22, 0, 0]);
      side(g, dark, [[rear + 0.19, top - 0.01], [rear + 0.215, top - 0.012], [rear + 0.215, bot - 0.04], [rear + 0.19, bot - 0.035]], 0.03);
    } else if (st === 'organic') {
      const m = new THREE.Mesh(G.cone, MX.bone); m.scale.set(Wd * 0.45, 0.17, Hh * 0.45); m.rotation.x = Math.PI / 2; m.position.set(0, 0.01, rear + 0.08); g.add(m);
      for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(G.torus, MX.flesh); r.scale.setScalar(Wd * (0.5 - k * 0.1)); r.position.set(0, 0, rear + 0.05 + k * 0.05); g.add(r); }
    }
    g.userData.stockParts = g.children.slice(nStock);

    // ================= magazine =================
    const mw = Wd * 0.55, ml = sp.magLen || 1;
    if (mg === 'box') {
      const d = 0.15 * ml;
      side(g, dark, [[mzc - 0.034, bot], [mzc + 0.034, bot], [mzc + 0.04, bot - d], [mzc - 0.028, bot - d]], mw);
      side(g, aM, [[mzc - 0.031, bot - d + 0.002], [mzc + 0.045, bot - d + 0.002], [mzc + 0.045, bot - d - 0.014], [mzc - 0.031, bot - d - 0.014]], mw * 1.08);
      for (const sx of [-1, 1]) B(g, MX.black, [sx * (mw / 2 + 0.001), bot - d / 2, mzc + 0.006], [0.002, d * 0.66, 0.008], [0.04, 0, 0]);
      if (sp.magPull) B(g, acc(0xd8d020), [0, bot - d - 0.022, mzc + 0.02], [mw * 0.4, 0.016, 0.012]);
    } else if (mg === 'curved') {
      const F = [], Bk = [], dd = 0.19 * ml;
      for (let i = 0; i <= 6; i++) { const t = i / 6, d = t * dd, off = -t * t * 0.07 * ml; F.push([mzc - 0.034 + off, bot - d]); Bk.push([mzc + 0.034 + off * 0.85, bot - d]); }
      side(g, dark, F.concat(Bk.slice().reverse()), mw);
      const e0 = F[6], e1 = Bk[6];
      side(g, aM, [[e0[0] - 0.003, e0[1] + 0.004], [e1[0] + 0.004, e1[1] + 0.004], [e1[0] + 0.003, e1[1] - 0.012], [e0[0] - 0.004, e0[1] - 0.012]], mw * 1.08);
      for (let k = 1; k < 5; k++) { const t = k / 6; B(g, MX.black, [mw / 2 + 0.001, bot - t * dd, mzc - t * t * 0.07 * ml], [0.002, 0.004, 0.05]); }
      if (sp.magPull) B(g, acc(0xd8d020), [0, e1[1] - 0.018, e1[0] - 0.02], [mw * 0.4, 0.014, 0.012]);
    } else if (mg === 'drum') {
      C(g, dark, [0, bot - 0.085, mzc], 0.085, mw * 1.3, [0, 0, Math.PI / 2]);
      for (const sx of [-1, 1]) { const t = new THREE.Mesh(G.torus, MX.black); t.scale.set(0.085, 0.085, 0.06); t.rotation.y = Math.PI / 2; t.position.set(sx * mw * 0.65, bot - 0.085, mzc); g.add(t); C(g, aM, [sx * mw * 0.66, bot - 0.085, mzc], 0.03, 0.006, [0, 0, Math.PI / 2]); }
      B(g, dark, [0, bot - 0.004, mzc], [mw, 0.03, 0.06]);
    } else if (mg === 'cell') {
      side(g, dark, [[mzc - 0.034, bot], [mzc + 0.034, bot], [mzc + 0.036, bot - 0.1 * ml], [mzc - 0.036, bot - 0.1 * ml]], mw * 1.1);
      B(g, gM, [0, bot - 0.05 * ml, mzc], [mw * 1.15, 0.05 * ml, 0.04]);
      for (let k = 0; k < 3; k++) B(g, MX.black, [0, bot - (0.034 + k * 0.016) * ml, mzc], [mw * 1.18, 0.004, 0.046]);
    } else if (mg === 'tube') {
      C(g, dark, [0, by - br - 0.022, zf - bl * 0.32], 0.02, bl * 0.62);
      lathe(g, aM, [[0, zf - bl * 0.63 - 0.012], [0.02, zf - bl * 0.63 - 0.01], [0.021, zf - bl * 0.63 + 0.004]], by - br - 0.022);
      if (!sp.noPump) {
        const pump = new THREE.Group(); g.add(pump);
        side(pump, furn, [[zf - 0.02, by - br - 0.004], [zf - 0.13, by - br - 0.004], [zf - 0.135, by - br - 0.04], [zf - 0.015, by - br - 0.04]], Wd * 0.9);
        for (let k = 0; k < 5; k++) B(pump, MX.black, [0, by - br - 0.022, zf - 0.03 - k * 0.022], [Wd * 0.92, 0.03, 0.004]);
        pump.userData.z0 = 0; g.userData.pump = pump;
      }
    } else if (mg === 'belt') {
      side(g, MX.olive, [[mzc - 0.08, bot + 0.01], [mzc + 0.08, bot + 0.01], [mzc + 0.08, bot - 0.13], [mzc - 0.08, bot - 0.13]], 0.11, { x: Wd * 0.55 });
      B(g, MX.black, [Wd * 0.55, bot + 0.014, mzc], [0.114, 0.012, 0.165]);
      for (let k = 0; k < 5; k++) { C(g, MX.brass, [Wd * 0.28 - k * 0.006, bot + 0.02 - k * 0.012, mzc - 0.04 + k * 0.006], 0.006, 0.04, [0, 0, 0]); }
    } else if (mg === 'canister') {
      C(g, aM, [0, bot - 0.075, mzc], 0.045, 0.15, [0, 0, 0]);
      C(g, gM, [0, bot - 0.075, mzc], 0.047, 0.03, [0, 0, 0]);
      C(g, dark, [0, bot - 0.155, mzc], 0.05, 0.012, [0, 0, 0]);
    } else if (mg === 'cyl') {   // revolving grenade cylinder around the barrel
      const cz = zf + 0.02, cr = Math.max(0.055, br * 1.6);
      lathe(g, body, [[0, cz - 0.1], [cr * 0.9, cz - 0.098], [cr, cz - 0.09], [cr, cz + 0.05], [cr * 0.9, cz + 0.058], [0, cz + 0.06]], by, 12);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; C(g, MX.black, [Math.cos(a) * cr * 0.6, by + Math.sin(a) * cr * 0.6, cz - 0.101], cr * 0.24, 0.004); B(g, dark, [Math.cos(a + 0.52) * cr * 0.99, by + Math.sin(a + 0.52) * cr * 0.99, cz - 0.02], [0.006, 0.006, 0.12], [0, 0, a]); }
    }

    // ================= optics =================
    const handle = sp.fore === 'handle';
    const railY = handle ? top + 0.062 : top + 0.006;
    if (handle) {
      side(g, dark, [[zc - L * 0.3, top - 0.004], [zc + L * 0.3, top - 0.004], [zc + L * 0.26, top + 0.058], [zc - L * 0.26, top + 0.058]], 0.024,
        { holes: [[[zc - L * 0.2, top + 0.008], [zc + L * 0.2, top + 0.008], [zc + L * 0.18, top + 0.04], [zc - L * 0.18, top + 0.04]]] });
    } else if (!pistol && !revolver && !organic && (sp.optic || 'irons') !== 'irons') rail(g, dark, zf + Hh * 0.3, rear - 0.03, top + 0.001, 0.022);
    const op = sp.optic || 'irons';
    let sight = top + 0.028;
    if (op === 'irons') {
      if (pistol || revolver) { B(g, dark, [0, top + 0.006, zf + 0.02], [0.005, 0.012, 0.008]); B(g, gM, [0, top + 0.013, zf + 0.02], [0.004, 0.004, 0.004]); for (const sx of [-1, 1]) B(g, dark, [sx * 0.008, top + 0.006, zb - 0.015], [0.006, 0.012, 0.008]); sight = top + 0.013; }
      else {
        const t = new THREE.Mesh(G.torus, dark); t.scale.set(0.011, 0.011, 0.02); t.position.set(0, top + 0.028, rear - 0.035); g.add(t);
        side(g, dark, [[rear - 0.05, top - 0.002], [rear - 0.02, top - 0.002], [rear - 0.025, top + 0.018], [rear - 0.045, top + 0.018]], 0.02, { bev: 0.001 });
        if (!['rails', 'vented', 'heavy', 'none'].includes(sh) || bl <= 0.15) side(g, dark, [[zf + 0.004, top - 0.004], [zf + 0.024, top - 0.004], [zf + 0.018, top + 0.028], [zf + 0.01, top + 0.028]], 0.006, { bev: 0.001 });
        B(g, gM, [0, top + 0.029, zf - 0.02], [0.004, 0.004, 0.004]);
      }
    } else if (op === 'red') {
      side(g, dark, [[zc - 0.03, railY], [zc + 0.035, railY], [zc + 0.03, railY + 0.012], [zc - 0.025, railY + 0.012]], 0.03);
      const sy = railY + 0.036;
      front(g, dark, [[-0.024, sy - 0.024], [0.024, sy - 0.024], [0.024, sy + 0.014], [0.014, sy + 0.024], [-0.014, sy + 0.024], [-0.024, sy + 0.014]], 0.05, zc - 0.025, { holes: [[[-0.018, sy - 0.018], [0.018, sy - 0.018], [0.018, sy + 0.01], [0.01, sy + 0.018], [-0.01, sy + 0.018], [-0.018, sy + 0.01]]] });
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.036), lensMat); lens.position.set(0, sy, zc - 0.022); g.add(lens);
      B(g, glow(0xff2020), [0, sy, zc - 0.02], [0.0048, 0.0048, 0.001]);
      C(g, dark, [0.026, sy, zc], 0.007, 0.012, [0, 0, Math.PI / 2]);
      sight = sy;
    } else if (op === 'holo') {
      side(g, dark, [[zc - 0.04, railY], [zc + 0.045, railY], [zc + 0.045, railY + 0.014], [zc - 0.04, railY + 0.014]], 0.04);
      const sy = railY + 0.036;
      front(g, dark, rect(-0.029, sy - 0.022, 0.029, sy + 0.026), 0.058, zc - 0.035, { holes: [rect(-0.023, sy - 0.017, 0.023, sy + 0.017)] });
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.034), lensMat); lens.position.set(0, sy, zc - 0.033); g.add(lens);
      const ring = new THREE.Mesh(G.torus, glow(0xff3030)); ring.scale.set(0.008, 0.008, 0.002); ring.position.set(0, sy, zc - 0.03); g.add(ring);
      B(g, glow(0xff3030), [0, sy, zc - 0.03], [0.004, 0.004, 0.001]);
      for (let k = 0; k < 2; k++) B(g, MX.chrome, [0.018 - k * 0.012, railY + 0.017, zc + 0.03], [0.008, 0.005, 0.01]);
      sight = sy;
    } else if (op === 'scope' || op === 'long') {
      const len = op === 'long' ? 0.36 : 0.25, r = op === 'long' ? 0.024 : 0.019, sy = railY + 0.022 + r;
      for (const z of [zc - len * 0.22, zc + len * 0.2]) { side(g, dark, [[z - 0.012, railY], [z + 0.012, railY], [z + 0.012, sy - r * 0.8], [z - 0.012, sy - r * 0.8]], 0.018); lathe(g, dark, [[r * 1.18, z - 0.008], [r * 1.18, z + 0.008]], sy); }
      lathe(g, dark, [[r * 1.55, zc - len / 2], [r * 1.62, zc - len / 2 + 0.006], [r * 1.58, zc - len / 2 + 0.05], [r, zc - len / 2 + 0.085], [r, zc + len / 2 - 0.075], [r * 1.3, zc + len / 2 - 0.045], [r * 1.34, zc + len / 2 - 0.004], [r * 1.28, zc + len / 2]], sy, 20);
      C(g, dark, [0, sy + r + 0.008, zc - 0.01], 0.011, 0.018, [0, 0, 0]); C(g, dark, [r + 0.008, sy, zc - 0.01], 0.011, 0.018, [0, 0, Math.PI / 2]);
      B(g, aM, [0, sy + r + 0.018, zc - 0.01], [0.012, 0.002, 0.004]);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 1.5, 20), new THREE.MeshBasicMaterial({ color: sp.lens || 0x40a0ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })); lens.position.set(0, sy, zc - len / 2 + 0.004); g.add(lens);
      const rc = glow(0x101010); const zr = zc + len / 2 - 0.01;
      B(g, rc, [0, sy, zr], [r * 2.4, 0.0012, 0.001]); B(g, rc, [0, sy, zr], [0.0012, r * 2.4, 0.001]); B(g, glow(0xff2020), [0, sy, zr - 0.001], [0.002, 0.002, 0.001]);
      sight = sy; g.userData.adsZ = -0.15 - (zc + len / 2);
    } else if (op === 'energy') {
      const sy = railY + 0.04;
      side(g, body, [[zc - 0.02, railY], [zc + 0.02, railY], [zc + 0.01, sy - 0.02], [zc - 0.01, sy - 0.02]], 0.014);
      const t = new THREE.Mesh(G.torus, gM); t.scale.set(0.022, 0.022, 0.03); t.position.set(0, sy, zc); g.add(t);
      B(g, gM, [0, sy, zc], [0.003, 0.003, 0.001]);
      sight = sy;
    }
    g.userData.adsY = -sight;

    // live ammo counter for energy weapons (and anything with a 'screen')
    const ex = sp.extras || [];
    if ((style === 'energy' || ex.includes('screen')) && !organic) {
      g.userData.ammoScreen = ammoScreen(g, [-Wd / 2 - 0.004, top - Hh * 0.18, rear - Math.min(0.06, L * 0.2)], [0, -Math.PI / 2, 0], 0.05, 0.025, sp.glow || 0x40ff90);
    }

    // ================= foregrip / extras =================
    const fg = sp.fore || 'none', fzz = fzGrip, fy = by - Hh * 0.3;
    if (fg === 'vertical') { side(g, gripM, [[fzz - 0.02, fy + 0.01], [fzz + 0.02, fy + 0.01], [fzz + 0.023, fy - 0.1], [fzz + 0.016, fy - 0.11], [fzz - 0.016, fy - 0.11], [fzz - 0.023, fy - 0.1]], 0.034); B(g, aM, [0, fy - 0.108, fzz], [0.036, 0.006, 0.04]); }
    else if (fg === 'angled') side(g, gripM, [[fzz - 0.055, fy + 0.01], [fzz + 0.05, fy + 0.01], [fzz + 0.012, fy - 0.048], [fzz - 0.03, fy - 0.05]], 0.03);
    for (const e of ex) {
      if (e === 'bipod') { B(g, dark, [0, fy - 0.004, fzz - 0.08], [0.03, 0.016, 0.03]); for (const sx of [-1, 1]) { B(g, dark, [sx * 0.012, fy - 0.01, fzz - 0.17], [0.008, 0.008, 0.18], [0, sx * 0.06, 0]); B(g, MX.black, [sx * 0.018, fy - 0.012, fzz - 0.265], [0.014, 0.012, 0.014]); } }
      if (e === 'laser') { side(g, dark, [[fzz - 0.035, by + 0.012], [fzz + 0.035, by + 0.012], [fzz + 0.035, by - 0.014], [fzz - 0.03, by - 0.014]], 0.022, { x: Wd * 0.55 + 0.01 }); B(g, glow(0xff2020), [Wd * 0.55 + 0.01, by, fzz - 0.036], [0.008, 0.008, 0.002]); }
      if (e === 'screen') { B(g, MX.black, [-Wd / 2 - 0.003, ym + (top - ym) * 0.5, zc + L * 0.22], [0.004, Hh * 0.34, 0.06]); }
      if (e === 'tank') { lathe(g, aM, [[0, zc - L * 0.22], [0.035, zc - L * 0.22 + 0.004], [0.045, zc - L * 0.2 + 0.02], [0.045, zc + L * 0.22 - 0.02], [0.035, zc + L * 0.22], [0, zc + L * 0.22 + 0.002]], 0, 14).position.x = Wd * 0.5 + 0.04; C(g, gM, [Wd * 0.5 + 0.04, 0, zc], 0.047, 0.02); C(g, MX.chrome, [Wd * 0.5 + 0.02, 0.03, zc - L * 0.24], 0.006, 0.05, [0, 0, 0.8]); }
      if (e === 'coils') for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(G.torus, gM); t.scale.setScalar(Wd * 0.58); t.position.set(0, 0.02, zc - L * 0.25 + k * L * 0.2); g.add(t); }
      if (e === 'spikes') for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(G.cone, MX.bone); c.scale.set(0.01, 0.09, 0.01); c.position.set((k % 2 ? 1 : -1) * Wd * 0.5, 0.02, zc - L * 0.35 + k * L * 0.12); c.rotation.z = (k % 2 ? -1 : 1) * 1.2; g.add(c); }
      if (e === 'blade') side(g, MX.chrome, [[zf - bl + 0.02, by - br - 0.004], [zf - bl - 0.15, by - br - 0.01], [zf - bl - 0.13, by - br - 0.03], [zf - bl + 0.02, by - br - 0.03]], 0.004, { bev: 0.001 });
      if (e === 'orb') { const o = new THREE.Mesh(G.sph, gM); o.scale.setScalar(Wd * 0.45); o.position.set(0, 0.03, zc - L * 0.35); o.userData.base = Wd * 0.45; g.add(o); g.userData.core = o; }
      if (e === 'cage') {   // spinning bone cage around a pulsing core at the front
        const cage = new THREE.Group(); cage.position.set(0, by, zf - bl * 0.6); g.add(cage);
        for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(G.torus, MX.bone); t.scale.setScalar(0.085); t.rotation.set(k * 1.05, k * 0.7, 0); cage.add(t); }
        const orb = new THREE.Mesh(G.sph, gM); orb.scale.setScalar(0.045); orb.userData.base = 0.045; cage.add(orb);
        g.userData.spin = cage; g.userData.core = orb;
        for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.78; const s2 = new THREE.Mesh(G.cone, MX.bone); s2.scale.set(0.015, 0.2, 0.015); s2.position.set(Math.cos(a) * 0.07, by + Math.sin(a) * 0.07, zf - bl * 0.6); s2.rotation.x = -Math.PI / 2; g.add(s2); }
      }
      if (e === 'pilot') { const pl = new THREE.Mesh(G.sph, glow(0x60a0ff)); pl.scale.setScalar(0.012); pl.position.set(0, by - br * 1.6, zf - bl - 0.02); g.add(pl); B(g, steel, [0, by - br * 1.3, zf - bl * 0.6], [0.006, 0.006, bl * 0.8]); }
      if (e === 'wires') for (let k = 0; k < 3; k++) B(g, gM, [-Wd * 0.5 - 0.004, 0.02 - k * 0.012, zc], [0.004, 0.004, L * 0.8]);
      if (e === 'limbs') { for (const sx of [-1, 1]) { B(g, MX.black, [sx * 0.15, by, zf - bl * 0.82], [0.28, 0.022, 0.03], [0, sx * 0.35, 0]); C(g, steel, [sx * 0.28, by, zf - bl * 0.77], 0.012, 0.03, [0, 0, 0]); } B(g, glow(0xffe0a0), [0, by, zf - bl * 0.66], [0.56, 0.003, 0.003]); B(g, MX.bone, [0, by + 0.012, zf - bl * 0.4], [0.008, 0.008, bl * 0.9]); }
    }
    const right = [0, bot - 0.1, gz + 0.02];
    const left = pistol || revolver ? [-0.025, bot - 0.12, gz + 0.04] : mg === 'tube' && !sp.noPump ? [0, by - br - 0.05, zf - 0.075] : fg === 'vertical' || fg === 'angled' ? [0, fy - 0.03, fzz] : [0, by - Hh * 0.35, Math.max(zf - bl * 0.3, zf - 0.2)];
    g.userData.grips = [right, left, pistol || revolver ? [-0.16, -0.24, 0.32] : undefined];
  }

  // ======================================================================
  //  Gunsmith: attachments by category, which classes accept them, and their stat effects
  // ======================================================================
  const ATT = XH.ATTACH = {
    optic: { name: 'Optic', kills: 5, opts: {
      irons: { name: 'Iron sights', desc: 'Faster aiming', fx: { adsTime: 0.85 } },
      red: { name: 'Red dot', desc: 'Clear sight picture', fx: { ads: 0.9 } },
      holo: { name: 'Holographic', desc: 'Tighter aim, a touch slower', fx: { ads: 0.8, adsTime: 1.05 } },
      scope: { name: '3x scope', desc: 'Zoom and precision, slower to aim', fx: { adsZoom: 0.72, ads: 0.5, adsTime: 1.15 } },
      long: { name: '8x long scope', desc: 'Long-range precision, slow to aim', fx: { adsZoom: 0.5, ads: 0.35, adsTime: 1.3 } } } },
    muzzle: { name: 'Muzzle', kills: 15, opts: {
      none: { name: 'Bare muzzle', desc: 'No change', fx: {} },
      brake: { name: 'Muzzle brake', desc: '-25% recoil', fx: { recoil: 0.75 } },
      suppressor: { name: 'Suppressor', desc: '-15% recoil, -5% damage, no muzzle flash', fx: { recoil: 0.85, dmg: 0.95, noFlash: 1 } },
      flash: { name: 'Flash hider', desc: '-15% hip-fire spread', fx: { spread: 0.85 } } } },
    under: { name: 'Underbarrel', kills: 30, opts: {
      none: { name: 'None', desc: 'No change', fx: {} },
      vertical: { name: 'Vertical grip', desc: '-20% recoil', fx: { recoil: 0.8 } },
      angled: { name: 'Angled grip', desc: '15% faster aiming', fx: { adsTime: 0.85 } },
      laser: { name: 'Laser sight', desc: '-30% hip-fire spread', fx: { spread: 0.7 } },
      bipod: { name: 'Bipod', desc: '-30% recoil, -4% move speed', fx: { recoil: 0.7, move: 0.96 } } } },
    mag: { name: 'Magazine', kills: 50, opts: {
      std: { name: 'Standard', desc: 'No change', fx: {} },
      extended: { name: 'Extended mag', desc: '+40% capacity, 15% slower reload', fx: { mag: 1.4, reload: 1.15 } },
      fast: { name: 'Fast mag', desc: '25% faster reload, -10% capacity', fx: { reload: 0.75, mag: 0.9 } },
      drum: { name: 'Drum', desc: '+90% capacity, 35% slower reload, -5% move', fx: { mag: 1.9, reload: 1.35, move: 0.95 } } } },
    stock: { name: 'Stock', kills: 75, opts: {
      std: { name: 'Standard', desc: 'No change', fx: {} },
      light: { name: 'Skeleton stock', desc: '+5% move, faster aim, +10% recoil', fx: { move: 1.05, adsTime: 0.9, recoil: 1.1 } },
      heavy: { name: 'Heavy stock', desc: '-20% recoil, slower aim', fx: { recoil: 0.8, adsTime: 1.1 } },
      none: { name: 'No stock', desc: '+8% move, much faster aim, +30% recoil', fx: { move: 1.08, adsTime: 0.8, recoil: 1.3 } } } },
  };
  // which options each weapon class can mount
  const ALLOW = {
    Pistol: { optic: ['irons', 'red'], muzzle: ['none', 'brake', 'suppressor'], mag: ['std', 'extended', 'fast'] },
    'Hand Cannon': { optic: ['irons', 'red'], muzzle: ['none', 'brake'], mag: ['std', 'fast'] },
    SMG: { optic: ['irons', 'red', 'holo'], muzzle: ['none', 'brake', 'suppressor', 'flash'], under: ['none', 'vertical', 'angled', 'laser'], mag: ['std', 'extended', 'fast', 'drum'], stock: ['std', 'light', 'heavy', 'none'] },
    Rifle: { optic: ['irons', 'red', 'holo', 'scope'], muzzle: ['none', 'brake', 'suppressor', 'flash'], under: ['none', 'vertical', 'angled', 'laser'], mag: ['std', 'extended', 'fast', 'drum'], stock: ['std', 'light', 'heavy'] },
    LMG: { optic: ['irons', 'red', 'holo', 'scope'], muzzle: ['none', 'brake', 'flash'], under: ['none', 'vertical', 'bipod'], mag: ['std', 'fast', 'drum'], stock: ['std', 'light', 'heavy'] },
    Shotgun: { optic: ['irons', 'red', 'holo'], muzzle: ['none', 'brake', 'flash'], under: ['none', 'vertical', 'angled', 'laser'], mag: ['std', 'extended', 'fast'], stock: ['std', 'light', 'heavy', 'none'] },
    Marksman: { optic: ['irons', 'red', 'holo', 'scope', 'long'], muzzle: ['none', 'brake', 'suppressor', 'flash'], under: ['none', 'vertical', 'bipod', 'laser'], mag: ['std', 'extended', 'fast'], stock: ['std', 'light', 'heavy'] },
    Sniper: { optic: ['holo', 'scope', 'long'], muzzle: ['none', 'brake', 'suppressor'], under: ['none', 'bipod', 'laser'], mag: ['std', 'extended', 'fast'], stock: ['std', 'light', 'heavy'] },
    Launcher: { optic: ['irons', 'red', 'holo'], mag: ['std', 'fast'], stock: ['std', 'light', 'heavy'] },
    Energy: { optic: ['irons', 'red', 'holo', 'scope'], under: ['none', 'vertical', 'laser'], mag: ['std', 'extended', 'fast'] },
    Heavy: { optic: ['irons', 'red', 'holo'], mag: ['std', 'fast'] },
    Special: { mag: ['std', 'extended', 'fast'] },
    'Wonder Weapon': {},
  };
  WP.attAllowed = (id) => { const d = WP.DEFS[id]; if (!d || d.organic) return {}; return ALLOW[d.cls] || {}; };
  // turn a saved gunsmith selection into stat multipliers
  WP.attFx = (id, sel) => {
    const out = {}, allowed = WP.attAllowed(id);
    for (const cat in sel || {}) {
      const o = sel[cat]; if (!o || o === 'default' || !(allowed[cat] || []).includes(o)) continue;
      const fx = ATT[cat].opts[o].fx;
      for (const k in fx) out[k] = (out[k] || 1) * fx[k];
    }
    return out;
  };
  // the spec actually built for this weapon with its attachments
  function specWith(id, spec) {
    const sel = XH.progress && XH.progress.attFor ? XH.progress.attFor(id) : null;
    if (!sel) return spec;
    const sp = Object.assign({}, spec, { extras: (spec.extras || []).slice() }), allowed = WP.attAllowed(id);
    const on = (cat) => sel[cat] && sel[cat] !== 'default' && (allowed[cat] || []).includes(sel[cat]);
    if (on('optic')) sp.optic = sel.optic;
    if (on('muzzle')) sp.muzzle = sel.muzzle;
    if (on('under')) {
      sp.extras = sp.extras.filter((e) => e !== 'laser' && e !== 'bipod');
      if (sel.under === 'vertical' || sel.under === 'angled') sp.fore = sel.under; else if (sp.fore !== 'handle') sp.fore = 'none';
      if (sel.under === 'laser' || sel.under === 'bipod') sp.extras.push(sel.under);
    }
    if (on('mag')) { if (sel.mag === 'drum') sp.mag = 'drum'; else if (sel.mag === 'extended') sp.magLen = 1.35; else if (sel.mag === 'fast') sp.magPull = true; }
    if (on('stock')) sp.stock = { light: 'skeleton', heavy: 'heavy', none: 'none', std: spec.stock }[sel.stock] || spec.stock;
    return sp;
  }

  // ======================================================================
  //  Weapon traits (what makes each gun play differently)
  // ======================================================================
  XH.WTRAITS = {
    quickdraw: ['Quickdraw', 'Swaps and aims twice as fast'],
    hipfire: ['Hip-fire', 'Half the hip-fire spread'],
    steady: ['Steady', 'Half the recoil and tighter aim'],
    headhunter: ['Headhunter', '+50% headshot damage'],
    lastround: ['Last Round', 'The last round in the magazine deals triple damage'],
    ramp: ['Ramp-up', 'Fire rate climbs up to +60% while you hold the trigger'],
    executioner: ['Executioner', 'Double damage to creatures under 35% health'],
    stagger: ['Stagger', 'Hits stun and shove smaller creatures'],
    marker: ['Marker', 'Hit creatures take +20% damage from everything for 3 s'],
    bounty: ['Bounty', '+50% points for kills'],
    closeq: ['Close Quarters', '+40% damage within 6 m, weaker past 15 m'],
    overpen: ['Overpenetration', '+2 pierce and no damage loss through bodies'],
    firstshot: ['Opener', 'The first shot after a pause deals double damage'],
    marksman: ['Marksman', 'Aimed shots deal +25% damage with no falloff'],
    shock: ['Shock Rounds', '25% chance to arc to a nearby creature'],
    vampiric: ['Vampiric', 'Kills restore 5 health'],
    suppress: ['Suppressive', 'Hits slow creatures down'],
    giantslayer: ['Giant Slayer', '+50% damage to heavies, elites and bosses'],
    shred: ['Armor Shred', 'Ignores armor plating'],
    scavenger: ['Scavenger', 'Kills put a round back in the magazine'],
    incendiary: ['Incendiary', 'Sets creatures on fire'],
    explosive: ['Explosive', 'Rounds or projectiles burst on impact'],
    knockback: ['Knockback', 'Blasts creatures backwards'],
    cryo: ['Cryo', 'Chills and freezes creatures'],
    homing: ['Homing', 'Projectiles seek their target'],
    ricochet: ['Ricochet', 'Projectiles bounce between walls and creatures'],
    beam: ['Beam', 'A continuous beam that pierces'],
    arcchain: ['Chain Lightning', 'Lightning chains between creatures'],
    wonder: ['Wonder Weapon', 'Unique, map-changing firepower'],
    extended: ['Deep Magazine', 'Huge magazine for sustained fire'],
    mobile: ['Mobile', 'Move 8% faster while held'],
    tactical: ['Tactical Reload', 'Reloads 40% faster when the magazine is not empty'],
  };

  // ======================================================================
  //  Class templates and the full list
  // ======================================================================
  const CL = {
    pistol: { cls: 'Pistol', mode: 'hit', rate: 0.13, mag: 12, reserve: 96, reload: 1.3, spread: 0.012, ads: 0.003, recoil: 0.02, snd: 'pistol', flash: 0xffc070, adsZoom: 0.85, cal: '9mm' },
    smg: { cls: 'SMG', mode: 'hit', auto: true, rate: 0.065, mag: 32, reserve: 256, reload: 1.8, spread: 0.028, ads: 0.01, recoil: 0.011, snd: 'smg', flash: 0xffc070, adsZoom: 0.8, cal: '9mm' },
    ar: { cls: 'Rifle', mode: 'hit', auto: true, rate: 0.095, mag: 30, reserve: 240, reload: 2.0, spread: 0.022, ads: 0.004, recoil: 0.015, snd: 'rifle', flash: 0xffc070, adsZoom: 0.75, cal: '6.8mm' },
    lmg: { cls: 'LMG', mode: 'hit', auto: true, rate: 0.075, mag: 100, reserve: 400, reload: 4, spread: 0.034, ads: 0.012, recoil: 0.012, snd: 'rifle', flash: 0xffb050, adsZoom: 0.8, move: 0.85, cal: '7.62mm' },
    shotgun: { cls: 'Shotgun', mode: 'hit', pellets: 8, rate: 0.7, mag: 6, reserve: 48, reload: 2.4, spread: 0.075, ads: 0.06, recoil: 0.07, snd: 'shotgun', flash: 0xffb050, adsZoom: 0.85, falloff: true, cal: '12 GA' },
    dmr: { cls: 'Marksman', mode: 'hit', rate: 0.25, mag: 15, reserve: 120, reload: 2.2, spread: 0.012, ads: 0.002, recoil: 0.03, snd: 'burst', flash: 0xffc070, adsZoom: 0.55, cal: '7.62mm' },
    sniper: { cls: 'Sniper', mode: 'hit', rate: 1.0, mag: 5, reserve: 40, reload: 2.6, spread: 0.07, ads: 0, recoil: 0.09, snd: 'rail', flash: 0xffc070, adsZoom: 0.3, scope: true, pierce: 5, cal: '.408' },
    launcher: { cls: 'Launcher', mode: 'proj', rate: 0.9, mag: 4, reserve: 24, reload: 3, spread: 0.01, ads: 0.004, recoil: 0.08, snd: 'launcher', flash: 0xffb050, adsZoom: 0.85, cal: '40mm' },
    energy: { cls: 'Energy', mode: 'hit', auto: true, rate: 0.08, mag: 40, reserve: 240, reload: 2.2, spread: 0.02, ads: 0.004, recoil: 0.012, snd: 'plasma', flash: 0x60d0ff, adsZoom: 0.8, cal: 'CELL' },
    special: { cls: 'Special', mode: 'flame', auto: true, rate: 0.05, mag: 100, reserve: 400, reload: 2.8, range: 9, cone: 0.3, spread: 0, ads: 0, recoil: 0, snd: 'flame', adsZoom: 0.9, cal: 'FUEL' },
    wonder: { cls: 'Wonder Weapon', mode: 'proj', rate: 1, mag: 3, reserve: 12, reload: 2.6, spread: 0, ads: 0, recoil: 0.05, snd: 'void', flash: 0xb040ff, adsZoom: 0.85, cal: '???' },
  };

  // Original 14: stats stay in weapons.js; they get roles, traits and new models here.
  const ORIG = {
    p9: ['Reliable sidearm', ['tactical'], { body: [0.28, 0.078, 0.034, 'slide'], color: 'gunmetal', lower: 'polymer', accent: 0x40ff80, glow: 0x40ff80, barrel: [0.04, 0.012], pistol: true }],
    carbine: ['Run-and-gun SMG', ['hipfire', 'mobile'], { body: [0.36, 0.11, 0.05], color: 'gunmetal', accent: 0xd06a18, barrel: [0.16, 0.015], shroud: 'vented', muzzle: 'flash', mag: 'curved', stock: 'skeleton', optic: 'red' }],
    pulse: ['Marking pulse rifle', ['marker'], { body: [0.52, 0.13, 0.06, 'energy'], color: 'blue', glow: 0x80d0ff, barrel: [0.26, 0.018], shroud: 'rails', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'holo', fore: 'vertical' }],
    breacher: ['Pump crowd-stopper', ['stagger'], { body: [0.42, 0.12, 0.058], color: 'black', furn: 'tan', accent: 0xd06a18, barrel: [0.42, 0.024], mag: 'tube', stock: 'fixed', optic: 'irons', muzzle: 'brake' }],
    burst: ['Three-round headhunter', ['headhunter'], { body: [0.54, 0.12, 0.058], color: 'white', accent: 0x2a4a7a, barrel: [0.34, 0.017], shroud: 'rails', muzzle: 'flash', stock: 'fixed', optic: 'red' }],
    rail: ['Line-piercing railgun', ['overpen', 'beam'], { body: [0.62, 0.12, 0.06, 'energy'], color: 'white', glow: 0x60c8ff, barrel: [0.46, 0.017], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'heavy', optic: 'long', lens: 0x60c8ff }],
    magnum: ['Big-game revolver', ['giantslayer', 'stagger'], { body: [0.3, 0.1, 0.04, 'revolver'], color: 'chrome', lower: 'gunmetal', gripMat: 'wood', accent: 0xffb030, barrel: [0.14, 0.014], stripe: false, mag: 'none' }],
    havoc: ['Spin-up area denial', ['ramp', 'shred'], { body: [0.5, 0.15, 0.09, 'bulky'], color: 'olive', accent: 0xd06a18, barrel: [0.36, 0.014], shroud: 'multi', mag: 'belt', fore: 'handle', optic: 'irons', stock: 'none' }],
    inferno: ['Close-range incinerator', ['incendiary'], { body: [0.46, 0.13, 0.065, 'bulky'], color: 'red', accent: 0x1a1a1a, glow: 0xff7020, barrel: [0.3, 0.028], shroud: 'vented', muzzle: 'bell', mag: 'canister', stock: 'fixed', extras: ['tank', 'pilot'] }],
    arc: ['Chain lightning', ['arcchain'], { body: [0.44, 0.14, 0.07, 'energy'], color: 'gunmetal', glow: 0x9fc8ff, barrel: [0.18, 0.02], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'energy', extras: ['orb', 'coils'] }],
    plasma: ['Splash plasma', ['explosive'], { body: [0.4, 0.15, 0.08, 'round'], color: 'white', glow: 0x40c8ff, barrel: [0.2, 0.035], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'holo' }],
    gl: ['Bank-shot grenades', ['explosive'], { body: [0.34, 0.12, 0.07], color: 'olive', accent: 0xc89a20, barrel: [0.24, 0.042], mag: 'cyl', stock: 'fixed', fore: 'vertical', optic: 'red' }],
    cryo: ['Crowd freezer', ['cryo'], { body: [0.44, 0.13, 0.065, 'energy'], color: 'white', glow: 0xa0e8ff, barrel: [0.22, 0.03], shroud: 'fins', muzzle: 'bell', mag: 'canister', stock: 'fixed', extras: ['tank'] }],
    void: ['Wonder: black hole', ['wonder'], { body: [0.34, 0.14, 0.09, 'organic'], color: 'purple', glow: 0xb040ff, barrel: [0.2, 0.03], mag: 'none', stock: 'organic', optic: 'energy', extras: ['cage'] }],
  };

  // [id, class, name, upgraded name, role, traits, stats, model]
  const LIST = [
    // ---------- pistols ----------
    ['viper', 'pistol', 'M7 Viper', 'Viper Fang', 'Quick-draw sidearm', ['quickdraw', 'hipfire'], { dmg: 52, rate: 0.12, mag: 15, reserve: 105, cost: 500 }, { body: [0.3, 0.075, 0.034, 'slide'], color: 'gunmetal', accent: 0x2fb8b8, barrel: [0.04, 0.013], pistol: true }],
    ['rook45', 'pistol', 'Rook .45', 'Rook Sovereign', 'Headshot pistol', ['headhunter', 'lastround'], { dmg: 95, rate: 0.2, mag: 8, reserve: 64, recoil: 0.04, snd: 'magnum', cost: 800, cal: '.45 ACP' }, { body: [0.34, 0.085, 0.04, 'slide'], color: 'tan', accent: 0x222222, barrel: [0.05, 0.016], muzzle: 'brake', optic: 'red', pistol: true }],
    ['hornet', 'pistol', 'Hornet MP', 'Hornet Swarm', 'Machine pistol', ['ramp'], { auto: true, rate: 0.06, dmg: 30, mag: 24, reserve: 192, spread: 0.03, snd: 'smg', box: 5 }, { body: [0.32, 0.08, 0.038, 'slide'], color: 'black', accent: 0xffc020, barrel: [0.06, 0.012], muzzle: 'flash', fore: 'angled', pistol: true }],
    ['derringer', 'pistol', 'Twin-Fang Derringer', 'Twin-Fang Executioner', 'Two-shot finisher', ['executioner', 'stagger'], { dmg: 380, pierce: 2, rate: 0.15, mag: 2, reserve: 40, reload: 1.4, recoil: 0.06, snd: 'magnum', box: 5, cal: '.50' }, { body: [0.2, 0.08, 0.04], color: 'chrome', accent: 0x8a2424, barrel: [0.12, 0.018], shroud: 'twin', pistol: true, stripe: false, mag: 'none', gripMat: 'wood' }],
    ['sparkpistol', 'pistol', 'Spark Pistol', 'Storm Pistol', 'Stunning arc sidearm', ['arcchain', 'stagger'], { mode: 'arc', dmg: 140, chains: 2, rate: 0.22, mag: 16, reserve: 112, snd: 'arc', flash: 0x9fc8ff, box: 5, upg: { chains: 5 }, cal: 'CELL' }, { body: [0.26, 0.09, 0.045, 'energy'], color: 'white', glow: 0x60c0ff, barrel: [0.05, 0.014], shroud: 'coil', muzzle: 'energy', pistol: true, mag: 'cell' }],
    ['needler', 'pistol', 'Needler PX', 'Needler Queen', 'Homing marker needles', ['homing', 'marker'], { mode: 'proj', auto: true, dmg: 70, rate: 0.09, mag: 30, reserve: 180, snd: 'spit', flash: 0xff60d0, proj: { speed: 42, r: 0.9, color: 0xff60d0, size: 0.12, homing: true }, box: 5, cal: 'BIO' }, { body: [0.28, 0.09, 0.05, 'organic'], color: 'purple', glow: 0xff60d0, barrel: [0.08, 0.012], shroud: 'bone', pistol: true, optic: 'energy', extras: ['spikes'], mag: 'none' }],
    // ---------- SMGs ----------
    ['kestrel9', 'smg', 'Kestrel-9', 'Kestrel Talonstorm', 'Precision SMG', ['steady'], { dmg: 36, rate: 0.062, mag: 30, reserve: 240, cost: 1000 }, { body: [0.36, 0.11, 0.05], color: 'black', accent: 0xd06a18, barrel: [0.14, 0.015], shroud: 'vented', muzzle: 'flash', stock: 'skeleton', optic: 'red' }],
    ['wasp', 'smg', 'Wasp PDW', 'Wasp Nest', 'Point-farming PDW', ['bounty'], { dmg: 30, rate: 0.05, mag: 50, reserve: 300, cost: 1200, cal: '5.7mm' }, { body: [0.4, 0.12, 0.055, 'bulky'], color: 'tan', accent: 0x222222, barrel: [0.1, 0.014], muzzle: 'suppressor', bullpup: true, optic: 'holo' }],
    ['buzzsaw', 'smg', 'Buzzsaw SMG', 'Buzzsaw Chainrend', 'Bullet hose', ['ramp', 'extended'], { dmg: 26, rate: 0.045, mag: 60, reserve: 360, spread: 0.035, box: 5 }, { body: [0.38, 0.11, 0.055], color: 'yellow', accent: 0x151515, barrel: [0.12, 0.016], shroud: 'fins', mag: 'drum', stock: 'wire', fore: 'vertical' }],
    ['vectorx', 'smg', 'Vector-X', 'Vector Nullpoint', 'Close-quarters shredder', ['closeq'], { dmg: 34, rate: 0.045, mag: 33, reserve: 264, recoil: 0.006, box: 5, cal: '.45 ACP' }, { body: [0.34, 0.13, 0.05, 'bulky'], color: 'white', accent: 0x2a4a7a, barrel: [0.1, 0.014], muzzle: 'suppressor', stock: 'fixed', optic: 'red', fore: 'angled' }],
    ['ionripper', 'smg', 'Ion Ripper', 'Ion Harrower', 'Piercing energy SMG', ['overpen'], { dmg: 42, rate: 0.07, mag: 45, reserve: 270, pierce: 2, tracer: 0x40c8ff, flash: 0x40c8ff, snd: 'plasma', cost: 2000, cal: 'CELL' }, { body: [0.38, 0.11, 0.055, 'energy'], color: 'blue', glow: 0x40c8ff, barrel: [0.12, 0.015], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'skeleton', optic: 'energy' }],
    ['mauler', 'smg', 'Mauler-45', 'Mauler Brute', 'Stopping-power SMG', ['stagger', 'closeq'], { dmg: 58, rate: 0.09, mag: 25, reserve: 200, box: 5, cal: '.45 ACP' }, { body: [0.4, 0.12, 0.058], color: 'olive', accent: 0xd06a18, barrel: [0.14, 0.018], shroud: 'rails', muzzle: 'brake', mag: 'curved', stock: 'fixed', fore: 'vertical' }],
    // ---------- assault rifles ----------
    ['talon', 'ar', 'Talon AR', 'Talon Apex', 'Balanced rifle', ['tactical', 'steady'], { dmg: 60, rate: 0.092, mag: 30, reserve: 240, cost: 1400 }, { body: [0.5, 0.12, 0.06], color: 'black', furn: 'tan', accent: 0xd06a18, barrel: [0.26, 0.017], shroud: 'rails', muzzle: 'brake', mag: 'curved', stock: 'fixed', optic: 'red', fore: 'vertical' }],
    ['warden', 'ar', 'Warden M4', 'Warden Bastion', 'Self-sustaining rifle', ['hipfire', 'scavenger'], { dmg: 55, rate: 0.085, mag: 30, reserve: 270, box: 5, cal: '5.56mm' }, { body: [0.48, 0.12, 0.056], color: 'tan', accent: 0x3a5a2a, barrel: [0.28, 0.016], shroud: 'rails', muzzle: 'flash', stock: 'fixed', optic: 'holo', extras: ['laser'] }],
    ['brigand', 'ar', 'Brigand AR', 'Brigand Warlord', 'Hard-opening rifle', ['firstshot'], { dmg: 72, rate: 0.11, mag: 30, reserve: 210, cost: 1600, cal: '7.62mm' }, { body: [0.52, 0.13, 0.062], color: 'gunmetal', accent: 0x8a2424, barrel: [0.24, 0.019], shroud: 'vented', muzzle: 'brake', mag: 'curved', stock: 'wood', fore: 'angled' }],
    ['sentinel', 'ar', 'Sentinel Carbine', 'Sentinel Overwatch', 'Scoped marksman carbine', ['marksman'], { dmg: 58, rate: 0.08, mag: 30, reserve: 240, ads: 0.002, adsZoom: 0.6, cost: 1400 }, { body: [0.46, 0.115, 0.055], color: 'white', accent: 0x2a4a7a, barrel: [0.24, 0.016], shroud: 'rails', muzzle: 'suppressor', stock: 'skeleton', optic: 'scope', lens: 0x40ff90 }],
    ['ionic', 'energy', 'Ionic AR', 'Ionic Radiance', 'Arcing energy rifle', ['shock'], { dmg: 68, rate: 0.09, mag: 40, reserve: 280, pierce: 2, tracer: 0x60ffd0, flash: 0x60ffd0, box: 5 }, { body: [0.54, 0.13, 0.06, 'energy'], color: 'teal', glow: 0x60ffd0, barrel: [0.24, 0.018], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'energy', extras: ['screen'] }],
    ['oathbreaker', 'ar', 'Oathbreaker', 'Oathbreaker Heresy', 'Heavy battle rifle', ['giantslayer', 'firstshot'], { dmg: 88, rate: 0.13, mag: 25, reserve: 175, recoil: 0.022, box: 5, cal: '.338' }, { body: [0.56, 0.13, 0.064, 'bulky'], color: 'red', accent: 0x151515, barrel: [0.3, 0.019], shroud: 'heavy', muzzle: 'brake', stock: 'heavy', optic: 'holo', extras: ['bipod'] }],
    ['nomad', 'ar', 'Nomad Rifle', 'Nomad Wanderer', 'Lifesteal bullpup', ['vampiric'], { dmg: 64, rate: 0.1, mag: 35, reserve: 245, box: 5 }, { body: [0.5, 0.13, 0.06, 'bulky'], color: 'green', accent: 0xc89a20, barrel: [0.18, 0.017], muzzle: 'flash', mag: 'curved', bullpup: true, optic: 'red', fore: 'handle' }],
    ['tempest', 'ar', 'Tempest AR', 'Tempest Cyclone', 'Suppressing drum rifle', ['extended', 'suppress'], { dmg: 50, rate: 0.06, mag: 40, reserve: 320, spread: 0.026, box: 5 }, { body: [0.5, 0.12, 0.058], color: 'blue', accent: 0xd0d4d8, barrel: [0.26, 0.016], shroud: 'vented', muzzle: 'flash', mag: 'drum', stock: 'skeleton', optic: 'holo', fore: 'vertical' }],
    // ---------- LMGs ----------
    ['juggernaut', 'lmg', 'Juggernaut LMG', 'Juggernaut Colossus', 'Steady wall of lead', ['extended', 'steady'], { dmg: 65, rate: 0.08, mag: 100, reserve: 400, box: 5 }, { body: [0.6, 0.16, 0.075, 'bulky'], color: 'olive', accent: 0xc89a20, barrel: [0.34, 0.022], shroud: 'heavy', muzzle: 'brake', mag: 'belt', stock: 'heavy', fore: 'handle', extras: ['bipod'] }],
    ['hailstorm', 'lmg', 'Hailstorm', 'Hailstorm Tempest', 'Ramp-up suppressor', ['ramp', 'suppress'], { dmg: 55, rate: 0.07, mag: 120, reserve: 480, cost: 3000 }, { body: [0.56, 0.15, 0.07, 'bulky'], color: 'gunmetal', furn: 'tan', accent: 0xd06a18, barrel: [0.3, 0.02], shroud: 'vented', muzzle: 'flash', mag: 'drum', stock: 'fixed', optic: 'red', fore: 'vertical', extras: ['bipod'] }],
    ['anvil', 'lmg', 'Anvil HMG', 'Anvil Worldbreaker', 'Armor-breaking HMG', ['shred', 'overpen'], { dmg: 110, rate: 0.12, mag: 75, reserve: 300, pierce: 2, move: 0.75, recoil: 0.02, box: 4, cal: '.50 BMG' }, { body: [0.62, 0.17, 0.08, 'bulky'], color: 'black', accent: 0x8a2424, barrel: [0.38, 0.026], shroud: 'fins', muzzle: 'brake', mag: 'belt', stock: 'heavy', optic: 'holo', fore: 'handle' }],
    ['pulsecannon', 'lmg', 'Pulse Cannon', 'Pulse Annihilator', 'Arcing pulse LMG', ['overpen', 'shock'], { dmg: 80, rate: 0.085, mag: 90, reserve: 360, pierce: 3, tracer: 0xff60ff, flash: 0xff60ff, snd: 'plasma', box: 4, cal: 'CELL' }, { body: [0.6, 0.16, 0.075, 'energy'], color: 'purple', glow: 0xff60ff, barrel: [0.32, 0.024], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'heavy', optic: 'energy', extras: ['coils', 'screen'] }],
    // ---------- shotguns ----------
    ['riot8', 'shotgun', 'Riot-8 Auto', 'Riot Suppressor', 'Auto shotgun', ['closeq', 'extended'], { auto: true, rate: 0.22, dmg: 34, mag: 8, reserve: 64, cost: 1500 }, { body: [0.44, 0.13, 0.06, 'bulky'], color: 'black', accent: 0xc89a20, barrel: [0.3, 0.024], shroud: 'vented', muzzle: 'brake', stock: 'fixed', optic: 'holo', fore: 'vertical' }],
    ['grim', 'shotgun', 'Grim Double-Barrel', 'Grim Reaper', 'Double-barrel finisher', ['stagger', 'lastround'], { pellets: 12, dmg: 50, rate: 0.25, mag: 2, reserve: 40, reload: 1.6, recoil: 0.1, cost: 1000, cal: '10 GA' }, { body: [0.3, 0.1, 0.06], color: 'chrome', accent: 0x4a3020, barrel: [0.46, 0.024], shroud: 'twin', stock: 'wood', mag: 'none', stripe: false, gripMat: 'wood' }],
    ['slughammer', 'shotgun', 'Slug Hammer', 'Slug Colossus', 'Piercing slug gun', ['overpen', 'giantslayer'], { pellets: 1, dmg: 420, pierce: 3, rate: 0.8, mag: 5, reserve: 40, spread: 0.01, ads: 0.001, falloff: false, cost: 1800 }, { body: [0.46, 0.13, 0.062], color: 'gunmetal', accent: 0xd06a18, barrel: [0.4, 0.026], shroud: 'heavy', muzzle: 'brake', mag: 'tube', noPump: true, stock: 'heavy', optic: 'scope', lens: 0xffa040 }],
    ['dragonpump', 'shotgun', 'Dragon Pump', "Dragon's Maw", "Dragon's-breath pump", ['incendiary'], { dmg: 38, tracer: 0xff7020, box: 5, burn: true }, { body: [0.4, 0.12, 0.058], color: 'red', accent: 0xffc020, barrel: [0.42, 0.024], shroud: 'fins', muzzle: 'bell', mag: 'tube', stock: 'fixed', fore: 'none' }],
    ['flechette', 'shotgun', 'Flechette Cannon', 'Flechette Storm', 'Marking flechettes', ['overpen', 'marker'], { pellets: 10, dmg: 40, pierce: 3, rate: 0.6, mag: 8, reserve: 64, tracer: 0xc0e0ff, box: 5 }, { body: [0.46, 0.12, 0.06, 'energy'], color: 'white', glow: 0x60c0ff, barrel: [0.34, 0.022], shroud: 'rails', muzzle: 'energy', mag: 'drum', stock: 'skeleton', optic: 'red' }],
    ['stormdrum', 'shotgun', 'Storm Drum', 'Storm Thunderdrum', 'Knockback drum shotgun', ['extended', 'knockback'], { auto: true, rate: 0.18, pellets: 7, dmg: 32, mag: 20, reserve: 100, box: 5 }, { body: [0.46, 0.14, 0.066, 'bulky'], color: 'olive', accent: 0xd06a18, barrel: [0.26, 0.024], shroud: 'vented', muzzle: 'brake', mag: 'drum', stock: 'heavy', optic: 'holo', fore: 'vertical' }],
    // ---------- marksman & sniper ----------
    ['ranger', 'dmr', 'Ranger DMR', 'Ranger Pathfinder', 'Headhunter DMR', ['headhunter', 'marksman'], { dmg: 150, rate: 0.22, mag: 15, reserve: 120, cost: 1800 }, { body: [0.54, 0.12, 0.058], color: 'tan', accent: 0x222222, barrel: [0.34, 0.017], shroud: 'rails', muzzle: 'brake', stock: 'fixed', optic: 'scope', lens: 0x40a0ff }],
    ['longbow', 'dmr', 'Longbow Battle Rifle', 'Longbow Warbow', 'Staggering battle rifle', ['stagger', 'marksman'], { dmg: 120, rate: 0.16, mag: 20, reserve: 160, cost: 1600 }, { body: [0.56, 0.13, 0.06], color: 'green', accent: 0xc89a20, barrel: [0.36, 0.018], shroud: 'vented', muzzle: 'flash', stock: 'wood', optic: 'holo', extras: ['bipod'] }],
    ['wraith', 'sniper', 'Wraith Sniper', 'Wraith Phantom', 'Bounty sniper', ['headhunter', 'bounty'], { dmg: 900, rate: 1.2, mag: 5, reserve: 35, pierce: 6, box: 4 }, { body: [0.54, 0.12, 0.058], color: 'black', accent: 0x60c0ff, barrel: [0.5, 0.018], muzzle: 'suppressor', stock: 'skeleton', optic: 'long', lens: 0x40ff90, extras: ['bipod'] }],
    ['gaussneedle', 'sniper', 'Gauss Needle', 'Gauss Lancet', 'Executing gauss piercer', ['overpen', 'executioner'], { dmg: 600, rate: 0.6, mag: 8, reserve: 56, pierce: 12, beam: 0x60c8ff, box: 4, cal: 'FERRO' }, { body: [0.6, 0.12, 0.06, 'energy'], color: 'white', glow: 0x60c8ff, barrel: [0.5, 0.016], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'long', lens: 0x60c8ff }],
    ['hunterbow', 'launcher', 'Hunter Crossbow', 'Hunter Longbolt', 'Explosive bolts', ['explosive', 'stagger'], { dmg: 750, rate: 0.9, mag: 1, reserve: 30, reload: 0.9, snd: 'crossbow', proj: { speed: 70, grav: 3, r: 3, color: 0xffa040, size: 0.12 }, box: 5, cal: 'BOLT' }, { body: [0.4, 0.1, 0.05], color: 'tan', accent: 0x3a2a1a, barrel: [0.3, 0.012], optic: 'scope', lens: 0xff8040, stock: 'fixed', mag: 'none', extras: ['limbs'] }],
    ['obsidian', 'sniper', 'Obsidian AMR', 'Obsidian Eclipse', 'Anti-materiel rifle', ['giantslayer', 'shred'], { dmg: 2200, rate: 1.6, mag: 4, reserve: 28, pierce: 10, recoil: 0.15, box: 2, cal: '14.5mm' }, { body: [0.66, 0.15, 0.07, 'bulky'], color: 'black', accent: 0x8a2424, barrel: [0.6, 0.028], shroud: 'heavy', muzzle: 'brake', stock: 'heavy', optic: 'long', lens: 0xff3030, extras: ['bipod'] }],
    ['stalker', 'dmr', 'Stalker Semi-Sniper', 'Stalker Nightfall', 'Self-feeding semi-sniper', ['marksman', 'scavenger'], { dmg: 300, rate: 0.35, mag: 10, reserve: 80, pierce: 2, scope: true, adsZoom: 0.35, box: 4 }, { body: [0.5, 0.12, 0.056], color: 'gunmetal', accent: 0x2fb8b8, barrel: [0.4, 0.017], muzzle: 'suppressor', stock: 'skeleton', optic: 'scope', lens: 0x40ffd0 }],
    // ---------- launchers ----------
    ['sledge', 'launcher', 'Sledge RPG', 'Sledge Doomsayer', 'Big-blast rocket', ['explosive'], { dmg: 1400, rate: 1, mag: 1, reserve: 12, reload: 2.4, snd: 'rocket', proj: { speed: 38, grav: 0, r: 6, color: 0xffa040, size: 0.2, rocket: true }, box: 4, cal: '84mm' }, { body: [0.3, 0.14, 0.08, 'round'], color: 'olive', accent: 0xffc020, barrel: [0.5, 0.05], muzzle: 'warhead', mag: 'none', optic: 'holo', fore: 'vertical', stock: 'wire' }],
    ['hydra', 'launcher', 'Hydra Swarm', 'Hydra Legion', 'Homing rocket swarm', ['homing', 'explosive'], { dmg: 380, rate: 0.9, mag: 3, reserve: 18, snd: 'rocket', proj: { speed: 28, grav: 0, r: 3.2, color: 0xff8040, size: 0.14, rocket: true, homing: true, pellets: 4, spread: 0.12 }, box: 4, cal: '40mm' }, { body: [0.44, 0.16, 0.12, 'bulky'], color: 'gunmetal', accent: 0xd06a18, barrel: [0.12, 0.03], shroud: 'multi', mag: 'none', optic: 'energy', glow: 0xff4040, fore: 'handle', stock: 'fixed' }],
    ['thumper', 'launcher', 'Thumper GL', 'Thumper Quake', 'Quick impact grenades', ['explosive', 'quickdraw'], { dmg: 1100, rate: 0.8, mag: 1, reserve: 20, reload: 1.5, proj: { speed: 34, grav: 12, r: 5.5, color: 0xffb040, size: 0.2, grenade: true }, box: 5 }, { body: [0.34, 0.12, 0.07], color: 'tan', accent: 0x3a5a2a, barrel: [0.3, 0.045], mag: 'none', stock: 'fixed', fore: 'vertical' }],
    ['cryomortar', 'launcher', 'Cryo Mortar', 'Cryo Glacier', 'Area freeze mortar', ['cryo', 'explosive'], { dmg: 400, rate: 0.9, mag: 3, reserve: 18, snd: 'cryo', proj: { speed: 26, grav: 14, r: 5, color: 0xa8f0ff, size: 0.22, freezeImpact: true }, box: 4 }, { body: [0.36, 0.14, 0.08, 'energy'], color: 'white', glow: 0x80e8ff, barrel: [0.28, 0.05], shroud: 'coil', muzzle: 'energy', mag: 'canister', stock: 'fixed', optic: 'red', extras: ['tank'] }],
    ['sawlauncher', 'launcher', 'Ripsaw Launcher', 'Ripsaw Reaper', 'Ricochet saw blades', ['ricochet'], { dmg: 260, rate: 0.6, mag: 6, reserve: 48, snd: 'saw', proj: { speed: 30, grav: 0, r: 0, color: 0xd0d4d8, size: 0.1, saw: true }, box: 4, cal: 'SAW' }, { body: [0.42, 0.14, 0.09, 'bulky'], color: 'yellow', accent: 0x151515, barrel: [0.14, 0.08], mag: 'drum', stock: 'fixed', optic: 'holo', fore: 'vertical', extras: ['blade'] }],
    // ---------- energy ----------
    ['laserlance', 'energy', 'Laser Lance', 'Laser Sunlance', 'Burning continuous beam', ['beam', 'incendiary'], { mode: 'beam', dmg: 22, rate: 0.04, mag: 100, reserve: 500, pierce: 3, range: 70, beam: 0xff3030, box: 5, burn: true, upg: { beam: 0xffb030 } }, { body: [0.5, 0.12, 0.06, 'energy'], color: 'black', glow: 0xff3030, barrel: [0.3, 0.018], shroud: 'fins', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'energy', extras: ['wires'] }],
    ['photon', 'energy', 'Photon Carbine', 'Photon Flare', 'Hip-fire light carbine', ['overpen', 'hipfire'], { dmg: 48, rate: 0.07, mag: 36, reserve: 252, pierce: 2, tracer: 0xffe060, flash: 0xffe060, box: 5 }, { body: [0.44, 0.11, 0.055, 'energy'], color: 'yellow', glow: 0xffe060, barrel: [0.2, 0.015], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'skeleton', optic: 'red' }],
    ['teslacoil', 'energy', 'Tesla Coil Gun', 'Tesla Stormcaller', 'Chain storm', ['arcchain', 'suppress'], { mode: 'arc', dmg: 300, chains: 6, rate: 0.45, mag: 12, reserve: 96, snd: 'arc', flash: 0x9fc8ff, box: 4, upg: { chains: 10 } }, { body: [0.46, 0.15, 0.07, 'energy'], color: 'gunmetal', glow: 0x9fc8ff, barrel: [0.16, 0.02], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'heavy', optic: 'energy', extras: ['coils', 'orb'] }],
    ['plasmashotgun', 'energy', 'Plasma Shotgun', 'Plasma Maelstrom', 'Plasma spread', ['explosive', 'closeq'], { mode: 'proj', auto: false, dmg: 140, rate: 0.6, mag: 8, reserve: 56, flash: 0xff40d0, proj: { speed: 50, grav: 0, r: 1.4, color: 0xff40d0, size: 0.2, pellets: 5, spread: 0.07 }, box: 4 }, { body: [0.44, 0.14, 0.07, 'energy'], color: 'purple', glow: 0xff40d0, barrel: [0.26, 0.03], shroud: 'vented', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'holo' }],
    ['novablaster', 'energy', 'Nova Blaster', 'Nova Supernova', 'Slow nova orb', ['explosive', 'knockback'], { mode: 'proj', auto: false, dmg: 900, rate: 0.8, mag: 6, reserve: 42, snd: 'void', flash: 0xc8e8ff, proj: { speed: 20, grav: 0, r: 5, color: 0xc8e8ff, size: 0.5 }, box: 4 }, { body: [0.4, 0.16, 0.08, 'round'], color: 'white', glow: 0x80c0ff, barrel: [0.18, 0.04], shroud: 'coil', muzzle: 'bell', mag: 'cell', stock: 'fixed', optic: 'energy', extras: ['orb'] }],
    ['frostbite', 'special', 'Frostbite Sprayer', 'Frostbite Absolute', 'Cryo sprayer', ['cryo', 'suppress'], { kind: 'cryo', dmg: 14, range: 8, snd: 'cryo', box: 5 }, { body: [0.46, 0.13, 0.065], color: 'white', accent: 0x60c0ff, glow: 0x80e8ff, barrel: [0.22, 0.03], shroud: 'fins', muzzle: 'bell', mag: 'canister', stock: 'fixed', extras: ['tank'] }],
    ['scorcher', 'special', 'Scorcher', 'Scorcher Infernus', 'Long-reach flamer', ['incendiary', 'extended'], { dmg: 34, range: 11, cone: 0.26, box: 5 }, { body: [0.5, 0.13, 0.065, 'bulky'], color: 'red', accent: 0x151515, glow: 0xff6020, barrel: [0.28, 0.03], shroud: 'vented', muzzle: 'bell', mag: 'canister', stock: 'heavy', extras: ['tank', 'pilot'] }],
    ['acidhose', 'special', 'Acid Hose', 'Acid Deluge', 'Armor-melting acid', ['marker', 'shred'], { kind: 'acid', dmg: 30, range: 9, box: 5 }, { body: [0.44, 0.13, 0.065, 'organic'], color: 'green', glow: 0x9dff3a, barrel: [0.24, 0.028], shroud: 'bone', muzzle: 'bell', mag: 'canister', stock: 'organic', extras: ['tank', 'spikes'] }],
    ['disruptor', 'special', 'Sonic Disruptor', 'Disruptor Cataclysm', 'Sonic crowd push', ['knockback', 'stagger'], { mode: 'wave', auto: false, dmg: 220, range: 12, cone: 0.45, push: 12, rate: 0.7, mag: 10, reserve: 70, reload: 2.2, snd: 'wave', flash: 0xa0c8ff, recoil: 0.06, box: 4 }, { body: [0.44, 0.15, 0.08, 'energy'], color: 'teal', glow: 0x80d0ff, barrel: [0.12, 0.05], shroud: 'fins', muzzle: 'bell', mag: 'cell', stock: 'fixed', optic: 'energy', extras: ['coils'] }],
    // ---------- wonder weapons ----------
    ['thunderclap', 'wonder', 'Thunderclap', 'Thunderclap Apocalypse', 'Wonder: shockwave cannon', ['wonder', 'knockback'], { mode: 'wave', dmg: 6000, range: 20, cone: 0.55, push: 30, rate: 1.3, mag: 2, reserve: 12, reload: 2.4, snd: 'wave', flash: 0xc8e0ff, recoil: 0.15, box: 2 }, { body: [0.5, 0.15, 0.09, 'round'], color: 'chrome', accent: 0x8a5020, glow: 0x80c0ff, barrel: [0.14, 0.05], shroud: 'fins', muzzle: 'bell', mag: 'none', stock: 'heavy', optic: 'energy', extras: ['coils', 'orb'] }],
    ['broodlauncher', 'wonder', 'Brood Launcher', 'Brood Mother', 'Wonder: turns creatures', ['wonder'], { mode: 'proj', dmg: 200, rate: 0.9, mag: 4, reserve: 20, snd: 'spit', flash: 0x70ff70, proj: { speed: 30, grav: 6, r: 0, color: 0x70ff70, size: 0.25, turnImpact: true }, box: 2 }, { body: [0.42, 0.14, 0.09, 'organic'], color: 'flesh', glow: 0x70ff70, barrel: [0.2, 0.03], shroud: 'bone', mag: 'none', stock: 'organic', optic: 'energy', extras: ['spikes', 'orb'] }],
    ['omegaray', 'wonder', 'Omega Ray', 'Omega Ray Mark II', 'Wonder: disintegrator', ['wonder', 'explosive'], { mode: 'proj', auto: false, dmg: 700, rate: 0.22, mag: 20, reserve: 160, snd: 'ray', flash: 0x60ff60, proj: { speed: 70, grav: 0, r: 2.2, color: 0x60ff60, size: 0.2 }, box: 3 }, { body: [0.3, 0.12, 0.06, 'round'], color: 'teal', glow: 0x60ff60, barrel: [0.1, 0.03], shroud: 'coil', muzzle: 'energy', mag: 'cell', pistol: true, optic: 'energy', extras: ['orb'] }],
  ];

  const serial = (id) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9000; return 1000 + h; };
  const stampFor = (id, d) => `${d.name.toUpperCase()}  ·  ${d.cal || ''}  ·  XH-${serial(id)}`;
  const register = (id, spec) => {
    const d = WP.DEFS[id];
    spec.stamp = stampFor(id, d);
    if (spec.body[3] === 'organic') d.organic = true;
    WP.BUILD[id] = (g, m) => build(g, m, specWith(id, spec));
    WP.SPECS[id] = spec;
  };
  WP.SPECS = {};
  const ORIG_CAL = { p9: '9mm', carbine: '9mm', pulse: 'CELL', breacher: '12 GA', burst: '7.62mm', rail: 'FERRO', magnum: '.60 MAG', havoc: '7.62mm', inferno: 'FUEL', arc: 'CELL', plasma: 'CELL', gl: '40mm', cryo: 'CRYO', void: '???' };
  for (const id in ORIG) {
    const [role, traits, spec] = ORIG[id], d = WP.DEFS[id];
    d.role = role; d.traits = traits; d.cal = ORIG_CAL[id];
    register(id, spec);
  }
  const define = ([id, cls, name, upName, role, traits, stats, spec]) => {
    const d = Object.assign({}, CL[cls], stats, { name, role, traits });
    d.upg = Object.assign({ name: upName, dmg: 2.6, mag: 1.5, reserve: 1.6 }, stats.upg || {});
    if (d.proj) d.proj = Object.assign({}, d.proj);
    WP.DEFS[id] = d;
    register(id, spec);
  };
  LIST.forEach(define);
  WP.ARSENAL = LIST.map((q) => q[0]);
  // more guns in the same format (map-unique weapons: stats.map names the only arena they appear in)
  WP.defineGuns = (list) => { list.forEach(define); WP.rebuildPool(); };
  WP.rebuildPool();
})();
