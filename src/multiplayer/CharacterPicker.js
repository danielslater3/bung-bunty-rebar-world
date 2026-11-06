import * as THREE from 'three';
import {
  CHARACTERS,
  characterDefinition,
  normalizeAppearance,
} from './catalog.js';
import { buildAvatar, disposeAvatar } from './Avatar.js';
import { el } from './MiniGames.js';

// On-demand portrait renders, with exactly one model/context per join screen.
export class CharacterPicker {
  constructor(parent) {
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem('bung-room-appearance'));
    } catch {}
    this.appearance = normalizeAppearance(stored);
    this.outfits = new Map([
      [this.appearance.character, this.appearance.colors],
    ]);
    this.root = el('section', 'mp-wardrobe');
    this.root.setAttribute('aria-label', 'Choose your multiplayer character');
    const portrait = el('div', 'mp-portrait'),
      controls = el('div', 'mp-wardrobe-controls');
    const heading = el('h2', '', 'YOUR LEGEND. YOUR LOOK.');
    const label = el('label', '', 'Character');
    this.select = el('select');
    this.select.setAttribute('aria-label', 'Your character');
    for (const c of CHARACTERS) {
      const option = el('option', '', c.name);
      option.value = c.id;
      this.select.append(option);
    }
    this.select.value = this.appearance.character;
    this.select.onchange = () => {
      this.outfits.set(this.appearance.character, [...this.appearance.colors]);
      const def = characterDefinition(this.select.value);
      this.appearance = normalizeAppearance({
        character: def.id,
        colors: this.outfits.get(def.id),
      });
      this.rebuild();
    };
    label.append(this.select);
    this.description = el('p', 'mp-character-detail');
    const colors = el('div', 'mp-clothing-colors');
    this.inputs = [
      'Top / shell',
      'Bottoms / panels',
      'Shoes / trim',
      'Accent',
    ].map((title, i) => {
      const wrap = el('label'),
        text = el('span', '', title),
        input = el('input');
      input.type = 'color';
      input.setAttribute('aria-label', title + ' colour');
      input.oninput = () => {
        this.appearance.colors[i] = input.value;
        this.avatar.traverse((o) => {
          if (o.isMesh && o.userData.clothing === i)
            o.material.color.set(input.value);
        });
        this.draw();
      };
      wrap.append(input, text);
      colors.append(wrap);
      return input;
    });
    const reset = el('button', 'mp-button subtle', 'RESET OUTFIT');
    reset.type = 'button';
    reset.onclick = () => {
      this.appearance.colors = [
        ...characterDefinition(this.appearance.character).colors,
      ];
      this.rebuild();
    };
    const turn = el('button', 'mp-button subtle', 'TURN CHARACTER ↻');
    turn.type = 'button';
    turn.onclick = () => {
      this.avatar.rotation.y += Math.PI / 4;
      this.draw();
    };
    controls.append(
      heading,
      label,
      this.description,
      colors,
      reset,
      el(
        'small',
        'mp-character-note',
        'Everyone has the same movement abilities. Your look is remembered on this browser.',
      ),
    );
    portrait.append(turn);
    this.root.append(portrait, controls);
    parent.insertBefore(this.root, parent.querySelector('form'));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#142b40');
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    this.camera.position.set(3, 2.25, 5);
    this.camera.lookAt(0, 1.15, 0);
    this.scene.add(new THREE.HemisphereLight(0xfff3df, 0x507294, 2.5));
    const key = new THREE.DirectionalLight(0xffe6be, 3.2);
    key.position.set(3, 5, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5be4ee, 2);
    rim.position.set(-3, 3, -2);
    this.scene.add(rim);
    this.plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1, 0.12, 32),
      new THREE.MeshStandardMaterial({
        color: 0xb38d39,
        roughness: 0.35,
        metalness: 0.5,
      }),
    );
    this.plinth.position.y = -0.08;
    this.scene.add(this.plinth);
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      this.renderer.setSize(300, 300);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.domElement.setAttribute(
        'aria-label',
        '3D character preview',
      );
      this.renderer.domElement.setAttribute('role', 'img');
      portrait.prepend(this.renderer.domElement);
    } catch {
      portrait.prepend(
        el(
          'p',
          '',
          'Preview unavailable on this device. Your character choice still works.',
        ),
      );
    }
    this.rebuild();
  }
  rebuild() {
    if (this.avatar) disposeAvatar(this.avatar);
    this.avatar = buildAvatar(this.appearance);
    this.scene.add(this.avatar);
    this.avatar.rotation.y = -0.15;
    this.description.textContent = characterDefinition(
      this.appearance.character,
    ).detail;
    this.inputs.forEach(
      (input, i) => (input.value = this.appearance.colors[i]),
    );
    this.draw();
  }
  draw() {
    this.renderer?.render(this.scene, this.camera);
  }
  value() {
    return normalizeAppearance(this.appearance);
  }
  dispose() {
    if (this.avatar) disposeAvatar(this.avatar);
    this.plinth.geometry.dispose();
    this.plinth.material.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.root.remove();
  }
}
