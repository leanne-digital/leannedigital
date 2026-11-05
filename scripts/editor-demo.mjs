// Reproducible MCP example. Refuses to publish outside loopback private staging.
import fs from 'node:fs';
import crypto from 'node:crypto';
const origin='http://127.0.0.1:4186';
const token=fs.readFileSync('runtime/editor-preview-token.txt','utf8').trim();let sequence=0;
const key=()=>crypto.randomUUID();
async function rpc(method,params){const response=await fetch(origin+'/mcp/editor',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++sequence,method,params})});const result=await response.json();if(!response.ok||result.error)throw Error('MCP request failed');return result.result;}
async function call(name,args={}){const result=await rpc('tools/call',{name,arguments:args});if(result.isError)throw Error(result.content[0].text);return JSON.parse(result.content[0].text);}
const capabilities=await call('editor_capabilities');if(capabilities.publicationEnvironment!=='private-staging')throw Error('Demo requires private staging.');
const inventory=await call('editor_list_pages'),home=inventory.pages.find(p=>p.path==='/'),tree=await call('editor_get_page',{pageId:home.id});
const heading=tree.nodes.find(n=>n.tag==='h1'),intro=tree.nodes.find(n=>n.type==='paragraph'&&n.region==='main'&&n.text?.length>80),button=tree.nodes.find(n=>n.type==='button'&&n.region==='main');
if(!heading||!intro||!button)throw Error('Demo expects the original Leanne Digital homepage. Use a fresh imported dataset.');
const baseline=await call('editor_prepare_changes',{expectedRevision:inventory.revision,operations:[{op:'seo',pageId:home.id,fields:{title:home.title}}],idempotencyKey:key()});
const baselinePreview=await call('editor_preview_changes',{changeSetId:baseline.changeSetId});
const assets=[];
for(const filename of ['graphic-design-badges.webp','seo-services.webp','leanne-working.webp']){
    const result=await call('editor_ingest_asset',{filename,base64:fs.readFileSync('assets/images/home/'+filename).toString('base64'),alt:'Agency website demonstration image',idempotencyKey:key()});assets.push(result.asset.id);
}
const current=await call('editor_list_pages');
const changes=await call('editor_prepare_changes',{expectedRevision:current.revision,idempotencyKey:key(),operations:[
    {op:'content',pageId:home.id,targetId:heading.id,fields:{level:3,text:'Your website. Your next chapter.'}},
    {op:'content',pageId:home.id,targetId:intro.id,fields:{text:'This is a private editing preview. Your client can update approved website content through a connected assistant, review the result, and publish when ready.'}},
    ...['normal','hover','focus'].map(state=>({op:'style',pageId:home.id,targetId:button.id,scope:'instance',breakpoint:'all',state,fields:state==='hover'?{color:'brand-red',backgroundColor:'white'}:{color:'white',backgroundColor:'brand-red'}})),
    {op:'blog_create',fields:{title:'A client editing walkthrough',slug:'editor-walkthrough-draft',author:'Leanne Digital',excerpt:'Private demonstration content for reviewing the website editor.',categories:['Demonstration'],tags:['website editing'],featuredAssetId:assets[0],featuredAlt:'Graphic design examples',blocks:[{type:'heading',text:'Make a small change'},{type:'paragraph',text:'This article is a private demonstration draft. It is not published on the production website.'},{type:'image',assetId:assets[1],alt:'SEO services illustration',caption:'An image placed inside the article.'},{type:'heading',text:'Review before publishing'},{type:'image',assetId:assets[2],alt:'Leanne working',caption:'A second body image.'}]}},
]});
const draft=await call('editor_apply_draft',{changeSetId:changes.changeSetId,expectedRevision:current.revision,idempotencyKey:key()});
const review=await call('editor_preview_changes',{changeSetId:changes.changeSetId});
const release=await call('editor_publish_changes',{changeSetId:changes.changeSetId,expectedRevision:draft.revision,reviewDigest:review.reviewDigest,confirm:true,idempotencyKey:key()});
const result={dashboard:origin+'/website-editor/',before:origin+baselinePreview.previewPages.find(p=>p.id===home.id).url,after:origin+review.previewPages.find(p=>p.id===home.id).url,blogDraft:origin+review.previewPages.find(p=>p.path==='/editor-walkthrough-draft/').url,live:origin+release.url,headingId:heading.id,buttonId:button.id,changeSetId:changes.changeSetId,revision:draft.revision};
fs.writeFileSync('runtime/editor-review.json',JSON.stringify(result,null,2));
fs.writeFileSync('docs/website-editor-tools.json',JSON.stringify((await rpc('tools/list',{})).tools,null,2));
console.log(result);
