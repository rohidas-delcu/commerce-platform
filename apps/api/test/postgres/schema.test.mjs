import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

test('PostgreSQL constraints enforce tenant references, uniqueness, exact money and rollback', async () => {
  assert.ok(process.env.DATABASE_URL, 'Use a disposable migrated DATABASE_URL.');
  await client.connect();
  await client.query('BEGIN');
  const s = randomUUID(), other = randomUUID(), p = randomUUID(), v = randomUUID();
  async function rejected(sql, params, code) {
    await client.query('SAVEPOINT invalid');
    await assert.rejects(client.query(sql, params), { code });
    await client.query('ROLLBACK TO SAVEPOINT invalid');
  }
  try {
    for (const id of [s, other]) await client.query('INSERT INTO "Store" (id,"ownerSubjectId",name,handle,"updatedAt") VALUES ($1,$2,$3,$4,NOW())', [id, 'schema-test', 'Store', id]);
    await client.query('INSERT INTO "Product" (id,"storeId",name,handle,"priceMinor","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())', [p, s, 'Bag', 'bag', '999999999999999999']);
    assert.equal((await client.query('SELECT version FROM "Product" WHERE id=$1', [p])).rows[0].version, 0);
    await rejected('UPDATE "Product" SET "compareMinor"=1 WHERE id=$1', [p], '23514');
    assert.equal((await client.query('SELECT "priceMinor" FROM "Product" WHERE id=$1', [p])).rows[0].priceMinor, '999999999999999999');
    await rejected('INSERT INTO "Product" (id,"storeId",name,handle,"priceMinor","updatedAt") VALUES ($1,$2,$3,$4,100,NOW())', [randomUUID(), s, 'Bag2', 'bag'], '23505');
    await client.query('INSERT INTO "ProductVariant" (id,"storeId","productId",name,sku,stock) VALUES ($1,$2,$3,$4,$5,10)', [v, s, p, 'Black', 'SCHEMA-1']);
    await rejected('INSERT INTO "ProductVariant" (id,"storeId","productId",name,sku) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), s, p, 'White', 'SCHEMA-1'], '23505');
    await rejected('UPDATE "ProductVariant" SET "storeId"=$1 WHERE id=$2', [other, v], '23503');
    await rejected('UPDATE "ProductVariant" SET stock=-1 WHERE id=$1', [v], '23514');
    await rejected('UPDATE "Product" SET "priceMinor"=0 WHERE id=$1', [p], '23514');
    await rejected('INSERT INTO "InventoryMovement" (id,"storeId","variantId","before","after",delta,reason,"actorSubjectId") VALUES ($1,$2,$3,10,15,5,$4,$5)', [randomUUID(), other, v, 'RECEIVED', 'schema-test'], '23503');
    await rejected('INSERT INTO "InventoryMovement" (id,"storeId","variantId","before","after",delta,reason,"actorSubjectId") VALUES ($1,$2,$3,10,15,4,$4,$5)', [randomUUID(), s, v, 'RECEIVED', 'schema-test'], '23514');
    await client.query('SAVEPOINT adjustment');
    await client.query('UPDATE "ProductVariant" SET stock=15 WHERE id=$1', [v]);
    await assert.rejects(client.query('INSERT INTO "InventoryMovement" (id,"storeId","variantId","before","after",delta,reason,"actorSubjectId") VALUES ($1,$2,$3,10,15,5,$4,$5)', [randomUUID(), s, v, 'INVALID', 'schema-test']), { code: '23514' });
    await client.query('ROLLBACK TO SAVEPOINT adjustment');
    assert.equal((await client.query('SELECT stock FROM "ProductVariant" WHERE id=$1', [v])).rows[0].stock, 10);
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM "InventoryMovement" WHERE "storeId"=$1', [s])).rows[0].count, 0);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
