/*
MIT License

Copyright (c) 2019 benmcinnes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
// JavaScript planar adaptation of benmcinnes/ArcadeVehiclePhysics:
// upstream 2883b931c37d55682dc7d4b55551f55bd6d1d0bd
// CpTurning.cs, CpLateralFriction.cs and CaDrift.cs.
// Unity rigid-body operations become velocity impulses in the game's existing
// swept-collision controller. No Unity assets, wheel physics or Cinemachine.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function driftEnvelope(current,active,dt){
 // CaDrift's independently timed drift-in / drift-out envelope.
 return clamp(current+dt*(active?1/.5:-1/1),0,1);
}
export function turningVelocity(current,input,force,speedPercent,dt,drag){
 // CpTurning: speed-scaled local-Y velocity-change torque. Integrate angular
 // drag analytically so damping remains stable with a 120 Hz fixed step.
 const torque=input*force*clamp(Math.abs(speedPercent)+.25,0,1);
 const decay=Math.exp(-drag*dt);
 return current*decay+torque/drag*(1-decay);
}
export function lateralFriction(body,heading,stickiness,dt){
 const s=Math.sin(heading),c=Math.cos(heading);
 const side=body.vx*c-body.vz*s,forward=body.vx*s+body.vz*c;
 // CpLateralFriction's side/total-speed curve and lateral cancellation impulse.
 // Absolute forward speed fixes upstream's negative denominator in reverse.
 const ratio=Math.abs(side)/Math.max(.01,Math.abs(side)+Math.abs(forward));
 const curve=1-.2*clamp(ratio,0,1);
 // Stickiness expresses fraction cancelled per upstream 60 Hz tick; convert
 // to exponential damping for our different simulation frequency.
 const fraction=1-Math.pow(1-clamp(stickiness*curve,0,.95),dt*60);
 const impulse=-side*fraction;
 body.vx+=c*impulse;body.vz-=s*impulse;
 return impulse;
}
