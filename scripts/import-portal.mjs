import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SQL = 'C:\\Users\\gburn\\Downloads\\jiw_clients.sql';
const OUT_FILE = path.join(ROOT, 'data', 'portal-clients.json');

const SKIP_COMPANIES = new Set(['leanne digital', 'lucentseo hosting']);

const SLUG_ALIASES = {
    'oatley-vigmond-personal-injury-firm': 'oatley-vigmond',
};

const SECRET_COLUMNS = new Set([
    'domain_password',
    'hosting_password',
    'platform_password',
    'email_hosting_password',
    'ldd_portal_password',
    'ldd_portal_username',
    'domain_username',
    'hosting_username',
    'platform_username',
    'email_hosting_username',
    ...Array.from({ length: 10 }, (_, i) => `other${i + 1}_password`),
    ...Array.from({ length: 10 }, (_, i) => `other${i + 1}_username`),
]);

function decode(value) {
    if (value == null) return null;
    return String(value)
        .replace(/&amp;/g, '&')
        .replace(/&#8217;/g, "'")
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .trim();
}

function emptyToNull(value) {
    if (value == null) return null;
    const text = decode(value);
    return text === '' ? null : text;
}

function slugify(name) {
    const slug = String(name || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return SLUG_ALIASES[slug] || slug;
}

function parseTuple(sql, start) {
    const fields = [];
    let i = start + 1;
    let current = '';
    let inString = false;

    while (i < sql.length) {
        const char = sql[i];
        if (inString) {
            if (char === '\\' && sql[i + 1]) {
                current += sql[i + 1];
                i += 2;
                continue;
            }
            if (char === "'" && sql[i + 1] === "'") {
                current += "'";
                i += 2;
                continue;
            }
            if (char === "'") {
                inString = false;
                i += 1;
                continue;
            }
            current += char;
            i += 1;
            continue;
        }
        if (char === "'") {
            inString = true;
            i += 1;
            continue;
        }
        if (char === ',') {
            fields.push(normalizeField(current.trim()));
            current = '';
            i += 1;
            continue;
        }
        if (char === ')') {
            fields.push(normalizeField(current.trim()));
            return { fields, next: i + 1 };
        }
        current += char;
        i += 1;
    }
    throw new Error('Unclosed SQL tuple');
}

function normalizeField(value) {
    if (value === 'NULL' || value === '') return null;
    if (/^-?\d+$/.test(value)) return Number(value);
    if (/^-?\d+\.\d+$/.test(value)) return Number(value);
    return value;
}

function parseInsert(sql) {
    const header = sql.match(/INSERT INTO `jiw_clients` \(([^)]+)\) VALUES/i);
    if (!header) throw new Error('Could not find jiw_clients INSERT');
    const columns = header[1].split(',').map((col) => col.replace(/`/g, '').trim());
    const valuesStart = sql.indexOf('VALUES', header.index) + 'VALUES'.length;
    const rows = [];
    let i = valuesStart;
    while (i < sql.length) {
        while (i < sql.length && sql[i] !== '(') {
            if (sql.startsWith(';\n', i) || sql[i] === ';') return { columns, rows };
            i += 1;
        }
        if (i >= sql.length) break;
        const parsed = parseTuple(sql, i);
        const row = {};
        columns.forEach((column, index) => {
            row[column] = parsed.fields[index] ?? null;
        });
        rows.push(row);
        i = parsed.next;
    }
    return { columns, rows };
}

function publicWebsite(row) {
    const candidates = [row.platform_url, row.domain_url];
    for (const raw of candidates) {
        const url = emptyToNull(raw);
        if (!url) continue;
        if (/godaddy|siteground|hostgator|dreamhost|enom|sso\.|wp-admin|login\.|my\.account|cloud\.digitalocean|hosting\.leannedigital|figma\.com/i.test(url)) {
            continue;
        }
        if (/^https?:\/\//i.test(url) || /^[\w.-]+\.[a-z]{2,}/i.test(url)) {
            return url.startsWith('http') ? url : `https://${url}`;
        }
    }
    return null;
}

function sanitizeRow(row) {
    const name = emptyToNull(row.company_name);
    if (!name || SKIP_COMPANIES.has(name.toLowerCase())) return null;

    const amount = row.ldd_amount == null ? null : Number(row.ldd_amount);
    const cycle = emptyToNull(row.ldd_billing_cycle);
    const services = [];
    if (amount) {
        services.push({
            type: 'hosting',
            label: 'LDD Hosting',
            amount,
            cycle: cycle === 'Monthly' ? 'monthly' : 'yearly',
            taxRate: row.ldd_tax_rate == null ? null : Number(row.ldd_tax_rate),
            lastBilled: emptyToNull(row.ldd_last_billed),
            nextBillDate: emptyToNull(row.ldd_next_bill_date),
        });
    }

    return {
        id: row.id,
        slug: slugify(name),
        name,
        contactName: emptyToNull(row.contact_name),
        email: emptyToNull(row.email),
        location: emptyToNull(row.client_location),
        website: publicWebsite(row),
        platform: emptyToNull(row.platform_name),
        hosting: {
            type: emptyToNull(row.ldd_hosting_type) || 'External',
            provider: emptyToNull(row.hosting_provider),
            lddHosted: Boolean(emptyToNull(row.ldd_litespeed_portal_url)),
        },
        currency: 'CAD',
        services,
        createdAt: emptyToNull(row.created_at),
    };
}

function main() {
    const sqlPath = process.argv[2] || DEFAULT_SQL;
    if (!fs.existsSync(sqlPath)) {
        throw new Error(`SQL dump not found: ${sqlPath}`);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const { rows } = parseInsert(sql);
    const clients = rows.map(sanitizeRow).filter(Boolean);
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(clients, null, 2)}\n`, 'utf8');
    console.log(`Imported ${clients.length} portal clients (credentials omitted).`);
    for (const client of clients) {
        const billed = client.services[0];
        const bill = billed ? `${billed.amount}/${billed.cycle}` : 'no hosting retainer';
        console.log(` - ${client.name}: ${bill}`);
    }
}

main();
