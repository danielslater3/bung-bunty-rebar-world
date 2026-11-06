// Isolated loaded-gameplay simulation. Long city travel is route-validated,
// then placed at its destination; short pickup routes use real player physics.
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
  page.on('pageerror', (e) => {errors.push(e.stack);console.log('PAGEERROR',e.stack);});
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/', { timeout: 60000 });
  await page.waitForFunction(() => !!window.BUNG).catch(async e=>{console.log('BOOT',await page.locator('body').innerText());throw e;});
  await page.evaluate(async () => {
    const { state: S, SaveSystem } = await import('/src/core/state.js');
    const { createSaga, CHAPTERS } = await import('/src/story/sagaData.js');
    window.S = S;
    window.Save = SaveSystem;
    S.saga = { ...createSaga(), chapter: 6, done: CHAPTERS.slice(0, 6).map((c) => c.id), companion: true };
    S.currentZone = 'brisbane';
    S.flags.trolleyUnlocked = true;
    S.coins = 1000;
    SaveSystem.save();
    await BUNG.startGame('keep', 'saga');
    window.draw = BUNG.renderer.render.bind(BUNG.renderer);
    BUNG.renderer.render = () => {};
    window.flush = () => {
      let n = 0;
      while (BUNG.dialogue.current && n++ < 60) {
        BUNG.input.pressed.KeyE = true;
        BUNG.dialogue.update(1 / 60);
      }
    };
    window.tick = () => {
      const g = BUNG;
      g.elapsed += 1 / 60;
      g._dt = 1 / 60;
      g.updatePlaying(1 / 60);
      g.saga.update(1 / 60);
      const line = g.saga.performanceLine();
      if (line) g.saga.framePerformance(1 / 60, line);
      else g.updateCamera(1 / 60);
      g.input.endFrame();
    };
    flush();
  });
  await page.evaluate(() => {
    for (let i = 0; i < 25; i++) tick();
    BUNG.saga.poseActors();
    const line = BUNG.saga.performanceLine();
    if (line) BUNG.saga.framePerformance(0.1, line);
    draw(BUNG.scene, BUNG.camera);
  });
  await page.screenshot({ path: '../browser-tests/pair78-performance.png' });
  const rap = await page.evaluate(async () => {
    let b = BUNG.saga.mission.battle;
    let retry = false,
      previous = b.time;
    for (let i = 0; i < 480; i++) {
      tick();
      if (b.time < previous) retry = true;
      previous = b.time;
    }
    let rounds = 0,
      frames = 0,
      reloaded = false;
    for (; frames < 3000 && S.saga.step === 1; frames++) {
      b = BUNG.saga.mission.battle;
      if (b.index < 8 && b.time + 1 / 60 >= b.due) BUNG.input.pressed.KeyF = true;
      tick();
      rounds = Math.max(rounds, b.round + 1);
      if (!reloaded && b.round === 1) {
        Save.save(BUNG);
        const bank = b.snapshot().total;
        await BUNG.startGame(false, 'saga');
        if (BUNG.saga.mission.battle.round !== 1 || BUNG.saga.mission.battle.total !== bank)
          throw Error('round checkpoint lost');
        reloaded = true;
      }
    }
    return {
      retry,
      rounds,
      frames,
      reloaded,
      step: S.saga.step,
      score: S.saga.rapScore,
      actorsVisible: BUNG.saga.actors.gabor.visible && BUNG.saga.actors.chung.visible,
    };
  });
  console.log('RAP', rap);
  assert.ok(rap.retry && rap.reloaded && rap.rounds === 3);
  assert.equal(rap.step, 2);
  assert.ok(rap.score > 2400);
  // Capture actual rendered celebration, then transition through the real menu.
  await page.evaluate(() => {
    flush();
    draw(BUNG.scene, BUNG.camera);
  });
  await page.screenshot({
    path: process.env.SHOT_PREFIX ? process.env.SHOT_PREFIX + '-rap.png' : '../browser-tests/pair78-rap.png',
  });
  assert.equal(await page.evaluate(() => S.saga.done.includes('ch7') && S.coins === 1200), true);
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.locator('#btn-next').click();
  await page.evaluate(() => flush());
  const walk = await page.evaluate(async () => {
    const { updateGuide, segmentClear } = await import('/src/story/guide.js');
    const g = BUNG,
      s = g.saga;
    g.menus.close();
    g.mode = 'playing';
    updateGuide(s);
    const nav = s.actors.guide.userData.controller;
    window.walkTo = (target) => {
      const currentNav = s.actors.guide.userData.controller || nav;
      const path = currentNav.plan({ ...g.player.pos }, target);
      let index = 1,
        frames = 0;
      for (; frames < 5000 && index < path.length; frames++) {
        const p = path[index],
          dx = p.x - g.player.pos.x,
          dz = p.z - g.player.pos.z;
        if (Math.hypot(dx, dz) < 0.3) {
          index++;
          continue;
        }
        g.camYaw = Math.atan2(dx, dz) + Math.PI;
        g.input.keys = { KeyW: true };
        g.input.pressed = {};
        if (frames % 10 === 0) {
          g.zone.update(1 / 60, g.elapsed);
          g.scene.updateMatrixWorld(true);
        }
        g.player.update(1 / 60);
      }
      g.input.keys = {};
      return { arrived: path.length > 1 && index === path.length, frames };
    };
    const it = g.zone.interactables.find((i) => i.id === 'phone'),
      phone = { x: it.pos.x, y: it.pos.y - 0.8, z: it.pos.z };
    const result = walkTo(phone);
    s.onStory('phone');
    flush();
    const route = nav.plan({ ...g.player.pos }, s.point('smash'));
    if (!route.length || route.slice(1).some((p, i) => !segmentClear(g.zone, route[i], p)))
      throw Error('house→mall route obstructed');
    g.player.teleport({ ...route.at(-1), y: route.at(-1).y + 0.1 });
    s.check(s.currentStep());
    s.ensureStep();
    return { ...result, cityRoute: route.length, step: S.saga.step, phone: S.saga.phone };
  });
  console.log('PHONE', walk);
  assert.ok(walk.arrived);
  assert.equal(walk.step, 3);
  const photo = await page.evaluate(() => {
    const s = BUNG.saga;
    for (let i = 0; i < 3; i++) {
      s.mission.t = 0.5;
      BUNG.input.pressed.KeyF = true;
      tick();
    }
    const retried = s.mission.tries === 0;
    s.mission.t = 0;
    BUNG.input.pressed.KeyF = true;
    tick();
    BUNG.dialogue.skip();
    for (let i = 0; i < 80; i++) {
      BUNG.elapsed += 1 / 60;
      s.frameDialogue(1 / 60);
    }
    draw(BUNG.scene, BUNG.camera);
    return {
      retried,
      evidence: S.saga.evidence,
      phone: S.saga.phone,
      step: S.saga.step,
      visiblePieces: s.actors.shards.filter((a) => a.visible).length,
    };
  });
  console.log('PHOTO', photo);
  assert.ok(photo.retried);
  assert.equal(photo.phone, 'broken');
  assert.ok(photo.evidence.includes('photo'));
  assert.equal(photo.visiblePieces, 3);
  await page.screenshot({
    path: process.env.SHOT_PREFIX
      ? process.env.SHOT_PREFIX + '-smash.png'
      : '../browser-tests/pair78-smash.png',
  });
  const shards = await page.evaluate(async () => {
    flush();
    const { shardPoints } = await import('/src/story/feud.js');
    const { segmentClear } = await import('/src/story/guide.js');
    const s = BUNG.saga,
      g = BUNG,
      points = shardPoints(s),
      walks = [];
    for (let i = 0; i < points.length; i++) {
      if (!segmentClear(g.zone, points[i], points[i])) throw Error('clue inside solid');
      const w = walkTo(points[i]);
      walks.push(w);
      s.update(1 / 60);
      if (i === 0) {
        Save.save(g);
        await g.startGame(false, 'saga');
        if (!S.saga.stepState.shards.s0) throw Error('secured shard lost on reload');
        for (let n = 0; n < 600; n++) s.update(1 / 60);
        if (!S.saga.stepState.shards.s0) throw Error('drone erased secured shard');
      }
    }
    return {
      walks,
      done: S.saga.done.includes('ch8'),
      phone: S.saga.phone,
      evidence: S.saga.evidence,
      coins: S.coins,
    };
  });
  console.log('SHARDS', shards);
  assert.ok(shards.walks.every((w) => w.arrived));
  assert.ok(shards.done);
  assert.equal(shards.phone, 'broken');
  assert.ok(shards.evidence.includes('photo') && shards.evidence.includes('shards'));
  assert.equal(shards.coins, 1240);
  await page.evaluate(async () => {
    await BUNG.startGame(false, 'saga');
  });
  const continuation = await page.evaluate(() => ({
    chapter: S.saga.chapter,
    evidence: S.saga.evidence,
    phone: S.saga.phone,
  }));
  console.log('NEXT', continuation);
  assert.equal(continuation.chapter, 8);
  assert.ok(continuation.evidence.includes('shards'));
  assert.deepEqual(errors, []);
  console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
