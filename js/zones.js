'use strict';
// Named zones for every arena, and where each functional piece belongs (see docs/MAPS.md).
// Generated arenas take their rooms from js/maprooms.js; the hand-built maps and the city are laid out here.
// Rects are [name, x0, z0, x1, z1] in grid cells, inclusive. A cell outside every rect belongs to the nearest one
// within 3 cells (the corridors between rooms), or to no zone.
(function () {
  const ZN = XH.zones = { list: [], map: null };

  const ORIG = {
    kestrel: [['Refinery', 2, 2, 16, 13], ['Barracks', 2, 18, 12, 30], ['Command Center', 33, 2, 41, 31], ['Loading Dock', 17, 9, 30, 17], ['Landing Pad', 13, 18, 30, 30]],
    depths: [['Spawning Pools', 3, 4, 11, 16], ["Tyrant's Nest", 12, 3, 17, 16], ['Magma Rift', 3, 19, 13, 34], ['Crystal Grotto', 19, 3, 45, 22], ['Survey Camp', 14, 22, 33, 34]],
    frostfall: [['Frozen Lake', 2, 2, 12, 15], ['Comms Array', 13, 2, 32, 15], ['Hab Domes', 2, 17, 11, 33], ['Relay Yard', 13, 18, 33, 32], ['Cryo Lab', 36, 4, 45, 33]],
    ark: [['Bridge', 14, 2, 29, 9], ['Crew Quarters', 2, 5, 11, 29], ['Reactor Core', 32, 5, 41, 29], ['Central Concourse', 14, 12, 28, 24], ['Engine Room', 12, 25, 32, 33]],
  };
  // the city: a 3x3 grid of 32-cell districts starting at cell 2
  const CITY = [['Docks', 'Neon District', 'Capitol Hill'], ['Market Street', 'Downtown', 'Central Park'], ['Residential', 'Metro Station', 'The Hive Crater']];

  // Where the functional pieces go, and what they are called on each map (reasons in docs/MAPS.md).
  //   building / platform: the map's structures; ammo: the restock station (skin 'cache' = a supply crate, not a machine)
  //   bench: Wonder Bench; nest: companion egg; grid / fan: the traps (null = not on this map); nests: turret nests
  const PLACE = {
    kestrel: { building: 'Command Center', platform: 'Landing Pad', ammo: 'Barracks', bench: 'Refinery', nest: 'Refinery', grid: ['Landing Pad', 'Pad Power Plates'], fan: ['Refinery', 'Exhaust Fan'] },
    depths: { platform: 'Magma Rift', ammo: 'Survey Camp', ammoSkin: 'cache', bench: 'Crystal Grotto', nest: 'Spawning Pools', grid: ['Magma Rift', 'Magma Vent', 'magma'], fan: null, nests: false },
    frostfall: { building: 'Relay Yard', platform: 'Comms Array', ammo: 'Hab Domes', bench: 'Cryo Lab', nest: 'Cryo Lab', grid: ['Comms Array', 'Ground Plane'], fan: ['Hab Domes', 'Air Recycler'] },
    ark: { ammo: 'Crew Quarters', bench: 'Reactor Core', nest: 'Engine Room', grid: ['Central Concourse', 'Deck Plating'], fan: ['Reactor Core', 'Coolant Fan'] },
    city: { ammo: null, bench: 'Metro Station', nest: 'The Hive Crater', grid: ['Capitol Hill', 'Checkpoint Grid'], fan: ['Docks', 'Ventilation Fan'] },
    dustbasin: { building: 'Loading Yard', platform: 'Dig Site', ammo: 'Loading Yard', bench: 'Ore Crusher', nest: 'Canyon Floor', grid: ['Relay Tower', 'Ground Grid'], fan: ['Ore Crusher', 'Crusher Rotor'] },
    verdant: { building: 'Greenhouse', platform: 'Canopy Walk', ammo: 'Research Atrium', bench: 'Specimen Hall', nest: 'Rot Pits', grid: ['Overgrown Dock', 'Fence Line'], fan: ['Greenhouse', 'Ventilation Fan'] },
    helix: { ammo: 'Lobby', bench: 'Gene Lab', nest: 'Containment', grid: ['Reactor Room', 'Coolant Grid'], fan: ['Cryo Storage', 'Cooling Fan'] },
    undercroft: { ammo: 'Maintenance', bench: 'Maintenance', nest: 'Cistern', grid: ['Outfall', 'Flood Gate Plates'], fan: ['Pump Station', 'Pump Impeller'] },
    glacier: { platform: 'Deep Crevasse', ammo: 'Buried Camp', ammoSkin: 'cache', bench: 'Buried Camp', nest: 'Crystal Vault', grid: ['Buried Camp', 'Heater Grid'], fan: null, nests: false },
    crucible: { building: 'Smelter', platform: 'Casting Floor', ammo: 'Cooling Yard', bench: 'Forge Hall', nest: 'Slag Pits', grid: ['Crucible Core', 'Crucible Grid'], fan: ['Smelter', 'Exhaust Fan'] },
    cathedral: { platform: 'Choir of Teeth', ammo: 'The Nave', ammoSkin: 'pod', bench: 'The Apse', nest: 'Brood Crypt', grid: ['Brood Crypt', 'Acid Geyser', 'acid'], fan: null, nests: false },
    bastion: { building: 'Command Bunker', platform: 'Watchtower', ammo: 'Armory', bench: 'Motor Pool', nest: 'Barracks', grid: ['Courtyard', 'Shock Mesh'], fan: ['Motor Pool', 'Radiator Fan'] },
    selene: { building: 'Hab Ring', ammo: 'Landing Pad', bench: 'Mass Driver', nest: 'Greenhouse Dome', grid: ['Solar Farm', 'Power Bus'], fan: ['Hab Ring', 'Air Recycler'] },
    starfall: { platform: 'Crash Site', ammo: 'Cargo Spill', ammoSkin: 'cache', bench: 'Engine Wreck', nest: 'The Bog', grid: ['Engine Wreck', 'Live Conduit'], fan: ['Engine Wreck', 'Turbine'] },
    vesper: { ammo: 'Hangar', bench: 'Core Access', nest: 'Hydroponics', grid: ['Docking Ring', 'Airlock Grid'], fan: ['Core Access', 'Coolant Fan'] },
    temple: { platform: 'Sanctum', ammo: 'Sunken Court', ammoSkin: 'cache', bench: 'The Tomb', nest: 'Flooded Shrine', grid: ['Serpent Stair', 'Flame Jets', 'flame'], fan: ['The Tomb', 'Blade Wheel', 'blade'], nests: false },
  };
  ZN.PLACE = PLACE;
  ZN.place = (key) => { const p = PLACE[ZN.mapId] || {}; return p[key]; };

  ZN.build = (c) => {
    const { def, W, rows } = c, Wd = W.w, H = W.h;
    ZN.mapId = def.id; ZN.list = []; ZN.map = new Int16Array(Wd * H).fill(-1);
    let rects = null;
    const ed = XH.edits && XH.edits.get(def.id);
    if (ed && ed.zones) rects = ed.zones;
    else if (ORIG[def.id]) rects = ORIG[def.id];
    else if (def.id === 'city') { rects = []; for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) rects.push([CITY[dy][dx], 2 + dx * 32, 2 + dy * 32, 33 + dx * 32, 33 + dy * 32]); }
    else if (XH.MAPROOMS && XH.MAPROOMS[def.id]) rects = XH.MAPROOMS[def.id];
    if (!rects) return;
    rects.forEach(([name, x0, z0, x1, z1], k) => ZN.list.push({ k, name, x0, z0, x1, z1, cells: [], cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }));
    const floor = (ch) => ch !== '#' && !(ch >= 'a' && ch <= 'w') && !(ch >= '0' && ch <= '9');
    for (let z = 0; z < H; z++) for (let x = 0; x < Wd; x++) {
      if (!floor(rows[z][x])) continue;
      let zi = ZN.list.findIndex((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
      if (zi < 0) { let bd = 3.5; for (const q of ZN.list) { const d = Math.hypot(Math.max(q.x0 - x, 0, x - q.x1), Math.max(q.z0 - z, 0, z - q.z1)); if (d < bd) { bd = d; zi = q.k; } } }
      if (zi >= 0) { ZN.map[z * Wd + x] = zi; ZN.list[zi].cells.push(z * Wd + x); }
    }
    // world-space centre of each zone's floor
    for (const q of ZN.list) { let sx = 0, sz = 0; for (const i of q.cells) { sx += i % Wd; sz += (i / Wd) | 0; } const n = Math.max(1, q.cells.length); q.fx = W.cx2x(sx / n); q.fz = W.cz2z(sz / n); q.world = { x: W.cx2x(q.cx), z: W.cz2z(q.cz) }; }
  };
  ZN.at = (cx, cz) => { const W = XH.world; if (!ZN.map || !W.inside(cx, cz)) return null; const k = ZN.map[cz * W.w + cx]; return k >= 0 ? ZN.list[k] : null; };
  ZN.atWorld = (x, z) => ZN.at(XH.world.cellX(x), XH.world.cellZ(z));
  ZN.byName = (name) => ZN.list.find((q) => q.name === name) || null;
  // keep the rects whose every cell lies in the zone; nearest the zone's middle first
  ZN.inZone = (list, name) => {
    const q = ZN.byName(name); if (!q || !list) return [];
    const W = XH.world;
    return list.filter((r) => { for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) if (ZN.map[z * W.w + x] !== q.k) return false; return true; })
      .sort((a, b) => Math.hypot(a.x + a.w / 2 - q.cx, a.z + a.h / 2 - q.cz) - Math.hypot(b.x + b.w / 2 - q.cx, b.z + b.h / 2 - q.cz));
  };
})();
