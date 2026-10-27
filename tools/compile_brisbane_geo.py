#!/usr/bin/env python3
"""Compile an Overpass extract into src/world/geo/brisbane.data.js.

The projection here must match src/world/geo/project.js:
  WGS84 local ENU, x = east, z = -north, origin = Brisbane City Hall centroid.
"""
import base64
import json
import math
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CITY = '/tmp/bne-full.json'
WATER = '/tmp/bne-water.json'
OUT_JS = os.path.join(ROOT, 'src', 'world', 'geo', 'brisbane.data.js')
OUT_MD = os.path.join(ROOT, 'data', 'geo', 'PROVENANCE.md')

A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)
# West through the West End river bend, south through Orleigh Park,
# east across the Kangaroo Point shore. North edge stays at the CBD.
BBOX = dict(south=-27.4915, west=153.0000, north=-27.4595, east=153.0465)
CELL = 4.0
DECK_Q = 0.35  # metres per walk-grid step
WATER_Y = -0.7
LEVEL_M = 3.2  # estimated storey height when only building:levels is tagged

WIDTH = {
    'motorway': 12, 'motorway_link': 6.5, 'trunk': 11, 'trunk_link': 6.5,
    'primary': 10, 'primary_link': 6, 'secondary': 8, 'secondary_link': 5,
    'tertiary': 7, 'tertiary_link': 4.5, 'unclassified': 6, 'residential': 6,
    'living_street': 5, 'service': 3.8, 'busway': 8, 'pedestrian': 4.5,
    'footway': 2.0, 'path': 1.5, 'steps': 1.6, 'cycleway': 2.4, 'track': 2.2,
}
CLASS = {
    'motorway': 0, 'motorway_link': 0, 'trunk': 0, 'trunk_link': 0,
    'primary': 0, 'primary_link': 0, 'secondary': 0, 'secondary_link': 0,
    'tertiary': 1, 'tertiary_link': 1, 'unclassified': 1, 'residential': 1,
    'living_street': 1, 'service': 1, 'busway': 5, 'pedestrian': 2,
    'footway': 3, 'path': 3, 'steps': 3, 'cycleway': 4, 'track': 3,
}
HOUSE = {'house', 'detached', 'semidetached_house', 'terrace', 'garage', 'garages', 'shed', 'cabin', 'roof', 'carport'}
COLOR = {
    'retail': 0xc45a4a, 'commercial': 0xb7b1a4, 'office': 0x9eb0be,
    'apartments': 0xd2c3a6, 'residential': 0xd8c8ae, 'house': 0xe6d7be,
    'detached': 0xe6d7be, 'terrace': 0xe0d0b4, 'civic': 0xf3ead7,
    'public': 0xf3ead7, 'government': 0xf7f1e4, 'parliament': 0xf7f1e4,
    'hotel': 0xc9b090, 'church': 0xe8e0d4, 'cathedral': 0xefe6d6,
    'school': 0xd5c4a1, 'university': 0xcabb96, 'industrial': 0x8d8680,
    'warehouse': 0x8a8078, 'garage': 0x9a9288, 'station': 0xb0b6be,
    'stadium': 0xd0d4d8, 'yes': 0xc6bfb2, 'train_station': 0xb0b6be,
}


def radii(lat0):
    s = math.sin(math.radians(lat0))
    N = A / math.sqrt(1 - E2 * s * s)
    M = A * (1 - E2) / (1 - E2 * s * s) ** 1.5
    return N, M


def make_enu(lat0, lon0):
    N, M = radii(lat0)
    c = math.cos(math.radians(lat0))

    def enu(lat, lon):
        x = math.radians(lon - lon0) * N * c
        north = math.radians(lat - lat0) * M
        return x, -north
    return enu


def vincenty(lat1, lon1, lat2, lon2):
    a, f = A, F
    b = (1 - f) * a
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    L = math.radians(lon2 - lon1)
    U1 = math.atan((1 - f) * math.tan(phi1))
    U2 = math.atan((1 - f) * math.tan(phi2))
    lam = L
    sin_sigma = cos_sigma = sigma = sin_a = cos2a = cos2sm = 0
    for _ in range(80):
        su1, cu1 = math.sin(U1), math.cos(U1)
        su2, cu2 = math.sin(U2), math.cos(U2)
        sl, cl = math.sin(lam), math.cos(lam)
        sin_sigma = math.sqrt((cu2 * sl) ** 2 + (cu1 * su2 - su1 * cu2 * cl) ** 2)
        if sin_sigma == 0:
            return 0.0
        cos_sigma = su1 * su2 + cu1 * cu2 * cl
        sigma = math.atan2(sin_sigma, cos_sigma)
        sin_a = cu1 * cu2 * sl / sin_sigma
        cos2a = 1 - sin_a ** 2
        cos2sm = cos_sigma - 2 * su1 * su2 / cos2a if cos2a else 0
        C = f / 16 * cos2a * (2 + f * (4 - 3 * cos2a))
        prev = lam
        lam = L + (1 - C) * f * sin_a * (sigma + C * sin_sigma * (cos2sm + C * cos_sigma * (-1 + 2 * cos2sm ** 2)))
        if abs(lam - prev) < 1e-12:
            break
    u2 = cos2a * (a * a - b * b) / (b * b)
    AA = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    BB = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    d_sigma = BB * sin_sigma * (cos2sm + BB / 4 * (cos_sigma * (-1 + 2 * cos2sm ** 2) - BB / 6 * cos2sm * (-3 + 4 * sin_sigma ** 2) * (-3 + 4 * cos2sm ** 2)))
    return b * AA * (sigma - d_sigma)


def haversine(lat1, lon1, lat2, lon2):
    R = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def rnd(v):
    return round(v, 1)


def parse_m(raw):
    if raw is None:
        return None
    s = str(raw).strip().lower().replace('metres', '').replace('meter', '').replace('m', '')
    s = s.split(';')[0].split('~')[0].strip()
    try:
        return float(s)
    except ValueError:
        return None


def ring_of(el, enu):
    g = el.get('geometry') or []
    pts = []
    for p in g:
        x, z = enu(p['lat'], p['lon'])
        if not pts or (pts[-1][0] - x) ** 2 + (pts[-1][1] - z) ** 2 > 0.04:
            pts.append((x, z))
    return pts


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    out = [pts[0]]
    for p in pts[1:]:
        if (p[0] - out[-1][0]) ** 2 + (p[1] - out[-1][1]) ** 2 >= tol * tol:
            out.append(p)
    if (out[-1][0] - pts[-1][0]) ** 2 + (out[-1][1] - pts[-1][1]) ** 2 > 0.01:
        out.append(pts[-1])
    return out


def closed(pts, tol=1.6):
    return len(pts) >= 4 and (pts[0][0] - pts[-1][0]) ** 2 + (pts[0][1] - pts[-1][1]) ** 2 <= tol * tol


def close_ring(pts):
    if not pts:
        return pts
    if (pts[0][0] - pts[-1][0]) ** 2 + (pts[0][1] - pts[-1][1]) ** 2 > 0.01:
        pts = pts + [pts[0]]
    return pts


def dedupe_close(pts):
    if len(pts) < 2:
        return pts
    out = [pts[0]]
    for p in pts[1:]:
        if (p[0] - out[-1][0]) ** 2 + (p[1] - out[-1][1]) ** 2 > 0.05:
            out.append(p)
    return out


def area(pts):
    if len(pts) < 3:
        return 0
    s = 0
    for i in range(len(pts) - 1):
        s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    return abs(s) * 0.5


def centroid(pts):
    if not pts:
        return 0, 0
    body = pts[:-1] if len(pts) > 1 and pts[0] == pts[-1] else pts
    return sum(p[0] for p in body) / len(body), sum(p[1] for p in body) / len(body)


def length(pts):
    return sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts)))


def midpoint(pts):
    if len(pts) < 2:
        return pts[0] if pts else (0, 0), 0
    target = length(pts) * 0.5
    acc = 0
    for i in range(1, len(pts)):
        seg = math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        if acc + seg >= target and seg > 0:
            t = (target - acc) / seg
            x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t
            z = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t
            heading = math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
            return (x, z), heading
        acc += seg
    return pts[-1], 0


def closest_boundary(ring, x, z):
    pts = ring[:-1] if ring and ring[0] == ring[-1] else ring
    best = pts[0]
    best_d = 1e18
    m = len(pts)
    for i in range(m):
        ax, az = pts[i]
        bx, bz = pts[(i + 1) % m]
        abx, abz = bx - ax, bz - az
        den = abx * abx + abz * abz
        t = 0 if den < 1e-8 else max(0.0, min(1.0, ((x - ax) * abx + (z - az) * abz) / den))
        qx, qz = ax + abx * t, az + abz * t
        d = (qx - x) ** 2 + (qz - z) ** 2
        if d < best_d:
            best_d = d
            best = (qx, qz)
    return best


def point_in(ring, x, z):
    n = 0
    pts = ring[:-1] if ring and ring[0] == ring[-1] else ring
    m = len(pts)
    j = m - 1
    for i in range(m):
        xi, zi = pts[i]
        xj, zj = pts[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / ((zj - zi) or 1e-12) + xi:
            n += 1
        j = i
    return n % 2 == 1


def bbox_of(pts):
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    return min(xs), max(xs), min(zs), max(zs)


def near(a, b, tol):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 <= tol * tol


def stitch(lines, tol=2.2):
    rings = stitch_once(lines, tol)
    # A second pass only sees chains stitch_once could not close.
    return [r for r in rings if len(r) >= 4]


def stitch_once(lines, tol):
    lines = [list(l) for l in lines if len(l) >= 2]
    rings = []
    while lines:
        ring = lines.pop(0)
        changed = True
        hops = 0
        while changed and hops < 500 and not near(ring[0], ring[-1], tol):
            hops += 1
            changed = False
            for i, l in enumerate(lines):
                if near(ring[-1], l[0], tol):
                    ring.extend(l[1:]); lines.pop(i); changed = True; break
                if near(ring[-1], l[-1], tol):
                    ring.extend(list(reversed(l[:-1]))); lines.pop(i); changed = True; break
                if near(ring[0], l[-1], tol):
                    ring = l[:-1] + ring; lines.pop(i); changed = True; break
                if near(ring[0], l[0], tol):
                    ring = list(reversed(l[1:])) + ring; lines.pop(i); changed = True; break
        if near(ring[0], ring[-1], tol):
            rings.append(close_ring(dedupe_close(ring)))
    return rings


def clip_rect(poly, minx, minz, maxx, maxz):
    def sh(poly, inside, intersect):
        if not poly:
            return []
        out = []
        prev = poly[-1]
        prev_in = inside(prev)
        for cur in poly:
            cur_in = inside(cur)
            if cur_in:
                if not prev_in:
                    out.append(intersect(prev, cur))
                out.append(cur)
            elif prev_in:
                out.append(intersect(prev, cur))
            prev, prev_in = cur, cur_in
        return out

    def ix(const, axis):
        def inter(a, b):
            dx, dz = b[0] - a[0], b[1] - a[1]
            if axis == 0:
                t = 0 if abs(dx) < 1e-12 else (const - a[0]) / dx
                return (const, a[1] + dz * t)
            t = 0 if abs(dz) < 1e-12 else (const - a[1]) / dz
            return (a[0] + dx * t, const)
        return inter

    body = poly[:-1] if poly and poly[0] == poly[-1] else list(poly)
    body = sh(body, lambda p: p[0] >= minx, ix(minx, 0))
    body = sh(body, lambda p: p[0] <= maxx, ix(maxx, 0))
    body = sh(body, lambda p: p[1] >= minz, ix(minz, 1))
    body = sh(body, lambda p: p[1] <= maxz, ix(maxz, 1))
    if len(body) < 3:
        return []
    return close_ring(dedupe_close(body))


def flat(pts):
    out = []
    last = None
    body = pts[:-1] if pts and pts[0] == pts[-1] else pts
    for x, z in body:
        p = (rnd(x), rnd(z))
        if last != p:
            out.extend(p)
            last = p
    if len(out) >= 4 and (out[0], out[1]) != (out[-2], out[-1]):
        pass
    return out


def layer_deck(tags):
    bridge = tags.get('bridge')
    is_bridge = tags.get('man_made') == 'bridge' or bridge in (
        'yes', 'viaduct', 'cantilever', 'boardwalk', 'aqueduct', 'suspension', 'cable-stayed', 'movable')
    raw = tags.get('layer')
    L = None
    if raw not in (None, ''):
        try:
            L = int(str(raw).split(';')[0])
        except ValueError:
            L = None
    if not is_bridge and (L is None or L <= 0):
        return 0.0
    if L is None:
        L = 1 if is_bridge else 0
    if L <= 0:
        return 0.0
    # OSM layer is an ordering integer, not a clearance. This spacing only
    # separates stacked decks. It is not a measured height above the river.
    return round(1.6 + (L - 1) * 2.8, 2)


def profile(pts, deck):
    if deck < 0.2 or len(pts) < 2:
        return [(x, z, 0.02) for x, z in pts]
    total = length(pts)
    ramp = deck / 0.08  # 8% so a 4 m cell rises about one 0.35 m step
    ramp = min(ramp, total * 0.42)
    ramp = max(ramp, min(12, total / 2))
    out = []
    acc = 0
    for i, (x, z) in enumerate(pts):
        if i:
            acc += math.hypot(x - pts[i - 1][0], z - pts[i - 1][1])
        if acc < ramp:
            y = deck * (acc / ramp)
        elif acc > total - ramp:
            y = deck * max(0, (total - acc) / ramp)
        else:
            y = deck
        out.append((x, z, y))
    return out


def fill_poly(mask, ring, value, minx, minz, w, h, cell):
    pts = ring[:-1] if ring and ring[0] == ring[-1] else ring
    n = len(pts)
    if n < 3:
        return
    zs = [p[1] for p in pts]
    j0 = max(0, int((min(zs) - minz) / cell) - 1)
    j1 = min(h - 1, int((max(zs) - minz) / cell) + 1)
    for j in range(j0, j1 + 1):
        z = minz + (j + 0.5) * cell
        xs = []
        for i in range(n):
            x1, z1 = pts[i]
            x2, z2 = pts[(i + 1) % n]
            if (z1 <= z < z2) or (z2 <= z < z1):
                if abs(z2 - z1) < 1e-9:
                    continue
                t = (z - z1) / (z2 - z1)
                xs.append(x1 + (x2 - x1) * t)
        xs.sort()
        pairs = list(zip(xs[0::2], xs[1::2]))
        for a, b in pairs:
            i0 = max(0, int((a - minx) / cell))
            i1 = min(w - 1, int((b - minx) / cell))
            row = j * w
            for i in range(i0, i1 + 1):
                mask[row + i] = value


def stamp_ribbon(deck, pts, width, minx, minz, w, h, cell):
    if len(pts) < 2:
        return
    rad = max(width * 0.5, cell * 0.55)
    step = max(1.5, cell * 0.45)
    for i in range(1, len(pts)):
        x0, z0, y0 = pts[i - 1]
        x1, z1, y1 = pts[i]
        seg = math.hypot(x1 - x0, z1 - z0)
        n = max(1, int(seg / step))
        for s in range(n + 1):
            t = s / n
            x = x0 + (x1 - x0) * t
            z = z0 + (z1 - z0) * t
            y = y0 + (y1 - y0) * t
            if y < 0.25:
                continue
            code = max(1, min(255, int(round(y / DECK_Q))))
            i0 = max(0, int((x - rad - minx) / cell))
            i1 = min(w - 1, int((x + rad - minx) / cell))
            j0 = max(0, int((z - rad - minz) / cell))
            j1 = min(h - 1, int((z + rad - minz) / cell))
            for j in range(j0, j1 + 1):
                cz = minz + (j + 0.5) * cell
                for i in range(i0, i1 + 1):
                    cx = minx + (i + 0.5) * cell
                    if (cx - x) ** 2 + (cz - z) ** 2 <= rad * rad:
                        deck[j * w + i] = code


def member_lines(rel, enu):
    outers, inners = [], []
    for m in rel.get('members') or []:
        g = m.get('geometry') or []
        if len(g) < 2:
            continue
        pts = []
        for p in g:
            x, z = enu(p['lat'], p['lon'])
            pts.append((x, z))
        pts = simplify(pts, 1.5)
        if m.get('role') == 'inner':
            inners.append(pts)
        else:
            outers.append(pts)
    return outers, inners


def pack_b64(buf):
    return base64.b64encode(bytes(buf)).decode('ascii')


def main():
    city = json.load(open(CITY))
    water = json.load(open(WATER))
    ts = city['osm3s']['timestamp_osm_base']
    els = city['elements']
    by_id = {e['id']: e for e in els}

    hall = by_id[10836280]
    hlat = sum(p['lat'] for p in hall['geometry']) / len(hall['geometry'])
    hlon = sum(p['lon'] for p in hall['geometry']) / len(hall['geometry'])
    enu = make_enu(hlat, hlon)

    corners = []
    for lat, lon in (
        (BBOX['south'], BBOX['west']), (BBOX['south'], BBOX['east']),
        (BBOX['north'], BBOX['west']), (BBOX['north'], BBOX['east']),
    ):
        corners.append(enu(lat, lon))
    minx = min(p[0] for p in corners) - 8
    maxx = max(p[0] for p in corners) + 8
    minz = min(p[1] for p in corners) - 8
    maxz = max(p[1] for p in corners) + 8
    w = int(math.ceil((maxx - minx) / CELL))
    h = int(math.ceil((maxz - minz) / CELL))
    print(f'grid {w}x{h} origin {hlat:.8f},{hlon:.8f}')

    # ---- water + parks from relations ----
    water_feats = []
    park_feats = []
    for rel in water['elements']:
        name = (rel.get('tags') or {}).get('name') or ''
        outers, inners = member_lines(rel, enu)
        if (rel.get('tags') or {}).get('natural') == 'water' or name == 'Brisbane River':
            rings = stitch(outers, 3)
            holes = []
            for inner in inners:
                inner = close_ring(simplify(inner, 1.5))
                c = clip_rect(inner, minx, minz, maxx, maxz)
                if area(c) > 40:
                    holes.append(c)
            print(f'  river {rel["id"]} outers {len(outers)} rings {len(rings)} holes {len(holes)} leftover-open ignored')
            for ring in rings:
                clipped = clip_rect(ring, minx, minz, maxx, maxz)
                if area(clipped) < 200:
                    continue
                water_feats.append({
                    'name': name, 'osm': rel['id'],
                    'outer': simplify(clipped, 2.0),
                    'holes': [simplify(hh, 2.0) for hh in holes if point_in(clipped, *centroid(hh))],
                })
        elif name == 'South Bank Parklands':
            rings = stitch(outers, 3)
            print(f'  south bank rings {len(rings)} from {len(outers)} ways')
            for ring in rings:
                clipped = clip_rect(ring, minx, minz, maxx, maxz)
                if area(clipped) > 500:
                    park_feats.append({'name': name, 'osm': rel['id'], 'ring': simplify(clipped, 1.5), 'rel': True})

    # ponds and mapped parks from the way extract
    for e in els:
        t = e.get('tags') or {}
        if t.get('natural') == 'water':
            pts = close_ring(simplify(ring_of(e, enu), 1.2))
            if closed(pts) and area(pts) > 40:
                water_feats.append({'name': t.get('name') or 'pond', 'osm': e['id'], 'outer': pts, 'holes': []})
        if t.get('leisure') == 'park' or t.get('landuse') in ('grass', 'recreation_ground', 'village_green'):
            pts = close_ring(simplify(ring_of(e, enu), 1.2))
            if closed(pts) and area(pts) > 80:
                park_feats.append({'name': t.get('name') or '', 'osm': e['id'], 'ring': pts, 'rel': False})

    ground = bytearray(w * h)  # 0 land, 1 water
    deck = bytearray(w * h)
    for feat in water_feats:
        fill_poly(ground, feat['outer'], 1, minx, minz, w, h, CELL)
        for hole in feat['holes']:
            fill_poly(ground, hole, 0, minx, minz, w, h, CELL)
    water_cells = sum(1 for v in ground if v == 1)
    print('water cells', water_cells, 'of', w * h)

    # ---- buildings ----
    raw_buildings = []
    for e in els:
        t = e.get('tags') or {}
        if 'building' not in t and 'building:part' not in t:
            continue
        pts = simplify(ring_of(e, enu), 0.8)
        if not closed(pts, 2.0):
            continue
        pts = close_ring(pts)
        ar = area(pts)
        if ar < 12 or ar > 80000:
            continue
        cx, cz = centroid(pts)
        if cx < minx or cx > maxx or cz < minz or cz > maxz:
            continue
        kind = t.get('building:part') and 'part' or 'outline'
        if 'building:part' in t:
            kind = 'part'
        raw_buildings.append({'el': e, 'pts': pts, 'area': ar, 'c': (cx, cz), 'kind': kind, 'bb': bbox_of(pts)})

    parts = [b for b in raw_buildings if b['kind'] == 'part']
    outlines = [b for b in raw_buildings if b['kind'] != 'part']
    drop = set()
    for o in outlines:
        minx_b, maxx_b, minz_b, maxz_b = o['bb']
        for p in parts:
            if p['c'][0] < minx_b or p['c'][0] > maxx_b or p['c'][1] < minz_b or p['c'][1] > maxz_b:
                continue
            if point_in(o['pts'], *p['c']):
                drop.add(id(o))
                break
    kept_b = [b for b in raw_buildings if not (b['kind'] != 'part' and id(b) in drop)]
    print('buildings', len(raw_buildings), 'kept', len(kept_b), 'outlines dropped for parts', len(drop))

    height_src = {'tag': 0, 'levels': 0, 'default': 0}
    buildings = []
    for b in kept_b:
        t = b['el'].get('tags') or {}
        ht = parse_m(t.get('height'))
        base = parse_m(t.get('min_height')) or 0
        if ht is not None and ht > 0:
            src = 2
            height_src['tag'] += 1
        else:
            lv = parse_m(t.get('building:levels'))
            if lv and lv > 0:
                ht = lv * LEVEL_M
                src = 1
                height_src['levels'] += 1
            else:
                kind = t.get('building') or ''
                ht = 6 if kind in HOUSE else (16 if kind in ('apartments', 'residential') else 9)
                src = 0
                height_src['default'] += 1
        ht = max(3.0, min(320.0, ht))
        if base < 0:
            base = 0
        if base > ht:
            ht = base + 3
        kind = t.get('building') or t.get('building:part') or 'yes'
        buildings.append({
            'h': round(ht - base, 2), 'b': round(base, 2), 's': src,
            'c': COLOR.get(kind, 0xc6bfb2), 'r': flat(b['pts']),
        })

    # ---- roads ----
    width_tagged = 0
    roads = []
    bridge_polys = []
    drive_for_chase = []
    for e in els:
        t = e.get('tags') or {}
        hw = t.get('highway')
        pts = simplify(ring_of(e, enu), 1.1)
        if t.get('man_made') == 'bridge' and closed(pts, 2.5) and area(close_ring(pts)) > 40:
            deck_y = layer_deck(t) or 1.6
            bridge_polys.append({
                'name': t.get('name') or '', 'osm': e['id'], 'y': deck_y,
                'ring': flat(close_ring(pts)),
            })
            fill_poly(deck, close_ring(pts), max(1, min(255, int(round(deck_y / DECK_Q)))), minx, minz, w, h, CELL)
        if hw not in CLASS:
            continue
        if t.get('tunnel') == 'yes' or t.get('location') == 'underground':
            continue
        if len(pts) < 2 or length(pts) < 4:
            continue
        # skip ways whose midpoint is well outside the district
        mx, mz = pts[len(pts) // 2]
        if mx < minx - 20 or mx > maxx + 20 or mz < minz - 20 or mz > maxz + 20:
            continue
        wt = 0
        width = parse_m(t.get('width'))
        if width and 0.6 <= width <= 40:
            wt = 1
            width_tagged += 1
        else:
            width = WIDTH[hw]
        deck_y = layer_deck(t)
        prof = profile(pts, deck_y)
        if deck_y > 0:
            stamp_ribbon(deck, prof, width, minx, minz, w, h, CELL)
        rec = {'k': CLASS[hw], 'w': round(width, 2), 'wt': wt}
        if deck_y > 0:
            rec['py'] = 1
            rec['p'] = []
            for x, z, y in prof:
                rec['p'].extend((rnd(x), rnd(z), round(y, 2)))
        else:
            rec['p'] = []
            last = None
            for x, z in pts:
                p = (rnd(x), rnd(z))
                if p != last:
                    rec['p'].extend(p)
                    last = p
        if len(rec['p']) >= 4:
            roads.append(rec)
            if CLASS[hw] in (0, 1, 2) and deck_y == 0 and t.get('name'):
                drive_for_chase.append((t.get('name'), pts, length(pts), hw))

    print('roads', len(roads), 'width-tagged', width_tagged, 'bridge polys', len(bridge_polys))

    # mall centreline: longest pedestrian way named Queen Street
    mall_el = None
    mall_len = -1
    for e in els:
        t = e.get('tags') or {}
        if t.get('name') == 'Queen Street' and t.get('highway') == 'pedestrian':
            pts = ring_of(e, enu)
            L = length(pts)
            if L > mall_len:
                mall_len = L
                mall_el = e
    mall_pts = simplify(ring_of(mall_el, enu), 1.0)
    mall_mid, mall_head = midpoint(mall_pts)
    print('mall', mall_el['id'], 'len', round(mall_len, 1), 'mid', tuple(round(v, 1) for v in mall_mid))

    # chase: greedy walk from the mall onto named streets, else mall out-and-back
    def chase_path():
        segs = []
        for name, pts, L, hw in drive_for_chase:
            if L < 25:
                continue
            if name in ('Queen Street', 'George Street', 'Adelaide Street', 'William Street', 'Elizabeth Street', 'Edward Street', 'Albert Street', 'North Quay', 'Grey Street'):
                segs.append([tuple(p) for p in pts])
        if not segs:
            return mall_pts + list(reversed(mall_pts[:-1]))
        used = set()
        # start with the mall
        path = [tuple(p) for p in mall_pts]
        used_idx = set()
        for _ in range(28):
            end = path[-1]
            best = None
            best_d = 22
            for i, seg in enumerate(segs):
                if i in used_idx:
                    continue
                for flip, d in ((False, math.hypot(seg[0][0] - end[0], seg[0][1] - end[1])),
                                (True, math.hypot(seg[-1][0] - end[0], seg[-1][1] - end[1]))):
                    if d < best_d:
                        best_d = d
                        best = (i, flip)
            if not best:
                break
            i, flip = best
            used_idx.add(i)
            seg = list(reversed(segs[i])) if flip else segs[i]
            path.extend(seg[1:])
        if length(path) < 350:
            return mall_pts + list(reversed(mall_pts[:-1]))
        return path

    chase = chase_path()
    print('chase length', round(length(chase), 1))

    # traffic: longest non-bridge primary near the origin
    traffic = []
    best_t = 0
    for e in els:
        t = e.get('tags') or {}
        if t.get('highway') not in ('primary', 'secondary', 'tertiary'):
            continue
        if t.get('bridge') or t.get('tunnel') == 'yes':
            continue
        pts = simplify(ring_of(e, enu), 2)
        L = length(pts)
        if L > best_t and pts and abs(pts[0][0]) < 900 and abs(pts[0][1]) < 900:
            best_t = L
            traffic = pts
    print('traffic len', round(best_t, 1))

    def inv_ll(x, z):
        # Inverse of the linear tangent plane, so lat/lon names the same point as x/z.
        north = -z
        return (
            hlat + (north / M0) * 180 / math.pi,
            hlon + (x / (N0 * math.cos(math.radians(hlat)))) * 180 / math.pi,
        )

    N0, M0 = radii(hlat)
    arc = M0 * math.radians(0.01)
    vind = vincenty(hlat, hlon, hlat + 0.01, hlon)
    print(f'meridian 0.01° M*dφ {arc:.3f} m  vincenty {vind:.3f} m  delta {arc - vind:+.4f}')

    def landmark_from_way(eid, name, stand='centroid'):
        e = by_id[eid]
        pts = close_ring(ring_of(e, enu)) if closed(simplify(ring_of(e, enu), 0.5), 3) else ring_of(e, enu)
        c = centroid(pts)
        lat, lon = inv_ll(*c)
        sx, sz = c
        if stand == 'towardOrigin' and len(pts) >= 3:
            # Just outside the footprint: City Hall's south face, other buildings toward City Hall.
            target = (c[0], c[1] + 40) if eid == 10836280 else (0.0, 0.0)
            bx, bz = closest_boundary(pts, *target)
            dx, dz = bx - c[0], bz - c[1]
            d = math.hypot(dx, dz) or 1
            sx, sz = bx + dx / d * 3.5, bz + dz / d * 3.5
        y = 0.4
        if stand == 'deck':
            y = (layer_deck(e.get('tags') or {}) or 1.6) + 0.8
            sx, sz = c
        return {
            'name': name, 'osm': eid, 'lat': lat, 'lon': lon,
            'x': round(sx, 3), 'z': round(sz, 3), 'y': round(y, 2),
            'cx': round(c[0], 3), 'cz': round(c[1], 3),
        }

    def landmark_from_ring(name, osm, ring, latlon_hint=None):
        c = centroid(ring)
        lat, lon = inv_ll(*c)
        return {
            'name': name, 'osm': osm, 'lat': lat, 'lon': lon,
            'x': round(c[0], 3), 'z': round(c[1], 3), 'y': 0.4,
            'cx': round(c[0], 3), 'cz': round(c[1], 3),
        }

    landmarks = {
        'cityHall': landmark_from_way(10836280, 'Brisbane City Hall', 'towardOrigin'),
        'parliament': landmark_from_way(8040447, 'Parliament House', 'towardOrigin'),
        'victoriaBridge': landmark_from_way(483669189, 'Victoria Bridge', 'deck'),
        'storyBridge': landmark_from_way(502370129, 'Story Bridge', 'deck'),
        'goodwill': landmark_from_way(483377636, 'Goodwill Bridge', 'deck'),
        'botanic': landmark_from_way(4282955, 'Brisbane City Botanic Gardens', 'centroid'),
    }
    sb = next((p for p in park_feats if p['osm'] == 532905), None)
    if sb:
        landmarks['southBank'] = landmark_from_ring('South Bank Parklands', 532905, sb['ring'])
    qlat, qlon = inv_ll(*mall_mid)
    landmarks['queenMall'] = {
        'name': 'Queen Street Mall',
        'osm': mall_el['id'],
        'lat': qlat,
        'lon': qlon,
        'x': round(mall_mid[0], 3), 'z': round(mall_mid[1], 3), 'y': 0.4,
        'cx': round(mall_mid[0], 3), 'cz': round(mall_mid[1], 3),
        'heading': round(mall_head, 4),
        'note': 'Longest highway=pedestrian way named Queen Street. The way literally named Queen Street Mall (544524541) is a 15 m fragment, so the centreline used is this pedestrian way.',
    }
    # named way centroid kept for the note, not the spawn
    landmarks['queenMallNamePoint'] = landmark_from_way(544524541, 'Queen Street Mall (named fragment)', 'centroid')

    wheel = next((e for e in els if (e.get('tags') or {}).get('name') == 'The Wheel of Brisbane Ticket Office'), None)
    if wheel:
        landmarks['wheelOffice'] = landmark_from_way(wheel['id'], 'The Wheel of Brisbane Ticket Office', 'centroid')
    # West End and Kangaroo Point anchors from this extract. Ids are the ways
    # the Overpass bbox actually returned, not remembered coordinates.
    if 24315115 in by_id:
        landmarks['daviesPark'] = landmark_from_way(24315115, 'Davies Park', 'centroid')
    if 10305671 in by_id:
        landmarks['raymondPark'] = landmark_from_way(10305671, 'Raymond Park', 'centroid')
    if 1358506442 in by_id:
        landmarks['kangarooBridge'] = landmark_from_way(1358506442, 'Kangaroo Point Bridge', 'deck')

    pairs = [
        ('cityHall', 'parliament'), ('cityHall', 'queenMall'), ('cityHall', 'storyBridge'),
        ('cityHall', 'victoriaBridge'), ('cityHall', 'botanic'), ('parliament', 'victoriaBridge'),
        ('victoriaBridge', 'storyBridge'), ('queenMall', 'parliament'), ('storyBridge', 'goodwill'),
    ]
    if 'southBank' in landmarks:
        pairs += [('cityHall', 'southBank'), ('victoriaBridge', 'southBank'), ('parliament', 'southBank')]
    if 'daviesPark' in landmarks:
        pairs += [('cityHall', 'daviesPark'), ('southBank', 'daviesPark')]
    if 'kangarooBridge' in landmarks:
        pairs += [('cityHall', 'kangarooBridge'), ('storyBridge', 'kangarooBridge')]
    if 'raymondPark' in landmarks:
        pairs += [('cityHall', 'raymondPark')]
        if 'kangarooBridge' in landmarks:
            pairs += [('kangarooBridge', 'raymondPark')]
    checks = []
    for a, b in pairs:
        A, B = landmarks[a], landmarks[b]
        # Distance between geographic centres (cx/cz), not the outside stand points.
        enu_d = math.hypot(A['cx'] - B['cx'], A['cz'] - B['cz'])
        vin = vincenty(A['lat'], A['lon'], B['lat'], B['lon'])
        hav = haversine(A['lat'], A['lon'], B['lat'], B['lon'])
        checks.append({
            'a': a, 'b': b,
            'enu': round(enu_d, 2),
            'vincenty': round(vin, 2),
            'haversine': round(hav, 2),
            'dVincenty': round(enu_d - vin, 3),
            'dHaversine': round(enu_d - hav, 3),
        })
        print(f'  {a:16} {b:16} enu {enu_d:8.2f}  vin {vin:8.2f}  d {enu_d-vin:+.3f}  hav-d {enu_d-hav:+.2f}')

    mall_flat = []
    for x, z in mall_pts:
        mall_flat.extend((rnd(x), rnd(z)))
    chase_flat = []
    last = None
    for x, z in chase:
        p = (rnd(x), rnd(z))
        if p != last:
            chase_flat.extend(p)
            last = p
    traffic_flat = []
    last = None
    for x, z in traffic:
        p = (rnd(x), rnd(z))
        if p != last:
            traffic_flat.extend(p)
            last = p

    def pack_rings(feat):
        return {
            'name': feat['name'], 'osm': feat['osm'],
            'outer': flat(feat['outer']),
            'holes': [flat(hh) for hh in feat['holes']],
        }

    data = {
        'meta': {
            'source': 'OpenStreetMap',
            'url': 'https://www.openstreetmap.org',
            'overpass': 'https://overpass-api.de/api/interpreter',
            'licence': 'Open Database Licence 1.0 (ODbL)',
            'licenceUrl': 'https://opendatacommons.org/licenses/odbl/',
            'attribution': '© OpenStreetMap contributors',
            'timestamp': ts,
            'waterTimestamp': water['osm3s']['timestamp_osm_base'],
            'accessed': '2026-10-23',
            'bbox': BBOX,
            'projection': 'WGS84 local east-north-up tangent plane at the City Hall vertex centroid. x=east metres, y=up, z=-north metres. Prime vertical N and meridian radius M are evaluated at the origin. This is not a constant degrees-to-metres scale.',
            'verticalDatum': 'Local street datum y=0. Not Australian Height Datum. No LiDAR digital terrain model is loaded. Bridge deck heights are an ordering convention from the OSM layer tag (1.6 m + 2.8 m per layer above 1), not a measured clearance.',
            'levelMetres': LEVEL_M,
            'cell': CELL,
            'deckStep': DECK_Q,
            'waterY': WATER_Y,
            'counts': {
                'osmElements': len(els),
                'buildings': len(buildings),
                'buildingsHeightTag': height_src['tag'],
                'buildingsLevelsEstimated': height_src['levels'],
                'buildingsDefaultEstimated': height_src['default'],
                'outlinesDroppedBecauseParts': len(drop),
                'roads': len(roads),
                'roadsWidthTagged': width_tagged,
                'roadsWidthEstimated': len(roads) - width_tagged,
                'bridgePolygons': len(bridge_polys),
                'waterPolygons': len(water_feats),
                'waterCells': water_cells,
                'parks': len(park_feats),
            },
            'limitations': [
                'Horizontal geometry is OpenStreetMap, not a Queensland survey control network.',
                'Building height is the OSM height tag when present. building:levels uses 3.2 m per level (estimated). Missing both uses 6 m for houses/garages, 16 m for apartments, 9 m otherwise (estimated).',
                'OSM layer is not a height. Bridge decks use 1.6 m + 2.8 m per layer so stacked bridges separate. Published navigational clearances were not applied.',
                'Road width uses the OSM width tag when it parses as metres. Otherwise a class default is used and marked estimated.',
                'The walkable surface is a 4 m grid. Rendered river and park outlines use the clipped OSM rings. Bank and grid can differ by up to one cell.',
                'Tunnels and underground ways are omitted. Building collision uses the footprint ring, not an interior.',
                'No Overture Maps, Queensland LiDAR, or Brisbane City Council footprint extract is in this file.',
                'Queen Street Mall spawn follows pedestrian way ' + str(mall_el['id']) + ', not the 15 m way named Queen Street Mall.',
                'The west edge is longitude 153.000. Davies Park sits inside it. Orleigh Park and part of West End Riverside Lands Park cross that edge, so the riverbank west of it is not in this compile.',
                'Kangaroo Point Cliffs are not a separate mesh. This extract has Kangaroo Point Cliffs Drive as a service road and no natural=cliff polygon. Raymond Park and the Kangaroo Point Bridge are the peninsula anchors.',
            ],
        },
        'origin': {'lat': hlat, 'lon': hlon, 'osm': 10836280, 'name': 'Brisbane City Hall'},
        'landmarks': landmarks,
        'checks': checks,
        'grid': {
            'minX': round(minx, 3), 'minZ': round(minz, 3), 'cell': CELL,
            'w': w, 'h': h, 'waterY': WATER_Y, 'step': DECK_Q,
            'ground': pack_b64(ground), 'deck': pack_b64(deck),
        },
        'water': [pack_rings(f) for f in water_feats if area(f['outer']) > 80],
        'parks': [{'name': p['name'], 'osm': p['osm'], 'ring': flat(p['ring'])} for p in park_feats],
        'bridges': bridge_polys,
        'roads': roads,
        'buildings': buildings,
        'mall': mall_flat,
        'chase': chase_flat,
        'traffic': traffic_flat,
    }

    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_MD), exist_ok=True)
    payload = json.dumps(data, separators=(',', ':'))
    with open(OUT_JS, 'w') as f:
        f.write('// Generated by tools/compile_brisbane_geo.py. Do not hand-edit.\n')
        f.write('// Map data © OpenStreetMap contributors, licensed under ODbL 1.0.\n')
        f.write('export const BRISBANE_GEO = ')
        f.write(payload)
        f.write(';\n')
    print('wrote', OUT_JS, 'bytes', os.path.getsize(OUT_JS))

    lines = []
    lines.append('# Brisbane geographic provenance')
    lines.append('')
    lines.append('This district is compiled OpenStreetMap geometry in a local metre grid. It is not a survey plan and it is not a claim of complete 1:1 city detail.')
    lines.append('')
    lines.append('## Source')
    lines.append('')
    lines.append('- Dataset: OpenStreetMap')
    lines.append('- Source URL: https://www.openstreetmap.org')
    lines.append('- Extract API: https://overpass-api.de/api/interpreter')
    lines.append('- Licence: Open Database Licence 1.0 (ODbL) — https://opendatacommons.org/licenses/odbl/')
    lines.append('- Attribution: © OpenStreetMap contributors')
    lines.append(f'- City extract `timestamp_osm_base`: {ts}')
    lines.append(f'- River and South Bank extract `timestamp_osm_base`: {water["osm3s"]["timestamp_osm_base"]}')
    lines.append('- Accessed: 2026-10-23')
    lines.append(f'- Coverage bbox (south, west, north, east): {BBOX["south"]}, {BBOX["west"]}, {BBOX["north"]}, {BBOX["east"]}')
    lines.append('- Districts inside that bbox include the CBD, Queen Street, City Hall, Parliament House, the City Botanic Gardens, South Bank Parklands, South Brisbane, West End through Davies Park, and Kangaroo Point through Raymond Park and the Kangaroo Point Bridge, plus the Story, Victoria, Goodwill, Kurilpa, William Jolly and Kangaroo Point bridges where those ways fall in the bbox. Orleigh Park continues west of longitude 153.000 and is only partly inside.')
    lines.append('')
    lines.append('## Projection')
    lines.append('')
    lines.append(f'- Origin: vertex centroid of OSM way 10836280 Brisbane City Hall, latitude {hlat:.8f}, longitude {hlon:.8f}.')
    lines.append('- Axes: x = east metres, y = up, z = −north metres, from a WGS84 tangent plane. Meridian radius M and prime vertical N are computed at that origin.')
    lines.append('- Vertical: local street datum y = 0. This is not Australian Height Datum. No digital terrain model is loaded.')
    lines.append('')
    lines.append('## Counts from this compile')
    lines.append('')
    for k, v in data['meta']['counts'].items():
        lines.append(f'- {k}: {v}')
    lines.append('')
    lines.append('## Landmark centres')
    lines.append('')
    lines.append('Centres are derived from the imported OSM geometry. `x` and `z` are metres from City Hall. Distances below use those centres.')
    lines.append('')
    lines.append('| Landmark | OSM id | latitude | longitude | x | z |')
    lines.append('| --- | --- | --- | --- | --- | --- |')
    for key, L in landmarks.items():
        lines.append(f'| {L["name"]} | {L["osm"]} | {L["lat"]:.6f} | {L["lon"]:.6f} | {L["cx"]:.2f} | {L["cz"]:.2f} |')
    lines.append('')
    lines.append('## Distance check')
    lines.append('')
    lines.append('`enu` is the straight-line distance in the game grid between footprint centres. `vincenty` is the WGS84 inverse geodesic between the same latitudes and longitudes. `haversine` uses a sphere of radius 6371008.8 m, which ignores ellipsoid flattening and is listed so that difference is not mistaken for a map error.')
    lines.append('')
    lines.append('| From | To | ENU m | Vincenty m | ENU − Vincenty | ENU − haversine |')
    lines.append('| --- | --- | --- | --- | --- | --- |')
    for c in checks:
        lines.append(f'| {c["a"]} | {c["b"]} | {c["enu"]:.2f} | {c["vincenty"]:.2f} | {c["dVincenty"]:+.3f} | {c["dHaversine"]:+.2f} |')
    lines.append('')
    lines.append('## What is tagged, and what is estimated')
    lines.append('')
    lines.append(f'- Building height from an OSM `height` tag: {height_src["tag"]}.')
    lines.append(f'- Building height estimated as `building:levels` × {LEVEL_M} m: {height_src["levels"]}.')
    lines.append(f'- Building height estimated because neither tag exists: {height_src["default"]}.')
    lines.append(f'- Road width from an OSM `width` tag: {width_tagged}.')
    lines.append(f'- Road width from a highway-class default: {len(roads) - width_tagged}.')
    lines.append('- Bridge vertical position: estimated from the OSM `layer` tag, as stated above. Story Bridge way 502370129 is `man_made=bridge`, `bridge:structure=suspension`, `layer=2`. Way 507264554 carries `start_date=1940-07-06` and `bridge=cantilever`. Neither way in this extract has a `height` tag.')
    lines.append('- Queen Street Mall: way 544524541 is the feature named Queen Street Mall and is about 15 m long. The walkable mall centreline is the longest `highway=pedestrian` way named Queen Street.')
    lines.append('')
    lines.append('## Not imported')
    lines.append('')
    lines.append('- Overture Maps GeoParquet was not downloaded. Buildings in this district are OpenStreetMap only, so there is no second copy to dedupe.')
    lines.append('- Queensland Spatial Catalogue, Queensland Globe and Brisbane City Council extracts were not downloaded. No LiDAR, no official building-footprint layer, no digital terrain model.')
    lines.append('- Hong Kong Lands Department 3D Tiles and NSW Spatial Services are not part of this Brisbane compile.')
    lines.append('')
    lines.append('## Known gaps')
    lines.append('')
    for item in data['meta']['limitations']:
        lines.append(f'- {item}')
    lines.append('- Fictional gameplay (McRebar, Seb Daly, the lawsuit plaque, Sir Girderface, portals, the decorative Wheel prop) is placed on this grid and is not an OSM object. The Wheel prop sits at the OSM ticket-office footprint, not an imported wheel model.')
    lines.append('')
    with open(OUT_MD, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('wrote', OUT_MD)


if __name__ == '__main__':
    main()
