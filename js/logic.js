'use strict';
// Map logic made in the map editor:
//  - Triggers ('@trigger'): WHEN something happens (the player walks into an area, presses a button, pulls a lever,
//    shoots a target, a round starts, enough kills, the power comes on, the game starts, a creature walks in) THEN do
//    things (open a door, switch a zone / trap / moving piece / trigger on or off, spawn creatures or a boss, show a
//    message, play a sound, power on or off, give points, teleport the player, an explosion, shake, fire another
//    trigger, win). Pieces are found by the name ("tag") given to them in the editor.
//  - Markers ('@marker'): named points, extra creature spawn points and boss spawn points.
//  - Moving and breakable pieces of the kit: blast doors, elevators, moving platforms, extending bridges, breakable and
//    secret walls; mounted guns you man with E; ziplines. And the Drowner, a creature that lives in deep water.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, SD = XH.setdress, L = SD.lib;
  const W = () => XH.world, P = () => XH.player, E = () => XH.enemies, G = () => XH.game, UI = () => XH.ui;
  const LG = XH.logic = { triggers: [], movers: [], markers: [], tags: new Map(), pending: [], mounted: null };
  const ed = () => SD.editor;

  // ---------------- what a trigger can listen for and do (the editor lists these) ----------------
  LG.WHEN = {
    enter: { label: 'The player walks into the area', area: true },
    creature: { label: 'A creature walks into the area', area: true },
    button: { label: 'The player presses a button (E)', use: true },
    lever: { label: 'The player pulls a lever (E)', use: true },
    shoot: { label: 'A target is shot' },
    round: { label: 'Round N starts', round: true },
    kills: { label: 'N creatures killed', count: true },
    power: { label: 'The power comes on' },
    start: { label: 'The game starts' },
  };
  LG.DO = {
    open: { label: 'Open a door / piece', target: true, doors: true },
    close: { label: 'Close / stop a piece', target: true },
    on: { label: 'Switch on', target: true },
    off: { label: 'Switch off', target: true },
    toggle: { label: 'Switch over', target: true },
    spawn: { label: 'Spawn creatures', creature: true, n: 4, at: true },
    boss: { label: 'Spawn a boss', boss: true, at: true },
    message: { label: 'Show a message', text: true },
    sound: { label: 'Play a sound', sound: true },
    power: { label: 'Power on' },
    blackout: { label: 'Power off' },
    points: { label: 'Give points', n: 1000 },
    teleport: { label: 'Teleport the player', at: true },
    explode: { label: 'Explosion', at: true, n: 4 },
    shake: { label: 'Shake the screen', n: 5 },
    fire: { label: 'Fire another trigger', target: true },
    win: { label: 'Win the map', text: true },
  };
  LG.SOUNDS = ['screech', 'explosion', 'roar', 'power', 'door', 'slam', 'wail', 'shriek', 'powerup', 'perk', 'rankup', 'buy', 'deny', 'nuke', 'singularity', 'heart', 'hatch', 'membrane'];
  LG.CREATURES = () => Object.keys(E().TYPES).filter((k) => !E().TYPES[k].boss && !E().TYPES[k].minor && !E().TYPES[k].objective);
  LG.BOSSES = () => Object.keys(E().TYPES).filter((k) => E().TYPES[k].boss && !E().TYPES[k].objective);

  LG.reset = () => {
    if (LG.mounted) dismount();
    LG.triggers = []; LG.movers = []; LG.markers = []; LG.tags = new Map(); LG.pending = []; LG.t = 0; LG.started = false; LG.powerWas = null;
    if (heatBar) heatBar.style.display = 'none';
  };
  LG.tagZone = (name, Z) => tagIt(name, { kind: 'zone', Z }); LG.tagTrap = (name, T) => tagIt(name, { kind: 'trap', T });
  const tagIt = (name, obj) => { if (!name) return; let l = LG.tags.get(name); if (!l) LG.tags.set(name, (l = [])); l.push(obj); };
  LG.byTag = (name) => (name ? LG.tags.get(name) || [] : []);

  // plain materials for the parts that move (the merged ones use vertex colours)
  const mats = {};
  const mat = (color, o = {}) => { const k = color + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.5 }, o))); };
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), sph = new THREE.SphereGeometry(1, 12, 8);
  function mesh(parent, geo, m, p, s, r) { const o = new THREE.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (s) o.scale.set(s[0], s[1], s[2]); if (r) o.rotation.set(r[0], r[1], r[2]); parent.add(o); return o; }
  // a group standing on the floor at the entity (lifted onto raised ground, turned like the entity)
  function standGroup(a) { const g = new THREE.Group(); g.position.set(a.x, (a.y || 0) + W().dispAt(a.x, a.z), a.z); g.rotation.y = a.ry || 0; g.userData.lifted = true; SD.root().add(g); return g; }
  const wp = (a, ox, oz) => L.wpos(a, ox, oz);
  // a collider for a piece that moves or goes away: world numbers (the world lifts it onto raised ground itself)
  const addCol = (x, z, hx, hz, h, o) => W().addProp(x, z, hx, hz, h, o);
  // is the player standing on this collider
  const onCol = (c) => { const p = P().pos; return !P().airborne && p.x > c.x0 - 0.3 && p.x < c.x1 + 0.3 && p.z > c.z0 - 0.3 && p.z < c.z1 + 0.3 && Math.abs(p.y - c.h) < 0.15; };
  // cells under a rectangle: blocked for pathing (closed doors, walls) or open again
  function cellsOf(a, w, d) {
    const Wd = W(), out = [];
    for (let t = -w / 2 + 0.3; t <= w / 2 - 0.3 + 1e-6; t += 0.6) for (let s = -d / 2 + 0.2; s <= d / 2 - 0.2 + 1e-6; s += 0.4) {
      const [x, z] = wp(a, t, s), cx = Wd.cellX(x), cz = Wd.cellZ(z);
      if (Wd.inside(cx, cz)) { const i = cz * Wd.w + cx; if (!out.includes(i) && Wd.solid[i] === 0) out.push(i); }
    }
    return out;
  }
  function blockCells(cells, on) {
    const Wd = W(); if (!cells.length) return;
    for (const i of cells) { if (on) { Wd.solid[i] = 2; Wd.soft[i] = 1; Wd.hgt[i] = 0; } else { Wd.solid[i] = 0; Wd.soft[i] = 0; } }
    Wd.navDirty = true; if (Wd.fieldCache) Wd.fieldCache.clear(); Wd.updateZones();
  }

  // ======================================================================
  //  Triggers
  // ======================================================================
  LG.spawnTrigger = (e, a, o) => {
    const when = o.when || 'enter', Wd = W(), x = e.x, z = e.z, w = e.w || 2.5, d = e.d || 2.5;
    let g = null, lamp = null, prop = null;
    if (when === 'button' || when === 'lever' || when === 'shoot') {
      g = standGroup(a);
      if (when === 'button') {
        mesh(g, box, mat(0x2a2e33), [0, 0.55, 0], [0.5, 1.1, 0.35]); mesh(g, box, mat(0x3a4048), [0, 1.2, 0], [0.62, 0.3, 0.42]);
        lamp = mesh(g, cyl, new THREE.MeshBasicMaterial({ color: o.color || 0xff3020 }), [0, 1.2, 0.22], [0.13, 0.06, 0.13], [Math.PI / 2, 0, 0]);
        mesh(g, box, mat(0xd8a020), [0, 1.37, 0], [0.64, 0.04, 0.44]);
      } else if (when === 'lever') {
        mesh(g, cyl, mat(0x303438), [0, 0.6, 0], [0.07, 1.2, 0.07]); mesh(g, box, mat(0x2a2e33), [0, 1.3, 0], [0.5, 0.5, 0.2]);
        const h = new THREE.Group(); h.position.set(0, 1.3, 0.12); g.add(h); mesh(h, box, mat(0x202020), [0, 0.2, 0], [0.06, 0.4, 0.06]); h.rotation.x = -0.6; g.userData.handle = h;
        lamp = mesh(g, sph, new THREE.MeshBasicMaterial({ color: 0x30ff60 }), [0.16, 1.45, 0.11], [0.05, 0.05, 0.05]);
      } else {
        mesh(g, cyl, mat(0x4a4e52), [0, 0.8, 0], [0.05, 1.6, 0.05]);
        for (const [r, c] of [[0.42, 0xe8e8e0], [0.32, 0xc02020], [0.2, 0xe8e8e0], [0.1, 0xc02020]]) mesh(g, cyl, mat(c, { metalness: 0.1 }), [0, 1.75, 0.02 + (0.42 - r) * 0.05], [r, 0.03, r], [Math.PI / 2, 0, 0]);
        lamp = mesh(g, sph, new THREE.MeshBasicMaterial({ color: 0xffd040 }), [0, 2.25, 0], [0.06, 0.06, 0.06]);
      }
      if (!ed() && o.label !== '') { const sign = XH.sys.label ? XH.sys.label((o.label || (when === 'shoot' ? 'SHOOT' : when === 'lever' ? 'LEVER' : 'BUTTON')).toUpperCase(), '#ffd860', 1.0, 0.24) : null; if (sign) { sign.position.set(0, when === 'shoot' ? 2.55 : 1.8, 0); g.add(sign); } }
    }
    if (ed()) { if (g) g.userData.lever = false; return; }
    if (g) { g.userData.noCull = true; prop = when === 'shoot' ? addCol(x, z, 0.45, 0.45, 2.2, { bullets: true, mount: false }) : addCol(x, z, 0.3, 0.25, 1.4, { mount: false }); }
    const T = { e, tag: e.tag, when, o, x, z, hx: w / 2, hz: d / 2, y0: Wd.floorAt(x, z), acts: e.acts || [], armed: !o.off, fired: 0, cd: 0, g, lamp, prop, inside: false };
    if (prop && when === 'shoot') prop.onShot = () => fire(T);
    tagIt(e.tag, { kind: 'trigger', T });
    LG.triggers.push(T);
  };
  const inArea = (T, p, dy = 3) => Math.abs(p.x - T.x) < T.hx && Math.abs(p.z - T.z) < T.hz && p.y > T.y0 - 1 && p.y < T.y0 + dy;
  function fire(T) {
    if (!T.armed || T.cd > 0 || G().state !== 'playing') return false;
    if (T.o.once !== false && T.fired) return false;
    T.fired++; T.cd = Math.max(0.3, +T.o.every || 1.5);
    if (T.lamp) T.lamp.material.color.setHex(T.o.once !== false ? 0x404040 : 0xff3020);
    if (T.g && T.g.userData.handle) T.g.userData.handle.rotation.x = 0.6;
    if (T.when === 'shoot' && T.g) FX.sparks(new THREE.Vector3(T.x, T.y0 + 1.75, T.z), new THREE.Vector3(0, 0, 1));
    LG.pending.push({ t: +T.o.delay || 0, T });
    return true;
  }
  function run(T) { for (const act of T.acts) { if (+act.delay > 0) LG.pending.push({ t: +act.delay, act, T }); else doAct(act, T); } }
  const posOf = (T, tag) => { const m = tag && LG.byTag(tag).find((q) => q.pos); return m ? m.pos.clone() : new THREE.Vector3(T.x, T.y0, T.z); };
  const spotsOf = (T, tag) => { const l = tag ? LG.byTag(tag).filter((q) => q.pos).map((q) => q.pos) : []; return l.length ? l : [new THREE.Vector3(T.x, T.y0, T.z)]; };
  // switch a named piece: zones, traps, moving pieces, triggers
  function setOn(q, on) {
    if (q.kind === 'zone') { if (XH.hazards.setZone) XH.hazards.setZone(q.Z, on); }
    else if (q.kind === 'trap') { if (on && XH.traps.activateFree) XH.traps.activateFree(q.T); else if (!on && XH.traps.stop) XH.traps.stop(q.T); }
    else if (q.kind === 'mover') q.M.set(on);
    else if (q.kind === 'trigger') { q.T.armed = on; if (on) q.T.fired = 0; }
  }
  const isOn = (q) => (q.kind === 'zone' ? !q.Z.off : q.kind === 'trap' ? q.T.state === 'active' : q.kind === 'mover' ? q.M.on : q.kind === 'trigger' ? q.T.armed : false);
  function doAct(act, T) {
    const Wd = W(), Pl = P();
    switch (act.a) {
      case 'open': if (act.t && Wd.doors[act.t]) { Wd.openDoor(act.t); break; } for (const q of LG.byTag(act.t)) setOn(q, true); break;
      case 'close': for (const q of LG.byTag(act.t)) setOn(q, false); break;
      case 'on': for (const q of LG.byTag(act.t)) setOn(q, true); break;
      case 'off': for (const q of LG.byTag(act.t)) setOn(q, false); break;
      case 'toggle': for (const q of LG.byTag(act.t)) setOn(q, !isOn(q)); break;
      case 'spawn': {
        const n = Math.max(1, Math.min(60, Math.round(+act.n || 4))), types = LG.CREATURES(), type = types.includes(act.type) ? act.type : 'skitterling', pts = spotsOf(T, act.at);
        for (let k = 0; k < n; k++) { const p = pts[k % pts.length]; E().spawn(type, p.x + U.rand(-1.2, 1.2), p.z + U.rand(-1.2, 1.2), {}); }
        break;
      }
      case 'boss': {
        const bosses = LG.BOSSES(), type = bosses.includes(act.type) ? act.type : XH.bosses ? XH.bosses.pick(Wd.def.id) : 'tyrant', p = posOf(T, act.at);
        E().spawn(type, p.x, p.z, {}); if (UI().bossBar) UI().bossBar(true, (E().TYPES[type] || {}).name ? E().TYPES[type].name.toUpperCase() : 'BOSS'); A.play('roar', { vol: 1.2 });
        break;
      }
      case 'message': UI().banner(act.text || '', act.sub || '', act.color || '#ffd860'); break;
      case 'sound': A.play(LG.SOUNDS.includes(act.sound) ? act.sound : 'screech', { vol: 1 }); break;
      case 'power': if (!Wd.power) { Wd.setPower(true); A.play('power'); UI().banner('POWER RESTORED', 'Lights, motion tracker, sentry guns, perks and the Forge are online', '#ffe060'); FX.shake(0.4); } break;
      case 'blackout': if (Wd.power) { Wd.setPower(false); A.play('power', { vol: 0.8 }); FX.shake(0.3); } break;
      case 'points': G().addPoints(Math.round(+act.n || 1000), true); break;
      case 'teleport': { const p = posOf(T, act.at); FX.ring(Pl.pos.clone(), 1.5, 0xb060ff, 0.4); Pl.pos.set(p.x, Wd.floorAt(p.x, p.z), p.z); Pl.vel.set(0, 0, 0); A.play('powerup', { vol: 0.6 }); break; }
      case 'explode': { const p = posOf(T, act.at); XH.weapons.explode(p.setY(p.y + 0.6), Math.max(1, +act.n || 4), 1200); break; }
      case 'shake': FX.shake(Math.min(1, (+act.n || 5) / 10)); break;
      case 'fire': for (const q of LG.byTag(act.t)) if (q.kind === 'trigger') run(q.T); break;
      case 'win': G().win(act.text || 'AREA SECURED', act.sub || 'Evac inbound. You made it.', true); break;
    }
  }
  LG.run = run; LG.doAct = doAct;

  // ======================================================================
  //  Markers
  // ======================================================================
  LG.MARKERS = { point: { label: 'Named point', color: 0x60c0ff }, spawn: { label: 'Creature spawn point', color: 0xff4040 }, boss: { label: 'Boss spawn point', color: 0xd060ff } };
  LG.spawnMarker = (e, a, o) => {
    const kind = o.kind || 'point', K = LG.MARKERS[kind] || LG.MARKERS.point;
    if (ed()) {
      const g = standGroup(a);
      mesh(g, cyl, mat(K.color, { metalness: 0.2 }), [0, 0.9, 0], [0.05, 1.8, 0.05]);
      mesh(g, box, new THREE.MeshBasicMaterial({ color: K.color }), [0.25, 1.62, 0], [0.5, 0.32, 0.03]);
      mesh(g, cyl, new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: 0.35 }), [0, 0.02, 0], [0.7, 0.02, 0.7]);
      return;
    }
    const Wd = W(), pos = new THREE.Vector3(e.x, Wd.floorAt(e.x, e.z), e.z), m = { kind, pos, tag: e.tag };
    LG.markers.push(m); tagIt(e.tag, { kind: 'marker', pos });
    if (kind === 'spawn') { const cx = Wd.cellX(e.x), cz = Wd.cellZ(e.z); Wd.spawns.push({ x: e.x, z: e.z, cx, cz, active: false, y: 0, slats: 0, maxSlats: 0, slatMeshes: [], marker: true }); }
  };
  LG.bossSpot = () => { const l = LG.markers.filter((m) => m.kind === 'boss'); if (!l.length) return null; const m = U.pick(l); return { x: m.pos.x, z: m.pos.z, active: true }; };

  // ======================================================================
  //  Moving and breakable pieces (kit pieces: SD.kit, built into a group of their own)
  // ======================================================================
  const K = (name, label, def, fn, extra = {}) => SD.kit(name, (a, o0, e) => { const o = Object.assign({}, def, o0); return fn(a, o, e || {}); }, Object.assign({ cat: 'Moving and breakable', label, def, opts: Object.keys(def), solo: true }, extra));
  const addMover = (e, M) => { M.tag = e.tag; LG.movers.push(M); tagIt(e.tag, { kind: 'mover', M }); return M; };
  const part = L.part, G0 = () => SD.G(), Mm = L.M;
  const bx = (a, m, x, y, z, sx, sy, sz, c, r) => part(a, m, G0().box, [x, y, z], [sx, sy, sz], c, r);
  const sol = (a, ox, oz, w, d, h, o = {}) => L.solid(a, ox, oz, w, d, h + (a.y || 0), Object.assign({}, o, { y0: (o.y0 || 0) + (a.y || 0) }));

  // ---- blast door: two slabs that slide apart
  K('blastDoor', 'Blast door (opens by trigger or button)', { w: 5, h: 3.5, open: false, button: false, cost: 0, color: 0x5a6068 }, (a, o, e) => {
    const w = o.w, h = o.h;
    for (const s of [-1, 1]) bx(a, Mm.metal, s * (w / 2 + 0.3), h / 2 + 0.2, 0, 0.6, h + 0.4, 0.7, 0x2a2e33);
    bx(a, Mm.metal, 0, h + 0.3, 0, w + 1.2, 0.6, 0.7, 0x2a2e33); bx(a, Mm.paint, 0, h + 0.05, 0.36, w, 0.1, 0.02, 0xd8a020);
    for (const s of [-1, 1]) L.solid(a, s * (w / 2 + 0.3), 0, 0.6, 0.7, h + 0.4 + (a.y || 0), { y0: a.y || 0 });
    const g = standGroup(a), slabs = [];
    for (const s of [-1, 1]) {
      const sl = new THREE.Group(); g.add(sl); slabs.push(sl);
      mesh(sl, box, mat(o.color), [s * w / 4, h / 2, 0], [w / 2, h, 0.35]);
      for (let k = 0; k < 4; k++) mesh(sl, box, mat(0xd8a020, { metalness: 0.2 }), [s * w / 4, 0.4 + k * 0.4, 0.18], [w / 2 * 0.9, 0.12, 0.01], [0, 0, s * 0.5]);
      mesh(sl, box, mat(0x1a1c1e), [s * 0.02, h / 2, 0], [0.04, h, 0.37]);
    }
    if (o.button) for (const s of [-1, 1]) { const [px, pz] = [w / 2 + 0.9, s * 0.8]; mesh(g, box, mat(0x2a2e33), [px, 1.1, pz], [0.3, 0.45, 0.2]); mesh(g, cyl, new THREE.MeshBasicMaterial({ color: 0xff3020 }), [px, 1.15, pz + s * 0.11], [0.07, 0.04, 0.07], [Math.PI / 2, 0, 0]); }
    if (ed()) { if (o.open) for (const [k, sl] of slabs.entries()) sl.position.x = (k ? 1 : -1) * w / 2 * 0.95; return; }
    g.userData.noCull = true;
    const [cx, cz] = [a.x, a.z], c = Math.abs(Math.cos(a.ry || 0)) > 0.7, col = addCol(cx, cz, c ? w / 2 : 0.2, c ? 0.2 : w / 2, h + (a.y || 0), { y0: a.y || 0, mount: false });
    const cells = cellsOf(a, w, 0.4);
    const M = addMover(e, { kind: 'door', on: !!o.open, s: o.open ? 1 : 0, g, update(dt) {
      const want = M.on ? 1 : 0; if (M.s === want) return;
      M.s = U.clamp(M.s + Math.sign(want - M.s) * dt / 1.4, 0, 1);
      slabs[0].position.x = -U.smooth(M.s) * w / 2 * 0.95; slabs[1].position.x = U.smooth(M.s) * w / 2 * 0.95;
      if (M.s === want) { col.on = !M.on; blockCells(cells, !M.on); }
    }, set(on) { if (M.on === on) return; M.on = on; A.play('door', { pos: new THREE.Vector3(cx, 1, cz) }); FX.shake(0.15); if (on) { col.on = true; } else { col.on = true; blockCells(cells, true); } } });
    col.on = !M.on; if (!M.on) blockCells(cells, true);
    if (o.open) { slabs[0].position.x = -w / 2 * 0.95; slabs[1].position.x = w / 2 * 0.95; }
    if (o.button) M.use = { pos: new THREE.Vector3(cx, 0, cz), r: w / 2 + 1.6, cost: +o.cost || 0, text: () => (M.on ? 'Close the blast door' : 'Open the blast door'), act: () => M.set(!M.on) };
  }, { note: 'Give it a name and open or close it with a trigger, or tick button to put an E button beside it (cost: points).' });

  // ---- elevator: a platform that rises when you stand on it
  K('elevator', 'Elevator', { w: 3, d: 3, h: 4, auto: true }, (a, o, e) => {
    const w = o.w, d = o.d, h = o.h;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { bx(a, Mm.metal, sx * (w / 2 + 0.12), h / 2 + 0.6, sz * (d / 2 + 0.12), 0.18, h + 1.2, 0.18, 0xd8a020); L.solid(a, sx * (w / 2 + 0.12), sz * (d / 2 + 0.12), 0.2, 0.2, h + 1.2 + (a.y || 0), { y0: a.y || 0, mount: false }); }
    bx(a, Mm.metal, 0, h + 1.25, 0, w + 0.5, 0.1, 0.2, 0xd8a020);
    const g = standGroup(a), plat = new THREE.Group(); g.add(plat);
    mesh(plat, box, mat(0x4a5058), [0, -0.08, 0], [w, 0.16, d]); for (let k = -2; k <= 2; k++) mesh(plat, box, mat(0xd8a020, { metalness: 0.2 }), [k * w / 5, 0.005, 0], [0.06, 0.01, d * 0.9]);
    const lamp = mesh(plat, sph, new THREE.MeshBasicMaterial({ color: 0x40ff60 }), [w / 2 - 0.2, 0.15, d / 2 - 0.2], [0.07, 0.07, 0.07]);
    plat.position.y = 0.16;
    if (ed()) return;
    g.userData.noCull = true;
    const base = (a.y || 0), col = addCol(a.x, a.z, w / 2, d / 2, base + 0.16, { y0: base - 0.2 }), lift = col.y0 - (base - 0.2);
    let wait = 0;
    const M = addMover(e, { kind: 'elevator', on: false, s: 0, g, update(dt) {
      const Pl = P(), onIt = onCol(col);
      if (o.auto) { if (onIt) { wait += dt; if (wait > 0.5 && !M.on) M.set(true); } else if (M.on && M.s >= 1) { wait -= dt; if (wait < -3) M.set(false); } else if (!onIt) wait = Math.min(wait, 0); }
      const want = M.on ? 1 : 0; if (M.s === want) return;
      const prevY = M.y || 0; M.s = U.clamp(M.s + Math.sign(want - M.s) * dt / Math.max(1.5, h / 2.2), 0, 1);
      M.y = U.smooth(M.s) * h; plat.position.y = 0.16 + M.y;
      col.h = lift + base + 0.16 + M.y; col.y0 = col.h - 0.36;
      if (onIt && M.y < prevY) Pl.pos.y = Math.max(Pl.pos.y + (M.y - prevY), col.h); // ride it down
      lamp.material.color.setHex(M.s === want ? 0x40ff60 : 0xffb020);
    }, set(on) { if (M.on === on) return; M.on = on; wait = 0; A.play('build', { pos: new THREE.Vector3(a.x, 1, a.z), vol: 0.6 }); } });
  }, { note: 'Rises when you stand on it for half a second and comes back down 3 s after you step off (auto). With a name, triggers can send it up or down.' });

  // ---- moving platform: back and forth between here and its other end (the round handle)
  K('movingPlatform', 'Moving platform', { w: 3, d: 3, h: 1.5, speed: 2.5, pause: 1.5, running: true }, (a, o, e) => {
    const w = o.w, d = o.d, h = o.h, x0 = a.x, z0 = a.z, x1 = e.lx !== undefined ? e.lx : a.x + 8, z1 = e.lz !== undefined ? e.lz : a.z;
    const g = new THREE.Group(); g.position.set(x0, (a.y || 0) + W().dispAt(x0, z0) + h, z0); g.userData.lifted = true; SD.root().add(g);
    mesh(g, box, mat(0x4a5058), [0, -0.12, 0], [w, 0.24, d]); mesh(g, box, mat(0xd8a020, { metalness: 0.2 }), [0, 0.005, 0], [w * 0.96, 0.01, 0.12]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(g, sph, new THREE.MeshBasicMaterial({ color: 0x60c0ff }), [sx * (w / 2 - 0.15), 0.06, sz * (d / 2 - 0.15)], [0.06, 0.06, 0.06]);
    if (ed()) return;
    g.userData.noCull = true;
    const len = Math.hypot(x1 - x0, z1 - z0), base = (a.y || 0), y0 = W().dispAt(x0, z0);
    // registered over its whole run, then shrunk to where the platform is
    const col = addCol((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2 + w / 2, Math.abs(z1 - z0) / 2 + d / 2, base + h, { y0: base + h - 0.25 });
    const lift = col.h - (base + h);
    let s = 0, dir = 1, hold = 0;
    const M = addMover(e, { kind: 'platform', on: !!o.running, g, update(dt) {
      if (!M.on || len < 0.5) return;
      if (hold > 0) { hold -= dt; return; }
      const px = g.position.x, pz = g.position.z;
      s += dir * dt * (+o.speed || 2.5) / len; if (s >= 1 || s <= 0) { s = U.clamp(s, 0, 1); dir = -dir; hold = +o.pause || 0; }
      const k = U.smooth(s), nx = x0 + (x1 - x0) * k, nz = z0 + (z1 - z0) * k;
      g.position.x = nx; g.position.z = nz; g.position.y = base + y0 + h;
      col.x0 = nx - w / 2; col.x1 = nx + w / 2; col.z0 = nz - d / 2; col.z1 = nz + d / 2;
      // whoever stands on it rides along
      const Pl = P(); if (onCol(col)) { Pl.pos.x += nx - px; Pl.pos.z += nz - pz; }
    }, set(on) { M.on = on; } });
    col.x0 = x0 - w / 2; col.x1 = x0 + w / 2; col.z0 = z0 - d / 2; col.z1 = z0 + d / 2; void lift;
  }, { handle: { dx: 8, label: 'end' }, note: 'Drag the round handle to where it goes; it runs back and forth, carrying you. h: how high above the floor.' });

  // ---- extending bridge: a deck that slides out across a gap (lava, a pit)
  K('extendBridge', 'Extending bridge', { len: 7.5, w: 2.5, h: 0.45, extended: false, button: true, cost: 0 }, (a, o, e) => {
    const len = o.len, w = o.w, h = o.h;
    bx(a, Mm.metal, -len / 2 - 0.5, h / 2, 0, 1, h + 0.1, w + 0.4, 0x2a2e33); L.solid(a, -len / 2 - 0.5, 0, 1, w + 0.4, h + 0.1 + (a.y || 0), { y0: a.y || 0 });
    const g = standGroup(a), deck = new THREE.Group(); g.add(deck);
    mesh(deck, box, mat(0x5a6068), [len / 2, h - 0.1, 0], [len, 0.2, w]);
    for (const s of [-1, 1]) mesh(deck, box, mat(0xd8a020, { metalness: 0.2 }), [len / 2, h + 0.35, s * (w / 2 - 0.05)], [len, 0.06, 0.06]);
    for (let k = 0; k < Math.round(len / 1.5); k++) for (const s of [-1, 1]) mesh(deck, box, mat(0xd8a020, { metalness: 0.2 }), [0.4 + k * 1.5, h + 0.18, s * (w / 2 - 0.05)], [0.05, 0.36, 0.05]);
    deck.position.x = -len / 2;
    if (o.button) mesh(g, box, mat(0x2a2e33), [-len / 2 - 0.5, h + 0.7, w / 2 - 0.2], [0.3, 0.4, 0.2]);
    const setK = (k) => { deck.scale.x = Math.max(0.02, k); };
    if (ed()) { setK(o.extended ? 1 : 0.15); return; }
    g.userData.noCull = true;
    const base = (a.y || 0), [cx, cz] = wp(a, 0, 0), c = Math.abs(Math.cos(a.ry || 0)) > 0.7;
    const col = addCol(cx, cz, c ? len / 2 : w / 2, c ? w / 2 : len / 2, base + h, { y0: base + h - 0.3 });
    const M = addMover(e, { kind: 'bridge', on: !!o.extended, s: o.extended ? 1 : 0, g, update(dt) {
      const want = M.on ? 1 : 0; if (M.s === want) return;
      M.s = U.clamp(M.s + Math.sign(want - M.s) * dt / 2, 0, 1); setK(U.smooth(M.s)); col.on = M.s > 0.98;
    }, set(on) { if (M.on === on) return; M.on = on; A.play('build', { pos: new THREE.Vector3(cx, 1, cz), vol: 0.7 }); if (!on) col.on = false; } });
    setK(M.s); col.on = M.on;
    if (o.button) { const [ux, uz] = wp(a, -len / 2 - 0.5, 0); M.use = { pos: new THREE.Vector3(ux, 0, uz), r: 1.8, cost: +o.cost || 0, text: () => (M.on ? 'Retract the bridge' : 'Extend the bridge'), act: () => M.set(!M.on) }; }
  }, { note: 'The deck slides out across a gap. Put a lava or kill zone under it; the deck is above the zone, so crossing it is safe.' });

  // ---- breakable wall: shoot it enough or blow it up and it comes down
  K('breakWall', 'Breakable wall', { len: 5, h: 3, hp: 1500, color: 0x8c8a84 }, (a, o, e) => {
    const len = o.len, h = o.h, g = standGroup(a);
    const wall = mesh(g, box, mat(o.color, { roughness: 0.95, metalness: 0 }), [0, h / 2, 0], [len, h, 0.35]);
    for (let k = 0; k < 7; k++) mesh(g, box, mat(0x2a2826, { roughness: 1, metalness: 0 }), [(Math.random() - 0.5) * len * 0.8, 0.3 + Math.random() * (h - 0.6), 0.18], [0.6 + Math.random(), 0.03, 0.01], [0, 0, (Math.random() - 0.5) * 2]);
    mesh(g, box, mat(0xd8a020, { metalness: 0.1 }), [0, h * 0.5, 0.18], [len * 0.3, 0.14, 0.01], [0, 0, 0.3]);
    void wall;
    if (ed()) return;
    g.userData.noCull = true;
    const [cx, cz] = [a.x, a.z], c = Math.abs(Math.cos(a.ry || 0)) > 0.7, col = addCol(cx, cz, c ? len / 2 : 0.2, c ? 0.2 : len / 2, h + (a.y || 0), { y0: a.y || 0 });
    const cells = cellsOf(a, len, 0.35); blockCells(cells, true);
    const M = addMover(e, { kind: 'wall', on: true, hp: +o.hp || 1500, g, pos: new THREE.Vector3(cx, h / 2, cz), update() {}, set(on) { if (!on && M.on) M.hurt(1e9); }, hurt(dmg) {
      if (!M.on) return; M.hp -= dmg; if (Math.random() < 0.3) FX.dirt(M.pos.clone().setY(W().floorAt(cx, cz) + 1), 6);
      if (M.hp > 0) return;
      M.on = false; g.visible = false; col.on = false; blockCells(cells, false);
      const p = new THREE.Vector3(cx, W().floorAt(cx, cz) + 1, cz); FX.dirt(p, 60); FX.burst({ pos: p, n: 40, color: 0x8a8a84, speed: [2, 7], up: 3, life: [0.6, 1.4], size: [0.4, 0.1], grav: 14, add: false }); FX.shake(0.5); A.play('slam', { pos: p }); A.play('explosion', { pos: p, size: 0.6 });
    } });
    col.onShot = (dmg) => M.hurt(dmg * 0.25);
  }, { note: 'hp: how much it takes. Explosions do full damage, bullets a quarter. Creatures walk around it until it falls.' });

  // ---- secret wall: looks like the map's own wall and opens when found
  K('secretWall', 'Secret wall', { len: 2.5, h: 3, open: 'use' }, (a, o, e) => {
    const len = o.len, h = o.h, g = standGroup(a), MAT = SD.MAT() || {};
    const m = MAT.wall ? (() => { const c = MAT.wall.clone(); c.vertexColors = false; return c; })() : mat(0x6a6a66, { roughness: 0.95, metalness: 0 });
    const slab = new THREE.Mesh(box, m); slab.scale.set(len, h, 0.5); slab.position.y = h / 2; g.add(slab);
    if (ed()) { mesh(g, box, new THREE.MeshBasicMaterial({ color: 0xff70d0, transparent: true, opacity: 0.25, depthWrite: false }), [0, h / 2, 0], [len + 0.04, h + 0.04, 0.54]); return; }
    g.userData.noCull = true;
    const [cx, cz] = [a.x, a.z], c = Math.abs(Math.cos(a.ry || 0)) > 0.7, col = addCol(cx, cz, c ? len / 2 : 0.25, c ? 0.25 : len / 2, h + (a.y || 0), { y0: a.y || 0 });
    const cells = cellsOf(a, len, 0.5); blockCells(cells, true);
    const M = addMover(e, { kind: 'secret', on: false, s: 0, g, update(dt) { if (!M.on || M.s >= 1) return; M.s = Math.min(1, M.s + dt / 1.6); slab.position.y = h / 2 - U.smooth(M.s) * (h + 0.1); if (M.s >= 1) g.visible = false; },
      set(on) { if (!on || M.on) return; M.on = true; col.on = false; blockCells(cells, false); A.play('door', { pos: new THREE.Vector3(cx, 1, cz) }); FX.dirt(new THREE.Vector3(cx, W().floorAt(cx, cz) + 0.2, cz), 30); FX.shake(0.25); if (UI().banner) UI().banner('SECRET FOUND', '', '#d0a0ff'); } });
    if (o.open === 'shoot') col.onShot = () => M.set(true);
    if (o.open === 'use') M.use = { pos: new THREE.Vector3(cx, 0, cz), r: 1.7, cost: 0, text: () => 'Push the loose wall', act: () => M.set(true), hidden: () => M.on };
  }, { choices: { open: ['use', 'shoot', 'trigger'] }, note: 'Looks like the map\'s own wall. open: use (walk up and press E), shoot it, or trigger (a trigger opens it by name).' });

  // ---- mounted gun: man it with E
  K('mountedGun', 'Mounted machine gun', { arc: 70, dmg: 110, sandbags: true }, (a, o, e) => {
    if (o.sandbags) for (let k = 0; k < 5; k++) { const t = -1 + k * 0.5, x = Math.sin(t) * 1.05, z = Math.cos(t) * 1.05; for (let j = 0; j < 3; j++) bx(a, Mm.cloth, x, 0.13 + j * 0.26, z, 0.7, 0.26, 0.45, L.vary(0x9a8a62, 0.12), [0, 0, t]); L.solid(a, x, z, 0.7, 0.7, 0.78 + (a.y || 0), { y0: a.y || 0, bullets: false }); }
    for (let k = 0; k < 3; k++) { const t = k / 3 * Math.PI * 2; bx(a, Mm.metal, Math.sin(t) * 0.3, 0.45, 0.3 + Math.cos(t) * 0.3, 0.05, 0.95, 0.05, 0x2a2e33, [Math.cos(t) * 0.35, -Math.sin(t) * 0.35]); }
    const g = standGroup(a), yaw = new THREE.Group(); yaw.position.set(0, 1.05, 0.3); g.add(yaw); const pitch = new THREE.Group(); yaw.add(pitch);
    const dk = mat(0x24282c, { metalness: 0.8, roughness: 0.4 });
    mesh(pitch, box, dk, [0, 0, 0], [0.22, 0.24, 0.8]); mesh(pitch, cyl, dk, [0, 0.02, 0.85], [0.05, 1.0, 0.05], [Math.PI / 2, 0, 0]); mesh(pitch, cyl, mat(0x3a3e44), [0, 0.02, 0.62], [0.08, 0.35, 0.08], [Math.PI / 2, 0, 0]);
    mesh(pitch, box, mat(0x4c5438, { metalness: 0.2 }), [0.18, -0.05, 0.05], [0.14, 0.2, 0.28]); mesh(pitch, box, dk, [0, -0.02, -0.5], [0.08, 0.08, 0.3]);
    for (const s of [-1, 1]) mesh(pitch, cyl, dk, [s * 0.18, -0.02, -0.62], [0.025, 0.25, 0.025], [0, 0, Math.PI / 2]);
    if (ed()) return;
    g.userData.noCull = true;
    const [sx, sz] = wp(a, 0, -0.55), face = a.ry || 0;
    const M = addMover(e, { kind: 'gun', on: true, g, yaw, pitch, face, arc: (+o.arc || 70) * Math.PI / 180, dmg: +o.dmg || 110, heat: 0, hot: 0, cd: 0,
      seat: new THREE.Vector3(sx, W().floorAt(sx, sz) + (a.y || 0), sz), update(dt) { gunTick(M, dt); }, set(on) { M.on = on; if (!on && LG.mounted === M) dismount(); } });
    M.use = { pos: M.seat.clone(), r: 1.5, cost: 0, text: () => (LG.mounted === M ? 'Leave the gun' : 'Man the gun'), act: () => (LG.mounted === M ? dismount() : mount(M)), hidden: () => !M.on };
  }, { note: 'Press E behind it to man it: it turns with your aim (arc: degrees either side), never runs out and overheats if you hold the trigger too long.' });

  // ---- zipline: from here to its other end (the round handle)
  K('zipline', 'Zipline', { h0: 3.2, h1: 2.6 }, (a, o, e) => {
    const x1 = e.lx !== undefined ? e.lx : a.x + 12, z1 = e.lz !== undefined ? e.lz : a.z, Wd = W();
    const y0 = (a.y || 0) + Wd.dispAt(a.x, a.z), y1 = Wd.floorAt(x1, z1), t0 = y0 + +o.h0, t1 = y1 + +o.h1;
    const g = new THREE.Group(); g.userData.lifted = true; SD.root().add(g);
    const dk = mat(0x3a3e44, { metalness: 0.8, roughness: 0.35 });
    mesh(g, cyl, dk, [a.x, y0 + (+o.h0 + 0.3) / 2, a.z], [0.08, +o.h0 + 0.3, 0.08]); mesh(g, cyl, dk, [x1, y1 + (+o.h1 + 0.3) / 2, z1], [0.08, +o.h1 + 0.3, 0.08]);
    const A0 = new THREE.Vector3(a.x, t0, a.z), B0 = new THREE.Vector3(x1, t1, z1), mid = A0.clone().add(B0).multiplyScalar(0.5), dv = B0.clone().sub(A0);
    const cable = new THREE.Mesh(cyl, new THREE.MeshBasicMaterial({ color: 0x1a1a1a })); cable.scale.set(0.02, dv.length(), 0.02); cable.position.copy(mid); cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.clone().normalize()); g.add(cable);
    mesh(g, sph, new THREE.MeshBasicMaterial({ color: 0x40ff90 }), [a.x, t0 + 0.2, a.z], [0.08, 0.08, 0.08]);
    if (ed()) return;
    g.userData.noCull = true;
    Wd.addCyl(a.x, a.z, 0.12, (a.y || 0) + +o.h0 + 0.3, { mount: false, y0: a.y || 0 }); Wd.addCyl(x1, z1, 0.12, +o.h1 + 0.3, { mount: false });
    const u = dv.clone().setY(0).normalize(), ST = XH.structures;
    if (ST && ST.zips) ST.zips.push({ kind: 'zipline', start: new THREE.Vector3(a.x - u.x * 0.5, y0 + Math.max(0, +o.h0 - 2.9), a.z - u.z * 0.5), from: A0.clone().setY(t0 - 1.9), to: B0.clone().addScaledVector(u, -0.6).setY(Math.max(y1, t1 - 1.9)) });
  }, { handle: { dx: 12, label: 'end' }, note: 'Drag the round handle to where it ends. Press E at the start pole to ride it. h0 / h1: how high the cable is at each end (stand the start on a deck with y for a proper drop).' });

  // ======================================================================
  //  Manning a gun
  // ======================================================================
  let heatBar = null;
  function mount(M) {
    const Pl = P(); if (LG.mounted || Pl.downed || Pl.path) return;
    LG.mounted = M; Pl.mounted = M; Pl.yaw = M.face + Math.PI; Pl.pitch = 0; XH.weapons.setTrigger(false);
    if (!heatBar) { heatBar = document.createElement('div'); heatBar.style.cssText = 'position:fixed;left:50%;bottom:16%;width:240px;height:8px;margin-left:-120px;border:1px solid rgba(255,200,120,.8);border-radius:4px;pointer-events:none;z-index:6;background:rgba(40,20,0,.5)'; heatBar.innerHTML = '<div style="height:100%;width:0;background:#ffb040;border-radius:3px"></div>'; document.body.appendChild(heatBar); }
    heatBar.style.display = 'block'; A.play('grab');
  }
  function dismount() { const Pl = P(); if (Pl) Pl.mounted = null; LG.mounted = null; if (heatBar) heatBar.style.display = 'none'; }
  LG.dismount = dismount;
  // the player's look is limited to the gun's arc (player.js calls this)
  LG.clampLook = (Pl) => { const M = LG.mounted; if (!M) return; const fwd = M.face + Math.PI, d = U.angDiff ? U.angDiff(fwd, Pl.yaw) : Pl.yaw - fwd; if (Math.abs(d) > M.arc) Pl.yaw = fwd + Math.sign(d) * M.arc; Pl.pitch = U.clamp(Pl.pitch, -0.5, 0.45); };
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3();
  function gunTick(M, dt) {
    M.cd -= dt; M.heat = Math.max(0, M.heat - dt * (M.hot > 0 ? 0.35 : 0.45)); if (M.hot > 0) M.hot -= dt;
    const on = LG.mounted === M, Pl = P();
    if (!on) { M.yaw.rotation.y = U.damp(M.yaw.rotation.y, 0, 3, dt); M.pitch.rotation.x = U.damp(M.pitch.rotation.x, 0, 3, dt); return; }
    if (Pl.downed || G().state !== 'playing') { dismount(); return; }
    // the gun follows the aim
    M.yaw.rotation.y = Pl.yaw - M.face - Math.PI; M.pitch.rotation.x = -Pl.pitch;
    if (heatBar) { const b = heatBar.firstChild; b.style.width = Math.round(M.heat * 100) + '%'; b.style.background = M.hot > 0 ? '#ff4030' : '#ffb040'; }
    const S = XH.weapons.state;
    if (!S.trigger || M.cd > 0 || M.hot > 0) return;
    M.cd = 0.075; M.heat += 0.03; if (M.heat >= 1) { M.hot = 2.6; A.play('deny'); }
    _o.copy(Pl.cam.position); Pl.cam.getWorldDirection(_d); _d.x += U.rand(-0.012, 0.012); _d.y += U.rand(-0.012, 0.012); _d.normalize();
    M.pitch.updateMatrixWorld(); _m.set(0, 0.02, 1.35).applyMatrix4(M.pitch.matrixWorld);
    const wall = W().raycast(_o, _d, 90), hits = E().rayHits(_o, _d, wall.t, 2);
    if (wall.kind === 'prop' && wall.prop && wall.prop.onShot) wall.prop.onShot(M.dmg);
    let endT = wall.t;
    hits.forEach((h, k) => { E().damage(h.e, M.dmg * (k ? 0.7 : 1), { head: h.mult >= 2, mult: h.mult, point: h.point, dir: _d, kind: 'bullet', weapon: 'turret' }); endT = h.t; });
    const end = _o.clone().addScaledVector(_d, endT);
    FX.tracer(_m, end, 0xffd080, 0.05); FX.flash(_m, 0xffc060, 2, 0.05, 6);
    if (!hits.length) FX.sparks(end, wall.n);
    A.play('rifle', { vol: 0.9 }); FX.shake(0.06); Pl.kickP += 0.004;
  }

  // ======================================================================
  //  Every frame of play
  // ======================================================================
  LG.update = (dt) => {
    const Pl = P(), Gm = G(), Wd = W();
    LG.t += dt;
    if (!LG.started) { LG.started = true; LG.kills0 = Gm.stats ? Gm.stats.kills : 0; for (const T of LG.triggers) if (T.when === 'start') fire(T); LG.powerWas = Wd.power; LG.roundWas = Gm.round; }
    for (let k = LG.pending.length - 1; k >= 0; k--) { const q = LG.pending[k]; q.t -= dt; if (q.t > 0) continue; LG.pending.splice(k, 1); if (q.act) doAct(q.act, q.T); else run(q.T); }
    const powerOn = Wd.power && !LG.powerWas, newRound = Gm.round !== LG.roundWas; LG.powerWas = Wd.power; LG.roundWas = Gm.round;
    const kills = Gm.stats ? Gm.stats.kills - LG.kills0 : 0;
    for (const T of LG.triggers) {
      if (T.cd > 0) T.cd -= dt;
      if (!T.armed) continue;
      switch (T.when) {
        case 'enter': { const inn = inArea(T, Pl.pos); if (inn && !T.inside) fire(T); T.inside = inn; break; }
        case 'creature': { let inn = false; for (const e of E().list) if (!e.dead && inArea(T, e.pos, 6)) { inn = true; break; } if (inn && !T.inside) fire(T); T.inside = inn; break; }
        case 'round': if (newRound && Gm.round >= (+T.o.round || 1) && (T.o.once === false || Gm.round === (+T.o.round || 1) || !T.fired)) fire(T); break;
        case 'kills': if (kills >= (+T.o.count || 50)) fire(T); break;
        case 'power': if (powerOn) fire(T); break;
      }
    }
    for (const M of LG.movers) M.update(dt);
  };
  // E prompts: buttons, levers, doors with buttons, secret walls, guns
  LG.candidates = (out) => {
    const Pl = P().pos, Gm = G(); if (Gm.state !== 'playing') return;
    const near = (p, r) => { const d = Math.hypot(p.x - Pl.x, p.z - Pl.z); return d < r && Math.abs((p.y || 0) - Pl.y) < 2 ? d : -1; };
    for (const T of LG.triggers) {
      if (T.when !== 'button' && T.when !== 'lever') continue;
      const d = near(new THREE.Vector3(T.x, T.y0, T.z), 1.7); if (d < 0) continue;
      const done = (!T.armed) || (T.o.once !== false && T.fired);
      if (done) { out.push({ tip: 'trap', dist: d, text: T.o.label ? T.o.label + ' (used)' : 'Nothing happens', cost: null }); continue; }
      const cost = Math.round(+T.o.cost || 0);
      out.push({ tip: 'trap', dist: d, text: T.o.label || (T.when === 'lever' ? 'Pull the lever' : 'Press the button'), cost: cost || 0, act: () => { if (cost && !Gm.spend(cost)) return; if (fire(T)) A.play(T.when === 'lever' ? 'build' : 'uiClick', { vol: 1 }); } });
    }
    for (const M of LG.movers) {
      if (!M.use || (M.use.hidden && M.use.hidden())) continue;
      const d = near(M.use.pos, M.use.r); if (d < 0) continue;
      const cost = M.use.cost || 0;
      out.push({ tip: 'trap', dist: d, text: M.use.text(), cost: cost || 0, act: () => { if (cost && !Gm.spend(cost)) return; M.use.act(); } });
    }
  };
  // explosions knock breakable walls down (weapons.js WP.explode)
  LG.blast = (pos, r, dmg) => { for (const M of LG.movers) if (M.kind === 'wall' && M.on && Math.hypot(M.pos.x - pos.x, M.pos.z - pos.z) < r + 2) M.hurt(dmg); };

  // ======================================================================
  //  The Drowner: lives in deep water
  // ======================================================================
  if (E().addVariant && !E().TYPES.drowner) {
    E().addVariant('drowner', 'lancer', { name: 'Drowner', hp: 260, pts: 120, mech: 'swim', threat: 2, model: { tint: [0x2a4a6a, 0.85], glow: 0x0a2040 },
      desc: 'A Lancer that took to flooded places. It crosses deep water fast and out of sight, and comes out of the water right next to you.', tip: 'Stay back from the water\'s edge, and watch for the wake.' });
    if (E().ORDER) E().ORDER.push('drowner');
  }
  E().MECH.swim = {
    tick(e, dt) {
      const Z = XH.hazards && XH.hazards.deepAt ? XH.hazards.deepAt(e.pos.x, e.pos.z) : null, Pl = P(), dP = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
      const under = !!Z && dP > 3.2;
      if (under !== !!e.sub) { e.sub = under; e.root.visible = !under; e.speedMul *= under ? 1.9 : 1 / 1.9; if (Math.random() < 0.8) FX.one(e.pos.x, (Z ? Z.y0 + Z.o.depth : 0) + 0.05, e.pos.z, 0, 1.5, 0, 0.6, 0.4, 0.1, 0xc0e8ff, 0.8, 6, 1, false); }
      if (under && Math.random() < dt * 8) FX.one(e.pos.x + U.rand(-0.5, 0.5), Z.y0 + Z.o.depth + 0.03, e.pos.z + U.rand(-0.5, 0.5), 0, 0.3, 0, 0.8, 0.3, 0.05, 0xd8f0ff, 0.6, 0, 1, false);
    },
    damage: (e, amt) => (e.sub ? amt * 0.25 : amt),
  };
})();
