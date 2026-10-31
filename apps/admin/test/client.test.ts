import test from 'node:test';
import assert from 'node:assert/strict';
import { majorToMinor, minorToMoney, minorToMajor } from '../src/lib/types.ts';
import { api, ApiError } from '../src/lib/api.ts';

test('minor unit conversion never rounds through floating point', () => {
  assert.equal(majorToMinor('2499.99'), '249999');
  assert.equal(majorToMinor('0.01'), '1');
  assert.equal(majorToMinor('9007199254740993.01'), '900719925474099301');
  assert.equal(minorToMajor('249999'), '2499.99');
  assert.equal(minorToMoney('900719925474099301','INR').replace(/,/g,''), '₹9007199254740993.01');
  assert.throws(() => majorToMinor('-1.00'));
  assert.throws(() => majorToMinor('2.001'));
});

test('merchant mutations bootstrap CSRF, include cookies and refresh rotated token', async () => {
  api.clearSession();
  const previous=globalThis.fetch;
  const recorded: Array<{path:string;headers:Headers;credentials?:RequestCredentials}> = [];
  globalThis.fetch = async (input,options) => {
    const path=String(input),headers=new Headers(options?.headers);
    recorded.push({path,headers,credentials:options?.credentials});
    if(path==='/v1/auth/csrf')return new Response(JSON.stringify({csrfToken:'token-one'}),{status:200});
    if(path==='/v1/auth/login')return new Response(JSON.stringify({csrfToken:'token-two'}),{status:200});
    return new Response(JSON.stringify({status:'ok'}),{status:200});
  };
  try {
    await api.post('/v1/auth/login',{email:'merchant@example.com',password:'secret'});
    await api.post('/v1/merchant/accounts',{name:'Merchant'});
    assert.equal(recorded.length,3);
    assert.equal(recorded[0].path,'/v1/auth/csrf');
    assert.equal(recorded[1].credentials,'include');
    assert.equal(recorded[1].headers.get('x-csrf-token'),'token-one');
    assert.equal(recorded[2].headers.get('x-csrf-token'),'token-two');
  } finally {globalThis.fetch=previous;api.clearSession();}
});

test('protected 401 notifies the app and clears the CSRF cache before the next login', async () => {
  api.clearSession();
  const previousFetch=globalThis.fetch;
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  let expired=0,bootstraps=0;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:(event:Event)=>{if(event.type==='commerce:session-expired')expired++;}}});
  globalThis.fetch=async(input)=>{
    const path=String(input);
    if(path==='/v1/auth/csrf'){bootstraps++;return new Response(JSON.stringify({csrfToken:`token-${bootstraps}`}),{status:200});}
    if(path.startsWith('/v1/merchant/'))return new Response(JSON.stringify({message:'Authentication required'}),{status:401});
    return new Response(JSON.stringify({status:'ok'}),{status:200});
  };
  try{
    await api.post('/v1/auth/signup',{name:'Merchant',email:'merchant@example.com',password:'A long test password'});
    await assert.rejects(()=>api.get('/v1/merchant/stores'),(error:unknown)=>error instanceof ApiError&&error.status===401);
    await api.post('/v1/auth/login',{email:'merchant@example.com',password:'A long test password'});
    assert.equal(expired,1);
    assert.equal(bootstraps,2);
  }finally{
    globalThis.fetch=previousFetch;
    if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);
    else Reflect.deleteProperty(globalThis,'window');
    api.clearSession();
  }
});
