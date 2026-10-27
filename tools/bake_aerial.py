#!/usr/bin/env python3
"""Drape a real aerial photograph onto a compiled district.

Ground, water and roofs use the photograph. Wall colour is the median pixel
inside each footprint (a top-down photo cannot see facades), unless the
OpenStreetMap way has building:colour or building:material.

Run from the repo root: python3 tools/bake_aerial.py brisbane sydney hongkong
"""
import io
import json
import math
import os
import sys
import traceback
import urllib.request

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
UA = 'BungBuntyRebarWorld/1.0 (local geospatial reconstruction)'
A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)

NAMES = {
    'white': (244, 244, 244), 'black': (28, 28, 28), 'grey': (140, 140, 140),
    'gray': (140, 140, 140), 'silver': (196, 198, 200), 'beige': (226, 210, 184),
    'red': (164, 54, 42), 'green': (72, 122, 72), 'orange': (196, 112, 52),
    'maroon': (122, 42, 48), 'brown': (122, 82, 52), 'blue': (74, 114, 158),
    'yellow': (206, 186, 78), 'darkgrey': (78, 78, 78), 'darkgray': (78, 78, 78),
    'lightgrey': (196, 196, 196), 'lightgray': (196, 196, 196),
}
MATERIALS = {
    'glass': (158, 186, 204), 'brick': (168, 90, 69), 'concrete': (200, 196, 188),
    'cement_block': (194, 184, 168), 'metal': (181, 188, 196), 'wood': (196, 165, 116),
    'timber': (196, 165, 116), 'stone': (186, 176, 160), 'sandstone': (214, 196, 164),
    'plaster': (232, 226, 214), 'copper': (106, 143, 120), 'mud': (150, 120, 90),
}

DISTRICTS = {
    'brisbane': {
        'js': 'src/world/geo/brisbane.data.js',
        'jpg': 'src/world/geo/brisbane.aerial.jpg',
        'osm': '/tmp/bne-full.json',
        'md': 'data/geo/PROVENANCE.md',
        'kind': 'arcgis',
        'export': 'https://spatial-img.information.qld.gov.au/arcgis/rest/services/Basemaps/LatestStateProgram_AllUsers/ImageServer/exportImage',
        'attribution': '© State of Queensland (Department of Natural Resources and Mines, Manufacturing and Regional and Rural Development)',
        'source': 'https://spatial-img.information.qld.gov.au/arcgis/rest/services/Basemaps/LatestStateProgram_AllUsers/ImageServer',
        'long': 2048,
        'tiles': 2,
        'note': 'Queensland public orthophoto for this bbox, draped on the ground, the river and the roofs. The service copyright also names Planet Labs for areas where aerial photography is unavailable.',
    },
    'sydney': {
        'js': 'src/world/geo/sydney.data.js',
        'jpg': 'src/world/geo/sydney.aerial.jpg',
        'osm': '/tmp/syd-osm.json',
        'md': 'data/geo/SYDNEY.md',
        'kind': 'arcgis',
        'export': 'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/export',
        'attribution': '© Department of Customer Service 2020. NSW Imagery is published Creative Commons Attribution 3.0.',
        'source': 'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer',
        'long': 4096,
        'note': 'NSW Spatial Services orthophoto for this bbox, draped on the ground, the bay and the roofs.',
    },
    'hongkong': {
        'js': 'src/world/geo/hongkong.data.js',
        'jpg': 'src/world/geo/hongkong.aerial.jpg',
        'osm': '/tmp/hk-osm.json',
        'md': 'data/geo/HONGKONG.md',
        'kind': 'xyz',
        'template': 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
        'zoom': 16,
        'attribution': 'Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2020), CC BY 4.0. https://s2maps.eu',
        'source': 'https://s2maps.eu',
        'note': 'Sentinel-2 cloudless mosaic, about 10 m ground sample. Individual tower facades are not resolved. Lands Department orthophotos are not copied into this game.',
    },
}


def radii(lat0):
    s = math.sin(math.radians(lat0))
    n = A / math.sqrt(1 - E2 * s * s)
    m = A * (1 - E2) / (1 - E2 * s * s) ** 1.5
    return n, m


def inv(lat0, lon0, x, z):
    n, m = radii(lat0)
    north = -z
    lat = lat0 + (north / m) * 180 / math.pi
    lon = lon0 + (x / (n * math.cos(math.radians(lat0)))) * 180 / math.pi
    return lat, lon


def fetch(url, timeout=180):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def load_js(path):
    raw = open(path, encoding='utf-8').read()
    i = raw.index('{')
    body = raw[i:].strip()
    if body.endswith(';'):
        body = body[:-1]
    return raw[:i], json.loads(body)


def save_js(path, prefix, data):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(prefix)
        json.dump(data, f, separators=(',', ':'))
        f.write(';\n')


def grid_bbox(data):
    o = data['origin']
    g = data['grid']
    min_x, min_z = g['minX'], g['minZ']
    span_x, span_z = g['w'] * g['cell'], g['h'] * g['cell']
    max_x, max_z = min_x + span_x, min_z + span_z
    corners = [inv(o['lat'], o['lon'], x, z) for x, z in (
        (min_x, min_z), (max_x, min_z), (min_x, max_z), (max_x, max_z),
    )]
    south = min(p[0] for p in corners)
    north = max(p[0] for p in corners)
    west = min(p[1] for p in corners)
    east = max(p[1] for p in corners)
    return min_x, min_z, span_x, span_z, south, west, north, east


def export_jpeg(cfg, south, west, north, east, width, height):
    bbox = f'{west:.8f},{south:.8f},{east:.8f},{north:.8f}'
    url = f'{cfg["export"]}?bbox={bbox}&bboxSR=4326&size={width},{height}&format=jpg&f=image'
    blob = fetch(url)
    if blob[:2] != b'\xff\xd8':
        raise RuntimeError(blob[:240].decode('utf-8', 'replace'))
    return blob


def download_arcgis(cfg, south, west, north, east, span_x, span_z):
    tiles = cfg.get('tiles', 1)
    long_px = cfg['long']

    def size_for(sx, sz):
        if sx >= sz:
            w, h = long_px, max(2, round(long_px * sz / sx))
        else:
            h, w = long_px, max(2, round(long_px * sx / sz))
        return min(w, 4096), min(h, 4096)

    if tiles == 1:
        w, h = size_for(span_x, span_z)
        print(f'  export {w}x{h}')
        return export_jpeg(cfg, south, west, north, east, w, h)

    lat_steps = [south + (north - south) * i / tiles for i in range(tiles + 1)]
    lon_steps = [west + (east - west) * i / tiles for i in range(tiles + 1)]
    rows = []
    for row in range(tiles):
        north_i = lat_steps[tiles - row]
        south_i = lat_steps[tiles - row - 1]
        row_imgs = []
        for col in range(tiles):
            west_i = lon_steps[col]
            east_i = lon_steps[col + 1]
            w, h = size_for(span_x / tiles, span_z / tiles)
            print(f'  tile {row},{col} export {w}x{h}')
            blob = export_jpeg(cfg, south_i, west_i, north_i, east_i, w, h)
            im = Image.open(io.BytesIO(blob)).convert('RGB')
            if im.size != (w, h):
                im = im.resize((w, h), Image.Resampling.BILINEAR)
            row_imgs.append(im)
        rows.append(row_imgs)
    width = sum(im.size[0] for im in rows[0])
    height = sum(row[0].size[1] for row in rows)
    canvas = Image.new('RGB', (width, height))
    y = 0
    for row_imgs in rows:
        x = 0
        for im in row_imgs:
            canvas.paste(im, (x, y))
            x += im.size[0]
        y += row_imgs[0].size[1]
    buf = io.BytesIO()
    canvas.save(buf, format='JPEG', quality=84)
    return buf.getvalue()


def merc_pixel(lat, lon, z):
    n = 256 * (2 ** z)
    x = (lon + 180.0) / 360.0 * n
    lr = math.radians(lat)
    y = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n
    return x, y


def download_xyz(cfg, south, west, north, east):
    z = cfg['zoom']
    x0, y0 = merc_pixel(north, west, z)
    x1, y1 = merc_pixel(south, east, z)
    tx0, ty0 = int(x0 // 256), int(y0 // 256)
    tx1, ty1 = int(x1 // 256), int(y1 // 256)
    canvas = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = cfg['template'].format(z=z, y=ty, x=tx)
            blob = fetch(url, timeout=60)
            if blob[:2] != b'\xff\xd8':
                raise RuntimeError(f'tile {z}/{tx}/{ty} was not a jpeg')
            tile = Image.open(io.BytesIO(blob)).convert('RGB')
            canvas.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
            print(f'  tile {z}/{tx}/{ty}')
    left = int(round(x0 - tx0 * 256))
    top = int(round(y0 - ty0 * 256))
    right = int(round(x1 - tx0 * 256))
    bottom = int(round(y1 - ty0 * 256))
    crop = canvas.crop((left, top, max(left + 2, right), max(top + 2, bottom)))
    buf = io.BytesIO()
    crop.save(buf, format='JPEG', quality=86)
    return buf.getvalue()


def inside(x, z, ring):
    n = len(ring)
    c = False
    j = n - 1
    for i in range(n):
        xi, zi = ring[i]
        xj, zj = ring[j]
        if (zi > z) != (zj > z):
            denom = zj - zi
            if denom != 0 and x < (xj - xi) * (z - zi) / denom + xi:
                c = not c
        j = i
    return c


def parse_colour(raw):
    if not raw:
        return None
    s = str(raw).split(';')[0].strip().lower()
    if s.startswith('#'):
        h = s[1:]
        if len(h) == 3:
            h = ''.join(ch * 2 for ch in h)
        if len(h) == 6:
            try:
                return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
            except ValueError:
                return None
    return NAMES.get(s)


def osm_tags(path, lat0, lon0):
    if not path or not os.path.exists(path):
        print('  no osm extract for wall tags', path)
        return []
    els = json.load(open(path, encoding='utf-8')).get('elements') or []
    out = []
    for e in els:
        t = e.get('tags') or {}
        if 'building' not in t and 'building:part' not in t:
            continue
        colour = parse_colour(t.get('building:colour'))
        material = MATERIALS.get((t.get('building:material') or '').split(';')[0].strip().lower())
        if not colour and not material:
            continue
        g = e.get('geometry') or []
        if len(g) < 3:
            continue
        pts = [inv_xy(lat0, lon0, p['lat'], p['lon']) for p in g]
        cx = sum(p[0] for p in pts) / len(pts)
        cz = sum(p[1] for p in pts) / len(pts)
        out.append((cx, cz, colour, material))
    print('  tagged facades', len(out))
    return out


def inv_xy(lat0, lon0, lat, lon):
    n, m = radii(lat0)
    x = math.radians(lon - lon0) * n * math.cos(math.radians(lat0))
    north = math.radians(lat - lat0) * m
    return x, -north


def nearest_tag(tags, x, z):
    best = None
    best_d = 6.0 * 6.0
    for tx, tz, colour, material in tags:
        d = (tx - x) ** 2 + (tz - z) ** 2
        if d < best_d:
            best_d = d
            best = (colour, material)
    return best


def median(samples):
    def lum(p):
        return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
    bright = [p for p in samples if lum(p) >= 34]
    use = bright if len(bright) >= 6 else samples
    mid = len(use) // 2
    r = sorted(p[0] for p in use)[mid]
    g = sorted(p[1] for p in use)[mid]
    b = sorted(p[2] for p in use)[mid]
    return (r << 16) | (g << 8) | b


def paint_walls(data, img, min_x, min_z, span_x, span_z, tags):
    pix = img.load()
    w, h = img.size
    photo = colour_n = material_n = 0
    for b in data['buildings']:
        ring = [(b['r'][i], b['r'][i + 1]) for i in range(0, len(b['r']), 2)]
        if len(ring) >= 2 and ring[0] == ring[-1]:
            ring = ring[:-1]
        if len(ring) < 3:
            continue
        cx = sum(p[0] for p in ring) / len(ring)
        cz = sum(p[1] for p in ring) / len(ring)
        tag = nearest_tag(tags, cx, cz)
        if tag and tag[0]:
            r, g, bl = tag[0]
            b['wc'] = (r << 16) | (g << 8) | bl
            b['ws'] = 2
            colour_n += 1
            continue
        if tag and tag[1]:
            r, g, bl = tag[1]
            b['wc'] = (r << 16) | (g << 8) | bl
            b['ws'] = 1
            material_n += 1
            continue
        xs = [p[0] for p in ring]
        zs = [p[1] for p in ring]
        px0 = max(0, int((min(xs) - min_x) / span_x * (w - 1)))
        px1 = min(w - 1, int((max(xs) - min_x) / span_x * (w - 1)))
        py0 = max(0, int((min(zs) - min_z) / span_z * (h - 1)))
        py1 = min(h - 1, int((max(zs) - min_z) / span_z * (h - 1)))
        step = 1 if (px1 - px0) * (py1 - py0) < 80 else 2
        samples = []
        for py in range(py0, py1 + 1, step):
            z = min_z + py / (h - 1) * span_z
            for px in range(px0, px1 + 1, step):
                x = min_x + px / (w - 1) * span_x
                if inside(x, z, ring):
                    samples.append(pix[px, py])
        if not samples:
            px = min(w - 1, max(0, int((cx - min_x) / span_x * (w - 1))))
            py = min(h - 1, max(0, int((cz - min_z) / span_z * (h - 1))))
            samples.append(pix[px, py])
        b['wc'] = median(samples)
        b['ws'] = 0
        photo += 1
    return photo, colour_n, material_n


def write_note(md_path, cfg, meta):
    if not os.path.exists(md_path):
        return
    text = open(md_path, encoding='utf-8').read()
    block = [
        '## Aerial colour',
        '',
        cfg['note'],
        '',
        f'- Attribution: {cfg["attribution"]}',
        f'- Source: {cfg["source"]}',
        f'- Image: `{os.path.basename(cfg["jpg"])}`, {meta["width"]} by {meta["height"]} pixels, about {meta["metresPerPixel"]} m per pixel.',
        '- Ground, water and roofs show this photograph. Flat road and park colours are not drawn over it.',
        f'- Wall colour from the photograph inside the footprint: {meta["wallsPhoto"]}.',
        f'- Wall colour from an OSM `building:colour` tag: {meta["wallsColourTag"]}.',
        f'- Wall colour from an OSM `building:material` tag: {meta["wallsMaterialTag"]}. A material tag is a class, not a measured paint colour.',
        '- A top-down photograph does not show facades. Wall colour is the roof colour from that photograph except where a tag replaces it.',
        '',
    ]
    section = '\n'.join(block)
    mark = '## Aerial colour'
    if mark in text:
        text = text[:text.index(mark)].rstrip() + '\n\n' + section
    else:
        text = text.rstrip() + '\n\n' + section
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(text)


def bake(name):
    cfg = DISTRICTS[name]
    js_path = os.path.join(ROOT, cfg['js'])
    jpg_path = os.path.join(ROOT, cfg['jpg'])
    print('bake', name)
    prefix, data = load_js(js_path)
    min_x, min_z, span_x, span_z, south, west, north, east = grid_bbox(data)
    print(f'  bbox {south:.5f},{west:.5f} .. {north:.5f},{east:.5f}  {span_x:.0f}x{span_z:.0f} m')
    if cfg['kind'] == 'arcgis':
        blob = download_arcgis(cfg, south, west, north, east, span_x, span_z)
    else:
        blob = download_xyz(cfg, south, west, north, east)
    img = Image.open(io.BytesIO(blob)).convert('RGB')
    img.save(jpg_path, format='JPEG', quality=82, optimize=True)
    print('  wrote', jpg_path, os.path.getsize(jpg_path), 'px', img.size)
    tags = osm_tags(cfg['osm'], data['origin']['lat'], data['origin']['lon'])
    photo, colour_n, material_n = paint_walls(data, img, min_x, min_z, span_x, span_z, tags)
    meta = {
        'file': os.path.basename(jpg_path),
        'attribution': cfg['attribution'],
        'source': cfg['source'],
        'metresPerPixel': round(max(span_x, span_z) / max(img.size), 3),
        'width': img.size[0],
        'height': img.size[1],
        'wallsPhoto': photo,
        'wallsColourTag': colour_n,
        'wallsMaterialTag': material_n,
        'note': cfg['note'],
    }
    data['aerial'] = meta
    limits = data.setdefault('meta', {}).setdefault('limitations', [])
    line = 'Ground, water and roofs are the aerial image named in aerial. Wall colours are that image\'s roof colour, or an OSM colour/material tag when one is on the way. Facades are not a street-level survey.'
    if line not in limits:
        limits.append(line)
    save_js(js_path, prefix, data)
    write_note(os.path.join(ROOT, cfg['md']), cfg, meta)
    print(f'  walls photo {photo} colour-tag {colour_n} material-tag {material_n}')


def lift_shadows(img, gamma):
    # Opens the black of building shadows so a street is visible. Hue stays the photograph's.
    lut = [min(255, int(round((i / 255) ** gamma * 255))) for i in range(256)]
    return img.point(lut * 3)


def restyle(name, gamma=0.55):
    cfg = DISTRICTS[name]
    js_path = os.path.join(ROOT, cfg['js'])
    jpg_path = os.path.join(ROOT, cfg['jpg'])
    prefix, data = load_js(js_path)
    if data.get('aerial', {}).get('shadowGamma'):
        print(name, 'shadows already lifted')
        return
    img = lift_shadows(Image.open(jpg_path).convert('RGB'), gamma)
    img.save(jpg_path, format='JPEG', quality=84, optimize=True)
    min_x, min_z, span_x, span_z, *_ = grid_bbox(data)
    tags = osm_tags(cfg['osm'], data['origin']['lat'], data['origin']['lon'])
    photo, colour_n, material_n = paint_walls(data, img, min_x, min_z, span_x, span_z, tags)
    data['aerial']['shadowGamma'] = gamma
    data['aerial']['wallsPhoto'] = photo
    data['aerial']['wallsColourTag'] = colour_n
    data['aerial']['wallsMaterialTag'] = material_n
    data['aerial']['note'] = (
        cfg['note']
        + f' A gamma of {gamma} is applied so shadowed streets are not black. The hues are still the photograph.'
    )
    save_js(js_path, prefix, data)
    print(f'  restyle {name} walls photo {photo} colour {colour_n} material {material_n} bytes {os.path.getsize(jpg_path)}')


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--restyle':
        names = sys.argv[2:] or list(DISTRICTS)
        for name in names:
            try:
                restyle(name)
            except Exception:
                print('FAIL', name)
                traceback.print_exc()
                return 1
        return 0
    names = sys.argv[1:] or list(DISTRICTS)
    for name in names:
        try:
            bake(name)
        except Exception:
            print('FAIL', name)
            traceback.print_exc()
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
