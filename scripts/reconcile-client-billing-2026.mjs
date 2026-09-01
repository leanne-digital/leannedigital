import { createClient, getClient, updateClient } from './client-store.mjs';
import { createClientProject, loadClientProjects, updateClientProject } from './client-project-store.mjs';

const annual = (type, amount, label) => ({ type, amount, cycle: 'yearly', label });
const monthly = (type, amount, label) => ({ type, amount, cycle: 'monthly', label });
const included = (type, label, cycle = 'monthly') => ({ type, cycle, label });

const clients = [
    { slug: 'ckf', name: 'CKF Inc.', services: [annual('hosting', 600, 'Hosting + Maintenance Bundle'), included('maintenance', 'Hosting + Maintenance Bundle', 'yearly')], notes: 'Bundle includes hosting and maintenance' },
    { slug: 'cuttermasters', name: 'Cuttermasters', services: [monthly('maintenance', 75, 'Website Maintenance')], notes: 'Not found in current invoice export' },
    { slug: 'davis-window-and-door', name: 'Davis Window & Door', services: [monthly('maintenance', 75, 'Website Maintenance'), monthly('aeo', 350, 'Technical SEO & AEO')], notes: 'Maintenance tracked separately from Technical SEO/AEO' },
    { slug: 'effy-blue', name: 'Effy Blue', services: [monthly('maintenance', 30, 'Website Maintenance')], notes: 'Delinquent' },
    { slug: 'floco-decking-systems', name: 'FLOCO / Floco Decking Systems', services: [monthly('maintenance', 75, 'Website Maintenance')] },
    { slug: 'mth-landscaping', name: 'MTH Landscaping', services: [annual('hosting', 400, 'Hosting + Maintenance Bundle'), included('maintenance', 'Hosting + Maintenance Bundle', 'yearly')], notes: 'Bundle includes hosting and maintenance' },
    { slug: 'mulchr', name: 'Mulchr', services: [monthly('maintenance', 75, 'Website Maintenance')], notes: 'Delinquent' },
    { slug: 'oatley-vigmond', name: 'Oatley Vigmond', services: [monthly('maintenance', 125, 'Website Maintenance'), monthly('aeo', 425, 'Technical SEO') ] },
    { slug: 'sd-accounting', name: 'S+D Accounting', services: [annual('hosting', 250, 'Website Hosting'), monthly('maintenance', 40, 'Website Maintenance')], notes: 'Paid in full for 2026' },
    { slug: 'stratapath', name: 'Stratapath', services: [monthly('maintenance', 50, 'Website Maintenance')] },
    { slug: 'ti-yende-movers-and-transportation', name: 'Ti-Yende Movers', services: [included('maintenance', 'Website Maintenance', 'yearly')], notes: 'Paid in full for 2026; rate not yet entered' },
    { slug: 'durango-holiday-home', name: 'Durango Holiday Home', services: [included('hosting', 'Website Hosting', 'yearly')], notes: '2026 hosting rate still to confirm' },
    { slug: 'rational-wealth', name: 'Simplicity Financial', services: [annual('hosting', 250, 'Website Hosting')] },
    { slug: 'straightforward-bookkeeping', name: 'Straightforward Bookkeeping', services: [annual('hosting', 300, 'Website Hosting')] },
    { slug: 'thank-you-for-dating-with-us', name: 'Thank You For Dating Us', services: [annual('hosting', 300, 'Website Hosting')], notes: '$300 annual rate begins next renewal; 2026 hosting included complimentary' },
    { slug: 'shift-physiotherapy', name: 'Shift Physiotherapy & Wellness', services: [monthly('seo', 1000, 'Standard SEO')] },
    { slug: 'sierra-electrical', name: 'Sierra Electrical', services: [monthly('seo', 1000, 'Standard SEO')] },
    { slug: 'peguis-historical-society', name: 'Peguis Historical Society', services: [monthly('project-management', 4800, 'The Chief Peguis Story Website - Project Management Services')], notes: 'Ongoing project management and technical liaison services' },
];

const hostingDates = {
    ckf: { lastBilled: '2026-04-25', nextBillDate: '2027-04-25' },
    'durango-holiday-home': { lastBilled: '2026-05-13', nextBillDate: '2027-05-13' },
    'mth-landscaping': { lastBilled: '2026-06-05', nextBillDate: '2027-06-05' },
    'sd-accounting': { lastBilled: '2026-04-17', nextBillDate: '2027-04-17' },
    'rational-wealth': { lastBilled: '2026-07-10', nextBillDate: '2027-07-10' },
    'straightforward-bookkeeping': { lastBilled: '2026-07-17', nextBillDate: '2027-07-17' },
    'thank-you-for-dating-with-us': { lastBilled: '2026-08-05', nextBillDate: '2027-08-05' },
};

const projects = [
    ['ckf', 'maintenance', 'Hosting + Maintenance Bundle', 600, 'yearly', 'active', 'Bundle includes hosting and maintenance'],
    ['ckf', 'hosting', 'Hosting + Maintenance Bundle', 600, 'yearly', 'active', 'Bundle includes hosting and maintenance'],
    ['cuttermasters', 'maintenance', 'Website Maintenance', 75, 'monthly', 'active', 'Not found in current invoice export'],
    ['davis-window-and-door', 'maintenance', 'Website Maintenance', 75, 'monthly', 'active', 'Track separately from Tech SEO'],
    ['davis-window-and-door', 'aeo', 'Technical SEO & AEO', 350, 'monthly', 'active', 'Current invoice combines maintenance + Tech SEO/AEO; pricing structure should be monitored'],
    ['effy-blue', 'maintenance', 'Website Maintenance', 30, 'monthly', 'delinquent', ''],
    ['floco-decking-systems', 'maintenance', 'Website Maintenance', 75, 'monthly', 'active', ''],
    ['mth-landscaping', 'maintenance', 'Hosting + Maintenance Bundle', 400, 'yearly', 'active', 'Bundle includes hosting and maintenance'],
    ['mth-landscaping', 'hosting', 'Hosting + Maintenance Bundle', 400, 'yearly', 'active', 'Bundle includes hosting and maintenance'],
    ['mulchr', 'maintenance', 'Website Maintenance', 75, 'monthly', 'delinquent', ''],
    ['oatley-vigmond', 'maintenance', 'Website Maintenance', 125, 'monthly', 'active', ''],
    ['oatley-vigmond', 'aeo', 'Technical SEO', 425, 'monthly', 'active', ''],
    ['sd-accounting', 'maintenance', 'Website Maintenance', 40, 'monthly', 'prepaid', 'Paid in full for 2026'],
    ['sd-accounting', 'hosting', 'Website Hosting', 250, 'yearly', 'prepaid', 'Paid in full for 2026'],
    ['stratapath', 'maintenance', 'Website Maintenance', 50, 'monthly', 'active', ''],
    ['ti-yende-movers-and-transportation', 'maintenance', 'Website Maintenance', 0, 'yearly', 'prepaid', 'Paid in full for 2026; rate not yet entered'],
    ['durango-holiday-home', 'hosting', 'Website Hosting', 0, 'yearly', 'active', '2026 hosting rate still to confirm'],
    ['rational-wealth', 'hosting', 'Website Hosting', 250, 'yearly', 'active', ''],
    ['straightforward-bookkeeping', 'hosting', 'Website Hosting', 300, 'yearly', 'active', ''],
    ['thank-you-for-dating-with-us', 'hosting', 'Website Hosting', 300, 'yearly', 'complimentary', '$300 annual rate begins next renewal; 2026 hosting included complimentary'],
    ['shift-physiotherapy', 'seo', 'Standard SEO', 1000, 'monthly', 'active', ''],
    ['sierra-electrical', 'seo', 'Standard SEO', 1000, 'monthly', 'active', ''],
    ['peguis-historical-society', 'project-management', 'The Chief Peguis Story Website - Project Management Services', 4800, 'monthly', 'active', 'Ongoing project management and technical liaison services'],
];

for (const record of clients) {
    const hosting = record.services.find((service) => service.type === 'hosting');
    if (hosting && hostingDates[record.slug]) Object.assign(hosting, hostingDates[record.slug]);
    const existing = getClient(record.slug);
    const payload = {
        name: record.name,
        services: record.services,
        hosting: record.services.some((service) => service.type === 'hosting')
            ? { type: 'LDD', provider: 'LDD Self Hosting', lddHosted: true }
            : undefined,
    };
    if (existing) await updateClient(record.slug, payload, { regenerate: false });
    else await createClient({ ...payload, slug: record.slug, started: '2026-09-01', platform: 'WordPress' });
}

for (const [clientSlug, serviceType, title, fee, billingFrequency, status, notes] of projects) {
    const existing = loadClientProjects().find((project) => project.clientSlug === clientSlug && project.serviceType === serviceType);
    const payload = { clientSlug, serviceType, name: `${getClient(clientSlug).name} — ${title}`, fee, billingFrequency, status, notes, startDate: '2026-09-01' };
    if (existing) await updateClientProject(existing.id, payload);
    else createClientProject(payload);
}

console.log(`Reconciled ${clients.length} client records and ${projects.length} billing records.`);
