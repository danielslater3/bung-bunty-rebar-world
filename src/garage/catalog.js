export const GARAGE = { x: 94, y: 9.7, z: 37, label: 'BUNG GARAGE' };
const part = (id, slot, name, price, detail, stats = {}) => ({ id, slot, name, price, detail, stats });
export const PARTS = [
 part('v4','engine','Rebar V4',12,'Four visible cylinders. +8% speed, +12% acceleration.',{speed:1.08,accel:1.12,cylinders:4}),
 part('v6','engine','Bung V6',24,'Six cylinders. +15% speed, +24% acceleration.',{speed:1.15,accel:1.24,cylinders:6}),
 part('v8','engine','Big Bun V8',40,'Eight cylinders. +22% speed, +36% acceleration.',{speed:1.22,accel:1.36,cylinders:8}),
 part('v12','engine','Sir Twelve V12',65,'Twelve cylinders. +30% speed, +50% acceleration.',{speed:1.3,accel:1.5,cylinders:12}),
 part('r16','engine','REBAR R16',180,'Sixteen cylinders. 1.4× V12 top speed and acceleration.',{speed:1.82,accel:2.1,cylinders:16}),
 part('g18','engine','GIRDER G18',350,'Eighteen cylinders. 2× V12 top speed and acceleration.',{speed:2.6,accel:3,cylinders:18}),
 part('turbo','induction','Turbocharger',25,'Exhaust turbine. Stronger boost and top speed.',{speed:1.12,accel:1.12}),
 part('supercharger','induction','Supercharger',30,'Belt-driven blower. Faster response and acceleration.',{speed:1.06,accel:1.3}),
 part('race','tyres','Race tyres',15,'High dry grip; sharper turn-in. Wet roads reduce traction.',{turn:1.17}),
 part('drift','tyres','Drift tyres',15,'Power oversteer and real sideways momentum. No Space required.',{turn:1.08,drift:1.7}),
 part('offroad','tyres','Off-road tyres',15,'Chunky tread. More grip and drive on steep ground.',{turn:1.1,terrain:1.3}),
 part('touring','tyres','Touring tyres',9,'Wide road tyres. Smoother steering.',{turn:1.06}),
 part('low','suspension','Street coilovers',12,'Adjustable front/rear ride height. Slam it or dial in rake.',{height:-.12,turn:1.08}),
 part('lift','suspension','Raised suspension',12,'Raised body, long visible springs.',{height:.2,terrain:1.15}),
 part('camber','alignment','Adjustable camber plates',10,'Independent front/rear camber. Extreme angles reduce grip.',{camber:.17,turn:1.05}),
 part('tank','tank','Long-range tank',18,'Mounted reserve cylinder. +50% boost capacity.',{fuel:1.5}),
 part('endurance','tank','Endurance tank',32,'Twin reserve cylinders. Double boost capacity.',{fuel:2}),
 part('nitro','nitro','Nitro injection',22,'Blue bottle and boost exhaust. Stronger Shift boost.',{nitro:1.16}),
 part('brakes','brakes','Race brakes',10,'Red calipers. Stronger braking response.',{brake:1.6}),
 part('cyan','underglow','River cyan underglow',8,'Cyan ground light.',{light:0x39eaff}),
 part('pink','underglow','Hot chips pink underglow',8,'Pink ground light.',{light:0xff4ba9}),
 part('gold','underglow','Golden underglow',8,'Gold ground light.',{light:0xffca53}),
 part('stripe','decal','Rebar racing stripes',6,'Contrasting raised side stripes.'),
 part('number','decal','Bung number plates',6,'01 plate on both sides.'),
 part('spoiler','aero','Rebar wing',12,'Rear wing. More high-speed steering.',{turn:1.08}),
 part('wide','fitment','Adjustable wheel fitment',10,'Independent axle tyre widths. Wider tyres change grip and appearance.'),
 part('lights','lights','Rally light bar',9,'Four lamps and stronger trolley headlights.',{headlight:1.6}),
 part('exhaust','exhaust','Twin exhaust',10,'Dual chrome pipes. Small acceleration gain.',{accel:1.05}),
];
export function buildRecord(value) {
 const owned = [...new Set((Array.isArray(value?.owned) ? value.owned : []).filter(id=>PARTS.some(p=>p.id===id)))];
 const equipped = {};
 for(const [slot,id] of Object.entries(value?.equipped || {}))
   if(owned.includes(id)&&PARTS.some(p=>p.id===id&&p.slot===slot))equipped[slot]=id;
 return {owned,equipped,...(value?.setup?{setup:cleanSetup(value.setup)}:{})};
}
export function garageAction(current, id, action, balance) {
 const selected=PARTS.find(p=>p.id===id);
 if(!selected)throw Error('Choose a garage part.');
 const next=buildRecord(current);
 let cost=0;
 if(action==='remove')delete next.equipped[selected.slot];
 else {
  if(!next.owned.includes(id)){
   if(balance<selected.price)throw Error('Collect more rebar for this part.');
   cost=selected.price;next.owned.push(id);
  }
  next.equipped[selected.slot]=id;
 }
 return {next,cost};
}
export function tuning(record) {
 const normalized=buildRecord(record),equipped=normalized.equipped;
 const result={speed:1,accel:1,turn:1,fuel:1,drift:1,terrain:1,nitro:1,brake:1,height:0,camber:0,cylinders:0,light:0,headlight:1};
 for(const id of Object.values(equipped)){
  const p=PARTS.find(p=>p.id===id);
  for(const [key,n] of Object.entries(p.stats)) {
   if(['height','camber','cylinders','light'].includes(key))result[key]=n;
   else result[key]*=n;
  }
 }
 const setup=normalized.setup||{};
 result.frontHeight=equipped.suspension?(setup.frontHeight??result.height):0;
 result.rearHeight=equipped.suspension?(setup.rearHeight??result.height):0;
 result.frontCamber=equipped.alignment?(setup.frontCamber??-result.camber*180/Math.PI):0;
 result.rearCamber=equipped.alignment?(setup.rearCamber??-result.camber*180/Math.PI):0;
 result.frontWidth=equipped.fitment==='wide'?(setup.frontWidth??1):1;
 result.rearWidth=equipped.fitment==='wide'?(setup.rearWidth??1):1;
 result.height=(result.frontHeight+result.rearHeight)/2;
 result.pitch=Math.atan2(result.rearHeight-result.frontHeight,.96);
 result.tyre=equipped.tyres||'stock';
 return result;
}

export const SETUP_LIMITS={frontHeight:[-.42,.28],rearHeight:[-.42,.28],frontCamber:[-18,0],rearCamber:[-18,0],frontWidth:[.65,2],rearWidth:[.65,2]};
export function cleanSetup(value){
 const setup={};if(!value||typeof value!=='object')return setup;
 for(const [key,[min,max]] of Object.entries(SETUP_LIMITS))if(Number.isFinite(value[key]))setup[key]=Math.round(Math.max(min,Math.min(max,value[key]))*1000)/1000;
 for(const name of ['height','camber','width']){
  setup[name+'Linked']=value[name+'Linked']!==false;
  const field=name[0].toUpperCase()+name.slice(1);
  if(setup[name+'Linked']&&setup['front'+field]!==undefined)setup['rear'+field]=setup['front'+field];
 }
 return setup;
}
export function garageSetup(record,value){
 const next=buildRecord(record),setup=cleanSetup(value);
 if(!Object.keys(setup).length)throw Error('Choose a valid setup.');
 for(const name of ['Height','Camber','Width']){
  const allowed=name==='Height'?!!next.equipped.suspension:name==='Camber'?!!next.equipped.alignment:next.equipped.fitment==='wide';
  if(!allowed)for(const end of ['front','rear'])delete setup[end+name];
 }
 next.setup=setup;return next;
}

// Scale the existing V12 safety ceiling too, so elite engines retain their
// advertised advantage even with boost, induction and campaign bonuses.
export function engineSpeedScale(record){
 const cylinders=record?.cylinders??tuning(record).cylinders;
 return cylinders===16?1.4:cylinders===18?2:1;
}
