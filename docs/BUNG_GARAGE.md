# Bung Garage and rotating tornadoes

## Playing

The former mapped EB Games building is now **Bung Garage**, with a broad entrance ramp, two service bays, demonstration trolleys, lifts, tool cabinets, workbench and tyre rack. Walk or drive inside and press **G**. In multiplayer, the Rebar Exchange has **Find Bung Garage**, and the S24 City Map has a garage destination.

The parts menu has Power, Handling, Range and Style sections. Each of the ten trolley editions keeps its own purchased and fitted parts. Buying fits a part immediately. Removing it retains ownership, so fitting it again costs nothing. An engine or tyre choice replaces that slot's current part; turbo and supercharger are alternatives.

There are 25 parts: V4/V6/V8/V12 engines, turbocharger, supercharger, four tyre choices, lowered/raised suspension, negative camber, two tanks, nitro, brakes, three underglows, stripes, number plates, rear wing, light bar and twin exhaust. Parts have visible fittings and corresponding handling, speed, acceleration, boost, slope-drive, fuel or light effects. These are arcade tuning presets, not an engine or tyre simulation. Nitro strengthens the existing Shift boost and consumes its fuel.

Campaign, replay, free roam and rooms now use one permanent player profile for rebar and purchased trolley builds. Purchases and earnings transfer across modes and room changes. The profile is cloud saved independently of campaign checkpoints and room expiry. Open **Player Profile** in the menu or S24 Wallet to copy the private recovery code for another device. See [permanent profiles](PERMANENT_PROFILE.md). Racing uses the selected garage build with a 44 m/s trolley speed ceiling; garage purchases are blocked while enrolled in a race.

## Weather

Rebar is now the spending currency throughout campaign and rooms. Former BungBucks balances migrate into rebar once at 1:1. Score sells directly into rebar at 10:1 in either Exchange. Campaign character upgrades, food, maps and empire purchases spend rebar; trolley tuning is sold only through the new garage UI. Existing purchased upgrades remain effective. Normal and graded campaign rebar pickups respawn after 45 seconds, including across reloads; unique story pickups remain collected. Multiplayer keeps its existing server-timed pickup respawns. The wallet is shared through the permanent profile; chapter progress remains a separate campaign save.

Tornadoes ray march a three-dimensional density field with 40 bounded samples. Rotating, rising noise at three scales, changing radius, asymmetric bends and orbiting sub-vortices animate the actual condensation volume. EF5 has a broader, optically denser dark core. Existing warnings, wind, player throws, airborne vehicles and temporary building damage remain connected to the same forecast. There are no new weather image assets.

Room clients use the room code and shared server clock for weather. The singlet and sunshine announcements use the visible room notice. Multiplayer uses the same throw strength as campaign; movement validation allows a short, bounded higher-speed window around a server-derived tornado and rejects excessive travel after recovery. Ordinary movement limits and arena restrictions remain in place.

Rendering references: Guerrilla's [Nubis, Evolved](https://www.guerrilla-games.com/read/nubis-evolved) discusses efficient volumetric cloud and superstorm rendering. The [NWS tornado lifecycle guide](https://www.weather.gov/spotterguide/tor_life) informed formation and dissipation. This remains a stylised procedural game effect; it is not a fluid-dynamics simulation or verified photorealistic rendering.

## Validation and development

Run a static server from the repository root, for example `python3 -m http.server 8765`, then visit `http://localhost:8765`. Multiplayer also needs the configured public Worker or `npm --prefix multiplayer run dev` with the local server selected in the room connection screen.

Automated checks:

```sh
node --loader ./tools/tests/loader.mjs --test tools/tests/*.test.mjs
npm --prefix multiplayer test
NODE_PATH=/path/to/playwright/node_modules node tools/tests/garage-browser.cjs
ROOM_SERVER=http://127.0.0.1:8796 NODE_PATH=/path/to/playwright/node_modules node tools/tests/room-events.cjs
ROOM_SERVER=http://127.0.0.1:8796 NODE_PATH=/path/to/playwright/node_modules node tools/tests/weather-phone.cjs
```

The browser checks use disposable profiles. They position players at controlled starting points, step actual trolley physics through the garage entrance and exit, buy/equip parts, restore a campaign purchase from storage, and check two-player purchase/appearance synchronization. Room regression covers invitations, a completed tic-tac-toe match, racing checkpoints and reset. Weather regression renders the shader, measures frame-to-frame funnel changes and dark coverage, checks cloud colour, EF4/EF5 throws, vehicle flight and temporary building deformation. Shared weather and both weather sayings are checked in two room clients.

This does not constitute a complete human campaign playthrough or hardware performance certification. Building damage is temporary visual deformation with gameplay-safe restoration. Garage clearance is tested along the entrance and centre aisle; every parking angle and combination of all parts has not been played manually.

The garage conversion excludes exactly one compiled building shell, its original footprint collider and its shop-sign host; other mapped shops retain their signs. A dedicated floor sampler and a 14 m approach ramp join the existing terrain. Rotated colliders use the swept local-space resolver, avoiding the old second-pass trolley crash test against their broad world boxes. Navigation copies its input positions so moving a player cannot mutate an already-planned path.
