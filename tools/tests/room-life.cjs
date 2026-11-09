const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const url = process.env.GAME_URL || 'http://127.0.0.1:8765/';
const server = process.env.ROOM_SERVER || 'http://127.0.0.1:8795';
const images = process.env.SHOT_DIR || '../browser-tests';

async function main() {
  const browsers = [];
  const launch = async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    browsers.push(browser);
    return browser;
  };
  const errors = [];
  try {
    async function open(name, code) {
      const browser = await launch();
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      page.on('pageerror', error => { errors.push(error.stack); console.error(error.stack); });
      await page.goto(url);
      await page.waitForFunction(() => !!window.BUNG, null, { polling: 150, timeout: 60000 })
        .catch(async error => { console.error('BOOT', name, await page.locator('body').innerText()); throw error; });
      await page.evaluate(async endpoint => {
        sessionStorage.setItem('bung-room-server', endpoint);
        window.gameDraw = BUNG.renderer.render.bind(BUNG.renderer);
        BUNG.renderer.render = () => {};
        window.THREE = await import('three');
        if (!new URLSearchParams(location.search).has('baseline'))
          window.activities = await import('/src/multiplayer/cityActivities.js');
      }, server);
      await page.locator('#btn-multiplayer').click();
      await page.getByLabel('Your player name').fill(name);
      if (code) await page.getByLabel('Eight-character room code').fill(code);
      await page.getByRole('button', { name: code ? 'JOIN YOUR MATES' : 'CREATE A ROOM', exact: true }).click();
      await page.waitForFunction(() => BUNG.multiplayer.active && BUNG.multiplayer.ui && !BUNG.loading,
        null, { polling: 150, timeout: 60000 });
      console.log(name, 'in city');
      return page;
    }
    const a = await open('Ring Runner');
    async function snap(page, kind, target) {
      await page.evaluate(({ kind, target }) => {
        const g = BUNG, z = g.zone;
        const [x, zp] = target;
        const y = z.groundAt(x, zp);
        g.camera.position.set(x, y + 2.15, zp);
        const [tx, tz] = kind === 'arena' ? [1434, 1306] : [150, 49];
        g.camera.lookAt(tx, z.groundAt(tx, tz) + (kind === 'arena' ? .9 : 3.6), tz);
        g.scene.updateMatrixWorld(true);
        window.gameDraw(g.scene, g.camera);
      }, { kind, target });
      await page.screenshot({ path: images + '/roomlife-' + kind + '.png' });
    }
    if (process.env.BASELINE) {
      await snap(a, 'shops-before', [139, 61]);
      return;
    }
    const shopChecks = await a.evaluate(() => {
      const z = BUNG.zone, signs = z.group.children.flatMap(m => m.userData.signs || []);
      return signs.filter(s => ['OSCAR WYLEE', 'REBAR JUICE', 'DR. MARTENS'].includes(s.shop[0]))
        .map(s => ({ name: s.shop[0], aboveGround: s.y - z.groundAt(s.x, s.z) }));
    });
    assert.equal(new Set(shopChecks.map(s => s.name)).size, 3);
    assert.ok(shopChecks.every(s => s.aboveGround > 2.4));
    await snap(a, 'shops-multiplayer', [139, 61]);
    await snap(a, 'shops-multiplayer-reverse', [146, 67]);
    const code = await a.evaluate(() => BUNG.multiplayer.room.code);
    const b = await open('Burger Rival', code);
    const actor = p => p.evaluate(() => BUNG.multiplayer.client.id);
    const idA = await actor(a), idB = await actor(b);
    const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { polling: 100, timeout: 16000 });
    const board = p => p.evaluate(() => { if (!BUNG.multiplayer.board) BUNG.multiplayer.openBoard(); });
    const button = (p, name) => p.getByRole('button', { name, exact: true }).click();
    const travel = (p, dest) => p.evaluate(async dest => {
      const g = BUNG, target = Array.isArray(dest) ? dest : [dest.x, dest.z];
      const [x, z] = target, start = g.player.pos.clone();
      const a = g.multiplayer.room.arena;
      const fighter = a.phase === 'playing' && a.players.includes(g.multiplayer.client.id);
      const n = Math.max(1, Math.ceil(Math.hypot(start.x - x, start.z - z) / (fighter ? 1.7 : 5)));
      for (let i = 1; i <= n; i++) {
        const px = start.x + (x - start.x) * i / n, pz = start.z + (z - start.z) * i / n;
        g.player.teleport(new THREE.Vector3(px, g.zone.groundAt(px, pz) + .08, pz));
        await new Promise(r => setTimeout(r, 150));
      }
    }, dest);
    const act = p => p.evaluate(() => BUNG.multiplayer.worldAction());
    const gates = await a.evaluate(() => activities.RING_GATES);
    await board(a);
    await button(a, 'START RING RUSH');
    await wait(a, id => BUNG.multiplayer.room.players[id].ring?.deadline, idA);
    for (let i = 0; i < gates.length; i++) {
      const q = gates[i];
      await travel(a, [q.x - q.nx * 2.4, q.z - q.nz * 2.4]);
      await travel(a, [q.x + q.nx * 2.4, q.z + q.nz * 2.4]);
      await wait(a, ([id, index]) => BUNG.multiplayer.room.players[id].ring.index === index, [idA, i + 1]);
      if (i === 2) {
        await a.evaluate(() => BUNG.multiplayer.client.ws.close(1000, 'Test reconnect'));
        await wait(a, () => !BUNG.multiplayer.client.connected);
        await wait(a, () => BUNG.multiplayer.client.connected);
      }
    }
    await wait(b, id => BUNG.multiplayer.room.players[id].score === 40, idA);
    console.log('Eight gates and reconnect passed');
    await wait(a, () => document.querySelector('#mp-wallet').textContent.includes('REBAR 24'));
    const points = await a.evaluate(() => ({ exchange: activities.EXCHANGE, steel: activities.PICKUPS[3],
      arena: activities.ARENA, docks: activities.ARENA_DOCK }));
    await travel(a, points.steel);
    await act(a);
    await wait(a, id => BUNG.multiplayer.room.players[id].rebar === 30, idA);
    await travel(a, points.exchange);
    await board(a);
    const paint = a.locator('.mp-exchange-item').filter({ hasText: 'River Mint Paint' });
    await paint.getByRole('button', { name: 'BUY · 10' }).click();
    await wait(b, id => BUNG.multiplayer.room.players[id].inventory.paint, idA);
    await wait(a, () => document.querySelector('#mp-wallet').textContent.includes('REBAR 20'));
    console.log('Personal rebar pickup and purchase passed');
    await a.setViewportSize({ width: 375, height: 667 });
    await button(a, 'BACK TO CITY');
    const boxes = await a.evaluate(() => ['#mp-wallet', '#hud-topleft', '.mp-topbar'].map(s => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [r.top, r.bottom, r.left, r.right];
    }));
    assert.ok(boxes[0][2] >= 0 && boxes[0][3] <= 375);
    assert.ok(boxes[1][1] <= boxes[2][0]);
    await a.setViewportSize({ width: 1280, height: 800 });
    for (const p of [a, b]) {
      await board(p);
      await button(p, 'QUEUE · 1V1');
      await button(p, 'READY UP');
    }
    await wait(a, () => BUNG.multiplayer.room.arena.phase === 'playing').catch(async error => {
      console.error('ARENA STATE', await a.evaluate(() => ({ arena: BUNG.multiplayer.room.arena,
        notice: document.querySelector('#mp-notice').textContent })));
      throw error;
    });
    console.log('Arena countdown completed');
    await travel(a, points.arena);
    await act(a);
    await wait(b, id => BUNG.multiplayer.room.arena.carrier === id, idA);
    await travel(b, points.arena);
    await act(b);
    await wait(a, id => BUNG.multiplayer.room.arena.carrier === id, idB);
    console.log('Arena tackle registered');
    for (let i = 0; i < 2; i++) {
      if (i) {
        await travel(b, points.arena);
        await act(b);
        await wait(a, id => BUNG.multiplayer.room.arena.carrier === id, idB);
      }
      await travel(b, points.docks[1]);
      await act(b);
      await wait(a, score => BUNG.multiplayer.room.arena.scores[1] === score, i + 1);
    }
    await wait(a, () => BUNG.multiplayer.room.arena.phase === 'finished');
    assert.equal(await b.evaluate(() => BUNG.multiplayer.room.players[BUNG.multiplayer.client.id].score), 25);
    await board(b);
    await button(b, 'WATCH FROM THE STANDS');
    await wait(b, () => Math.abs(BUNG.player.pos.z - 1292) < 2);
    await snap(b, 'arena', [1434, 1292]);
    await a.evaluate(async () => {
      await BUNG.multiplayer.leave();
      await BUNG.startGame(true, 'saga');
    });
    await snap(a, 'shops-campaign', [139, 61]);
    assert.deepEqual(errors, []);
    console.log('ROOM LIFE PASSED', { shopChecks, gates: gates.length, ringPoints: 40,
      walletAfterPurchase: 20, arenaScore: [0, 2], errors });
  } finally { await Promise.all(browsers.map(b => b.close())); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
