# Setup and testing

Verified against this repository on 29 October 2026. There is no `package.json`, no lockfile, no `.env`, no CI workflow, and no Playwright config. Nothing in `src/` reads `process.env`.

## Clone

```bash
git clone https://github.com/danielslater3/bung-bunty-rebar-world.git
cd bung-bunty-rebar-world
```

The default branch is `main`. GitHub Pages serves that branch at https://danielslater3.github.io/bung-bunty-rebar-world/

## Install

No install step. Three.js is `vendor/three.module.js` (revision 160). Fonts load from Google Fonts when the machine is online. The game still boots without them. Models, sfx, and music are generated in code.

Do not run `npm install`. There is nothing to install.

## Development server

From the repo root. Python 3 is enough. Pick a free port. `8000` is only an example from the old README. If it is taken, use another.

```bash
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`. `file://` fails because the page is a module script.

Stop the server with Ctrl-C. Do not leave a server bound if you started it only to check a file.

A one-shot check that the page is being served:

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8765/
```

`200` means the server is up. It does not mean the WebGL scene is correct.

## Production build

There is no compile step. The production artifact is the repository itself. Deployment is `git push origin main`. Pages status:

```bash
gh api repos/danielslater3/bung-bunty-rebar-world/pages/builds --jq '.[0] | {status,commit:.commit[0:7]}'
```

Wait until `status` is `built`, then fetch the live HTML and confirm it contains the `main.js?v=` query you committed:

```bash
curl -fsS https://danielslater3.github.io/bung-bunty-rebar-world/ | grep main.js
```

## Automated tests

None are configured. `node --check src/story/Saga.js` only parses a file. It does not load Three.js or play a chapter. Do not cite it as a gameplay pass.

Useful syntax checks after an edit:

```bash
node --check src/core/Game.js
node --check src/story/Saga.js
node --check src/story/dialogueCam.js
node --check src/story/chase.js
node --check src/story/guide.js
```

## Browser testing

No Playwright. Use a normal browser.

1. Open the local URL.
2. Click the canvas if you need the pointer lock. Mouse look is in `Game.updatePlaying`.
3. Console: the page installs `window.bungFail` and shows a `#boot-error` banner for an uncaught exception. `window.BUNG` is the `Game` instance.
4. `?debug` is still read by the older debug helper (`src/core/Debug.js`) for portal discs in the sandbox. It does not start a saga.

Screenshots are a manual browser capture. The game draws into the canvas under the HUD DOM in `index.html`.

## Movement

| Input | Action |
| --- | --- |
| WASD | Move, or steer the trolley |
| Mouse | Camera, after pointer lock |
| Space | Jump, or trolley drift |
| Shift | Sprint, or trolley boost |
| E | Interact, mount, dismount, skip a queued dialogue line |
| T | Summon or dismiss the trolley, after `state.flags.trolleyUnlocked` |
| Q | Grapple, sandbox |
| F | Belly bounce |
| G | Rebar pulse |
| Esc / P | Pause menu |

Run speed is 6.2 m/s. Sprint is 10 m/s before upgrades. Trolley forward cap starts at 18 and reverse at -7 (`Trolley.js`).

## Saves and campaigns

Key: `localStorage['bung-bunty-rebar-world-save-v1']`.

- **Continue** calls `startGame(false)` and loads the save.
- **New Saga** calls `startGame(true, 'saga')`, which runs `SaveSystem.reset()` and **deletes the save**.
- **Free Roam** calls `startGame(true, 'roam')` and also deletes the save.
- **Chapter select** is enabled when a saga save exists. It sets `state.saga.chapter` to the list index, zeroes `step`, and calls `startGame('keep', 'saga')`. Chapters above the current index stay locked (`Menus.showChapters`).

Before a destructive test, copy the save out of localStorage. A finished chronicle in one browser profile had `saga.chapter` 23 (chapter 24's index), `done` length 24, and `saga.legend` true. That profile is not in git.

Autosave runs every 30 seconds while `mode` is `playing` or `paused`, and on `pagehide` in those modes. Setting `mode` to `menu` before writing localStorage by hand stops that flush from replacing a restored blob with the in-memory test state. `SaveSystem.save` still writes `state` if something else calls it.

## Playing chapters 1–4

1. Back up localStorage if the profile matters.
2. Open the local server. Hard-reload if you changed a `?v=` query.
3. **NEW SAGA**.
4. Press E through the opening. Get out of bed, use the wardrobe, the cupboard, the garage, leave via the gate, reach the McRebar floor (y around 13.9, not the street), order, watch the last scene.
5. Chapter 2 starts at McRebar. Order, talk to Gabor, follow the mall north-east toward the Apple approach, then catch him while riding.
6. Chapter 3 starts at the garage. Collect the three pads, install, ride the rings, catch him again.
7. Chapter 4 starts at McRebar, then South Bank `(-150, 860)`. Disguise, left pedestal, walk out, return to the cupboard.

Jumping ahead: finish a chapter once so chapter select unlocks, or temporarily set `state.saga.chapter` only in a throwaway profile. Do not ship a debug skip.

## Useful console probes

Run these in the page after a saga has dressed Brisbane. They read state. They do not prove a screenshot.

```js
const g = window.BUNG;
g.saga.currentStep();
g.saga.chapter().n;
g.indoorRoom(g.player.pos.x, g.player.pos.y + 1, g.player.pos.z);
g.dialogue.cinematic;
document.getElementById('chase-dist')?.textContent;
```

`indoorRoom` returns a house AABB or `{ kind: 'bar', floor, ceil }`.

## Regenerating the city

Only when the map itself must change:

```bash
python3 tools/compile_brisbane_geo.py
python3 tools/bake_aerial.py
python3 tools/enrich_brisbane.py
```

`enrich_brisbane.py` downloads Queensland DEM and footprint data into `/tmp` when missing and rewrites `src/world/geo/brisbane.data.js`. That file is huge. Do not reformat it. Do not run this as part of a story fix.

## Troubleshooting

- Banner "script error" / `#boot-error`: the stack is in the banner. A common cause is a `?v=` mismatch or a syntax error in a newly imported module.
- Two different inventories or a quest that ignores `PLACE` edits: two copies of `sagaData.js` or `state.js` are loaded. See `ARCHITECTURE.md` import-map rules.
- About 3 fps on Queen Street: search for `intersectObject(zone.group)` or `intersectObjects` on the city group. Remove it.
- Black canvas and a living HUD: WebGL context or an exception during `frame`. The loop stops itself and calls `bungFail` on a throw.
- Changes invisible after an edit: the browser cached the module. Bump the query on that file, on the importer, on the `Game.js` map entry, and on `main.js`.
- Menu works and Brisbane never loads: `buildCity.js` failed inside the dynamic import. The boot banner should show the error. `brisbane.data.js` must be served as a static file. It is not fetched from Overpass at runtime.
