# Development roadmap

The priority is chapters 1–4 feeling finished. Chapters 5–24 already have steps. Do not add chapter 5 scenes, new cities, or a new quest chain while a chapter 1–4 hole is open.

Each task lists the files most likely to change, what it depends on, how to accept it, and how to test it. Status words match `KNOWN_ISSUES.md`.

## Phase 1 — Critical gameplay stability

### 1.1 Finish the indoor gameplay camera (Bug A, partial)

Keep `cameraClearance` on boxes. Walk every interior and fix any boom that leaves the room. Depends on `house.rooms` and `bar.inside`. Accept when screenshots from the bedroom, living room, garage, and McRebar show the camera inside, including a pitched-up corner and a doorway. Do not raycast `zone.group`.

### 1.2 Keep dialogue cinematic and indoor (Bug B, partial)

Use the existing `frameDialogue`. Add a shot only for a scene that fails. Accept when each of Bung, Gabor, and Ching has a face-on line indoors and outdoors, a bark leaves FOV at 68, and McRebar's camera y stays under `bar.ceil`. Files: `dialogueCam.js`, `DialogueSystem.js`.

### 1.3 Prove the street arrow on one real drive (Bug C, partial)

Ride and walk `gate>door` from the West End gate to the McRebar counter. If the chevron cuts a building, replace that polyline in `routes.js`. Accept when a continuous trip never requires aiming through a solid footprint, and a one-second reverse does not spin the chevron 180 degrees. Depends on `PLACE.gate` and `PLACE.mcrebar` staying put.

### 1.4 Ride the Queen Street chase once (Bug D, partial)

From step `follow`, mount the trolley and catch Gabor without teleporting. Include a deliberate miss and a wait long enough to see `HE IS WAITING ON QUEEN STREET`, then catch up. Accept when he never enters a footprint, the end is the Apple approach point, and `check` advances to `bag` and later `relic` by play. Files: `Saga.js`, `sagaData.js`, `chase.js`.

### 1.5 Distance and trail, confirmed while riding (Bugs E and F, partial)

During that same ride, the HUD number must change, and markers must appear on the paving he has crossed and then fade. Accept when a screenshot shows the arrow, the HUD, and at least a few markers together, and a console sample shows marker xz on the polyline.

### 1.6 Garage exit, driven (Bug G, partial)

From the chapter 1 garage step: door opens, blocker leaves `zone.colliders`, trolley reverses out, reaches the gate, returns, and parks. Accept when that sequence is done on the current build. Files: `house.js`, `Saga.tickGarage`, `Trolley.js`. Do not shrink the collision radius below 0.8 to fake a fit.

## Phase 2 — Environment reconstruction

### 2.1 West End house (Bug H)

Add a bathroom and richer dressing inside the current footprint, or a room whose AABB is registered in `house.rooms` so the camera knows it. Keep the floor on `saga.ground`. Accept when chapter 1 still completes and the new room does not trap the player. Files: `house.js`.

### 2.2 Garage as a workshop (Bug G quality)

After the exit works, add benches, storage, and lighting that read as James Rebar's workshop. Keep the west door, the 3.6 m opening, and the north wall solid. Accept when the drive in 1.6 still works.

### 2.3 McRebar exterior and interior (Bug I)

Requires the three references in `REFERENCES.md`, re-supplied by the owner. Rebuild in `mcrebar.js` using `mcrebarPoint`. Keep the OSM frontage as the width, the plan as arrangement rather than a scale drawing, floor y 13.9 unless a real measurement replaces it, and the gold rebar arch. No chain wordmarks. Accept when mall and interior screenshots can be set beside the references, and dialogue plus ordering still run.

### 2.4 Collector lawn

`buildCollectorLawn` in `mcrebar.js`. Make the tent, pedestals, scanner, and mop readable before tuning chapter 4 stealth. Accept when a first-time player can find `ped-left` after the scanner dialogue. Depends on `PLACE.event`.

## Phase 3 — Characters and interactions

### 3.1 Clothing

`setBungKit` already toggles groups. Make the wardrobe pose obviously the moment the mesh changes, and keep the undressed state only at the start of chapter 1. Accept with a before/after screenshot. Files: `models.js`, `Saga.tickPose`, `syncKit`.

### 3.2 Cupboard relics

Spawn a mesh per entry in `state.saga.relics`, including Golden Mini and Platinum, not only the emerald cylinder. Accept when finishing chapters 2 and 3, then opening the cupboard, shows those objects. Files: `house.js`, `Saga.onShelf`.

### 3.3 Big Boy Mode

Today `state.saga.bigBoy` multiplies speed. Add a visible change on the james trolley when the flag is set, without a second physics body. Accept when chapter 3 install changes both the number and the mesh, and `trolleyDamage` still slows the pre-repair trolley. Files: `models.js` `buildTrolley`, `Trolley.js`, `Saga.onGarage`.

### 3.4 Janitor disguise

Already a kit toggle on chapter index 3. Improve the vest so it reads in a South Bank screenshot, and keep the detection distances in `Saga.check` unless stealth is redesigned on purpose. Files: `models.js` `setBungKit`, `Saga.onMop`.

### 3.5 Ordering

`onCounter` shows `bar.meal` and plays lines. A stronger beat is the meal appearing on the counter the player is looking at, then Gabor reacting in the next step. Do not add a payment system. Files: `mcrebar.js`, `Saga.onCounter`.

## Phase 4 — Story and cinematics

Play chapter 1, then 2, then 3, then 4. For each stuck step, fix that step's handler before writing new lines. Dialogue stays in the `lines` arrays and in the `conversation([...])` calls. New lines use speaker ids `bung`, `gabor`, `ching`, `doc`, `system`. `doc` is narration and should keep framing Bung.

Acceptance for the phase is a finish of all four chapters from **NEW SAGA** with no console edits, plus the screenshots from phases 1–3.

## Phase 5 — Quality assurance

- Repeat the chapter 1–4 play on a clean save.
- Orbit the camera in each interior.
- Ride the chase and the garage.
- Confirm `localStorage['bung-bunty-rebar-world-save-v1']` still loads after a reload (`startGame(false)` / Continue).
- Watch the frame rate on Queen Street. If it collapses, look for a new `intersectObject(zone.group)` before any other theory.
- Deploy only by pushing `main`. Pages builds from that branch. Confirm the live `index.html` contains the same `main.js?v=` query you shipped.

## Explicitly later

Chapters 5–24, Sydney, Hong Kong, Shenzhen, the suitcase world tour, and any remodel of the OSM city. Read `LORE_AND_CAMPAIGN.md` before touching their text, so a polish pass does not delete the biography.
