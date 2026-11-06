// Existing saga cast models shared with the multiplayer wardrobe.
import * as THREE from 'three';
import { mat } from '../core/utils.js';

export function makePerson(color, scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.32, 0.86, 8),
    mat(color, { roughness: 0.7 }),
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    mat(0xf0c9a0, { roughness: 0.75 }),
  );
  head.position.y = 1.58;
  g.add(head);
  g.scale.setScalar(scale);
  return g;
}

export function makeGirder() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.8, 0.8),
    mat(0x3a404c, { metalness: 0.65, roughness: 0.35 }),
  );
  body.position.y = 1.1;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.7, 0.7),
    mat(0x2a3038, { metalness: 0.7, roughness: 0.3 }),
  );
  head.position.y = 2.25;
  g.add(head);
  return g;
}
