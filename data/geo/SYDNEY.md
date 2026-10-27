# Sydney Airport geographic provenance

This district is compiled OpenStreetMap geometry in a local metre grid. It is not a survey plan.

## Source

- Dataset: OpenStreetMap
- Source URL: https://www.openstreetmap.org
- Extract API: https://overpass-api.de/api/interpreter
- Licence: Open Database Licence 1.0 (ODbL) — https://opendatacommons.org/licenses/odbl/
- Attribution: © OpenStreetMap contributors
- Extract `timestamp_osm_base`: 2026-10-22T13:18:58Z
- Accessed: 2026-10-22
- Coverage bbox (south, west, north, east): -33.975, 151.15, -33.92, 151.2
- Sydney Kingsford Smith public airfield geometry inside the bbox: terminals, runways, taxiways, aprons, access roads and the shoreline where those ways are mapped.

## Projection

- Origin: vertex centroid of OSM way 1338678861 Kingsford Smith Airport - International Terminal, latitude -33.93664658, longitude 151.16615896.
- Axes: x = east metres, y = up, z = −north metres, from a WGS84 tangent plane at that origin.
- Vertical: Local airfield datum y=0. Not the Australian Height Datum. No NSW elevation model is loaded.

## Counts from this compile

- osmElements: 8568
- buildings: 1864
- buildingsHeightTag: 5
- buildingsLevelsEstimated: 393
- buildingsDefaultEstimated: 1466
- outlinesDroppedBecauseParts: 1
- roads: 5339
- roadsWidthTagged: 52
- roadsWidthEstimated: 5287
- bridgePolygons: 0
- waterPolygons: 34
- waterCells: 541136
- parks: 71
- aprons: 253
- coastChains: 2

## Landmark centres

Centres come from the imported OSM geometry. Distances use those centres.

| Landmark | OSM id | latitude | longitude | x | z | height note |
| --- | --- | --- | --- | --- | --- | --- |
| Kingsford Smith Airport - International Terminal | 1338678861 | -33.936773 | 151.166157 | -0.19 | 13.98 | no height or levels tag on this way |
| Runway 16L/34R | 186842426 | -33.958198 | 151.190529 | 2253.07 | 2390.53 | no height or levels tag on this way |
| Runway 16R/34L | 219359696 | -33.946316 | 151.175969 | 906.98 | 1072.57 | no height or levels tag on this way |
| Runway 07/25 | 219847158 | -33.940952 | 151.175495 | 863.18 | 477.53 | no height or levels tag on this way |
| Runway 16L | 510285760 | -33.950822 | 151.188614 | 2076.00 | 1572.35 | no height or levels tag on this way |

## Distance check

`enu` is the game-grid distance between centres. `vincenty` is the WGS84 inverse between the same latitudes and longitudes.

| From | To | ENU m | Vincenty m | ENU − Vincenty |
| --- | --- | --- | --- | --- |
| terminal | rwy16L34R | 3274.93 | 3274.74 | +0.192 |
| rwy16L34R | rwy16R34L | 1883.88 | 1883.71 | +0.172 |
| terminal | rwy16R34L | 1394.12 | 1394.08 | +0.033 |

## What is tagged, and what is estimated

- Building height from an OSM `height` tag: 5.
- Building height estimated as `building:levels` × 3.2 m: 393.
- Building height estimated because neither tag exists: 1466.
- Road or aeroway width from an OSM `width` tag: 52.
- Width from a class default: 5287. Runways default to 45 m and taxiways to 18 m when the width tag is absent.
- Bridge decks, where present, use the OSM `layer` tag as a stacking order (1.6 m + 2.8 m per layer above 1). That is not a surveyed clearance.
- The walkable surface and, in this district, the harbour or bay fill are a 4 m grid derived from the coastline and the mapped pavement.

## Not imported

- NSW Spatial Services datasets were not downloaded. Runways, taxiways, aprons and terminal footprints in this file are OpenStreetMap.
- No airport interior floor plan was imported. Passenger-building interiors are not reconstructed from a measured plan.

## Known gaps

- Horizontal geometry is OpenStreetMap. It is not an Airservices Australia or Sydney Airport survey.
- The way tagged International Terminal T1 (1338678861) measures about 94 m by 140 m. Nearby roofs and aprons stay separate OSM objects and were not merged into that terminal.
- Runway way 186842426 (16L/34R) has a mapped extent of about 2.1 km. Way 219359696 (16R/34L) is about 3.8 km. Way 219847158 (07/25) is about 2.3 km. Those are the lengths of the imported ways, not a claim that every published runway is complete. Several runway ways carry width=45.
- At about 3.3 km from the terminal the tangent-plane distance and the WGS84 geodesic differ by about 0.2 m. That is the projection, recorded in the distance table.
- Runway and taxiway widths use the OSM width tag when it parses as metres. Otherwise runway defaults to 45 m and taxiway to 18 m. Those defaults are estimates.
- The bay shoreline comes from coastline ways, filled on a 4 m grid. Where coastline coverage inside the bbox is incomplete, the fill can mis-classify a strip along the edge.
- Restricted airside operational detail beyond what OpenStreetMap already publishes is not added.
- Fictional overlays (the passport booth, RP100 gate, burger hoard, portals, check-in props and aircraft props) sit on this grid and are not surveyed airport objects. The terminal interior is not claimed.

## Aerial colour

NSW Spatial Services orthophoto for this bbox, draped on the ground, the bay and the roofs.

- Attribution: © Department of Customer Service 2020. NSW Imagery is published Creative Commons Attribution 3.0.
- Source: https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer
- Image: `sydney.aerial.jpg`, 3105 by 4096 pixels, about 1.494 m per pixel.
- Ground, water and roofs show this photograph. Flat road and park colours are not drawn over it.
- Wall colour from the photograph inside the footprint: 1863.
- Wall colour from an OSM `building:colour` tag: 1.
- Wall colour from an OSM `building:material` tag: 0. A material tag is a class, not a measured paint colour.
- A top-down photograph does not show facades. Wall colour is the roof colour from that photograph except where a tag replaces it.
