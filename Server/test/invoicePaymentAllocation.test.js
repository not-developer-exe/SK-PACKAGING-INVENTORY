const test = require('node:test');
const assert = require('node:assert/strict');
const { allocateInvoicePayment } = require('../src/utils/invoicePaymentAllocation');

test('allocates payment to oldest open invoices in supplied order', () => {
  assert.deepEqual(allocateInvoicePayment(1500, [
    { invoiceId: 'a', balanceDue: 1000 },
    { invoiceId: 'b', balanceDue: 800 }
  ]), {
    allocations: [{ invoiceId: 'a', amount: 1000 }, { invoiceId: 'b', amount: 500 }],
    unallocatedAmount: 0
  });
});

test('supports a partial payment against a single invoice', () => {
  assert.deepEqual(allocateInvoicePayment(250, [
    { invoiceId: 'a', balanceDue: 900 }
  ]), {
    allocations: [{ invoiceId: 'a', amount: 250 }],
    unallocatedAmount: 0
  });
});

test('retains excess receipts as unallocated customer advance', () => {
  assert.deepEqual(allocateInvoicePayment(1200, [
    { invoiceId: 'a', balanceDue: 700 }
  ]), {
    allocations: [{ invoiceId: 'a', amount: 700 }],
    unallocatedAmount: 500
  });
});

test('skips invoices without a positive balance', () => {
  assert.deepEqual(allocateInvoicePayment(200, [
    { invoiceId: 'a', balanceDue: 0 },
    { invoiceId: 'b', balanceDue: 100 }
  ]), {
    allocations: [{ invoiceId: 'b', amount: 100 }],
    unallocatedAmount: 100
  });
});

test('rejects invalid payment amounts', () => {
  assert.throws(() => allocateInvoicePayment(-1, []), /invalid/);
});
