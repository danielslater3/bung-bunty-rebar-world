# Chapters 5–6 checkpoint

Chung's arrival and The Gabor Jealousy Crisis now reuse the existing street planner, guide, collision helpers and chase controller. The 270 m welcome walk and 302 m scooter pursuit use validated routes instead of straight lines across buildings. Journey distance and pursuit proximity time survive save/load. Chung waits rather than resetting the escort. Gabor's race now requires reaching the destination and sustained trolley proximity.

Actor placement checks personal spacing, room boundaries and solid geometry. Chung's feet follow the actual walk surface; her legs, boots, arms and hands animate around new pivots rather than bobbing the whole model. Arrival includes a short walking entrance and modelled luggage. Bicycle and scooter staging now has ground/clearance checks. Shared speaker framing remains restricted to cinematic conversations. The welcome walk and pursuit share the existing gold arrow, ground route trail and live distance HUD.

Verification:

- Native Node regression: 25 tests pass, including actor spacing, destination-gated completion and prior navigation/world/progression tests.
- `tools/tests/pair56.cjs`: both full chapter handler sequences, route clearance, journey checkpoint reload, grounding and sampled cinematic camera/spacing checks pass in an isolated Chrome context.
- `tools/tests/pair56-drive.cjs`: both mission routes complete using actual player/trolley movement and steering input (4,062 walk simulation frames; 2,957 driving frames). Initial mission spawn/mount and final interactions are scripted; this is automated gameplay verification, not a human playthrough.
- Existing `tools/tests/browser.cjs`: opening routes, house movement, garage exit/return, Seb delivery, chapter 1–4 progression, clear-save continuation and indoor dialogue checks pass without page exceptions.
- Rendered screenshots inspected for Chung's arrival close-up and the indoor scooter-reveal dialogue.

Run the game with `python3 -m http.server 8765`. Tests use the commands in `docs/QUALITY_PASS.md`; the optional pair scripts use externally installed Playwright via `NODE_PATH` and accept `GAME_URL`. Source cache token: `20261102-pair56`.

Limits: this is a targeted repair and visible character/presentation upgrade, not an AAA asset replacement or a reconstruction of King George Square/McRebar. Actor separation is checked by placement/movement helpers; NPCs are not rigid-body physics capsules. Trolley travel is accompanied by a ground-following companion, not a newly modelled passenger seat. Full normal-speed human playthrough and hardware frame-rate profiling remain outstanding. Chapters 7–24 were not expanded in this checkpoint.
