const RECURRING_TYPES = ['seo', 'aeo', 'maintenance'];
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
            .filter((service) => RECURRING_TYPES.includes(service.type))
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

export function portalStats(clients, now = new Date()) {
    const renewals = [];
    let monthly = 0;
    let yearly = 0;
    let allTime = 0;
    const recurring = { seo: 0, aeo: 0, maintenance: 0, combo: 0 };

    for (const client of clients) {
        const start = clientStart(client);
        for (const service of client.services || []) {
            const amount = amountOf(service);
            if (!amount) continue;
            const cycle = service.cycle === 'yearly' ? 'yearly' : 'monthly';
            if (cycle === 'yearly') yearly += amount;
            else monthly += amount;
            allTime += amount * billedPeriods(parseDate(service.lastBilled) || start, now, cycle);

            if (service.type === 'hosting' && service.nextBillDate) {
                const due = parseDate(service.nextBillDate);
                if (!due) continue;
                const days = Math.round((due.getTime() - now.getTime()) / 86400000);
                if (days <= RENEWAL_DAYS) {
                    renewals.push({
                        slug: client.slug,
                        name: client.name,
                        amount,
                        cycle,
                        nextBillDate: service.nextBillDate,
                        overdue: days < 0,
                        days,
                    });
                }
            }
        }
        const kind = recurringKind(client);
        if (kind) recurring[kind] += 1;
    }

    renewals.sort((a, b) => String(a.nextBillDate).localeCompare(String(b.nextBillDate)));

    return {
        clients: clients.length,
        hosting: clients.filter(isHostingClient).length,
        renewals,
        recurring,
        recurringClients: recurring.seo + recurring.aeo + recurring.maintenance + recurring.combo,
        totals: {
            monthly,
            yearly,
            annualized: monthly * 12 + yearly,
            allTime,
            currency: 'CAD',
        },
    };
}
