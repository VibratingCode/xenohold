'use strict';
// Game content data: arenas, perks, power-ups.

// Light entries: [cellX, cellY, color, intensity, distance]
XH.MAPS = [
  {
    id: 'kestrel', name: 'Outpost Kestrel', sub: 'Mining colony · Night · Storm',
    desc: 'A rain-lashed mining outpost on a dead moon. The colonists went quiet three nights ago. Hold the landing pad, break into the barracks and refinery, and get the command center\'s power back online.',
    difficulty: 1, theme: 'outpost', weather: 'rain', ceiling: false, wallH: 6, power: true, music: 'kestrel',
    accent: '#5fd0ff',
    fog: { color: 0x0b141c, density: 0.021 },
    ambient: { sky: 0x5a7898, ground: 0x1a1410, i: 0.62 }, moon: { color: 0x9ab4d8, i: 0.45 }, bloomT: 0.86,
    sky: { top: 0x04070c, mid: 0x0d1a26, bottom: 0x1a2c3c, stars: true, planet: { color: 0xb0784a, ring: true, dir: [0.5, 0.35, -0.8], size: 70 } },
    lights: [[23, 21, 0xbfd8ff, 1.5, 34], [22, 11, 0xffb060, 1.2, 22], [7, 24, 0xd0e0ff, 1.1, 22], [9, 8, 0xff9a40, 1.2, 26], [37, 9, 0x40e0d0, 1.2, 26], [37, 25, 0x40e0d0, 1.2, 26]],
    doors: { 1: { cost: 750, name: 'Barracks' }, 2: { cost: 1000, name: 'Refinery' }, 3: { cost: 1250, name: 'Command Center' }, 4: { cost: 1000, name: 'Refinery Access' } },
    buys: { a: 'carbine', b: 'breacher', c: 'pulse', d: 'burst', e: 'rail' },
  },
  {
    id: 'depths', name: 'Char Depths', sub: 'Volcanic hive caverns · Infested',
    desc: 'Molten caverns where the swarm has taken root. The ground is creep, the walls breathe, and the lava does not care whose side you are on. There is no power down here. The Brood has already claimed everything.',
    difficulty: 3, theme: 'hive', weather: 'embers', ceiling: false, wallH: 8, power: false, music: 'depths',
    accent: '#ff6a3a',
    fog: { color: 0x1a0806, density: 0.03 },
    ambient: { sky: 0x8a4038, ground: 0x2a0a18, i: 0.7 }, moon: { color: 0xff7040, i: 0.3 },
    sky: { top: 0x080202, mid: 0x200806, bottom: 0x4a1408, stars: false },
    lights: [[25, 28, 0xff5a20, 1.6, 30], [8, 27, 0xff7a20, 1.5, 24], [10, 10, 0x9dff3a, 1.3, 26], [25, 8, 0xc040ff, 1.4, 24], [38, 14, 0x40e8ff, 1.5, 30]],
    doors: { 1: { cost: 750, name: 'Magma Rift' }, 2: { cost: 1000, name: 'Spawning Pools' }, 3: { cost: 1250, name: 'Crystal Grotto' }, 4: { cost: 1250, name: 'Tyrant\'s Nest' } },
    buys: { a: 'carbine', b: 'breacher', c: 'burst', d: 'rail', e: 'pulse' },
  },
  {
    id: 'frostfall', name: 'Frostfall Relay', sub: 'Arctic comms station · Blizzard',
    desc: 'A deep-space relay buried in ice. The last transmission was a scream and forty seconds of chittering. Open sightlines and wide fields. Watch the sky, because something is flying out there.',
    difficulty: 2, theme: 'ice', weather: 'snow', ceiling: false, wallH: 7, power: true, music: 'frostfall',
    accent: '#a8e8ff',
    mist: [0xb0c0d0, 0.12],
    skin: { floorTint: 0xaab6c4 },
    fog: { color: 0x687a8e, density: 0.026 },
    ambient: { sky: 0x98acc0, ground: 0x343e4a, i: 0.4 }, moon: { color: 0xd8e8ff, i: 0.26 }, bloomT: 0.96,
    sky: { top: 0x5a6e84, mid: 0x8ca2b8, bottom: 0xb4c6d6, stars: false },
    lights: [[24, 25, 0xd8f0ff, 1.3, 34], [6, 25, 0xffc080, 1.2, 22], [23, 8, 0x80b8ff, 1.2, 28], [40, 12, 0x40ffe0, 1.2, 24], [40, 27, 0x40ffe0, 1.2, 24], [7, 7, 0xc0e0ff, 1, 24]],
    doors: { 1: { cost: 750, name: 'Hab Domes' }, 2: { cost: 1000, name: 'Comms Array' }, 3: { cost: 1250, name: 'Cryo Lab' }, 4: { cost: 1000, name: 'Frozen Lake' } },
    buys: { a: 'carbine', b: 'breacher', c: 'pulse', d: 'rail', e: 'burst' },
  },
  {
    id: 'ark', name: 'Derelict Ark', sub: 'Colony ship · Adrift · Life support failing',
    desc: 'A colony ark drifting dark with something nesting in its reactor. Tight corridors, hard corners and nowhere to run. Get to the bridge, restore power and keep the core from becoming a hatchery.',
    difficulty: 2, theme: 'ship', weather: 'spores', ceiling: true, wallH: 5, power: true, music: 'ark',
    accent: '#7dff9a',
    fog: { color: 0x050807, density: 0.035 },
    ambient: { sky: 0x60806a, ground: 0x181410, i: 0.65 }, moon: null,
    sky: null,
    lights: [[22, 19, 0x60ff90, 1.4, 26], [6, 17, 0xff3030, 1.3, 26], [22, 5, 0x6090ff, 1.3, 24], [37, 17, 0xff9030, 1.8, 30], [21, 31, 0xff3a30, 1.3, 24]],
    doors: { 1: { cost: 750, name: 'Crew Quarters' }, 2: { cost: 1000, name: 'Bridge' }, 3: { cost: 1250, name: 'Reactor Core' }, 4: { cost: 1000, name: 'Engine Room' } },
    buys: { a: 'carbine', b: 'burst', c: 'breacher', d: 'pulse', e: 'rail' },
  },
  {
    id: 'city', featured: 'NEW · MEGA MAP', name: 'Hesperus City', sub: 'Colony capital · Quarantine breached · Night',
    desc: 'The colony capital, nine districts sealed behind quarantine walls that did not hold. Neon still burns over empty streets. Skyscrapers, alleys, parks and a crater where the hive broke through. Categorically huge. Bring friends. You have none.',
    difficulty: 3, theme: 'city', weather: 'ash', ceiling: false, wallH: 6, power: true, music: 'city',
    accent: '#ff4fd8',
    fog: { color: 0x1c1220, density: 0.0105 },
    ambient: { sky: 0x7a6a9a, ground: 0x2a1a14, i: 0.62 }, moon: { color: 0xb8a8ff, i: 0.32 }, bloomT: 0.74,
    sky: { top: 0x040308, mid: 0x160c20, bottom: 0x5a2616, stars: false, city: true },
    lights: [[16, 16, 0xffb060, 1.2, 40], [48, 16, 0xff40d0, 1.4, 40], [80, 12, 0x80b0ff, 1.3, 40], [16, 48, 0xffa050, 1.2, 40], [48, 44, 0xd8e8ff, 1.6, 46], [80, 48, 0x60ff90, 1.0, 40], [16, 80, 0xffc080, 1.1, 40], [48, 80, 0x60c0ff, 1.3, 40], [81, 81, 0xff3060, 1.6, 44]],
    doors: { 1: { cost: 750, name: 'Neon District' }, 2: { cost: 1000, name: 'Central Park' }, 3: { cost: 1000, name: 'Metro Station' }, 4: { cost: 750, name: 'Market Street' }, 5: { cost: 1500, name: 'The Docks' }, 6: { cost: 2000, name: 'Capitol Hill' }, 7: { cost: 1500, name: 'Capitol Hill' }, 8: { cost: 2500, name: 'The Hive Crater' }, 9: { cost: 2500, name: 'The Hive Crater' }, 0: { cost: 1500, name: 'Residential Blocks' } },
    buys: { a: 'talon', b: 'kestrel9', c: 'riot8', d: 'rook45', e: 'sentinel', f: 'wasp', g: 'grim', h: 'longbow', i: 'hailstorm', j: 'ranger', k: 'brigand', l: 'slughammer', m: 'viper', n: 'ionripper' },
  },
];

XH.PERKS = {
  J: { id: 'titan', name: 'Titan Plating', cost: 2500, color: 0xff3030, css: '#ff4040', icon: '⬢', desc: 'Max health 100 → 250' },
  R: { id: 'rapid', name: 'Rapid Cycler', cost: 3000, color: 0x30ff60, css: '#40ff70', icon: '⟳', desc: 'Reload 50% faster' },
  D: { id: 'overclock', name: 'Overclock', cost: 2000, color: 0xffb020, css: '#ffc040', icon: '»', desc: '+33% fire rate, +25% damage' },
  A: { id: 'afterburner', name: 'Afterburner', cost: 2000, color: 0x30d0ff, css: '#40d8ff', icon: '➤', desc: 'Faster sprint, unlimited stamina' },
  L: { id: 'lazarus', name: 'Lazarus Protocol', cost: 1500, color: 0x40a0ff, css: '#60b0ff', icon: '✚', desc: 'Revive yourself once when downed' },
  V: { id: 'vampire', name: 'Leech Rounds', cost: 2500, color: 0xc040ff, css: '#d060ff', icon: '♥', desc: 'Kills restore health; melee does 3× damage' },
  E: { id: 'holster', name: 'Extra Holster', cost: 4000, color: 0x50ff50, css: '#60ff60', icon: '✦', desc: 'Carry a third weapon; keep reloading while you sprint' },
  I: { id: 'plating', name: 'Shock Plating', cost: 2000, color: 0x9050ff, css: '#a070ff', icon: '✹', desc: 'Immune to your own explosions; jump landings detonate' },
  Q: { id: 'discharge', name: 'Arc Discharge', cost: 2000, color: 0x50e0ff, css: '#70e8ff', icon: 'ϟ', desc: 'Reloading releases an electric blast' },
  N: { id: 'neural', name: 'Neural Link', cost: 1500, color: 0xe8e8e8, css: '#f0f0f0', icon: '◎', desc: 'Aiming snaps to heads; +25% headshot damage' },
};
// First-time gameplay tips: [title, text]
XH.TIPS = {
  pickup: ['POWER-UPS', 'Glowing icons dropped by creatures are power-ups. Walk straight into one to use it instantly. They blink and vanish after about 25 seconds.'],
  pu_nuke: ['ORBITAL STRIKE', 'Walk into the yellow ☢ icon and a strike from orbit kills every creature on the map.'],
  pu_insta: ['INSTA-KILL', 'Walk into the red ☠ icon: for 30 s every creature (except bosses) dies in one hit.'],
  pu_double: ['DOUBLE BOUNTY', 'Walk into the x2 icon to double all points for 30 s.'],
  pu_ammo: ['MAX AMMO', 'Walk into the green icon to refill every weapon and your grenades.'],
  pu_sale: ['FIRE SALE', 'Walk into the $ icon: the Xeno Cache costs almost nothing for 30 s.'],
  pu_perk: ['MUTAGEN VIAL', 'Walk into the pink ✚ icon for a free random perk.'],
  door: ['DOORS', 'Press E next to a sealed door to buy it. New zones have more weapons, perks and the power generator.'],
  wallbuy: ['WALL WEAPONS', 'Press E to buy the gun on the wall. Buying it again later refills its ammo for half price.'],
  perk: ['PERK MACHINES', 'Press E to buy a perk. Perks need power, and you can own one of every perk.'],
  box: ['XENO CACHE', 'Press E to roll a random weapon (or Lure Beacons), then press E again to take it. The cache sometimes flees to another spot.'],
  forge: ['MUTATION FORGE', 'Press E to mutate the gun in your hands: huge damage, more ammo and a random mutation effect. Needs power.'],
  power: ['GENERATOR', 'Press E to restore power. It switches on the lights, your motion tracker (the minimap only senses creatures close by without it), the sentry guns, the perk machines and the Mutation Forge.'],
  trap: ['TRAPS', 'Press E to fire the trap on this door for 1000 points. It shreds anything passing through for a few seconds.'],
  capsule: ['MUTAGEN CAPSULES', 'Press E for a random one-shot buff. Up to 3 per round, each costs more.'],
  part: ['SHIELD PARTS', 'Collect all 3 parts, then build the Hive Shield at the workbench.'],
  bench: ['WORKBENCH', 'With 3 parts, press E to build the Hive Shield. Hold X to raise it; fire while it is raised to bash.'],
  egg: ['STRANGE EGG', 'Something is alive inside. Press E. There are three of them…'],
  pylon: ['HIVE NODE', 'Press E to awaken it, then kill creatures nearby to feed it souls.'],
  heart: ['HIVE LINK', 'Press E to sever the link. Be ready for what comes out.'],
  vent: ['VENTS', 'Hold E to board up a vent: creatures take longer to break through, and you earn points.'],
  lure: ['LURE BEACON', 'Press T to throw a Lure Beacon. Creatures chase it, then it explodes.'],
  companion: ['COMPANION', 'Kit follows you and bites whatever gets close. If it is cornered it goes down, and gets back up 25 seconds later.'],
  altar: ['BONE ALTAR', 'Something on this map is watching you. Find what is watching and the altar will answer.'],
  discharge: ['GROUND DISCHARGE', 'Your Pack-a-Punched electric gun discharges where it lands: shoot the ground near creatures and bolts leap out to them. Any electric gun can also set off a chain storm now and then.'],
  wonder: ['WONDER WEAPON', 'Every map hides three parts for its own wonder weapon. Bring them to the Wonder Bench to build it. If you lose it, the bench rebuilds it.'],
  decoy: ['DECOY HOLOGRAM', 'Press T to throw a Decoy Hologram. Creatures attack the copy of you until it breaks.'],
  shield: ['HIVE SHIELD', 'Hold X to raise the shield and block hits from the front. Fire while raised to bash. Lowered, it guards your back.'],
  grenade: ['GRENADES', 'Press G to throw a frag grenade. You get more every round.'],
  jumppad: ['JUMP PADS', 'Step on the glowing pad to be thrown up onto the roof or platform next to it.'],
  zipline: ['ZIPLINES', 'Press E at the green light on a roof or platform to slide down the cable to the far end. Creatures cannot follow you on it.'],
  turret: ['DEPLOYABLE TURRET', 'Press G to set down a turret. It fights for 30 seconds and uses two lethal charges.'],
  ammo: ['AMMO RESTOCK', 'Press E to fill every weapon you carry. It is expensive and works once per round, so Max Ammo drops still matter.'],
  ladder: ['LADDERS', 'Press E at the foot of a ladder to climb onto the roof, and at the top to climb down. You can also jump at low ledges to pull yourself up.'],
  teleporter: ['TELEPORTERS', 'Stand on a pad for a moment to jump to its twin. Pads need power, and a clear way between them.'],
  revive: ['SELF-REVIVE', 'You went down but got back up. Solo you have 3 self-revives per game (fewer with teammates): the crosses above your health bar. Lazarus Protocol revives you faster without using one.'],
  boss: ['HIVE TYRANT', 'Shoot the glowing pustules and jump its shockwave rings. It cannot attack you without line of sight, but if it loses you for 2 minutes it burrows closer.'],
};
XH.PERK_LIMIT = Object.keys(XH.PERKS).length; // one of every perk

// Mutation effects rolled onto weapons in the Mutation Forge (random proc on hit)
XH.AATS = {
  shock: { name: 'Chain Shock', css: '#8fd0ff', color: 0x8fd0ff },
  furnace: { name: 'Blast Furnace', css: '#ff8a30', color: 0xff8a30 },
  cryo: { name: 'Cryo Nova', css: '#a8f0ff', color: 0xa8f0ff },
  gravity: { name: 'Gravity Well', css: '#c060ff', color: 0xc060ff },
  turned: { name: 'Turned', css: '#70ff70', color: 0x70ff70 },
};

// Mutagen Capsules: one-shot buffs from the capsule machine (weight = rarity)
XH.CAPSULES = [
  { id: 'surge', name: 'Mutagen Surge', desc: 'A free perk, even past the limit', css: '#ff60d0', w: 3 },
  { id: 'ghost', name: 'Phase Shift', desc: 'The swarm cannot see you for 12 seconds', css: '#90b0ff', w: 3 },
  { id: 'killswitch', name: 'Kill Switch', desc: 'Everything on the field dies', css: '#ffe040', w: 2 },
  { id: 'bottomless', name: 'Bottomless Mag', desc: 'Infinite ammo for 30 seconds', css: '#50ff70', w: 3 },
  { id: 'windfall', name: 'Windfall', desc: '+2,500 points', css: '#ffd860', w: 3 },
  { id: 'undying', name: 'Undying', desc: 'Nothing can kill you for 45 seconds', css: '#ff5050', w: 2 },
  { id: 'resupply', name: 'Resupply', desc: 'Max Ammo, right now', css: '#50ff70', w: 3 },
  { id: 'bloodlust', name: 'Bloodlust', desc: 'Insta-Kill for 30 seconds', css: '#ff3030', w: 2 },
  { id: 'perkaholic', name: 'Perkaholic', desc: 'Every perk on the map', css: '#ff60d0', w: 0.5 },
];

// Main quest flavor per arena
XH.QUESTS = {
  kestrel: { node: 'Comms Uplink', nodes: 'Comms Uplinks', heart: 'Hive Heart', intro: ['LV-9 MINING COLONY', 'Local time 23:47. Three nights since last contact.'] },
  depths: { node: 'Psionic Node', nodes: 'Psionic Nodes', heart: 'Hive Heart', intro: ['MAGMA CAVERNS, SUBLEVEL 4', 'The ground here is alive. Tread carefully.'] },
  frostfall: { node: 'Relay Dish', nodes: 'Relay Dishes', heart: 'Hive Heart', intro: ['DEEP-SPACE RELAY FROSTFALL', 'Outside temperature: -62°C. Something is transmitting.'] },
  city: { node: 'Broadcast Relay', nodes: 'Broadcast Relays', heart: 'Hive Heart', intro: ['HESPERUS CITY, COLONY CAPITAL', 'Population 2.1 million. Quarantine breached 06:12.'] },
  ark: { node: 'Stasis Pod', nodes: 'Stasis Pods', heart: 'Hive Heart', intro: ['COLONY ARK "PROVIDENCE"', 'Reactor at 14%. Life signs: 1 human, many others.'] },
};

// The Hive Mind talks to you. Original lines.
XH.VOICE = {
  start: ['You should not have come here.', 'Another one. How delicious.', 'We have been waiting for you.'],
  round: ['They are coming.', 'We are many. You are one.', 'The brood grows hungry.', 'Every round you survive, we learn.', 'Your walls will not hold.', 'Do you hear them scratching?'],
  swarm: ['The swarm descends!', 'Feel the chorus of our children!', 'Run, little one. Run!'],
  boss: ['Kneel before the Tyrant.', 'Our apex has come for you.', 'The Tyrant hungers.'],
  power: ['Light will not save you.', 'You wake the machines. We wake too.'],
  perk: ['Chemicals. How desperate.', 'Enhance yourself. It changes nothing.', 'Drink deep. You will need it.'],
  door: ['Deeper into our home. Good.', 'More rooms. More places to die.'],
  boxLeave: ['Mine now.', 'The cache belongs to the hive.'],
  lowhp: ['Your heart falters. We can hear it.', 'Soon.', 'So fragile.'],
  forge: ['You twist our flesh into weapons? Clever.', 'That weapon is tainted now.'],
  pylon: ['What are you doing? Leave that alone!', 'That node is ours!', 'Stop feeding it!'],
  pylonsDone: ['No. You cannot sever us!', 'The link is... weakening.'],
  finale: ['Then face the Overmind!', 'We will end this ourselves.'],
  eggs: ['Our young! What have you done?', 'You will pay for that.'],
  capsule: ['Tampering with our essence?', 'Such a small, desperate gamble.'],
  shield: ['A shield. As if metal could stop us.'],
  trap: ['You burn our children!', 'Cruel. We approve.'],
  victory: ['This is not... the end...'],
  down: ['There you are. On your knees.'],
};


XH.POWERUPS = {
  ammo: { name: 'Max Ammo', color: 0x40ff60, css: '#50ff70', glyph: '▮▮▮', say: 'Max ammo!', desc: 'Every weapon and grenade refilled' },
  nuke: { name: 'Orbital Strike', color: 0xffe040, css: '#ffe860', glyph: '☢', say: 'Orbital strike!', desc: 'Every creature on the map is vaporised. +400 points' },
  double: { name: 'Double Bounty', color: 0xffb020, css: '#ffc040', glyph: 'x2', say: 'Double bounty!', desc: 'All points doubled for 30 seconds' },
  insta: { name: 'Insta-Kill', color: 0xff3030, css: '#ff4a4a', glyph: '☠', say: 'Insta kill!', desc: 'Everything except bosses dies in one hit for 30 seconds' },
  sale: { name: 'Fire Sale', color: 0x40c0ff, css: '#60d0ff', glyph: '$', say: 'Fire sale!', desc: 'The Xeno Cache is dirt cheap for 30 seconds' },
};

// =================== Difficulty & mutators ===================
// Every setting contributes HEAT (positive = harder). Presets are just starting points.
(function () {
  const pct = (v) => Math.round(v * 100) + '%';
  const MODS = XH.MODS = {
    sliders: [
      { id: 'hp', name: 'Creature health', min: 0.5, max: 4, step: 0.25, def: 1, fmt: pct, heat: (v) => (v - 1) * (v > 1 ? 8 : 6) },
      { id: 'speed', name: 'Creature speed', min: 0.75, max: 1.5, step: 0.05, def: 1, fmt: pct, heat: (v) => (v - 1) * 20 },
      { id: 'dmg', name: 'Creature damage', min: 0.5, max: 3, step: 0.25, def: 1, fmt: pct, heat: (v) => (v - 1) * 6 },
      { id: 'horde', name: 'Horde size', min: 0.5, max: 3, step: 0.25, def: 1, fmt: pct, heat: (v) => (v - 1) * 5 },
      { id: 'density', name: 'Horde density', min: 0.5, max: 2, step: 0.25, def: 1, fmt: pct, heat: (v) => (v - 1) * 8, hint: 'How many can be alive at once' },
      { id: 'points', name: 'Points earned', min: 0.5, max: 2, step: 0.25, def: 1, fmt: pct, heat: (v) => -(v - 1) * 6 },
      { id: 'startPts', name: 'Starting points', options: [0, 500, 1500, 5000, 20000], def: 500, fmt: (v) => v.toLocaleString('en-US'), heat: (v) => ({ 0: 2, 500: 0, 1500: -1, 5000: -3, 20000: -6 })[v] || 0 },
    ],
    toggles: [
      { id: 'earlyEvo', name: 'Accelerated Evolution', desc: 'Every species can appear from round 1.', heat: 4 },
      { id: 'elite', name: 'Elite Brood', desc: 'All creatures are hardened elites with twice the health.', heat: 6 },
      { id: 'frenzy', name: 'Frenzy', desc: 'Skitterlings are always frenzied: faster and burning bright.', heat: 3 },
      { id: 'regen', name: 'Regenerating Swarm', desc: 'Wounded creatures knit back together if left alone.', heat: 3 },
      { id: 'acid', name: 'Acid Blood', desc: 'Every kill leaves a pool of burning acid.', heat: 3 },
      { id: 'bossRush', name: 'Tyrant\'s Reign', desc: 'A boss comes every 4th round instead of every 8th.', heat: 5 },
      { id: 'swarmRounds', name: 'Endless Swarm', desc: 'Swarm rounds every 3rd round.', heat: 3 },
      { id: 'relentless', name: 'Relentless', desc: 'Barely a breath between rounds.', heat: 2 },
      { id: 'noRegen', name: 'Bleeding Out', desc: 'No health regeneration during a round. You heal between rounds.', heat: 5 },
      { id: 'oneLife', name: 'One Life', desc: 'No self-revives, and Lazarus Protocol is disabled.', heat: 3 },
      { id: 'glass', name: 'Glass Cannon', desc: 'Half health, double damage.', heat: 2 },
      { id: 'scarcity', name: 'Scarcity', desc: 'Half ammo reserves. One grenade per round.', heat: 3 },
      { id: 'loadout', name: 'Tailored Loadout (sandbox)', desc: 'Start with the loadout you built from gear you unlocked by playing: guns, perks and lethal. Set it up in Classes > Loadout.', heat: -8 },
      { id: 'inflation', name: 'Inflation', desc: 'Doors, weapons, perks, the Cache and the Forge cost double.', heat: 3 },
      { id: 'noDrops', name: 'No Power-ups', desc: 'Creatures never drop power-ups.', heat: 3 },
      { id: 'blackout', name: 'Blackout', desc: 'Power can never be restored. No perks, no Mutation Forge.', heat: 5 },
      { id: 'fog', name: 'Fog of War', desc: 'Suffocating fog and no minimap.', heat: 2 },
      { id: 'classic', name: 'Classic Spawning', desc: 'Turn off the Director: a steady stream of creatures with no build-ups, breathers, flanks or adapting.', heat: 0 },
      { id: 'armed', name: 'Armed to the Teeth', desc: 'Start with a mutated AR-77 Nova Pulse.', heat: -4 },
    ],
    // Per-arena options. Each choice: [value, label, heat]. Negative heat = easier, positive = harder, 0 = standard.
    arena: [
      { id: 'a_tod', name: 'Time of day', choices: [['night', 'As designed', 0], ['dusk', 'Dusk: brighter, thinner fog', -1], ['day', 'Daylight: you can see everything coming', -3], ['black', 'Pitch black: dark and foggy', 3]] },
      { id: 'a_weather', name: 'Weather', choices: [['normal', 'As designed', 0], ['clear', 'Clear skies: no rain, snow or ash', -1], ['storm', 'Storm: heavy weather and thick air', 2]] },
      { id: 'a_power', name: 'Power', choices: [['normal', 'Find the generator', 0], ['on', 'Power is on from the start', -2]] },
      { id: 'a_doors', name: 'Doors', choices: [['sealed', 'Sealed: buy your way in', 0], ['open', 'All open: creatures pour in from every zone', 2]] },
      { id: 'a_roster', name: 'Creature roster', choices: [['full', 'Full roster', 0], ['light', 'No Behemoths, Burrowers or Broodmothers', -3], ['nobosses', 'No Hive Tyrant rounds', -4], ['heavy', 'Heavies arrive from round 3', 4]] },
      { id: 'a_hazards', name: 'Hazards', choices: [['on', 'Lava and acid floors burn', 0], ['off', 'Hazards are harmless', -1]] },
      { id: 'a_cache', name: 'Xeno Cache', choices: [['roam', 'Flees to new spots', 0], ['fixed', 'Never moves', -1]] },
      { id: 'a_refill', name: 'Wall-buy refills', choices: [['normal', 'Half price', 0], ['free', 'Free', -2], ['none', 'No refills at all', 2]] },
      { id: 'a_start', name: 'Starting loadout', choices: [['class', 'Your class sidearm', 0], ['armed', 'Plus a random wall weapon', -2]] },
      { id: 'a_perks', name: 'Perk limit', choices: [['all', 'One of every perk', 0], ['four', 'Only 4 perks', 3]] },
      { id: 'a_lives', name: 'Self-revives', choices: [['team', 'By team size: 3 solo', 0], ['five', '5 self-revives', -2], ['one', 'Just 1', 2], ['none', 'None: going down ends the run', 4]] },
    ],
  };
  // Self-revives are inversely proportional to the team size: 3 solo, 2 for two players, 1 for three or four.
  XH.SELF_REVIVES = (players) => Math.max(1, Math.round(3 / Math.max(1, players)));
  MODS.defaults = () => {
    const m = {};
    for (const s of MODS.sliders) m[s.id] = s.def;
    for (const t of MODS.toggles) m[t.id] = false;
    for (const a of MODS.arena) m[a.id] = a.choices[0][0];
    return m;
  };
  MODS.arenaDefaults = () => { const m = {}; for (const a of MODS.arena) m[a.id] = a.choices[0][0]; return m; };
  MODS.choiceHeat = (a, v) => { const c = a.choices.find((q) => q[0] === v); return c ? c[2] : 0; };
  const P = (o) => Object.assign(MODS.defaults(), o);
  MODS.presets = {
    recruit: { name: 'Recruit', desc: 'Softer swarm, fat wallet, big gun.', mods: P({ hp: 0.75, speed: 0.9, dmg: 0.5, points: 1.5, startPts: 1500, armed: true }) },
    veteran: { name: 'Veteran', desc: 'The intended experience.', mods: P({}) },
    nightmare: { name: 'Nightmare', desc: 'Tougher, faster, earlier. Acid everywhere.', mods: P({ hp: 1.5, speed: 1.1, dmg: 1.5, horde: 1.25, density: 1.25, earlyEvo: true, acid: true, oneLife: true }) },
    hell: { name: 'Hell', desc: 'You will not survive. Prove it wrong.', mods: P({ hp: 2.5, speed: 1.25, dmg: 2, horde: 1.5, density: 1.5, earlyEvo: true, frenzy: true, acid: true, bossRush: true, swarmRounds: true, relentless: true, noRegen: true, oneLife: true, inflation: true }) },
  };
  MODS.heat = (m) => {
    let h = 0;
    for (const s of MODS.sliders) h += s.heat(m[s.id]);
    for (const t of MODS.toggles) if (m[t.id]) h += t.heat;
    for (const a of MODS.arena) h += MODS.choiceHeat(a, m[a.id]);
    return Math.round(h);
  };
  MODS.tier = (h) => h < -2 ? { name: 'RELAXED', css: '#60d0ff' } : h <= 2 ? { name: 'STANDARD', css: '#7dff9a' } : h < 15 ? { name: 'HARD', css: '#ffd860' }
    : h < 35 ? { name: 'NIGHTMARE', css: '#ff8a3a' } : h < 70 ? { name: 'HELL', css: '#ff3a2a' } : { name: 'ABYSS', css: '#d050ff' };
  MODS.presetOf = (m) => {
    for (const k in MODS.presets) { const pm = MODS.presets[k].mods; if (Object.keys(pm).every((q) => q.startsWith('a_') || pm[q] === m[q])) return k; }
    return null;
  };
})();
