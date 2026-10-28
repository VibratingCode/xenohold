'use strict';
// DOM UI: menus, map select, bestiary, settings, HUD.
(function () {
  const U = XH.U, $ = U.$;
  const UI = XH.ui = { cur: null, back: 'main' };
  const MENUS = ['main', 'maps', 'mods', 'armory', 'bestiary', 'settings', 'controls', 'pause', 'over', 'classes', 'gunsmith', 'loadout', 'ach', 'editor', 'runs'];

  UI.show = (name) => {
    // these screens go back to wherever they were opened from; never to one of them, or to their own sub-screen
    // (coming back from Tailored Loadout to Classes used to make Back loop between the two)
    const RETURNS = ['settings', 'controls', 'classes'], SUB = ['loadout'];
    if (RETURNS.includes(name) && UI.cur && !RETURNS.includes(UI.cur) && !SUB.includes(UI.cur)) UI.back = UI.cur;
    for (const m of MENUS) $('m-' + m).classList.toggle('hidden', m !== name);
    UI.cur = name;
    $('menuShade').classList.toggle('off', !name || name === 'bestiary' || name === 'pause' || name === 'over');
    if (name === 'main') { XH.main.setMode('menu'); refreshBest(); renderPlayerCard(); if (XH.daily) XH.daily.render(); }
    if (name === 'armory') { XH.main.setMode('menu'); renderArmory(); }
    if (name === 'maps') { XH.main.setMode('menu'); renderMaps(); renderModsSummary(); UI.classChip && UI.classChip(); XH.modes && XH.modes.renderPicker(); }
    if (name === 'classes') { XH.main.setMode('menu'); UI.renderClasses(); }
    if (name === 'gunsmith') { XH.main.setMode('menu'); UI.renderGunsmith(); }
    if (name === 'loadout') { XH.main.setMode('menu'); UI.renderLoadout(); }
    if (name === 'ach') { XH.main.setMode('menu'); XH.achievements.render(); }
    if (name === 'runs') { XH.main.setMode('menu'); XH.telemetry.render(); }
    if (name === 'editor') { XH.main.setMode('menu'); XH.editor.open(); }
    if (name === 'mods') { XH.main.setMode('menu'); renderMods(); }
    if (name === 'bestiary') { XH.main.setMode('bestiary'); selectCreature(UI.bSel || 'skitterling'); }
    if (name === 'settings') loadSettings();
  };
  UI.go = (name) => {
    XH.audio.init();
    if (name === 'main' && (XH.game.state === 'playing' || XH.game.state === 'gameover')) { XH.main.quitToMenu(); return; }
    if (name === 'maps' && XH.game.state === 'gameover') { XH.main.quitToMenu('maps'); return; }
    UI.show(name);
  };

  // ---------------- wiring ----------------
  UI.init = () => {
    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { UI.go(b.dataset.go); XH.audio.play('uiClick'); }));
    let lastHover = null;
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest && e.target.closest('.menu button, .mapcard, #blist li');
      if (t && t !== lastHover) XH.audio.play('uiHover');
      lastHover = t;
    });
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => UI.show(UI.back || 'main')));
    $('deployBtn').addEventListener('click', () => { XH.audio.init(); XH.main.startGame(XH.MAPS[UI.mapSel], UI.roundSel, UI.deployMods()); });
    $('deployBtn2').addEventListener('click', () => { XH.audio.init(); XH.main.startGame(XH.MAPS[UI.mapSel], UI.roundSel, UI.deployMods()); });
    $('modsBtn').addEventListener('click', () => { XH.audio.play('uiClick'); UI.show('mods'); });
    $('modsReset').addEventListener('click', () => { UI.mods = Object.assign({}, XH.MODS.presets.veteran.mods); saveMods(); renderMods(); XH.audio.play('uiClick'); });
    UI.mods = Object.assign(XH.MODS.defaults(), U.load('mods', {}));
    $('resumeBtn').addEventListener('click', () => XH.main.resume());
    $('quitBtn').addEventListener('click', () => XH.main.quitToMenu());
    $('retryBtn').addEventListener('click', () => { XH.audio.init(); XH.main.startGame(XH.game.def, XH.game.mods && XH.game.mods.daily ? XH.daily.challenge(XH.game.mods.daily).start : UI.roundSel || 1, XH.game.mods); });
    $('clicklock').addEventListener('click', () => XH.main.resume());
    document.querySelectorAll('.banims button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.banims button').forEach((q) => q.classList.toggle('on', q === b));
      XH.main.bestiaryAnim(b.dataset.anim);
      const ev = { idle: 'idle', attack: 'attack', special: 'special' }[b.dataset.anim]; if (ev) { XH.audio.init(); XH.audio.creature(UI.bSel || 'skitterling', ev); }
    }));
    document.querySelectorAll('.bsounds button').forEach((b) => b.addEventListener('click', () => {
      XH.audio.init(); const t = UI.bSel || 'skitterling';
      if (b.dataset.snd === 'step') for (let k = 0; k < 4; k++) setTimeout(() => XH.audio.creature(t, 'step'), k * 260);
      else XH.audio.creature(t, b.dataset.snd);
    }));
    // map/round selection
    UI.mapSel = U.load('mapSel', 0); if (!XH.MAPS[UI.mapSel]) UI.mapSel = 0; UI.roundSel = 1;
    const rr = $('rounds');
    [1, 5, 10, 15, 20].forEach((r) => {
      const b = document.createElement('button'); b.textContent = r; b.className = r === 1 ? 'on' : '';
      b.onclick = () => { UI.roundSel = r; rr.querySelectorAll('button').forEach((q) => q.classList.toggle('on', q === b)); };
      rr.appendChild(b);
    });
    // bestiary list
    const bl = $('blist');
    XH.enemies.ORDER.forEach((t) => { const li = document.createElement('li'); li.textContent = XH.enemies.TYPES[t].name; li.dataset.t = t; li.onclick = () => selectCreature(t); bl.appendChild(li); });
    // settings inputs
    const S = XH.player.settings;
    const bindRange = (id, key, fmt) => {
      const el = $('s-' + id), em = el.parentElement.querySelector('em');
      el.addEventListener('input', () => { S[key] = parseFloat(el.value); em.textContent = fmt(S[key]); saveSettings(); });
    };
    bindRange('sens', 'sens', (v) => v.toFixed(2)); bindRange('fov', 'fov', (v) => v + '°');
    bindRange('master', 'master', (v) => Math.round(v * 100) + '%'); bindRange('music', 'music', (v) => Math.round(v * 100) + '%'); bindRange('sfx', 'sfx', (v) => Math.round(v * 100) + '%'); bindRange('weather', 'weather', (v) => Math.round(v * 100) + '%');
    bindRange('particles', 'particles', (v) => Math.round(v * 100) + '%'); bindRange('shake', 'shake', (v) => Math.round(v * 100) + '%');
    bindRange('bob', 'bob', (v) => Math.round(v * 100) + '%');
    for (const k of TOGGLES) $('s-' + k).addEventListener('change', (e) => { S[k] = e.target.checked; saveSettings(); });
    $('s-quality').addEventListener('change', (e) => { S.quality = e.target.value; saveSettings(); });
    $('tiplist').innerHTML = Object.values(XH.TIPS).map(([t, x]) => `<div><b>${t}</b>${x}</div>`).join('');
    $('resetTips').addEventListener('click', () => { UI.resetTips(); $('resetTips').textContent = 'Tips will show again'; });
    // round tally container
    UI.hitT = 0; UI.bannerT = 0; UI.roundT = 0;
  };
  const TOGGLES = ['bloom', 'autoRes', 'announcer', 'hiveVoice', 'tips', 'minimap', 'invert', 'fps', 'rawInput', 'smooth'];
  function loadSettings() {
    const S = XH.player.settings;
    $('s-quality').value = S.quality;
    for (const [id, key, fmt] of [['sens', 'sens', (v) => v.toFixed(2)], ['fov', 'fov', (v) => v + '°'], ['master', 'master', (v) => Math.round(v * 100) + '%'], ['music', 'music', (v) => Math.round(v * 100) + '%'], ['sfx', 'sfx', (v) => Math.round(v * 100) + '%'], ['weather', 'weather', (v) => Math.round(v * 100) + '%'], ['particles', 'particles', (v) => Math.round(v * 100) + '%'], ['shake', 'shake', (v) => Math.round(v * 100) + '%'], ['bob', 'bob', (v) => Math.round(v * 100) + '%']]) {
      const el = $('s-' + id); el.value = S[key]; el.parentElement.querySelector('em').textContent = fmt(S[key]);
    }
    for (const k of TOGGLES) $('s-' + k).checked = !!S[k];
  }
  function saveSettings() { U.save('settings', XH.player.settings); XH.main.applySettings(); }

  // ---------------- map select ----------------
  function renderMaps() {
    const g = $('mapgrid'), best = U.load('best', {});
    g.innerHTML = '';
    const order = XH.MAPS.map((m, i) => i).sort((a, b) => (XH.MAPS[b].featured ? 1 : 0) - (XH.MAPS[a].featured ? 1 : 0));
    order.forEach((i) => {
      const m = XH.MAPS[i], c = document.createElement('div');
      c.className = 'mapcard' + (i === UI.mapSel ? ' sel' : '') + (m.featured ? ' feat' : '');
      c.style.setProperty('--c', m.accent);
      const b = best[m.id];
      c.innerHTML = `${m.featured ? `<div class="tag">${m.featured}</div>` : ''}<div class="sub">${m.sub}</div><h3>${m.name.toUpperCase()}</h3><p>${m.desc}</p>
        <div class="meta"><span>THREAT <span class="pips">${[1, 2, 3].map((k) => `<i class="${k <= m.difficulty ? 'on' : ''}"></i>`).join('')}</span></span><span>${b ? 'BEST: ROUND ' + b.round + (b.heat ? ' · HEAT ' + b.heat : '') : 'UNPLAYED'}</span></div>`;
      c.onclick = () => { UI.mapSel = i; U.save('mapSel', i); renderMaps(); XH.main.previewMap(m); XH.audio.play('bounce', { vol: 0.5 }); };
      g.appendChild(c);
    });
    XH.main.previewMap(XH.MAPS[UI.mapSel]);
  }
  // ---------------- difficulty & mutators ----------------
  const PRESET_COLORS = { recruit: '#60d0ff', veteran: '#7dff9a', nightmare: '#ff8a3a', hell: '#ff3a2a' };
  function saveMods() { U.save('mods', UI.mods); }
  UI.setMod = (k, v) => { UI.mods[k] = v; saveMods(); };
  // arena options are stored per map
  UI.arenaAll = null;
  UI.arenaFor = (id) => { if (!UI.arenaAll) UI.arenaAll = U.load('arenaOpts', {}); return Object.assign(XH.MODS.arenaDefaults(), UI.arenaAll[id] || {}); };
  UI.setArena = (id, k, v) => { if (!UI.arenaAll) UI.arenaAll = U.load('arenaOpts', {}); const a = UI.arenaAll[id] || (UI.arenaAll[id] = {}); a[k] = v; U.save('arenaOpts', UI.arenaAll); };
  UI.deployMods = () => Object.assign({}, UI.mods, UI.arenaFor(XH.MAPS[UI.mapSel].id), { mode: XH.modes ? XH.modes.sel : 'standard' });
  const badge = (h) => h < 0 ? `<span class="bdg easy">▼ EASIER ${h}</span>` : h > 0 ? `<span class="bdg hard">▲ HARDER +${h}</span>` : '<span class="bdg std">STANDARD</span>';
  function modsLabel(m) {
    const k = XH.MODS.presetOf(m);
    if (k) return XH.MODS.presets[k].name;
    const n = XH.MODS.toggles.filter((t) => m[t.id]).length;
    return 'Custom' + (n ? ` · ${n} mutator${n > 1 ? 's' : ''}` : '');
  }
  function renderModsSummary() {
    const h = XH.MODS.heat(UI.deployMods()), t = XH.MODS.tier(h);
    $('modsSummary').textContent = modsLabel(UI.mods);
    const mh = $('modsHeat'); mh.textContent = `HEAT ${h} · ${t.name}`; mh.style.color = t.css;
  }
  function renderHeat() {
    const h = XH.MODS.heat(UI.deployMods()), t = XH.MODS.tier(h), box = $('heatbox');
    $('heatVal').textContent = h; $('heatTier').textContent = t.name;
    box.style.setProperty('--hc', t.css); box.classList.toggle('abyss', t.name === 'ABYSS');
    $('heatBar').style.width = U.clamp((h + 15) / 138, 0, 1) * 100 + '%';
    const pk = XH.MODS.presetOf(UI.mods);
    document.querySelectorAll('.preset').forEach((el) => el.classList.toggle('on', el.dataset.k === pk));
  }
  function renderMods() {
    const pr = $('presets'); pr.innerHTML = '';
    for (const k in XH.MODS.presets) {
      const p = XH.MODS.presets[k], el = document.createElement('div');
      el.className = 'preset'; el.dataset.k = k; el.style.setProperty('--c', PRESET_COLORS[k]);
      el.innerHTML = `<em>HEAT ${XH.MODS.heat(p.mods)}</em><b>${p.name.toUpperCase()}</b><span>${p.desc}</span>`;
      el.onclick = () => { UI.mods = Object.assign({}, p.mods); saveMods(); renderMods(); XH.audio.play(k === 'hell' ? 'roar' : 'uiClick', { vol: 0.5 }); };
      pr.appendChild(el);
    }
    const sl = $('modsliders'); sl.innerHTML = '';
    for (const s of XH.MODS.sliders) {
      const lab = document.createElement('label'), inp = document.createElement('input'), em = document.createElement('em');
      inp.type = 'range';
      const opts = s.options;
      if (opts) { inp.min = 0; inp.max = opts.length - 1; inp.step = 1; inp.value = Math.max(0, opts.indexOf(UI.mods[s.id])); }
      else { inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = UI.mods[s.id]; }
      const bd = document.createElement('span'); bd.className = 'slbadge';
      const upd = () => { const v = UI.mods[s.id], hv = s.heat(v); em.textContent = s.fmt(v); em.className = hv > 0.4 ? 'hot' : hv < -0.4 ? 'cool' : ''; bd.innerHTML = badge(Math.round(hv)); };
      inp.addEventListener('input', () => { UI.mods[s.id] = opts ? opts[+inp.value] : parseFloat(inp.value); saveMods(); upd(); renderHeat(); });
      lab.append(document.createTextNode(s.name), bd, em, inp);
      if (s.hint) { const sm = document.createElement('small'); sm.textContent = s.hint; lab.appendChild(sm); }
      upd(); sl.appendChild(lab);
    }
    const tg = $('modtoggles'); tg.innerHTML = '';
    for (const t of XH.MODS.toggles) {
      const el = document.createElement('div');
      el.className = 'mut' + (UI.mods[t.id] ? ' on' : '') + (t.heat < 0 ? ' easy' : '');
      el.innerHTML = `${badge(t.heat)}<b>${t.name}</b><span>${t.desc}</span>`;
      el.onclick = () => { UI.mods[t.id] = !UI.mods[t.id]; el.classList.toggle('on', UI.mods[t.id]); saveMods(); renderHeat(); XH.audio.play(UI.mods[t.id] ? 'uiClick' : 'uiHover'); };
      tg.appendChild(el);
    }
    // arena options for the selected map
    const map = XH.MAPS[UI.mapSel], ar = UI.arenaFor(map.id), box = $('arenaopts');
    box.innerHTML = `<h3>Arena options · <span style="color:${map.accent}">${map.name}</span><small>Saved for this arena only</small></h3>` + XH.MODS.arena.filter((a) => a.id !== 'a_power' || map.power).map((a) => `<div class="aopt"><b>${a.name}</b><div class="achoices">${a.choices.map(([v, lab, h]) => `<button class="ach ${ar[a.id] === v ? 'on' : ''}" data-k="${a.id}" data-v="${v}">${badge(h)}<span>${lab}</span></button>`).join('')}</div></div>`).join('');
    box.querySelectorAll('.ach').forEach((b) => b.addEventListener('click', () => { UI.setArena(map.id, b.dataset.k, b.dataset.v); XH.audio.play('uiClick'); renderMods(); }));
    renderHeat();
  }

  function refreshBest() {
    const best = U.load('best', {}); const e = Object.entries(best);
    $('bestline').textContent = e.length ? 'Best: ' + e.map(([k, v]) => `${(XH.MAPS.find((m) => m.id === k) || {}).name} · Round ${v.round}${v.heat ? ' · Heat ' + v.heat : ''}`).join('   |   ') : 'No runs recorded. The swarm is waiting.';
  }

  // ---------------- bestiary ----------------
  const APPEARS = { skitterling: 'Round 1', lancer: 'Round 3', burster: 'Round 4', shrieker: 'Round 6', behemoth: 'Round 7', burrower: 'Round 9', broodmother: 'Round 10', broodling: 'Hatched by Broodmothers', tyrant: 'Every 8th round' };
  function selectCreature(t) {
    UI.bSel = t;
    const d = XH.enemies.TYPES[t];
    document.querySelectorAll('#blist li').forEach((li) => li.classList.toggle('on', li.dataset.t === t));
    $('bname').textContent = d.name.toUpperCase();
    $('bthreat').innerHTML = 'THREAT <span class="pips">' + [1, 2, 3, 4, 5].map((k) => `<i class="${k <= d.threat ? 'on' : ''}"></i>`).join('') + '</span>';
    $('bdesc').textContent = d.desc; $('btip').textContent = d.tip;
    $('bstats').innerHTML = `<div>Base health<b>${U.fmt(d.hp)}</b></div><div>Speed<b>${d.speed.toFixed(1)} m/s</b></div><div>Bounty<b>${d.pts} pts</b></div><div>Appears<b>${APPEARS[t] || d.appears || (d.boss ? 'Boss rounds (in turn)' : d.map ? 'Only on ' + ((XH.MAPS.find((m) => m.id === d.map) || {}).name || d.map) : 'Finale objective')}</b></div><div>Melee reach<b>${d.reach ? d.reach.toFixed(1) + ' m' : 'none'}</b></div><div>Ranged<b>${d.ranged ? d.ranged.range[1] + ' m, needs sight' : d.burrow ? '20 m spine line' : 'none'}</b></div>`;
    document.querySelectorAll('.banims button').forEach((q) => q.classList.toggle('on', q.dataset.anim === 'move'));
    XH.main.bestiary(t);
  }

  // ---------------- HUD ----------------
  UI.startGame = (def) => {
    UI.show(null);
    $('hud').classList.toggle('hidden', !!(XH.sys && XH.sys.intro));
    $('boss').classList.add('hidden');
    $('round').textContent = ''; $('round').className = '';
    $('minimap').classList.toggle('hidden', !XH.player.settings.minimap || XH.game.mods.fog);
    $('fps').classList.toggle('hidden', !XH.player.settings.fps);
    const hb = $('heatBadge'), h = XH.game.heat, t = XH.MODS.tier(h);
    hb.classList.toggle('hidden', !h); hb.textContent = `HEAT ${h} · ${t.name}`; hb.style.color = t.css;
    $('popups').innerHTML = ''; $('powerups').innerHTML = '';
    UI.partsChanged(0); UI.shieldChanged(); $('objective').textContent = ''; $('objective')._t = '';
    UI.perksChanged(); UI.weaponChanged(XH.weapons.cur());
  };
  UI.hideHud = () => $('hud').classList.add('hidden');
  let subT = 0;
  UI.subtitle = (text) => { const s = $('subtitle'); if (!text) { s.classList.remove('on'); return; } s.textContent = '“' + text + '”'; s.classList.add('on'); clearTimeout(subT); subT = setTimeout(() => s.classList.remove('on'), 3800); };
  UI.partsChanged = (n) => { const p = $('parts'); p.classList.toggle('hidden', !n); p.innerHTML = [0, 1, 2].map((k) => `<i class="${k < n ? 'on' : ''}"></i>`).join(''); };
  UI.shieldChanged = () => { const sh = XH.player.shield; $('shieldbar').classList.toggle('hidden', !sh); if (sh) $('shieldfill').style.width = Math.max(0, sh.hp / sh.max * 100) + '%'; if (sh) $('parts').classList.add('hidden'); };
  let aatT = 0;
  UI.aatProc = (k) => { const a = XH.AATS[k], el = $('aatflash'); el.textContent = a.name.toUpperCase(); el.style.color = a.css; el.style.transition = 'none'; el.style.opacity = 1; clearTimeout(aatT); aatT = setTimeout(() => { el.style.transition = 'opacity 0.6s'; el.style.opacity = 0; }, 700); XH.audio.play('aat'); };
  UI.xpPop = (n, why) => { const box = $('xppops'); if (box.children.length > 4) box.removeChild(box.firstChild); const d = document.createElement('div'); d.className = 'xpp'; d.textContent = `+${n} XP  ${why}`; box.appendChild(d); setTimeout(() => d.remove(), 2000); };
  UI.rankUp = (lv, pr) => { UI.banner('RANK UP', `${XH.progress.rankName(lv)}  ·  Level ${lv}`, XH.progress.rankColor(lv)); XH.audio.play('rankup'); };
  let introTimers = [];
  UI.intro = (def, lines) => {
    introTimers.forEach(clearTimeout); introTimers = [];
    const lb = $('letterbox'); lb.classList.remove('hidden'); $('hud').classList.add('hidden');
    lb.querySelectorAll('.lb').forEach((b) => (b.style.transform = 'none'));
    const type = (el, text, delay) => { el.textContent = ''; for (let i = 0; i <= text.length; i++) introTimers.push(setTimeout(() => { el.textContent = text.slice(0, i); if (i % 2 && i < text.length) XH.audio.play('uiHover', { vol: 0.5 }); }, delay + i * 38)); };
    $('lbTitle').textContent = ''; $('lbSub').textContent = ''; $('lbSub2').textContent = '';
    type($('lbTitle'), def.name.toUpperCase(), 300);
    type($('lbSub'), lines[0], 1500);
    type($('lbSub2'), lines[1], 2600);
  };
  UI.introEnd = () => {
    introTimers.forEach(clearTimeout); introTimers = [];
    const lb = $('letterbox');
    $('lbTitle').parentElement.style.opacity = 0;
    lb.querySelector('.top').style.transform = 'translateY(-100%)'; lb.querySelector('.bot').style.transform = 'translateY(100%)';
    setTimeout(() => { lb.classList.add('hidden'); $('lbTitle').parentElement.style.opacity = 1; }, 650);
    $('hud').classList.remove('hidden');
    if (XH.game.startBanner) XH.game.startBanner();
  };
  function renderPlayerCard() {
    const D = XH.progress.data, PR = XH.progress;
    $('pcEmblem').src = PR.emblem(D.level, D.prestige, 64);
    $('pcRank').textContent = PR.rankName(D.level); $('pcRank').style.color = PR.rankColor(D.level);
    $('pcLevel').textContent = `Level ${D.level}${D.prestige ? '  ·  Prestige ' + D.prestige : ''}  ·  ${D.escapes} escape${D.escapes === 1 ? '' : 's'}`;
    const need = PR.need(D.level), f = D.level >= PR.MAX_LEVEL ? 1 : D.xp / need;
    $('pcXP').style.width = f * 100 + '%';
    $('pcXPtext').textContent = D.level >= PR.MAX_LEVEL ? (PR.canPrestige() ? 'MAX RANK · Prestige available in the Armory' : 'MAX RANK') : `${U.fmt(D.xp)} / ${U.fmt(need)} XP`;
  }
  UI.renderPlayerCard = renderPlayerCard;
  // 3D thumbnails for the Armory, rendered once per weapon and camo
  const thumbs = {};
  let thumbR = null, thumbScene = null, thumbCam = null;
  function weaponThumb(id, camo) {
    const key = id + '|' + camo + '|' + JSON.stringify(XH.progress.attFor(id) || {});
    if (thumbs[key]) return thumbs[key];
    if (!thumbR) {
      thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbR.setSize(300, 130); thumbR.setPixelRatio(1); thumbR.outputEncoding = THREE.sRGBEncoding; thumbR.toneMapping = THREE.ACESFilmicToneMapping; thumbR.toneMappingExposure = 0.95;
      thumbScene = new THREE.Scene(); thumbScene.environment = XH.weapons.vmScene && XH.weapons.vmScene.environment;
      thumbScene.add(new THREE.HemisphereLight(0xdde8ff, 0x303030, 1.1));
      const k = new THREE.DirectionalLight(0xffffff, 1.6); k.position.set(2, 3, 4); thumbScene.add(k);
      const rim = new THREE.DirectionalLight(0x80b0ff, 0.9); rim.position.set(-3, 1, -3); thumbScene.add(rim);
      thumbCam = new THREE.PerspectiveCamera(22, 300 / 130, 0.1, 20); thumbCam.position.set(0, 0.15, 3.2); thumbCam.lookAt(0, 0, 0);
    }
    const m = XH.weapons.model(id, false, camo), holder = new THREE.Group();
    m.rotation.set(0.08, -Math.PI / 2 - 0.32, 0); holder.add(m); thumbScene.add(holder);
    const box = new THREE.Box3().setFromObject(holder), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const sc = Math.min(2.55 / size.x, 1.0 / size.y);
    holder.scale.setScalar(sc); holder.position.copy(ctr).multiplyScalar(-sc);
    thumbR.render(thumbScene, thumbCam);
    thumbs[key] = thumbR.domElement.toDataURL('image/png');
    thumbScene.remove(holder);
    m.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); });
    return thumbs[key];
  }
  UI.weaponThumb = (id, camo) => weaponThumb(id, camo);
  function renderArmory() {
    const PR = XH.progress, D = PR.data, WP = XH.weapons;
    $('armoryRank').innerHTML = `<img src="${PR.emblem(D.level, D.prestige, 64)}"><span style="color:${PR.rankColor(D.level)}">${PR.rankName(D.level)}</span>`;
    const pb = $('prestigeBtn'); pb.classList.toggle('hidden', !PR.canPrestige());
    pb.onclick = () => { if (confirm('Enter Prestige ' + (D.prestige + 1) + '? Your level resets to 1. Camos are kept.')) { PR.prestige(); XH.audio.play('rankup'); renderArmory(); } };
    const g = $('armorygrid'); g.innerHTML = '';
    const ORDER = ['Pistol', 'Hand Cannon', 'SMG', 'Rifle', 'LMG', 'Heavy', 'Shotgun', 'Marksman', 'Sniper', 'Launcher', 'Energy', 'Special', 'Wonder Weapon'];
    const all = Object.entries(WP.DEFS), classes = [...new Set(all.map(([, d]) => d.cls))].sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99);
    const tabs = $('armorytabs'); tabs.innerHTML = '';
    for (const k of ['All'].concat(classes)) {
      const b = document.createElement('button'), n = k === 'All' ? all.length : all.filter(([, d]) => d.cls === k).length;
      b.className = UI.armTab === k || (!UI.armTab && k === 'All') ? 'on' : ''; b.innerHTML = `${k}<i>${n}</i>`;
      b.onclick = () => { UI.armTab = k; XH.audio.play('uiClick'); renderArmory(); };
      tabs.appendChild(b);
    }
    for (const [id, d] of all) {
      if (UI.armTab && UI.armTab !== 'All' && d.cls !== UI.armTab) continue;
      const c = D.wc[id] || { k: 0, h: 0, u: 0 }, cur = PR.camoFor(id);
      const el = document.createElement('div'); el.className = 'armw';
      el.innerHTML = `<h4>${d.name.toUpperCase()}</h4><div class="cls">${d.cls}${d.cost ? `<span class="cost">WALL ${d.cost}</span>` : ''}</div><div class="role">${d.role || ''}</div><div class="wtraits">${(d.traits || []).map((t) => XH.WTRAITS[t] ? `<span title="${XH.WTRAITS[t][1]}">${XH.WTRAITS[t][0]}</span>` : '').join('')}</div><img class="thumb" src="${weaponThumb(id, cur)}" alt="" title="Open the Gunsmith"><div class="stats">${c.k} kills · ${c.h} headshots · ${c.u} mutated kills</div><div class="swatches"></div>`;
      const sw = el.querySelector('.swatches');
      for (const cm of WP.CAMOS) {
        const un = PR.unlocked(id, cm.id), s = document.createElement('div');
        s.className = 'sw' + (un ? '' : ' locked') + (cur === cm.id ? ' on' : ''); s.style.setProperty('--c', cm.css);
        s.innerHTML = `<b></b>${cm.name}`; s.title = un ? cm.name : `${cm.name}: ${PR.REQ[cm.id].text} (${PR.progressText(id, cm.id)})`;
        if (un) s.onclick = () => { PR.setCamo(id, cm.id); XH.audio.play('uiClick'); renderArmory(); };
        sw.appendChild(s);
      }
      const gb = document.createElement('button'); gb.className = 'gsbtn'; gb.textContent = Object.keys(WP.attAllowed(id)).length ? 'Gunsmith ›' : 'Details ›';
      gb.addEventListener('click', () => { XH.audio.play('uiClick'); UI.openGunsmith(id); }); el.querySelector('.thumb').addEventListener('click', () => UI.openGunsmith(id));
      el.appendChild(gb);
      g.appendChild(el);
    }
  }
  UI.weaponChanged = (slot) => {
    if (!slot) return;
    const n = $('wname'); n.innerHTML = slot.s.name + (slot.aat ? ` <span style="color:${XH.AATS[slot.aat].css}">· ${(slot.aats && slot.aats.length ? slot.aats : [slot.aat]).map((k) => XH.AATS[k].name).join(' + ')}</span>` : ''); n.classList.toggle('upg', slot.upg);
    const T = XH.weapons.state.tactical, tc = $('tactical');
    tc.classList.toggle('hidden', !T);
    if (T) tc.innerHTML = (T.type === 'decoy' ? 'DECOY' : 'LURE') + ' [T] ' + '<i></i>'.repeat(T.n);
    const nd = $('nades'); nd.innerHTML = nadesHtml(); nd._n = nd.innerHTML;
  };
  const nadesHtml = () => { const S = XH.weapons.state; return S.lethal === 'turret' ? '<b class="tur">◭</b>'.repeat(Math.floor(S.grenades / 2)) : S.lethal === 'semtex' ? '<b class="stk">●</b>'.repeat(S.grenades) : S.lethal === 'cryo' ? '<b class="cry">❄</b>'.repeat(S.grenades) : '<i></i>'.repeat(S.grenades); };
  UI.perksChanged = () => {
    const p = $('perks'); p.innerHTML = '';
    for (const pk of [...Object.values(XH.PERKS), ...Object.values(XH.UPERKS || {})]) { if (XH.player.perks.has(pk.id)) { const d = document.createElement('div'); d.className = 'perk'; d.style.color = pk.css; d.textContent = pk.icon; d.title = pk.name; p.appendChild(d); } }
  };
  UI.points = (total, delta) => {
    $('pts').textContent = U.fmt(total);
    if (!delta) return;
    const box = $('popups'); if (box.children.length > 6) box.removeChild(box.firstChild);
    const d = document.createElement('div'); d.className = 'pop' + (delta < 0 ? ' neg' : ''); d.textContent = (delta > 0 ? '+' : '') + delta;
    d.style.right = (Math.random() * 30) + 'px';
    box.appendChild(d); setTimeout(() => d.remove(), 1000);
  };
  UI.deny = () => { const p = $('pts'); p.style.color = '#ff4a3a'; setTimeout(() => (p.style.color = ''), 250); };
  UI.hitmarker = (head, kill) => {
    const h = $('hitmarker'); h.className = (head ? 'head ' : '') + (kill ? 'kill' : ''); h.style.opacity = 1; UI.hitT = kill ? 0.3 : 0.12;
  };
  UI.banner = (title, sub, color) => {
    const b = $('banner'); b.querySelector('.bt').textContent = title; b.querySelector('.bt').style.color = color || '#7dff9a'; b.querySelector('.bs').textContent = sub || '';
    b.style.opacity = 1; UI.bannerT = 3;
  };
  // ---- first-time tips and short notices ----
  let tipQ = [], tipT = 0, noticeT = 0;
  const seenTips = () => { try { return JSON.parse(localStorage.getItem('xenohold.tips') || '{}'); } catch (e) { return {}; } };
  UI.tip = (key) => {
    const T = XH.TIPS[key]; if (!T || !XH.player.settings.tips) return false;
    const seen = seenTips(); if (seen[key] || tipQ.includes(key)) return false;
    seen[key] = 1; if (!XH.DEBUG) { try { localStorage.setItem('xenohold.tips', JSON.stringify(seen)); } catch (e) { /* storage off */ } }
    tipQ.push(key); return true;
  };
  UI.resetTips = () => { try { localStorage.removeItem('xenohold.tips'); } catch (e) { /* storage off */ } };
  UI.notice = (text, css) => { const n = $('notice'); n.textContent = text; n.style.color = css || '#fff'; n.style.opacity = 1; noticeT = 3.5; };
  function updTips(dt) {
    const box = $('tipbox');
    if (tipT > 0) { tipT -= dt; if (tipT <= 0) box.classList.remove('on'); }
    else if (tipQ.length && !XH.sys.intro) { const T = XH.TIPS[tipQ.shift()]; box.querySelector('.tt').textContent = T[0]; box.querySelector('.tx').textContent = T[1]; box.classList.add('on'); tipT = 8.5; }
    if (noticeT > 0) { noticeT -= dt; if (noticeT <= 0) $('notice').style.opacity = 0; }
  }
  UI.roundStart = (r, special) => {
    if (special === 'boss') UI.tip('boss');
    if (r === 2) UI.tip('grenade');
    const rb = $('roundbig');
    rb.querySelector('.rn').textContent = r;
    rb.querySelector('.rs').textContent = special === 'swarm' ? 'THE SWARM DESCENDS' : special === 'boss' ? 'THE TYRANT AWAKENS' : '';
    rb.style.opacity = 1; UI.roundT = 3.2;
    const rd = $('round');
    if (r <= 4) { rd.textContent = '|'.repeat(r); rd.className = 'tally'; } else { rd.textContent = r; rd.className = ''; }
  };
  UI.roundEnd = (r) => UI.banner('ROUND ' + r + ' SURVIVED', 'Regroup. Resupply. They are coming back.', '#7dff9a');
  UI.bossBar = (show, name) => { $('boss').classList.toggle('hidden', !show); if (name) $('boss').querySelector('.bn').textContent = name; };
  UI.bossHp = (f) => { $('boss').querySelector('.bf').style.width = Math.max(0, f * 100) + '%'; };
  UI.flash = (c) => { const f = $('flash'); f.style.transition = 'none'; f.style.background = c; f.style.opacity = 0.9; requestAnimationFrame(() => { f.style.transition = 'opacity 1.2s'; f.style.opacity = 0; }); };
  UI.warnDir = (from) => {
    const P = XH.player, dx = from.x - P.pos.x, dz = from.z - P.pos.z;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const th = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const el = document.createElement('div'); el.className = 'dmgdir warn';
    el.style.transform = `translate(${Math.sin(th) * 150}px, ${-Math.cos(th) * 150}px) rotate(${th}rad)`;
    $('dmgdirs').appendChild(el);
    requestAnimationFrame(() => (el.style.opacity = 0));
    setTimeout(() => el.remove(), 700);
  };
  UI.damage = (from, amt) => {
    const lh = $('lowhp'); UI.dmgPulse = Math.min(1, (UI.dmgPulse || 0) + amt / 40);
    if (!from) return;
    const P = XH.player, dx = from.x - P.pos.x, dz = from.z - P.pos.z;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const th = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const el = document.createElement('div'); el.className = 'dmgdir';
    el.style.transform = `translate(${Math.sin(th) * 120}px, ${-Math.cos(th) * 120}px) rotate(${th}rad)`;
    $('dmgdirs').appendChild(el);
    requestAnimationFrame(() => (el.style.opacity = 0));
    setTimeout(() => el.remove(), 1000);
  };
  UI.gameOver = (st, round, best, escaped, xp) => {
    UI.hideHud();
    const otEl = document.querySelector('.over-t'); otEl.textContent = escaped ? 'ESCAPED' : 'OVERRUN'; otEl.classList.toggle('win', !!escaped);
    const PR = XH.progress, D = PR.data;
    $('overXP').innerHTML = xp ? `<img src="${PR.emblem(D.level, D.prestige, 64)}"><span>+${U.fmt(xp.xp)} XP${xp.levels.length ? ` · RANK UP ×${xp.levels.length}` : ''}<br><small style="color:${PR.rankColor(D.level)}">${PR.rankName(D.level)} · Level ${D.level}</small>${xp.unlocks.length ? `<br><small style="color:#ffd860">Unlocked: ${xp.unlocks.join(', ')}</small>` : ''}</span>` : '';
    $('overRound').textContent = round;
    const ol = XH.modes && XH.modes.overLine(round); document.querySelector('.over-r').innerHTML = ol || `You survived <b id="overRound">${round}</b> rounds`;
    $('overBest').classList.toggle('hidden', !best);
    const ot = XH.MODS.tier(XH.game.heat), oh = $('overHeat');
    oh.textContent = `${modsLabel(XH.game.mods).toUpperCase()} · HEAT ${XH.game.heat} ${ot.name}`; oh.style.color = ot.css;
    UI.scoreboard(XH.game.players > 1 && XH.coop ? XH.coop.boards() : [{ name: 'You', st }]);
    const dr = XH.daily ? XH.daily.onEnd(escaped) : null;
    const lr = XH.telemetry && XH.telemetry.last(), downBy = lr && lr.downs.length ? `<div class="dailyres">Downed by: ${lr.downs.map((d) => XH.telemetry.name(d.by)).join(' · ')}</div>` : '';
    const got = XH.achievements ? XH.achievements.end() : [];
    $('overAch').innerHTML = downBy + (dr ? `<div class="dailyres ${dr.ok ? 'ok' : ''}">Daily challenge: ${dr.ok ? (dr.first ? 'complete! +5,000 XP' : 'complete') : `${XH.daily.targetText(dr.c).toLowerCase()} — not this time`}</div>` : '') + (got.length ? `<div class="ch-t">Achievements unlocked</div>` + got.map((a) => `<span class="achchip">${a.icon} ${a.name}</span>`).join('') : '');
    UI.show('over');
  };
  // End-of-game scoreboard: one row per player, then match highlights and kills per round
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const accOf = (st) => (st.shots ? Math.round(Math.min(1, (st.hits || 0) / st.shots) * 100) : 0);
  UI.scoreboard = (rows) => {
    const cols = [['Kills', (s) => U.fmt(s.kills)], ['Headshots', (s) => U.fmt(s.heads)], ['Accuracy', (s) => accOf(s) + '%'], ['Best streak', (s) => s.bestStreak || 0], ['Downs', (s) => s.downs || 0], ['Earned', (s) => U.fmt(s.earned)], ['Spent', (s) => U.fmt(s.spent || 0)]];
    const best = cols.map(([, f]) => Math.max(...rows.map((r) => parseFloat(String(f(r.st)).replace(/[^0-9.]/g, '')) || 0)));
    $('overBoard').innerHTML = `<table class="sboard"><tr><th></th>${cols.map(([k]) => `<th>${k}</th>`).join('')}</tr>${rows.map((r, i) => `<tr><td class="pn p${i + 1}">${esc(r.name)}</td>${cols.map(([k, f], c) => { const v = f(r.st), top = rows.length > 1 && k !== 'Downs' && parseFloat(String(v).replace(/[^0-9.]/g, '')) === best[c] && best[c] > 0; return `<td class="${top ? 'top' : ''}">${v}</td>`; }).join('')}</tr>`).join('')}</table>`;
    // highlights (summed across players)
    const sum = (k) => rows.reduce((a, r) => a + (r.st[k] || 0), 0), st = rows[0].st;
    const wk = {}; for (const r of rows) for (const [id, n] of Object.entries(r.st.wk || {})) wk[id] = (wk[id] || 0) + n;
    const fav = Object.entries(wk).filter(([id]) => XH.weapons.DEFS[id]).sort((a, b) => b[1] - a[1])[0];
    const hl = [['Favourite weapon', fav ? `${XH.weapons.DEFS[fav[0]].name} <small>${U.fmt(fav[1])} kills</small>` : '—'], ['Damage dealt', U.fmt(Math.round(sum('dmg')))], ['Biggest multi-kill', Math.max(...rows.map((r) => r.st.bestMulti || 0)) + '×'],
      ['Time survived', clock(st.time)], ['Knife kills', sum('melee')], ['Bosses slain', sum('bosses')], ['Doors opened', sum('doors')], ['Perks bought', sum('perks')], ['Self-revives used', sum('revives')]];
    $('overStats').innerHTML = hl.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
    // kills per round
    const rk = []; for (const r of rows) (r.st.rk || []).forEach((n, i) => (rk[i] = (rk[i] || 0) + (n || 0)));
    const r0 = Math.max(0, Math.min((XH.game.startRound || 1) - 1, rk.findIndex((v) => v != null)));
    const rs = []; for (let i = r0; i < Math.max(rk.length, XH.game.round); i++) rs.push(rk[i] || 0);
    rk.length = 0; rk.push(...rs);
    if (rk.length > 1) {
      const mx = Math.max(1, ...rk), w = 100 / rk.length;
      $('overChart').innerHTML = `<div class="ch-t">Kills per round</div><svg viewBox="0 0 100 30" preserveAspectRatio="none">${rk.map((n, i) => `<rect x="${i * w + w * 0.12}" y="${30 - (n / mx) * 28}" width="${w * 0.76}" height="${(n / mx) * 28 + 0.01}"><title>Round ${r0 + i + 1}: ${n} kills</title></rect>`).join('')}</svg><div class="ch-a"><span>Round ${r0 + 1}</span><span>Round ${r0 + rk.length}</span></div>`;
    } else $('overChart').innerHTML = '';
  };
  UI.pauseInfo = () => { $('pauseinfo').textContent = `${XH.game.def.name} · Round ${XH.game.round} · ${U.fmt(XH.game.points)} points · Heat ${XH.game.heat}`; const o = XH.sys.objective(); if (o) $('pauseinfo').textContent += '  ·  ' + o; };

  // per-frame HUD update
  const mm = () => $('minimap');
  const _aim = new THREE.Vector3();
  let fpsAcc = 0, fpsN = 0, fpsT = 0;
  UI.update = (dt) => {
    const WP = XH.weapons, P = XH.player, Gm = XH.game, slot = WP.cur();
    if (slot) {
      const ma = $('mag'); ma.textContent = slot.ammo; ma.classList.toggle('low', slot.ammo <= Math.ceil(slot.s.mag * 0.25));
      $('res').textContent = '/ ' + slot.reserve;
      const nd = $('nades'), nh = nadesHtml(); if (nd._n !== nh) { nd.innerHTML = nh; nd._n = nh; }
    }
    // prompt
    updTips(dt);
    const pr = Gm.prompt(), pe = $('prompt');
    if (pr && !P.downed) {
      if (pr.tip) UI.tip(pr.tip);
      let h = `<span class="key">E</span>${pr.text}`;
      if (pr.cost) h += `<span class="cost ${Gm.points < pr.cost ? 'no' : ''}">${U.fmt(pr.cost)}</span>`;
      if (pr.cost === null) h = pr.text;
      if (pe._h !== h) { pe.innerHTML = h; pe._h = h; }
      pe.style.opacity = 1;
    } else pe.style.opacity = 0;
    // crosshair
    const ads = WP.adsAmount(), ch = $('crosshair');
    const sp = WP.spread() * (innerHeight / 2) / Math.tan(P.cam.fov * Math.PI / 360) + 6;
    ch.style.opacity = ads > 0.5 || P.sprinting ? 0 : 1;
    const aim = P.cam.getWorldDirection(_aim), wall = XH.world.raycast(P.cam.position, aim, 120);
    ch.classList.toggle('enemy', XH.enemies.rayHits(P.cam.position, aim, wall.t, 1).length > 0);
    const hint = $('hint');
    let ht = '', bad = false;
    if (slot && !WP.isReloading() && slot.s.mode !== 'flame') {
      if (slot.ammo === 0 && slot.reserve === 0) { ht = 'NO AMMO'; bad = true; }
      else if (slot.ammo === 0) { ht = 'RELOAD'; bad = true; }
      else if (slot.ammo <= Math.ceil(slot.s.mag * 0.25) && slot.reserve > 0) ht = 'LOW AMMO';
    } else if (slot && slot.s.mode === 'flame' && slot.ammo === 0) { ht = slot.reserve ? 'RELOAD' : 'NO FUEL'; bad = true; }
    if (hint._t !== ht) { hint.textContent = ht; hint._t = ht; }
    hint.classList.toggle('bad', bad);
    const q = ch.children;
    q[0].style.top = (-sp - 9) + 'px'; q[1].style.top = sp + 'px'; q[2].style.left = (-sp - 9) + 'px'; q[3].style.left = sp + 'px';
    $('scope').classList.toggle('hidden', !(slot && slot.s.scope && ads > 0.85));
    // hit marker / banner / round text fades
    if (UI.hitT > 0) { UI.hitT -= dt; if (UI.hitT <= 0) $('hitmarker').style.opacity = 0; }
    if (UI.bannerT > 0) { UI.bannerT -= dt; if (UI.bannerT <= 0) $('banner').style.opacity = 0; }
    if (UI.roundT > 0) { UI.roundT -= dt; if (UI.roundT <= 0) $('roundbig').style.opacity = 0; }
    // health
    const hf = P.hp / P.maxHp;
    $('hpfill').style.width = Math.max(0, hf * 100) + '%';
    $('hpfill').style.background = hf < 0.35 ? '#ff4a3a' : P.maxHp > 100 ? '#ff7060' : '#7dff9a';
    UI.dmgPulse = Math.max(0, (UI.dmgPulse || 0) - dt * 1.5);
    $('lowhp').style.opacity = Math.min(1, Math.max(0, (0.5 - hf) * 2) * (0.75 + Math.sin(P.time * 6) * 0.25) + UI.dmgPulse * 0.6);
    $('downed').classList.toggle('hidden', P.downed !== 'down');
    // status effect haze: blue for chill, green for poison and spores, grey for stun
    const db = P.debuffs || {}, on = (k) => db[k] && db[k].t > 0;
    const dcol = on('stun') ? '160,160,170' : on('spore') ? '120,190,70' : on('poison') ? '90,200,60' : on('chill') ? '140,200,255' : null;
    const dbx = $('debuff'); if (dbx._c !== dcol) { dbx._c = dcol; dbx.style.opacity = dcol ? (on('spore') ? 0.55 : 0.35) : 0; if (dcol) dbx.style.background = `radial-gradient(ellipse at center, rgba(${dcol},0) 35%, rgba(${dcol},0.75) 100%)`; }
    if (P.downed === 'down') { const dt2 = `${P.downLabel || 'GETTING BACK UP'} · ${Math.max(0, Math.ceil(P.downT))}`; if ($('downed')._t !== dt2) { $('downed').textContent = dt2; $('downed')._t = dt2; } }
    const lv = P.lives > 0 ? '✚'.repeat(Math.min(P.lives, 6)) : ''; if ($('lives')._t !== lv) { $('lives').textContent = lv; $('lives')._t = lv; $('lives').title = P.lives + ' self-revives left'; }
    // quest objective
    const ob = $('objective'), otx = XH.sys.objective(); if (ob._t !== otx) { ob.textContent = otx; ob._t = otx; }
    if (P.shield) $('shieldfill').style.width = Math.max(0, P.shield.hp / P.shield.max * 100) + '%';
    // power-ups + capsule buffs
    const pu = $('powerups');
    const BUFF = { ghost: { css: '#90b0ff', glyph: '◌' }, bottomless: { css: '#50ff70', glyph: '∞' }, undying: { css: '#ff5050', glyph: '♱' } };
    const act = [['double', Gm.double], ['insta', Gm.insta], ['sale', Gm.sale], ['ghost', Gm.buffs.ghost], ['bottomless', Gm.buffs.bottomless], ['undying', Gm.buffs.undying]].filter(([, t]) => t > 0);
    const sig = act.map(([k, t]) => k + Math.ceil(t)).join();
    if (pu._s !== sig) {
      pu._s = sig;
      pu.innerHTML = act.map(([k, t]) => { const d = XH.POWERUPS[k] || BUFF[k]; return `<div class="pu" style="color:${d.css};opacity:${t < 5 && Math.ceil(t) % 2 ? 0.4 : 1}"><div class="g">${d.glyph}</div>${Math.ceil(t)}</div>`; }).join('');
    }
    // minimap
    if (P.settings.minimap && !Gm.mods.fog) drawMinimap();
    // fps
    fpsAcc += dt; fpsN++; fpsT -= dt;
    if (fpsT <= 0 && P.settings.fps) { fpsT = 0.5; $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps · ' + XH.enemies.aliveCount() + ' hostiles · ' + XH.main.drawCalls() + ' draws'; fpsAcc = 0; fpsN = 0; }
  };
  function drawMinimap() {
    const c = mm(), x = c.getContext('2d'), W = XH.world, P = XH.player, s = 4, R = 100, scale = 2.2; // px per meter
    x.save();
    x.clearRect(0, 0, 200, 200);
    x.beginPath(); x.arc(R, R, R - 1, 0, Math.PI * 2); x.clip();
    x.translate(R, R);
    x.rotate(P.yaw);
    const k = scale / (W.CELL / s) * (W.CELL / s);
    // world canvas: 4px per cell; cell = 2.5m → 1.6 px/m. Scale to our px/m.
    const f = scale * W.CELL / s;
    x.scale(f, f);
    x.drawImage(W.mapCanvas, -(P.pos.x + W.ox) * s / W.CELL, -(P.pos.z + W.oz) * s / W.CELL);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.translate(R, R); x.rotate(P.yaw);
    const toMap = (wx, wz) => [(wx - P.pos.x) * scale, (wz - P.pos.z) * scale];
    const tracker = W.power || !W.def.power; // without power it only senses creatures close by
    for (const e of XH.enemies.list) {
      if (e.dead || e.state === 'burrowed') continue;
      if (!tracker && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > 9) continue;
      const [mx, my] = toMap(e.pos.x, e.pos.z);
      x.fillStyle = e.def.boss ? '#e060ff' : e.def.heavy ? '#ff8030' : '#ff3a2a';
      x.beginPath(); x.arc(mx, my, e.def.boss ? 5 : e.def.heavy ? 4 : 2.4, 0, 7); x.fill();
    }
    const b = XH.game.box;
    if (b && b.spot) { const [mx, my] = toMap(b.group.position.x, b.group.position.z); x.fillStyle = '#40ffb0'; x.fillRect(mx - 3, my - 3, 6, 6); }
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (!tracker) { x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(R - 62, 2 * R - 34, 124, 16); x.fillStyle = '#ff6a50'; x.font = 'bold 10px Orbitron, Consolas, monospace'; x.textAlign = 'center'; x.fillText('TRACKER OFFLINE', R, 2 * R - 22); }
    // player arrow
    x.fillStyle = '#7dff9a'; x.beginPath(); x.moveTo(R, R - 7); x.lineTo(R + 5, R + 5); x.lineTo(R, R + 2); x.lineTo(R - 5, R + 5); x.closePath(); x.fill();
    x.restore();
    void k;
  }
})();
