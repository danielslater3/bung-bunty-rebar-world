import * as THREE from 'three';
import { GAMES } from './catalog.js';
import { RACE_COURSES, raceCourse } from './raceCourses.js';
import { el } from './MiniGames.js';
import { ROOM_FLEET, roomTrolley } from './fleet.js';
import { arenaLive } from './cityActivities.js';

export function trolleyPicker(panel) {
  const section = el('section', 's24-picker mp-trolley-picker');
  const title = el('h3', 's24-picker-title', 'Your trolley');
  const label = el('label', '', 'Trolley edition');
  label.htmlFor = 'mp-trolley-edition';
  const select = el('select');
  select.id = label.htmlFor;
  for (const t of ROOM_FLEET) {
    const option = el('option', '', t.name);
    option.value = t.id;
    select.append(option);
  }
  const swatches = el('div', 'mp-fleet-swatches');
  swatches.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) swatches.append(el('i'));
  const paint = () => {
    const t = roomTrolley(select.value);
    for (const [i, color] of [t.metal, t.trim, t.flag].entries())
      swatches.children[i].style.backgroundColor = '#' + color.toString(16).padStart(6, '0');
  };
  select.value = roomTrolley(localStorage.getItem('bung-room-trolley')).id;
  select.onchange = paint;
  paint();
  section.append(title, label, select, swatches,
    el('p', '', 'Ten S24-inspired editions. All trolleys get the same race tuning.'));
  panel.append(section);
  return () => {
    const id = roomTrolley(select.value).id;
    localStorage.setItem('bung-room-trolley', id);
    return id;
  };
}

export class ActivityUI {
  constructor(mp, parent) {
    this.mp = mp;
    this.seen = new Set();
    this.root = el('section', 'mp-activity-toast');
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Room activity invitation');
    this.text = el('div');
    this.text.setAttribute('aria-live', 'polite');
    this.join = el('button', 'mp-activity-join', 'JOIN');
    this.dismiss = el('button', '', 'DISMISS');
    this.root.append(this.text, this.join, this.dismiss);
    parent.append(this.root);
  }

  hide() {
    this.key = null;
    this.root.hidden = true;
    this.refreshAt = 0;
  }

  update() {
    const mp = this.mp, room = mp.room, now = mp.client.now(), id = mp.client.id;
    if (this.lastRoom === room && now < this.refreshAt) return;
    this.lastRoom = room;
    this.refreshAt = now + 250;
    const offers = [];
    const offer = (key, title, player, at, label, join, until = at + 26000, decline = null) => {
      if (key && player !== id && now < until) offers.push({ key, title, player, at, label, join, decline });
    };
    const { ring, hunt, race } = room.events || {};
    if (race?.status === 'recruiting' && !race.entries[id])
      offer(race.id, raceCourse(race.course).name, race.host, race.created, 'JOIN RACE',
        () => mp.client.command('raceJoin', { event: race.id }), race.deadline);
    for (const [e, title, cmd] of [[ring, 'Ring Rush', 'ringStart'], [hunt, 'Rebar Hunt', 'huntStart']]) {
      if (e?.status !== 'running') continue;
      offer(e.id, title, e.host, e.created, 'JOIN', () => {
        mp.client.command(cmd);
        mp.hidePanels();
      }, e.created + 26000, () => mp.client.command(cmd === 'ringStart' ? 'ringCancel' : 'huntLeave'));
    }
    for (const g of Object.values(room.games)) {
      const def = GAMES.find(x => x.id === g.id);
      if (!def || g.status === 'finished') continue;
      const seated = g.players.includes(id);
      if (g.status === 'waiting' && !seated) {
        const space = g.players.length < def.max;
        offer(g.instance, def.name, g.owner, g.created, space ? 'JOIN TABLE' : 'WATCH TABLE', () => {
          mp.hidePanels();
          if (space) mp.client.command('joinGame', { game: g.id });
          mp.mini.open(g.id);
        });
      } else if (g.status === 'playing' && (!seated || mp.mini.selected !== g.id)) {
        offer(g.instance + ':live', def.name + ' is live', g.owner, g.started, seated ? 'PLAY' : 'WATCH', () => {
          mp.hidePanels();
          mp.mini.open(g.id);
        });
      }
    }
    const arena = room.arena;
    if (arena?.phase === 'waiting' && arena.players.length && !arena.players.includes(id))
      offer(arena.invite, 'Burger Heist', arena.players[0], arena.opened, 'JOIN QUEUE', () => {
        mp.client.command('arenaJoin', { size: arena.size });
        mp.openBoard('arena');
      });
    if (arenaLive(arena) && arena.invite && !arena.players.includes(id))
      offer(arena.invite + ':live', 'Burger Heist is live', arena.players[0], arena.started, 'WATCH', () => {
        mp.client.command('arenaWatch');
        mp.hidePanels();
      });
    const quest = room.quest;
    if (quest?.invite && quest.status !== 'complete' && quest.roles.includes(null) && !quest.roles.includes(id))
      offer(quest.invite, 'Great Brisbane Rebar Rescue', quest.inviter, quest.opened, 'JOIN CREW', () => {
        mp.client.command('questJoin');
        mp.openBoard('quest');
      });
    if (quest?.status === 'playing' && quest.invite && !quest.roles.includes(id) && !quest.roles.includes(null))
      offer(quest.invite + ':live', 'Rebar Rescue has started', quest.inviter, quest.started, 'VIEW CREW',
        () => mp.openBoard('quest'));
    const newRace = race?.status === 'recruiting' && !this.seen.has(race.id) && offers.find(o => o.key === race.id);
    if (this.key && (newRace || !offers.some(o => o.key === this.key))) this.hide();
    if (this.key) return;
    const next = newRace || offers.filter(o => !this.seen.has(o.key)).sort((a, b) => b.at - a.at)[0];
    if (!next) return;
    this.seen.add(next.key);
    if (this.seen.size > 80) this.seen.delete(this.seen.values().next().value);
    this.key = next.key;
    this.root.hidden = false;
    this.text.replaceChildren(el('strong', '', next.title),
      el('small', '', mp.name(next.player) + ' opened a room activity'));
    this.join.textContent = next.label;
    this.join.onclick = () => { this.hide(); next.join(); };
    this.dismiss.textContent = next.decline ? 'SKIP' : 'DISMISS';
    this.dismiss.onclick = () => {
      this.hide();
      next.decline?.();
      if (!mp.focus) mp.game.input.lock();
    };
    this.join.title = 'J · Accept invitation';
    this.dismiss.title = 'K · Dismiss invitation';
    if (!mp.focus && !mp.raceEntry() && !(arenaLive(room.arena) && room.arena.players.includes(id)))
      mp.game.input.unlock();
  }
}

export function drawRaces(mp, panel) {
  const race = mp.room.events?.race, self = mp.client.id;
  const open = race && race.status !== 'finished';
  const section = el('section', 'mp-quest-card');
  section.append(el('small', 'mp-eyebrow', 'BRISBANE ROAD LEAGUE'),
    el('h3', '', open ? raceCourse(race.course).name : 'TROLLEY RACES'),
    el('p', '', open ? (race.status === 'recruiting' ? 'Starting grid open · ' : 'Race in progress · ') +
      Object.keys(race.entries).length + ' drivers' : 'Join the countdown and get a trolley at the starting line. Drive through gates in order. Gold gates boost or refuel you.'));
  if (open && race.status === 'recruiting' && !race.entries[self])
    mp.roomButton(section, 'JOIN STARTING GRID', () => { mp.client.command('raceJoin', { event: race.id }); mp.hidePanels(); }, 'gold');
  if (open && race.entries[self] && !race.entries[self].finished) {
    if (race.status === 'running')
      mp.roomButton(section, 'RESET TO LAST GATE · +5s', () => { mp.client.command('raceReset'); mp.hidePanels(); });
    mp.roomButton(section, 'LEAVE RACE', () => mp.client.command('raceLeave'), 'subtle');
  }
  for (const [i, r] of (race?.results || []).entries())
    section.append(el('p', 'mp-score-line', `${i + 1}. ${mp.name(r.id)} · ${(r.time / 1000).toFixed(1)}s`));
  panel.append(section);
  const cards = el('div', 'mp-game-grid');
  for (const course of RACE_COURSES) {
    const card = el('button', 'mp-game-choice');
    card.disabled = !!open;
    card.append(el('small', '', course.description), el('b', '', course.name),
      el('span', '', `${(course.length / 1000).toFixed(1)} km · ${course.gates.length} checkpoints`));
    card.onclick = () => { mp.client.command('raceStart', { course: course.id }); mp.hidePanels(); };
    cards.append(card);
  }
  panel.append(cards);
}

export function raceArch() {
  const arch = new THREE.Group();
  const trim = new THREE.MeshStandardMaterial({ color: 0xf3bd42, metalness: .28, roughness: .43 });
  const post = new THREE.BoxGeometry(.34, 4.8, .5);
  const rail = new THREE.BoxGeometry(12, .55, .63);
  for (const x of [-5.6, 5.6]) {
    const mesh = new THREE.Mesh(post, trim);
    mesh.position.set(x, 2.4, 0);
    arch.add(mesh);
  }
  const beam = new THREE.Mesh(rail, trim);
  beam.position.y = 4.8;
  arch.add(beam);
  const check = new THREE.MeshBasicMaterial({ color: 0x172136 });
  const tile = new THREE.BoxGeometry(.48, .23, .68);
  const tiles = new THREE.InstancedMesh(tile, check, 24);
  const transform = new THREE.Matrix4();
  for (let i = 0; i < tiles.count; i++)
    tiles.setMatrixAt(i, transform.makeTranslation((i - 11.5) * .48, 4.8 + (i % 2 ? .13 : -.13), 0));
  arch.add(tiles);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 1.22),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  banner.position.set(0, 4.62, -.37);
  arch.add(banner);
  arch.userData.sign = text => {
    if (text === arch.userData.label) return;
    arch.userData.label = text;
    ctx.fillStyle = '#142139';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#ffe28f';
    ctx.font = 'bold 47px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48, 480);
    texture.needsUpdate = true;
  };
  arch.userData.trim = trim;
  arch.visible = false;
  return arch;
}
