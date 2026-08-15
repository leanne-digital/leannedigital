import { getClient, loadClients } from '../../scripts/client-store.mjs';
import { portalStats } from '../../scripts/portal-stats.mjs';
import {
    createClientWithAccount,
    deleteClientWithAccount,
    updateClientWithAccount,
} from '../portal-service.mjs';
import {
    createProject as createPortfolioProject,
    deleteProject as deletePortfolioProject,
    loadProjects as loadPortfolioProjects,
    updateProject as updatePortfolioProject,
} from '../../scripts/portfolio-store.mjs';
import {
    loadCalendlyBookings,
    loadSubmissions,
    setLeadStatus,
} from '../../scripts/admin-inbox.mjs';
import {
    addProjectUpdate,
    createClientProject,
    getClientProject,
    listClientProjects,
    seedProjectsFromClientServices,
    setProjectStatus,
    updateClientProject,
    updatesForProject,
    projectActiveInMonth,
} from '../../scripts/client-project-store.mjs';
import { getSiteConversions, getSiteStatistics } from './lilipadd-analytics.mjs';

seedProjectsFromClientServices();

function currentMonth(now = new Date()) {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function listAgencyClients(user, filters = {}) {
    let clients = loadClients();
    if (user?.role !== 'staff' && user?.clientSlug) {
        clients = clients.filter((client) => client.slug === user.clientSlug);
    } else if (user && user.role !== 'staff' && !user.clientSlug) {
        clients = [];
    }
    const serviceType = filters.serviceType ? String(filters.serviceType).toLowerCase() : '';
    if (serviceType === 'seo' || filters.seo === '1' || filters.seo === 'true') {
        const slugs = new Set(listSeoClients().map((client) => client.slug));
        return clients.filter((client) => slugs.has(client.slug));
    }
    if (serviceType) {
        const slugs = new Set(
            listClientProjects({ serviceType, status: filters.status || 'active' }).map((row) => row.clientSlug)
        );
        return clients.filter(
            (client) =>
                slugs.has(client.slug) ||
                (client.services || []).some((service) => service.type === serviceType)
        );
    }
    return clients;
}

export function getAgencyClient(id) {
    const client = getClient(id);
    if (!client) {
        const error = new Error('Client not found');
        error.status = 404;
        throw error;
    }
    return client;
}

export function listSeoClients() {
    const fromProjects = listClientProjects({ status: 'active' }).filter((row) =>
        ['seo', 'aeo'].includes(row.serviceType)
    );
    const slugs = new Set(fromProjects.map((row) => row.clientSlug));
    return loadClients()
        .filter((client) => {
            if (slugs.has(client.slug)) return true;
            const types = (client.services || []).map((service) => service.type);
            return types.includes('seo') || types.includes('aeo') || (client.reports || []).length > 0;
        })
        .map((client) => ({
            ...client,
            projects: listClientProjects({ client: client.slug, status: 'active' }).filter((row) =>
                ['seo', 'aeo'].includes(row.serviceType)
            ),
        }));
}

function revenueRows(yearMonth) {
    const month = yearMonth || currentMonth();
    const projects = listClientProjects().filter((project) => projectActiveInMonth(project, month));
    const byService = {};
    const byClient = {};
    let monthly = 0;
    for (const project of projects) {
        const amount = roundMoney(project.monthlyFee);
        monthly += amount;
        byService[project.serviceType] = roundMoney((byService[project.serviceType] || 0) + amount);
        const key = project.clientSlug;
        if (!byClient[key]) {
            byClient[key] = {
                clientId: project.clientId,
                clientSlug: project.clientSlug,
                clientName: project.clientName,
                monthly: 0,
                projects: [],
            };
        }
        byClient[key].monthly = roundMoney(byClient[key].monthly + amount);
        byClient[key].projects.push({
            id: project.id,
            name: project.name,
            serviceType: project.serviceType,
            monthlyFee: amount,
        });
    }
    return {
        month,
        currency: 'CAD',
        monthlyRecurring: roundMoney(monthly),
        expectedThisMonth: roundMoney(monthly),
        byService,
        byClient: Object.values(byClient).sort((a, b) => b.monthly - a.monthly),
        activeProjects: projects,
        hosting: roundMoney(byService.hosting || 0),
        seo: roundMoney((byService.seo || 0) + (byService.aeo || 0)),
        maintenance: roundMoney((byService.maintenance || 0) + (byService.management || 0)),
    };
}

export function getMonthlyRevenue(month) {
    return revenueRows(month);
}

export function getRevenueByService(month) {
    const report = revenueRows(month);
    return { month: report.month, currency: report.currency, byService: report.byService };
}

export function getClientRevenue(clientId, month) {
    const report = revenueRows(month);
    const row =
        report.byClient.find(
            (item) => String(item.clientId) === String(clientId) || item.clientSlug === String(clientId)
        ) || null;
    if (!row) {
        const client = getClient(clientId);
        if (!client) {
            const error = new Error('Client not found');
            error.status = 404;
            throw error;
        }
        return {
            month: report.month,
            currency: report.currency,
            clientId: client.id,
            clientSlug: client.slug,
            clientName: client.name,
            monthly: 0,
            projects: [],
        };
    }
    return { month: report.month, currency: report.currency, ...row };
}

export function getDashboardStats() {
    return portalStats(loadClients());
}

export {
    createClientWithAccount,
    updateClientWithAccount,
    deleteClientWithAccount,
    listClientProjects,
    getClientProject,
    createClientProject,
    updateClientProject,
    setProjectStatus,
    addProjectUpdate,
    updatesForProject,
    loadPortfolioProjects,
    createPortfolioProject,
    updatePortfolioProject,
    deletePortfolioProject,
    loadSubmissions,
    setLeadStatus,
    loadCalendlyBookings,
    getSiteStatistics,
    getSiteConversions,
};
