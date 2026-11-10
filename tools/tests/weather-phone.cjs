const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 890 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', m => { if (m.type() === 'error' && /Shader Error/.test(m.text())) errors.push(m.text()); });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
    await page.waitForFunction(() => !!window.BUNG, null, { polling: 150, timeout: 60000 });
    await page.evaluate(async endpoint => {
      const g = BUNG;
      sessionStorage.setItem('bung-room-server', endpoint);
      window.drawWeather = g.renderer.render.bind(g.renderer);
      g.renderer.render = () => {};
      window.THREE = await import('three');
      window.weatherModel = await import('/src/weather/model.js');
      window.motion = await import('/src/core/motion.js');
    }, process.env.ROOM_SERVER || 'https://bung-bunty-rooms.sitecraft-au.workers.dev');
    await page.locator('#btn-multiplayer').click();
    await page.getByLabel('Your player name').fill('Storm Runner');
    const editions = page.getByLabel('Handset edition');
    await editions.waitFor({ state: 'visible' });
    await page.locator('.s24-picker img').waitFor({ state: 'visible' });
    assert.equal(await editions.locator('option').count(), 10);
    for (const id of ['titanium','rebar','concrete','girder','james','night','emerald','mcrebar','transition','yard']) {
      await editions.selectOption(id);
      await page.locator('.s24-picker img').evaluate(img => img.decode());
    }
    await page.getByRole('button', { name: 'CREATE A ROOM', exact: true }).click();
    await page.waitForFunction(() => BUNG.multiplayer.active && BUNG.multiplayer.ui && !BUNG.loading && BUNG.weather.zone,
      null, { polling: 150, timeout: 60000 });
    const phone = page.getByRole('dialog', { name: 'Rebar S24' });
    await page.keyboard.press('Digit1');
    await phone.getByRole('heading', { name: 'Yard Prototype' }).waitFor();
    assert.equal(await page.evaluate(() => BUNG.multiplayer.focus), true);
    const app = name => phone.locator('.s24-app-grid').getByRole('button', { name, exact: true }).click();
    const home = () => phone.getByRole('button', { name: 'Home', exact: true }).click();
    await app('Wallet');
    assert.match(await phone.locator('.s24-wallet').textContent(), /room rebar/);
    await home();
    await app('Device');
    await phone.getByRole('button', { name: 'Next ›' }).click();
    await phone.getByRole('button', { name: 'Equip edition' }).click();
    await home();
    assert.equal(await phone.getByRole('heading', { name: 'Titanium Original' }).count(), 1);
    await app('City Map');
    await phone.getByRole('button', { name: 'Queen Street', exact: true }).click();
    await phone.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => BUNG.multiplayer.activityTarget.label), 'Queen Street');
    await page.keyboard.press('Digit1');
    await phone.waitFor();
    await app('Camera');
    await page.evaluate(() => { BUNG.renderer.render = drawWeather; });
    await phone.getByRole('button', { name: 'Take photo' }).click();
    await page.evaluate(() => { BUNG.renderer.render = () => {}; });
    const photo = phone.getByRole('img', { name: 'Brisbane game snapshot' });
    assert.ok(await photo.evaluate(async img => { await img.decode(); return img.naturalWidth > 100; }));
    await home();
    await app('Weather');
    assert.ok(await phone.getByLabel('Simulated Brisbane weather radar').isVisible());
    await phone.getByRole('button', { name: 'Rain', exact: true }).click();
    await phone.getByRole('button', { name: 'Replay', exact: true }).click();
    await phone.getByRole('button', { name: 'Live', exact: true }).click();
    await phone.getByRole('button', { name: 'Home', exact: true }).click();
    await app('Calculator');
    for (const key of ['7', '×', '8', '=']) await phone.getByRole('button', { name: key, exact: true }).click();
    assert.equal(await phone.locator('output').textContent(), '56');
    await phone.getByRole('button', { name: 'Home', exact: true }).click();
    await app('Notes');
    await phone.getByLabel('Your notes').fill('Meet under City Hall.');
    await home();
    await app('Notes');
    assert.equal(await phone.getByLabel('Your notes').inputValue(), 'Meet under City Hall.');
    await phone.getByRole('button', { name: 'Home', exact: true }).click();
    await app('Arcade');
    await phone.getByRole('button', { name: 'Square 1' }).click();
    assert.equal(await phone.getByRole('button', { name: 'Square 1' }).textContent(), '🔩');
    await phone.getByRole('button', { name: 'Memory', exact: true }).click();
    assert.equal(await phone.locator('.s24-arcade-grid button').count(), 12);
    await phone.getByRole('button', { name: 'Burger Buzzer', exact: true }).click();
    await phone.getByRole('button', { name: 'Start', exact: true }).click();
    await phone.getByRole('button', { name: 'SERVED!', exact: true }).click();
    assert.match(await phone.locator('.s24-game-status').textContent(), /personal best/);
    await page.keyboard.press('Escape');
    await phone.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => BUNG.multiplayer.focus), false);
    await page.evaluate(async () => {
      const g = BUNG;
      await g.multiplayer.leave();
      g.mode = 'playing';
      g.menus.close();
      await g.loadZone('brisbane', true);
      g.input.enabled = true;
    });
    await page.evaluate(() => BUNG.phone.open('weather'));
    await phone.getByRole('button', { name: 'Start solo storm drill' }).click();
    assert.match(await phone.locator('.s24-forecast').textContent(), /DRILL/);
    await page.setViewportSize({ width: 390, height: 720 });
    await page.evaluate(() => {
      const { weather, phone, player, zone } = BUNG;
      weather.exercise.time = 156;
      const { x, z } = weatherModel.weatherAt(weather.seed, 156, weather.exercise).tornado;
      player.teleport(new THREE.Vector3(x + 160, zone.groundAt(x + 160, z), z));
      weather.update(0);
      phone.drawRadar();
      phone.body.scrollTop = 0;
    });
    await page.screenshot({ path: '../browser-tests/s24-radar-mobile.png' });
    await page.setViewportSize({ width: 1365, height: 890 });
    await page.keyboard.press('Escape');

    const storm = await page.evaluate(() => {
      const g = BUNG, w = g.weather, z = g.zone;
      g.renderer.setAnimationLoop(null);
      w.exercise = { track: 0, tier: 4, time: 156 };
      w.update(0);
      const f = w.frame, t = f.tornado;
      if (!t?.ground) throw Error('Drill did not touch down');
      let spot;
      for (let r = 9; r < 40 && !spot; r += 5) for (let i = 0; i < 18; i++) {
        const a = i * Math.PI / 9, x = t.x + Math.cos(a) * r, zz = t.z + Math.sin(a) * r;
        const p = { x, y: z.groundAt(x, zz), z: zz };
        if (!z.terrain.isWater(x, zz) && motion.positionClear(p, .7, z) &&
            !g.indoorCeiling(x, p.y + 1, zz) && g.cameraClearance(new THREE.Vector3(x,p.y+1.55,zz), new THREE.Vector3(0,1,0), 7) > 6.95) {
          spot = p; break;
        }
      }
      if (!spot) throw Error('No exposed approach to the drill');
      g.player.teleport(new THREE.Vector3(spot.x, spot.y, spot.z));
      g.player.mesh.visible = true;
      w.sampleIn = 0;
      const start = g.player.pos.clone();
      let lifted = false, thrown = false;
      for (let i = 0; i < 188; i++) {
        g.player.update(1/60);
        w.update(1/60);
        lifted ||= g.player.pos.y > start.y + 1.8;
        thrown ||= w.throwUntil > w.time;
      }
      const radius = Math.hypot(g.player.pos.x - start.x, g.player.pos.z - start.z);
      const t2 = w.frame.tornado, floor = z.groundAt(t2.x,t2.z);
      g.camera.position.set(t2.x + 190, floor + 46, t2.z + 164);
      g.camera.lookAt(t2.x, floor + 95, t2.z);
      w.drawAtmosphere(w.frame, w.conditions, g.player.pos);
      g.renderer.setAnimationLoop(() => drawWeather(g.scene, g.camera));
      return { lifted, thrown, radius, funnel: w.funnel.visible, debris: w.fragments.count, spot, exposed: w.exposed };
    });
    await page.screenshot({ path: '../browser-tests/s24-tornado.png' });
    assert.equal(storm.funnel, true, JSON.stringify(storm));
    assert.equal(storm.lifted, true, JSON.stringify(storm));
    assert.equal(storm.thrown, true, JSON.stringify(storm));
    assert.ok(storm.radius > 3 && storm.debris > 35, JSON.stringify(storm));
    assert.deepEqual(errors, []);
    console.log('S24 / WEATHER PASSED', storm);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
