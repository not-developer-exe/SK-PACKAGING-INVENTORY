const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeJobWorkOrders } = require('../src/utils/jobWorkReconciliation');

test('groups processor activity and reconciles returned, wasted and outstanding sheets', () => {
  const result = summarizeJobWorkOrders([
    { jobWorkerName: 'Pintu', status: 'partial_return', issuedSheets: 100, returnedSheets: 60, wastageSheets: 10, issuedWeightKg: 50, returnedWeightKg: 29, wastageWeightKg: 5, jobCharges: 300, inputMaterialCost: 1000, allocatedInputMaterialCost: 580, allocatedWastageMaterialCost: 100 },
    { jobWorkerName: 'PINTU', status: 'completed', issuedSheets: 20, returnedSheets: 20, wastageSheets: 0, issuedWeightKg: 10, returnedWeightKg: 9.5, wastageWeightKg: 0, jobCharges: 100, inputMaterialCost: 200, allocatedInputMaterialCost: 190, allocatedWastageMaterialCost: 0 },
    { jobWorkerName: 'Jai Mata Di', status: 'issued', issuedSheets: 30, returnedSheets: 0, wastageSheets: 0, issuedWeightKg: 12, returnedWeightKg: 0, wastageWeightKg: 0, jobCharges: 0, inputMaterialCost: 240, allocatedInputMaterialCost: 0, allocatedWastageMaterialCost: 0 }
  ]);
  assert.equal(result.processors.length, 2);
  const pintu = result.processors.find(x => x.jobWorkerName === 'Pintu');
  assert.equal(pintu.orders, 2);
  assert.equal(pintu.outstandingSheets, 30);
  assert.equal(pintu.allocatedInputMaterialCost, 770);
  assert.equal(pintu.allocatedWastageMaterialCost, 100);
  assert.equal(pintu.unallocatedMaterialCost, 330);
  assert.equal(result.totals.outstandingSheets, 60);
  assert.equal(result.totals.jobCharges, 400);
});

test('handles an empty processor register', () => {
  assert.deepEqual(summarizeJobWorkOrders([]).totals, {
    orders: 0, openOrders: 0, issuedSheets: 0, returnedSheets: 0,
    wastageSheets: 0, outstandingSheets: 0, jobCharges: 0,
    allocatedInputMaterialCost: 0, allocatedWastageMaterialCost: 0, unallocatedMaterialCost: 0
  });
});
