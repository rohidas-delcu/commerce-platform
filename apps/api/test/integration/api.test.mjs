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

test('store, product and inventory flow preserves ownership and storefront privacy', async t => {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: new URL('../../', import.meta.url), env, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', b => { output += b; });
  child.stderr.on('data', b => { output += b; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
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
});

test('production startup refuses demo authentication', async () => {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: new URL('../../', import.meta.url),
    env: { ...env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stderr.on('data', b => { output += b; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(output, /Production mode requires real merchant authentication/);
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
