import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { load } from 'cheerio';
import crypto from 'node:crypto';
import { EditorStore } from '../server/editor/store.mjs';
import {groups} from '../server/editor/schema.mjs';
const {values}=parseArgs({options:{source:{type:'string'},palette:{type:'string'},features:{type:'string'},data:{type:'string'},site:{type:'string',default:'leanne-digital'},subject:{type:'string'},role:{type:'string',default:'publisher'},'token-file':{type:'string'},'revoke-tokens':{type:'boolean'},origin:{type:'string',default:'https://leannedigital.com'}}});
const source=path.resolve(values.source||'.'),store=new EditorStore(values.data||path.join(source,'runtime/website-editor'));
if(!/^[a-z0-9-]+$/.test(values.site))throw Error('Use a lowercase site ID.');
if(values.source) {
    const sitemap=load(fs.readFileSync(path.join(source,'sitemap.xml'),'utf8'),{xml:true});
    const paths=[...new Set(['/',...sitemap('loc').toArray().map(el=>new URL(sitemap(el).text()).pathname)])];
    const excluded=/^\/(?:clients|client-portal|admin|login|profile|google-platforms|seo-clients|technical-seo|hosting|maintenance|site-management|project-management|project-tracker|proposals|ldd-chat|mittohnee|newsletter|thank-you|seo-workshop-thank-you)(?:\/|$)/;
    const posts=JSON.parse(fs.readFileSync(path.join(source,'data/blog-posts.json'),'utf8'));
    const pages=[],assets=new Map();
    for(const route of paths) {
        if(excluded.test(route))continue;
        const file=path.resolve(source,'.'+route,'index.html');if(!file.startsWith(source+path.sep)||!fs.existsSync(file))continue;
        const html=fs.readFileSync(file,'utf8'),$=load(html);if(!$('main').length)continue;
        pages.push({path:route,title:$('title').text(),kind:posts.some(p=>p.path===route)?'post':'page',html,seo:{title:$('title').text(),description:$('meta[name=description]').attr('content')||''}});
        $('img[src]').each((_,el)=>{
            const url=new URL($(el).attr('src'),'https://leannedigital.com'+route);
            if(url.origin!=='https://leannedigital.com'||!url.pathname.startsWith('/assets/images/'))return;
            const id=crypto.createHash('sha256').update(url.pathname).digest('hex');
            assets.set(id,{id,url:url.pathname,name:path.basename(url.pathname),alt:$(el).attr('alt')||'',width:Number($(el).attr('width'))||1200,height:Number($(el).attr('height'))||800,imported:true});
        });
    }
    console.log(store.bootstrap({site:values.site,name:'Leanne Digital',origin:values.origin,sourceRoot:source,pages,assets:[...assets.values()],palette:values.palette?JSON.parse(fs.readFileSync(values.palette,'utf8')):{}}));
}
if(values.subject) {
    store.grant(values.subject,values.site,values.role);
    if(values['revoke-tokens']){store.db.prepare('DELETE FROM credentials WHERE subject=? AND site=?').run(values.subject,values.site);if(store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='editor_oauth_tokens'").get())store.db.prepare("DELETE FROM editor_oauth_tokens WHERE json_extract(payload,'$.subject')=? AND json_extract(payload,'$.site')=?").run(values.subject,values.site);}
    if(values['token-file']) {const file=path.resolve(values['token-file']);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,store.token(values.subject,values.site),{mode:0o600});console.log('Editor access token saved privately:',file);}
    console.log('Site grant configured:',values.subject,values.site,values.role);
}
if(values.features){const enabled=JSON.parse(fs.readFileSync(values.features,'utf8'));if(!Array.isArray(enabled)||enabled.some(g=>!groups.includes(g)))throw Error('Features must be a JSON array of supported groups.');store.site(values.site);store.db.prepare('INSERT OR REPLACE INTO editor_features VALUES (?,?)').run(values.site,JSON.stringify(enabled));console.log('Site features configured.');}
store.close();
