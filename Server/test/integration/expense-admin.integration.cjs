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
const Invoice = require('../../src/models/Invoice.model');
const Dispatch = require('../../src/models/Dispatch.model');
const ReelUnit = require('../../src/models/ReelUnit.model');
const ProductionRun = require('../../src/models/ProductionRun.model');
const CorrugatedSheet = require('../../src/models/CorrugatedSheet.model');
const FinishedBox = require('../../src/models/FinishedBox.model');
const StockMovement = require('../../src/models/StockMovement.model');
const StockReconciliation = require('../../src/models/StockReconciliation.model');
const connectDB = require('../../src/config/db');

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
  assert.deepEqual(records.data.editableFields, ['name', 'type', 'phone', 'city']);
  assert.equal(records.data.readOnly, false);
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

  const unsafePartyEdit = await api('/api/admin-records/parties/' + party._id, {
    method: 'PATCH',
    body: {
      document: { ...changed.data.record, balance: 9999, ledger: [{ type: 'Payment Received', debit: 0, credit: 9999, balance: -9999 }] },
      reason: 'Attempting to alter protected party accounting fields.'
    }
  });
  assert.equal(unsafePartyEdit.status, 403);
  const unchangedParty = await Party.findById(party._id);
  assert.equal(unchangedParty.balance, 0);
  assert.equal(unchangedParty.ledger.length, 0);

  const auditedParty = await api('/api/parties', {
    method: 'POST',
    body: { name: 'Audit Trail Supplier', type: 'Supplier', phone: '9999999999', city: 'Gwalior' }
  });
  assert.equal(auditedParty.status, 201);
  const partyUpdate = await api('/api/parties/' + auditedParty.data._id, {
    method: 'PATCH',
    body: { city: 'Indore' }
  });
  assert.equal(partyUpdate.status, 200);
  const partyArchive = await api('/api/parties/' + auditedParty.data._id, { method: 'DELETE' });
  assert.equal(partyArchive.status, 200);
  const partyAuditActions = await AuditLog.find({
    entityType: 'Party',
    entityId: auditedParty.data._id,
    action: { $in: ['party.created', 'party.updated', 'party.archived'] }
  }).lean();
  assert.deepEqual(new Set(partyAuditActions.map(item => item.action)), new Set(['party.created', 'party.updated', 'party.archived']));

  const protectedInvoiceList = await api('/api/admin-records/invoices');
  assert.equal(protectedInvoiceList.status, 200);
  assert.equal(protectedInvoiceList.data.readOnly, true);
  assert.deepEqual(protectedInvoiceList.data.editableFields, []);

  const protectedInvoice = await Invoice.create({
    invoiceNumber: 'INV-ADMIN-PROTECTED',
    invoiceDate: new Date('2026-11-14T00:00:00.000Z'),
    customerId: party._id,
    dispatchId: new mongoose.Types.ObjectId(),
    items: [],
    subTotal: 100,
    gstPercent: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    grandTotal: 100,
    balanceDue: 100,
    status: 'Pending'
  });
  const blockedInvoiceEdit = await api('/api/admin-records/invoices/' + protectedInvoice._id, {
    method: 'PATCH',
    body: { document: { balanceDue: 0 }, reason: 'Must use controlled accounting corrections.' }
  });
  assert.equal(blockedInvoiceEdit.status, 403);
  assert.equal((await Invoice.findById(protectedInvoice._id)).balanceDue, 100);

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

  const auditRecords = await api('/api/admin-records/auditLogs');
  assert.equal(auditRecords.status, 200);
  assert.ok(auditRecords.data.records.some(item => item.action === 'admin.record_overridden'));
  const auditEdit = await api('/api/admin-records/auditLogs/' + auditRecords.data.records[0]._id, { method: 'PATCH', body: { document: auditRecords.data.records[0], reason: 'Should not be editable in audit history.' } });
  assert.equal(auditEdit.status, 403);

  const actions = await AuditLog.find({ action: { $in: ['admin.record_overridden', 'expense.created', 'expense.updated', 'expense.deleted'] } }).lean();
  assert.ok(actions.some(item => item.action === 'admin.record_overridden'));
  assert.ok(actions.some(item => item.action === 'expense.created'));
  assert.ok(actions.some(item => item.action === 'expense.updated'));
  assert.ok(actions.some(item => item.action === 'expense.deleted'));
});


test('payment allocations reverse atomically and production posting rolls back partial stock deductions', async () => {
  const customer = await Party.create({ name: 'Payment Test Customer', type: 'Customer', balance: 1800, ledger: [
    { type: 'Tax Invoice', ref: 'INV-TEST-1', debit: 1000, credit: 0, balance: 1000 },
    { type: 'Tax Invoice', ref: 'INV-TEST-2', debit: 800, credit: 0, balance: 1800 }
  ] });
  const dispatchId = new mongoose.Types.ObjectId();
  const firstInvoice = await Invoice.create({
    invoiceNumber: 'INV-TEST-1', invoiceDate: new Date('2026-11-01'), customerId: customer._id, dispatchId,
    items: [], subTotal: 1000, gstPercent: 0, cgstAmount: 0, sgstAmount: 0, grandTotal: 1000, balanceDue: 1000, status: 'Pending'
  });
  const secondInvoice = await Invoice.create({
    invoiceNumber: 'INV-TEST-2', invoiceDate: new Date('2026-11-02'), customerId: customer._id, dispatchId: new mongoose.Types.ObjectId(),
    items: [], subTotal: 800, gstPercent: 0, cgstAmount: 0, sgstAmount: 0, grandTotal: 800, balanceDue: 800, status: 'Pending'
  });

  const payment = await api('/api/parties/' + customer._id + '/transaction', {
    method: 'POST',
    body: { amount: 1500, direction: 'in', mode: 'UPI', ref: 'UTR-TEST-01' }
  });
  assert.equal(payment.status, 200);
  assert.equal((await Invoice.findById(firstInvoice._id)).balanceDue, 0);
  assert.equal((await Invoice.findById(secondInvoice._id)).balanceDue, 300);
  const paymentEntry = payment.data.ledger[payment.data.ledger.length - 1];

  const reversed = await api('/api/parties/' + customer._id + '/transaction/' + paymentEntry._id, { method: 'DELETE' });
  assert.equal(reversed.status, 200);
  assert.equal((await Invoice.findById(firstInvoice._id)).balanceDue, 1000);
  assert.equal((await Invoice.findById(secondInvoice._id)).balanceDue, 800);
  assert.equal((await Party.findById(customer._id)).balance, 1800);

  const availableReel = await ReelUnit.create({
    reelCode: 'INT-ROLL-001', reelWidthInches: 24, bf: 18, gsm: 120, quality: 'Natural',
    originalWeightKg: mongoose.Types.Decimal128.fromString('100'),
    remainingWeightKg: mongoose.Types.Decimal128.fromString('100'),
    ratePerKg: mongoose.Types.Decimal128.fromString('50'),
    landedRatePerKg: mongoose.Types.Decimal128.fromString('52'),
    status: 'available'
  });
  const unavailableReel = await ReelUnit.create({
    reelCode: 'INT-ROLL-002', reelWidthInches: 25, bf: 18, gsm: 120, quality: 'Natural',
    originalWeightKg: mongoose.Types.Decimal128.fromString('10'),
    remainingWeightKg: mongoose.Types.Decimal128.fromString('10'),
    ratePerKg: mongoose.Types.Decimal128.fromString('50'),
    status: 'consumed'
  });

  const failedRun = await api('/api/production', {
    method: 'POST',
    body: {
      shift: 'Morning',
      operatorName: 'Integration Test',
      recoverableWasteKg: 1,
      inputReels: [
        { reelId: String(availableReel._id), requestedWidthInches: 24, weightConsumedKg: 20 },
        { reelId: String(unavailableReel._id), requestedWidthInches: 24, weightConsumedKg: 1 }
      ],
      outputSheets: [{ ply: 3, lengthInches: 36, widthInches: 24, sheetCount: 100, totalWeightKg: 10 }]
    }
  });
  assert.equal(failedRun.status, 409);
  const refreshedReel = await ReelUnit.findById(availableReel._id);
  assert.equal(refreshedReel.remainingWeightKg.toString(), '100');
  assert.equal(await ProductionRun.countDocuments(), 0);
  assert.equal(await StockMovement.countDocuments({ referenceId: availableReel._id }), 0);
});


test('configured ADMIN_EMAIL promotes an existing owner login to active admin', async () => {
  const owner = await User.create({
    name: 'Configured Owner',
    email: 'owner@test.local',
    password: 'OwnerPassword-12345',
    role: 'accountant',
    isActive: false
  });
  process.env.ADMIN_EMAIL = 'owner@test.local';
  delete process.env.ADMIN_PASSWORD;
  await mongoose.disconnect();
  await connectDB();
  const promoted = await User.findById(owner._id);
  assert.equal(promoted.role, 'admin');
  assert.equal(promoted.isActive, true);
});


test('inward posting preserves individual reel weights, landed cost and stock ledger totals', async () => {
  const supplier = await Party.create({ name: 'Inward Integration Supplier', type: 'Supplier' });
  const draft = await api('/api/inward', {
    method: 'POST',
    body: {
      supplierId: String(supplier._id),
      invoiceReference: 'SUP-INV-REELS-001',
      receiptDate: '2026-11-01',
      lines: [{
        reelWidthInches: 36,
        bf: 18,
        gsm: 140,
        quality: 'Natural',
        reelCount: 3,
        totalWeightKg: 450,
        reelWeightsKg: [149, 150, 151],
        ratePerKg: 40,
        freightCharges: 1500,
        otherCharges: 300
      }]
    }
  });
  assert.equal(draft.status, 201);
  assert.deepEqual(draft.data.receipt.lines[0].reelWeightsKg, [149, 150, 151]);
  assert.equal(draft.data.receipt.lines[0].isAggregateWeightOnly, false);

  const mismatch = await api('/api/inward', {
    method: 'POST',
    body: {
      supplierId: String(supplier._id),
      invoiceReference: 'SUP-INV-REELS-BAD',
      receiptDate: '2026-11-14',
      lines: [{
        reelWidthInches: 36, bf: 18, gsm: 140, quality: 'Natural',
        reelCount: 3, totalWeightKg: 450, reelWeightsKg: [149, 150, 150],
        ratePerKg: 40
      }]
    }
  });
  assert.equal(mismatch.status, 400);

  const receiptId = draft.data.receipt._id;
  const posted = await api('/api/inward/' + receiptId + '/post', { method: 'POST' });
  assert.equal(posted.status, 200);
  const reels = await ReelUnit.find({ inwardReceiptId: receiptId }).sort({ reelCode: 1 });
  assert.deepEqual(reels.map(reel => Number(reel.originalWeightKg.toString())), [149, 150, 151]);
  assert.ok(reels.every(reel => Number(reel.landedRatePerKg.toString()) === 44));

  const movement = await StockMovement.findOne({ referenceId: receiptId, movementType: 'inward_receipt' });
  assert.equal(movement.quantityChange, 3);
  assert.equal(Number(movement.weightChangeKg.toString()), 450);
  const liveStock = await api('/api/inventory/reels');
  assert.equal(liveStock.status, 200);
  const receivedSpec = liveStock.data.stock.find(item =>
    item.width === 36 && item.bf === 18 && item.gsm === 140 && item.quality === 'Natural'
  );
  assert.equal(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(receivedSpec.dateAdded)), '2026-11-01');
  const fifoReels = await api('/api/inventory/reels/physical');
  assert.equal(fifoReels.status, 200);
  assert.equal(fifoReels.data.reels[0].reelCode, reels[0].reelCode);

  const duplicatePost = await api('/api/inward/' + receiptId + '/post', { method: 'POST' });
  assert.equal(duplicatePost.status, 409);
  assert.equal(await ReelUnit.countDocuments({ inwardReceiptId: receiptId }), 3);
  assert.equal(await StockMovement.countDocuments({ referenceId: receiptId, movementType: 'inward_receipt' }), 1);

  const firstReel = reels[0];
  const reconciliation = await api('/api/controls/stock-reconciliation', {
    method: 'POST',
    body: {
      countedAt: '2026-11-14',
      reason: 'Verified physical reel weight',
      lines: [{ reelId: String(firstReel._id), countedWeightKg: 148.5 }]
    }
  });
  assert.equal(reconciliation.status, 201);
  const savedReconciliation = await StockReconciliation.findById(reconciliation.data.reconciliation._id);
  assert.equal(Number(savedReconciliation.totalVarianceKg.toString()), -0.5);
  const reconciledReel = await ReelUnit.findById(firstReel._id);
  assert.equal(Number(reconciledReel.originalWeightKg.toString()), 149);
  assert.equal(Number(reconciledReel.remainingWeightKg.toString()), 148.5);
  assert.equal(reconciledReel.status, 'partial');
  const adjustmentMovement = await StockMovement.findOne({
    referenceId: reconciliation.data.reconciliation._id,
    movementType: 'adjustment'
  });
  assert.equal(Number(adjustmentMovement.weightChangeKg.toString()), -0.5);
  assert.equal(await StockReconciliation.countDocuments({ _id: reconciliation.data.reconciliation._id }), 1);

  const aggregateDraft = await api('/api/inward', {
    method: 'POST',
    body: {
      supplierId: String(supplier._id),
      invoiceReference: 'SUP-INV-REELS-002',
      receiptDate: '2026-11-14',
      lines: [{
        reelWidthInches: 36, bf: 18, gsm: 140, quality: 'GY',
        reelCount: 2, totalWeightKg: 100, ratePerKg: 35
      }]
    }
  });
  assert.equal(aggregateDraft.status, 201);
  assert.equal(aggregateDraft.data.receipt.lines[0].isAggregateWeightOnly, true);
  const aggregateId = aggregateDraft.data.receipt._id;
  const aggregatePosted = await api('/api/inward/' + aggregateId + '/post', { method: 'POST' });
  assert.equal(aggregatePosted.status, 200);
  const aggregateReels = await ReelUnit.find({ inwardReceiptId: aggregateId });
  assert.deepEqual(aggregateReels.map(reel => Number(reel.originalWeightKg.toString())), [50, 50]);

  const qualityStocks = await api('/api/inventory/reels');
  const sameDimensions = qualityStocks.data.stock.filter(item =>
    item.width === 36 && item.bf === 18 && item.gsm === 140
  );
  assert.equal(sameDimensions.length, 2);
  assert.notEqual(sameDimensions[0].id, sameDimensions[1].id);
});


test('reel-to-sheet costing and sheet-to-box conversion preserve mass, cost and FIFO traceability', async () => {
  const productionReel = await ReelUnit.create({
    reelCode: 'PHASE2-REEL-001',
    reelWidthInches: 36,
    bf: 18,
    gsm: 140,
    quality: 'Natural',
    originalWeightKg: 100,
    remainingWeightKg: 100,
    ratePerKg: 40,
    landedRatePerKg: 44,
    status: 'available'
  });

  const production = await api('/api/production', {
    method: 'POST',
    body: {
      shift: 'Day',
      operatorName: 'Phase 2 Integration',
      runDate: '2026-10-15',
      inputReels: [{ reelId: String(productionReel._id), requestedWidthInches: 36, weightConsumedKg: 100 }],
      outputSheets: [
        { ply: 3, lengthInches: 36, widthInches: 24, sheetCount: 100, totalWeightKg: 60 },
        { ply: 5, lengthInches: 48, widthInches: 36, sheetCount: 100, totalWeightKg: 30 }
      ],
      recoverableWasteKg: 5
    }
  });
  assert.equal(production.status, 201);

  const run = await ProductionRun.findOne({ runNumber: production.data.runNumber });
  assert.equal(Number(run.totalInputWeightKg.toString()), 100);
  assert.equal(Number(run.totalOutputWeightKg.toString()), 90);
  assert.equal(Number(run.totalMaterialCost.toString()), 4400);
  assert.equal(Number(run.materialCostPerOutputKg.toString()), 48.888889);
  assert.equal(Number(run.recoverableWasteKg.toString()), 5);
  assert.equal(Number(run.processLossKg.toString()), 5);

  const outputSheets = await CorrugatedSheet.find({ productionRunId: run._id }).sort({ ply: 1 });
  assert.equal(outputSheets.length, 2);
  assert.ok(outputSheets.every(sheet => Number(sheet.unitCostPerKg.toString()) === 48.888889));
  const availableBeforeConversion = await api('/api/conversion/sheets');
  assert.equal(availableBeforeConversion.status, 200);
  assert.equal(availableBeforeConversion.data.sheets[0].productionRunId.runNumber, run.runNumber);

  const overdrawnConversion = await api('/api/conversion', {
    method: 'POST',
    body: {
      sheetId: String(outputSheets[0]._id),
      sheetsConsumed: 101,
      customerId: String(party._id),
      itemName: 'Overdraw Test Box',
      dimensions: { length: 12, width: 10, height: 8 },
      boxesProduced: 1,
      conversionDate: '2026-10-16'
    }
  });
  assert.equal(overdrawnConversion.status, 409);
  assert.equal((await CorrugatedSheet.findById(outputSheets[0]._id)).sheetCount, 100);

  const conversion = await api('/api/conversion', {
    method: 'POST',
    body: {
      sheetId: String(outputSheets[0]._id),
      sheetsConsumed: 50,
      customerId: String(party._id),
      itemName: 'Phase 2 Test Box',
      dimensions: { length: 12, width: 10, height: 8 },
      boxesProduced: 1000,
      conversionDate: '2026-10-16'
    }
  });
  assert.equal(conversion.status, 201);
  const finishedBox = await FinishedBox.findOne({ batchNumber: conversion.data.batchNumber });
  assert.equal(finishedBox.quantityProduced, 1000);
  assert.equal(finishedBox.quantityAvailable, 1000);
  assert.equal(finishedBox.costingStatus, 'available');
  assert.equal(finishedBox.materialCost, 1466.67);
  assert.equal(finishedBox.costPerBox, 1.47);

  const remainingSheet = await CorrugatedSheet.findById(outputSheets[0]._id);
  assert.equal(remainingSheet.sheetCount, 50);
  assert.equal(Number(remainingSheet.totalWeightKg.toString()), 30);
  const wrongCustomer = await Party.create({ name: 'Dispatch Wrong Customer', type: 'Customer' });
  const wrongDispatch = await api('/api/dispatch', {
    method: 'POST',
    body: {
      customerId: String(wrongCustomer._id),
      dispatchDate: '2026-10-17',
      boxes: [{ boxId: String(finishedBox._id), dispatchQuantity: 1 }]
    }
  });
  assert.equal(wrongDispatch.status, 400);
  assert.equal((await FinishedBox.findById(finishedBox._id)).quantityAvailable, 1000);

  const overshipped = await api('/api/dispatch', {
    method: 'POST',
    body: {
      customerId: String(party._id),
      dispatchDate: '2026-10-17',
      boxes: [{ boxId: String(finishedBox._id), dispatchQuantity: 1001 }]
    }
  });
  assert.equal(overshipped.status, 409);
  assert.equal((await FinishedBox.findById(finishedBox._id)).quantityAvailable, 1000);

  const dispatchResponse = await api('/api/dispatch', {
    method: 'POST',
    body: {
      customerId: String(party._id),
      dispatchDate: '2026-10-17',
      vehicleNumber: 'MP07AB1234',
      driverName: 'Integration Driver',
      boxes: [
        { boxId: String(finishedBox._id), dispatchQuantity: 250 },
        { boxId: String(finishedBox._id), dispatchQuantity: 350 }
      ]
    }
  });
  assert.equal(dispatchResponse.status, 201);
  const dispatch = await Dispatch.findOne({ challanNumber: dispatchResponse.data.challanNumber });
  assert.equal(dispatch.boxes.length, 1);
  assert.equal(dispatch.boxes[0].dispatchQuantity, 600);
  const partiallyDispatchedBox = await FinishedBox.findById(finishedBox._id);
  assert.equal(partiallyDispatchedBox.quantityAvailable, 400);
  assert.equal(partiallyDispatchedBox.status, 'available');
  const dispatchMovement = await StockMovement.findOne({
    referenceId: finishedBox._id,
    movementType: 'dispatch'
  });
  assert.equal(dispatchMovement.quantityChange, -600);
  const dispatchHistory = await api('/api/dispatch?from=2026-10-17&to=2026-10-17');
  assert.equal(dispatchHistory.status, 200);
  assert.ok(dispatchHistory.data.dispatches.some(item => item.challanNumber === dispatch.challanNumber));

  const incompleteInvoice = await api('/api/invoices', {
    method: 'POST',
    body: {
      invoiceDate: '2026-10-17',
      customerId: String(party._id),
      dispatchId: String(dispatch._id),
      items: [{ boxId: String(finishedBox._id), quantity: 599, rate: 20 }],
      gstPercent: 5
    }
  });
  assert.equal(incompleteInvoice.status, 400);
  assert.equal(await Invoice.countDocuments({ dispatchId: dispatch._id }), 0);

  const invoiceResponse = await api('/api/invoices', {
    method: 'POST',
    body: {
      invoiceDate: '2026-10-17',
      customerId: String(party._id),
      dispatchId: String(dispatch._id),
      items: [{ boxId: String(finishedBox._id), quantity: 600, rate: 20 }],
      gstPercent: 5
    }
  });
  assert.equal(invoiceResponse.status, 201);
  const invoice = await Invoice.findOne({ dispatchId: dispatch._id });
  assert.equal(invoice.subTotal, 12000);
  assert.equal(invoice.cgstAmount, 300);
  assert.equal(invoice.sgstAmount, 300);
  assert.equal(invoice.grandTotal, 12600);
  assert.equal(invoice.costOfGoods, 882);
  assert.equal(invoice.grossProfit, 11118);
  assert.equal((await Party.findById(party._id)).balance, 12600);

  const duplicateInvoice = await api('/api/invoices', {
    method: 'POST',
    body: {
      invoiceDate: '2026-10-17',
      customerId: String(party._id),
      dispatchId: String(dispatch._id),
      items: [{ boxId: String(finishedBox._id), quantity: 600, rate: 20 }],
      gstPercent: 5
    }
  });
  assert.equal(duplicateInvoice.status, 409);

  const wrongPaymentDirection = await api('/api/parties/' + party._id + '/transaction', {
    method: 'POST',
    body: { amount: 100, mode: 'NEFT', ref: 'WRONG-DIRECTION', direction: 'out', date: '2026-10-18' }
  });
  assert.equal(wrongPaymentDirection.status, 400);
  assert.equal((await Party.findById(party._id)).balance, 12600);

  const firstPayment = await api('/api/parties/' + party._id + '/transaction', {
    method: 'POST',
    body: { amount: 5000, mode: 'NEFT', ref: 'UTR-PHASE5-001', direction: 'in', date: '2026-10-18' }
  });
  assert.equal(firstPayment.status, 200);
  let updatedInvoice = await Invoice.findById(invoice._id);
  assert.equal(updatedInvoice.balanceDue, 7600);
  assert.equal(updatedInvoice.status, 'Pending');
  assert.equal(updatedInvoice.payments.length, 1);
  assert.equal(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(updatedInvoice.payments[0].date), '2026-10-18');
  assert.equal(firstPayment.data.balance, 7600);

  const finalPayment = await api('/api/parties/' + party._id + '/transaction', {
    method: 'POST',
    body: { amount: 7600, mode: 'RTGS', ref: 'UTR-PHASE5-002', direction: 'in', date: '2026-10-19' }
  });
  assert.equal(finalPayment.status, 200);
  updatedInvoice = await Invoice.findById(invoice._id);
  assert.equal(updatedInvoice.balanceDue, 0);
  assert.equal(updatedInvoice.status, 'Paid');
  assert.equal(updatedInvoice.payments.length, 2);
  assert.equal(finalPayment.data.balance, 0);

  for (const expense of [
    { expenseDate: '2026-10-18', category: 'electricity', amount: 200, paymentMode: 'bank_transfer', costTreatment: 'operating_expense' },
    { expenseDate: '2026-10-18', category: 'interest', amount: 100, paymentMode: 'bank_transfer', costTreatment: 'finance_cost' },
    { expenseDate: '2026-10-18', category: 'freight', amount: 50, paymentMode: 'bank_transfer', costTreatment: 'stock_landed_cost' }
  ]) {
    const createdExpense = await api('/api/expenses', { method: 'POST', body: expense });
    assert.equal(createdExpense.status, 201);
  }

  const profitLoss = await api('/api/reports/profit-loss?from=2026-10-15&to=2026-10-20');
  assert.equal(profitLoss.status, 200);
  assert.equal(profitLoss.data.summary.invoiceCount, 1);
  assert.equal(profitLoss.data.summary.revenue, 12000);
  assert.equal(profitLoss.data.summary.costOfGoods, 882);
  assert.equal(profitLoss.data.summary.grossProfit, 11118);
  assert.equal(profitLoss.data.summary.balanceDue, 0);
  assert.equal(profitLoss.data.summary.operatingExpenses, 200);
  assert.equal(profitLoss.data.summary.financeCosts, 100);
  assert.equal(profitLoss.data.summary.stockLandedCosts, 50);
  assert.equal(profitLoss.data.summary.operatingProfit, 10918);
  assert.equal(profitLoss.data.summary.netProfitBeforeTax, 10818);
  assert.equal(profitLoss.data.summary.expenseCount, 3);
  assert.equal(profitLoss.data.summary.operatingExpenseCount, 1);
  assert.equal(profitLoss.data.summary.financeCostCount, 1);
  assert.equal(profitLoss.data.summary.stockLandedCostCount, 1);
  assert.equal(profitLoss.data.summary.recoverableScrapGeneratedKg, 5);
  assert.equal(profitLoss.data.expenseByCategory.length, 3);
  assert.equal(profitLoss.data.summary.processLossKg, 5);
  assert.equal(profitLoss.data.summary.processLossCostEstimate, 220);
  const misleadingPartyFilter = await api('/api/reports/profit-loss?from=2026-10-15&to=2026-10-20&partyId=' + party._id);
  assert.equal(misleadingPartyFilter.status, 400);

  const sheetIssue = await StockMovement.findOne({
    referenceId: outputSheets[0]._id,
    movementType: 'production_issue'
  });
  assert.equal(sheetIssue.quantityChange, -50);
  assert.equal(Number(sheetIssue.weightChangeKg.toString()), -30);
  const finishedMovement = await StockMovement.findOne({
    referenceId: finishedBox._id,
    itemType: 'finished_good'
  });
  assert.equal(finishedMovement.quantityChange, 1000);

  const tinyResidualReel = await ReelUnit.create({
    reelCode: 'PHASE2-REEL-002',
    reelWidthInches: 24,
    bf: 18,
    gsm: 120,
    quality: 'Natural',
    originalWeightKg: 100,
    remainingWeightKg: 100,
    ratePerKg: 10,
    landedRatePerKg: 10,
    status: 'available'
  });
  const tinyResidualRun = await api('/api/production', {
    method: 'POST',
    body: {
      shift: 'Night',
      operatorName: 'Residual Stock Test',
      runDate: '2026-10-20',
      inputReels: [{ reelId: String(tinyResidualReel._id), requestedWidthInches: 24, weightConsumedKg: 99.9995 }],
      outputSheets: [{ ply: 3, lengthInches: 24, widthInches: 18, sheetCount: 10, totalWeightKg: 99 }],
      recoverableWasteKg: 0.1
    }
  });
  assert.equal(tinyResidualRun.status, 201);
  const residual = await ReelUnit.findById(tinyResidualReel._id);
  assert.equal(residual.status, 'partial');
  assert.ok(Math.abs(Number(residual.remainingWeightKg.toString()) - 0.0005) < 1e-9);

  const fifoSheets = await api('/api/conversion/sheets');
  assert.equal(fifoSheets.status, 200);
  assert.equal(fifoSheets.data.sheets[0].productionRunId.runNumber, run.runNumber);
  assert.equal(fifoSheets.data.sheets.at(-1).productionRunId.runNumber, tinyResidualRun.data.runNumber);
});
