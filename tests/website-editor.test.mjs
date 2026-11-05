import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';
import { load } from 'cheerio';
import { EditorStore } from '../server/editor/store.mjs';
import { handleEditor } from '../server/editor/http.mjs';
import { uid } from '../server/editor/schema.mjs';

test('authenticated MCP editing lifecycle and isolated publication',async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'ld-editor-test-'));
    const store=new EditorStore(root),source=path.resolve('.');
    const home=fs.readFileSync('index.html','utf8');
    const pages=[{path:'/',title:'Home',html:home,kind:'page'},{path:'/about/',title:'About',html:fs.readFileSync('about/index.html','utf8'),kind:'page'},{path:'/blog/',title:'Blog',html:fs.readFileSync('blog/index.html','utf8'),kind:'page'}];
    for(const site of ['alpha','beta'])store.bootstrap({site,name:site,origin:'https://example.com',sourceRoot:source,pages});
    store.grant('alice','alpha','publisher');store.grant('viewer','alpha','viewer');store.grant('bob','beta','publisher');
    const token=store.token('alice','alpha'),viewToken=store.token('viewer','alpha'),bobToken=store.token('bob','beta');
    const server=http.createServer(async(req,res)=>{if(!await handleEditor(req,res,{store,assets:true})){res.writeHead(404);res.end();}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
    t.after(async()=>{await new Promise(r=>server.close(r));store.close();fs.rmSync(root,{recursive:true,force:true});});
    let rpcId=0;
    async function rpc(method,params={},credential=token){const r=await fetch(origin+'/mcp/editor',{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:++rpcId,method,params})});return {status:r.status,data:await r.json()};}
    async function call(name,args={},credential=token){const r=await rpc('tools/call',{name,arguments:args},credential);assert.equal(r.status,200,JSON.stringify(r));if(r.data.error)return {error:r.data.error};let result;try{result=JSON.parse(r.data.result.content[0].text);}catch{result={message:r.data.result.content[0].text};}if(r.data.result.isError)return {error:result};return result;}
    async function okay(name,args={}){const r=await call(name,args);assert.ok(!r.error,JSON.stringify(r));return r;}
    await t.test('authenticated tool menu and cross-site isolation',async()=>{
        assert.equal((await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'editor-test',version:'1'}})).status,200);
        assert.equal((await rpc('tools/list',{},'wrong')).status,401);
        const list=(await rpc('tools/list')).data.result.tools.map(t=>t.name);
        assert.ok(list.includes('editor_publish_changes'));assert.ok(!list.includes('list_clients'));assert.ok(!list.includes('list_client_credentials'));
        const viewer=(await rpc('tools/list',{},viewToken)).data.result.tools.map(t=>t.name);assert.ok(!viewer.includes('editor_prepare_changes'));
        const homeId=(await okay('editor_list_pages')).pages[0].id;
        assert.ok((await call('editor_get_page',{pageId:homeId},bobToken)).error);
        assert.ok((await call('editor_get_page',{pageId:homeId,site:'alpha'},bobToken)).error);
        assert.ok((await call('list_clients')).error);
        const caps=await okay('editor_capabilities');assert.deepEqual(caps.tools.map(x=>x.name).sort(),list.sort());
    });
    const homeId=(await okay('editor_list_pages')).pages[0].id;
    let tree=await okay('editor_get_page',{pageId:homeId});
    const heading=tree.nodes.find(n=>n.tag==='h1'),intro=tree.nodes.find(n=>n.type==='paragraph'&&n.region==='main'&&n.text?.length>80),button=tree.nodes.find(n=>n.type==='button'&&n.region==='main'),image=tree.nodes.find(n=>n.type==='image'&&n.region==='main');
    const testimonials=tree.nodes.find(n=>n.type==='section'&&/What People/.test(n.label));
    const originalHeading=heading.id;
    await t.test('target resolution and ambiguity',async()=>{
        const ambiguous=await okay('editor_find_content',{pageId:homeId,kind:'paragraph'});assert.equal(ambiguous.needsClarification,true);
        const fourth=await okay('editor_find_content',{pageId:homeId,kind:'paragraph',ordinal:4,fromBottom:true});assert.equal(fourth.candidates.length,1);assert.equal(fourth.candidates[0].region,'main');
    });
    const assetIds=[];
    await t.test('validated assets and retry idempotency',async()=>{
        for(const color of ['red','green','blue']){const buffer=await sharp({create:{width:400,height:250,channels:3,background:color}}).png().toBuffer();const args={filename:color+'.png',base64:buffer.toString('base64'),alt:'Test '+color,idempotencyKey:uid()};const result=await okay('editor_ingest_asset',args);assetIds.push(result.asset.id);assert.deepEqual(await okay('editor_ingest_asset',args),result);}
        assert.ok((await call('editor_ingest_asset',{filename:'bad.svg',base64:Buffer.from('<svg onload="alert(1)"/>').toString('base64'),idempotencyKey:uid()})).error);
    });
    let prepared,applied,preview;
    await t.test('prepare exact content, semantics, styles, media, order and responsive scopes',async()=>{
        tree=await okay('editor_get_page',{pageId:homeId});
        const operations=[
            {op:'content',pageId:homeId,targetId:heading.id,fields:{text:'A website you can make your own',level:3}},
            {op:'content',pageId:homeId,targetId:intro.id,fields:{richText:[{text:'Updated introduction. ',bold:true},{text:'Contact us',href:'/contact/'}]}},
            {op:'move',pageId:homeId,targetId:testimonials.id,position:{fromBottom:2}},
            {op:'style',pageId:homeId,targetId:button.id,scope:'instance',breakpoint:'all',state:'normal',fields:{color:'white',backgroundColor:'brand-red'}},
            {op:'style',pageId:homeId,targetId:button.id,scope:'instance',breakpoint:'all',state:'hover',fields:{color:'brand-red',backgroundColor:'white'}},
            {op:'style',pageId:homeId,targetId:button.id,scope:'instance',breakpoint:'all',state:'focus',fields:{color:'brand-red',backgroundColor:'white'}},
            {op:'content',pageId:homeId,targetId:image.id,fields:{assetId:assetIds[0],alt:'New approved photo',focalX:25,focalY:70,fit:'cover',aspectRatio:'4:3'}},
            {op:'content',pageId:homeId,targetId:testimonials.id,fields:{assetId:assetIds[1],focalX:40,overlay:.3}},
            ...['left','center','right'].map(textAlign=>({op:'style',pageId:homeId,targetId:testimonials.id,scope:'instance',breakpoint:'mobile',state:'normal',fields:{textAlign}})),
        ];
        const args={expectedRevision:tree.revision,operations,idempotencyKey:uid()};prepared=await okay('editor_prepare_changes',args);assert.deepEqual(await okay('editor_prepare_changes',args),prepared);
        assert.equal((await okay('editor_get_page',{pageId:homeId})).nodes.find(n=>n.id===heading.id).tag,'h1');
        preview=await okay('editor_preview_changes',{changeSetId:prepared.changeSetId});assert.ok(preview.issues.some(i=>i.code==='HEADING_H1'));
        const rendered=await fetch(origin+preview.previewPages.find(p=>p.id===homeId).url,{headers:{Authorization:'Bearer '+token}});assert.equal(rendered.status,200);const html=await rendered.text(),$=load(html);
        assert.equal($(`[data-editor-id="${originalHeading}"]`)[0].tagName,'h3');assert.equal($(`[data-editor-id="${originalHeading}"]`).attr('data-editor-heading-style'),'h1');
        assert.equal($('main > section').eq(-2).attr('data-editor-id'),testimonials.id);
        assert.match(html,/@media\(max-width:767px\)/);assert.match(html,/:focus-visible/);assert.match(html,/text-align:right/);
        assert.equal($(`[data-editor-id="${image.id}"]`).attr('alt'),'New approved photo');assert.match($(`[data-editor-id="${image.id}"]`).attr('style'),/aspect-ratio:\s*4\/3/);
        assert.equal($('form').attr('action'),load(home)('form').attr('action'));
        assert.equal((await fetch(origin+preview.previewPages[0].url)).status,401);
        assert.equal((await fetch(origin+preview.previewPages[0].url,{headers:{Authorization:'Bearer '+bobToken}})).status,403);
        applied=await okay('editor_apply_draft',{changeSetId:prepared.changeSetId,expectedRevision:tree.revision,idempotencyKey:uid()});
        assert.ok((await call('editor_publish_changes',{changeSetId:prepared.changeSetId,expectedRevision:applied.revision,reviewDigest:preview.reviewDigest,confirm:true,idempotencyKey:uid()})).error);
        preview=await okay('editor_preview_changes',{changeSetId:prepared.changeSetId});
        const publishArgs={changeSetId:prepared.changeSetId,expectedRevision:applied.revision,reviewDigest:preview.reviewDigest,confirm:true,idempotencyKey:uid()};const published=await okay('editor_publish_changes',publishArgs);assert.equal(published.published,true);assert.deepEqual(await okay('editor_publish_changes',publishArgs),published);
    });
    await t.test('stale writes, malicious input and contrast fail safely',async()=>{
        assert.equal((await call('editor_prepare_changes',{expectedRevision:1,operations:[{op:'seo',pageId:homeId,fields:{title:'Wrong'}}],idempotencyKey:uid()})).error.code,'STALE_REVISION');
        const current=(await okay('editor_list_pages')).revision;
        assert.ok((await call('editor_prepare_changes',{expectedRevision:current,operations:[{op:'content',pageId:homeId,targetId:button.id,fields:{href:'javascript:alert(1)'}}],idempotencyKey:uid()})).error);
        assert.ok((await call('editor_prepare_changes',{expectedRevision:current,operations:[{op:'style',pageId:homeId,targetId:button.id,scope:'instance',breakpoint:'all',state:'normal',fields:{position:'fixed'}}],idempotencyKey:uid()})).error);
        assert.equal((await call('editor_prepare_changes',{expectedRevision:current,operations:[{op:'style',pageId:homeId,targetId:testimonials.id,scope:'instance',breakpoint:'all',state:'normal',fields:{layoutVariant:'two-column'}}],idempotencyKey:uid()})).error.code,'AGENCY_REQUIRED');
        const low=await okay('editor_prepare_changes',{expectedRevision:current,operations:[{op:'style',pageId:homeId,targetId:button.id,scope:'shared',breakpoint:'all',state:'normal',fields:{color:'white',backgroundColor:'white'}}],idempotencyKey:uid()});assert.ok(low.issues.some(i=>i.code==='LOW_CONTRAST'&&i.severity==='error'));
    });
    await t.test('atomic failures, permissions, approved additions and each alignment value',async()=>{
        const current=(await okay('editor_list_pages')).revision;
        const before=(await okay('editor_get_page',{pageId:homeId})).nodes.find(n=>n.id===heading.id).text;
        const failed=await call('editor_prepare_changes',{expectedRevision:current,idempotencyKey:uid(),operations:[{op:'content',pageId:homeId,targetId:heading.id,fields:{text:'Must not persist'}},{op:'content',pageId:homeId,targetId:'missing',fields:{text:'Fail'}}]});assert.ok(failed.error);
        assert.equal((await okay('editor_get_page',{pageId:homeId})).nodes.find(n=>n.id===heading.id).text,before);
        const denied=await fetch(origin+'/api/editor/call',{method:'POST',headers:{Authorization:'Bearer '+viewToken,'Content-Type':'application/json'},body:JSON.stringify({tool:'editor_prepare_changes',input:{expectedRevision:current,operations:[{op:'seo',pageId:homeId,fields:{title:'Denied'}}],idempotencyKey:uid()}})});assert.equal(denied.status,403);
        for(const alignment of ['left','center','right']) {
            const prepared=await okay('editor_prepare_changes',{expectedRevision:current,idempotencyKey:uid(),operations:[{op:'style',pageId:homeId,targetId:testimonials.id,scope:'instance',breakpoint:'mobile',state:'normal',fields:{textAlign:alignment}}]});
            const review=await okay('editor_preview_changes',{changeSetId:prepared.changeSetId});const html=await (await fetch(origin+review.previewPages.find(p=>p.id===homeId).url,{headers:{Authorization:'Bearer '+token}})).text();assert.ok(html.includes(`text-align:${alignment}!important`));assert.ok(html.includes('@media(max-width:767px)'));
        }
        const additions=await okay('editor_prepare_changes',{expectedRevision:current,idempotencyKey:uid(),operations:[{op:'section',pageId:homeId,action:'add',template:'faq',position:{fromBottom:1}},{op:'page_create',title:'New draft service',slug:'draft-service',template:'text'}]});
        const review=await okay('editor_preview_changes',{changeSetId:additions.changeSetId});assert.ok(review.changes.some(p=>p.after.path==='/draft-service/'&&p.after.state==='draft'));
        const ids=review.changes.find(p=>p.pageId===homeId).after.nodes.map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
        const shared=(await okay('editor_get_page',{pageId:homeId})).nodes.find(n=>n.region==='footer'&&n.type==='link'&&n.sharedKey&&n.text);
        const sharedEdit=await okay('editor_prepare_changes',{expectedRevision:current,idempotencyKey:uid(),operations:[{op:'content',pageId:homeId,targetId:shared.id,scope:'shared',fields:{text:'Review shared link'}}]});assert.ok(sharedEdit.affectedPages.length>=2);
        const sharedPreview=await okay('editor_preview_changes',{changeSetId:sharedEdit.changeSetId});assert.ok(sharedPreview.changes.every(p=>p.after.nodes.some(n=>n.text==='Review shared link')));
        const key=uid(),args={expectedRevision:current,idempotencyKey:key,operations:[{op:'seo',pageId:homeId,fields:{title:'One'}}]};await okay('editor_prepare_changes',args);assert.equal((await call('editor_prepare_changes',{...args,operations:[{op:'seo',pageId:homeId,fields:{title:'Two'}}]})).error.code,'IDEMPOTENCY_CONFLICT');
    });
    let postId;
    await t.test('blog draft, three images, ordered blocks, publication, listing and sitemap',async()=>{
        const current=(await okay('editor_list_pages')).revision;
        const result=await okay('editor_prepare_changes',{expectedRevision:current,idempotencyKey:uid(),operations:[{op:'blog_create',fields:{title:'A private test post',slug:'editor-test-post',author:'Test author',excerpt:'Preview-only acceptance test.',featuredAssetId:assetIds[0],featuredAlt:'Featured test image',blocks:[{type:'heading',text:'First section'},{type:'image',assetId:assetIds[1],alt:'Second test image'},{type:'paragraph',text:'Body paragraph'},{type:'image',assetId:assetIds[2],alt:'Third test image'}]}}]});
        const saved=await okay('editor_apply_draft',{changeSetId:result.changeSetId,expectedRevision:current,idempotencyKey:uid()});
        postId=(await okay('editor_list_pages')).pages.find(p=>p.path==='/editor-test-post/').id;
        assert.equal((await fetch(origin+'/editor/alpha/live/editor-test-post/',{headers:{Authorization:'Bearer '+token}})).status,404);
        const p=await okay('editor_get_page',{pageId:postId});
        const move=await okay('editor_prepare_changes',{expectedRevision:saved.revision,idempotencyKey:uid(),operations:[{op:'move',pageId:postId,targetId:p.post.blocks[3].id,position:{after:p.post.blocks[0].id}},{op:'page_state',pageId:postId,state:'published'}]});
        const next=await okay('editor_apply_draft',{changeSetId:move.changeSetId,expectedRevision:saved.revision,idempotencyKey:uid()});
        const review=await okay('editor_preview_changes',{changeSetId:move.changeSetId});
        const html=await (await fetch(origin+review.previewPages.find(p=>p.id===postId).url,{headers:{Authorization:'Bearer '+token}})).text();
        assert.ok(html.indexOf('Third test image')<html.indexOf('Second test image'));
        await okay('editor_publish_changes',{changeSetId:move.changeSetId,expectedRevision:next.revision,reviewDigest:review.reviewDigest,confirm:true,idempotencyKey:uid()});
        for(const url of ['/editor/alpha/live/editor-test-post/','/editor/alpha/live/blog/','/editor/alpha/live/sitemap.xml']){const r=await fetch(origin+url,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200,url);assert.match(await r.text(),/editor-test-post|A private test post/);}
    });
    await t.test('recoverable section deletion, slug redirects, restoration and conflict rejection',async()=>{
        const current=(await okay('editor_list_pages')).revision;
        const edit=await okay('editor_prepare_changes',{expectedRevision:current,idempotencyKey:uid(),operations:[{op:'section',pageId:homeId,action:'duplicate',targetId:testimonials.id,position:{index:2}},{op:'section',pageId:homeId,action:'remove',targetId:testimonials.id},{op:'slug',pageId:postId,slug:'renamed-test-post'}]});
        const save=await okay('editor_apply_draft',{changeSetId:edit.changeSetId,expectedRevision:current,idempotencyKey:uid()});
        const page=await okay('editor_get_page',{pageId:homeId});assert.equal(new Set(page.nodes.map(n=>n.id)).size,page.nodes.length);assert.ok(page.nodes.find(n=>n.id===testimonials.id).hidden);
        const review=await okay('editor_preview_changes',{changeSetId:edit.changeSetId});await okay('editor_publish_changes',{changeSetId:edit.changeSetId,expectedRevision:save.revision,reviewDigest:review.reviewDigest,confirm:true,idempotencyKey:uid()});
        const redirect=await fetch(origin+'/editor/alpha/live/editor-test-post/',{headers:{Authorization:'Bearer '+token},redirect:'manual'});assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'/editor/alpha/live/renamed-test-post/');
        const restored=await okay('editor_restore_revision',{revision:current,expectedRevision:save.revision,idempotencyKey:uid()});
        await okay('editor_apply_draft',{changeSetId:restored.changeSetId,expectedRevision:save.revision,idempotencyKey:uid()});
        assert.equal((await okay('editor_get_page',{pageId:homeId})).nodes.find(n=>n.id===testimonials.id).hidden,false);
        assert.equal((await call('editor_restore_revision',{revision:1,expectedRevision:save.revision,idempotencyKey:uid()})).error.code,'STALE_REVISION');
        const history=await okay('editor_list_revisions');assert.ok(history.revisions.length>5);assert.ok(history.publications.length>=3);
        assert.equal(fs.readFileSync('index.html','utf8'),home,'No source or production HTML changed');
    });
    await t.test('public release adapter exposes only published pages and referenced media',async()=>{
        store.publicSite='alpha';
        try {
            assert.equal((await fetch(origin+'/')).status,404,'Changing configuration cannot expose a staging-only release');
            const current=(await okay('editor_list_pages')).revision;
            const change=await okay('editor_prepare_changes',{expectedRevision:current,operations:[{op:'slug',pageId:postId,slug:'renamed-test-post'}],idempotencyKey:uid()});
            const saved=await okay('editor_apply_draft',{changeSetId:change.changeSetId,expectedRevision:current,idempotencyKey:uid()});
            const reviewed=await okay('editor_preview_changes',{changeSetId:change.changeSetId});
            await okay('editor_publish_changes',{changeSetId:change.changeSetId,expectedRevision:saved.revision,reviewDigest:reviewed.reviewDigest,confirm:true,idempotencyKey:uid()});
            const response=await fetch(origin+'/');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-robots-tag'),null);
            const html=await response.text();assert.match(html,/Your website|A website you can make your own/);assert.match(html,/site-nav\.js/);assert.match(html,/action="\/api\/contact"/);
            const asset=await fetch(origin+`/editor-assets/alpha/${assetIds[0]}.webp`);assert.equal(asset.status,200);
            const sitemap=await fetch(origin+'/sitemap.xml');assert.equal(sitemap.status,200);assert.match(await sitemap.text(),/renamed-test-post/);
            const redirect=await fetch(origin+'/editor-test-post/',{redirect:'manual'});assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'/renamed-test-post/');
            assert.equal((await fetch(origin+'/editor/alpha/live/')).status,401,'Private preview remains private even when public serving is enabled');
            assert.equal((await fetch(origin+'/editor-assets/beta/'+assetIds[0]+'.webp')).status,401);
        } finally {store.publicSite='';}
    });
});
