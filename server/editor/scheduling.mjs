import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fail,uid} from './schema.mjs';
const digest=p=>crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
export function torontoInstant(value) {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(value))throw fail('INVALID_TIME','Use Toronto time with seconds and its explicit UTC offset, for example 2026-11-05T09:00:00-05:00.');
 const instant=Date.parse(value);if(!Number.isFinite(instant))throw fail('INVALID_TIME','Invalid publication time.');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(p=>[p.type,p.value]));
 const local=`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
 if(local!==value.slice(0,19))throw fail('INVALID_TIME','The local time/offset is not valid in America/Toronto. Check daylight saving time.');return instant;
}
export function migrateSchedules(db){db.exec(`CREATE TABLE IF NOT EXISTS editor_schedules(id TEXT PRIMARY KEY,site TEXT NOT NULL,page_id TEXT NOT NULL,actor TEXT NOT NULL,due INTEGER NOT NULL,page TEXT NOT NULL,page_hash TEXT NOT NULL,environment TEXT NOT NULL,state TEXT NOT NULL,release TEXT,error TEXT,created TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS one_pending_schedule ON editor_schedules(site,page_id) WHERE state='pending';`);}
export function scheduleAction(store,actor,name,args) {
 if(name==='editor_list_schedules')return {timeZone:'America/Toronto',schedules:store.db.prepare('SELECT id,page_id AS pageId,due,state,release,error FROM editor_schedules WHERE site=? ORDER BY due').all(actor.site).map(x=>({...x,scheduledAt:new Date(x.due).toISOString(),localTime:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',dateStyle:'full',timeStyle:'long'}).format(x.due)}))};
 if(name==='editor_cancel_schedule') {const row=store.db.prepare('SELECT * FROM editor_schedules WHERE site=? AND id=?').get(actor.site,args.scheduleId);if(!row)throw fail('NOT_FOUND','Schedule not found for this site.');store.db.prepare("UPDATE editor_schedules SET state='cancelled' WHERE id=? AND state='pending'").run(row.id);return {cancelled:row.state==='pending'||row.state==='cancelled',previousState:row.state};}
 const due=torontoInstant(args.scheduledAt);if(due<=Date.now())throw fail('PAST_SCHEDULE','Choose a future publication time. A past displayed date does not schedule or publish a post.');
 const row=store.site(actor.site);store.checkRevision(actor.site,args.expectedRevision);
 if(!row.release)throw fail('REVIEW_REQUIRED','Publish an initial reviewed site release before scheduling a post.');
 const change=store.change(actor,args.changeSetId),details=JSON.parse(change.details);
 if(change.saved!==row.revision||change.reviewed_revision!==row.revision||change.reviewed_by!==actor.subject||change.digest!==args.reviewDigest)throw fail('REVIEW_REQUIRED','Review the saved draft with this publishing account before scheduling or rescheduling.');
 const environment=store.publicSite===actor.site?'production':'private-staging';
 if(details.publicationEnvironment!==environment||details.issues.some(x=>x.severity==='error'))throw fail('REVIEW_REQUIRED','Fix issues and review for this publication environment.');
 const page=JSON.parse(change.snapshot).pages.find(p=>p.id===args.pageId&&p.kind==='post'&&p.state!=='deleted');if(!page)throw fail('INVALID_POST','Choose a saved, non-deleted blog post.');
 store.db.prepare("UPDATE editor_schedules SET state='superseded' WHERE site=? AND page_id=? AND state='pending'").run(actor.site,page.id);
 const id=uid();store.db.prepare('INSERT INTO editor_schedules VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,actor.site,page.id,actor.subject,due,JSON.stringify(page),digest(page),environment,'pending',null,null,new Date().toISOString());
 return {scheduleId:id,pageId:page.id,scheduledAt:new Date(due).toISOString(),timeZone:'America/Toronto',environment,state:'pending',message:'Only this reviewed post will publish. Subsequent edits to it require a new review and schedule. Unrelated drafts remain private.'};
}
export function runDueSchedules(store,now=Date.now()) {
 const jobs=store.db.prepare("SELECT id FROM editor_schedules WHERE state='pending' AND due<=? ORDER BY due").all(now),results=[];
 for(const {id} of jobs) {
  try {results.push(store.transaction(()=>{
   const job=store.db.prepare("SELECT * FROM editor_schedules WHERE id=? AND state='pending'").get(id);if(!job)return {id,state:'already-handled'};
   const actor={site:job.site,subject:job.actor};store.authorize(actor,'publish');store.assertFeature(actor,'Blog posts');
   if(job.environment!==(store.publicSite===job.site?'production':'private-staging'))throw fail('ENVIRONMENT_CHANGED','Publication environment changed; review again.');
   const row=store.site(job.site),draft=JSON.parse(row.snapshot),current=draft.pages.find(p=>p.id===job.page_id);
   if(!current||digest(current)!==job.page_hash)throw fail('REVIEW_REQUIRED','Scheduled post changed; review and reschedule.');
   if(!row.release)throw fail('REVIEW_REQUIRED','Publish an initial reviewed site release before scheduled publication.');
   const live=JSON.parse(fs.readFileSync(path.join(store.root,'releases',job.site,row.release,'snapshot.json'),'utf8'));
   const page={...JSON.parse(job.page),state:'published'};
   if(live.pages.some(p=>p.id!==page.id&&p.path===page.path)||live.redirects[page.path])throw fail('PATH_EXISTS','Scheduled URL conflicts with a published route.');
   const old=live.pages.find(p=>p.id===page.id);if(old&&old.path!==page.path)live.redirects[old.path]=page.path;
   live.pages=live.pages.filter(p=>p.id!==page.id);live.pages.push(page);live.assets=draft.assets;
   const release=store.buildRelease(job.site,live);draft.pages[draft.pages.findIndex(p=>p.id===page.id)]=page;
   const revision=store.revision(actor,draft,'scheduled-publication',{scheduleId:id,pageId:page.id});
   store.db.prepare('UPDATE sites SET release=? WHERE id=?').run(release,job.site);
   store.db.prepare('INSERT INTO publications VALUES (?,?,?,?,?,?)').run(release,job.site,revision,job.actor,new Date(now).toISOString(),row.release);
   store.db.prepare("UPDATE editor_schedules SET state='published',release=? WHERE id=?").run(release,id);return {id,state:'published',release};
  }));}catch(error){store.db.prepare("UPDATE editor_schedules SET state='needs-review',error=? WHERE id=? AND state='pending'").run(error.code||'PUBLICATION_FAILED',id);results.push({id,state:'needs-review',code:error.code||'PUBLICATION_FAILED'});}
 }return results;
}
