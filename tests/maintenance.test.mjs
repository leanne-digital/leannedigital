import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {serviceSchema} from '../server/client-crud.mjs';
import {getClient} from '../scripts/client-store.mjs';

function surface() {
    const nodes = new Map();
    const element = () => ({hidden:false, textContent:'', innerHTML:'', dataset:{}, before(){}, setAttribute(){}});
    for (const selector of ['[data-clients-body]', '[data-clients-empty]', '[data-clients-heading]', '[data-income-summary]', '.admin-clients-table thead tr', '[data-admin-panel=overview] .admin-panel__title', '[data-admin-panel=overview] .admin-panel__lead']) nodes.set(selector, element());
    const visibility = element();
    Object.defineProperty(visibility, 'innerHTML', {get(){return this.options || '';},set(value){this.options=value;this.value=value.match(/value="([^"]+)"/)?.[1];}});
    visibility.innerHTML = '<option value="all">All</option><option value="private">Private</option>';
    nodes.set('[data-visibility-filter]', visibility);
    const context = {Intl, document:{querySelector:selector=>nodes.get(selector),addEventListener(){}},window:{}};
    vm.createContext(context);
    const code=fs.readFileSync(new URL('../js/workspace-admin.js',import.meta.url),'utf8').replace('    if (window.__LD_PORTAL__)', '    window.test = {renderClientsTable, maintenanceIncome, incomeTotals};\n    if (window.__LD_PORTAL__)');
    vm.runInContext(code,context);
    return {nodes, ...context.window.test};
}
const client=(slug,amount,cycle,status='active')=>({slug,name:slug,services:[{type:'maintenance',amount,cycle,status}]});
test('monthly estimate normalizes yearly fees and excludes inactive or unrecorded billing',()=>{
    const {maintenanceIncome}=surface();
    assert.equal(maintenanceIncome([client('monthly',75,'monthly'),client('annual',600,'yearly'),client('inactive',900,'monthly','inactive'),client('unknown',500,undefined),client('missing',undefined,'monthly')]),125);
});
test('maintenance defaults to active, keeps aggregate stable across search, and supports inactive view',()=>{
    const {nodes,renderClientsTable}=surface();
    const clients=[client('monthly',75,'monthly'),client('annual',600,'yearly'),client('mth',100,'monthly','inactive')];
    renderClientsTable(clients,'maintenance-clients','');
    assert.equal(nodes.get('[data-visibility-filter]').value,'active');
    let html=nodes.get('[data-clients-body]').innerHTML;
    assert.ok(!html.includes('data-open-client="mth"'));
    assert.ok(html.includes('<div>$75</div>'));
    assert.ok(html.includes('<td>Yearly</td>'));
    assert.ok(html.includes('Site maintenance, backups and security'));
    assert.ok(nodes.get('[data-income-summary]').innerHTML.includes('$125'));
    renderClientsTable(clients,'maintenance-clients','annual');
    assert.ok(nodes.get('[data-income-summary]').innerHTML.includes('$125'));
    nodes.get('[data-visibility-filter]').value='inactive';
    renderClientsTable(clients,'maintenance-clients','');
    html=nodes.get('[data-clients-body]').innerHTML;
    assert.ok(html.includes('data-open-client="mth"'));
    assert.ok(!html.includes('data-open-client="monthly"'));
    renderClientsTable(clients,'overview','');
    assert.equal(nodes.get('[data-visibility-filter]').value,'all');
    assert.equal(nodes.get('[data-income-summary]').hidden,true);
});
test('service status validates and MTH maintenance is saved as inactive',()=>{
    assert.equal(serviceSchema.parse({type:'maintenance',status:'inactive'}).status,'inactive');
    assert.throws(()=>serviceSchema.parse({type:'maintenance',status:'invalid'}));
    assert.equal(getClient('mth-landscaping').services.find(row=>row.type==='maintenance').status,'inactive');
});

test('service cards and overview total use the same monthly amounts without double counting',()=>{
    const {nodes, renderClientsTable, incomeTotals}=surface();
    const clients=[{slug:'bundle', name:'Bundle', services:[
        {type:'maintenance',amount:120,cycle:'yearly'},
        {type:'hosting',amount:240,cycle:'yearly'},
        {type:'seo',amount:100,cycle:'monthly'},
        {type:'aeo',amount:50,cycle:'monthly'},
        {type:'geo',amount:999,cycle:'monthly',status:'inactive'},
    ]}, {slug:'archived',name:'Archived',archivedAt:'2026-01-01',services:[{type:'hosting',amount:999,cycle:'monthly'}]}];
    assert.equal(JSON.stringify(incomeTotals(clients).map(row=>row.amount)), '[10,0,20,150]');
    for (const [id, amount] of [['maintenance-clients',10],['hosting-clients',20],['seo-clients',150]]) {
        renderClientsTable(clients,id,'');
        const summary=nodes.get('[data-income-summary]');
        assert.equal(summary.hidden,false);
        assert.ok(summary.innerHTML.includes(`$${amount}`));
        assert.equal((summary.innerHTML.match(/<article/g)||[]).length,1);
    }
    assert.equal(nodes.get('[data-visibility-filter]').value,'shared');
    renderClientsTable(clients,'dashboard','');
    const html=nodes.get('[data-income-summary]').innerHTML;
    assert.equal((html.match(/<article/g)||[]).length,5);
    assert.ok(html.includes('Grand total'));
    assert.ok(html.includes('$180'));
});


test('all income cards exclude private clients regardless of owner or visibility filter',()=>{
    const {incomeTotals,renderClientsTable,nodes}=surface();
    const services=[{type:'maintenance',amount:10,cycle:'monthly'},{type:'hosting',amount:240,cycle:'yearly'},{type:'management',amount:30,cycle:'monthly'},{type:'seo',amount:40,cycle:'monthly'}];
    const clients=[{slug:'shared',name:'Shared',visibility:'shared',services},
        ...['gary','leanne'].map(ownerUserId=>({slug:ownerUserId,name:ownerUserId,visibility:'private',ownerUserId,services})),
        {slug:'private-missing',name:'Private missing',visibility:'private',services:[{type:'maintenance'}]}];
    assert.equal(JSON.stringify(incomeTotals(clients).map(row=>row.amount)), '[10,30,20,40]');
    assert.equal(incomeTotals(clients).reduce((sum,row)=>sum+row.missing,0),0);
    renderClientsTable(clients,'dashboard','');
    assert.ok(nodes.get('[data-income-summary]').innerHTML.includes('$100'));
    nodes.get('[data-visibility-filter]').value='private';
    renderClientsTable(clients,'dashboard','');
    assert.ok(nodes.get('[data-income-summary]').innerHTML.includes('$100'));
    assert.ok(nodes.get('[data-income-summary]').innerHTML.includes('Shared clients only'));
});
