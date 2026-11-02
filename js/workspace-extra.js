(() => {
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let clients=[],projects=[],ready=false;
 async function api(path,body,method='POST'){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...(body?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;}
 function renderReports(){const q=$('#report-search').value.toLowerCase();const rows=clients.flatMap(c=>(c.reports||[]).map(r=>({c,r:{...r,title:window.LDReportNaming.title(c,r),monthKey:window.LDReportNaming.month(r)}}))).filter(({c,r})=>(c.name+' '+r.title+' '+r.monthKey).toLowerCase().includes(q)).sort((a,b)=>window.LDReportNaming.newest(a.r,b.r)||a.c.name.localeCompare(b.c.name)||a.r.title.localeCompare(b.r.title));$('#workspace-reports').innerHTML=rows.map(({c,r})=>{const href=c.visibility==='private'?`/api/clients/${encodeURIComponent(c.slug)}/report-view/${encodeURIComponent(r.slug)}`:`/clients/${encodeURIComponent(c.slug)}/${encodeURIComponent(r.slug)}/`;return `<tr><td>${esc(r.title||r.slug)}</td><td>${esc(c.name)}</td><td>${esc(r.monthKey||'—')}</td><td><div class="report-actions"><a class="workspace-action report-action" href="${href}" target="_blank" rel="noopener">Open report ↗</a><button type="button" class="workspace-action report-action report-copy" data-copy-report="${href}" aria-label="Copy report URL for ${esc(c.name)} — ${esc(r.title)}" title="Copy report URL"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></button><span class="report-copy-status" role="status" aria-live="polite"></span></div></td></tr>`;}).join('')||'<tr><td colspan="4" class="workspace-empty">No reports match this search.</td></tr>';}
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-copy-report]');if(!button)return;
  const status=button.parentElement.querySelector('.report-copy-status');
  const url=new URL(button.dataset.copyReport,location.origin).href;
  button.disabled=true;status.textContent='';
  try {
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
   else {const input=document.createElement('textarea');input.value=url;input.style.cssText='position:fixed;left:-9999px';document.body.append(input);input.select();try{if(!document.execCommand('copy'))throw Error('Clipboard unavailable');}finally{input.remove();button.focus();}}
   status.textContent='Copied!';button.title='URL copied';
  }catch{status.textContent='Unable to copy. Copy the Open report link instead.';}
  finally{button.disabled=false;setTimeout(()=>{status.textContent='';button.title='Copy report URL';},4000);}
 });
 function renderProjects(){const q=$('#project-search').value.toLowerCase(),status=$('#project-status').value;const rows=projects.filter(p=>(!status||p.status===status)&&(p.name+' '+(clients.find(c=>c.slug===p.clientSlug)?.name||p.clientSlug)).toLowerCase().includes(q));$('#project-count').textContent=rows.length+' projects';$('#workspace-projects').innerHTML=rows.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(clients.find(c=>c.slug===p.clientSlug)?.name||p.clientSlug)}</td><td>${esc(p.serviceType)}</td><td><span class="admin-pill">${esc(p.status)}</span></td><td>${new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(p.monthlyFee||0)}</td><td><button class="workspace-action" data-edit-service="${esc(p.id)}">Manage</button></td></tr>`).join('')||'<tr><td colspan="6" class="workspace-empty">No projects match this view.</td></tr>';}
 async function loadProjects(){if(!ready)return;try{projects=(await api('/api/projects')).projects||[];renderProjects();$('#project-error').textContent='';}catch(e){$('#project-error').textContent=e.message;}}
 function openProject(id){const p=projects.find(p=>String(p.id)===String(id))||{},f=$('#workspace-project-form');f.reset();f.elements.clientSlug.innerHTML=clients.map(c=>`<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');for(const k of ['id','clientSlug','name','serviceType','status','fee','billingFrequency','notes'])if(p[k]!=null)f.elements[k].value=p[k];$('#project-dialog-error').textContent='';$('#project-dialog').showModal();}
 window.addEventListener('workspace-data',e=>{clients=e.detail.clients||[];ready=true;renderReports();if(location.hash==='#projects')loadProjects();});
 function route(){if(location.hash==='#projects')loadProjects();}
 addEventListener('hashchange',route);addEventListener('workspace-view-change',route);
 $('#new-project').addEventListener('click',()=>openProject());$('#project-search').addEventListener('input',renderProjects);$('#project-status').addEventListener('change',renderProjects);$('#report-search').addEventListener('input',renderReports);
 document.addEventListener('click',e=>{if(e.target.closest('[data-close-project]'))$('#project-dialog').close();const b=e.target.closest('[data-edit-service]');if(b)openProject(b.dataset.editService);});
 $('#workspace-project-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,button=f.querySelector('[type=submit]');button.disabled=true;try{const data=Object.fromEntries(new FormData(f));const id=data.id;delete data.id;data.fee=Number(data.fee||0);await api('/api/projects'+(id?'/'+encodeURIComponent(id):''),data,id?'PATCH':'POST');$('#project-dialog').close();await loadProjects();}catch(e){$('#project-dialog-error').textContent=e.message;}finally{button.disabled=false;}});
})();

(() => {
 const host=document.querySelector('.admin-content');if(!host)return;
 const panel=document.createElement('section');panel.className='admin-panel';panel.dataset.adminPanel='client-work';panel.hidden=true;
 panel.innerHTML=`<h2 class="admin-panel__title">Client Work</h2><p class="admin-panel__lead">Work-log entries grouped by client. New entries appear automatically; completed and pending work keep their recorded status.</p><div class="workspace-toolbar client-work-toolbar"><label>Visibility <select id="client-work-visibility"><option value="shared" selected>Leanne Digital</option><option value="private">Private</option><option value="all">All</option></select></label><label>Month <input type="month" id="client-work-month" required></label><button type="button" class="workspace-action" id="client-work-refresh">Refresh</button><button type="button" class="workspace-action" id="client-work-export" disabled>Export JSON</button></div><p id="client-work-status" role="status" aria-live="polite"></p><div class="dash-table-wrap"><table class="client-work-table"><thead><tr><th scope="col">Date</th><th scope="col">Category</th><th scope="col">Work</th><th scope="col">Details</th><th scope="col">Status</th></tr></thead><tbody id="client-work-rows"></tbody></table></div>`;
 host.append(panel);
 const month=panel.querySelector('#client-work-month'),refresh=panel.querySelector('#client-work-refresh'),download=panel.querySelector('#client-work-export'),status=panel.querySelector('#client-work-status'),rows=panel.querySelector('#client-work-rows');
 const visibility=panel.querySelector('#client-work-visibility');
 const now=new Date();month.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categoryNames={'content-creation':'Content creation',aeo:'AEO',geo:'GEO','technical-seo':'Technical SEO','site-updates':'Site updates','website-development':'Website development',marketing:'Marketing',strategy:'Strategy','bug-fixes':'Bug fixes','internal-linking':'Internal linking','paid-ads':'Paid ads','conversion-tracking':'Conversion tracking',analytics:'Analytics','site-maintenance':'Site maintenance','graphic-design':'Graphic design',consultation:'Consultation',other:'Other'};
 const labels={completed:'Completed',awaiting_client:'Awaiting client',in_progress:'In progress'};
 let clients=[],ready=false,serial=0,loading=false,exportData=null;
 const active=()=>location.hash==='#client-work'&&!document.hidden;
 async function load(){
  if(!ready)return;
  const selected=month.value,selectedVisibility=visibility.value,id=++serial;exportData=null;download.disabled=true;rows.replaceChildren();
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(selected)){loading=false;refresh.disabled=false;status.textContent='Choose a month.';rows.replaceChildren();return;}
  loading=true;refresh.disabled=true;status.textContent='Loading client work…';
  const list=clients.filter(client=>selectedVisibility==='all'||(selectedVisibility==='shared'?(client.visibility||'shared')==='shared':(client.visibility||'shared')!=='shared')).sort((a,b)=>a.name.localeCompare(b.name));const results=[],failures=[];let cursor=0;
  async function worker(){while(cursor<list.length){if(id!==serial)return;const client=list[cursor++];try{
   const response=await fetch(`/api/clients/${encodeURIComponent(client.slug)}/work-logs?month=${encodeURIComponent(selected)}`,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error('Could not load work');const data=await response.json();if(!Array.isArray(data.entries))throw Error('Invalid work-log response');
   const entries=data.entries.filter(entry=>entry.month===selected).sort((a,b)=>a.workedOn.localeCompare(b.workedOn)||String(a.id).localeCompare(String(b.id)));
   if(entries.length)results.push({client:{id:client.id,slug:client.slug,name:client.name,website:client.website||null},entries});
  }catch{failures.push(client.name);}}}
  await Promise.all(Array.from({length:Math.min(4,list.length)},worker));
  if(id!==serial)return;
  loading=false;refresh.disabled=false;
  if(failures.length){rows.replaceChildren();status.textContent=`Could not load work for ${failures.join(', ')}. Refresh to retry. Export is disabled until all entries load.`;return;}
  results.sort((a,b)=>a.client.name.localeCompare(b.client.name));
  const total=results.reduce((sum,g)=>sum+g.entries.length,0);
  exportData={schemaVersion:1,reportMonth:selected,visibility:selectedVisibility,generatedAt:new Date().toISOString(),source:'Leanne Digital client work logs',entryCount:total,clientCount:results.length,clients:results};
  rows.innerHTML=results.map(group=>`<tr class="client-work-group"><th scope="rowgroup" colspan="5">${esc(group.client.name)} <span>${group.entries.length} ${group.entries.length===1?'entry':'entries'}</span></th></tr>${group.entries.map(entry=>`<tr><td><time datetime="${esc(entry.workedOn)}">${esc(entry.workedOn)}</time></td><td>${esc(categoryNames[entry.category]||'Needs categorization')}</td><td>${esc(entry.title)}</td><td class="client-work-details">${esc(entry.details)}</td><td><span class="client-work-state" data-status="${esc(entry.status)}">${esc(labels[entry.status]||entry.status)}</span></td></tr>`).join('')}`).join('')||'<tr><td colspan="5" class="workspace-empty">No work-log entries for this month and visibility.</td></tr>';
  status.textContent=`${total} ${total===1?'entry':'entries'} across ${results.length} ${results.length===1?'client':'clients'} · Updated ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}. Refreshes every minute while this section is open.`;
  download.disabled=false;
 }
 visibility.addEventListener('change',load);month.addEventListener('change',load);refresh.addEventListener('click',load);
 download.addEventListener('click',()=>{if(!exportData)return;const blob=new Blob([JSON.stringify(exportData,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`leanne-digital-client-work-${exportData.reportMonth}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 window.addEventListener('workspace-data',event=>{clients=event.detail.clients||[];ready=true;if(active())load();});
 const onView=()=>{if(active()&&!loading)load();};
 window.addEventListener('hashchange',onView);window.addEventListener('workspace-view-change',onView);window.addEventListener('focus',onView);document.addEventListener('visibilitychange',onView);
 setInterval(onView,60000);
})();
