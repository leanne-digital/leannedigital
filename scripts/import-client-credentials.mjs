import fs from 'node:fs';
import path from 'node:path';
import { parseInsert, slugify } from './import-portal.mjs';
import { credentialFile, recordFields } from '../server/client-credentials.mjs';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/import-client-credentials.mjs /private/path/jiw_clients.sql');
const file = credentialFile();
const records = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { clients: {} };
let clients = 0, count = 0;
records.profiles ||= {};
for (const row of parseInsert(fs.readFileSync(input, 'utf8')).rows) {
    const slug = slugify(row.company_name);
    if (!slug) continue;
    if (!Object.hasOwn(records.profiles, slug)) records.profiles[slug] = Object.fromEntries(recordFields.map(key => [key, String(row[key] ?? '')]));
    const groups = [
        ['domain', 'Domain registrar', 'domain_provider'],
        ['hosting', 'Web hosting', 'hosting_provider'],
        ['platform', 'Website platform', 'platform_name'],
        ['email_hosting', 'Email hosting', 'email_hosting_provider'],
        ...Array.from({ length: 10 }, (_, i) => [`other${i + 1}`, 'Software', `other${i + 1}_name`]),
    ];
    const items = groups.map(([prefix, kind, labelKey]) => ({
        kind, label: String(row[labelKey] || ''), url: String(row[`${prefix}_url`] || ''),
        username: String(row[`${prefix}_username`] || ''), password: String(row[`${prefix}_password`] || ''),
    })).filter(r => r.label || r.url || r.username || r.password);
    // Keep existing migrated clients intact on repeated imports.
    if (items.length && !Object.hasOwn(records.clients, slug)) {
        records.clients[slug] = items;
        clients++; count += items.length;
    }
}
fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
fs.writeFileSync(file, JSON.stringify(records), { mode: 0o600 });
fs.chmodSync(file, 0o600);
console.log(`Imported ${count} system records for ${clients} clients into the private runtime store. No credentials printed.`);
