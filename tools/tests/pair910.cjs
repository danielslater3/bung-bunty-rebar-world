// Loaded-scene simulation: actual handlers, physics for interior travel, city
// route validation then destination placement. Not a human campaign playthrough.
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
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
      }),
      errors = [];
    page.on('pageerror', (e) => {
      errors.push(e.stack);
      console.log('PAGEERROR', e.stack);
    });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
    await page.waitForFunction(() => !!window.BUNG);
    await page.evaluate(async () => {
      const { state, SaveSystem } = await import('/src/core/state.js'),
        { CHAPTERS, createSaga } = await import('/src/story/sagaData.js'),
        { planner, segmentClear } = await import('/src/story/guide.js'),
        { positionClear } = await import('/src/core/motion.js');
      window.S = state;
      window.Save = SaveSystem;
      window.chapters = CHAPTERS;
      window.clear = positionClear;
      window.nav = planner;
      window.segment = segmentClear;
      state.saga = {
        ...createSaga(),
        chapter: 8,
        done: CHAPTERS.slice(0, 8).map((c) => c.id),
        companion: true,
        phone: 'broken',
        evidence: ['photo', 'shards'],
      };
      state.currentZone = 'brisbane';
      state.coins = 1000;
      Save.save();
      await BUNG.startGame('keep', 'saga');
      window.draw = BUNG.renderer.render.bind(BUNG.renderer);
      BUNG.renderer.render = () => {};
      window.flush = () => {
        let n = 0;
        while (BUNG.dialogue.current && n++ < 100) {
          BUNG.input.pressed.KeyE = true;
          BUNG.dialogue.update(1 / 60);
        }
        BUNG.input.endFrame();
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
      window.frame = () => {
        BUNG.scene.updateMatrixWorld(true);
        for (let i = 0; i < 40; i++) {
          const line = BUNG.saga.performanceLine();
          if (line) BUNG.saga.framePerformance(1 / 60, line);
          else if (BUNG.dialogue.cinematic) BUNG.saga.frameDialogue(1 / 60);
          else BUNG.updateCamera(1 / 60);
        }
        draw(BUNG.scene, BUNG.camera);
      };
      window.walkTo = (target, city = false) => {
        const g = BUNG,
          s = g.saga,
          p = nav(s).plan({ ...g.player.pos }, target);
        if (p.length < 2)
          throw Error(
            'No route ' + JSON.stringify({ from: g.player.pos, target }),
          );
        for (let i = 1; i < p.length; i++)
          if (!segment(g.zone, p[i - 1], p[i]))
            throw Error('Invalid route segment');
        if (city) {
          g.player.teleport({ ...p.at(-1), y: p.at(-1).y + 0.1 });
          return p.length;
        }
        let index = 1,
          frames = 0;
        for (; frames < 3000 && index < p.length; frames++) {
          const t = p[index],
            pos = g.player.pos,
            dx = t.x - pos.x,
            dz = t.z - pos.z;
          if (Math.hypot(dx, dz) < 0.6) {
            index++;
            continue;
          }
          g.camYaw = Math.atan2(-dx, -dz);
          g.input.keys = { KeyW: true };
          g.player.update(1 / 60);
          g.elapsed += 1 / 60;
          g.scene.updateMatrixWorld(true);
        }
        g.input.keys = {};
        if (index !== p.length)
          throw Error(
            'Walk stuck ' +
              JSON.stringify({ index, target, pos: g.player.pos }),
          );
        return frames;
      };
      flush();
    });
    console.log(
      'EVIDENCE',
      await page.evaluate(async () => {
        const s = BUNG.saga;
        let routes = [];
        for (const id of ['receipt', 'witness', 'goggles']) {
          const p = s.venues.point(id);
          if (!clear({ ...p, y: p.y + 0.1 }, 0.6, BUNG.zone))
            throw Error('Evidence obstructed ' + id);
          routes.push(walkTo(p, true));
          s.onStory(id);
          if (id === 'witness') {
            Save.save(BUNG);
            await BUNG.startGame(false, 'saga');
          }
          flush();
          if (id === 'receipt') {
            Save.save(BUNG);
            await BUNG.startGame(false, 'saga');
            if (!S.saga.stepState.evidenceGot.receipt)
              throw Error('Evidence checkpoint lost');
          }
        }
        // A reload during an uncompleted witness interview must not count it as done.
        if (!S.saga.stepState.evidenceGot.witness) {
          walkTo(BUNG.saga.venues.point('witness'), true);
          BUNG.saga.onStory('witness');
          flush();
        }
        if (S.saga.step !== 2)
          throw Error('Evidence failed progression ' + S.saga.step);
        if (!BUNG.saga.mission.waiting) throw Error('Print booted remotely');
        walkTo(BUNG.saga.venues.point('evidence-print'), true);
        tick();
        BUNG.saga.mission.t = 0;
        BUNG.input.pressed.KeyF = true;
        tick();
        flush();
        return { routes, evidence: S.saga.evidence, step: S.saga.step };
      }),
    );
    await page.evaluate(() => {
      walkTo(BUNG.saga.point('court'), true);
      BUNG.saga.check(BUNG.saga.currentStep());
      frame();
    });
    await page.screenshot({ path: '../browser-tests/pair910-court.png' });
    console.log(
      'TRIAL',
      await page.evaluate(async () => {
        let s = BUNG.saga;
        if (s.mission?.kind !== 'trial') throw Error('No trial ' + S.saga.step);
        const buttons = () =>
          Array.from(document.querySelectorAll('#saga-play-actions button'));
        buttons()[1].click();
        if (s.mission.q !== 0) throw Error('Wrong exhibit advanced');
        flush();
        buttons()[0].click();
        flush();
        Save.save(BUNG);
        await BUNG.startGame(false, 'saga');
        s = BUNG.saga;
        if (s.mission.q !== 1) throw Error('Trial checkpoint lost');
        for (const i of [1, 2, 3]) {
          buttons()[i].click();
          flush();
        }
        if (!S.saga.intermission) throw Error('Verdict did not clear');
        const coins = S.coins;
        Save.save(BUNG);
        await BUNG.startGame(false, 'saga');
        if (S.coins !== coins) throw Error('Reward duplicated');
        return {
          coins,
          chapter: S.saga.chapter,
          step: S.saga.step,
          intermission: S.saga.intermission,
        };
      }),
    );
    // Continue may already have entered the next chapter from the saved clear screen.
    await page.evaluate(() => {
      if (S.saga.chapter === 8) BUNG.saga.nextChapter();
      flush();
      BUNG.camera.position.set(-260, 110, 360);
      BUNG.camera.lookAt(-95, 80, 215);
      draw(BUNG.scene, BUNG.camera);
    });
    await page.screenshot({ path: '../browser-tests/pair910-exterior.png' });
    console.log(
      'HOTEL ARRIVAL',
      await page.evaluate(() => {
        walkTo(BUNG.saga.point('hotel-entry'), true);
        BUNG.saga.check(BUNG.saga.currentStep());
        BUNG.zone.interactables.find((i) => i.id === 'hotel-enter').fn();
        frame();
        return {
          step: S.saga.step,
          venue: S.saga.venue,
          room: BUNG.indoorRoom(
            BUNG.player.pos.x,
            BUNG.player.pos.y + 1,
            BUNG.player.pos.z,
          )?.level,
        };
      }),
    );
    await page.screenshot({ path: '../browser-tests/pair910-lobby.png' });
    console.log(
      'CHECKIN',
      await page.evaluate(async () => {
        const s = BUNG.saga,
          v = s.venues;
        const frames = walkTo(v.point('hotel-reception'));
        v.action('hotel-reception');
        flush();
        if (!v.hotel().key) throw Error('Missing room key');
        walkTo(v.point('hotel-lift'));
        v.liftMenu();
        Array.from(document.querySelectorAll('#hotel-lift-menu button'))
          .find((b) => b.textContent.startsWith('9 ·'))
          .click();
        for (let i = 0; i < 130; i++) tick();
        if (v.floor.room.level !== 9 || s.freeze) throw Error('Lift failed');
        Save.save(BUNG);
        await BUNG.startGame(false, 'saga');
        if (BUNG.saga.venues.floor.room.level !== 9)
          throw Error('Lift checkpoint lost');
        return { frames, step: S.saga.step, venue: S.saga.venue };
      }),
    );
    console.log(
      'ROOM',
      await page.evaluate(() => {
        const v = BUNG.saga.venues;
        walkTo(v.point('hotel-room-door'));
        BUNG.zone.interactables.find((i) => i.id === 'hotel-room-door').fn();
        for (let i = 0; i < 70; i++) tick();
        walkTo(v.point('hotel-room'));
        BUNG.saga.check(BUNG.saga.currentStep());
        walkTo(v.point('hotel-mixbar'));
        v.action('hotel-mixbar');
        flush();
        frame();
        return {
          step: S.saga.step,
          open: v.hotel().roomOpen,
          seen: v.hotel().roomSeen,
        };
      }),
    );
    await page.screenshot({ path: '../browser-tests/pair910-room.png' });
    console.log(
      'FACILITIES',
      await page.evaluate(async () => {
        for (const [id, floor] of [
          ['hotel-bar', 0],
          ['hotel-pool', 4],
          ['hotel-spa', 5],
          ['hotel-gym', 6],
        ]) {
          const v = BUNG.saga.venues;
          walkTo(v.point('hotel-lift'));
          v.liftMenu();
          Array.from(document.querySelectorAll('#hotel-lift-menu button'))
            .find((b) =>
              b.textContent.startsWith(`${floor === 0 ? 'G' : floor} ·`),
            )
            .click();
          for (let i = 0; i < 130; i++) tick();
          walkTo(v.point(id));
          v.action(id);
          flush();
          if (id === 'hotel-pool') {
            Save.save(BUNG);
            await BUNG.startGame(false, 'saga');
            if (!BUNG.saga.venues.hotel().visited[id])
              throw Error('Facility checkpoint lost');
          }
        }
        return { visited: BUNG.saga.venues.hotel().visited, step: S.saga.step };
      }),
    );
    console.log(
      'GUEST FLOORS',
      await page.evaluate(() => {
        const v = BUNG.saga.venues;
        const results = [];
        for (const floor of [12, 18, 24]) {
          walkTo(v.point('hotel-lift'));
          v.liftMenu();
          Array.from(document.querySelectorAll('#hotel-lift-menu button'))
            .find((b) => b.textContent.startsWith(`${floor} ·`))
            .click();
          for (let i = 0; i < 130; i++) tick();
          for (const id of v.floor.floorPoints.filter((id) =>
            id.startsWith('hotel-door-'),
          )) {
            walkTo(v.point(id));
            BUNG.zone.interactables.find((i) => i.id === id).fn();
            for (let i = 0; i < 40; i++) tick();
            walkTo(v.point(id.replace('hotel-door-', 'hotel-inside-')));
            frame();
            const p = BUNG.camera.position;
            if (!v.room(p.x, p.y, p.z)) throw Error('Camera escaped ' + id);
          }
          results.push({
            floor,
            rooms: v.floor.doors.length,
            colliders: v.floor.cols.length,
          });
        }
        walkTo(v.point('hotel-lift'));
        v.liftMenu();
        BUNG.input.pressed.Escape = true;
        tick();
        if (
          document.getElementById('hotel-lift-menu') ||
          BUNG.saga.freeze ||
          BUNG.mode !== 'playing'
        )
          throw Error('Lift cancel froze controls');
        return results;
      }),
    );
    console.log(
      'DINNER',
      await page.evaluate(() => {
        const v = BUNG.saga.venues;
        walkTo(v.point('hotel-lift'));
        v.liftMenu();
        Array.from(document.querySelectorAll('#hotel-lift-menu button'))
          .find((b) => b.textContent.startsWith('3 ·'))
          .click();
        for (let i = 0; i < 130; i++) tick();
        walkTo(v.point('hotel-meal'));
        v.action('hotel-meal');
        flush();
        walkTo(v.point('hotel-dance'));
        for (let i = 0; i < 650 && BUNG.saga.currentStep()?.id === 'dance'; i++)
          tick();
        if (BUNG.saga.currentStep()?.id !== 'newphone')
          throw Error('Dance never completed');
        walkTo(v.point('newphone'));
        v.action('newphone');
        flush();
        walkTo(v.point('hotel-night'));
        v.action('hotel-night');
        frame();
        return { step: S.saga.step, phone: S.saga.phone };
      }),
    );
    await page.screenshot({ path: '../browser-tests/pair910-night.png' });
    console.log(
      'COMPLETE',
      await page.evaluate(() => {
        flush();
        if (!S.saga.done.includes('ch10')) throw Error('Hotel did not clear');
        return {
          done: S.saga.done,
          venue: S.saga.venue,
          coins: S.coins,
          mode: BUNG.mode,
        };
      }),
    );
    assert.deepEqual(errors, []);
    console.log('PAIR 9–10 PASSED');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
