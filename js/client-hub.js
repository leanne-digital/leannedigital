(() => {
    if (!document.body.hasAttribute('data-client-hub')) return;
    const $ = s => document.querySelector(s);
    const panels = [...document.querySelectorAll('[data-hub-panel]')];
    let staff = false;
    function select() {
        let id = location.hash.slice(1) || 'overview';
        if (id === 'credentials' && !staff) id = 'overview';
        if (!panels.some(p => p.id === id)) id = 'overview';
        panels.forEach(p => p.hidden = p.id !== id);
        document.querySelectorAll('.client-hub-nav a').forEach(a => a.setAttribute('aria-current', a.hash === '#' + id ? 'page' : 'false'));
    }
    addEventListener('hashchange', select); select();
    const account = (prefix, label, provider) => [label, [[provider, 'Provider'], [`${prefix}_url`, 'Login URL'], [`${prefix}_username`, 'Username'], [`${prefix}_password`, 'Password']]];
    const groups = [
        ['Contact info', [['company_name','Company name'],['contact_name','Contact name'],['email','Email'],['cell_phone','Cell phone'],['client_location','Location']], 'overview'],
        ['Branding and assets', [...['font','color'].flatMap(p => ['primary','secondary','accent','text'].map(k => [`${p}_${k}`, `${p === 'font' ? 'Font' : 'Color'} ${k}`])), ['figma_url','Figma URL'],['site_logo_url','Logo URL'],['notes','Notes']], 'overview'],
        [...account('domain','Domain','domain_provider'),'credentials'],
        [...account('hosting','Web hosting provider','hosting_provider'),'credentials'],
        ['Email', [...account('email_hosting','Email','email_hosting_provider')[1],['email_hosting_other','Other provider']], 'credentials'],
        ['Website platform', [...account('platform','Platform','platform_name')[1],['platform_other','Other platform']], 'credentials'],
        ['LD hosting account', [['ldd_litespeed_portal_url','LiteSpeed portal URL'],['ldd_portal_username','Portal username'],['ldd_portal_password','Portal password']], 'credentials'],
        ...Array.from({length:10},(_,i)=>[`Software ${i+1}`, [['name','Service name'],['url','Login URL'],['username','Username'],['password','Password']].map(([k,l])=>[`other${i+1}_${k}`,l]), 'credentials']),
        ['Hosting and billing', [['ldd_hosting_type','Hosting type'],['ldd_billing_cycle','Billing cycle'],['ldd_amount','Amount'],['ldd_tax_rate','Tax rate'],['ldd_last_billed','Billing start date'],['ldd_next_bill_date','Next bill date']], 'hosting'],
    ];
    async function boot({api,user}) {
        if (user?.role !== 'staff' || staff) return;
        staff = true;
        $('[data-admin-tab]').hidden = false;
        $('[data-admin-switch]').hidden = false;
        select();
        const slug = document.body.dataset.clientSlug;
        const containers = Object.fromEntries(['overview','hosting','credentials'].map(k=>[k,$(`[data-private-${k}]`)]));
        const status = document.createElement('p'); status.setAttribute('role','status'); containers.credentials.append(status);
        status.textContent='Loading saved client record…';
        try {
            const data=await api.getSystemRecord(slug);
            status.textContent=data.available ? '' : 'The original client record has not been imported on this server yet.';
            const fields=data.fields || {};
            const updateCount=()=>{
                $('[data-credential-count]').textContent=String(groups.filter(([,names,target])=>target==='credentials' && names.some(([key])=>String(fields[key] || '').trim())).length);
            };
            if(data.available) updateCount();
            const emptySoftware=[];
            for (const [title, names, target] of groups) {
                if (!containers[target]) continue;
                const form=document.createElement('form'); form.className='client-record-form';
                const heading=document.createElement('h3'); heading.textContent=title; form.append(heading);
                const grid=document.createElement('div'); grid.className='client-record-grid'; form.append(grid);
                for (const [key,label] of names) {
                    const wrap=document.createElement('label'); wrap.textContent=label;
                    const input=document.createElement(key==='notes'?'textarea':'input');
                    input.name=key; input.value=fields[key] || '';
                    if(key!=='notes') input.type=key.endsWith('_password')?'password':'text';
                    input.autocomplete='off'; wrap.append(input);
                    if(key.endsWith('_url')) {
                        const link=document.createElement('a');link.textContent='Open';link.target='_blank';link.rel='noopener noreferrer';
                        const update=()=>{try{const u=new URL(input.value);if(!['http:','https:'].includes(u.protocol))throw Error();link.href=u.href;link.hidden=false;}catch{link.removeAttribute('href');link.hidden=true;}};
                        input.addEventListener('input',update);update();wrap.append(link);
                    }
                    grid.append(wrap);
                }
                const save=document.createElement('button');save.type='submit';save.className='ld-btn';save.textContent='Save '+title.toLowerCase();
                const message=document.createElement('p');message.setAttribute('role','status');form.append(save,message);
                form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{const saved=await api.saveSystemRecord(slug,Object.fromEntries(new FormData(form)));Object.assign(fields,saved.fields);updateCount();message.textContent='Saved.';}catch(error){message.textContent=error.message || 'Could not save. Your changes are still in the form.';}finally{save.disabled=false;}});
                if (target === 'credentials') {
                    const details=document.createElement('details');details.className='client-record-account';
                    const summary=document.createElement('summary');
                    const labelKey=names.find(([key])=>key.endsWith('_name') || key.endsWith('_provider'))?.[0];
                    summary.textContent=fields[labelKey] || title;
                    if (title.startsWith('Software ') && !names.some(([key])=>fields[key])) {
                        details.hidden=true;emptySoftware.push(details);
                    }
                    details.append(summary,form);containers[target].append(details);
                } else containers[target].append(form);
            }
            if(emptySoftware.length) {
                const add=document.createElement('button');add.type='button';add.className='ld-btn';add.textContent='Add software account';
                add.addEventListener('click',()=>{const details=emptySoftware.shift();details.hidden=false;details.open=true;details.querySelector('input').focus();if(!emptySoftware.length)add.hidden=true;});
                containers.credentials.append(add);
            }
        } catch(error) { status.textContent=error.message === 'Not found' ? 'The credentials service is not available on this deployment yet. Update and restart the portal API to enable it.' : 'Could not load the private client record. '+(error.message || ''); }
    }
    if(window.__LD_PORTAL__)boot(window.__LD_PORTAL__);
    document.addEventListener('ld-portal-ready',e=>boot(e.detail));
})();
