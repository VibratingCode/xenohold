'use strict';
// Zones placed in the map editor ('@zone' entities, js/setdress.js SD.spawn): areas that do something to whoever is in
// them. Deadly (instant death, lava, deep water you can drown in, acid, gas, radiation, fire, live floors, crushers,
// flame jets, lasers, spikes, mines, saws), movement (mud, quicksand, ice, wind, conveyors, low gravity, jump pads,
// speed strips, teleporters) and helpful or blocking ones (healing, creature and player barriers, fog).
// Also the explosive barrels and fuel of js/kit.js: shoot them, or blow something up next to them.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const HZ = XH.hazards = { list: [], barrels: [], queue: [] };
  const W = () => XH.world, SD = () => XH.setdress, E = () => XH.enemies, P = () => XH.player;

  // cat: where it sits in the editor; deadly: creatures path around it; o: the options and their defaults
  // h: how high above the floor the zone reaches
  HZ.TYPES = {
    kill: { label: 'Instant death', cat: 'Deadly', color: 0xff2040, deadly: true, h: 30, o: { look: 'void' }, note: 'Anything that enters dies. look: void (a black drop), glow (a red haze) or hidden.' },
    lava: { label: 'Lava', cat: 'Deadly', color: 0xff5a1e, deadly: true, h: 0.4, o: { dmg: 35 }, note: 'Burns 35 health a second; creatures burn too and walk around it.' },
    water: { label: 'Deep water (drowning)', cat: 'Deadly', color: 0x2a78c0, h: 3, o: { depth: 2.5, breath: 8, dmg: 20 }, note: 'Swim slowly; with your head under for longer than breath (seconds) you start to drown. depth: where the surface is, above the floor. Put it in a lowered pit for a lake.' },
    shallow: { label: 'Shallow water', cat: 'Liquids and ground', color: 0x4a98d0, h: 1, o: { depth: 0.5 }, note: 'Wading: slower for everyone.' },
    acid: { label: 'Acid pool', cat: 'Deadly', color: 0x96ff3c, deadly: true, h: 0.4, o: { dmg: 18 }, note: 'Eats 18 health a second and slows you.' },
    gas: { label: 'Toxic gas', cat: 'Deadly', color: 0x7aff5a, h: 3.2, o: { dmg: 8 }, note: 'Hurts the player 8 a second. The creatures breathe it happily.' },
    radiation: { label: 'Radiation', cat: 'Deadly', color: 0xc8ff40, h: 4, o: { dmg: 18 }, note: 'Harmless at first, worse the longer you stay (up to dmg a second). The creatures do not mind.' },
    fire: { label: 'Fire', cat: 'Deadly', color: 0xff8a30, deadly: true, h: 2.5, o: { dmg: 22 }, note: 'Burns everything in it.' },
    electric: { label: 'Electrified floor', cat: 'Deadly', color: 0x60c0ff, deadly: true, h: 0.4, o: { dmg: 25 }, note: 'A shock every 0.6 s, for you and for them.' },
    spikes: { label: 'Spike floor (always on)', cat: 'Deadly', color: 0xb0b0b0, h: 1.5, o: { dmg: 40, every: 2 }, note: 'Spikes shoot up every few seconds.' },
    crusher: { label: 'Crusher (always on)', cat: 'Deadly', color: 0xd8a020, h: 4, o: { every: 2.5 }, note: 'A press slams down every few seconds and flattens what is under it. Watch the rhythm.' },
    flamejet: { label: 'Flame jets (always on)', cat: 'Deadly', color: 0xff9030, h: 3, o: { dmg: 30, on: 3, off: 2 }, note: 'On for a few seconds, off for a few.' },
    laser: { label: 'Laser grid (always on)', cat: 'Deadly', color: 0xff3050, h: 2.4, o: { dmg: 60, on: 3, off: 1.5 }, note: 'Beams across the zone, blinking on and off.' },
    mines: { label: 'Minefield', cat: 'Deadly', color: 0xa08040, h: 1, o: { count: 6, hidden: false }, note: 'Mines that go off when something steps on them, once each. hidden: true buries them.' },
    saw: { label: 'Saw blade', cat: 'Deadly', color: 0xc0c8d0, h: 1.6, o: { dmg: 50, speed: 3 }, note: 'A spinning blade running back and forth along the zone.' },
    mud: { label: 'Mud / tar', cat: 'Liquids and ground', color: 0x5a4028, h: 0.4, o: { slow: 0.5 }, note: 'Everyone moves at half speed.' },
    quicksand: { label: 'Quicksand', cat: 'Liquids and ground', color: 0xc8a060, h: 0.5, o: { slow: 0.3, dmg: 4 }, note: 'Very slow, and it slowly hurts.' },
    ice: { label: 'Ice (slippery)', cat: 'Liquids and ground', color: 0xb0e0ff, h: 0.3, o: {}, note: 'Hard to stop and turn.' },
    wind: { label: 'Wind', cat: 'Movement', color: 0xd0e0f0, h: 6, o: { dir: 0, force: 6 }, note: 'Pushes everyone along dir (degrees: 0 = +z, 90 = +x).' },
    conveyor: { label: 'Conveyor belt', cat: 'Movement', color: 0x808890, h: 0.5, o: { dir: 0, force: 3.5 }, note: 'Carries you along dir.' },
    lowgrav: { label: 'Low gravity', cat: 'Movement', color: 0xa080ff, h: 12, o: { grav: 0.3 }, note: 'Jump higher, fall slower.' },
    jumppad: { label: 'Jump pad', cat: 'Movement', color: 0x40ff90, h: 1.5, o: { power: 14, push: 0, dir: 0 }, note: 'Throws you up (power) and forward along dir (push).' },
    speed: { label: 'Speed strip', cat: 'Movement', color: 0xffe040, h: 0.4, o: { mul: 1.7 }, note: 'Run faster while on it.' },
    teleport: { label: 'Teleporter', cat: 'Movement', color: 0xb060ff, h: 2.5, o: { tx: 0, tz: 0 }, note: 'Sends you to tx, tz (set it to where you want to arrive).' },
    heal: { label: 'Healing field', cat: 'Helpful and barriers', color: 0x40ff80, h: 3, o: { rate: 12 }, note: 'Heals the player rate health a second.' },
    barrier: { label: 'Creature barrier', cat: 'Helpful and barriers', color: 0xff4060, h: 4, o: { visible: true }, note: 'A force field creatures cannot cross. You and your shots can.' },
    clip: { label: 'Player barrier (invisible)', cat: 'Helpful and barriers', color: 0x60a0ff, h: 8, o: {}, note: 'An invisible wall for the player only. Creatures cross it.' },
    wire: { label: 'Barbed wire tangle', cat: 'Deadly', color: 0x9a9a90, h: 1.2, o: { dmg: 6, slow: 0.35 }, note: 'Slows everyone to a crawl and cuts them. The Barbed wire piece brings its own.' },
    fog: { label: 'Fog / darkness', cat: 'Helpful and barriers', color: 0x303040, h: 5, o: { thick: 0.6 }, note: 'Looks only: a dark haze that hides what is inside.' },
  };
  HZ.CATS = ['Deadly', 'Liquids and ground', 'Movement', 'Helpful and barriers'];

  const mats = {};
  const mat = (k, f) => mats[k] || (mats[k] = f());
  const box = new THREE.BoxGeometry(1, 1, 1), plane = new THREE.PlaneGeometry(1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 16);
  // a separate object on the floor under (x, z): the terrain lift applied here, so it is right in the editor too
  function add(root, m, x, y, z) { const dy = W().dispAt ? W().dispAt(x, z) : 0; m.position.set(x, y + dy, z); if (dy) m.userData.lifted = dy; root.add(m); return m; }
  const surface = (color, opacity, emissive) => new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, roughness: 0.25, metalness: 0.1, emissive: emissive || 0x000000, emissiveIntensity: emissive ? 0.8 : 0, depthWrite: opacity >= 1 });
  const flatPlane = (root, x, z, w, d, y, material) => { const m = new THREE.Mesh(plane, material); m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); return add(root, m, x, y, z); };
  const volume = (root, x, z, w, d, y0, h, material) => { const m = new THREE.Mesh(box, material); m.scale.set(w, h, d); return add(root, m, x, y0 + h / 2, z); };

  // ---------------- building a zone ----------------
  HZ.spawnZone = (e, a, o) => {
    const T = HZ.TYPES[e.zt]; if (!T) return;
    const S = SD(), L = S.lib, rnd = S.random, root = S.root(), Wd = W();
    const x = e.x, z = e.z, w = Math.max(0.5, e.w || 5), d = Math.max(0.5, e.d || 5), opt = Object.assign({}, T.o, o || {}), editor = S.editor;
    const Z = { e, T, type: e.zt, o: opt, x, z, w, d, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: Wd.floorAt(x, z), h: T.h, t: rnd() * 3, tick: 0, objs: [] };
    const part = (m, g, p, s, c, r) => L.part(a, m, g, p, s, c, r), M = L.M, G = S.G();
    const aLocal = (ox, oz) => ({ x: x + ox, z: z + oz, ry: 0, y: 0 });
    switch (e.zt) {
      case 'kill': {
        if (opt.look === 'void') { flatPlane(root, x, z, w, d, 0.02, mat('void', () => new THREE.MeshBasicMaterial({ color: 0x000000 }))); for (let k = 0; k < 3; k++) volume(root, x, z, w * 0.99, d * 0.99, -0.2, 0.6 + k * 0.5, mat('voidhaze', () => new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }))); }
        else if (opt.look === 'glow') { volume(root, x, z, w, d, 0, 2.2, mat('killglow', () => new THREE.MeshBasicMaterial({ color: 0xff1030, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }))); flatPlane(root, x, z, w, d, 0.02, mat('killfloor', () => new THREE.MeshBasicMaterial({ color: 0x400008 }))); }
        break;
      }
      case 'lava': case 'acid': {
        const lava = e.zt === 'lava', MAT = S.MAT();
        const m = (lava ? MAT.lava : MAT.acid) || mat(e.zt, () => surface(lava ? 0xff5a1e : 0x96ff3c, 1, lava ? 0xff4010 : 0x60c020));
        flatPlane(root, x, z, w, d, 0.03, m);
        for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) part(M.stone, G.box, [sx * w / 2, 0.08, sz * d / 2], [sx ? 0.25 : w + 0.25, 0.16, sz ? 0.25 : d + 0.25], lava ? 0x2a1a14 : 0x2a3020);
        const n = Math.max(1, Math.round(w * d / 12)); for (let k = 0; k < n; k++) L.part(aLocal((rnd() - 0.5) * w * 0.8, (rnd() - 0.5) * d * 0.8), M.pool, new THREE.CircleGeometry(1, 16), [0, 0.06, 0], [2, 2, 1], lava ? 0xff6020 : 0x80ff40, [-Math.PI / 2, 0]);
        if (!editor) Z.fx = lava ? 'embers' : 'acid';
        break;
      }
      case 'water': case 'shallow': {
        const dep = opt.depth;
        flatPlane(root, x, z, w, d, dep, mat('water' + e.zt, () => new THREE.MeshStandardMaterial({ color: e.zt === 'water' ? 0x1a5a90 : 0x3a88b8, transparent: true, opacity: e.zt === 'water' ? 0.62 : 0.45, roughness: 0.08, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide })));
        if (dep > 0.6) volume(root, x, z, w * 0.998, d * 0.998, 0.01, dep - 0.02, mat('waterbody', () => new THREE.MeshBasicMaterial({ color: 0x0a2a48, transparent: true, opacity: 0.35, depthWrite: false })));
        flatPlane(root, x, z, w, d, 0.015, mat('seabed', () => new THREE.MeshStandardMaterial({ color: 0x2a3a30, roughness: 1 })));
        Z.h = dep + 1.5;
        break;
      }
      case 'gas': case 'radiation': case 'fog': {
        const col = e.zt === 'gas' ? 0x60ff40 : e.zt === 'radiation' ? 0xc8ff40 : 0x0a0a12, op = e.zt === 'fog' ? 0.35 * (opt.thick || 0.6) : e.zt === 'gas' ? 0.16 : 0.07;
        for (let k = 0; k < 3; k++) volume(root, x, z, w * (1 - k * 0.04), d * (1 - k * 0.04), 0, T.h * (0.6 + k * 0.2), mat(e.zt + k, () => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: e.zt === 'fog' ? THREE.NormalBlending : THREE.AdditiveBlending })));
        if (e.zt === 'radiation') for (const [sx, sz] of [[-1, -1], [1, 1]]) { const p = aLocal(sx * (w / 2 + 0.4), sz * (d / 2 + 0.4)); L.part(p, M.metal, G.cyl, [0, 0.6, 0], [0.04, 1.2, 0.04], 0x404040); L.part(p, M.paint, G.box, [0, 1.3, 0], [0.55, 0.55, 0.04], 0xe8d020); L.part(p, M.paint, G.cyl, [0, 1.3, 0.03], [0.14, 0.02, 0.14], 0x151515, [Math.PI / 2, 0]); }
        if (!editor) Z.fx = e.zt === 'gas' ? 'gas' : e.zt === 'radiation' ? 'rad' : null;
        break;
      }
      case 'fire': {
        const n = Math.max(2, Math.round(w * d / 6)); Z.spots = [];
        for (let k = 0; k < n; k++) { const px = (rnd() - 0.5) * w * 0.85, pz = (rnd() - 0.5) * d * 0.85; L.part(aLocal(px, pz), M.decal, new THREE.CircleGeometry(1, 12), [0, 0.014, 0], [1.1, 0.9, 1], 0x0a0806, [-Math.PI / 2, 0]); Z.spots.push([x + px, z + pz]); }
        if (!editor) Z.fx = 'fire';
        break;
      }
      case 'electric': {
        flatPlane(root, x, z, w, d, 0.02, mat('elec', () => surface(0x1a2028, 1, 0x103060)));
        for (let k = 1; k < Math.max(2, Math.round(w / 1.2)); k++) part(M.glow, G.box, [-w / 2 + k * w / Math.max(2, Math.round(w / 1.2)), 0.035, 0], [0.04, 0.01, d * 0.96], 0x3080ff);
        if (!editor) Z.fx = 'arcs';
        break;
      }
      case 'spikes': {
        flatPlane(root, x, z, w, d, 0.02, mat('spikeplate', () => surface(0x2a2c30, 1)));
        const g = new THREE.Group(), sm = mat('spike', () => new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.9, roughness: 0.3 })), cone = new THREE.ConeGeometry(0.09, 0.9, 5);
        for (let i = 0.4; i < w; i += 0.7) for (let j = 0.4; j < d; j += 0.7) { const s = new THREE.Mesh(cone, sm); s.position.set(i - w / 2, 0.45, j - d / 2); g.add(s); }
        g.position.y = editor ? 0 : -0.95; Z.spikes = add(root, g, x, g.position.y, z);
        for (let i = 0.4; i < w; i += 0.7) for (let j = 0.4; j < d; j += 0.7) part(M.metal, G.cyl, [i - w / 2, 0.03, j - d / 2], [0.12, 0.02, 0.12], 0x101010);
        break;
      }
      case 'crusher': {
        const hh = 3.8;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(M.paint, G.box, [sx * (w / 2 + 0.15), hh / 2 + 0.3, sz * (d / 2 + 0.15)], [0.3, hh + 0.6, 0.3], 0xd8a020);
        part(M.metal, G.box, [0, hh + 0.75, 0], [w + 0.7, 0.5, d + 0.7], 0x3a3e44);
        part(M.paint, G.box, [0, 0.02, 0], [w, 0.04, d], 0x151515); for (let k = 0; k < 6; k++) part(M.paint, G.box, [(k - 2.5) * w / 6, 0.045, 0], [w / 12, 0.01, d], 0xd8a020, [0, 0, 0.5]);
        const press = new THREE.Mesh(box, mat('press', () => new THREE.MeshStandardMaterial({ color: 0x5a6068, metalness: 0.8, roughness: 0.35 })));
        press.scale.set(w * 0.96, 0.8, d * 0.96); Z.press = add(root, press, x, hh, z); Z.pressTop = hh;
        break;
      }
      case 'flamejet': {
        const n = Math.max(1, Math.round(w / 1.25)) * Math.max(1, Math.round(d / 1.25)); Z.spots = [];
        for (let i = 0; i < Math.max(1, Math.round(w / 1.25)); i++) for (let j = 0; j < Math.max(1, Math.round(d / 1.25)); j++) { const px = -w / 2 + (i + 0.5) * w / Math.max(1, Math.round(w / 1.25)), pz = -d / 2 + (j + 0.5) * d / Math.max(1, Math.round(d / 1.25)); part(M.metal, G.cyl, [px, 0.1, pz], [0.22, 0.2, 0.22], 0x2a2624); part(M.glow, G.cyl, [px, 0.21, pz], [0.12, 0.02, 0.12], 0xff6020); Z.spots.push([x + px, z + pz]); }
        void n; break;
      }
      case 'laser': {
        const along = w >= d, len = along ? w : d;
        for (const s of [-1, 1]) { const p = aLocal(along ? s * len / 2 : 0, along ? 0 : s * len / 2); L.part(p, M.metal, G.box, [0, 1.25, 0], [0.25, 2.5, 0.25], 0x2a2e33); for (let k = 0; k < 4; k++) L.part(p, M.glow, G.box, [0, 0.4 + k * 0.55, 0], [0.3, 0.06, 0.3], 0xff2040); }
        const bm = mat('beam', () => new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })), g = new THREE.Group();
        for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(box, bm); b.scale.set(along ? len : 0.05, 0.05, along ? 0.05 : len); b.position.y = 0.4 + k * 0.55; g.add(b); }
        Z.beams = add(root, g, x, 0, z); Z.along = along;
        break;
      }
      case 'mines': {
        Z.mines = [];
        const n = Math.max(1, opt.count | 0), mm = mat('mine', () => new THREE.MeshStandardMaterial({ color: 0x3a4030, metalness: 0.6, roughness: 0.5 })), lm = mat('minelight', () => new THREE.MeshBasicMaterial({ color: 0xff2020 }));
        for (let k = 0; k < n; k++) {
          const mx = x + (rnd() - 0.5) * w * 0.9, mz = z + (rnd() - 0.5) * d * 0.9, g = new THREE.Group();
          const body = new THREE.Mesh(cyl, mm); body.scale.set(0.28, 0.1, 0.28); body.position.y = opt.hidden && !editor ? -0.04 : 0.05; g.add(body);
          const led = new THREE.Mesh(cyl, lm); led.scale.set(0.04, 0.03, 0.04); led.position.y = opt.hidden && !editor ? -0.2 : 0.11; g.add(led);
          add(root, g, mx, 0, mz); Z.mines.push({ x: mx, z: mz, g, led, live: true });
        }
        break;
      }
      case 'saw': {
        const along = w >= d, len = along ? w : d;
        part(M.metal, G.box, along ? [0, 0.08, 0] : [0, 0.08, 0], along ? [len, 0.16, 0.3] : [0.3, 0.16, len], 0x2a2e33);
        part(M.paint, G.box, [0, 0.17, 0], along ? [len, 0.02, 0.08] : [0.08, 0.02, len], 0xd8a020);
        const blade = new THREE.Group(), bm = mat('blade', () => new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.95, roughness: 0.2 }));
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 24), bm); disc.rotation.set(Math.PI / 2, 0, along ? 0 : Math.PI / 2); blade.add(disc);
        for (let k = 0; k < 12; k++) { const t2 = new THREE.Mesh(box, bm); const an = k / 12 * Math.PI * 2; t2.scale.set(0.16, 0.16, 0.05); t2.position.set(Math.cos(an) * 0.8, Math.sin(an) * 0.8, 0); t2.rotation.z = an + 0.7; disc.add(t2); }
        blade.rotation.y = along ? 0 : Math.PI / 2; Z.blade = add(root, blade, x, 0.75, z); Z.along = along; Z.len = len;
        break;
      }
      case 'mud': case 'quicksand': case 'ice': {
        const c = e.zt === 'mud' ? [0x2a1c10, 0.95] : e.zt === 'quicksand' ? [0xa88a50, 1] : [0xc8e8ff, 0.05];
        flatPlane(root, x, z, w, d, 0.02, mat('gnd' + e.zt, () => new THREE.MeshStandardMaterial({ color: c[0], roughness: c[1], metalness: e.zt === 'ice' ? 0.3 : 0 })));
        if (e.zt === 'mud') for (let k = 0; k < Math.round(w * d / 4); k++) L.part(aLocal((rnd() - 0.5) * w * 0.9, (rnd() - 0.5) * d * 0.9), M.stone, G.sphere, [0, 0.02, 0], [0.2 + rnd() * 0.3, 0.05, 0.2 + rnd() * 0.3], 0x1a1208);
        break;
      }
      case 'wind': case 'conveyor': {
        const dir = (opt.dir || 0) * Math.PI / 180, dx = Math.sin(dir), dz = Math.cos(dir);
        if (e.zt === 'conveyor') {
          flatPlane(root, x, z, w, d, 0.03, mat('belt', () => new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.8 })));
          for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) part(M.paint, G.box, [sx * w / 2, 0.12, sz * d / 2], [sx ? 0.15 : w, 0.24, sz ? 0.15 : d], 0xd8a020);
          const tex = arrowTex(), am = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
          const arr = flatPlane(root, x, z, w * 0.9, d * 0.9, 0.05, am); arr.rotation.z = -dir + Math.PI;
          tex.repeat.set(Math.max(1, Math.round((Math.abs(dx) > 0.5 ? d : w) / 1.2)), Math.max(1, Math.round((Math.abs(dx) > 0.5 ? w : d) / 1.2))); Z.tex = tex;
        } else if (!editor) Z.fx = 'wind';
        Z.dx = dx; Z.dz = dz;
        break;
      }
      case 'lowgrav': if (!editor) Z.fx = 'float'; volume(root, x, z, w, d, 0, 0.1, mat('lgfloor', () => new THREE.MeshBasicMaterial({ color: 0x8060ff, transparent: true, opacity: 0.2, depthWrite: false }))); break;
      case 'jumppad': case 'speed': case 'teleport': case 'heal': {
        const c = T.color, pad = e.zt === 'jumppad' || e.zt === 'teleport';
        if (pad) { part(M.metal, G.cyl, [0, 0.08, 0], [Math.min(w, d) / 2, 0.16, Math.min(w, d) / 2], 0x2a2e36); part(M.glow, G.cyl, [0, 0.17, 0], [Math.min(w, d) / 2 * 0.8, 0.02, Math.min(w, d) / 2 * 0.8], c); }
        else if (e.zt === 'speed') { const tex = arrowTex(), am = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xffe040 }); const arr = flatPlane(root, x, z, w, d, 0.04, am); arr.rotation.z = -(opt.dir || 0) * Math.PI / 180 + Math.PI; Z.tex = tex; }
        else { flatPlane(root, x, z, w, d, 0.03, mat('healfloor', () => new THREE.MeshBasicMaterial({ color: 0x103820, transparent: true, opacity: 0.6, depthWrite: false }))); part(M.glow, G.box, [0, 0.05, 0], [Math.min(w, d) * 0.5, 0.02, 0.35], 0x40ff80); part(M.glow, G.box, [0, 0.05, 0], [0.35, 0.02, Math.min(w, d) * 0.5], 0x40ff80); }
        L.glowAt(aLocal(0, 0), 0.6, c, Math.min(6, Math.max(w, d) * 1.2), 0.45);
        if (e.zt === 'teleport' && editor) { const tg = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), mat('tgt', () => new THREE.MeshBasicMaterial({ color: 0xb060ff, side: THREE.DoubleSide }))); tg.rotation.x = -Math.PI / 2; add(root, tg, opt.tx, 0.06, opt.tz); }
        if (!editor) Z.fx = e.zt === 'teleport' ? 'swirl' : e.zt === 'heal' ? 'heal' : null;
        break;
      }
      case 'barrier': {
        if (opt.visible !== false || editor) { const fm = mat('field', () => new THREE.MeshBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); Z.field = volume(root, x, z, w, d, 0, 3.5, fm); }
        break;
      }
      case 'clip': case 'wire': if (e.zt === 'wire' && !e.inner) for (let k = 0; k < Math.max(2, Math.round(w / 0.35)); k++) L.part(aLocal(-w / 2 + (k + 0.5) * w / Math.max(2, Math.round(w / 0.35)), 0), M.metal, G.torus, [0, 0.42, 0], [0.42, 0.42, 0.42], 0x76766e, [0, 0, Math.PI / 2]); break;
    }
    // the editor always shows the zone's box, even for the invisible kinds
    if (editor && !e.inner) {
      const em = mat('ed' + e.zt, () => new THREE.MeshBasicMaterial({ color: T.color, transparent: true, opacity: 0.1, depthWrite: false }));
      volume(root, x, z, w, d, 0, Math.min(T.h, 3), em);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), mat('edl' + e.zt, () => new THREE.LineBasicMaterial({ color: T.color })));
      edges.scale.set(w, Math.min(T.h, 3), d); add(root, edges, x, Math.min(T.h, 3) / 2, z);
      return;
    }
    // what the game needs: creatures keep out of the deadly ones, barriers get their colliders
    Z.cells = []; Z.cols = [];
    if (T.deadly || e.zt === 'barrier' || (e.zt === 'water' && opt.depth >= 1.6)) {
      for (let cz = Wd.cellZ(Z.z0 + 0.3); cz <= Wd.cellZ(Z.z1 - 0.3); cz++) for (let cx = Wd.cellX(Z.x0 + 0.3); cx <= Wd.cellX(Z.x1 - 0.3); cx++) if (Wd.inside(cx, cz)) { Wd.zblock[cz * Wd.w + cx] = 1; Z.cells.push(cz * Wd.w + cx); }
    }
    // colliders are given from the flat floor: the world lifts them onto raised ground itself
    if (e.zt === 'barrier') Z.cols.push(Wd.addProp(x, z, w / 2, d / 2, 6, { noPlayer: true, bullets: false, mount: false, y0: -1 }));
    if (e.zt === 'clip') Z.cols.push(Wd.addProp(x, z, w / 2, d / 2, 12, { enemy: false, bullets: false, mount: false, y0: -1 }));
    if (e.zt === 'crusher') { Z.prop = Wd.addProp(x, z, w / 2, d / 2, Z.pressTop + 0.4, { bullets: true, mount: false, noClimb: true, noPlayer: true, enemy: false, y0: Z.pressTop - 0.4 }); Z.base = Z.prop.y0 - (Z.pressTop - 0.4); }
    HZ.list.push(Z);
    // a named zone can be switched on and off by triggers (js/logic.js); built in a group of its own so it can hide
    Z.tag = e.tag; if (e.tag && XH.logic) XH.logic.tagZone(e.tag, Z);
    if (S.root().userData.solo) Z.group = S.root();
    if (opt.off) HZ.setZone(Z, false);
  };
  HZ.setZone = (Z, on) => {
    if (!Z || !!Z.off === !on) return;
    Z.off = !on; if (Z.group) Z.group.visible = on;
    for (const p of Z.cols || []) p.on = on;
    const Wd = W(); if (Z.cells && Z.cells.length) { for (const i of Z.cells) Wd.zblock[i] = on ? 1 : 0; Wd.navDirty = true; if (Wd.fieldCache) Wd.fieldCache.clear(); }
  };
  // deep water (for the Drowner): the zone at a point, and a random spot in one
  HZ.deepAt = (x, z) => HZ.list.find((Z) => Z.type === 'water' && !Z.off && Z.o.depth >= 1.6 && x > Z.x0 && x < Z.x1 && z > Z.z0 && z < Z.z1) || null;
  HZ.hasDeep = () => HZ.list.some((Z) => Z.type === 'water' && !Z.off && Z.o.depth >= 1.6 && Z.w * Z.d >= 12);
  HZ.waterSpot = () => { const l = HZ.list.filter((Z) => Z.type === 'water' && !Z.off && Z.o.depth >= 1.6 && Z.w * Z.d >= 12); if (!l.length) return null; const Z = l[Math.floor(Math.random() * l.length)]; return { x: U.rand(Z.x0 + 0.8, Z.x1 - 0.8), z: U.rand(Z.z0 + 0.8, Z.z1 - 0.8) }; };
  // a zone a set-dressing piece brings with it (barbed wire): the effect only, in play
  HZ.area = (zt, x, z, w, d, o) => { if (SD().editor) return; HZ.spawnZone({ zt, x, z, w, d, inner: true }, { x, z, ry: 0, y: 0 }, o); };
  // a looping arrow texture for conveyors and speed strips
  let arrowT = null;
  function arrowTex() {
    if (!arrowT) { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,200,40,0.9)'; x.beginPath(); x.moveTo(32, 8); x.lineTo(56, 36); x.lineTo(42, 36); x.lineTo(42, 56); x.lineTo(22, 56); x.lineTo(22, 36); x.lineTo(8, 36); x.closePath(); x.fill(); arrowT = new THREE.CanvasTexture(c); arrowT.wrapS = arrowT.wrapT = THREE.RepeatWrapping; }
    const t = arrowT.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData = { transient: true }; return t;
  }

  // ---------------- explosive barrels, fuel and gas (js/kit.js) ----------------
  // b: { x, z, y, group, props, hp, r, dmg, color, fire }
  HZ.addBarrel = (b) => {
    b.live = true; HZ.barrels.push(b);
    for (const p of b.props || []) if (p) p.onShot = (dmg) => { if (!b.live) return; b.hp -= dmg; if (b.hp <= 0) HZ.queue.push([b, 0.05]); else if (Math.random() < 0.4) FX.sparks(new THREE.Vector3(b.x, b.y + 0.6, b.z), new THREE.Vector3(0, 1, 0)); };
  };
  function boom(b) {
    if (!b.live) return; b.live = false;
    if (b.group) b.group.visible = false;
    for (const p of b.props || []) if (p) p.on = false;
    const pos = new THREE.Vector3(b.x, b.y + 0.6, b.z);
    if (XH.weapons && XH.weapons.explode) XH.weapons.explode(pos, b.r, b.dmg, b.color || 0xff6020);
    FX.shake(0.5);
    // fuel keeps burning where it spilled
    if (b.fire) HZ.list.push({ type: 'fire', T: HZ.TYPES.fire, o: { dmg: 16 }, x: b.x, z: b.z, w: 3.5, d: 3.5, x0: b.x - 1.75, x1: b.x + 1.75, z0: b.z - 1.75, z1: b.z + 1.75, y0: b.y, h: 2.5, t: 0, tick: 0, life: 9, fx: 'fire', spots: [[b.x, b.z], [b.x + 0.8, b.z - 0.5], [b.x - 0.6, b.z + 0.7]] });
  }
  // something blew up: barrels in reach go off a moment later (a chain along a row of drums)
  HZ.blast = (pos, r) => { for (const b of HZ.barrels) if (b.live && Math.hypot(b.x - pos.x, b.z - pos.z) < r + 1 && !HZ.queue.some((q) => q[0] === b)) HZ.queue.push([b, 0.18 + Math.random() * 0.15]); };

  // ---------------- screen: under water, in gas, out of breath ----------------
  let tint = null, bar = null;
  function overlay() {
    if (tint) return;
    tint = document.createElement('div'); tint.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .25s';
    bar = document.createElement('div'); bar.style.cssText = 'position:fixed;left:50%;bottom:22%;width:220px;height:8px;margin-left:-110px;border:1px solid rgba(160,220,255,.8);border-radius:4px;pointer-events:none;z-index:6;display:none;background:rgba(0,20,40,.5)';
    bar.innerHTML = '<div style="height:100%;width:100%;background:#8fd8ff;border-radius:3px"></div>';
    document.body.appendChild(tint); document.body.appendChild(bar);
  }
  function setTint(color, op) { overlay(); if (color) tint.style.background = color; tint.style.opacity = op; }

  // ---------------- every frame of play ----------------
  const inside = (Z, x, z, y, pad = 0) => x > Z.x0 - pad && x < Z.x1 + pad && z > Z.z0 - pad && z < Z.z1 + pad && y > Z.y0 - 1.5 && y < Z.y0 + Z.h;
  let breath = 1, radT = 0, tele = 0, launched = 0;
  HZ.reset = () => { HZ.list = []; HZ.barrels = []; HZ.queue = []; breath = 1; radT = 0; if (tint) { tint.style.opacity = 0; bar.style.display = 'none'; } };
  HZ.update = (dt) => {
    const Pl = P(), Gm = XH.game, En = E();
    for (let k = HZ.queue.length - 1; k >= 0; k--) { HZ.queue[k][1] -= dt; if (HZ.queue[k][1] <= 0) { const b = HZ.queue[k][0]; HZ.queue.splice(k, 1); boom(b); } }
    if (!HZ.list.length) { Pl.zone = null; if (tint && tint.style.opacity !== '0') setTint(null, 0); return; }
    const zf = { speed: 1, grip: 1, px: 0, pz: 0, grav: 1, swim: 0 }; let tintC = null, tintO = 0, under = false, anyRad = false, hurt = 0, hurtFire = false;
    const eye = Pl.pos.y + (Pl.eyeH || 1.6), playing = Gm.state === 'playing';
    tele = Math.max(0, tele - dt); launched = Math.max(0, launched - dt);
    // creatures' slowing is worked out afresh every frame from the zones they stand in
    for (const e of En.list) e.zslow = 1;
    for (let zi = HZ.list.length - 1; zi >= 0; zi--) {
      const Z = HZ.list[zi]; Z.t += dt; Z.tick -= dt; const tick = Z.tick <= 0; if (tick) Z.tick = 0.25;
      if (Z.life !== undefined && (Z.life -= dt) <= 0) { HZ.list.splice(zi, 1); continue; }
      if (Z.off) continue;
      animate(Z, dt);
      const o = Z.o, inP = playing && inside(Z, Pl.pos.x, Pl.pos.z, Pl.pos.y);
      // ---- the player
      if (inP) switch (Z.type) {
        case 'kill': Pl.hurt(1e6, null, false, true); break;
        case 'lava': case 'fire': case 'acid': if (tick) { hurt += o.dmg / 4; hurtFire = Z.type !== 'acid'; } if (Z.type === 'acid') zf.speed *= 0.8; break;
        case 'water': { const surf = Z.y0 + o.depth; zf.speed *= 0.62; zf.grav *= 0.3; if (eye < surf) { under = true; zf.swim = 1; } break; }
        case 'shallow': zf.speed *= 0.8; break;
        case 'gas': if (tick) hurt += o.dmg / 4; tintC = 'rgba(80,200,40,1)'; tintO = Math.max(tintO, 0.18); break;
        case 'radiation': anyRad = true; if (tick) hurt += Math.min(o.dmg, 1 + radT * 1.5) / 4; tintC = tintC || 'rgba(200,255,60,1)'; tintO = Math.max(tintO, 0.08 + Math.min(0.15, radT * 0.01)); break;
        case 'electric': if (Z.t % 0.6 < dt) { hurt += o.dmg; FX.bolt(new THREE.Vector3(Pl.pos.x, Z.y0 + 0.05, Pl.pos.z), new THREE.Vector3(Pl.pos.x, Pl.pos.y + 1, Pl.pos.z), 0x9fd8ff, 0.1, 6, 0.3); A.play('arc', { pos: Pl.pos, vol: 0.5 }); } zf.speed *= 0.85; break;
        case 'spikes': if (Z.up && !Z.hitP) { Z.hitP = true; hurt += o.dmg; } break;
        case 'crusher': if (Z.slam && Pl.pos.y < Z.y0 + 2) Pl.hurt(1e6, null, false, false); break;
        case 'flamejet': if (Z.on && tick) { hurt += o.dmg / 4; hurtFire = true; } break;
        case 'laser': if (Z.on && tick && Pl.pos.y < Z.y0 + 2.2) hurt += o.dmg / 2; break;
        case 'saw': if (Math.hypot(Pl.pos.x - Z.bx, Pl.pos.z - Z.bz) < 1.1 && tick) hurt += o.dmg / 2; break;
        case 'mud': zf.speed *= o.slow; break;
        case 'wire': zf.speed *= o.slow; if (tick && (Pl.vel.x * Pl.vel.x + Pl.vel.z * Pl.vel.z) > 0.3) hurt += o.dmg / 4; break;
        case 'quicksand': zf.speed *= o.slow; if (tick) hurt += o.dmg / 4; break;
        case 'ice': zf.grip *= 0.07; break;
        case 'wind': case 'conveyor': if (Z.type === 'wind' || Pl.pos.y < Z.y0 + 0.6) { zf.px += Z.dx * o.force; zf.pz += Z.dz * o.force; } break;
        case 'lowgrav': zf.grav *= o.grav; break;
        case 'speed': zf.speed *= o.mul; break;
        case 'jumppad': if (!launched && Pl.pos.y < Z.y0 + 0.4) { const dir = (o.dir || 0) * Math.PI / 180; Pl.vel.y = o.power; Pl.vel.x += Math.sin(dir) * o.push; Pl.vel.z += Math.cos(dir) * o.push; launched = 0.6; A.play('land', { vol: 1.5 }); FX.ring(new THREE.Vector3(Z.x, Z.y0 + 0.2, Z.z), Math.min(Z.w, Z.d) / 2, 0x40ff90, 0.3); } break;
        case 'teleport': if (!tele) { tele = 1.5; FX.ring(Pl.pos.clone(), 1.5, 0xb060ff, 0.4); Pl.pos.set(o.tx, W().floorAt(o.tx, o.tz), o.tz); Pl.vel.set(0, 0, 0); FX.ring(Pl.pos.clone().setY(Pl.pos.y + 1), 1.5, 0xb060ff, 0.4); A.play('powerup', { vol: 0.6 }); } break;
        case 'heal': if (tick && Pl.hp < Pl.maxHp) Pl.hp = Math.min(Pl.maxHp, Pl.hp + o.rate / 4); break;
        case 'fog': tintC = tintC || 'rgba(0,0,8,1)'; tintO = Math.max(tintO, 0.35 * (o.thick || 0.6)); break;
      }
      if (Z.type === 'mines') for (const m of Z.mines) if (m.live && playing && Math.hypot(Pl.pos.x - m.x, Pl.pos.z - m.z) < 0.7 && Pl.pos.y < Z.y0 + 0.6) mineOff(m, Z);
      // ---- the creatures
      if (!playing) continue;
      for (const e of En.list) {
        if (e.dead || e.state === 'burrowed' || e.def.objective) continue;
        if (e.def.fly) { if (Z.type === 'wind' && e.pos.x > Z.x0 && e.pos.x < Z.x1 && e.pos.z > Z.z0 && e.pos.z < Z.z1) { e.vel.x += Z.dx * Z.o.force * dt * 5; e.vel.z += Z.dz * Z.o.force * dt * 5; if (e.vel.x * Z.dx + e.vel.z * Z.dz > 0) e.zslow = (e.zslow || 1) * 1.4; } continue; }
        if (!inside(Z, e.pos.x, e.pos.z, e.pos.y)) continue;
        const big = e.def.boss, hvy = e.def.heavy, hit = (amt, kind) => En.damage(e, big ? amt * 0.2 : amt, { kind, quiet: true, point: e.center(), weapon: 'trap' });
        switch (Z.type) {
          case 'kill': if (!big) hit(e.hp + 1, 'bullet'); break;
          case 'lava': case 'fire': if (tick) hit(e.maxHp * (hvy ? 0.06 : 0.2), 'fire'); break;
          case 'acid': if (tick) hit(e.maxHp * (hvy ? 0.05 : 0.15), 'acid'); e.zslow = (e.zslow || 1) * 0.8; break;
          case 'water': if (Z.o.depth > 1.8 && tick) hit(e.maxHp * 0.05, 'acid'); e.zslow = (e.zslow || 1) * 0.6; break;
          case 'shallow': e.zslow = (e.zslow || 1) * 0.8; break;
          case 'electric': if (Z.t % 0.6 < dt) { hit(e.maxHp * (hvy ? 0.08 : 0.3), 'arc'); e.stunT = Math.max(e.stunT, 0.3); } break;
          case 'spikes': if (Z.up && !Z.hitE.has(e)) { Z.hitE.add(e); hit(e.maxHp * (hvy ? 0.2 : 0.8), 'bullet'); } break;
          case 'crusher': if (Z.slam && !big) hit(hvy ? e.maxHp * 0.5 : e.hp + 1, 'bullet'); break;
          case 'flamejet': if (Z.on && tick) hit(e.maxHp * (hvy ? 0.06 : 0.25), 'fire'); break;
          case 'laser': if (Z.on && tick) hit(e.maxHp * (hvy ? 0.15 : 0.6), 'arc'); break;
          case 'saw': if (Math.hypot(e.pos.x - Z.bx, e.pos.z - Z.bz) < 1.1 + e.def.radius * 0.5 && tick) { hit(e.maxHp * (hvy ? 0.2 : 0.9), 'bullet'); FX.ichor(e.center(), new THREE.Vector3(0, 1, 0), e.def.ichor, 1); } break;
          case 'mud': e.zslow = (e.zslow || 1) * (e.def.burrow || e.type === 'burrower' ? 1.6 : Z.o.slow); break;
          case 'wire': e.zslow = (e.zslow || 1) * Z.o.slow; if (tick) hit(e.maxHp * (hvy ? 0.01 : 0.04), 'bullet'); break;
          case 'quicksand': e.zslow = (e.zslow || 1) * (e.def.burrow || e.type === 'burrower' ? 1.8 : Z.o.slow); break;
          case 'wind': case 'conveyor': if (!big) { e.vel.x += Z.dx * Z.o.force * dt * 4; e.vel.z += Z.dz * Z.o.force * dt * 4; } break;
        }
        if (Z.type === 'mines') for (const m of Z.mines) if (m.live && Math.hypot(e.pos.x - m.x, e.pos.z - m.z) < 0.8) mineOff(m, Z);
      }
    }
    // the player's zone effects, breath and screen
    Pl.zone = zf.speed !== 1 || zf.grip !== 1 || zf.px || zf.pz || zf.grav !== 1 || zf.swim ? zf : null;
    if (hurt > 0) { Pl.hurt(hurt, null, false, true); if (XH.ui && XH.ui.damage) XH.ui.damage(null, 4); if (hurtFire && Math.random() < 0.5) FX.embers(Pl.pos.clone().setY(Pl.pos.y + 0.3), 4); }
    radT = anyRad ? radT + dt : Math.max(0, radT - dt * 2);
    if (under) {
      breath -= dt / (curWater() || 8);
      if (breath <= 0) { breath = 0; if (Math.random() < dt * 4) Pl.hurt(curWaterDmg() / 4, null, false, true); }
      setTint('rgba(10,60,120,1)', 0.45); overlay(); bar.style.display = 'block'; bar.firstChild.style.width = Math.round(breath * 100) + '%'; bar.firstChild.style.background = breath < 0.3 ? '#ff6060' : '#8fd8ff';
      if (Math.random() < dt * 3) FX.one(Pl.pos.x + U.rand(-0.3, 0.3), eye - 0.2, Pl.pos.z + U.rand(-0.3, 0.3), 0, 1.2, 0, 1.2, 0.08, 0.04, 0xc0e8ff, 0.8, -1, 1, false);
    } else {
      breath = Math.min(1, breath + dt / 2);
      if (bar) { bar.firstChild.style.width = Math.round(breath * 100) + '%'; if (breath >= 1) bar.style.display = 'none'; }
      if (tintC) setTint(tintC, tintO); else if (tint && tint.style.opacity !== '0') setTint(null, 0);
    }
    lastWater = null;
  };
  let lastWater = null;
  const curWater = () => { const Z = HZ.list.find((q) => q.type === 'water' && inside(q, P().pos.x, P().pos.z, P().pos.y)); lastWater = Z; return Z ? Z.o.breath : 8; };
  const curWaterDmg = () => (lastWater ? lastWater.o.dmg : 20);
  function mineOff(m, Z) {
    m.live = false; m.g.visible = false;
    const pos = new THREE.Vector3(m.x, Z.y0 + 0.3, m.z);
    if (XH.weapons && XH.weapons.explode) XH.weapons.explode(pos, 3.5, 1400, 0xff8030);
    FX.shake(0.4);
  }
  // moving parts and particles
  function animate(Z, dt) {
    const o = Z.o, near = (() => { const c = P().cam.position; return Math.abs(c.x - Z.x) + Math.abs(c.z - Z.z) < 60; })();
    switch (Z.type) {
      case 'spikes': { const ev = o.every || 2, ph = Z.t % ev, up = ph < 0.6; if (up && !Z.up) { Z.hitE = new Set(); Z.hitP = false; if (near) A.play('spike', { pos: new THREE.Vector3(Z.x, Z.y0, Z.z), vol: 0.5 }); } Z.up = up; if (Z.spikes) Z.spikes.position.y = (Z.spikes.userData.lifted || 0) + (up ? Math.min(0, -0.95 + ph * 8) : Math.max(-0.95, -(ph - 0.6) * 3)); break; }
      case 'crusher': { const ev = o.every || 2.5, ph = Z.t % ev, drop = ph > ev - 0.35; const y = drop ? Z.pressTop - (ph - (ev - 0.35)) / 0.35 * (Z.pressTop - 0.4) : 0.4 + Math.min(1, ph / (ev - 0.8)) * (Z.pressTop - 0.4); if (Z.press) Z.press.position.y = (Z.press.userData.lifted || 0) + y; Z.slam = drop && ph > ev - 0.08; if (Z.slam && !Z.slammed) { Z.slammed = true; if (near) { A.play('slam', { pos: new THREE.Vector3(Z.x, Z.y0, Z.z) }); FX.shake(0.25); FX.dirt(new THREE.Vector3(Z.x, Z.y0 + 0.1, Z.z), 16); } } if (!drop) Z.slammed = false; if (Z.prop) { Z.prop.y0 = Z.base + y - 0.4; Z.prop.h = Z.base + y + 0.4; } break; }
      case 'flamejet': { const cyc = (o.on || 3) + (o.off || 2); Z.on = Z.t % cyc < (o.on || 3); if (Z.on && near) for (const [sx, sz] of Z.spots) if (Math.random() < 0.6) FX.fire(new THREE.Vector3(sx, Z.y0 + 0.2, sz), new THREE.Vector3(0, 1, 0), 1.2); break; }
      case 'laser': { const cyc = (o.on || 3) + (o.off || 1.5); Z.on = Z.t % cyc < (o.on || 3); if (Z.beams) Z.beams.visible = Z.on && (Z.t % cyc < (o.on || 3) - 0.4 || Math.sin(Z.t * 40) > 0); break; }
      case 'saw': { const k = Math.sin(Z.t * (o.speed || 3) / Math.max(1, Z.len) * 2) * (Z.len / 2 - 0.8); Z.bx = Z.x + (Z.along ? k : 0); Z.bz = Z.z + (Z.along ? 0 : k); if (Z.blade) { Z.blade.position.x = Z.bx; Z.blade.position.z = Z.bz; Z.blade.children[0].rotation.y += dt * 25; } break; }
      case 'conveyor': case 'speed': if (Z.tex) Z.tex.offset.y -= dt * (Z.type === 'speed' ? 1.5 : o.force / 1.2); break;
      case 'barrier': if (Z.field) Z.field.material.opacity = 0.12 + Math.sin(Z.t * 3) * 0.05; break;
      case 'mines': for (const m of Z.mines) if (m.live && m.led) m.led.visible = (Z.t * 1.5 + m.x) % 1 < 0.2; break;
    }
    if (!near || !Z.fx) return;
    const rx = () => U.rand(Z.x0, Z.x1), rz = () => U.rand(Z.z0, Z.z1);
    if (Z.fx === 'embers' && Math.random() < 0.3) FX.embers(new THREE.Vector3(rx(), Z.y0 + 0.2, rz()), 2);
    else if (Z.fx === 'acid' && Math.random() < 0.2) FX.one(rx(), Z.y0 + 0.1, rz(), 0, 0.6, 0, 0.8, 0.2, 0.05, 0x9dff3a, 0.8, 0, 1, false);
    else if (Z.fx === 'fire') { for (const [sx, sz] of Z.spots || []) if (Math.random() < 0.35) FX.fire(new THREE.Vector3(sx + U.rand(-0.4, 0.4), Z.y0 + 0.2, sz + U.rand(-0.4, 0.4)), new THREE.Vector3(0, 1, 0), 0.6); }
    else if (Z.fx === 'gas' && Math.random() < 0.25) FX.one(rx(), Z.y0 + U.rand(0.2, 2.5), rz(), U.rand(-0.2, 0.2), 0.1, U.rand(-0.2, 0.2), 2.5, 1.2, 2.2, 0x70ff50, 0.12, 0, 0.6, false);
    else if (Z.fx === 'rad' && Math.random() < 0.15) FX.one(rx(), Z.y0 + U.rand(0.2, 3), rz(), 0, 0.2, 0, 1.5, 0.1, 0.05, 0xd8ff60, 0.8, 0, 1, false);
    else if (Z.fx === 'arcs' && Math.random() < 0.08) { const x = rx(), z = rz(); FX.bolt(new THREE.Vector3(x, Z.y0 + 0.05, z), new THREE.Vector3(x + U.rand(-1, 1), Z.y0 + U.rand(0.3, 1.2), z + U.rand(-1, 1)), 0x9fd8ff, 0.08, 5, 0.3); }
    else if (Z.fx === 'wind' && Math.random() < 0.5) { const x = rx(), z = rz(); FX.one(x, Z.y0 + U.rand(0.3, 4), z, Z.dx * Z.o.force * 1.6, 0, Z.dz * Z.o.force * 1.6, 1.2, 0.05, 0.03, 0xe8f0ff, 0.5, 0, 1, false); }
    else if (Z.fx === 'float' && Math.random() < 0.2) FX.one(rx(), Z.y0 + 0.2, rz(), 0, 0.8, 0, 3, 0.08, 0.04, 0xc0a0ff, 0.7, 0, 1, false);
    else if (Z.fx === 'swirl' && Math.random() < 0.4) { const an = Math.random() * 6.28, r = Math.min(Z.w, Z.d) * 0.4; FX.one(Z.x + Math.cos(an) * r, Z.y0 + 0.2, Z.z + Math.sin(an) * r, -Math.cos(an), 2, -Math.sin(an), 1, 0.12, 0.04, 0xc080ff, 0.9, 0, 1, false); }
    else if (Z.fx === 'heal' && Math.random() < 0.15) FX.one(rx(), Z.y0 + 0.2, rz(), 0, 1, 0, 1.5, 0.15, 0.05, 0x60ff90, 0.8, 0, 1, false);
  }
})();
