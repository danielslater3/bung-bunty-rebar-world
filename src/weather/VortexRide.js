// Bounded gameplay vortex, not a fluid simulation. One owner controls motion
// while entrained; normal driving/walking resumes after a collision-aware fall.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class VortexRide {
 constructor(){this.reset();}
 reset(){this.active=false;this.phase='idle';this.cooldown=0;this.vx=this.vz=this.vy=0;}
 begin(t,p,ground,time){
  if(this.active||time<this.cooldown)return false;
  this.active=true;this.phase='orbit';this.id=t.id;this.tier=t.tier;this.toss=t.toss;
  this.started=time;this.endsAt=t.endsAt;this.angle=Math.atan2(p.z-t.z,p.x-t.x);
  this.radius=Math.max(t.core*.38,Math.hypot(p.x-t.x,p.z-t.z));this.height=Math.max(0,p.y-ground);
  this.vx=this.vz=this.vy=0;return true;
 }
 step(dt,time,t,p,ground){
  dt=clamp(dt,0,.05);if(!this.active)return;
  const live=t&&t.id===this.id&&t.ground&&time<this.endsAt;
  if(this.phase==='orbit'&&!live){
   this.phase='release';this.released=time;
   this.vx=Math.cos(this.angle+Math.PI/2)*this.toss*.72;
   this.vz=Math.sin(this.angle+Math.PI/2)*this.toss*.72;
   this.vy=-12-this.tier*3;
  }
  if(this.phase==='orbit'){
   const blend=1-Math.exp(-dt*.75);
   this.radius+=(t.core*(.38+.06*Math.sin(time*.43))-this.radius)*blend;
   this.angle+=dt*(.7+this.tier*.10);
   const desiredX=t.x+Math.cos(this.angle)*this.radius,desiredZ=t.z+Math.sin(this.angle)*this.radius;
   const response=1-Math.exp(-dt*4);
   this.vx+=((t.vx||0)+(desiredX-p.x)*1.6-this.vx)*response;
   this.vz+=((t.vz||0)+(desiredZ-p.z)*1.6-this.vz)*response;
   const max=55+this.tier*19,length=Math.hypot(this.vx,this.vz);
   if(length>max){this.vx*=max/length;this.vz*=max/length;}
   const altitude=14+this.tier*23+Math.sin(time*.9)*t.tier*2;
   this.vy+=(clamp((ground+altitude-p.y)*1.8,-30,18+this.tier*9)-this.vy)*response;
  }else{
   this.vy-=18*dt;this.vx*=Math.exp(-dt*.16);this.vz*=Math.exp(-dt*.16);
  }
  return {dx:this.vx*dt,dz:this.vz*dt,dy:this.vy*dt,yaw:this.angle+Math.PI/2,roll:Math.sin(time*2)*(.1+this.tier*.025)};
 }
 landed(time){this.active=false;this.phase='idle';this.cooldown=time+8;this.vx=this.vz=this.vy=0;}
}
