(() => {
    const $=s=>document.querySelector(s);
    async function call(tool,input={}){const response=await fetch('/api/editor/call'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,input})});const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load your website.');return result;}
    const examples={
        'Text and headings':'“Update the first paragraph under Our Services.” Or: “Change this H1 to H3, keeping its visual size.”',
        'Images and backgrounds':'“Replace this photo, set its alt text, and move the crop to the left.” Or: “Use this image as the section background with a dark overlay.”',
        'Buttons and links':'“Change this button to Book a call and update its destination.”',
        'Colours and typography':'“Make only this button brand red, with white text.”',
        'Alignment and spacing':'“Centre this section’s text on mobile. Keep desktop unchanged.” Or: “Reduce this section’s padding to 24 pixels.”',
        'Page sections':'“Move testimonials to second from the bottom.”',
        'Blog posts':'“Create a draft post with these three images.” Or: “Change the displayed publication date to October 1 without publishing it.”',
        'SEO':'“Update this page’s search title and description.”',
        'Preview and publish':'“Show me exactly what will change before I publish.”',
        'History and undo':'“Prepare a draft restoring the previous version.”',
    };
    function line(parent,className){const node=document.createElement('div');node.className=className;parent.append(node);return node;}
    async function boot(){
        try {
            const [caps,pages,history]=await Promise.all([call('editor_capabilities'),call('editor_list_pages'),call('editor_list_revisions')]);
            $('#status').textContent='';
            const note=document.querySelector('header .editor-note');note.textContent=caps.publicationEnvironment==='production'?'Drafts stay private. Approved publishing updates your live website.':'Private preview: publishing creates a staging release and does not change the live website.';
            const workflow=document.createElement('section');workflow.innerHTML='<h2>Your editing workflow</h2>';document.querySelector('header').after(workflow);
            const available=new Set(caps.tools.map(t=>t.name));
            for(const [tool,label,prompt] of [
                ['editor_prepare_changes','Prepare an edit','Inspect the page and prepare my requested edit without changing the live website.'],
                ['editor_preview_changes','Preview','Show the before-and-after preview of this exact change.'],
                ['editor_apply_draft','Save draft','Save the reviewed change as a draft.'],
                ['editor_publish_changes','Publish','Preview the saved draft again, then ask me to approve publishing this exact version.'],
                ['editor_schedule_post','Schedule or reschedule','Schedule this reviewed post for [date and time] in America/Toronto. Confirm the daylight-saving offset and show the scheduled time.'],
                ['editor_cancel_schedule','Cancel schedule','Show this post’s schedule and cancel its pending publication.'],
                ['editor_prepare_changes','Return a post to draft','Prepare taking this published post back to draft. Show the preview before I approve publishing the removal.'],
                ['editor_prepare_changes','Republish a post','Prepare marking this draft post published again, then show the preview.'],
                ['editor_restore_revision','Restore','Show the history and prepare a draft restoring revision [number].']
            ]){if(!available.has(tool)||['Return a post to draft','Republish a post'].includes(label)&&!caps.groups.includes('Blog posts'))continue;const row=line(workflow,'capability-row'),heading=document.createElement('h3'),text=document.createElement('p');heading.textContent=label;text.textContent=prompt;row.append(heading,text);}
            for(const group of caps.groups){const row=line($('#capability-list'),'capability-row'),heading=document.createElement('h3'),description=document.createElement('p');heading.textContent=group;description.textContent=caps.role==='viewer'?'Ask your assistant to inspect this content. Editing requires an agency-issued editor role.':group==='Preview and publish'&&caps.role==='editor'?'Save a draft and ask your publisher to review it.':examples[group];row.append(heading,description);}
            if(!pages.pages.length)$('#page-list').textContent='No pages have been enabled by your agency yet.';
            for(const page of pages.pages){const row=line($('#page-list'),'page-row'),label=document.createElement('span'),button=document.createElement('button');label.textContent=page.title+' — '+(page.state==='published'?'included in release':page.state)+(page.hasUnpublishedChanges?' · draft changes pending':'');button.textContent='Inspect page';button.onclick=async()=>{button.disabled=true;try{const result=await call('editor_get_page',{pageId:page.id});$('#page-details').hidden=false;$('#page-details').replaceChildren();const title=document.createElement('h3');title.textContent=result.title;const list=document.createElement('ol');for(const section of result.nodes.filter(n=>n.region==='main'&&n.type==='section'&&!n.parentId)){const item=document.createElement('li');item.textContent=section.label+(section.hidden?' (hidden)':'');list.append(item);}$('#page-details').append(title,list);$('#page-details').scrollIntoView({block:'nearest'});}catch(e){$('#status').textContent=e.message;}finally{button.disabled=false;}};row.append(label,button);}
            for(const revision of history.revisions.slice(0,10)){const row=line($('#history-list'),'history-row');row.textContent=`Revision ${revision.revision} · ${revision.action} · ${new Date(revision.at).toLocaleString()} · ${revision.actor}`;}
            if(available.has('editor_list_schedules')){const schedules=await call('editor_list_schedules'),section=document.createElement('section');section.innerHTML='<h2>Publication schedules</h2><p>Times use America/Toronto, including daylight saving. A past displayed date never publishes a post. Schedules must be in the future; overdue approved jobs run after a restart.</p>';for(const job of schedules.schedules){const row=line(section,'history-row');row.textContent=`${job.localTime} · ${job.state}${job.error?' · needs a fresh review: '+job.error:''}`;}if(!schedules.schedules.length){const p=document.createElement('p');p.textContent='No publications scheduled.';section.append(p);}workflow.after(section);}
        }catch(e){$('#status').textContent=e.message+' Sign in at /editor/login or contact your agency.';}
    }
    boot();
})();
