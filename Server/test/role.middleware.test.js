const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('../src/middlewares/role.middleware');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('allows an admin through an admin-only route', () => {
  const req = { user: { role: 'admin' } };
  const res = responseRecorder();
  let called = false;
  requireRole('admin')(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

test('blocks an accountant from admin-only routes', () => {
  const req = { user: { role: 'accountant' } };
  const res = responseRecorder();
  let called = false;
  requireRole('admin')(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /permission/i);
});

test('blocks unauthenticated requests even if middleware is mounted incorrectly', () => {
  const req = {};
  const res = responseRecorder();
  let called = false;
  requireRole('admin')(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
});
