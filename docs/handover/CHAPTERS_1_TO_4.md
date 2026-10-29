# Chapters 1 to 4

`state.saga.chapter` is the 0-based index. `chapter().n` is 1-based. All four chapters set `playable: true`. That flag means the step list can run. It does not mean the art or the mission is finished.

Shared machinery:

- Steps live in `src/story/sagaData.js` `CHAPTERS`.
- Behaviour lives in `src/story/Saga.js` (`check`, `advance`, `beginScene`, `onBed`, `onWardrobe`, `onShelf`, `onGarage`, `onCounter`, `onGabor`, `onBag`, `onScanner`, `onMop`, `onPed`, `onPart`, `moveGabor`).
- `E` near an interactable calls the handler wired in `Saga.dress` / `interact`.
- A `scene` step calls `beginScene`: mode `cutscene`, input off, `dialogue.conversation(step.lines, endScene)`.
- `advance()` increments `step`, saves, and starts the next scene if the next step is a scene.
- Success of `reach` is horizontal distance under `step.radius` and vertical distance under 2.4 m from the floor (`bar.y` when the target is `mcrebar`).
- There is no separate failure state for chapters 1–3 except losing stability in the normal damage system. Chapter 4's `escape` step calls `caught()`, which plays a short conversation and sends Bung back toward the lawn. A wrong pedestal does not fail the chapter. It plays a denial conversation and stays on the step.
- Saves: `advance`, `finishChapter`, and `nextChapter` call `SaveSystem.save`. The saga blob is inside the normal save.

Locations are `PLACE` ids. Heights come from `Saga.ground` except McRebar's interior floor, which is 13.9.

## Chapter 1 — Origins

Index 0. Id `ch1`. Title `BUNG BUNTY: THE ORIGINS`. Start pad `bed`. Reward 40 coins. No relic.

### How it begins

`resume` places Bung at `PLACE.bed` inside the West End house and starts step `origin`, a scene. `syncKit` keeps the singlet **off** until `step > 2` or `stepState.uniform` is set. The opening is four lines: three `doc` lines (birth 3 March 1977, graduation 1995, the trolley) and one `bung` line. Narration uses the wider dialogue FOV (46), not a character close-up of a missing narrator mesh. The camera frames Bung for non-cast speakers.

### Steps

| Id | Kind | What the code does |
| --- | --- | --- |
| `origin` | `scene` at `home` | Lines above. `endScene` advances. |
| `bed` | `interact` at `bed` | `onBed`. Pose `rise` for 0.95 s, then one Bung line, then advance. |
| `clothes` | `interact` at `wardrobe` | `onWardrobe`. Pose `dress` for 1.15 s. Sets `stepState.uniform` inside the pose (see `tickPose`). `setBungKit` shows the singlet and boxers. Doors `wardL` / `wardR` swing. |
| `shelf` | `interact` at `shelf` | `onShelf`. Pose `cupboard` 0.7 s. Line lists `state.saga.relics` or talks about an empty clip. Five coloured bars are always in the cupboard mesh. They are not the named relics. |
| `garage` | `interact` at `garage` | `onGarage`. Sets `state.flags.trolleyUnlocked`, opens the door, `trolley.summon()`, one line, advance. |
| `gate` | `reach` radius 5 | `PLACE.gate`, rewritten by `buildHouse` to about `(-844.3, 877.1)`. |
| `mcrebar` | `reach` radius 3 | Order counter. Must be within 2.4 m vertically of `bar.y` (13.9), so Bung has to be on the restaurant floor, not the street under it. |
| `meal` | `interact` at `mcrebar` | `onCounter`. Shows `bar.meal`. Two-line conversation. |
| `watched` | `scene` at `mcrebar` | Bung, Gabor, and a `doc` line. Gabor is presented by the dialogue camera if he is not already nearby. |

### Objects

House from `buildHouse`: bed, wardrobe with hanging singlet and shorts, cupboard, kitchen, couch, lights, garage bay, west door, driveway. Trolley from `Trolley.summon`. McRebar from `buildMcRebar`. Guide arrow for `gate` and `mcrebar` uses `ROUTES` (`gate>door` and the door route).

### Success and save

The chapter ends when `watched` finishes. `finishChapter` appends `'ch1'` to `done` and adds 40 coins. No relic. Clothing flag persists because step index has moved on.

### Known limits

The house has no bathroom. The cupboard does not grow a Golden Mini or Platinum mesh when those relics are collected later. Emerald has a mesh (`house.emerald`) that starts hidden. The garage is a box workshop, 7.6 m wide, door 3.6 m on the west side. A full enter, turn, exit, and park has not been re-recorded for this handover. The street arrow depends on the baked `gate>door` polyline, which includes the runtime counter only at its last point. If `PLACE.mcrebar` moves again, that polyline goes stale.

## Chapter 2 — Golden Mini Rebar

Index 1. Id `ch2`. Title `THE GOLDEN MINI REBAR INCIDENT`. Start `mcrebar`. Reward 100 coins, relic `Golden Mini Rebar`, archive `golden-mini`.

### How it begins

After chapter 1, `nextChapter` increments the index and starts at McRebar. First step `promo` is a scene: doc explains 1-in-100,000, Gabor mentions goggles, Bung insults the forehead.

### Steps

| Id | Kind | What the code does |
| --- | --- | --- |
| `promo` | `scene` | Three lines. Camera alternates by speaker. |
| `order` | `interact` at `mcrebar` | `onCounter`. One Bung line. Shows the meal mesh again. |
| `goggles` | `interact` at `gabor` | `onGabor`. Three lines. Gabor must be near the counter (`poseActors` places him at `bar.spot` when the step is not a chase). |
| `follow` | `follow` | `moveGabor` on `CHASE_PATH` from the door toward the Apple Store approach. Completes when `gaborDist > length - 5` and Bung is within 6 m of Gabor. |
| `bag` | `interact` at `bag` | One line. `advance` **holds** `gaborDist` for `bag`, `confront`, and `relic`, so he stays at the end of the path. |
| `confront` | `scene` | Three lines. Look id `bag`. |
| `catch` | `catch` | Path is **reversed** because `chapter === 1`. Bung must be **riding**. Completes when `gaborDist > 8` and the gap is under 4.5 m. Toast `GABOR CAUGHT — N m`. |
| `relic` | `interact` at `bag` | Pushes `Golden Mini Rebar` into `relics` if missing, then the reward line, then `finishChapter` grants it again if the reward says so (`finishChapter` checks `includes`). |

### Chase numbers

Polyline: 35 points in `CHASE_PATH`. Runtime length is about 271 m. Follow speed about 4.4 m/s (under sprint 10, above a casual comparison with run 6.2 only when he speeds up near Bung). He waits if the along-track gap exceeds 36 m. HUD note `HE IS WAITING ON QUEEN STREET`. Returning to the start after that sets `_chaseAway` and snaps him back when the player is on the first 7 m of the route. Trail spheres drop on his samples. Arrow uses the chase tangent.

The confrontation point is the last path point `(358.4, -64.7)`, on the street in front of the shop node `(371.82, -65.92)` labelled `APPLE STORE` in `brisbane.shops.js`. The node is inside a footprint. Gabor does not enter it.

### Failure

There is no timer and no "mission failed" screen. Falling far behind makes him wait, then restart at the route start if Bung goes back to the beginning. Stability death uses the normal game-over path and is not a custom chase fail. Missing a turn does not teleport him onto a new street. He stays on the polyline, so the arrow should lead back onto it once Bung is within 14 m. Farther than 14 m, the arrow points at the closest path point, which can cross a block. That is a remaining guidance hole.

### What was exercised

On 29 October 2026, a scripted browser session on the local server (not a from-scratch human drive of the whole 271 m) checked:

- Gabor's position stayed on the polyline.
- Follow could reach the end and advance to `bag` when Bung was placed within 4–6 m.
- Catch while riding, on the reversed path, advanced to `relic`.
- HUD showed changing metre values, including 27 m and 37 m, and the waiting note.
- Arrow yaw changed by about 0.14 rad when Bung was moved backward along the path, and by about 0.01 rad when the camera yaw was spun by half a turn.
- Trail markers were visible in one gameplay screenshot on the mall paving.

That is evidence the systems run. It is not evidence a player can comfortably drive the trolley the whole way, miss a corner, and recover without getting stuck on mall furniture. Treat drivability as **partially tested**.

## Chapter 3 — Big Boy Mode

Index 2. Id `ch3`. Title `MCREBAR MAX: BIG BOY MODE`. Start `garage`. Reward 150 coins, relic `Platinum Diamond Rebar`, archive `platinum-diamond`.

### How it begins

Scene `sabotage` at the garage. Doc introduces McRebar Max and the 1-in-a-million prize. Gabor says he put a spoon in the axle. Bung complains. `syncDamage` sets `trolleyDamage` from the step flow (see `Saga.syncDamage`). While damaged, trolley max speed and acceleration are multiplied by about 0.42 and 0.45.

### Steps

| Id | Kind | What the code does |
| --- | --- | --- |
| `sabotage` | `scene` | Three lines. |
| `parts` | `parts` | Collect `hall`, `bank`, `mallBolt`. `onPart` hides `actors.parts[id]`, toasts nothing beyond a bark, and advances when all three flags are set. Guide uses part destinations. |
| `install` | `interact` at `garage` | Refuses with a bark if any part is missing. Otherwise sets `bigBoy = true`, `trolleyDamage = false`, toast `BIG BOY MODE`, camera shake, one line. |
| `rings` | `rings` | While riding, passing within 2.4 m of `ring1` `(173, 100)`, `ring2` `(150, 90)`, `ring3` `(110, 55)` sets `stepState.rings[id]`. All three advance the step. |
| `catch` | `catch` | Same riding and 4.5 m rules as chapter 2, but the path is **not** reversed (`chapter === 2`). Gabor runs the forward polyline from McRebar toward the Apple approach again. |
| `relic` | `interact` at `bag` | Pushes the Platinum string into `relics`. |

### What is simplistic

- Parts are sparkles at three `PLACE` pads, not a repair animation with a visible spoon.
- Big Boy Mode changes numbers only. `buildTrolley('james')` stays on screen.
- Ring coordinates are an older chord across the mall. They are not the baked chase polyline and were not re-checked against footprints for this handover. A ring inside a solid box cannot be collected.
- No browser playthrough of this chapter was completed in the October 2026 chase session.

### Failure

No custom fail. A damaged trolley is slower until install. Catch still requires riding and a 4.5 m gap after Gabor has travelled 8 m.

## Chapter 4 — Emerald Rebar Heist

Index 3. Id `ch4`. Title `THE EMERALD REBAR HEIST`. Start `mcrebar`. Reward 250 coins, relic `Emerald Rebar`, archive `emerald-mini`.

### How it begins

Scene `announce` at McRebar. Doc states 1-in-100,000,000. Gabor says he scanned it to a collector tent at South Bank. Bung says he will dress as a janitor.

### Steps

| Id | Kind | What the code does |
| --- | --- | --- |
| `announce` | `scene` | Three lines. |
| `goto` | `reach` radius 8 | `PLACE.event` `(-150, 860)`, the collector lawn from `buildCollectorLawn`. |
| `scan` | `interact` at `scanner` | `onScanner`. Gabor's dialogue admits the left pedestal and then denies it. |
| `disguise` | `interact` at `mop` | Pose `mop` 0.8 s. Sets `stepState.disguise`. `syncKit` shows the janitor vest and cap only while `chapter === 3`. |
| `swap` | `choice` | `correct: 'ped-left'`. `onPed`. Without the disguise, Gabor refuses. The wrong id plays a denial and does not advance. `ped-left` swaps in dialogue and advances. |
| `escape` | `escape` | `moveGuard` orbits a guard mesh 7.5 m from the lawn centre. If Bung is within 16 m of the centre and closer than 2.3 m to the guard while disguised (4.8 m if not), `caught()` fires. Leaving to more than 22 m from the centre with the guard more than 6 m away advances. |
| `home` | `interact` at `shelf` | `onShelf` sees step id `home`, pushes `Emerald Rebar` if needed, shows the green bar (`syncKit` / emerald visibility), cupboard pose, then advance and chapter finish. |

### Stealth, as implemented

There is no vision cone, no noise meter, and no patrol graph. Detection is distance to a circling guard. The disguise only changes that distance threshold and the clothing groups. The "drone" is dialogue plus whatever prop `buildCollectorLawn` placed. Read that function before extending it.

### What was not tested

No full play of chapter 4 was recorded in the chase-and-dialogue session. The lawn, pedestals, mop, and guard exist in code. Whether the guard clips the tent, whether `ped-left` is obvious, and whether the route home from South Bank is readable are open. The street arrow's `destination()` returns null once `state.saga.chapter > 3`, so **this chapter still gets routes** (index 3). The next chapter does not.

## Files to open first

- `src/story/sagaData.js` — steps, `PLACE`, `CHASE_PATH`, `createSaga`.
- `src/story/Saga.js` — `check`, `moveGabor`, interact handlers, `syncKit`, `advance`.
- `src/story/dialogueCam.js` — shots.
- `src/story/chase.js` — trail and polyline math.
- `src/story/guide.js` and `src/story/routes.js` — arrow.
- `src/story/house.js`, `src/story/mcrebar.js` — sets.
- `src/ui/HUD.js` `chaseHud`.
- `src/systems/DialogueSystem.js` — `say` versus `conversation`.
