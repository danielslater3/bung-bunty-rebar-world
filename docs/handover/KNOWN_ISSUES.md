# Known issues

**30 October update:** this file preserves the earlier observations. See [the implemented quality pass and verification limits](../QUALITY_PASS.md) for the subsequent navigation, chase, surface, camera, garage, delivery and save-continuation fixes. The original descriptions below are historical; they are not all current symptoms.

Status values: **resolved**, **partially resolved**, **outstanding**. Nothing below is marked resolved. Browser checks cited here were scripted sessions against a local static server on 29 October 2026, build queries `20261030d` / dialogue camera `20261030c`, before and during the commit that became `18a494e`. They are not a from-scratch human play of all four chapters, and they were not repeated against the live GitHub Pages URL after publish.

Do not raycast `zone.group` while fixing cameras. That was the 3 fps bug fixed in `0fc9adb`.

## BUG A — Indoor gameplay camera

**Status:** partially resolved.

**Symptoms reported:** the third-person camera rendered outside the building, clipped walls, or failed to frame Bung.

**What the code does now:** `Game.indoorCeiling` and `Game.indoorRoom` box-test `house.rooms` and McRebar's `inside` polygon. Indoors, pitch is capped near 0.08 and distance is capped at 3.4 on foot or 4.6 while riding. `cameraClearance` shortens the boom against `zone.colliders` boxes. The damped position is shortened again if the segment from the target to the camera hits a box. Ceiling height clamps `camPos.y`.

**Likely remaining cause:** clearance only sees boxes. A window, a missing wall, or a doorway still shows the street. The camera can sit in a neighbouring AABB if the player stands near the house/garage boundary. It does not sweep a sphere along the whole boom against mesh triangles.

**Files:** `src/core/Game.js` (`updateCamera`, `indoorRoom`, `indoorCeiling`, `cameraClearance`), `src/story/house.js` (`rooms`), `src/story/mcrebar.js` (`inside`).

**Reproduce:** New Saga. Walk the bedroom, living room, garage, and McRebar with the mouse pitched up and the character in a corner and in a doorway.

**Expected:** the camera stays in the room the player is in, frames the body, and shortens rather than passing through a solid wall.

**Actual:** indoors, the boom shortens and the height stays under the ceiling in the rooms that were measured. Doorways and windows still show outside, which is correct for an opening and wrong for a hole in the mesh. Not every corner has been photographed.

**Fix:** keep the box test. Add doorway volumes if a room needs a view into the next room. Do not add the room box to `colliders`. If a specific wall fails, add a collider box for that wall only.

**Test:** stand in each room, orbit the mouse, screenshot, confirm camera `y` is under that room's `ceil` and the xz is inside the room or a declared doorway.

**Priority:** high, whenever a new interior is built. The old "camera in the sky outside the house" failure mode is the one the box clamp was written for.

## BUG B — Cinematic dialogue camera

**Status:** partially resolved.

**Symptoms reported:** conversations did not frame the speaker, and shots went outside buildings.

**What the code does now:** `DialogueSystem.conversation` sets `cinematic: true` and a line index. `say()` does not. `Game.frame` skips `updateCamera` while cinematic and calls `Saga.frameDialogue` → `dialogueCam.frameDialogue`. The shot is placed on the speaker's face side (toward the partner), rejected if it is inside a collider, outside the room, too close to the partner, or behind the face. Cutscenes use `aimCamera`, the same function. `endScene` does not call `snapCamera`.

**Evidence:** bedroom Gabor close-up, camera y 7.87 under ceiling 8.91, look-dot on Gabor about 1. McRebar Gabor close-up inside the tenancy, camera y 15.54 under 16.75. Queen Street outdoor close-up, `indoorRoom` null. Ching in the bedroom, inside, look-dot 0.985. Garage conversation, camera inside the garage room AABB. A bark left FOV at 68 and `cinematic` false.

**Remaining gaps:** acting is a head nod, a mouth scale, and one arm. Wide shots only when `line.i % 4 === 0`. A legal shot can still look out a window. Characters brought in by `present()` appear 1.4 m in front of Bung if they were hidden, which is a pop, not a walk-in. Not every story scene in chapters 3–24 was shot.

**Files:** `src/story/dialogueCam.js`, `src/systems/DialogueSystem.js`, `src/core/Game.js` `frame`, `src/story/Saga.js` `aimCamera` / `beginScene` / `endScene`, `src/entities/models.js` (`userData.head`, `mouth`, `armR`).

**Reproduce:** New Saga. Let the opening play. Talk to Gabor outdoors and inside McRebar. Trigger a `say()` bark (use the shelf when it is not the current step). Confirm FOV stays near 68.

**Expected:** scripted lines frame the speaker, inside the room, then return to the gameplay camera. Barks do not.

**Actual:** the cases above matched that. Unlisted scenes are unverified.

**Fix:** extend shots only when a specific scene fails the room test. Do not enable cinematic on `say`.

**Test:** one screenshot per speaker per room, plus one bark with FOV still 68.

**Priority:** medium. The system exists. New scenes should use `conversation`, not a new camera.

## BUG C — Navigation arrow

**Status:** partially resolved.

**Symptoms reported:** the gold chevron flipped, pointed through buildings, or aimed the wrong way.

**What the code does now:** `buildGuide` makes a chevron whose point is local -Z. `updateGuide` sets `rotation.y` to `heading + PI`, with `dampAngle`. Street routes use a locked segment on `ROUTES`. Chase routes use the polyline tangent and a 4 m direction latch. Off-route by more than 14 m, the arrow aims at the closest point on the route, which can point across a block. `destination()` returns null when `state.saga.chapter > 3`, so chapters 5–24 do not get this street guide.

**Evidence:** during a chapter 2 follow, moving Bung backward along the path changed arrow yaw by about 0.14 rad (a tangent change, not a half-turn). Adding π to `camYaw` changed arrow yaw by about 0.01 rad. The arrow was on screen in the chase screenshot.

**Remaining gaps:** no runtime street graph. Stale `ROUTES` if `PLACE` moves. The >14 m shortcut aim. Chapters after 4 have no street arrow. Ring pads in chapter 3 may not lie on a route. Not driven in the trolley through every baked route in this handover.

**Files:** `src/story/guide.js`, `src/story/routes.js`, `src/story/chase.js` `projectAlong`.

**Reproduce:** Chapter 1, leave the garage, follow the arrow to McRebar on foot and in the trolley. Chapter 2 follow, drive backward for a second, spin the mouse.

**Expected:** the arrow points along the next street segment, stays stable, and works on foot and in the trolley.

**Actual:** chase behaviour matched the hysteresis test. The West End to Queen Street drive was not re-run end to end for this document.

**Fix:** if a route is wrong, replace that polyline in `routes.js` using the existing road graph offline. Do not aim the arrow at the raw destination when a route exists. Keep the segment lock.

**Test:** record arrow yaw while walking backward and while spinning the camera. Walk one full `gate>door` trip and confirm the arrow does not cross a known building.

**Priority:** high for any route that still cuts a block. Medium for the chase arrow, which has a tested latch.

## BUG D — Gabor chase path

**Status:** partially resolved.

**Symptoms reported:** Gabor drove through buildings and became unreachable. The intended route is Queen Street toward the Apple Store area.

**What the code does now:** `CHASE_PATH` is 35 points from `(146.4, 90.0)` to `(358.4, -64.7)`. `moveGabor` sets his position from `pointAlong`. He does not steer freely. Speed about 4.4 m/s on follow and 9 m/s on catch. He stops if the player is more than 36 m behind, and the HUD says he is waiting. A return to the start restarts him on the street. Chapter 2 catch reverses the path. Chapter 3 catch does not. End point is the street approach near shop node `(371.82, -65.92)`, not the node itself.

**Evidence:** scripted frames kept him on the polyline, completed follow into step `bag` when Bung was within range at the end, and completed a riding catch into `relic`. A screenshot showed him on the mall paving between buildings.

**Remaining gaps:** mall furniture can still block the trolley even when the polyline is clear. The 14 m off-route arrow can point through a block. No human drove the full chase in the trolley, missed a turn, and recovered. Despawn is not used, but the restart snap is a teleport back to the start when the player has already lost him and gone back.

**Files:** `src/story/sagaData.js` `CHASE_PATH`, `src/story/Saga.js` `moveGabor`, `chasePts`, `check`, `src/story/chase.js`.

**Reproduce:** Chapter select or play into chapter 2 step `follow`. Ride the trolley down the mall. Stop and let him wait. Go back to McRebar and confirm he returns to the start.

**Expected:** he stays on the mall and the street, can be caught, and does not enter a building.

**Actual:** the polyline constraint held in the scripted session. Full drivability is unproven.

**Fix:** if a sample is inside a collider, the 1.4 m skip already exists. If the trolley cannot follow, move the polyline onto the driveable centre, do not give Gabor free steering.

**Test:** plot his xz every second against `CHASE_PATH` and against footprint hits. Then ride the route once without teleporting the player.

**Priority:** high until one full trolley chase is completed by playing, not by setting `player.pos`.

## BUG E — Chase distance HUD

**Status:** partially resolved.

**Symptoms reported:** no reliable metre readout.

**What the code does now:** `moveGabor` calls `hud.chaseHud` with `metres` rounded from the along-route gap when the player is within 12 m of the polyline, otherwise the straight-line gap. DOM: `#chase-name` is the literal `GABOR MIHALA`, `#chase-dist` is `N m AWAY`, `#chase-note` is the wait / catch / Apple line. Off-screen pin `#chase-pin` hides when the target projects inside the view or the gap is under 5 m. Cutscenes call `chaseHud(null)` and hide it.

**Evidence:** the HUD read `27 m AWAY` immediately after a scripted run and `37 m AWAY` with `HE IS WAITING ON QUEEN STREET` after real time passed and Bung did not follow.

**Remaining gaps:** the number is along-track only when close to the line. A player on a parallel street sees straight-line distance, which can under-count the walk. The pin was not screenshot-tested off-screen.

**Files:** `src/story/Saga.js` `moveGabor`, `src/ui/HUD.js` `chaseHud`, `index.html`, `styles.css`.

**Reproduce:** start `follow`, watch the number while closing and while standing still.

**Expected:** the number tracks real positions and changes every moment he moves.

**Actual:** it did in the session above. It is not a constant.

**Fix:** only if a capture shows a stale number. Prefer route distance once the player is on the polyline.

**Test:** log `gaborDist`, player projection, and `#chase-dist` for a few seconds. They should move together.

**Priority:** low unless a new capture shows a stuck number.

## BUG F — Fading trail

**Status:** partially resolved.

**Symptoms reported:** no trail, or a trail that cut through buildings.

**What the code does now:** `dropTrail` places a pooled sphere on Gabor's current xz at `y + 0.48` when he has moved at least 3.1 m. Life 8.5 s. Opacity and scale fade in `tickTrail`. 48 slots. Colour `#ff9a1a`. He only drops while `gaborSpeed > 0.4`, and his position is the polyline sample, so the markers follow the path he took. They are not a line to his current position. `clearTrail` runs on restart and when leaving the chase steps.

**Evidence:** one chase screenshot showed several orange markers on the mall ahead of Bung, distinct from the gold arrow. An earlier, smaller marker (radius 0.12, 3.6 s life) was hard to see and was replaced before commit `18a494e`.

**Remaining gaps:** 8.5 seconds at 4.4 m/s is about 37 m of trail. A player who waits longer sees it vanish, which is the design, and can feel like "no trail" if they look too late. Markers are not individually tested against walls. They inherit his position, so they stay on the path unless the path itself is wrong. They can sit in a doorway if the path does.

**Files:** `src/story/chase.js`.

**Reproduce:** follow within 20 m so he keeps moving. Look at the paving behind him.

**Expected:** markers appear along the travelled path and fade.

**Actual:** they did in one inspected frame. A long pursuit was not filmed.

**Fix:** lengthen life only if playtests show the trail dying before a following player reaches it. Do not draw a straight ribbon to Gabor.

**Test:** count visible pool entries and confirm each xz is within a metre of the polyline.

**Priority:** medium. Confirm by riding, not by another radius tweak.

## BUG G — Trolley stuck in the garage

**Status:** partially resolved for the trap, outstanding as an architectural overhaul.

**Symptoms reported:** the trolley could not leave a too-small garage.

**What the code does now:** garage width 7.6 m, west opening 3.6 m, door collider removed once the hinge passes 0.75 rad, driveway west then north to the gate because the north side is a real building. Trolley collision radius 0.8. Chapter 1 `onGarage` opens the door and summons the trolley inside.

**Remaining gaps:** the workshop is still a bench, a rack, two drums, and a sign. One comment in `house.js` says "north door" while the door is on the west wall. No fresh enter / reverse / exit / park recording was made for this handover. The previous reconstruction commit (`381d871`) claimed the trolley could leave. That claim was not re-verified on `18a494e`.

**Files:** `src/story/house.js` garage block, `src/story/Saga.js` `tickGarage` / `onGarage`, `src/entities/Trolley.js`.

**Reproduce:** New Saga. Reach the garage step. Summon, mount, reverse out, drive to the gate, drive back in, dismount.

**Expected:** the door opens, the blocker is gone, the trolley fits, the driveway meets the street.

**Actual:** geometry for that exists. The drive was not repeated for this document, so the trap stays partially resolved rather than closed.

**Fix:** if the drive fails, move the summon point (`PLACE.garage` is set in `buildHouse`) or the door width. Do not shrink the trolley.

**Test:** the four-part drive above, with the door collider absent from `zone.colliders` while open.

**Priority:** high until that drive is done once on the current build.

## BUG H — West End house

**Status:** outstanding as a quality target. A playable shell exists.

**Symptoms:** rooms read as prototype boards. No bathroom. Clothing and relics are only partly physical.

**What exists:** bedroom, bed interact, living couch, kitchen light, wardrobe doors and a hanging singlet, cupboard with five generic bars and a hidden emerald cylinder, exterior sign, point lights. `setBungKit` shows the uniform after the wardrobe step. Emerald mesh visibility is toggled from relics. Golden Mini and Platinum are strings in `state.saga.relics` only.

**Files:** `src/story/house.js`, `src/entities/models.js` `setBungKit`, `src/story/Saga.js` `onWardrobe`, `onShelf`, `syncKit`.

**Expected:** a house with a bathroom, a cupboard whose clips match the relics Bung has, and a wardrobe interaction that is obviously changing his mesh.

**Actual:** the uniform toggle works in code. The relics do not all have meshes. There is no bathroom.

**Fix:** add a bathroom inside the existing footprint or a clearly attached room, and spawn relic meshes from `state.saga.relics` in the cupboard. Keep the floor on `saga.ground`.

**Test:** chapter 1 wardrobe before and after. Chapter 4 shelf with the emerald visible. Screenshot both.

**Priority:** high for the chapter 1–4 quality pass. Not a blocker for the chase.

## BUG I — McRebar accuracy

**Status:** outstanding.

**Symptoms:** the restaurant does not match the supplied exterior photo, floor plan, or interior photo.

**What exists:** a tenancy on the real OSM frontage, black podium materials, a terrace, a gold rebar arch, two kiosks, tables, a counter, ceiling, and the name McREBAR. Floor y is the constant 13.9. Layout follows the plan's zones only approximately. The plan has no scale bar. The frontage length in code is the OSM edge, about 18.6 m.

**References:** not in git. See `REFERENCES.md`. Do not copy trademark logos into the repo or onto the mesh. The arch stays a rebar arch.

**Files:** `src/story/mcrebar.js`, `src/world/geo/cbdFronts.js` for neighbouring fictional signs.

**Expected:** black corner podium, terrace, mall-level retail below, restaurant level above, interior zones from the plan (front seating, young-adult tables, communal table, order, collect, kitchen), kiosks and a perforated ceiling in the spirit of the interior photo, signage McREBAR / 130 Queen Street.

**Actual:** a simplified version of that list. It has not been accepted as a match to the photographs.

**Fix:** remodel `buildMcRebar` against images the owner re-supplies. Keep `mcrebarPoint`, `insideMcRebar`, floor height, and the door on the mall edge unless a measurement says the door is elsewhere.

**Test:** exterior screenshot from the mall, interior screenshot from the counter, compare to the three references. Confirm `indoorRoom` still returns the bar and the dialogue camera stays under `ceil`.

**Priority:** high for the environment phase.

## BUG J — Chapters 2–4 quality and testing

**Status:** outstanding. Chapter 2's chase systems are partially tested. Chapters 3 and 4 were not played through after the chase work.

**Symptoms:** objectives exist, so a build can look finished while the activity is still "press E" or a timing bar.

**Chapter 2:** follow, bag, confront, catch, and relic are implemented. See `CHAPTERS_1_TO_4.md` for what the scripted session showed. The missing test is a human trolley chase with a missed turn.

**Chapter 3:** part pickups, a speed-flag repair, three ring coordinates that may not be on the street, then another catch. No playthrough recorded for this handover.

**Chapter 4:** lawn, scanner dialogue, disguise mesh, pedestal id check, distance-based guard, shelf. No playthrough recorded.

**Files:** `sagaData.js`, `Saga.js`, `missions.js` (not used for these four chapters' custom kinds), `mcrebar.js` `buildCollectorLawn`.

**Expected:** each chapter can be finished by playing, the failure rules are visible, and the scenes match the descriptions in `CHAPTERS_1_TO_4.md`.

**Actual:** the step machine is wired. Chapters 3 and 4 are unproven on the current build. Animations are pose tweens, not acting.

**Fix:** play them in order. File a new issue row when something blocks completion. Do not add chapter 5 content to paper over a block.

**Test:** New Saga, finish chapters 1–4 without setting `state.saga.step` from the console. Note every stuck objective.

**Priority:** highest for judging whether the campaign is actually playable.

## Other debt

- Root `README.md` still describes the sandbox and a CDN build. The handover banner at the top is the correction. The rest was left so old controls documentation remains.
- `data/geo/PROVENANCE.md` says no terrain model was loaded. `terrain.js` and `brisbane.data.js` `meta.verticalDatum` disagree. Trust the data module.
- `guide.js` street routes turn off after chapter index 3.
- `SCOOTER_PATH` and `ESCORT_PATH` are short chords for later chapters, not validated the way `CHASE_PATH` was.
- Ring coordinates are a separate, older polyline.
- Camera far plane is 600. Distant bridges can clip.
- There is no automated test suite. A clean `node --check` does not mean a mission is finishable.
- `startGame(true, ...)` deletes the save. Free Roam does too.
