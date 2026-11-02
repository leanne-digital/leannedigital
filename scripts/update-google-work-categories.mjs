// Update the deployed Google connector, which may be installed separately from this checkout.
import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
for(const name of ['service.mjs','tools.mjs']){
 const file=path.join(root,'server/google-platforms',name);if(!fs.existsSync(file))continue;
 let text=fs.readFileSync(file,'utf8');
 if(name==='service.mjs')text=text.replace('logCompleted({ planId, clientSlug, month, workedOn, reportSlug })','logCompleted({ planId, clientSlug, month, workedOn, reportSlug, category })').replace('this.log({ clientSlug, month, workedOn, reportSlug, title:', 'this.log({ clientSlug, month, workedOn, reportSlug, category, title:');
 else if(!text.includes("import { WORK_CATEGORIES }")){
  text="import { WORK_CATEGORIES } from '../../scripts/work-categories.mjs';\n"+text;
  text=text.replace("{ planId: z.string().uuid(), clientSlug: z.string(), month:","{ planId: z.string().uuid(), category: z.enum(Object.keys(WORK_CATEGORIES)).describe('Clarify the kind of work with the user when unclear.'), clientSlug: z.string(), month:");
 }
 fs.writeFileSync(file,text);
}
