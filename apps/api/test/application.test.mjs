import assert from 'node:assert/strict';
import test from 'node:test';
import { CommerceService } from '../src/application/commerce.service.ts';
import { MemoryCommerceRepository } from '../src/infrastructure/memory-commerce.repository.ts';

test('application enforces ownership on every scoped operation and publication visibility', async () => {
  const repo = new MemoryCommerceRepository(false), app = new CommerceService(repo);
  const store = await app.createStore('owner', { name: 'Store', handle: 'store' });
  const product = await app.createProduct('owner', store.id, { name: 'Bag', handle: 'bag', priceMinor: '999999999999999999', variants: [{ name: 'One', sku: 'BAG-1', stock: 10 }] });
  const variant = product.variants[0];
  for (const call of [() => app.publishStore('other', store.id), () => app.listProducts('other', store.id),
    () => app.createProduct('other', store.id, {}), () => app.updateProduct('other', store.id, product.id, {}),
    () => app.activateProduct('other', store.id, product.id), () => app.adjustStock('other', store.id, variant.id, { quantity: 15, reason: 'RECEIVED' }),
    () => app.movements('other', store.id)]) await assert.rejects(call(), { code: 'NOT_FOUND' });
  assert.deepEqual(await app.listStores('other'), []);
  await app.activateProduct('owner', store.id, product.id);
  await assert.rejects(app.publicCatalog('store'), { code: 'NOT_FOUND' });
  await app.publishStore('owner', store.id);
  const catalog = await app.publicCatalog('store');
  assert.equal(catalog.products.length, 1);
  assert.equal(catalog.products[0].priceMinor, '999999999999999999');
  assert.equal('sku' in catalog.products[0].variants[0], false);
  assert.equal('ownerSubjectId' in catalog.store, false);
  assert.equal('version' in catalog.products[0], false);
  await app.createProduct('owner', store.id, { name: 'Draft', handle: 'draft', priceMinor: '100', variants: [{ name: 'One', sku: 'DRAFT-1', stock: 0 }] });
  assert.equal((await app.publicCatalog('store')).products.length, 1);
  await assert.rejects(app.updateProduct('owner', store.id, product.id, { compareMinor: '1' }), { code: 'INVALID' });
  assert.equal((await repo.findProduct(store.id, product.id)).compareMinor, null);
});
