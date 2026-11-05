import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const marker=fileURLToPath(new URL('../.editor-managed-publication.json',import.meta.url));
export function assertEditorBuildAllowed() {
if(process.env.WEBSITE_EDITOR_PUBLIC_SITE||fs.existsSync(marker))throw Error('This website is editor-managed. Legacy public generators are blocked. Use the editor release workflow or an agency-reviewed template migration. Client-report generators remain independent.');

}
