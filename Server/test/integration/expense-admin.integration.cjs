const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-that-is-long-enough';
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must point to a MongoDB replica set');

const mongoose = require('mongoose');
const { app } = require('../../src/server');
const User = require('../../src/models/User.model');
const Party = require('../../src/models/Party.model');
const Expense = require('../../src/models/Expense.model');
const AuditLog = require('../../src/models/AuditLog.model');

let server;
let baseUrl;
let adminCookie;
let accountantCookie;
let party;

async function login(email, password) {
  const response = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

async function api(path, { method = 'GET', cookie = adminCookie, body } = {}) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      cookie,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json();
  return { status: response.status, data: payload };
}

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.db.dropDatabase();
  await User.create([
    { name: 'Integration Admin', email: 'admin@test.local', password: 'AdminPassword-12345', role: 'admin', isActive: true },
    { name: 'Integration Accountant', email: 'accountant@test.local', password: 'AccountantPassword-12345', role: 'accountant', isActive: true }
  ]);
  party = await Party.create({ name: 'Original Party', type: 'Customer', city: 'Gwalior' });
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  adminCookie = await login('admin@test.local', 'AdminPassword-12345');
  accountantCookie = await login('accountant@test.local', 'AccountantPassword-12345');
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await mongoose.disconnect();
});

test('admin console and expense register enforce roles and keep an audit trail', async () => {
  const denied = await api('/api/admin-records/parties', { cookie: accountantCookie });
  assert.equal(denied.status, 403);

  const records = await api('/api/admin-records/parties');
  assert.equal(records.status, 200);
  assert.equal(records.data.records.length, 1);
  const document = records.data.records[0];
  document.name = 'Corrected Party Name';
  document.city = 'Indore';

  const changed = await api('/api/admin-records/parties/' + party._id, {
    method: 'PATCH',
    body: { document, reason: 'Correcting the party master details after verification.' }
  });
  assert.equal(changed.status, 200);
  assert.ok(changed.data.changedFields.includes('city'));
  assert.ok(changed.data.changedFields.includes('name'));
  assert.equal((await Party.findById(party._id)).name, 'Corrected Party Name');

  const invalidReason = await api('/api/admin-records/parties/' + party._id, {
    method: 'PATCH',
    body: { document, reason: 'fix' }
  });
  assert.equal(invalidReason.status, 400);

  const created = await api('/api/expenses', {
    method: 'POST',
    cookie: accountantCookie,
    body: {
      expenseDate: '2026-11-14',
      category: 'electricity',
      amount: 1200,
      paymentMode: 'bank_transfer',
      vendor: 'Power utility',
      costTreatment: 'operating_expense',
      description: 'Monthly electricity bill'
    }
  });
  assert.equal(created.status, 201);
  const expenseId = created.data.expense._id;

  const badDate = await api('/api/expenses', {
    method: 'POST',
    cookie: accountantCookie,
    body: { expenseDate: '2026-02-30', category: 'rent', amount: 5000, paymentMode: 'cash' }
  });
  assert.equal(badDate.status, 400);

  await Expense.create([
    { expenseDate: new Date('2026-11-14T06:00:00.000Z'), category: 'interest', amount: 200, paymentMode: 'bank_transfer', costTreatment: 'finance_cost', recordedBy: (await User.findOne({ role: 'admin' }))._id },
    { expenseDate: new Date('2026-11-14T06:00:00.000Z'), category: 'freight', amount: 500, paymentMode: 'bank_transfer', costTreatment: 'stock_landed_cost', recordedBy: (await User.findOne({ role: 'admin' }))._id }
  ]);

  const forbiddenEdit = await api('/api/expenses/' + expenseId, {
    method: 'PATCH',
    cookie: accountantCookie,
    body: { amount: 1250 }
  });
  assert.equal(forbiddenEdit.status, 403);

  const updated = await api('/api/expenses/' + expenseId, {
    method: 'PATCH',
    body: { amount: 1250 }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.expense.amount, 1250);

  const report = await api('/api/reports/profit-loss?from=2026-11-14&to=2026-11-14');
  assert.equal(report.status, 200);
  assert.equal(report.data.summary.operatingExpenses, 1250);
  assert.equal(report.data.summary.financeCosts, 200);
  assert.equal(report.data.summary.stockLandedCosts, 500);

  const forbiddenDelete = await api('/api/expenses/' + expenseId, { method: 'DELETE', cookie: accountantCookie });
  assert.equal(forbiddenDelete.status, 403);
  const deleted = await api('/api/expenses/' + expenseId, { method: 'DELETE' });
  assert.equal(deleted.status, 200);

  const actions = await AuditLog.find({ action: { $in: ['admin.record_overridden', 'expense.created', 'expense.updated', 'expense.deleted'] } }).lean();
  assert.ok(actions.some(item => item.action === 'admin.record_overridden'));
  assert.ok(actions.some(item => item.action === 'expense.created'));
  assert.ok(actions.some(item => item.action === 'expense.updated'));
  assert.ok(actions.some(item => item.action === 'expense.deleted'));
});
