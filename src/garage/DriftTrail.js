import * as THREE from 'three';
// Fixed-size ground ribbons: no mesh allocation when a tyre lays a mark.
export class DriftTrail {
 constructor(game){
  this.game=game;this.age=new Float32Array(160).fill(12);this.positions=new Float32Array(160*18);this.alpha=new Float32Array(160*6);this.next=0;this.clock=0;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));geometry.setAttribute('fade',new THREE.BufferAttribute(this.alpha,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:'attribute float fade; varying float opacity; void main(){opacity=fade; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float opacity; void main(){if(opacity<.01)discard;gl_FragColor=vec4(.07,.065,.06,opacity*.65);}'});
  this.mesh=new THREE.Mesh(geometry,material);this.mesh.frustumCulled=false;game.scene.add(this.mesh);this.clear();
 }
 clear(){this.age.fill(12);this.alpha.fill(0);this.mesh.geometry.attributes.fade.needsUpdate=true;this.last=null;}
 update(dt,trolley,sliding){
  for(let i=0;i<160;i++){this.age[i]+=dt;this.alpha.fill(Math.max(0,1-this.age[i]/10),i*6,i*6+6);}
  this.clock+=dt;
  if(sliding&&this.clock>.055){
   this.clock=0;
   const p=trolley.pos,h=trolley.heading,s=Math.sin(h),c=Math.cos(h);
   for(const side of [-1,1]){
    const x=p.x+side*c*.32-s*.48,z=p.z-side*s*.32-c*.48,y=this.game.zone.groundAt(x,z,p.y)+.025;
    const old=this.last?.[side];
    if(old&&Math.hypot(old.x-x,old.z-z)<3&&Math.abs(old.y-y)<.4){
     const i=this.next++%160,w=.035*trolley.tune.rearWidth,points=[[old.x-c*w,old.y,old.z+s*w],[old.x+c*w,old.y,old.z-s*w],[x+c*w,y,z-s*w],[x-c*w,y,z+s*w]];
     let offset=i*18;for(const n of [0,1,2,0,2,3]){this.positions.set(points[n],offset);offset+=3;}this.age[i]=0;
    }
    this.last??={};this.last[side]={x,y,z};
   }
   this.mesh.geometry.attributes.position.needsUpdate=true;
  }else if(!sliding)this.last=null;
  this.mesh.geometry.attributes.fade.needsUpdate=true;
 }
}
