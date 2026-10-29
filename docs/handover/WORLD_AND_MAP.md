# World and map

The Brisbane district is the campaign map. Do not replace it, simplify it, or invent latitudes. Sydney, Hong Kong, and Shenzhen exist as other zones. They are not the current story setting.

## Sources that are actually compiled in

From `src/world/geo/brisbane.data.js` `meta` and `tools/enrich_brisbane.py`:

- Plan geometry: OpenStreetMap via Overpass. Licence ODbL. Attribution © OpenStreetMap contributors. Extract timestamp `2026-10-23T00:07:25Z`. Coverage bbox south -27.4915, west 153.0, north -27.4595, east 153.0465.
- Ground heights: Queensland Government LiDAR DEM (Elevation/QldDem), Brisbane 2019 survey, sampled onto the 4 m walk grid in metres AHD by `tools/enrich_brisbane.py`. `src/world/geo/terrain.js` decodes `grid.terrain`.
- Roof and facade attributes: OSM `height` when present. Otherwise Queensland Building Footprints LiDAR attributes when the enrich script matched them. Estimated heights remain where neither exists.
- Bridge decks: OSM outlines, abutments on the DEM, river spans using Maritime Safety Queensland air-draft clearances encoded by the enrich script.
- Colour: Queensland public orthophoto, `src/world/geo/brisbane.aerial.jpg`, draped on ground, water, and roofs (`aerial.js`, `buildCity.js`). Attribution is in `data/geo/PROVENANCE.md`. Wall colour is mostly the roof colour from that top-down photo, not a surveyed facade.
- A City Hall reference photo with a Commons CC BY-SA 4.0 note is `src/world/geo/ref/city-hall-square.jpg`. It is a colour reference. It is not projected onto the model. See `CITY-HALL-PHOTO.txt` in that folder.

Not in this compile: Overture Maps, a second building layer to dedupe, Hong Kong Lands Department tiles as part of Brisbane. `data/geo/PROVENANCE.md` is right about the OSM plan and wrong about "no digital terrain model". The enrich step ran later.

`tools/compile_brisbane_geo.py` builds the OSM plan. `tools/bake_aerial.py` bakes the orthophoto. `tools/enrich_brisbane.py` rewrites `brisbane.data.js` in place. `tools/compile_district.py` is the shared compiler used for other cities. Do not re-run these unless you intend to regenerate the city, and do not commit a regenerated city that drops the LiDAR grid.

## Coordinates

`src/world/geo/project.js`:

- WGS84 local east-north-up tangent plane.
- Origin: vertex centroid of OSM way 10836280, Brisbane City Hall. Provenance records latitude -27.46890884, longitude 153.02353792.
- `x` = east metres. `z` = **minus** north metres. `y` = up. Smaller `z` is north. `+z` is south.
- `enu(lat, lon, lat0, lon0)` and `vincenty(...)` are the converters. `verifyGeo(geo)` checks stored landmarks against a fresh projection. Tolerance in that function is 0.05 m for a landmark and 0.75 m against Vincenty for the stored checks.

Scale is 1 metre of geometry to 1 metre of Brisbane. Do not apply a fudge scale.

Walk grid, from the terrain comment and the compiled grid: `minX` about -2334.485, `minZ` about -1050.603, cell 4 m. `heightAt` and the terrain mesh share `cornerHeight`, including the gentler-diagonal split. `walkAt` uses the river surface on water cells and otherwise `max(heightAt, BANK_Y)`.

Landmark objects carry both a flat-era `y` and an absolute `ya`. Gameplay placement should use `ya` when it is present (`universe.js` already does `ya ?? y`). Do not "correct" a landmark by overwriting `y` if saves or old props key off it. Do not invent a missing tower to fill a hole in OSM.

`RIVER_SURFACE` is the drawn river. The data meta says the river surface is drawn at -0.32 m AHD. Do not retune that to chase a screenshot.

## How the city is built

`buildOsmBrisbane` in `src/world/geo/buildCity.js`:

1. Imports `BRISBANE_GEO` from `brisbane.data.js`. This module is large. Do not import it from `main.js` or from a module the menu loads on the first frame.
2. `verifyGeo`.
3. `createTerrain` plus `easeKerbs` so 2–5 m kerb steps do not become spikes. Steep surveyed cliffs are left.
4. Roads, parks, river sheet, bridges, building shells (`facades.js`), mall dressing (`brisbaneDetail.js`, `cbdFronts.js`, `cbdStreets.js`, `shopSigns.js`).
5. Collision from footprint rings and explicit boxes, stored on `zone.colliders`. Interiors of OSM buildings are not modelled. A footprint is solid.
6. `dressBrisbane` from `rebirthZones.js` adds fictional story props on the grid.
7. `sampleGround` exposed on the zone comes from the terrain. `Saga.ground` calls it.

Chunks are about 240 m (`CHUNK` in `buildCity.js`). The gameplay camera far plane is **600** (`Game` constructor). Story Bridge's centre is about 1217 m from City Hall, so distant meshes can clip. Do not "fix" that by raycasting the city.

`cameraClearance` tests boxes. A full `intersectObject(zone.group)` was measured around 85 ms and dropped the game to a few frames per second. That approach stays forbidden.

## Navigation

Pedestrian and vehicle guidance for the saga does **not** pathfind on the live road graph.

- Street guidance: `src/story/routes.js` exports `ROUTES`, a dictionary of polylines such as `gate>door`. `guide.js` `pickRoute` selects one and locks a segment index so the arrow does not flip when the closest point jitters. The comment in `routes.js` says the polylines were kept within 12 m of the road, mall, and bridge graph.
- Chase: `CHASE_PATH` in `sagaData.js`, 35 points, from `[146.4, 90.0]` outside McRebar to `[358.4, -64.7]`. It follows the Queen Street mall centreline (OSM pedestrian way, the same spine as `BRISBANE_GEO` mall samples) and then the street approach in front of the mapped Apple Store. It does not enter the shop footprint.
- The Apple Store in this map is the shop node in `src/world/geo/brisbane.shops.js`: `["APPLE STORE", 371.82, -65.92, ...]`. That node sits inside a building. The chase ends on the street approach, about 13 m from the node. Do not claim a surveyed storefront, and do not drive Gabor to the node.
- `ESCORT_PATH` and `SCOOTER_PATH` in `sagaData.js` are short polylines for chapters 5 and 6. They are not the Queen Street chase.
- Chapter index greater than 3 disables `guide.js` street routes. Later chapters do not get the baked arrow.

Gabor's saga chase never calls a navmesh. `Saga.moveGabor` samples the polyline and skips forward 1.4 m, up to four times, if `inCollider` says the sample is inside a `zone.colliders` box.

## Landmarks used by the story

Centres below are the gameplay `PLACE` pads or the shop node, in metres from City Hall. They are not new surveys.

| Name | Where | Notes |
| --- | --- | --- |
| City Hall | grid origin | Landmark in the data file. |
| West End house | `PLACE.home` `-820, 900` | Fictional house on the DEM near Davies Park. Not an OSM building that was remodelled. |
| McRebar | runtime `PLACE.mcrebar`, built from the mall edge of the OSM tenancy around `(133.67, 69.17)` | See below. |
| Queen Street Mall | centreline through `(173.1, 81.5)` | Pedestrian way, not the 15 m way that merely carries the name. |
| Apple Store approach | chase end `(358.4, -64.7)` | Shop node `(371.82, -65.92)`. |
| King George Square | `PLACE.hall` `(27, 69)` and `PLACE.plaza` `(5, 80)` | Two pads. Do not merge them casually. |
| South Bank | `PLACE.bank` `(-200, 780)`, collector `PLACE.event` `(-150, 860)` | Park polygon. The collector lawn is fictional. |
| Parliament lawn | `PLACE.court` `(306, 630.4)` | The plaque is fictional. The footprint is OSM way 8040447. |
| Davies Park | `PLACE.pitch` `(-1900, 1000)` | OSM park. West of longitude 153.0 is outside the extract. |
| Victoria Bridge bank | `PLACE.river` | Bomb-catch chapter. |
| Victory lawn | `PLACE.wlawn` `(-80, 280)` | Stand-in. The W hotel is not in this extract. The archive text says so. |

## McRebar on the real frontage

`src/story/mcrebar.js`:

- Mall-facing edge from `(151.3, 81.4)` to `(137.3, 93.7)`, length about 18.62 m. Midpoint about `(144.3, 87.55)`.
- `mcrebarPoint(along, depth)` places points in that frame. Positive depth goes into the tenancy.
- `insideMcRebar`: along -8.1..8.1 and depth -1.2..11.8.
- `clampMcRebar` pulls a camera or actor back inside, with a margin.
- Floor `y` is the constant **13.9**. The door's street height is `saga.ground(door)`, which is lower. The restaurant is treated as the level above street retail, reached by a mall stair. 13.9 is a modelled floor, not a surveyed finished-floor level.
- Signage in code is McREBAR / 130 Queen Street. The arch is a gold rebar tube, not a lettermark.
- `buildMcRebar` returns an object with `inside`, `y`, `ceil` (`y + 2.85`), `spot` (order counter), and a meal mesh.
- `Game.indoorRoom` returns `{ kind: 'bar', floor, ceil }` when `bar.inside(x, z)` and the feet are between `y - 1.2` and `y + 3.3`.

The plan used as a layout reference has no readable scale bar. The OSM frontage is the width. The plan's arrangement (front seating, dining, order, collect, kitchen) is what the interior approximates. It is not a millimetre survey. Photographs are not in the repository. See `REFERENCES.md`.

Chain wordmarks drawn elsewhere on Queen Street live in `cbdFronts.js` and `shopSigns.js` as fictional stand-in signs. Do not add real brand wordmarks.

## House and interiors

`buildHouse` (`house.js`):

- Footprint about `home.x ± 6.2` by `home.z - 4.6` to `home.z + 5.4`. Floor `y` is the peak of `saga.ground` under the footprint plus 0.04. Ceiling is `y + 2.68` in the room AABBs (roof box at `y + 2.72`).
- Bedroom is the north side of that plan. Living, kitchen, wardrobe, and cupboard are in the same volume. There is **no separate bathroom mesh**.
- Two room AABBs are returned on `house.rooms`: the house, and the garage. `indoorRoom` returns the first match. The garage sits east of the house, so a point inside the house box matches the house first.
- Garage: `minX = X1 + 0.35`, width 7.6 m, door opening 3.6 m on the **west** wall (`minX`). The north wall is solid because a real OSM building sits north of the yard. One comment in `house.js` still says "north door". The geometry does not. Heading stored on the garage object is `-PI/2` (west).
- The door hinge rotates up. When `hinge.rotation.x > 0.75`, the door's `Box3` is removed from `zone.colliders`. Closing puts it back. `Saga.openGarage`, `closeGarage`, `toggleGarage`, `tickGarage`.
- Driveway slabs run west from the door, then north to `PLACE.gate`, which `buildHouse` sets to about `(-844.3, 877.1)`.

OSM buildings do not have enterable interiors. The only interiors are the saga house, its garage, McRebar's tenancy, and the later mansion shell from `Saga.ensureMansion`.

## Extending Brisbane without breaking it

- New story pads go in `PLACE` as `{ x, z, label }`, then `Saga.ground` supplies `y`. Check the pad is not inside a footprint (`pushFootprints` / collider sample) before calling it a meeting point.
- New streets for the arrow are new keys in `ROUTES`, baked offline from the existing road graph. Do not runtime-parse `brisbane.data.js` inside `guide.js`.
- Do not move City Hall's origin. Every landmark, route, and save position is in this tangent plane.
- Do not lower the far clip, delete `grid.terrain`, or replace orthophoto roofs with flat colours.
- Fictional props stay off the footprint interiors and should read as fiction in archive text.
- Known map leftovers that are **not** tasks: a steep 2019 LiDAR slope north of City Hall, and dark strips where the orthophoto meets simplified asphalt. Do not rebuild the terrain to chase them.
