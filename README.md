# XENOHOLD

**Version 0.0.1.4**

### What's new in 0.0.1.4
- **Big fights run much smoother.** Every creature is now drawn as a handful of skinned meshes instead of 26 to 40 separate parts (the same models, moving exactly as before), which roughly halves what a crowd costs to draw. Creatures that are off screen or completely behind walls and closed doors are not drawn at all, and animate at a lower rate until they come back into view.

### What's new in 0.0.1.3
- **Electric guns hit harder.** Pack-a-Punched electric guns (Arc Lance, Spark Pistol, Tesla Coil Gun, Stormbreaker, Ionic AR, Pulse Cannon) discharge where their rounds land: shoot the ground near creatures and bolts leap out to up to eight of them. And any electric gun, upgraded or not, now and then sets off a chain storm that leaps from creature to creature through up to 50 of them.
- **Fixed:** Back on the Classes screen could send you to the Tailored Loadout and back forever instead of returning to the main menu.

### What's new in 0.0.1.2
- **Map editor: triggers and scripted events.** When the player walks into an area, presses a button, pulls a lever, shoots a target, a round starts, enough creatures die or the power comes on: open doors, switch zones, traps and machinery on or off, spawn creatures or a boss where you want, show messages, play sounds, cut or restore the power, teleport the player, blow things up or win the map. Link pieces by clicking them; the plan draws the wiring.
- **Moving and breakable pieces.** Blast doors, elevators, moving platforms that carry you, extending bridges, walls you blow open, secret walls, mounted machine guns you man with E, and ziplines you place yourself.
- **Waves per map.** Which creatures come from which round, boss and swarm rounds, which boss, and how many, how fast and how many at once. Boss and creature spawn points are markers you place.
- **New creature: the Drowner.** It lives in deep water, crosses it fast and unseen, and comes out right next to you. Burrowers now rush through mud and quicksand, and flying creatures ride the wind.
- **A much faster, more powerful editor.** It only redraws when something changes, merges placed pieces into a few batches (a busy map went from over 1,000 draw calls to about 200), rebuilds about three times faster, and shows live stats. New: a Scene panel (find, select, hide and lock everything by kind), a 3D move, lift and turn gizmo, snap and turn-step settings, **▶ Here** to play from where the camera is (god mode and start round optional), resizing your own maps, copying and pasting regions of tiles, and one-click pits under water and lava zones.
- **Your own maps stay exactly as you made them.** Nothing places itself on them any more: traps, the altar, eyes, egg, bench, ammo station, sentries and theme clutter are only there if you put them there, from the new Game pieces list.
- **Faster in game.** Small models the fog has swallowed are no longer drawn, and wall weapon boards are merged into far fewer pieces.

### What's new in 0.0.1.1
- **Map editor: make your own maps.** **+ New map** starts one from scratch: name it, pick which arena's look it borrows (lighting, sky, weather, music, props and creatures), choose a size, and start from an empty arena, four rooms joined by doors, or a copy of an arena's layout. Every editor tool works on it, and once saved it shows up in the game's arena list.
- **Map editor: finds the maps from the game's own map maker.** Maps built with the simple map maker in the main menu now appear in the editor's map list. Pick one to copy it in and build it out with props, zones, traps, height and lighting.
- **Fixed: saving could fail** when the game folder sits deep inside other folders (Windows' 260-character path limit). The editor now saves at any path length.

### What's new in 0.0.1.0
- **Map editor: zones.** Drag out an area and it does something to whoever is in it. Deadly: instant death (a black drop, a red haze or invisible), lava, deep water you can drown in (tap Space to swim up; a breath bar shows how long you have), acid, toxic gas, radiation that gets worse the longer you stay, fire, electrified floors, barbed wire, and always-on crushers, flame jets, laser grids, spike floors, saw blades and minefields. Movement: mud, quicksand, ice, wind, conveyor belts, low gravity, jump pads, speed strips and teleporters. Also healing fields, creature-only force fields, invisible player barriers and fog. Creatures burn, freeze, drown, slide and die in them too, and walk around the deadly ones.
- **Map editor: traps you place yourself.** Ten kinds, each with its own lever that you stand wherever you like: Electro-Grid, Shredder Fan, Turret Nest, Flame Jets, Crusher, Laser Fence, Spike Floor, Cryo Vents, Tesla Coil and Acid Sprinklers. Set the price, running time, cooldown and name.
- **Map editor: a builder's kit of about 90 solid pieces** to stand on, climb and hide behind. Fortifications: tall concrete T-walls, jersey barriers, a pillbox and a command bunker (both enterable, with firing slits and walkable roofs), sandbag walls and gun nests, HESCO walls, tank traps, dragon's teeth, chain-link and razor fences, guard towers and sniper platforms with working ladders and stairs, trenches, checkpoints and camo nets. Walls in five materials, windows and doorways, pillars, arches, stairs, ramps, raised decks, catwalks, bridges, scaffolding, huts, garages and walk-in containers. Industrial plant, and explosive barrels, gas cylinders and fuel drums that blow up when shot and set each other off. Rocks, trees, crystals, hive growth and alien obelisks. Plus 26 ready-made groups: bunker line, sniper nest, field hospital, lava moat, bridge over lava, kill pit, crusher corridor, laser hallway, jump pad to a deck and more.
- **Fixed: traps could not be moved in the editor.** The flame and shock traps on doors were never selectable. Now you can drop one on any other door, stand its lever anywhere, or leave it out. Clicking again on the same spot picks the next thing stacked there, so a trap under a crate or a lever beside a prop is always reachable.
- **New launcher icon.** A steel hex badge with a glowing alien eye in a gun sight, sharp at every size from the taskbar to the desktop.

### What's new in 0.0.0.9
- **Map editor: select everything.** Every generated piece shows in pink and can be picked, dragged, turned or left out: both traps and their levers, turret nests and their levers, the building, platform, teleporters, ammo station, Wonder Bench and its parts, companion egg, hive eyes and bone altar, and the map's own perk machine and gun. Tile objects move the same way: perk machines, spawn vents, the player start, Xeno Cache, Forge, power switch, doors and wall guns, with their perk, gun or door price in Properties. Pieces you leave out are listed in the Map tab to put back.
- **Map editor: raise, lower and ramp the ground.** The Height tool (H) raises and lowers floor cells from -3.75 m to +11.75 m; the Ramp tool (N) joins two levels with a slope. It all plays for real: you walk up ramps and small steps, cliffs stop you, you drop into pits, creatures route by the ramps, shots hit slopes, and anything built on a cell (props, machines, structures and their ladders) moves up or down with it.
- **Hive eyes stay where you put them.** They used to land on a random wall every game; placed in the editor, they keep their spot.

### What's new in 0.0.0.8
- **Map editor.** A second program for hand-tuning the maps: open **Xenohold Editor** on the desktop, or **Map editor** in the launcher. It has a top-down plan and a live 3D view of the real map. Paint walls and tiles, floors and rooms; place any of about 90 props, ready-made blocks (bunk modules, server racks, a vehicle on a lift...), readable logs, signs and lights; move, turn, duplicate and recolour them; save groups of props to reuse on any map. Saving writes `mapedits/<map>.json` (with backups) and the game picks the changes up next time it starts. **Test** plays the map straight away. How to use it: `docs/EDITOR.md` (or press F1 in the editor).
- **The game now runs in Firefox**, in a window of its own with no tabs or address bar (fullscreen still works). Your progress from Edge (level, unlocks, run history, settings) was copied over and loads the first time. Chrome or Edge are still used if Firefox is not installed.
- **Rain & weather volume** in Settings: turns the rain (and each map's wind or ember background sound) up or down on its own.
- **Fixed: Outpost Kestrel's floor glaring once the power was on.** The new floor surfaces were far brighter than the game's own floors, and painted markings ignored the lighting and glowed. Floors now match the arena's brightness, markings take the room's light, and only real light sources bloom.

### What's new in 0.0.0.7
- **Maps overhaul: every arena is dressed for what it is.** All 17 maps now get the treatment Hesperus City had. Each map is split into named rooms (the Barracks, the Armory, the Gene Lab, the Slag Pits and so on), and each room is furnished for what it was for: bunks and lockers in barracks, consoles in command rooms, specimen tanks in labs, ore carts in the smelter, tents and floodlights in camps. Each room also has its own floor: planks, tile, grating, oily concrete, gravel or carpet. The brief for every map (what the place is, what happened there, why each room exists and why the goal is what it is) is in `docs/MAPS.md`.
- **Readable logs.** Every map has at least three glowing datapads. Press E to read what happened there; each new log is worth XP, and reading 20 different ones unlocks the new **Archivist** achievement.
- **Functional pieces where they belong.** The ammo station, Wonder Bench, companion egg, traps and structures now go in the room that makes sense for them. The ammo station sits in the armory or the camp stores, and it is a pile of supply crates or a drop pod where nothing could run a machine. Traps take the map's look and name: a Magma Vent in Char Depths, Flame Jets and a Blade Wheel in the Sunken Temple, an Acid Geyser in the Hive Cathedral. Turret nests are left out of places where nobody could have built them.
- **The story is in the rooms.** Remains, blood trails leading to the vents, scorch marks, spent casings, barricades and scrawled messages are placed where they tell what happened. Examples: the miners' last stand in Kestrel's barracks, the survey team's camp in the caverns, and the marines' barricade at the cathedral altar.
- **Solid blocks in the middle of rooms are now what the room needs**: bunk modules in barracks, an APC on a service lift in the motor pool, server racks, furnaces, garden beds and torn hull, instead of shipping containers everywhere. Theme props that only make sense in certain rooms (derricks, specimen tanks, solar panels, wall furnaces, supply crates) now stay in those rooms.

### What's new in 0.0.0.6
- **A proper launcher.** `Xenohold.exe` now opens a launcher window first: the logo, what's new in this version, a windowed or fullscreen choice and a big Play button (Enter plays, Esc quits).
- **Fixed: the big stutter when picking up wonder weapon parts** (worst on Vesper Orbital). Each part carried its own light, and removing a light makes the browser recompile every shader in the scene; that frame took a quarter of a second or more. Lights no longer come or go during a game.
- **Performance pass across the whole game.**
  - Map lamps now share a fixed pool of real lights (4 on Low, 8 on Medium, 12 on High quality) that follows the nearest lamps; the rest keep their glow. Every live light is paid for on every pixel, and maps had up to 15.
  - **Automatic resolution** (on by default, in Settings): below about 45 fps the render resolution steps down a little, to 55% at most, and climbs back when the frame rate recovers.
  - Weapon shaders are compiled on the loading screen, so the first swap to a new gun, the first upgrade or a wonder weapon no longer stutters.
  - Checked all 17 maps: game logic costs under a millisecond a frame; drawing is the cost everywhere, and Hesperus City is the heaviest map.
- **16 new creature variants** on every map, recoloured species with their own traits. From round 4 a growing share of spawns (up to 30% by round 15) are variants, each from its own round: Blood Skitter (faster every time it is hurt), Venom Skitter (poison), Ember Skitter (bursts into fire), Phase Skitter (blinks towards you), Alpha Skitterling (big, speeds up the pack), Plated Lancer (armoured from the front, headshots go through), Shock Lancer (stuns), Carrier Lancer (Broodlings burst out), Cluster Burster (splits into three Burstlings), Frost Burster (freezes you), Siren (its scream speeds up the swarm), Razorwing (three glaives at once), Berserker (enrages below half health), Gilded Behemoth (pays out and always drops a power-up) and Plague Mother (poison). They are all in the Bestiary.

### What's new in 0.0.0.5
- **The Director** paces every round instead of a flat stream of creatures. Tension builds as you get hurt or surrounded, peaks, then eases off for a few seconds so you can breathe, reload and move. If you are cruising it pushes a wave (the lights stutter and something roars in the distance first). Camp one spot for 40 seconds and a group comes at you from behind. New creatures come from vents you are not looking at. The music follows the pacing, and difficulty adapts a little between rounds (at most ±20%). The **Classic Spawning** mutator turns it off.
- **Game feel.** Every gun has its own recoil pattern, the same every time, so a spray can be learned and controlled. Spent casings fly out and bounce on the floor. Big kills freeze the action for a split second. Creatures slide back and fall away from the shot. Headshot kills pop. Creatures glow as an attack winds up, and an attack you cannot see flashes an orange warning at the edge of the screen. The last three rounds in a magazine tick.
- **Run History** (from the Achievements screen and the game-over screen): every game is recorded with each round's length, kills, damage taken, lowest health, downs, spending and frame rate, plus what hurts you and what downs you most, your guns' kills and accuracy, and average round length. The game-over screen shows what downed you. **Save runs to a file** writes everything to your Downloads folder so the game can be tuned from your real games.

### What's new in 0.0.0.4
- **Game modes** (pick one on the arena screen): **Standard**; **Boss Rush** (every round is a boss, beat six in a row); **Gun Game** (kills level your gun up a ladder of 20 weapons, going down costs a level, a knife kill with the last one wins; no wall buys, Xeno Cache or Forge); **Survival** (no rounds and no breaks, the swarm grows every 40 seconds, your time is your score); **Escape Run** (doors are free, reach the extraction beacon on the far side of the map and hold it for 30 seconds, fastest time is saved).
- **Daily challenge** on the main menu: the same map, mode, mutators and target for everyone on a given day. Beat it for 5,000 XP and build a streak.
- **Buildable wonder weapons.** Every map hides three parts for its own wonder weapon. Bring them to the Wonder Bench to build it; lose it and the bench rebuilds it two rounds later. Five designs: Winter's Howl (freezing gale, frozen creatures shatter), Heart of the Mountain (magma mortar with burning pools), Hivesong (a beam that turns wounded creatures into thralls), Stormbreaker (chain lightning that calls strikes from the sky) and Rift Caster (flings creatures to the far side of the map).
- **Easter-egg quest and a secret boss.** Four Hive Eyes hide high on the walls of every map, and whisper when you are close. Shoot them all, start the ritual at the Bone Altar and hold its circle for 25 seconds, and **The Harbinger** comes through: it blinks next to you, throws glaive storms and calls hunters. Kill it for the **Hive Blessing** (every gun you carry is mutated or goes up a Forge tier, a free perk, one more perk slot and 10,000 points).
- **Mid-game events.** From round 6 a round can turn into an **Eclipse** (dark, faster creatures, double points), a **Blizzard** (whiteout, everything slower), a **Hive Surge** (more and angrier creatures, double drops) or a **Blood Moon** (tougher creatures, triple points).
- **Companion.** Every map has a Companion Egg near the start. Hatch it (3,000) and Kit, a tamed skitterling, follows you and bites whatever gets close. If it gets cornered it goes down and gets back up 25 seconds later.
- **New traps**: the **Electro-Grid** floor (1,000), the **Shredder Fan** rotor (1,250) and **Turret Nests** beside doors (1,500), alongside the flame and shock door traps.
- **New lethals and tactical**: the **Sticky Charge** (sticks to creatures and walls, bigger blast; 40 frag kills), the **Cryo Grenade** (freezes everything in a wide burst; 70 frag kills) and the **Decoy Hologram** tactical (a copy of you that creatures attack until it breaks; rank 5, also in the Xeno Cache). Pick them per class in the Classes screen.
- **Jump pads and ziplines** on maps with room for them, and **Forge tiers**: take a mutated gun back to the Forge for Tier II (10,000) and Tier III (15,000), each +40% damage and one more mutation effect.
- **Creatures climb ladders** one at a time, so a roof is no longer a safe camping spot.
- **End-of-game scoreboard**: kills, headshots, accuracy, best streak, downs, points earned and spent, favourite weapon, damage dealt, biggest multi-kill and a kills-per-round chart.
- **Achievements**: 45 of them, from your first kill to secrets, with a toast when you unlock one, 1,000 XP each, and an Achievements screen on the main menu.
- **Controller support** (Xbox, PlayStation and other standard gamepads), in game and in every menu. Left stick move, right stick look, RT fire, LT aim, A jump, B crouch, X reload or interact, Y switch weapon, RB lethal, LB tactical, R3 knife, L3 sprint, D-pad up flashlight, D-pad down shield, Start pause. In menus: D-pad or left stick to move, A to select, B to go back.
- **Map editor** (main menu): paint a grid of floor, walls, doors, spawn vents, wall guns, perk machines, the Xeno Cache, the Forge, the power switch, cover, pillars and hazards; borrow the look of any map; save maps in this browser and play them. It checks that the start can reach the spawn vents before you play.

### What's new in 0.0.0.3
- **Structures.** Some maps now have enterable **buildings**: walls with windows and a doorway, a light inside, and a flat roof you reach by **ladder** (E at the foot, E at the top to come down). Some have **raised platforms** with a flight of **stairs** and railings, and most have a pair of **teleporter** pads (they need power, and an open way between them). You can walk under platforms, and creatures climb up after you.
- **Ammo restock station** on every map, inside the building when there is one: it refills every gun you carry, costs 2,500 + 250 per round, and works once per round, so Max Ammo drops and perks still matter.
- **Map-unique creatures.** Every map has its own creature from round 3, each a variant of a known species with its own ability: the cloaking Storm Stalker (Kestrel), Magma Crawler (lava pools), Frost Lancer (chilling spines), Hull Leech (heals on bite), Gutter Hound (speeds up the pack), Dune Borer (shockwave when it breaches), Spore Bloater (spore cloud), Failed Specimen (regenerates, splits on death), Sewer Lurker (poison), Ice Wraith (freezing dive), Slag Golem (molten trail, weak to cold), Choir Drone (halves damage to nearby creatures), Breacher (stunning charges), Void Mite (12 m leaps), Bog Lurker (submerges), Vacuum Wisp (pulls you in) and Temple Guardian (frontal plate). They are all in the Bestiary.
- **Map-unique perks.** Each map has one extra perk machine, often on top of the platform: Storm Conduit, Magma Blood, Permafrost, Life Support, Street Smarts, Dust Devil, Symbiote, Gene Splice, Hazmat Suit, Cryo Rounds, Forgefire, Choir Ward, Fortified, Moon Boots (double jump), Salvager, Kinetic Barrier and Relic Hunter. The perk limit goes up by one on that map.
- **Map-unique weapons.** Each map has its own gun on a gold-framed wall board (inside the building when there is one), with a signature effect: lightning strikes, molten pools, freezing shots, pinning rivets, kill-streak fire rate, blinding sand, poison thorns, a healing gene beam, acid mortars, ice shards, exploding slugs, a stunning hymn, damage reduction while firing, lifting hits, flares, micro black holes and leaping glaives. They also turn up in the Xeno Cache on their own map.
- **Alternate bosses.** Boss rounds rotate between the Hive Tyrant, the Brood Empress (acid rain, egg floods), the Molten Titan (charges, shockwave slams, molten trail) and the Sky Wraith (glaive storms, flock calls). Each map starts with its own signature boss. They follow the same rules: no attacks without line of sight, and they find you after 2 minutes unseen.
- **Map-unique victory conditions.** You still saturate the pylons first; then each map ends differently: hold the landing pad (Kestrel), destroy Frozen Hive Nodes (Frostfall), rig the reactor and reach the lifeboat before it blows (Ark), signal the evac chopper from a rooftop (Hesperus City), kill the Basin Titan (Dust Basin), deliver Spore Cores (Verdant), and so on. Char Depths and the Sunken Temple keep the classic Hive Heart and Overmind.
- **Deployable Turret.** An alternative to frag grenades, chosen per class once you have 100 frag grenade kills. G sets down a sentry that fights for 30 seconds and uses two lethal charges.
- **Tailored Loadout (sandbox).** A mutator (HEAT −8) that starts you with a build you made from gear you unlocked by playing: a primary and secondary gun, up to 4 perks and your lethal. Guns unlock by kills with that gun (150 for pistols up to 2,500 for shotguns and 5,000 for wonder weapons), perks by buying them 20 times. Set it up in Classes › Tailored Loadout.

### What's new in 0.0.0.2
- **Audio crackle fixed at the source.** In big fights the game was building hundreds of sound nodes a second, more than the audio thread could render in time. Every sound effect is now rendered once in the background (a few variations each) and replayed from memory. Music never schedules notes in the past after a hitch, the output clipper no longer hard-clips, and distorted voices no longer leave a click when they end.
- **Collision matches the models.** Perk machines, the Xeno Cache, the Forge, the generator, pylons, benches, cover, crates, containers, pillars, trees and city props block exactly where the model is, not their whole 2.5 m grid square. Rough rock walls stay close to their collision edge.
- **Climbing.** Press Space facing a ledge, or push into one mid-jump, to pull yourself onto crates, cover, cars, containers and monument steps. Creatures climb up after you.
- **Self-revives.** 3 per game solo (the crosses above your health bar), inversely proportional to team size: 2 for two players, 1 for three or four. Going down with one left gets you back up after 5 s. Lazarus Protocol revives you faster without using one. The One Life mutator removes them, and each arena has a Self-revives option (5, 1 or none).
- **Power matters.** Until the generator is on, maps with power are dark: most lights are dead, a few red emergency lights glow, your flashlight comes on by itself (L toggles it), and the minimap tracker only senses creatures within about 9 m. Switching on brings the lights back in a wave, restores the tracker, and wakes up 4 sentry guns on the lamp posts, as well as the perks and the Forge.
- **Fixes.** Wall weapons that were only ever in the Xeno Cache no longer show an undefined price or turn your points into NaN. Helix Labs, Frostfall and Dust Basin are no longer blindingly bright with the power on. Wall weapons, trap levers and secret eggs no longer sink into rock walls.

A round-based alien survival FPS in the spirit of CoD Zombies, with a swarm inspired by StarCraft's Zerg. Everything is procedural: the creature models, animations, textures, sound effects and music. There are no asset files.

## Run it

Double-click **`Xenohold.exe`**. The launcher shows what's new and lets you pick windowed or fullscreen (remembered in `launcher.ini`); **Play** (or Enter) opens the game in its own window, using Chrome if it's installed and Edge otherwise. `Xenohold.exe --play` skips the launcher. Keep the exe inside the game folder. To rebuild it, run `tools\launcher\build.ps1`.

You can also double-click `index.html`, or serve the folder:

```
python tools/serve.py
```

Then open http://localhost:8766. An internet connection is needed on first load because Three.js and the fonts come from a CDN.

## Content

- **17 arenas**:
  - Hesperus City: the mega map. A 245 m colony capital at night, split into 9 districts behind 10 doors: Downtown, Neon District, Capitol Hill, Market Street, Central Park, The Docks, Residential Blocks, Metro Station and the Hive Crater. It has skyscrapers with lit windows, neon shop signs, billboards, skybridges, cranes, burning car wrecks, streetlights, traffic lights, a metro platform with trains, falling ash, distant sirens, searchlights and a hive spire on the horizon. There are 14 wall-buys, and the intro flies in over the skyline.
  - Outpost Kestrel: rain, a mining outpost
  - Char Depths: lava hive caverns, no power
  - Frostfall Relay: blizzard, open fields
  - Derelict Ark: tight ship corridors
  - Dust Basin: an open-pit quarry at dusk, in a sandstorm
  - Verdant Rot: an overgrown research station in the jungle at night, with fireflies
  - Helix Labs: a genetics facility with specimen tanks
  - The Undercroft: flooded storm drains under Hesperus
  - Glacier Deep: ice caves, no power
  - Crucible Foundry: a volcanic smelter with molten metal and furnaces
  - Hive Cathedral: the queen's nest, with vaulted bone ribs and organ pipes, no power
  - Bastion 9: a military fortress at night in the rain, with sandbag lines
  - Selene Station: a lunar base with low gravity, so you jump higher and fall slower
  - Starfall Wreck: a crashed dropship in a rainy swamp
  - Vesper Orbital: a space station with a hull breach
  - Sunken Temple: ancient alien ruins with stone doors, no power

  Each has buyable doors between zones, perk machines, a Mutation Forge, several Xeno Cache locations and a main quest. Most also have a power generator. The 12 newest arenas are laid out by `tools/arenagen.py`, and each has its own lighting, weather, music, wall weapons and set dressing.
- **9 creatures**, plus a unique creature on every map and 3 alternate bosses:
  - Skitterling: pack leaper
  - Lancer: spine thrower with a cowl
  - Burster: acid bomb
  - Shrieker: flier
  - Behemoth: armored charger with a weak spot
  - Broodmother: egg layer
  - Broodling: her hatchlings
  - Burrower: ambushes from underground with spine lines
  - Hive Tyrant: the boss, with barrage, shockwave, acid rain and summons
- **85 weapons** (68 plus one unique gun per map), each with a mutated (upgraded) form. You also have a knife and frag grenades or a deployable turret.
  - The 14 originals include hitscan, piercing, flamethrower, chain lightning, cryo freeze, plasma, grenade launcher and a black-hole wonder weapon.
  - The **expanded arsenal** adds 54 more. They are built from a part library of extruded receivers, finger-grooved grips, trigger guards, picatinny rails, vented or quad-rail handguards, lathe-turned suppressors and scopes, see-through red dots and holo sights, curved or drum mags, and skeleton or wood stocks:
    - Pistols, SMGs, assault rifles and LMGs
    - Shotguns: auto, double-barrel, slug, dragon's breath and flechette
    - DMRs, snipers and an anti-materiel rifle
    - An explosive crossbow, an RPG, homing swarm rockets, an impact grenade launcher, a cryo mortar and a ricocheting saw-blade launcher
    - A continuous laser beam, a tesla coil, plasma and nova blasters, and frost and acid sprayers
    - A sonic shockwave gun
    - 3 more wonder weapons: Thunderclap, Brood Launcher (turns aliens) and Omega Ray
  - The Armory shows a rendered 3D thumbnail of every gun and has class filter tabs.
- **10 perks** plus one unique perk per map. You can hold one of each. There are also **5 power-ups**, which show their name when they drop.
- **Special rounds**: every 5th round is a swarm round and every 8th brings a boss (four of them take turns).
- **Difficulty & Mutators** (Arena Select → Difficulty):
  - 4 presets: Recruit, Veteran, Nightmare, Hell.
  - 7 sliders: creature health, speed and damage; horde size and density; points earned; starting points.
  - 17 mutator toggles.
  - **Arena options**, set per map: time of day, weather, power, doors, creature roster, hazards, Xeno Cache, wall-buy refills, starting loadout and perk limit.
  - Every choice has a badge that says whether it makes the run **easier** or **harder**.
  - Everything adds up to a **HEAT** score (Relaxed → Standard → Hard → Nightmare → Hell → Abyss), and best runs record their heat.
- **Black Ops pack**:
  - Mutation effects on upgraded guns: Chain Shock, Blast Furnace, Cryo Nova, Gravity Well, Turned. Re-roll one at the Forge.
  - Lure Beacons (T) from the Xeno Cache.
  - Shock and flame traps on doors.
  - Mutagen Capsule machine: 9 one-shot buffs.
  - 4 extra perks: Extra Holster, Shock Plating, Arc Discharge, Neural Link.
  - Perk jingles.
  - A hidden song: find the 3 eggs.
  - Intro flyover.
  - Buildable Hive Shield: 3 parts, then the workbench. Hold X to raise it.
  - A main quest on every map: pylons, then the Hive Heart, then the Overmind, then ESCAPED.
  - The Hive Mind voice with subtitles.
  - Crawlers.
  - Boarded vents: hold E to repair them for points.
  - XP, 50 ranks, 10 prestiges.
  - Weapon camo challenges, managed in the Armory.
- **Map detail**:
  - Every map: light shafts, ground mist, debris.
  - Kestrel: pipes, signs, cables, puddles, steam, landing pad.
  - Depths: rib bones, lavafalls, eggs, crystals.
  - Frostfall: drifts, icicles, masts, aurora.
  - Ark: ceiling pipes, emergency beacons, live consoles, sparks, hive growth.
- **Creature sound suites**: every species has its own synthesized voice, with idle, alert, attack, pain, special-ability, footstep and death sounds. You can preview them all in the Bestiary.
- **Player pain**: your character grunts when hit, gives a longer cry on heavy hits and groans when going down.
- **Sprint** is always at least 15% faster than the fastest creature at the current round and difficulty, even with a heavy weapon. Afterburner adds another 20%. Lunges such as the Skitterling pounce and the Behemoth charge are short bursts and can still catch you.
- **Settings**: the Hive Mind taunts, meaning the ominous voice lines and their subtitles, can be switched off.
- **Classes**: build up to three classes, each with a name, a starting sidearm and trait slots that open as you rank up. There are 20 permanent traits, such as Thick Skin, Deadeye, Demolitions and Second Wind. Each one unlocks through a lifetime challenge, like reloading 150 times, sprinting 3 km or slaying 3 Hive Tyrants.
- **Gunsmith**: every gun has 5 attachment slots: optic, muzzle, underbarrel, magazine and stock. Options unlock as you get kills with that gun, and each changes its stats: iron sights, red dot, holographic, 3x and 8x scopes, brake, suppressor, flash hider, grips, laser, bipod, extended, fast and drum mags, and stocks. Attachments show on the viewmodel, and scoped guns zoom when you aim.
- **Weapon roles**: each of the 68 guns has a named role and its own traits, from a pool of 32, such as Armor Shred, Stagger, Vampiric, Overpenetration, Ramp-up and Tactical Reload. No two guns have the same role.
- **Fair enemies**:
  - Melee creatures have a short, fixed reach.
  - Ranged creatures only fire when they can see you, and their aim spreads with distance.
  - The Hive Tyrant can't attack without line of sight. If it hasn't seen a player for 120 s, it relocates near the closest one.
- **Colliders**: every solid prop blocks you where its model is: crates, lamp posts, eggs, crystals, drifts, machines, benches, pillars, trees and city props. Low things can be climbed.
- **Extra Holster** now also lets you keep reloading while you sprint.
- **Field Manual tips**: the first time you meet something usable, such as the orbital strike, a trap or the Forge, a tip tells you how to use it. You can turn tips off, reread them all in the Field Manual, or reset them.
- **Audio**: sound effects are pre-rendered and replayed from memory, with a master limiter and a voice budget, so big fights don't crackle.
- **Adaptive music**: it gets more intense with the number of enemies, and each map has its own key and tempo.

## Project layout

| File | Purpose |
|---|---|
| `js/data.js` | Map metadata, perks, power-ups, tips, difficulty and arena options |
| `js/maps2.js` | Look, lighting, weather, wall weapons and quests for the 12 generated arenas |
| `js/mapdata.js` | Arena grids, generated by `tools/genmaps.py` |
| `js/world.js` | Builds arenas from grids, collision, raycasts, flow-field pathfinding |
| `js/decor.js`, `js/decor2.js` | Set dressing per theme and per skin, with prop colliders |
| `js/city.js` | Hesperus City dressing: facades, signs, streets, props, skyline and searchlights |
| `js/monsters.js` | Creature models and animations |
| `js/enemies.js` | Creature stats, AI, damage, hazards, boss logic |
| `js/weapons.js` | Weapon stats, viewmodels, firing, projectiles, beams and shockwaves |
| `js/arsenal.js` | The 54-gun expanded arsenal and its parametric part library |
| `js/player.js` | Movement, health, perks |
| `js/structures.js` | Buildings, platforms, stairs, ladders, teleporters and the ammo station |
| `js/uniques.js` | Each map's unique creature, perk and weapon |
| `js/bosses.js`, `js/victory.js` | Alternate bosses and map-unique victory conditions |
| `js/mutations.js` | Colour-variant creatures with their own traits, on every map |
| `js/loadout.js` | Tailored Loadout unlocks and the Deployable Turret |
| `js/modes.js`, `js/daily.js` | Game modes (Boss Rush, Gun Game, Survival, Escape Run) and the daily challenge |
| `js/wonders.js`, `js/secrets.js` | Buildable wonder weapons; the easter-egg quest and the Harbinger |
| `js/events.js`, `js/companion.js`, `js/traps.js` | Mid-game events, the companion, and the buyable traps |
| `js/achievements.js` | Achievements, the unlock toast and the Achievements screen |
| `js/gamepad.js` | Controller input and menu navigation |
| `js/editor.js` | The map editor |
| `js/director.js` | The Director: pacing, pushes, flanks, adaptive difficulty |
| `js/telemetry.js` | The playtest recorder and the Run History screen |
| `js/classes.js`, `js/loadout-ui.js` | Class traits, custom classes, and the Classes and Gunsmith screens |
| `js/game.js` | Rounds, spawning, economy, box, forge, power-ups |
| `js/audio.js` | Synthesized sound effects and procedural music |
| `js/fx.js` | Particles, tracers, decals, weather |
| `js/ui.js`, `js/main.js` | Menus, HUD, render loop |

**Editing maps:** edit `tools/genmaps.py` (or `tools/citygen.py` for the city, or the room lists in `tools/newmaps.py` for the generated arenas), then run `python tools/genmaps.py` from the `tools` folder. The script validates the layout and rewrites `js/mapdata.js`.

**Dev flags:**
- `index.html?debug&map=depths&round=10&god=1` jumps straight into a game. It is silent and has no pointer lock.
- `?mute` disables audio.
- `tools/viewer.html?m=behemoth` previews a single creature.
