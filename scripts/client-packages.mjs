export const GBT_PACKAGE_PATH = '/proposals/gbt-logistics-and-packaging-inc/';

export function renderClientPackages(client) {
    if (client.slug !== 'gbt-logistics') return '';
    return `            <section class="client-reports client-packages" aria-labelledby="packages-heading">
                <h2 class="client-reports__heading" id="packages-heading">Packages</h2>
                <p>Review the SEO and Conversion Optimization options prepared for GBT.</p>
                <a class="ld-btn" href="${GBT_PACKAGE_PATH}">View SEO &amp; Conversion Optimization packages</a>
            </section>`;
}
