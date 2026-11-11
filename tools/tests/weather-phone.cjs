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
    const cloud = await page.evaluate(() => {
      const g = BUNG, source = g.weather.clouds[0].material;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x202020);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
      camera.position.z = 3;
      const sprite = new THREE.Sprite(source);
      sprite.scale.set(2, 2, 1);
      scene.add(sprite);
      const size = 192, target = new THREE.WebGLRenderTarget(size, size);
      const pixels = new Uint8Array(size * size * 4);
      try {
        g.renderer.setRenderTarget(target);
        drawWeather(scene, camera);
        g.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      } finally {
        g.renderer.setRenderTarget(null);
        target.dispose();
      }
      let min = 255, max = 0, chroma = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const low = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
        const high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
        min = Math.min(min, low);
        max = Math.max(max, high);
        chroma = Math.max(chroma, high - low);
      }
      return { min, max, chroma, opacityOnly: !source.map && !!source.alphaMap?.isDataTexture };
    });
    assert.ok(cloud.opacityOnly && cloud.max - cloud.min > 20, JSON.stringify(cloud));
    assert.equal(cloud.chroma, 0, JSON.stringify(cloud));
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
      g.renderer.render = drawWeather;
      g.renderer.setAnimationLoop(() => drawWeather(g.scene, g.camera));
      return { lifted, thrown, radius, funnel: w.funnel.visible, debris: w.fragments.count, spot, exposed: w.exposed };
    });
    await page.screenshot({ path: '../browser-tests/s24-tornado.png' });
    assert.equal(storm.funnel, true, JSON.stringify(storm));
    assert.equal(storm.lifted, true, JSON.stringify(storm));
    assert.equal(storm.thrown, true, JSON.stringify(storm));
    assert.ok(storm.radius > 3 && storm.debris > 35, JSON.stringify(storm));
    const extreme = await page.evaluate(() => {
      const g = BUNG, w = g.weather, z = g.zone;
      g.renderer.setAnimationLoop(null);
      w.drill(true, 5);
      w.exercise.time = 151;
      const f = weatherModel.weatherAt(w.seed, w.exercise.time, w.exercise), t = f.tornado;
      let spot, startDistance;
      for (const distance of [165, 185, 210, 230]) {
        for (let i = 0; i < 32; i++) {
          const a = i * Math.PI / 16, x = t.x + Math.cos(a) * distance, zz = t.z + Math.sin(a) * distance;
          const y = z.groundAt(x, zz), pos = new THREE.Vector3(x, y, zz);
          if (z.terrain.isWater(x, zz) || !motion.positionClear(pos, .7, z) || g.indoorCeiling(x, y + 1, zz)) continue;
          if (g.cameraClearance(new THREE.Vector3(x, y + 1.55, zz), new THREE.Vector3(0, 1, 0), 8) < 7.95) continue;
          const away = new THREE.Vector3(Math.cos(a - .82), .35, Math.sin(a - .82)).normalize();
          if (g.cameraClearance(new THREE.Vector3(x, y + 5, zz), away, 70) < 67) continue;
          spot = pos;
          startDistance = distance;
          break;
        }
        if (spot) break;
      }
      if (!spot) throw Error('Could not find an exposed EF5 launch position');
      g.player.teleport(spot);
      w.sampleIn = 0;
      w.update(0);
      g.phone.update(1);
      const alert = g.phone.alert.textContent;
      const alertVisible = !g.phone.alert.hidden;
      const start = g.player.pos.clone();
      let maxHeight = 0, carHeight = 0, maxRange = 0;
      const flying = new Set();
      for (let i = 0; i < 252; i++) {
        g.player.update(1/30);
        w.update(1/30);
        maxRange = Math.max(maxRange, Math.hypot(g.player.pos.x - start.x, g.player.pos.z - start.z));
        maxHeight = Math.max(maxHeight, g.player.pos.y - start.y);
        for (const s of z.cityLife.services) if (s.stormFlight) {
          flying.add(s.id);
          carHeight = Math.max(carHeight, s.model.position.y - z.groundAt(s.model.position.x, s.model.position.z));
        }
      }
      const damaged = [...w.stormDamage.active.values()].filter(r => r.amount > .35);
      const record = damaged[0];
      const [position, offset] = record?.building.ranges[0] || [];
      const wallMoved = position && record.original[0].some((value, i) => value !== position.array[i + offset]);
      const tv = w.frame.tornado, floor = z.groundAt(tv.x, tv.z);
      g.camera.position.set(tv.x + 460, floor + 76, tv.z + 390);
      g.camera.lookAt(tv.x, floor + 124, tv.z);
      w.drawAtmosphere(w.frame, w.conditions, g.player.pos);
      g.renderer.setAnimationLoop(() => drawWeather(g.scene, g.camera));
      return {
        alert, alertVisible, startDistance, maxHeight, maxRange, flying: flying.size, carHeight,
        damage: damaged.length, wallMoved, sky: w.sky.visible,
        darkened: z.sun.intensity < w.base.sun * .60 && w.hemi.intensity < w.base.hemi * .75,
      };
    });
    await page.screenshot({ path: '../browser-tests/s24-ef5.png' });
    assert.match(extreme.alert, /EF5 tornado on ground.*Very large hail/);
    assert.ok(extreme.alertVisible && extreme.sky && extreme.darkened && extreme.maxHeight > 25 && extreme.maxRange > 140, JSON.stringify(extreme));
    assert.ok(extreme.flying > 0 && extreme.carHeight > 10 && extreme.damage > 5 && extreme.wallMoved, JSON.stringify(extreme));
    const coverage = await page.evaluate(() => {
      const g = BUNG, w = g.weather, f = w.frame;
      g.renderer.setAnimationLoop(null);
      const width = 432, height = 256;
      const target = new THREE.WebGLRenderTarget(width, height);
      const storm = new Uint8Array(width * height * 4), clear = new Uint8Array(storm.length);
      const camera = g.camera.clone();
      const speed = Math.hypot(f.vx, f.vz);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.position.set(f.x + f.vx / speed * 4400, 100, f.z + f.vz / speed * 4400);
      camera.lookAt(f.x, 980, f.z);
      try {
        g.renderer.setRenderTarget(target);
        drawWeather(g.scene, camera);
        g.renderer.readRenderTargetPixels(target, 0, 0, width, height, storm);
        w.sky.visible = false;
        drawWeather(g.scene, camera);
        g.renderer.readRenderTargetPixels(target, 0, 0, width, height, clear);
      } finally {
        w.sky.visible = true;
        g.renderer.setRenderTarget(null);
        target.dispose();
      }
      let distinct = 0;
      const tones = new Set();
      for (let i = storm.length / 2; i < storm.length; i += 4) {
        if (Math.abs(storm[i + 1] - clear[i + 1]) > 28) distinct++;
        tones.add(storm[i + 1]);
      }
      return { visibleSkyChange: distinct / (width * height / 2), tones: tones.size };
    });
    assert.ok(coverage.visibleSkyChange > .25 && coverage.tones > 35, JSON.stringify(coverage));
    const animation=await page.evaluate(async()=>{
      const {createFunnel}=await import('/src/weather/stormSky.js');
      const mesh=createFunnel(),scene=new THREE.Scene();scene.background=new THREE.Color(0x96bacc);scene.add(mesh);
      mesh.scale.set(1,2,1);
      const u=mesh.material.uniforms;u.reach.value=1;u.density.value=1;u.wedge.value=1;u.morph.value=.73;
      const camera=new THREE.PerspectiveCamera(48,1,.1,50);camera.position.set(5,2.1,5);camera.lookAt(0,1,0);
      const size=160,target=new THREE.WebGLRenderTarget(size,size),first=new Uint8Array(size*size*4),next=new Uint8Array(first.length);
      const g=BUNG;
      try{
        g.renderer.setRenderTarget(target);
        u.time.value=0;drawWeather(scene,camera);g.renderer.readRenderTargetPixels(target,0,0,size,size,first);
        u.time.value=.8;drawWeather(scene,camera);g.renderer.readRenderTargetPixels(target,0,0,size,size,next);
      }finally{g.renderer.setRenderTarget(null);target.dispose();mesh.geometry.dispose();mesh.material.dispose();mesh.userData.dispose();}
      let moving=0,dark=0;
      for(let i=0;i<first.length;i+=4){if(Math.abs(first[i]-next[i])+Math.abs(first[i+1]-next[i+1])+Math.abs(first[i+2]-next[i+2])>6)moving++;if(first[i]<65&&first[i+1]<65&&first[i+2]<65)dark++;}
      return {moving:moving/(size*size),dark:dark/(size*size)};
    });
    assert.ok(animation.moving>.025&&animation.dark>.04,JSON.stringify(animation));
    assert.deepEqual(errors, []);
    console.log('S24 / WEATHER PASSED', { cloud, storm, extreme, coverage, animation });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
