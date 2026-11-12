# Trolley dynamics and Stance Lab — 12 November 2026

## Playing

Fit **Drift tyres** in Bung Garage → Handling. Accelerate and turn with W/A/D to break rear traction. The trolley now retains sideways momentum while its body rotates. Countersteer with A/D and ease off the throttle to regain grip. Space is an optional rear handbrake for any tyre type. A drift-release boost remains, and bounded ground ribbons show tyre marks. The campaign trolley chip displays speed in km/h and slip angle while sliding. The follow camera blends toward travel direction during a slide.

Garage → **Setup** has a live turntable preview, rider visibility toggle, orbit/zoom and independent front/rear controls:

- **Street coilovers / Raised suspension:** ride-height offsets from −420 mm to +280 mm. Front/rear height controls can be linked or independent.
- **Adjustable camber plates:** 0 to −18° on each axle, linked or independent.
- **Adjustable wheel fitment:** 65–200% tyre width on each axle, linked or independent.

Fit the corresponding hardware in Handling to unlock each adjustment. Preview changes locally, then press **Apply Setup**. Adjustment is free after buying the hardware. The setup is saved per trolley design in the permanent profile and travels between campaign, replay, free roam, rooms and devices. Multiplayer validates garage proximity, fitted hardware and race enrollment before applying a setup. Changes are visible to peers.

The chassis, basket, handle, mounted engine and rider move together. Axle assemblies retain road contact, suspension rods change length, coils compress, and the body pitches with front/rear rake. Brakes and ground glow stay anchored correctly. Wheel camber is separate from steering yaw and wheel rolling. Tyre geometry includes sidewalls, hubs, lug bolts and brake discs.

## Dynamics

`src/garage/dynamics.js` implements a reduced planar single-track model with a 120 Hz fixed step, independent world velocity and yaw, front/rear slip angles, saturating lateral forces, a combined rear-drive friction budget, front/rear brake distribution, longitudinal load transfer, a power curve, drag, and a low-speed parking/reverse blend. Keyboard steering is smoothed, limits decrease with speed, and bounded countersteer assistance makes rear slides controllable. Different tyre compounds affect grip and breakaway. Wet conditions use the active shared weather system. Width and camber affect axle grip; ride height and rake affect load transfer. Rough-ground behavior uses the existing slope sampler as a proxy rather than a detailed surface-material map.

Research references (equations and concepts, not copied engine code):

- [NVIDIA PhysX vehicle documentation](https://nvidia-omniverse.github.io/PhysX/physx/5.1.1/docs/Vehicles.html): tyre slip, force/grip models and low-speed stabilization.
- [NVIDIA slip parameters](https://nvidia-omniverse.github.io/PhysX/physx/latest/_api_build/structPxVehicleTireSlipParams.html): longitudinal-speed denominators around rest.
- [MathWorks 3DOF vehicle body](https://www.mathworks.com/help/vdynblks/ref/vehiclebody3dof.html): longitudinal, lateral and yaw motion, axle slip angles, and transforming tyre forces.
- [Unity wheel friction documentation](https://docs.unity.com/en-us/engine/6000.0/manual/physics-section/physics-overview/collision-section/collider-shapes/wheel-colliders/friction): slip-dependent peak and sliding grip.

This is an arcade-tuned planar model integrated with the game's existing swept collisions, ground following, bridges, ramps and weather forces. It is not a full four-wheel suspension/contact simulator, and no claim is made that it is the industry's best vehicle simulation. Lateral load transfer, tyre temperature/wear, deformable tyres, gearing/clutch, and rigid-body crash impulses are not simulated. Suspension sliders describe visual/mechanical stance; they do not change the existing collision capsule or bridge-clearance rules.

## Validation

- Native tests compare drift/race sideslip without Space, throttle-release recovery, render-rate independence, reverse, braking, wet traction, width and rough-ground tyre choices.
- Model checks cover every trolley and fitting, finite geometry, reversible alignment, independent axle transforms and sanitized setup limits.
- Profile and room checks cover setup-only persistence, server location/hardware validation, and visibility to peers.
- `tools/tests/stance-browser.cjs` operates the actual sliders, checks rider/chassis offsets, saves to the profile service, renders the showroom and checks narrow-screen overflow.
- `tools/tests/garage-browser.cjs` steps actual trolley physics into/out of the mapped garage and fits parts.
- `tools/tests/room-events.cjs` buys and applies stance parts through the two-player UI, checks the peer model, then plays tic-tac-toe and exercises real race movement/checkpoints/reset.

Browser automation uses controlled starting positions and disposable profiles. This is not a full human campaign/race playthrough or a hardware performance benchmark. The preview renders only on updates or orbit input and disposes its renderer/context on close. Static fittings rebuild on hardware changes; slider movement updates existing transforms. Skids use a fixed-capacity, fading geometry buffer.
