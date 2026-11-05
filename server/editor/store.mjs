import {migrateSchedules,scheduleAction,runDueSchedules} from './scheduling.mjs';
import {assertPublicRoute} from './routes.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { load } from 'cheerio';
import { z } from 'zod';
import { registry, groups, tokens, fonts, operationSchema, fail, uid } from './schema.mjs';
import { tagDocument, structure, findContent, applyOperation, renderPage, validateSnapshot, templates, esc } from './document.mjs';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value);
const parse = value => JSON.parse(value);
const rolePermissions = { viewer:['read'], editor:['read','edit'], publisher:['read','edit','publish'] };
export class EditorStore {
    constructor(root) {
        this.publicSite=process.env.WEBSITE_EDITOR_PUBLIC_SITE||'';
        this.root=path.resolve(root);fs.mkdirSync(this.root,{recursive:true,mode:0o700});
        this.db=new DatabaseSync(path.join(this.root,'editor.sqlite'));
        this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL, snapshot TEXT NOT NULL, release TEXT, source_root TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS grants (subject TEXT NOT NULL, site TEXT NOT NULL REFERENCES sites(id), role TEXT NOT NULL, PRIMARY KEY(subject,site));
        CREATE TABLE IF NOT EXISTS credentials (hash TEXT PRIMARY KEY, subject TEXT NOT NULL, site TEXT NOT NULL REFERENCES sites(id), expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS revisions (site TEXT NOT NULL REFERENCES sites(id), revision INTEGER NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, action TEXT NOT NULL, snapshot TEXT NOT NULL, details TEXT NOT NULL, PRIMARY KEY(site,revision));
        CREATE TABLE IF NOT EXISTS changesets (id TEXT PRIMARY KEY, site TEXT NOT NULL REFERENCES sites(id), base INTEGER NOT NULL, saved INTEGER, actor TEXT NOT NULL, snapshot TEXT NOT NULL, details TEXT NOT NULL, digest TEXT NOT NULL, reviewed_by TEXT, reviewed_revision INTEGER, published INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS idempotency (site TEXT NOT NULL, actor TEXT NOT NULL, key TEXT NOT NULL, input_hash TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(site,actor,key));
        CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, site TEXT NOT NULL, revision INTEGER NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, previous_release TEXT);
        PRAGMA user_version=2;`);
        migrateSchedules(this.db);
        this.db.exec(`CREATE TABLE IF NOT EXISTS editor_features(site TEXT PRIMARY KEY, groups_json TEXT NOT NULL);`);
    }
    enabledGroups(site){const row=this.db.prepare('SELECT groups_json FROM editor_features WHERE site=?').get(site);return row?JSON.parse(row.groups_json):groups;}
    assertFeature(actor,group){if(!this.enabledGroups(actor.site).includes(group))throw fail('FEATURE_DISABLED','This feature is not enabled for your site.');}
    runSchedules(now){return runDueSchedules(this,now);}
    close(){this.db.close();}
    transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
    site(site){const row=this.db.prepare('SELECT * FROM sites WHERE id=?').get(site);if(!row)throw fail('SITE_NOT_FOUND','Site is unavailable.');return row;}
    grant(subject,site,role){if(!rolePermissions[role])throw Error('Unknown role');this.db.prepare('INSERT OR REPLACE INTO grants VALUES (?,?,?)').run(subject,site,role);}
    token(subject,site,days=30){this.authorize({subject,site},'read');const token=crypto.randomBytes(32).toString('base64url');this.db.prepare('INSERT INTO credentials VALUES (?,?,?,?)').run(hash(token),subject,site,Date.now()+days*86400000);return token;}
    authenticate(token){if(!token)return null;const row=this.db.prepare('SELECT subject,site,expires FROM credentials WHERE hash=?').get(hash(token));return row&&row.expires>Date.now()?{subject:row.subject,site:row.site}:null;}
    authorize(actor,permission){const row=actor?.subject&&this.db.prepare('SELECT role FROM grants WHERE subject=? AND site=?').get(actor.subject,actor.site);if(!row||!rolePermissions[row.role]?.includes(permission)||(actor.permissions&&!actor.permissions.includes(permission)))throw fail('FORBIDDEN','Your account cannot perform this operation for this site.');return row.role;}
    memberships(subject){return this.db.prepare('SELECT site,role FROM grants WHERE subject=?').all(subject);}
    bootstrap({site,name,origin,sourceRoot,pages,assets=[],palette={}}) {
        if(this.db.prepare('SELECT 1 FROM sites WHERE id=?').get(site))return {alreadyExists:true};
        for(const [key,value] of Object.entries(palette))if(!(key in tokens)||!/^#[a-f0-9]{6}$/i.test(value))throw fail('INVALID_PALETTE','Agency palette must use named token slots and exact hex colours.');
        const snapshot={version:1,origin,timeZone:'America/Toronto',theme:{tokens:{...tokens,...palette},fonts},pages:pages.map(p=>({...p,id:p.id||uid(),styles:{},state:'published',html:tagDocument(p.html,p.path)})),assets,redirects:{},sharedStyles:{}};
        this.transaction(()=>{this.db.prepare('INSERT INTO sites VALUES (?,?,?,?,?,?)').run(site,name,1,json(snapshot),null,path.resolve(sourceRoot));this.db.prepare('INSERT INTO revisions VALUES (?,?,?,?,?,?,?)').run(site,1,'agency-import',new Date().toISOString(),'import',json(snapshot),json({pageCount:pages.length}));});
        return {site,revision:1,pageCount:pages.length};
    }
    revision(actor,snapshot,action,details) {
        const current=this.site(actor.site),next=current.revision+1;
        this.db.prepare('UPDATE sites SET revision=?,snapshot=? WHERE id=?').run(next,json(snapshot),actor.site);
        this.db.prepare('INSERT INTO revisions VALUES (?,?,?,?,?,?,?)').run(actor.site,next,actor.subject,new Date().toISOString(),action,json(snapshot),json(details));return next;
    }
    checkRevision(site,expected){const actual=this.site(site).revision;if(actual!==expected)throw fail('STALE_REVISION','The site changed. Read it again and prepare a fresh preview.',{expected,actual});}
    idempotent(actor,name,input,fn) {
        const key=input.idempotencyKey,signature=hash(json({name,input}));
        return this.transaction(()=>{
            const old=this.db.prepare('SELECT * FROM idempotency WHERE site=? AND actor=? AND key=?').get(actor.site,actor.subject,key);
            if(old){if(old.input_hash!==signature)throw fail('IDEMPOTENCY_CONFLICT','This key was already used for different input.');return parse(old.result);}
            const result=fn();this.db.prepare('INSERT INTO idempotency VALUES (?,?,?,?,?)').run(actor.site,actor.subject,key,signature,json(result));return result;
        });
    }
    change(actor,id){const row=this.db.prepare('SELECT * FROM changesets WHERE id=? AND site=?').get(id,actor.site);if(!row)throw fail('CHANGESET_NOT_FOUND','Change set is unavailable.');return row;}
    prepare(actor,input,restore) {
        this.checkRevision(actor.site,input.expectedRevision);
        const before=parse(this.site(actor.site).snapshot),snapshot=restore||structuredClone(before);
        if(!restore)for(const operation of input.operations){for(const group of operationGroups(operation))this.assertFeature(actor,group);applyOperation(snapshot,operation);}
        const issues=validateSnapshot(snapshot),details={publicationEnvironment:this.publicSite===actor.site?'production':'private-staging',operations:input.operations||[{op:'restore',revision:input.revision}],issues,changes:[]};
        for(const page of snapshot.pages){const old=before.pages.find(p=>p.id===page.id);if(json(old)!==json(page))details.changes.push({pageId:page.id,path:page.path,before:old?structure(old):null,after:structure(page)});}
        if(json(before.sharedStyles)!==json(snapshot.sharedStyles)){details.sharedStyles={before:before.sharedStyles,after:snapshot.sharedStyles};details.affectedPages=snapshot.pages.map(p=>({id:p.id,path:p.path}));}
        const changeSetId=uid(),digest=hash(json({snapshot,base:input.expectedRevision,details}));
        this.db.prepare('INSERT INTO changesets (id,site,base,actor,snapshot,details,digest) VALUES (?,?,?,?,?,?,?)').run(changeSetId,actor.site,input.expectedRevision,actor.subject,json(snapshot),json(details),digest);
        return {changeSetId,baseRevision:input.expectedRevision,issues,affectedPages:details.affectedPages||details.changes.map(p=>({id:p.pageId,path:p.path})),next:'Call editor_preview_changes to inspect the exact draft and diff.'};
    }
    capabilities(actor) {
        const grantedRole=this.authorize(actor,'read'),role=actor.permissions&&!actor.permissions.includes('edit')?'viewer':actor.permissions&&!actor.permissions.includes('publish')&&grantedRole==='publisher'?'editor':grantedRole;
        return {site:actor.site,role,revision:this.site(actor.site).revision,timeZone:'America/Toronto',groups:this.enabledGroups(actor.site).filter(g=>role!=='viewer'||['Text and headings','Page sections','Images and backgrounds','Preview and publish','History and undo','Blog posts'].includes(g)),
            tools:registry.filter(r=>rolePermissions[role].includes(r[1])&&(!actor.permissions||actor.permissions.includes(r[1]))&&this.enabledGroups(actor.site).includes(r[2])).map(([name,permission,group,example])=>({name,permission,group,example})),
            operations:rolePermissions[role].includes('edit')&&(!actor.permissions||actor.permissions.includes('edit'))?operationSchema.options.map(s=>s.shape.op.value).filter(op=>operationGroups({op}).every(g=>this.enabledGroups(actor.site).includes(g))):[],
            controls:{...(parse(this.site(actor.site).snapshot).theme||{tokens,fonts}),templates:Object.keys(templates),breakpoints:{mobile:'up to 767px',desktop:'768px and up'},states:['normal','hover','focus'],styleScope:['instance','shared'],richText:['text','bold','italic','href']},
            publicationEnvironment:this.publicSite===actor.site?'production':'private-staging',
            restrictions:['Choose an exact target ID after inspection; ambiguous references return candidates.','Shared styling affects all matching component types on this site and requires explicit shared scope.','Forms, scripts, navigation mechanics, templates, integrations, and arbitrary HTML/CSS/JS are agency-only.','Schedules use America/Toronto with an explicit valid DST offset. Past displayed dates only change presentation; past schedule times are rejected. Edited scheduled posts require a fresh review.','Publishing requires a saved draft, a current reviewed digest and publish permission.',this.publicSite===actor.site?'Publishing updates the configured public site.':'This instance publishes immutable private staging releases; production activation is agency-only.'],
            lifecycle:['prepare (no draft or live mutation)','preview exact change set','apply draft with revision check','preview saved revision','publish exact reviewed digest into private staging','restore a historical snapshot as a new reviewed draft'],
        };
    }
    async invoke(actor,name,input={}) {
        const entry=registry.find(r=>r[0]===name);if(!entry)throw fail('UNKNOWN_TOOL','Unknown website editor action.');
        this.authorize(actor,entry[1]);this.assertFeature(actor,entry[2]);const args=z.object(entry[4]).strict().parse(input);
        if(name==='editor_ingest_asset')return this.ingest(actor,args);
        const run=()=>this.dispatch(actor,name,args);
        return args.idempotencyKey?this.idempotent(actor,name,args,run):run();
    }
    dispatch(actor,name,args) {
        const row=this.site(actor.site),snapshot=parse(row.snapshot);
        if(['editor_list_schedules','editor_schedule_post','editor_cancel_schedule'].includes(name))return scheduleAction(this,actor,name,args);
        const getPage=()=>{const p=snapshot.pages.find(p=>p.id===args.pageId);if(!p)throw fail('PAGE_NOT_FOUND','Page does not belong to this site.');return p;};
        if(name==='editor_capabilities')return this.capabilities(actor);
        if(name==='editor_list_pages') {
            const released=row.release?parse(fs.readFileSync(path.join(this.root,'releases',actor.site,row.release,'snapshot.json'),'utf8')):null;
            const publication=row.release?this.db.prepare('SELECT revision FROM publications WHERE id=?').get(row.release):null;
            return {revision:row.revision,publishedRevision:publication?.revision||null,publicationEnvironment:this.publicSite===actor.site?'production':'private-staging',pages:snapshot.pages.map(page=>{
                const {html,styles,backgrounds,...p}=page;return {...p,post:undefined,hasUnpublishedChanges:json(page)!==json(released?.pages.find(x=>x.id===page.id))};
            })};
        }
        if(name==='editor_get_page')return {revision:row.revision,...structure(getPage())};
        if(name==='editor_find_content')return {revision:row.revision,...findContent(getPage(),args)};
        if(name==='editor_inspect_target') {const tree=structure(getPage()),index=tree.nodes.findIndex(n=>n.id===args.targetId);if(index<0)throw fail('TARGET_NOT_FOUND','Inspect the current page.');return {revision:row.revision,target:tree.nodes[index],context:tree.nodes.slice(Math.max(0,index-2),index+3),permissions:this.capabilities(actor).operations};}
        if(name==='editor_list_assets')return {assets:snapshot.assets.filter(a=>(a.name+' '+a.alt).toLowerCase().includes(args.query.toLowerCase()))};
        if(name==='editor_prepare_changes')return this.prepare(actor,args);
        if(name==='editor_restore_revision') {const old=this.db.prepare('SELECT snapshot FROM revisions WHERE site=? AND revision=?').get(actor.site,args.revision);if(!old)throw fail('REVISION_NOT_FOUND','Revision is unavailable.');const restored=parse(old.snapshot);restored.assets=[...new Map([...snapshot.assets,...restored.assets].map(a=>[a.id,a])).values()];return this.prepare(actor,args,restored);}
        if(name==='editor_list_revisions')return {currentRevision:row.revision,revisions:this.db.prepare('SELECT revision,actor,at,action,details FROM revisions WHERE site=? ORDER BY revision DESC LIMIT 100').all(actor.site).map(r=>({...r,details:parse(r.details)})),publications:this.db.prepare('SELECT id,revision,actor,at FROM publications WHERE site=? ORDER BY at DESC LIMIT 100').all(actor.site)};
        const change=this.change(actor,args.changeSetId);
        if(name==='editor_preview_changes') {
            this.checkRevision(actor.site,change.saved||change.base);
            this.db.prepare('UPDATE changesets SET reviewed_by=?,reviewed_revision=? WHERE id=?').run(actor.subject,row.revision,change.id);
            return {changeSetId:change.id,revision:row.revision,reviewDigest:change.digest,...parse(change.details),previewPages:parse(change.snapshot).pages.filter(p=>p.state!=='deleted').map(p=>({id:p.id,path:p.path,url:`/editor/${actor.site}/preview/${change.id}${p.path}`}))};
        }
        if(name==='editor_apply_draft') {
            this.checkRevision(actor.site,args.expectedRevision);
            if(change.saved)throw fail('ALREADY_APPLIED','This draft is already saved.');
            if(change.base!==args.expectedRevision)throw fail('STALE_REVISION','Prepare against the current revision.');
            const revision=this.revision(actor,parse(change.snapshot),'draft',parse(change.details));
            this.db.prepare('UPDATE changesets SET saved=?,reviewed_by=NULL,reviewed_revision=NULL WHERE id=?').run(revision,change.id);
            return {revision,changeSetId:change.id,state:'draft',next:'Preview the saved revision before publishing.'};
        }
        if(name==='editor_publish_changes') {
            this.checkRevision(actor.site,args.expectedRevision);
            if(parse(change.details).publicationEnvironment!==(this.publicSite===actor.site?'production':'private-staging'))throw fail('REVIEW_REQUIRED','The publication environment changed. Prepare and review a new change set.');
            if(change.published)throw fail('ALREADY_PUBLISHED','This change set has already been published.');
            if(change.saved!==row.revision||change.reviewed_revision!==row.revision||change.reviewed_by!==actor.subject||change.digest!==args.reviewDigest)throw fail('REVIEW_REQUIRED','Preview this saved revision with the publishing account and use its exact digest.');
            if(parse(change.details).issues.some(i=>i.severity==='error'))throw fail('VALIDATION_FAILED','Fix blocking preview issues before publication.',{issues:parse(change.details).issues});
            const release=this.buildRelease(actor.site,parse(change.snapshot));
            for(const p of parse(change.details).changes)this.db.prepare("UPDATE editor_schedules SET state='cancelled' WHERE site=? AND page_id=? AND state='pending'").run(actor.site,p.pageId);
            for(const p of parse(change.snapshot).pages.filter(p=>p.state==='published'||p.state==='deleted'))this.db.prepare("UPDATE editor_schedules SET state='cancelled' WHERE site=? AND page_id=? AND state='pending'").run(actor.site,p.id);
            this.db.prepare('UPDATE sites SET release=? WHERE id=?').run(release,actor.site);
            this.db.prepare('UPDATE changesets SET published=1 WHERE id=?').run(change.id);
            this.db.prepare('INSERT INTO publications VALUES (?,?,?,?,?,?)').run(release,actor.site,row.revision,actor.subject,new Date().toISOString(),row.release||null);
            return {published:true,environment:this.publicSite===actor.site?'production':'private-staging',revision:row.revision,release,url:this.publicSite===actor.site?snapshot.origin+'/':`/editor/${actor.site}/live/`,rollback:'Restore a revision, review, and publish; previous release retained.'};
        }
        throw fail('UNKNOWN_TOOL','Unknown operation.');
    }
    async ingest(actor,args) {
        const raw=Buffer.from(args.base64,'base64');
        if(raw.length===0||raw.length>5*1024*1024||raw.toString('base64')!==args.base64)throw fail('INVALID_ASSET','Upload a base64 PNG, JPEG or WebP image, at most 5 MB.');
        let meta,normalized;
        try {meta=await sharp(raw,{limitInputPixels:40000000}).metadata();if(!['jpeg','png','webp'].includes(meta.format))throw Error();normalized=await sharp(raw,{limitInputPixels:40000000}).rotate().webp({quality:90}).toBuffer({resolveWithObject:true});}catch{throw fail('INVALID_ASSET','Image could not be decoded safely. SVG, HTML and other executable formats are not allowed.');}
        this.authorize(actor,'edit');
        return this.idempotent(actor,'editor_ingest_asset',args,()=>{
            const snapshot=parse(this.site(actor.site).snapshot),assetId=hash(normalized.data),filename=assetId+'.webp';
            const existing=snapshot.assets.find(a=>a.id===assetId);if(existing)return {asset:existing,revision:this.site(actor.site).revision};
            const dir=path.join(this.root,'assets',actor.site);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,filename),normalized.data,{mode:0o600});
            const a={id:assetId,name:path.basename(args.filename).replace(/[^a-zA-Z0-9 ._-]/g,'_'),alt:args.alt,url:`/editor-assets/${actor.site}/${filename}`,width:normalized.info.width,height:normalized.info.height,type:'image/webp',bytes:normalized.data.length};
            snapshot.assets.push(a);const revision=this.revision(actor,snapshot,'asset-ingest',{assetId});return {asset:a,revision};
        });
    }
    buildRelease(site,snapshot) {
        for(const page of snapshot.pages)assertPublicRoute(page.path);
        const release=uid(),dir=path.join(this.root,'releases',site,release);fs.mkdirSync(dir,{recursive:true});
        const visible=snapshot.pages.filter(p=>p.state==='published');
        const publicAssets=new Set(),publicCss=new Set(),publicMedia=new Set();
        for(const page of visible) {
            let html=renderPage(page,snapshot);
            for(const match of html.matchAll(/\/assets\/(?:images|fonts)\/[a-zA-Z0-9_./%-]+\.(?:webp|png|jpe?g|svg|woff2?|gif)/g))publicMedia.add(match[0]);
            const doc=load(html);doc('link[rel=stylesheet][href]').each((_,el)=>{const href=doc(el).attr('href').split('?')[0];if(/^\/css\/[\w/-]+\.css$/.test(href))publicCss.add(href);});
            if(/^\/blog\/(?:page\/\d+\/)?$/.test(page.path)) {
                const $=load(html);
                const posts=visible.filter(p=>p.post).sort((a,b)=>(b.displayDate||'').localeCompare(a.displayDate||''));
                const list=$('.blog-grid').first().length?$('.blog-grid').first():$('main .container').first();
                for(const p of posts)list.find('a[href]').filter((_,el)=>$(el).attr('href')===p.path).closest('.blog-card').remove();
                if(page.path==='/blog/')list.prepend(posts.map(p=>`<article class="blog-card"><h2><a href="${esc(p.path)}">${esc(p.title)}</a></h2><p>${esc(p.post.excerpt)}</p><p>${esc(p.post.author)}</p>${p.displayDate?`<time datetime="${esc(p.displayDate)}">${esc(p.displayDate)}</time>`:''}</article>`).join(''));
                const hidden=new Set(snapshot.pages.filter(p=>p.state!=='published').map(p=>p.path));
                $('a[href]').each((_,el)=>{if(hidden.has($(el).attr('href')))$(el).closest('.blog-card').remove();});html=$.html();
            }
            const target=path.join(dir,page.path,'index.html');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,html);
            for(const a of snapshot.assets)if(a.url.startsWith(`/editor-assets/${site}/`)&&html.includes(a.url))publicAssets.add(a.id);
        }
        const sourceRoot=this.site(site).source_root,oldSitemap=path.join(sourceRoot,'sitemap.xml'),managed=new Set([...snapshot.pages.map(p=>p.path),...Object.keys(snapshot.redirects)]);
        let preserved=[];if(fs.existsSync(oldSitemap)){const $=load(fs.readFileSync(oldSitemap,'utf8'),{xml:true});preserved=$('url').toArray().filter(el=>{try{return !managed.has(new URL($(el).find('loc').text()).pathname);}catch{return false;}}).map(el=>$.xml(el));}
        fs.writeFileSync(path.join(dir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${preserved.join('')}${visible.map(p=>`<url><loc>${esc(snapshot.origin+p.path)}</loc></url>`).join('')}</urlset>`);
        if(fs.existsSync(path.join(sourceRoot,'css')))fs.cpSync(path.join(sourceRoot,'css'),path.join(dir,'css'),{recursive:true});
        for(const css of publicCss){const file=path.join(sourceRoot,css);if(fs.existsSync(file))for(const match of fs.readFileSync(file,'utf8').matchAll(/@import\s+(?:url\()?['"](\/css\/[\w/-]+\.css)['"]/g))publicCss.add(match[1]);}
        fs.writeFileSync(path.join(dir,'public-css.json'),json([...publicCss]));
        for(const css of publicCss){const file=path.join(sourceRoot,css);if(fs.existsSync(file))for(const match of fs.readFileSync(file,'utf8').matchAll(/\/assets\/(?:images|fonts)\/[a-zA-Z0-9_./%-]+\.(?:webp|png|jpe?g|svg|woff2?|gif)/g))publicMedia.add(match[0]);}
        for(const media of publicMedia){const file=path.resolve(sourceRoot,'.'+media);if(!file.startsWith(path.resolve(sourceRoot)+path.sep)||!fs.existsSync(file))continue;const target=path.join(dir,media);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
        fs.writeFileSync(path.join(dir,'public-media.json'),json([...publicMedia]));
        fs.writeFileSync(path.join(dir,'redirects.json'),json(snapshot.redirects));
        fs.writeFileSync(path.join(dir,'snapshot.json'),json(snapshot));
        fs.writeFileSync(path.join(dir,'public-assets.json'),json([...publicAssets]));
        fs.writeFileSync(path.join(dir,'environment.json'),json({environment:this.publicSite===site?'production':'private-staging'}));
        // Publication pointer changes only after all artifacts have been written and verified.
        for(const p of visible)if(!fs.readFileSync(path.join(dir,p.path,'index.html'),'utf8').includes('<main'))throw fail('BUILD_FAILED','A rendered page is incomplete.');
        return release;
    }
}

function operationGroup(op){return ({content:op.fields?.assetId?'Images and backgrounds':op.fields?.href?'Buttons and links':'Text and headings',style:op.fields?.textAlign||op.fields?.padding||op.fields?.gap||op.fields?.contentAlign?'Alignment and spacing':'Colours and typography',move:'Page sections',section:'Page sections',page_create:'Page sections',blog_create:'Blog posts',blog_update:'Blog posts',publication_date:'Blog posts',page_state:'Preview and publish',slug:'SEO',seo:'SEO'})[op.op]||'Preview and publish';}
function operationGroups(op){const result=new Set([operationGroup(op)]),f=op.fields||{};if(op.op==='content'){if(['text','richText','items','level'].some(k=>k in f))result.add('Text and headings');if(['href','newTab','label'].some(k=>k in f))result.add('Buttons and links');if(['assetId','alt','decorative','caption','fit','aspectRatio','focalX','focalY','overlay'].some(k=>k in f))result.add('Images and backgrounds');}if(op.op==='style'){if(['textAlign','contentAlign','padding','gap'].some(k=>k in f))result.add('Alignment and spacing');if(['color','backgroundColor','borderColor','fontFamily','fontSize','fontWeight','lineHeight','borderRadius','borderWidth'].some(k=>k in f))result.add('Colours and typography');}return [...result];}
