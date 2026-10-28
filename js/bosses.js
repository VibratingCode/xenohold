'use strict';
// Alternate bosses, so boss rounds are not always the Hive Tyrant. Each is a giant form of another species with its
// own attacks, wrapped in the same boss rules as the Tyrant: it needs line of sight to attack, it calls the swarm at
// two-thirds and one-third health, and after 2 minutes without seeing anyone it moves close to the nearest player.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, E = XH.enemies, L = E.lib;
  const BS = XH.bosses = {};
  const P = () => XH.player, G = () => XH.game, W = () => XH.world;

  E.addVariant('empress', 'broodmother', {
    name: 'Brood Empress', boss: true, heavy: true, hp: 12000, speed: 2.5, radius: 2.5, cy: 2.8, dmg: 40, reach: 2.4, atkRange: 4.2, pts: 2500, emerge: 3, ai: 'empress', threat: 5,
    ranged: { range: [5, 28], cd: [2.2, 3.2], castT: 1.0, release: 0.6, kind: 'bile', n: 3, dmg: 18, err: 0.06 }, eggs: { cd: [5, 7], n: 4 },
    model: { scale: 2.1, tint: [0x7a3aa0, 0.6], glow: 0x401060 },
    desc: 'The queen of the brood, grown to the size of a house. She floods the ground with acid, lobs egg-pods by the handful and never stops giving birth.',
    tip: 'Her swollen abdomen is soft. Keep moving so the acid rain lands behind you, and clear the hatchlings with splash damage.',
  });
  E.addVariant('titan', 'behemoth', {
    name: 'Molten Titan', boss: true, hp: 14000, speed: 3.0, radius: 2.6, cy: 3.4, dmg: 60, reach: 2.8, atkRange: 5, pts: 2500, emerge: 3, ai: 'titan', threat: 5,
    charge: { range: [8, 30], cd: [5, 8], speed: 15, dur: 1.9, dmg: 50 },
    model: { scale: 1.75, tint: [0x22160f, 0.85], glow: 0x4a1400, dark: 0.85 },
    desc: 'A Behemoth that crawled out of the deep magma. Its carapace is still cooling. Every stomp sends a wave of force through the ground, and it leaves molten rock wherever it walks.',
    tip: 'The glowing hump on its back is the weak spot. Jump the shockwave rings and never stand in its trail.',
  });
  E.addVariant('wraith', 'shrieker', {
    name: 'Sky Wraith', boss: true, heavy: true, hp: 9000, speed: 5.2, radius: 1.6, hover: 5.5, dmg: 35, reach: 2.4, atkRange: 3.2, pts: 2500, emerge: 2.5, ai: 'wraith', threat: 5,
    ranged: { range: [4, 32], cd: [1.0, 1.8], castT: 0.6, release: 0.45, kind: 'glaive', n: 1, dmg: 18, err: 0.05 },
    model: { scale: 2.6, tint: [0x2a2048, 0.75], glow: 0x5020a0 },
    desc: 'The oldest Shrieker, a shadow with a wingspan wider than a street. It circles high above, sheds storms of glaives and calls its flock down on you.',
    tip: 'It is a big target but it never stays still. Take cover from the glaive storms and shoot it when it dives.',
  });
  E.ORDER.push('empress', 'titan', 'wraith');

  // ---------- shared boss rules ----------
  function summon(e, type, n, variant) {
    const spots = W().spawns.filter((s) => s.active).sort((a, b) => Math.hypot(a.x - e.pos.x, a.z - e.pos.z) - Math.hypot(b.x - e.pos.x, b.z - e.pos.z)).slice(0, 4);
    for (let k = 0; k < n; k++) { const s = spots[k % spots.length]; if (s) E.spawn(type, s.x + U.rand(-1, 1), s.z + U.rand(-1, 1), { variant }); }
  }
  function core(e, dt, minion) {
    const B = e.bossAI;
    B.seeT = (B.seeT || 0) - dt; if (B.seeT <= 0) { B.seeT = 0.25; B.sees = L.sees(e); }
    B.unseen = B.sees ? 0 : (B.unseen || 0) + dt;
    if (B.unseen >= E.BOSS_LOST) {
      if (e.fly) { // a flier just swoops in over the player
        const Pl = P(), a = Math.random() * 6.28; e.pos.set(Pl.pos.x + Math.cos(a) * 12, 8, Pl.pos.z + Math.sin(a) * 12); B.unseen = 0;
        XH.ui.banner('THE ' + e.def.name.toUpperCase() + ' SWOOPS IN', 'It found you.', '#d060ff');
      } else L.bossRelocate(e);
      return true;
    }
    const hpK = e.hp / e.maxHp;
    if ((B.phase === 1 && hpK < 0.66) || (B.phase === 2 && hpK < 0.33)) {
      B.phase++; summon(e, minion[0], minion[1] + B.phase * 2, minion[2]);
      A.creature(e.type, 'alert', { pos: e.pos }); FX.shake(0.5);
      XH.ui.banner(e.def.name.toUpperCase() + ' CALLS THE SWARM', '', '#d060ff');
    }
    B.enraged = hpK < 0.3;
    if (B.enraged) for (const m of e.mats) m.emissive.setHex(Math.sin(e.t * 8) > 0 ? 0x5a1060 : m.userData.base);
    return false;
  }

  // Brood Empress: bile volleys and egg-pods from the Broodmother, plus acid rain and hatchling floods
  L.AI.empress = (e, dt) => {
    if (core(e, dt, ['broodling', 6])) return;
    const B = e.bossAI, Pl = P();
    B.rainCd = (B.rainCd === undefined ? 8 : B.rainCd) - dt;
    if (B.rainCd <= 0 && B.sees) {
      B.rainCd = U.rand(9, 13) * (B.enraged ? 0.6 : 1);
      for (let k = 0; k < 9; k++) { const p = Pl.pos.clone().add(new THREE.Vector3(U.rand(-6, 6), 0, U.rand(-6, 6))); if (k === 0) p.copy(Pl.pos); L.rainAt(p, 0.5 + k * 0.15); }
      A.play('wail', { pos: e.pos, vol: 1 });
    }
    L.AI.broodmother(e, dt);
  };
  // Molten Titan: the Behemoth's charges, plus ground slams and a molten trail
  L.AI.titan = (e, dt) => {
    if (core(e, dt, ['skitterling', 6, 'frenzied'])) return;
    const B = e.bossAI, Pl = P(), dist = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z);
    B.slamCd = (B.slamCd === undefined ? 5 : B.slamCd) - dt;
    if (B.slamCd <= 0 && B.sees && dist < 12 && !e.chargeState) {
      B.slamCd = U.rand(6, 9) * (B.enraged ? 0.6 : 1);
      L.shockwave(e.pos.clone(), 20, 34 * e.dmgMul); FX.shake(0.9); FX.dirt(e.pos.clone().setY(0.2), 50);
      A.play('stomp', { pos: e.pos, vol: 1.5 }); A.play('explosion', { pos: e.pos, size: 1.2 });
      e.stunT = Math.max(e.stunT, 0.6);
    }
    B.trailT = (B.trailT || 0) - dt;
    if (B.trailT <= 0 && Math.hypot(e.vel.x, e.vel.z) > 0.8) { B.trailT = 0.8; L.addPool(e.pos, 1.8, 6, 26, 0xff6020, 'lava'); }
    L.AI.behemoth(e, dt);
  };
  // Sky Wraith: the Shrieker's glaives and dives, plus glaive storms and flock calls
  L.AI.wraith = (e, dt) => {
    if (core(e, dt, ['shrieker', 2])) return;
    const B = e.bossAI, Pl = P();
    B.stormCd = (B.stormCd === undefined ? 6 : B.stormCd) - dt;
    if (B.stormCd <= 0 && B.sees) {
      B.stormCd = U.rand(7, 10) * (B.enraged ? 0.6 : 1);
      const from = L.headPos(e), base = L.aimAt(e, from, from.distanceTo(Pl.pos) / 15, 0.04), side = new THREE.Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
      for (let k = -4; k <= 4; k++) L.shoot('glaive', from, base.clone().addScaledVector(side, k * 1.4), e);
      A.play('shriek', { pos: e.pos, vol: 1.2 }); FX.shake(0.2);
    }
    B.callCd = (B.callCd === undefined ? 20 : B.callCd) - dt;
    if (B.callCd <= 0) { B.callCd = 30; summon(e, 'shrieker', 3); A.creature('shrieker', 'alert', { pos: e.pos }); }
    L.AI.shrieker(e, dt);
  };

  // Which boss comes next: the map's signature boss first, then the others in turn (never the same twice in a row).
  const SIGNATURE = { depths: 'tyrant', cathedral: 'empress', temple: 'tyrant', dustbasin: 'titan', crucible: 'titan', glacier: 'wraith', vesper: 'wraith', selene: 'wraith', verdant: 'empress', undercroft: 'empress', bastion: 'titan', starfall: 'empress', kestrel: 'tyrant', frostfall: 'wraith', ark: 'tyrant', city: 'titan', helix: 'empress' };
  BS.ALL = ['tyrant', 'empress', 'titan', 'wraith'];
  BS.pick = (mapId) => {
    const g = G(), first = SIGNATURE[mapId] || 'tyrant';
    const order = [first, ...BS.ALL.filter((b) => b !== first)];
    g.bossCount = (g.bossCount || 0) + 1;
    return order[(g.bossCount - 1) % order.length];
  };
})();
