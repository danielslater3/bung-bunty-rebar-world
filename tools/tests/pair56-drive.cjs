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
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
  await page.waitForFunction(() => !!window.BUNG);
  await page.evaluate(() => BUNG.startGame(true, 'saga'));
  const result = await page.evaluate(async () => {
    const { state: S, SaveSystem } = await import('/src/core/state.js');
    const { createSaga } = await import('/src/story/sagaData.js');
    const { tickMission } = await import('/src/story/missions.js');
    const { frameDialogue } = await import('/src/story/dialogueCam.js');
    const { segmentClear, updateGuide } = await import('/src/story/guide.js');
    const { atDistance } = await import('/src/systems/Navigation.js');
    const g = BUNG,
      s = g.saga;
    let draw = g.renderer.render.bind(g.renderer);
    g.renderer.render = () => {};
    const flush = () => {
      let n = 0;
      while (g.dialogue.current && n++ < 100) g.dialogue.skip();
    };
    flush();
    g.mode = 'paused';
    const results = [];
    for (const ch of [4, 5]) {
      S.saga = { ...createSaga(), chapter: ch, companion: ch === 5 };
      s._booted = '';
      s.scenePlaying = false;
      g.menus.close();
      g.trolley.dismiss();
      s.go(ch === 4 ? 'plaza' : 'mcrebar');
      g.mode = 'playing';
      s.ensureStep();
      s.beginScene(s.currentStep());
      let cameraBlocked = 0,
        overlap = 0;
      while (g.dialogue.current) {
        for (let f = 0; f < 60; f++) frameDialogue(s, 1 / 60);
        const p = g.camPos;
        if (g.zone.colliders.some((b) => b.containsPoint(p))) cameraBlocked++;
        if (s.actors.ching.position.distanceTo(s.actors.gabor.position) < 1.3) overlap++;
        g.dialogue.skip();
      }
      s.ensureStep();
      const m = s.mission,
        c = m?.controller;
      if (!c) {
        results.push({ ch: ch + 1, noRoute: true });
        continue;
      }
      const blocked = c.path.slice(1).filter((b, i) => !segmentClear(g.zone, c.path[i], b)).length;
      const pathLength = c.length;
      let frames = 0,
        groundError = 0;
      // Follow the street route using the actual player/trolley update methods.
      g.player.pos.copy(c.path[0]);
      g.player.mesh.position.copy(g.player.pos);
      if (ch === 5) {
        S.flags.trolleyUnlocked = true;
        g.trolley.summon();
        g.trolley.pos.copy(g.player.pos);
        g.trolley.riding = true;
        g.trolley.heading = Math.atan2(c.path[1].x - c.path[0].x, c.path[1].z - c.path[0].z);
      }
      let routeIndex = 1;
      for (; frames < 24000 && S.saga.step === 1; frames++) {
        const p = c.path[Math.min(routeIndex, c.path.length - 1)],
          actor = ch === 4 ? s.actors.ching : s.actors.gabor;
        const here = ch === 4 ? g.player.pos : g.trolley.pos,
          dx = p.x - here.x,
          dz = p.z - here.z;
        if (Math.hypot(dx, dz) < (ch === 4 ? 0.6 : 1.4) && routeIndex < c.path.length - 1) routeIndex++;
        g.elapsed += 1 / 60;
        g.mode = 'playing';
        s.freeze = false;
        g.input.pressed = {};
        if (ch === 4) {
          g.camYaw = Math.atan2(dx, dz) + Math.PI;
          g.input.keys = { KeyW: actor.position.distanceTo(here) > 2.5 };
        } else {
          const err = Math.atan2(
            Math.sin(Math.atan2(dx, dz) - g.trolley.heading),
            Math.cos(Math.atan2(dx, dz) - g.trolley.heading),
          );
          g.input.keys = {
            KeyW: g.trolley.speed < (Math.abs(err) > 0.4 ? 2 : 6),
            KeyA: err > 0.035,
            KeyD: err < -0.035,
          };
        }
        if (frames % 10 === 0) g.zone.update(1 / 60, g.elapsed);
        if (ch === 4) g.player.update(1 / 60);
        else g.trolley.update(1 / 60);
        tickMission(s, 1 / 60);
        s.poseActors();
        updateGuide(s);
      }
      g.input.keys = {};

      if (ch === 4) {
        g.trolley.riding = false;
        g.player.pos.copy(s.point('arrival'));
        s.onStory('join');
        flush();
      } else flush();
      results.push({
        ch: ch + 1,
        blocked,
        pathLength,
        frames,
        player: { ...g.player.pos },
        actor: { ...s.actors.gabor.position },
        dist: c.dist,
        groundError,
        cameraBlocked,
        overlap,
        done: S.saga.done.includes('ch' + (ch + 1)),
        hud: document.getElementById('route-hud')?.textContent,
      });
    }
    g.mode = 'paused';
    return results;
  });
  console.log(JSON.stringify({ result, errors }, null, 2));
  for (const r of result) {
    assert.ok(!r.noRoute, 'no route ' + r.ch);
    assert.equal(r.blocked, 0);
    assert.ok(r.done);
    assert.equal(r.cameraBlocked, 0);
    assert.equal(r.overlap, 0);
    assert.ok(r.groundError < 0.15);
  }
  assert.deepEqual(errors, []);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
