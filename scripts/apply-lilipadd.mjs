import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformHtml } from './lilipadd-slots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const HAND_BUILT = [
    'index.html',
    'about/index.html',
    'contact/index.html',
];

function main() {
    for (const relative of HAND_BUILT) {
        const filePath = path.join(ROOT, relative);
        if (!fs.existsSync(filePath)) {
            console.warn(`Skip missing: ${relative}`);
            continue;
        }
        const html = fs.readFileSync(filePath, 'utf8');
        fs.writeFileSync(filePath, transformHtml(html), 'utf8');
        console.log(`Patched ${relative}`);
    }
}

main();
