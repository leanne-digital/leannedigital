const RECURRING_TYPES = ['seo', 'aeo', 'maintenance', 'management'];
const RENEWAL_DAYS = 60;

function parseDate(value) {
    if (!value) return null;
    const date = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
}

function clientStart(client) {
    return parseDate(client.started) || parseDate(client.createdAt) || new Date();
}

function monthIndex(date) {
    return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function billedPeriods(start, now, cycle) {
    const months = Math.max(0, monthIndex(now) - monthIndex(start)) + 1;
    if (cycle === 'yearly') return Math.max(1, Math.ceil(months / 12));
    return Math.max(1, months);
}

function amountOf(service) {
    return Number(service?.amount) || 0;
}

export function isHostingClient(client) {
    const hosting = (client.services || []).find((service) => service.type === 'hosting');
    return Boolean(amountOf(hosting)) || client.hosting?.type === 'LDD' || Boolean(client.hosting?.lddHosted);
}

function recurringTypes(client) {
    const types = new Set(
        (client.services || [])
            .filter((service) => RECURRING_TYPES.includes(service.type) && amountOf(service))
            .map((service) => service.type)
    );
    if ((client.reports || []).length) types.add('seo');
    return [...types];
}

function recurringKind(client) {
    const types = recurringTypes(client);
    if (types.length >= 2) return 'combo';
    return types[0] || null;
}

function hostingStatus(nextBillDate, now) {
    if (!nextBillDate) return 'unbilled';
    const due = parseDate(nextBillDate);
    if (!due) return 'unbilled';
    const days = Math.round((due.getTime() - now.getTime()) / 86400000);
    if (days < 0) return 'overdue';
    if (days <= RENEWAL_DAYS) return 'due-soon';
    return 'upcoming';
}

export function hostingAccounts(clients, now = new Date()) {
    const rows = [];
    for (const client of clients) {
        const hosting = (client.services || []).find((service) => service.type === 'hosting');
        if (!hosting && !isHostingClient(client)) continue;
        const amount = amountOf(hosting);
        const cycle = hosting?.cycle === 'monthly' ? 'monthly' : 'yearly';
        const nextBillDate = hosting?.nextBillDate || '';
        rows.push({
            slug: client.slug,
            name: client.name,
            amount,
            cycle: amount ? cycle : '',
            lastBilled: hosting?.lastBilled || '',
            nextBillDate,
            status: hostingStatus(nextBillDate, now),
        });
    }
    rows.sort((a, b) => {
        if (!a.nextBillDate) return 1;
        if (!b.nextBillDate) return -1;
        return String(a.nextBillDate).localeCompare(String(b.nextBillDate));
    });
    return rows;
}

export function packageTotals(client) {
    let monthly = 0;
    let yearly = 0;
    for (const service of client.services || []) {
        const amount = amountOf(service);
        if (!amount) continue;
        if (service.cycle === 'yearly') yearly += amount;
        else monthly += amount;
    }
    const subtotal = monthly + yearly / 12;
    const discount = Number(client.discount) || 0;
    const tax = Number(client.taxAmount) || 0;
    const total = Math.round((Math.max(0, subtotal - discount) + tax) * 100) / 100;
    return {
        monthly,
        yearly,
        subtotal: Math.round(subtotal * 100) / 100,
        discount,
        tax,
        total,
    };
}

export function portalStats(clients, now = new Date()) {
    const accounts = hostingAccounts(clients, now);
    const renewals = accounts.filter((row) => row.status === 'overdue' || row.status === 'due-soon');
    let monthly = 0;
    let yearly = 0;
    let allTime = 0;
    const recurring = { seo: 0, aeo: 0, maintenance: 0, management: 0, combo: 0 };
    const byType = {
        hosting: 0,
        management: 0,
        seo: 0,
        aeo: 0,
        maintenance: 0,
    };

    for (const client of clients) {
        const start = clientStart(client);
        const bill = packageTotals(client);
        monthly += bill.total;
        yearly += bill.yearly;
        for (const service of client.services || []) {
            const amount = amountOf(service);
            if (!amount) continue;
            const cycle = service.cycle === 'yearly' ? 'yearly' : 'monthly';
            allTime += amount * billedPeriods(parseDate(service.lastBilled) || start, now, cycle);
            if (byType[service.type] != null) {
                byType[service.type] += cycle === 'yearly' ? amount / 12 : amount;
            }
        }
        const kind = recurringKind(client);
        if (kind) recurring[kind] += 1;
    }

    return {
        clients: clients.length,
        hosting: accounts.length,
        hostingAccounts: accounts,
        renewals,
        recurring,
        recurringClients: recurring.seo + recurring.aeo + recurring.maintenance + recurring.management + recurring.combo,
        totals: {
            monthly: Math.round(monthly * 100) / 100,
            yearly,
            annualized: Math.round(monthly * 12 * 100) / 100,
            allTime,
            managementMonthly: Math.round(byType.management * 100) / 100,
            hostingMonthly: Math.round(byType.hosting * 100) / 100,
            currency: 'CAD',
        },
    };
}
