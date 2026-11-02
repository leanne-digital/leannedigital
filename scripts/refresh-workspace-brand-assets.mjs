// Refresh the shared workspace stylesheet URL without rebuilding workspace pages.
// Run against the source tree and published document root after deploying the CSS.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2] || '.');
for(const relative of ['clients/index.html','google-platforms/index.html','profile/index.html','scripts/build-client-workspace.mjs']) {
    const file=path.join(root,relative);
    if(!fs.existsSync(file))continue;
    const current=fs.readFileSync(file,'utf8');
    const updated=current.replace(/client-workspace-shell\.css(?:\?v=[\w.-]+)?/g,'client-workspace-shell.css?v=brand-20261102-icons2')
        .replace(/workspace-(shell|extra|admin)\.js(?:\?v=[\w.-]+)?/g,'workspace-$1.js?v=reports-20261102');
    if(updated!==current)fs.writeFileSync(file,updated);
}
