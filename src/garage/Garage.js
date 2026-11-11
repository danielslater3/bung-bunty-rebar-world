import * as THREE from 'three';
import { VenueFrame } from '../core/colliderSpace.js';
import { state, SaveSystem } from '../core/state.js';
import { GARAGE, PARTS, buildRecord, garageAction, tuning } from './catalog.js';
import { fitGarage } from './models.js';
import { buildTrolley } from '../entities/models.js';

export function isGarageBuilding(b) {
 return b.r?.[0]===68.9 && b.r?.[1]===34.2 && b.h===9;
}
export function installGarage(zone) {
 const frame=new VenueFrame(104,26,-Math.atan2(.74,.67));
 let floor=zone.terrain.walkAt(94,37);
 for(let x=-16;x<=16;x+=4)for(let z=1;z<=31;z+=5){
  const p=frame.world({x,y:0,z});floor=Math.max(floor,zone.terrain.walkAt(p.x,p.z)+.08);
 }
 const entrance=frame.world({x:0,y:0,z:-6});
 const entryHeight=zone.terrain.walkAt(entrance.x,entrance.z);
 const root=new THREE.Group();root.position.set(104,0,26);root.rotation.y=-Math.atan2(.74,.67);zone.group.add(root);
 const inside=p=>{const q=frame.local(p);return Math.abs(q.x)<17&&q.z>0&&q.z<32&&p.y<floor+8;};
 const steel=new THREE.MeshStandardMaterial({color:0x273b4a,roughness:.68});
 const orange=new THREE.MeshStandardMaterial({color:0xed9c35,roughness:.61});
 const slab=new THREE.MeshStandardMaterial({color:0x747e85,roughness:.9});
 function box(x,y,z,w,h,d,material,solid=false){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);root.add(mesh);
  if(solid){
   const localBox=new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2));
   const b=new THREE.Box3();b.localBox=localBox;b.frame=frame;
   b.min.set(-100,-100,-100);b.max.set(200,100,200);zone.colliders.push(b);
  }
  return mesh;
 }
 box(0,floor-.18,20,34,.35,24,slab);
 for(const x of [-12,12])box(x,floor-.18,4,10,.35,8,slab);
 const rampGeometry=new THREE.BufferGeometry();
 rampGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
  -7,entryHeight,-6, -7,floor,8, 7,floor,8,
  -7,entryHeight,-6, 7,floor,8, 7,entryHeight,-6,
 ],3));
 rampGeometry.computeVertexNormals();root.add(new THREE.Mesh(rampGeometry,slab));
 box(-17,floor+4,16,.35,8,32,steel,true);box(17,floor+4,16,.35,8,32,steel,true);
 box(0,floor+4,32,34,8,.35,steel,true);
 box(-12,floor+4,0,10,8,.35,steel,true);box(12,floor+4,0,10,8,.35,steel,true);
 box(0,floor+7,0,14,2,.4,orange,true);
 box(0,floor+8.2,16,34,.4,32,steel,true);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#182a36';ctx.fillRect(0,0,1024,192);
 ctx.fillStyle='#ffcd63';ctx.font='bold 104px system-ui';ctx.textAlign='center';ctx.fillText('BUNG GARAGE',512,119);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(15,2.8),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
 sign.position.set(0,floor+6.5,-.25);root.add(sign);
 sign.rotation.y=Math.PI;
 for(const x of [-8,8]){
  for(const side of [-1,1])box(x+side*2.8,floor+2.4,15,.35,4.8,.6,orange,true);
  box(x,floor+.18,15,4,.25,8,steel);
  box(x,floor+.045,15,5.2,.035,10,orange);
 }
 for(let i=0;i<7;i++){box(-14+i*4.3,floor+1.1,29,3.5,2.2,1.6,i%2?orange:steel,true);}
 for(const x of [-13,13])for(const z of [7,22])box(x,floor+7.8,z,3,.08,.6,new THREE.MeshBasicMaterial({color:0xe7f8ff}));
 for(const x of [-8,8]){
  const light=new THREE.PointLight(0xffdfac,45,24,1.5);light.position.set(x,floor+6.8,14);root.add(light);
  const demo=buildTrolley(x<0?'concrete':'james');
  demo.position.set(x,floor+.34,15);root.add(demo);
  const owned=x<0?['v12','turbo','offroad','cyan']:['v8','supercharger','race','spoiler','gold'];
  const equipped={};for(const id of owned){const part=PARTS.find(p=>p.id===id);equipped[part.slot]=id;}
  fitGarage(demo,{owned,equipped});
 }
 for(let i=0;i<7;i++)for(let drawer=0;drawer<4;drawer++)
  box(-14+i*4.3,floor+.4+drawer*.43,28.14,2.8,.055,.08,steel);
 box(12,floor+1.12,24,6,.16,2,orange,true);
 for(let i=0;i<6;i++){
  const tyre=new THREE.Mesh(new THREE.TorusGeometry(.38,.12,8,16),steel);
  tyre.position.set(-15,floor+.65+(i%3)*.8,8+Math.floor(i/3)*1.15);tyre.rotation.y=Math.PI/2;root.add(tyre);
 }
 const baseGround=zone.sampleGround;
 zone.sampleGround=(x,z,y)=>{
  const p={x,y:floor+1,z};
  const q=frame.local(p);
  if(Math.abs(q.x)<7&&q.z>-6&&q.z<8&&y>entryHeight-1)
   return entryHeight+(floor-entryHeight)*(q.z+6)/14;
  return inside(p)&&y>entryHeight-1?floor:baseGround(x,z,y);
 };
 zone.garage={floor,frame,inside};
 return root;
}

export class Garage {
 constructor(game){this.game=game;this.opened=false;this.key='';this.category='Power';}
 near(){const z=this.game.zone;return !!z?.garage&&z.garage.inside(this.game.player.pos);}
 update(){
  const g=this.game;
  if(this.opened&&(!this.near()||g.loading||g.mode==='menu'))this.close();
  if(this.near()&&!this.opened&&!g.phone.opened&&!g.dialogue.cinematic&&!g.saga.freeze){
   if(g.multiplayer.active)g.multiplayer.errorHint='G · BUNG GARAGE';
   if(g.input.pressed.KeyG){delete g.input.pressed.KeyG;this.open();}
  }
  const record=g.multiplayer.active?g.multiplayer.room?.players[g.multiplayer.client.id]?.garage?.[state.trolley]:state.garage?.[state.trolley];
  fitGarage(g.trolley.mesh,record);
  state.maxFuel=g.trolley.fuelMax;
  state.fuel=Math.min(state.fuel,state.maxFuel);
  if(this.opened){const key=JSON.stringify([this.record(),this.balance(),state.trolley]);if(key!==this.key)this.draw();}
 }
 balance(){const m=this.game.multiplayer;return m.active?m.room.players[m.client.id].rebar:state.rebars;}
 record(){const m=this.game.multiplayer;return buildRecord((m.active?m.room.players[m.client.id].garage:state.garage)?.[state.trolley]);}
 open(){
  if(!this.near()||this.opened)return;
  const g=this.game;
  if(g.multiplayer.raceEntry()){g.toast('Leave the race to tune your trolley.');return;}
  this.opened=true;this.enabled=g.input.enabled;
  if(g.multiplayer.active)g.multiplayer.setFocus(true);else{g.input.enabled=false;g.input.unlock();}
  const root=document.createElement('dialog');root.className='bung-garage-ui';root.setAttribute('aria-label','Bung Garage');
  this.root=root;document.body.append(root);root.addEventListener('cancel',e=>{e.preventDefault();this.close();});root.showModal();this.draw();
 }
 close(){
  if(!this.opened)return;this.opened=false;this.root.close();this.root.remove();
  const g=this.game;if(g.multiplayer.active)g.multiplayer.setFocus(false);else g.input.enabled=this.enabled;
  g.input.keys={};g.input.pressed={};
 }
 draw(){
  const record=this.record();this.key=JSON.stringify([record,this.balance(),state.trolley]);
  const root=this.root;root.replaceChildren();
  const add=(tag,text,parent=root)=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
  add('h2','BUNG GARAGE');add('p',this.balance()+' rebar · '+state.trolley.toUpperCase());
  const close=add('button','BACK TO BRISBANE');close.onclick=()=>this.close();
  const stats=tuning(record);add('p',`Engine ×${stats.speed.toFixed(2)} · Acceleration ×${stats.accel.toFixed(2)} · Tank ×${stats.fuel.toFixed(2)}`);
  const error=add('p','');error.setAttribute('role','status');
  const categories={Power:['engine','induction','exhaust'],Handling:['tyres','suspension','alignment','brakes','aero'],Range:['tank','nitro'],Style:['underglow','decal','lights']};
  const nav=add('nav','');nav.setAttribute('aria-label','Garage sections');
  for(const name of Object.keys(categories)){
   const button=add('button',name,nav);button.setAttribute('aria-pressed',String(name===this.category));
   button.onclick=()=>{this.category=name;this.draw();};
  }
  for(const slot of categories[this.category]){
   const section=add('section','');add('h3',slot.toUpperCase(),section);
   for(const part of PARTS.filter(p=>p.slot===slot)){
    const row=add('div','',section);row.className='bung-garage-part';
    const text=add('div','',row);add('strong',part.name,text);add('small',part.detail,text);
    const owned=record.owned.includes(part.id),equipped=record.equipped[slot]===part.id;
    const button=add('button',equipped?'REMOVE':owned?'EQUIP':part.price+' REBAR',row);
    button.disabled=!owned&&this.balance()<part.price;
    button.onclick=()=>{
     const action=equipped?'remove':'equip',g=this.game,m=g.multiplayer;
     try{
      if(m.active)m.client.command('garageBuy',{part:part.id,action});
      else {
       const {next,cost}=garageAction(record,part.id,action,state.rebars);
       state.garage??={};state.garage[state.trolley]=next;state.rebars-=cost;SaveSystem.save(g);this.draw();
      }
     }catch(e){error.textContent=e.message;}
    };
   }
  }
 }
}
