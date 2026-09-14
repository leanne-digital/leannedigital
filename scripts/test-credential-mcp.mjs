import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ld-mcp-credentials-'));process.env.LD_CREDENTIALS_FILE=path.join(dir,'records.json');
const {createMcpServer}=await import('../server/mcp-tools.mjs');
const {readClientRecord}=await import('../server/client-credentials.mjs');
async function connect(options){const server=createMcpServer(options);const client=new Client({name:'test',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(a),client.connect(b)]);return {server,client};}
const read=await connect({readOnly:true});assert.ok(!(await read.client.listTools()).tools.some(t=>t.name==='save_client_credential'));await read.client.close();await read.server.close();
const {server,client}=await connect({readOnly:true,credentialWrite:true});
try{
 const names=(await client.listTools()).tools.map(t=>t.name);assert.ok(names.includes('save_client_credential'));assert.ok(!names.includes('delete_client'));assert.ok(!names.includes('update_client'));
 const call=async(name,args)=>{const result=await client.callTool({name,arguments:args});assert.ok(!result.isError);return JSON.parse(result.content[0].text);};
 const saved=await call('save_client_credential',{id:'leanne-digital',name:'Mailchimp fixture',username:'00123',password:'test-only-secret'});assert.equal(saved.slot,'other1');assert.ok(!JSON.stringify(saved).includes('test-only-secret'));
 const inventory=await call('list_client_credentials',{id:'leanne-digital'});assert.equal(inventory.count,1);assert.ok(inventory.accounts[0].hasPassword);assert.ok(!JSON.stringify(inventory).includes('00123'));
 await call('save_client_credential',{id:'leanne-digital',name:'Mailchimp fixture',url:'https://example.test'});assert.equal(readClientRecord('leanne-digital',{role:'staff'}).fields.other1_username,'00123');
 const hosting=await call('get_hosting_accounts',{});assert.equal(hosting.count,hosting.accounts.length);assert.equal(typeof hosting.monthlyValue,'number');
 console.log('PASS: scoped credential saves, read-only restrictions, secret-free results, matching-slot updates and hosting totals.');
}finally{await client.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});}
