// Loaded city + responsive room layout. Uses an isolated browser/save/room.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1365, height: 900 },
      }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.stack));
    page.on('console', m => { if (m.type() === 'error' && m.text().includes('Shader Error')) errors.push(m.text()); });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
    await page.waitForFunction(() => !!window.BUNG);
    await page.evaluate(() => {
      window.cityDraw = BUNG.renderer.render.bind(BUNG.renderer);
      BUNG.renderer.render = () => {};
    });
    await page.locator('#btn-multiplayer').click();
    await page.getByLabel('Your player name').fill('City quality check');
    await page
      .getByRole('button', { name: 'CREATE A ROOM', exact: true })
      .click();
    await page.waitForFunction(
      () => BUNG.multiplayer.active && !!BUNG.multiplayer.ui && !BUNG.loading,
      null,
      { timeout: 60000 },
    );
    const checks = await page.evaluate(async () => {
      const g = BUNG,
        z = g.zone,
        life = z.cityLife,
        { positionClear } = await import('/src/core/motion.js'),
        { routeAccessible } = await import('/src/world/geo/cityLife.js');
      const plaza = z.group.getObjectByName('Grounded City Hall plaza'),
        a = plaza.geometry.attributes.position.array;
      let plazaError = 0;
      for (let i = 0; i < a.length; i += 3)
        plazaError = Math.max(
          plazaError,
          Math.abs(
            a[i + 1] +
              plaza.position.y -
              z.terrain.walkAt(a[i], a[i + 2]) -
              0.08,
          ),
        );
      const staticZone = {
        ...z,
        colliders: z.colliders.filter((b) => !b.transient),
      };
      if (!life.routes.every((r) => routeAccessible(r, staticZone)))
        throw Error('A traffic circuit intersects fixed scenery');
      let treeError = 0;
      for (const p of life.trees.locations) {
        treeError = Math.max(
          treeError,
          Math.abs(p.y - z.terrain.walkAt(p.x, p.z)),
        );
        if (
          !positionClear({ x: p.x, y: p.y, z: p.z }, 0.15, {
            ...staticZone,
            colliders: [],
          })
        )
          throw Error('Tree inside building');
      }
      let pedestrianError = 0;
      for (let i = 0; i < 300; i++) z.update(1 / 30, g.elapsed + i / 30);
      for (const p of z.cityPedestrians)
        pedestrianError = Math.max(
          pedestrianError,
          Math.abs(
            p.g.position.y -
              z.groundAt(
                p.g.position.x,
                p.g.position.z,
                z.terrain.walkAt(p.g.position.x, p.g.position.z) + 0.3,
              ),
          ),
        );
      const old = g.player.pos.clone();
      g.player.pos.set(9000, 100, 9000);
      for (let i = 0; i < 10000; i++) life.update(0.1, i * 0.1);
      g.player.teleport(old);
      let wheelError = 0;
      for (const service of life.services) {
        service.model.updateMatrixWorld(true);
        for (const wheel of service.model.userData.wheels) {
          const p = wheel.getWorldPosition(g.player.pos.clone());
          wheelError = Math.max(
            wheelError,
            Math.abs(
              p.y -
                service.model.userData.wheelRadius -
                z.terrain.walkAt(p.x, p.z) -
                0.045,
            ),
          );
        }
      }
      const buses = life.services
        .filter((s) => s.bus)
        .map((s) => ({
          label: s.label,
          visits: s.visits,
          distance: s.distance,
          speed: s.speed,
          blockedFor: s.blockedFor,
          blockedReason: s.blockedReason,
        }));
      const street = z.streetDetail;
      const streetGroundError = Math.max(...[...street.lamps, ...street.rests]
        .map(p => Math.abs(p.y - z.terrain.walkAt(p.x, p.z))));
      return {
        street: {
          lamps: street.lamps.length,
          benches: street.rests.length,
          drains: street.drains.length,
          batches: street.batches,
          streetGroundError,
        },
        bridges: z.bridgeDetail,
        cars: life.services.filter((s) => !s.bus).length,
        buses,
        stops: life.stops.length,
        trees: life.trees.locations.length,
        pedestrians: z.cityPedestrians.length,
        wheelError,
        plazaVertices: a.length / 3,
        plazaError,
        treeError,
        pedestrianError,
      };
    });
    console.log('WORLD CHECKS', JSON.stringify(checks));
    assert.ok(checks.street.lamps >= 100 && checks.street.lamps <= 300);
    assert.ok(checks.street.benches >= 12 && checks.street.benches <= 84);
    assert.ok(checks.street.drains >= 25);
    assert.equal(checks.street.streetGroundError, 0);
    assert.ok(checks.bridges.trussSections >= 25 && checks.bridges.railPanels >= 50);
    assert.equal(checks.cars, 12);
    assert.equal(checks.buses.length, 3);
    assert.ok(checks.stops >= 6);
    assert.ok(checks.trees >= 150);
    assert.ok(checks.pedestrians >= 30);
    assert.ok(checks.plazaError < 0.01, 'floating plaza');
    assert.ok(checks.wheelError < 0.05, 'floating tyres: ' + checks.wheelError);
    assert.ok(checks.treeError < 0.001, 'floating tree');
    assert.ok(checks.pedestrianError < 0.05, 'floating walker');
    for (const b of checks.buses) {
      assert.ok(b.visits >= 7, JSON.stringify(b));
      assert.ok(b.blockedFor < 30, JSON.stringify(b));
    }
    // Capture real rendered models in their real geography, without leaving the
    // test player teleported across the online room between network frames.
    for (const type of ['bus', 'car', 'park', 'mall', 'apple', 'hall', 'story-bridge', 'park-bench']) {
      await page.evaluate(async (type) => {
        const g = BUNG,
          z = g.zone,
          life = z.cityLife,
          old = g.player.pos.clone();
        g.multiplayer.hidePanels();
        let angle = Math.PI / 4;
        let x,
          y,
          zp,
          back = 12, rise = 5, lookY = 2;
        if (type === 'bus' || type === 'car') {
          const s = life.services.find((s) => s.bus === (type === 'bus'));
          angle = s.pose.yaw + 0.9;
          x = s.model.position.x;
          y = s.model.position.y;
          zp = s.model.position.z;
          s.model.visible = true;
        } else if (type === 'park') {
          const p =
            life.trees.locations.find((p) => Math.hypot(p.x, p.z) < 1100) ||
            life.trees.locations[0];
          ({ x, y, z: zp } = p);
          back = 18;
        } else if (type === 'apple') {
          const front = z.group.getObjectByName('MacArthur Chambers shopfront');
          ({ x, y, z: zp } = front.position);
          angle = front.rotation.y + .08;
          back = 17;
          lookY = 3.9;
        } else if (type === 'hall') {
          const hall = g.geoBrisbane.landmarks.cityHall;
          ({ cx: x, cz: zp } = hall);
          angle = 1.78;
          y = z.groundAt(x, zp);
          back = 65;
          rise = 8;
          lookY = 24;
        } else if (type === 'story-bridge') {
          const b = g.geoBrisbane.bridges.find(b => b.name === 'Story Bridge');
          const { bridgeSection } = await import('/src/world/geo/bridges.js');
          const dx = b.bx - b.ax, dz = b.bz - b.az, l = Math.hypot(dx, dz);
          x = (b.ax + b.bx) / 2; zp = (b.az + b.bz) / 2;
          const section = bridgeSection(b.ring, x, zp, dx / l, dz / l);
          const off = (section.left + section.right) / 2;
          x -= dz * off / l; zp += dx * off / l;
          y = z.groundAt(x, zp);
          angle = Math.atan2(-dz, dx) + .15;
          back = 130;
          rise = 27;
          lookY = 7;
        } else if (type === 'park-bench') {
          const p = z.streetDetail.rests.find(p => Math.hypot(p.x, p.z) < 1450);
          ({ x, y, z: zp } = p);
          angle = p.yaw + .45;
          back = 5.5;
          rise = 2.6;
          lookY = .65;
        } else {
          x = 173;
          y = z.groundAt(173, 90);
          zp = 90;
          back = 11;
        }
        g.player.teleport({ x: x + 10, y: y + 0.1, z: zp + 10 });
        z.update(0, g.elapsed);
        life.trees.update({ x, z: zp });
        g.camera.position.set(
          x + Math.sin(angle) * back,
          y + rise,
          zp + Math.cos(angle) * back,
        );
        g.camera.lookAt(x, y + (type === 'bus' ? 1.5 : lookY), zp);
        g.scene.updateMatrixWorld(true);
        window.cityDraw(g.scene, g.camera);
        g.player.teleport(old);
      }, type);
      await page.screenshot({ path: `../browser-tests/city-${type}.png` });
    }
    const layouts = [];
    for (const [width, height] of [
      [1920, 1080],
      [1365, 900],
      [900, 700],
      [768, 1024],
      [390, 844],
      [375, 667],
      [667, 375],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => BUNG.multiplayer.hidePanels());
      const inspect = () =>
        page.evaluate(() => {
          const rect = (id) => {
            const e = document.querySelector(id),
              s = e && getComputedStyle(e);
            return e && s.display !== 'none' && s.visibility !== 'hidden'
              ? e.getBoundingClientRect().toJSON()
              : null;
          };
          const stats = rect('#hud-topleft'),
            bar = rect('.mp-topbar'),
            chat = rect('#mp-chat'),
            goal = rect('#mp-goal'),
            score = rect('#hud-topright'),
            currencies = rect('#hud-bottomright');
          const overlap = (a, b) =>
            a &&
            b &&
            a.left < b.right - 0.5 &&
            a.right > b.left + 0.5 &&
            a.top < b.bottom - 0.5 &&
            a.bottom > b.top + 0.5;
          return {
            width: innerWidth,
            height: innerHeight,
            stats,
            bar,
            chat,
            goal,
            score,
            currencies,
            overlap: !!(
              overlap(stats, bar) ||
              overlap(bar, chat) ||
              overlap(goal, chat)
            ),
            outside: !![stats, bar, chat, goal]
              .filter(Boolean)
              .some(
                (r) =>
                  r.left < -0.5 ||
                  r.right > innerWidth + 0.5 ||
                  r.top < -0.5 ||
                  r.bottom > innerHeight + 0.5,
              ),
          };
        });
      const closed = await inspect();
      assert.equal(closed.overlap, false, JSON.stringify(closed));
      assert.equal(closed.outside, false, JSON.stringify(closed));
      assert.equal(closed.score, null);
      assert.equal(closed.currencies, null);
      await page.keyboard.press('Enter');
      const opened = await inspect();
      assert.equal(opened.overlap, false, JSON.stringify(opened));
      assert.equal(opened.outside, false, JSON.stringify(opened));
      assert.equal(opened.goal, null);
      if (width === 375 || width === 1365) {
        await page.evaluate(() => {
          BUNG.scene.updateMatrixWorld(true);
          window.cityDraw(BUNG.scene, BUNG.camera);
        });
        await page.screenshot({
          path: `../browser-tests/city-hud-${width}.png`,
        });
      }
      await page.keyboard.press('Escape');
      layouts.push([width, height]);
    }
    assert.deepEqual(errors, []);
    console.log('CITY LIFE + HUD PASSED', { layouts, errors });
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
