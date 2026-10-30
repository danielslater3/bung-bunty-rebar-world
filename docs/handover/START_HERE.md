# Start here

**Latest implementation:** [Brisbane opening quality pass, 30 October](../QUALITY_PASS.md). Read that first for the shared navigation/chase controllers, surface collision, progression repairs, current tests and module-cache rules. The status inventory below describes the earlier `18a494e` baseline.

This is the entry point for an agent taking over **Bung Bunty: Rebar World**. Read this, then the documents listed at the bottom, then the source. Do not treat the root `README.md` as current: it describes the older sandbox revamp and still says Three.js comes from a CDN.

## What this is

A browser game about Bung Bunty, a large comic Brisbane character, his golden James Rebar trolley, and his rivalry with Gabor Mihala. The current story is **The Original Saga**: 24 chapters on a real Brisbane map. The playable priority is **making chapters 1–4 feel finished**. Chapters 5–24 already have step data and mission handlers. They are not the work to expand.

The older sandbox is still in the same page: mansion hub, Brisbane, Sydney, Hong Kong, Shenzhen, the Rebar Void, portals, a shop, and boss events. **New Saga** starts the chronicle. **Free Roam** starts the sandbox and replaces the save.

Live site: https://danielslater3.github.io/bung-bunty-rebar-world/

Repository: `danielslater3/bung-bunty-rebar-world` on GitHub. Pages publishes the `main` branch from `/`. There is no build step and no npm package.

## Intended experience

Bung wakes in a West End house, dresses, takes the golden trolley along real streets to McRebar at 130 Queen Street, and plays the first four comic incidents there and at South Bank. The city should stay geographically honest: 1 metre in Brisbane is 1 metre in the game. Fiction (McRebar, the lawsuit plaque, the Wheel prop, Seb Daly) sits on that grid and must stay labelled as fiction. Trademark lettering stays off the restaurant. The sign reads McREBAR, and the arch is a gold rebar arch.

## Stack

- Three.js **revision 160**, MIT, file `vendor/three.module.js`. The import map key is `"three"`.
- ES modules. No bundler, no TypeScript, no test runner, no Playwright, no CI workflow, no environment variables.
- Static host. Local command: `python3 -m http.server` from the repo root, then open the printed URL. `file://` will not load modules.
- Persistence: `localStorage` key `bung-bunty-rebar-world-save-v1`.
- Audio is synthesized in `src/core/AudioManager.js`. There are no voice recordings.

## Current status (commit `18a494e` on `main`)

Working and shipped:

- Compiled Brisbane district from OpenStreetMap, with a Queensland 2019 LiDAR ground grid and a Queensland orthophoto on ground, water, and roofs.
- Saga state machine for all 24 chapters in `src/story/sagaData.js`.
- Chapter 1 house, wardrobe, cupboard, garage door, and McRebar counter, as interact-and-reach steps.
- A cinematic camera that runs only for `DialogueSystem.conversation()`, not for `say()` barks.
- Chapter 2 chase constrained to a baked Queen Street polyline, with a distance HUD and a fading trail.
- A gold guide arrow that follows baked street polylines in chapters 1–4, and the chase polyline during follow/catch.

Not finished, and still the priority:

- Photo-accurate McRebar. The reference photographs are **not in git**. See `REFERENCES.md`.
- A West End house with a bathroom, distinct physical relics, and richer materials.
- Big Boy Mode as a visible trolley change. Today it is a speed multiplier.
- A full human playthrough of chapters 3 and 4 after the chase work.
- Chapters 5–24 are data plus mission handlers. Several are timing minigames, not locations you explore in depth. Do not start chapter 5 work while 1–4 are still thin.

## How to run and test

See `SETUP_AND_TESTING.md`. Short version:

```bash
cd "/path/to/bung-bunty-rebar-world"
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`. Click **NEW SAGA**. That calls `startGame(true, 'saga')`, which **wipes the save**. Copy `localStorage['bung-bunty-rebar-world-save-v1']` first if a completed save matters.

`window.BUNG` is the `Game` instance after boot.

## How to continue safely

1. Read `AGENTS.md`, this file, `KNOWN_ISSUES.md`, and `CHAPTERS_1_TO_4.md`.
2. Change story behaviour in `src/story/`. Change the city only through the geo tools, and do not invent coordinates.
3. Never raycast `zone.group`. One recursive city raycast dropped the game to about 3 fps (`0fc9adb`).
4. Keep every importer of `sagaData.js` on the **same** `?v=` query. Split queries split `PLACE` into two objects.
5. Do not version `src/core/state.js` on a different URL from `Game.js`. The save singleton is the relative import `./state.js`.
6. Do not mark a bug fixed because `node --check` passed. Play the scene and look at it.
7. Brisbane map, existing chapter steps, and the save shape stay. Quality work on chapters 1–4 comes before new chapters.

## Read next

1. `docs/handover/ARCHITECTURE.md` — who owns what.
2. `docs/handover/WORLD_AND_MAP.md` — the Brisbane grid. Do not rebuild it.
3. `docs/handover/LORE_AND_CAMPAIGN.md` — the 24-chapter story and what is actually in the game.
4. `docs/handover/CHAPTERS_1_TO_4.md` — step-by-step behaviour of the current priority.
5. `docs/handover/KNOWN_ISSUES.md` — bugs A–J with status.
6. `docs/handover/DEVELOPMENT_ROADMAP.md` — the order of work.
7. `docs/handover/SETUP_AND_TESTING.md` — commands that match this repo.
8. `docs/handover/REFERENCES.md` — photographs that are not in git.
9. `docs/handover/CODEX_FIRST_PROMPT.md` — a paste-ready first session.
