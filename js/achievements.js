'use strict';
// Achievements. Each has a test on the live game (checked twice a second while playing, and again when the game
// ends) or is granted by an event (AC.flag). Unlocks are saved in the profile, pop a toast and give 1,000 XP.
(function () {
  const U = XH.U, A = XH.audio;
  const AC = XH.achievements = {};
  const D = () => XH.progress.data, G = () => XH.game, P = () => XH.player, W = () => XH.world, WP = () => XH.weapons;
  const md = () => G().mods || {};

  // run state: event flags and counters for the current game
  AC.run = { flags: {}, n: {}, got: [] };
  const career = () => { const d = D(); d.acs = d.acs || { bosses: {}, wins: {}, played: {}, turret: 0 }; return d.acs; };
  const size = (o) => Object.keys(o || {}).length;

  const L = AC.LIST = [
    // ---- combat
    { id: 'first', cat: 'Combat', icon: '✦', name: 'First Contact', desc: 'Kill your first creature.', test: (c) => c.st.kills >= 1 },
    { id: 'k100', cat: 'Combat', icon: '☠', name: 'Pest Control', desc: 'Get 100 kills in one game.', prog: (c) => [c.st.kills, 100] },
    { id: 'k500', cat: 'Combat', icon: '☠', name: 'Exterminator', desc: 'Get 500 kills in one game.', prog: (c) => [c.st.kills, 500] },
    { id: 'k1000', cat: 'Combat', icon: '☠', name: 'Extinction Event', desc: 'Get 1,000 kills in one game.', prog: (c) => [c.st.kills, 1000] },
    { id: 'heads', cat: 'Combat', icon: '◎', name: 'Precision', desc: 'Get 75 headshot kills in one game.', prog: (c) => [c.st.heads, 75] },
    { id: 'knife', cat: 'Combat', icon: '⚔', name: 'Up Close and Personal', desc: 'Get 25 knife kills in one game.', prog: (c) => [c.st.melee, 25] },
    { id: 'multi5', cat: 'Combat', icon: '✸', name: 'Chain Reaction', desc: 'Kill 5 creatures in quick succession.', prog: (c) => [c.st.bestMulti || 0, 5] },
    { id: 'multi10', cat: 'Combat', icon: '✸', name: 'Carnage', desc: 'Kill 10 creatures in quick succession.', prog: (c) => [c.st.bestMulti || 0, 10] },
    { id: 'streak', cat: 'Combat', icon: '⛨', name: 'Untouchable', desc: 'Get 150 kills in a row without going down.', prog: (c) => [c.st.bestStreak || 0, 150] },
    { id: 'boom', cat: 'Combat', icon: '✹', name: 'Demolitions Expert', desc: 'Get 60 explosive kills in one game.', prog: (c) => [c.st.boom || 0, 60] },
    { id: 'acc', cat: 'Combat', icon: '⌖', name: 'Marksman', desc: 'Reach round 10 with at least 60% accuracy.', end: true, test: (c) => c.round >= 10 && c.st.shots > 50 && c.st.hits / c.st.shots >= 0.6 },
    // ---- survival
    { id: 'r10', cat: 'Survival', icon: '⏳', name: 'Holding the Line', desc: 'Reach round 10.', prog: (c) => [c.round, 10] },
    { id: 'r20', cat: 'Survival', icon: '⏳', name: 'Veteran', desc: 'Reach round 20.', prog: (c) => [c.round, 20] },
    { id: 'r30', cat: 'Survival', icon: '⏳', name: 'Hive Breaker', desc: 'Reach round 30.', prog: (c) => [c.round, 30] },
    { id: 'r50', cat: 'Survival', icon: '⏳', name: 'Living Legend', desc: 'Reach round 50.', prog: (c) => [c.round, 50] },
    { id: 'flaw', cat: 'Survival', icon: '♥', name: 'Flawless', desc: 'Reach round 15 without going down.', test: (c) => c.round >= 15 && !c.st.downs },
    { id: 'dark', cat: 'Survival', icon: '☾', name: 'Lights Out', desc: 'Reach round 10 on a map with a generator, without turning the power on.', test: (c) => c.round >= 10 && G().def.power && !W().power && !md().blackout },
    { id: 'pure', cat: 'Survival', icon: '○', name: 'Purist', desc: 'Reach round 15 without buying a perk.', test: (c) => c.round >= 15 && !c.st.perks },
    { id: 'pistol', cat: 'Survival', icon: '⌐', name: 'Sidearm Only', desc: 'Reach round 10 carrying nothing but the starting pistol.', test: (c) => c.round >= 10 && !AC.run.flags.otherGun },
    { id: 'hell', cat: 'Survival', icon: '♨', name: 'Into the Fire', desc: 'Reach round 10 at HEAT 60 or more.', test: (c) => c.round >= 10 && G().heat >= 60 },
    // ---- economy
    { id: 'hoard', cat: 'Economy', icon: '◆', name: 'Hoarder', desc: 'Hold 50,000 points at once.', prog: (c) => [G().points, 50000] },
    { id: 'spend', cat: 'Economy', icon: '◇', name: 'Big Spender', desc: 'Spend 100,000 points in one game.', prog: (c) => [c.st.spent || 0, 100000] },
    { id: 'perks', cat: 'Economy', icon: '❖', name: 'Fully Loaded', desc: 'Have 5 perks at once.', prog: (c) => [P().perks.size, 5] },
    { id: 'forge', cat: 'Economy', icon: '⚒', name: 'Master Smith', desc: 'Forge a weapon to tier III.', flag: 'forge3' },
    { id: 'box', cat: 'Economy', icon: '▣', name: 'Gambler', desc: 'Open the Xeno Cache 12 times in one game.', prog: (c) => [c.st.boxes, 12] },
    // ---- bosses and maps
    { id: 'boss', cat: 'Bosses & Maps', icon: '♛', name: 'Giant Slayer', desc: 'Kill a boss.', prog: () => [Math.min(1, size(career().bosses)), 1] },
    { id: 'bossAll', cat: 'Bosses & Maps', icon: '♛', name: 'Monster Hunter', desc: 'Kill the Hive Tyrant, the Brood Empress, the Molten Titan and the Sky Wraith.', prog: () => [['tyrant', 'empress', 'titan', 'wraith'].filter((b) => career().bosses[b]).length, 4] },
    { id: 'win', cat: 'Bosses & Maps', icon: '⚑', name: 'Mission Accomplished', desc: "Complete a map's victory condition.", prog: () => [Math.min(1, size(career().wins)), 1] },
    { id: 'win5', cat: 'Bosses & Maps', icon: '⚑', name: 'Seasoned Operator', desc: 'Complete the victory condition on 5 different maps.', prog: () => [size(career().wins), 5] },
    { id: 'tour', cat: 'Bosses & Maps', icon: '⌂', name: 'Tourist', desc: 'Play every map.', prog: () => [size(career().played), XH.MAPS.length] },
    { id: 'secret', cat: 'Bosses & Maps', icon: '✧', name: 'The Thing Below', desc: 'Defeat a secret boss.', hidden: true, flag: 'secret' },
    // ---- features
    { id: 'ww', cat: 'Tinkering', icon: '⚙', name: 'Mad Scientist', desc: "Build a map's wonder weapon.", flag: 'ww' },
    { id: 'egg', cat: 'Tinkering', icon: '❂', name: 'Curiosity', desc: 'Finish an easter-egg quest.', hidden: true, flag: 'egg' },
    { id: 'pet', cat: 'Tinkering', icon: '❦', name: 'Good Boy', desc: 'Your companion gets 40 kills in one game.', prog: () => [AC.run.n.pet || 0, 40] },
    { id: 'trap', cat: 'Tinkering', icon: '⚡', name: 'Trapper', desc: 'Get 30 kills with traps in one game.', prog: () => [AC.run.n.trap || 0, 30] },
    { id: 'turret', cat: 'Tinkering', icon: '◭', name: 'Sentry Duty', desc: 'Get 100 kills with deployable turrets.', prog: () => [career().turret || 0, 100] },
    { id: 'ride', cat: 'Tinkering', icon: '➹', name: 'Joyride', desc: 'Use a jump pad and a zipline in the same game.', test: () => AC.run.flags.pad && AC.run.flags.zip },
    { id: 'lore', cat: 'Tinkering', icon: '✎', name: 'Archivist', desc: 'Read 20 different logs.', prog: () => [Object.keys(D().logs || {}).length, 20] },
    { id: 'event', cat: 'Tinkering', icon: '☄', name: 'Weather the Storm', desc: 'Survive a mid-game event.', flag: 'event' },
    // ---- modes
    { id: 'gun', cat: 'Modes', icon: '⟳', name: 'Arms Race', desc: 'Win a game of Gun Game.', flag: 'gungame' },
    { id: 'rush', cat: 'Modes', icon: '♚', name: 'Boss Rush Champion', desc: 'Beat 5 bosses in Boss Rush.', flag: 'bossrush' },
    { id: 'surv', cat: 'Modes', icon: '⧗', name: 'Survivor', desc: 'Last 10 minutes in Survival.', flag: 'survival' },
    { id: 'esc', cat: 'Modes', icon: '➜', name: 'Escape Artist', desc: 'Reach the extraction in Escape Run.', flag: 'escape' },
    { id: 'daily', cat: 'Modes', icon: '☀', name: 'Daily Grind', desc: 'Beat the target in a daily challenge.', flag: 'daily' },
    { id: 'coop', cat: 'Modes', icon: '⚭', name: 'Better Together', desc: 'Reach round 10 in split-screen co-op.', test: (c) => c.round >= 10 && G().players > 1 },
    { id: 'arch', cat: 'Modes', icon: '▦', name: 'Architect', desc: 'Play a map you built in the map editor.', flag: 'custom' },
  ];
  const byId = {}; for (const a of L) byId[a.id] = a;
  AC.has = (id) => !!(D().ach || {})[id];
  AC.count = () => size(D().ach);

  function unlock(id) {
    const d = D(); d.ach = d.ach || {};
    if (d.ach[id] || XH.DEBUG_NOACH) return;
    d.ach[id] = Date.now(); AC.run.got.push(id);
    const a = byId[id];
    XH.progress.addXP(1000, null); XH.progress.save();
    toast(a); A.play('powerup', { vol: 0.8 });
  }
  const ctx = () => ({ st: G().stats, round: G().round });
  const STD = new Set(['acc', 'r10', 'r20', 'r30', 'r50', 'flaw', 'dark', 'pure', 'pistol', 'hell', 'coop']); // round-based: Standard mode only
  function met(a, c) {
    if (STD.has(a.id) && XH.modes && XH.modes.id() !== 'standard') return false;
    if (a.flag) return !!AC.run.flags[a.flag];
    if (a.test) return a.test(c);
    if (a.prog) { const [n, m] = a.prog(c); return n >= m; }
    return false;
  }
  AC.check = (ending) => {
    if (!G().stats || G().state === 'menu') return;
    const c = ctx();
    for (const a of L) if (!AC.has(a.id) && (!a.end || ending) && met(a, c)) unlock(a.id);
  };

  // events from other systems
  AC.flag = (k) => { AC.run.flags[k] = true; AC.check(); };
  AC.add = (k, n = 1) => { AC.run.n[k] = (AC.run.n[k] || 0) + n; };
  AC.bossKilled = (e) => { const b = e.vid || e.type; career().bosses[b] = (career().bosses[b] || 0) + 1; if (e.def.secret) AC.flag('secret'); };
  AC.won = () => { if (XH.modes && XH.modes.id() !== 'standard') return; career().wins[G().def.id] = 1; AC.check(); };
  AC.turretKill = () => { career().turret = (career().turret || 0) + 1; };

  AC.start = () => {
    AC.run = { flags: {}, n: {}, got: [] };
    career().played[G().def.id] = 1;
    if (G().def.custom) AC.flag('custom');
    acc = 0;
  };
  let acc = 0;
  AC.update = (dt) => {
    acc += dt; if (acc < 0.5) return; acc = 0;
    const inv = WP().state.inv || [];
    if (inv.some((s) => s && s.id !== 'p9' && s.id !== 'knife')) AC.run.flags.otherGun = true;
    AC.check();
  };
  AC.end = () => { AC.check(true); XH.progress.save(); return AC.run.got.map((id) => byId[id]); };

  // ---------------- toast ----------------
  const queue = []; let showing = false;
  function toast(a) { queue.push(a); if (!showing) next(); }
  function next() {
    const a = queue.shift(); if (!a) { showing = false; return; }
    showing = true;
    let el = document.getElementById('achToast');
    if (!el) { el = document.createElement('div'); el.id = 'achToast'; document.body.appendChild(el); }
    el.innerHTML = `<div class="at-i">${a.icon}</div><div><div class="at-h">Achievement unlocked</div><div class="at-n">${a.name}</div><div class="at-d">${a.desc}</div></div>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); setTimeout(next, 450); }, 3600);
  }

  // ---------------- menu screen ----------------
  AC.render = () => {
    const c = G().stats ? ctx() : null, cats = [...new Set(L.map((a) => a.cat))];
    document.getElementById('achCount').textContent = `${AC.count()} / ${L.length} unlocked`;
    document.getElementById('achBody').innerHTML = cats.map((cat) => `<h4>${cat}</h4><div class="achgrid">${L.filter((a) => a.cat === cat).map((a) => {
      const got = AC.has(a.id), secret = a.hidden && !got;
      let bar = '';
      if (!got && a.prog && !a.flag) { try { const [n, m] = a.prog(c || { st: {}, round: 0 }); if (!isNaN(n) && (n > 0 || !c) && m > 1 && !['k100', 'k500', 'k1000', 'heads', 'knife', 'multi5', 'multi10', 'streak', 'boom', 'r10', 'r20', 'r30', 'r50', 'hoard', 'spend', 'perks', 'box', 'pet', 'trap'].includes(a.id)) bar = `<div class="lobar"><i style="width:${Math.min(100, n / m * 100)}%"></i></div><small class="achp">${U.fmt(Math.min(n, m))} / ${U.fmt(m)}</small>`; } catch (err) { /* no live game */ } }
      const when = got ? new Date(D().ach[a.id]).toLocaleDateString() : '';
      return `<div class="achtile ${got ? 'got' : ''}"><div class="ai">${secret ? '?' : a.icon}</div><div class="at"><b>${secret ? 'Secret achievement' : a.name}</b><small>${secret ? 'Keep exploring.' : a.desc}</small>${got ? `<small class="achw">Unlocked ${when}</small>` : bar}</div></div>`;
    }).join('')}</div>`).join('');
  };
})();
