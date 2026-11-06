import { GAMES, SYMBOLS, COLORS } from './catalog.js';
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
function token(kind) {
  const e = el('span', 'mp-token ' + (kind === 0 ? 'rebar' : 'burger'));
  e.setAttribute('aria-label', kind === 0 ? 'Rebar' : 'Burger');
  if (kind === 1)
    for (const cls of ['bun', 'lettuce', 'patty', 'base'])
      e.append(el('i', cls));
  return e;
}
export class MiniGames {
  constructor(mp) {
    this.mp = mp;
    this.selected = null;
    this.code = [0, 1, 2, 3];
    this.root = null;
    this.lastKey = '';
  }
  open(id) {
    this.selected = id;
    this.mp.setFocus(true);
    this.render(true);
  }
  close() {
    this.root?.remove();
    this.root = null;
    this.selected = null;
    this.mp.setFocus(false);
  }
  render(force = false) {
    if (!this.selected) return;
    const mp = this.mp,
      g = mp.room?.games[this.selected],
      def = GAMES.find((x) => x.id === this.selected),
      key = mp.room?.revision + ':' + this.selected;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.root?.remove();
    const overlay = (this.root = el('div', 'mp-overlay mp-game-overlay'));
    overlay.id = 'mp-game-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', def.name);
    const card = el('section', 'mp-game-card');
    card.append(
      el('small', 'mp-eyebrow', def.tag),
      el('h2', '', `${def.icon} ${def.name}`),
      el('p', 'mp-game-help', def.help),
    );
    const row = el('div', 'mp-game-toolbar');
    const btn = (
      text,
      fn,
      parent = row,
      disabled = false,
      cls = 'mp-button',
    ) => {
      const b = el('button', cls, text);
      b.disabled = disabled;
      b.onclick = fn;
      parent.append(b);
      return b;
    };
    btn('BACK TO CITY', () => this.close());
    btn('ALL GAMES', () => {
      this.close();
      mp.openBoard();
    });
    card.append(row);
    overlay.append(card);
    document.body.append(overlay);
    const send = (action) =>
      mp.client.command('play', { game: def.id, action });
    const self = mp.client.id,
      inGame = g?.players.includes(self);
    if (!g || g.status === 'finished') {
      if (g) {
        card.append(
          el(
            'div',
            'mp-result',
            g.winners.length
              ? `${g.winners.map((id) => mp.name(id)).join(' & ')} WINS!`
              : 'A BEAUTIFULLY ENORMOUS DRAW',
          ),
          el('p', '', g.reason),
        );
        for (const id of g.players)
          card.append(
            el(
              'p',
              'mp-score-line',
              `${mp.name(id)} · ${mp.room.players[id]?.score || 0} room points · ${g.scores[id] || 0} match points`,
            ),
          );
        if (g.id === 'tictactoe') {
          const grid = el('div', 'mp-board');
          grid.style.gridTemplateColumns = 'repeat(3,1fr)';
          g.board.forEach((v) => {
            const cell = el('div', 'mp-tile mp-display-tile');
            if (v) cell.append(token(g.players.indexOf(v)));
            grid.append(cell);
          });
          card.append(grid);
        }
      }
      btn(
        g ? 'PLAY AGAIN' : 'OPEN THIS TABLE',
        () => mp.client.command('joinGame', { game: def.id }),
        card,
      );
      return;
    }
    const seats = el('div', 'mp-seats');
    for (const id of g.players) {
      const p = mp.room.players[id];
      seats.append(
        el(
          'span',
          `mp-seat ${g.ready[id] ? 'ready' : ''}`,
          `${mp.name(id)}${p?.connected ? '' : ' · reconnecting'}${g.status === 'waiting' ? (g.ready[id] ? ' ✓' : ' · not ready') : ''}`,
        ),
      );
    }
    card.append(seats);
    if (g.status === 'waiting') {
      if (!inGame)
        btn(
          'JOIN TABLE',
          () => mp.client.command('joinGame', { game: def.id }),
          card,
          g.players.length >= def.max,
        );
      else {
        btn(
          g.ready[self] ? 'NOT READY' : 'I’M READY',
          () => mp.client.command('ready', { game: def.id }),
          card,
        );
        if (g.owner === self)
          btn(
            'START MATCH',
            () => mp.client.command('startGame', { game: def.id }),
            card,
            g.players.length < def.min ||
              g.players.some(
                (id) => !g.ready[id] || !mp.room.players[id]?.connected,
              ),
          );
        btn(
          'LEAVE TABLE',
          () => mp.client.command('leaveGame', { game: def.id }),
          card,
        );
      }
      card.append(
        el(
          'p',
          'mp-caption',
          `${g.players.length}/${def.max} players · everyone readies before the captain starts`,
        ),
      );
      return;
    }
    if (inGame)
      btn('LEAVE MATCH', () => {
        mp.client.command('leaveGame', { game: def.id });
        this.close();
      });
    const status = el('div', 'mp-game-status');
    card.append(status);
    const clock = el('small', 'mp-caption');
    clock.id = 'mp-match-clock';
    card.append(clock);
    status.textContent = inGame
      ? 'PLAYING'
      : 'SPECTATING · join the next round';
    const mine = inGame && mp.client.connected,
      turn = g.players[g.turn % g.players.length] === self;
    const board = el('div', 'mp-board');
    card.append(board);
    if (['tictactoe', 'connect', 'memory', 'slide'].includes(def.id)) {
      const cols = def.id === 'connect' ? 7 : def.id === 'memory' ? 4 : 3;
      board.style.gridTemplateColumns = `repeat(${cols},1fr)`;
      if (['tictactoe', 'connect', 'memory'].includes(def.id))
        status.textContent = `${mp.name(g.players[g.turn % g.players.length])}’S TURN${!inGame ? ' · spectating' : ''}`;
      if (def.id === 'tictactoe')
        g.board.forEach((v, i) => {
          const b = btn(
            '',
            () => send({ cell: i }),
            board,
            !mine || !turn || !!v,
            'mp-tile',
          );
          if (v) b.append(token(g.players.indexOf(v)));
          else b.setAttribute('aria-label', 'Square ' + (i + 1));
        });
      if (def.id === 'connect')
        g.board.forEach((v, i) => {
          const b = btn(
            v ? '' : '·',
            () => send({ column: i % 7 }),
            board,
            !mine || !turn,
            'mp-tile mp-connect',
          );
          if (v) b.append(token(g.players.indexOf(v)));
        });
      if (def.id === 'memory')
        g.visible.forEach((v, i) =>
          btn(
            v === null ? '?' : SYMBOLS[v],
            () => send({ cell: i }),
            board,
            !mine || !turn || v !== null,
            'mp-tile ' + (g.matched.includes(i) ? 'matched' : ''),
          ),
        );
      if (def.id === 'slide') {
        const b = g.puzzles[self] || g.puzzles[g.players[0]];
        b.forEach((v, i) =>
          btn(
            v === 8 ? '' : `${i === v ? '✓ ' : ''}${SYMBOLS[v]} ${v + 1}`,
            () => send({ cell: i }),
            board,
            !mine || v === 8,
            'mp-tile ' + (v === 8 ? 'empty' : ''),
          ),
        );
        status.textContent = `${g.moves[self] || 0} moves · arrange 1–8, gap last`;
      }
    }
    if (def.id === 'reaction') {
      const b = btn(
        'WAIT FOR THE BURGER…',
        () => send({}),
        board,
        !mine || g.attempts[self] !== undefined,
        'mp-buzzer',
      );
      b.id = 'mp-live-action';
    }
    if (def.id === 'rhythm') {
      const track = el('div', 'mp-beat-track');
      for (let i = 0; i < 8; i++) track.append(el('span', '', `${i + 1}`));
      board.append(track);
      btn(
        'F · DROP A BAR',
        () => this.liveAction(),
        board,
        !mine,
        'mp-buzzer',
      ).id = 'mp-live-action';
    }
    if (def.id === 'feint') {
      ['🔩 REBAR', '🍔 BURGER', '🥽 GOGGLES'].forEach((s, i) =>
        btn(
          s,
          () => send({ choice: i }),
          board,
          !mine || g.chosen.includes(self),
          'mp-gesture',
        ),
      );
      status.textContent = `ROUND ${g.round} · ${g.chosen.length}/2 locked in`;
      if (g.last)
        card.append(
          el(
            'p',
            'mp-caption',
            `Previous: ${Object.values(g.last.choices)
              .map((v) => ['🔩', '🍔', '🥽'][v])
              .join(
                ' vs ',
              )} · ${g.last.winner ? mp.name(g.last.winner) + ' wins' : 'draw'}`,
          ),
        );
    }
    if (def.id === 'stack') {
      const scene = el('div', 'mp-stack-scene');
      scene.id = 'mp-stack-scene';
      const s = g.stacks[self] || g.stacks[g.players[0]];
      for (const [i, h] of s.history.entries()) {
        const layer = el('div', 'mp-burger-layer');
        layer.style.cssText = `width:${h.width}px;left:calc(50% + ${h.center - h.width / 2}px);bottom:${i * 14 + 12}px`;
        scene.append(layer);
      }
      const moving = el('div', 'mp-burger-layer moving');
      moving.id = 'mp-moving-layer';
      moving.style.width = s.width + 'px';
      moving.style.bottom = s.layers * 14 + 12 + 'px';
      scene.append(moving);
      board.append(scene);
      btn(
        'F · DROP THE LAYER',
        () => send({}),
        board,
        !mine || s.done,
        'mp-buzzer',
      ).id = 'mp-live-action';
      status.textContent = `${s.layers}/12 layers · ${Math.round(s.width)} mm of burger left`;
    }
    if (def.id === 'code') {
      const pegs = el('div', 'mp-pegs');
      this.code.forEach((c, i) => {
        const b = btn(
          String(c + 1),
          () => {
            let next = (this.code[i] + 1) % 6;
            while (this.code.some((v, j) => j !== i && v === next))
              next = (next + 1) % 6;
            this.code[i] = next;
            this.render(true);
          },
          pegs,
          !mine,
        );
        b.style.background = COLORS[c];
      });
      board.append(pegs);
      btn('CHECK LOCK', () => send({ code: this.code }), board, !mine);
      for (const guess of g.guesses[self] || [])
        board.append(
          el(
            'p',
            'mp-caption',
            `${guess.code.map((v) => v + 1).join(' · ')}  →  ${guess.exact} gold / ${guess.near} silver`,
          ),
        );
    }
    if (def.id === 'rally') {
      card.append(
        el(
          'p',
          'mp-caption',
          `Checkpoint ${(g.checkpoints[self] || 0) + 1}/4 · the gold city arrow follows the route.`,
        ),
      );
      btn('RACE THROUGH BRISBANE', () => this.close(), card);
      btn('CLAIM NEARBY CHECKPOINT · F', () => send({}), card, !mine);
    }
    const scores = el('div', 'mp-live-scores');
    for (const id of g.players)
      scores.append(el('span', '', `${mp.name(id)} · ${g.scores[id] || 0}`));
    card.append(scores);
  }
  liveAction() {
    const g = this.mp.room?.games[this.selected];
    if (!g || g.status !== 'playing') return;
    let action = {};
    if (this.selected === 'rhythm') {
      const i = Math.round((this.mp.client.now() - g.go) / 750);
      if (i < 0 || i > 7) return;
      action = { beat: i };
    }
    this.mp.client.command('play', { game: this.selected, action });
  }
  update() {
    if (!this.selected) return;
    const g = this.mp.room?.games[this.selected],
      b = document.getElementById('mp-live-action');
    if (!g || g.status !== 'playing') return;
    const now = this.mp.client.now(),
      clock = document.getElementById('mp-match-clock');
    if (clock && g.deadline) {
      const seconds = Math.max(0, Math.ceil((g.deadline - now) / 1000));
      clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining · ${['connect', 'memory', 'tictactoe'].includes(g.id) ? '60-second turns' : 'server clock'}`;
    }
    if (this.selected === 'reaction' && b) {
      const delta = now - g.go;
      b.textContent =
        g.attempts[this.mp.client.id] !== undefined
          ? g.attempts[this.mp.client.id] < 0
            ? 'TOO EARLY · BURNT!'
            : `${g.attempts[this.mp.client.id]} ms`
          : delta >= 0
            ? 'SERVED! · F / TAP'
            : `WAIT… ${Math.max(1, Math.ceil(-delta / 1000))}`;
      b.classList.toggle('go', delta >= 0);
    }
    if (this.selected === 'rhythm') {
      const delta = (now - g.go) / 750;
      document
        .querySelectorAll('.mp-beat-track span')
        .forEach((s, i) => s.classList.toggle('on', Math.abs(delta - i) < 0.3));
    }
    if (this.selected === 'stack') {
      const s = g.stacks[this.mp.client.id],
        moving = document.getElementById('mp-moving-layer');
      if (s && moving) {
        moving.style.left = `calc(50% + ${Math.sin((now - s.at) / 650) * 70 - s.width / 2}px)`;
        moving.style.opacity = s.done ? 0 : 1;
      }
    }
  }
}
export { el };
