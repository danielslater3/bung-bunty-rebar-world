# References

## In the repository

| File | What it is |
| --- | --- |
| `src/world/geo/brisbane.aerial.jpg` | Queensland orthophoto draped on the ground, river, and roofs. Attribution in `data/geo/PROVENANCE.md`. |
| `src/world/geo/ref/city-hall-square.jpg` | City Hall from King George Square, by Kgbo, 30 July 2017, CC BY-SA 4.0. Note in `CITY-HALL-PHOTO.txt`. Colour reference only. Sandstone and plaza colours were sampled from it. It is not a texture on the mesh. |
| `src/world/geo/sydney.aerial.jpg` | Sydney zone orthophoto. Not used by the Brisbane saga. |
| `src/world/geo/hongkong.aerial.jpg` | Hong Kong zone orthophoto. Not used by the Brisbane saga. |
| `data/geo/PROVENANCE.md` | OSM extract notes. Stale on terrain. See `WORLD_AND_MAP.md`. |
| `data/geo/SYDNEY.md`, `data/geo/HONGKONG.md` | Other zones. |

Character appearance is the code in `src/entities/models.js` (`buildBung`, `buildChing`, `buildGabor`, `buildTrolley`) plus the archive cards in `src/lore/universe.js`. There is no separate model sheet in git.

## Not in the repository — McRebar photographs

Three files were supplied in Cursor on 29 October 2026. They are **not** committed. They show a real Queen Street restaurant and neighbouring shopfronts, including trademark logos. Putting those photographs in this public repository would publish someone else's photos and those marks. Codex does not have them. The owner needs to provide them again in the local workspace, outside git, or attach them to the session.

Do not redraw the logos. The game's sign is McREBAR, and the arch is a gold rebar arch (`mcrebar.js`).

What each file showed, so a remodel can be checked when they are provided again:

1. **Exterior corner, mall side.** Filename in the Cursor assets folder: `Screenshot_2026-10-29_at_10.20.06_am-aa7bcbff-c3f7-4581-a672-7ba16f806df7.png`. A dark podium on the corner, glass retail at mall level, a planted terrace with a glass balustrade on the level above, a glazed corner bay, and street trees and mall canopies around it. Neighbouring fascias carry real shop names. Those names stay off our mesh. The massing to match is the black corner, the terrace, and the two-level split (shops below, restaurant above).

2. **Floor plan.** Filename: `image-fdc566e7-199d-4eab-8f99-68e67416d347.jpg`. A restaurant plan with front seating along a curved mall edge, a young-adult table zone, a long communal table, order and collect counters, and a kitchen behind. **No scale bar was readable.** The in-game width is the OSM frontage, about 18.6 m (`mcrebar.js` edge from `(151.3, 81.4)` to `(137.3, 93.7)`). Use the plan for arrangement, not for millimetre lengths.

3. **Interior counters.** Filename: `image-4ac7d298-773b-47de-829f-bafbafb4b640.jpg`. Perforated timber ceiling, round tables, brown chairs, freestanding order kiosks, a service counter, and a collect area. Menu screens in the photo show branded food. Our screens stay generic.

The current `buildMcRebar` is a simplified version of this list. It is not an accepted match. `KNOWN_ISSUES.md` Bug I.

## Other local screenshots

The same Cursor assets folder contains older screenshots from 12 June, 23 October, 27 October, and 28 October 2026. They were not catalogued as modelling specs. They are not in git. If a future task depends on one, ask for it by date rather than guessing which frame mattered.
