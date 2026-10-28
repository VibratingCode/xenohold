'use strict';
// Meta progression: XP, 50 ranks, 10 prestiges, per-weapon camo challenges. Saved in localStorage.
(function () {
  const U = XH.U;
  const PR = XH.progress = {};
  const MAX_LEVEL = 50, MAX_PRESTIGE = 10;
  const D = PR.data = Object.assign({ xp: 0, level: 1, prestige: 0, total: 0, wc: {}, camo: {}, runs: 0, escapes: 0 }, U.load('profile', {}));
  const save = () => { if (!XH.DEBUG) U.save('profile', D); };
  PR.save = save;
  PR.MAX_LEVEL = MAX_LEVEL; PR.MAX_PRESTIGE = MAX_PRESTIGE;
  PR.need = (lv) => 600 + lv * 150;
  PR.run = { xp: 0, levels: [], unlocks: [] };

  const TIERS = ['Recruit', 'Private', 'Corporal', 'Sergeant', 'Staff Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel', 'Commander'];
  const TIER_COLORS = ['#8a939c', '#7dff9a', '#60d0ff', '#ffd860', '#ff9a40', '#ff5040', '#e060ff', '#a8f0ff', '#ffffff', '#ffc030'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  PR.rankName = (lv) => `${TIERS[Math.min(9, Math.floor((lv - 1) / 5))]} ${ROMAN[(lv - 1) % 5]}`;
  PR.rankColor = (lv) => TIER_COLORS[Math.min(9, Math.floor((lv - 1) / 5))];

  // Procedural rank emblem: chevrons for the level, a hex frame for prestige
  const emblemCache = {};
  PR.emblem = (lv, pr, size = 64) => {
    const key = `${lv}_${pr}_${size}`;
    if (emblemCache[key]) return emblemCache[key];
    const c = U.canvas(size), x = c.getContext('2d'), s = size / 64, col = PR.rankColor(lv);
    x.translate(size / 2, size / 2); x.scale(s, s);
    if (pr > 0) {
      const pc = ['#7dff9a', '#60d0ff', '#ffd860', '#ff9a40', '#ff5040', '#e060ff', '#a8f0ff', '#ffffff', '#ffc030', '#ff30a0'][pr - 1];
      x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; x.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); } x.closePath();
      x.fillStyle = 'rgba(10,10,14,0.9)'; x.fill(); x.lineWidth = 3; x.strokeStyle = pc; x.shadowColor = pc; x.shadowBlur = 8; x.stroke(); x.shadowBlur = 0;
      x.fillStyle = pc; x.font = 'bold 11px Orbitron, Consolas'; x.textAlign = 'center'; x.fillText('P' + pr, 0, 26);
    } else { x.beginPath(); x.arc(0, 0, 29, 0, 7); x.fillStyle = 'rgba(10,12,16,0.9)'; x.fill(); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.15)'; x.stroke(); }
    const n = ((lv - 1) % 5) + 1;
    x.strokeStyle = col; x.lineWidth = 5; x.lineJoin = 'miter'; x.shadowColor = col; x.shadowBlur = 6;
    for (let i = 0; i < n; i++) { const y = -14 + i * 7 + (5 - n) * 3.5; x.beginPath(); x.moveTo(-14, y + 7); x.lineTo(0, y); x.lineTo(14, y + 7); x.stroke(); }
    if (lv >= 46) { x.fillStyle = col; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 4 : 9; x.lineTo(Math.cos(a) * r, -22 + Math.sin(a) * r); } x.fill(); }
    return (emblemCache[key] = c.toDataURL());
  };

  // ---------------- XP ----------------
  PR.addXP = (n, why) => {
    if (!n) return;
    const heat = XH.game.heat || 0;
    n = Math.round(n * (heat > 0 ? 1 + Math.min(1.5, heat / 60) : Math.max(0.5, 1 + heat / 30)));
    PR.run.xp += n; D.total += n;
    if (D.level < MAX_LEVEL) {
      D.xp += n;
      while (D.level < MAX_LEVEL && D.xp >= PR.need(D.level)) {
        D.xp -= PR.need(D.level); D.level++; PR.run.levels.push(D.level);
        XH.ui && XH.ui.rankUp(D.level, D.prestige);
      }
      if (D.level >= MAX_LEVEL) D.xp = 0;
    }
    if (why && XH.ui) XH.ui.xpPop(n, why);
  };
  PR.startRun = () => { PR.run = { xp: 0, levels: [], unlocks: [], startLevel: D.level, startPrestige: D.prestige }; };
  PR.endRun = (escaped) => {
    if (PR.run.ended) return PR.run;
    PR.run.ended = true; D.runs++;
    if (escaped) { D.escapes++; PR.addXP(10000, 'Escaped'); }
    if (XH.classes && !XH.DEBUG) for (const n of XH.classes.endRun(XH.game.stats, XH.game.round)) PR.run.unlocks.push('Trait: ' + n);
    save();
    return PR.run;
  };
  PR.canPrestige = () => D.level >= MAX_LEVEL && D.prestige < MAX_PRESTIGE;
  PR.prestige = () => { if (!PR.canPrestige()) return false; D.prestige++; D.level = 1; D.xp = 0; save(); return true; };

  // ---------------- weapon challenges / camos ----------------
  const REQ = { bone: { k: 30, text: '30 kills' }, magma: { h: 40, text: '40 headshots' }, hive: { u: 60, text: '60 kills while mutated' }, abyss: { m: 6, text: 'Hivebloom on 6 weapons' } };
  PR.REQ = REQ;
  const wc = (w) => D.wc[w] || (D.wc[w] = { k: 0, h: 0, u: 0 });
  const hiveCount = () => Object.keys(XH.weapons.DEFS).filter((w) => (D.wc[w] || {}).u >= REQ.hive.u).length;
  PR.unlocked = (w, camo) => {
    const c = D.wc[w] || { k: 0, h: 0, u: 0 };
    if (camo === 'none') return true;
    if (camo === 'bone') return c.k >= REQ.bone.k;
    if (camo === 'magma') return c.h >= REQ.magma.h;
    if (camo === 'hive') return c.u >= REQ.hive.u;
    if (camo === 'abyss') return c.u >= REQ.hive.u && hiveCount() >= REQ.abyss.m;
    return false;
  };
  PR.progressText = (w, camo) => {
    const c = D.wc[w] || { k: 0, h: 0, u: 0 };
    if (camo === 'bone') return `${Math.min(c.k, REQ.bone.k)}/${REQ.bone.k} kills`;
    if (camo === 'magma') return `${Math.min(c.h, REQ.magma.h)}/${REQ.magma.h} headshots`;
    if (camo === 'hive') return `${Math.min(c.u, REQ.hive.u)}/${REQ.hive.u} mutated kills`;
    if (camo === 'abyss') return `Hivebloom on ${Math.min(hiveCount(), REQ.abyss.m)}/${REQ.abyss.m} weapons`;
    return '';
  };
  // ---------------- Gunsmith (per-weapon attachments) ----------------
  D.gs = D.gs || {};
  PR.attFor = (w) => D.gs[w] || null;
  PR.killsWith = (w) => (D.wc[w] || { k: 0 }).k;
  PR.attUnlocked = (w, cat) => XH.DEBUG_UNLOCK || PR.killsWith(w) >= XH.ATTACH[cat].kills;
  PR.setAtt = (w, cat, opt) => { if (!PR.attUnlocked(w, cat)) return false; const g = D.gs[w] || (D.gs[w] = {}); if (opt === 'default') delete g[cat]; else g[cat] = opt; if (!Object.keys(g).length) delete D.gs[w]; save(); return true; };
  PR.camoFor = (w) => { const c = D.camo[w]; return c && PR.unlocked(w, c) ? c : 'none'; };
  PR.setCamo = (w, c) => { if (!PR.unlocked(w, c)) return false; D.camo[w] = c; save(); return true; };
  PR.onKill = (e, o) => {
    if (o.noPoints) return;
    let xp = 10 + Math.round(e.def.pts / 6);
    if (o.mult >= 2) xp += 10;
    if (o.kind === 'melee') xp += 15;
    if (e.def.boss) xp += 1500;
    PR.addXP(xp, e.def.boss ? e.def.name + ' slain' : null);
    if (o.weapon === 'frag' && XH.loadout) XH.loadout.countFrag();
    if (o.weapon === 'turret' && XH.achievements) XH.achievements.turretKill();
    const w = o.weapon;
    if (!w || !XH.weapons.DEFS[w]) return;
    const c = wc(w), before = ['bone', 'magma', 'hive', 'abyss'].filter((k) => PR.unlocked(w, k));
    c.k++; if (o.mult >= 2) c.h++;
    const slot = XH.weapons.has(w); if (slot && slot.upg) c.u++;
    for (const k of ['bone', 'magma', 'hive', 'abyss']) {
      if (before.includes(k) || !PR.unlocked(w, k)) continue;
      const cm = XH.weapons.CAMOS.find((q) => q.id === k);
      PR.run.unlocks.push(`${XH.weapons.DEFS[w].name}: ${cm.name}`);
      XH.ui && XH.ui.banner('CAMO UNLOCKED', `${cm.name} for the ${XH.weapons.DEFS[w].name}`, cm.css);
      PR.addXP(500, 'Challenge');
    }
  };
})();
