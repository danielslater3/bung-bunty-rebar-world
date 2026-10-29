# First session prompt

Paste the block below into Codex after the GitHub repository `danielslater3/bung-bunty-rebar-world` is connected. It assumes `main` includes `docs/handover/` and `AGENTS.md`.

---

You are continuing Bung Bunty: Rebar World. Quality and correctness of chapters 1–4 come before any new feature. Do not start chapters 5–24, new cities, or a map rebuild.

1. Read `AGENTS.md`.
2. Read, in order, `docs/handover/START_HERE.md`, `ARCHITECTURE.md`, `WORLD_AND_MAP.md`, `LORE_AND_CAMPAIGN.md`, `CHAPTERS_1_TO_4.md`, `KNOWN_ISSUES.md`, `DEVELOPMENT_ROADMAP.md`, `SETUP_AND_TESTING.md`, and `REFERENCES.md`.
3. Inspect the source those documents name. If a document and the code disagree, trust the code and update the document in the same change.
4. Check `git status`, `git log -1`, and that `main` matches what you are editing. Do not discard local changes you did not make.
5. Treat Bugs A–J in `KNOWN_ISSUES.md` as open or partial. Do not mark one resolved because a file parses.
6. Serve the repo with `python3 -m http.server` on a free port. Load it in a browser. Start **NEW SAGA** only after copying `localStorage['bung-bunty-rebar-world-save-v1']` if a save is present. `startGame(true, ...)` deletes that save.
7. The highest-priority gap is Bug J together with the unproven drives in the roadmap: ride the chapter 2 chase on the trolley without teleporting, and drive the trolley out of the West End garage and back in. Fix the first blocker you actually hit. Keep Gabor on `CHASE_PATH`. Keep cameras off `zone.group` raycasts.
8. Preserve the Brisbane DEM and orthophoto, the saga step list, save key `bung-bunty-rebar-world-save-v1`, and the rule that `say()` is not cinematic.
9. After that drive, continue Phase 1 of `DEVELOPMENT_ROADMAP.md`, then Phase 2. McRebar photographs are not in git. Ask for them before claiming the restaurant matches the photos. Do not draw real chain logos. Signage stays McREBAR. The arch stays a gold rebar arch.
10. Report what you played, what you changed, and what is still unfinished. A clean console is not a finished chapter. Name the files and the in-game result.

Constraints copied from the project:

- 1 metre in Brisbane is 1 metre in the game. Do not invent lat/lon.
- All importers of `sagaData.js` must share one `?v=` query. Do not put `state.js` on a second URL.
- `state.saga.chapter` is 0-based. Chapter 2's catch reverses `CHASE_PATH` only because the index is 1.
- The Apple Store shop node is inside a building. The chase ends at `(358.4, -64.7)`.
- The garage door is on the west wall. The north wall stays solid.

---
