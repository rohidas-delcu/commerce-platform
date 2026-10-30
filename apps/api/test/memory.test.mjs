import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { MemoryCommerceRepository } from '../src/infrastructure/memory-commerce.repository.ts';

const store = () => ({ id: randomUUID(), ownerSubjectId: 'merchant-a', name: 'Store',
  handle: randomUUID(), countryCode: 'IN', currencyCode: 'INR', status: 'DRAFT', createdAt: new Date().toISOString() });
const product = storeId => ({ id: randomUUID(), storeId, version: 0, name: 'Bag', handle: 'bag',
  description: '', collection: '', priceMinor: '999999999999999999', compareMinor: null,
  status: 'DRAFT', createdAt: new Date().toISOString(),
  variants: [{ id: randomUUID(), name: 'Black', sku: 'BAG-001', stock: 10 }] });
const adjustment = (s, p, after = 15) => ({ storeId: s.id, variantId: p.variants[0].id,
  after, reason: 'RECEIVED', note: '', actorSubjectId: 'merchant-a' });

test('concurrent memory writes enforce store, product and SKU uniqueness atomically', async () => {
  const repo = new MemoryCommerceRepository(false);
  const s = store();
  const stores = await Promise.allSettled([repo.createStore(s), repo.createStore({ ...store(), handle: s.handle })]);
  assert.equal(stores.filter(r => r.status === 'fulfilled').length, 1);
  const p = product(s.id);
  const products = await Promise.allSettled([repo.createProduct(p), repo.createProduct({ ...product(s.id), variants: [{ ...p.variants[0], id: randomUUID(), sku: 'OTHER' }] })]);
  assert.equal(products.filter(r => r.status === 'fulfilled').length, 1);
  const other = product(s.id);
  await assert.rejects(repo.createProduct({ ...other, handle: 'other' }), { code: 'CONFLICT' });
  assert.equal((await repo.listProducts(s.id)).length, 1);
});

test('metadata updates cannot overwrite newer inventory and reads are isolated copies', async () => {
  const repo = new MemoryCommerceRepository(false), s = store(), p = product(s.id);
  await repo.createStore(s); await repo.createProduct(p);
  const stale = await repo.findProduct(s.id, p.id);
  await repo.adjustStock(adjustment(s, p));
  stale.name = 'Renamed';
  const saved = await repo.saveProduct(stale);
  assert.equal(saved.name, 'Renamed'); assert.equal(saved.variants[0].stock, 15);
  saved.variants[0].stock = -1;
  assert.equal((await repo.findProduct(s.id, p.id)).variants[0].stock, 15);
  assert.equal(await repo.findProduct(randomUUID(), p.id), null);
});

test('rejected stock adjustments leave inventory and movements unchanged', async () => {
  const repo = new MemoryCommerceRepository(false), s = store(), p = product(s.id);
  await repo.createStore(s); await repo.createProduct(p);
  for (const invalid of [{ after: -1 }, { after: 10 }, { reason: 'UNKNOWN' }]) {
    await assert.rejects(repo.adjustStock({ ...adjustment(s, p), ...invalid }), { code: 'INVALID' });
  }
  assert.equal((await repo.findProduct(s.id, p.id)).variants[0].stock, 10);
  assert.deepEqual(await repo.listMovements(s.id), []);
  const results = await Promise.allSettled([repo.adjustStock(adjustment(s, p)), repo.adjustStock(adjustment(s, p))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await repo.listMovements(s.id)).length, 1);
});

test('memory instances do not share data or mutate caller objects', async () => {
  const one = new MemoryCommerceRepository(false), two = new MemoryCommerceRepository(false), s = store();
  await one.createStore(s); s.name = 'Mutated';
  assert.equal((await one.findStoreById(s.id)).name, 'Store');
  assert.equal(await two.findStoreById(s.id), null);
  await one.checkHealth();
});


test('stale product metadata cannot undo a concurrent activation or edit', async () => {
  const repo = new MemoryCommerceRepository(false), s = store(), p = product(s.id);
  await repo.createStore(s); await repo.createProduct(p);
  const stale = await repo.findProduct(s.id, p.id);
  await repo.saveProduct({ ...p, status: 'ACTIVE' });
  await assert.rejects(repo.saveProduct({ ...stale, name: 'Stale edit' }), { code: 'CONFLICT' });
  const saved = await repo.findProduct(s.id, p.id);
  assert.equal(saved.status, 'ACTIVE'); assert.equal(saved.version, 1);
});

test('concurrent products with different handles cannot reuse a store SKU', async () => {
  const repo = new MemoryCommerceRepository(false), s = store();
  await repo.createStore(s);
  const results = await Promise.allSettled([repo.createProduct(product(s.id)), repo.createProduct({ ...product(s.id), handle: 'other' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'CONFLICT');
});
