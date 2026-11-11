const assert=require('node:assert/strict');const{randomBytes,randomUUID}=require('node:crypto');
const endpoint=process.env.ROOM_SERVER||'http://127.0.0.1:8796';
const code=()=> 'bung-'+randomBytes(32).toString('hex');
async function request(key,body){const r=await fetch(endpoint+'/profile',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
(async()=>{
 const a=code(),b=code();
 assert.equal((await request(a,{type:'read',seed:{rebars:100}})).data.rebar,100);
 assert.equal((await request(a,{type:'read',seed:{rebars:99999}})).data.rebar,100);
 const op={id:randomUUID(),delta:20};
 await Promise.all([request(a,{type:'apply',operation:op}),request(a,{type:'apply',operation:op})]);
 assert.equal((await request(a,{type:'read'})).data.rebar,120);
 const sales=await Promise.all([request(a,{type:'apply',operation:{id:randomUUID(),delta:-100}}),request(a,{type:'apply',operation:{id:randomUUID(),delta:-100}})]);
 assert.equal(sales.filter(r=>r.status===200).length,1);assert.equal(sales.filter(r=>r.status===409).length,1);
 assert.equal((await request(a,{type:'restore'})).data.rebar,20);
 assert.equal((await request(b,{type:'restore'})).status,404);
 assert.equal((await request(b,{type:'read',seed:{rebar:3}})).data.rebar,3);
 assert.equal((await request(a,{type:'read'})).data.rebar,20);
 console.log('PROFILE STORAGE PASSED: initialization once, duplicate requests, concurrent spending, recovery, player isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
