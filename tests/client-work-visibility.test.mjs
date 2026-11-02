import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('Client Work defaults to shared and filters requests, rows, and exports',async()=>{
 const nodes=new Map();
 const node=()=>({value:'',innerHTML:'',textContent:'',disabled:false,dataset:{},events:{},addEventListener(name,fn){this.events[name]=fn;},replaceChildren(){this.innerHTML='';}});
 for(const id of ['month','refresh','export','status','rows','visibility'])nodes.set('#client-work-'+id,node());
 nodes.get('#client-work-visibility').value='shared';
 const panel=node();panel.querySelector=s=>nodes.get(s);
 const events={},requests=[];let downloaded;
 const context={Date,Promise,encodeURIComponent,setInterval(){},setTimeout(){},location:{hash:'#client-work'},
  window:{addEventListener(name,fn){events[name]=fn;}},
  document:{hidden:false,querySelector(){return {append(){}};},createElement(type){return type==='section'?panel:{click(){},remove(){}};},body:{append(){}},addEventListener(){}},
  Blob:class{constructor(parts){downloaded=JSON.parse(parts[0]);}},URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
  fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({entries:[{id:url,month:nodes.get('#client-work-month').value,workedOn:'2026-11-02',title:'Task',details:'Details',status:'completed'}]})};}};
 const source=fs.readFileSync(new URL('../js/workspace-extra.js',import.meta.url),'utf8');
 vm.runInNewContext(source.slice(source.indexOf('(() => {',10)),context);
 assert.match(panel.innerHTML, /value="shared" selected>Leanne Digital only/);
 events['workspace-data']({detail:{clients:[{slug:'shared',name:'Shared',visibility:'shared'},{slug:'legacy',name:'Legacy'},{slug:'gary',name:'Gary private',visibility:'private'},{slug:'leanne',name:'Leanne private',visibility:'private'}]}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,2);
 assert.ok(requests.every(url=>!url.includes('/gary/')&&!url.includes('/leanne/')));
 nodes.get('#client-work-export').events.click();
 assert.equal(downloaded.visibility,'shared');assert.equal(downloaded.clientCount,2);
 requests.length=0;nodes.get('#client-work-visibility').value='private';
 await nodes.get('#client-work-visibility').events.change();
 assert.equal(requests.length,2);assert.ok(requests.every(url=>url.includes('/gary/')||url.includes('/leanne/')));
 nodes.get('#client-work-export').events.click();assert.equal(downloaded.visibility,'private');assert.equal(downloaded.clientCount,2);
 requests.length=0;nodes.get('#client-work-visibility').value='all';
 await nodes.get('#client-work-visibility').events.change();assert.equal(requests.length,4);
 nodes.get('#client-work-export').events.click();assert.equal(downloaded.clientCount,4);
});
