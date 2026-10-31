import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {api,ApiError,ensureCsrf} from '../src/lib/api.ts';
import {money} from '../src/lib/types.ts';

test('money stays exact even above the safe JavaScript number range',()=>{
  assert.equal(money('999999999999999999','INR'),'₹9,99,99,99,99,99,99,999.99');
  assert.equal(money('-55','USD'),'-$0.55');
  assert.equal(money('0','GBP'),'£0.00');
});

const original=globalThis.fetch;
after(()=>{globalThis.fetch=original});
test('store CSRF is isolated; mutations send cookies, token and idempotency key',async()=>{
  const calls:Array<{url:string;method:string;headers:Headers;credentials?:RequestCredentials}>=[];
  globalThis.fetch=async(input,init)=>{
    const target=String(input),headers=new Headers(init?.headers);
    calls.push({url:target,method:init?.method||'GET',headers,credentials:init?.credentials});
    return new Response(JSON.stringify(target.endsWith('/auth/csrf')?{csrfToken:target.includes('/alpha-store/')?'token-a':'token-b'}:{ok:true}),{status:200});
  };
  await Promise.all([ensureCsrf('alpha-store'),ensureCsrf('alpha-store'),ensureCsrf('beta-store')]);
  await api.post('alpha-store','/cart',{test:'alpha'},'order-id-abc123');
  await api.post('beta-store','/cart',{test:'beta'});
  assert.equal(calls.filter(c=>c.url.endsWith('/auth/csrf')&&c.url.includes('/alpha-store/')).length,1);
  const a=calls.find(c=>c.method==='POST'&&c.url.includes('/alpha-store/'))!;
  const b=calls.find(c=>c.method==='POST'&&c.url.includes('/beta-store/'))!;
  assert.equal(a.headers.get('x-csrf-token'),'token-a');
  assert.equal(a.headers.get('idempotency-key'),'order-id-abc123');
  assert.equal(b.headers.get('x-csrf-token'),'token-b');
  for(const call of calls)assert.equal(call.credentials,'include');
  api.clear('alpha-store');api.clear('beta-store');
});

test('passes authorization errors through without masking the response',async()=>{
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Customer session expired.'}),{status:401});
  await assert.rejects(api.get('gamma-store','/customer/profile'),e=>e instanceof ApiError&&e.status===401&&e.message==='Customer session expired.');
  await assert.rejects(api.get('invalid/handle','/cart'),/Invalid storefront API path/);
});

test('uses the rotated CSRF token from an authenticated response',async()=>{
  let count=0;
  globalThis.fetch=async(_input,init)=>{
    count++;
    if(count===1)return new Response(JSON.stringify({csrfToken:'before'}),{status:200});
    if(count===2)return new Response(JSON.stringify({csrfToken:'after'}),{status:200});
    assert.equal(new Headers(init?.headers).get('x-csrf-token'),'after');
    return new Response(JSON.stringify({status:'ok'}),{status:200});
  };
  await api.post('delta-store','/customer/auth/login',{email:'test@example.com',password:'long-example-password'});
  await api.post('delta-store','/cart/refresh',{expectedVersion:0});
  assert.equal(count,3);
  api.clear('delta-store');
});
