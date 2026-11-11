import { openProfile } from '../profile/ProfileUI.js';

import { state } from '../core/state.js';
import { conditionsAt, TIERS, weatherAt, weatherWarning } from '../weather/model.js';
import { EDITIONS, editionFor, editionImage } from './editions.js';
import { PhoneRadar } from './radar.js';

const APPS = [
  ['weather', '◈', 'Weather', '#68d9ef'], ['map', '⌖', 'City Map', '#a0e2ad'],
  ['camera', '◎', 'Camera', '#f3c5a7'], ['wallet', '▣', 'Wallet', '#ffdc81'],
  ['notes', '≡', 'Notes', '#f6e08f'], ['arcade', '✦', 'Arcade', '#e7a1ee'],
  ['calculator', '×', 'Calculator', '#9ab6f4'], ['device', '◫', 'Device', '#bfc9de'],
];
const fmtTime = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' });
const memory = ['🔩', '🍔', '🛒', '📱', '⚡', '🥤'];
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const win = board => lines.some(([a,b,c]) => board[a] && board[a] === board[b] && board[b] === board[c]);
const read = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function button(text, action, cls) {
  const b = el('button', text, cls);
  b.type = 'button';
  b.onclick = action;
  return b;
}
function art(edition) {
  const figure = el('div', '', 's24-art s24-art-' + edition.id);
  const img = el('img');
  img.src = editionImage(edition);
  img.alt = edition.name + ' handset concept';
  img.width = 520;
  img.height = 780;
  img.decoding = 'async';
  figure.append(img);
  if (edition.id === 'night') figure.append(el('span', 'CHUNG', 's24-night-label'));
  return figure;
}
export function phonePicker(parent) {
  const wrap = el('section', '', 's24-picker');
  const title = el('h3', '', 's24-picker-title');
  const content = el('div', '', 's24-picker-content');
  const preview = el('div', '', 's24-picker-preview');
  const controls = el('div');
  const label = el('label', 'Handset edition');
  const select = el('select');
  select.id = 'mp-phone-edition';
  label.htmlFor = select.id;
  for (const edition of EDITIONS) {
    const option = el('option', edition.name);
    option.value = edition.id;
    select.append(option);
  }
  select.value = editionFor(read('bung-s24-room')).id;
  const render = () => {
    const e = editionFor(select.value);
    preview.replaceChildren(art(e));
    wrap.style.setProperty('--s24-accent', e.accent);
    title.textContent = 'Rebar S24 · ' + e.name;
  };
  select.onchange = render;
  controls.append(label, select, el('p', 'All editions include Bung Weather, City Map, Camera, Notes and the Arcade.'));
  content.append(preview, controls);
  wrap.append(title, content);
  parent.append(wrap);
  render();
  return () => {
    const id = editionFor(select.value).id;
    write('bung-s24-room', id);
    return id;
  };
}

export class Phone {
  constructor(game) {
    this.game = game;
    this.slot = button('', () => this.open(), 's24-slot');
    this.slot.hidden = true;
    this.slot.setAttribute('aria-label', 'Equip Rebar S24');
    this.slot.append(el('span', '▯', 's24-slot-icon'), el('b', 'S24'), el('kbd', '1'));
    this.alert = el('button', '', 's24-alert');
    this.alert.type = 'button';
    this.alert.hidden = true;
    this.alert.onclick = () => this.open('weather');
    this.alert.setAttribute('aria-live', 'polite');
    this.alertTitle = el('strong');
    this.alertDetail = el('small');
    this.alert.append(el('span', 'BUNG WEATHER · BRISBANE', 's24-alert-label'), this.alertTitle, this.alertDetail);
    this.dialog = el('dialog', '', 's24-shell');
    this.dialog.setAttribute('aria-label', 'Rebar S24');
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); this.close(); });
    this.dialog.addEventListener('click', e => {
      if (e.target === this.dialog) {
        const r = this.dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.close();
      }
    });
    this.screen = el('div', '', 's24-screen');
    this.status = el('header', '', 's24-status');
    this.clock = el('span', fmtTime.format(new Date()));
    this.status.append(this.clock, el('b', 'REBAR S24'), button('×', () => this.close(), 's24-close'));
    this.status.lastElementChild.setAttribute('aria-label', 'Put phone away');
    this.body = el('main', '', 's24-body');
    const dock = el('footer', '', 's24-dock');
    dock.append(button('Home', () => this.show('home')), button('Weather', () => this.show('weather')));
    this.screen.append(this.status, this.body, dock);
    this.dialog.append(this.screen);
    document.body.append(this.slot, this.alert, this.dialog);
    this.tick = 0;
    this.opened = false;
    this.galleryIndex = 0;
  }

  edition() {
    if (this.game.multiplayer.active) return editionFor(this.game.multiplayer.phoneEdition || read('bung-s24-room'));
    const story = state.saga?.phone;
    return editionFor(story === 'blue' || story === 'replaced' ? 'rebar' : read('bung-s24-solo'));
  }

  available() {
    const g = this.game;
    return g.mode === 'playing' && !g.garage?.opened && !g.loading && !g.dialogue.cinematic && !g.saga.freeze &&
      !g.saga.scenePlaying && !g.photo && !document.getElementById('hotel-lift-menu') &&
      !g.saga.venues?.pending && (!g.multiplayer.active || !g.multiplayer.focus || this.opened);
  }

  open(page = 'home') {
    if (this.opened || !this.available()) return;
    const g = this.game, e = this.edition();
    this.opened = true;
    this.wasEnabled = g.input.enabled;
    this.wasLocked = g.input.locked;
    if (g.multiplayer.active) g.multiplayer.setFocus(true);
    else {
      g.input.enabled = false;
      g.input.unlock();
      g._wasLocked = false;
    }
    g.input.keys = {};
    g.input.pressed = {};
    g.trolley.setBoosting(false, 'phone');
    this.dialog.style.setProperty('--s24-accent', e.accent);
    this.dialog.style.setProperty('--s24-case', e.color);
    this.slot.setAttribute('aria-pressed', 'true');
    this.dialog.showModal();
    this.show(page);
  }

  close() {
    if (!this.opened) return;
    const g = this.game;
    this.opened = false;
    this.timers?.forEach(clearTimeout);
    this.timers = [];
    this.dialog.close();
    this.slot.setAttribute('aria-pressed', 'false');
    g.input.keys = {};
    g.input.pressed = {};
    if (g.multiplayer.active) g.multiplayer.setFocus(false);
    else if (g.mode === 'playing') g.input.enabled = this.wasEnabled;
    if (this.wasLocked && g.input.enabled) g.input.lock();
  }

  update(dt) {
    const hidden = !this.available();
    if (this.slot.hidden !== hidden) this.slot.hidden = hidden;
    if (!this.opened && !hidden && this.game.input.pressed.Digit1) this.open();
    if (this.opened && (this.game.mode !== 'playing' || this.game.loading)) this.close();
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = .20;
    const weather = this.game.weather;
    const p = this.game.player.pos;
    const warning = weather.zone && weatherWarning(weather.frame, p.x, p.z, true);
    this.alert.hidden = !this.available() || this.opened || !warning;
    if (!this.alert.hidden) {
      this.alert.dataset.severity = warning.severity;
      if (this.alertTitle.textContent !== warning.title) this.alertTitle.textContent = warning.title;
      if (this.alertDetail.textContent !== warning.detail) this.alertDetail.textContent = warning.detail;
    }
    if (!this.opened) return;
    this.clock.textContent = fmtTime.format(new Date());
    this.drawRadar?.();
    this.drawWallet?.();
  }

  show(id) {
    this.timers?.forEach(clearTimeout);
    this.timers = [];
    this.drawRadar = null;
    this.drawWallet = null;
    this.body.replaceChildren();
    this.body.scrollTop = 0;
    this.body.dataset.page = id;
    if (id === 'home') {
      const e = this.edition(), g = this.game;
      const mast = el('div', '', 's24-mast');
      mast.append(el('small', 'BUNG MOBILE / ' + e.number), el('h2', e.name),
        el('p', state.saga?.phone === 'broken' && !g.multiplayer.active
          ? 'Spare handset · chapter evidence remains separate.'
          : 'Brisbane field kit · everything in your pocket.'));
      const grid = el('div', '', 's24-app-grid');
      for (const [app, icon, name, color] of APPS) {
        const b = button('', () => this.show(app), 's24-app');
        const mark = el('i', icon);
        mark.style.setProperty('--s24-app-color', color);
        mark.setAttribute('aria-hidden', 'true');
        b.append(mark, el('span', name));
        grid.append(b);
      }
      this.body.append(mast, grid);
      return;
    }
    this.body.append(el('h2', APPS.find(a => a[0] === id)?.[2] || 'S24', 's24-app-title'));
    if (id === 'weather' || id === 'map') this.weatherApp(id === 'map');
    else if (id === 'device') this.device();
    else if (id === 'notes') this.notes();
    else if (id === 'wallet') this.wallet();
    else if (id === 'camera') this.camera();
    else if (id === 'calculator') this.calculator();
    else if (id === 'arcade') this.arcade();
  }

  weatherApp(map) {
    const g = this.game, w = g.weather;
    const region = el('p', 'BRISBANE · GAME SIMULATION', 's24-kicker');
    const current = el('div', '', 's24-current'), warning = el('p', '', 's24-warning');
    const canvas = el('canvas', '', 's24-radar');
    canvas.setAttribute('aria-label', map ? 'Brisbane world map' : 'Simulated Brisbane weather radar');
    const radar = new PhoneRadar(canvas);
    radar.layer = map ? 'map' : 'rain';
    const tools = el('div', '', 's24-row');
    const zoom = button('Zoom 1×', () => {
      radar.zoom = radar.zoom === 1 ? 1.6 : radar.zoom === 1.6 ? 2.5 : 1;
      zoom.textContent = 'Zoom ' + radar.zoom + '×';
      this.drawRadar();
    });
    tools.append(zoom);
    this.body.append(region);
    if (!map) this.body.append(current, warning);
    this.body.append(canvas, tools);
    const forecast = el('div', '', 's24-forecast');
    if (!map) {
      const layer = button('Rain', () => {
        radar.layer = radar.layer === 'rain' ? 'wind' : 'rain';
        layer.textContent = radar.layer === 'wind' ? 'Radial wind' : 'Rain';
        legend.textContent = radar.layer === 'wind' ? 'Teal · inbound   /   Coral · outbound' : 'Teal · light rain   /   Pink · most intense';
        this.drawRadar();
      });
      const loop = button('Replay', () => {
        playing = !playing;
        if (playing) start = performance.now();
        loop.textContent = playing ? 'Live' : 'Replay';
        if (!playing) radar.age = 0;
        this.drawRadar();
      });
      let playing = false, start = 0;
      const legend = el('p', 'Teal · light rain   /   Pink · most intense', 's24-caption');
      const replay = el('p', '', 's24-caption');
      tools.append(layer, loop);
      this.body.append(legend, replay, forecast);
      if (!g.multiplayer.active && w.zone) {
        const rating = el('select', '', 's24-drill-tier');
        rating.setAttribute('aria-label', 'Drill tornado rating');
        TIERS.forEach(({ rating: title }, tier) => {
          const option = el('option', title + ' drill');
          option.value = tier;
          rating.append(option);
        });
        rating.value = w.exercise?.tier ?? 2;
        rating.disabled = !!w.exercise;
        const drill = button(w.exercise ? 'End storm drill' : 'Start solo storm drill', () => {
          w.drill(!w.exercise, Number(rating.value));
          drill.textContent = w.exercise ? 'End storm drill' : 'Start solo storm drill';
          rating.disabled = !!w.exercise;
          this.drawRadar();
        });
        const training = el('div', '', 's24-row');
        training.append(rating, drill);
        this.body.append(training);
      }
      this.drawRadar = () => {
        if (playing) radar.age = 45 - ((performance.now() - start) / 100 % 45);
        replay.textContent = playing ? 'HISTORY · ' + Math.ceil(radar.age) + ' seconds ago' : 'LIVE SCAN · cyan dot is your position';
        radar.draw(g);
        if (!w.zone) {
          current.textContent = 'Brisbane station out of range';
          warning.hidden = true;
          forecast.textContent = 'Travel to Brisbane for local radar and alerts.';
          return;
        }
        const p = g.player.pos, f = w.frame, c = w.conditions;
        current.textContent = c.temp + '°C · ' + c.label + ' · gusts ' + Math.round(c.gust) + ' km/h';
        warning.hidden = false;
        const alert = weatherWarning(f, p.x, p.z);
        warning.dataset.severity = alert?.severity || 'clear';
        warning.textContent = alert ? alert.title + ' · ' + alert.distance + ' m away · ' + alert.detail : 'No active warnings';
        const next = conditionsAt(weatherAt(w.seed, w.time + 60, w.exercise), p.x, p.z);
        forecast.textContent = (w.exercise ? 'DRILL · ' : '') + 'IN 60 GAME SECONDS · ' + next.label + ' · gusts ' + Math.round(next.gust) + ' km/h';
      };
    } else {
      if (g.multiplayer.active) for (const [label,x,z] of [['City Hall', 1.7, 0], ['Bung Garage', 108.45, 22], ['Queen Street', 173, 81.5], ['South Bank', -194, 774], ['Botanic Gardens', 605, 886]]) {
        tools.append(button(label, () => {
          g.multiplayer.activityTarget = { label, x, z };
          this.close();
        }));
      } else tools.append(button('District map', () => {
        this.close();
        g.pauseForMenu();
        g.menus.showMap(() => g.menus.showPause());
      }));
      this.drawRadar = () => radar.draw(g);
    }
    this.drawRadar();
  }

  device() {
    this.galleryIndex = EDITIONS.indexOf(this.edition());
    const shelf = el('div', '', 's24-device');
    const controls = el('div', '', 's24-row');
    const name = el('p', '', 's24-device-name');
    const stage = el('div', '', 's24-device-art');
    const equip = button('Equip edition', () => {
      const e = EDITIONS[this.galleryIndex];
      if (this.game.multiplayer.active) {
        this.game.multiplayer.phoneEdition = e.id;
        write('bung-s24-room', e.id);
      } else write('bung-s24-solo', e.id);
      this.dialog.style.setProperty('--s24-accent', this.edition().accent);
      this.dialog.style.setProperty('--s24-case', this.edition().color);
      update();
    });
    const update = () => {
      const e = EDITIONS[this.galleryIndex];
      name.textContent = e.number + ' / ' + e.name;
      stage.replaceChildren(art(e));
      equip.disabled = this.edition().id === e.id || (!this.game.multiplayer.active && ['blue','replaced'].includes(state.saga?.phone));
      equip.textContent = this.edition().id === e.id ? 'Equipped' : 'Equip edition';
    };
    const step = n => { this.galleryIndex = (this.galleryIndex + n + EDITIONS.length) % EDITIONS.length; update(); };
    controls.append(button('‹ Previous', () => step(-1)), equip, button('Next ›', () => step(1)));
    const setting = el('label', '', 's24-setting');
    const reduced = el('input');
    reduced.type = 'checkbox';
    reduced.checked = this.game.weather.reduceFlash;
    reduced.onchange = () => {
      this.game.weather.reduceFlash = reduced.checked;
      write('bung-s24-flashes', String(reduced.checked));
    };
    setting.append(reduced, el('span', 'Reduce lightning flashes'));
    shelf.append(name, stage, controls, setting);
    this.body.append(shelf);
    update();
  }

  notes() {
    const area = el('textarea', '', 's24-notes');
    area.maxLength = 3000;
    area.placeholder = 'Write a note for your next Brisbane run…';
    area.setAttribute('aria-label', 'Your notes');
    area.value = read('bung-s24-notes');
    const status = el('p', 'Stored on this device.', 's24-caption');
    area.oninput = () => { write('bung-s24-notes', area.value); status.textContent = area.value.length + ' / 3000 · saved locally'; };
    this.body.append(area, status);
  }

  wallet() {
    const balances = el('div', '', 's24-wallet');
    this.body.append(balances);
    this.body.append(button('Player profile · save / restore',()=>openProfile()));
    this.drawWallet = () => {
      const g = this.game, mp = g.multiplayer, p = mp.room?.players[mp.client?.id];
      const text = mp.active && p
        ? [p.score + ' room points', p.rebar + ' room rebar', Object.keys(p.inventory || {}).length + ' equipped upgrades']
        : [state.rebars + ' rebar', state.score + ' campaign score'];
      if (balances.dataset.values === text.join()) return;
      balances.dataset.values = text.join();
      balances.replaceChildren(...text.map(v => el('p', v)));
    };
    this.drawWallet();
  }

  camera() {
    const g = this.game, result = el('div', '', 's24-camera-view');
    result.append(el('p', 'Frame the city before opening the camera.'));
    this.body.append(result, button('Take photo', () => {
      g.renderer.render(g.scene, g.camera);
      const src = g.renderer.domElement.toDataURL('image/jpeg', .86);
      const img = el('img');
      img.alt = 'Brisbane game snapshot';
      img.src = src;
      const save = el('a', 'Download photo', 's24-download');
      save.href = src;
      save.download = 'bung-brisbane.jpg';
      result.replaceChildren(img, save);
    }));
  }

  calculator() {
    const readout = el('output', '0', 's24-calculator-readout');
    const keys = el('div', '', 's24-calculator');
    let current = '', lhs = null, op = '';
    const operate = (a, b, sign) => sign === '+' ? a + b : sign === '−' ? a - b : sign === '×' ? a * b : b ? a / b : NaN;
    for (const k of ['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+','Clear']) {
      keys.append(button(k, () => {
        if (k === 'Clear') { current = ''; lhs = null; op = ''; }
        else if ('0123456789.'.includes(k)) {
          if (current.length < 12 && (k !== '.' || !current.includes('.'))) current += k;
        } else {
          if (current && Number.isFinite(Number(current))) lhs = lhs !== null && op ? operate(lhs, Number(current), op) : Number(current);
          current = '';
          op = k === '=' ? '' : k;
        }
        readout.textContent = current || (lhs === null ? '0' : Number.isFinite(lhs) ? Number(lhs.toPrecision(10)).toString() : 'Error');
      }));
    }
    this.body.append(readout, keys);
  }

  arcade() {
    const menu = el('div', '', 's24-row'), zone = el('div', '', 's24-arcade');
    const later = (fn, ms) => this.timers.push(setTimeout(fn, ms));
    const open = game => {
      this.timers.forEach(clearTimeout);
      this.timers = [];
      const label = el('p', '', 's24-game-status'), grid = el('div', '', 's24-arcade-grid');
      zone.replaceChildren(label, grid);
      if (game === 'noughts') {
        const cells = Array(9).fill(''), buttons = [];
        const free = () => cells.flatMap((mark,i) => mark ? [] : [i]);
        const outcome = mark => {
          if (win(cells)) {
            label.textContent = mark === '🔩' ? 'Rebar wins!' : 'Burger wins!';
            buttons.forEach(b => b.disabled = true);
            return true;
          }
          if (!free().length) { label.textContent = 'Draw.'; return true; }
          return false;
        };
        label.textContent = 'You are rebar. Beat the burger.';
        const play = (i, mark) => {
          cells[i] = buttons[i].textContent = mark;
          buttons[i].disabled = true;
        };
        for (let i = 0; i < 9; i++) {
          const cell = button('·', () => {
            if (cells[i]) return;
            play(i, '🔩');
            if (outcome('🔩')) return;
            const list = free();
            const best = mark => list.find(j => {
              cells[j] = mark;
              const won = win(cells);
              cells[j] = '';
              return won;
            });
            play(best('🍔') ?? best('🔩') ?? (list.includes(4) ? 4 : list[Math.floor(Math.random() * list.length)]), '🍔');
            outcome('🍔');
          });
          cell.setAttribute('aria-label', 'Square ' + (i+1));
          buttons.push(cell);
          grid.append(cell);
        }
      } else if (game === 'memory') {
        const deck = [...memory, ...memory];
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        const buttons = [], picked = [];
        let pairs = 0, turns = 0;
        label.textContent = 'Find all six pairs.';
        for (const [i, mark] of deck.entries()) {
          const tile = button('?', () => {
            if (picked.length >= 2 || tile.disabled) return;
            tile.disabled = true;
            tile.textContent = mark;
            picked.push(i);
            if (picked.length < 2) return;
            turns++;
            const [a,b] = picked;
            if (deck[a] === deck[b]) {
              pairs++;
              label.textContent = pairs === 6 ? 'All six pairs in ' + turns + ' turns!' : pairs + ' / 6 pairs';
              picked.length = 0;
            } else later(() => {
              for (const k of picked) { buttons[k].textContent = '?'; buttons[k].disabled = false; }
              picked.length = 0;
            }, 600);
          });
          buttons.push(tile);
          grid.append(tile);
        }
      } else {
        label.textContent = 'Wait for SERVED. Then tap as fast as you can.';
        let start = 0, ready = false, running = false, timer;
        const buzz = button('Start', () => {
          if (ready) {
            const score = Math.round(performance.now() - start);
            const best = Math.min(score, Number(read('bung-s24-buzzer', '99999')));
            write('bung-s24-buzzer', best);
            label.textContent = score + ' ms · personal best ' + best + ' ms';
            ready = running = false;
            buzz.textContent = 'Try again';
          } else if (running) {
            clearTimeout(timer);
            running = false;
            label.textContent = 'Too early. The burger is still cooking.';
            buzz.textContent = 'Try again';
          } else {
            running = true;
            buzz.textContent = 'Cooking…';
            timer = setTimeout(() => { ready = true; start = performance.now(); buzz.textContent = 'SERVED!'; }, 850 + Math.random() * 1850);
            this.timers.push(timer);
          }
        });
        grid.replaceWith(buzz);
      }
    };
    menu.append(button('Rebars & Burgers', () => open('noughts')), button('Memory', () => open('memory')),
      button('Burger Buzzer', () => open('reaction')));
    this.body.append(menu, zone);
    open('noughts');
  }
}
