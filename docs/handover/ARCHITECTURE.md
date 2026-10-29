# Architecture

Grounded in the tree at commit `18a494e`. If a file and this document disagree, the file wins.

## Lifecycle

`index.html` holds the HUD DOM, the import map, and `<script type="module" src="src/main.js?v=...">`.

`src/main.js` constructs `Game`, assigns `window.BUNG`, sets `mode = 'menu'`, calls `menus.showMain()`, and loads the mansion zone as a backdrop.

`Game` (`src/core/Game.js`) owns the renderer, scene, camera, clock, and the systems below. `renderer.setAnimationLoop` calls `frame()`:

1. `elapsed += dt`.
2. `updatePlaying(dt)` when `mode === 'playing'` (player, trolley, zone, quests, shop, enemies, collectibles).
3. Cutscene mode still ticks the zone and `dialogue.update`.
4. `saga.update(dt)` in playing and cutscene.
5. Autosave every 30 seconds while playing or paused.
6. Gameplay camera via `updateCamera`, unless `mode === 'cutscene'` or `dialogue.cinematic`.
7. If a playing-mode line is cinematic, `saga.frameDialogue(dt)` instead.
8. When a cinematic line ends, `saga.resetTalk()`.
9. `fx.update`, `input.endFrame`, `renderer.render`.

Modes: `menu`, `playing`, `paused`, `cutscene`. A paused game still runs `updateCamera`. A cutscene does not, unless dialogue's `aimCamera` moves it.

`startGame(fresh, mode)` in `Game`:

- `fresh === true` calls `SaveSystem.reset()`, which **deletes the localStorage save** and replaces in-memory `state`.
- `mode === 'saga'` sets `state.saga = createSaga()` when starting fresh, then `saga.resume`.
- `mode === 'roam'` leaves saga inactive.
- Chapter select calls `startGame('keep', 'saga')` after mutating `state.saga.chapter`. The string `'keep'` is not `true`, so it does not reset.

## System ownership

| Concern | Owner | Also touches |
| --- | --- | --- |
| Loop, zones, damage, gameplay camera | `Game` | `Saga`, `Player`, `Trolley` |
| Keyboard, pointer lock | `src/core/Input.js` | camera yaw/pitch in `Game.updatePlaying` |
| Save, coins, flags, saga blob | `src/core/state.js` `state`, `SaveSystem`, `bus` | almost everything |
| Synth music, sfx, voice beeps | `src/core/AudioManager.js` | `DialogueSystem.voice` |
| Particles | `src/core/FX.js` | trolley trail, hits |
| Math, `mat()`, `damp`, `dampAngle` | `src/core/utils.js` | models, camera, chase |
| Bung body and input | `src/entities/Player.js` | `models.buildBung` |
| Trolley | `src/entities/Trolley.js` | `models.buildTrolley`, `trolleySpec` |
| Procedural characters and props | `src/entities/models.js` | Player, Saga, Trolley |
| Pickups | `src/entities/Collectible.js` | zone spawners |
| Enemies | `src/entities/Enemies.js` | sandbox zones |
| World NPCs (older) | `src/entities/NPC.js` | zones, not the saga cast |
| Subtitles | `src/systems/DialogueSystem.js` | `Game.say`, `Saga` conversations |
| Cinematic shots | `src/story/dialogueCam.js` `frameDialogue`, `resetTalk` | `Game.frame`, `Saga.aimCamera` |
| Sandbox quests | `src/systems/QuestSystem.js` | roam mode |
| Shop | `src/systems/ShopSystem.js` | pause menu |
| Combo | `src/systems/ChainManager.js` | portals |
| Sandbox bosses | `src/systems/BossEvents.js` `GaborChase` | Brisbane zone, separate from saga chase |
| Graded rebar yard | `src/systems/Rebirth.js` | archive |
| Saga campaign | `src/story/Saga.js` | sagaData, house, mcrebar, guide, chase, missions |
| Chapter table | `src/story/sagaData.js` | every saga importer |
| Chase polyline helpers and trail | `src/story/chase.js` | `Saga.moveGabor`, `guide.js` |
| Street arrow | `src/story/guide.js` | baked `src/story/routes.js` |
| West End house | `src/story/house.js` `buildHouse` | zone boxes |
| McRebar and collector lawn | `src/story/mcrebar.js` | `PLACE.mcrebar` mutated at runtime |
| Chapters 5–24 mission kinds | `src/story/missions.js` | saga `update` |
| Lore cards | `src/lore/universe.js` | menus, districts |
| HUD | `src/ui/HUD.js` | `#chase-hud`, quest tracker |
| Menus | `src/ui/Menus.js` | chapter select |
| Zones | `src/world/zones.js` | lazy `buildOsmBrisbane` |
| Zone primitives | `src/world/ZoneKit.js` | `box`, colliders, interactables |
| Brisbane mesh | `src/world/geo/buildCity.js` `buildOsmBrisbane` | data, terrain, facades |

## Major data

`state` (`src/core/state.js`):

- Vitals: `stability`, `energy`, `fuel`.
- Currencies: `coins`, `rebars`, `shards`, `score`.
- `upgrades`, `buffs`, `flags`, `stock`, `archive`.
- `trolley` id, default `'james'`.
- `places[zoneName]` last position. `picked` collected world items.
- `quests` for the sandbox chain.
- `saga` or `null`. Shape from `createSaga()` in `sagaData.js`: `active`, `chapter` (**0-based index**), `step`, `stepState`, `done` (chapter ids), `relics`, `bigBoy`, `trolleyDamage`, `phone`, `companion`, `evidence`, `fortune`, `saves`, `mansion`, `legend`, `intermission`.

`CHAPTERS[n].n` is the 1-based chapter number. `state.saga.chapter === 0` is chapter 1. `chapter === 1` is chapter 2. The chase reverse test uses `chapter === 1`.

`PLACE` is a mutable object. `buildHouse` overwrites `PLACE.gate` and `PLACE.garage`. `buildMcRebar` moves `PLACE.mcrebar` onto the order counter. Every module must import the **same** `sagaData.js` URL or those writes are invisible to the others.

`zone` after a load:

- `group`, `colliders` (array of `THREE.Box3`), `interactables`, `sampleGround(x, z)`, `spawn`.
- Brisbane also has footprint helpers from `footprints.js`.

`actors` on the saga (built in `Saga.dress`, Brisbane only): `house`, `bar`, `gabor`, `ching`, `scooter`, `bag`, `guide`, lawn props, mansion props when built. `onZone()` nulls `actors` and `_trail`.

## Cameras

Gameplay: `Game.updateCamera`. Target is the player chest or the trolley. Distance 6.4 on foot, 8.2 riding. Yaw is `camYaw` from the mouse. Riding eases yaw behind `trolley.heading + Math.PI`. Indoors, `indoorCeiling` caps pitch and distance. `cameraClearance(origin, dir, far)` ray-tests **`zone.colliders` boxes only** and shortens the camera. It must not call `intersectObject(zone.group)`.

Dialogue: `dialogueCam.frameDialogue`. Runs when `dialogue.current.cinematic` is true. `conversation()` sets that flag. `say()` does not. Shots are damped (`damp` lambda about 4.2). FOV 40 close, 50 on wide lines (`line.i % 4 === 0` with a partner), 46 for narrator speakers. Indoor containment uses the house room AABB or `clampMcRebar`. Clearance uses the same box ray. Cutscenes call `Saga.aimCamera`, which is the same function. `endScene` does not snap the camera.

## Player and trolley

`Player.pos` is at the feet. `radius` 0.55. Gravity 26. Run 6.2 m/s, sprint 10 plus upgrades. `teleport()` copies both `pos` and `mesh.position`. `animate()` overwrites `mesh.rotation.y` from velocity while playing, before dialogue facing runs. Forward is local +Z: `(sin(heading), 0, cos(heading))`. Heading 0 looks toward +Z (south). Heading `-PI/2` looks west.

`Trolley` max speed is `(18 + turbo upgrades) * spec.speed * (boost ? 1.55 : 1)`, times 0.42 when `state.saga.trolleyDamage`, times 1.32 when `state.saga.bigBoy`. Reverse is clamped at -7. Collision radius used in movement is **0.8**. Summon with `T`, or `trolley.summon()` from the chapter 1 garage step. `state.flags.trolleyUnlocked` gates summoning from the garage step.

Big Boy Mode does not swap the mesh. `setBungKit(mesh, { uniform, disguise })` shows or hides the singlet group and the janitor group. Disguise is applied only when `state.saga.chapter === 3` (chapter 4) and `stepState.disguise` is set.

## Dialogue and cutscenes

`DialogueSystem.say(speaker, text)` pushes a bark with no `cinematic` flag. `conversation(lines, onEnd)` maps `[speaker, text]` to `{ speaker, text, dur, cinematic: true, i }` and starts immediately. Duration is `max(2.4, text.length * 0.05)` seconds. `E` skips when more lines are queued. `cinematic` getter is `!!current?.cinematic`.

`Saga.beginScene` sets `mode = 'cutscene'`, disables input, and plays `step.lines`. `endScene` returns to playing and, if the new step is also a scene, advances. `playPose` freezes the player for bed, wardrobe, cupboard, and mop animations.

Hidden cast members can be placed 1.4 m in front of Bung by `dialogueCam.present` when they are the speaker and not already nearby. They are flagged `userData.camBrought` and hidden again in `resetTalk`. A visible Gabor is not teleported during follow/catch.

## Chase and guide

`Saga.moveGabor` runs on steps whose `kind` is `follow` or `catch`. Position comes from `pointAlong(chasePts(), gaborDist)`. He cannot leave the polyline.

- Follow cruise 4.4 m/s, times 1.28 when straight-line gap is under 9 m.
- Catch cruise 9 m/s, times 1.22 when close.
- Speed target 0 when the player is more than 36 m behind along the route (or by straight distance if the player is more than 22 m off the line), and at the end of the path.
- If the player has been far behind and then returns near the start (`ride.dist < 7`, `off < 8`, `gaborDist > 40`), Gabor snaps back to the start of the current direction and the trail clears. That is the restart, not a mid-chase teleport.
- `chasePts()` returns `CHASE_PATH` reversed only when `state.saga.chapter === 1` and the step kind is `catch`. Chapter 3's catch stays on the forward path.

`updateGuide` (`guide.js`):

- During follow/catch, heading is the current segment tangent, with a 4 m hysteresis on direction so the arrow does not flip when distances jitter. Off the route by more than 14 m, it aims at the closest route point. Hidden within 3.2 m of Gabor. Spin lambda is 4 during a chase and 10 on streets. Mesh point is local -Z, so `rotation.y = heading + PI`. Chase arrows are raised, tilted (`rotation.x = -0.72`), and scaled by 1.55.
- Otherwise, chapters with index `> 3` get no street route (`destination()` returns null). Chapters 1–4 use `ROUTES` in `routes.js` for `reach` and `interact` targets that `directAim` recognises, plus ring/part destinations through other branches. Routes are pre-baked polylines, not a runtime A*.

`HUD.chaseHud` writes `#chase-dist` as `N m AWAY` and `#chase-note`. Metres prefer the along-route gap when the player is within 12 m of the polyline. An off-screen pin uses `camera.project`.

Trail: 48 pooled `MeshBasicMaterial` spheres in `chase.js`, radius 0.32, dropped every 3.1 m of Gabor's travel, life 8.5 s.

## Missions after chapter 4

`missions.js` `HANDLED` kinds: `escort`, `race`, `rhythm`, `photo`, `shards`, `trial`, `cricket`, `sky`, `dodge`, `snow`, `deliver`, `sequence`, `eyes`, `hold`, `visits`, `evidence`. `Saga.update` calls `tickMission` for the current step. Races still use `gaborT` as 0–1 along `SCOOTER_PATH`, which is a short chord list, not the Queen Street chase polyline.

## Zones

`src/world/zones.js` `ZONE_INFO` and `resolveBuilder`. Brisbane's builder is a dynamic import of `/src/world/geo/buildCity.js` then `buildOsmBrisbane`. That import is absolute, so it uses the import map. `zones.js` itself is loaded both relatively and through the map depending on the importer. Bumping a query on the map does not refresh a relative child.

Sandbox zones (`buildMansion`, Sydney, Hong Kong, Shenzhen, void) are still constructed for roam and the menu backdrop. The saga dresses only when `zone.name === 'brisbane'`.

## Import-map rules

Absolute specifiers that appear as keys in the `index.html` import map resolve to the mapped URL, including its `?v=`. Relative specifiers do not use the map.

Consequences:

- `Game.js` imports `./state.js`. That URL is the singleton. `import '/src/core/state.js'` from the page hits the map (`state.js?v=20261027f`) and can be a **second** `state` object. From `http://127.0.0.1:PORT/`, `import('./src/core/state.js')` matches Game's relative URL.
- All of `Saga.js`, `house.js`, `mcrebar.js`, `missions.js`, `Menus.js`, and `guide.js` must import `sagaData.js` with the same query.
- `Player.js` and `Saga.js` must import `models.js` with the same query if they need one Bung/Gabor constructor. The map's models entry is a separate copy used by absolute imports. That split is tolerated today because the saga uses the versioned relative URL.
- Changing a module requires bumping its query **and** the parent that imports it, plus the `Game.js` map entry and `main.js` query, or the browser keeps the old module.
- Do not add `?v=` to `state.js` imports inside `Game.js`.

## What a change breaks

- Moving `PLACE.*` without updating `ROUTES` sends the arrow along a stale polyline.
- Adding a room-sized box to `zone.colliders` makes `cameraClearance` and player push treat the whole room as solid. Ceilings are **not** colliders. `indoorCeiling` reads room AABBs.
- Importing `brisbane.data.js` from the boot path of a module the menu loads will parse a multi-megabyte module before the menu is useful. The saga chase polyline is copied into `sagaData.js` so the chase does not import the city mesh.
- `SaveSystem.save` writes the whole `state` object. Adding a required field is safe if `load()` tolerates it missing. Renaming `saga.chapter` or the localStorage key breaks existing saves.
- `animate()` runs before dialogue facing. Dialogue code that sets Bung's yaw must run after `Player.update`, which it does, in `frameDialogue`.

## File map (story and world)

```
index.html
styles.css
src/main.js
src/core/Game.js Input.js AudioManager.js FX.js state.js utils.js Debug.js
src/entities/Player.js Trolley.js models.js Collectible.js Enemies.js NPC.js Portal.js
src/systems/DialogueSystem.js QuestSystem.js ShopSystem.js ChainManager.js BossEvents.js Rebirth.js
src/story/Saga.js sagaData.js dialogueCam.js chase.js guide.js routes.js house.js mcrebar.js missions.js
src/ui/HUD.js Menus.js
src/lore/universe.js
src/world/zones.js ZoneKit.js rebirthZones.js
src/world/geo/buildCity.js brisbane.data.js brisbane.shops.js brisbaneDetail.js
src/world/geo/terrain.js drape.js facades.js footprints.js project.js aerial.js
src/world/geo/river.js bridges.js cbdFronts.js cbdStreets.js shopSigns.js
src/world/geo/sydney.js sydney.data.js hongkong.js hongkong.data.js renderDistrict.js
tools/compile_brisbane_geo.py compile_district.py bake_aerial.py enrich_brisbane.py
data/geo/PROVENANCE.md HONGKONG.md SYDNEY.md
vendor/three.module.js
```

`data/geo/PROVENANCE.md` describes the OSM compile and is **out of date on height**. It says no digital terrain model was loaded. `brisbane.data.js` `meta.verticalDatum` and `terrain.js` say the ground is the Queensland 2019 LiDAR DEM in metres AHD. Trust the data module and `terrain.js`.
