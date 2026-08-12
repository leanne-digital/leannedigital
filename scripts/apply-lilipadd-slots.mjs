import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySlotsToTree, collectSeoInventory } from './lilipadd-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = path.join(ROOT, 'data', 'lilipadd-seo-inventory.json');

function writeInventory(pages) {
    fs.mkdirSync(path.dirname(INVENTORY), { recursive: true });
    fs.writeFileSync(INVENTORY, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
}

const fresh = collectSeoInventory();
const titled = fresh.filter((page) => page.title);
if (titled.length) {
    writeInventory(fresh);
    console.log(`Wrote SEO inventory (${titled.length} titled pages) → data/lilipadd-seo-inventory.json`);
} else if (!fs.existsSync(INVENTORY)) {
    writeInventory(fresh);
    console.log(`Wrote SEO inventory without baked titles (${fresh.length} pages).`);
} else {
    console.log('Keeping existing SEO inventory (HTML no longer has baked titles).');
}

const result = applySlotsToTree();
console.log(`Applied Lilipadd slots on ${result.changed}/${result.files} HTML pages.`);
