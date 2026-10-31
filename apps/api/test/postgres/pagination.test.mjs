import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {storefrontFixture} from '../support/storefront.mjs';
test('merchant lists reach records beyond 100 with stable ordering and preserve authority and private projections',{timeout:60000},async t=>{
  const f=await storefrontFixture(t),owner=await f.register(),foreign=await f.register(),identity=(await f.request(owner,'/v1/auth/me')).body;
  const accounts=Array.from({length:101},(_,i)=>({id:randomUUID(),name:'Page '+i,createdAt:new Date('2026-01-01T00:00:00Z')}));
  await f.db.merchantAccount.createMany({data:accounts});await f.db.merchantMembership.createMany({data:accounts.map(a=>({merchantId:a.id,identityId:identity.id,role:'ACCOUNT_OWNER'}))});
  const merchantId=accounts[0].id;
  await f.db.store.createMany({data:accounts.map((a,i)=>({merchantId,name:'Store '+i,handle:'page-'+a.id,ownerSubjectId:identity.id,createdAt:a.createdAt}))});
  await f.db.merchantInvitation.createMany({data:accounts.map((a,i)=>({merchantId,email:'invite'+i+'@example.test',role:'MEMBER',inviterId:identity.id,digest:a.id,expiresAt:new Date('2027-01-01T00:00:00Z')}))});
  const members=accounts.map(a=>({id:a.id,email:'member-'+a.id+'@example.test',name:'Member',passwordHash:'fixture-only-hash',verifiedAt:new Date()}));await f.db.identity.createMany({data:members});
  await f.db.merchantMembership.createMany({data:members.map(m=>({merchantId,identityId:m.id,role:'MEMBER'}))});
  for(const endpoint of ['/accounts','/stores','/accounts/'+merchantId+'/invitations','/accounts/'+merchantId+'/members']){
    const path='/v1/merchant'+endpoint,first=await f.request(owner,path+'?limit=100'),second=await f.request(owner,path+'?limit=100&offset=100');
    assert.equal(first.status,200);assert.equal(first.body.items.length,100);assert.equal(first.body.nextOffset,100);assert.equal(second.status,200);assert.ok(second.body.items.length>=1);assert.equal(second.body.nextOffset,null);
    const key=endpoint.endsWith('/members')?'identityId':'id';assert.equal(new Set([...first.body.items,...second.body.items].map(r=>r[key])).size,first.body.items.length+second.body.items.length,'Tied timestamps must not duplicate/lose rows between pages.');
    assert.equal(JSON.stringify(first.body).includes('fixture-only-hash'),false);assert.equal('digest'in first.body.items[0],false);
    assert.equal((await f.request(owner,path+'?offset=10001')).status,400);
    const stranger=await f.request(foreign,path);if(endpoint==='/accounts'||endpoint==='/stores')assert.equal(stranger.body.items.length,0);else assert.equal(stranger.status,404);
  }
});
