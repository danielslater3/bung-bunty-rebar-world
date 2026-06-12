// World NPCs: Ching (mission controller / rebar ally) and Gabor (pest).
import * as THREE from 'three';
import { buildChing, buildGabor, buildScooter } from './models.js';
import { dampAngle } from '../core/utils.js';

export class NPC {
  constructor(game, kind, pos, ry = 0) {
    this.game = game;
    this.kind = kind; // 'ching' | 'gabor'
    this.pos = pos.clone();
    this.mesh = kind === 'ching' ? buildChing() : buildGabor();
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = ry;
    this.baseRy = ry;
    this.t = Math.random() * 10;
    game.zone.group.add(this.mesh);

    if (kind === 'gabor') {
      this.scooter = buildScooter();
      this.scooter.position.copy(pos).add(new THREE.Vector3(1.2, 0, 0));
      this.scooter.rotation.y = ry + 0.4;
      game.zone.group.add(this.scooter);
    }

    // Floating marker
    const markerColor = kind === 'ching' ? 0x2ee6ff : 0xff2e5f;
    this.marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color: markerColor })
    );
    this.marker.position.copy(pos).add(new THREE.Vector3(0, 2.5, 0));
    game.zone.group.add(this.marker);
  }

  update(dt) {
    this.t += dt;
    this.marker.position.y = this.pos.y + 2.5 + Math.sin(this.t * 2.5) * 0.12;
    this.marker.rotation.y += dt * 2;

    // Face the player when close
    const toP = this.game.player.pos.clone().sub(this.pos);
    const dist = toP.length();
    if (dist < 8) {
      const target = Math.atan2(toP.x, toP.z);
      this.mesh.rotation.y = dampAngle(this.mesh.rotation.y, target, 6, dt);
    } else {
      this.mesh.rotation.y = dampAngle(this.mesh.rotation.y, this.baseRy, 2, dt);
    }
    // Idle bob for the head
    const head = this.mesh.userData.head;
    if (head) head.rotation.z = Math.sin(this.t * 1.4) * 0.04;
  }
}
