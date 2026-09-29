import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-intake-'));
process.env.INTAKE_DB_PATH = path.join(directory, 'intake.sqlite');
const { closeIntakeDatabase, listMittohneeSubmissions, saveMittohneeSubmission } = await import('../server/intake-store.mjs');

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

test.after(() => {
    closeIntakeDatabase();
    fs.rmSync(directory, { recursive: true, force: true });
});
