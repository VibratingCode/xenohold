"""Room-and-corridor arena generator.

A spec lists rooms (rects or caves), corridors between them (with or without a door), and room features.
Everything the game needs is then placed automatically: the start point, doors, perk machines, wall
weapons, Xeno Cache spots, the Forge, the generator, quest pylons/eggs/parts/heart, capsule machine,
workbench and spawn vents. The result is validated (every floor cell and machine reachable, each door
a real choke point) and retried with another seed if anything fails.
"""
import random
from collections import deque

WALK = set('.SP_&?H,~%')
PERKS = 'JRDALVEIQN'


class Gen:
    def __init__(s, Map, spec, seed):
        s.spec, s.r = spec, random.Random(seed)
        s.m = Map(spec['w'], spec['h'])
        s.rooms = []          # [{name, cells:set, cx, cy}]
        s.doors = {}          # digit -> {name, cost, cells}
        s.used = set()        # cells reserved around placed things
        s.placed = []         # everything placed so far (for spreading machines apart)

    # ---------------- carving ----------------
    def carve_rooms(s):
        m = s.m
        for i, rm in enumerate(s.spec['rooms']):
            name, shape, x, y, w, h = rm[:6]
            cells = set()
            if shape == 'r':
                for yy in range(y, y + h):
                    for xx in range(x, x + w):
                        if 0 < xx < m.w - 1 and 0 < yy < m.h - 1: cells.add((xx, yy))
            else:  # cave: rough ellipse
                cx, cy, rx, ry = x + w / 2 - .5, y + h / 2 - .5, w / 2, h / 2
                for yy in range(y - 1, y + h + 1):
                    for xx in range(x - 1, x + w + 1):
                        d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
                        if d <= 1 + (s.r.random() - .5) * 0.3 and 0 < xx < m.w - 1 and 0 < yy < m.h - 1: cells.add((xx, yy))
            for (xx, yy) in cells: m.g[yy][xx] = '.'
            s.rooms.append({'name': name, 'cells': cells, 'cx': x + w // 2, 'cy': y + h // 2, 'feat': rm[6] if len(rm) > 6 else []})

    def room_of(s, x, y):
        for i, rm in enumerate(s.rooms):
            if (x, y) in rm['cells']: return i
        return -1

    def carve_links(s):
        """Each corridor is an L between random points of its two rooms. Its cells outside those rooms must be solid
        rock that does not touch any other room or corridor, so corridors never merge and every door is a real choke."""
        m, cw = s.m, s.spec.get('corridor', 2)
        s.corr = set()
        for li, link in enumerate(s.spec['links']):
            a, b, door = link[:3]
            cost = link[3] if len(link) > 3 else None
            A, Bm = s.rooms[a], s.rooms[b]
            ok = None
            ca, cb = sorted(A['cells']), sorted(Bm['cells'])
            for attempt in range(400):
                (ax, ay), (bx, by) = s.r.choice(ca), s.r.choice(cb)
                hfirst = s.r.random() < 0.5
                pts = []
                if hfirst:
                    pts = [(x, ay) for x in range(ax, bx, 1 if bx > ax else -1)] + [(bx, y) for y in range(ay, by + (1 if by >= ay else -1), 1 if by >= ay else -1)]
                else:
                    pts = [(ax, y) for y in range(ay, by, 1 if by > ay else -1)] + [(x, by) for x in range(ax, bx + (1 if bx >= ax else -1), 1 if bx >= ax else -1)]
                cells, foreign, bad = [], [], False
                for i, (x, y) in enumerate(pts):
                    horiz = (i + 1 < len(pts) and pts[i + 1][1] == y) or (i > 0 and pts[i - 1][1] == y)
                    for k in range(cw):
                        nx, ny = (x, y + k) if horiz else (x + k, y)
                        if not (1 < nx < m.w - 2 and 1 < ny < m.h - 2): bad = True; break
                        cells.append((nx, ny))
                        if (nx, ny) not in A['cells'] and (nx, ny) not in Bm['cells']: foreign.append((i, nx, ny, horiz))
                    if bad: break
                if bad or len(foreign) < cw * 2: continue
                fset = {(x, y) for (_, x, y, _) in foreign}
                for (_, x, y, _) in foreign:
                    for yy in range(y - 1, y + 2):
                        for xx in range(x - 1, x + 2):
                            if (xx, yy) in fset or (xx, yy) in A['cells'] or (xx, yy) in Bm['cells']: continue
                            if m.g[yy][xx] != '#' or (xx, yy) in s.corr: bad = True
                    if bad: break
                if bad: continue
                ok = (cells, foreign, fset); break
            if not ok: raise RuntimeError('no corridor %s-%s' % (A['name'], Bm['name']))
            cells, foreign, fset = ok
            for (x, y) in cells:
                if m.g[y][x] == '#': m.g[y][x] = '.'
            s.corr |= fset
            if door:
                # middle of the foreign stretch, 2 cells deep along the corridor
                idxs = sorted({i for (i, _, _, _) in foreign})
                mid = idxs[len(idxs) // 2]
                seg = [(x, y, h) for (i, x, y, h) in foreign if i in (mid, mid + 1)]
                dcells = [(x, y) for (x, y, h) in seg]
                for (x, y) in dcells: m.g[y][x] = door
                s.doors[door] = {'name': s.rooms[b]['name'], 'cost': cost or 750 + 250 * li, 'cells': dcells}

    # ---------------- helpers ----------------
    def nb4(s, x, y):
        return [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]

    def floor_cells(s, i, inner=0):
        m, out = s.m, []
        for (x, y) in s.rooms[i]['cells']:
            if m.g[y][x] != '.' or (x, y) in s.used: continue
            if inner and any(m.g[yy][xx] != '.' for xx in range(x - inner, x + inner + 1) for yy in range(y - inner, y + inner + 1)): continue
            out.append((x, y))
        return out

    def near_door(s, x, y, r=3):
        for d in s.doors.values():
            for (dx, dy) in d['cells']:
                if abs(dx - x) <= r and abs(dy - y) <= r: return True
        return False

    def wallside(s, i):
        """floor cells in room i with a wall behind them, away from doors and corridor mouths"""
        m, out = s.m, []
        for (x, y) in s.floor_cells(i):
            walls = sum(1 for (nx, ny) in s.nb4(x, y) if m.g[ny][nx] == '#')
            if walls != 1 or s.near_door(x, y): continue
            # not next to a corridor mouth: all 8 neighbours are room cells or walls
            if any(0 <= yy < m.h and 0 <= xx < m.w and m.g[yy][xx] == '.' and s.room_of(xx, yy) != i for xx in range(x - 2, x + 3) for yy in range(y - 2, y + 3)): continue
            out.append((x, y))
        return out

    def wallslots(s, i):
        """wall cells facing exactly one floor cell of room i (for wall weapons)"""
        m, out, seen = s.m, [], set()
        for (x, y) in s.floor_cells(i):
            for (nx, ny) in s.nb4(x, y):
                if (nx, ny) in seen or m.g[ny][nx] != '#': continue
                seen.add((nx, ny))
                fl = [(ax, ay) for (ax, ay) in s.nb4(nx, ny) if 0 <= ax < m.w and 0 <= ay < m.h and m.g[ay][ax] not in '#']
                if len(fl) != 1 or s.near_door(nx, ny) or (nx, ny) in s.used: continue
                if not (0 < nx < m.w - 1 and 0 < ny < m.h - 1): continue
                out.append((nx, ny))
        return out

    def spread(s, cands, n, avoid=()):
        """farthest-point sampling"""
        cands = [c for c in cands if c not in s.used]
        picks = []
        pool = list(avoid) + s.placed
        s.r.shuffle(cands)
        for _ in range(n):
            if not cands: break
            best = max(cands, key=lambda c: min([abs(c[0] - p[0]) + abs(c[1] - p[1]) for p in pool] or [99]) + s.r.random())
            picks.append(best); pool.append(best); cands.remove(best)
        return picks

    def put(s, x, y, c, pad=1):
        s.m.g[y][x] = c
        s.placed.append((x, y))
        for yy in range(y - pad, y + pad + 1):
            for xx in range(x - pad, x + pad + 1): s.used.add((xx, yy))

    # ---------------- features ----------------
    def features(s):
        m = s.m
        for i, rm in enumerate(s.rooms):
            for f in rm['feat']:
                kind = f[0] if isinstance(f, tuple) else f
                arg = f[1] if isinstance(f, tuple) and len(f) > 1 else None
                inner = s.floor_cells(i, 2)
                if kind == 'pillars':
                    xs = sorted({x for x, _ in inner}); ys = sorted({y for _, y in inner})
                    if not xs or not ys: continue
                    for y in range(ys[0] + 1, ys[-1], 5):
                        for x in range(xs[0] + 1, xs[-1], 5):
                            if all((x + dx, y + dy) in inner for dx in (0, 1) for dy in (0, 1)) and not s.near_door(x, y, 3):
                                for dx in (0, 1):
                                    for dy in (0, 1): m.g[y + dy][x + dx] = arg or '+'
                elif kind in ('cover', 'crates', 'spires', 'trees'):
                    ch = {'cover': '=', 'crates': 'x', 'spires': 'O', 'trees': 'T'}[kind]
                    n = arg or max(2, len(inner) // 40)
                    for (x, y) in s.spread(inner, n):
                        if s.near_door(x, y, 3): continue
                        if kind == 'cover':
                            horiz = s.r.random() < 0.5
                            for k in range(2 + s.r.randrange(2)):
                                xx, yy = (x + k, y) if horiz else (x, y + k)
                                if (xx, yy) in inner: m.g[yy][xx] = '='
                        else:
                            m.g[y][x] = ch
                elif kind == 'center':
                    cx, cy, sz = rm['cx'], rm['cy'], arg or 3
                    for yy in range(cy - sz // 2, cy - sz // 2 + sz):
                        for xx in range(cx - sz // 2, cx - sz // 2 + sz):
                            if (xx, yy) in rm['cells'] and not s.near_door(xx, yy, 3): m.g[yy][xx] = '+'
                elif kind in ('lava', 'acid', 'ice', 'grass'):
                    ch = {'lava': '~', 'acid': '%', 'ice': '_', 'grass': ','}[kind]
                    n = arg or 2
                    for (x, y) in s.spread(inner, n):
                        rx, ry = 1 + s.r.random() * 2.2, 1 + s.r.random() * 1.8
                        for yy in range(int(y - ry - 1), int(y + ry + 2)):
                            for xx in range(int(x - rx - 1), int(x + rx + 2)):
                                if ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2 <= 1 and (xx, yy) in inner and m.g[yy][xx] == '.' and not s.near_door(xx, yy, 2):
                                    m.g[yy][xx] = ch
                elif kind == 'carpet':   # whole-room floor type (walkable)
                    for (x, y) in rm['cells']:
                        if m.g[y][x] == '.': m.g[y][x] = arg

    # ---------------- stations ----------------
    def stations(s):
        sp, m, R = s.spec, s.m, s.rooms
        order = s.depth_order()
        start = 0
        # start point
        c = s.spread(s.floor_cells(start, 1), 1, avoid=[(R[start]['cx'], R[start]['cy'])])
        px, py = min(s.floor_cells(start, 1), key=lambda q: abs(q[0] - R[start]['cx']) + abs(q[1] - R[start]['cy']))
        s.put(px, py, 'P', 2)
        rooms_by_depth = [i for i in order]
        non_start = [i for i in rooms_by_depth if i != start]
        # perks: one in the start room, the rest spread by depth
        perk_rooms = [start] + [non_start[k % len(non_start)] for k in range(len(PERKS) - 1)]
        for ch, i in zip(sp.get('perkOrder', PERKS), perk_rooms):
            pick = s.spread(s.wallside(i), 1)
            if not pick: pick = s.spread([q for j in non_start for q in s.wallside(j)], 1)
            if pick: s.put(pick[0][0], pick[0][1], ch)
        # wall weapons: letters in order, two in the start room
        letters = sp.get('buys', 'abcdef')
        buy_rooms = [start, start] + [non_start[k % len(non_start)] for k in range(len(letters) - 2)]
        for ch, i in zip(letters, buy_rooms):
            pick = s.spread(s.wallslots(i), 1)
            if pick: s.put(pick[0][0], pick[0][1], ch, 1)
        # Xeno Cache spots
        for i in [start] + non_start[::max(1, len(non_start) // 3)][:3]:
            pick = s.spread(s.wallside(i), 1)
            if pick: s.put(pick[0][0], pick[0][1], 'M')
        # forge in the deepest room, generator in the middle depth
        for ch, i in (('U', rooms_by_depth[-1]), ('Z', non_start[len(non_start) // 2]) if sp.get('power', True) else (None, None)):
            if not ch: continue
            pick = s.spread(s.wallside(i), 1)
            if pick: s.put(pick[0][0], pick[0][1], ch)
        # capsule machine & workbench
        for ch, i in (('G', non_start[0]), ('K', non_start[1 % len(non_start)])):
            pick = s.spread(s.wallside(i), 1)
            if pick: s.put(pick[0][0], pick[0][1], ch)
        # quest: pylons & eggs against walls, parts in the open, heart in a deep room's middle
        qrooms = non_start[:]
        s.r.shuffle(qrooms)
        for ch, n in (('$', 3), ('?', 3)):
            for k in range(n):
                i = qrooms[k % len(qrooms)]
                pick = s.spread(s.wallside(i), 1)
                if pick: s.put(pick[0][0], pick[0][1], ch)
        for k in range(3):
            i = qrooms[(k + 1) % len(qrooms)]
            pick = s.spread(s.floor_cells(i, 1), 1)
            if pick: s.put(pick[0][0], pick[0][1], '&')
        hi = rooms_by_depth[-2] if len(rooms_by_depth) > 2 else non_start[0]
        hc = min(s.floor_cells(hi, 1), key=lambda q: abs(q[0] - R[hi]['cx']) + abs(q[1] - R[hi]['cy']))
        s.put(hc[0], hc[1], 'H', 2)
        # spawn vents
        for i in range(len(R)):
            n = sp.get('spawnsPerRoom', 3) + (1 if len(R[i]['cells']) > 220 else 0)
            for (x, y) in s.spread(s.wallside(i) or s.floor_cells(i), n):
                s.put(x, y, 'S', 0)

    def depth_order(s):
        adj = {i: [] for i in range(len(s.rooms))}
        for link in s.spec['links']:
            a, b = link[0], link[1]
            adj[a].append(b); adj[b].append(a)
        seen, q, order = {0}, deque([0]), []
        while q:
            i = q.popleft(); order.append(i)
            for j in adj[i]:
                if j not in seen: seen.add(j); q.append(j)
        return order

    # ---------------- validation ----------------
    def validate(s):
        m, g = s.m, s.m.g
        pos = {}
        for y in range(m.h):
            for x in range(m.w): pos.setdefault(g[y][x], []).append((x, y))
        if len(pos.get('P', [])) != 1: return 'no P'
        def flood(open_doors):
            sx, sy = pos['P'][0]; seen = {(sx, sy)}; q = deque([(sx, sy)])
            while q:
                x, y = q.popleft()
                for (nx, ny) in s.nb4(x, y):
                    if (nx, ny) in seen: continue
                    c = g[ny][nx]
                    if c in WALK or (c.isdigit() and c in open_doors): seen.add((nx, ny)); q.append((nx, ny))
            return seen
        closed, allopen = flood(''), flood('0123456789')
        floors = [(x, y) for y in range(m.h) for x in range(m.w) if g[y][x] in WALK]
        lost = [f for f in floors if f not in allopen]
        if lost: return 'unreachable floor %d' % len(lost)
        for c in 'abcdefghMUZJRDALVEIQNGK$':
            for (x, y) in pos.get(c, []):
                if not any(q in allopen for q in s.nb4(x, y)): return 'unreachable item ' + c
        for d, info in s.doors.items():
            if not info['cells']: return 'empty door ' + d
        need = set(PERKS) | set('PUMGKH')
        if s.spec.get('power', True): need.add('Z')
        miss = [c for c in need if c not in pos]
        if miss: return 'missing ' + ''.join(miss)
        if len(pos.get('$', [])) < 3 or len(pos.get('?', [])) < 3 or len(pos.get('&', [])) < 3: return 'quest items'
        if len(pos.get('S', [])) < 10: return 'few spawns'
        if not any(sp in closed for sp in pos.get('S', [])): return 'no start spawns'
        # doors must be real choke points: with all doors shut, only rooms joined to the start by open corridors are reachable
        free = {0}
        changed = True
        while changed:
            changed = False
            for link in s.spec['links']:
                a, b, door = link[:3]
                if door: continue
                if a in free and b not in free: free.add(b); changed = True
                if b in free and a not in free: free.add(a); changed = True
        for i, rm in enumerate(s.rooms):
            inside = any(c in closed for c in rm['cells'])
            if inside != (i in free): return 'door bypass into ' + rm['name']
        return None


def build_arena(Map, spec, tries=60):
    last = None
    for t in range(tries):
        gen = Gen(Map, spec, spec.get('seed', 1) * 1000 + t)
        try:
            gen.carve_rooms(); gen.carve_links(); gen.features(); gen.stations()
            err = gen.validate()
        except (RuntimeError, ValueError, IndexError) as e:
            err = str(e)
        if not err:
            # a lamp per room, a few cells off-centre on open floor (never on the spawn point)
            lamps = []
            for r in gen.rooms:
                c = [(x, y) for (x, y) in r['cells'] if gen.m.g[y][x] == '.' and (x, y) not in gen.used and 3 <= abs(x - r['cx']) + abs(y - r['cy']) <= 6
                     and all(gen.m.g[yy][xx] == '.' for xx in range(x - 1, x + 2) for yy in range(y - 1, y + 2))]
                c.sort(key=lambda q: (abs(q[0] - r['cx']) + abs(q[1] - r['cy']), q))
                lamps.append(c[len(c) // 3] if c else (r['cx'], r['cy']))
            info = {
                'rooms': [{'name': r['name'], 'cx': r['cx'], 'cz': r['cy'], 'lx': lamps[k][0], 'lz': lamps[k][1]} for k, r in enumerate(gen.rooms)],
                'doors': {d: {'name': v['name'], 'cost': v['cost']} for d, v in gen.doors.items()},
            }
            return gen.m, info
        last = err
    raise RuntimeError(spec['id'] + ': ' + str(last))
