import assert from 'node:assert/strict';
import test from 'node:test';
import {customerAddress} from '../src/customer/domain/customer.ts';
import {sessionCookie} from '../src/identity/http/session-cookie.ts';
test('customer address normalization selects approved fields and rejects unsafe or unsupported values',()=>{
  const input={name:' Example ',line1:' Street ',line2:'',city:'Pune',region:'MH',postalCode:'411001',countryCode:'in',phone:'+919999999999',expectedVersion:5,storeId:'untrusted'};
  const result=customerAddress(input);assert.equal(result.name,'Example');assert.equal(result.countryCode,'IN');assert.equal('expectedVersion'in result,false);assert.equal('storeId'in result,false);
  for(const changes of [{name:' '},{line1:'\u0000bad'},{countryCode:'ZZ'},{phone:'javascript:alert(1)'}])assert.throws(()=>customerAddress({...input,...changes}),{code:'INVALID'});
});
test('customer and merchant cookies share secure host-only policy without domain sharing',()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try{const headers={},response={setHeader:(k,v)=>{headers[k]=v;}};sessionCookie(response,'fixture','csrf',false,'delcu_customer_fixture');assert.match(headers['Set-Cookie'],/^__Host-delcu_customer_fixture=/);assert.match(headers['Set-Cookie'],/HttpOnly; Path=\/; SameSite=Lax/);assert.match(headers['Set-Cookie'],/; Secure$/);assert.equal(headers['Set-Cookie'].includes('Domain='),false);sessionCookie(response,'','',true,'delcu_customer_fixture');assert.match(headers['Set-Cookie'],/Max-Age=0/);}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
