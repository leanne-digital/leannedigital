import {z} from 'zod';
import {getClient, updateClient, regeneratePages} from '../scripts/client-store.mjs';
import {listClientProposals,mutateClientProposal} from '../scripts/client-proposal-store.mjs';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(''));
const safeUrl=z.string().refine(value=>/^\/(?!\/)/.test(value)||/^https:\/\//.test(value),'Use a site-relative path or HTTPS URL');
export const serviceSchema=z.object({type:z.string().regex(/^[a-z][a-z0-9-]*$/),label:z.string().max(500).optional(),amount:z.number().nonnegative().optional(),cycle:z.enum(['monthly','yearly']).optional(),lastBilled:date.optional(),nextBillDate:date.optional()}).strict();
export const proposalSchema=z.object({title:z.string().min(1).max(500),url:safeUrl,status:z.enum(['draft','active','accepted','declined','expired']),notes:z.string().max(20000).optional()}).strict();
export async function clientCrud(clientId, area, operation, input={}) {
    const client=getClient(clientId);
    if(!client) throw Object.assign(new Error('Client not found'),{status:404});
    if(area==='proposals') {
        if(operation==='read')return {proposals:listClientProposals(client.slug)};
        const {id,...fields}=input;
        const parsed=operation==='delete'?{id:z.string().parse(id)}:{...(operation==='create'?proposalSchema:proposalSchema.partial()).parse(fields),...(operation==='update'?{id:z.string().parse(id)}:{})};
        const result=mutateClientProposal(client.slug,operation,parsed);
        await regeneratePages();return result;
    }
    const services=[...(client.services||[])];
    if(operation==='read')return {services:area==='hosting'?services.filter(row=>row.type==='hosting'):services};
    const type=area==='hosting'?'hosting':z.string().parse(input.type);
    const index=services.findIndex(row=>row.type===type);
    if(operation==='create' && index>=0)throw Object.assign(new Error('Service already exists; update it instead'),{status:409});
    if(operation!=='create' && index<0)throw Object.assign(new Error('Service not found'),{status:404});
    if(operation==='delete')services.splice(index,1);
    else {
        const service=serviceSchema.parse({...input,type});
        if(index<0)services.push(service);else services[index]={...services[index],...service};
    }
    await updateClient(client.slug,{services,...(type==='hosting'?{hosting:{...client.hosting,type:operation==='delete'?'External':'LDD',lddHosted:operation!=='delete'}}:{})});
    return {saved:operation!=='delete',deleted:operation==='delete',client:client.slug,type};
}
