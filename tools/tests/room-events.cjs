const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const errors = [];
    async function boot(name, trolley, code) {
      const context = await browser.newContext({ viewport: { width: 1210, height: 800 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
      await page.waitForFunction(() => !!window.BUNG, null, { polling: 150, timeout: 60000 });
      await page.evaluate(endpoint => {
        sessionStorage.setItem('bung-room-server', endpoint);
        window.drawRoom = BUNG.renderer.render.bind(BUNG.renderer);
        BUNG.renderer.render = () => {};
      }, process.env.ROOM_SERVER || 'http://127.0.0.1:8796');
      await page.locator('#btn-multiplayer').click();
      await page.getByLabel('Your player name').fill(name);
      const select = page.getByLabel('Trolley edition');
      assert.equal(await select.locator('option').count(), 10);
      await select.selectOption(trolley);
      if (code) await page.getByLabel('Eight-character room code').fill(code);
      await page.getByRole('button', { name: code ? 'JOIN YOUR MATES' : 'CREATE A ROOM', exact: true }).click();
      await page.waitForFunction(() => BUNG.multiplayer.active && BUNG.multiplayer.ui && !BUNG.loading,
        null, { polling: 150, timeout: 60000 });
      return page;
    }
    const a = await boot('Captain', 'concrete');
    const code = await a.evaluate(() => BUNG.multiplayer.room.code);
    const b = await boot('Crew', 'emerald', code);
    await a.waitForFunction(() => [...BUNG.multiplayer.peers.values()][0]?.trolleyId === 'emerald');
    assert.equal(await a.evaluate(() => BUNG.trolley.mesh.userData.fleetId), 'concrete');
    const notice = b.getByRole('region', { name: 'Room activity invitation' });
    await a.evaluate(() => BUNG.multiplayer.openBoard('explore'));
    await a.getByRole('button', { name: 'START RING RUSH', exact: true }).click();
    await notice.getByText('Ring Rush', { exact: true }).waitFor();
    assert.ok(await b.evaluate(() => BUNG.multiplayer.room.players[BUNG.multiplayer.client.id].ring?.event));
    await notice.getByRole('button', { name: 'SKIP', exact: true }).click();
    await b.waitForFunction(() => !BUNG.multiplayer.room.players[BUNG.multiplayer.client.id].ring);
    await a.evaluate(() => BUNG.multiplayer.openBoard('explore'));
    await a.getByRole('button', { name: 'START ROOM REBAR HUNT', exact: true }).click();
    await notice.getByText('Rebar Hunt', { exact: true }).waitFor();
    await notice.getByRole('button', { name: 'JOIN', exact: true }).click();
    await b.waitForFunction(() => Number.isFinite(BUNG.multiplayer.room.events?.hunt?.entries[BUNG.multiplayer.client.id]));
    await a.evaluate(() => {
      const g = BUNG;
      const pickup = g.multiplayer.loot.find(entry => entry.item.id === 'hall-stamp').item;
      g.player.pos.set(pickup.x, pickup.y, pickup.z);
    });
    await b.waitForFunction(() => !!BUNG.multiplayer.room.events.hunt.found['hall-stamp']);

    await a.evaluate(() => { BUNG.multiplayer.hidePanels(); BUNG.multiplayer.mini.open('tictactoe'); });
    await a.getByRole('button', { name: 'OPEN THIS TABLE', exact: true }).click();
    await notice.getByText('Rebars & Burgers', { exact: true }).waitFor();
    await notice.getByRole('button', { name: 'JOIN TABLE', exact: true }).click();
    await a.getByRole('button', { name: 'I’M READY', exact: true }).click();
    await b.getByRole('button', { name: 'I’M READY', exact: true }).click();
    await a.getByRole('button', { name: 'START MATCH', exact: true }).click();
    await a.waitForFunction(() => BUNG.multiplayer.room.games.tictactoe.status === 'playing');
    for (const [page, index] of [[a,0], [b,3], [a,1], [b,4], [a,2]]) {
      await page.getByRole('button', { name: 'Square ' + (index + 1), exact: true }).click();
      await b.waitForFunction(i => !!BUNG.multiplayer.room.games.tictactoe.board[i], index);
    }
    await b.waitForFunction(() => BUNG.multiplayer.room.games.tictactoe.status === 'finished');
    await b.evaluate(() => BUNG.multiplayer.hidePanels());

    const roads = await a.evaluate(async () => {
      const { RACE_COURSES } = await import('/src/multiplayer/raceCourses.js');
      const { segmentClear } = await import('/src/story/guide.js');
      const z = BUNG.zone;
      return RACE_COURSES.map(course => ({
        id: course.id,
        bad: course.path.slice(1).flatMap((p, i) => {
          const q = course.path[i];
          return segmentClear(z, p, q, .7) ? [] : [[p, q]];
        }),
      }));
    });
    console.log('COURSE GEOMETRY', JSON.stringify(roads.map(r => ({ id: r.id, count: r.bad.length, example: r.bad[0] }))));
    assert.ok(roads.every(course => course.bad.length === 0));
    await a.evaluate(() => BUNG.multiplayer.openBoard('races'));
    await a.getByRole('button', { name: /South Bank Shuffle/ }).click();
    await notice.getByText('South Bank Shuffle', { exact: true }).waitFor();
    await notice.getByRole('button', { name: 'JOIN RACE', exact: true }).click();
    for (const page of [a,b])
      await page.waitForFunction(() => BUNG.multiplayer.raceEntry() && BUNG.trolley.riding,
        null, { polling: 150, timeout: 30000 });
    await a.waitForFunction(() => !BUNG.multiplayer.raceCountdown());
    await a.keyboard.down('KeyW');
    await a.waitForFunction(() => BUNG.multiplayer.raceEntry()?.index > 0, null, { timeout: 7000 })
      .finally(() => a.keyboard.up('KeyW'));
    await b.waitForFunction(() => Object.values(BUNG.multiplayer.room.events.race.entries).some(e => e.index > 0));
    await a.evaluate(() => BUNG.multiplayer.openBoard('races'));
    await a.getByRole('button', { name: 'RESET TO LAST GATE · +5s', exact: true }).click();
    await b.waitForFunction(() => Object.values(BUNG.multiplayer.room.events.race.entries).some(e => e.penalty === 5000));
    assert.deepEqual(errors, []);
    console.log('ROOM EVENTS PASSED', code);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
