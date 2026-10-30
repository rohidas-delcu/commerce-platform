import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { PrismaCommerceRepository } from '../../dist/infrastructure/prisma-commerce.repository.js';

async function fixture(t) {
  assert.ok(process.env.DATABASE_URL, 'Use a disposable migrated database.');
  const appName = `phase0-${randomUUID()}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('application_name', appName);
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url.toString();
  const repository = new PrismaCommerceRepository();
  process.env.DATABASE_URL = previous;
  await repository.onModuleInit();
  const sql = new pg.Client({ connectionString: previous }); await sql.connect();
  const store = await repository.createStore({ id: randomUUID(), ownerSubjectId: 'repo-test', name: 'Test', handle: randomUUID(), countryCode: 'IN', currencyCode: 'INR', status: 'DRAFT', createdAt: new Date().toISOString() });
  t.after(async () => {
    await sql.query('ROLLBACK');
    await sql.query('DELETE FROM "InventoryMovement" WHERE "storeId"=$1', [store.id]);
    await sql.query('DELETE FROM "ProductVariant" WHERE "storeId"=$1', [store.id]);
    await sql.query('DELETE FROM "Product" WHERE "storeId"=$1', [store.id]);
    await sql.query('DELETE FROM "Store" WHERE id=$1', [store.id]);
    await repository.onModuleDestroy(); await sql.end();
  });
  const product = await repository.createProduct({ id: randomUUID(), storeId: store.id, version: 0, name: 'Bag', handle: 'bag', description: '', collection: '', priceMinor: '999999999999999999', compareMinor: null, status: 'DRAFT', createdAt: new Date().toISOString(), variants: [{ id: randomUUID(), name: 'Black', sku: 'REPO-1', stock: 10 }] });
  const input = { storeId: store.id, variantId: product.variants[0].id, after: 15, reason: 'RECEIVED', note: '', actorSubjectId: 'repo-test' };
  return { repository, sql, store, product, input, appName };
}

test('PostgreSQL adapter rejects a concurrent stale stock update without losing history', { timeout: 15000 }, async t => {
  const { repository, sql, store, product, input, appName } = await fixture(t);
  await sql.query('BEGIN');
  await sql.query('SELECT id FROM "ProductVariant" WHERE id=$1 FOR UPDATE', [input.variantId]);
  const resultsPromise = Promise.allSettled([repository.adjustStock(input), repository.adjustStock({ ...input, after: 20 })]);
  let blocked = 0;
  try {
    for (let i = 0; i < 100; i++) {
      await sql.query('SELECT pg_stat_clear_snapshot()');
      blocked = (await sql.query("SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [appName])).rows[0].count;
      if (blocked >= 2) break;
      await delay(50);
    }
  } finally { await sql.query('COMMIT'); }
  const results = await resultsPromise;
  assert.equal(blocked, 2, 'Both transactions must read the same initial stock before release.');
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'CONFLICT');
  const movements = await repository.listMovements(store.id);
  assert.equal(movements.length, 1); assert.equal(movements[0].before, 10);
  assert.equal((await repository.findProduct(store.id, product.id)).variants[0].stock, movements[0].after);
  assert.equal((await repository.findProduct(store.id, product.id)).priceMinor, '999999999999999999');
});

test('PostgreSQL adapter rolls back stock when movement insertion fails', { timeout: 15000 }, async t => {
  const { repository, sql, store, product, input } = await fixture(t);
  const name = `reject_${randomUUID().replaceAll('-', '')}`;
  await sql.query(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test movement failure'; END; $$`);
  await sql.query(`CREATE TRIGGER "${name}" BEFORE INSERT ON "InventoryMovement" FOR EACH ROW WHEN (NEW."variantId" = '${input.variantId}'::uuid) EXECUTE FUNCTION "${name}"()`);
  try {
    await assert.rejects(repository.adjustStock(input));
    assert.equal((await repository.findProduct(store.id, product.id)).variants[0].stock, 10);
    assert.deepEqual(await repository.listMovements(store.id), []);
  } finally {
    await sql.query(`DROP TRIGGER "${name}" ON "InventoryMovement"`);
    await sql.query(`DROP FUNCTION "${name}"()`);
  }
});


test('PostgreSQL metadata versions reject stale saves and preserve adjusted stock', { timeout: 15000 }, async t => {
  const { repository, store, product, input } = await fixture(t);
  const current = await repository.saveProduct({ ...product, status: 'ACTIVE' });
  assert.equal(current.version, 1);
  await assert.rejects(repository.saveProduct({ ...product, name: 'Stale' }), { code: 'CONFLICT' });
  await repository.adjustStock(input);
  const saved = await repository.saveProduct({ ...current, name: 'Fresh' });
  assert.equal(saved.name, 'Fresh'); assert.equal(saved.status, 'ACTIVE');
  assert.equal(saved.variants[0].stock, 15);
  assert.equal(await repository.findProduct(randomUUID(), product.id), null);
  assert.equal((await repository.findProduct(store.id, product.id)).priceMinor, '999999999999999999');
});
