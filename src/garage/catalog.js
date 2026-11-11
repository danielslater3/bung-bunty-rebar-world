export const GARAGE = { x: 94, y: 9.7, z: 37, label: 'BUNG GARAGE' };
const part = (id, slot, name, price, detail, stats = {}) => ({ id, slot, name, price, detail, stats });
export const PARTS = [
 part('v4','engine','Rebar V4',12,'Four visible cylinders. +8% speed, +12% acceleration.',{speed:1.08,accel:1.12,cylinders:4}),
 part('v6','engine','Bung V6',24,'Six cylinders. +15% speed, +24% acceleration.',{speed:1.15,accel:1.24,cylinders:6}),
 part('v8','engine','Big Bun V8',40,'Eight cylinders. +22% speed, +36% acceleration.',{speed:1.22,accel:1.36,cylinders:8}),
 part('v12','engine','Sir Twelve V12',65,'Twelve cylinders. +30% speed, +50% acceleration.',{speed:1.3,accel:1.5,cylinders:12}),
 part('turbo','induction','Turbocharger',25,'Exhaust turbine. Stronger boost and top speed.',{speed:1.12,accel:1.12}),
 part('supercharger','induction','Supercharger',30,'Belt-driven blower. Faster response and acceleration.',{speed:1.06,accel:1.3}),
 part('race','tyres','Race tyres',15,'Low-profile slicks. Sharper steering.',{turn:1.17}),
 part('drift','tyres','Drift tyres',15,'Pink sidewalls. Faster drift charge and wider slides.',{turn:1.08,drift:1.7}),
 part('offroad','tyres','Off-road tyres',15,'Chunky tread. More grip and drive on steep ground.',{turn:1.1,terrain:1.3}),
 part('touring','tyres','Touring tyres',9,'Wide road tyres. Smoother steering.',{turn:1.06}),
 part('low','suspension','Lowered suspension',12,'Lower basket and engine, shorter visible springs.',{height:-.12,turn:1.08}),
 part('lift','suspension','Raised suspension',12,'Raised body, long visible springs.',{height:.2,terrain:1.15}),
 part('camber','alignment','Negative camber',10,'Angled wheel assemblies. Quicker cornering.',{camber:.17,turn:1.05}),
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
 part('lights','lights','Rally light bar',9,'Four lamps and stronger trolley headlights.',{headlight:1.6}),
 part('exhaust','exhaust','Twin exhaust',10,'Dual chrome pipes. Small acceleration gain.',{accel:1.05}),
];
export function buildRecord(value) {
 const owned = [...new Set((Array.isArray(value?.owned) ? value.owned : []).filter(id=>PARTS.some(p=>p.id===id)))];
 const equipped = {};
 for(const [slot,id] of Object.entries(value?.equipped || {}))
   if(owned.includes(id)&&PARTS.some(p=>p.id===id&&p.slot===slot))equipped[slot]=id;
 return {owned,equipped};
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
 const result={speed:1,accel:1,turn:1,fuel:1,drift:1,terrain:1,nitro:1,brake:1,height:0,camber:0,cylinders:0,light:0,headlight:1};
 for(const id of Object.values(buildRecord(record).equipped)){
  const p=PARTS.find(p=>p.id===id);
  for(const [key,n] of Object.entries(p.stats)) {
   if(['height','camber','cylinders','light'].includes(key))result[key]=n;
   else result[key]*=n;
  }
 }
 return result;
}
