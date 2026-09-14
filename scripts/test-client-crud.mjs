import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.LD_CRUD_FIXTURE) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ld-crud-fixture-'));
    try {
        for(const folder of ['scripts','server'])fs.cpSync(path.join(root,folder),path.join(dir,folder),{recursive:true});
        fs.mkdirSync(path.join(dir,'data'));
        for(const name of fs.readdirSync(path.join(root,'data')))if(/^(clients|portal-clients|client-projects|client-project-updates|client-proposals)\.json$/.test(name))fs.copyFileSync(path.join(root,'data',name),path.join(dir,'data',name));
        fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'junction');
        const result=spawnSync(process.execPath,[path.join(dir,'scripts/test-client-crud.mjs')],{env:{...process.env,LD_CRUD_FIXTURE:'1',LD_CREDENTIALS_FILE:path.join(dir,'private.json')},encoding:'utf8'});
        process.stdout.write(result.stdout);process.stderr.write(result.stderr);assert.equal(result.status,0);
    } finally {fs.rmSync(dir,{recursive:true,force:true});}
} else {
    const {clientCrud}=await import('../server/client-crud.mjs');
    const {credentialInventory,saveCredential,deleteCredential}=await import('../server/credential-tools.mjs');
    const {loadClients}=await import('./client-store.mjs');
    const client=loadClients().find(row=>row.slug==='leanne-digital')?.slug||loadClients()[0].slug;
    assert.equal(credentialInventory(client).available,false);
    saveCredential(client,{name:'WP Rocket fixture',password:'fixture-only'});
    assert.equal(credentialInventory(client).count,1);
    saveCredential(client,{name:'WP Rocket fixture',username:'fixture-user'});
    deleteCredential(client,'other1');assert.equal(credentialInventory(client).count,0);
    await clientCrud(client,'services','create',{type:'crud-fixture',amount:120,cycle:'monthly'});
    await assert.rejects(()=>clientCrud(client,'services','create',{type:'crud-fixture'}),{status:409});
    await clientCrud(client,'services','update',{type:'crud-fixture',amount:150});
    assert.equal((await clientCrud(client,'services','read')).services.find(row=>row.type==='crud-fixture').cycle,'monthly');
    await clientCrud(client,'services','delete',{type:'crud-fixture'});
    const proposal=await clientCrud(client,'proposals','create',{title:'Fixture',url:'/proposals/fixture/',status:'active'});
    await clientCrud(client,'proposals','update',{id:proposal.id,title:'Changed'});
    assert.equal((await clientCrud(client,'proposals','read')).proposals.find(row=>row.id===proposal.id).title,'Changed');
    await clientCrud(client,'proposals','delete',{id:proposal.id});
    const {saveSeoReport,deleteSeoReport,loadReportRecord}=await import('./seo-report-store.mjs');
    const report=await saveSeoReport(client,{monthKey:'2099-01',monthlyRecap:'Fixture'});
    assert.equal(loadReportRecord(client,report.slug).monthKey,'2099-01');
    await assert.rejects(()=>saveSeoReport(client,{slug:'../../escape',monthKey:'2099-01'}),{status:400});
    await deleteSeoReport(client,report.slug);assert.equal(loadReportRecord(client,report.slug),null);
    const {createClientProject,deleteClientProject,getClientProject,seedProjectsFromClientServices}=await import('./client-project-store.mjs');
    const project=createClientProject({clientId:client,serviceType:'crud-fixture'});deleteClientProject(project.id);seedProjectsFromClientServices();assert.equal(getClientProject(project.id),null);
    console.log('PASS isolated client service/proposal/report/project/credential CRUD, partial updates, missing records and path validation');
    process.env.PORTAL_API_KEY='crud-fixture-key';
    const {createPortalServer}=await import('../server/api.mjs');
    const server=createPortalServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/clients/${client}`;
    const headers={'X-API-Key':process.env.PORTAL_API_KEY,'Content-Type':'application/json'};
    try {
        assert.equal((await fetch(base+'/credentials')).status,401);
        assert.equal((await fetch(base+'/credentials',{method:'POST',headers,body:JSON.stringify({name:'Fixture',password:'private-test'})})).status,200);
        const read=await fetch(base+'/credentials',{headers});assert.equal(read.status,200);assert.ok(!(await read.text()).includes('private-test'));
        assert.equal((await fetch(base+'/credentials/other1',{method:'DELETE',headers,body:'{}'})).status,400);
        assert.equal((await fetch(base+'/credentials/other1',{method:'DELETE',headers,body:'{"confirm":true}'})).status,200);
        const created=await fetch(base+'/proposals',{method:'POST',headers,body:JSON.stringify({title:'HTTP fixture',url:'/proposals/test/',status:'active'})});assert.equal(created.status,200);
        const record=await created.json();
        assert.equal((await fetch(base+'/proposals/'+record.id,{method:'PATCH',headers,body:'{"title":"Updated"}'})).status,200);
        assert.equal((await fetch(base+'/proposals/'+record.id,{method:'DELETE',headers,body:'{"confirm":true}'})).status,200);
        console.log('PASS staff-only HTTP CRUD, masked credentials and explicit delete confirmation');
    } finally {await new Promise(resolve=>server.close(resolve));}
}
