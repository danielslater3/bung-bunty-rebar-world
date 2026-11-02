// Isolated browser profile; never touches a player's normal browser save.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
  await page.waitForFunction(() => !!window.BUNG);
  await page.locator('#btn-chapters').click();
  assert.equal(await page.locator('[data-chapter]:disabled').count(), 24);
  assert.equal(await page.locator('#chapter-play').isDisabled(), true);
  await page.locator('#btn-back').click();
  await page.evaluate(async () => {
    const { state: S, SaveSystem } = await import('/src/core/state.js');
    const { CHAPTERS, createSaga } = await import('/src/story/sagaData.js');
    window.testState = S;
    S.saga = {
      ...createSaga(),
      chapter: 7,
      step: 2,
      done: CHAPTERS.slice(0, 7).map((c) => c.id),
      companion: true,
      phone: 'blue',
    };
    S.coins = 98765;
    S.currentZone = 'brisbane';
    S.places = { brisbane: { x: -820, y: 6.77, z: 900, facing: 0, camYaw: 0, camPitch: 0.2 } };
    S.flags.trolleyUnlocked = true;
    SaveSystem.save();
    window.original = JSON.stringify(SaveSystem.peek());
    BUNG.menus.showMain();
  });
  await page.locator('#btn-chapters').click();
  assert.equal(await page.locator('[data-chapter]:not(:disabled)').count(), 8);
  await page.locator('[data-filter="complete"]').click();
  assert.equal(await page.locator('[data-chapter]').count(), 7);
  await page.locator('[data-filter="all"]').click();
  await page.screenshot({ path: process.env.SHOT_PATH || '../browser-tests/chapter-dashboard.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[data-chapter="0"]').click();
  await page.locator('#chapter-play').click();
  await page.evaluate(async () => {
    window.testState = (await import('/src/core/state.js')).state;
  });
  await page.waitForFunction(
    () => {
      const S = window.testState;
      return (
        !BUNG.loading && S._replay?.chapter === 0 && BUNG.saga?.dressed && BUNG.zone?.name === 'brisbane'
      );
    },
    undefined,
    { timeout: 60000 },
  );
  const first = await page.evaluate(async () => {
    const { state: S, SaveSystem } = await import('/src/core/state.js');
    SaveSystem.save(BUNG);
    return {
      same: JSON.stringify(SaveSystem.peek()) === original,
      chapter: S.saga.chapter,
      replay: !!SaveSystem.peekReplay(),
      bigBoy: S.saga.bigBoy,
      mansion: S.saga.mansion,
    };
  });
  assert.equal(first.same, true);
  assert.equal(first.chapter, 0);
  assert.equal(first.replay, true);
  assert.equal(first.bigBoy, false);
  assert.equal(first.mansion, false);
  await page.reload();
  await page.waitForFunction(() => !!window.BUNG);
  await page.locator('#btn-replay').click();
  await page.evaluate(async () => {
    window.testState = (await import('/src/core/state.js')).state;
  });
  await page.waitForFunction(
    () => {
      const S = window.testState;
      return !BUNG.loading && S._replay?.chapter === 0 && BUNG.saga?.dressed;
    },
    undefined,
    { timeout: 60000 },
  );
  await page.evaluate(() => {
    BUNG.dialogue.clear();
    BUNG.mode = 'playing';
    BUNG.pauseForMenu();
    BUNG.menus.showPause();
  });
  await page.locator('#btn-campaign').click();
  await page.evaluate(async () => {
    window.testState = (await import('/src/core/state.js')).state;
  });
  await page.waitForFunction(
    () => {
      const S = window.testState;
      return !BUNG.loading && !S._replay && S.saga?.chapter === 7 && BUNG.saga?.dressed;
    },
    undefined,
    { timeout: 60000 },
  );
  const restored = await page.evaluate(async () => {
    const { state: S } = await import('/src/core/state.js');
    return { chapter: S.saga.chapter, step: S.saga.step, coins: S.coins };
  });
  assert.deepEqual(restored, { chapter: 7, step: 2, coins: 98765 });
  await page.evaluate(async () => {
    const { state: S, SaveSystem } = await import('/src/core/state.js');
    const { CHAPTERS, createSaga } = await import('/src/story/sagaData.js');
    const { chapterReplay, awardChapter } = await import('/src/story/progression.js');
    SaveSystem.beginReplay(chapterReplay(SaveSystem.peek(), 0, CHAPTERS, createSaga));
    S.saga.step = CHAPTERS[0].steps.length;
    awardChapter(S, CHAPTERS[0]);
    SaveSystem.save();
    await BUNG.startGame('replay', 'saga');
  });
  assert.equal(await page.locator('#replay-campaign').count(), 1);
  assert.equal(
    await page.evaluate(async () => {
      const { state: S, SaveSystem } = await import('/src/core/state.js');
      return S.saga.chapter === 0 && S.saga.intermission && SaveSystem.peek().coins === 98765;
    }),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ first, restored, errors }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
