'use strict';
// Mid-game events. From round 6, a normal round has a 30% chance to bring one (never two rounds in a row of the
// same kind, and at least 3 rounds apart). An event lasts the round (75 seconds in Survival):
//  - Eclipse:    the sky goes black and the lights dim. Creatures are 20% faster. Double points.
//  - Blizzard:   a whiteout. Creatures are 25% slower, you are 10% slower, and fog hides everything past 20 m.
//  - Hive Surge: 60% more creatures, spawning faster, a quarter of them frenzied. Twice the power-up drops.
//  - Blood Moon: a red sky. Creatures have 50% more health. Triple points.
(function () {
  const U = XH.U, FX = XH.fx, A = XH.audio;
  const EV = XH.events = {};
  const G = () => XH.game, P = () => XH.player, W = () => XH.world, E = () => XH.enemies, UI = () => XH.ui;

  EV.LIST = {
    eclipse: { name: 'ECLIPSE', icon: '☾', css: '#b090ff', sub: 'The sky goes black. They hunt faster in the dark. Double points.', speed: 1.2, points: 2 },
    blizzard: { name: 'BLIZZARD', icon: '❄', css: '#bfe8ff', sub: 'A whiteout. Everything slows down, and you cannot see far.', speed: 0.75 },
    surge: { name: 'HIVE SURGE', icon: '✺', css: '#9dff3a', sub: 'The hive empties itself. More of them, faster, angrier. Double drops.', drops: 2, spawn: 0.6, count: 1.6 },
    bloodmoon: { name: 'BLOOD MOON', icon: '●', css: '#ff4a3a', sub: 'They are harder to kill under the red moon. Triple points.', hp: 1.5, points: 3 },
  };
  EV.cur = null; let last = null, lastRound = -99;
  const md = () => G().mods || {};

  EV.onRound = (r) => {
    if (EV.cur) EV.end(true);
    const Gm = G(), mode = XH.modes ? XH.modes.id() : 'standard';
    if (md().noEvents || mode === 'bossrush' || mode === 'gungame' || r < 6 || Gm.special === 'boss' || r - lastRound < 3 || Math.random() > (EV.force ? 1 : 0.3)) return;
    const ids = Object.keys(EV.LIST).filter((k) => k !== last);
    EV.start(EV.force && EV.LIST[EV.force] ? EV.force : U.pick(ids));
  };
  EV.start = (id) => {
    const Gm = G(), D = EV.LIST[id], sc = W().root.parent;
    last = id; lastRound = Gm.round;
    const save = { hemi: W().hemi ? W().hemi.intensity : 0, moon: W().moon ? W().moon.intensity : 0, fogC: sc.fog.color.clone(), fogD: sc.fog.density, bg: sc.background && sc.background.isColor ? sc.background.clone() : null, weather: FX.weatherType ? FX.weatherType() : null };
    EV.cur = { id, D, t: 0, dur: XH.modes && XH.modes.id() === 'survival' ? 75 : 1e9, save, fade: 0 };
    if (D.count) { Gm.toSpawn = Math.round(Gm.toSpawn * D.count); Gm.maxAlive = Math.min(48, Gm.maxAlive + 8); }
    if (D.speed) for (const e of E().list) if (!e.dead) { e.speedMul *= D.speed; e.evSpeed = D.speed; }
    if (id === 'blizzard') FX.setWeather('snow', null, 2.4);
    UI().banner(D.icon + ' ' + D.name, D.sub, D.css); A.music.stinger('swarm'); A.play('wail', { vol: 0.6 });
    chip(true);
  };
  EV.end = (quiet) => {
    const c = EV.cur; if (!c) return;
    EV.cur = null;
    const sc = W().root && W().root.parent, s = c.save;
    if (sc && sc.fog) { sc.fog.color.copy(s.fogC); sc.fog.density = s.fogD; if (s.bg && sc.background && sc.background.isColor) sc.background.copy(s.bg); }
    if (W().hemi) W().hemi.intensity = s.hemi; if (W().moon) W().moon.intensity = s.moon;
    if (W().power) for (const L of W().lights || []) if (!L.onAt) L.light.intensity = L.base;
    for (const e of E().list) if (e.evSpeed) { e.speedMul /= e.evSpeed; e.evSpeed = 0; }
    if (c.id === 'blizzard') FX.setWeather(W().def.weather || 'none', W().def.weatherColor);
    chip(false);
    if (!quiet && G().state === 'playing') { UI().banner(c.D.name + ' ENDS', '', c.D.css); if (XH.achievements) XH.achievements.flag('event'); }
  };
  EV.reset = () => { if (EV.cur) EV.end(true); last = null; lastRound = -99; };

  // effects on creatures, points and drops
  EV.onSpawn = (e) => {
    const c = EV.cur; if (!c || e.def.boss) return;
    if (c.D.speed) { e.speedMul *= c.D.speed; e.evSpeed = c.D.speed; }
    if (c.D.hp) { e.hp *= c.D.hp; e.maxHp *= c.D.hp; }
  };
  EV.variant = (type) => (EV.cur && EV.cur.id === 'surge' && Math.random() < 0.25 && !E().TYPES[type].base ? 'frenzied' : null);
  EV.pointsMul = () => (EV.cur && EV.cur.D.points) || 1;
  EV.dropMul = () => (EV.cur && EV.cur.D.drops) || 1;
  EV.spawnMul = () => (EV.cur && EV.cur.D.spawn) || 1;

  // ---------------- per frame: the look of each event fades in ----------------
  EV.update = (dt) => {
    const c = EV.cur; if (!c) return;
    c.t += dt; c.fade = Math.min(1, c.fade + dt / 3);
    const f = c.fade, s = c.save, sc = W().root.parent, Pl = P();
    if (c.id === 'eclipse' || c.id === 'bloodmoon') {
      const k = 1 - f * (c.id === 'eclipse' ? 0.7 : 0.4);
      if (W().hemi) W().hemi.intensity = s.hemi * k; if (W().moon) W().moon.intensity = s.moon * k;
      if (W().power) for (const L of W().lights || []) if (!L.onAt) L.light.intensity = L.base * (1 - f * (c.id === 'eclipse' ? 0.5 : 0.2));
      const tint = c.id === 'eclipse' ? new THREE.Color(0x05030a) : new THREE.Color(0x3a0806);
      sc.fog.color.copy(s.fogC).lerp(tint, f * 0.85); if (s.bg && sc.background && sc.background.isColor) sc.background.copy(s.bg).lerp(tint, f * 0.85);
      if (c.id === 'bloodmoon') sc.fog.density = s.fogD * (1 + f * 0.3);
    }
    if (c.id === 'blizzard') {
      sc.fog.color.copy(s.fogC).lerp(new THREE.Color(0xc8d8e8), f * 0.7); sc.fog.density = Math.max(s.fogD, s.fogD + f * 0.05);
      if (Pl.debuff) Pl.debuff('chill', 0.5, 0.9);
    }
    if (c.id === 'surge' && Math.random() < dt * 0.3) A.play('chitter', { vol: 0.3 });
    if (c.t >= c.dur) EV.end();
    chipText();
  };

  // a small HUD chip under the round counter
  function chip(on) {
    let el = document.getElementById('eventChip');
    if (!el) { el = document.createElement('div'); el.id = 'eventChip'; document.getElementById('hud') ? document.getElementById('hud').appendChild(el) : document.body.appendChild(el); }
    el.classList.toggle('on', !!on);
    if (on && EV.cur) { el.style.color = EV.cur.D.css; el.style.borderColor = EV.cur.D.css; chipText(); }
  }
  function chipText() {
    const el = document.getElementById('eventChip'), c = EV.cur; if (!el || !c) return;
    const extra = c.D.points ? ` · ×${c.D.points} points` : c.D.drops ? ' · ×2 drops' : '';
    const txt = `${c.D.icon} ${c.D.name}${extra}${c.dur < 1e8 ? ` · ${Math.ceil(c.dur - c.t)} s` : ''}`;
    if (el._t !== txt) { el.textContent = txt; el._t = txt; }
  }
})();
