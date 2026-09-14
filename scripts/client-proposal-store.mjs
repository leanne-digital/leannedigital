import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const file=fileURLToPath(new URL('../data/client-proposals.json',import.meta.url));
export function listClientProposals(client) {
    const rows=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[{id:'gbt-original',clientSlug:'gbt-logistics',title:'SEO & Conversion Optimization',url:'/proposals/gbt-logistics-and-packaging-inc/',status:'active'}];
    return client?rows.filter(row=>row.clientSlug===client):rows;
}
export function mutateClientProposal(client, operation, input) {
    const rows=listClientProposals();
    const index=rows.findIndex(row=>row.clientSlug===client && row.id===input.id);
    if(operation!=='create' && index<0) throw Object.assign(new Error('Proposal not found'),{status:404});
    let result;
    if(operation==='delete') { result={deleted:true,id:input.id}; rows.splice(index,1); }
    else {
        result={...(index<0?{}:rows[index]),...input,id:index<0?randomUUID():input.id,clientSlug:client};
        if(index<0) rows.push(result);else rows[index]=result;
    }
    fs.writeFileSync(file+'.tmp',JSON.stringify(rows,null,2));fs.renameSync(file+'.tmp',file);
    return result;
}
