import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ld-restore-'));
for(const dir of ['server','scripts'])fs.cpSync(dir,path.join(root,dir),{recursive:true});
fs.symlinkSync(path.resolve('node_modules'),path.join(root,'node_modules'),'junction');fs.mkdirSync(path.join(root,'data'));
const privateSupport=fs.existsSync(path.resolve('server/client-access.mjs'));
const archivedAt='2026-11-05T10:00:00Z';
for(const [file,data] of Object.entries({'clients.json':[{id:1,slug:'restore-fixture',name:'Restore Fixture',visibility:'shared',archivedAt,services:[{type:'maintenance',amount:75,cycle:'monthly'}]},{id:2,slug:'private-fixture',name:'Private Fixture',visibility:'private',ownerUserId:'1',archivedAt}],'portal-clients.json':[],'client-projects.json':[],'portfolio-projects.json':[]}))fs.writeFileSync(path.join(root,'data',file),JSON.stringify(data));
process.env.PRIVATE_CLIENT_OWNER_ID='1';process.env.INTAKE_DB_PATH=path.join(root,'intake.sqlite');process.env.CLIENT_WORK_LOG_DB_PATH=path.join(root,'work.sqlite');
const imp=f=>import(pathToFileURL(path.join(root,f)));
const {createUser,login}=await imp('server/auth.mjs');
for(const [email,role] of [['gary','staff'],['other','staff'],['client','client']])await createUser({email:email+'@fixture.test',password:'fixture-long-password',role,...(role==='client'?{clientSlug:'restore-fixture'}:{})});
const sessions=await Promise.all(['gary','other','client'].map(n=>login(n+'@fixture.test','fixture-long-password')));process.env.PRIVATE_CLIENT_OWNER_ID=String(sessions[0].user.id);
const {createPortalServer}=await imp('server/api.mjs');const server=createPortalServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const req=(url,who=0,method='GET',headers={})=>fetch(origin+url,{method,headers:{...(who===null?{}:{cookie:'ld_portal='+sessions[who].session.id}),Origin:origin,'Content-Type':'application/json',...headers},...(method==='POST'?{body:'{}'}:{})});
try{
 const all=await (await req('/api/clients?archived=1')).json();const before=all.clients.find(c=>c.slug==='restore-fixture');assert.ok(before.archivedAt);
 assert.equal((await (await req('/api/clients')).json()).clients.length,0);
 const other=await (await req('/api/clients?archived=1',1)).json();if(privateSupport)assert.ok(!other.clients.some(c=>c.slug==='private-fixture'));
 const endpoint='/api/clients/restore-fixture/restore';
 for(const [who,status] of [[null,401],[2,403]])assert.equal((await req(endpoint,who,'POST')).status,status);
 assert.equal((await req(endpoint,0,'POST',{Origin:'https://unrelated.invalid'})).status,403);
 if(privateSupport)assert.equal((await req('/api/clients/private-fixture/restore',1,'POST')).status,404);
 assert.equal((await req('/api/clients/missing/restore',0,'POST')).status,404);
 const restored=await req(endpoint,0,'POST');assert.equal(restored.status,200);const result=await restored.json();assert.equal(result.restored,true);assert.equal(result.client.archivedAt,null);assert.deepEqual(result.client.services,before.services);assert.equal(result.client.visibility,before.visibility);
 assert.equal((await (await req(endpoint,0,'POST')).json()).restored,false);
 const active=await (await req('/api/clients')).json();assert.deepEqual(active.clients.map(c=>c.slug),['restore-fixture']);
 assert.ok((await (await req('/api/clients?archived=1')).json()).clients.find(c=>c.slug==='private-fixture').archivedAt);
 console.log('PASS restore HTTP (private extension: '+privateSupport+'):  active/archive listing, staff authorization, applicable privacy checks, CSRF, missing client, idempotence and preserved services/visibility.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
