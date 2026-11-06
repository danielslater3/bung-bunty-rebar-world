# Chapters 9–10 release — 5 November 2026

This pair replaces the lawsuit lawn encounter with a playable court hearing and the W victory lawn with a streamed hotel visit. The six acts and Chapters 11–24 are preserved. The old scooter-finish lawn remains the Chapter 6 race endpoint; it no longer pretends to be the hotel.

## Implemented gameplay

Chapter 9 has visible receipt, witness and goggles exhibits at clear standing locations near their original districts. One gold route system guides the next outstanding item, with route distance and evidence counts. Inspection conversations commit only on completion; interrupted interviews remain available. The photograph must be printed at Queen Street rather than running its timing challenge remotely. The hearing is at the mapped Magistrates Court complex, 363 George Street. The Parliament lawn plaque remains part of the brief's history.

The furnished hearing includes judge, clerk, witness stand, public gallery, counsel tables and physical exhibit displays. Four evidence questions include contradicting Gabor's goggles denial. Wrong exhibits are safely overruled, each correct answer checkpoints, missing legacy-save exhibits send the player back to recover them, and the canonical $10,000 reward remains idempotent. Judge shots use the same collision-aware conversation camera as the rest of the saga.

Chapter 10 begins outside court and routes along the existing city streets to W Brisbane's published map pin at 81 North Quay. It includes reception/check-in, room key, animated lift doors and floor selection, room 901 and its sliding door, room inspection, four facility visits, a meal at The Lex, Gabor's dance interruption, the replacement blue phone, a nighttime river-window conversation, then the original West End ending.

Nine selectable stops: Welcome/Living Room Bar, The Lex (3), WET Deck (4), AWAY Spa (5), FIT Gym (6), guest floors 9/12/18/24. Each guest floor has four doors that open and four furnished rooms; the upper-floor suite template adds lounge furniture. Beds, lamps, desks, wardrobes/Mixbars, drum-style baths, shower screens, basins, mirrors, curtains, windows, seating, dining settings, poolside loungers, treatment tables and individually assembled gym equipment are modelled. Selected furnishings and facility stations have interactions; this does not mean every decorative object is interactive.

The lift UI supports normal buttons, keyboard focus, Back and Escape without leaving Bung frozen. Trolleys stay outside venue interiors. Chung uses grounded collision-aware following and is restaged at floor transitions. Active hotel-floor state, key, room access, visited facilities, evidence and trial question survive save/load. Legacy Chapter 10 steps migrate by their old narrative beat. Chapter replays keep the main save isolated.

## Geography, rendering and ownership

The existing compiled OSM dataset is unchanged. Two specific original building rings are identified and receive custom facade detail. The original ring remains the exterior collision boundary, disabled only while its own interior is active. Floors are rotated into their mapped NW–SE wings; automated sampling checks their complete rectangular envelopes against those original polygons. Player collision, local navigation and camera tests use the true rotated box planes, avoiding oversized world-axis boxes blocking corridors.

The hotel retains its mapped outline/height and adds 35-storey articulation, pale blades, curved glass bays, window bands, W lettering, canopy, bollards and proximity-animated arrival doors. Repeated facade details use material/geometry instancing. Only one interior floor is resident; changing floors removes its meshes, colliders, grounds, interactions and owned sign textures/materials. Furniture templates share geometry and a small palette. Camera checks use boxes and footprint hashes, never the whole city mesh.

## Sources and architectural limits

- [W Brisbane official overview](https://www.marriott.com/en-us/hotels/bnewh-w-brisbane/overview/) and its map link: address, hotel location, rooms/facilities, river-inspired design and drum bath references.
- [Official photo gallery](https://www.marriott.com/en-us/hotels/bnewh-w-brisbane/photos/): public interior/exterior references.
- [DBI's W Brisbane project](https://www.dbi.com.au/project/w-brisbane): tower/podium architecture, 35 storeys, masterplan and Level 4 landscape imagery.
- [W Brisbane dining hub](https://www.wbrisbanedining.com/digital-hub) and [hotel welcome information](https://mds-assets.marriott.com/cms-platform-for-marriott/bnewh-w-brisbane-dining/welcome-letter-until-5th-april.pdf): public facility-level references.
- [Queensland Courts directory](https://www.courts.qld.gov.au/newsroom/contact-us/courts/magistrates-courts): 363 George Street court address.

No reference photographs or downloaded third-party models are shipped. All new geometry is code-built. Interior plans are fictional, compressed adventure-game layouts inspired by public references, not surveyed floor plans. This is a substantial stylised hotel, **not a complete architectural replica**: 16 guest rooms across four representative floors are accessible, not all 312 real rooms; the pool has safe shallow water, not a new swimming simulation; spa, dining and exercise use interaction conversations rather than deep facility minigames. Hotel/court interiors are attached to saga play. Some exterior proportions and the arrival-to-lobby transition remain approximate.

## Verification

Run the unchanged static app from the repo root:

```sh
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`, Continue, or use the chapter dashboard for unlocked chapters. New Saga replaces the campaign save. No build/install is needed.

Native tests:

```sh
node --experimental-loader ./tools/tests/loader.mjs --test tools/tests/*.test.mjs
```

38 tests pass: all prior bridge/navigation/chase/replay/rhythm checks plus mapped floor-envelope sampling, rotated swept collision/aisle clearance, local-plane camera intersections, legacy hotel migration/idempotence and hotel objective/stop consistency.

Optional isolated loaded-browser tests need external Playwright and installed Chrome:

```sh
NODE_PATH=/path/to/test-dependencies/node_modules node tools/tests/pair910.cjs
NODE_PATH=/path/to/test-dependencies/node_modules node tools/tests/dashboard-gameplay.cjs
NODE_PATH=/path/to/test-dependencies/node_modules node tools/tests/pair78.cjs
```

`pair910.cjs` completes both chapters through their real mission handlers, checks interrupted evidence conversations and reloads, rejects a wrong exhibit, resumes a trial checkpoint, verifies exactly one lawsuit award, performs check-in and lift selection, walks to/through room 901 with actual player physics, visits every facility, opens/walks into the 12 additional guest rooms, checks camera containment, cancels the lift with Escape, completes dinner/dance/phone/night and checks the final clear state. Long city legs validate every route segment against loaded collision geometry, then place the player at the destination. They are not driven metre by metre. Rendering is suppressed for simulation and explicitly enabled for inspected exterior, court, lobby, bedroom and nighttime screenshots.

The dashboard regression loads Chapters 1–10 through the actual chapter UI, checks camera position and keyboard movement after scenes, and checks intended rhythm freeze. The prior Chapter 7–8 loaded simulation still passes, including evidence carried into Chapter 9. These checks do not constitute a full human playthrough, an exact architecture audit or a hardware frame-rate benchmark.

**Status:** Chapter 9's core adventure and Chapter 10's complete mission sequence are implemented and automated completion is verified. The hotel architecture/art requirement remains partial for the reasons above. No Chapter 11–12 development is included.
