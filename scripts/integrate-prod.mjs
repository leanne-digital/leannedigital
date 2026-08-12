/** Regenerate all pages with the production Lilipadd snippet URL. */
process.env.LILIPADD_SNIPPET_URL = 'https://api.lilipadd.com/v1/snippet.js';

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const result = spawnSync(npm, ['run', 'integrate'], { cwd: root, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
