import fs from 'node:fs';
import { renderHead, renderNav, renderFullFooter } from './layout.mjs';
import { GBT_PACKAGE_PATH } from './client-packages.mjs';

const root = new URL('../', import.meta.url);
const cards = fs.readFileSync(new URL('data/gbt-seo-packages.html', root), 'utf8');
const html = `${renderHead({ title: 'GBT SEO & Conversion Optimization Packages | Leanne Digital', description: 'SEO and Conversion Optimization packages prepared for GBT Logistics & Packaging Inc., including SEO Strategy & Advisory.', depth: 2, extraCss: ['gbt-packages.css'], cssVersion: '20260914a', robots: 'noindex, nofollow', canonical: 'https://leannedigital.com' + GBT_PACKAGE_PATH })}
<body class="page-inner">
${renderNav(2, '')}
<main id="main" class="gbt-proposal">
  <div class="container">
    <section class="proposal-intro" aria-labelledby="proposal-title">
      <div><h1 id="proposal-title">GBT Logistics &amp; Packaging Inc.</h1>
      <p>GBT Logistics &amp; Packaging Inc. delivers reliable warehousing, co-packing, transportation, and 3PL solutions that help businesses streamline operations, reduce costs, and scale with confidence across Canada and the United States.</p></div>
      <img src="../../assets/images/gbt-package.png" width="256" height="357" alt="GBT Logistics &amp; Packaging Inc.">
    </section>
    <section class="proposal-options" aria-labelledby="options-title">
      <h2 id="options-title">GBT SEO PACKAGES</h2>
      ${cards}
      <p class="proposal-note">SEO Strategy &amp; Advisory is designed for teams that manage content creation, content uploads, and website updates internally while receiving ongoing SEO strategy, technical oversight, reporting, and recommendations.</p>
      <p class="proposal-contact"><a class="ld-btn" href="mailto:leanne@leannedigital.com?subject=SEO%20Package%20-%20GBT%20Inc.">Discuss your package with Leanne</a></p>
    </section>
  </div>
</main>
${renderFullFooter(2)}
<script src="../../js/site-nav.js" defer></script>
<!-- lp:custom-body-end -->
</body></html>`;
const destination = new URL('proposals/gbt-logistics-and-packaging-inc/', root);
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(new URL('index.html', destination), html);
const legacyDirectory = new URL('admin/gbt-logistics-and-packaging-inc/', root);
fs.mkdirSync(legacyDirectory, { recursive: true });
fs.writeFileSync(new URL('index.html', legacyDirectory), `${renderHead({ title: 'GBT SEO Packages | Leanne Digital', description: 'The GBT SEO package proposal has moved.', depth: 2, robots: 'noindex, nofollow', canonical: 'https://leannedigital.com' + GBT_PACKAGE_PATH }).replace('</head>', `<meta http-equiv="refresh" content="0; url=${GBT_PACKAGE_PATH}">\n</head>`)}
<body><main><h1>GBT SEO Packages</h1><p><a href="${GBT_PACKAGE_PATH}">View the SEO &amp; Conversion Optimization packages</a>.</p></main><!-- lp:custom-body-end --></body></html>`);
// Keep this scoped redirect with the page: the publisher generates the root .htaccess.
fs.writeFileSync(new URL('.htaccess', legacyDirectory), `RewriteEngine On\nRewriteRule ^(?:index\\.html)?$ ${GBT_PACKAGE_PATH} [R=301,L]\n`);
console.log('Generated GBT package proposal.');
