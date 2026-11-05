import { z } from 'zod';

export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const text = z.string().max(20000);
export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
export const tokens = { white: '#ffffff', navy: '#0d0d1b', slate: '#212c3e', aqua: '#4ec3cc', 'brand-red': '#b42336', black: '#000000' };
export const fonts = { body: '"Lato", sans-serif', display: '"Nunito", sans-serif', navigation: '"Open Sans", sans-serif' };
export const safeUrl = z.string().max(2000).refine(v => /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(v) && !/[\u0000-\u0020\\<>"']/.test(v), 'Use an HTTPS/HTTP, site-relative, email, telephone or anchor link.');
const color = z.enum(Object.keys(tokens));
export const styleSchema = z.object({
    color: color.optional(), backgroundColor: color.optional(), borderColor: color.optional(),
    textAlign: z.enum(['left','center','right']).optional(), contentAlign: z.enum(['start','center','end']).optional(),
    layoutVariant:z.enum(['stacked','two-column']).optional(),
    fontFamily: z.enum(Object.keys(fonts)).optional(), fontSize: z.number().int().min(12).max(96).optional(),
    fontWeight: z.enum(['400','600','700','800']).optional(), lineHeight: z.number().min(1).max(2.5).optional(),
    padding: z.number().int().min(0).max(120).optional(), gap: z.number().int().min(0).max(80).optional(),
    borderRadius: z.number().int().min(0).max(100).optional(), borderWidth: z.number().int().min(0).max(8).optional(),
}).strict();
export const inlineSchema = z.array(z.object({ text: text, bold: z.boolean().optional(), italic: z.boolean().optional(), href: safeUrl.optional() }).strict()).max(100);
export const contentFields = z.object({
    text: text.optional(), richText: inlineSchema.optional(), items: z.array(text).max(100).optional(),
    level: z.number().int().min(1).max(6).optional(), href: safeUrl.optional(), newTab: z.boolean().optional(),
    assetId: id.optional(), alt: z.string().max(1000).optional(), decorative: z.boolean().optional(),
    caption: z.string().max(2000).optional(), fit: z.enum(['cover','contain']).optional(),
    aspectRatio:z.enum(['auto','1:1','4:3','3:2','16:9','9:16']).optional(),
    focalX: z.number().min(0).max(100).optional(), focalY: z.number().min(0).max(100).optional(),
    overlay: z.number().min(0).max(0.85).optional(), label: z.string().min(1).max(150).optional(),
}).strict();
export const position = z.object({ before: id.optional(), after: id.optional(), index: z.number().int().min(1).optional(), fromBottom: z.number().int().min(1).optional() }).strict().refine(v => Object.keys(v).length === 1, 'Specify exactly one position; positions start at 1.');
export const blogBlock = z.object({ id: id.optional(), type: z.enum(['heading','paragraph','image','list','quote','button']), text: text.optional(), level: z.number().int().min(1).max(6).optional(), richText: inlineSchema.optional(), items: z.array(text).max(100).optional(), assetId: id.optional(), alt: z.string().max(1000).optional(), caption: z.string().max(2000).optional(), href: safeUrl.optional(), fit:z.enum(['cover','contain']).optional(),aspectRatio:z.enum(['auto','1:1','4:3','3:2','16:9','9:16']).optional(),focalX:z.number().min(0).max(100).optional(),focalY:z.number().min(0).max(100).optional(),decorative:z.boolean().optional(),label:z.string().max(150).optional(),newTab:z.boolean().optional() }).strict();
export const postFields = z.object({ title: z.string().min(1).max(200), slug, excerpt: z.string().max(1000).default(''), author: z.string().min(1).max(150), categories: z.array(z.string().max(80)).max(12).default([]), tags: z.array(z.string().max(80)).max(30).default([]), featuredAssetId: id.optional(), featuredAlt: z.string().max(1000).default(''), blocks: z.array(blogBlock).max(200), seoTitle: z.string().max(200).optional(), description: z.string().max(500).optional(), socialAssetId: id.optional() }).strict();
const target = { pageId: id, targetId: id };
export const publicationDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Use a valid calendar date');
export const operationSchema = z.discriminatedUnion('op', [
    z.object({ op: z.literal('content'), ...target, scope:z.enum(['instance','shared']).default('instance'), fields: contentFields }).strict(),
    z.object({ op: z.literal('style'), ...target, scope: z.enum(['instance','shared']), breakpoint: z.enum(['all','desktop','mobile']), state: z.enum(['normal','hover','focus']), fields: styleSchema }).strict(),
    z.object({ op: z.literal('move'), ...target, position }).strict(),
    z.object({ op: z.literal('section'), pageId: id, action: z.enum(['add','duplicate','hide','show','remove']), targetId: id.optional(), template: z.enum(['text','cta','faq','image-text','testimonials']).optional(), position: position.optional() }).strict(),
    z.object({ op: z.literal('seo'), pageId: id, fields: z.object({ title: z.string().min(1).max(200).optional(), description: z.string().max(500).optional(), socialAssetId: id.optional() }).strict() }).strict(),
    z.object({ op: z.literal('slug'), pageId: id, slug }).strict(),
    z.object({ op: z.literal('blog_create'), fields: postFields }).strict(),
    z.object({ op: z.literal('page_create'), title:z.string().min(1).max(200), slug, template:z.enum(['text','cta','faq','image-text','testimonials']) }).strict(),
    z.object({ op: z.literal('blog_update'), pageId: id, fields: postFields.partial().omit({ slug: true }) }).strict(),
    z.object({op:z.literal('publication_date'),pageId:id,date:publicationDate}).strict(),
    z.object({ op: z.literal('page_state'), pageId: id, state: z.enum(['published','draft','deleted']) }).strict(),
]);

// This registry drives discovery, HTTP dispatch and MCP registration.
export const registry = [
    ['editor_list_schedules','read','Blog posts','Show pending and completed publication schedules.',{}],
    ['editor_schedule_post','publish','Blog posts','Schedule or reschedule only this reviewed blog post in America/Toronto; supply the correct explicit DST offset.',{pageId:id,changeSetId:id,expectedRevision:z.number().int().min(1),reviewDigest:z.string().length(64),scheduledAt:z.string().max(40),confirm:z.literal(true),idempotencyKey:id}],
    ['editor_cancel_schedule','publish','Blog posts','Cancel a pending publication without deleting the post.',{scheduleId:id,confirm:z.literal(true),idempotencyKey:id}],
    ['editor_capabilities','read','Preview and publish','Show everything I can change on my website.',{}],
    ['editor_list_pages','read','Text and headings','List my pages and draft posts.',{}],
    ['editor_get_page','read','Page sections','Show the homepage sections in order.',{pageId:id}],
    ['editor_find_content','read','Text and headings','Find the fourth paragraph from the bottom.',{pageId:id,query:z.string().max(300).optional(),kind:z.enum(['paragraph','heading','button','image','section','list','link']).optional(),ordinal:z.number().int().min(1).optional(),fromBottom:z.boolean().optional(),sectionId:id.optional(),afterHeading:z.string().max(300).optional(),region:z.enum(['main','header','footer','all']).default('main')}],
    ['editor_inspect_target','read','Text and headings','Inspect this button and its nearby content.',target],
    ['editor_list_assets','read','Images and backgrounds','Find photos available for this site.',{query:z.string().max(200).default('')}],
    ['editor_ingest_asset','edit','Images and backgrounds','Upload an image for this post.',{filename:z.string().min(1).max(150),base64:z.string().max(8*1024*1024),alt:z.string().max(1000).default(''),idempotencyKey:id}],
    ['editor_prepare_changes','edit','Preview and publish','Prepare these edits without changing the live site.',{expectedRevision:z.number().int().min(1),operations:z.array(operationSchema).min(1).max(50),idempotencyKey:id}],
    ['editor_preview_changes','read','Preview and publish','Show before and after for this exact change set.',{changeSetId:id}],
    ['editor_apply_draft','edit','Preview and publish','Save the reviewed changes as a draft.',{changeSetId:id,expectedRevision:z.number().int().min(1),idempotencyKey:id}],
    ['editor_publish_changes','publish','Preview and publish','Publish the exact reviewed draft.',{changeSetId:id,expectedRevision:z.number().int().min(1),reviewDigest:z.string().length(64),confirm:z.literal(true),idempotencyKey:id}],
    ['editor_list_revisions','read','History and undo','Show recent edits and publications.',{}],
    ['editor_restore_revision','edit','History and undo','Prepare restoration of a previous version.',{revision:z.number().int().min(1),expectedRevision:z.number().int().min(1),idempotencyKey:id}],
];
export const groups = ['Text and headings','Images and backgrounds','Buttons and links','Colours and typography','Alignment and spacing','Page sections','Blog posts','SEO','Preview and publish','History and undo'];
export const fail = (code, message, details = {}) => Object.assign(new Error(message), { code, details });
export const uid = () => crypto.randomUUID().replaceAll('-','');
