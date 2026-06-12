// All six zones of Rebar World, built with ZoneKit.
//   Blue Mode:  Bung Mansion Hub, Brisbane Rebar District, Sydney Staging Zone
//   Red Mode:   Hong Kong Neon Rain City, Shenzhen Cyber Rebar Core, Rebar Void
import * as THREE from 'three';
import { mat, rng, cyl, sphere, box as mkBox, texMat, pavingTexture, terminalFloorTexture } from '../core/utils.js';
import { ZoneKit } from './ZoneKit.js';
import { state, bus, addCoins } from '../core/state.js';
import { buildTrolley, buildRebar, buildBurger } from '../entities/models.js';
import { GaborChase, MegaForeheadMachine } from '../systems/BossEvents.js';

export const ZONE_INFO = {
  mansion:  { name: 'BUNG MANSION HUB',          mode: 'BLUE MODE', desc: 'Home base. Garage, Rebar Lab, Ching, shop, trophy room.' },
  brisbane: { name: 'BRISBANE REBAR DISTRICT',   mode: 'BLUE MODE', desc: 'Sunny construction playground. First portals, first pests.' },
  sydney:   { name: 'SYDNEY STAGING ZONE',       mode: 'BLUE MODE', desc: 'Airport terminal. Travel gates, conveyors, the Passport.' },
  hongkong: { name: 'HONG KONG NEON RAIN CITY',  mode: 'RED MODE',  desc: 'Rainy vertical cyber city. Rooftop chains, Typhoon Blobs.' },
  shenzhen: { name: 'SHENZHEN CYBER REBAR CORE', mode: 'RED MODE',  desc: 'Endgame LED megacity. Corruption towers. THE FOREHEAD.' },
  void:     { name: 'REBAR VOID',                mode: 'RED MODE',  desc: 'Floating portal dimension. Score attack heaven.' },
};

// ============================================================
// 1. BUNG MANSION HUB
// ============================================================
function buildMansion(game) {
  const Z = new ZoneKit(game, 'mansion', 'mansion');
  Z.sky(0x8fc8e8, 0x9fd2ec, 60, 220, 0xbfe3ff, 0x4a7a3a, 0.9, 0xfff2d9, 1.6, new THREE.Vector3(40, 80, 30));

  // Lawn + driveway
  Z.ground(150, 150, mat(0x4e9444, { roughness: 1 }));
  Z.plate(0, 0, 35, 10, 60, mat(0x9a958c, { roughness: 0.9 }));

  // ---- Mansion structure (3 storeys + roof launch platform) ----
  const wallMat = mat(0xe8dcc8, { roughness: 0.9 });
  const floorMat = mat(0xcdbfa4, { roughness: 0.8 });
  Z.box(0, 0, -10, 36, 0.6, 24, mat(0xb9ab8e, { roughness: 0.85 }));     // plinth
  // Back & side walls (ground floor)
  Z.box(0, 0.6, -21.4, 36, 5, 1, wallMat);
  Z.box(-17.5, 0.6, -10, 1, 5, 23, wallMat);
  Z.box(17.5, 0.6, -10, 1, 5, 23, wallMat);
  // Front pillars
  for (const px of [-15, -5, 5, 15]) {
    Z.box(px, 0.6, 1, 1.2, 5, 1.2, mat(0xf2e9d8, { roughness: 0.7 }));
  }
  // Floor 2 + 3 + roof slabs
  Z.box(0, 5.6, -10, 36, 0.6, 24, floorMat);
  Z.box(0, 11.2, -10, 36, 0.6, 24, floorMat);
  Z.box(0, 16.8, -10, 38, 0.6, 26, mat(0x8e836e, { roughness: 0.8 }));   // roof platform
  // Floor 2/3 safety rails (back)
  Z.box(0, 6.2, -21.6, 36, 1, 0.4, wallMat);
  Z.box(0, 11.8, -21.6, 36, 1, 0.4, wallMat);

  // Exterior switchback ramps up the east face: lawn → floor 2 → floor 3 → roof.
  // (Interior ramps would pierce the floor slabs, so circulation is outside.)
  const rampM = mat(0xb0a78f, { roughness: 0.85 });
  Z.ramp(21, 0, 8, 12, 5, 6.2, Math.PI, rampM, false);      // lawn z=14 → y6.2 at z=2
  Z.box(20.5, 5.6, -1, 7, 0.6, 6, floorMat);                 // landing → floor 2
  Z.ramp(21, 6.2, -10, 12, 5, 5.6, Math.PI, rampM, false);   // z=-4 → y11.8 at z=-16
  Z.box(20.5, 11.2, -19, 7, 0.6, 6, floorMat);               // landing → floor 3
  Z.ramp(21, 11.8, -10, 12, 5, 5.6, 0, rampM, false);        // z=-16 → y17.4 at z=-4
  Z.box(20.5, 16.8, -1, 7, 0.6, 8, floorMat);                // landing → roof

  // Grapple points up the front of the mansion
  Z.grapple(-10, 8, 1);
  Z.grapple(10, 13.5, 1);
  Z.grapple(0, 19, -2);

  // ---- Garage (west annex) with the golden trolley ----
  Z.box(-30, 0, -6, 14, 0.4, 16, mat(0x7d7d85, { roughness: 0.7 }));
  Z.box(-30, 0.4, -13.6, 14, 4, 0.8, mat(0x6b6b73, { roughness: 0.8 }));
  Z.box(-36.6, 0.4, -6, 0.8, 4, 16, mat(0x6b6b73, { roughness: 0.8 }));
  Z.neonSign(-30, 5, -13, 8, 1, 0xffc23d);
  const displayTrolley = buildTrolley();
  displayTrolley.position.set(-30, 0.4, -6);
  displayTrolley.rotation.y = 0.6;
  Z.group.add(displayTrolley);
  Z.interact(-30, 0.4, -6, '<b>[E]</b> GOLDEN JAMES REBAR TROLLEY', () => {
    if (!state.flags.trolleyUnlocked) {
      state.flags.trolleyUnlocked = true;
      game.audio.sfx('unlock');
      game.toast('JAMES REBAR TROLLEY UNLOCKED — PRESS T TO SUMMON', 'blue');
      game.dialogue.conversation([
        ['ching', 'Golden trolley systems online. Press T to summon it, E to mount, SHIFT to boost.'],
        ['bung', 'One of humanity\'s greatest inventions. Do not question the trolley.'],
      ]);
    } else {
      game.say('bung', 'The trolley never lies, mate.');
    }
  }, 4);

  // ---- Rebar Lab (east annex behind mansion) ----
  Z.box(30, 0, -16, 14, 0.4, 14, mat(0x2a3038, { metalness: 0.5, roughness: 0.5 }));
  Z.box(30, 0.4, -22.6, 14, 4.5, 0.8, mat(0x39414d, { metalness: 0.6, roughness: 0.4 }));
  Z.box(36.6, 0.4, -16, 0.8, 4.5, 14, mat(0x39414d, { metalness: 0.6, roughness: 0.4 }));
  Z.neonSign(30, 5.2, -22, 9, 1, 0x2ee6ff);
  // Lab gear
  for (let i = 0; i < 3; i++) {
    const tank = cyl(0.8, 0.8, 2.6, mat(0x2ee6ff, { transparent: true, opacity: 0.4, emissive: 0x0a4a55, metalness: 0.3 }), 10);
    tank.position.set(26 + i * 4, 1.7, -20);
    Z.group.add(tank);
    const r = buildRebar();
    r.position.set(26 + i * 4, 1.4, -20);
    Z.group.add(r);
    Z.updaters.push((dt, t) => { r.rotation.y = t * (0.5 + i * 0.3); });
  }
  Z.trigger(new THREE.Vector3(30, 1, -16), 5, () => {
    bus.emit('qe', { type: 'reach', target: 'rebarlab' });
    if (!state.flags.labSeen) { state.flags.labSeen = true; game.toast('REBAR LAB ACCESSED', 'blue'); }
  }, false, 8);

  // ---- Trophy room (floor 2) ----
  for (let i = 0; i < 5; i++) {
    const plinth = Z.box(-12 + i * 6, 6.2, -16, 1.6, 1.2, 1.6, mat(0x39414d, { metalness: 0.7, roughness: 0.3 }));
    const trophy = i === 2 ? buildBurger() : buildRebar();
    trophy.position.set(-12 + i * 6, 7.6, -16);
    trophy.scale.setScalar(0.8);
    Z.group.add(trophy);
    Z.updaters.push((dt, t) => { trophy.rotation.y = t; });
  }
  Z.neonSign(0, 9.5, -21, 12, 0.8, 0xffc23d);

  // ---- NPCs & services ----
  Z.npc('ching', 6, 0, 6, Math.PI);
  Z.interact(6, 0, 6, '<b>[E]</b> Talk to Ching', () => {
    bus.emit('qe', { type: 'talk', target: 'ching' });
    const lines = [
      [['ching', 'Bung, stop eating burgers and collect the rebars.'],
       ['bung', 'I can do both. I am a professional.']],
      [['ching', 'The portal field is unstable. Aim properly this time.']],
      [['ching', 'Rebar World needs you. Somehow.']],
      [['ching', 'Check the Deployment Board when you are ready to travel.']],
    ];
    game.dialogue.conversation(lines[Math.floor(Math.random() * lines.length)]);
  }, 3.5);

  Z.exchangeKiosk(-8, 0, 10, 0.4);
  Z.deploymentBoard(-16, 0, 6, 0.7);

  // ---- Collectibles ----
  const rebarSpots = [[12, 0, 14], [-20, 0, 20], [30, 0.4, -12], [-30, 0.4, -2], [0, 6.2, -6]];
  for (const [x, y, z] of rebarSpots) Z.rebar(x, y, z);
  const coinSpots = [[18, 0, 18], [-14, 0, 24], [8, 6.2, -14], [-8, 11.8, -12], [0, 17.4, -10], [26, 0, 20], [-26, 0, 14], [34, 0.4, -20]];
  for (const [x, y, z] of coinSpots) Z.coin(x, y, z);
  Z.addCollectible('phone', new THREE.Vector3(12, 18.2, -16)); // Titanium S24 on the roof

  // ---- Trolley training course on the lawn ----
  const ringDefs = [
    [0, 2.2, 45, 0],
    [-25, 2.2, 38, 0.7],
    [-42, 2.2, 12, 1.4],
    [-38, 2.2, -20, 2.2],
    [-15, 2.6, -38, 2.6],
  ];
  for (const [x, y, z, ry] of ringDefs) Z.portal('ring', x, y, z, ry);
  Z.ramp(20, 0, 42, 9, 4, 3.2, Math.PI / 2, mat(0xd9763a, { roughness: 0.7 }), true);
  Z.portal('ring', 33, 4.5, 42, Math.PI / 2); // ring after the ramp jump

  // A couple of free portals to play with
  Z.portal('bronze', 0, 4.5, 32, 0);
  Z.portal('bronze', -10, 20.2, -10, 0.4); // jump through it from the roof

  // ---- Props: the mansion grounds are rebar-obsessed ----
  Z.rebarStack(14, 0, 10, 0.4);
  Z.rebarStack(-24, 0, 26, 1.2);
  Z.rebarStack(36, 0.4, -16, 0.8);
  Z.warnSign(24, 38, 0.3);            // near the ramp
  Z.warnSign(-6, 28, -0.2);
  for (let i = 0; i < 5; i++) Z.cone(17 + i * 1.4, 46);  // ramp run-up cones
  Z.fuelStation(28, 22, -0.6);        // near the garage side
  Z.neonArrow(0, 1.6, 38, 0, 0xffc23d);   // points at the training rings
  Z.neonArrow(-20, 1.6, 40, 0.7, 0xffc23d);

  // ---- BUNG TEST PADDOCK (south lawn) ----
  // Verification lane for portals, rebars, trolley boost, grapple and chains.
  Z.testPaddock(40, 58);
  Z.neonSign(40, 6.5, 44, 12, 1.4, 0x2ee6ff);
  Z.interact(19, 0, 58, '<b>[E]</b> Read sign: BUNG TEST PADDOCK', () => {
    game.dialogue.conversation([
      ['bung', 'The Test Paddock. Where physics goes to apologise.'],
      ['ching', 'Walk, jump, grapple, and boost through the portals. The rebar line tests pickups.'],
    ]);
  }, 4);

  Z.spawn.set(0, 0.7, 22);
  return Z;
}

// ============================================================
// 2. BRISBANE REBAR DISTRICT
// ============================================================
function buildBrisbane(game) {
  const Z = new ZoneKit(game, 'brisbane', 'brisbane');
  Z.sky(0x7ec4ea, 0x9ed4ee, 80, 320, 0xcfeaff, 0x6a6a52, 1.0, 0xfff2cf, 1.7, new THREE.Vector3(60, 100, 40));

  Z.ground(300, 300, mat(0x8a8f7a, { roughness: 1 }));
  // Perimeter roads (the Gabor chase loop) — asphalt
  const road = mat(0x3a3d42, { roughness: 0.95 });
  Z.plate(70, 0, 0, 14, 290, road);
  Z.plate(-70, 0, 0, 14, 290, road);
  Z.plate(0, 0, 70, 290, 14, road);
  Z.plate(0, 0, -70, 290, 14, road);
  // ---- THE REBAR MALL: Queen Street-inspired pedestrian boulevard ----
  // Wide tiled walking street running north–south, crossed by a tiled plaza.
  const paving = texMat('paving', pavingTexture(20), { roughness: 0.75 });
  Z.plate(0, 0.02, 0, 26, 290, paving);
  Z.plate(0, 0.02, 0, 290, 22, paving);

  // ---- CBD towers around the mall (tall, so the mall feels enclosed) ----
  const rand = rng(7707);
  const palette = [0xc9b8a0, 0xa8b8c2, 0xd9c08a, 0x9aa88f, 0xc2a8a0, 0xb8c9d4];
  const blocks = [[-45, -45], [-45, 45], [45, -45], [45, 45], [-110, -40], [-110, 40], [110, -40], [110, 40], [-40, -110], [40, -110], [-40, 110], [40, 110], [110, 110], [-110, -110], [110, -110], [-110, 110]];
  let bi = 0;
  for (const [bx, bz] of blocks) {
    const n = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const w = 12 + rand() * 14, d = 12 + rand() * 14;
      const inner = Math.abs(bx) <= 45 && Math.abs(bz) <= 45;
      const h = inner ? 16 + rand() * 26 : 8 + rand() * 22; // taller near the mall = CBD canyon
      const x = bx + (rand() - 0.5) * 16, z = bz + (rand() - 0.5) * 16;
      Z.building(x, z, w, h, d, palette[bi++ % palette.length], { grapple: h > 14, windowGlow: 0.3 });
      if (rand() < 0.4) Z.coin(x, h, z); // rooftop coins
      if (rand() < 0.3) Z.rebar(x + 3, h, z + 3);
    }
  }

  // ---- QUEEN STREET-INSPIRED MALL DRESSING ----
  // Shopfront strips lining the walkway (facing inward, leaving road gaps)
  const shops = [
    [-17, -52, 'L', 0x44b04a], [-17, -40, 'L', 0xd9763a], [-17, -28, 'L', 0x35588a],
    [-17, 28, 'L', 0xb04a8f], [-17, 40, 'L', 0xd9a13d], [-17, 52, 'L', 0x4a8fb0],
    [17, -52, 'R', 0xc0392b], [17, -40, 'R', 0x8a6a48], [17, -28, 'R', 0x3a7d52],
    [17, 28, 'R', 0xd92f2f], [17, 40, 'R', 0x6b4a8a], [17, 52, 'R', 0x2a9d8f],
  ];
  for (const [sx, sz, side, col] of shops) {
    Z.shopfront(sx, sz, side === 'L' ? Math.PI / 2 : -Math.PI / 2, 10, palette[(sz * 7 & 7) % palette.length], col);
  }
  // McRebar + Burger Bung anchor stores (parody fast food, glowing signs)
  Z.shopfront(-17, 14, Math.PI / 2, 12, 0xd92f2f, 0xffc23d, 9);
  Z.textSign(-15.6, 5.6, 14, Math.PI / 2, 'McREBAR', { bg: '#d92f2f', fg: '#ffe9a8', w: 6, h: 1.4, glow: true });
  Z.shopfront(17, 14, -Math.PI / 2, 12, 0xffc23d, 0xd92f2f, 9);
  Z.textSign(15.6, 5.6, 14, -Math.PI / 2, 'BURGER BUNG', { bg: '#ffc23d', fg: '#1a1d26', w: 6.5, h: 1.4, glow: true });
  // Golden trolley rental station
  Z.textSign(-13, 2.6, -14, Math.PI / 2, 'GOLDEN TROLLEY RENTAL\n(BUNG HAS THE ONLY ONE)', { bg: '#ffe9a8', fg: '#7a5230', w: 5, h: 1.6, post: true });
  const rentalTrolley = buildTrolley();
  rentalTrolley.position.set(-14.5, 0, -18); rentalTrolley.rotation.y = 0.7;
  rentalTrolley.scale.setScalar(0.85);
  Z.group.add(rentalTrolley);

  // Shade sails marching down the centre of the mall (the QSM signature)
  for (const sz of [-44, -18, 18, 44]) Z.shadeSail(0, sz, 11 + (sz % 3));
  // Mall furniture: benches, planters, bollards, lamps, bins
  for (const sz of [-58, -34, -24, 24, 34, 58]) {
    Z.bench(-9, sz, Math.PI / 2);
    Z.bench(9, sz, -Math.PI / 2);
    Z.planterBox(-9, sz + 5);
    Z.planterBox(9, sz - 5);
  }
  for (const sz of [-62, -36, 36, 62]) { Z.streetLamp(-11, sz); Z.streetLamp(11, sz); }
  for (let i = 0; i < 6; i++) { Z.bollard(-13 + i * 5.2, 64); Z.bollard(-13 + i * 5.2, -64); }
  Z.binProp(-10, -46); Z.binProp(10, 46); Z.binProp(-10, 20);
  // Kiosks + banners + directory + fountain plaza at the crossing
  Z.mallKiosk(-8, -8, 0x44b04a);
  Z.mallKiosk(8, 8, 0xd9763a);
  Z.fountain(0, -22);
  Z.directoryBoard(-6, 30, 0.5);
  Z.mallBanner(0, -38, 0, 0x2ee6ff);
  Z.mallBanner(0, 38, 0, 0xffc23d);
  // Busker corner — tiny stage + speaker
  Z.box(12, 0, -34, 4, 0.4, 4, mat(0x8a6a48, { roughness: 0.9 }));
  Z.box(13.4, 0.4, -35.2, 0.7, 1.1, 0.7, mat(0x16181d, { roughness: 0.6 }));
  // Pedestrian crowd strolling the mall
  Z.pedestrians(0, -40, 18, 44, 7, 31);
  Z.pedestrians(0, 40, 18, 44, 7, 32);
  // Funny canon signage
  Z.textSign(0, 3.4, 66, 0, 'BUNG-APPROVED WALKWAY', { bg: '#35c5f0', fg: '#1a1d26', w: 6, h: 1, post: true });
  Z.textSign(-5, 2.8, 44, 0, 'TROLLEY BOOST PROHIBITED\n(BUNG DISAGREES)', { bg: '#f4f1e8', fg: '#d12c47', w: 4.4, h: 1.5, post: true });
  Z.textSign(13, 2.8, -28, -Math.PI / 2, 'REBAR SALE TODAY', { bg: '#ffc23d', fg: '#1a1d26', w: 4, h: 1, post: true });
  Z.textSign(0, 2.6, -10, 0, 'DO NOT QUESTION THE TROLLEY', { bg: '#16181d', fg: '#ffc23d', w: 5.5, h: 0.9, post: true, glow: true });
  Z.textSign(6, 3.2, 30, Math.PI, 'GABOR SCOOTER ACTIVITY REPORTED', { bg: '#d12c47', fg: '#ffffff', w: 6, h: 0.9, post: true, glow: true });

  // ---- Construction zone (NE) — rebar heaven ----
  const conMat = mat(0xd9763a, { roughness: 0.8 });
  Z.box(95, 0, 95, 30, 1, 30, mat(0x9a8468, { roughness: 1 }));
  // Crane
  Z.box(95, 1, 95, 3, 34, 3, mat(0xe8b820, { roughness: 0.6 }));
  Z.box(95, 33, 107, 2, 2, 28, mat(0xe8b820, { roughness: 0.6 }), { collide: false });
  Z.grapple(95, 36, 112);
  // Scaffold platforms
  Z.box(85, 1, 85, 10, 6, 4, conMat);
  Z.box(105, 1, 88, 8, 12, 6, conMat);
  Z.box(88, 1, 108, 12, 18, 5, conMat);
  Z.grapple(88, 21, 108);
  // Rebar piles (decorative + collectible)
  for (let i = 0; i < 6; i++) {
    const r = buildRebar();
    r.position.set(82 + rand() * 24, 1.4, 82 + rand() * 24);
    r.rotation.y = rand() * Math.PI;
    Z.group.add(r);
  }
  for (const [x, y, z] of [[85, 7, 85], [105, 13, 88], [88, 19, 108], [100, 1, 100], [92, 1, 84], [110, 1, 104]]) Z.rebar(x, y, z);

  // Scattered street rebars + fuel
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2, r = 30 + rand() * 100;
    Z.rebar(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  for (const [x, z] of [[35, 0], [-35, 0], [0, 35], [0, -35], [70, 35], [-70, -35]]) Z.addCollectible('fuel', new THREE.Vector3(x, 0.8, z));
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2, r = 20 + rand() * 110;
    Z.coin(Math.cos(a) * r, 0, Math.sin(a) * r);
  }

  // ---- Portals ----
  Z.portal('bronze', 0, 3, 30, 0);
  Z.portal('bronze', 0, 3.5, -30, 0);
  Z.portal('bronze', 30, 3, 0, Math.PI / 2);
  Z.portal('bronze', -32, 4, 16, Math.PI / 2);
  Z.portal('silver', 0, 8, 70, 0);
  Z.portal('silver', 70, 9, 30, Math.PI / 2);
  Z.portal('silver', -70, 8, -30, Math.PI / 2);
  Z.portal('silver', 45, 14, 45, 0.8);
  Z.portal('gold', -45, 18, -45, 0.6);
  Z.portal('gold', 95, 24, 95, 0.4);
  Z.portal('gold', 0, 26, 0, 0, Math.PI / 2); // horizontal portal high above the intersection
  Z.portal('cyber', 110, 30, 110, 0.7);
  Z.portal('glitch', -20, 3, -50, 0.3);

  // Ramps on the roads
  Z.ramp(0, 0, 50, 9, 5, 3.5, 0, mat(0xd9763a, { roughness: 0.7 }), true);
  Z.ramp(50, 0, 0, 9, 5, 3.5, Math.PI / 2, mat(0xd9763a, { roughness: 0.7 }), true);
  Z.ramp(-50, 0, -8, 9, 5, 3.5, -Math.PI / 2, mat(0xd9763a, { roughness: 0.7 }), true);

  // ---- Services ----
  Z.exchangeKiosk(10, 0, 16, -0.5);
  Z.deploymentBoard(-10, 0, 18, 0.4);
  Z.npc('ching', 14, 0, 22, Math.PI);
  Z.interact(14, 0, 22, '<b>[E]</b> Talk to Ching', () => {
    bus.emit('qe', { type: 'talk', target: 'ching' });
    game.dialogue.conversation([
      ['ching', 'Portal field is live. Chain them without missing for combo multipliers.'],
      ['ching', 'And sell your score at the Exchange before an enemy bonks it out of you.'],
    ]);
  }, 3.5);

  // ---- Props: construction-city dressing + portal route arrows ----
  for (let i = 0; i < 6; i++) Z.cone(78 + i * 2.2, 78);          // construction perimeter
  Z.rebarStack(100, 1, 92, 0.5);
  Z.rebarStack(86, 1, 96, 1.3);
  Z.warnSign(80, 80, 0.8);
  Z.warnSign(8, 44, 0);                                          // before the road ramp
  for (let i = 0; i < 4; i++) Z.cone(-3 + i * 2, 44);
  Z.fuelStation(12, -12, 0.8);
  Z.fuelStation(74, 64, -0.5);
  // Neon arrows tracing the bronze→silver portal route
  Z.neonArrow(0, 1.8, 20, 0, 0x2ee6ff);
  Z.neonArrow(0, 1.8, 48, 0, 0x2ee6ff);
  Z.neonArrow(16, 1.8, 4, Math.PI / 2, 0x2ee6ff);
  Z.neonArrow(0, 4, 60, 0, 0xc9d6e3);                            // up to the silver

  // ---- Enemies ----
  Z.spawner('drone', 95, 4, 95, 18, 3);     // construction zone
  Z.spawner('drone', 0, 4, -60, 20, 2);
  Z.spawner('gremlin', -60, 0, 60, 24, 2);
  Z.spawner('leech', 45, 4, 45, 16, 1);

  // ---- Boss 1: Gabor Scooter Chase ----
  const wps = [
    new THREE.Vector3(0, 0.4, 70), new THREE.Vector3(70, 0.4, 70),
    new THREE.Vector3(70, 0.4, 0), new THREE.Vector3(70, 0.4, -70),
    new THREE.Vector3(0, 0.4, -70), new THREE.Vector3(-70, 0.4, -70),
    new THREE.Vector3(-70, 0.4, 0), new THREE.Vector3(-70, 0.4, 70),
  ];
  const chase = new GaborChase(game, wps);
  Z.updaters.push((dt) => chase.update(dt));

  Z.spawn.set(0, 0.2, 8);
  return Z;
}

// ============================================================
// 3. SYDNEY STAGING ZONE
// ============================================================
function buildSydney(game) {
  const Z = new ZoneKit(game, 'sydney', 'sydney');
  Z.sky(0xb8d4e8, 0xc8dcea, 60, 260, 0xe8f4ff, 0x8a8a92, 1.1, 0xffffff, 1.2, new THREE.Vector3(-30, 90, 50));

  // Terminal floor — polished big-tile floor (Reference Image C)
  Z.ground(220, 110, texMat('terminalFloor', terminalFloorTexture(24), { roughness: 0.28, metalness: 0.18 }));
  // Tarmac apron outside the south glass wall — where the planes park
  Z.plate(0, -0.02, 105, 240, 100, mat(0x565b63, { roughness: 0.9 }));
  // Columns + the triangular-skylight ceiling
  const colMat = mat(0xe8ebee, { metalness: 0.3, roughness: 0.45 });
  for (let x = -90; x <= 90; x += 30) {
    Z.box(x, 0, -50, 1.6, 16, 1.6, colMat);
    Z.box(x, 0, 50, 1.6, 16, 1.6, colMat);
    Z.grapple(x, 15, 0);
  }
  Z.skylightCeiling(0, 0, 224, 112, 16.5);
  // Big modern roof beams under the ceiling
  for (const bz of [-30, 0, 30]) Z.box(0, 15.4, bz, 220, 0.7, 1.2, mat(0xc8cdd4, { metalness: 0.5, roughness: 0.4 }), { collide: false });
  // North wall solid, SOUTH WALL = full glass curtain with planes outside
  Z.box(0, 0, -55, 220, 16, 1, mat(0xe2e6ea, { roughness: 0.7 }));
  Z.glassWall(0, 55, 220, 0, 16);
  // End walls so the hall is enclosed
  Z.box(-111, 0, 0, 1.5, 16, 110, mat(0xe2e6ea, { roughness: 0.7 }));
  Z.box(111, 0, 0, 1.5, 16, 110, mat(0xe2e6ea, { roughness: 0.7 }));
  // Planes parked at the gates (seen through the glass)
  Z.plane(-60, 85, 0.35, 1);
  Z.plane(20, 92, -0.2, 1.15);
  Z.plane(90, 84, 0.5, 0.9);
  // Ground service vehicles + baggage trains outside
  Z.box(-30, 0, 70, 3, 1.6, 1.8, mat(0xffc23d, { roughness: 0.7 }));
  Z.box(50, 0, 72, 3, 1.6, 1.8, mat(0x44b04a, { roughness: 0.7 }));
  Z.baggageCart(-22, 68, 0.4); Z.baggageCart(58, 69, -0.3);

  // ---- Conveyor belts ----
  const beltMat = mat(0x2e3340, { roughness: 0.6, metalness: 0.4 });
  const belts = [];
  for (const [bx, bz, dir] of [[-40, -20, 1], [10, 20, -1], [60, -20, 1]]) {
    Z.box(bx, 0.0, bz, 40, 0.5, 6, beltMat, { collide: false });
    belts.push({ x: bx, z: bz, w: 40, d: 6, dir });
    // Chevron stripes
    for (let i = -3; i <= 3; i++) {
      const stripe = mkBox(1.4, 0.08, 4.5, mat(0xffc23d, { emissive: 0x664400, roughness: 0.6 }));
      stripe.position.set(bx + i * 5.5, 0.58, bz);
      Z.group.add(stripe);
    }
  }
  Z.updaters.push((dt) => {
    const p = game.player;
    if (game.trolley.riding || !p.grounded) return;
    for (const b of belts) {
      if (Math.abs(p.pos.x - b.x) < b.w / 2 && Math.abs(p.pos.z - b.z) < b.d / 2 && p.pos.y < 1.2) {
        p.pos.x += b.dir * 4.5 * dt;
      }
    }
  });

  // ---- Travel gates (arches across the hall) ----
  const gateMat = mat(0x39414d, { metalness: 0.6, roughness: 0.4 });
  for (const gx of [-70, -25, 20, 65]) {
    Z.box(gx, 0, -10, 2, 9, 2, gateMat);
    Z.box(gx, 0, 10, 2, 9, 2, gateMat);
    Z.box(gx, 9, 0, 2, 1.4, 22, gateMat, { collide: false });
    Z.neonSign(gx, 10.8, 0, 8, 1, 0x2ee6ff, Math.PI / 2);
  }

  // ---- Portal challenge: slalom through the hall ----
  Z.portal('silver', -85, 4, 0, Math.PI / 2);
  Z.portal('silver', -55, 6, -15, Math.PI / 2);
  Z.portal('silver', -25, 5, 12, Math.PI / 2);
  Z.portal('gold', 0, 9, 0, Math.PI / 2);
  Z.portal('silver', 25, 5, -14, Math.PI / 2);
  Z.portal('silver', 50, 7, 10, Math.PI / 2);
  Z.portal('gold', 80, 11, 0, Math.PI / 2);
  Z.portal('gold', 95, 5, -25, 0.6);
  Z.portal('glitch', 40, 4, 30, Math.PI / 2);

  // ---- McRebar hoard: ingredients guarded by Burger Bandits ----
  Z.box(90, 0, 35, 18, 4, 14, mat(0xe8a755, { roughness: 0.8 }));
  Z.ramp(76, 0, 35, 9, 4, 4, Math.PI / 2, mat(0xe8a755, { roughness: 0.8 }), false); // walk up to the hoard
  Z.neonSign(90, 5.5, 28.5, 10, 1.4, 0xffc23d);
  Z.addCollectible('burger', new THREE.Vector3(86, 4.8, 33));
  Z.addCollectible('burger', new THREE.Vector3(94, 4.8, 37));
  Z.addCollectible('burger', new THREE.Vector3(-40, 1.3, -20)); // one riding the conveyor area
  Z.spawner('bandit', 90, 0, 35, 14, 2);
  Z.spawner('drone', 0, 4, 0, 30, 2);
  Z.spawner('leech', -60, 4, 20, 16, 1);

  // ---- Operation Rebar Passport checkpoint ----
  Z.box(-100, 0, 0, 6, 3, 10, mat(0xd92e2e, { roughness: 0.6, emissive: 0x330505 }));
  Z.neonSign(-96.8, 4.2, 0, 1, 6, 0xff2e5f, Math.PI / 2);
  Z.interact(-97, 1.5, 0, '<b>[E]</b> OPERATION REBAR PASSPORT CHECKPOINT', () => {
    bus.emit('qe', { type: 'reach', target: 'passport' });
    game.audio.sfx('unlock');
    game.toast('PASSPORT STAMPED — BLUE TO RED TRANSITION READY', 'red');
    game.say('bung', 'Operation Rebar Passport: stamped. I am now legally unstoppable.');
  }, 4.5);

  // Collectibles
  for (const [x, z] of [[-80, 30], [-30, -35], [30, 35], [75, -35], [0, -40], [-60, -38]]) Z.rebar(x, 0, z);
  for (const [x, z] of [[-90, -30], [-50, 35], [15, -30], [45, 30], [95, 0], [70, 40]]) Z.coin(x, 0, z);
  Z.addCollectible('fuel', new THREE.Vector3(0, 0.8, 40));

  Z.exchangeKiosk(105, 0, -8, -Math.PI / 2);
  Z.deploymentBoard(105, 0, 8, -Math.PI / 2);

  // ---- Props: airport clutter ----
  for (let i = 0; i < 5; i++) Z.cone(70 + i * 1.6, 28);   // around the hoard ramp
  Z.warnSign(-94, 8, 0.4, 0xff2e5f);                       // checkpoint warning
  Z.rebarStack(98, 0, 18, 0.9);
  Z.fuelStation(92, 0, -12, Math.PI);
  // Arrows guiding the slalom route down the hall
  Z.neonArrow(-40, 2, 0, -Math.PI / 2, 0xc9d6e3);
  Z.neonArrow(10, 2, 0, -Math.PI / 2, 0xc9d6e3);
  Z.neonArrow(65, 2, 0, -Math.PI / 2, 0xffc23d);

  // ---- 3.0 TERMINAL FURNITURE (Reference Images B + C) ----
  // Check-in row along the north wall (entry side, near spawn)
  for (let i = 0; i < 6; i++) Z.checkInCounter(85 - i * 7, -48, 0, i % 2 ? 0x2ee6ff : 0xffc23d);
  Z.textSign(70, 6.5, -50, 0, 'OPERATION REBAR CHECK-IN', { bg: '#14305a', fg: '#ffe9a8', w: 9, h: 1.4, glow: true });
  Z.queueBarrier(78, -42, 0, 10); Z.queueBarrier(62, -42, 0, 10);
  // Departure boards + gate signage hanging in the concourse
  Z.flightBoard(40, 6, -20, 0.3);
  Z.flightBoard(-45, 6, 22, Math.PI - 0.3);
  Z.gateSign(-25, 7.5, -10, 0, 0xffc23d);
  Z.gateSign(20, 7.5, 10, 0, 0x2ee6ff);
  Z.gateSign(-70, 7.5, 10, 0, 0xff2e5f);
  // Gate seating lounges along the glass wall — watch the planes
  for (const sx of [-95, -75, -45, -15, 15, 45]) {
    Z.seatRow(sx, 44, 0, 5);
    Z.seatRow(sx + 5, 48, Math.PI, 5);
  }
  Z.binProp(-85, 44); Z.binProp(-5, 44); Z.binProp(35, 44);
  // Food court cluster around the McRebar hoard
  Z.textSign(90, 7.4, 28, Math.PI, 'McREBAR FOOD COURT', { bg: '#d92f2f', fg: '#ffe9a8', w: 8, h: 1.3, glow: true });
  Z.vendingMachine(104, 30, -Math.PI / 2, 0xff2e5f);
  Z.vendingMachine(104, 33, -Math.PI / 2, 0x2ee6ff);
  Z.mallKiosk(72, 40, 0xd92f2f); // food kiosk
  for (const [tx, tz] of [[78, 44], [85, 47], [65, 48]]) {
    const table = cyl(0.7, 0.08, 1.1, mat(0xd9dde2, { roughness: 0.5 }), 10);
    table.position.set(tx, 0.55, tz);
    Z.group.add(table);
    Z.bench(tx - 1.6, tz, Math.PI / 2);
  }
  // Security checkpoint dressing at the Passport (west end)
  Z.securityScanner(-92, -5, Math.PI / 2);
  Z.securityScanner(-92, 5, Math.PI / 2);
  Z.queueBarrier(-86, -8, Math.PI / 2, 8); Z.queueBarrier(-82, 8, Math.PI / 2, 8);
  Z.textSign(-90, 6.8, 0, Math.PI / 2, 'TROLLEY FUEL NOT ALLOWED\nTHROUGH SECURITY', { bg: '#f4f1e8', fg: '#d12c47', w: 6, h: 2 });
  Z.textSign(-104, 5, 14, Math.PI / 2, 'NO SCOOTERS BEYOND\nTHIS POINT, GABOR', { bg: '#d12c47', fg: '#ffffff', w: 5, h: 1.8, glow: true });
  // Service counters: information + currency exchange (it's the kiosk anyway)
  Z.checkInCounter(105, 24, -Math.PI / 2, 0x43d96b);
  Z.textSign(103.5, 4.6, 24, -Math.PI / 2, 'REBAR EXCHANGE', { bg: '#1a1d26', fg: '#ffc23d', w: 5, h: 1, glow: true });
  // More funny canon signage
  Z.textSign(95, 5.2, -45, 0, 'GOLDEN TROLLEY\nDECLARATION REQUIRED', { bg: '#ffc23d', fg: '#1a1d26', w: 5, h: 1.8 });
  Z.textSign(-10, 5.2, -50, 0, 'BUNG CLASS PRIORITY BOARDING', { bg: '#35c5f0', fg: '#1a1d26', w: 7, h: 1, glow: true });
  Z.textSign(-55, 5.2, -50, 0, 'REBAR ITEMS MUST BE DECLARED', { bg: '#f4f1e8', fg: '#1a1d26', w: 7, h: 1 });
  // Baggage trolleys inside + passengers
  Z.baggageCart(55, -35, 1.1); Z.baggageCart(-20, 30, -0.6); Z.baggageCart(8, -38, 0.2);
  Z.pedestrians(0, -30, 150, 25, 8, 71);
  Z.pedestrians(-30, 38, 110, 14, 6, 72);

  Z.spawn.set(100, 0.2, 0);
  Z.spawnYaw = Math.PI / 2; // face down the terminal hall (-x)
  return Z;
}

// ============================================================
// 4. HONG KONG NEON RAIN CITY
// ============================================================
function buildHongKong(game) {
  const Z = new ZoneKit(game, 'hongkong', 'hongkong');
  Z.sky(0x0a0e1a, 0x0d1222, 40, 230, 0x5a7aaa, 0x1a1a2a, 1.3, 0x9fc0ff, 1.1, new THREE.Vector3(-40, 90, -30));
  Z.enableRain(1100, 0x9fd4ff, 130);

  // Wet streets
  Z.ground(250, 250, mat(0x14181f, { roughness: 0.25, metalness: 0.5 }));
  const road = mat(0x10131a, { roughness: 0.2, metalness: 0.6 });
  Z.plate(0, 0, 0, 12, 240, road);
  Z.plate(0, 0, 0, 240, 12, road);

  // ---- Dense neon towers ----
  const rand = rng(8888);
  const neonColors = [0xff2e5f, 0x2ee6ff, 0xffc23d, 0xd14fd1, 0x44ff88];
  const towers = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (gx === 0 || gz === 0) continue; // keep roads clear
      const x = gx * 45 + (rand() - 0.5) * 14;
      const z = gz * 45 + (rand() - 0.5) * 14;
      const h = 22 + rand() * 26;
      const w = 14 + rand() * 8, d = 14 + rand() * 8;
      Z.building(x, z, w, h, d, 0x1c222e, { grapple: true, windowColor: neonColors[Math.floor(rand() * 5)], windowGlow: 0.9 });
      towers.push({ x, z, h });
      // Neon signage stack
      for (let s = 0; s < 3; s++) {
        if (rand() < 0.5) continue;
        Z.neonSign(x + w / 2 + 0.3, 5 + s * (h / 4), z, 0.4, 3 + rand() * 3, neonColors[Math.floor(rand() * 5)], Math.PI / 2);
      }
      if (rand() < 0.5) Z.coin(x, h, z);
    }
  }

  // ---- Rooftop portal chain (climbing route, marked by gold grapples) ----
  towers.sort((a, b) => a.h - b.h);
  const route = towers.filter((_, i) => i % 2 === 0).slice(0, 7);
  let prev = null;
  for (const t of route) {
    Z.portal(t.h > 38 ? 'cyber' : t.h > 30 ? 'gold' : 'silver', t.x, t.h + 3, t.z, rand() * Math.PI);
    if (prev) {
      // Grapple point midway between consecutive rooftops
      Z.grapple((t.x + prev.x) / 2, Math.max(t.h, prev.h) + 6, (t.z + prev.z) / 2);
    }
    prev = t;
  }
  // Street-level portals
  Z.portal('bronze', 0, 3, 40, 0);
  Z.portal('bronze', -40, 3, 0, Math.PI / 2);
  Z.portal('silver', 0, 6, -60, 0);
  Z.portal('silver', 60, 7, 0, Math.PI / 2);
  Z.portal('glitch', 20, 4, -20, 0.4);
  Z.portal('glitch', -55, 8, 55, 0.9);

  // ---- Rooftop checkpoint with Ching (on the tallest route tower) ----
  const top = route[route.length - 1] || { x: 45, z: 45, h: 40 };
  Z.box(top.x, top.h, top.z, 8, 0.5, 8, mat(0x2ee6ff, { emissive: 0x0a4a55, metalness: 0.5, roughness: 0.4 }));
  Z.npc('ching', top.x, top.h + 0.5, top.z, 0);
  Z.interact(top.x, top.h + 0.5, top.z, '<b>[E]</b> Rooftop checkpoint — Ching', () => {
    bus.emit('qe', { type: 'talk', target: 'ching-rooftop' });
    game.dialogue.conversation([
      ['ching', 'You actually made it up here. The rain has not even slowed you down.'],
      ['bung', 'Hong Kong rain mode activated, Ching. Nothing can stop the singlet.'],
      ['ching', 'Gabor is moving his machine to Shenzhen. The Cyber Rebar Core opens next.'],
    ]);
  }, 4);

  // ---- NoodleMart convenience store side quest ----
  Z.box(30, 0, 60, 12, 5, 10, mat(0x1c222e, { roughness: 0.6 }));
  Z.neonSign(30, 6, 54.8, 10, 1.6, 0x44ff88);
  Z.interact(30, 1, 54, '<b>[E]</b> NOODLEMART — side quest', () => {
    if (!state.flags.noodleQuest) {
      state.flags.noodleQuest = true;
      addCoins(100);
      game.audio.sfx('buy');
      game.toast('NOODLEMART DELIVERY COMPLETE: +100 REBAR COINS', 'blue');
      game.dialogue.conversation([
        ['system', 'NOODLEMART: Please deliver these noodles to literally anyone.'],
        ['bung', 'Delivery complete. I delivered them to myself. Legally fine.'],
      ]);
    } else game.say('bung', 'NoodleMart appreciates my business.');
  }, 4);

  // ---- Enemies ----
  Z.spawner('blob', 0, 0, 60, 26, 2);
  Z.spawner('blob', -60, 0, -30, 24, 2);
  Z.spawner('bug', 45, 30, 45, 30, 1);
  Z.spawner('leech', 0, 6, -60, 18, 1);
  Z.spawner('drone', -40, 5, 40, 20, 2);

  // Collectibles
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2, r = 25 + rand() * 85;
    Z.rebar(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2, r = 20 + rand() * 90;
    Z.coin(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  Z.addCollectible('fuel', new THREE.Vector3(0, 0.8, -40));
  Z.addCollectible('fuel', new THREE.Vector3(40, 0.8, 0));

  Z.exchangeKiosk(-8, 0, 20, 0.5);
  Z.deploymentBoard(8, 0, 20, -0.5);

  // ---- Props: rainy neon street dressing ----
  Z.fuelStation(14, 0, 30, -0.8);
  Z.warnSign(0, 30, 0, 0xff2e5f);
  Z.rebarStack(-20, 0, -14, 0.6);
  for (let i = 0; i < 4; i++) Z.cone(-4 + i * 2.4, 34);
  Z.warnLight(-40, 6, 8);
  Z.warnLight(42, 6, -8);
  // Arrows at the base of the rooftop climbing route
  if (route.length) {
    const first = route[0];
    Z.neonArrow(first.x, 2, first.z + 12, 0, 0xffc23d);
    Z.neonArrow(first.x, 5, first.z + 8, 0, 0xffc23d);
  }

  // ---- 3.0 STREET CANYON DENSITY PASS ----
  // Animated LED billboards bolted onto tower faces along the roads
  let bb = 0;
  for (const t of towers) {
    if (bb >= 10) break;
    if (Math.abs(t.x) > 75 && Math.abs(t.z) > 75) continue;
    const fx = Math.abs(t.x) < Math.abs(t.z); // face whichever road is closer
    Z.ledBillboard(
      fx ? t.x : (t.x > 0 ? t.x - 9 : t.x + 9),
      8 + (bb % 3) * 7,
      fx ? (t.z > 0 ? t.z - 9 : t.z + 9) : t.z,
      fx ? (t.z > 0 ? Math.PI : 0) : (t.x > 0 ? -Math.PI / 2 : Math.PI / 2),
      3.5, 7, bb + 3, bb % 2 ? '#ff2e5f' : '#2ee6ff');
    bb++;
  }
  // Hanging cables criss-crossing the streets
  Z.cableSpan(-22, 14, -40, 22, 12, -40);
  Z.cableSpan(-22, 12, 25, 22, 15, 25);
  Z.cableSpan(-40, 13, -22, -40, 11, 22);
  Z.cableSpan(40, 15, -22, 40, 12, 22);
  // Steam vents + street food row
  Z.steamVent(-10, 44); Z.steamVent(8, -38); Z.steamVent(-36, -8);
  Z.foodStall(-14, 52, 0.4, 0xd92f2f);
  Z.foodStall(-20, 46, 0.9, 0xff8a3d);
  Z.foodStall(16, 58, -0.5, 0x44ff88);
  // Elevated neon walkway crossing the main street (extra route + cover)
  Z.walkway(-30, -52, 30, -52, 7, 3.5);
  Z.walkway(30, -52, 30, -20, 7, 3.5);
  Z.ramp(-36, 0, -52, 6, 7, 3, -Math.PI / 2, mat(0x2a2f3a, { roughness: 0.6 }), false);
  // Distant drone traffic silhouettes circling above the city
  const traffic = [];
  for (let i = 0; i < 6; i++) {
    const d = mkBox(0.8, 0.25, 0.8, mat(0xff2e5f, { emissive: 0xff2e5f, emissiveIntensity: 1.6 }));
    Z.group.add(d);
    traffic.push({ d, r: 70 + i * 12, h: 46 + (i % 3) * 8, s: 0.1 + (i % 2) * 0.06, o: i * 1.1 });
  }
  Z.updaters.push((dt, t) => {
    for (const a of traffic) {
      a.d.position.set(Math.cos(t * a.s + a.o) * a.r, a.h, Math.sin(t * a.s + a.o) * a.r);
      a.d.rotation.y = -(t * a.s + a.o);
    }
  });
  // Canon signage
  Z.textSign(0, 4.2, 24, 0, 'RED MODE ACTIVE', { bg: '#d12c47', fg: '#ffffff', w: 5, h: 1, post: true, glow: true });
  Z.textSign(8, 3.2, -30, Math.PI, 'DO NOT FOLLOW THE SCOOTER', { bg: '#16181d', fg: '#ff4d6a', w: 5.5, h: 0.9, post: true, glow: true });
  Z.textSign(-12, 3.2, -44, 0, 'REBAR NETWORK UNSTABLE', { bg: '#16181d', fg: '#ffc23d', w: 5, h: 0.9, post: true, glow: true });
  if (route.length) Z.textSign(route[0].x + 6, 4, route[0].z + 10, 0, 'BUNG TROLLEY NOT RATED\nFOR ROOFTOP FLIGHT', { bg: '#f4f1e8', fg: '#1a1d26', w: 5, h: 1.7, post: true });

  Z.spawn.set(0, 0.2, 12);
  return Z;
}

// ============================================================
// 5. SHENZHEN CYBER REBAR CORE
// ============================================================
function buildShenzhen(game) {
  const Z = new ZoneKit(game, 'shenzhen', 'shenzhen');
  Z.sky(0x120508, 0x180810, 40, 240, 0x9a4a60, 0x1c1018, 1.25, 0xff7a90, 1.05, new THREE.Vector3(30, 80, -40));
  Z.enableRain(500, 0xff8aa0, 110);

  Z.ground(260, 260, mat(0x16080c, { roughness: 0.3, metalness: 0.6 }));
  const road = mat(0x1f0a10, { roughness: 0.25, metalness: 0.6 });
  Z.plate(0, 0, 0, 14, 250, road);
  Z.plate(0, 0, 30, 250, 14, road);

  // ---- LED megatowers ----
  const rand = rng(4242);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 60 + rand() * 50;
    const x = Math.cos(a) * r, z = Math.sin(a) * r + 30;
    if (Math.abs(x) < 12 || Math.abs(z - 30) < 12) continue;
    const h = 30 + rand() * 30;
    const w = 14 + rand() * 8;
    Z.building(x, z, w, h, w, 0x14101c, { grapple: true, windowColor: rand() < 0.5 ? 0xff2e5f : 0x2ee6ff, windowGlow: 1.1 });
    // LED stripes
    for (let s = 0; s < 4; s++) {
      Z.neonSign(x, 4 + s * (h / 4.5), z + w / 2 + 0.3, w * 0.8, 0.6, s % 2 ? 0xff2e5f : 0x2ee6ff);
    }
    if (rand() < 0.5) Z.coin(x, h, z);
  }

  // ---- Corruption towers (pulse them to disable) ----
  const towers = [];
  for (const [tx, tz] of [[-45, 70], [50, 85], [0, 120]]) {
    const obelisk = mkBox(3, 16, 3, mat(0xff2e5f, { emissive: 0xff2e5f, emissiveIntensity: 1.3, metalness: 0.5, roughness: 0.3 }));
    obelisk.position.set(tx, 8, tz);
    Z.group.add(obelisk);
    Z.colliders.push(new THREE.Box3().setFromObject(obelisk));
    Z.grounds.push(obelisk);
    const t = { mesh: obelisk, pos: new THREE.Vector3(tx, 4, tz), alive: true };
    towers.push(t);
    Z.updaters.push((dt, tt) => {
      if (t.alive) t.mesh.rotation.y = tt * 0.5;
    });
  }
  const onPulse = (e) => {
    if (game.zone !== Z) return;
    for (const t of towers) {
      if (t.alive && e.pos.distanceTo(t.pos) < e.radius + 3) {
        t.alive = false;
        t.mesh.material = mat(0x3a3a42, { roughness: 0.8 });
        game.audio.sfx('explode');
        game.fx.burst(t.pos.clone().add(new THREE.Vector3(0, 6, 0)), 0xff2e5f, 30);
        game.toast('CORRUPTION TOWER DISABLED', 'blue');
        bus.emit('qe', { type: 'tower', target: 'any' });
      }
    }
  };
  bus.on('pulse', onPulse);

  // ---- Cyber Rebar Shards (high up — grapple for them) ----
  Z.grapple(-45, 20, 70);
  Z.grapple(50, 20, 85);
  Z.grapple(0, 22, 120);
  Z.addCollectible('redshard', new THREE.Vector3(-45, 17.5, 70));
  Z.addCollectible('redshard', new THREE.Vector3(50, 17.5, 85));
  Z.addCollectible('redshard', new THREE.Vector3(0, 17.5, 120));

  // ---- Cyber portal chains ----
  Z.portal('cyber', 0, 4, 60, 0);
  Z.portal('cyber', 20, 8, 80, 0.5);
  Z.portal('cyber', 0, 12, 100, 0);
  Z.portal('gold', -25, 7, 75, -0.5);
  Z.portal('gold', 40, 5, 30, Math.PI / 2);
  Z.portal('silver', -40, 4, 30, Math.PI / 2);
  Z.portal('silver', 0, 5, -20, 0);
  Z.portal('cyber', 0, 18, -60, 0, Math.PI / 2);
  Z.portal('glitch', 15, 5, 45, 0.4);
  Z.portal('glitch', -30, 9, 95, 0.8);

  // Ramps
  Z.ramp(0, 0, -30, 10, 5, 4, Math.PI, mat(0xff2e5f, { emissive: 0x550a16, roughness: 0.6 }), true);
  Z.ramp(40, 0, 30, 10, 5, 4, Math.PI / 2, mat(0xff2e5f, { emissive: 0x550a16, roughness: 0.6 }), true);

  // ---- Final boss arena (north platform) ----
  const arenaC = new THREE.Vector3(0, 0.5, -95);
  const arena = cyl(34, 36, 1, mat(0x1f1424, { metalness: 0.6, roughness: 0.35, emissive: 0x14060a }), 28);
  arena.position.set(0, 0, -95);
  arena.receiveShadow = true;
  Z.group.add(arena);
  Z.grounds.push(arena);
  // Arena rim lights
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    Z.neonSign(Math.cos(a) * 33, 1.5, -95 + Math.sin(a) * 33, 2.5, 1.2, i % 2 ? 0xff2e5f : 0x2ee6ff, -a);
  }
  const machine = new MegaForeheadMachine(game, new THREE.Vector3(0, 0.5, -95));
  Z.updaters.push((dt) => machine.update(dt));
  Z.trigger(arenaC, 30, () => {
    bus.emit('qe', { type: 'reach', target: 'bossarena' });
    const q = game.quests.active;
    if (q && q.id === 'q8') machine.start();
  }, false, 5);

  // ---- Enemies ----
  Z.spawner('bug', 0, 4, 70, 30, 3);
  Z.spawner('bug', -40, 4, 40, 20, 2);
  Z.spawner('drone', 40, 4, 60, 20, 2);

  // Collectibles
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2, r = 25 + rand() * 70;
    Z.rebar(Math.cos(a) * r, 0, 30 + Math.sin(a) * r);
  }
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2, r = 20 + rand() * 75;
    Z.coin(Math.cos(a) * r, 0, 30 + Math.sin(a) * r);
  }
  Z.addCollectible('fuel', new THREE.Vector3(0, 0.8, 45));
  Z.addCollectible('fuel', new THREE.Vector3(-30, 0.8, 30));

  Z.exchangeKiosk(-8, 0, 8, 0.5);
  Z.deploymentBoard(8, 0, 8, -0.5);

  // ---- Props: cyber-industrial dressing + boss arena warnings ----
  Z.fuelStation(16, 0, 8, -Math.PI / 2);
  Z.warnLight(-12, 7, -55);
  Z.warnLight(12, 7, -55);             // flanking the boss arena approach
  Z.warnSign(0, -52, 0, 0xff2e5f);
  Z.rebarStack(24, 0, 50, 0.7);
  Z.rebarStack(-28, 0, 64, 1.4);
  for (let i = 0; i < 4; i++) Z.cone(-5 + i * 3, -24);  // around the ramp
  // Arrows pointing into the cyber portal chain
  Z.neonArrow(0, 2, 48, 0, 0xff2e5f);
  Z.neonArrow(10, 4, 70, 0.4, 0xff2e5f);

  // ---- 3.0 CYBER MEGA-CITY PASS ----
  // THE REBAR CORE — colossal central tower looming behind the boss arena
  const coreG = new THREE.Group();
  coreG.position.set(0, 0, -150);
  const coreBody = cyl(9, 14, 85, mat(0x1a1024, { metalness: 0.7, roughness: 0.3, emissive: 0x2a0a14 }), 10);
  coreBody.position.y = 42.5;
  coreBody.castShadow = true;
  coreG.add(coreBody);
  for (let i = 0; i < 6; i++) { // glowing data rings climbing the core
    const ring = new THREE.Mesh(new THREE.TorusGeometry(11 - i * 0.7, 0.5, 6, 24),
      mat(i % 2 ? 0xff2e5f : 0x2ee6ff, { emissive: i % 2 ? 0xff2e5f : 0x2ee6ff, emissiveIntensity: 1.6 }));
    ring.position.y = 14 + i * 12;
    ring.rotation.x = Math.PI / 2;
    coreG.add(ring);
    Z.updaters.push((dt, t) => { ring.rotation.z = t * (0.2 + i * 0.07) * (i % 2 ? -1 : 1); });
  }
  const coreTip = cyl(0.8, 3, 16, mat(0xff2e5f, { emissive: 0xff2e5f, emissiveIntensity: 2 }), 8);
  coreTip.position.y = 93;
  coreG.add(coreTip);
  Z.group.add(coreG);
  Z.updaters.push((dt, t) => { coreTip.material.emissiveIntensity = 1.4 + Math.sin(t * 2.4) * 0.8; });
  // Holographic rebar data orbiting the arena + the core
  Z.holoBits(0, 8, -95, 38, 14, 0xff2e5f);
  Z.holoBits(0, 30, -150, 16, 10, 0x2ee6ff);
  // Animated LED billboards on the approach boulevard
  Z.ledBillboard(-10, 9, -20, Math.PI / 4, 4, 8, 21, '#ff2e5f');
  Z.ledBillboard(12, 11, 5, -Math.PI / 3, 4, 8, 22, '#2ee6ff');
  Z.ledBillboard(-14, 8, 55, Math.PI / 5, 3.5, 7, 23, '#ff2e5f');
  Z.ledBillboard(16, 10, 75, -Math.PI / 4, 3.5, 7, 24, '#44ff88');
  // Steam + elevated walkway over the crossroads
  Z.steamVent(-12, 38); Z.steamVent(14, 22); Z.steamVent(-8, -40);
  Z.walkway(-28, 30, 28, 30, 8, 4, 0x1f1424);
  Z.ramp(-34, 0, 30, 6, 8, 3, -Math.PI / 2, mat(0x1f1424, { roughness: 0.6 }), false);
  Z.portal('cyber', 0, 10.5, 30, Math.PI / 2); // bonus ring over the walkway
  // Distant drone traffic, tighter and faster than HK (high-tech city)
  const traffic2 = [];
  for (let i = 0; i < 8; i++) {
    const d = mkBox(0.7, 0.2, 0.7, mat(i % 2 ? 0xff2e5f : 0x2ee6ff, { emissive: i % 2 ? 0xff2e5f : 0x2ee6ff, emissiveIntensity: 1.8 }));
    Z.group.add(d);
    traffic2.push({ d, r: 55 + i * 10, h: 52 + (i % 4) * 7, s: 0.14 + (i % 3) * 0.05, o: i * 0.8 });
  }
  Z.updaters.push((dt, t) => {
    for (const a of traffic2) {
      a.d.position.set(Math.cos(t * a.s + a.o) * a.r, a.h, 30 + Math.sin(t * a.s + a.o) * a.r);
      a.d.rotation.y = -(t * a.s + a.o);
    }
  });
  // Canon signage
  Z.textSign(0, 5, 18, 0, 'CYBER REBAR CORE ONLINE', { bg: '#16181d', fg: '#ff4d6a', w: 6.5, h: 1, post: true, glow: true });
  Z.textSign(-10, 4, -38, 0, 'GABOR FIREWALL DETECTED', { bg: '#d12c47', fg: '#ffffff', w: 6, h: 1, post: true, glow: true });
  Z.textSign(12, 4, -50, Math.PI, 'CHING SYSTEM WARNING:\nFOREHEAD ENERGY CRITICAL', { bg: '#16181d', fg: '#2ee6ff', w: 6, h: 1.7, post: true, glow: true });

  Z.spawn.set(0, 0.2, 0);
  Z.spawnYaw = Math.PI; // face the portal field (+z)
  return Z;
}

// ============================================================
// 6. REBAR VOID
// ============================================================
function buildVoid(game) {
  const Z = new ZoneKit(game, 'void', 'void');
  Z.sky(0x03030a, 0x05051a, 80, 400, 0x5a5a9a, 0x0a0a18, 1.1, 0xa090ff, 0.9, new THREE.Vector3(20, 100, 20));

  // Starfield
  const starCount = 600;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
    const r = 200 + Math.random() * 150;
    starPos[i * 3] = Math.cos(a) * Math.cos(b) * r;
    starPos[i * 3 + 1] = Math.sin(b) * r + 50;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfd4ff, size: 0.8, sizeAttenuation: false }));
  stars.frustumCulled = false;
  Z.group.add(stars);

  // ---- Floating platform spiral ----
  const platMat = mat(0x2a2440, { metalness: 0.6, roughness: 0.35, emissive: 0x14081f });
  const rimMat = (i) => mat(i % 2 ? 0xff2e5f : 0x2ee6ff, { emissive: i % 2 ? 0xff2e5f : 0x2ee6ff, emissiveIntensity: 1.2 });
  Z.box(0, -1, 0, 24, 1, 24, platMat); // spawn platform
  Z.neonSign(0, 2.5, -11.8, 20, 0.5, 0x2ee6ff);

  const plats = [];
  for (let i = 0; i < 14; i++) {
    const a = 1.2 + i * 0.38;
    const r = 18 + i * 1.3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = (i + 1) * 1.2;
    const size = 8 - Math.min(2.5, i * 0.18);
    Z.box(x, y, z, size, 0.8, size, platMat);
    const rim = mkBox(size + 0.4, 0.15, size + 0.4, rimMat(i));
    rim.position.set(x, y + 0.85, z);
    Z.group.add(rim);
    plats.push({ x, y: y + 0.8, z });
    if (i % 2 === 1) Z.grapple(x, y + 7, z);
    if (i % 4 === 2) Z.rebar(x, y + 0.8, z);
    if (i % 4 === 0) Z.coin(x, y + 0.8, z);
  }

  // Portals between consecutive platforms
  for (let i = 0; i < plats.length - 1; i++) {
    const a = plats[i], b = plats[i + 1];
    const tier = i < 4 ? 'silver' : i < 9 ? 'gold' : 'cyber';
    const mid = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + 2.5, (a.z + b.z) / 2);
    const ry = Math.atan2(b.x - a.x, b.z - a.z);
    Z.portal(tier, mid.x, mid.y, mid.z, ry);
  }
  // Crown portal at the summit
  const top = plats[plats.length - 1];
  Z.portal('cyber', top.x, top.y + 6, top.z, 0, Math.PI / 2);

  // ---- PORTAL RUSH score attack terminal ----
  Z.interact(0, 0, 8, '<b>[E]</b> PORTAL RUSH — 60s score attack (2x score)', () => {
    game.startScoreAttack();
  }, 4);

  // ---- Hidden lore fragments ----
  const lore = [
    [['system', 'LORE FRAGMENT 1: In the beginning there was concrete. The concrete was formless. Then came the rebar, and the concrete had purpose.']],
    [['system', 'LORE FRAGMENT 2: The first golden trolley was forged in a Brisbane servo at 3am. Witnesses describe "a glow" and "a man in a singlet weeping with joy".']],
    [['system', 'LORE FRAGMENT 3: Gabor Mihala once sued the concept of doors. He lost. Bung Bunty counter-sued for $10,000 and won. This is canon.']],
  ];
  [[3, 0, -8], [plats[6].x, plats[6].y, plats[6].z], [top.x, top.y, top.z]].forEach(([x, y, z], i) => {
    Z.interact(x, y, z, '<b>[E]</b> LORE FRAGMENT', () => {
      game.dialogue.conversation(lore[i]);
      game.audio.sfx('shard');
    }, 3);
  });

  // Light enemy presence at the summit
  Z.spawner('leech', top.x, top.y + 4, top.z, 12, 1);
  Z.spawner('bug', plats[8].x, plats[8].y + 4, plats[8].z, 14, 1);

  Z.deploymentBoard(-7, 0, 7, 0.8);
  Z.exchangeKiosk(7, 0, 7, -0.8);

  // Arrows marking the start of the spiral climb
  Z.neonArrow(plats[0].x, plats[0].y + 1.6, plats[0].z, Math.atan2(plats[1].x - plats[0].x, plats[1].z - plats[0].z), 0x2ee6ff);
  Z.neonArrow(0, 1.8, -10, Math.atan2(plats[0].x, plats[0].z), 0x2ee6ff);

  Z.spawn.set(0, 0.3, 0);
  Z.spawnYaw = Math.PI; // face the platform spiral (+z)
  return Z;
}

export const ZONE_BUILDERS = {
  mansion: buildMansion,
  brisbane: buildBrisbane,
  sydney: buildSydney,
  hongkong: buildHongKong,
  shenzhen: buildShenzhen,
  void: buildVoid,
};
