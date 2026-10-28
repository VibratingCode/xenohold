'use strict';
// Creature models (procedural, articulated rigs) + per-species animation.
// All models face +Z with their root at ground level.
(function () {
  const U = XH.U;
  const MON = XH.monsters = {};

  // ---------------- materials ----------------
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({
    color, roughness: o.r === undefined ? 0.4 : o.r, metalness: o.m === undefined ? 0.15 : o.m,
    emissive: o.e || 0x000000, emissiveIntensity: 1, flatShading: o.flat !== false,
    transparent: !!o.op, opacity: o.op || 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
  });
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
  const PAL = {
    carapace: std(0x3a2240, { r: 0.3, m: 0.35, e: 0x0c0314 }),
    plate: std(0x70406a, { r: 0.28, m: 0.35, e: 0x10040e }),
    flesh: std(0x8e2c48, { r: 0.55, e: 0x1e0309 }),
    bone: std(0xdcc9a2, { r: 0.45, ds: true }),
    dark: std(0x160a16, { r: 0.6 }),
    membrane: std(0x8a3464, { r: 0.5, e: 0x220012, op: 0.88, ds: true }),
    acid: std(0x8ae83a, { r: 0.15, e: 0x3f8a10, op: 0.82, flat: false }),
    sac: std(0xd87838, { r: 0.25, e: 0x6a1e08, op: 0.8, flat: false }),
    gut: std(0x2a5a10, { r: 0.4, e: 0x0a2004 }),
    eyeY: basic(0xffc830), eyeO: basic(0xff7a20), eyeR: basic(0xff3020), eyeG: basic(0xc0ff40), eyeP: basic(0xd850ff),
    core: basic(0xd8ff70), glowO: basic(0xffa838), egg: basic(0xffd070), vein: basic(0xb830ff),
  };
  for (const k of ['carapace', 'plate', 'flesh', 'membrane', 'acid', 'sac']) PAL[k].userData.skin = true;
  MON.PAL = PAL;

  // ---------------- geometry cache ----------------
  const GC = {};
  const keep = (g) => { g.userData.keep = true; return g; };
  const gc = (k, fn) => GC[k] || (GC[k] = keep(fn()));
  const sph = (w = 10, h = 8) => gc('s' + w + '_' + h, () => new THREE.SphereGeometry(1, w, h));
  const shell = (tl) => gc('sh' + tl, () => new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, tl));
  const seg = (len, r0, r1, rad = 6) => gc(`seg${len}_${r0}_${r1}_${rad}`, () => { const g = new THREE.CylinderGeometry(r0, r1, len, rad); g.translate(0, -len / 2, 0); return g; });
  const spike = (len, r, rad = 5) => gc(`sp${len}_${r}_${rad}`, () => { const g = new THREE.ConeGeometry(r, len, rad); g.translate(0, len / 2, 0); return g; });
  const fspike = (len, r, rad = 5) => gc(`fsp${len}_${r}_${rad}`, () => { const g = new THREE.ConeGeometry(r, len, rad); g.translate(0, len / 2, 0); g.rotateX(Math.PI / 2); return g; });
  const torus = (r, t) => gc(`to${r}_${t}`, () => new THREE.TorusGeometry(r, t, 5, 14));
  const blade = (len, w, th) => gc(`bl${len}_${w}_${th}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(w * 1.25, len * 0.22, w * 1.15, len * 0.72, 0, len);
    s.bezierCurveTo(w * 0.42, len * 0.68, w * 0.5, len * 0.3, 0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, -th / 2); return g;
  });
  const wing = (span, chord) => gc(`wg${span}_${chord}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.05 * chord); s.lineTo(span * 0.3, chord * 0.38); s.lineTo(span * 0.64, chord * 0.5); s.lineTo(span, chord * 0.18);
    s.quadraticCurveTo(span * 0.86, -chord * 0.1, span * 0.8, -chord * 0.42);
    s.quadraticCurveTo(span * 0.7, -chord * 0.22, span * 0.6, -chord * 0.55);
    s.quadraticCurveTo(span * 0.46, -chord * 0.3, span * 0.34, -chord * 0.62);
    s.quadraticCurveTo(span * 0.2, -chord * 0.3, 0, -chord * 0.32);
    s.lineTo(0, 0.05 * chord);
    return new THREE.ShapeGeometry(s, 6);
  });

  // ---------------- build helpers ----------------
  function P(parent, geo, mat, pos, rot, scl) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scl !== undefined) { if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(scl[0], scl[1], scl[2]); }
    parent.add(m); return m;
  }
  function J(parent, name, pos, rot) {
    const g = new THREE.Group(); g.name = name;
    if (pos) g.position.set(pos[0], pos[1], pos[2]);
    if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(g); return g;
  }
  // limb chain: segs = [{len, r0, r1, mat, rot:[x,y,z]}], returns array of joints; each joint's child is placed at the previous segment's end
  function limb(parent, name, pos, segs) {
    const js = []; let p = parent, at = pos;
    segs.forEach((s, i) => {
      const j = J(p, name + i, at, s.rot || [0, 0, 0]);
      P(j, seg(s.len, s.r0, s.r1, s.rad || 6), s.mat);
      if (s.tip) P(j, spike(s.tip, s.r1 * 1.4), PAL.bone, [0, -s.len, 0], [Math.PI, 0, 0]);
      js.push(j); p = j; at = [0, -s.len, 0];
    });
    return js;
  }
  // Merge static meshes sharing a material under each node to reduce draw calls
  function optimize(root) {
    const nodes = [];
    root.traverse((o) => { if (!o.isMesh) nodes.push(o); });
    for (const node of nodes) {
      const byMat = new Map();
      for (const c of node.children) if (c.isMesh && !c.name) { if (!byMat.has(c.material)) byMat.set(c.material, []); byMat.get(c.material).push(c); }
      for (const [mat, list] of byMat) {
        if (list.length < 2) continue;
        const items = list.map((m) => { m.updateMatrix(); return { g: m.geometry, m: m.matrix.clone() }; });
        const merged = keep(U.merge(items));
        list.forEach((m) => node.remove(m));
        node.add(new THREE.Mesh(merged, mat));
      }
    }
  }

  // =====================================================================
  //  SKITTERLING — fast pack hunter (zergling-like). Scythe forelimbs,
  //  twin carapace wing-blades, snapping mandibles.
  // =====================================================================
  function buildSkitterling() {
    const root = new THREE.Group();
    const body = J(root, 'body', [0, 0.62, 0]);
    P(body, sph(), PAL.carapace, [0, 0, 0], null, [0.34, 0.3, 0.62]);
    P(body, sph(), PAL.flesh, [0, -0.09, 0.03], null, [0.27, 0.21, 0.52]);
    for (let k = 0; k < 4; k++) P(body, sph(), PAL.plate, [0, 0.21 - k * 0.015, 0.36 - k * 0.24], [-0.25, 0, 0], [0.29 - k * 0.03, 0.11, 0.2]);
    for (let k = 0; k < 4; k++) P(body, spike(0.22 - k * 0.03, 0.035), PAL.bone, [0, 0.28, 0.3 - k * 0.24], [-1.1, 0, 0]);
    // twin wing-blades on the shoulders
    for (const sx of [-1, 1]) {
      const wj = J(body, 'wing' + (sx < 0 ? 'L' : 'R'), [0.13 * sx, 0.2, 0.18], [-1.0, 0, 0.42 * sx]);
      P(wj, blade(0.95, 0.22, 0.03), PAL.plate, [0, 0, 0], [0, sx < 0 ? Math.PI : 0, 0]);
      const wj2 = J(body, 'wing2' + (sx < 0 ? 'L' : 'R'), [0.16 * sx, 0.18, -0.05], [-1.3, 0, 0.62 * sx]);
      P(wj2, blade(0.7, 0.17, 0.03), PAL.carapace, [0, 0, 0], [0, sx < 0 ? Math.PI : 0, 0]);
    }
    // head
    const head = J(body, 'head', [0, 0.04, 0.56]);
    P(head, fspike(0.55, 0.17, 6), PAL.carapace, [0, 0, -0.05]);
    P(head, sph(), PAL.flesh, [0, -0.08, 0.1], null, [0.13, 0.08, 0.2]);
    P(head, spike(0.3, 0.04), PAL.bone, [0, 0.1, 0.05], [-1.9, 0, 0]);
    for (const sx of [-1, 1]) {
      P(head, spike(0.24, 0.035), PAL.bone, [0.09 * sx, 0.08, 0.02], [-1.85, 0, 0.35 * sx]);
      P(head, sph(6, 4), PAL.eyeY, [0.1 * sx, 0.04, 0.2], null, 0.042);
      P(head, sph(6, 4), PAL.eyeY, [0.085 * sx, 0.07, 0.13], null, 0.028);
      const mj = J(head, 'mand' + (sx < 0 ? 'L' : 'R'), [0.08 * sx, -0.07, 0.32]);
      P(mj, fspike(0.3, 0.035, 4), PAL.bone, [0, 0, 0], [0.2, -0.45 * sx, 0]);
    }
    // tail
    const t0 = J(body, 'tail0', [0, 0.05, -0.58], [0.25, 0, 0]);
    P(t0, fspike(0.35, 0.1, 6), PAL.carapace, [0, 0, 0], [0, Math.PI, 0]);
    const t1 = J(t0, 'tail1', [0, 0, -0.3], [0.3, 0, 0]);
    P(t1, fspike(0.3, 0.05, 5), PAL.bone, [0, 0, 0], [0, Math.PI, 0]);
    // legs: scythe forelimbs + digitigrade hind legs
    for (const sx of [-1, 1]) {
      const S = sx < 0 ? 'L' : 'R';
      limb(body, 'f' + S, [0.21 * sx, -0.06, 0.33], [
        { len: 0.34, r0: 0.07, r1: 0.05, mat: PAL.carapace, rot: [-0.5, 0, 0.2 * sx] },
        { len: 0.4, r0: 0.05, r1: 0.012, mat: PAL.bone, rot: [0.9, 0, 0] },
      ]);
      limb(body, 'h' + S, [0.22 * sx, -0.04, -0.3], [
        { len: 0.34, r0: 0.09, r1: 0.06, mat: PAL.carapace, rot: [-0.6, 0, 0.18 * sx] },
        { len: 0.34, r0: 0.055, r1: 0.035, mat: PAL.flesh, rot: [1.2, 0, 0] },
        { len: 0.2, r0: 0.035, r1: 0.01, mat: PAL.bone, rot: [-0.6, 0, 0] },
      ]);
    }
    return root;
  }
  function animSkitterling(R, s, dt) {
    const p = s.phase, mv = s.move, t = s.t;
    const atk = s.atk >= 0 ? Math.sin(Math.PI * s.atk) : 0;
    R.body.position.y = 0.62 + Math.abs(Math.sin(p)) * 0.08 * mv + atk * 0.15 + (s.leap || 0);
    R.body.rotation.x = Math.sin(p * 2) * 0.09 * mv - atk * 0.5 - (s.leapPitch || 0);
    R.body.rotation.z = Math.sin(p) * 0.04 * mv;
    for (const S of ['L', 'R']) {
      const o = S === 'L' ? 0 : 0.35;
      R['f' + S + '0'].rotation.x = -0.5 + Math.sin(p + o) * 0.95 * mv - atk * (1.4 + Math.sin(t * 30 + o * 6) * 0.3);
      R['f' + S + '1'].rotation.x = 0.9 + Math.max(0, Math.cos(p + o)) * 0.8 * mv - atk * 1.2;
      R['h' + S + '0'].rotation.x = -0.6 + Math.sin(p + Math.PI + o) * 0.85 * mv + atk * 0.4;
      R['h' + S + '1'].rotation.x = 1.2 + Math.max(0, -Math.cos(p + Math.PI + o)) * 0.6 * mv;
      R['mand' + S].rotation.y = (S === 'L' ? 1 : -1) * (0.15 + Math.max(0, Math.sin(t * 22)) * 0.25 + atk * 0.5);
      R['wing' + S].rotation.z = (S === 'L' ? 1 : -1) * (0.42 + Math.sin(t * 7) * 0.06 + atk * 0.3);
    }
    R.head.rotation.x = Math.sin(p * 2) * 0.1 * mv + atk * 0.4;
    R.head.rotation.y = Math.sin(t * 1.3) * 0.15 * (1 - mv);
    R.tail0.rotation.y = Math.sin(p * 0.5 + t) * 0.3;
    R.tail1.rotation.y = Math.sin(p * 0.5 + t - 0.8) * 0.4;
  }

  // =====================================================================
  //  LANCER — serpentine spine-thrower (hydralisk-like). Flaring cowl,
  //  bone scythe arms, launches volleys of needle spines.
  // =====================================================================
  function buildLancer() {
    const root = new THREE.Group();
    // tail chain along the ground
    let tp = J(root, 'tl0', [0, 0.36, -0.25]);
    for (let i = 0; i < 6; i++) {
      const r = 0.36 - i * 0.045;
      P(tp, sph(), PAL.carapace, [0, 0, -0.2], null, [r, r * 0.85, r * 1.35]);
      P(tp, sph(), PAL.plate, [0, r * 0.45, -0.2], [-0.2, 0, 0], [r * 0.85, r * 0.4, r * 1.1]);
      if (i < 5) P(tp, spike(0.18, 0.04), PAL.bone, [0, r * 0.75, -0.15], [-0.9, 0, 0]);
      if (i < 5) tp = J(tp, 'tl' + (i + 1), [0, -0.02 * i, -0.4]);
    }
    const torso = J(root, 'torso', [0, 0.4, 0]);
    P(torso, sph(), PAL.carapace, [0, 0.3, 0], null, [0.38, 0.4, 0.4]);
    P(torso, sph(), PAL.flesh, [0, 0.3, 0.12], null, [0.3, 0.35, 0.32]);
    const chest = J(torso, 'chest', [0, 0.72, 0.08]);
    P(chest, sph(), PAL.carapace, [0, 0.2, 0], null, [0.42, 0.5, 0.4]);
    P(chest, sph(), PAL.flesh, [0, 0.12, 0.14], null, [0.3, 0.42, 0.3]);
    for (let k = 0; k < 4; k++) P(chest, torus(0.27 - k * 0.02, 0.035), PAL.flesh, [0, -0.1 + k * 0.14, 0.17], [Math.PI / 2 - 0.2, 0, 0], [1, 0.7, 1]);
    for (let k = 0; k < 3; k++) P(chest, sph(), PAL.plate, [0, 0.45 - k * 0.2, -0.2], [0.3, 0, 0], [0.36, 0.14, 0.26]);
    for (let k = 0; k < 4; k++) P(chest, spike(0.35, 0.05), PAL.bone, [0, 0.5 - k * 0.2, -0.3], [-2.2, 0, 0]);
    // spine launchers on the chest
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) P(chest, spike(0.14, 0.03), PAL.bone, [0.12 * sx, 0.05 + k * 0.12, 0.34], [1.3, 0, 0.2 * sx]);
    // head
    const head = J(chest, 'head', [0, 0.62, 0.18]);
    P(head, sph(), PAL.carapace, [0, 0, 0.12], null, [0.24, 0.22, 0.42]);
    P(head, fspike(0.35, 0.12, 6), PAL.carapace, [0, 0.02, 0.4]);
    const jaw = J(head, 'jaw', [0, -0.1, 0.15]);
    P(jaw, fspike(0.42, 0.1, 5), PAL.flesh, [0, 0, 0]);
    for (const sx of [-1, 1]) {
      P(jaw, fspike(0.12, 0.02, 4), PAL.bone, [0.05 * sx, 0.04, 0.2], [-0.4, 0, 0]);
      P(head, sph(6, 4), PAL.eyeO, [0.15 * sx, 0.06, 0.32], null, 0.04);
      P(head, sph(6, 4), PAL.eyeO, [0.17 * sx, 0.0, 0.22], null, 0.032);
      // cowl
      const cw = J(head, 'cowl' + (sx < 0 ? 'L' : 'R'), [0.16 * sx, 0.05, -0.02], [0, -0.35 * sx, -0.45 * sx]);
      P(cw, blade(1.05, 0.42, 0.04), PAL.plate, [0, -0.1, 0], [0, sx < 0 ? Math.PI : 0, 0]);
      for (let k = 0; k < 5; k++) P(cw, spike(0.18, 0.03), PAL.bone, [(-0.34 + Math.abs(k - 2) * 0.05) * sx * -1, k * 0.2, 0], [0, 0, -0.9 * sx]);
    }
    // scythe arms
    for (const sx of [-1, 1]) {
      const S = sx < 0 ? 'L' : 'R';
      const sh = J(chest, 'sh' + S, [0.38 * sx, 0.3, 0.1], [-0.6, 0, 0.45 * sx]);
      P(sh, sph(), PAL.plate, [0, 0, 0], null, 0.14);
      P(sh, seg(0.5, 0.09, 0.07), PAL.carapace);
      const el = J(sh, 'el' + S, [0, -0.5, 0], [-1.3, 0, 0]);
      P(el, seg(0.3, 0.07, 0.05), PAL.flesh);
      P(el, blade(1.1, 0.3, 0.04), PAL.bone, [0, -0.25, 0], [Math.PI, Math.PI / 2, 0]);
    }
    return root;
  }
  function animLancer(R, s) {
    const t = s.t, mv = s.move;
    for (let i = 0; i < 6; i++) { const j = R['tl' + i]; if (!j) continue; j.rotation.y = Math.sin(t * (3 + mv * 4) - i * 0.9) * (0.18 + mv * 0.22); j.rotation.x = i === 0 ? -0.05 : 0.04; }
    const cast = s.cast >= 0 ? s.cast : -1;
    let rear = 0, flare = 0;
    if (cast >= 0) { rear = cast < 0.65 ? U.smooth(cast / 0.65) : 1 - U.smooth((cast - 0.65) / 0.35) * 1.6; flare = Math.sin(Math.PI * Math.min(1, cast * 1.2)); }
    R.torso.rotation.x = 0.12 * mv - rear * 0.35 + Math.sin(t * 1.4) * 0.03;
    R.torso.rotation.z = Math.sin(t * 1.1) * 0.06;
    R.chest.rotation.x = -rear * 0.2 + Math.sin(t * 1.4 + 1) * 0.04;
    R.head.rotation.x = rear * 0.25 + Math.sin(t * 2) * 0.05;
    R.jaw.rotation.x = 0.1 + flare * 0.5 + (s.hiss || 0) * 0.4;
    R.cowlL.rotation.z = 0.45 + flare * 0.55 + Math.sin(t * 3) * 0.03; R.cowlR.rotation.z = -0.45 - flare * 0.55 - Math.sin(t * 3) * 0.03;
    R.cowlL.rotation.y = 0.35 + flare * 0.3; R.cowlR.rotation.y = -0.35 - flare * 0.3;
    const atk = s.atk >= 0 ? s.atk : -1;
    for (const S of ['L', 'R']) {
      const sx = S === 'L' ? -1 : 1, off = S === 'L' ? 0 : 0.5;
      let shx = -0.6 + Math.sin(t * 2 + off) * 0.1, elx = -1.3 + Math.sin(t * 2.4 + off) * 0.1;
      if (atk >= 0) { const a = U.clamp(atk * 1.4 - (S === 'R' ? 0.3 : 0), 0, 1); shx = -0.6 - Math.sin(a * Math.PI) * 1.4 + a * 0.9; elx = -1.3 + Math.sin(a * Math.PI) * 1.0; }
      R['sh' + S].rotation.x = shx; R['el' + S].rotation.x = elx; R['sh' + S].rotation.z = 0.45 * sx;
    }
  }

  // =====================================================================
  //  BURSTER — living acid bomb (baneling-like). Rolls toward prey and
  //  ruptures in a caustic blast that also melts nearby swarm.
  // =====================================================================
  function buildBurster() {
    const root = new THREE.Group();
    const body = J(root, 'body', [0, 0.62, 0]);
    const roll = J(body, 'roll', [0, 0, -0.05]);
    P(roll, sph(18, 14), PAL.acid, [0, 0, 0], null, [0.62, 0.58, 0.64]);
    P(roll, sph(10, 8), PAL.core, [0, 0, 0], null, 0.34);
    for (let k = 0; k < 3; k++) P(roll, torus(0.61, 0.025), PAL.gut, [0, 0, 0], [k * 1.05, k * 0.7, 0], [1, 1, 1]);
    for (let k = 0; k < 6; k++) P(roll, sph(6, 4), PAL.gut, [Math.cos(k) * 0.3, Math.sin(k * 2) * 0.2, Math.sin(k) * 0.3], null, 0.08);
    // carapace cap and head plate
    P(body, shell(1.15), PAL.carapace, [0, 0.02, -0.04], [-0.35, 0, 0], [0.66, 0.66, 0.68]);
    for (let k = 0; k < 3; k++) P(body, spike(0.24, 0.05), PAL.bone, [(k - 1) * 0.2, 0.55, -0.22], [-0.7, 0, (k - 1) * 0.3]);
    const head = J(body, 'head', [0, -0.12, 0.5]);
    P(head, sph(), PAL.plate, [0, 0.05, 0], null, [0.3, 0.2, 0.18]);
    for (const sx of [-1, 1]) {
      P(head, sph(6, 4), PAL.eyeG, [0.13 * sx, 0.1, 0.13], null, 0.04);
      P(head, fspike(0.16, 0.03, 4), PAL.bone, [0.07 * sx, -0.06, 0.12], [0.3, -0.3 * sx, 0]);
    }
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1, z = i < 2 ? 0.3 : 0.05;
      limb(body, 'leg' + i, [0.3 * sx, -0.35, z], [{ len: 0.28, r0: 0.05, r1: 0.02, mat: PAL.carapace, rot: [0, 0, 0.6 * sx], tip: 0.08 }]);
    }
    return root;
  }
  function animBurster(R, s, dt) {
    R.roll.rotation.x += (s.rollSpeed || 0) * dt;
    const fuse = s.fuse || 0, pulse = 1 + Math.sin(s.t * (6 + fuse * 20)) * (0.04 + fuse * 0.08);
    R.roll.scale.set(pulse, pulse * (1 - fuse * 0.1), pulse);
    R.body.position.y = 0.62 + Math.abs(Math.sin(s.phase)) * 0.05 * s.move;
    R.body.rotation.z = Math.sin(s.phase) * 0.12 * s.move;
    for (let i = 0; i < 4; i++) R['leg' + i + '0'].rotation.x = Math.sin(s.phase * 2 + i * 1.6) * 0.8 * s.move;
  }

  // =====================================================================
  //  SHRIEKER — winged glaive-spitter (mutalisk-like). Sinuous flier,
  //  harasses from above with bouncing glaive bolts.
  // =====================================================================
  function buildShrieker() {
    const root = new THREE.Group();
    const body = J(root, 'body', [0, 0, 0]);
    P(body, sph(), PAL.carapace, [0, 0, 0.05], null, [0.32, 0.28, 0.55]);
    P(body, sph(), PAL.flesh, [0, -0.1, 0.05], null, [0.26, 0.2, 0.46]);
    for (let k = 0; k < 3; k++) P(body, sph(), PAL.plate, [0, 0.2, 0.32 - k * 0.25], [-0.2, 0, 0], [0.26, 0.1, 0.18]);
    const head = J(body, 'head', [0, 0.02, 0.55]);
    P(head, sph(), PAL.carapace, [0, 0, 0.12], null, [0.26, 0.24, 0.32]);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; P(head, fspike(0.35, 0.05, 4), PAL.flesh, [Math.cos(a) * 0.1, Math.sin(a) * 0.1 - 0.05, 0.36], [Math.sin(a) * 0.4, -Math.cos(a) * 0.4, 0]); }
    for (const sx of [-1, 1]) { P(head, sph(6, 4), PAL.eyeG, [0.16 * sx, 0.08, 0.28], null, 0.045); P(head, spike(0.3, 0.04), PAL.bone, [0.1 * sx, 0.18, 0.05], [-2, 0, 0.3 * sx]); }
    let tp = J(body, 'tl0', [0, 0.02, -0.45]);
    for (let i = 0; i < 6; i++) {
      const r = 0.24 - i * 0.03;
      P(tp, sph(), i % 2 ? PAL.plate : PAL.carapace, [0, 0, -0.16], null, [r, r * 0.9, r * 1.3]);
      if (i < 5) tp = J(tp, 'tl' + (i + 1), [0, 0, -0.32]);
    }
    for (let k = 0; k < 3; k++) P(tp, fspike(0.5, 0.06, 4), PAL.bone, [0, 0, -0.2], [0, Math.PI + (k - 1) * 0.5, 0]);
    for (const sx of [-1, 1]) {
      const S = sx < 0 ? 'L' : 'R';
      const wj = J(body, 'wing' + S, [0.22 * sx, 0.12, 0.12]);
      const m = P(wj, wing(2.1, 1.1), PAL.membrane, [0, 0, 0.1], [Math.PI / 2, 0, 0], [sx, 1, 1]);
      m.name = '';
      P(wj, seg(2.1, 0.06, 0.02), PAL.carapace, [0, 0, 0.12], [0, 0, Math.PI / 2 * sx]);
      P(wj, seg(1.0, 0.035, 0.012), PAL.bone, [0.9 * sx, 0, 0.45], [Math.PI / 2, 0, 0.45 * sx]);
      P(wj, seg(0.9, 0.03, 0.01), PAL.bone, [1.45 * sx, 0, 0.55], [Math.PI / 2, 0, 0.2 * sx]);
      P(wj, spike(0.3, 0.04), PAL.bone, [2.05 * sx, 0, 0.12], [0, 0, -Math.PI / 2 * sx]);
    }
    return root;
  }
  function animShrieker(R, s) {
    const t = s.t, f = Math.sin(t * 8.5 + s.seed);
    R.wingL.rotation.z = 0.15 + f * 0.75; R.wingR.rotation.z = -0.15 - f * 0.75;
    R.wingL.rotation.y = f * 0.12; R.wingR.rotation.y = -f * 0.12;
    R.body.position.y = -f * 0.1;
    R.body.rotation.x = Math.cos(t * 8.5 + s.seed) * 0.05 - (s.cast >= 0 ? Math.sin(Math.PI * s.cast) * 0.4 : 0);
    for (let i = 0; i < 6; i++) { const j = R['tl' + i]; if (!j) continue; j.rotation.x = Math.sin(t * 3 - i * 0.7) * 0.18 + 0.06; j.rotation.y = Math.sin(t * 2 - i * 0.9) * 0.2; }
    R.head.rotation.x = s.cast >= 0 ? Math.sin(Math.PI * s.cast) * 0.5 : Math.sin(t * 2) * 0.1;
  }

  // =====================================================================
  //  BEHEMOTH — armored siege beast (ultralisk-like). Colossal kaiser
  //  blades, frontal plating, glowing dorsal nerve-sac weak point.
  // =====================================================================
  function buildBehemoth() {
    const root = new THREE.Group();
    const body = J(root, 'body', [0, 2.05, 0]);
    P(body, sph(12, 10), PAL.carapace, [0, 0, 0], null, [1.25, 1.02, 1.85]);
    P(body, sph(), PAL.flesh, [0, -0.35, 0.1], null, [1.05, 0.75, 1.55]);
    for (let k = 0; k < 6; k++) {
      const z = 1.3 - k * 0.5;
      P(body, sph(), PAL.plate, [0, 0.72 - Math.abs(k - 2.5) * 0.06, z], [-0.35, 0, 0], [1.15 - Math.abs(k - 2.5) * 0.08, 0.42, 0.5]);
      for (const sx of [-1, 1]) P(body, spike(0.55, 0.1), PAL.bone, [0.45 * sx, 1.0 - Math.abs(k - 2.5) * 0.06, z - 0.1], [-0.9, 0, 0.5 * sx]);
    }
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) P(body, sph(), PAL.plate, [1.05 * sx, 0.1, 0.8 - k * 0.8], [0, 0, 0.8 * sx], [0.3, 0.55, 0.5]);
    // weak point: nerve sac on the back
    P(body, sph(12, 10), PAL.glowO, [0, 0.72, -1.5], null, [0.42, 0.32, 0.38]);
    P(body, torus(0.42, 0.06), PAL.flesh, [0, 0.72, -1.5], [Math.PI / 2, 0, 0]);
    // head with tusks
    const head = J(body, 'head', [0, -0.25, 1.75]);
    P(head, sph(), PAL.carapace, [0, 0, 0.25], null, [0.72, 0.55, 0.75]);
    P(head, sph(), PAL.plate, [0, 0.28, 0.3], [-0.3, 0, 0], [0.6, 0.25, 0.6]);
    for (const sx of [-1, 1]) {
      const tj = J(head, 'tusk' + (sx < 0 ? 'L' : 'R'), [0.38 * sx, -0.2, 0.55]);
      P(tj, fspike(1.25, 0.14, 6), PAL.bone, [0, 0, 0], [-0.35, 0.25 * sx, 0]);
      for (let k = 0; k < 2; k++) P(head, sph(6, 4), PAL.eyeO, [0.3 * sx, 0.1 - k * 0.12, 0.85], null, 0.06);
      P(head, fspike(0.5, 0.06, 4), PAL.bone, [0.18 * sx, -0.3, 0.75], [0.4, -0.3 * sx, 0]);
    }
    // kaiser blades
    for (const sx of [-1, 1]) {
      const S = sx < 0 ? 'L' : 'R';
      const bj = J(body, 'blade' + S, [0.85 * sx, 0.55, 1.05], [0.9, 0.35 * sx, 0]);
      P(bj, sph(), PAL.plate, [0, 0, 0], null, 0.38);
      P(bj, blade(3.4, 0.75, 0.14), PAL.bone, [0, 0.1, 0], [0, sx < 0 ? 0 : Math.PI, 0]);
      P(bj, blade(1.1, 0.3, 0.16), PAL.carapace, [0, 0.05, 0], [0, sx < 0 ? 0 : Math.PI, 0]);
    }
    // legs
    const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    legs.forEach(([sx, sz], i) => {
      const L = limb(body, 'leg' + i, [0.95 * sx, -0.45, 0.95 * sz], [
        { len: 0.85, r0: 0.34, r1: 0.25, mat: PAL.carapace, rot: [0.25 * sz, 0, 0.35 * sx], rad: 7 },
        { len: 0.7, r0: 0.24, r1: 0.18, mat: PAL.flesh, rot: [-0.25 * sz, 0, -0.35 * sx], rad: 7 },
      ]);
      P(L[0], sph(), PAL.plate, [0, -0.1, 0], null, [0.42, 0.5, 0.42]);
      for (let k = 0; k < 3; k++) P(L[1], spike(0.35, 0.08), PAL.bone, [(k - 1) * 0.12, -0.68, 0.08], [2.4, (k - 1) * 0.5, 0]);
    });
    return root;
  }
  function animBehemoth(R, s) {
    const p = s.phase, mv = s.move, t = s.t;
    for (let i = 0; i < 4; i++) {
      const sz = i < 2 ? 1 : -1, off = (i === 0 || i === 3) ? 0 : Math.PI;
      R['leg' + i + '0'].rotation.x = 0.25 * sz + Math.sin(p + off) * 0.42 * mv;
      R['leg' + i + '1'].rotation.x = -0.35 * sz + Math.max(0, Math.cos(p + off)) * 0.45 * mv;
    }
    R.body.position.y = 2.05 + Math.abs(Math.sin(p)) * 0.1 * mv - (s.charge || 0) * 0.2;
    R.body.rotation.z = Math.sin(p) * 0.05 * mv;
    R.body.rotation.x = (s.charge || 0) * 0.12;
    R.head.rotation.x = (s.charge || 0) * 0.35 + Math.sin(t * 1.2) * 0.05;
    R.head.rotation.y = Math.sin(t * 0.8) * 0.12 * (1 - mv);
    const atk = s.atk >= 0 ? s.atk : -1;
    for (const S of ['L', 'R']) {
      const sx = S === 'L' ? -1 : 1;
      let rx = 0.9 + Math.sin(t * 1.5 + sx) * 0.05, ry = 0.35 * sx;
      if (atk >= 0) {
        if (atk < 0.45) { const a = U.smooth(atk / 0.45); rx = 0.9 - a * 0.9; ry = (0.35 + a * 0.6) * sx; }
        else { const a = U.smooth(Math.min(1, (atk - 0.45) / 0.25)); rx = 0.0 + a * 1.4; ry = (0.95 - a * 1.5) * sx; }
      }
      R['blade' + S].rotation.x = rx; R['blade' + S].rotation.y = ry;
    }
  }

  // =====================================================================
  //  BROODMOTHER — hive incubator (queen/infestor-like). Translucent egg
  //  sac, lobs broodling eggs and caustic bile.
  // =====================================================================
  function buildBroodmother() {
    const root = new THREE.Group();
    const body = J(root, 'body', [0, 1.35, 0]);
    const abd = J(body, 'abd', [0, 0.35, -0.95]);
    P(abd, sph(16, 12), PAL.sac, [0, 0, 0], null, [1.1, 0.95, 1.4]);
    for (let k = 0; k < 9; k++) P(abd, sph(8, 6), PAL.egg, [Math.cos(k * 2.4) * 0.5, Math.sin(k * 1.7) * 0.4, Math.sin(k * 2.4) * 0.7], null, 0.18 + (k % 3) * 0.04);
    for (let k = 0; k < 4; k++) P(abd, torus(1.0, 0.04), PAL.flesh, [0, 0, 0.9 - k * 0.6], [0, 0, 0], [1.05 - Math.abs(k - 1.5) * 0.15, 0.9 - Math.abs(k - 1.5) * 0.15, 1]);
    P(abd, shell(1.0), PAL.carapace, [0, 0.25, 0.3], [-0.6, 0, 0], [0.9, 0.8, 1]);
    const ovi = J(abd, 'ovi', [0, 0.6, -1.15], [-0.8, 0, 0]);
    P(ovi, spike(0.9, 0.2, 7), PAL.flesh);
    P(ovi, torus(0.16, 0.04), PAL.plate, [0, 0.8, 0], [Math.PI / 2, 0, 0]);
    P(body, sph(), PAL.carapace, [0, 0, 0.4], null, [0.62, 0.55, 0.72]);
    for (let k = 0; k < 3; k++) P(body, sph(), PAL.plate, [0, 0.42, 0.7 - k * 0.3], [-0.3, 0, 0], [0.5, 0.18, 0.28]);
    const head = J(body, 'head', [0, 0.28, 1.05]);
    P(head, sph(), PAL.carapace, [0, 0, 0.1], null, [0.36, 0.33, 0.42]);
    for (let k = 0; k < 5; k++) { const a = (k - 2) * 0.35; P(head, spike(0.75 - Math.abs(k - 2) * 0.12, 0.06), PAL.bone, [Math.sin(a) * 0.22, 0.2, -0.05], [-0.9, 0, a * 1.2]); }
    for (let k = 0; k < 6; k++) { const sx = k % 2 ? 1 : -1; P(head, sph(6, 4), PAL.eyeR, [(0.14 + (k >> 1) * 0.04) * sx, 0.12 - (k >> 1) * 0.08, 0.38 - (k >> 1) * 0.04], null, 0.045); }
    const jaw = J(head, 'jaw', [0, -0.15, 0.3]);
    for (const sx of [-1, 1]) P(jaw, fspike(0.4, 0.05, 4), PAL.bone, [0.1 * sx, 0, 0], [0.2, -0.35 * sx, 0]);
    for (const sx of [-1, 1]) {
      const S = sx < 0 ? 'L' : 'R';
      limb(body, 'arm' + S, [0.35 * sx, -0.15, 0.9], [
        { len: 0.55, r0: 0.08, r1: 0.06, mat: PAL.carapace, rot: [-1.2, 0, 0.3 * sx] },
        { len: 0.5, r0: 0.05, r1: 0.015, mat: PAL.bone, rot: [1.4, 0, 0], tip: 0.1 },
      ]);
    }
    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 1 : -1, z = 0.7 - (i >> 1) * 0.45;
      limb(body, 'leg' + i, [0.5 * sx, 0, z], [
        { len: 1.1, r0: 0.09, r1: 0.06, mat: PAL.carapace, rot: [0, 0, 2.3 * sx] },
        { len: 2.0, r0: 0.06, r1: 0.02, mat: PAL.flesh, rot: [0, 0, -2.05 * sx], tip: 0.2 },
      ]);
    }
    return root;
  }
  function animBroodmother(R, s) {
    const p = s.phase, mv = s.move, t = s.t;
    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 1 : -1, grp = ((i >> 1) + (i % 2)) % 2, ph = p + grp * Math.PI;
      R['leg' + i + '0'].rotation.x = Math.sin(ph) * 0.35 * mv;
      R['leg' + i + '0'].rotation.z = 2.3 * sx + Math.max(0, Math.cos(ph)) * 0.25 * mv * sx;
    }
    const lay = s.cast >= 0 ? Math.sin(Math.PI * s.cast) : 0;
    const b = 1 + Math.sin(t * 2.2) * 0.04 - lay * 0.1;
    R.abd.scale.set(b, b * (1 + lay * 0.08), b);
    R.abd.rotation.x = -lay * 0.25;
    R.ovi.rotation.x = -0.8 - lay * 0.6;
    R.body.position.y = 1.35 + Math.abs(Math.sin(p)) * 0.05 * mv;
    R.head.rotation.x = Math.sin(t * 1.3) * 0.08 - (s.spit >= 0 ? Math.sin(Math.PI * s.spit) * 0.5 : 0);
    R.jaw.rotation.x = (s.spit >= 0 ? Math.sin(Math.PI * s.spit) * 0.6 : 0);
    for (const S of ['L', 'R']) R['arm' + S + '0'].rotation.x = -1.2 + Math.sin(t * 2 + (S === 'L' ? 0 : 1)) * 0.2;
  }

  // =====================================================================
  //  BROODLING — short-lived hatchling. Tiny, fast, many.
  // =====================================================================
  function buildBroodling() {
    const root = new THREE.Group();
    const body = J(root, 'body', [0, 0.25, 0]);
    P(body, sph(), PAL.carapace, [0, 0, 0], null, [0.2, 0.14, 0.28]);
    P(body, sph(), PAL.plate, [0, 0.08, -0.02], [-0.2, 0, 0], [0.17, 0.08, 0.22]);
    for (const sx of [-1, 1]) {
      P(body, fspike(0.22, 0.03, 4), PAL.bone, [0.07 * sx, 0, 0.24], [0, -0.3 * sx, 0]);
      P(body, sph(4, 3), PAL.eyeY, [0.08 * sx, 0.06, 0.2], null, 0.03);
    }
    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 1 : -1, z = 0.12 - (i >> 1) * 0.12;
      limb(body, 'leg' + i, [0.14 * sx, 0, z], [
        { len: 0.16, r0: 0.025, r1: 0.02, mat: PAL.carapace, rot: [0, 0, 1.9 * sx] },
        { len: 0.24, r0: 0.02, r1: 0.006, mat: PAL.bone, rot: [0, 0, -1.6 * sx] },
      ]);
    }
    return root;
  }
  function animBroodling(R, s) {
    for (let i = 0; i < 6; i++) { const ph = s.phase + (i % 2) * Math.PI + (i >> 1) * 0.6; R['leg' + i + '0'].rotation.x = Math.sin(ph) * 0.6 * s.move; }
    R.body.position.y = 0.25 + Math.abs(Math.sin(s.phase * 2)) * 0.03;
  }

  // =====================================================================
  //  BURROWER — ambush artillery (lurker-like). Tunnels beneath the floor,
  //  surfaces, and drives spine eruptions through the ground.
  // =====================================================================
  function buildBurrower() {
    const root = new THREE.Group();
    const body = J(root, 'body', [0, 0.72, 0]);
    P(body, sph(12, 10), PAL.carapace, [0, 0, 0], null, [0.85, 0.52, 1.15]);
    P(body, sph(), PAL.flesh, [0, -0.2, 0.05], null, [0.72, 0.35, 1.0]);
    for (let k = 0; k < 4; k++) P(body, sph(), PAL.plate, [0, 0.36, 0.6 - k * 0.4], [-0.3, 0, 0], [0.72 - Math.abs(k - 1.5) * 0.1, 0.2, 0.3]);
    const head = J(body, 'head', [0, -0.05, 1.05]);
    P(head, sph(), PAL.carapace, [0, 0, 0.05], null, [0.42, 0.24, 0.3]);
    for (const sx of [-1, 1]) {
      P(head, sph(6, 4), PAL.eyeO, [0.2 * sx, 0.1, 0.25], null, 0.045);
      P(head, fspike(0.35, 0.05, 4), PAL.bone, [0.18 * sx, -0.08, 0.2], [0.2, -0.5 * sx, 0]);
    }
    const spines = [[-0.42, 0.35, 0.35], [0.42, 0.35, 0.35], [-0.3, 0.42, -0.1], [0.3, 0.42, -0.1], [-0.15, 0.38, -0.55], [0.15, 0.38, -0.55]];
    spines.forEach(([x, y, z], i) => {
      const j = J(body, 'spine' + i, [x, y, z]);
      P(j, spike(2.4, 0.16, 6), PAL.bone);
      P(j, sph(), PAL.plate, [0, 0.05, 0], null, 0.2);
    });
    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 1 : -1, z = 0.55 - (i >> 1) * 0.5;
      limb(body, 'leg' + i, [0.7 * sx, -0.15, z], [
        { len: 0.45, r0: 0.08, r1: 0.06, mat: PAL.carapace, rot: [0, 0, 1.5 * sx] },
        { len: 0.55, r0: 0.05, r1: 0.015, mat: PAL.bone, rot: [0, 0, -1.4 * sx] },
      ]);
    }
    return root;
  }
  function animBurrower(R, s) {
    const t = s.t, atk = s.atk >= 0 ? s.atk : -1, mv = s.move;
    for (let i = 0; i < 6; i++) {
      const j = R['spine' + i], sx = i % 2 ? 1 : -1, row = i >> 1;
      let rx = -0.35 - row * 0.25 + Math.sin(t * 2 + i) * 0.04, rz = -sx * (0.45 + row * 0.1);
      if (s.fold) { rx = -1.3 - row * 0.1; rz = -sx * 0.2; }
      if (atk >= 0) { const a = Math.sin(Math.PI * Math.min(1, atk * 1.3)); rx = U.lerp(rx, 2.0 - row * 0.1, a); rz = U.lerp(rz, -sx * 0.8, a); }
      j.rotation.x = rx; j.rotation.z = rz;
    }
    for (let i = 0; i < 6; i++) R['leg' + i + '0'].rotation.x = Math.sin(s.phase + (i % 2) * Math.PI + (i >> 1)) * 0.5 * mv;
    R.body.position.y = 0.72 + (atk >= 0 ? Math.sin(Math.PI * atk) * 0.2 : Math.sin(t * 1.5) * 0.03);
    R.head.rotation.x = Math.sin(t * 1.7) * 0.08;
  }

  // =====================================================================
  //  HIVE TYRANT — the Brood's apex (boss). Crowned, four-armed, towering.
  // =====================================================================
  function buildTyrant() {
    const root = new THREE.Group();
    const body = J(root, 'body', [0, 2.7, 0]);
    P(body, sph(14, 10), PAL.carapace, [0, 0, -0.7], null, [1.45, 1.1, 2.0]);
    P(body, sph(), PAL.flesh, [0, -0.35, -0.6], null, [1.2, 0.8, 1.7]);
    for (let k = 0; k < 5; k++) {
      P(body, sph(), PAL.plate, [0, 0.78, 0.4 - k * 0.55], [-0.4, 0, 0], [1.2 - Math.abs(k - 2) * 0.1, 0.4, 0.5]);
      for (const sx of [-1, 1]) P(body, spike(0.8, 0.12), PAL.bone, [0.5 * sx, 1.0, 0.3 - k * 0.55], [-0.8, 0, 0.6 * sx]);
    }
    for (let k = 0; k < 6; k++) P(body, seg(1.6, 0.03, 0.03, 4), PAL.vein, [Math.sin(k) * 1.2, 0.4, -0.7 + Math.cos(k * 2) * 1.2], [Math.PI / 2 + Math.sin(k) * 0.5, k, 0]);
    // tail
    let tp = J(body, 'tl0', [0, 0, -2.4], [0.3, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const r = 0.55 - i * 0.08;
      P(tp, sph(), PAL.carapace, [0, 0, -0.3], null, [r, r * 0.85, r * 1.3]);
      P(tp, spike(0.4, 0.07), PAL.bone, [0, r * 0.8, -0.3], [-0.8, 0, 0]);
      if (i < 4) tp = J(tp, 'tl' + (i + 1), [0, 0, -0.62], [0.15, 0, 0]);
    }
    P(tp, sph(8, 6), PAL.plate, [0, 0, -0.75], null, [0.5, 0.45, 0.6]);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P(tp, spike(0.6, 0.09), PAL.bone, [Math.cos(a) * 0.35, Math.sin(a) * 0.35, -0.8], [Math.PI / 2 + Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8]); }
    // upper torso
    const torso = J(body, 'torso', [0, 0.7, 0.9]);
    P(torso, sph(12, 10), PAL.carapace, [0, 1.1, -0.05], null, [1.15, 1.45, 0.95]);
    for (let k = 0; k < 4; k++) P(torso, sph(), PAL.plate, [0, 0.4 + k * 0.45, 0.62], [0.25, 0, 0], [0.62 - Math.abs(k - 1.5) * 0.08, 0.2, 0.3]);
    P(torso, sph(), PAL.flesh, [0, 0.9, 0.35], null, [0.8, 1.0, 0.6]);
    for (let k = 0; k < 5; k++) P(torso, torus(0.6 - k * 0.04, 0.05), PAL.flesh, [0, 0.3 + k * 0.3, 0.5], [Math.PI / 2 - 0.2, 0, 0], [1, 0.6, 1]);
    const pust = [[-0.52, 1.35, 0.62], [0.52, 1.35, 0.62], [0, 0.35, 0.8]];
    pust.forEach((q) => { P(torso, sph(10, 8), PAL.glowO, q, null, [0.16, 0.2, 0.12]); P(torso, torus(0.18, 0.05), PAL.flesh, q, [0, 0, 0], [1, 1.2, 1]); });
    for (const sx of [-1, 1]) {
      P(torso, sph(), PAL.plate, [0.95 * sx, 1.75, -0.05], [0, 0, 0.5 * sx], [0.65, 0.4, 0.75]);
      for (let k = 0; k < 3; k++) P(torso, spike(0.9 - k * 0.2, 0.12), PAL.bone, [(0.9 + k * 0.15) * sx, 2.0, -0.2 + k * 0.2], [-0.5, 0, 0.9 * sx]);
    }
    const head = J(torso, 'head', [0, 2.2, 0.35]);
    P(head, sph(), PAL.carapace, [0, 0, 0.2], null, [0.55, 0.5, 0.72]);
    P(head, fspike(0.5, 0.25, 6), PAL.carapace, [0, -0.05, 0.75]);
    for (let k = 0; k < 7; k++) { const a = (k - 3) * 0.3; P(head, spike(1.9 - Math.abs(k - 3) * 0.25, 0.1), PAL.bone, [Math.sin(a) * 0.4, 0.3, -0.1], [-1.05, 0, a * 1.4]); }
    for (let k = 0; k < 6; k++) { const sx = k % 2 ? 1 : -1; P(head, sph(6, 4), PAL.eyeP, [(0.28 + (k >> 1) * 0.06) * sx, 0.15 - (k >> 1) * 0.1, 0.62 - (k >> 1) * 0.06], null, 0.07); }
    const jaw = J(head, 'jaw', [0, -0.25, 0.4]);
    P(jaw, fspike(0.7, 0.2, 5), PAL.flesh);
    for (const sx of [-1, 1]) P(jaw, fspike(0.8, 0.08, 4), PAL.bone, [0.25 * sx, 0.05, 0.1], [0.1, -0.35 * sx, 0]);
    // arms: upper scythes and lower claws
    for (const sx of [-1, 1]) {
      const S = sx < 0 ? 'L' : 'R';
      const sh = J(torso, 'sh' + S, [1.05 * sx, 1.55, 0.2], [-0.4, 0, 0.5 * sx]);
      P(sh, sph(), PAL.plate, [0, 0, 0], null, 0.35);
      P(sh, seg(1.1, 0.22, 0.17, 7), PAL.carapace);
      const el = J(sh, 'el' + S, [0, -1.1, 0], [-1.3, 0, 0]);
      P(el, seg(0.6, 0.16, 0.12, 7), PAL.flesh);
      P(el, blade(2.8, 0.7, 0.12), PAL.bone, [0, -0.5, 0], [Math.PI, Math.PI / 2, 0]);
      limb(torso, 'claw' + S, [0.7 * sx, 0.5, 0.5], [
        { len: 0.8, r0: 0.12, r1: 0.09, mat: PAL.carapace, rot: [-0.8, 0, 0.4 * sx] },
        { len: 0.7, r0: 0.08, r1: 0.03, mat: PAL.bone, rot: [-0.9, 0, 0], tip: 0.3 },
      ]);
    }
    const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    legs.forEach(([sx, sz], i) => {
      const L = limb(body, 'leg' + i, [1.1 * sx, -0.4, (sz > 0 ? 0.5 : -1.7)], [
        { len: 1.6, r0: 0.34, r1: 0.26, mat: PAL.carapace, rot: [0.3 * sz, 0, 0.9 * sx], rad: 7 },
        { len: 1.15, r0: 0.24, r1: 0.1, mat: PAL.flesh, rot: [-0.3 * sz, 0, -1.25 * sx], rad: 7, tip: 0.3 },
      ]);
      P(L[0], sph(), PAL.plate, [0, -0.2, 0], null, [0.45, 0.6, 0.45]);
      P(L[0], spike(0.6, 0.1), PAL.bone, [0.2 * sx, 0, 0], [0, 0, -1.2 * sx]);
    });
    return root;
  }
  function animTyrant(R, s) {
    const p = s.phase, mv = s.move, t = s.t;
    for (let i = 0; i < 4; i++) {
      const sz = i < 2 ? 1 : -1, off = (i === 0 || i === 3) ? 0 : Math.PI;
      R['leg' + i + '0'].rotation.x = 0.3 * sz + Math.sin(p + off) * 0.35 * mv;
      R['leg' + i + '1'].rotation.x = -0.3 * sz + Math.max(0, Math.cos(p + off)) * 0.35 * mv;
    }
    R.body.position.y = 2.7 + Math.abs(Math.sin(p)) * 0.12 * mv + Math.sin(t * 1.6) * 0.04;
    for (let i = 0; i < 5; i++) { const j = R['tl' + i]; if (j) j.rotation.y = Math.sin(t * 1.4 - i * 0.7) * 0.22; }
    const act = s.act || '', a = s.actT || 0;
    let torsoX = Math.sin(t * 1.6) * 0.04, headX = Math.sin(t * 1.3) * 0.06, jawX = 0.1 + Math.max(0, Math.sin(t * 0.7)) * 0.1;
    let shx = -0.4 + Math.sin(t * 1.5) * 0.08, elx = -1.3 + Math.sin(t * 1.7) * 0.1, shz = 0.5;
    if (act === 'barrage') { const k = Math.sin(Math.PI * a); torsoX -= k * 0.35; jawX += k * 0.6; shx -= k * 1.2; shz += k * 0.5; }
    else if (act === 'slam') { if (a < 0.55) { const k = U.smooth(a / 0.55); shx = -0.4 - k * 2.2; elx = -1.3 + k * 0.8; torsoX -= k * 0.3; } else { const k = U.smooth(Math.min(1, (a - 0.55) / 0.15)); shx = -2.6 + k * 2.9; elx = -0.5 - k * 0.3; torsoX = -0.3 + k * 0.6; } }
    else if (act === 'roar') { const k = Math.sin(Math.PI * a); headX -= k * 0.6; jawX += k * 0.8; torsoX -= k * 0.25; shz += k * 0.6; }
    else if (act === 'charge') { torsoX += 0.35; headX += 0.2; }
    R.torso.rotation.x = torsoX; R.head.rotation.x = headX; R.jaw.rotation.x = jawX;
    for (const S of ['L', 'R']) {
      const sx = S === 'L' ? -1 : 1;
      R['sh' + S].rotation.x = shx; R['sh' + S].rotation.z = shz * sx; R['el' + S].rotation.x = elx;
      R['claw' + S + '0'].rotation.x = -0.8 + Math.sin(t * 2.2 + sx) * 0.2;
    }
  }

  // ---------------- registry ----------------
  const DEFS = {
    skitterling: { build: buildSkitterling, anim: animSkitterling, hit: [['body', [0, 0, 0], 0.42, 1], ['head', [0, 0, 0.15], 0.2, 2]] },
    lancer: { build: buildLancer, anim: animLancer, hit: [['torso', [0, 0.3, 0], 0.42, 1], ['chest', [0, 0.25, 0.05], 0.45, 1], ['head', [0, 0, 0.18], 0.27, 2], ['tl1', [0, 0, -0.2], 0.32, 0.8]] },
    burster: { build: buildBurster, anim: animBurster, hit: [['body', [0, 0, 0], 0.66, 1.5]] },
    shrieker: { build: buildShrieker, anim: animShrieker, hit: [['body', [0, 0, 0], 0.5, 1], ['head', [0, 0, 0.12], 0.28, 2], ['tl1', [0, 0, -0.16], 0.25, 0.8]] },
    behemoth: { build: buildBehemoth, anim: animBehemoth, hit: [['body', [0, 0, 0.2], 1.45, 0.75], ['head', [0, 0, 0.3], 0.75, 0.5], ['body', [0, 0.72, -1.5], 0.5, 3.5]] },
    broodmother: { build: buildBroodmother, anim: animBroodmother, hit: [['abd', [0, 0, 0], 1.15, 1.3], ['body', [0, 0, 0.4], 0.62, 1], ['head', [0, 0, 0.1], 0.36, 2]] },
    broodling: { build: buildBroodling, anim: animBroodling, hit: [['body', [0, 0, 0], 0.3, 1]] },
    burrower: { build: buildBurrower, anim: animBurrower, hit: [['body', [0, 0, 0], 0.95, 1], ['head', [0, 0, 0.05], 0.36, 2]] },
    tyrant: { build: buildTyrant, anim: animTyrant, hit: [['torso', [0, 1.0, 0], 1.2, 1], ['head', [0, 0, 0.2], 0.62, 1.6], ['torso', [-0.52, 1.35, 0.62], 0.3, 3], ['torso', [0.52, 1.35, 0.62], 0.3, 3], ['torso', [0, 0.35, 0.8], 0.3, 3], ['body', [0, 0, -0.7], 1.45, 0.7]] },
  };
  MON.DEFS = DEFS;
  // ---------------- skinning ----------------
  // A creature is a tree of joints carrying rigid parts. Drawn as built, that is one draw call per material per joint
  // (26 to 40 a creature). Instead each species is baked once into one skinned mesh per material, every vertex bound
  // to the joint it hangs from: the joints still move exactly as before, and a creature draws in a handful of calls.
  const IDENT = new THREE.Matrix4(), HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
  const skinnedCopy = new Map(); // shared materials (bone, eyes...): one skinned copy for every creature
  function skinnedOf(mat) { if (!skinnedCopy.has(mat)) { const c = mat.clone(); c.skinning = true; skinnedCopy.set(mat, c); } return skinnedCopy.get(mat); }
  // a part mirrored by a negative scale has its triangles the wrong way round once baked
  function flipWinding(g) {
    for (const a of Object.values(g.attributes)) {
      const n = a.itemSize, arr = a.array;
      for (let v = 0; v + 2 < a.count; v += 3) for (let k = 0; k < n; k++) { const i1 = (v + 1) * n + k, i2 = (v + 2) * n + k, t = arr[i1]; arr[i1] = arr[i2]; arr[i2] = t; }
    }
  }
  function bake(tpl) {
    tpl.updateMatrixWorld(true);
    const inv = tpl.matrixWorld.clone().invert(), parts = [];
    tpl.traverse((o) => {
      if (!o.isMesh) return;
      let j = o.parent; while (j.isMesh) j = j.parent;
      parts.push({ o, j, mat: o.material, m: inv.clone().multiply(o.matrixWorld) });
    });
    // the parts leave the template, which keeps only its joints (a part that carries joints stays, drawn by nothing)
    for (const p of parts) { if (p.o.children.length) p.o.material = HIDDEN; else p.o.parent.remove(p.o); }
    const nodes = []; tpl.traverse((o) => nodes.push(o));
    const joints = [...new Set(parts.map((p) => p.j))];
    const byMat = new Map(), box = new THREE.Box3(), out = [];
    for (const p of parts) { if (!byMat.has(p.mat)) byMat.set(p.mat, []); byMat.get(p.mat).push(p); }
    for (const [mat, list] of byMat) {
      const geos = list.map((p) => { const g = p.o.geometry.index ? p.o.geometry.toNonIndexed() : p.o.geometry.clone(); g.applyMatrix4(p.m); if (p.m.determinant() < 0) flipWinding(g); return g; });
      let n = 0; for (const g of geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      let o = 0;
      geos.forEach((g, k) => {
        const c = g.attributes.position.count, ji = joints.indexOf(list[k].j);
        pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
        for (let i = 0; i < c; i++) { si[(o + i) * 4] = ji; sw[(o + i) * 4] = 1; }
        o += c; g.dispose();
      });
      const geo = keep(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      geo.computeBoundingBox(); box.union(geo.boundingBox);
      geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.3; // attacks reach a little past the resting pose
      out.push({ geo, mat, shared: mat.userData.skin ? null : skinnedOf(mat) });
    }
    const sph = box.getBoundingSphere(new THREE.Sphere());
    return {
      jointIdx: joints.map((j) => nodes.indexOf(j)),
      inverses: joints.map((j) => inv.clone().multiply(j.matrixWorld).invert()),
      parts: out, bsY: sph.center.y, bsR: sph.radius * 1.15 + Math.hypot(sph.center.x, sph.center.z),
    };
  }
  // a joint hidden with .visible = false (a crawler's lost legs) takes its parts with it
  const _skUpd = THREE.Skeleton.prototype.update;
  function skelUpdate() {
    _skUpd.call(this);
    const b = this.bones, bm = this.boneMatrices, top = this.top;
    for (let i = 0; i < b.length; i++) for (let o = b[i]; o && o !== top; o = o.parent) if (!o.visible) { bm.fill(0, i * 16, i * 16 + 16); break; }
  }
  const templates = {}, skins = {};
  MON.template = (type) => {
    if (!templates[type]) { const t = DEFS[type].build(); optimize(t); skins[type] = bake(t); templates[type] = t; }
    return templates[type];
  };
  // Create an instance: {root, rig, mats, hit, parts (its skinned meshes), skeleton, bsY / bsR (a sphere round it)}
  MON.create = (type, variant) => {
    const tpl = MON.template(type), sk = skins[type], root = tpl.clone(true);
    const nodes = [], rig = {}, mats = [], parts = [];
    root.traverse((o) => { nodes.push(o); if (o.name) rig[o.name] = o; });
    const skeleton = new THREE.Skeleton(sk.jointIdx.map((i) => nodes[i]), sk.inverses);
    skeleton.top = root; skeleton.update = skelUpdate;
    for (const p of sk.parts) {
      let mat = p.shared;
      // skin materials are this creature's own (hit flashes, freezing, elite colours)
      if (!mat) { mat = p.mat.clone(); mat.skinning = true; mat.userData = { base: p.mat.emissive.getHex(), baseColor: p.mat.color.getHex(), op: p.mat.opacity }; mats.push(mat); }
      const m = new THREE.SkinnedMesh(p.geo, mat); m.bind(skeleton, IDENT); root.add(m); parts.push(m);
    }
    if (variant === 'frenzied') for (const m of mats) { m.userData.base = 0x5a1400; m.emissive.setHex(0x5a1400); }
    if (variant === 'elite') for (const m of mats) { m.color.multiplyScalar(0.6); m.userData.baseColor = m.color.getHex(); m.userData.base = 0x2a0840; m.emissive.setHex(0x2a0840); }
    const hit = DEFS[type].hit.map(([node, off, r, mult]) => ({ node: rig[node], off: new THREE.Vector3(...off), r, mult, wp: new THREE.Vector3() }));
    return { root, rig, mats, hit, parts, skeleton, bsY: sk.bsY, bsR: sk.bsR };
  };
  MON.animate = (type, rig, st, dt) => DEFS[type].anim(rig, st, dt);
  // Variant model: the base species scaled and recoloured (m.scale, m.tint [color, amount], m.glow emissive, m.dark)
  MON.addVariant = (id, base, m) => {
    const B = DEFS[base], s = m.scale || 1;
    DEFS[id] = {
      base,
      build: () => {
        // palette materials are shared by every species: recolour copies
        const t = B.build(), tint = m.tint ? new THREE.Color(m.tint[0]) : null, copies = new Map();
        t.traverse((o) => {
          if (!o.isMesh || !o.material || !o.material.color) return;
          if (copies.has(o.material)) { o.material = copies.get(o.material); return; }
          const mt = o.material.clone(); copies.set(o.material, mt); o.material = mt;
          if (tint && mt.userData.skin) mt.color.lerp(tint, m.tint[1]);
          if (m.dark) mt.color.multiplyScalar(m.dark);
          if (m.glow && mt.userData.skin && mt.emissive) mt.emissive.setHex(m.glow);
          if (m.eyes && !mt.userData.skin && mt.type === 'MeshBasicMaterial') mt.color.setHex(m.eyes);
        });
        t.scale.multiplyScalar(s);
        return t;
      },
      anim: B.anim,
      hit: B.hit.map(([node, off, r, mult]) => [node, off.map((v) => v * s), r * s, mult]),
    };
  };
  // warm up templates (compiles geometry once)
  MON.warm = () => Object.keys(DEFS).forEach(MON.template);
})();
