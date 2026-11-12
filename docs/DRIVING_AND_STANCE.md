# Trolley dynamics and Stance Lab — 12 November 2026

## Playing

Fit **Drift tyres** in Bung Garage → Handling. Accelerate and turn with W/A/D to break rear traction. The trolley now retains sideways momentum while its body rotates. A steers left and D steers right from the chase camera. Drift tyres use assisted arcade steering: hold a steering key to sustain a fast slide, release it to smoothly straighten out, or countersteer to change direction. Space is an optional rear handbrake for any tyre type. Bounded ground ribbons show tyre marks; release effects no longer apply repeated speed impulses. The campaign trolley chip displays speed in km/h and slip angle while sliding. The follow camera blends toward travel direction during a slide.

Bung Garage → **Engine** includes REBAR R16 (180 rebar, 1.4× V12 speed/acceleration ratings, 16 visible cyan cylinders) and GIRDER G18 (350 rebar, 2× V12 ratings, 18 visible gold cylinders). These replace the engine slot, retain purchased ownership, and save through the same permanent profile. The existing speed ceiling scales by the engine tier, including boosts; multiplayer accepts these higher speeds while retaining its movement checks.

Garage → **Setup** has a live turntable preview, rider visibility toggle, orbit/zoom and independent front/rear controls:

- **Street coilovers / Raised suspension:** ride-height offsets from −420 mm to +280 mm. Front/rear height controls can be linked or independent.
- **Adjustable camber plates:** 0 to −18° on each axle, linked or independent.
- **Adjustable wheel fitment:** 65–200% tyre width on each axle, linked or independent.

Fit the corresponding hardware in Handling to unlock each adjustment. Preview changes locally, then press **Apply Setup**. Adjustment is free after buying the hardware. The setup is saved per trolley design in the permanent profile and travels between campaign, replay, free roam, rooms and devices. Multiplayer validates garage proximity, fitted hardware and race enrollment before applying a setup. Changes are visible to peers.

The chassis, basket, handle, mounted engine and rider move together. Axle assemblies retain road contact, suspension rods change length, coils compress, and the body pitches with front/rear rake. Brakes and ground glow stay anchored correctly. Wheel camber is separate from steering yaw and wheel rolling. Tyre geometry includes sidewalls, hubs, lug bolts and brake discs.

## Dynamics

The live driving path uses a JavaScript planar adaptation of [Ben McInnes’ ArcadeVehiclePhysics](https://github.com/benmcinnes/ArcadeVehiclePhysics), pinned to upstream commit 2883b931c37d55682dc7d4b55551f55bd6d1d0bd. The adapted code lives in src/garage/vendor/ArcadeVehiclePhysics.js with the upstream MIT copyright and licence, also included separately alongside it.

The port implements CpTurning’s speed-scaled yaw torque, CpLateralFriction’s local sideways cancellation impulse/slide curve and CaDrift’s timed grip envelope. Stickiness is converted from the original 60 Hz impulse fraction to time-consistent damping. Reverse uses an absolute longitudinal-speed denominator. Drift tyres activate the grip reduction automatically during a turn; Space can trigger it on other tyres. Cancelled lateral speed is redirected with a strict speed cap rather than applying an unbounded recovery acceleration. Steering, grip, wet conditions, widths and camber remain integrated with every existing trolley and garage build. The chosen slide curve is game-specific, since Unity AnimationCurve assets do not run in the browser.

This is a source adaptation of the steering/drift core, not the Unity runtime or the full package. Unity Rigidbody, suspension rays, Cinemachine, air abilities and sample assets are not imported. The game retains its swept collision and ground-following systems, engine/braking/power curve and shared weather. It remains an arcade planar controller, not a four-wheel suspension/contact simulation or Drift36’s unpublished implementation. Height/rake set visual/mechanical stance; they do not change the collision capsule.

Physics runs at 120 Hz with interpolated presentation snapshots following [fixed-step interpolation](https://gafferongames.com/post/fix_your_timestep/). The camera, rider and cart use the same rendered pose; checkpoints/networking use simulation positions. Warps reset snapshots. A continuous speed limiter avoids throttle chatter at top speed. Wall contacts remove inward velocity once, preserving tangential motion; the duplicate bounce pass was removed. Wind now moves the rendered cart and preserves mounted rider height instead of resetting the rider to ground.

## Validation

- Smooth-motion checks at 60, 90, 144 and 165 Hz cover interpolated displacement, cruise stability, rider alignment, wind alignment and wall contact without bouncing. The browser motion fixture is flat and controlled; garage/race checks exercise actual mapped locations.
- Native tests compare drift/race sideslip without Space, throttle-release recovery, render-rate independence, reverse, braking, wet traction, width and rough-ground tyre choices.
- Model checks cover every trolley and fitting, finite geometry, reversible alignment, independent axle transforms and sanitized setup limits.
- Profile and room checks cover setup-only persistence, server location/hardware validation, and visibility to peers.
- `tools/tests/stance-browser.cjs` operates the actual sliders, checks rider/chassis offsets, saves to the profile service, renders the showroom and checks narrow-screen overflow.
- `tools/tests/garage-browser.cjs` steps actual trolley physics into/out of the mapped garage and fits parts.
- `tools/tests/room-events.cjs` buys and applies stance parts through the two-player UI, checks the peer model, then plays tic-tac-toe and exercises real race movement/checkpoints/reset.

Browser automation uses controlled starting positions and disposable profiles. This is not a full human campaign/race playthrough or a hardware performance benchmark. The preview renders only on updates or orbit input and disposes its renderer/context on close. Static fittings rebuild on hardware changes; slider movement updates existing transforms. Skids use a fixed-capacity, fading geometry buffer.
