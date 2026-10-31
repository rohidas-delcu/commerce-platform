import assert from 'node:assert/strict';
import test from 'node:test';
import {assertPermission,assertOwner,assertRemainingOwner,locale} from '../src/merchant/domain/access.ts';
test('central merchant policy prevents role escalation and protects last owner',()=>{
  for(const permission of ['store.read','store.settings','store.publish','catalog.write','inventory.write','members.manage'])assertPermission('ACCOUNT_OWNER',permission);
  assertPermission('STORE_EDITOR','inventory.write');
  assert.throws(()=>assertPermission('STORE_VIEWER','catalog.write'));
  assert.throws(()=>assertPermission('STORE_ADMIN','members.manage'));
  assert.throws(()=>assertPermission(null,'store.read'));
  assert.throws(()=>assertPermission('constructor','store.read'),{status:403});
  assert.throws(()=>assertOwner('STORE_ADMIN'));
  assert.throws(()=>assertRemainingOwner(0));assertRemainingOwner(1);
  locale('IN','INR');assert.throws(()=>locale('IN','USD'));assert.throws(()=>locale('XX','XXX'));
});

test('closed-store financial intent cannot be used to authorize catalog or inventory writes',async()=>{
 const {closedStoreFinance,closedStoreOrderAction}=await import('../src/merchant/domain/access.ts');assert.equal(closedStoreFinance('orders.read','financial'),true);assert.equal(closedStoreFinance('orders.manage','financial'),true);for(const permission of ['catalog.write','inventory.write','store.settings','store.publish','members.manage'])assert.throws(()=>closedStoreFinance(permission,'financial'));assert.equal(closedStoreOrderAction('CANCEL'),true);assert.equal(closedStoreOrderAction('DELIVER'),true);assert.equal(closedStoreOrderAction('DISPATCH'),false);assert.equal(closedStoreOrderAction('READY'),false);
});
