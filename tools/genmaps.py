import random, json, sys
from collections import deque

class Map:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [['#'] * w for _ in range(h)]
    def set(s, x, y, c):
        if 0 < x < s.w - 1 and 0 < y < s.h - 1:
            s.g[y][x] = c
    def rect(s, x, y, w, h, c='.'):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                s.set(xx, yy, c)
    def ell(s, cx, cy, rx, ry, c='.', rough=0.0, seed=0, only=None):
        r = random.Random(seed)
        for yy in range(s.h):
            for xx in range(s.w):
                d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
                if d <= 1 + (r.random() - .5) * rough:
                    if only is None or s.g[yy][xx] in only:
                        s.set(xx, yy, c)
    def ray(s, x, y, dx, dy):
        while s.g[y + dy][x + dx] != '#':
            x += dx; y += dy
        return x, y
    def wall_item(s, x, y, dx, dy, c):
        x, y = s.ray(x, y, dx, dy); s.g[y + dy][x + dx] = c
    def floor_item(s, x, y, dx, dy, c):
        x, y = s.ray(x, y, dx, dy); s.g[y][x] = c
    def rows(s):
        return [''.join(r) for r in s.g]

def place(m, E, I, Q, N, G, K, parts, eggs, pylons, H):
    """Black Ops pack stations. Solid machines must sit on floor next to a wall."""
    for c, (x, y) in (('E', E), ('I', I), ('Q', Q), ('N', N), ('G', G), ('K', K)):
        assert m.g[y][x] in '._', f'{c} at {x},{y} is {m.g[y][x]!r}'
        m.set(x, y, c)
    for c, pts in (('&', parts), ('?', eggs), ('$', pylons)):
        for (x, y) in pts:
            assert m.g[y][x] in '._', f'{c} at {x},{y} is {m.g[y][x]!r}'
            m.set(x, y, c)
    assert m.g[H[1]][H[0]] == '.', f'H at {H}'
    m.set(H[0], H[1], 'H')

WALK = set('.SP_&?H,')
def validate(name, m, doors):
    g = m.g
    pos = {}
    for y in range(m.h):
        for x in range(m.w):
            pos.setdefault(g[y][x], []).append((x, y))
    assert len(pos.get('P', [])) == 1, name + ' needs one P'
    def flood(open_doors):
        sx, sy = pos['P'][0]
        seen = {(sx, sy)}; q = deque([(sx, sy)])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x + dx, y + dy
                c = g[ny][nx]
                if (nx, ny) in seen: continue
                if c in WALK or (c.isdigit() and c in open_doors):
                    seen.add((nx, ny)); q.append((nx, ny))
        return seen
    closed = flood('')
    allopen = flood('0123456789')
    spawns = pos.get('S', [])
    print(name, 'size', m.w, m.h, 'spawns', len(spawns),
          'start-zone spawns', sum(1 for s in spawns if s in closed),
          'unreachable spawns', [s for s in spawns if s not in allopen])
    # interactables adjacent to reachable floor
    for c in 'abcdefghijklmnMUZJRDALVEIQNGK$':
        for (x, y) in pos.get(c, []):
            ok = any((x+dx, y+dy) in allopen for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)))
            if not ok: print('  !! unreachable item', c, x, y)
    for d in doors:
        cells = pos.get(d, [])
        print('  door', d, len(cells), 'cells')
    floors = [(x, y) for y in range(m.h) for x in range(m.w) if g[y][x] in WALK]
    lost = [f for f in floors if f not in allopen]
    print('  floor cells', len(floors), 'unreachable', len(lost), lost[:8])

maps = {}

# ---------------- Outpost Kestrel ----------------
m = Map(44, 34)
m.rect(15, 15, 16, 16)          # A landing pad
m.rect(19, 9, 8, 6)             # A courtyard
m.rect(2, 18, 11, 13)           # B barracks
m.rect(2, 2, 15, 12)            # C refinery
m.rect(33, 2, 9, 30)            # D command
m.rect(13, 23, 2, 2, '1'); m.rect(5, 14, 2, 4, '2'); m.rect(31, 21, 2, 2, '3'); m.rect(17, 11, 2, 2, '4')
for (x, y, w, h) in [(18,18,3,1),(18,18,1,3),(26,18,3,1),(28,18,1,3),(18,28,3,1),(18,26,1,3),(26,28,3,1),(28,26,1,3)]:
    m.rect(x, y, w, h, '=')
m.rect(22, 22, 2, 2, '+')
m.set(16, 17, 'x'); m.set(29, 29, 'x'); m.set(21, 12, 'x'); m.set(24, 10, 'x')
m.rect(4, 20, 1, 4, '+'); m.rect(8, 20, 1, 4, '+'); m.rect(4, 26, 1, 3, '+'); m.rect(8, 26, 1, 3, '+')
for (x, y) in [(5,5),(11,5),(5,10),(11,10)]: m.rect(x, y, 2, 2, 'O')
m.rect(8, 8, 3, 1, '=')
m.rect(35, 10, 3, 1, '='); m.rect(37, 16, 2, 2, '+'); m.rect(35, 24, 3, 1, '='); m.set(39, 7, 'x'); m.set(34, 20, 'x')
m.set(14, 18, 'a'); m.set(22, 31, 'b'); m.set(1, 24, 'c'); m.set(9, 1, 'd'); m.set(42, 20, 'e')
m.set(30, 19, 'J'); m.set(2, 22, 'R'); m.set(16, 8, 'D'); m.set(19, 10, 'A'); m.set(15, 21, 'L'); m.set(41, 12, 'V')
for (x, y) in [(26,30),(12,18),(2,13),(41,27)]: m.set(x, y, 'M')
m.set(37, 31, 'U'); m.set(41, 4, 'Z'); m.set(22, 26, 'P')
for (x, y) in [(15,15),(30,15),(15,30),(30,30),(22,9),(2,18),(12,30),(2,30),(2,2),(16,2),(16,13),(33,2),(41,17),(33,31)]:
    m.set(x, y, 'S')
place(m, E=(41,22), I=(2,9), Q=(12,26), N=(26,13), G=(30,26), K=(15,27), parts=[(6,24),(9,12),(36,14)], eggs=[(29,18),(2,29),(41,9)], pylons=[(16,6),(2,26),(33,13)], H=(25,20))
validate('kestrel', m, '1234'); maps['kestrel'] = m.rows()

# ---------------- Char Depths ----------------
m = Map(48, 38)
m.ell(25, 28, 8, 6, rough=.25, seed=1)       # A hatchery
m.ell(8, 27, 5, 7, rough=.25, seed=2)        # B magma rift
m.ell(10, 10, 7, 6, rough=.25, seed=3)       # C spawning pools
m.ell(25, 8, 6, 5, rough=.25, seed=4)        # E tyrant nest
m.ell(38, 14, 7, 8, rough=.25, seed=5)       # D crystal grotto
m.rect(12, 27, 5, 2); m.rect(14, 27, 2, 2, '1')
m.rect(8, 15, 2, 7); m.rect(8, 17, 2, 2, '2')
m.rect(16, 9, 4, 2); m.rect(17, 9, 2, 2, '4')
m.rect(30, 8, 5, 2)
m.rect(30, 18, 5, 2); m.rect(30, 18, 2, 7); m.rect(30, 21, 2, 2, '3')
m.ell(21, 32, 1.6, 1.1, '~', only='.'); m.ell(30, 31, 1.4, 1.2, '~', only='.')
m.ell(6, 31, 2.2, 1.5, '~', only='.'); m.ell(10, 23, 1.2, 1.2, '~', only='.')
m.ell(8, 8, 1.8, 1.3, '%', only='.'); m.ell(13, 12, 1.5, 1.2, '%', only='.')
m.ell(40, 17, 1.4, 1.4, '%', only='.')
for (x, y) in [(22,26),(28,26),(25,30),(6,25),(12,9),(24,8),(36,11),(40,12),(37,18)]: m.set(x, y, 'O')
for (x, y) in [(19,28),(31,27),(10,30),(6,12),(27,10),(34,15),(41,19)]: m.set(x, y, '=')
m.wall_item(25, 30, 0, 1, 'a'); m.wall_item(8, 27, -1, 0, 'b'); m.wall_item(10, 10, 0, -1, 'c')
m.wall_item(38, 14, 1, 0, 'e'); m.wall_item(25, 8, 0, -1, 'd')
m.floor_item(25, 28, 1, 0, 'J'); m.floor_item(8, 27, 0, 1, 'R'); m.floor_item(10, 10, -1, 0, 'D')
m.floor_item(38, 14, 0, -1, 'A'); m.floor_item(25, 28, -1, 0, 'L'); m.floor_item(38, 14, 0, 1, 'V')
m.floor_item(26, 30, 0, 1, 'M'); m.floor_item(8, 25, 0, -1, 'M'); m.floor_item(12, 7, 0, -1, 'M'); m.floor_item(40, 12, 1, 0, 'M')
m.floor_item(27, 8, 1, -1, 'U') if False else m.floor_item(22, 8, -1, 0, 'U')
m.set(25, 27, 'P')
for (x, y) in [(20,25),(31,29),(25,33),(4,24),(11,31),(8,21),(4,8),(15,7),(6,14),(21,6),(29,5),(41,8),(43,15),(35,20)]:
    m.set(x, y, 'S')
place(m, E=(44,13), I=(4,12), Q=(3,26), N=(30,6), G=(32,26), K=(18,26), parts=[(9,30),(12,6),(38,19)], eggs=[(21,24),(5,10),(24,4)], pylons=[(16,12),(43,9),(12,24)], H=(26,9))
validate('depths', m, '1234'); maps['depths'] = m.rows()

# ---------------- Frostfall Relay ----------------
m = Map(48, 38)
m.rect(14, 18, 20, 15)     # A landing field
m.rect(2, 17, 10, 17)      # B hab domes
m.rect(14, 2, 19, 14)      # C comms array
m.rect(36, 4, 10, 30)      # D cryo lab
m.rect(2, 2, 10, 12, '_')  # E frozen lake
m.rect(12, 6, 2, 3)
m.rect(12, 24, 2, 2, '1'); m.rect(22, 16, 2, 2, '2'); m.rect(34, 25, 2, 2, '3'); m.rect(5, 14, 2, 3, '4')
for (x, y) in [(18,21),(29,21),(18,29),(30,29),(24,31),(16,25)]: m.set(x, y, 'O')
m.rect(22, 23, 4, 3, '+'); m.rect(20, 20, 2, 1, '='); m.rect(27, 27, 2, 1, '='); m.rect(31, 23, 1, 2, '=')
m.rect(4, 20, 3, 3, '+'); m.rect(4, 27, 3, 3, '+'); m.rect(9, 23, 1, 3, '=')
m.rect(21, 6, 5, 4, '+'); m.rect(16, 4, 2, 1, '='); m.rect(29, 11, 2, 1, '='); m.set(16, 12, 'O'); m.set(30, 4, 'O')
m.rect(38, 9, 5, 1, '='); m.rect(38, 15, 5, 1, '='); m.rect(38, 21, 5, 1, '='); m.set(40, 27, 'O'); m.set(40, 30, 'O')
m.set(5, 5, 'O'); m.set(9, 9, 'O'); m.set(7, 11, 'x')
m.set(13, 20, 'a'); m.set(24, 33, 'b'); m.set(1, 25, 'c'); m.set(23, 1, 'd'); m.set(46, 18, 'e')
m.set(33, 19, 'J'); m.set(2, 31, 'R'); m.set(32, 3, 'D'); m.set(11, 17, 'A'); m.set(14, 32, 'L'); m.set(45, 6, 'V')
for (x, y) in [(33,32),(11,33),(14,2),(45,30)]: m.set(x, y, 'M')
m.set(41, 33, 'U'); m.set(45, 12, 'Z'); m.set(24, 28, 'P')
for (x, y) in [(14,18),(33,18),(14,31),(33,31),(2,17),(11,26),(2,33),(14,5),(32,15),(26,2),(36,4),(45,24),(36,33),(2,2),(11,13)]:
    m.set(x, y, 'S')
place(m, E=(45,10), I=(32,8), Q=(2,20), N=(11,11), G=(33,28), K=(14,22), parts=[(7,31),(28,3),(37,27)], eggs=[(18,32),(3,4),(44,33)], pylons=[(14,10),(11,28),(36,20)], H=(26,26))
validate('frostfall', m, '1234'); maps['frostfall'] = m.rows()

# ---------------- Derelict Ark ----------------
m = Map(44, 36)
m.rect(15, 13, 14, 12)     # A cargo bay
m.rect(2, 6, 10, 24)       # B crew quarters
m.rect(14, 2, 16, 7)       # C bridge
m.rect(32, 5, 10, 26)      # D reactor
m.rect(12, 28, 18, 6)      # E engine room
m.rect(12, 18, 3, 2); m.rect(12, 18, 2, 2, '1')
m.rect(21, 9, 2, 4); m.rect(21, 10, 2, 2, '2')
m.rect(30, 4, 2, 2, '3')
m.rect(20, 25, 3, 3); m.rect(20, 25, 3, 2, '4')
m.rect(30, 30, 2, 2)
m.rect(17, 15, 2, 3, '+'); m.rect(25, 15, 2, 3, '+'); m.rect(17, 20, 2, 3, '+'); m.rect(25, 20, 2, 3, '+')
m.set(21, 16, 'x'); m.set(22, 21, 'x'); m.set(16, 23, 'x'); m.set(27, 14, 'x')
for y in (9, 15, 21):
    m.rect(5, y, 1, 4, '+'); m.rect(8, y, 1, 4, '+')
m.rect(17, 4, 3, 1, '='); m.rect(24, 4, 3, 1, '='); m.rect(20, 6, 4, 1, '=')
m.rect(35, 15, 4, 4, '+'); m.rect(34, 9, 1, 3, '='); m.rect(39, 9, 1, 3, '='); m.rect(34, 23, 1, 3, '='); m.rect(39, 23, 1, 3, '=')
for x in (15, 19, 23, 27): m.rect(x, 30, 1, 2, 'O')
m.set(14, 14, 'a'); m.set(22, 1, 'b'); m.set(1, 17, 'c'); m.set(29, 23, 'd') if False else m.set(29, 17, 'd'); m.set(42, 17, 'e')
m.set(28, 24, 'J'); m.set(2, 28, 'R'); m.set(29, 2, 'D'); m.set(11, 7, 'A'); m.set(15, 24, 'L'); m.set(41, 30, 'V')
for (x, y) in [(28,13),(2,6),(14,8),(41,5),(29,33)]: m.set(x, y, 'M')
m.set(36, 30, 'U'); m.set(14, 2, 'Z'); m.set(22, 19, 'P')
for (x, y) in [(15,13),(28,20),(15,19),(24,24),(2,11),(11,29),(4,24),(18,2),(29,6),(32,5),(41,11),(32,26),(12,28),(29,28),(12,33)]:
    m.set(x, y, 'S')
place(m, E=(41,20), I=(14,6), Q=(11,12), N=(29,32), G=(15,21), K=(28,22), parts=[(6,27),(27,3),(33,28)], eggs=[(22,14),(13,32),(38,6)], pylons=[(2,19),(14,4),(41,14)], H=(37,21))
validate('ark', m, '1234'); maps['ark'] = m.rows()

# ---------------- Hesperus City ----------------
from citygen import build_city
m, CITY_BUILDINGS = build_city(Map)
validate('city', m, '0123456789'); maps['city'] = m.rows()

# ---------------- the twelve generated arenas (tools/newmaps.py + tools/arenagen.py) ----------------
from newmaps import build_all
NEW_MAPS, NEW_EXTRA = build_all(Map, validate)
maps.update(NEW_MAPS)

out = sys.argv[1] if len(sys.argv) > 1 else '../js/mapdata.js'
extra = {'city': {'buildings': CITY_BUILDINGS}}
extra.update(NEW_EXTRA)
with open(out, 'w') as f:
    f.write('// Generated by tools/genmaps.py -- edit that script, then run: python genmaps.py\n')
    f.write('XH.MAPGRIDS = ' + json.dumps(maps, indent=1) + ';\n')
    f.write('XH.MAPEXTRA = ' + json.dumps(extra) + ';\n')
for k, rows in maps.items():
    print('\n' + k)
    print('\n'.join(rows))
