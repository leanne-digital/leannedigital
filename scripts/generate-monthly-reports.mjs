import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadEnv} from './load-env.mjs';
import {loadClients,getClient,upsertClientReport} from './client-store.mjs';
import {listStructuredReports,loadReportRecord,reportSlugFor,titleFromMonthKey,monthLabelFromKey} from './seo-report-store.mjs';
import {renderReportPage} from './generate-clients.mjs';
import {resolveReportServiceIntro} from './report-service-intros.mjs';
import {listClientWorkLogs} from '../server/services/client-work-log.mjs';
import {WORK_CATEGORIES,categoryLabel} from './work-categories.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
export function currentMonth(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(now);
 return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}`;
}
export function previousMonth(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(now);
 const year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value);
 return `${month===1?year-1:year}-${String(month===1?12:month-1).padStart(2,'0')}`;
}
export function buildMonthlyReport(client,month,entries,previous={}) {
 const completed=entries.filter(e=>e.status==='completed'),pending=entries.filter(e=>e.status!=='completed');
 const groups=Object.entries(WORK_CATEGORIES).filter(([key])=>completed.some(e=>e.category===key)).map(([key,title])=>({category:key,title,entries:completed.filter(e=>e.category===key)}));
 const unclassified=completed.filter(e=>!WORK_CATEGORIES[e.category]);
 if(unclassified.length)groups.push({category:'uncategorized',title:'Work completed — needs categorization',entries:unclassified});
 const {serviceTitle,serviceIntro}=resolveReportServiceIntro(client,previous);
 const slug=reportSlugFor(client.slug,month),ads=(client.serviceTags||[]).some(t=>['ads','google-ads'].includes(t));
 const keywords=!previous.hiddenSections?.includes('Keyword rankings')&&previous.keywords?.enabled!==false;
 return {slug,kind:'seo',monthKey:month,title:titleFromMonthKey(month),monthLabel:monthLabelFromKey(month),clientName:client.name,companyName:client.name,
  serviceTitle,serviceIntro,startWithRecap:true,richSections:true,hideCover:previous.hideCover===true,coverImage:previous.coverImage||client.asset||'',
  hiddenSections:['Internal linking','New content and updates',...(!keywords?['Keyword rankings']:[]),...(!ads?['Google Ads']:[])],
  monthlyRecap:[`${titleFromMonthKey(month)} includes ${completed.length} completed work ${completed.length===1?'entry':'entries'} recorded for ${client.name}.${pending.length?` Another ${pending.length} ${pending.length===1?'entry remains':'entries remain'} in progress or awaiting the client.`:''}`, 'This report was prepared from the saved work logs. Monthly audit and performance assets are pending review.'],
  technicalSeo:{visuals:[],recap:['The technical audit for this reporting month is pending. No new audit score or ranking improvement is claimed.']},
  automatedWorkSections:groups,completedWorkTitle:'Work completed',
  keywords:{enabled:keywords,visuals:[],recap:['This month’s keyword report and download are pending.']},
  googleAds:{enabled:ads,visuals:[],title:'Google Ads Management',recap:ads?['This month’s advertising results and conversion checks are pending review.']:[]},
  nextSteps:pending.length?['Continue the unfinished work below. These entries retain their recorded status and are not completed deliverables.']:['Next month’s priorities will be confirmed after review.'],
  nextStepsWork:pending.map(e=>({area:categoryLabel(e.category),action:`${e.title} — ${e.details} (${e.status==='awaiting_client'?'Awaiting client':'In progress'})`})),
  workLogSnapshot:entries,automation:{version:2,generatedAt:new Date().toISOString(),buildComplete:false,status:'ready-for-review',uncategorizedCount:entries.filter(e=>!WORK_CATEGORIES[e.category]).length,pendingAssets:['Technical audit',...(keywords?['Keyword report']:[]),...(ads?['Google Ads results']:[])]}
 };
}
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',text);fs.renameSync(file+'.tmp',file);}
export async function generateMonthlyReports({month=currentMonth(),apply=false,publishRoot=null,now=new Date(),clientSlug=null}={}) {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Use YYYY-MM');
 if(month>currentMonth(now))throw Error('Future months cannot be generated.');
 const clients=loadClients().filter(c=>(!clientSlug||c.slug===clientSlug)&&c.monthlyReportEnabled===true&&!c.archivedAt&&(c.visibility||'shared')==='shared');
 const results=[];const lock=path.join(ROOT,'runtime/monthly-reports.lock');
 if(apply){fs.mkdirSync(path.dirname(lock),{recursive:true});fs.mkdirSync(lock);}
 try{for(const client of clients){
  const entries=listClientWorkLogs({clientSlug:client.slug,month});
  if(!entries.length){results.push({client:client.slug,month,status:'no-work-entries'});continue;}
  const slug=reportSlugFor(client.slug,month),records=listStructuredReports(client.slug);
  const existing=records.find(r=>r.monthKey===month)||loadReportRecord(client.slug,slug);
  const registered=(client.reports||[]).find(r=>r.monthKey===month||r.slug===slug);
  const rolling=month===currentMonth(now)&&existing?.automation?.version===2;
  if((existing||registered)&&!rolling&&!(existing?.automation&&existing.automation.buildComplete===false)) {results.push({client:client.slug,status:'existing-preserved',slug:existing?.slug||registered.slug});continue;}
  const previous=records.find(r=>r.monthKey<month)||{};
  if(rolling && existing.automation.buildComplete && JSON.stringify(existing.workLogSnapshot)===JSON.stringify(entries)) {
   results.push({client:client.slug,month,slug:existing.slug,status:'up-to-date',entries:entries.length});continue;
  }
  const fresh=buildMonthlyReport(client,month,entries,previous);
  // Refresh only work-log-owned fields; preserve manually supplied audit assets and commentary.
  const record=rolling ? {...existing,automatedWorkSections:fresh.automatedWorkSections,nextStepsWork:fresh.nextStepsWork,
   workLogSnapshot:fresh.workLogSnapshot,automation:{...existing.automation,generatedAt:fresh.automation.generatedAt,buildComplete:false,uncategorizedCount:fresh.automation.uncategorizedCount}}
   : existing||fresh;
  if(rolling && existing.nextSteps?.some(text=>text.startsWith('Continue the unfinished work')||text.startsWith('Next month’s priorities')))record.nextSteps=fresh.nextSteps;
  if(rolling && existing.monthlyRecap?.[0]?.includes('completed work')) record.monthlyRecap=[fresh.monthlyRecap[0],...existing.monthlyRecap.slice(1)];
  const summary={client:client.slug,month,slug:record.slug,status:apply?(rolling?'updated':'created'):(rolling?'would-update':'would-create'),entries:record.workLogSnapshot.length,uncategorized:record.automation.uncategorizedCount,pendingAssets:record.automation.pendingAssets};
  if(apply){
   const json=path.join(ROOT,'data/client-reports',client.slug,record.slug+'.json');write(json,JSON.stringify(record,null,2)+'\n');
   const meta={slug:record.slug,monthKey:month,title:record.title,kind:'seo'};
   // Render only this new report. Never regenerate historical pages or the staff workspace.
   let html=renderReportPage({...client,reports:[meta,...(client.reports||[])]},meta);
   html=html.replace(/site-nav\.js(?:\?v=[\w.-]+)?/g,'site-nav.js?v=bio-20261102').replace(/portal-auth\.js(?:\?v=[\w.-]+)?/g,'portal-auth.js?v=security-google-icon-20261102');
   const relative=path.join('clients',client.slug,record.slug,'index.html');write(path.join(ROOT,relative),html);
   if(publishRoot)write(path.join(path.resolve(publishRoot),relative),html);
   upsertClientReport(client.slug,meta);
   record.automation.buildComplete=true;write(json,JSON.stringify(record,null,2)+'\n');
   summary.url=`https://leannedigital.com/clients/${client.slug}/${record.slug}/`;
  }
  results.push(summary);
 }}finally{if(apply)fs.rmdirSync(lock);}
 return {month,apply,clients:results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 loadEnv();const month=process.argv.find(a=>a.startsWith('--month='))?.slice(8)||currentMonth();
 const publishRoot=process.argv.find(a=>a.startsWith('--publish-root='))?.slice(15)||null;
 console.log(JSON.stringify(await generateMonthlyReports({month,apply:process.argv.includes('--apply'),publishRoot}),null,2));
}
