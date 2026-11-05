import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EditorStore } from '../server/editor/store.mjs';

test('existing portal serves scoped editor MCP while retaining existing routes',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ld-editor-portal-'));
    process.env.WEBSITE_EDITOR_DATA_DIR=dir;
    const store=new EditorStore(dir);
    store.bootstrap({site:'portal-test',name:'Portal test',origin:'https://example.com',sourceRoot:path.resolve('.'),pages:[{path:'/',title:'Test',kind:'page',html:'<!doctype html><html><head><title>Test</title></head><body><main><section><h1>Test</h1><p>Content</p></section></main></body></html>'}]});
    store.grant('client@example.com','portal-test','viewer');const token=store.token('client@example.com','portal-test');
    const {createPortalServer}=await import('../server/api.mjs');
    const {configuredEditor}=await import('../server/editor/http.mjs');
    const server=createPortalServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
    try {
        const r=await fetch(origin+'/mcp/editor',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})});
        assert.equal(r.status,200);const names=(await r.json()).result.tools.map(t=>t.name);assert.ok(names.includes('editor_get_page'));assert.ok(!names.includes('editor_publish_changes'));assert.ok(!names.includes('list_clients'));
        assert.equal((await fetch(origin+'/api/clients',{headers:{Authorization:'Bearer '+token}})).status,401);
        const homepage=await fetch(origin+'/');assert.equal(homepage.status,200);assert.match(await homepage.text(),/hero-heading/);
        const spec=await fetch(origin+'/api/openapi.json');assert.equal(spec.status,200);
    } finally {await new Promise(r=>server.close(r));configuredEditor()?.close();store.close();delete process.env.WEBSITE_EDITOR_DATA_DIR;fs.rmSync(dir,{recursive:true,force:true});}
});
