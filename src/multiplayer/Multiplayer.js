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
  nearestOnPath,
  turnToward,
} from '../systems/Navigation.js';
import { buildGuide, segmentClear } from '../story/guide.js';
import { mergeStatic } from '../world/geo/cityModels.js';
import { positionClear } from '../core/motion.js';
import { RoomClient } from './RoomClient.js';
import { fitGarage, releaseTrolley } from '../garage/models.js';
import { MiniGames, el } from './MiniGames.js';
import { phonePicker } from '../phone/Phone.js';
import { ActivityUI, drawRaces, raceArch, trolleyPicker } from './ActivityUI.js';
import { roomTrolley } from './fleet.js';
import { raceCourse } from './raceCourses.js';
import { ROOM_SERVER } from './config.js';
import { ARENA, ARENA_COVER, ARENA_DOCK, ARENA_STAND, arenaLive, availablePickup, EXCHANGE, EXCHANGE_ITEMS, huntOpen, PICKUPS, RING_GATES, RING_WIDTH, SOCIAL_CLUB } from './cityActivities.js';
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

const ROOM_TABS = [
  ['explore', 'Explore'],
  ['arena', 'Arena'],
  ['exchange', 'Exchange'],
  ['quest', 'Expedition'],
  ['games', 'Minigames'],
  ['races', 'Trolley Races'],
  ['players', 'Players'],
];

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
      if (!this.active || this.game.phone?.opened || this.game.garage?.opened) return;
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
      } else if (this.activityUI && !this.activityUI.root.hidden && !e.repeat && ['KeyJ', 'KeyK'].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        (e.code === 'KeyJ' ? this.activityUI.join : this.activityUI.dismiss).click();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.focus ? this.hidePanels() : this.openBoard();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        e.stopPropagation();
        this.openBoard();
      } else if (e.code === 'KeyF' && this.mini.selected && !e.repeat) {
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
    const selectPhone = phonePicker(panel);
    const selectTrolley = trolleyPicker(panel);
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
        this.phoneEdition = selectPhone();
        localStorage.setItem(
          'bung-room-appearance',
          JSON.stringify(appearance),
        );
        await this.client.join(room, name.value.trim() || 'Bung', appearance, selectTrolley());
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
      for (const p of g.zone.portals) p.group.visible = false;
      g.zone.portals = [];
      for (const p of g.zone.pickups) p.mesh.visible = false;
      g.zone.pickups = [];
      this.lastReceipt = this.room.players[this.client.id]?.receipt?.id;
      this.horns = new Map();
      this.basketMaterials = new WeakMap();
      this.activityTarget = null;
      this.roomTab = 'explore';
      this.rushPrev = null;
      this.appliedWarp = this.room.players[this.client.id]?.warp ?? 0;
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
      this.prepareWorld();
      const p = this.room.players[this.client.id]?.pos || SPAWN;
      g.trolley.applyFleet(roomTrolley(this.room.players[this.client.id]?.trolley ?? this.client.trolley).id, false);
      const gy = g.zone.groundAt(p.x, p.z);
      const target = { x: p.x, y: gy + 0.1, z: p.z };
      if (!positionClear(target, 0.6, g.zone))
        throw Error('The room spawn is obstructed.');
      g.player.teleport(new THREE.Vector3(target.x, target.y, target.z));
      if (this.raceEntry()) this.mountRaceTrolley(this.room.players[this.client.id]);
      g.saga.snapCamera();
      g.player.mesh.visible = true;
      this.mountUI();
      this.syncPeers();
      this.applyEquipment();
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
      const lastRun = this.room?.players[this.client.id]?.ring;
      this.room = m.room;
      if (this.active) {
        const target = this.activityTarget;
        if (target?.kind && !availablePickup(target, this.room.players[this.client.id], this.room, this.client.now()))
          this.activityTarget = null;
        const run = this.room.players[this.client.id]?.ring;
        if (lastRun?.deadline && run?.expired) this.error('Ring Rush expired · start a new run from the room board.');
        else if (run?.deadline && run.index > (lastRun?.index ?? 0)) {
          this.error(`Gate ${run.index}/${RING_GATES.length} · chain ×${run.index}`);
          this.game.audio.sfx('portal');
        }
        const receipt = this.room.players[this.client.id]?.receipt;
        if (receipt && receipt.id !== this.lastReceipt) {
          this.lastReceipt = receipt.id;
          const reward = [
            receipt.points && `+${receipt.points} points`,
            receipt.rebar && `${receipt.rebar > 0 ? '+' : ''}${receipt.rebar} rebar`,
          ].filter(Boolean).join(' · ');
          this.error(`${receipt.reason}${reward ? ' · ' + reward : ''}`);
          this.game.audio.sfx(receipt.sound || 'questDone');
        }
        this.applyWarp();
        this.syncPeers();
        this.applyEquipment();
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
      if(this.game.garage.opened){const status=this.game.garage.root.querySelector('[role=status]');if(status)status.textContent=m.message;}
      this.error(m.message);
      this.mini.showError(m.message);
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
    const wallet = el('span', 'mp-wallet');
    wallet.id = 'mp-wallet';
    wallet.setAttribute('aria-label', 'Room score and rebar');
    top.append(status, wallet);
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
    this.activityUI = new ActivityUI(this, ui);
    document.body.append(ui);
    this.refreshUI();
  }
  refreshUI() {
    if (!this.ui) return;
    this.connection(this.client.connected);
    const p = this.room.players[this.client.id];
    this.ui.querySelector('#mp-wallet').textContent = `POINTS ${p?.score ?? 0}  ·  REBAR ${p?.rebar ?? 0}`;
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
  openBoard(tab = this.roomTab || 'explore') {
    if (!this.active) {
      this.showLobby();
      return;
    }
    if (this.board) {
      this.selectRoomTab(tab);
      return;
    }
    this.mini.close();
    document.getElementById('mp-chat')?.classList.remove('expanded');
    this.ui?.classList.remove('chat-open');
    this.setFocus(true);
    this.board = el('div', 'mp-overlay');
    this.board.id = 'mp-room-board';

    const card = el('section', 'mp-room-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'mp-room-title');
    card.onkeydown = event => {
      if (event.key !== 'Tab') return;
      const stops = [...card.querySelectorAll('button:not(:disabled), summary, [tabindex="0"]')]
        .filter(item => item.tabIndex >= 0 && item.getClientRects().length);
      const edge = event.shiftKey ? stops[0] : stops.at(-1);
      if (document.activeElement !== edge) return;
      event.preventDefault();
      (event.shiftKey ? stops.at(-1) : stops[0]).focus();
    };
    const header = el('header', 'mp-room-header');
    const identity = el('div', 'mp-room-identity');
    const meta = el('p', 'mp-eyebrow');
    meta.id = 'mp-room-meta';
    const title = el('h2', '', 'Bung Social Club');
    title.id = 'mp-room-title';
    identity.append(meta, title);
    const tools = el('div', 'mp-room-tools');
    this.roomButton(tools, 'INVITE MATES', () => this.share());
    this.roomButton(tools, 'LEAVE ROOM', () => this.leave(), 'subtle');
    this.roomButton(tools, 'BACK TO CITY', () => this.hidePanels(), 'gold');
    header.append(identity, tools);

    const tabs = el('div', 'mp-room-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Room sections');
    for (const [id, label] of ROOM_TABS) {
      const button = el('button', 'mp-room-tab', label);
      button.id = 'mp-tab-' + id;
      button.dataset.roomTab = id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'mp-room-content');
      button.onclick = () => this.selectRoomTab(id);
      tabs.append(button);
    }
    tabs.onkeydown = (event) => {
      const at = ROOM_TABS.findIndex(([id]) => id === event.target.dataset.roomTab);
      if (at < 0) return;
      const last = ROOM_TABS.length - 1;
      const next = {
        ArrowRight: at === last ? 0 : at + 1,
        ArrowLeft: at === 0 ? last : at - 1,
        Home: 0,
        End: last,
      }[event.key];
      if (next == null) return;
      event.preventDefault();
      this.selectRoomTab(ROOM_TABS[next][0]);
    };

    const panel = el('div', 'mp-room-content');
    panel.id = 'mp-room-content';
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;
    card.append(header, tabs, panel);
    this.board.append(card);
    document.body.append(this.board);
    this.selectRoomTab(tab);
  }

  roomButton(parent, text, action, variant = '') {
    const button = el('button', variant ? 'mp-button ' + variant : 'mp-button', text);
    button.onclick = action;
    parent.append(button);
    return button;
  }

  selectRoomTab(tab) {
    const button = this.board.querySelector('#mp-tab-' + tab);
    if (!button) return;
    this.roomTab = tab;
    for (const item of this.board.querySelectorAll('[role="tab"]')) {
      const selected = item === button;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    }
    const panel = this.board.querySelector('#mp-room-content');
    panel.setAttribute('aria-labelledby', button.id);
    panel.replaceChildren();
    panel.scrollTop = 0;
    this.drawBoard();
    button.focus();
  }

  drawBoard() {
    const panel = this.board.querySelector('#mp-room-content');
    const p = this.room.players[this.client.id];
    const online = Object.values(this.room.players).filter(player => player.connected).length;
    this.board.querySelector('#mp-room-meta').textContent =
      `ROOM ${this.room.code} · ${online}/10 ONLINE · ${p?.score ?? 0} POINTS · ${p?.rebar ?? 0} REBAR`;

    // Room updates can arrive while a keyboard user is choosing an action.
    const scroll = panel.scrollTop;
    const active = document.activeElement;
    const focusables = 'button:not(:disabled), summary';
    const inside = panel.contains(active) && active.matches(focusables);
    const focusPlayer = active.closest('[data-player]')?.dataset.player;
    const openPlayers = new Set(Array.from(panel.querySelectorAll('details[open]'),
      details => details.closest('[data-player]').dataset.player));
    panel.replaceChildren();
    const body = el('div', 'mp-room-page mp-room-page-' + this.roomTab);
    panel.append(body);
    switch (this.roomTab) {
      case 'explore': this.drawExplore(body, p); break;
      case 'arena': this.drawArena(body, p); break;
      case 'exchange': this.drawExchange(body, p); break;
      case 'quest': this.drawExpedition(body, this.room.quest); break;
      case 'games': this.drawMinigames(body); break;
      case 'races': drawRaces(this, body); break;
      case 'players': this.drawPlayers(body); break;
    }
    for (const row of body.querySelectorAll('[data-player]')) {
      const details = row.querySelector('details');
      if (details) details.open = openPlayers.has(row.dataset.player);
    }
    panel.scrollTop = scroll;
    if (inside) {
      const replacement = [...panel.querySelectorAll(focusables)].find(item =>
        item.textContent === active.textContent && item.closest('[data-player]')?.dataset.player === focusPlayer);
      (replacement || panel).focus({ preventScroll: true });
    }
  }

  drawExplore(panel, p) {
    const ring = el('section', 'mp-quest-card');
    const run = p?.ring;
    ring.append(el('small', 'mp-eyebrow', 'QUEEN STREET · ROOM EVENT'),
      el('h3', '', 'RING RUSH'),
      el('p', '', run?.expired ? 'Time ran out. Start a new run.' : run?.time != null
        ? `Finished in ${(run.time / 1000).toFixed(1)}s. Best ${(p.ringBest / 1000).toFixed(1)}s.`
        : 'Open a room run. Everyone gets the Queen Street course and can cross eight gates on foot or by trolley.'));
    const actions = el('div', 'mp-room-actions');
    this.roomButton(actions, run?.deadline ? 'RESUME RING RUSH' : 'START RING RUSH', () => {
      if (!run?.deadline) this.client.command('ringStart');
      this.hidePanels();
    }, 'gold');
    if (run?.deadline)
      this.roomButton(actions, 'CANCEL RUN', () => this.client.command('ringCancel'), 'subtle');
    const round = this.room.events?.ring;
    if (round) for (const other of Object.values(this.room.players)) {
      const progress = other.ring;
      if (!progress || progress.event !== round.id) continue;
      ring.append(el('p', 'mp-score-line', other.name + ' · ' + (progress.time == null
        ? `${progress.index}/${RING_GATES.length} gates` : `${(progress.time / 1000).toFixed(1)}s`)));
    }
    ring.append(actions);
    panel.append(ring);
    const collection = el('section', 'mp-quest-card');
    const stamps = PICKUPS.filter(item => item.kind === 'stamp' && p.claims?.[item.id]).length;
    const burgers = PICKUPS.filter(item => item.kind === 'burger' && p.claims?.[item.id]).length;
    collection.append(el('small', 'mp-eyebrow', 'ROOM-LOCAL PROGRESS'), el('h3', '', 'BRISBANE REBAR HUNT'),
      el('p', '', `${p.rebar} rebar · ${stamps}/3 landmark stamps · ${burgers}/3 burger tokens. Walk or drive through a collectible to pick it up.`));
    const hunt = el('div', 'mp-game-toolbar');
    const event = this.room.events?.hunt;
    this.roomButton(hunt, event?.status === 'running' ? 'JOIN / TRACK ROOM HUNT' : 'START ROOM REBAR HUNT', () => {
      this.client.command('huntStart');
      this.hidePanels();
    }, 'gold');
    if (event?.status === 'running') {
      collection.append(el('p', 'mp-score-line', `Room found ${Object.keys(event.found).length}/${event.targets.length}`));
      this.roomButton(hunt, 'LEAVE HUNT', () => this.client.command('huntLeave'), 'subtle');
    }
    for (const [label, point] of [
      ['CITY HALL', PICKUPS[0]], ['QUEEN STREET', PICKUPS[2]], ['SOUTH BANK', PICKUPS[5]],
      ['BOTANIC GARDENS', PICKUPS[8]], ['RARE SHIPMENT', PICKUPS[4]],
    ]) {
      const button = el('button', 'mp-button', label);
      button.onclick = () => { this.activityTarget = point; this.hidePanels(); };
      hunt.append(button);
    }
    collection.append(hunt);
    panel.append(collection);
  }

  drawArena(panel, p) {
    const arena = this.room.arena;
    if (arena) {
      const heist = el('section', 'mp-quest-card');
      const queued = arena.players.includes(this.client.id);
      const active = arenaLive(arena);
      heist.append(el('small', 'mp-eyebrow', 'RAYMOND PARK · OPTIONAL PVP'),
        el('h3', '', 'BURGER HEIST'),
        el('p', '', arena.result || (active
          ? `RED ${arena.scores[0]} · BLUE ${arena.scores[1]} · First to two burgers`
          : `${arena.phase === 'waiting' ? arena.players.length : 0}/${arena.size} in the queue. Grab the burger, tackle the carrier, and score at your team’s dock.`)));
      if (arena.phase === 'waiting') {
        for (const id of arena.players)
          heist.append(el('small', 'mp-arena-ready', `${this.name(id)} · ${arena.ready[id] ? 'READY' : 'WAITING'}`));
      }
      const actions = el('div', 'mp-room-actions');
      const action = (text, cmd, data) => {
        const b = el('button', 'mp-button', text);
        b.onclick = () => {
          this.client.command(cmd, data);
          if (cmd === 'arenaWatch' || cmd === 'arenaUnwatch' || cmd === 'arenaReady') this.hidePanels();
        };
        actions.append(b);
      };
      if (!active && (!queued || arena.phase === 'finished')) {
        const sizes = arena.phase === 'waiting' && arena.players.length ? [arena.size] : [2, 4];
        for (const size of sizes)
          action(`${arena.phase === 'finished' ? 'REMATCH' : 'QUEUE'} · ${size / 2}V${size / 2}`, 'arenaJoin', { size });
      }
      if (queued && arena.phase === 'waiting') action(arena.ready[this.client.id] ? 'UNREADY' : 'READY UP', 'arenaReady');
      if (queued && arena.phase !== 'finished') action('LEAVE ARENA', 'arenaLeave');
      if (!queued || !active)
        action(p.watchReturn ? 'RETURN TO CITY' : 'WATCH FROM THE STANDS', p.watchReturn ? 'arenaUnwatch' : 'arenaWatch');
      heist.append(actions);
      panel.append(heist);
    }
  }

  drawExchange(panel, p) {
    const shop = el('section', 'mp-quest-card');
    const atExchange = this.near(EXCHANGE, 5);
    shop.append(el('small', 'mp-eyebrow', 'CITY HALL'),
      el('h3', '', 'BUNG’S REBAR EXCHANGE'));
    this.roomButton(shop,'FIND BUNG GARAGE',()=>{
      this.activityTarget={x:108.45,z:22,y:10,label:'BUNG GARAGE · G TO CUSTOMISE'};
      this.hidePanels();
    });
    if (!atExchange) {
      const visit = el('div', 'mp-exchange-visit');
      visit.append(el('p', '', 'Visit the counter to buy or upgrade your trolley.'));
      this.roomButton(visit, 'FIND EXCHANGE', () => {
        this.activityTarget = EXCHANGE;
        this.hidePanels();
      });
      shop.append(visit);
    }
    for (const item of EXCHANGE_ITEMS) {
      const row = el('div', 'mp-exchange-item');
      const detail = el('div');
      detail.append(el('b', '', item.label), el('p', '', item.detail));
      if (item.swatch) {
        const color = el('span', 'mp-swatch');
        color.style.backgroundColor = '#' + item.swatch.toString(16).padStart(6, '0');
        detail.prepend(color);
      }
      const owned = p.inventory?.[item.id];
      const buy = el('button', 'mp-button', owned ? 'EQUIPPED' : `BUY · ${item.price}`);
      buy.disabled = !!owned || p.rebar < item.price || !atExchange;
      buy.onclick = () => this.client.command('exchangeBuy', { item: item.id });
      row.append(detail, buy);
      shop.append(row);
    }
    panel.append(shop);
  }

  drawExpedition(panel, q) {
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
    const actions = el('div', 'mp-room-actions');
    if (q.status !== 'complete')
      this.roomButton(actions,
        q.roles.includes(this.client.id) ? 'LEAVE QUEST CREW' : 'JOIN THE FOUR-PLAYER CREW',
        () => this.client.command(q.roles.includes(this.client.id) ? 'questLeave' : 'questJoin'));
    if (this.room.host === this.client.id)
      this.roomButton(actions, q.status === 'waiting' ? 'START EXPEDITION' : 'RESET EXPEDITION',
        () => this.client.command(q.status === 'waiting' ? 'questStart' : 'questReset'));
    quest.append(actions);
    panel.append(quest);
  }

  drawMinigames(panel) {
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
    panel.append(el('h3', 'mp-room-section-title', 'TEN TABLES. ZERO SENSIBLE IDEAS.'), games);
  }

  drawPlayers(panel) {
    panel.append(el('h3', 'mp-room-section-title', 'ROOM LEADERBOARD'));
    for (const p of Object.values(this.room.players).sort(
      (a, b) => b.score - a.score,
    )) {
      const row = el('div', 'mp-player-row');
      row.dataset.player = p.id;
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
        const actions = el('details', 'mp-player-actions');
        const summary = el('summary', '', 'Player actions');
        summary.setAttribute('aria-label', 'Player actions for ' + p.name);
        actions.append(summary);
        row.append(actions);
        const button = (text, fn) => this.roomButton(actions, text, fn);
        button(
          'FIND IN BRISBANE',
          () => {
            this.manualTarget = p.id;
            this.hidePanels();
          },
        );
        button(
          this.muted.has(p.id) ? 'UNMUTE LOCALLY' : 'MUTE LOCALLY',
          () => {
            this.muted.has(p.id)
              ? this.muted.delete(p.id)
              : this.muted.add(p.id);
            this.refreshUI();
          },
        );
        if (this.room.host === this.client.id) {
          button(
            'MUTE CHAT · 5 MIN',
            () =>
              this.client.command('moderate', { player: p.id, action: 'mute' }),
          );
          button(
            'REMOVE',
            () =>
              this.client.command('moderate', { player: p.id, action: 'kick' }),
          );
        }
      }
      panel.append(row);
    }
    panel.append(
      el(
        'p',
        'mp-caption',
        'Campaign saves and currencies stay separate. Room host transfers automatically when the host leaves.',
      ),
    );
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
    this.raceGate = raceArch();
    this.root.add(this.raceGate);
    this.lastRacePower = null;
    const z = this.game.zone;
    this.rushGate = new THREE.Group();
    this.rushGate.visible = false;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(RING_WIDTH, .15, 10, 44),
      new THREE.MeshStandardMaterial({ color: 0xffc33a, emissive: 0xbd6306, emissiveIntensity: .85, metalness: .55 }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RING_WIDTH - .18, .035, 6, 44),
      new THREE.MeshBasicMaterial({ color: 0xffedaf }));
    this.rushGate.add(frame, rim);
    this.root.add(this.rushGate);
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
    this.loot = PICKUPS.map(item => {
      const model = item.kind === 'burger' ? buildBurger() : item.kind === 'stamp'
        ? new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .13, 10),
          new THREE.MeshStandardMaterial({ color: 0x63cfbf, metalness: .45, emissive: 0x2c7971, emissiveIntensity: .35 }))
        : buildRebar();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.54, .63, .12, 12),
        new THREE.MeshStandardMaterial({ color: item.kind === 'rare' ? 0xffba30 : 0x32465a, roughness: .7 }));
      const group = new THREE.Group();
      group.position.set(item.x, z.groundAt(item.x, item.z) + .06, item.z);
      if (item.kind === 'stamp') model.rotation.x = Math.PI / 2;
      if (item.kind === 'rare') model.scale.setScalar(1.6);
      model.position.y = .68;
      group.add(base, model);
      this.root.add(group);
      return { item, group, model };
    });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.15, .72),
      new THREE.MeshStandardMaterial({ color: 0x24465a, roughness: .66, metalness: .22 }));
    const floor = z.groundAt(EXCHANGE.x, EXCHANGE.z);
    stand.position.set(EXCHANGE.x, floor + .5, EXCHANGE.z);
    this.root.add(stand);
    const exchangeSign = z.textSign(EXCHANGE.x, floor + 1.48, EXCHANGE.z, 0, 'BUNG’S REBAR EXCHANGE',
      { w: 2.6, h: .52, bg: '#1c4653', fg: '#ffdb70' });
    this.root.attach(exchangeSign);
    this.mint = new THREE.MeshStandardMaterial({ color: 0x46dfbe, metalness: .56, roughness: .32 });
    const table = new THREE.Group();
    table.position.set(SOCIAL_CLUB.x, z.groundAt(SOCIAL_CLUB.x, SOCIAL_CLUB.z), SOCIAL_CLUB.z);
    this.root.add(table);
    const sign = z.textSign(
      SOCIAL_CLUB.x,
      table.position.y + 3,
      SOCIAL_CLUB.z,
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
    this.prepareArena();
  }
  syncPeers() {
    if (!this.root) return;
    for (const [id, a] of this.peers)
      if (!this.room.players[id]?.connected) {
        disposeAvatar(a.mesh);
        releaseTrolley(a.trolley);
        a.label.material.map.dispose();
        a.label.material.dispose();
        this.peers.delete(id);
      }
    for (const p of Object.values(this.room.players)) {
      if (p.id === this.client.id || !p.connected) continue;
      let a = this.peers.get(p.id);
      const appearanceKey = JSON.stringify(normalizeAppearance(p.appearance));
      const trolleyId = roomTrolley(p.trolley).id;
      if (a && (a.appearanceKey !== appearanceKey || a.name !== p.name || a.trolleyId !== trolleyId)) {
        disposeAvatar(a.mesh);
        releaseTrolley(a.trolley);
        a.label.material.map.dispose();
        a.label.material.dispose();
        this.peers.delete(p.id);
        a = null;
      }
      if (!a) {
        const mesh = buildAvatar(p.appearance),
          trolley = buildTrolley(trolleyId),
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
          trolleyId,
          trolley,
          label,
          target: new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z),
          yaw: p.yaw,
        };
        mesh.position.copy(a.target);
        mesh.userData.roomPlayer = p.id;
        this.peers.set(p.id, a);
      }
      a.target.set(p.pos.x, p.pos.y, p.pos.z);
      a.yaw = p.yaw;
      a.riding = p.riding;
      fitGarage(a.trolley,p.garage?.[trolleyId]);
    }
  }
  prepareArena() {
    const z = this.game.zone;
    const root = new THREE.Group();
    this.root.add(root);
    const red = new THREE.MeshStandardMaterial({ color: 0xd64953, roughness: .75 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x3686dd, roughness: .75 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x354f5b, roughness: .62 });
    const timber = new THREE.MeshStandardMaterial({ color: 0xb88654, roughness: .83 });
    const bands = new THREE.MeshStandardMaterial({ color: 0xc7a371, roughness: .65, metalness: .12 });
    const paint = new THREE.MeshStandardMaterial({ color: 0xffd268, roughness: .86 });
    const box = (x, zPos, w, d, h, material, lift = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, z.groundAt(x, zPos) + h / 2 + lift, zPos);
      root.add(m);
      return m;
    };
    for (const c of ARENA_COVER) {
      const x = ARENA.x + c.dx, at = ARENA.z + c.dz;
      const m = box(x, at, c.w, c.d, 1.65, timber, -.13);
      const teamColor = c.dx < 0 ? red : blue;
      box(x, at, c.w + .08, c.d + .08, .13, teamColor, 1.51);
      box(x, at, c.w + .08, c.d + .08, .16, metal, -.06);
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
        box(x + dx * (c.w / 2 - .15), at + dz * (c.d / 2 - .06), .19, .16, 1.55, bands);
      }
      for (const dz of [-1, 1]) {
        box(x, at + dz * c.d / 2, c.w - .12, .044, .085, metal, .47);
        box(x, at + dz * c.d / 2, c.w - .12, .044, .085, metal, 1.03);
        box(x, at + dz * (c.d / 2 + .027), .67, .04, .30, teamColor, .69);
      }
      m.updateMatrixWorld();
      z.colliders.push(new THREE.Box3().setFromObject(m));
    }
    for (let side of [-1, 1]) {
      const col = side < 0 ? red : blue, dock = ARENA_DOCK[side < 0 ? 0 : 1];
      box(dock.x, dock.z, 3.2, 5.1, .028, col, .09);
      const flag = dock.x + side * 2.8;
      for (const zPos of [dock.z - 3.5, dock.z + 3.5]) {
        box(flag, zPos, .11, .11, 2.9, metal, -.09);
        box(flag, zPos, .12, .76, .56, col, 2.19);
      }
      for (let k = -16; k <= 16; k += 2)
        box(ARENA.x + k, ARENA.z + side * ARENA.halfZ, 1.4, .14, .015, paint, .08);
      for (let k = -8; k <= 8; k += 2)
        box(ARENA.x + side * ARENA.halfX, ARENA.z + k, .14, 1.4, .015, paint, .08);
    }
    box(ARENA_STAND.x, ARENA_STAND.z - 1.4, 7.2, .6, .64, metal);
    box(ARENA_STAND.x, ARENA_STAND.z - 1.4, 7.3, .7, .09, paint, .63);
    const sign = z.textSign(ARENA_STAND.x, z.groundAt(ARENA_STAND.x, ARENA_STAND.z) + 1.7,
      ARENA_STAND.z - 1.35, 0, 'BURGER HEIST · RAYMOND PARK', { w: 5.2, h: .62, bg: '#233e4d', fg: '#ffd268' });
    root.attach(sign);
    box(ARENA.x, ARENA.z, 1.95, 1.95, .026, paint, .07);
    mergeStatic(root);
    const burger = buildBurger();
    burger.scale.setScalar(1.55);
    root.add(burger);
    const pads = [];
    const geo = new THREE.RingGeometry(.55, .73, 28);
    for (let i = 0; i < 4; i++) {
      const pad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x57b7ff : 0xff6668, side: THREE.DoubleSide }));
      pad.rotation.x = -Math.PI / 2;
      root.add(pad);
      pads.push(pad);
    }
    this.arenaWorld = { root, burger, pads };
  }
  applyWarp() {
    const p = this.room.players[this.client.id], warp = p?.warp ?? 0;
    if (warp === this.appliedWarp || !this.root) return;
    this.appliedWarp = warp;
    const g = this.game;
    g.phone.close();
    g.trolley.dismiss();
    const y = g.zone.groundAt(p.pos.x, p.pos.z, p.pos.y + 1.5) + .1;
    g.player.teleport(new THREE.Vector3(p.pos.x, y, p.pos.z));
    if (this.raceEntry()) this.mountRaceTrolley(p);
    g.saga.snapCamera();
    if (p.watchReturn && !arenaLive(this.room.arena)) {
      g.camYaw = Math.PI;
      g.camPitch = .12;
      g.updateCamera(.2);
    }
    this.hidePanels();
  }
  raceEntry() {
    const race = this.active && this.room?.events?.race;
    const entry = race?.entries?.[this.client?.id];
    return race?.status === 'running' && entry && !entry.finished ? entry : null;
  }
  raceCountdown() {
    return !!this.raceEntry() && this.client.now() < this.room.events.race.launchAt;
  }
  mountRaceTrolley(p) {
    const g = this.game, t = g.trolley;
    t.pos.copy(g.player.pos);
    t.heading = p.yaw;
    t.speed = t.vy = 0;
    t.summoned = t.riding = t.mesh.visible = true;
    t.mesh.position.copy(t.pos);
    t.mesh.rotation.y = t.heading;
    g.player.facing = t.heading;
    g.camYaw = t.heading;
    state.fuel = t.fuelMax;
  }
  updateArena(dt) {
    const a = this.room.arena, v = this.arenaWorld, g = this.game;
    v.root.visible = Math.hypot(g.player.pos.x - ARENA.x, g.player.pos.z - ARENA.z) < 170;
    const live = arenaLive(a);
    const carrier = this.room.players[a?.carrier];
    v.burger.visible = !!(live && (a.burger || carrier));
    if (v.burger.visible) {
      const pos = a.carrier === this.client.id ? g.player.pos : this.peers.get(a.carrier)?.mesh.position || a.burger;
      v.burger.position.set(pos.x, pos.y + (carrier ? 2.45 : .85), pos.z);
      v.burger.rotation.y += dt * 1.4;
    }
    for (const [i, pad] of v.pads.entries()) {
      const id = a?.players[i];
      const p = id === this.client.id ? g.player.pos : this.peers.get(id)?.mesh.position;
      pad.visible = !!(live && p);
      if (pad.visible) pad.position.set(p.x, g.zone.groundAt(p.x, p.z) + .06, p.z);
    }
  }
  near(target, radius) {
    const p = this.game.player.pos;
    return Math.hypot(p.x - target.x, p.z - target.z) <= radius &&
      Math.abs(p.y - (target.y ?? p.y)) < 3;
  }
  paintTrolley(mesh, enabled) {
    const basket = mesh?.children[0];
    if (!basket || !this.basketMaterials || basket.userData.roomPaint === enabled) return;
    basket.userData.roomPaint = enabled;
    basket.traverse(part => {
      if (!part.isMesh || part.userData.isOutline) return;
      if (!this.basketMaterials.has(part)) this.basketMaterials.set(part, part.material);
      part.material = enabled ? this.mint : this.basketMaterials.get(part);
    });
  }
  applyEquipment() {
    if (!this.root || !this.mint) return;
    const p = this.room.players[this.client.id], inventory = p.inventory || {};
    state.upgrades.handling = Number(!!inventory.handling);
    state.upgrades.tank = Number(!!inventory.tank);
    state.maxFuel = this.game.trolley.fuelMax;
    state.fuel = Math.min(state.maxFuel, state.fuel);
    this.paintTrolley(this.game.trolley.mesh, !!inventory.paint);
    this.game.trolley.trail.material.color.setHex(inventory.trail ? 0xff6fa9 : this.game.trolley.spec.trail);
    for (const player of Object.values(this.room.players)) {
      this.paintTrolley(this.peers.get(player.id)?.trolley, !!player.inventory?.paint);
      if (player.hornAt && this.horns.get(player.id) !== player.hornAt) {
        this.horns.set(player.id, player.hornAt);
        if (this.client.now() - player.hornAt < 1600 && this.near(player.pos, 45))
          this.game.audio.sfx('roomHorn');
      }
    }
  }
  objective() {
    const id = this.client.id,
      q = this.room?.quest;
    const a = this.room.arena;
    const race = this.room.events?.race, entry = this.raceEntry();
    if (entry) {
      const course = raceCourse(race.course), gate = course.gates[entry.index];
      const seconds = Math.ceil((race.launchAt - this.client.now()) / 1000);
      return { ...gate, course, gate, race, label: seconds > 0 ? `STARTING IN ${seconds}` :
        `${course.name.toUpperCase()} · ${entry.index + 1}/${course.gates.length}${gate.power ? ' · ' + gate.power.toUpperCase() : ''}` };
    }
    if (arenaLive(a) && a.players.includes(id)) {
      const team = a.teams[id], enemy = a.carrier && this.room.players[a.carrier];
      const target = a.carrier === id ? ARENA_DOCK[team] : enemy?.pos || a.burger || ARENA;
      const action = a.phase === 'countdown' ? 'GET READY' : a.carrier === id ? 'F · DELIVER AT YOUR DOCK'
        : enemy ? (a.teams[enemy.id] === team ? 'COVER YOUR TEAMMATE' : 'F · TACKLE THE CARRIER') : 'F · GRAB THE BURGER';
      return { ...target, label: `${team ? 'BLUE' : 'RED'} · ${a.scores[0]}–${a.scores[1]} · ${action}`, arena: a };
    }
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
    const run = this.room.players[id]?.ring;
    if (run?.deadline && RING_GATES[run.index]) {
      return { ...RING_GATES[run.index], label: `RING RUSH ${run.index + 1}/${RING_GATES.length}`, rush: run };
    }
    const hunt = this.room.events?.hunt;
    const player = this.room.players[id];
    if (hunt?.status === 'running' && Number.isFinite(hunt.entries[id])) {
      const p = this.game.player.pos;
      const next = PICKUPS.filter(item => huntOpen(this.room, player, item, this.client.now())).reduce(
        (best, item) => !best || Math.hypot(p.x - item.x, p.z - item.z) < Math.hypot(p.x - best.x, p.z - best.z) ? item : best, null);
      if (next) return { ...next, label: `ROOM HUNT ${Object.keys(hunt.found).length}/${hunt.targets.length} · ${next.label}` };
    }
    if (this.manualTarget && this.room.players[this.manualTarget]?.connected) {
      const p = this.room.players[this.manualTarget];
      return { ...p.pos, label: 'FIND ' + p.name.toUpperCase() };
    }
    return this.activityTarget;
  }
  frame(dt) {
    const g = this.game,
      now = performance.now();
    if (!this.root) return;
    if (!this.focus && g.input.pressed.Escape) this.openBoard();
    const a = this.room.arena, id = this.client.id;
    const fighter = arenaLive(a) && a.players.includes(id);
    const held = fighter && (a.phase === 'countdown' || this.room.players[id].stunnedUntil > this.client.now());
    if (!this.focus && !this.raceCountdown()) {
      const m = g.input.consumeMouse();
      g.camYaw -= m.dx * 0.0024 * state.settings.sensitivity;
      g.camPitch = Math.max(-0.4, Math.min(1.1, g.camPitch + m.dy * 0.0024));
      if (!fighter && g.input.pressed.KeyT) {
        g.trolley.summoned ? g.trolley.dismiss() : g.trolley.summon();
      }
      if (g.input.pressed.KeyH && g.trolley.riding) this.client.command('horn');
      if (!fighter && g.input.pressed.KeyE) {
        if (g.trolley.summoned && g.player.pos.distanceTo(g.trolley.pos) < 3) {
          g.trolley.riding ? g.trolley.dismount() : g.trolley.mount();
        } else if (this.near(EXCHANGE, 5)) {
          this.openBoard('exchange');
        } else if (g.zone.cityLife?.interactAt(g.player.pos)) {
          // The stop board uses the room notice, keeping chat and HUD clear.
        } else if (this.near(SOCIAL_CLUB, 5))
          this.openBoard();
        // The room owns E interactions. Trolley.update must not read the same
        // press again and immediately undo a mount with a dismount.
        delete g.input.pressed.KeyE;
      }
      if (fighter) {
        delete g.input.pressed.KeyG;
        delete g.input.pressed.KeyQ;
      }
      const use = g.input.pressed.KeyF;
      delete g.input.pressed.KeyF;
      if (!held) g.player.update(dt);
      if (!fighter) g.trolley.update(dt);
      else {
        const p = g.player.pos;
        p.x = THREE.MathUtils.clamp(p.x, ARENA.x - ARENA.halfX + .4, ARENA.x + ARENA.halfX - .4);
        p.z = THREE.MathUtils.clamp(p.z, ARENA.z - ARENA.halfZ + .4, ARENA.z + ARENA.halfZ - .4);
      }
      if (use) this.worldAction();
    }
    if (g.zone) g.zone.update(dt, g.elapsed);
    // Multiplayer bypasses Game.updatePlaying: advance speech here as well,
    // including while a room/chat panel has the player's input focus.
    g.dialogue.update(dt);
    state.stability = 100;
    if (!g.trolley.boosting) state.fuel = Math.min(g.trolley.fuelMax, state.fuel + dt * 1.15);
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
        warp: this.appliedWarp,
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
        const owner = this.room.players[a.mesh.userData.roomPlayer];
        if (owner?.inventory?.trail && speed > 2 && now > (a.trailAt || 0)) {
          a.trailAt = now + 150;
          g.fx.spark(a.trolley.position, 0xff6fa9);
        }
      }
    }
    const p = this.room.players[this.client.id];
    for (const { item, group, model } of this.loot) {
      group.visible = Math.hypot(g.player.pos.x - item.x, g.player.pos.z - item.z) < 180 && availablePickup(item, p, this.room, this.client.now());
      if (group.visible) model.rotation.y += dt * 1.7;
    }
    this.updateArena(dt);
    const goal = this.objective(),
      hud = document.getElementById('mp-goal');
    this.activityUI.update();
    const race = this.room.events?.race, course = race && raceCourse(race.course);
    const marker = goal?.gate ?? (race?.status === 'recruiting' ? course.start : null);
    this.raceGate.visible = !!marker;
    if (marker) {
      this.raceGate.position.set(marker.x, marker.y, marker.z);
      this.raceGate.rotation.y = marker.yaw;
      this.raceGate.userData.trim.color.setHex(!goal?.gate ? 0x55e7a1 :
        marker === course.gates.at(-1) ? 0xf784cd : marker.power ? 0xffc23d : 0x71d7fa);
      this.raceGate.userData.sign(!goal?.gate ? 'STARTING GRID' :
        marker === course.gates.at(-1) ? 'FINISH' : marker === course.gates[0] ? 'START' : marker.power?.toUpperCase() || 'CHECKPOINT');
    }
    const power = this.raceEntry()?.power;
    const powerKey = power && race.id + '/' + power.index;
    if (power && this.lastRacePower !== powerKey) {
      this.lastRacePower = powerKey;
      if (this.client.now() - power.at < 6500) {
        state.fuel = Math.min(g.trolley.fuelMax, state.fuel + (power.type === 'refuel' ? 60 : 20));
        this.error(power.type === 'refuel' ? 'REFUEL · FULL TANK' : 'BOOST · 6 SECONDS');
        g.audio.sfx('portal');
      }
    }
    this.guide.visible = false;
    this.guide.userData.trail.visible = false;
    const gridOpen = race?.status === 'recruiting' && race.entries[this.client.id];
    if (goal && !this.focus && !gridOpen) {
      const target = {
        x: goal.x,
        y: g.zone.groundAt(goal.x, goal.z, g.player.pos.y),
        z: goal.z,
      };
      const onCourse = goal.course && nearestOnPath(goal.course.path, g.player.pos);
      const along = onCourse && Math.min(onCourse.along, goal.gate.along);
      const ahead = onCourse && atDistance(goal.course.path, Math.min(goal.gate.along, along + 12));
      const r = onCourse?.off < 24 ? {
        path: goal.course.path,
        on: { ...onCourse, along, length: goal.gate.along },
        distance: Math.max(0, goal.gate.along - along) + onCourse.off,
        yaw: Math.atan2(ahead.x - g.player.pos.x, ahead.z - g.player.pos.z),
      } : this.navigation.update({
        key: goal.label,
        from: g.player.pos,
        target,
        dt,
      });
      let extra = '';
      if (goal.rush) {
        const run = goal.rush, seconds = Math.max(0, Math.ceil((run.deadline - this.client.now()) / 1000));
        extra = run.start ? ` · CHAIN ×${run.index} · ${90 - Math.min(90, seconds)}s ELAPSED · ${seconds}s LEFT` : ' · CROSS TOWARD EDWARD STREET';
      }
      if (goal.arena) extra = ` · ${Math.max(0, Math.ceil((goal.arena.deadline - this.client.now()) / 1000))}s`;
      if (goal.race && !this.raceCountdown()) {
        const competitors = Object.entries(goal.race.entries).filter(([id]) => this.room.players[id]);
        const me = this.raceEntry();
        const ahead = competitors.filter(([id, e]) => e.finished || e.index > me.index ||
          (e.index === me.index && Math.hypot(this.room.players[id].pos.x - goal.x, this.room.players[id].pos.z - goal.z)
            < Math.hypot(g.player.pos.x - goal.x, g.player.pos.z - goal.z) && id !== this.client.id));
        extra = ` · PLACE ${ahead.length + 1}/${competitors.length}`;
      }
      const distance = r?.distance ?? Math.hypot(goal.x - g.player.pos.x, goal.z - g.player.pos.z);
      hud.textContent = goal.label + ' · ' + Math.ceil(distance) + ' m' + extra + (goal === EXCHANGE && this.near(EXCHANGE, 5) ? ' · E OPEN' : '');
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
        (gridOpen
          ? `TROLLEY RACE · GRID OPENS IN ${Math.max(0, Math.ceil((race.deadline - this.client.now()) / 1000))}s` : null) ||
        (this.near(EXCHANGE, 5) ? 'E · REBAR EXCHANGE' : null) ||
        g.zone.cityLife?.hintAt(g.player.pos) ||
        (g.garage.near() ? 'G · BUNG GARAGE' : 'B · ROOM  |  ENTER · CHAT  |  T · TROLLEY  |  E · MOUNT / ARRIVALS  |  F · QUEST');
    const run = this.room.players[this.client.id]?.ring;
    const gate = run?.deadline && RING_GATES[run.index];
    this.rushGate.visible = !!gate;
    if (gate) {
      this.rushGate.position.set(gate.x, g.zone.groundAt(gate.x, gate.z) + 1.75, gate.z);
      this.rushGate.rotation.y = gate.yaw;
      const pos = g.player.pos;
      const plane = (pos.x - gate.x) * gate.nx + (pos.z - gate.z) * gate.nz;
      const side = (pos.x - gate.x) * gate.nz - (pos.z - gate.z) * gate.nx;
      if (this.rushPrev?.gate === gate && this.rushPrev.plane < 0 && plane >= 0 &&
          Math.abs(side) > RING_WIDTH + .55 && Math.abs(side) < 7)
        this.error('Ring missed · turn around and pass through its gold opening.');
      this.rushPrev = { gate, plane };
    }
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
    const a = this.room.arena;
    if (arenaLive(a) && a.players.includes(this.client.id)) {
      if (a.phase === 'playing') this.client.command('arenaAct');
      return;
    }
    const q = this.room.quest;
    if (q.status === 'playing' && q.roles.includes(this.client.id)) {
      this.client.command('questAct');
      return;
    }
    const rally = this.room.games.rally;
    if (rally?.status === 'playing' && rally.players.includes(this.client.id)) {
      this.client.command('play', { game: 'rally', action: {} });
      return;
    }
  }
  async leave() {
    this.game.phone?.close();
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
        if (o.isInstancedMesh) o.dispose();
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
    this.paintTrolley(this.game.trolley.mesh, false);
    this.game.trolley.trail.material.color.setHex(this.game.trolley.spec.trail);
    this.mint?.dispose();
    this.mint = null;
    this.game.trolley.dismiss();
    if (this.previous) {
      Object.assign(state, DEFAULT_STATE(), this.previous);
      this.game.trolley.applyFleet(state.trolley, false);
    }
    this.previous = null;
    this.game.mode = 'menu';
    this.game.input.enabled = false;
    this.game.input.unlock();
    this.game.hud.hide();
    await this.game.loadZone('mansion', true);
    this.game.menus.showMain();
  }
}
