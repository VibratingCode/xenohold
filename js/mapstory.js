'use strict';
// What belongs in each zone of each map, and the story it tells (the reasoning is in docs/MAPS.md).
// Each zone function gets the placement api from setdress.js: wall(q, o), floor(q, o), decal(q), text(), log(), P.<prop>.
(function () {
  const S = XH.setdress, MS = XH.mapstory = {};
  const W_ = (api, q, prop, n, o) => S.place.wall(api, q, prop, n, o);
  const F_ = (api, q, prop, n, o) => S.place.floor(api, q, prop, n, o);
  const D_ = (api, q, prop, n, o) => S.place.decal(api, q, prop, n, o);
  // the door into a zone (for its sign)
  function doorNear(q) {
    const W = XH.world;
    for (const id in W.doors) for (const ci of W.doors[id].cells) {
      const cx = ci % W.w, cz = (ci / W.w) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (XH.zones.at(cx + dx, cz + dz) === q) return { x: W.cx2x(cx), z: W.cz2z(cz) };
    }
    return null;
  }
  const sign = (api, q, text, o = {}) => { const n = doorNear(q), a = api.wall(q, Object.assign({ decal: true, need: 1 }, n ? { near: n } : {})); if (a) api.text(a, text, 'sign', o.w || 2.2, o.h || 0.55, o.y || 2.9, o); };
  const warn = (api, q, text, o = {}) => { const a = api.wall(q, { decal: true, need: 1 }); if (a) api.text(a, text, 'sign', 2.1, 0.52, o.y || 1.9, Object.assign({ color: '#e0b020', stripes: true }, o)); };
  const scrawl = (api, q, text, o = {}) => { const a = api.wall(q, { decal: true, need: 1 }); if (a) api.text(a, text, 'paint', 2.3, 0.58, o.y || 1.5, o); };
  const body = (api, q, o = {}) => { if (o.lying) { const a = api.floor(q, { margin: 0, block: false }); if (a) api.P.body(a, o); return; } const a = api.wall(q, { need: 2, block: false }); if (a) api.P.body(a, o); };
  const logAt = (api, q, log, o = {}) => {
    if (o.table) { const a = api.floor(q, { margin: 1 }); if (a) { api.P.table(a, o.table === true ? {} : o.table); api.log(api.sub(a, 0.4, 0), log, 0.82); return; } }
    const a = api.wall(q, { need: 2, block: false }); if (a) api.log(api.sub(a, 0, 0.7), log, 0);
  };
  // long props: try lengthwise along z, then along x
  const long = (api, q, prop, len, o = {}) => { let a = api.floor(q, Object.assign({ w: 1, d: len, ry: api.rnd() < 0.5 ? 0 : Math.PI }, o)); if (!a) a = api.floor(q, Object.assign({ w: len, d: 1, ry: api.rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2 }, o)); if (a) api.P[prop](a, o); return a; };
  const big = (api, q, prop, n, o = {}) => { const a = api.floor(q, Object.assign({ w: n, d: n, center: true }, o)); if (a) api.P[prop](a, o); return a; };
  const MARINE = 0x4a5a3a, MINER = 0xc86a2a, LABCOAT = 0xd8dcd8, CREW = 0x2a4a7a, TECH = 0x5a6a7a;

  // =====================================================================
  MS.kestrel = { blocks: { 'Command Center': ['server', { label: 'UPLINK' }], Barracks: ['bunks', { label: 'BERTHS' }] }, zones: {
    'Landing Pad': (api, q) => {
      sign(api, q, 'LANDING PAD 1', { color: '#5fd0ff' });
      const pad = api.zone('Landing Pad'); const h = XH.world.spots.heart;
      if (h) api.P.landingPad({ x: h.x, z: h.z, ry: 0, y: 0 });
      F_(api, q, 'luggage', 3); F_(api, q, 'pallet', 2, { wrap: 0x5a7a9a });
      long(api, q, 'truck', 3);
      W_(api, q, 'tanks', 1, { color: 0xc8c8c0 }); warn(api, q, 'NO SMOKING WITHIN 30 M');
      scrawl(api, q, 'EVAC 06:00 - WAIT HERE'); scrawl(api, q, 'IT NEVER CAME');
      D_(api, q, 'casings', 3); D_(api, q, 'scorch', 2);
      logAt(api, q, { title: 'Admin log, day 3', who: 'Colony administrator R. Okafor', text: 'Shuttle confirmed for 06:00. I told everyone to bring one bag.\nIt is 07:40. The pad lights are still on. People are still sitting on their bags.\nNobody wants to be the first to walk back inside.' });
      void pad;
    },
    'Loading Dock': (api, q) => {
      sign(api, q, 'LOADING DOCK B'); F_(api, q, 'forklift', 1); F_(api, q, 'pallet', 0.25); F_(api, q, 'oreCart', 1, { ry: 0 }); W_(api, q, 'shelf', 1); D_(api, q, 'trail', 1);
    },
    Refinery: (api, q) => {
      sign(api, q, 'REFINERY', { color: '#ffb060' }); warn(api, q, 'SHAFT 3: SEALED');
      const hole = api.floor(q, { w: 1, d: 1, margin: 1, block: false }); if (hole) api.P.hole(hole);
      W_(api, q, 'tanks', 0.12); W_(api, q, 'pump', 2); W_(api, q, 'pipes', 0.3, { decal: true, need: 1 });
      F_(api, q, 'oreCart', 2, { tipped: true }); F_(api, q, 'orePile', 2, { color: 0x6a5a4a });
      D_(api, q, 'creep', 2); body(api, q, { suit: MINER, helmet: 0xe0b020 });
      logAt(api, q, { title: 'Shift report, shaft 3', who: 'Foreman D. Varga', text: 'Hit a cavity at 900 m. Hollow, and warm. Thermal says 38 degrees, which is body temperature, which is not a rock temperature.\nDrill crew says they heard something knocking back.\nSealing the hatch until the geologist looks at it.' });
    },
    Barracks: (api, q) => {
      sign(api, q, 'BARRACKS BLOCK A');
      W_(api, q, 'bunk', 0.3); W_(api, q, 'lockers', 0.1);
      F_(api, q, 'table', 1, { chairs: 4 }); const b = doorNear(q); if (b) { const a = api.floor(q, { margin: 0 }); if (a) api.P.barricade(a); }
      scrawl(api, q, "DON'T OPEN THE DOOR"); scrawl(api, q, 'THEY KNOCK BACK');
      body(api, q, { lying: true, suit: MINER, blanket: 0x6a7a5a }); D_(api, q, 'blood', 2); D_(api, q, 'trail', 1); W_(api, q, 'claws', 3, { decal: true, need: 1 });
      logAt(api, q, { title: 'Voice note', who: 'Miner, bunk 14', text: 'If anyone finds this: we pushed the tables against the door and we are staying quiet.\nThey do not come through doors. They come through the vents.\nI am going to try to reach the landing pad. Tell my sister I tried.' }, { table: true });
    },
    'Command Center': (api, q) => {
      sign(api, q, 'COMMAND', { color: '#40e0d0' });
      W_(api, q, 'console', 0.14, { text: 'NO SIGNAL', textColor: '#ff5040' }); W_(api, q, 'racks', 0.08);
      F_(api, q, 'table', 1, { map: true, chairs: 2 }); W_(api, q, 'panel', 3, { decal: true, need: 1 });
      body(api, q, { suit: CREW }); D_(api, q, 'blood', 1);
      logAt(api, q, { title: 'Last transmission, 23:47', who: 'Colony administrator R. Okafor', text: 'This is LV-9. We have lost the refinery and the north block. The uplinks are covered in something and we cannot clear the channel.\nIf you can hear this, bring the shuttle down on pad 1 and keep the pad lights on. We will hold it.\nWe will hold it.' });
    },
  } };

  // =====================================================================
  MS.depths = { generic: { crystals: ['Crystal Grotto', 'Survey Camp'] }, zones: {
    'Survey Camp': (api, q) => {
      F_(api, q, 'tent', 2, { color: 0xc86a2a }); F_(api, q, 'campfire', 1); F_(api, q, 'crates', 2, { color: 0x6a6a5a, label: 0xe0b020 });
      const c = api.floor(q, { margin: 1 }); if (c) api.P.drillRig(c);
      W_(api, q, 'generator', 1); F_(api, q, 'floodlight', 2); F_(api, q, 'luggage', 2); F_(api, q, 'jerry', 1); F_(api, q, 'barricade', 2);
      D_(api, q, 'scorch', 2); D_(api, q, 'creep', 3); body(api, q, { suit: MINER, helmet: 0xe8e8e8 });
      logAt(api, q, { title: 'Survey log 1', who: 'Dr. I. Mbeki, geologist', text: 'Lift cage came down hard. Cable snapped above us, so we are camping until the surface sends a new one.\nThe rock here is warm and it has a rhythm. I put a stethoscope on the wall for a joke. It has a heartbeat.\nI am not joking any more.' }, { table: true });
    },
    'Magma Rift': (api, q) => {
      D_(api, q, 'scorch', 3); F_(api, q, 'orePile', 2, { color: 0x2a2020 }); F_(api, q, 'crystals', 1, { color: 0xff6020 }); F_(api, q, 'bones', 1, { helmets: true }); F_(api, q, 'stakes', 2);
      const a = api.wall(q, { need: 2 }); if (a) { api.P.cart(a); }
      logAt(api, q, { title: 'Radio call', who: 'Survey team lead, channel 2', text: 'Surface, this is Deep Camp. Two of us went into the rift to set the heat probes and did not come back. We found the probes. We found their helmets.\nRequesting the new cage as soon as possible. Please.' });
    },
    'Spawning Pools': (api, q) => { F_(api, q, 'eggs', 0.45); W_(api, q, 'cocoon', 0.25, { need: 2, block: false }); D_(api, q, 'creep', 4); D_(api, q, 'blood', 2); },
    "Tyrant's Nest": (api, q) => { F_(api, q, 'bones', 0.25, { helmets: true }); W_(api, q, 'claws', 4, { decal: true, need: 1 }); W_(api, q, 'skulls', 2, { decal: true, need: 1 }); D_(api, q, 'creep', 3); },
    'Crystal Grotto': (api, q) => {
      F_(api, q, 'crystals', 0.45, { color: 0x60c8ff }); F_(api, q, 'stakes', 2); F_(api, q, 'luggage', 1); F_(api, q, 'skeleton', 1);
      logAt(api, q, { title: 'Sample notes', who: 'Dr. I. Mbeki, geologist', text: 'The crystals grow along the hive tissue like frost along a wire. They sing when you tap them, and the swarm stops to listen.\nI think the crystals are how it thinks.' });
    },
  } };

  // =====================================================================
  MS.frostfall = { generic: { masts: ['Comms Array', 'Relay Yard'], crates: ['Relay Yard', 'Comms Array', 'Hab Domes'] }, blocks: { 'Comms Array': ['machine', { color: 0xa8b0b8, glow: 0x60c8ff, label: 'SIGNAL PROC' }], 'Relay Yard': ['machine', { color: 0x8a9098, label: 'TRANSFORMER' }] }, zones: {
    'Relay Yard': (api, q) => {
      sign(api, q, 'FROSTFALL RELAY', { color: '#a8e8ff' });
      const f = api.floor(q, { margin: 1 }); if (f) api.P.flagpole(f, { color: 0x2a4a8a, torn: true });
      long(api, q, 'rover', 1); F_(api, q, 'sled', 2); F_(api, q, 'crates', 1, { color: 0x3a4a5a }); W_(api, q, 'generator', 1);
      scrawl(api, q, 'DO NOT ANSWER IT', { color: '#1a1a1a' });
      logAt(api, q, { title: 'Station log', who: 'Station chief A. Lindqvist', text: 'Day 112 of 180. Incoming signal on the deep band, no origin, repeating every 40 seconds. The relay locked onto it and started amplifying on its own.\nI have told the crew not to answer it. The relay answers it anyway.' });
    },
    'Comms Array': (api, q) => { sign(api, q, 'COMMS ARRAY'); W_(api, q, 'racks', 0.15); W_(api, q, 'console', 1, { text: 'SIGNAL LOCK 100%', textColor: '#80e0ff' }); W_(api, q, 'panel', 3, { decal: true, need: 1 }); F_(api, q, 'crates', 1); },
    'Frozen Lake': (api, q) => {
      const h = api.floor(q, { margin: 1, block: false }); if (h) api.P.hole(h, { glow: 0x60c8ff });
      F_(api, q, 'stakes', 2); F_(api, q, 'sled', 1); const d = api.floor(q, { margin: 1 }); if (d) api.P.drillRig(d);
      warn(api, q, 'THIN ICE', { color: '#80c8ff' });
    },
    'Hab Domes': (api, q) => {
      sign(api, q, 'HAB DOMES'); W_(api, q, 'bunk', 0.25, { sheet: 0x3a5a7a }); W_(api, q, 'lockers', 0.1, { color: 0x6a7a8a }); W_(api, q, 'dispenser', 1);
      F_(api, q, 'table', 1); body(api, q, { suit: 0xa02020, lying: true, blanket: 0x3a5a7a });
      logAt(api, q, { title: 'Personal log', who: 'Relay operator K. Aho', text: 'The chittering is in the headsets now even when they are unplugged. The chief says it is feedback.\nFeedback does not say your name.' }, { table: true });
    },
    'Cryo Lab': (api, q) => {
      sign(api, q, 'CRYO LAB', { color: '#80d0ff' }); warn(api, q, 'BIOHAZARD LEVEL 3');
      W_(api, q, 'cryo', 0.18); W_(api, q, 'labBench', 0.12);
      const t = api.floor(q, { margin: 1 }); if (t) { api.P.cryo({ x: t.x, z: t.z, ry: t.ry, y: 0 }, { glow: 0x203040 }); api.P.blood(t, { n: 4 }); }
      D_(api, q, 'trail', 1);
      logAt(api, q, { title: 'Sample 7', who: 'Cryo technician M. Sato', text: 'Core sample 7 from the lake: organic, dormant, one metre long. Thawing it at one degree per hour.\nAt minus forty it moved. At minus twenty it turned towards me.\nI have locked the lab. I have not locked the tank.' });
    },
  } };

  // =====================================================================
  MS.ark = { blocks: { 'Crew Quarters': ['lockers', { label: 'CREW' }], 'Central Concourse': ['garden', { leaf: 0x3a7a3a, light: 0xffe0a0 }] }, zones: {
    'Central Concourse': (api, q) => {
      sign(api, q, 'PROVIDENCE - CONCOURSE', { color: '#7dff9a' });
      F_(api, q, 'chairs', 2); F_(api, q, 'barricade', 1); F_(api, q, 'luggage', 1);
      scrawl(api, q, 'LIFEBOATS: ENGINE ROOM ->', { color: '#e0e0e0' }); W_(api, q, 'panel', 2, { decal: true, need: 1 });
      D_(api, q, 'casings', 2); D_(api, q, 'blood', 1);
      logAt(api, q, { title: 'Captain\'s log', who: 'Captain E. Voss', text: 'Year 61 of 90. The sleepers in bay C are warm. Their pods show normal vitals and something else under the vitals.\nWe opened one. We should not have opened one.\nAll crew: the reactor is the only thing on this ship hot enough to burn it out.' });
    },
    'Crew Quarters': (api, q) => { sign(api, q, 'CREW QUARTERS'); W_(api, q, 'bunk', 0.3, { sheet: 0x2a4a6a }); W_(api, q, 'lockers', 0.1, { color: 0x3a4a5a }); F_(api, q, 'table', 1); body(api, q, { suit: CREW, gun: true }); D_(api, q, 'trail', 1); scrawl(api, q, 'THEY ARE IN THE PODS'); },
    Bridge: (api, q) => {
      sign(api, q, 'BRIDGE', { color: '#6090ff' });
      W_(api, q, 'console', 0.25, { text: 'REACTOR 14%', textColor: '#ffb040' }); W_(api, q, 'window', 2, { decal: true, need: 1 });
      const c = api.floor(q, { margin: 1 }); if (c) api.P.desk(c, { color: 0x3a4048 });
      logAt(api, q, { title: 'Cargo manifest', who: 'Quartermaster J. Reyes', text: 'Waystation Delta-4 transfer: 40 tonnes seed stock, 12 tonnes medical, 3 sealed containers "agricultural samples", no inspection, paid in advance.\nContainer 3 was warm to the touch. I signed for it anyway.' });
    },
    'Reactor Core': (api, q) => { sign(api, q, 'REACTOR CORE', { color: '#ff9030' }); warn(api, q, 'RADIATION'); W_(api, q, 'capacitors', 0.12); W_(api, q, 'pipes', 0.3, { decal: true, need: 1 }); W_(api, q, 'cocoon', 2, { need: 2, block: false }); D_(api, q, 'creep', 3); },
    'Engine Room': (api, q) => {
      sign(api, q, 'ENGINE ROOM - LIFEBOAT BAY'); W_(api, q, 'tanks', 2); W_(api, q, 'generator', 1); F_(api, q, 'crates', 2, { color: 0x5a6a7a });
      logAt(api, q, { title: 'Woke early', who: 'Colonist A-1187, pod bay C', text: 'My pod opened on its own. The others did not. Their faces were pressed against the glass and they were smiling.\nI am going to the lifeboats. I am sorry.' });
    },
  } };

  // =====================================================================
  MS.city = { zones: {
    Downtown: (api, q) => { scrawl(api, q, 'THE CRATER IS BREATHING', { color: '#ff3060' }); D_(api, q, 'blood', 2); logAt(api, q, { title: 'Broadcast transcript', who: 'Channel 9 news desk', text: 'Authorities repeat: the quarantine wall is holding. Stay indoors. Do not approach the crater district. Evacuation shuttles will resume shortly.\nWe are being told to read this again. The wall is holding.' }); },
    'Capitol Hill': (api, q) => { D_(api, q, 'casings', 3); body(api, q, { suit: 0x1a2a4a, lying: true, gun: true }); logAt(api, q, { title: 'Checkpoint orders', who: 'Quarantine officer, gate 6', text: 'Order 14: no civilian passes the checkpoint, infected or not. Order 15: if the crater district breaches, fall back to the Capitol and hold.\nThere is no order 16.' }); },
    Residential: (api, q) => { scrawl(api, q, 'MOM WE WENT TO THE PARK', { color: '#2a2a8a' }); logAt(api, q, { title: 'Note on a door', who: 'Written in crayon', text: 'Dad we went to the park like you said to. The big man at the gate said we cant come back tonight. Come find us at the fountain.\nLove Mia and Theo.' }); },
    'The Hive Crater': (api, q) => { D_(api, q, 'creep', 4); F_(api, q, 'eggs', 3); },
  } };

  // =====================================================================
  MS.dustbasin = { generic: { derricks: ['Dig Site', 'Canyon Floor'], ribcage: ['Canyon Floor', 'Dig Site'], rocks: ['Canyon Floor', 'Dig Site', 'Loading Yard'] }, blocks: { 'Ore Crusher': ['machine', { color: 0x8a6a3a, label: 'CRUSHER DRIVE', spin: true }], 'Relay Tower': ['server', { label: 'RELAY' }], Bunkhouse: ['bunks', { sheet: 0x8a6a4a }] }, zones: {
    'Loading Yard': (api, q) => {
      sign(api, q, 'PIT 4 LOADING YARD', { color: '#ffb060' }); long(api, q, 'truck', 3); F_(api, q, 'orePile', 0.15); F_(api, q, 'pallet', 0.12, { wrap: 0xc8a070 }); W_(api, q, 'tanks', 1, { color: 0xd8c8a0 }); warn(api, q, 'HARD HATS ONLY');
      logAt(api, q, { title: 'Shift change', who: 'Shift foreman T. Brandt', text: 'Night shift says drill 6 keeps running with the power cut. I went and looked. The bit was turning by itself, slowly, like something below was turning it.\nPulled everyone out of the pit. Nobody is going back down until the surveyor has the beacons up.' });
    },
    'Dig Site': (api, q) => {
      sign(api, q, 'DIG SITE 4 - BLAST ZONE', { color: '#e0b020', stripes: true });
      const h = api.floor(q, { w: 1, d: 1, margin: 1, block: false }); if (h) api.P.hole(h);
      F_(api, q, 'stakes', 3); F_(api, q, 'crates', 2, { color: 0xa02020, label: 0xe0e0e0 }); F_(api, q, 'orePile', 2, { color: 0x9a6a40 });
      logAt(api, q, { title: 'Survey note', who: 'Surveyor P. Osei', text: 'Beacons 1 to 4 are up. The readings say the cavity under pit 4 is moving. Not collapsing. Moving.\nEach one of those creatures that dies near a beacon gives it a clean footstep. Enough footsteps and I can tell you exactly where the big one sleeps.' });
    },
    'Ore Crusher': (api, q) => { sign(api, q, 'ORE CRUSHER'); big(api, q, 'crusher', 2); F_(api, q, 'orePile', 2); W_(api, q, 'workbench', 1); W_(api, q, 'shelf', 1); warn(api, q, 'KEEP CLEAR OF ROTOR'); },
    'Canyon Floor': (api, q) => { F_(api, q, 'oreCart', 1, { tipped: true }); F_(api, q, 'bones', 2); D_(api, q, 'blood', 1); body(api, q, { suit: MINER, helmet: 0xe0b020, lying: true }); },
    Bunkhouse: (api, q) => {
      sign(api, q, 'BUNKHOUSE'); W_(api, q, 'bunk', 0.3, { sheet: 0x8a6a4a }); W_(api, q, 'lockers', 1, { color: 0x6a5a4a }); F_(api, q, 'table', 1, { chairs: 4 }); scrawl(api, q, "IT'S UNDER US");
    },
    'Relay Tower': (api, q) => {
      sign(api, q, 'RELAY TOWER'); W_(api, q, 'generator', 1); W_(api, q, 'console', 1, { text: 'NO CARRIER', textColor: '#ffb040' }); W_(api, q, 'racks', 1);
      logAt(api, q, { title: 'Radio log', who: 'Radio operator L. Nakamura', text: 'Basin to Hesperus, Basin to Hesperus. The borers are coming up through the canyon floor and something the size of the crusher is coming up behind them.\nRequesting air support. Requesting anything.' });
    },
  } };

  // =====================================================================
  MS.verdant = { blocks: { Greenhouse: ['garden', { dead: 0.3 }] }, zones: {
    'Research Atrium': (api, q) => {
      sign(api, q, 'VERDANT LABS', { color: '#7dff7a' }); const d = api.floor(q, { margin: 1, center: true }); if (d) api.P.desk(d, { color: 0xc8c0a8 }); F_(api, q, 'planter', 2, { dead: true }); F_(api, q, 'chairs', 1); scrawl(api, q, 'GROWING TOMORROW', { color: '#2a4a2a' });
      logAt(api, q, { title: 'Director\'s memo', who: 'Head botanist Dr. R. Farouk', text: 'Canopy growth 400% in six days. The trees are not growing towards the light. They are growing towards the station.\nLock the seed vaults. The clean seed bank is the only thing we have that the jungle has not touched.' });
    },
    'Canopy Walk': (api, q) => { W_(api, q, 'cocoon', 4, { need: 2, block: false, color: 0x4a6a3a }); F_(api, q, 'crates', 1, { color: 0x5a6a4a }); D_(api, q, 'trail', 1, { color: 0x2a3a10 }); },
    Greenhouse: (api, q) => { sign(api, q, 'GREENHOUSE B'); F_(api, q, 'planter', 0.3); F_(api, q, 'hydro', 0.2); warn(api, q, 'DO NOT FEED', { color: '#7dff7a' }); },
    'Rot Pits': (api, q) => { F_(api, q, 'bones', 2); D_(api, q, 'creep', 3); body(api, q, { suit: LABCOAT, lying: true }); W_(api, q, 'cocoon', 2, { need: 2, block: false, color: 0x5a4a2a }); },
    'Specimen Hall': (api, q) => {
      sign(api, q, 'SPECIMEN HALL'); W_(api, q, 'shelf', 0.22, { jars: 0x60ffa0 }); W_(api, q, 'labBench', 0.12); F_(api, q, 'crates', 1);
      logAt(api, q, { title: 'Lab notebook', who: 'Graduate student N. Petrov', text: 'The spore cores are not seeds. They are more like hearts: every plant within twenty metres pulses with them.\nIf you burn a core in the vault incinerator the whole root network flinches. We could burn it all from here.' }, { table: true });
    },
    'Overgrown Dock': (api, q) => { long(api, q, 'barge', 2); F_(api, q, 'crates', 2, { color: 0x5a6a4a }); F_(api, q, 'barrels', 1, { color: 0x6a4a2a }); body(api, q, { suit: 0x3a4a6a }); logAt(api, q, { title: 'Dock log', who: 'Pilot S. Aguilar', text: 'Took the barge out to the river mouth to get help. The river is roots now, bank to bank. Had to turn back.\nThe dock fence is the only thing keeping the big ones off the pier. Keep it powered.' }); },
  } };

  // =====================================================================
  MS.helix = { generic: { tanks: ['Gene Lab', 'Containment'], gurneys: ['Surgery', 'Lobby', 'Cryo Storage'] }, blocks: { 'Cryo Storage': ['cryo', { label: 'SPECIMENS' }], 'Gene Lab': ['vats', { broken: 0.2 }], Containment: ['vats', { broken: 0.5, fluid: 0x6a8a20, glow: 0xa0ff40 }] }, zones: {
    Lobby: (api, q) => {
      sign(api, q, 'HELIX BIOTECH', { color: '#60e8ff', w: 2.6 }); const d = api.floor(q, { margin: 1, center: true }); if (d) api.P.desk(d, { color: 0xe8ecf0 }); F_(api, q, 'chairs', 2); scrawl(api, q, 'BETTER LIFE THROUGH SCIENCE', { color: '#2a6a8a' });
      D_(api, q, 'casings', 2); body(api, q, { suit: 0x1a1a2a, gun: true });
      logAt(api, q, { title: 'Security memo', who: 'Head of security', text: 'Sublevel 2 is sealed. Nobody goes down, nobody comes up. If you hear knocking from the lift shaft, it is not staff.\nAll staff are accounted for. All staff are downstairs.' });
    },
    'Cryo Storage': (api, q) => { sign(api, q, 'CRYO STORAGE'); W_(api, q, 'cryo', 0.3); F_(api, q, 'oxygen', 2); },
    'Gene Lab': (api, q) => {
      sign(api, q, 'GENE LAB', { color: '#60e8ff' }); const h = api.floor(q, { margin: 1, center: true }); if (h) api.P.helix(h); W_(api, q, 'labBench', 0.25); W_(api, q, 'racks', 0.06); F_(api, q, 'table', 0.12, { color: 0xe0e4e8, chairs: 2 });
      logAt(api, q, { title: 'Project Chimera', who: 'Project lead Dr. H. Lindgren', text: 'Subject 11 accepted the hive sequence without rejection. Strength up 300%. Pain response absent. Obedience: variable.\nThe sequencers can compile a kill code if we feed them enough live samples. We will not need one. Subject 11 is sedated.' });
    },
    Containment: (api, q) => { sign(api, q, 'CONTAINMENT', { color: '#ff4050' }); warn(api, q, 'SPECIMEN DANGEROUS', { color: '#ff4050' }); W_(api, q, 'cryo', 0.15, { glow: 0x40ffa0 }); W_(api, q, 'claws', 4, { decal: true, need: 1 }); D_(api, q, 'blood', 2); D_(api, q, 'trail', 1); },
    Surgery: (api, q) => {
      sign(api, q, 'SURGERY'); const t = api.floor(q, { margin: 1, center: true }); if (t) { api.P.table(t, { color: 0xc8ccd0, chairs: 0 }); api.P.blood(t, { n: 4 }); } W_(api, q, 'shelf', 1, { jars: 0xff6080 }); body(api, q, { suit: LABCOAT, lying: true, blanket: 0xc8d0d8 });
      logAt(api, q, { title: 'Surgeon\'s note', who: 'Dr. P. Anand', text: 'I was told to remove the implants from the Chimera subjects. There was nothing to remove. The implants had grown into them.\nThe subjects were awake for all of it. They did not scream. They watched me.' });
    },
    'Reactor Room': (api, q) => {
      sign(api, q, 'REACTOR ROOM', { color: '#ff4050' }); const r = api.floor(q, { margin: 1, center: true }); if (r) api.P.reactor(r, { color: 0x60e8ff }); W_(api, q, 'console', 1, { text: 'COOLANT FAILURE', textColor: '#ff4050' }); W_(api, q, 'capacitors', 1);
      logAt(api, q, { title: 'Restart log', who: 'Technician B. Kowalczyk', text: 'Management wants the reactor back up so the vats do not lose temperature. I asked what is in the vats. They said: the next generation.\nReactor online. God forgive me.' });
    },
  } };

  // =====================================================================
  MS.undercroft = { blocks: { 'Pump Station': ['machine', { color: 0x3a5a6a, label: 'PUMP 3', spin: true }], Cistern: ['pillar', { color: 0x6a6a60, band: 0x3a4a3a, stain: 1.2 }] }, zones: {
    Junction: (api, q) => { sign(api, q, 'DRAIN JUNCTION 7', { color: '#b8e070' }); W_(api, q, 'pipes', 4, { decal: true, need: 1 }); W_(api, q, 'floodLines', 3, { decal: true, need: 1 }); D_(api, q, 'trail', 1, { color: 0x1a2a0a }); F_(api, q, 'barricade', 1); body(api, q, { suit: 0xd8a020, lying: true }); },
    'Overflow Tunnel': (api, q) => { W_(api, q, 'floodLines', 4, { decal: true, need: 1 }); F_(api, q, 'barrels', 1, { color: 0x5a6a3a }); F_(api, q, 'crates', 1, { color: 0x5a5040 }); warn(api, q, 'FLOOD LEVEL 2 M'); },
    'Pump Station': (api, q) => {
      sign(api, q, 'PUMP STATION 3'); W_(api, q, 'pump', 0.18); W_(api, q, 'console', 1, { text: 'INTAKE BLOCKED', textColor: '#ffb040' });
      W_(api, q, 'tanks', 2, { color: 0x6a7a6a }); W_(api, q, 'generator', 1); F_(api, q, 'barrels', 2, { color: 0x3a6a8a }); F_(api, q, 'cart', 1); F_(api, q, 'pallet', 1); D_(api, q, 'trail', 1, { color: 0x1a2a0a });
      logAt(api, q, { title: 'Pump log', who: 'Maintenance supervisor G. Hale', text: 'Intakes on valves 1 to 4 clogged again. Not debris. Egg-mass, thick as a mattress, warm.\nThe impellers can chew through it if something dies against the grate. Found that out the hard way.' });
    },
    Cistern: (api, q) => { F_(api, q, 'eggs', 5, { color: 0x8a9a6a, glow: 0x9aff60 }); W_(api, q, 'cocoon', 3, { need: 2, block: false }); D_(api, q, 'creep', 4); scrawl(api, q, 'THIS IS WHERE IT STARTED'); },
    Maintenance: (api, q) => {
      sign(api, q, 'MAINTENANCE'); W_(api, q, 'lockers', 2, { color: 0xd8a020 }); W_(api, q, 'workbench', 1); F_(api, q, 'cart', 1); W_(api, q, 'shelf', 1); F_(api, q, 'crates', 1, { color: 0x5a5040 }); warn(api, q, 'DAYS WITHOUT INCIDENT: 0');
      logAt(api, q, { title: 'City memo', who: 'Hesperus Water Authority', text: 'Re: your report of "eggs" in cistern 4. These are almost certainly calcium deposits. Do not disturb them, do not photograph them, and do not discuss them with the press.\nThank you for your diligence.' }, { table: true });
    },
    Outfall: (api, q) => { warn(api, q, 'OUTFALL - RIVER GRATE'); W_(api, q, 'floodLines', 3, { decal: true, need: 1 }); F_(api, q, 'barrels', 1, { color: 0x5a6a3a }); D_(api, q, 'trail', 1, { color: 0x1a2a0a }); body(api, q, { suit: 0xd8a020, helmet: 0xe8e8e8 }); logAt(api, q, { title: 'Voice memo', who: 'Sewer worker D. Moss', text: 'The eggs are warm. I put my hand on one and it moved against my palm like it wanted to be held.\nI am not going back down there.' }); },
  } };

  // =====================================================================
  MS.glacier = { generic: { crates: ['Buried Camp'] }, zones: {
    'Ice Chamber': (api, q) => { F_(api, q, 'sled', 2); F_(api, q, 'crates', 1, { color: 0x3a4a5a }); D_(api, q, 'trail', 1); F_(api, q, 'floodlight', 2); F_(api, q, 'stakes', 2); F_(api, q, 'crystals', 0.2, { color: 0xc0e8ff }); F_(api, q, 'tent', 1, { color: 0xa02020 }); logAt(api, q, { title: 'Expedition log', who: 'Expedition leader Dr. N. Halvorsen', text: 'Day 40. The thermal drill broke through at 400 m into a hall the size of a stadium. Something is in the ice wall. It is not a rock formation.\nThe team wants to celebrate. I want to collapse the tunnel.' }); },
    'Frozen Falls': (api, q) => { W_(api, q, 'frozenFall', 2, { need: 3 }); F_(api, q, 'crystals', 0.25, { color: 0xc0f0ff }); F_(api, q, 'skeleton', 1); },
    'Crystal Vault': (api, q) => { F_(api, q, 'crystals', 0.45, { color: 0x80d0ff }); F_(api, q, 'luggage', 1); F_(api, q, 'stakes', 1); },
    'Buried Camp': (api, q) => {
      F_(api, q, 'tent', 0.15, { color: 0xa02020 }); W_(api, q, 'generator', 1); W_(api, q, 'shelf', 1, { jars: 0xa0e0ff }); F_(api, q, 'sled', 1); F_(api, q, 'floodlight', 1); F_(api, q, 'jerry', 2); F_(api, q, 'crates', 2, { color: 0x3a4a5a }); body(api, q, { suit: 0xa02020, lying: true, blanket: 0x3a4a6a });
      logAt(api, q, { title: 'Charge notes', who: 'Driller O. Bakker', text: 'Seismic charges placed. Normal charges will not break hive ice, so Halvorsen had them tuned to the thing\'s own frequency. Every one of the creatures that dies next to a charge gives it a little more of the tune.\nWhen they are ready, the whole hall comes down.' }, { table: true });
    },
    'Deep Crevasse': (api, q) => { body(api, q, { suit: 0xc86a2a, helmet: 0xe8e8e8, lying: true }); F_(api, q, 'crates', 1, { color: 0x3a4a5a }); F_(api, q, 'stakes', 2); W_(api, q, 'cables', 2, { decal: true, need: 1 }); },
    'Mammoth Hall': (api, q) => {
      const a = api.wall(q, { span: 2, need: 3, decal: true }); if (a) api.P.iceGiant(a);
      F_(api, q, 'floodlight', 2); F_(api, q, 'stakes', 2); W_(api, q, 'generator', 2); // the heaters
      F_(api, q, 'crystals', 0.25, { color: 0xc0e8ff }); F_(api, q, 'sled', 1); F_(api, q, 'crates', 1, { color: 0x3a4a5a }); D_(api, q, 'blood', 2);
      logAt(api, q, { title: 'Field notes', who: 'Glaciologist Dr. E. Castillo', text: 'Whatever is in the wall has been frozen for at least a million years. Its eye is the size of a car and I swear it has moved since yesterday.\nThe cold kept it asleep. We brought heaters.' });
    },
  } };

  // =====================================================================
  MS.crucible = { generic: { furnaces: ['Smelter', 'Forge Hall', 'Casting Floor'], barrels: ['Cooling Yard', 'Casting Floor', 'Slag Pits'] }, blocks: { Smelter: 'furnace', 'Crucible Core': ['machine', { color: 0x4a3a30, glow: 0xff7020, label: 'INDUCTION' }], 'Forge Hall': ['machine', { color: 0x5a4a3a, label: 'PRESS' }] }, zones: {
    'Casting Floor': (api, q) => { sign(api, q, 'CASTING FLOOR', { color: '#ff7a30' }); big(api, q, 'ladle', 2); F_(api, q, 'molds', 0.15); warn(api, q, 'MOLTEN METAL'); D_(api, q, 'scorch', 2); logAt(api, q, { title: 'Casting report', who: 'Caster R. Ilunga', text: 'Poured plate 4412 at 06:10. At 06:14 the metal in the mold started moving by itself. It pulled itself into a shape and stood up.\nWe are not casting hull plate any more.' }); },
    'Slag Pits': (api, q) => { F_(api, q, 'orePile', 3, { color: 0x2a2020 }); F_(api, q, 'oreCart', 1); D_(api, q, 'scorch', 3); body(api, q, { suit: 0x6a4a2a, helmet: 0xe0b020, lying: true }); },
    Smelter: (api, q) => { sign(api, q, 'SMELTER'); W_(api, q, 'furnace', 0.2); F_(api, q, 'orePile', 2, { color: 0x6a4a3a }); F_(api, q, 'oreCart', 2); D_(api, q, 'scorch', 2); W_(api, q, 'pipes', 2, { decal: true, need: 1 }); logAt(api, q, { title: 'Valve memo', who: 'Shift boss C. Duarte', text: 'The furnace valves are sealed with some kind of resin. It will not cut and it will not melt, except when one of those things burns right next to it.\nSo we burn them next to it.' }); },
    'Cooling Yard': (api, q) => { sign(api, q, 'COOLING YARD'); F_(api, q, 'plates', 0.22); F_(api, q, 'pallet', 1, { wrap: 0x6a6a6a }); W_(api, q, 'lockers', 1, { color: 0x6a5a4a }); },
    'Forge Hall': (api, q) => { sign(api, q, 'FORGE HALL'); F_(api, q, 'anvil', 0.15); W_(api, q, 'workbench', 0.12); W_(api, q, 'gunRack', 1); },
    'Crucible Core': (api, q) => { big(api, q, 'crucibleBig', 2); warn(api, q, 'CRUCIBLE CORE - NO ENTRY'); logAt(api, q, { title: 'Manager\'s order', who: 'Plant manager V. Soltan', text: 'The crucible is holding at 1,600 degrees and climbing, and the thing growing inside it likes the heat.\nIf the valves are opened and the furnaces rigged, the whole foundry pours into the vent. The freight lift will get you out. Do not wait for me.' }); },
  } };

  // =====================================================================
  MS.cathedral = { zones: {
    'The Nave': (api, q) => { for (let k = 0; k < 6; k++) long(api, q, 'pews', 2); W_(api, q, 'cocoon', 4, { need: 2, block: false, color: 0x5a3a5a }); F_(api, q, 'bones', 1); body(api, q, { suit: MARINE, lying: true, gun: true }); D_(api, q, 'blood', 3); logAt(api, q, { title: 'Sermon notes', who: 'Chaplain M. Ferreira (before)', text: 'For Sunday: we are not alone out here, and we should not be afraid of that. Whatever we find, we meet it with open hands.\nI am so sorry.' }); },
    Ossuary: (api, q) => { F_(api, q, 'bones', 0.25); W_(api, q, 'skulls', 4, { decal: true, need: 1 }); F_(api, q, 'skeleton', 2); },
    'Choir of Teeth': (api, q) => { W_(api, q, 'cocoon', 0.3, { need: 2, block: false, color: 0x6a4a5a }); W_(api, q, 'skulls', 2, { decal: true, need: 1 }); logAt(api, q, { title: 'Squad radio', who: 'Sgt. A. Kaminski, 3rd platoon', text: 'The walls are singing. There are faces in the walls and they are singing. Lopez says one of them is his brother.\nThe nodes go quiet when you kill things near them. Then louder. Then something big starts to wake up.' }); },
    'Brood Crypt': (api, q) => { F_(api, q, 'eggs', 0.3); D_(api, q, 'creep', 3); F_(api, q, 'sarcophagus', 2, { open: true }); W_(api, q, 'cocoon', 0.2, { need: 2, block: false, color: 0x5a3a5a }); },
    'The Apse': (api, q) => { const a = api.floor(q, { margin: 1, center: true }); if (a) api.P.altar(a, { bone: true }); F_(api, q, 'crates', 1, { color: MARINE }); body(api, q, { suit: MARINE, gun: true }); F_(api, q, 'barricade', 2); D_(api, q, 'casings', 3); logAt(api, q, { title: 'Unsigned', who: 'The handwriting matches the chaplain', text: 'Come in. Sit. The choir is almost complete and there is room for one more voice.\nShe is sleeping. When she wakes, you will understand. We all understood.' }); },
    "Queen's Throne": (api, q) => { big(api, q, 'throne', 2); F_(api, q, 'eggs', 2, { color: 0xc080ff }); F_(api, q, 'bones', 2); W_(api, q, 'cocoon', 0.3, { need: 2, block: false, color: 0x6a4a5a }); },
  } };

  // =====================================================================
  MS.bastion = { generic: { crates: ['Armory', 'Motor Pool', 'Courtyard'] }, blocks: { Barracks: ['bunks', { label: 'SQUAD BAY', sheet: 0x5a6a4a }], 'Motor Pool': 'vehicle' }, zones: {
    Courtyard: (api, q) => {
      sign(api, q, 'FIRE BASE BASTION 9', { color: '#c8d860' }); const f = api.floor(q, { margin: 1 }); if (f) api.P.flagpole(f, { color: 0x3a5a2a, torn: true });
      long(api, q, 'apc', 2, { burnt: true }); D_(api, q, 'casings', 5); D_(api, q, 'scorch', 3); scrawl(api, q, 'HOLD THE LINE', { color: '#1a1a1a' });
      logAt(api, q, { title: 'Commander\'s log', who: 'Lt. Col. S. Adeyemi', text: 'Day 11. Relief was due on day 7. Ammunition at 30%. We hold the flare posts by day and pull back to the bunker at night.\nWhen relief comes they will look for the flares. If the flares are not lit, they will fly past.' });
    },
    'Motor Pool': (api, q) => { sign(api, q, 'MOTOR POOL'); long(api, q, 'truck', 3); F_(api, q, 'tires', 0.12); F_(api, q, 'jerry', 0.1); F_(api, q, 'barrels', 0.12, { color: 0x3a4a2a }); W_(api, q, 'workbench', 1); },
    Watchtower: (api, q) => { const f = api.floor(q, { margin: 1 }); if (f) api.P.floodlight(f); D_(api, q, 'casings', 3); body(api, q, { suit: MARINE, gun: true, helmet: MARINE }); },
    Barracks: (api, q) => { sign(api, q, 'BARRACKS'); W_(api, q, 'bunk', 0.3, { sheet: 0x4a5a3a }); W_(api, q, 'lockers', 0.1, { color: 0x4a5a3a }); logAt(api, q, { title: 'Letter home', who: 'Pvt. T. Oduya', text: 'Dear Mum, it is quiet tonight, which is good. We found a baby one in a crate and Hollis is keeping it. It follows him around like a dog. Sarge pretends not to see.\nI will write again when relief comes.' }, { table: true }); },
    Armory: (api, q) => { sign(api, q, 'ARMORY - AUTHORIZED PERSONNEL ONLY', { color: '#e0b020' }); W_(api, q, 'gunRack', 0.25); F_(api, q, 'crates', 0.2, { color: 0x3a4a2a, label: 0xe0b020 }); },
    'Command Bunker': (api, q) => { sign(api, q, 'COMMAND'); W_(api, q, 'console', 0.14, { text: 'DAY 12\nNO CONTACT', textColor: '#c8d860' }); F_(api, q, 'table', 1, { map: true, chairs: 3 }); W_(api, q, 'racks', 1); scrawl(api, q, 'IIII IIII I', { color: '#e8e8e8' }); logAt(api, q, { title: 'Radio log, day 11', who: 'Cpl. R. Brennan, signals', text: 'Bastion 9 to any station. We are still here. We are still here. Flare posts 1 to 4 overrun, we are taking them back one at a time.\nIf anyone is listening: we are still here.' }); },
  } };

  // =====================================================================
  MS.selene = { generic: { solar: ['Solar Farm', 'Crater Rim'] }, blocks: { 'Solar Farm': ['machine', { color: 0x9aa0a8, glow: 0xffd040, label: 'INVERTER' }], 'Mass Driver': ['machine', { color: 0x6a7080, glow: 0x60a0ff, label: 'CAPACITOR' }] }, zones: {
    'Hab Ring': (api, q) => { sign(api, q, 'SELENE STATION', { color: '#e0e8ff' }); W_(api, q, 'evaRack', 0.15); F_(api, q, 'oxygen', 0.12); W_(api, q, 'dispenser', 1); logAt(api, q, { title: 'Director\'s log', who: 'Base director K. Iwu', text: 'The void seam is the richest ever found. The cores hum, and the swarm follows the hum: the mites came up with the first big seam.\nIf we get the masts clear, the mass driver can throw every core we have off this moon. The swarm will follow them.' }); },
    'Crater Rim': (api, q) => { long(api, q, 'rover', 1); F_(api, q, 'stakes', 2); body(api, q, { suit: 0xe8e8e8, helmet: 0xe8e8e8, lying: true }); logAt(api, q, { title: 'Last EVA', who: 'Surveyor P. Adeyemi', text: 'Suit at 12 percent. Under the regolith the seam glows like veins, and the veins run toward the base.\nThey came out of the crater wall in a line, following the hum. The rover will not start.\nI am walking for the Rim airlock. If you find this, do not go down into the seam.' }); },
    'Solar Farm': (api, q) => { for (let k = 0; k < 4; k++) big(api, q, 'solar', 2); W_(api, q, 'capacitors', 1); },
    'Landing Pad': (api, q) => { sign(api, q, 'PAD 2', { color: '#e0e8ff' }); big(api, q, 'lander', 2); F_(api, q, 'crates', 2, { color: 0xd8d8d8 }); W_(api, q, 'tanks', 1, { color: 0xd8d8d8 }); },
    'Greenhouse Dome': (api, q) => { F_(api, q, 'hydro', 0.35); F_(api, q, 'planter', 1); },
    'Mass Driver': (api, q) => { sign(api, q, 'MASS DRIVER', { color: '#60a0ff' }); long(api, q, 'rail', 3); W_(api, q, 'capacitors', 2); logAt(api, q, { title: 'Firing solution', who: 'Mass driver engineer F. Chen', text: 'Driver charged. No firing solution: the uplink masts are drowned in chitter from the mites.\nThe masts clean up a little every time one of the things dies near them. Kill enough and I can fire.' }); },
  } };

  // =====================================================================
  MS.starfall = { generic: { plates: ['Crash Site', 'The Bog', 'Drowned Grove', 'Cargo Spill'] }, blocks: { 'Crash Site': 'hull', 'Engine Wreck': ['hull', { fire: true }] }, zones: {
    'Crash Site': (api, q) => { big(api, q, 'hull', 2); F_(api, q, 'tent', 1, { color: 0x3a5a3a }); F_(api, q, 'campfire', 1, { lit: true }); D_(api, q, 'scorch', 3); F_(api, q, 'crates', 2, { color: MARINE }); F_(api, q, 'barricade', 1); F_(api, q, 'jerry', 1); logAt(api, q, { title: 'Sergeant\'s note', who: 'Sgt. M. Kowalski', text: 'The beacons were thrown clear in the crash. Their fuel cells run on biomass: dead anything. There is plenty of that here.\nWe light the beacons, then we signal from the top of the hull. Stay with the wreck.' }); },
    'The Bog': (api, q) => { F_(api, q, 'barrels', 1, { color: 0x6a5a2a }); D_(api, q, 'trail', 1, { color: 0x2a3a10 }); body(api, q, { suit: MARINE, lying: true }); F_(api, q, 'skeleton', 1); F_(api, q, 'crates', 1, { color: MARINE }); },
    Cockpit: (api, q) => { big(api, q, 'cockpit', 2); body(api, q, { suit: 0x3a4a5a, helmet: 0xe8e8e8 }); logAt(api, q, { title: 'Flight recorder', who: 'Dropship Starfall', text: '...engine two flameout. Something in the intake. Brace, brace, brace.\n...pilot to crew, we are down, we are down in the swamp. Everyone out, grab the beacons...' }); },
    'Drowned Grove': (api, q) => { body(api, q, { suit: MARINE, lying: true, gun: true }); body(api, q, { suit: MARINE, lying: true }); F_(api, q, 'crates', 2, { color: MARINE }); },
    'Cargo Spill': (api, q) => { long(api, q, 'container', 2, { burst: true }); F_(api, q, 'crates', 0.2, { color: MARINE, label: 0xe0b020 }); F_(api, q, 'barrels', 0.1); },
    'Engine Wreck': (api, q) => { long(api, q, 'nacelle', 2); W_(api, q, 'generator', 1); D_(api, q, 'scorch', 3); F_(api, q, 'jerry', 2); logAt(api, q, { title: 'Medic\'s log', who: 'Cpl. J. Ruiz, medic', text: 'Six survivors after the crash. Four after the first night. They take the wounded first; they can smell it.\nIf you are reading this, you are the last one. Light the beacons.' }); },
  } };

  // =====================================================================
  MS.vesper = { generic: { crates: ['Hangar', 'Docking Ring'] }, zones: {
    Hangar: (api, q) => { sign(api, q, 'HANGAR BAY 2', { color: '#80a8ff' }); long(api, q, 'shuttle', 3); F_(api, q, 'crates', 0.15, { color: 0x5a6a7a }); F_(api, q, 'forklift', 1); warn(api, q, 'SHUTTLE BLAST ZONE'); logAt(api, q, { title: 'Station log', who: 'Station master H. Obi', text: 'Cargo from the Hesperus shuttle was quarantined in bay 4 for 48 hours as per protocol. At hour 30 the containers were empty. At hour 31 ring B stopped answering.\nDecks 4 to 9 breached. Something is holding the breach open from the inside.' }); },
    'Observation Deck': (api, q) => { W_(api, q, 'window', 0.4, { decal: true, need: 1 }); F_(api, q, 'telescope', 1); F_(api, q, 'chairs', 1); },
    'Docking Ring': (api, q) => { sign(api, q, 'DOCKING RING'); W_(api, q, 'evaRack', 2); warn(api, q, 'AIRLOCK - CHECK SEALS'); logAt(api, q, { title: 'Dock chief\'s note', who: 'Dock chief P. Laine', text: 'The hive grew into the docking clamps to hold its breach nodes in place. Every time one of those things dies near a clamp, the growth there withers a little.\nFree the clamps and the nodes are loose. Then you can seal them.' }); },
    Hydroponics: (api, q) => { F_(api, q, 'hydro', 0.35); F_(api, q, 'planter', 1); },
    'Crew Mess': (api, q) => { F_(api, q, 'table', 0.22); W_(api, q, 'dispenser', 0.1); scrawl(api, q, 'HAPPY BIRTHDAY CHEN!', { color: '#ff6080' }); logAt(api, q, { title: 'Chef\'s note', who: 'Chef A. Moreau', text: 'Made the cake for Chen\'s birthday: chocolate, the real kind, from the last Earth shipment. We were going to surprise her at 19:00.\nIt is still in the fridge.' }); },
    'Core Access': (api, q) => { sign(api, q, 'CORE ACCESS'); W_(api, q, 'capacitors', 2); W_(api, q, 'pipes', 3, { decal: true, need: 1 }); W_(api, q, 'panel', 2, { decal: true, need: 1 }); },
  } };

  // =====================================================================
  MS.temple = { zones: {
    'Sunken Court': (api, q) => { big(api, q, 'digGrid', 2, { block: false }); F_(api, q, 'tent', 2, { color: 0xc8b070 }); F_(api, q, 'crates', 1, { color: 0x8a6a3a }); F_(api, q, 'luggage', 1); F_(api, q, 'floodlight', 1); F_(api, q, 'stakes', 2); logAt(api, q, { title: 'Excavation log', who: 'Lead archaeologist Dr. Y. Tanaka', text: 'The site is older than anything on this world: forty thousand years at least. The carvings show the builders fighting something with too many limbs.\nWe found the seal today. We are opening it tomorrow.' }, { table: true }); },
    'Hall of Idols': (api, q) => { F_(api, q, 'statue', 0.12); F_(api, q, 'bones', 2); D_(api, q, 'blood', 2); },
    'Flooded Shrine': (api, q) => { F_(api, q, 'statue', 2, { color: 0x4a6a6a }); body(api, q, { suit: 0xc8b070, lying: true }); },
    'Serpent Stair': (api, q) => { F_(api, q, 'statue', 1); body(api, q, { suit: 0xc8b070, lying: true }); D_(api, q, 'blood', 2); F_(api, q, 'luggage', 1); },
    'The Tomb': (api, q) => { F_(api, q, 'sarcophagus', 0.25, { open: true }); F_(api, q, 'crates', 1, { color: 0x8a6a3a }); F_(api, q, 'floodlight', 1); logAt(api, q, { title: 'Field journal', who: 'Graduate student L. Haddad', text: 'The idols are not statues. Each one is a lock, and they drank from the creatures the builders killed near them.\nThe builders did not win. They sealed it in and waited. We just let it out.' }); },
    Sanctum: (api, q) => { const a = api.floor(q, { margin: 1, center: true }); if (a) api.P.altar(a, { glow: 0x60ffe0 }); F_(api, q, 'statue', 2); F_(api, q, 'bones', 2); logAt(api, q, { title: 'Translation', who: 'The wardens\' warning, translated by Dr. Tanaka', text: 'Here the First Heart sleeps. Feed the wardens and the way opens.\nDo not open the way.' }); },
  } };

  // the ambient layer: small detail through every zone, by what the place is ([prop, per 45 floor cells, wall|floor, options])
  MS.kestrel.ambient = [['lamp', 1, 'wall', { color: 0xbfd8ff }], ['panel', 0.7, 'wall'], ['pipes', 0.4, 'wall'], ['cables', 0.4, 'wall'], ['claws', 0.3, 'wall'], ['debris', 1.2, 'floor'], ['stripes', 0.4, 'floor']];
  MS.depths.ambient = [['creep', 1.2, 'floor'], ['scorch', 0.6, 'floor'], ['claws', 0.4, 'wall'], ['skulls', 0.3, 'wall']];
  MS.frostfall.ambient = [['lamp', 0.8, 'wall', { color: 0xd8f0ff }], ['panel', 0.6, 'wall'], ['cables', 0.4, 'wall'], ['debris', 0.8, 'floor'], ['stripes', 0.3, 'floor']];
  MS.ark.ambient = [['lamp', 1, 'wall', { color: 0x9affc0 }], ['panel', 0.8, 'wall'], ['pipes', 0.6, 'wall'], ['grime', 0.3, 'wall'], ['debris', 1, 'floor'], ['blood', 0.5, 'floor']];
  MS.dustbasin.ambient = [['lamp', 0.6, 'wall', { color: 0xffc080 }], ['cables', 0.3, 'wall'], ['debris', 0.8, 'floor'], ['stripes', 0.4, 'floor'], ['scorch', 0.3, 'floor']];
  MS.verdant.ambient = [['vines', 1, 'wall'], ['lamp', 0.5, 'wall', { color: 0xc8ffb0 }], ['creep', 0.8, 'floor'], ['debris', 0.5, 'floor']];
  MS.helix.ambient = [['lamp', 1.2, 'wall', { color: 0xe0f0ff }], ['panel', 1, 'wall'], ['debris', 0.8, 'floor'], ['blood', 0.6, 'floor'], ['stripes', 0.4, 'floor']];
  MS.undercroft.ambient = [['pipes', 1, 'wall'], ['grime', 0.8, 'wall'], ['floodLines', 0.5, 'wall'], ['lamp', 0.6, 'wall', { color: 0xffc070 }], ['debris', 0.8, 'floor']];
  MS.glacier.ambient = [['lamp', 0.5, 'wall', { color: 0xffe0b0 }], ['cables', 0.3, 'wall'], ['debris', 0.5, 'floor'], ['claws', 0.3, 'wall'], ['blood', 0.2, 'floor']];
  MS.crucible.ambient = [['lamp', 0.8, 'wall', { color: 0xffb070 }], ['pipes', 0.5, 'wall'], ['cables', 0.4, 'wall'], ['stripes', 0.6, 'floor'], ['scorch', 0.8, 'floor'], ['debris', 0.6, 'floor']];
  MS.cathedral.ambient = [['creep', 1.4, 'floor'], ['skulls', 0.8, 'wall'], ['claws', 0.3, 'wall']];
  MS.bastion.ambient = [['lamp', 0.8, 'wall', { color: 0xffe0a0 }], ['panel', 0.5, 'wall'], ['claws', 0.8, 'wall'], ['cables', 0.4, 'wall'], ['casings', 1, 'floor'], ['debris', 0.8, 'floor']];
  MS.selene.ambient = [['lamp', 1, 'wall', { color: 0xe0e8ff }], ['panel', 0.8, 'wall'], ['cables', 0.5, 'wall'], ['debris', 0.6, 'floor'], ['stripes', 0.5, 'floor']];
  MS.starfall.ambient = [['vines', 0.6, 'wall'], ['cables', 0.3, 'wall'], ['debris', 0.6, 'floor'], ['scorch', 0.5, 'floor'], ['blood', 0.3, 'floor']];
  MS.vesper.ambient = [['lamp', 1, 'wall', { color: 0xc8d8ff }], ['panel', 1, 'wall'], ['window', 0.6, 'wall'], ['debris', 0.6, 'floor'], ['stripes', 0.4, 'floor'], ['blood', 0.3, 'floor']];
  MS.temple.ambient = [['vines', 1, 'wall'], ['creep', 0.4, 'floor'], ['skulls', 0.2, 'wall']];

  // floors: each zone's surface, by what the room was for
  MS.kestrel.floors = { 'Landing Pad': 'concrete', 'Loading Dock': 'oil', Refinery: 'grate', Barracks: 'plank', 'Command Center': 'tile' };
  MS.frostfall.floors = { 'Comms Array': 'grate', 'Hab Domes': 'carpet', 'Cryo Lab': 'lino' };
  MS.ark.floors = { 'Central Concourse': 'tile', 'Crew Quarters': 'carpet', Bridge: 'metal', 'Reactor Core': 'grate', 'Engine Room': 'plate' };
  MS.dustbasin.floors = { 'Loading Yard': 'gravel', 'Ore Crusher': 'plate', Bunkhouse: 'plank', 'Relay Tower': 'concrete' };
  MS.verdant.floors = { 'Research Atrium': 'tile', Greenhouse: 'grate', 'Specimen Hall': 'lino', 'Overgrown Dock': 'plank' };
  MS.helix.floors = { Lobby: 'tile', 'Cryo Storage': 'plate', 'Gene Lab': 'lino', Containment: 'rubber', Surgery: 'tile', 'Reactor Room': 'grate' };
  MS.undercroft.floors = { 'Pump Station': 'plate', Maintenance: 'concrete' };
  MS.glacier.floors = { 'Buried Camp': 'rubber' };
  MS.crucible.floors = { 'Casting Floor': 'plate', Smelter: 'grate', 'Cooling Yard': 'concrete', 'Forge Hall': 'metal', 'Crucible Core': 'grate' };
  MS.bastion.floors = { Courtyard: 'gravel', 'Motor Pool': 'oil', Barracks: 'plank', Armory: 'plate', 'Command Bunker': 'tile' };
  MS.selene.floors = { 'Hab Ring': 'rubber', 'Solar Farm': 'grate', 'Landing Pad': 'concrete', 'Greenhouse Dome': 'grate', 'Mass Driver': 'plate' };
  MS.starfall.floors = { Cockpit: 'metal' };
  MS.vesper.floors = { Hangar: 'plate', 'Observation Deck': 'carpet', 'Docking Ring': 'metal', Hydroponics: 'grate', 'Crew Mess': 'tile', 'Core Access': 'grate' };

  // the log panel and a first-time tip
  if (XH.TIPS) XH.TIPS.log = ['LOGS', 'Press E on a glowing datapad to read it. Every map has three, and they tell you what happened here.'];
})();
