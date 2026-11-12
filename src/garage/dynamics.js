// Planar single-track dynamics. World momentum is independent of body yaw.
// Axle slip forces saturate, rear drive shares a friction circle with cornering,
// and a fixed 120 Hz step keeps keyboard handling independent of render rate.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const TYRES={
 stock:{front:1.65,rear:1.62,stiffness:8,slide:.84,drive:.72},
 touring:{front:1.72,rear:1.78,stiffness:9,slide:.88,drive:.72},
 race:{front:2.05,rear:2.12,stiffness:10,slide:.86,drive:.72},
 drift:{front:1.7,rear:1.1,stiffness:6.5,slide:.72,drive:.86},
 offroad:{front:1.42,rear:1.48,stiffness:7,slide:.88,drive:.74},
};
export class TrolleyDynamics {
 constructor(){this.reset(0,0);}
 reset(speed=0,heading=0){this.vx=Math.sin(heading)*speed;this.vz=Math.cos(heading)*speed;this.heading=heading;this.yawRate=0;this.steering=0;this.accumulator=0;this.forward=speed;this.slip=0;this.dx=this.dz=0;}
 impulse(amount){this.vx+=Math.sin(this.heading)*amount;this.vz+=Math.cos(this.heading)*amount;}
 update(dt,input){
  this.dx=this.dz=0;this.accumulator+=Math.min(.1,Math.max(0,dt));
  while(this.accumulator>=1/120-1e-10){this.step(1/120,input);this.accumulator-=1/120;}
  const sn=Math.sin(this.heading),cs=Math.cos(this.heading);
  this.forward=this.vx*sn+this.vz*cs;
  this.slip=Math.atan2(this.vx*cs-this.vz*sn,Math.max(1,Math.abs(this.forward)));
  return this;
 }
 step(dt,i){
  const sn=Math.sin(this.heading),cs=Math.cos(this.heading),u=this.vx*sn+this.vz*cs,v=this.vx*cs-this.vz*sn;
  const speed=Math.hypot(u,v),direction=u<-.1?-1:1,tyre=TYRES[i.tyre]||TYRES.stock;
  const previousYawRate=this.yawRate;
  const wet=1-clamp(i.rain||0,0,1)*(i.tyre==='race'?.48:.23);
  const rough=i.rough?(i.tyre==='offroad'?1.1:.58):1;
  const frontGrip=tyre.front*wet*rough*Math.sqrt(i.frontWidth||1)*(1-Math.abs(i.frontCamber||0)/100);
  const rearGrip=tyre.rear*wet*rough*Math.sqrt(i.rearWidth||1)*(1-Math.abs(i.rearCamber||0)/100);
  const beta=Math.atan2(v,Math.max(2,Math.abs(u)));
  const target=clamp(i.steer||0,-1,1)*.48/(1+speed*speed*.008)*(i.turn||1);
  const assist=clamp(beta*(i.tyre==='drift'?.52:.3),-.22,.22);
  this.steering+=(clamp(target+assist,-.6,.6)-this.steering)*(1-Math.exp(-dt*9));
  const a=.48,b=.48,gravity=9.81;
  // A finite power curve makes larger engines matter once traction permits it.
  const requested=(i.throttle||0)*(i.accel||16)/(1+speed/10);
  const braking=(i.throttle||0)*u<-.15;
  const transfer=clamp(requested*.012*(1+clamp((i.height||0)*1.1,-.3,.3)),-.14,.14);
  const loadFront=.48-transfer+clamp((i.rake||0)*.06,-.05,.05),loadRear=1-loadFront;
  const frontLimit=frontGrip*gravity*loadFront,rearLimit=rearGrip*gravity*loadRear;
  const air=i.grounded===false;
  let drive=clamp(requested,-rearLimit*tyre.drive,rearLimit*tyre.drive);
  if(braking)drive=-Math.sign(u)*Math.min(Math.abs(u)/dt,(i.brake||1)*15,(frontLimit+rearLimit)*.92);
  if((i.throttle||0)<0&&u<-7)drive=0;
  if(u>(i.maxSpeed||18)&&drive>0)drive=0;
  const handbrake=!!i.handbrake&&speed>2;
  const rearUsed=braking?drive*.38:drive,frontUsed=braking?drive*.62:0;
  const frontAvailable=Math.sqrt(Math.max(.08,frontLimit*frontLimit-frontUsed*frontUsed));
  const available=Math.sqrt(Math.max(.08,rearLimit*rearLimit-Math.min(rearUsed*rearUsed,rearLimit*rearLimit*.96)))*(handbrake?.23:1);
  const frontSlip=Math.atan2(v+a*this.yawRate,Math.max(1.8,Math.abs(u)))-this.steering*direction;
  const rearSlip=Math.atan2(v-b*this.yawRate,Math.max(1.8,Math.abs(u)));
  const force=(slip,limit)=>-limit*Math.tanh(slip*tyre.stiffness)*(1-(1-tyre.slide)*clamp((Math.abs(slip)-.2)/.7,0,1));
  let front=force(frontSlip,frontAvailable),rear=force(rearSlip,available);
  if(air){drive*=.08;front=rear=0;}
  let lateral=front*Math.cos(this.steering)+rear;
  const longitudinal=drive-front*Math.sin(this.steering)-u*(.12+.004*speed)-(handbrake?Math.sign(u)*1.6:0);
  const low=clamp((3-speed)/3,0,1);
  if(!air){
   // Parking-speed blend avoids a singular tyre model at rest/reverse.
   const parkingYaw=u*Math.tan(this.steering)/(.96);
   const torque=(a*front*Math.cos(this.steering)-b*rear)/.56-this.yawRate*2.2;
   this.yawRate=clamp(this.yawRate+torque*dt,-2.8,2.8);
   this.yawRate+=(parkingYaw-this.yawRate)*low*(1-Math.exp(-dt*12));
   lateral-=v*low*12;
  }else this.yawRate*=Math.exp(-dt*1.5);
  this.vx+=(sn*longitudinal+cs*lateral)*dt;
  this.vz+=(cs*longitudinal-sn*lateral)*dt;
  if(i.tyre==='drift'&&!air&&u>3){
   // Assisted arcade drifting: steer chooses the corner, momentum trails the
   // nose, and releasing steer smoothly catches the slide. Keep engine speed
   // through the arc instead of dissipating it in a prolonged rear-wheel spin.
   const steering=clamp(i.steer||0,-1,1);
   const yawTarget=steering*Math.min(.95,speed*.07)/(1+speed*.012)*(i.turn||1);
   this.yawRate=previousYawRate+(yawTarget-previousYawRate)*(1-Math.exp(-dt*6));
   const targetSlip=-steering*(handbrake?.45:.24)*(1+(i.rain||0)*.18)/Math.sqrt(i.rearWidth||1);
   const motion=Math.atan2(this.vx,this.vz),target=this.heading+targetSlip;
   const difference=((target-motion+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
   const angle=motion+difference*(1-Math.exp(-dt*(Math.abs(steering)>.05?6:9)));
   const carry=Math.max(0,speed+(drive-u*(.07+.002*speed)-(handbrake?2:0))*dt);
   this.vx=Math.sin(angle)*carry;this.vz=Math.cos(angle)*carry;
  }
  const limit=(i.maxSpeed||18)*1.08,length=Math.hypot(this.vx,this.vz);
  if(length>limit){this.vx*=limit/length;this.vz*=limit/length;}
  if(!i.throttle&&speed<.18){this.vx=this.vz=0;this.yawRate*=Math.exp(-dt*14);}
  this.heading+=this.yawRate*dt;
  this.dx+=this.vx*dt;this.dz+=this.vz*dt;
 }
}
