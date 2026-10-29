# Agents

Bung Bunty: Rebar World is a static Three.js game. The campaign that matters now is chapters 1–4 of The Original Saga, on the real Brisbane map. Quality and correctness beat a longer feature list. Chapters 5–24 already have step data. Do not expand them while 1–4 are unfinished.

Full notes: `docs/handover/START_HERE.md`.

## Stack

- Three.js revision 160, `vendor/three.module.js`, import map key `"three"`.
- ES modules. No bundler, no npm install, no test runner, no env vars.
- Run: `python3 -m http.server 8765` from the repo root, then open the URL. See `docs/handover/SETUP_AND_TESTING.md`.
- Deploy: push `main`. GitHub Pages serves https://danielslater3.github.io/bung-bunty-rebar-world/

## Layout

- `src/core/Game.js` — loop, zones, gameplay camera.
- `src/core/state.js` — singleton state and `localStorage` key `bung-bunty-rebar-world-save-v1`.
- `src/story/Saga.js` and `sagaData.js` — chapters. `state.saga.chapter` is 0-based.
- `src/story/dialogueCam.js` — scripted shots only.
- `src/story/chase.js`, `guide.js`, `routes.js` — Queen Street chase and the gold arrow.
- `src/story/house.js`, `mcrebar.js` — West End house and 130 Queen Street.
- `src/world/geo/` — compiled city. Do not rebuild it to fix a mission.

## Conventions

- Match the surrounding file. Plain JavaScript, `export` functions and classes, no new framework.
- Bump `?v=` on a changed module, on the file that imports it, on the `Game.js` map entry, and on `main.js`. Relative imports ignore the import map. Every importer of `sagaData.js` must use the same query. Do not load `state.js` from a second URL.
- `DialogueSystem.say` is a bark and must not set `cinematic`. `conversation` is the cinematic path.
- Camera collision tests `zone.colliders` boxes only. Never raycast `zone.group` (that was a 3 fps bug).
- 1 m in the city is 1 m in the world. Do not invent coordinates. Fiction stays labelled fiction.
- McRebar signage is McREBAR. The arch is gold rebar, not a lettermark. Reference photos are not in git (`docs/handover/REFERENCES.md`).
- Do not delete lore in `src/lore/universe.js` or chapter lines in `sagaData.js` to simplify a step.
- `startGame(true, ...)` wipes the save. Copy localStorage before a New Saga test.
- Do not claim a chapter is done because the step list exists or the file parses. Play it and say what you saw.

## Current priority

`docs/handover/DEVELOPMENT_ROADMAP.md` Phase 1: prove the indoor camera, the dialogue camera, the street arrow, the Queen Street chase, the distance HUD, the trail, and a trolley trip out of the garage and back. Then the house and McRebar. Then chapters 3 and 4 played for real.

Bugs and their real status: `docs/handover/KNOWN_ISSUES.md`. None of Bugs A–J are fully closed.
