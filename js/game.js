'use strict';
// Game director: rounds, spawning, economy, interactables (doors, wall-buys, perks, box, forge, power), power-ups.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const Gm = XH.game = { state: 'menu', round: 0, points: 0, insta: 0, double: 0, sale: 0, stats: {}, diffMul: 1, mods: XH.MODS.defaults(), heat: 0, buffs: { ghost: 0, bottomless: 0, undying: 0 } };
  const md = () => Gm.mods;
  Gm.price = (n) => Math.round(n * (md().inflation ? 2 : 1));
  let scene;
  const W = () => XH.world, E = () => XH.enemies, WP = () => XH.weapons, P = () => XH.player, UI = () => XH.ui;
  Gm.init = (sc) => { scene = sc; };
  Gm.playing = () => Gm.state === 'playing';

  // =================== session ===================
  Gm.start = (def, startRound = 1, mods) => {
    Gm.state = 'loading';
    if (XH.events) XH.events.reset();
    Gm.mods = Object.assign(XH.MODS.defaults(), mods || Gm.mods || {});
    Gm.heat = XH.MODS.heat(Gm.mods);
    E().clear(); FX.clear(); clearPowerups();
    if (Gm.box) { scene.remove(Gm.box.group); Gm.box = null; }
    W().build(def, scene);
    FX.setWeather(def.weather, def.weatherColor);
    A.ambience(def.weather);
    A.music.setStyle(def.music);
    WP().setVMLight(def.ambient.sky, def.ambient.ground);
    P().reset(W().start);
    if (XH.classes) XH.classes.apply();
    WP().rebuildPool(def.id);
    if (XH.victory) XH.victory.reset();
    Gm.bossCount = 0; Gm.bossType = null;
    WP().reset();
    if (XH.classes) XH.classes.afterReset();
    Gm.players = 1; // no co-op yet; self-revives scale with this
    P().lives = md().oneLife || md().a_lives === 'none' ? 0 : md().a_lives === 'one' ? 1 : md().a_lives === 'five' ? 5 : XH.SELF_REVIVES(Gm.players);
    if (XH.loadout) { XH.loadout.clear(); WP().state.lethal = XH.loadout.classLethal(); const tac = XH.loadout.classTactical(); WP().state.tactical = tac ? { type: tac, n: 1, cls: true } : null; if (md().loadout) XH.loadout.apply(); }
    if (md().armed) WP().give('pulse', true);
    if (md().blackout) W().setPower(false);
    if (md().fog) scene.fog.density *= 2.2;
    // arena options
    if (W().applyTime) W().applyTime(md().a_tod || 'night');
    if (md().a_weather === 'clear') { FX.setWeather('none'); scene.fog.density *= 0.8; A.ambience(null); }
    else if (md().a_weather === 'storm') { FX.setWeather(def.weather && def.weather !== 'none' ? def.weather : 'ash', undefined, 2.2); scene.fog.density *= 1.35; }
    if (md().a_power === 'on' && def.power && !md().blackout) W().setPower(true, true);
    if (md().a_doors === 'open') for (const id in W().doors) W().openDoor(id);
    if (md().a_hazards === 'off' && W().haz) W().haz.fill(0);
    if (md().a_start === 'armed') { const pool = Object.values(def.buys || {}).filter((id) => WP().DEFS[id]); if (pool.length) WP().give(U.pick(pool)); }
    Gm.def = def; Gm.round = startRound - 1; Gm.points = md().startPts + (startRound - 1) * 900 + (XH.classes && XH.classes.has('deeppockets') ? 500 : 0);
    Gm.insta = Gm.double = Gm.sale = 0; Gm.toSpawn = 0; Gm.between = 3; Gm.special = null; Gm.dropsRound = 0;
    Gm.diffMul = 1 + (def.difficulty - 1) * 0.1;
    Gm.stats = { kills: 0, heads: 0, shots: 0, earned: 0, doors: 0, perks: 0, time: 0, melee: 0, bosses: 0, upgrades: 0, boom: 0, skitter: 0, heavy: 0, reloads: 0, sprint: 0, boxes: 0, shields: 0, powerups: 0, hits: 0, dmg: 0, spent: 0, downs: 0, revives: 0, streak: 0, bestStreak: 0, multi: 0, bestMulti: 0, multiT: -9, wk: {}, rk: [] };
    Gm.forgeState = { state: 'idle', t: 0, slot: null, model: null };
    Gm.buffs = { ghost: 0, bottomless: 0, undying: 0 };
    setupBox();
    XH.sys.reset();
    Gm.state = 'playing';
    if (!XH.DEBUG && !XH.skipIntro) XH.sys.startIntro(def);
    if (XH.progress) XH.progress.startRun();
    if (XH.modes) XH.modes.start();
    if (XH.secrets) XH.secrets.reset();
    if (XH.achievements) XH.achievements.start();
    if (XH.telemetry) XH.telemetry.start();
    if (XH.director) XH.director.reset();
    Gm.startRound = Gm.round;
    UI().startGame(def);
    UI().points(Gm.points, 0);
    const tier = XH.MODS.tier(Gm.heat);
    const sub = md().blackout ? 'Blackout: the power is dead for good.' : def.power ? 'Power is out: dark, no tracker, no perks. Find the generator.' : def.sub;
    Gm.startBanner = () => UI().banner(def.name.toUpperCase(), sub + (Gm.heat ? `   ·   HEAT ${Gm.heat} ${tier.name}` : ''), def.accent);
    if (XH.DEBUG) setTimeout(Gm.startBanner, 400);
  };
  // Main quest complete: the Overmind is dead
  Gm.win = (title, sub, force) => {
    if (Gm.state !== 'playing') return;
    if (!force && XH.modes && !XH.modes.allowWin()) return;
    Gm.state = 'victory';
    if (XH.telemetry) XH.telemetry.end('won');
    A.stopLoops(); A.music.intensity = 0.5; A.music.stinger('survived');
    XH.sys.voice('victory', true);
    UI().banner(title || 'HIVE LINK SEVERED', sub || 'Evac inbound. You made it.', '#40ff90');
    FX.shake(1);
    const best = U.load('best', {}), key = XH.modes ? XH.modes.bestKey(Gm.def.id) : Gm.def.id, prev = best[key] || { round: 0 };
    if (XH.achievements) XH.achievements.won();
    if (!XH.DEBUG) { best[key] = Object.assign({}, prev, { escaped: true, round: Math.max(prev.round || 0, Gm.round), heat: Math.max(prev.heat || 0, Gm.heat) }); U.save('best', best); }
    const xp = XH.progress ? XH.progress.endRun(true) : null;
    setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); UI().gameOver(Gm.stats, Gm.round, false, true, xp); }, 4000);
  };
  Gm.over = () => {
    if (Gm.state !== 'playing') return;
    Gm.state = 'gameover';
    if (XH.telemetry) XH.telemetry.end('overrun');
    A.stopLoops(); A.music.intensity = 0.3; A.music.stinger('gameover');
    A.say('You have been overrun.');
    WP().setTrigger(false);
    UI().hideHud(); UI().flash('#600');
    const best = U.load('best', {}), key = XH.modes ? XH.modes.bestKey(Gm.def.id) : Gm.def.id, prev = best[key] || { round: 0, heat: -99 };
    const isBest = !XH.DEBUG && (Gm.round > prev.round || (Gm.round === prev.round && Gm.heat > (prev.heat || 0)));
    if (isBest) { best[key] = { round: Gm.round, kills: Gm.stats.kills, points: Gm.stats.earned, heat: Gm.heat }; U.save('best', best); }
    const xp = XH.progress ? XH.progress.endRun(false) : null;
    setTimeout(() => { if (document.pointerLockElement) document.exitPointerLock(); UI().gameOver(Gm.stats, Gm.round, isBest, false, xp); }, 1600);
  };
  Gm.quit = () => {
    if (XH.setdress) XH.setdress.close();
    if (Gm.state === 'playing' && XH.telemetry) XH.telemetry.end('quit');
    if (XH.modes) XH.modes.clear();
    if (XH.events) XH.events.reset();
    if (Gm.state === 'playing' && XH.progress) XH.progress.endRun(false);
    Gm.state = 'menu';
    A.stopLoops(); E().clear(); clearPowerups();
    WP().setTrigger(false); WP().setAds(false);
  };

  // =================== rounds ===================
  function nextRound() {
    Gm.round++;
    const r = Gm.round;
    const wv = Gm.def.waves || {}, num = (v, d) => (v === undefined || v === null || v === '' || isNaN(+v) ? d : +v);
    const bossEvery = md().bossRush ? 4 : num(wv.bossEvery, 8), swarmEvery = md().swarmRounds ? 3 : num(wv.swarmEvery, 5);
    Gm.special = (bossEvery > 0 && r >= bossEvery && r % bossEvery === 0 && md().a_roster !== 'nobosses') ? 'boss' : (swarmEvery > 0 && r >= swarmEvery && r % swarmEvery === 0) ? 'swarm' : null;
    const count = (Gm.special === 'swarm' ? Math.floor(12 + r * 2) : Math.min(140, Math.floor(6 + r * 2.4 + r * r * 0.12))) * num(wv.count, 1);
    Gm.toSpawn = Math.max(1, Math.round(count * md().horde)); Gm.spawnCd = 2.2; Gm.dropsRound = 0;
    Gm.maxAlive = Math.max(1, Math.min(60, Math.round(Math.min(26, 10 + Math.floor(r * 1.4)) * md().density * num(wv.alive, 1))));
    if (XH.modes) XH.modes.onRound(r);
    if (XH.events) XH.events.onRound(r);
    const demo = XH.classes && XH.classes.has('demolitions') ? 1 : 0;
    WP().state.grenades = Math.min((md().scarcity ? 2 : 4) + demo, WP().state.grenades + (md().scarcity ? 1 : 2) + demo);
    const tac = WP().state.tactical; if (tac && tac.cls) tac.n = Math.min(2, tac.n + 1);
    UI().roundStart(r, Gm.special);
    XH.sys.onRoundStart(r);
    if (XH.telemetry) XH.telemetry.roundStart(r);
    if (XH.director) XH.director.onRoundStart(r);
    if (XH.wonders) XH.wonders.onRoundStart(r);
    if (Gm.special === 'swarm') { A.music.stinger('swarm'); A.say('Swarm incoming!'); }
    else if (Gm.special === 'boss') { A.music.stinger('boss'); Gm.bossPending = 4; Gm.bossType = wv.boss && wv.boss !== 'auto' && E().TYPES[wv.boss] ? wv.boss : XH.bosses ? XH.bosses.pick(Gm.def.id) : 'tyrant'; A.say((E().TYPES[Gm.bossType] || E().TYPES.tyrant).name + ' approaches.'); }
    else A.music.stinger('round');
    UI().weaponChanged(WP().cur());
  }
  Gm.nextRound = () => nextRound();
  function endRound() {
    Gm.between = md().relentless ? 3 : 10;
    if (XH.modes) Gm.between = XH.modes.between(Gm.between);
    if (XH.events) XH.events.end();
    if (XH.telemetry) XH.telemetry.roundEnd();
    if (XH.director) XH.director.onRoundEnd();
    if (md().noRegen && !P().downed) P().hp = P().maxHp;
    A.music.stinger('survived');
    UI().roundEnd(Gm.round);
    if (XH.progress) XH.progress.addXP(100 + Gm.round * 25, 'Round survived');
    if (Gm.special === 'swarm' && Gm.lastKillPos) spawnPowerup(Gm.lastKillPos, 'ammo');
    Gm.special = null;
  }
  function composition() {
    const r = md().earlyEvo ? Math.max(Gm.round, 12) : Gm.round, cnt = (t) => E().countType(t);
    // a map's waves (the map editor) say from which round each kind comes (0: never)
    const sp = (Gm.def.waves && Gm.def.waves.species) || {}, from = (t, d) => (sp[t] === undefined || sp[t] === null || sp[t] === '' || isNaN(+sp[t]) ? d : +sp[t]), ok = (t, d) => { const f = from(t, d); return f > 0 && r >= f; };
    if (Gm.special === 'swarm') return r >= 10 && Math.random() < 0.18 && ok('burster', 4) ? ['burster'] : ['skitterling', ok('skitterling', 1) ? 'frenzied' : null];
    const w = [];
    if (ok('skitterling', 1)) w.push(['skitterling', 10]);
    if (ok('lancer', 3)) w.push(['lancer', 2 + r * 0.25]);
    if (ok('burster', 4)) w.push(['burster', 1.5 + r * 0.12]);
    if (ok('shrieker', 6)) w.push(['shrieker', 1.4 + r * 0.1]);
    const ros = md().a_roster, hv = ros === 'heavy' ? 3 : 0;
    if (ros !== 'light') {
      if (ok('burrower', hv || 9) && cnt('burrower') < (r >= 16 ? 3 : 2)) w.push(['burrower', 1]);
      if (ok('behemoth', hv || 7) && cnt('behemoth') < (r >= 16 ? 2 : 1)) w.push(['behemoth', 0.7]);
      if (ok('broodmother', hv || 10) && cnt('broodmother') < (r >= 18 ? 2 : 1)) w.push(['broodmother', 0.6]);
    }
    // Drowners come out of deep water, on maps that have some
    if (E().TYPES.drowner && ok('drowner', 3) && XH.hazards && XH.hazards.hasDeep() && cnt('drowner') < 2 + Math.floor(r / 5)) w.push(['drowner', 1.2 + r * 0.08]);
    if (!w.length) w.push(['skitterling', 10]);
    // the map's own creature, from round 3
    const uq = XH.uniques && XH.uniques.enemyFor(Gm.def.id);
    if (uq && ok('unique', 3) && E().TYPES[uq] && E().list.filter((e) => e.vid === uq).length < 2 + Math.floor(r / 6)) w.push([uq, (1.2 + r * 0.1) * (XH.victory ? XH.victory.spawnBoost() : 1)]);
    const t = U.weighted(w);
    const mut = XH.mutations && Gm.special !== 'swarm' ? XH.mutations.pick(t, r) : null; // colour variants with their own traits
    if (mut) return [mut, null];
    const variant = r >= 12 && Math.random() < 0.1 && !E().TYPES[t].base ? 'elite' : (XH.events ? XH.events.variant(t) : null);
    return [t, variant];
  }
  function pickSpawn(minD = 8, maxD = 45) {
    const Pl = P().pos;
    const act = W().spawns.filter((s) => s.active);
    const scored = act.map((s) => ({ s, d: Math.hypot(s.x - Pl.x, s.z - Pl.z) })).filter((o) => o.d > minD);
    if (!scored.length) return act.length ? U.pick(act) : null;
    const near = scored.filter((o) => o.d < maxD);
    const pool = near.length ? near : scored;
    return U.weighted(pool.map((o) => [o.s, 1 / (0.3 + o.d / 15) * (XH.director ? XH.director.spawnWeight(o.s) : 1)]));
  }
  Gm.pickSpawn = pickSpawn;
  function spawnTick(dt) {
    if (Gm.bossPending > 0) {
      Gm.bossPending -= dt;
      if (Gm.bossPending <= 0) {
        const s = (XH.logic && XH.logic.bossSpot()) || pickSpawn(14, 60) || W().spawns[0];
        const bt = Gm.bossType || 'tyrant';
        E().spawn(bt, s.x, s.z, { vent: s });
        UI().bossBar(true, E().TYPES[bt].name.toUpperCase());
      }
    }
    Gm.spawnCd -= dt;
    const DR = XH.director;
    if (Gm.toSpawn > 0 && Gm.spawnCd <= 0 && E().aliveCount() < Gm.maxAlive * (DR ? DR.aliveMul() : 1) && (!DR || DR.allowSpawn())) {
      const [type, variant] = composition();
      const ws = type === 'drowner' && XH.hazards ? XH.hazards.waterSpot() : null, s = ws ? null : pickSpawn();
      if (ws) { E().spawn(type, ws.x, ws.z, { variant }); Gm.toSpawn--; }
      else if (s) { E().spawn(type, s.x + U.rand(-0.4, 0.4), s.z + U.rand(-0.4, 0.4), { variant, vent: s }); Gm.toSpawn--; }
      Gm.spawnCd = Math.max(0.2, 1.9 - Gm.round * 0.09) / Math.max(0.1, +(Gm.def.waves && Gm.def.waves.rate) || 1) * (Gm.special === 'swarm' ? 0.45 : 1) * U.rand(0.7, 1.3) / Math.sqrt(md().density * Math.max(1, md().horde)) * (XH.events ? XH.events.spawnMul() : 1) * (DR ? DR.rateMul() : 1);
    }
  }

  // =================== economy ===================
  Gm.addPoints = (n, noMul) => {
    if (!noMul) { n = Math.round(n * md().points * (XH.events ? XH.events.pointsMul() : 1)); if (Gm.double > 0) n *= 2; }
    if (!isFinite(n)) return;
    Gm.points += n; Gm.stats.earned += n;
    UI().points(Gm.points, n);
  };
  Gm.spend = (n) => {
    if (!(n >= 0)) { A.play('deny'); UI().deny(); return false; } // never let a bad price turn the points into NaN
    if (Gm.points < n) { A.play('deny'); UI().deny(); return false; }
    Gm.points -= n; Gm.stats.spent += n; UI().points(Gm.points, -n); A.play('buy');
    if (XH.telemetry) XH.telemetry.onSpend(n, Gm.acting);
    return true;
  };
  Gm.onHit = (e, o) => {
    Gm.addPoints(10);
    UI().hitmarker(o.mult >= 2, false);
    A.play(o.mult >= 2 ? 'head' : 'hit');
  };
  Gm.onKill = (e, o) => {
    if (e.def.boss) {
      UI().bossBar(false); Gm.stats.bosses++; if (XH.achievements) XH.achievements.bossKilled(e); if (XH.modes) XH.modes.onBoss(e); if (XH.telemetry) XH.telemetry.onBoss(e);
      spawnPowerup(e.pos.clone(), 'ammo');
      spawnPowerup(e.pos.clone().add(new THREE.Vector3(2, 0, 0)), 'perk');
      UI().banner(e.def.name.toUpperCase() + ' SLAIN', '+' + e.def.pts + ' points', '#d060ff');
      A.say(e.def.name + ' eliminated.');
    }
    if (e.overmind) { UI().bossBar(false); const vw = XH.victory && XH.victory.st && XH.victory.st.p.win; setTimeout(() => (vw ? Gm.win(vw[0], vw[1]) : Gm.win()), 1500); }
    if (XH.victory) XH.victory.onKill(e);
    XH.sys.onKill(e);
    if (XH.progress) XH.progress.onKill(e, o);
    if (XH.modes) XH.modes.onKill(e, o);
    if (XH.secrets) XH.secrets.onKill(e);
    if (o.noPoints) return;
    const st = Gm.stats;
    st.kills++; st.rk[Gm.round - 1] = (st.rk[Gm.round - 1] || 0) + 1;
    st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak);
    st.multi = st.time - st.multiT < 1.5 ? st.multi + 1 : 1; st.multiT = st.time; st.bestMulti = Math.max(st.bestMulti, st.multi);
    if (o.weapon) st.wk[o.weapon] = (st.wk[o.weapon] || 0) + 1;
    if (o.weapon === 'trap' && XH.achievements) XH.achievements.add('trap');
    let pts = e.def.pts;
    if (o.mult >= 2) { pts += 50; Gm.stats.heads++; }
    if (o.kind === 'melee') { pts += 70; Gm.stats.melee++; }
    pts = Math.round(pts * (WP().killMod ? WP().killMod(e, o) : 1) * (XH.uniques ? XH.uniques.pointsMul() : 1));
    if (o.kind === 'explosive') Gm.stats.boom = (Gm.stats.boom || 0) + 1;
    if (e.type === 'skitterling') Gm.stats.skitter = (Gm.stats.skitter || 0) + 1;
    if (e.type === 'behemoth' || e.type === 'broodmother' || e.type === 'burrower') Gm.stats.heavy = (Gm.stats.heavy || 0) + 1;
    Gm.addPoints(pts);
    UI().hitmarker(o.mult >= 2, true);
    if (P().perks.has('vampire')) P().hp = Math.min(P().maxHp, P().hp + (o.kind === 'melee' ? 25 : 8));
    Gm.lastKillPos = e.pos.clone().setY(0);
    if (!md().noDrops && !e.def.minor && Gm.dropsRound < 4 && Math.random() < (e.def.heavy ? 0.25 : 0.026) * (XH.uniques ? XH.uniques.dropMul() : 1) * (XH.events ? XH.events.dropMul() : 1)) spawnPowerup(e.pos.clone().setY(0));
  };

  // =================== power-ups ===================
  const powerups = [];
  const iconCache = {};
  function iconTex(kind) {
    if (iconCache[kind]) return iconCache[kind];
    const d = kind === 'perk' ? { css: '#ff60d0', glyph: '✚' } : XH.POWERUPS[kind];
    const c = U.canvas(128), x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.fill();
    x.strokeStyle = d.css; x.lineWidth = 7; x.shadowColor = d.css; x.shadowBlur = 16; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke();
    x.fillStyle = d.css; x.font = 'bold 52px Segoe UI Symbol, Consolas'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(d.glyph, 64, 68);
    return (iconCache[kind] = new THREE.CanvasTexture(c));
  }
  const labelCache = {};
  function labelTex(kind) {
    if (labelCache[kind]) return labelCache[kind];
    const d = kind === 'perk' ? { name: 'Mutagen Vial', css: '#ff60d0' } : XH.POWERUPS[kind];
    const t = U.labelTex([{ t: d.name.toUpperCase(), c: d.css, font: 'bold 54px Rajdhani, Consolas, monospace' }, { t: 'WALK INTO IT', c: '#ffffff', font: 'bold 34px Rajdhani, Consolas, monospace' }], { w: 512, h: 128 });
    return (labelCache[kind] = t);
  }
  function spawnPowerup(pos, kind) {
    if (!kind) { kind = U.weighted([['ammo', 3], ['double', 3], ['insta', 3], ['nuke', 2], ['sale', W().boxSpots.length > 1 ? 1 : 0]]); Gm.dropsRound++; }
    const g = new THREE.Group(); g.position.set(pos.x, 1.2 + W().floorAt(pos.x, pos.z), pos.z);
    const col = kind === 'perk' ? 0xff60d0 : XH.POWERUPS[kind].color;
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(kind), transparent: true, depthWrite: false }));
    icon.scale.setScalar(1.1); g.add(icon);
    const lbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(kind), transparent: true, depthWrite: false, depthTest: false })); lbl.scale.set(2.4, 0.6, 1); lbl.position.y = 1.0; lbl.renderOrder = 9; g.add(lbl);
    const halo = FX.glowSprite(col, 3, 0.7); g.add(halo);
    scene.add(g);
    powerups.push({ kind, g, icon, halo, t: 0, life: 26, pos: g.position });
    A.play('powerup', { pos });
    FX.ring(pos.clone().setY(0.1), 2, col, 0.5);
    const nm = kind === 'perk' ? 'Mutagen Vial' : XH.POWERUPS[kind].name;
    UI().notice && UI().notice(`${nm.toUpperCase()} dropped: walk into it to use it`, kind === 'perk' ? '#ff60d0' : XH.POWERUPS[kind].css);
    UI().tip && (UI().tip('pickup') || UI().tip('pu_' + kind));
  }
  Gm.spawnPowerup = spawnPowerup;
  function clearPowerups() { for (const p of powerups) scene.remove(p.g); powerups.length = 0; }
  function updPowerups(dt) {
    const Pl = P();
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i]; p.t += dt;
      p.g.position.y = 1.2 + Math.sin(p.t * 3) * 0.15;
      p.halo.material.opacity = 0.5 + Math.sin(p.t * 5) * 0.2;
      const left = p.life - p.t;
      p.g.visible = left > 6 || Math.sin(p.t * (left < 3 ? 30 : 15)) > 0;
      if (Math.random() < 0.3) FX.one(p.pos.x + U.rand(-0.4, 0.4), p.pos.y - 0.3, p.pos.z + U.rand(-0.4, 0.4), 0, 1, 0, 0.6, 0.12, 0.02, p.kind === 'perk' ? 0xff60d0 : XH.POWERUPS[p.kind].color);
      if (Math.hypot(Pl.pos.x - p.pos.x, Pl.pos.z - p.pos.z) < 1.6 && Pl.pos.y < 2) { grab(p); scene.remove(p.g); powerups.splice(i, 1); continue; }
      if (left <= 0) { scene.remove(p.g); powerups.splice(i, 1); }
    }
  }
  function grab(p) {
    A.play('grab'); Gm.stats.powerups++;
    if (p.kind === 'perk') {
      const avail = Object.values(XH.PERKS).filter((q) => !P().perks.has(q.id));
      if (avail.length) { const q = U.pick(avail); P().addPerk(q.id); A.play('perk'); UI().banner('MUTAGEN VIAL', q.name + ': ' + q.desc, q.css); A.say(q.name); }
      return;
    }
    const d = XH.POWERUPS[p.kind];
    A.say(d.say);
    UI().banner(d.name.toUpperCase(), d.desc || '', d.css);
    if (p.kind === 'ammo') WP().maxAmmo();
    else if (p.kind === 'nuke') { A.play('nuke'); UI().flash('#fff8d0'); setTimeout(() => { E().killAll({}); Gm.addPoints(400, true); FX.shake(0.8); }, 600); }
    else if (p.kind === 'double') Gm.double = 30 * puMul();
    else if (p.kind === 'insta') Gm.insta = 30 * puMul();
    else if (p.kind === 'sale') Gm.sale = 30 * puMul();
  }

  const puMul = () => (XH.uniques ? XH.uniques.puMul() : 1);
  const perkLimit = () => (md().a_perks === 'four' ? 4 : XH.PERK_LIMIT + (XH.uniques ? XH.uniques.perkBonus() : 0) + (XH.secrets ? XH.secrets.perkBonus() : 0));
  Gm.perkLimit = perkLimit;

  // =================== mystery box (Xeno Cache) ===================
  function setupBox() {
    const spots = W().boxSpots;
    if (!spots.length) { Gm.box = null; return; }
    const g = new THREE.Group();
    const M = W().MAT;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1e1a24, metalness: 0.6, roughness: 0.4 });
    const glowM = new THREE.MeshBasicMaterial({ color: 0x40ffb0 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.5, flatShading: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.75, 0.95), dark); base.position.y = 0.375; g.add(base);
    for (const [y, sx] of [[0.72, 1.92], [0.05, 1.92]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.04, 0.97), glowM); s.position.y = y; g.add(s); }
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.75, -0.475); g.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.18, 0.97), dark); lid.position.set(0, 0.09, 0.475); lidPivot.add(lid);
    const lidGlow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.5), glowM); lidGlow.position.set(0, 0.19, 0.475); lidPivot.add(lidGlow);
    for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 5), bone); c.position.set(-0.85 + k * 0.34, 0.5, -0.48); c.rotation.x = -0.6; g.add(c); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 80, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x40ffb0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 40; g.add(beam);
    const glow = FX.glowSprite(0x40ffb0, 3, 0.5); glow.position.y = 1; g.add(glow);
    scene.add(g);
    // world root disposal removes pads, box is ours: remove on next start
    Gm.box = { group: g, lidPivot, beam, glow, spot: null, state: 'idle', t: 0, uses: 0, weapon: null, display: null };
    placeBox(U.pick(spots));
  }
  function placeBox(spot) {
    const b = Gm.box; b.spot = spot;
    for (const s of W().boxSpots) if (s.prop) s.prop.on = s === spot;
    b.group.position.set(spot.x, 0, spot.z); b.group.rotation.y = spot.rot; b.group.visible = true;
    b.state = 'idle'; b.uses = 0;
  }
  function boxPrice() { return Gm.sale > 0 ? 10 : Gm.price(950 * (XH.classes ? XH.classes.mul('gambler', 0.75) : 1)); }
  function openBox() {
    const b = Gm.box;
    b.state = 'rolling'; b.t = 0; b.uses++; b.cycleT = 0; Gm.stats.boxes++;
    A.play('box', { pos: b.group.position });
  }
  function pickBoxWeapon() {
    const lureFull = WP().state.tactical && WP().state.tactical.n >= 3;
    const pool = WP().BOX_POOL.filter(([id]) => !WP().has(id)).concat(lureFull ? [] : [['lure', 4], ['decoy', 3]]);
    return U.weighted(pool.length ? pool : WP().BOX_POOL);
  }
  function setDisplay(id) {
    const b = Gm.box;
    if (b.display) b.group.remove(b.display);
    b.display = WP().flatModel(id, false); b.display.scale.setScalar(2.2); b.display.rotation.y = Math.PI / 2;
    b.display.position.set(0, 0.9, 0); b.group.add(b.display);
  }
  function updBox(dt) {
    const b = Gm.box; if (!b) return;
    b.t += dt;
    b.beam.material.opacity = 0.1 + Math.sin(b.t * 2) * 0.04;
    if (b.state === 'idle') { b.lidPivot.rotation.x = U.damp(b.lidPivot.rotation.x, 0, 6, dt); if (b.display) { b.group.remove(b.display); b.display = null; } }
    else if (b.state === 'rolling') {
      b.lidPivot.rotation.x = U.damp(b.lidPivot.rotation.x, -1.6, 6, dt);
      const k = Math.min(1, b.t / 4);
      b.cycleT -= dt;
      if (b.cycleT <= 0) { b.cycleT = 0.06 + k * k * 0.35; setDisplay(U.pick(WP().BOX_POOL)[0]); }
      if (b.display) b.display.position.y = 0.9 + k * 0.7;
      if (Math.random() < 0.5) FX.one(b.group.position.x + U.rand(-0.8, 0.8), 0.8, b.group.position.z + U.rand(-0.3, 0.3), 0, 2, 0, 0.6, 0.15, 0.02, 0x40ffb0);
      if (b.t >= 4) {
        const leave = md().a_cache !== 'fixed' && b.uses >= 4 && Gm.sale <= 0 && W().boxSpots.length > 1 && Math.random() < 0.3;
        if (leave) {
          b.state = 'leaving'; b.t = 0;
          if (b.display) b.group.remove(b.display);
          b.display = new THREE.Group();
          const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8c8a0, flatShading: true }));
          skull.scale.set(1, 0.8, 1.3); b.display.add(skull);
          for (let k = 0; k < 5; k++) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 5), skull.material); h.position.set((k - 2) * 0.1, 0.2, -0.1); h.rotation.set(-1, 0, (k - 2) * 0.3); b.display.add(h); }
          for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff3020 })); eye.position.set(0.12 * sx, 0.05, 0.3); b.display.add(eye); }
          b.display.position.y = 1.6; b.group.add(b.display);
          Gm.addPoints(boxPrice(), true);
          A.play('boxLeave', { pos: b.group.position }); XH.sys.voice('boxLeave', true);
          UI().banner('THE CACHE IS MOVING', 'Points refunded', '#40ffb0');
        } else {
          b.state = 'ready'; b.t = 0; b.weapon = pickBoxWeapon(); setDisplay(b.weapon);
          b.display.position.y = 1.6;
        }
      }
    } else if (b.state === 'ready') {
      if (b.display) { b.display.position.y = 1.6 - (b.t / 9) * 0.8; b.display.rotation.y = Math.PI / 2 + Math.sin(b.t * 2) * 0.1; }
      if (b.t > 9) { b.state = 'idle'; b.t = 0; }
    } else if (b.state === 'leaving') {
      if (b.display) b.display.rotation.y += dt * 4;
      if (b.t > 1.5) { b.group.position.y += dt * (b.t - 1.5) * 12; b.group.rotation.y += dt * 6; }
      if (b.t > 4) {
        const others = W().boxSpots.filter((s) => s !== b.spot);
        placeBox(U.pick(others)); b.group.position.y = 0;
        if (b.display) { b.group.remove(b.display); b.display = null; }
      }
    }
  }

  // =================== forge (weapon mutation) ===================
  function updForge(dt) {
    const f = Gm.forgeState, F = W().forge; if (!F) return;
    f.t += dt;
    if (f.state === 'working') {
      F.spin = 6;
      if (f.model) { f.model.rotation.y += dt * 5; f.model.position.y = 1.5 + Math.sin(f.t * 8) * 0.03; }
      if (Math.random() < 0.8) FX.one(F.group.position.x + U.rand(-0.5, 0.5), 1.5 + U.rand(-0.5, 0.5), F.group.position.z + U.rand(-0.5, 0.5), U.rand(-1, 1), U.rand(0, 2), U.rand(-1, 1), 0.5, 0.2, 0.02, Math.random() < 0.5 ? 0xc040ff : 0x40ff90);
      if (f.t > 3.4) {
        if (f.tierUp) { WP().tierUp(f.slot); f.tierUp = false; } else WP().upgrade(f.slot);
        F.group.remove(f.model); f.model = WP().model(f.slot.id, true); f.model.scale.setScalar(2); f.model.position.set(0, 1.5, 0.9); f.model.rotation.y = Math.PI / 2; F.group.add(f.model);
        f.state = 'ready'; f.t = 0; FX.flash(F.group.position.clone().setY(1.5), 0xc040ff, 5, 0.5, 12);
      }
    } else {
      F.spin = 1;
      if (f.state === 'ready') {
        if (f.model) f.model.rotation.y = Math.PI / 2 + Math.sin(f.t * 2) * 0.2;
        if (f.t > 14) { F.group.remove(f.model); f.model = null; f.state = 'idle'; f.slot = null; UI().banner('MUTATION LOST', 'You left it too long', '#c040ff'); }
      }
    }
  }

  // =================== interaction ===================
  function candidates() {
    const out = [], Pl = P().pos, Wd = W();
    const d2 = (p) => Math.hypot(p.x - Pl.x, p.z - Pl.z);
    for (const id in Wd.doors) {
      const d = Wd.doors[id]; if (d.open) continue;
      const x0 = Wd.cx2x(d.x0) - Wd.CELL / 2, x1 = Wd.cx2x(d.x1) + Wd.CELL / 2, z0 = Wd.cz2z(d.z0) - Wd.CELL / 2, z1 = Wd.cz2z(d.z1) + Wd.CELL / 2;
      const dx = Math.max(x0 - Pl.x, 0, Pl.x - x1), dz = Math.max(z0 - Pl.z, 0, Pl.z - z1), dist = Math.hypot(dx, dz);
      const dc = XH.modes && XH.modes.freeDoors() ? 0 : Gm.price(d.cost * (XH.classes ? XH.classes.mul('haggler', 0.9) : 1));
      if (dist < 1.6) out.push({ tip: 'door', dist, text: `Open ${d.name}`, cost: dc, act: () => { if (Gm.spend(dc)) { Wd.openDoor(id); Gm.stats.doors++; XH.sys.voice('door'); if (XH.progress) XH.progress.addXP(50); } } });
    }
    for (const b of Wd.buys) {
      const dist = d2(b.pos); if (dist > 2.0 || Math.abs((b.pos.y || 0) - P().pos.y) > 1.4) continue;
      const def = WP().DEFS[b.weapon], own = WP().has(b.weapon);
      if (own && md().a_refill === 'none') out.push({ tip: 'wallbuy', dist, text: 'No refills in this arena', cost: null });
      else if (own) { const c = md().a_refill === 'free' ? 0 : Gm.price((own.upg ? 2500 : Math.round(WP().wallCost(b.weapon) / 2)) * (XH.classes ? XH.classes.mul('haggler', 0.9) : 1) * (XH.uniques ? XH.uniques.priceMul('wall') : 1)); out.push({ tip: 'wallbuy', dist, text: `Refill ${own.s.name} ammo`, cost: c, act: () => { if (own.reserve >= own.s.reserve && own.ammo >= own.s.mag) { A.play('deny'); return; } if (Gm.spend(c)) WP().give(b.weapon); } }); }
      else { const c = Gm.price(WP().wallCost(b.weapon) * (XH.classes ? XH.classes.mul('haggler', 0.9) : 1) * (XH.uniques ? XH.uniques.priceMul('wall') : 1)); out.push({ tip: 'wallbuy', dist, text: `Buy ${def.name}`, cost: c, act: () => { if (Gm.spend(c)) WP().give(b.weapon); } }); }
    }
    for (const m of Wd.perks) {
      const dist = d2(m.pos); if (dist > 2.0 || Math.abs((m.pos.y || 0) - P().pos.y) > 1.4) continue;
      const pk = m.perk;
      const pc = Gm.price(pk.cost * (XH.classes ? XH.classes.mul('perkaholic', 0.9) : 1));
      if (pk.id === 'lazarus' && md().oneLife) out.push({ tip: 'perk', dist, text: `${pk.name}: Disabled (One Life)`, cost: null });
      else if (!Wd.power) out.push({ tip: 'perk', dist, text: md().blackout ? `${pk.name}: Dead (Blackout)` : `${pk.name}: Requires power`, cost: null });
      else if (P().perks.has(pk.id)) out.push({ tip: 'perk', dist, text: `${pk.name}: Active`, cost: null });
      else if (P().perks.size >= perkLimit()) out.push({ tip: 'perk', dist, text: `Perk limit reached (${perkLimit()})`, cost: null });
      else out.push({ tip: 'perk', dist, text: `${pk.name}: ${pk.desc}`, cost: pc, act: () => { if (Gm.spend(pc)) { P().addPerk(pk.id); Gm.stats.perks++; if (XH.loadout && !pk.unique) XH.loadout.countPerk(pk.id); A.play('perk'); WP().state.switchT = 0.9; UI().banner(pk.name.toUpperCase(), pk.desc, pk.css); A.say(pk.name); setTimeout(() => XH.sys.voice('perk'), 2500); } } });
    }
    const b = Gm.box;
    if (b && b.group.visible && b.spot) {
      const dist = d2(b.spot.pos);
      if (dist < 2.2) {
        if (b.state === 'idle') out.push({ tip: 'box', dist, text: 'Open the Xeno Cache', cost: boxPrice(), act: () => { if (Gm.spend(boxPrice())) openBox(); } });
        else if (b.state === 'ready') {
          const isLure = b.weapon === 'lure' || b.weapon === 'decoy', name = b.weapon === 'lure' ? 'Lure Beacons (T)' : b.weapon === 'decoy' ? 'Decoy Holograms (T)' : WP().DEFS[b.weapon].name;
          out.push({ tip: 'box', dist, text: `Take ${name}`, cost: 0, act: () => { if (isLure) WP().giveTactical(b.weapon, 3); else WP().give(b.weapon); A.play('magin'); b.state = 'idle'; b.t = 0; } });
        }
      }
    }
    const F = Wd.forge;
    if (F) {
      const dist = d2(F.pos), f = Gm.forgeState;
      if (dist < 2.2) {
        if (!Wd.power) out.push({ tip: 'forge', dist, text: md().blackout ? 'Mutation Forge: Dead (Blackout)' : 'Mutation Forge: Requires power', cost: null });
        else if (f.state === 'idle') {
          const cur = WP().cur();
          if (cur.upg && (cur.tier || 1) < 3) { const nt = (cur.tier || 1) + 1, tc = Gm.price((nt === 2 ? 10000 : 15000) * (XH.classes ? XH.classes.mul('mutant', 0.8) : 1)); out.push({ tip: 'forge', dist, text: `Mutate ${cur.s.name} to Tier ${nt === 2 ? 'II' : 'III'} (+40% damage, one more effect)`, cost: tc, act: () => {
            if (!Gm.spend(tc)) return;
            if (WP().state.inv.length === 1) WP().state.inv.push(WP().slot('p9'));
            f.slot = WP().takeCurrent(); f.state = 'working'; f.t = 0; f.tierUp = true; Gm.stats.upgrades++;
            f.model = WP().model(f.slot.id, true); f.model.scale.setScalar(2); f.model.position.set(0, 1.5, 0); F.group.add(f.model);
            A.play('forge', { pos: F.pos }); XH.sys.voice('forge');
          } }); }
          else if (cur.upg) { const rc = Gm.price(2500 * (XH.classes ? XH.classes.mul('mutant', 0.8) : 1)); out.push({ tip: 'forge', dist, text: `Re-mutate ${cur.s.name} (new effects)`, cost: rc, act: () => { if (!Gm.spend(rc)) return; WP().rollAAT(cur); A.play('forge', { pos: F.pos }); const a = XH.AATS[cur.aat]; UI().banner((cur.aats || [cur.aat]).map((k) => XH.AATS[k].name).join(' + ').toUpperCase(), cur.s.name, a.css); } }); }
          else out.push({ tip: 'forge', dist, text: `Mutate ${cur.s.name}`, cost: Gm.price(5000 * (XH.classes ? XH.classes.mul('mutant', 0.8) : 1)), act: () => {
            if (!Gm.spend(Gm.price(5000 * (XH.classes ? XH.classes.mul('mutant', 0.8) : 1)))) return;
            if (WP().state.inv.length === 1) WP().state.inv.push(WP().slot('p9'));
            f.slot = WP().takeCurrent(); f.state = 'working'; f.t = 0; Gm.stats.upgrades++;
            f.model = WP().model(f.slot.id, false); f.model.scale.setScalar(2); f.model.position.set(0, 1.5, 0); F.group.add(f.model);
            A.play('forge', { pos: F.pos }); XH.sys.voice('forge');
          } });
        } else if (f.state === 'ready') out.push({ tip: 'forge', dist, text: `Take ${f.slot.s.name}`, cost: 0, act: () => { WP().returnSlot(f.slot); F.group.remove(f.model); f.model = null; f.state = 'idle'; f.slot = null; A.play('grab'); } });
      }
    }
    const Z = Wd.powerSwitch;
    if (Z && !Wd.power) {
      const dist = d2(Z.pos);
      if (dist < 2.2 && md().blackout) out.push({ tip: 'power', dist, text: 'The generator is slagged (Blackout)', cost: null });
      else if (dist < 2.2) out.push({ tip: 'power', dist, text: 'Restore power', cost: 0, act: () => { Wd.setPower(true); A.play('power'); UI().banner('POWER RESTORED', 'Lights, motion tracker, sentry guns, perks and the Forge are online', '#ffe060'); A.say('Power online.'); FX.shake(0.4); setTimeout(() => XH.sys.voice('power', true), 3500); } });
    }
    XH.sys.candidates(out);
    if (XH.structures) XH.structures.candidates(out);
    if (XH.victory) XH.victory.candidates(out);
    if (XH.uniques) XH.uniques.candidates(out);
    if (XH.wonders) XH.wonders.candidates(out);
    if (XH.secrets) XH.secrets.candidates(out);
    if (XH.companion) XH.companion.candidates(out);
    if (XH.traps) XH.traps.candidates(out);
    if (XH.logic) XH.logic.candidates(out);
    if (XH.setdress) XH.setdress.candidates(out);
    if (XH.modes) for (let i = out.length - 1; i >= 0; i--) if (XH.modes.blocks(out[i].tip)) out[i] = { tip: out[i].tip, dist: out[i].dist, text: 'Off in Gun Game: kills level up your gun', cost: null };
    out.sort((a, b2) => a.dist - b2.dist);
    return out;
  }
  Gm.prompt = () => { const c = candidates(); return c[0] || null; };
  Gm.interact = () => { if (P().downed) return; const c = candidates()[0]; if (c && c.act) { Gm.acting = c; try { c.act(); } finally { Gm.acting = null; } } };

  // =================== update ===================
  Gm.update = (dt) => {
    if (Gm.state !== 'playing') return;
    if (XH.sys.intro) return;
    Gm.stats.time += dt;
    for (const k in Gm.buffs) Gm.buffs[k] = Math.max(0, Gm.buffs[k] - dt);
    Gm.insta = Math.max(0, Gm.insta - dt); Gm.double = Math.max(0, Gm.double - dt); Gm.sale = Math.max(0, Gm.sale - dt);
    if (Gm.between > 0) { Gm.between -= dt; if (Gm.between <= 0) nextRound(); }
    else {
      spawnTick(dt);
      if (Gm.toSpawn <= 0 && E().aliveCount() === 0 && !(Gm.bossPending > 0)) endRound();
    }
    updPowerups(dt); updBox(dt); updForge(dt);
    XH.sys.update(dt, Gm.stats.time);
    if (XH.structures) XH.structures.update(dt, Gm.stats.time);
    if (XH.victory) XH.victory.update(dt);
    if (XH.loadout) XH.loadout.update(dt);
    if (XH.uniques) XH.uniques.update(dt, Gm.stats.time);
    if (XH.achievements) XH.achievements.update(dt);
    if (XH.modes) XH.modes.update(dt);
    if (XH.wonders) XH.wonders.update(dt, Gm.stats.time);
    if (XH.events) XH.events.update(dt);
    if (XH.companion) XH.companion.update(dt, Gm.stats.time);
    if (XH.traps) XH.traps.update(dt);
    if (XH.hazards) XH.hazards.update(dt);
    if (XH.logic) XH.logic.update(dt);
    if (XH.director) XH.director.update(dt);
    if (XH.setdress) XH.setdress.update(dt);
    if (XH.telemetry) XH.telemetry.update(dt);
    if (XH.secrets) XH.secrets.update(dt, Gm.stats.time);
    // music intensity
    const alive = E().aliveCount();
    let I = Gm.between > 0 ? 0.55 : 1 + Math.min(1.1, alive / 14);
    if (Gm.special === 'swarm' && Gm.between <= 0) I = 2.4;
    if (E().boss) I = 2.9;
    if (XH.director && Gm.between <= 0 && !E().boss) I = Math.max(0.3, I + XH.director.musicAdd());
    if (P().downed) I = 0.4;
    A.music.intensity = I;
    if (E().boss) UI().bossHp(E().boss.hp / E().boss.maxHp);
  };
})();
