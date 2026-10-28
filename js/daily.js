'use strict';
// Daily challenge: one fixed setup per calendar day (the same for everyone who plays that day): a map, a mode,
// two or three mutators and a target. Beat the target for 5,000 bonus XP. Consecutive days build a streak.
(function () {
  const U = XH.U, A = XH.audio;
  const DC = XH.daily = {};
  const D = () => XH.progress.data, G = () => XH.game;

  DC.today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function rng(seed) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const MUTS = ['earlyEvo', 'elite', 'frenzy', 'acid', 'swarmRounds', 'relentless', 'noRegen', 'glass', 'scarcity', 'inflation', 'noDrops', 'fog'];
  const MUT_NAME = (id) => (XH.MODS.toggles.find((t) => t.id === id) || { name: id }).name;

  DC.challenge = (date = DC.today()) => {
    const r = rng('xenohold:' + date), pick = (a) => a[Math.floor(r() * a.length)];
    const map = pick(XH.MAPS.filter((m) => !m.custom));
    const mode = pick(['standard', 'standard', 'standard', 'survival', 'escape', 'gungame', 'bossrush']);
    const muts = []; const n = 2 + (r() < 0.4 ? 1 : 0);
    while (muts.length < n) { const m = pick(MUTS); if (!muts.includes(m) && !(mode === 'gungame' && m === 'scarcity')) muts.push(m); }
    const start = mode === 'standard' ? pick([1, 1, 5, 10]) : 1;
    let target;
    if (mode === 'standard') target = { type: 'round', n: start + 10 + Math.floor(r() * 6) };
    else if (mode === 'survival') target = { type: 'time', n: 300 + Math.floor(r() * 5) * 60 };
    else if (mode === 'bossrush') target = { type: 'bosses', n: 3 + Math.floor(r() * 3) };
    else target = { type: 'win' };
    const mods = Object.assign(XH.MODS.defaults(), { mode, daily: date }); for (const m of muts) mods[m] = true;
    return { date, map, mode, muts, start, target, mods };
  };
  DC.targetText = (c) => {
    const t = c.target;
    if (t.type === 'round') return `Reach round ${t.n}`;
    if (t.type === 'time') return `Last ${Math.round(t.n / 60)} minutes`;
    if (t.type === 'bosses') return `Beat ${t.n} bosses`;
    return c.mode === 'escape' ? 'Reach the extraction and get out' : 'Win the game';
  };
  const rec = () => { const d = D(); d.daily = d.daily || { days: {}, streak: 0, last: null }; return d.daily; };
  DC.play = () => {
    const c = DC.challenge();
    A.init(); XH.main.startGame(c.map, c.start, c.mods);
  };
  // at the end of a game: did today's run beat the target?
  DC.onEnd = (won) => {
    const Gm = G(), m = Gm.mods || {}; if (!m.daily) return null;
    const c = DC.challenge(m.daily), t = c.target, st = Gm.stats;
    const score = t.type === 'round' ? Gm.round : t.type === 'time' ? Math.floor(st.time) : t.type === 'bosses' ? (XH.modes.st.bosses || 0) : won ? 1 : 0;
    const ok = t.type === 'win' ? won : score >= t.n;
    const R = rec(), day = R.days[c.date] || (R.days[c.date] = { best: 0, done: false });
    day.best = Math.max(day.best, score);
    let first = false;
    if (ok && !day.done) {
      day.done = true; first = true;
      const y = new Date(); y.setDate(y.getDate() - 1);
      R.streak = R.last === DC.today(y) ? R.streak + 1 : 1; R.last = c.date;
      XH.progress.addXP(5000, 'Daily challenge');
      if (XH.achievements) XH.achievements.flag('daily');
    }
    XH.progress.save();
    return { ok, first, score, c };
  };

  // ---------------- the menu card ----------------
  DC.render = () => {
    const el = document.getElementById('dailyCard'); if (!el) return;
    const c = DC.challenge(), R = rec(), day = R.days[c.date];
    const y = new Date(); y.setDate(y.getDate() - 1);
    const streak = R.last === c.date || R.last === DC.today(y) ? R.streak : 0;
    const modeName = XH.modes ? XH.modes.def(c.mode).name : c.mode;
    el.innerHTML = `<div class="dc-h"><span>Daily challenge</span><small>${c.date}${streak ? ` · streak ${streak}` : ''}</small></div>
      <div class="dc-m">${c.map.name} · ${modeName}${c.start > 1 ? ` · from round ${c.start}` : ''}</div>
      <div class="dc-t">${DC.targetText(c)}</div>
      <div class="dc-x">${c.muts.map(MUT_NAME).join(' · ')}</div>
      <div class="dc-f">${day && day.done ? '<b class="done">✔ Completed</b>' : day ? `Best so far: ${c.target.type === 'time' ? Math.floor(day.best / 60) + ':' + String(day.best % 60).padStart(2, '0') : day.best}` : '+5,000 XP'}<button id="dailyPlay" class="primary">Play ›</button></div>`;
    document.getElementById('dailyPlay').onclick = () => DC.play();
  };
})();
