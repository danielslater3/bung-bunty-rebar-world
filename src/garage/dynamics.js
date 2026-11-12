import {driftEnvelope,turningVelocity,lateralFriction} from './vendor/ArcadeVehiclePhysics.js';
// One continuous arcade vehicle controller. Physics runs at 120 Hz; presentation
// interpolates its snapshots so 60/90/144/165 Hz displays do not show tick jumps.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const approach=(a,b,rate,dt)=>mix(a,b,1-Math.exp(-rate*dt));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const TYRES={
 stock:{grip:1.65,traction:.72,response:13},
 touring:{grip:1.78,traction:.75,response:15},
 race:{grip:2.1,traction:.8,response:17},
 drift:{grip:1.35,traction:.84,response:13},
 offroad:{grip:1.48,traction:.75,response:12},
};
export class TrolleyDynamics {
 constructor(){this.reset(0,0);}
 reset(speed=0,heading=0){
  this.vx=Math.sin(heading)*speed;this.vz=Math.cos(heading)*speed;this.heading=heading;
  this.yawRate=this.steering=this.controlSteer=this.handbrake=this.accumulator=this.slip=this.dx=this.dz=0;
  this.x=this.z=this.prevX=this.prevZ=this.renderX=this.renderZ=0;
  this.prevHeading=this.renderHeading=heading;this.forward=speed;this.driftTime=0;
 }
 impulse(amount){this.vx+=Math.sin(this.heading)*amount;this.vz+=Math.cos(this.heading)*amount;this.measure();}
 measure(){const s=Math.sin(this.heading),c=Math.cos(this.heading);this.forward=this.vx*s+this.vz*c;this.slip=Math.atan2(this.vx*c-this.vz*s,Math.max(1,Math.abs(this.forward)));}
 snapRender(){this.prevX=this.renderX=this.x;this.prevZ=this.renderZ=this.z;this.prevHeading=this.renderHeading=this.heading;}
 collide(nx,nz){
  const length=Math.hypot(nx,nz);if(length>1e-8){nx/=length;nz/=length;const into=this.vx*nx+this.vz*nz;if(into>0){this.vx-=nx*into;this.vz-=nz*into;}}
  this.measure();this.snapRender();
 }
 update(dt,input){
  this.dx=this.dz=0;this.accumulator+=clamp(dt,0,.1);
  while(this.accumulator>=1/120-1e-10){
   this.prevX=this.x;this.prevZ=this.z;this.prevHeading=this.heading;
   this.step(1/120,input);this.accumulator-=1/120;
  }
  this.measure();const alpha=clamp(this.accumulator*120,0,1);
  this.renderX=mix(this.prevX,this.x,alpha);this.renderZ=mix(this.prevZ,this.z,alpha);
  this.renderHeading=mix(this.prevHeading,this.heading,alpha);
  return this;
 }
 step(dt,i){
  const tyre=TYRES[i.tyre]||TYRES.stock,speed=Math.hypot(this.vx,this.vz),sn=Math.sin(this.heading),cs=Math.cos(this.heading);
  const u=this.vx*sn+this.vz*cs,reverse=u<-.15,travel=reverse?-1:1;
  const throttle=clamp(i.throttle||0,-1,1),steer=clamp(i.steer||0,-1,1),air=i.grounded===false;
  // Driver input, body rotation and travel direction each have a single owner.
  this.controlSteer=approach(this.controlSteer,steer,steer===0?7:5.5,dt);
  const rain=clamp(i.rain||0,0,1),wet=1-rain*(i.tyre==='race'?.48:.23);
  const rough=i.rough?(i.tyre==='offroad'?1.1:.58):1;
  const width=Math.sqrt(i.rearWidth||1),camber=1-Math.abs(i.rearCamber||0)/100;
  const grip=tyre.grip*wet*rough*width*camber;
  const brake=throttle*u<-.12;
  const handbrake=approach(this.handbrake||0,i.handbrake?1:0,10,dt);this.handbrake=handbrake;
  const top=reverse&&throttle<0?7:Math.max(1,i.maxSpeed||18);
  const power=(i.accel||16)/(1+speed*.055);
  const traction=grip*9.81*.62*tyre.traction;
  const drag=speed*(throttle===0?.7:.09)+handbrake*2.4;
  let acceleration;
  if(brake)acceleration=-Math.min(speed/dt,(i.brake||1)*15,grip*9.81);
  else if(throttle){
   acceleration=Math.min(power*Math.abs(throttle),traction);
   // Continuous governor: no on/off throttle chatter at the speed ceiling.
   acceleration=Math.min(acceleration,Math.max(-8,(top-speed)*3.5)+drag);
   acceleration-=drag;
  }else acceleration=-Math.min(speed/dt,drag);
  let nextSpeed=Math.max(0,speed+acceleration*dt*(air?.08:1));
  if(nextSpeed<.025&&!throttle)nextSpeed=0;
  const direction=nextSpeed<.2&&throttle?Math.sign(throttle):travel;
  const moving=smooth(.3,5,speed),drift=smooth(2.5,7,speed);
  const turn=clamp(i.turn||1,.6,1.6),frontContact=Math.sqrt(i.frontWidth||1)*(1-Math.abs(i.frontCamber||0)/100);
  const yawLimit=Math.min(1.05,speed*.15)/(1+speed*.014)*turn;
  const roadLimit=grip*9.81/Math.max(3,speed);
  this.yawRate=air?this.yawRate*Math.exp(-dt):turningVelocity(this.yawRate,this.controlSteer*direction,
   (i.tyre==='drift'?yawLimit:Math.min(yawLimit,roadLimit))*frontContact*7,
   speed/5,dt,7);
  if(!air)this.heading+=this.yawRate*dt*moving;
  this.driftTime=driftEnvelope(this.driftTime,!air&&drift>.1&&(i.handbrake||(i.tyre==='drift'&&Math.abs(this.controlSteer)>.08)),dt);
  // CaDrift reduces stickiness along a smooth curve; ordinary turning on drift
  // tyres activates it automatically, while Space works on every compound.
  const blend=this.driftTime*this.driftTime*(3-2*this.driftTime);
  const driftFactor=1-blend*(i.tyre==='drift'?.72:.73);
  const response=tyre.response*wet*rough*width*camber;
  const stickiness=(1-Math.exp(-response/60))*driftFactor;
  const oldMotion=speed>.03?Math.atan2(this.vx,this.vz):this.heading+(direction<0?Math.PI:0);
  this.vx=Math.sin(oldMotion)*nextSpeed;this.vz=Math.cos(oldMotion)*nextSpeed;
  if(!air){
   lateralFriction(this,this.heading,stickiness,dt);
   // CaDrift's forward recovery is energy-bounded: redirect the cancelled
   // lateral momentum without adding free speed at every steering transition.
   const retained=Math.hypot(this.vx,this.vz);
   if(retained>1e-8){this.vx*=nextSpeed/retained;this.vz*=nextSpeed/retained;}
  }
  const dx=this.vx*dt,dz=this.vz*dt;this.x+=dx;this.z+=dz;this.dx+=dx;this.dz+=dz;
  this.steering=approach(this.steering,this.controlSteer*.5/(1+speed*speed*.006),12,dt);
 }
}
