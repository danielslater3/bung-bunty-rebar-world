// Load through the real dashboard, then exercise movement and camera recovery.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !new URL(r.url()).pathname.endsWith('/favicon.ico'))
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
  await page.waitForFunction(() => !!window.BUNG);
  await page.evaluate(async () => {
    const { state: S, SaveSystem } = await import('/src/core/state.js');
    const { CHAPTERS, createSaga } = await import('/src/story/sagaData.js');
    window.testState = S;
    S.saga = {
      ...createSaga(),
      chapter: 9,
      step: 2,
      done: CHAPTERS.slice(0, 9).map((c) => c.id),
      companion: true,
    };
    S.currentZone = 'brisbane';
    S.flags.trolleyUnlocked = true;
    S.places = { brisbane: { x: -820, y: 7, z: 900 } };
    SaveSystem.save();
    BUNG.renderer.render = () => {};
    // The old chapter must not leave photo mode or a tilted pose behind.
    BUNG.photo = true;
    BUNG.player.mesh.rotation.x = 1;
  });
  const results = [];
  for (const chapter of [4, 0, 2, 5, 1, 3, 6, 7, 8, 9]) {
    await page.evaluate(() => BUNG.menus.showChapters());
    await page.locator(`[data-chapter="${chapter}"]`).click();
    await page.locator('#chapter-play').click();
    try {
      await page.waitForFunction(
        (n) =>
          !BUNG.loading &&
          testState._replay?.chapter === n &&
          BUNG.saga.dressed &&
          BUNG.zone?.name === 'brisbane' &&
          !!BUNG.dialogue.current?.cinematic,
        chapter,
        { timeout: 60000 },
      );
    } catch (e) {
      console.log(
        'FAILED LOAD',
        chapter,
        errors,
        await page.evaluate(() => ({
          loading: BUNG.loading,
          mode: BUNG.mode,
          zone: BUNG.zone?.name,
          dressed: BUNG.saga.dressed,
          dialogue: BUNG.dialogue.current,
          scene: BUNG.saga.scenePlaying,
          step: BUNG.saga.currentStep(),
          boot: document.getElementById('boot-error')?.textContent,
          body: document.body.innerText.slice(-1500),
        })),
      );
      throw e;
    }
    const entry = await page.evaluate(() => ({
      cameraGap: BUNG.camPos.distanceTo(BUNG.player.pos),
      cameraAbove: BUNG.camPos.y >= BUNG.player.pos.y - 0.2,
      photo: BUNG.photo,
    }));
    assert.ok(entry.cameraGap < 12, `chapter ${chapter + 1}: camera lost Bung`);
    assert.equal(entry.cameraAbove, true);
    assert.equal(entry.photo, false);
    await page.evaluate(() => {
      let n = 0;
      while (BUNG.dialogue.current && n++ < 100) BUNG.dialogue.skip();
    });
    let moved = 0;
    // Chapter 7 intentionally freezes movement for its rhythm minigame.
    if (chapter !== 6) {
      for (const key of ['w', 'a', 's', 'd']) {
        const before = await page.evaluate(() => ({ ...BUNG.player.pos }));
        await page.keyboard.down(key);
        await page.evaluate(() => {
          const g = BUNG;
          for (let i = 0; i < 25; i++) {
            g.updatePlaying(1 / 60);
            g.saga.update(1 / 60);
            g.updateCamera(1 / 60);
            g.input.endFrame();
          }
        });
        await page.keyboard.up(key);
        const after = await page.evaluate(() => ({ ...BUNG.player.pos }));
        moved = Math.max(moved, Math.hypot(after.x - before.x, after.z - before.z));
      }
      assert.ok(moved > 0.1, `chapter ${chapter + 1}: Bung cannot move`);
      const status = await page.evaluate(() => ({
        mode: BUNG.mode,
        enabled: BUNG.input.enabled,
        freeze: BUNG.saga.freeze,
        dialogue: BUNG.dialogue.current?.speaker,
        cinematic: BUNG.dialogue.cinematic,
        photo: BUNG.photo,
        menu: BUNG.menus.isOpen,
        loading: BUNG.loading,
        on: BUNG.saga.on,
        zone: BUNG.zone.name,
        scene: BUNG.saga.scenePlaying,
        step: BUNG.saga.currentStep()?.id,
      }));
      console.log('CONTROL', chapter + 1, moved, status);
      assert.ok(
        status.mode === 'playing' && status.enabled && (!status.freeze || status.cinematic),
        `chapter ${chapter + 1}: controls stuck ${JSON.stringify(status)}`,
      );
    }
    results.push({ chapter: chapter + 1, ...entry, moved });
    await page.evaluate(() => {
      BUNG.pauseForMenu();
      BUNG.menus.showPause();
    });
    await page.locator('#btn-chapters').click();
    await page.locator('#btn-back').click();
    assert.equal(await page.locator('#btn-resume').count(), 1);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
