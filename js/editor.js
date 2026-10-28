'use strict';
// Map editor: paint a grid of tiles, borrow the look (lighting, sky, weather, music) of an existing map, save it in
// this browser and play it. Every 2.5 m cell is one tile. Left mouse paints, right mouse paints wall, Shift+drag
// fills a rectangle. A map needs one player start, at least two spawn vents, and a way from the start to them.
(function () {
  const U = XH.U, A = XH.audio;
  const ED = XH.editor = {};
  const $ = (id) => document.getElementById(id);
  const TILES = [
    ['.', 'Floor', '#46525c'], ['#', 'Wall', '#15191d'], ['P', 'Player start', '#40ff90'], ['S', 'Spawn vent', '#ff4040'],
    ['1', 'Door 1 (750)', '#c07020'], ['2', 'Door 2 (1000)', '#c88a30'], ['3', 'Door 3 (1250)', '#d0a040'], ['4', 'Door 4 (1500)', '#d8b850'],
    ['a', 'Wall gun a', '#30c060'], ['b', 'Wall gun b', '#38c868'], ['c', 'Wall gun c', '#40d070'], ['d', 'Wall gun d', '#48d878'], ['e', 'Wall gun e', '#50e080'],
    ['M', 'Xeno Cache', '#40ffb0'], ['U', 'Forge', '#c040ff'], ['Z', 'Power switch', '#ffe040'],
    ['J', '', ''], ['R', '', ''], ['D', '', ''], ['A', '', ''], ['L', '', ''], ['V', '', ''], ['E', '', ''], ['I', '', ''], ['Q', '', ''], ['N', '', ''],
    ['=', 'Low cover', '#7a8894'], ['x', 'Crate', '#8a7a5a'], ['+', 'Pillar', '#9aa4ae'], ['O', 'Big pillar', '#b0b8c0'], ['T', 'Tree / spire', '#3a7a3a'],
    ['~', 'Lava', '#ff5a1e'], ['%', 'Acid', '#96ff3c'], ['_', 'Ice floor', '#a8d8f0'], [',', 'Grass', '#3c7a3c'],
  ];
  for (const t of TILES) if (!t[1]) { const p = XH.PERKS[t[0]]; t[1] = 'Perk: ' + (p ? p.name : t[0]); t[2] = p ? p.css : '#ffffff'; }
  const TILE = Object.fromEntries(TILES.map((t) => [t[0], t]));

  const store = () => U.load('customMaps', []);
  const save = (list) => U.save('customMaps', list);
  ED.cur = null; let tile = '.', brush = 1, zoom = 16, painting = null, rectFrom = null, hover = null, dirty = false;

  function blank(w, h) {
    const g = [];
    for (let z = 0; z < h; z++) { let r = ''; for (let x = 0; x < w; x++) r += x === 0 || z === 0 || x === w - 1 || z === h - 1 ? '#' : '.'; g.push(r.split('')); }
    g[Math.floor(h / 2)][Math.floor(w / 2)] = 'P'; g[2][2] = 'S'; g[2][w - 3] = 'S'; g[h - 3][2] = 'S'; g[h - 3][w - 3] = 'S';
    g[1][Math.floor(w / 2) - 2] = 'a'; g[Math.floor(h / 2) + 3][Math.floor(w / 2)] = 'M';
    return g;
  }
  ED.newMap = (w = 36, h = 28) => { ED.cur = { id: 'custom_' + Date.now().toString(36), name: 'My Arena', base: 'kestrel', w, h, grid: blank(w, h) }; dirty = true; render(); };

  // ---------------- the screen ----------------
  ED.open = () => {
    const el = $('m-editor');
    if (!el.dataset.built) {
      el.dataset.built = '1';
      el.innerHTML = `<header><button class="back" data-go="main">‹ Back</button><h2>Map Editor</h2><div id="edInfo" class="hdrinfo"></div></header>
        <div class="edbar">
          <input id="edName" maxlength="28" spellcheck="false" aria-label="Map name">
          <label>Style <select id="edBase"></select></label>
          <label>Size <select id="edSize"><option value="24x20">Small 24×20</option><option value="36x28" selected>Medium 36×28</option><option value="50x40">Large 50×40</option><option value="64x52">Huge 64×52</option></select></label>
          <button id="edNew">New</button><button id="edSave">Save</button>
          <select id="edLoad" aria-label="Saved maps"></select><button id="edDel">Delete</button>
          <button id="edPlay" class="primary">Play ›</button>
        </div>
        <div class="edmain">
          <div class="edpal" id="edPal"></div>
          <div class="edwrap" id="edWrap"><canvas id="edCanvas"></canvas></div>
          <div class="edside"><div class="edtools"><span>Brush</span><button data-b="1" class="on">1</button><button data-b="3">3</button><button data-b="5">5</button></div>
            <div class="edtools"><span>Zoom</span><button data-z="-1">−</button><button data-z="1">+</button></div>
            <div id="edHover" class="edhint"></div>
            <div id="edCheck" class="edcheck"></div>
            <p class="edhint">Left mouse paints · right mouse paints wall · Shift+drag fills a rectangle.<br>Doors go in gaps in walls (1 to 4 cost more as the number goes up). Wall guns go on wall cells. Put a power switch down and the map starts dark until you find it.</p></div>
        </div>`;
      const base = $('edBase'); base.innerHTML = XH.MAPS.filter((m) => !m.custom).map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
      $('edPal').innerHTML = TILES.map(([c, n, col]) => `<button class="edt" data-t="${c}" title="${n}"><i style="background:${col}">${/[a-zA-Z0-9$&?]/.test(c) ? c : ''}</i><span>${n}</span></button>`).join('');
      $('edPal').querySelectorAll('.edt').forEach((b) => b.addEventListener('click', () => { tile = b.dataset.t; palSel(); }));
      el.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => { brush = +b.dataset.b; el.querySelectorAll('[data-b]').forEach((q) => q.classList.toggle('on', q === b)); }));
      el.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => { zoom = U.clamp(zoom + +b.dataset.z * 4, 8, 32); render(); }));
      $('edName').addEventListener('input', () => { if (ED.cur) { ED.cur.name = $('edName').value; dirty = true; } });
      base.addEventListener('change', () => { if (ED.cur) { ED.cur.base = base.value; dirty = true; } });
      $('edNew').onclick = () => { if (dirty && ED.cur && !confirm('Start a new map? Unsaved changes will be lost.')) return; const [w, h] = $('edSize').value.split('x').map(Number); ED.newMap(w, h); };
      $('edSave').onclick = () => { ED.save(); };
      $('edDel').onclick = () => { const id = $('edLoad').value; if (!id || !confirm('Delete this map?')) return; save(store().filter((m) => m.id !== id)); if (ED.cur && ED.cur.id === id) ED.newMap(); listSaved(); };
      $('edLoad').addEventListener('change', () => { const m = store().find((q) => q.id === $('edLoad').value); if (m) { ED.cur = { id: m.id, name: m.name, base: m.base, w: m.w, h: m.h, grid: m.rows.map((r) => r.split('')) }; dirty = false; render(); } });
      $('edPlay').onclick = () => ED.play();
      const cv = $('edCanvas');
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
      cv.addEventListener('mousedown', (e) => { const c = cellAt(e); if (!c) return; if (e.shiftKey) { rectFrom = c; painting = e.button === 2 ? '#' : tile; } else { painting = e.button === 2 ? '#' : tile; paint(c); } });
      addEventListener('mouseup', (e) => { if (rectFrom && painting) { const c = cellAt(e) || hover; if (c) fillRect(rectFrom, c, painting); } painting = null; rectFrom = null; render(); });
      cv.addEventListener('mousemove', (e) => { hover = cellAt(e); if (painting && !rectFrom && hover) paint(hover); else draw(); showHover(); });
      cv.addEventListener('mouseleave', () => { hover = null; draw(); });
    }
    if (!ED.cur) ED.newMap();
    listSaved(); palSel(); render();
  };
  function palSel() { document.querySelectorAll('#edPal .edt').forEach((b) => b.classList.toggle('on', b.dataset.t === tile)); }
  function listSaved() { const l = store(); $('edLoad').innerHTML = `<option value="">Saved maps (${l.length})</option>` + l.map((m) => `<option value="${m.id}" ${ED.cur && ED.cur.id === m.id ? 'selected' : ''}>${m.name.replace(/</g, '')}</option>`).join(''); }
  function cellAt(e) { const cv = $('edCanvas'), r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / zoom), z = Math.floor((e.clientY - r.top) / zoom); return ED.cur && x >= 0 && z >= 0 && x < ED.cur.w && z < ED.cur.h ? { x, z } : null; }
  function set(x, z, t) {
    const M = ED.cur; if (x <= 0 || z <= 0 || x >= M.w - 1 || z >= M.h - 1) { if (t === '#' || /[a-h]/.test(t)) { if (x >= 0 && z >= 0 && x < M.w && z < M.h) M.grid[z][x] = t; } return; } // the border stays wall
    if (t === 'P') for (const row of M.grid) for (let k = 0; k < row.length; k++) if (row[k] === 'P') row[k] = '.';
    M.grid[z][x] = t; dirty = true;
  }
  function paint(c) { const r = (brush - 1) / 2, t = painting; if (t === 'P' || /[a-h]/.test(t) || /[JRDALVEIQNMUZ]/.test(t)) set(c.x, c.z, t); else for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) set(c.x + dx, c.z + dz, t); draw(); }
  function fillRect(a, b, t) { if (t === 'P') { set(b.x, b.z, t); return; } for (let z = Math.min(a.z, b.z); z <= Math.max(a.z, b.z); z++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) set(x, z, t); }
  function showHover() { const el = $('edHover'); if (!el) return; if (!hover) { el.textContent = ''; return; } const t = TILE[ED.cur.grid[hover.z][hover.x]]; el.textContent = `${hover.x}, ${hover.z} · ${t ? t[1] : ED.cur.grid[hover.z][hover.x]}`; }

  function render() {
    if (!ED.cur || !$('edCanvas')) return;
    $('edName').value = ED.cur.name; $('edBase').value = ED.cur.base;
    const cv = $('edCanvas'); cv.width = ED.cur.w * zoom; cv.height = ED.cur.h * zoom;
    draw(); check();
  }
  function draw() {
    const cv = $('edCanvas'), x = cv.getContext('2d'), M = ED.cur; if (!M) return;
    x.fillStyle = '#0b0d10'; x.fillRect(0, 0, cv.width, cv.height);
    for (let z = 0; z < M.h; z++) for (let c = 0; c < M.w; c++) {
      const ch = M.grid[z][c], t = TILE[ch]; x.fillStyle = t ? t[2] : '#555'; x.fillRect(c * zoom, z * zoom, zoom - 1, zoom - 1);
      if (zoom >= 12 && t && /[a-zA-Z0-9]/.test(ch) && ch !== 'T' && ch !== 'O' && ch !== 'x') { x.fillStyle = '#000'; x.font = `bold ${Math.round(zoom * 0.62)}px Consolas, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, c * zoom + zoom / 2, z * zoom + zoom / 2 + 1); }
    }
    if (hover) { x.strokeStyle = '#ffd860'; x.lineWidth = 2; const r = rectFrom ? null : (brush - 1) / 2; if (rectFrom) { x.strokeRect(Math.min(rectFrom.x, hover.x) * zoom, Math.min(rectFrom.z, hover.z) * zoom, (Math.abs(hover.x - rectFrom.x) + 1) * zoom, (Math.abs(hover.z - rectFrom.z) + 1) * zoom); } else x.strokeRect((hover.x - r) * zoom, (hover.z - r) * zoom, brush * zoom, brush * zoom); }
  }
  // ---------------- checks ----------------
  const WALLISH = (c) => c === '#' || (c >= 'a' && c <= 'w');
  const PASS = (c) => !WALLISH(c) && !'+OTJRDALVEIQNMUZ=x'.includes(c); // doors count as passable for the check
  ED.check = check;
  function check() {
    const M = ED.cur, g = M.grid, probs = [];
    let start = null, spawns = [];
    for (let z = 0; z < M.h; z++) for (let x = 0; x < M.w; x++) { const c = g[z][x]; if (c === 'P') start = { x, z }; if (c === 'S') spawns.push({ x, z }); }
    if (!start) probs.push('Place a player start (P).');
    if (spawns.length < 2) probs.push('Place at least 2 spawn vents (S).');
    if (start) {
      const seen = new Set([start.x + ',' + start.z]), q = [start];
      while (q.length) { const { x, z } = q.shift(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz, k = nx + ',' + nz; if (seen.has(k) || nx < 0 || nz < 0 || nx >= M.w || nz >= M.h || !PASS(g[nz][nx])) continue; seen.add(k); q.push({ x: nx, z: nz }); } }
      const cut = spawns.filter((s) => !seen.has(s.x + ',' + s.z)).length; if (cut) probs.push(`${cut} spawn vent${cut > 1 ? 's are' : ' is'} walled off from the start.`);
      let open = 0; for (const k of seen) open++; if (open < 30) probs.push('The start area is very small.');
    }
    const el = $('edCheck'); if (el) el.innerHTML = probs.length ? probs.map((p) => `<div class="bad">• ${p}</div>`).join('') : '<div class="ok">✔ Ready to play</div>';
    const info = $('edInfo'); if (info) info.textContent = `${M.w}×${M.h}${dirty ? ' · unsaved' : ''}`;
    return probs;
  }
  ED.save = () => {
    const M = ED.cur; if (!M) return;
    const list = store().filter((m) => m.id !== M.id);
    list.unshift({ id: M.id, name: M.name || 'My Arena', base: M.base, w: M.w, h: M.h, rows: M.grid.map((r) => r.join('')) });
    save(list); dirty = false; listSaved(); check(); A.play('uiClick');
    if (XH.ui.banner) { const b = $('edInfo'); if (b) b.textContent += ' · saved'; }
  };

  // ---------------- play ----------------
  // the same kind of map the map editor (XenoholdEditor.exe) makes, see js/edits.js
  ED.defFor = (m) => {
    const rows = m.rows || m.grid.map((r) => r.join(''));
    const def = XH.edits.customDef(m.id, { name: m.name, base: m.base, w: m.w, h: m.h }, rows);
    XH.MAPGRIDS[def.id] = rows;
    return def;
  };
  ED.play = () => {
    const M = ED.cur; if (!M) return;
    const probs = check(); if (probs.length) { A.play('deny'); return; }
    ED.save();
    const def = ED.defFor({ id: M.id, name: M.name, base: M.base, w: M.w, h: M.h, grid: M.grid });
    A.init(); XH.main.startGame(def, 1, XH.ui.deployMods ? Object.assign(XH.ui.deployMods(), { mode: 'standard' }) : undefined);
  };
})();
