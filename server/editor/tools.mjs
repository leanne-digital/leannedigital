import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registry } from './schema.mjs';

export function registerEditorTools(server,store,actor,{readOnly=false}={}) {
    if(readOnly)actor={...actor,permissions:['read']};
    for(const [name,permission,group,example,schema] of registry) {
        if(readOnly&&permission!=='read')continue;
        try{store.authorize(actor,permission);store.assertFeature(actor,group);}catch{continue;}
        server.tool(name,`${group}: ${example} Site is fixed by the authenticated grant. Resolve ambiguous targets before editing. Production publication is separate from saving drafts.`,schema,
            {readOnlyHint:permission==='read',destructiveHint:false,openWorldHint:false},
            async input=>{
                try {const result=await store.invoke(actor,name,input);return {content:[{type:'text',text:JSON.stringify(result)}]};}
                catch(error){return {isError:true,content:[{type:'text',text:JSON.stringify({code:error.code||'INVALID_INPUT',message:error.name==='ZodError'?'Input does not match the allowed editor schema.':error.message,details:error.details||error.issues||{}})}]};}
            });
    }
}
export function createEditorMcp(store,actor) {
    const server=new McpServer({name:'leanne-digital-website-editor',version:'1.1.0'},{instructions:'Use editor_capabilities first. Inspect the current page and exact target IDs. For ambiguous references show candidates and ask the user. Global/shared scope must be explicit. Prepare, preview, save draft, re-preview, then publish only at the user’s explicit instruction using the exact digest. Never claim a draft is live. Scheduling requires a saved reviewed post and explicit future Toronto time with UTC offset. Changing a displayed date does not publish. Agency structural edits remain unavailable.'});
    registerEditorTools(server,store,actor);return server;
}
