import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

if(process.env.NODE_ENV!=='test' || !process.env.DATABASE_URL)throw new Error('Use NODE_ENV=test and a disposable PostgreSQL server with CREATE DATABASE privileges.');
const name=`delcu_upgrade_${randomUUID().replaceAll('-','')}`;
const admin=new pg.Client({connectionString:process.env.DATABASE_URL});await admin.connect();
const url=new URL(process.env.DATABASE_URL);url.pathname=`/${name}`;url.searchParams.set('schema','public');
const root=fileURLToPath(new URL('../../../../',import.meta.url));
let created=false,fixture;
function command(...args){
  const result=spawnSync('pnpm',args,{cwd:root,env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8'});
  if(result.status!==0)throw new Error(`Migration command failed (${args.join(' ')}): ${result.stdout}\n${result.stderr}`);
}
const originalColumns=new Map();
async function snapshot(){
  const rows=[];
  for(const table of ['Store','Product','ProductVariant','InventoryMovement']){
    if(!originalColumns.has(table))originalColumns.set(table,(await fixture.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',['public',table])).rows.map(r=>r.column_name));
    const columns=originalColumns.get(table).map(c=>'"'+c.replaceAll('"','""')+'"').join(',');
    rows.push((await fixture.query(`SELECT row_to_json(s)::text AS snapshot FROM (SELECT ${columns} FROM "${table}" ORDER BY id) s`)).rows);
  }
  return rows;
}

try {
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  fixture=new pg.Client({connectionString:url.toString()});await fixture.connect();
  await fixture.query(await readFile(new URL('../../../../packages/database/prisma/migrations/20261030090000_foundation/migration.sql',import.meta.url),'utf8'));
  const s=randomUUID(),p=randomUUID(),v=randomUUID(),m=randomUUID();
  await fixture.query('INSERT INTO "Store" (id,"ownerSubjectId",name,handle,status,"updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())',[s,'unmapped-legacy-subject','Legacy preserved store','legacy-upgrade-fixture','PUBLISHED']);
  await fixture.query('INSERT INTO "Product" (id,"storeId",name,handle,"priceMinor","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())',[p,s,'Legacy bag','legacy-bag','999999999999999999']);
  await fixture.query('INSERT INTO "ProductVariant" (id,"storeId","productId",name,sku,stock) VALUES ($1,$2,$3,$4,$5,10)',[v,s,p,'Black','UPGRADE-SKU']);
  await fixture.query('INSERT INTO "InventoryMovement" (id,"storeId","variantId","before","after",delta,reason,"actorSubjectId") VALUES ($1,$2,$3,5,10,5,$4,$5)',[m,s,v,'RECEIVED','legacy-actor']);
  const before=await snapshot();
  command('exec','prisma','migrate','resolve','--applied','20261030090000_foundation','--config','packages/database/prisma.config.ts');
  // Also rehearse upgrading already-issued merchant credentials and sessions.
  const migrationRoot=new URL('../../../../packages/database/prisma/migrations/',import.meta.url);
  for(const migration of (await readdir(migrationRoot)).filter(m=>m>'20261030090000_foundation'&&m<='20261030144000_inventory_reservations').sort()){
    await fixture.query(await readFile(new URL(migration+'/migration.sql',migrationRoot),'utf8'));
    command('exec','prisma','migrate','resolve','--applied',migration,'--config','packages/database/prisma.config.ts');
  }
  const existingIdentity=randomUUID(),existingSession=randomUUID();
  await fixture.query('INSERT INTO "Identity" (id,email,name,"passwordHash","verifiedAt") VALUES ($1,$2,$3,$4,NOW())',[existingIdentity,'pre-scope@example.test','Preserved merchant','migration-fixture-hash']);
  await fixture.query('INSERT INTO "IdentitySession" (id,"identityId","csrfDigest","expiresAt","absoluteExpiresAt") VALUES ($1,$2,$3,NOW()+interval \'15 minutes\',NOW()+interval \'1 day\')',[existingSession,existingIdentity,'fixture-digest']);
  const originalIdentity=(await fixture.query('SELECT to_jsonb(i) AS snapshot FROM "Identity" i WHERE id=$1',[existingIdentity])).rows[0].snapshot;
  const originalSession=(await fixture.query('SELECT to_jsonb(i) AS snapshot FROM "IdentitySession" i WHERE id=$1',[existingSession])).rows[0].snapshot;
  command('db:deploy');command('db:deploy');command('db:status');command('db:drift');
  const identityAfter=(await fixture.query('SELECT * FROM "Identity" WHERE id=$1',[existingIdentity])).rows[0];
  assert.equal(identityAfter.scopeKey,'merchant');assert.equal(identityAfter.customerStoreId,null);
  const sessionAfter=(await fixture.query('SELECT * FROM "IdentitySession" WHERE id=$1',[existingSession])).rows[0];
  assert.equal(sessionAfter.scopeKey,'merchant');
  const identityOriginal=(await fixture.query(`SELECT to_jsonb(i)-'scopeKey'-'customerStoreId' AS snapshot FROM "Identity" i WHERE id=$1`,[existingIdentity])).rows[0].snapshot;
  const sessionOriginal=(await fixture.query(`SELECT to_jsonb(i)-'scopeKey' AS snapshot FROM "IdentitySession" i WHERE id=$1`,[existingSession])).rows[0].snapshot;
  assert.deepEqual(identityOriginal,originalIdentity);assert.deepEqual(sessionOriginal,originalSession);
  assert.deepEqual(await snapshot(),before,'Every original commerce column must be preserved.');
  const account=(await fixture.query('SELECT m.* FROM "Store" s JOIN "MerchantAccount" m ON m.id=s."merchantId" WHERE s.id=$1',[s])).rows[0];
  assert.equal(account.status,'QUARANTINED');assert.equal(account.legacySubject,'unmapped-legacy-subject');
  assert.equal((await fixture.query('SELECT COUNT(*)::int AS count FROM "MerchantMembership" WHERE "merchantId"=$1',[account.id])).rows[0].count,0);
  console.log('PASS: populated Phase 0 upgrade, repeat deployment, status, drift, exact commerce/identity/session preservation and unclaimed legacy quarantine.');
} finally {
  await fixture?.end();
  // Only the randomly named database created by this process is removed.
  if(created)await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
}
