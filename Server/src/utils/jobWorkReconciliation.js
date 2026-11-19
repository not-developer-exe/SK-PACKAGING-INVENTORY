const num = value => Number(value?.toString?.() ?? value ?? 0);

function summarizeJobWorkOrders(orders = []) {
  const byWorker = new Map();
  for (const order of orders) {
    const key = String(order.jobWorkerName || '').trim().toLowerCase();
    const row = byWorker.get(key) || {
      jobWorkerName: order.jobWorkerName, orders: 0, openOrders: 0,
      issuedSheets: 0, returnedSheets: 0, wastageSheets: 0, outstandingSheets: 0,
      issuedWeightKg: 0, returnedWeightKg: 0, wastageWeightKg: 0,
      jobCharges: 0, inputMaterialCost: 0, allocatedInputMaterialCost: 0,
      allocatedWastageMaterialCost: 0
    };
    row.orders += 1;
    if (!['completed', 'cancelled'].includes(order.status)) row.openOrders += 1;
    row.issuedSheets += num(order.issuedSheets);
    row.returnedSheets += num(order.returnedSheets);
    row.wastageSheets += num(order.wastageSheets);
    row.outstandingSheets += Math.max(0, num(order.issuedSheets) - num(order.returnedSheets) - num(order.wastageSheets));
    row.issuedWeightKg += num(order.issuedWeightKg);
    row.returnedWeightKg += num(order.returnedWeightKg);
    row.wastageWeightKg += num(order.wastageWeightKg);
    row.jobCharges += num(order.jobCharges);
    row.inputMaterialCost += num(order.inputMaterialCost);
    row.allocatedInputMaterialCost += num(order.allocatedInputMaterialCost);
    row.allocatedWastageMaterialCost += num(order.allocatedWastageMaterialCost);
    byWorker.set(key, row);
  }
  const processors = [...byWorker.values()].map(row => ({
    ...row,
    issuedWeightKg: Number(row.issuedWeightKg.toFixed(3)),
    returnedWeightKg: Number(row.returnedWeightKg.toFixed(3)),
    wastageWeightKg: Number(row.wastageWeightKg.toFixed(3)),
    jobCharges: Number(row.jobCharges.toFixed(2)),
    inputMaterialCost: Number(row.inputMaterialCost.toFixed(2)),
    allocatedInputMaterialCost: Number(row.allocatedInputMaterialCost.toFixed(2)),
    allocatedWastageMaterialCost: Number(row.allocatedWastageMaterialCost.toFixed(2)),
    unallocatedMaterialCost: Number(Math.max(0, row.inputMaterialCost - row.allocatedInputMaterialCost - row.allocatedWastageMaterialCost).toFixed(2))
  })).sort((a, b) => a.jobWorkerName.localeCompare(b.jobWorkerName));
  const totals = processors.reduce((t, p) => ({
    orders: t.orders + p.orders, openOrders: t.openOrders + p.openOrders,
    issuedSheets: t.issuedSheets + p.issuedSheets, returnedSheets: t.returnedSheets + p.returnedSheets,
    wastageSheets: t.wastageSheets + p.wastageSheets, outstandingSheets: t.outstandingSheets + p.outstandingSheets,
    jobCharges: Number((t.jobCharges + p.jobCharges).toFixed(2)),
    allocatedInputMaterialCost: Number((t.allocatedInputMaterialCost + p.allocatedInputMaterialCost).toFixed(2)),
    allocatedWastageMaterialCost: Number((t.allocatedWastageMaterialCost + p.allocatedWastageMaterialCost).toFixed(2)),
    unallocatedMaterialCost: Number((t.unallocatedMaterialCost + p.unallocatedMaterialCost).toFixed(2))
  }), {
    orders: 0, openOrders: 0, issuedSheets: 0, returnedSheets: 0,
    wastageSheets: 0, outstandingSheets: 0, jobCharges: 0,
    allocatedInputMaterialCost: 0, allocatedWastageMaterialCost: 0, unallocatedMaterialCost: 0
  });
  return { processors, totals };
}

module.exports = { summarizeJobWorkOrders };
