// CBD street frontages.
// Building edges come from the OpenStreetMap footprints. Street centrelines are
// CBD_STREETS. Chain wordmarks are original stand-ins in the same colours:
// the photographed burger restaurant, fried-chicken shop, and orange burger
// shop keep their Queen Street addresses and lose the trademark lettering.
// Brisbane City Council places use the council's name and the city's blue and
// gold. The coat of arms is not drawn.
import * as THREE from 'three';
import { CBD_STREETS } from './cbdStreets.js';
import { closestMall } from './brisbaneDetail.js';

const COUNCIL_BLUE = '#004e92';
const COUNCIL_GOLD = '#f2c14b';

// Points are footprint centroids from the 2026-10-23 extract.
// 130 Queen Street is the level-1 burger restaurant in the glass-canopy block.
// 130A is the fried-chicken shop beside it. 127 Queen Street is the orange
// burger shop on the opposite, open-sky side. The ground floor under the
// burger restaurant is the jeweller in the March 2025 street photograph.
// x,z are vertex centroids of the OSM way with that address (2026-10-23 extract).
// 127 Queen Street has no building way. Its point is the midpoint of 125 and 129.
// 130A has no separate way. Its point is 8 m from 130 toward 136, still on that front.
const PLACES = [
  // OSM shop node retained at its mapped location; address confirmed by Apple
  // https://www.apple.com/au/retail/brisbane/ (MacArthur Chambers, 233 Queen St).
  { x:371.82, z:-65.92, name:'APPLE', sub:'MACARTHUR CHAMBERS · 233 QUEEN STREET', bg:'#e8e0d0', fg:'#262523', y:5.6, w:5.4, h:1.0, mark:'word', apple:true },
  { x: 133.66, z: 69.17, name: 'McREBARS', sub: '130 QUEEN STREET', bg: '#d9232a', fg: '#ffc72c', y: 6.7, w: 5.4, h: 1.35, mark: 'rebar' },
  { x: 133.66, z: 69.17, name: 'GIRDER & STONE', sub: 'JEWELLERS', bg: '#161616', fg: '#f4f4f4', y: 3.15, w: 4.6, h: 0.85, mark: 'word' },
  { x: 140.22, z: 64.60, name: 'REBAR FRIED\nCHICKEN', sub: '130A QUEEN STREET', bg: '#c8102e', fg: '#ffffff', y: 4.6, w: 4.2, h: 1.35, mark: 'stripe' },
  { x: 169.72, z: 111.07, name: 'HUNGRY BUNG', sub: '127 QUEEN STREET', bg: '#e87722', fg: '#fff6e8', y: 4.4, w: 5.2, h: 1.2, mark: 'bung' },
  { x: 183.7, z: 69.0, name: "JIMMY'S\nON THE MALL", bg: '#f4efe4', fg: '#1c1a17', y: 4.2, w: 3.6, h: 1.15, mark: 'word' },
  { x: 76.4, z: 115.5, name: 'QUEEN ADELAIDE\nBUILDING', bg: '#efe6d4', fg: '#2c4a38', y: 7.2, w: 5.6, h: 1.2, mark: 'word', heritage: true },
  { x: 105.1, z: 94.0, name: '114 QUEEN', bg: '#efe6d4', fg: '#2c4a38', y: 5.4, w: 3.2, h: 0.7, mark: 'word', heritage: true },
  { x: 109.8, z: 90.0, name: '116 QUEEN', bg: '#efe6d4', fg: '#2c4a38', y: 5.4, w: 3.2, h: 0.7, mark: 'word', heritage: true },
  { x: 114.7, z: 80.1, name: '120 QUEEN', bg: '#efe6d4', fg: '#2c4a38', y: 5.4, w: 3.2, h: 0.7, mark: 'word', heritage: true },
  { x: 173.2, z: -1.4, name: 'BRISBANE ARCADE', sub: '160 QUEEN STREET', bg: '#1f3d32', fg: '#f3ead6', y: 6.4, w: 5.4, h: 1.15, mark: 'word', heritage: true },
  { x: 199.8, z: -20.5, name: '170 QUEEN', bg: '#efe6d4', fg: '#24372c', y: 4.8, w: 3.8, h: 0.8, mark: 'word', heritage: true },
  { x: 159.3, z: 179.1, name: 'UPTOWN', sub: '91 QUEEN STREET', bg: '#1a1d26', fg: '#f7f4ee', y: 8.5, w: 5.2, h: 1.3, mark: 'word' },
  { x: 164.6, z: 186.6, name: 'REBAR FRESH', bg: '#e10600', fg: '#ffffff', y: 4.3, w: 3.8, h: 0.85, mark: 'word' },
  { x: 152.6, z: 172.6, name: 'REBAR MART', bg: '#e10600', fg: '#ffffff', y: 4.3, w: 3.6, h: 0.85, mark: 'word' },
  { x: 159.3, z: 179.1, name: 'REBAR CINEMA', bg: '#141820', fg: '#f2c14b', y: 11.2, w: 4.4, h: 0.8, mark: 'word' },
  { x: 294.6, z: 46.6, name: 'WINTERGARDEN', sub: '171–209 QUEEN STREET', bg: '#1c3d34', fg: '#f3ead6', y: 7.2, w: 6.4, h: 1.25, mark: 'word' },
  { x: 243.1, z: -72.5, name: 'QUEENSPLAZA', sub: '226 QUEEN STREET', bg: '#141414', fg: '#f2c14b', y: 7.4, w: 5.8, h: 1.25, mark: 'word' },
  { x: 243.1, z: -66.5, name: 'DAVID GIRDER', bg: '#111111', fg: '#f7f4ee', y: 4.2, w: 4.4, h: 0.8, mark: 'word' },
  { x: 36.0, z: 231.7, name: 'GIRDER ROAD', sub: '33 QUEEN STREET', bg: '#f6f1e8', fg: '#1a1a1a', y: 4.4, w: 4.6, h: 0.85, mark: 'word' },
  { x: 35.9, z: 149.8, name: 'THE REGENCY', sub: '72 QUEEN STREET', bg: '#143028', fg: '#e7c56a', y: 8.2, w: 4.8, h: 1.15, mark: 'word' },
  { x: 367.8, z: -141.6, name: 'REBAR BANK', sub: '260 QUEEN STREET', bg: '#d5002b', fg: '#ffffff', y: 4.6, w: 4.6, h: 1.05, mark: 'word' },
  { x: 428.3, z: -187.5, name: '300 QUEEN', sub: 'QUEEN STREET', bg: '#8f1d24', fg: '#f7f4ee', y: 6.2, w: 4.2, h: 1.05, mark: 'word' },
  { x: 752.9, z: -390.8, name: 'CUSTOMS HOUSE', sub: '399 QUEEN STREET', bg: '#efe6d4', fg: '#6b3a2a', y: 6.5, w: 5.2, h: 1.05, mark: 'word', heritage: true },
  { x: 292.9, z: 606.8, name: 'THE MANSIONS', sub: '40 GEORGE STREET', bg: '#efe6d4', fg: '#6b3a2a', y: 5.2, w: 4.4, h: 0.95, mark: 'word', heritage: true },
  { x: 256.5, z: 554.6, name: 'HARRIS TERRACE', sub: '46 GEORGE STREET', bg: '#efe6d4', fg: '#6b3a2a', y: 4.6, w: 4.6, h: 0.9, mark: 'word', heritage: true },
  { x: 228.0, z: 693.9, name: '1 WILLIAM STREET', sub: 'QUEENSLAND GOVERNMENT', bg: '#0e3a5d', fg: '#f7f4ee', y: 8.0, w: 6.2, h: 1.2, mark: 'word' },
  { x: -84.6, z: 206.8, name: 'BRISBANE CITY COUNCIL', sub: 'BRISBANE SQUARE\n266 GEORGE STREET', bg: COUNCIL_BLUE, fg: '#ffffff', y: 8.4, w: 7.2, h: 1.7, mark: 'council' },
  { x: -539, z: 251, name: 'STATE LIBRARY', sub: 'OF QUEENSLAND', bg: '#f7f4ee', fg: '#1a1d26', y: 6.5, w: 5.6, h: 1.15, mark: 'word' },
  { x: -634, z: 188, name: 'GALLERY OF\nMODERN ART', bg: '#f7f4ee', fg: '#1a1d26', y: 6.8, w: 5.4, h: 1.25, mark: 'word' },
  { x: -379, z: 644, name: 'QUEENSLAND\nPERFORMING ARTS', bg: '#1a1d26', fg: '#f7f4ee', y: 7.2, w: 6.4, h: 1.3, mark: 'word' },
  { x: 265.8, z: -199.1, name: 'ANZAC SQUARE\nARCADE', bg: '#f4efe4', fg: '#1c1a17', y: 5.2, w: 4.4, h: 1.1, mark: 'word' },
  { x: 239.77, z: 76.65, name: 'BURGER BUNG', sub: '155 QUEEN STREET', bg: '#ffc23d', fg: '#1a1d26', y: 4.5, w: 4.8, h: 1.05, mark: 'bung' },
];

export function signAnchors() {
  return PLACES.map((p) => ({ x: p.x, z: p.z, name: String(p.name).split('\n')[0] }));
}

function streetFlat() {
  const flat = [];
  for (const poly of CBD_STREETS) {
    for (let i = 0; i < poly.length; i++) flat.push(poly[i]);
    flat.push(NaN, NaN);
  }
  return flat;
}

function centroid(ring) {
  let x = 0, z = 0, n = 0;
  for (let i = 0; i < ring.length; i += 2) { x += ring[i]; z += ring[i + 1]; n++; }
  return { x: x / n, z: z / n };
}

function closestPoint(flat, x, z) {
  let best = Infinity;
  let px = x;
  let pz = z;
  for (let i = 0; i < flat.length - 2; i += 2) {
    const ax = flat[i], az = flat[i + 1], bx = flat[i + 2], bz = flat[i + 3];
    if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx) || !Number.isFinite(bz)) continue;
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const qx = ax + dx * t, qz = az + dz * t;
    const d = (x - qx) ** 2 + (z - qz) ** 2;
    if (d < best) { best = d; px = qx; pz = qz; }
  }
  return { d: Math.sqrt(best), x: px, z: pz };
}

function edgeClosest(ring, flat) {
  const pts = [];
  for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
  if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1) pts.pop();
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 2.5) continue;
    let streetD = Infinity;
    let hx = a[0], hz = a[1];
    for (const t of [0.2, 0.5, 0.8]) {
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const hit = closestPoint(flat, x, z);
      if (hit.d < streetD) { streetD = hit.d; hx = hit.x; hz = hit.z; }
    }
    // A long wall may win by under a metre. It may not steal the front from a nearer edge.
    const score = streetD - Math.min(len, 16) * 0.05;
    if (!best || score < best.score) {
      best = {
        x0: a[0], z0: a[1], x1: b[0], z1: b[1],
        mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2,
        len, streetD, score, hit: { x: hx, z: hz, d: streetD },
      };
    }
  }
  return best;
}

function outward(edge) {
  let nx = -(edge.z1 - edge.z0) / edge.len;
  let nz = (edge.x1 - edge.x0) / edge.len;
  const hit = edge.hit;
  if ((hit.x - edge.mx) * nx + (hit.z - edge.mz) * nz < 0) { nx = -nx; nz = -nz; }
  return { nx, nz, yaw: Math.atan2(nx, nz) };
}

function drawSign(place) {
  const w = 512;
  const h = Math.round(512 * (place.h / place.w));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = place.bg;
  g.fillRect(0, 0, w, h);
  if (place.mark === 'stripe') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, h * 0.62, w, h * 0.38);
  }
  if (place.mark === 'council') {
    g.fillStyle = COUNCIL_GOLD;
    g.fillRect(0, 0, w, 14);
    g.fillRect(0, h - 14, w, 14);
    g.fillRect(w * 0.08, h * 0.22, 18, h * 0.42);
    g.fillRect(w * 0.08, h * 0.18, 70, 16);
    g.beginPath();
    g.arc(w * 0.145, h * 0.16, 16, 0, Math.PI * 2);
    g.fill();
  }
  if (place.mark === 'rebar') {
    g.strokeStyle = place.fg;
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.3, h * 0.42);
    g.lineTo(w * 0.5, h * 0.16);
    g.lineTo(w * 0.7, h * 0.42);
    g.stroke();
  }
  if (place.mark === 'bung') {
    g.fillStyle = place.fg;
    g.beginPath();
    g.arc(w * 0.5, h * 0.28, h * 0.16, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = place.mark === 'stripe' ? '#1a1a1a' : place.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = String(place.name).split('\n');
  const sub = place.sub ? String(place.sub).split('\n') : [];
  const all = lines.concat(sub);
  const size = Math.min(h / (all.length * 1.35), w / (Math.max(...all.map((l) => l.length)) * 0.62));
  g.font = `800 ${Math.floor(size)}px 'Arial Black', Arial, sans-serif`;
  const top = h * 0.5 - ((all.length - 1) * size * 1.15) / 2 + (place.mark === 'rebar' || place.mark === 'bung' ? size * 0.25 : 0);
  all.forEach((line, i) => {
    if (i >= lines.length) g.font = `700 ${Math.floor(size * 0.55)}px Arial, sans-serif`;
    g.fillText(line, w / 2, top + i * size * 1.15);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.55,
    emissive: new THREE.Color(place.bg),
    emissiveMap: tex,
    emissiveIntensity: 0.28,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(place.w, place.h, 0.08), mat);
  mesh.castShadow = true;
  return mesh;
}

function addVerandah(group, edge, face) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x2f4a3c, roughness: 0.6 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xefe6d4, roughness: 0.8 });
  const { nx, nz, yaw } = face;
  const ex = (edge.x1 - edge.x0) / edge.len;
  const ez = (edge.z1 - edge.z0) / edge.len;
  const span = Math.min(edge.len, 28);
  const posts = Math.max(2, Math.round(span / 4));
  for (let i = 0; i < posts; i++) {
    const t = (i / (posts - 1) - 0.5) * span;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.3, 6), steel);
    post.position.set(edge.mx + ex * t + nx * 1.15, 1.65, edge.mz + ez * t + nz * 1.15);
    post.castShadow = true;
    group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.16, 0.16), steel);
  beam.position.set(edge.mx + nx * 1.15, 3.35, edge.mz + nz * 1.15);
  beam.rotation.y = yaw;
  group.add(beam);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 0.1, 1.5), cream);
  deck.position.set(edge.mx + nx * 0.9, 6.15, edge.mz + nz * 0.9);
  deck.rotation.y = yaw;
  deck.castShadow = true;
  group.add(deck);
}

function ringContains(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], zi = ring[i + 1], xj = ring[j], zj = ring[j + 1];
    const denom = zj - zi;
    if (!denom) continue;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / denom + xi) inside = !inside;
  }
  return inside;
}

// The sign stays on the way that contains the address. It does not jump to a
// longer wall on a neighbouring building.
function hostBuilding(buildings, x, z) {
  let contained = -1;
  let containedD = Infinity;
  let nearest = -1;
  let nearestD = 14 * 14;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (!b.r || b.r.length < 6) continue;
    const c = centroid(b.r);
    const d2 = (c.x - x) ** 2 + (c.z - z) ** 2;
    if (d2 < nearestD) { nearestD = d2; nearest = i; }
    if (d2 > 90 * 90 || !ringContains(b.r, x, z)) continue;
    if (d2 < containedD) { containedD = d2; contained = i; }
  }
  return contained >= 0 ? contained : nearest;
}

export function dressCbd(group, buildings, mallFlat, hall) {
  const flat = streetFlat();
  let signs = 0;
  let verandahs = 0;
  const verandahed = new Set();

  for (const place of PLACES) {
    const host = hostBuilding(buildings, place.x, place.z);
    if (host < 0) continue;
    const onMall = closestMall(mallFlat, place.x, place.z).d < 50;
    const edge = edgeClosest(buildings[host].r, onMall ? mallFlat : flat);
    if (!edge) continue;
    const face = outward(edge);
    const ex = (edge.x1 - edge.x0) / edge.len;
    const ez = (edge.z1 - edge.z0) / edge.len;
    const along = (place.x - edge.mx) * ex + (place.z - edge.mz) * ez;
    const shift = Math.max(-edge.len * 0.35, Math.min(edge.len * 0.35, along));
    const mesh = drawSign(place);
    mesh.position.set(
      edge.mx + ex * shift + face.nx * 0.55,
      place.y,
      edge.mz + ez * shift + face.nz * 0.55,
    );
    mesh.rotation.y = face.yaw;
    mesh.name = place.name;
    group.add(mesh);
    signs++;
    if (place.apple) {
      // Shallow heritage detailing follows the actual hosting footprint edge.
      // It stays against the wall, outside the playable Queen Street corridor.
      const stone=new THREE.MeshStandardMaterial({color:0xd9cbb4,roughness:.85});
      const glass=new THREE.MeshStandardMaterial({color:0x65848b,roughness:.22,metalness:.28});
      const bay=Math.min(3.6,edge.len/5),width=bay*5;
      const detail=new THREE.Group();
      detail.position.set(edge.mx+face.nx*.18,0,edge.mz+face.nz*.18);detail.rotation.y=face.yaw;
      const add=(x,y,w,h,d,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,0);o.castShadow=true;detail.add(o);};
      for(let i=-2;i<=2;i++){
        add(i*bay,2.65,bay-.5,4.4,.12,glass);
        add(i*bay-bay/2,3.5,.35,6.5,.32,stone);
        add(i*bay,7.6,bay-.7,2.5,.14,glass);
      }
      add(0,5.2,width,.32,.42,stone);add(0,9.2,width+.3,.4,.48,stone);
      group.add(detail);
    }
    if (place.heritage && !verandahed.has(host)) {
      addVerandah(group, edge, face);
      verandahed.add(host);
      verandahs++;
    }
  }

  if (hall && hall.ring) {
    const fx = 0.976;
    const fz = -0.217;
    let front = -1e9;
    for (let i = 0; i < hall.ring.length; i += 2) {
      const p = (hall.ring[i] - hall.cx) * fx + (hall.ring[i + 1] - hall.cz) * fz;
      if (p > front) front = p;
    }
    const council = drawSign({
      name: 'BRISBANE CITY COUNCIL',
      sub: 'CITY HALL',
      bg: COUNCIL_BLUE,
      fg: '#ffffff',
      w: 8.4,
      h: 1.7,
      mark: 'council',
    });
    council.position.set(hall.cx + fx * (front + 1.6), 11.4, hall.cz + fz * (front + 1.6));
    council.rotation.y = Math.atan2(fx, fz);
    council.name = 'COUNCIL CITY HALL';
    group.add(council);
    const museum = drawSign({
      name: 'MUSEUM OF BRISBANE',
      bg: COUNCIL_BLUE,
      fg: COUNCIL_GOLD,
      w: 4.8,
      h: 0.7,
      mark: 'council',
    });
    museum.position.set(hall.cx + fx * (front + 0.8), 5.4, hall.cz + fz * (front + 0.8));
    museum.rotation.y = Math.atan2(fx, fz);
    group.add(museum);
    const square = drawSign({
      name: 'KING GEORGE SQUARE',
      sub: 'BRISBANE CITY COUNCIL',
      bg: COUNCIL_BLUE,
      fg: COUNCIL_GOLD,
      w: 6.4,
      h: 1.35,
      mark: 'council',
    });
    square.position.set(hall.cx + fx * (front + 22), 2.4, hall.cz + fz * (front + 22));
    square.rotation.y = Math.atan2(fx, fz);
    group.add(square);
    signs += 3;
  }

  return { signs, verandahs, extra: 0 };
}
