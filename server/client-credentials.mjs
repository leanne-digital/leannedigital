import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultFile = fileURLToPath(new URL('../../.ld-private/client-credentials.json', import.meta.url));
export const recordFields = [
    'email','contact_name','company_name','cell_phone','client_location',
    ...['domain','hosting','platform','email_hosting'].flatMap(p => ['url','username','password'].map(k => `${p}_${k}`)),
    'domain_provider','hosting_provider','platform_name','platform_other','email_hosting_provider','email_hosting_other',
    'ldd_litespeed_portal_url','ldd_portal_username','ldd_portal_password','ldd_billing_cycle','ldd_amount','ldd_tax_rate','ldd_last_billed','ldd_next_bill_date','ldd_hosting_type',
    ...Array.from({length:10},(_,i)=>['name','url','username','password'].map(k=>`other${i+1}_${k}`)).flat(),
    ...['font','color'].flatMap(p=>['primary','secondary','accent','text'].map(k=>`${p}_${k}`)),
    'figma_url','site_logo_url','notes',
];
export function readClientRecord(slug, user) {
    if (user?.role !== 'staff') throw Object.assign(new Error('Forbidden'), {status:403});
    const file = credentialFile();
    if (!fs.existsSync(file)) return {available:false, fields:{}};
    const data = JSON.parse(fs.readFileSync(file,'utf8'));
    return {available:true, fields:data.profiles?.[slug] || {}};
}
export function saveClientRecord(slug, fields, user) {
    if (user?.role !== 'staff') throw Object.assign(new Error('Forbidden'), {status:403});
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw Object.assign(new Error('Invalid fields'), {status:400});
    const file=credentialFile();
    const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{clients:{},profiles:{}};
    data.profiles ||= {};
    const previous=data.profiles[slug] || {};
    for (const [key,value] of Object.entries(fields)) {
        if (!recordFields.includes(key) || typeof value !== 'string' || value.length>20000) throw Object.assign(new Error('Invalid field'),{status:400});
        previous[key]=value;
    }
    data.profiles[slug]=previous;
    fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
    const temp=file+'.tmp';
    fs.writeFileSync(temp,JSON.stringify(data),{mode:0o600});
    fs.renameSync(temp,file);
    return {available:true,fields:previous};
}
export function credentialFile() {
    return path.resolve(process.env.LD_CREDENTIALS_FILE || defaultFile);
}
