'use strict';
// Playtest recorder. Every game is logged in this browser (the last 40): each round's length, kills, damage taken
// and dealt, points, downs and the frame rate; what hurt you and what downed you; every purchase; kills, shots and
// hits per gun; mid-game events and bosses. The Run History screen shows it, and "Save runs to a file" writes it all
// as JSON to your Downloads folder so the game can be tuned from real games.
(function () {
  const U = XH.U, A = XH.audio;
  const TM = XH.telemetry = {};
  const G = () => XH.game, P = () => XH.player, E = () => XH.enemies;
  const KEEP = 40, $ = (id) => document.getElementById(id);
  let run = null, rnd = null, pending = [], downPending = null, fps = { t: 0, n: 0, win: [] };
  const r1 = (v) => Math.round(v * 10) / 10;

  const who = (e) => (e ? (e.vid || e.type) : 'unknown');
  TM.start = () => {
    const Gm = G(), def = XH.MODS.defaults(), mods = {};
    for (const k in Gm.mods) if (Gm.mods[k] !== def[k] && k !== 'mode' && k !== 'daily') mods[k] = Gm.mods[k];
    run = {
      v: 1, id: Date.now().toString(36), date: new Date().toISOString(), map: Gm.def.id, mapName: Gm.def.name, custom: !!Gm.def.custom,
      mode: (Gm.mods && Gm.mods.mode) || 'standard', daily: (Gm.mods && Gm.mods.daily) || null, heat: Gm.heat, mods,
      cls: XH.classes && XH.classes.cur() ? XH.classes.cur().name : null, startRound: Gm.round + 1, endRound: 0, result: null, dur: 0,
      rounds: [], downs: [], hurtBy: {}, buys: [], guns: {}, events: [], bosses: [], perf: {},
    };
    rnd = null; pending = []; downPending = null; fps = { t: 0, n: 0, win: [], min: 999, sum: 0, cnt: 0 };
  };
  TM.roundStart = (r) => {
    if (!run) return;
    closeRound();
    rnd = { r, t0: G().stats.time, kills0: G().stats.kills, earned0: G().stats.earned, spent0: G().stats.spent || 0, dmg0: G().stats.dmg || 0, taken: 0, downs: 0, minHp: P().hp, special: G().special || null, event: XH.events && XH.events.cur ? XH.events.cur.id : null, peakAlive: 0, fpsMin: 999, fpsSum: 0, fpsN: 0, iSum: 0, iN: 0, peaks: 0 };
    if (rnd.event) run.events.push({ round: r, id: rnd.event });
  };
  function closeRound() {
    if (!rnd || !run) return;
    const st = G().stats;
    run.rounds.push({
      r: rnd.r, dur: r1(st.time - rnd.t0), kills: st.kills - rnd.kills0, taken: Math.round(rnd.taken), dealt: Math.round((st.dmg || 0) - rnd.dmg0),
      earned: st.earned - rnd.earned0, spent: (st.spent || 0) - rnd.spent0, downs: rnd.downs, minHp: Math.round(rnd.minHp), peakAlive: rnd.peakAlive,
      special: rnd.special, event: rnd.event, fps: rnd.fpsN ? Math.round(rnd.fpsSum / rnd.fpsN) : null, fpsMin: rnd.fpsMin < 999 ? Math.round(rnd.fpsMin) : null,
      intensity: rnd.iN ? r1(rnd.iSum / rnd.iN) : null, peaks: rnd.peaks,
    });
    rnd = null;
  }
  TM.roundEnd = () => closeRound();
  TM.peak = () => { if (rnd) rnd.peaks++; };

  // damage taken: P.hurt tells us how much, E.onHitPlayer (called right after) tells us who
  TM.onHurt = (amt, explosive) => { if (!run || !(amt > 0)) return; pending.push({ amt, label: explosive ? 'explosion' : null }); if (rnd) { rnd.taken += amt; rnd.minHp = Math.min(rnd.minHp, Math.max(0, P().hp)); } };
  TM.attribute = (e, how) => { const p = pending[pending.length - 1]; if (p && !p.label) p.label = who(e) + ':' + how; };
  TM.onDown = () => { if (!run) return; downPending = { t: r1(G().stats.time), round: G().round, x: r1(P().pos.x), z: r1(P().pos.z), lives: P().lives, alive: E().aliveCount() }; if (rnd) rnd.downs++; };
  function settle() {
    let last = null;
    for (const p of pending) { const l = p.label || 'hazard'; run.hurtBy[l] = Math.round((run.hurtBy[l] || 0) + p.amt); last = l; }
    pending = [];
    if (downPending) { downPending.by = last || run.lastHurtBy || 'unknown'; run.downs.push(downPending); downPending = null; }
    if (last) run.lastHurtBy = last;
  }
  TM.onSpend = (n, c) => { if (!run || !n) return; run.buys.push({ t: r1(G().stats.time), round: G().round, cost: n, what: c ? (c.tip || '') + ': ' + String(c.text || '').slice(0, 48) : 'other' }); };
  TM.onBoss = (e) => { if (run) run.bosses.push({ id: who(e), round: G().round, killT: r1(e.t || 0) }); };

  TM.update = (dt) => {
    if (!run) return;
    settle();
    if (rnd) {
      rnd.peakAlive = Math.max(rnd.peakAlive, E().aliveCount());
      if (XH.director && XH.director.I !== undefined) { rnd.iSum += XH.director.I; rnd.iN++; }
    }
    // frame rate over half-second windows (real time, not game time)
    const now = performance.now();
    if (!fps.last) fps.last = now;
    fps.n++; if (now - fps.last >= 500) { const f = fps.n * 1000 / (now - fps.last); fps.last = now; fps.n = 0; fps.min = Math.min(fps.min, f); fps.sum += f; fps.cnt++; if (rnd) { rnd.fpsMin = Math.min(rnd.fpsMin, f); rnd.fpsSum += f; rnd.fpsN++; } }
  };
  TM.end = (result) => {
    if (!run) return null;
    settle(); closeRound();
    const Gm = G(), st = Gm.stats;
    run.result = result; run.endRound = Gm.round; run.dur = r1(st.time);
    run.totals = { kills: st.kills, heads: st.heads, shots: st.shots, hits: st.hits, earned: st.earned, spent: st.spent || 0, dmg: Math.round(st.dmg || 0), downs: st.downs, bestStreak: st.bestStreak, bestMulti: st.bestMulti, melee: st.melee };
    for (const id in st.wk || {}) run.guns[id] = { kills: st.wk[id] };
    for (const id in st.ws || {}) (run.guns[id] = run.guns[id] || { kills: 0 }).shots = st.ws[id];
    for (const id in st.wh || {}) (run.guns[id] = run.guns[id] || { kills: 0 }).hits = st.wh[id];
    run.perf = { fps: fps.cnt ? Math.round(fps.sum / fps.cnt) : null, fpsMin: fps.min < 999 ? Math.round(fps.min) : null, quality: P().settings.quality, w: innerWidth, h: innerHeight };
    delete run.lastHurtBy;
    if (run.dur >= 20 || run.rounds.length) { const list = TM.runs(); list.unshift(run); U.save('runs', list.slice(0, KEEP)); }
    const done = run; run = null; rnd = null;
    return done;
  };
  TM.runs = () => U.load('runs', []);
  TM.last = () => TM.runs()[0] || null;

  // ---------------- insights ----------------
  const NAME = (label) => {
    const [id, how] = String(label).split(':'); const t = E().TYPES[id];
    const HOW = { melee: 'melee', proj: 'projectile', charge: 'charge', explosion: 'explosion' };
    if (label === 'hazard') return 'Hazards (acid, fire, shockwaves)'; if (label === 'explosion') return 'Explosions'; if (label === 'unknown') return 'Unknown';
    return (t ? t.name : id) + (how ? ' · ' + (HOW[how] || how) : '');
  };
  TM.name = NAME;
  TM.insights = (runs = TM.runs()) => {
    const hurt = {}, downs = {}, rd = {}, guns = {};
    for (const r of runs) {
      for (const k in r.hurtBy) hurt[k] = (hurt[k] || 0) + r.hurtBy[k];
      for (const d of r.downs) downs[d.by] = (downs[d.by] || 0) + 1;
      for (const x of r.rounds) { const q = rd[x.r] || (rd[x.r] = { n: 0, dur: 0, taken: 0 }); q.n++; q.dur += x.dur; q.taken += x.taken; }
      for (const id in r.guns) { const g = guns[id] || (guns[id] = { kills: 0, shots: 0, hits: 0 }); g.kills += r.guns[id].kills || 0; g.shots += r.guns[id].shots || 0; g.hits += r.guns[id].hits || 0; }
    }
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    return { hurt: top(hurt, 6), downs: top(downs, 6), rounds: rd, guns: Object.entries(guns).filter(([id]) => XH.weapons.DEFS[id]).sort((a, b) => b[1].kills - a[1].kills).slice(0, 8) };
  };

  // ---------------- Run History screen ----------------
  const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let sel = 0;
  TM.render = () => {
    const runs = TM.runs(), el = $('runsBody'); if (!el) return;
    $('runsCount').textContent = `${runs.length} game${runs.length === 1 ? '' : 's'} recorded`;
    if (!runs.length) { el.innerHTML = '<p class="armhint">No games recorded yet. Play a game and it shows up here.</p>'; return; }
    const ins = TM.insights(runs), maxH = Math.max(1, ...ins.hurt.map((q) => q[1])), maxD = Math.max(1, ...ins.downs.map((q) => q[1]));
    const rk = Object.keys(ins.rounds).map(Number).sort((a, b) => a - b), maxDur = Math.max(1, ...rk.map((r) => ins.rounds[r].dur / ins.rounds[r].n));
    const bars = (list, max, fmt) => list.map(([k, v]) => `<div class="rbar"><span>${esc(NAME(k))}</span><i style="width:${v / max * 100}%"></i><b>${fmt(v)}</b></div>`).join('') || '<small>Nothing yet</small>';
    const r = runs[Math.min(sel, runs.length - 1)];
    const WD = XH.weapons.DEFS;
    el.innerHTML = `
      <div class="rgrid">
        <div class="rcard"><h4>What downs you</h4>${bars(ins.downs, maxD, (v) => v + '×')}</div>
        <div class="rcard"><h4>What hurts you</h4>${bars(ins.hurt, maxH, (v) => U.fmt(v) + ' hp')}</div>
        <div class="rcard"><h4>Average round length</h4><svg class="rchart" viewBox="0 0 100 34" preserveAspectRatio="none">${rk.map((x, i) => { const q = ins.rounds[x], h = q.dur / q.n / maxDur * 30, w = 100 / rk.length; return `<rect x="${i * w + w * 0.1}" y="${32 - h}" width="${w * 0.8}" height="${h}"><title>Round ${x}: ${clock(q.dur / q.n)} on average (${q.n} game${q.n > 1 ? 's' : ''})</title></rect>`; }).join('')}</svg><div class="ch-a"><span>Round ${rk[0] || 1}</span><span>Round ${rk[rk.length - 1] || 1}</span></div></div>
        <div class="rcard"><h4>Your guns</h4>${ins.guns.map(([id, g]) => `<div class="rgun"><span>${esc(WD[id] ? WD[id].name : id)}</span><b>${U.fmt(g.kills)} kills</b><small>${g.shots ? Math.round(Math.min(1, g.hits / g.shots) * 100) + '% acc' : ''}</small></div>`).join('') || '<small>Nothing yet</small>'}</div>
      </div>
      <div class="rsplit">
        <div class="rlist">${runs.map((q, i) => `<button class="rrow ${i === sel ? 'on' : ''}" data-i="${i}"><b>${esc(q.mapName)}</b><span>${esc(XH.modes ? XH.modes.def(q.mode).name : q.mode)} · ${q.result === 'won' ? 'won' : q.result === 'quit' ? 'quit' : 'overrun'} · round ${q.endRound} · ${clock(q.dur)}</span><small>${new Date(q.date).toLocaleString()}</small></button>`).join('')}</div>
        <div class="rdetail">
          <h4>${esc(r.mapName)} · round ${r.startRound}–${r.endRound} · ${clock(r.dur)} · HEAT ${r.heat}</h4>
          <table class="rtable"><tr><th>Round</th><th>Time</th><th>Kills</th><th>Hurt</th><th>Low HP</th><th>Downs</th><th>Spent</th><th>FPS</th></tr>
          ${r.rounds.map((x) => `<tr class="${x.downs ? 'dn' : ''}"><td>${x.r}${x.special === 'boss' ? ' ♛' : x.special === 'swarm' ? ' ✺' : ''}${x.event ? ' ' + (XH.events.LIST[x.event] || { icon: '' }).icon : ''}</td><td>${clock(x.dur)}</td><td>${x.kills}</td><td>${x.taken}</td><td>${x.minHp}</td><td>${x.downs || ''}</td><td>${U.fmt(x.spent)}</td><td>${x.fps || ''}${x.fpsMin && x.fpsMin < 40 ? ` <em>(${x.fpsMin})</em>` : ''}</td></tr>`).join('')}</table>
          ${r.downs.length ? `<div class="rdowns">Downed by: ${r.downs.map((d) => `${esc(NAME(d.by))} (round ${d.round})`).join(' · ')}</div>` : ''}
        </div>
      </div>`;
    el.querySelectorAll('.rrow').forEach((b) => b.addEventListener('click', () => { sel = +b.dataset.i; TM.render(); }));
  };
  // save everything to a file in Downloads
  TM.exportFile = () => {
    const data = JSON.stringify({ game: 'Xenohold', version: (document.getElementById('verline') || {}).textContent, exported: new Date().toISOString(), runs: TM.runs() }, null, 1);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const d = new Date(); a.download = `xenohold-runs-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    const m = $('runsMsg'); if (m) m.textContent = `Saved ${a.download} to your Downloads folder`;
  };
  TM.copySummary = () => {
    const ins = TM.insights(), runs = TM.runs();
    const lines = [`Xenohold run summary (${runs.length} games)`, 'Downed by: ' + ins.downs.map(([k, v]) => `${NAME(k)} ×${v}`).join(', '), 'Hurt by: ' + ins.hurt.map(([k, v]) => `${NAME(k)} ${v}`).join(', '),
      'Round length: ' + Object.keys(ins.rounds).map((r) => `r${r} ${clock(ins.rounds[r].dur / ins.rounds[r].n)}`).join(' '),
      ...runs.slice(0, 10).map((q) => `${q.date.slice(0, 16)} ${q.mapName} ${q.mode} ${q.result} r${q.startRound}-${q.endRound} ${clock(q.dur)} heat ${q.heat} fps ${q.perf.fps}/${q.perf.fpsMin}`)];
    const txt = lines.join('\n');
    const done = () => { const m = $('runsMsg'); if (m) m.textContent = 'Summary copied to the clipboard'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => { prompt('Copy this:', txt); });
    else prompt('Copy this:', txt);
  };
  // wrap the player's damage and down handlers, and the creature hit hook, to see who did what
  const Pl = XH.player, baseHurt = Pl.hurt, baseDown = Pl.goDown, baseHit = E().onHitPlayer;
  Pl.hurt = (amt, from, explosive, silent) => { const hp0 = Pl.hp, was = Pl.downed; baseHurt(amt, from, explosive, silent); if (!was) TM.onHurt(hp0 - Math.max(0, Pl.hp), explosive); };
  Pl.goDown = () => { TM.onDown(); baseDown(); };
  E().onHitPlayer = (e, how) => { TM.attribute(e, how); baseHit(e, how); };
  TM.clearAll = () => { if (!confirm('Delete all recorded games?')) return; U.save('runs', []); TM.render(); };
  setTimeout(() => { const b = (id, f) => { const el = $(id); if (el) el.onclick = f; }; b('runsExport', TM.exportFile); b('runsCopy', TM.copySummary); b('runsClear', TM.clearAll); }, 0);
})();
