"""Hesperus City: a 98x98 cell (245 m) city arena in a 3x3 grid of districts.

Districts are 30x30 cells separated by 2-cell quarantine walls. Each district has a
4-wide avenue cross through its middle; doors sit where avenues meet the walls.
Buildings are recorded as rectangles with a height (m) and facade style so the
renderer can draw real skyscrapers instead of per-cell blocks.

    NW docks        N neon          NE capitol
    W  market       C downtown*     E  park
    SW residential  S metro         SE crater
"""
import random

CITY_BUYS = 'abcdefghijklmn'


def build_city(Map):
    m = Map(98, 98)
    BL = []
    rng = random.Random(77)

    def bld(x, y, w, h, height, style):
        m.rect(x, y, w, h, '#')
        BL.append([x, y, w, h, round(height, 1), style])

    def D(dx, dy):
        return 2 + dx * 32, 2 + dy * 32

    for dy in range(3):
        for dx in range(3):
            x0, y0 = D(dx, dy)
            m.rect(x0, y0, 30, 30)

    def hdoor(dxA, dy, c):
        x0, y0 = D(dxA, dy); m.rect(x0 + 30, y0 + 13, 2, 4, c)

    def vdoor(dx, dyA, c):
        x0, y0 = D(dx, dyA); m.rect(x0 + 13, y0 + 30, 4, 2, c)

    vdoor(1, 0, '1'); hdoor(1, 1, '2'); vdoor(1, 1, '3'); hdoor(0, 1, '4')
    hdoor(0, 0, '5'); hdoor(1, 0, '6'); vdoor(2, 0, '7'); vdoor(2, 1, '8')
    hdoor(1, 2, '9'); hdoor(0, 2, '0')

    def cars(x0, y0, n, avoid=()):
        """wrecked cars parked in avenue lanes"""
        placed = 0
        for _ in range(60):
            if placed >= n: break
            if rng.random() < 0.5:   # horizontal avenue, car 2x1
                lx = rng.choice([1, 3, 5, 8, 10, 19, 21, 23, 26]); ly = rng.choice([13, 16])
                cells = [(lx, ly), (lx + 1, ly)]
            else:
                ly = rng.choice([1, 3, 5, 8, 10, 19, 21, 23, 26]); lx = rng.choice([13, 16])
                cells = [(lx, ly), (lx, ly + 1)]
            if any(m.g[y0 + y][x0 + x] != '.' for x, y in cells): continue
            if any(abs(x - ax) + abs(y - ay) < 4 for x, y in cells for ax, ay in avoid): continue
            for x, y in cells: m.set(x0 + x, y0 + y, '=')
            placed += 1

    # ---------------------------------------------------------------- districts
    def downtown(x0, y0):
        for qx, qy in [(0, 0), (22, 0), (0, 22), (22, 22)]:
            bld(x0 + qx, y0 + qy, 8, 8, rng.uniform(52, 76), rng.choice(['glass', 'glass', 'office']))
        for x, y, w, h in [(9, 0, 4, 4), (17, 0, 4, 4), (9, 26, 4, 4), (17, 26, 4, 4), (0, 9, 4, 4), (0, 17, 4, 4), (26, 9, 4, 4), (26, 17, 4, 4)]:
            bld(x0 + x, y0 + y, w, h, rng.uniform(24, 38), 'office')
        m.rect(x0 + 13, y0 + 13, 4, 4, '+')                       # monument
        for x, y in [(9, 9), (19, 9), (9, 20), (19, 20)]: m.rect(x0 + x, y0 + y, 2, 1, '=')   # planters
        for x, y in [(6, 11), (23, 11), (6, 18), (23, 18)]: m.set(x0 + x, y0 + y, 'x')
        m.set(x0 + 14, y0 + 21, 'P')

    def neon(x0, y0):
        for qx in (0, 17):
            for qy in (0, 17):
                for bx, w in ((0, 5), (7, 6)):
                    for by, h in ((0, 5), (7, 6)):
                        if rng.random() < 0.12: continue       # the odd empty lot
                        bld(x0 + qx + bx, y0 + qy + by, w, h, rng.uniform(12, 36), rng.choice(['neon', 'neon', 'office']))

    def capitol(x0, y0):
        bld(x0 + 5, y0 + 0, 20, 9, 32, 'office')
        bld(x0 + 12, y0 + 2, 6, 5, 84, 'glass')
        bld(x0 + 0, y0 + 0, 4, 9, 22, 'office'); bld(x0 + 26, y0 + 0, 4, 9, 22, 'office')
        bld(x0 + 0, y0 + 22, 9, 8, rng.uniform(28, 40), 'office'); bld(x0 + 21, y0 + 22, 9, 8, rng.uniform(28, 40), 'glass')
        bld(x0 + 26, y0 + 12, 4, 6, 18, 'office')
        m.rect(x0 + 13, y0 + 20, 4, 3, '+')                        # fountain
        for x in (4, 9, 20, 25): m.rect(x0 + x, y0 + 18, 1, 1, '=')

    def park(x0, y0):
        m.rect(x0, y0, 30, 30, ',')
        m.rect(x0 + 13, y0, 4, 30, '.'); m.rect(x0, y0 + 13, 30, 4, '.')
        m.ell(x0 + 6, y0 + 22, 3.6, 2.6, '%', only=',')
        m.rect(x0 + 21, y0 + 21, 3, 3, '+')                        # gazebo
        bld(x0 + 24, y0 + 0, 6, 6, 16, 'glass'); bld(x0 + 0, y0 + 0, 5, 5, 12, 'glass')
        for y in range(y0, y0 + 30):
            for x in range(x0, x0 + 30):
                if m.g[y][x] == ',' and rng.random() < 0.07 and all(m.g[y + a][x + b] in ',.' for a in (-1, 0, 1) for b in (-1, 0, 1)):
                    m.set(x, y, 'T')

    def market(x0, y0):
        for qx in (0, 17):
            for qy in (0, 17):
                bld(x0 + qx, y0 + qy + (0 if qy == 0 else 8), 13, 5, rng.uniform(12, 22), 'brick')
                bld(x0 + qx + (0 if qx == 0 else 8), y0 + qy + (5 if qy == 0 else 0), 5, 8, rng.uniform(10, 18), 'brick')
        for x in (2, 6, 20, 24):
            m.rect(x0 + x, y0 + 11, 2, 2, '+'); m.rect(x0 + x, y0 + 17, 2, 2, '+')   # stalls

    def residential(x0, y0):
        for qx in (0, 17):
            for qy in (0, 17):
                for bx in (0, 7):
                    for by in (0, 7):
                        bld(x0 + qx + bx, y0 + qy + by, 5, 5, rng.uniform(7, 13), 'brick')

    def metro(x0, y0):
        bld(x0 + 0, y0 + 0, 12, 9, 20, 'glass'); bld(x0 + 18, y0 + 0, 12, 6, 16, 'office')
        bld(x0 + 0, y0 + 20, 6, 10, 14, 'office')
        for row in (19, 23, 27):
            m.rect(x0 + 19, y0 + row, 9, 1, '+')                   # train cars
        for row in (21, 25): m.rect(x0 + 20, y0 + row, 7, 1, '=')  # platforms
        for x in (3, 8): m.rect(x0 + x, y0 + 11, 1, 1, '+')        # columns

    def crater(x0, y0):
        for x, y, w, h in [(0, 0, 7, 6), (23, 0, 7, 5), (0, 24, 6, 6), (24, 24, 6, 6), (0, 8, 3, 4), (27, 20, 3, 3)]:
            bld(x0 + x, y0 + y, w, h, rng.uniform(6, 18), 'ruin')
        for cx, cy, rx, ry in [(8, 20, 1.8, 1.3), (21, 8, 1.6, 1.2), (19, 23, 1.4, 1.0)]:
            m.ell(x0 + cx, y0 + cy, rx, ry, '%', only='.')
        for x, y in [(10, 10), (19, 11), (11, 19), (22, 18), (7, 14), (23, 13)]:
            m.set(x0 + x, y0 + y, 'O')
        m.rect(x0 + 18, y0 + 18, 2, 2, 'O')
        for x, y in [(5, 11), (25, 16), (12, 25)]: m.rect(x0 + x, y0 + y, 2, 1, '=')

    def docks(x0, y0):
        bld(x0 + 0, y0 + 0, 12, 8, 12, 'warehouse'); bld(x0 + 18, y0 + 0, 12, 8, 14, 'warehouse')
        bld(x0 + 0, y0 + 20, 11, 10, 11, 'warehouse'); bld(x0 + 20, y0 + 22, 10, 8, 13, 'warehouse')
        for x, y, w, h in [(2, 10, 3, 1), (7, 10, 1, 3), (19, 10, 3, 1), (24, 11, 1, 3), (20, 17, 3, 1), (4, 17, 1, 2)]:
            m.rect(x0 + x, y0 + y, w, h, '+')                      # containers
        for x, y in [(10, 11), (11, 18), (26, 18), (22, 14)]: m.set(x0 + x, y0 + y, 'x')

    kinds = {(0, 0): docks, (1, 0): neon, (2, 0): capitol, (0, 1): market, (1, 1): downtown, (2, 1): park, (0, 2): residential, (1, 2): metro, (2, 2): crater}
    for (dx, dy), fn in kinds.items():
        fn(*D(dx, dy))
    doors_local = [(13, -1), (16, -1), (13, 30), (16, 30), (-1, 13), (-1, 16), (30, 13), (30, 16)]
    for (dx, dy) in kinds:
        x0, y0 = D(dx, dy)
        if (dx, dy) != (2, 0) and (dx, dy) != (2, 1): cars(x0, y0, 4, doors_local)
        elif (dx, dy) == (2, 1): pass
        else: cars(x0, y0, 2, doors_local)

    # perimeter skyline: tall buildings along the outer ring (extend outside the grid)
    for side in range(4):
        pos = 0
        while pos < 98:
            ln = rng.randint(6, 12)
            h = rng.uniform(30, 90); st = rng.choice(['glass', 'office', 'office', 'neon'])
            if side == 0: BL.append([pos, -6, ln, 8, round(h, 1), st])
            elif side == 1: BL.append([pos, 96, ln, 8, round(h, 1), st])
            elif side == 2: BL.append([-6, pos, 8, ln, round(h, 1), st])
            else: BL.append([96, pos, 8, ln, round(h, 1), st])
            pos += ln

    # ---------------------------------------------------------------- stations
    def spot_near(x0, y0, lx, ly, dx, dy, c):
        m.floor_item(x0 + lx, y0 + ly, dx, dy, c)

    C, N, NE, E, S, W, SW, SE, NW = D(1, 1), D(1, 0), D(2, 0), D(2, 1), D(1, 2), D(0, 1), D(0, 2), D(2, 2), D(0, 0)
    # perks
    spot_near(*C, 10, 5, -1, 0, 'J'); spot_near(*C, 19, 24, 1, 0, 'L')
    spot_near(*N, 5, 14, 0, -1, 'R')
    spot_near(*NE, 7, 14, 0, -1, 'D'); spot_near(*NE, 23, 14, 0, -1, 'E')
    spot_near(*E, 14, 27, 1, 0, 'A')
    spot_near(*S, 9, 14, 0, -1, 'V'); spot_near(*S, 24, 14, 0, -1, 'Q')
    spot_near(*W, 6, 14, 0, -1, 'I')
    spot_near(*SW, 14, 6, 1, 0, 'N')
    # gum + bench + box spots
    spot_near(*C, 19, 5, 1, 0, 'G'); spot_near(*C, 10, 24, -1, 0, 'K')
    spot_near(*C, 5, 20, 0, 1, 'M'); spot_near(*W, 23, 14, 0, 1, 'M'); spot_near(*S, 14, 20, 1, 0, 'M'); spot_near(*NE, 14, 25, -1, 0, 'M'); spot_near(*NW, 14, 14, 0, -1, 'M')
    # forge + power in the capitol courtyard
    spot_near(*NE, 9, 14, 0, -1, 'Z'); spot_near(*NE, 20, 14, 0, -1, 'U')

    def floor_pick(x0, y0, avoid_c=None, tries=400, need='.'):
        for _ in range(tries):
            x, y = x0 + rng.randint(1, 28), y0 + rng.randint(1, 28)
            if m.g[y][x] not in need: continue
            if any(m.g[y + a][x + b] not in '.,' for a in (-1, 0, 1) for b in (-1, 0, 1)): continue
            return x, y
        raise RuntimeError('no floor')

    for dd, c in ((W, '&'), (E, '&'), (S, '&'), (NW, '?'), (SW, '?'), (N, '?')):
        x, y = floor_pick(*dd, need='.,'); m.set(x, y, c)
    for dd in (NW, SW, E):
        x, y = floor_pick(*dd, need='.,'); m.set(x, y, '$')
    m.set(SE[0] + 15, SE[1] + 15, 'H')

    # wall buys (14) on building faces around the city
    buys = [(C, 14, 8, 0, -1), (C, 8, 14, -1, 0), (N, 6, 14, 0, -1), (N, 14, 6, 1, 0), (NE, 14, 12, 1, 0), (W, 14, 7, 1, 0),
            (W, 14, 22, -1, 0), (E, 14, 4, 1, 0), (S, 14, 6, -1, 0), (S, 5, 16, 0, 1), (SW, 14, 22, 1, 0), (SE, 14, 4, 1, 0), (NW, 14, 22, -1, 0), (C, 22, 14, 0, 1)]
    for (dd, lx, ly, dx, dy), ch in zip(buys, CITY_BUYS):
        m.wall_item(dd[0] + lx, dd[1] + ly, dx, dy, ch)

    # spawn vents: 5 per district, away from doors and the start
    px, py = C[0] + 14, C[1] + 21
    for (dx, dy) in kinds:
        x0, y0 = D(dx, dy); n = 0
        for _ in range(800):
            if n >= 5: break
            x, y = floor_pick(x0, y0, need='.,')
            if abs(x - px) + abs(y - py) < 10: continue
            if any(abs(x - (x0 + a)) + abs(y - (y0 + b)) < 4 for a, b in doors_local): continue
            if any(m.g[yy][xx] == 'S' for yy in range(y - 4, y + 5) for xx in range(x - 4, x + 5) if 0 <= yy < 98 and 0 <= xx < 98): continue
            m.set(x, y, 'S'); n += 1
    return m, BL
