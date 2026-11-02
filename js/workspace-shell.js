(() => {
  const reportNames = {
    'davis-window-and-door': 'AEO and Technical SEO Report',
    'gbt-logistics': 'Technical SEO and AEO Report',
    'oatley-vigmond': 'Technical SEO and AEO Report',
    'melissa-jean-art': 'Technical SEO Report',
    'shift-physiotherapy': 'Technical SEO, GEO, AEO and Content Creation Report',
    'sierra-electrical': 'Technical SEO, GEO, AEO and Content Creation Report'
  };
  const reportMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function reportMonth(report) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(report.monthKey || '')) return report.monthKey;
    const slug = String(report.slug || '').toLowerCase();
    for (let i=0;i<reportMonths.length;i++) {
      const match=slug.match(new RegExp('-'+reportMonths[i].toLowerCase()+'-(\\d{4})$'));
      if(match)return match[1]+'-'+String(i+1).padStart(2,'0');
    }
    return '';
  }
  window.LDReportNaming = {
    month: reportMonth,
    title(client, report) {
      const key=reportMonth(report), type=reportNames[client.slug];
      if (!key || !type) return report.title || report.slug;
      const [year,month]=key.split('-');
      return reportMonths[Number(month)-1]+' '+year+' - '+type;
    },
    newest(a,b) { return reportMonth(b).localeCompare(reportMonth(a)); }
  };

  const navIcons = {
    overview: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    projects: '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 12a24 24 0 0 0 18 0M12 11v4"/>',
    'seo-clients': '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6M7 12l2-3 2 2 2-4"/>',
    'hosting-clients': '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5"/>',
    'maintenance-clients': '<path d="M14.5 6.5a5 5 0 0 0-6.3 6.3L3 18a2.1 2.1 0 0 0 3 3l5.2-5.2a5 5 0 0 0 6.3-6.3L14 13l-3-3 3.5-3.5Z"/>',
    'management-clients': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M8 8v13M6 5.5h.01M9 5.5h.01M12 12h5M12 16h3"/>',
    credentials: '<circle cx="8" cy="8" r="5"/><path d="m11.5 11.5 9 9M17 16l3-3M14 13l3-3M6.5 6.5h.01"/>',
    'client-work': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM8 12l2 2 5-5M8 17h8"/>',
    reports: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 17v-3M12 17v-5M16 17v-2"/>',
    portfolio: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 16-6-6L3 21"/>'
  };
  function navIcon(id) {
    if (id === 'google') return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A6 6 0 0 1 12 5.96Z"/></svg>';
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + navIcons[id] + '</svg>';
  }
  window.LDWorkspaceIcon = navIcon;
  const routes = [
    ['Workspace', [['dashboard','Overview','⌂'],['overview','Clients','▤']]],
    ['Connect', [['google','Google Platforms','♧']]],
    ['Manage', [['client-work','Client Work',''],['projects','Projects','▦'],['seo-clients','SEO clients','⌁'],['hosting-clients','Hosting','▱'],['maintenance-clients','Maintenance','◇'],['management-clients','Site management','▧'],['credentials','Credentials','⚿'],['reports','Reports','▥'],['portfolio','Portfolio','▨']]],
  ];
  const href = id => id === 'google' ? '/google-platforms/' : '/clients/#' + id;
  const google = location.pathname.startsWith('/google-platforms');
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = `<a class="brand" href="/clients/"><img class="workspace-brand-icon" src="/assets/icons/favicon-192x192.png" alt="" width="38" height="38"><span>leanne digital<span class="brand-sub">CLIENT WORKSPACE</span></span></a><nav aria-label="Workspace">${routes.map(([label,items])=>`<p>${label}</p>${items.map(([id,title,icon])=>`<a href="${href(id)}" data-workspace-nav="${id}"><span aria-hidden="true">${navIcon(id)}</span>${title}</a>`).join('')}`).join('')}</nav><div class="sidebar-note"><strong>Your clients. Connected.</strong><p>Clients, projects and Google accounts in one workspace.</p><a href="/clients/#new-client">Add a client <span aria-hidden="true">↗</span></a></div><a class="profile" href="/profile/"><span class="avatar">LD</span><span>Leanne Digital<small>Staff workspace</small></span><span aria-hidden="true">↗</span></a><button id="workspace-logout" class="text-button">Sign out</button>`;
  document.querySelector('#workspace-logout')?.addEventListener('click',async()=>{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});if(r.ok)location.assign('/login/');});
  function sync() {
    const id = location.pathname.startsWith('/profile') ? 'profile' : google ? 'google' : location.hash.slice(1) || 'overview';
    document.querySelectorAll('[data-workspace-nav]').forEach(a=>{if(a.dataset.workspaceNav===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    const title = routes.flatMap(r=>r[1]).find(r=>r[0]===id)?.[1] || (id==='new-client' ? 'Client details' : id==='profile' ? 'Your profile' : 'Workspace');
    const heading=document.querySelector('.topbar h1');if(heading)heading.textContent=title;
    document.title=title+' | Leanne Digital';
  }
  addEventListener('workspace-view-change',sync);
  addEventListener('hashchange',()=>{sync();document.body.classList.remove('nav-open');});sync();
  if(!google)document.querySelector('#sidebar-toggle')?.addEventListener('click',e=>{const mobile=matchMedia('(max-width:700px)').matches;document.body.classList.toggle(mobile?'nav-open':'nav-collapsed');e.currentTarget.setAttribute('aria-expanded',String(document.body.classList.contains(mobile?'nav-open':'nav-collapsed')));});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('nav-open');});
})();

(() => { if (!document.querySelector('.topbar')) return; const script=document.createElement('script'); script.src='/js/workspace-account.js?v=bio-20261102'; document.body.append(script); })();
