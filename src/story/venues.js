import * as THREE from 'three';
import { state, SaveSystem } from '../core/state.js';
import { positionClear } from '../core/motion.js';
import { stageCast, placeActor } from './actors.js';
import { interiorKit, createPalette } from './venueInterior.js';
import {
  HOTEL_ENTRY,
  COURT_ENTRY,
  HOTEL_FLOORS,
  HOTEL_STOPS,
  hotelTarget,
} from './venueData.js';

export class StoryVenues {
  constructor(saga) {
    this.saga = saga;
    this.Z = saga.game.zone;
    this.points = {};
    this.floor = null;
    this.pending = null;
    this.palette = createPalette();
    this.unit = new THREE.BoxGeometry(1, 1, 1);
    this.mouthGeometry = new THREE.BoxGeometry(0.12, 0.025, 0.025);
    this.cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
    this.sphere = new THREE.SphereGeometry(1, 10, 8);
    this.evidence = {};
    this.makeEvidence();
    this.addStreet('hotel-enter', HOTEL_ENTRY, 'Enter W Brisbane', () => {
      if (state.saga.chapter !== 9) {
        saga.game.say(
          'bung',
          'W Brisbane. A destination for a victory, and a very expensive singlet.',
        );
        return;
      }
      this.enter('hotel', 0, true, true);
      if (saga.currentStep()?.id === 'enter') saga.advance();
    });
    this.addStreet(
      'court-enter',
      COURT_ENTRY,
      'Enter the fictional rebar hearing',
      () => {
        if (state.saga.chapter === 8) this.enter('court', 0);
      },
    );
    this.points['hotel-entry'] = this.points['hotel-enter'];
    this.points.court = this.points['court-enter'];
    const sample = this.Z.sampleGround.bind(this.Z),
      ground = this.Z.groundAt.bind(this.Z);
    const inside = (x, z, y) =>
      this.floor &&
      this.floor.room.contains({ x, z }) &&
      Math.abs((y ?? this.floor.room.floor) - this.floor.room.floor) < 5;
    this.Z.sampleGround = (x, z, y) =>
      inside(x, z, y) ? this.floor.room.floor : sample(x, z, y);
    this.Z.groundAt = (x, z, y) =>
      inside(x, z, y) ? this.floor.room.floor : ground(x, z, y);
    this.Z.cleanups.push(() => {
      this.unload();
      for (const g of Object.values(this.evidence)) {
        for (const m of g.userData.ownedMaterials || []) m.dispose();
        g.traverse((o) => {
          if (Array.isArray(o.material))
            for (const m of new Set(o.material)) {
              m.map?.dispose?.();
              m.dispose();
            }
        });
      }
      document.getElementById('hotel-lift-menu')?.remove();
      document.getElementById('hotel-transfer')?.remove();
      for (const m of Object.values(this.palette)) m.dispose();
      this.unit.dispose();
      this.mouthGeometry.dispose();
      this.cylinder.dispose();
      this.sphere.dispose();
      this.restoreNight();
    });
    if (state.saga.venue && [8, 9].includes(state.saga.chapter)) {
      this.enter(state.saga.venue.kind, state.saga.venue.floor, false);
      const p = saga.game.player.pos;
      if (!this.room(p.x, p.y + 1, p.z) || !positionClear(p, 0.45, this.Z))
        this.teleport(
          this.points[
            state.saga.venue.kind === 'hotel' ? 'hotel-lift' : 'court-stand'
          ],
        );
    }
  }
  hotel() {
    return (
      state.saga.hotel ||
      (state.saga.hotel = { key: false, roomOpen: false, visited: {} })
    );
  }
  addStreet(id, p, label, fn) {
    const y = this.saga.ground(p.x, p.z);
    this.points[id] = new THREE.Vector3(p.x, y, p.z);
    this.saga.interact(id, p, y, `<b>[E]</b> ${label}`, fn, 3.4);
  }
  person(x, z, id, root, base, color) {
    const g = new THREE.Group();
    g.position.set(base.x + x, base.y, base.z + z);
    root.add(g);
    const body = new THREE.Mesh(
      this.cylinder,
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    body.scale.set(0.29, 0.85, 0.29);
    body.position.y = 0.95;
    g.add(body);
    const head = new THREE.Mesh(this.sphere, this.palette.cream);
    head.scale.set(0.22, 0.27, 0.22);
    head.position.y = 1.65;
    g.add(head);
    g.userData.head = head;
    for (const dx of [-0.075, 0.075]) {
      const e = new THREE.Mesh(this.sphere, this.palette.dark);
      e.scale.set(0.035, 0.045, 0.025);
      e.position.set(dx, 1.68, 0.2);
      g.add(e);
    }
    const mouth = new THREE.Mesh(this.mouthGeometry, this.palette.rose);
    mouth.position.set(0, 1.56, 0.22);
    g.add(mouth);
    g.userData.mouth = mouth;
    for (const dx of [-0.34, 0.34]) {
      const arm = new THREE.Mesh(this.cylinder, this.palette.cream);
      arm.scale.set(0.09, 0.62, 0.09);
      arm.position.set(dx, 1.02, 0);
      g.add(arm);
    }
    for (const dx of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(this.unit, this.palette.dark);
      leg.position.set(dx, 0.35, 0);
      leg.scale.set(0.19, 0.7, 0.2);
      g.add(leg);
    }
    if (id === 'judge') {
      const wig = new THREE.Mesh(this.sphere, this.palette.cream);
      wig.position.y = 1.85;
      wig.scale.set(0.27, 0.12, 0.25);
      g.add(wig);
      this.saga.actors.judge = g;
    }
    root.userData.ownedMaterials ||= [];
    root.userData.ownedMaterials.push(body.material);
    return g;
  }
  setExterior(kind, active) {
    const v = this.Z.venues[kind];
    if (!v) return;
    v.root.visible = !active;
    // Toggle only this mapped solid, leaving every surrounding building intact.
    for (const list of this.Z.footBuckets.values())
      for (const p of list) if (p.r === v.building.r) p.disabled = active;
  }
  unload() {
    const f = this.floor;
    if (!f) return;
    this.Z.colliders = this.Z.colliders.filter((b) => !f.cols.includes(b));
    this.Z.grounds = this.Z.grounds.filter((m) => !f.grounds.includes(m));
    if (this.Z._baseGrounds)
      this.Z._baseGrounds = this.Z._baseGrounds.filter(
        (m) => !f.grounds.includes(m),
      );
    this.Z.interactables = this.Z.interactables.filter(
      (i) => !f.interactions.includes(i),
    );
    for (const m of f.root.userData.ownedMaterials || []) m.dispose();
    f.root.traverse((o) => {
      if (Array.isArray(o.material)) {
        for (const m of new Set(o.material)) {
          m.map?.dispose?.();
          m.dispose();
        }
        o.geometry.dispose();
      }
    });
    for (const id of f.floorPoints) delete this.points[id];
    f.root.userData.detachedJudge?.removeFromParent();
    f.root.removeFromParent();
    for (const id of Object.keys(this.points))
      if (
        hotelTarget(id) !== undefined ||
        id.startsWith('hotel-door-') ||
        id === 'hotel-lift' ||
        id === 'hotel-exit' ||
        id === 'court-return' ||
        id === 'court-stand'
      )
        delete this.points[id];
    this.setExterior(f.room.venue, false);
    this.floor = null;
  }
  enter(kind, level = 0, move = true, arrival = false) {
    if (!['hotel', 'court'].includes(kind) || !this.Z.venues[kind])
      return false;
    if (kind === 'hotel' && !HOTEL_FLOORS.some((f) => f.n === level)) level = 0;
    this.unload();
    this.setExterior(kind, true);
    this.floor = interiorKit(this, kind, level);
    state.saga.venue = { kind, floor: level };
    if (move) {
      const p =
        kind === 'hotel'
          ? this.points[arrival ? 'hotel-arrival' : 'hotel-lift']
          : this.points['court-stand'];
      this.teleport(p);
    }
    this.saga.actors.guide?.userData.controller?.reset?.();
    this.saga.resetTalk();
    return true;
  }
  teleport(p) {
    const g = this.saga.game;
    g.trolley.dismiss();
    g.player.teleport(new THREE.Vector3(p.x, p.y + 0.08, p.z));
    g.actorPrev.player.copy(g.player.pos);
    this.saga.snapCamera();
    if (
      this.floor?.room.venue === 'hotel' &&
      this.floor.room.frame.local(p).z < 0
    ) {
      g.camYaw = Math.PI - 0.714;
      g.camPos.set(
        p.x - Math.sin(0.714) * 3,
        p.y + 2.2,
        p.z - Math.cos(0.714) * 3,
      );
      g.camera.position.copy(g.camPos);
    }
    if (this.saga.actors.ching) {
      delete this.saga.actors.ching.userData.follow;
      placeActor(
        this.saga,
        this.saga.actors.ching,
        { x: p.x + 2.5, y: p.y, z: p.z + 1 },
        [g.player.mesh],
      );
    }
  }
  leave() {
    const kind = this.floor?.room.venue;
    if (!kind) return;
    this.unload();
    state.saga.venue = null;
    this.teleport(
      this.points[kind === 'hotel' ? 'hotel-enter' : 'court-enter'],
    );
    SaveSystem.save(this.saga.game);
  }
  point(id) {
    return this.points[id]?.clone() || null;
  }
  room(x, y, z) {
    const r = this.floor?.room;
    return r && r.contains({ x, z }) && y > r.floor - 1 && y < r.ceil + 0.6
      ? r
      : null;
  }
  target(step) {
    if (!step) return null;
    let id = step.at,
      label = step.text;
    if (step.kind === 'evidence') {
      const got = state.saga.stepState.evidenceGot || {};
      const item = step.items.find((i) => !got[i.id]);
      id = item?.id;
      label = `EVIDENCE ${step.items.filter((i) => got[i.id]).length}/${step.items.length} · ${item?.id?.toUpperCase() || 'SECURED'}`;
    }
    if (step.kind === 'amenities') {
      id = HOTEL_STOPS.find((i) => !this.hotel().visited[i]);
      label = `HOTEL ${HOTEL_STOPS.filter((i) => this.hotel().visited[i]).length}/4 · ${id?.replace('hotel-', '').toUpperCase() || 'DONE'}`;
    }
    if (state.saga.chapter === 8 && step.id === 'print') {
      id = 'evidence-print';
      label = 'QUEEN STREET · PRINT THE EVIDENCE';
    }
    const targetLevel = hotelTarget(id);
    if (state.saga.chapter === 9 && targetLevel !== undefined) {
      if (!this.floor || this.floor.room.venue !== 'hotel')
        return {
          target: this.points['hotel-enter'],
          label: `ENTER W BRISBANE · ${label}`,
        };
      if (this.floor.room.level !== targetLevel)
        return {
          target: this.points['hotel-lift'],
          label: `LIFT → ${targetLevel === 0 ? 'WELCOME' : `LEVEL ${targetLevel}`} · ${label}`,
        };
    }
    let target = this.points[id];
    if (this.floor && target && Math.abs(target.y - this.floor.room.floor) > 3)
      return {
        target:
          this.points[
            this.floor.room.venue === 'hotel' ? 'hotel-exit' : 'court-return'
          ] || this.points['hotel-lift'],
        label: 'EXIT TO THE CITY',
      };
    return target ? { target, label } : null;
  }
  makeEvidence() {
    const saga = this.saga;
    // Keep the story's districts; find a clear standing location near each original anchor.
    for (const [id, anchor] of [
      ['receipt', 'receipt'],
      ['witness', 'witness'],
      ['goggles', 'gogbox'],
      ['evidence-print', 'smash'],
    ]) {
      let p = saga.point(anchor),
        found = false;
      for (const r of [0, 2, 4, 6, 10, 15]) {
        for (let i = 0; i < (r ? 24 : 1); i++) {
          const a = (i * Math.PI) / 12,
            q = new THREE.Vector3(
              p.x + Math.sin(a) * r,
              p.y,
              p.z + Math.cos(a) * r,
            );
          q.y = saga.ground(q.x, q.z);
          if (positionClear(q, 0.9, this.Z)) {
            p = q;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      this.points[id] = p;
      const g = new THREE.Group();
      g.position.copy(p);
      g.name = `Physical evidence · ${id}`;
      g.userData.abs = true;
      this.Z.group.add(g);
      if (id === 'witness') {
        const a = this.person(
          0,
          0,
          'witness',
          g,
          { x: 0, y: 0, z: 0 },
          0x5c778f,
        );
        this.Z.group.attach(a);
        saga.actors.witness = a;
        this.evidenceWitness = a;
      } else {
        const post = new THREE.Mesh(this.unit, this.palette.wood);
        post.position.y = 0.45;
        post.scale.set(1, 0.9, 0.7);
        g.add(post);
        const prop = new THREE.Mesh(
          id === 'goggles' ? this.cylinder : this.unit,
          id === 'goggles' ? this.palette.teal : this.palette.cream,
        );
        prop.position.y = 1;
        prop.scale.set(0.65, 0.09, 0.45);
        g.add(prop);
      }
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.045, 6, 20),
        this.palette.gold,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      g.add(ring);
      this.Z.cleanups.push(() => ring.geometry.dispose());
      const sign = this.Z.textSign(
        p.x,
        p.y + 2.5,
        p.z,
        0,
        id === 'evidence-print'
          ? 'PHOTO PRINT STATION'
          : `${id.toUpperCase()}\nE · INSPECT`,
        { w: 2.4, h: 0.65, bg: '#253345', fg: '#ffdfaa' },
      );
      g.attach(sign);
      const it = this.Z.interactables.find((it) => it.id === id);
      if (it) it.pos.set(p.x, p.y + 0.8, p.z);
      this.evidence[id] = g;
    }
  }
  action(id) {
    const saga = this.saga,
      step = saga.currentStep(),
      s = this.hotel();
    const talk = (lines, done) => {
      stageCast(saga, { cast: ['ching'] });
      saga.game.dialogue.conversation(lines, () => {
        done?.();
        SaveSystem.save(saga.game);
      });
    };
    if (id === 'hotel-reception')
      return talk(
        [
          [
            'staff',
            'Welcome to W Brisbane. Room 901, Wonderful King. Lifts behind you. The Lex on three, WET on four, AWAY on five, FIT on six.',
          ],
          ['bung', 'A key card. My normal door accepts a trolley collision.'],
          ['ching', 'We are trying the card first.'],
        ],
        () => {
          s.key = true;
          if (step?.id === 'checkin') saga.advance();
        },
      );
    if (id === 'hotel-room-door') {
      if (step?.id === 'room-door') saga.advance();
      SaveSystem.save(saga.game);
      return;
    }
    if (id === 'hotel-mixbar')
      return talk(
        [
          [
            'bung',
            'A river view, a drum bath and a Mixbar. This room has more plot than my garage.',
          ],
          ['ching', 'And the new phone stays away from the bath.'],
        ],
        () => {
          s.roomSeen = true;
          if (step?.id === 'room-tour') saga.advance();
        },
      );
    if (HOTEL_STOPS.includes(id)) {
      const lines = {
        'hotel-bar': [
          ['ching', 'A seat by the river. No chase, no evidence bags.'],
          [
            'bung',
            'I ordered something with an umbrella. The trolley asked for a load rating.',
          ],
        ],
        'hotel-pool': [
          ['ching', 'Level four. A pool above the river.'],
          [
            'bung',
            'I will stay poolside. Steel is a spectacularly poor flotation aid.',
          ],
        ],
        'hotel-spa': [
          [
            'bung',
            'The therapist asked where I hold tension. I said the rebar cupboard.',
          ],
          ['ching', 'Try your shoulders.'],
        ],
        'hotel-gym': [
          [
            'bung',
            'Three controlled reps. Finally, a room that understands the rebar lifestyle.',
          ],
          ['ching', "Put the weights back. This is a hotel, not Seb's yard."],
        ],
      };
      return talk(lines[id], () => {
        s.visited[id] = true;
        saga.game.toast(
          `HOTEL DISCOVERED · ${Object.keys(s.visited).length}/4`,
          'gold',
        );
        if (
          step?.kind === 'amenities' &&
          HOTEL_STOPS.every((k) => s.visited[k])
        )
          saga.advance();
      });
    }
    if (id === 'hotel-meal') {
      if (step?.id !== 'dinner') {
        saga.game.say(
          'staff',
          'Your victory table is reserved. Explore, then come back for dinner.',
        );
        return;
      }
      return talk(
        [
          [
            'staff',
            'The Lex. A celebratory grill dinner, with absolutely no structural steel in the garnish.',
          ],
          [
            'bung',
            'The court says ten thousand. The menu says do not spend it all at once.',
          ],
          ['gabor', 'I was not invited, which is why I am on time.'],
          [
            'ching',
            'You can stay for the song. You cannot touch the new phone.',
          ],
        ],
        () => saga.advance(),
      );
    }
    if (id === 'newphone') {
      if (step?.id === 'newphone') saga.onStory('newphone');
      return;
    }
    if (id === 'hotel-night') {
      if (step?.id !== 'night') {
        saga.game.say('ching', 'Brisbane has a good view. Stay a minute.');
        return;
      }
      s.night = true;
      this.setNight();
      return talk(
        [
          [
            'ching',
            'Look at the river. One afternoon of broken glass; a whole city still lit up.',
          ],
          [
            'bung',
            'Same edition. New glass. Four hairs against the skyline. We have done all right.',
          ],
        ],
        () => saga.advance(),
      );
    }
  }
  setNight() {
    if (this.nightBackup) return;
    const g = this.saga.game;
    this.nightBackup = {
      background: g.scene.background?.clone(),
      fog: g.scene.fog?.color.clone(),
      lights: [],
    };
    g.scene.traverse((o) => {
      if (o.isDirectionalLight || o.isHemisphereLight) {
        this.nightBackup.lights.push([o, o.intensity]);
        o.intensity *= 0.3;
      }
    });
    g.scene.background = new THREE.Color(0x162b47);
    if (g.scene.fog) g.scene.fog.color.set(0x162b47);
  }
  restoreNight() {
    if (!this.nightBackup) return;
    const g = this.saga.game;
    g.scene.background = this.nightBackup.background;
    for (const [o, i] of this.nightBackup.lights) o.intensity = i;
    if (g.scene.fog && this.nightBackup.fog)
      g.scene.fog.color.copy(this.nightBackup.fog);
    this.nightBackup = null;
  }
  closeLiftMenu() {
    document.getElementById('hotel-lift-menu')?.remove();
    this.saga.freeze = false;
    this.saga.game.input.enabled = true;
    this.saga.game.input.lock();
  }
  liftMenu() {
    if (!this.floor || this.pending || this.saga.game.dialogue.cinematic)
      return;
    const saga = this.saga;
    saga.freeze = true;
    saga.game._wasLocked = false;
    saga.game.input.enabled = false;
    saga.game.input.unlock();
    document.getElementById('hotel-lift-menu')?.remove();
    const el = document.createElement('div');
    el.id = 'hotel-lift-menu';
    el.className = 'venue-modal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'W Brisbane floor directory');
    const card = document.createElement('div');
    card.className = 'venue-card';
    card.innerHTML = `<small>W BRISBANE · LIFT</small><h2>Where to?</h2><p>Current floor: ${this.floor.room.level === 0 ? 'WELCOME' : this.floor.room.level}</p>`;
    for (const f of HOTEL_FLOORS) {
      const b = document.createElement('button');
      b.className = 'mbtn';
      b.textContent = `${f.n === 0 ? 'G' : f.n} · ${f.name}`;
      b.disabled =
        f.n === this.floor.room.level || (f.n >= 9 && !this.hotel().key);
      b.onclick = () => {
        el.remove();
        saga.game.input.enabled = true;
        this.pending = { to: f.n, time: 0, moved: false };
        const shade = document.createElement('div');
        shade.id = 'hotel-transfer';
        shade.innerHTML = `<span>W · LIFT TO ${f.n === 0 ? 'WELCOME' : f.n}</span>`;
        document.body.appendChild(shade);
        saga.game.input.lock();
      };
      card.appendChild(b);
    }
    const cancel = document.createElement('button');
    cancel.className = 'mbtn';
    cancel.textContent = 'BACK';
    cancel.onclick = () => this.closeLiftMenu();
    card.appendChild(cancel);
    el.appendChild(card);
    document.body.appendChild(el);
    card.querySelector('button:not(:disabled)')?.focus();
  }
  update(dt) {
    const saga = this.saga;
    if (this.pending) {
      const p = this.pending;
      p.time += Math.min(dt, 0.1);
      saga.freeze = true;
      const shade = document.getElementById('hotel-transfer');
      if (shade)
        shade.style.opacity = Math.min(
          1,
          p.time / 0.5,
          Math.max(0, (1.8 - p.time) / 0.5),
        );
      if (p.time >= 0.65 && !p.moved) {
        p.moved = true;
        this.enter('hotel', p.to);
        SaveSystem.save(saga.game);
      }
      const t =
        p.time < 0.65
          ? Math.max(0, 1 - p.time / 0.5)
          : Math.min(1, (p.time - 0.9) / 0.6);
      this.liftDoors?.forEach(
        (o, i) =>
          (o.position.x =
            this.liftDoorX[i] + (i ? 1 : -1) * Math.max(0, t) * 0.65),
      );
      if (p.time >= 1.8) {
        this.pending = null;
        saga.freeze = false;
        shade?.remove();
        saga.snapCamera();
      }
    }
    for (const d of this.floor?.doors || []) {
      if (d.panel) {
        d.slide += (d.target - d.slide) * (1 - Math.exp(-7 * dt));
        d.panel.position.z = d.initial + d.slide * 2.6;
      } else {
        d.angle += (d.target - d.angle) * (1 - Math.exp(-7 * dt));
        d.pivot.rotation.y = d.angle;
      }
    }
    for (const [id, g] of Object.entries(this.evidence))
      g.visible =
        state.saga.chapter === 8 &&
        (saga.currentStep()?.kind === 'evidence'
          ? !state.saga.stepState.evidenceGot?.[id]
          : saga.currentStep()?.id === 'print' && id === 'evidence-print');
    if (this.evidenceWitness)
      this.evidenceWitness.visible = this.evidence.witness.visible;
    if (
      this.floor &&
      this.floor.room.venue === 'court' &&
      state.saga.chapter !== 8
    )
      this.leave();
    if (this.nightBackup && (!this.floor || this.floor.room.venue !== 'hotel'))
      this.restoreNight();
  }
  pose() {
    if (
      this.floor?.room.venue === 'court' &&
      ['trial', 'verdict'].includes(this.saga.currentStep()?.id)
    ) {
      const { saga } = this,
        b = this.floor.base;
      for (const [name, x, z] of [
        ['ching', -4, 2],
        ['gabor', 6, -3],
      ]) {
        const a = saga.actors[name];
        a.visible = true;
        placeActor(saga, a, this.floor.frame.world({ x, y: b.y, z }), [
          saga.game.player.mesh,
        ]);
        a.rotation.y = Math.PI;
      }
    }
  }
}
