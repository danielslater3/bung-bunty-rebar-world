// Optional loaded-scene regression. Run with Playwright available in NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000/', { timeout: 60000 });
  await page.waitForFunction(() => !!window.BUNG);
  await page.evaluate(() => BUNG.startGame(true, 'saga'));
  await page.evaluate(async () => {
    window.S = (await import('/src/core/state.js')).state;
    window.guides = await import('/src/story/guide.js');
    window.THREE = await import('three');
    window.flush = () => {
      let n = 0;
      while (BUNG.dialogue.current && n++ < 50) BUNG.dialogue.skip();
    };
    flush();
    window.draw = BUNG.renderer.render.bind(BUNG.renderer);
    BUNG.renderer.render = () => {};
    BUNG.mode = 'paused';
  });
  console.log('READY');
  const navigation = await page.evaluate(() => {
    const g = BUNG,
      s = g.saga,
      z = g.zone,
      plan = s.actors.guide.userData.controller;
    // initialize routing without waiting for a rendered frame
    const set = (ch, step) => {
      S.saga.chapter = ch;
      S.saga.step = step;
      S.saga.stepState = {};
      S.saga.intermission = false;
      s._booted = '';
      g.mode = 'playing';
      s.scenePlaying = false;
      flush();
    };
    set(0, 2);
    g.player.pos.set(-820, s.actors.house.y + 0.16, 898);
    guides.updateGuide(s);
    const nav = s.actors.guide.userData.controller,
      results = [];
    const it = (id) => {
      const a = z.interactables.find((i) => i.id === id);
      return { x: a.pos.x, y: a.pos.y - 0.8, z: a.pos.z };
    };
    s.openGarage();
    for (let i = 0; i < 240; i++) s.tickGarage(1 / 60);
    const gate = s.point('gate'),
      bar = it('mcrebar');
    const cases = [
      ['bed→wardrobe', it('bed'), it('wardrobe')],
      ['wardrobe→shelf', it('wardrobe'), it('shelf')],
      ['house→garage', it('shelf'), it('garage')],
      ['gate→McRebar', gate, bar],
      ['McRebar→hall', bar, it('hall')],
      ['hall→South Bank', it('hall'), it('bank')],
      ['South Bank→mall', it('bank'), it('mallBolt')],
      ['mall→garage', it('mallBolt'), it('garage')],
      ['McRebar→collector', bar, s.point('event')],
      ['collector→home', s.point('event'), it('shelf')],
    ];
    for (const [name, a, b] of cases) {
      const t = performance.now();
      let from = a;
      if (!guides.segmentClear(z, a, a)) {
        const approach = nav.plan(it('bed'), a);
        if (approach.length) from = approach.at(-1);
      }
      const path = nav.plan(from, b);
      results.push({
        name,
        points: path.length,
        ms: Math.round(performance.now() - t),
        blocked: path
          .slice(1)
          .flatMap((p, i) => (!guides.segmentClear(z, path[i], p) ? [{ a: path[i], b: p }] : [])),
      });
      if (!path.length && name === 'collector→home')
        results.push({
          front: s.actors.house.frontRoute,
          house: s.actors.house.rooms,
          target: b,
          via: nav.plan(s.actors.house.frontRoute[0], b),
          toGate: nav.plan(a, gate).length,
        });
    }
    g.mode = 'paused';
    return results;
  });
  console.log('NAV', JSON.stringify(navigation, null, 2));
  for (const r of navigation) {
    assert.ok(r.points > 1, r.name + ' has no route');
    assert.equal(r.blocked.length, 0, r.name + ' crosses solid geometry');
  }
  const delivery = await page.evaluate(() => {
    const g = BUNG,
      s = g.saga;
    flush();
    S.saga.chapter = 19;
    S.saga.step = 1;
    S.saga.stepState = { leg: 0, carrying: true };
    S.saga.intermission = false;
    s._booted = '';
    s.ensureStep();
    const step = s.currentStep();
    if (step.kind !== 'deliver') return { wrongStep: step };
    const it = g.zone.interactables.find((i) => i.id === step.drops[0]);
    g.trolley.riding = true;
    g.trolley.summoned = true;
    g.trolley.pos.copy(it.pos);
    g.player.pos.copy(it.pos);
    g.input.pressed.KeyE = true;
    g.trolley.update(1 / 60);
    const stillRiding = g.trolley.riding;
    g.updatePlaying(1 / 60);
    g.input.endFrame();
    g.mode = 'paused';
    return { stillRiding, leg: S.saga.stepState.leg, carrying: S.saga.stepState.carrying };
  });
  console.log('DELIVERY', delivery);
  assert.equal(delivery.stillRiding, true);
  assert.equal(delivery.leg, 1);
  const chase = await page.evaluate(() => {
    const g = BUNG,
      s = g.saga;
    flush();
    g.trolley.riding = false;
    S.saga.chapter = 1;
    S.saga.step = 3;
    S.saga.stepState = {};
    s._booted = '';
    g.mode = 'playing';
    s.ensureStep();
    let c = s._chaseController,
      n = 0;
    for (; n < 18000 && S.saga.step === 3; n++) {
      const target = c.path[Math.min(c.path.length - 1, Math.floor(n / 150))];
      g.player.pos.copy(target);
      s.moveGabor(1 / 60, s.currentStep());
    }
    const follow = S.saga.step,
      hold = { ...s.gaborHold };
    // Perform the actual bag interaction and finish the confrontation dialogue.
    s.onBag();
    flush();
    const catchStep = S.saga.step;
    s.ensureStep();
    c = s._chaseController;
    g.trolley.riding = true;
    for (n = 0; n < 18000 && S.saga.step === 6; n++) {
      const target = c.path[Math.min(c.path.length - 1, Math.floor(n / 100))];
      g.trolley.pos.copy(target);
      g.player.pos.copy(target);
      s.moveGabor(1 / 60, s.currentStep());
    }
    const afterCatch = S.saga.step;
    g.trolley.riding = false;
    g.player.pos.copy(s.actors.bag.position);
    s.onBag();
    flush();
    g.mode = 'paused';
    return { follow, catchStep, afterCatch, done: S.saga.done, intermission: S.saga.intermission, hold };
  });
  console.log('CHASE', chase);
  assert.equal(chase.follow, 4);
  assert.equal(chase.catchStep, 6);
  assert.equal(chase.afterCatch, 7);
  assert.ok(chase.done.includes('ch2'));
  assert.equal(chase.intermission, true);
  const movement = await page.evaluate(() => {
    const g = BUNG,
      s = g.saga;
    flush();
    g.menus.close();
    g.trolley.dismiss();
    S.saga.chapter = 0;
    S.saga.step = 1;
    S.saga.stepState = {};
    S.saga.intermission = false;
    s._booted = '';
    s.freeze = false;
    s.go('bed');
    g.mode = 'playing';
    const finishPose = () => {
      for (let i = 0; i < 180; i++) s.tickPose(1 / 60);
      flush();
    };
    s.onBed();
    finishPose();
    g.scene.updateMatrixWorld(true);
    const nav = s.actors.guide.userData.controller;
    const target = (id) => {
      const it = g.zone.interactables.find((i) => i.id === id);
      return { x: it.pos.x, y: it.pos.y - 0.8, z: it.pos.z };
    };
    const walk = (id) => {
      const path = nav.plan({ ...g.player.pos }, target(id));
      let index = 1,
        frames = 0;
      for (; frames < 4000 && index < path.length; frames++) {
        const p = path[index],
          dx = p.x - g.player.pos.x,
          dz = p.z - g.player.pos.z;
        if (Math.hypot(dx, dz) < 0.35) {
          index++;
          continue;
        }
        g.camYaw = Math.atan2(dx, dz) + Math.PI;
        g.input.keys = { KeyW: true };
        g.input.pressed = {};
        if (frames % 10 === 0) g.zone.update(1 / 60, g.elapsed);
        g.scene.updateMatrixWorld(true);
        g.player.update(1 / 60);
      }
      g.input.keys = {};
      return {
        id,
        arrived: path.length > 0 && index === path.length,
        frames,
        pos: { ...g.player.pos },
        last: path[index],
      };
    };
    const walks = [walk('wardrobe')];
    s.onWardrobe();
    finishPose();
    walks.push(walk('shelf'));
    s.onShelf();
    finishPose();
    walks.push(walk('garage'));
    s.onGarage();
    flush();
    for (let i = 0; i < 240; i++) s.tickGarage(1 / 60);
    g.scene.updateMatrixWorld(true);
    // Actual trolley integration and keyboard steering; only the test's initial
    // mount is direct. No teleporting along the driveway.
    g.trolley.mount();
    s.freeze = false;
    const drive = (path, reversing = false) => {
      let index = 1,
        frames = 0;
      for (; frames < 5000 && index < path.length; frames++) {
        const p = path[index],
          dx = p.x - g.trolley.pos.x,
          dz = p.z - g.trolley.pos.z;
        if (Math.hypot(dx, dz) < 1.5) {
          index++;
          continue;
        }
        const wanted = Math.atan2(dx, dz) + (reversing ? Math.PI : 0),
          err = Math.atan2(Math.sin(wanted - g.trolley.heading), Math.cos(wanted - g.trolley.heading));
        const steer = reversing ? -err : err;
        g.input.keys = {
          KeyW: !reversing && g.trolley.speed < 4,
          KeyS: reversing && g.trolley.speed > -3,
          KeyA: steer > 0.035,
          KeyD: steer < -0.035,
        };
        g.input.pressed = {};
        if (frames % 10 === 0) g.zone.update(1 / 60, g.elapsed);
        g.trolley.update(1 / 60);
      }
      g.trolley.speed = 0;
      return { arrived: index === path.length, frames, pos: { ...g.trolley.pos }, target: path[index] };
    };
    const garageExit = drive(s.actors.house.garageRoute);
    const garageReturn = drive(s.actors.house.garageRoute.slice().reverse(), true);
    g.input.keys = {};
    g.mode = 'paused';
    return {
      walks,
      garageExit,
      garageReturn,
    };
  });
  console.log('MOVEMENT', JSON.stringify(movement, null, 2));
  for (const w of movement.walks) assert.equal(w.arrived, true, w.id + ' cannot be walked to');
  assert.equal(movement.garageExit.arrived, true, 'trolley cannot leave garage');
  assert.equal(movement.garageReturn.arrived, true, 'trolley cannot return to garage');
  const opening = await page.evaluate(async () => {
    const g = BUNG,
      s = g.saga;
    flush();
    g.menus.close();
    g.trolley.dismiss();
    s.freeze = false;
    const { SaveSystem } = await import('/src/core/state.js');
    const { CHAPTERS, createSaga } = await import('/src/story/sagaData.js');
    const { frameDialogue } = await import('/src/story/dialogueCam.js');
    const pose = () => {
      for (let i = 0; i < 150; i++) s.tickPose(1 / 60);
      flush();
    };
    const set = (ch, step, start) => {
      flush();
      s._pose = null;
      s.freeze = false;
      s.scenePlaying = false;
      S.saga = { ...createSaga(), chapter: ch, step };
      s._booted = '';
      s.go(start);
      g.mode = 'playing';
      s.ensureStep();
    };
    const clearCamera = [];
    for (const [ch, step, start] of [
      [0, 8, 'mcrebar'],
      [2, 0, 'garage'],
      [3, 0, 'mcrebar'],
    ]) {
      set(ch, step, start);
      s.beginScene(s.currentStep());
      g.scene.updateMatrixWorld(true);
      while (g.dialogue.current) {
        const speaker = g.dialogue.current.speaker;
        let blocked = 0,
          outside = 0;
        for (let i = 0; i < 90; i++) {
          frameDialogue(s, 1 / 60);
          const p = g.camPos,
            room = g.indoorRoom(p.x, p.y, p.z);
          if (!room) outside++;
          if (
            g.zone.colliders.some(
              (b) =>
                p.x > b.min.x &&
                p.x < b.max.x &&
                p.y > b.min.y &&
                p.y < b.max.y &&
                p.z > b.min.z &&
                p.z < b.max.z,
            )
          )
            blocked++;
        }
        clearCamera.push({ chapter: ch + 1, speaker, blocked, outside });
        g.dialogue.skip();
      }
    }
    // Chapter 1 handlers and location checks in their real order. Long-distance
    // travel is placed at its destination here; it is separately route-validated.
    set(0, 1, 'bed');
    s.onBed();
    pose();
    s.onWardrobe();
    pose();
    s.onShelf();
    pose();
    s.onGarage();
    flush();
    g.trolley.dismiss();
    g.player.pos.copy(s.point('gate'));
    s.check(s.currentStep());
    s.go('mcrebar');
    s.check(s.currentStep());
    s.onCounter();
    flush();
    const chapter1 = { done: S.saga.done.includes('ch1'), step: S.saga.step };
    const coins = S.coins;
    SaveSystem.save(g);
    SaveSystem.load();
    s.resume(false);
    flush();
    const clearReload = { chapter: S.saga.chapter, coinsUnchanged: S.coins === coins };
    // Chapter 3 parts -> installation -> rings -> staged chase -> relic.
    set(2, 1, 'garage');
    for (const id of ['hall', 'bank', 'mallBolt']) s.onPart(id, 'A very qualified part.');
    flush();
    s.onGarage();
    flush();
    g.trolley.riding = true;
    for (const id of s.currentStep().rings) {
      g.trolley.pos.copy(s.point(id));
      s.check(s.currentStep());
    }
    s.ensureStep();
    let c = s._chaseController;
    for (let n = 0; n < 18000 && s.currentStep()?.kind === 'catch'; n++) {
      g.trolley.pos.copy(c.path[Math.min(c.path.length - 1, Math.floor(n / 100))]);
      s.moveGabor(1 / 60, s.currentStep());
    }
    g.trolley.riding = false;
    s.onBag();
    flush();
    const chapter3 = { done: S.saga.done.includes('ch3'), bigBoy: S.saga.bigBoy };
    // Chapter 4 scanner, disguise, decoy choice, escape, return to shelf.
    set(3, 1, 'event');
    s.check(s.currentStep());
    s.onScanner();
    flush();
    s.onMop();
    pose();
    s.onPed('ped-mid');
    flush();
    const wrongChoiceSafe = s.currentStep().id === 'swap';
    s.onPed('ped-left');
    flush();
    g.player.pos.copy(s.point('event'));
    g.player.pos.x -= 30;
    s.check(s.currentStep());
    s.onShelf();
    pose();
    const chapter4 = {
      done: S.saga.done.includes('ch4'),
      relic: S.saga.relics.includes('Emerald Rebar'),
      wrongChoiceSafe,
    };
    g.mode = 'paused';
    return { clearCamera, chapter1, clearReload, chapter3, chapter4 };
  });
  console.log('OPENING', JSON.stringify(opening, null, 2));
  assert.equal(opening.chapter1.done, true);
  assert.equal(opening.clearReload.chapter, 1);
  assert.equal(opening.clearReload.coinsUnchanged, true);
  assert.equal(opening.chapter3.done, true);
  assert.equal(opening.chapter4.done, true);
  assert.equal(opening.chapter4.relic, true);
  assert.equal(opening.chapter4.wrongChoiceSafe, true);
  for (const c of opening.clearCamera) {
    assert.equal(c.blocked, 0, 'cinematic camera in wall');
    assert.equal(c.outside, 0, 'indoor cinematic camera left room');
  }
  console.log('ERRORS', errors);
  assert.deepEqual(errors, []);
  await browser.close();
})();
