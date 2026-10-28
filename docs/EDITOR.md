# Xenohold map editor

A level editor for hand-tuning the 17 arenas: walls and tiles, the ground's shape, props, lights, signs and logs, solid
building pieces, zones that hurt, slow, push or kill, traps with their own levers, and ready-made groups. What you
see in its 3D view is the game's own renderer drawing the real map, so it looks exactly as it will in play.

## Starting it

- Double-click **Xenohold Editor** on the desktop, click **Map editor** in the launcher, or run `XenoholdEditor.exe` in the
  game folder.
- It opens in Firefox, in a window of its own (Chrome or Edge if Firefox is not installed). A small local program runs
  alongside to save your work, and it stops when you close the window.
- Press **F1** (or **?** at the top right) for a summary of the controls.

## Your own maps

- **+ New map** (top bar) makes a map from scratch. Give it a name, pick whose **look** it borrows (the lighting, sky,
  weather, music, props and creatures of one of the 17 arenas), a size (Small 24 × 20 cells up to Huge 64 × 52, or
  anything from 16 to 100 each way), and a starting layout:
  - **an empty arena**: walls round the edge, a player start, four spawn vents, two wall guns, a perk and the Xeno Cache;
  - **four rooms joined by doors**: the same, split into rooms behind three doors;
  - **a copy of that arena's own layout**, to rework.
- The map list has three groups: **Arenas**, **Your maps**, and **In the game's map maker**. The last one holds maps
  made with the game's own simple map maker (main menu › Map Editor). Those live in the game's browser storage, and
  XenoholdEditor.exe reads them from there. Pick one to copy it here, then Save. The game's map maker keeps its own copy,
  and a map already copied is not listed again.
- Everything in the editor works on your own maps: tiles, height and ramps, props, the kit, zones, traps, lights and
  rooms. The **Map** tab renames a map or changes its look.
- **Save** writes `mapedits/custom_<id>.json`, the whole map. From then on it is in the game's arena list, and **Test**
  plays it straight away. **Delete map** (in place of Revert) removes it; the saved file goes to `mapedits/backup/`.
- Your own maps have no story to dress them from, so **Regenerate** is off for them: place props by hand, or use the
  ready-made groups.

## Game pieces on your own maps

Nothing places itself on a map of your own: no traps, altar, hive eyes, companion egg, Wonder Bench, ammo station, lamp
sentries or theme clutter popping up (and moving about whenever the map is rebuilt). Add the ones you want from
**Assets › Game pieces**: the ammo station (against a wall), the Wonder Bench and its three parts, the companion egg,
the bone altar and up to four hive eyes (the secret boss quest needs the altar and at least two eyes), teleporters A and
B, a building, a raised platform, and the two flame or shock traps that go on doors (click a door). They stay exactly
where you put them; drag them to move them, Delete takes one away. **Theme clutter** (the arena's own scattered rocks,
crates and pipes) can be switched back on in the Map tab.

## Logic: triggers, markers and moving pieces

**Triggers** (Assets › Logic) say *when* something happens and *what* then happens.

| When | |
|---|---|
| The player walks into the area | drag out the area like a zone |
| A creature walks into the area | |
| The player presses a button / pulls a lever (E) | a button panel or lever, with an optional price and label |
| A target is shot | a bullseye on a post |
| Round N starts, N creatures killed, the power comes on, the game starts | |

Options: only once (or again after *every* seconds), a *delay*, and *starts switched off* (another trigger switches it on).

**Then** (Properties › + Add what happens), each with its own *after* delay: open a door or piece, close / stop a
piece, switch on / off / over, spawn creatures (which, how many, where), spawn a boss, show a message, play a sound,
power on, power off, give points, teleport the player, an explosion, shake the screen, fire another trigger, win the map.

Triggers find pieces by **name**: every piece has a Name field in Properties (zones, traps, moving pieces, triggers,
markers...). **pick** next to an action lets you click the piece on the map instead (it is given a name if it has none);
doors are the map's doors by number. The plan draws each trigger's wiring: yellow lines to what it acts on, blue dotted
lines to the points it uses.

**Markers**: named points (where a trigger spawns creatures, sends the player or sets off an explosion), extra creature
spawn points (they work like vents once the player can reach them) and boss spawn points.

**Moving and breakable pieces** (Assets › Moving and breakable):

- **Blast door**: opens and closes by trigger, or with its own E button (tick *button*, set a *cost*). Creatures path
  round it while it is shut.
- **Elevator**: rises when you stand on it and comes back down after you step off; a trigger can send it up or down.
- **Moving platform**: runs back and forth to its far end (drag the round handle), carrying you.
- **Extending bridge**: a deck that slides out across a gap (over a lava or kill zone it is safe to cross).
- **Breakable wall**: explosions do full damage, bullets a quarter; when it falls, the way is open.
- **Secret wall**: looks like the map's own wall; opens when you press E at it, shoot it, or by trigger.
- **Mounted machine gun**: press E behind it to man it; it follows your aim within its arc, never runs out and overheats.
- **Zipline**: from here to its far end (drag the handle); E at the start pole rides it.

Zones and traps with a name can be switched by triggers too; a zone can *start switched off*.

## Waves

Map tab › Waves: the round each kind of creature first comes in (0: never, blank: the game's own choice), including
the map's own creature and the **Drowner** (it lives in deep water zones and comes out of them), boss rounds (every N,
0 for none) and which boss, swarm rounds, and how many creatures, how fast they come and how many at once.

## Map tools

- **Resize** (Map tab, maps of your own): grow or shrink the map round the middle or to the right and down; everything
  on it moves with its cells.
- **Tile regions** (Tiles tool): Ctrl+drag picks a region; Ctrl+C copies it (with its floors and heights), Ctrl+V pastes
  it at the cursor, R turns the copy, Delete clears the region.
- **Sink the floor under a zone** (a water, lava, acid or mud zone's Properties): makes a proper lake or pit (water
  sinks as deep as its depth), and **Level it** undoes that.

## Testing

**▶ Here** (or Ctrl+Enter) saves, then plays the map from where the 3D camera is, facing the way it faces, with no
intro. The Map tab's Testing section sets god mode and the round to start on. **▶ Test** plays it from the start.

## The screen

- **Top bar:** the map, **+ New map**, Save, Undo and Redo, ▶ Test and ▶ Here, the view layout, snap and turn step, Test (saves, then plays the map in a new window), the view layout, a power
  on or off preview, Rebuild, Regenerate and Revert.
- **Left:** the tools.
- **Middle:** the plan (top-down) and the 3D view. **Tab** switches between split, 3D only and plan only.
- **Right:** **Assets** (what to place or paint), **Properties** (what is selected), **Map** (doors, wall guns, fog
  and light, waves, testing and checks) and **Scene** (everything on the map by kind: search, select, hide, lock).
- **3D view:** select one piece and a gizmo appears: drag its red and blue arrows to move it, the green arrow to lift it
  and the yellow ring to turn it. **Live** in the top bar animates the scene; off, the views only redraw when something
  changes, which keeps the editor light. The numbers top right are the 3D view's frame rate, draw calls and triangles.
- **Bottom:** the cell and room under the cursor, messages, and hints for the current tool.

### Moving around

| Where | How |
|---|---|
| Plan | Wheel zooms. Middle or right drag pans (or Space + drag). Double-click moves the 3D camera there. The orange arrow is the 3D camera. |
| 3D | Hold the right mouse button to look, and fly with WASD. Q and E go down and up, Shift is faster. The wheel moves forward, middle drag pans. |
| Both | **F** focuses on the selection. **F5** rebuilds the whole map. |

## Tools

| Key | Tool | What it does |
|---|---|---|
| V | **Select** | Click anything to select it: props, zones, traps and their levers, lights, the generated pieces (pink) and tile objects. When several things overlap, click again on the same spot to pick the next one (the status bar says which, and how many are there). Shift+click adds to the selection. Drag a box on the plan to select an area. Drag to move (Alt turns off snapping); arrow keys nudge (Shift moves a whole cell). **R** or **[ ]** turn it, Ctrl+D duplicates, Ctrl+C and Ctrl+V copy and paste at the cursor, Del deletes. |
| P | **Place** | Places whatever is picked under Assets. Zones: drag out a rectangle (or click for the default size). Traps: click, then drag the round lever handle. Wall pieces (marked ▮) hang on the nearest wall, facing into the room; blocks fill two by two cells. Zones and traps line up with the cells; hold Alt to place freely. |
| B | **Tiles** | Paints the map grid: walls, floor, doors, spawn vents, the player start, perk machines, wall guns, cover, pillars, lava, acid and ice. Right click paints plain floor, and Shift+drag fills a rectangle. Tiles are the same symbols as `js/mapdata.js`. |
| G | **Floor** | Paints floor surfaces (plank, tile, grating, oily concrete, gravel, carpet and more). Right click clears. |
| H | **Height** | Raises (left) and lowers (right) the floor by the step on the right, from -3.75 m to +11.75 m. Shift paints the set height, Ctrl+click picks up a height. Anyone walks up steps of up to 0.6 m; higher is a ledge (the player can climb about 1.6 m, and creatures climb up to 3.4 m when you are above them). |
| N | **Ramp** | Drag from a cell on one level straight across to a cell on another: the cells between become a slope joining them. About a metre of rise per cell is the steepest you can walk up. Creatures' paths only use slopes and small steps. |
| L | **Light** | Click empty floor to add a real light, or click a light to select and drag it. Properties sets its colour, strength, range, height and whether it has a pole or ceiling fitting. **Power off** at the top shows how the map looks before the generator is on. |
| C | **Clear** | Each theme also scatters its own clutter (rocks, crates, pipes, crystals, derricks...). A cleared circle keeps it out, so a spot you dressed by hand stays as you left it. Right click removes a circle. |
| Z | **Rooms** | The named rooms. Drag one to move it, drag an edge to resize it, and Ctrl+drag to draw a new one. The ammo station, Wonder Bench, companion egg and traps go to rooms by name (see `js/zones.js`). |

## Generated pieces and tile objects

- **Generated pieces** are drawn in pink on the plan. They include both traps and their levers, the flame or shock traps on two doors and their levers, turret nests and their levers, the building, platform, teleporters, ammo station, Wonder Bench and its parts, the companion egg, hive eyes and bone altar, and the map's own perk machine and gun.
- Drag a piece to move it: traps, the building and the platform move a whole cell at a time, and wall pieces (the ammo station, the map gun, the hive eyes) snap to the nearest wall. A door trap goes on a door: drop it on another door to move it there. Every lever can stand anywhere. **R** turns the bench, a turret nest, the map's perk machine or the platform's stairs. **Delete** leaves a trap, turret nest, teleporter or structure out, and the Map tab lists those to put back. **Back to automatic** (Properties) lets the piece pick its own spot again.
- **Tile objects** (perk machines, spawn vents, the player start, Xeno Cache, Forge, power switch, gum machine, workbench, doors and wall guns) can be clicked and dragged to another floor cell, or a wall cell for a wall gun. Properties changes which perk or gun it is and a door's name and price. Doors stay in their doorway: paint a new one with the Tiles tool.

## Traps you place yourself

Assets › **Traps**. Click to put one down, then drag its round handle (the lever, joined to the trap by a dashed line
on the plan) to wherever you want it to stand. Moving or turning the trap brings its lever along; the lever can also be
picked and dragged on its own, in the plan or in 3D.

| Trap | What it does |
|---|---|
| Electro-Grid | fries every ground creature on the plate |
| Shredder Fan | a spinning rotor that cuts down anything that walks into it |
| Turret Nest | sets up a sentry gun for the time it runs (Facing turns it) |
| Flame Jets | nozzles in the floor burn everything above them |
| Crusher | a press that slams down every 1.3 s |
| Laser Fence | beams across a corridor; lay it along the long side |
| Spike Floor | spikes stab up out of the floor every second |
| Cryo Vents | freezes creatures solid (they take extra damage while frozen) |
| Tesla Coil | zaps up to three creatures within its range (r, 9 m) |
| Acid Sprinklers | acid rain from above that eats creatures and slows them |

Properties sets the size, where the lever stands, the **name** on its sign, the **cost** to switch it on, how long it
runs (**time**) and how long it needs before it can run again (**cool**). All of them hurt you too if you stand in them.

## Zones

Assets › **Zones**: drag out a rectangle. A zone reaches from the floor up (a few metres, or its water depth), so a
zone under a deck does not reach someone standing on the deck. Creatures walk around the deadly ones.

| Group | Zones |
|---|---|
| Deadly | **Instant death** (look: void, glow or hidden) · **Lava** · **Deep water** (swim with Space; with your head under for longer than *breath* seconds you drown; set *depth*, and lower the floor with the Height tool for a proper lake) · **Acid** · **Toxic gas** (hurts you, not them) · **Radiation** (worse the longer you stay) · **Fire** · **Electrified floor** · **Barbed wire** (a crawl, and it cuts) · **Spike floor**, **Crusher**, **Flame jets**, **Laser grid** (always on, on a cycle you can time) · **Minefield** (*count* mines, *hidden* buries them) · **Saw blade** |
| Liquids and ground | Shallow water · Mud / tar · Quicksand · Ice |
| Movement | Wind and Conveyor belt (*dir* in degrees: 0 pushes down the plan, 90 to the right; turning the zone turns it) · Low gravity · Jump pad (*power* up, *push* along *dir*) · Speed strip · Teleporter (Properties › Pick the arrival point) |
| Helpful and barriers | Healing field · Creature barrier (a force field creatures cannot cross; you and your shots can) · Player barrier (invisible, the player only) · Fog / darkness |

## The builder's kit

About 90 solid pieces, in five groups under Assets. They have real colliders: you can stand on roofs, decks and
walkways, climb the ladders (E) and the stairs, take cover, and shoot over low walls. Creatures path around them.

- **Fortifications:** jersey barriers, T-walls (tall concrete, *n* sections), concrete walls and blocks, dragon's teeth,
  a pillbox and a command bunker (enterable, with firing slits, and a ladder or steps to a roof you can fight from),
  sandbag walls, corners, gun nests and foxholes, HESCO walls (*tall*), tank traps, barbed wire, chain-link fences with
  razor wire, guard towers and sniper platforms (with ladders and stairs), checkpoints, trenches, camo nets, a radio
  mast, ammo crates, junk barricades and a floodlight tower.
- **Walls and buildings:** walls in concrete, brick, sheet metal, planks and glass (shoot through), walls with a window
  or a doorway, pillars, arches, stairs (*h*: how high they climb), ramps, raised decks, catwalks, bridges (*h*),
  scaffolding, a roof on posts, floor plates, railings, fences and gates, a hut, a garage, containers you can walk into
  and container stacks, and a climbable ladder to stand against anything.
- **Industrial:** fuel tanks, silos, pipe racks, transformers, cable spools, chemical tanks, a crane tower, a conveyor
  machine, a hydraulic press, exhaust stacks, a diesel generator, dumpsters and pipe junctions. **Explosive barrels, gas
  cylinders and fuel drums** blow up when shot or caught in a blast, set each other off, and fuel leaves the ground
  burning for a while.
- **Nature and alien:** boulders, rock clusters, pines (*snow*), dead trees, bushes and grass, fallen logs,
  stalagmites, crystal pillars, glowing mushrooms, cacti, ice spikes, hive columns and walls, alien obelisks, alien egg
  clusters and **force fields** (creatures only).
- **Street and camp:** lamp posts, warning beacons, traffic cones, road barriers, benches, a portable toilet, a helipad
  marking, a command tent and a flag.

Each piece's options (sizes, colours, materials) are in Properties, with the default shown in grey.

## Ready-made groups

Under **Ready-made and saved groups**: Checkpoint, Sniper nest, Bunker line, Command bunker and stairs, T-wall line,
Guard post, Supply dump, Field hospital, Fuel depot (explosive), Radio outpost, Machine shop, Trench line, Alien nest,
Frozen lake, Lava moat, Bridge over lava, Kill pit, Conveyor to the void, Crusher corridor, Laser hallway, Tesla
defence, Jump pad to a deck, Minefield, Acid spill, Wind tunnel and Healing shrine. Once placed, every part of a group is
its own piece to move or change.

## What you can place

- **Props:** every piece from the set dressing (about 90), grouped as rooms and furniture, machines and cargo, camp and
  expedition, vehicles and big pieces, hive and remains, and decals and detail. Each has its own options in Properties
  (colours, lying or sitting, open or closed, lit...). **New variation** keeps the prop but rerolls its random details.
- **Blocks:** bunk modules, locker banks, server racks, cryo pods, specimen tanks, machines, furnaces, garden beds, a
  vehicle on a lift, torn hull and more. Put one on a solid block (`+` tiles) to dress it, or anywhere as a big piece;
  either way it blocks creatures' paths.
- **Story:** readable datapad logs (title, author, text), signs, painted words and screen text.
- **Saved groups:** select several props, then use **Save group** in Properties. The group appears under Assets on every
  map. *Log on a table* is included as an example.

## Saving

- **Ctrl+S** saves the map to `mapedits/<map>.json`, and the previous version goes to `mapedits/backup/`. The game loads
  your edits the next time it starts.
- Only what you changed is saved:
  - Untouched parts of a map keep following the game's own files.
  - Once you change any prop, the map's whole dressing is saved as a list, so its story dressing no longer regenerates
    by itself.
- **Regenerate** throws away the placed dressing of the map you are editing and makes it again from its story (the
  `js/mapstory.js` recipes).
- **Revert** deletes the map's saved edits (a backup is still kept).
- **Test** saves, then opens the map in a new window to play.

## How it works (for tinkering)

- `XenoholdEditor.exe` (source in `tools/editor/`) serves the game folder on `127.0.0.1` and opens `index.html?editor`.
  Saves go through it. It also rebuilds `js/mapedits.js` from `mapedits/*.json`, and the game loads that file.
- `js/edits.js` applies the edits when the game starts: the grid, lights, doors, wall guns, fog and light, rooms, the
  placed dressing, cleared circles, pinned pieces (`place`, including `dtrap0` / `dtrap1` = `{ door }` for the door
  traps) and the ground's shape (`terrain`). A map of your own also has `custom: { name, base, w, h, from }` and its whole
  `grid`; `js/edits.js` adds it to the game's list of maps as a copy of the `base` arena with that layout.
- `GET /api/gamemaps` (XenoholdEditor.exe) reads the game map maker's maps: localStorage `xenohold.customMaps` in the
  game's Firefox profile, a SQLite file read through Windows' own `winsqlite3.dll` (the values are Snappy-compressed).
- Every prop is an entity `{ k, x, z, y, ry, o, s }`: the prop name, position, facing, options and a random seed. A
  zone is `{ k: '@zone', zt, x, z, w, d, o }` and a trap `{ k: '@trap', tt, x, z, w, d, lx, lz, o }` (lx, lz: its
  lever). The kit is `js/kit.js`, zones and explosives `js/hazards.js`, and placed traps the end of `js/traps.js`. The same
  seed always builds the same prop. `js/setdress.js` records the generated dressing as entities ("bake") and plays a
  saved list back.
- The editor itself is `js/xedit.js` and `css/xedit.css`.

## Limits

- A structure or trap spread over cells of different heights is lifted piece by piece, so keep its cells level.
- Hesperus City's streets and buildings come from its own generator. You can add props and lights on top, but the city
  blocks themselves are tiles.
- The theme's scattered clutter is not editable piece by piece. Keep it out of an area with the Clear tool.
