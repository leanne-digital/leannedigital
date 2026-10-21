import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { permissionsForScopes } from '../server/mcp-permissions.mjs';
import { appendClientWorkLog, listClientWorkLogs } from '../server/services/client-work-log.mjs';

test('append-only work log preserves date, report association, actor and duplicate identity', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-work-log-'));
    const original = process.env.CLIENT_WORK_LOG_DB_PATH;
    process.env.CLIENT_WORK_LOG_DB_PATH = path.join(directory, 'log.sqlite');
    try {
        const input = {clientSlug:'gbt-logistics', projectId:'44', month:'2026-10', reportSlug:'seo-report-gbt-logistics-october-2026', workedOn:'2026-10-21', title:'GA4 investigation',details:'Investigated measurement mismatch. Awaiting response. No changes.',status:'awaiting_client'};
        const first = appendClientWorkLog(input, 'test-staff');
        assert.equal(first.created, true);
        assert.equal(first.entry.createdBy, 'test-staff');
        const duplicate = appendClientWorkLog({...input,details:'  Investigated measurement mismatch.  Awaiting response. No changes.  '}, 'other');
        assert.equal(duplicate.created, false);
        assert.equal(duplicate.entry.id, first.entry.id);
        assert.deepEqual(listClientWorkLogs({clientSlug:'gbt-logistics',month:'2026-10',reportSlug:input.reportSlug}), [first.entry]);
        assert.equal(listClientWorkLogs({clientSlug:'another-client'}).length, 0);
        assert.throws(()=>appendClientWorkLog({...input,workedOn:'2026-02-30'}));
        assert.throws(()=>appendClientWorkLog({...input,month:'2026-11'}));
        assert.throws(()=>appendClientWorkLog({...input,clientSlug:'../escape'}));
    } finally {
        if (original === undefined) delete process.env.CLIENT_WORK_LOG_DB_PATH; else process.env.CLIENT_WORK_LOG_DB_PATH = original;
        fs.rmSync(directory,{recursive:true,force:true});
    }
});

test('narrow OAuth scope exposes only append work-log write; read-only and global kill switch deny it', async () => {
    const {createMcpServer}=await import('../server/mcp-tools.mjs');
    for (const [scopes,force,allowed] of [
        [['mcp:read'],false,false],
        [['mcp:read','mcp:worklog:write'],false,true],
        [['mcp:read','mcp:worklog:write'],true,false],
    ]) {
        const permissions = permissionsForScopes(scopes,force);
        assert.equal(permissions.readOnly,true);
        assert.equal(permissions.credentialWrite,false);
        const server=createMcpServer(permissions);
        const client=new Client({name:'scope-test',version:'1'});
        const [a,b]=InMemoryTransport.createLinkedPair();
        try {
            await server.connect(a); await client.connect(b);
            const {tools}=await client.listTools();
            assert.deepEqual(tools.filter(t=>!t.annotations.readOnlyHint).map(t=>t.name),allowed?['append_client_work_log']:[]);
            assert.ok(tools.some(t=>t.name==='list_client_work_logs'));
            if(!allowed){
                const result=await client.callTool({name:'append_client_work_log',arguments:{}});
                assert.equal(result.isError,true);
            } else {
                const result=await client.callTool({name:'append_client_work_log',arguments:{clientId:'red-river-college',projectId:'not-a-project',reportSlug:'missing',month:'2026-10',workedOn:'2026-10-21',title:'test',details:'test',status:'completed'}});
                assert.equal(result.isError,true);
            }
        } finally {await client.close();await server.close();}
    }
});
