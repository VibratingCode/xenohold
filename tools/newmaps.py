"""The twelve generated arenas (layouts only; look, weather and lore live in js/data.js)."""
from arenagen import build_arena

# Every arena: six zones. Room 0 is the start. Links: (a, b, door digit or None, cost, horizontal-first)
L6 = [(0, 1, '1', 750, True), (0, 2, '2', 1000, True), (0, 4, '3', 1000, False), (1, 3, '4', 1250, False),
      (2, 5, '5', 1250, False), (4, 5, '6', 1500, True), (3, 4, '7', 1500, True)]

SPECS = [
    dict(id='dustbasin', w=52, h=44, seed=11, buys='abcdefg', rooms=[
        ('Loading Yard', 'r', 19, 16, 14, 12, ['cover', ('crates', 3)]),
        ('Dig Site', 'c', 3, 3, 15, 12, [('spires', 4), 'cover']),
        ('Ore Crusher', 'r', 36, 3, 13, 12, [('center', 3), ('crates', 3)]),
        ('Canyon Floor', 'c', 3, 24, 15, 16, [('spires', 3), 'cover']),
        ('Bunkhouse', 'r', 20, 33, 13, 8, ['pillars']),
        ('Relay Tower', 'r', 37, 22, 12, 18, ['cover', ('center', 2)])], links=L6),
    dict(id='verdant', w=54, h=44, seed=12, buys='abcdefg', rooms=[
        ('Research Atrium', 'r', 20, 17, 14, 12, [('trees', 3), 'cover']),
        ('Canopy Walk', 'c', 3, 3, 16, 13, [('trees', 6), ('grass', 3)]),
        ('Greenhouse', 'r', 37, 3, 14, 12, ['pillars', ('grass', 2)]),
        ('Rot Pits', 'c', 3, 26, 15, 15, [('acid', 3), ('trees', 3)]),
        ('Specimen Hall', 'r', 21, 33, 13, 9, [('crates', 4)]),
        ('Overgrown Dock', 'c', 38, 24, 14, 16, [('trees', 4), 'cover'])], links=L6),
    dict(id='helix', w=50, h=42, seed=13, buys='abcdefg', rooms=[
        ('Lobby', 'r', 19, 16, 12, 10, ['cover']),
        ('Cryo Storage', 'r', 3, 3, 13, 11, ['pillars']),
        ('Gene Lab', 'r', 34, 3, 13, 11, [('center', 2), ('crates', 2)]),
        ('Containment', 'r', 3, 24, 13, 14, ['pillars']),
        ('Surgery', 'r', 19, 31, 12, 9, ['cover']),
        ('Reactor Room', 'r', 34, 22, 13, 16, [('center', 3)])], links=L6),
    dict(id='undercroft', w=54, h=42, seed=14, buys='abcdefg', rooms=[
        ('Junction', 'r', 21, 16, 12, 10, [('acid', 1)]),
        ('Overflow Tunnel', 'r', 3, 3, 20, 9, [('acid', 2)]),
        ('Pump Station', 'r', 34, 3, 16, 10, [('center', 2)]),
        ('Cistern', 'c', 3, 22, 15, 16, [('acid', 2), 'pillars']),
        ('Maintenance', 'r', 21, 31, 13, 8, [('crates', 3)]),
        ('Outfall', 'r', 37, 20, 14, 18, [('acid', 3), 'cover'])], links=L6),
    dict(id='glacier', w=52, h=44, seed=15, buys='abcdefg', power=False, rooms=[
        ('Ice Chamber', 'c', 18, 16, 16, 13, [('ice', 2), ('spires', 2)]),
        ('Frozen Falls', 'c', 3, 3, 16, 13, [('spires', 3), ('ice', 2)]),
        ('Crystal Vault', 'c', 35, 3, 15, 13, [('spires', 4)]),
        ('Buried Camp', 'r', 3, 26, 14, 13, [('crates', 3), 'cover']),
        ('Deep Crevasse', 'c', 20, 32, 14, 10, [('ice', 2)]),
        ('Mammoth Hall', 'c', 36, 23, 14, 17, [('spires', 3), ('ice', 2)])], links=L6),
    dict(id='crucible', w=54, h=44, seed=16, buys='abcdefg', rooms=[
        ('Casting Floor', 'r', 20, 16, 14, 12, [('lava', 1), 'cover']),
        ('Slag Pits', 'r', 3, 3, 15, 12, [('lava', 3)]),
        ('Smelter', 'r', 37, 3, 14, 12, [('center', 3)]),
        ('Cooling Yard', 'r', 3, 25, 15, 15, ['cover', ('crates', 3)]),
        ('Forge Hall', 'r', 21, 33, 13, 9, ['pillars']),
        ('Crucible Core', 'r', 38, 24, 13, 16, [('lava', 2), ('center', 2)])], links=L6),
    dict(id='cathedral', w=54, h=46, seed=17, buys='abcdefg', power=False, rooms=[
        ('The Nave', 'c', 19, 17, 16, 14, [('spires', 2)]),
        ('Ossuary', 'c', 3, 3, 16, 13, [('spires', 3)]),
        ('Choir of Teeth', 'c', 36, 3, 15, 13, [('spires', 3)]),
        ('Brood Crypt', 'c', 3, 27, 15, 15, [('acid', 2)]),
        ('The Apse', 'c', 21, 34, 13, 10, [('spires', 2)]),
        ("Queen's Throne", 'c', 37, 26, 15, 17, [('acid', 2), ('spires', 2)])], links=L6),
    dict(id='bastion', w=52, h=44, seed=18, buys='abcdefg', rooms=[
        ('Courtyard', 'r', 19, 16, 14, 12, [('cover', 5)]),
        ('Motor Pool', 'r', 3, 3, 15, 12, [('crates', 3), ('center', 2)]),
        ('Watchtower', 'r', 36, 3, 13, 12, [('cover', 3)]),
        ('Barracks', 'r', 3, 25, 14, 14, ['pillars']),
        ('Armory', 'r', 20, 33, 13, 8, [('crates', 4)]),
        ('Command Bunker', 'r', 36, 24, 13, 16, [('cover', 4)])], links=L6),
    dict(id='selene', w=54, h=44, seed=19, buys='abcdefg', rooms=[
        ('Hab Ring', 'c', 19, 16, 16, 13, ['cover']),
        ('Crater Rim', 'c', 3, 3, 16, 13, [('spires', 2), 'cover']),
        ('Solar Farm', 'r', 36, 3, 15, 12, ['pillars']),
        ('Landing Pad', 'c', 3, 26, 16, 15, [('center', 3)]),
        ('Greenhouse Dome', 'c', 21, 33, 13, 10, [('grass', 2)]),
        ('Mass Driver', 'r', 37, 25, 13, 15, [('center', 2), ('crates', 2)])], links=L6),
    dict(id='starfall', w=54, h=44, seed=20, buys='abcdefg', rooms=[
        ('Crash Site', 'c', 19, 16, 16, 13, [('center', 2), ('crates', 2)]),
        ('The Bog', 'c', 3, 3, 16, 13, [('acid', 3), ('trees', 4)]),
        ('Cockpit', 'r', 37, 4, 13, 10, ['cover']),
        ('Drowned Grove', 'c', 3, 26, 15, 15, [('trees', 5), ('acid', 2)]),
        ('Cargo Spill', 'r', 21, 33, 13, 9, [('crates', 4)]),
        ('Engine Wreck', 'c', 37, 24, 14, 16, [('center', 3), ('acid', 1)])], links=L6),
    dict(id='vesper', w=50, h=42, seed=21, buys='abcdefg', rooms=[
        ('Hangar', 'r', 18, 15, 14, 12, [('crates', 3)]),
        ('Observation Deck', 'r', 3, 3, 14, 11, ['cover']),
        ('Docking Ring', 'r', 33, 3, 14, 11, ['pillars']),
        ('Hydroponics', 'r', 3, 24, 13, 13, [('grass', 3)]),
        ('Crew Mess', 'r', 19, 31, 12, 9, ['cover']),
        ('Core Access', 'r', 34, 22, 13, 15, [('center', 3)])], links=L6),
    dict(id='temple', w=54, h=46, seed=22, buys='abcdefg', power=False, rooms=[
        ('Sunken Court', 'r', 19, 17, 16, 14, ['pillars']),
        ('Hall of Idols', 'r', 3, 3, 16, 12, [('spires', 3)]),
        ('Flooded Shrine', 'c', 36, 3, 15, 13, [('acid', 2)]),
        ('Serpent Stair', 'r', 3, 27, 14, 15, ['pillars']),
        ('The Tomb', 'r', 21, 35, 13, 9, [('crates', 3)]),
        ('Sanctum', 'c', 37, 27, 15, 16, [('spires', 2), ('center', 2)])], links=L6),
]


def build_all(Map, validate):
    maps, extra = {}, {}
    for spec in SPECS:
        m, info = build_arena(Map, spec)
        validate(spec['id'], m, ''.join(sorted(info['doors'])))
        maps[spec['id']] = m.rows()
        extra[spec['id']] = info
    return maps, extra
