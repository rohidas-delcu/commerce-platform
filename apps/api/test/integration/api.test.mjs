import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const port = 13000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, NODE_ENV: 'development', DEMO_AUTH_ENABLED: 'true',
  DATA_DRIVER: process.env.TEST_DATA_DRIVER || 'memory', PORT: String(port) };

async function request(path, method = 'GET', body, subject = 'test-merchant') {
  const response = await fetch(base + path, { method,
    headers: { 'content-type': 'application/json', ...(subject ? { 'x-demo-subject-id': subject } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

test('store, product and inventory flow preserves ownership and storefront privacy', { timeout: 20000 }, async t => {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: new URL('../../', import.meta.url), env, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', b => { output += b; });
  child.stderr.on('data', b => { output += b; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      const deadline = setTimeout(() => child.kill('SIGKILL'), 5000);
      deadline.unref();
      child.kill('SIGTERM');
      try {
        const [code, signal] = await exited;
        assert.notEqual(signal, 'SIGKILL', 'API must release resources on shutdown.');
        assert.ok(code === 0 || signal === 'SIGTERM');
      } finally { clearTimeout(deadline); }
    }
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) assert.fail(output);
    try { ready = (await request('/health')).status === 200; } catch {}
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, output);
  const documentation=await request('/docs-json');
  assert.equal(documentation.status,200);
  assert.equal(documentation.body.components.schemas.SignupDto.properties.email.type,'string');
  assert.equal(documentation.body.components.schemas.StoreDto.properties.merchantId.type,'string');
  assert.ok(documentation.body.paths['/v1/merchant/stores']);
  assert.equal(documentation.body.components.schemas.SignupDto.properties.password.minLength,15);
  assert.equal(documentation.body.components.securitySchemes.merchantSession.in,'cookie');
  assert.deepEqual((await request('/health')).body, { status: 'ok' });
  assert.deepEqual((await request('/health/ready')).body, { status: 'ready' });
  assert.deepEqual((await request('/missing-route')).body, { statusCode: 404, code: 'NOT_FOUND', message: 'Cannot GET /missing-route' });
  assert.equal((await request('/v1/admin/stores/not-a-uuid/products')).body.code, 'INVALID');
  assert.equal((await request('/v1/admin/stores', 'GET', undefined, null)).status, 403);
  assert.equal((await request('/v1/admin/stores', 'POST', { name: 'Invalid', handle: 'bad', extra: true })).status, 400);
  const handle = `test-${Date.now()}`;
  const created = await request('/v1/admin/stores', 'POST', { name: 'Test store', handle });
  assert.equal(created.status, 201);
  const store = created.body;
  const admin = `/v1/admin/stores/${store.id}`;
  assert.equal((await request(`/v1/storefront/${handle}/products`)).status, 404);
  assert.equal((await request(`${admin}/products`, 'GET', undefined, 'other-merchant')).status, 404);
  assert.equal((await request('/v1/admin/stores', 'POST', { name: 'Duplicate', handle })).status, 409);
  const product = await request(`${admin}/products`, 'POST', {
    name: 'Backpack', handle: 'backpack', priceMinor: '199900',
    variants: [{ name: 'Black', sku: 'BAG-001', stock: 10 }]
  });
  assert.equal(product.status, 201);
  // A merchant's ownership of both stores must not bypass store-scoped references.
  const second = await request('/v1/admin/stores', 'POST', { name: 'Second store', handle: `${handle}-second` });
  assert.equal(second.status, 201);
  const secondAdmin = `/v1/admin/stores/${second.body.id}`;
  const secondProduct = await request(`${secondAdmin}/products`, 'POST', {
    name: 'Backpack', handle: 'backpack', priceMinor: '100',
    variants: [{ name: 'Black', sku: 'BAG-001', stock: 2 }]
  });
  assert.equal(secondProduct.status, 201, 'Handles and SKUs may repeat in different stores.');
  assert.equal((await request(`${secondAdmin}/products/${product.body.id}`, 'PATCH', { name: 'Wrong store' })).status, 404);
  assert.equal((await request(`${secondAdmin}/products/${product.body.id}/activate`, 'POST')).status, 404);
  assert.equal((await request(`${secondAdmin}/variants/${product.body.variants[0].id}/stock-adjustments`, 'POST', { quantity: 1, reason: 'DAMAGED' })).status, 404);
  assert.deepEqual((await request(`${secondAdmin}/inventory-movements`)).body, []);

  for (const [path, method, body] of [
    [`${admin}/publish`, 'POST'], [`${admin}/products`, 'POST', { name: 'Other', handle: 'other', priceMinor: '100', variants: [{ name: 'One', sku: 'OTHER', stock: 0 }] }],
    [`${admin}/products/${product.body.id}`, 'PATCH', { name: 'Stolen' }],
    [`${admin}/products/${product.body.id}/activate`, 'POST'],
    [`${admin}/variants/${product.body.variants[0].id}/stock-adjustments`, 'POST', { quantity: 1, reason: 'DAMAGED' }],
    [`${admin}/inventory-movements`, 'GET']
  ]) assert.equal((await request(path, method, body, 'other-merchant')).status, 404);
  const duplicateBody = { name: 'Other', handle: 'backpack', priceMinor: '100', variants: [{ name: 'One', sku: 'OTHER', stock: 0 }] };
  assert.equal((await request(`${admin}/products`, 'POST', duplicateBody)).status, 409);
  assert.equal((await request(`${admin}/products`, 'POST', { ...duplicateBody, handle: 'other', variants: [{ name: 'One', sku: 'bag-001', stock: 0 }] })).status, 409);
  for (const field of ['name', 'handle', 'description', 'collection', 'priceMinor']) {
    const invalid = await request(`${admin}/products/${product.body.id}`, 'PATCH', { [field]: null });
    assert.equal(invalid.status, 400); assert.equal(invalid.body.code, 'INVALID');
  }
  for (const priceMinor of [199900, '1.5', '0', '1000000000000000000']) {
    assert.equal((await request(`${admin}/products/${product.body.id}`, 'PATCH', { priceMinor })).status, 400);
  }
  const exact = await request(`${admin}/products/${product.body.id}`, 'PATCH', { priceMinor: '999999999999999999' });
  assert.equal(exact.body.priceMinor, '999999999999999999');
  assert.equal((await request(`${admin}/products/${product.body.id}`, 'PATCH', { compareMinor: '1' })).status, 400);
  assert.equal((await request(`${admin}/products/${product.body.id}`, 'PATCH', { compareMinor: null })).status, 200);
  assert.equal((await request(`${admin}/publish`, 'POST')).status, 201);
  assert.deepEqual((await request(`/v1/storefront/${handle}/products`)).body.products, []);
  assert.equal((await request(`${admin}/products/${product.body.id}/activate`, 'POST')).status, 201);
  assert.equal((await request(`${admin}/products/${product.body.id}`, 'PATCH', { priceMinor: '299900' })).status, 200);
  const stockPath = `${admin}/variants/${product.body.variants[0].id}/stock-adjustments`;
  const movement = await request(stockPath, 'POST', { quantity: 15, reason: 'RECEIVED' });
  assert.equal(movement.status, 201);
  assert.equal(movement.body.delta, 5);
  assert.equal((await request(stockPath, 'POST', { quantity: 15, reason: 'RECEIVED' })).status, 400);
  const history = await request(`${admin}/inventory-movements`);
  assert.equal(history.status, 200);
  assert.equal(history.body[0].after, 15);
  const catalog = await request(`/v1/storefront/${handle}/products`, 'GET', undefined, null);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.products[0].priceMinor, '299900');
  assert.equal(catalog.body.products[0].variants[0].stock, 15);
  assert.equal('sku' in catalog.body.products[0].variants[0], false);
  assert.equal('ownerSubjectId' in catalog.body.store, false);
  assert.equal('storeId' in catalog.body.products[0], false);
  assert.equal('version' in catalog.body.products[0], false);
  const racing = { name: 'Race', handle: 'race', priceMinor: '100', variants: [{ name: 'One', sku: 'RACE-1', stock: 1 }] };
  const races = await Promise.all([request(`${admin}/products`, 'POST', racing), request(`${admin}/products`, 'POST', { ...racing, handle: 'race-other' })]);
  assert.deepEqual(races.map(r => r.status).sort(), [201, 409]);
  assert.equal((await request(`/v1/storefront/${handle}/products`)).body.products.length, 1);
  assert.ok(!output.includes('x-demo-subject-id:'));
  if (process.env.DATABASE_URL) assert.ok(!output.includes(process.env.DATABASE_URL));
});

test('production startup refuses demo authentication', async () => {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stderr.on('data', b => { output += b; });
  child.stdout.on('data', b => { output += b; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(output, /Production mode is disabled until backend acceptance and security review pass/);
});

test('demo guard requires explicit development mode, opt-in and a valid subject', async () => {
  const { LocalDemoAuthGuard } = await import('../../dist/http/commerce.controller.js');
  const previous = { NODE_ENV: process.env.NODE_ENV, DEMO_AUTH_ENABLED: process.env.DEMO_AUTH_ENABLED };
  const guard = new LocalDemoAuthGuard();
  const context = subject => ({ switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-demo-subject-id': subject } }) }) });
  try {
    process.env.DEMO_AUTH_ENABLED = 'true';
    for (const mode of ['production', 'staging', 'test', '']) {
      process.env.NODE_ENV = mode;
      assert.throws(() => guard.canActivate(context('demo-merchant')), /Demo authentication is disabled/);
    }
    process.env.NODE_ENV = 'development';
    process.env.DEMO_AUTH_ENABLED = 'false';
    assert.throws(() => guard.canActivate(context('demo-merchant')), /Demo authentication is disabled/);
    process.env.DEMO_AUTH_ENABLED = 'true';
    assert.throws(() => guard.canActivate(context(undefined)), /Valid x-demo-subject-id/);
    assert.throws(() => guard.canActivate(context(['demo-merchant'])), /Valid x-demo-subject-id/);
    assert.equal(guard.canActivate(context('demo-merchant')), true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('startup rejects invalid configuration and unavailable PostgreSQL without leaking details', { timeout: 20000 }, async () => {
  for (const overrides of [
    { DATA_DRIVER: 'invalid' },
    { PORT: '0' },
    { DATA_DRIVER: 'postgres', DATABASE_URL: 'postgresql://test:never-log-this@127.0.0.1:1/unavailable' }
  ]) {
    const child = spawn(process.execPath, ['dist/main.js'], {
      cwd: new URL('../../', import.meta.url), env: { ...env, ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 7000
    });
    let output = '';
    child.stdout.on('data', b => { output += b; });
    child.stderr.on('data', b => { output += b; });
    const [code, signal] = await once(child, 'exit');
    assert.equal(signal, null, 'Startup failure must exit without timeout termination.');
    assert.equal(code, 1);
    assert.ok(!output.includes('never-log-this'));
    assert.ok(!output.includes('Commerce API listening'));
  }
});
