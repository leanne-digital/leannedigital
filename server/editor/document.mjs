import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { tokens, fonts, fail, uid } from './schema.mjs';

export const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const compact = value => String(value || '').replace(/\s+/g,' ').trim();
const editable = 'h1,h2,h3,h4,h5,h6,p,li,a,img,blockquote,summary,ul,ol';
const attrId = 'data-editor-id';
export function tagDocument(html, pagePath) {
    const $ = load(html);
    const absolute = value => {const url=new URL(value,'https://leannedigital.com'+pagePath);return url.pathname+url.search+url.hash;};
    // Paths become independent of preview/release location. No template code is executed.
    $('[src],[href],[poster],[action]').each((_, el) => {
        for (const key of ['src','href','poster','action']) {
            const value = $(el).attr(key);
            if (value && !/^(?:[a-z]+:|\/|#)/i.test(value)) $(el).attr(key, absolute(value));
        }
    });
    $('[srcset]').each((_,el)=>{const value=$(el).attr('srcset');if(value.startsWith('data:'))return;$(el).attr('srcset',value.split(',').map(candidate=>{const [url,...descriptor]=candidate.trim().split(/\s+/);return [url&&!/^(?:[a-z]+:|\/)/i.test(url)?absolute(url):url,...descriptor].join(' ');}).join(', '));});
    $('[style]').each((_,el)=>$(el).attr('style',$(el).attr('style').replace(/url\(["']?([^\s"')]+)["']?\)/g,(match,url)=>/^(?:[a-z]+:|\/|#)/i.test(url)?match:`url("${absolute(url)}")`)));
    $('main > section, main > article, header, footer').each((_,el) => { if (!$(el).attr(attrId)) $(el).attr(attrId,uid()); });
    $(editable).each((_,el) => {
        if ($(el).closest('form,script,dialog,[role="dialog"]').length) return;
        if ($(el).closest('nav').length && (el.tagName!=='a'||!$(el).attr('href')||$(el).attr('href').startsWith('#'))) return;
        if (!$(el).attr(attrId)) $(el).attr(attrId,uid());
        if(region($,el)!=='main'&&['a','p'].includes(el.tagName)&&!$(el).attr('data-editor-shared'))$(el).attr('data-editor-shared',createHash('sha256').update(region($,el)+'|'+el.tagName+'|'+($(el).attr('href')||'')+'|'+compact($(el).text())).digest('hex').slice(0,24));
        if (/^h[1-6]$/.test(el.tagName) && !$(el).attr('data-editor-heading-style')) $(el).attr('data-editor-heading-style',el.tagName);
    });
    return $.html();
}
export function kindOf(el) {
    const tag=el.tagName;
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag==='img') return 'image';
    if (tag==='section'||tag==='article'||tag==='header'||tag==='footer') return 'section';
    if (tag==='ul'||tag==='ol') return 'list';
    if (tag==='a') return /btn|button/.test(el.attribs.class || '') ? 'button' : 'link';
    return 'paragraph';
}
function region($,el) { return $(el).closest('main').length ? 'main' : $(el).closest('footer').length ? 'footer' : 'header'; }
export function structure(page) {
    const $=load(page.html);
    const nodes=$(`[${attrId}]`).toArray().map(el=>({
        id:$(el).attr(attrId), label:$(el).attr('data-editor-label') || compact($(el).text()).slice(0,100) || $(el).attr('alt') || el.tagName,
        type:kindOf(el), tag:el.tagName, region:region($,el),
        parentId:$(el).parents(`[${attrId}]`).first().attr(attrId) || null,
        text:kindOf(el)==='section' ? undefined : compact($(el).text()),
        hidden:$(el).is('[hidden]') || Boolean($(el).parents('[hidden]').length),
        href:$(el).attr('href'), src:$(el).attr('src'), alt:$(el).attr('alt'),
        level:/^h[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : undefined,
        className:$(el).attr('class') || '',
        sharedKey:$(el).attr('data-editor-shared'),
        movable:$(el).parent().is('main') && !$(el).find('form').length,
        contentProtected:$(el).find('input,form,script,iframe').length>0,
        style:page.styles?.[$(el).attr(attrId)] || {},
    }));
    return { id:page.id,path:page.path,title:page.title,state:page.state,kind:page.kind,displayDate:page.displayDate||null,seo:page.seo,post:page.post,nodes,
        counting:'One-based, DOM order, main content only by default. Paragraphs are p/li/blockquote/summary; hidden elements and descendants are excluded. Lists count their individual li paragraphs; headings are separate. Sections count direct main children only.' };
}
export function findContent(page, args) {
    const tree=structure(page), all=tree.nodes;
    let rows=all.filter(n=>(args.region==='all'||n.region===(args.region||'main'))&&!n.hidden);
    if (args.sectionId) {
        const descendants = new Set([args.sectionId]);
        all.forEach(n=>{if(descendants.has(n.parentId)) descendants.add(n.id);});
        rows=rows.filter(n=>descendants.has(n.id)&&n.id!==args.sectionId);
    }
    if (args.afterHeading) {
        const heads=rows.filter(n=>n.type==='heading'&&n.text.toLowerCase().includes(args.afterHeading.toLowerCase()));
        if(heads.length!==1) return {needsClarification:true,candidates:heads,counting:tree.counting};
        const start=rows.findIndex(n=>n.id===heads[0].id);
        rows=rows.slice(start+1);
        const end=rows.findIndex(n=>n.type==='heading');
        if(end>=0) rows=rows.slice(0,end);
    }
    if(args.kind) rows=rows.filter(n=>n.type===args.kind && (args.kind!=='section'||n.movable));
    if(args.query) rows=rows.filter(n=>(n.text||n.label).toLowerCase().includes(args.query.toLowerCase()));
    if(args.ordinal) rows=[rows[args.fromBottom?rows.length-args.ordinal:args.ordinal-1]].filter(Boolean);
    return {needsClarification:rows.length!==1,candidates:rows.map(n=>({...n,previous:all[all.findIndex(x=>x.id===n.id)-1]?.label,next:all[all.findIndex(x=>x.id===n.id)+1]?.label})),counting:tree.counting};
}
export function richHtml(runs) { return runs.map(run=>{let v=esc(run.text);if(run.bold)v=`<strong>${v}</strong>`;if(run.italic)v=`<em>${v}</em>`;if(run.href)v=`<a href="${esc(run.href)}">${v}</a>`;return v;}).join(''); }
function asset(snapshot,id) { const a=snapshot.assets.find(a=>a.id===id);if(!a)throw fail('ASSET_NOT_FOUND','Choose an asset belonging to this site.');return a; }
function getNode($,id) { const node=$(`[${attrId}="${id}"]`);if(node.length!==1)throw fail('TARGET_NOT_FOUND','Inspect the current page and select an exact target ID.');return node; }
function place($,node,pos,parent) {
    const siblings=parent.children().not(node);
    if(pos.before||pos.after) {
        const target=getNode($,pos.before||pos.after);
        if(target[0]===node[0]||target.parent()[0]!==parent[0])throw fail('INVALID_POSITION','Target must be a different sibling in the same region.');
        pos.before?target.before(node):target.after(node);
    } else {
        const at=pos.index ? pos.index-1 : siblings.length+1-pos.fromBottom;
        if(at<0||at>siblings.length)throw fail('INVALID_POSITION','Position is outside this region.');
        at===siblings.length?parent.append(node):siblings.eq(at).before(node);
    }
}
function duplicateIds($,node,page) {
    const map=new Map();
    node.find('[id]').addBack('[id]').each((_,el)=>{const old=$(el).attr('id'), next='copy-'+uid();map.set(old,next);$(el).attr('id',next);});
    node.find(`[${attrId}]`).addBack(`[${attrId}]`).each((_,el)=>{const old=$(el).attr(attrId),next=uid();$(el).attr(attrId,next);if(page.styles?.[old])page.styles[next]=structuredClone(page.styles[old]);if(page.backgrounds?.[old])page.backgrounds[next]=structuredClone(page.backgrounds[old]);});
    node.find('[href],[aria-labelledby]').addBack().each((_,el)=>{
        const href=$(el).attr('href');if(href?.startsWith('#')&&map.has(href.slice(1)))$(el).attr('href','#'+map.get(href.slice(1)));
        const labelled=$(el).attr('aria-labelledby');if(labelled)$(el).attr('aria-labelledby',labelled.split(' ').map(x=>map.get(x)||x).join(' '));
    });
}
export const templates = {
    text:'<section class="section--navy"><div class="container"><h2>Section heading</h2><p>Add your text.</p></div></section>',
    cta:'<section class="section--navy"><div class="container"><h2>Let’s talk</h2><p>Tell visitors how you can help.</p><a class="ld-btn" href="/contact/">Contact us</a></div></section>',
    faq:'<section class="page-faq section--navy"><div class="container"><h2>Frequently asked questions</h2><details><summary>Your question</summary><p>Your answer.</p></details></div></section>',
    'image-text':'<section class="section--navy"><div class="container"><h2>Our work</h2><p>Describe your work.</p><figure><img alt="" src="/favicon.ico"><figcaption></figcaption></figure></div></section>',
    testimonials:'<section class="reviews section--navy"><div class="container"><h2>Client feedback</h2><blockquote>Add an approved customer quote.</blockquote><p>Customer name</p></div></section>',
};
function blockHtml(block,snapshot,headingStyles) {
    const attrs=`${attrId}="${block.id||uid()}"`;
    const content=block.richText?richHtml(block.richText):esc(block.text||'');
    if(block.type==='heading'){headingStyles[block.id] ||= 'h'+(block.level||2);return `<h${block.level||2} ${attrs} data-editor-heading-style="${headingStyles[block.id]}">${content}</h${block.level||2}>`;}
    if(block.type==='image')return `<figure><img ${attrs} src="${esc(asset(snapshot,block.assetId).url)}" alt="${esc(block.decorative?'':block.alt||'')}" ${block.decorative?'role="presentation"':''} style="aspect-ratio:${(block.aspectRatio||'auto').replace(':','/')};object-fit:${block.fit||'cover'};object-position:${block.focalX??50}% ${block.focalY??50}%"><figcaption>${esc(block.caption||'')}</figcaption></figure>`;
    if(block.type==='list')return `<ul ${attrs}>${(block.items||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
    if(block.type==='button')return `<a ${attrs} class="ld-btn" href="${esc(block.href||'/contact/')}"${block.newTab?' target="_blank" rel="noopener noreferrer"':''}>${content}</a>`;
    return `<${block.type==='quote'?'blockquote':'p'} ${attrs}>${content}</${block.type==='quote'?'blockquote':'p'}>`;
}
export function renderPost(page,snapshot,shell) {
    const $=load(shell.html), p=page.post;
    page.postIds ||= {article:uid(),header:uid(),categories:uid(),title:uid(),author:uid(),featured:uid()};
    const ids=page.postIds;
    page.blockHeadingStyles ||= {};
    const featured=p.featuredAssetId?`<figure class="blog-post__featured"><img data-editor-id="${ids.featured}" src="${esc(asset(snapshot,p.featuredAssetId).url)}" alt="${esc(p.featuredAlt)}"></figure>`:'';
    const titleTag='h'+(page.postHeadingLevel||1);
    $('main').html(`<article data-editor-id="${ids.article}" class="blog-post section--navy"><header data-editor-id="${ids.header}" class="blog-post__header"><div class="container blog-post__header-inner"><p data-editor-id="${ids.categories}" class="blog-post__category">${esc(p.categories.join(' · '))}</p><${titleTag} data-editor-id="${ids.title}" data-editor-heading-style="h1" class="blog-post__title">${esc(p.title)}</${titleTag}><p data-editor-id="${ids.author}" class="blog-post__meta">${esc(p.author)}</p>${featured}</div></header><div class="container blog-post__content"><div class="blog-prose">${p.blocks.map(b=>blockHtml(b,snapshot,page.blockHeadingStyles)).join('')}</div></div></article>`);
    if(!$('link[href="/css/blog-post.css"]').length)$('head').append('<link rel="stylesheet" href="/css/blog-post.css">');
    page.html=tagDocument($.html(),page.path);
    page.title=p.title;page.seo={title:p.seoTitle||p.title,description:p.description||p.excerpt,socialAssetId:p.socialAssetId||p.featuredAssetId};
}
export function applyOperation(snapshot,op) {
    if(op.op==='page_create') {
        const route='/'+op.slug+'/';
        if(snapshot.pages.some(p=>p.path===route)||snapshot.redirects[route])throw fail('PATH_EXISTS','This URL is already reserved.');
        const $=load(snapshot.pages[0].html);
        $('main').html(`<section class="section--navy"><div class="container"><h1>${esc(op.title)}</h1></div></section>`+templates[op.template]);
        $('main > section').eq(1).attr('data-editor-template',op.template);
        snapshot.pages.push({id:uid(),path:route,title:op.title,kind:'page',state:'draft',styles:{},seo:{title:op.title,description:''},html:tagDocument($.html(),route)});return;
    }
    if(op.op==='blog_create') {
        const page={id:uid(),path:'/'+op.fields.slug+'/',title:op.fields.title,kind:'post',state:'draft',styles:{},post:op.fields};
        if(snapshot.pages.some(p=>p.path===page.path)||snapshot.redirects[page.path])throw fail('PATH_EXISTS','This URL is already reserved.');
        page.post.blocks=page.post.blocks.map(b=>({...b,id:uid()}));
        renderPost(page,snapshot,snapshot.pages.find(p=>p.kind==='post')||snapshot.pages[0]);snapshot.pages.push(page);return;
    }
    const page=snapshot.pages.find(p=>p.id===op.pageId);
    if(!page)throw fail('PAGE_NOT_FOUND','Page does not belong to this site.');
    if(op.op==='publication_date'){if(page.kind!=='post')throw fail('INVALID_POST','Displayed publication dates belong to blog posts.');page.displayDate=op.date;return;}
    if(op.op==='page_state'){page.state=op.state;return;}
    if(op.op==='seo'){if(op.fields.socialAssetId)asset(snapshot,op.fields.socialAssetId);page.seo={...page.seo,...op.fields};return;}
    if(op.op==='slug') {
        const next='/'+op.slug+'/';
        if(page.path==='/')throw fail('AGENCY_REQUIRED','The homepage URL is fixed.');
        if(snapshot.pages.some(p=>p.path===next)||snapshot.redirects[next])throw fail('PATH_EXISTS','This URL is already reserved.');
        const previous=page.path;page.path=next;snapshot.redirects[previous]=next;
        for(const [key,value] of Object.entries(snapshot.redirects))if(value===previous)snapshot.redirects[key]=next;
        for(const p of snapshot.pages){const d=load(p.html);d('a[href]').each((_,el)=>{if(d(el).attr('href')===previous)d(el).attr('href',next);});p.html=d.html();}
        return;
    }
    if(op.op==='blog_update') {
        if(!page.post)throw fail('AGENCY_REQUIRED','Imported posts use target editing; structured post metadata is for newly authored posts.');
        if(op.fields.blocks){const known=new Set(page.post.blocks.map(b=>b.id)),seen=new Set();for(const block of op.fields.blocks){if(block.id&&(!known.has(block.id)||seen.has(block.id)))throw fail('INVALID_TARGET','Body block IDs must be unique existing IDs from this post. Omit IDs on new blocks.');if(block.id)seen.add(block.id);}}
        page.post={...page.post,...op.fields};
        page.post.blocks=page.post.blocks.map(b=>({...b,id:b.id||uid()}));
        renderPost(page,snapshot,page);return;
    }
    const $=load(page.html);
    if(op.op==='section'&&op.action==='add') {
        if(!op.template||!op.position)throw fail('INVALID_INPUT','Adding a section requires template and position.');
        const node=$(templates[op.template]).attr('data-editor-template',op.template);place($,node,op.position,$('main'));page.html=tagDocument($.html(),page.path);return;
    }
    const node=getNode($,op.targetId), kind=kindOf(node[0]);
    if(op.op==='content'&&op.scope==='shared') {
        const key=node.attr('data-editor-shared');if(!key)throw fail('INVALID_SCOPE','Only identified shared header/footer content supports site-wide content editing.');
        for(const targetPage of snapshot.pages){const dom=load(targetPage.html);const ids=dom(`[data-editor-shared="${key}"]`).toArray().map(el=>dom(el).attr(attrId));for(const targetId of ids)applyOperation(snapshot,{...op,scope:'instance',pageId:targetPage.id,targetId});}return;
    }
    if(op.op==='section') {
        if(!node.parent().is('main')||node.find('form,script,iframe').length)throw fail('AGENCY_REQUIRED','Only main-content sections without forms or scripts support this operation.');
        if(op.action==='duplicate'){const copy=node.clone();duplicateIds($,copy,page);place($,copy,op.position||{after:op.targetId},node.parent());}
        if(op.action==='hide'||op.action==='remove')node.attr('hidden','').attr('data-editor-deleted',op.action==='remove'?'true':'false');
        if(op.action==='show')node.removeAttr('hidden').removeAttr('data-editor-deleted');
    }
    if(op.op==='move') {
        if(node.parent().is('main')&&!node.find('form,script,iframe').length) place($,node,op.position,node.parent());
        else if(page.post&&page.post.blocks.some(b=>b.id===op.targetId)) {
            const old=page.post.blocks.find(b=>b.id===op.targetId), rest=page.post.blocks.filter(b=>b.id!==op.targetId);
            let index=op.position.before?rest.findIndex(b=>b.id===op.position.before):op.position.after?rest.findIndex(b=>b.id===op.position.after)+1:op.position.index?op.position.index-1:rest.length+1-op.position.fromBottom;
            if(index<0||index>rest.length||(op.position.after&&!rest.some(b=>b.id===op.position.after)))throw fail('INVALID_POSITION','Select another body block.');
            rest.splice(index,0,old);page.post.blocks=rest;renderPost(page,snapshot,page);return;
        } else throw fail('AGENCY_REQUIRED','Move whole approved sections or structured post body blocks.');
    }
    if(op.op==='style') {
        if(op.scope==='shared'&&!['button','heading','paragraph'].includes(kind))throw fail('INVALID_SCOPE','Shared styles support buttons, headings, and paragraphs.');
        if(op.fields.contentAlign && !node.is('section,article'))throw fail('UNSUPPORTED_FIELD','Container alignment is available only for section containers.');
        if(op.fields.layoutVariant&&!node.attr('data-editor-template'))throw fail('AGENCY_REQUIRED','Layout variants are available on approved newly inserted sections; existing custom layouts need agency review.');
        const key=op.scope==='shared'?kind:op.targetId;
        const styles=op.scope==='shared'?(snapshot.sharedStyles ||= {}):(page.styles ||= {});
        styles[key] ||= {};styles[key][op.breakpoint] ||= {};
        styles[key][op.breakpoint][op.state]={...styles[key][op.breakpoint][op.state],...op.fields};
    }
    if(op.op==='content') {
        const f=op.fields;
        if(page.post) {
            const block=page.post.blocks.find(b=>b.id===op.targetId);
            if(block) {Object.assign(block,f);if(f.text!==undefined)delete block.richText;}
            if(op.targetId===page.postIds?.title&&f.text!==undefined){page.post.title=f.text;page.title=f.text;}
            if(op.targetId===page.postIds?.title&&f.level)page.postHeadingLevel=f.level;
            if(op.targetId===page.postIds?.author&&f.text!==undefined)page.post.author=f.text;
            if(op.targetId===page.postIds?.featured){if(f.assetId)page.post.featuredAssetId=f.assetId;if(f.alt!==undefined)page.post.featuredAlt=f.alt;}
        }
        const allowed=kind==='image'?['assetId','alt','decorative','caption','fit','aspectRatio','focalX','focalY','label']:kind==='section'?['assetId','focalX','focalY','overlay','label']:kind==='heading'?['text','richText','level','label']:kind==='button'||kind==='link'?['text','richText','href','newTab','label']:kind==='list'?['items','label']:['text','richText','label'];
        for(const key of Object.keys(f))if(!allowed.includes(key))throw fail('UNSUPPORTED_FIELD',`${key} is not editable on ${kind}.`,{allowed});
        if(f.text!==undefined&&f.richText!==undefined)throw fail('INVALID_INPUT','Choose plain text or rich text.');
        if(f.text!==undefined||f.richText!==undefined||f.items) {
            if(node.find('img,input,script,button,form').length)throw fail('AGENCY_REQUIRED','This mixed-content block needs an agency template adapter.');
            if(f.items)node.html(f.items.map(t=>`<li>${esc(t)}</li>`).join(''));
            else node.html(f.richText?richHtml(f.richText):esc(f.text));
        }
        if(f.level)node[0].tagName='h'+f.level;
        if(f.href)node.attr('href',f.href);
        if(f.newTab===true)node.attr('target','_blank').attr('rel','noopener noreferrer');
        if(f.newTab===false)node.removeAttr('target').removeAttr('rel');
        if(f.label)node.attr('data-editor-label',f.label);
        if(f.assetId) {
            const a=asset(snapshot,f.assetId);
            if(kind==='image'){node.attr('src',a.url).removeAttr('srcset').removeAttr('sizes');node.closest('picture').find('source').remove();node.attr('width',String(a.width)).attr('height',String(a.height));}
            else {page.backgrounds ||= {};page.backgrounds[op.targetId]={...page.backgrounds[op.targetId],assetId:f.assetId};}
        }
        if(kind==='image') {
            if(f.alt!==undefined)node.attr('alt',f.alt);
            if(f.decorative===true)node.attr('alt','').attr('role','presentation');
            if(f.decorative===false)node.removeAttr('role');
            if(f.caption!==undefined) {if(!node.parent().is('figure'))node.wrap('<figure></figure>');let caption=node.parent().find('figcaption');if(!caption.length){node.parent().append('<figcaption></figcaption>');caption=node.parent().find('figcaption');}caption.text(f.caption);}
            const props={};if(f.fit)props['object-fit']=f.fit;
            if(f.aspectRatio)props['aspect-ratio']=f.aspectRatio.replace(':','/');
            if(f.focalX!==undefined||f.focalY!==undefined)props['object-position']=`${f.focalX??50}% ${f.focalY??50}%`;
            node.css(props);
        } else if(kind==='section'&&(f.overlay!==undefined||f.focalX!==undefined||f.focalY!==undefined)) {page.backgrounds ||= {};page.backgrounds[op.targetId]={...page.backgrounds[op.targetId],...Object.fromEntries(Object.entries(f).filter(([k])=>['overlay','focalX','focalY'].includes(k)))};}
    }
    page.html=tagDocument($.html(),page.path);
}
const cssName = key => key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
function styleRules(selector, rules, theme={tokens,fonts}) {
    let css='';
    for(const [breakpoint,states] of Object.entries(rules))for(const [state,fields] of Object.entries(states)) {
        const declarations=Object.entries(fields).filter(([key])=>key!=='layoutVariant').map(([key,value])=>{
            if(key==='contentAlign')return `display:flex!important;flex-direction:column!important;align-items:${value==='start'?'flex-start':value==='end'?'flex-end':'center'}!important`;
            const v=theme.tokens[value]||theme.fonts[value]||(['fontSize','padding','gap','borderRadius','borderWidth'].includes(key)?value+'px':value);
            return `${cssName(key)}:${v}!important`;
        }).join(';');
        const suffix=state==='normal'?'':state==='focus'?':focus-visible':':hover';
        let rule=`${selector}${suffix}{${declarations};${state==='focus'?'outline:3px solid currentColor!important;outline-offset:3px!important;':''}${fields.borderWidth?'border-style:solid!important;':''}}`;
        if(fields.layoutVariant)rule+=`${selector}${suffix} > .container{display:${fields.layoutVariant==='stacked'?'block':'grid'}!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:inherit}${selector}${suffix} > .container > :is(h1,h2,h3,h4,h5,h6){grid-column:1/-1}`;
        css+=breakpoint==='all'?rule:`@media(${breakpoint==='mobile'?'max-width:767px':'min-width:768px'}){${rule}}`;
    }
    return css;
}
export function renderPage(page,snapshot,{preview=false}={}) {
    const $=load(tagDocument(page.html,page.path));
    $('title').text(page.seo?.title||page.title);
    function meta(name,content,property=false){let node=$(`meta[${property?'property':'name'}="${name}"]`);if(!node.length){$('head').append(`<meta ${property?'property':'name'}="${name}">`);node=$(`meta[${property?'property':'name'}="${name}"]`);}node.attr('content',content);}
    if(page.seo?.description!==undefined)meta('description',page.seo.description);
    meta('og:title',page.seo?.title||page.title,true);meta('og:description',page.seo?.description||'',true);
    if(page.seo?.socialAssetId)meta('og:image',snapshot.origin+asset(snapshot,page.seo.socialAssetId).url,true);
    $('link[rel="canonical"]').attr('href',snapshot.origin+page.path);
    if(page.displayDate){$('main time[data-editor-publication-date],main time[datetime]').remove();$('main h1,main [data-editor-heading-style="h1"]').first().after(`<time data-editor-publication-date datetime="${esc(page.displayDate)}">${esc(page.displayDate)}</time>`);}
    if(page.post) {
        $('script[type="application/ld+json"]').remove();
        const data={'@context':'https://schema.org','@type':'BlogPosting',headline:page.post.title,description:page.seo?.description||'',author:{'@type':'Person',name:page.post.author},mainEntityOfPage:snapshot.origin+page.path,articleSection:page.post.categories,keywords:page.post.tags};
        if(page.displayDate)data.datePublished=page.displayDate;
        if(page.post.featuredAssetId)data.image=snapshot.origin+asset(snapshot,page.post.featuredAssetId).url;
        $('head').append(`<script type="application/ld+json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`);
    }
    let css='[data-editor-id][hidden]{display:none!important}';
    for(const [kind,rules] of Object.entries(snapshot.sharedStyles||{})) {
        const ids=structure(page).nodes.filter(n=>n.type===kind).map(n=>n.id);
        for(const id of ids)css+=styleRules(`[data-editor-id="${id}"]`,rules,snapshot.theme);
    }
    for(const [id,rules] of Object.entries(page.styles||{}))css+=styleRules(`[data-editor-id="${id}"]`,rules,snapshot.theme);
    for(const [id,bg] of Object.entries(page.backgrounds||{}))if(bg.assetId)css+=`[data-editor-id="${id}"]{background-image:linear-gradient(rgba(0,0,0,${bg.overlay||0}),rgba(0,0,0,${bg.overlay||0})),url("${asset(snapshot,bg.assetId).url}")!important;background-size:cover!important;background-position:${bg.focalX??50}% ${bg.focalY??50}%!important}`;
    $('head').append(`<style id="editor-styles">${css}</style>`);
    if(preview){meta('robots','noindex, nofollow');$('form').attr('data-editor-disabled-form','true');$('script[src]').filter((_,el)=>/lilipadd|platform\.js|gtag|report-view/.test($(el).attr('src'))).remove();}
    return $.html();
}
function luminance(hex) {const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export function validateSnapshot(snapshot) {
    const issues=[];
    for(const page of snapshot.pages.filter(p=>p.state!=='deleted')) {
        const nodes=structure(page).nodes, headings=nodes.filter(n=>n.type==='heading'&&!n.hidden&&n.region==='main');
        if(headings.filter(n=>n.level===1).length!==1)issues.push({severity:'warning',pageId:page.id,code:'HEADING_H1',message:'Main content should normally have exactly one H1. Review this intentional semantic change.'});
        headings.forEach((h,i)=>{if(i&&h.level>headings[i-1].level+1)issues.push({severity:'warning',targetId:h.id,code:'HEADING_JUMP',message:'Heading hierarchy skips a level.'});});
        for(const n of nodes)if(n.type==='image'&&!n.hidden&&n.alt===undefined)issues.push({severity:'warning',targetId:n.id,code:'ALT_MISSING',message:'Set descriptive alt text or mark this image decorative.'});
        for(const [targetId,rules] of Object.entries({...Object.fromEntries(Object.entries(snapshot.sharedStyles||{}).map(([k,v])=>['shared:'+k,v])),...page.styles}))for(const [breakpoint,states] of Object.entries(rules))for(const [state,f] of Object.entries(states)) {
            const base={...rules.all?.normal,...rules[breakpoint]?.normal,...f};
            if(f.color||f.backgroundColor) {
                if(!base.color||!base.backgroundColor){issues.push({severity:'warning',targetId,code:'CONTRAST_INHERITED',state,message:'Inherited foreground/background requires rendered browser contrast verification; set both for a deterministic check.'});continue;}
                const palette=snapshot.theme?.tokens||tokens;
                const a=luminance(palette[base.color]),b=luminance(palette[base.backgroundColor]),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
                if(ratio<4.5)issues.push({severity:'error',targetId,code:'LOW_CONTRAST',state,ratio:Number(ratio.toFixed(2)),message:'Use white on brand-red, or navy on white/aqua; normal text needs 4.5:1.'});
            }
        }
    }
    return issues;
}
