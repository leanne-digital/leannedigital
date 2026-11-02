import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2] || '.');
const skip=new Set(['.git','.codex','.cursor','node_modules','tmp','runtime','data','_import','assets','server','tests']);
function visit(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.name.startsWith('.')||skip.has(entry.name)||entry.isSymbolicLink())continue;
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){visit(file);continue;}
  if(!/\.(html|mjs)$/.test(entry.name)||entry.name==='refresh-account-nav.mjs')continue;
  const old=fs.readFileSync(file,'utf8');
  const next=old.replace(/site-nav\.js(?:\?v=[\w.-]+)?/g,'site-nav.js?v=account-refresh-20261102');
  if(next!==old)fs.writeFileSync(file,next);
 }
}
visit(root);
