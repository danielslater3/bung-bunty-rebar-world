import { PROTOCOL, normalizeAppearance } from './catalog.js';
import { roomTrolley } from './fleet.js';
export class RoomClient {
  constructor(endpoint, events = {}) {
    const url = new URL(endpoint);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw Error('Use an HTTPS room-server address.');
    if (
      url.protocol === 'http:' &&
      !['localhost', '127.0.0.1'].includes(url.hostname)
    )
      throw Error('Public room servers must use HTTPS.');
    this.endpoint = url.origin;
    this.events = events;
    this.closed = false;
    this.connected = false;
    this.retry = 0;
    this.seq = 0;
  }
  async create() {
    const r = await fetch(this.endpoint + '/rooms', { method: 'POST' });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'Could not create a room.');
    return data.code;
  }
  async join(code, name, appearance, trolley) {
    this.code = code.toUpperCase().replace(/\s/g, '');
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(this.code))
      throw Error('Enter the eight-character room code.');
    this.name = name.slice(0, 20);
    this.appearance = normalizeAppearance(appearance);
    this.trolley = trolley == null ? undefined : roomTrolley(trolley).id;
    this.token = sessionStorage.getItem('bung-room-' + this.code) || '';
    return this.open();
  }
  open() {
    return new Promise((resolve, reject) => {
      const u = new URL(this.endpoint + '/rooms/' + this.code + '/socket');
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = (this.ws = new WebSocket(u));
      let welcomed = false;
      const timeout = setTimeout(() => {
        if (!welcomed) {
          reject(
            Error(
              'Room server did not respond. Check the address or try again.',
            ),
          );
          ws.close();
        }
      }, 12000);
      this.timeout = timeout;
      ws.onopen = () =>
        ws.send(
          JSON.stringify({
            type: 'hello',
            protocol: PROTOCOL,
            name: this.name,
            appearance: this.appearance,
            trolley: this.trolley,
            token: this.token,
          }),
        );
      ws.onmessage = (e) => {
        if (e.data === 'pong') {
          this.lastPong = performance.now();
          return;
        }
        let m;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        if (Number.isFinite(m.serverTime))
          this.offset = m.serverTime - Date.now();
        if (m.type === 'welcome') {
          welcomed = true;
          clearTimeout(timeout);
          this.connected = true;
          this.retry = 0;
          this.id = m.id;
          this.token = m.token;
          this.seq = Math.max(this.seq, m.seq + 1);
          sessionStorage.setItem('bung-room-' + this.code, this.token);
          this.events.connection?.(true);
          resolve(m);
        }
        if (m.type === 'error' && !welcomed) {
          clearTimeout(timeout);
          reject(Error(m.message));
        }
        if (m.type === 'removed') {
          this.closed = true;
          this.events.error?.(m.message);
        }
        this.events.message?.(m);
      };
      ws.onerror = () => {
        if (!welcomed) {
          clearTimeout(timeout);
          reject(Error('Cannot reach the room server.'));
        }
      };
      ws.onclose = (e) => {
        clearTimeout(timeout);
        this.connected = false;
        this.events.connection?.(false);
        if (!welcomed)
          reject(
            Error(
              e.code === 4003
                ? 'Room full, expired, or access removed.'
                : 'Connection interrupted.',
            ),
          );
        if (!this.closed && ![4001, 4003].includes(e.code)) {
          this.reconnectTimer = setTimeout(
            () => this.open().catch((err) => this.events.error?.(err.message)),
            Math.min(8000, 500 * 2 ** this.retry++) + Math.random() * 200,
          );
        } else if (e.code === 4001) {
          this.closed = true;
          this.events.error?.('This Bung rejoined in another tab.');
        }
      };
    });
  }
  send(m) {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(m));
      return true;
    }
    return false;
  }
  command(cmd, data = {}) {
    if (
      !this.send({
        type: 'command',
        cmd,
        requestId: crypto.randomUUID(),
        ...data,
      })
    )
      this.events.error?.('Reconnect before sending an action.');
  }
  move(pos, yaw) {
    this.send({
      type: 'move',
      seq: this.seq++,
      pos: { x: pos.x, y: pos.y, z: pos.z },
      yaw,
    });
  }
  now() {
    return Date.now() + (this.offset || 0);
  }
  close() {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.timeout);
    this.connected = false;
    this.ws?.close(1000, 'Left room');
  }
}
