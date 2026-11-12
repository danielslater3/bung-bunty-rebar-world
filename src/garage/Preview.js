import * as THREE from 'three';
import { buildTrolley, buildBung, trolleySpec } from '../entities/models.js';
import { fitGarage, releaseTrolley, riderFitment } from './models.js';
export class GaragePreview {
 constructor(id){
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(420,360,false);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.canvas=this.renderer.domElement;this.canvas.setAttribute('aria-label','Interactive trolley setup preview');this.canvas.style.touchAction='none';
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x102635);
  this.camera=new THREE.PerspectiveCamera(39,420/360,.05,30);this.angle=.78;this.pitch=.28;this.distance=4.1;
  this.scene.add(new THREE.HemisphereLight(0xd9f1ff,0x485039,2.6));
  for(const [x,y,z,color,intensity] of [[3,4,2,0xffdfa7,4],[-3,2,-1,0x86caff,3]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);this.scene.add(light);}
  this.trolley=buildTrolley(id);this.scene.add(this.trolley);this.rider=buildBung();this.rider.visible=true;this.scene.add(this.rider);
  const parts=this.rider.userData.parts;if(parts){parts.armL.rotation.x=parts.armR.rotation.x=-1.1;parts.legL.rotation.x=parts.legR.rotation.x=1.3;}
  const ground=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.7,.09,48),new THREE.MeshStandardMaterial({color:0x365361,roughness:.55,metalness:.25}));ground.position.y=-.07;this.scene.add(ground);this.ground=ground;
  this.scene.add(new THREE.GridHelper(3,12,0x6e99a8,0x34515c));
  let drag=null;
  this.canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId);};
  this.canvas.onpointermove=e=>{if(!drag)return;this.angle-=(e.clientX-drag.x)*.012;this.pitch=THREE.MathUtils.clamp(this.pitch+(e.clientY-drag.y)*.006,-.05,.85);drag={x:e.clientX,y:e.clientY};this.render();};
  this.canvas.onpointerup=()=>drag=null;this.canvas.onpointercancel=()=>drag=null;
  this.canvas.onwheel=e=>{e.preventDefault();this.distance=THREE.MathUtils.clamp(this.distance+e.deltaY*.002,2.4,6);this.render();};
  this.name=trolleySpec(id).name;
 }
 update(record){fitGarage(this.trolley,record);const fit=riderFitment(this.trolley);this.rider.position.y=fit.y;this.rider.rotation.x=fit.pitch;this.render();}
 render(){this.camera.position.set(Math.sin(this.angle)*this.distance, .75+Math.sin(this.pitch)*this.distance,Math.cos(this.angle)*this.distance);this.camera.lookAt(0,.85,0);this.renderer.render(this.scene,this.camera);}
 dispose(){releaseTrolley(this.trolley);this.rider.traverse(o=>o.geometry?.dispose());this.ground.geometry.dispose();this.ground.material.dispose();this.scene.traverse(o=>{if(o.isLineSegments){o.geometry.dispose();o.material.dispose();}});this.renderer.dispose();this.renderer.forceContextLoss();}
}
