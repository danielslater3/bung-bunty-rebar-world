# Brisbane city life and HUD pass — 6 November 2026

The real compiled Brisbane street, building, river and bridge data remains in use. This release adds functioning ambient city systems and fixes known placement/UI problems; it does not replace the map or claim that every structure has been manually surveyed.

## World changes

- City Hall's plaza is subdivided and draped onto the actual terrain. Its final rendered triangles are also registered as walk surfaces. Previously the whole plaza inherited one building-centre elevation, leaving parts suspended on sloping ground.
- Ground-level building foundations, including City Hall, extend below sampled ground around their footprints. Footprint collision uses the matching repaired ground datum. Buildings explicitly marked elevated retain their clearance.
- Queen Street paving has narrower, softer grout instead of the large dark checker grid.
- The six moving boxes on an open traffic line are replaced with twelve detailed cars. Closed circuits are built solely from connected existing motor-road segments. Full vehicle corner sweeps reject building/water intersections. Routes do not jump from an open route's end to its start.
- Three nine-metre-class Rebar shuttles have destination displays, glazing, mirrors, lights, wheels, roof equipment and animated doors. Twelve physical stop boards display estimated arrivals. Buses brake, dwell for five seconds, open doors, continue to subsequent stops and repeat their circuit. E reads a nearby arrival board in both multiplayer and ordinary play.
- Traffic accelerates, slows at corners, queues behind vehicles, reserves junctions and yields to the nearby player. Shared approaches allow the leading vehicle to take a junction reservation so a following car cannot deadlock it. Tyre suspension samples the rendered road datum, including across uneven terrain.
- 220 new layered trees and palms are planted within actual park polygons, away from water, roads, buildings, steep ground and mission pads. Their roots and narrow trunk collisions use real terrain heights. Mall planters and City Hall palms also use the new tree models.
- 38 ambient pedestrians replace the old floating capsule people around the mall and parks. They have faces, hair, hats/bags, clothes, articulated legs/arms and grounded footsteps. Movement resolves building/prop collisions; blocked walkers choose another target.

These are **fictional Rebar shuttle services**, not published Translink routes or timetables. Buses currently provide ambient service and arrival information; passenger boarding is not implemented. The source extract does not retain every traffic restriction, so these are stylised ambient circuits rather than a traffic-law simulation. Ambient traffic/pedestrians are simulated locally, not replicated room entities. Multiplayer players, chat, minigames and quest authority are unchanged.

## Street and landmark detail pass — 8 November 2026

- Mapped road and park edges guide 300 lamps, 84 benches, 901 drain grates and broken lane markings. Furniture clearance checks reject water, steep ground, building footprints and protected mission areas. Lane markings stop at mapped intersections. Placements are in-game estimates.
- Queen Street has staggered stone paving, shopfront frames, rooted canopies and timber seating built into planters. Shop signs stay within their host wall edges. MacArthur Chambers uses sandstone cladding on the existing footprint. City Hall has clock faces, a supported square sign, grounded column plinths and wing windows fitted to the outline.
- Story Bridge has a modelled steel truss with an open road deck. Nearby pedestrian bridges use open handrails and the Brisbane River has small wind-driven ripples. The bridge detail is stylised, based on the [Brisbane City Council heritage trail](https://www.brisbane.qld.gov.au/events-arts-and-culture/art-and-culture/heritage-trails/brisbane-river-heritage-trail). The [MacArthur Museum](https://mmb.org.au/location/) identifies the chambers as sandstone.
- City cars and buses have additional trim and working brake lights. Broadleaf trees have more layered crowns. The native tests check Story Bridge traffic clearance and the new furniture placement. The loaded-scene browser check also captures City Hall, MacArthur Chambers, Story Bridge and a park bench.

## UI

Multiplayer hides the unrelated single-player score, trolley-name and currency counters; room points remain on the room board. The room bar reserves space for the status meters on desktop and moves below a compact meter row on small screens. Chat, route instructions, notices and incidental speech have separate space/visibility rules. Chat hides the route hint while expanded. Dialogue retains the expiry and Enter-to-send fixes from the previous release. Leaving multiplayer restores the normal campaign HUD.

The responsive check covers 1920×1080, 1365×900, 900×700, 768×1024, 390×844, 375×667 and 667×375. It checks panel bounds and overlap with chat open and closed.

## Engineering and validation

- Static vehicle/tree components merge by material; park foliage uses instancing and a bounded 420 m active range. Vehicles render within 260 m. Walkers use detailed models within 55 m and simpler silhouettes farther away, disappearing beyond 150 m. Nearby shadows are limited. No meshes/materials are created in the animation loop.
- Moving traffic uses rotated collision frames. Navigation excludes transient vehicle boxes when compiling its static street graph; temporary cars cannot permanently disconnect an objective route.
- Zone cleanup releases private model materials, stop textures and instance buffers. No new image downloads, frameworks, geography datasets or paid hosting resources were introduced.
- Native checks validate finite model geometry, mesh/triangle budgets, ground-contact bases, real-road circuit closure, car/bus footprint sweeps, bus braking/dwell at 30/60/120 Hz, tyre contact on slopes, low-ground foundation collision and elevated clearance. A 1,000-second simulation exercises all fifteen vehicles together and checks repeated service visits and bounded queuing.
- Loaded-scene checks verify all plaza vertices, tree/pedestrian heights, actual road tyre contacts, all vehicle routes and responsive HUD bounds. Real screenshots are inspected for the bus, car, park, mall and chat layouts.
- Existing opening-chapter and multiplayer browser suites are run as regressions. They exercise mission routes, movement, garage/trolley delivery, chapter continuation, character selection, chat, ten game interfaces, reconnect and campaign-save isolation.

Run the game using `python3 -m http.server 8765` from the repository root. Native checks:

```sh
node --experimental-loader ./tools/tests/loader.mjs --test tools/tests/*.test.mjs
```

With Playwright available externally:

```sh
NODE_PATH=/path/to/node_modules node tools/tests/city-life.cjs
GAME_URL=http://127.0.0.1:8765/ NODE_PATH=/path/to/node_modules node tools/tests/browser.cjs
ROOM_SERVER=https://bung-bunty-rooms.sitecraft-au.workers.dev NODE_PATH=/path/to/node_modules node tools/tests/multiplayer.cjs
```

These automated simulations and screenshot inspections are not an exhaustive city-wide human playthrough or a hardware FPS certification. The existing map still has millions of triangles in some views. Individual distant buildings, unusual underpasses and all later campaign locations have not been manually rechecked in this release. Intentional hovering pickups, waypoint markers, suspended bridge decks, canopies and story effects remain intact.
