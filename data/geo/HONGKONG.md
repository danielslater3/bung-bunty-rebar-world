# Hong Kong geographic provenance

This district is compiled OpenStreetMap geometry in a local metre grid. It is not a survey plan.

## Source

- Dataset: OpenStreetMap
- Source URL: https://www.openstreetmap.org
- Extract API: https://overpass-api.de/api/interpreter
- Licence: Open Database Licence 1.0 (ODbL) — https://opendatacommons.org/licenses/odbl/
- Attribution: © OpenStreetMap contributors
- Extract `timestamp_osm_base`: 2026-10-22T13:11:49Z
- Accessed: 2026-10-22
- Coverage bbox (south, west, north, east): 22.276, 114.1545, 22.3, 114.1745
- Central, Admiralty, the harbour, and Tsim Sha Tsui, including Two IFC, HSBC, the Central Star Ferry Pier, the Clock Tower and Central Plaza where those ways fall in the bbox.

## Projection

- Origin: vertex centroid of OSM way 25589595 Two International Finance Centre, latitude 22.28528562, longitude 114.15928018.
- Axes: x = east metres, y = up, z = −north metres, from a WGS84 tangent plane at that origin.
- Vertical: Local street datum y=0. Not Hong Kong Principal Datum. No Lands Department terrain model is loaded. Building height is the OSM height tag when that tag exists.

## Counts from this compile

- osmElements: 7149
- buildings: 1384
- buildingsHeightTag: 162
- buildingsLevelsEstimated: 597
- buildingsDefaultEstimated: 625
- outlinesDroppedBecauseParts: 0
- roads: 4434
- roadsWidthTagged: 9
- roadsWidthEstimated: 4425
- bridgePolygons: 14
- waterPolygons: 28
- waterCells: 174443
- parks: 79
- aprons: 0
- coastChains: 5

## Landmark centres

Centres come from the imported OSM geometry. Distances use those centres.

| Landmark | OSM id | latitude | longitude | x | z | height note |
| --- | --- | --- | --- | --- | --- | --- |
| Two International Finance Centre | 25589595 | 22.285298 | 114.159277 | -0.30 | -1.35 | 415.8 m from the height tag |
| Bank of China Tower | 25604760 | 22.279268 | 114.161569 | 235.85 | 666.39 | no height or levels tag on this way |
| HSBC Main Building | 295407347 | 22.280288 | 114.159551 | 27.93 | 553.44 | 178.8 m from the height tag |
| Central Plaza | 27087018 | 22.279958 | 114.173625 | 1478.32 | 589.89 | 309.0 m from the height tag |
| Tsim Sha Tsui Clock Tower | 37664321 | 22.293597 | 114.169533 | 1056.55 | -920.33 | 44.0 m from the height tag |
| Central Star Ferry Pier | 1483823682 | 22.286935 | 114.161145 | 192.14 | -182.67 | 14.0 m from the height tag |
| Exchange Square | 26434739 | 22.284002 | 114.158169 | -114.53 | 142.13 | 15.0 m from the height tag |
| Admiralty Centre | 47117859 | 22.279208 | 114.165224 | 612.55 | 673.05 | no height or levels tag on this way |

## Distance check

`enu` is the game-grid distance between centres. `vincenty` is the WGS84 inverse between the same latitudes and longitudes.

| From | To | ENU m | Vincenty m | ENU − Vincenty |
| --- | --- | --- | --- | --- |
| twoIfc | clockTower | 1400.52 | 1400.49 | +0.024 |
| twoIfc | hsbc | 555.51 | 555.51 | +0.000 |
| twoIfc | starFerry | 264.40 | 264.40 | +0.001 |
| twoIfc | centralPlaza | 1592.44 | 1592.47 | -0.026 |
| twoIfc | bankOfChina | 708.27 | 708.27 | -0.002 |
| clockTower | starFerry | 1136.38 | 1136.35 | +0.023 |
| hsbc | bankOfChina | 236.62 | 236.63 | -0.008 |
| starFerry | admiralty | 953.41 | 953.41 | -0.002 |
| clockTower | centralPlaza | 1568.02 | 1568.02 | +0.001 |

## What is tagged, and what is estimated

- Building height from an OSM `height` tag: 162.
- Building height estimated as `building:levels` × 3.2 m: 597.
- Building height estimated because neither tag exists: 625.
- Road or aeroway width from an OSM `width` tag: 9.
- Width from a class default: 4425. Runways default to 45 m and taxiways to 18 m when the width tag is absent.
- Bridge decks, where present, use the OSM `layer` tag as a stacking order (1.6 m + 2.8 m per layer above 1). That is not a surveyed clearance.
- The walkable surface and, in this district, the harbour or bay fill are a 4 m grid derived from the coastline and the mapped pavement.

## Not imported

- Lands Department 3D Spatial Data building tileset was requested on 2026-10-22 from https://data.map.gov.hk/api/3d-data/3dsd/WGS84/building/tileset.json using the example key published in the CSDI API documentation (https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-spatial-data-api). The response was HTTP 200, tileset version 1.2.3, with a reported 12,199,184 triangles for the whole territory. Those meshes are not loaded in this district.
- The 3D Visualisation Map tile set and the individualised glTF models (1:1000 sheet downloads) were not imported.
- Overture buildings were not downloaded, so there is no second building layer to dedupe.

## Known gaps

- Horizontal geometry is OpenStreetMap, not Lands Department survey control.
- Victoria Harbour in this extract is coastline ways, not one named water polygon. The water surface is a 4 m flood fill from those coastlines. Bank and pier edges can be off by about one cell. Building footprints and non-bridge roads are stamped back to land so piers and promenades stay walkable.
- Two International Finance Centre way 25589595 has height 415.8. HSBC Main Building way 295407347 has height 178.8. Central Plaza way 27087018 has height 309. The Clock Tower way 37664321 has height 44. Bank of China Tower way 25604760 has no height and no building:levels tag, so its extrusion uses the 9 m office default. That height is an estimate. The footprint position is the mapped way.
- Admiralty Centre way 47117859 has no height or levels tag.
- Road width uses the OSM width tag when it parses as metres. Otherwise a class default is used.
- Tunnels, including the Central–Wan Chai Bypass where it is tagged tunnel=yes, are omitted.
- Fictional overlays (portals, Ching at the Star Ferry pier, the smuggler stall, typhoon blobs, neon signs, streetlamps) are not OSM objects.

## Aerial colour

Sentinel-2 cloudless mosaic, about 10 m ground sample. Individual tower facades are not resolved. Lands Department orthophotos are not copied into this game.

- Attribution: Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2020), CC BY 4.0. https://s2maps.eu
- Source: https://s2maps.eu
- Image: `hongkong.aerial.jpg`, 940 by 1217 pixels, about 2.199 m per pixel.
- Ground, water and roofs show this photograph. Flat road and park colours are not drawn over it.
- Wall colour from the photograph inside the footprint: 1329.
- Wall colour from an OSM `building:colour` tag: 12.
- Wall colour from an OSM `building:material` tag: 43. A material tag is a class, not a measured paint colour.
- A top-down photograph does not show facades. Wall colour is the roof colour from that photograph except where a tag replaces it.
