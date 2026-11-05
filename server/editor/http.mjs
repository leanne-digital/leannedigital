import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { load } from 'cheerio';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { EditorStore } from './store.mjs';
import { createEditorMcp } from './tools.mjs';
import { renderPage, esc } from './document.mjs';
import { fail } from './schema.mjs';
import {handleEditorOAuth,authenticateEditorOAuth,editorOAuthConfig} from './oauth.mjs';
import {reservedRoute} from './routes.mjs';

let singleton;
const requestLimits=new Map();
function limitRequest(key,max) {
    const now=Date.now();for(const [k,v] of requestLimits)if(v.until<now)requestLimits.delete(k);
    const bucket=requestLimits.get(key)||{count:0,until:now+60000};
    if(bucket.count>=max||requestLimits.size>=5000&&!requestLimits.has(key))throw fail('RATE_LIMITED','Too many requests. Wait one minute and try again.');
    bucket.count++;requestLimits.set(key,bucket);
}
export function configuredEditor(){if(!process.env.WEBSITE_EDITOR_DATA_DIR)return null;return singleton ||= new EditorStore(process.env.WEBSITE_EDITOR_DATA_DIR);}
function output(res,status,value,type='application/json; charset=utf-8',headers={}){if(!type.includes('charset='))type+='; charset=utf-8';res.writeHead(status,{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer',...headers});res.end(typeof value==='string'?value:JSON.stringify(value));}
async function body(req,limit=9*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw fail('TOO_LARGE','Request exceeds upload limit.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
function browserWrite(req){const expected=editorOAuthConfig()?.origin;if(expected?req.headers.origin!==expected:req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)throw fail('FORBIDDEN','Browser origin is not allowed.');}
export function requestActor(store,req){const bearer=String(req.headers.authorization||'').replace(/^Bearer /i,'');const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ld_editor='))?.slice(10);return bearer?(store.authenticate(bearer)||authenticateEditorOAuth(store,bearer)):store.authenticate(cookie);}
const mime={'.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.pdf':'application/pdf'};
function file(res,filename){if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())return output(res,404,{error:'Not found'});const ext=path.extname(filename);if(ext==='.css'){
    // Original heading semantics and typography are independent, even for tag-based incumbent CSS.
    let css=fs.readFileSync(filename,'utf8').replace(/([^{}]+)\{/g,(whole,selector)=>selector.trim().startsWith('@')?whole:selector.replace(/(?<![\w.-])h([1-6])(?=[\s.#:[>+~,]|$)/g,':is(h$1:not([data-editor-heading-style]),[data-editor-heading-style="h$1"])')+'{');return output(res,200,css,'text/css');
}res.writeHead(200,{'Content-Type':(mime[ext]||'application/octet-stream')+(ext==='.js'?'; charset=utf-8':''),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(filename).pipe(res);}
function previewHtml(html,site,prefix) {
    const $=load(html);
    // Navigate within this authenticated preview/release; assets retain original root URLs.
    $('a[href^="/"]').each((_,el)=>{const href=$(el).attr('href');if(!/^\/(assets|editor-assets|api|login|clients|admin)\//.test(href))$(el).attr('href',prefix+href);});
    $('head').append('<meta name="robots" content="noindex,nofollow"><style>body:before{content:"PRIVATE WEBSITE PREVIEW — forms and tracking disabled";display:block;position:relative;z-index:99999;background:#fff;color:#0d0d1b;font:14px system-ui;text-align:center;padding:8px}</style>');
    return $.html();
}
const previewHeaders={'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'"};
function publicRelease(req,res,store,pathname) {
    if(!store.publicSite||!['GET','HEAD'].includes(req.method))return false;
    try{pathname=decodeURIComponent(pathname);}catch{return false;}
    if(pathname.includes('\\')||pathname.split('/').includes('..'))return false;
    const row=store.site(store.publicSite);if(!row.release)return false;
    const dir=path.join(store.root,'releases',store.publicSite,row.release);
    const environmentFile=path.join(dir,'environment.json');
    if(!fs.existsSync(environmentFile)||JSON.parse(fs.readFileSync(environmentFile,'utf8')).environment!=='production')return false;
    const snapshot=JSON.parse(fs.readFileSync(path.join(dir,'snapshot.json'),'utf8'));
    const send=(status,content,type,extra={})=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(req.method==='HEAD'?'':content);};
    let route=pathname.replace(/\/index\.html$/,'/');if(!path.extname(route)&&!route.endsWith('/'))route+='/';
    if(snapshot.redirects[route]){send(301,'','text/plain',{Location:snapshot.redirects[route]});return true;}
    const page=snapshot.pages.find(p=>p.path===route);
    if(page){if(page.state!=='published')send(404,'Page not found','text/plain');else send(200,fs.readFileSync(path.join(dir,page.path,'index.html')),'text/html; charset=utf-8');return true;}
    if(pathname==='/sitemap.xml'){send(200,fs.readFileSync(path.join(dir,'sitemap.xml')),'application/xml; charset=utf-8');return true;}
    const asset=pathname.match(/^\/editor-assets\/([\w-]+)\/([a-f0-9]{64})\.webp$/);
    if(asset){const publishedAssets=JSON.parse(fs.readFileSync(path.join(dir,'public-assets.json'),'utf8'));if(asset[1]!==store.publicSite||!publishedAssets.includes(asset[2]))return false;send(200,fs.readFileSync(path.join(store.root,'assets',store.publicSite,asset[2]+'.webp')),'image/webp');return true;}
    if(/^\/css\/[a-zA-Z0-9/_-]+\.css$/.test(pathname)&&fs.existsSync(path.join(dir,'public-css.json'))&&JSON.parse(fs.readFileSync(path.join(dir,'public-css.json'),'utf8')).includes(pathname)){file(res,path.join(dir,pathname));return true;}
    if(/^\/assets\/(images|fonts)\//.test(pathname)&&fs.existsSync(path.join(dir,'public-media.json'))&&JSON.parse(fs.readFileSync(path.join(dir,'public-media.json'),'utf8')).includes(pathname)&&fs.existsSync(path.join(dir,pathname))){file(res,path.join(dir,pathname));return true;}
    return false;
}
export async function handleEditor(req,res,{store=configuredEditor(),portalUser=null,assets=false}={}) {
    if(!store)return false;
    const url=new URL(req.url,'http://localhost'),pathname=url.pathname;
    const owned=pathname==='/mcp/editor'||pathname.startsWith('/api/editor/')||pathname.startsWith('/editor/')||pathname.startsWith('/editor-assets/')||pathname==='/website-editor/'||['/css/editor-dashboard.css','/js/editor-dashboard.js'].includes(pathname);
    try {
        if(await handleEditorOAuth(req,res,store))return true;
        if(publicRelease(req,res,store,pathname))return true;
        if(!owned&&!assets)return false;
        if(pathname==='/editor/login'&&req.method==='POST') {
            limitRequest('login:'+req.socket.remoteAddress,10);
            browserWrite(req);const input=await body(req,4096),actor=store.authenticate(input.token);
            if(!actor)throw fail('FORBIDDEN','Invalid or expired editor access token.');store.authorize(actor,'read');
            return output(res,200,{ok:true,site:actor.site},undefined,{'Set-Cookie':`ld_editor=${input.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${editorOAuthConfig()?.origin.startsWith('https:')?'; Secure':''}`}),true;
        }
        if(pathname==='/editor/login'&&req.method==='GET')return output(res,200,loginHtml(),'text/html'),true;
        let actor=requestActor(store,req);
        if(!actor&&!req.headers.authorization&&portalUser?.email){const grants=store.memberships(portalUser.email);const requested=url.searchParams.get('site');const grant=requested?grants.find(g=>g.site===requested):grants.length===1?grants[0]:null;if(grant)actor={subject:portalUser.email,site:grant.site};}
        if(!actor){if(!owned)return false;const config=editorOAuthConfig();return output(res,401,{error:'Sign in at /editor/login or use your existing portal session with an agency-issued site grant.'},undefined,config?{'WWW-Authenticate':`Bearer resource_metadata="${config.metadata}"`}:{}),true;}
        store.authorize(actor,'read');
        if(['/css/editor-dashboard.css','/js/editor-dashboard.js'].includes(pathname)){file(res,fileURLToPath(new URL('../..'+pathname,import.meta.url)));return true;}
        if(pathname==='/mcp/editor'||pathname==='/api/editor/call')limitRequest(actor.site+':'+actor.subject,240);
        if(pathname==='/mcp/editor') {
            if(req.method!=='POST')return output(res,405,{error:'POST required'}),true;
            if(!req.headers.authorization)browserWrite(req);
            const input=await body(req),server=createEditorMcp(store,actor),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
            res.on('close',()=>{void transport.close();void server.close();});await server.connect(transport);await transport.handleRequest(req,res,input);return true;
        }
        if(pathname==='/api/editor/call'&&req.method==='POST') {if(!req.headers.authorization)browserWrite(req);const input=await body(req);return output(res,200,await store.invoke(actor,input.tool,input.input||{})),true;}
        if(pathname==='/website-editor/'&&req.method==='GET')return output(res,200,dashboardHtml(actor.site),'text/html'),true;
        const match=pathname.match(/^\/editor\/([\w-]+)\/(preview|live)(?:\/([a-f0-9]{32}))?(\/.*)?$/);
        if(match) {
            if(match[1]!==actor.site)throw fail('FORBIDDEN','This preview belongs to a different site.');
            const row=store.site(actor.site),requested=match[4]||'/';
            if(requested.includes('..')||requested.includes('\\'))throw fail('FORBIDDEN','Invalid path.');
            if(match[2]==='preview') {
                const change=store.change(actor,match[3]),snapshot=JSON.parse(change.snapshot),page=snapshot.pages.find(p=>p.path===requested);
                if(!page||page.state==='deleted')return output(res,404,{error:'Page not found'}),true;
                return output(res,200,previewHtml(renderPage(page,snapshot,{preview:true}),actor.site,`/editor/${actor.site}/preview/${change.id}`),'text/html',previewHeaders),true;
            }
            if(!row.release)return output(res,404,{error:'No staging release published'}),true;
            const dir=path.join(store.root,'releases',actor.site,row.release),redirects=JSON.parse(fs.readFileSync(path.join(dir,'redirects.json')));
            if(redirects[requested]){res.writeHead(301,{Location:`/editor/${actor.site}/live${redirects[requested]}`,'Cache-Control':'private, no-store'});res.end();return true;}
            if(requested==='/sitemap.xml')return output(res,200,fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8'),'application/xml'),true;
            const target=path.join(dir,requested,'index.html');if(!fs.existsSync(target))return output(res,404,{error:'Page not published'}),true;
            return output(res,200,previewHtml(fs.readFileSync(target,'utf8'),actor.site,`/editor/${actor.site}/live`),'text/html',previewHeaders),true;
        }
        const asset=pathname.match(/^\/editor-assets\/([\w-]+)\/([a-f0-9]{64}\.webp)$/);
        if(asset){if(asset[1]!==actor.site)throw fail('FORBIDDEN','Asset belongs to another site.');file(res,path.join(store.root,'assets',actor.site,asset[2]));return true;}
        if(assets&&/^\/(css|js|assets\/images|assets\/fonts)\//.test(pathname)||assets&&pathname==='/favicon.ico') {
            const root=store.site(actor.site).source_root,decoded=decodeURIComponent(pathname),target=path.resolve(root,'.'+decoded);
            if(!target.startsWith(root+path.sep)||!mime[path.extname(target)]||decoded.includes('..')||decoded.includes('\\'))throw fail('FORBIDDEN','Asset path is not allowed.');file(res,target);return true;
        }
        if(owned)return output(res,404,{error:'Not found'}),true;return false;
    } catch(error){output(res,error.code==='RATE_LIMITED'?429:error.code==='FORBIDDEN'?403:error.code==='STALE_REVISION'?409:400,{code:error.code||'INVALID_INPUT',error:error.name==='ZodError'?'Input does not match the editor schema.':error.code?error.message:'The editor could not complete this request. Contact your agency.',details:error.details||{}});return true;}
}
function loginHtml(){return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Website editor sign in</title></head><body style="font:18px system-ui;max-width:520px;margin:10vh auto;padding:24px"><h1>Website editor</h1><p>Use the private editor access token supplied by your agency.</p><form><label>Access token <input name="token" type="password" required autocomplete="off" style="display:block;width:100%;padding:12px;margin:12px 0"></label><button>Sign in</button><p role="status"></p></form><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const response=await fetch('/editor/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:e.target.token.value})});if(response.ok)location.href='/website-editor/';else document.querySelector('[role=status]').textContent='Unable to sign in. Check your token.';};</script></body></html>`;}
function dashboardHtml(site){return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Website editing guide</title><link rel="stylesheet" href="/css/editor-dashboard.css"></head><body><div class="editor-shell"><aside><a href="/website-editor/">Leanne Digital</a><p>Website editor</p><nav><a href="#capabilities">What you can change</a><a href="#pages">Your pages</a><a href="#history">Recent changes</a></nav><p class="editor-note">Site: ${esc(site)}</p></aside><main><header><h1>Edit your website.</h1><p>Ask your connected assistant to update your website. Review the result before you publish.</p><p class="editor-note">Drafts stay private. Publishing here creates a private staging release for agency review.</p></header><p id="status" role="status">Loading your editing permissions…</p><section id="capabilities"><h2>What you can change</h2><div id="capability-list"></div></section><section id="pages"><h2>Your pages</h2><div id="page-list"></div><div id="page-details" class="page-details" hidden></div></section><section id="history"><h2>Recent changes</h2><div id="history-list"></div></section></main></div><script src="/js/editor-dashboard.js" defer></script></body></html>`;}
