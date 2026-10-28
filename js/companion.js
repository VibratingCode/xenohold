'use strict';
// The companion: every map has a Companion Egg in a nest not far from the start. Hatch it (3,000 points) and Kit, a
// tamed skitterling, follows you for the rest of the game. It hunts creatures near you, never strays far, and jumps
// back to you if it gets left behind. Creatures that corner it hurt it; when it goes down it gets back up 25 s later.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, E = XH.enemies, L = E.lib;
  const CO = XH.companion = {};
  const G = () => XH.game, P = () => XH.player, W = () => XH.world, UI = () => XH.ui;
  const PRICE = 3000, LEASH = 16, DOWN = 25;

  E.addVariant('companion', 'skitterling', {
    name: 'Kit', ally: true, hp: 900, speed: 7.6, radius: 0.5, pts: 0, emerge: 0.6, ai: 'companion',
    model: { scale: 1.3, tint: [0x2a8cff, 0.75], glow: 0x0a3a80, eyes: 0x60ffff },
    desc: 'A skitterling that hatched looking at you instead of the hive. It thinks you are its mother.',
    tip: 'It is on your side. Keep it close and it keeps the small ones off you.',
  });

  L.AI.companion = (e, dt) => {
    const Pl = P(), Wd = W();
    e.turned = 1e9; // keeps it out of every "shoot the creatures" system
    if (e.petDown > 0) {
      e.petDown -= dt; e.vel.multiplyScalar(Math.exp(-6 * dt)); L.integrate(e, dt, true); e.st.move = 0; e.st.atk = -1;
      e.root.rotation.z = U.damp(e.root.rotation.z, 1.4, 5, dt);
      if (e.petDown <= 0) { e.hp = e.maxHp; e.root.rotation.z = 0; UI().banner('KIT IS BACK UP', '', '#60c0ff'); A.creature('skitterling', 'alert', { pos: e.pos }); }
      return;
    }
    // creatures next to it hurt it
    let hurt = 0;
    for (const o of E.list) if (o !== e && !o.dead && !o.turned && o.state === 'act' && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < o.radius + e.radius + 0.5) hurt += (o.def.dmg || 10) * 0.3;
    if (hurt) { e.hp -= hurt * dt; if (Math.random() < dt * 2) e.flashT = 0.07; }
    if (e.hp <= 0) { e.hp = 1; e.petDown = DOWN; UI().banner('KIT IS DOWN', `Back up in ${DOWN} seconds`, '#ff6040'); A.creature('skitterling', 'pain', { pos: e.pos }); return; }
    const dP = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
    // left behind (or you went somewhere it cannot follow): it jumps to you
    e.farT = dP > 30 || (dP > 7 && Math.abs(Pl.pos.y - e.pos.y) > 1.5) ? (e.farT || 0) + dt : 0;
    if (e.farT > 3) {
      for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28, x = Pl.pos.x + Math.cos(a) * 2, z = Pl.pos.z + Math.sin(a) * 2; if (!Wd.solidAt(x, z, 0.4, Pl.pos.y)) { FX.burst({ pos: e.center(), n: 14, color: 0x60c0ff, speed: [1, 3], life: [0.2, 0.5], size: [0.25, 0.05] }); e.pos.set(x, Pl.pos.y, z); e.vel.set(0, 0, 0); break; } }
      e.farT = 0;
    }
    // hunt the nearest creature close to you
    let tgt = null, bd = 1e9;
    for (const o of E.list) {
      if (o === e || o.dead || o.turned || o.fly || o.state === 'burrowed' || o.state === 'emerge' || o.def.objective) continue;
      if (Math.hypot(o.pos.x - Pl.pos.x, o.pos.z - Pl.pos.z) > LEASH) continue;
      const d = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z); if (d < bd) { bd = d; tgt = o; }
    }
    const sp = e.def.speed * (e.frenzy ? 1.2 : 1);
    if (tgt) {
      L.steer(e, dt, bd < e.radius + tgt.radius + 0.5 ? 0 : sp, { goal: tgt.pos });
      e.tAtk = (e.tAtk || 0) - dt;
      if (bd < e.radius + tgt.radius + 0.9 && e.tAtk <= 0) {
        e.tAtk = 0.5; e.swing = 0.45;
        const dmg = 220 * E.hpMul(G().round) * (tgt.def.boss ? 0.3 : 1);
        E.damage(tgt, dmg, { kind: 'turned', point: tgt.center(), weapon: 'companion' });
        if (tgt.dead && XH.achievements) XH.achievements.add('pet');
        A.play('claw', { pos: e.pos, vol: 0.8 });
      }
      L.face(e, dt, tgt.pos.x, tgt.pos.z, 12);
    } else {
      L.steer(e, dt, dP > 6 ? sp : sp * 0.6, { goal: Pl.pos, stop: 2.6 });
      if (Math.hypot(e.vel.x, e.vel.z) > 0.5) L.face(e, dt, e.pos.x + e.vel.x, e.pos.z + e.vel.z, 10); else L.face(e, dt, Pl.pos.x, Pl.pos.z, 4);
    }
    e.swing = Math.max(0, (e.swing || 0) - dt);
    e.st.atk = e.swing > 0 ? 1 - e.swing / 0.45 : -1;
    L.integrate(e, dt, true);
    e.st.move = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / sp);
    // a soft blue glow so you can tell it apart
    if (Math.random() < dt * 5) FX.one(e.pos.x + U.rand(-0.3, 0.3), e.pos.y + 0.9, e.pos.z + U.rand(-0.3, 0.3), 0, 0.6, 0, 0.5, 0.16, 0.03, 0x60c0ff);
  };

  // ---------------- the nest ----------------
  CO.st = null;
  CO.build = (c) => {
    CO.st = null;
    const Wd = W(), ST = XH.structures; if (!ST || !ST.freeRects) return;
    const s = Wd.start, rects = ST.freeRects(2, 2);
    rects.sort((a, b) => Math.abs(Math.hypot(Wd.cx2x(a.x) - s.x, Wd.cz2z(a.z) - s.z) - 14) - Math.abs(Math.hypot(Wd.cx2x(b.x) - s.x, Wd.cz2z(b.z) - s.z) - 14));
    const zr = XH.zones && XH.zones.place('nest') ? XH.zones.inZone(rects, XH.zones.place('nest')) : [];
    const pe = XH.edits && XH.edits.pin('egg');
    if (!pe && Wd.auto === false) return; // a map of your own: only where you put it
    const r = pe ? { x: Wd.cellX(pe.x), z: Wd.cellZ(pe.z), w: 2, h: 2 } : zr[0] || rects[0]; if (!r) return;
    const x = pe ? pe.x : (Wd.cx2x(r.x) + Wd.cx2x(r.x + 1)) / 2, z = pe ? pe.z : (Wd.cz2z(r.z) + Wd.cz2z(r.z + 1)) / 2;
    Wd.piece('egg', { label: 'Companion egg', shape: 'point', x, z, r: 0.8 });
    ST.claim(r, 0); Wd.keepClear.push([x, z, 2.2]);
    const g = new THREE.Group(); g.position.set(x, 0, z); Wd.root.add(g);
    const twig = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.95 });
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 5), twig); m.position.set(Math.cos(a) * 0.55, 0.18, Math.sin(a) * 0.55); m.rotation.set(Math.PI / 2 - 0.3, a + 1.2, 0); g.add(m); }
    const eggMat = new THREE.MeshStandardMaterial({ color: 0x2a4a70, emissive: 0x1060c0, emissiveIntensity: 0.6, roughness: 0.35 });
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), eggMat); egg.scale.set(1, 1.35, 1); egg.position.y = 0.48; g.add(egg);
    const glow = FX.glowSprite(0x60c0ff, 1.6, 0.5); glow.position.y = 0.5; g.add(glow);
    const sign = XH.sys.label ? XH.sys.label('COMPANION EGG', '#60c0ff', 1.5, 0.34) : null; if (sign) { sign.position.y = 1.5; g.add(sign); }
    Wd.addCyl(x, z, 0.5, 0.8, { mount: false });
    CO.st = { g, egg, eggMat, pos: new THREE.Vector3(x, 0, z), pet: null, hatched: false };
  };
  CO.candidates = (out) => {
    const st = CO.st; if (!st || st.hatched || G().state !== 'playing') return;
    const Pl = P().pos, d = Math.hypot(st.pos.x - Pl.x, st.pos.z - Pl.z);
    if (d < 1.9) out.push({ tip: 'companion', dist: d, text: 'Hatch a companion (it fights for you)', cost: G().price ? G().price(PRICE) : PRICE, act: () => { const c = G().price ? G().price(PRICE) : PRICE; if (G().spend(c)) CO.hatch(); } });
  };
  CO.hatch = () => {
    const st = CO.st; if (!st || st.hatched) return;
    st.hatched = true; st.egg.visible = false;
    FX.burst({ pos: st.pos.clone().setY(0.5), n: 30, color: 0x60c0ff, speed: [1, 4], life: [0.3, 0.8], size: [0.3, 0.05] }); A.play('hatch', { pos: st.pos, vol: 1 });
    const e = E.spawn('companion', st.pos.x + 0.9, st.pos.z);
    e.turned = 1e9; st.pet = e;
    UI().banner('KIT HATCHED', 'It follows you and hunts whatever gets close', '#60c0ff');
    if (UI().tip) UI().tip('companion');
  };
  CO.update = (dt, t) => {
    const st = CO.st; if (!st) return;
    if (!st.hatched) { st.egg.rotation.z = Math.sin(t * 3) * 0.08; st.eggMat.emissiveIntensity = 0.5 + Math.sin(t * 2.4) * 0.25; }
  };
  CO.pet = () => (CO.st && CO.st.pet && !CO.st.pet.dead ? CO.st.pet : null);
})();
