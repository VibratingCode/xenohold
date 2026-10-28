'use strict';
// Xenohold map editor: the game page in editor mode (index.html?editor, opened by XenoholdEditor.exe).
// A top-down plan and a live 3D view of the real game world. Paint tiles and floors, shape the ground (raise, lower,
// ramps), place props, blocks, logs, signs and lights, move every generated piece (traps and their levers, structures,
// make new maps of your own or copy the ones made in the game's own map maker,
// the ammo station, bench, egg...) and every tile object, keep the theme's clutter out of areas, edit rooms and map
// settings, then save. Saving goes through the
// editor's local server into mapedits/<map>.json and js/mapedits.js, which the game loads (see js/edits.js).
(function () {
  const W = XH.world, SD = XH.setdress, M = XH.main, P = XH.player, E = XH.edits;
  const CELL = W.CELL, TOKEN = new URLSearchParams(location.search).get('token') || '';
  const $ = (id) => document.getElementById(id);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const deg = (r) => Math.round(r * 180 / Math.PI * 10) / 10;

  // ---------------- what can be painted and placed ----------------
  const TILES = [
    ['.', 'Floor', '#4a555e'], ['#', 'Wall', '#14181c'], [',', 'Grass', '#3c7a3c'], ['_', 'Ice floor', '#a8d8f0'],
    ['~', 'Lava', '#ff5a1e'], ['%', 'Acid', '#96ff3c'], ['P', 'Player start', '#40ff90'], ['S', 'Spawn vent', '#ff4040'],
    ['=', 'Low cover', '#7a8894'], ['x', 'Crate', '#8a7a5a'], ['+', 'Block', '#9aa4ae'], ['O', 'Pillar', '#b0b8c0'], ['T', 'Tree / spire', '#3a7a3a'],
    ['M', 'Xeno Cache', '#40ffb0'], ['U', 'Forge', '#c040ff'], ['Z', 'Power switch', '#ffe040'], ['G', 'Gum machine', '#ff80d0'], ['K', 'Workbench (shields)', '#ffb040'],
    ['H', 'Heart (objective)', '#ff3080'], ['$', 'Pylon (objective)', '#60e0ff'], ['&', 'Wonder part', '#ffd060'], ['?', 'Egg (quest)', '#d0a0ff'],
  ];
  for (let d = 0; d <= 9; d++) TILES.push([String(d), 'Door ' + d, '#c07020']);
  for (let k = 0; k < 23; k++) { const ch = String.fromCharCode(97 + k); TILES.push([ch, 'Wall gun ' + ch, '#2e9a58']); }
  for (const ch of 'JRDALVEIQN') { const p = XH.PERKS && XH.PERKS[ch]; TILES.push([ch, 'Perk: ' + (p ? p.name : ch), p && p.css ? p.css : '#ffffff']); }
  const TILE = Object.fromEntries(TILES.map((t) => [t[0], t]));
  const FLOORCOL = { plank: '#8a6a44', plate: '#6a7078', tile: '#9aa0a4', grate: '#3a4048', concrete: '#8a8a86', oil: '#6a6660', gravel: '#7a746a', carpet: '#3a4a66', rubber: '#2a2a2a', lino: '#b8c4bc', metal: '#4a5058' };
  const CATS = [
    ['Rooms & furniture', 'bunk lockers shelf console racks workbench gunRack cryo labBench desk table chairs cart dispenser evaRack planter hydro telescope window panel'],
    ['Machines & cargo', 'tanks generator pump capacitors furnace forklift oreCart orePile anvil molds plates pallet crates barrels jerry tires oxygen'],
    ['Camp & expedition', 'tent campfire sled luggage stakes floodlight digGrid drillRig flagpole'],
    ['Vehicles & big pieces', 'truck apc rover lander shuttle landingPad cockpit nacelle hull container crusher ladle crucibleBig reactor helix rail barge solar'],
    ['Hive & remains', 'body skeleton bones barricade eggs cocoon hole crystals iceGiant frozenFall throne pews altar sarcophagus statue'],
    ['Decals & detail', 'blood scorch creep casings trail stripes claws skulls grime cables pipes vines debris lamp floodLines'],
  ];
  const WALLPROPS = new Set('bunk lockers shelf console racks workbench gunRack cryo labBench tanks generator pump evaRack dispenser capacitors furnace cocoon pipes panel claws floodLines skulls window iceGiant frozenFall lamp cables vines grime'.split(' '));
  const CATCOL = { 'Rooms & furniture': '#5aa0ff', 'Machines & cargo': '#ffb040', 'Camp & expedition': '#e0d060', 'Vehicles & big pieces': '#c080ff', 'Hive & remains': '#ff5a8a', 'Decals & detail': '#8a8a8a', Blocks: '#40e0c0', Story: '#60ffc0', Other: '#cccccc',
    Logic: '#ffe060', 'Moving and breakable': '#60d0ff', Fortifications: '#d8b060', 'Walls and buildings': '#9ab8d8', Industrial: '#ff9050', 'Nature and alien': '#70d880', 'Street and camp': '#e8e070', Zones: '#ff5068', Traps: '#ff9a30' };
  const catOf = (k) => { if (k === '@block') return 'Blocks'; if (k === '@zone') return 'Zones'; if (k === '@trap') return 'Traps'; if (k === '@trigger' || k === '@marker') return 'Logic'; if (k[0] === '@') return 'Story'; if (SD.kitMeta[k]) return SD.kitMeta[k].cat; for (const [c, list] of CATS) if (list.split(' ').includes(k)) return c; return 'Other'; };
  // zones (js/hazards.js), traps you place yourself (js/traps.js) and the builder's kit (js/kit.js)
  const HZ = () => XH.hazards, TRP = () => XH.traps, LOGIC = () => XH.logic;
  const kitLabel = (k) => (SD.kitMeta[k] ? SD.kitMeta[k].label : k);
  const entCol = (e) => (e.k === '@trigger' ? '#ffe060' : e.k === '@marker' ? hex((LOGIC().MARKERS[(e.o || {}).kind || 'point'] || {}).color || 0x60c0ff) : e.k === '@zone' && HZ().TYPES[e.zt] ? hex(HZ().TYPES[e.zt].color) : e.k === '@trap' && TRP().KINDS[e.tt] ? hex(TRP().KINDS[e.tt].color) : CATCOL[catOf(e.k)]);
  const entName = (e) => (e.tag ? '«' + e.tag + '» ' : '') + (e.k === '@trigger' ? '⚡ ' + ((LOGIC().WHEN[(e.o || {}).when || 'enter'] || {}).label || 'Trigger') : e.k === '@marker' ? (LOGIC().MARKERS[(e.o || {}).kind || 'point'] || {}).label : e.k === '@block' ? e.b : e.k === '@text' ? '“' + e.text + '”' : e.k === '@log' ? '▣ ' + ((e.log || {}).title || 'log') : e.k === '@zone' ? (HZ().TYPES[e.zt] || {}).label || e.zt : e.k === '@trap' ? (e.o && e.o.name) || (TRP().KINDS[e.tt] || {}).label || e.tt : kitLabel(e.k));
  const shiftLever = (c, dx, dz) => { if (c.lx !== undefined) { c.lx = r3(c.lx + dx); c.lz = r3(c.lz + dz); } return c; };
  const COLORKEYS = new Set(['color', 'sheet', 'suit', 'helmet', 'blanket', 'glow', 'screen', 'fluid', 'leaf', 'light', 'rim', 'band', 'wrap', 'tint']);
  // ready-made groups (positions relative to where you click)
  const pk = (k, x, z, ry = 0, o) => Object.assign({ k, x, z, y: 0, ry }, o ? { o } : {});
  const pz = (zt, x, z, w, d, o) => Object.assign({ k: '@zone', zt, x, z, w, d }, o ? { o } : {});
  const pt = (tt, x, z, w, d, lx, lz, o) => Object.assign({ k: '@trap', tt, x, z, w, d, lx, lz }, o ? { o } : {});
  const QT = Math.PI / 2;
  // the game's own pieces, placed by hand on a map of your own (on the arenas they place themselves)
  const GAME_PIECES = [
    ['ammo', 'Ammo station', 'wall', 'Refills every gun, once a round. Goes against a wall.'],
    ['bench', 'Wonder Bench', 'point', 'Builds the wonder weapon from its three parts.'], ['part0', 'Wonder part 1', 'point'], ['part1', 'Wonder part 2', 'point'], ['part2', 'Wonder part 3', 'point'],
    ['egg', 'Companion egg', 'point', 'Hatches Kit, the tame skitterling.'],
    ['altar', 'Bone altar (secret quest)', 'point', 'With at least two hive eyes: the secret boss quest.'], ['eye0', 'Hive eye 1', 'eye'], ['eye1', 'Hive eye 2', 'eye'], ['eye2', 'Hive eye 3', 'eye'], ['eye3', 'Hive eye 4', 'eye'],
    ['tele0', 'Teleporter A', 'point', 'Needs Teleporter B too.'], ['tele1', 'Teleporter B', 'point', 'Needs Teleporter A too.'],
    ['building', 'Building (enterable, roof, ladder)', 'building'], ['platform', 'Raised platform with stairs', 'platform'],
    ['dtrap0', 'Door trap 1 (on a door)', 'door', 'A flame or shock trap on a doorway, with its lever.'], ['dtrap1', 'Door trap 2 (on a door)', 'door'],
  ];
  const BUILTIN_PREFABS = [
    { name: 'Log on a table', ents: [{ k: 'table', x: 0, z: 0, y: 0, ry: 0 }, { k: '@log', x: 0.4, z: 0, y: 0, ry: 0, h: 0.82, log: { title: 'New log', who: 'Someone', text: 'What happened here.' } }] },
    { name: 'Checkpoint', ents: [pk('checkpoint', 0, 0), pk('razorFence', -6.5, 0, 0, { len: 5 }), pk('razorFence', 5.5, 0, 0, { len: 5 }), pk('lampPost', -4.6, 1.6), pk('beacon', 3.2, -0.6)] },
    { name: 'Sniper nest', ents: [pk('sniperDeck', 0, 0), pk('ammoCrates', 2.2, -1.2), pk('sandbags', 0, -2.4)] },
    { name: 'Bunker line', ents: [pk('pillbox', 0, 0), pk('hesco', -5.2, 0.5), pk('hesco', 5.2, 0.5), ...[-6, -3, 0, 3, 6].map((x) => pk('wire', x, 4.6)), pk('tankTrap', -4, 7), pk('tankTrap', 0, 7.6), pk('tankTrap', 4, 7)] },
    { name: 'Command bunker and stairs', ents: [pk('bunker', 0, 0), pk('sandbags', 0, 5, 0, { len: 6 }), pk('radioMast', -5.5, -4, 0, { h: 10 })] },
    { name: 'T-wall line', ents: [pk('twall', 0, 0, 0, { n: 4 }), pk('twall', 3.8, 1.9, QT, { n: 2 })] },
    { name: 'Guard post', ents: [pk('guardTower', 0, 0), pk('sandbagCorner', -3.5, 3), pk('razorFence', 0, -4, 0, { len: 7.5 }), pk('spotTower', 3.8, -2.4)] },
    { name: 'Supply dump', ents: [pk('containerStack', 0, -3.2), pk('ammoCrates', -3, 1, 0, { n: 6 }), pk('fuelDrums', 2.6, 1.2), pk('camoNet', 0, 1.2, 0, { w: 8, d: 4.5 }), pk('pallet', 4.6, 2.2), pk('crates', -0.6, 2)] },
    { name: 'Field hospital', ents: [pk('tentMil', 0, 0), pz('heal', 0, 0, 5, 5), pk('beacon', 2.9, 2.9, 0, { color: 0x40ff80 }), pk('bench', -3.6, 0.8, QT)] },
    { name: 'Fuel depot (explosive)', ents: [pk('fuelTank', 0, -2.6), pk('barrelBoom', -2, 0.5), pk('barrelBoom', -1.3, 0.9), pk('barrelBoom', -2.3, 1.3), pk('barrelBoom', 2, 0.6), pk('gasCans', 3.2, 1.6), pk('fuelDrums', 0, 1.6), ...[-3.5, 0, 3.5].map((x) => pk('jersey', x, 4.2, 0, { stripes: true }))] },
    { name: 'Radio outpost', ents: [pk('radioMast', 3, -2.5), pk('hut', -2.2, 0), pk('dieselGen', 1.6, 2.6), pk('sandbagCorner', -5.2, 3.2)] },
    { name: 'Machine shop', ents: [pk('press', -3.2, -1), pk('beltConveyor', 1.2, 0.4), pk('dieselGen', -1.2, 3.2), pk('valves', 3.8, 3), pk('cableSpool', -4.6, 2.6)] },
    { name: 'Trench line', ents: [pk('trench', 0, 0, 0, { len: 7.5 }), ...[-2.6, 0.4, 3.4].map((x) => pk('wire', x, 3.6))] },
    { name: 'Alien nest', ents: [pk('hiveColumn', -3, -2), pk('hiveColumn', 3, -2.6), pk('hiveColumn', 0.4, 3.2), pk('eggCluster', 0, 0), pk('eggCluster', -2.6, 1.6), pk('glowShrooms', 2.6, 1.8), pz('gas', 0, 0, 7.5, 7.5)] },
    { name: 'Frozen lake', ents: [pz('ice', 0, 0, 10, 7.5), pk('iceSpike', -5.6, -3), pk('iceSpike', 5.6, 3.4), pk('iceSpike', 4.6, -4.2), pk('rocks', -4.2, 4.6)] },
    { name: 'Lava moat', ents: [pz('lava', 0, -3.75, 10, 2.5), pz('lava', -3.125, 3.75, 3.75, 2.5), pz('lava', 3.125, 3.75, 3.75, 2.5), pz('lava', -3.75, 0, 2.5, 5), pz('lava', 3.75, 0, 2.5, 5)] },
    { name: 'Bridge over lava', ents: [pz('lava', 0, 0, 7.5, 7.5), pk('bridge', 0, 0, 0, { len: 7.5, w: 2.5, h: 1.6 }), pk('stairs', -4.7, 0, QT, { h: 1.6, w: 2 }), pk('stairs', 4.7, 0, -QT, { h: 1.6, w: 2 })] },
    { name: 'Kill pit', ents: [pz('kill', 0, 0, 5, 5, { look: 'void' }), pk('railing', 0, -2.75, 0, { len: 5 }), pk('railing', -2.75, 0, QT, { len: 5 }), pk('railing', 2.75, 0, QT, { len: 5 }), pk('beacon', -3.1, 3.1), pk('beacon', 3.1, 3.1)] },
    { name: 'Conveyor to the void', ents: [pz('conveyor', 0, 0, 2.5, 10, { dir: 0, force: 4 }), pz('kill', 0, 6.25, 2.5, 2.5, { look: 'void' }), pk('railing', -1.45, 1.25, QT, { len: 12.5 }), pk('railing', 1.45, 1.25, QT, { len: 12.5 })] },
    { name: 'Crusher corridor', ents: [pk('concreteWall', 0, -2.2, 0, { len: 7.5 }), pk('concreteWall', 0, 2.2, 0, { len: 7.5 }), pz('crusher', 0, 0, 3.75, 3.75), pk('beacon', -4.2, -1.6), pk('beacon', 4.2, 1.6)] },
    { name: 'Laser hallway', ents: [pk('concreteWall', 0, -1.9, 0, { len: 10 }), pk('concreteWall', 0, 1.9, 0, { len: 10 }), pt('laser', 0, 0, 1, 3.5, -6, 0.9)] },
    { name: 'Tesla defence', ents: [pt('tesla', 0, 0, 1.5, 1.5, 2.2, 2.2), pk('forceField', 0, 4.2), pk('forceField', 0, -4.2)] },
    { name: 'Jump pad to a deck', ents: [pk('deck', 0, -6, 0, { h: 4 }), pz('jumppad', 0, 0, 2.5, 2.5, { power: 15, push: 9, dir: 180 })] },
    { name: 'Minefield', ents: [pz('mines', 0, 0, 10, 7.5, { count: 10 }), pk('beacon', -5.3, -4), pk('beacon', 5.3, -4), pk('beacon', -5.3, 4), pk('beacon', 5.3, 4)] },
    { name: 'Acid spill', ents: [pz('acid', 0, 0, 5, 3.75), pk('tallTank', -4.4, -1.4, 0, { h: 4, r: 1.2 }), pk('fuelDrums', 3.4, -1.6, 0, { n: 2 }), pk('beacon', 3, 2.4, 0, { color: 0x9dff3a })] },
    { name: 'Wind tunnel', ents: [pz('wind', 0, 0, 10, 3.75, { dir: 90, force: 7 }), pk('concreteWall', 0, -2.2, 0, { len: 10 }), pk('concreteWall', 0, 2.2, 0, { len: 10 })] },
    { name: 'Healing shrine', ents: [pz('heal', 0, 0, 3.75, 3.75, { rate: 15 }), pk('obelisk', 0, -3, 0, { glow: 0x40ff80, h: 4 }), ...[[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].map(([x, z]) => pk('pillarRound', x, z, 0, { h: 3.2, r: 0.3 }))] },
  ];

  // ---------------- state ----------------
  let def = null, id = null;
  let grid = [], floors = [], ents = [], lights = [], zones = null, clear = [], doors = {}, buys = {}, look = {};
  let mod = {}, dirty = false, idSeq = 0, power = true, entRoot = null, t = 0;
  // Drawing only when something changed: the 3D view and the plan redraw after input, a change or a camera move, and
  // not at all while nothing happens. While things move the 3D view skips bloom; once they stop it draws one full frame.
  let need3 = 2, need2 = true, lastInput = -9, live = false, fullPending = false;
  let sceneDirty = false;
  const redraw = () => { need3 = 2; need2 = true; sceneDirty = true; };
  const gizRoot = new THREE.Group(); gizRoot.name = 'xedit-gizmos';
  let sel = []; // [{ t: 'ent' | 'light' | 'clear' | 'zone', e | i }]
  let tool = 'select', tileCh = '#', floorStyle = 'plank', asset = null, brush = 1, clearR = 3, snap = 0.25, rotStep = 15;
  let prefabs = [], clipboard = null;
  // generated pieces (traps, levers, structures...) and where they are pinned; the shape of the ground
  let place = {}, pieces = [], pieceDrag = {}, tileDrag = null, th = new Float32Array(1), tdir = new Uint8Array(1), trise = new Float32Array(1);
  let hStep = 0.5, hSet = 1, hStroke = null, rampFrom = null, rampTo = null;
  let waves = null; // the map's waves (which creatures from which round, bosses, how many)
  let zoneBox = null, pickTarget = null; // a zone being dragged out with the Place tool; a teleporter waiting for its target
  const OBJ = 'PSMUZGKH$&?JRDALVEIQN0123456789'; // tile symbols that are things you can pick up and move
  const undo = [], redo = [];

  // ---------------- DOM ----------------
  document.body.classList.add('xedit');
  const root = document.createElement('div'); root.id = 'xedit';
  root.innerHTML = `
  <div class="xe-top">
    <b class="xe-logo">XENOHOLD <span>EDITOR</span></b>
    <select id="xeMap" title="Map"></select>
    <button id="xeNew" title="Start a map of your own">+ New map</button>
    <button id="xeSave" title="Save (Ctrl+S)">Save</button>
    <button id="xeUndo" title="Undo (Ctrl+Z)">↶</button><button id="xeRedo" title="Redo (Ctrl+Y)">↷</button>
    <button id="xeTest" title="Save, then play this map in a new window">▶ Test</button>
    <button id="xeHere" title="Save, then play from where the 3D camera is (Ctrl+Enter). God mode and the round are set in the Map tab">▶ Here</button>
    <span class="xe-sep"></span>
    <button id="xeView" title="Plan / split / 3D (Tab)">Split view</button>
    <select id="xeSnap" title="Move snap"><option value="0">no snap</option><option value="0.1">0.1 m</option><option value="0.25" selected>0.25 m</option><option value="0.5">0.5 m</option><option value="1.25">1.25 m</option><option value="2.5">2.5 m</option></select>
    <select id="xeTurn" title="Turn step (R, [ ], the rotate ring)"><option value="5">5°</option><option value="15" selected>15°</option><option value="45">45°</option><option value="90">90°</option></select>
    <button id="xePower" title="Preview with the power on or off">Power on</button>
    <button id="xeLive" title="Animate the scene (rain, flames, flickering lights). Off: the view only redraws when something changes, which is much lighter">Live</button>
    <button id="xeRebuild" title="Rebuild the whole map (F5)">Rebuild</button>
    <span class="xe-sep"></span>
    <button id="xeRegen" title="Throw away the placed dressing and generate it again from the map's story">Regenerate</button>
    <button id="xeRevert" title="Delete this map's saved edits and go back to how it shipped">Revert</button>
    <span id="xeState" class="xe-state"></span>
    <button id="xeHelp" title="Controls (F1)">?</button>
  </div>
  <div class="xe-tools" id="xeTools">
    <button data-tool="select" title="Select and move (V)">⬚<i>Select</i></button>
    <button data-tool="place" title="Place the asset picked on the right (P)">✚<i>Place</i></button>
    <button data-tool="tiles" title="Paint tiles: walls, floor, doors, vents... (B)">▦<i>Tiles</i></button>
    <button data-tool="floor" title="Paint floor surfaces (G)">▤<i>Floor</i></button>
    <button data-tool="height" title="Raise and lower the floor (H)">⛰<i>Height</i></button>
    <button data-tool="ramp" title="Drag a ramp from one level to another (N)">◢<i>Ramp</i></button>
    <button data-tool="light" title="Add and edit lights (L)">✦<i>Light</i></button>
    <button data-tool="clear" title="Keep the theme's scattered clutter out of an area (C)">⊘<i>Clear</i></button>
    <button data-tool="zone" title="Named rooms (Z)">▭<i>Rooms</i></button>
  </div>
  <div class="xe-views" id="xeViews">
    <div class="xe-pane" id="xe2d"><canvas id="xeCanvas"></canvas><div class="xe-label">PLAN</div></div>
    <div class="xe-pane" id="xe3d"><div class="xe-label">3D · hold right mouse to look, WASD to fly</div></div>
  </div>
  <div class="xe-side">
    <div class="xe-tabs"><button data-tab="assets" class="on">Assets</button><button data-tab="props">Properties</button><button data-tab="map">Map</button><button data-tab="scene" title="Everything on the map, by kind: find, select, hide and lock">Scene</button></div>
    <div class="xe-panel" id="xeAssets"></div>
    <div class="xe-panel hidden" id="xeProps"></div>
    <div class="xe-panel hidden" id="xeMapPanel"></div>
    <div class="xe-panel hidden" id="xeScene"></div>
  </div>
  <div class="xe-status"><span id="xeCursor"></span><span id="xeMsg"></span><span id="xeHint"></span></div>
  <div class="xe-help hidden" id="xeHelpBox"><div>
    <h3>Map editor controls</h3>
    <table>
      <tr><th colspan="2">Views</th></tr>
      <tr><td>Plan</td><td>wheel zooms · middle or right drag pans (Space + drag too) · double-click moves the 3D camera there</td></tr>
      <tr><td>3D</td><td>hold right mouse to look · WASD fly · Q / E down and up · Shift faster · wheel moves forward · middle drag pans</td></tr>
      <tr><td>Tab</td><td>split view, 3D only, plan only · F5 rebuilds the map · F focuses the selection</td></tr>
      <tr><td>Gizmo</td><td>select one piece: in 3D drag its red / blue arrows to move it, the green arrow to lift it, the yellow ring to turn it (Alt: no snapping) · snap and turn step in the top bar</td></tr>
      <tr><td>Scene tab</td><td>everything on the map by kind: search, click to select, double-click to fly there · the eye hides a kind in both views, the lock stops it being picked</td></tr>
      <tr><td>Live</td><td>off: the views only redraw when something changes (much lighter) · on: rain, flames and flickering lights animate · the numbers top right are the 3D view's speed</td></tr>
      <tr><th colspan="2">Tools</th></tr>
      <tr><td>V Select</td><td>click, Shift+click to add, drag a box on the plan · drag to move (Alt: no snapping) · arrows nudge (Shift: a whole cell)</td></tr>
      <tr><td></td><td>everything can be picked: props, lights, the generated pieces (pink: traps and levers, turret nests, building, platform, teleporters, ammo station, bench, parts, egg, eyes, altar) and tile objects (perks, vents, box, forge, power, doors, wall guns...)</td></tr>
      <tr><td></td><td>several things on one spot (a trap under a crate, a lever beside a prop): click again without moving to pick the next one</td></tr>
      <tr><td>R  [  ]</td><td>turn the selection (Shift+R the other way) · Ctrl+D duplicate · Ctrl+C / Ctrl+V copy and paste at the cursor · Del delete</td></tr>
      <tr><td>P Place</td><td>places what is picked under Assets · wall pieces (▮) hang on the nearest wall · blocks fill two by two cells</td></tr>
      <tr><td>Traps</td><td>Assets › Traps: click to place one, then drag its round handle (the lever) wherever you want it to stand · the generated traps (pink) move too, and a door's flame or shock trap can be dropped on another door</td></tr>
      <tr><td>Zones</td><td>Assets › Zones: drag out a rectangle (or click) · instant death, lava, deep water you drown in, acid, gas, radiation, fire, live floors, crushers, flame jets, lasers, spikes, mines, saws, mud, ice, wind, conveyors, low gravity, jump pads, teleporters, healing, barriers, fog</td></tr>
      <tr><td>Kit</td><td>Assets › Fortifications, Walls and buildings, Industrial, Nature and alien, Street and camp: solid pieces to stand on and hide behind (bunkers, T-walls, towers with ladders, stairs, decks, bridges, explosive barrels...) and ready-made groups</td></tr>
      <tr><td>B Tiles</td><td>walls, floor, doors, vents, perks, wall guns... · right click paints floor · Shift+drag fills a rectangle</td></tr>
      <tr><td>G Floor</td><td>floor surfaces (plank, tile, grating...) · right click clears</td></tr>
      <tr><td>H Height</td><td>left raises, right lowers · Shift paints the set height · Ctrl+click picks up a height · anyone walks up steps of up to 0.6 m; higher needs a ramp</td></tr>
      <tr><td>N Ramp</td><td>drag from one level across to another: the cells between become a slope joining them</td></tr>
      <tr><td>L Light</td><td>click empty floor to add · click a light to move it · colour, strength, range and height in Properties</td></tr>
      <tr><td>C Clear</td><td>circles the theme's scattered clutter stays out of · right click removes one</td></tr>
      <tr><td>Z Rooms</td><td>drag to move, drag an edge to resize, Ctrl+drag draws a new room · rooms decide where the ammo, bench, egg and traps go</td></tr>
      <tr><th colspan="2">Logic</th></tr>
      <tr><td>Triggers</td><td>Assets › Logic: when the player walks in, presses a button, pulls a lever, shoots a target, a round starts, N kills, the power comes on... then (Properties) open doors, switch named zones, traps and moving pieces, spawn creatures or a boss, messages, sounds, power, teleport, explosions, win · “pick” links a piece by clicking it; the plan draws the wiring</td></tr>
      <tr><td>Markers</td><td>named points (for spawns, teleports, explosions), extra creature spawn points, boss spawn points</td></tr>
      <tr><td>Moving</td><td>Assets › Moving and breakable: blast doors, elevators, moving platforms and ziplines (drag the round end handle), extending bridges, breakable and secret walls, mounted guns</td></tr>
      <tr><td>Waves</td><td>Map tab: from which round each creature comes, boss and swarm rounds, how many, how fast · ▶ Here (Ctrl+Enter) plays from the 3D camera, with god mode and a start round</td></tr>
      <tr><th colspan="2">Your own maps</th></tr>
      <tr><td>+ New map</td><td>name it, pick whose look it borrows (lighting, sky, weather, music, creatures), its size and a starting layout: an empty arena, four rooms joined by doors, or a copy of an arena's layout</td></tr>
      <tr><td>Map list</td><td>Arenas, then Your maps, then any maps made in the game's own map maker: pick one of those to copy it here · the Map tab renames a map or changes its look · Delete map removes it</td></tr>
      <tr><td>Game pieces</td><td>nothing places itself on a map of your own: Assets › Game pieces adds the ammo station, Wonder Bench and parts, egg, altar and eyes, teleporters, building, platform and door traps where you click · Delete takes one away</td></tr>
      <tr><td>Map tools</td><td>Map tab › Size resizes a map of your own · Tiles tool: Ctrl+drag picks a region, Ctrl+C / Ctrl+V copy and paste it, R turns the copy · a water or lava zone's Properties sink the floor under it into a pit</td></tr>
      <tr><th colspan="2">Saving</th></tr>
      <tr><td>Ctrl+S</td><td>saves this map to mapedits/ (a backup of the last version is kept) · Test saves, then plays it in a new window</td></tr>
      <tr><td>Ctrl+Z / Y</td><td>undo and redo · Revert deletes the map's edits · Regenerate throws away the placed dressing and makes it again</td></tr>
    </table>
    <p>Select several props and use Save group (Properties) to reuse them on any map.</p>
    <button id="xeHelpClose">Close</button>
  </div></div>`;
  document.body.appendChild(root);
  const pane2 = $('xe2d'), pane3 = $('xe3d'), cv = $('xeCanvas'), cx2 = cv.getContext('2d');
  const gl = document.getElementById('gl'); pane3.insertBefore(gl, pane3.firstChild);
  let layout = 'split';
  M.viewSize = () => [Math.max(64, pane3.clientWidth), Math.max(64, pane3.clientHeight)];
  const ro = new ResizeObserver(() => { M.resize(); sizeCanvas(); }); ro.observe(pane3); ro.observe(pane2);
  function sizeCanvas() { const r = window.devicePixelRatio || 1; cv.width = Math.max(1, pane2.clientWidth * r); cv.height = Math.max(1, pane2.clientHeight * r); }
  function setLayout(l) {
    layout = l; $('xeViews').dataset.layout = l;
    $('xeView').textContent = l === 'split' ? 'Split view' : l === '2d' ? 'Plan only' : '3D only';
    setTimeout(() => { M.resize(); sizeCanvas(); }, 0);
  }
  setLayout('split');
  let msgT = 0;
  function msg(text, bad) { const el = $('xeMsg'); el.textContent = text; el.classList.toggle('bad', !!bad); msgT = 6; }
  function markDirty(part) { if (part) mod[part] = true; dirty = true; showState(); redraw(); }
  function showState() { $('xeState').textContent = (def ? def.name : '') + (dirty ? ' · unsaved changes' : ' · saved') + ' · ' + ents.length + ' props · ' + lights.length + ' lights'; $('xeState').classList.toggle('dirty', dirty); }

  // ---------------- the working copy ----------------
  const gridRows = () => grid.map((r) => r.join(''));
  const floorStr = () => floors.join('');
  const strip = (e) => { const o = {}; for (const k in e) if (k[0] !== '_') o[k] = e[k]; return o; };
  const stripId = (e) => { const o = strip(e); o._id = e._id; return o; };
  const lookKeys = ['fog', 'ambient', 'moon', 'bloomT'];
  function defOverrides(all) {
    const d = {};
    if (all || mod.lights) d.lights = lights;
    if (all || mod.doors) d.doors = doors;
    if (all || mod.buys) d.buys = buys;
    if (all || mod.look) for (const k of lookKeys) if (look[k] !== undefined) d[k] = look[k];
    if ((all || mod.waves) && waves) d.waves = waves;
    return d;
  }
  // ---------------- the ground ----------------
  // heights in quarter metres, one letter per cell ('O' = 0) as js/world.js reads them; ramps listed with their low edge
  const LV0 = 79, lvCh = (h) => String.fromCharCode(Math.max(64, Math.min(126, LV0 + Math.round(h / 0.25))));
  function terrainDoc() {
    let any = false; const rows = [], ramps = [];
    for (let z = 0; z < W.h; z++) { let r = ''; for (let x = 0; x < W.w; x++) { const i = z * W.w + x, h = tdir[i] ? 0 : th[i]; if (h) any = true; r += lvCh(h); } rows.push(r); }
    for (let i = 0; i < th.length; i++) if (tdir[i]) { any = true; ramps.push([i % W.w, (i / W.w) | 0, tdir[i], r3(th[i]), r3(trise[i])]); }
    return any ? { h: rows, ramps } : undefined;
  }
  function loadTerrain(t) {
    const n = W.w * W.h; th = new Float32Array(n); tdir = new Uint8Array(n); trise = new Float32Array(n);
    if (!t) return;
    for (let z = 0; z < W.h && t.h && z < t.h.length; z++) for (let x = 0; x < W.w && x < t.h[z].length; x++) th[z * W.w + x] = (t.h[z].charCodeAt(x) - LV0) * 0.25;
    for (const [x, z, d, h0, rise] of t.ramps || []) { const i = z * W.w + x; tdir[i] = d; th[i] = h0; trise[i] = rise; }
  }
  const isWallCh = (c) => c === '#' || (c >= 'a' && c <= 'w');
  // a cell's surface at the middle of its edge facing (sx, sz)
  function tEdge(i, sx, sz) { const d = tdir[i], h = th[i]; if (!d) return h; const r = trise[i], mid = h + r / 2; if (d === 1) return sx > 0 ? h + r : sx < 0 ? h : mid; if (d === 2) return sx < 0 ? h + r : sx > 0 ? h : mid; if (d === 3) return sz > 0 ? h + r : sz < 0 ? h : mid; return sz < 0 ? h + r : sz > 0 ? h : mid; }
  const cellH = (i) => (tdir[i] ? th[i] + trise[i] / 2 : th[i]);
  // what the world is built from while editing: everything, with the dressing as a list (spawned by the editor)
  function liveDoc() { return { grid: gridRows(), def: clone(defOverrides(true)), zones: zones ? clone(zones) : undefined, dress: { entities: ents.map(strip), floors: floorStr() }, clear: clone(clear), place: clone(place), terrain: terrainDoc() }; }
  // what is saved: only the parts changed from how the map shipped
  function savedDoc() {
    const out = { v: 1 };
    if (custom) out.custom = custom;
    if (mod.grid || custom) out.grid = gridRows();
    const d = defOverrides(!!custom); if (Object.keys(d).length) out.def = d;
    if (mod.zones && zones) out.zones = zones;
    if (mod.dress) out.dress = { floors: floorStr(), entities: ents.map(strip) };
    if (clear.length) out.clear = clear;
    if (Object.keys(place).length) out.place = place;
    if (mod.terrain) { const t = terrainDoc(); if (t) out.terrain = t; }
    return out;
  }
  // readable JSON: one grid row, one entity or one light per line
  function pretty(o) {
    const L = ['{'], keys = Object.keys(o);
    keys.forEach((k, i) => {
      const end = i < keys.length - 1 ? ',' : '', v = o[k];
      if (k === 'grid') L.push('  "grid": [\n' + v.map((r) => '    ' + JSON.stringify(r)).join(',\n') + '\n  ]' + end);
      else if (k === 'dress') L.push('  "dress": {\n    "floors": ' + JSON.stringify(v.floors) + ',\n    "entities": [\n' + v.entities.map((e) => '      ' + JSON.stringify(e)).join(',\n') + '\n    ]\n  }' + end);
      else if (k === 'def') { const dk = Object.keys(v); L.push('  "def": {\n' + dk.map((q, j) => '    ' + JSON.stringify(q) + ': ' + (q === 'lights' ? '[\n' + v.lights.map((l) => '      ' + JSON.stringify(l)).join(',\n') + '\n    ]' : JSON.stringify(v[q])) + (j < dk.length - 1 ? ',' : '')).join('\n') + '\n  }' + end); }
      else if (k === 'terrain') L.push('  "terrain": {\n    "h": [\n' + v.h.map((r) => '      ' + JSON.stringify(r)).join(',\n') + '\n    ],\n    "ramps": [' + v.ramps.map((q) => '\n      ' + JSON.stringify(q)).join(',') + (v.ramps.length ? '\n    ' : '') + ']\n  }' + end);
      else if (k === 'place') { const pk = Object.keys(v); L.push('  "place": {\n' + pk.map((q) => '    ' + JSON.stringify(q) + ': ' + JSON.stringify(v[q])).join(',\n') + '\n  }' + end); }
      else L.push('  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + end);
    });
    L.push('}'); return L.join('\n') + '\n';
  }
  function snapshot() { return JSON.stringify({ grid: gridRows(), floors: floorStr(), ents: ents.map(stripId), lights, zones, clear, doors, buys, look, mod, place, terrain: terrainDoc() || null }); }
  function commit() { undo.push(snapshot()); if (undo.length > 200) undo.shift(); redo.length = 0; }
  function restore(json) {
    const s = JSON.parse(json);
    const worldChange = s.grid.join('\n') !== gridRows().join('\n') || s.floors !== floorStr() || JSON.stringify(s.zones) !== JSON.stringify(zones) || JSON.stringify(s.clear) !== JSON.stringify(clear)
      || s.lights.length !== lights.length || JSON.stringify(s.doors) !== JSON.stringify(doors) || JSON.stringify(s.buys) !== JSON.stringify(buys) || JSON.stringify(s.look) !== JSON.stringify(look)
      || JSON.stringify(s.ents.filter((e) => e.k === '@block')) !== JSON.stringify(ents.filter((e) => e.k === '@block').map(stripId))
      || JSON.stringify(s.place || {}) !== JSON.stringify(place) || JSON.stringify(s.terrain || null) !== JSON.stringify(terrainDoc() || null);
    grid = s.grid.map((r) => r.split('')); floors = s.floors.split(''); lights = s.lights; zones = s.zones; clear = s.clear; doors = s.doors; buys = s.buys; look = s.look; mod = s.mod; place = s.place || {}; loadTerrain(s.terrain);
    const old = new Map(ents.map((e) => [e._id, e]));
    ents = s.ents.map((e) => { const o = old.get(e._id); if (o && JSON.stringify(stripId(o)) === JSON.stringify(e)) { old.delete(e._id); return o; } return e; });
    sel = [];
    if (worldChange) rebuild();
    else {
      for (const e of old.values()) if (!ents.includes(e)) unspawn(e);
      for (const e of ents) if (!e._g) spawnEnt(e);
      lights.forEach((l, i) => lightLive(i)); gizmos();
    }
    dirty = true; showState(); showProps(); gridDirty = true;
  }
  function doUndo() { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); msg('Undone'); }
  function doRedo() { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); msg('Redone'); }

  // ---------------- building the world ----------------
  function build() {
    E.apply(id);
    SD.editor = true;
    M.menuMap = null; M.previewMap(def); M.clearCreatures();
    W.setPower(power, true);
    if (!gizRoot.parent) M.scene.add(gizRoot);
  }
  // record the generated dressing of the map as it is now (the "bake")
  function generate(base) {
    E.live[id] = base; SD.rec = []; SD.recFloors = {};
    try { build(); } finally { SD.rec = SD.rec || []; }
    const list = SD.rec, fl = SD.recFloors || {}; SD.rec = null; SD.recFloors = null;
    const f = new Array(W.w * W.h).fill('.'); for (const i in fl) f[i] = SD.FLOORCODE[fl[i]] || '.';
    return { entities: list, floors: f.join('') };
  }
  function rebuild() {
    const cam = { p: P.cam.position.clone(), r: P.cam.rotation.clone() };
    E.live[id] = liveDoc();
    const t0 = performance.now(), keep = entRoot && entRoot.parent ? entRoot : null;
    if (keep) { unbatchAll(); keep.parent.remove(keep); } // the world disposes everything it holds
    build();
    batchRoot = null; chunks.clear();
    entRoot = keep || new THREE.Group(); entRoot.name = 'xedit-entities'; W.root.add(entRoot);
    const live = new Set(ents);
    for (const c of [...entRoot.children]) if (!live.has(c.userData.ent) || c.userData.ent._g !== c) { entRoot.remove(c); disposeGroup(c); }
    let made = 0; for (const e of ents) if (!e._g || e.k === '@block' || e._sig !== groundSig(e)) { spawnEnt(e); made++; }
    batchT = 0.4; stats.build = Math.round(performance.now() - t0); stats.made = made;
    lights.forEach((l, i) => lightLive(i));
    pieces = W.pieces.map((q) => Object.assign({}, q)); pieceDrag = {};
    P.cam.position.copy(cam.p); P.cam.rotation.copy(cam.r);
    gridDirty = true; gizmos(); showState(); redraw(); settle = 3;
    if (sel.some((q) => q.t === 'piece')) { sel = sel.filter((q) => q.t !== 'piece' || pieces.some((pc) => pc.key === q.i)); showProps(); }
  }
  let rebuildT = 0;
  const rebuildSoon = () => { rebuildT = 0.35; };
  function disposeGroup(g) {
    g.traverse((o) => {
      if (o.isMesh && o.userData.merged && o.geometry) o.geometry.dispose();
      if (o.material && o.material.map && o.material.map.userData && o.material.map.userData.transient) { o.material.map.dispose(); o.material.dispose(); }
    });
  }
  function unspawn(e) { unbatchEnt(e); if (e._g) { if (e._g.parent) e._g.parent.remove(e._g); disposeGroup(e._g); e._g = null; } }
  // the ground under a piece (its middle and its corners): when that changes the piece is built again on a rebuild
  function groundSig(e) { const b = e._box, x0 = b ? b.min.x + e.x - e._x0 : e.x - 1, x1 = b ? b.max.x + e.x - e._x0 : e.x + 1, z0 = b ? b.min.z + e.z - e._z0 : e.z - 1, z1 = b ? b.max.z + e.z - e._z0 : e.z + 1; return [W.dispAt(e.x, e.z), W.dispAt(x0, z0), W.dispAt(x1, z0), W.dispAt(x0, z1), W.dispAt(x1, z1)].join(','); }
  function spawnEnt(e) {
    unspawn(e);
    if (!e._id) e._id = ++idSeq;
    const outer = new THREE.Group(), inner = new THREE.Group();
    outer.position.set(e.x, 0, e.z); inner.position.set(-e.x, 0, -e.z); outer.add(inner);
    try { SD.spawnInto(e, inner); } catch (err) { console.warn('spawn', e.k, err); }
    outer.traverse((o) => { o.userData.ent = e; });
    entRoot.add(outer); e._g = outer;
    outer.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(inner);
    if (b.isEmpty() || !isFinite(b.min.x)) b.set(new THREE.Vector3(e.x - 0.3, 0, e.z - 0.3), new THREE.Vector3(e.x + 0.3, 0.6, e.z + 0.3));
    const m = 0.35; // small things stay clickable
    if (b.max.x - b.min.x < m * 2) { const c = (b.max.x + b.min.x) / 2; b.min.x = c - m; b.max.x = c + m; }
    if (b.max.z - b.min.z < m * 2) { const c = (b.max.z + b.min.z) / 2; b.min.z = c - m; b.max.z = c + m; }
    if (e.k === '@zone' || e.k === '@trap' || e.k === '@trigger') { const w = (e.w || 2.5) / 2, d = (e.d || 2.5) / 2; b.min.x = e.x - w; b.max.x = e.x + w; b.min.z = e.z - d; b.max.z = e.z + d; }
    e._box = b; e._x0 = e.x; e._z0 = e.z; e._ry0 = e.ry || 0; e._y0 = e.y || 0; e._sig = groundSig(e);
    outer.visible = !hiddenCat(e); batchT = 0.6; redraw();
  }
  // live transform while dragging (rebuilt properly when the drag ends)
  function moveLive(e) {
    if (!e._g) return;
    unbatchEnt(e); redraw();
    e._g.position.set(e.x, (e.y || 0) - (e._y0 || 0), e.z);
    e._g.rotation.y = (e.ry || 0) - e._ry0;
    e._g.children[0].position.set(-e._x0, 0, -e._z0);
  }
  const boxOf = (e) => { const b = e._box; if (!b) return null; const dx = e.x - e._x0, dz = e.z - e._z0; return { x0: b.min.x + dx, x1: b.max.x + dx, z0: b.min.z + dz, z1: b.max.z + dz, y1: b.max.y }; };

  // ---------------- lights ----------------
  const lightFloor = (l) => (def.ceiling ? 0 : W.dispAt(W.cx2x(l[0]), W.cz2z(l[1])));
  const lightY = (l) => (l[5] !== undefined && l[5] !== null ? l[5] : def.ceiling ? def.wallH - 0.6 : Math.min(def.wallH, 6) - 0.4) + lightFloor(l);
  function lightLive(i) {
    const L = W.lights[i], l = lights[i]; if (!L || !l) return;
    redraw();
    const x = W.cx2x(l[0]), z = W.cz2z(l[1]), y = lightY(l);
    L.x = x; L.z = z; L.y = y; L.light.position.set(x, y, z); L.glow.position.set(x, y, z);
    L.color = l[2]; L.base = l[3]; L.light.distance = l[4];
    L.light.color.setHex(l[2]); L.glow.material.color.setHex(l[2]);
    if (W.power) L.light.intensity = l[3];
  }
  const gizMat = {};
  function gizmos() {
    const shared = new Set(Object.values(gizMat));
    while (gizRoot.children.length) { const c = gizRoot.children.pop(); if (!c.userData.own) continue; if (c.geometry && !c.userData.sharedGeo) c.geometry.dispose(); if (c.material && !shared.has(c.material)) c.material.dispose(); }
    redraw();
    if (!def) return;
    lights.forEach((l, i) => {
      const x = W.cx2x(l[0]), z = W.cz2z(l[1]), y = lightY(l);
      const m = gizMat[l[2]] || (gizMat[l[2]] = new THREE.MeshBasicMaterial({ color: l[2] }));
      if (hideCat.has('Lights')) return;
      const s = new THREE.Mesh(gizSphere, m); s.position.set(x, y, z); s.userData = { light: i, own: true, sharedGeo: true }; gizRoot.add(s);
      const fy = lightFloor(l), pole = new THREE.Mesh(gizPole, m); pole.scale.y = Math.max(0.1, y - fy); pole.position.set(x, (y + fy) / 2, z); pole.userData = { light: i, own: true, sharedGeo: true }; gizRoot.add(pole);
      if (isSel('light', i)) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(l[4] * 0.98, l[4], 64), new THREE.MeshBasicMaterial({ color: l[2], transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.05, z); ring.userData = { own: true }; gizRoot.add(ring);
      }
    });
    for (const s of sel) if (s.t === 'ent' && s.e._box) {
      const b = boxOf(s.e), h = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(b.x0, 0, b.z0), new THREE.Vector3(b.x1, Math.max(0.3, b.y1), b.z1)), 0xffb840);
      h.userData = { own: true, ent: s.e }; gizRoot.add(h);
    }
    for (const s of sel) if (s.t === 'lever') { const e = s.e, fy = W.floorAt(e.lx, e.lz), h = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(e.lx - 0.35, fy, e.lz - 0.35), new THREE.Vector3(e.lx + 0.35, fy + 2.1, e.lz + 0.35)), 0xffb840); h.userData = { own: true }; gizRoot.add(h); }
    for (const pc of pieces) {
      const [ox, oz] = pieceDrag[pc.key] || [0, 0], w = pc.w || (pc.r || 0.5) * 2, d = pc.d || (pc.r || 0.5) * 2, x = pc.x + ox, z = pc.z + oz, fy = W.floorAt(x, z);
      const hgt = pc.shape === 'rect' || pc.shape === 'door' ? 0.5 : pc.shape === 'eye' ? 0.6 : 1.9, y = pc.shape === 'eye' ? pc.y : fy + hgt / 2;
      const b = new THREE.Mesh(pickGeo, pickMat); b.scale.set(w, hgt, d); b.position.set(x, y, z); b.userData = { piece: pc.key }; gizRoot.add(b);
      if (isSel('piece', pc.key)) { b.updateMatrixWorld(); const h = new THREE.BoxHelper(b, 0xff70d0); h.userData = { own: true }; gizRoot.add(h); }
    }
    for (const q of sel) if (q.t === 'tile') {
      const cx = q.i % W.w, cz = (q.i / W.w) | 0, fy = W.floorAt(W.cx2x(cx), W.cz2z(cz));
      const h = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(W.cx2x(cx) - CELL / 2, fy, W.cz2z(cz) - CELL / 2), new THREE.Vector3(W.cx2x(cx) + CELL / 2, fy + 2.5, W.cz2z(cz) + CELL / 2)), 0xffb840);
      h.userData = { own: true }; gizRoot.add(h);
    }
    clear.forEach((c) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(c[2] - 0.08, c[2], 48), new THREE.MeshBasicMaterial({ color: 0xff4060, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(c[0], 0.06, c[1]); ring.userData = { own: true }; gizRoot.add(ring);
    });
    cursorMesh.userData.own = false; gizRoot.add(cursorMesh);
  }
  const pickGeo = new THREE.BoxGeometry(1, 1, 1), pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const gizSphere = new THREE.SphereGeometry(0.28, 12, 8), gizPole = new THREE.CylinderGeometry(0.03, 0.03, 1, 5);
  pickMat.visible = false; // pick boxes are hit by rays but never drawn

  // ---------------- batching: placed pieces drawn as a few big meshes ----------------
  // Each piece is its own group so it can be moved alone, which costs a draw call per material per piece (a busy map
  // has a thousand). Pieces nobody is touching are merged per 16 m chunk and material; touching one breaks its chunk
  // up until things settle. The pieces stay where they are (hidden) for picking.
  const CH = 16, chunks = new Map(); let batchRoot = null, batchT = 0, settle = 0;
  const chunkKey = (x, z) => Math.floor(x / CH) + ',' + Math.floor(z / CH);
  function unbatchChunk(k) { const c = chunks.get(k); if (!c) return; for (const m of c.meshes) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); } for (const o of c.srcs) o.visible = true; chunks.delete(k); redraw(); }
  function unbatchEnt(e) { if (e._ck) unbatchChunk(e._ck); batchT = 0.6; }
  function unbatchAll() { for (const k of [...chunks.keys()]) unbatchChunk(k); }
  function mergeWorld(list) {
    let n = 0; for (const o of list) n += o.geometry.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), colr = new Float32Array(n * 3), v = new THREE.Vector3(), nm = new THREE.Matrix3();
    let k = 0;
    for (const o of list) {
      const g = o.geometry, P0 = g.attributes.position, N0 = g.attributes.normal, UV = g.attributes.uv, C0 = g.attributes.color, m = o.matrixWorld; nm.getNormalMatrix(m);
      for (let i = 0; i < P0.count; i++, k++) {
        v.fromBufferAttribute(P0, i).applyMatrix4(m); pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
        if (N0) { v.fromBufferAttribute(N0, i).applyMatrix3(nm).normalize(); nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z; }
        if (UV) { uv[k * 2] = UV.getX(i); uv[k * 2 + 1] = UV.getY(i); }
        if (C0) { colr[k * 3] = C0.getX(i); colr[k * 3 + 1] = C0.getY(i); colr[k * 3 + 2] = C0.getZ(i); } else { colr[k * 3] = colr[k * 3 + 1] = colr[k * 3 + 2] = 1; }
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    out.computeBoundingSphere(); return out;
  }
  function rebatch() {
    if (!W.root || !entRoot) return;
    if (!batchRoot || !batchRoot.parent) { batchRoot = new THREE.Group(); batchRoot.name = 'xedit-batches'; W.root.add(batchRoot); chunks.clear(); }
    const busy = new Set(sel.filter((s) => s.t === 'ent' || s.t === 'lever').map((s) => s.e)), by = new Map();
    for (const e of ents) { if (!e._g || !e._g.visible || busy.has(e)) { e._ck = null; continue; } const k = chunkKey(e.x, e.z); e._ck = k; if (chunks.has(k)) continue; let l = by.get(k); if (!l) by.set(k, (l = [])); l.push(e); }
    for (const [k, list] of by) {
      const perMat = new Map();
      for (const e of list) { e._g.updateMatrixWorld(true); e._g.traverse((o) => { if (!o.isMesh || !o.userData.merged || !o.visible) return; let l = perMat.get(o.material); if (!l) perMat.set(o.material, (l = [])); l.push(o); }); }
      const meshes = [], srcs = [];
      for (const [mat, l] of perMat) {
        if (l.length < 2) continue;
        const m = new THREE.Mesh(mergeWorld(l), mat); m.matrixAutoUpdate = false; m.userData.batch = true; batchRoot.add(m); meshes.push(m);
        for (const o of l) { o.visible = false; srcs.push(o); }
      }
      chunks.set(k, { meshes, srcs });
    }
    redraw();
  }
  // categories hidden with the Scene panel's eyes (see below)
  const hideCat = new Set(), lockCat = new Set();
  const hiddenCat = (e) => hideCat.size > 0 && (hideCat.has(sceneCat(e)) || (e._hide === true));
  const sceneCat = (e) => (e.k === '@zone' ? 'Zones' : e.k === '@trap' ? 'Traps' : e.k === '@trigger' ? 'Triggers' : e.k === '@marker' ? 'Markers' : e.k === '@log' || e.k === '@text' ? 'Story' : e.k === '@block' ? 'Blocks' : SD.kitMeta[e.k] ? 'Kit' : SD.FLAT.has(e.k) ? 'Decals' : 'Props');
  const cursorMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffb840, transparent: true, opacity: 0.25, depthWrite: false }));
  cursorMesh.visible = false;

  // ---------------- selection ----------------
  const selV = (s) => (s.t === 'ent' || s.t === 'lever' ? s.e : s.i);
  const isSel = (t, v) => sel.some((s) => s.t === t && selV(s) === v);
  function select(list, add) {
    if (!add) sel = [];
    for (const s of list) { const i = sel.findIndex((q) => q.t === s.t && selV(q) === selV(s)); if (i >= 0 && add) sel.splice(i, 1); else if (i < 0) sel.push(s); }
    for (const s of sel) if (s.e) unbatchEnt(s.e);
    batchT = 0.8; gizmos(); showProps(); if (sel.length && $('xeScene').classList.contains('hidden')) tab('props');
  }
  const selEnts = () => sel.filter((s) => s.t === 'ent').map((s) => s.e);
  function deleteSel() {
    if (!sel.length) return;
    commit();
    const dead = new Set([...selEnts(), ...sel.filter((s) => s.t === 'lever').map((s) => s.e)]); if (dead.size) { for (const e of dead) unspawn(e); ents = ents.filter((e) => !dead.has(e)); markDirty('dress'); if ([...dead].some((e) => e.k === '@block')) rebuildSoon(); }
    const li = sel.filter((s) => s.t === 'light').map((s) => s.i).sort((a, b) => b - a); if (li.length) { for (const i of li) lights.splice(i, 1); markDirty('lights'); rebuildSoon(); }
    const ci = sel.filter((s) => s.t === 'clear').map((s) => s.i).sort((a, b) => b - a); if (ci.length) { for (const i of ci) clear.splice(i, 1); markDirty(); rebuildSoon(); }
    const zi = sel.filter((s) => s.t === 'zone').map((s) => s.i).sort((a, b) => b - a); if (zi.length && zones) { for (const i of zi) zones.splice(i, 1); markDirty('zones'); rebuildSoon(); }
    let kept = 0;
    for (const q of sel.filter((s) => s.t === 'piece')) { const pc = pieces.find((x) => x.key === q.i); if (pc && custom) { delete place[pc.key]; markDirty('place'); rebuildSoon(); } else if (pc && pc.off) { place[pc.key] = { off: true }; markDirty('place'); rebuildSoon(); } else kept++; }
    for (const q of sel.filter((s) => s.t === 'tile')) { const cx = q.i % W.w, cz = (q.i / W.w) | 0, ch = grid[cz][cx]; grid[cz][cx] = (ch >= 'a' && ch <= 'w') || (ch >= '0' && ch <= '9') ? '#' : '.'; markDirty('grid'); rebuildSoon(); }
    sel = []; gizmos(); showProps(); msg(kept ? 'That piece has to stay: move it instead' : 'Deleted', !!kept);
  }
  function addEnts(list, select_) {
    for (const e of list) { e._id = ++idSeq; ents.push(e); spawnEnt(e); }
    markDirty('dress');
    if (list.some((e) => e.k === '@block')) rebuildSoon();
    if (select_) select(list.map((e) => ({ t: 'ent', e })));
  }
  function duplicate() {
    const list = selEnts(); if (!list.length) return;
    commit();
    addEnts(list.map((e) => { const c = strip(e); c.x = r3(c.x + 1); c.z = r3(c.z + 1); shiftLever(c, 1, 1); c.s = (Math.random() * 4294967296) >>> 0; delete c.nav; return c; }), true);
    msg('Duplicated ' + list.length);
  }
  function copySel() { const list = selEnts(); if (!list.length) return; const cx = list.reduce((s, e) => s + e.x, 0) / list.length, cz = list.reduce((s, e) => s + e.z, 0) / list.length; clipboard = list.map((e) => { const c = strip(e); c.x -= cx; c.z -= cz; shiftLever(c, -cx, -cz); delete c.nav; return c; }); msg('Copied ' + list.length); }
  function pasteAt(x, z) { if (!clipboard) return; commit(); addEnts(clipboard.map((e) => { const c = clone(e); c.x = r3(c.x + x); c.z = r3(c.z + z); shiftLever(c, x, z); c.s = (Math.random() * 4294967296) >>> 0; return c; }), true); msg('Pasted'); }
  // turn the selection around its middle
  function rotateSel(by) {
    const list = selEnts(); if (!list.length) return;
    commit();
    const cx = list.reduce((s, e) => s + e.x, 0) / list.length, cz = list.reduce((s, e) => s + e.z, 0) / list.length, c = Math.cos(by), s = Math.sin(by);
    let blocks = false;
    for (const e of list) {
      const dx = e.x - cx, dz = e.z - cz;
      const px = list.length > 1 ? cx : e.x, pz0 = list.length > 1 ? cz : e.z;
      if (list.length > 1) { e.x = r3(cx + dx * c + dz * s); e.z = r3(cz - dx * s + dz * c); }
      if (e.lx !== undefined) { const lx = e.lx - px, lz = e.lz - pz0; e.lx = r3(px + lx * c + lz * s); e.lz = r3(pz0 - lx * s + lz * c); }
      const odd = Math.abs(Math.round(by / (Math.PI / 2)) * (Math.PI / 2) - by) < 0.01 && Math.round(by / (Math.PI / 2)) % 2;
      if (e.k === '@block' || e.k === '@zone' || e.k === '@trap') { if (odd) { const w = e.w; e.w = e.d; e.d = w; } if (e.k === '@block') blocks = true; }
      if (e.k !== '@block') e.ry = r3(((e.ry || 0) + by + Math.PI * 4) % (Math.PI * 2));
      if (e.k === '@zone' && HZ().TYPES[e.zt] && 'dir' in HZ().TYPES[e.zt].o) { e.o = e.o || {}; e.o.dir = r3((((e.o.dir || 0) + by * 180 / Math.PI) % 360 + 360) % 360); }
      rotNav(e, by);
      spawnEnt(e);
    }
    markDirty('dress'); if (blocks) rebuildSoon(); gizmos(); showProps();
  }
  // pathing cells follow the entity when it turns by quarter turns; anything else and they are worked out from its shape
  function rotNav(e, by) {
    if (!e.nav) return;
    const q = Math.round(by / (Math.PI / 2));
    if (Math.abs(q * Math.PI / 2 - by) > 0.01) { delete e.nav; return; }
    for (let k = 0; k < ((q % 4) + 4) % 4; k++) e.nav = e.nav.map(([dx, dz]) => [dz, -dx]);
  }
  function nudge(dx, dz) {
    const list = selEnts(), lv = sel.filter((s) => s.t === 'lever').map((s) => s.e); if (!list.length && !lv.length) return;
    commit();
    for (const e of list) { e.x = r3(e.x + dx); e.z = r3(e.z + dz); shiftLever(e, dx, dz); spawnEnt(e); }
    for (const e of lv) if (!list.includes(e)) { shiftLever(e, dx, dz); spawnEnt(e); }
    markDirty('dress'); if (list.some((e) => e.k === '@block')) rebuildSoon(); gizmos();
  }

  // ---------------- snapping ----------------
  const snapV = (v, alt) => (alt || !snap ? r3(v) : r3(Math.round(v / snap) * snap));
  // the nearest wall face to a point: where a wall prop hangs, facing into the room
  function wallFace(x, z, maxD = 1.8) {
    const cx = W.cellX(x), cz = W.cellZ(z); let best = null;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const fx = cx + dx, fz = cz + dz; if (!W.inside(fx, fz)) continue;
      const ch = grid[fz][fx]; if (ch === '#' || (ch >= 'a' && ch <= 'w')) continue;
      for (const [wx, wz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = (grid[fz + wz] || [])[fx + wx]; if (!(c === '#' || (c >= 'a' && c <= 'w'))) continue;
        const px = W.cx2x(fx) + wx * CELL / 2, pz = W.cz2z(fz) + wz * CELL / 2;
        // slide along the wall under the cursor, within this face
        const ax = wx ? px : Math.max(px - CELL / 2 + 0.3, Math.min(px + CELL / 2 - 0.3, x)), az = wz ? pz : Math.max(pz - CELL / 2 + 0.3, Math.min(pz + CELL / 2 - 0.3, z));
        const d = Math.hypot(ax - x, az - z);
        if (d < maxD && (!best || d < best.d)) best = { d, x: ax, z: az, ry: Math.atan2(-wx, -wz) };
      }
    }
    return best;
  }

  // ---------------- the plan (2D) ----------------
  const view = { x: 0, z: 0, zoom: 8 }; // zoom: screen px per metre
  let gridDirty = true, gridLayer = null, hover = null, drag = null, marquee = null;
  const toScreen = (x, z) => { const r = window.devicePixelRatio || 1; return [((x - view.x) * view.zoom + pane2.clientWidth / 2) * r, ((z - view.z) * view.zoom + pane2.clientHeight / 2) * r]; };
  const toWorld = (sx, sy) => [(sx - pane2.clientWidth / 2) / view.zoom + view.x, (sy - pane2.clientHeight / 2) / view.zoom + view.z];
  function drawGridLayer() {
    const S = 8, c = gridLayer || (gridLayer = document.createElement('canvas'));
    c.width = W.w * S; c.height = W.h * S; const x = c.getContext('2d');
    for (let z = 0; z < W.h; z++) for (let q = 0; q < W.w; q++) {
      const ch = grid[z][q], t = TILE[ch];
      x.fillStyle = t ? t[2] : '#4a555e';
      if ('SPMUZGKH$&?'.includes(ch) || (ch >= 'a' && ch <= 'w') || 'JRDALVEIQN'.includes(ch)) x.fillStyle = ch >= 'a' && ch <= 'w' ? '#1c2a22' : '#4a555e';
      x.fillRect(q * S, z * S, S, S);
      const f = floors[z * W.w + q]; if (f && f !== '.') { x.globalAlpha = 0.55; x.fillStyle = FLOORCOL[SD.FLOORSTYLE[f]] || '#888'; x.fillRect(q * S, z * S, S, S); x.globalAlpha = 1; }
      const hv = cellH(z * W.w + q); if (hv && !isWallCh(ch)) { x.globalAlpha = Math.min(0.7, 0.15 + Math.abs(hv) * 0.09); x.fillStyle = hv > 0 ? '#ffb040' : '#3a80ff'; x.fillRect(q * S, z * S, S, S); x.globalAlpha = 1; }
    }
    gridDirty = false;
  }
  // the whole map in the plan (once the plan has a size: a minimised window has none)
  let fitPending = false;
  function fitPlan() { if (!fitPending || pane2.clientWidth < 40 || pane2.clientHeight < 40) return; fitPending = false; view.zoom = Math.max(0.5, Math.min(pane2.clientWidth / (W.w * CELL), pane2.clientHeight / (W.h * CELL)) * 0.95); }
  function draw2D() {
    if (!def || layout === '3d') return;
    fitPlan();
    if (gridDirty || !gridLayer) drawGridLayer();
    const r = window.devicePixelRatio || 1, Wc = cv.width, Hc = cv.height, x = cx2;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0b0e11'; x.fillRect(0, 0, Wc, Hc);
    const [ox, oz] = toScreen(-W.ox, -W.oz), sc = view.zoom * r * CELL / 8;
    x.imageSmoothingEnabled = false; x.drawImage(gridLayer, ox, oz, gridLayer.width * sc, gridLayer.height * sc);
    const cellPx = view.zoom * r * CELL;
    // cell lines and symbols when zoomed in
    if (cellPx > 14) {
      x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1; x.beginPath();
      for (let q = 0; q <= W.w; q++) { const [sx] = toScreen(q * CELL - W.ox, 0); x.moveTo(sx, oz); x.lineTo(sx, oz + W.h * cellPx); }
      for (let z = 0; z <= W.h; z++) { const [, sy] = toScreen(0, z * CELL - W.oz); x.moveTo(ox, sy); x.lineTo(ox + W.w * cellPx, sy); }
      x.stroke();
      x.font = `bold ${Math.min(16, cellPx * 0.45) | 0}px Consolas, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
      const [a0, b0] = toWorld(0, 0), [a1, b1] = toWorld(pane2.clientWidth, pane2.clientHeight);
      for (let z = Math.max(0, W.cellZ(b0)); z <= Math.min(W.h - 1, W.cellZ(b1)); z++) for (let q = Math.max(0, W.cellX(a0)); q <= Math.min(W.w - 1, W.cellX(a1)); q++) {
        const ch = grid[z][q]; if ('.#,_~%=x+OT'.includes(ch)) continue;
        const t = TILE[ch], [sx, sy] = toScreen(W.cx2x(q), W.cz2z(z));
        x.fillStyle = t ? t[2] : '#fff'; x.fillText(ch, sx, sy);
      }
    }
    // heights and ramps
    if (cellPx > 18 || tool === 'height' || tool === 'ramp') {
      const [a0, b0] = toWorld(0, 0), [a1, b1] = toWorld(pane2.clientWidth, pane2.clientHeight);
      x.font = `${Math.min(13, cellPx * 0.3) | 0}px Consolas, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let z = Math.max(0, W.cellZ(b0)); z <= Math.min(W.h - 1, W.cellZ(b1)); z++) for (let q = Math.max(0, W.cellX(a0)); q <= Math.min(W.w - 1, W.cellX(a1)); q++) {
        const i = z * W.w + q, [sx, sy] = toScreen(W.cx2x(q), W.cz2z(z));
        if (tdir[i]) { const a = [0, Math.PI / 2, -Math.PI / 2, Math.PI, 0][tdir[i]], L = cellPx * 0.32; x.strokeStyle = '#ffe0a0'; x.lineWidth = 2 * r; x.beginPath(); x.moveTo(sx - Math.sin(a) * L, sy - Math.cos(a) * L); x.lineTo(sx + Math.sin(a) * L, sy + Math.cos(a) * L); x.lineTo(sx + Math.sin(a + 2.6) * L * 0.4 + Math.sin(a) * L, sy + Math.cos(a + 2.6) * L * 0.4 + Math.cos(a) * L); x.stroke(); }
        else if (th[i] && cellPx > 18 && !isWallCh(grid[z][q])) { x.fillStyle = th[i] > 0 ? '#ffd890' : '#a0c8ff'; x.fillText((th[i] > 0 ? '+' : '') + th[i], sx, sy + cellPx * 0.3); }
      }
    }
    if (tool === 'ramp' && rampFrom && rampTo) { const cells = rampCells(rampFrom, rampTo); x.fillStyle = 'rgba(255,224,160,0.25)'; x.strokeStyle = '#ffe0a0'; for (const [q, z] of cells) { const [sx, sy] = toScreen(q * CELL - W.ox, z * CELL - W.oz); x.fillRect(sx, sy, cellPx, cellPx); x.strokeRect(sx, sy, cellPx, cellPx); } }
    // rooms
    if (XH.zones.list) {
      x.lineWidth = tool === 'zone' ? 2 : 1; x.font = `${Math.max(10, Math.min(14, view.zoom * 1.4)) * r | 0}px Segoe UI, sans-serif`; x.textAlign = 'left'; x.textBaseline = 'top';
      zoneRects().forEach((zr, i) => {
        const [sx, sy] = toScreen(zr[1] * CELL - W.ox, zr[2] * CELL - W.oz), [ex, ey] = toScreen((zr[3] + 1) * CELL - W.ox, (zr[4] + 1) * CELL - W.oz);
        const on = isSel('zone', i);
        x.strokeStyle = on ? '#ffb840' : tool === 'zone' ? 'rgba(96,200,255,0.8)' : 'rgba(96,200,255,0.25)'; x.setLineDash(on ? [] : [6 * r, 4 * r]); x.strokeRect(sx, sy, ex - sx, ey - sy); x.setLineDash([]);
        x.fillStyle = on ? '#ffb840' : 'rgba(150,215,255,0.8)'; x.fillText(zr[0], sx + 4 * r, sy + 3 * r);
      });
    }
    // cleared circles
    clear.forEach((c, i) => { const [sx, sy] = toScreen(c[0], c[1]); x.strokeStyle = isSel('clear', i) ? '#ffb840' : 'rgba(255,64,96,0.8)'; x.setLineDash([5 * r, 4 * r]); x.beginPath(); x.arc(sx, sy, c[2] * view.zoom * r, 0, 7); x.stroke(); x.setLineDash([]); });
    // entities
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${11 * r}px Segoe UI, sans-serif`;
    for (const e of [...ents.filter((q) => q.k === '@zone'), ...ents.filter((q) => q.k !== '@zone')]) {
      if (hiddenCat(e)) continue;
      const b = boxOf(e); if (!b) continue;
      const [sx, sy] = toScreen(b.x0, b.z0), [ex, ey] = toScreen(b.x1, b.z1), on = isSel('ent', e), col = entCol(e), zt = e.k === '@zone' || e.k === '@trap';
      x.globalAlpha = SD.FLAT.has(e.k) ? 0.18 : zt ? 0.24 : 0.32; x.fillStyle = col; x.fillRect(sx, sy, ex - sx, ey - sy); x.globalAlpha = 1;
      x.strokeStyle = on ? '#ffb840' : col; x.lineWidth = on ? 2 * r : zt ? 1.5 * r : 1; if (e.k === '@zone') x.setLineDash([6 * r, 3 * r]); x.strokeRect(sx, sy, ex - sx, ey - sy); x.setLineDash([]);
      if (e.k === '@zone') {
        const T = HZ().TYPES[e.zt], o = Object.assign({}, T ? T.o : {}, e.o || {}), [cx0, cy0] = toScreen(e.x, e.z);
        if ('dir' in o) { const a = (o.dir || 0) * Math.PI / 180, L = Math.max(8 * r, Math.min(ex - sx, ey - sy) * 0.32); x.strokeStyle = col; x.lineWidth = 2 * r; x.beginPath(); x.moveTo(cx0 - Math.sin(a) * L, cy0 - Math.cos(a) * L); x.lineTo(cx0 + Math.sin(a) * L, cy0 + Math.cos(a) * L); x.lineTo(cx0 + Math.sin(a) * L - Math.sin(a - 0.5) * L * 0.4, cy0 + Math.cos(a) * L - Math.cos(a - 0.5) * L * 0.4); x.moveTo(cx0 + Math.sin(a) * L, cy0 + Math.cos(a) * L); x.lineTo(cx0 + Math.sin(a) * L - Math.sin(a + 0.5) * L * 0.4, cy0 + Math.cos(a) * L - Math.cos(a + 0.5) * L * 0.4); x.stroke(); }
        if (e.zt === 'teleport') { const [tx, ty] = toScreen(o.tx, o.tz); x.strokeStyle = col; x.lineWidth = 1.5 * r; x.setLineDash([5 * r, 4 * r]); x.beginPath(); x.moveTo(cx0, cy0); x.lineTo(tx, ty); x.stroke(); x.setLineDash([]); x.beginPath(); x.arc(tx, ty, Math.max(5 * r, 0.7 * view.zoom * r), 0, 7); x.stroke(); }
      }
      if (e.lx !== undefined) {
        const [lx, ly] = toScreen(e.lx, e.lz), [cx0, cy0] = toScreen(e.x, e.z), lon = isSel('lever', e), rr = Math.max(5 * r, 0.4 * view.zoom * r);
        x.strokeStyle = col; x.lineWidth = 1.5 * r; x.setLineDash([4 * r, 3 * r]); x.beginPath(); x.moveTo(cx0, cy0); x.lineTo(lx, ly); x.stroke(); x.setLineDash([]);
        x.fillStyle = col; x.beginPath(); x.arc(lx, ly, rr, 0, 7); x.fill(); x.strokeStyle = lon ? '#ffb840' : '#000'; x.lineWidth = (lon ? 3 : 1.5) * r; x.stroke();
        if (view.zoom > 9 || lon) { x.fillStyle = lon ? '#ffd890' : col; x.textBaseline = 'top'; x.fillText(e.k === '@trap' ? 'lever' : 'end', lx, ly + rr + 2 * r); x.textBaseline = 'middle'; }
      }
      if (e.k !== '@block' && !zt) { const [px, py] = toScreen(e.x, e.z), a = e.ry || 0, L = Math.max(6 * r, Math.min(18 * r, view.zoom * r * 0.7)); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(a) * L, py + Math.cos(a) * L); x.stroke(); }
      if ((view.zoom > 14 || (zt && view.zoom > 5)) && ex - sx > 40 * r) { x.fillStyle = on ? '#ffd890' : 'rgba(255,255,255,0.8)'; x.fillText(entName(e), (sx + ex) / 2, (sy + ey) / 2); }
    }
    // wiring: a trigger's lines to the pieces and doors it acts on, and the points it uses
    if (view.zoom > 1.2) for (const e of ents) {
      if (e.k !== '@trigger' || !e.acts || !e.acts.length) continue;
      const on = isSel('ent', e), [tx, ty] = toScreen(e.x, e.z);
      x.lineWidth = (on ? 2.2 : 1.2) * r; x.globalAlpha = on ? 1 : 0.55;
      for (const a2 of e.acts) for (const [key, dash] of [['t', [7 * r, 4 * r]], ['at', [2 * r, 4 * r]]]) {
        const v = a2[key]; if (!v) continue;
        let ends = ents.filter((q) => q.tag === v && q !== e).map((q) => [q.x, q.z]);
        if (!ends.length && W.doors && W.doors[v]) { const c = W.doors[v].cells; ends = [[W.cx2x(c[0] % W.w), W.cz2z((c[0] / W.w) | 0)]]; }
        for (const [qx, qz] of ends) {
          const [ex, ey] = toScreen(qx, qz), ang = Math.atan2(ey - ty, ex - tx), L = 8 * r;
          x.strokeStyle = key === 't' ? '#ffe060' : '#60c0ff'; x.setLineDash(dash); x.beginPath(); x.moveTo(tx, ty); x.lineTo(ex, ey); x.stroke(); x.setLineDash([]);
          x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex - Math.cos(ang - 0.4) * L, ey - Math.sin(ang - 0.4) * L); x.moveTo(ex, ey); x.lineTo(ex - Math.cos(ang + 0.4) * L, ey - Math.sin(ang + 0.4) * L); x.stroke();
        }
      }
      x.globalAlpha = 1;
    }
    // markers: a flag
    for (const e of ents) if (e.k === '@marker') { const [mx, my] = toScreen(e.x, e.z), c = entCol(e), rr = Math.max(4 * r, 0.35 * view.zoom * r); x.fillStyle = c; x.beginPath(); x.moveTo(mx, my - rr * 2.2); x.lineTo(mx + rr * 1.6, my - rr * 1.6); x.lineTo(mx, my - rr); x.closePath(); x.fill(); x.strokeStyle = isSel('ent', e) ? '#ffb840' : c; x.lineWidth = 2 * r; x.beginPath(); x.moveTo(mx, my); x.lineTo(mx, my - rr * 2.2); x.stroke(); }
    // generated pieces
    x.font = `${Math.max(10, 11 * r) | 0}px Segoe UI, sans-serif`;
    for (const pc of pieces) {
      const [ox, oz] = pieceDrag[pc.key] || [0, 0], px = pc.x + ox, pz = pc.z + oz, on = isSel('piece', pc.key);
      x.strokeStyle = on ? '#ffb840' : '#ff70d0'; x.lineWidth = (on ? 2.5 : 1.5) * r; x.fillStyle = 'rgba(255,112,208,0.14)';
      if (pc.shape === 'rect' || pc.shape === 'door') { const [sx, sy] = toScreen(px - pc.w / 2, pz - pc.d / 2), [ex, ey] = toScreen(px + pc.w / 2, pz + pc.d / 2); x.fillRect(sx, sy, ex - sx, ey - sy); x.setLineDash([5 * r, 3 * r]); x.strokeRect(sx, sy, ex - sx, ey - sy); x.setLineDash([]); }
      else {
        const [sx, sy] = toScreen(px, pz), rr = Math.max(5 * r, (pc.r || 0.5) * view.zoom * r);
        x.beginPath(); if (pc.shape === 'eye') { x.moveTo(sx, sy - rr); x.lineTo(sx + rr, sy); x.lineTo(sx, sy + rr); x.lineTo(sx - rr, sy); x.closePath(); } else x.arc(sx, sy, rr, 0, 7); x.fill(); x.stroke();
        if (pc.dx || pc.dz) { x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + pc.dx * rr * 1.6, sy + pc.dz * rr * 1.6); x.stroke(); }
      }
      if (view.zoom > 7 || on) { const [sx, sy] = toScreen(px, pz + (pc.d || (pc.r || 0.5) * 2) / 2); x.textAlign = 'center'; x.textBaseline = 'top'; x.fillStyle = on ? '#ffd890' : '#ffb0e8'; x.fillText(pc.label.split(' (')[0], sx, sy + 2 * r); }
    }
    for (const q of sel) if (q.t === 'tile') { const cx = q.i % W.w, cz = (q.i / W.w) | 0, [sx, sy] = toScreen(cx * CELL - W.ox, cz * CELL - W.oz); x.strokeStyle = '#ffb840'; x.lineWidth = 2.5 * r; x.strokeRect(sx, sy, cellPx, cellPx); if (tileDrag) { const [tx, ty] = toScreen(tileDrag[0] * CELL - W.ox, tileDrag[1] * CELL - W.oz); x.setLineDash([4 * r, 3 * r]); x.strokeRect(tx, ty, cellPx, cellPx); x.setLineDash([]); } }
    // lights
    lights.forEach((l, i) => {
      const [sx, sy] = toScreen(W.cx2x(l[0]), W.cz2z(l[1])), on = isSel('light', i);
      if (on || tool === 'light') { x.strokeStyle = hex(l[2]) + (on ? 'cc' : '44'); x.lineWidth = 1; x.beginPath(); x.arc(sx, sy, l[4] * view.zoom * r, 0, 7); x.stroke(); }
      x.fillStyle = hex(l[2]); x.beginPath(); x.arc(sx, sy, 6 * r, 0, 7); x.fill();
      x.strokeStyle = on ? '#ffb840' : '#000'; x.lineWidth = on ? 3 * r : 1.5 * r; x.stroke();
    });
    // the 3D camera
    { const [sx, sy] = toScreen(P.cam.position.x, P.cam.position.z), d = new THREE.Vector3(); P.cam.getWorldDirection(d); const a = Math.atan2(d.x, d.z);
      x.fillStyle = 'rgba(255,184,64,0.9)'; x.beginPath(); x.moveTo(sx + Math.sin(a) * 16 * r, sy + Math.cos(a) * 16 * r); x.lineTo(sx + Math.sin(a + 2.5) * 8 * r, sy + Math.cos(a + 2.5) * 8 * r); x.lineTo(sx + Math.sin(a - 2.5) * 8 * r, sy + Math.cos(a - 2.5) * 8 * r); x.fill(); }
    // brush and marquee
    if (hover && (tool === 'tiles' || tool === 'floor' || tool === 'height' || tool === 'ramp')) { const n = brush, c0x = W.cellX(hover[0]) - ((n - 1) >> 1), c0z = W.cellZ(hover[1]) - ((n - 1) >> 1), [sx, sy] = toScreen(c0x * CELL - W.ox, c0z * CELL - W.oz); x.strokeStyle = '#ffb840'; x.lineWidth = 2; x.strokeRect(sx, sy, n * cellPx, n * cellPx); }
    if (hover && tool === 'clear') { const [sx, sy] = toScreen(hover[0], hover[1]); x.strokeStyle = '#ff4060'; x.beginPath(); x.arc(sx, sy, clearR * view.zoom * r, 0, 7); x.stroke(); }
    if (marquee) { const [sx, sy] = toScreen(marquee.x0, marquee.z0), [ex, ey] = toScreen(marquee.x1, marquee.z1); x.strokeStyle = '#ffb840'; x.setLineDash([4, 3]); x.strokeRect(sx, sy, ex - sx, ey - sy); x.setLineDash([]); x.fillStyle = 'rgba(255,184,64,0.08)'; x.fillRect(sx, sy, ex - sx, ey - sy); }
    if (tileSel && (tool === 'tiles' || tool === 'floor')) { const [sx, sy] = toScreen(Math.min(tileSel.x0, tileSel.x1) * CELL - W.ox, Math.min(tileSel.z0, tileSel.z1) * CELL - W.oz); x.strokeStyle = '#60e0ff'; x.lineWidth = 2 * r; x.setLineDash([6 * r, 3 * r]); x.strokeRect(sx, sy, (Math.abs(tileSel.x1 - tileSel.x0) + 1) * cellPx, (Math.abs(tileSel.z1 - tileSel.z0) + 1) * cellPx); x.setLineDash([]); }
    if (tileClip && hover && (tool === 'tiles' || tool === 'floor')) { const [sx, sy] = toScreen(W.cellX(hover[0]) * CELL - W.ox, W.cellZ(hover[1]) * CELL - W.oz); x.globalAlpha = 0.35; for (let z = 0; z < tileClip.h; z++) for (let q = 0; q < tileClip.w; q++) { const t = TILE[tileClip.rows[z][q]]; x.fillStyle = t ? t[2] : '#4a555e'; x.fillRect(sx + q * cellPx, sy + z * cellPx, cellPx, cellPx); } x.globalAlpha = 1; x.strokeStyle = '#60e0ff'; x.strokeRect(sx, sy, tileClip.w * cellPx, tileClip.h * cellPx); }
    if (zoneBox) { const [sx, sy] = toScreen(Math.min(zoneBox.x0, zoneBox.x1), Math.min(zoneBox.z0, zoneBox.z1)), [ex, ey] = toScreen(Math.max(zoneBox.x0, zoneBox.x1), Math.max(zoneBox.z0, zoneBox.z1)), T = HZ().TYPES[asset && asset.zt]; x.strokeStyle = T ? hex(T.color) : '#ffb840'; x.lineWidth = 2 * r; x.setLineDash([6 * r, 3 * r]); x.strokeRect(sx, sy, ex - sx, ey - sy); x.setLineDash([]); x.globalAlpha = 0.15; x.fillStyle = x.strokeStyle; x.fillRect(sx, sy, ex - sx, ey - sy); x.globalAlpha = 1; }
    if (zoneDraft) { const [sx, sy] = toScreen(zoneDraft[1] * CELL - W.ox, zoneDraft[2] * CELL - W.oz), [ex, ey] = toScreen((zoneDraft[3] + 1) * CELL - W.ox, (zoneDraft[4] + 1) * CELL - W.oz); x.strokeStyle = '#ffb840'; x.strokeRect(sx, sy, ex - sx, ey - sy); }
  }
  const zoneRects = () => zones || XH.zones.list.map((q) => [q.name, q.x0, q.z0, q.x1, q.z1]);

  // ---------------- picking ----------------
  function pickEnt(x, z) {
    let best = null, ba = Infinity;
    for (const e of ents) { const b = boxOf(e); if (!b || x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue; const a = (b.x1 - b.x0) * (b.z1 - b.z0) * (SD.FLAT.has(e.k) ? 4 : 1); if (a < ba) { ba = a; best = e; } }
    return best;
  }
  // the smallest generated piece under a point
  function pickPiece(x, z) {
    let best = null, ba = Infinity;
    for (const pc of pieces) {
      let a;
      if (pc.shape === 'rect') { if (Math.abs(x - pc.x) > pc.w / 2 || Math.abs(z - pc.z) > pc.d / 2) continue; a = pc.w * pc.d; }
      else { const rr = Math.max(0.6, pc.r || 0.5); if (Math.hypot(x - pc.x, z - pc.z) > rr) continue; a = rr * rr * 3; }
      if (a < ba) { ba = a; best = pc; }
    }
    return best ? { pc: best, area: ba } : null;
  }
  // a tile that is a thing (a perk, a vent, the box, a wall gun, a door...)
  function pickTile(x, z) { const cx = W.cellX(x), cz = W.cellZ(z); if (!W.inside(cx, cz)) return -1; const ch = grid[cz][cx]; return OBJ.includes(ch) || (ch >= 'a' && ch <= 'w') ? cz * W.w + cx : -1; }
  function pickLight(x, z, rad) { let best = -1, bd = rad; lights.forEach((l, i) => { const d = Math.hypot(W.cx2x(l[0]) - x, W.cz2z(l[1]) - z); if (d < bd) { bd = d; best = i; } }); return best; }
  function pickClear(x, z) { let best = -1, bd = Infinity; clear.forEach((c, i) => { const d = Math.abs(Math.hypot(c[0] - x, c[1] - z) - c[2]); const inside = Math.hypot(c[0] - x, c[1] - z) < c[2]; if (inside && d < bd) { bd = d; best = i; } }); return best; }
  // everything under a point, the likeliest first: lights and levers, then small before big (floor decals and zones last)
  const entArea = (e) => { const b = boxOf(e); return b ? (b.x1 - b.x0) * (b.z1 - b.z0) * (SD.FLAT.has(e.k) ? 20 : e.k === '@zone' ? 8 : 1) : Infinity; };
  function pickAll(ev) {
    const x = ev.x, z = ev.z; let out = [];
    if (ev.view === '3d') out = (ev.cands || []).slice();
    else {
      const rad = 10 / view.zoom;
      lights.forEach((l, i) => { if (Math.hypot(W.cx2x(l[0]) - x, W.cz2z(l[1]) - z) < rad) out.push({ t: 'light', i, a: -1 }); });
      for (const e of ents) if (e.lx !== undefined && Math.hypot(e.lx - x, e.lz - z) < Math.max(0.5, rad)) out.push({ t: 'lever', e, a: 0 });
      for (const pc of pieces) {
        let a;
        if (pc.shape === 'rect' || pc.shape === 'door') { if (Math.abs(x - pc.x) > pc.w / 2 || Math.abs(z - pc.z) > pc.d / 2) continue; a = pc.w * pc.d; }
        else { const rr = Math.max(0.6, pc.r || 0.5); if (Math.hypot(x - pc.x, z - pc.z) > rr) continue; a = rr * rr * 3; }
        out.push({ t: 'piece', i: pc.key, a });
      }
      for (const e of ents) { if (hiddenCat(e) || lockCat.has(sceneCat(e))) continue; const b = boxOf(e); if (!b || x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue; out.push({ t: 'ent', e, a: entArea(e) }); }
      out.sort((p, q) => p.a - q.a);
    }
    const ti = pickTile(x, z); if (ti >= 0) out.push({ t: 'tile', i: ti });
    if (ev.view === '2d') { const ci = pickClear(x, z); if (ci >= 0) out.push({ t: 'clear', i: ci }); }
    return out.map((c) => (c.t === 'ent' || c.t === 'lever' ? { t: c.t, e: c.e } : { t: c.t, i: c.i }));
  }
  function describe(c) {
    if (c.t === 'ent') return (c.e.k === '@zone' ? 'Zone: ' : c.e.k === '@trap' ? 'Trap: ' : '') + entName(c.e);
    if (c.t === 'lever') return (c.e.k === '@trap' ? 'Lever of ' : 'Far end of ') + entName(c.e);
    if (c.t === 'piece') { const pc = pieces.find((q) => q.key === c.i); return pc ? pc.label : c.i; }
    if (c.t === 'tile') { const ch = grid[(c.i / W.w) | 0][c.i % W.w]; return TILE[ch] ? TILE[ch][1] : ch; }
    return c.t === 'light' ? 'Light' : c.t === 'clear' ? 'Cleared area' : c.t;
  }
  function dragItem(s) {
    const pc = s.t === 'piece' && pieces.find((q) => q.key === s.i);
    const [x, z] = s.t === 'ent' ? [s.e.x, s.e.z] : s.t === 'lever' ? [s.e.lx, s.e.lz] : s.t === 'light' ? [W.cx2x(lights[s.i][0]), W.cz2z(lights[s.i][1])] : s.t === 'clear' ? [clear[s.i][0], clear[s.i][1]] : pc ? [pc.x, pc.z] : s.t === 'tile' ? [W.cx2x(s.i % W.w), W.cz2z((s.i / W.w) | 0)] : [0, 0];
    return { s, x, z, lx: s.t === 'ent' ? s.e.lx : undefined, lz: s.t === 'ent' ? s.e.lz : undefined };
  }
  function pickZone(cx, cz) { const zr = zoneRects(); let best = -1, ba = Infinity; zr.forEach((q, i) => { if (cx >= q[1] && cx <= q[3] && cz >= q[2] && cz <= q[4]) { const a = (q[3] - q[1] + 1) * (q[4] - q[2] + 1); if (a < ba) { ba = a; best = i; } } }); return best; }

  // ---------------- tools: shared pointer logic for both views ----------------
  // ev: { x, z (ground point), shift, alt, ctrl, button, view: '2d'|'3d', hitEnt, hitLight }
  let paintStroke = null, zoneDraft = null, zoneDrag = null;
  function down(ev) {
    if (!def) return;
    if (pickTag) { takePick(ev); return; }
    if (pickTarget) { const e = pickTarget; pickTarget = null; commit(); e.o = Object.assign({}, e.o || {}, { tx: r3(ev.x), tz: r3(ev.z) }); spawnEnt(e); markDirty('dress'); showProps(); gizmos(); msg('The teleporter sends you here now'); return; }
    if (tool === 'select') {
      const cands = pickAll(ev);
      // something already selected under the cursor keeps the selection (so it can be dragged); a click that does not
      // move picks the next thing stacked there (see up())
      const already = !ev.shift && !ev.ctrl ? cands.find((c) => isSel(c.t, selV(c))) : null, hit = already || cands[0] || null;
      if (hit) {
        if (ev.shift || ev.ctrl) { select([hit], true); return; }
        if (!already) { select([hit]); msg(describe(hit) + (cands.length > 1 ? ' · 1 of ' + cands.length + ' here: click again for the next' : '')); }
        drag = { x: ev.x, z: ev.z, moved: false, cands, was: already, items: sel.map(dragItem) };
      } else if (ev.view === '2d') { marquee = { x0: ev.x, z0: ev.z, x1: ev.x, z1: ev.z, add: ev.shift || ev.ctrl }; }
      else select([], ev.shift);
    } else if (tool === 'place') {
      if (!asset) { msg('Pick something to place on the right', true); tab('assets'); return; }
      if (asset.t === 'zone' || (asset.t === 'trigger' && (LOGIC().WHEN[asset.when] || {}).area)) { zoneBox = { x0: ev.x, z0: ev.z, x1: ev.x, z1: ev.z, alt: ev.alt }; return; }
      placeAsset(ev);
    } else if ((tool === 'tiles' || tool === 'floor') && ev.ctrl) {
      const cx = W.cellX(ev.x), cz = W.cellZ(ev.z); tileSel = { x0: cx, z0: cz, x1: cx, z1: cz, drag: true };
    } else if (tool === 'tiles' || tool === 'floor') {
      commit(); paintStroke = { erase: ev.button === 2, rect: ev.shift ? [W.cellX(ev.x), W.cellZ(ev.z)] : null };
      if (!paintStroke.rect) paintTo(ev.x, ev.z);
    } else if (tool === 'height') {
      const cx = W.cellX(ev.x), cz = W.cellZ(ev.z);
      if (ev.ctrl) { if (W.inside(cx, cz)) { hSet = r3(cellH(cz * W.w + cx)); renderAssets(); msg('Height picked up: ' + hSet + ' m'); } return; }
      commit(); hStroke = { mode: ev.shift ? 'set' : ev.button === 2 ? 'lower' : 'raise', done: new Set() };
      heightAt(ev.x, ev.z);
    } else if (tool === 'ramp') {
      rampFrom = [W.cellX(ev.x), W.cellZ(ev.z)]; rampTo = rampFrom.slice();
    } else if (tool === 'light') {
      const li = ev.hitLight !== undefined && ev.hitLight >= 0 ? ev.hitLight : pickLight(ev.x, ev.z, ev.view === '2d' ? 10 / view.zoom : 1);
      if (li >= 0) { select([{ t: 'light', i: li }]); drag = { x: ev.x, z: ev.z, moved: false, items: [{ s: sel[0], x: W.cx2x(lights[li][0]), z: W.cz2z(lights[li][1]) }] }; return; }
      commit();
      const last = lights[lights.length - 1] || [0, 0, 0xffe0b0, 1.3, 26];
      lights.push([r3(W.cellX(ev.x) + ((ev.x + W.ox) / CELL % 1) - 0.5), r3(W.cellZ(ev.z) + ((ev.z + W.oz) / CELL % 1) - 0.5), last[2], last[3], last[4]]);
      lights[lights.length - 1][0] = r3((snapV(ev.x, ev.alt) + W.ox) / CELL - 0.5); lights[lights.length - 1][1] = r3((snapV(ev.z, ev.alt) + W.oz) / CELL - 0.5);
      markDirty('lights'); select([{ t: 'light', i: lights.length - 1 }]); rebuild(); msg('Light added');
    } else if (tool === 'clear') {
      const ci = pickClear(ev.x, ev.z);
      commit();
      if (ev.button === 2 || ev.alt) { if (ci >= 0) { clear.splice(ci, 1); msg('Removed a cleared area'); } }
      else clear.push([r3(ev.x), r3(ev.z), clearR]);
      markDirty(); gizmos(); rebuildSoon();
    } else if (tool === 'zone') {
      const cx = W.cellX(ev.x), cz = W.cellZ(ev.z);
      const zi = pickZone(cx, cz);
      if (zi >= 0 && !ev.ctrl) {
        select([{ t: 'zone', i: zi }]);
        const q = zoneRects()[zi]; const edge = (a, b) => Math.abs(a - b) < 0.6;
        const fx = (ev.x + W.ox) / CELL, fz = (ev.z + W.oz) / CELL;
        zoneDrag = { i: zi, start: [fx, fz], orig: q.slice(), mode: edge(fx, q[1]) ? 'x0' : edge(fx, q[3] + 1) ? 'x1' : edge(fz, q[2]) ? 'z0' : edge(fz, q[4] + 1) ? 'z1' : 'move' };
      } else zoneDraft = ['Room ' + (zoneRects().length + 1), cx, cz, cx, cz];
    }
  }
  function move(ev) {
    hover = [ev.x, ev.z];
    if (drag) {
      let dx = ev.x - drag.x, dz = ev.z - drag.z;
      if (!drag.moved && Math.hypot(dx, dz) < 0.15) return;
      if (!drag.moved) { drag.moved = true; commit(); }
      for (const it of drag.items) {
        const nx = snapV(it.x + dx, ev.alt), nz = snapV(it.z + dz, ev.alt);
        if (it.s.t === 'ent') { it.s.e.x = nx; it.s.e.z = nz; if (it.lx !== undefined) { it.s.e.lx = r3(it.lx + nx - it.x); it.s.e.lz = r3(it.lz + nz - it.z); } moveLive(it.s.e); }
        else if (it.s.t === 'lever') { if (!drag.items.some((q) => q.s.t === 'ent' && q.s.e === it.s.e)) { it.s.e.lx = nx; it.s.e.lz = nz; } }
        else if (it.s.t === 'light') { const l = lights[it.s.i]; l[0] = r3((nx + W.ox) / CELL - 0.5); l[1] = r3((nz + W.oz) / CELL - 0.5); lightLive(it.s.i); }
        else if (it.s.t === 'clear') { clear[it.s.i][0] = nx; clear[it.s.i][1] = nz; }
        else if (it.s.t === 'piece') { const pc = pieces.find((q) => q.key === it.s.i); if (pc) pieceDrag[pc.key] = pc.shape === 'rect' ? [Math.round(dx / CELL) * CELL, Math.round(dz / CELL) * CELL] : [nx - pc.x, nz - pc.z]; }
        else if (it.s.t === 'tile') tileDrag = [W.cellX(it.x + dx), W.cellZ(it.z + dz)];
      }
      gizmos(); return;
    }
    if (marquee) { marquee.x1 = ev.x; marquee.z1 = ev.z; return; }
    if (zoneBox) { zoneBox.x1 = ev.x; zoneBox.z1 = ev.z; zoneBox.alt = ev.alt; return; }
    if (tileSel && tileSel.drag) { tileSel.x1 = W.cellX(ev.x); tileSel.z1 = W.cellZ(ev.z); return; }
    if (paintStroke && !paintStroke.rect) paintTo(ev.x, ev.z);
    if (hStroke) heightTo(ev.x, ev.z);
    if (rampFrom) rampTo = [W.cellX(ev.x), W.cellZ(ev.z)];
    if (zoneDraft) { zoneDraft[3] = W.cellX(ev.x); zoneDraft[4] = W.cellZ(ev.z); }
    if (zoneDrag) {
      const fx = (ev.x + W.ox) / CELL, fz = (ev.z + W.oz) / CELL, ddx = Math.round(fx - zoneDrag.start[0]), ddz = Math.round(fz - zoneDrag.start[1]), o = zoneDrag.orig;
      if (!zones) zones = clone(zoneRects());
      const q = zones[zoneDrag.i], m = zoneDrag.mode;
      if (m === 'move') { q[1] = o[1] + ddx; q[3] = o[3] + ddx; q[2] = o[2] + ddz; q[4] = o[4] + ddz; }
      else if (m === 'x0') q[1] = Math.min(o[3], o[1] + ddx); else if (m === 'x1') q[3] = Math.max(o[1], o[3] + ddx);
      else if (m === 'z0') q[2] = Math.min(o[4], o[2] + ddz); else if (m === 'z1') q[4] = Math.max(o[2], o[4] + ddz);
      zoneDrag.changed = true;
    }
  }
  function up(ev) {
    if (drag) {
      if (drag.moved) {
        let world = false;
        for (const it of drag.items) {
          if (it.s.t === 'ent') { spawnEnt(it.s.e); markDirty('dress'); if (it.s.e.k === '@block') world = true; } // its pathing cells are relative to its own cell, so they move with it
          if (it.s.t === 'lever') { spawnEnt(it.s.e); markDirty('dress'); }
          if (it.s.t === 'light') markDirty('lights');
          if (it.s.t === 'clear') { markDirty(); world = true; }
          if (it.s.t === 'piece') { const pc = pieces.find((q) => q.key === it.s.i), off = pc && pieceDrag[pc.key]; if (pc && off) { const pin = pinFor(pc, pc.x + off[0], pc.z + off[1]); if (pin) { place[pc.key] = pin; markDirty('place'); world = true; } else msg(pc.shape === 'door' ? 'A door trap goes on a door: drop it on one' : 'Nowhere to put that there: wall pieces need a wall', true); } }
          if (it.s.t === 'tile' && tileDrag) { if (moveTile(it.s.i, tileDrag[0], tileDrag[1])) { const ni = tileDrag[1] * W.w + tileDrag[0]; it.s.i = ni; world = true; } }
        }
        tileDrag = null;
        if (world) { rebuild(); }
        gizmos(); showProps();
      } else if (!ev.shift && !ev.ctrl && drag.was) {
        // a click on something already selected: out of several, just that one; on its own, the next thing stacked under it
        if (sel.length > 1) select([drag.was]);
        else if (drag.cands.length > 1) { const n = drag.cands.length, i = drag.cands.findIndex((c) => c.t === drag.was.t && selV(c) === selV(drag.was)), nx = drag.cands[(i + 1) % n]; select([nx]); msg(describe(nx) + ' · ' + ((i + 1) % n + 1) + ' of ' + n + ' here'); }
      }
      drag = null;
    }
    if (zoneBox) { const b = zoneBox; zoneBox = null; if (asset && asset.t === 'trigger') placeTrigger(b); else placeZone(b); }
    if (marquee) {
      const x0 = Math.min(marquee.x0, marquee.x1), x1 = Math.max(marquee.x0, marquee.x1), z0 = Math.min(marquee.z0, marquee.z1), z1 = Math.max(marquee.z0, marquee.z1);
      if (x1 - x0 < 0.2 && z1 - z0 < 0.2) select([], marquee.add);
      else {
        const list = ents.filter((e) => e.x >= x0 && e.x <= x1 && e.z >= z0 && e.z <= z1).map((e) => ({ t: 'ent', e }));
        lights.forEach((l, i) => { const lx = W.cx2x(l[0]), lz = W.cz2z(l[1]); if (lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1) list.push({ t: 'light', i }); });
        select(list, marquee.add); msg(sel.length + ' selected');
      }
      marquee = null;
    }
    if (tileSel && tileSel.drag) { tileSel.drag = false; const w = Math.abs(tileSel.x1 - tileSel.x0) + 1, h = Math.abs(tileSel.z1 - tileSel.z0) + 1; msg(w + ' × ' + h + ' cells picked · Ctrl+C copies, Delete clears to floor, Esc lets go'); }
    if (paintStroke) {
      if (paintStroke.rect) { const [ax, az] = paintStroke.rect, bx = W.cellX(ev.x), bz = W.cellZ(ev.z); for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) for (let q = Math.min(ax, bx); q <= Math.max(ax, bx); q++) paintCell(q, z, paintStroke.erase); }
      paintStroke = null; gridDirty = true; rebuild(); msg(tool === 'tiles' ? 'Tiles painted' : 'Floor painted');
    }
    if (hStroke) { hStroke = null; markDirty('terrain'); gridDirty = true; rebuild(); msg('Ground shaped'); }
    if (rampFrom) { const a = rampFrom, b = rampTo || rampFrom; rampFrom = null; rampTo = null; makeRamp(a, b); }
    if (zoneDraft) {
      const q = [zoneDraft[0], Math.min(zoneDraft[1], zoneDraft[3]), Math.min(zoneDraft[2], zoneDraft[4]), Math.max(zoneDraft[1], zoneDraft[3]), Math.max(zoneDraft[2], zoneDraft[4])];
      zoneDraft = null;
      if (q[3] - q[1] >= 1 && q[4] - q[2] >= 1) { commit(); if (!zones) zones = clone(zoneRects()); zones.push(q); markDirty('zones'); select([{ t: 'zone', i: zones.length - 1 }]); rebuildSoon(); msg('Room added: name it in Properties'); }
    }
    if (zoneDrag) { if (zoneDrag.changed) { undo.push(JSON.stringify(Object.assign(JSON.parse(snapshot()), { zones: (() => { const z = clone(zones); z[zoneDrag.i] = zoneDrag.orig; return z; })() }))); markDirty('zones'); rebuildSoon(); showProps(); } zoneDrag = null; }
  }
  function paintCell(q, z, erase) {
    if (!W.inside(q, z)) return;
    if (tool === 'tiles') {
      const ch = erase ? '.' : tileCh;
      // the outer ring stays wall so nothing walks off the map
      if ((q === 0 || z === 0 || q === W.w - 1 || z === W.h - 1) && ch !== '#' && !(ch >= 'a' && ch <= 'w')) return;
      if (grid[z][q] !== ch) { grid[z][q] = ch; markDirty('grid'); }
    } else {
      const f = erase ? '.' : SD.FLOORCODE[floorStyle];
      if (floors[z * W.w + q] !== f) { floors[z * W.w + q] = f; markDirty('dress'); }
    }
  }
  // a fast drag leaves gaps between mouse positions: paint along the line from the last one
  function paintTo(x, z) {
    const l = paintStroke.last || [x, z], d = Math.hypot(x - l[0], z - l[1]), n = Math.max(1, Math.ceil(d / (CELL * 0.4)));
    for (let i = 1; i <= n; i++) paintAt(l[0] + (x - l[0]) * i / n, l[1] + (z - l[1]) * i / n);
    paintStroke.last = [x, z];
  }
  function paintAt(x, z) { const n = brush, c0x = W.cellX(x) - ((n - 1) >> 1), c0z = W.cellZ(z) - ((n - 1) >> 1); for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) paintCell(c0x + dx, c0z + dz, paintStroke.erase); gridDirty = true; }
  // ---------------- shaping the ground ----------------
  function heightCell(cx, cz) {
    if (!W.inside(cx, cz)) return; const i = cz * W.w + cx; if (hStroke.done.has(i) || isWallCh(grid[cz][cx])) return; hStroke.done.add(i);
    const h0 = cellH(i), h = hStroke.mode === 'set' ? hSet : hStroke.mode === 'lower' ? h0 - hStep : h0 + hStep;
    th[i] = Math.max(-3.75, Math.min(11.75, Math.round(h / 0.25) * 0.25)); tdir[i] = 0; trise[i] = 0;
  }
  function heightAt(x, z) { const n = brush, c0x = W.cellX(x) - ((n - 1) >> 1), c0z = W.cellZ(z) - ((n - 1) >> 1); for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) heightCell(c0x + dx, c0z + dz); gridDirty = true; hStroke.last = [x, z]; }
  function heightTo(x, z) { const l = hStroke.last || [x, z], n = Math.max(1, Math.ceil(Math.hypot(x - l[0], z - l[1]) / (CELL * 0.4))); for (let k = 1; k <= n; k++) heightAt(l[0] + (x - l[0]) * k / n, l[1] + (z - l[1]) * k / n); }
  // the cells a ramp from a to b covers: the ones strictly between them, brush cells wide
  function rampCells(a, b) {
    const ax = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]), n = ax ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1]), s = Math.sign(ax ? b[0] - a[0] : b[1] - a[1]) || 1, out = [];
    for (let k = 1; k < n; k++) for (let w = -((brush - 1) >> 1); w <= (brush >> 1); w++) out.push(ax ? [a[0] + s * k, a[1] + w, k] : [a[0] + w, a[1] + s * k, k]);
    return out;
  }
  function makeRamp(a, b) {
    if (!W.inside(a[0], a[1]) || !W.inside(b[0], b[1])) return;
    const ax = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]), n = ax ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1]);
    if (n < 2) { msg('Drag from one level across to another, with room between them for the slope', true); return; }
    const s = Math.sign(ax ? b[0] - a[0] : b[1] - a[1]), sx = ax ? s : 0, sz = ax ? 0 : s;
    const bb = ax ? [b[0], a[1]] : [a[0], b[1]], ia = a[1] * W.w + a[0], ib = bb[1] * W.w + bb[0];
    const hA = tEdge(ia, sx, sz), hB = tEdge(ib, -sx, -sz), per = (hB - hA) / (n - 1);
    commit();
    const up = ax ? (s > 0 ? 1 : 2) : (s > 0 ? 3 : 4), down = ax ? (s > 0 ? 2 : 1) : (s > 0 ? 4 : 3);
    let made = 0;
    for (const [cx, cz, k] of rampCells(a, b)) {
      if (!W.inside(cx, cz) || isWallCh(grid[cz][cx])) continue;
      const i = cz * W.w + cx, lo = hA + per * (k - 1), hi = lo + per;
      if (Math.abs(per) < 0.01) { th[i] = r3(lo); tdir[i] = 0; trise[i] = 0; }
      else if (per > 0) { th[i] = r3(lo); tdir[i] = up; trise[i] = r3(per); } else { th[i] = r3(hi); tdir[i] = down; trise[i] = r3(-per); }
      made++;
    }
    markDirty('terrain'); gridDirty = true; rebuild();
    const steep = Math.abs(per) > 1.5;
    msg(made ? 'Ramp from ' + r3(hA) + ' m to ' + r3(hB) + ' m' + (steep ? ' · too steep to walk up: make it longer' : '') : 'No room for a ramp there', steep || !made);
  }
  // where a generated piece goes when it is dropped at (nx, nz)
  function pinFor(pc, nx, nz) {
    if (pc.shape === 'door') { let best = null, bd = 3 * CELL; for (const id in W.doors) for (const ci of W.doors[id].cells) { const d = Math.hypot(W.cx2x(ci % W.w) - nx, W.cz2z((ci / W.w) | 0) - nz); if (d < bd) { bd = d; best = id; } } return best === null ? null : { door: best }; }
    if (pc.shape === 'rect' && pc.cells) {
      const c = pc.cells, x = c.x + Math.round((nx - pc.x) / CELL), z = c.z + Math.round((nz - pc.z) / CELL);
      if (pc.key === 'building') return { x, z, n: c.w };
      if (pc.key === 'platform') return { x, z, dx: pc.dx, dz: pc.dz };
      return { x, z, w: c.w, h: c.h };
    }
    if (pc.shape === 'wall' || pc.shape === 'eye') {
      const f = wallFace(nx, nz, 3); if (!f) return null;
      const dx = Math.round(Math.sin(f.ry)), dz = Math.round(Math.cos(f.ry));
      if (pc.shape === 'eye') return { x: r3(f.x + dx * 0.06), y: pc.y, z: r3(f.z + dz * 0.06), nx: dx, nz: dz };
      const k = pc.key === 'ammo' ? 0.7 : 1.23; return { x: r3(f.x + dx * k), z: r3(f.z + dz * k), dx, dz };
    }
    const o = { x: r3(nx), z: r3(nz) }; if (pc.turn) { o.dx = pc.dx || 0; o.dz = pc.dz || 0; } return o;
  }
  // turn the selected pieces a quarter turn (the bench, a turret nest, the map perk, the platform's stairs)
  function turnPieces(dir) {
    const list = sel.filter((q) => q.t === 'piece').map((q) => pieces.find((pc) => pc.key === q.i)).filter((pc) => pc && pc.turn);
    if (!list.length) return false;
    commit();
    for (const pc of list) { const pin = pinFor(pc, pc.x, pc.z); const [dx, dz] = dir > 0 ? [-(pc.dz || 0), pc.dx || 0] : [pc.dz || 0, -(pc.dx || 0)]; pin.dx = dx; pin.dz = dz || (dx ? 0 : 1); place[pc.key] = pin; }
    markDirty('place'); rebuild(); msg('Turned'); return true;
  }
  function moveTile(i, cx, cz) {
    const ox = i % W.w, oz = (i / W.w) | 0, ch = grid[oz][ox]; if (!W.inside(cx, cz) || (cx === ox && cz === oz)) return false;
    if (ch >= '0' && ch <= '9') { msg('Doors stay in their doorway: paint a new one with the Tiles tool', true); return false; }
    const wallObj = ch >= 'a' && ch <= 'w', target = grid[cz][cx];
    if (wallObj ? target !== '#' : target !== '.') { msg(wallObj ? 'A wall gun goes on a plain wall cell' : 'Put it on plain floor', true); return false; }
    commit(); grid[cz][cx] = ch; grid[oz][ox] = wallObj ? '#' : '.'; markDirty('grid'); msg('Moved ' + (TILE[ch] ? TILE[ch][1] : ch)); return true;
  }
  // the half-cell grid (cell edges and middles), so zones and traps line up with the map's cells
  const snapCell = (v, o, alt) => (alt ? snapV(v, false) : r3(Math.round((v + o) / (CELL / 2)) * (CELL / 2) - o));
  const ZSIZE = { jumppad: 2.5, teleport: 2.5, heal: 3.75, speed: 2.5, crusher: 3.75 };
  // a trigger's area, dragged out like a zone (or a click for 5 x 5)
  function placeTrigger(b) {
    let x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), z0 = Math.min(b.z0, b.z1), z1 = Math.max(b.z0, b.z1);
    if (x1 - x0 < 0.6 && z1 - z0 < 0.6) { x0 = b.x0 - 2.5; x1 = b.x0 + 2.5; z0 = b.z0 - 2.5; z1 = b.z0 + 2.5; }
    x0 = snapCell(x0, W.ox, b.alt); x1 = snapCell(x1, W.ox, b.alt); z0 = snapCell(z0, W.oz, b.alt); z1 = snapCell(z1, W.oz, b.alt);
    if (x1 - x0 < 0.5) x1 = x0 + CELL / 2; if (z1 - z0 < 0.5) z1 = z0 + CELL / 2;
    commit();
    addEnts([{ k: '@trigger', x: r3((x0 + x1) / 2), z: r3((z0 + z1) / 2), w: r3(x1 - x0), d: r3(z1 - z0), o: { when: asset.when }, acts: [], s: 1 }], true);
    msg('Trigger placed · add what it does in Properties (Then)');
  }
  function placeZone(b) {
    const T = asset && HZ().TYPES[asset.zt]; if (!T) return;
    let x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), z0 = Math.min(b.z0, b.z1), z1 = Math.max(b.z0, b.z1);
    if (x1 - x0 < 0.6 && z1 - z0 < 0.6) { const dw = ZSIZE[asset.zt] || 5; x0 = b.x0 - dw / 2; x1 = b.x0 + dw / 2; z0 = b.z0 - dw / 2; z1 = b.z0 + dw / 2; }
    x0 = snapCell(x0, W.ox, b.alt); x1 = snapCell(x1, W.ox, b.alt); z0 = snapCell(z0, W.oz, b.alt); z1 = snapCell(z1, W.oz, b.alt);
    if (x1 - x0 < 0.5) x1 = x0 + CELL / 2; if (z1 - z0 < 0.5) z1 = z0 + CELL / 2;
    commit();
    const e = { k: '@zone', zt: asset.zt, x: r3((x0 + x1) / 2), z: r3((z0 + z1) / 2), w: r3(x1 - x0), d: r3(z1 - z0), s: (Math.random() * 4294967296) >>> 0 };
    if (asset.zt === 'teleport') e.o = { tx: r3(e.x + 10), tz: e.z };
    addEnts([e], true); msg('Zone: ' + T.label + ' (' + e.w + ' × ' + e.d + ' m)' + (asset.zt === 'teleport' ? ' · set where it sends you in Properties' : ''));
  }
  function placeAsset(ev) {
    commit();
    const s = (Math.random() * 4294967296) >>> 0;
    let x = snapV(ev.x, ev.alt), z = snapV(ev.z, ev.alt), ry = 0;
    if (asset.t === 'prefab') { addEnts(asset.p.ents.map((e) => shiftLever(Object.assign(clone(e), { x: r3(e.x + x), z: r3(e.z + z), s: (Math.random() * 4294967296) >>> 0 }), x, z)), true); msg('Placed ' + asset.p.name); return; }
    if (asset.t === 'trigger') { addEnts([{ k: '@trigger', x, z, y: 0, ry, w: 1, d: 1, o: { when: asset.when }, acts: [], s }], true); msg('Trigger placed · add what it does in Properties (Then)'); return; }
    if (asset.t === 'marker') { const n = ents.filter((q) => q.k === '@marker').length + 1; addEnts([{ k: '@marker', x, z, y: 0, ry, o: { kind: asset.kind }, tag: asset.kind === 'point' ? 'point' + n : undefined, s }], true); msg('Placed ' + asset.name); return; }
    if (asset.t === 'piece') {
      const q = GAME_PIECES.find((p) => p[0] === asset.key); if (!q) return;
      const [key, label, shape] = q, cx = W.cellX(ev.x), cz = W.cellZ(ev.z); let pin = null;
      if (shape === 'wall' || shape === 'eye') { const f = wallFace(ev.x, ev.z, 3); if (f) { const dx = Math.round(Math.sin(f.ry)), dz = Math.round(Math.cos(f.ry)); pin = shape === 'eye' ? { x: r3(f.x + dx * 0.06), y: 2.6, z: r3(f.z + dz * 0.06), nx: dx, nz: dz } : { x: r3(f.x + dx * 0.7), z: r3(f.z + dz * 0.7), dx, dz }; } }
      else if (shape === 'building') pin = { x: cx - 2, z: cz - 2, n: 5 };
      else if (shape === 'platform') pin = { x: cx - 2, z: cz - 3, dx: 0, dz: 1 };
      else if (shape === 'door') pin = pinFor({ shape: 'door' }, ev.x, ev.z);
      else { pin = { x: r3(x), z: r3(z) }; if (key === 'bench') { pin.dx = 0; pin.dz = 1; } }
      if (!pin) { msg(shape === 'door' ? 'A door trap goes on a door: click on one' : label + ' goes against a wall: click near one', true); undo.pop(); return; }
      place[key] = pin; markDirty('place'); rebuild(); renderAssets();
      const other = key === 'tele0' ? 'tele1' : key === 'tele1' ? 'tele0' : null;
      msg('Placed ' + label + (other && !place[other] ? ' · now place ' + (other === 'tele0' ? 'Teleporter A' : 'Teleporter B') + ': a teleporter needs both ends' : key === 'bench' ? ' · place its three parts too' : ''));
      return;
    }
    if (asset.t === 'trap') {
      const K = TRP().KINDS[asset.tt]; if (!K) return;
      if (!ev.alt) { x = r3(snapCell(ev.x - K.w / 2, W.ox) + K.w / 2); z = r3(snapCell(ev.z - K.d / 2, W.oz) + K.d / 2); }
      addEnts([{ k: '@trap', tt: asset.tt, x, z, w: K.w, d: K.d, lx: r3(x + K.w / 2 + 0.9), lz: z, s }], true);
      msg('Placed ' + K.label + ' · drag its round handle to stand the lever where you want it'); return;
    }
    if (asset.t === 'block') {
      const w = CELL * 2, d = CELL * 2; x = W.cx2x(W.cellX(ev.x)) + CELL / 2; z = W.cz2z(W.cellZ(ev.z)) + CELL / 2;
      addEnts([{ k: '@block', b: asset.k, x: r3(x), z: r3(z), w, d, s }], true); msg('Placed ' + asset.k); return;
    }
    const k = asset.k;
    if (WALLPROPS.has(k) || k === '@text') { const f = wallFace(ev.x, ev.z); if (f) { x = r3(f.x); z = r3(f.z); ry = r3(f.ry); } }
    const e = { k, x, z, y: 0, ry, s };
    const hm = SD.kitMeta[k] && SD.kitMeta[k].handle; if (hm) { e.lx = r3(x + hm.dx); e.lz = z; }
    if (k === '@log') { e.h = 0.9; e.log = { title: 'New log', who: 'Someone', text: 'What happened here.' }; }
    if (k === '@text') { e.style = asset.style; e.text = asset.style === 'paint' ? 'GET OUT' : asset.style === 'screen' ? 'NO SIGNAL' : 'SIGN'; e.w = 2.2; e.h = 0.55; e.ty = asset.style === 'paint' ? 1.5 : asset.style === 'screen' ? 1.6 : 2.6; e.o = {}; }
    addEnts([e], true); msg('Placed ' + (k[0] === '@' ? asset.name : k) + (WALLPROPS.has(k) ? ' (on the nearest wall)' : ''));
  }

  // ---------------- 2D input ----------------
  let pan2 = null, spaceHeld = false;
  const ev2 = (e) => { const r = cv.getBoundingClientRect(), [x, z] = toWorld(e.clientX - r.left, e.clientY - r.top); return { x, z, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, button: e.button, view: '2d' }; };
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* not a live pointer */ }
    if (e.button === 1 || spaceHeld || (e.button === 2 && tool !== 'tiles' && tool !== 'floor' && tool !== 'clear')) { pan2 = { sx: e.clientX, sy: e.clientY, x: view.x, z: view.z }; return; }
    down(ev2(e));
  });
  cv.addEventListener('pointermove', (e) => {
    if (pan2) { view.x = pan2.x - (e.clientX - pan2.sx) / view.zoom; view.z = pan2.z - (e.clientY - pan2.sy) / view.zoom; return; }
    const v = ev2(e); move(v); cursorInfo(v.x, v.z);
  });
  cv.addEventListener('pointerup', (e) => { if (pan2) { pan2 = null; return; } up(ev2(e)); });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), [wx, wz] = toWorld(e.clientX - r.left, e.clientY - r.top);
    view.zoom = Math.max(0.5, Math.min(80, view.zoom * Math.pow(1.0016, -Math.max(-600, Math.min(600, e.deltaY)))));
    const [nx, nz] = toWorld(e.clientX - r.left, e.clientY - r.top); view.x += wx - nx; view.z += wz - nz;
  }, { passive: false });
  cv.addEventListener('dblclick', (e) => { const v = ev2(e); P.cam.position.set(v.x, 14, v.z + 12); lookAt(v.x, 0, v.z); msg('3D view moved here'); });
  function cursorInfo(x, z) {
    const cx = W.cellX(x), cz = W.cellZ(z);
    if (!W.inside(cx, cz)) { $('xeCursor').textContent = ''; return; }
    const ch = grid[cz][cx], q = XH.zones.at(cx, cz), f = SD.FLOORSTYLE[floors[cz * W.w + cx]];
    const i = cz * W.w + cx, hv = tdir[i] ? `ramp ${r3(th[i])} to ${r3(th[i] + trise[i])} m` : th[i] ? `floor ${th[i] > 0 ? '+' : ''}${th[i]} m` : '';
    $('xeCursor').textContent = `x ${x.toFixed(2)}  z ${z.toFixed(2)}  ·  cell ${cx},${cz}  ${ch} ${TILE[ch] ? TILE[ch][1] : ''}${f ? ' · ' + f : ''}${hv ? ' · ' + hv : ''}${q ? '  ·  ' + q.name : ''}`;
  }

  // ---------------- 3D view: fly camera and picking ----------------
  const keys = new Set();
  let look3 = null, yaw = 0, pitch = -0.6, mouse3 = null, last3 = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function lookAt(x, y, z) { const d = new THREE.Vector3(x, y, z).sub(P.cam.position); yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); applyCam(); }
  function applyCam() { P.cam.rotation.order = 'YXZ'; P.cam.rotation.set(pitch, yaw, 0); P.cam.fov = 70; P.cam.updateProjectionMatrix(); }
  function ev3(e, pick) {
    const r = gl.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    P.cam.updateMatrixWorld(); ray.setFromCamera(ndc, P.cam);
    const out = { shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, button: e.button, view: '3d', x: 0, z: 0 };
    const hits = [];
    if (pick && entRoot) hits.push(...ray.intersectObjects(entRoot.children, true).filter((h) => h.object.userData.ent && !h.object.isSprite && !hiddenCat(h.object.userData.ent) && !lockCat.has(sceneCat(h.object.userData.ent))));
    if (pick) hits.push(...ray.intersectObjects(gizRoot.children, false).filter((h) => h.object.userData.light !== undefined || h.object.userData.piece));
    hits.sort((a, b) => a.distance - b.distance);
    const cands = [];
    for (const hh of hits) {
      const u = hh.object.userData; let c = null;
      if (u.light !== undefined) c = { t: 'light', i: u.light };
      else if (u.piece) c = { t: 'piece', i: u.piece };
      else if (u.ent) { let o = hh.object, lever = false; while (o) { if (o.userData.lever) { lever = true; break; } o = o.parent; } c = lever ? { t: 'lever', e: u.ent } : { t: 'ent', e: u.ent }; }
      if (c && !cands.some((q) => q.t === c.t && selV(q) === selV(c))) cands.push(c);
    }
    const zl = (c) => (c.t === 'ent' && c.e.k === '@zone' ? 1 : 0); cands.sort((p, q) => zl(p) - zl(q));
    out.cands = cands;
    const h = hits[0];
    if (h && h.object.userData.light !== undefined) out.hitLight = h.object.userData.light; else if (h && h.object.userData.piece) { out.hitPiece = h.object.userData.piece; out.hitEnt = null; } else if (h) out.hitEnt = h.object.userData.ent; else out.hitEnt = null;
    // where the ray meets the floor, raised or lowered
    const p = new THREE.Vector3(); let y = 0, ok = false;
    for (let k = 0; k < 5; k++) { ground.constant = -y; if (!ray.ray.intersectPlane(ground, p)) break; ok = true; const ny = W.floorAt(p.x, p.z); if (Math.abs(ny - y) < 0.02) break; y = ny; }
    if (ok) { out.x = p.x; out.z = p.z; } else out.nop = true;
    if (tool === 'select' && !out.hitEnt && out.hitLight === undefined) out.hitEnt = null;
    return out;
  }
  // everything in the 3D pane is handled here, before the game's own input sees it
  pane3.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
  pane3.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); try { pane3.setPointerCapture(e.pointerId); } catch (err) { /* not a live pointer */ }
    if (e.button === 2) { look3 = { x: e.clientX, y: e.clientY, moved: false }; return; }
    if (e.button === 1) { mouse3 = { pan: true, x: e.clientX, y: e.clientY }; return; }
    if (e.button === 0 && tool === 'select' && gizmoDown(e)) return;
    const v = ev3(e, true); if (v.nop) return;
    if ((tool === 'tiles' || tool === 'floor' || tool === 'clear' || tool === 'height' || tool === 'ramp') && e.button === 0) { down(v); last3 = v; return; }
    down(v); last3 = v;
  }, true);
  pane3.addEventListener('pointermove', (e) => {
    e.stopPropagation();
    if (look3) { yaw -= (e.clientX - look3.x) * 0.004; pitch = Math.max(-1.5, Math.min(1.5, pitch - (e.clientY - look3.y) * 0.004)); look3.x = e.clientX; look3.y = e.clientY; look3.moved = true; applyCam(); return; }
    if (mouse3 && mouse3.pan) { const r = new THREE.Vector3(1, 0, 0).applyQuaternion(P.cam.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(P.cam.quaternion), k = 0.03; P.cam.position.addScaledVector(r, -(e.clientX - mouse3.x) * k).addScaledVector(u, (e.clientY - mouse3.y) * k); mouse3.x = e.clientX; mouse3.y = e.clientY; return; }
    if (gz) { gizmoMove(e); return; }
    const v = ev3(e); if (v.nop) { cursorMesh.visible = false; return; }
    move(v); cursorInfo(v.x, v.z);
    const cx = W.cellX(v.x), cz = W.cellZ(v.z);
    if ((tool === 'tiles' || tool === 'floor' || tool === 'height' || tool === 'ramp') && W.inside(cx, cz)) { cursorMesh.visible = true; cursorMesh.scale.set(CELL * brush, 0.1, CELL * brush); cursorMesh.position.set(W.cx2x(cx - ((brush - 1) >> 1)) + (brush - 1) * CELL / 2, W.floorAt(v.x, v.z) + 0.05, W.cz2z(cz - ((brush - 1) >> 1)) + (brush - 1) * CELL / 2); }
    else if (tool === 'place' || tool === 'light') { cursorMesh.visible = true; cursorMesh.scale.set(0.5, 0.05, 0.5); cursorMesh.position.set(snapV(v.x, e.altKey), W.floorAt(v.x, v.z) + 0.03, snapV(v.z, e.altKey)); }
    else cursorMesh.visible = false;
  }, true);
  pane3.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    if (look3) { look3 = null; return; }
    if (mouse3) { mouse3 = null; return; }
    if (gz) { gizmoUp(); return; }
    const v = ev3(e, true); if (v.nop && last3) { v.x = last3.x; v.z = last3.z; }
    up(v);
  }, true);
  pane3.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); const d = new THREE.Vector3(); P.cam.getWorldDirection(d); P.cam.position.addScaledVector(d, e.deltaY < 0 ? 2.5 : -2.5); }, { passive: false, capture: true });
  pane3.addEventListener('pointerleave', () => { cursorMesh.visible = false; });
  // ---------------- the 3D gizmo: arrows move a piece along X, Z and up (Y); the ring turns it ----------------
  const gzRoot = new THREE.Group(); gzRoot.name = 'xedit-gizmo'; gzRoot.visible = false; M.scene.add(gzRoot);
  const gzMat = (c) => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95 });
  const gzParts = [];
  for (const [ax, c, rot] of [['x', 0xff4050, [0, 0, -Math.PI / 2]], ['y', 0x50ff70, [0, 0, 0]], ['z', 0x4c8cff, [Math.PI / 2, 0, 0]]]) {
    const g = new THREE.Group(); g.rotation.set(...rot); gzRoot.add(g);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), gzMat(c)); shaft.position.y = 0.5; g.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 10), gzMat(c)); head.position.y = 1.1; g.add(head);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.65; g.add(hit);
    for (const m of [shaft, head, hit]) { m.userData.gz = ax; m.renderOrder = 999; gzParts.push(m); }
  }
  { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.03, 6, 64), gzMat(0xffd040)); ring.rotation.x = Math.PI / 2; ring.userData.gz = 'r'; ring.renderOrder = 999; gzRoot.add(ring); gzParts.push(ring);
    const rh = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.14, 4, 48), new THREE.MeshBasicMaterial({ visible: false })); rh.rotation.x = Math.PI / 2; rh.userData.gz = 'r'; gzRoot.add(rh); gzParts.push(rh); }
  let gz = null;
  const gzEnt = () => (sel.length === 1 && sel[0].t === 'ent' && sel[0].e._g ? sel[0].e : null);
  function placeGizmo() {
    const e = gzEnt(); gzRoot.visible = !!e && layout !== '2d' && tool === 'select'; if (!gzRoot.visible) return;
    const y = W.floorAt(e.x, e.z) + (e.y || 0) + 0.05; gzRoot.position.set(e.x, y, e.z);
    gzRoot.scale.setScalar(Math.max(0.6, P.cam.position.distanceTo(gzRoot.position) * 0.09));
  }
  const _gp = new THREE.Plane(), _gv = new THREE.Vector3();
  function gizmoRay(e) { const r = gl.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); P.cam.updateMatrixWorld(); ray.setFromCamera(ndc, P.cam); }
  function gizmoHit() { if (_gp.normal.lengthSq() === 0) return null; const p = new THREE.Vector3(); return ray.ray.intersectPlane(_gp, p) ? p : null; }
  function gizmoDown(e) {
    const ent = gzEnt(); if (!ent || !gzRoot.visible) return false;
    placeGizmo(); gzRoot.updateMatrixWorld(true); gizmoRay(e);
    const h = ray.intersectObjects(gzParts, false)[0]; if (!h) return false;
    const ax = h.object.userData.gz, c = gzRoot.position.clone();
    if (ax === 'y') { _gv.subVectors(P.cam.position, c).setY(0); if (_gv.lengthSq() < 1e-4) _gv.set(0, 0, 1); _gp.setFromNormalAndCoplanarPoint(_gv.normalize(), c); }
    else _gp.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), c);
    const p0 = gizmoHit(); if (!p0) return false;
    commit(); gz = { ax, e: ent, p0, c, x: ent.x, z: ent.z, y: ent.y || 0, ry: ent.ry || 0, lx: ent.lx, lz: ent.lz, a0: Math.atan2(p0.x - c.x, p0.z - c.z) };
    return true;
  }
  function gizmoMove(e) {
    gizmoRay(e); const p = gizmoHit(); if (!p) return; const q = gz, en = q.e;
    if (q.ax === 'x') en.x = snapV(q.x + p.x - q.p0.x, e.altKey);
    else if (q.ax === 'z') en.z = snapV(q.z + p.z - q.p0.z, e.altKey);
    else if (q.ax === 'y') en.y = Math.max(0, r3(Math.round((q.y + p.y - q.p0.y) / (e.altKey ? 0.01 : 0.25)) * (e.altKey ? 0.01 : 0.25)));
    else { const st = (e.altKey ? 1 : rotStep) * Math.PI / 180, d = Math.atan2(p.x - q.c.x, p.z - q.c.z) - q.a0; en.ry = r3((((q.ry + Math.round(d / st) * st) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)); }
    if (q.lx !== undefined) { en.lx = r3(q.lx + en.x - q.x); en.lz = r3(q.lz + en.z - q.z); }
    moveLive(en); placeGizmo(); gizmos(); msg(q.ax === 'r' ? 'Facing ' + deg(en.ry) + '°' : q.ax === 'y' ? 'Height ' + (en.y || 0) + ' m' : 'x ' + en.x + ' · z ' + en.z);
  }
  function gizmoUp() { const en = gz.e; gz = null; spawnEnt(en); markDirty('dress'); gizmos(); showProps(); }

  // ---------------- the Scene panel: everything on the map, by kind ----------------
  const SCENE_CATS = ['Zones', 'Traps', 'Triggers', 'Markers', 'Moving', 'Kit', 'Props', 'Blocks', 'Story', 'Decals', 'Lights', 'Pieces'];
  let sceneOpen = new Set(['Triggers', 'Traps', 'Zones']), sceneQ = '';
  function showScene() {
    const el = $('xeScene'); if (el.classList.contains('hidden')) return;
    const q = sceneQ.toLowerCase(), by = new Map(SCENE_CATS.map((c) => [c, []]));
    ents.forEach((e, i) => { let c = sceneCat(e); if (c === 'Kit' && SD.kitMeta[e.k] && SD.kitMeta[e.k].cat === 'Moving and breakable') c = 'Moving'; const nm = entName(e); if (!q || nm.toLowerCase().includes(q) || (e.tag || '').toLowerCase().includes(q)) by.get(c).push(['e', i, nm, isSel('ent', e)]); });
    lights.forEach((l, i) => { const nm = 'Light ' + (i + 1) + ' · ' + hex(l[2]); if (!q || nm.toLowerCase().includes(q)) by.get('Lights').push(['l', i, nm, isSel('light', i)]); });
    pieces.forEach((pc) => { if (!q || pc.label.toLowerCase().includes(q)) by.get('Pieces').push(['p', pc.key, pc.label, isSel('piece', pc.key)]); });
    let html = `<input id="xeSceneQ" placeholder="Find on the map (name, kind)..." value="${esc(sceneQ)}" spellcheck="false">`;
    for (const c of SCENE_CATS) {
      const list = by.get(c), open = sceneOpen.has(c) || (q && list.length), catKey = c === 'Moving' ? 'Kit' : c;
      const hid = c === 'Lights' ? hideCat.has('Lights') : hideCat.has(catKey), lk = lockCat.has(catKey);
      html += `<div class="xe-scat" data-scat="${c}"><b>${open ? '▾' : '▸'}</b><span>${c}</span><em>${list.length}</em>${c === 'Pieces' ? '' : `<button data-seye="${catKey}" class="${hid ? 'off' : ''}" title="Show or hide">${hid ? '◌' : '◉'}</button>`}${c === 'Lights' || c === 'Pieces' ? '' : `<button data-slock="${catKey}" class="${lk ? 'on' : ''}" title="Lock: can not be picked in the views">${lk ? '🔒' : '🔓'}</button>`}</div>`;
      if (open) html += list.slice(0, 400).map(([t2, i, nm, on]) => `<div class="xe-srow${on ? ' on' : ''}" data-s="${t2}" data-si="${esc(i)}">${esc(nm)}</div>`).join('') + (list.length > 400 ? `<div class="xe-note">… ${list.length - 400} more: search to narrow it down</div>` : '');
    }
    html += '<p class="xe-note">Click to select, double-click to fly to it. The eye hides a kind in both views (it is still saved and still in the game); the lock stops it being picked, so you can work around it.</p>';
    const st = el.scrollTop; el.innerHTML = html; el.scrollTop = st;
    const s = $('xeSceneQ'); s.addEventListener('input', () => { sceneQ = s.value; const pos = s.selectionStart; showScene(); const n = $('xeSceneQ'); n.focus(); n.setSelectionRange(pos, pos); });
  }
  const sceneHit = (row) => (row.dataset.s === 'e' ? { t: 'ent', e: ents[+row.dataset.si] } : row.dataset.s === 'l' ? { t: 'light', i: +row.dataset.si } : { t: 'piece', i: row.dataset.si });
  function setHidden(cat, hide) {
    if (hide) hideCat.add(cat); else hideCat.delete(cat);
    unbatchAll(); for (const e of ents) if (e._g) e._g.visible = !hiddenCat(e); batchT = 0.3;
    if (hide) sel = sel.filter((q) => !(q.e && hiddenCat(q.e)) && !(cat === 'Lights' && q.t === 'light'));
    gizmos(); showProps(); redraw();
  }
  $('xeScene').addEventListener('click', (ev) => {
    const eye = ev.target.closest('[data-seye]'); if (eye) { setHidden(eye.dataset.seye, !hideCat.has(eye.dataset.seye)); showScene(); return; }
    const lk = ev.target.closest('[data-slock]'); if (lk) { const c = lk.dataset.slock; if (lockCat.has(c)) lockCat.delete(c); else lockCat.add(c); showScene(); msg(lockCat.has(c) ? c + ' locked: they can not be picked in the views' : c + ' unlocked'); return; }
    const cat = ev.target.closest('[data-scat]'); if (cat) { const c = cat.dataset.scat; if (sceneOpen.has(c)) sceneOpen.delete(c); else sceneOpen.add(c); showScene(); return; }
    const row = ev.target.closest('[data-s]'); if (!row) return;
    const h = sceneHit(row); if (h.t === 'ent' && !h.e) return; select([h], ev.shiftKey || ev.ctrlKey); tab('scene'); showScene();
  });
  $('xeScene').addEventListener('dblclick', (ev) => { const row = ev.target.closest('[data-s]'); if (!row) return; const h = sceneHit(row); select([h]); focusSel(); tab('scene'); showScene(); });
  $('xeSnap').addEventListener('change', (ev) => { snap = +ev.target.value; msg(snap ? 'Snapping to ' + snap + ' m' : 'No snapping'); });
  $('xeTurn').addEventListener('change', (ev) => { rotStep = +ev.target.value; msg('Turning in ' + rotStep + '° steps'); });
  function updateFly(dt) {
    if (!look3) return;
    const sp = (keys.has('shift') ? 30 : 10) * dt, f = new THREE.Vector3(), r = new THREE.Vector3();
    P.cam.getWorldDirection(f); r.crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    if (keys.has('w')) P.cam.position.addScaledVector(f, sp); if (keys.has('s')) P.cam.position.addScaledVector(f, -sp);
    if (keys.has('d')) P.cam.position.addScaledVector(r, sp); if (keys.has('a')) P.cam.position.addScaledVector(r, -sp);
    if (keys.has('e')) P.cam.position.y += sp; if (keys.has('q')) P.cam.position.y -= sp;
  }
  function focusSel() {
    let x, z;
    const es = selEnts();
    if (es.length) { x = es.reduce((s, e) => s + e.x, 0) / es.length; z = es.reduce((s, e) => s + e.z, 0) / es.length; }
    else if (sel[0] && sel[0].t === 'light') { x = W.cx2x(lights[sel[0].i][0]); z = W.cz2z(lights[sel[0].i][1]); }
    else if (sel[0] && sel[0].t === 'piece') { const pc = pieces.find((q) => q.key === sel[0].i); if (!pc) return; x = pc.x; z = pc.z; }
    else if (sel[0] && sel[0].t === 'lever') { x = sel[0].e.lx; z = sel[0].e.lz; }
    else if (sel[0] && sel[0].t === 'tile') { x = W.cx2x(sel[0].i % W.w); z = W.cz2z((sel[0].i / W.w) | 0); }
    else return;
    const fy = W.floorAt(x, z); P.cam.position.set(x + 5, fy + 6, z + 7); lookAt(x, fy + 0.8, z); view.x = x; view.z = z;
  }

  // ---------------- keyboard ----------------
  const typing = (e) => e.target && e.target.closest && e.target.closest('input, textarea, select');
  window.addEventListener('keydown', (e) => {
    e.stopImmediatePropagation();
    lastInput = t; redraw();
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 's') { e.preventDefault(); if (typing(e)) e.target.blur(); save(); return; }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); playHere(); return; } // blur first, so the field's change is kept
    if (typing(e)) { if (e.key === 'Escape') e.target.blur(); return; }
    keys.add(k === 'shift' ? 'shift' : k);
    if (e.key === ' ') spaceHeld = true;
    if (look3 && 'wasdqe'.includes(k) && !ctrl) return; // flying
    if (ctrl && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); doRedo(); return; }
    if (ctrl && k === 'd') { e.preventDefault(); duplicate(); return; }
    if (ctrl && k === 'c' && (tool === 'tiles' || tool === 'floor') && tileSel) { copyTiles(); return; }
    if (ctrl && k === 'v' && (tool === 'tiles' || tool === 'floor') && tileClip) { if (hover) pasteTiles(W.cellX(hover[0]), W.cellZ(hover[1])); return; }
    if (ctrl && k === 'c') { copySel(); return; }
    if (ctrl && k === 'v') { if (hover) pasteAt(hover[0], hover[1]); return; }
    if (ctrl && k === 'a') { e.preventDefault(); select(ents.map((q) => ({ t: 'ent', e: q }))); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && (tool === 'tiles' || tool === 'floor') && tileSel) { e.preventDefault(); clearTiles(); return; }
    if (e.key === 'Escape' && tileSel) { tileSel = null; redraw(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
    if (e.key === 'F1') { e.preventDefault(); help($('xeHelpBox').classList.contains('hidden')); return; }
    if (e.key === 'Escape') { if (!nb.classList.contains('hidden')) newBox(false); else if (!$('xeHelpBox').classList.contains('hidden')) help(false); else select([]); return; }
    if (e.key === 'Tab') { e.preventDefault(); setLayout(layout === 'split' ? '3d' : layout === '3d' ? '2d' : 'split'); return; }
    if (e.key === 'F5') { e.preventDefault(); rebuild(); msg('Rebuilt'); return; }
    const step = e.shiftKey ? CELL : snap || 0.25;
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step, 0); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); nudge(step, 0); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -step); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, step); return; }
    if (k === 'r' && (tool === 'tiles' || tool === 'floor') && tileClip) { turnClip(); return; }
    if (k === 'r' || k === ']') { if (!turnPieces(e.shiftKey ? -1 : 1)) rotateSel((e.shiftKey ? -1 : 1) * rotStep * Math.PI / 180); return; }
    if (k === '[') { if (!turnPieces(-1)) rotateSel(-rotStep * Math.PI / 180); return; }
    if (k === 'f') { focusSel(); return; }
    const tools = { v: 'select', p: 'place', b: 'tiles', g: 'floor', h: 'height', n: 'ramp', l: 'light', c: 'clear', z: 'zone' };
    if (!ctrl && tools[k]) setTool(tools[k]);
  }, true);
  window.addEventListener('keyup', (e) => { e.stopImmediatePropagation(); lastInput = t; redraw(); keys.delete(e.key.toLowerCase()); if (e.key === 'Shift') keys.delete('shift'); if (e.key === ' ') spaceHeld = false; }, true);
  window.addEventListener('blur', () => { keys.clear(); look3 = null; });

  // ---------------- side panels ----------------
  function tab(name) {
    for (const b of root.querySelectorAll('.xe-tabs button')) b.classList.toggle('on', b.dataset.tab === name);
    $('xeAssets').classList.toggle('hidden', name !== 'assets'); $('xeProps').classList.toggle('hidden', name !== 'props'); $('xeMapPanel').classList.toggle('hidden', name !== 'map'); $('xeScene').classList.toggle('hidden', name !== 'scene');
    if (name === 'map') showMapPanel();
    if (name === 'scene') showScene();
  }
  root.querySelector('.xe-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) tab(b.dataset.tab); });
  function setTool(tl) {
    tool = tl;
    for (const b of root.querySelectorAll('#xeTools button')) b.classList.toggle('on', b.dataset.tool === tl);
    const hints = {
      select: 'Click to select (click again on the same spot for the next thing there) · Shift+click adds · drag a box on the plan · drag to move (Alt: no snapping) · R / [ ] turn · Ctrl+D duplicate · Del delete · F focus',
      place: 'Click to place the picked asset · zones: drag out a rectangle · traps: then drag the round lever handle · wall pieces hang on the nearest wall · Alt: no snapping',
      tiles: 'Left paints · right paints floor · Shift+drag fills a rectangle · Ctrl+drag picks a region: Ctrl+C copies, Ctrl+V pastes at the cursor, R turns the copy, Delete clears',
      floor: 'Left paints the surface · right clears it · Shift+drag fills a rectangle',
      height: 'Left raises, right lowers (by the step on the right) · Shift paints the set height · Ctrl+click picks up a height',
      ramp: 'Drag from a cell on one level across to a cell on another: the cells between become a slope',
      light: 'Click empty floor to add a light · click a light to select and drag it · edit colour, strength and range on the right',
      clear: 'Click to keep the theme\'s clutter out of a circle · right click removes one',
      zone: 'Drag inside a room to move it, near an edge to resize · Ctrl+drag draws a new room · rooms decide where the ammo, bench, egg and traps go',
    };
    $('xeHint').textContent = hints[tl] || '';
    if (tl === 'tiles' || tl === 'floor' || tl === 'place' || tl === 'clear' || tl === 'height' || tl === 'ramp') tab('assets');
    gridDirty = true;
    renderAssets(); cursorMesh.visible = false;
  }
  $('xeTools').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTool(b.dataset.tool); });

  // the right-hand browser changes with the tool: tiles, floors, or props, blocks, story pieces and saved groups
  let search = '';
  function renderAssets() {
    const el = $('xeAssets');
    if (tool === 'tiles') {
      el.innerHTML = `<div class="xe-row"><span>Brush</span>${[1, 3, 5].map((n) => `<button data-brush="${n}" class="${brush === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="xe-tiles">${TILES.map((t) => `<button data-tile="${esc(t[0])}" class="${tileCh === t[0] ? 'on' : ''}" title="${esc(t[1])}"><i style="background:${t[2]}">${esc(t[0])}</i>${esc(t[1])}</button>`).join('')}</div>
        <p class="xe-note">Doors (0 to 9) and wall guns (a to w) take their price and gun from the Map tab. A map needs one player start and at least two spawn vents.</p>`;
    } else if (tool === 'floor') {
      el.innerHTML = `<div class="xe-row"><span>Brush</span>${[1, 3, 5].map((n) => `<button data-brush="${n}" class="${brush === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="xe-tiles">${Object.keys(SD.FLOORCODE).map((f) => `<button data-floor="${f}" class="${floorStyle === f ? 'on' : ''}"><i style="background:${FLOORCOL[f]}"></i>${f}</button>`).join('')}</div>
        <p class="xe-note">Floor surfaces go on plain floor tiles. Right click clears a cell back to the map's own floor.</p>`;
    } else if (tool === 'height') {
      el.innerHTML = `<div class="xe-row"><span>Brush</span>${[1, 3, 5].map((n) => `<button data-brush="${n}" class="${brush === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="xe-row"><span>Step</span>${[0.25, 0.5, 1, 2.5].map((n) => `<button data-hstep="${n}" class="${hStep === n ? 'on' : ''}">${n} m</button>`).join('')}</div>
        <label>Set height (Shift+paint, Ctrl+click picks one up)<input type="number" id="xeHSet" value="${hSet}" step="0.25" min="-3.75" max="11.75"></label>
        <p class="xe-note">Left click raises, right click lowers. The player and creatures walk straight up anything up to 0.6 m; higher than that is a ledge. The player can climb up to about 1.6 m and creatures up to 3.4 m when you are up there, but their paths only use slopes and small steps, so join levels with the Ramp tool. Anything built on a cell moves up or down with it.</p>`;
      el.querySelector('#xeHSet').addEventListener('change', (e) => { hSet = Math.max(-3.75, Math.min(11.75, Math.round((+e.target.value || 0) / 0.25) * 0.25)); e.target.value = hSet; });
    } else if (tool === 'ramp') {
      el.innerHTML = `<div class="xe-row"><span>Width</span>${[1, 3, 5].map((n) => `<button data-brush="${n}" class="${brush === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <p class="xe-note">Drag from a cell on one level (say the courtyard floor) straight across to a cell on another (the top of a raised deck). The cells between them become a slope from one height to the other. Give it room: about a metre of rise per cell is the steepest you can still walk up.</p>`;
    } else if (tool === 'clear') {
      el.innerHTML = `<div class="xe-row"><span>Radius</span><input type="range" id="xeClearR" min="1" max="12" step="0.5" value="${clearR}"><em>${clearR} m</em></div>
        <p class="xe-note">The theme scatters its own clutter over every map (rocks, crates, pipes, crystals, derricks...). Circles drawn here keep it out, so a spot you have dressed by hand stays as you left it.</p>`;
      el.querySelector('#xeClearR').addEventListener('input', (e) => { clearR = +e.target.value; e.target.nextElementSibling.textContent = clearR + ' m'; });
    } else {
      const q = search.toLowerCase(), match = (s) => !q || s.toLowerCase().includes(q);
      const item = (a, label, col, tip) => `<button data-asset='${esc(JSON.stringify(a))}' class="${asset && JSON.stringify(asset) === JSON.stringify(a) ? 'on' : ''}" title="${esc(tip || label)}"><i style="background:${col}"></i>${esc(label)}</button>`;
      let html = `<input id="xeSearch" placeholder="Search: props, zones, traps, walls..." value="${esc(search)}" spellcheck="false">`;
      const all = Object.keys(SD.props), used = new Set();
      const story = [[{ t: 'prop', k: '@log', name: 'Datapad log' }, 'Datapad log'], [{ t: 'prop', k: '@text', style: 'sign', name: 'Sign' }, 'Sign'], [{ t: 'prop', k: '@text', style: 'paint', name: 'Wall paint' }, 'Painted words'], [{ t: 'prop', k: '@text', style: 'screen', name: 'Screen' }, 'Screen text']].filter(([, l]) => match(l));
      const pf = [...BUILTIN_PREFABS, ...prefabs].filter((p) => match(p.name));
      if (pf.length) html += `<h4>Ready-made and saved groups</h4><div class="xe-list">${pf.map((p) => item({ t: 'prefab', name: p.name }, p.name + ' (' + p.ents.length + ')', CATCOL.Story)).join('')}</div>`;
      if (custom) { const gp = GAME_PIECES.filter((q) => match(q[1]) || match('piece')); if (gp.length) html += `<h4>Game pieces (one of each)</h4><div class="xe-list">${gp.map((q) => item({ t: 'piece', key: q[0], name: q[1] }, q[1] + (place[q[0]] && !place[q[0]].off ? ' ✓' : ''), '#ff70d0', q[3] || q[1])).join('')}</div><p class="xe-note">Nothing places itself on a map of your own: these go exactly where you put them (✓ already placed; placing again moves it). Drag them afterwards, Delete removes them.</p>`; }
      const lw = Object.entries(LOGIC().WHEN).filter(([, q]) => match(q.label) || match('trigger') || match('logic')), lm = Object.entries(LOGIC().MARKERS).filter(([, q]) => match(q.label) || match('marker') || match('logic'));
      if (lw.length || lm.length) html += `<h4>Logic: triggers and markers</h4><div class="xe-list">${lw.map(([k, q]) => item({ t: 'trigger', when: k, name: 'Trigger' }, '⚡ ' + q.label, CATCOL.Logic, 'A trigger: ' + q.label.toLowerCase() + ', then whatever you list in Properties')).join('')}${lm.map(([k, q]) => item({ t: 'marker', kind: k, name: q.label }, '⚑ ' + q.label, hex(q.color), k === 'point' ? 'A named spot for triggers: where creatures spawn, where the player is sent, where things explode' : k === 'spawn' ? 'Creatures come out here too (once the player can reach it)' : 'Bosses come out here')).join('')}</div>`;
      const trs = Object.entries(TRP().KINDS).filter(([, K]) => match(K.label) || match('trap'));
      if (trs.length) html += `<h4>Traps (each with its own lever)</h4><div class="xe-list">${trs.map(([k, K]) => item({ t: 'trap', tt: k, name: K.label }, K.label, hex(K.color), K.note)).join('')}</div>`;
      for (const c of HZ().CATS) { const zs = Object.entries(HZ().TYPES).filter(([, T]) => T.cat === c && (match(T.label) || match('zone'))); if (zs.length) html += `<h4>Zones: ${esc(c.toLowerCase())}</h4><div class="xe-list">${zs.map(([k, T]) => item({ t: 'zone', zt: k, name: T.label }, T.label, hex(T.color), T.note)).join('')}</div>`; }
      for (const c of [...new Set(Object.values(SD.kitMeta).map((m) => m.cat))]) {
        const ks = Object.keys(SD.kitMeta).filter((k) => SD.kitMeta[k].cat === c); ks.forEach((k) => used.add(k));
        const shown = ks.filter((k) => match(SD.kitMeta[k].label) || match(k)); if (shown.length) html += `<h4>${esc(c)}</h4><div class="xe-list">${shown.map((k) => item({ t: 'prop', k, name: SD.kitMeta[k].label }, SD.kitMeta[k].label, CATCOL[c] || CATCOL.Other, SD.kitMeta[k].note)).join('')}</div>`;
      }
      if (story.length) html += `<h4>Story</h4><div class="xe-list">${story.map(([a, l]) => item(a, l, CATCOL.Story)).join('')}</div>`;
      const bl = SD.blockKinds().filter(match);
      if (bl.length) html += `<h4>Blocks (fill a solid block)</h4><div class="xe-list">${bl.map((b) => item({ t: 'block', k: b }, b, CATCOL.Blocks)).join('')}</div>`;
      for (const [c, list] of CATS) {
        const ks = list.split(' ').filter((k) => all.includes(k)); ks.forEach((k) => used.add(k));
        const shown = ks.filter(match); if (shown.length) html += `<h4>${c}</h4><div class="xe-list">${shown.map((k) => item({ t: 'prop', k }, k + (WALLPROPS.has(k) ? ' ▮' : ''), CATCOL[c])).join('')}</div>`;
      }
      const other = all.filter((k) => !used.has(k) && match(k)); if (other.length) html += `<h4>Other</h4><div class="xe-list">${other.map((k) => item({ t: 'prop', k }, k, CATCOL.Other)).join('')}</div>`;
      html += `<p class="xe-note">▮ hangs on a wall. Pick something, then click in either view with the Place tool (P). Zones: drag out a rectangle, or click for the default size. Traps: click, then drag the round handle to stand its lever anywhere.</p>`;
      el.innerHTML = html;
      const s = el.querySelector('#xeSearch'); s.addEventListener('input', () => { search = s.value; const pos = s.selectionStart; renderAssets(); const n = $('xeSearch'); n.focus(); n.setSelectionRange(pos, pos); });
    }
  }
  $('xeAssets').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.brush) { brush = +b.dataset.brush; renderAssets(); return; }
    if (b.dataset.hstep) { hStep = +b.dataset.hstep; renderAssets(); return; }
    if (b.dataset.tile) { tileCh = b.dataset.tile; renderAssets(); return; }
    if (b.dataset.floor) { floorStyle = b.dataset.floor; renderAssets(); return; }
    if (b.dataset.asset) {
      asset = JSON.parse(b.dataset.asset);
      if (asset.t === 'prefab') asset.p = [...BUILTIN_PREFABS, ...prefabs].find((p) => p.name === asset.name);
      if (tool !== 'place') setTool('place'); else renderAssets();
      msg('Placing ' + (asset.name || asset.k) + (asset.t === 'zone' ? ': drag out a rectangle in a view (or click for the default size)' : ': click in a view'));
    }
  });

  // ---------------- properties ----------------
  const num = (label, key, v, step = 0.05) => `<label>${label}<input type="number" data-k="${key}" value="${v}" step="${step}"></label>`;
  function showProps() {
    const el = $('xeProps');
    if (!sel.length) { el.innerHTML = '<p class="xe-note">Nothing selected. Click a prop, a light, a generated piece (pink), a tile object, a cleared circle or a room.</p>'; return; }
    if (sel.length > 1) {
      el.innerHTML = `<h4>${sel.length} selected</h4><div class="xe-row"><button id="xpDel">Delete</button><button id="xpDup">Duplicate</button></div>
        <label>Save these props as a group<input id="xpPrefabName" placeholder="Group name"></label><button id="xpPrefab">Save group</button>
        <p class="xe-note">Groups appear under Saved groups in Assets, for every map.</p>`;
      el.querySelector('#xpDel').onclick = deleteSel; el.querySelector('#xpDup').onclick = duplicate;
      el.querySelector('#xpPrefab').onclick = () => savePrefab(el.querySelector('#xpPrefabName').value.trim());
      return;
    }
    const s = sel[0];
    if (s.t === 'light') {
      const l = lights[s.i];
      el.innerHTML = `<h4>Light ${s.i + 1}</h4>
        ${num('X (cells)', 'l0', l[0], 0.1)}${num('Z (cells)', 'l1', l[1], 0.1)}${num('Height (m, blank = default)', 'l5', l[5] !== undefined && l[5] !== null ? l[5] : '', 0.1)}
        <label>Colour<input type="color" data-k="l2" value="${hex(l[2])}"></label>${num('Strength', 'l3', l[3], 0.05)}${num('Range (m)', 'l4', l[4], 1)}
        <label class="xe-check"><input type="checkbox" data-k="l6" ${l[6] === 0 ? '' : 'checked'}> Light pole or ceiling fitting</label>
        <p class="xe-note">With the power off, most lights die and every third one turns into a red emergency light.</p>
        <button id="xpDel">Delete light</button>`;
    } else if (s.t === 'piece') {
      const pc = pieces.find((q) => q.key === s.i); if (!pc) { el.innerHTML = ''; return; }
      el.innerHTML = `<h4>${esc(pc.label)}</h4>
        <p class="xe-note">${custom ? 'Placed by hand (nothing places itself on a map of your own).' : place[pc.key] ? 'Placed by hand.' : 'Placed automatically (in the room it belongs to).'} Drag it to move it${pc.turn ? ', R to turn it' : ''}${pc.off || custom ? ', Delete to take it away' : ''}.${pc.shape === 'door' ? ' Drop it on another door to move it there.' : pc.shape === 'wall' || pc.shape === 'eye' ? ' It snaps to the nearest wall.' : pc.shape === 'rect' ? ' It moves a whole cell at a time.' : ''}</p>
        ${num('X', 'px', r3(pc.x), 0.25)}${num('Z', 'pz', r3(pc.z), 0.25)}
        <div class="xe-row">${pc.turn ? '<button id="xpTurn">Turn</button>' : ''}${place[pc.key] && !custom ? '<button id="xpAuto">Back to automatic</button>' : ''}${pc.off || custom ? '<button id="xpDel">' + (custom ? 'Delete' : 'Leave out of the map') + '</button>' : ''}</div>`;
      const tb = el.querySelector('#xpTurn'); if (tb) tb.onclick = () => turnPieces(1);
      const ab = el.querySelector('#xpAuto'); if (ab) ab.onclick = () => { commit(); delete place[pc.key]; markDirty('place'); rebuild(); msg('Back to automatic'); };
    } else if (s.t === 'tile') {
      const cx = s.i % W.w, cz = (s.i / W.w) | 0, ch = grid[cz][cx], t = TILE[ch] || [ch, ch];
      let html = `<h4>${esc(t[1])}</h4><p class="xe-note">Cell ${cx}, ${cz}. Drag it to move it; Delete removes it.</p>`;
      if ('JRDALVEIQN'.includes(ch)) html += `<label>Perk<select data-k="tch">${[...'JRDALVEIQN'].map((c) => `<option value="${c}" ${c === ch ? 'selected' : ''}>${esc(TILE[c][1].replace('Perk: ', ''))}</option>`).join('')}</select></label>`;
      if (ch >= 'a' && ch <= 'w') { const guns = Object.entries(XH.weapons.DEFS).filter(([, d]) => d.cost && !d.wonder); html += `<label>Gun (every "${ch}" on the map)<select data-k="tbuy">${guns.map(([k, d]) => `<option value="${k}" ${buys[ch] === k ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>`; }
      if (ch >= '0' && ch <= '9') { const q = doors[ch] || {}; html += `<label>Door name<input data-k="tdname" value="${esc(q.name || '')}"></label>${num('Price', 'tdcost', q.cost || 0, 250)}`; }
      html += '<button id="xpDel">Delete</button>';
      el.innerHTML = html;
    } else if (s.t === 'clear') {
      const c = clear[s.i];
      el.innerHTML = `<h4>Cleared area</h4>${num('X', 'c0', c[0])}${num('Z', 'c1', c[1])}${num('Radius', 'c2', c[2], 0.5)}<button id="xpDel">Delete</button>`;
    } else if (s.t === 'zone') {
      const q = zoneRects()[s.i];
      el.innerHTML = `<h4>Room</h4><label>Name<input data-k="z0" value="${esc(q[0])}"></label>${num('Left cell', 'z1', q[1], 1)}${num('Top cell', 'z2', q[2], 1)}${num('Right cell', 'z3', q[3], 1)}${num('Bottom cell', 'z4', q[4], 1)}
        <p class="xe-note">The ammo station, Wonder Bench, companion egg and traps go to rooms by name (js/zones.js). Renaming a room they use moves them to their fallback spot.</p><button id="xpDel">Delete room</button>`;
    } else if (s.t === 'ent' && (s.e.k === '@trigger' || s.e.k === '@marker')) {
      logicProps(el, s.e);
    } else if ((s.t === 'ent' || s.t === 'lever') && (s.e.k === '@zone' || s.e.k === '@trap')) {
      zoneTrapProps(el, s.e);
    } else {
      const e = s.e, opts = e.k === '@block' ? SD.blockOpts(e.b) : e.k[0] === '@' ? ['color'] : SD.propOpts[e.k] || [];
      let html = `<h4>${esc(e.k === '@block' ? 'Block: ' + e.b : e.k === '@log' ? 'Datapad log' : e.k === '@text' ? 'Text: ' + e.style : kitLabel(e.k))}</h4>`;
      if (SD.kitMeta[e.k] && SD.kitMeta[e.k].note) html += `<p class="xe-note">${esc(SD.kitMeta[e.k].note)}</p>`;
      html += tagField(e) + num('X', 'x', e.x) + num('Z', 'z', e.z);
      if (e.k === '@block') html += `<label>Kind<select data-k="b">${SD.blockKinds().map((b) => `<option ${b === e.b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>${num('Width (m)', 'w', e.w, 1.25)}${num('Depth (m)', 'd', e.d, 1.25)}`;
      else html += (e.k[0] === '@' ? '' : num('Height off the floor', 'y', e.y || 0)) + num('Facing (degrees)', 'ryd', deg(e.ry || 0), 5);
      if (e.k === '@log') html += `${num('Height off the floor', 'h', e.h || 0)}<label>Title<input data-k="log.title" value="${esc((e.log || {}).title || '')}"></label><label>Written by<input data-k="log.who" value="${esc((e.log || {}).who || '')}"></label><label>Text<textarea data-k="log.text" rows="7">${esc((e.log || {}).text || '')}</textarea></label>`;
      if (e.k === '@text') html += `<label>Text<textarea data-k="text" rows="2">${esc(e.text || '')}</textarea></label><label>Style<select data-k="style">${['sign', 'paint', 'screen'].map((st) => `<option ${st === e.style ? 'selected' : ''}>${st}</option>`).join('')}</select></label>${num('Width', 'w', e.w)}${num('Text height', 'h', e.h)}${num('Height off the floor', 'ty', e.ty)}<label>Colour<input type="color" data-k="o.color" value="${(e.o && e.o.color) || (e.style === 'paint' ? '#8a0a0a' : e.style === 'screen' ? '#60e8ff' : '#e8e0c8')}"></label>`;
      if (e.k !== '@text' && e.k !== '@log') {
        const keysO = [...new Set([...opts, ...Object.keys(e.o || {})])];
        if (keysO.length) html += `<h5>Options</h5>`;
        const km = SD.kitMeta[e.k] || {}, kd = km.def || {}, kc = km.choices || {};
        for (const k of keysO) {
          const v = (e.o || {})[k], dv = kd[k], cv = v === undefined ? dv : v;
          if (kc[k]) { html += `<label class="xe-opt"><span>${k}</span><select data-k="o.${k}">${kc[k].map((q) => `<option ${q === cv ? 'selected' : ''}>${q}</option>`).join('')}</select></label>`; continue; }
          if (COLORKEYS.has(k) || (typeof cv === 'number' && cv > 255)) html += `<label class="xe-opt"><span>${k}</span><input type="color" data-k="o.${k}" value="${typeof cv === 'number' ? hex(cv) : '#808080'}">${v === undefined ? '<em>default</em>' : `<button data-clear="${k}" title="Back to default">×</button>`}</label>`;
          else if (typeof cv === 'boolean' || ['open', 'lying', 'gun', 'lit', 'burst', 'dead', 'burnt', 'helmets', 'bone', 'spin', 'fire'].includes(k)) html += `<label class="xe-check"><input type="checkbox" data-k="o.${k}" ${cv ? 'checked' : ''}> ${k}</label>`;
          else html += `<label class="xe-opt"><span>${k}</span><input data-k="o.${k}" value="${v === undefined ? '' : esc(v)}" placeholder="${dv === undefined ? 'default' : esc(dv)}"></label>`;
        }
      }
      html += `<div class="xe-row"><button id="xpSeed" title="Same prop, different random details">New variation</button><button id="xpDup">Duplicate</button><button id="xpDel">Delete</button></div>`;
      if (e.nav) html += `<p class="xe-note">Blocks creature paths on ${e.nav.length} cell${e.nav.length === 1 ? '' : 's'} (from where it was placed). Moving it keeps that; turning it by other than quarter turns works the cells out from its shape.</p>`;
      el.innerHTML = html;
      el.querySelector('#xpSeed').onclick = () => { commit(); e.s = (Math.random() * 4294967296) >>> 0; spawnEnt(e); markDirty('dress'); gizmos(); };
      el.querySelector('#xpDup').onclick = duplicate;
      for (const b of el.querySelectorAll('[data-clear]')) b.onclick = () => { commit(); delete e.o[b.dataset.clear]; if (!Object.keys(e.o).length) delete e.o; spawnEnt(e); markDirty('dress'); showProps(); gizmos(); };
    }
    const del = el.querySelector('#xpDel'); if (del) del.onclick = deleteSel;
  }
  // a zone or a trap: its type, size, options, and for a trap where its lever stands
  const optIn = (k, v, dv) => `<label class="xe-opt"><span>${k}</span><input data-k="o.${k}" value="${v === undefined ? '' : esc(v)}" placeholder="${esc(dv === undefined ? 'default' : dv)}"></label>`;
  function zoneTrapProps(el, e) {
    const isZ = e.k === '@zone', T = isZ ? HZ().TYPES[e.zt] : TRP().KINDS[e.tt], o = e.o || {};
    let html = `<h4>${isZ ? 'Zone' : 'Trap'}: ${esc(T ? T.label : '?')}</h4>`;
    if (isZ) html += `<label>Type<select data-k="zt">${HZ().CATS.map((c) => `<optgroup label="${esc(c)}">${Object.entries(HZ().TYPES).filter(([, q]) => q.cat === c).map(([k, q]) => `<option value="${k}" ${k === e.zt ? 'selected' : ''}>${esc(q.label)}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
    else html += `<label>Kind<select data-k="tt">${Object.entries(TRP().KINDS).map(([k, q]) => `<option value="${k}" ${k === e.tt ? 'selected' : ''}>${esc(q.label)}</option>`).join('')}</select></label>`;
    html += `<p class="xe-note">${esc(T ? T.note : '')}</p>` + tagField(e) + num('X', 'x', e.x, 0.25) + num('Z', 'z', e.z, 0.25) + num('Width (m)', 'w', e.w, 0.25) + num('Depth (m)', 'd', e.d, 0.25);
    if (!isZ) {
      html += `<h5>Lever (activator)</h5>${num('Lever X', 'lx', r3(e.lx), 0.25)}${num('Lever Z', 'lz', r3(e.lz), 0.25)}<p class="xe-note">Drag the round handle on the plan, or the lever itself in 3D, to stand it anywhere. Moving the trap brings its lever along.</p>`;
      html += `<h5>Options</h5>${optIn('name', o.name, T ? T.label : '')}${optIn('cost', o.cost, TRP().PRICE[e.tt])}${optIn('time', o.time, TRP().ON[e.tt])}${optIn('cool', o.cool, TRP().COOL)}`;
      if (e.tt === 'tesla') html += optIn('r', o.r, T.r);
      if (e.tt === 'nest') html += num('Facing (degrees)', 'ryd', deg(e.ry || 0), 90);
      html += '<p class="xe-note">cost: points to switch it on · time: seconds it runs · cool: seconds before it can be used again.</p>';
    } else if (T) {
      const keys = Object.keys(T.o); if (keys.length) html += '<h5>Options</h5>';
      for (const k of keys) {
        const v = o[k], dv = T.o[k];
        if (typeof dv === 'boolean') html += `<label class="xe-check"><input type="checkbox" data-k="o.${k}" ${(v === undefined ? dv : v) ? 'checked' : ''}> ${k}</label>`;
        else if (k === 'look') html += `<label class="xe-opt"><span>look</span><select data-k="o.look">${['void', 'glow', 'hidden'].map((q) => `<option ${(v || dv) === q ? 'selected' : ''}>${q}</option>`).join('')}</select></label>`;
        else html += optIn(k, v, dv);
      }
      html += `<label class="xe-check"><input type="checkbox" data-k="o.off" ${o.off ? 'checked' : ''}> starts switched off (a trigger switches it on)</label>`;
      if (e.zt === 'teleport') html += '<div class="xe-row"><button id="xpTgt">Pick the arrival point on the map</button></div>';
      if ('dir' in T.o) html += '<p class="xe-note">dir: 0 pushes towards +z (down the plan), 90 towards +x (right). R turns it with the zone.</p>';
      if (['water', 'shallow', 'lava', 'acid', 'mud', 'quicksand'].includes(e.zt)) html += `<div class="xe-row"><button id="xpSink" title="Lower the floor under the zone into a pit${e.zt === 'water' ? ' as deep as the water' : ''}">Sink the floor under it</button><button id="xpLevel">Level it</button></div>`;
    }
    html += '<div class="xe-row"><button id="xpDup">Duplicate</button><button id="xpDel">Delete</button></div>';
    el.innerHTML = html;
    el.querySelector('#xpDup').onclick = duplicate;
    const tg = el.querySelector('#xpTgt'); if (tg) tg.onclick = () => { pickTarget = e; msg('Click on the map where the teleporter should send you'); };
    const sk = el.querySelector('#xpSink'); if (sk) sk.onclick = () => sinkZone(e, false);
    const lv = el.querySelector('#xpLevel'); if (lv) lv.onclick = () => sinkZone(e, true);
  }
  // ---------------- map tools: tile regions, sinking the floor under a zone, resizing a map of your own ----------------
  let tileSel = null, tileClip = null;
  const selBounds = () => ({ x0: Math.min(tileSel.x0, tileSel.x1), z0: Math.min(tileSel.z0, tileSel.z1), x1: Math.max(tileSel.x0, tileSel.x1), z1: Math.max(tileSel.z0, tileSel.z1) });
  function copyTiles() {
    const b = selBounds(), rows = [], fl = [], hs = [];
    for (let z = b.z0; z <= b.z1; z++) { const r = [], f = [], h = []; for (let q = b.x0; q <= b.x1; q++) { const ok = W.inside(q, z), i = z * W.w + q; r.push(ok ? grid[z][q] : '.'); f.push(ok ? floors[i] : '.'); h.push(ok && !tdir[i] ? th[i] : 0); } rows.push(r); fl.push(f); hs.push(h); }
    tileClip = { w: b.x1 - b.x0 + 1, h: b.z1 - b.z0 + 1, rows, fl, hs }; msg('Copied ' + tileClip.w + ' × ' + tileClip.h + ' cells · Ctrl+V pastes at the cursor (top left), R turns the copy');
  }
  function turnClip() { const c = tileClip, rot = (m) => { const out = []; for (let q = 0; q < c.w; q++) { const r = []; for (let z = c.h - 1; z >= 0; z--) r.push(m[z][q]); out.push(r); } return out; }; tileClip = { w: c.h, h: c.w, rows: rot(c.rows), fl: rot(c.fl), hs: rot(c.hs) }; redraw(); msg('Copy turned'); }
  function pasteTiles(cx, cz) {
    const c = tileClip; commit(); let n = 0;
    for (let z = 0; z < c.h; z++) for (let q = 0; q < c.w; q++) { const x = cx + q, y = cz + z; if (x <= 0 || y <= 0 || x >= W.w - 1 || y >= W.h - 1) continue; grid[y][x] = c.rows[z][q]; const i = y * W.w + x; floors[i] = c.fl[z][q]; th[i] = c.hs[z][q]; tdir[i] = 0; n++; }
    markDirty('grid'); mod.dress = true; if (c.hs.some((r) => r.some((h) => h))) mod.terrain = true; gridDirty = true; rebuild(); msg('Pasted ' + n + ' cells');
  }
  function clearTiles() {
    const b = selBounds(); commit();
    for (let z = Math.max(1, b.z0); z <= Math.min(W.h - 2, b.z1); z++) for (let q = Math.max(1, b.x0); q <= Math.min(W.w - 2, b.x1); q++) { if (tool === 'floor') floors[z * W.w + q] = '.'; else grid[z][q] = '.'; }
    markDirty(tool === 'floor' ? 'dress' : 'grid'); gridDirty = true; rebuild(); msg('Cleared');
  }
  // the floor under a water, lava, acid or mud zone sunk into a pit (the zone's depth for water), or levelled again
  function sinkZone(e, level) {
    const T = HZ().TYPES[e.zt], dep = level ? 0 : e.zt === 'water' ? Math.round(((e.o && e.o.depth) || T.o.depth || 2.5) / 0.25) * 0.25 : e.zt === 'shallow' ? 0.5 : 0.75;
    commit(); let n = 0;
    for (let cz = W.cellZ(e.z - e.d / 2 + 0.3); cz <= W.cellZ(e.z + e.d / 2 - 0.3); cz++) for (let cx = W.cellX(e.x - e.w / 2 + 0.3); cx <= W.cellX(e.x + e.w / 2 - 0.3); cx++) { if (!W.inside(cx, cz) || isWallCh(grid[cz][cx])) continue; const i = cz * W.w + cx; th[i] = -dep; tdir[i] = 0; n++; }
    markDirty('terrain'); gridDirty = true; rebuild(); msg(level ? 'Floor levelled under the zone (' + n + ' cells)' : 'Floor sunk ' + dep + ' m under the zone (' + n + ' cells): swim out, or add a ramp or steps');
  }
  // a map of your own made bigger or smaller: everything on it moves with its cells
  function resizeMap(nw, nh, anchor) {
    const ow = W.w, oh = W.h; nw = Math.max(16, Math.min(100, nw | 0)); nh = Math.max(16, Math.min(100, nh | 0)); if (nw === ow && nh === oh) return;
    const dx = anchor === 'tl' ? 0 : Math.round((nw - ow) / 2), dz = anchor === 'tl' ? 0 : Math.round((nh - oh) / 2);
    const sx = ow * CELL / 2 - nw * CELL / 2 + dx * CELL, sz = oh * CELL / 2 - nh * CELL / 2 + dz * CELL;
    commit();
    const edge = (x, z) => x === 0 || z === 0 || x === nw - 1 || z === nh - 1;
    const ng = [], nf = new Array(nw * nh).fill('.'), nth = new Float32Array(nw * nh), ntd = new Uint8Array(nw * nh), ntr = new Float32Array(nw * nh);
    for (let z = 0; z < nh; z++) { const r = []; for (let x = 0; x < nw; x++) { const ox = x - dx, oz = z - dz, inOld = ox >= 0 && oz >= 0 && ox < ow && oz < oh; let c = inOld ? grid[oz][ox] : '.'; if (edge(x, z) && !isWallCh(c)) c = '#'; r.push(c); if (inOld) { const oi = oz * ow + ox, ni = z * nw + x; nf[ni] = floors[oi] || '.'; nth[ni] = th[oi]; ntd[ni] = tdir[oi]; ntr[ni] = trise[oi]; } } ng.push(r); }
    for (const e of ents) { unspawn(e); e.x = r3(e.x + sx); e.z = r3(e.z + sz); shiftLever(e, sx, sz); if (e.o && e.o.tx !== undefined) { e.o.tx = r3(e.o.tx + sx); e.o.tz = r3(e.o.tz + sz); } }
    for (const l of lights) { l[0] = r3(l[0] + dx); l[1] = r3(l[1] + dz); }
    if (zones || XH.zones.list.length) { zones = clone(zoneRects()); for (const q of zones) { q[1] += dx; q[3] += dx; q[2] += dz; q[4] += dz; } mod.zones = true; }
    for (const c of clear) { c[0] = r3(c[0] + sx); c[1] = r3(c[1] + sz); }
    for (const k in place) { const p = place[k]; if (!p || p.off || p.door !== undefined) continue; if (['building', 'platform', 'grid', 'fan'].includes(k)) { p.x += dx; p.z += dz; } else { if (p.x !== undefined) p.x = r3(p.x + sx); if (p.z !== undefined) p.z = r3(p.z + sz); } }
    grid = ng; floors = nf; th = nth; tdir = ntd; trise = ntr;
    custom.w = nw; custom.h = nh; const nd = E.addCustom(id, custom, gridRows()); if (nd) def = nd;
    mod.grid = mod.dress = mod.lights = mod.place = mod.terrain = true; markDirty('custom');
    gridDirty = true; rebuild(); fitPending = true; showMapPanel(); msg('Map is now ' + nw + ' × ' + nh + ' cells');
  }
  // ---------------- triggers and markers ----------------
  const tagField = (e) => `<label>Name (triggers find it by this)<input data-k="tag" value="${esc(e.tag || '')}" placeholder="none" spellcheck="false"></label>`;
  const allTags = () => [...new Set(ents.filter((q) => q.tag).map((q) => q.tag))].sort();
  let pickTag = null; // an action waiting for its target to be clicked on the map
  function logicProps(el, e) {
    const LGc = LOGIC(), o = e.o || {};
    if (e.k === '@marker') {
      el.innerHTML = `<h4>Marker</h4><label>Kind<select data-k="o.kind">${Object.entries(LGc.MARKERS).map(([k, q]) => `<option value="${k}" ${k === (o.kind || 'point') ? 'selected' : ''}>${esc(q.label)}</option>`).join('')}</select></label>${tagField(e)}${num('X', 'x', e.x, 0.25)}${num('Z', 'z', e.z, 0.25)}
        <p class="xe-note">Named points are where triggers spawn creatures, send the player or set off explosions. Creature spawn points work like vents once the player can reach them; bosses come out of boss spawn points.</p><div class="xe-row"><button id="xpDup">Duplicate</button><button id="xpDel">Delete</button></div>`;
      el.querySelector('#xpDup').onclick = duplicate; return;
    }
    const W0 = LGc.WHEN[o.when || 'enter'] || {}, doorIds = Object.keys(W.doors || {}), tags = allTags(), acts = e.acts || [];
    const sel2 = (key, val, list) => `<select ${key}>${list.map(([v, t2]) => `<option value="${esc(v)}" ${String(v) === String(val === undefined ? '' : val) ? 'selected' : ''}>${esc(t2)}</option>`).join('')}</select>`;
    let html = `<h4>Trigger</h4><label>When${sel2('data-k="o.when"', o.when || 'enter', Object.entries(LGc.WHEN).map(([k, q]) => [k, q.label]))}</label>${tagField(e)}`;
    if (W0.area) html += num('Width (m)', 'w', e.w, 0.25) + num('Depth (m)', 'd', e.d, 0.25);
    if (W0.use) html += `<label class="xe-opt"><span>label</span><input data-k="o.label" value="${esc(o.label || '')}" placeholder="what the prompt says"></label><label class="xe-opt"><span>cost</span><input data-k="o.cost" value="${esc(o.cost || '')}" placeholder="0 points"></label>`;
    if (W0.round) html += `<label class="xe-opt"><span>round</span><input data-k="o.round" value="${esc(o.round || '')}" placeholder="1"></label>`;
    if (W0.count) html += `<label class="xe-opt"><span>kills</span><input data-k="o.count" value="${esc(o.count || '')}" placeholder="50"></label>`;
    html += `<label class="xe-check"><input type="checkbox" data-k="o.once" ${o.once !== false ? 'checked' : ''}> only once</label><label class="xe-opt"><span>delay</span><input data-k="o.delay" value="${esc(o.delay || '')}" placeholder="0 s before it acts"></label>`;
    if (o.once === false) html += `<label class="xe-opt"><span>every</span><input data-k="o.every" value="${esc(o.every || '')}" placeholder="1.5 s at most"></label>`;
    html += `<label class="xe-check"><input type="checkbox" data-k="o.off" ${o.off ? 'checked' : ''}> starts switched off (another trigger switches it on)</label>`;
    html += `<h5>Then</h5>`;
    const targetList = [['', '(pick one)'], ...tags.map((t2) => [t2, '«' + t2 + '»']), ...doorIds.map((d) => [d, 'Door ' + d])];
    const pointList = [['', 'the trigger itself'], ...tags.filter((t2) => ents.some((q) => q.tag === t2 && q.k === '@marker')).map((t2) => [t2, '«' + t2 + '»'])];
    acts.forEach((a2, i) => {
      const D = LGc.DO[a2.a] || {}, at = (f) => `data-act="${i}" data-f="${f}"`;
      html += `<div class="xe-act"><div class="xe-row"><b>${i + 1}</b>${sel2(at('a'), a2.a, Object.entries(LGc.DO).map(([k, q]) => [k, q.label]))}<button data-act-del="${i}" title="Remove">×</button></div>`;
      if (D.target) html += `<div class="xe-row"><span>what</span>${sel2(at('t'), a2.t, a2.a === 'fire' ? targetList.filter(([v]) => !v || ents.some((q) => q.tag === v && q.k === '@trigger')) : D.doors ? targetList : targetList.filter(([v]) => !doorIds.includes(v)))}<button data-act-pick="${i}" title="Click a piece on the map">pick</button></div>`;
      if (D.creature) html += `<div class="xe-row"><span>what</span>${sel2(at('type'), a2.type || 'skitterling', LGc.CREATURES().map((k) => [k, (XH.enemies.TYPES[k] || {}).name || k]))}<span>how many</span><input ${at('n')} value="${esc(a2.n || 4)}" style="width:48px"></div>`;
      if (D.boss) html += `<div class="xe-row"><span>which</span>${sel2(at('type'), a2.type || '', [['', 'the map\'s own'], ...LGc.BOSSES().map((k) => [k, (XH.enemies.TYPES[k] || {}).name || k])])}</div>`;
      if (D.at) html += `<div class="xe-row"><span>where</span>${sel2(at('at'), a2.at || '', pointList)}</div>`;
      if (D.text) html += `<div class="xe-row"><input ${at('text')} value="${esc(a2.text || '')}" placeholder="${a2.a === 'win' ? 'AREA SECURED' : 'Big text'}" style="flex:1"></div><div class="xe-row"><input ${at('sub')} value="${esc(a2.sub || '')}" placeholder="smaller text under it" style="flex:1"></div>`;
      if (D.sound) html += `<div class="xe-row"><span>sound</span>${sel2(at('sound'), a2.sound || LGc.SOUNDS[0], LGc.SOUNDS.map((q) => [q, q]))}</div>`;
      if (D.n && !D.creature) html += `<div class="xe-row"><span>${a2.a === 'points' ? 'points' : a2.a === 'explode' ? 'radius' : 'strength'}</span><input ${at('n')} value="${esc(a2.n === undefined ? D.n : a2.n)}" style="width:64px"></div>`;
      html += `<div class="xe-row"><span>after</span><input ${at('delay')} value="${esc(a2.delay || '')}" placeholder="0" style="width:48px"><em>s</em></div></div>`;
    });
    html += `<div class="xe-row"><button id="xpActAdd">+ Add what happens</button></div><p class="xe-note">Name a zone, trap, moving piece, trigger or marker (Name field) and it shows up here. Doors are the map's doors by number.</p><div class="xe-row"><button id="xpDup">Duplicate</button><button id="xpDel">Delete</button></div>`;
    el.innerHTML = html;
    el.querySelector('#xpDup').onclick = duplicate;
    el.querySelector('#xpActAdd').onclick = () => { commit(); e.acts = e.acts || []; e.acts.push({ a: e.acts.length ? 'message' : 'spawn', type: 'skitterling', n: 4 }); markDirty('dress'); showProps(); };
    for (const b of el.querySelectorAll('[data-act-del]')) b.onclick = () => { commit(); e.acts.splice(+b.dataset.actDel, 1); markDirty('dress'); showProps(); };
    for (const b of el.querySelectorAll('[data-act-pick]')) b.onclick = () => { pickTag = { e, i: +b.dataset.actPick }; msg('Click the piece this should act on (a door, zone, trap, moving piece, trigger or marker)'); };
  }
  // the target picked for an action: a door, or a piece (given a name if it has none)
  function takePick(ev) {
    const q = pickTag; pickTag = null; const a2 = q.e.acts[q.i]; if (!a2) return;
    const cx = W.cellX(ev.x), cz = W.cellZ(ev.z), ch = W.inside(cx, cz) ? grid[cz][cx] : '';
    commit();
    if (ch >= '0' && ch <= '9') { a2.t = ch; markDirty('dress'); showProps(); msg('Door ' + ch); return; }
    const c = pickAll(ev).find((p) => p.t === 'ent' && p.e !== q.e) || pickAll(ev).find((p) => p.t === 'lever');
    if (!c) { msg('Nothing to act on there', true); undo.pop(); return; }
    const t2 = c.e; if (!t2.tag) { const base = t2.k === '@zone' ? t2.zt : t2.k === '@trap' ? t2.tt : t2.k === '@trigger' ? 'trigger' : t2.k === '@marker' ? 'point' : t2.k; let n = 1; while (ents.some((z2) => z2.tag === base + n)) n++; t2.tag = base + n; }
    a2.t = t2.tag; if (LOGIC().DO[a2.a] && LOGIC().DO[a2.a].at && t2.k === '@marker') { a2.at = t2.tag; }
    markDirty('dress'); showProps(); msg('Linked to «' + t2.tag + '»');
  }
  // property edits apply when a field is changed (Enter, Tab or leaving it)
  $('xeProps').addEventListener('change', (ev) => {
    const inp = ev.target, k = inp.dataset.k || ''; if ((!k && inp.dataset.act === undefined) || sel.length !== 1) return;
    const s = sel[0], raw = inp.type === 'checkbox' ? inp.checked : inp.value;
    const numv = (v) => (v === '' ? undefined : parseFloat(v));
    commit();
    if (s.t === 'light') {
      const l = lights[s.i], n = +k.slice(1);
      if (n === 2) l[2] = parseInt(raw.slice(1), 16); else if (n === 6) { if (raw) l.length > 6 && l.splice(6, 1); else { while (l.length < 6) l.push(null); l[6] = 0; } } else if (n === 5) { const v = numv(raw); if (v === undefined) { if (l.length > 5) l[5] = null; } else { while (l.length < 5) l.push(0); l[5] = v; } } else l[n] = numv(raw) || 0;
      while (l.length > 5 && (l[l.length - 1] === null || l[l.length - 1] === undefined)) l.pop();
      markDirty('lights'); lightLive(s.i); gizmos(); if (n === 6 || n === 5) rebuildSoon();
      return;
    }
    if (s.t === 'clear') { clear[s.i][+k.slice(1)] = numv(raw) || 0; markDirty(); gizmos(); rebuildSoon(); return; }
    if (s.t === 'piece') { const pc = pieces.find((q) => q.key === s.i); if (!pc) return; const pin = pinFor(pc, k === 'px' ? numv(raw) || 0 : pc.x, k === 'pz' ? numv(raw) || 0 : pc.z); if (pin) { place[pc.key] = pin; markDirty('place'); rebuild(); } return; }
    if (s.t === 'tile') {
      const cx = s.i % W.w, cz = (s.i / W.w) | 0, ch = grid[cz][cx];
      if (k === 'tch') { grid[cz][cx] = raw; markDirty('grid'); rebuild(); showProps(); }
      else if (k === 'tbuy') { buys[ch] = raw; markDirty('buys'); rebuildSoon(); }
      else if (k === 'tdname' || k === 'tdcost') { doors[ch] = doors[ch] || { cost: 1000, name: 'Door ' + ch }; if (k === 'tdname') doors[ch].name = raw; else doors[ch].cost = numv(raw) || 0; markDirty('doors'); rebuildSoon(); }
      return;
    }
    if (s.t === 'zone') { if (!zones) zones = clone(zoneRects()); const q = zones[s.i], n = +k.slice(1); q[n] = n === 0 ? String(raw).trim() || 'Room' : Math.round(numv(raw) || 0); markDirty('zones'); rebuildSoon(); return; }
    const e = s.e;
    if (inp.dataset.act !== undefined) { const i = +inp.dataset.act, f = inp.dataset.f, a2 = (e.acts || [])[i]; if (!a2) return; const v = ['n', 'delay'].includes(f) ? (raw === '' ? undefined : +raw) : raw; if (v === undefined || v === '') delete a2[f]; else a2[f] = v; markDirty('dress'); if (f === 'a') showProps(); return; }
    if (k === 'ryd') { const by = (numv(raw) || 0) * Math.PI / 180 - (e.ry || 0); rotNav(e, by); e.ry = r3((numv(raw) || 0) * Math.PI / 180); }
    else if (k.startsWith('o.')) { const ok = k.slice(2); e.o = e.o || {}; if (inp.type === 'color') e.o[ok] = e.k === '@text' ? raw : parseInt(raw.slice(1), 16); else if (inp.type === 'checkbox') e.o[ok] = raw; else if (raw === '') delete e.o[ok]; else e.o[ok] = isNaN(+raw) ? raw : +raw; if (!Object.keys(e.o).length) delete e.o; }
    else if (k.startsWith('log.')) { e.log = e.log || {}; e.log[k.slice(4)] = raw; }
    else if (k === 'tag') { const v = String(raw).trim().replace(/[^\w\- ]/g, '').slice(0, 24); if (v) e.tag = v; else delete e.tag; showProps(); }
    else if (['text', 'style', 'b', 'zt', 'tt'].includes(k)) { e[k] = raw; if (k === 'zt' || k === 'tt') delete e.o; if (k === 'tt') { const K = TRP().KINDS[raw]; if (K) { e.w = K.w; e.d = K.d; } } if (k === 'zt' && raw === 'teleport') e.o = { tx: r3(e.x + 10), tz: e.z }; }
    else { const v = numv(raw); if (v !== undefined) { if (e.k === '@trap' && (k === 'x' || k === 'z')) shiftLever(e, k === 'x' ? v - e.x : 0, k === 'z' ? v - e.z : 0); e[k] = r3(v); } }
    spawnEnt(e); markDirty('dress'); gizmos(); if (e.k === '@block') rebuildSoon();
    if (k === 'b' || k === 'style' || k === 'zt' || k === 'tt' || k === 'o.when' || k === 'o.once' || k === 'o.kind') { showProps(); renderAssets(); }
  });

  // ---------------- map settings ----------------
  function showMapPanel() {
    const el = $('xeMapPanel'); if (!def) return;
    const dk = [...new Set(grid.flat().filter((c) => c >= '0' && c <= '9'))].sort(), bk = [...new Set(grid.flat().filter((c) => c >= 'a' && c <= 'w'))].sort();
    const guns = Object.entries(XH.weapons.DEFS).filter(([, d]) => d.cost && !d.wonder).map(([k, d]) => [k, d.name]);
    const fog = look.fog || {}, amb = look.ambient || {}, moon = look.moon || {};
    const mine = custom ? `<h5>Your map</h5><label>Name<input data-cm="name" value="${esc(custom.name)}" maxlength="40" spellcheck="false"></label>
      <label>Look (lighting, sky, weather, music, props and creatures of)<select data-cm="base">${arenas().map((m) => `<option value="${m.id}" ${m.id === custom.base ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <div class="xe-row"><span>Size</span><input id="xmW" type="number" value="${W.w}" min="16" max="100" style="width:62px"><span>×</span><input id="xmH" type="number" value="${W.h}" min="16" max="100" style="width:62px"><select id="xmA"><option value="c">grow round the middle</option><option value="tl">grow right and down</option></select><button id="xmResize">Resize</button></div>
      <label class="xe-check"><input type="checkbox" data-cm="clutter" ${custom.clutter ? 'checked' : ''}> Theme clutter (the arena's own scattered rocks, crates, pipes...)</label>
      <p class="xe-note">${W.w} × ${W.h} cells. Saved as mapedits/${esc(id)}.json; once saved it is in the game's arena list.${custom.from ? " Copied from the game's map maker, which keeps its own copy." : ''}</p>` : '';
    el.innerHTML = `<h4>${esc(def.name)}</h4><p class="xe-note">${esc(def.sub || '')}</p>${mine}
      <h5>Doors</h5>${dk.length ? dk.map((d) => { const q = doors[d] || {}; return `<div class="xe-door"><b>${d}</b><input data-door="${d}" data-f="name" value="${esc(q.name || '')}" placeholder="Name"><input type="number" data-door="${d}" data-f="cost" value="${q.cost || 0}" step="250"></div>`; }).join('') : '<p class="xe-note">No doors on this map.</p>'}
      <h5>Wall guns</h5>${bk.length ? bk.map((b) => `<div class="xe-door"><b>${b}</b><select data-buy="${b}">${guns.map(([k, n]) => `<option value="${k}" ${buys[b] === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`).join('') : '<p class="xe-note">No wall guns on this map.</p>'}
      <h5>Look</h5>
      <label>Fog colour<input type="color" data-look="fog.color" value="${hex(fog.color || 0)}"></label>${`<label>Fog density<input type="number" data-look="fog.density" value="${fog.density || 0}" step="0.002"></label>`}
      <label>Sky light<input type="color" data-look="ambient.sky" value="${hex(amb.sky || 0)}"></label><label>Ground light<input type="color" data-look="ambient.ground" value="${hex(amb.ground || 0)}"></label>
      <label>Ambient strength<input type="number" data-look="ambient.i" value="${amb.i || 0}" step="0.05"></label>
      ${look.moon ? `<label>Moonlight<input type="color" data-look="moon.color" value="${hex(moon.color || 0)}"></label><label>Moon strength<input type="number" data-look="moon.i" value="${moon.i || 0}" step="0.05"></label>` : ''}
      <label>Glow threshold (higher = less bloom)<input type="number" data-look="bloomT" value="${look.bloomT || 0.72}" step="0.02" min="0" max="1"></label>
      ${custom ? `<h5>Game pieces</h5><p class="xe-note">${GAME_PIECES.filter((q) => place[q[0]] && !place[q[0]].off).map((q) => esc(q[1])).join(', ') || 'None yet'}. Add them from Assets › Game pieces; nothing places itself on a map of your own.</p>` : `<h5>Generated pieces</h5>${Object.keys(place).filter((k) => place[k] && place[k].off).map((k) => `<div class="xe-door"><span>${esc(k)} (left out)</span><button data-restore="${esc(k)}">Put back</button></div>`).join('') || '<p class="xe-note">None left out.</p>'}
      <p class="xe-note">${Object.keys(place).filter((k) => !place[k].off).length} placed by hand. Pink outlines in the plan are the generated pieces: drag them to move them.</p>`}
      ${wavesHtml()}
      <h5>Testing</h5><label class="xe-check"><input type="checkbox" data-test="god" ${testOpts.god ? 'checked' : ''}> God mode in ▶ Here</label><label class="xe-opt"><span>round</span><input data-test="round" value="${testOpts.round}" style="width:60px"></label>
      <p class="xe-note">▶ Here (top bar, or Ctrl+Enter) saves, then plays the map from where the 3D camera is, facing the way it faces.</p>
      <h5>Checks</h5><div id="xeChecks"></div>`;
    checks();
    const rb = el.querySelector('#xmResize'); if (rb) rb.onclick = () => resizeMap(+el.querySelector('#xmW').value, +el.querySelector('#xmH').value, el.querySelector('#xmA').value);
  }
  $('xeMapPanel').addEventListener('click', (ev) => { const b = ev.target.closest('[data-restore]'); if (!b) return; commit(); delete place[b.dataset.restore]; markDirty('place'); rebuild(); showMapPanel(); msg('Put back'); });
  $('xeMapPanel').addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.test) { testOpts[t.dataset.test] = t.type === 'checkbox' ? t.checked : Math.max(1, Math.min(60, parseInt(t.value, 10) || 1)); try { localStorage.setItem('xedit.test', JSON.stringify(testOpts)); } catch (e) { /* none */ } return; }
    if (t.dataset.wave) {
      commit(); waves = waves || {}; const [a, b] = t.dataset.wave.split('.'), v = t.tagName === 'SELECT' ? t.value : t.value === '' ? undefined : +t.value;
      if (b) { waves[a] = waves[a] || {}; if (v === undefined || (typeof v === 'number' && isNaN(v))) delete waves[a][b]; else waves[a][b] = v; if (!Object.keys(waves[a]).length) delete waves[a]; }
      else if (v === undefined || v === 'auto' || (typeof v === 'number' && isNaN(v))) delete waves[a]; else waves[a] = v;
      if (!Object.keys(waves).length) waves = null;
      markDirty('waves'); E.live[id] = liveDoc(); msg('Waves updated (they take effect in play)'); return;
    }
    commit();
    if (t.dataset.cm && custom) {
      if (t.dataset.cm === 'clutter') { custom.clutter = t.checked || undefined; if (!custom.clutter) delete custom.clutter; def.customMeta = clone(custom); markDirty('custom'); rebuild(); msg(t.checked ? 'Theme clutter on' : 'Theme clutter off'); return; }
      if (t.dataset.cm === 'name') { custom.name = t.value.trim() || 'Custom Arena'; def.name = custom.name; def.customMeta = clone(custom); markDirty('custom'); fillMaps(); showMapPanel(); return; }
      custom.base = t.value; const nd = E.addCustom(id, custom, gridRows());
      if (nd) { def = nd; look = {}; for (const k of lookKeys) if (def[k] !== undefined) look[k] = clone(def[k]); mod.look = false; }
      markDirty('custom'); rebuild(); showMapPanel(); msg('Now in the style of ' + (XH.MAPS.find((m) => m.id === custom.base) || {}).name); return;
    }
    if (t.dataset.door) { const d = t.dataset.door; doors[d] = doors[d] || { cost: 1000, name: 'Door ' + d }; doors[d][t.dataset.f] = t.dataset.f === 'cost' ? +t.value : t.value; markDirty('doors'); rebuildSoon(); return; }
    if (t.dataset.buy) { buys[t.dataset.buy] = t.value; markDirty('buys'); rebuildSoon(); return; }
    if (t.dataset.look) {
      const [a, b] = t.dataset.look.split('.'), v = t.type === 'color' ? parseInt(t.value.slice(1), 16) : +t.value;
      if (b) { look[a] = Object.assign({}, look[a] || {}); look[a][b] = v; } else look[a] = v;
      markDirty('look'); rebuildSoon();
    }
  });
  function checks() {
    const el = $('xeChecks'); if (!el) return;
    const flat = grid.flat(), n = (c) => flat.filter((q) => q === c).length, out = [];
    out.push(n('P') === 1 ? ['ok', 'One player start'] : ['bad', n('P') + ' player starts (needs exactly one)']);
    out.push(n('S') >= 2 ? ['ok', n('S') + ' spawn vents'] : ['bad', 'Only ' + n('S') + ' spawn vents (needs two or more)']);
    for (const d of new Set(flat.filter((c) => c >= '0' && c <= '9'))) if (!doors[d]) out.push(['bad', 'Door ' + d + ' has no price']);
    for (const b of new Set(flat.filter((c) => c >= 'a' && c <= 'w'))) if (!buys[b]) out.push(['bad', 'Wall gun ' + b + ' has no gun']);
    el.innerHTML = out.map(([k, t2]) => `<div class="xe-chk ${k}">${k === 'ok' ? '✓' : '!'} ${esc(t2)}</div>`).join('');
  }

  // ---------------- open, save, test ----------------
  const api = (path, body) => fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Token': TOKEN, 'Content-Type': 'application/json' }, body }).then((r) => { if (!r.ok) return r.text().then((t2) => { throw new Error(t2 || r.status); }); return r.json(); });
  let online = false;
  function ping() { api('/api/ping').then(() => { if (!online) { online = true; msg('Connected to the editor'); } }).catch(() => { if (online || !TOKEN) msg('Not connected to XenoholdEditor.exe: saving is off', true); online = false; }); }
  setInterval(ping, 5000); ping();

  function open(mapId) {
    const d = XH.MAPS.find((m) => m.id === mapId); if (!d) return;
    def = d; id = mapId; sel = []; undo.length = 0; redo.length = 0; mod = {}; dirty = false; custom = d.customMeta ? clone(d.customMeta) : null;
    const saved = clone(E.saved(id)) || {};
    msg('Loading ' + d.name + '...');
    // the map as it would be generated (this also settles its lights and doors), with the saved parts on top
    const base = { grid: saved.grid, def: saved.def, zones: saved.zones, clear: saved.clear, place: saved.place, terrain: saved.terrain };
    const gen = generate(base);
    grid = XH.MAPGRIDS[id].map((r) => r.split(''));
    const dress = saved.dress || gen;
    ents = clone(dress.entities || []); floors = (dress.floors || '').split(''); if (floors.length !== W.w * W.h) floors = new Array(W.w * W.h).fill('.');
    lights = clone(Array.isArray(def.lights) ? def.lights : []); doors = clone(def.doors || {}); buys = clone(def.buys || {});
    look = {}; for (const k of lookKeys) if (def[k] !== undefined) look[k] = clone(def[k]);
    zones = saved.zones || null; clear = saved.clear || []; place = saved.place || {}; loadTerrain(saved.terrain);
    waves = clone(def.waves) || null; if (saved.def && saved.def.waves) mod.waves = true;
    if (saved.place) mod.place = true; if (saved.terrain) mod.terrain = true;
    if (saved.grid) mod.grid = true; if (saved.dress) mod.dress = true; if (saved.zones) mod.zones = true;
    for (const k of ['lights', 'doors', 'buys']) if (saved.def && saved.def[k]) mod[k] = true;
    if (saved.def && lookKeys.some((k) => saved.def[k] !== undefined)) mod.look = true;
    if (custom) mod.grid = true;
    rebuild();
    // start looking at the player start from above
    const s = W.start || new THREE.Vector3();
    P.cam.position.set(s.x, 16, s.z + 14); lookAt(s.x, 0, s.z);
    view.x = 0; view.z = 0; fitPending = true; fitPlan();
    $('xeMap').value = id; showState(); showProps(); if (!$('xeMapPanel').classList.contains('hidden')) showMapPanel();
    $('xeRevert').textContent = custom ? 'Delete map' : 'Revert';
    $('xeRevert').title = custom ? 'Delete this map of yours (a copy is kept in mapedits/backup)' : "Delete this map's saved edits and go back to how it shipped";
    $('xeRegen').disabled = !!custom; $('xeRegen').title = custom ? 'Your own maps have no story to dress them from: place props by hand' : "Throw away the placed dressing and generate it again from the map's story";
    try { localStorage.setItem('xedit.map', id); } catch (e) { /* none */ }
    renderAssets();
    msg(d.name + (E.saved(id) ? ' (with your saved edits)' : '') + ' · ' + ents.length + ' props');
  }
  function save() {
    if (!def) return Promise.resolve(false);
    const doc = savedDoc(), empty = Object.keys(doc).length === 1;
    const req = empty ? api('/api/revert?map=' + id, '{}') : api('/api/save?map=' + id, pretty(doc));
    return req.then(() => { if (empty) delete XH.MAPEDITS[id]; else XH.MAPEDITS[id] = clone(doc); dirty = false; showState(); fillMaps(); msg('Saved ' + def.name + (custom ? " · it is in the game's arena list next time the game starts" : ' · the game picks it up next time it starts')); return true; })
      .catch((err) => { msg('Could not save: ' + err.message, true); return false; });
  }
  function savePrefab(name) {
    const list = selEnts(); if (!list.length) return;
    if (!name) { msg('Give the group a name', true); return; }
    const cx = list.reduce((s, e) => s + e.x, 0) / list.length, cz = list.reduce((s, e) => s + e.z, 0) / list.length;
    const p = { name, ents: list.map((e) => { const c = strip(e); c.x = r3(c.x - cx); c.z = r3(c.z - cz); shiftLever(c, -cx, -cz); delete c.nav; delete c.s; return c; }) };
    prefabs = prefabs.filter((q) => q.name !== name).concat([p]);
    api('/api/prefabs', JSON.stringify({ prefabs }, null, 1)).then(() => { msg('Saved group ' + name); renderAssets(); }).catch((err) => msg('Could not save the group: ' + err.message, true));
  }
  fetch('mapedits/_prefabs.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.prefabs) { prefabs = j.prefabs; renderAssets(); } }).catch(() => {});

  // ---------------- your own maps ----------------
  // Maps made here (New map) or copied from the game's own map maker (main menu > Map Editor). That one keeps its maps
  // in the game's browser storage, which this page cannot see; XenoholdEditor.exe reads them for it (/api/gamemaps).
  let custom = null, gameMaps = [];
  const newMapId = () => 'custom_' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const isMine = (m) => m.custom && m.customMeta;
  const arenas = () => XH.MAPS.filter((m) => !m.custom);
  function fillMaps() {
    const opt = (v, t2, extra = '') => `<option value="${esc(v)}"${extra}>${esc(t2)}</option>`;
    const mine = XH.MAPS.filter(isMine), copied = new Set(mine.map((m) => m.customMeta.from).filter(Boolean));
    const fresh = gameMaps.filter((g) => !copied.has(g.id));
    let html = `<optgroup label="Arenas">${arenas().map((m) => opt(m.id, m.name + (XH.MAPEDITS[m.id] ? ' ✎' : ''))).join('')}</optgroup>`;
    html += `<optgroup label="Your maps">${mine.length ? mine.map((m) => opt(m.id, m.name + (XH.MAPEDITS[m.id] ? '' : ' (not saved yet)'))).join('') : opt('', 'None yet: + New map makes one', ' disabled')}</optgroup>`;
    if (fresh.length) html += `<optgroup label="In the game's map maker (pick one to copy it here)">${fresh.map((g) => opt('game:' + g.id, (g.name || 'My Arena') + ' · ' + g.w + '×' + g.h)).join('')}</optgroup>`;
    $('xeMap').innerHTML = html; if (id) $('xeMap').value = id;
  }
  function loadGameMaps(announce) {
    if (!TOKEN) return;
    api('/api/gamemaps').then((j) => {
      gameMaps = (j && Array.isArray(j.maps) ? j.maps : []).filter((g) => g && typeof g.id === 'string' && Array.isArray(g.rows) && g.rows.length > 4);
      fillMaps();
      const n = $('xeMap').querySelectorAll('option[value^="game:"]').length;
      if (announce && n) msg('Found ' + n + ' map' + (n > 1 ? 's' : '') + " made in the game's map maker: pick one at the bottom of the map list to copy it here");
    }).catch(() => {});
  }
  // a map of your own: into the list and open (Save writes it to mapedits/<id>.json)
  function startCustom(c, rows, note) {
    const nid = newMapId();
    if (!E.addCustom(nid, c, rows)) { msg('That map could not be read', true); return; }
    fillMaps(); open(nid); markDirty('grid'); msg(note);
  }
  // starting layouts for a new map
  function layoutRows(kind, w, h) {
    const g = [];
    for (let z = 0; z < h; z++) { const r = []; for (let x = 0; x < w; x++) r.push(x === 0 || z === 0 || x === w - 1 || z === h - 1 ? '#' : '.'); g.push(r); }
    const put = (x, z, c) => { if (x > 0 && z > 0 && x < w - 1 && z < h - 1) g[z][x] = c; };
    const mx = w >> 1, mz = h >> 1;
    if (kind === 'rooms') {
      for (let z = 1; z < h - 1; z++) g[z][mx] = '#';
      for (let x = 1; x < w - 1; x++) g[mz][x] = '#';
      const qz = mz >> 1, qx = mx >> 1, qx2 = mx + ((w - mx) >> 1);
      g[qz][mx] = g[qz + 1][mx] = '1'; // top left to top right
      g[mz][qx] = g[mz][qx + 1] = '2'; // top left to bottom left
      g[mz][qx2] = g[mz][qx2 + 1] = '3'; // top right to bottom right
      put(qx, qz, 'P'); put(qx + 2, qz + 2, 'J');
      for (const [x, z] of [[2, 2], [mx - 3, mz - 3], [mx + 2, 2], [w - 3, mz - 3], [2, mz + 2], [mx - 3, h - 3], [mx + 2, mz + 2], [w - 3, h - 3]]) put(x, z, 'S');
      g[0][qx - 1] = 'a'; g[0][qx2] = 'b'; g[h - 1][qx2] = 'c';
      put(qx2, mz + ((h - mz) >> 1), 'M');
    } else {
      put(mx, mz, 'P'); put(mx + 3, mz, 'J'); put(mx, mz + 3, 'M');
      for (const [x, z] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) put(x, z, 'S');
      g[0][mx - 2] = 'a'; g[h - 1][mx + 2] = 'b';
    }
    return g.map((r) => r.join(''));
  }
  // the New map dialog
  const nb = document.createElement('div'); nb.className = 'xe-help hidden'; nb.id = 'xeNewBox';
  nb.innerHTML = `<div class="xe-newmap">
    <h3>New map</h3>
    <label>Name<input id="xnName" value="New Arena" maxlength="40" spellcheck="false"></label>
    <label>Look: the lighting, sky, weather, music, props and creatures of<select id="xnBase">${arenas().map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label>
    <label>Start from<select id="xnLayout"><option value="empty">An empty arena: walls round the edge, a start, four vents</option><option value="rooms">Four rooms joined by doors</option><option value="copy">A copy of that map's own layout</option></select></label>
    <div class="xe-row" id="xnSizes"><span>Size</span>${[[24, 20, 'Small'], [36, 28, 'Medium'], [50, 40, 'Large'], [64, 52, 'Huge']].map(([w, h, n]) => `<button data-w="${w}" data-h="${h}" class="${w === 36 ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="xe-row"><label class="xe-inline">Width<input type="number" id="xnW" value="36" min="16" max="100"></label><label class="xe-inline">Depth<input type="number" id="xnH" value="28" min="16" max="100"></label><em>cells (2.5 m each)</em></div>
    <p class="xe-note">Your own maps are saved in mapedits/ with the arenas' edits. Once saved they are in the game's arena list, and Test plays them straight away. Everything in the editor works on them: tiles, height and ramps, props, zones, traps, lights and rooms.</p>
    <div class="xe-row"><button id="xnCreate" class="on">Create map</button><button id="xnCancel">Cancel</button></div></div>`;
  root.appendChild(nb);
  const newBox = (on) => { nb.classList.toggle('hidden', !on); if (on) { $('xnBase').value = custom ? custom.base : id && !def.custom ? id : $('xnBase').value; setTimeout(() => { $('xnName').focus(); $('xnName').select(); }, 0); } };
  const sizeFields = () => { const copy = $('xnLayout').value === 'copy'; for (const q of ['xnW', 'xnH']) $(q).disabled = copy; nb.querySelectorAll('#xnSizes button').forEach((b) => { b.disabled = copy; }); };
  nb.addEventListener('click', (e) => {
    if (e.target === nb) { newBox(false); return; }
    const b = e.target.closest('#xnSizes button'); if (!b) return;
    $('xnW').value = b.dataset.w; $('xnH').value = b.dataset.h; nb.querySelectorAll('#xnSizes button').forEach((q) => q.classList.toggle('on', q === b));
  });
  $('xnLayout').addEventListener('change', sizeFields);
  $('xnCancel').onclick = () => newBox(false);
  $('xnCreate').onclick = () => {
    if (dirty && !confirm('Leave ' + def.name + ' without saving your changes?')) return;
    const base = $('xnBase').value, kind = $('xnLayout').value, name = $('xnName').value.trim() || 'New Arena';
    const size = (v) => Math.max(16, Math.min(100, Math.round(+v) || 36));
    const rows = kind === 'copy' ? ((E.get(base) && E.get(base).grid) || E.orig[base].grid).slice() : layoutRows(kind, size($('xnW').value), size($('xnH').value));
    newBox(false);
    startCustom({ name, base, w: rows[0].length, h: rows.length }, rows, 'New map "' + name + '" (' + rows[0].length + ' × ' + rows.length + ') · paint it with the Tiles tool, then Save (Ctrl+S)');
  };
  $('xeNew').onclick = () => { newBox(true); loadGameMaps(false); };
  fillMaps(); setTimeout(() => loadGameMaps(true), 1500);
  $('xeMap').addEventListener('change', (e) => {
    const nid = e.target.value;
    if (dirty && !confirm('Leave ' + def.name + ' without saving your changes?')) { e.target.value = id; return; }
    if (nid.startsWith('game:')) {
      const g = gameMaps.find((q) => 'game:' + q.id === nid); if (!g) return;
      startCustom({ name: g.name || 'My Arena', base: g.base, w: g.w, h: g.h, from: g.id }, g.rows, 'Copied "' + (g.name || 'My Arena') + "\" from the game's map maker · Save (Ctrl+S) to keep it here");
      return;
    }
    open(nid);
  });
  $('xeSave').onclick = save;
  const help = (on) => $('xeHelpBox').classList.toggle('hidden', !on);
  $('xeHelp').onclick = () => help(true); $('xeHelpClose').onclick = () => help(false); $('xeHelpBox').onclick = (e) => { if (e.target.id === 'xeHelpBox') help(false); };
  $('xeUndo').onclick = doUndo; $('xeRedo').onclick = doRedo;
  $('xeView').onclick = () => setLayout(layout === 'split' ? '3d' : layout === '3d' ? '2d' : 'split');
  $('xePower').onclick = () => { power = !power; W.setPower(power, true); settle = 3; redraw(); lights.forEach((l, i) => lightLive(i)); $('xePower').textContent = power ? 'Power on' : 'Power off'; };
  $('xeRebuild').onclick = () => { rebuild(); msg('Rebuilt'); };
  $('xeLive').onclick = () => { live = !live; $('xeLive').classList.toggle('on', live); redraw(); msg(live ? 'Live: the scene animates' : 'Still: the view only redraws when something changes'); };
  // test settings (kept in this browser): god mode and the round to start on
  const testOpts = (() => { try { return Object.assign({ god: true, round: 1 }, JSON.parse(localStorage.getItem('xedit.test') || '{}')); } catch (e) { return { god: true, round: 1 }; } })();
  // the map's waves in the Map tab
  function wavesHtml() {
    const wv = waves || {}, sp = wv.species || {}, DEF = { skitterling: 1, lancer: 3, burster: 4, shrieker: 6, behemoth: 7, burrower: 9, broodmother: 10, drowner: 3, unique: 3 };
    const nm = (k) => (k === 'unique' ? "The map's own creature" : k === 'drowner' ? 'Drowner (deep water only)' : (XH.enemies.TYPES[k] || {}).name || k);
    const bosses = LOGIC().BOSSES();
    return `<h5>Waves</h5><p class="xe-note">The round each kind first comes in (0 never, blank the game's own choice).</p><div class="xe-waves">${Object.keys(DEF).map((k) => `<label class="xe-opt"><span>${esc(nm(k))}</span><input data-wave="species.${k}" value="${sp[k] === undefined ? '' : sp[k]}" placeholder="${DEF[k]}"></label>`).join('')}</div>
      <label class="xe-opt"><span>Boss every</span><input data-wave="bossEvery" value="${wv.bossEvery === undefined ? '' : wv.bossEvery}" placeholder="8 rounds (0 none)"></label>
      <label class="xe-opt"><span>Boss</span><select data-wave="boss"><option value="auto">the map's own</option>${bosses.map((b) => `<option value="${b}" ${wv.boss === b ? 'selected' : ''}>${esc((XH.enemies.TYPES[b] || {}).name || b)}</option>`).join('')}</select></label>
      <label class="xe-opt"><span>Swarm every</span><input data-wave="swarmEvery" value="${wv.swarmEvery === undefined ? '' : wv.swarmEvery}" placeholder="5 rounds (0 none)"></label>
      <label class="xe-opt"><span>How many ×</span><input data-wave="count" value="${wv.count === undefined ? '' : wv.count}" placeholder="1"></label>
      <label class="xe-opt"><span>How fast ×</span><input data-wave="rate" value="${wv.rate === undefined ? '' : wv.rate}" placeholder="1"></label>
      <label class="xe-opt"><span>At once ×</span><input data-wave="alive" value="${wv.alive === undefined ? '' : wv.alive}" placeholder="1"></label>
      <p class="xe-note">Boss spawn points and extra creature spawn points are markers (Assets › Logic).</p>`;
  }
  // play from where the 3D camera is
  function playHere() {
    let x = P.cam.position.x, z = P.cam.position.z;
    // the nearest open floor to the camera
    let best = null, bd = 1e9; for (let cz = 0; cz < W.h; cz++) for (let cx = 0; cx < W.w; cx++) { const i = cz * W.w + cx; if (W.solid[i]) continue; const d = Math.hypot(W.cx2x(cx) - x, W.cz2z(cz) - z); if (d < bd) { bd = d; best = [cx, cz]; } }
    if (best && W.solidAt(x, z, 0.4, W.floorAt(x, z), 0)) { x = W.cx2x(best[0]); z = W.cz2z(best[1]); }
    const url = 'index.html?play=' + id + '&at=' + r3(x) + ',0,' + r3(z) + '&yaw=' + r3(yaw) + (testOpts.god ? '&god=1' : '') + (testOpts.round > 1 ? '&round=' + testOpts.round : '');
    save().then((ok) => { if (ok) window.open(url, '_blank', 'width=1600,height=900'); });
  }
  $('xeHere').onclick = playHere;
  $('xeTest').onclick = () => { save().then((ok) => { if (ok) window.open('index.html?play=' + id, '_blank', 'width=1600,height=900'); }); };
  $('xeRegen').onclick = () => {
    if (!confirm('Throw away every placed prop, log, sign and floor on ' + def.name + ' and generate them again from the map\'s story?')) return;
    commit();
    const gen = generate({ grid: gridRows(), def: clone(defOverrides(true)), zones: zones ? clone(zones) : undefined, clear: clone(clear), place: clone(place), terrain: terrainDoc() });
    for (const e of ents) unspawn(e);
    ents = gen.entities; floors = gen.floors.split(''); mod.dress = false; dirty = true;
    rebuild(); sel = []; showProps(); msg('Dressing generated again (' + ents.length + ' props)');
  };
  $('xeRevert').onclick = () => {
    if (custom) {
      if (!confirm('Delete ' + def.name + ' for good? (A copy of the saved file is kept in mapedits/backup.)')) return;
      const gone = id, name = def.name, done = () => { delete XH.MAPEDITS[gone]; E.removeCustom(gone); dirty = false; id = null; fillMaps(); open(XH.MAPS.some((m) => m.id === 'kestrel') ? 'kestrel' : arenas()[0].id); msg('Deleted ' + name); };
      if (!XH.MAPEDITS[gone]) { done(); return; }
      api('/api/revert?map=' + gone, '{}').then(done).catch((err) => msg('Could not delete: ' + err.message, true));
      return;
    }
    if (!confirm('Delete every saved edit to ' + def.name + ' and go back to how it shipped? (A backup is kept in mapedits/backup.)')) return;
    api('/api/revert?map=' + id, '{}').then(() => { delete XH.MAPEDITS[id]; delete E.live[id]; dirty = false; open(id); msg('Reverted ' + def.name); }).catch((err) => msg('Could not revert: ' + err.message, true));
  };
  window.addEventListener('error', (e) => msg('Error: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')', true));
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------- frame ----------------
  const camLast = { p: new THREE.Vector3(1e9, 0, 0), q: new THREE.Quaternion() };
  const stats = { frames: 0, n: 0, ms: 0, acc: 0, calls: 0, tris: 0, build: 0, made: 0 };
  const statEl = document.createElement('div'); statEl.className = 'xe-stats'; pane3.appendChild(statEl);
  function showStats() {
    const fps = Math.round(stats.frames / stats.acc), ms = stats.n ? stats.ms / stats.n : 0;
    const tris = stats.tris > 1e6 ? (stats.tris / 1e6).toFixed(1) + 'M' : Math.round(stats.tris / 1000) + 'k';
    statEl.innerHTML = `${fps ? fps + ' fps' : 'idle'} · ${ms.toFixed(1)} ms<br>${stats.calls} draws · ${tris} tris<br>${ents.length} pieces · ${chunks.size} batches<br>rebuild ${stats.build} ms (${stats.made} rebuilt)`;
    stats.frames = 0; stats.n = 0; stats.ms = 0; stats.acc = 0;
  }
  // any input: draw both views while it lasts
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup']) window.addEventListener(ev, () => { lastInput = t; need3 = 2; need2 = true; }, { capture: true, passive: true });
  new ResizeObserver(() => redraw()).observe(pane3);
  M.editor = {
    frame(dt) {
      t += dt;
      const f0 = performance.now();
      if (msgT > 0 && (msgT -= dt) <= 0) $('xeMsg').textContent = '';
      if (rebuildT > 0 && (rebuildT -= dt) <= 0 && !drag && !paintStroke) rebuild();
      if (batchT > 0 && (batchT -= dt) <= 0 && !drag && !paintStroke) rebatch();
      updateFly(dt);
      // the camera moved: draw both views; the lamps near the camera get the real lights
      const moved = !P.cam.position.equals(camLast.p) || !P.cam.quaternion.equals(camLast.q);
      if (moved) { camLast.p.copy(P.cam.position); camLast.q.copy(P.cam.quaternion); need3 = 2; need2 = true; }
      if (W.root) {
        if (live || settle > 0) { W.update(dt, t); XH.fx.update(dt, P.cam, t); need3 = 2; if (settle > 0) settle--; }
        else if (moved && W.updateLightPool) W.updateLightPool(dt);
      }
      const busy = t - lastInput < 0.3 || moved || !!drag || look3;
      if (layout !== '2d' && (need3 > 0 || (fullPending && !busy))) {
        const fast = busy && !live;
        M.render({ cam: P.cam, sc: M.scene, showVM: false }, dt, fast);
        fullPending = fast; need3 = busy ? 0 : Math.max(0, need3 - 1); stats.frames++;
        const ri = M.renderer.info.render; stats.calls = ri.calls; stats.tris = ri.triangles;
      }
      if (need2) { need2 = false; draw2D(); if (sceneDirty && !$('xeScene').classList.contains('hidden')) { sceneDirty = false; showScene(); } }
      if (!gz) placeGizmo();
      stats.ms += performance.now() - f0; stats.n++;
      if ((stats.acc += dt) >= 0.5) showStats();
    },
  };
  XH.xedit = { open, save, pickAll, describe, debug: { unbatchAll, rebatch, stats }, planToClient: (x, z) => { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1, [sx, sy] = toScreen(x, z); return [r.left + sx / d, r.top + sy / d]; }, get state() { return { id, ents, lights, grid, floors, zones, clear, sel, mod, dirty, place, pieces, th, tdir, trise }; }, rebuild, setTool, select };

  // start on the last map worked on
  let last = 'kestrel'; try { last = localStorage.getItem('xedit.map') || last; } catch (e) { /* none */ }
  sizeCanvas(); setTool('select'); tab('assets');
  setTimeout(() => open(XH.MAPS.some((m) => m.id === last) ? last : 'kestrel'), 30);
})();
