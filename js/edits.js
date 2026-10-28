'use strict';
// Hand edits from the map editor (XenoholdEditor.exe). The editor writes js/mapedits.js (XH.MAPEDITS), one entry per
// map, with any of:
//   grid:  [rows]                         the whole tile grid, same symbols as js/mapdata.js
//   def:   { lights, doors, buys, fog, ambient, moon, bloomT }   replaces the map's own settings
//          lights: [cx, cz, color, intensity, range, height?, fixture? (0 = none)] in grid cells
//   zones: [[name, x0, z0, x1, z1]]      the named rooms (cells, inclusive)
//   dress: { entities: [...], floors: 'one letter per cell' }   the placed set dressing (js/setdress.js SD.spawn);
//          when present it replaces the generated dressing of js/mapstory.js. Besides props it holds the builder's kit
//          (js/kit.js), zones ('@zone', js/hazards.js) and hand-placed traps with their levers ('@trap', js/traps.js)
//   clear: [[x, z, r]]                     circles the theme's scattered clutter stays out of
//   place: { key: {...} }                  where a generated piece goes instead of where it would pick (traps and their
//          levers, turret nests, the building, platform, teleporters, ammo station, Wonder Bench and parts, companion
//          egg, hive eyes and altar, the unique perk and gun, the door traps dtrap0 / dtrap1 as { door }); { off: true }
//          leaves a trap, nest or teleporter out
//   custom: { name, base, w, h, from? }   a map made from scratch: its name, the arena whose look it borrows, its size
//          (and the game map maker's map it was copied from); its grid is the whole layout
//   terrain: { h: [rows], ramps: [[cx, cz, dir, h0, rise]] }   floor heights, one letter per cell ('O' = 0, a quarter
//          metre a step), and ramps (dir 1 +x, 2 -x, 3 +z, 4 -z uphill; h0 the low edge, rise across the cell)
(function () {
  const E = XH.edits = { live: {}, orig: {} };
  const saved = XH.MAPEDITS || {};
  const KEYS = ['lights', 'doors', 'buys', 'fog', 'ambient', 'moon', 'bloomT', 'waves'];
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  for (const def of XH.MAPS) E.orig[def.id] = { grid: XH.MAPGRIDS[def.id], def: Object.fromEntries(KEYS.map((k) => [k, clone(def[k])])) };
  // the editor's working copy wins over the saved file
  E.get = (id) => E.live[id] || saved[id] || null;
  E.saved = (id) => saved[id] || null;
  // the hand-placed position of a generated piece on the map being built, if it has one
  E.pin = (key) => { const id = XH.world && XH.world.def && XH.world.def.id, ed = id && E.get(id); return (ed && ed.place && ed.place[key]) || null; };
  // put a map back to how it shipped, then lay its edits over it
  E.apply = (id) => {
    const def = XH.MAPS.find((m) => m.id === id), o = E.orig[id]; if (!def || !o) return;
    const ed = E.get(id) || {};
    XH.MAPGRIDS[id] = ed.grid || o.grid;
    for (const k of KEYS) { const v = ed.def && ed.def[k] !== undefined ? ed.def[k] : o.def[k]; if (v === undefined) delete def[k]; else def[k] = clone(v); }
  };
  // Maps made from scratch (the map editor's New map, or copied from the game's own map maker): a file with a
  // `custom` part { name, base, w, h, from? } and the whole grid. Each borrows the look of an arena (base: its lighting,
  // sky, weather, music, props and creatures) and has its own layout, doors, wall guns and lights.
  const GUNS = { a: 'carbine', b: 'breacher', c: 'pulse', d: 'burst', e: 'rail' };
  E.customDef = (id, c, rows) => {
    const base = XH.MAPS.find((q) => q.id === c.base && !q.custom) || XH.MAPS.find((q) => !q.custom);
    // a lamp roughly every 8 cells of open floor
    const lights = [], col = (base.lights && base.lights[0] && base.lights[0][2]) || 0xffd8a0;
    for (let z = 3; z < rows.length - 2; z += 8) for (let x = 3; x < rows[z].length - 2; x += 8) if ('._,'.includes(rows[z][x])) lights.push([x, z, col, 1.2, 24]);
    const doors = {}; for (let d = 0; d <= 9; d++) doors[d] = { cost: d ? 500 + 250 * d : 500, name: 'Door ' + d };
    if (XH.QUESTS && !XH.QUESTS[id]) XH.QUESTS[id] = XH.QUESTS[base.id] || Object.values(XH.QUESTS)[0];
    return Object.assign({}, base, {
      id, name: c.name || 'Custom Arena', sub: 'Custom arena · ' + base.name + ' style', desc: c.desc || 'A map you built.', custom: true, featured: null,
      buys: Object.assign({}, base.buys || {}, GUNS), doors, lights, power: rows.some((r) => r.includes('Z')), difficulty: 1, customMeta: clone(c),
    });
  };
  // add (or replace) one in the list of maps, so the game and the editor can build it
  E.addCustom = (id, c, rows) => {
    if (!Array.isArray(rows) || !rows.length || rows.some((r) => typeof r !== 'string' || r.length !== rows[0].length)) return null;
    const def = E.customDef(id, c, rows), i = XH.MAPS.findIndex((m) => m.id === id);
    if (i >= 0) XH.MAPS[i] = def; else XH.MAPS.push(def);
    XH.MAPGRIDS[id] = rows;
    E.orig[id] = { grid: rows, def: Object.fromEntries(KEYS.map((k) => [k, clone(def[k])])) };
    return def;
  };
  E.removeCustom = (id) => { const i = XH.MAPS.findIndex((m) => m.id === id && m.custom); if (i >= 0) XH.MAPS.splice(i, 1); delete E.orig[id]; delete E.live[id]; };
  for (const id in saved) if (saved[id].custom) E.addCustom(id, saved[id].custom, saved[id].grid);
  for (const id in saved) E.apply(id);
})();
