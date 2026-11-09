const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
    await page.waitForFunction(() => !!window.BUNG, null, { polling: 150, timeout: 60000 });
    await page.evaluate(endpoint => {
      sessionStorage.setItem('bung-room-server', endpoint);
      BUNG.renderer.render = () => {};
    }, process.env.ROOM_SERVER || 'http://127.0.0.1:8795');
    await page.locator('#btn-multiplayer').click();
    await page.getByLabel('Your player name').fill('Room Board QA');
    await page.getByRole('button', { name: 'CREATE A ROOM', exact: true }).click();
    await page.waitForFunction(() => BUNG.multiplayer.active && BUNG.multiplayer.ui && !BUNG.loading,
      null, { polling: 150, timeout: 60000 });
    await page.keyboard.press('KeyB');
    const dialog = page.getByRole('dialog', { name: 'Bung Social Club' });
    const tab = name => dialog.getByRole('tab', { name, exact: true });
    const panel = dialog.getByRole('tabpanel');
    assert.equal(await tab('Explore').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowRight');
    assert.equal(await tab('Arena').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await tab('Players').getAttribute('aria-selected'), 'true');
    const headings = {
      Explore: 'RING RUSH', Arena: 'BURGER HEIST', Exchange: 'BUNG’S REBAR EXCHANGE',
      Expedition: 'THE GREAT BRISBANE REBAR RESCUE', Minigames: 'TEN TABLES. ZERO SENSIBLE IDEAS.',
      Players: 'ROOM LEADERBOARD',
    };
    for (const [width, height] of [[1280, 800], [760, 620], [390, 844], [375, 667], [667, 375]]) {
      await page.setViewportSize({ width, height });
      for (const [name, heading] of Object.entries(headings)) {
        await tab(name).click();
        assert.equal(await panel.getByRole('heading', { name: heading, exact: true }).count(), 1);
        for (const other of Object.values(headings).filter(h => h !== heading))
          assert.equal(await panel.getByRole('heading', { name: other, exact: true }).count(), 0);
        const box = await dialog.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1,
          JSON.stringify({ width, height, name, box }));
        const overflow = await panel.evaluate(el => el.scrollWidth > el.clientWidth + 1);
        assert.equal(overflow, false, name);
        if (name === 'Minigames') assert.equal(await panel.locator('.mp-game-choice').count(), 10);
      }
      if (width === 1280 || width === 375) {
        await tab(width === 1280 ? 'Explore' : 'Exchange').click();
        await page.screenshot({ path: `../browser-tests/room-board-${width}.png` });
      }
    }
    await tab('Minigames').click();
    const lastGame = panel.locator('.mp-game-choice').last();
    await lastGame.focus();
    const tabRect = await tab('Minigames').boundingBox();
    const priorScroll = await panel.evaluate(el => el.scrollTop);
    assert.ok(priorScroll > 0);
    await page.evaluate(() => BUNG.multiplayer.refreshUI());
    assert.deepEqual(await tab('Minigames').boundingBox(), tabRect);
    assert.equal(await panel.evaluate(el => el.scrollTop), priorScroll);
    assert.ok(await lastGame.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    await page.keyboard.press('KeyB');
    assert.equal(await tab('Minigames').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyE');
    assert.equal(await tab('Exchange').getAttribute('aria-selected'), 'true');
    assert.deepEqual(errors, []);
    console.log('ROOM BOARD PASSED · six tabs, five viewport sizes, keyboard and direct Exchange');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
