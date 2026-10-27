#!/usr/bin/env python3
"""Compile an Overpass extract into a metric district module.

The tangent-plane math is the same as tools/compile_brisbane_geo.py and
src/world/geo/project.js. Run from the repo root:

  python3 tools/compile_district.py hk
  python3 tools/compile_district.py syd
"""
import base64
import collections
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compile_brisbane_geo as geo

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CELL = geo.CELL
DECK_Q = geo.DECK_Q
WATER_Y = geo.WATER_Y
LEVEL_M = geo.LEVEL_M

AERO_WIDTH = {'runway': 45.0, 'taxiway': 18.0}
AERO_CLASS = {'runway': 6, 'taxiway': 7}


def stitch_open(lines, tol):
    lines = [list(l) for l in lines if len(l) >= 2]
    chains = []
    while lines:
        chain = lines.pop(0)
        changed = True
        hops = 0
        while changed and hops < 800 and not geo.near(chain[0], chain[-1], tol):
            hops += 1
            changed = False
            for i, line in enumerate(lines):
                if geo.near(chain[-1], line[0], tol):
                    chain.extend(line[1:])
                    lines.pop(i)
                    changed = True
                    break
                if geo.near(chain[-1], line[-1], tol):
                    chain.extend(list(reversed(line[:-1])))
                    lines.pop(i)
                    changed = True
                    break
                if geo.near(chain[0], line[-1], tol):
                    chain = line[:-1] + chain
                    lines.pop(i)
                    changed = True
                    break
                if geo.near(chain[0], line[0], tol):
                    chain = list(reversed(line[1:])) + chain
                    lines.pop(i)
                    changed = True
                    break
        chains.append(chain)
    return chains


def way_by_id(els, eid):
    for e in els:
        if e.get('id') == eid and e.get('geometry'):
            return e
    raise SystemExit(f'missing way {eid}')


def inv_ll(lat0, lon0, x, z):
    N, M = geo.radii(lat0)
    north = -z
    return (
        lat0 + (north / M) * 180 / math.pi,
        lon0 + (x / (N * math.cos(math.radians(lat0)))) * 180 / math.pi,
    )


def landmark_from_element(el, enu, lat0, lon0, name, stand_target=None, deck=False):
    pts = geo.simplify(geo.ring_of(el, enu), 0.6)
    closed = geo.closed(pts, 3)
    if closed:
        pts = geo.close_ring(pts)
    c = geo.centroid(pts)
    lat, lon = inv_ll(lat0, lon0, *c)
    sx, sz = c
    y = 0.4
    if deck:
        y = (geo.layer_deck(el.get('tags') or {}) or 1.6) + 0.8
    elif stand_target and closed and len(pts) >= 4:
        bx, bz = geo.closest_boundary(pts, *stand_target)
        dx, dz = bx - c[0], bz - c[1]
        d = math.hypot(dx, dz) or 1
        sx, sz = bx + dx / d * 16.0, bz + dz / d * 16.0
    tags = el.get('tags') or {}
    ht = geo.parse_m(tags.get('height'))
    lv = geo.parse_m(tags.get('building:levels'))
    if ht and ht > 0:
        hsrc = 'tag'
        height = ht
    elif lv and lv > 0:
        hsrc = 'levels'
        height = lv * LEVEL_M
    else:
        hsrc = 'missing'
        height = None
    return {
        'name': name,
        'osm': el['id'],
        'lat': lat,
        'lon': lon,
        'x': round(sx, 3),
        'z': round(sz, 3),
        'y': round(y, 2),
        'cx': round(c[0], 3),
        'cz': round(c[1], 3),
        'height': None if height is None else round(height, 2),
        'heightSource': hsrc,
    }


def paint(mask, x, z, val, minx, minz, w, h, cell):
    i = int((x - minx) / cell)
    j = int((z - minz) / cell)
    if i < 0 or j < 0 or i >= w or j >= h:
        return
    idx = j * w + i
    cur = mask[idx]
    if cur == 255 or cur == val:
        mask[idx] = val


def coast_grid(chains, buildings, minx, minz, w, h):
    """Land/water from OSM coastline orientation, checked against building footprints.

    OSM says land is on the left of a coastline. This measures which side of the
    imported lines the buildings actually sit on, and flood-fills from those seeds.
    """
    segs = []
    for chain in chains:
        for i in range(1, len(chain)):
            x0, z0 = chain[i - 1]
            x1, z1 = chain[i]
            if math.hypot(x1 - x0, z1 - z0) < 0.5:
                continue
            segs.append((x0, z0, x1, z1))
    pos = neg = 0
    for cx, cz in buildings[::3]:
        best = 140 * 140
        side = 0
        for x0, z0, x1, z1 in segs:
            dx, dz = x1 - x0, z1 - z0
            L2 = dx * dx + dz * dz
            t = max(0.0, min(1.0, ((cx - x0) * dx + (cz - z0) * dz) / L2))
            px, pz = x0 + dx * t, z0 + dz * t
            d2 = (cx - px) ** 2 + (cz - pz) ** 2
            if d2 < best:
                best = d2
                side = dx * (cz - z0) - dz * (cx - x0)
        if best < 140 * 140 and side != 0:
            if side > 0:
                pos += 1
            else:
                neg += 1
    land_positive = pos >= neg
    print(f'coastline side vote  cross>0 {pos}  cross<0 {neg}  land_positive {land_positive}')
    mask = bytearray([255]) * (w * h)
    for x0, z0, x1, z1 in segs:
        dx, dz = x1 - x0, z1 - z0
        L = math.hypot(dx, dz) or 1
        # normal on the cross>0 side
        nx, nz = -dz / L, dx / L
        if not land_positive:
            nx, nz = -nx, -nz
        steps = max(1, int(L / 3))
        for s in range(steps + 1):
            t = s / steps
            x = x0 + dx * t
            z = z0 + dz * t
            for dist in (6, 14, 22):
                paint(mask, x + nx * dist, z + nz * dist, 0, minx, minz, w, h, CELL)
                paint(mask, x - nx * dist, z - nz * dist, 1, minx, minz, w, h, CELL)
    q = collections.deque(i for i, v in enumerate(mask) if v != 255)
    while q:
        i = q.popleft()
        val = mask[i]
        x = i % w
        y = i // w
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            j = ny * w + nx
            if mask[j] == 255:
                mask[j] = val
                q.append(j)
    unknown = sum(1 for v in mask if v == 255)
    for i, v in enumerate(mask):
        if v == 255:
            mask[i] = 0
    print('coast fill unknown left as land', unknown)
    return mask


def stamp_disk(mask, x, z, rad, val, minx, minz, w, h):
    i0 = max(0, int((x - rad - minx) / CELL))
    i1 = min(w - 1, int((x + rad - minx) / CELL))
    j0 = max(0, int((z - rad - minz) / CELL))
    j1 = min(h - 1, int((z + rad - minz) / CELL))
    r2 = rad * rad
    for j in range(j0, j1 + 1):
        cz = minz + (j + 0.5) * CELL
        row = j * w
        for i in range(i0, i1 + 1):
            cx = minx + (i + 0.5) * CELL
            if (cx - x) ** 2 + (cz - z) ** 2 <= r2:
                mask[row + i] = val


def stamp_line(mask, pts, rad, val, minx, minz, w, h):
    if len(pts) < 2:
        return
    for i in range(1, len(pts)):
        x0, z0 = pts[i - 1]
        x1, z1 = pts[i]
        seg = math.hypot(x1 - x0, z1 - z0)
        n = max(1, int(seg / 2.5))
        for s in range(n + 1):
            t = s / n
            stamp_disk(mask, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, rad, val, minx, minz, w, h)


def crossing_water(mask, a, b, minx, minz, w, h):
    hits = wet = 0
    for s in range(1, 24):
        t = s / 24
        x = a[0] + (b[0] - a[0]) * t
        z = a[1] + (b[1] - a[1]) * t
        i = int((x - minx) / CELL)
        j = int((z - minz) / CELL)
        if i < 0 or j < 0 or i >= w or j >= h:
            continue
        hits += 1
        if mask[j * w + i] == 1:
            wet += 1
    return wet, hits


def compile_one(cfg):
    city = json.load(open(cfg['infile']))
    ts = city['osm3s']['timestamp_osm_base']
    els = [e for e in city['elements'] if e.get('type') == 'way' or e.get('type') == 'relation']
    by_id = {e['id']: e for e in els}
    origin_el = way_by_id(els, cfg['origin'])
    geom = origin_el['geometry']
    lat0 = sum(p['lat'] for p in geom) / len(geom)
    lon0 = sum(p['lon'] for p in geom) / len(geom)
    enu = geo.make_enu(lat0, lon0)
    bbox = cfg['bbox']
    corners = [enu(lat, lon) for lat, lon in (
        (bbox['south'], bbox['west']), (bbox['south'], bbox['east']),
        (bbox['north'], bbox['west']), (bbox['north'], bbox['east']),
    )]
    minx = min(p[0] for p in corners) - 8
    maxx = max(p[0] for p in corners) + 8
    minz = min(p[1] for p in corners) - 8
    maxz = max(p[1] for p in corners) + 8
    w = int(math.ceil((maxx - minx) / CELL))
    h = int(math.ceil((maxz - minz) / CELL))
    print(f'{cfg["key"]} grid {w}x{h} origin {lat0:.8f},{lon0:.8f}')

    coasts = []
    for e in els:
        t = e.get('tags') or {}
        if t.get('natural') != 'coastline' or e.get('type') != 'way':
            continue
        pts = geo.simplify(geo.ring_of(e, enu), 2.0)
        if len(pts) >= 2:
            coasts.append(pts)
    chains = stitch_open(coasts, 18) if coasts else []
    print('coast chains', len(chains), 'from', len(coasts))

    raw_buildings = []
    for e in els:
        if e.get('type') != 'way':
            continue
        t = e.get('tags') or {}
        if 'building' not in t and 'building:part' not in t and t.get('aeroway') != 'terminal':
            continue
        pts = geo.simplify(geo.ring_of(e, enu), 0.8)
        if not geo.closed(pts, 2.0):
            continue
        pts = geo.close_ring(pts)
        ar = geo.area(pts)
        if ar < 12 or ar > 120000:
            continue
        cx, cz = geo.centroid(pts)
        if cx < minx or cx > maxx or cz < minz or cz > maxz:
            continue
        kind = 'part' if 'building:part' in t else 'outline'
        raw_buildings.append({'el': e, 'pts': pts, 'area': ar, 'c': (cx, cz), 'kind': kind, 'bb': geo.bbox_of(pts)})

    parts = [b for b in raw_buildings if b['kind'] == 'part']
    drop = set()
    for o in raw_buildings:
        if o['kind'] == 'part':
            continue
        minx_b, maxx_b, minz_b, maxz_b = o['bb']
        for p in parts:
            if p['c'][0] < minx_b or p['c'][0] > maxx_b or p['c'][1] < minz_b or p['c'][1] > maxz_b:
                continue
            if geo.point_in(o['pts'], *p['c']):
                drop.add(id(o))
                break
    kept = [b for b in raw_buildings if not (b['kind'] != 'part' and id(b) in drop)]
    print('buildings', len(raw_buildings), 'kept', len(kept))

    if chains:
        ground = coast_grid(chains, [b['c'] for b in kept], minx, minz, w, h)
    else:
        ground = bytearray(w * h)
        print('no coastline; land fill, water only from polygons')

    # Piers, promenades and building pads stay walkable even when the coastline
    # puts them on the water side. Bridges are not stamped, so the harbour stays open.
    for b in kept:
        for i in range(len(b['pts'])):
            stamp_disk(ground, b['pts'][i][0], b['pts'][i][1], 3.5, 0, minx, minz, w, h)
        stamp_line(ground, b['pts'], 3.5, 0, minx, minz, w, h)
    for e in els:
        if e.get('type') != 'way':
            continue
        t = e.get('tags') or {}
        if t.get('man_made') == 'pier' or t.get('man_made') == 'breakwater':
            pts = geo.simplify(geo.ring_of(e, enu), 1.2)
            stamp_line(ground, pts, 8, 0, minx, minz, w, h)

    water_feats = []
    for e in els:
        t = e.get('tags') or {}
        if t.get('natural') != 'water':
            continue
        if t.get('location') == 'rooftop' or t.get('layer') not in (None, '', '0'):
            continue
        if e.get('type') == 'way':
            pts = geo.close_ring(geo.simplify(geo.ring_of(e, enu), 1.2))
            if geo.closed(pts) and geo.area(pts) > 40:
                clipped = geo.clip_rect(pts, minx, minz, maxx, maxz)
                if geo.area(clipped) > 30:
                    water_feats.append({'name': t.get('name') or 'water', 'osm': e['id'], 'outer': clipped, 'holes': []})
        elif e.get('type') == 'relation':
            outers, inners = geo.member_lines(e, enu)
            for ring in geo.stitch(outers, 4):
                clipped = geo.clip_rect(ring, minx, minz, maxx, maxz)
                if geo.area(clipped) > 40:
                    water_feats.append({'name': t.get('name') or 'water', 'osm': e['id'], 'outer': clipped, 'holes': []})
    for feat in water_feats:
        geo.fill_poly(ground, feat['outer'], 1, minx, minz, w, h, CELL)

    park_feats = []
    apron_feats = []
    for e in els:
        if e.get('type') != 'way':
            continue
        t = e.get('tags') or {}
        pts = geo.close_ring(geo.simplify(geo.ring_of(e, enu), 1.4))
        if not geo.closed(pts):
            continue
        ar = geo.area(pts)
        if t.get('leisure') == 'park' or t.get('landuse') in ('grass', 'recreation_ground', 'village_green'):
            if ar > 80:
                park_feats.append({'name': t.get('name') or '', 'osm': e['id'], 'ring': pts})
        if t.get('aeroway') in ('apron', 'parking_position'):
            if ar > 80:
                apron_feats.append({'name': t.get('name') or t.get('ref') or '', 'osm': e['id'], 'ring': pts})
                geo.fill_poly(ground, pts, 0, minx, minz, w, h, CELL)

    deck = bytearray(w * h)
    height_src = {'tag': 0, 'levels': 0, 'default': 0}
    buildings = []
    for b in kept:
        t = b['el'].get('tags') or {}
        ht = geo.parse_m(t.get('height'))
        base = geo.parse_m(t.get('min_height')) or 0
        if ht is not None and ht > 0:
            src = 2
            height_src['tag'] += 1
        else:
            lv = geo.parse_m(t.get('building:levels'))
            if lv and lv > 0:
                ht = lv * LEVEL_M
                src = 1
                height_src['levels'] += 1
            else:
                kind = t.get('building') or ''
                ht = 6 if kind in geo.HOUSE else (16 if kind in ('apartments', 'residential') else 9)
                src = 0
                height_src['default'] += 1
        ht = max(3.0, min(420.0, ht))
        if base < 0:
            base = 0
        if base > ht:
            ht = base + 3
        kind = t.get('building') or t.get('building:part') or 'yes'
        buildings.append({
            'h': round(ht - base, 2), 'b': round(base, 2), 's': src,
            'c': geo.COLOR.get(kind, 0xc6bfb2), 'r': geo.flat(b['pts']),
        })

    width_tagged = 0
    roads = []
    bridge_polys = []
    for e in els:
        if e.get('type') != 'way':
            continue
        t = e.get('tags') or {}
        hw = t.get('highway')
        aero = t.get('aeroway')
        pts = geo.simplify(geo.ring_of(e, enu), 1.1)
        if t.get('man_made') == 'bridge' and geo.closed(pts, 2.5) and geo.area(geo.close_ring(pts)) > 40:
            deck_y = geo.layer_deck(t) or 1.6
            bridge_polys.append({'name': t.get('name') or '', 'osm': e['id'], 'y': deck_y, 'ring': geo.flat(geo.close_ring(pts))})
            geo.fill_poly(deck, geo.close_ring(pts), max(1, min(255, int(round(deck_y / DECK_Q)))), minx, minz, w, h, CELL)
        klass = None
        default_w = None
        if hw in geo.CLASS:
            klass = geo.CLASS[hw]
            default_w = geo.WIDTH[hw]
        elif aero in AERO_CLASS:
            klass = AERO_CLASS[aero]
            default_w = AERO_WIDTH[aero]
        elif t.get('railway') in ('rail', 'light_rail', 'subway') and t.get('tunnel') != 'yes':
            klass = 8
            default_w = 3.2
        if klass is None:
            continue
        if t.get('tunnel') == 'yes' or t.get('location') == 'underground':
            continue
        if len(pts) < 2 or geo.length(pts) < 6:
            continue
        mx, mz = pts[len(pts) // 2]
        if mx < minx - 30 or mx > maxx + 30 or mz < minz - 30 or mz > maxz + 30:
            continue
        wt = 0
        width = geo.parse_m(t.get('width'))
        if width and 0.6 <= width <= 80:
            wt = 1
            width_tagged += 1
        else:
            width = default_w
        deck_y = geo.layer_deck(t) if hw or t.get('man_made') == 'bridge' or t.get('bridge') else 0
        if aero:
            deck_y = 0
        prof = geo.profile(pts, deck_y)
        if deck_y > 0:
            geo.stamp_ribbon(deck, prof, width, minx, minz, w, h, CELL)
        else:
            # Keep the mapped pavement itself on land. Do not stamp bridges.
            stamp_line(ground, pts, max(2.2, width * 0.45), 0, minx, minz, w, h)
        rec = {'k': klass, 'w': round(width, 2), 'wt': wt}
        if deck_y > 0:
            rec['py'] = 1
            rec['p'] = []
            for x, z, y in prof:
                rec['p'].extend((geo.rnd(x), geo.rnd(z), round(y, 2)))
        else:
            rec['p'] = []
            last = None
            for x, z in pts:
                p = (geo.rnd(x), geo.rnd(z))
                if p != last:
                    rec['p'].extend(p)
                    last = p
        if len(rec['p']) >= 4:
            roads.append(rec)
    print('roads', len(roads), 'width-tagged', width_tagged, 'bridges', len(bridge_polys), 'aprons', len(apron_feats))

    def named_ways(pred):
        out = []
        for e in els:
            if e.get('type') != 'way':
                continue
            t = e.get('tags') or {}
            if not pred(t):
                continue
            pts = geo.simplify(geo.ring_of(e, enu), 1.2)
            if geo.length(pts) >= 20:
                out.append(pts)
        return out

    route_lines = named_ways(cfg['route'])
    route_chains = stitch_open(route_lines, 28) if route_lines else []
    route = max(route_chains, key=geo.length) if route_chains else []
    print('route length', round(geo.length(route), 1) if route else 0)

    traffic = []
    best_t = 0
    for e in els:
        if e.get('type') != 'way':
            continue
        t = e.get('tags') or {}
        if t.get('highway') not in ('primary', 'secondary', 'tertiary', 'trunk', 'residential') and t.get('aeroway') != 'taxiway':
            continue
        if t.get('bridge') or t.get('tunnel') == 'yes':
            continue
        pts = geo.simplify(geo.ring_of(e, enu), 2)
        L = geo.length(pts)
        if L > best_t:
            best_t = L
            traffic = pts

    N0, M0 = geo.radii(lat0)
    arc = M0 * math.radians(0.01)
    vind = geo.vincenty(lat0, lon0, lat0 + 0.01, lon0)
    print(f'meridian 0.01° M*dφ {arc:.3f} m  vincenty {vind:.3f} m  delta {arc - vind:+.4f}')

    landmarks = {}
    for key, eid, name, mode in cfg['landmarks']:
        el = by_id.get(eid)
        if not el or not el.get('geometry'):
            print('MISSING landmark', key, eid)
            continue
        target = None
        if mode == 'toward':
            target = cfg['stand_toward'](enu, by_id)
        elif mode == 'out':
            target = (0.0, 0.0)
        landmarks[key] = landmark_from_element(
            el, enu, lat0, lon0, name,
            stand_target=target,
            deck=(mode == 'deck'),
        )
    # Spawn faces from the footprint centre toward the stand point.
    spawn_key = cfg['spawn']
    spawn = landmarks[spawn_key]
    heading = math.atan2(spawn['x'] - spawn['cx'], spawn['z'] - spawn['cz'])
    spawn['heading'] = round(heading, 4)

    pairs = [p for p in cfg['pairs'] if p[0] in landmarks and p[1] in landmarks]
    checks = []
    for a, b in pairs:
        A, B = landmarks[a], landmarks[b]
        enu_d = math.hypot(A['cx'] - B['cx'], A['cz'] - B['cz'])
        vin = geo.vincenty(A['lat'], A['lon'], B['lat'], B['lon'])
        hav = geo.haversine(A['lat'], A['lon'], B['lat'], B['lon'])
        checks.append({
            'a': a, 'b': b,
            'enu': round(enu_d, 2), 'vincenty': round(vin, 2), 'haversine': round(hav, 2),
            'dVincenty': round(enu_d - vin, 3), 'dHaversine': round(enu_d - hav, 3),
        })
        print(f'  {a:16} {b:16} enu {enu_d:8.2f}  vin {vin:8.2f}  d {enu_d - vin:+.3f}')

    if 'twoIfc' in landmarks and 'clockTower' in landmarks:
        wet, hits = crossing_water(
            ground,
            (landmarks['twoIfc']['cx'], landmarks['twoIfc']['cz']),
            (landmarks['clockTower']['cx'], landmarks['clockTower']['cz']),
            minx, minz, w, h,
        )
        print(f'harbour crossing water cells {wet}/{hits}')

    water_cells = sum(1 for v in ground if v == 1)
    print('water cells', water_cells, 'of', w * h)

    def flat_path(pts):
        out = []
        last = None
        for x, z in pts:
            p = (geo.rnd(x), geo.rnd(z))
            if p != last:
                out.extend(p)
                last = p
        return out

    data = {
        'meta': {
            'source': 'OpenStreetMap',
            'url': 'https://www.openstreetmap.org',
            'overpass': 'https://overpass-api.de/api/interpreter',
            'licence': 'Open Database Licence 1.0 (ODbL)',
            'licenceUrl': 'https://opendatacommons.org/licenses/odbl/',
            'attribution': '© OpenStreetMap contributors',
            'timestamp': ts,
            'accessed': cfg['accessed'],
            'bbox': bbox,
            'region': cfg['region'],
            'projection': 'WGS84 local east-north-up tangent plane. x=east metres, y=up, z=-north metres. Prime vertical N and meridian radius M are evaluated at the origin.',
            'verticalDatum': cfg['vertical'],
            'levelMetres': LEVEL_M,
            'cell': CELL,
            'deckStep': DECK_Q,
            'waterY': WATER_Y,
            'waterFromGrid': True,
            'counts': {
                'osmElements': len(city['elements']),
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
                'aprons': len(apron_feats),
                'coastChains': len(chains),
            },
            'limitations': cfg['limitations'],
        },
        'origin': {'lat': lat0, 'lon': lon0, 'osm': cfg['origin'], 'name': cfg['origin_name']},
        'landmarks': landmarks,
        'checks': checks,
        'grid': {
            'minX': round(minx, 3), 'minZ': round(minz, 3), 'cell': CELL,
            'w': w, 'h': h, 'waterY': WATER_Y, 'step': DECK_Q,
            'ground': geo.pack_b64(ground), 'deck': geo.pack_b64(deck),
        },
        'water': [{'name': f['name'], 'osm': f['osm'], 'outer': geo.flat(f['outer']), 'holes': []} for f in water_feats if geo.area(f['outer']) > 80],
        'parks': [{'name': p['name'], 'osm': p['osm'], 'ring': geo.flat(p['ring'])} for p in park_feats],
        'aprons': [{'name': p['name'], 'osm': p['osm'], 'ring': geo.flat(p['ring'])} for p in apron_feats],
        'bridges': bridge_polys,
        'roads': roads,
        'buildings': buildings,
        'route': flat_path(route),
        'traffic': flat_path(traffic),
    }
    out_js = os.path.join(ROOT, cfg['out_js'])
    out_md = os.path.join(ROOT, cfg['out_md'])
    os.makedirs(os.path.dirname(out_js), exist_ok=True)
    os.makedirs(os.path.dirname(out_md), exist_ok=True)
    payload = json.dumps(data, separators=(',', ':'))
    with open(out_js, 'w') as f:
        f.write(f'// Generated by tools/compile_district.py. Do not hand-edit.\n')
        f.write('// Map data © OpenStreetMap contributors, licensed under ODbL 1.0.\n')
        f.write(f'export const {cfg["export"]} = ')
        f.write(payload)
        f.write(';\n')
    print('wrote', out_js, 'bytes', os.path.getsize(out_js))
    write_md(out_md, cfg, data, landmarks, checks, height_src, width_tagged, len(roads))
    print('wrote', out_md)


def write_md(path, cfg, data, landmarks, checks, height_src, width_tagged, nroads):
    lines = [
        f'# {cfg["title"]} geographic provenance',
        '',
        'This district is compiled OpenStreetMap geometry in a local metre grid. It is not a survey plan.',
        '',
        '## Source',
        '',
        '- Dataset: OpenStreetMap',
        '- Source URL: https://www.openstreetmap.org',
        '- Extract API: https://overpass-api.de/api/interpreter',
        '- Licence: Open Database Licence 1.0 (ODbL) — https://opendatacommons.org/licenses/odbl/',
        '- Attribution: © OpenStreetMap contributors',
        f'- Extract `timestamp_osm_base`: {data["meta"]["timestamp"]}',
        f'- Accessed: {cfg["accessed"]}',
        f'- Coverage bbox (south, west, north, east): {cfg["bbox"]["south"]}, {cfg["bbox"]["west"]}, {cfg["bbox"]["north"]}, {cfg["bbox"]["east"]}',
        f'- {cfg["region"]}',
        '',
        '## Projection',
        '',
        f'- Origin: vertex centroid of OSM way {cfg["origin"]} {cfg["origin_name"]}, latitude {data["origin"]["lat"]:.8f}, longitude {data["origin"]["lon"]:.8f}.',
        '- Axes: x = east metres, y = up, z = −north metres, from a WGS84 tangent plane at that origin.',
        f'- Vertical: {cfg["vertical"]}',
        '',
        '## Counts from this compile',
        '',
    ]
    for k, v in data['meta']['counts'].items():
        lines.append(f'- {k}: {v}')
    lines += [
        '',
        '## Landmark centres',
        '',
        'Centres come from the imported OSM geometry. Distances use those centres.',
        '',
        '| Landmark | OSM id | latitude | longitude | x | z | height note |',
        '| --- | --- | --- | --- | --- | --- | --- |',
    ]
    for L in landmarks.values():
        if L['heightSource'] == 'tag':
            note = f'{L["height"]} m from the height tag'
        elif L['heightSource'] == 'levels':
            note = f'{L["height"]} m estimated from building:levels × {LEVEL_M}'
        else:
            note = 'no height or levels tag on this way'
        lines.append(f'| {L["name"]} | {L["osm"]} | {L["lat"]:.6f} | {L["lon"]:.6f} | {L["cx"]:.2f} | {L["cz"]:.2f} | {note} |')
    lines += [
        '',
        '## Distance check',
        '',
        '`enu` is the game-grid distance between centres. `vincenty` is the WGS84 inverse between the same latitudes and longitudes.',
        '',
        '| From | To | ENU m | Vincenty m | ENU − Vincenty |',
        '| --- | --- | --- | --- | --- |',
    ]
    for c in checks:
        lines.append(f'| {c["a"]} | {c["b"]} | {c["enu"]:.2f} | {c["vincenty"]:.2f} | {c["dVincenty"]:+.3f} |')
    lines += [
        '',
        '## What is tagged, and what is estimated',
        '',
        f'- Building height from an OSM `height` tag: {height_src["tag"]}.',
        f'- Building height estimated as `building:levels` × {LEVEL_M} m: {height_src["levels"]}.',
        f'- Building height estimated because neither tag exists: {height_src["default"]}.',
        f'- Road or aeroway width from an OSM `width` tag: {width_tagged}.',
        f'- Width from a class default: {nroads - width_tagged}. Runways default to 45 m and taxiways to 18 m when the width tag is absent.',
        '- Bridge decks, where present, use the OSM `layer` tag as a stacking order (1.6 m + 2.8 m per layer above 1). That is not a surveyed clearance.',
        '- The walkable surface and, in this district, the harbour or bay fill are a 4 m grid derived from the coastline and the mapped pavement.',
        '',
        '## Not imported',
        '',
    ]
    for item in cfg['not_imported']:
        lines.append(f'- {item}')
    lines += ['', '## Known gaps', '']
    for item in data['meta']['limitations']:
        lines.append(f'- {item}')
    lines.append('')
    with open(path, 'w') as f:
        f.write('\n'.join(lines))


HK = {
    'key': 'hk',
    'title': 'Hong Kong',
    'infile': '/tmp/hk-osm.json',
    'out_js': 'src/world/geo/hongkong.data.js',
    'export': 'HONGKONG_GEO',
    'out_md': 'data/geo/HONGKONG.md',
    'accessed': '2026-10-22',
    'bbox': {'south': 22.2760, 'west': 114.1545, 'north': 22.3000, 'east': 114.1745},
    'origin': 25589595,
    'origin_name': 'Two International Finance Centre',
    'spawn': 'twoIfc',
    'region': 'Central, Admiralty, the harbour, and Tsim Sha Tsui, including Two IFC, HSBC, the Central Star Ferry Pier, the Clock Tower and Central Plaza where those ways fall in the bbox.',
    'vertical': 'Local street datum y=0. Not Hong Kong Principal Datum. No Lands Department terrain model is loaded. Building height is the OSM height tag when that tag exists.',
    'route': lambda t: any(s in (t.get('name') or '') for s in (
        'Avenue of Stars', '星光大道', 'Connaught Road Central', '干諾道中',
        "Queen's Road Central", '皇后大道中', 'Salisbury Road', '梳士巴利道',
    )) and t.get('highway') in ('pedestrian', 'primary', 'secondary', 'tertiary', 'trunk', 'footway'),
    # Inland, toward HSBC, so the spawn is on the street side of IFC rather than in the harbour.
    'stand_toward': lambda enu, by_id: geo.centroid(geo.ring_of(by_id[295407347], enu)),
    'landmarks': [
        ('twoIfc', 25589595, 'Two International Finance Centre', 'toward'),
        ('bankOfChina', 25604760, 'Bank of China Tower', 'centroid'),
        ('hsbc', 295407347, 'HSBC Main Building', 'centroid'),
        ('centralPlaza', 27087018, 'Central Plaza', 'centroid'),
        ('clockTower', 37664321, 'Tsim Sha Tsui Clock Tower', 'out'),
        ('starFerry', 1483823682, 'Central Star Ferry Pier', 'out'),
        ('exchangeSquare', 26434739, 'Exchange Square', 'centroid'),
        ('admiralty', 47117859, 'Admiralty Centre', 'centroid'),
    ],
    'pairs': [
        ('twoIfc', 'clockTower'), ('twoIfc', 'hsbc'), ('twoIfc', 'starFerry'),
        ('twoIfc', 'centralPlaza'), ('twoIfc', 'bankOfChina'), ('clockTower', 'starFerry'),
        ('hsbc', 'bankOfChina'), ('starFerry', 'admiralty'), ('clockTower', 'centralPlaza'),
    ],
    'not_imported': [
        'Lands Department 3D Spatial Data building tileset was requested on 2026-10-22 from https://data.map.gov.hk/api/3d-data/3dsd/WGS84/building/tileset.json using the example key published in the CSDI API documentation (https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-spatial-data-api). The response was HTTP 200, tileset version 1.2.3, with a reported 12,199,184 triangles for the whole territory. Those meshes are not loaded in this district.',
        'The 3D Visualisation Map tile set and the individualised glTF models (1:1000 sheet downloads) were not imported.',
        'Overture buildings were not downloaded, so there is no second building layer to dedupe.',
    ],
    'limitations': [
        'Horizontal geometry is OpenStreetMap, not Lands Department survey control.',
        'Victoria Harbour in this extract is coastline ways, not one named water polygon. The water surface is a 4 m flood fill from those coastlines. Bank and pier edges can be off by about one cell. Building footprints and non-bridge roads are stamped back to land so piers and promenades stay walkable.',
        'Two International Finance Centre way 25589595 has height 415.8. HSBC Main Building way 295407347 has height 178.8. Central Plaza way 27087018 has height 309. The Clock Tower way 37664321 has height 44. Bank of China Tower way 25604760 has no height and no building:levels tag, so its extrusion uses the 9 m office default. That height is an estimate. The footprint position is the mapped way.',
        'Admiralty Centre way 47117859 has no height or levels tag.',
        'Road width uses the OSM width tag when it parses as metres. Otherwise a class default is used.',
        'Tunnels, including the Central–Wan Chai Bypass where it is tagged tunnel=yes, are omitted.',
        'Fictional overlays (portals, Ching at the Star Ferry pier, the smuggler stall, typhoon blobs, neon signs, streetlamps) are not OSM objects.',
    ],
}


def sydney_config(els):
    runways = []
    for e in els:
        if e.get('type') != 'way':
            continue
        t = e.get('tags') or {}
        if t.get('aeroway') == 'runway':
            runways.append(e)
    # Degree-area is only used to rank candidates. The metric grid is built later.
    def deg_area(e):
        g = e.get('geometry') or []
        if len(g) < 4:
            return 0
        s = 0
        for i in range(len(g) - 1):
            s += g[i]['lon'] * g[i + 1]['lat'] - g[i + 1]['lon'] * g[i]['lat']
        return abs(s)
    term_scored = []
    for e in els:
        if e.get('type') != 'way':
            continue
        t = e.get('tags') or {}
        name = t.get('name') or ''
        ref = t.get('ref') or ''
        blob = f'{name} {ref}'.lower()
        if t.get('aeroway') not in ('terminal', 'aerodrome') and 'terminal' not in blob and 'international' not in blob:
            continue
        if t.get('building') in (None, 'no') and t.get('aeroway') not in ('terminal',) and 'terminal' not in blob:
            continue
        term_scored.append((deg_area(e), e, name, t.get('aeroway'), ref))
    term_scored.sort(key=lambda r: -r[0])
    print('sydney terminal candidates:')
    for ar, e, name, aero, ref in term_scored[:12]:
        print(f'  {e["id"]} area~ {ar:.8f} aero={aero} ref={ref} {name}')
    if not term_scored:
        raise SystemExit('no Sydney terminal way in the extract')
    # Prefer a closed terminal whose name or ref says T1 / international.
    def score(row):
        ar, e, name, aero, ref = row
        blob = f'{name} {ref}'.lower()
        bonus = 0
        if 't1' in blob or 'terminal 1' in blob or 'international' in blob:
            bonus += 10
        if aero == 'terminal':
            bonus += 2
        return (bonus, ar)
    origin = max(term_scored, key=score)
    print('sydney origin', origin[1]['id'], origin[2], origin[4])
    runway_landmarks = []
    pairs = []
    for e in runways:
        t = e.get('tags') or {}
        ref = t.get('ref') or t.get('name') or str(e['id'])
        key = 'rwy' + ''.join(ch if ch.isalnum() else '' for ch in ref)[:12]
        runway_landmarks.append((key, e['id'], f'Runway {ref}', 'centroid'))
    # pair origin to each runway and runways to each other (first two)
    okey = 'terminal'
    pairs.append((okey, runway_landmarks[0][0]) if runway_landmarks else (okey, okey))
    if len(runway_landmarks) >= 2:
        pairs.append((runway_landmarks[0][0], runway_landmarks[1][0]))
        pairs.append((okey, runway_landmarks[1][0]))
    return {
        'key': 'syd',
        'title': 'Sydney Airport',
        'infile': '/tmp/syd-osm.json',
        'out_js': 'src/world/geo/sydney.data.js',
        'export': 'SYDNEY_GEO',
        'out_md': 'data/geo/SYDNEY.md',
        'accessed': '2026-10-22',
        'bbox': {'south': -33.975, 'west': 151.150, 'north': -33.920, 'east': 151.200},
        'origin': origin[1]['id'],
        'origin_name': origin[2] or 'Sydney Airport terminal',
        'spawn': 'terminal',
        'region': 'Sydney Kingsford Smith public airfield geometry inside the bbox: terminals, runways, taxiways, aprons, access roads and the shoreline where those ways are mapped.',
        'vertical': 'Local airfield datum y=0. Not the Australian Height Datum. No NSW elevation model is loaded.',
        'route': lambda t: t.get('highway') in (
            'primary', 'secondary', 'tertiary', 'unclassified', 'service', 'residential', 'pedestrian', 'footway',
        ),
        'stand_toward': lambda enu, by_id: (0.0, 80.0),
        'landmarks': [(okey, origin[1]['id'], origin[2] or 'Terminal', 'toward')] + runway_landmarks[:4],
        'pairs': [p for p in pairs if p[0] != p[1]],
        'not_imported': [
            'NSW Spatial Services datasets were not downloaded. Runways, taxiways, aprons and terminal footprints in this file are OpenStreetMap.',
            'No airport interior floor plan was imported. Passenger-building interiors are not reconstructed from a measured plan.',
        ],
        'limitations': [
            'Horizontal geometry is OpenStreetMap. It is not an Airservices Australia or Sydney Airport survey.',
            'The way tagged International Terminal T1 (1338678861) measures about 94 m by 140 m. Nearby roofs and aprons stay separate OSM objects and were not merged into that terminal.',
            'Runway way 186842426 (16L/34R) has a mapped extent of about 2.1 km. Way 219359696 (16R/34L) is about 3.8 km. Way 219847158 (07/25) is about 2.3 km. Those are the lengths of the imported ways, not a claim that every published runway is complete. Several runway ways carry width=45.',
            'At about 3.3 km from the terminal the tangent-plane distance and the WGS84 geodesic differ by about 0.2 m. That is the projection, recorded in the distance table.',
            'Runway and taxiway widths use the OSM width tag when it parses as metres. Otherwise runway defaults to 45 m and taxiway to 18 m. Those defaults are estimates.',
            'The bay shoreline comes from coastline ways, filled on a 4 m grid. Where coastline coverage inside the bbox is incomplete, the fill can mis-classify a strip along the edge.',
            'Restricted airside operational detail beyond what OpenStreetMap already publishes is not added.',
            'Fictional overlays (the passport booth, RP100 gate, burger hoard, portals, check-in props and aircraft props) sit on this grid and are not surveyed airport objects. The terminal interior is not claimed.',
        ],
    }


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'hk'
    if which == 'hk':
        compile_one(HK)
    elif which == 'syd':
        els = json.load(open('/tmp/syd-osm.json'))['elements']
        compile_one(sydney_config(els))
    else:
        raise SystemExit('use hk or syd')
