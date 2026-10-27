# Brisbane geographic provenance

This district is compiled OpenStreetMap geometry in a local metre grid. It is not a survey plan and it is not a claim of complete 1:1 city detail.

## Source

- Dataset: OpenStreetMap
- Source URL: https://www.openstreetmap.org
- Extract API: https://overpass-api.de/api/interpreter
- Licence: Open Database Licence 1.0 (ODbL) — https://opendatacommons.org/licenses/odbl/
- Attribution: © OpenStreetMap contributors
- City extract `timestamp_osm_base`: 2026-10-23T00:07:25Z
- River and South Bank extract `timestamp_osm_base`: 2026-10-23T00:08:20Z
- Accessed: 2026-10-23
- Coverage bbox (south, west, north, east): -27.4915, 153.0, -27.4595, 153.0465
- Districts inside that bbox include the CBD, Queen Street, City Hall, Parliament House, the City Botanic Gardens, South Bank Parklands, South Brisbane, West End through Davies Park, and Kangaroo Point through Raymond Park and the Kangaroo Point Bridge, plus the Story, Victoria, Goodwill, Kurilpa, William Jolly and Kangaroo Point bridges where those ways fall in the bbox. Orleigh Park continues west of longitude 153.000 and is only partly inside.

## Projection

- Origin: vertex centroid of OSM way 10836280 Brisbane City Hall, latitude -27.46890884, longitude 153.02353792.
- Axes: x = east metres, y = up, z = −north metres, from a WGS84 tangent plane. Meridian radius M and prime vertical N are computed at that origin.
- Vertical: local street datum y = 0. This is not Australian Height Datum. No digital terrain model is loaded.

## Counts from this compile

- osmElements: 23430
- buildings: 11714
- buildingsHeightTag: 274
- buildingsLevelsEstimated: 4551
- buildingsDefaultEstimated: 6889
- outlinesDroppedBecauseParts: 3
- roads: 9896
- roadsWidthTagged: 98
- roadsWidthEstimated: 9798
- bridgePolygons: 74
- waterPolygons: 18
- waterCells: 146698
- parks: 211

## Landmark centres

Centres are derived from the imported OSM geometry. `x` and `z` are metres from City Hall. Distances below use those centres.

| Landmark | OSM id | latitude | longitude | x | z |
| --- | --- | --- | --- | --- | --- |
| Brisbane City Hall | 10836280 | -27.468908 | 153.023555 | 1.67 | -0.09 |
| Parliament House | 8040447 | -27.475455 | 153.027255 | 367.43 | 725.37 |
| Victoria Bridge | 483669189 | -27.472380 | 153.021085 | -242.49 | 384.62 |
| Story Bridge | 502370129 | -27.468242 | 153.035848 | 1216.73 | -73.89 |
| Goodwill Bridge | 483377636 | -27.480498 | 153.027148 | 356.87 | 1284.22 |
| Brisbane City Botanic Gardens | 4282955 | -27.476907 | 153.029649 | 604.02 | 886.33 |
| South Bank Parklands | 532905 | -27.476334 | 153.021748 | -176.93 | 822.75 |
| Queen Street Mall | 544524542 | -27.469644 | 153.025289 | 173.10 | 81.50 |
| Queen Street Mall (named fragment) | 544524541 | -27.470957 | 153.023559 | 2.06 | 226.93 |
| The Wheel of Brisbane Ticket Office | 589533605 | -27.475200 | 153.020827 | -267.91 | 697.10 |
| Davies Park | 24315115 | -27.478281 | 153.004112 | -1920.02 | 1038.57 |
| Raymond Park | 10305671 | -27.480692 | 153.038249 | 1454.08 | 1305.65 |
| Kangaroo Point Bridge | 1358506442 | -27.471409 | 153.033018 | 936.98 | 277.05 |

## Distance check

`enu` is the straight-line distance in the game grid between footprint centres. `vincenty` is the WGS84 inverse geodesic between the same latitudes and longitudes. `haversine` uses a sphere of radius 6371008.8 m, which ignores ellipsoid flattening and is listed so that difference is not mistaken for a map error.

| From | To | ENU m | Vincenty m | ENU − Vincenty | ENU − haversine |
| --- | --- | --- | --- | --- | --- |
| cityHall | parliament | 812.44 | 812.43 | +0.005 | -1.94 |
| cityHall | queenMall | 189.86 | 189.86 | +0.001 | +0.16 |
| cityHall | storyBridge | 1217.29 | 1217.30 | -0.004 | +2.20 |
| cityHall | victoriaBridge | 455.65 | 455.65 | +0.002 | -0.89 |
| cityHall | botanic | 1071.71 | 1071.70 | +0.012 | -1.91 |
| parliament | victoriaBridge | 698.64 | 698.62 | +0.024 | +0.42 |
| victoriaBridge | storyBridge | 1529.56 | 1529.54 | +0.017 | +2.09 |
| queenMall | parliament | 672.55 | 672.55 | +0.002 | -2.03 |
| storyBridge | goodwill | 1607.42 | 1607.40 | +0.022 | -3.12 |
| cityHall | southBank | 841.99 | 841.99 | +0.001 | -2.72 |
| victoriaBridge | southBank | 443.00 | 443.00 | +0.001 | -1.48 |
| parliament | southBank | 553.00 | 552.96 | +0.033 | +0.95 |
| cityHall | daviesPark | 2184.43 | 2184.36 | +0.070 | +1.45 |
| southBank | daviesPark | 1756.40 | 1756.27 | +0.131 | +3.20 |
| cityHall | kangarooBridge | 975.50 | 975.49 | +0.010 | +1.38 |
| storyBridge | kangarooBridge | 448.80 | 448.80 | +0.002 | -0.63 |
| cityHall | raymondPark | 1953.06 | 1953.00 | +0.057 | -1.00 |
| kangarooBridge | raymondPark | 1151.27 | 1151.25 | +0.014 | -2.75 |

## What is tagged, and what is estimated

- Building height from an OSM `height` tag: 274.
- Building height estimated as `building:levels` × 3.2 m: 4551.
- Building height estimated because neither tag exists: 6889.
- Road width from an OSM `width` tag: 98.
- Road width from a highway-class default: 9798.
- Bridge vertical position: estimated from the OSM `layer` tag, as stated above. Story Bridge way 502370129 is `man_made=bridge`, `bridge:structure=suspension`, `layer=2`. Way 507264554 carries `start_date=1940-07-06` and `bridge=cantilever`. Neither way in this extract has a `height` tag.
- Queen Street Mall: way 544524541 is the feature named Queen Street Mall and is about 15 m long. The walkable mall centreline is the longest `highway=pedestrian` way named Queen Street.

## Not imported

- Overture Maps GeoParquet was not downloaded. Buildings in this district are OpenStreetMap only, so there is no second copy to dedupe.
- Queensland Spatial Catalogue, Queensland Globe and Brisbane City Council extracts were not downloaded. No LiDAR, no official building-footprint layer, no digital terrain model.
- Hong Kong Lands Department 3D Tiles and NSW Spatial Services are not part of this Brisbane compile.

## Known gaps

- Horizontal geometry is OpenStreetMap, not a Queensland survey control network.
- Building height is the OSM height tag when present. building:levels uses 3.2 m per level (estimated). Missing both uses 6 m for houses/garages, 16 m for apartments, 9 m otherwise (estimated).
- OSM layer is not a height. Bridge decks use 1.6 m + 2.8 m per layer so stacked bridges separate. Published navigational clearances were not applied.
- Road width uses the OSM width tag when it parses as metres. Otherwise a class default is used and marked estimated.
- The walkable surface is a 4 m grid. Rendered river and park outlines use the clipped OSM rings. Bank and grid can differ by up to one cell.
- Tunnels and underground ways are omitted. Building collision uses the footprint ring, not an interior.
- No Overture Maps, Queensland LiDAR, or Brisbane City Council footprint extract is in this file.
- Queen Street Mall spawn follows pedestrian way 544524542, not the 15 m way named Queen Street Mall.
- The west edge is longitude 153.000. Davies Park sits inside it. Orleigh Park and part of West End Riverside Lands Park cross that edge, so the riverbank west of it is not in this compile.
- Kangaroo Point Cliffs are not a separate mesh. This extract has Kangaroo Point Cliffs Drive as a service road and no natural=cliff polygon. Raymond Park and the Kangaroo Point Bridge are the peninsula anchors.
- Fictional gameplay (McRebar, Seb Daly, the lawsuit plaque, Sir Girderface, portals, the decorative Wheel prop) is placed on this grid and is not an OSM object. The Wheel prop sits at the OSM ticket-office footprint, not an imported wheel model.

## Aerial colour

Queensland public orthophoto for this bbox, draped on the ground, the river and the roofs. The service copyright also names Planet Labs for areas where aerial photography is unavailable.

- Attribution: © State of Queensland (Department of Natural Resources and Mines, Manufacturing and Regional and Rural Development)
- Source: https://spatial-img.information.qld.gov.au/arcgis/rest/services/Basemaps/LatestStateProgram_AllUsers/ImageServer
- Image: `brisbane.aerial.jpg`, 4096 by 3162 pixels, about 1.127 m per pixel.
- Ground, water and roofs show this photograph. Flat road and park colours are not drawn over it.
- Wall colour from the photograph inside the footprint: 11623.
- Wall colour from an OSM `building:colour` tag: 14.
- Wall colour from an OSM `building:material` tag: 77. A material tag is a class, not a measured paint colour.
- A top-down photograph does not show facades. Wall colour is the roof colour from that photograph except where a tag replaces it.
