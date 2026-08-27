import { escapeHtml } from './layout.mjs';

export function asParagraphs(value) {
    if (Array.isArray(value)) {
        return value.map((row) => String(row || '').trim()).filter(Boolean);
    }
    return String(value || '')
        .split(/\n{2,}/)
        .map((row) => row.trim())
        .filter(Boolean);
}

export function paragraphsHtml(value) {
    const paras = asParagraphs(value);
    if (!paras.length) return '';
    return paras.map((row) => `                <p>${escapeHtml(row)}</p>`).join('\n');
}

function placeholder(label) {
    return `<div class="seo-report__placeholder" role="img" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</div>`;
}

function figure(src, caption) {
    const label = caption || 'Screenshot';
    if (!src) {
        return `            <figure class="seo-report__figure">
                <figcaption>${escapeHtml(label)}</figcaption>
                ${placeholder(label)}
            </figure>`;
    }
    return `            <figure class="seo-report__figure">
                <figcaption>${escapeHtml(label)}</figcaption>
                <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}">
            </figure>`;
}

function pdfButton(pdf, fallbackLabel) {
    if (!pdf?.href) return '';
    const label = pdf.label || fallbackLabel || 'Download keyword report';
    return `            <p class="seo-report__actions"><a class="ld-btn" href="${escapeHtml(pdf.href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></p>`;
}

function activityTable(rows = [], empty = 'No activity logged this month.') {
    if (!rows.length) {
        return `            <p class="seo-report__empty">${escapeHtml(empty)}</p>`;
    }
    const body = rows
        .map(
            (row) => `                    <tr>
                        <td>${escapeHtml(row.date || '')}</td>
                        <td>${escapeHtml(row.keyword || '')}</td>
                        <td>${escapeHtml(row.source || '')}</td>
                        <td><span class="client-report-badge">${escapeHtml(row.target || 'Page')}</span></td>
                        <td>${escapeHtml(row.linksAdded || '')}</td>
                    </tr>`
        )
        .join('\n');
    return `            <div class="dash-table-wrap">
                <table class="client-report-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Keyword</th>
                            <th>Source post</th>
                            <th>Target</th>
                            <th>Links added</th>
                        </tr>
                    </thead>
                    <tbody>
${body}
                    </tbody>
                </table>
            </div>`;
}

function internalLinkingTable(rows = []) {
    if (!rows.length) return '';
    const body = rows
        .map(
            (row) => `                    <tr>
                        <td>${escapeHtml(row.date || '')}</td>
                        <td>${escapeHtml(row.user || '')}</td>
                        <td>${escapeHtml(row.keyword || '')}</td>
                        <td>${escapeHtml(row.source || '')}</td>
                        <td><span class="client-report-badge">${escapeHtml(row.target || 'Page')}</span></td>
                        <td>${escapeHtml(row.linksAdded || '')}</td>
                        <td>${escapeHtml(row.storage || '')}</td>
                    </tr>`
        )
        .join('\n');
    return `            <div class="dash-table-wrap">
                <table class="client-report-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>User</th>
                            <th>Keyword</th>
                            <th>Source post</th>
                            <th>Target</th>
                            <th>Links added</th>
                            <th>Storage</th>
                        </tr>
                    </thead>
                    <tbody>
${body}
                    </tbody>
                </table>
            </div>`;
}

export function renderSeoReportBody(report) {
    const company = report.companyName || report.clientName || 'Client';
    const monthLabel = report.monthLabel || report.title || '';
    const pdfLabel = `Download ${monthLabel.replace(/\s+/g, ' ').trim() || 'this month'} keyword report`;
    const adsOn = report.googleAds?.enabled !== false && report.googleAds?.na !== true;
    const adsBlock = adsOn
        ? `${figure(report.googleAds?.image, 'Google Ads')}
${paragraphsHtml(report.googleAds?.recap) || '                <p>No Google Ads recap yet.</p>'}`
        : `            <p class="seo-report__na">N/A</p>
            <p>This client does not have Google Ads this month.</p>`;

    return `<article class="seo-report">
    <header class="seo-report__intro">
        <h1>${escapeHtml(company)}</h1>
${paragraphsHtml(report.campaignIntro)}
${pdfButton(report.keywordPdf, pdfLabel)}
    </header>
    <p class="seo-report__kicker">${escapeHtml(company)} — SEO Report</p>
    <p class="seo-report__month">${escapeHtml(monthLabel)}</p>
    <section class="seo-report__section">
        <h2>Monthly recap</h2>
${paragraphsHtml(report.monthlyRecap) || '                <p>Recap for this month will go here.</p>'}
    </section>
    <section class="seo-report__section">
        <h2>Technical SEO</h2>
        <div class="seo-report__shots">
${figure(report.technicalSeo?.thisMonthImage, 'This month')}
${figure(report.technicalSeo?.lastMonthImage, 'Last month')}
        </div>
${paragraphsHtml(report.technicalSeo?.recap)}
        <h3>Activity log</h3>
${activityTable(report.technicalSeo?.internalLinks)}
        <h3>Internal linking</h3>
${internalLinkingTable(report.technicalSeo?.internalLinking)}
    </section>
    <section class="seo-report__section">
        <h2>Keyword rankings</h2>
        <div class="seo-report__shots seo-report__shots--three">
${figure(report.keywords?.thisMonthImage, 'This month')}
${figure(report.keywords?.lastMonthImage, 'Last month')}
${figure(report.keywords?.twoMonthsAgoImage, 'Two months ago')}
        </div>
${paragraphsHtml(report.keywords?.recap)}
${pdfButton(report.keywords?.pdf || report.keywordPdf, pdfLabel)}
    </section>
    <section class="seo-report__section">
        <h2>New content and updates</h2>
        <h4>Activity log</h4>
${activityTable(report.newContent?.log, 'No new content logged this month.')}
${paragraphsHtml(report.newContent?.recap)}
    </section>
    <section class="seo-report__section">
        <h2>Google Ads</h2>
${adsBlock}
    </section>
    <section class="seo-report__section">
        <h2>Next steps and strategy</h2>
${paragraphsHtml(report.nextSteps) || '                <p>Next month’s plan will go here.</p>'}
    </section>
</article>
`;
}
