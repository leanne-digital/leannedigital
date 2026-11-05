import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.WORKSPACE_PLAYWRIGHT?pathToFileURL(process.env.WORKSPACE_PLAYWRIGHT).href:'playwright');
const root=process.cwd();
let archived=true,archiveRequests=0;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');let body='';for await(const chunk of req)body+=chunk;
 let data;
 if(url.pathname==='/api/auth/me')data={user:{id:'1',role:'staff',email:'gary@fixture.test',name:'Gary',privilege:'super-admin',canManagePrivateClients:true}};
 else if(url.pathname==='/api/clients')data={clients:(!archived||url.searchParams.get('archived')==='1')?[{id:101,slug:'archive-fixture',name:'Archive Fixture',visibility:'shared',archivedAt:archived?'2026-11-05T10:00:00Z':null,services:[],reports:[]}]:[],projects:[],staff:[]};
 else if(url.pathname==='/api/clients/archive-fixture')data={client:{id:101,slug:'archive-fixture',name:'Archive Fixture',visibility:'shared',services:[],reports:[]}};
 else if(url.pathname==='/api/clients/archive-fixture/restore'){assert.equal(req.method,'POST');assert.equal(req.headers['content-type'],'application/json');assert.deepEqual(JSON.parse(body),{});archived=false;archiveRequests++;data={restored:true};}
 else if(url.pathname.startsWith('/api/'))data={entries:[],projects:[],accounts:[],identities:[],clients:[],setup:{configured:false}};
 if(data){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;}
 const file=url.pathname==='/clients/'?(process.env.WORKSPACE_HTML||path.join(root,'clients/index.html')):path.join(root,url.pathname);
 if((!file.startsWith(root)&&file!==process.env.WORKSPACE_HTML)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.WORKSPACE_CHROME?{executablePath:process.env.WORKSPACE_CHROME}:{})});
try{
 for(const width of [1440,390]){
 archived=true;archiveRequests=0;
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(`http://127.0.0.1:${server.address().port}/clients/#archived-clients`);
 const panel=page.locator('[data-admin-panel=archived-clients]');await panel.waitFor({state:'visible'});
 await panel.getByText('Archive Fixture',{exact:true}).waitFor();
 await panel.getByRole('searchbox').fill('no match');await panel.getByText('No archived clients match this view.').waitFor();await panel.getByRole('searchbox').fill('');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await panel.getByRole('button',{name:'Restore client',exact:true}).click();
 await page.locator('tr[data-open-client="archive-fixture"]').waitFor();
 assert.equal(archiveRequests,1);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: desktop/mobile archived view, search, confirmation, JSON restore POST and active list after restore.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
