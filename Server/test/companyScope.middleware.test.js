const test = require('node:test');
const assert = require('node:assert/strict');
const { useCompany } = require('../src/middlewares/companyScope.middleware');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('NSB company scope rejects accountant access', () => {
  const req = { user: { role: 'accountant' } };
  const res = response();
  let continued = false;
  useCompany('nsb-industrial-solutions')(req, res, () => { continued = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(continued, false);
  assert.equal(req.companyKey, undefined);
});

test('NSB company scope assigns NSB only for an administrator', () => {
  const req = { user: { role: 'admin' } };
  const res = response();
  let continued = false;
  useCompany('nsb-industrial-solutions')(req, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(req.companyKey, 'nsb-industrial-solutions');
});

test('S.K company scope assigns the S.K workspace', () => {
  const req = { user: { role: 'accountant' } };
  const res = response();
  useCompany('sk-packaging')(req, res, () => {});
  assert.equal(req.companyKey, 'sk-packaging');
});
