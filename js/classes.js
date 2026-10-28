'use strict';
// Class building: permanent traits unlocked by lifetime challenges, and three custom classes
// (a name, a starting sidearm and a few trait slots that open up as you rank up).
(function () {
  const U = XH.U;
  const CLS = XH.classes = {};

  // stat: which lifetime counter unlocks it; n: how much of it
  const TRAITS = XH.CLASS_TRAITS = [
    { id: 'thickskin', name: 'Thick Skin', desc: '+25 max health', stat: 'bestRound', n: 5, text: 'Reach round 5' },
    { id: 'quickhands', name: 'Quick Hands', desc: 'Reload 20% faster', stat: 'reloads', n: 150, text: 'Reload 150 times' },
    { id: 'marathon', name: 'Marathon', desc: '+50% stamina and faster stamina recovery', stat: 'sprint', n: 3000, text: 'Sprint 3 km' },
    { id: 'deadeye', name: 'Deadeye', desc: '+20% headshot damage', stat: 'heads', n: 250, text: 'Land 250 headshot kills' },
    { id: 'exterminator', name: 'Exterminator', desc: '+15% damage to Skitterlings, Broodlings and Bursters', stat: 'skitter', n: 500, text: 'Kill 500 Skitterlings' },
    { id: 'biggame', name: 'Big Game Hunter', desc: '+15% damage to Behemoths, Broodmothers, Burrowers and Tyrants', stat: 'heavy', n: 12, text: 'Kill 12 Behemoths, Broodmothers or Burrowers' },
    { id: 'deeppockets', name: 'Deep Pockets', desc: 'Start every game with +500 points', stat: 'earned', n: 60000, text: 'Earn 60,000 points' },
    { id: 'haggler', name: 'Haggler', desc: 'Doors and wall weapons cost 10% less', stat: 'doors', n: 30, text: 'Open 30 doors' },
    { id: 'demolitions', name: 'Demolitions', desc: '+1 grenade every round, +25% explosive damage', stat: 'boom', n: 120, text: 'Get 120 explosive kills' },
    { id: 'medic', name: 'Field Medic', desc: 'Health starts regenerating 40% sooner', stat: 'time', n: 3600, text: 'Survive 60 minutes in total' },
    { id: 'butcher', name: 'Butcher', desc: 'Double knife damage', stat: 'melee', n: 60, text: 'Get 60 knife kills' },
    { id: 'adrenaline', name: 'Adrenaline', desc: 'Kills within 3 s of being hit restore 10 health', stat: 'rounds', n: 60, text: 'Survive 60 rounds in total' },
    { id: 'gambler', name: 'Gambler', desc: 'The Xeno Cache costs 25% less', stat: 'boxes', n: 20, text: 'Open the Xeno Cache 20 times' },
    { id: 'tinkerer', name: 'Tinkerer', desc: 'Traps and Mutagen Capsules cost 25% less; the Hive Shield is 50% tougher', stat: 'shields', n: 2, text: 'Build the Hive Shield twice' },
    { id: 'packrat', name: 'Pack Rat', desc: '+30% reserve ammo on every weapon', stat: 'powerups', n: 25, text: 'Collect 25 power-ups' },
    { id: 'perkaholic', name: 'Perkaholic', desc: 'Perks cost 10% less', stat: 'perks', n: 40, text: 'Buy 40 perks' },
    { id: 'mutant', name: 'Mutant', desc: 'The Mutation Forge costs 20% less', stat: 'upgrades', n: 8, text: 'Mutate 8 weapons' },
    { id: 'bossbane', name: 'Tyrant Bane', desc: '+25% damage to the Hive Tyrant', stat: 'bosses', n: 3, text: 'Slay 3 Hive Tyrants' },
    { id: 'survivor', name: 'Second Wind', desc: 'Once per game, a killing blow leaves you on 1 health instead', stat: 'bestRound', n: 20, text: 'Reach round 20' },
    { id: 'escapist', name: 'Escape Artist', desc: 'Sprint 10% faster', stat: 'escapes', n: 1, text: 'Escape any arena once' },
  ];
  const SIDEARMS = XH.SIDEARMS = [['p9', 1], ['viper', 4], ['rook45', 10], ['hornet', 16], ['sparkpistol', 24], ['needler', 32], ['derringer', 40]];

  const D = () => XH.progress.data;
  const ensure = () => {
    const d = D();
    d.st = d.st || {};
    if (!d.classes || d.classes.length !== 3) d.classes = [
      { name: 'Assault', sidearm: 'p9', traits: [] },
      { name: 'Scout', sidearm: 'p9', traits: [] },
      { name: 'Specialist', sidearm: 'p9', traits: [] },
    ];
    if (d.classSel === undefined) d.classSel = 0;
    return d;
  };
  CLS.stat = (k) => { const d = ensure(); return k === 'escapes' ? (d.escapes || 0) : (d.st[k] || 0); };
  CLS.unlocked = (id) => { const t = TRAITS.find((q) => q.id === id); return !!t && (XH.DEBUG_UNLOCK || CLS.stat(t.stat) >= t.n); };
  CLS.progressText = (t) => `${U.fmt(Math.min(CLS.stat(t.stat), t.n))} / ${U.fmt(t.n)}`;
  CLS.slots = () => { const d = ensure(); return 1 + (d.level >= 8 ? 1 : 0) + (d.level >= 20 ? 1 : 0) + (d.level >= 35 || d.prestige > 0 ? 1 : 0); };
  CLS.slotLevels = [1, 8, 20, 35];
  CLS.sidearmOk = (id) => { const d = ensure(), s = SIDEARMS.find((q) => q[0] === id); return !!s && (d.prestige > 0 || d.level >= s[1]); };
  CLS.list = () => ensure().classes;
  CLS.cur = () => { const d = ensure(); return d.classes[d.classSel] || d.classes[0]; };
  CLS.select = (i) => { ensure().classSel = i; XH.progress.save(); };
  CLS.save = () => XH.progress.save();
  CLS.active = (c = CLS.cur()) => c.traits.filter((t) => CLS.unlocked(t)).slice(0, CLS.slots());

  // ---- in-game ----
  const P = () => XH.player;
  CLS.has = (id) => !!(P().traits && P().traits.has(id));
  CLS.mul = (id, m) => (CLS.has(id) ? m : 1);
  // before weapons are handed out (stats read the traits)
  CLS.apply = () => { const p = P(); p.traits = new Set(CLS.active()); p.survivorUsed = false; p.maxHp = p.baseHp(); p.hp = p.maxHp; if (p.traits.has('marathon')) p.stamina = 6; };
  // after the default loadout is given
  CLS.afterReset = () => {
    const c = CLS.cur(), WP = XH.weapons;
    if (c.sidearm && c.sidearm !== 'p9' && CLS.sidearmOk(c.sidearm) && WP.DEFS[c.sidearm]) { WP.state.inv[0] = WP.slot(c.sidearm); WP.equipIndex(0); }
    if (CLS.has('demolitions')) WP.state.grenades += 1;
  };

  // ---- lifetime stats at the end of each run; returns names of newly unlocked traits ----
  CLS.endRun = (st, round) => {
    const d = ensure(), before = TRAITS.filter((t) => CLS.unlocked(t.id)).map((t) => t.id);
    const add = (k, v) => { d.st[k] = (d.st[k] || 0) + (v || 0); };
    add('kills', st.kills); add('heads', st.heads); add('melee', st.melee); add('earned', st.earned); add('doors', st.doors); add('perks', st.perks);
    add('upgrades', st.upgrades); add('bosses', st.bosses); add('time', st.time); add('boom', st.boom); add('skitter', st.skitter); add('heavy', st.heavy);
    add('reloads', st.reloads); add('sprint', st.sprint); add('boxes', st.boxes); add('shields', st.shields); add('powerups', st.powerups);
    add('rounds', Math.max(0, round - 1)); d.st.bestRound = Math.max(d.st.bestRound || 0, round);
    return TRAITS.filter((t) => !before.includes(t.id) && CLS.unlocked(t.id)).map((t) => t.name);
  };
})();
