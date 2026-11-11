import * as THREE from 'three';
import { tuning, buildRecord } from './catalog.js';

// Trolley body materials are shared through utils.mat(); only garage fittings
// own their materials. Geometry belongs to this assembled trolley.
export function releaseTrolley(mesh) {
 const geometry=new Set(),materials=new Set();
 mesh.traverse(o=>{
  if(o.geometry)geometry.add(o.geometry);
  if(o.name==='Garage equipment'||o.name==='Garage tyre')o.traverse(part=>{
   for(const material of Array.isArray(part.material)?part.material:[part.material])if(material)materials.add(material);
  });
 });
 geometry.forEach(g=>g.dispose());
 materials.forEach(m=>{m.map?.dispose();m.dispose();});
 mesh.removeFromParent();
}

export function fitGarage(mesh, record) {
 const key=JSON.stringify(buildRecord(record));
 if(mesh.userData.garageKey===key)return;
 mesh.userData.garageKey=key;
 const old=mesh.getObjectByName('Garage equipment');
 if(old){old.removeFromParent();old.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});}
 const t=tuning(record), equipped=buildRecord(record).equipped;
 const group=new THREE.Group();group.name='Garage equipment';mesh.add(group);
 const metal=new THREE.MeshStandardMaterial({color:0xa7b2b9,metalness:.7,roughness:.32});
 const dark=new THREE.MeshStandardMaterial({color:0x23303d,metalness:.45,roughness:.6});
 const accent=new THREE.MeshStandardMaterial({color:0xd9474f,metalness:.35,roughness:.5});
 const box=(x,y,z,w,h,d,material=metal)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);group.add(m);return m;
 };
 for(let i=0;i<t.cylinders;i++){
  const side=i%2?1:-1,row=Math.floor(i/2);
  const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(.046,.055,.19,8),metal);
  cylinder.rotation.z=side*.5;cylinder.position.set(side*.16,.73+t.height,-.19-row*.075);group.add(cylinder);
 }
 if(t.cylinders)box(0,.58+t.height,-.4,.39,.2,.64,dark);
 if(equipped.induction==='supercharger')box(0,.91+t.height,-.43,.24,.17,.29,accent);
 if(equipped.induction==='turbo'){
  const turbo=new THREE.Mesh(new THREE.TorusGeometry(.1,.04,8,14),metal);
  turbo.position.set(.36,.7+t.height,-.55);group.add(turbo);
  box(.24,.65+t.height,-.48,.24,.065,.065);
 }
 for(let i=0;i<(equipped.tank==='endurance'?2:equipped.tank?1:0);i++){
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.55,12),accent);
  tank.rotation.z=Math.PI/2;tank.position.set(0,.9+t.height+i*.24,.28);group.add(tank);
 }
 if(equipped.nitro){
  const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.4,12),new THREE.MeshStandardMaterial({color:0x3589de,metalness:.5}));
  bottle.position.set(-.34,.94+t.height,-.31);group.add(bottle);
 }
 if(equipped.aero){box(0,1.58+t.height,-.91,.95,.045,.25,dark);box(-.3,1.37+t.height,-.91,.04,.4,.04);box(.3,1.37+t.height,-.91,.04,.4,.04);}
 if(equipped.exhaust)for(const x of [-.27,.27])box(x,.46+t.height,-.96,.08,.08,.3);
 if(equipped.lights)for(let i=0;i<4;i++)box((i-1.5)*.16,1.51+t.height,.55,.12,.1,.08,new THREE.MeshBasicMaterial({color:0xfff1c0}));
 const basket=mesh.children[0];
 if(basket&&basket.userData.baseGarageHeight===undefined)basket.userData.baseGarageHeight=basket.position.y;
 if(basket)basket.position.y=basket.userData.baseGarageHeight+t.height;
 for(const wheel of mesh.userData.wheels||[]){
  if(!wheel.steer?.isObject3D)continue;
  const oldTyre=wheel.spin.getObjectByName('Garage tyre');
  if(oldTyre){oldTyre.removeFromParent();oldTyre.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  wheel.steer.rotation.z=t.camber ? Math.sign(wheel.steer.position.x)*t.camber : 0;
  wheel.spin.scale.set(equipped.tyres==='race'?1.22:1,1,1);
  if(equipped.tyres){
   const tyre=new THREE.Group();tyre.name='Garage tyre';wheel.spin.add(tyre);
   const rubber=new THREE.MeshStandardMaterial({color:equipped.tyres==='drift'?0xdc62a0:0x222a31,roughness:.9});
   const sidewall=new THREE.Mesh(new THREE.TorusGeometry(.108,.018,6,16),rubber);
   sidewall.rotation.y=Math.PI/2;tyre.add(sidewall);
   if(equipped.tyres==='offroad')for(let i=0;i<10;i++){
    const lug=new THREE.Mesh(new THREE.BoxGeometry(.09,.035,.05),rubber);
    const a=i*Math.PI/5;lug.position.set(0,Math.cos(a)*.127,Math.sin(a)*.127);lug.rotation.x=a;tyre.add(lug);
   }
  }
  if(equipped.tyres||equipped.brakes) {
   const caliper=box(wheel.steer.position.x,.19,wheel.steer.position.z,.04,.13,.19,equipped.brakes?accent:dark);
   if(equipped.tyres==='offroad')caliper.scale.y=1.4;
  }
 }
 if(equipped.suspension)for(const x of [-.29,.29])for(const z of [-.43,.43])
  box(x,.39+t.height/2,z,.055,.25+t.height,.055,accent);
 if(equipped.decal)for(const x of [-.46,.46]){
  box(x,.94+t.height,0,.025,.07,.89,accent);
  if(equipped.decal==='number'){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ffe3a2';ctx.fillRect(0,0,64,64);
   ctx.fillStyle='#182b39';ctx.font='bold 44px system-ui';ctx.textAlign='center';ctx.fillText('01',32,47);
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
   const plate=new THREE.Mesh(new THREE.PlaneGeometry(.27,.27),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));
   plate.position.set(x,1.04+t.height,.12);plate.rotation.y=x<0?-Math.PI/2:Math.PI/2;group.add(plate);
  }
 }
 if(t.light){
  const mat=new THREE.MeshBasicMaterial({color:t.light,transparent:true,opacity:.25,depthWrite:false});
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.95,24),mat);glow.rotation.x=-Math.PI/2;glow.position.y=.04;group.add(glow);
 }
}
