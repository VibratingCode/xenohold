'use strict';
// Map-unique content. Every arena has its own creature (with a special ability), its own perk machine and its own
// wall weapon (with a signature effect), plus which structures it gets (see structures.js). Victory conditions are
// in victory.js and the alternate bosses in bosses.js.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio, E = XH.enemies, WP = XH.weapons;
  const UQ = XH.uniques = {};
  const P = () => XH.player, G = () => XH.game, W = () => XH.world;
  const mapId = () => (G().def && G().def.id) || (W().def && W().def.id);

  // ======================================================================
  //  Per-map table
  // ======================================================================
  // structures: building / platform names, teleporter colour. enemy: variant id. perk / weapon: ids below.
  const MAP = XH.UNIQUE = {
    kestrel: { structures: { building: 'Comms Hut', platform: 'Landing Tower', teleporters: 0x60e0ff }, enemy: 'stormstalker', perk: 'conduit', weapon: 'stormcaller' },
    depths: { structures: { platform: 'Ember Altar', teleporters: 0xff6020 }, enemy: 'magmacrawler', perk: 'magmablood', weapon: 'magmapump' },
    frostfall: { structures: { building: 'Relay Shack', platform: 'Antenna Deck', teleporters: 0x9ad8ff }, enemy: 'frostlancer', perk: 'permafrost', weapon: 'glacierlance' },
    ark: { structures: { teleporters: 0x40ff90 }, enemy: 'hullleech', perk: 'lifesupport', weapon: 'rivetdriver' },
    city: { structures: { building: 'Corner Store', platform: 'Police Watchtower', teleporters: 0xff40c0 }, enemy: 'gutterhound', perk: 'streetsmarts', weapon: 'neoncutter' },
    dustbasin: { structures: { building: 'Foreman Office', platform: 'Drill Platform' }, enemy: 'duneborer', perk: 'dustdevil', weapon: 'sandstorm' },
    verdant: { structures: { building: 'Greenhouse', platform: 'Canopy Deck' }, enemy: 'sporebloater', perk: 'symbiote', weapon: 'thornthrower' },
    helix: { structures: { teleporters: 0x60e8ff }, enemy: 'specimen', perk: 'genesplice', weapon: 'generipper' },
    undercroft: { structures: { teleporters: 0xb8e070 }, enemy: 'sewerlurker', perk: 'hazmat', weapon: 'sludgemortar' },
    glacier: { structures: { platform: 'Ice Bridge', teleporters: 0xa8f0ff }, enemy: 'icewraith', perk: 'cryorounds', weapon: 'avalanche' },
    crucible: { structures: { building: 'Control Booth', platform: 'Catwalk', teleporters: 0xff8030 }, enemy: 'slaggolem', perk: 'forgefire', weapon: 'forgehammer' },
    cathedral: { structures: { platform: 'Bone Pulpit', teleporters: 0xd070ff }, enemy: 'choirdrone', perk: 'choirward', weapon: 'hymnofruin' },
    bastion: { structures: { building: 'Bunker', platform: 'Guard Tower' }, enemy: 'breacher', perk: 'fortified', weapon: 'wardenm2' },
    selene: { structures: { building: 'Hab Module', teleporters: 0xe0e8ff }, enemy: 'voidmite', perk: 'moonboots', weapon: 'moondriver' },
    starfall: { structures: { platform: 'Wreck Lookout', teleporters: 0x9adf70 }, enemy: 'boglurker', perk: 'salvager', weapon: 'flaregun' },
    vesper: { structures: { teleporters: 0x80a8ff }, enemy: 'vacuumwisp', perk: 'kinetic', weapon: 'singularitycarbine' },
    temple: { structures: { platform: 'Idol Dais', teleporters: 0xffd070 }, enemy: 'guardian', perk: 'relichunter', weapon: 'relicglaive' },
  };
  const cur = () => MAP[mapId()] || {};

  // ======================================================================
  //  Unique creatures
  // ======================================================================
  const V = (id, base, o) => E.addVariant(id, base, o);
  V('stormstalker', 'skitterling', { name: 'Storm Stalker', map: 'kestrel', hp: 130, speed: 6.8, pts: 90, mech: 'cloak', threat: 2, model: { tint: [0x6a8aa8, 0.75], glow: 0x0a2038 },
    desc: 'A Skitterling adapted to the storm season on Kestrel. Its hide bends light and rain, so it is nearly invisible until it is close enough to kill.', tip: 'Watch for glowing eyes in the rain. Shooting one strips its cloak for a few seconds.' });
  V('magmacrawler', 'burster', { name: 'Magma Crawler', map: 'depths', hp: 110, pts: 90, mech: 'lava', threat: 2, explode: { r: 4.2, dmg: 45 }, model: { tint: [0xff5010, 0.85], glow: 0x802000 },
    desc: 'A Burster that grew fat on the Depths\' magma. It is immune to fire and bursts into a pool of molten rock.', tip: 'Kill it at range and never stand in what it leaves behind.' });
  V('frostlancer', 'lancer', { name: 'Frost Lancer', map: 'frostfall', hp: 260, pts: 110, mech: 'chill', threat: 2, model: { tint: [0xa8e0ff, 0.8], glow: 0x103050 },
    desc: 'Its spines are coated in a supercooled slime that freezes on contact and slows anything it hits.', tip: 'A chilled soldier cannot outrun a pack. Break line of sight when it flares its cowl.' });
  V('hullleech', 'skitterling', { name: 'Hull Leech', map: 'ark', hp: 85, speed: 7.4, pts: 70, radius: 0.38, cy: 0.5, mech: 'drain', threat: 1, model: { scale: 0.82, tint: [0x8a1a2a, 0.8], glow: 0x300008 },
    desc: 'A blood-red parasite that lives in the Ark\'s ducts. Every bite heals it, so a long fight only makes it stronger.', tip: 'Kill it fast. Never let two latch on at once.' });
  V('gutterhound', 'skitterling', { name: 'Gutter Hound', map: 'city', hp: 280, speed: 7.0, pts: 130, radius: 0.58, cy: 0.78, dmg: 20, mech: 'pack', threat: 3, model: { scale: 1.3, tint: [0x34363c, 0.9], glow: 0x1a0606, dark: 0.75 },
    desc: 'A pack leader bred in the city\'s storm drains. Skitterlings that hear its howl run faster.', tip: 'Kill the hound first and the pack slows back down.' });
  V('duneborer', 'burrower', { name: 'Dune Borer', map: 'dustbasin', hp: 720, pts: 280, mech: 'quake', threat: 3, model: { tint: [0xc8a060, 0.85] },
    desc: 'A Burrower that swims through sand. When it breaches it sends a shockwave rolling across the quarry floor.', tip: 'When the ground bulges, get ready to jump the ring.' });
  V('sporebloater', 'burster', { name: 'Spore Bloater', map: 'verdant', hp: 130, pts: 100, radius: 0.7, cy: 0.72, mech: 'spores', threat: 2, model: { scale: 1.15, tint: [0x8a50a0, 0.65], glow: 0x204010 },
    desc: 'A swollen fungal sac. When it pops it releases a cloud of spores that blurs your vision and makes your legs heavy.', tip: 'Pop it far away, and walk around the green cloud.' });
  V('specimen', 'behemoth', { name: 'Failed Specimen', map: 'helix', hp: 900, speed: 3.6, pts: 220, radius: 0.95, cy: 1.25, dmg: 30, mech: 'regen', threat: 3, charge: { range: [6, 14], cd: [6, 9], speed: 11, dur: 1.4, dmg: 26 }, model: { scale: 0.62, tint: [0xe8c0b0, 0.7], glow: 0x401818 },
    desc: 'A Behemoth grown in a Helix vat. Its tissue knits back together almost as fast as you can damage it, and when it dies, what is inside gets out.', tip: 'Burn or freeze it to stop the healing, then keep firing.' });
  V('sewerlurker', 'lancer', { name: 'Sewer Lurker', map: 'undercroft', hp: 280, pts: 120, mech: 'poison', threat: 2, model: { tint: [0x4a6a30, 0.85], glow: 0x102008 },
    desc: 'A Lancer that lives in the drains. Its spines and claws carry a toxin that keeps burning after the hit.', tip: 'Poison stops your health regenerating. Back off until it wears off.' });
  V('icewraith', 'shrieker', { name: 'Ice Wraith', map: 'glacier', hp: 230, pts: 120, mech: 'freeze', threat: 3, model: { scale: 1.1, tint: [0xd8f0ff, 0.85], glow: 0x204060 },
    desc: 'A Shrieker whose wings drip frost. Its dive leaves you nearly frozen in place, and it shatters into shrapnel when it dies.', tip: 'Do not shoot it right above your head.' });
  V('slaggolem', 'behemoth', { name: 'Slag Golem', map: 'crucible', hp: 2000, pts: 350, radius: 1.3, cy: 1.7, mech: 'slag', threat: 4, model: { scale: 0.85, tint: [0x2a1e18, 0.85], glow: 0x3a1000, dark: 0.8 },
    desc: 'A Behemoth plated in cooling slag. It leaves molten puddles wherever it walks and fire only warms it. Cold makes the slag brittle.', tip: 'Cryo weapons deal double damage to it.' });
  V('choirdrone', 'shrieker', { name: 'Choir Drone', map: 'cathedral', hp: 300, speed: 4.2, pts: 160, mech: 'ward', threat: 3, model: { scale: 0.95, tint: [0xd0b0ff, 0.75], glow: 0x402060 },
    desc: 'It sings. Every creature near a Choir Drone takes half damage while the song lasts.', tip: 'Always kill the drone first. The purple threads show who it is protecting.' });
  V('breacher', 'behemoth', { name: 'Breacher', map: 'bastion', hp: 1500, speed: 3.2, pts: 300, radius: 1.15, cy: 1.5, mech: 'breach', chargeKnock: 1.8, threat: 4, charge: { range: [6, 18], cd: [4, 6], speed: 14, dur: 1.5, dmg: 30 }, model: { scale: 0.75, tint: [0x5a6a3a, 0.7], dark: 0.9 },
    desc: 'Bred to break fortifications. It charges twice as often as a Behemoth and its hit leaves you stunned.', tip: 'Sidestep the charge at the last moment, then hit its back.' });
  V('voidmite', 'skitterling', { name: 'Void Mite', map: 'selene', hp: 90, speed: 6, pts: 80, mech: 'bound', threat: 2, model: { scale: 0.9, tint: [0xe8e8f8, 0.85], glow: 0x302060 },
    desc: 'A pale mite that learned to hunt in low gravity. It bounds at you from twelve metres away.', tip: 'When one crouches in the distance, it is about to jump. Strafe.' });
  V('boglurker', 'lancer', { name: 'Bog Lurker', map: 'starfall', hp: 300, pts: 120, mech: 'submerge', threat: 3, model: { tint: [0x4a3a22, 0.85], glow: 0x101808 },
    desc: 'It sinks into the mud, crosses the swamp unseen and surfaces right next to you. Nothing can hurt it while it is under.', tip: 'Watch the bubbling mud. Shoot it the moment it breaks the surface.' });
  V('vacuumwisp', 'shrieker', { name: 'Vacuum Wisp', map: 'vesper', hp: 210, pts: 120, mech: 'pull', threat: 3, model: { scale: 0.9, tint: [0x80b0ff, 0.85], glow: 0x2040a0 },
    desc: 'A drifting creature that exhales a tractor current. It drags you toward itself and the swarm.', tip: 'Sprint against the pull, or break line of sight.' });
  V('guardian', 'lancer', { name: 'Temple Guardian', map: 'temple', hp: 420, pts: 180, radius: 0.63, cy: 1.38, mech: 'shield', threat: 3, model: { scale: 1.15, tint: [0xc8a050, 0.85], glow: 0x302008 },
    desc: 'An ancient caste that wears a carved plate across its chest. Shots from the front barely scratch it.', tip: 'Flank it, or use explosives.' });
  UQ.ENEMIES = ['stormstalker', 'magmacrawler', 'frostlancer', 'hullleech', 'gutterhound', 'duneborer', 'sporebloater', 'specimen', 'sewerlurker', 'icewraith', 'slaggolem', 'choirdrone', 'breacher', 'voidmite', 'boglurker', 'vacuumwisp', 'guardian'];
  E.ORDER.push(...UQ.ENEMIES); // in the Bestiary after the regular species

  // ---------- abilities ----------
  const dPl = (e) => Math.hypot(P().pos.x - e.pos.x, P().pos.z - e.pos.z);
  const M = E.MECH;
  M.cloak = { tick(e) {
    const hidden = dPl(e) > 7 && e.t - (e.lastHitT || -9) > 2.5 && e.atkT < 0;
    const k = hidden ? 0.07 : 1;
    if (e.cloakK === undefined) { e.cloakK = 1; for (const m of e.mats) { m.transparent = true; m.userData.op = 1; } }
    e.cloakK += (k - e.cloakK) * 0.12;
    for (const m of e.mats) m.opacity = e.cloakK;
    e.shadow.visible = e.cloakK > 0.5;
  } };
  M.lava = {
    damage: (e, amt, o) => (o.kind === 'fire' || o.burn ? 0 : amt),
    death(e) { E.addPool(e.pos, 2.4, 6, 32, 0xff5a10, 'lava'); FX.embers(e.pos.clone().setY(0.4), 18); },
  };
  M.chill = { hitPlayer() { P().debuff('chill', 2.2, 0.55); } };
  M.drain = { hitPlayer(e) { e.hp = Math.min(e.maxHp * 1.6, e.hp + e.maxHp * 0.45); FX.burst({ pos: e.center(), n: 8, color: 0xff3040, speed: [1, 3], life: [0.3, 0.6], size: [0.25, 0.05] }); } };
  M.pack = { tick(e, dt) {
    e.packT = (e.packT || 0) - dt; if (e.packT > 0) return; e.packT = 0.5;
    for (const o of E.list) if (!o.dead && !o.packed && o.type === 'skitterling' && o !== e && o.pos.distanceTo(e.pos) < 10) { o.packed = true; o.speedMul *= 1.25; }
    if (!e.howled && dPl(e) < 20) { e.howled = true; A.play('wail', { pos: e.pos, vol: 0.8 }); }
  } };
  M.quake = { always: true, tick(e) {
    if (e.state === 'surfaced' && e.lastQ !== 'surfaced') { E.lib.shockwave(e.pos.clone(), 11, 22 * e.dmgMul); FX.dirt(e.pos.clone().setY(0.2), 40); FX.shake(0.4); }
    e.lastQ = e.state;
  } };
  M.spores = { death(e) { UQ.clouds.push({ pos: e.pos.clone().setY(0), r: 4.6, t: 7, mesh: sporeCloud(e.pos) }); } };
  M.regen = {
    tick(e, dt) { if (e.burnT > 0 || e.frozenT > 0 || e.chill > 0.5) return; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.035 * dt); },
    death(e) { for (let k = 0; k < 2; k++) { const s = E.spawn('skitterling', e.pos.x + U.rand(-1, 1), e.pos.z + U.rand(-1, 1), { variant: 'frenzied' }); s.state = 'act'; s.pos.y = 0; } FX.burst({ pos: e.center(), n: 30, color: 0xe8b0a0, color2: 0x8a2030, speed: [2, 7], life: [0.5, 1], size: [0.3, 0.1], grav: 12, add: false }); },
  };
  M.poison = { hitPlayer() { P().debuff('poison', 4, 5); } };
  M.freeze = {
    hitPlayer() { P().debuff('chill', 1.6, 0.35); },
    death(e) { const c = e.center(); FX.shatter(c); if (P().pos.distanceTo(c) < 3.2) P().hurt(14, c); },
  };
  M.slag = {
    tick(e, dt) { e.slagT = (e.slagT || 1) - dt; if (e.slagT <= 0 && Math.hypot(e.vel.x, e.vel.z) > 0.5) { e.slagT = 1.1; E.addPool(e.pos, 1.3, 5, 22, 0xff6020, 'lava'); } },
    damage: (e, amt, o) => (o.kind === 'fire' || o.burn ? 0 : o.kind === 'cryo' || o.freeze ? amt * 2 : amt),
  };
  M.ward = { tick(e, dt) {
    e.wardT = (e.wardT || 0) - dt; if (e.wardT > 0) return; e.wardT = 0.25;
    for (const o of E.list) if (!o.dead && o !== e && o.pos.distanceTo(e.pos) < 9 && Math.random() < 0.35) { const a = e.center(), b = o.center(); for (let k = 1; k < 5; k++) { const q = a.clone().lerp(b, k / 5); FX.one(q.x, q.y, q.z, 0, 0.2, 0, 0.3, 0.2, 0.03, 0xc080ff); } }
  } };
  E.auraMod = (e, amt) => {
    if (e.def.mech === 'ward') return amt;
    for (const o of E.list) if (!o.dead && o.def.mech === 'ward' && o.pos.distanceTo(e.pos) < 9) return amt * 0.5;
    return amt;
  };
  M.breach = { hitPlayer(e, how) { if (how === 'charge') P().debuff('stun', 0.7); } };
  M.bound = { tick(e) {
    if (e.leapT >= 0 || (e.leapCd || 0) > 0 || e.atkT >= 0) return;
    const d = dPl(e); if (d < 6.5 || d > 13 || !W().clearLine(e.pos.x, e.pos.z, P().pos.x, P().pos.z, e.radius, 1)) return;
    const dx = P().pos.x - e.pos.x, dz = P().pos.z - e.pos.z;
    e.leapCd = U.rand(2.5, 4); e.leapT = 0; e.vel.set(dx / d * (d / 0.5) * 0.85, 0, dz / d * (d / 0.5) * 0.85);
    A.creature('skitterling', 'special', { pos: e.pos });
  } };
  M.submerge = {
    tick(e, dt) {
      e.subCd = (e.subCd === undefined ? U.rand(3, 6) : e.subCd) - dt;
      if (!e.sub && e.subCd <= 0 && dPl(e) > 6) { e.sub = 2.4; e.root.visible = false; e.speedMul *= 1.8; FX.dirt(e.pos.clone().setY(0.1), 20); A.play('burrow', { pos: e.pos }); }
      if (e.sub) {
        e.sub -= dt; if (Math.random() < 0.4) FX.one(e.pos.x + U.rand(-0.6, 0.6), 0.1, e.pos.z + U.rand(-0.6, 0.6), 0, 0.6, 0, 0.5, 0.25, 0.04, 0x6a5a2a, 0.8, 0, 1, false);
        if (e.sub <= 0 || dPl(e) < 3.5) { e.sub = 0; e.subCd = U.rand(6, 9); e.root.visible = true; e.speedMul /= 1.8; FX.dirt(e.pos.clone().setY(0.1), 30); A.play('emerge', { pos: e.pos }); }
      }
    },
    damage: (e, amt) => (e.sub ? 0 : amt),
  };
  M.pull = { tick(e, dt) {
    e.pullCd = (e.pullCd === undefined ? 3 : e.pullCd) - dt;
    const d = e.pos.distanceTo(P().pos);
    if (e.pullCd <= 0 && d < 16 && d > 3) { e.pullT = 1.6; e.pullCd = U.rand(5, 7); A.play('wail', { pos: e.pos, vol: 0.6 }); }
    if (e.pullT > 0) {
      e.pullT -= dt;
      const Pl = P(), dir = e.pos.clone().sub(Pl.pos).setY(0); const len = dir.length();
      if (len > 2.5 && !Pl.downed) { dir.normalize(); Pl.vel.x += dir.x * 16 * dt; Pl.vel.z += dir.z * 16 * dt; Pl.stamina = Math.max(0, Pl.stamina - dt * 1.5); }
      if (Math.random() < 0.6) { const q = Pl.pos.clone().lerp(e.pos, Math.random()); FX.one(q.x, q.y + 1, q.z, (e.pos.x - q.x) * 2, 0, (e.pos.z - q.z) * 2, 0.35, 0.15, 0.03, 0x80b0ff); }
    }
  } };
  M.shield = { damage(e, amt, o) {
    if (!o.dir || o.kind === 'explosive' || o.kind === 'fire') return amt;
    const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
    if (fx * o.dir.x + fz * o.dir.z < -0.3) { if (Math.random() < 0.3 && o.point) FX.sparks(o.point, o.dir.clone().negate()); return amt * 0.25; }
    return amt;
  } };

  // spore clouds (Spore Bloater) and enemy-hurting pools (unique weapons)
  UQ.clouds = []; UQ.epools = []; UQ.wells = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0x7ac040, transparent: true, opacity: 0.3, depthWrite: false });
  function sporeCloud(pos) {
    const g = new THREE.Group(); g.position.set(pos.x, 0, pos.z);
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat); m.position.set(U.rand(-2, 2), U.rand(0.6, 2), U.rand(-2, 2)); m.scale.setScalar(U.rand(1.4, 2.2)); g.add(m); }
    W().root.add(g); return g;
  }

  // ======================================================================
  //  Unique perks
  // ======================================================================
  const UP = XH.UPERKS = {
    conduit: { name: 'Storm Conduit', icon: '⚡', color: 0x60e0ff, css: '#60e0ff', cost: 3000, desc: 'Every 6th hit calls down a lightning strike' },
    magmablood: { name: 'Magma Blood', icon: '♨', color: 0xff6020, css: '#ff7a30', cost: 2500, desc: 'Immune to lava and fire; your knife sets creatures ablaze' },
    permafrost: { name: 'Permafrost', icon: '❄', color: 0xa8e0ff, css: '#a8e0ff', cost: 3000, desc: 'Creatures that hit you freeze solid; you cannot be chilled' },
    lifesupport: { name: 'Life Support', icon: '✚', color: 0x40ff90, css: '#40ff90', cost: 3000, desc: 'Health starts regenerating much sooner, and twice as fast' },
    streetsmarts: { name: 'Street Smarts', icon: '$', color: 0xffd040, css: '#ffd040', cost: 2500, desc: '+20% points; wall weapons and ammo restocks cost 15% less' },
    dustdevil: { name: 'Dust Devil', icon: '≋', color: 0xe0b070, css: '#e0b070', cost: 2500, desc: 'Sprint 8% faster and dodge 30% of hits while sprinting' },
    symbiote: { name: 'Symbiote', icon: '❦', color: 0x7dff7a, css: '#7dff7a', cost: 3000, desc: '+15 max health; every kill restores 4 health' },
    genesplice: { name: 'Gene Splice', icon: '⚕', color: 0x60e8ff, css: '#60e8ff', cost: 3000, desc: '12% of hits mutate the target: it takes +50% damage for 4 s' },
    hazmat: { name: 'Hazmat Suit', icon: '☣', color: 0xb8e070, css: '#b8e070', cost: 2000, desc: 'Immune to acid pools, poison, spores and Burster blasts' },
    cryorounds: { name: 'Cryo Rounds', icon: '✱', color: 0x9ad8ff, css: '#9ad8ff', cost: 3000, desc: 'Every hit chills; enough hits freeze a creature solid' },
    forgefire: { name: 'Forgefire', icon: '⚒', color: 0xff7a30, css: '#ff7a30', cost: 2500, desc: 'After each reload, the next 8 shots set creatures on fire' },
    choirward: { name: 'Choir Ward', icon: '♫', color: 0xd070ff, css: '#d070ff', cost: 3000, desc: 'Every 10 s a pulse shoves and stuns creatures around you' },
    fortified: { name: 'Fortified', icon: '⛨', color: 0x9aa860, css: '#b8c878', cost: 3000, desc: '+50 max health and 10% less damage taken' },
    moonboots: { name: 'Moon Boots', icon: '⤒', color: 0xe0e8ff, css: '#e0e8ff', cost: 2000, desc: 'Double jump, and jump 25% higher' },
    salvager: { name: 'Salvager', icon: '⚙', color: 0x9adf70, css: '#9adf70', cost: 2500, desc: '6% of kills drop an ammo cache for your weapon' },
    kinetic: { name: 'Kinetic Barrier', icon: '◈', color: 0x80a8ff, css: '#80a8ff', cost: 3000, desc: 'Blocks one hit completely every 10 s' },
    relichunter: { name: 'Relic Hunter', icon: '☥', color: 0xffd070, css: '#ffd070', cost: 2500, desc: 'Power-ups drop 30% more often and last twice as long' },
  };
  for (const id in UP) { UP[id].id = id; UP[id].unique = true; }
  const has = (id) => P().perks && P().perks.has(id);
  UQ.perkBonus = () => (cur().perk && W().perks.some((m) => m.unique) ? 1 : 0);
  UQ.hpBonus = () => (has('fortified') ? 50 : 0) + (has('symbiote') ? 15 : 0);
  UQ.pointsMul = () => (has('streetsmarts') ? 1.2 : 1);
  UQ.priceMul = (kind) => (has('streetsmarts') && (kind === 'wall' || kind === 'ammo') ? 0.85 : 1);
  UQ.dropMul = () => (has('relichunter') ? 1.3 : 1);
  UQ.puMul = () => (has('relichunter') ? 2 : 1);
  UQ.jumpMul = () => (has('moonboots') ? 1.12 : 1);
  UQ.doubleJump = () => has('moonboots');
  UQ.sprintMul = () => (has('dustdevil') ? 1.08 : 1);
  UQ.regen = () => (has('lifesupport') ? { delay: 1.2, rate: 2 } : null);
  UQ.immune = (kind) => (kind === 'lava' || kind === 'fire' ? has('magmablood') : kind === 'acid' || kind === 'poison' || kind === 'spore' || kind === 'burst' ? has('hazmat') : kind === 'chill' ? has('permafrost') : false);
  UQ.hurtMod = (amt, from, explosive) => {
    const Pl = P();
    if (has('kinetic') && (Pl.kineticT || 0) <= Pl.time) { Pl.kineticT = Pl.time + 10; FX.ring(Pl.pos.clone().setY(1), 2.2, 0x80a8ff, 0.3); A.play('shieldHit'); return 0; }
    if (has('dustdevil') && Pl.sprinting && Math.random() < 0.3) { FX.burst({ pos: Pl.pos.clone().setY(0.4), n: 10, color: 0xe0b070, speed: [1, 3], life: [0.3, 0.6], size: [0.4, 0.8], add: false, alpha: 0.4 }); return 0; }
    if (has('permafrost') && from && from.isVector3) { const e = E.nearest(from.clone().setY(1), 2.5); if (e && !e.def.boss && (e.pfT || 0) < e.t) { e.pfT = e.t + 4; e.frozenT = Math.max(e.frozenT, e.def.heavy ? 0.8 : 1.6); FX.shatter(e.center()); } }
    if (has('fortified')) amt *= 0.9;
    if (explosive && has('hazmat')) amt = 0;
    return amt;
  };

  // ======================================================================
  //  Unique weapons
  // ======================================================================
  Object.assign(XH.WTRAITS, {
    thunder: ['Stormcall', 'Every 7th hit calls lightning down on the target'],
    magma: ['Magma Pool', 'Kills leave molten pools that burn creatures'],
    glacial: ['Glacial', 'Freezes what it hits; frozen kills shatter into shrapnel'],
    rivet: ['Rivet', 'Every hit pins the target in place for a moment'],
    neon: ['Neon Rush', 'Kills in quick succession raise the fire rate, up to +60%'],
    sandblast: ['Sandblast', 'Blinds what it hits: blinded creatures cannot attack for a second'],
    toxin: ['Toxin', 'Poisons the target for 3 s'],
    genesplice: ['Gene Splice', 'Kills heal you; some kills turn a nearby creature'],
    sludge: ['Sludge', 'Impacts leave acid pools that eat creatures'],
    avalanche: ['Avalanche', 'Impacts burst into freezing ice shards'],
    forge: ['Forged Slug', 'Every hit explodes and burns'],
    hymn: ['Hymn', 'Stuns and marks everything it hits'],
    fortress: ['Fortress', 'While you keep firing you take up to 30% less damage'],
    lowgrav: ['Low Gravity', 'Hits lift creatures off the ground, helpless'],
    flare: ['Flare', 'Impacts mark and ignite everything nearby'],
    minivoid: ['Micro Singularity', 'Kills open a small gravity well that drags creatures in'],
    glaive: ['Relic Glaive', 'Hits leap to a second creature'],
  });
  if (WP.defineGuns) WP.defineGuns([
    ['stormcaller', 'ar', 'Stormcaller', 'Stormcaller Tempest', 'Kestrel: lightning rifle', ['thunder', 'steady'], { dmg: 66, rate: 0.1, mag: 30, reserve: 240, cost: 3000, tracer: 0x9fd8ff, flash: 0x9fd8ff, map: 'kestrel' }, { body: [0.52, 0.13, 0.062, 'energy'], color: 'gunmetal', glow: 0x60e0ff, barrel: [0.28, 0.018], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'holo', extras: ['coils'] }],
    ['magmapump', 'shotgun', 'Magma Pump', 'Magma Cataclysm', 'Depths: molten shotgun', ['magma', 'incendiary'], { dmg: 44, pellets: 8, rate: 0.75, mag: 6, reserve: 54, cost: 3000, flash: 0xff6020, map: 'depths' }, { body: [0.44, 0.13, 0.062, 'bulky'], color: 'red', accent: 0x1a1a1a, glow: 0xff5010, barrel: [0.4, 0.026], shroud: 'vented', mag: 'tube', stock: 'fixed', optic: 'irons', muzzle: 'bell' }],
    ['glacierlance', 'sniper', 'Glacier Lance', 'Glacier Absolute', 'Frostfall: freezing sniper', ['glacial', 'overpen'], { dmg: 720, rate: 1.0, mag: 5, reserve: 40, pierce: 6, cost: 3500, beam: 0x9ad8ff, flash: 0x9ad8ff, map: 'frostfall' }, { body: [0.62, 0.12, 0.06, 'energy'], color: 'white', glow: 0x9ad8ff, barrel: [0.5, 0.017], shroud: 'fins', muzzle: 'energy', mag: 'cell', stock: 'heavy', optic: 'long', lens: 0x9ad8ff }],
    ['rivetdriver', 'smg', 'Rivet Driver', 'Rivet Hullbreaker', 'Ark: pinning nail SMG', ['rivet', 'overpen'], { dmg: 44, rate: 0.075, mag: 40, reserve: 280, cost: 2800, snd: 'saw', map: 'ark' }, { body: [0.4, 0.13, 0.06, 'bulky'], color: 'yellow', accent: 0x151515, barrel: [0.16, 0.02], shroud: 'rails', mag: 'drum', stock: 'skeleton', optic: 'irons', fore: 'handle' }],
    ['neoncutter', 'smg', 'Neon Cutter', 'Neon Overdrive', 'City: streak SMG', ['neon', 'hipfire'], { dmg: 32, rate: 0.055, mag: 40, reserve: 320, cost: 2600, tracer: 0xff40c0, flash: 0xff40c0, map: 'city' }, { body: [0.36, 0.11, 0.05, 'energy'], color: 'black', glow: 0xff40c0, barrel: [0.12, 0.014], muzzle: 'energy', mag: 'curved', stock: 'wire', optic: 'red' }],
    ['sandstorm', 'shotgun', 'Sandstorm', 'Sandstorm Simoom', 'Dust Basin: blinding auto-shotgun', ['sandblast', 'knockback'], { auto: true, dmg: 30, pellets: 10, rate: 0.26, mag: 12, reserve: 96, cost: 3000, map: 'dustbasin' }, { body: [0.46, 0.14, 0.066, 'bulky'], color: 'tan', accent: 0x3a2a1a, barrel: [0.3, 0.026], shroud: 'vented', mag: 'drum', stock: 'fixed', optic: 'holo', muzzle: 'brake' }],
    ['thornthrower', 'pistol', 'Thorn Thrower', 'Thorn Queen', 'Verdant: poison needles', ['toxin', 'homing'], { mode: 'proj', auto: true, dmg: 62, rate: 0.1, mag: 28, reserve: 196, snd: 'spit', flash: 0x7dff7a, proj: { speed: 40, r: 0.9, color: 0x7dff7a, size: 0.12, homing: true }, cost: 2600, cal: 'THORN', map: 'verdant' }, { body: [0.3, 0.1, 0.045, 'organic'], color: 'green', glow: 0x7dff7a, barrel: [0.08, 0.016], mag: 'none', stock: 'organic', extras: ['spikes'] }],
    ['generipper', 'energy', 'Gene Ripper', 'Gene Ripper Omega', 'Helix: splicing beam', ['beam', 'genesplice'], { mode: 'beam', dmg: 26, rate: 0.04, mag: 100, reserve: 500, pierce: 2, range: 40, beam: 0x60e8ff, cost: 3500, map: 'helix' }, { body: [0.46, 0.13, 0.065, 'energy'], color: 'white', glow: 0x60e8ff, barrel: [0.26, 0.02], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'fixed', extras: ['orb'] }],
    ['sludgemortar', 'launcher', 'Sludge Mortar', 'Sludge Deluge', 'Undercroft: acid mortar', ['sludge', 'explosive'], { dmg: 520, rate: 0.85, mag: 4, reserve: 24, proj: { speed: 26, grav: 14, r: 4.5, color: 0xb8e070, size: 0.24, grenade: true }, cost: 3200, map: 'undercroft' }, { body: [0.38, 0.14, 0.08, 'organic'], color: 'green', glow: 0xb8e070, barrel: [0.26, 0.045], mag: 'cyl', stock: 'fixed', extras: ['tank'] }],
    ['avalanche', 'launcher', 'Avalanche', 'Avalanche Glacier', 'Glacier: ice-shard launcher', ['avalanche', 'explosive'], { dmg: 460, rate: 0.85, mag: 4, reserve: 24, snd: 'cryo', proj: { speed: 30, grav: 12, r: 4, color: 0xa8f0ff, size: 0.22, grenade: true }, cost: 3200, map: 'glacier' }, { body: [0.36, 0.14, 0.08, 'energy'], color: 'white', glow: 0xa8f0ff, barrel: [0.28, 0.042], shroud: 'fins', mag: 'cyl', stock: 'fixed', optic: 'red' }],
    ['forgehammer', 'pistol', 'Forge Hammer', 'Forge Titan', 'Crucible: exploding slugs', ['forge', 'stagger'], { dmg: 420, rate: 0.45, mag: 6, reserve: 48, recoil: 0.09, snd: 'magnum', flash: 0xff7a30, cost: 2800, cal: 'SLAG', map: 'crucible' }, { body: [0.34, 0.11, 0.045, 'revolver'], color: 'black', lower: 'gunmetal', gripMat: 'wood', accent: 0xff7a30, glow: 0xff5010, barrel: [0.16, 0.02], mag: 'none' }],
    ['hymnofruin', 'special', 'Hymn of Ruin', 'Hymn of Oblivion', 'Cathedral: stunning hymn', ['hymn', 'knockback'], { mode: 'wave', auto: false, dmg: 300, range: 13, cone: 0.5, push: 10, rate: 0.6, mag: 12, reserve: 72, reload: 2.2, snd: 'wave', flash: 0xd070ff, recoil: 0.05, cost: 3500, map: 'cathedral' }, { body: [0.42, 0.15, 0.08, 'organic'], color: 'purple', glow: 0xd070ff, barrel: [0.2, 0.04], muzzle: 'bell', mag: 'none', stock: 'organic', extras: ['cage'] }],
    ['wardenm2', 'lmg', 'Warden M2', 'Warden Citadel', 'Bastion: fortress LMG', ['fortress', 'suppress'], { dmg: 62, rate: 0.08, mag: 120, reserve: 480, cost: 3200, map: 'bastion' }, { body: [0.62, 0.16, 0.078, 'bulky'], color: 'olive', accent: 0xc89a20, barrel: [0.36, 0.024], shroud: 'heavy', muzzle: 'brake', mag: 'belt', stock: 'heavy', fore: 'handle', extras: ['bipod'] }],
    ['moondriver', 'sniper', 'Moon Driver', 'Moon Driver Apogee', 'Selene: lifting railgun', ['lowgrav', 'overpen'], { dmg: 780, rate: 0.9, mag: 5, reserve: 40, pierce: 8, beam: 0xe0e8ff, flash: 0xe0e8ff, snd: 'rail', cost: 3500, cal: 'FERRO', map: 'selene' }, { body: [0.6, 0.12, 0.06, 'energy'], color: 'white', glow: 0xc0c8ff, barrel: [0.48, 0.017], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'heavy', optic: 'long', lens: 0xc0c8ff }],
    ['flaregun', 'pistol', 'Flare Pistol', 'Flare Supernova', 'Starfall: igniting flares', ['flare', 'incendiary'], { mode: 'proj', dmg: 200, rate: 0.35, mag: 4, reserve: 48, snd: 'launcher', flash: 0xff5030, proj: { speed: 45, grav: 4, r: 2.5, color: 0xff5030, size: 0.16 }, cost: 2400, cal: 'FLARE', map: 'starfall' }, { body: [0.28, 0.1, 0.05], color: 'red', accent: 0xffc020, barrel: [0.1, 0.03], mag: 'none', pistol: true }],
    ['singularitycarbine', 'ar', 'Singularity Carbine', 'Singularity Event', 'Vesper: gravity-well rifle', ['minivoid'], { dmg: 58, rate: 0.095, mag: 30, reserve: 240, tracer: 0xb040ff, flash: 0xb040ff, snd: 'plasma', cost: 3500, cal: 'VOID', map: 'vesper' }, { body: [0.5, 0.13, 0.06, 'energy'], color: 'purple', glow: 0xb040ff, barrel: [0.26, 0.018], shroud: 'coil', muzzle: 'energy', mag: 'cell', stock: 'fixed', optic: 'energy', extras: ['orb'] }],
    ['relicglaive', 'launcher', 'Relic Glaive', 'Relic Sunglaive', 'Temple: leaping glaives', ['glaive', 'ricochet'], { dmg: 320, rate: 0.6, mag: 6, reserve: 48, snd: 'saw', proj: { speed: 30, grav: 0, r: 0, color: 0xffd070, size: 0.12, saw: true }, cost: 3200, cal: 'RELIC', map: 'temple' }, { body: [0.42, 0.14, 0.08, 'organic'], color: 'tan', glow: 0xffd070, barrel: [0.2, 0.05], mag: 'none', stock: 'organic', extras: ['orb'] }],
  ]);
  UQ.WEAPONS = Object.values(MAP).map((m) => m.weapon);

  // ---------- weapon and perk effects on hits ----------
  const radiusHit = (pos, r, dmg, o) => E.radiusDamage(pos, r, dmg, Object.assign({ weapon: 'unique' }, o));
  UQ.hitMod = (e, amt, o, slot) => {
    const tr = slot && slot.s.traits, Pl = P();
    if (o.kind === 'melee' && has('magmablood')) { e.burnT = 3; e.burnDps = Math.max(e.burnDps || 0, 40 * E.hpMul(G().round)); }
    if (o.chain || o.kind === 'arc' && o.weapon === 'unique') return amt;
    if (has('conduit') && ++UQ.hits % 6 === 0) strike(e, amt * 1.5);
    if (has('genesplice') && Math.random() < 0.12) { e.markT = e.t + 4; e.gsT = e.t + 4; }
    if (e.gsT > e.t) amt *= 1.5 / 1.2;
    if (has('cryorounds') && !e.def.boss) { e.chill = Math.min(1.3, (e.chill || 0) + (e.def.heavy ? 0.06 : 0.14)); if (e.chill >= 1 && e.frozenT <= 0) e.frozenT = e.def.heavy ? 1 : 2; }
    if (has('forgefire') && (Pl.forgeShots || 0) > 0 && o.weapon === (slot && slot.id)) { e.burnT = 3; e.burnDps = Math.max(e.burnDps || 0, 30 * E.hpMul(G().round)); }
    if (!tr) return amt;
    if (tr.has('thunder') && ++UQ.thunder % 7 === 0) strike(e, amt * 3);
    if (tr.has('glacial') && !e.def.boss) e.frozenT = Math.max(e.frozenT, e.def.heavy ? 0.8 : 2.2);
    if (tr.has('rivet')) e.stunT = Math.max(e.stunT, e.def.boss ? 0.05 : e.def.heavy ? 0.12 : 0.35);
    if (tr.has('sandblast')) e.blindT = e.t + 1.2;
    if (tr.has('toxin')) { e.poisonT = e.t + 3; e.poisonDps = Math.max(e.poisonDps || 0, amt * 0.35); }
    if (tr.has('forge') && !o.forged) { radiusHit(e.center(), 2.3, amt * 0.35, { kind: 'explosive', forged: true }); FX.explosion(e.center(), 2, 0xff7a30); e.burnT = 3; e.burnDps = Math.max(e.burnDps || 0, 30 * E.hpMul(G().round)); }
    if (tr.has('hymn')) { e.stunT = Math.max(e.stunT, e.def.boss ? 0.2 : 1); e.markT = e.t + 4; }
    if (tr.has('lowgrav') && !e.def.boss && !e.fly) { e.floatT = e.t + (e.def.heavy ? 0.9 : 1.8); e.stunT = Math.max(e.stunT, e.def.heavy ? 0.9 : 1.8); }
    if (tr.has('glaive') && !o.glaived) { const n = E.nearest(e.center(), 5, (q) => q !== e); if (n) { FX.bolt(e.center(), n.center(), 0xffd070, 0.15, 6, 0.4); E.damage(n, amt * 0.5, { kind: 'arc', weapon: o.weapon, glaived: true, point: n.center() }); } }
    return amt;
  };
  UQ.hits = 0; UQ.thunder = 0;
  function strike(e, dmg) {
    const c = e.center(); FX.bolt(c.clone().add(new THREE.Vector3(U.rand(-2, 2), 16, U.rand(-2, 2))), c, 0xc8f0ff, 0.25, 12, 1.2);
    FX.flash(c, 0xc8f0ff, 6, 0.2, 18); A.play('arc', { pos: c });
    radiusHit(c, 3.2, dmg, { kind: 'arc', chain: true });
  }
  UQ.killMod = (e, o, slot) => {
    const tr = slot && slot.s.traits, Pl = P(); let m = 1;
    if (has('symbiote')) Pl.hp = Math.min(Pl.maxHp, Pl.hp + 4);
    if (has('salvager') && Math.random() < 0.06) salvage(e.pos);
    if (tr) {
      if (tr.has('magma')) UQ.epools.push({ pos: e.pos.clone().setY(0), r: 2.2, t: 5, kind: 'fire', mesh: poolMesh(e.pos, 2.2, 0xff5a10) });
      if (tr.has('glacial') && e.frozenT > 0) { FX.shatter(e.center()); radiusHit(e.center(), 3, 180 * E.hpMul(G().round), { kind: 'explosive', forged: true }); }
      if (tr.has('neon')) { const t = Pl.time; UQ.neon = t - (UQ.neonT || -9) < 2 ? Math.min(5, (UQ.neon || 0) + 1) : 1; UQ.neonT = t; }
      if (tr.has('genesplice')) { Pl.hp = Math.min(Pl.maxHp, Pl.hp + 6); if (Math.random() < 0.12) { const n = E.nearest(e.center(), 6, (q) => q !== e && !q.def.boss && !q.def.heavy); if (n) { n.turned = 6; FX.ring(n.pos.clone().setY(0.2), 2, 0x70ff70, 0.4); } } }
      if (tr.has('minivoid')) UQ.wells.push({ pos: e.center(), t: 2.5, mesh: wellMesh(e.center()) });
    }
    return m;
  };
  UQ.rateMul = () => { const s = WP.cur(); if (s && s.s.traits && s.s.traits.has('neon') && P().time - (UQ.neonT || -9) < 2.5) return 1 / (1 + 0.12 * (UQ.neon || 0)); return 1; };
  UQ.onReload = () => { if (has('forgefire')) P().forgeShots = 9; };
  UQ.onShot = () => { const Pl = P(); if (Pl.forgeShots > 0) Pl.forgeShots--; };
  UQ.onExplode = (pos, r, dmg, wid) => {
    const d = WP.DEFS[wid], tr = d && d.traits; if (!tr) return;
    if (tr.includes('sludge')) UQ.epools.push({ pos: pos.clone().setY(0), r: r * 0.8, t: 6, kind: 'acid', mesh: poolMesh(pos, r * 0.8, 0xb8e070) });
    if (tr.includes('avalanche')) { FX.shatter(pos.clone().setY(1)); for (const e of E.list) if (!e.dead && e.pos.distanceTo(pos) < r * 1.4 && !e.def.boss) { e.chill = Math.min(1.3, (e.chill || 0) + 0.8); if (e.chill >= 1) e.frozenT = Math.max(e.frozenT, 2); } }
    if (tr.includes('flare')) { for (const e of E.list) if (!e.dead && e.pos.distanceTo(pos) < 4) { e.markT = e.t + 5; e.burnT = 4; e.burnDps = Math.max(e.burnDps || 0, 45 * E.hpMul(G().round)); } FX.flash(pos, 0xff5030, 6, 1.2, 14); }
  };
  UQ.fortress = () => { const s = WP.cur(); return s && s.s.traits && s.s.traits.has('fortress') && WP.firing ? Math.min(1, (UQ.fortT || 0) / 2) * 0.3 : 0; };
  const poolMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, map: FX.softTex });
  UQ.poolMesh = (pos, r, c) => poolMesh(pos, r, c);
  function poolMesh(pos, r, c) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), poolMat(c)); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.05, pos.z); W().root.add(m); return m; }
  function wellMesh(pos) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), new THREE.MeshBasicMaterial({ color: 0x1a0030 })); m.position.copy(pos); W().root.add(m); const g = FX.glowSprite(0xb040ff, 3, 0.8); m.add(g); return m; }
  function salvage(pos) {
    const g = new THREE.Group(); g.position.set(pos.x, 0.3, pos.z); W().root.add(g);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: 0x4a5a34, emissive: 0x203010 })); g.add(m);
    const gl = FX.glowSprite(0x9adf70, 1.4, 0.7); g.add(gl);
    UQ.caches.push({ g, pos: pos.clone().setY(0), t: 20 });
  }
  UQ.caches = [];

  // ======================================================================
  //  Placement (called by world.js after structures.js)
  // ======================================================================
  UQ.build = (c) => {
    const Wd = XH.world, ST = XH.structures, u = MAP[c.def.id]; UQ.clear();
    if (!u || !ST || !ST.free) return;
    // the perk machine: on the platform if there is one (climb for it), otherwise somewhere open
    const pk = UP[u.perk];
    if (pk) {
      const pl = ST.platform, pu = XH.edits && XH.edits.pin('uperk');
      if (pu) {
        Wd.makePerkMachine(pk, pu.x, pu.z, pu.dx || 0, pu.dx ? 0 : pu.dz || 1, { unique: true, key: u.perk });
        const cx = Wd.cellX(pu.x), cz = Wd.cellZ(pu.z), i = cz * Wd.w + cx; Wd.solid[i] = 2; Wd.soft[i] = 1; Wd.hgt[i] = 0; Wd.keepClear.push([pu.x, pu.z, 3]);
        Wd.piece('uperk', { label: 'Map perk machine: ' + pk.name, shape: 'point', x: pu.x, z: pu.z, r: 0.9, dx: pu.dx || 0, dz: pu.dx ? 0 : pu.dz || 1, turn: true });
      } else if (pl) {
        const [dx, dz] = [pl.stairs.dx, pl.stairs.dz], x = pl.c.x - dx * (pl.half - 1.1), z = pl.c.z - dz * (pl.half - 1.1);
        Wd.makePerkMachine(pk, x, z, dx, dz, { y: pl.deckY, unique: true, key: u.perk });
        Wd.piece('uperk', { label: 'Map perk machine: ' + pk.name + ' (on the platform)', shape: 'point', x, z, r: 0.9, dx, dz, turn: true });
      } else {
        const list = ST.freeRects(3, 3), s = Wd.start;
        list.sort((a, b) => Math.abs(Math.hypot(Wd.cx2x(a.x + 1) - s.x, Wd.cz2z(a.z + 1) - s.z) - 30) - Math.abs(Math.hypot(Wd.cx2x(b.x + 1) - s.x, Wd.cz2z(b.z + 1) - s.z) - 30));
        const r = list[0];
        if (r) {
          const cx = r.x + 1, cz = r.z + 1, [dx, dz] = c.openDir(cx, cz);
          Wd.makePerkMachine(pk, Wd.cx2x(cx), Wd.cz2z(cz), dx, dz, { unique: true, key: u.perk });
          Wd.piece('uperk', { label: 'Map perk machine: ' + pk.name, shape: 'point', x: Wd.cx2x(cx), z: Wd.cz2z(cz), r: 0.9, dx, dz, turn: true });
          const i = cz * Wd.w + cx; Wd.solid[i] = 2; Wd.soft[i] = 1; Wd.hgt[i] = 0;
          ST.claim(r, 1); Wd.keepClear.push([Wd.cx2x(cx), Wd.cz2z(cz), 3]);
        }
      }
    }
    // the weapon: a gold-framed wall board inside the building, otherwise on an open wall away from the start
    if (u.weapon && WP.DEFS[u.weapon]) {
      const b = ST.building, pw = XH.edits && XH.edits.pin('uweapon'), nm = 'Map gun: ' + WP.DEFS[u.weapon].name;
      if (pw) { Wd.makeWallBuy(u.weapon, pw.x, pw.z, pw.dx || 0, pw.dx ? 0 : pw.dz || 1, { frame: 0xffc030 }); Wd.keepClear.push([pw.x, pw.z, 2.6]); Wd.piece('uweapon', { label: nm, shape: 'wall', x: pw.x, z: pw.z, r: 0.7, dx: pw.dx || 0, dz: pw.dx ? 0 : pw.dz || 1, gun: true }); }
      else if (b) { Wd.makeWallBuy(u.weapon, b.sideWall.x, b.sideWall.z, b.sideWall.dx, b.sideWall.dz, { frame: 0xffc030 }); Wd.piece('uweapon', { label: nm + ' (in the building)', shape: 'wall', x: b.sideWall.x, z: b.sideWall.z, r: 0.7, dx: b.sideWall.dx, dz: b.sideWall.dz, gun: true }); }
      else { const s = ST.wallSpot(false); if (s) { Wd.makeWallBuy(u.weapon, s.x + s.dx * 0.53, s.z + s.dz * 0.53, s.dx, s.dz, { frame: 0xffc030 }); Wd.keepClear.push([s.x, s.z, 2.6]); Wd.piece('uweapon', { label: nm, shape: 'wall', x: s.x + s.dx * 0.53, z: s.z + s.dz * 0.53, r: 0.7, dx: s.dx, dz: s.dz, gun: true }); } }
    }
  };
  UQ.clear = () => { UQ.clouds.length = 0; UQ.epools.length = 0; UQ.wells.length = 0; UQ.caches.length = 0; UQ.hits = 0; UQ.thunder = 0; UQ.neon = 0; };
  UQ.enemyFor = (id) => (MAP[id] || {}).enemy;

  // ======================================================================
  //  Runtime
  // ======================================================================
  UQ.candidates = () => {};
  UQ.update = (dt) => {
    const Pl = P(), t = Pl.time;
    // spore clouds
    for (let i = UQ.clouds.length - 1; i >= 0; i--) {
      const c = UQ.clouds[i]; c.t -= dt;
      c.mesh.children.forEach((m, k) => { m.material.opacity = Math.min(0.3, c.t * 0.1); m.position.y += Math.sin(t + k) * dt * 0.1; });
      if (Pl.pos.distanceTo(c.pos) < c.r && !UQ.immune('spore')) Pl.debuff('spore', 0.6, 0.7);
      if (c.t <= 0) { c.mesh.parent && c.mesh.parent.remove(c.mesh); UQ.clouds.splice(i, 1); }
    }
    // pools that hurt creatures (weapon effects)
    UQ.tickT = (UQ.tickT || 0) - dt; const tick = UQ.tickT <= 0; if (tick) UQ.tickT = 0.4;
    for (let i = UQ.epools.length - 1; i >= 0; i--) {
      const p = UQ.epools[i]; p.t -= dt; p.mesh.material.opacity = Math.min(0.5, p.t * 0.25);
      if (tick) for (const e of E.list) if (!e.dead && !e.fly && e.pos.distanceTo(p.pos) < p.r) { if (p.kind === 'fire') { e.burnT = 2; e.burnDps = Math.max(e.burnDps || 0, 35 * E.hpMul(G().round)); } else E.damage(e, 28 * E.hpMul(G().round), { kind: 'acid', weapon: 'unique', quiet: true }); }
      if (p.t <= 0) { p.mesh.parent && p.mesh.parent.remove(p.mesh); UQ.epools.splice(i, 1); }
    }
    // micro singularities
    for (let i = UQ.wells.length - 1; i >= 0; i--) {
      const w = UQ.wells[i]; w.t -= dt; w.mesh.scale.setScalar(0.6 + Math.sin(t * 20) * 0.1);
      for (const e of E.list) { if (e.dead || e.def.boss) continue; const d = e.pos.distanceTo(w.pos); if (d < 6 && d > 0.4) { const k = (e.def.heavy ? 2 : 7) * dt; e.pos.x += (w.pos.x - e.pos.x) / d * k; e.pos.z += (w.pos.z - e.pos.z) / d * k; } }
      if (tick) E.radiusDamage(w.pos, 2.2, 40 * E.hpMul(G().round), { kind: 'void', weapon: 'unique' });
      if (w.t <= 0) { w.mesh.parent && w.mesh.parent.remove(w.mesh); UQ.wells.splice(i, 1); }
    }
    // toxin ticks, floating creatures
    if (tick) for (const e of E.list) if (!e.dead && e.poisonT > e.t) { E.damage(e, e.poisonDps * 0.4, { kind: 'poison', weapon: 'unique', quiet: true }); FX.one(e.pos.x, e.pos.y + e.def.cy, e.pos.z, 0, 1, 0, 0.5, 0.2, 0.04, 0x7dff7a); }
    // salvage caches
    for (let i = UQ.caches.length - 1; i >= 0; i--) {
      const c = UQ.caches[i]; c.t -= dt; c.g.rotation.y += dt * 2;
      if (Math.hypot(Pl.pos.x - c.pos.x, Pl.pos.z - c.pos.z) < 1.4) { const s = WP.cur(); if (s) { s.reserve = Math.min(s.s.reserve, s.reserve + Math.ceil(s.s.reserve * 0.25)); XH.ui.weaponChanged(s); } A.play('grab'); c.t = 0; }
      if (c.t <= 0) { c.g.parent && c.g.parent.remove(c.g); UQ.caches.splice(i, 1); }
    }
    // Choir Ward pulse
    if (has('choirward') && !Pl.downed) {
      Pl.wardT = (Pl.wardT === undefined ? 10 : Pl.wardT) - dt;
      if (Pl.wardT <= 0) {
        Pl.wardT = 10; FX.ring(Pl.pos.clone().setY(0.3), 5, 0xd070ff, 0.5); A.play('wave', { vol: 0.5 });
        for (const e of E.list) { if (e.dead) continue; const d = Math.hypot(e.pos.x - Pl.pos.x, e.pos.z - Pl.pos.z); if (d < 5 && d > 0.1) { e.stunT = Math.max(e.stunT, e.def.boss ? 0.2 : 1.2); if (!e.def.boss) e.vel.add(new THREE.Vector3((e.pos.x - Pl.pos.x) / d, 0, (e.pos.z - Pl.pos.z) / d).multiplyScalar(e.def.heavy ? 3 : 9)); } }
      }
    }
    // Fortress build-up
    UQ.fortT = WP.firing ? Math.min(2, (UQ.fortT || 0) + dt) : Math.max(0, (UQ.fortT || 0) - dt * 2);
  };
})();
