import * as THREE from 'three';
import { buildAvatar, animateAvatar, disposeAvatar } from './Avatar.js';
import { CharacterPicker } from './CharacterPicker.js';
import { state, DEFAULT_STATE, SaveSystem } from '../core/state.js';
import { buildTrolley, buildRebar, buildBurger } from '../entities/models.js';
import {
  RoadNetwork,
  NavigationController,
  localRoute,
  atDistance,
  turnToward,
} from '../systems/Navigation.js';
import { buildGuide, segmentClear } from '../story/guide.js';
import { positionClear } from '../core/motion.js';
import { RoomClient } from './RoomClient.js';
import { MiniGames, el } from './MiniGames.js';
import { ROOM_SERVER } from './config.js';
import {
  GAMES,
  COLORS,
  SPAWN,
  RALLY,
  QUEST_STAGES,
  ROLES,
  normalizeAppearance,
  characterDefinition,
} from './catalog.js';

export class Multiplayer {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.peers = new Map();
    this.mini = new MiniGames(this);
    this.focus = false;
    this.muted = new Set();
    this.lastSent = 0;
    this.lastPing = 0;
    this.handleKeys = (e) => {
      if (!this.active) return;
      const enter =
        e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
      if (e.target.matches('input,textarea')) {
        e.stopPropagation();
        if (
          enter &&
          e.target.id === 'mp-chat-input' &&
          !e.isComposing &&
          e.keyCode !== 229
        ) {
          e.preventDefault();
          if (!e.repeat) e.target.form?.requestSubmit();
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          this.hidePanels();
        }
        return;
      }
      if (enter && !this.focus && !e.repeat && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        this.openChat();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.focus ? this.hidePanels() : this.openBoard();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        e.stopPropagation();
        this.openBoard();
      } else if (e.code === 'KeyF' && this.mini.selected) {
        e.preventDefault();
        e.stopPropagation();
        this.mini.liveAction();
      }
    };
    window.addEventListener('keydown', this.handleKeys, true);
  }
  endpoint() {
    return (
      sessionStorage.getItem('bung-room-server') ||
      ROOM_SERVER ||
      (['localhost', '127.0.0.1'].includes(location.hostname)
        ? 'http://127.0.0.1:8787'
        : '')
    );
  }
  showLobby() {
    this.game.pauseForMenu();
    const root = this.game.menus._screen('');
    const panel = el('section', 'mp-lobby');
    panel.append(
      el('small', 'mp-eyebrow', 'BRISBANE AFTER HOURS · FREE TO PLAY'),
      el('h1', '', 'TEN BUNGS. ONE CITY.'),
      el(
        'p',
        'mp-intro',
        'Bring the trolley. Bring your mates. Ten ridiculous minigames and a four-player rebar rescue across Brisbane.',
      ),
    );
    const badges = el('div', 'mp-badges');
    for (const t of [
      '10 PLAYER ROOMS',
      '10 MINIGAMES',
      '4 PLAYER QUEST',
      'LIVE ROOM CHAT',
    ])
      badges.append(el('span', '', t));
    panel.append(badges);
    const form = el('form', 'mp-join-form'),
      name = el('input'),
      code = el('input'),
      message = el('p', 'mp-error');
    name.maxLength = 20;
    name.placeholder = 'Your display name';
    name.autocomplete = 'nickname';
    name.setAttribute('aria-label', 'Your player name');
    name.value = localStorage.getItem('bung-room-name') || '';
    code.placeholder = 'ROOM CODE';
    code.maxLength = 8;
    code.autocomplete = 'off';
    code.setAttribute('aria-label', 'Eight-character room code');
    code.value = new URLSearchParams(location.search).get('room') || '';
    const create = el('button', 'mp-button gold', 'CREATE A ROOM'),
      join = el('button', 'mp-button', 'JOIN YOUR MATES');
    create.type = 'button';
    join.type = 'submit';
    form.append(name, code, create, join);
    panel.append(form, message);
    const settings = el('details', 'mp-server-setting'),
      summary = el('summary', '', 'Use a community server'),
      server = el('input');
    server.type = 'url';
    server.placeholder = 'https://your-room-server.workers.dev';
    server.value = this.endpoint();
    server.setAttribute('aria-label', 'Community server address');
    settings.append(summary, server);
    panel.append(settings);
    if (!this.endpoint())
      message.textContent =
        'The online room service needs to be connected. A community server can also be used.';
    this.picker?.dispose();
    this.picker = new CharacterPicker(panel);
    const go = async (fresh) => {
      try {
        create.disabled = join.disabled = true;
        message.textContent = 'CONNECTING YOUR ENORMOUS ENTOURAGE…';
        if (!server.value.trim())
          throw Error('The room server has not been connected yet.');
        const events = {
          message: (m) => this.receive(m),
          connection: (v) => this.connection(v),
          error: (s) => this.error(s),
        };
        this.client?.close();
        this.client = new RoomClient(server.value.trim(), events);
        sessionStorage.setItem('bung-room-server', this.client.endpoint);
        localStorage.setItem('bung-room-name', name.value.trim() || 'Bung');
        const room = fresh ? await this.client.create() : code.value;
        const appearance = this.picker.value();
        localStorage.setItem(
          'bung-room-appearance',
          JSON.stringify(appearance),
        );
        await this.client.join(room, name.value.trim() || 'Bung', appearance);
        this.picker.dispose();
        this.picker = null;
        await this.enter();
      } catch (e) {
        message.textContent = e.message;
        this.client?.close();
      } finally {
        create.disabled = join.disabled = false;
      }
    };
    create.onclick = () => go(true);
    form.onsubmit = (e) => {
      e.preventDefault();
      go(false);
    };
    const back = el('button', 'mp-button subtle', 'BACK TO THE SAGA');
    back.onclick = () => {
      this.picker?.dispose();
      this.picker = null;
      this.game.menus.showMain();
    };
    panel.append(back);
    root.append(panel);
  }
  async enter() {
    const g = this.game;
    if (g.loading) throw Error('The city is still loading.');
    if (['playing', 'paused'].includes(g.mode)) SaveSystem.save(g);
    this.previous = structuredClone(state);
    this.active = true;
    document.body.classList.add('multiplayer-active');
    Object.assign(state, DEFAULT_STATE(), {
      _multiplayer: true,
      currentZone: 'brisbane',
      flags: { trolleyUnlocked: true },
      settings: this.previous.settings,
    });
    g.loading = true;
    document.body.classList.add('chapter-loading');
    try {
      g.dialogue.clear();
      g.saga.scenePlaying = false;
      g.saga.freeze = false;
      g.photo = false;
      g.menus.close();
      g.audio.init();
      g.audio.resume();
      g.mode = 'playing';
      const ok = await g.loadZone('brisbane', true);
      if (!ok) throw Error('Brisbane could not load.');
      g.zone.spawners = [];
      g.allEnemies = [];
      g.zone.portals = [];
      this.root = new THREE.Group();
      this.root.name = 'Multiplayer Brisbane';
      g.zone.group.add(this.root);
      this.guide = buildGuide(this.root);
      const clear = (a, b) => segmentClear(g.zone, a, b, 0.6);
      this.network = new RoadNetwork(
        g.geoBrisbane.roads,
        (x, z) => g.zone.terrain.walkAt(x, z),
        clear,
      );
      this.navigation = new NavigationController((a, b) => {
        const local =
          Math.hypot(a.x - b.x, a.z - b.z) < 65 ? localRoute(a, b, clear) : [];
        return local.length ? local : this.network.route(a, b, clear);
      }, clear);
      this.originalChildren = g.player.mesh.children.map((o) => [o, o.visible]);
      for (const [o] of this.originalChildren)
        if (!o.isLight) o.visible = false;
      this.selfAvatar = buildAvatar(
        this.room.players[this.client.id]?.appearance,
      );
      g.player.mesh.add(this.selfAvatar);
      this.trolleyModel = buildTrolley();
      this.prepareWorld();
      const p = this.room.players[this.client.id]?.pos || SPAWN;
      const gy = g.zone.groundAt(p.x, p.z);
      const target = { x: p.x, y: gy + 0.1, z: p.z };
      if (!positionClear(target, 0.6, g.zone))
        throw Error('The room spawn is obstructed.');
      g.player.teleport(new THREE.Vector3(target.x, target.y, target.z));
      g.saga.snapCamera();
      g.player.mesh.visible = true;
      this.mountUI();
      this.syncPeers();
      this.lastSent = 0;
      this.lastPing = 0;
      this.setFocus(false);
      g.hud.show();
      document.getElementById('quest-tracker')?.classList.add('hidden');
      this.error(
        'OIII! Room ' +
          this.room.code +
          ' is ready. B opens the room board; ENTER opens chat.',
      );
    } catch (e) {
      await this.leave();
      throw e;
    } finally {
      g.loading = false;
      document.body.classList.remove('chapter-loading');
    }
  }
  name(id) {
    return this.room?.players[id]?.name || 'A departed Bung';
  }
  receive(m) {
    if (m.type === 'welcome' || m.type === 'state') {
      this.room = m.room;
      if (this.active) {
        this.syncPeers();
        this.refreshUI();
        this.mini.render();
      }
    }
    if (m.type === 'move' && this.room?.players[m.id]) {
      Object.assign(this.room.players[m.id], {
        pos: m.pos,
        yaw: m.yaw,
        riding: m.riding,
      });
      const peer = this.peers.get(m.id);
      if (peer) {
        peer.target.set(m.pos.x, m.pos.y, m.pos.z);
        peer.yaw = m.yaw;
        peer.riding = m.riding;
      }
    }
    if (m.type === 'error') {
      this.error(m.message);
      if (m.pos && /Position corrected/.test(m.message) && this.active) {
        this.game.player.teleport(new THREE.Vector3(m.pos.x, m.pos.y, m.pos.z));
        this.game.trolley.dismiss();
      }
    }
    if (m.type === 'removed') {
      this.error(m.message);
      this.setFocus(true);
    }
  }
  connection(online) {
    if (!this.active) return;
    const s = document.getElementById('mp-connection');
    if (s) {
      s.textContent = online ? '● LIVE' : '↻ RECONNECTING';
      s.classList.toggle('offline', !online);
    }
  }
  error(message) {
    const el = document.getElementById('mp-notice');
    if (el) {
      el.textContent = message;
      el.classList.add('visible');
      this.noticeUntil = performance.now() + 6000;
    }
  }
  setFocus(value) {
    this.focus = value;
    const g = this.game;
    g.input.keys = {};
    g.input.pressed = {};
    g.input.enabled = !value;
    g._wasLocked = false;
    if (value) g.input.unlock();
    else if (this.active) {
      g.mode = 'playing';
      g.input.lock();
    }
    if (this.guide && !value) this.guide.visible = true;
  }
  mountUI() {
    document.getElementById('mp-ui')?.remove();
    const ui = (this.ui = el('div', 'mp-ui'));
    ui.id = 'mp-ui';
    const top = el('div', 'mp-topbar');
    top.append(el('b', '', `BUNG BRISBANE · ${this.room.code}`));
    const status = el('span', '', '● LIVE');
    status.id = 'mp-connection';
    top.append(status);
    for (const [text, fn] of [
      ['ROOM · B', () => this.openBoard()],
      ['CHAT · ENTER', () => this.openChat()],
      ['INVITE', () => this.share()],
    ]) {
      const b = el('button', '', text);
      b.onclick = fn;
      top.append(b);
    }
    ui.append(top);
    const goal = el('div', 'mp-goal');
    goal.id = 'mp-goal';
    ui.append(goal);
    const chat = el('div', 'mp-chat');
    chat.id = 'mp-chat';
    chat.setAttribute('role', 'log');
    chat.setAttribute('aria-label', 'Room chat');
    const history = el('div', 'mp-chat-history');
    history.id = 'mp-chat-history';
    chat.append(history);
    const form = el('form', 'mp-chat-form'),
      input = el('input'),
      send = el('button', '', 'SEND');
    input.placeholder = 'Say OIII! · 180 characters';
    input.maxLength = 180;
    input.setAttribute('aria-label', 'Message to the room');
    input.id = 'mp-chat-input';
    input.autocomplete = 'off';
    send.type = 'submit';
    form.append(input, send);
    form.onsubmit = (e) => {
      e.preventDefault();
      if (input.value.trim()) {
        this.client.command('chat', { text: input.value });
        input.value = '';
        input.focus();
      }
    };
    chat.append(form);
    const quick = el('div', 'mp-quick-chat');
    for (const text of [
      'OIII!',
      'Meet at City Hall',
      'Need a hand',
      'Good game!',
    ]) {
      const b = el('button', '', text);
      b.onclick = () => this.client.command('chat', { text });
      quick.append(b);
    }
    chat.append(quick);
    const close = el('button', 'mp-chat-close', 'BACK TO CITY · ESC');
    close.onclick = () => this.hidePanels();
    chat.append(close);
    ui.append(chat);
    const notice = el('div', 'mp-notice');
    notice.id = 'mp-notice';
    notice.setAttribute('role', 'status');
    ui.append(notice);
    document.body.append(ui);
    this.refreshUI();
  }
  refreshUI() {
    if (!this.ui) return;
    this.connection(this.client.connected);
    const history = document.getElementById('mp-chat-history'),
      nearBottom =
        history.scrollHeight - history.scrollTop - history.clientHeight < 50;
    history.replaceChildren();
    for (const m of this.room.chat) {
      if (this.muted.has(m.from)) continue;
      const line = el('p');
      line.append(el('b', '', m.name + ': '), document.createTextNode(m.text));
      history.append(line);
    }
    if (nearBottom) history.scrollTop = history.scrollHeight;
    if (this.board) this.drawBoard();
  }
  openChat() {
    if (!this.active) return;
    this.board?.remove();
    this.board = null;
    this.mini.close();
    document.getElementById('mp-chat')?.classList.add('expanded');
    this.ui?.classList.add('chat-open');
    this.setFocus(true);
    document.getElementById('mp-chat-input')?.focus();
  }
  hidePanels() {
    this.board?.remove();
    this.board = null;
    this.mini.close();
    document.getElementById('mp-chat')?.classList.remove('expanded');
    this.ui?.classList.remove('chat-open');
    document.activeElement?.blur();
    this.setFocus(false);
  }
  openBoard() {
    if (!this.active) {
      this.showLobby();
      return;
    }
    this.mini.close();
    document.getElementById('mp-chat')?.classList.remove('expanded');
    this.ui?.classList.remove('chat-open');
    this.setFocus(true);
    this.board?.remove();
    this.board = el('div', 'mp-overlay');
    this.board.id = 'mp-room-board';
    document.body.append(this.board);
    this.drawBoard();
  }
  drawBoard() {
    const card = el('section', 'mp-room-card'),
      q = this.room.quest;
    card.append(
      el(
        'small',
        'mp-eyebrow',
        `ROOM ${this.room.code} · ${Object.values(this.room.players).filter((p) => p.connected).length}/10 BUNGS`,
      ),
      el('h2', '', 'THE ENORMOUS SOCIAL CLUB'),
    );
    const controls = el('div', 'mp-game-toolbar');
    for (const [text, fn] of [
      ['BACK TO CITY', () => this.hidePanels()],
      ['INVITE MATES', () => this.share()],
      ['LEAVE ROOM', () => this.leave()],
    ]) {
      const b = el('button', 'mp-button', text);
      b.onclick = fn;
      controls.append(b);
    }
    card.append(controls);
    const layout = el('div', 'mp-room-layout'),
      main = el('div'),
      side = el('aside');
    layout.append(main, side);
    card.append(layout);
    const quest = el('section', 'mp-quest-card');
    quest.append(
      el('small', 'mp-eyebrow', 'FOUR-PLAYER CITY EXPEDITION'),
      el(
        'h3',
        '',
        q.status === 'complete'
          ? 'BRISBANE SAVED. REBAR RESPECTED.'
          : q.status === 'playing'
            ? QUEST_STAGES[q.stage].title
            : 'THE GREAT BRISBANE REBAR RESCUE',
      ),
      el(
        'p',
        '',
        q.status === 'playing'
          ? QUEST_STAGES[q.stage].text
          : 'Four distinct roles. Shared checkpoints. City Hall, Queen Street, South Bank and a triumphant return. Other Bungs can roam or play at the tables.',
      ),
    );
    for (const [i, id] of q.roles.entries())
      quest.append(
        el(
          'p',
          'mp-role',
          `${q.done[i] ? '✓' : '○'} ${ROLES[i]} · ${id ? this.name(id) : 'OPEN SLOT'}`,
        ),
      );
    const button = (text, fn, parent = quest) => {
      const b = el('button', 'mp-button', text);
      b.onclick = fn;
      parent.append(b);
      return b;
    };
    if (q.status !== 'complete')
      button(
        q.roles.includes(this.client.id)
          ? 'LEAVE QUEST CREW'
          : 'JOIN THE FOUR-PLAYER CREW',
        () =>
          this.client.command(
            q.roles.includes(this.client.id) ? 'questLeave' : 'questJoin',
          ),
      );
    if (this.room.host === this.client.id) {
      if (q.status === 'waiting')
        button('START EXPEDITION', () => this.client.command('questStart'));
      if (q.status !== 'waiting')
        button('RESET EXPEDITION', () => this.client.command('questReset'));
    }
    main.append(quest);
    const games = el('div', 'mp-game-grid');
    for (const def of GAMES) {
      const g = this.room.games[def.id],
        b = el('button', 'mp-game-choice');
      b.append(
        el('span', 'mp-game-icon', def.icon),
        el('small', '', def.tag),
        el('b', '', def.name),
        el(
          'span',
          '',
          g
            ? `${g.status.toUpperCase()} · ${g.players.length}/${def.max}`
            : `${def.min}–${def.max} players`,
        ),
      );
      b.onclick = () => {
        this.board.remove();
        this.board = null;
        this.mini.open(def.id);
      };
      games.append(b);
    }
    main.append(el('h3', '', 'TEN TABLES. ZERO SENSIBLE IDEAS.'), games);
    side.append(el('h3', '', 'ROOM LEADERBOARD'));
    for (const p of Object.values(this.room.players).sort(
      (a, b) => b.score - a.score,
    )) {
      const row = el('div', 'mp-player-row');
      row.append(
        el(
          'b',
          '',
          `${p.id === this.room.host ? '♛ ' : ''}${p.name}${p.id === this.client.id ? ' · YOU' : ''}`,
        ),
        el(
          'span',
          '',
          `${characterDefinition(p.appearance?.character).name} · ${p.score} points · ${p.connected ? 'online' : 'rejoining'}`,
        ),
      );
      row.style.borderLeftColor = COLORS[p.color % 10];
      if (p.id !== this.client.id) {
        button(
          'FIND IN BRISBANE',
          () => {
            this.manualTarget = p.id;
            this.hidePanels();
          },
          row,
        );
        button(
          this.muted.has(p.id) ? 'UNMUTE LOCALLY' : 'MUTE LOCALLY',
          () => {
            this.muted.has(p.id)
              ? this.muted.delete(p.id)
              : this.muted.add(p.id);
            this.refreshUI();
          },
          row,
        );
        if (this.room.host === this.client.id) {
          button(
            'MUTE CHAT · 5 MIN',
            () =>
              this.client.command('moderate', { player: p.id, action: 'mute' }),
            row,
          );
          button(
            'REMOVE',
            () =>
              this.client.command('moderate', { player: p.id, action: 'kick' }),
            row,
          );
        }
      }
      side.append(row);
    }
    side.append(
      el(
        'p',
        'mp-caption',
        'Campaign saves and currencies stay separate. Room host transfers automatically when the host leaves.',
      ),
    );
    this.board.replaceChildren(card);
  }
  async share() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', this.room.code);
    try {
      await navigator.clipboard.writeText(url.href);
      this.error('Invite link copied · ' + this.room.code);
    } catch {
      this.error('Share this room code: ' + this.room.code);
    }
  }
  prepareWorld() {
    const z = this.game.zone;
    this.questMarkers = [];
    const ringGeo = new THREE.TorusGeometry(0.8, 0.08, 8, 24);
    this.ringGeometry = ringGeo;
    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshStandardMaterial({
          color: COLORS[i],
          emissive: COLORS[i],
          emissiveIntensity: 0.45,
        }),
        m = new THREE.Mesh(ringGeo, material);
      m.rotation.x = Math.PI / 2;
      m.visible = false;
      this.root.add(m);
      this.questMarkers.push(m);
    }
    const table = new THREE.Group();
    table.position.set(18, z.groundAt(18, 80), 80);
    this.root.add(table);
    const sign = z.textSign(
      18,
      table.position.y + 3,
      80,
      0,
      'BUNG SOCIAL CLUB\nB · TEN MINIGAMES',
      { w: 4, h: 1, bg: '#172638', fg: '#ffce36' },
    );
    this.root.attach(sign);
    const bar = buildRebar(),
      burger = buildBurger();
    bar.position.set(-0.8, 1, 0);
    burger.position.set(0.8, 1, 0);
    table.add(bar, burger);
    this.kiosk = table;
  }
  syncPeers() {
    if (!this.root) return;
    for (const [id, a] of this.peers)
      if (!this.room.players[id]?.connected) {
        disposeAvatar(a.mesh);
        a.trolley.removeFromParent();
        a.label.material.map.dispose();
        a.label.material.dispose();
        this.peers.delete(id);
      }
    for (const p of Object.values(this.room.players)) {
      if (p.id === this.client.id || !p.connected) continue;
      let a = this.peers.get(p.id);
      const appearanceKey = JSON.stringify(normalizeAppearance(p.appearance));
      if (a && (a.appearanceKey !== appearanceKey || a.name !== p.name)) {
        disposeAvatar(a.mesh);
        a.trolley.removeFromParent();
        a.label.material.map.dispose();
        a.label.material.dispose();
        this.peers.delete(p.id);
        a = null;
      }
      if (!a) {
        const mesh = buildAvatar(p.appearance),
          trolley = this.trolleyModel.clone(true),
          canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const c = canvas.getContext('2d');
        c.fillStyle = '#142336e8';
        c.fillRect(0, 0, 256, 64);
        c.strokeStyle = COLORS[p.color % 10];
        c.lineWidth = 5;
        c.strokeRect(3, 3, 250, 58);
        c.fillStyle = 'white';
        c.font = 'bold 25px Arial';
        c.textAlign = 'center';
        c.fillText(p.name, 128, 41, 238);
        const texture = new THREE.CanvasTexture(canvas),
          label = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: texture, depthTest: false }),
          );
        label.position.y = 2.8;
        label.scale.set(2.6, 0.65, 1);
        mesh.add(label);
        this.root.add(mesh, trolley);
        a = {
          mesh,
          appearanceKey: JSON.stringify(normalizeAppearance(p.appearance)),
          name: p.name,
          trolley,
          label,
          target: new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z),
          yaw: p.yaw,
        };
        mesh.position.copy(a.target);
        this.peers.set(p.id, a);
      }
      a.target.set(p.pos.x, p.pos.y, p.pos.z);
      a.yaw = p.yaw;
      a.riding = p.riding;
    }
  }
  objective() {
    const id = this.client.id,
      q = this.room?.quest;
    if (q?.status === 'playing' && q.roles.includes(id)) {
      const role = q.roles.indexOf(id),
        p = QUEST_STAGES[q.stage].points[role];
      return {
        x: p[0],
        z: p[1],
        label: `${QUEST_STAGES[q.stage].title} · ${q.done[role] ? 'WAIT FOR THE CREW' : 'F · YOUR ' + ROLES[role].toUpperCase()}`,
      };
    }
    for (const g of Object.values(this.room?.games || {}))
      if (
        g.id === 'rally' &&
        g.status === 'playing' &&
        g.players.includes(id)
      ) {
        const p = RALLY[g.checkpoints[id] || 0];
        if (p)
          return {
            ...p,
            label: `RALLY ${1 + (g.checkpoints[id] || 0)}/4 · ${p.label} · F AT MARKER`,
          };
      }
    if (this.manualTarget && this.room.players[this.manualTarget]?.connected) {
      const p = this.room.players[this.manualTarget];
      return { ...p.pos, label: 'FIND ' + p.name.toUpperCase() };
    }
    return null;
  }
  frame(dt) {
    const g = this.game,
      now = performance.now();
    if (!this.root) return;
    if (!this.focus && g.input.pressed.Escape) this.openBoard();
    if (!this.focus) {
      const m = g.input.consumeMouse();
      g.camYaw -= m.dx * 0.0024 * state.settings.sensitivity;
      g.camPitch = Math.max(-0.4, Math.min(1.1, g.camPitch + m.dy * 0.0024));
      if (g.input.pressed.KeyT) {
        g.trolley.summoned ? g.trolley.dismiss() : g.trolley.summon();
      }
      if (g.input.pressed.KeyE) {
        if (g.trolley.summoned && g.player.pos.distanceTo(g.trolley.pos) < 3) {
          g.trolley.riding ? g.trolley.dismount() : g.trolley.mount();
        } else if (g.zone.cityLife?.interactAt(g.player.pos)) {
          // The stop board uses the room notice, keeping chat and HUD clear.
        } else if (Math.hypot(g.player.pos.x - 18, g.player.pos.z - 80) < 6)
          this.openBoard();
        // The room owns E interactions. Trolley.update must not read the same
        // press again and immediately undo a mount with a dismount.
        delete g.input.pressed.KeyE;
      }
      const use = g.input.pressed.KeyF;
      delete g.input.pressed.KeyF;
      g.player.update(dt);
      g.trolley.update(dt);
      if (use) this.worldAction();
    }
    if (g.zone) g.zone.update(dt, g.elapsed);
    // Multiplayer bypasses Game.updatePlaying: advance speech here as well,
    // including while a room/chat panel has the player's input focus.
    g.dialogue.update(dt);
    state.stability = 100;
    state.fuel = 100;
    g.fx.update(dt);
    g.updateCamera(dt);
    this.mini.update();
    if (now - this.lastSent >= 125) {
      this.lastSent = now;
      this.client.send({
        type: 'move',
        seq: this.client.seq++,
        pos: { ...g.player.pos },
        yaw: g.trolley.riding ? g.trolley.heading : g.player.facing,
        riding: g.trolley.riding,
      });
    }
    if (now - this.lastPing >= 15000) {
      this.lastPing = now;
      if (this.client.ws?.readyState === 1) {
        if (this.client.lastPong && now - this.client.lastPong > 45000)
          this.client.ws.close();
        else this.client.ws.send('ping');
      }
    }
    animateAvatar(
      this.selfAvatar,
      Math.hypot(g.player.vel.x, g.player.vel.z),
      g.elapsed,
      g.trolley.riding,
    );
    for (const a of this.peers.values()) {
      a.mesh.visible =
        Math.hypot(a.target.x - g.player.pos.x, a.target.z - g.player.pos.z) <
        180;
      a.trolley.visible = !!a.riding && a.mesh.visible;
      const beforeX = a.mesh.position.x,
        beforeZ = a.mesh.position.z;
      a.mesh.position.lerp(a.target, 1 - Math.exp(-12 * dt));
      a.mesh.rotation.y = turnToward(a.mesh.rotation.y, a.yaw, dt);
      const speed =
        Math.hypot(beforeX - a.mesh.position.x, beforeZ - a.mesh.position.z) /
        Math.max(dt, 0.001);
      animateAvatar(a.mesh, speed, g.elapsed, a.riding);
      a.trolley.visible = !!a.riding && a.mesh.visible;
      if (a.riding) {
        a.trolley.position.copy(a.mesh.position);
        a.trolley.rotation.y = a.yaw;
      }
    }
    const goal = this.objective(),
      hud = document.getElementById('mp-goal');
    this.guide.visible = false;
    this.guide.userData.trail.visible = false;
    if (goal && !this.focus) {
      const target = {
        x: goal.x,
        y: g.zone.groundAt(goal.x, goal.z, g.player.pos.y),
        z: goal.z,
      };
      const r = this.navigation.update({
        key: goal.label,
        from: g.player.pos,
        target,
        dt,
      });
      hud.textContent = goal.label + ' · ' + Math.ceil(r?.distance || 0) + ' m';
      if (r && !r.unavailable && r.distance > 2) {
        const a = this.guide;
        a.visible = true;
        a.rotation.y = r.yaw;
        a.position.set(
          g.player.pos.x + Math.sin(r.yaw) * 1.6,
          g.player.pos.y + 2.5,
          g.player.pos.z + Math.cos(r.yaw) * 1.6,
        );
        const data = a.userData;
        data.trail.visible = true;
        for (let i = 0; i < 32; i++) {
          const p = atDistance(
            r.path,
            r.on.along + Math.min(2 + i * 1.6, r.on.length - r.on.along),
          );
          data.matrix.makeTranslation(p.x, p.y + 0.12, p.z);
          data.trail.setMatrixAt(i, data.matrix);
          data.alpha.array[i] =
            i * 1.6 > r.on.length - r.on.along ? 0 : 0.55 * (1 - i / 32);
        }
        data.trail.instanceMatrix.needsUpdate = true;
        data.alpha.needsUpdate = true;
      }
    } else if (hud)
      hud.textContent =
        g.zone.cityLife?.hintAt(g.player.pos) ||
        'B · ROOM  |  ENTER · CHAT  |  T · TROLLEY  |  E · MOUNT / ARRIVALS  |  F · QUEST';
    const q = this.room.quest;
    this.questMarkers.forEach((m, i) => {
      m.visible = q.status === 'playing';
      if (m.visible) {
        const p = QUEST_STAGES[q.stage].points[i];
        m.position.set(p[0], g.zone.groundAt(p[0], p[1]) + 0.13, p[1]);
        m.rotation.z = g.elapsed * 0.5;
      }
    });
    if (now > this.noticeUntil)
      document.getElementById('mp-notice')?.classList.remove('visible');
  }
  worldAction() {
    const q = this.room.quest;
    if (q.status === 'playing' && q.roles.includes(this.client.id)) {
      this.client.command('questAct');
      return;
    }
    const rally = this.room.games.rally;
    if (rally?.status === 'playing' && rally.players.includes(this.client.id))
      this.client.command('play', { game: 'rally', action: {} });
  }
  async leave() {
    this.client?.close();
    this.active = false;
    document.body.classList.remove('multiplayer-active');
    this.hidePanels();
    this.ui?.remove();
    for (const a of this.peers.values()) {
      a.label.material.map.dispose();
      a.label.material.dispose();
    }
    for (const a of this.peers.values()) disposeAvatar(a.mesh);
    this.peers.clear();
    if (this.selfAvatar) disposeAvatar(this.selfAvatar);
    this.selfAvatar = null;
    for (const [o, visible] of this.originalChildren || []) o.visible = visible;
    this.originalChildren = null;
    this.root?.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (o !== this.guide)
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            m?.map?.dispose?.();
            m?.dispose?.();
          }
      }
    });
    this.guide?.userData.dispose?.();
    this.root?.removeFromParent();
    this.root = null;
    this.game.trolley.dismiss();
    if (this.previous) Object.assign(state, DEFAULT_STATE(), this.previous);
    this.previous = null;
    this.game.mode = 'menu';
    this.game.input.enabled = false;
    this.game.input.unlock();
    this.game.hud.hide();
    await this.game.loadZone('mansion', true);
    this.game.menus.showMain();
  }
}
