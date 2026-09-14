import { readClientRecord, saveClientRecord } from './client-credentials.mjs';

const admin = {role:'staff'};
const accounts = [
    ['domain','domain_provider','domain_url'],
    ['hosting','hosting_provider','hosting_url'],
    ['email_hosting','email_hosting_provider','email_hosting_url'],
    ['platform','platform_name','platform_url'],
    ['ldd_portal',null,'ldd_litespeed_portal_url'],
    ...Array.from({length:10},(_,i)=>[`other${i+1}`,`other${i+1}_name`,`other${i+1}_url`]),
];

export function credentialInventory(slug) {
    const {available,fields}=readClientRecord(slug,admin);
    const items=accounts.filter(([key,label,url])=>[fields[label],fields[url],fields[`${key}_username`],fields[`${key}_password`]].some(Boolean))
        .map(([slot,label,url])=>({slot,name:fields[label] || slot,url:fields[url] || '',hasUsername:Boolean(fields[`${slot}_username`]),hasPassword:Boolean(fields[`${slot}_password`])}));
    return {available,client:slug,count:items.length,accounts:items,
        ...(available ? {} : {message:'No private record exists for this client on this server. Import existing credentials or create a credential; this does not mean all slots are occupied.'})};
}

export function deleteCredential(slug, slot) {
    const definition = accounts.find(([key]) => key === slot);
    if (!definition) throw Object.assign(new Error('Unknown account slot'), {status:400});
    if (!credentialInventory(slug).accounts.some(account => account.slot === slot)) throw Object.assign(new Error('Credential not found'), {status:404});
    const [,label,url] = definition;
    saveClientRecord(slug, Object.fromEntries([label,url,`${slot}_username`,`${slot}_password`].filter(Boolean).map(key => [key,''])), admin);
    return {deleted:true,client:slug,slot};
}

export function saveCredential(slug,{slot='software',name,url,username,password}) {
    const {fields}=readClientRecord(slug,admin);
    if(slot==='software') {
        if(!name?.trim()) throw Object.assign(new Error('A software account name is required'),{status:400});
        const software=accounts.filter(([key])=>key.startsWith('other'));
        slot=software.find(([,label])=>String(fields[label]||'').toLowerCase()===name.toLowerCase())?.[0]
            || software.find(([key,label,urlKey])=>![fields[label],fields[urlKey],fields[`${key}_username`],fields[`${key}_password`]].some(Boolean))?.[0];
        if(!slot) throw Object.assign(new Error('All software slots are occupied. Choose an existing slot explicitly.'),{status:400});
    }
    const definition=accounts.find(([key])=>key===slot);
    if(!definition) throw Object.assign(new Error('Unknown account slot'),{status:400});
    const [,label,urlKey]=definition;
    const patch=Object.fromEntries([[label,name],[urlKey,url],[`${slot}_username`,username],[`${slot}_password`,password]].filter(([key,value])=>key && value!==undefined));
    saveClientRecord(slug,patch,admin);
    return {saved:true,client:slug,slot};
}
