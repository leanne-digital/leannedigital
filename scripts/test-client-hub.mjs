import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ld-record-test-'));
process.env.LD_CREDENTIALS_FILE=path.join(dir,'records.json');
process.env.PORTAL_API_KEY='local-record-test-key';
const {readClientRecord,saveClientRecord}=await import('../server/client-credentials.mjs');
const {parseInsert}=await import('./import-portal.mjs');
const sql="INSERT INTO `jiw_clients` (`company_name`, `domain_username`, `domain_password`) VALUES ('Example', '00123', ' a\\\\b\\\'c ');";
const row=parseInsert(sql).rows[0];
assert.equal(row.domain_username,'00123');
assert.equal(row.domain_password," a\\b'c ");
for(const user of [null,{role:'client'}]){
 assert.throws(()=>readClientRecord('leanne-digital',user),{status:403});
 assert.throws(()=>saveClientRecord('leanne-digital',{domain_password:'fixture'},user),{status:403});
}
const staff={role:'staff'};
assert.equal(readClientRecord('leanne-digital',staff).available,false);
saveClientRecord('leanne-digital',{domain_password:'fixture-only',domain_username:'00123'},staff);
saveClientRecord('leanne-digital',{contact_name:'Test'},staff);
assert.equal(readClientRecord('leanne-digital',staff).fields.domain_username,'00123');
assert.throws(()=>saveClientRecord('leanne-digital',{unexpected:'field'},staff),{status:400});
const {createPortalServer}=await import('../server/api.mjs');
const server=createPortalServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try{
 for(const url of ['/clients/leanne-digital/','/clients/davis-window-and-door/seo-report-davis-window-and-door-september-2026/']){
  const res=await fetch(base+url,{redirect:'manual'});assert.equal(res.status,200);assert.ok(!(await res.text()).includes('fixture-only'));
 }
 assert.equal((await fetch(base+'/clients/',{redirect:'manual'})).status,302);
 assert.equal((await fetch(base+'/runtime/client-credentials.json')).status,404);
 const endpoint=base+'/api/clients/leanne-digital/system-record';
 assert.equal((await fetch(endpoint)).status,401);
 const response=await fetch(endpoint,{headers:{'X-API-Key':process.env.PORTAL_API_KEY}});
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal((await response.json()).fields.domain_password,'fixture-only');
 const saved=await fetch(endpoint,{method:'PATCH',headers:{'X-API-Key':process.env.PORTAL_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({fields:{domain_username:'00042'}})});
 assert.equal(saved.status,200);assert.equal((await saved.json()).fields.domain_username,'00042');
 console.log('PASS: SQL fidelity, staff-only records, partial updates, API authentication, private caching, public reports and private directory.');
}finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
