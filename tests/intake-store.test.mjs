import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-intake-'));
process.env.INTAKE_DB_PATH = path.join(directory, 'intake.sqlite');
const { closeIntakeDatabase, exportMittohneeCsv, listMittohneeSubmissions, saveMittohneeSubmission } = await import('../server/intake-store.mjs');

test('stores and filters Red River College intake submissions', () => {
    const saved = saveMittohneeSubmission({
        name: 'Student One',
        businessName: 'Prairie Studio',
        email: 'student@example.com',
        businessTypes: ['service'],
        customerLocations: ['manitoba'],
        idealCustomer: 'Small Manitoba businesses',
        consent: true,
    });
    assert.ok(saved.id);
    assert.equal(listMittohneeSubmissions().count, 1);
    assert.equal(listMittohneeSubmissions({ search: 'prairie' }).submissions[0].email, 'student@example.com');
    assert.equal(listMittohneeSubmissions({ businessType: 'product' }).count, 0);
    assert.equal(listMittohneeSubmissions({ customerLocation: 'manitoba' }).count, 1);
});

test('rejects an invalid public intake payload', () => {
    assert.throws(() => saveMittohneeSubmission({ name: '', businessName: '', email: 'bad', consent: true }));
});

test('CSV exports every submission with escaped answers and spreadsheet-safe cells', () => {
    for (let i = 0; i < 251; i++) saveMittohneeSubmission({
        name: 'CSV Student', businessName: '=SUM(1,2)', email: 'csv@example.com',
        services: 'Quotes "and" commas, plus\nnew lines', consent: true,
    });
    const csv = exportMittohneeCsv();
    assert.ok(csv.startsWith('\uFEFF"Submission ID"'));
    assert.equal((csv.match(/CSV Student/g) || []).length, 251);
    assert.ok(csv.includes('"\'=SUM(1,2)"'));
    assert.ok(csv.includes('"Quotes ""and"" commas, plus\nnew lines"'));
    assert.ok(csv.includes('student@example.com'));
});

test.after(() => {
    closeIntakeDatabase();
    fs.rmSync(directory, { recursive: true, force: true });
});
