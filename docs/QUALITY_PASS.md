# Brisbane opening quality pass — 30 October 2026

This is an implementation update to the existing map and 24-chapter saga. It supersedes the older handover's claims that no automated tests exist and that the arrow uses only baked chapter routes.

## Implemented

- Bridge and raised-road collision now samples the actual rendered triangles through a spatial index. Whole approach triangles are no longer discarded at bridge outlines. Deck profile spikes are repaired without moving endpoints; overlapping raised-road samples use the same repaired heights. Sloping parapets and deck edges follow the profiles.
- Road/deck triangles consistently face upward. This fixes the black-road lighting caused by upward normals on downward-facing triangles. Streetlights move to road edges and reject building interiors. Distant building batches stop casting expensive near-player shadows.
- One reusable navigation controller uses the existing OSM street graph, validates connectors against footprints and story colliders, and routes through house doors, the driveway and McRebar stairs. The rounded, bevelled gold arrow uses frame-independent turning; a bounded instanced ground trail and route-distance HUD share the controller. Missing routes are explicitly indicated instead of drawing a line through a building.
- Gabor follows a deterministic, validated Queen Street route past the Apple approach. Chapter 2 follows him outward, stages the confrontation, then catches him on the return toward McRebar before chapter 3 begins at the garage. Chapter 3 retains its own outgoing chase and relic ending. Acceleration, cornering, waiting for a distant player, saved progress, obstruction recovery and one-shot completion replace waypoint skipping and teleport resets.
- Active objective interactions take priority over nearby trolley mounting. Mounted Seb deliveries no longer consume E as a dismount. Garage opening persists; the doorway is wider, the driveway is continuous, and a central post no longer blocks the house stairs. Swept horizontal movement prevents thin-wall tunnelling; dismount searches for a clear standing position.
- Chapter-clear rewards and save continuation are idempotent, including migration of old terminal-step saves. Cinematic conversations pause mission movement, use stable per-line shots, check nearby boxes and spatial building footprints, and validate the final interpolated camera position. Ordinary barks leave the gameplay camera alone.
- Apple frontage detailing is attached to the existing mapped host footprint. The address was checked against [Apple Brisbane](https://www.apple.com/au/retail/brisbane/); this is a stylised facade, not a surveyed replica.
- Zone-scoped pulse listeners unsubscribe on disposal. Guide/trail effects have bounded allocations and release their owned materials. Static navigation is built once per dressed zone.

The source map and six acts remain intact. No replacement grid or downloaded map dataset was introduced.

## Run

From the repository root:

```sh
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`. Continue preserves the existing save; New Saga replaces it. The deployed game is at https://danielslater3.github.io/bung-bunty-rebar-world/.

No build or package installation is required for the game. Three.js is vendored.

## Automated validation

```sh
node --experimental-loader ./tools/tests/loader.mjs --test tools/tests/*.test.mjs
```

The native Node suite validates 74 bridge polygons with 47,456 triangle samples, all 251 elevated road ribbons, 24 repaired profiles, upward nondegenerate surface winding, Queen Street footprint clearance, stacked-deck selection, swept movement, route math, moving/missing objectives, 30/60/120 Hz chase completion, checkpoint restoration, obstruction recovery, and all 24 chapters' reward/save migration rules.

Optional loaded-scene regression requires Playwright and installed Chrome. Install test dependencies outside the game repository, then expose that installation via `NODE_PATH`:

```sh
NODE_PATH=/path/to/test-dependencies/node_modules \
GAME_URL=http://127.0.0.1:8765/ node tools/tests/browser.cjs
```

This script uses a fresh isolated browser context. It checks ten opening mission routes against the loaded city's collision geometry, actual keyboard-driven player movement through the house, trolley movement out of and back into the garage, mounted Seb delivery, chapter 1–4 handler order, chapter-clear save/load continuation, and indoor cinematic camera positions. Chase simulations exercise the real saga handlers but place the test player along the route; they are not a keyboard-driven chase playthrough. Rendering is suppressed after scene creation for simulation speed. Separate rendered screenshots were inspected for the gold arrow, Queen Street road surfaces, bedroom and garage conversation framing.

## Phase status and limits

| Phase | Status |
| --- | --- |
| 1 — World stability | Partial: shared surface, profile, lighting and critical-route fixes implemented and tested. Every street, intersection, building outline and rail crossing has not been manually surveyed or driven. |
| 2 — Navigation | Implemented: reusable routing, arrow, route distance and fading trail; critical loaded-scene routes tested. Arbitrary destinations throughout the full city remain unverified. |
| 3 — Gabor chase | Implemented: staged route, pacing, checkpoint/recovery, HUD and existing story transition; automated simulations pass. A complete normal-speed human chase remains unverified. |
| 4 — Chapters 1–4 | Partial: progression blockers, garage handling, dialogue cameras and presentation fixed. A complete environment/art rebuild and end-to-end human playthrough remain outstanding. |
| 5 — Regression | Automated coverage implemented; full manual/GPU-performance certification remains outstanding. |

Specific remaining limits: the supplied map retains some steep bridge endpoint grades (including the Dornoch Terrace data); repairs preserve those endpoints rather than inventing new approaches. City-wide road/building overlap certification is not complete. Long navigation queries can take roughly 40–220 ms on first planning in the test environment. The existing city still renders millions of triangles in some views; SwiftShader screenshots do not establish hardware frame rate. Chapters 5–24 retain their data and handlers, but were not played through in this pass. Cinematic collision uses padded boxes and building footprints, not a swept camera frustum against every decorative mesh.

## Module cache rules

`index.html` maps both `/src/...` and `./src/...` spellings to one canonical relative URL, including on the GitHub Pages project subpath. Source imports omit their own query strings. The release token is `20261030-polish1`; the unchanged geographic data and vendor retain separate cache tokens. When adding a module, add both aliases. Change the source release token consistently in the map and entry script; never introduce a second URL for `state.js` or `sagaData.js`.
