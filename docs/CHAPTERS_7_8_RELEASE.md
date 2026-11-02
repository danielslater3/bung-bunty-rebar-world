# Chapters 7–8 release — 3 November 2026

Chapter 7 now has three eight-bar rounds, escalating timing windows, score, combos, original procedural bass/percussion and short original bars. Each round requires six successful inputs. A failed round retries without farming score; reload restarts only the current round and preserves banked score. Bung, Gabor and Ching perform with gestures, speaker-focused shots reuse the existing collision-aware dialogue camera, and a small instanced crowd and removable microphones/speakers dress the existing square.

Chapter 8 has a modelled blue phone, a staged drop/fracture shot and three distinct physical fragments. The phone pickup sits at the house floor height. Evidence positions are checked against actual footprints and colliders, with a valid local approach. The gold guide targets the next missing fragment, displays progress and shares the existing ground route trail. The drone uses bounded local routes; F jams it nearby. Secured pieces survive interference and reload. Photo attempts and retries have feedback. Broken-phone state plus photograph and shard evidence persist into Chapter 9.

An intentional mouse unlock no longer triggers an accidental pause. A delayed lock request cannot recapture the mouse over a menu or cinematic. This fixes a race exposed by the minigame and chapter-clear tests. The dashboard, protected replay slot and loading/camera hotfix remain in place.

Validation:

- 33 native Node tests pass, including 30/60/120 Hz rhythm completion, retry/checkpoint scoring and delayed mouse-lock behavior and full module-graph loading, plus existing world, navigation, progression and save-isolation tests.
- `tools/tests/pair78.cjs` completes both chapters through their real mission handlers. It exercises a failed rap round, three wins, a round reload, chapter-clear UI, physical phone pickup, three failed photo attempts then success, the destruction scene, physical fragment pickups, a partial-evidence reload, interference recovery and the Chapter 9 continuation. Both rewards are counted once. Long house→mall travel is route-validated then placed at its destination; it is not a keyboard-driven city playthrough.
- `tools/tests/dashboard-gameplay.cjs` loads Chapters 1–8 through the dashboard and checks camera/control recovery. The opening loaded-scene regression checks earlier routes, house movement, garage exit/return, Seb delivery, clear-save continuation and indoor cameras.
- Rendered performance and fracture screenshots inspected. Simulation rendering is otherwise suppressed for speed; no full human playthrough or hardware frame-rate certification is claimed.

Run: `python3 -m http.server 8765`, then open `http://127.0.0.1:8765/`. Native tests: `node --experimental-loader ./tools/tests/loader.mjs --test tools/tests/*.test.mjs`. Browser scripts require externally installed Playwright/Chrome, `NODE_PATH` pointing to that installation, and optionally `GAME_URL` for the deployed site. Source cache token: `20261103-pair78`.

Remaining limits: character art remains the existing stylised procedural models, with additional props and performance animation rather than a complete model replacement. Crowd reactions and the stage are modest; the city venues were not architecturally rebuilt. Audio is generated synth music and character beeps. A human playthrough remains useful for judging rhythm feel, dialogue pacing and long-distance exploration. No Chapters 9–24 gameplay was expanded in this release.
