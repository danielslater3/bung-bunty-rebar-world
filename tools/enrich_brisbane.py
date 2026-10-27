#!/usr/bin/env python3
"""Ground, building and bridge heights for the Brisbane district.

Run after tools/compile_brisbane_geo.py and tools/bake_aerial.py:

    python3 tools/enrich_brisbane.py

It rewrites src/world/geo/brisbane.data.js in place. The OSM plan (streets,
footprints, river, parks, bridge outlines) and the baked aerial colours are
kept. What it adds:

  grid.terrain   ground height in metres AHD on the 4 m walk-grid nodes, from
                 the Queensland Government LiDAR DEM (Elevation/QldDem).
  buildings      ground under each footprint, measured roof-edge height from
                 the QRA Queensland Building Footprints LiDAR attributes when
                 OSM has no height tag, roof shape, storeys, a facade family
                 and Brisbane City Plan heritage/character flags.
  roads          elevated ways get absolute deck heights solved over the OSM
                 node graph: abutments sit on the DEM, river spans meet the
                 Maritime Safety Queensland air-draft clearances, overpasses
                 clear the ways under them.
  bridges        a deck profile along each bridge outline.

Inputs are cached in /tmp and downloaded when missing.
"""
import base64
import io
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from array import array
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import compile_brisbane_geo as geo  # noqa: E402

DATA_JS = geo.OUT_JS
PROVENANCE = geo.OUT_MD
DEM_BIN = '/tmp/bne-dem-v2.f32'
DEM_META = '/tmp/bne-dem-v2.json'
QRA_JSON = '/tmp/qbf-bne.json'
BCC_DIR = '/tmp/bcc'
REPORT = '/tmp/bne-enrich-report.json'

DEM_SVC = 'https://spatial-img.information.qld.gov.au/arcgis/rest/services/Elevation/QldDem/ImageServer/exportImage'
DEM_STEP = 1e-5  # degrees per pixel in both axes; a square pixel keeps the server on the requested extent
DEM_PAD = 0.0004
DEM_ATTRIBUTION = ('Includes material \u00a9 State of Queensland (Department of Natural Resources and Mines, '
                   'Manufacturing, and Regional and Rural Development); \u00a9 Commonwealth of Australia '
                   '(Geoscience Australia, The Australian Hydrographic Office); \u00a9 www.deepreef.org 2025')
QRA_SVC = ('https://gisservices.qra.qld.gov.au/arcgis/rest/services/Foundation_Data/'
           'Queensland_Building_Footprints/FeatureServer/0/query')
BCC_API = 'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/{}/exports/geojson'
BCC_SETS = {
    'commercial': 'cp14-commercial-character-building-overlay',
    'traditional': 'cp14-traditional-building-character-overlay',
    'dwelling': 'cp14-dwelling-house-character-overlay',
    'stateHeritage': 'cp14-heritage-overlay-state-heritage-area',
    'localHeritage': 'cp14-heritage-overlay-local-heritage-area',
    'pre1911': 'cp14-pre-1911-building-overlay',
}
# Towers whose OSM outline carries only podium data (or none). Heights are the
# CTBUH figures to architectural top in Wikipedia's "List of tallest buildings
# in Brisbane" (accessed 2026-10-27). Used only when OSM has no height tag or
# tags less than half of this.
PUBLISHED = {
    482352141: (262.0, 'Infinity, 43 Herschel Street'),
    224320346: (251.0, 'Soleil, 485 Queen Street'),
    140834462: (157.0, '360 Queen Street'),
    26387267: (153.0, '480 Queen Street'),
    963343037: (151.0, 'Brisbane Square, 266 George Street'),
}

RIVER_SURFACE = -0.32  # src/world/geo/river.js
SHORE_Y = RIVER_SURFACE - 0.1
BANK_Y = RIVER_SURFACE + 0.12  # lowest walkable land surface
BED_Y = -1.8

# Maritime Safety Queensland 2025 tidal planes, Port Office (Edward Street
# ferry): HAT 2.87 m and MSL 1.37 m above LAT. MSL is taken as AHD 0.
HAT_LAT, MSL_LAT = 2.87, 1.37
HAT_AHD = round(HAT_LAT - MSL_LAT, 2)
DECK_DEPTH = 1.2  # estimated soffit-to-surface depth at the navigation span
# MSQ Port Procedures and Information for Shipping - Brisbane (Oct 2024),
# air draft table, metres above HAT. Kangaroo Point Bridge opened after that
# table; its 12.7 m is Brisbane City Council's published navigation clearance.
CLEARANCE = {
    'Story Bridge': 30.0,
    'Captain Cook Bridge': 12.7,
    'Goodwill Bridge': 13.25,
    'Neville Bonner Bridge': 11.8,
    'Victoria Bridge': 11.4,
    'Kurilpa Bridge': 11.4,
    'William Jolly Bridge': 12.0,
    'Go Between Bridge': 11.4,
    'Kangaroo Point Bridge': 12.7,
}
CLEARANCE_SOURCE = {
    'Kangaroo Point Bridge': 'Brisbane City Council, Kangaroo Point Green Bridge reference design (12.7 m, as per Captain Cook Bridge)',
}
# Road bridges whose OSM ways carry the road name rather than the bridge name.
WAY_GROUP = {'Bradfield Highway': 'Story Bridge', 'Pacific Motorway': 'Captain Cook Bridge'}
MAX_GRADE = 0.045  # estimated approach grade either side of a navigation span
MAX_RAMP = 0.12    # steepest ramp accepted when lifting a way over another
HUMP_GRADE = 0.06   # deck grade either side of a structure it has to clear
PIT_MIN_DEPTH = 2.5  # closed hollows this deep and this steep (depth / sqrt(area))
PIT_MIN_RATIO = 0.06  # are excavations in the 2019 survey; broad shallow basins are real ground
CREST = 60.0       # metres of rounding over the crest
ROAD_CLEAR = 5.0 + DECK_DEPTH  # estimated vertical clearance over a road plus deck depth
PATH_CLEAR = 2.7 + 1.0         # estimated clearance over a footpath plus a light deck
VEHICLE = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary',
           'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street',
           'service', 'busway', 'bus_guideway'}

# Facade families read by src/world/geo/buildCity.js.
ST = {
    'modern': 0, 'glass': 1, 'residential': 2, 'heritage': 3, 'queenslander': 4, 'house': 5,
    'industrial': 6, 'shopfront': 7, 'church': 8, 'office': 9, 'parking': 10, 'shed': 11,
}
ROOF = {'flat': 0, 'gabled': 1, 'hipped': 2, 'pyramidal': 3, 'skillion': 4, 'dome': 5,
        'half-hipped': 2, 'mansard': 2, 'gambrel': 1, 'saltbox': 1, 'onion': 5, 'round': 5}
HOUSE_KINDS = {'house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'cabin'}
LIGHT_KINDS = {'garage', 'garages', 'shed', 'carport', 'roof', 'hut', 'kiosk', 'toilets'}
RESI_KINDS = {'apartments', 'residential', 'hotel', 'dormitory'}
INDUSTRIAL_KINDS = {'industrial', 'warehouse', 'manufacture', 'service', 'storage_tank', 'transformer_tower'}
CHURCH_KINDS = {'church', 'cathedral', 'chapel', 'temple', 'mosque', 'synagogue', 'shrine'}

MARK = 'export const BRISBANE_GEO = '


# ---------------------------------------------------------------- io helpers

def load_js(path):
    text = open(path, encoding='utf-8').read()
    i = text.index(MARK) + len(MARK)
    j = text.rindex(';')
    return text[:i], json.loads(text[i:j])


def save_js(path, prefix, data):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(prefix)
        f.write(json.dumps(data, separators=(',', ':')))
        f.write(';\n')
    os.replace(tmp, path)


def http_get(url, timeout=240, tries=4):
    last = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'BungBuntyRebarWorld-geo/1.0'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as ex:  # noqa: BLE001 - retried network errors
            last = ex
            print('  retry', k + 1, ex)
            time.sleep(3 * (k + 1))
    raise last


# ---------------------------------------------------------------- downloads

def fetch_dem():
    from PIL import Image
    west = geo.BBOX['west'] - DEM_PAD
    north = geo.BBOX['north'] + DEM_PAD
    W = int(math.ceil((geo.BBOX['east'] + DEM_PAD - west) / DEM_STEP))
    H = int(math.ceil((north - (geo.BBOX['south'] - DEM_PAD)) / DEM_STEP))
    nx, ny = int(math.ceil(W / 2400)), int(math.ceil(H / 1800))
    tw, th = int(math.ceil(W / nx)), int(math.ceil(H / ny))
    out = array('f', [0.0]) * (W * H)
    tiles = []
    for j in range(ny):
        for i in range(nx):
            x0, x1 = i * tw, min(W, (i + 1) * tw)
            y0, y1 = j * th, min(H, (j + 1) * th)
            bw, be = west + x0 * DEM_STEP, west + x1 * DEM_STEP
            bn, bs = north - y0 * DEM_STEP, north - y1 * DEM_STEP
            q = {
                'bbox': f'{bw:.7f},{bs:.7f},{be:.7f},{bn:.7f}', 'bboxSR': '4326', 'imageSR': '4326',
                'size': f'{x1 - x0},{y1 - y0}', 'format': 'tiff', 'pixelType': 'F32', 'compression': 'None',
                'noData': '-9999', 'interpolation': 'RSP_BilinearInterpolation', 'f': 'json',
            }
            meta = json.loads(http_get(DEM_SVC + '?' + urllib.parse.urlencode(q)))
            ext = meta['extent']
            err = max(abs(ext['xmin'] - bw), abs(ext['xmax'] - be), abs(ext['ymin'] - bs), abs(ext['ymax'] - bn))
            if err > 2e-7 or meta['width'] != x1 - x0 or meta['height'] != y1 - y0:
                raise SystemExit(f'DEM tile {i},{j}: server returned extent {ext}, requested {bw},{bs},{be},{bn}')
            img = Image.open(io.BytesIO(http_get(meta['href'])))
            if img.size != (x1 - x0, y1 - y0) or img.mode != 'F':
                raise SystemExit(f'DEM tile {i},{j}: unexpected image {img.mode} {img.size}')
            vals = array('f', img.tobytes())
            span = x1 - x0
            for y in range(y1 - y0):
                row = (y0 + y) * W + x0
                out[row:row + span] = vals[y * span:(y + 1) * span]
            tiles.append({'i': i, 'j': j, 'extent': [bw, bs, be, bn], 'size': [span, y1 - y0]})
            print(f'  dem tile {i},{j} {span}x{y1 - y0}')
    with open(DEM_BIN, 'wb') as f:
        out.tofile(f)
    json.dump({
        'west': west, 'north': north, 'step': DEM_STEP, 'w': W, 'h': H, 'source': DEM_SVC,
        'fetched': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'tiles': tiles,
    }, open(DEM_META, 'w'), indent=1)


def fetch_qra():
    box = (geo.BBOX['west'], geo.BBOX['south'], geo.BBOX['east'], geo.BBOX['north'])
    feats, offset = [], 0
    while True:
        q = {
            'where': '1=1', 'geometry': ','.join(str(v) for v in box), 'geometryType': 'esriGeometryEnvelope',
            'inSR': '4326', 'spatialRel': 'esriSpatialRelIntersects', 'outFields': '*', 'returnGeometry': 'true',
            'outSR': '4326', 'orderByFields': 'OBJECTID', 'resultOffset': str(offset),
            'resultRecordCount': '2000', 'f': 'json',
        }
        d = json.loads(http_get(QRA_SVC + '?' + urllib.parse.urlencode(q)))
        batch = d.get('features') or []
        feats.extend(batch)
        print('  qra offset', offset, 'got', len(batch))
        if not batch or (not d.get('exceededTransferLimit') and len(batch) < 2000):
            break
        offset += len(batch)
        time.sleep(0.5)
    json.dump({'source': QRA_SVC, 'bbox': box, 'fetched': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
               'features': feats}, open(QRA_JSON, 'w'))


def fetch_bcc():
    os.makedirs(BCC_DIR, exist_ok=True)
    pad = 0.001
    where = 'in_bbox(geo_shape,{},{},{},{})'.format(
        geo.BBOX['south'] - pad, geo.BBOX['west'] - pad, geo.BBOX['north'] + pad, geo.BBOX['east'] + pad)
    for ds in BCC_SETS.values():
        path = os.path.join(BCC_DIR, ds + '.geojson')
        if os.path.exists(path):
            continue
        raw = http_get(BCC_API.format(ds) + '?' + urllib.parse.urlencode({'where': where}))
        open(path, 'wb').write(raw)
        print('  bcc', ds, len(raw))


def ensure_inputs():
    if not os.path.exists(geo.CITY):
        raise SystemExit(f'{geo.CITY} is missing. Run the Overpass download described in tools/compile_brisbane_geo.py first.')
    if not (os.path.exists(DEM_BIN) and os.path.exists(DEM_META)):
        print('downloading Queensland DEM')
        fetch_dem()
    if not os.path.exists(QRA_JSON):
        print('downloading QRA building footprints')
        fetch_qra()
    fetch_bcc()


# ---------------------------------------------------------------- terrain

class Dem:
    def __init__(self):
        m = json.load(open(DEM_META))
        self.meta = m
        self.west, self.north, self.step = m['west'], m['north'], m['step']
        self.w, self.h = m['w'], m['h']
        self.v = array('f')
        with open(DEM_BIN, 'rb') as f:
            self.v.fromfile(f, self.w * self.h)
        if sys.byteorder != 'little':
            self.v.byteswap()

    def seams(self):
        """Mean step across each tile boundary against the rows either side."""
        out = []
        tiles = self.meta.get('tiles') or []
        rows = sorted({t['size'][1] * t['j'] for t in tiles if t['j'] > 0})
        w, v = self.w, self.v
        for r in rows:
            def md(a, b):
                s = 0.0
                n = 0
                for i in range(0, w, 7):
                    x, y = v[a * w + i], v[b * w + i]
                    if x > -1000 and y > -1000:
                        s += abs(x - y)
                        n += 1
                return s / max(1, n)
            out.append((r, round(md(r - 1, r), 3), round(md(r - 2, r - 1), 3), round(md(r, r + 1), 3)))
        return out

    def at_pixel(self, fx, fy):
        i = int(math.floor(fx))
        j = int(math.floor(fy))
        if i < 0:
            i = 0
        elif i > self.w - 2:
            i = self.w - 2
        if j < 0:
            j = 0
        elif j > self.h - 2:
            j = self.h - 2
        u = min(1.0, max(0.0, fx - i))
        t = min(1.0, max(0.0, fy - j))
        k = j * self.w + i
        v = self.v
        a, b, c, d = v[k], v[k + 1], v[k + self.w], v[k + self.w + 1]
        if a < -1000 or b < -1000 or c < -1000 or d < -1000:
            good = [x for x in (a, b, c, d) if x > -1000]
            return sum(good) / len(good) if good else 0.0
        return (a * (1 - u) + b * u) * (1 - t) + (c * (1 - u) + d * u) * t


class Frame:
    """ENU <-> WGS84 for the compile origin, and DEM pixel lookups."""

    def __init__(self, lat0, lon0, dem):
        self.lat0, self.lon0 = lat0, lon0
        N, M = geo.radii(lat0)
        self.kx = 180.0 / (math.pi * N * math.cos(math.radians(lat0)))  # degrees lon per metre east
        self.kz = 180.0 / (math.pi * M)                                   # degrees lat per metre north
        self.dem = dem

    def ll(self, x, z):
        return self.lat0 + (-z) * self.kz, self.lon0 + x * self.kx

    def dem_at(self, x, z):
        d = self.dem
        lat, lon = self.ll(x, z)
        return d.at_pixel((lon - d.west) / d.step - 0.5, (d.north - lat) / d.step - 0.5)


class Terrain:
    """Height on the walk-grid nodes, sampled with the same triangle split as buildCity.js."""

    def __init__(self, grid, water, frame):
        self.minx, self.minz, self.cell = grid['minX'], grid['minZ'], grid['cell']
        self.gw, self.gh = grid['w'], grid['h']
        self.nw, self.nh = self.gw + 1, self.gh + 1
        self.water = water
        self.frame = frame
        self.v = array('f', [0.0]) * (self.nw * self.nh)

    def build(self):
        f = self.frame
        d = f.dem
        gw, gh, nw = self.gw, self.gh, self.nw
        water = self.water
        offs = ((0.0, 0.0, 2.0), (1.4, 0.0, 1.0), (-1.4, 0.0, 1.0), (0.0, 1.4, 1.0), (0.0, -1.4, 1.0))
        px0 = (f.lon0 - d.west) / d.step - 0.5
        pxk = f.kx / d.step
        py0 = (d.north - f.lat0) / d.step - 0.5
        pzk = f.kz / d.step
        stats = Counter()
        for j in range(self.nh):
            z = self.minz + j * self.cell
            for i in range(nw):
                x = self.minx + i * self.cell
                wet = dry = 0
                for ci, cj in ((i - 1, j - 1), (i, j - 1), (i - 1, j), (i, j)):
                    if 0 <= ci < gw and 0 <= cj < gh:
                        if water[cj * gw + ci]:
                            wet += 1
                        else:
                            dry += 1
                s = 0.0
                for dx, dz, wgt in offs:
                    s += wgt * d.at_pixel(px0 + (x + dx) * pxk, py0 + (z + dz) * pzk)
                hgt = s / 6.0
                if dry == 0:
                    hgt = min(hgt, BED_Y)
                    stats['bed'] += 1
                elif wet:
                    hgt = min(hgt, SHORE_Y)
                    stats['shore'] += 1
                else:
                    if hgt < RIVER_SURFACE + 0.12:
                        stats['landRaised'] += 1
                    hgt = max(hgt, RIVER_SURFACE + 0.12)
                    stats['land'] += 1
                self.v[j * nw + i] = round(hgt * 100) / 100
        return stats

    def at(self, x, z):
        fx = (x - self.minx) / self.cell
        fz = (z - self.minz) / self.cell
        i = int(math.floor(fx))
        j = int(math.floor(fz))
        i = 0 if i < 0 else (self.gw - 1 if i > self.gw - 1 else i)
        j = 0 if j < 0 else (self.gh - 1 if j > self.gh - 1 else j)
        u = min(1.0, max(0.0, fx - i))
        v = min(1.0, max(0.0, fz - j))
        k = j * self.nw + i
        h00, h10 = self.v[k], self.v[k + 1]
        h01, h11 = self.v[k + self.nw], self.v[k + self.nw + 1]
        if u + v <= 1:
            return h00 + (h10 - h00) * u + (h01 - h00) * v
        return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v)

    def is_water(self, x, z):
        i = int((x - self.minx) / self.cell)
        j = int((z - self.minz) / self.cell)
        if i < 0 or j < 0 or i >= self.gw or j >= self.gh:
            return False
        return self.water[j * self.gw + i] == 1

    def ground(self, x, z):
        return RIVER_SURFACE if self.is_water(x, z) else self.at(x, z)

    def walk(self, x, z):
        """Surface a path or road sits on: the DEM, kept clear of the river at the bank."""
        return RIVER_SURFACE if self.is_water(x, z) else max(self.at(x, z), BANK_Y)

    def fill_pits(self, keep_nodes, min_depth=PIT_MIN_DEPTH):
        """Fill closed hollows the 2019 survey caught mid-excavation.

        Priority-flood from the river and the map edge gives every node its spill
        level. A hollow at least min_depth deep is filled to that level unless a
        mapped road runs into its deep part (a cutting down to a tunnel portal),
        or it holds mapped standing water (keep_nodes covers both).
        """
        import heapq
        nw, nh, v = self.nw, self.nh, self.v
        n = nw * nh
        fill = array('f', v)
        seen = bytearray(n)
        heap = []
        for j in range(nh):
            for i in range(nw):
                k = j * nw + i
                edge = i == 0 or j == 0 or i == nw - 1 or j == nh - 1
                if edge or v[k] < RIVER_SURFACE:
                    seen[k] = 1
                    heapq.heappush(heap, (v[k], k))
        while heap:
            hk, k = heapq.heappop(heap)
            i, j = k % nw, k // nw
            for dj in (-1, 0, 1):
                jj = j + dj
                if jj < 0 or jj >= nh:
                    continue
                for di in (-1, 0, 1):
                    ii = i + di
                    if (di or dj) and 0 <= ii < nw:
                        m = jj * nw + ii
                        if not seen[m]:
                            seen[m] = 1
                            f = v[m] if v[m] > hk else hk
                            fill[m] = f
                            heapq.heappush(heap, (f, m))
        done = bytearray(n)
        pits = []
        for k0 in range(n):
            if done[k0] or fill[k0] - v[k0] <= 0.3:
                continue
            comp, stack = [], [k0]
            done[k0] = 1
            while stack:
                k = stack.pop()
                comp.append(k)
                i, j = k % nw, k // nw
                for dj in (-1, 0, 1):
                    for di in (-1, 0, 1):
                        ii, jj = i + di, j + dj
                        if 0 <= ii < nw and 0 <= jj < nh:
                            m = jj * nw + ii
                            if not done[m] and fill[m] - v[m] > 0.3:
                                done[m] = 1
                                stack.append(m)
            depth = max(fill[k] - v[k] for k in comp)
            if depth < min_depth:
                continue
            area = len(comp) * self.cell * self.cell
            kept = depth / math.sqrt(area) < PIT_MIN_RATIO \
                or any(k in keep_nodes and fill[k] - v[k] > 2.0 for k in comp)
            ci = sum(k % nw for k in comp) / len(comp)
            cj = sum(k // nw for k in comp) / len(comp)
            pits.append({'x': round(self.minx + ci * self.cell, 1), 'z': round(self.minz + cj * self.cell, 1),
                         'areaM2': area, 'depth': round(depth, 2),
                         'spill': round(max(fill[k] for k in comp), 2), 'filled': not kept})
            if not kept:
                for k in comp:
                    v[k] = round(fill[k] * 100) / 100
        return pits

    def node_of(self, x, z):
        i = int(round((x - self.minx) / self.cell))
        j = int(round((z - self.minz) / self.cell))
        if 0 <= i < self.nw and 0 <= j < self.nh:
            return j * self.nw + i
        return None

    def pack(self):
        q = array('h', (max(-32768, min(32767, int(round(h * 100)))) for h in self.v))
        if sys.byteorder != 'little':
            q.byteswap()
        return base64.b64encode(q.tobytes()).decode('ascii')


# ---------------------------------------------------------------- spatial helpers

class Buckets:
    def __init__(self, size):
        self.size = size
        self.b = defaultdict(list)

    def add(self, bb, item):
        s = self.size
        for i in range(int(math.floor(bb[0] / s)), int(math.floor(bb[1] / s)) + 1):
            for j in range(int(math.floor(bb[2] / s)), int(math.floor(bb[3] / s)) + 1):
                self.b[(i, j)].append(item)

    def near(self, bb):
        s = self.size
        seen = set()
        for i in range(int(math.floor(bb[0] / s)), int(math.floor(bb[1] / s)) + 1):
            for j in range(int(math.floor(bb[2] / s)), int(math.floor(bb[3] / s)) + 1):
                for it in self.b.get((i, j), ()):
                    if id(it) not in seen:
                        seen.add(id(it))
                        yield it


def bbox(pts):
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    return (min(xs), max(xs), min(zs), max(zs))


def seg_point(ax, az, bx, bz, px, pz):
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    t = 0.0 if L2 < 1e-9 else max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / L2))
    qx, qz = ax + dx * t, az + dz * t
    return math.hypot(px - qx, pz - qz), qx, qz


def seg_cross(a, b, c, d):
    """Proper intersection of segments ab and cd. Returns (t on ab, s on cd) or None."""
    r = (b[0] - a[0], b[1] - a[1])
    s = (d[0] - c[0], d[1] - c[1])
    den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-9:
        return None
    qp = (c[0] - a[0], c[1] - a[1])
    t = (qp[0] * s[1] - qp[1] * s[0]) / den
    u = (qp[0] * r[1] - qp[1] * r[0]) / den
    if 0.0 < t < 1.0 and 0.0 < u < 1.0:
        return t, u
    return None


def layer_of(t):
    raw = t.get('layer')
    if raw in (None, ''):
        return None
    try:
        return int(str(raw).split(';')[0])
    except ValueError:
        return None


def is_bridge(t):
    b = t.get('bridge')
    return (b not in (None, '', 'no')) or t.get('man_made') == 'bridge'


# ---------------------------------------------------------------- compile replay

def replay_compile(els, enu, data):
    """Rebuild the compiler's building, road and bridge lists in order, with their OSM elements."""
    B = geo.BBOX
    corners = [enu(lat, lon) for lat, lon in (
        (B['south'], B['west']), (B['south'], B['east']), (B['north'], B['west']), (B['north'], B['east']))]
    minx = min(p[0] for p in corners) - 8
    maxx = max(p[0] for p in corners) + 8
    minz = min(p[1] for p in corners) - 8
    maxz = max(p[1] for p in corners) + 8
    G = data['grid']
    assert abs(minx - G['minX']) < 0.01 and abs(minz - G['minZ']) < 0.01, 'grid origin differs from the compile'

    raw = []
    for e in els:
        t = e.get('tags') or {}
        if 'building' not in t and 'building:part' not in t:
            continue
        pts = geo.simplify(geo.ring_of(e, enu), 0.8)
        if not geo.closed(pts, 2.0):
            continue
        pts = geo.close_ring(pts)
        ar = geo.area(pts)
        if ar < 12 or ar > 80000:
            continue
        cx, cz = geo.centroid(pts)
        if cx < minx or cx > maxx or cz < minz or cz > maxz:
            continue
        kind = 'part' if 'building:part' in t else 'outline'
        raw.append({'el': e, 'pts': pts, 'area': ar, 'c': (cx, cz), 'kind': kind, 'bb': geo.bbox_of(pts)})
    parts = [b for b in raw if b['kind'] == 'part']
    drop = set()
    for o in raw:
        if o['kind'] == 'part':
            continue
        x0, x1, z0, z1 = o['bb']
        for p in parts:
            if p['c'][0] < x0 or p['c'][0] > x1 or p['c'][1] < z0 or p['c'][1] > z1:
                continue
            if geo.point_in(o['pts'], *p['c']):
                drop.add(id(o))
                break
    kept = [b for b in raw if not (b['kind'] != 'part' and id(b) in drop)]
    if len(kept) != len(data['buildings']):
        raise SystemExit(f'building replay {len(kept)} != data {len(data["buildings"])}')
    for k, (kb, db) in enumerate(zip(kept, data['buildings'])):
        if geo.flat(kb['pts']) != db['r']:
            raise SystemExit(f'building {k} ring differs from the compile (osm {kb["el"]["id"]})')

    roads, bridges = [], []
    for e in els:
        t = e.get('tags') or {}
        hw = t.get('highway')
        pts = geo.simplify(geo.ring_of(e, enu), 1.1)
        if t.get('man_made') == 'bridge' and geo.closed(pts, 2.5) and geo.area(geo.close_ring(pts)) > 40:
            bridges.append({'el': e, 'pts': geo.close_ring(pts)})
        if hw not in geo.CLASS:
            continue
        if t.get('tunnel') == 'yes' or t.get('location') == 'underground':
            continue
        if len(pts) < 2 or geo.length(pts) < 4:
            continue
        mx, mz = pts[len(pts) // 2]
        if mx < minx - 20 or mx > maxx + 20 or mz < minz - 20 or mz > maxz + 20:
            continue
        if geo.layer_deck(t) > 0:
            p2 = [(geo.rnd(x), geo.rnd(z)) for x, z in pts]
        else:
            p2, last = [], None
            for x, z in pts:
                p = (geo.rnd(x), geo.rnd(z))
                if p != last:
                    p2.append(p)
                    last = p
        if len(p2) * 2 >= 4:
            roads.append({'el': e, 'pts': pts, 'p2': p2})
    if len(roads) != len(data['roads']):
        raise SystemExit(f'road replay {len(roads)} != data {len(data["roads"])}')
    if all('o' in dr for dr in data['roads']):
        # already enriched: elevated ways carry every OSM node now, so match on way id
        if [rr['el']['id'] for rr in roads] != [dr['o'] for dr in data['roads']]:
            raise SystemExit('road way ids differ from the compile')
    else:
        for k, (rr, dr) in enumerate(zip(roads, data['roads'])):
            step = 3 if dr.get('py') else 2
            xz = [(dr['p'][i], dr['p'][i + 1]) for i in range(0, len(dr['p']), step)]
            if xz != rr['p2']:
                raise SystemExit(f'road {k} differs from the compile (osm {rr["el"]["id"]})')
    if [b['el']['id'] for b in bridges] != [b['osm'] for b in data['bridges']]:
        raise SystemExit('bridge outline order differs from the compile')
    return kept, roads, bridges


def compile_height(t):
    """The compiler's own height for an element (tag, levels or default), so reruns start clean."""
    ht = geo.parse_m(t.get('height'))
    base = geo.parse_m(t.get('min_height')) or 0
    if ht is not None and ht > 0:
        src = 2
    else:
        lv = geo.parse_m(t.get('building:levels'))
        if lv and lv > 0:
            ht = lv * geo.LEVEL_M
            src = 1
        else:
            kind = t.get('building') or ''
            ht = 6 if kind in geo.HOUSE else (16 if kind in ('apartments', 'residential') else 9)
            src = 0
    ht = max(3.0, min(320.0, ht))
    base = max(0, base)
    if base > ht:
        ht = base + 3
    return ht - base, base, src


# ---------------------------------------------------------------- overlays

def load_overlays(enu):
    out = {}
    for key, ds in BCC_SETS.items():
        path = os.path.join(BCC_DIR, ds + '.geojson')
        gj = json.load(open(path))
        idx = Buckets(64)
        n = 0
        for f in gj.get('features') or []:
            g = f.get('geometry') or {}
            polys = g.get('coordinates') or []
            if g.get('type') == 'Polygon':
                polys = [polys]
            elif g.get('type') != 'MultiPolygon':
                continue
            for poly in polys:
                if not poly:
                    continue
                ring = [enu(lat, lon) for lon, lat in poly[0]]
                if len(ring) < 4:
                    continue
                idx.add(bbox(ring), {'ring': ring, 'bb': bbox(ring)})
                n += 1
        out[key] = idx
        print(f'  overlay {key}: {n} polygons')
    return out


def in_overlay(idx, x, z):
    for it in idx.near((x, x, z, z)):
        x0, x1, z0, z1 = it['bb']
        if x0 <= x <= x1 and z0 <= z <= z1 and geo.point_in(it['ring'], x, z):
            return True
    return False


# ---------------------------------------------------------------- buildings

def load_qra(enu):
    d = json.load(open(QRA_JSON))
    idx = Buckets(40)
    n = 0
    for f in d['features']:
        a = f.get('attributes') or {}
        rings = (f.get('geometry') or {}).get('rings') or []
        if not rings:
            continue
        ring = [enu(lat, lon) for lon, lat in rings[0]]
        if len(ring) < 4:
            continue
        idx.add(bbox(ring), {
            'ring': ring, 'bb': bbox(ring), 'edge': a.get('BSM_EDGE'), 'dtm': a.get('DTM_CENTRE'),
            'cls': a.get('BUILD_CLS'), 'area': a.get('Building_Area'), 'oid': a.get('OBJECTID'),
        })
        n += 1
    print(f'  qra footprints {n}')
    return idx


def qra_match(idx, pts, c):
    ring = pts[:-1]
    samples = [c]
    stride = max(1, len(ring) // 12)
    for k in range(0, len(ring), stride):
        x, z = ring[k]
        samples.append((x + (c[0] - x) * 0.35, z + (c[1] - z) * 0.35))
    hits = Counter()
    found = {}
    for q in idx.near(bbox(pts)):
        x0, x1, z0, z1 = q['bb']
        n = 0
        for sx, sz in samples:
            if x0 <= sx <= x1 and z0 <= sz <= z1 and geo.point_in(q['ring'], sx, sz):
                n += 1
        if n:
            hits[id(q)] = n
            found[id(q)] = q
    if not hits:
        return None, 0.0
    tot = sum(hits.values())
    best = found[hits.most_common(1)[0][0]]
    good = [(found[k], n) for k, n in hits.items() if found[k]['edge'] and found[k]['edge'] > -50]
    edge = None
    if good:
        wsum = sum(n for _, n in good)
        edge = sum(q['edge'] * n for q, n in good) / wsum
    return {'cls': best['cls'], 'edge': edge, 'oid': best['oid'], 'area': best['area'],
            'cover': tot / len(samples)}, tot / len(samples)


def front_edge(pts, streets, c):
    best = None
    for s in streets.near((c[0] - 60, c[0] + 60, c[1] - 60, c[1] + 60)):
        d, qx, qz = seg_point(s[0], s[1], s[2], s[3], c[0], c[1])
        if best is None or d < best[0]:
            best = (d, qx, qz)
    if best is None or best[0] > 60:
        return None
    _, qx, qz = best
    ring = pts[:-1]
    n = len(ring)
    pick, pd = None, None
    for i in range(n):
        ax, az = ring[i]
        bx, bz = ring[(i + 1) % n]
        if math.hypot(bx - ax, bz - az) < 2.0:
            continue
        d, _, _ = seg_point(ax, az, bx, bz, qx, qz)
        if pd is None or d < pd:
            pick, pd = i, d
    return pick


def style_of(t, kind, cls, htot, ar, flags, hs):
    material = (t.get('building:material') or '').lower()
    start = geo.parse_m((t.get('start_date') or '')[:4]) if t.get('start_date') else None
    if kind in LIGHT_KINDS:
        return ST['shed']
    if kind in CHURCH_KINDS or t.get('amenity') == 'place_of_worship':
        return ST['church']
    if kind == 'parking' or t.get('parking') == 'multi-storey' or t.get('amenity') == 'parking':
        return ST['parking']
    house_cls = cls in ('ONESTOREY_HIGHSET', 'ONESTOREY_LOWSET', 'ONESTOREY_SLAB', 'TWOSTOREY')
    houseish = (kind in HOUSE_KINDS and htot < 14) or (kind in ('yes', 'residential') and house_cls and ar < 420 and htot < 10.5)
    if houseish:
        old = start is not None and start < 1946
        if hs or old or flags.get('traditional') or flags.get('dwelling') or flags.get('heritage') or flags.get('pre1911'):
            return ST['queenslander']
        return ST['house']
    if kind in INDUSTRIAL_KINDS:
        return ST['industrial']
    if (flags.get('heritage') or flags.get('pre1911')) and htot < 45:
        return ST['heritage']
    if flags.get('commercial') and htot < 16:
        return ST['shopfront']
    if htot >= 40:
        if kind in RESI_KINDS or kind in HOUSE_KINDS:
            return ST['residential']
        if start is not None and start < 1990 and material != 'glass':
            return ST['office']
        return ST['glass']
    if htot >= 13:
        if kind in RESI_KINDS or kind in HOUSE_KINDS:
            return ST['residential']
        return ST['glass'] if material == 'glass' else ST['office']
    if kind in ('retail', 'commercial', 'shop', 'supermarket'):
        return ST['shopfront']
    if kind in RESI_KINDS and htot >= 8:
        return ST['residential']
    return ST['modern']


def roof_of(t, st, ar):
    shape = (t.get('roof:shape') or '').lower()
    if shape in ROOF:
        return ROOF[shape], True
    if st in (ST['queenslander'], ST['house']):
        return (ROOF['pyramidal'] if ar < 140 else ROOF['hipped']), False
    if st == ST['church']:
        return ROOF['gabled'], False
    if st == ST['shed'] and ar < 120:
        return ROOF['gabled'], False
    return ROOF['flat'], False


# ---------------------------------------------------------------- elevated ways

class Net:
    def __init__(self):
        self.pos = {}
        self.adj = defaultdict(dict)
        self.fixed = {}
        self.lo = {}
        self.seq = {}      # way id -> node id list (virtual nodes inserted)
        self.vid = -1

    def link(self, a, b):
        ax, az = self.pos[a]
        bx, bz = self.pos[b]
        w = 1.0 / max(0.5, math.hypot(bx - ax, bz - az))
        self.adj[a][b] = w
        self.adj[b][a] = w

    def unlink(self, a, b):
        self.adj[a].pop(b, None)
        self.adj[b].pop(a, None)

    def split_chain(self, way, a, b, items):
        """Insert nodes between consecutive a, b of a way. items: [(t, fixed_y or None)] with 0 < t < 1."""
        seq = self.seq[way]
        for k in range(len(seq) - 1):
            if seq[k] == a and seq[k + 1] == b:
                break
        else:
            return []
        ax, az = self.pos[a]
        bx, bz = self.pos[b]
        self.unlink(a, b)
        made = []
        prev = a
        for t, yv in sorted(items):
            v = self.vid
            self.vid -= 1
            self.pos[v] = (ax + (bx - ax) * t, az + (bz - az) * t)
            self.link(prev, v)
            if yv is not None:
                self.fixed[v] = yv
            made.append(v)
            prev = v
        self.link(prev, b)
        seq[k + 1:k + 1] = made
        return made

    def solve(self, y, iters=6000, omega=1.85, tol=0.002):
        free = [n for n in self.adj if n not in self.fixed]
        for n, v in self.fixed.items():
            y[n] = v
        adj, lo = self.adj, self.lo
        delta = 0.0
        for it in range(iters):
            delta = 0.0
            for n in free:
                nb = adj[n]
                if not nb:
                    continue
                s = 0.0
                ws = 0.0
                for m, w in nb.items():
                    s += w * y[m]
                    ws += w
                cur = y[n]
                new = cur + omega * (s / ws - cur)
                floor = lo.get(n)
                if floor is not None and new < floor:
                    new = floor
                d = abs(new - cur)
                if d > delta:
                    delta = d
                y[n] = new
            if delta < tol:
                return it + 1, delta
        return iters, delta


def way_name(t):
    return t.get('bridge:name') or t.get('name') or ''


def in_polys(polys, x, z):
    for p, bb in polys:
        if bb[0] <= x <= bb[1] and bb[2] <= z <= bb[3] and geo.point_in(p, x, z):
            return True
    return False


def along(pts, step=2.0):
    """Points every `step` metres along a polyline, with the share of length each stands for."""
    out = []
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, bz - az)
        n = max(1, int(L / step))
        for k in range(n):
            t = (k + 0.5) / n
            out.append((ax + (bx - ax) * t, az + (bz - az) * t, L / n))
    return out


def share_inside(pts, polys):
    tot = ins = 0.0
    for x, z, w in along(pts):
        tot += w
        if in_polys(polys, x, z):
            ins += w
    return ins / tot if tot else 0.0


def solve_elevated(els, enu, T, groups, outlines):
    """Absolute heights for every node on a bridge way.

    A way is a bridge when OSM tags it so, or when it crosses the river while
    lying on a bridge outline. Every other way follows the DEM, whatever its
    layer: the DEM already holds embankments and cuttings. Bridge ways are free
    between ground anchors, except on a named river span, which follows the
    published clearance profile.
    """
    net = Net()
    ways = {}
    promoted = 0
    out_polys = [(p, bb) for p, bb, _ in outlines]
    for e in els:
        if e.get('type') != 'way':
            continue
        t = e.get('tags') or {}
        hw = t.get('highway')
        if not hw:
            continue
        if t.get('tunnel') not in (None, '', 'no') or t.get('location') == 'underground':
            continue
        nodes = e.get('nodes') or []
        g = e.get('geometry') or []
        if len(nodes) != len(g) or len(nodes) < 2 or any(p is None for p in g):
            continue
        for nid, p in zip(nodes, g):
            if nid not in net.pos:
                net.pos[nid] = enu(p['lat'], p['lon'])
        seq = []
        for nid in nodes:
            if not seq or seq[-1] != nid:
                seq.append(nid)
        net.seq[e['id']] = seq
        L = layer_of(t)
        pts = [net.pos[n] for n in seq]
        wet = any(T.is_water(x, z) for x, z, _ in along(pts, 3.0))
        if is_bridge(t):
            kind = 'bridge'
        elif wet and (L or 0) >= 0 and ((L or 0) >= 1 or share_inside(pts, out_polys) >= 0.7):
            kind = 'bridge'
            promoted += 1
        else:
            kind = 'ground'
        ways[e['id']] = {'el': e, 'kind': kind, 'L': L if L is not None else (1 if kind == 'bridge' else 0),
                         'Ltag': L, 'hw': hw, 'tags': t, 'wet': wet, 'name': way_name(t)}

    ground_nodes = set()
    elev_nodes = set()
    for wid, w in ways.items():
        (ground_nodes if w['kind'] == 'ground' else elev_nodes).update(net.seq[wid])
    for wid, w in ways.items():
        if w['kind'] == 'ground':
            continue
        seq = net.seq[wid]
        for a, b in zip(seq, seq[1:]):
            net.link(a, b)

    # ways on a named river span: they carry its name (or its road's name), or
    # lie mostly on its outline at or above its layer, or cross the river on it
    members = {}
    for wid, w in ways.items():
        if w['kind'] != 'bridge':
            continue
        nm = way_name(w['tags'])
        target = nm if nm in groups else WAY_GROUP.get(nm)
        pts = [net.pos[n] for n in net.seq[wid]]
        for name, grp in groups.items():
            if target == name:
                members[wid] = name
                break
            if target or not grp['polys']:
                continue
            share = share_inside(pts, grp['polys'])
            if share >= 0.7 and (w['L'] >= grp['L'] or (w['Ltag'] is None and w['wet'])):
                members[wid] = name
                break
            if share >= 0.7 and w['wet']:
                print(f'    under {name} (layer {grp["L"]}): way {wid} {w["hw"]} "{w["name"]}" layer {w["Ltag"]}')

    def on_span(grp, x, z):
        return in_polys(grp['polys'], x, z) if grp['polys'] else T.is_water(x, z)

    group_of = {}
    dense = 0
    for wid, name in members.items():
        grp = groups[name]
        seq = list(net.seq[wid])
        for a, b in zip(seq, seq[1:]):
            ax, az = net.pos[a]
            bx, bz = net.pos[b]
            L = math.hypot(bx - ax, bz - az)
            if L > 10:
                n = int(L / 8)
                items = []
                for k in range(1, n + 1):
                    t = k / (n + 1)
                    x, z = ax + (bx - ax) * t, az + (bz - az) * t
                    items.append((t, grp['deck'](x, z) if on_span(grp, x, z) else None))
                if any(yv is not None for _, yv in items):
                    for v in net.split_chain(wid, a, b, items):
                        elev_nodes.add(v)
                        if v in net.fixed:
                            group_of[v] = name
                        dense += 1
        for nid in net.seq[wid]:
            x, z = net.pos[nid]
            if nid not in group_of and on_span(grp, x, z):
                group_of[nid] = name

    y = {}
    for nid in list(net.adj.keys()):
        x, z = net.pos[nid]
        if nid in group_of:
            net.fixed[nid] = groups[group_of[nid]]['deck'](x, z)
        elif nid in ground_nodes and not T.is_water(x, z):
            net.fixed[nid] = T.walk(x, z)
        if T.is_water(x, z):
            net.lo[nid] = HAT_AHD + 1.0
        elif nid in elev_nodes:
            net.lo[nid] = T.at(x, z) + (0.3 if nid not in ground_nodes else 0.0)
        y[nid] = net.fixed.get(nid, T.ground(x, z) + 4.0)

    # elevated pieces with no anchor at all keep a nominal height over the DEM (estimated)
    seen = set()
    orphans = 0
    for start in list(net.adj.keys()):
        if start in seen or start in net.fixed:
            continue
        comp, stack, anchored = [], [start], False
        seen.add(start)
        while stack:
            n = stack.pop()
            comp.append(n)
            for m in net.adj[n]:
                if m in net.fixed:
                    anchored = True
                elif m not in seen:
                    seen.add(m)
                    stack.append(m)
        if not anchored:
            orphans += 1
            for n in comp:
                x, z = net.pos[n]
                net.fixed[n] = T.ground(x, z) + 5.5
                y[n] = net.fixed[n]

    its, delta = net.solve(y)
    print(f'  elevated solve: {len(net.adj)} nodes ({promoted} untagged river crossings on outlines, '
          f'{dense} span points added), {len(net.fixed)} fixed, {orphans} unanchored pieces, '
          f'{its} sweeps, last change {delta:.4f} m')

    def ramp_grade(wid, a, b, t, need):
        """Steepest grade needed to reach `need` at the crossing from the nearest ground anchor either way along the way."""
        seq = net.seq[wid]
        for k in range(len(seq) - 1):
            if seq[k] == a and seq[k + 1] == b:
                break
        else:
            return 0.0
        pa, pb = net.pos[a], net.pos[b]
        seg = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
        worst = 0.0
        for step, start, d0 in ((-1, k, seg * t), (1, k + 1, seg * (1 - t))):
            d, i = d0, start
            while 0 <= i < len(seq):
                n = seq[i]
                if n in group_of or (n in net.fixed and n in ground_nodes):
                    worst = max(worst, (need - net.fixed[n]) / max(d, 1.0))
                    break
                if len(net.adj[n]) == 1:
                    worst = max(worst, (need - T.walk(*net.pos[n])) / max(d, 1.0))
                    break
                j = i + step
                if 0 <= j < len(seq):
                    d += math.hypot(net.pos[seq[j]][0] - net.pos[n][0], net.pos[seq[j]][1] - net.pos[n][1])
                i = j
        return worst

    # overpasses must clear what runs under them
    raised = 0
    at_grade = set()
    lowered = 0
    to_lift = defaultdict(list)
    lifted_once = False
    deck_lifts = {}
    for rnd_i in range(6):
        segs = Buckets(16)
        for wid, w in ways.items():
            seq = net.seq[wid]
            for a, b in zip(seq, seq[1:]):
                pa, pb = net.pos[a], net.pos[b]
                segs.add((min(pa[0], pb[0]), max(pa[0], pb[0]), min(pa[1], pb[1]), max(pa[1], pb[1])), (wid, a, b))
        fixes = []
        for wid, w in ways.items():
            if w['kind'] != 'bridge':
                continue
            seq = net.seq[wid]
            for a, b in zip(seq, seq[1:]):
                pa, pb = net.pos[a], net.pos[b]
                box = (min(pa[0], pb[0]), max(pa[0], pb[0]), min(pa[1], pb[1]), max(pa[1], pb[1]))
                for (wid2, c, d) in segs.near(box):
                    if wid2 == wid or c in (a, b) or d in (a, b):
                        continue
                    w2 = ways[wid2]
                    if w2['L'] < 0 or w['L'] <= w2['L']:
                        continue
                    hit = seg_cross(pa, pb, net.pos[c], net.pos[d])
                    if not hit:
                        continue
                    t, s = hit
                    px = pa[0] + (pb[0] - pa[0]) * t
                    pz = pa[1] + (pb[1] - pa[1]) * t
                    if w2['kind'] == 'ground':
                        if T.is_water(px, pz):
                            continue
                        low = T.at(px, pz)
                    else:
                        low = y.get(c, T.ground(*net.pos[c])) * (1 - s) + y.get(d, T.ground(*net.pos[d])) * s
                    need = low + (ROAD_CLEAR if w2['hw'] in VEHICLE else PATH_CLEAR)
                    up = y[a] + (y[b] - y[a]) * t
                    if up < need - 0.05:
                        if (wid, wid2) in at_grade:
                            continue
                        if not (a in group_of and b in group_of) and ramp_grade(wid, a, b, t, need) > MAX_RAMP:
                            # no embankment in the DEM to climb it: the roads meet at grade
                            at_grade.add((wid, wid2))
                            continue
                        fixes.append((wid, a, b, t, need, wid2, c, d, s, need - low, up))
        if not fixes:
            break
        per_seg = defaultdict(list)
        under = defaultdict(dict)
        span_short = []
        for wid, a, b, t, need, wid2, c, d, s, clear, up in fixes:
            if a in group_of and b in group_of:
                # a river span keeps its published clearance profile; an elevated way under it goes down
                if ways[wid2]['kind'] == 'ground' or c in group_of or d in group_of:
                    span_short.append((round(up - need, 2), group_of[a], wid, wid2, ways[wid2]['name']))
                    continue
                pc, pd = net.pos[c], net.pos[d]
                x, z = pc[0] + (pd[0] - pc[0]) * s, pc[1] + (pd[1] - pc[1]) * s
                floor = HAT_AHD + 1.0 if T.is_water(x, z) else T.at(x, z) + 0.3
                target = max(floor, up - clear)
                if target > up - clear + 0.05:
                    span_short.append((round(up - clear - floor, 2), group_of[a], wid, wid2, ways[wid2]['name']))
                    if not lifted_once:
                        to_lift[group_of[a]].append((x, z, floor + clear))
                key = round(s, 3)
                under[(wid2, c, d)][key] = min(under[(wid2, c, d)].get(key, target), target)
                continue
            per_seg[(wid, a, b)].append((t, need))
        for (wid, a, b), items in per_seg.items():
            best = {}
            for t, need in items:
                key = round(t, 3)
                best[key] = max(best.get(key, need), need)
            made = net.split_chain(wid, a, b, sorted(best.items()))
            for v in made:
                elev_nodes.add(v)
                x, z = net.pos[v]
                net.lo[v] = HAT_AHD + 1.0 if T.is_water(x, z) else T.at(x, z) + 0.3
            raised += len(made)
        for (wid2, c, d), items in under.items():
            made = net.split_chain(wid2, c, d, sorted(items.items()))
            for v in made:
                elev_nodes.add(v)
                x, z = net.pos[v]
                net.lo[v] = HAT_AHD + 1.0 if T.is_water(x, z) else T.at(x, z) + 0.3
            lowered += len(made)
        if to_lift and not lifted_once:
            lifted_once = True
            for name, pts_need in to_lift.items():
                groups[name]['lift'](pts_need)
                deck_lifts[name] = len(pts_need)
            for nid, name in group_of.items():
                net.fixed[nid] = groups[name]['deck'](*net.pos[nid])
        for k, v in net.fixed.items():
            y[k] = v
        its, delta = net.solve(y)
        print(f'  overpass round {rnd_i + 1}: {len(fixes)} crossings under clearance, re-solved in {its} sweeps'
              f'{f"; {len(span_short)} under river spans cannot go lower" if span_short else ""}')
        if span_short and rnd_i == 5:
            for row in sorted(span_short)[:12]:
                print('    short by', row)
    if deck_lifts:
        print(f'  river decks lifted over structures that cannot go lower: {deck_lifts}')
    print(f'  overpass points: {raised} raised, {lowered} lowered under river spans; '
          f'{len(at_grade)} mapped crossings left at grade (no ramp in the DEM)')
    print(f'  named river-span nodes: {dict(Counter(group_of.values()))}')
    if os.environ.get('ENRICH_DEBUG'):
        def kind_of(n):
            if n in group_of:
                return 'span'
            if n in net.fixed:
                return 'ground' if n in ground_nodes else ('virt' if n < 0 else 'fixed')
            return 'free'
        rows = []
        for wid, w in ways.items():
            if w['kind'] != 'bridge':
                continue
            seq = net.seq[wid]
            for a, b in zip(seq, seq[1:]):
                pa, pb = net.pos[a], net.pos[b]
                d = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
                g = abs(y[b] - y[a]) / max(d, 6.0)
                if g > 0.25:
                    rows.append((round(g, 2), wid, w['hw'], w['name'], w['Ltag'], round(d, 1),
                                 (kind_of(a), round(y[a], 1), round(T.at(*pa), 1), T.is_water(*pa)),
                                 (kind_of(b), round(y[b], 1), round(T.at(*pb), 1), T.is_water(*pb)),
                                 (round(pa[0]), round(pa[1]))))
        rows.sort(key=lambda r: -r[0])
        for r in rows[:40]:
            print('    steep', r)
    stats = {'raised': raised, 'lowered': lowered, 'atGrade': len(at_grade), 'deckLifts': deck_lifts,
             'spanShort': sorted(span_short)[:40] if span_short else []}
    return net, ways, y, raised, orphans, stats


# ---------------------------------------------------------------- bridge outlines

def far_pair(pts):
    best = (0, pts[0], pts[-1])
    n = len(pts)
    for i in range(n):
        for j in range(i + 1, n):
            d = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2
            if d > best[0]:
                best = (d, pts[i], pts[j])
    return best[1], best[2]


def axis_t(a, b, x, z):
    dx, dz = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dz * dz
    if L2 < 1e-6:
        return 0.0
    return max(0.0, min(1.0, ((x - a[0]) * dx + (z - a[1]) * dz) / L2))


def land_end(T, a, b, outward):
    """Ground height at a bridge end: step outward along the axis past the bank cells onto dry land."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dz) or 1.0
    ux, uz = dx / L, dz / L
    sign = 1 if outward else -1
    for k in range(0, 81, 2):
        x = a[0] - ux * k * sign
        z = a[1] - uz * k * sign
        if not T.is_water(x, z):
            if k == 0:
                return T.at(x, z)
            x2, z2 = a[0] - ux * (k + 8) * sign, a[1] - uz * (k + 8) * sign
            return T.at(x2, z2) if not T.is_water(x2, z2) else T.at(x, z)
    return HAT_AHD + 2.0


def make_group(name, pts_list, T, crown_y, lands=True):
    """Deck profile along a river bridge's long axis.

    Rises from each end to the published navigation clearance over the middle of
    the widest water run. With an outline (lands=True) each side takes the grade
    that brings it down onto its end; without one the approaches carry on as
    ordinary elevated ways, so the span falls at MAX_GRADE.
    """
    allpts = [p for pts in pts_list for p in pts]
    a, b = far_pair(allpts)
    ya = land_end(T, a, b, True)
    yb = land_end(T, b, a, True)
    L = math.hypot(b[0] - a[0], b[1] - a[1])
    n = max(2, int(L / 2))
    wet = [T.is_water(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n + 1)]
    runs, start = [], None
    for k, w in enumerate(wet + [False]):
        if w and start is None:
            start = k
        elif not w and start is not None:
            runs.append((start, k - 1))
            start = None
    if runs:
        r0, r1 = max(runs, key=lambda r: r[1] - r[0])
        tc = (r0 + r1) / 2 / n
    else:
        tc = 0.5
    tc = min(0.85, max(0.15, tc))

    def side_grade(dist, yend):
        if crown_y is None or not lands or dist <= CREST:
            return MAX_GRADE
        return max(MAX_GRADE, (crown_y - yend) / (dist - CREST / 2))

    ga, gb = side_grade(tc * L, ya), side_grade((1 - tc) * L, yb)

    def raw(t):
        lin = ya + (yb - ya) * t
        if crown_y is None:
            return lin
        d = abs(t - tc) * L
        g = ga if t < tc else gb
        yp = crown_y - g * d * d / (2 * CREST) if d < CREST else crown_y - g * (d - CREST / 2)
        return max(lin, yp)

    ys = [raw(k / n) for k in range(n + 1)]
    left, right = list(ys), list(ys)
    for k in range(1, n + 1):
        left[k] = max(left[k - 1], ys[k])
    for k in range(n - 1, -1, -1):
        right[k] = max(right[k + 1], ys[k])
    ys = [min(l, r) for l, r in zip(left, right)]

    def deck_t(t):
        f = min(max(t, 0.0), 1.0) * n
        k = min(int(f), n - 1)
        u = f - k
        return ys[k] * (1 - u) + ys[k + 1] * u

    def lift(points):
        """Raise the deck to clear structures that cannot go lower: [(x, z, need)]."""
        for x, z, need in points:
            tp = axis_t(a, b, x, z)
            for k in range(n + 1):
                ys[k] = max(ys[k], need - HUMP_GRADE * abs(k / n - tp) * L)

    return {'a': a, 'b': b, 'ya': ya, 'yb': yb, 'tc': tc, 'crown': crown_y, 'len': L,
            'grades': (round(ga, 3), round(gb, 3)), 'lift': lift,
            'deck_t': deck_t, 'deck': lambda x, z: deck_t(axis_t(a, b, x, z))}


# ---------------------------------------------------------------- main

def main():
    t0 = time.time()
    ensure_inputs()
    prefix, data = load_js(DATA_JS)
    city = json.load(open(geo.CITY))
    els = city['elements']
    by_id = {e['id']: e for e in els}
    hall = by_id[10836280]
    hlat = sum(p['lat'] for p in hall['geometry']) / len(hall['geometry'])
    hlon = sum(p['lon'] for p in hall['geometry']) / len(hall['geometry'])
    if abs(hlat - data['origin']['lat']) > 1e-9 or abs(hlon - data['origin']['lon']) > 1e-9:
        raise SystemExit('origin differs from brisbane.data.js; recompile first')
    enu = geo.make_enu(hlat, hlon)
    report = {}

    print('replaying compile order')
    kept, roads_src, bridges_src = replay_compile(els, enu, data)
    print(f'  buildings {len(kept)}, roads {len(roads_src)}, bridge outlines {len(bridges_src)}: identical to brisbane.data.js')

    print('terrain')
    dem = Dem()
    seams = dem.seams()
    print('  tile seams (row, step across seam, step above, step below):', seams)
    for r, across, above, below in seams:
        if across > 4 * max(above, below, 0.05):
            raise SystemExit(f'DEM seam at row {r} steps {across} m; tile extents do not line up')
    frame = Frame(hlat, hlon, dem)
    G = data['grid']
    water = base64.b64decode(G['ground'])
    T = Terrain(G, water, frame)
    tstats = T.build()
    keep = set()
    for e in els:
        t = e.get('tags') or {}
        if e.get('type') != 'way':
            continue
        road = t.get('highway') in VEHICLE and not is_bridge(t)
        pond = t.get('natural') == 'water' or t.get('water') in ('pond', 'lake', 'basin', 'reservoir') \
            or t.get('landuse') == 'basin'
        if not (road or pond):
            continue
        pts = [enu(p['lat'], p['lon']) for p in e.get('geometry') or [] if p]
        if len(pts) < 2:
            continue
        if road:
            for x, z, _ in along(pts, 2.0):
                for dx in (-2.0, 0.0, 2.0):
                    for dz in (-2.0, 0.0, 2.0):
                        k = T.node_of(x + dx, z + dz)
                        if k is not None:
                            keep.add(k)
        else:
            x0, x1, z0, z1 = bbox(pts)
            for zz in range(int(z0), int(z1) + 1, 2):
                for xx in range(int(x0), int(x1) + 1, 2):
                    if geo.point_in(pts, xx, zz):
                        k = T.node_of(xx, zz)
                        if k is not None:
                            keep.add(k)
    pits = T.fill_pits(keep)
    filled = [p for p in pits if p['filled']]
    print(f'  closed hollows {PIT_MIN_DEPTH} m+ deep: {len(pits)}; filled {len(filled)} '
          f'({sum(p["areaM2"] for p in filled)} m2); kept {len(pits) - len(filled)} broad basins or ones with a road or water in them')
    for p in sorted(pits, key=lambda p: -p['depth'] * p['areaM2'])[:16]:
        print('   ', p)
    report['pits'] = pits
    land = [T.v[j * T.nw + i] for j in range(0, T.nh, 3) for i in range(0, T.nw, 3)]
    print(f'  nodes {T.nw}x{T.nh} {dict(tstats)} land min {min(land):.2f} max {max(land):.2f} m AHD')

    checks = {}
    for key in ('cityHall', 'parliament', 'queenMall', 'botanic', 'southBank', 'daviesPark', 'raymondPark'):
        L = data['landmarks'].get(key)
        if L:
            checks[key] = round(T.at(L['x'], L['z']), 2)
    print('  ground at landmarks (m AHD):', checks)
    report['landmarkGround'] = checks

    print('overlays')
    overlays = load_overlays(enu)
    print('footprint heights')
    qra = load_qra(enu)

    streets = Buckets(32)
    for rr in roads_src:
        t = rr['el'].get('tags') or {}
        if t.get('highway') in ('service', 'footway', 'path', 'steps', 'cycleway', 'track', 'busway'):
            continue
        if is_bridge(t):
            continue
        pts = rr['pts']
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            streets.add((min(ax, bx), max(ax, bx), min(az, bz), max(az, bz)), (ax, az, bx, bz))

    hsrc = Counter()
    styles = Counter()
    roofs = Counter()
    matched = 0
    newer = 0
    leaked = 0
    rows = []
    for kb, db in zip(kept, data['buildings']):
        e = kb['el']
        t = e.get('tags') or {}
        pts = kb['pts']
        c = kb['c']
        h, base, src = compile_height(t)
        g = T.at(*c)
        ring_g = [T.at(x, z) for x, z in pts[:-1]]
        gm = min(ring_g)
        gx = max(ring_g)
        q, cover = qra_match(qra, pts, c)
        cls = q['cls'] if q else None
        if q and cover >= 0.3:
            matched += 1
        old_h = h
        kind = t.get('building') or t.get('building:part') or 'yes'
        if kind == 'yes' and t.get('building:part'):
            kind = t.get('building:part')
        pub = PUBLISHED.get(e['id'])
        if pub and (src != 2 or h + base < 0.5 * pub[0]):
            h = pub[0] - base
            src = 4
        elif src != 2 and q and cover >= 0.3 and q['edge'] is not None:
            hq = q['edge'] - g
            share = kb['area'] / q['area'] if q.get('area') else 1.0
            lv = geo.parse_m(t.get('building:levels'))
            lvh = lv * geo.LEVEL_M if lv else None
            if hq < 2.0 or cls == 'NO_BUILDING_IN_LIDAR':
                pass
            elif (kind in LIGHT_KINDS and hq > 12) or (kind in HOUSE_KINDS and hq > 14):
                leaked += 1  # a canopy, shed or house beside a tower picks up the tower's edge height
            elif share < 0.35 and hq >= 15:
                leaked += 1  # a small OSM building inside a bigger LiDAR footprint
            elif lvh and lv >= 6 and lvh > 1.8 * hq:
                newer += 1   # built after the 2019 survey
            elif lvh and share < 0.6 and hq > 2.6 * lvh + 6:
                leaked += 1
            else:
                h = max(2.2, hq - base)
                src = 3
        flags = {
            'commercial': in_overlay(overlays['commercial'], *c),
            'traditional': in_overlay(overlays['traditional'], *c),
            'dwelling': in_overlay(overlays['dwelling'], *c),
            'heritage': in_overlay(overlays['stateHeritage'], *c) or in_overlay(overlays['localHeritage'], *c)
            or bool(t.get('heritage')),
            'pre1911': in_overlay(overlays['pre1911'], *c),
        }
        hs = 1 if cls == 'ONESTOREY_HIGHSET' else 0
        htot = base + h
        st = style_of(t, kind, cls, htot, kb['area'], flags, hs)
        rf, rf_tag = roof_of(t, st, kb['area'])
        lv_tag = geo.parse_m(t.get('building:levels'))
        if lv_tag and lv_tag > 0:
            lv = int(round(lv_tag))
        elif st in (ST['queenslander'], ST['house']):
            lv = 2 if (cls == 'TWOSTOREY' or h > 5.2) else 1
        else:
            lv = max(1, int(round(h / 3.3)))
        db['h'] = round(h, 2)
        db['b'] = round(base, 2)
        db['s'] = src
        db['g'] = round(g, 2)
        db['gm'] = round(gm, 2)
        db['st'] = st
        db['lv'] = lv
        for key in ('rf', 'hs', 'fe', 'hx', 'ro'):
            db.pop(key, None)
        if rf:
            db['rf'] = rf
        if hs:
            db['hs'] = 1
        if kind in ('roof', 'carport'):
            db['ro'] = 1  # a roof on posts: no walls
        if gx - gm > 1.5:
            db['hx'] = round(gx, 2)
        if st in (ST['queenslander'], ST['house'], ST['shopfront'], ST['heritage'], ST['church']):
            fe = front_edge(pts, streets, c)
            if fe is not None:
                db['fe'] = fe
        hsrc[src] += 1
        styles[st] += 1
        roofs[(rf, rf_tag)] += 1
        if t.get('name') and htot > 25:
            rows.append((t.get('name'), e['id'], round(old_h + base, 1), round(htot, 1), src, round(g, 1), cls))
    print(f'  matched to QRA footprints {matched}/{len(kept)}; levels kept over LiDAR (newer than survey) {newer}; '
          f'LiDAR skipped where a bigger footprint would leak its height {leaked}')
    print('  height source', dict(hsrc), 'styles', {k: styles[v] for k, v in ST.items()})
    rows.sort(key=lambda r: -r[3])
    report['namedTall'] = rows[:60]
    for r in rows[:25]:
        print('   ', r)

    print('bridges')
    bridge_pts = defaultdict(list)
    bridge_layer = defaultdict(int)
    outlines = []
    for bs, db in zip(bridges_src, data['bridges']):
        Lb = layer_of(bs['el'].get('tags') or {})
        Lb = 1 if Lb is None else Lb
        outlines.append((bs['pts'], bbox(bs['pts']), Lb))
        if db['name']:
            bridge_pts[db['name']].append(bs['pts'])
            bridge_layer[db['name']] = max(bridge_layer[db['name']], Lb)
    groups = {}
    for name, crown_c in CLEARANCE.items():
        pts_list = list(bridge_pts.get(name, []))
        wet_pts = []
        for e in els:
            t = e.get('tags') or {}
            if e.get('type') != 'way' or not t.get('highway') or not is_bridge(t):
                continue
            nm = way_name(t)
            if nm == name or WAY_GROUP.get(nm) == name:
                pts = [enu(p['lat'], p['lon']) for p in e.get('geometry') or [] if p]
                wet_pts.extend((x, z) for x, z, _ in along(pts, 2.0) if T.is_water(x, z))
        if pts_list:
            geom = pts_list
        elif len(wet_pts) >= 2:
            geom = [wet_pts]
        else:
            print(f'  {name}: not in this extract')
            continue
        grp = make_group(name, geom, T, HAT_AHD + crown_c + DECK_DEPTH, lands=bool(pts_list))
        grp['polys'] = [(pts, bbox(pts)) for pts in pts_list]
        grp['L'] = bridge_layer.get(name, 1) if pts_list else 1
        groups[name] = grp
        print(f'  {name}: axis {grp["len"]:.0f} m, ends {grp["ya"]:.1f}/{grp["yb"]:.1f} m AHD, '
              f'crown {grp["crown"]:.1f} m AHD at t={grp["tc"]:.2f}, grades {grp["grades"]}, layer {grp["L"]}'
              + ('' if pts_list else ' (no outline; river span from the road ways)'))

    print('elevated ways')
    net, ways, ysol, raised, orphans, sstats = solve_elevated(els, enu, T, groups, outlines)
    report['elevated'] = sstats

    # road records
    py_before = sum(1 for r in data['roads'] if r.get('py'))
    became_ground = 0
    def to_ground(dr):
        if dr.get('py'):
            dr.pop('py', None)
            dr['p'] = [v for k, v in enumerate(dr['p']) if k % 3 != 2]
            return 1
        return 0

    for rr, dr in zip(roads_src, data['roads']):
        e = rr['el']
        dr['o'] = e['id']
        w = ways.get(e['id'])
        if not w or w['kind'] == 'ground':
            became_ground += to_ground(dr)
            continue
        seq = net.seq[e['id']]
        pts = []
        for nid in seq:
            x, z = net.pos[nid]
            yv = ysol.get(nid)
            if yv is None:
                yv = T.ground(x, z)
            if pts and (pts[-1][0] - x) ** 2 + (pts[-1][1] - z) ** 2 < 0.04:
                continue
            pts.append((x, z, yv))
        lift = max((yv - T.ground(x, z)) for x, z, yv in pts)
        wet = w['wet']
        if (lift < 0.8 and not wet) or len(pts) < 2:
            became_ground += to_ground(dr)
            continue
        dr['py'] = 1
        out = []
        for x, z, yv in pts:
            out.extend((geo.rnd(x), geo.rnd(z), round(yv, 2)))
        dr['p'] = out
    py_after = sum(1 for r in data['roads'] if r.get('py'))
    print(f'  elevated road records {py_before} -> {py_after}; {became_ground} now follow the ground')

    # bridge outlines: a deck profile along each outline's long axis
    for bs, db in zip(bridges_src, data['bridges']):
        pts = bs['pts']
        a, b = far_pair(pts[:-1])
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(2, min(48, int(L / 8)))
        grp = groups.get(db['name'])
        ys = []
        if grp:
            for k in range(n + 1):
                x = a[0] + (b[0] - a[0]) * k / n
                z = a[1] + (b[1] - a[1]) * k / n
                ys.append(grp['deck'](x, z))
        else:
            bb = bbox(pts)
            Lb = layer_of(bs['el'].get('tags') or {})
            Lb = 1 if Lb is None else Lb
            inside = []
            for wid, w in ways.items():
                if w['kind'] != 'bridge' or w['L'] < Lb:
                    continue
                for nid in net.seq[wid]:
                    x, z = net.pos[nid]
                    if nid not in ysol or not (bb[0] - 3 <= x <= bb[1] + 3 and bb[2] - 3 <= z <= bb[3] + 3):
                        continue
                    if geo.point_in(pts, x, z) or min(seg_point(p[0], p[1], q[0], q[1], x, z)[0]
                                                      for p, q in zip(pts, pts[1:])) < 3:
                        inside.append((axis_t(a, b, x, z), ysol[nid]))
            if inside:
                inside.sort()
                for k in range(n + 1):
                    tk = k / n
                    lo = [p for p in inside if p[0] <= tk]
                    hi = [p for p in inside if p[0] >= tk]
                    if lo and hi:
                        p, q = lo[-1], hi[0]
                        ys.append(p[1] if q[0] - p[0] < 1e-6 else p[1] + (q[1] - p[1]) * (tk - p[0]) / (q[0] - p[0]))
                    else:
                        ys.append((lo[-1] if lo else hi[0])[1])
            else:
                ya, yb = land_end(T, a, b, True), land_end(T, b, a, True)
                ys = [ya + (yb - ya) * k / n for k in range(n + 1)]
            for k in range(n + 1):
                x = a[0] + (b[0] - a[0]) * k / n
                z = a[1] + (b[1] - a[1]) * k / n
                floor = HAT_AHD + 1.0 if T.is_water(x, z) else T.at(x, z) + 0.3
                ys[k] = max(ys[k], floor)
        db['ax'], db['az'] = geo.rnd(a[0]), geo.rnd(a[1])
        db['bx'], db['bz'] = geo.rnd(b[0]), geo.rnd(b[1])
        db['ys'] = [round(v, 2) for v in ys]
        db['y'] = round(max(ys), 2)
        if grp:
            db['crown'] = round(grp['crown'], 2)
            db['clear'] = CLEARANCE[db['name']]

    # deck grid: bridge outlines, then elevated ribbons on top
    gw, gh, cell, minx, minz = G['w'], G['h'], G['cell'], G['minX'], G['minZ']
    deck = bytearray(gw * gh)

    def deck_code(yv):
        return max(1, min(255, int(round(yv / G['step']))))

    for bs, db in zip(bridges_src, data['bridges']):
        pts = bs['pts']
        a, b = (db['ax'], db['az']), (db['bx'], db['bz'])
        ys = db['ys']
        bb = bbox(pts)
        j0 = max(0, int((bb[2] - minz) / cell) - 1)
        j1 = min(gh - 1, int((bb[3] - minz) / cell) + 1)
        i0 = max(0, int((bb[0] - minx) / cell) - 1)
        i1 = min(gw - 1, int((bb[1] - minx) / cell) + 1)
        for j in range(j0, j1 + 1):
            cz = minz + (j + 0.5) * cell
            for i in range(i0, i1 + 1):
                cx = minx + (i + 0.5) * cell
                if not geo.point_in(pts, cx, cz):
                    continue
                tk = axis_t(a, b, cx, cz) * (len(ys) - 1)
                k = min(len(ys) - 2, int(tk))
                yv = ys[k] + (ys[k + 1] - ys[k]) * (tk - k)
                if T.is_water(cx, cz) or yv > T.at(cx, cz) + 0.6:
                    deck[j * gw + i] = deck_code(yv)
    for dr in data['roads']:
        if not dr.get('py'):
            continue
        p = dr['p']
        pts = [(p[i], p[i + 1], p[i + 2]) for i in range(0, len(p), 3)]
        rad = max(dr['w'] * 0.5, cell * 0.55)
        step = max(1.5, cell * 0.45)
        for (x0, z0, y0), (x1, z1, y1) in zip(pts, pts[1:]):
            seg = math.hypot(x1 - x0, z1 - z0)
            n = max(1, int(seg / step))
            for s in range(n + 1):
                tt = s / n
                x = x0 + (x1 - x0) * tt
                z = z0 + (z1 - z0) * tt
                yv = y0 + (y1 - y0) * tt
                if not T.is_water(x, z) and yv < T.at(x, z) + 0.6:
                    continue
                ci0 = max(0, int((x - rad - minx) / cell))
                ci1 = min(gw - 1, int((x + rad - minx) / cell))
                cj0 = max(0, int((z - rad - minz) / cell))
                cj1 = min(gh - 1, int((z + rad - minz) / cell))
                for j in range(cj0, cj1 + 1):
                    cz = minz + (j + 0.5) * cell
                    for i in range(ci0, ci1 + 1):
                        cx = minx + (i + 0.5) * cell
                        if (cx - x) ** 2 + (cz - z) ** 2 <= rad * rad:
                            deck[j * gw + i] = deck_code(yv)
    G['deck'] = base64.b64encode(bytes(deck)).decode('ascii')
    G['terrain'] = T.pack()
    G['terrainScale'] = 0.01
    G['terrainNodes'] = [T.nw, T.nh]
    G['riverY'] = RIVER_SURFACE
    print(f'  deck cells {sum(1 for v in deck if v)}')

    # landmarks sit on the ground or the deck they name
    def deck_at(x, z):
        i = int((x - minx) / cell)
        j = int((z - minz) / cell)
        if 0 <= i < gw and 0 <= j < gh and deck[j * gw + i]:
            return deck[j * gw + i] * G['step']
        return None

    # y stays the compile's flat-world value (save keys depend on it); ya is the AHD height
    for key, L in data['landmarks'].items():
        dy = deck_at(L['x'], L['z'])
        if dy is not None and ('Bridge' in L.get('name', '') or key in ('victoriaBridge', 'storyBridge', 'goodwill', 'kangarooBridge')):
            L['ya'] = round(dy + 0.8, 2)
        else:
            L['ya'] = round(T.ground(L['x'], L['z']) + 0.4, 2)

    # metadata
    m = data['meta']
    m['verticalDatum'] = ('Australian Height Datum (AHD), metres. Ground is the Queensland Government LiDAR DEM '
                          '(Elevation/QldDem) averaged onto 4 m grid nodes. River surface is drawn at '
                          f'{RIVER_SURFACE} m AHD. Bridge decks use published navigation clearances above HAT '
                          f'({HAT_AHD} m AHD from MSQ tidal planes, mean sea level taken as AHD 0).')
    m['terrain'] = {
        'source': 'Queensland Government, Elevation/QldDem ImageServer (LiDAR digital elevation model with bathymetry)',
        'url': DEM_SVC, 'licence': 'CC BY-SA 4.0', 'attribution': DEM_ATTRIBUTION,
        'pixelDegrees': DEM_STEP, 'fetched': dem.meta.get('fetched'),
        'node': '4 m walk-grid corners, 5-sample average of the DEM around each node',
        'water': f'nodes inside the river are held at or below {BED_Y} m, shore nodes at or below {SHORE_Y} m',
        'survey': 'Brisbane 2019 LiDAR is the newest Brisbane capture in the QldDem mosaic',
        'excavationsFilled': {'count': len(filled), 'areaM2': sum(p['areaM2'] for p in filled),
                              'rule': f'closed hollows at least {PIT_MIN_DEPTH} m deep with depth / sqrt(area) '
                                      f'at least {PIT_MIN_RATIO}, no mapped road in the deep part and no mapped water, '
                                      'filled to their spill level'},
    }
    m['buildingHeights'] = {
        'source': 'QRA Queensland Building Footprints (Microsoft open footprints with DRFA LiDAR attributes)',
        'url': QRA_SVC.rsplit('/query', 1)[0],
        'licence': 'not stated on the service',
        'method': 'roof-edge elevation BSM_EDGE minus the DEM ground at the footprint centroid',
        'counts': {'osmHeightTag': hsrc[2], 'publishedHeight': hsrc[4], 'lidarRoofEdge': hsrc[3],
                   'levelsEstimated': hsrc[1], 'defaultEstimated': hsrc[0], 'matchedFootprints': matched,
                   'levelsNewerThanLidar': newer, 'lidarSkippedLeak': leaked},
        'published': {str(k): {'m': v[0], 'building': v[1]} for k, v in PUBLISHED.items()},
        'publishedSource': 'Wikipedia, List of tallest buildings in Brisbane (CTBUH heights to architectural top), accessed 2026-10-27',
        'lidarNote': 'BSM_EDGE is a roof-surface reading along the footprint edge. On towers with podiums or setbacks it '
                     'reads lower than the main roof, so OSM height tags and published heights come first.',
    }
    m['character'] = {
        'source': 'Brisbane City Council, City Plan 2014 heritage and character overlays',
        'licence': 'CC BY 4.0', 'datasets': list(BCC_SETS.values()),
        'styleCounts': {k: styles[v] for k, v in ST.items()},
        'note': 'Facade family is chosen from OSM tags, the QRA building class and these overlays. '
                'It is a building type, not a surveyed elevation of each facade.',
    }
    m['bridges'] = {
        'clearanceDatum': f'HAT {HAT_AHD} m AHD (MSQ 2025 tidal planes, Port Office: HAT {HAT_LAT} m, MSL {MSL_LAT} m above LAT)',
        'clearances': {k: {'m': v, 'source': CLEARANCE_SOURCE.get(k, 'MSQ Port Procedures - Brisbane, Oct 2024, air draft table')}
                       for k, v in CLEARANCE.items()},
        'deckDepth': DECK_DEPTH,
        'method': 'Ends sit on the DEM. River spans rise to HAT + clearance + deck depth over the middle of the '
                  f'widest water run and fall at {MAX_GRADE * 100:.1f}% or the grade that lands them on their mapped '
                  'ends. Other bridge and layered ways are solved over the OSM node graph between ground anchors; '
                  f'{raised} overpass points were raised to clear the way underneath, {sstats["lowered"]} points of '
                  'elevated roads were lowered under river spans, and '
                  f'{sstats["atGrade"]} mapped crossings with no ramp in the DEM (steeper than {MAX_RAMP * 100:.0f}%) '
                  'were left at grade.',
        'deckLifts': sstats['deckLifts'],
        'unanchoredPieces': orphans,
    }
    c = m['counts']
    c['buildingsHeightTag'] = hsrc[2]
    c['buildingsPublishedHeight'] = hsrc[4]
    c['buildingsLidarRoofEdge'] = hsrc[3]
    c['buildingsLevelsEstimated'] = hsrc[1]
    c['buildingsDefaultEstimated'] = hsrc[0]
    lim = [x for x in m['limitations'] if not x.startswith((
        'Building height is the OSM', 'OSM layer is not a height', 'No Overture Maps', 'Kangaroo Point Cliffs are not',
        'Building height order', 'Bridge decks are solved', 'Ground is the bare-earth DEM', 'Kangaroo Point Cliffs come',
        'Towers finished after'))]
    lim[1:1] = [
        'Building height order: OSM height tag, then LiDAR roof edge from the QRA footprint that covers the OSM '
        'footprint, then building:levels x 3.2 m, then a class default. The roof edge is the eave on pitched roofs; '
        'ridges above it are drawn from the footprint and marked estimated.',
        'Bridge decks are solved heights. Only the navigation spans named in meta.bridges have a published clearance. '
        f'The {DECK_DEPTH} m deck depth and the overpass clearances are estimates.',
        'Ground is the bare-earth DEM from the 2019 survey. Retaining walls, stairs and podium plazas are smoothed '
        'to the 4 m grid. Sites dug out in 2019 were filled to the surrounding ground (meta.terrain.excavationsFilled); '
        'later earthworks such as the Queen\'s Wharf podium are not in the survey.',
        'Kangaroo Point Cliffs come from the DEM ground heights. There is no separate cliff polygon in OSM.',
        'Towers finished after the OSM extract or missing from it (for example 443 Queen St, 300 George St, '
        'The One, 205 North Quay and the Queen\'s Wharf towers) are not drawn.',
    ]
    m['limitations'] = lim
    if 'tools/enrich_brisbane.py' not in prefix:
        prefix = prefix.replace(
            '// Generated by tools/compile_brisbane_geo.py. Do not hand-edit.',
            '// Generated by tools/compile_brisbane_geo.py, tools/bake_aerial.py and tools/enrich_brisbane.py. Do not hand-edit.')
        prefix = prefix.replace(MARK, '// Ground heights: ' + DEM_ATTRIBUTION + ' (CC BY-SA 4.0).\n'
                                '// City Plan overlays \u00a9 Brisbane City Council (CC BY 4.0).\n' + MARK)
    save_js(DATA_JS, prefix, data)
    json.dump(report, open(REPORT, 'w'), indent=1)
    print(f'wrote {DATA_JS} ({os.path.getsize(DATA_JS) / 1e6:.2f} MB) in {time.time() - t0:.0f} s')


if __name__ == '__main__':
    main()
