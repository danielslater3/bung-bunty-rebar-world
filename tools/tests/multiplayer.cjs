const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: [
        '--enable-webgl',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    }),
    errors = [];
  try {
    const context = await browser.newContext({
        viewport: { width: 1365, height: 900 },
      }),
      a = await context.newPage();
    async function boot(page, name) {
      page.on('pageerror', (e) => errors.push(e.stack));
      await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
      await page.waitForFunction(() => !!window.BUNG);
      await page.evaluate(async (endpoint) => {
        const { state, DEFAULT_STATE, SaveSystem } =
          await import('/src/core/state.js');
        Object.assign(state, DEFAULT_STATE());
        state.coins = 777;
        SaveSystem.save();
        window.campaign = localStorage.getItem(
          'bung-bunty-rebar-world-save-v1',
        );
        sessionStorage.setItem('bung-room-server', endpoint);
        window.mpDraw = BUNG.renderer.render.bind(BUNG.renderer);
        BUNG.renderer.render = () => {};
      }, process.env.ROOM_SERVER || 'http://127.0.0.1:8795');
      await page.locator('#btn-multiplayer').click();
      await page.getByLabel('Your player name').fill(name);
    }
    await boot(a, 'Captain Bung');
    await a.getByLabel('Your character', { exact: true }).selectOption('gabor');
    await a.getByLabel('Top / shell colour', { exact: true }).fill('#e84393');
    await a
      .getByLabel('Bottoms / panels colour', { exact: true })
      .fill('#234567');
    await a.screenshot({
      path: '../browser-tests/multiplayer-character-picker.png',
    });
    await a.getByRole('button', { name: 'CREATE A ROOM', exact: true }).click();
    await a
      .waitForFunction(
        () => BUNG.multiplayer.active && !!BUNG.multiplayer.ui && !BUNG.loading,
        null,
        { timeout: 60000 },
      )
      .catch(async (e) => {
        console.log('FAILED', errors, await a.locator('body').innerText());
        throw e;
      });
    const code = await a.evaluate(() => BUNG.multiplayer.room.code);
    console.log('ROOM', code);
    const bcontext = await browser.newContext({
        viewport: { width: 1365, height: 900 },
      }),
      b = await bcontext.newPage();
    await boot(b, 'Burger Mate');
    await b.getByLabel('Your character', { exact: true }).selectOption('ching');
    await b.getByLabel('Top / shell colour', { exact: true }).fill('#22aa77');
    await b.getByLabel('Eight-character room code').fill(code);
    await b
      .getByRole('button', { name: 'JOIN YOUR MATES', exact: true })
      .click();
    await b
      .waitForFunction(
        () => BUNG.multiplayer.active && !!BUNG.multiplayer.ui && !BUNG.loading,
        null,
        { timeout: 60000 },
      )
      .catch(async (e) => {
        console.log('FAILED B', errors, await b.locator('body').innerText());
        throw e;
      });
    await a.waitForFunction(() => BUNG.multiplayer.peers.size === 1);
    const outfits = await a.evaluate(() => {
      const m = BUNG.multiplayer;
      return {
        self: m.selfAvatar.userData.appearance,
        remote: [...m.peers.values()][0].mesh.userData.appearance,
      };
    });
    assert.equal(outfits.self.character, 'gabor');
    assert.equal(outfits.self.colors[0], '#e84393');
    assert.equal(outfits.remote.character, 'ching');
    assert.equal(outfits.remote.colors[0], '#22aa77');
    await a.evaluate(() => {
      const g = BUNG;
      g.multiplayer.hidePanels();
      g.camera.position.set(
        g.player.pos.x + 6,
        g.player.pos.y + 4,
        g.player.pos.z + 7,
      );
      g.camera.lookAt(g.player.pos.x + 1, g.player.pos.y + 1, g.player.pos.z);
      g.scene.updateMatrixWorld(true);
      window.mpDraw(g.scene, g.camera);
    });
    await a.screenshot({
      path: '../browser-tests/multiplayer-city-characters.png',
    });
    await b.evaluate(() => BUNG.multiplayer.openChat());
    await b
      .getByLabel('Message to the room')
      .fill('OIII! <img src=x onerror=alert(1)>');
    await b.getByRole('button', { name: 'SEND', exact: true }).click();
    await a.waitForFunction(() =>
      document.getElementById('mp-chat-history').textContent.includes('OIII!'),
    );
    assert.equal(await a.locator('#mp-chat-history img').count(), 0);
    await a.evaluate(() => BUNG.multiplayer.openBoard());
    await b.evaluate(() => BUNG.multiplayer.hidePanels());
    await a.screenshot({ path: '../browser-tests/multiplayer-room.png' });
    const checks = await a.evaluate(async () => {
      const g = BUNG,
        mp = g.multiplayer,
        { segmentClear } = await import('/src/story/guide.js'),
        { QUEST_STAGES, RALLY } = await import('/src/multiplayer/catalog.js');
      let valid = 0;
      let from = { ...g.player.pos };
      for (const [x, z] of [
        ...QUEST_STAGES.flatMap((s) => s.points),
        ...RALLY.map((p) => [p.x, p.z]),
      ]) {
        const p = { x, z, y: g.zone.groundAt(x, z) };
        const route = mp.navigation.plan(from, p);
        if (
          !route.length ||
          route.slice(1).some((q, i) => !segmentClear(g.zone, route[i], q))
        )
          throw Error('Inaccessible multiplayer anchor ' + x + ',' + z);
        from = p;
        valid++;
      }
      const leg = mp.peers.values().next().value.mesh.userData.parts.legL;
      if (!leg.isObject3D) throw Error('Avatar rig clone lost');
      return {
        routes: valid,
        roomPlayers: Object.keys(mp.room.players).length,
        saveSafe:
          localStorage.getItem('bung-bunty-rebar-world-save-v1') === campaign,
      };
    });
    console.log('CITY', checks);
    assert.ok(checks.saveSafe);
    await a.evaluate(() => {
      BUNG.multiplayer.hidePanels();
      BUNG.multiplayer.client.command('joinGame', { game: 'tictactoe' });
    });
    await a.waitForFunction(() => !!BUNG.multiplayer.room.games.tictactoe);
    await b.evaluate(() => {
      BUNG.multiplayer.hidePanels();
      BUNG.multiplayer.client.command('joinGame', { game: 'tictactoe' });
    });
    await a.waitForFunction(
      () => BUNG.multiplayer.room.games.tictactoe?.players.length === 2,
    );
    for (const p of [a, b])
      await p.evaluate(() =>
        BUNG.multiplayer.client.command('ready', { game: 'tictactoe' }),
      );
    await a.waitForFunction(
      () =>
        BUNG.multiplayer.room.games.tictactoe?.players.length === 2 &&
        Object.values(BUNG.multiplayer.room.games.tictactoe.ready).every(
          Boolean,
        ),
    );
    await a.evaluate(() => {
      BUNG.multiplayer.client.command('startGame', { game: 'tictactoe' });
      BUNG.multiplayer.mini.open('tictactoe');
    });
    await a.waitForFunction(
      () => BUNG.multiplayer.room.games.tictactoe.status === 'playing',
    );
    await b.evaluate(() => BUNG.multiplayer.mini.open('tictactoe'));
    for (const [p, cell] of [
      [a, 0],
      [b, 3],
      [a, 1],
      [b, 4],
      [a, 2],
    ]) {
      await p.locator('.mp-tile').nth(cell).click();
      await a.waitForFunction(
        (i) => !!BUNG.multiplayer.room.games.tictactoe.board[i],
        cell,
      );
    }
    await b.waitForFunction(
      () => BUNG.multiplayer.room.games.tictactoe.status === 'finished',
    );
    assert.ok(
      (await b.locator('.mp-result').innerText()).includes('Captain Bung'),
    );
    await b.screenshot({ path: '../browser-tests/multiplayer-tictactoe.png' });
    const movement = await b.evaluate(() => {
      const g = BUNG;
      g.multiplayer.hidePanels();
      const old = g.player.pos.clone();
      g.camYaw = 0;
      g.input.keys.KeyW = true;
      for (let i = 0; i < 30; i++) {
        g.multiplayer.frame(1 / 60);
        g.input.endFrame();
      }
      g.input.keys = {};
      return old.distanceTo(g.player.pos);
    });
    assert.ok(movement > 1);
    await b.evaluate(() => BUNG.multiplayer.openChat());
    await b.keyboard.type('hello with spaces');
    assert.equal(
      await b.getByLabel('Message to the room').inputValue(),
      'hello with spaces',
    );
    await b.keyboard.press('Escape');
    assert.equal(await b.evaluate(() => BUNG.multiplayer.focus), false);
    // Every shipped minigame must render its real two-player playing state.
    const gameIds = await a.evaluate(async () =>
      (await import('/src/multiplayer/catalog.js')).GAMES.map((g) => g.id),
    );
    for (const id of gameIds.filter((id) => id !== 'tictactoe')) {
      await a.evaluate((id) => {
        BUNG.multiplayer.hidePanels();
        BUNG.multiplayer.client.command('joinGame', { game: id });
      }, id);
      await a.waitForFunction((id) => !!BUNG.multiplayer.room.games[id], id);
      await b.evaluate((id) => {
        BUNG.multiplayer.hidePanels();
        BUNG.multiplayer.client.command('joinGame', { game: id });
      }, id);
      await a.waitForFunction(
        (id) => BUNG.multiplayer.room.games[id]?.players.length === 2,
        id,
      );
      for (const p of [a, b])
        await p.evaluate(
          (id) => BUNG.multiplayer.client.command('ready', { game: id }),
          id,
        );
      await a.waitForFunction(
        (id) =>
          Object.values(BUNG.multiplayer.room.games[id].ready).every(Boolean),
        id,
      );
      await a.evaluate(
        (id) => BUNG.multiplayer.client.command('startGame', { game: id }),
        id,
      );
      await b.waitForFunction(
        (id) => BUNG.multiplayer.room.games[id]?.status === 'playing',
        id,
      );
      await b.evaluate((id) => BUNG.multiplayer.mini.open(id), id);
      assert.ok(await b.locator('.mp-game-card').isVisible(), id + ' UI');
      console.log('GAME UI', id);
      await b
        .getByRole('button', { name: 'LEAVE MATCH', exact: true })
        .click({ timeout: 6000 })
        .catch(async (e) => {
          console.log(
            'UNSTABLE',
            id,
            await b.evaluate(async () => {
              const frames = [];
              for (let i = 0; i < 12; i++) {
                const button = [...document.querySelectorAll('button')].find(
                  (e) => e.textContent === 'LEAVE MATCH',
                );
                frames.push({
                  rect: button?.getBoundingClientRect().toJSON(),
                  scroll: document.querySelector('.mp-game-card')?.scrollTop,
                });
                await new Promise(requestAnimationFrame);
              }
              return frames;
            }),
          );
          await b.screenshot({
            path: '../browser-tests/multiplayer-ui-failure.png',
          });
          throw e;
        });
      await a.waitForFunction(
        (id) => BUNG.multiplayer.room.games[id]?.status === 'finished',
        id,
      );
    }
    const identity = await b.evaluate(() => BUNG.multiplayer.client.id);
    await b.evaluate(
      () =>
        new Promise((resolve) => {
          const ws = BUNG.multiplayer.client.ws;
          ws.addEventListener('close', () => resolve(), { once: true });
          ws.close();
        }),
    );
    await b.waitForFunction(() => BUNG.multiplayer.client.connected);
    assert.equal(await b.evaluate(() => BUNG.multiplayer.client.id), identity);
    assert.equal(
      await b.evaluate(
        () => BUNG.multiplayer.selfAvatar.userData.appearance.character,
      ),
      'ching',
    );
    console.log('ALL TEN GAME INTERFACES + RECONNECT PASSED');
    await b.evaluate(() => BUNG.multiplayer.leave());
    await b.waitForFunction(
      () =>
        !BUNG.multiplayer.active &&
        !!document.getElementById('btn-multiplayer'),
    );
    assert.equal(
      await b.evaluate(
        () =>
          localStorage.getItem('bung-bunty-rebar-world-save-v1') === campaign,
      ),
      true,
    );
    await b.locator('#btn-multiplayer').click();
    assert.equal(
      await b.getByLabel('Your character', { exact: true }).inputValue(),
      'ching',
    );
    assert.equal(
      await b.getByLabel('Top / shell colour', { exact: true }).inputValue(),
      '#22aa77',
    );
    assert.equal(
      await b.getByLabel('Your player name').inputValue(),
      'Burger Mate',
    );
    await b
      .getByRole('button', { name: 'BACK TO THE SAGA', exact: true })
      .click();
    assert.deepEqual(errors, []);
    console.log('MULTIPLAYER BROWSER PASSED', { code, movement, errors });
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
