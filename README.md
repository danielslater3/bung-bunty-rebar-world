# BUNG BUNTY: REBAR WORLD — WORLD DETAIL + CARTOON VISUAL REVAMP 3.0

A 3D comedy action-platformer / open-zone adventure / movement score-chaser /
trolley-racing chaos game. You are **Bung Bunty**, a huge chaotic Aussie legend.
Save Rebar World from **Gabor Mihala** in **OPERATION REBAR: BLUE TO RED**.

100% Bung-approved. No gore, no real brands, maximum rebar velocity.

### What's new in 3.0
- **Cartoon UI** — Fredoka/Nunito fonts, chunky outlined panels, speech-bubble
  dialogue, bouncy hover/squashy press buttons, low-fuel meter rattle.
- **Cartoon ink outlines** (inverted hull) on Bung, Ching, Gabor, the scooter,
  the Golden Trolley, enemies, rebars and coins.
- **Character detail pass** — Bung: wristband, rebar necklace, crumbs, rosy
  cheeks, grease smudge. Ching: headset, wrist tablet, shoulder pads, trolley
  charm. Gabor: villain cape, emblem, fake-rebar bag, goofy scooter exhaust.
- **Brisbane Rebar District** rebuilt as a Queen Street Mall-inspired tiled
  pedestrian mall: shopfronts, McRebar + Burger Bung, shade sails, benches,
  planters, kiosks, fountain, banners, bollards, lamps, pedestrian NPCs, and
  fully fictional funny signage.
- **Sydney Staging Zone** rebuilt as a real terminal: triangular-skylight
  ceiling, glass curtain wall with parked planes + ground vehicles outside,
  check-in counters, departure boards, gate signs, seating lounges, security
  scanners, queue barriers, food court, baggage carts, passenger NPCs.
- **Hong Kong / Shenzhen** density pass: animated LED glyph billboards, hanging
  cables, steam vents, street food stalls, elevated neon walkways, distant
  drone traffic, holographic rebar data, and the colossal **REBAR CORE** tower.
- Procedural canvas textures (mall paving, terminal floor, skylights, LED
  glyphs) — still zero asset files.

### What was new in 2.0
- **RebarChainManager** — one central combo system. Rebars AND portals feed the
  chain; milestones at 5x/10x/20x/50x; chain-expiry warning flash; score tweening.
- **Swept detection** — portals and rebar pickups test the actor's full travel
  segment each frame, so boosting through them at any speed always counts.
- **Trolley wheels fixed** — correct axle (local X), steer pivots on the front
  wheels, spin from real velocity, momentum spin while airborne.
- **Boost state machine** — boost loop audio starts/stops exactly once; running
  dry latches boost off until Shift is released; min-fuel start threshold.
- Camera shake + dynamic FOV (sprint/boost), camera wall collision, jump
  buffering, landing dust, grapple reticle highlight, hover sounds, loading tips,
  trolley fuel stations, props everywhere, and the **Bung Test Paddock** (south
  lawn of the mansion) for verifying portals/rebars/boost/chains in-game.

### Debug mode
Open the game with `?debug` (e.g. `http://localhost:8000/?debug`) to see portal
trigger discs and console logs for portal accept/reject, pickups, chain events,
and boost state transitions.

## How to run

The game is a zero-build Three.js web app (modules loaded from CDN), so it just
needs any static file server:

```bash
cd "Bung Game"
python3 -m http.server 8000
# then open http://localhost:8000
```

(Or `npx serve`, or any equivalent. Opening `index.html` directly via `file://`
will NOT work because ES modules require HTTP.)

Requires an internet connection on first load (Three.js is fetched from
jsDelivr). Everything else — models, sounds, music, voice — is generated
procedurally in code.

## Controls

| Key | Action |
|---|---|
| WASD | Move / steer trolley |
| Mouse | Camera (click the game to lock the pointer) |
| Space | Jump (double jump once upgraded) / trolley drift |
| Shift | Sprint / trolley boost |
| E | Interact / mount / dismount / advance dialogue |
| T | Summon / dismiss the Golden James Rebar Trolley |
| Q | Rebar Chain Grapple (aim at glowing gold markers) |
| F | Belly Bounce attack |
| G | Rebar Pulse (costs 25 Rebar Energy — also hits Gabor's scooter and boss nodes) |
| Esc / P | Bung Control Centre (pause) |

## The game

- **8 main quests** ("operations") across the Blue→Red campaign arc, with an
  objective tracker, briefing dialogue, and rewards.
- **6 zones**: Bung Mansion Hub, Brisbane Rebar District, Sydney Staging Zone,
  Hong Kong Neon Rain City (rain + neon), Shenzhen Cyber Rebar Core, and the
  Rebar Void (floating platforms + 60s Portal Rush score attack).
- **Portal score system**: bronze/silver/gold/cyber portals build a Rebar Chain
  combo multiplier (up to x10). Glitched Gabor portals are traps. Sell score at
  Rebar Exchange kiosks for Rebar Coins (10:1).
- **Golden James Rebar Trolley**: summon, mount, boost, drift, ramp-launch,
  golden particle trail.
- **Enemies**: Gabor Drones, Scooter Gremlins, Portal Leeches, Typhoon Blobs,
  Cyber Rebar Bugs, Burger Bandits — all goofy, all bonkable.
- **Bosses**: the Gabor Scooter Chase (Brisbane) and the MEGA FOREHEAD REBAR
  MACHINE (Shenzhen final boss: nodes → core → fireworks).
- **Shop**: Bung / Grapple / Trolley upgrades, food buffs, early map unlocks.
- **Save system**: autosaves to localStorage on quest completion, purchases and
  zone travel. Continue from the main menu.
- **Audio**: fully synthesized — per-zone procedural music (chill mansion bass,
  Brisbane funk, HK hardtekk, Shenzhen cyber, boss chaos), ~40 SFX, and
  per-character voice beeps with subtitles (swap `AudioManager.sfx`/`voice`
  internals for real recordings later without touching call sites).

## Project structure

```
index.html              entry + import map + HUD/dialogue DOM
styles.css              metallic/neon UI theme
src/
  main.js               bootstrap (menu over a live mansion backdrop)
  core/
    Game.js             main loop, camera, zone loading, damage/score glue
    Input.js            keyboard/mouse + pointer lock
    AudioManager.js     WebAudio synth SFX + music sequencer + voice beeps
    FX.js               pooled particles, shock rings, score popups
    state.js            central state, event bus, save system
    utils.js            math/material/RNG helpers
  entities/
    models.js           procedural Bung/Ching/Gabor/trolley/scooter/props
    Player.js           Bung controller (waddle, grapple, belly bounce, pulse)
    Trolley.js          arcade vehicle physics + drift + golden trail
    Portal.js           pass-through detection + tiers + combo scoring
    Collectible.js      rebars, coins, shards, fuel, burgers, the phone
    Enemies.js          enemy roster + spawners (difficulty scales with score)
    NPC.js              Ching / Gabor world presence
  systems/
    DialogueSystem.js   subtitle/voice queue
    QuestSystem.js      campaign quest chain + event-driven objectives
    ShopSystem.js       Rebar Exchange upgrades/buffs/maps + score selling
    BossEvents.js       Gabor Scooter Chase, Mega Forehead Rebar Machine
  world/
    ZoneKit.js          zone construction toolkit (geometry, weather, triggers)
    zones.js            all six zones
  ui/
    HUD.js              bars, score, combo, quest tracker, toasts, banners
    Menus.js            main/pause/shop/deploy/settings/results/game over
```

## Replacing placeholder assets later

- **Models**: every builder in `src/entities/models.js` returns a `THREE.Group`
  — swap the primitive assembly for a loaded GLTF and keep the `userData` part
  names used by the animators.
- **Audio**: `AudioManager.sfx(name)` and `AudioManager.voice(speaker, text)`
  are the only entry points; point them at sample playback.
- **Music**: replace the sequencer presets in `MUSIC` with streamed tracks per
  zone key.
