import { readClientRecord, saveClientRecord } from './client-credentials.mjs';

const admin = {role:'staff'};
const fixedAccounts = [
    ['domain','domain_provider','domain_url'],
    ['hosting','hosting_provider','hosting_url'],
    ['email_hosting','email_hosting_provider','email_hosting_url'],
    ['platform','platform_name','platform_url'],
    ['ldd_portal',null,'ldd_litespeed_portal_url'],
];

function accountsFor(fields) {
 const slots=[...new Set(Object.keys(fields).map(key=>key.match(/^(other[1-9]\d*)_(?:name|url|username|password|notes)$/)?.[1]).filter(Boolean))].sort((a,b)=>Number(a.slice(5))-Number(b.slice(5)));
 return [...fixedAccounts,...slots.map(slot=>[slot,`${slot}_name`,`${slot}_url`])];
}
function definitionFor(slot) {return fixedAccounts.find(([key])=>key===slot) || (/^other[1-9]\d*$/.test(slot)?[slot,`${slot}_name`,`${slot}_url`]:null);}
export function credentialInventory(slug) {
    const {available,fields}=readClientRecord(slug,admin);
    const items=accountsFor(fields).filter(([key,label,url])=>[fields[label],fields[url],fields[`${key}_username`],fields[`${key}_password`],fields[`${key}_notes`]].some(Boolean))
        .map(([slot,label,url])=>({slot,name:fields[label] || slot,url:fields[url] || '',hasUsername:Boolean(fields[`${slot}_username`]),hasPassword:Boolean(fields[`${slot}_password`])}));
    return {available,client:slug,count:items.length,accounts:items,
        ...(available ? {} : {message:'No private record exists for this client on this server. Import existing credentials or create a credential; this does not mean all slots are occupied.'})};
}

export function deleteCredential(slug, slot) {
    const definition = definitionFor(slot);
    if (!definition) throw Object.assign(new Error('Unknown account slot'), {status:400});
    if (!credentialInventory(slug).accounts.some(account => account.slot === slot)) throw Object.assign(new Error('Credential not found'), {status:404});
    const [,label,url] = definition;
    saveClientRecord(slug, Object.fromEntries([label,url,`${slot}_username`,`${slot}_password`,...(slot.startsWith('other')?[`${slot}_notes`]:[])].filter(Boolean).map(key => [key,''])), admin);
    return {deleted:true,client:slug,slot};
}

export function saveCredential(slug,{slot='software',name,url,username,password,notes}) {
    const {fields}=readClientRecord(slug,admin);
    if(slot==='software') {
        if(!name?.trim()) throw Object.assign(new Error('A software account name is required'),{status:400});
        const software=accountsFor(fields).filter(([key])=>key.startsWith('other'));
        slot=software.find(([,label])=>String(fields[label]||'').trim().toLowerCase()===name.trim().toLowerCase())?.[0];
        if(!slot){let number=1;while(['name','url','username','password','notes'].some(key=>fields[`other${number}_${key}`]))number++;slot=`other${number}`;}

    }
    const definition=definitionFor(slot);
    if(!definition) throw Object.assign(new Error('Unknown account slot'),{status:400});
    const [,label,urlKey]=definition;
    const patch=Object.fromEntries([[label,name],[urlKey,url],[`${slot}_username`,username],[`${slot}_password`,password],...(slot.startsWith('other')?[[`${slot}_notes`,notes]]:[])].filter(([key,value])=>key && value!==undefined));
    saveClientRecord(slug,patch,admin);
    return {saved:true,client:slug,slot};
}
