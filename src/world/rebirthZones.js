// Playable district dressing for the Rebirth foundation.
// These are designed places with collisions, pickups and interactions.
// They are stylised landmarks, not survey-accurate city models.
import * as THREE from 'three';
import { mat, cyl } from '../core/utils.js';
import { state, addCoins } from '../core/state.js';
import { unlockArchive } from '../lore/universe.js';

const steel = () => mat(0x6a7078, { metalness: 0.45, roughness: 0.45 });
const cream = () => mat(0xf3ead7, { roughness: 0.8 });
const grass = () => mat(0x3f8f45, { roughness: 1 });

export function dressMansion(Z, game) {
  Z.textSign(0, 8.4, 2.2, 0, 'MIDDLE FLOOR\nBUNG + CHUNG', { w: 4.2, h: 1.3, bg: '#ffc23d', fg: '#1a1d26' });
  Z.textSign(0, 13.6, 2.2, 0, 'UPSTAIRS\nBUNG FAMILY', { w: 4.2, h: 1.3, bg: '#f4f1e8', fg: '#1a1d26' });
  Z.textSign(-8, 2.4, 4, 0.4, 'DOWNSTAIRS\nCHUNG FAMILY', { w: 4.2, h: 1.3, bg: '#35c5f0', fg: '#1a1d26' });

  const pool = cyl(4.2, 4.2, 0.35, mat(0x3ec0e0, { roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.85 }), 20);
  pool.position.set(-14, 0.3, 28);
  Z.group.add(pool);
  Z.grounds.push(pool);
  Z.textSign(-14, 2.2, 34, 0, 'BILLIONAIRE POOL\n(BOMB-FREE)', { w: 4.4, h: 1.2, post: true, bg: '#14305a', fg: '#ffe9a8' });

  Z.interact(4, 0, 12, '<b>[E]</b> Ask Chung to come with you', () => {
    state.flags.chingWithYou = !state.flags.chingWithYou;
    game.toast(state.flags.chingWithYou ? 'CHUNG IS WITH YOU' : 'CHUNG IS STAYING PUT', 'blue');
    game.say(state.flags.chingWithYou ? 'ching' : 'bung',
      state.flags.chingWithYou
        ? 'I will come. If you eat a fifth burger I am going home.'
        : 'Chung has standards. She is using them.');
  }, 3.2);

  Z.interact(0, 0, 48, '<b>[E]</b> Rebar Cricket pitch', () => {
    unlockArchive('bombs');
    game.menus.showCricket(() => game.resume());
  }, 4);

  Z.addCollectible('james', new THREE.Vector3(-30, 1.4, -2));
  Z.addCollectible('bent', new THREE.Vector3(8, 7, -8));
  Z.trigger(new THREE.Vector3(-30, 1, -6), 6, () => unlockArchive('james'), true);
}

export function dressBrisbane(Z, game, places) {
  // Fictional Bung Bunty sites sitting on the real coordinate grid.
  // Nothing in here moves a road, a river, or a surveyed footprint.
  if (!places) return;
  const { mall, rx, rz, parliament, story, south, wheel } = places;

  const sebX = mall.x - rx * 4;
  const sebZ = mall.z - rz * 4;
  Z.interact(sebX, 0.2, sebZ, '<b>[E]</b> Seb Daly — Big Boss of Brisbane', () => {
    unlockArchive('seb');
    const held = state.stock.rebar || 0;
    if (state.flags.sebContract) {
      game.say('bung', 'Seb already has his steel. He nodded, which is a contract.');
      return;
    }
    if (held < 3) {
      game.dialogue.conversation([
        ['system', 'SEB DALY: Three standard rebars. No questions. The yard will notice.'],
        ['bung', 'I have questions. I will also get the rebars.'],
      ]);
      return;
    }
    state.stock.rebar -= 3;
    state.rebars = Math.max(0, state.rebars - 3);
    state.flags.sebContract = true;
    addCoins(180);
    game.toast('SEB DALY PAID 180 BUNGBUCKS', 'blue');
    game.say('ching', 'You just sold steel to the Big Boss. Try to look like that was a plan.');
  }, 4);

  // McRebars and Hungry Bung are mounted on the real Queen Street frontages
  // by the CBD shopfront pass, not floated over the footpath.

  Z.interact(parliament.x, 0.6, parliament.z, '<b>[E]</b> Read the lawsuit plaque', () => {
    unlockArchive('parliament');
    game.dialogue.conversation([
      ['gabor', 'Ten thousand dollars. Parliament House. The real one. I remain undefeated in my own head.'],
      ['bung', 'Mate, the columns are load-bearing and your story is not.'],
    ]);
  }, 4.5);
  Z.trigger(new THREE.Vector3(parliament.x, 1, parliament.z), 12, () => unlockArchive('parliament'), true);

  Z.withLift(story.ya != null ? story.ya - story.y : 0, () => {
  Z.trigger(new THREE.Vector3(story.x, story.y, story.z), 10, () => unlockArchive('storybridge'), true);
  Z.addCollectible('goldenrebar', new THREE.Vector3(story.x + 5, story.y, story.z));

  Z.interact(story.x - 7, story.y, story.z + 4, '<b>[E]</b> Offer obsidian to the river', () => {
    if (state.flags.girderfaceSeen) {
      game.say('bung', 'Sir Girderface already did a lap. I am still processing the eyes.');
      return;
    }
    if ((state.stock.obsidian || 0) < 1) {
      game.say('ching', 'The river wants Obsidian Rebar. I want you to think about that sentence.');
      return;
    }
    state.stock.obsidian -= 1;
    state.flags.girderfaceSeen = true;
    unlockArchive('girderface');
    const serpent = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7 - i * 0.03, 0.85 - i * 0.03, 2.1, 7),
        mat(i % 2 ? 0x1a1020 : 0xff6a1a, { emissive: i % 2 ? 0x2a1030 : 0xff4a00, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.35 }),
      );
      seg.rotation.z = Math.PI / 2;
      serpent.add(seg);
      seg.userData.i = i;
    }
    for (let e = 0; e < 10; e++) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(0xffe14a, { emissive: 0xffcc00, emissiveIntensity: 1.6 }));
      eye.position.set(2.2, 0.4, (e - 4.5) * 0.18);
      serpent.add(eye);
    }
    Z.group.add(serpent);
    const sx0 = story.x, sz0 = story.z, sy = story.ya ?? story.y;
    Z.updaters.push((dt, t) => {
      serpent.position.set(sx0 + Math.cos(t * 0.45) * 18, sy + 1.2 + Math.sin(t * 1.4) * 0.6, sz0 + Math.sin(t * 0.45) * 8);
      serpent.rotation.y = -t * 0.45;
      serpent.children.forEach((c) => {
        if (c.userData.i === undefined) return;
        c.position.x = -c.userData.i * 1.7;
        c.position.y = Math.sin(t * 3 + c.userData.i) * 0.35;
      });
    });
    addCoins(2500);
    game.toast('SIR GIRDERFACE AWAKENS — +2500 BUNGBUCKS', 'red');
    game.dialogue.conversation([
      ['bung', 'Ten eyes. Molten trail. I am choosing to be flattered.'],
      ['ching', 'You woke the Rebar Overlord on a real bridge. We are leaving the river.'],
    ]);
  }, 4.5);
  });

  Z.trigger(new THREE.Vector3(south.x, 1, south.z), 14, () => unlockArchive('southbank'), true);
  Z.addCollectible('reinforced', new THREE.Vector3(south.x + 6, 1.1, south.z));
  Z.addCollectible('obsidian', new THREE.Vector3(parliament.x + 10, 1.2, parliament.z + 6));
  Z.addCollectible('forbidden', new THREE.Vector3(mall.x + rx * 16, 1.1, mall.z + rz * 16));

  const wx = wheel.cx ?? wheel.x;
  const wz = wheel.cz ?? wheel.z;
  const wheelMesh = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 8, 24), mat(0xe8eef2, { metalness: 0.7, roughness: 0.3 }));
  wheelMesh.position.set(wx, 8, wz);
  Z.group.add(wheelMesh);
  Z.updaters.push((dt, t) => { wheelMesh.rotation.z = t * 0.15; });
  Z.textSign(wx, 3.1, wz + 8, 0, 'WHEEL OF BRISBANE\nTICKET OFFICE', { w: 5.2, h: 1.2, post: true, bg: '#14305a', fg: '#ffe9a8' });
}

export function dressSydney(Z, game, gate) {
  const g = gate || { x: -62, z: 28 };
  Z.textSign(g.x, 4.2, g.z, 0, 'REBAR PACIFIC\nRP100', { w: 4.6, h: 1.5, bg: '#14305a', fg: '#ffe9a8', glow: true });
  Z.interact(g.x, 0.5, g.z, '<b>[E]</b> Board RP100 to Hong Kong', () => {
    unlockArchive('flight');
    if (!state.unlockedZones.includes('hongkong')) {
      game.dialogue.conversation([
        ['ching', 'The board says Hong Kong. The passport booth beside this terminal has not stamped you.'],
        ['bung', 'I booked it in my head as CX100. The airport, rudely, has standards.'],
      ]);
      return;
    }
    game.dialogue.conversation([
      ['ching', 'Rebar Pacific RP100. Sydney to Hong Kong. Window seat, because you will narrate the wing.'],
      ['bung', 'International rebar diplomat, boarding. The trolley is emotional.'],
    ], () => {
      game.toast('RP100 DEPARTED — HONG KONG', 'red');
      game.loadZone('hongkong');
    });
  }, 4);
  Z.addCollectible('reinforced', new THREE.Vector3(g.x + 6, 1.1, g.z + 2));
}

export function dressHongKong(Z, game, places) {
  const stall = places && places.spawn ? places.spawn : { x: 16, z: 36 };
  const ferry = places && places.ferry ? places.ferry : { x: -18, z: 48 };
  const clock = places && places.clock ? places.clock : { x: 22, z: -30 };
  Z.textSign(stall.x, 4.6, stall.z + 10, 0, 'DIGITECH BLUE MODE\nHARBOUR STREET', { w: 6, h: 1.4, post: true, bg: '#0b1c2e', fg: '#2ee6ff', glow: true });
  Z.interact(stall.x + 6, 0, stall.z - 4, '<b>[E]</b> Smuggler stall — forbidden rebar', () => {
    if ((state.stock.forbidden || 0) < 1) {
      game.say('ching', 'They want Forbidden Rebar. Gabor\'s catalogue. Of course they do.');
      return;
    }
    state.stock.forbidden -= 1;
    addCoins(350);
    state.flags.smugglerDeal = true;
    game.toast('HARBOUR STALL PAID 350 BUNGBUCKS', 'red');
    game.say('bung', 'I have participated in a crime. It was about rebar, so it counts as work.');
  }, 3.6);
  Z.addCollectible('forbidden', new THREE.Vector3(ferry.x + 6, 1.2, ferry.z + 4));
  Z.addCollectible('radioactive', new THREE.Vector3(clock.x + 8, 1.2, clock.z + 6));
}
